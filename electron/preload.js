'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  getStatus:      () => ipcRenderer.invoke('get-status'),
  getAppVersion:  () => ipcRenderer.invoke('get-app-version'),
  openUrl:        (url) => ipcRenderer.send('open-url', url),
  hide:           () => ipcRenderer.send('hide'),
  quit:           () => ipcRenderer.send('quit'),
  onStatusUpdate: (cb) => { ipcRenderer.on('server-status', (_, d) => cb(d)); },
});
