// Time Tracker functionality
(function () {
    let activeTimer = null;
    let timerInterval = null;
    let categories = [];
    let editingCategoryId = null;
    let timeEntriesPage = 1;
    const TIME_ENTRIES_PER_PAGE = 10;
    let totalTimeEntries = 0;

    // Initialize time tracker
    document.addEventListener('DOMContentLoaded', () => {
        // Only initialize if elements exist or view is active
        if (document.getElementById('categoriesGrid')) {
            initializeTimeTracker();
        }

        // Global Event Delegation for Categories
        document.addEventListener('click', async (e) => {
            const target = e.target;

            // --- START BUTTON ---
            const startBtn = target.closest('.start-btn');
            if (startBtn) {
                e.preventDefault();
                e.stopPropagation();

                const categoryId = startBtn.dataset.id;
                console.log('✅ Start button clicked:', categoryId);

                // Visual feedback
                startBtn.style.opacity = '0.5';
                setTimeout(() => startBtn.style.opacity = '1', 200);

                const category = categories.find(c => c.id === categoryId);
                if (category) {
                    startTimer(category);
                } else {
                    await loadCategories();
                    const refetched = categories.find(c => c.id === categoryId);
                    if (refetched) startTimer(refetched);
                    else console.error('Category not found for ID:', categoryId);
                }
                return;
            }

            // --- EDIT BUTTON ---
            const editBtn = target.closest('.edit-btn');
            if (editBtn) {
                e.preventDefault();
                e.stopPropagation();

                const categoryId = editBtn.dataset.id;
                console.log('✅ Edit button clicked:', categoryId);

                const category = categories.find(c => c.id === categoryId);
                if (category) {
                    openEditCategoryModal(category);
                }
                return;
            }

            // --- DELETE BUTTON ---
            const deleteBtn = target.closest('.delete');
            if (deleteBtn) {
                e.preventDefault();
                e.stopPropagation();

                const categoryId = deleteBtn.dataset.id;
                console.log('✅ Delete button clicked:', categoryId);

                deleteCategory(categoryId);
                return;
            }
        });
    });

    // Expose functions globally for app.js
    window.loadCategories = async function () {
        try {
            console.log('Loading categories...');
            categories = await window.electronAPI.getCategories();
            window.sharedCategories = categories; // Share with todos
            console.log(`Loaded ${categories.length} categories.`);
            renderCategories();
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    };

    window.loadTimeEntries = async function (page = 1) {
        try {
            timeEntriesPage = page;

            // Ensure categories are loaded for rendering
            if (categories.length === 0) {
                await window.loadCategories();
            }

            // Get total count first
            totalTimeEntries = await window.electronAPI.getTimeEntriesCount({});

            // Get paginated entries
            const offset = (timeEntriesPage - 1) * TIME_ENTRIES_PER_PAGE;
            const entries = await window.electronAPI.getTimeEntries({
                limit: TIME_ENTRIES_PER_PAGE,
                offset: offset
            });

            renderTimeEntries(entries);
        } catch (error) {
            console.error('Error loading time entries:', error);
        }
    };

    function initializeTimeTracker() {
        console.log('Initializing Time Tracker...');

        // Add category button
        const addCategoryBtn = document.getElementById('addCategoryBtn');
        if (addCategoryBtn) {
            const newAddBtn = addCategoryBtn.cloneNode(true);
            addCategoryBtn.parentNode.replaceChild(newAddBtn, addCategoryBtn);
            newAddBtn.addEventListener('click', openCategoryModal);
        }

        // Category modal buttons
        const closeCategoryModal = document.getElementById('closeCategoryModal');
        const cancelCategoryBtn = document.getElementById('cancelCategoryBtn');
        const saveCategoryBtn = document.getElementById('saveCategoryBtn');

        if (closeCategoryModal) {
            const newClose = closeCategoryModal.cloneNode(true);
            closeCategoryModal.parentNode.replaceChild(newClose, closeCategoryModal);
            newClose.addEventListener('click', closeCategoryModalHandler);
        }

        if (cancelCategoryBtn) {
            const newCancel = cancelCategoryBtn.cloneNode(true);
            cancelCategoryBtn.parentNode.replaceChild(newCancel, cancelCategoryBtn);
            newCancel.addEventListener('click', closeCategoryModalHandler);
        }

        if (saveCategoryBtn) {
            const newSaveBtn = saveCategoryBtn.cloneNode(true);
            saveCategoryBtn.parentNode.replaceChild(newSaveBtn, saveCategoryBtn);
            newSaveBtn.addEventListener('click', saveCategory);
        }

        // Stop timer button
        const stopTimerBtn = document.getElementById('stopTimerBtn');
        if (stopTimerBtn) {
            const newStopBtn = stopTimerBtn.cloneNode(true);
            stopTimerBtn.parentNode.replaceChild(newStopBtn, stopTimerBtn);
            newStopBtn.addEventListener('click', stopTimer);
        }
    }

    // Reuse internal helper
    async function loadCategories() {
        await window.loadCategories();
    }

    function renderCategories() {
        const grid = document.getElementById('categoriesGrid');
        if (!grid) return;

        grid.innerHTML = '';

        if (categories.length === 0) {
            grid.innerHTML = `
        <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            <h3>No Projects Yet</h3>
            <p>Create your first project to start tracking time</p>
        </div>
        `;
            return;
        }

        categories.forEach(category => {
            const card = document.createElement('div');
            card.className = 'category-card';
            if (activeTimer && activeTimer.categoryId === category.id) {
                card.classList.add('active');
            }
            card.style.setProperty('--category-color', category.color);

            // CHANGED: Use full format with seconds for display
            const formattedTime = formatDuration_Local_Full(category.total_time || 0);

            card.innerHTML = `
        <div class="category-header">
            <div class="category-stats">
            <div class="category-name">${category.name}</div>
            <div class="category-time">${formattedTime}</div>
            <div class="category-label">Total Time</div>
            </div>
            <div class="category-color-indicator" style="background: ${category.color};"></div>
        </div>
        <div class="category-actions">
            <button class="category-btn start-btn" data-id="${category.id}" style="z-index: 10; position: relative;">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" style="pointer-events: none;">
                <path d="M3.78 2.22a.75.75 0 011.06 0l4 4a.75.75 0 010 1.06l-4 4a.75.75 0 01-1.06-1.06L7.44 6.5 3.78 2.84a.75.75 0 010-1.06z"/>
            </svg>
            <strong>Start</strong>
            </button>
            <button class="category-btn edit-btn" data-id="${category.id}" style="z-index: 10; position: relative;" title="Edit">
            <svg width="16" height="16" viewBox="0 0 12 12" fill="currentColor" style="pointer-events: none;">
                <path d="M8.707 1.293a1 1 0 00-1.414 0L2 6.586V9h2.414l5.293-5.293a1 1 0 000-1.414l-1-1z"/>
            </svg>
            </button>
            <button class="category-btn delete" data-id="${category.id}" style="z-index: 10; position: relative;" title="Delete">
            <svg width="16" height="16" viewBox="0 0 12 12" fill="currentColor" style="pointer-events: none;">
                <path fill-rule="evenodd" d="M5 2a1 1 0 011-1h2a1 1 0 011 1v1h3a.5.5 0 010 1h-.5v6a2 2 0 01-2 2H4.5a2 2 0 01-2-2V4H2a.5.5 0 010-1h3V2zm1 0v1h2V2H6zM4.5 4a.5.5 0 00-.5.5v6a.5.5 0 00.5.5h5a.5.5 0 00.5-.5v-6a.5.5 0 00-.5-.5h-5z" clip-rule="evenodd"/>
            </svg>
            </button>
        </div>
        `;

            grid.appendChild(card);
        });
    }

    function openEditCategoryModal(category) {
        console.log('✏️ Opening edit modal for category:', category);
        editingCategoryId = category.id;

        const modal = document.getElementById('categoryModal');
        const nameInput = document.getElementById('categoryName');
        const colorInput = document.getElementById('categoryColor');
        const modalTitle = modal.querySelector('.modal-header h3');
        const saveBtn = document.getElementById('saveCategoryBtn');

        if (modal && nameInput && colorInput) {
            modal.classList.add('active');
            modal.dataset.editingId = category.id;

            if (modalTitle) modalTitle.textContent = 'Edit Project';
            if (saveBtn) saveBtn.textContent = 'Update Project';

            nameInput.value = category.name;
            colorInput.value = (category.color && category.color.startsWith('#')) ? category.color : '#667eea';
        }
    }

    function openCategoryModal() {
        console.log('➕ Opening add modal');
        editingCategoryId = null;
        const modal = document.getElementById('categoryModal');
        const nameInput = document.getElementById('categoryName');
        const colorInput = document.getElementById('categoryColor');
        const modalTitle = modal.querySelector('.modal-header h3');
        const saveBtn = document.getElementById('saveCategoryBtn');

        if (modal) {
            modal.classList.add('active');
            modal.dataset.editingId = '';

            if (modalTitle) modalTitle.textContent = 'Add Project';
            if (saveBtn) saveBtn.textContent = 'Save Project';

            if (nameInput) nameInput.value = '';
            if (colorInput) colorInput.value = '#667eea';
        }
    }

    function closeCategoryModalHandler() {
        const modal = document.getElementById('categoryModal');
        if (modal) {
            modal.classList.remove('active');
            modal.dataset.editingId = '';
        }
    }

    async function saveCategory() {
        console.log('Saving category...');
        const nameInput = document.getElementById('categoryName');
        const colorInput = document.getElementById('categoryColor');

        if (!nameInput || !colorInput) {
            console.error('Inputs not found');
            return;
        }

        const name = nameInput.value.trim();
        const color = colorInput.value;

        if (!name) {
            if (window.showCustomAlert) window.showCustomAlert('Please enter a project name', 'Validation Error');
            else alert('Please enter a project name');
            return;
        }

        try {
            if (editingCategoryId) {
                // Update
                const result = await window.electronAPI.updateCategory({
                    id: editingCategoryId,
                    name: name,
                    color: color
                });

                if (!result.success) throw new Error(result.error || 'Failed to update category');
                editingCategoryId = null;
            } else {
                // Create
                const category = {
                    id: generateId(),
                    name: name,
                    color: color,
                    createdAt: new Date().toISOString()
                };
                const result = await window.electronAPI.addCategory(category);
                if (!result.success) throw new Error(result.error || 'Failed to add category');
            }

            closeCategoryModalHandler();
            await window.loadCategories();
            try { if (typeof updateDashboard === 'function') await updateDashboard(); } catch (e) { }
        } catch (error) {
            console.error('Error saving category:', error);
            if (window.showCustomAlert) window.showCustomAlert('Failed to save category', 'Error');
            else alert('Failed to save category');
        }
    }

    async function deleteCategory(id) {
        if (!confirm('Are you sure? All associated time entries will be deleted.')) return;

        try {
            const result = await window.electronAPI.deleteCategory(id);
            if (!result.success) throw new Error(result.error || 'Failed to delete category');

            await window.loadCategories();
            try { if (typeof updateDashboard === 'function') await updateDashboard(); } catch (e) { }
        } catch (error) {
            console.error('Error deleting category:', error);
            if (window.showCustomAlert) window.showCustomAlert('Failed to delete category', 'Error');
            else alert('Failed to delete category');
        }
    }

    async function startTimer(category) {
        // Stop any active timer first
        if (activeTimer) {
            await stopTimer();
        }

        try {
            activeTimer = {
                categoryId: category.id,
                startTime: Date.now(),
                elapsedSeconds: 0
            };

            // Initial UI update
            updateTimerDisplay();
            renderCategories();

            // Start interval
            timerInterval = setInterval(() => {
                activeTimer.elapsedSeconds = Math.floor((Date.now() - activeTimer.startTime) / 1000);
                updateTimerDisplay();
            }, 1000);

            // Show active timer section
            const section = document.querySelector('.active-timer-section');
            if (section) section.style.display = 'block';

        } catch (error) {
            console.error('Error starting timer:', error);
        }
    }

    async function stopTimer() {
        if (!activeTimer) return;

        try {
            const endTime = Date.now();
            const duration = Math.floor((endTime - activeTimer.startTime) / 1000);

            if (duration > 0) {
                // Save entry
                await window.electronAPI.addTimeEntry({
                    id: generateId(),
                    categoryId: activeTimer.categoryId,
                    startTime: new Date(activeTimer.startTime).toISOString(),
                    endTime: new Date(endTime).toISOString(),
                    duration: duration,
                    note: '', // Ensure note is defined
                    isManual: false
                });
            }

            // Cleanup
            clearInterval(timerInterval);
            activeTimer = null;
            timerInterval = null;

            // Update UI
            const section = document.querySelector('.active-timer-section');
            if (section) section.style.display = 'none';

            const sidebarTimer = document.getElementById('sidebarActiveTimer');
            if (sidebarTimer) sidebarTimer.style.display = 'none';

            await window.loadCategories();
            try { await window.loadTimeEntries(); } catch (e) { }
            try { if (typeof updateDashboard === 'function') await updateDashboard(); } catch (e) { }
            renderCategories(); // Clear active state
        } catch (error) {
            console.error('Error stopping timer:', error);
        }
    }

    function updateTimerDisplay() {
        if (!activeTimer) return;
        const timeString = formatTime_Local(activeTimer.elapsedSeconds);
        const activeTimerDisplay = document.getElementById('activeTimerDisplay');
        if (activeTimerDisplay) activeTimerDisplay.textContent = timeString;

        const sidebarTimer = document.getElementById('sidebarActiveTimer');
        if (sidebarTimer) {
            sidebarTimer.style.display = 'flex';
            const category = categories.find(c => c.id === activeTimer.categoryId);
            sidebarTimer.querySelector('.timer-category').textContent = category ? category.name : 'Focusing';
            sidebarTimer.querySelector('.timer-duration').textContent = timeString;
        }
    }

    function renderTimeEntries(entries) {
        const list = document.getElementById('timeEntriesList');
        if (!list) return;

        list.innerHTML = '';

        if (!entries || entries.length === 0) {
            list.innerHTML = '<div class="empty-state"><p>No time entries yet</p></div>';
            return;
        }

        entries.forEach(entry => {
            const category = categories.find(c => c.id === entry.category_id);
            // Gracefully handle missing category, mark as Deleted
            const catName = category ? category.name : 'Deleted Project';
            const catColor = category ? category.color : '#e74c3c'; // Red for deleted

            const item = document.createElement('div');
            item.className = 'entry-item';
            item.style.setProperty('--entry-color', catColor);

            const startTime = dayjs(entry.start_time);
            const duration = formatDuration_Local(entry.duration || 0);

            item.innerHTML = `
        <div class="entry-color"></div>
        <div class="entry-content">
            <div class="entry-info">
            <h4 style="${!category ? 'color: #e74c3c; font-style: italic;' : ''}">${catName}</h4>
            <div class="entry-time">${startTime.format('MMM D, YYYY h:mm A')}</div>
            </div>
            <div class="entry-duration">${duration}</div>
        </div>
        `;

            list.appendChild(item);
        });

        // Add Pagination Controls
        const totalPages = Math.ceil(totalTimeEntries / TIME_ENTRIES_PER_PAGE);
        if (totalPages > 1) {
            const paginationContainer = document.createElement('div');
            paginationContainer.className = 'pagination-controls';
            paginationContainer.style.display = 'flex';
            paginationContainer.style.justifyContent = 'center';
            paginationContainer.style.alignItems = 'center';
            paginationContainer.style.marginTop = '20px';
            paginationContainer.style.gap = '15px';

            const prevBtn = document.createElement('button');
            prevBtn.className = 'btn btn-secondary btn-sm';
            prevBtn.textContent = 'Previous';
            prevBtn.disabled = timeEntriesPage === 1;
            prevBtn.onclick = () => window.loadTimeEntries(timeEntriesPage - 1);

            const nextBtn = document.createElement('button');
            nextBtn.className = 'btn btn-secondary btn-sm';
            nextBtn.textContent = 'Next';
            nextBtn.disabled = timeEntriesPage === totalPages;
            nextBtn.onclick = () => window.loadTimeEntries(timeEntriesPage + 1);

            const pageInfo = document.createElement('span');
            pageInfo.textContent = `Page ${timeEntriesPage} of ${totalPages}`;
            pageInfo.style.color = 'var(--text-secondary)';

            paginationContainer.appendChild(prevBtn);
            paginationContainer.appendChild(pageInfo);
            paginationContainer.appendChild(nextBtn);

            list.appendChild(paginationContainer);
        }
    }

    // Local Formatters to avoid scope pollution
    function formatTime_Local(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    function formatDuration_Local(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hours > 0) return `${hours}h ${minutes}m`;
        else if (minutes > 0) return `${minutes}m ${secs}s`;
        else return `${secs}s`;
    }

    // New format with enforced seconds for card display
    function formatDuration_Local_Full(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
        return `${minutes}m ${secs}s`;
    }

    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
})();
