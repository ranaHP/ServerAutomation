import Database from 'better-sqlite3';
import { config } from './config.js';
import { logger } from './logger.js';
import bcrypt from 'bcrypt';

const db = new Database(config.dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  created_by_user_id INTEGER NOT NULL,
  server_group TEXT NOT NULL,
  server_name TEXT NOT NULL,
  server_host TEXT NOT NULL,
  mode TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS session_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  step_key TEXT NOT NULL,
  step_name TEXT NOT NULL,
  commands_json TEXT,
  status TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  exit_code INTEGER,
  error TEXT
);
CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  ts TEXT NOT NULL,
  level TEXT NOT NULL,
  message TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  session_id TEXT,
  ts TEXT NOT NULL,
  metadata_json TEXT
);
`);

function seedAdmin() {
  const existing = db.prepare('SELECT * FROM users WHERE username = ?').get(config.defaultAdminUsername);
  if (!existing) {
    const hash = bcrypt.hashSync(config.defaultAdminPassword, 10);
    db.prepare('INSERT INTO users (username, password_hash, role, created_at) VALUES (?,?,?,?)')
      .run(config.defaultAdminUsername, hash, 'admin', new Date().toISOString());
    logger.warn('Seeded default admin user. Please change the password.');
  }
}

seedAdmin();

export { db };
