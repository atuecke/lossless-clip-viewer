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

ipcMain.on('save-trimmed-clip', (event, { videoPath, startTime, endTime }) => {
    const outputPath = path.join(path.dirname(videoPath), 'trimmed');
    if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath);
    }
    const outputFileName = path.join(outputPath, `trimmed-${Date.now()}.mp4`);

    const command = `ffmpeg -ss ${startTime} -i "${videoPath}" -to ${endTime - startTime} -c copy "${outputFileName}"`;
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            return;
        }
        console.log(`Trimmed video saved to ${outputFileName}`);
    });
});

app.whenReady().then(createWindow);
