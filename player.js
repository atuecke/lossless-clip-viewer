const { ipcRenderer } = require('electron');

let videoPaths = [];
let currentIndex = 0;

ipcRenderer.on('play-videos', (event, paths) => {
    videoPaths = paths;
    playVideoAtIndex(currentIndex);
});

document.getElementById('prevVideo').addEventListener('click', () => {
    if (currentIndex > 0) {
        currentIndex--;
        playVideoAtIndex(currentIndex);
    }
});

document.getElementById('nextVideo').addEventListener('click', () => {
    if (currentIndex < videoPaths.length - 1) {
        currentIndex++;
        playVideoAtIndex(currentIndex);
    }
});

function playVideoAtIndex(index) {
    const videoPlayer = document.getElementById('videoPlayer');
    videoPlayer.src = videoPaths[index];
    videoPlayer.play();
}

document.getElementById('leftTrim').addEventListener('click', () => {
    leftTrimTime = document.getElementById('videoPlayer').currentTime;
    document.getElementById('leftTrimTime').textContent = formatTime(leftTrimTime);
});

document.getElementById('rightTrim').addEventListener('click', () => {
    rightTrimTime = document.getElementById('videoPlayer').currentTime;
    document.getElementById('rightTrimTime').textContent = formatTime(rightTrimTime);
});

document.getElementById('saveClip').addEventListener('click', () => {
    if (rightTrimTime <= leftTrimTime) {
        alert('Invalid trim times. Make sure the right trim is after the left trim.');
        return;
    }
    ipcRenderer.send('save-trimmed-clip', {
        videoPath: videoPaths[currentIndex],
        startTime: leftTrimTime,
        endTime: rightTrimTime
    });
});

function formatTime(seconds) {
    const date = new Date(0);
    date.setSeconds(seconds);
    return date.toISOString().substr(11, 8);
}