'use strict';
// The host the move tests give the engine (tests/move-restore.test.cjs). With SWB_MOVE_HOST set to a built
// move-host/WorkBackupMoveHost.exe it is the real Rust code (src-tauri/src/files.rs · folders.rs) over standard I/O;
// without it, a stand-in with the same rules (no replacing, no following links, 「(복구본 N)」, compare by content), so
// the test also runs where only restic is at hand (conditional CI).
const fs = require('node:fs/promises');
const fss = require('node:fs');
const path = require('node:path').win32;
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const readline = require('node:readline');

function rustHost(exe) {
  const child = spawn(exe, [], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
  const waiting = new Map(); let next = 0;
  readline.createInterface({ input: child.stdout }).on('line', line => {
    const reply = JSON.parse(line); const w = waiting.get(reply.id); if (!w) return; waiting.delete(reply.id);
    if (reply.ok) w.resolve(reply.value); else w.reject(new Error(reply.code));
  });
  // A host that cannot start or stops ends every call still waiting, so a test fails instead of hanging (카본 끝판 I2).
  let gone = null;
  const fail = e => { gone ||= e; for (const w of waiting.values()) w.reject(gone); waiting.clear(); };
  child.once('error', e => fail(new Error(`TEST_HOST_START: ${e.message}`)));
  child.once('exit', code => fail(new Error(`TEST_HOST_EXIT: ${code}`)));
  const call = (method, args) => new Promise((resolve, reject) => {
    if (gone) return reject(gone);
    const id = ++next; waiting.set(id, { resolve, reject }); child.stdin.write(JSON.stringify({ id, method, args }) + '\n');
  });
  call.close = () => new Promise(ok => { if (child.exitCode !== null || child.signalCode !== null || gone) return ok(); child.once('exit', ok); child.stdin.end(); });
  call.real = true;
  return call;
}

const tempName = name => /^~synk-[0-9a-f]{8,32}-\d{1,9}\.part$/.test(name);
async function kind(p) {
  try { const s = await fs.lstat(p); return s.isSymbolicLink() ? 'link' : s.isDirectory() ? 'dir' : 'file'; } catch (e) { if (e.code === 'ENOENT' || e.code === 'ENOTDIR') return 'missing'; throw e; }
}
async function chain(dir) {
  const parts = path.resolve(dir).split('\\'); let cursor = parts[0] + '\\';
  for (const part of parts.slice(1).filter(Boolean)) {
    cursor = path.join(cursor, part); const k = await kind(cursor);
    if (k === 'missing') return 'ok'; if (k === 'link') return 'MOVE_SKIP_LINK'; if (k === 'file') return 'MOVE_SKIP_FILE';
  }
  return 'ok';
}
const sha = async p => { const h = crypto.createHash('sha256'); for await (const c of fss.createReadStream(p)) h.update(c); return h.digest('hex'); };
async function same(p, e) {
  if (await kind(p) !== 'file') return false;
  const s = await fs.stat(p); if (s.size !== e.size) return false;
  return (await sha(p)) === e.sha256;
}
function copyName(target, n) {
  const dir = path.dirname(target), name = path.basename(target), i = name.lastIndexOf('.');
  const [stem, ext] = i > 0 ? [name.slice(0, i), name.slice(i)] : [name, ''];
  return path.join(dir, `${stem} ${n <= 1 ? '(복구본)' : `(복구본 ${n})`}${ext}`);
}
/** Renames without replacing: a hard link fails when the name is taken, then the temporary name goes. */
async function noReplace(from, to) {
  try { await fs.link(from, to); } catch (e) { if (e.code === 'EEXIST' || e.code === 'EPERM') return false; throw e; }
  await fs.unlink(from); return true;
}
function standIn({ snapshot }) {
  const call = async (method, [first] = []) => {
    switch (method) {
      case 'folders.snapshot': return snapshot;
      case 'folders.free': return first.map(() => 1e15);
      case 'files.probe': if (first.length > 500) throw new Error('HOST_REQUEST'); return Promise.all(first.map(async p => { const c = await chain(path.dirname(p)); if (c !== 'ok') return { kind: c === 'MOVE_SKIP_LINK' ? 'link-above' : 'file-above' }; const k = await kind(p); if (k !== 'file') return { kind: k }; const s = await fs.stat(p); return { kind: 'file', size: s.size, mtimeMs: Math.round(s.mtimeMs), placeholder: false }; }));
      case 'files.mkdirs': {
        const c = await chain(first); if (c !== 'ok') return { ok: false, skip: c };
        const parts = first.split('\\'); let cursor = parts[0] + '\\';
        for (const part of parts.slice(1).filter(Boolean)) { cursor = path.join(cursor, part); const k = await kind(cursor); if (k === 'missing') await fs.mkdir(cursor); else if (k !== 'dir') return { ok: false, skip: k === 'link' ? 'MOVE_SKIP_LINK' : 'MOVE_SKIP_FILE' }; }
        return { ok: true };
      }
      case 'files.place': {
        const { temp, target } = first;
        if (path.dirname(temp).toLowerCase() !== path.dirname(target).toLowerCase() || !tempName(path.basename(temp))) throw new Error('MOVE_REQUEST');
        const c = await chain(path.dirname(target)); if (c !== 'ok') throw new Error(c);
        for (let n = 0; n <= 100; n++) {
          const name = n === 0 ? target : copyName(target, n);
          if (await noReplace(temp, name)) return { result: n === 0 ? 'placed' : 'copy', path: name };
          if (await same(name, first)) { await fs.unlink(temp); return { result: 'same', path: name }; }
        }
        throw new Error('MOVE_COPY_NAMES');
      }
      case 'files.discard': { if (!tempName(path.basename(first))) throw new Error('MOVE_REQUEST'); const c = await chain(path.dirname(first)); if (c !== 'ok') throw new Error(c); if (await kind(first) !== 'file') return false; await fs.unlink(first); return true; }
      // Like files.rs: a link or file above the place makes it 「different」, never read through (카본 끝판 I3).
      case 'files.compare': { if (await chain(path.dirname(first.path)) !== 'ok') return { match: 'different' }; const k = await kind(first.path); if (k === 'missing') return { match: 'missing' }; return { match: await same(first.path, first) ? 'verified' : 'different' }; }
      default: throw new Error('HOST_METHOD');
    }
  };
  // The window app's frame limits (src-tauri/src/protocol.rs), as the Rust test host keeps them (카본 끝판 E9): what the
  // worker sends at most 2 MiB, what goes back to it at most 128 KiB.
  const framed = async (method, args = []) => {
    if (Buffer.byteLength(JSON.stringify({ id: 0, method, args })) + 1 > 2 * 1024 * 1024) throw new Error('HOST_FRAME_TOO_LARGE');
    const value = await call(method, args);
    if (Buffer.byteLength(JSON.stringify({ id: 0, ok: true, value: value ?? null })) + 1 > 131072) throw new Error('HOST_ANSWER_TOO_LARGE');
    return value;
  };
  framed.close = async () => {}; framed.real = false;
  return framed;
}
/** The host for a test: the real one when built, else the stand-in. `snapshot` is this PC as the stand-in reports it. */
function moveHost({ snapshot }) {
  const exe = process.env.SWB_MOVE_HOST;
  if (exe) {
    const real = rustHost(exe);
    // The test fixes where this PC's folders are (a fake profile), so the snapshot comes from the test, not the machine.
    const call = (method, args) => method === 'folders.snapshot' ? Promise.resolve(snapshot) : real(method, args);
    call.close = real.close; call.real = true; return call;
  }
  return standIn({ snapshot });
}
module.exports = { moveHost };
