'use strict';
// 「새 PC로 옮겨 오기」의 계획 (STAGE1_DESIGN.md 4.6 「놓는 자리」 · 「OneDrive와 다른 동기화 폴더」). Pure functions:
// where each backed-up path goes on the new PC, each folder's default, the side folder, and the space per volume.
// `old` is the move kit's snapshot of the old PC, `now` is this PC's (both the shape of folders.rs `snapshot()`).
const path = require('node:path').win32;

const SIX = ['documents', 'desktop', 'pictures', 'music', 'videos', 'downloads'];
const LABEL = { documents: '문서', desktop: '바탕 화면', pictures: '사진', music: '음악', videos: '동영상', downloads: '다운로드' };
/** Under the documents folder, never put back in place: PowerShell profiles and auto-loaded modules. */
const DOCUMENT_SIDE = new Set(['powershell', 'windowspowershell']);
const MOVE_BASE = '옮겨 온 자료';
const SIDE = '따로 둔 것';
const NAME_UNITS = 255, PATH_UNITS = 32767;

const key = p => String(p).replace(/[\\/]+$/, '').replace(/\//g, '\\').toLowerCase();
/** `p` is `root` or inside it. */
const within = (p, root) => { const a = key(p), b = key(root); return !!b && (a === b || a.startsWith(b + '\\')); };
/** `p` relative to `root` (backslashes), '' when equal; null when not inside. */
const rel = (p, root) => { if (!within(p, root)) return null; return String(p).replace(/\//g, '\\').replace(/\\+$/, '').slice(String(root).replace(/[\\/]+$/, '').length).replace(/^\\+/, ''); };
const units = s => { let n = 0; for (const c of s) n += c.codePointAt(0) > 0xffff ? 2 : 1; return n; };
/** One Windows name: no forbidden or control character, no trailing dot or space, no device name, at most 255 units. */
function safeName(name) {
  if (typeof name !== 'string' || !name || units(name) > NAME_UNITS || /[<>:"/\\|?*\x00-\x1f]/.test(name) || /[. ]$/.test(name)) return false;
  // Windows drops the spaces before the first dot too, so 「NUL .txt」 is the device (카본 끝판 C5).
  const stem = name.split('.')[0].replace(/ +$/, '').toUpperCase();
  return !/^(CON|PRN|AUX|NUL|CONIN\$|CONOUT\$|COM[0-9¹²³]|LPT[0-9¹²³])$/.test(stem);
}
/** A plain absolute local-drive path made of safe names: a drive's root, or names with one backslash between them and
 *  none at the end (카본 끝판 C6). */
const safePath = p => typeof p === 'string' && /^[A-Za-z]:\\/.test(p) && !p.includes('/') && units(p) <= PATH_UNITS && (p.length === 3 || p.slice(3).split('\\').every(safeName));
const drive = p => /^[A-Za-z]:/.test(p) ? p[0].toUpperCase() : null;

function known(snap, name) { const k = snap?.known?.[name]; return k && typeof k.path === 'string' ? k : null; }
function syncRoots(snap) { return [...(snap?.oneDrive || []).map(r => r.path), ...(snap?.syncRoots || [])].filter(p => typeof p === 'string'); }
/** `p` is under a sync root, or under a known folder the snapshot says is synced — one rule for both PCs (카본 끝판 C9). */
const inSync = (p, snap) => syncRoots(snap).some(r => within(p, r)) || SIX.some(n => known(snap, n)?.synced && within(p, known(snap, n).path));
function oneDriveOf(p, snap) { return (snap?.oneDrive || []).filter(r => typeof r.path === 'string' && within(p, r.path)).sort((a, b) => b.path.length - a.path.length)[0] || null; }
/** The longest of the six known folders on `snap` that holds `p`. */
function knownOf(p, snap) {
  let best = null;
  for (const name of SIX) { const k = known(snap, name); if (k && within(p, k.path) && (!best || k.path.length > best.path.length)) best = { name, path: k.path }; }
  return best;
}
function places(now) {
  const profile = known(now, 'profile')?.path;
  if (!profile) throw new Error('이 PC의 사용자 폴더를 확인하지 못했습니다.');
  return { profile, base: path.join(profile, MOVE_BASE), side: path.join(profile, MOVE_BASE, SIDE) };
}
const join = (root, relative) => relative ? path.join(root, relative) : root;

/**
 * Where a backed-up path `p` goes in 「원래 자리」 mode (4.6 「놓는 자리」, review M1): `{ path, side }`.
 * Only under the six known folders (but the documents folder's PowerShell folders) and under the profile's plain
 * folders does it go back in place. The rest of the profile (AppData, dot folders, files right in the profile) goes to
 * 「따로 둔 것」; elsewhere on the old system drive to `옮겨 온 자료\C 드라이브`; another drive to
 * `옮겨 온 자료\<X> 드라이브` unless the person picked the same drive (`sameDrive`). `dir`: `p` is a folder — a folder
 * right in the profile (`Projects`, `Dropbox`) goes back in place, a file there does not (카본 끝판 C1).
 */
function routeOriginal(p, { old, now, sameDrive = false, dir = false }) {
  const at = places(now);
  return onNewPc(routeOld(p, { old, now, sameDrive, dir, at }), { now, at, dir });
}
function routeOld(p, { old, now, sameDrive, dir, at }) {
  const k = knownOf(p, old);
  if (k) {
    const r = rel(p, k.path), first = r.split('\\')[0].toLowerCase();
    if (k.name === 'documents' && DOCUMENT_SIDE.has(first)) return { path: join(path.join(at.side, LABEL.documents), r), side: true, reason: 'autorun' };
    const target = known(now, k.name)?.path;
    return target ? { path: join(target, r), side: false } : { path: join(path.join(at.base, LABEL[k.name]), r), side: false };
  }
  const oldProfile = known(old, 'profile')?.path;
  if (oldProfile && within(p, oldProfile)) {
    const r = rel(p, oldProfile), parts = r.split('\\'), first = parts[0].toLowerCase();
    if (!r) return dir ? { path: at.profile, side: false } : { path: at.side, side: true, reason: 'profile' };
    if ((parts.length === 1 && !dir) || first.startsWith('.') || first === 'appdata') return { path: join(at.side, r), side: true, reason: 'profile' };
    return { path: join(at.profile, r), side: false };
  }
  const letter = drive(p);
  // Not on a drive letter (a network place): kept apart under its own name, never 「null 드라이브」 (카본 끝판 C7).
  if (!letter) return { path: join(path.join(at.base, OTHER_PLACE), otherRest(p)), side: false };
  const rest = p.slice(3);
  if (letter === drive(oldProfile || '')) return { path: join(path.join(at.base, `${letter} 드라이브`), rest), side: false };
  const fixed = (now?.drives || []).some(d => String(d.letter).toUpperCase() === letter);
  if (sameDrive && fixed && letter !== drive(at.profile)) return { path: p, side: false };
  return { path: join(path.join(at.base, `${letter} 드라이브`), rest), side: false };
}
const OTHER_PLACE = '다른 자리';
/** `\\server\share\a` or `\\?\UNC\server\share\a` → `server\share\a` (names only; what is not a safe name stops the
 *  path at `destination`). */
const otherRest = p => String(p).replace(/^\\\\[?.]\\(?:UNC\\)?/i, '').replace(/^\\+/, '').replace(/:/g, '');
/**
 * The same rule, read on the new PC (카본 끝판 C2): where a path lands is never the new PC's PowerShell folders, AppData,
 * a dot folder or a file right in its profile — whatever the old PC's layout was (one PC with OneDrive's 문서 and
 * the other without, a documents folder moved to another drive).
 */
function onNewPc(out, { now, at, dir }) {
  if (out.side || within(out.path, at.base)) return out;
  const docs = known(now, 'documents')?.path;
  const inDocs = docs ? rel(out.path, docs) : null;
  if (inDocs && DOCUMENT_SIDE.has(inDocs.split('\\')[0].toLowerCase())) return { path: join(path.join(at.side, LABEL.documents), inDocs), side: true, reason: 'autorun' };
  const r = rel(out.path, at.profile);
  if (r) {
    const parts = r.split('\\'), first = parts[0].toLowerCase();
    if ((parts.length === 1 && !dir) || first.startsWith('.') || first === 'appdata') return { path: join(at.side, r), side: true, reason: 'profile' };
  }
  return out;
}
/** The folder name a backed-up folder gets under 「OneDrive 밖 새 폴더」. */
function folderLabel(original, old) {
  for (const name of SIX) { const k = known(old, name); if (k && key(k.path) === key(original)) return LABEL[name]; }
  return path.basename(original.replace(/\\+$/, '')) || (drive(original) ? `${drive(original)} 드라이브` : OTHER_PLACE);
}
/** `name` with ` (n)` after it, the name cut at a whole character so it stays within 255 units (카본 끝판 C8). */
function numbered(base, n) {
  const tail = ` (${n})`; let head = [...base];
  while (head.length && units(head.join('') + tail) > NAME_UNITS) head.pop();
  return head.join('').replace(/[. ]+$/, '') + tail;
}
/** Unique labels for all backed-up folders (a second 「문서」 becomes 「문서 (2)」), never one already given — also not
 *  when a folder is itself called 「foo (2)」 (GPT GA5) — and never 「따로 둔 것」. */
function labels(sources, old) {
  const used = new Set([SIDE.toLowerCase()]);
  return sources.map(original => {
    const base = folderLabel(original, old); let name = base;
    for (let n = 2; used.has(name.toLowerCase()); n++) name = numbered(base, n);
    used.add(name.toLowerCase());
    return name;
  });
}
/**
 * Each backed-up folder's choices and default (4.6 table): 'original' (원래 자리), 'newFolder' (OneDrive 밖 새 폴더),
 * 'oneDriveGaps' (OneDrive에 없거나 다른 것만 OneDrive 밖 새 폴더로), 'skip'.
 */
function folderPlans(sources, { old, now, base = null }) {
  const at = places(now), names = labels(sources, old);
  return sources.map((original, i) => {
    const route = routeOriginal(original, { old, now, dir: true });
    const oldSynced = inSync(original, old);
    const oldDrive = oneDriveOf(original, old);
    const newSynced = !route.side && inSync(route.path, now);
    const newDrive = route.side ? null : oneDriveOf(route.path, now);
    const sameAccount = !!(oldDrive?.emailSha256 && newDrive?.emailSha256 && oldDrive.emailSha256 === newDrive.emailSha256);
    const newFolder = path.join(base || at.base, names[i]);
    let mode, why;
    if (!oldSynced && !newSynced) { mode = 'original'; why = 'local'; }
    else if (!oldSynced) { mode = 'newFolder'; why = 'new-synced'; }
    else if (oldDrive && sameAccount) { mode = 'oneDriveGaps'; why = 'same-onedrive'; }
    else { mode = 'newFolder'; why = 'old-synced'; }
    // 「같은 드라이브에 그대로」 only where routeOriginal would honour it (카본 끝판 C3): not a known folder, not in the old
    // profile, not the old or the new system drive, and a fixed drive here.
    const oldProfile = known(old, 'profile')?.path || '', letter = drive(original);
    const otherDrive = !!letter && !knownOf(original, old) && !(oldProfile && within(original, oldProfile)) && letter !== drive(oldProfile) && letter !== drive(at.profile)
      && (now?.drives || []).some(d => String(d.letter).toUpperCase() === letter);
    return { original, label: names[i], mode, why, destination: route.path, side: route.side, newFolder, oldSynced, newSynced, sameAccount,
      modes: ['original', 'newFolder', ...(oldDrive && sameAccount ? ['oneDriveGaps'] : []), 'skip'],
      sameDrive: otherDrive ? (now.drives.find(d => String(d.letter).toUpperCase() === drive(original)) || null) : null };
  });
}
/**
 * Where one file or folder `relative` (forward slashes, inside the backed-up folder) goes for a folder plan with the
 * chosen `mode`: `{ path, side, check }` — `check` is the OneDrive place compared first in 'oneDriveGaps' mode —
 * or `{ skip }` with the reason ('name' · 'long').
 */
function destination(plan, relative, { old, now, mode = plan.mode, sameDrive = false, dir = false }) {
  const parts = relative ? relative.split('/') : [];
  if (parts.some(part => !safeName(part))) return { skip: 'name' };
  const original = parts.length ? path.join(plan.original, ...parts) : plan.original;
  let out;
  if (mode === 'original') out = routeOriginal(original, { old, now, sameDrive, dir: dir || !parts.length });
  else if (mode === 'newFolder' || mode === 'oneDriveGaps') out = { path: parts.length ? path.join(plan.newFolder, ...parts) : plan.newFolder, side: false };
  else return { skip: 'chosen' };
  if (mode === 'oneDriveGaps') out.check = routeOriginal(original, { old, now }).path;
  if (!safePath(out.path)) return { skip: 'long' };
  return out;
}
/** Bytes per destination volume, with what 「(복구본)」 copies may add and 16 MiB to spare (review M20). */
function space(items) {
  const per = new Map();
  for (const { path: p, size = 0, compare = false } of items) {
    const v = drive(p); if (!v) continue;
    const e = per.get(v) || { volume: `${v}:\\`, bytes: 16 * 1024 * 1024, mayAdd: 0 };
    e.bytes += size; if (compare) e.mayAdd += size; per.set(v, e);
  }
  return [...per.values()];
}

/**
 * `files.probe` in parts. The host answers at most PROBE_PART paths a call (its answer carries no paths, so it stays
 * well under the 128 KiB frame the native side may send the worker — protocol.rs MAX_REQUEST), and a call's paths stay
 * under PROBE_BYTES, well inside the 2 MiB frame the worker may send (MAX_RESPONSE), even for very long paths (카본 끝판 C4).
 */
const PROBE_PART = 500, PROBE_BYTES = 1024 * 1024;
async function probeAll(host, paths) {
  const out = [];
  for (let i = 0; i < paths.length;) {
    let j = i, bytes = 0;
    while (j < paths.length && j - i < PROBE_PART && (j === i || bytes + Buffer.byteLength(JSON.stringify(paths[j])) + 1 <= PROBE_BYTES)) bytes += Buffer.byteLength(JSON.stringify(paths[j++])) + 1;
    out.push(...await host('files.probe', [paths.slice(i, j)]));
    i = j;
  }
  return out;
}
module.exports = { PROBE_PART, PROBE_BYTES, probeAll, SIX, LABEL, MOVE_BASE, SIDE, safeName, safePath, within, rel, places, routeOriginal, folderPlans, destination, labels, space, inSync, oneDriveOf };
