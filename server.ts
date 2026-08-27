import express from 'express';
import path from 'path';

import { createApp } from './src/expressApp';
import { initCronJobs } from './src/api/reports';
import { tryAutoReconnectWhatsApp } from './src/api/whatsapp';

export async function startServer() {
  const app = await createApp();
  const PORT = 3000;

  // Initialize Cron Jobs for Auto Reporting
  initCronJobs();

  // Reconnect WhatsApp automatically if a session was already linked
  tryAutoReconnectWhatsApp();

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

  // This is a single-machine desktop app backed by a local SQLite file — the API
  // has no business being reachable from other devices on the network.
  const server = app.listen(PORT, '127.0.0.1', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  return server;
}

if (process.env.RUNNING_IN_ELECTRON !== 'true') {
  startServer();
}
