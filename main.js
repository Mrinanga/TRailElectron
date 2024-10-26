const { app, BrowserWindow, dialog, globalShortcut } = require('electron');
const path = require('path');
require('@electron/remote/main').initialize();
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

let introWindow;
let mainWindow;

// Enable detailed logging for autoUpdater
log.transports.file.level = 'info'; // Log all info level and above
autoUpdater.logger = log;

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
      devTools: true,
    },
  });

  const introHtmlPath = path.join(app.getAppPath(), 'intro.html');
  introWindow.loadFile(introHtmlPath);

  // Handle intro window errors
  introWindow.webContents.on('crashed', (event) => {
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
    show: false, // Don't show until ready-to-show
    icon: path.join(app.getAppPath(), 'assets', 'icons', 'icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      devTools: true,
    },
  });

  const mainHtmlPath = path.join(app.getAppPath(), 'build', 'index.html');
  mainWindow.loadFile(mainHtmlPath);

  // Enable remote module
  require('@electron/remote/main').enable(mainWindow.webContents);

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Handle window state
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle crashes and unresponsiveness
  mainWindow.webContents.on('crashed', (event) => {
    log.error('Main window crashed:', event);
    dialog.showMessageBox({
      type: 'error',
      title: 'Application Error',
      message: 'The application has crashed. Please restart.',
      buttons: ['OK']
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
      buttons: ['Wait', 'Restart']
    }).then(result => {
      if (result.response === 1) {
        app.relaunch();
        app.exit(0);
      }
    });
  });

  checkForUpdates();

  // Register DevTools shortcut
  globalShortcut.register('CommandOrControl+I', () => {
    if (mainWindow) {
      mainWindow.webContents.openDevTools();
    }
  });
}

function checkForUpdates() {
  log.info('Checking for updates...');
  
  // Configure update checking interval
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  try {
    autoUpdater.checkForUpdatesAndNotify();
  } catch (error) {
    log.error('Error checking for updates:', error);
  }

  autoUpdater.on('checking-for-update', () => {
    log.info('Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    log.info('Update available. Update info:', info);
    log.info('Downloading update from URL:', info.files[0].url);
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Available',
      message: `Version ${info.version} is available. Downloading now...`,
      buttons: ['OK'],
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    log.info('Update not available:', info);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    let message = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}%`;
    log.info(message);
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded. Version:', info.version);
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: 'A new update has been downloaded. Restart the application to apply the update.',
      buttons: ['Restart', 'Later'],
    }).then(result => {
      if (result.response === 0) {
        log.info('User chose to restart and install the update.');
        autoUpdater.quitAndInstall(true, true);
      } else {
        log.info('User chose to install the update later.');
      }
    });
  });

  autoUpdater.on('error', (error) => {
    log.error('Error in auto-updater:', error);
    const errorMessage = error.stack || error.message || error.toString();
    log.error('Full error details:', errorMessage);
    dialog.showErrorBox('Update Error', `Error: ${errorMessage}`);
  });
}

// App event handlers
app.on('ready', () => {
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

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log.error('Uncaught exception:', error);
  dialog.showErrorBox('Error', 'An unexpected error occurred. The application will restart.');
  app.relaunch();
  app.exit(1);
});