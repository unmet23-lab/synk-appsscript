'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const call = name => (...args) => ipcRenderer.invoke(`backup:${name}`, ...args);
contextBridge.exposeInMainWorld('backup', Object.freeze({
  connectRecovery: call('connectRecovery'), disconnectRecovery: call('disconnectRecovery'), syncRecovery: call('syncRecovery'),
  findRecoveryBackups: call('findRecoveryBackups'), importAccountRecovery: call('importAccountRecovery'),
  selectProfile: call('selectProfile'), reuseLocalSources: call('reuseLocalSources'), setupCloud: call('setupCloud'),
  updateCloudCredentials: call('updateCloudCredentials'), recoverCredential: call('recoverCredential'),
  getState: call('getState'), chooseSources: call('chooseSources'), chooseTarget: call('chooseTarget'), setup: call('setup'),
  saveRecoveryKit: call('saveRecoveryKit'), startAutomatic: call('startAutomatic'), setAutomatic: call('setAutomatic'),
  backupNow: call('backupNow'), restoreLatest: call('restoreLatest'), checkRepository: call('checkRepository'),
  protectNow: call('protectNow'), pauseAutomatic: call('pauseAutomatic'), resumeAutomatic: call('resumeAutomatic'), probeRestore: call('probeRestore'),
  openFileCatalog: call('openFileCatalog'), queryFileCatalog: call('queryFileCatalog'), setFileSelection: call('setFileSelection'),
  closeFileCatalog: call('closeFileCatalog'), restoreSelected: call('restoreSelected'), openSelectedRestoreFolder: call('openSelectedRestoreFolder'),
  importRecoveryKit: call('importRecoveryKit'), setLaunchAtLogin: call('setLaunchAtLogin'), openRestoreFolder: call('openRestoreFolder'),
  onState: callback => { const listener = (_event, value) => callback(value); ipcRenderer.on('backup:state', listener); return () => ipcRenderer.removeListener('backup:state', listener); }
}));
