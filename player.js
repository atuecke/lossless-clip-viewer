const { ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');

let videoPaths = [];
let currentIndex = 0;
let leftTrimTime = 0;
let rightTrimTime = 0;

const videoPlayer = document.getElementById('videoPlayer');
const leftMarker = document.getElementById('leftMarker');
const rightMarker = document.getElementById('rightMarker');
const sliderTrack = document.getElementById('sliderTrack');

let saveFolderPath = '';

let isSaveDialogOpen = false;

let audioPlayers = [];

let playEventListeners = [];

let autoReview = true; // By default, auto review is on

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
    cleanupAudioPlayers()
    const videoPlayer = document.getElementById('videoPlayer');
    videoPlayer.src = videoPaths[index];
    videoPlayer.play();
    leftTrimTime = 0;
    rightTrimTime = videoPlayer.duration;
    ipcRenderer.send('extract-audio-tracks', { videoPath: videoPaths[index] });
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
    if (!saveFolderPath) {
        alert('Please select a save folder first.');
        return;
    }

    // Implement custom dialog functionality here
    showCustomSaveDialog();
});

function showCustomSaveDialog() {
    // Request the main process to send back the sub-folders
    ipcRenderer.send('get-sub-folders', saveFolderPath);
}

// Listen for the sub-folders response
ipcRenderer.on('sub-folders-response', (event, subFolders) => {
    displayCustomSaveDialog(subFolders); // Now call the function to display the dialog with subFolders
});

function displayCustomSaveDialog(subFolders) {
    isSaveDialogOpen = true;
    const closeDialog = () => {
        isSaveDialogOpen = false; // Reset the flag when the dialog closes
        document.removeEventListener('keydown', handleDialogKeydown); // Remove dialog-specific keybinds
        overlay.remove();
    };

    // Create the dialog overlay
    const overlay = document.createElement('div');
    overlay.id = 'dialogOverlay';
    // Basic styling for the overlay; consider enhancing this for production
    overlay.style.position = 'fixed';
    overlay.style.top = 0;
    overlay.style.left = 0;
    overlay.style.width = '100%';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '1000';

    // Dialog container
    const dialog = document.createElement('div');
    dialog.style.backgroundColor = '#fff';
    dialog.style.padding = '20px';
    dialog.style.borderRadius = '5px';
    dialog.style.display = 'flex';
    dialog.style.flexDirection = 'column';
    dialog.style.gap = '10px';
    dialog.style.maxHeight = '80vh';
    dialog.style.overflowY = 'auto';

    // Input for the clip name
    const defaultName = `clip-${new Date().toISOString().replace(/:/g, '').replace('T', '-').slice(0, -5)}`;
    const nameInput = document.createElement('input');
    //nameInput.placeholder = 'Clip name (default: clip-YYYYMMDD-HHMMSS)';
    nameInput.value = defaultName;
    nameInput.style.width = '90%';
    dialog.appendChild(nameInput);

    // Use setTimeout to delay focus and select, ensuring the input is ready
    setTimeout(() => {
        nameInput.focus();
        nameInput.select();
    }, 100); // A delay of 100ms is usually enough, but this can be adjusted if necessary

    const handleDialogKeydown = (event) => {
        // Check if Alt is pressed with a number key
        if (event.altKey && event.key >= '1' && event.key <= '9') {
            const folderIndex = parseInt(event.key, 10) - 1;
            if (folderIndex < subFolders.length) {
                const selectedFolder = subFolders[folderIndex];
                const clipName = nameInput.value.trim() || defaultName;
                saveClip(clipName, selectedFolder);
                closeDialog;
            }
            // Prevent the default action to avoid triggering other Alt+Number shortcuts
            event.preventDefault();
        }
    };

    document.addEventListener('keydown', handleDialogKeydown);

    // Ensure the listener is removed when the dialog is closed
    

    // Modify the creation of folder buttons to include the number
    subFolders.forEach((folder, index) => {
        const folderButton = document.createElement('button');
        const buttonLabel = index < 9 ? `${index + 1}: ${folder}` : `N: ${folder}`;
        folderButton.textContent = buttonLabel;
        folderButton.onclick = () => {
            saveClip(nameInput.value.trim() || defaultName, folder);
            closeDialog;
        };
        dialog.appendChild(folderButton);
    });

    // Append dialog to overlay and overlay to body
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    overlay.onclick = closeDialog;
}

function saveClip(name, subFolder) {
    const clipName = name || `clip-${new Date().toISOString().replace(/:/g, '').replace('T', '-').slice(0, -5)}`;
    const targetPath = path.join(saveFolderPath, subFolder, `${clipName}.mp4`);

    // Trigger clip saving using IPC to main process with targetPath
    ipcRenderer.send('save-trimmed-clip-with-name', {
        videoPath: videoPaths[currentIndex],
        startTime: leftTrimTime,
        endTime: rightTrimTime,
        targetPath: targetPath,
        autoReview: autoReview
    });

    if (autoReview) {
        moveToNextVideo();
    }

    
    document.getElementById('dialogOverlay').remove();
    isSaveDialogOpen = false; // Reset the flag when the dialog closes
    document.removeEventListener('keydown', handleDialogKeydown); // Remove dialog-specific keybinds
}

document.getElementById('saveFolder').addEventListener('click', () => {
    ipcRenderer.send('open-save-folder-dialog');
});

ipcRenderer.on('selected-save-folder', (event, path) => {
    saveFolderPath = path; // Store the selected folder path
});

ipcRenderer.on('video-moved', (event, { originalPath, newPath }) => {
    // Remove the moved video from the videoPaths array
    const movedVideoIndex = videoPaths.findIndex(path => path === originalPath);
    if (movedVideoIndex > -1) {
        videoPaths.splice(movedVideoIndex, 1);
    }

    // If the currently playing video was moved, automatically load the next video
    // This assumes currentIndex has already been adjusted in the moveToNextVideo function
    if (movedVideoIndex === currentIndex) {
        playVideoAtIndex(currentIndex);
    } else {
        // Adjust currentIndex if necessary
        if (movedVideoIndex < currentIndex) {
            currentIndex -= 1;
        }
    }

    // Update any UI or application state that depends on the current list of videos or the current video
    // For example, if you're displaying the list of video filenames somewhere in your UI, refresh that list here
});


function moveToNextVideo() {
    if (currentIndex < videoPaths.length - 1) {
        currentIndex++;
    } else {
        currentIndex = 0; // Loop back to the first video if at the end of the list
    }
    playVideoAtIndex(currentIndex);
}


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

document.addEventListener('keydown', (event) => {
    if(!isSaveDialogOpen) {
        if (event.key === '1') {
            // Set left marker at current time
            leftTrimTime = videoPlayer.currentTime;
            updateMarkerPositions();
        } else if (event.key === '2') {
            // Set right marker at current time
            rightTrimTime = videoPlayer.currentTime;
            updateMarkerPositions();
        } else if (event.key === 's') {
            // Save video
            showCustomSaveDialog();
        } else if (event.key === 'r') {
            // Save video
            markReviewed();
        } else if (event.key === 'ArrowLeft') {
            // Move to previous video
            if (currentIndex > 0) {
                currentIndex--;
                playVideoAtIndex(currentIndex);
            }
        } else if (event.key === 'ArrowRight') {
            // Move to next video
            if (currentIndex < videoPaths.length - 1) {
                currentIndex++;
                playVideoAtIndex(currentIndex);
            }
        } if (event.code === 'Space' && event.target.nodeName !== 'INPUT') {
            if (videoPlayer.paused) {
                videoPlayer.play();
            } else {
                videoPlayer.pause();
            }
        }
        return;
    }
});

document.getElementById('autoReview').addEventListener('click', () => {
    autoReview = !autoReview; // Toggle the state
    document.getElementById('autoReview').textContent = autoReview ? 'Auto Review: ON' : 'Auto Review: OFF';
});

document.addEventListener('focus', (event) => {
    const target = event.target; // The element that received focus
    const videoPlayer = document.getElementById('videoPlayer');

    if (videoPlayer.contains(target)) {
        // If the focused element is within the video controls, blur it
        target.blur();
        // Optionally, refocus to a specific element if needed
        document.body.focus();
    }
}, true); // Use capturing phase to catch the event early

function markReviewed(){
    const videoPlayer = document.getElementById('videoPlayer');
    videoPlayer.pause();  // Ensure the player is paused
    videoPlayer.src = ''; // Disconnect the source
    videoPlayer.load();   // Force the browser to drop the connection to the file
    
    setTimeout(() => {
        ipcRenderer.send('mark-video-reviewed', videoPaths[currentIndex-1]);
    }, 1000);
    moveToNextVideo();
}

document.getElementById('markReviewed').addEventListener('click', () => {
    markReviewed();
});

ipcRenderer.on('audio-tracks-extracted', (event, tempFolder) => {
    fs.readdir(tempFolder, (err, files) => {
        if (err) {
            console.error('Error reading temp folder:', err);
            return;
        }

        files.forEach((file) => {
            if (file.endsWith('.mp3')) { // Only handle AAC files
                const audioPlayer = new Audio(`file://${path.join(tempFolder, file)}`);
                audioPlayers.push(audioPlayer);

                // Set up synchronization with the video player
                const playListener = () => {
                    if (audioPlayer.paused) {
                        audioPlayer.currentTime = videoPlayer.currentTime;
                        audioPlayer.play().catch(e => console.log('Error playing audio:', e));
                    }
                };
                videoPlayer.addEventListener('play', playListener);
                playEventListeners.push(playListener); // Store reference for later removal

                videoPlayer.addEventListener('pause', () => audioPlayer.pause());
                videoPlayer.addEventListener('seeked', () => {
                    audioPlayer.currentTime = videoPlayer.currentTime;
                });

                // Play audio if the video is currently playing
                if (!videoPlayer.paused) {
                    audioPlayer.play().catch(e => console.log('Error playing audio:', e));
                }
                audioPlayer.currentTime = videoPlayer.currentTime;
            }
        });
        syncAudioPlayerVolumes();  // Sync volumes right after setup
    });
});

function cleanupAudioPlayers() {
    console.log('Cleaning up audio players...');
    audioPlayers.forEach(player => {
        player.pause();
        player.src = '';
        if (player.parentNode) {
            player.parentNode.removeChild(player); // Ensure it's removed from the DOM
        }
    });
    audioPlayers = [];

    // Remove all play event listeners
    playEventListeners.forEach(listener => {
        videoPlayer.removeEventListener('play', listener);
    });
    playEventListeners = [];

    // If replacing videoPlayer, reattach the volume change listener
    videoPlayer.removeEventListener('volumechange', syncAudioPlayerVolumes);
    videoPlayer.addEventListener('volumechange', syncAudioPlayerVolumes);
}

window.addEventListener('beforeunload', () => {
    cleanupAudioPlayers();
});

function syncAudioPlayerVolumes() {
    const videoVolume = videoPlayer.volume;
    audioPlayers.forEach(audioPlayer => {
        audioPlayer.volume = videoVolume;  // Set each audio player's volume to match the video player's volume
    });
}

videoPlayer.addEventListener('volumechange', syncAudioPlayerVolumes);

