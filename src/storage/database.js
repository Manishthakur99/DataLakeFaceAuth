import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';

let db;

export async function initDatabase() {
  db = await SQLite.openDatabaseAsync('datalake_face.db');
  
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      embedding TEXT NOT NULL,
      photo_uri TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS attendance_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT,
      confidence REAL,
      timestamp TEXT DEFAULT (datetime('now')),
      location TEXT DEFAULT 'field',
      synced INTEGER DEFAULT 0
    );
  `);
  console.log('✅ Database initialized');
  return db;
}

export async function enrollUser(name, embedding, photoUri) {
  const id = await generateId('USR', name);
  await db.runAsync(
    `INSERT INTO users (id, name, embedding, photo_uri) VALUES (?, ?, ?, ?)`,
    [id, name, JSON.stringify(embedding), photoUri || '']
  );
  console.log('✅ User enrolled:', id, 'photo:', photoUri ? 'saved' : 'none');
  return id;
}

export async function getAllUsers() {
  const users = await db.getAllAsync('SELECT * FROM users');
  return users.map(u => ({
    ...u,
    embedding: JSON.parse(u.embedding),
  }));
}

export async function logAttendance(userId, userName, confidence, location = 'field') {
  const id = await generateId('LOG', userId);
  await db.runAsync(
    `INSERT INTO attendance_logs (id, user_id, user_name, confidence, location) VALUES (?, ?, ?, ?, ?)`,
    [id, userId, userName || '', confidence, location]
  );
  console.log('✅ Attendance logged:', id);
  return id;
}

export async function getPendingLogs() {
  return await db.getAllAsync(
    'SELECT * FROM attendance_logs WHERE synced = 0 ORDER BY timestamp DESC'
  );
}

export async function markSynced(logId) {
  await db.runAsync(
    'UPDATE attendance_logs SET synced = 1 WHERE id = ?', [logId]
  );
}

export async function getStats() {
  if (!db) return { totalUsers: 0, totalLogs: 0, pendingSync: 0 };
  try {
    const [u, l, p] = await Promise.all([
      db.getFirstAsync('SELECT COUNT(*) as count FROM users'),
      db.getFirstAsync('SELECT COUNT(*) as count FROM attendance_logs'),
      db.getFirstAsync('SELECT COUNT(*) as count FROM attendance_logs WHERE synced = 0'),
    ]);
    return {
      totalUsers: u.count,
      totalLogs: l.count,
      pendingSync: p.count,
    };
  } catch (e) {
    console.log('Stats error:', e);
    return { totalUsers: 0, totalLogs: 0, pendingSync: 0 };
  }
}

export async function getAllLogs() {
  return await db.getAllAsync(
    'SELECT * FROM attendance_logs ORDER BY timestamp DESC LIMIT 50'
  );
}

export async function clearAllUsers() {
  await db.runAsync('DELETE FROM users');
  await db.runAsync('DELETE FROM attendance_logs');
  console.log('✅ All users cleared');
}
async function generateId(prefix, name) {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}_${timestamp}_${random}`;
}
