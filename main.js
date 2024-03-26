const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false, // For simplicity, though not recommended for production
            enableRemoteModule: true
        }
    });

    mainWindow.loadFile('index.html');
}

ipcMain.on('open-file-dialog', (event) => {
    dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    }).then(result => {
        if (!result.canceled) {
            const folderPath = result.filePaths[0];
            const files = fs.readdirSync(folderPath);
            const videoFiles = files.filter(file => file.endsWith('.mp4') || file.endsWith('.mov')); // Add more formats as needed
            const videoPaths = videoFiles.map(file => path.join(folderPath, file));
        
            if (videoFiles.length > 0) {
                mainWindow.loadFile('player.html').then(() => {
                    // Send the array of video paths
                    mainWindow.webContents.send('play-videos', videoPaths);
                });
            }
        }
    }).catch(err => {
        console.log(err);
    });
});

app.whenReady().then(createWindow);
