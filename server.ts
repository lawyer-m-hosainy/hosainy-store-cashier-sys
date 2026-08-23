import express from 'express';
import cors from 'cors';
import path from 'path';

import { initializeDatabase } from './src/db/init';
import db from './src/db/db';
import phase2Router from './src/api/phase2';
import authRouter, { authenticateToken, requireOwner } from './src/api/auth';
import multer from 'multer';
import fs from 'fs';
import { initCronJobs, processReports } from './src/api/reports';
import * as TelegramBotModule from 'node-telegram-bot-api';
const TelegramBot = (TelegramBotModule as any).default || TelegramBotModule;

export async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize SQLite Database
  initializeDatabase();
  
  // Initialize Cron Jobs for Auto Reporting
  initCronJobs();

  app.use(cors());
  app.use(express.json());

  // Mount Auth Router (unprotected)
  app.use('/api/auth', authRouter);

  // Protect all API routes
  app.use('/api', authenticateToken);
  
  fs.mkdirSync('uploads', { recursive: true });
  const upload = multer({ dest: 'uploads/' });

// --- Backup & Restore (Owner Only) ---
app.get('/api/backup/download', authenticateToken, requireOwner, (req: any, res: any) => {
  try {
    // Close DB connection safely, copy file, then reopen (or better: use SQLite backup API, but simple file copy works for SQLite if WAL is checkpointed)
    db.pragma('wal_checkpoint(FULL)');
    const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'database.sqlite');
    res.download(dbPath, `backup_${new Date().toISOString().split('T')[0]}.sqlite`);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

app.post('/api/backup/restore', authenticateToken, requireOwner, upload.single('db'), (req: any, res: any) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    // In a real scenario, we should close DB, replace file, reopen.
    // For this app, we can just copy the uploaded file over the existing one and restart.
    const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'database.sqlite');
    db.close();
    
    fs.copyFileSync(req.file.path, dbPath);
    fs.unlinkSync(req.file.path);
    
    // We should restart the server or re-initialize db.
    res.json({ success: true, message: 'تم استعادة النسخة بنجاح. سيتم إعادة تشغيل النظام...' });
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  } catch (error) {
    res.status(500).json({ error: 'Failed to restore backup' });
  }
});

// --- Settings API ---
app.get('/api/settings', authenticateToken, requireOwner, (req: any, res: any) => {
  try {
    const settings = db.prepare('SELECT * FROM settings').all();
    const config = settings.reduce((acc: any, curr: any) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

app.post('/api/settings', authenticateToken, requireOwner, (req: any, res: any) => {
  try {
    const settings = req.body;
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    db.transaction(() => {
      for (const [key, value] of Object.entries(settings)) {
        stmt.run(key, String(value));
      }
    })();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

app.post('/api/reports/test-telegram', authenticateToken, requireOwner, async (req: any, res: any) => {
  try {
    const settings = db.prepare('SELECT * FROM settings').all() as any[];
    const config = settings.reduce((acc: any, curr: any) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});
    
    if (!config.telegram_bot_token || !config.telegram_chat_id) {
      return res.status(400).json({ error: 'Missing token or chat_id' });
    }
    
    const bot = new TelegramBot(config.telegram_bot_token, { polling: false });
    await bot.sendMessage(config.telegram_chat_id, '✅ هذه رسالة تجريبية من برنامج مكتبة الحسيني.');
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to send test message' });
  }
});

app.use('/api', phase2Router);

  // --- API Routes ---
  
  // 0. Categories
  app.get('/api/categories', (req: any, res: any) => {
    try {
      const categories = db.prepare('SELECT * FROM categories').all();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch categories' });
    }
  });

  // 1. Products
  app.get('/api/products', (req: any, res: any) => {
    try {
      const search = req.query.search as string;
      let query = 'SELECT * FROM products WHERE is_active = 1';
      let params: any[] = [];
      
      if (search) {
        query += ' AND (name LIKE ? OR sku LIKE ?)';
        params = [`%${search}%`, `%${search}%`];
      }
      
      const products = db.prepare(query).all(...params) as any[];
      
      // Strip cost_price if not owner
      if (req.user.role !== 'owner') {
        products.forEach(p => delete p.cost_price);
      }
      
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch products' });
    }
  });

  app.post('/api/products', (req: any, res: any) => {
    if (req.user.role !== 'owner') return res.status(403).json({ error: 'صلاحيات غير كافية' });
    try {
      const { sku, name, category_id, unit, cost_price, sell_price, current_stock, reorder_level, has_expiry, expiry_date } = req.body;
      const stmt = db.prepare(`
        INSERT INTO products (sku, name, category_id, unit, cost_price, sell_price, current_stock, reorder_level, has_expiry, expiry_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(sku, name, category_id || null, unit || null, cost_price, sell_price, current_stock || 0, reorder_level || 5, has_expiry ? 1 : 0, expiry_date || null);
      res.json({ id: info.lastInsertRowid });
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        res.status(400).json({ error: 'SKU must be unique' });
      } else {
        res.status(500).json({ error: 'Failed to create product' });
      }
    }
  });

  app.put('/api/products/:id', (req: any, res: any) => {
    if (req.user.role !== 'owner') return res.status(403).json({ error: 'صلاحيات غير كافية' });
    try {
      const { sku, name, category_id, unit, cost_price, sell_price, current_stock, reorder_level, has_expiry, expiry_date } = req.body;
      const id = req.params.id;
      
      const oldProd = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
      
      const stmt = db.prepare(`
        UPDATE products 
        SET sku = ?, name = ?, category_id = ?, unit = ?, cost_price = ?, sell_price = ?, current_stock = ?, reorder_level = ?, has_expiry = ?, expiry_date = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      stmt.run(sku, name, category_id || null, unit || null, cost_price, sell_price, current_stock, reorder_level, has_expiry ? 1 : 0, expiry_date || null, id);
      
      const newProd = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
      
      const auditStmt = db.prepare('INSERT INTO audit_log (user_id, action, table_name, record_id, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?)');
      auditStmt.run(req.user.id, 'UPDATE', 'products', id, JSON.stringify(oldProd), JSON.stringify(newProd));
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update product' });
    }
  });
  
  // 2. Cash Sessions
  app.get('/api/cash-sessions/active', (req: any, res: any) => {
    try {
      const session = db.prepare("SELECT * FROM cash_sessions WHERE status = 'open' ORDER BY opened_at DESC LIMIT 1").get();
      res.json(session || null);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch active session' });
    }
  });
  
  app.post('/api/cash-sessions', (req: any, res: any) => {
    try {
      const { date, opening_balance } = req.body;
      // Close any open session first
      db.prepare("UPDATE cash_sessions SET status = 'closed', closed_at = CURRENT_TIMESTAMP WHERE status = 'open'").run();
      
      const stmt = db.prepare(`
        INSERT INTO cash_sessions (date, opening_balance, opened_by)
        VALUES (?, ?, ?)
      `);
      const info = stmt.run(date, opening_balance, req.user.id);
      res.json({ id: info.lastInsertRowid });
    } catch (error) {
      res.status(500).json({ error: 'Failed to open session' });
    }
  });

  app.post('/api/cash-sessions/:id/close', (req: any, res: any) => {
    try {
      const { closing_balance_actual } = req.body;
      const id = req.params.id;
      
      const session = db.prepare("SELECT * FROM cash_sessions WHERE id = ?").get() as any;
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      const salesTotal = (db.prepare("SELECT SUM(total) as total FROM sales WHERE cash_session_id = ? AND payment_method = 'cash' AND status = 'completed'").get() as any).total || 0;
      const expected = session.opening_balance + salesTotal;
      const diff = closing_balance_actual - expected;
      
      const stmt = db.prepare(`
        UPDATE cash_sessions 
        SET closing_balance_expected = ?, closing_balance_actual = ?, difference = ?, closed_by = ?, closed_at = CURRENT_TIMESTAMP, status = 'closed'
        WHERE id = ?
      `);
      stmt.run(expected, closing_balance_actual, diff, req.user.id, id);
      res.json({ success: true, expected, difference: diff });
    } catch (error) {
      res.status(500).json({ error: 'Failed to close session' });
    }
  });

  // 3. Sales
  app.post('/api/sales', (req: any, res: any) => {
    const { type, payment_method, subtotal, discount, delivery_fee, total, cash_session_id, items, customer, points_redeemed } = req.body;
    
    const date = new Date().toISOString().split('T')[0];
    const sale_number = 'INV-' + Date.now();
    
    // Calculate points earned (e.g. 1 point for every 100 EGP)
    const points_earned = Math.floor(total / 100);
    
    try {
      const transaction = db.transaction(() => {
        let customer_id = null;
        if (customer && customer.phone) {
          // Check if customer exists
          let cust = db.prepare("SELECT id FROM customers WHERE phone = ?").get(customer.phone) as any;
          if (cust) {
            customer_id = cust.id;
          } else {
            const custStmt = db.prepare("INSERT INTO customers (name, phone, address, source) VALUES (?, ?, ?, ?)");
            const custInfo = custStmt.run(customer.name, customer.phone, customer.address, type);
            customer_id = custInfo.lastInsertRowid;
          }
        }
        
        const saleStmt = db.prepare(`
          INSERT INTO sales (sale_number, type, date, customer_id, payment_method, subtotal, discount, delivery_fee, total, cash_session_id, user_id, points_earned, points_redeemed)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const saleInfo = saleStmt.run(sale_number, type, date, customer_id, payment_method, subtotal, discount || 0, delivery_fee || 0, total, cash_session_id || null, req.user.id, points_earned, points_redeemed || 0);
        const saleId = saleInfo.lastInsertRowid;
        
        // Update customer points
        if (customer_id) {
            const updatePoints = db.prepare('UPDATE customers SET points = points + ? - ? WHERE id = ?');
            updatePoints.run(points_earned, points_redeemed || 0, customer_id);
        }

        const itemStmt = db.prepare(`
          INSERT INTO sale_items (sale_id, product_id, qty, unit_price, cost_price_at_sale, line_total)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        const updateStockStmt = db.prepare(`
          UPDATE products SET current_stock = current_stock - ? WHERE id = ?
        `);

        for (const item of items) {
          const prod = db.prepare("SELECT cost_price FROM products WHERE id = ?").get(item.product_id) as any;
          itemStmt.run(saleId, item.product_id, item.qty, item.unit_price, prod.cost_price, item.line_total);
          updateStockStmt.run(item.qty, item.product_id);
        }
        
        return saleId;
      });

      const saleId = transaction();
      res.json({ id: saleId, sale_number });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to process sale' });
    }
  });

  // 4. Dashboard Stats
  app.get('/api/dashboard/today', (req: any, res: any) => {
    if (req.user.role !== 'owner') return res.status(403).json({ error: 'صلاحيات غير كافية' });
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const salesQuery = db.prepare("SELECT SUM(total) as total, COUNT(id) as count, type FROM sales WHERE date = ? AND status = 'completed' GROUP BY type").all(today) as any[];
      
      let instoreTotal = 0;
      let deliveryTotal = 0;
      let orderCount = 0;
      
      salesQuery.forEach(row => {
        orderCount += row.count;
        if (row.type === 'instore') instoreTotal += row.total;
        if (row.type === 'delivery') deliveryTotal += row.total;
      });
      
      // Calculate Gross Profit
      const profitQuery = db.prepare(`
        SELECT SUM(si.line_total - (si.qty * si.cost_price_at_sale)) as gross_profit 
        FROM sale_items si 
        JOIN sales s ON si.sale_id = s.id 
        WHERE s.date = ? AND s.status = 'completed'
      `).get(today) as any;

      const lowStock = db.prepare("SELECT count(*) as count FROM products WHERE current_stock <= reorder_level AND is_active = 1").get() as any;

      res.json({
        instoreTotal,
        deliveryTotal,
        totalSales: instoreTotal + deliveryTotal,
        orderCount,
        grossProfit: profitQuery.gross_profit || 0,
        lowStockCount: lowStock.count
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
  });


  // --- Vite Middleware (Development fallback & Production build) ---
  if (process.env.NODE_ENV !== 'production' && process.env.RUNNING_IN_ELECTRON !== 'true') {
    const viteModule = await import('vite');
    const vite = await viteModule.createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = __dirname;
    app.use(express.static(distPath));
    app.get('*', (req: any, res: any) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
  
  return server;
}

if (process.env.RUNNING_IN_ELECTRON !== 'true') {
  startServer();
}
