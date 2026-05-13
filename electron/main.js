'use strict';

const { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');

const PORT = 7777;
let mainWindow = null;
let serverProcess = null;
let tray = null;
let serverStatus = 'starting';

// ─── Paths ────────────────────────────────────────────────────────────────────

function getBridgePath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'bridge.cjs')
    : path.join(__dirname, '..', 'dist', 'bridge.cjs');
}

function getConfigPath() {
  return app.isPackaged
    ? path.join(app.getPath('userData'), 'config.json')
    : path.join(__dirname, '..', 'config.json');
}

// ─── Network interfaces ───────────────────────────────────────────────────────

function getInterfaces() {
  const result = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        result.push({ name, address: addr.address });
      }
    }
  }
  // Always show localhost so the operator can open locally
  result.push({ name: 'localhost', address: '127.0.0.1' });
  return result;
}

// ─── Tray icon ────────────────────────────────────────────────────────────────

function makeTrayIcon() {
  // PNG is the most reliable format for tray icons across platforms
  const file = process.platform === 'win32' ? 'icon.ico' : 'tray.png';
  return nativeImage.createFromPath(path.join(__dirname, 'assets', file));
}

// ─── Server ───────────────────────────────────────────────────────────────────

function ensureConfigExists() {
  const dest = getConfigPath();
  if (fs.existsSync(dest)) return;
  try {
    fs.writeFileSync(dest, JSON.stringify(
      { atemIp: '', atemAutoReconnect: true, atemFavorites: [], cameras: [] }, null, 2
    ));
  } catch (e) {
    console.error('[SAB] ensureConfigExists failed:', e.message);
  }
}

function setStatus(status) {
  serverStatus = status;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('server-status', {
      status,
      interfaces: getInterfaces(),
      port: PORT,
    });
  }
}

function pollServer(attempt = 0) {
  if (serverStatus === 'running' || serverStatus === 'quitting') return;
  const req = http.get(`http://127.0.0.1:${PORT}/api/status`, (res) => {
    res.resume();
    if (res.statusCode < 500) setStatus('running');
    else setTimeout(() => pollServer(attempt + 1), 1000);
  });
  req.setTimeout(800, () => req.destroy());
  req.on('error', () => setTimeout(() => pollServer(attempt + 1), 1000));
}

function startServer() {
  ensureConfigExists();

  const bridgePath = getBridgePath();
  if (!fs.existsSync(bridgePath)) {
    console.error('[SAB] bridge.cjs not found at', bridgePath);
    console.error('[SAB] Run: npm run build && npm run build:ui');
    setStatus('error');
    return;
  }

  serverProcess = spawn(process.execPath, [bridgePath], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      SAB_CONFIG_PATH: getConfigPath(),
    },
    // packaged: argv[1] = resourcesPath/bridge.cjs, public/ found there; userData is writable for logs
    // dev:      public/ is at project root — set cwd so the fallback in server.ts resolves it
    cwd: app.isPackaged ? app.getPath('userData') : path.join(__dirname, '..'),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProcess.stdout.on('data', (data) => {
    const text = data.toString().trim();
    if (text) console.log('[Bridge]', text);
    if (text.includes('SAB ready')) setStatus('running');
  });

  serverProcess.stderr.on('data', (data) => {
    const text = data.toString().trim();
    if (text) console.error('[Bridge]', text);
  });

  serverProcess.on('exit', (code, signal) => {
    console.log(`[Bridge] exited code=${code} signal=${signal}`);
    if (serverStatus !== 'quitting') setStatus('error');
  });

  pollServer();
}

// ─── Window ───────────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 360,
    height: process.platform === 'darwin' ? 310 : 330,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    title: 'SAB',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: !app.isPackaged,
    },
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, 'launcher.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Closing hides to tray
  mainWindow.on('close', (e) => {
    e.preventDefault();
    mainWindow.hide();
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

function createTray() {
  tray = new Tray(makeTrayIcon());
  tray.setToolTip('SAB — Sony ATEM Bridge');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show SAB', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { type: 'separator' },
    { label: 'Quit SAB', click: quitApp },
  ]));
  tray.on('click', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) mainWindow.focus();
    else mainWindow.show();
  });
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus(); });
}

function quitApp() {
  serverStatus = 'quitting';
  if (serverProcess) { serverProcess.kill(); serverProcess = null; }
  if (tray) { tray.destroy(); tray = null; }
  app.exit(0);
}

// ─── IPC ──────────────────────────────────────────────────────────────────────

ipcMain.handle('get-status',      () => ({ status: serverStatus, interfaces: getInterfaces(), port: PORT }));
ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.on('open-url', (_, url)   => { shell.openExternal(url); });
ipcMain.on('hide',                () => mainWindow?.hide());
ipcMain.on('quit',                quitApp);

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  // Menu-bar utility: no dock icon on macOS
  if (process.platform === 'darwin') app.dock.hide();

  createWindow();
  createTray();
  startServer();

  // Cmd+Tab / dock click → show window
  app.on('activate', () => { mainWindow?.show(); });
});

app.on('window-all-closed', () => {});

app.on('before-quit', () => {
  serverStatus = 'quitting';
  if (serverProcess) serverProcess.kill();
});
