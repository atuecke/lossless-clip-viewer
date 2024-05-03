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

ipcMain.on('extract-audio-tracks', (event, { videoPath }) => {
    const tempFolder = path.join(path.dirname(videoPath), 'temp');
    if (fs.existsSync(tempFolder)) {
        fs.rmdirSync(tempFolder, { recursive: true });//remove any current files in the temp folder
    }
    fs.mkdirSync(tempFolder);
    

    // Use ffprobe to determine the number of audio tracks
    const ffprobeCommand = `ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "${videoPath}"`;

    exec(ffprobeCommand, (error, stdout, stderr) => {
        if (error) {
            console.error(`ffprobe error: ${error}`);
            event.sender.send('ffmpeg-error', `ffprobe error: ${error.message}`);
            return;
        }

        // Normalize line endings and split into lines, adjust indices to start from 0
        const audioIndices = stdout.replace(/\r\n|\n|\r/gm, "\n").trim().split('\n').map(index => index - 1).slice(1);

        if (audioIndices.length === 0) {
            console.log('No audio tracks found.');
            event.sender.send('no-audio-tracks-found');
            return;
        }

        // Build the ffmpeg command to extract each audio track
        let ffmpegCommand = `ffmpeg -i "${videoPath}" `;
        audioIndices.forEach((index, i) => {
            ffmpegCommand += `-map 0:a:${index} "${tempFolder}/audio_track_${i + 1}.mp3" `;
        });

        exec(ffmpegCommand, (error, ffmpegStdout, ffmpegStderr) => {
            if (error) {
                console.error(`ffmpeg exec error: ${error}`);
                event.sender.send('ffmpeg-error', error.message);
                return;
            }

            // Send back the path where audio tracks are saved
            event.sender.send('audio-tracks-extracted', tempFolder);
        });
    });
});

ipcMain.on('cleanup-temp-folder', (event, { folderPath }) => {
    fs.rmdirSync(folderPath, { recursive: true }); // Make sure this path is correct and safe to delete!
});