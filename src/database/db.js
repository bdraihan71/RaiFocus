const initSqlJs = require('sql.js');
const path = require('path');
const { app } = require('electron');
const fs = require('fs');

let db = null;
let SQL = null;

// Database file location
const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'data.db');

// Initialize database
async function initDatabase() {
  try {
    // Initialize SQL.js
    SQL = await initSqlJs();

    // Load existing database or create new one
    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }

    // Create tables
    const schema = `
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        total_time INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS time_entries (
        id TEXT PRIMARY KEY,
        category_id TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT,
        duration INTEGER,
        note TEXT,
        is_manual INTEGER DEFAULT 0,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS todos (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        category_id TEXT,
        priority TEXT CHECK(priority IN ('high', 'medium', 'low')),
        status TEXT CHECK(status IN ('todo', 'in_progress', 'completed')),
        due_date TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        completed_at TEXT,
        FOREIGN KEY (category_id) REFERENCES todo_projects(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS todo_projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS subtasks (
        id TEXT PRIMARY KEY,
        todo_id TEXT NOT NULL,
        title TEXT NOT NULL,
        completed INTEGER DEFAULT 0,
        FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS break_timer_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        work_duration INTEGER NOT NULL DEFAULT 2400,
        short_break_duration INTEGER NOT NULL DEFAULT 300,
        long_break_duration INTEGER NOT NULL DEFAULT 900,
        sessions_before_long_break INTEGER NOT NULL DEFAULT 4,
        sound_enabled INTEGER DEFAULT 1,
        sound_file TEXT DEFAULT 'default.mp3',
        auto_start_work INTEGER DEFAULT 0,
        auto_start_break INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS session_history (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        sessions_completed INTEGER DEFAULT 0,
        total_work_time INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_time_entries_category ON time_entries(category_id);
      CREATE INDEX IF NOT EXISTS idx_time_entries_date ON time_entries(start_time);
      CREATE INDEX IF NOT EXISTS idx_todos_category ON todos(category_id);
      CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status);
    `;

    db.run(schema);

    // Insert default break timer settings if not exists
    const settingsCheck = db.exec('SELECT * FROM break_timer_settings WHERE id = 1');
    if (settingsCheck.length === 0) {
      db.run(`
        INSERT INTO break_timer_settings (id, work_duration, short_break_duration, long_break_duration, sessions_before_long_break)
        VALUES (1, 2400, 300, 900, 4)
      `);
    }

    // Save database to disk
    saveDatabase();

    console.log('Database initialized successfully at:', dbPath);
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

// Save database to disk
function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

// Helper function to execute queries and return results
function executeQuery(query, params = []) {
  try {
    if (!db) {
      console.error('Database not initialized');
      return [];
    }

    // For SELECT queries
    const results = db.exec(query, params);

    if (results.length === 0) {
      return [];
    }

    const columns = results[0].columns;
    const values = results[0].values;

    return values.map(row => {
      const obj = {};
      columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj;
    });
  } catch (error) {
    console.error('Query error:', query, params, error);
    return [];
  }
}

// Helper function to execute non-query statements
function executeNonQuery(query, params = []) {
  try {
    if (!db) {
      console.error('Database not initialized');
      return { success: false };
    }

    db.run(query, params);
    saveDatabase();
    return { success: true };
  } catch (error) {
    console.error('Execute error:', query, params, error);
    return { success: false, error: error.message };
  }
}

// Wrapper object for database operations
const dbWrapper = {
  prepare: (query) => {
    return {
      all: (...params) => {
        return executeQuery(query, params);
      },
      get: (...params) => {
        const results = executeQuery(query, params);
        return results.length > 0 ? results[0] : null;
      },
      run: (...params) => {
        return executeNonQuery(query, params);
      }
    };
  },
  exec: (query) => {
    if (!db) {
      console.error('Database not initialized');
      return;
    }
    db.run(query);
    saveDatabase();
  }
};

module.exports = { db: dbWrapper, initDatabase };
