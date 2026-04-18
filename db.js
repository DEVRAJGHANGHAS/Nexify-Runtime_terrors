const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../../bloodfinder.db'));
db.pragma('journal_mode = WAL');

// Initialize Users table
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    dob         TEXT    DEFAULT "",
    mobile      TEXT    NOT NULL UNIQUE,
    email       TEXT    NOT NULL UNIQUE,
    blood_group TEXT    DEFAULT '',
    address            TEXT DEFAULT "",
    last_donated       TEXT DEFAULT "",
    medical_conditions TEXT DEFAULT "",
    created_at  TEXT    DEFAULT (datetime('now'))
  );
`);

// Initialize User Progress table
db.exec(`
  CREATE TABLE IF NOT EXISTS user_progress (
    user_id     INTEGER PRIMARY KEY,
    chats       TEXT    DEFAULT '{}',
    extra_data  TEXT    DEFAULT '{}',
    updated_at  TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

console.log('✅ SQLite Database Service Initialized');

module.exports = db;
