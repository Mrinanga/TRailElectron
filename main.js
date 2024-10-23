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
    icon: path.join(app.getAppPath(), 'build', 'favicon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      devTools: true,
    },
  });

  const introHtmlPath = path.join(app.getAppPath(), 'intro.html');
  introWindow.loadFile(introHtmlPath);

  setTimeout(() => {
    introWindow.close();
    createMainWindow();
  }, 3100);
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    icon: path.join(app.getAppPath(), 'build', 'favicon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      devTools: true,
    },
  });

  const mainHtmlPath = path.join(app.getAppPath(), 'build', 'index.html');
  mainWindow.loadFile(mainHtmlPath);

  require('@electron/remote/main').enable(mainWindow.webContents);

  // Open DevTools on startup for debugging
  mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  checkForUpdates();

  globalShortcut.register('CommandOrControl+I', () => {
    if (mainWindow) {
      mainWindow.webContents.openDevTools();
    }
  });
}

function checkForUpdates() {
  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on('update-available', (info) => {
    log.info('Update URL:', info.files[0].url);
    log.info('Update available:', info);
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Available',
      message: 'A new version is available. Downloading now...',
      buttons: ['OK'],
    });
  });
  
  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded:', info);
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: 'A new update has been downloaded. Restart the application to apply the update.',
      buttons: ['Restart', 'Later'],
    }).then(result => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on('error', (error) => {
    log.error('Error in auto-updater:', error);
    dialog.showErrorBox('Update Error', error == null ? 'unknown' : (error.stack || error).toString());
  });
}

app.on('ready', createIntroWindow);
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
