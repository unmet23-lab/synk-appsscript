'use strict';
// 옮겨 오기 꾸러미 (STAGE1_DESIGN.md 4.6 「옮겨 오기 꾸러미」): one JSON file the old PC's run puts in the backup once a
// day — where its folders are (folders.rs snapshot), its programs (winget export + the install list), and the files of
// the 4.6b table as their filters let them through (no original, no secret-looking text). The new PC reads it as
// untrusted input: everything is checked against the table, filtered and checked once more.
const fs = require('node:fs/promises');
const path = require('node:path').win32;
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const apps = require('./move-apps.cjs');
const plan = require('./move-plan.cjs');

const KIT_NAME = 'workbackup-move-kit.json';
const KIT_TAG = 'movekit';
const LIMIT = { file: 4 * 1024 * 1024, app: 16 * 1024 * 1024, kit: 32 * 1024 * 1024, dirFiles: 500, depth: 4 };
const BASES = ['profile', 'roaming', 'local', 'documents'];
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
/** A plain absolute local path below a drive's root (카본 끝판 B4): backslashes only, no empty, `.` or `..` part, no
 *  control character and no second colon (a stream name). */
const absolute = p => typeof p === 'string' && /^[A-Za-z]:\\/.test(p) && p.length > 3 && p.length <= 32767 && !/[\/\x00-\x1f]/.test(p) && !p.slice(2).includes(':')
  && p.slice(3).split('\\').every(x => x && x !== '.' && x !== '..');

/** The table entry's path under `base`, with one `*` segment (a version folder such as Blender's `4.5`). */
async function resolveEntry(base, entry) {
  const parts = entry.path.split('\\'); const star = parts.indexOf('*');
  if (star < 0) return [{ full: path.join(base, ...parts), version: null }];
  const parent = path.join(base, ...parts.slice(0, star)); let names = [];
  try { names = (await fs.readdir(parent, { withFileTypes: true })).filter(d => d.isDirectory() && /^\d+\.\d+$/.test(d.name)).map(d => d.name); } catch {}
  return names.map(v => ({ full: path.join(parent, v, ...parts.slice(star + 1)), version: v }));
}
/** No folder from `base` down to `p` is a junction or link (GPT GA4): the kit holds only what is really in the profile,
 *  never what a link there points at. A part that is not there ends the check (nothing is read from it). */
async function linkFree(base, p) {
  const rel = path.relative(base, p); if (!rel || rel === '..' || rel.startsWith('..\\') || path.isAbsolute(rel)) return false;
  try { if ((await fs.lstat(base)).isSymbolicLink()) return false; } catch { return false; }
  let cursor = base;
  for (const part of rel.split('\\').filter(Boolean)) {
    cursor = path.join(cursor, part);
    // Only a part that is not there ends the check; one that cannot be looked at is not taken (카본 끝판 B5).
    try { if ((await fs.lstat(cursor)).isSymbolicLink()) return false; } catch (e) { return e?.code === 'ENOENT' || e?.code === 'ENOTDIR'; }
  }
  return true;
}
async function plainFile(p) { try { const s = await fs.lstat(p); return s.isFile() && !s.isSymbolicLink() ? s : null; } catch { return null; } }
/** The files of a folder entry: no link, nothing whose name starts with a dot (`.env`, `.git`, `.npmrc`), at most
 *  LIMIT.dirFiles and LIMIT.depth deep. `truncated` when it stopped early: then the entry is left out and said so
 *  (Fable D10), the app's other files stay. */
async function walk(dir, ext) {
  const files = []; let truncated = false;
  async function go(d, depth) {
    if (depth > LIMIT.depth) { truncated = true; return; }
    let items; try { items = await fs.readdir(d, { withFileTypes: true }); } catch { return; }
    for (const e of items) {
      if (truncated) return;
      const p = path.join(d, e.name);
      if (e.isSymbolicLink() || e.name.startsWith('.')) continue;
      if (e.isDirectory()) await go(p, depth + 1);
      else if (e.isFile() && (!ext || ext.some(x => e.name.toLowerCase().endsWith(x)))) {
        // Counted among the files the entry takes, not among all names in the folder (카본 끝판 B8).
        if (files.length >= LIMIT.dirFiles) { truncated = true; return; }
        files.push(p);
      }
    }
  }
  await go(dir, 0);
  return { files, truncated };
}
/** `never` paths of the table, `*` standing for one folder (a version such as Blender's `4.5`) — Fable D9. */
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const neverRe = n => new RegExp('^' + n.split('\\').map(part => part === '*' ? '[^\\\\]+' : escapeRe(part)).join('\\\\') + '(?:\\\\|$)', 'i');
const never = (setting, base, p) => { const r = path.relative(base, p); return setting.never.some(n => neverRe(n).test(r)); };
const WHY = new Set(['secret-looking', 'unreadable', 'too-many', 'too-big']);
/** The names of the profiles a filter took out (Windows Terminal), for the 「결과」: short, at most 50, none shaped like a key. */
const profileNames = list => (Array.isArray(list) ? list : []).filter(n => typeof n === 'string' && n && !apps.looksSecret(n)).slice(0, 50).map(n => n.slice(0, 64));

/**
 * The 4.6b table files on this PC as the kit carries them (apps.keep — filtered, never an original):
 * `{ apps: [{ app, name, files: [{ entry, version, rel, size, sha256, mtime, data, dropped }] }], tooBig, left }`.
 * `left` lists what was kept out and why, for the new PC's 「결과」. A file over LIMIT.file, or one past the app's
 * LIMIT.app, is left out by itself (`too-big`); the app's other files stay (카본 끝판 B2).
 */
async function collectApps(snapshot) {
  const out = [], tooBig = [], left = [];
  for (const setting of apps.TABLE.settings) {
    const files = []; let bytes = 0;
    for (const entry of setting.entries) {
      const base = snapshot.known?.[entry.base]?.path; if (!absolute(base)) continue;
      for (const { full, version } of await resolveEntry(base, entry)) {
        if (!await linkFree(base, full)) continue;
        let list = [{ f: full, rel: '' }];
        if (entry.kind === 'dir') {
          const w = await walk(full, entry.ext);
          if (w.truncated) { left.push({ app: setting.app, entry: entry.id, version, rel: '', why: 'too-many' }); continue; }
          list = w.files.map(f => ({ f, rel: path.relative(full, f) }));
        }
        for (const { f, rel } of list) {
          if (never(setting, base, f)) continue;
          const st = await plainFile(f); if (!st) continue;
          if (st.size > LIMIT.file) { left.push({ app: setting.app, entry: entry.id, version, rel, why: 'too-big' }); continue; }
          const raw = await fs.readFile(f).catch(() => null); if (!raw) continue;
          const kept = apps.keep(entry, raw); if (!kept) continue;
          if (kept.left) { left.push({ app: setting.app, entry: entry.id, version, rel, why: kept.left }); continue; }
          if (bytes + kept.data.length > LIMIT.app) { left.push({ app: setting.app, entry: entry.id, version, rel, why: 'too-big' }); continue; }
          bytes += kept.data.length;
          files.push({ entry: entry.id, version, rel, size: kept.data.length, sha256: sha(kept.data), mtime: Math.round(st.mtimeMs), data: kept.data.toString('base64'), dropped: kept.dropped || 0,
            ...(kept.droppedProfiles?.length ? { droppedProfiles: profileNames(kept.droppedProfiles) } : {}) });
        }
      }
    }
    if (files.length) out.push({ app: setting.app, name: setting.name, files });
  }
  return { apps: out, tooBig, left };
}
function run(exe, args, timeout) {
  return new Promise(resolve => execFile(exe, args, { timeout, windowsHide: true, maxBuffer: 64 * 1024 * 1024, encoding: 'utf8' }, (e, stdout) => resolve(e ? null : stdout)));
}
/**
 * Builds the kit on the old PC. `host` gives `folders.snapshot` and `reinstall.installed` (winget export at normal
 * privilege); `inventoryExe` is WorkBackupInventory.exe (`--programs-only`). `previous` is the last kit: its winget list
 * is kept when winget is skipped (metered line, over the time limit — 4.6).
 */
async function buildKit({ host, inventoryExe = null, previous = null, metered = false, uploadBytesPerSecond = null, now = new Date() }) {
  const snapshot = await host('folders.snapshot', []);
  let winget = null, wingetStatus = 'skipped';
  if (!metered) {
    const ids = await Promise.race([host('reinstall.installed', []).catch(() => null), new Promise(r => setTimeout(() => r(null), 120000).unref())]);
    if (Array.isArray(ids)) { winget = ids.filter(apps.validId).map(id => ({ id })); wingetStatus = 'ok'; } else wingetStatus = 'failed';
  }
  // The last kit's list only when that kit really had one (카본 끝판 B6): an empty list from a skipped run is none.
  const before = previous?.programs;
  if (!winget && Array.isArray(before?.winget) && (before.winget.length || /^ok/.test(String(before.wingetStatus || '')))) { winget = before.winget; wingetStatus += '-previous'; }
  let installed = [];
  if (inventoryExe) {
    const text = await run(inventoryExe, ['--programs-only'], 90000);
    try { installed = (JSON.parse(text).programs || []).map(p => ({ name: String(p.name || '').slice(0, 256), version: String(p.version || '').slice(0, 64), publisher: String(p.publisher || '').slice(0, 256), source: String(p.source || '').slice(0, 64) })).filter(p => p.name).slice(0, 10000); } catch {}
  }
  const { apps: collected, tooBig, left } = await collectApps(snapshot);
  const kit = { schema: 1, rules: apps.RULES, kind: 'synk-move-kit', createdAt: now.toISOString(), snapshot, uploadBytesPerSecond: Number.isFinite(uploadBytesPerSecond) ? uploadBytesPerSecond : null,
    programs: { winget: winget || [], wingetStatus, installed }, apps: collected, tooBig, left: left.slice(0, 500) };
  let text = JSON.stringify(kit);
  // Over the kit's limit, the last apps go out whole; each of their files is listed as left out, so the new PC says so.
  while (Buffer.byteLength(text) > LIMIT.kit && kit.apps.length) {
    const a = kit.apps.pop(); kit.tooBig.push(a.app);
    kit.left.push(...a.files.map(f => ({ app: a.app, entry: f.entry, version: f.version, rel: f.rel, why: 'too-big' })));
    kit.left = kit.left.slice(0, 500); text = JSON.stringify(kit);
  }
  return text;
}
/** Reads a kit as untrusted input (review M15). Returns `{ kit, problems }`; a part that fails a check is left out. */
function parseKit(text) {
  const problems = [];
  if (typeof text !== 'string' || Buffer.byteLength(text) > LIMIT.kit) return { kit: null, problems: ['size'] };
  let raw; try { raw = JSON.parse(text); } catch { return { kit: null, problems: ['format'] }; }
  if (raw?.schema !== 1 || raw.kind !== 'synk-move-kit') return { kit: null, problems: ['format'] };
  const s = raw.snapshot || {}; const known = {};
  for (const name of [...BASES, 'desktop', 'pictures', 'music', 'videos', 'downloads']) {
    const k = s.known?.[name]; if (!k) continue;
    if (absolute(k.path)) known[name] = { path: k.path, oneDrive: k.oneDrive === true, synced: k.synced === true }; else problems.push(`known:${name}`);
  }
  if (!known.profile) return { kit: null, problems: [...problems, 'profile'] };
  const hash = h => typeof h === 'string' && /^[0-9a-f]{64}$/.test(h) ? h : null;
  const snapshot = { schema: 1, computer: String(s.computer || '').slice(0, 64), known,
    oneDrive: (Array.isArray(s.oneDrive) ? s.oneDrive : []).filter(r => absolute(r?.path)).slice(0, 16).map(r => ({ kind: String(r.kind || '').slice(0, 32), path: r.path, emailSha256: hash(r.emailSha256) })),
    syncRoots: (Array.isArray(s.syncRoots) ? s.syncRoots : []).filter(absolute).slice(0, 64),
    // A letter is one capital as text (카본 끝판 B7: `["C"]` reads as 「C」 but is not one).
    drives: (Array.isArray(s.drives) ? s.drives : []).filter(d => typeof d?.letter === 'string' && /^[A-Z]$/.test(d.letter)).slice(0, 26).map(d => ({ letter: d.letter, label: String(d.label || '').slice(0, 64), fileSystem: String(d.fileSystem || '').slice(0, 16) })) };
  const programs = {
    winget: (Array.isArray(raw.programs?.winget) ? raw.programs.winget : []).filter(p => apps.validId(p?.id)).slice(0, 2000).map(p => ({ id: p.id })),
    wingetStatus: String(raw.programs?.wingetStatus || '').slice(0, 32),
    // The same fields the old PC wrote, a name never empty (카본 끝판 B3).
    installed: (Array.isArray(raw.programs?.installed) ? raw.programs.installed : []).filter(p => typeof p?.name === 'string' && p.name.trim()).slice(0, 10000)
      .map(p => ({ name: p.name.slice(0, 256), version: String(p.version || '').slice(0, 64), publisher: String(p.publisher || '').slice(0, 256), source: String(p.source || '').slice(0, 64) }))
  };
  const kept = [];
  // A kit made with older rules carried originals (Fable D7): its app files are not used at all.
  const rulesOk = raw.rules === apps.RULES; if (!rulesOk && Array.isArray(raw.apps) && raw.apps.length) problems.push('rules-old');
  const leftOut = (Array.isArray(raw.left) ? raw.left : []).slice(0, 500).filter(l => WHY.has(l?.why) && apps.TABLE.settings.some(s => s.app === l.app && s.entries.some(e => e.id === l.entry)))
    .map(l => ({ app: l.app, entry: l.entry, rel: typeof l.rel === 'string' && (l.rel === '' || l.rel.split('\\').every(plan.safeName)) ? l.rel : '', why: l.why }));
  for (const a of rulesOk && Array.isArray(raw.apps) ? raw.apps : []) {
    const setting = apps.TABLE.settings.find(x => x.app === a?.app); if (!setting) { problems.push('app'); continue; }
    const files = [];
    for (const f of Array.isArray(a.files) ? a.files : []) {
      const entry = setting.entries.find(e => e.id === f?.entry);
      const relOk = entry && (entry.kind === 'file' ? f.rel === '' : typeof f.rel === 'string' && f.rel.length > 0 && f.rel.split('\\').every(plan.safeName) && (!entry.ext || entry.ext.some(e => f.rel.toLowerCase().endsWith(e))));
      const versionOk = entry && (entry.path.includes('*') ? typeof f.version === 'string' && /^\d+\.\d+$/.test(f.version) : f.version == null);
      let data = null; try { data = Buffer.from(String(f?.data || ''), 'base64'); } catch {}
      if (!relOk || !versionOk || !data || data.length !== f.size || data.length > LIMIT.file || sha(data) !== f.sha256) { problems.push(`file:${a.app}`); continue; }
      files.push({ entry: entry.id, version: f.version ?? null, rel: f.rel, size: f.size, sha256: f.sha256, mtime: Number.isFinite(f.mtime) ? f.mtime : null, data, dropped: Number.isSafeInteger(f.dropped) && f.dropped >= 0 ? f.dropped : 0, droppedProfiles: profileNames(f.droppedProfiles) });
    }
    if (files.length) kept.push({ app: setting.app, name: setting.name, files });
  }
  return { kit: { schema: 1, createdAt: String(raw.createdAt || ''), snapshot, uploadBytesPerSecond: Number.isFinite(raw.uploadBytesPerSecond) ? raw.uploadBytesPerSecond : null, programs, apps: kept, left: leftOut }, problems };
}
/** Puts the kit into the repository as its own small backup (tag `movekit`, the device's host name — in a customer's
 *  repository that is the device number, `engine.hostName`, which the new PC's move then names as `from`). */
async function storeKit(engine, text, { host = engine.hostName || engine.config.vaultId, tags = [] } = {}) {
  const { APP } = require('./engine.cjs');
  // The app's and the vault's tags too, so the engine's own snapshot listing finds it; `movekit` sets it apart from backups.
  await engine.run(['backup', '--stdin', '--stdin-filename', KIT_NAME, '--host', host, '--tag', [APP, `vault:${engine.config.vaultId}`, ...tags, KIT_TAG].join(',')], { stdinText: text, timeoutMs: 300000 });
}
/** The newest kit of the old device `from`, read and checked. `null` when it has none. */
async function loadKit(engine, from) {
  const list = (await engine.snapshots([KIT_TAG])).filter(s => s.hostname === from);
  for (const s of list) {
    let text = '';
    try { await engine.run(['dump', s.id, '/' + KIT_NAME], { consumeStdout: async stream => { const parts = []; let n = 0; for await (const c of stream) { n += c.length; if (n > LIMIT.kit) throw new Error('MOVE_KIT_SIZE'); parts.push(c); } text = Buffer.concat(parts).toString('utf8'); } }); }
    catch (e) {
      // Only a fault of this kit (too big, not in its snapshot) sends the search to an older one. A repository,
      // network or sign-in failure is said as it is, never read as 「no kit」 or answered with an old kit (카본 끝판 B1).
      // restic says `path "/workbackup-move-kit.json" not found in snapshot`; a repository file it cannot open says
      // other words (`unable to open config file: no such file …`) and is passed on (GPT 2차 -g GA1).
      if (e?.message === 'MOVE_KIT_SIZE' || (e?.exitCode && /not found in snapshot/i.test(String(e.message)) && String(e.message).includes(KIT_NAME))) continue;
      throw e;
    }
    const parsed = parseKit(text);
    if (parsed.kit) return { ...parsed, snapshotId: s.id, at: s.time };
  }
  return null;
}
module.exports = { never, linkFree, KIT_NAME, KIT_TAG, LIMIT, buildKit, parseKit, collectApps, storeKit, loadKit };
