'use strict';
// 「새 PC로 옮겨 오기」의 내려받기와 놓기 (STAGE1_DESIGN.md 4.6 「덮지 않고 놓기」 · 「장부와 이어받기」). The engine streams
// each backed-up folder (`restic dump … --archive tar`), writes every file to a temporary name inside the folder it lands
// in, checks its SHA-256, and asks the host (src-tauri/src/files.rs) to give it its final name without replacing
// anything. One file that fails is written down and skipped; only a broken stream stops a folder. Every step goes to a
// ledger, from which an interrupted move resumes.
const fs = require('node:fs/promises');
const { createReadStream } = require('node:fs');
const path = require('node:path').win32;
const crypto = require('node:crypto');
const { StringDecoder } = require('node:string_decoder');
const { Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const tar = require('tar-stream');
const plan = require('./move-plan.cjs');

const MAX_NODES = 1000000;
/** Names Windows keeps hidden; restic's listing does not carry the attribute, so these two are hidden again by name. */
const HIDDEN_NAMES = new Set(['desktop.ini', 'thumbs.db']);
/** Results that mean the file is on this PC (or in OneDrive) and need not be fetched again on resume. */
const SETTLED = new Set(['placed', 'same', 'same-unverified', 'copy', 'side', 'onedrive']);
const FILE_ROUND = 200;
const idOk = id => typeof id === 'string' && /^[0-9a-f]{8,32}$/.test(id);
const tempRe = id => new RegExp(`^~synk-${id}-(\\d{1,9})\\.part$`);
/** A file of a folder in the ledger: the folder as Windows compares it, the name exactly (GPT GB3: `A.txt` and the
 *  `a.txt` the listing set aside are two files). */
const fileKey = (original, name) => original.toLowerCase() + '\u0000' + name;
/** What leaves the old device's backup the only copy of something: the move is not 「complete」 then (4.6). */
const UNFINISHED = ['fail', 'skip', 'side', 'same-unverified', 'folder-skip'];

/** Skips under a skipped folder carry its reason. */
function aboveSkipped(skippedDirs, name) {
  const parts = name.toLowerCase().split('/');
  for (let i = 1; i < parts.length; i++) { const r = skippedDirs.get(parts.slice(0, i).join('/')); if (r) return r; }
  return null;
}
/**
 * A listing for the move (4.6): like restore-tar's readManifest, but links, special nodes, names Windows cannot hold
 * and what is under them are kept aside with a reason instead of stopping the folder; a second name that differs only
 * by case goes to `aside` (it is put in 「따로 둔 것」 under its own name, review M19). Nodes carry `mtime` (ms).
 */
async function readMoveList(input) {
  const nodes = new Map(), aside = new Map(), skipped = [], skippedDirs = new Map(), merged = new Set();
  let bytes = 0, pending = '', snapshots = 0;
  const decoder = new StringDecoder('utf8');
  function line(text) {
    if (!text.trim()) return;
    const node = JSON.parse(text);
    // restic marks each line with `message_type` (and newer ones also `struct_type`, GPT GB1).
    const kind = node.message_type || node.struct_type;
    if (kind === 'snapshot') { snapshots++; return; }
    if (kind !== 'node' || typeof node.path !== 'string' || !node.path.startsWith('/')) throw new Error('복구 목록 형식을 확인하지 못했습니다.');
    const name = node.path.slice(1), lower = name.toLowerCase();
    if (!name || name.split('/').some(p => !p || p === '.' || p === '..')) throw new Error('복구 목록 형식을 확인하지 못했습니다.');
    if (nodes.size + aside.size + skipped.length >= MAX_NODES) throw new Error('작업 폴더 하나당 파일 · 폴더 100만 개까지 옮겨 옵니다.');
    const above = aboveSkipped(skippedDirs, name);
    const reason = above ? above : !['file', 'dir'].includes(node.type) ? (node.type === 'symlink' ? 'link' : 'special') : !name.split('/').every(plan.safeName) ? 'name' : null;
    if (reason) { skipped.push({ name, type: node.type, reason }); if (node.type === 'dir' || node.type === 'symlink') skippedDirs.set(lower, reason); return; }
    const size = node.type === 'dir' ? 0 : node.size;
    if (!Number.isSafeInteger(size) || size < 0 || !Number.isSafeInteger(bytes + size)) throw new Error('복구 목록의 파일 크기를 확인하지 못했습니다.');
    const mtime = Date.parse(node.mtime);
    const entry = { name, type: node.type, size, mtime: Number.isFinite(mtime) ? mtime : null };
    // A folder that differs only by case merges into the first (Windows has one folder for both).
    if (nodes.has(lower)) { if (node.type === 'file') aside.set(name, entry); else merged.add(name); }
    else nodes.set(lower, entry);
    bytes += size;
  }
  for await (const chunk of input) {
    pending += decoder.write(chunk);
    let index;
    while ((index = pending.indexOf('\n')) >= 0) { line(pending.slice(0, index)); pending = pending.slice(index + 1); }
    if (pending.length > 1024 * 1024) throw new Error('복구 목록의 한 항목이 너무 큽니다.');
  }
  pending += decoder.end(); if (pending) line(pending);
  if (snapshots !== 1) throw new Error('복구할 스냅샷 목록을 확인하지 못했습니다.');
  return { nodes, aside, skipped, skippedDirs, skippedNames: new Set(skipped.map(s => s.name)), merged, bytes };
}

/** The move ledger (4.6 「장부와 이어받기」): JSON lines, flushed every 50 lines, at folder ends and before each new
 *  folder is written into. */
class Ledger {
  constructor(file) { this.file = file; this.handle = null; this.unsynced = 0; }
  static async read(file) {
    let text; try { text = await fs.readFile(file, 'utf8'); } catch (e) { if (e.code === 'ENOENT') return []; throw e; }
    const out = [];
    for (const lineText of text.split('\n')) { if (!lineText.trim()) continue; try { out.push(JSON.parse(lineText)); } catch { break; } }
    return out;
  }
  async open() { await fs.mkdir(path.dirname(this.file), { recursive: true }); this.handle = await fs.open(this.file, 'a'); }
  async write(record, sync = false) {
    await this.handle.write(JSON.stringify(record) + '\n');
    if (sync || ++this.unsynced >= 50) { await this.handle.sync(); this.unsynced = 0; }
  }
  async close() { if (this.handle) { await this.handle.sync().catch(() => {}); await this.handle.close(); this.handle = null; } }
}

const code = e => (typeof e?.message === 'string' && /^[A-Z][A-Z_]+(?::\d+)?$/.test(e.message) ? e.message : e?.code) || 'FAILED';
async function hashFile(file) { const h = crypto.createHash('sha256'); for await (const chunk of createReadStream(file)) h.update(chunk); return h.digest('hex'); }
const zeroEnding = () => {
  let tail = Buffer.alloc(0), total = 0;
  return new Transform({
    transform(chunk, _e, done) { total += chunk.length; tail = chunk.length >= 1024 ? Buffer.from(chunk.subarray(-1024)) : Buffer.concat([tail, chunk]).subarray(-1024); done(null, chunk); },
    flush(done) { done(total % 512 || tail.length !== 1024 || tail.some(b => b !== 0) ? new Error('복구 데이터의 끝이 잘렸습니다.') : null); }
  });
};

/**
 * One move. `engine` is the BackupEngine holding the repository (read credentials are enough), `host(method, args)`
 * calls the Rust host (`files.*`, `folders.*`). `from` is the old device's restic host name, `old` the move kit's
 * snapshot, `now` this PC's. `choices[original] = { mode, sameDrive }` overrides a folder's default.
 */
class Move {
  constructor({ engine, host, from, old, now, choices = {}, moveId, ledgerDir, onProgress = () => {} }) {
    if (!idOk(moveId)) throw new Error('옮겨 오기 번호가 올바르지 않습니다.');
    Object.assign(this, { engine, host, from, old, now, choices, moveId, onProgress });
    this.ledger = new Ledger(path.join(ledgerDir, `${moveId}.jsonl`));
    this.final = new Map(); this.folderSkips = new Map(); this.dirs = new Map(); this.n = 0; this.done = new Map(); this.folderDone = new Set();
    this.bytes = 0; this.total = 0;
  }
  /** Counts and items from each file's last result, the earlier runs' included (GPT GB4: an interrupted move that resumes
   *  still reports what the first run could not do), and whether nothing is left only in the old device's backup (GB5:
   *  an OneDrive file whose content could not be checked counts as not finished). */
  summary(removedTemp = 0) {
    const counts = {}, items = [];
    const add = (result, item) => { counts[result] = (counts[result] || 0) + 1; if (!['placed', 'same'].includes(result) && items.length < 5000) items.push({ result, ...item }); };
    for (const { result, item } of this.final.values()) add(result, item);
    for (const item of this.folderSkips.values()) add('folder-skip', item);
    const unverified = [...this.final.values()].some(v => v.result === 'onedrive' && v.item.u);
    return { counts, items, removedTemp, complete: !unverified && !UNFINISHED.some(r => counts[r]) };
  }
  async record(original, name, result, extra = {}) {
    const k = fileKey(original, name);
    this.done.set(k, result); this.final.set(k, { result, item: { original, name, ...extra } });
    await this.ledger.write({ t: 'f', o: original, n: name, r: result, ...extra });
  }
  /** Reads an earlier ledger of this move and deletes the temporary files it left in the folders it wrote into. */
  async resume() {
    const lines = await Ledger.read(this.ledger.file);
    for (const r of lines) {
      if (r.t === 'f' && typeof r.o === 'string' && typeof r.n === 'string' && typeof r.r === 'string') {
        const k = fileKey(r.o, r.n), { t: _t, o: _o, n: _n, r: result, ...extra } = r;
        this.done.set(k, result); this.final.set(k, { result, item: { original: r.o, name: r.n, ...extra } });
        if (Number.isSafeInteger(r.k) && r.k > this.n) this.n = r.k;
      }
      else if (r.t === 'dir' && typeof r.path === 'string') this.dirs.set(r.path.toLowerCase(), { ok: null, path: r.path });
      else if (r.t === 'done' && typeof r.o === 'string') { this.folderDone.add(r.o.toLowerCase()); if (r.skipped) this.folderSkips.set(r.o.toLowerCase(), { original: r.o }); }
      else if (r.t === 'n' && Number.isSafeInteger(r.k) && r.k > this.n) this.n = r.k;
    }
    let left = 0; const re = tempRe(this.moveId);
    for (const { path: dir } of this.dirs.values()) {
      let names; try { names = await fs.readdir(dir); } catch { continue; }
      for (const name of names) { const m = re.exec(name); if (!m) continue; if (+m[1] > this.n) this.n = +m[1]; if (await this.host('files.discard', [path.join(dir, name)]).catch(() => false)) left++; }
    }
    for (const value of this.dirs.values()) value.ok = null; // checked again before use
    return { lines: lines.length, removedTemp: left };
  }
  async ensureDir(dir) {
    const k = dir.toLowerCase(), had = this.dirs.get(k);
    if (had?.ok) return had.ok;
    if (!had) await this.ledger.write({ t: 'dir', path: dir }, true);
    const answer = await this.host('files.mkdirs', [dir]).catch(e => ({ ok: false, skip: code(e) }));
    const ok = answer?.ok ? { ok: true } : { ok: false, skip: answer?.skip || 'MOVE_MKDIR' };
    this.dirs.set(k, { ok, path: dir });
    return ok;
  }
  /** Writes one tar entry's content to a temporary file next to `target` and places it (4.6 「덮지 않고 놓기」). The
   *  entry is always read to its end: a failing file is written down and the stream goes on (review M5). */
  async writeFile(stream, { original, name, size, mtime, target, check }) {
    const hash = crypto.createHash('sha256'); let written = 0, handle = null, failed = null, temp = null;
    const dir = path.dirname(target.path);
    const ready = await this.ensureDir(dir);
    if (!ready.ok) failed = ready.skip;
    else {
      const k = ++this.n; temp = path.join(dir, `~synk-${this.moveId}-${k}.part`);
      if (k % 50 === 0) await this.ledger.write({ t: 'n', k });
      try { handle = await fs.open(temp, 'wx', 0o600); } catch (e) { failed = code(e); temp = null; }
    }
    for await (const chunk of stream) {
      written += chunk.length;
      if (written > size) throw new Error('복구 파일 크기가 기록을 넘습니다.');
      hash.update(chunk); this.bytes += chunk.length;
      if (handle && !failed) { try { await handle.write(chunk); } catch (e) { failed = code(e); } }
    }
    if (written !== size) throw new Error('복구 파일 크기가 기록과 다릅니다.');
    if (handle) await handle.close().catch(e => { failed ||= code(e); });
    const sha256 = hash.digest('hex');
    const drop = async () => { if (temp) await this.host('files.discard', [temp]).catch(() => {}); };
    if (failed) { await drop(); return this.record(original, name, ready.ok ? 'fail' : 'skip', { c: failed, p: target.path }); }
    try {
      // What reached the disk is what came from the backup.
      if (await hashFile(temp) !== sha256) { await drop(); return this.record(original, name, 'fail', { c: 'MOVE_WRITE_CHANGED', p: target.path }); }
      const at = (mtime ?? Date.now()) / 1000; await fs.utimes(temp, at, at);
      const expect = { size, mtimeMs: Math.round(mtime ?? Date.now()), sha256, hidden: HIDDEN_NAMES.has(path.basename(target.path).toLowerCase()) };
      if (check) {
        const seen = await this.host('files.compare', [{ path: check, ...expect }]);
        if (seen?.match === 'verified' || seen?.match === 'unverified') { await drop(); return this.record(original, name, 'onedrive', { p: check, s: size, h: sha256, ...(seen.match === 'unverified' ? { u: true } : {}) }); }
      }
      let placed;
      try { placed = await this.host('files.place', [{ temp, target: target.path, ...expect }]); }
      catch (e) {
        if (code(e) !== 'MOVE_COPY_NAMES') throw e;
        // Every 「(복구본 N)」 is taken: the file goes to 「따로 둔 것」 under its own name.
        const sideDir = path.join(plan.places(this.now).side, '이름이 모두 찬 파일', path.basename(path.dirname(target.path)));
        const sideReady = await this.ensureDir(sideDir); if (!sideReady.ok) throw new Error(sideReady.skip);
        const k = ++this.n, sideTemp = path.join(sideDir, `~synk-${this.moveId}-${k}.part`);
        await fs.copyFile(temp, sideTemp, require('node:fs').constants.COPYFILE_EXCL); await drop();
        placed = await this.host('files.place', [{ temp: sideTemp, target: path.join(sideDir, path.basename(target.path)), ...expect }]); placed.result = 'side';
      }
      const result = target.side ? (placed.result === 'placed' || placed.result === 'copy' ? 'side' : placed.result) : placed.result;
      return this.record(original, name, result, { p: placed.path, s: size, h: sha256 });
    } catch (e) { await drop(); return this.record(original, name, 'fail', { c: code(e), p: target.path }); }
  }
  /** Extracts one tar stream whose entries are `prefix` + their name inside the folder, writing what `wants(name)`
   *  says and checking the stream against the listing like restore-tar's extractVerified. */
  async extract(input, folder, listing, prefix, wanted) {
    const extract = tar.extract(); let active = Promise.resolve(), failure = null; const seen = new Set();
    extract.on('entry', (header, stream, next) => {
      stream.on('error', () => {});
      active = (async () => {
        const inner = header.name.replace(/\/$/, '');
        if (!inner || inner === '.') { for await (const _ of stream) {} return; }
        const name = prefix ? `${prefix}/${inner}` : inner, lower = name.toLowerCase();
        const node = listing.aside.get(name) || listing.nodes.get(lower);
        const known = node && node.name === name;
        if (!known) {
          // A link, special node or unsafe name the listing set aside: never written, only read past.
          if (listing.skippedNames.has(name) || listing.merged.has(name) || aboveSkipped(listing.skippedDirs, name)) { for await (const _ of stream) {} return; }
          throw new Error('복구 내용이 사전에 확인한 파일 목록과 다릅니다.');
        }
        if (seen.has(name) || node.type !== (header.type === 'directory' ? 'dir' : header.type === 'file' ? 'file' : '?') || (node.type === 'file' && node.size !== header.size)) throw new Error('복구 내용이 사전에 확인한 파일 목록과 다릅니다.');
        seen.add(name);
        const job = wanted(name, node);
        if (node.type === 'dir') { for await (const _ of stream) {} if (job && !job.skip) await this.ensureDir(job.path); return; }
        if (!job) { for await (const _ of stream) {} return; }
        if (job.skip) { for await (const _ of stream) {} await this.record(folder.original, name, 'skip', { c: job.skip }); return; }
        await this.writeFile(stream, { original: folder.original, name, size: node.size, mtime: node.mtime, target: job, check: job.check });
        this.onProgress({ bytes: this.bytes, total: this.total });
      })();
      active.then(() => next(), e => { failure ||= e; stream.destroy(e); extract.destroy(e); });
    });
    try { await pipeline(input, zeroEnding(), extract); } catch (e) { failure ||= e; }
    await active.catch(e => { failure ||= e; });
    if (failure) throw failure;
    return seen;
  }
  target(folder, name) {
    const choice = this.choices[folder.original] || {};
    return plan.destination(folder.fp, name, { old: this.old, now: this.now, mode: choice.mode || folder.fp.mode, sameDrive: !!choice.sameDrive });
  }
  async folder(folder) {
    const { original, selector, listing, extra } = folder;
    const wanted = (name, node) => {
      if (SETTLED.has(this.done.get(fileKey(original, name)))) return null;
      if (listing.aside.get(name) === node) {
        // The second of two names differing only by case (review M19).
        return { path: path.join(plan.places(this.now).side, '대소문자만 다른 이름', folder.fp.label, ...name.split('/')), side: true };
      }
      return this.target(folder, name);
    };
    const remaining = () => [...listing.nodes.values(), ...listing.aside.values()].filter(n => n.type === 'file' && !SETTLED.has(this.done.get(fileKey(original, n.name))));
    const started = [...this.done.keys()].some(k => k.startsWith(original.toLowerCase() + '\u0000'));
    const left = remaining();
    if (!started || !left.length) {
      if (left.length || !started) await this.engine.run(['dump', selector, '/', '--archive', 'tar'], { consumeStdout: s => this.extract(s, folder, listing, '', wanted) });
    } else {
      // Resume (review M20): the top folders that still have files each as their own stream, the loose files one by one.
      const tops = new Map(); const loose = [];
      for (const n of left) { const parts = n.name.split('/'); if (parts.length === 1) loose.push(n); else { const t = parts[0]; tops.set(t.toLowerCase(), t); } }
      if (loose.length > FILE_ROUND) await this.engine.run(['dump', selector, '/', '--archive', 'tar'], { consumeStdout: s => this.extract(s, folder, listing, '', wanted) });
      else {
        for (const top of tops.values()) await this.engine.run(['dump', `${selector}/${top}`, '/', '--archive', 'tar'], { consumeStdout: s => this.extract(s, folder, listing, top, wanted) });
        for (const n of loose) await this.single(folder, selector, n, wanted(n.name, n));
        // Folders no stream above went through (empty ones, ones whose files were all placed) are made as well.
        for (const n of listing.nodes.values()) if (n.type === 'dir') { const job = wanted(n.name, n); if (job && !job.skip) await this.ensureDir(job.path); }
      }
    }
    for (const file of extra || []) {
      // What this backup could not read, from an earlier one (4.2 「지금 상태」). Its time: that backup's.
      if (SETTLED.has(this.done.get(fileKey(original, file.name)))) continue;
      const job = this.target(folder, file.name);
      if (job.skip) { await this.record(original, file.name, 'skip', { c: job.skip }); continue; }
      const node = { name: file.name, type: 'file', size: file.size, mtime: Date.parse(file.backupAt) || null };
      await this.engine.run(['dump', file.selector, '/' + file.name], { consumeStdout: s => this.writeFile(s, { original, name: file.name, size: node.size, mtime: node.mtime, target: job, check: job.check }) });
    }
    await this.ledger.write({ t: 'done', o: original }, true);
  }
  async single(folder, selector, node, job) {
    if (!job) return;
    if (job.skip) return this.record(folder.original, node.name, 'skip', { c: job.skip });
    await this.engine.run(['dump', selector, '/' + node.name], { consumeStdout: s => this.writeFile(s, { original: folder.original, name: node.name, size: node.size, mtime: node.mtime, target: job, check: job.check }) });
  }
  /** Lists the old device's folders, chooses their defaults and checks the space per volume. */
  async prepare() {
    const base = path.join(this.engine.stateDir, 'move-check');
    const plans = await this.engine.restorePlans(null, { base, host: this.from, readList: readMoveList });
    const fps = plan.folderPlans(plans.map(p => p.original), { old: this.old, now: this.now });
    this.folders = plans.map((p, i) => ({ ...p, listing: p.manifest, fp: fps[i] }));
    return this.folders;
  }
  /** The plan the 「자리 고르기」 screen shows: each folder's default, counts, bytes and the space per volume. */
  async preview() {
    const folders = this.folders || await this.prepare();
    const items = [];
    const out = folders.map(f => {
      const mode = this.choices[f.original]?.mode || f.fp.mode;
      let files = 0, bytes = 0;
      for (const n of [...f.listing.nodes.values(), ...f.listing.aside.values()]) {
        if (n.type !== 'file' || mode === 'skip' || SETTLED.has(this.done.get(fileKey(f.original, n.name)))) continue;
        const job = this.target(f, n.name); if (job.skip) continue;
        files++; bytes += n.size; items.push({ path: job.path, size: n.size });
      }
      return { original: f.original, label: f.fp.label, mode, modes: f.fp.modes, why: f.fp.why, destination: f.fp.destination, newFolder: f.fp.newFolder,
        sameDrive: f.fp.sameDrive, files, bytes, skipped: f.listing.skipped.length, backupAt: f.backupAt };
    });
    const volumes = plan.space(items);
    const free = await this.host('folders.free', [volumes.map(v => v.volume)]).catch(() => volumes.map(() => null));
    volumes.forEach((v, i) => { v.free = free[i]; v.enough = typeof free[i] === 'number' ? free[i] >= v.bytes : null; });
    return { folders: out, volumes, bytes: out.reduce((n, f) => n + f.bytes, 0), files: out.reduce((n, f) => n + f.files, 0) };
  }
  /** Runs (or resumes) the move. Returns the counts and the items that are not plain 「되살림」 or 「이미 있음」. */
  async run() {
    const resumed = await this.resume();
    await this.ledger.open();
    try {
      const folders = this.folders || await this.prepare();
      const view = await this.preview();
      if (view.volumes.some(v => v.enough === false)) throw new Error('되살릴 파일을 놓을 공간이 부족합니다. 다른 자리를 골라 주세요.');
      this.total = view.bytes;
      if (!resumed.lines) await this.ledger.write({ t: 'head', v: 1, moveId: this.moveId, from: this.from, at: new Date().toISOString(),
        folders: folders.map(f => ({ original: f.original, snapshot: f.selector.split(':')[0], mode: this.choices[f.original]?.mode || f.fp.mode })) }, true);
      for (const f of folders) {
        if (this.folderDone.has(f.original.toLowerCase())) continue;
        const mode = this.choices[f.original]?.mode || f.fp.mode;
        if (mode === 'skip') { await this.ledger.write({ t: 'done', o: f.original, skipped: true }, true); this.folderSkips.set(f.original.toLowerCase(), { original: f.original }); continue; }
        for (const s of f.listing.skipped) await this.record(f.original, s.name, 'skip', { c: s.reason });
        await this.folder(f);
      }
      const { items, ...summary } = this.summary(resumed.removedTemp);
      await this.ledger.write({ t: 'end', at: new Date().toISOString(), summary }, true);
      return { ...summary, items };
    } finally { await this.ledger.close(); }
  }
}

module.exports = { Move, readMoveList, Ledger, HIDDEN_NAMES, UNFINISHED };
