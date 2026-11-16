'use strict';
// 「새 PC로 옮겨 오기」의 입구 (STAGE1_DESIGN.md 4.6 · 4.6b). The worker's handlers call these; each returns what the four
// screens show (자리 고르기 · 진행 · 결과 · 다시 깔 것 — 공유 노트 `옮겨오기_화면자료.md`). `host` is the Rust host
// (files.* · folders.* · reinstall.*), `server` the provisioning client (pinMove · unpinMove), optional in tests.
const fs = require('node:fs/promises');
const path = require('node:path').win32;
const crypto = require('node:crypto');
const { Move } = require('./move-restore.cjs');
const kits = require('./move-kit.cjs');
const apps = require('./move-apps.cjs');
const plan = require('./move-plan.cjs');
const { restoreSettings } = require('./move-settings.cjs');

const STATE = 'move.json';
const newId = () => crypto.randomBytes(8).toString('hex');
async function readJson(file) { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return null; } }
/** Each write its own temporary name (카본 끝판 E3), so two never share one. */
async function writeJson(file, value) { await fs.mkdir(path.dirname(file), { recursive: true }); const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`; await fs.writeFile(tmp, JSON.stringify(value, null, 2)); await fs.rename(tmp, file); }

/**
 * Where each folder of a move now lives on this PC (화면 세션 E2): the way chosen, the same-drive choice, and its roots —
 * every place its files went, not only the folder's own (GPT workbackup-movestate GA1): 'place' (back where it was, a
 * known folder where this PC keeps it, or the same place on the other drive), 'moved' (under 「옮겨 온 자료」), 'side'
 * (「따로 둔 것」 — app places, dot folders, files right in the profile, PowerShell folders, a second name differing only
 * by case), 'newFolder', and for 'oneDriveGaps' the OneDrive place it was compared with ('oneDrive') first.
 * `destination` is where 「원래 자리」 puts the folder itself with that same-drive choice. The files come from the
 * folder's listing (and what an earlier backup added), each placed as the move places it; a path the rules turn down
 * has no root, a skipped folder none at all. At most ROOTS roots (`rootsCut` then).
 */
const ROOTS = 32;
/** 화면 세션 E8: how long an old device's lists are kept for the 「자리 고르기」 screen, and its backups' list for the
 *  request that named it a moment ago. */
const LIST_TTL = 10 * 60000, SNAPSHOTS_TTL = 5000;
/** A move started and not finished since (화면 세션 E1 · E13): no result, or a result older than the start — a finished
 *  move started again keeps the last result until the new one is written. */
const unfinishedOf = st => {
  const started = Date.parse(st?.startedAt);
  return Number.isFinite(started) && !(Date.parse(st?.result?.at) >= started);
};
/**
 * What a start writes into the state (pure, for the tests): an unfinished move of the same old device goes on under its
 * number, and once it has begun placing files (`started`: its ledger has lines) with the places it was started with
 * (화면 세션 E9 — also after this PC took the write seat, 4.6 「넘겨받은 뒤에도 그 장부로 이어서 끝낼 수 있다」). One
 * that stopped before writing anything (no space where it was to go, GPT workbackup-move4b GA1) takes the new places; a
 * finished one starts again under a new number and keeps its last result until
 * the new one is written (E13), and takes over what the last one placed (`carryFrom`, 화면 세션 E11; a resume keeps the
 * one it started with). Another old device: its last result, ticks, installs and settings do not carry over
 * (카본 끝판 E4). The start holds the old device's backup again (pinMove), so a release from before no longer stands
 * (마지막 끝판 카본 B1).
 */
function startState(before, { from, choices, now = new Date(), id = newId, started = true }) {
  const resume = !!before.moveId && before.from === from && unfinishedOf(before);
  const kept = resume && started && before.choices && typeof before.choices === 'object' && !Array.isArray(before.choices) ? before.choices : choices;
  const other = before.from !== undefined && before.from !== from ? { checked: [], reinstall: null, settings: null, result: null } : {};
  const carry = resume ? {} : { carryFrom: before.from === from && typeof before.moveId === 'string' ? before.moveId : null };
  return { moveId: resume ? before.moveId : id(), from, choices: kept, startedAt: now.toISOString(), released: null, ...other, ...carry };
}
const CODE = /^[A-Z][A-Z_]{1,31}$/;
/** A failure's code for `lastMoveError` (화면 세션 E4). The move's own refusals carry theirs (MOVE_NO_SPACE ·
 *  MOVE_LIST_TOO_BIG); this PC's profile not read, the old device's backup gone, and a lost connection are told by
 *  their words. The rest stays MOVE_FAILED (and a held repository BUSY) in the engine. */
function moveCode(e) {
  if (!e || typeof e !== 'object' || CODE.test(e.code || '')) return e;
  const text = String(e.message || '');
  const code = /사용자 폴더를 확인하지 못했습니다/.test(text) ? 'MOVE_PROFILE'
    : /no matching ID|snapshot .{0,80}not found|unable to load snapshot|could not find snapshot/i.test(text) ? 'MOVE_SNAPSHOT_GONE'
    : /dial tcp|connection (?:reset|refused)|i\/o timeout|no such host|TLS handshake|network is unreachable|connectex/i.test(text) ? 'MOVE_NETWORK' : null;
  if (code) e.code = code;
  return e;
}
/** The sync a place is in (화면 세션 E3): 'oneDrive', another sync folder ('other' — Dropbox, Google Drive …), or null. */
const syncOf = (p, snap) => (typeof p !== 'string' ? null : plan.oneDriveOf(p, snap) ? 'oneDrive' : plan.inSync(p, snap) ? 'other' : null);
function placed(folders, choices, { old, now }) {
  const at = plan.places(now);
  return folders.map(f => {
    const choice = choices[f.original] || {};
    const mode = choice.mode || f.fp.mode, sameDrive = !!choice.sameDrive;
    const back = plan.destination(f.fp, '', { old, now, mode: 'original', sameDrive, dir: true });
    const roots = []; let cut = false;
    const kind = p => (plan.within(p, at.side) ? 'side' : mode !== 'original' ? 'newFolder' : plan.within(p, at.base) ? 'moved' : 'place');
    // A root of one kind can hold one of another (「따로 둔 것」 sits in the new profile): each kind is kept apart.
    const under = (p, k = kind(p)) => roots.some(r => r.kind === k && plan.within(p, r.path));
    const add = (p, k = kind(p)) => { if (under(p, k)) return; if (roots.length >= ROOTS) { cut = true; return; } roots.push({ path: p, kind: k }); };
    const where = (name, dir) => plan.destination(f.fp, name, { old, now, mode, sameDrive, dir });
    // One placed file or folder: 「따로 둔 것」 counts as one root; elsewhere the shallowest folder above it that lands
    // apart from the roots so far (a known folder this PC keeps on another drive) is the root.
    const reach = (name, dir) => {
      const d = where(name, dir);
      if (d.skip) return;
      const k = kind(d.path);
      if (k === 'side') { if (!under(d.path, 'side')) add(at.side, 'side'); return; }
      if (under(d.path, k)) return;
      const parts = name.split('/');
      for (let i = 1; i <= parts.length; i++) {
        const a = i === parts.length ? d : where(parts.slice(0, i).join('/'), true);
        if (!a.skip && plan.within(d.path, a.path) && kind(a.path) === k && !under(a.path, k)) return add(a.path, k);
      }
    };
    if (mode !== 'skip') {
      const top = where('', true);
      if (!top.skip) { if (mode === 'oneDriveGaps' && top.check) add(top.check, 'oneDrive'); add(top.path); }
      for (const n of f.listing?.nodes?.values?.() || []) reach(n.name, n.type === 'dir');
      for (const file of f.extra || []) reach(file.name, false);
      // A second name differing only by case goes to 「따로 둔 것」 whatever the way (move-restore place()).
      if (f.listing?.aside?.size) add(at.side, 'side');
    }
    return { original: f.original, mode, sameDrive, destination: back.skip ? f.fp.destination : back.path, newFolder: f.fp.newFolder, label: f.fp.label, roots, ...(cut ? { rootsCut: true } : {}) };
  });
}

class MoveService {
  constructor({ engine, host, stateDir, localDir, server = null }) {
    Object.assign(this, { engine, host, stateDir, localDir, server });
    this.file = path.join(stateDir, STATE); this.ledgerDir = path.join(localDir, 'migration');
    this.queue = Promise.resolve();
    /** 화면 세션 E8: the old device's lists last read (`lists`), and the backups' list a moment ago. */
    this.kept = null; this.forget = null; this.recent = null; this.clock = () => Date.now();
  }
  async state() { return (await readJson(this.file)) || {}; }
  /** Read, change and write the state one at a time (카본 끝판 E3): two ticks in a row, or a tick while a step saves,
   *  never lose one another's change. `change(state)` returns the fields to set. */
  update(change) {
    const run = this.queue.then(async () => { const st = await this.state(); const next = { ...st, ...await change(st) }; await writeJson(this.file, next); return next; });
    this.queue = run.catch(() => {});
    return run;
  }
  save(patch) { return this.update(() => patch); }
  /** The old devices with backups in this repository (restic host names), newest first. */
  async devices() {
    const all = await this.snapshots();
    const by = new Map();
    for (const s of all) if (s.tags?.includes('complete-structure-checked') && !by.has(s.hostname)) by.set(s.hostname, { from: s.hostname, lastBackupAt: s.time });
    return [...by.values()];
  }
  /** The repository's backups. A request names its old device (devices) and then reads its lists (lists) within moments:
   *  the one list serves both (화면 세션 E8). */
  async snapshots() {
    const r = this.recent;
    if (r && this.clock() - r.at < SNAPSHOTS_TTL) return r.list;
    const list = await this.engine.snapshots();
    this.recent = { at: this.clock(), list };
    return list;
  }
  /**
   * 화면 세션 E8: an old device's lists (its folders' listings and its move kit), kept a few minutes under the numbers of
   * its backups, so changing a way on 「자리 고르기」 does not read them from the cloud again. A backup added or forgotten
   * since, another old device, or the time passing reads them again. `plans` is null until a Move read them (keep).
   */
  async lists(from) {
    const ids = (await this.snapshots()).filter(s => s.hostname === from).map(s => s.id).sort().join(' ');
    const k = this.kept;
    if (k && k.from === from && k.ids === ids && this.clock() - k.at < LIST_TTL) return k;
    this.drop();
    return { from, ids, at: null, loaded: await kits.loadKit(this.engine, from), plans: null };
  }
  /** A folder's listing can hold a million names: what is kept is let go when its time is up, also with no request after. */
  keep(lists, plans) {
    this.drop();
    this.kept = { ...lists, at: lists.at ?? this.clock(), plans };
    this.forget = setTimeout(() => this.drop(), Math.max(0, this.kept.at + LIST_TTL - this.clock()));
    this.forget.unref?.();
  }
  /** Lets the kept lists go, and their timer with them: a timer, also one that has fired, holds what its callback names
   *  (GPT workbackup-move-e8e11 GA1), so the callback names none. */
  drop() { clearTimeout(this.forget); this.forget = null; this.kept = null; }
  async context(from, loaded) {
    if (loaded === undefined) loaded = await kits.loadKit(this.engine, from);
    const now = await this.host('folders.snapshot', []);
    // Without a kit the old places are unknown: the person picks; the plan then uses this PC's own layout for both.
    return { kit: loaded?.kit || null, problems: loaded?.problems || ['no-kit'], old: loaded?.kit?.snapshot || now, now };
  }
  /** 「자리 고르기」: each folder's default, choices, counts and the space per volume. Pins the old device's backup. */
  async preview({ from, choices = {} }) {
    const lists = await this.lists(from);
    const ctx = await this.context(from, lists.loaded);
    // Counted as a start would go (startState): an unfinished move of this old device only for what it has left; a new
    // one without what it takes over from the last finished one (화면 세션 E11), so the space asked is the space needed.
    const st = await this.state();
    const resume = typeof st.moveId === 'string' && st.from === from && unfinishedOf(st);
    const carryFrom = resume ? st.carryFrom ?? null : st.from === from ? st.moveId ?? null : null;
    const move = new Move({ engine: this.engine, host: this.host, from, old: ctx.old, now: ctx.now, choices, moveId: resume ? st.moveId : newId(), ledgerDir: this.ledgerDir, carryFrom, plans: lists.plans });
    if (resume) await move.resume({ tidy: false });
    const folders = await move.prepare();
    this.keep(lists, move.plans);
    await move.carryOver();
    const view = await move.preview();
    const latest = folders.map(f => f.selector.split(':')[0]).find(Boolean);
    if (this.server && latest) await this.server.pinMove(latest).catch(() => {});
    const sameLooking = await this.sameLooking(move, folders);
    // 화면 세션 E3: where each folder goes (its roots and their kinds) and the syncs on both PCs. A folder the old PC
    // kept in OneDrive may come partly: online-only files were not in its backup (`partial`).
    const where = new Map(placed(folders, choices, ctx).map((p, i) => [folders[i].original, { p, fp: folders[i].fp }]));
    view.folders = view.folders.map(v => {
      const w = where.get(v.original); if (!w) return v;
      const oldSync = syncOf(v.original, ctx.old);
      return { ...v, side: !!w.fp.side, sameAccount: !!w.fp.sameAccount, oldSync, newSync: w.fp.side ? null : syncOf(w.fp.destination, ctx.now), partial: oldSync === 'oneDrive',
        roots: w.p.roots, ...(w.p.rootsCut ? { rootsCut: true } : {}) };
    });
    return { from, kitAt: ctx.kit?.createdAt || null, kitProblems: ctx.problems, suggestKeepAsIs: sameLooking > 0.5, ...view };
  }
  /** Share of files a probe finds with the backup's size and time (「같은 PC를 다시 깐 경우」, 4.6) — an estimate only. */
  async sameLooking(move, folders) {
    const items = [];
    for (const f of folders) for (const n of f.listing.nodes.values()) if (n.type === 'file' && items.length < 2000) { const j = move.target(f, n.name); if (!j.skip) items.push({ p: j.path, n }); }
    if (!items.length) return 0;
    const seen = await plan.probeAll(this.host, items.map(i => i.p)).catch(() => []);
    return seen.filter((s, i) => s?.kind === 'file' && s.size === items[i].n.size && Math.abs(s.mtimeMs - items[i].n.mtime) < 1000).length / items.length;
  }
  /** Runs (or resumes) the move under the engine's operation, so the window shows its stage and percent. */
  async start({ from, choices = {}, onProgress = () => {} }) {
    try { return await this.run({ from, choices, onProgress }); } catch (e) { throw moveCode(e); }
  }
  async run({ from, choices, onProgress }) {
    // An unfinished run of the same old device goes on under its number. A finished one (complete or not) starts
    // again under a new number, so the files it could not place are tried again (startState).
    const { moveId, choices: used, carryFrom } = await this.update(async before => startState(before, { from, choices, started: await this.begun(before.moveId) }));
    choices = used;
    // 화면 세션 E8: the lists the preview read a moment ago (the same backups) are taken and let go: the run keeps them.
    const lists = await this.lists(from); this.drop();
    const ctx = await this.context(from, lists.loaded);
    // 화면 세션 E7: the progress names the folder being fetched. E11: what the last finished move placed is taken over.
    const move = new Move({ engine: this.engine, host: this.host, from, old: ctx.old, now: ctx.now, choices, moveId, ledgerDir: this.ledgerDir, carryFrom: carryFrom ?? null, plans: lists.plans,
      onProgress: p => onProgress({ percent: p.total ? Math.min(99, Math.floor(p.bytes / p.total * 100)) : null, bytes: p.bytes, total: p.total, folder: move.current ?? null }) });
    // The old device keeps the backup the move reads, also when the move starts or resumes without a preview (카본 끝판 E7).
    const prepared = await move.prepare();
    const latest = prepared.map(f => f.selector.split(':')[0]).find(Boolean);
    if (this.server && latest) await this.server.pinMove(latest).catch(() => {});
    const result = await move.run();
    const folders = placed(move.folders || [], choices, ctx);
    const saved = { moveId, at: new Date().toISOString(), counts: result.counts, complete: result.complete, removedTemp: result.removedTemp, items: result.items.slice(0, 2000), folders, side: plan.places(ctx.now).side };
    await this.save({ result: saved });
    return saved;
  }
  /** Whether a move's ledger has lines: it began placing files (a space refusal stops it before the first line). */
  async begun(moveId) {
    if (typeof moveId !== 'string' || !/^[0-9a-f]{8,32}$/.test(moveId)) return false;
    try { return (await fs.stat(path.join(this.ledgerDir, `${moveId}.jsonl`))).size > 0; } catch { return false; }
  }
  /** The last move's result. Each root says whether it is a folder on this PC now (화면 세션 E15): an empty folder, or
   *  one whose files could not be placed, is not there, and a seat taken with it would be refused. Without the host's
   *  answer the roots say nothing about it. */
  async result() {
    const r = (await this.state()).result || null;
    const all = (r?.folders || []).flatMap(f => (Array.isArray(f.roots) ? f.roots : []).map(x => x.path));
    if (!all.length) return r;
    const seen = await plan.probeAll(this.host, all).catch(() => null);
    if (!Array.isArray(seen) || seen.length !== all.length) return r;
    let i = 0;
    return { ...r, folders: r.folders.map(f => ({ ...f, roots: (Array.isArray(f.roots) ? f.roots : []).map(x => ({ ...x, exists: seen[i++]?.kind === 'dir' })) })) };
  }
  /** The places the last move's result names (화면 세션 E6 · E10): its side folder, the new folders and every root —
   *  `keep`: only those a backup may take (no 「따로 둔 것」). */
  async places({ keep = false } = {}) {
    const r = (await this.state()).result;
    if (!r || typeof r !== 'object') return [];
    const list = keep
      ? (r.folders || []).flatMap(f => (Array.isArray(f.roots) ? f.roots : []).filter(x => x.kind !== 'side').map(x => x.path))
      : [r.side, ...(r.folders || []).flatMap(f => [f.newFolder, ...(Array.isArray(f.roots) ? f.roots : []).map(x => x.path)])];
    const seen = new Set();
    return list.filter(p => typeof p === 'string' && plan.safePath(p) && !seen.has(p.toLowerCase()) && seen.add(p.toLowerCase()));
  }
  /** 「옮겨 오기」의 지금 (화면 세션 E1): a move stopped part-way — the PC off, the app ended — leaves no job, no result and
   *  no failure, so the screen reads it here (`unfinished`: started, no result yet). Whether one runs now is the window's. */
  async status() {
    const st = await this.state();
    const when = v => (typeof v === 'string' && Number.isFinite(Date.parse(v)) ? v : null);
    const result = st.result && typeof st.result === 'object' ? st.result : null;
    return { from: typeof st.from === 'string' ? st.from : null, choices: st.choices && typeof st.choices === 'object' && !Array.isArray(st.choices) ? st.choices : {},
      startedAt: when(st.startedAt), unfinished: !!when(st.startedAt) && unfinishedOf({ startedAt: st.startedAt, result }), released: when(st.released), resultAt: when(result?.at), complete: result ? result.complete === true : null };
  }
  /** Where the last move put an old path (for Obsidian's vaults): the folder plan that holds it, in the mode it used. */
  async mapper() {
    const st = await this.state(); const ctx = await this.context(st.from);
    const folders = st.result?.folders || [];
    return p => {
      const f = folders.find(x => plan.within(p, x.original)); if (!f) return null;
      const r = plan.rel(p, f.original).replace(/\\/g, '/');
      const out = plan.destination({ original: f.original, newFolder: f.newFolder, mode: f.mode }, r, { old: ctx.old, now: ctx.now, mode: f.mode === 'oneDriveGaps' ? 'newFolder' : f.mode, sameDrive: f.sameDrive === true });
      return out.skip ? null : out.path;
    };
  }
  /** 「다시 깔 것」: the three lists (4.6b) with what is already on this PC and whether winget is ready. */
  async reinstallList() {
    const st = await this.state(); const ctx = await this.context(st.from);
    const status = await this.host('reinstall.status', []).catch(() => ({ ready: false, reason: 'WINGET_MISSING' }));
    const here = status.ready ? await this.host('reinstall.installed', []).catch(() => []) : [];
    const list = apps.reinstallList(ctx.kit, here);
    // Names for what is outside the table: the first 50, within 60 seconds in all (카본 끝판 E6); every item has the
    // same fields, a name only where winget gave one.
    // The time left goes to each call as its own limit, so the last one also ends by then (GPT 2차 -g GB2).
    const until = Date.now() + 60000;
    for (const [i, p] of list.others.entries()) {
      const left = until - Date.now();
      const s = status.ready && i < 50 && left >= 1000 ? await this.host('reinstall.show', [p.id, left]).catch(() => null) : null;
      Object.assign(p, s?.found ? { name: s.title, publisher: s.publisher, license: s.license } : { name: null, publisher: null, license: null });
    }
    return { wingetStatus: status, ...list };
  }
  /**
   * Installs what the person chose: the table's machine-scope ones in one elevation, then user-scope and outside-the-table
   * ones one by one at normal privilege; each checked afterwards with `winget list --id <id> -e`.
   */
  async reinstall({ ids = [], onProgress = () => {} }) {
    const chosen = [...new Set(ids.filter(apps.validId))];
    const table = new Map(apps.TABLE.programs.map(p => [p.id, p]));
    const machine = chosen.filter(id => table.get(id)?.scope === 'machine'), rest = chosen.filter(id => !machine.includes(id));
    const results = [];
    if (machine.length) {
      onProgress({ stage: 'elevated', ids: machine });
      const run = await this.host('reinstall.elevate', [machine]).catch(e => ({ started: false, reason: e.message || 'FAILED' }));
      const seen = new Map((run.progress?.programs || []).map(p => [p.id, p]));
      // 「아니요」 is declined — on the approval, or in the elevated side's own question (exit 3); a start or a run that
      // failed is failed, with its reason (카본 끝판 E5).
      const declined = (!run.started && run.reason === 'DECLINED') || (run.started && run.exitCode === 3);
      // Waited past the limit, or the confirmation stayed open too long (exit 5): what did not end is 「timeout」.
      // Exit 4: winget is not there for the administrator account that approved (카본 끝판 H3 · H5).
      const late = run.started && (run.timedOut || run.exitCode === 5);
      const DONE = ['installed', 'already', 'reboot', 'failed', 'timeout'];
      for (const id of machine) {
        const got = seen.get(id)?.state, own = seen.get(id)?.exitCode;
        const state = declined ? 'declined' : !run.started ? 'failed' : DONE.includes(got) ? got : late ? 'timeout' : 'failed';
        // A program that failed before the whole run went past its limit has its own winget exit code, and the run then
        // has none (마지막 끝판 카본 B2): never 「EXIT_null」.
        const code = state !== 'failed' ? null : !run.started ? run.reason || 'FAILED' : run.exitCode === 4 ? 'WINGET_ADMIN_MISSING'
          : Number.isInteger(own) ? `EXIT_${own}` : Number.isInteger(run.exitCode) ? `EXIT_${run.exitCode}` : 'FAILED';
        results.push({ id, name: table.get(id).name, state, scope: 'machine', ...(code ? { code } : {}) });
      }
    }
    for (const id of rest) {
      onProgress({ stage: 'user', id });
      const r = await this.host('reinstall.user', [id]).catch(e => ({ state: 'failed', code: e.message || 'FAILED' }));
      results.push({ id, name: table.get(id)?.name || null, state: r.state, scope: table.get(id)?.scope || 'outside', ...(r.code ? { code: r.code } : Number.isInteger(r.exitCode) && r.state === 'failed' ? { code: `EXIT_${r.exitCode}` } : {}) });
    }
    for (const r of results) if (['installed', 'already', 'reboot', 'failed', 'timeout'].includes(r.state)) r.listed = await this.host('reinstall.listed', [r.id]).catch(() => null);
    await this.save({ reinstall: { at: new Date().toISOString(), results } });
    return results;
  }
  /** Puts the app settings back for the apps now installed (4.6b). */
  async restoreSettings() {
    const st = await this.state(); const ctx = await this.context(st.from);
    const here = await this.host('reinstall.installed', []).catch(() => []);
    const results = await restoreSettings({ kit: ctx.kit, host: this.host, now: ctx.now, installed: new Set(here), moveId: st.moveId || newId(), mapPath: await this.mapper() });
    await this.save({ settings: { at: new Date().toISOString(), results } });
    return results;
  }
  /** 「다시 로그인할 곳」 with what the person ticked. */
  async checklist() {
    const st = await this.state(); const ctx = await this.context(st.from);
    const done = new Set(st.checked || []);
    return apps.checklist(ctx.kit).map(item => ({ ...item, done: done.has(item.id) }));
  }
  async check({ id, done }) {
    if (typeof id !== 'string' || id.length > 128 || typeof done !== 'boolean') throw new Error('MOVE_REQUEST');
    const next = await this.update(st => { const set = new Set(st.checked || []); if (done) set.add(id); else set.delete(id); return { checked: [...set] }; });
    return next.checked;
  }
  /** The person said no to 「옛 PC 연결 끊기」, or gave up: the old device's backup is no longer held for the move. When
   *  the server could not be told, nothing is marked: the screen says so and the person tries again (카본 끝판 E7). */
  async release() { if (this.server) await this.server.unpinMove(); return this.save({ released: new Date().toISOString() }); }
}
module.exports = { MoveService, placed, startState, moveCode, unfinishedOf };
