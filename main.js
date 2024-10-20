const { app, BrowserWindow, dialog, autoUpdater } = require('electron');
const path = require('path');
const https = require('https');
require('@electron/remote/main').initialize();

let introWindow;
let mainWindow;

const server = 'https://drive.google.com/uc?export=download&id=';
const versionFileId = '1avPXqdukZf2UQX8EpWBER_uyXpivdH7Y';  // Replace with the Google Drive file ID for latest.json

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
    },
  });

  const mainHtmlPath = path.join(app.getAppPath(), 'build', 'index.html');
  mainWindow.loadFile(mainHtmlPath);

  require('@electron/remote/main').enable(mainWindow.webContents);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  checkForUpdates();  // Add this to check for updates after main window loads
}

// Function to check for updates using Google Drive
function checkForUpdates() {
  const versionUrl = `${server}${versionFileId}`;  // URL to get the latest version info from Google Drive

  https.get(versionUrl, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      const latestVersion = JSON.parse(data).version;
      const currentVersion = app.getVersion();

      if (latestVersion !== currentVersion) {
        const updateUrl = JSON.parse(data).downloadUrl;
        downloadUpdate(updateUrl);
      } else {
        console.log('App is up to date.');
      }
    });
  }).on('error', (err) => {
    console.error('Error fetching version info:', err);
  });
}

function downloadUpdate(updateUrl) {
  const file = path.join(app.getPath('userData'), 'update.zip');
  const fileStream = require('fs').createWriteStream(file);

  https.get(updateUrl, (response) => {
    response.pipe(fileStream);

    fileStream.on('finish', () => {
      dialog.showMessageBox({
        type: 'info',
        buttons: ['Restart now', 'Later'],
        defaultId: 0,
        message: 'A new update has been downloaded. Restart the application to install it.',
      }).then(result => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
    });
  }).on('error', (err) => {
    console.error('Error downloading update:', err);
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
