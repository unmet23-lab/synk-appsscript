'use strict';
// 시험용 가짜 호스트: `WorkBackup.exe --solio`의 표준 입출력 꼴(experiences/solo-backup-rust/SOLIO_ONE_CLIENT.md 2.6)을 흉내 낸다.
// 첫 인자가 갈래다. ok · busy · refuse · newer · pre · junk · fail · crash · silent · big.
// 받은 줄은 SWB_FAKE_LOG 파일에 한 줄씩 남긴다(시험이 bye · window · answer를 읽는다). 엔진 · 네트워크 · 레지스트리는 쓰지 않는다.
const fs = require('node:fs');
const mode = process.argv[2] || 'ok';
const log = process.env.SWB_FAKE_LOG || null;
const note = value => { if (log) fs.appendFileSync(log, JSON.stringify(value) + '\n'); };
const out = value => process.stdout.write(JSON.stringify(value) + '\n');
note({ started: mode, args: process.argv.slice(3) });

if (mode === 'refuse') process.exit(77);
if (mode === 'busy') { out({ hello: { v: 1, busy: true } }); process.exit(0); }
if (mode === 'crash') { out({ hello: { v: 1, version: '0.8.0' } }); setTimeout(() => process.exit(3), 150); }
if (mode === 'pre') out({ state: { before: 'hello' } });
if (mode === 'big') process.stdout.write('{"state":"' + 'x'.repeat(2 * 1024 * 1024 + 10) + '"}\n');
if (mode === 'newer') out({ hello: { v: 2, shape: 'new' } });
else if (mode !== 'silent' && mode !== 'crash') out({ hello: { v: 1, version: '0.8.0' } });

let buffer = '', asked = 0;
const asks = new Map();
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  buffer += chunk;
  let at;
  while ((at = buffer.indexOf('\n')) >= 0) {
    const text = buffer.slice(0, at); buffer = buffer.slice(at + 1);
    let line; try { line = JSON.parse(text); } catch { continue; }
    note({ got: line });
    if (line.bye === true) process.exit(0);
    if (typeof line.answer === 'number') { const reply = asks.get(line.answer); asks.delete(line.answer); if (reply) reply(line.ok); continue; }
    if (typeof line.id !== 'number' || typeof line.call !== 'string') continue;
    const id = line.id, method = line.call, args = line.args;
    if (method === 'emitState') { out({ state: { stage: 'restore', percent: 37 } }); out({ id, result: { ok: true, value: null } }); continue; }
    if (method === 'failNow') { out({ failed: 'WORKER_DIED' }); setTimeout(() => process.exit(1), 50); continue; }
    if (method === 'junk') { out({ id, result: { ok: true, value: 'junk' }, extra: 1 }); out({ id, result: { ok: true, value: 'clean' } }); continue; }
    if (method === 'badEnvelope') { out({ id, result: { nope: true } }); continue; }
    if (method === 'never') continue;
    if (method === 'ask') {
      const n = ++asked;
      asks.set(n, ok => out({ id, result: { ok: true, value: ok } }));
      out({ ask: n, native: args[0], arg: args[1] });
      continue;
    }
    out({ id, result: { ok: true, value: { method, args } } });
  }
});
process.stdin.on('end', () => process.exit(0));
if (mode === 'junk') out({ hello: { v: 1, version: '0.8.0' }, extra: true });
