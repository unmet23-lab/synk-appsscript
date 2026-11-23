'use strict';
// 솔리오 「사무실」의 계정마다의 파일(구현설계.md 5절 · 6절 · 12.1): userData/Office/<계정 번호>/office.json 하나에
// 보기 방식, 수용 인원을 직접 정한 값, 부서 목록, 「보낼 부서」의 기억, 손님이 더한 Claude 설정 폴더를 둔다. 계정과 PC의 짝마다 하나다.
//  · desktop-preferences.json에는 아무것도 넣지 않는다(12.1, 검토 1차 7). 이 모듈은 userData/Office/ 밖의 파일을 읽거나 쓰지 않는다.
//    밖을 보는 것은 손님이 고른 부서 폴더와 설정 폴더가 있는 폴더인지 stat하는 것뿐이다.
//  · 모르는 칸은 지우지 않고 그대로 쓴다(다음 판이 칸을 더해도 옛 판이 지우지 않는다). 부서 하나의 모르는 칸도 그대로 둔다.
//  · 깨진 파일은 기본값으로 읽고, 처음으로 무엇을 저장할 때까지 덮지 않는다. 덮기 전에 깨진 내용을 office.json.bad에 한 벌 둔다.
//  · 쓰기는 같은 폴더의 임시 파일에 쓰고 이름을 바꿔 넣는다. 같은 계정의 고치기는 한 줄 차례(mutate)로 한다.
//    읽고 고치고 쓰기와 새 폴더가 있는지 보는 일은 모두 그 차례 안에서 한다. 그래서 부른 차례대로 적히고 서로 덮지 않는다(GPT 검수 GA3).
//  · 폴더가 있는지는 새로 더하거나 바꾸는 폴더만 본다. 이미 저장된 폴더는 다시 보지 않는다. 옮겼거나 외장 드라이브를 뺀 폴더도
//    빼거나 이름을 고칠 수 있어야 하기 때문이다(GA4).
//  · 고치는 함수는 모두 { ok:true, data } 또는 { ok:false, code }를 돌려준다. code: ACCOUNT, VALUE, NAME, NAME_TAKEN, FOLDER, LIMIT, LOOK_LIMIT, NOT_FOUND, READ, SIZE, WRITE, AUTH_CHANGED.
//  · 고치는 함수는 끝 인자로 { guard }를 받는다. guard()가 참이 아니면 쓰기 바로 앞과 이름 바꾸기 바로 앞에서 멈추고 AUTH_CHANGED다. 부른 쪽이 로그인 묶음을
//    거기서 다시 본다(GPT 검수 GB1 · be3 GA4). 이름 바꾸기가 도는 동안의 로그아웃은 막지 못한다. 파일 자리가 계정 번호로 정해져 다른 계정의 파일에 쓰는 일은 없다.
//    그래서 AUTH_CHANGED는 「그 묶음에 답하지 않는다」는 뜻이고 「쓰지 않았다」는 약속이 아니다(구현설계 11.1).
//  · 구독 방의 계정 폴더는 보는 폴더가 아니다(3.4의 5). 판정은 isSubscriptionDir 하나다. 있는 폴더는 realpath로 풀고,
//    이 앱의 실제 자리(userData/AiSubscriptions/accounts)의 안쪽인지와 이름 무늬를 함께 본다(설계 검토 solio-office-hooks (마), GPT 검수 be3 GA10).
//    realpath는 본체를 붙잡지 않는 비동기로 하고, 판정할 때마다 새로 푼다(연결 폴더의 대상이 바뀔 수 있다, GPT 검수 be5 GA1). 같은 길은 한 번에 하나만 푼다.
//    2초 안에 풀리지 않으면 모르는 폴더로 보고 보지 않는다(구독 방 계정 폴더일 수 있다, GPT 검수 be4 GA10 · be6 GA4). 풀린 뒤의 판정에서 다시 본다.
//    계정 폴더 자리(userData/AiSubscriptions/accounts)가 풀리지 않을 때도 모르는 폴더다(be7 GA2 · GA4).
//    풀기가 「없음」(ENOENT · ENOTDIR) 말고 다른 오류(EACCES 등)로 끝나도 실제 위치를 모르는 것이라 모름이다(be8 GA2).
//    이 판정은 새로 더하는 폴더와 살필 폴더(office.cjs rootsFor)에만 쓴다. 저장된 목록은 판정으로 줄이지 않는다.
//    늦은 판정이 목록에서 빼면 다음 쓰기가 줄어든 목록을 저장한다(be7 GA1). 읽을 때는 이름 무늬만 본다.
//  · 읽기 상한(MAX_BYTES)을 넘는 파일은 쓰지 않는다(SIZE). 상한을 넘은 파일은 읽지 못한 것으로 보고 기본값으로 덮지 않는다(GB8).
//  · 꾸미기(솔리오_사무실스킨_20261123/PC앱_설계.md 4절): 스킨(skin)과 자리마다의 모습(looks: { 자리 열쇠: { hat?, name? } }). 화면에 넘길 때만 거르고,
//    파일에는 읽은 그대로 둔다. 쓸 때는 이번에 바꾼 열쇠 하나와 뺀 부서의 열쇠만 고친다. 다음 판이 모자나 스킨을 더한 뒤 이 판이 써도 지워지지 않는다(설계 검토 1).
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
const SKINS = Object.freeze(['black', 'walnut']);
const HATS = Object.freeze(['beanie', 'beret', 'gat', 'phones', 'sprout']);
const LOOK_NAME_MAX = 12;
const MAX_LOOKS = 200;
/* 자리 열쇠: 부서 직원은 d:<부서 번호>:<n>, 부서 없는 일은 lobby:<n>. n은 0이나 1~99이고 앞의 0을 받지 않는다(01과 1이 같은 자리가 되지 않게) */
const SEAT = /^(?:d:([A-Za-z0-9_-]{4,32})|lobby):(?:0|[1-9]\d?)$/;
/* 직원 이름에 받지 않는 글자: 제어 글자, 폭 없는 글자, 방향 바꿈 글자 */
const HIDDEN = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/;
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
const goodLookName = n => n.length > 0 && [...n].length <= LOOK_NAME_MAX && !HIDDEN.test(n);
/* 화면에 넘길 모습: 꼴이 맞고 있는 부서(또는 부서 없는 일)의 열쇠에, 아는 모자와 맞는 이름만 */
function viewLooks(raw, ids) {
  const out = {};
  for (const [seat, v] of Object.entries(isObject(raw) ? raw : {})) {
    if (Object.keys(out).length >= MAX_LOOKS) break;
    const m = SEAT.exec(seat);
    if (!m || (m[1] && !ids.has(m[1])) || !isObject(v)) continue;
    const look = {}, name = cleanName(v.name);
    if (HATS.includes(v.hat)) look.hat = v.hat;
    if (goodLookName(name)) look.name = name;
    if (look.hat || look.name) out[seat] = look;
  }
  return out;
}

/* 파일의 값을 받을 수 있는 꼴로 고른다. 부서의 모르는 칸은 남긴다 */
function normalise(raw, cores, isSub = f => SUBSCRIPTION_ACCOUNTS.test(path.resolve(f))) {
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
    if (!f || isSub(f) || seen.has(folderKey(f)) || claude.length >= MAX_ROOTS) continue;
    seen.add(folderKey(f)); claude.push(f);
  }
  data.roots = { ...roots, claude };
  // 꾸미기는 읽은 그대로 들고 다닌다. 거르는 것은 publicData다
  if (own(raw, 'skin')) data.skinRaw = raw.skin;
  if (isObject(raw.looks)) data.looksRaw = structuredClone(raw.looks);
  return data;
}
/** 구독 방 계정 폴더 판정을 만든다. 돌려주는 함수는 Promise<boolean>이다. userData가 없으면 이름 무늬만 본다.
    realpath는 fs.promises.realpath(본체의 차례를 막지 않는다)로 판정할 때마다 새로 푼다. 같은 길이 아직 풀리는 중이면 그것을 기다린다.
    timeoutMs 안에 풀리지 않으면 null(모름)이다. 그 길이 한 번 시간을 넘긴 뒤에는 풀릴 때까지 기다리지 않고 바로 null이다(멈춘 풀기에 기다림이 쌓이지 않게, be6 GA3).
    판정은 모르는 폴더를 구독 방 계정 폴더로 본다. 보지 않는 쪽이 안전하다(be6 GA4). 없는 폴더(ENOENT · ENOTDIR)는 글자 그대로의 길로 보고,
    그 밖의 풀기 오류는 모름이다(be8 GA2) */
function subscriptionCheck(userData, fsImpl = fs, { timeoutMs = 2000, setTimeout: after = setTimeout, clearTimeout: cancel = clearTimeout } = {}) {
  // realpath가 없는 fs(시험의 일부만 흉내 낸 fs)를 받으면 Node의 것을 쓴다. 없는 함수의 오류를 「모름」으로 치지 않게
  const fsp = typeof fsImpl.promises?.realpath === 'function' ? fsImpl.promises : fs.promises;
  const running = new Map();
  const real = p => {
    const plain = path.resolve(p), k = plain.toLowerCase();
    let job = running.get(k);
    if (!job) {
      // 없는 길은 글자 그대로의 길이다. 그 밖의 오류는 실제 위치를 모르므로 null(모름)이다(be8 GA2).
      // realpath가 「없음」이라 해도 stat으로 길이 있으면 실제 위치를 모르는 것이다(설계 검토 be8 고칠 것 3)
      // 그 stat도 「없음」(ENOENT · ENOTDIR)일 때만 없는 길이다. 다른 오류(EACCES 등)는 모름이다(GPT 검수 be9 GA2)
      const gone = () => Promise.resolve().then(() => (typeof fsp.stat === 'function' ? fsp.stat(p) : fs.promises.stat(p)))
        .then(() => null, e => (e && (e.code === 'ENOENT' || e.code === 'ENOTDIR') ? plain : null));
      job = Promise.resolve().then(() => fsp.realpath(p)).then(r => (typeof r === 'string' && r ? r : null), e => (e && (e.code === 'ENOENT' || e.code === 'ENOTDIR') ? gone() : null))
        .finally(() => { if (running.get(k) === job) running.delete(k); });
      job.late = false;
      running.set(k, job);
    }
    if (job.late) return Promise.resolve(null);
    return new Promise(resolve => {
      const timer = after(() => { job.late = true; resolve(null); }, timeoutMs);
      timer?.unref?.();
      job.then(r => { cancel(timer); resolve(r); });
    });
  };
  const key = p => path.resolve(p).replace(/[\\/]+$/, '').toLowerCase();
  const accounts = typeof userData === 'string' && userData ? path.join(userData, 'AiSubscriptions', 'accounts') : null;
  return async dir => {
    if (typeof dir !== 'string' || !dir) return true; // 판정할 수 없는 값은 모름이다(설계 검토 be9 고칠 것 4)
    const resolved = path.resolve(dir);
    if (SUBSCRIPTION_ACCOUNTS.test(resolved)) return true;
    const r = await real(dir);
    if (r === null || SUBSCRIPTION_ACCOUNTS.test(r)) return true;
    if (!accounts) return false;
    const solved = await real(accounts);
    if (solved === null) return true; // 계정 폴더 자리를 모르면 안쪽인지도 모른다(be7 GA2 · GA4)
    const k = key(r);
    return [accounts, solved].some(a => { const ak = key(a); return k === ak || k.startsWith(ak + path.sep); });
  };
}
/* 화면에 넘기는 꼴: 아는 칸만 */
function publicData(data) {
  return {
    view: data.view, manualCap: data.manualCap,
    skin: SKINS.includes(data.skinRaw) ? data.skinRaw : 'black',
    looks: viewLooks(data.looksRaw, new Set(data.departments.map(d => d.id))),
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
  const isSubscriptionDir = subscriptionCheck(userData, fsImpl);

  /* 파일을 읽는다. 없으면 기본값, 깨졌으면 기본값과 broken, 읽지 못하면 error */
  async function load(accountId) {
    let text;
    try { text = await fsp.readFile(fileOf(accountId), 'utf8'); } catch (e) {
      return e && e.code === 'ENOENT' ? { raw: null, data: defaults(), broken: false } : { raw: null, data: defaults(), broken: false, error: true };
    }
    if (text.length > MAX_BYTES) return { raw: null, data: defaults(), broken: false, error: true, code: 'SIZE' };
    let raw = null;
    try { raw = JSON.parse(text); } catch { raw = null; }
    if (!isObject(raw)) return { raw: null, data: defaults(), broken: true };
    // 저장된 설정 폴더는 이름 무늬로만 가린다. realpath 판정은 살필 때 한다(be7 GA1)
    return { raw, data: normalise(raw, coreCount()), broken: false };
  }

  async function write(accountId, current, data, guard) {
    const file = fileOf(accountId), dir = path.dirname(file);
    const out = { ...(current.raw || {}), view: data.view, manualCap: data.manualCap, departments: data.departments, assignments: data.assignments, roots: data.roots };
    if (own(data, 'skinRaw')) out.skin = data.skinRaw;
    if (data.looksRaw !== undefined) out.looks = data.looksRaw;
    const text = JSON.stringify(out, null, 2) + '\n';
    if (text.length > MAX_BYTES) return { ok: false, code: 'SIZE' }; // 다음 읽기가 받지 못할 파일은 쓰지 않는다
    const tmp = path.join(dir, `${FILE}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`);
    try {
      await fsp.mkdir(dir, { recursive: true });
      // 폴더를 만드는 사이에 로그인이 바뀌었으면 깨진 파일의 사본(.bad)도 쓰지 않는다(GPT 검수 be4 GA9)
      if (typeof guard === 'function' && guard() !== true) return { ok: false, code: 'AUTH_CHANGED' };
      if (current.broken) { // 깨진 내용을 덮기 전에 한 벌. 그사이 파일이 없어졌으면 둘 것이 없다
        try { await fsp.copyFile(file, file + '.bad'); } catch (e) { if (!e || e.code !== 'ENOENT') throw e; }
      }
      await fsp.writeFile(tmp, text, 'utf8');
      // 임시 파일을 쓰는 사이에 로그인이 바뀌었으면 바꿔 넣지 않는다(GPT 검수 be3 GA4). 이 확인과 이름 바꾸기 사이에는 기다림이 없다
      if (typeof guard === 'function' && guard() !== true) { await fsp.unlink(tmp).catch(() => {}); return { ok: false, code: 'AUTH_CHANGED' }; }
      await fsp.rename(tmp, file);
      return { ok: true };
    } catch {
      try { await fsp.unlink(tmp); } catch { /* 임시 파일이 없을 수 있다 */ }
      return { ok: false, code: 'WRITE' };
    }
  }

  /* 같은 계정의 고치기는 차례로: 읽고, 고치고, 쓴다. guard는 쓰기 바로 앞에서 부른다 */
  function mutate(accountId, change, guard) {
    if (!goodAccount(accountId)) return Promise.resolve({ ok: false, code: 'ACCOUNT' });
    const prev = queues.get(accountId) || Promise.resolve();
    const job = prev.then(async () => {
      const current = await load(accountId);
      if (current.error) return { ok: false, code: current.code || 'READ' };
      const data = structuredClone(current.data);
      const result = await change(data);
      if (!result.ok) return result;
      if (result.unchanged) return { ok: true, data: publicData(data), unchanged: true };
      if (typeof guard === 'function' && guard() !== true) return { ok: false, code: 'AUTH_CHANGED' };
      const written = await write(accountId, current, data, guard);
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

  /** 부서 더하기(id 없음)와 고치기(id). input: { id?, name?, folder?, role?, tool? } — role · tool을 빼면 그대로, null이면 지운다.
      name과 folder는 새 부서에는 꼭 있어야 한다. 번호가 있는 부서에서 빼면 차례 안에서 읽은 저장된 값 그대로다(이름만 · 폴더만 고칠 때, GA3).
      저장된 폴더는 지금 없어도 된다(GA4) */
  async function saveDepartment(accountId, input, { guard } = {}) {
    if (!goodAccount(accountId)) return { ok: false, code: 'ACCOUNT' };
    if (!isObject(input)) return { ok: false, code: 'VALUE' };
    const id = input.id ?? null;
    if (id !== null && typeof id !== 'string') return { ok: false, code: 'VALUE' };
    const keepName = input.name === undefined && id !== null;
    const name = keepName ? null : cleanName(input.name);
    if (!keepName && !goodName(name)) return { ok: false, code: 'NAME' };
    const keepFolder = input.folder === undefined && id !== null;
    if (keepName && keepFolder && input.role === undefined && input.tool === undefined) return { ok: false, code: 'VALUE' }; // 고칠 것이 없다
    const folder = keepFolder ? null : cleanFolder(input.folder);
    if (!keepFolder && !folder) return { ok: false, code: 'FOLDER' };
    if (input.role !== undefined && input.role !== null && !(typeof input.role === 'string' && input.role.length <= ROLE_MAX)) return { ok: false, code: 'VALUE' };
    if (input.tool !== undefined && input.tool !== null && !TOOLS.includes(input.tool)) return { ok: false, code: 'VALUE' };
    return mutate(accountId, async data => {
      const at = id === null ? -1 : data.departments.findIndex(d => d.id === id);
      if (id !== null && at < 0) return { ok: false, code: 'NOT_FOUND' };
      if (id === null && data.departments.length >= MAX_DEPARTMENTS) return { ok: false, code: 'LIMIT' };
      if (!keepName && data.departments.some(d => d.id !== id && nameKey(d.name) === nameKey(name))) return { ok: false, code: 'NAME_TAKEN' };
      const before = at >= 0 ? data.departments[at] : null;
      const nextName = keepName ? before.name : name;
      const nextFolder = keepFolder ? before.folder : folder;
      // 새로 고른 폴더만 있는지 본다. 저장된 폴더와 같으면 다시 보지 않는다
      if (!keepFolder && !(before && folderKey(before.folder) === folderKey(folder)) && !(await isDirectory(folder))) return { ok: false, code: 'FOLDER' };
      const dept = at >= 0 ? { ...before, name: nextName, folder: nextFolder } : { id: newId(data), name: nextName, folder: nextFolder };
      for (const key of ['role', 'tool']) {
        if (input[key] === null) delete dept[key];
        else if (input[key] !== undefined) dept[key] = input[key];
      }
      if (at >= 0) data.departments[at] = dept; else data.departments.push(dept);
      return { ok: true };
    }, guard);
  }
  function newId(data) {
    for (let i = 0; i < 8; i++) {
      const id = String(randomId());
      if (DEPARTMENT_ID.test(id) && !data.departments.some(d => d.id === id)) return id;
    }
    return crypto.randomBytes(9).toString('base64url');
  }

  /** 부서 빼기. 그 부서로 보낸 기억도 지운다(세션은 「부서 없는 일」로 간다) */
  function removeDepartment(accountId, id, { guard } = {}) {
    if (typeof id !== 'string') return Promise.resolve(goodAccount(accountId) ? { ok: false, code: 'VALUE' } : { ok: false, code: 'ACCOUNT' });
    return mutate(accountId, async data => {
      const at = data.departments.findIndex(d => d.id === id);
      if (at < 0) return { ok: false, code: 'NOT_FOUND' };
      data.departments.splice(at, 1);
      data.assignments = Object.fromEntries(Object.entries(data.assignments).filter(([, did]) => did !== id));
      if (data.looksRaw) for (const seat of Object.keys(data.looksRaw)) if (seat.startsWith('d:' + id + ':')) delete data.looksRaw[seat];
      return { ok: true };
    }, guard);
  }

  /** 「보낼 부서」: 세션 하나를 부서에. departmentId가 null이면 기억을 지운다. 기억은 500개까지이고 오래된 것부터 버린다 */
  function assign(accountId, sessionId, departmentId, { guard } = {}) {
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
    }, guard);
  }

  /** 끝난 세션들의 「보낼 부서」 기억을 지운다(5절). 지울 것이 없으면 쓰지 않는다 */
  function forgetSessions(accountId, sessionIds, { guard } = {}) {
    const ids = new Set((Array.isArray(sessionIds) ? sessionIds : []).filter(s => typeof s === 'string'));
    return mutate(accountId, async data => {
      const kept = Object.entries(data.assignments).filter(([sid]) => !ids.has(sid));
      if (kept.length === Object.keys(data.assignments).length) return { ok: true, unchanged: true };
      data.assignments = Object.fromEntries(kept);
      return { ok: true };
    }, guard);
  }

  /** 설정: { view?: 'tilted'|'top', manualCap?: 1~논리 코어 수의 정수 또는 null(자동) }, 또는 꾸미기 하나:
      { skin: 'black'|'walnut' } · { look: { seat, hat: 모자 또는 null(벗김) } } · { look: { seat, name: 12자까지, 빈 글자는 처음 이름 } }.
      꾸미기는 다른 칸과 섞어 받지 않는다. 같은 값이면 쓰지 않는다. 모자도 이름도 다른 칸도 없어진 열쇠는 지운다 */
  function saveSettings(accountId, input, { guard } = {}) {
    if (!goodAccount(accountId)) return Promise.resolve({ ok: false, code: 'ACCOUNT' });
    const given = ['view', 'manualCap', 'skin', 'look'].filter(k => own(input, k));
    if (!given.length) return Promise.resolve({ ok: false, code: 'VALUE' });
    if ((given.includes('skin') || given.includes('look')) && given.length !== 1) return Promise.resolve({ ok: false, code: 'VALUE' });
    if (own(input, 'skin')) {
      if (!SKINS.includes(input.skin)) return Promise.resolve({ ok: false, code: 'VALUE' });
      return mutate(accountId, async data => {
        if (data.skinRaw === input.skin) return { ok: true, unchanged: true };
        data.skinRaw = input.skin;
        return { ok: true };
      }, guard);
    }
    if (own(input, 'look')) return saveLook(accountId, input.look, guard);
    if (own(input, 'view') && !VIEWS.includes(input.view)) return Promise.resolve({ ok: false, code: 'VALUE' });
    const cap = input.manualCap;
    if (own(input, 'manualCap') && cap !== null && !(Number.isInteger(cap) && cap >= 1 && cap <= coreCount())) return Promise.resolve({ ok: false, code: 'VALUE' });
    return mutate(accountId, async data => {
      if (own(input, 'view')) data.view = input.view;
      if (own(input, 'manualCap')) data.manualCap = cap;
      return { ok: true };
    }, guard);
  }
  /* 자리 하나의 모자나 이름. 그 자리의 다른 칸(다음 판이 더한 칸 포함)은 그대로 둔다 */
  function saveLook(accountId, look, guard) {
    const bad = Promise.resolve({ ok: false, code: 'VALUE' });
    if (!isObject(look) || typeof look.seat !== 'string') return bad;
    const m = SEAT.exec(look.seat), fields = ['hat', 'name'].filter(k => own(look, k));
    if (!m || fields.length !== 1) return bad;
    const field = fields[0];
    let value;
    if (field === 'hat') {
      if (look.hat !== null && !HATS.includes(look.hat)) return bad;
      value = look.hat;
    } else {
      if (typeof look.name !== 'string') return bad;
      const name = cleanName(look.name);
      if (name && !goodLookName(name)) return bad;
      value = name || null;
    }
    return mutate(accountId, async data => {
      if (m[1] && !data.departments.some(d => d.id === m[1])) return { ok: false, code: 'NOT_FOUND' };
      const all = data.looksRaw || {};
      const cur = isObject(all[look.seat]) ? { ...all[look.seat] } : {};
      if (value === null ? !own(cur, field) : cur[field] === value) return { ok: true, unchanged: true };
      if (!own(all, look.seat) && Object.keys(all).length >= MAX_LOOKS) return { ok: false, code: 'LOOK_LIMIT' };
      if (value === null) delete cur[field]; else cur[field] = value;
      if (Object.keys(cur).length) all[look.seat] = cur; else delete all[look.seat];
      data.looksRaw = all;
      return { ok: true };
    }, guard);
  }

  /** 손님이 더한 Claude 설정 폴더(3.4의 5). 있는 폴더만, 여덟까지, 큰 · 작은 글자를 가리지 않고 겹친 것은 하나로 */
  async function saveRoots(accountId, dirs, { guard } = {}) {
    if (!goodAccount(accountId)) return { ok: false, code: 'ACCOUNT' };
    const given = Array.isArray(dirs) ? dirs : Array.isArray(dirs?.claude) ? dirs.claude : null;
    if (!given) return { ok: false, code: 'VALUE' };
    const claude = [], seen = new Set();
    for (const d of given) {
      const f = cleanFolder(d);
      if (!f) return { ok: false, code: 'FOLDER' };
      if (seen.has(folderKey(f))) continue;
      seen.add(folderKey(f)); claude.push(f);
    }
    if (claude.length > MAX_ROOTS) return { ok: false, code: 'LIMIT' };
    // 구독 방 계정 폴더 판정은 기다림이 있어 차례 안에서 한다. 부른 차례가 그대로 적히는 차례다(GA3, be4 GA10).
    // 판정과 있는지 보기는 새로 더하는 폴더만 한다. 저장된 폴더 하나가 늦어 저장 전체가 막히지 않는다(be7 GA1)
    return mutate(accountId, async data => {
      const known = new Set(data.roots.claude.map(folderKey));
      const fresh = claude.filter(f => !known.has(folderKey(f)));
      for (const f of fresh) if ((await isSubscriptionDir(f)) !== false) return { ok: false, code: 'FOLDER' }; // 거짓이 아니면 받지 않는다(설계 검토 be8 고칠 것 1)
      for (const f of fresh) if (!(await isDirectory(f))) return { ok: false, code: 'FOLDER' };
      data.roots = { ...data.roots, claude };
      return { ok: true };
    }, guard);
  }

  /** 보는 폴더 하나 더하기(GA3). 저장된 목록을 차례 안에서 읽어 끝에 붙인다. 있는지는 이 폴더만 본다. 이미 있으면 그대로 */
  function addRoot(accountId, dir, { guard } = {}) {
    if (!goodAccount(accountId)) return Promise.resolve({ ok: false, code: 'ACCOUNT' });
    const f = cleanFolder(dir);
    if (!f) return Promise.resolve({ ok: false, code: 'FOLDER' });
    return mutate(accountId, async data => {
      // 이미 있는 폴더는 판정하지 않고 그대로다. 판정으로 보지 않게 된 폴더를 다시 더해도 FOLDER가 아니다(설계 검토 be7 고칠 것 1)
      if (data.roots.claude.some(x => folderKey(x) === folderKey(f))) return { ok: true, unchanged: true };
      if ((await isSubscriptionDir(f)) !== false) return { ok: false, code: 'FOLDER' };
      if (data.roots.claude.length >= MAX_ROOTS) return { ok: false, code: 'LIMIT' };
      if (!(await isDirectory(f))) return { ok: false, code: 'FOLDER' };
      data.roots = { ...data.roots, claude: [...data.roots.claude, f] };
      return { ok: true };
    }, guard);
  }
  /** 보는 폴더 하나 빼기(GA3 · GA4). 손님이 더한 목록에 있을 때만(큰 · 작은 글자와 끝 빗금은 가리지 않는다). 폴더가 지금 없어도 뺀다 */
  function removeRoot(accountId, dir, { guard } = {}) {
    if (!goodAccount(accountId)) return Promise.resolve({ ok: false, code: 'ACCOUNT' });
    if (typeof dir !== 'string' || !dir.trim() || dir.length > PATH_MAX) return Promise.resolve({ ok: false, code: 'VALUE' });
    const key = folderKey(cleanFolder(dir) || dir.trim());
    return mutate(accountId, async data => {
      const kept = data.roots.claude.filter(x => folderKey(x) !== key);
      if (kept.length === data.roots.claude.length) return { ok: false, code: 'NOT_FOUND' };
      data.roots = { ...data.roots, claude: kept };
      return { ok: true };
    }, guard);
  }

  return { read, saveDepartment, removeDepartment, assign, forgetSessions, saveSettings, saveRoots, addRoot, removeRoot, isSubscriptionDir, base, fileOf: id => (goodAccount(id) ? fileOf(id) : null) };
}

module.exports = { createOfficeStore, subscriptionCheck, VIEWS, SKINS, HATS, LOOK_NAME_MAX, MAX_LOOKS, NAME_MAX, MAX_DEPARTMENTS, MAX_ROOTS, MAX_ASSIGNMENTS, MAX_BYTES, SESSION_ID, SUBSCRIPTION_ACCOUNTS };
