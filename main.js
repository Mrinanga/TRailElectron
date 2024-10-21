const https = require('https');
const { app, BrowserWindow, dialog, autoUpdater } = require('electron');
const path = require('path');
require('@electron/remote/main').initialize();

let introWindow;
let mainWindow;

const server = 'https://drive.google.com/uc?export=download&id=';
const versionFileId = '1avPXqdukZf2UQX8EpWBER_uyXpivdH7Y'; // Replace with the Google Drive file ID for latest.json

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

  checkForUpdates();
}

// Function to check for updates using Google Drive
function checkForUpdates() {
  const versionUrl = `${server}${versionFileId}`;

  https.get(versionUrl, (res) => {
    if (res.statusCode === 303 && res.headers.location) {
      // Follow the redirection to the new URL
      const redirectedUrl = res.headers.location;
      https.get(redirectedUrl, (redirectRes) => {
        let data = '';
        redirectRes.on('data', (chunk) => {
          data += chunk;
        });

        redirectRes.on('end', () => {
          try {
            console.log('Received data:', data);
            const jsonData = JSON.parse(data.trim());

            const latestVersion = jsonData.version;
            const currentVersion = app.getVersion();

            if (latestVersion !== currentVersion) {
              const updateUrl = jsonData.downloadUrl;
              downloadUpdate(updateUrl);
            } else {
              console.log('App is up to date.');
            }
          } catch (error) {
            console.error('Error parsing version info:', error);
            console.log('Raw data received:', data);
          }
        });
      }).on('error', (err) => {
        console.error('Error fetching redirected version info:', err);
      });
    } else {
      console.error('Unexpected status code:', res.statusCode);
    }
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
