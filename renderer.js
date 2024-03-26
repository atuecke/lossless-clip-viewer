const { ipcRenderer } = require('electron');

document.getElementById('selectFolder').addEventListener('click', () => {
    ipcRenderer.send('open-file-dialog');
});
