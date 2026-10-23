'use strict';

async function 붙기(address, { WebSocket = globalThis.WebSocket, timers = globalThis, signal } = {}) {
  signal?.throwIfAborted();
  const ws = new WebSocket(address);
  const pending = new Map();
  let nextId = 0, closed = false;
  const rejectPending = () => {
    for (const item of pending.values()) {
      timers.clearTimeout(item.timer);
      item.reject(signal?.aborted ? signal.reason : new Error('문이 닫혔다'));
    }
    pending.clear();
  };
  const close = () => {
    if (closed) return;
    closed = true;
    signal?.removeEventListener('abort', close);
    rejectPending();
    try { ws.close(); } catch { /* 연결 전 실패도 닫힌 상태로 남긴다 */ }
  };
  try {
    await new Promise((resolve, reject) => {
      const abort = () => { cleanup(); reject(signal.reason); };
      const cleanup = () => { signal?.removeEventListener('abort', abort); timers.clearTimeout(timer); };
      const timer = timers.setTimeout(() => { cleanup(); reject(new Error('문 열기 시간 초과')); }, 10000);
      signal?.addEventListener('abort', abort, { once: true });
      ws.onopen = () => { cleanup(); resolve(); };
      ws.onerror = () => { cleanup(); reject(new Error('문 열기 실패')); };
      ws.onclose = () => { cleanup(); reject(new Error('문 열기 전에 닫혔다')); };
    });
    signal?.throwIfAborted();
  } catch (error) { close(); throw error; }
  signal?.addEventListener('abort', close, { once: true });
  ws.onmessage = (event) => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    const item = pending.get(message.id);
    if (!item) return;
    pending.delete(message.id);
    timers.clearTimeout(item.timer);
    message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result);
  };
  ws.onclose = close;
  const 부르기 = (method, params, limit = 10000) => new Promise((resolve, reject) => {
    if (closed) { reject(new Error('문이 닫혔다')); return; }
    const id = ++nextId;
    const timer = timers.setTimeout(() => {
      pending.delete(id);
      reject(new Error(`${method} 이 ${limit / 1000}초 안에 답이 없다`));
    }, limit);
    pending.set(id, { resolve, reject, timer });
    try { ws.send(JSON.stringify({ id, method, params: params || {} })); }
    catch (error) { pending.delete(id); timers.clearTimeout(timer); reject(error); }
  });
  return { ws, 부르기, close };
}

module.exports = { 붙기 };
