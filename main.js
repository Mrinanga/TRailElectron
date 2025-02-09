const { app, BrowserWindow, dialog, globalShortcut } = require('electron');
const path = require('path');
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
require('@electron/remote/main').initialize();

let introWindow;
let mainWindow;

// Configure logging for auto-updater
log.transports.file.level = 'info';
autoUpdater.logger = log;

// Function to fetch the GitHub token from the server
async function fetchGitHubToken() {
  try {
    const response = await fetch('http://localhost/backend/get_github_token.php');
    const data = await response.json();
    if (data.token) {
      return data.token;
    } else {
      log.warn('GitHub token not found in the database.');
      return null;
    }
  } catch (error) {
    log.error('Failed to fetch GitHub token:', error);
    return null;
  }
}

// Set the GitHub token for auto-updater
async function setGitHubToken() {
  const token = await fetchGitHubToken();
  if (token) {
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'Mrinanga',
      repo: 'TRailElectron',
      token: token,
    });
  } else {
    log.warn('GitHub token not found. Auto-updates may not work.');
  }
}

function createIntroWindow() {
  introWindow = new BrowserWindow({
    width: 600,
    height: 380,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    icon: path.join(app.getAppPath(), 'assets', 'icons', 'icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    },
  });

  introWindow.loadFile(path.join(app.getAppPath(), 'intro.html'));

  introWindow.on('crashed', (event) => {
    log.error('Intro window crashed:', event);
  });

  introWindow.on('unresponsive', () => {
    log.error('Intro window became unresponsive');
  });

  setTimeout(() => {
    if (introWindow) {
      introWindow.close();
      createMainWindow();
    }
  }, 3100);
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    icon: path.join(app.getAppPath(), 'assets', 'icons', 'icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    },
  });

  mainWindow.loadFile(path.join(app.getAppPath(), 'build', 'index.html'));

  require('@electron/remote/main').enable(mainWindow.webContents);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.on('crashed', (event) => {
    log.error('Main window crashed:', event);
    dialog.showMessageBox({
      type: 'error',
      title: 'Application Error',
      message: 'The application has crashed. Please restart.',
      buttons: ['OK'],
    }).then(() => {
      app.relaunch();
      app.exit(0);
    });
  });

  mainWindow.on('unresponsive', () => {
    log.error('Main window became unresponsive');
    dialog.showMessageBox({
      type: 'warning',
      title: 'Application Not Responding',
      message: 'The application is not responding. Wait or restart?',
      buttons: ['Wait', 'Restart'],
    }).then((result) => {
      if (result.response === 1) {
        app.relaunch();
        app.exit(0);
      }
    });
  });

  checkForUpdates();

  globalShortcut.register('CommandOrControl+I', () => {
    if (mainWindow) {
      mainWindow.webContents.openDevTools();
    }
  });
}

function checkForUpdates() {
  log.info('Checking for updates...');
  console.log('Checking for updates...');

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on('update-available', (info) => {
    log.info('Update available:', info);
    console.log('Update available:', info);
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Available',
      message: `A new version (${info.version}) is available. Downloading in the background.`,
      buttons: ['OK'],
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded:', info);
    console.log('Update downloaded:', info);
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: 'The update has been downloaded. Restart now to apply the update.',
      buttons: ['Restart Now'],
    }).then(() => {
      autoUpdater.quitAndInstall();
    });
  });

  autoUpdater.on('error', (error) => {
    log.error('Update error:', error);
    console.log('Update error:', error);
    dialog.showErrorBox('Update Error', `Failed to update: ${error.message}`);
  });
}

// App event handlers
app.on('ready', async () => {
  await setGitHubToken();
  createIntroWindow();

  // Check for updates every hour
  setInterval(() => {
    checkForUpdates();
  }, 60 * 60 * 1000);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createMainWindow();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

process.on('uncaughtException', (error) => {
  log.error('Uncaught exception:', error);
  console.log('Uncaught exception:', error);
  dialog.showErrorBox('Error', 'An unexpected error occurred. The application will restart.');
  app.relaunch();
  app.exit(1);
});