const Database = require('better-sqlite3');
const db = new Database('bookings.db');

db.prepare(`CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY,
  name TEXT,
  service TEXT,
  date TEXT,
  time TEXT,
  duration INTEGER,
  notes TEXT,
  created_at TEXT
)`).run();

module.exports = db;
