// Main application script
// Navigation and view switching

document.addEventListener('DOMContentLoaded', () => {
    initializeNavigation();
    initializeDashboard();
    loadInitialData();
});

// Navigation
function initializeNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const viewName = item.dataset.view;

            // Update active nav item
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Update active view
            views.forEach(view => view.classList.remove('active'));
            document.getElementById(`${viewName}-view`).classList.add('active');

            // Load view-specific data
            loadViewData(viewName);
        });
    });
}

function loadViewData(viewName) {
    switch (viewName) {
        case 'dashboard':
            updateDashboard();
            break;
        case 'time-tracker':
            loadCategories();
            loadTimeEntries();
            break;
        case 'todos':
            loadTodos();
            break;
        case 'break-timer':
            loadBreakTimerSettings();
            break;
        case 'analytics':
            loadAnalytics();
            break;
        case 'settings':
            loadBreakTimerSettings();
            break;
    }
}

// Dashboard initialization
async function initializeDashboard() {
    await updateDashboard();
    setupGlobalAlerts();
}

function setupGlobalAlerts() {
    const alertModal = document.getElementById('customAlertModal');
    const closeBtn = document.getElementById('closeAlertBtn');

    if (closeBtn && alertModal) {
        closeBtn.addEventListener('click', () => {
            alertModal.classList.remove('active');
        });

        // Allow closing by clicking outside
        alertModal.addEventListener('click', (e) => {
            if (e.target === alertModal) {
                alertModal.classList.remove('active');
            }
        });
    }

    // Export globally
    window.showCustomAlert = function (message, title = 'Notification') {
        const modal = document.getElementById('customAlertModal');
        const titleEl = document.getElementById('alertTitle');
        const msgEl = document.getElementById('alertMessage');

        if (modal && titleEl && msgEl) {
            titleEl.textContent = title;
            msgEl.textContent = message;
            modal.classList.add('active');
        } else {
            // Fallback if modal DOM is missing
            alert(message);
        }
    };
}

async function updateDashboard() {
    try {
        const categories = await window.electronAPI.getCategories();
        const timeEntries = await window.electronAPI.getTimeEntries({});
        const todos = await window.electronAPI.getTodos({});

        // Calculate today's stats
        const today = dayjs().format('YYYY-MM-DD');
        const todayEntries = timeEntries.filter(entry =>
            entry.start_time && entry.start_time.startsWith(today)
        );

        const todaySeconds = todayEntries.reduce((sum, entry) => sum + (entry.duration || 0), 0);
        const todayHours = Math.floor(todaySeconds / 3600);
        const todayMinutes = Math.floor((todaySeconds % 3600) / 60);

        const todayCompletedTasks = todos.filter(todo =>
            todo.status === 'completed' &&
            todo.completed_at &&
            todo.completed_at.startsWith(today)
        ).length;

        // Update stat cards
        document.getElementById('todayHours').textContent = `${todayHours}h ${todayMinutes}m`;
        document.getElementById('todayTasks').textContent = todayCompletedTasks;
        document.getElementById('activeCategories').textContent = categories.length;

        // Update charts
        updateTodayChart(categories, timeEntries);
        updateWeeklyChart(timeEntries);
        updateRecentActivity(timeEntries, todos);

    } catch (error) {
        console.error('Error updating dashboard:', error);
    }
}

function updateTodayChart(categories, timeEntries) {
    const canvas = document.getElementById('todayChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const today = dayjs().format('YYYY-MM-DD');

    const todayEntries = timeEntries.filter(entry =>
        entry.start_time && entry.start_time.startsWith(today)
    );

    const categoryData = {};
    const categoryColors = {};

    categories.forEach(cat => {
        categoryData[cat.id] = 0;
        categoryColors[cat.id] = cat.color;
    });

    todayEntries.forEach(entry => {
        if (entry.category_id && entry.duration) {
            categoryData[entry.category_id] = (categoryData[entry.category_id] || 0) + entry.duration;
        }
    });

    const labels = [];
    const data = [];
    const colors = [];

    Object.entries(categoryData).forEach(([catId, duration]) => {
        if (duration > 0) {
            const category = categories.find(c => c.id === catId);
            if (category) {
                labels.push(category.name);
                data.push(Math.round(duration / 60)); // Convert to minutes
                colors.push(category.color);
            }
        }
    });

    if (window.todayChartInstance) {
        window.todayChartInstance.destroy();
    }

    if (data.length === 0) {
        ctx.font = '14px Inter';
        ctx.fillStyle = '#718096';
        ctx.textAlign = 'center';
        ctx.fillText('No data for today', canvas.width / 2, canvas.height / 2);
        return;
    }

    window.todayChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#a0aec0',
                        padding: 15,
                        font: {
                            size: 12,
                            family: 'Inter'
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return context.label + ': ' + context.parsed + ' min';
                        }
                    }
                }
            }
        }
    });
}

function updateWeeklyChart(timeEntries) {
    const canvas = document.getElementById('weeklyChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Get last 7 days
    const days = [];
    const data = [];

    for (let i = 6; i >= 0; i--) {
        const date = dayjs().subtract(i, 'day');
        days.push(date.format('ddd'));

        const dayEntries = timeEntries.filter(entry =>
            entry.start_time && entry.start_time.startsWith(date.format('YYYY-MM-DD'))
        );

        const daySeconds = dayEntries.reduce((sum, entry) => sum + (entry.duration || 0), 0);
        data.push(Math.round(daySeconds / 3600 * 10) / 10); // Convert to hours with 1 decimal
    }

    if (window.weeklyChartInstance) {
        window.weeklyChartInstance.destroy();
    }

    window.weeklyChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: days,
            datasets: [{
                label: 'Hours',
                data: data,
                backgroundColor: 'rgba(102, 126, 234, 0.8)',
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#a0aec0',
                        font: {
                            size: 11,
                            family: 'Inter'
                        }
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    }
                },
                x: {
                    ticks: {
                        color: '#a0aec0',
                        font: {
                            size: 11,
                            family: 'Inter'
                        }
                    },
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

function updateRecentActivity(timeEntries, todos) {
    const container = document.getElementById('recentActivityList');
    if (!container) return;

    container.innerHTML = '';

    // Combine and sort recent activities
    const activities = [];

    timeEntries.slice(0, 5).forEach(entry => {
        activities.push({
            type: 'time',
            time: entry.start_time,
            entry: entry
        });
    });

    todos.filter(t => t.status === 'completed').slice(0, 5).forEach(todo => {
        activities.push({
            type: 'todo',
            time: todo.completed_at,
            todo: todo
        });
    });

    activities.sort((a, b) => new Date(b.time) - new Date(a.time));

    activities.slice(0, 10).forEach(activity => {
        const item = document.createElement('div');
        item.className = 'activity-item';

        if (activity.type === 'time') {
            const duration = formatDuration(activity.entry.duration || 0);
            item.innerHTML = `
        <div class="activity-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="white">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/>
          </svg>
        </div>
        <div class="activity-content">
          <div class="activity-title">Tracked ${duration}</div>
          <div class="activity-time">${formatRelativeTime(activity.time)}</div>
        </div>
      `;
        } else {
            item.innerHTML = `
        <div class="activity-icon" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="white">
            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
            <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
          </svg>
        </div>
        <div class="activity-content">
          <div class="activity-title">Completed: ${activity.todo.title}</div>
          <div class="activity-time">${formatRelativeTime(activity.time)}</div>
        </div>
      `;
        }

        container.appendChild(item);
    });

    if (activities.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No recent activity</p></div>';
    }
}

async function loadInitialData() {
    try {
        await loadCategories();
        await loadTodos();
        await loadBreakTimerSettings();
    } catch (error) {
        console.error('Error loading initial data:', error);
    }
}

// Utility functions
function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    } else {
        return `${secs}s`;
    }
}

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatRelativeTime(dateString) {
    if (!dateString) return '';

    const date = dayjs(dateString);
    const now = dayjs();

    const diffMinutes = now.diff(date, 'minute');

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;

    const diffHours = now.diff(date, 'hour');
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = now.diff(date, 'day');
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.format('MMM D, YYYY');
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
