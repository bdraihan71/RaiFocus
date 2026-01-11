const { app, BrowserWindow, ipcMain, Notification, Tray, Menu } = require('electron');
const path = require('path');
const { db, initDatabase } = require('./src/database/db');

let mainWindow;
let tray;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    backgroundColor: '#0f0f1a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    frame: true,
    icon: path.join(__dirname, 'assets/icons/app-icon.png'),
    show: false
  });

  mainWindow.loadFile('src/renderer/index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // Only open DevTools in development
    if (!app.isPackaged) {
      mainWindow.webContents.openDevTools();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets/icons/tray-icon.png');
  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show App', click: () => mainWindow.show() },
    { label: 'Quit', click: () => app.quit() }
  ]);

  tray.setToolTip('RaiFocus - Productivity App');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });
}

app.whenReady().then(async () => {
  await initDatabase();
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers for database operations
ipcMain.handle('db:getCategories', () => {
  try {
    console.log('Getting categories...');
    const stmt = db.prepare('SELECT * FROM categories ORDER BY created_at DESC');
    const result = stmt.all();
    console.log('Categories loaded:', result.length);
    return result;
  } catch (error) {
    console.error('Error getting categories:', error);
    return [];
  }
});

ipcMain.handle('db:addCategory', (event, category) => {
  try {
    console.log('Adding category:', category);
    const stmt = db.prepare('INSERT INTO categories (id, name, color, total_time, created_at) VALUES (?, ?, ?, ?, ?)');
    const result = stmt.run(category.id, category.name, category.color, 0, category.createdAt);
    console.log('Category added successfully:', result);
    return { success: true };
  } catch (error) {
    console.error('Error adding category:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:updateCategory', (event, category) => {
  try {
    console.log('Updating category:', category);
    const stmt = db.prepare('UPDATE categories SET name = ?, color = ? WHERE id = ?');
    const result = stmt.run(category.name, category.color, category.id);
    console.log('Category updated successfully:', result);
    return { success: true };
  } catch (error) {
    console.error('Error updating category:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:deleteCategory', (event, id) => {
  try {
    console.log('Deleting category:', id);
    const stmt = db.prepare('DELETE FROM categories WHERE id = ?');
    const result = stmt.run(id);
    console.log('Category deleted:', result);
    return { success: true };
  } catch (error) {
    console.error('Error deleting category:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:getTimeEntries', (event, filters) => {
  let query = 'SELECT * FROM time_entries';
  const params = [];
  const conditions = [];

  if (filters) {
    if (filters.startDate) {
      conditions.push('start_time >= ?');
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      conditions.push('start_time <= ?');
      params.push(filters.endDate);
    }

    if (filters.categoryId) {
      conditions.push('category_id = ?');
      params.push(filters.categoryId);
    }
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY start_time DESC';

  if (filters && filters.limit) {
    query += ' LIMIT ?';
    params.push(filters.limit);

    if (filters.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }
  }

  try {
    const stmt = db.prepare(query);
    return stmt.all(...params);
  } catch (err) {
    console.error('Error fetching time entries:', err);
    return [];
  }
});

ipcMain.handle('db:getTimeEntriesCount', (event, filters) => {
  let query = 'SELECT COUNT(*) as count FROM time_entries';
  const params = [];
  const conditions = [];

  if (filters) {
    if (filters.startDate) {
      conditions.push('start_time >= ?');
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      conditions.push('start_time <= ?');
      params.push(filters.endDate);
    }

    if (filters.categoryId) {
      conditions.push('category_id = ?');
      params.push(filters.categoryId);
    }
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  try {
    const stmt = db.prepare(query);
    const result = stmt.get(...params);
    return result ? result.count : 0;
  } catch (err) {
    console.error('Error counting time entries:', err);
    return 0;
  }
});

ipcMain.handle('db:addTimeEntry', (event, entry) => {
  const stmt = db.prepare('INSERT INTO time_entries (id, category_id, start_time, end_time, duration, note, is_manual) VALUES (?, ?, ?, ?, ?, ?, ?)');
  stmt.run(entry.id, entry.categoryId, entry.startTime, entry.endTime, entry.duration, entry.note, entry.isManual ? 1 : 0);

  // Update category total time
  if (entry.duration) {
    const updateStmt = db.prepare('UPDATE categories SET total_time = total_time + ? WHERE id = ?');
    updateStmt.run(entry.duration, entry.categoryId);
  }

  return { success: true };
});

ipcMain.handle('db:updateTimeEntry', (event, entry) => {
  const stmt = db.prepare('UPDATE time_entries SET end_time = ?, duration = ? WHERE id = ?');
  stmt.run(entry.endTime, entry.duration, entry.id);

  // Update category total time
  if (entry.duration) {
    const updateStmt = db.prepare('UPDATE categories SET total_time = total_time + ? WHERE id = ?');
    updateStmt.run(entry.duration, entry.categoryId);
  }

  return { success: true };
});

ipcMain.handle('db:getTodos', (event, filters) => {
  let query = 'SELECT * FROM todos';
  const params = [];

  if (filters?.status) {
    query += ' WHERE status = ?';
    params.push(filters.status);
  }

  query += ' ORDER BY created_at DESC';

  const stmt = db.prepare(query);
  return stmt.all(...params);
});

ipcMain.handle('db:addTodo', (event, todo) => {
  const stmt = db.prepare('INSERT INTO todos (id, title, category_id, priority, status, due_date, notes, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  stmt.run(todo.id, todo.title, todo.categoryId, todo.priority, todo.status, todo.dueDate, todo.notes, todo.createdAt, todo.completedAt);
  return { success: true };
});

ipcMain.handle('db:updateTodo', (event, todo) => {
  const stmt = db.prepare('UPDATE todos SET title = ?, category_id = ?, priority = ?, status = ?, due_date = ?, notes = ?, completed_at = ? WHERE id = ?');
  stmt.run(todo.title, todo.categoryId, todo.priority, todo.status, todo.dueDate, todo.notes, todo.completedAt, todo.id);
  return { success: true };
});

ipcMain.handle('db:deleteTodo', (event, id) => {
  const stmt = db.prepare('DELETE FROM todos WHERE id = ?');
  stmt.run(id);
  return { success: true };
});

ipcMain.handle('db:getSubtasks', (event, todoId) => {
  const stmt = db.prepare('SELECT * FROM subtasks WHERE todo_id = ?');
  return stmt.all(todoId);
});

ipcMain.handle('db:addSubtask', (event, subtask) => {
  const stmt = db.prepare('INSERT INTO subtasks (id, todo_id, title, completed) VALUES (?, ?, ?, ?)');
  stmt.run(subtask.id, subtask.todoId, subtask.title, subtask.completed ? 1 : 0);
  return { success: true };
});

ipcMain.handle('db:updateSubtask', (event, subtask) => {
  const stmt = db.prepare('UPDATE subtasks SET title = ?, completed = ? WHERE id = ?');
  stmt.run(subtask.title, subtask.completed ? 1 : 0, subtask.id);
  return { success: true };
});

ipcMain.handle('db:deleteSubtask', (event, id) => {
  const stmt = db.prepare('DELETE FROM subtasks WHERE id = ?');
  stmt.run(id);
  return { success: true };
});

// Todo Projects handlers
ipcMain.handle('db:getTodoProjects', () => {
  try {
    const stmt = db.prepare('SELECT * FROM todo_projects ORDER BY created_at DESC');
    return stmt.all();
  } catch (error) {
    console.error('Error getting todo projects:', error);
    return [];
  }
});

ipcMain.handle('db:addTodoProject', (event, project) => {
  try {
    const stmt = db.prepare('INSERT INTO todo_projects (id, name, color, created_at) VALUES (?, ?, ?, ?)');
    stmt.run(project.id, project.name, project.color, project.createdAt);
    return { success: true };
  } catch (error) {
    console.error('Error adding todo project:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:deleteTodoProject', (event, id) => {
  try {
    const stmt = db.prepare('DELETE FROM todo_projects WHERE id = ?');
    stmt.run(id);
    return { success: true };
  } catch (error) {
    console.error('Error deleting todo project:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:getBreakTimerSettings', () => {
  const stmt = db.prepare('SELECT * FROM break_timer_settings WHERE id = 1');
  return stmt.get();
});

ipcMain.handle('db:updateBreakTimerSettings', (event, settings) => {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO break_timer_settings 
    (id, work_duration, short_break_duration, long_break_duration, sessions_before_long_break, sound_enabled, sound_file, auto_start_work, auto_start_break)
    VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    settings.workDuration,
    settings.shortBreakDuration,
    settings.longBreakDuration,
    settings.sessionsBeforeLongBreak,
    settings.soundEnabled ? 1 : 0,
    settings.soundFile,
    settings.autoStartWork ? 1 : 0,
    settings.autoStartBreak ? 1 : 0
  );
  return { success: true };
});

ipcMain.handle('db:addSessionHistory', (event, session) => {
  const stmt = db.prepare('INSERT INTO session_history (id, date, sessions_completed, total_work_time) VALUES (?, ?, ?, ?)');
  stmt.run(session.id, session.date, session.sessionsCompleted, session.totalWorkTime);
  return { success: true };
});

ipcMain.handle('db:getSessionHistory', (event, date) => {
  const stmt = db.prepare('SELECT * FROM session_history WHERE date = ?');
  return stmt.get(date);
});

ipcMain.handle('show-notification', (event, options) => {
  const notification = new Notification({
    title: options.title,
    body: options.body,
    icon: path.join(__dirname, 'assets/icons/app-icon.png'),
    silent: options.silent || false
  });

  notification.show();

  if (options.sound && !options.silent) {
    // Play sound here if needed
  }

  return { success: true };
});
