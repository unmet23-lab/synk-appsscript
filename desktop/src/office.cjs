'use strict';
// 솔리오 「사무실」(PC 클라이언트 첫 조각 「보기」, 2026-11-20)의 세션 모음과 볼 계정 확인. 설계: docs/디자인/솔리오_사무실_20261119/구현설계.md
// 3.4 · 4.4 · 11.1 · 12.1 · 13절. 훅 소식(5단계의 서버가 ingest로 넘긴다)과 기록 살피기(office-records)를 office-model의 officeReduce로 접어 메모리에만 가진다.
//  · 볼 계정: %LOCALAPPDATA%\synk\office\viewers.json의 { synk_user_ids:[…] }에 적힌 SYNK 계정만이다(D7, 첫 판은 유호님 계정만).
//    파일이 없거나 깨졌으면 아무도 못 보고, 물은 계정을 같은 폴더의 viewer-pending\<계정 번호>.json에 계정마다 파일 하나로 남긴다.
//    앱은 제 계정의 파일만 쓰므로 승인 도구가 지운 다른 계정의 줄을 되살리지 않는다(설계 검토 solio-office-hooks 고칠 것 8, GPT 검수 be3 GA9).
//  · 모든 공개 함수가 지금 계정을 받아 먼저 확인한다. 읽기는 { ok:true, available:false }, 고치기는 { ok:false, code:'NOT_ALLOWED' }다.
//    화면에서 방을 가리는 것만으로는 막지 않는다(11.1, 검토 1차 6). 볼 계정이 아닐 때 온 훅 소식은 읽지 않고 버린다.
//  · 계정이 바뀌면 세션 기억을 비우고 기록 살피기를 멈춘다. 부서와 「보낼 부서」는 계정마다의 office.json(office-store)에 있다.
//    main이 accountChanged로 알린 계정이 지금 계정이다. 볼 계정 파일을 읽는 사이 등 기다림 뒤에 계정이 바뀌었으면 옛 계정으로 기억을 다시 열지 않고
//    그 세대도 남기지 않는다. 답은 AUTH_CHANGED다(GPT 검수 GA1).
//  · office.json을 고치는 일(부서, 보낼 부서, 설정, 보는 폴더 더하기 · 빼기)은 모두 office-store의 계정마다 한 줄 차례 안에서 읽고 고치고 쓴다(GA3).
//    쓰기 바로 앞에서 로그인 묶음을 다시 본다(store의 guard). 훅 켜기도 손님 파일을 고치기 바로 앞에서 본다(GPT 검수 GB1 · GB2).
//  · 고치기 결과가 기억(storeCache)에 들어간 뒤에 끝난 옛 읽기는 기억을 덮지 않는다(GB3).
//  · 기록 살피기는 방이 열려 있는 동안만 15초마다 한다(3.4의 8). 바뀐 것이 있을 때만 onChange를 부른다(250ms 안의 바뀜은 한 번으로).
//  · 시간에 따라 바뀌는 글(「N분 전」)은 만들지 않는다. 화면이 제 시계로 officeSessions를 부른다.
//  · 훅 서버와 Claude Code 설정 파일 고치기는 office-hooks.cjs다(5단계). hooks를 넘기면 snapshot이 그 모습을 싣고, setHooks가 계정의 Claude 설정 폴더로 켜고 끈다.
//    서버가 받은 소식은 accepts(읽기 전에 볼 계정인지)와 ingest를 거친다. 계정이 바뀌어도 서버는 닫지 않는다(11.1). 넘기지 않으면 hooks는 { on:false }다.
//    ingest는 서버가 넘긴 받기 표를 접기 바로 앞에서 hooks.accepting으로 다시 본다. 끄기가 받기를 닫은 뒤에는 접지 않는다.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { ID } = require('./site-visits.cjs');
const { createOfficeRecords, defaultRoots } = require('./office-records.cjs');
const { createOfficeCapacity } = require('./office-capacity.cjs');
const { createOfficeStore, subscriptionCheck } = require('./office-store.cjs');

const OFFICE_TICKS = Object.freeze({
  tick: 15e3, // 방이 열려 있을 때 기록 살피기(3.4의 8)
  prune: 60e3, // 내린 세션 지우기
  pc: 30e3, // 프로세서 · 메모리 값을 다시 읽는 가장 짧은 간격
  change: 250, // onChange를 모아 부르는 시간
});
const VIEWERS_MAX_BYTES = 64 * 1024;
/* 훅 소식에서 받는 칸과 글자 수의 끝. 명령 전체 · 파일 내용 · 도구 결과는 5단계에서 이미 버리고, 여기서도 이 칸 말고는 받지 않는다(12.2) */
const HOOK_FIELDS = Object.freeze({ event: 40, sessionId: 128, cwd: 1024, toolName: 80, toolDetail: 120, notificationType: 40, agentId: 128, model: 80 });

const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const hasOwn = (o, k) => isObject(o) && Object.prototype.hasOwnProperty.call(o, k);
const accountIdOf = account => (isObject(account) && typeof account.synk_user_id === 'string' && ID.test(account.synk_user_id) ? account.synk_user_id : null);
/* 로그인 회차(main이 계정에 실어 넘기는 sessionGeneration). 없으면 null */
const roundOf = account => (isObject(account) && (typeof account.sessionGeneration === 'number' || typeof account.sessionGeneration === 'string') ? account.sessionGeneration : null);
const emptyData = () => ({ view: 'tilted', manualCap: null, departments: [], assignments: {}, roots: { claude: [] } });

function defaultViewersFile(env = process.env, platform = process.platform) {
  if (env.SYNK_OFFICE_VIEWERS) return env.SYNK_OFFICE_VIEWERS;
  if (platform !== 'win32' || !env.LOCALAPPDATA) return null;
  return path.join(env.LOCALAPPDATA, 'synk', 'office', 'viewers.json');
}

/* office-model.mjs는 ESM이다. 본체(CJS)는 한 번만 불러 createOffice에 넘긴다 */
const models = new Map();
function loadOfficeModel(file = path.join(__dirname, '..', 'renderer', 'office-model.mjs')) {
  const href = pathToFileURL(path.resolve(file)).href;
  if (!models.has(href)) models.set(href, import(href).catch(error => { models.delete(href); throw error; }));
  return models.get(href);
}

function pickHook(event, t) {
  if (!isObject(event) || event.kind !== 'hook') return null;
  const out = { kind: 'hook' };
  for (const [key, max] of Object.entries(HOOK_FIELDS)) {
    const v = event[key];
    if (typeof v !== 'string' || !v) continue;
    if (key === 'toolDetail') out[key] = v.slice(0, max);
    else if (v.length <= max) out[key] = v;
  }
  if (!out.event || !out.sessionId) return null;
  const at = Number(event.at);
  out.at = Number.isFinite(at) ? Math.min(at, t) : t; // 앞날의 때는 지금으로 친다
  return out;
}
/* 켜기 · 끄기의 답: 됐는지, 거절 까닭, 쓴 수 · 새로 만든 수 · 거절된 수만(폴더 경로는 판으로 다시 읽는다) */
const hookAnswer = r => {
  const n = x => (Number.isInteger(x) && x >= 0 ? x : 0);
  if (!isObject(r)) return { ok: false, code: 'WRITE' };
  return { ok: r.ok === true, ...(typeof r.code === 'string' ? { code: r.code } : {}), written: n(r.written), created: n(r.created), refused: n(r.refused) };
};
const pcNumbers = v => {
  const n = x => (typeof x === 'number' && Number.isFinite(x) ? x : null);
  return isObject(v) ? { cores: n(v.cores), totalMemGb: n(v.totalMemGb), freeMemGb: n(v.freeMemGb), cpuPercent: n(v.cpuPercent) } : null;
};

function createOffice({
  userData, viewersFile = defaultViewersFile(), model, records, capacity, store, fsImpl = fs, now = () => Date.now(),
  roots = () => defaultRoots(),
  setInterval: every = setInterval, clearInterval: stopEvery = clearInterval, setTimeout: after = setTimeout, clearTimeout: cancel = clearTimeout,
  onChange = () => {}, times = {}, hooks = null,
} = {}) {
  if (!model || typeof model.officeReduce !== 'function' || typeof model.officeState !== 'function' || typeof model.officePrune !== 'function') {
    throw new TypeError('createOffice needs office-model (loadOfficeModel)');
  }
  const T = { ...OFFICE_TICKS, ...times };
  const fsp = fsImpl.promises;
  const rec = records || createOfficeRecords({ fsImpl, now, times: { drop: model.OFFICE_TIMES?.drop ?? 30 * 60e3 } });
  const cap = capacity || createOfficeCapacity();
  const st = store || createOfficeStore({ userData, fsImpl });
  const isSubscriptionDir = typeof st.isSubscriptionDir === 'function' ? st.isSubscriptionDir : subscriptionCheck(userData, fsImpl);
  const pendingDir = viewersFile ? path.join(path.dirname(viewersFile), 'viewer-pending') : null;
  const pendingWritten = new Set();
  let pendingQueue = Promise.resolve();
  let viewersCache = null; // { mtimeMs, size, ids }
  let state = model.officeState();
  let owner = null; // state의 세션을 가진 계정 번호
  let generation = 0; // 계정이 바뀔 때마다 하나씩. 그 전에 시작한 살피기의 결과는 버린다
  /* 로그인 묶음(GPT 검수 r7 · r8 GA1, 구현설계 11.1 「계정 묶기」): 본체로 들어오는 길(화면 채널, 훅)은 들어온 순간의 계정과 로그인 회차
     (sessionGeneration)를 한 묶음으로 잡아 끝까지 들고 온다. 그 묶음이 main이 accountChanged로 알린 지금 묶음과 같을 때만 기억을 바꾸고 답한다.
     같은 계정의 토큰 갱신은 회차가 그대로라 같은 묶음이다. current: undefined는 아직 알리지 않음(견주지 않는다), null은 로그아웃 */
  let current;
  const isCurrent = account => {
    if (current === undefined) return true;
    if (current === null) return false;
    return accountIdOf(account) === current.id && roundOf(account) === current.round;
  };
  const CHANGED = Object.freeze({ ok: false, code: 'AUTH_CHANGED' });
  let watching = null; // { timer, accountId, account }
  let scanning = null;
  let pruneTimer = null, changeTimer = null;
  const pc = { value: null, at: null, inflight: null };
  let storeCache = null; // { accountId, data }
  let storeSeq = 0; // 고치기 결과로 storeCache를 바꿀 때마다 하나씩. 그 전에 시작한 읽기는 기억을 덮지 않는다(GB3)
  let watchSeq = 0; // watch를 부를 때마다 하나씩. 기다린 뒤에 더 늦게 부른 watch가 있으면 이 부름은 아무것도 바꾸지 않는다(GB10)
  const remember = (accountId, data) => { storeCache = { accountId, data }; storeSeq += 1; };

  /* ── 볼 계정 ── */
  async function viewers() {
    if (!viewersFile) return null;
    let s;
    try { s = await fsp.stat(viewersFile); } catch { viewersCache = null; return null; }
    if (viewersCache && viewersCache.mtimeMs === s.mtimeMs && viewersCache.size === s.size) return viewersCache.ids;
    let ids = null;
    try {
      if (s.isFile() && s.size <= VIEWERS_MAX_BYTES) {
        const v = JSON.parse(await fsp.readFile(viewersFile, 'utf8'));
        // 한 줄이라도 계정 번호가 아니면 파일 전체를 받지 않는다. 승인 도구(tools/사무실/보는계정.js)와 같은 판정이다(GPT 검수 GB7)
        const list = Array.isArray(v?.synk_user_ids) && v.synk_user_ids.every(id => typeof id === 'string' && ID.test(id)) ? v.synk_user_ids : [];
        ids = list.length ? list : null;
      }
    } catch { ids = null; }
    viewersCache = { mtimeMs: s.mtimeMs, size: s.size, ids };
    return ids;
  }
  /* 볼 계정이 아직 정해지지 않았을 때 물은 계정을 그 계정의 파일 하나로 남긴다(앱을 켠 동안 같은 계정은 한 번).
     다른 계정의 파일은 읽지도 쓰지도 않는다. 같은 폴더의 임시 파일에 써서 이름을 바꿔 넣는다 */
  function notePending(account, id) {
    if (!pendingDir || pendingWritten.has(id)) return pendingQueue;
    pendingWritten.add(id);
    pendingQueue = pendingQueue.then(async () => {
      const file = path.join(pendingDir, id + '.json');
      const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
      try {
        const body = { synk_user_id: id, display_name: String(account.display_name || '').slice(0, 80), asked_at: new Date(now()).toISOString() };
        await fsp.mkdir(pendingDir, { recursive: true });
        // 볼 계정이 그사이 정해졌으면 쓰지 않는다(GPT 검수 GB6). 받은 직후 이 쓰기가 닿아도 그 계정 한 줄뿐이고, 받은 계정이면 승인 도구가 가린다
        if (await viewers()) { pendingWritten.delete(id); return; }
        await fsp.writeFile(tmp, JSON.stringify(body, null, 2) + '\n', 'utf8');
        await fsp.rename(tmp, file);
      } catch { pendingWritten.delete(id); await fsp.unlink(tmp).catch(() => {}); /* 남기지 못해도 방은 그대로 닫혀 있다 */ }
    });
    return pendingQueue;
  }
  /** 볼 계정이면 그 번호, 아니면 null */
  async function gate(account, { note = true } = {}) {
    const id = accountIdOf(account);
    if (!id) return null;
    const ids = await viewers();
    if (!ids) { if (note) await notePending(account, id); return null; }
    return ids.includes(id) ? id : null;
  }

  /* ── 세션 상태 ── */
  const sessionsJson = s => JSON.stringify(s.sessions);
  function changed() {
    if (changeTimer) return;
    changeTimer = after(() => { changeTimer = null; try { onChange(); } catch { /* 화면 쪽 잘못은 여기서 멈추지 않는다 */ } }, T.change);
    changeTimer?.unref?.();
  }
  function startPrune() {
    if (pruneTimer) return;
    pruneTimer = every(() => commit(state), T.prune);
    pruneTimer?.unref?.();
  }
  function stopPrune() { if (pruneTimer) { stopEvery(pruneTimer); pruneTimer = null; } }
  function stopWatch() { if (watching) { stopEvery(watching.timer); watching = null; } }

  /* 새 상태를 들이고, 내린 세션을 지우고, 바뀌었으면 알린다. 내린 세션의 「보낼 부서」 기억도 지운다(5절).
     끝(SessionEnd)이 닿은 세션도 끝낸 그때 기억을 지운다. 늦게 닿은 끝이라 세션이 선 채로 받은 끝의 때(lastEndAt)만 늘어도 같다
     (GPT 검수 GB9 · be3 GA11, 설계 검토 solio-office-hooks (마)). 끝 뒤에 다시 선 세션은 「부서 없는 일」이나 폴더의 부서로 간다 */
  const endOf = (s, id) => (hasOwn(s.sessions, id) ? s.sessions[id].lastEndAt ?? s.sessions[id].endedAt ?? null : null);
  function commit(next) {
    const pruned = model.officePrune(next, now());
    const gone = Object.keys(state.sessions).filter(id => !hasOwn(pruned.sessions, id))
      .concat(Object.keys(pruned.sessions).filter(id => { const e = endOf(pruned, id); return e != null && e !== endOf(state, id); }));
    const moved = sessionsJson(pruned) !== sessionsJson(state);
    state = pruned;
    if (Object.keys(state.sessions).length) startPrune(); else stopPrune();
    if (gone.length && owner) void forget(owner, gone, generation);
    if (moved) changed();
    return moved;
  }
  async function forget(accountId, ids, gen) {
    try {
      const r = await st.forgetSessions(accountId, ids);
      if (r && r.ok && !r.unchanged && gen === generation) { remember(accountId, r.data); changed(); }
    } catch { /* 다음에 내릴 때 다시 지운다 */ }
  }
  /* 계정이 바뀌면 다 비운다. 같은 계정이면 그대로 */
  function useAccount(id) {
    if (owner === id) return false;
    const had = Object.keys(state.sessions).length > 0;
    stopWatch();
    stopPrune();
    state = model.officeReduce(state, { kind: 'reset' });
    generation += 1;
    owner = id;
    storeCache = null;
    storeSeq += 1; // 계정이 바뀌기 전에 시작한 읽기는 기억에 넣지 않는다(카본 검수 solio-office-be2 A3)
    if (had) changed();
    return true;
  }
  async function storeData(id) {
    if (storeCache && storeCache.accountId === id) return storeCache.data;
    const seq = storeSeq;
    const r = await st.read(id);
    return fresher(id, seq, r && r.ok ? r.data : emptyData());
  }
  /* 읽기를 시작한 뒤 고치기 결과가 기억에 들어왔으면 그것이 더 새것이다. 아니면 읽은 것을 기억한다 */
  function fresher(id, seq, data) {
    if (seq !== storeSeq) return storeCache && storeCache.accountId === id ? storeCache.data : data;
    storeCache = { accountId: id, data };
    return data;
  }
  /* 처음 보는 폴더와 손님이 더한 Claude 설정 폴더. 큰 · 작은 글자를 가리지 않고 겹친 것은 하나로.
     구독 방의 계정 폴더는 처음 보는 폴더(CLAUDE_CONFIG_DIR)로 와도 넣지 않는다. 손님이 더할 때와 같은 판정 하나를 쓴다(3.4의 5, GPT 검수 GB4 · be3 GA10) */
  function rootsFor(data) {
    let base;
    try { base = typeof roots === 'function' ? roots() : roots; } catch { base = null; }
    const seen = new Set(), claude = [];
    for (const d of [...(Array.isArray(base?.claude) ? base.claude : []), ...(data?.roots?.claude || [])]) {
      if (typeof d !== 'string' || !d || isSubscriptionDir(d)) continue;
      const k = path.resolve(d).toLowerCase();
      if (!seen.has(k)) { seen.add(k); claude.push(d); }
    }
    return { claude, codex: (Array.isArray(base?.codex) ? base.codex : []).filter(d => typeof d === 'string' && d) };
  }

  /* ── 기록 살피기 ── */
  function scanOnce(full) {
    if (!watching) return Promise.resolve();
    if (scanning) return scanning;
    const w = watching, gen = generation;
    scanning = (async () => {
      try {
        const id = await gate(w.account, { note: false });
        if (!id || id !== owner || gen !== generation) { if (watching === w) stopWatch(); return; }
        const data = await storeData(id);
        const found = await rec.scan({ full, roots: rootsFor(data) });
        if (gen !== generation || watching !== w) return; // 살피는 사이에 계정이 바뀌었거나 방이 닫혔다
        let next = state;
        for (const o of Array.isArray(found) ? found : []) if (o && o.kind === 'record') next = model.officeReduce(next, o);
        commit(next);
      } catch { /* 다음 틱에 다시 본다 */ } finally { scanning = null; }
    })();
    return scanning;
  }

  /* ── 이 PC의 값: 처음에는 읽을 때까지 기다리고, 그 뒤에는 가진 값을 주며 30초가 지났으면 뒤에서 다시 읽는다 ── */
  function refreshPc() {
    if (pc.inflight) return pc.inflight;
    pc.inflight = Promise.resolve()
      .then(() => cap.read())
      .then(v => { pc.value = pcNumbers(v); }, () => { /* 못 읽으면 30초 뒤에 다시 */ })
      .finally(() => { pc.at = now(); pc.inflight = null; });
    return pc.inflight;
  }
  async function pcNow() {
    if (pc.at == null || now() - pc.at >= T.pc) {
      const p = refreshPc();
      if (pc.value == null) await p;
    } else if (pc.value == null && pc.inflight) await pc.inflight;
    return pc.value ? { ...pc.value } : null;
  }

  /* ── 공개 함수: 모두 지금 계정을 받는다 ── */
  async function allowed(account) { const id = await gate(account); return id !== null && isCurrent(account); }
  /** 훅 서버가 몸을 읽기 전에 묻는다. 볼 계정이 로그인해 있을 때만 참이다. 대기 명단에는 적지 않는다 */
  async function accepts(account) { const id = await gate(account, { note: false }); return id !== null && isCurrent(account); }
  /* 기다린 뒤에도 그 묶음이 지금 묶음이고 세대가 그대로인지 */
  const still = (account, id, gen) => gen === generation && owner === id && isCurrent(account);

  /* 훅 서버가 소식과 함께 넘긴 받기 표(세대)가 아직 맞는지. 훅 서버가 있으면 그 표로만 접는다. 기다림 없이 부른다 */
  const hookOpen = ticket => (hooks ? typeof hooks.accepting === 'function' && hooks.accepting(ticket) === true : true);
  /** 훅 소식 하나(5단계의 서버가 고른 칸만)를 접는다. 볼 계정이 로그인해 있지 않으면 읽지 않고 버린다.
      ticket: 훅 서버가 넘긴 받기 표. 볼 계정 파일을 읽는 사이에 끄기(--office-unhook 포함)가 받기를 닫았으면, 접기 바로 앞의 같은 틱에서 보고 버린다
      (계정 묶음의 still과 같은 꼴, 설계 검토의 단일 실행 잠금 설계) */
  async function ingest(event, account, ticket) {
    const id = await gate(account, { note: false });
    if (!id) return { ok: false, code: 'NOT_ALLOWED' };
    if (!isCurrent(account)) return CHANGED;
    const e = pickHook(event, now());
    if (!e) return { ok: false, code: 'VALUE' };
    if (!hookOpen(ticket)) return { ok: false, code: 'CLOSED' };
    useAccount(id);
    commit(model.officeReduce(state, e));
    return { ok: true };
  }

  /** 방이 보이는 동안 기록 살피기(on 참). 켤 때 한 번 모두 훑고 그 뒤 15초마다 본다 */
  async function watch(on, account) {
    const seq = ++watchSeq;
    const id = await gate(account);
    if (seq !== watchSeq) return { ok: true, watching: !!watching }; // 기다리는 사이에 더 늦은 watch가 왔다. 그 부름이 정한다(GPT 검수 GB10)
    // 볼 계정이 아닌 부름은 살피기를 건드리지 않는다. 지금 볼 계정의 살피기를 끊지 않게 한다(0.5.2 공개 검수 C2).
    // 볼 계정 파일에서 빠졌거나 계정이 바뀌면 살피기가 스스로 멈춘다(scanOnce의 gate, useAccount)
    if (!id) return { ok: false, code: 'NOT_ALLOWED' };
    if (!isCurrent(account)) return CHANGED;
    useAccount(id);
    if (!on) { stopWatch(); return { ok: true, watching: false }; }
    if (!watching) {
      const timer = every(() => { void scanOnce(false); }, T.tick);
      timer?.unref?.();
      watching = { timer, accountId: id, account: { synk_user_id: id } };
      void refreshPc(); // 방을 열 때 이 PC의 값을 미리 읽어 둔다
      await scanOnce(true);
    }
    return { ok: true, watching: !!watching };
  }

  /** 화면에 넘기는 모습. 시간에 따라 바뀌는 글은 화면이 제 시계로 만든다 */
  async function snapshot(account) {
    const id = await gate(account);
    if (!id) return { ok: true, available: false };
    if (!isCurrent(account)) return CHANGED; // 볼 계정 파일을 읽는 사이에 로그아웃하거나 계정이 바뀌었다
    useAccount(id);
    const gen = generation;
    const seq = storeSeq;
    const r = await st.read(id);
    if (!still(account, id, gen)) return CHANGED;
    const data = fresher(id, seq, r && r.ok ? r.data : emptyData());
    const pcValue = await pcNow();
    if (!still(account, id, gen)) return CHANGED;
    const watched = rootsFor(data);
    let hookState = { on: false };
    if (hooks) { try { hookState = await hooks.status(watched.claude); } catch { hookState = { on: false, available: false, dirs: [], message: null }; } }
    if (!still(account, id, gen)) return CHANGED;
    return {
      ok: true, available: true,
      state: { sessions: structuredClone(state.sessions), ignored: {} }, // 앱이 스스로 돌린 세션의 번호는 화면에 넘기지 않는다
      departments: data.departments, assignments: data.assignments,
      settings: { view: data.view, manualCap: data.manualCap },
      roots: { claude: watched.claude, codex: watched.codex, added: [...data.roots.claude] },
      pc: pcValue, hooks: hookState, readAt: now(),
    };
  }

  /* 고치기: 볼 계정인지 본 뒤 office-store의 계정마다 한 줄 차례에 넘긴다. 읽고 고치고 쓰기는 그 차례 안에서만 한다(GA3).
     store는 쓰기 바로 앞에서 guard로 이 묶음이 아직 지금 묶음인지 본다. 아니면 쓰지 않고 AUTH_CHANGED다(GPT 검수 GB1) */
  async function mutation(account, run) {
    const id = await gate(account);
    if (!id) return { ok: false, code: 'NOT_ALLOWED' };
    if (!isCurrent(account)) return CHANGED;
    useAccount(id);
    const gen = generation;
    const r = await run(id, { guard: () => still(account, id, gen) });
    if (!still(account, id, gen)) return CHANGED; // 저장하는 사이에 계정이 바뀌었으면 옛 계정의 판을 기억하지 않는다
    if (!r || !r.ok) return r || { ok: false, code: 'WRITE' };
    if (!r.unchanged) { remember(id, r.data); changed(); }
    return { ok: true, data: r.data };
  }
  const saveDepartment = (input, account) => mutation(account, (id, o) => st.saveDepartment(id, input, o));
  const removeDepartment = (departmentId, account) => mutation(account, (id, o) => st.removeDepartment(id, departmentId, o));
  /** 「보낼 부서」: 지금 선 세션만 받는다. 끝낸 세션(endedAt)은 화면에서 내려갔으므로 받지 않는다(카본 검수 solio-office-be2 A4). departmentId null은 기억을 지운다 */
  const standing = sessionId => typeof sessionId === 'string' && hasOwn(state.sessions, sessionId) && state.sessions[sessionId].endedAt == null;
  const assign = (sessionId, departmentId, account) => mutation(account, async (id, o) => {
    if (departmentId != null && !standing(sessionId)) return { ok: false, code: 'NOT_FOUND' };
    return st.assign(id, sessionId, departmentId ?? null, o);
  });
  const saveSettings = (input, account) => mutation(account, (id, o) => st.saveSettings(id, input, o));
  async function saveRoots(dirs, account) {
    const r = await mutation(account, (id, o) => st.saveRoots(id, dirs, o));
    if (r.ok && watching) void scanOnce(false); // 새 폴더는 처음 보므로 바로 모두 훑는다
    return r;
  }
  /** 보는 폴더 하나 더하기 · 빼기(GA3, GA4). 저장된 목록을 차례 안에서 읽고 고친다. 있는지는 더하는 폴더만 본다 */
  async function addRoot(dir, account) {
    const r = await mutation(account, (id, o) => st.addRoot(id, dir, o));
    if (r.ok && watching) void scanOnce(false);
    return r;
  }
  const removeRoot = (dir, account) => mutation(account, (id, o) => st.removeRoot(id, dir, o));

  /** 「승인 물음도 보기」(12.3): on 참이면 이 계정의 Claude 설정 폴더(기본 폴더와 손님이 더한 폴더)에 더하고, 거짓이면 끈다.
      설정 폴더를 고르는 것은 office-hooks다(설치본이 아니면 넘겨받은 폴더만). 결과에는 폴더 경로를 싣지 않는다 */
  async function setHooks(on, account) {
    const id = await gate(account);
    if (!id) return { ok: false, code: 'NOT_ALLOWED' };
    if (!hooks) return { ok: false, code: 'NOT_HERE' };
    if (!isCurrent(account)) return CHANGED;
    useAccount(id);
    const gen = generation;
    let roots = [];
    if (on === true) { const data = await storeData(id); if (!still(account, id, gen)) return CHANGED; roots = rootsFor(data).claude; }
    const r = on === true ? await hooks.enable(roots, { guard: () => still(account, id, gen) }) : await hooks.disable();
    changed();
    return hookAnswer(r);
  }

  /** 그 부서의 줄을 열었다 닫음: 그때까지 끝낸 차례의 느낌표를 지운다. departmentId null은 「부서 없는 일」 */
  async function seen(departmentId, account) {
    const at = now(); // 줄을 닫은 때. 기다린 뒤의 때로 하면 그사이 새로 끝낸 차례까지 지운다(GPT 검수 GB11)
    const id = await gate(account);
    if (!id) return { ok: false, code: 'NOT_ALLOWED' };
    if (departmentId !== null && typeof departmentId !== 'string') return { ok: false, code: 'VALUE' };
    if (!isCurrent(account)) return CHANGED;
    useAccount(id);
    const gen = generation;
    const data = await storeData(id);
    if (!still(account, id, gen)) return CHANGED;
    commit(model.officeReduce(state, { kind: 'seen', departmentId, at }, { departments: data.departments, assignments: data.assignments }));
    return { ok: true };
  }

  /** 로그아웃하거나 계정이 바뀌었을 때(main이 부른다). 세션 기억을 비우고 기록 살피기를 멈춘다. 같은 계정이면 그대로 둔다 */
  function accountChanged(account) {
    const id = accountIdOf(account);
    current = id === null ? null : { id, round: roundOf(account) };
    const cleared = useAccount(id);
    if (id === null) stopWatch();
    return { ok: true, cleared };
  }

  /** 앱을 끌 때: 타이머를 모두 멈춘다 */
  function close() {
    stopWatch();
    stopPrune();
    if (changeTimer) { cancel(changeTimer); changeTimer = null; }
  }

  return { allowed, accepts, ingest, watch, snapshot, setHooks, saveDepartment, removeDepartment, assign, saveSettings, saveRoots, addRoot, removeRoot, seen, accountChanged, close, viewersFile, pendingDir };
}

module.exports = { createOffice, loadOfficeModel, defaultViewersFile, OFFICE_TICKS };
