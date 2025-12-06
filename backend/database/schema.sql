-- Summit Tracker Database Schema
-- SQLite version

-- Summits table
CREATE TABLE IF NOT EXISTS summits (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    elevation INTEGER,
    wikipedia TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    UNIQUE(latitude, longitude)
);

-- Create index on coordinates for faster lookups
CREATE INDEX IF NOT EXISTS idx_summits_coords ON summits(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_summits_name ON summits(name);

-- Visits table
CREATE TABLE IF NOT EXISTS visits (
    id INTEGER PRIMARY KEY,
    summit_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (summit_id) REFERENCES summits(id) ON DELETE CASCADE
);

-- Create index on summit_id for faster joins
CREATE INDEX IF NOT EXISTS idx_visits_summit ON visits(summit_id);
CREATE INDEX IF NOT EXISTS idx_visits_date ON visits(date);

-- Users table (for authentication)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    email TEXT,
    created_at TEXT NOT NULL,
    last_login TEXT
);

-- Sessions table (optional, for managing login sessions)
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
