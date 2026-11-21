'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { EventEmitter } = require('node:events');
const { StringDecoder } = require('node:string_decoder');
const { ProcessOutput } = require('./process-output.cjs');
const { extractVerified, readManifest, entryPath } = require('./restore-tar.cjs');
const { directory, overlap, atomic, validateSources } = require('./paths.cjs');
const b2 = require('./b2.cjs');
const { normalizeProtection, schedule, time } = require('./protection.cjs');
const { selectSample, consumeSample, issue: probeIssue } = require('./probe.cjs');
const selection = require('./restore-select.cjs');

const APP = 'solo-work-backup-v1';
const VERIFIED = 'complete-structure-checked';
const DAY = 86400000;
/** Folder paths compare as Windows does, without regard to case. */
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && a.replace(/[\\/]+$/, '').toLowerCase() === b.replace(/[\\/]+$/, '').toLowerCase();
const holds = (snapshot, folder) => Array.isArray(snapshot?.paths) && snapshot.paths.some(p => same(p, folder));
/** Each backed-up folder once, in the order first met. */
const foldersOf = snapshots => snapshots.flatMap(s => Array.isArray(s.paths) ? s.paths : []).filter((p, i, all) => typeof p === 'string' && all.findIndex(q => same(q, p)) === i);
const missingWarning = missing => missing.length ? `백업할 폴더 ${missing.length}개를 찾을 수 없어 그 폴더를 빼고 백업했습니다. 외장 드라이브라면 다시 연결해 주세요. 그 폴더가 든 이전 백업은 지우지 않습니다.` : null;
/** A partial snapshot's list snapshots: the meta ones with its run tag. */
const listsIn = (all, s) => { const run = s.tags.find(t => t.startsWith('run:')); return run ? all.filter(x => x.tags.includes(run) && x.tags.includes('meta')) : []; };
/** A snapshot's run id: the uuid of its `run:` tag, which a tag edit does not change (its snapshot id does). */
const runOf = s => s.tags.find(t => t.startsWith('run:'))?.slice(4) || null;
/** The fill snapshots made for partial snapshot `s` (4.2 「완료본 · 부분 판 · 채움 판」), newest first: tagged fill and
 *  fills:<its run id>, each with exactly one meta snapshot (its link roots and what it was asked to read). */
const fillsIn = (all, s) => { const run = runOf(s); return run ? all.filter(x => x.tags.includes('fill') && x.tags.includes(`fills:${run}`) && listsIn(all, x).length === 1) : []; };
/** Where original path `p` is under a fill's link roots ([{ from: link folder, to: 'C:' }]), or null when its drive had none. */
const linked = (roots, p) => { const r = typeof p === 'string' && roots.find(x => x.to === p.slice(0, 2).toUpperCase()); return r ? r.from.replace(/[\\/]+$/, '') + p.slice(2) : null; };
/** The restic subtree of a Windows path: C:\a\b → /C/a/b. */
const subtreeOf = p => '/' + p.replace(/^([A-Za-z]):/, '$1').replaceAll('\\', '/').replace(/\/+$/, '');
/** A fill snapshot's meta as stored (workbackup-fill.json), or an error: the link roots it read through and, as original
 *  paths, what it was asked to read and what it could not. `fills` is the run id of the partial snapshot it fills. */
function checkFill(info) {
  const abs = p => typeof p === 'string' && /^[A-Za-z]:\\/.test(p) && p.length <= 32767;
  if (info?.v !== 1 || typeof info.fills !== 'string' || !/^[0-9a-f-]{36}$/.test(info.fills) || !Array.isArray(info.roots) || !info.roots.length || info.roots.length > 26
    || info.roots.some(r => !abs(r?.from) || typeof r?.to !== 'string' || !/^[A-Z]:$/.test(r.to)) || new Set(info.roots.map(r => r.to)).size !== info.roots.length
    || !Array.isArray(info.asked) || !Array.isArray(info.failed) || info.asked.some(p => !abs(p)) || info.failed.some(p => !abs(p)) || typeof info.cut !== 'boolean')
    throw new Error('채움 백업 기록의 형식을 확인하지 못했습니다.');
  return info;
}
/** Where `item` (a path restic reported) is inside `folder`, with forward slashes; null when it is not inside. */
const inside = (folder, item) => {
  const base = folder.replace(/[\\/]+$/, '');
  if (typeof item !== 'string' || item.length <= base.length + 1 || item.slice(0, base.length).toLowerCase() !== base.toLowerCase() || !/[\\/]/.test(item[base.length])) return null;
  return item.slice(base.length + 1).replace(/[\\/]+/g, '/').replace(/\/$/, '') || null;
};
/** A path from restic's error lines as Windows writes it: `/E/pics` → `E:\pics`, `/E` → `E:\` (4.4 r5 GA6). */
const winItem = p => { const m = typeof p === 'string' && /^\/([A-Za-z])(\/.*)?$/.exec(p); return m ? `${m[1].toUpperCase()}:\\` + (m[2] || '').slice(1).replaceAll('/', '\\') : p; };
/** `item` (either form) as seen from `folder`: '' when it is the folder or holds it — a drive root, a folder above —
 *  so the whole folder (4.4 r7 GA3 · GA4); its path inside when inside; null when neither. */
const asSeen = (folder, item) => {
  const w = winItem(item);
  if (typeof w !== 'string') return null;
  const trim = p => p.replace(/[\\/]+$/, '').toLowerCase();
  return trim(w) === trim(folder) || inside(w, folder) !== null ? '' : inside(folder, w);
};
/** A partial snapshot's list as stored (workbackup-unreadable.json), or an error. */
function checkList(list) {
  if (list?.v !== 1 || !Array.isArray(list.unreadable) || list.unreadable.some(p => typeof p !== 'string') || typeof list.cut !== 'boolean') throw new Error('읽지 못한 파일 목록의 형식을 확인하지 못했습니다.');
  return list;
}
/** `rel` (inside a folder, forward slashes) is one of `blind` (lower-cased) or under one of them. */
const covered = (blind, rel) => { if (blind.has('')) return true; const parts = rel.toLowerCase().split('/'); for (let i = 1; i <= parts.length; i++) if (blind.has(parts.slice(0, i).join('/'))) return true; return false; };
/** Something under `rel` is in `blind`. */
const unreadUnder = (blind, rel) => { const k = rel.toLowerCase() + '/'; for (const b of blind) if (b.startsWith(k)) return true; return false; };
/** A snapshot whose folder list a restore can follow: 1 to 30 plain Windows folders. */
const sanePaths = s => Array.isArray(s.paths) && s.paths.length && s.paths.length <= 30 && !s.paths.some(p => typeof p !== 'string' || !/^[A-Za-z]:[\\/]/.test(p) || p.split(/[\\/]/).some(part => part === '..' || part === '.'));
/** 「지금 상태」 (4.2): the backup each folder is restored from — the newest complete one that holds it, or a newer
 *  partial one whose list is whole and does not say the folder itself could not be read; a folder no complete one
 *  holds comes from the newest partial one that does. The same per-folder choice retain() keeps (GPT GA1, 끝판 카본
 *  nowstate A2 · A3). `complete` and `listed` newest first; `listOf(s)` reads a partial one's list. */
async function restoreBases(latest, complete, listed, listOf) {
  const sets = [];
  for (const folder of foldersOf([latest, ...complete, ...listed])) {
    const c = complete.find(s => holds(s, folder)), p = listed.find(s => holds(s, folder));
    let snapshot = c, cut = false;
    if (p && (!c || Date.parse(p.time) > Date.parse(c.time))) {
      const list = await listOf(p), unknown = list.cut || list.unreadable.some(item => same(item, folder));
      if (!c) { snapshot = p; cut = unknown; } else if (!unknown) snapshot = p;
    }
    sets.push({ snapshot, original: folder, cut });
  }
  return sets;
}
/** 「지금 상태」 (4.2): of the paths a backup could not read (`wanted`, inside its folder; `manifest` is what it holds),
 *  what comes from the earlier backups `seen` (newest first: { selector, at, cut, blind, had | load() } — `blind` what
 *  that one could not read itself; a listing is read only when needed). File by file, the first earlier backup that
 *  has the file gives it; the first that could read where it would be and does not have it shows it was gone by then,
 *  so no older copy comes back — nor an older folder of that name (끝판 카본 A4). A folder it could not read is
 *  gathered the same way, file by file (GPT GA2), from the earlier ones down to the first that read all of it (끝판 A1).
 *  A path under one that is a file is left out — the folder became a file (끝판 A4). A path no backup has is in `notFound`. */
async function gatherEarlier(wanted, manifest, seen) {
  const extra = [], notFound = [], folders = [], taken = new Set(), skipped = new Map();
  const had = async e => (e.had ??= await e.load());
  // What an earlier backup left out — a link, a special node, a name Windows cannot hold — where it is looked for is
  // left out of this restore too and said with it, as the newest backup's own (GPT workbackup-fill GA2).
  let skippedCut = false;
  const note = (h, wantedName) => {
    if (h.skipped?.cut) skippedCut = true;
    for (const item of h.skipped?.list || []) { const k = item.name.toLowerCase(); if (wantedName(k) && !manifest.nodes.has(k) && !skipped.has(k)) skipped.set(k, item); }
  };
  const could = (e, rel) => !e.cut && !covered(e.blind, rel);
  // A fill (`only`: what it was asked to read) knows nothing of the rest: past it, as if it were not there.
  const knows = (e, rel) => !e.only || covered(e.only, rel);
  const first = async rel => {
    for (const e of seen) {
      if (!knows(e, rel)) continue;
      const node = (await had(e)).nodes.get(rel.toLowerCase());
      if (node) return { e, node };
      if (could(e, rel)) return null;
    }
    return null;
  };
  const take = async rel => {
    const k = rel.toLowerCase(), got = await first(rel);
    if (got?.node.type !== 'file') return false;
    if (!taken.has(k) && !manifest.nodes.has(k)) { taken.add(k); extra.push({ selector: got.e.selector, name: got.node.name, size: got.node.size, backupAt: got.e.at }); }
    return true;
  };
  for (const rel of wanted) {
    const k = rel.toLowerCase();
    if (manifest.nodes.get(k)?.type === 'file') continue;
    const kind = (await first(rel))?.node.type;
    if (kind === 'dir') {
      folders.push(rel);
      const files = new Set();
      for (const e of seen) {
        if (!knows(e, rel) && !unreadUnder(e.only, rel)) continue;
        const h = await had(e);
        for (const n of h.nodes.values()) if (n.type === 'file' && n.name.toLowerCase().startsWith(k + '/')) files.add(n.name);
        note(h, name => name.startsWith(k + '/'));
        if (knows(e, rel) && could(e, rel) && !unreadUnder(e.blind, rel)) break;
      }
      for (const file of files) await take(file);
    } else if (!kind || !(await take(rel))) {
      // A path an earlier backup holds as a link is left out, not 「in no backup」.
      for (const e of seen) if (e.had) note(e.had, name => name === k);
      if (!skipped.has(k)) notFound.push(rel);
    }
  }
  const fileNames = new Set([...manifest.nodes.values()].filter(n => n.type === 'file').map(n => n.name.toLowerCase()).concat(extra.map(e => e.name.toLowerCase())));
  const under = name => { const parts = name.toLowerCase().split('/'); for (let i = 1; i < parts.length; i++) if (fileNames.has(parts.slice(0, i).join('/'))) return true; return false; };
  // A name some earlier backup gave back as a file is restored, not left out, whatever an older one held there (GPT
  // workbackup-fill-b GA1).
  return { extra: extra.filter(e => !under(e.name)), notFound, folders, skipped: [...skipped].filter(([k]) => !taken.has(k)).map(([, item]) => item), ...(skippedCut ? { skippedCut: true } : {}) };
}
/** The run record's count of folders not found, when there were any. */
const gone = n => n > 0 ? { missing: n } : {};
/** A run result's count of names its backup could not hold (4.2 「이 백업에 담지 못하는 이름」). */
const oddOf = n => n > 0 ? { odd: n } : {};
// The thresholds of 4.4 (처음 문턱, to be tuned by T17): files removed (30 % and 200), files changed (50 % and 200), bytes
// removed (30 % and 1 GiB); `list` is how many names a hold keeps for the 「지워진 파일」 screen.
// `compare`: backups compared in one clean-up (the rest wait for the next); `typed`: type changes whose files are counted.
const MASS = Object.freeze({ files: 200, removedShare: 0.3, changedShare: 0.5, bytes: 1024 ** 3, list: 500, compare: 6, ask: 300 });
/** How long a folder taken out of the backup keeps its backups (4.2 「폴더 더하기 · 빼기」). */
const REMOVED_KEEP = 30 * DAY;
/** Fills are at most one in 4 hours — 6 a day — and the runs between stay partial (4.2 「채움의 비용」). */
const FILL_SPACING = 4 * 3600000;
/** A taken-out folder's entry in the settings: its path, when it was taken out, and — once a cleanup has seen it —
 *  that cleanup's time (`since`), from which the 30 days count. */
const adoptedMark = (a) => !!a && typeof a === 'object' && (a.from === null || (typeof a.from === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(a.from)))
  && typeof a.fromUndo === 'boolean' && typeof a.lost === 'boolean';
const removedEntry = r => typeof r?.path === 'string' && Number.isFinite(Date.parse(r.at)) && (r.since === undefined || Number.isFinite(Date.parse(r.since)));
/** Unreadable items kept for a partial snapshot's list; past this the list says it is cut short. */
const UNREADABLE_MAX = 200000;
/** How many unreadable paths are opened to see which another program holds (4.2 step 8). */
const LOCK_CHECK_MAX = 1000;
/** The drives of the paths a backup could not read that another program still holds open without sharing — Windows
 *  sharing or lock violation (32 · 33), which Node reports as EBUSY (4.2 step 8 · 9). Only those a shadow copy can read:
 *  a file the person may not read stays unreadable through a shadow copy too, and one free again goes into the next
 *  backup, so neither asks the helper for a copy. */
async function lockedVolumes(items) {
  const out = new Set();
  for (const item of items.slice(0, LOCK_CHECK_MAX)) {
    if (typeof item !== 'string' || !/^[A-Za-z]:\\/.test(item)) continue;
    const volume = item.slice(0, 2).toUpperCase();
    if (out.has(volume)) continue;
    try { const handle = await fs.open(item, 'r'); await handle.close(); }
    catch (e) { if (e.code === 'EBUSY') out.add(volume); }
  }
  return [...out].sort();
}
/** restic's JSON error lines, however they are split into chunks: each `item` goes to onItem with the step it was met
 *  in (`during`: scan, archival). A line past 4 MB is not held — onItem(null) says an item may be lost, so the list is
 *  marked cut (GPT GA4). */
function errorItems(onItem) {
  let rest = '';
  const lines = text => {
    const all = (rest + text).split('\n'); rest = all.pop();
    if (rest.length > 4194304) { rest = ''; onItem(null); }
    for (const line of all) { let m = null; try { m = JSON.parse(line); } catch { } if (m?.message_type === 'error' && typeof m.item === 'string' && m.item) onItem(m.item, typeof m.during === 'string' ? m.during : null); }
  };
  return { push: lines, end: () => lines('\n') };
}
/** A name Windows cannot open as it is written: one ending in a dot or a space. Windows drops those ends from a path, so
 *  restic 0.19.1 asks for another name: with none there, the file is left out and told only while counting (`scan`), and
 *  the run still ends with 0; with the name without its ends there, that one's content is saved under this name, with no
 *  error (4.2 「이 백업에 담지 못하는 이름」, measured 11-20). restic stops counting once the backup is saved, so what it
 *  tells is not every one (GPT GA2): the engine also reads the folders through for them (walkOdd). */
const oddName = p => typeof p === 'string' && /[. ]$/.test(p) && !/(^|[\\/])\.\.?$/.test(p);
/** How many of those names the state lists — at most 1,000 and 32,768 characters in all, since the window's state and its
 *  profile summary both carry the list (GPT GA1); past it the count goes on. */
const ODD_KEEP = 1000, ODD_LIST_CHARS = 32768;
/** The first of `names` the state lists (ODD_KEEP · ODD_LIST_CHARS). */
function oddList(names) {
  const out = []; let chars = 0;
  for (const p of names) { if (out.length >= ODD_KEEP || chars + p.length > ODD_LIST_CHARS) break; out.push(p); chars += p.length; }
  return out;
}
/** The file in the state folder that holds each such name found, apart from the settings (설계 검토 기록 3), so a walk
 *  that does not get through can look at each found before (GPT GA2 · GA6): as many as a walk keeps (UNREADABLE_MAX),
 *  written when they change and before the settings that point at it (`leftOutHeld = { id, count, cut }`). Not in the
 *  window's state. 50,000,000 characters at most, well under what one JSON string can be (r4 GA4); past it, `cut`. */
const ODD_FILE = 'left-out-names.json', ODD_HOLD_CHARS = 50000000;
/** Every backup reads the folders through for those names (설계 검토 기록 1 F1: restic tells none beside the name
 *  without its end). A walk stops at 10 minutes (`checked` false); the next backup's begins anew. Two folders are read
 *  at a time, so one that never answers (a share gone) leaves the other file work its threads (F6; measured 11-21:
 *  189,133 folders in 14 to 19 seconds with two, 12 to 17 with eight, once read). Looking again at the names found
 *  before stops at 30 seconds (GPT GA4), and so does a walk that gets no place to read in (설계 검토 기록 2 F2). */
const ODD_WALK_BUDGET = 10 * 60000, ODD_LOOK_BUDGET = 30000, ODD_SLOT_WAIT = 30000, ODD_READERS = 2;
/** The reads for those names not answered yet, of every walk and look in this process — one profile's after another's
 *  too (GPT GA5): ODD_READERS at most, a read left behind at a deadline still holding its place until it answers. */
const oddReads = new Set();
/** Those waiting for a place to free: each told once, then gone — nothing is hung on a read left behind (r3 GA2). */
let oddWaiting = new Set();
/** `read()` once it holds a place in oddReads; what it gives. */
function oddRead(read) {
  const t = Promise.resolve().then(read);
  const place = t.then(() => {}, () => {}).finally(() => { oddReads.delete(place); const told = oddWaiting; oddWaiting = new Set(); for (const f of told) f(true); });
  oddReads.add(place);
  return t;
}
/** Whether a place frees before `deadline` (epoch ms). */
function placeFreed(deadline) {
  return new Promise(res => {
    const told = ok => { clearTimeout(timer); oddWaiting.delete(told); res(ok); };
    const timer = setTimeout(() => told(false), Math.max(0, deadline - Date.now())); timer.unref?.();
    oddWaiting.add(told);
  });
}
/** Whether one of `waits` settles before `deadline` (epoch ms). */
async function settles(waits, deadline) {
  let timer;
  const r = await Promise.race([...waits.map(w => Promise.resolve(w).then(() => true, () => true)), new Promise(res => { timer = setTimeout(() => res(false), Math.max(0, deadline - Date.now())); timer.unref?.(); })]);
  clearTimeout(timer);
  return r;
}
/** A name as compared: the slash used aside, case and all — a folder may tell `A.` from `a.` (GPT GA3). */
const nameKey = p => p.replace(/[\\/]+/g, '/').replace(/\/$/, '');
/** A name as Windows finds it in a folder that tells no case apart (r2 GA3). */
const caseKey = p => nameKey(p).toLowerCase();
/** Each path once and none inside another: a folder left out says what it holds. Sorted. */
function topMost(paths) {
  const keys = new Set(), out = [];
  for (const p of [...new Set(paths)].sort((a, b) => a.length - b.length)) {
    const parts = nameKey(p).split('/');
    if (parts.some((_, i) => i > 0 && keys.has(parts.slice(0, i).join('/'))) || keys.has(nameKey(p))) continue;
    keys.add(nameKey(p)); out.push(p);
  }
  return out.sort();
}
/** A Windows path in the long form, read as written: past 260 characters too, and with no dot or space dropped from
 *  its end (restic reads the same way). A drive path or a share; anything else as it is. */
const longPath = p => process.platform !== 'win32' ? p : /^[A-Za-z]:\\/.test(p) ? '\\\\?\\' + p : /^\\\\[^\\?.]/.test(p) ? '\\\\?\\UNC\\' + p.slice(2) : p;
/** Every name under `roots` that ends in a dot or a space, topmost only (4.2 「이 백업에 담지 못하는 이름」). Folders are
 *  read, nothing is opened. A link or junction is not followed, as restic does not; a reparse point that is a folder
 *  all the same (a cloud folder) is. A folder that cannot be read is passed over and counted (`failed`): what it holds
 *  is not known (GPT GA5). Stops at `budgetMs` of real time, a folder still being read too (`done` false — GA4), and
 *  keeps `max` names (`more` past it). Folders are read in the places of oddReads. */
async function walkOdd(roots, { budgetMs, max, slotWaitMs = ODD_SLOT_WAIT }) {
  const names = [], queue = [...roots], running = new Set(), deadline = Date.now() + budgetMs, unread = []; let more = false, done = true, failed = 0, unreadCut = false;
  // The folders not read, up to 1,000 of them (`unreadCut` past it): what a walk in time did not see (설계 검토 기록 5 F2).
  const miss = dir => { failed++; if (unread.length < 1000) unread.push(dir); else unreadCut = true; };
  const visit = async dir => {
    // A chosen folder gone while it is walked (a drive pulled out) is one not read; a folder inside, gone, is gone (설계 검토 기록 6 F4).
    let list; try { list = await fs.readdir(longPath(dir), { withFileTypes: true }); } catch (e) { if (e?.code !== 'ENOENT' || roots.includes(dir)) miss(dir); return; }
    for (const e of list) {
      const p = path.join(dir, e.name);
      if (oddName(e.name)) { if (names.length < max) names.push(p); else more = true; continue; }
      if (e.isDirectory()) queue.push(p);
      else if (e.isSymbolicLink()) { try { if ((await fs.lstat(longPath(p))).isDirectory()) queue.push(p); } catch (err) { if (err?.code !== 'ENOENT') miss(p); } }
    }
  };
  while (queue.length || running.size) {
    if (Date.now() >= deadline) { done = false; break; }
    while (queue.length && oddReads.size < ODD_READERS) { const dir = queue.pop(), t = oddRead(() => visit(dir)).finally(() => running.delete(t)); running.add(t); }
    // A folder still being read when the time is up is not waited for: it goes on alone, and what it finds is not used.
    // A place an earlier walk's read still holds is waited for the same way (r2 GA5) — with none of this walk's own
    // reads going, for slotWaitMs at most (설계 검토 기록 2 F2).
    if (!await placeFreed(running.size ? deadline : Math.min(deadline, Date.now() + slotWaitMs)) && !running.size) { done = false; break; }
  }
  // A chosen folder gone by the end — a drive pulled out while it was walked — is one not read, whatever was read below
  // it: what was not found there was not looked for (설계 검토 기록 7 F2).
  if (done) {
    const there = await stillThere(roots, deadline);
    if (!there.done) done = false;
    for (const r of roots) if (!there.names.includes(r) && !unread.includes(r)) miss(r);
  }
  return { names: names.slice(), more, done, failed, unread: unread.slice(), unreadCut };
}
/** Of `paths`, those still there under that very name — read as written, with no end dropped. Only "not there" lets
 *  one go: one that cannot be looked at (EACCES and the like) stays (설계 검토 F5), and so does each not looked at by
 *  `deadline` (r2 GA4 — `done` false). One at a time, in a place of oddReads. */
async function stillThere(paths, deadline) {
  const out = [];
  for (let i = 0; i < paths.length; i++) {
    // None begun past the deadline (설계 검토 기록 3 F3).
    if (Date.now() >= deadline) return { names: out.concat(paths.slice(i)), done: false };
    while (oddReads.size >= ODD_READERS) if (!await placeFreed(deadline)) return { names: out.concat(paths.slice(i)), done: false };
    const look = oddRead(() => fs.lstat(longPath(paths[i])));
    if (!await settles([look], deadline)) return { names: out.concat(paths.slice(i)), done: false };
    try { await look; out.push(paths[i]); } catch (e) { if (e?.code !== 'ENOENT' && e?.code !== 'ENOTDIR') out.push(paths[i]); }
  }
  return { names: out, done: true };
}
/** Which file `p` is (its volume and number, read as written), by `deadline`; null when that cannot be told. */
async function fileId(p, deadline) {
  if (Date.now() >= deadline) return null;
  while (oddReads.size >= ODD_READERS) if (!await placeFreed(deadline)) return null;
  const r = oddRead(() => fs.lstat(longPath(p), { bigint: true }));
  if (!await settles([r], deadline)) return null;
  try { const st = await r; return st.ino ? `${st.dev}:${st.ino}` : null; } catch { return null; }
}
/** The notice of what a backup could not hold for its name (4.2 「이 백업에 담지 못하는 이름」). */
const oddWarning = o => o?.count > 0 ? `이름 끝에 점이나 칸이 있는 파일이나 폴더 ${o.count}${o.cut ? '개 이상을' : '개를'} 이번 백업에 담지 못했습니다.${o.checked === false ? ' 이번에는 폴더를 다 보지 못해 더 있을 수 있습니다.' : ''} Windows에서는 이런 이름을 백업할 수 없습니다. 이름을 바꾸면 다음 백업에 담깁니다.` : null;
// Exit 11 (another process holds the repository lock) is shown as this notice, not as an error;
// the next operation that succeeds clears it (review B2).
const BUSY_WARNING = '다른 작업이 백업 저장소를 쓰는 중이라 이번 작업은 하지 못했습니다. 잠시 뒤 다시 해 주세요. 자동 백업은 다음 회차에 다시 합니다.';
const RESTIC_SHA256 = 'b0dd1fd21eea5d8fe1325f55f7118213c21f36de8a261e04c0624a5ab9fd7830';
const isId = s => typeof s === 'string' && /^[a-f0-9]{64}$/.test(s);
// 모르는 꼬리표의 판(STAGE1_DESIGN.md 4.15 · T33): 이 판의 엔진이 아는 꼬리표는 이것뿐이다. 모르는 꼬리표가 하나라도 붙은 판은 나중
// 판의 엔진이 만든 것(공간 비우기 나 등급의 `cloud-only` 고정 판 따위)일 수 있어, 지우지도 고르지도 않는다. 엔진의 판 목록(snapshots)과
// 복구 키 · 계정으로 잇는 두 목록에서 빼므로, 정리의 모든 길(매 회차 정리 · 다른 기기 판 정리 · 폴더 빼기 30일)은 그 판을 지울 판으로
// 보지 못하고(정리는 목록에서 고른 번호만 forget한다), 고르는 자리(가장 새 확인된 판 · 폴더별 지킬 판 · 「지금 상태」 되살리기 · 파일
// 골라 되살리기 · 되살리기 증명 · 대량 변경 비교)는 그 판을 고르지 않는다.
const KNOWN_TAGS = new Set([APP, VERIFIED, 'pending', 'meta', 'partial', 'fill', 'movekit', 'recommended-verified-v1']);
const KNOWN_TAG = /^(vault|run|fills):[a-f0-9-]{36}$/;
const knownTags = s => Array.isArray(s?.tags) && s.tags.every(t => KNOWN_TAGS.has(t) || KNOWN_TAG.test(t));
const json = s => JSON.parse(s.replace(/^\uFEFF/, ''));
// Stream the pinned restic (31 MB) instead of reading it whole, and verify a
// given file once per process (keyed by path, size and mtime so a swapped file
// is checked again). Every engine (local · cloud · recommended) used to read the
// whole binary into memory on open — the T7 preliminary saw the worker peak at
// 134 MB largely from that (STAGE1_DESIGN.md 4.3).
const verifiedBinaries = new Map();
// The folder a restore goes into at the place the window chose by itself (화면 세션 부탁 2 「다운로드 › 되살린 파일 (11월
// 13일)」): today's name on this PC's calendar, or that name with 2, 3 … when it is there already — never an existing folder.
async function namedFolder(base, now) {
  const d = new Date(now), name = `되살린 파일 (${d.getMonth() + 1}월 ${d.getDate()}일)`;
  for (let i = 1; i < 100; i++) {
    const target = path.join(base, i === 1 ? name : `${name} ${i}`);
    try { await fs.mkdir(target); return target; } catch (e) { if (e.code !== 'EEXIST') throw e; }
  }
  throw new Error('되살린 파일을 놓을 새 폴더를 만들지 못했습니다.');
}
// Jobs whose failure is written apart from the backups' (lastError): a restore's, and 「새 PC로 옮겨 오기」's (4.6).
const OWN_ERROR = { restore: 'lastRestoreError', move: 'lastMoveError' };
// 옮겨 오기 writes into a temporary file beside its final name (move-restore.cjs): one left by a move that stopped is
// never backed up (4.6 — the next move removes it).
const MOVE_TEMP = '~synk-*.part';
async function sha256File(file) {
  const hash = crypto.createHash('sha256');
  const handle = await fs.open(file, 'r');
  try { const buffer = Buffer.allocUnsafe(1 << 20); for (;;) { const { bytesRead } = await handle.read(buffer, 0, buffer.length, null); if (!bytesRead) break; hash.update(buffer.subarray(0, bytesRead)); } }
  finally { await handle.close(); }
  return hash.digest('hex');
}
async function verifyRestic(file) {
  const stat = await fs.stat(file); const key = `${path.resolve(file)}|${stat.size}|${stat.mtimeMs}`;
  if (verifiedBinaries.get(key) === true) return;
  if (await sha256File(file) !== RESTIC_SHA256) throw new Error('백업 엔진 파일 검증에 실패했습니다. 배포본을 다시 받아 주세요.');
  verifiedBinaries.set(key, true);
}
// A customer repository of the provisioning server (c/<customer>/r, STAGE1_DESIGN.md 4.5) is shared by every device of
// that customer, so its vault tag is made from the repository itself: a new PC that opens it from the account envelope
// finds the old PC's backups under the same tag, and the restic host name — the device number — tells the devices
// apart (4.6 「호스트 = 이 기기」). The shape is a version-4 UUID, like the random vault of a repository made here.
function customerVault(prefix) {
  const h = crypto.createHash('sha256').update(`solo-work-backup-vault\0${prefix}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${'89ab'[parseInt(h[16], 16) & 3]}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
// The device number the provisioning server gives (12 lowercase letters and digits).
const DEVICE = /^[a-z0-9]{12}$/;
// Restic's exit codes for a repository that is not there and for a wrong password (0.17+).
const NO_REPOSITORY = 10, WRONG_PASSWORD = 12;
function parseKit(text) {
  if (typeof text !== 'string' || Buffer.byteLength(text) > 65536) throw new Error('복구 키 파일을 읽을 수 없습니다.');
  const kit = json(text);
  if (kit.format !== APP || !isId(kit.repositoryId) || !/^[a-f0-9-]{36}$/.test(kit.vaultId) || !/^[A-Za-z0-9_-]{43}$/.test(kit.password) || !((kit.version === 1 && kit.type === 'local') || (kit.version === 2 && kit.type === 'b2'))) throw new Error('이 앱에서 만든 복구 키 파일이 아닙니다.');
  if (kit.type === 'b2') {
    kit.provider = b2.provider(kit.provider, kit.vaultId);
    if (kit.repository !== b2.repository(kit.provider, kit.vaultId)) throw new Error('클라우드 복구 키의 저장소 경로가 일치하지 않습니다.');
  }
  return kit;
}
class BackupEngine extends EventEmitter {
  constructor({ stateDir, workDir = null, resticPath, secretStore, runner = null, now = () => Date.now(), intervalMs = 900000, providerType = 'local', forbiddenPaths = [], probe = b2.probeBucket }) {
    super();
    this.stateDir = path.resolve(stateDir); this.resticPath = resticPath; this.secretStore = secretStore;
    // restic's cache and temporary files: a separate local folder when the host gives one
    // (%LOCALAPPDATA%\SynkWorkBackup — STAGE1_DESIGN.md 5.1), else inside the state folder.
    this.workDir = workDir ? path.resolve(workDir) : null;
    this.runner = runner; this.now = now; this.intervalMs = intervalMs;
    this.providerType = providerType; this.cloudCredentials = null; this.connection = null; this.transientSecrets = []; this.probe = probe; this.forbiddenPaths = forbiddenPaths;
    this.config = null; this.secret = null; this.job = null; this.child = null; this.stopping = false; this.lastAttempt = 0;
    this.fileCatalog = null;
  }
  async open() {
    await fs.mkdir(this.stateDir, { recursive: true });
    this.stateDir = await directory(this.stateDir);
    if (this.workDir) { await fs.mkdir(this.workDir, { recursive: true }); this.workDir = await directory(this.workDir); }
    else this.workDir = this.stateDir;
    await fs.mkdir(path.join(this.workDir, 'cache'), { recursive: true });
    await fs.mkdir(path.join(this.workDir, 'temp'), { recursive: true });
    if (!this.runner) await verifyRestic(this.resticPath);
    // The stamp is taken before reading: a run that writes in between leaves a newer file
    // than the stamp, so the next reload reads it (review GA2). It is recorded before the
    // credential is opened, so a window waiting for a recovery key does not reopen forever (GA3).
    const stamp = await this.settingsKeyNow();
    try { this.config = json(await fs.readFile(path.join(this.stateDir, 'settings.json'), 'utf8')); }
    catch (e) { if (e.code !== 'ENOENT') throw new Error('설정 파일이 손상되었습니다. 복구 키로 별도 PC에서 복구할 수 있습니다.'); }
    if (this.config) {
      const c = this.config;
      if (c.schema !== 1 || !['backup', 'restore'].includes(c.mode) || !/^[a-f0-9-]{36}$/.test(c.vaultId) || !Array.isArray(c.sources) || (c.repositoryId !== null && !isId(c.repositoryId))
        || (c.removedSources != null && !(Array.isArray(c.removedSources) && c.removedSources.every(removedEntry))) || (c.host != null && !DEVICE.test(c.host))
        || (c.serverRestore != null && !(c.serverRestore && typeof c.serverRestore.since === 'string' && (c.serverRestore.jobId === undefined || /^[A-Za-z0-9_-]{1,64}$/.test(c.serverRestore.jobId)) && (c.serverRestore.undo === undefined || typeof c.serverRestore.undo === 'boolean')
          && (c.serverRestore.adopted === undefined || adoptedMark(c.serverRestore.adopted))))
        || (c.restoreReleased != null && !(c.restoreReleased && typeof c.restoreReleased.at === 'string' && (c.restoreReleased.lost === undefined || c.restoreReleased.lost === true)
          && (c.restoreReleased.jobId === undefined ? c.restoreReleased.lost === true : /^[A-Za-z0-9_-]{1,64}$/.test(c.restoreReleased.jobId))))
        || (c.nextSources != null && !(c.mode === 'restore' && Array.isArray(c.nextSources) && c.nextSources.length <= 30 && c.nextSources.every(p => typeof p === 'string')))
        || (c.movedTo != null && !(c.movedTo && typeof c.movedTo.device === 'string' && c.movedTo.device.length <= 64 && typeof c.movedTo.at === 'string'))
        || (c.movePin != null && !(c.movePin && isId(c.movePin.snapshotId) && typeof c.movePin.until === 'string'))) throw new Error('설정 형식이 올바르지 않습니다.');
      normalizeProtection(c);
      if ((c.provider?.type || 'local') !== this.providerType) throw new Error('백업 프로필과 저장소 종류가 다릅니다.');
      if (this.isCloud()) {
        c.provider = b2.provider(c.provider, c.vaultId);
        if (c.repository !== b2.repository(c.provider, c.vaultId)) throw new Error('클라우드 저장소 경로가 일치하지 않습니다.');
        // A customer repository's vault is its own (customerVault) and its backups carry a device number.
        if (b2.customerRepository(c.provider.prefix) && (c.vaultId !== customerVault(c.provider.prefix) || !c.host)) throw new Error('클라우드 저장소 경로가 일치하지 않습니다.');
      } else if (!path.isAbsolute(c.repository)) throw new Error('백업 폴더 경로가 올바르지 않습니다.');
      this.settingsKey = stamp;
      try {
        const value = await this.secretStore.decrypt(await fs.readFile(path.join(this.stateDir, 'credential.bin')));
        if (this.isCloud()) { const envelope = json(value); if (envelope.version !== 2) throw new Error('invalid credential'); this.secret = envelope.password; this.cloudCredentials = b2.credentials(envelope); }
        else this.secret = value;
        if (!/^[A-Za-z0-9_-]{43}$/.test(this.secret)) throw new Error('invalid credential');
      } catch {
        this.secret = null; this.cloudCredentials = null;
        const e = new Error('Windows 암호 보관함을 열지 못했습니다. 저장해 둔 복구 키 파일로 다시 연결해 주세요.'); e.code = 'RECOVERY_REQUIRED'; throw e;
      }
    }
    if (this.isCloud() && !this.config) {
      try {
        const value = json(await this.secretStore.decrypt(await fs.readFile(path.join(this.stateDir, 'connection.bin'))));
        const p = b2.provider({ ...value, prefix: 'work-backup/00000000-0000-4000-8000-000000000000' }, '00000000-0000-4000-8000-000000000000');
        this.connection = { endpoint: p.endpoint, bucket: p.bucket, credentials: b2.credentials(value) };
      } catch { /* Optional preset can be replaced by manually entered credentials. */ }
    }
    this.settingsKey = stamp;
    return this.getState();
  }
  // Whoever takes the engine lock reads the settings again: a scheduled run may have
  // written them meanwhile (STAGE1_DESIGN.md 4.1). Skipped while a job runs, and when the
  // file is the one this engine last read or wrote. A missing credential is not an error
  // here — the window then offers recovery, as when it opened (review GA3).
  async reload() {
    if (this.job || this.stopping) return false;
    const key = await this.settingsKeyNow();
    if (key === null || key === this.settingsKey) return false;
    try { await this.open(); } catch (e) { if (e.code !== 'RECOVERY_REQUIRED') throw e; }
    return true;
  }
  async settingsKeyNow() {
    try { const s = await fs.stat(path.join(this.stateDir, 'settings.json')); return `${s.size}:${s.mtimeMs}`; } catch { return null; }
  }
  async settingsStamp() { this.settingsKey = await this.settingsKeyNow(); }
  getState() {
    const c = this.config;
    const timing = schedule(c, this.intervalMs, this.now(), this.lastAttempt);
    return { version: require('../package.json').version, configured: !!c?.repositoryId, mode: c?.mode || 'backup', sources: c?.sources || [], repository: c?.repository || null,
      providerType: this.providerType, provider: c?.provider || null, initializing: !!c && !c.repositoryId,
      cloudConnection: this.isCloud() && c && !c.repositoryId && this.cloudCredentials ? { endpoint: c.provider.endpoint, bucket: c.provider.bucket } : !c && this.connection ? { endpoint: this.connection.endpoint, bucket: this.connection.bucket } : null,
      credentialRequired: !!c && !this.secret, intervalMinutes: this.intervalMs / 60000, fullCheckDays: this.isCloud() ? 30 : 1, retryAfter: c?.retryAfter || null,
      recoverySaved: this.hasRecovery(), manualRecoverySaved: c?.recoverySaved || false, readOnly: !!c?.readOnly, automatic: c?.automatic || false, lastBackup: c?.lastBackup || null, lastPartial: c?.lastPartial || null, lastFill: c?.lastFill || null, leftOutNames: c?.leftOutNames || null, missingSources: c?.missingSources || [],
      removedSources: (c?.removedSources || []).map(r => ({ path: r.path, at: r.at, until: new Date(Date.parse(r.since ?? r.at) + REMOVED_KEEP).toISOString() })),
      lastRestore: c?.lastRestore || null, lastRestoreError: c?.lastRestoreError || null, lastMoveError: c?.lastMoveError || null, moveKit: c?.moveKit || null, health: c?.health || null, lastError: c?.lastError || null, movedTo: c?.movedTo || null, nextSources: c?.nextSources || [],
      lastSelectedRestore: c?.lastSelectedRestore || null, lastSelectedRestoreError: c?.lastSelectedRestoreError || null,
      pausedUntil: c?.pausedUntil || null, lastAttemptAt: c?.lastAttemptAt || null, nextBackupAt: timing.nextBackupAt, clockHold: timing.clockHold,
      lastProbe: c?.lastProbe || null, probeHold: c?.probeHold || null, massHold: c?.massHold || null, protectRun: c?.protectRun || null, startupWarning: c?.startupWarning || null,
      warning: c?.warning || null, job: this.job ? { ...this.job } : null };
  }
  isCloud() { return this.providerType === 'b2'; }
  // The restic host name of this engine's backups: the device number on a customer repository, the vault elsewhere (as
  // 0.5.0 – 0.6 wrote). A restore-only connection to a customer repository names the device it reads.
  get hostName() { return this.config?.host || this.config?.vaultId; }
  hasRecovery() { return !!(this.config?.recoverySaved || (this.config?.remoteRecovery?.repositoryId === this.config?.repositoryId && this.config?.remoteRecovery?.verifiedAt)); }
  recoveryKit() {
    if (!this.isCloud() || !this.config?.repositoryId || !this.secret) throw new Error('클라우드 백업을 연결한 뒤 복구 정보를 보관해 주세요.');
    return { format: APP, version: 2, type: 'b2', provider: this.config.provider, repository: this.config.repository, repositoryId: this.config.repositoryId, vaultId: this.config.vaultId, password: this.secret };
  }
  async validateReadCredential(credentials) {
    const options = { credentials, readOnly: true, timeoutMs: 60000 };
    const info = json(await this.run(['cat', 'config'], options));
    if (info.id !== this.config.repositoryId) throw new Error('복구 전용 키와 저장소가 다릅니다.');
    await this.run(['snapshots', '--json'], options);
  }
  // The app's own folders for this engine: the state, and the work folder when it is a separate one
  // (review GA2 — no source, target or restore may land in either).
  own() { return this.workDir && this.workDir !== this.stateDir ? [this.stateDir, this.workDir] : [this.stateDir]; }
  forbidden() { return [...this.own(), ...this.forbiddenPaths, ...(!this.isCloud() && this.config ? [this.config.repository] : [])]; }
  async storeCredential(password, credentials = this.cloudCredentials) {
    this.discardCatalog();
    const value = this.isCloud() ? JSON.stringify({ version: 2, password, ...b2.credentials(credentials) }) : password;
    await atomic(path.join(this.stateDir, 'credential.bin'), await this.secretStore.encrypt(value));
  }
  // Operator provisioning entry point; never exposed over renderer IPC. No
  // sources, repository or automatic backup are created by preparing a key.
  async prepareCloudConnection({ endpoint, bucket, credentials }) {
    if (!this.isCloud() || this.config || this.job) throw new Error('빈 클라우드 프로필에서만 연결을 준비할 수 있습니다.');
    const vault = '00000000-0000-4000-8000-000000000000';
    const p = b2.provider({ endpoint, bucket, prefix: `work-backup/${vault}` }, vault);
    const key = b2.credentials(credentials);
    await this.probe(p, key, { now: this.now() });
    await atomic(path.join(this.stateDir, 'connection.bin'), await this.secretStore.encrypt(JSON.stringify({ endpoint: p.endpoint, bucket: p.bucket, ...key })));
    this.connection = { endpoint: p.endpoint, bucket: p.bucket, credentials: key };
    return this.getState();
  }
  emitState() { this.emit('state', this.getState()); }
  stage(stage, percent = null) { if (this.job) { this.job.stage = stage; this.job.percent = percent; this.emitState(); } }
  async save() { await atomic(path.join(this.stateDir, 'settings.json'), JSON.stringify(this.config, null, 2)); await this.settingsStamp(); this.emitState(); }
  async recoverCredential(text, credentials = this.cloudCredentials) {
    const kit = parseKit(text);
    if (!this.config?.repositoryId || kit.repositoryId !== this.config.repositoryId || kit.vaultId !== this.config.vaultId) throw new Error('현재 설정에 맞는 복구 키가 아닙니다.');
    if (kit.type !== this.providerType || (this.isCloud() && kit.repository !== this.config.repository)) throw new Error('다른 종류의 백업 복구 키입니다.');
    if (!this.isCloud()) await directory(this.config.repository);
    this.transientSecrets = [kit.password, credentials?.keyId, credentials?.applicationKey];
    try {
    const info = json(await this.run(['cat', 'config'], { password: kit.password, credentials, timeoutMs: 60000 }));
    if (info.id !== kit.repositoryId) throw new Error('저장소가 바뀌었습니다. 원래 드라이브를 연결해 주세요.');
    await this.storeCredential(kit.password, credentials);
    this.secret = kit.password; this.cloudCredentials = this.isCloud() ? b2.credentials(credentials) : null;
    } catch (e) { throw new Error(this.clean(e.message)); }
    finally { this.transientSecrets = []; }
  }
  async resetUnfinishedSetup() {
    if (!this.config) return;
    if (this.job || this.config.repositoryId) throw new Error('완료된 저장소 설정은 덮어쓸 수 없습니다.');
    const stem = path.join(this.stateDir, `unfinished-${this.config.vaultId}-${crypto.randomUUID()}`);
    await fs.copyFile(path.join(this.stateDir, 'credential.bin'), `${stem}.bin`, require('node:fs').constants.COPYFILE_EXCL);
    await atomic(`${stem}.json`, JSON.stringify(this.config));
    await atomic(path.join(this.stateDir, 'settings.json'), 'null');
    this.config = null; this.secret = null; this.cloudCredentials = null; this.emitState();
  }
  // `note`: what the failure record of this job also says (a restore to the window's default place: `named`).
  async operation(kind, fn, note = {}) {
    if (this.job || this.stopping) throw new Error('진행 중인 작업이 끝난 뒤 다시 눌러 주세요.');
    if (this.config && !['protect', 'probe'].includes(kind)) this.config.protectRun = null;
    // A move started again says nothing of the last one's failure while it runs (화면 세션 E4); a new failure is written below.
    if (kind === 'move' && this.config?.lastMoveError) this.config.lastMoveError = null;
    this.job = { kind, stage: '준비 중', percent: null }; this.emitState();
    try {
      const value = await fn();
      // A restore or a move says nothing about the backups (화면 세션 부탁 4): its success clears only its own failure.
      if (this.config) {
        if (OWN_ERROR[kind]) this.config[OWN_ERROR[kind]] = null;
        else { if (kind !== 'probe') this.config.lastError = null; if (this.config.warning === BUSY_WARNING) this.config.warning = null; }
        await this.save();
      }
      return value;
    } catch (e) {
      // Exit 11 is another process holding the repository lock — "busy, try the
      // next run", not an error (STAGE1_DESIGN.md 4.2 · review F2). The window still
      // says why nothing happened: a person-started job returns at once (review GA2).
      // A restore that failed is written down as such (lastRestoreError), never as the backups' failure (화면 세션 부탁 4).
      const cancelled = !!(OWN_ERROR[kind] && this.job?.cancelled);
      // Failing now: a stop that comes while this is written can no longer change it (카본 끝판 A2).
      if (this.job) this.job.final = true;
      if (this.config && OWN_ERROR[kind]) {
        const code = cancelled ? 'CANCELED' : e.exitCode === 11 ? 'BUSY' : typeof e.code === 'string' && /^[A-Z][A-Z_]{1,31}$/.test(e.code) ? e.code : kind === 'move' ? 'MOVE_FAILED' : 'RESTORE_FAILED';
        this.config[OWN_ERROR[kind]] = { code, at: new Date(this.now()).toISOString(), ...(typeof e.restorePath === 'string' ? { path: e.restorePath } : {}), ...(note.named === true ? { named: true } : {}), ...(typeof note.from === 'string' ? { from: note.from } : {}),
          // 「지워지기 전으로 되살리기」가 받으려던 범위(화면 세션 E31).
          ...(note.mass ? { mass: note.mass } : {}) };
        await this.save().catch(() => {});
      } else if (this.config && e.exitCode === 11) { if (this.config.mode === 'backup' && !this.config.readOnly) { this.config.warning = BUSY_WARNING; await this.save().catch(() => {}); } }
      else if (this.config) { this.config.lastError = this.clean(e.message); await this.save().catch(() => {}); }
      // A word code (REPO_EXISTS, RESTORE_PENDING …) goes on with the cleaned message; the screen chooses by it.
      const error = new Error(cancelled ? '되살리기를 그만두었습니다. 만들다 만 폴더는 그대로 두었습니다.' : this.clean(e.message)); error.exitCode = e.exitCode;
      if (typeof e.code === 'string' && /^[A-Z][A-Z_]{1,31}$/.test(e.code)) error.code = e.code;
      if (cancelled) error.code = 'CANCELED';
      throw error;
    } finally { this.transientSecrets = []; this.job = null; this.emitState(); this.emit('idle'); }
  }
  clean(message) { return b2.redact(message, [this.secret, this.cloudCredentials?.keyId, this.cloudCredentials?.applicationKey, this.connection?.credentials.keyId, this.connection?.credentials.applicationKey, ...this.transientSecrets]); }
  async run(args, { repository = this.config.repository, password = this.secret, provider = this.config?.provider, credentials = this.cloudCredentials, timeoutMs = DAY, consumeStdout = null, readOnly = !!this.config?.readOnly, onErrorItem = null, stdinText = null, stderrFails = false } = {}) {
    if (this.stopping && !this.job) throw new Error('앱을 종료하고 있습니다. 이전 정상 백업은 유지됩니다.');
    if (this.job?.cancelled) throw Object.assign(new Error('되살리기를 그만두었습니다. 만들다 만 폴더는 그대로 두었습니다.'), { code: 'CANCELED' });
    const { env, args: providerArgs } = b2.childOptions(provider, credentials, this.workDir || this.stateDir, process.env, password);
    if (readOnly) {
      const permitted = ['snapshots', 'ls', 'dump'].includes(args[0]) || (args[0] === 'cat' && ['config', 'lock'].includes(args[1])) || (args[0] === 'list' && args[1] === 'locks');
      if (!permitted) throw new Error('복구 전용 연결에서는 백업·전체 점검·삭제를 실행할 수 없습니다.');
      providerArgs.push('--no-lock');
    }
    if (this.resticStartedAt === null) this.resticStartedAt = Date.now();
    if (this.runner) return this.runner(args, { repository, password, engine: this, consumeStdout, provider, credentials, env, providerArgs, onErrorItem, stdinText, stderrFails });
    return new Promise((resolve, reject) => {
      const child = spawn(this.resticPath, ['--repo', repository, ...providerArgs, '--retry-lock', '10s', ...args], { env, windowsHide: true, shell: false, stdio: [stdinText === null ? 'ignore' : 'pipe', 'pipe', 'pipe'] });
      this.child = child;
      if (stdinText !== null) { child.stdin.on('error', () => {}); child.stdin.end(stdinText); }
      let errors = '', timedOut = false, overflow = false, lastProgress = 0, consumerError = null, forceStop;
      const capture = new ProcessOutput({ structured: ['cat', 'snapshots', 'stats'].includes(args[0]), overflow: () => { overflow = true; child.kill(); }, progress: percent => { if (Date.now() - lastProgress >= 1000 || percent === 100) { lastProgress = Date.now(); this.stage(this.job?.stage, percent); } } });
      const errorDecoder = new StringDecoder('utf8');
      const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeoutMs);
      // Binary dump output never enters the text capture or renderer. A consumer
      // failure is handled immediately, then both stream and child must settle.
      const consumed = consumeStdout ? Promise.resolve().then(() => consumeStdout(child.stdout)).catch(e => {
        consumerError = e; child.stdout.destroy();
        // Closing the pipe lets restic report the write error and remove its own
        // lock. Windows kill is forcible; use it only if normal exit stalls.
        if (child.exitCode === null && child.signalCode === null) forceStop = setTimeout(() => child.kill(), 5000);
      }) : Promise.resolve();
      if (!consumeStdout) child.stdout.on('data', b => capture.accept(b));
      child.stdout.on('error', () => {});
      // Every unreadable item from restic's JSON error lines, however many — the tail kept below is only for the message.
      const items = onErrorItem ? errorItems(onErrorItem) : null;
      child.stderr.on('data', b => { const text = errorDecoder.write(b); items?.push(text); errors = (errors + text).slice(-12000); });
      child.once('error', e => { consumerError ||= e; child.stdout.destroy(e); });
      child.once('close', async (code, signal) => {
        clearTimeout(timer); clearTimeout(forceStop); this.child = null;
        if (code !== 0 || signal) child.stdout.destroy(new Error('백업 엔진의 출력이 중단되었습니다.'));
        await consumed;
        const output = capture.end(); const tail = errorDecoder.end(); items?.push(tail); items?.end(); errors += tail;
        if (consumerError) return reject(consumerError);
        if (timedOut || overflow || signal) return reject(new Error(timedOut ? '작업 시간이 길어 중단되었습니다. 다음 실행 때 다시 시도합니다.' : '작업이 중단되었습니다. 이전 정상 백업은 유지됩니다.'));
        if (code !== 0) {
          const explanation = code === 3 ? '일부 파일을 읽지 못했습니다. 파일을 사용하는 프로그램을 닫고 다시 백업해 주세요. 이전 정상 백업은 유지됩니다.' : code === 11 ? '다른 백업 작업이 저장소를 사용하고 있습니다. 잠시 후 다시 시도해 주세요.' : code === 12 ? '복구 키가 이 백업 저장소와 맞지 않습니다.' : '백업 저장소에 접근하지 못했거나 점검 중 오류가 발생했습니다.';
          const details = errors || output.slice(-1800);
          if (this.isCloud() && /(?:transaction|storage|download)_cap_exceeded|cap[_ ]exceeded/i.test(details) && this.config) this.config.retryAfter = new Date(Math.floor(this.now() / DAY) * DAY + DAY).toISOString();
          const error = new Error(this.clean(`${explanation}\n${details}`)); error.exitCode = code; return reject(error);
        }
        // 대량 삭제 · 변경 멈춤 (4.4): restic may tell a tree it could not read on stderr and still end with 0 (GPT GA5).
        if (stderrFails && errors.trim()) return reject(new Error(this.clean(`백업을 비교하는 중 오류가 있었습니다.\n${errors.slice(-1800)}`)));
        resolve(output);
      });
    });
  }
  async identity() {
    if (!this.config?.repositoryId) throw new Error('백업 준비를 먼저 완료해 주세요.');
    if (!this.secret) throw new Error('복구 키와 연결 키로 Windows 암호 보관함을 다시 연결해 주세요.');
    if (this.isCloud()) {
      if (this.config.repository !== b2.repository(this.config.provider, this.config.vaultId)) throw new Error('클라우드 저장소 경로가 바뀌었습니다.');
    } else {
      const real = await directory(this.config.repository);
      if ([...this.own(), ...this.forbiddenPaths].some(p => overlap(real, p))) throw new Error('백업 경로와 앱 보관 경로가 겹칩니다.');
    }
    const info = json(await this.run(['cat', 'config'], { timeoutMs: 60000 }));
    if (info.id !== this.config.repositoryId) throw new Error('다른 저장소가 연결되어 있습니다. 원래 백업 드라이브를 연결해 주세요.');
    return info;
  }
  async snapshots(tags = [], { host } = {}) {
    const list = json(await this.run(['snapshots', '--json', '--tag', [APP, `vault:${this.config.vaultId}`, ...tags].join(',')], { timeoutMs: 60000 }));
    if (!Array.isArray(list) || list.some(s => !isId(s.id) || !Number.isFinite(Date.parse(s.time)))) throw new Error('백업 목록의 형식을 확인하지 못했습니다.');
    return list.filter(s => s.tags?.includes(APP) && s.tags.includes(`vault:${this.config.vaultId}`) && tags.every(t => s.tags.includes(t)) && (host === undefined || s.hostname === host) && knownTags(s)).sort((a, b) => Date.parse(b.time) - Date.parse(a.time) || b.id.localeCompare(a.id));
  }
  async setup({ sources, parent }) {
    return this.operation('setup', async () => {
      if (this.isCloud()) throw new Error('클라우드 연결 화면에서 준비해 주세요.');
      if (this.config?.repositoryId) throw new Error('이 앱에는 이미 백업 저장소가 연결되어 있습니다.');
      if (!this.config) {
        const target = await directory(parent);
        if ([...this.own(), ...this.forbiddenPaths].some(p => overlap(target, p))) throw new Error('앱 설정과 분리된 백업 폴더를 선택해 주세요.');
        const checked = await validateSources(sources, [target, ...this.own(), ...this.forbiddenPaths]);
        const vaultId = crypto.randomUUID();
        const repository = path.join(target, `work-backup-${vaultId}`);
        this.secret = crypto.randomBytes(32).toString('base64url');
        await atomic(path.join(this.stateDir, 'credential.bin'), await this.secretStore.encrypt(this.secret));
        this.config = { schema: 1, mode: 'backup', vaultId, repository, repositoryId: null, sources: checked, automatic: false, recoverySaved: false, lastBackup: null, health: null, lastError: null, warning: null };
        await this.save(); // Persist credentials and initialization journal before creating the encrypted repository.
      }
      await validateSources(this.config.sources, [path.dirname(this.config.repository), ...this.own(), ...this.forbiddenPaths]);
      await fs.mkdir(this.config.repository, { recursive: true });
      await directory(this.config.repository);
      this.stage('암호화 저장소 준비 중');
      try { await fs.access(path.join(this.config.repository, 'config')); }
      catch (e) { if (e.code !== 'ENOENT') throw e; await this.run(['init'], { timeoutMs: 120000 }); }
      const info = json(await this.run(['cat', 'config']));
      if (!isId(info.id)) throw new Error('저장소 번호를 확인하지 못했습니다.');
      this.config.repositoryId = info.id;
      await this.save();
      return this.getState();
    });
  }
  // `repository` + `host`: the customer repository and device number the provisioning server gave (STAGE1_DESIGN.md
  // 4.5, 「보호 시작」). The prefix is used as given, the vault comes from it, and an account whose repository is
  // already there is never made again: it fails REPO_EXISTS and is opened from the account envelope instead (2.3).
  async setupCloud({ sources, endpoint, bucket, credentials, repository = null, host = null }) {
    return this.operation('setup', async () => {
      this.transientSecrets = [credentials?.keyId, credentials?.applicationKey];
      if (!this.isCloud()) throw new Error('클라우드 프로필에서 연결해 주세요.');
      if (this.config?.repositoryId) throw new Error('이 프로필에는 이미 저장소가 연결되어 있습니다.');
      if (repository !== null) {
        if (!repository || typeof repository !== 'object' || !b2.customerRepository(repository.prefix) || !DEVICE.test(host || '')) throw new Error('개통된 백업 자리를 확인할 수 없습니다.');
        endpoint = repository.endpoint; bucket = repository.bucket;
      }
      const saved = this.config && this.cloudCredentials ? { ...this.config.provider, credentials: this.cloudCredentials } : this.connection;
      const canReuse = !credentials?.keyId && !credentials?.applicationKey && saved && b2.endpoint(endpoint) === saved.endpoint && bucket === saved.bucket;
      const next = b2.credentials(canReuse ? saved.credentials : credentials);
      if (!this.config) {
        const checked = await validateSources(sources, this.forbidden());
        const vaultId = repository ? customerVault(repository.prefix) : crypto.randomUUID();
        const provider = b2.provider({ endpoint, bucket, prefix: repository ? repository.prefix : `work-backup/${vaultId}` }, vaultId);
        await this.probe(provider, next, { now: this.now() });
        if (repository) {
          // Asked with a password that is not this account's: a repository that answers 「wrong password」 is there.
          try { await this.run(['cat', 'config'], { repository: b2.repository(provider, vaultId), provider, password: crypto.randomBytes(32).toString('base64url'), credentials: next, timeoutMs: 60000 }); throw Object.assign(new Error('이 계정에는 이미 백업이 있습니다.'), { code: 'REPO_EXISTS' }); }
          catch (e) { if (e.code === 'REPO_EXISTS' || e.exitCode === WRONG_PASSWORD) throw Object.assign(new Error('이 계정에는 이미 백업이 있습니다.'), { code: 'REPO_EXISTS' }); if (e.exitCode !== NO_REPOSITORY) throw e; }
        }
        const password = crypto.randomBytes(32).toString('base64url');
        await this.storeCredential(password, next);
        this.secret = password; this.cloudCredentials = next;
        this.config = { schema: 1, mode: 'backup', provider, vaultId, ...(repository ? { host } : {}), repository: b2.repository(provider, vaultId), repositoryId: null, sources: checked, automatic: false, recoverySaved: false, lastBackup: null, health: null, lastError: null, warning: null };
        await this.save();
      } else {
        if (!this.secret) throw new Error('초기화 암호를 열지 못했습니다. 원래 Windows 계정으로 다시 실행해 주세요.');
        if (b2.endpoint(endpoint) !== this.config.provider.endpoint || bucket !== this.config.provider.bucket) throw new Error('이전 초기화의 버킷·Endpoint로 다시 시도해 주세요.');
        if ((repository?.prefix ?? null) !== (b2.customerRepository(this.config.provider.prefix) ? this.config.provider.prefix : null) || (repository && host !== this.config.host)) throw new Error('이전 초기화의 백업 자리로 다시 시도해 주세요.');
        await this.probe(this.config.provider, next, { now: this.now() });
      }
      await validateSources(this.config.sources, this.forbidden());
      this.stage('B2 암호화 저장소 연결 중');
      let info;
      try { info = json(await this.run(['cat', 'config'], { credentials: next, timeoutMs: 60000 })); }
      catch (e) {
        if (e.exitCode !== NO_REPOSITORY) throw e; // Never turn denied/offline/wrong password into init.
        await this.run(['init'], { credentials: next, timeoutMs: 120000 });
        info = json(await this.run(['cat', 'config'], { credentials: next, timeoutMs: 60000 }));
      }
      if (!isId(info.id)) throw new Error('B2 저장소 번호를 확인하지 못했습니다.');
      await this.storeCredential(this.secret, next); this.cloudCredentials = next;
      this.config.repositoryId = info.id; this.config.retryAfter = null;
      await this.save(); return this.getState();
    });
  }
  async updateCloudCredentials(credentials) {
    return this.operation('credentials', async () => {
      this.transientSecrets = [credentials?.keyId, credentials?.applicationKey];
      if (!this.isCloud() || !this.config?.repositoryId || !this.secret) throw new Error('복구 키로 연결을 복구한 뒤 다시 시도해 주세요.');
      const next = b2.credentials(credentials);
      await this.probe(this.config.provider, next, { now: this.now() });
      const info = json(await this.run(['cat', 'config'], { credentials: next, timeoutMs: 60000 }));
      if (info.id !== this.config.repositoryId) throw new Error('다른 저장소의 키입니다.');
      await this.storeCredential(this.secret, next); this.cloudCredentials = next;
      this.config.retryAfter = null; await this.save(); return this.getState();
    });
  }
  async saveRecoveryKit(file) {
    return this.operation('key', async () => {
      await this.identity();
      const parent = await directory(path.dirname(file));
      const forbidden = [...this.forbidden(), ...this.config.sources, ...(!this.isCloud() ? [path.dirname(this.config.repository)] : [])];
      if (forbidden.some(p => overlap(parent, p))) throw new Error('복구 키는 작업 폴더·백업 폴더·앱 폴더와 분리된 곳에 저장해 주세요.');
      const target = path.join(parent, path.basename(file));
      const text = JSON.stringify({ format: APP, version: this.isCloud() ? 2 : 1, type: this.providerType, ...(this.isCloud() ? { provider: this.config.provider } : {}), repository: this.config.repository, repositoryId: this.config.repositoryId, vaultId: this.config.vaultId, password: this.secret, note: this.isCloud() ? '복구에는 이 파일과 해당 B2 버킷의 연결 키가 필요합니다. 서로 별도로 보관하세요. B2 키는 이 파일에 포함하지 않습니다.' : '이 파일로 백업을 열 수 있습니다. 노트북 및 백업 드라이브와 별도로 보관하세요.' }, null, 2);
      let handle;
      try { handle = await fs.open(target, 'wx', 0o600); }
      catch (e) { if (e.code === 'EEXIST') throw new Error('이미 같은 이름의 복구 키 파일이 있습니다. 다른 이름으로 저장해 주세요.'); throw e; }
      try { await handle.writeFile(text); await handle.sync(); } finally { await handle.close(); }
      if (await fs.readFile(target, 'utf8') !== text) throw new Error('복구 키 파일을 다시 읽어 확인하지 못했습니다.');
      this.config.recoverySaved = true; await this.save();
      return this.getState();
    });
  }
  async importRecoveryKit({ text, repository, credentials, readOnly = false }) {
    return this.operation('import', async () => {
      if (this.config) throw new Error('기존 설정을 덮어쓸 수 없습니다.');
      const kit = parseKit(text);
      this.transientSecrets = [kit.password, credentials?.keyId, credentials?.applicationKey];
      if (kit.type !== this.providerType) throw new Error('복구 키와 맞는 로컬·클라우드 탭을 선택해 주세요.');
      const target = this.isCloud() ? kit.repository : await directory(repository);
      if (!this.isCloud() && [...this.own(), ...this.forbiddenPaths].some(p => overlap(target, p))) throw new Error('앱 폴더와 분리된 백업 저장소를 선택해 주세요.');
      if (readOnly && !this.isCloud()) throw new Error('읽기 전용 연결은 클라우드에서 지원합니다.');
      const options = { repository: target, password: kit.password, provider: kit.provider, credentials: this.isCloud() ? b2.credentials(credentials) : null, timeoutMs: 60000, readOnly };
      const info = json(await this.run(['cat', 'config'], options));
      if (info.id !== kit.repositoryId) throw new Error('복구 키에 기록된 저장소와 선택한 저장소가 다릅니다.');
      // Do not persist a new identity until a usable app snapshot has been found.
      const list = json(await this.run(['snapshots', '--json', '--tag', `${APP},vault:${kit.vaultId},${VERIFIED}`], options));
      if (!Array.isArray(list)) throw new Error('백업 목록을 읽지 못했습니다.');
      const latest = list.filter(s => isId(s.id) && s.tags?.includes(VERIFIED) && s.tags.includes(APP) && s.tags.includes(`vault:${kit.vaultId}`) && knownTags(s)).sort((a,b) => Date.parse(b.time) - Date.parse(a.time))[0];
      if (!latest) throw new Error('완료된 백업이 없습니다. 원래 PC에서 백업을 완료해 주세요.');
      // A customer repository's kit reads the device whose backup is newest (its vault is the repository's own).
      const customer = this.isCloud() && b2.customerRepository(kit.provider.prefix);
      if (customer && (kit.vaultId !== customerVault(kit.provider.prefix) || !DEVICE.test(latest.hostname || ''))) throw new Error('복구 키에 기록된 저장소와 선택한 저장소가 다릅니다.');
      await this.storeCredential(kit.password, credentials);
      this.secret = kit.password; this.cloudCredentials = this.isCloud() ? b2.credentials(credentials) : null;
      this.config = { schema: 1, mode: 'restore', readOnly, ...(this.isCloud() ? { provider: kit.provider } : {}), vaultId: kit.vaultId, ...(customer ? { host: latest.hostname } : {}), repository: target, repositoryId: info.id, sources: [], automatic: false, recoverySaved: true, lastBackup: { id: latest.id, at: latest.time, files: latest.summary?.total_files_processed || 0, bytes: latest.summary?.total_bytes_processed || 0 }, health: null, warning: '복구 전용 연결입니다. 이 저장소의 백업을 지우거나 자동 백업하지 않습니다.' };
      await this.save(); return this.getState();
    });
  }
  // A new PC opens the customer repository from the account envelope (v3) with the customer read key: restore only,
  // reading the device whose complete backup is newest, until this PC takes the write seat (becomeWriter).
  async importRepository({ repository, repositoryId, password, credentials }) {
    return this.operation('import', async () => {
      if (!this.isCloud()) throw new Error('클라우드 프로필에서 연결해 주세요.');
      if (this.config) throw new Error('기존 설정을 덮어쓸 수 없습니다.');
      if (!repository || typeof repository !== 'object' || !b2.customerRepository(repository.prefix) || !isId(repositoryId) || typeof password !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(password)) throw new Error('계정의 백업 정보를 확인할 수 없습니다.');
      const key = b2.credentials(credentials);
      this.transientSecrets = [password, key.keyId, key.applicationKey];
      const vaultId = customerVault(repository.prefix);
      const provider = b2.provider({ endpoint: repository.endpoint, bucket: repository.bucket, prefix: repository.prefix }, vaultId), target = b2.repository(provider, vaultId);
      const options = { repository: target, password, provider, credentials: key, timeoutMs: 60000, readOnly: true };
      const info = json(await this.run(['cat', 'config'], options));
      if (info.id !== repositoryId) throw new Error('계정에 적힌 저장소와 연결한 저장소가 다릅니다.');
      const list = json(await this.run(['snapshots', '--json', '--tag', `${APP},vault:${vaultId},${VERIFIED}`], options));
      if (!Array.isArray(list)) throw new Error('백업 목록을 읽지 못했습니다.');
      const latest = list.filter(s => isId(s.id) && DEVICE.test(s.hostname || '') && s.tags?.includes(VERIFIED) && s.tags.includes(APP) && s.tags.includes(`vault:${vaultId}`) && Number.isFinite(Date.parse(s.time)) && knownTags(s)).sort((a, b) => Date.parse(b.time) - Date.parse(a.time))[0];
      if (!latest) throw new Error('완료된 백업이 없습니다. 원래 PC에서 백업을 완료해 주세요.');
      await this.storeCredential(password, key);
      this.secret = password; this.cloudCredentials = key;
      this.config = { schema: 1, mode: 'restore', readOnly: true, provider, vaultId, host: latest.hostname, repository: target, repositoryId: info.id, sources: [], automatic: false, recoverySaved: true, lastBackup: { id: latest.id, at: latest.time, files: latest.summary?.total_files_processed || 0, bytes: latest.summary?.total_bytes_processed || 0 }, health: null, warning: '복구 전용 연결입니다. 이 저장소의 백업을 지우거나 자동 백업하지 않습니다.' };
      await this.save(); return this.getState();
    });
  }
  // This PC took the write seat (STAGE1_DESIGN.md 4.6): the restore-only connection to the customer repository becomes
  // this device's backup of it. Its own backups carry its own device number; the old device's stay as they are.
  async becomeWriter({ sources, credentials, host }) {
    return this.operation('setup', async () => {
      const c = this.config;
      if (!this.isCloud() || !c?.repositoryId || c.mode !== 'restore' || !b2.customerRepository(c.provider?.prefix) || !this.secret) throw new Error('계정의 백업을 먼저 열어 주세요.');
      if (!DEVICE.test(host || '')) throw new Error('이 PC의 기기 번호를 확인할 수 없습니다.');
      const key = b2.credentials(credentials);
      this.transientSecrets = [key.keyId, key.applicationKey];
      const checked = await validateSources(sources, this.forbidden());
      await this.probe(c.provider, key, { now: this.now() });
      const info = json(await this.run(['cat', 'config'], { credentials: key, timeoutMs: 60000 }));
      if (info.id !== c.repositoryId) throw new Error('다른 저장소의 키입니다.');
      await this.storeCredential(this.secret, key); this.cloudCredentials = key;
      Object.assign(c, { mode: 'backup', readOnly: false, host, sources: checked, automatic: false, lastBackup: null, lastPartial: null, lastFill: null, leftOutNames: null, leftOutHeld: null, health: null, warning: null, retryAfter: null });
      delete c.nextSources;
      await this.save(); return this.getState();
    });
  }
  // The account envelope (v3) holding this repository was published and read back: it is this backup's recovery
  // (2.1 「첫 복구 수단은 자동으로 만들어지는 봉투」).
  async markEnvelope({ verifiedAt }) {
    if (!this.config?.repositoryId || typeof verifiedAt !== 'string' || !Number.isFinite(Date.parse(verifiedAt))) throw new Error('봉투 확인 시각이 올바르지 않습니다.');
    this.config.remoteRecovery = { repositoryId: this.config.repositoryId, verifiedAt, envelope: 3 };
    await this.save(); return this.getState();
  }
  // A server restore (4.5 `restore/run`) is written down before it is asked for and kept with its job's number until
  // the restore is no longer open (the choice, an undo that ended, a failure): until then no backup or clean-up runs
  // here (the server is putting hidden files back). An undo is a new job under the same hold.
  // `adopted`: the server status showed this PC's job under another number and the hold took it up (account
  // applyStatus, from the run or the window — GPT restore3 GA1). It names the job followed before (`from`, null for a
  // request whose answer was lost), whether that was an undo, and whether a lost answer's keys are still to come
  // (`lost`). The window reads the jobs once and writes the hold again without it.
  async holdForServerRestore({ jobId, undo, adopted } = {}) {
    if (!this.config?.repositoryId) throw new Error('백업 준비를 먼저 완료해 주세요.');
    if (jobId !== undefined && (typeof jobId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(jobId))) throw new Error('되돌리기 작업 번호가 올바르지 않습니다.');
    if (adopted !== undefined && (!jobId || !adoptedMark(adopted))) throw new Error('되돌리기 작업 번호가 올바르지 않습니다.');
    const since = this.config.serverRestore?.since || new Date(this.now()).toISOString();
    this.config.serverRestore = { since, ...(jobId ? { jobId } : {}), ...(undo ? { undo: true } : {}),
      ...(adopted ? { adopted: { from: adopted.from, fromUndo: adopted.fromUndo, lost: adopted.lost } } : {}) };
    await this.save(); return this.getState();
  }
  // A restore-only connection to the account's backup chooses the folders this PC backs up once it takes the write
  // seat (화면 세션 부탁 12): checked here, kept in the settings, used by becomeWriter.
  async chooseNextSources(sources) {
    const c = this.config;
    if (!this.isCloud() || c?.mode !== 'restore' || !b2.customerRepository(c.provider?.prefix)) throw new Error('계정의 백업을 연 복구 전용 연결에서만 고를 수 있습니다.');
    if (this.job || this.stopping) throw new Error('진행 중인 작업이 끝난 뒤 변경해 주세요.');
    c.nextSources = await validateSources(sources, this.forbidden());
    await this.save(); return this.getState();
  }
  // The folders as a setup would take them, without changing anything (the seat is taken only after this passes).
  // 화면 세션 E15: folders that are not there (an empty folder a move did not make, one moved away since) are named
  // together, so the screen leaves them out and tries again.
  async checkSources(sources) {
    const missing = [];
    for (const source of Array.isArray(sources) ? sources.slice(0, 30) : []) { try { await fs.readdir(await directory(source)); } catch { missing.push(source); } }
    if (missing.length) throw Object.assign(new Error('없거나 열 수 없는 폴더가 있습니다. 그 폴더를 빼고 다시 골라 주세요.'), { code: 'SOURCES_MISSING', details: { paths: missing.map(p => String(p).slice(0, 1024)) } });
    return validateSources(sources, this.forbidden());
  }
  // The account's write seat went to another PC (4.6 다시 확인 N2): this PC rests and says so until it takes the seat
  // back (「이 PC로 다시 백업」). Written from the server status, by the run and the window.
  async markMoved({ device, at }) {
    if (!this.config?.repositoryId) return this.getState();
    const name = typeof device === 'string' ? device.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 64) : '';
    if (this.config.movedTo?.device === name) return this.getState();
    this.config.movedTo = { device: name, at: typeof at === 'string' ? at : new Date(this.now()).toISOString() };
    await this.save(); return this.getState();
  }
  async clearMoved() { if (this.config?.movedTo) { delete this.config.movedTo; await this.save(); } return this.getState(); }
  // 옮겨 오기 원본(4.2 · 4.6 「move/pin」): the snapshot a reading PC is copying is kept by this writer's cleanup until
  // the server's `until` (7 days at most) or until the pin goes.
  async setMovePin(pin) {
    if (!this.config?.repositoryId) return this.getState();
    const next = pin && isId(pin.snapshotId) && Number.isFinite(Date.parse(pin.until)) ? { snapshotId: pin.snapshotId, until: new Date(Date.parse(pin.until)).toISOString() } : null;
    if (JSON.stringify(next) === JSON.stringify(this.config.movePin || null)) return this.getState();
    if (next) this.config.movePin = next; else delete this.config.movePin;
    await this.save(); return this.getState();
  }
  // `ended`: the status no longer shows the hold's job open (account applyStatus). Its number stays (`restoreReleased`)
  // until the window read how it ended — kept, undone or failed — whoever let the hold go (GPT restore3 GA1). A hold
  // of a request whose answer was lost says so (`lost`, kept across releases the window has not read): the keys it
  // brought never came, and the window asks for them again (GPT restore3-r2 GA1).
  async releaseServerRestore({ ended = false } = {}) {
    const hold = this.config?.serverRestore;
    if (!hold) return this.getState();
    delete this.config.serverRestore;
    const lost = !hold.jobId || hold.adopted?.lost === true || this.config.restoreReleased?.lost === true;
    if (ended && (hold.jobId || lost)) this.config.restoreReleased = { ...(hold.jobId ? { jobId: hold.jobId } : {}), at: new Date(this.now()).toISOString(), ...(lost ? { lost: true } : {}) };
    await this.save(); return this.getState();
  }
  // The window read the released job (`jobId`), or a new restore starts (none given): the number goes.
  async clearRestoreReleased(jobId) {
    if (!this.config?.restoreReleased || (jobId !== undefined && this.config.restoreReleased.jobId !== jobId)) return this.getState();
    delete this.config.restoreReleased;
    await this.save(); return this.getState();
  }
  async setAutomatic(enabled) {
    if (this.job) throw new Error('진행 중인 작업이 끝난 뒤 변경해 주세요.');
    if (typeof enabled !== 'boolean' || this.config?.mode !== 'backup' || !this.config.repositoryId) throw new Error('자동 백업을 설정할 수 없습니다.');
    if (enabled && !this.hasRecovery()) throw new Error('복구 키를 먼저 저장해 주세요.');
    this.config.automatic = enabled;
    if (!enabled) this.config.pausedUntil = null;
    await this.save(); return this.getState();
  }
  assertBackupReady() {
    if (this.config?.mode !== 'backup' || this.config.readOnly || !this.config.repositoryId) throw new Error('백업용 연결을 먼저 준비해 주세요. 복구 전용 연결에서는 실행할 수 없습니다.');
    if (this.config.serverRestore) throw Object.assign(new Error('되돌리기가 끝날 때까지 백업을 쉽니다.'), { code: 'RESTORE_PENDING' });
    if (this.config.movedTo) throw Object.assign(new Error('이 PC의 백업은 다른 PC로 옮겨졌습니다.'), { code: 'MOVED' });
    // The server status this run or window read (accountHold): nothing is written while a restore runs or waits, or
    // while the account is over its limit — a fill included (GPT workbackup-runstatus GA1).
    if (this.accountHold === 'restore') throw Object.assign(new Error('되돌리기가 끝날 때까지 백업을 쉽니다.'), { code: 'RESTORE_PENDING' });
    if (this.accountHold === 'over-quota') throw Object.assign(new Error('백업 용량을 넘어 새 백업을 쉽니다. 백업할 폴더를 줄여 주세요.'), { code: 'OVER_QUOTA' });
    if (!this.secret) throw new Error('저장된 인증 정보를 다시 연결해 주세요.');
    if (!this.hasRecovery()) throw new Error('복구 키를 먼저 저장한 뒤 백업을 시작해 주세요.');
  }
  async pauseAutomatic(minutes) {
    if (this.job || this.stopping) throw new Error('진행 중인 작업이 끝난 뒤 변경해 주세요.');
    this.assertBackupReady();
    if (![60, 240, 720].includes(minutes) || !this.config.automatic) throw new Error('자동 백업을 켠 뒤 1시간·4시간·12시간 중에서 선택해 주세요.');
    this.config.pausedUntil = new Date(this.now() + minutes * 60000).toISOString();
    await this.save(); return this.getState();
  }
  async resumeAutomatic() {
    if (this.job || this.stopping) throw new Error('진행 중인 작업이 끝난 뒤 변경해 주세요.');
    this.assertBackupReady();
    if (!this.config.automatic) throw new Error('보호 시작으로 자동 백업을 먼저 켜 주세요.');
    this.config.pausedUntil = null; await this.save(); return this.getState();
  }
  /** The folders, changed after setup (4.2 「폴더 더하기 · 빼기」). A folder added is checked as at setup; a folder taken
   *  out is kept in `removedSources`, and its backups stay 30 days (retain) and come back with a whole restore until
   *  then. Taken out and added again, it is a chosen folder as before. At least one folder stays. */
  async changeSources(sources) {
    return this.operation('sources', async () => {
      if (this.config?.mode !== 'backup' || this.config.readOnly || !this.config.repositoryId) throw new Error('백업을 설정한 뒤 폴더를 바꿀 수 있습니다.');
      if (!Array.isArray(sources) || sources.some(s => typeof s !== 'string')) throw new Error('백업할 폴더를 확인해 주세요.');
      const old = this.config.sources;
      const kept = old.filter(o => sources.some(s => same(s, o)));
      const asked = sources.filter((s, i) => !old.some(o => same(o, s)) && sources.findIndex(t => same(t, s)) === i);
      const added = [];
      if (asked.length) {
        for (const real of await validateSources(asked, [...this.forbidden(), ...(!this.isCloud() ? [path.dirname(this.config.repository)] : [])])) {
          if ([...kept, ...added].some(k => same(k, real))) continue; // the same folder by another spelling
          if ([...kept, ...added].some(k => overlap(k, real))) throw new Error('서로 포함되는 작업 폴더는 하나만 선택해 주세요.');
          added.push(real);
        }
      }
      const next = [...kept, ...added];
      if (!next.length) throw new Error('백업할 폴더를 하나 이상 남겨 주세요.');
      if (next.length > 30) throw new Error('백업할 폴더를 1~30개 선택해 주세요.');
      const removed = old.filter(o => !next.some(s => same(s, o)));
      if (!added.length && !removed.length) return this.getState();
      const at = new Date(this.now()).toISOString();
      const out = [...(this.config.removedSources || []).filter(r => ![...next, ...removed].some(p => same(p, r.path))), ...removed.map(p => ({ path: p, at }))];
      // A folder taken out is no longer one that is missing: the notice of it goes with it.
      const before = missingWarning(this.config.missingSources || []);
      const missing = (this.config.missingSources || []).filter(m => next.some(s => same(s, m)));
      if (before && typeof this.config.warning === 'string' && this.config.warning.includes(before)) this.config.warning = this.config.warning.replace(before, missingWarning(missing) || '').trim() || null;
      this.config.missingSources = missing.length ? missing : null;
      this.config.sources = next; this.config.removedSources = out.length ? out : null;
      await this.save(); return this.getState();
    });
  }
  async protectNow({ registerStartup } = {}) {
    this.assertBackupReady();
    return this.operation('protect', async () => {
      this.stage('보호 시작 전 연결과 작업 폴더 확인 중');
      await this.identity();
      await validateSources(this.config.sources, this.forbidden());
      this.config.protectRun = { phase: 'startup', startedAt: new Date(this.now()).toISOString() };
      await this.save();
      try {
        this.stage('Windows 자동 실행 확인 중');
        try {
          if (typeof registerStartup !== 'function' || await registerStartup() !== true) throw new Error('Windows 시작 등록을 확인하지 못했습니다.');
          this.config.startupWarning = null;
        } catch (e) { this.config.startupWarning = this.clean(e.message); }
        this.config.protectRun.phase = 'enable';
        this.config.automatic = true; this.config.pausedUntil = null; await this.save();
        this.config.protectRun.phase = 'backup'; await this.save();
        await this.backupBody();
        this.config.protectRun.phase = 'done'; this.config.protectRun.finishedAt = new Date(this.now()).toISOString();
        await this.save(); return this.getState();
      } catch (e) {
        this.config.protectRun.phase = 'failed'; this.config.protectRun.finishedAt = new Date(this.now()).toISOString();
        await this.save().catch(() => {}); throw e;
      }
    });
  }
  async backupNow() {
    return this.operation('backup', () => this.backupBody());
  }
  async backupBody() {
      this.assertBackupReady();
      this.lastAttempt = this.now();
      this.config.lastAttemptAt = new Date(this.lastAttempt).toISOString(); await this.save();
      await this.identity();
      const { present, missing } = await this.sourcesNow();
      const runTag = `run:${crypto.randomUUID()}`;
      this.stage('작업 파일 백업 중');
      // OneDrive online-only files would be downloaded by reading them; OneDrive keeps them (4.2 step 7, review GA1).
      // Exit 3 (some files could not be read) still saves the snapshot. With the list U of what was not read, it is kept
      // as a partial one (4.2 「완료본 · 부분 판 · 채움 판」); without a list it stays pending and goes as before.
      // A name ending in a dot or a space that restic told only while counting is not one another program holds: it
      // goes in no list of what was not read, and is told as a name this backup cannot hold (4.2 「이 백업에 담지 못하는
      // 이름」). Told while reading too, it stays what it was.
      const unreadable = [], odd = new Set(), read = new Set(); let partial = false, cut = false, oddCut = false;
      const onErrorItem = (item, during) => {
        if (item !== null && oddName(item) && during === 'scan') { if (odd.size < UNREADABLE_MAX) odd.add(item); else oddCut = true; return; }
        if (item !== null && oddName(item)) read.add(item);
        if (item !== null && unreadable.length < UNREADABLE_MAX) unreadable.push(item); else cut = true;
      };
      try {
        await this.run(['backup', '--json', ...(process.platform === 'win32' ? ['--exclude-cloud-files'] : []), '--exclude', MOVE_TEMP, '--host', this.hostName, '--tag', `${APP},vault:${this.config.vaultId},${runTag},pending`, '--', ...present],
          { onErrorItem });
      } catch (e) {
        if (e.exitCode !== 3 || !unreadable.length) throw e;
        partial = true;
      }
      for (const item of read) odd.delete(item);
      const pending = await this.snapshots([runTag, 'pending']);
      if (pending.length !== 1) throw new Error('새 백업을 정확하게 확인하지 못했습니다. 이전 정상 백업은 유지됩니다.');
      if (partial) {
        // The list goes in first, as this run's meta snapshot; only then is the snapshot marked partial — so a partial
        // snapshot always has its list, and one left without (a run that died in between) stays pending (4.2 「순서」).
        this.stage('읽지 못한 파일 목록 저장 중');
        await this.run(['backup', '--stdin', '--stdin-filename', 'workbackup-unreadable.json', '--host', this.hostName, '--tag', `${APP},vault:${this.config.vaultId},${runTag},meta`],
          { stdinText: JSON.stringify({ v: 1, unreadable, cut }) });
        const metas = await this.snapshots([runTag, 'meta']);
        if (metas.length !== 1) throw new Error('읽지 못한 파일 목록을 확인하지 못했습니다. 이전 정상 백업은 유지됩니다.');
        await this.keepList(metas[0].id, { v: 1, unreadable, cut });
      }
      this.stage('저장 구조 확인 중');
      try { await this.run(['check'], { timeoutMs: 1800000 }); }
      catch (e) { if (e.exitCode !== 11) this.config.health = { status: 'attention', checkedAt: new Date(this.now()).toISOString(), detail: '저장소 점검이 끝나지 않았습니다. 기존 백업의 현재 무결성도 보장하지 않습니다.' }; throw e; }
      if (partial) {
        // A partial snapshot does not take the complete one's place: the last complete backup stays what a restore uses.
        // With none yet, what it could not read is in no backup at all, so it is the best there is and takes that place
        // until a complete one comes (4.2 「한 번도 읽힌 적 없는 파일」; 끝판 카본 A1 · A2 — else nothing to restore,
        // 「첫 백업이 끝났습니다」 with nothing to restore, and no 「사흘 넘게」).
        const first = !this.config.lastBackup;
        this.stage('부분 백업 기록 중');
        await this.run(['tag', '--add', 'partial', ...(first ? ['--add', VERIFIED] : []), '--remove', 'pending', pending[0].id]);
        const marked = await this.snapshots([runTag, 'partial']);
        if (marked.length !== 1) throw new Error('부분 백업 기록을 확인하지 못했습니다.');
        const s = marked[0];
        this.config.lastPartial = { id: s.id, at: s.time, unreadable: unreadable.length, cut, files: s.summary?.total_files_processed || 0, bytes: s.summary?.total_bytes_processed || 0,
          // The drives a file another program holds is on: the ones a fill asks the helper to copy (4.2 「도우미」).
          volumes: await lockedVolumes(unreadable) };
        if (first) {
          if (!s.tags.includes(VERIFIED)) throw new Error('부분 백업 기록을 확인하지 못했습니다.');
          this.config.lastBackup = { id: s.id, at: s.time, files: this.config.lastPartial.files, bytes: this.config.lastPartial.bytes };
        }
        this.lastSummary = s.summary || null; this.lastRun = 'partial';
        // No promise that an earlier backup holds them: a file made since the last complete one is in none (GPT GA2).
        const warn = () => [`다른 프로그램이 쓰는 중인 파일 ${unreadable.length}${cut ? '개 이상을' : '개를'} 이번 백업에 담지 못했습니다. 그 프로그램을 닫으면 다음 백업에 담깁니다.`, oddWarning(this.config.leftOutNames), missingWarning(missing)].filter(Boolean).join(' ');
        // Written down before the walk, which may take minutes (설계 검토 F7), with the names as known so far (r2 GA1).
        const before = await this.oddPending(s, present, odd, oddCut);
        this.config.warning = warn(); await this.save();
        await this.keepOddNames(s, present, odd, oddCut, before);
        this.config.warning = warn(); await this.save();
      } else {
        this.stage('백업 완료 기록 중');
        await this.run(['tag', '--add', VERIFIED, '--remove', 'pending', pending[0].id]);
        const promoted = await this.snapshots([runTag, VERIFIED]);
        if (promoted.length !== 1) throw new Error('백업 완료 기록을 확인하지 못했습니다.');
        const s = promoted[0];
        this.config.lastBackup = { id: s.id, at: s.time, files: s.summary?.total_files_processed || 0, bytes: s.summary?.total_bytes_processed || 0 };
        this.config.lastPartial = null;
        this.lastSummary = s.summary || null; this.lastRun = 'complete';
        const warn = () => [oddWarning(this.config.leftOutNames), missingWarning(missing)].filter(Boolean).join(' ') || null;
        const before = await this.oddPending(s, present, odd, oddCut);
        this.config.warning = warn(); await this.save();
        await this.keepOddNames(s, present, odd, oddCut, before);
        this.config.warning = warn(); await this.save();
      }
      let busy = false;
      if (!this.config.health || this.config.health.status !== 'ok' || this.now() - Date.parse(this.config.health.checkedAt) >= (this.isCloud() ? 30 : 1) * DAY) {
        try { await this.fullCheck(); }
        catch (e) { busy = e.exitCode === 11; this.config.warning = busy ? '백업은 저장했고, 다른 작업이 백업 저장소를 쓰는 중이라 전체 데이터 점검은 다음 회차로 미뤘습니다.' : '백업은 저장했지만 전체 데이터 점검을 완료하지 못했습니다. 백업 위치와 연결을 확인한 뒤 다시 점검해 주세요.'; }
      }
      // Still locked by another process: the sample restore and the cleanup wait for the next run (review B3).
      if (!busy) {
        const probeInterval = this.config.lastProbe?.reason === 'limit' ? 30 * DAY : 7 * DAY;
        if (!this.config.lastProbe || this.now() - time(this.config.lastProbe.at) >= probeInterval) await this.probeBody();
        if (this.config.health?.status === 'ok' && !this.config.probeHold) {
          try { await this.retain(); } catch (e) { this.config.warning = `백업은 저장했습니다. 오래된 백업 정리는 보류합니다: ${this.clean(e.message)}`; }
        }
      }
      await this.save(); return this.getState();
  }
  /** The names found before (4.2 「이 백업에 담지 못하는 이름」), whether more were found than those (`cut`), and the count told:
   *  those in ODD_FILE with those the window shows. The file is taken as it reads, whichever backup wrote it, as each is
   *  looked at again before it is told. Which is newer is told by the turn each was written at (`seq`, r6 GA7): a file
   *  past the settings' (one stopped after writing it, before the settings — r4 GA1 · GA6) says itself whether more were
   *  found (설계 검토 기록 5 F1); one behind them (its write failed since, 기록 5 F3) holds fewer than there are. A file
   *  that cannot be read leaves those shown, and there may be more (r5 GA2 · GA8). With none there, those shown, more
   *  only as the settings say (r4 GA5, 설계 검토 기록 4 F1; r3 GA3). */
  async oddBefore() {
    const shown = this.config.leftOutNames, held = this.config.leftOutHeld, heldSeq = held?.seq || 0;
    // Those shown before are held too, as a write that failed leaves them there alone (설계 검토 기록 8 F3 · F4).
    this.oddFile = null; this.oddUnread = false; this.oddShownBefore = shown?.names || [];
    // Read whether or not the settings point at it: a backup may stop after writing it before the settings ever did,
    // and the turns go on from it (설계 검토 기록 6 F2).
    let file = null, none = false;
    try { file = json(await fs.readFile(path.join(this.stateDir, ODD_FILE), 'utf8')); } catch (e) { none = e?.code === 'ENOENT'; }
    const ok = typeof file?.id === 'string' && Array.isArray(file.names) && file.names.every(p => typeof p === 'string' && p.length >= 1 && p.length <= 32767);
    if (!shown && !held && !ok) return null;
    // The count is the hold's: the one shown may carry one kept back as maybe another, and read back it would grow (설계
    // 검토 기록 8 F1). Settings from before the hold have only the one shown.
    let names = shown?.names || [], cut = shown?.cut === true, count = held ? held.count : shown?.count || 0, says = null, known = null, older = null, dropped = held?.dropped || 0;
    if (ok) {
      const seq = Number.isSafeInteger(file.seq) && file.seq >= 0 ? file.seq : 0;
      const many = Number.isSafeInteger(file.count) && file.count >= file.names.length ? file.count : file.names.length;
      const pushed = Number.isSafeInteger(file.dropped) && file.dropped >= 0 && file.dropped <= many - file.names.length ? file.dropped : 0;
      this.oddFile = { id: file.id, seq, names: file.names, cut: file.cut === true, count: many, dropped: pushed };
      names = [...new Set([...file.names, ...names])].sort();
      cut = seq > heldSeq ? file.cut === true : seq < heldSeq || cut || !!held?.cut || file.cut === true;
      // How many the hold stands for, those it could not name too (past its limit, or a write that failed — GPT r7 GA3 ·
      // GA4 · GA5): a file past the settings says it alone, those shown aside.
      if (seq > heldSeq) { count = many; says = many - file.names.length; known = file.names; dropped = pushed; }
      else {
        // A file behind the settings counts no more than they do: names let go since are not counted again (기록 8 F5).
        if (seq >= heldSeq) count = Math.max(count, many);
        // A file behind the settings (a write failed since) may hold names the count is not for — those since let go
        // (GPT r8 GA6): what is known by name is told with the folders backed up (oddShow).
        if (seq < heldSeq) older = file.names; else dropped = Math.max(dropped, pushed);
      }
    } else if (none) cut = cut || !!held?.cut;
    else { this.oddUnread = true; cut = true; }
    // Those counted but not known by name (`unknown`), the names they are counted against (`known`), and how many of them
    // were left out past the limit (`dropped`) rather than lost to a failure.
    known ??= names;
    return { names, cut, count: older ? count : Math.max(count, names.length), unknown: says ?? Math.max(0, count - known.length), known, older, shown: shown?.names || [], dropped };
  }
  /** Sets the names for backup `s` as known before the walk — what restic told, and those found before in the folders
   *  still backed up — not yet looked through (`checked` false), so a run that stops in the walk leaves no backup told
   *  as holding all (r2 GA1); and holds what restic told with all held before, so none is lost if it stops there (r4
   *  GA2 · r5 GA1). The names found before. */
  async oddPending(s, present, told, toldCut) {
    const before = await this.oddBefore();
    const all = topMost([...told, ...(before?.names || []).filter(p => present.some(f => inside(f, p) !== null))]);
    await this.oddHold(all, this.oddShow(s, all, { cut: toldCut, before, checked: false, seen: [...told] }), { present, complete: false });
    return before;
  }
  /** `all` as the names backup `s` could not hold, as the window shows them. With `before` past what was held — past
   *  200,000 names, or with a names file that could not be read or written — and not every folder looked through, there
   *  may be more (`cut`), and those counted but not known by name stay counted: where they are is not known (r6 GA4 ·
   *  GA5 · GA6 · GA8, 설계 검토 기록 6 F1).
   *  Whether there may be more. */
  oddShow(s, all, { cut, before, checked, seen = all }) {
    // Those counted but not known by name stay counted; those known are looked at again — so a count kept once does not
    // keep itself (설계 검토 기록 6 F1).
    // Of those, any found now not known by name before may be them, so they are not told twice (GPT r7 GA1) — all but
    // one: a name found now may be another, so one stays not known by name until a walk of every folder (설계 검토
    // 기록 7 F1).
    // With a file behind the settings, only those shown are known by name (GPT r8 GA6): any of that file may have been
    // let go since, a chosen folder away or not (GPT r9 GA6) — one held there by name may be counted twice, never none.
    // A name of that file found again is no new one.
    const older = before?.older || null, olderKeys = new Set((older || []).map(nameKey));
    const known = new Set((older ? before.shown : before?.known || before?.names || []).map(nameKey));
    const had = !before?.cut ? 0 : older ? Math.max(0, before.count - known.size) : before.unknown;
    // Those found now, not known by name, fill first those left out past the limit (found again, GPT r7 GA1), then those
    // lost to a failure — all but one of these when a name is new (설계 검토 기록 7 F1). Before the walk only those
    // restic told are found now.
    const fresh = had ? seen.filter(p => !known.has(nameKey(p))) : [], dropped = Math.min(had, before?.dropped || 0), lost = had - dropped;
    // One of those left out past the limit stays, a name found now being maybe another: so a count with some left out
    // does not come down to none before a walk of every folder (기록 8 F1) — one past them at most.
    const byDrop = Math.min(fresh.length, Math.max(0, dropped - (fresh.length ? 1 : 0))), floor = lost > 0 && fresh.some(p => !olderKeys.has(nameKey(p))) ? 1 : 0;
    const byLost = Math.min(fresh.length - byDrop, Math.max(0, lost - floor)), unknown = had - byDrop - byLost;
    this.oddDropped = dropped - byDrop; this.oddLost = lost - byLost;
    const past = !checked && !!before?.cut, count = past ? all.length + unknown : all.length, more = !!cut || past;
    this.oddUnknown = unknown;
    this.config.leftOutNames = count || !checked ? { at: s.time, count, names: oddList(all), cut: more, ...(checked ? {} : { checked: false }) } : null;
    this.lastOdd = count;
    return more;
  }
  /** Holds in ODD_FILE the names the next backup starts from — before the settings that point at it are saved, each
   *  write a turn on from the last (`seq`). Until a walk reads every folder (`complete`) they only grow: `all` with
   *  every one held before that is in a chosen folder (r5 GA1) — or, after a walk in time that could not read some
   *  folders, those in them and in a chosen folder not there now (설계 검토 기록 5 F2). After one, `all` with those
   *  held in a chosen folder not there now — an unplugged drive (r5 GA1 · GA5). A file that could not be read is left as
   *  it is until a walk of every chosen folder (r5 GA2 · GA8, 기록 5 F4), the settings saying it holds fewer (r6 GA1).
   *  None left, the file is written empty, not removed (r5 GA7). Written when they change; one that cannot be written
   *  leaves the file as it was, the settings a turn past it and `cut`. */
  async oddHold(all, cut, { present, complete, unread = null, gone = null }) {
    const chosen = this.config.sources || [], inChosen = p => chosen.some(f => inside(f, p) !== null), now = this.oddFile, held = this.config.leftOutHeld;
    // Those not known by name stay counted in the hold until a walk of every chosen folder — one away may hold them (GPT
    // r7 GA3).
    const every0 = complete && present.length >= chosen.length, keptDrop = every0 ? 0 : this.oddDropped || 0, carry = every0 ? 0 : (this.oddDropped || 0) + (this.oddLost || 0), heldSeq = held?.seq || 0;
    // Not written, so the settings go a turn past the file: one written since and not pointed at reads as no newer
    // (GPT r8 GA3).
    if (this.oddUnread && (!complete || present.length < chosen.length)) { this.config.leftOutHeld = { id: held?.id || 'unwritten', seq: heldSeq + 1, count: all.length + carry + (this.oddShownBefore || []).filter(p => inChosen(p) && !present.some(f => inside(f, p) !== null)).length, dropped: 0, cut: true }; return; }
    const away = p => inChosen(p) && !present.some(f => inside(f, p) !== null);
    // One looked at and not there under that very name is let go (GPT r8 GA2).
    const keep = [...new Set([...(now?.names || []), ...(this.oddShownBefore || [])])].filter(p => !gone?.has(p)).filter(complete ? away : unread ? p => away(p) || unread.some(d => inside(d, p) !== null) : inChosen);
    const every = keep.length ? [...new Set([...all, ...keep])].sort() : all;
    const names = [], max = this.oddHoldMax ?? UNREADABLE_MAX, maxChars = this.oddHoldChars ?? ODD_HOLD_CHARS; let chars = 0;
    // Past the limit, those held already go first and the new wait: a name held is not pushed out by a new one that sorts
    // before it (GPT r8 GA4 · GA5). A new one left out is counted, and the next walk finds it again.
    const was = new Set(now?.names || []), order = was.size ? [...every.filter(p => was.has(p)), ...every.filter(p => !was.has(p))] : every;
    for (const p of order) { if (names.length >= max || chars + p.length > maxChars) break; names.push(p); chars += p.length; }
    if (order !== every) names.sort();
    // How many it stands for: those it could not name past its limit too (GPT r7 GA3 · GA4).
    // Those left out now and those left out before not found again may be the same: the more of them is counted; those
    // lost to a failure come on top.
    const dropped = Math.max(every.length - names.length, keptDrop), count = names.length + dropped + carry - keptDrop;
    const more = !!cut || names.length < every.length || carry > 0 || (!complete && !!now?.cut), file = path.join(this.stateDir, ODD_FILE);
    const seq = Math.max(heldSeq, now?.seq || 0) + 1;
    // The same file as it is stays — unless the settings are past it (a write failed since): it is written again a turn
    // past them, or it would read as the older (GPT r7 GA6).
    if (now && heldSeq <= now.seq && now.cut === more && now.count === count && (now.dropped || 0) === dropped && now.names.length === names.length && now.names.every((p, i) => p === names[i])) { this.config.leftOutHeld = { id: now.id, seq: now.seq, count, dropped, cut: more }; return; }
    if (!names.length && !more && !now && !held) return;
    const id = crypto.randomUUID();
    try { await atomic(file, JSON.stringify({ v: 1, id, seq, names, count, dropped, cut: more })); this.oddFile = { id, seq, names, cut: more, count, dropped }; this.config.leftOutHeld = { id, seq, count, dropped, cut: more }; }
    catch { this.config.leftOutHeld = { id: now?.id || 'unwritten', seq, count, dropped, cut: true }; }
  }
  /** What backup `s` could not hold for a name ending in a dot or a space (4.2 「이 백업에 담지 못하는 이름」): those restic
   *  told while counting (`told`), and — as restic stops counting once the backup is saved and tells none beside the
   *  name without its end (GPT GA2, 설계 검토 F1) — those a walk of the folders backed up (`present`) finds, at every
   *  backup. A walk that read every folder says it all, what was found before (`before`) aside. One that ran out of
   *  time (GPT GA3) or could not read a folder (GA5 · r2 GA6) also keeps each found before that is still there under
   *  that very name — not one Windows finds as one found now or kept already (r2 GA3 · r5 GA3) — and says it did not see
   *  all (`checked` false). */
  async keepOddNames(s, present, told, toldCut, before) {
    this.stage('이름 때문에 담지 못한 파일 확인 중');
    const walked = await walkOdd(present, { budgetMs: this.oddWalkBudgetMs ?? ODD_WALK_BUDGET, max: UNREADABLE_MAX });
    const found = topMost([...told, ...walked.names]), checked = walked.done && !walked.failed;
    if (checked) return this.oddHold(found, this.oddShow(s, found, { cut: toldCut || walked.more, before, checked }), { present, complete: true });
    // A walk in time read every folder but those it could not: one found before elsewhere, not found now, is gone (설계
    // 검토 기록 5 F2). Past the time, or with too many not read to tell, any may be there still.
    const unread = walked.done && !walked.unreadCut ? walked.unread : null, notRead = p => !unread || unread.some(d => inside(d, p) !== null);
    const exact = new Set(found.map(nameKey));
    const by = Date.now() + (this.oddLookBudgetMs ?? ODD_LOOK_BUDGET);
    const ask = (before?.names || []).filter(p => !exact.has(nameKey(p)) && present.some(f => inside(f, p) !== null) && notRead(p));
    const look = await stillThere(ask, by);
    // Those looked at and not there are gone — but not under a chosen folder gone by the end of the walk, where nothing
    // is there (설계 검토 기록 7 F2, GPT r8 GA2).
    // The chosen folders looked at again after those names: one gone meanwhile tells nothing of them (기록 8 F2), nor do
    // any when they could not all be looked at in time (GPT r9 GA5).
    const there = new Set(look.names), roots = await stillThere(present, Date.now() + (this.oddLookBudgetMs ?? ODD_LOOK_BUDGET)), rootGone = present.filter(d => walked.unread.includes(d) || !roots.done || !roots.names.includes(d));
    const gone = new Set(ask.filter(p => !there.has(p) && !rootGone.some(r => inside(r, p) !== null)));
    // One found now under another spelling is told once, as found now, when it is that very file (r2 GA3) — any of those
    // found under that spelling (r4 GA3), or kept already under another (r5 GA3); two files in a folder that tells case
    // apart stay two (r3 GA1). Each is looked at once, by its volume and number (r6 GA3); one that cannot be stays.
    const spellings = new Map();
    for (const p of [...found, ...look.names]) spellings.set(caseKey(p), (spellings.get(caseKey(p)) || 0) + 1);
    const taken = new Set(), kept = [];
    // Within each spelling: two names that differ past case are two, one file under both or not (GPT r7 GA2).
    const same = async p => { const id = await fileId(p, by); return id && `${caseKey(p)}\0${id}`; };
    for (const p of found) if (spellings.get(caseKey(p)) > 1) { const id = await same(p); if (id) taken.add(id); }
    for (const p of look.names) {
      const id = spellings.get(caseKey(p)) > 1 ? await same(p) : null;
      if (id && taken.has(id)) continue;
      if (id) taken.add(id);
      kept.push(p);
    }
    const all = topMost([...found, ...kept]);
    await this.oddHold(all, this.oddShow(s, all, { cut: toldCut || walked.more, before, checked }), { present, complete: false, unread, gone });
  }
  /** The chosen folders that are there now. One that is gone — an unplugged drive, a folder moved or deleted — is
   *  left out of this backup, and the backups that hold it are kept (retain) and restored (restoreLatest); with
   *  none there the run fails as before (4.2 「사라진 원본 폴더」). Only "not there" counts: a folder that is there
   *  but cannot be read, or is no longer a plain folder, still stops the run. */
  async sourcesNow() {
    const present = [], missing = [];
    for (const source of this.config.sources) {
      try { await fs.lstat(source); present.push(source); }
      catch (e) { if (e.code !== 'ENOENT') throw e; missing.push(source); }
    }
    this.lastMissing = missing.length;
    this.config.missingSources = missing.length ? missing : null;
    if (!present.length) throw new Error('백업할 폴더를 모두 찾을 수 없습니다. 외장 드라이브라면 다시 연결해 주세요. 그 폴더가 든 이전 백업은 지우지 않습니다.');
    await validateSources(present, this.forbidden());
    return { present, missing };
  }
  /** What a partial snapshot could not read: its list snapshot read whole (a plain dump keeps only the tail). */
  async unreadableList(meta) {
    const decoder = new StringDecoder('utf8'); let text = '';
    await this.run(['dump', meta.id, '/workbackup-unreadable.json'], { timeoutMs: 600000, consumeStdout: async input => {
      for await (const chunk of input) { text += decoder.write(chunk); if (text.length > 64 * 1024 * 1024) throw new Error('읽지 못한 파일 목록이 너무 큽니다.'); }
      text += decoder.end();
    } });
    return checkList(json(text));
  }
  /** A list snapshot's content, kept in the state folder by its id once read (it never changes): retain() reads the
   *  lists of every partial snapshot it walks each run, and reading them from the repository each hour is slow. */
  async cachedList(meta) {
    this.listCache ||= new Map();
    if (this.listCache.has(meta.id)) return this.listCache.get(meta.id);
    const file = path.join(this.stateDir, 'lists', `${meta.id}.json`);
    let list = null;
    try { list = checkList(JSON.parse(await fs.readFile(file, 'utf8'))); } catch { list = null; }
    if (!list) { list = await this.unreadableList(meta); await this.keepList(meta.id, list); }
    this.listCache.set(meta.id, list); return list;
  }
  async keepList(id, list) {
    if (!isId(id)) return;
    try { await fs.mkdir(path.join(this.stateDir, 'lists'), { recursive: true }); await atomic(path.join(this.stateDir, 'lists', `${id}.json`), JSON.stringify(list)); } catch { /* only a cache */ }
  }
  /** A fill's meta, kept in the state folder by its id once read, as lists are. */
  async cachedFill(meta) {
    this.fillCache ||= new Map();
    if (this.fillCache.has(meta.id)) return this.fillCache.get(meta.id);
    const file = path.join(this.stateDir, 'fills', `${meta.id}.json`);
    let info = null;
    try { info = checkFill(JSON.parse(await fs.readFile(file, 'utf8'))); } catch { info = null; }
    if (!info) {
      const decoder = new StringDecoder('utf8'); let text = '';
      await this.run(['dump', meta.id, '/workbackup-fill.json'], { timeoutMs: 600000, consumeStdout: async input => {
        for await (const chunk of input) { text += decoder.write(chunk); if (text.length > 64 * 1024 * 1024) throw new Error('채움 백업 기록이 너무 큽니다.'); }
        text += decoder.end();
      } });
      info = checkFill(json(text)); await this.keepFill(meta.id, info);
    }
    this.fillCache.set(meta.id, info); return info;
  }
  async keepFill(id, info) {
    if (!isId(id)) return;
    try { await fs.mkdir(path.join(this.stateDir, 'fills'), { recursive: true }); await atomic(path.join(this.stateDir, 'fills', `${id}.json`), JSON.stringify(info)); } catch { /* only a cache */ }
  }
  /** The newest fill of partial snapshot `s` as seen from `folder`: its selector for that folder through the link root,
   *  what it was asked to read there (`only`) and could not (`blind`), as lower-case paths inside the folder. Null when
   *  it has none, was asked nothing there, or read nothing there (then it holds no node under the folder to list). */
  async fillFor(all, s, folder) {
    const f = fillsIn(all, s)[0];
    if (!f) return null;
    const info = await this.cachedFill(listsIn(all, f)[0]);
    const mapped = linked(info.roots, folder);
    if (!mapped || info.fills !== runOf(s)) return null;
    const rels = list => new Set(list.map(item => asSeen(folder, item)).filter(rel => rel !== null).map(rel => rel.toLowerCase()));
    // Its list cut short, it says nothing of what it read there: nothing to use (as before, every path it was asked blind).
    if (info.cut) return null;
    const only = rels(info.asked), blind = rels(info.failed);
    // Asked for the folder itself, it read it whole only if it holds a folder there: the folder may have been a file then
    // (r8 GA2 — a restore would list a file as a folder and fail). Asked only when that could matter (r9 GA3).
    if (only.has('') && !covered(blind, '') && !(await this.fillHasFolder(f.id, subtreeOf(mapped)))) only.delete('');
    if (![...only].some(rel => !covered(blind, rel))) return null;
    return { snapshot: f, selector: `${f.id}:${subtreeOf(mapped)}`, only, blind };
  }
  /** Whether fill `id` holds `tree` as a folder: one `restic ls` without recursion, kept for this engine (a fill never changes).
   *  It fails by restic's exit code only, as a restore's other listings do (Fable 후속 5). */
  async fillHasFolder(id, tree) {
    this.fillFolders ||= new Map();
    const key = `${id}:${tree}`;
    if (!this.fillFolders.has(key)) { let dir = false; await this.listNodes(id, [tree], node => { if (node.path === tree && node.type === 'dir') dir = true; }, { recursive: false, stderrFails: false }); this.fillFolders.set(key, dir); }
    return this.fillFolders.get(key);
  }
  /** The drives a fill would copy now, or null (4.2 「채움의 비용」): the newest partial snapshot is not filled yet and
   *  the last attempt — done or not — is 4 hours back. */
  fillDue(now = this.now()) {
    const c = this.config, p = c?.lastPartial, f = c?.lastFill;
    if (!p?.volumes?.length || c.mode !== 'backup' || c.readOnly) return null;
    // A run that rests (server restore, moved seat, the status this run read) asks no fill either (GPT runstatus GA1).
    if (c.serverRestore || c.movedTo || this.accountHold) return null;
    if (f && (f.partial === p.id || now - Date.parse(f.at) < FILL_SPACING)) return null;
    return p.volumes;
  }
  /** Fill (4.2): read again, through the helper's links to each drive's shadow copy, what the newest partial snapshot
   *  could not, into a fill snapshot. `links` [{ volume: 'C:', root }] are the folders the helper linked; none (the
   *  helper did not make them) still counts as an attempt, so the next one waits its 4 hours. */
  async fillNow({ links } = {}) {
    return this.operation('fill', async () => {
      // A fill is on top of a backup that is already saved: one that fails is noted for the 4 hours, not an error of the
      // backup (the window does not turn red). Busy — another process holds the repository — tries again next run.
      try { return await this.fillBody(links); }
      catch (e) {
        if (e.message === 'FILL_INPUT') throw e;
        const p = this.config.lastPartial, busy = e.exitCode === 11;
        if (p && !busy) { this.config.lastFill = { at: new Date(this.now()).toISOString(), partial: p.id, id: null, outcome: 'failed', exitCode: e.exitCode ?? null }; await this.save().catch(() => {}); }
        return { outcome: busy ? 'busy' : 'failed', exitCode: e.exitCode ?? null };
      }
    });
  }
  async fillBody(links) {
    this.assertBackupReady();
    if (!Array.isArray(links) || links.length > 26 || links.some(l => !l || typeof l.volume !== 'string' || !/^[A-Z]:$/.test(l.volume) || typeof l.root !== 'string' || !/^[A-Za-z]:\\[^<>"|?*\0]+$/.test(l.root) || l.root.length > 1024)
      || new Set(links.map(l => l.volume)).size !== links.length) throw new Error('FILL_INPUT');
    const p = this.config.lastPartial, started = this.now();
    if (!p) return { outcome: 'skipped', reason: 'no-partial' };
    const attempt = async (extra) => { this.config.lastFill = { at: new Date(this.now()).toISOString(), partial: p.id, ...extra }; await this.save(); };
    if (!links.length) { await attempt({ id: null, outcome: 'no-link' }); return { outcome: 'skipped', reason: 'no-link' }; }
    await this.identity();
    const all = await this.snapshots();
    const s = all.find(x => x.id === p.id && x.hostname === this.hostName && x.tags.includes('partial'));
    const lists = s ? listsIn(all, s) : [];
    if (lists.length !== 1 || !runOf(s)) { await attempt({ id: null, outcome: 'no-list' }); return { outcome: 'skipped', reason: 'no-list' }; }
    const list = await this.cachedList(lists[0]);
    const roots = links.map(l => ({ from: l.root.replace(/[\\/]+$/, ''), to: l.volume }));
    for (const r of roots) if (!(await fs.stat(r.from)).isDirectory()) throw new Error('FILL_INPUT');
    // What it could not read, through the link of its drive. A path gone since — not in the shadow copy either — is
    // not asked: a restore then takes it from the earlier backups as before.
    const asked = [], targets = [];
    for (const item of list.unreadable) {
      const mapped = linked(roots, item);
      if (!mapped) continue;
      try { await fs.lstat(mapped); } catch (e) { if (e.code === 'ENOENT' || e.code === 'ENOTDIR') continue; }
      asked.push(item); targets.push(mapped);
    }
    if (!targets.length) { await attempt({ id: null, outcome: 'nothing' }); return { outcome: 'skipped', reason: 'nothing' }; }
    const runTag = `run:${crypto.randomUUID()}`;
    const listFile = path.join(this.stateDir, `fill-${runTag.slice(4)}.list`);
    const failedAt = []; let failedCut = false;
    this.stage('다른 프로그램이 쓰던 파일을 담는 중');
    // Each path ends in NUL, the last one too: restic 0.19.1 refuses a list without the trailing zero byte (exit 1).
    await fs.writeFile(listFile, targets.map(t => t + '\0').join(''), { flag: 'wx' });
    try {
      await this.run(['backup', '--json', ...(process.platform === 'win32' ? ['--exclude-cloud-files'] : []), '--exclude', MOVE_TEMP, '--files-from-raw', listFile, '--host', this.hostName, '--tag', `${APP},vault:${this.config.vaultId},${runTag},pending`],
        { onErrorItem: item => { if (item !== null && failedAt.length < UNREADABLE_MAX) failedAt.push(item); else failedCut = true; } });
    } catch (e) { if (e.exitCode !== 3) throw e; }
    finally { await fs.rm(listFile, { force: true }).catch(() => {}); }
    const pending = await this.snapshots([runTag, 'pending']);
    if (pending.length !== 1) throw new Error('채움 백업을 정확하게 확인하지 못했습니다.');
    // What it could not read, as original paths; one not under a link root is not ours to place, so the whole is cut.
    const back = item => { const r = typeof item === 'string' && roots.find(x => item.length > x.from.length && item.slice(0, x.from.length).toLowerCase() === x.from.toLowerCase() && /[\\/]/.test(item[x.from.length])); return r ? r.to + item.slice(r.from.length) : null; };
    const failed = [...new Set(failedAt.map(back).filter(Boolean))];
    const info = { v: 1, fills: runOf(s), roots, asked, failed, cut: failedCut || failedAt.some(item => !back(item)) };
    // The meta goes in first; only then is it marked fill — a fill without its meta stays pending and goes after 24 h.
    await this.run(['backup', '--stdin', '--stdin-filename', 'workbackup-fill.json', '--host', this.hostName, '--tag', `${APP},vault:${this.config.vaultId},${runTag},meta`],
      { stdinText: JSON.stringify(info) });
    const metas = await this.snapshots([runTag, 'meta']);
    if (metas.length !== 1) throw new Error('채움 백업 기록을 확인하지 못했습니다.');
    await this.keepFill(metas[0].id, info);
    this.stage('채움 백업 기록 중');
    await this.run(['tag', '--add', 'fill', '--add', `fills:${info.fills}`, '--remove', 'pending', pending[0].id]);
    const marked = await this.snapshots([runTag, 'fill']);
    if (marked.length !== 1) throw new Error('채움 백업 기록을 확인하지 못했습니다.');
    const read = info.cut ? 0 : asked.length - failed.length, left = list.unreadable.length - read;
    this.config.warning = [left > 0 ? `다른 프로그램이 쓰는 중인 파일 ${left}${list.cut || info.cut ? '개 이상을' : '개를'} 이번 백업에 담지 못했습니다. 그 프로그램을 닫으면 다음 백업에 담깁니다.` : '', oddWarning(this.config.leftOutNames), missingWarning(this.config.missingSources || [])].filter(Boolean).join(' ') || null;
    await attempt({ id: marked[0].id, outcome: 'fill', asked: asked.length, failed: failed.length, cut: info.cut });
    // left: what is still not in any snapshot of this run — 0 tells the run executable there is nothing to tell (4.2).
    return { outcome: 'fill', asked: asked.length, failed: failed.length, left: Math.max(0, left), ...(list.cut || info.cut ? { cut: true } : {}), durationMs: this.now() - started, newSnapshot: true, dataAdded: marked[0].summary?.data_added ?? null };
  }
  async fullCheck() {
    this.stage('전체 데이터 점검 중 — 큰 백업은 오래 걸릴 수 있습니다');
    try {
      await this.run(['check', '--read-data']);
      this.config.health = { status: 'ok', checkedAt: new Date(this.now()).toISOString(), snapshotId: this.config.lastBackup?.id || null, detail: '이 시각에 저장소의 전체 데이터를 읽어 점검했습니다. 그 뒤에 추가한 백업은 구조 점검 결과를 따릅니다.' };
    } catch (e) {
      // Busy (exit 11) proves nothing about the data: keep the last health, retry next run (review GA3).
      if (e.exitCode !== 11) this.config.health = { status: 'attention', checkedAt: new Date(this.now()).toISOString(), detail: this.clean(e.message) };
      throw e;
    } finally { await this.save(); }
  }
  async checkRepository() { return this.operation('check', async () => { await this.identity(); await this.fullCheck(); this.config.probeHold = null; await this.save(); return this.getState(); }); }
  async probeRestore() {
    this.assertBackupReady();
    return this.operation('probe', async () => { await this.identity(); await this.probeBody(); return this.getState(); });
  }
  async probeBody() {
    this.assertBackupReady();
    let snapshotId = null;
    const result = (value) => ({ at: new Date(this.now()).toISOString(), snapshotId, files: 0, bytes: 0, ...value });
    try {
      this.stage('작은 파일 복구 확인용 목록 읽는 중');
      const snapshots = await this.snapshots([VERIFIED], { host: this.hostName });
      // A failed sample is deterministic for this immutable snapshot. Recheck
      // that same sample; a different healthy file cannot clear its hold.
      const held = this.config.probeHold;
      const latest = held ? snapshots.find(s => s.id === held.snapshotId) : snapshots[0];
      if (!latest) this.config.lastProbe = result({ result: 'skipped', reason: 'no-snapshot' });
      else {
        snapshotId = latest.id;
        let sample;
        await this.run(['ls', '--json', '--recursive', snapshotId], { timeoutMs: 120000, consumeStdout: async input => { sample = await selectSample(input, snapshotId); } });
        if (!sample) this.config.lastProbe = result({ result: 'skipped', reason: 'no-small-file' });
        else {
          this.stage('작은 파일 1개 내려받아 해독 확인 중');
          let observed;
          await this.run(['dump', snapshotId, sample.path], { timeoutMs: 120000, consumeStdout: async input => { observed = await consumeSample(input, sample.size); } });
          if (!observed || observed.bytes !== sample.size) throw probeIssue('PROBE_SIZE', '표본 파일 내용의 크기가 백업 목록과 일치하지 않습니다.');
          this.config.lastProbe = result({ result: 'passed', reason: 'sample-decrypted', files: 1, bytes: observed.bytes });
          this.config.probeHold = null;
        }
      }
    } catch (e) {
      const mismatch = e.code === 'PROBE_SIZE';
      this.config.lastProbe = result({ result: mismatch ? 'failed' : e.code === 'PROBE_LIMIT' ? 'skipped' : 'incomplete', reason: mismatch ? 'size-mismatch' : e.code === 'PROBE_LIMIT' ? 'limit' : 'unconfirmed', detail: this.clean(e.message).slice(0, 1500) });
      if (mismatch) this.config.probeHold = { since: new Date(this.now()).toISOString(), snapshotId, cause: 'size-mismatch' };
      // Transport/engine errors don't prove corruption and don't trigger a new
      // automatic full download. Incomplete/skipped also cannot clear a hold.
    }
    await this.save(); return this.config.lastProbe;
  }
  async retain() {
    if (this.config.mode !== 'backup' || this.config.health?.status !== 'ok' || this.config.probeHold) throw new Error('이 저장소는 정리할 수 없습니다.');
    // 대량 삭제 · 변경 멈춤 (4.4): while a hold waits for the person, no backup is forgotten — the one before it stays by number.
    if (this.config.massHold) return;
    await this.identity();
    let now = this.now();
    if (this.isCloud()) {
      const probe = await this.probe(this.config.provider, this.cloudCredentials, { now }); now = probe.serverTime;
      const age = now - Date.parse(this.config.health.checkedAt);
      if (!Number.isFinite(age) || age < -300000 || age > 30 * DAY) throw new Error('최근 전체 점검과 서버 시간을 확인한 뒤 정리합니다.');
    }
    const all = await this.snapshots(); // Tag edits change IDs, so enumerate immediately before exact-ID deletion.
    // A recommended-backup snapshot is not this one's to keep or forget, as restoreLatest does not mix it in (끝판 카본 A2).
    const mine = s => s.hostname === this.hostName && !s.tags.includes('recommended-verified-v1');
    // This device's newest complete backup: another device's in the same customer repository is not this one's (4.6).
    const verified = all.filter(s => s.tags.includes(VERIFIED) && mine(s));
    const latest = verified[0];
    if (!latest || latest.id !== this.config.lastBackup?.id) throw new Error('가장 최근 백업 번호가 바뀌었습니다.');
    // Kept: the latest complete snapshot, and — when newer — the newest partial one with its list (meta, same run tag),
    // so the files read since are not lost while one stays locked (4.2). Older partial and list snapshots go after 24 h.
    const keep = new Set([latest.id]);
    // A partial snapshot without exactly one list is never counted, so it cannot push out a good one (GPT GA1).
    const listsOf = s => listsIn(all, s);
    const own = all.filter(mine);
    const listed = s => s.tags.includes('partial') && listsOf(s).length === 1;
    // A partial snapshot kept keeps its newest fill too, and a fill its meta (4.2 정리 규칙 — 다시 확인 N3).
    const hold = s => {
      keep.add(s.id);
      if (s.tags.includes('partial') || s.tags.includes('fill')) for (const list of listsOf(s)) keep.add(list.id);
      if (s.tags.includes('partial')) { const f = fillsIn(all, s)[0]; if (f && !keep.has(f.id)) hold(f); }
    };
    hold(latest);
    // 옮겨 오기 원본: the snapshot a reading PC is copying stays until the server's time for it ends (4.6 「move/pin」).
    const pinned = this.config.movePin && Date.parse(this.config.movePin.until) > now ? own.find(s => s.id === this.config.movePin.snapshotId) : null;
    if (pinned) hold(pinned);
    // 옮겨 오기 꾸러미 (4.6): this device's newest one stays, the older ones go like other snapshots after a day.
    const kit = own.find(s => s.tags.includes('movekit'));
    if (kit) keep.add(kit.id);
    // While the complete place is itself a partial snapshot (no backup has read everything yet), the listed partial
    // snapshots before it stay too: a file only they hold — one the later ones could not read — is in no other. This
    // is the vault whose first backups were partial under the previous version (GPT workbackup-missing GA1); a
    // backup that reads everything ends it, and then what is in none of its files is gone from the source.
    if (latest.tags.includes('partial')) for (const s of own) if (listed(s) && Date.parse(s.time) < Date.parse(latest.time)) hold(s);
    const partial = own.find(listed);
    if (partial && Date.parse(partial.time) > Date.parse(latest.time)) hold(partial);
    // A folder taken out keeps its backups 30 days (4.2 「폴더 더하기 · 빼기」), counted from the first cleanup that saw it
    // out, by this clock — the server's for a cloud vault — so a PC clock set wrong when it was taken out cannot end
    // them early. Then it leaves the list, and its backups go like any other.
    const removed = (this.config.removedSources || []).filter(r => { r.since ??= new Date(now).toISOString(); return !(now - Date.parse(r.since) >= REMOVED_KEEP); });
    this.config.removedSources = removed.length ? removed : null;
    const chosen = folder => this.config.sources.some(s => same(s, folder)) || removed.some(r => same(r.path, folder));
    // Each chosen folder — and one taken out not 30 days ago — keeps the backups a restore takes it from (restoreBases):
    // the newest complete snapshot that has it and, when newer, the newest partial one that has it. That partial one
    // need not be the newest of all: a folder taken out or not found while every backup since is partial is only in an
    // older partial one (끝판 카본 folders A1) — and an unplugged drive's only backup stays (4.2).
    for (const folder of foldersOf(own.filter(s => s.tags.includes(VERIFIED) || listed(s)))) {
      if (!chosen(folder)) continue;
      const complete = own.find(s => s.tags.includes(VERIFIED) && holds(s, folder)), newer = own.find(s => listed(s) && holds(s, folder));
      if (complete) hold(complete);
      if (newer && (!complete || Date.parse(newer.time) > Date.parse(complete.time))) hold(newer);
      // No backup has read all of it yet: while its complete place is a partial snapshot, the partial ones before that
      // place stay too, as for the whole vault above (끝판 카본 missing A1). With no complete one at all, its first
      // partial one takes that place and only the newest stays besides — not every one, hour after hour (nowstate A1).
      if (!complete) { const first = own.filter(s => listed(s) && holds(s, folder)).at(-1); if (first) hold(first); }
      else if (complete.tags.includes('partial')) for (const s of own) if (listed(s) && holds(s, folder) && Date.parse(s.time) < Date.parse(complete.time)) hold(s);
    }
    // Each path a kept partial snapshot could not read keeps the newest older backup that could read it — the one a
    // 「지금 상태」 restore takes it from (4.2 정리 규칙 「U 파일마다 그 파일이 든 가장 새 판」; GPT nowstate-c GA1: a file only
    // a middle partial one read). One that could not read it holds none of it and is passed; one whose list is unknown
    // may hold it and is kept on the way; a folder with something under it unread goes on to older ones. A file no
    // backup ever read keeps nothing, so one always locked does not keep every hour's snapshot.
    const listOf = s => (s.tags.includes('partial') && listsOf(s).length === 1 ? this.cachedList(listsOf(s)[0]) : null);
    // A fill read what its partial snapshot could not, for the paths it was asked: one it read is held there, one it
    // could not read goes on to older backups, and one it was not asked passes it by (true: still looking).
    // The partial snapshot a fill is for is held with it: a restore reaches a fill only through that snapshot (GPT
    // workbackup-fill GA1 — else the older partial one went after a day and its fill was found by nothing).
    const through = (f, rel, parent) => {
      if (!covered(f.only, rel) && !unreadUnder(f.only, rel)) return true;
      if (covered(f.blind, rel)) return true;
      hold(f.snapshot); if (parent) hold(parent);
      return !covered(f.only, rel) || unreadUnder(f.blind, rel);
    };
    for (const base of own.filter(s => keep.has(s.id) && listed(s))) {
      const list = await listOf(base);
      for (const folder of base.paths || []) {
        let left = [...new Set(list.unreadable.map(item => inside(folder, item)).filter(Boolean).map(rel => rel.toLowerCase()))];
        const filled = left.length ? await this.fillFor(all, base, folder) : null;
        if (filled) left = left.filter(rel => through(filled, rel));
        for (const s of own) {
          if (!left.length) break;
          if (s.id === base.id || Date.parse(s.time) >= Date.parse(base.time) || !holds(s, folder) || !(s.tags.includes(VERIFIED) || s.tags.includes('partial'))) continue;
          const known = await listOf(s), partial = s.tags.includes('partial');
          // An older partial one's fill comes before it: made right after it, it holds what that one could not read.
          const ownFill = partial ? await this.fillFor(all, s, folder) : null;
          if (ownFill) { left = left.filter(rel => through(ownFill, rel, s)); if (!left.length) break; }
          const unknown = partial && (!known || known.cut || known.unreadable.some(item => same(item, folder)));
          const blind = new Set((known?.unreadable || []).map(item => inside(folder, item)).filter(Boolean).map(rel => rel.toLowerCase()));
          left = left.filter(rel => {
            if (unknown) { hold(s); return true; }
            if (covered(blind, rel)) return true;
            hold(s); return unreadUnder(blind, rel);
          });
        }
      }
    }
    let ids = all.filter(s => !keep.has(s.id) && mine(s) && now - Date.parse(s.time) > DAY).map(s => s.id);
    if (!ids.length) return;
    ids = await this.massCheck(all, latest, ids, mine, chosen);
    if (!ids.length) return;
    this.stage('24시간이 지난 이전 백업 정리 중');
    for (let i = 0; i < ids.length; i += 100) await this.run(['forget', ...ids.slice(i, i + 100)]);
    const gone = new Set(ids);
    for (const id of gone) { this.listCache?.delete(id); await fs.rm(path.join(this.stateDir, 'lists', `${id}.json`), { force: true }).catch(() => {}); }
    await this.run(['prune', ...(this.isCloud() ? ['--max-repack-size', '0'] : [])]);
  }
  /**
   * 대량 삭제 · 변경 멈춤 (4.4). Every backup retain() would forget is first compared (massCompare) — oldest first,
   * `limit.compare` a run, the rest waiting for the next with their lists and fills (r2 GA1) — so a change spread over hours
   * is seen whole (GA3), and a backup kept longer for another reason is compared when it finally goes (GA6). Partial
   * backups are compared too (GA7), each folder with the newest backup that stays and has it (r3 GA2 · Fable 1). What
   * 「확인을 마침」 covered — each folder between the two backups a confirmed hold compared it in, the newer apart — is not
   * compared again; a backup all of whose folders are covered goes without (`massCheck`, Fable 2 · r4 GA1). Past a
   * threshold (MASS) the hold (`massHold`) keeps every backup until the person answers. Returns the ids that may go.
   * `massLimits` lowers the thresholds in tests.
   */
  async massCheck(all, latest, ids, mine, chosen = () => true) {
    const forget = new Set(ids), limit = { ...MASS, ...(this.massLimits || {}) };
    const ranges = this.config.massCheck?.folders || [];
    // `far`: within what some way of a folder counted more than one way saw it — to any backup a way compared it with
    // (`reach`), on either side of the one kept (massCompare).
    const covers = (folder, t, far = false) => ranges.some(r => (r.path === null || (folder !== null && r.path === folder)) && (far && Array.isArray(r.reach) ? r.reach : [r.to]).some(end => {
      const from = Date.parse(r.from), to = Date.parse(end);
      // The backup compared with is not covered (what came after it is not yet seen) — unless the hold compared the
      // backup with nothing (a folder no backup that stays has), when the range is that backup alone (Fable 후속 2). The
      // folder as spelled: one spelled otherwise may be another folder, not looked at (설계 검토 기록10).
      return (t !== to || from === to) && t >= Math.min(from, to) && t <= Math.max(from, to);
    }));
    const passed = s => { const t = Date.parse(s.time), plans = this.plansOf(s); return plans ? plans.length > 0 && plans.every(p => covers(p.original, t)) : covers(null, t); };
    const comparable = s => mine(s) && (s.tags.includes(VERIFIED) || s.tags.includes('partial')) && !s.tags.some(t => ['fill', 'meta', 'movekit', 'pending'].includes(t));
    const stays = all.filter(s => comparable(s) && !forget.has(s.id)), newest = stays[0] || latest;
    const due = all.filter(s => forget.has(s.id) && comparable(s) && !passed(s)).reverse();
    if (!due.length) return ids;
    const wait = new Set();
    for (const s of due.slice(limit.compare)) {
      wait.add(s.id);
      for (const l of listsIn(all, s)) wait.add(l.id);
      for (const fill of fillsIn(all, s)) { wait.add(fill.id); for (const l of listsIn(all, fill)) wait.add(l.id); }
    }
    this.stage('한꺼번에 지워지거나 바뀐 파일이 있는지 확인 중');
    const cache = new Map();
    for (const base of due.slice(0, limit.compare)) {
      const t = Date.parse(base.time);
      const found = await this.massCompare(base, newest, limit, { all, stays: stays.length ? stays : [newest], skip: folder => covers(folder, t), apart: folder => !covers(folder, t) && covers(folder, t, true), chosen, cache });
      if (!found.kind) continue;
      const weight = f => found.kind === 'changed' ? f.changed : f.removed;
      const worst = [...found.folders].sort((a, b) => weight(b) - weight(a) || (b.removed + b.changed) - (a.removed + a.changed))[0] || { path: null };
      // What the folder has now: in the backup it was compared with (r5 GA5).
      const by = worst.path ? found.where.get(worst.path) : null;
      const left = by ? (await this.countFiles(by.s, by.l).catch(() => null))?.files ?? null : null;
      const n = v => Number.isSafeInteger(v) && v >= 0 ? v : null;
      this.config.massHold = { since: new Date(this.now()).toISOString(), at: new Date(Date.parse(newest.time)).toISOString(), kind: found.kind, path: worst.path,
        removed: found.removed, changed: found.changed, removedBytes: found.bytes, left, totalNow: n(newest.summary?.total_files_processed),
        bytesNow: n(newest.summary?.total_bytes_processed), before: n(found.before), beforeId: base.id, beforeAt: new Date(Date.parse(base.time)).toISOString(),
        afterId: newest.id, folders: found.folders.filter(f => f.removed || f.changed), list: found.list, compared: found.compared };
      await this.save();
      return [];
    }
    return ids.filter(id => !wait.has(id));
  }
  /** A backup's folder plans, or null when restore would refuse its folder list. */
  plansOf(snapshot) { try { return selection.sourcePlans(snapshot); } catch { return null; } }
  /**
   * One comparison of 4.4: `base` (a backup going), each of its folders with the newest backup that stays and has it
   * (massHolder): `latest`, or for a folder it lacks (a drive not plugged in, a folder taken out) the one retain keeps for
   * it (Fable 1). A folder `skip` says the person confirmed, or one `base` could not read at all, is left out. A folder no
   * backup that stays has is left out when it is no longer chosen; while chosen, what `base` holds there is its last copy,
   * so each file of it not on the disk is gone (r5 GA2). One `restic diff --json` of the two backups whole for each backup
   * compared with, its lines taken by folder — a folder one of them lacks is no error (r4 GA2); a folder whose name the two
   * spell in other cases, `판:폴더` by itself (r5 GA4). Any restic error on the way fails it (GA5). Counted from the lines:
   * - a file `-` still on the disk as a file (a OneDrive placeholder restic leaves out, one a program held; a folder there
   *   now is no file, r5 GA3) or one the fill of the backup compared with holds (r4 GA3) is not gone (GA9); once enough
   *   are gone for the file threshold, the rest are counted without looking;
   * - a file where the backup compared with, a partial one, could not read is gone only when no other backup that stays and
   *   has the folder holds it either (r5 GA1);
   * - restic counts what is gone that is neither file nor folder (a symbolic link) apart, as `removed.others`: with none,
   *   every `-` line that is no folder is a file; with some, the backup before is listed for them first and the lines are
   *   read again with them left out (r2 GA3 · r3 GA1 · GA3 · GA4);
   * - under the file threshold, when a path's type changed or the bytes can still reach theirs, one `restic ls` of the
   *   backup before a folder: the files under each path whose type changed (GA8 · r2 GA8) and the sizes of the files gone
   *   (r2 GA5 · GA9: restic's removed bytes leave out content another file still holds, and count a placeholder's).
   * A partial `base`'s fill holds what it could not read (Fable 3): each of its files not on the disk, nor in a backup that
   * stays and has the folder, nor in the fill of the one compared with, is gone, with its size. The share is of the files
   * and bytes `base` and its fill had in the folders compared. `compared` is each folder with the time of the backup it
   * was compared with (what 「확인을 마침」 covers); `where` that backup and its plan, by folder.
   */
  async massCompare(base, latest, limit, { all = [], stays = [latest], skip = () => false, apart = () => false, chosen = () => true, cache = new Map() } = {}) {
    const basePlans = this.plansOf(base), latestPlans = this.plansOf(latest);
    const treeOf = p => p.selector.slice(p.selector.indexOf(':') + 1);
    // A unit is one folder: compared with `other` (null: with none), a line's path is `tree` + rel (`tree` '' for backups
    // compared whole, their paths as they are); `disk` is where rel was on this PC; `kept` what the fill of `other` holds
    // there; `blind` where `other`, a partial one, could not read (lower-case, no leading slash); `elsewhere()` every backup
    // that stays and has the folder, and their fills, as { s, l } to ask by path — found only when a file is in doubt.
    // `apartBytes`: of folders counted though out of the share (`apart`) — what may yet be gone there (r14 GA1).
    const units = [], fills = [], orphans = [], compared = [], where = new Map(), also = [];
    let apartBytes = 0;
    const unit = (folder, tree, disk, h) => {
      const u = { folder, tree, disk, other: h?.s || null, otherPlan: h?.l || null, otherTree: h?.l ? treeOf(h.l) : tree, blind: h?.blind || new Set(), kept: new Set(), elsewhere: async () => [], bytes: 0 };
      units.push(u); return u;
    };
    const relOf = (u, p) => !u.tree ? p : p.startsWith(u.tree + '/') ? p.slice(u.tree.length) : null;
    let before = base.summary?.total_files_processed, beforeBytes = base.summary?.total_bytes_processed;
    // Folders it cannot tell apart (a folder list restore would refuse): the backups whole, the disk by each path's own
    // drive — so one odd backup does not stop every clean-up after it.
    if (!basePlans || !latestPlans) {
      unit(null, '', at => { const m = /^\/([A-Za-z])(\/.*)?$/.exec(at); return m ? path.win32.join(`${m[1]}:\\`, ...(m[2] || '').slice(1).split('/')) : null; }, { s: latest, l: null });
      compared.push({ path: null, at: latest.time });
    } else {
      // Which folders this backup holds in its own tree: asked of restic, not guessed from its list (r6 GA1).
      const has = await this.massHas(base.id, basePlans.map(treeOf), cache);
      // None of its folders in its tree, yet files saved: restic's answer is not what it seems — nothing goes (Fable 후속 3).
      if (base.summary?.total_files_processed > 0 && !basePlans.some(b => has(treeOf(b)))) throw new Error('지울 백업의 폴더를 확인하지 못했습니다.');
      // The spellings the backups that stay give a folder in other cases. Such a one may be this folder, spelled anew when it
      // was taken out and chosen again, or another folder beside it (a parent that tells case apart); neither this disk nor
      // restic tells which it was then (r12 GA1 · r13 GA1 · GA2), and the folders of one backup need not all be one way
      // (설계 검토 기록11). So each folder is counted as another one, and as the same as each such spelling; of each count
      // the most any way gives is taken at the end. The way that is so is always one of them.
      const spellings = new Map();
      for (const x of stays) for (const p of (x.id === latest.id ? latestPlans : this.plansOf(x)) || []) for (const b of basePlans) {
        if (p.original === b.original || !same(p.original, b.original)) continue;
        if (!spellings.has(b.original)) spellings.set(b.original, new Set());
        spellings.get(b.original).add(p.original);
      }
      for (const b of basePlans) {
        const out = async () => { const other = await this.countFiles(base, b); if (Number.isSafeInteger(before)) before -= other.files; if (Number.isSafeInteger(beforeBytes)) beforeBytes -= other.bytes; return other; };
        if (skip(b.original)) { await out(); continue; }
        // Past what 「확인을 마침」 covered, though within what some way of it saw: counted, and out of the share, as covered
        // folders are — else it would thin the share of the others (설계 검토 기록11).
        const away = apart(b.original);
        if (away) apartBytes += (await out()).bytes;
        const tree = treeOf(b), disk = at => path.win32.join(b.original, ...at.slice(1).split('/'));
        const made = [];
        for (const names of [[b.original], ...[...(spellings.get(b.original) || [])].map(v => [b.original, v])]) {
          const h = await this.massHolder(all, stays, latest, latestPlans, b.original, cache, names);
          // No longer chosen, and none that stays holds it as spelled: left out as before, whatever another spelling has —
          // else its files would thin the share of the others (설계 검토 기록11).
          if (!h && !chosen(b.original)) { if (names.length === 1) break; continue; }
          // Compared with the backup the folder as spelled is, a way finds only more copies: it counts no more.
          const own = made.find(m => m.names.length === 1);
          if (own && (own.h?.s.id ?? null) === (h?.s.id ?? null) && (own.h?.l.original ?? null) === (h?.l.original ?? null)) continue;
          // In its own tree: compared with the one that has the folder — or, with none, against the disk (r5 GA2). Not
          // there: nothing of it to lose but what its fill holds.
          const u = unit(b.original, tree, disk, has(tree) ? h : null);
          if (has(tree) && !h) orphans.push(u);
          if (h && !where.has(b.original)) where.set(b.original, h);
          compared.push({ path: b.original, at: h ? h.s.time : base.time });
          // A file the fill of the one compared with holds is not lost with this one (r4 GA3).
          const hFill = h?.s.tags.includes('partial') ? await this.fillFor(all, h.s, b.original) : null;
          if (hFill) { const at = treeOf(hFill); await this.listFiles(hFill.snapshot.id, [at], file => { if (file.path.startsWith(at + '/')) u.kept.add(file.path.slice(at.length)); }); }
          // Where else its files may be: each backup that stays, in its tree when it has the folder and in its fill whether
          // or not (r6 GA3 · r7 GA2 · GA5) — looked for only when a file is in doubt, so a usual clean-up asks restic of no
          // backup but the one compared with (Fable 후속 3).
          let others = null;
          u.elsewhere = async () => {
            if (others) return others;
            others = [];
            for (const x of stays) {
              const plans = x.id === latest.id ? latestPlans : this.plansOf(x), l = this.massPlan(plans, names);
              if (!l) continue;
              if ((await this.massHas(x.id, plans.map(treeOf), cache))(treeOf(l))) others.push({ s: x, l });
              const xf = !x.tags.includes('partial') ? null : h && x.id === h.s.id ? hFill : await this.fillFor(all, x, b.original);
              if (xf) others.push({ s: xf.snapshot, l: xf });
            }
            return others;
          };
          made.push({ u, h, names });
        }
        if (!made.length) { if (!away) await out(); continue; }
        // What a partial backup could not read is in its fill (Fable 3 · r6 GA2): its files are in the shares — once for
        // the folder, however many ways it is counted.
        if (base.tags.includes('partial')) {
          const fill = await this.fillFor(all, base, b.original);
          if (fill) {
            const at = treeOf(fill), had = [];
            await this.listFiles(fill.snapshot.id, [at], file => { if (file.path.startsWith(at + '/')) had.push({ rel: file.path.slice(at.length), size: file.size }); });
            // With no tree of the folder, the fill is all it had there. With one, the fill's files the tree holds too are not
            // to count twice, however their names are spelled (r7 GA1 · r8 GA3): the share is told at the end both ways.
            if (away) apartBytes += had.reduce((sum, x) => sum + x.size, 0); else if (!has(tree)) {
              if (Number.isSafeInteger(before)) before += had.length;
              if (Number.isSafeInteger(beforeBytes)) beforeBytes += had.reduce((sum, x) => sum + x.size, 0);
            } else also.push({ u: made[0].u, had });
            for (const { u } of made) fills.push({ u, had });
          }
        }
      }
    }
    // The most the share can be of: with every fill file its tree may hold too (r9 GA1). How many are counted with the disk,
    // and whether the sizes are read, go by it, so a share told of more files still has every count and size it needs.
    const sum = (n, add) => Number.isSafeInteger(n) ? n + add : n;
    const most = sum(before, also.reduce((n, a) => n + a.had.length, 0)), mostBytes = sum(beforeBytes, also.reduce((n, a) => n + a.had.reduce((m, x) => m + x.size, 0), 0));
    const known = Number.isSafeInteger(most) && most > 0;
    // Enough files gone for the file threshold: the rest are counted without looking at the disk.
    const need = known ? Math.max(limit.files, Math.ceil(most * limit.removedShare)) : limit.files;
    // On the disk as a file, or a link to one: a folder there now — or a junction to one — holds no file of that name
    // (r5 GA3 · r6 GA6). Nor is a file there through a folder that is a link or a junction now: that is another folder's
    // (설계 검토 기록11 — a folder taken out, then made a junction to another). No backup folder is a link (paths.cjs).
    const layers = new Map();
    const through = dir => {
      if (!layers.has(dir)) layers.set(dir, (async () => { const up = path.win32.dirname(dir); if (up === dir) return false; try { if ((await fs.lstat(dir)).isSymbolicLink()) return true; } catch { return false; } return through(up); })());
      return layers.get(dir);
    };
    const onDisk = async at => { if (typeof at !== 'string' || await through(path.win32.dirname(at))) return false; try { const st = await fs.lstat(at); return st.isSymbolicLink() ? (await fs.stat(at)).isFile() : st.isFile(); } catch { return false; } };
    // A path's size in `sizes` (rel → size): as spelled; else, Windows telling no case apart, of the paths spelled otherwise,
    // the one `pick` chooses (r10 GA1 — a folder that tells case apart may hold both). For the share only, the larger: a
    // smaller share, toward a hold.
    const spelled = (sizes, pick) => {
      const folded = new Map();
      for (const [rel, size] of sizes) { const k = rel.toLowerCase(); folded.set(k, folded.has(k) ? pick(folded.get(k), size) : size); }
      return rel => sizes.has(rel) ? sizes.get(rel) : folded.get(rel.toLowerCase());
    };
    // What of `items` ({ rel, size }) goes with this backup: not in the fill of the one compared with, not on the disk as a
    // file, and in no backup that stays nor its fill (asked only when some are left). One rule for where the one compared
    // with could not read, for this backup's fill and for a folder no backup that stays has (Fable 후속 4).
    const lost = async (u, items) => {
      const left = [];
      for (const x of items) if (!u.kept.has(x.rel) && !(await onDisk(u.disk(x.rel)))) left.push(x);
      if (!left.length) return left;
      const there = await this.massAsk(await u.elsewhere(), left.map(x => x.rel));
      return left.filter(x => !there.has(x.rel));
    };
    // One line of the list a hold shows, once: a folder counted more than one way names a path in each (r14 GA3).
    const note = (c, x) => { const k = JSON.stringify([x.folder, x.name, x.kind]); if (c.list.length < limit.list && !c.listed.has(k)) { c.listed.add(k); c.list.push(x); } };
    // The files gone so far: a folder counted more than one way at its most, not each way's lines added up — else the
    // file threshold would seem near, the disk be looked at no more and the sizes not read (설계 검토 기록11).
    const goneSoFar = () => { const top = new Map(); for (const u of units) top.set(u.folder, Math.max(top.get(u.folder) || 0, u.gone)); let n = 0; for (const v of top.values()) n += v; return n; };
    // One reading of the change lines; `odd` the paths, by unit, of what the backup before had that is neither file nor folder.
    const count = async odd => {
      const c = { changed: 0, gone: 0, typed: 0, others: 0, list: [], listed: new Set() };
      for (const u of units) Object.assign(u, { names: new Set(), counted: new Map(), typed: new Set(), unsure: [], gone: 0, entry: { path: u.folder, removed: 0, changed: 0 } });
      const change = async (u, at, modifier) => {
        const name = at.replace(/\/$/, '');
        if (!name || name === '/') return;
        const shown = u.folder ? name.slice(1) : name;
        if (modifier.includes('T')) {
          c.typed++; u.typed.add(name); u.entry.removed++;
          note(c, { folder: u.folder, name: shown, kind: 'removed' });
          return;
        }
        if (at.endsWith('/')) return;
        if (modifier === '-') {
          if (odd?.get(u)?.has(name) || u.kept.has(name)) return;
          // Where the backup compared with could not read: asked of the other backups that stay, below (r5 GA1).
          if (u.blind.size && covered(u.blind, name.slice(1))) { u.unsure.push({ rel: name, size: 0 }); return; }
          if (goneSoFar() < need) { const spot = u.disk(name); if (!spot || await onDisk(spot)) return; u.names.add(name); }
          c.gone++; u.gone++; u.entry.removed++;
          note(c, { folder: u.folder, name: shown, kind: 'removed' });
        } else if (modifier.includes('M')) {
          c.changed++; u.entry.changed++;
          note(c, { folder: u.folder, name: shown, kind: 'changed' });
        }
      };
      // The folders spelled alike in both: one diff of the backups whole for each backup compared with.
      const groups = new Map();
      for (const u of units) if (u.other && u.otherTree === u.tree) { if (!groups.has(u.other.id)) groups.set(u.other.id, { other: u.other, mine: [] }); groups.get(u.other.id).mine.push(u); }
      for (const { other, mine } of groups.values()) {
        await this.massDiff([base.id, other.id], c, async (p, modifier) => {
          const lower = p.toLowerCase(), u = mine.find(x => x.tree ? lower.startsWith(x.tree.toLowerCase() + '/') : /^\/[A-Za-z](\/|$)/.test(p));
          if (u) await change(u, u.tree ? p.slice(u.tree.length) : p, modifier);
        });
      }
      // A folder the two spell in other cases: by itself, inside each (restic tells names apart by case, r5 GA4).
      for (const u of units) if (u.other && u.otherTree !== u.tree) await this.massDiff([`${base.id}:${u.tree}`, `${u.other.id}:${u.otherTree}`], c, (p, modifier) => change(u, p.startsWith('/') ? p : '/' + p, modifier));
      return c;
    };
    let c = await count(null);
    if (c.others) {
      const odd = new Map();
      for (const u of units) {
        if (!u.other) continue;
        const set = new Set(); odd.set(u, set);
        await this.listNodes(base.id, u.tree ? [u.tree] : [], node => { const rel = relOf(u, node.path); if (rel && node.type !== 'file' && node.type !== 'dir') set.add(rel); });
      }
      c = await count(odd);
    }
    // Where the backup compared with could not read: gone only when lost (r5 GA1 · r7 GA3).
    for (const u of units) {
      if (!u.unsure.length) continue;
      for (const { rel: name } of await lost(u, u.unsure)) {
        c.gone++; u.gone++; u.entry.removed++; u.names.add(name);
        note(c, { folder: u.folder, name: name.slice(1), kind: 'removed' });
      }
    }
    let removed = c.gone + c.typed, bytes = 0;
    const add = (u, n) => { bytes += n; u.bytes += n; };
    const list = c.list;
    // Under the file threshold the backup before tells what a changed type held and how big the files gone were (one
    // `restic ls` a folder; a failure fails the comparison, GA6). A backup under the byte threshold in all is not listed for it.
    // With what is counted though out of the share too: a large file gone there is no less gone (r14 GA1).
    const bytesCan = !(Number.isSafeInteger(mostBytes) && mostBytes >= 0 && mostBytes + apartBytes < limit.bytes);
    if (goneSoFar() < need && (c.typed || (c.gone && bytesCan))) {
      removed = c.gone;
      for (const u of units) {
        if (!u.names.size && !u.typed.size) continue;
        let under = 0;
        await this.listFiles(base.id, u.tree ? [u.tree] : [], file => {
          const rel = relOf(u, file.path);
          if (!rel) return;
          if (u.names.has(rel)) { add(u, file.size); u.counted.set(rel, file.size); return; }
          let hit = false;
          if (u.typed.size) for (let at = rel; !hit && at.length > 1; at = at.slice(0, at.lastIndexOf('/')) || '/') hit = u.typed.has(at);
          if (hit) { under++; add(u, file.size); u.counted.set(rel, file.size); }
        });
        removed += under; u.entry.removed += under - u.typed.size;
      }
    }
    const gone = (u, rel, size) => { removed++; add(u, size); u.entry.removed++; u.counted.set(rel, size); note(c, { folder: u.folder, name: rel.slice(1), kind: 'removed' }); };
    // A folder still chosen that no backup that stays has in its tree: each file of it this one holds and lost is gone
    // (r5 GA2 · r7 GA2).
    for (const u of orphans) {
      const had = [];
      await this.listFiles(base.id, [u.tree], file => { const rel = relOf(u, file.path); if (rel) had.push({ rel, size: file.size }); });
      for (const x of await lost(u, had)) gone(u, x.rel, x.size);
    }
    // This backup's fill: each file of it lost is gone (Fable 3 · r6 GA2). One its tree's side counted gone already — a
    // line, a changed type, a folder none that stays has — adds only the size its fill's copy has beyond the tree's (r8 GA1 ·
    // Fable 후속 5).
    for (const { u, had } of fills) {
      for (const n of u.names) if (!u.counted.has(n)) u.counted.set(n, 0);
      // As spelled only: a folder that tells case apart may hold a file of another spelling that is no copy — counted as one
      // of its own, which is toward a hold (r11 GA1).
      const rest = [];
      for (const x of had) { const at = u.counted.get(x.rel); if (at !== undefined) add(u, Math.max(0, x.size - at)); else rest.push(x); }
      for (const x of await lost(u, rest)) gone(u, x.rel, x.size);
    }
    // A folder counted more than one way: of each count, the most any way gives, the folder once in the share (설계 검토
    // 기록11); shown as compared with the backup of the way that found the most.
    let changed = c.changed, folders = units.filter(u => u.folder).map(u => u.entry);
    const byFolder = new Map();
    for (const u of units) { if (!byFolder.has(u.folder)) byFolder.set(u.folder, []); byFolder.get(u.folder).push(u); }
    if ([...byFolder.values()].some(w => w.length > 1)) {
      const top = (w, of) => Math.max(...w.map(of));
      removed = 0; changed = 0; bytes = 0; folders = [];
      for (const [folder, w] of byFolder) {
        const r = top(w, u => u.entry.removed), ch = top(w, u => u.entry.changed);
        removed += r; changed += ch; bytes += top(w, u => u.bytes);
        if (!folder) continue;
        folders.push({ path: folder, removed: r, changed: ch });
        const most = [...w].sort((a, b) => (b.entry.removed + b.entry.changed) - (a.entry.removed + a.entry.changed))[0];
        if (most.other) where.set(folder, { s: most.other, l: most.otherPlan });
      }
    }
    // Each count as it is: massKind takes a share of none, or of an unknown count, for no share (Fable 후속 5 확인).
    const told = (files, size) => this.massKind({ removed, changed, bytes, before: files, beforeBytes: size, limit, folders, list });
    let result = told(before, beforeBytes);
    if (also.length) {
      const all = told(most, mostBytes);
      // The share told without the fill's files and with all of them: no hold either way, it stands. A hold — its counts
      // are shown (r9 GA2) — or the two apart: the tree's list of each such folder is read once; a fill file it lacks counts,
      // one it holds adds only the size its fill's copy has beyond the tree's (Fable 후속 5 · r9 GA4). Most clean-ups read none.
      if (all.kind !== result.kind || result.kind) {
        let files = before, size = beforeBytes;
        for (const { u, had } of also) {
          const listed = new Map();
          await this.listFiles(base.id, [u.tree], file => { const rel = relOf(u, file.path); if (rel) listed.set(rel, file.size); });
          const mine = spelled(listed, Math.max);
          for (const x of had) { const at = mine(x.rel); if (at !== undefined) size = sum(size, Math.max(0, x.size - at)); else { files = sum(files, 1); size = sum(size, x.size); } }
        }
        result = told(files, size);
      }
    }
    // 「확인을 마침」 covers a folder counted more than one way only as far as every way saw it: to the nearest backup
    // compared with when each is after this one, else this one alone (설계 검토 기록11 — the way that is not so may reach
    // past the last copy of the folder).
    const ways = new Map();
    for (const x of compared) { if (!ways.has(x.path)) ways.set(x.path, []); ways.get(x.path).push(x.at); }
    // `reach`: the backup each way compared it with — within what any of them saw and past `at`, it is counted, out of
    // the share (설계 검토 기록11).
    const seen = [...ways].map(([p, at]) => {
      const each = [...new Set(at)];
      if (each.length === 1) return { path: p, at: each[0] };
      const early = each.reduce((a, b) => Date.parse(b) < Date.parse(a) ? b : a), late = each.reduce((a, b) => Date.parse(b) > Date.parse(a) ? b : a);
      const near = Date.parse(early) > Date.parse(base.time) ? early : base.time;
      // Every way's range holds this backup, so together they are one: from the earliest to the latest (r14 GA2).
      return { path: p, at: near, reach: [early, late] };
    });
    return { ...result, compared: seen, where };
  }
  /** Which of `rels` (paths inside a folder) the backups `holders` ({ s, l }) hold there: asked by path, a hundred at a
   *  time and no more than 16 000 characters (the Windows command line), a path one lacks telling nothing — or, past
   *  `MASS.ask` of them, by reading that backup's list of the folder once (Fable 후속 2: not thousands of calls). */
  async massAsk(holders, rels) {
    const found = new Set();
    for (const { s, l } of holders) {
      const tree = l.selector.slice(l.selector.indexOf(':') + 1), left = rels.filter(r => !found.has(r));
      if (!left.length) break;
      if (left.length > MASS.ask) {
        const want = new Set(left);
        await this.listFiles(s.id, [tree], file => { const rel = file.path.startsWith(tree + '/') ? file.path.slice(tree.length) : null; if (rel && want.has(rel)) found.add(rel); });
        continue;
      }
      for (let i = 0; i < left.length;) {
        const ask = [];
        for (let size = 0; i < left.length && ask.length < 100 && (!ask.length || size + tree.length + left[i].length < 16000); i++) { size += tree.length + left[i].length + 3; ask.push(tree + left[i]); }
        await this.listFiles(s.id, ask, file => { if (file.path.startsWith(tree + '/')) found.add(file.path.slice(tree.length)); });
      }
    }
    return found;
  }
  /** A partial backup's list when known whole (one list, not cut); undefined when not. */
  async knownList(all, s) {
    const lists = listsIn(all, s);
    const list = lists.length === 1 ? await this.cachedList(lists[0]).catch(() => null) : null;
    return list && !list.cut ? list : undefined;
  }
  /** The newest backup of `stays` that holds `folder` in its tree — asked of restic (massHas), so a partial one that could
   *  not read it, whatever its list says or leaves out, is passed over (r4 GA2 · r5 GA6 · r6 GA4 · GA7) — with its plan
   *  for it; the search ends at the first one whose list is known (Fable 후속 3: not a `restic ls` of every backup that
   *  stays each clean-up). A partial one whose list is known whole tells where inside it could not read (`blind`, '' the
   *  whole folder); one whose list is not known is chosen only when no other holds the folder. Null when none does. */
  async massHolder(all, stays, latest, latestPlans, folder, cache = new Map(), names = [folder]) {
    const treeOf = p => p.selector.slice(p.selector.indexOf(':') + 1), found = [];
    const look = async s => {
      const plans = s.id === latest.id ? latestPlans : this.plansOf(s), l = this.massPlan(plans, names);
      if (!l || !(await this.massHas(s.id, plans.map(treeOf), cache))(treeOf(l))) return;
      let blind = new Set(), sure = true;
      if (s.tags.includes('partial')) {
        const list = await this.knownList(all, s);
        if (!list) sure = false;
        else blind = new Set(list.unreadable.map(item => asSeen(folder, item)).filter(rel => rel !== null).map(rel => rel.toLowerCase()));
      }
      found.push({ s, l, blind, sure });
    };
    let i = 0;
    while (i < stays.length && !found.some(x => x.sure)) await look(stays[i++]);
    return found.find(x => x.sure) || found[0] || null;
  }
  /** The plan of `plans` for a folder spelled as one of `names` (a backup holds one folder of a name, however spelled). */
  massPlan(plans, names) { return plans?.find(p => names.includes(p.original)); }
  /** Which of `trees` (restic paths of backup folders) backup `id` holds: one `restic ls` without recursion for those
   *  paths — a path it lacks tells nothing — kept in `cache` for the clean-up. */
  async massHas(id, trees, cache) {
    if (!cache.has(id)) cache.set(id, new Map());
    const known = cache.get(id), ask = [...new Set(trees)].filter(t => !known.has(t));
    if (ask.length) {
      const seen = new Set();
      await this.listNodes(id, ask, node => { if (node.type === 'dir') seen.add(node.path); }, { recursive: false });
      for (const t of ask) known.set(t, seen.has(t));
    }
    return t => known.get(t) === true;
  }
  /** One `restic diff --json` of 4.4: each change line to `onChange`, restic's count of what is gone that is no file or
   *  folder to `c.others`. No statistics line, or anything restic writes to its errors, fails it. */
  async massDiff(args, c, onChange) {
    await this.run(['diff', '--json', ...args], { stderrFails: true, consumeStdout: async stream => {
      const decoder = new StringDecoder('utf8'); let pending = '', seen = false;
      const line = async text => {
        if (!text.trim()) return;
        let node; try { node = JSON.parse(text); } catch { throw new Error('바뀐 파일 목록을 읽지 못했습니다.'); }
        if (node?.message_type === 'statistics') {
          if (![node.removed?.files, node.removed?.others].every(n => Number.isSafeInteger(n) && n >= 0)) throw new Error('바뀐 파일 수를 확인하지 못했습니다.');
          c.others += node.removed.others; seen = true; return;
        }
        if (node?.message_type === 'change' && typeof node.path === 'string' && typeof node.modifier === 'string') await onChange(node.path, node.modifier);
      };
      for await (const chunk of stream) {
        pending += decoder.write(chunk); let i;
        while ((i = pending.indexOf('\n')) >= 0) { const text = pending.slice(0, i); pending = pending.slice(i + 1); await line(text); }
        if (pending.length > 1024 * 1024) throw new Error('바뀐 파일 목록을 읽지 못했습니다.');
      }
      await line(pending + decoder.end());
      if (!seen) throw new Error('바뀐 파일 수를 확인하지 못했습니다.');
    } });
  }
  /** The thresholds of 4.4 over counts of one comparison; a share is of the files and bytes the backup before had. */
  massKind({ removed, changed, bytes, before, beforeBytes, limit, folders, list }) {
    const share = (n, of, part) => !Number.isSafeInteger(of) || of <= 0 || n >= of * part;
    const kind = removed >= limit.files && share(removed, before, limit.removedShare) ? 'removed'
      : changed >= limit.files && share(changed, before, limit.changedShare) ? 'changed'
      : removed > 0 && bytes >= limit.bytes && share(bytes, beforeBytes, limit.removedShare) ? 'bytes' : null;
    return { kind, removed, changed, bytes, before: Number.isSafeInteger(before) && before > 0 ? before : null, folders, list };
  }
  /** The files of one backup folder (`plan`), or of a path inside it (`rel`), in `snapshot` — none when that backup lacks
   *  the path (a folder it could not read). */
  async countFiles(snapshot, plan, rel = '') {
    let files = 0, bytes = 0;
    const at = plan.selector.slice(plan.selector.indexOf(':') + 1) + (rel ? '/' + rel : '');
    await this.listFiles(snapshot.id, [at], file => { files++; bytes += file.size; });
    return { files, bytes };
  }
  /** Each file `restic ls` streams for backup `id` — under the absolute `paths` given, a path it lacks giving none — as
   *  { path, size } (0 when not told); any restic error fails it. */
  async listFiles(id, paths, onFile) { await this.listNodes(id, paths, node => { if (node.type === 'file') onFile(node); }); }
  /** Each node `restic ls` streams, as { path, type, size } — without `recursive`, the paths given and what is right in them. */
  async listNodes(id, paths, onNode, { recursive = true, stderrFails = true } = {}) {
    await this.run(['ls', '--json', ...(recursive ? ['--recursive'] : []), id, ...paths], { stderrFails, consumeStdout: async stream => {
      const decoder = new StringDecoder('utf8'); let pending = '';
      const line = text => {
        if (!text.trim()) return;
        let node; try { node = JSON.parse(text); } catch { throw new Error('파일 수를 세지 못했습니다.'); }
        if (node?.message_type === 'node') onNode({ path: String(node.path ?? ''), type: String(node.type ?? ''), size: Number.isSafeInteger(node.size) && node.size > 0 ? node.size : 0 });
      };
      for await (const chunk of stream) {
        pending += decoder.write(chunk); let i;
        while ((i = pending.indexOf('\n')) >= 0) { line(pending.slice(0, i)); pending = pending.slice(i + 1); }
        if (pending.length > 1024 * 1024) throw new Error('파일 수를 세지 못했습니다.');
      }
      line(pending + decoder.end());
    } });
  }
  /** 「확인을 마침」 on a hold (4.4): the change is the person's. Each folder the hold compared is covered between the backup
   *  it kept and the one it compared that folder with (Fable 2 · r4 GA1); what is outside is compared when it goes. */
  async massConfirm() {
    const hold = this.config?.massHold;
    if (!hold) return this.getState();
    const covered = (hold.compared || []).map(c => ({ path: c.path, from: hold.beforeAt, to: c.at, ...(c.reach ? { reach: c.reach } : {}) }));
    this.config.massCheck = { folders: [...(this.config.massCheck?.folders || []), ...covered].slice(-100) };
    this.config.massHold = null;
    await this.save(); return this.getState();
  }
  /** 「지금 상태」 plans (4.2), shared by restoreLatest and 옮겨 오기 (STAGE1_DESIGN.md 4.6): each folder from its own newest
   *  backup (restoreBases — a missing folder from the backups retain() keeps for it, a newer partial one's content over
   *  the complete one's), and what that one could not read from its fill and the earlier ones (gatherEarlier). `host`
   *  is whose backups — a move names the old device, and its `latest` is that device's newest complete one; `readList`
   *  reads one listing. */
  async restorePlans(latest, { base, host = this.hostName, readList = readManifest } = {}) {
    latest ??= (await this.snapshots([VERIFIED])).find(s => s.hostname === host && !s.tags.includes('recommended-verified-v1'));
    if (!latest || !sanePaths(latest)) throw new Error('복구할 작업 폴더 목록을 확인하지 못했습니다.');
    const all = (await this.snapshots()).filter(s => s.hostname === host && !s.tags.includes('recommended-verified-v1'));
    const listed = all.filter(s => s.tags.includes('partial') && listsIn(all, s).length === 1 && sanePaths(s));
    const complete = all.filter(s => s.tags.includes(VERIFIED) && sanePaths(s));
    const listOf = s => this.cachedList(listsIn(all, s)[0]);
    const sets = await restoreBases(latest, complete, listed, listOf);
    if (!sets.length || sets.length > 30) throw new Error('복구할 작업 폴더 목록을 확인하지 못했습니다.');
    for (const set of sets) {
      if (set.snapshot.tags.includes('partial')) {
        // A list that is not exactly one says nothing of what it could not read (끝판 A5).
        if (listsIn(all, set.snapshot).length !== 1) set.cut = true;
        else { const list = await listOf(set.snapshot); set.cut ||= list.cut; set.wanted = [...new Set(list.unreadable.map(item => inside(set.original, item)).filter(Boolean))]; }
      }
      set.earlier = all.filter(s => s.id !== set.snapshot.id && Date.parse(s.time) < Date.parse(set.snapshot.time) && (complete.includes(s) || listed.includes(s)) && holds(s, set.original));
    }
    const plans = [];
    for (const [index, { snapshot, original, wanted = [], earlier = [], cut = false }] of sets.entries()) {
      const subtree = '/' + original.replace(/^([A-Za-z]):/, '$1').replaceAll('\\', '/').replace(/\/+$/, '');
      const selector = `${snapshot.id}:${subtree}`;
      let manifest;
      // A subtree selector resolves only directories. File sources fail here,
      // before a destination is created. List every node, including hardlinks.
      await this.run(['ls', '--json', '--recursive', selector], { consumeStdout: async stream => { manifest = await readList(stream, base); } });
      const name = `${String(index + 1).padStart(2, '0')}-${path.win32.basename(original).replace(/[<>:"/\\|?*]/g, '_') || '드라이브'}`;
      // What it could not read: from the earlier backups that hold this folder, each listed only when needed.
      // A partial snapshot's fill comes just before it — first for the one restored from, then for each earlier one.
      // A listing too big to hold (a move's `tooBig`, 화면 세션 E25) says nothing of what is missing: as a cut list.
      const fillEntry = f => { const entry = { selector: f.selector, at: f.snapshot.time, cut: false, blind: f.blind, only: f.only, load: async () => {
        let had;
        await this.run(['ls', '--json', '--recursive', f.selector], { consumeStdout: async stream => { had = await readList(stream, base); } });
        if (had?.tooBig) entry.cut = true;
        return had;
      } }; return entry; };
      const fills = new Map();
      for (const s of [snapshot, ...earlier]) if (s.tags.includes('partial')) { const f = await this.fillFor(all, s, original); if (f) fills.set(s.id, fillEntry(f)); }
      const ownFill = fills.get(snapshot.id);
      const seen = [...(ownFill ? [ownFill] : []), ...earlier.flatMap(s => {
        const e = { selector: `${s.id}:${subtree}`, at: s.time, cut: false, blind: new Set() };
        e.load = async () => {
          let had;
          await this.run(['ls', '--json', '--recursive', e.selector], { consumeStdout: async stream => { had = await readList(stream, base); } });
          if (had?.tooBig) { e.cut = true; return had; }
          if (s.tags.includes('partial')) {
            if (listsIn(all, s).length !== 1) e.cut = true;
            else {
              const list = await listOf(s);
              e.cut = list.cut || list.unreadable.some(item => same(item, original));
              e.blind = new Set(list.unreadable.map(item => inside(original, item)).filter(Boolean).map(rel => rel.toLowerCase()));
            }
          }
          return had;
        };
        return fills.has(s.id) ? [fills.get(s.id), e] : [e];
      })];
      const { extra, notFound, folders, skipped: skippedEarlier, skippedCut } = await gatherEarlier(wanted, manifest, seen);
      plans.push({ original, selector, name, manifest, backupAt: snapshot.time, extra, notFound, folders, cut, skippedEarlier, skippedCut });
    }
    return plans;
  }
  // `named`: the window chose the place (its default), so the folder is 「되살린 파일 (<날짜>)」 there.
  async restoreLatest({ parent, named = false }) {
    return this.operation('restore', async () => {
      await this.identity();
      if (this.config.readOnly) {
        const ids = (await this.run(['list', 'locks'], { timeoutMs: 60000 })).trim().split(/\s+/).filter(Boolean);
        if (ids.length > 100 || ids.some(id => !isId(id))) throw new Error('저장소 작업 상태를 확인하지 못했습니다.');
        for (const id of ids) {
          const lock = json(await this.run(['cat', 'lock', id], { timeoutMs: 60000 }));
          if (typeof lock.exclusive !== 'boolean' || lock.exclusive) throw new Error('다른 PC에서 백업 정리가 진행 중입니다. 작업이 끝난 뒤 복구해 주세요.');
        }
      }
      const base = await directory(parent);
      if ([...this.forbidden(), ...this.config.sources].some(p => overlap(base, p))) throw Object.assign(new Error('작업 폴더·백업 저장소와 분리된 복구 폴더를 선택해 주세요.'), { code: 'OUTPUT_UNSAFE' });
      const latest = (await this.snapshots([VERIFIED], { host: this.hostName }))[0];
      if (!latest) throw Object.assign(new Error('완료된 백업이 없습니다.'), { code: 'NO_SNAPSHOT' });
      if (latest.tags?.includes('recommended-verified-v1')) {
        // The window's default place holds the dated folder here too (GPT workbackup-restoreplace GA1).
        await require('./recommended.cjs').restoreWhole(this, named ? await namedFolder(base, this.now()) : base, latest);
        return this.getState();
      }
      if (!sanePaths(latest)) throw new Error('복구할 작업 폴더 목록을 확인하지 못했습니다.');
      let target, fromEarlier = 0, inNone = 0, skippedAll = 0;
      try {
        this.stage('복구할 파일 목록 확인 중');
        // 「지금 상태」 (4.2): each folder from its own newest backup (restoreBases — a missing folder from the backups
        // retain() keeps for it, a newer partial one's content over the complete one's), and what that one could not
        // read from the earlier ones (gatherEarlier). 복구경로.json says from when.
        const plans = await this.restorePlans(latest, { base });
        const space = await fs.statfs(base, { bigint: true });
        const required = plans.reduce((sum, p) => sum + [...p.manifest.nodes.values(), ...p.extra].reduce((n, entry) => n + (entry.type === 'dir' ? space.bsize : ((BigInt(entry.size) + space.bsize - 1n) / space.bsize) * space.bsize), 0n), 16n * 1024n * 1024n);
        if (required > space.bavail * space.bsize) throw Object.assign(new Error('복구할 파일을 저장할 여유 공간이 부족합니다. 다른 드라이브를 선택해 주세요.'), { code: 'NO_SPACE' });
        if (named) target = await namedFolder(base, this.now());
        else {
          // Exclusive new empty directory; never restore into original paths. Written down only once it is there, so a
          // failure to make it leaves no folder to open (카본 끝판 A1 of the 화면 세션 E27 · E29 review).
          const fresh = path.join(base, `복구-${new Date(this.now()).toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(3).toString('hex')}`);
          await fs.mkdir(fresh); target = fresh;
        }
        this.stage('파일 복구 및 내용 검증 중');
        // Export authenticated contents rather than original SID/DACL metadata. Each
        // selected subtree is extracted into fresh files and verified after writing.
        const mapping = [];
        for (const { original, selector, name, manifest, backupAt, extra, notFound, folders, cut, skippedEarlier, skippedCut } of plans) {
          const destination = path.join(target, name); await fs.mkdir(destination);
          await this.run(['dump', selector, '/', '--archive', 'tar'], { consumeStdout: stream => extractVerified(stream, destination, manifest) });
          if (extra.length) this.stage('읽지 못했던 파일을 이전 백업에서 가져오는 중');
          for (const file of extra) {
            const into = entryPath(destination, file.name);
            await fs.mkdir(path.dirname(into), { recursive: true });
            let written;
            await this.run(['dump', file.selector, '/' + file.name], { consumeStdout: async input => { written = await selection.writeFileStream(input, into, file.size, destination); } });
            if (!written || written.bytes !== file.size) throw new Error('이전 백업에서 가져온 파일의 크기가 기록과 다릅니다.');
          }
          fromEarlier += extra.length; inNone += notFound.length;
          // A folder taken out of the backup comes back too while its backups stay (4.2 「폴더 더하기 · 빼기」) — said here.
          const removedAt = (this.config.removedSources || []).find(r => same(r.path, original))?.at;
          // What it left out — links, special nodes, names Windows cannot hold — is said with the restore (4.6).
          const leftCount = (manifest.skipped?.count || 0) + skippedEarlier.length;
          const leftItems = [...(manifest.skipped?.list || []), ...skippedEarlier];
          const left = leftCount ? { skipped: { count: leftCount, items: leftItems.slice(0, 1000), ...(manifest.skipped?.cut || skippedCut || leftItems.length > 1000 ? { cut: true } : {}) } } : {};
          skippedAll += leftCount;
          mapping.push({ original, restoredFolder: name, backupAt, ...(removedAt ? { removedAt } : {}), ...left,
            ...(extra.length ? { fromEarlier: extra.map(f => ({ path: f.name, backupAt: f.backupAt })) } : {}),
            ...(folders.length ? { foldersFromEarlier: folders } : {}), ...(notFound.length ? { inNoBackup: notFound } : {}), ...(cut ? { listCut: true } : {}) });
        }
        this.restoreFinal();
        await fs.writeFile(path.join(target, '복구경로.json'), JSON.stringify(mapping, null, 2), { flag: 'wx' });
      }
      catch (e) {
        // Stopped by the person (cancelRestore): nothing is wrong with the backups, so their health stays. Failing or
        // stopped, it can no longer be stopped while this is written (카본 끝판 A2).
        const stopped = !!this.job?.cancelled; if (this.job) this.job.final = true;
        if (!stopped) {
          this.config.health = { status: 'attention', checkedAt: new Date(this.now()).toISOString(), detail: '복구 또는 검증이 끝나지 않았습니다. 전체 점검 전에는 이전 백업을 정리하지 않습니다.' };
          await this.save();
        }
        throw Object.assign(new Error(`${e.message}\n${target ? `완료되지 않은 복구 폴더: ${target}` : '복구 파일을 만들기 전에 중단했습니다.'}`), { exitCode: e.exitCode, code: e.code, ...(target ? { restorePath: target } : {}) });
      }
      this.config.lastRestore = { path: target, at: new Date(this.now()).toISOString(), fromEarlier, inNone, ...(skippedAll ? { skipped: skippedAll } : {}) }; await this.save();
      return this.getState();
    }, { named: named === true });
  }
  discardCatalog() { clearTimeout(this.catalogTimer); this.fileCatalog = null; }
  assertCatalogReady() {
    if (!this.config?.repositoryId) throw selection.issue('NOT_CONFIGURED');
    if (!this.secret) throw selection.issue('CREDENTIAL_REQUIRED');
    if (this.stopping) throw selection.issue('JOB_BUSY');
  }
  catalogFor(token) {
    this.assertCatalogReady();
    if (!this.fileCatalog) throw selection.issue('CATALOG_EXPIRED');
    try { this.fileCatalog.assert(token, this.config, this.now()); }
    catch (e) { this.discardCatalog(); throw e; }
    return this.fileCatalog;
  }
  async hold(kind, fn) {
    // The new read/selected-restore flow must never clear a backup's error or
    // interrupted protection journal. operation() remains unchanged for it.
    if (this.job || this.stopping) throw selection.issue('JOB_BUSY');
    this.job = { kind, stage: '파일 목록 확인 중', percent: null }; this.emitState();
    try { return await fn(); }
    finally { this.transientSecrets = []; this.job = null; this.emitState(); this.emit('idle'); }
  }
  async assertNoRemoteMaintenance() {
    if (!this.config.readOnly) return;
    const ids = (await this.run(['list', 'locks'], { timeoutMs: 60000 })).trim().split(/\s+/).filter(Boolean);
    if (ids.length > 100 || ids.some(id => !isId(id))) throw selection.issue('OPERATION_FAILED');
    for (const id of ids) {
      const lock = json(await this.run(['cat', 'lock', id], { timeoutMs: 60000 }));
      if (typeof lock.exclusive !== 'boolean' || lock.exclusive) throw selection.issue('REMOTE_MAINTENANCE');
    }
  }
  async readFileManifest(plan, snapshotId, meter, sub = '') {
    let manifest;
    await this.run(['ls', '--json', '--recursive', sub ? `${plan.selector}/${sub}` : plan.selector], { timeoutMs: 300000, consumeStdout: async input => {
      manifest = await selection.parseCatalog(input, { root: path.resolve(this.stateDir, 'catalog-root'), snapshotId, budget: meter, prefix: sub });
    } });
    if (!manifest) throw selection.issue('OPERATION_FAILED');
    return manifest;
  }
  /** Whose backup a catalog reads (「옛 PC 백업에서 꺼내기」, STAGE1_DESIGN.md 4.6): this device's, or the other device
   *  `from` names. Files still go only to a new folder (restoreSelected). */
  catalogHost(from) {
    if (from === undefined || from === null || from === this.hostName) return { host: this.hostName, from: null };
    if (!selection.hostOk(from)) throw selection.issue('INVALID_REQUEST');
    return { host: from, from };
  }
  /**
   * 「파일 되살리기」. `from`: another device's newest complete backup (「옛 PC 백업에서 꺼내기」). `folder` · `sub`: only
   * that folder of it, or a folder inside it (화면 세션 E26 — a folder past the catalog's limit, a part at a time).
   */
  async openFileCatalog({ from, folder, sub } = {}) {
    this.assertCatalogReady();
    const { host, from: other } = this.catalogHost(from);
    return this.hold('browse', async () => {
      this.discardCatalog();
      try {
        await this.assertNoRemoteMaintenance(); await this.identity();
        const snapshot = (await this.snapshots([VERIFIED], { host }))[0];
        if (!snapshot) throw selection.issue('NO_SNAPSHOT');
        const plans = selection.sourcePlans(snapshot), scope = selection.scopeOf(plans, { folder, sub }), manifests = plans.map(() => null), meter = selection.budget();
        for (const part of scope) manifests[part.index] = await this.readPart(plans[part.index], snapshot.id, part.sub, () => this.readFileManifest(plans[part.index], snapshot.id, meter, part.sub));
        this.fileCatalog = new selection.FileCatalog({ snapshot, plans, manifests, host, from: other, scope, scoped: folder !== undefined, repositoryId: this.config.repositoryId, vaultId: this.config.vaultId, profile: this.providerType, now: this.now() });
        this.catalogTimer = setTimeout(() => this.discardCatalog(), selection.LIMITS.ttl); this.catalogTimer.unref?.();
        return this.fileCatalog.meta();
      } catch (e) { throw selection.safeError(e); }
    });
  }
  /**
   * 화면 세션 E26: the folders right inside one folder of a backup (`sub` inside it, or its top), so a part small enough for
   * a catalog can be chosen. Only that level is read, never what is under it. At most 2,000 names (`cut` past them).
   */
  async browseBackupFolder({ from, folder, sub } = {}) {
    this.assertCatalogReady();
    const { host, from: other } = this.catalogHost(from);
    if (folder === undefined) throw selection.issue('INVALID_REQUEST');
    return this.hold('browse', async () => {
      try {
        await this.assertNoRemoteMaintenance(); await this.identity();
        const snapshot = (await this.snapshots([VERIFIED], { host }))[0];
        if (!snapshot) throw selection.issue('NO_SNAPSHOT');
        const plans = selection.sourcePlans(snapshot), [part] = selection.scopeOf(plans, { folder, sub });
        const plan = plans[part.index];
        const level = await this.readPart(plan, snapshot.id, part.sub, () => this.listLevel(plan, snapshot.id, part.sub));
        // A name a catalog could not hold is left out of the list: opening it would be refused.
        const fits = level.folders.filter(name => { try { return !!entryPath(path.resolve(this.stateDir, 'catalog-root'), part.sub ? `${part.sub}/${name}` : name); } catch { return false; } });
        return { profile: this.providerType, from: other, folder: plan.original, sub: part.sub, snapshotAt: snapshot.time, folders: fits.sort(), files: level.files, ...(level.cut ? { cut: true } : {}), ...(fits.length < level.folders.length ? { leftOut: level.folders.length - fits.length } : {}) };
      } catch (e) { throw selection.safeError(e); }
    });
  }
  /** One level of a backup's folder (`sub` inside it, or its top), read with `restic ls --json <folder[/sub]> /` and no
   *  --recursive, which lists only that level (a deeper path is refused). Keeps the first `keep` folder names (`cut` past
   *  them), counts the files, and says whether a folder named `want` is there. */
  async listLevel(plan, snapshotId, sub, { keep = 2000, want = null } = {}) {
    const folders = [];
    let files = 0, cut = false, found = false, snapshots = 0;
    await this.run(['ls', '--json', sub ? `${plan.selector}/${sub}` : plan.selector, '/'], { timeoutMs: 300000, consumeStdout: async input => {
      const decoder = new TextDecoder('utf-8', { fatal: true }); let pending = '', lines = 0;
      const line = text => {
        if (!text.trim()) return;
        if (++lines > 200000 || Buffer.byteLength(text) > selection.LIMITS.line) throw selection.issue('CATALOG_TOO_LARGE');
        let node; try { node = JSON.parse(text); } catch { throw selection.issue('UNSAFE_MANIFEST'); }
        if (node?.message_type === 'snapshot') { if (++snapshots !== 1 || node.id !== snapshotId) throw selection.issue('UNSAFE_MANIFEST'); return; }
        if (node?.message_type !== 'node' || typeof node.path !== 'string' || !/^\/[^/]+$/.test(node.path)) throw selection.issue('UNSAFE_MANIFEST');
        if (node.type === 'dir') { const name = node.path.slice(1); if (name === want) found = true; if (folders.length < keep) folders.push(name); else cut = true; }
        else if (node.type === 'file') files++;
      };
      for await (const chunk of input) {
        try { pending += decoder.decode(chunk, { stream: true }); } catch { throw selection.issue('UNSAFE_MANIFEST'); }
        let end; while ((end = pending.indexOf('\n')) >= 0) { line(pending.slice(0, end)); pending = pending.slice(end + 1); }
        if (Buffer.byteLength(pending) > selection.LIMITS.line) throw selection.issue('CATALOG_TOO_LARGE');
      }
      try { pending += decoder.decode(); } catch { throw selection.issue('UNSAFE_MANIFEST'); }
      line(pending);
    } });
    if (snapshots !== 1) throw selection.issue('UNSAFE_MANIFEST');
    return { folders, files, cut, found };
  }
  /** Reads a part of a backup's folder with `read`. When that fails for a folder inside it (`sub`), a part the backup does
   *  not have — the screen's list was older than the backup — is told apart as INVALID_REQUEST (「목록을 새로 열어
   *  주세요」); any other failure stands. */
  async readPart(plan, snapshotId, sub, read) {
    try { return await read(); }
    catch (e) {
      if (sub && e?.code !== 'CATALOG_TOO_LARGE' && await this.partMissing(plan, snapshotId, sub)) throw selection.issue('INVALID_REQUEST');
      throw e;
    }
  }
  /** Walks down from the folder's top a level at a time: true when a part of `sub` is not a folder there. A level that
   *  cannot be read says nothing (false), so the first failure stands. */
  async partMissing(plan, snapshotId, sub) {
    let at = '';
    for (const name of sub.split('/')) {
      let level;
      try { level = await this.listLevel(plan, snapshotId, at, { keep: 0, want: name }); } catch { return false; }
      if (!level.found) return true;
      at = at ? `${at}/${name}` : name;
    }
    return false;
  }
  /**
   * 화면 세션 E27 「이 폴더 통째로 꺼내기」: one part of a backup — this device's, or another device's (`from`) — whole,
   * into a new folder, with no catalog. `folder` is one of the backup's folders and `sub` a folder inside it (scopeOf).
   * Like 「지금 상태」 restore it reads the part's list, checks the space, extracts every file and checks it by SHA-256,
   * and writes only into a new folder, as `<새 폴더>/<번호-폴더>/<sub>`. A part whose list passes restore-tar's
   * 1,000,000 entries is refused as CATALOG_TOO_LARGE: a folder inside it is taken instead. It runs as a restore, so
   * cancelRestore stops it and its failure is lastRestoreError (with `from`); `scopeListMax` lowers the limit in tests.
   */
  async restoreScope({ from, folder, sub, parent, named = false }) {
    let fromNote = null; try { fromNote = this.catalogHost(from).from; } catch { /* refused inside, and written down there */ }
    return this.operation('restore', async () => {
      const { host, from: other } = this.catalogHost(from);
      if (folder === undefined) throw selection.issue('INVALID_REQUEST');
      await this.identity(); await this.assertNoRemoteMaintenance();
      const snapshot = (await this.snapshots([VERIFIED], { host }))[0];
      if (!snapshot) throw selection.issue('NO_SNAPSHOT');
      const plans = selection.sourcePlans(snapshot), parts = selection.scopeOf(plans, { folder, sub });
      const done = await this.restoreParts({ snapshot, plans, parts, parent, named, from: other });
      this.config.lastRestore = { ...done, scope: { from: other, folder: plans[parts[0].index].original, sub: parts[0].sub, snapshotAt: snapshot.time } };
      await this.save();
      return this.getState();
    }, { named: named === true, ...(fromNote ? { from: fromNote } : {}) });
  }
  /**
   * 대량 삭제 · 변경 멈춤 (4.4) 「지워지기 전으로 되살리기」: the folders that lost or changed files, from the backup the hold
   * keeps by number (massHold.beforeId), whole into a new folder as restoreScope does. The hold stays: the person says when
   * they are done (massConfirm), and until then no backup before it is forgotten.
   */
  async restoreMassBefore({ parent, named = false, folder, sub }) {
    return this.operation('restore', async () => {
      const hold = this.config.massHold;
      if (!hold) throw Object.assign(new Error('한꺼번에 지워지기 전의 판이 없습니다.'), { code: 'NOT_FOUND' });
      await this.identity(); await this.assertNoRemoteMaintenance();
      // The backup the hold keeps, complete or partial (r2 GA2): the comparison takes both.
      const snapshot = (await this.snapshots([], { host: this.hostName })).find(s => s.id === hold.beforeId && (s.tags.includes(VERIFIED) || s.tags.includes('partial')));
      if (!snapshot) throw selection.issue('NO_SNAPSHOT');
      const plans = selection.sourcePlans(snapshot);
      // A folder past the list limit is taken a part at a time (`folder` · `sub`, as restoreScope — GPT GA11).
      const touched = plans.filter(p => hold.folders.some(f => (f.removed || f.changed) && same(f.path, p.original)));
      const parts = folder !== undefined || sub !== undefined ? selection.scopeOf(plans, { folder, sub }) : (touched.length ? touched : plans).map(p => ({ index: p.index, sub: '' }));
      const done = await this.restoreParts({ snapshot, plans, parts, parent, named, from: null });
      // What it took (화면 세션 E31): every folder that changed (`folder` null), or that one folder and the folder inside it —
      // so the screen knows whether every changed folder came back before it puts 「확인을 마침」 first.
      const scoped = folder !== undefined || sub !== undefined;
      this.config.lastRestore = { ...done, mass: { beforeId: snapshot.id, beforeAt: snapshot.time, folder: scoped ? plans[parts[0].index].original : null, sub: scoped ? parts[0].sub : '' } };
      await this.save();
      return this.getState();
    }, { named: named === true, mass: { folder: typeof folder === 'string' ? folder.slice(0, 32767) : null, sub: typeof sub === 'string' ? sub.slice(0, 32767) : '' } });
  }
  /**
   * Restores `parts` (scopeOf's `{ index, sub }`) of `snapshot` whole into one new folder, each as `<번호-폴더>/<sub>`, every
   * file checked against its list (SHA-256, restore-tar), as the 「지금 상태」 restore does: inside a restore operation, so
   * cancelRestore stops it; a failure names the folder it made and, unless stopped, asks for a check. Never where the
   * backup's folders were, on this PC or the old one. A part past the list limit is CATALOG_TOO_LARGE (`scopeListMax`
   * lowers it in tests).
   */
  async restoreParts({ snapshot, plans, parts, parent, named, from }) {
    const base = await directory(parent);
    if ([...this.forbidden(), ...this.config.sources, ...plans.map(p => p.original)].some(p => overlap(base, p))) throw Object.assign(new Error('작업 폴더·백업 저장소와 분리된 복구 폴더를 선택해 주세요.'), { code: 'OUTPUT_UNSAFE' });
    this.stage('복구할 파일 목록 확인 중');
    const reads = [];
    for (const part of parts) {
      const plan = plans[part.index], selector = part.sub ? `${plan.selector}/${part.sub}` : plan.selector;
      let manifest;
      await this.readPart(plan, snapshot.id, part.sub, async () => {
        try { await this.run(['ls', '--json', '--recursive', selector], { consumeStdout: async stream => { manifest = await readManifest(stream, base, this.scopeListMax ? { max: this.scopeListMax } : {}); } }); }
        catch (e) { if (e?.tooMany) throw Object.assign(new Error('이 폴더는 파일과 폴더가 100만 개를 넘어 통째로 꺼낼 수 없습니다. 안쪽 폴더를 골라 주세요.'), { code: 'CATALOG_TOO_LARGE' }); throw e; }
      });
      reads.push({ plan, part, selector, manifest });
    }
    const space = await fs.statfs(base, { bigint: true });
    const required = reads.reduce((sum, { manifest }) => [...manifest.nodes.values()].reduce((n, entry) => n + (entry.type === 'dir' ? space.bsize : ((BigInt(entry.size) + space.bsize - 1n) / space.bsize) * space.bsize), sum), 16n * 1024n * 1024n);
    if (required > space.bavail * space.bsize) throw Object.assign(new Error('복구할 파일을 저장할 여유 공간이 부족합니다. 다른 드라이브를 선택해 주세요.'), { code: 'NO_SPACE' });
    let target;
    try {
      // Written down only once the folder is there (카본 끝판 A1 of the 화면 세션 E27 · E29 review).
      if (named) target = await namedFolder(base, this.now());
      else { const fresh = path.join(base, `복구-${new Date(this.now()).toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(3).toString('hex')}`); await fs.mkdir(fresh); target = fresh; }
      this.stage('파일 복구 및 내용 검증 중');
      const mapping = []; let skipped = 0;
      for (const { plan, part, selector, manifest } of reads) {
        const restoredFolder = part.sub ? `${plan.label}/${part.sub}` : plan.label;
        const destination = entryPath(target, restoredFolder);
        await fs.mkdir(destination, { recursive: true }); await directory(destination);
        await this.run(['dump', selector, '/', '--archive', 'tar'], { consumeStdout: stream => extractVerified(stream, destination, manifest) });
        const leftItems = manifest.skipped?.list || [];
        const left = manifest.skipped?.count ? { skipped: { count: manifest.skipped.count, items: leftItems.slice(0, 1000), ...(manifest.skipped.cut ? { cut: true } : {}) } } : {};
        skipped += manifest.skipped?.count || 0;
        const original = part.sub ? path.win32.join(plan.original, ...part.sub.split('/')) : plan.original;
        mapping.push({ original, restoredFolder, backupAt: snapshot.time, ...(from ? { from } : {}), ...left });
      }
      this.restoreFinal();
      await fs.writeFile(path.join(target, '복구경로.json'), JSON.stringify(mapping, null, 2), { flag: 'wx' });
      return { path: target, at: new Date(this.now()).toISOString(), fromEarlier: 0, inNone: 0, ...(skipped ? { skipped } : {}) };
    }
    catch (e) {
      // As 「지금 상태」 restore: stopped by the person, the health stays; failing, nothing more may stop it.
      const stopped = !!this.job?.cancelled; if (this.job) this.job.final = true;
      if (!stopped) {
        this.config.health = { status: 'attention', checkedAt: new Date(this.now()).toISOString(), detail: '복구 또는 검증이 끝나지 않았습니다. 전체 점검 전에는 이전 백업을 정리하지 않습니다.' };
        await this.save();
      }
      throw Object.assign(new Error(`${e.message}\n${target ? `완료되지 않은 복구 폴더: ${target}` : '복구 파일을 만들기 전에 중단했습니다.'}`), { exitCode: e.exitCode, code: e.code, ...(target ? { restorePath: target } : {}) });
    }
  }
  queryFileCatalog({ token, query, offset }) { return this.catalogFor(token).query(query, offset); }
  setFileSelection(input) {
    if (this.job?.kind === 'restore-selected') throw selection.issue('JOB_BUSY');
    return this.catalogFor(input.token).select(input);
  }
  closeFileCatalog({ token }) {
    if (this.job?.kind === 'restore-selected') throw selection.issue('JOB_BUSY');
    this.catalogFor(token); this.discardCatalog(); return { profile: this.providerType, token, closed: true };
  }
  prepareSelectedRestore({ token, revision }) {
    if (this.job || this.stopping) throw selection.issue('JOB_BUSY');
    return this.catalogFor(token).capture(revision);
  }
  restoreSelected({ token, revision, parent, named = false }) {
    // Synchronous preflight runs again after main's native destination picker.
    // Once captured, profile switches/TTL/credential invalidation cannot change
    // the selected paths or silently replace the pinned immutable snapshot.
    const capture = this.prepareSelectedRestore({ token, revision });
    return this.hold('restore-selected', async () => {
      let target, marker; const previous = this.config.lastSelectedRestore;
      try {
        this.config.lastSelectedRestoreError = null; await this.save();
        let base;
        try { base = await directory(parent); }
        catch { throw selection.issue('OUTPUT_UNSAFE'); }
        if ([...this.forbidden(), ...this.config.sources, ...capture.plans.map(p => p.original)].some(p => overlap(base, p))) throw selection.issue('OUTPUT_UNSAFE');
        if (this.config.repositoryId !== capture.repositoryId || this.config.vaultId !== capture.vaultId) throw selection.issue('REPOSITORY_CHANGED');
        await this.assertNoRemoteMaintenance(); await this.identity();
        // The device the catalog was opened for (「옛 PC 백업에서 꺼내기」), and only the part it opened (화면 세션 E26).
        const snapshot = (await this.snapshots([VERIFIED], { host: capture.host })).find(s => s.id === capture.snapshotId);
        if (!snapshot) throw selection.issue('SNAPSHOT_GONE');
        const plans = selection.sourcePlans(snapshot);
        if (JSON.stringify(plans) !== JSON.stringify(capture.plans)) throw selection.issue('INTEGRITY_FAILED');
        const meter = selection.budget();
        for (const index of new Set(capture.files.map(f => f.sourceIndex))) {
          const part = capture.scope.find(p => p.index === index);
          if (!part) throw selection.issue('INTEGRITY_FAILED');
          const manifest = await this.readFileManifest(plans[index], snapshot.id, meter, part.sub);
          for (const file of capture.files.filter(f => f.sourceIndex === index)) {
            const fresh = manifest.nodes.get(file.path.toLowerCase());
            if (!fresh || fresh.type !== 'file' || fresh.path !== file.path || fresh.size !== file.size || fresh.mtime !== file.mtime) throw selection.issue('INTEGRITY_FAILED');
          }
        }
        await selection.spaceRequired(base, capture.files, plans);
        await directory(base);
        if (named) target = await namedFolder(base, this.now());
        else { const fresh = path.join(base, `선택복구-${new Date(this.now()).toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(6).toString('hex')}`); await fs.mkdir(fresh); target = fresh; }
        marker = path.join(target, '_복구중_미완료.txt');
        await fs.writeFile(marker, '복구가 완료되지 않았습니다. 이 폴더를 완료된 복구본으로 사용하지 마세요.\n', { flag: 'wx' });
        let count = 0, bytes = 0;
        for (const file of capture.files) {
          this.stage(`선택한 파일 복구 및 확인 중 (${count}/${capture.files.length})`, Math.floor(count / capture.files.length * 100));
          const destination = require('./restore-tar.cjs').entryPath(target, `${plans[file.sourceIndex].label}/${file.path}`);
          await directory(target); await fs.mkdir(path.dirname(destination), { recursive: true }); await directory(path.dirname(destination));
          let written;
          await this.run(['dump', plans[file.sourceIndex].selector, '/' + file.path], { timeoutMs: 6 * 3600000, consumeStdout: async input => {
            written = await selection.writeFileStream(input, destination, file.size, target);
          } });
          if (!written || written.bytes !== file.size) throw selection.issue('INTEGRITY_FAILED');
          if (file.mtime) await fs.utimes(destination, new Date(file.mtime), new Date(file.mtime));
          count++; bytes += written.bytes;
        }
        this.restoreFinal();
        const mapping = capture.files.map(f => ({ source: plans[f.sourceIndex].label, path: f.path, bytes: f.size }));
        await fs.writeFile(path.join(target, '복구경로.json'), JSON.stringify({ snapshotAt: snapshot.time, ...(capture.from ? { from: capture.from } : {}), files: mapping }, null, 2), { flag: 'wx' });
        await fs.unlink(marker);
        this.config.lastSelectedRestore = { path: target, at: new Date(this.now()).toISOString(), files: count, bytes };
        // Persist before emitting success. If finalization fails, restore the old
        // result and recreate the incomplete marker below.
        await atomic(path.join(this.stateDir, 'settings.json'), JSON.stringify(this.config, null, 2));
        this.stage(`선택한 파일 ${count}개 복구 확인 완료`, 100);
        return this.getState();
      } catch (e) {
        const error = this.job?.cancelled ? selection.issue('CANCELED') : selection.safeError(e, 'RESTORE_INCOMPLETE');
        if (this.job) this.job.final = true; // failing: a late stop cannot rename it (카본 끝판 A2)
        this.config.lastSelectedRestore = previous;
        if (marker) await fs.writeFile(marker, '복구가 완료되지 않았습니다. 이전 완료 결과는 유지됩니다.\n', { flag: 'wx' }).catch(() => {});
        this.config.lastSelectedRestoreError = { code: error.code, message: error.message, at: new Date(this.now()).toISOString(), ...(target ? { path: target } : {}), ...(named === true ? { named: true } : {}), ...(capture.from ? { from: capture.from } : {}) };
        if (error.code === 'INTEGRITY_FAILED') this.config.health = { status: 'attention', checkedAt: new Date(this.now()).toISOString(), detail: error.message };
        await this.save().catch(() => {}); throw error;
      }
    });
  }
  /**
   * 화면 세션 요청 16: stops a running 「지금 상태」 or selected restore. The restic read running now ends the way a failed
   * consumer ends it — its output pipe closed, so restic exits and removes its own lock; killed only if it is still there
   * 5 seconds later — and no further restic read starts (run). What was made so far stays as it is, and the restore's own
   * failure record says CANCELED with that folder (lastRestoreError · lastSelectedRestoreError), never the backups'
   * failure, an integrity failure or the health. Nothing to stop — no restore, or one already in its last step or
   * failing (`job.final`) — `{ stopping: false }`.
   */
  cancelRestore() {
    const job = this.job;
    if (!job || !['restore', 'restore-selected'].includes(job.kind) || job.final) return { stopping: false };
    job.cancelled = true; job.stage = '되살리기를 그만두는 중'; job.percent = null; this.emitState();
    const child = this.child;
    if (child) {
      // With an error: a pipe closed without one can leave the reader (the tar extraction) waiting for an end that never
      // comes, even after restic has gone (seen with real restic, 11-17).
      child.stdout?.destroy(Object.assign(new Error('되살리기를 그만두었습니다.'), { code: 'CANCELED' }));
      const force = setTimeout(() => { if (child.exitCode === null && child.signalCode === null) child.kill(); }, 5000); force.unref?.();
    }
    return { stopping: true };
  }
  /** A restore past its last read, about to write what makes it finished (GPT GA1): told to stop, it stops here; from
   *  here on it can no longer be stopped (cancelRestore answers `{ stopping: false }`). No await between the two, so a
   *  stop cannot slip in between. */
  restoreFinal() {
    if (this.job?.cancelled) throw Object.assign(new Error('되살리기를 그만두었습니다. 만들다 만 폴더는 그대로 두었습니다.'), { code: 'CANCELED' });
    if (this.job) this.job.final = true;
  }
  async tick() {
    if (this.stopping || this.job || !this.secret || !this.config?.automatic || this.config.mode !== 'backup' || this.config.readOnly) return;
    const timing = schedule(this.config, this.intervalMs, this.now(), this.lastAttempt);
    if (timing.clockHold || timing.paused || timing.dueAt > this.now()) return;
    // No await before backupNow obtains the operation lock: simultaneous resume
    // and timer events can never start a second backup.
    if (this.config.pausedUntil) this.config.pausedUntil = null;
    try { await this.backupNow(); } catch { /* Error is persisted and surfaced in state; retry on the next interval. */ }
  }
  // A run killed mid-backup (power, logoff, time limit) leaves a restic lock that
  // makes check · forget fail with exit 11 until removed; restic and 0.5.0 never
  // removed it. `unlock` without --remove-all removes only stale locks, and with a
  // key that has no deleteFiles it hides them (B2 measurement M3b, STAGE1_DESIGN.md 4.2).
  async unlockStale() {
    if (!this.config?.repositoryId || !this.secret || this.config.readOnly || this.config.mode !== 'backup') return { ran: false };
    try { await this.run(['unlock'], { timeoutMs: 120000 }); return { ran: true, ok: true }; }
    catch (e) { return { ran: true, ok: false, exitCode: e.exitCode ?? null }; }
  }
  // One scheduled run. From stage 1 the Windows Task Scheduler is the only
  // scheduler (hourly · logon · wake · unlock); this decides whether this run
  // backs up and reports what happened for the run log. `dueMs` is 55 minutes so
  // an hourly trigger that fires a little early still runs.
  async runOnce(options = {}) {
    // 대량 삭제 · 변경 멈춤 (4.4): every result says while a hold waits — a skipped, busy or manual one too — so the run
    // executable tells it and judges it from all of them (GPT GA10).
    const result = await this.runOnceBody(options);
    return this.config?.massHold ? { ...result, mass: 1 } : result;
  }
  async runOnceBody({ skipCloud = null, force = false, dueMs = 55 * 60000 } = {}) {
    const c = this.config;
    if (!c?.repositoryId) return { outcome: 'skipped', reason: 'not-configured' };
    if (c.mode !== 'backup' || c.readOnly) return { outcome: 'skipped', reason: 'read-only' };
    if (!this.secret) return { outcome: 'skipped', reason: 'credential' };
    if (c.serverRestore) return { outcome: 'skipped', reason: 'restore' };
    // The server status this run read (accountHold): a restore is running or waits for the choice, or the account is
    // over its limit. A PC whose seat moved rests until it takes it back.
    if (c.movedTo) return { outcome: 'skipped', reason: 'moved' };
    if (this.accountHold) return { outcome: 'skipped', reason: this.accountHold };
    if (!c.automatic && !force) return { outcome: 'skipped', reason: 'off' };
    if (this.job || this.stopping) return { outcome: 'busy', reason: 'job' };
    if (skipCloud && this.isCloud() && !force) return { outcome: 'skipped', reason: String(skipCloud).slice(0, 40) };
    if (!force) {
      const timing = schedule(c, Math.min(this.intervalMs, dueMs), this.now(), this.lastAttempt);
      if (timing.clockHold) return { outcome: 'skipped', reason: 'clock' };
      if (timing.paused) return { outcome: 'skipped', reason: 'paused' };
      if (timing.dueAt > this.now()) return { outcome: 'not-due', nextAt: new Date(timing.dueAt).toISOString() };
      // An expired pause is cleared as tick() does; a person-started run leaves a pause alone (review B1).
      if (c.pausedUntil) c.pausedUntil = null;
    }
    this.resticStartedAt = null; this.lastSummary = null;
    const unlock = await this.unlockStale();
    const before = c.lastBackup?.id || null, started = this.now();
    try {
      this.lastRun = null; this.lastMissing = 0; this.lastOdd = 0;
      await this.backupNow();
      const s = this.config.lastBackup, sum = this.lastSummary || {}, num = v => Number.isFinite(v) ? v : null;
      if (this.lastRun === 'partial') {
        const p = this.config.lastPartial;
        const fill = this.fillDue();
        return { outcome: 'partial', unreadable: p?.unreadable ?? null, ...(fill ? { fill } : {}), ...gone(this.lastMissing), ...oddOf(this.lastOdd), unlock, durationMs: this.now() - started, newSnapshot: true, files: p?.files ?? null, bytes: p?.bytes ?? null,
          filesNew: num(sum.files_new), filesChanged: num(sum.files_changed), filesUnmodified: num(sum.files_unmodified), dataAdded: num(sum.data_added), resticStartedAt: this.resticStartedAt };
      }
      return { outcome: 'complete', ...gone(this.lastMissing), ...oddOf(this.lastOdd), unlock, durationMs: this.now() - started, newSnapshot: !!s?.id && s.id !== before, files: s?.files ?? null, bytes: s?.bytes ?? null,
        filesNew: num(sum.files_new), filesChanged: num(sum.files_changed), filesUnmodified: num(sum.files_unmodified), dataAdded: num(sum.data_added), resticStartedAt: this.resticStartedAt };
    } catch (e) {
      const exitCode = e.exitCode ?? null;
      return { outcome: exitCode === 11 ? 'busy' : exitCode === 3 ? 'partial' : 'failed', exitCode, ...gone(this.lastMissing), unlock, durationMs: this.now() - started, resticStartedAt: this.resticStartedAt };
    }
  }
  startScheduler(pollMs = 30000) { this.stopScheduler(); this.timer = setInterval(() => { void this.tick(); }, pollMs); this.timer.unref?.(); }
  stopScheduler() { clearInterval(this.timer); }
  stop() {
    this.discardCatalog();
    this.stopping = true; this.stopScheduler();
    // Windows termination is forcible and can strand repository locks. Let the
    // active operation finish; operation() prevents accepting another job.
    return this.job ? new Promise(resolve => this.once('idle', resolve)) : Promise.resolve();
  }
}
module.exports = { BackupEngine, customerVault, APP, VERIFIED, knownTags, KNOWN_TAGS, DAY, RESTIC_SHA256, parseKit, errorItems, oddName, walkOdd, stillThere, oddReads, topMost, gatherEarlier, restoreBases, checkFill, linked, subtreeOf, lockedVolumes, FILL_SPACING };
