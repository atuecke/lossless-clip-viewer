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
    // Function to generate a unique filename
    function generateUniqueFilename(originalPath) {
        let base = path.basename(originalPath, path.extname(originalPath));
        let counter = 1;
        let uniquePath = originalPath;
        
        // Check if the file exists and generate a new path until it's unique
        while (fs.existsSync(uniquePath)) {
            uniquePath = path.join(path.dirname(originalPath), `${base}-${counter}${path.extname(originalPath)}`);
            counter++;
        }
        return uniquePath;
    }

    // Use the function to ensure the targetPath is unique
    const uniqueTargetPath = generateUniqueFilename(targetPath);

    // Construct your FFmpeg command using the unique path
    const ffmpegCommand = `ffmpeg -ss ${startTime} -i "${videoPath}" -to ${endTime - startTime} -c copy "${uniqueTargetPath}"`;

    // Execute FFmpeg command
    exec(ffmpegCommand, (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            event.sender.send('ffmpeg-error', error.message);
            return;
        }

        // Upon successful FFmpeg processing, move the original video file to the "reviewed" folder
        const reviewedFolderPath = path.join(path.dirname(videoPath), 'reviewed');
        if (!fs.existsSync(reviewedFolderPath)) {
            fs.mkdirSync(reviewedFolderPath);
        }
        const reviewedFilePath = path.join(reviewedFolderPath, path.basename(videoPath));

        fs.rename(videoPath, reviewedFilePath, (err) => {
            if (err) {
                console.error(`Error moving file: ${err}`);
                event.sender.send('file-move-error', err.message);
                return;
            }

            // Notify the renderer process that the video has been moved successfully
            event.sender.send('video-moved', { originalPath: videoPath, newPath: reviewedFilePath });
        });
    });
});

ipcMain.on('get-sub-folders', (event, saveFolderPath) => {
    const subFolders = fs.readdirSync(saveFolderPath, { withFileTypes: true })
                          .filter(dirent => dirent.isDirectory())
                          .map(dirent => dirent.name);
    event.sender.send('sub-folders-response', subFolders);
});

app.whenReady().then(createWindow);

ipcMain.on('mark-video-reviewed', (event, videoPath) => {
    const reviewedFolderPath = path.join(path.dirname(videoPath), 'reviewed');
    if (!fs.existsSync(reviewedFolderPath)) {
        fs.mkdirSync(reviewedFolderPath);
    }
    const reviewedFilePath = path.join(reviewedFolderPath, path.basename(videoPath));

    fs.rename(videoPath, reviewedFilePath, (err) => {
        if (err) {
            console.error(`Error moving file: ${err}`);
            event.sender.send('file-move-error', err.message);
            return;
        }

        // Notify the renderer process that the video has been moved successfully
        event.sender.send('video-moved', { originalPath: videoPath, newPath: reviewedFilePath });
    });
});