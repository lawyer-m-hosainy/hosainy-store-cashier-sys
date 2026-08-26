import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import db from '../db/db';

const router = express.Router();

// The packaged desktop app ships with no .env file, so there is no reliable way for the
// user to set JWT_SECRET. Persist a random secret next to the database instead of falling
// back to a hardcoded string (which would let anyone on the network forge tokens).
function loadOrCreateJwtSecret(): string {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;

  const dbDir = process.env.DB_PATH ? path.dirname(process.env.DB_PATH) : process.cwd();
  const secretPath = path.join(dbDir, '.jwt-secret');
  try {
    if (fs.existsSync(secretPath)) {
      return fs.readFileSync(secretPath, 'utf-8').trim();
    }
    const secret = crypto.randomBytes(48).toString('hex');
    fs.mkdirSync(dbDir, { recursive: true });
    fs.writeFileSync(secretPath, secret, { mode: 0o600 });
    return secret;
  } catch (error) {
    console.error('Failed to persist JWT secret; using an ephemeral one (existing sessions will be invalidated on restart):', error);
    return crypto.randomBytes(48).toString('hex');
  }
}

const JWT_SECRET = loadOrCreateJwtSecret();

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

// Simple in-memory login throttle: a handful of attempts per username, with a cooldown.
// Good enough for a single-process local desktop app; resets on restart.
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 60 * 1000;
const loginAttempts = new Map<string, { count: number; firstAttemptAt: number }>();

function isLoginLocked(username: string): boolean {
  const entry = loginAttempts.get(username);
  if (!entry) return false;
  if (Date.now() - entry.firstAttemptAt > LOGIN_LOCKOUT_MS) {
    loginAttempts.delete(username);
    return false;
  }
  return entry.count >= LOGIN_MAX_ATTEMPTS;
}

function recordFailedLogin(username: string) {
  const entry = loginAttempts.get(username);
  if (!entry || Date.now() - entry.firstAttemptAt > LOGIN_LOCKOUT_MS) {
    loginAttempts.set(username, { count: 1, firstAttemptAt: Date.now() });
  } else {
    entry.count += 1;
  }
}

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (isLoginLocked(username)) {
      return res.status(429).json({ error: 'محاولات دخول كثيرة، الرجاء الانتظار قليلاً والمحاولة مرة أخرى' });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username) as any;

    if (!user) {
      recordFailedLogin(username);
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      recordFailedLogin(username);
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    loginAttempts.delete(username);

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

  jwt.verify(token, JWT_SECRET, (err: any, payload: any) => {
    // 401 = "not authenticated, please log in again"; kept distinct from the 403 that
    // requireOwner uses for "authenticated but not allowed", so the client only forces
    // a logout when the session itself is the problem.
    if (err) return res.status(401).json({ error: 'جلسة منتهية' });

    // The token can be valid for up to 7 days — re-check the user is still active and
    // pick up the current role, instead of trusting whatever the token was issued with.
    const user = db.prepare('SELECT id, username, role, name, is_active FROM users WHERE id = ?').get(payload.id) as any;
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'تم إيقاف هذا الحساب' });
    }

    req.user = { id: user.id, username: user.username, role: user.role, name: user.name };
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
    const id = Number(req.params.id);

    if (!is_active) {
      const target = db.prepare('SELECT role FROM users WHERE id = ?').get(id) as any;
      if (target?.role === 'owner') {
        const activeOwners = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'owner' AND is_active = 1").get() as any;
        if (activeOwners.count <= 1) {
          return res.status(400).json({ error: 'لا يمكن تعطيل آخر حساب مدير عام نشط' });
        }
      }
    }

    db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(is_active ? 1 : 0, id);
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
