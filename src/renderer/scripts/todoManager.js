// Todo Manager Logic
(function () {
    let todos = [];
    let todoProjects = [];
    let currentProjectFilter = 'all';
    // This 'todoProjects' is now scoped to this IIFE.

    let editingTodoId = null;

    document.addEventListener('DOMContentLoaded', () => {
        // Only trigger if todo elements are present or when navigated
        // Usually initialized by app.js calling window.loadTodos
        if (document.getElementById('todos-view')) {
            initializeTodoManager();
        }
    });

    window.loadTodos = async function () {
        console.log('Loading todos...');
        try {
            // Fetch todo projects first if not loaded
            try {
                todoProjects = await window.electronAPI.getTodoProjects();
            } catch (e) { console.error('Error fetching projects', e); }

            todos = await window.electronAPI.getTodos({});
            updateProjectFilterDropdown();
            updateQuickAddDropdown();
            renderTodos();
        } catch (error) {
            console.error('Error loading todos:', error);
        }
    };

    function initializeTodoManager() {
        console.log('Initializing Todo Manager...');

        const quickAddBtn = document.getElementById('quickAddBtn');
        if (quickAddBtn) {
            quickAddBtn.addEventListener('click', quickAddTodo);
        }

        const quickAddInput = document.getElementById('quickAddTitle');
        if (quickAddInput) {
            quickAddInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') quickAddTodo();
            });
        }

        const closeTodoModal = document.getElementById('closeTodoModal');
        const cancelTodoBtn = document.getElementById('cancelTodoBtn');
        const saveTodoBtn = document.getElementById('saveTodoBtn');

        if (closeTodoModal) closeTodoModal.addEventListener('click', closeTodoModalHandler);
        if (cancelTodoBtn) cancelTodoBtn.addEventListener('click', closeTodoModalHandler);

        if (saveTodoBtn) {
            const newSaveBtn = saveTodoBtn.cloneNode(true);
            saveTodoBtn.parentNode.replaceChild(newSaveBtn, saveTodoBtn);
            newSaveBtn.addEventListener('click', saveTodo);
        }

        // Filter buttons
        const filterBtns = document.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                renderTodos();
            });
        });

        // Manage Projects Button
        const manageProjectsBtn = document.getElementById('manageTodoProjectsBtn');
        if (manageProjectsBtn) {
            manageProjectsBtn.addEventListener('click', openManageProjectsModal);
        }

        const closeManageModal = document.getElementById('closeManageTodoProjectsModal');
        if (closeManageModal) closeManageModal.addEventListener('click', closeManageProjectsModal);

        const addProjectBtn = document.getElementById('addTodoProjectBtn');
        if (addProjectBtn) addProjectBtn.addEventListener('click', addNewTodoProject);

        // Project Filter
        const projectFilterFn = document.getElementById('todoProjectFilter');
        if (projectFilterFn) {
            projectFilterFn.addEventListener('change', (e) => {
                currentProjectFilter = e.target.value;
                renderTodos();
            });
        }
    }

    function renderTodos() {
        // Corrected ID to 'todosList' to match index.html
        const list = document.getElementById('todosList');
        if (!list) return;

        console.log(`Rendering ${todos.length} todos`);

        list.innerHTML = '';
        const activeFilter = document.querySelector('.filter-btn.active');
        const filter = activeFilter ? activeFilter.dataset.filter : 'all';

        let filteredTodos = todos;
        // Fix filter logic based on index.html data-filter attributes
        if (filter === 'todo') {
            filteredTodos = todos.filter(t => t.status === 'todo');
        } else if (filter === 'in_progress') {
            filteredTodos = todos.filter(t => t.status === 'in_progress');
        } else if (filter === 'completed') {
            filteredTodos = todos.filter(t => t.status === 'completed');
        } else if (filter === 'all') {
            filteredTodos = todos;
        }

        // Apply Project Filter
        if (currentProjectFilter !== 'all') {
            if (currentProjectFilter === 'uncategorized') {
                filteredTodos = filteredTodos.filter(t => !t.category_id);
            } else {
                filteredTodos = filteredTodos.filter(t => t.category_id === currentProjectFilter);
            }
        }



        // Sort by priority and due date
        filteredTodos.sort((a, b) => {
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];

            if (priorityDiff !== 0) return priorityDiff;

            if (a.due_date && b.due_date) {
                return new Date(a.due_date) - new Date(b.due_date);
            }

            return new Date(b.created_at) - new Date(a.created_at);
        });

        if (filteredTodos.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <p>No tasks found</p>
                </div>
            `;
            return;
        }

        filteredTodos.forEach(async (todo) => {
            const project = todoProjects.find(c => c.id === todo.category_id);
            const item = document.createElement('div');
            item.className = `todo-item priority-${todo.priority}`;
            if (todo.status === 'completed') item.classList.add('completed');

            const catColor = project ? project.color : '#666';
            const catName = project ? project.name : 'No Project';
            const isChecked = todo.status === 'completed' ? 'checked' : '';

            item.innerHTML = `
        <div class="todo-checkbox ${isChecked}" onclick="window.toggleTodoStatus('${todo.id}')">
            ${isChecked ? '<svg width="12" height="12" viewBox="0 0 12 12" fill="white"><path d="M10 3L4.5 8.5L2 6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}
        </div>
        <div class="todo-content">
            <div class="todo-header" style="flex-direction: column; align-items: flex-start; gap: 6px;">
                 <div class="todo-title" style="margin-bottom: 0; cursor: pointer;" ondblclick="window.editTodo('${todo.id}')">${todo.title}</div>
                 <span class="todo-category" style="background-color: ${catColor}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 10px; opacity: 0.8;">${catName}</span>
                 ${todo.status === 'in_progress' ? '<span style="background: #fa709a; color: white; padding: 2px 8px; border-radius: 4px; font-size: 10px; margin-left: 4px;">In Progress</span>' : ''}
            </div>
            <div class="subtasks-section" id="subtasks-${todo.id}" style="margin-top: 12px;">
                <div class="subtasks-list"></div>
                <div style="display: flex; gap: 8px; margin-top: 8px;">
                    <input type="text" placeholder="Add subtask..." style="flex: 1; padding: 6px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.3); background: #2a2a3e; color: #fff; font-size: 12px;" id="subtask-input-${todo.id}">
                    <button onclick="window.addSubtask('${todo.id}')" style="padding: 6px 12px; background: var(--primary-gradient); border: none; border-radius: 6px; color: white; cursor: pointer; font-size: 12px;">+</button>
                </div>
            </div>
        </div>
        <div class="todo-actions" style="display: flex; align-items: center; gap: 6px;">
            ${todo.status === 'todo' ? `
                <button class="icon-btn start-task" onclick="window.setStatus('${todo.id}', 'in_progress')" style="background:var(--success-gradient); border:none; border-radius:4px; cursor:pointer; color: white; padding: 4px 8px; font-size: 11px; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                 ▶ Start
                </button>
            ` : ''}
            ${todo.status === 'in_progress' ? `
                <button class="icon-btn finish-task" onclick="window.setStatus('${todo.id}', 'completed')" style="background:var(--primary-gradient); border:none; border-radius:4px; cursor:pointer; color: white; padding: 4px 8px; font-size: 11px; font-weight: 600;">
                 ✅ Done
                </button>
                <button class="icon-btn reset-task" onclick="window.setStatus('${todo.id}', 'todo')" style="background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); border-radius:4px; cursor:pointer; color: #ccc; padding: 4px 6px; font-size: 11px;" title="Back to To Do">
                 ↩️
                </button>
            ` : ''}
            ${todo.status === 'completed' ? `
                <button class="icon-btn reopen-task" onclick="window.setStatus('${todo.id}', 'todo')" style="background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); border-radius:4px; cursor:pointer; color: #ccc; padding: 4px 8px; font-size: 11px; font-weight: 600;" title="Re-open Task">
                 ↩️ Re-open
                </button>
            ` : ''}
            <button class="icon-btn edit-todo" onclick="window.editTodo('${todo.id}')" style="background:none; border:none; cursor:pointer; color: #888; font-size: 16px; margin-left: 4px;">
             ✏️
            </button>
            <button class="icon-btn delete-todo" onclick="window.deleteTodo('${todo.id}')" style="background:none; border:none; cursor:pointer; color: #f5576c; font-size: 16px; margin-left: 2px;">
             🗑️
            </button>
        </div>
        `;
            list.appendChild(item);

            // Load subtasks for this todo
            loadSubtasksForTodo(todo.id);
        });
    }

    function updateProjectFilterDropdown() {
        const filterDropdown = document.getElementById('todoProjectFilter');
        if (!filterDropdown) return;

        // Save current selection to restore if possible
        // const current = filterDropdown.value; 

        filterDropdown.innerHTML = '<option value="all">All Projects</option>';

        // Add Uncategorized option
        filterDropdown.innerHTML += '<option value="uncategorized">Uncategorized / No Project</option>';

        todoProjects.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.name;
            filterDropdown.appendChild(option);
        });

        // Restore selection
        filterDropdown.value = currentProjectFilter;
    }

    function updateQuickAddDropdown() {
        const dropdown = document.getElementById('quickAddProject');
        if (!dropdown) return;

        // current selection
        const val = dropdown.value;

        dropdown.innerHTML = '<option value="">Select Project</option>';
        todoProjects.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.name;
            dropdown.appendChild(option);
        });

        dropdown.value = val;
    }

    // --- Manage Projects Logic ---
    function openManageProjectsModal() {
        const modal = document.getElementById('manageTodoProjectsModal');
        if (modal) {
            modal.classList.add('active');
            renderManageProjectsList();
        }
    }

    function closeManageProjectsModal() {
        const modal = document.getElementById('manageTodoProjectsModal');
        if (modal) modal.classList.remove('active');
    }

    function renderManageProjectsList() {
        const list = document.getElementById('todoProjectsList');
        if (!list) return;
        list.innerHTML = '';

        todoProjects.forEach(p => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.alignItems = 'center';
            row.style.padding = '8px';
            row.style.background = 'rgba(255,255,255,0.05)';
            row.style.borderRadius = '6px';

            row.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px;">
                    <div style="width:12px; height:12px; border-radius:50%; background:${p.color}"></div>
                    <span>${p.name}</span>
                </div>
                <button onclick="window.deleteTodoProject('${p.id}')" style="background:none; border:none; cursor:pointer; color:#f5576c;">&times;</button>
             `;
            list.appendChild(row);
        });
    }

    async function addNewTodoProject() {
        const nameInput = document.getElementById('newTodoProjectName');
        const colorInput = document.getElementById('newTodoProjectColor');
        const name = nameInput.value.trim();
        const color = colorInput.value;

        if (!name) return alert('Enter name');

        const project = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
            name,
            color,
            createdAt: new Date().toISOString()
        };

        await window.electronAPI.addTodoProject(project);

        // Refresh
        todoProjects = await window.electronAPI.getTodoProjects();
        renderManageProjectsList();
        updateProjectFilterDropdown();
        updateQuickAddDropdown();

        nameInput.value = '';
    }

    async function quickAddTodo() {
        const titleInput = document.getElementById('quickAddTitle');
        const projectSelect = document.getElementById('quickAddProject');
        const title = titleInput.value.trim();
        const categoryId = projectSelect.value;

        if (!title) return; // Silent fail if empty

        try {
            await window.electronAPI.addTodo({
                id: Date.now().toString(36) + Math.random().toString(36).substr(2),
                title,
                categoryId: categoryId || null,
                priority: 'medium',
                dueDate: null,
                notes: '',
                status: 'todo',
                createdAt: new Date().toISOString(),
                completedAt: null
            });

            titleInput.value = '';
            // maintain project selection

            await window.loadTodos();
            try { if (window.updateDashboard) await window.updateDashboard(); } catch (e) { }
        } catch (error) {
            console.error('Error adding todo:', error);
            alert('Failed to add task');
        }
    }

    window.deleteTodoProject = async function (id) {
        if (!confirm('Delete this project? Todos will act as uncategorized.')) return;
        await window.electronAPI.deleteTodoProject(id);
        todoProjects = await window.electronAPI.getTodoProjects();
        renderManageProjectsList();
        updateProjectFilterDropdown();
        updateQuickAddDropdown();
        renderTodos();
    }

    // Subtask Functions
    async function loadSubtasksForTodo(todoId) {
        try {
            const subtasks = await window.electronAPI.getSubtasks(todoId);
            const container = document.querySelector(`#subtasks-${todoId} .subtasks-list`);
            if (!container) return;

            container.innerHTML = '';
            subtasks.forEach(subtask => {
                const subtaskEl = document.createElement('div');
                subtaskEl.style.cssText = 'display: flex; align-items: center; gap: 8px; padding: 4px 0;';
                subtaskEl.innerHTML = `
                    <div onclick="window.toggleSubtask('${subtask.id}', '${todoId}')" style="width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.2); border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; ${subtask.completed ? 'background: var(--primary-gradient);' : ''}">
                        ${subtask.completed ? '<svg width="10" height="10" viewBox="0 0 10 10" fill="white"><path d="M8 2L3.5 7L1 4.5" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>' : ''}
                    </div>
                    <span style="flex: 1; font-size: 13px; color: #ddd; ${subtask.completed ? 'text-decoration: line-through; opacity: 0.6;' : ''}">${subtask.title}</span>
                    <button onclick="window.editSubtask('${subtask.id}', '${todoId}')" style="background:none; border:none; cursor:pointer; color: #888; font-size: 14px; padding: 2px;">✏️</button>
                    <button onclick="window.deleteSubtask('${subtask.id}', '${todoId}')" style="background:none; border:none; cursor:pointer; color: #f5576c; font-size: 14px; padding: 2px;">×</button>
                `;
                container.appendChild(subtaskEl);
            });
        } catch (error) {
            console.error('Error loading subtasks:', error);
        }
    }

    window.addSubtask = async function (todoId) {
        const input = document.getElementById(`subtask-input-${todoId}`);
        const title = input.value.trim();
        if (!title) return;

        try {
            await window.electronAPI.addSubtask({
                id: Date.now().toString(36) + Math.random().toString(36).substr(2),
                todoId,
                title,
                completed: false
            });
            input.value = '';
            loadSubtasksForTodo(todoId);
        } catch (error) {
            console.error('Error adding subtask:', error);
        }
    }

    window.toggleSubtask = async function (subtaskId, todoId) {
        try {
            const subtasks = await window.electronAPI.getSubtasks(todoId);
            const subtask = subtasks.find(s => s.id === subtaskId);
            if (!subtask) return;

            await window.electronAPI.updateSubtask({
                id: subtaskId,
                title: subtask.title,
                completed: !subtask.completed
            });
            loadSubtasksForTodo(todoId);
        } catch (error) {
            console.error('Error toggling subtask:', error);
        }
    }

    window.editSubtask = async function (subtaskId, todoId) {
        try {
            const subtasks = await window.electronAPI.getSubtasks(todoId);
            const subtask = subtasks.find(s => s.id === subtaskId);
            if (!subtask) return;

            // Find the subtask element and replace with input
            const container = document.querySelector(`#subtasks-${todoId} .subtasks-list`);
            const subtaskElements = container.querySelectorAll('div');

            subtaskElements.forEach(el => {
                const span = el.querySelector('span');
                if (span && span.textContent === subtask.title) {
                    // Replace with input
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.value = subtask.title;
                    input.style.cssText = 'flex: 1; padding: 4px 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.3); background: rgba(0,0,0,0.4); color: #fff; font-size: 13px;';

                    const saveEdit = async () => {
                        const newTitle = input.value.trim();
                        if (newTitle && newTitle !== subtask.title) {
                            await window.electronAPI.updateSubtask({
                                id: subtaskId,
                                title: newTitle,
                                completed: subtask.completed
                            });
                        }
                        loadSubtasksForTodo(todoId);
                    };

                    input.addEventListener('blur', saveEdit);
                    input.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter') saveEdit();
                    });

                    span.replaceWith(input);
                    input.focus();
                    input.select();
                }
            });
        } catch (error) {
            console.error('Error editing subtask:', error);
        }
    }

    window.deleteSubtask = async function (subtaskId, todoId) {
        if (!confirm('Delete this subtask?')) return;
        try {
            await window.electronAPI.deleteSubtask(subtaskId);
            loadSubtasksForTodo(todoId);
        } catch (error) {
            console.error('Error deleting subtask:', error);
        }
    }

    // Set specific status
    window.setStatus = async function (id, newStatus) {
        const todo = todos.find(t => t.id === id);
        if (!todo) return;

        const completedAt = newStatus === 'completed' ? new Date().toISOString() : null;

        try {
            await window.electronAPI.updateTodo({
                ...todo,
                status: newStatus,
                completedAt: completedAt,
                categoryId: todo.category_id,
                dueDate: todo.due_date,
                createdAt: todo.created_at
            });
            await window.loadTodos();
            try { if (window.updateDashboard) await window.updateDashboard(); } catch (e) { }
        } catch (error) {
            console.error('Error setting status:', error);
        }
    };

    // Expose helpers globally because inline onclicks use them
    window.toggleTodoStatus = async function (id) {
        const todo = todos.find(t => t.id === id);
        if (!todo) return;

        const newStatus = todo.status === 'completed' ? 'todo' : 'completed';
        const completedAt = newStatus === 'completed' ? new Date().toISOString() : null;

        try {
            await window.electronAPI.updateTodo({
                ...todo,
                status: newStatus,
                completedAt: completedAt,
                categoryId: todo.category_id,
                dueDate: todo.due_date
            });
            await window.loadTodos();
            // Try updating dashboard stats if available
            try { if (window.updateDashboard) await window.updateDashboard(); } catch (e) { }
        } catch (e) {
            console.error(e);
        }
    };

    window.editTodo = async function (id) {
        console.log('Edit todo clicked:', id);
        const todo = todos.find(t => t.id === id);
        console.log('Found todo:', todo);
        if (!todo) return;

        // Find the todo element and make title editable
        const todoItems = document.querySelectorAll('.todo-item');
        todoItems.forEach(item => {
            const titleEl = item.querySelector('.todo-title');
            if (titleEl && titleEl.textContent === todo.title) {
                const input = document.createElement('input');
                input.type = 'text';
                input.value = todo.title;
                input.style.cssText = 'width: 100%; padding: 4px 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.3); background: rgba(0,0,0,0.4); color: #fff; font-size: 16px; font-weight: 600;';

                const saveEdit = async () => {
                    const newTitle = input.value.trim();
                    if (newTitle && newTitle !== todo.title) {
                        try {
                            await window.electronAPI.updateTodo({
                                id: todo.id,
                                title: newTitle,
                                categoryId: todo.category_id,
                                priority: todo.priority,
                                status: todo.status,
                                dueDate: todo.due_date,
                                notes: todo.notes,
                                completedAt: todo.completed_at
                            });
                            await window.loadTodos();
                        } catch (error) {
                            console.error('Error editing todo:', error);
                            alert('Failed to edit task');
                        }
                    } else {
                        titleEl.textContent = todo.title;
                    }
                };

                input.addEventListener('blur', saveEdit);
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') saveEdit();
                    if (e.key === 'Escape') {
                        titleEl.textContent = todo.title;
                    }
                });

                titleEl.replaceWith(input);
                input.focus();
                input.select();
            }
        });
    };

    window.deleteTodo = async function (id) {
        if (!confirm('Delete this task?')) return;
        try {
            await window.electronAPI.deleteTodo(id);
            await window.loadTodos();
            try { if (window.updateDashboard) await window.updateDashboard(); } catch (e) { }
        } catch (e) { console.error(e); }
    };

    function openTodoModal(todo = null) {
        const modal = document.getElementById('todoModal');
        const titleInput = document.getElementById('todoTitle');
        const categorySelect = document.getElementById('todoCategory');
        const prioritySelect = document.getElementById('todoPriority');
        const dateInput = document.getElementById('todoDueDate');
        const notesInput = document.getElementById('todoNotes');
        const modalTitle = modal.querySelector('.modal-header h3');
        const saveBtn = document.getElementById('saveTodoBtn');

        if (!modal) return;

        // Populate projects
        categorySelect.innerHTML = '<option value="">Select Project</option>';
        todoProjects.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.name;
            categorySelect.appendChild(option);
        });

        modal.classList.add('active');

        if (todo && todo.id) {
            // Edit mode
            editingTodoId = todo.id;
            modalTitle.textContent = 'Edit Task';
            saveBtn.textContent = 'Update Task';

            titleInput.value = todo.title;
            categorySelect.value = todo.category_id || '';
            prioritySelect.value = todo.priority || 'medium';
            dateInput.value = todo.due_date ? todo.due_date.split('T')[0] : '';
            notesInput.value = todo.notes || '';
        } else {
            // Add mode
            editingTodoId = null;
            modalTitle.textContent = 'Add New Task';
            saveBtn.textContent = 'Save Task';

            titleInput.value = '';
            categorySelect.value = '';
            prioritySelect.value = 'medium';
            dateInput.value = '';
            notesInput.value = '';
        }
    }

    function closeTodoModalHandler() {
        const modal = document.getElementById('todoModal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    async function saveTodo() {
        const title = document.getElementById('todoTitle').value.trim();
        const categoryId = document.getElementById('todoCategory').value;
        const priority = document.getElementById('todoPriority').value;
        const dueDate = document.getElementById('todoDueDate').value;
        const notes = document.getElementById('todoNotes').value;

        if (!title) {
            if (window.showCustomAlert) window.showCustomAlert('Please enter a task title', 'Validation Error');
            else alert('Please enter a task title');
            return;
        }

        const todoData = {
            title,
            categoryId,
            priority,
            dueDate: dueDate || null,
            notes,
            status: 'todo'
        };

        try {
            if (editingTodoId) {
                // Update
                const existing = todos.find(t => t.id === editingTodoId);
                await window.electronAPI.updateTodo({
                    id: editingTodoId,
                    ...todoData,
                    status: existing.status,
                    completedAt: existing.completed_at
                });
            } else {
                // Create
                await window.electronAPI.addTodo({
                    id: Date.now().toString(36) + Math.random().toString(36).substr(2),
                    ...todoData,
                    createdAt: new Date().toISOString(),
                    completedAt: null
                });
            }

            closeTodoModalHandler();
            await window.loadTodos();
            try { if (window.updateDashboard) await window.updateDashboard(); } catch (e) { }
        } catch (error) {
            console.error('Error saving todo:', error);
            if (window.showCustomAlert) window.showCustomAlert('Failed to save task', 'Error');
            else alert('Failed to save task');
        }
    }
})();
