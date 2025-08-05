const { contextBridge, ipcRenderer } = require('electron');

// Expose the API
contextBridge.exposeInMainWorld('electronAPI', {
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
  closeWindow: () => ipcRenderer.invoke('window-close'),
  isWindowMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  getRpcInfo: () => ipcRenderer.invoke('get-rpc-info'),
  onWindowStateChange: (callback) => {
    ipcRenderer.on('window-state-change', (_, isMaximized) => {
      callback(isMaximized);
    });
  }
});
