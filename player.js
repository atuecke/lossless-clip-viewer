const { ipcRenderer } = require('electron');

let videoPaths = [];
let currentIndex = 0;
let leftTrimTime = 0;
let rightTrimTime = 0;

const videoPlayer = document.getElementById('videoPlayer');
const leftMarker = document.getElementById('leftMarker');
const rightMarker = document.getElementById('rightMarker');
const sliderTrack = document.getElementById('sliderTrack');

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
    leftTrimTime = 0;
    rightTrimTime = videoPlayer.duration;
}

videoPlayer.onloadedmetadata = () => {
    // Ensure rightTrimTime is the video's duration initially
    rightTrimTime = videoPlayer.duration;
    updateMarkerPositions();
};

document.getElementById('leftTrim').addEventListener('click', () => {
    leftTrimTime = videoPlayer.currentTime;
    updateMarkerPositions();
});

document.getElementById('rightTrim').addEventListener('click', () => {
    rightTrimTime = videoPlayer.currentTime;
    updateMarkerPositions();
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

function updateMarkerPositions() {
    const duration = videoPlayer.duration || 1; // Avoid division by zero
    const sliderWidth = document.getElementById('trimSlider').offsetWidth;
    
    const leftPosition = (leftTrimTime / duration) * sliderWidth;
    const rightPosition = sliderWidth - ((duration - rightTrimTime) / duration) * sliderWidth;

    leftMarker.style.left = `${leftPosition}px`;
    rightMarker.style.right = `${sliderWidth - rightPosition}px`;
    sliderTrack.style.left = `${leftPosition}px`;
    sliderTrack.style.right = `${sliderWidth - rightPosition}px`;

    document.getElementById('leftTrimTime').textContent = formatTime(leftTrimTime);
    document.getElementById('rightTrimTime').textContent = formatTime(rightTrimTime);
}

function formatTime(seconds) {
    const date = new Date(0);
    date.setSeconds(seconds);
    return date.toISOString().substr(11, 8);
}

// Drag functionality for markers
let isDraggingLeft = false;
let isDraggingRight = false;

leftMarker.addEventListener('mousedown', () => { isDraggingLeft = true; });
rightMarker.addEventListener('mousedown', () => { isDraggingRight = true; });

document.addEventListener('mouseup', () => {
    if (isDraggingLeft || isDraggingRight) {
        isDraggingLeft = false;
        isDraggingRight = false;
        // Update trim times based on final marker positions
        const sliderRect = document.getElementById('trimSlider').getBoundingClientRect();
        const duration = videoPlayer.duration;
        leftTrimTime = ((parseInt(leftMarker.style.left, 10) / sliderRect.width) * duration);
        rightTrimTime = ((sliderRect.width - parseInt(rightMarker.style.right, 10)) / sliderRect.width) * duration;
    }
});

document.addEventListener('mousemove', (e) => {
    if (!isDraggingLeft && !isDraggingRight) return;
    const sliderRect = document.getElementById('trimSlider').getBoundingClientRect();
    const duration = videoPlayer.duration;
    if (isDraggingLeft) {
        let newPosition = e.clientX - sliderRect.left;
        if (newPosition < 0) newPosition = 0;
        if (newPosition > sliderRect.width - parseInt(rightMarker.style.right)) newPosition = sliderRect.width - parseInt(rightMarker.style.right);
        leftMarker.style.left = `${newPosition}px`;
        leftTrimTime = (newPosition / sliderRect.width) * duration;
    } else if (isDraggingRight) {
        let newPosition = sliderRect.right - e.clientX;
        if (newPosition < 0) newPosition = 0;
        if (newPosition > sliderRect.width - parseInt(leftMarker.style.left)) newPosition = sliderRect.width - parseInt(leftMarker.style.left);
        rightMarker.style.right = `${newPosition}px`;
        rightTrimTime = duration - (newPosition / sliderRect.width) * duration;
    }
    // Update the slider track and trim times visually without affecting the actual trim time values until mouseup
    sliderTrack.style.left = leftMarker.style.left;
    sliderTrack.style.right = rightMarker.style.right;
    document.getElementById('leftTrimTime').textContent = formatTime(leftTrimTime);
    document.getElementById('rightTrimTime').textContent = formatTime(rightTrimTime);
});
