// Break Timer (Pomodoro) functionality

let breakTimerSettings = null;
let breakTimerInterval = null;
let breakTimerState = {
    isRunning: false,
    isPaused: false,
    currentSession: 1,
    remainingSeconds: 0,
    mode: 'work', // 'work', 'shortBreak', 'longBreak'
    todaySessionsCompleted: 0,
    todayWorkTime: 0,
    startTime: 0,
    initialRemainingSeconds: 0,
    initialTodayWorkTime: 0
};

// Initialize break timer
document.addEventListener('DOMContentLoaded', () => {
    initializeBreakTimer();
});

function initializeBreakTimer() {
    // Timer control buttons
    const startBtn = document.getElementById('startBreakTimerBtn');
    const pauseBtn = document.getElementById('pauseBreakTimerBtn');
    const resetBtn = document.getElementById('resetBreakTimerBtn');
    const skipBtn = document.getElementById('skipBreakTimerBtn');
    const settingsBtn = document.getElementById('timerSettingsBtn');

    if (startBtn) startBtn.addEventListener('click', startBreakTimer);
    if (pauseBtn) pauseBtn.addEventListener('click', pauseBreakTimer);
    if (resetBtn) resetBtn.addEventListener('click', resetBreakTimer);
    if (skipBtn) skipBtn.addEventListener('click', skipBreakTimer);
    if (settingsBtn) settingsBtn.addEventListener('click', () => {
        // Switch to settings view
        document.querySelector('[data-view="settings"]').click();
    });

    // Settings save button
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', saveBreakTimerSettings);
    }

    // Test sound button
    const testSoundBtn = document.getElementById('testSoundBtn');
    if (testSoundBtn) {
        testSoundBtn.addEventListener('click', () => {
            playNotificationSound();
        });
    }

    // Load settings from DB
    loadBreakTimerSettings();
}

async function loadBreakTimerSettings() {
    try {
        const settings = await window.electronAPI.getBreakTimerSettings();

        if (settings) {
            breakTimerSettings = {
                workDuration: settings.work_duration,
                shortBreakDuration: settings.short_break_duration,
                longBreakDuration: settings.long_break_duration,
                sessionsBeforeLongBreak: settings.sessions_before_long_break,
                soundEnabled: settings.sound_enabled === 1,
                soundFile: settings.sound_file,
                autoStartWork: settings.auto_start_work === 1,
                autoStartBreak: settings.auto_start_break === 1
            };
        } else {
            // Default settings
            breakTimerSettings = {
                workDuration: 2400, // 40 minutes
                shortBreakDuration: 300, // 5 minutes
                longBreakDuration: 900, // 15 minutes
                sessionsBeforeLongBreak: 4,
                soundEnabled: true,
                soundFile: 'default.mp3',
                autoStartWork: false,
                autoStartBreak: true
            };
        }

        // Load today's session history
        const today = dayjs().format('YYYY-MM-DD');
        const history = await window.electronAPI.getSessionHistory(today);

        if (history) {
            breakTimerState.todaySessionsCompleted = history.sessions_completed;
            breakTimerState.todayWorkTime = history.total_work_time;
        }

        updateBreakTimerDisplay();
        updateSessionStats();
        populateSettingsForm();
    } catch (error) {
        console.error('Error loading break timer settings:', error);
    }
}

function populateSettingsForm() {
    if (!breakTimerSettings) return;

    document.getElementById('workDurationInput').value = breakTimerSettings.workDuration / 60;
    document.getElementById('shortBreakInput').value = breakTimerSettings.shortBreakDuration / 60;
    document.getElementById('longBreakInput').value = breakTimerSettings.longBreakDuration / 60;
    document.getElementById('sessionsBeforeLongBreak').value = breakTimerSettings.sessionsBeforeLongBreak;
    document.getElementById('soundEnabledCheck').checked = breakTimerSettings.soundEnabled;
    document.getElementById('autoStartWorkCheck').checked = breakTimerSettings.autoStartWork;
    document.getElementById('autoStartBreakCheck').checked = breakTimerSettings.autoStartBreak;
}

async function saveBreakTimerSettings() {
    const workDuration = parseInt(document.getElementById('workDurationInput').value) * 60;
    const shortBreakDuration = parseInt(document.getElementById('shortBreakInput').value) * 60;
    const longBreakDuration = parseInt(document.getElementById('longBreakInput').value) * 60;
    const sessionsBeforeLongBreak = parseInt(document.getElementById('sessionsBeforeLongBreak').value);
    const soundEnabled = document.getElementById('soundEnabledCheck').checked;
    const autoStartWork = document.getElementById('autoStartWorkCheck').checked;
    const autoStartBreak = document.getElementById('autoStartBreakCheck').checked;

    const settings = {
        workDuration,
        shortBreakDuration,
        longBreakDuration,
        sessionsBeforeLongBreak,
        soundEnabled,
        soundFile: 'default.mp3',
        autoStartWork,
        autoStartBreak
    };

    try {
        await window.electronAPI.updateBreakTimerSettings(settings);
        breakTimerSettings = settings;

        // Reset timer if not running
        if (!breakTimerState.isRunning) {
            resetBreakTimer();
        }

        if (window.showCustomAlert) {
            window.showCustomAlert('Break timer settings saved successfully!', 'Settings Saved');
        } else {
            alert('Settings saved successfully!');
        }
    } catch (error) {
        console.error('Error saving settings:', error);
        if (window.showCustomAlert) {
            window.showCustomAlert('Failed to save settings. Please try again.', 'Error');
        } else {
            alert('Failed to save settings');
        }
    }
}

function startBreakTimer() {
    if (breakTimerState.isRunning && !breakTimerState.isPaused) return;

    if (!breakTimerState.isRunning) {
        // First start
        breakTimerState.mode = 'work';
        breakTimerState.remainingSeconds = breakTimerSettings.workDuration;
    }

    breakTimerState.isRunning = true;
    breakTimerState.isPaused = false;

    // Update UI
    document.getElementById('startBreakTimerBtn').style.display = 'none';
    document.getElementById('pauseBreakTimerBtn').style.display = 'inline-flex';

    const timerCircle = document.querySelector('.timer-circle');
    if (timerCircle) {
        timerCircle.classList.add('running');
        if (breakTimerState.mode !== 'work') {
            timerCircle.classList.add('break');
        }
    }

    breakTimerState.startTime = Date.now();
    breakTimerState.initialRemainingSeconds = breakTimerState.remainingSeconds;
    breakTimerState.initialTodayWorkTime = breakTimerState.todayWorkTime;

    // Start countdown
    breakTimerInterval = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - breakTimerState.startTime) / 1000);

        breakTimerState.remainingSeconds = breakTimerState.initialRemainingSeconds - elapsed;

        if (breakTimerState.mode === 'work') {
            breakTimerState.todayWorkTime = breakTimerState.initialTodayWorkTime + elapsed;
        }

        updateBreakTimerDisplay();

        if (breakTimerState.remainingSeconds <= 0) {
            breakTimerState.remainingSeconds = 0;
            completeBreakTimerSession();
        }
    }, 1000);
}

function pauseBreakTimer() {
    if (!breakTimerState.isRunning) return;

    clearInterval(breakTimerInterval);
    breakTimerState.isPaused = true;

    document.getElementById('startBreakTimerBtn').style.display = 'inline-flex';
    document.getElementById('pauseBreakTimerBtn').style.display = 'none';

    const timerCircle = document.querySelector('.timer-circle');
    if (timerCircle) {
        timerCircle.classList.remove('running');
    }
}

function resetBreakTimer() {
    clearInterval(breakTimerInterval);

    breakTimerState.isRunning = false;
    breakTimerState.isPaused = false;
    breakTimerState.currentSession = 1;
    breakTimerState.mode = 'work';
    breakTimerState.remainingSeconds = breakTimerSettings.workDuration;

    document.getElementById('startBreakTimerBtn').style.display = 'inline-flex';
    document.getElementById('pauseBreakTimerBtn').style.display = 'none';

    const timerCircle = document.querySelector('.timer-circle');
    if (timerCircle) {
        timerCircle.classList.remove('running', 'break');
    }

    updateBreakTimerDisplay();
}

function skipBreakTimer() {
    if (!breakTimerState.isRunning) return;

    completeBreakTimerSession();
}

async function completeBreakTimerSession() {
    clearInterval(breakTimerInterval);

    // Show notification
    const notificationTitle = breakTimerState.mode === 'work' ? 'Work Session Complete!' : 'Break Complete!';
    const notificationBody = breakTimerState.mode === 'work' ? 'Time for a break!' : 'Back to work!';

    try {
        await window.electronAPI.showNotification({
            title: notificationTitle,
            body: notificationBody,
            silent: !breakTimerSettings.soundEnabled
        });

        // Play sound if enabled
        if (breakTimerSettings.soundEnabled) {
            playNotificationSound();
        }
    } catch (error) {
        console.error('Error showing notification:', error);
    }

    // Update session count and switch mode
    if (breakTimerState.mode === 'work') {
        breakTimerState.todaySessionsCompleted++;

        // Save session history
        const today = dayjs().format('YYYY-MM-DD');
        try {
            await window.electronAPI.addSessionHistory({
                id: generateId(),
                date: today,
                sessionsCompleted: breakTimerState.todaySessionsCompleted,
                totalWorkTime: breakTimerState.todayWorkTime
            });
        } catch (error) {
            console.error('Error saving session history:', error);
        }

        // Determine break type
        if (breakTimerState.currentSession >= breakTimerSettings.sessionsBeforeLongBreak) {
            breakTimerState.mode = 'longBreak';
            breakTimerState.remainingSeconds = breakTimerSettings.longBreakDuration;
            breakTimerState.currentSession = 1;
        } else {
            breakTimerState.mode = 'shortBreak';
            breakTimerState.remainingSeconds = breakTimerSettings.shortBreakDuration;
            breakTimerState.currentSession++;
        }
    } else {
        // Break complete, back to work
        breakTimerState.mode = 'work';
        breakTimerState.remainingSeconds = breakTimerSettings.workDuration;
    }

    updateBreakTimerDisplay();
    updateSessionStats();

    const timerCircle = document.querySelector('.timer-circle');
    if (timerCircle) {
        timerCircle.classList.remove('running');
        if (breakTimerState.mode !== 'work') {
            timerCircle.classList.add('break');
        } else {
            timerCircle.classList.remove('break');
        }
    }

    // Auto-start next session if enabled
    const shouldAutoStart = (breakTimerState.mode === 'work' && breakTimerSettings.autoStartWork) ||
        (breakTimerState.mode !== 'work' && breakTimerSettings.autoStartBreak);

    if (shouldAutoStart) {
        setTimeout(() => {
            startBreakTimer();
        }, 2000);
    } else {
        breakTimerState.isRunning = false;
        document.getElementById('startBreakTimerBtn').style.display = 'inline-flex';
        document.getElementById('pauseBreakTimerBtn').style.display = 'none';
    }
}

function updateBreakTimerDisplay() {
    const minutes = Math.floor(breakTimerState.remainingSeconds / 60);
    const seconds = breakTimerState.remainingSeconds % 60;
    const timeString = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    const countdownEl = document.getElementById('timerCountdown');
    if (countdownEl) {
        countdownEl.textContent = timeString;
    }

    const labelEl = document.getElementById('timerLabel');
    if (labelEl) {
        if (breakTimerState.mode === 'work') {
            labelEl.textContent = 'Work Time';
        } else if (breakTimerState.mode === 'shortBreak') {
            labelEl.textContent = 'Short Break';
        } else {
            labelEl.textContent = 'Long Break';
        }
    }

    const sessionEl = document.getElementById('sessionCounter');
    if (sessionEl) {
        sessionEl.textContent = `Session ${breakTimerState.currentSession}/${breakTimerSettings.sessionsBeforeLongBreak}`;
    }

    // Update progress circle
    const progressCircle = document.getElementById('timerProgress');
    if (progressCircle) {
        const totalSeconds = breakTimerState.mode === 'work' ? breakTimerSettings.workDuration :
            breakTimerState.mode === 'shortBreak' ? breakTimerSettings.shortBreakDuration :
                breakTimerSettings.longBreakDuration;

        const progress = (totalSeconds - breakTimerState.remainingSeconds) / totalSeconds;
        const circumference = 2 * Math.PI * 90; // radius = 90
        const offset = circumference * (1 - progress);

        progressCircle.style.strokeDashoffset = offset;
    }

    // Update config summary
    const configWork = document.getElementById('configWork');
    const configShort = document.getElementById('configShort');
    const configLong = document.getElementById('configLong');

    if (configWork) configWork.textContent = `Focus: ${breakTimerSettings.workDuration / 60}m`;
    if (configShort) configShort.textContent = `Short Break: ${breakTimerSettings.shortBreakDuration / 60}m`;
    if (configLong) configLong.textContent = `Long Break: ${breakTimerSettings.longBreakDuration / 60}m`;
}

function updateSessionStats() {
    const sessionsEl = document.getElementById('todaySessionsCount');
    if (sessionsEl) {
        sessionsEl.textContent = breakTimerState.todaySessionsCompleted;
    }

    const workTimeEl = document.getElementById('totalWorkTime');
    if (workTimeEl) {
        const hours = Math.floor(breakTimerState.todayWorkTime / 3600);
        const minutes = Math.floor((breakTimerState.todayWorkTime % 3600) / 60);
        workTimeEl.textContent = `${hours}h ${minutes}m`;
    }

    // Update dashboard stat
    const todaySessionsEl = document.getElementById('todaySessions');
    if (todaySessionsEl) {
        todaySessionsEl.textContent = breakTimerState.todaySessionsCompleted;
    }
}

function playNotificationSound() {
    try {
        const audio = new Audio('../../assets/sounds/notification.mp3');
        audio.play().catch(e => console.error('Error playing sound:', e));
    } catch (error) {
        console.error('Failed to play notification sound:', error);
    }
}
