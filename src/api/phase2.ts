import express from 'express';
import db from '../db/db';
import puppeteer from 'puppeteer';
import { requireOwner } from './auth';

const router = express.Router();

// --- 1. Suppliers & Supplier Payments ---
router.get('/suppliers', (req, res) => {
  try {
    const suppliers = db.prepare(`
      SELECT s.*, 
        (SELECT COALESCE(SUM(total), 0) FROM purchases WHERE supplier_id = s.id AND payment_status != 'paid') 
        - 
        (SELECT COALESCE(SUM(amount), 0) FROM supplier_payments WHERE supplier_id = s.id AND purchase_id IS NULL) 
        as due_balance
      FROM suppliers s
    `).all();
    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch suppliers' });
  }
});

router.post('/suppliers', (req, res) => {
  try {
    const { name, phone, address, notes } = req.body;
    const stmt = db.prepare('INSERT INTO suppliers (name, phone, address, notes) VALUES (?, ?, ?, ?)');
    const info = stmt.run(name, phone, address, notes);
    res.json({ id: info.lastInsertRowid });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add supplier' });
  }
});

router.post('/suppliers/:id/payments', (req, res) => {
  try {
    const { amount, date, notes, purchase_id } = req.body;
    const stmt = db.prepare('INSERT INTO supplier_payments (supplier_id, purchase_id, amount, date, notes) VALUES (?, ?, ?, ?, ?)');
    stmt.run(req.params.id, purchase_id || null, amount, date, notes);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add payment' });
  }
});

// --- 2. Purchases ---
router.get('/purchases', (req: any, res: any) => {
  try {
    const purchases = db.prepare(`
      SELECT p.*, s.name as supplier_name 
      FROM purchases p 
      LEFT JOIN suppliers s ON p.supplier_id = s.id 
      ORDER BY p.date DESC
    `).all();
    res.json(purchases);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch purchases' });
  }
});

router.post('/purchases', (req: any, res: any) => {
  const { supplier_id, date, invoice_number, total, payment_status, notes, items, initial_payment } = req.body;
  
  try {
    const transaction = db.transaction(() => {
      // 1. Create Purchase
      const purchaseStmt = db.prepare(`
        INSERT INTO purchases (supplier_id, date, invoice_number, total, payment_status, notes, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const purchaseInfo = purchaseStmt.run(supplier_id, date, invoice_number, total, payment_status, notes, req.user.id);
      const purchaseId = purchaseInfo.lastInsertRowid;

      // 2. Add Items & Update Stock & Cost Price
      const itemStmt = db.prepare('INSERT INTO purchase_items (purchase_id, product_id, qty, unit_cost, line_total) VALUES (?, ?, ?, ?, ?)');
      const updateProductStmt = db.prepare('UPDATE products SET current_stock = current_stock + ?, cost_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
      
      for (const item of items) {
        itemStmt.run(purchaseId, item.product_id, item.qty, item.unit_cost, item.line_total);
        updateProductStmt.run(item.qty, item.unit_cost, item.product_id);
      }

      // 3. Add initial payment if partial or paid
      if (initial_payment && initial_payment > 0) {
        const payStmt = db.prepare('INSERT INTO supplier_payments (supplier_id, purchase_id, amount, date, notes) VALUES (?, ?, ?, ?, ?)');
        payStmt.run(supplier_id, purchaseId, initial_payment, date, 'دفعة مع فاتورة الشراء');
      }

      return purchaseId;
    });

    const purchaseId = transaction();
    res.json({ id: purchaseId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to process purchase' });
  }
});

// --- 3. Expenses ---
router.get('/expenses', (req: any, res: any) => {
  try {
    const expenses = db.prepare('SELECT * FROM expenses ORDER BY date DESC').all();
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

router.post('/expenses', (req: any, res: any) => {
  try {
    const { date, category, amount, description } = req.body;
    const stmt = db.prepare('INSERT INTO expenses (date, category, amount, description, user_id) VALUES (?, ?, ?, ?, ?)');
    const info = stmt.run(date, category, amount, description, req.user.id);
    res.json({ id: info.lastInsertRowid });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add expense' });
  }
});

// --- 4. Customers ---
router.get('/customers', (req: any, res: any) => {
  try {
    const search = req.query.search as string;
    let query = 'SELECT * FROM customers';
    let params: any[] = [];
    if (search) {
      query += ' WHERE name LIKE ? OR phone LIKE ?';
      params = [`%${search}%`, `%${search}%`];
    }
    const customers = db.prepare(query).all(...params);
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

router.post('/customers', (req: any, res: any) => {
  try {
    const { name, phone, address, source, notes } = req.body;
    const stmt = db.prepare('INSERT INTO customers (name, phone, address, source, notes) VALUES (?, ?, ?, ?, ?)');
    const info = stmt.run(name, phone, address, source, notes);
    res.json({ id: info.lastInsertRowid });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add customer' });
  }
});

// --- 5. Inventory Counting ---
router.post('/inventory/count', (req: any, res: any) => {
  const { date, adjustments, category_id } = req.body;
  
  try {
    const transaction = db.transaction(() => {
      const updateStmt = db.prepare('UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
      const adjStmt = db.prepare('INSERT INTO inventory_adjustments (product_id, date, expected_qty, actual_qty, difference, reason, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)');
      
      for (const adj of adjustments) {
        if (adj.difference !== 0) {
          updateStmt.run(adj.actual, adj.product_id);
          adjStmt.run(adj.product_id, date, adj.expected, adj.actual, adj.difference, adj.reason || null, req.user.id);
        }
      }
    });

    transaction();
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to process inventory count' });
  }
});

// --- 6. Reports ---
// Financial/profit data is owner-only, same as /api/dashboard/today.
router.get('/reports', requireOwner, (req, res) => {
  const { start, end } = req.query;
  try {
    const sales = db.prepare("SELECT SUM(total) as total_sales FROM sales WHERE date >= ? AND date <= ? AND status = 'completed'").get(start, end) as any;
    
    const profitQuery = db.prepare(`
      SELECT SUM(si.line_total - (si.qty * si.cost_price_at_sale)) as gross_profit 
      FROM sale_items si 
      JOIN sales s ON si.sale_id = s.id 
      WHERE s.date >= ? AND s.date <= ? AND s.status = 'completed'
    `).get(start, end) as any;

    const expenses = db.prepare("SELECT SUM(amount) as total_expenses FROM expenses WHERE date >= ? AND date <= ?").get(start, end) as any;

    const inventoryValue = db.prepare("SELECT SUM(current_stock * cost_price) as value FROM products WHERE is_active = 1 AND current_stock > 0").get() as any;

    const topCustomers = db.prepare(`
      SELECT c.name, c.phone, SUM(s.total) as total_spent
      FROM sales s
      JOIN customers c ON s.customer_id = c.id
      WHERE s.date >= ? AND s.date <= ? AND s.status = 'completed'
      GROUP BY c.id
      ORDER BY total_spent DESC
      LIMIT 5
    `).all(start, end);

    // stagnant products (no sales in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    const stagnantProducts = db.prepare(`
      SELECT p.id, p.name, p.sku, p.current_stock
      FROM products p
      WHERE p.is_active = 1 AND p.current_stock > 0
      AND p.id NOT IN (
        SELECT si.product_id FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE s.date >= ?
      )
    `).all(thirtyDaysAgoStr);

    // Daily trends for charting
    const dailyTrends = db.prepare(`
      SELECT
        s.date,
        SUM(si.line_total) as sales,
        SUM(si.line_total - (si.qty * si.cost_price_at_sale)) as profit
      FROM sales s
      JOIN sale_items si ON s.id = si.sale_id
      WHERE s.date >= ? AND s.date <= ? AND s.status = 'completed'
      GROUP BY s.date
      ORDER BY s.date ASC
    `).all(start, end);

    // Best-selling products by revenue for the period
    const topProducts = db.prepare(`
      SELECT p.id, p.name, p.sku, SUM(si.qty) as qty_sold, SUM(si.line_total) as revenue,
        SUM(si.line_total - (si.qty * si.cost_price_at_sale)) as profit
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      WHERE s.date >= ? AND s.date <= ? AND s.status = 'completed'
      GROUP BY p.id
      ORDER BY revenue DESC
      LIMIT 10
    `).all(start, end);

    // Sales breakdown by payment method
    const salesByPaymentMethod = db.prepare(`
      SELECT payment_method, SUM(total) as total, COUNT(id) as count
      FROM sales
      WHERE date >= ? AND date <= ? AND status = 'completed'
      GROUP BY payment_method
    `).all(start, end);

    res.json({
      totalSales: sales.total_sales || 0,
      grossProfit: profitQuery.gross_profit || 0,
      totalExpenses: expenses.total_expenses || 0,
      netProfit: (profitQuery.gross_profit || 0) - (expenses.total_expenses || 0),
      inventoryValue: inventoryValue.value || 0,
      topCustomers,
      stagnantProducts,
      dailyTrends,
      topProducts,
      salesByPaymentMethod
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

router.get('/export-pdf', requireOwner, async (req, res) => {
  const { start, end } = req.query;
  
  try {
    const sales = db.prepare("SELECT SUM(total) as total_sales FROM sales WHERE date >= ? AND date <= ? AND status = 'completed'").get(start, end) as any;
    const profitQuery = db.prepare(`SELECT SUM(si.line_total - (si.qty * si.cost_price_at_sale)) as gross_profit FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE s.date >= ? AND s.date <= ? AND s.status = 'completed'`).get(start, end) as any;
    const expenses = db.prepare("SELECT SUM(amount) as total_expenses FROM expenses WHERE date >= ? AND date <= ?").get(start, end) as any;
    const inventoryValue = db.prepare("SELECT SUM(current_stock * cost_price) as value FROM products WHERE is_active = 1 AND current_stock > 0").get() as any;

    const totalSales = sales.total_sales || 0;
    const grossProfit = profitQuery.gross_profit || 0;
    const totalExpenses = expenses.total_expenses || 0;
    const netProfit = grossProfit - totalExpenses;
    const invValue = inventoryValue.value || 0;

    const html = `
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #333; }
            h1 { text-align: center; color: #1e3a8a; margin-bottom: 5px; }
            .date-range { text-align: center; color: #6b7280; margin-bottom: 40px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #e5e7eb; padding: 12px; text-align: right; }
            th { background-color: #f9fafb; color: #4b5563; }
            .summary-cards { display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 40px; }
            .card { flex: 1; min-width: 150px; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
            .card h3 { font-size: 14px; color: #6b7280; margin: 0 0 10px 0; font-weight: normal; }
            .card p { font-size: 24px; font-weight: bold; margin: 0; color: #111827; }
            .profit { color: ${netProfit >= 0 ? '#10b981' : '#ef4444'} !important; }
          </style>
        </head>
        <body>
          <h1>مكتبة الحسيني - تقرير الأداء</h1>
          <div class="date-range">الفترة: ${start} إلى ${end}</div>
          
          <div class="summary-cards">
            <div class="card"><h3>إجمالي المبيعات</h3><p>${totalSales} ج.م</p></div>
            <div class="card"><h3>إجمالي المصروفات</h3><p>${totalExpenses} ج.م</p></div>
            <div class="card"><h3>صافي الربح</h3><p class="profit">${netProfit} ج.م</p></div>
            <div class="card"><h3>قيمة المخزون</h3><p>${invValue} ج.م</p></div>
          </div>
        </body>
      </html>
    `;

    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=report_${start}_${end}.pdf`);
    res.send(Buffer.from(pdfBuffer));
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

export default router;
