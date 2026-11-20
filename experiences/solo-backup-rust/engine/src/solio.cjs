'use strict';
// SYNK 솔리오와 엔진 사이의 파일 셋 (STAGE1_DESIGN.md 4.13). 꼴과 견본은 contract/solio/에 있다.
//
// - 상태 파일 `solio/status.json`: 엔진이 쓰고 솔리오가 읽는다. 이름 · 경로 · 계정 주소 · 출입증 · 저장소 주소가 없다.
//   같은 폴더의 임시 이름에 쓴 뒤 바꿔 넣고, 64KB를 넘지 않는다.
// - 요청 파일 `solio/requests/<시각>-<난수>.json`: 솔리오가 쓰고 엔진이 처리한다. 처리하는 쪽은 먼저 `claimed/`로 옮기고
//   옮기기에 성공한 쪽만 처리한다. 모르는 칸이 하나라도 있으면 통째로 버리고(거절), 8KB를 넘거나 연결점이면 읽지 않는다.
//   요청으로 되는 일은 되돌릴 수 있는 것뿐이다(처음 시작 이어 하기, 삭제를 줄이는 설정, 쉼을 지키는 지금 백업).
// - 결과 파일 `solio/results/<같은 이름>`: 낱말 하나(와 까닭 낱말)뿐이다. 하루가 지난 것은 엔진이 치운다.
// - 취소 표식 `solio/requests/<요청 이름>.cancel`: 솔리오가 요청을 거둘 때 만든다. 그 이름에 무엇이 있든 표식이고 내용은 읽지
//   않는다. 엔진은 차지한 뒤 처리하기 전에 보고, 있거나 확인하지 못하면 거절(cancelled)한다. 답을 쓴 뒤 지운다(0.7.0부터).
//
// 요청은 엔진 잠금을 쥔 쪽만 차지한다. 그래서 잠금을 쥔 쪽이 처음 보는 `claimed/`의 파일은 처리하던 쪽이 죽고 남긴
// 것이고, 다시 하지 않고 「실패」로 치운다(한 요청이 회차마다 엔진을 되풀이해 죽이지 못하게).
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { protection, schedule } = require('./protection.cjs');

const FORMAT = 1;
const STATUS_MAX = 65536;
const REQUEST_MAX = 8192;
const DAY = 86400000;
const SETUP_FOR = 30 * 60000;
/** 한 번에 처리하는 요청 수. 남은 것은 다음 차례에 한다. */
const PER_PASS = 20, PEEKS = 200;
/** `<시각>-<난수>.json`: 13자리 밀리초 시각과 소문자 · 숫자 8~32자. 이 꼴 밖의 이름은 읽지도 지우지도 않는다. */
const NAME = /^([0-9]{13})-([a-z0-9]{8,32})\.json$/;
// `starting`: 자동 백업을 켰고 아직 첫 백업이 없다(첫 백업이 도는 동안). 「주의」로 보이지 않게 따로 둔다.
const STATES = ['safe', 'starting', 'attention', 'paused', 'off', 'not-set-up', 'moved', 'restore-only'];
/** 주의 주제 낱말: 알림의 여덟 낱말(src-tauri/src/notify.rs TOPICS에서 `move`를 뺀 것)과 같은 목록, 같은 차례. */
const TOPICS = ['status', 'folders', 'changes', 'devices', 'restore', 'space', 'signin', 'update'];
/** 지금 도는 작업의 단계 낱말. 엔진 작업 종류를 이 목록으로 옮기고, 모르는 것은 `other`다. */
const STAGES = { backup: 'backup', protect: 'backup', fill: 'backup', check: 'check', probe: 'proof', restore: 'restore', move: 'move',
  setup: 'setup', import: 'setup', sources: 'setup', key: 'setup', credentials: 'setup', recovery: 'setup', 'recovery-key': 'setup' };
const KINDS = ['setup', 'pick', 'space-setting', 'run-now'];
const RESULTS = ['done', 'rejected', 'confirm-in-engine', 'rested', 'failed'];
/** 거절 · 실패의 까닭 낱말. 결과 파일에는 이 목록 밖의 낱말이 나가지 않는다. */
const REASONS = ['invalid', 'version', 'expired', 'set-up', 'moved', 'restore-only', 'not-set-up', 'no-report', 'old-report', 'not-available',
  'not-yet', 'no-drive', 'paused', 'clock', 'busy', 'interrupted', 'battery', 'saver', 'metered', 'network', 'error', 'cancelled'];
const SPACE_SETTINGS = ['start-line', 'auto-free', 'cloud-only-auto', 'empty-trash'];
const GB = 1024 ** 3;

// Windows에서 막 쓴 파일을 다른 프로그램(백신, 색인)이 잠깐 쥐면 바꿔 넣기가 EPERM · EBUSY로 실패한다. 잠깐씩 다시 한다.
async function replace(from, to) {
  for (let i = 0; ; i++) {
    try { return await fs.rename(from, to); }
    catch (e) { if (i >= 20 || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) throw e; await new Promise(r => setTimeout(r, 25 * (i + 1))); }
  }
}
const iso = v => { const t = typeof v === 'number' ? v : Date.parse(v); return Number.isFinite(t) && t > 0 ? new Date(t).toISOString() : null; };
const plain = v => !!v && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const only = (v, keys) => Object.keys(v).every(k => keys.includes(k));

/**
 * 상태 파일에 담을 것(꼴 1). `state`는 클라우드 프로필 엔진의 getState(), `ledger`는 notify.json(회차 실행기의 알림 장부),
 * `update`는 update.json, `startupRegistered`는 회차 작업이 다 있는지(모르면 null — 그때는 그것으로 주의를 띄우지 않는다).
 */
function statusOf({ state: s, version, ledger = null, update = null, startupRegistered = null, now = Date.now() }) {
  const configured = !!s?.configured;
  const moved = !!s?.movedTo;
  const restoreOnly = configured && (s.mode === 'restore' || !!s.readOnly);
  // 「지금 도는 작업」은 따로 두고, 보호 상태는 작업이 없을 때의 판단으로 적는다.
  const p = configured ? protection({ ...s, job: null }, { now, startupRegistered: startupRegistered !== false }) : null;
  const topics = new Set();
  const days = plain(ledger?.days) ? Object.keys(ledger.days) : [];
  if (configured && !moved && !restoreOnly) {
    if (s.credentialRequired) topics.add('signin');
    if (p && ['recovery', 'clock', 'probe', 'error', 'overdue', 'startup'].includes(p.reason)) topics.add('status');
    if (p?.reason === 'health' || p?.reason === 'mass') topics.add('changes');
    if ((Array.isArray(s.missingSources) && s.missingSources.length) || days.includes('missing')) topics.add('folders');
    if (days.includes('stale') || days.includes('partial')) topics.add('status');
  }
  if (configured && s.serverRestore) topics.add('restore');
  const available = typeof update?.available === 'string' && /^[0-9]+\.[0-9]+\.[0-9]+$/.test(update.available) ? update.available : null;
  if (available && newer(available, version)) topics.add('update');
  const word = !configured ? 'not-set-up' : moved ? 'moved' : restoreOnly ? 'restore-only'
    : p.level === 'paused' ? 'paused' : p.level === 'off' ? 'off'
    : p.reason === 'empty' && !topics.size ? 'starting'
    : p.level === 'attention' || p.level === 'partial' || topics.has('folders') || topics.has('changes') || topics.has('signin') ? 'attention' : 'safe';
  const job = s?.job ? { stage: STAGES[s.job.kind] || 'other', percent: Number.isFinite(s.job.percent) ? Math.max(0, Math.min(100, Math.round(s.job.percent * 10) / 10)) : null } : null;
  const probe = s?.lastProbe && iso(s.lastProbe.at) ? { at: iso(s.lastProbe.at), result: ['passed', 'failed', 'incomplete', 'skipped'].includes(s.lastProbe.result) ? s.lastProbe.result : 'failed' } : null;
  const writer = configured && !moved && !restoreOnly;
  return {
    v: FORMAT, engine: typeof version === 'string' && /^[0-9]+\.[0-9]+\.[0-9]+$/.test(version) ? version : null, state: word,
    lastBackupAt: configured ? iso(s.lastBackup?.at) : null, proof: configured ? probe : null,
    attention: TOPICS.filter(t => topics.has(t)), job,
    folders: configured && Array.isArray(s.sources) ? s.sources.length : 0,
    bytes: configured && Number.isSafeInteger(s.lastBackup?.bytes) && s.lastBackup.bytes >= 0 ? s.lastBackup.bytes : null,
    writer, nextRunAt: writer ? iso(s.nextBackupAt) : null, writtenAt: new Date(now).toISOString()
  };
}

/** `a`가 `b`보다 새 판인가. 세 칸을 숫자로 견주고, 둘 중 하나라도 x.y.z 꼴이 아니면 거짓이다(update.rs `newer`와 같은 뜻).
 *  지나간 판이 update.json에 남아 있어도 업데이트로 보지 않는다(11-20 저녁 설계 검토). */
function newer(a, b) {
  const triple = v => typeof v === 'string' && /^[0-9]{1,9}\.[0-9]{1,9}\.[0-9]{1,9}$/.test(v) ? v.split('.').map(Number) : null;
  const x = triple(a), y = triple(b);
  if (!x || !y) return false;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
}

/** 요청 하나를 계약대로 확인한다. `{ ok: true, value }` 또는 `{ ok: false, reason }`. `at`은 이름의 시각이다. */
function validate(value, { at, now = Date.now() }) {
  if (!plain(value) || !Number.isSafeInteger(value.v)) return { ok: false, reason: 'invalid' };
  if (value.v !== FORMAT) return { ok: false, reason: 'version' };
  if (!KINDS.includes(value.kind)) return { ok: false, reason: 'invalid' };
  // 시계가 5분 넘게 앞선 요청은 받지 않는다(만료를 피해 가지 못하게).
  if (!Number.isSafeInteger(at) || at > now + 5 * 60000) return { ok: false, reason: 'invalid' };
  const age = now - at;
  switch (value.kind) {
    case 'setup': {
      if (!only(value, ['v', 'kind', 'mode', 'hint']) || !['protect', 'move'].includes(value.mode)) return { ok: false, reason: 'invalid' };
      // 254자 이하이고 @가 하나인 주소 꼴만 받는다. 다르면 그 힌트만 버린다(4.13 「로그인」).
      const hint = typeof value.hint === 'string' && value.hint.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.hint) ? value.hint : null;
      if (value.hint !== undefined && typeof value.hint !== 'string') return { ok: false, reason: 'invalid' };
      if (age > SETUP_FOR) return { ok: false, reason: 'expired' };
      return { ok: true, value: { kind: 'setup', mode: value.mode, hint, at } };
    }
    case 'pick': {
      if (!only(value, ['v', 'kind', 'action', 'report', 'items']) || !['restore', 'free'].includes(value.action)
        || typeof value.report !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(value.report)
        || !Array.isArray(value.items) || !value.items.length || value.items.length > 100
        || !value.items.every(n => Number.isSafeInteger(n) && n >= 1 && n <= 1000) || new Set(value.items).size !== value.items.length) return { ok: false, reason: 'invalid' };
      if (age > DAY) return { ok: false, reason: 'expired' };
      return { ok: true, value: { kind: 'pick', action: value.action, report: value.report, items: [...value.items], at } };
    }
    case 'space-setting': {
      if (!SPACE_SETTINGS.includes(value.name)) return { ok: false, reason: 'invalid' };
      if (value.name === 'start-line') {
        if (!only(value, ['v', 'kind', 'name', 'drive', 'gb']) || typeof value.drive !== 'string' || !/^[A-Z]$/.test(value.drive)
          || !Number.isSafeInteger(value.gb) || value.gb < 1 || value.gb > 1000000) return { ok: false, reason: 'invalid' };
      } else if (!only(value, ['v', 'kind', 'name', 'value']) || typeof value.value !== 'boolean') return { ok: false, reason: 'invalid' };
      if (age > DAY) return { ok: false, reason: 'expired' };
      return { ok: true, value: { kind: 'space-setting', name: value.name, ...(value.name === 'start-line' ? { drive: value.drive, gb: value.gb } : { value: value.value }), at } };
    }
    case 'run-now':
      if (!only(value, ['v', 'kind'])) return { ok: false, reason: 'invalid' };
      if (age > DAY) return { ok: false, reason: 'expired' };
      return { ok: true, value: { kind: 'run-now', at } };
  }
  return { ok: false, reason: 'invalid' };
}

/** 결과 하나를 계약의 낱말로만 만든다. 모르는 낱말은 `failed` · `error`로 적는다(엔진의 글이 밖으로 나가지 않게). */
function resultOf(r, now) {
  const result = RESULTS.includes(r?.result) ? r.result : 'failed';
  const reason = ['rejected', 'failed', 'rested'].includes(result) ? (REASONS.includes(r?.reason) ? r.reason : 'error') : undefined;
  return { v: FORMAT, result, ...(reason ? { reason } : {}), at: new Date(now).toISOString() };
}

/** 엔진 상태 폴더 안 `solio` 폴더의 파일들. `root`는 확인을 마친 엔진 상태 폴더다. */
class SolioFiles {
  constructor({ root, now = () => Date.now() }) {
    this.root = path.resolve(root); this.now = now;
    this.dir = path.join(this.root, 'solio');
    this.requests = path.join(this.dir, 'requests');
    this.claimed = path.join(this.requests, 'claimed');
    this.results = path.join(this.dir, 'results');
    this.last = null; this.lastAt = 0;
    // 원래 이름이 남아 차지를 남겨 둔 요청 가운데 이 실행이 이미 「실패」로 답한 것(sweep이 답을 되풀이해 쓰지 않게).
    this.kept = new Set();
  }
  // 우리 폴더가 실제 폴더이고 연결점이 아니며, 실제로도 상태 폴더 안 그 자리인지. 정션으로 다른 곳을 가리키게 해 두면
  // 치우기가 남의 폴더에서 일하게 되므로, 하나라도 어긋나면 이번 차례는 아무것도 하지 않는다.
  async ready() {
    const real = await fs.realpath(this.root);
    for (const dir of [this.dir, this.requests, this.claimed, this.results]) {
      await fs.mkdir(dir, { recursive: true });
      const st = await fs.lstat(dir);
      if (st.isSymbolicLink() || !st.isDirectory()) throw Object.assign(new Error('SOLIO_FOLDER'), { code: 'SOLIO_FOLDER' });
      const want = path.join(real, path.relative(this.root, dir));
      if ((await fs.realpath(dir)).toLowerCase() !== want.toLowerCase()) throw Object.assign(new Error('SOLIO_FOLDER'), { code: 'SOLIO_FOLDER' });
    }
  }
  /** 이 쪽이 마지막으로 쓴 것과 견주어 지금 쓸 것이 있는지(쓴 시각과 백분율만 다르고 5초가 안 지났으면 없다). */
  changed(status) {
    const key = JSON.stringify({ ...status, writtenAt: null, job: status.job ? { stage: status.job.stage } : null });
    if (this.last === key && this.now() - this.lastAt < 5000) return false;
    return !(this.last === key && JSON.stringify(status.job) === this.lastJob);
  }
  /** 상태 파일이 이 쪽이 마지막으로 쓴 그 파일인지(그 뒤 다른 실행 파일이 썼거나 지워졌으면 거짓). */
  async ours() {
    if (!this.lastFile) return false;
    const st = await fs.stat(path.join(this.dir, 'status.json'), { bigint: true }).catch(() => null);
    return !!st && st.ino === this.lastFile.ino && st.mtimeNs === this.lastFile.mtimeNs && st.size === this.lastFile.size;
  }
  /**
   * 상태 파일을 바꿔 넣는다. 같은 내용이면(쓴 시각과 백분율만 다르고 5초가 안 지났으면) 쓰지 않는다. 다만 그 뒤 다른 실행 파일이
   * 파일을 바꿨으면(예: 회차가 진행을 적은 채 끊김) 같은 내용이라도 다시 쓴다(카본 끝판 CA1).
   */
  async writeStatus(status, { force = false } = {}) {
    const text = JSON.stringify(status);
    if (Buffer.byteLength(text) > STATUS_MAX) throw Object.assign(new Error('SOLIO_STATUS_SIZE'), { code: 'SOLIO_STATUS_SIZE' });
    const key = JSON.stringify({ ...status, writtenAt: null, job: status.job ? { stage: status.job.stage } : null });
    const now = this.now();
    if (!force && !this.changed(status) && await this.ours()) return false;
    await fs.mkdir(this.dir, { recursive: true });
    const st = await fs.lstat(this.dir);
    if (st.isSymbolicLink() || !st.isDirectory()) throw Object.assign(new Error('SOLIO_FOLDER'), { code: 'SOLIO_FOLDER' });
    const temp = path.join(this.dir, `status.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`);
    await fs.writeFile(temp, text, { flag: 'wx' });
    try { await replace(temp, path.join(this.dir, 'status.json')); } catch (e) { await fs.rm(temp, { force: true }); throw e; }
    this.last = key; this.lastAt = now; this.lastJob = JSON.stringify(status.job);
    const written = await fs.stat(path.join(this.dir, 'status.json'), { bigint: true }).catch(() => null);
    this.lastFile = written && { ino: written.ino, mtimeNs: written.mtimeNs, size: written.size };
    return true;
  }
  // 연결점을 따라가지 않고, 8KB 안의 보통 파일만 읽는다. 연 핸들의 파일이 이름으로 본 파일과 같은지 견준다.
  async readSmall(file) {
    let st;
    try { st = await fs.lstat(file); } catch { return null; }
    if (st.isSymbolicLink() || !st.isFile() || st.size > REQUEST_MAX) return { bad: true };
    let handle;
    try { handle = await fs.open(file, 'r'); } catch { return null; }
    try {
      const opened = await handle.stat();
      if (!opened.isFile() || opened.ino !== st.ino || opened.dev !== st.dev || opened.size > REQUEST_MAX) return { bad: true };
      const buf = Buffer.alloc(REQUEST_MAX + 1);
      const { bytesRead } = await handle.read(buf, 0, buf.length, 0);
      if (bytesRead > REQUEST_MAX) return { bad: true };
      try { return { value: JSON.parse(buf.subarray(0, bytesRead).toString('utf8').replace(/^\uFEFF/, '')) }; } catch { return { bad: true }; }
    } finally { await handle.close(); }
  }
  async names(dir) {
    let list = [];
    try { list = await fs.readdir(dir, { withFileTypes: true }); } catch { return []; }
    // 보통 파일만(정션과 링크는 Dirent에서 디렉터리로 보이지 않으므로 「디렉터리가 아님」으로 거르면 지나간다 — 카본 끝판 CA2).
    return list.filter(d => d.isFile() && !d.isSymbolicLink() && NAME.test(d.name)).map(d => d.name).sort();
  }
  /** 요청 `name`의 취소 표식 자리. */
  mark(name) { return path.join(this.requests, `${name}.cancel`); }
  /** 솔리오가 이 요청을 거뒀는지: 표식 자리에 무엇이든 있으면 참이다. 있는지 확인하지 못해도 참으로 본다(GPT r9 GA7 —
   *  로그인이 바뀐 뒤 앞 로그인의 주소가 넘어가지 않게). */
  async cancelled(name) {
    try { await fs.lstat(this.mark(name)); return true; } catch (e) { return e?.code !== 'ENOENT'; }
  }
  /** 표식을 지운다. 표식이 아닌 것(폴더)이거나 지우지 못해도 넘어간다 — 솔리오가 35분 뒤 지운다. */
  async unmark(name) { await fs.rm(this.mark(name), { force: true }).catch(() => {}); }
  /** 결과 하나를 쓰고 차지한 요청과 그 취소 표식을 지운다. */
  async answer(name, r) { await this.writeResult(name, r); await this.release(name); }
  /** 결과 하나를 쓴다. 이미 같은 이름의 결과가 있으면(앞서 쓴 뒤 죽음) 덮지 않는다. */
  async writeResult(name, r) {
    const file = path.join(this.results, name);
    const exists = await fs.lstat(file).then(() => true, () => false);
    if (!exists) {
      const temp = path.join(this.results, `${name}.${crypto.randomBytes(4).toString('hex')}.tmp`);
      await fs.writeFile(temp, JSON.stringify(resultOf(r, this.now())), { flag: 'wx' });
      try { await replace(temp, file); } catch (e) { await fs.rm(temp, { force: true }); throw e; }
    }
  }
  /** 차지한 요청과 그 취소 표식을 지운다. */
  async release(name) {
    await fs.rm(path.join(this.claimed, name), { force: true });
    await this.unmark(name);
  }
  /**
   * 차지하다 끊겨 `requests`에도 남은 같은 요청(차지한 파일과 같은 파일의 원래 이름)을 지운다. 돌려주는 것은 그 이름으로 다시
   * 차지될 요청이 남지 않았는지다. 지우지 못했거나(다른 프로그램이 쥠) 다른 파일이거나 확인하지 못하면 거짓이다 — 그때는 차지와
   * 표식을 남긴다(GPT 취소 표식 r1 GA1 · r2 GA1, Opus 대체 설계 검토 F1). 보통 파일이 아닌 것(폴더 · 링크)은 요청이 아니어서 엔진이
   * 읽지도 지우지도 않는다(r2 GA2) — 다시 차지될 일도 없으니 참이다.
   */
  async dropLeft(name) {
    const left = path.join(this.requests, name);
    let st; try { st = await fs.lstat(left, { bigint: true }); } catch (e) { return e?.code === 'ENOENT'; }
    if (st.isSymbolicLink() || !st.isFile()) return true;
    const mine = await fs.lstat(path.join(this.claimed, name), { bigint: true }).catch(() => null);
    if (!mine || mine.ino !== st.ino || mine.dev !== st.dev) return false;
    try { await fs.rm(left); return true; } catch { return false; }
  }
  /** 남은 차지와 하루 지난 결과를 치운다. 엔진 잠금을 쥔 쪽만 부른다. */
  async sweep() {
    const cleared = [];
    for (const name of await this.names(this.claimed)) {
      // 링크를 만든 뒤 원래 이름을 지우기 전에 끊겼으면 같은 요청이 requests에도 있다. 지우지 못해도 「실패」 답은 쓴다(GPT r2 GA1).
      // 그때는 차지와 표식을 남긴다. 같은 이름의 차지가 있으면 링크가 실패하므로, 답이 지워진 뒤에도 그 원래 이름은 다시
      // 차지되지 않는다(Opus 대체 설계 검토 F1). 원래 이름이 사라진 차례에 차지와 표식을 지운다.
      const gone = await this.dropLeft(name).catch(() => false);
      if (!this.kept.has(name)) await this.writeResult(name, { result: 'failed', reason: 'interrupted' });
      if (gone) { await this.release(name); this.kept.delete(name); } else this.kept.add(name);
      cleared.push(name);
    }
    const now = this.now();
    for (const name of await this.names(this.results)) {
      const file = path.join(this.results, name);
      try { const st = await fs.lstat(file); if (now - st.mtimeMs > DAY) await fs.rm(file, { force: true }); } catch { /* 솔리오가 먼저 지웠다 */ }
    }
    // 쓰다 죽은 임시 상태 파일과 임시 결과(이름 꼴이 우리 것인 것만).
    for (const name of (await fs.readdir(this.dir).catch(() => [])).filter(n => /^status\.[0-9]+\.[0-9a-f]{8}\.tmp$/.test(n))) {
      try { const st = await fs.lstat(path.join(this.dir, name)); if (st.isFile() && now - st.mtimeMs > 3600000) await fs.rm(path.join(this.dir, name), { force: true }); } catch { /* 이미 없다 */ }
    }
    for (const name of (await fs.readdir(this.results).catch(() => [])).filter(n => /^[0-9]{13}-[a-z0-9]{8,32}\.json\.[0-9a-f]{8}\.tmp$/.test(n))) {
      try { const st = await fs.lstat(path.join(this.results, name)); if (st.isFile() && now - st.mtimeMs > 3600000) await fs.rm(path.join(this.results, name), { force: true }); } catch { /* 이미 없다 */ }
    }
    return cleared;
  }
  /** 잠금을 쥐기 전에: 이 쪽이 맡을 요청이 하나라도 있는지 읽어만 본다(차지하지 않는다). */
  async pending(wants) {
    await this.ready();
    let peeks = 0;
    for (const name of await this.names(this.requests)) {
      if (peeks++ >= PEEKS) break;
      const peek = await this.readSmall(path.join(this.requests, name));
      if (peek === null) continue;
      if (wants(peek.bad ? { ok: false, reason: 'invalid' } : validate(peek.value, { at: Number(NAME.exec(name)[1]), now: this.now() }))) return true;
    }
    return false;
  }
  /**
   * 요청을 처리한다. `wants(request)`는 차지하기 전에 읽어 본 요청을 이 쪽이 맡을지(아니면 남겨 둔다), `handle(value)`는
   * 확인을 마친 요청을 처리해 `{ result, reason }`을 돌려준다. 돌려주는 것은 처리한 요청마다 종류와 결과(기록용)뿐이다.
   */
  async process({ wants, handle }) {
    await this.ready();
    const done = [];
    // 한 차례에 처리는 PER_PASS개, 읽어 보기는 PEEKS개까지. 다른 쪽이 맡는 요청이 앞자리를 채워도 뒤의 것을 본다.
    let peeks = 0;
    for (const name of await this.names(this.requests)) {
      if (done.length >= PER_PASS || peeks++ >= PEEKS) break;
      const at = Number(NAME.exec(name)[1]);
      const peek = await this.readSmall(path.join(this.requests, name));
      if (peek === null) continue; // 그사이 다른 쪽이 차지했다
      const checked = peek.bad ? { ok: false, reason: 'invalid' } : validate(peek.value, { at, now: this.now() });
      if (!wants(checked)) continue;
      const from = path.join(this.requests, name), to = path.join(this.claimed, name);
      // 이미 답한 요청(답을 쓴 뒤 요청을 지우기 전에 죽었다)은 다시 하지 않는다.
      if (await fs.lstat(path.join(this.results, name)).then(() => true, () => false)) { if (await fs.rm(from, { force: true }).then(() => true, () => false)) await this.unmark(name); continue; }
      // 덮지 않는 옮기기: 같은 이름이 claimed에 있으면 실패하는 하드 링크를 만든 쪽만 차지한다. Node의 이름 바꾸기(fs.rename)로
      // 두 쪽이 거의 함께 옮기면 Windows에서 둘 다 성공으로 끝날 수 있었다(11-17 이 PC에서 10번 중 7번 재현).
      try { await fs.link(from, to); } catch { continue; } // 다른 쪽이 먼저, 또는 이미 없다
      // 원래 이름을 지우지 못하면(다른 프로그램이 쥠) 이 요청은 처리하지 않고 다음 sweep에 맡긴다. 이번 차례의 다른 요청은 그대로
      // 한다(Opus 대체 설계 검토 F2).
      if (!await fs.rm(from, { force: true }).then(() => true, () => false)) continue;
      // 차지한 뒤 다시 읽어 확인한다(읽어 본 것과 옮긴 것이 다를 수 있다).
      const read = await this.readSmall(path.join(this.claimed, name));
      const value = !read || read.bad ? { ok: false, reason: 'invalid' } : validate(read.value, { at, now: this.now() });
      let r;
      // 취소 표식은 차지한 뒤, 처리하기 전에 본다. 옮기기 전에 본 것은 이것을 대신하지 못한다(그사이 솔리오가 거둘 수 있다).
      // 창에 hint를 넘기는 일도 처리다.
      if (await this.cancelled(name)) r = { result: 'rejected', reason: 'cancelled' };
      else if (!value.ok) r = { result: 'rejected', reason: value.reason };
      else { try { r = await handle(value.value); } catch { r = { result: 'failed', reason: 'error' }; } }
      await this.answer(name, r);
      done.push({ kind: value.ok ? value.value.kind : 'invalid', result: RESULTS.includes(r?.result) ? r.result : 'failed', ...(r?.reason && REASONS.includes(r.reason) ? { reason: r.reason } : {}) });
    }
    return done;
  }
}

/** 공간 설정(4.15 · SPACE_DESIGN.md 6장). 1판은 아무것도 비우지 않으므로 기본은 모두 꺼짐이고, 시작선은 예측에만 쓴다. */
const SPACE_FILE = 'space-settings.json';
async function readSpaceSettings(root) {
  try {
    const v = JSON.parse(await fs.readFile(path.join(root, SPACE_FILE), 'utf8'));
    const lines = plain(v?.startLines) ? Object.fromEntries(Object.entries(v.startLines).filter(([d, gb]) => /^[A-Z]$/.test(d) && Number.isSafeInteger(gb) && gb >= 1)) : {};
    return { v: FORMAT, startLines: lines, autoFree: v?.autoFree === true, cloudOnlyAuto: v?.cloudOnlyAuto === true, emptyTrash: v?.emptyTrash === true };
  } catch { return { v: FORMAT, startLines: {}, autoFree: false, cloudOnlyAuto: false, emptyTrash: false }; }
}
/** 기본 시작선: 드라이브 크기의 15%와 150GB 가운데 작은 쪽(SPACE_DESIGN.md 6장), GB 정수로. */
const defaultStartLine = sizeBytes => Math.max(1, Math.floor(Math.min(sizeBytes * 0.15, 150 * GB) / GB));
/**
 * `space-setting` 요청: 삭제 범위를 줄이는 쪽만 받는다(시작선 낮추기, 자동 비우기 · 나 등급 자동 · 휴지통 비우기 끄기).
 * 넓히거나 켜는 값은 엔진 창에서 확인한다. `driveSize(letter)`는 그 드라이브의 크기(바이트), 없으면 null.
 */
async function applySpaceSetting(root, req, { driveSize }) {
  const now = await readSpaceSettings(root);
  const next = { ...now, startLines: { ...now.startLines } };
  if (req.name === 'start-line') {
    const size = await driveSize(req.drive);
    if (!Number.isFinite(size) || size <= 0) return { result: 'rejected', reason: 'no-drive' };
    const current = now.startLines[req.drive] ?? defaultStartLine(size);
    if (req.gb > current) return { result: 'confirm-in-engine' };
    if (req.gb === current) return { result: 'done' };
    next.startLines[req.drive] = req.gb;
  } else {
    const key = { 'auto-free': 'autoFree', 'cloud-only-auto': 'cloudOnlyAuto', 'empty-trash': 'emptyTrash' }[req.name];
    if (req.value === true) return now[key] ? { result: 'done' } : { result: 'confirm-in-engine' };
    if (!now[key]) return { result: 'done' };
    next[key] = false;
  }
  const file = path.join(root, SPACE_FILE), temp = `${file}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  await fs.writeFile(temp, JSON.stringify(next), { flag: 'wx' });
  try { await replace(temp, file); } catch (e) { await fs.rm(temp, { force: true }); throw e; }
  return { result: 'done' };
}

/** 쉬는 회선(4.14): 손님이 고른 Wi-Fi 이름. 회차 실행기(Rust)가 같은 파일을 읽어 그 회선에서는 종량 회선과 같이 쉰다. */
const REST_FILE = 'rest-networks.json';
const REST_MAX = 20;
async function readRestNetworks(root) {
  try {
    const v = JSON.parse(await fs.readFile(path.join(root, REST_FILE), 'utf8'));
    return Array.isArray(v?.names) ? v.names.filter(okNetworkName).slice(0, REST_MAX) : [];
  } catch { return []; }
}
// Wi-Fi 이름(SSID)은 32바이트까지다. 제어 문자는 받지 않는다.
const okNetworkName = n => typeof n === 'string' && n.length >= 1 && Buffer.byteLength(n) <= 32 && !/[\u0000-\u001f\u007f]/.test(n);
async function writeRestNetworks(root, names) {
  if (!Array.isArray(names) || names.length > REST_MAX || !names.every(okNetworkName)) throw Object.assign(new Error('쉴 회선 이름을 확인해 주세요.'), { code: 'BAD_INPUT' });
  const unique = [...new Set(names)];
  const file = path.join(root, REST_FILE), temp = `${file}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  await fs.writeFile(temp, JSON.stringify({ v: FORMAT, names: unique }), { flag: 'wx' });
  try { await replace(temp, file); } catch (e) { await fs.rm(temp, { force: true }); throw e; }
  return unique;
}

/** 공간 보고서(4.15, Rust가 쓴다)의 번호와 만든 시각. 없거나 깨졌으면 null. */
async function spaceReportOf(root) {
  const v = await readJson(path.join(root, 'solio', 'space.json'), 1048576);
  return v && typeof v.report === 'string' && Number.isFinite(Date.parse(v.createdAt)) ? { report: v.report, createdAt: Date.parse(v.createdAt) } : null;
}
/**
 * `pick`: 엔진이 낸 보고서의 후보를 번호로 고른다(4.13). 보고서가 그 종류의 가장 새 것이 아니거나 24시간이 지났으면 거절한다.
 * 1판의 공간 보고서는 아무것도 비우지 않으므로 `free`는 모두 거절하고, 찾기 결과의 보고서는 1단계에 남기지 않으므로(찾기는
 * AI 도구에만 답한다 — 요청 도구와 함께 2단계) `restore`도 거절한다.
 */
async function pickAnswer(root, req, now) {
  if (req.action === 'restore') return { result: 'rejected', reason: 'no-report' };
  const report = await spaceReportOf(root);
  if (!report) return { result: 'rejected', reason: 'no-report' };
  if (report.report !== req.report || now - report.createdAt > DAY) return { result: 'rejected', reason: 'old-report' };
  return { result: 'rejected', reason: 'not-available' };
}
/**
 * 회차 실행기의 요청 처리(4.13 「읽는 때」). 엔진 잠금을 쥔 회차가 백업 뒤에 부른다. `setup`은 화면 앱의 몫이라 남겨 두고(30분이
 * 지난 것만 거절로 치운다), 나머지를 처리한다. `rest`는 이 회차의 쉼 판단(배터리 · 절전 · 종량 회선 · 쉬는 회선)으로, 「지금 백업」
 * 요청은 화면에서 누른 것과 달리 이것을 지킨다. `result`는 이 회차의 클라우드 프로필 결과다. 돌려주는 `forced`는 요청 때문에
 * 한 백업의 결과(없으면 null)다.
 */
async function runRequests({ files, engine, root, rest = null, result = null, driveSize, now = () => Date.now() }) {
  let forced = null, forcedAnswer = null;
  const runNow = async req => {
    // 같은 차례에 쌓인 「지금 백업」은 한 번만 돌린다. 이 차례의 목록은 백업을 시작하기 전에 읽었으므로, 이름의 시각과 상관없이
    // 앞서 돌린 백업의 답을 같이 쓴다(이름의 시각은 5분 앞설 수 있다 — 카본 끝판 CA3).
    if (forcedAnswer) return forcedAnswer;
    const c = engine?.config;
    if (!c?.repositoryId) return { result: 'rejected', reason: 'not-set-up' };
    if (c.movedTo) return { result: 'rejected', reason: 'moved' };
    if (c.mode !== 'backup' || c.readOnly) return { result: 'rejected', reason: 'restore-only' };
    if (rest) return { result: 'rested', reason: REASONS.includes(rest) ? rest : 'metered' };
    // 이 회차의 백업이 요청 뒤에 시작해 판을 남겼으면 그것으로 했다.
    if (['complete', 'partial'].includes(result?.outcome) && Number.isSafeInteger(result.resticStartedAt) && result.resticStartedAt >= req.at) return { result: 'done' };
    // 회차 간격만 건너뛴다. 손님이 잠시 멈춘 것과 시계 보류는 지킨다.
    const timing = schedule(c, engine.intervalMs, engine.now(), engine.lastAttempt);
    if (timing.paused) return { result: 'rejected', reason: 'paused' };
    if (timing.clockHold) return { result: 'failed', reason: 'clock' };
    const r = await engine.runOnce({ skipCloud: null, force: true });
    forced = r;
    forcedAnswer = ['complete', 'partial'].includes(r.outcome) ? { result: 'done' }
      : r.outcome === 'busy' ? { result: 'failed', reason: 'busy' }
      : r.outcome === 'skipped' ? { result: 'rejected', reason: { moved: 'moved', 'read-only': 'restore-only', 'not-configured': 'not-set-up', paused: 'paused' }[r.reason] || 'busy' }
      : { result: 'failed', reason: 'error' };
    return forcedAnswer;
  };
  await files.ready();
  await files.sweep();
  const done = await files.process({
    wants: c => !(c.ok && c.value.kind === 'setup'),
    handle: async req => req.kind === 'run-now' ? runNow(req) : req.kind === 'space-setting' ? applySpaceSetting(root, req, { driveSize }) : req.kind === 'pick' ? pickAnswer(root, req, now()) : { result: 'rejected', reason: 'invalid' }
  });
  return { done, forced };
}
/** 드라이브 하나의 크기(바이트). 없는 드라이브는 null. */
async function driveSize(letter) {
  try { const s = await fs.statfs(letter + ':\\'); const size = Number(s.bsize) * Number(s.blocks); return Number.isFinite(size) && size > 0 ? size : null; } catch { return null; }
}

/**
 * AI 도구(4.16): 엔진 창 설정 서랍 「AI 도구」가 도구마다 켜고 끄는 동의와 가리는 낱말(`mcp/consent.json`), 그리고 MCP
 * 연결이 알려 온 도구들(`mcp/clients.json`, WorkBackupRun.exe --mcp가 쓴다). 동의가 드는 도구는 공간 보고서와 백업 안
 * 찾기다(파일 이름과 폴더 이름이 AI 도구로 나간다). 상태 도구는 이름이 없어 동의가 들지 않는다.
 */
const AI_TOOLS = ['space_report', 'find_restorable'];
async function readAiTools(root) {
  const c = await readJson(path.join(root, 'mcp', 'consent.json'), 16384);
  const ok = c?.v === FORMAT;
  const clients = await readJson(path.join(root, 'mcp', 'clients.json'), 65536);
  const text = (v, n) => typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, n) : null;
  return {
    tools: Object.fromEntries(AI_TOOLS.map(t => [t, ok && c.tools?.[t] === true])),
    masks: ok && Array.isArray(c.masks) ? c.masks.filter(m => typeof m === 'string' && m.trim() && m.length <= 40).slice(0, 20) : [],
    clients: Array.isArray(clients?.clients) ? clients.clients.slice(0, 20).filter(x => text(x?.name, 64)).map(x => ({ name: text(x.name, 64), version: text(x.version, 64),
      exe: text(x.exe, 1024), firstSeen: iso(x.firstSeen), lastSeen: iso(x.lastSeen) })) : []
  };
}
async function writeAiTools(root, input) {
  const bad = () => Object.assign(new Error('AI 도구 설정을 확인해 주세요.'), { code: 'BAD_INPUT' });
  if (!plain(input) || !only(input, ['tools', 'masks']) || !plain(input.tools) || !only(input.tools, AI_TOOLS) || !Object.values(input.tools).every(v => typeof v === 'boolean')) throw bad();
  const masks = input.masks === undefined ? (await readAiTools(root)).masks : input.masks;
  if (!Array.isArray(masks) || masks.length > 20 || !masks.every(m => typeof m === 'string' && m.trim() && m.length <= 40 && !/[\u0000-\u001f\u007f]/.test(m))) throw bad();
  const now = await readAiTools(root);
  const dir = path.join(root, 'mcp');
  await fs.mkdir(dir, { recursive: true });
  const st = await fs.lstat(dir);
  if (st.isSymbolicLink() || !st.isDirectory()) throw bad();
  const file = path.join(dir, 'consent.json'), temp = `${file}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  await fs.writeFile(temp, JSON.stringify({ v: FORMAT, tools: { ...now.tools, ...input.tools }, masks: [...new Set(masks.map(m => m.trim()))], at: new Date().toISOString() }), { flag: 'wx' });
  try { await replace(temp, file); } catch (e) { await fs.rm(temp, { force: true }); throw e; }
  return readAiTools(root);
}

/** 엔진 상태 폴더의 작은 기록 파일(notify.json · update.json)을 읽는다. 없거나 크거나 깨졌으면 null. */
async function readJson(file, max = 65536) {
  try { const st = await fs.lstat(file); if (st.isSymbolicLink() || !st.isFile() || st.size > max) return null; return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return null; }
}

module.exports = { FORMAT, NAME, STATES, TOPICS, KINDS, RESULTS, REASONS, STATUS_MAX, REQUEST_MAX, SolioFiles, statusOf, validate, resultOf,
  readSpaceSettings, applySpaceSetting, defaultStartLine, readAiTools, writeAiTools, AI_TOOLS, runRequests, pickAnswer, spaceReportOf, driveSize, readRestNetworks, writeRestNetworks, okNetworkName, readJson, SPACE_FILE, REST_FILE };
