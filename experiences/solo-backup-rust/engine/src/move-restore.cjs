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
/** 화면 세션 E11: the results of a finished move a new run of it takes over without fetching the file again (carryOver). */
const CARRY = new Set(['placed', 'same', 'side', 'onedrive']);
/** How far the time on the disk may be from the one written down: FAT keeps two seconds. */
const CARRY_TIME_MS = 2000;
/** What one file fetched on its own is reckoned to cost (a restic start and its index), in the bytes a folder stream
 *  would carry in that time: a top folder with few files left is fetched file by file when that is less (folder). */
const SINGLE_BYTES = 256 * 1024 * 1024;
const idOk = id => typeof id === 'string' && /^[0-9a-f]{8,32}$/.test(id);
const tempRe = id => new RegExp(`^~synk-${id}-(\\d{1,9})\\.part$`);
/** A file of a folder in the ledger: the folder as Windows compares it, the name exactly (GPT GB3: `A.txt` and the
 *  `a.txt` the listing set aside are two files). */
const fileKey = (original, name) => original.toLowerCase() + '\u0000' + name;
/** What leaves the old device's backup the only copy of something: the move is not 「complete」 then (4.6). */
const UNFINISHED = ['fail', 'skip', 'side', 'same-unverified', 'folder-skip'];

/** Skips under a skipped folder carry its reason. The names are compared exactly (카본 끝판 D7): a skipped link `Docs`
 *  is not the real folder `docs` the backup also holds. */
function aboveSkipped(skippedDirs, name) {
  const parts = name.split('/');
  for (let i = 1; i < parts.length; i++) { const r = skippedDirs.get(parts.slice(0, i).join('/')); if (r) return r; }
  return null;
}
/** Whether `name` is under one of `dirs` (exact names). */
function underAny(dirs, name) {
  if (!dirs.size) return false;
  const parts = name.split('/');
  for (let i = 1; i < parts.length; i++) if (dirs.has(parts.slice(0, i).join('/'))) return true;
  return false;
}
/**
 * A listing for the move (4.6): like restore-tar's readManifest, but links, special nodes, names Windows cannot hold
 * and what is under them are kept aside with a reason instead of stopping the folder; a second name that differs only
 * by case goes to `aside` (it is put in 「따로 둔 것」 under its own name, review M19). Nodes carry `mtime` (ms).
 * 화면 세션 E25: past a million names the folder is not refused but marked `tooBig` with nothing in it — the move leaves
 * it out (its backup stays the only copy) and the other folders still come. The listing is read to its end, so restic
 * finishes as usual. `options.max` is for the tests (restorePlans passes its own second argument, never this).
 */
async function readMoveList(input, options) {
  const max = Number.isSafeInteger(options?.max) ? options.max : MAX_NODES;
  const nodes = new Map(), aside = new Map(), skipped = [], skippedDirs = new Map(), merged = new Set(), asideDirs = new Set();
  let bytes = 0, pending = '', snapshots = 0, tooBig = false;
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
    if (tooBig) return;
    if (nodes.size + aside.size + skipped.length >= max) {
      tooBig = true; nodes.clear(); aside.clear(); skipped.length = 0; skippedDirs.clear(); merged.clear(); asideDirs.clear(); bytes = 0;
      return;
    }
    const above = aboveSkipped(skippedDirs, name);
    const reason = above ? above : !['file', 'dir'].includes(node.type) ? (node.type === 'symlink' ? 'link' : 'special') : !name.split('/').every(plan.safeName) ? 'name' : null;
    if (reason) { skipped.push({ name, type: node.type, reason }); if (node.type === 'dir' || node.type === 'symlink') skippedDirs.set(name, reason); return; }
    const size = node.type === 'dir' ? 0 : node.size;
    if (!Number.isSafeInteger(size) || size < 0 || !Number.isSafeInteger(bytes + size)) throw new Error('복구 목록의 파일 크기를 확인하지 못했습니다.');
    const mtime = Date.parse(node.mtime);
    const entry = { name, type: node.type, size, mtime: Number.isFinite(mtime) ? mtime : null };
    // A folder that differs only by case merges into the first folder (Windows has one folder for both). A second name
    // that is a file, or a folder whose first name is a file (`BUILD` the file, then `build/` — 카본 끝판 D7), goes
    // aside with all that is under it.
    const first = nodes.get(lower);
    if (underAny(asideDirs, name)) aside.set(name, entry);
    else if (!first) nodes.set(lower, entry);
    else if (node.type === 'dir' && first.type === 'dir') merged.add(name);
    else { aside.set(name, entry); if (node.type === 'dir') asideDirs.add(name); }
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
  return { nodes, aside, skipped, skippedDirs, skippedNames: new Set(skipped.map(s => s.name)), merged, bytes, ...(tooBig ? { tooBig: true } : {}) };
}

/** The move ledger (4.6 「장부와 이어받기」): JSON lines, flushed every 50 lines, at folder ends and before each new
 *  folder is written into. */
class Ledger {
  constructor(file) { this.file = file; this.handle = null; this.unsynced = 0; }
  /** The ledger's whole lines, and the byte where they end: what follows (a line cut when the PC stopped) is not one. */
  static async scan(file) {
    let buf; try { buf = await fs.readFile(file); } catch (e) { if (e.code === 'ENOENT') return { lines: [], end: 0, size: 0 }; throw e; }
    const lines = []; let pos = 0, end = 0;
    while (pos < buf.length) {
      const nl = buf.indexOf(10, pos); if (nl < 0) break;
      const text = buf.toString('utf8', pos, nl);
      if (text.trim()) { try { lines.push(JSON.parse(text)); } catch { break; } }
      pos = nl + 1; end = pos;
    }
    return { lines, end, size: buf.length };
  }
  static async read(file) { return (await Ledger.scan(file)).lines; }
  /** Cuts a broken tail off before new lines are added (카본 끝판 D4): otherwise the first new line joins the cut one and
   *  every line after it is lost on the next read. */
  static async repair(file) {
    const { lines, end, size } = await Ledger.scan(file);
    if (end < size) await fs.truncate(file, end);
    return lines;
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
  constructor({ engine, host, from, old, now, choices = {}, moveId, ledgerDir, onProgress = () => {}, carryFrom = null, plans = null }) {
    if (!idOk(moveId)) throw new Error('옮겨 오기 번호가 올바르지 않습니다.');
    // `carryFrom`: the finished move this one takes over from (화면 세션 E11). `plans`: the old device's lists, already
    // read (화면 세션 E8).
    Object.assign(this, { engine, host, from, old, now, choices, moveId, onProgress, carryFrom, plans });
    this.carried = []; this.singleBytes = SINGLE_BYTES;
    this.ledger = new Ledger(path.join(ledgerDir, `${moveId}.jsonl`));
    this.final = new Map(); this.folderSkips = new Map(); this.dirs = new Map(); this.n = 0; this.done = new Map(); this.folderDone = new Set();
    /** Folders an earlier run of this move wrote results for (카본 끝판 D1: this run's own skip lines do not count). */
    this.startedFolders = new Set();
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
    // 화면 세션 E5: an OneDrive file whose content could not be checked is counted on its own too (`unverified`, a part
    // of `onedrive`), so a move that is not complete only for them says why. 화면 세션 E11: so are the files taken over
    // from the last move (`carried`, a part of the results they had there).
    let unverified = 0, carried = 0;
    for (const v of this.final.values()) { if (v.result === 'onedrive' && v.item.u) unverified++; if (v.item.carried) carried++; }
    if (unverified) counts.unverified = unverified;
    if (carried) counts.carried = carried;
    return { counts, items, removedTemp, complete: !unverified && !UNFINISHED.some(r => counts[r]) };
  }
  async record(original, name, result, extra = {}) {
    const k = fileKey(original, name);
    this.done.set(k, result); this.final.set(k, { result, item: { original, name, ...extra } });
    await this.ledger.write({ t: 'f', o: original, n: name, r: result, ...extra });
  }
  /** Reads an earlier ledger of this move and deletes the temporary files it left in the folders it wrote into.
   *  `tidy: false` (the preview) only reads: nothing is cut or deleted. */
  async resume({ tidy = true } = {}) {
    const lines = tidy ? await Ledger.repair(this.ledger.file) : await Ledger.read(this.ledger.file);
    for (const r of lines) {
      if (r.t === 'f' && typeof r.o === 'string' && typeof r.n === 'string' && typeof r.r === 'string') {
        const k = fileKey(r.o, r.n), { t: _t, o: _o, n: _n, r: result, ...extra } = r;
        this.done.set(k, result); this.final.set(k, { result, item: { original: r.o, name: r.n, ...extra } }); this.startedFolders.add(r.o.toLowerCase());
        if (Number.isSafeInteger(r.k) && r.k > this.n) this.n = r.k;
      }
      else if (r.t === 'dir' && typeof r.path === 'string') this.dirs.set(r.path.toLowerCase(), { ok: null, path: r.path });
      else if (r.t === 'done' && typeof r.o === 'string') { this.folderDone.add(r.o.toLowerCase()); if (r.skipped) this.folderSkips.set(r.o.toLowerCase(), { original: r.o, ...(r.tooBig ? { tooBig: true } : {}) }); }
      else if (r.t === 'n' && Number.isSafeInteger(r.k) && r.k > this.n) this.n = r.k;
    }
    if (!tidy) return { lines: lines.length, removedTemp: 0 };
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
    const drop = async () => { if (temp) await this.host('files.discard', [temp]).catch(() => {}); };
    try {
      for await (const chunk of stream) {
        written += chunk.length;
        if (written > size) throw new Error('복구 파일 크기가 기록을 넘습니다.');
        hash.update(chunk); this.bytes += chunk.length;
        if (handle && !failed) { try { await handle.write(chunk); } catch (e) { failed = code(e); } }
      }
      if (written !== size) throw new Error('복구 파일 크기가 기록과 다릅니다.');
    } catch (e) {
      // A stream cut short stops the folder; the open file is closed and its temporary name taken away first (카본 끝판 D5).
      if (handle) await handle.close().catch(() => {});
      await drop(); throw e;
    }
    if (handle) await handle.close().catch(e => { failed ||= code(e); });
    const sha256 = hash.digest('hex');
    if (failed) { await drop(); return this.record(original, name, ready.ok ? 'fail' : 'skip', { c: failed, p: target.path }); }
    try {
      // What reached the disk is what came from the backup.
      if (await hashFile(temp) !== sha256) { await drop(); return this.record(original, name, 'fail', { c: 'MOVE_WRITE_CHANGED', p: target.path }); }
      const at = (mtime ?? Date.now()) / 1000; await fs.utimes(temp, at, at);
      const expect = { size, mtimeMs: Math.round(mtime ?? Date.now()), sha256, hidden: HIDDEN_NAMES.has(path.basename(target.path).toLowerCase()) };
      if (check) {
        const seen = await this.host('files.compare', [{ path: check, ...expect }]);
        if (seen?.match === 'verified' || seen?.match === 'unverified') { await drop(); return this.record(original, name, 'onedrive', { p: check, s: size, h: sha256, ...(seen.match === 'unverified' ? { u: true } : this.times(await this.diskTime(check), mtime)) }); }
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
        // From here the side copy is the temporary file a failure takes away (카본 끝판 D5).
        temp = sideTemp; await fs.utimes(temp, at, at);
        placed = await this.host('files.place', [{ temp: sideTemp, target: path.join(sideDir, path.basename(target.path)), ...expect }]); placed.result = 'side';
      }
      // Put aside is put aside, also when the same content was already there (카본 끝판 D6).
      const result = target.side ? (['placed', 'copy', 'same', 'same-unverified'].includes(placed.result) ? 'side' : placed.result) : placed.result;
      // 화면 세션 E11: the time on the disk of a file left where it goes, so a later run can take it over: the backup's
      // for one placed now, the disk's for one found there with the same content. None for a copy beside.
      const m = placed.result === 'placed' ? expect.mtimeMs : placed.result === 'same' ? await this.diskTime(placed.path) : null;
      return this.record(original, name, result, { p: placed.path, s: size, h: sha256, ...this.times(m, mtime) });
    } catch (e) { await drop(); return this.record(original, name, 'fail', { c: code(e), p: target.path }); }
  }
  /** The ledger's two times (화면 세션 E11): `m` the disk's, `b` the backup's. Both or neither. */
  times(m, b) { return Number.isFinite(m) && Number.isFinite(b) ? { m, b } : {}; }
  async diskTime(p) {
    const seen = await this.host('files.probe', [[p]]).catch(() => null);
    const s = Array.isArray(seen) ? seen[0] : null;
    return s?.kind === 'file' && Number.isFinite(s.mtimeMs) ? s.mtimeMs : null;
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
  /** How a folder is moved: as chosen, else its default; a folder whose listing is too big is not moved (화면 세션 E25). */
  modeOf(folder) { return folder.listing?.tooBig ? 'skip' : this.choices[folder.original]?.mode || folder.fp.mode; }
  target(folder, name, dir = false) {
    const choice = this.choices[folder.original] || {};
    return plan.destination(folder.fp, name, { old: this.old, now: this.now, mode: choice.mode || folder.fp.mode, sameDrive: !!choice.sameDrive, dir });
  }
  /** Where one listed node goes: a second name differing only by case to 「따로 둔 것」 (review M19), the rest by the plan. */
  place(folder, node) {
    if (folder.listing.aside.get(node.name) === node) return { path: path.join(plan.places(this.now).side, '대소문자만 다른 이름', folder.fp.label, ...node.name.split('/')), side: true };
    return this.target(folder, node.name, node.type === 'dir');
  }
  async folder(folder) {
    const { original, selector, listing, extra } = folder;
    this.current = original; // 화면 세션 E7: the folder the progress names
    const wanted = (name, node) => SETTLED.has(this.done.get(fileKey(original, name))) ? null : this.place(folder, node);
    const files = () => [...listing.nodes.values(), ...listing.aside.values()].filter(n => n.type === 'file');
    const left = files().filter(n => !SETTLED.has(this.done.get(fileKey(original, n.name))));
    if (!this.startedFolders.has(original.toLowerCase())) await this.engine.run(['dump', selector, '/', '--archive', 'tar'], { consumeStdout: s => this.extract(s, folder, listing, '', wanted) });
    else {
      // Resume (review M20): the top folders that still have files each as their own stream — by their exact names, so
      // `Src` and `src` are two (카본 끝판 D3) — and the loose files one by one. 화면 세션 E11: a top folder with few
      // files left beside much in place (a finished move started again) gives them one by one, when that costs less
      // than all its bytes again.
      const tops = new Map(); const loose = [];
      for (const n of left) {
        const parts = n.name.split('/');
        if (parts.length === 1) loose.push(n); else { if (!tops.has(parts[0])) tops.set(parts[0], { left: [], bytes: 0 }); tops.get(parts[0]).left.push(n); }
      }
      for (const n of files()) { const t = n.name.includes('/') && tops.get(n.name.split('/')[0]); if (t) t.bytes += n.size; }
      const one = async n => { await this.single(folder, selector, n, wanted(n.name, n)); this.onProgress({ bytes: this.bytes, total: this.total }); };
      if (loose.length > FILE_ROUND) await this.engine.run(['dump', selector, '/', '--archive', 'tar'], { consumeStdout: s => this.extract(s, folder, listing, '', wanted) });
      else {
        for (const [top, t] of tops) {
          if (t.left.length <= FILE_ROUND && t.left.length * this.singleBytes < t.bytes) for (const n of t.left) await one(n);
          else await this.engine.run(['dump', `${selector}/${top}`, '/', '--archive', 'tar'], { consumeStdout: s => this.extract(s, folder, listing, top, wanted) });
        }
        for (const n of loose) await one(n);
      }
      // Folders no stream above went through (empty ones, ones whose files were all placed) are made as well.
      for (const n of [...listing.nodes.values(), ...listing.aside.values()]) if (n.type === 'dir') { const job = wanted(n.name, n); if (job && !job.skip) await this.ensureDir(job.path); }
    }
    for (const file of extra || []) {
      // What this backup could not read, from an earlier one (4.2 「지금 상태」). Its time: that backup's.
      if (SETTLED.has(this.done.get(fileKey(original, file.name)))) continue;
      const job = this.target(folder, file.name);
      if (job.skip) { await this.record(original, file.name, 'skip', { c: job.skip }); continue; }
      const node = { name: file.name, type: 'file', size: file.size, mtime: Date.parse(file.backupAt) || null };
      await this.engine.run(['dump', file.selector, '/' + file.name], { consumeStdout: s => this.writeFile(s, { original, name: file.name, size: node.size, mtime: node.mtime, target: job, check: job.check }) });
      this.onProgress({ bytes: this.bytes, total: this.total });
    }
    // Every listed file has a result before the folder counts as done (카본 끝판 D3): one no stream carried is a failure.
    for (const n of files()) if (!this.done.has(fileKey(original, n.name))) await this.record(original, n.name, 'fail', { c: 'MOVE_NOT_IN_STREAM' });
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
    const plans = this.plans || await this.engine.restorePlans(null, { base, host: this.from, readList: readMoveList });
    this.plans = plans;
    const fps = plan.folderPlans(plans.map(p => p.original), { old: this.old, now: this.now });
    this.folders = plans.map((p, i) => ({ ...p, listing: p.manifest, fp: fps[i] }));
    return this.folders;
  }
  /** The last finished move's ledger (화면 세션 E11). */
  readCarry() { return Ledger.read(path.join(path.dirname(this.ledger.file), `${this.carryFrom}.jsonl`)); }
  /**
   * 화면 세션 E11: a finished move started again takes over what the last one placed instead of fetching it again. A file
   * is taken over only when the last run left it where this run puts it (or found it in OneDrive with its content
   * checked, never one 「내용 확인 못 함」), this run's backup lists it with the size and time the last one had, and it is
   * on this PC now with the size and time the last run saw. A file changed since, a folder going elsewhere now, a copy
   * beside (「(복구본)」) and what the last run could not finish are fetched again. Returns how many; their lines go to
   * the ledger after its head (run). After prepare (and resume), before preview.
   */
  async carryOver() {
    if (!idOk(this.carryFrom) || this.carryFrom === this.moveId || !this.folders) return 0;
    const old = new Map();
    for (const r of await this.readCarry().catch(() => [])) if (r?.t === 'f' && typeof r.o === 'string' && typeof r.n === 'string') old.set(fileKey(r.o, r.n), r);
    if (!old.size) return 0;
    const found = [], taken = new Set();
    for (const folder of this.folders) {
      const mode = this.modeOf(folder);
      if (mode === 'skip' || this.folderDone.has(folder.original.toLowerCase())) continue;
      const files = [...folder.listing.nodes.values(), ...folder.listing.aside.values()].filter(n => n.type === 'file').map(n => [n, () => this.place(folder, n)]);
      for (const file of folder.extra || []) files.push([{ name: file.name, type: 'file', size: file.size, mtime: Date.parse(file.backupAt) || null }, () => this.target(folder, file.name)]);
      for (const [node, where] of files) {
        const k = fileKey(folder.original, node.name), r = old.get(k);
        if (!r || taken.has(k) || this.done.has(k) || !CARRY.has(r.r) || r.u || typeof r.p !== 'string' || r.s !== node.size
          || !Number.isFinite(r.m) || !Number.isFinite(r.b) || r.b !== node.mtime) continue;
        const job = where();
        const at = job.skip ? null : r.r === 'onedrive' ? job.check : job.path;
        if (typeof at === 'string' && at.toLowerCase() === r.p.toLowerCase()) { taken.add(k); found.push({ folder, node, r, k }); }
      }
    }
    if (!found.length) return 0;
    const seen = await plan.probeAll(this.host, found.map(f => f.r.p)).catch(() => null);
    if (!Array.isArray(seen) || seen.length !== found.length) return 0;
    let n = 0;
    for (const [i, { folder, node, r, k }] of found.entries()) {
      const s = seen[i];
      if (s?.kind !== 'file' || s.size !== r.s || !Number.isFinite(s.mtimeMs) || Math.abs(s.mtimeMs - r.m) >= CARRY_TIME_MS) continue;
      const extra = { p: r.p, s: r.s, ...(typeof r.h === 'string' ? { h: r.h } : {}), m: s.mtimeMs, b: r.b, carried: true };
      this.done.set(k, r.r); this.final.set(k, { result: r.r, item: { original: folder.original, name: node.name, ...extra } });
      // Its folder goes by the resume's way: only what is left is fetched.
      this.startedFolders.add(folder.original.toLowerCase());
      this.carried.push({ t: 'f', o: folder.original, n: node.name, r: r.r, ...extra });
      n++;
    }
    return n;
  }
  /** The plan the 「자리 고르기」 screen shows: each folder's default, counts, bytes and the space per volume. */
  async preview() {
    const folders = this.folders || await this.prepare();
    const items = [];
    const out = folders.map(f => {
      const mode = this.modeOf(f);
      let files = 0, bytes = 0;
      const count = (job, size) => { if (job.skip) return; files++; bytes += size; items.push({ path: job.path, size }); };
      // What this run will still write (카본 끝판 D2): not a folder an earlier run finished, each file where it really
      // goes (a second case name to 「따로 둔 것」), and the files taken from an earlier backup as well.
      if (mode !== 'skip' && !this.folderDone.has(f.original.toLowerCase())) {
        for (const n of [...f.listing.nodes.values(), ...f.listing.aside.values()]) {
          if (n.type !== 'file' || SETTLED.has(this.done.get(fileKey(f.original, n.name)))) continue;
          count(this.place(f, n), n.size);
        }
        for (const file of f.extra || []) if (!SETTLED.has(this.done.get(fileKey(f.original, file.name))) && Number.isSafeInteger(file.size)) count(this.target(f, file.name), file.size);
      }
      // 화면 세션 E25: a folder too big to list is shown with 「옮기지 않음」 as its only way.
      return { original: f.original, label: f.fp.label, mode, modes: f.listing.tooBig ? ['skip'] : f.fp.modes, why: f.fp.why, destination: f.fp.destination, newFolder: f.fp.newFolder,
        sameDrive: f.fp.sameDrive, files, bytes, skipped: f.listing.skipped.length, backupAt: f.backupAt, ...(f.listing.tooBig ? { tooBig: true } : {}) };
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
      await this.carryOver();
      const view = await this.preview();
      if (view.volumes.some(v => v.enough === false)) throw Object.assign(new Error('되살릴 파일을 놓을 공간이 부족합니다. 다른 자리를 골라 주세요.'), { code: 'MOVE_NO_SPACE' });
      this.total = view.bytes;
      if (!resumed.lines) await this.ledger.write({ t: 'head', v: 1, moveId: this.moveId, from: this.from, at: new Date().toISOString(), ...(this.carried.length ? { carryFrom: this.carryFrom } : {}),
        folders: folders.map(f => ({ original: f.original, snapshot: f.selector.split(':')[0], mode: this.modeOf(f) })) }, true);
      // 화면 세션 E11: what was taken over goes to this ledger too, so a resume and the next run read it here.
      for (const line of this.carried.splice(0)) await this.ledger.write(line);
      for (const f of folders) {
        if (this.folderDone.has(f.original.toLowerCase())) continue;
        const mode = this.modeOf(f), big = f.listing.tooBig ? { tooBig: true } : {};
        if (mode === 'skip') { await this.ledger.write({ t: 'done', o: f.original, skipped: true, ...big }, true); this.folderSkips.set(f.original.toLowerCase(), { original: f.original, ...big }); continue; }
        for (const s of f.listing.skipped) await this.record(f.original, s.name, 'skip', { c: s.reason });
        await this.folder(f);
      }
      const { items, ...summary } = this.summary(resumed.removedTemp);
      await this.ledger.write({ t: 'end', at: new Date().toISOString(), summary }, true);
      return { ...summary, items };
    } finally { await this.ledger.close(); }
  }
}

module.exports = { Move, readMoveList, Ledger, HIDDEN_NAMES, UNFINISHED, CARRY };
