export const schema = `
-- الفئات
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  parent_id INTEGER NULL REFERENCES categories(id)
);

-- المنتجات
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category_id INTEGER REFERENCES categories(id),
  unit TEXT,
  cost_price REAL NOT NULL,
  sell_price REAL NOT NULL,
  current_stock INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER DEFAULT 5,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- العملاء
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  phone TEXT,
  address TEXT,
  source TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- الموردين
CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  notes TEXT
);

-- المستخدمين
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  is_active BOOLEAN DEFAULT 1
);

-- جلسات الخزينة (تقفيلة يومية)
CREATE TABLE IF NOT EXISTS cash_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  opening_balance REAL NOT NULL,
  closing_balance_expected REAL,
  closing_balance_actual REAL,
  difference REAL,
  opened_by INTEGER REFERENCES users(id),
  closed_by INTEGER REFERENCES users(id),
  opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  closed_at DATETIME,
  status TEXT DEFAULT 'open'
);

-- المبيعات
CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_number TEXT UNIQUE,
  type TEXT NOT NULL,
  date TEXT NOT NULL,
  customer_id INTEGER REFERENCES customers(id),
  payment_method TEXT,
  subtotal REAL,
  discount REAL DEFAULT 0,
  delivery_fee REAL DEFAULT 0,
  total REAL NOT NULL,
  cash_session_id INTEGER REFERENCES cash_sessions(id),
  user_id INTEGER REFERENCES users(id),
  status TEXT DEFAULT 'completed',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- تفاصيل عناصر البيع
CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER REFERENCES sales(id),
  product_id INTEGER REFERENCES products(id),
  qty INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  cost_price_at_sale REAL NOT NULL,
  line_total REAL NOT NULL
);

-- المشتريات
CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER REFERENCES suppliers(id),
  date TEXT NOT NULL,
  invoice_number TEXT,
  total REAL NOT NULL,
  payment_status TEXT DEFAULT 'paid',
  user_id INTEGER REFERENCES users(id),
  notes TEXT
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER REFERENCES purchases(id),
  product_id INTEGER REFERENCES products(id),
  qty INTEGER NOT NULL,
  unit_cost REAL NOT NULL,
  line_total REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS supplier_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  purchase_id INTEGER REFERENCES purchases(id) NULL,
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  notes TEXT
);

-- المصروفات
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  category TEXT,
  amount REAL NOT NULL,
  description TEXT,
  user_id INTEGER REFERENCES users(id)
);

-- تعديلات الجرد
CREATE TABLE IF NOT EXISTS inventory_adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER REFERENCES products(id),
  date TEXT NOT NULL,
  expected_qty INTEGER,
  actual_qty INTEGER,
  difference INTEGER,
  reason TEXT,
  user_id INTEGER REFERENCES users(id),
  notes TEXT
);

-- سجل تدقيق
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  action TEXT,
  table_name TEXT,
  record_id INTEGER,
  old_value TEXT,
  new_value TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- الإعدادات (Telegram, Email, etc.)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- سجل التقارير (لتدارك إرسال التقارير التلقائية)
CREATE TABLE IF NOT EXISTS report_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_type TEXT NOT NULL,
  report_date TEXT NOT NULL,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- الفهارس
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(date);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_sales_cash_session_id ON sales(cash_session_id);
`;
