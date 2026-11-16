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
async function writeJson(file, value) { await fs.mkdir(path.dirname(file), { recursive: true }); const tmp = `${file}.${process.pid}.tmp`; await fs.writeFile(tmp, JSON.stringify(value, null, 2)); await fs.rename(tmp, file); }

class MoveService {
  constructor({ engine, host, stateDir, localDir, server = null }) {
    Object.assign(this, { engine, host, stateDir, localDir, server });
    this.file = path.join(stateDir, STATE); this.ledgerDir = path.join(localDir, 'migration');
  }
  async state() { return (await readJson(this.file)) || {}; }
  async save(patch) { const next = { ...(await this.state()), ...patch }; await writeJson(this.file, next); return next; }
  /** The old devices with backups in this repository (restic host names), newest first. */
  async devices() {
    const all = await this.engine.snapshots();
    const by = new Map();
    for (const s of all) if (s.tags?.includes('complete-structure-checked') && !by.has(s.hostname)) by.set(s.hostname, { from: s.hostname, lastBackupAt: s.time });
    return [...by.values()];
  }
  async context(from) {
    const loaded = await kits.loadKit(this.engine, from);
    const now = await this.host('folders.snapshot', []);
    // Without a kit the old places are unknown: the person picks; the plan then uses this PC's own layout for both.
    return { kit: loaded?.kit || null, problems: loaded?.problems || ['no-kit'], old: loaded?.kit?.snapshot || now, now };
  }
  /** 「자리 고르기」: each folder's default, choices, counts and the space per volume. Pins the old device's backup. */
  async preview({ from, choices = {} }) {
    const ctx = await this.context(from);
    const move = new Move({ engine: this.engine, host: this.host, from, old: ctx.old, now: ctx.now, choices, moveId: (await this.state()).moveId || newId(), ledgerDir: this.ledgerDir });
    const folders = await move.prepare();
    const view = await move.preview();
    const latest = folders.map(f => f.selector.split(':')[0]).find(Boolean);
    if (this.server && latest) await this.server.pinMove(latest).catch(() => {});
    const sameLooking = await this.sameLooking(move, folders);
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
    const before = await this.state();
    const moveId = before.moveId && before.from === from && !before.result ? before.moveId : newId();
    await this.save({ moveId, from, choices, startedAt: new Date().toISOString(), result: null });
    const ctx = await this.context(from);
    const move = new Move({ engine: this.engine, host: this.host, from, old: ctx.old, now: ctx.now, choices, moveId, ledgerDir: this.ledgerDir,
      onProgress: p => onProgress({ percent: p.total ? Math.min(99, Math.floor(p.bytes / p.total * 100)) : null, bytes: p.bytes, total: p.total }) });
    const result = await move.run();
    const folders = (move.folders || []).map(f => ({ original: f.original, mode: choices[f.original]?.mode || f.fp.mode, destination: f.fp.destination, newFolder: f.fp.newFolder, label: f.fp.label }));
    const saved = { at: new Date().toISOString(), counts: result.counts, complete: result.complete, removedTemp: result.removedTemp, items: result.items.slice(0, 2000), folders, side: plan.places(ctx.now).side };
    await this.save({ result: saved });
    return saved;
  }
  async result() { return (await this.state()).result || null; }
  /** Where the last move put an old path (for Obsidian's vaults): the folder plan that holds it, in the mode it used. */
  async mapper() {
    const st = await this.state(); const ctx = await this.context(st.from);
    const folders = st.result?.folders || [];
    return p => {
      const f = folders.find(x => plan.within(p, x.original)); if (!f) return null;
      const r = plan.rel(p, f.original).replace(/\\/g, '/');
      const out = plan.destination({ original: f.original, newFolder: f.newFolder, mode: f.mode }, r, { old: ctx.old, now: ctx.now, mode: f.mode === 'oneDriveGaps' ? 'newFolder' : f.mode });
      return out.skip ? null : out.path;
    };
  }
  /** 「다시 깔 것」: the three lists (4.6b) with what is already on this PC and whether winget is ready. */
  async reinstallList() {
    const st = await this.state(); const ctx = await this.context(st.from);
    const status = await this.host('reinstall.status', []).catch(() => ({ ready: false, reason: 'WINGET_MISSING' }));
    const here = status.ready ? await this.host('reinstall.installed', []).catch(() => []) : [];
    const list = apps.reinstallList(ctx.kit, here);
    for (const p of list.others.slice(0, 50)) { const s = status.ready ? await this.host('reinstall.show', [p.id]).catch(() => null) : null; Object.assign(p, s?.found ? { name: s.title, publisher: s.publisher, license: s.license } : { name: null }); }
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
      const run = await this.host('reinstall.elevate', [machine]).catch(e => ({ started: false, reason: e.message }));
      const states = new Map((run.progress?.programs || []).map(p => [p.id, p.state]));
      for (const id of machine) results.push({ id, name: table.get(id).name, state: run.started ? (states.get(id) || 'failed') : 'declined', scope: 'machine' });
    }
    for (const id of rest) {
      onProgress({ stage: 'user', id });
      const r = await this.host('reinstall.user', [id]).catch(e => ({ state: 'failed', code: e.message }));
      results.push({ id, name: table.get(id)?.name || null, state: r.state, scope: table.get(id)?.scope || 'outside' });
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
    const st = await this.state(); const set = new Set(st.checked || []);
    if (done) set.add(id); else set.delete(id);
    await this.save({ checked: [...set] });
    return [...set];
  }
  /** The person said no to 「옛 PC 연결 끊기」, or gave up: the old device's backup is no longer held for the move. */
  async release() { if (this.server) await this.server.unpinMove().catch(() => {}); return this.save({ released: new Date().toISOString() }); }
}
module.exports = { MoveService };
