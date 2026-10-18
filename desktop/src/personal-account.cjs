'use strict';
const { assertProductSender, productDocument } = require('./product-preview.cjs');
const { publicError } = require('./auth-service.cjs');
const { RESOURCES } = require('./personal-requests.cjs');
const fault = code => Object.assign(new Error('개인 자료 연결을 확인해 주세요.'), { code });
const OPERATIONS = new Set(['personalLoad', 'personalSave', 'personalDelete']);
function createPersonalBroker({ auth, resource }) {
  if (!RESOURCES.includes(resource)) throw fault('INVALID_REQUEST');
  let disposed = false;
  async function request(operation, params = {}) {
    try {
      if (disposed) throw fault('AUTH_CHANGED');
      if (!OPERATIONS.has(operation) || !params || typeof params !== 'object' || Array.isArray(params)) throw fault('INVALID_REQUEST');
      if (operation.startsWith('personal')) return await auth.accountRequest(operation, params);
      throw fault('INVALID_REQUEST');
    } catch (error) { return { ok: false, error: publicError(error), ...(Number.isSafeInteger(error.revision) ? { revision: error.revision } : {}) }; }
  }
  return { request, dispose() { disposed = true; } };
}
function bindPersonalIPC({ ipcMain, getWindow, auth, resource, config, fetcher }) {
  const broker = createPersonalBroker({ auth, resource, config, fetcher });
  const handlers = { 'synk-personal:auth-status': () => auth.status(), 'synk-personal:auth-sign-in': () => auth.signIn(), 'synk-personal:auth-sign-out': () => auth.signOut(), 'synk-personal:request': (operation, params) => broker.request(operation, params) };
  for (const [channel, handler] of Object.entries(handlers)) { ipcMain.removeHandler(channel); ipcMain.handle(channel, async (event, ...args) => { assertProductSender(event, getWindow(), resource); try { return await handler(...args); } catch (error) { return { ok: false, error: publicError(error) }; } }); }
  return () => { broker.dispose(); for (const channel of Object.keys(handlers)) ipcMain.removeHandler(channel); };
}
function sendPersonalAuth(window, resource, state) { if (window && !window.isDestroyed() && productDocument(resource, window.webContents.getURL())) window.webContents.send('synk-personal:auth-changed', state); }
module.exports = { createPersonalBroker, bindPersonalIPC, sendPersonalAuth };
