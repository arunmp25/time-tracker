const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tempo', {
  getSystemUsername: () => ipcRenderer.invoke('tempo:get-system-username'),
});
