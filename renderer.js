const { ipcRenderer } = require('electron');

document.getElementById('selectFolder').addEventListener('click', () => {
    const defaultPath = 'D:/Youtube/Videos/New Vids';  // Set your default path here
    ipcRenderer.send('open-file-dialog', defaultPath);
});