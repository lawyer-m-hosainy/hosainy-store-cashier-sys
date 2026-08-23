import Database from 'better-sqlite3';
import path from 'path';

// Define the path to the SQLite database file
const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'database.sqlite');

// Initialize the database connection
const db = new Database(dbPath, { verbose: console.log });

// Enable foreign keys
db.pragma('foreign_keys = ON');

export default db;
