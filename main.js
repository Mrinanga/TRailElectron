const { app, BrowserWindow, dialog, globalShortcut } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const path = require('path');
require('@electron/remote/main').initialize();

log.transports.file.level = 'info';
autoUpdater.logger = log;

const UPDATE_SERVER_URL = 'http://localhost/updates';
autoUpdater.setFeedURL({
    provider: 'generic',
    url: `${UPDATE_SERVER_URL}/`
});

let introWindow;
let mainWindow;

function createIntroWindow() {
    introWindow = new BrowserWindow({
        width: 600,
        height: 380,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        icon: path.join(__dirname, 'assets', 'icons', 'icon.ico'),
        webPreferences: { nodeIntegration: true, contextIsolation: false }
    });

    introWindow.loadFile(path.join(__dirname, 'intro.html'));

    introWindow.on('closed', () => (introWindow = null));

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
        icon: path.join(__dirname, 'assets', 'icons', 'icon.ico'),
        webPreferences: { nodeIntegration: true, contextIsolation: false }
    });

    mainWindow.loadFile(path.join(__dirname, 'build', 'index.html'));

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        checkForUpdates();
    });

    mainWindow.on('closed', () => (mainWindow = null));

    globalShortcut.register('CommandOrControl+I', () => {
        if (mainWindow) mainWindow.webContents.openDevTools();
    });
}

function checkForUpdates() {
    autoUpdater.checkForUpdatesAndNotify();
}

autoUpdater.on('update-available', (info) => {
    log.info(`Update available: v${info.version}`);
    dialog.showMessageBox({
        type: 'info',
        title: 'Update Available',
        message: `A new version (${info.version}) is available. It will be downloaded in the background.`,
        buttons: ['OK']
    });
});

autoUpdater.on('update-downloaded', (info) => {
    log.info(`Update downloaded: v${info.version}`);
    dialog.showMessageBox({
        type: 'info',
        title: 'Update Ready',
        message: 'The update has been downloaded. The application will restart now to apply the update.',
        buttons: ['Restart Now']
    }).then(() => {
        autoUpdater.quitAndInstall(false, true);
    });
});

autoUpdater.on('error', (error) => {
    log.error('Update error:', error);
    dialog.showErrorBox('Update Error', error.message || 'An error occurred while checking for updates.');
});

app.whenReady().then(createIntroWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (mainWindow === null) createMainWindow(); });
app.on('will-quit', () => { globalShortcut.unregisterAll(); });

process.on('uncaughtException', (error) => {
    log.error('Uncaught Exception:', error);
    dialog.showErrorBox('Unexpected Error', `An unexpected error occurred: ${error.message}`);
    app.exit(1);
});
