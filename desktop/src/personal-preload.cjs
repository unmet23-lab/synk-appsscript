'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('synkProduct', Object.freeze({ getEnvironment: () => ipcRenderer.invoke('synk-product:environment'), authStatus: () => ipcRenderer.invoke('synk-personal:auth-status'), openInBrowser: () => ipcRenderer.invoke('synk-product:open-browser') }));
contextBridge.exposeInMainWorld('synkPersonalAccount', Object.freeze({
  getEnvironment: () => ipcRenderer.invoke('synk-product:environment'),
  authStatus: () => ipcRenderer.invoke('synk-personal:auth-status'),
  authSignIn: () => ipcRenderer.invoke('synk-personal:auth-sign-in'),
  authSignOut: () => ipcRenderer.invoke('synk-personal:auth-sign-out'),
  request: (operation, params = {}) => ipcRenderer.invoke('synk-personal:request', operation, params),
  onAuthChanged: callback => { if (typeof callback !== 'function') throw new TypeError('A callback is required'); const listener = (_event, state) => callback(state); ipcRenderer.on('synk-personal:auth-changed', listener); return () => ipcRenderer.removeListener('synk-personal:auth-changed', listener); },
}));
