import express from 'express';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import QRCode from 'qrcode';
import { Client, LocalAuth } from 'whatsapp-web.js';
import { authenticateToken, requireOwner } from './auth';
import db from '../db/db';

const router = express.Router();

type WhatsAppStatus = 'idle' | 'initializing' | 'qr' | 'authenticated' | 'ready' | 'auth_failure' | 'disconnected';

let client: Client | null = null;
let status: WhatsAppStatus = 'idle';
let qrDataUrl: string | null = null;
let connectedNumber: string | null = null;
let lastError: string | null = null;

function sessionDataPath() {
  const dbDir = process.env.DB_PATH ? path.dirname(process.env.DB_PATH) : process.cwd();
  return path.join(dbDir, 'whatsapp-session');
}

export function hasExistingWhatsAppSession(): boolean {
  try {
    const dir = sessionDataPath();
    return fs.existsSync(dir) && fs.readdirSync(dir).length > 0;
  } catch {
    return false;
  }
}

export async function initWhatsAppClient(): Promise<void> {
  if (client || status === 'initializing') return;
  status = 'initializing';
  lastError = null;

  try {
    const execPath = await puppeteer.executablePath();
    const newClient = new Client({
      authStrategy: new LocalAuth({ dataPath: sessionDataPath() }),
      puppeteer: {
        executablePath: execPath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
    });

    newClient.on('qr', async (qr: string) => {
      status = 'qr';
      try {
        qrDataUrl = await QRCode.toDataURL(qr);
      } catch (error) {
        console.error('Failed to render WhatsApp QR code:', error);
      }
    });

    newClient.on('authenticated', () => {
      status = 'authenticated';
      qrDataUrl = null;
    });

    newClient.on('ready', () => {
      status = 'ready';
      qrDataUrl = null;
      connectedNumber = (newClient.info as any)?.wid?.user || null;
    });

    newClient.on('auth_failure', (msg: string) => {
      status = 'auth_failure';
      lastError = msg;
    });

    newClient.on('disconnected', () => {
      status = 'disconnected';
      connectedNumber = null;
      client = null;
    });

    client = newClient;
    await newClient.initialize();
  } catch (error: any) {
    console.error('WhatsApp client failed to initialize:', error);
    status = 'auth_failure';
    lastError = error?.message || String(error);
    client = null;
  }
}

export async function sendWhatsAppMessage(number: string, message: string): Promise<boolean> {
  if (!client || status !== 'ready') return false;
  const digits = String(number).replace(/[^0-9]/g, '');
  if (!digits) return false;
  try {
    await client.sendMessage(`${digits}@c.us`, message);
    return true;
  } catch (error) {
    console.error('WhatsApp send failed:', error);
    return false;
  }
}

/** Reconnect automatically at server startup if a previously-linked session exists. */
export function tryAutoReconnectWhatsApp() {
  if (hasExistingWhatsAppSession()) {
    initWhatsAppClient().catch(() => {});
  }
}

router.get('/status', authenticateToken, requireOwner, (req: any, res: any) => {
  res.json({ status, qr: qrDataUrl, number: connectedNumber, error: lastError });
});

router.post('/connect', authenticateToken, requireOwner, (req: any, res: any) => {
  if (status === 'ready') {
    return res.json({ success: true, status });
  }
  initWhatsAppClient().catch(() => {});
  res.json({ success: true, status });
});

router.post('/logout', authenticateToken, requireOwner, async (req: any, res: any) => {
  try {
    if (client) {
      await client.logout().catch(() => {});
      await client.destroy().catch(() => {});
    }
    client = null;
    status = 'idle';
    qrDataUrl = null;
    connectedNumber = null;
    lastError = null;
    // Clear the persisted session so a stale login can't linger.
    try {
      fs.rmSync(sessionDataPath(), { recursive: true, force: true });
    } catch (e) {
      console.error('Failed to remove WhatsApp session directory:', e);
    }
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'فشل قطع الاتصال' });
  }
});

router.post('/test', authenticateToken, requireOwner, async (req: any, res: any) => {
  try {
    const settings = db.prepare('SELECT * FROM settings').all() as any[];
    const config = settings.reduce((acc: any, curr: any) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});

    if (!config.whatsapp_number) {
      return res.status(400).json({ error: 'أدخل رقم الواتساب في الإعدادات أولاً' });
    }
    if (status !== 'ready') {
      return res.status(400).json({ error: 'الواتساب غير متصل بعد' });
    }

    const ok = await sendWhatsAppMessage(config.whatsapp_number, '✅ هذه رسالة تجريبية من برنامج Hosainy Store.');
    if (ok) {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'فشل إرسال الرسالة' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'فشل إرسال الرسالة' });
  }
});

export default router;
