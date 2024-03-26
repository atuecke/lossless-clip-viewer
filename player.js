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
