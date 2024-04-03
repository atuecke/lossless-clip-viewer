const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { exec } = require('child_process');
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

ipcMain.on('open-save-folder-dialog', async (event) => {
    const { filePaths } = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });

    if (filePaths && filePaths[0]) {
        event.sender.send('selected-save-folder', filePaths[0]);
    }
});

ipcMain.on('save-trimmed-clip-with-name', (event, { videoPath, startTime, endTime, targetPath }) => {

    const command = `ffmpeg -ss ${startTime} -i "${videoPath}" -to ${endTime - startTime} -c copy "${targetPath}"`;
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            return;
        }
        console.log(`Trimmed video saved to ${targetPath}`);
    });
});

ipcMain.on('get-sub-folders', (event, saveFolderPath) => {
    const subFolders = fs.readdirSync(saveFolderPath, { withFileTypes: true })
                          .filter(dirent => dirent.isDirectory())
                          .map(dirent => dirent.name);
    event.sender.send('sub-folders-response', subFolders);
});

app.whenReady().then(createWindow);
