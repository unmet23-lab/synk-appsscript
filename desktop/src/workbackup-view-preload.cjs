'use strict';
// 솔리오 백업 방 안 엔진 화면 자리의 preload(experiences/solo-backup-rust/SOLIO_ONE_CLIENT.md 2.2 「다리(F7)」, 2026-11-26).
// window.synkBackupHost 하나만 내놓는다: call(method, args) · onState(cb) · onOpen(cb) · close(). 메서드 목록은 들고 있지 않다.
// window.backup은 엔진이 싣는 bridge.js가 이 통로 위에 만든다. 엔진이 메서드를 더해도 솔리오를 고칠 일이 없다.
// 본체는 이 자리의 webContents · 주 프레임 · workbackup-ui://app/ 주소에서 온 부름만 받는다(workbackup-view.cjs fromView).
const { contextBridge, ipcRenderer } = require('electron');

const listeners = { state: new Set(), open: new Set() };
/* 화면이 onOpen을 달기 전에 온 낱말은 하나만 들고 있다가 처음 단 귀에 준다 */
let pendingTopic = null;

const deliver = (set, value) => { for (const callback of [...set]) { try { callback(value); } catch (error) { setTimeout(() => { throw error; }, 0); } } };
ipcRenderer.on('workbackup:state', (_event, value) => deliver(listeners.state, value));
ipcRenderer.on('workbackup:open', (_event, topic) => {
  if (typeof topic !== 'string' || !/^[a-z]{1,16}$/.test(topic)) return;
  if (listeners.open.size) deliver(listeners.open, topic); else pendingTopic = topic;
});

function listen(kind, callback) {
  if (typeof callback !== 'function') throw new TypeError('A callback is required');
  listeners[kind].add(callback);
  return () => { listeners[kind].delete(callback); };
}

contextBridge.exposeInMainWorld('synkBackupHost', Object.freeze({
  call: (method, args = []) => ipcRenderer.invoke('workbackup:call', typeof method === 'string' ? method : '', Array.isArray(args) ? args : []),
  /* Tauri 이벤트처럼 Promise<해제 함수>를 돌려준다 */
  onState: callback => { try { return Promise.resolve(listen('state', callback)); } catch (error) { return Promise.reject(error); } },
  onOpen: callback => {
    const off = listen('open', callback);
    if (pendingTopic) { const topic = pendingTopic; pendingTopic = null; setTimeout(() => deliver(listeners.open, topic), 0); }
    return off;
  },
  close: () => ipcRenderer.invoke('workbackup:close'),
}));
