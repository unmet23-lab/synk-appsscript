'use strict';
// 솔리오 「사무실」의 계정마다의 파일(구현설계.md 5절 · 6절 · 12.1): userData/Office/<계정 번호>/office.json 하나에
// 보기 방식, 수용 인원을 직접 정한 값, 부서 목록, 「보낼 부서」의 기억, 손님이 더한 Claude 설정 폴더를 둔다. 계정과 PC의 짝마다 하나다.
//  · desktop-preferences.json에는 아무것도 넣지 않는다(12.1, 검토 1차 7). 이 모듈은 userData/Office/ 밖의 파일을 읽거나 쓰지 않는다.
//    밖을 보는 것은 손님이 고른 부서 폴더와 설정 폴더가 있는 폴더인지 stat하는 것뿐이다.
//  · 모르는 칸은 지우지 않고 그대로 쓴다(다음 판이 칸을 더해도 옛 판이 지우지 않는다). 부서 하나의 모르는 칸도 그대로 둔다.
//  · 깨진 파일은 기본값으로 읽고, 처음으로 무엇을 저장할 때까지 덮지 않는다. 덮기 전에 깨진 내용을 office.json.bad에 한 벌 둔다.
//  · 쓰기는 같은 폴더의 임시 파일에 쓰고 이름을 바꿔 넣는다. 같은 계정의 고치기는 차례로 한다.
//  · 고치는 함수는 모두 { ok:true, data } 또는 { ok:false, code }를 돌려준다. code: ACCOUNT, VALUE, NAME, NAME_TAKEN, FOLDER, LIMIT, NOT_FOUND, READ, WRITE.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { ID } = require('./site-visits.cjs');

const FILE = 'office.json';
const VIEWS = Object.freeze(['tilted', 'top']);
const TOOLS = Object.freeze(['claude', 'codex']);
const NAME_MAX = 20;
const ROLE_MAX = 1000;
const PATH_MAX = 1024;
const MAX_DEPARTMENTS = 24;
const MAX_ROOTS = 8;
const MAX_ASSIGNMENTS = 500;
const MAX_BYTES = 1024 * 1024;
const DEPARTMENT_ID = /^[A-Za-z0-9_-]{4,32}$/;
const SESSION_ID = /^(?!\d+$)[A-Za-z0-9_-]{8,128}$/; // 숫자만인 열쇠는 객체에서 차례가 바뀌므로 받지 않는다
const ABSOLUTE = /^(?:[A-Za-z]:[\\/]|\\\\[^\\/]|\/)/;
const CONTROL = /[\u0000-\u001f\u007f]/;
const SUBSCRIPTION_ACCOUNTS = /[\\/]aisubscriptions[\\/]accounts([\\/]|$)/i; // 구독 방의 계정 폴더는 보는 폴더가 아니다(3.4의 5)

const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const own = (o, k) => isObject(o) && Object.prototype.hasOwnProperty.call(o, k);
const defaults = () => ({ view: 'tilted', manualCap: null, departments: [], assignments: {}, roots: { claude: [] } });
/* 폴더 글자: 절대 경로이고 보이지 않는 글자가 없어야 한다. 끝 빗금은 뗀다(드라이브 뿌리와 / 는 둔다) */
function cleanFolder(value) {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (!s || s.length > PATH_MAX || CONTROL.test(s) || !ABSOLUTE.test(s)) return null;
  const cut = s.replace(/[\\/]+$/, '');
  return !cut || /^[A-Za-z]:$/.test(cut) ? s.slice(0, cut.length + 1) || '/' : cut;
}
const folderKey = f => f.replace(/[\\/]+/g, '\\').toLowerCase();
const cleanName = v => (typeof v === 'string' ? v.normalize('NFC').trim() : '');
const nameKey = v => cleanName(v).toLowerCase();
const goodName = n => n.length > 0 && [...n].length <= NAME_MAX && !CONTROL.test(n);

/* 파일의 값을 받을 수 있는 꼴로 고른다. 부서의 모르는 칸은 남긴다 */
function normalise(raw, cores) {
  const data = defaults();
  if (!isObject(raw)) return data;
  if (VIEWS.includes(raw.view)) data.view = raw.view;
  if (Number.isInteger(raw.manualCap) && raw.manualCap >= 1 && raw.manualCap <= cores) data.manualCap = raw.manualCap;
  const ids = new Set(), names = new Set();
  for (const d of Array.isArray(raw.departments) ? raw.departments : []) {
    if (data.departments.length >= MAX_DEPARTMENTS) break;
    if (!isObject(d) || typeof d.id !== 'string' || !DEPARTMENT_ID.test(d.id) || ids.has(d.id)) continue;
    const name = cleanName(d.name), folder = cleanFolder(d.folder);
    if (!goodName(name) || names.has(nameKey(name)) || !folder) continue;
    const dept = { ...d, id: d.id, name, folder };
    if (!(typeof d.role === 'string' && d.role.length <= ROLE_MAX)) delete dept.role;
    if (!TOOLS.includes(d.tool)) delete dept.tool;
    ids.add(d.id); names.add(nameKey(name));
    data.departments.push(dept);
  }
  const pairs = Object.entries(isObject(raw.assignments) ? raw.assignments : {}).filter(([sid, did]) => SESSION_ID.test(sid) && ids.has(did));
  data.assignments = Object.fromEntries(pairs.slice(-MAX_ASSIGNMENTS));
  const roots = isObject(raw.roots) ? raw.roots : {};
  const seen = new Set();
  const claude = [];
  for (const r of Array.isArray(roots.claude) ? roots.claude : []) {
    const f = cleanFolder(r);
    if (!f || SUBSCRIPTION_ACCOUNTS.test(f) || seen.has(folderKey(f)) || claude.length >= MAX_ROOTS) continue;
    seen.add(folderKey(f)); claude.push(f);
  }
  data.roots = { ...roots, claude };
  return data;
}
/* 화면에 넘기는 꼴: 아는 칸만 */
function publicData(data) {
  return {
    view: data.view, manualCap: data.manualCap,
    departments: data.departments.map(d => ({ id: d.id, name: d.name, folder: d.folder, ...(d.role != null ? { role: d.role } : {}), ...(d.tool != null ? { tool: d.tool } : {}) })),
    assignments: { ...data.assignments },
    roots: { claude: [...data.roots.claude] },
  };
}

function createOfficeStore({ userData, fsImpl = fs, cores = () => (os.cpus() || []).length || 1, randomId = () => crypto.randomBytes(6).toString('base64url') } = {}) {
  const fsp = fsImpl.promises;
  const base = typeof userData === 'string' && userData ? path.join(userData, 'Office') : null;
  const queues = new Map();
  const coreCount = () => { const n = Number(typeof cores === 'function' ? cores() : cores); return Number.isInteger(n) && n >= 1 ? n : 1; };
  const goodAccount = id => typeof id === 'string' && ID.test(id) && !!base;
  const fileOf = id => path.join(base, id, FILE);

  /* 파일을 읽는다. 없으면 기본값, 깨졌으면 기본값과 broken, 읽지 못하면 error */
  async function load(accountId) {
    let text;
    try { text = await fsp.readFile(fileOf(accountId), 'utf8'); } catch (e) {
      return e && e.code === 'ENOENT' ? { raw: null, data: defaults(), broken: false } : { raw: null, data: defaults(), broken: false, error: true };
    }
    let raw = null;
    if (text.length <= MAX_BYTES) { try { raw = JSON.parse(text); } catch { raw = null; } }
    if (!isObject(raw)) return { raw: null, data: defaults(), broken: true };
    return { raw, data: normalise(raw, coreCount()), broken: false };
  }

  async function write(accountId, current, data) {
    const file = fileOf(accountId), dir = path.dirname(file);
    const out = { ...(current.raw || {}), view: data.view, manualCap: data.manualCap, departments: data.departments, assignments: data.assignments, roots: data.roots };
    const tmp = path.join(dir, `${FILE}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`);
    try {
      await fsp.mkdir(dir, { recursive: true });
      if (current.broken) { // 깨진 내용을 덮기 전에 한 벌. 그사이 파일이 없어졌으면 둘 것이 없다
        try { await fsp.copyFile(file, file + '.bad'); } catch (e) { if (!e || e.code !== 'ENOENT') throw e; }
      }
      await fsp.writeFile(tmp, JSON.stringify(out, null, 2) + '\n', 'utf8');
      await fsp.rename(tmp, file);
      return { ok: true };
    } catch {
      try { await fsp.unlink(tmp); } catch { /* 임시 파일이 없을 수 있다 */ }
      return { ok: false, code: 'WRITE' };
    }
  }

  /* 같은 계정의 고치기는 차례로: 읽고, 고치고, 쓴다 */
  function mutate(accountId, change) {
    if (!goodAccount(accountId)) return Promise.resolve({ ok: false, code: 'ACCOUNT' });
    const prev = queues.get(accountId) || Promise.resolve();
    const job = prev.then(async () => {
      const current = await load(accountId);
      if (current.error) return { ok: false, code: 'READ' };
      const data = structuredClone(current.data);
      const result = await change(data);
      if (!result.ok) return result;
      if (result.unchanged) return { ok: true, data: publicData(data), unchanged: true };
      const written = await write(accountId, current, data);
      return written.ok ? { ok: true, data: publicData(data) } : written;
    }).catch(() => ({ ok: false, code: 'WRITE' }));
    queues.set(accountId, job);
    job.finally(() => { if (queues.get(accountId) === job) queues.delete(accountId); });
    return job;
  }

  async function isDirectory(p) {
    try { return (await fsp.stat(p)).isDirectory(); } catch { return false; }
  }

  /** @returns { ok:true, data:{ view, manualCap, departments, assignments, roots:{claude} } } 깨지거나 없는 파일은 기본값이다 */
  async function read(accountId) {
    if (!goodAccount(accountId)) return { ok: false, code: 'ACCOUNT' };
    if (queues.has(accountId)) await queues.get(accountId); // 이 앱이 쓰는 중인 것을 기다린 뒤 읽는다
    return { ok: true, data: publicData((await load(accountId)).data) };
  }

  /** 부서 더하기(id 없음)와 고치기(id). input: { id?, name, folder, role?, tool? } — role · tool을 빼면 그대로, null이면 지운다 */
  async function saveDepartment(accountId, input) {
    if (!goodAccount(accountId)) return { ok: false, code: 'ACCOUNT' };
    if (!isObject(input)) return { ok: false, code: 'VALUE' };
    const name = cleanName(input.name);
    if (!goodName(name)) return { ok: false, code: 'NAME' };
    const folder = cleanFolder(input.folder);
    if (!folder) return { ok: false, code: 'FOLDER' };
    if (input.role !== undefined && input.role !== null && !(typeof input.role === 'string' && input.role.length <= ROLE_MAX)) return { ok: false, code: 'VALUE' };
    if (input.tool !== undefined && input.tool !== null && !TOOLS.includes(input.tool)) return { ok: false, code: 'VALUE' };
    const id = input.id ?? null;
    if (id !== null && typeof id !== 'string') return { ok: false, code: 'VALUE' };
    if (!(await isDirectory(folder))) return { ok: false, code: 'FOLDER' };
    return mutate(accountId, async data => {
      const at = id === null ? -1 : data.departments.findIndex(d => d.id === id);
      if (id !== null && at < 0) return { ok: false, code: 'NOT_FOUND' };
      if (id === null && data.departments.length >= MAX_DEPARTMENTS) return { ok: false, code: 'LIMIT' };
      if (data.departments.some(d => d.id !== id && nameKey(d.name) === nameKey(name))) return { ok: false, code: 'NAME_TAKEN' };
      const dept = at >= 0 ? { ...data.departments[at], name, folder } : { id: newId(data), name, folder };
      for (const key of ['role', 'tool']) {
        if (input[key] === null) delete dept[key];
        else if (input[key] !== undefined) dept[key] = input[key];
      }
      if (at >= 0) data.departments[at] = dept; else data.departments.push(dept);
      return { ok: true };
    });
  }
  function newId(data) {
    for (let i = 0; i < 8; i++) {
      const id = String(randomId());
      if (DEPARTMENT_ID.test(id) && !data.departments.some(d => d.id === id)) return id;
    }
    return crypto.randomBytes(9).toString('base64url');
  }

  /** 부서 빼기. 그 부서로 보낸 기억도 지운다(세션은 「부서 없는 일」로 간다) */
  function removeDepartment(accountId, id) {
    if (typeof id !== 'string') return Promise.resolve(goodAccount(accountId) ? { ok: false, code: 'VALUE' } : { ok: false, code: 'ACCOUNT' });
    return mutate(accountId, async data => {
      const at = data.departments.findIndex(d => d.id === id);
      if (at < 0) return { ok: false, code: 'NOT_FOUND' };
      data.departments.splice(at, 1);
      data.assignments = Object.fromEntries(Object.entries(data.assignments).filter(([, did]) => did !== id));
      return { ok: true };
    });
  }

  /** 「보낼 부서」: 세션 하나를 부서에. departmentId가 null이면 기억을 지운다. 기억은 500개까지이고 오래된 것부터 버린다 */
  function assign(accountId, sessionId, departmentId) {
    if (!goodAccount(accountId)) return Promise.resolve({ ok: false, code: 'ACCOUNT' });
    if (typeof sessionId !== 'string' || !SESSION_ID.test(sessionId)) return Promise.resolve({ ok: false, code: 'VALUE' });
    if (departmentId !== null && typeof departmentId !== 'string') return Promise.resolve({ ok: false, code: 'VALUE' });
    return mutate(accountId, async data => {
      if (departmentId === null) {
        if (!own(data.assignments, sessionId)) return { ok: true, unchanged: true };
        delete data.assignments[sessionId];
        return { ok: true };
      }
      if (!data.departments.some(d => d.id === departmentId)) return { ok: false, code: 'NOT_FOUND' };
      if (data.assignments[sessionId] === departmentId) return { ok: true, unchanged: true };
      delete data.assignments[sessionId];
      data.assignments[sessionId] = departmentId;
      data.assignments = Object.fromEntries(Object.entries(data.assignments).slice(-MAX_ASSIGNMENTS));
      return { ok: true };
    });
  }

  /** 끝난 세션들의 「보낼 부서」 기억을 지운다(5절). 지울 것이 없으면 쓰지 않는다 */
  function forgetSessions(accountId, sessionIds) {
    const ids = new Set((Array.isArray(sessionIds) ? sessionIds : []).filter(s => typeof s === 'string'));
    return mutate(accountId, async data => {
      const kept = Object.entries(data.assignments).filter(([sid]) => !ids.has(sid));
      if (kept.length === Object.keys(data.assignments).length) return { ok: true, unchanged: true };
      data.assignments = Object.fromEntries(kept);
      return { ok: true };
    });
  }

  /** 설정: { view?: 'tilted'|'top', manualCap?: 1~논리 코어 수의 정수 또는 null(자동) } */
  function saveSettings(accountId, input) {
    if (!goodAccount(accountId)) return Promise.resolve({ ok: false, code: 'ACCOUNT' });
    if (!isObject(input) || (!own(input, 'view') && !own(input, 'manualCap'))) return Promise.resolve({ ok: false, code: 'VALUE' });
    if (own(input, 'view') && !VIEWS.includes(input.view)) return Promise.resolve({ ok: false, code: 'VALUE' });
    const cap = input.manualCap;
    if (own(input, 'manualCap') && cap !== null && !(Number.isInteger(cap) && cap >= 1 && cap <= coreCount())) return Promise.resolve({ ok: false, code: 'VALUE' });
    return mutate(accountId, async data => {
      if (own(input, 'view')) data.view = input.view;
      if (own(input, 'manualCap')) data.manualCap = cap;
      return { ok: true };
    });
  }

  /** 손님이 더한 Claude 설정 폴더(3.4의 5). 있는 폴더만, 여덟까지, 큰 · 작은 글자를 가리지 않고 겹친 것은 하나로 */
  async function saveRoots(accountId, dirs) {
    if (!goodAccount(accountId)) return { ok: false, code: 'ACCOUNT' };
    const given = Array.isArray(dirs) ? dirs : Array.isArray(dirs?.claude) ? dirs.claude : null;
    if (!given) return { ok: false, code: 'VALUE' };
    const claude = [], seen = new Set();
    for (const d of given) {
      const f = cleanFolder(d);
      if (!f || SUBSCRIPTION_ACCOUNTS.test(f)) return { ok: false, code: 'FOLDER' };
      if (seen.has(folderKey(f))) continue;
      seen.add(folderKey(f)); claude.push(f);
    }
    if (claude.length > MAX_ROOTS) return { ok: false, code: 'LIMIT' };
    for (const f of claude) if (!(await isDirectory(f))) return { ok: false, code: 'FOLDER' };
    return mutate(accountId, async data => {
      data.roots = { ...data.roots, claude };
      return { ok: true };
    });
  }

  return { read, saveDepartment, removeDepartment, assign, forgetSessions, saveSettings, saveRoots, base, fileOf: id => (goodAccount(id) ? fileOf(id) : null) };
}

module.exports = { createOfficeStore, VIEWS, NAME_MAX, MAX_DEPARTMENTS, MAX_ROOTS, MAX_ASSIGNMENTS, SESSION_ID };
