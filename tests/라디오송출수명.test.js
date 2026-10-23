'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { execFileSync } = require('node:child_process');
const { 만들기 } = require('../bots/오버레이/겹쳐송출.js');
const { 붙기 } = require('../bots/오버레이/송출연결.js');
const frames = require('../bots/오버레이/송출프레임.js');

function clock() {
  let now = 1000, id = 0;
  const tasks = new Map();
  const add = (fn, delay, repeat = false) => { const key = ++id; tasks.set(key, { fn, at: now + delay, delay, repeat }); return key; };
  return { tasks, now: () => now,
    setTimeout: (fn, ms) => add(fn, ms), clearTimeout: (key) => tasks.delete(key),
    setInterval: (fn, ms) => add(fn, ms, true), clearInterval: (key) => tasks.delete(key),
    advance(ms) {
      now += ms;
      for (const [key, task] of [...tasks]) if (task.at <= now && tasks.has(key)) {
        if (task.repeat) task.at = now + task.delay; else tasks.delete(key);
        task.fn();
      }
    },
  };
}
async function flush() { for (let i = 0; i < 25; i++) await Promise.resolve(); }
function fixture({ failServer = 0, holdCdp = false, realEncoder = false } = {}) {
  const timers = clock(), children = [], servers = [], sockets = [];
  class Socket {
    constructor() { sockets.push(this); queueMicrotask(() => this.onopen?.()); }
    send(text) { if (holdCdp) return; const m = JSON.parse(text); queueMicrotask(() => this.onmessage?.({ data: JSON.stringify({ id: m.id, result: m.method === 'Page.captureScreenshot' ? { data: 'YWJj' } : {} }) })); }
    close() { this.closed = true; this.onclose?.(); }
  }
  const io = {
    timers, now: timers.now, WebSocket: Socket,
    fetch: async () => ({ json: async () => [{ type: 'page', webSocketDebuggerUrl: 'ws://fixture.invalid' }] }),
    fs: { existsSync: (p) => /playlist\.txt$/.test(p), readFileSync: () => '', rmSync() {} },
    현재곡: { 시작: () => null },
    http: { createServer() {
      const server = new EventEmitter(); servers.push(server);
      server.listen = (port, host, callback) => { assert.equal(host, '127.0.0.1'); queueMicrotask(() => servers.indexOf(server) + 1 === failServer ? server.emit('error', Error('EADDRINUSE fixture')) : callback()); return server; };
      server.close = (callback) => { server.closed = true; callback(); };
      return server;
    } },
    spawn(command) {
      if (command === 'ffmpeg' && realEncoder) {
        const child = require('node:child_process').spawn(process.execPath, ['-e', 'process.stdin.resume(); const alive=setInterval(()=>{},1000); process.stdin.on("end",()=>{clearInterval(alive);process.exitCode=0})'], { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true });
        const kill = child.kill.bind(child);
        child.kill = (signal) => { child.signal = signal; if (signal === 'SIGKILL') return kill(signal); return true; };
        children.push(child); return child;
      }
      const child = new EventEmitter(); child.command = command; child.stderr = new EventEmitter();
      child.stdin = Object.assign(new EventEmitter(), { writableLength: 0, write() {}, destroy() { this.destroyed = true; } });
      child.kill = (signal) => { child.killed = true; child.signal = signal; };
      children.push(child); return child;
    },
  };
  return { runtime: 만들기(['--시늉', 'fixture.mp4'], io), timers, children, servers, sockets };
}

test('import does not start HTTP, child processes, or read broadcast credentials', () => {
  const script = `require('node:http').createServer=()=>{throw Error('HTTP started')}; require('node:child_process').spawn=()=>{throw Error('child started')}; const fs=require('node:fs'), read=fs.readFileSync; fs.readFileSync=function(p,...a){if(/조율\\.json|\\.env$/.test(String(p)))throw Error('credentials read');return read.call(this,p,...a)}; require('./bots/오버레이/겹쳐송출.js');`;
  execFileSync(process.execPath, ['-e', script], { cwd: require('node:path').resolve(__dirname, '..'), stdio: 'pipe', timeout: 10000 });
});

test('normal stop releases both servers, browser, encoder, CDP, and every timer once', async () => {
  const f = fixture(), started = f.runtime.start();
  await flush(); f.timers.advance(1500); await started;
  assert.equal(f.servers.length, 2); assert.equal(f.children.length, 2);
  await f.runtime.stop(); await f.runtime.stop();
  assert(f.servers.every((x) => x.closed)); assert(f.sockets.every((x) => x.closed));
  assert.deepEqual(f.children.map((x) => x.signal), ['SIGTERM', 'SIGINT']);
  assert.equal(f.children[1].stdin.destroyed, true);
  assert.equal(f.timers.tasks.size, 0); assert.equal((await f.runtime.done).code, 0);
});

test('a later startup failure releases resources already opened', async () => {
  const f = fixture({ failServer: 2 });
  const started = f.runtime.start();
  const rejected = assert.rejects(started, /EADDRINUSE/);
  await flush(); f.timers.advance(1500); await rejected;
  assert(f.servers.every((x) => x.closed)); assert(f.children.every((x) => x.killed));
  assert(f.sockets.every((x) => x.closed)); assert.equal(f.timers.tasks.size, 0);
  assert.equal((await f.runtime.done).code, 1);
});

test('stop during startup aborts the wait and never starts the encoder', async () => {
  const f = fixture(), started = f.runtime.start();
  await flush(); await f.runtime.stop(); await started;
  assert.equal(f.children.length, 1); assert.equal(f.timers.tasks.size, 0);
  assert(f.servers.every((x) => x.closed)); assert.equal((await f.runtime.done).code, 0);
});

test('stop while awaiting a startup CDP command keeps the normal exit result', async () => {
  const f = fixture({ holdCdp: true }), started = f.runtime.start();
  await flush(); await f.runtime.stop({ code: 0 }); await started;
  assert.equal((await f.runtime.done).code, 0); assert.equal(f.timers.tasks.size, 0);
});

test('stop closes the encoder pipe so a real child waiting for EOF terminates', { timeout: 10000 }, async (t) => {
  const f = fixture({ realEncoder: true }), started = f.runtime.start();
  await flush(); f.timers.advance(1500); await started;
  const child = f.children[1];
  t.after(() => { if (child.exitCode == null) child.kill('SIGKILL'); });
  let timeout;
  const exited = Promise.race([
    require('node:events').once(child, 'exit'),
    new Promise((_, reject) => { timeout = setTimeout(() => reject(Error('encoder did not exit after EOF')), 4000); }),
  ]);
  t.after(() => clearTimeout(timeout));
  await f.runtime.stop();
  assert.equal(child.stdin.destroyed, true);
  assert.equal((await exited)[0], 0);
});

test('CDP response cancels its timeout; abort rejects outstanding commands and clears timers', async () => {
  const timers = clock(), abort = new AbortController(); let socket;
  class Socket { constructor() { socket = this; queueMicrotask(() => this.onopen()); } send(text) { this.sent = JSON.parse(text); } close() { this.closed = true; this.onclose?.(); } }
  const c = await 붙기('ws://fixture.invalid', { WebSocket: Socket, timers, signal: abort.signal });
  const answer = c.부르기('Page.enable');
  socket.onmessage({ data: JSON.stringify({ id: socket.sent.id, result: { ok: true } }) });
  assert.deepEqual(await answer, { ok: true }); assert.equal(timers.tasks.size, 0);
  const pending = assert.rejects(c.부르기('Page.captureScreenshot'), { name: 'AbortError' });
  abort.abort(); await pending; assert.equal(timers.tasks.size, 0); assert(socket.closed);
});

test('aborting CDP while opening also cancels the open timeout', async () => {
  const timers = clock(), abort = new AbortController(); let closed = false;
  class Socket { close() { closed = true; } }
  const promise = assert.rejects(붙기('ws://fixture.invalid', { WebSocket: Socket, timers, signal: abort.signal }), { name: 'AbortError' });
  abort.abort(); await promise; assert(closed); assert.equal(timers.tasks.size, 0);
});

test('frame sender preserves elapsed-time catch-up, one-second cap, and eight-frame backpressure', async () => {
  let now = 1000, writes = 0; const ticks = [];
  const stdin = Object.assign(new EventEmitter(), { writableLength: 0, write: () => { writes++; return false; } });
  frames.시작({ 부르기: async () => ({ data: 'YWJj' }), ff: { stdin }, 뜨기: 10, now: () => now, interval: (fn) => ticks.push(fn) });
  await ticks[0](); ticks[1]();
  now += 250; ticks[1](); assert.equal(writes, 2);
  now += 3000; ticks[1](); assert.equal(writes, 12);
  stdin.writableLength = 25; now += 100; ticks[1](); assert.equal(writes, 12);
  stdin.writableLength = 24; ticks[1](); assert.equal(writes, 22);
});
