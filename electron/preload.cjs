const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tempo', {
  getSystemUsername: () => ipcRenderer.invoke('tempo:get-system-username'),
  getDataDirectory: () => ipcRenderer.invoke('tempo:get-data-directory'),
  openDataDirectory: () => ipcRenderer.invoke('tempo:open-data-directory'),
  loadStore: () => ipcRenderer.invoke('tempo:load-store'),
  saveStore: store => ipcRenderer.invoke('tempo:save-store', store),
  clearStore: () => ipcRenderer.invoke('tempo:clear-store'),
});
