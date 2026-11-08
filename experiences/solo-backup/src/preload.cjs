'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const call = name => (...args) => ipcRenderer.invoke(`backup:${name}`, ...args);
contextBridge.exposeInMainWorld('backup', Object.freeze({
  getState: call('getState'), chooseSources: call('chooseSources'), chooseTarget: call('chooseTarget'), setup: call('setup'),
  saveRecoveryKit: call('saveRecoveryKit'), startAutomatic: call('startAutomatic'), setAutomatic: call('setAutomatic'),
  backupNow: call('backupNow'), restoreLatest: call('restoreLatest'), checkRepository: call('checkRepository'),
  importRecoveryKit: call('importRecoveryKit'), setLaunchAtLogin: call('setLaunchAtLogin'), openRestoreFolder: call('openRestoreFolder'),
  onState: callback => { const listener = (_event, value) => callback(value); ipcRenderer.on('backup:state', listener); return () => ipcRenderer.removeListener('backup:state', listener); }
}));
