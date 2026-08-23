import db from './db';
import { schema } from './schema';

export function initializeDatabase() {
  try {
    db.exec(schema);
    
    // Phase 4 Migrations
    try { db.exec('ALTER TABLE customers ADD COLUMN points INTEGER DEFAULT 0;'); } catch(e){}
    try { db.exec('ALTER TABLE products ADD COLUMN has_expiry BOOLEAN DEFAULT 0;'); } catch(e){}
    try { db.exec('ALTER TABLE products ADD COLUMN expiry_date TEXT;'); } catch(e){}
    try { db.exec('ALTER TABLE sales ADD COLUMN points_earned INTEGER DEFAULT 0;'); } catch(e){}
    try { db.exec('ALTER TABLE sales ADD COLUMN points_redeemed INTEGER DEFAULT 0;'); } catch(e){}

    console.log('Database initialized successfully.');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}
