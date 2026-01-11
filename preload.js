const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Category operations
    getCategories: () => ipcRenderer.invoke('db:getCategories'),
    addCategory: (category) => ipcRenderer.invoke('db:addCategory', category),
    updateCategory: (category) => ipcRenderer.invoke('db:updateCategory', category),
    deleteCategory: (id) => ipcRenderer.invoke('db:deleteCategory', id),

    // Time entry operations
    getTimeEntries: (filters) => ipcRenderer.invoke('db:getTimeEntries', filters),
    getTimeEntriesCount: (filters) => ipcRenderer.invoke('db:getTimeEntriesCount', filters),
    addTimeEntry: (entry) => ipcRenderer.invoke('db:addTimeEntry', entry),
    updateTimeEntry: (entry) => ipcRenderer.invoke('db:updateTimeEntry', entry),

    // Todo operations
    getTodos: (filters) => ipcRenderer.invoke('db:getTodos', filters),
    addTodo: (todo) => ipcRenderer.invoke('db:addTodo', todo),
    updateTodo: (todo) => ipcRenderer.invoke('db:updateTodo', todo),
    updateTodo: (todo) => ipcRenderer.invoke('db:updateTodo', todo),
    deleteTodo: (id) => ipcRenderer.invoke('db:deleteTodo', id),

    // Todo Project operations
    getTodoProjects: () => ipcRenderer.invoke('db:getTodoProjects'),
    addTodoProject: (project) => ipcRenderer.invoke('db:addTodoProject', project),
    deleteTodoProject: (id) => ipcRenderer.invoke('db:deleteTodoProject', id),

    // Subtask operations
    getSubtasks: (todoId) => ipcRenderer.invoke('db:getSubtasks', todoId),
    addSubtask: (subtask) => ipcRenderer.invoke('db:addSubtask', subtask),
    updateSubtask: (subtask) => ipcRenderer.invoke('db:updateSubtask', subtask),
    deleteSubtask: (id) => ipcRenderer.invoke('db:deleteSubtask', id),

    // Break timer operations
    getBreakTimerSettings: () => ipcRenderer.invoke('db:getBreakTimerSettings'),
    updateBreakTimerSettings: (settings) => ipcRenderer.invoke('db:updateBreakTimerSettings', settings),
    addSessionHistory: (session) => ipcRenderer.invoke('db:addSessionHistory', session),
    getSessionHistory: (date) => ipcRenderer.invoke('db:getSessionHistory', date),

    // Notifications
    showNotification: (options) => ipcRenderer.invoke('show-notification', options)
});
