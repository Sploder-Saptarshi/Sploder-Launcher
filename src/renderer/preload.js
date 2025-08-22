const { contextBridge, ipcRenderer } = require('electron');

// Expose the API
contextBridge.exposeInMainWorld('electronAPI', {
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
  closeWindow: () => ipcRenderer.invoke('window-close'),
  isWindowMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  getRpcInfo: () => ipcRenderer.invoke('get-rpc-info'),
  updateRpcStatus: (status) => ipcRenderer.invoke('update-rpc-status', status),
  onWindowStateChange: (callback) => {
    ipcRenderer.on('window-state-change', (_, isMaximized) => {
      callback(isMaximized);
    });
  },
  // Configuration API
  getConfig: () => ipcRenderer.invoke('get-config'),
  getUrl: (endpoint) => ipcRenderer.invoke('get-url', endpoint)
});
