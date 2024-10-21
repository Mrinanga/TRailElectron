const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
require('@electron/remote/main').initialize();

let introWindow;
let mainWindow;

const server = 'https://drive.google.com/uc?export=download&id=';
const versionFileId = '1avPXqdukZf2UQX8EpWBER_uyXpivdH7Y';  // Replace with your Google Drive latest.json ID

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
  const fileStream = fs.createWriteStream(file);

  https.get(updateUrl, (response) => {
      // Check if response is a redirect
      if (response.statusCode === 302) {
          const redirectUrl = response.headers.location; // Get the new URL
          // Perform a new GET request to the redirected URL
          https.get(redirectUrl, (redirectResponse) => {
              if (redirectResponse.statusCode === 200) {
                  redirectResponse.pipe(fileStream);
                  fileStream.on('finish', () => {
                      fileStream.close();
                      verifyDownloadedFile(file);
                  });
              } else {
                  console.error(`Failed to download update from redirect, status code: ${redirectResponse.statusCode}`);
              }
          }).on('error', (err) => {
              console.error('Error downloading update from redirect:', err);
          });
      } else if (response.statusCode === 200) {
          // Handle normal response
          response.pipe(fileStream);
          fileStream.on('finish', () => {
              fileStream.close();
              verifyDownloadedFile(file);
          });
      } else {
          console.error(`Failed to download update, status code: ${response.statusCode}`);
      }
  }).on('error', (err) => {
      console.error('Error downloading update:', err);
  });
}

function verifyDownloadedFile(filePath) {
  fs.stat(filePath, (err, stats) => {
    if (err) {
      console.error('Error checking file stats:', err);
      return;
    }

    if (stats.size === 0) {
      console.error('Downloaded file is empty.');
      return;
    }

    if (!isZipFile(filePath)) {
      console.error('Downloaded file is not a valid ZIP file.');
      return;
    }

    dialog.showMessageBox({
      type: 'info',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      message: 'A new update has been downloaded. Restart the application to install it.',
    }).then(result => {
      if (result.response === 0) {
        installAndRestart(filePath);
      }
    });
  });
}

// Function to check if the downloaded file is a valid ZIP
function isZipFile(filePath) {
  const buffer = Buffer.alloc(4);
  const fd = fs.openSync(filePath, 'r');
  fs.readSync(fd, buffer, 0, 4, 0);
  fs.closeSync(fd);
  // Check the ZIP file signature
  return buffer.toString('hex') === '504b0304'; // ZIP file signature
}

// Function to handle installation and restart
function installAndRestart(zipFile) {
  const unzipper = require('unzipper'); // Assuming you use unzipper package to extract the update
  const extractPath = path.join(app.getAppPath(), '..'); // Extract to app root

  fs.createReadStream(zipFile)
    .pipe(unzipper.Extract({ path: extractPath }))
    .on('close', () => {
      console.log('Update installed. Restarting app...');
      app.relaunch();
      app.exit();
    })
    .on('error', (err) => {
      console.error('Error during update extraction:', err);
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
