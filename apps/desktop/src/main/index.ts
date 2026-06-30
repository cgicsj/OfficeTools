import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import './env-setup';
import { APP_CONFIG } from '../shared/constants/config';
import { registerIpcHandlers } from './ipc';

const currentDirectory = __dirname;

const createMainWindow = (): BrowserWindow => {
  const mainWindow = new BrowserWindow({
    width: APP_CONFIG.WINDOW.DEFAULT_WIDTH,
    height: APP_CONFIG.WINDOW.DEFAULT_HEIGHT,
    minWidth: APP_CONFIG.WINDOW.MIN_WIDTH,
    minHeight: APP_CONFIG.WINDOW.MIN_HEIGHT,
    title: APP_CONFIG.PRODUCT_NAME,
    webPreferences: {
      preload: path.join(currentDirectory, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(
      path.join(currentDirectory, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  return mainWindow;
};

const startApplication = (): void => {
  registerIpcHandlers();
  createMainWindow();
};

void app.whenReady().then(startApplication);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

