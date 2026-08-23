import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

// Set running in electron environment variable
process.env.RUNNING_IN_ELECTRON = 'true';

// Set the DB_PATH to the user data directory
const userDataPath = app.getPath('userData');
process.env.DB_PATH = path.join(userDataPath, 'database.sqlite');

let mainWindow: BrowserWindow | null = null;
let expressServer: any = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: 'Hosainy Store',
  });

  // Remove the default menu
  mainWindow.setMenu(null);

  // In development, wait for vite server
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, start the express server and load from its port
    try {
      // Require the bundled express server
      const serverModule = require('./server.cjs');
      expressServer = await serverModule.startServer();
      
      // Load the express server URL
      mainWindow.loadURL('http://localhost:3000');
    } catch (err: any) {
      console.error('Failed to start server:', err);
      try {
        fs.writeFileSync(path.join(app.getPath('userData'), 'startup-error.log'), err.stack || err.message || err.toString());
      } catch (e) {}
      mainWindow.loadURL(`data:text/html;charset=utf-8,<html><body style="font-family:sans-serif;padding:20px;"><h1>Server Error</h1><pre style="color:red;white-space:pre-wrap;">${err.stack || err.message || err}</pre></body></html>`);
    }
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (expressServer) {
    expressServer.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
