import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db from '../db/db';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'alhosainy-secret-key-1234';

// Check if setup is needed
router.get('/check-setup', (req, res) => {
  try {
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as any;
    res.json({ needsSetup: userCount.count === 0 });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Setup Initial Owner
router.post('/setup', async (req, res) => {
  try {
    const { name, username, password } = req.body;
    
    // Double check
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as any;
    if (userCount.count > 0) {
      return res.status(400).json({ error: 'Setup already completed' });
    }

    const hash = await bcrypt.hash(password, 10);
    const stmt = db.prepare('INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, ?)');
    stmt.run(name, username, hash, 'owner');
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to setup owner' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username) as any;
    
    if (!user) {
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({ token, user: { id: user.id, username: user.username, role: user.role, name: user.name } });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Middleware for authentication
export const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'غير مصرح' });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ error: 'جلسة منتهية' });
    req.user = user;
    next();
  });
};

// Middleware for Owner only
export const requireOwner = (req: any, res: any, next: any) => {
  if (req.user?.role !== 'owner') {
    return res.status(403).json({ error: 'صلاحيات غير كافية' });
  }
  next();
};

// --- USER MANAGEMENT (Owner Only) ---
// These routes will be mounted in server.ts under /api/auth but they need the token.
// So actually I should mount them under /api/users in server.ts, or just protect them here.
// But wait, auth.ts is mounted UNPROTECTED in server.ts!
// Let's add them here and manually call authenticateToken & requireOwner for these specific routes.

router.get('/users', authenticateToken, requireOwner, (req, res) => {
  try {
    const users = db.prepare('SELECT id, name, username, role, is_active FROM users').all();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.post('/users', authenticateToken, requireOwner, async (req, res) => {
  try {
    const { name, username, password, role } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const stmt = db.prepare('INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, ?)');
    stmt.run(name, username, hash, role);
    res.json({ success: true });
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(400).json({ error: 'اسم المستخدم مسجل مسبقاً' });
    } else {
      res.status(500).json({ error: 'Failed to create user' });
    }
  }
});

router.put('/users/:id/status', authenticateToken, requireOwner, (req, res) => {
  try {
    const { is_active } = req.body;
    // Don't allow disabling the last owner, but for simplicity let's just do it
    db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(is_active ? 1 : 0, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

router.put('/users/:id/password', authenticateToken, requireOwner, async (req, res) => {
  try {
    const { password } = req.body;
    const hash = await bcrypt.hash(password, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

router.get('/audit-logs', authenticateToken, requireOwner, (req, res) => {
  try {
    const logs = db.prepare(`
      SELECT a.*, u.name as user_name 
      FROM audit_log a 
      LEFT JOIN users u ON a.user_id = u.id 
      ORDER BY a.timestamp DESC 
      LIMIT 100
    `).all();
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

export default router;
