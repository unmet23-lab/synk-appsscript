// 솔리오 안쪽의 방(2단계 둘째 조각)의 상태와 동작. DOM이 없다. 컨트롤러(orb-face.mjs)가 만들고, 화면이 보낸 「room」 동작을 여기에 넘긴다.
// 설계: docs/디자인/플랫폼_클라이언트_검정구_20261116/2단계_둘째조각_구현설계.md 1.3절 · 3~5절 · 8절. 구독과 모델별 토큰은 옛 구독 판이 쓰던 다리(options.subscriptions)를,
// 내 계정은 런처가 넘기는 계정 어댑터(faceOptions.rooms.account, 뒤의 길은 옛 내 계정과 같은 다리)를 쓴다.
// 되돌릴 수 없는 일의 첫 누름(armed)은 1분 장면이 와도 지워지지 않게 화면이 아니라 여기에 둔다(설계 8.2).
import { manageRoom, costRow, tokRow, accountRoom, accountSay, checkName, dateTimeWords, ACCOUNT_SAY, ACCOUNT_CONFLICTS, CODE_SAY, codeSay, manageKey, manageOpenKey, addInfo, parseCost, parsePass, parseApi, parseFlow, parseManual, checkCode, checkKey, checkEmail, checkRate } from './solio-rooms.mjs';
import { isUsedUp, num, nameOf } from './subscriptions-model.mjs';
import { SOLIO_TODAY_NAMES, josa } from './solio-today.mjs';
import { profileChange, pendingDeletion } from './account-page.mjs';

/* 두 번 누르기의 막이(설계 8.2, 설계 검토 D1). 묻고 0.6초 안의 두 번째 누름은 받지 않고(더블클릭 · Enter 되풀이), 10초가 지나면 물음을 거둔다.
   account는 계정 요청 하나를 기다리는 한도(옛 내 계정과 같다), tokLive는 모델별 토큰 줄이 열린 동안 실시간을 다시 부탁하는 사이다(옛 구독 판과 같다) */
export const ROOM_TIMING = Object.freeze({ armGuard: 600, armExpire: 10000, account: 15000, tokLive: 60000, tokPaint: 1000 });
/* 펼침이나 구독 방에서 여는 방. 설정 방은 다음 묶음에서 더한다 */
export const ASIDE_ROOMS = Object.freeze(['manage', 'account']);
const TOK_RANGE_KEYS = Object.freeze(['today', 'week', 'month']);
/* 내 계정 방의 줄 열쇠. 계정이 바뀌면 이 줄들의 진행 표시를 지운다 */
const ACCOUNT_ROWS = Object.freeze(['name', 'login', 'places', 'data', 'del']);
const failure = (code, extra = {}) => Object.assign(new Error(code), { code, ...extra });
// 본체의 판에는 순서 번호(epoch · seq)가 붙는다. 늦게 온 옛 판으로 새 판을 덮지 않는다(옛 구독 판 209행)
const newerTokens = (a, b) => !b || a.epoch == null || b.epoch == null || a.epoch > b.epoch || (a.epoch === b.epoch && a.seq >= b.seq);

const ENDED = ['done', 'error', 'cancelled'];
const rowOf = (snap, id) => snap?.rows?.find(r => r.id === id) || null;
const idOf = key => (typeof key === 'string' && key.startsWith('a:') ? key.slice(2) : null);
const who = row => (row?.source === 'auto' ? [SOLIO_TODAY_NAMES[row.service] || '', nameOf(row), '계정'].filter(Boolean).join(' ') : String(row?.label || '').trim()) || '그 계정';
const eul = w => josa(w, ['을', '를']);
const failCode = res => res?.code || res?.error?.code || null;
const hasRows = res => !!res && res.ok !== false && Array.isArray(res.rows);

/* account: 내 계정 어댑터 { request(op, params), identity(), security(section), securityOpened(), changed() }. 없으면 내 계정 방을 열지 않는다.
   confirmLeave: 모든 곳에서 로그아웃 전 쓰던 글 확인(런처의 confirmDraftExit). signOut: 이 PC 로그아웃. openOld: 옛 내 계정 화면을 연다(마을 기록 · 내려받기) */
export function createOrbRooms({ subs = null, account = null, now = () => Date.now(), setTimer = globalThis.setTimeout, clearTimer = globalThis.clearTimeout, setTick = globalThis.setInterval, clearTick = globalThis.clearInterval, snapshot = () => null, accept = () => {}, reread = () => {}, copyText = null, changed = () => {}, sentence = s => s, confirmLeave = null, signOut = null, openOld = null, randomId = () => globalThis.crypto?.randomUUID?.() || Date.now().toString(16) + Math.random().toString(16).slice(2) } = {}) {
  const st = { armed: null, grps: new Set(), add: { svc: '' }, relogin: null, kinds: {}, installing: new Set(), busy: null, notes: new Map(), ended: null, roomNote: '', tokRange: 'week', tokAll: false };
  let gen = 0, armTimer = null, lastLogin, loginEmail;
  let focusReq = null, openReq = null, closeReq = null, seq = 0, current = null;
  /* 모델별 토큰(설계 3.4, 설계 검토 D8). 솔리오에 들어오면 한 번 읽고 알림을 듣는다. 실시간은 줄이 열려 보이는 동안만 부탁한다 */
  const freshTok = () => ({ state: null, loaded: false, loading: false, open: false, live: false, unsub: null, paint: null, timer: null });
  let tok = freshTok();
  /* 내 계정(설계 5.4). 계정 세대(accGen)가 바뀌면 늦게 온 답을 버린다. 삭제 요청 id는 한 번 만들어 다시 보내도 같은 요청이 되게 한다(옛 251~262행) */
  const freshAcc = () => ({ data: null, identity: null, loading: false, error: '', identityError: false, allSessions: false, askDelete: false, askAt: 0 });
  let acc = freshAcc(), accGen = 0, deleteRequestId = null;

  const note = (key, text) => { if (text) st.notes.set(key, text); else st.notes.delete(key); };
  const ask = req => ({ ...req, seq: ++seq });
  function disarm() { st.armed = null; if (armTimer !== null) { clearTimer(armTimer); armTimer = null; } }
  function armedNow() { if (st.armed && now() - st.armed.at >= ROOM_TIMING.armExpire) st.armed = null; return st.armed; }
  /* 같은 단추를 두 번 누른다. 'ask' 물음을 띄움 · 'wait' 막이 안의 두 번째 누름이라 받지 않음 · 'go' 실행 */
  function twice(key, act) {
    const a = armedNow(), t = now();
    if (a && a.key === key && a.act === act) {
      if (t - a.at < ROOM_TIMING.armGuard) return 'wait';
      disarm();
      return 'go';
    }
    disarm();
    st.armed = { key, act, at: t };
    // 시간이 다 되면 물음을 거둔다. 그 전에 불리면(시계가 앞선 때) 그대로 두고, 그리기마다 armedNow가 다시 본다
    armTimer = setTimer(() => { armTimer = null; if (st.armed && now() - st.armed.at >= ROOM_TIMING.armExpire - 20) { st.armed = null; changed(); } }, ROOM_TIMING.armExpire);
    return 'ask';
  }
  function view() { return { ...st, armed: armedNow() }; }

  /* 한 번에 한 일만 보낸다. 계정이 바뀌거나 방을 지우면(reset) 늦게 온 답을 버린다 */
  async function run(key, act, task) {
    if (st.busy || !subs) return null;
    const my = gen;
    st.busy = key + ':' + act;
    changed();
    let res;
    try { res = await task(); } catch { res = { ok: false }; }
    if (my !== gen) return null;
    st.busy = null;
    return res ?? { ok: true };
  }
  function failed(key, res) { note(key, codeSay(failCode(res))); changed(); }
  function saved(key, grp, text = '저장했습니다.') {
    note(key, text);
    if (grp) { st.grps.delete(key + ':' + grp); focusReq = ask({ key, act: 'grp', arg: grp }); }
    changed();
  }
  async function save(key, act, patch, done) {
    const res = await run(key, act, () => subs.save(patch));
    if (res === null) return null;
    if (!hasRows(res)) { failed(key, res); return null; }
    accept(res);
    done?.(res);
    return res;
  }
  async function copy(key, text, ok, no) {
    let done = false;
    try { done = text && typeof copyText === 'function' ? (await copyText(text)) !== false : false; } catch { done = false; }
    note(key, done ? ok : no);
    changed();
  }
  const loginNow = () => { const l = snapshot()?.login; return l && !ENDED.includes(l.stage) ? l : null; };

  /* ── 모델별 토큰 ── */
  function takeTokens(value) {
    if (!value || value.ok !== true || !newerTokens(value, tok.state)) return;
    tok.state = value;
    if (!value.scanning) { if (tok.paint !== null) { clearTimer(tok.paint); tok.paint = null; } changed(); return; }
    // 세는 동안 알림이 0.5초마다 와도 줄은 1초에 한 번까지만 다시 그린다(옛 구독 판 규칙)
    if (tok.paint === null) tok.paint = setTimer(() => { tok.paint = null; changed(); }, ROOM_TIMING.tokPaint);
  }
  const tokCall = task => { const my = gen; return Promise.resolve().then(task).then(v => { if (my === gen) takeTokens(v); }, () => {}); };
  /* 솔리오에 들어올 때: 알림을 한 번만 듣는다. 계정이 바뀌면(reset) 듣기를 끊는다 */
  function tokStart() {
    if (tok.unsub || typeof subs?.onTokens !== 'function') return;
    const my = gen;
    try { const off = subs.onTokens(v => { if (my === gen) takeTokens(v); }); tok.unsub = typeof off === 'function' ? off : () => {}; } catch { tok.unsub = null; }
  }
  /* 읽을 수 있게 된 뒤 한 번 읽는다. 본체가 거절하면(로그인 갱신 중) 다음에 다시 읽는다 */
  function tokLoad() {
    if (typeof subs?.tokens !== 'function' || tok.loaded || tok.loading) return;
    const my = gen;
    tok.loading = true;
    Promise.resolve().then(() => subs.tokens()).then(res => {
      if (my !== gen) return;
      tok.loading = false;
      if (res?.ok === true) { tok.loaded = true; takeTokens(res); }
    }, () => { if (my === gen) tok.loading = false; });
  }
  const tokLiveCall = on => (typeof subs?.tokensLive === 'function' ? tokCall(() => subs.tokensLive(on)) : null);
  function tokTick() {
    const s = tok.state;
    if (!s?.enabled) return;
    // 열린 동안 1분마다: 세는 중이 아니면 오래된 셈을 다시 세 달라고 부탁하고(본체는 마지막으로 센 지 5분이 지났을 때만 센다), 실시간 지켜보기를 잇는다
    if (s.scanning) { if (typeof subs?.tokens === 'function') void tokCall(() => subs.tokens()); }
    else if (typeof subs?.tokensScan === 'function') void tokCall(() => subs.tokensScan({ force: false }));
    void tokLiveCall(true);
  }
  /* 그릴 때마다 컨트롤러가 부른다. 구독 방이 보이고, 그 줄이 열려 있고, 켜져 있을 때만 실시간을 부탁한다(설계 검토 D8) */
  function syncLive(visible) {
    const want = !!visible && tok.open && tok.state?.enabled === true && !!subs;
    if (want === tok.live) return;
    tok.live = want;
    if (want) { tokTick(); if (typeof setTick === 'function') tok.timer = setTick(tokTick, ROOM_TIMING.tokLive); }
    else { if (tok.timer !== null) { clearTick?.(tok.timer); tok.timer = null; } void tokLiveCall(false); }
  }
  function tokReset() {
    try { tok.unsub?.(); } catch { /* 무시 */ }
    if (tok.paint !== null) clearTimer(tok.paint);
    if (tok.timer !== null) clearTick?.(tok.timer);
    if (tok.live) void tokLiveCall(false);
    tok = freshTok();
  }

  /* ── 내 계정 ── */
  /* 계정 요청 하나. 15초 안에 답이 없으면 연결 실패로 보고, 그사이 계정이 바뀌었으면 답을 버린다(옛 내 계정 140~150행) */
  function accCall(op, params, my) {
    if (!account) return Promise.reject(failure('ACCOUNT_UNAVAILABLE'));
    const started = now();
    let timer = null;
    const timeout = new Promise((_, reject) => {
      // 시계를 앞당겨 부르는 시험 타이머에서도 한도가 지난 뒤에만 실패로 본다
      const arm = left => { timer = setTimer(() => { timer = null; if (my !== accGen) return reject(failure('changed')); const gone = now() - started; if (gone >= ROOM_TIMING.account - 20) reject(failure('NETWORK')); else arm(ROOM_TIMING.account - gone); }, left); };
      arm(ROOM_TIMING.account);
    });
    const asking = Promise.resolve().then(() => { if (my !== accGen) throw failure('changed'); return op === 'identity' ? account.identity() : account.request(op, params); });
    return Promise.race([asking, timeout]).then(raw => {
      if (my !== accGen) throw failure('changed');
      if (raw?.ok !== true) throw failure(raw?.error?.code || raw?.code || 'REQUEST_FAILED', { retryable: raw?.error?.retryable === true });
      return raw;
    }).finally(() => { if (timer !== null) clearTimer(timer); });
  }
  async function accLoad({ quiet = false } = {}) {
    if (!account || acc.loading) return;
    const my = accGen;
    acc.loading = true;
    if (!quiet) acc.error = '';
    changed();
    const [view, who] = await Promise.allSettled([accCall('accountView', {}, my), accCall('identity', {}, my)]);
    if (my !== accGen) return;
    acc.loading = false;
    if (view.status === 'fulfilled') { acc.data = view.value; acc.error = ''; }
    else if (view.reason?.code !== 'changed' && !acc.data) acc.error = accountSay(view.reason?.code, view.reason?.retryable);
    if (who.status === 'fulfilled') { acc.identity = who.value; acc.identityError = false; }
    else if (who.reason?.code !== 'changed') acc.identityError = true;
    changed();
  }
  /* 바꾸는 일 하나. 끝나면 조용히 다시 읽는다. 충돌 코드면 다시 읽고 알린다(옛 내 계정 184~196행) */
  async function accAct(key, act, task, { reload = true } = {}) {
    if (!account || st.busy || acc.loading) return;
    const my = accGen;
    st.busy = key + ':' + act;
    changed();
    try {
      await task(my);
      if (my !== accGen) return;
      st.busy = null;
      // 바뀐 뒤에는 다른 줄에 남은 앞의 알림을 거둔다(삭제 요청 뒤의 「학습 기록 연결을 켰습니다.」처럼 사실과 어긋날 수 있다)
      for (const k of ACCOUNT_ROWS) if (k !== key) st.notes.delete(k);
      if (reload) await accLoad({ quiet: true });
    } catch (error) {
      if (my !== accGen || error?.code === 'changed') return;
      st.busy = null;
      if (ACCOUNT_CONFLICTS.includes(error?.code)) await accLoad({ quiet: true });
      if (my !== accGen) return;
      note(key, accountSay(error?.code, error?.retryable));
    } finally {
      if (my === accGen) { st.busy = null; changed(); }
    }
  }
  /* 런처가 계정 생명주기에서 부른다(같은 사람의 새 세션 포함). 보이던 자료와 오는 중인 답을 버리고, 방이 열려 있으면 다시 읽는다 */
  function accountChanged() {
    accGen += 1;
    acc = freshAcc();
    deleteRequestId = null;
    if (st.busy && ACCOUNT_ROWS.includes(st.busy.split(':')[0])) st.busy = null;
    if (st.armed && ACCOUNT_ROWS.includes(st.armed.key)) disarm();
    for (const k of ACCOUNT_ROWS) st.notes.delete(k);
    if (current === 'account') void accLoad();
    changed();
  }

  async function handle(p = {}) {
    const key = String(p.key || ''), act = String(p.act || ''), arg = p.arg == null ? '' : String(p.arg), fields = p.fields && typeof p.fields === 'object' ? p.fields : {};
    if (act === 'disarm') { if (st.armed && (!key || st.armed.key === key)) { disarm(); changed(); } return true; }
    // 화면이 알리는 줄 열림과 접힘(watch 줄). 모델별 토큰은 열린 동안만 실시간을 부탁하고, 계정 지우기는 접히면 확인 묶음을 거둔다
    if (act === 'row-open' || act === 'row-fold') {
      const on = act === 'row-open';
      if (key === 'tok' && tok.open !== on) { tok.open = on; changed(); }
      if (key === 'del' && !on && acc.askDelete) { acc.askDelete = false; changed(); }
      return true;
    }
    // 다른 단추를 누르면 앞의 물음을 거둔다
    if (st.armed && !(st.armed.key === key && st.armed.act === act)) disarm();
    const snap = snapshot(), t = now(), id = idOf(key), row = id ? rowOf(snap, id) : null;
    if (act !== 'grp' && act !== 'kind-pick') note(key, '');
    switch (act) {
      case 'add-pick': {
        if (st.add.svc !== arg) { st.add = { svc: addInfo(arg) ? arg : '' }; delete st.kinds.add; st.ended = null; }
        changed(); return true;
      }
      case 'kind-pick': st.kinds[key] = arg; focusReq = ask({ key, act, arg }); changed(); return true;
      case 'grp': {
        const name = key + ':' + arg;
        if (st.grps.has(name)) { st.grps.delete(name); focusReq = ask({ key, act: 'grp', arg }); } else { st.grps.add(name); focusReq = ask({ key, grp: arg }); }
        changed(); return true;
      }
      case 'install': {
        const res = await run(key, act, () => subs.install(arg));
        if (res === null) return true;
        if (res.ok === false) return failed(key, res), true;
        st.installing.add(arg);
        note(key, (addInfo(arg)?.tool || '') + ' 설치 창을 열었습니다. 창을 닫지 말고 끝날 때까지 기다려 주세요.');
        changed(); return true;
      }
      case 'recheck-tools': {
        const res = await run(key, act, () => subs.snapshot({ refreshTools: true }));
        if (res === null) return true;
        if (!hasRows(res)) return failed(key, res), true;
        accept(res);
        const ok = !!res.tools?.[arg]?.installed;
        if (ok) st.installing.delete(arg);
        note(key, ok ? (addInfo(arg)?.tool || '') + '가 설치된 것을 확인했습니다.' : '아직 설치를 찾지 못했습니다. 설치 창이 끝난 뒤 다시 확인해 주세요.');
        changed(); return true;
      }
      case 'tool-copy': await copy(key, addInfo(arg)?.cmd, '명령을 복사했습니다. PowerShell에 붙여 넣어 주세요.', '복사하지 못했습니다. 명령을 직접 골라 복사해 주세요.'); return true;
      case 'help': {
        let res;
        try { res = await subs?.help?.(arg); } catch { res = { ok: false }; }
        if (res?.ok === false) { note(key, '브라우저를 열지 못했습니다. 잠시 뒤 다시 해 주세요.'); changed(); }
        return true;
      }
      case 'existing': {
        const res = await run(key, act, () => subs.useExisting(arg));
        if (res === null) return true;
        if (res.ok === false) return failed(key, res), true;
        if (res.snapshot) accept(res.snapshot);
        const text = (addInfo(arg)?.nm || '') + ' 계정을 연결했습니다. 바로 한 번 읽었습니다.';
        st.add = { svc: '' }; st.roomNote = text; note('add', text); closeReq = ask({ key: 'add' });
        changed(); return true;
      }
      case 'login': case 'console-login': {
        const email = arg === 'claude' ? (act === 'login' ? checkEmail(fields.email) : { ok: true, value: loginEmail }) : { ok: true, value: undefined };
        if (!email.ok) { note(key, email.say); changed(); return true; }
        if (key === 'add') st.relogin = null;
        st.ended = null;
        loginEmail = email.value;
        const res = await run(key, act, () => subs.login(arg, { email: email.value, ...(act === 'console-login' ? { console: true } : {}) }));
        if (res === null) return true;
        if (res.ok === false) return failed(key, res), true;
        changed(); return true;
      }
      case 'open-url': { const l = loginNow(); if (l) { try { await subs?.openLoginUrl?.(l.id); } catch { /* 본체가 알린다 */ } } return true; }
      case 'copy-url': await copy(key, loginNow()?.url, '로그인 주소를 복사했습니다. 시크릿 창(Ctrl+Shift+N) 주소창에 붙여 넣어 주세요.', '복사하지 못했습니다. 「로그인 화면 다시 열기」를 써 주세요.'); return true;
      case 'cancel-login': {
        const l = loginNow();
        if (!l) return true;
        const res = await run(key, act, () => subs.cancel(l.id));
        if (res && res.ok === false) failed(key, res); else changed();
        return true;
      }
      case 'code': {
        const c = checkCode(fields.code), l = loginNow();
        if (!c.ok) { note(key, c.say); changed(); return true; }
        if (!l) return true;
        const res = await run(key, act, () => subs.submitCode(l.id, c.value));
        if (res && res.ok === false) failed(key, res); else changed();
        return true;
      }
      case 'key': {
        const k = checkKey(fields.key);
        if (!k.ok) { note(key, k.say); changed(); return true; }
        const replace = st.relogin && rowOf(snap, st.relogin)?.service === arg ? st.relogin : null;
        const res = await run(key, act, () => subs.connectKey(arg, k.value, replace ? { replace } : {}));
        if (res === null) return true;
        if (res.ok === false) return failed(key, res), true;
        const next = res.snapshot || res;
        if (hasRows(next)) accept(next);
        const text = 'Typecast 키를 연결했습니다. 남은 크레딧을 읽었습니다.';
        if (key === 'add') { st.add = { svc: '' }; st.roomNote = text; closeReq = ask({ key: 'add' }); }
        else st.relogin = null;
        note(key, text);
        changed(); return true;
      }
      case 'manual-add': {
        const v = parseManual(fields, st.kinds.add);
        if (!v.ok) { note(key, v.say); changed(); return true; }
        await save(key, act, { add: v.add }, () => {
          const text = eul(v.add.label) + ' 넣었습니다. 요금과 결제일은 그 줄을 열어 고칩니다.';
          st.add = { svc: '' }; delete st.kinds.add; st.roomNote = text; note('add', text); closeReq = ask({ key: 'add' });
          changed();
        });
        return true;
      }
      case 'relogin': {
        if (!row) return true;
        st.relogin = row.id; st.ended = null;
        if (row.service === 'typecast') { focusReq = ask({ key, field: 'key' }); changed(); return true; }
        loginEmail = row.service === 'claude' ? row.email || undefined : undefined;
        const res = await run(key, act, () => subs.login(row.service, { email: loginEmail }));
        if (res === null) return true;
        if (res.ok === false) { st.relogin = null; return failed(key, res), true; }
        changed(); return true;
      }
      case 'reread-one': {
        if (!row) return true;
        const res = await run(key, act, () => subs.check([row.id]));
        if (res === null) return true;
        if (!hasRows(res)) return failed(key, res), true;
        accept(res); changed(); return true;
      }
      case 'save-cost': {
        if (!row) return true;
        const v = parseCost(fields, row, fields.kind || st.kinds[key]);
        if (!v.ok) { note(key, v.say); changed(); return true; }
        await save(key, act, { row: v.patch }, () => { delete st.kinds[key]; saved(key, 'cost'); });
        return true;
      }
      case 'save-pass': {
        if (!row) return true;
        const v = parsePass(fields, t);
        if (!v.ok) { note(key, v.say); changed(); return true; }
        await save(key, act, { row: { id: row.id, ...v.patch } }, () => saved(key, 'pass'));
        return true;
      }
      case 'pass-used': {
        if (!row) return true;
        const left = Math.max(0, (num(row.passCount) || 0) - 1);
        const res = await save(key, act, { row: { id: row.id, passCount: left, ...(left ? {} : { passUntil: null }) } });
        if (!res) return true;
        saved(key, null, left ? '초기화권을 1장 줄였습니다. ' + left + '장 남았습니다.' : '초기화권을 다 썼습니다.');
        // 쓴 직후 그 계정만 다시 읽어 막힘과 풀리는 때가 바로 바뀌게 한다(옛 판 298행)
        let c = null;
        try { c = await subs.check?.([row.id]); } catch { c = null; }
        if (hasRows(c)) accept(c);
        return true;
      }
      case 'save-api': {
        if (!row) return true;
        const v = parseApi(fields, row, t);
        if (!v.ok) { note(key, v.say); changed(); return true; }
        await save(key, act, { row: { id: row.id, ...v.patch } }, () => saved(key, 'api', v.billDay ? '저장했습니다. 크레딧이 사라지는 날이 결제일이라 결제일도 매월 ' + v.billDay + '일로 넣었습니다.' : '저장했습니다.'));
        return true;
      }
      case 'save-flow': {
        if (!row) return true;
        const v = parseFlow(fields, row, t);
        if (!v.ok) { note(key, v.say); changed(); return true; }
        await save(key, act, { row: { id: row.id, ...v.patch } }, () => saved(key, 'flow', v.billDay ? '저장했습니다. Flow 크레딧은 결제 주기가 시작될 때 다시 차서 결제일도 매월 ' + v.billDay + '일로 넣었습니다.' : '저장했습니다.'));
        return true;
      }
      case 'used': {
        if (!row) return true;
        const was = isUsedUp(row, t);
        await save(key, act, { row: { id: row.id, usedUpAt: was ? null : t } }, () => saved(key, null, was ? '다 쓴 표시를 풀었습니다.' : '다 썼다고 표시했습니다.'));
        return true;
      }
      case 'remove': {
        if (!row) return true;
        const step = twice(key, act);
        if (step !== 'go') { if (step === 'ask') changed(); return true; }
        const name = who(row);
        await save(key, act, { remove: row.id }, () => { st.roomNote = name + ' 줄을 지웠습니다.'; st.grps.forEach(g => { if (g.startsWith(key + ':')) st.grps.delete(g); }); focusReq = ask({ say: true }); changed(); });
        return true;
      }
      case 'reread-all': reread(); return true;
      case 'rate-save': {
        const v = checkRate(fields.usdKrw);
        if (!v.ok) { note(key, v.say); changed(); return true; }
        await save(key, act, { settings: { usdKrw: v.value } }, () => saved(key, null));
        return true;
      }
      case 'tip': {
        const [tipKey, action] = arg.split('|');
        if (!tipKey || !['helpful', 'stop'].includes(action)) return true;
        await save(key, act, { tip: { key: tipKey, action } }, () => saved(key, null, action === 'stop' ? '이런 팁은 한동안 보이지 않습니다.' : '도움이 됐다고 남겼습니다.'));
        return true;
      }
      /* ── 모델별 토큰(설계 3.4) ── */
      case 'tok-on': {
        const res = await run(key, act, () => subs.tokensEnable(true));
        if (res === null) return true;
        if (res.ok === false) return failed(key, res), true;
        takeTokens(res);
        note(key, '켰습니다. 기록이 많으면 처음 세는 데 몇 분 걸립니다.');
        changed(); return true;
      }
      // 기간을 고르면 줄이 열린 채 서고 초점은 고른 단추에 남는다(화면이 같은 동작의 단추로 초점을 되살린다)
      case 'tok-range': if (TOK_RANGE_KEYS.includes(arg)) st.tokRange = arg; changed(); return true;
      case 'tok-all': st.tokAll = !st.tokAll; changed(); return true;
      case 'tok-scan': {
        const res = await run(key, act, () => subs.tokensScan({ force: true }));
        if (res === null) return true;
        if (res.ok === false) return failed(key, res), true;
        takeTokens(res);
        note(key, '기록 파일을 다시 세고 있습니다.');
        changed(); return true;
      }
      case 'tok-off': {
        const step = twice(key, act);
        if (step !== 'go') { if (step === 'ask') changed(); return true; }
        const res = await run(key, act, () => subs.tokensEnable(false));
        if (res === null) return true;
        // 지우지 못하면 본체가 켜 둔 채로 둔다. 화면도 켜짐 그대로 두고 까닭을 쓴다
        if (res.ok === false) { note(key, res.code === 'SIGN_IN_REQUIRED' ? CODE_SAY.SIGN_IN_REQUIRED : CODE_SAY.DELETE_FAILED); changed(); return true; }
        tok.state = res;
        st.tokAll = false;
        note(key, '모델별 토큰을 끄고 모은 숫자를 지웠습니다.');
        changed(); return true;
      }
      /* ── 내 계정(설계 5.4) ── */
      case 'retry': void accLoad(); return true;
      case 'sign-out': try { void signOut?.(); } catch { /* 런처가 알림으로 알린다 */ } return true;
      case 'sessions-all': acc.allSessions = !acc.allSessions; changed(); return true;
      case 'name-save': {
        const v = checkName(fields.name);
        if (!v.ok) { note(key, v.say); changed(); return true; }
        const before = acc.data?.account;
        if (v.value === String(before?.profile?.display_name || '').trim()) { note(key, '지금 이름과 같습니다.'); changed(); return true; }
        let change;
        try { change = profileChange(before, v.value); } catch (error) { note(key, accountSay(error?.code)); changed(); return true; }
        await accAct(key, act, async my => { await accCall('updateProfile', change, my); note(key, '이름을 바꿨습니다. SYNK 앱마다 다음에 열 때 새 이름이 보입니다.'); });
        return true;
      }
      case 'security': {
        // 비밀번호 · 로그인 이메일 · Google 연결은 기본 브라우저의 SYNK ID 「로그인과 보안」에서 한다. 연 때를 런처에 알려 로그인 화면의 비밀번호 안내에 쓴다
        await accAct(key, act, async my => {
          let res;
          try { res = await account.security?.(arg); } catch { res = null; }
          if (my !== accGen) return;
          if (res?.ok !== true) throw failure('SECURITY_OPEN_FAILED');
          try { account.securityOpened?.(); } catch { /* 안내에만 쓴다 */ }
          note(key, '기본 브라우저에서 SYNK ID의 「로그인과 보안」을 열었습니다. 비밀번호를 바꾸면 이 PC 앱도 로그아웃됩니다.');
        }, { reload: false });
        return true;
      }
      case 'revoke': {
        if (!arg) return true;
        await accAct(key, 'revoke:' + arg, async my => { await accCall('revokeSession', { session_id: arg }, my); note(key, '그 기기의 로그인을 끝냈습니다.'); });
        return true;
      }
      case 'revoke-all': {
        const step = twice(key, act);
        if (step !== 'go') { if (step === 'ask') changed(); return true; }
        changed();
        // 이 PC도 바로 로그아웃되므로, 쓰던 글이 있으면 펼침의 「로그아웃」과 같은 확인을 거친다(설계 8.3, 설계 검토 D1)
        const my = accGen;
        let go = true;
        try { go = typeof confirmLeave === 'function' ? (await confirmLeave()) !== false : true; } catch { go = false; }
        if (my !== accGen || !go) return true;
        // 본체가 이 PC의 로그인도 끝내므로 곧 묻는 화면으로 돌아간다. 알림은 옛 화면처럼 런처가 띄운다
        await accAct(key, act, async g => { await accCall('revokeAll', {}, g); note(key, '모든 곳에서 로그아웃했습니다.'); try { account.signedOutAll?.(); } catch { /* 알림만 못 띄운다 */ } }, { reload: false });
        return true;
      }
      case 'learning': {
        const data = acc.data;
        if (!data?.learning) return true;
        const enabled = data.learning.enabled !== true;
        if (enabled && !(data.capabilities?.learningSync === true && data.account?.status !== 'deletion-requested')) return true;
        await accAct(key, act, async my => {
          await accCall('setLearning', { enabled, expected_revision: data.learning.revision }, my);
          note(key, enabled ? '학습 기록 연결을 켰습니다.' : '학습 기록 연결을 껐습니다.');
          try { account.changed?.(); } catch { /* 런처가 다시 읽는다 */ }
        });
        return true;
      }
      // 연습 기록 내려받기와 마을 기록은 옛 내 계정 화면을 연다(설계 검토 D4). 돌아오면 이 방이다
      case 'export': case 'town': try { openOld?.(); } catch { /* 옛 런처의 일이다 */ } return true;
      case 'delete-ask': {
        if (!acc.data || acc.data.account?.status === 'deletion-requested') return true;
        if (!acc.askDelete) { acc.askDelete = true; acc.askAt = now(); }
        focusReq = ask({ key, ask: true });
        changed(); return true;
      }
      case 'delete-keep': acc.askDelete = false; focusReq = ask({ key, act: 'delete-ask' }); changed(); return true;
      case 'delete-send': {
        // 펼친 뒤 0.6초 안의 누름은 받지 않는다(설계 8.3). 「지우기 요청」과 다른 자리의 다른 단추다
        if (!acc.askDelete || now() - acc.askAt < ROOM_TIMING.armGuard) return true;
        await accAct(key, act, async my => {
          deleteRequestId ||= randomId();
          const res = await accCall('requestDeletion', { request_id: deleteRequestId }, my);
          acc.askDelete = false;
          const due = Date.parse(res?.request?.due_at || '');
          note(key, '삭제 요청을 받았습니다. ' + (Number.isFinite(due) ? dateTimeWords(due) + '까지는' : '7일 동안은') + ' 이 자리에서 취소할 수 있습니다.');
          try { account.changed?.(); } catch { /* 런처가 다시 읽는다 */ }
        });
        return true;
      }
      case 'delete-cancel': {
        const pending = pendingDeletion(acc.data);
        if (!pending) { note(key, ACCOUNT_SAY.REQUEST_NOT_FOUND); void accLoad({ quiet: true }); changed(); return true; }
        await accAct(key, act, async my => {
          await accCall('cancelDeletion', { request_id: pending.request_id }, my);
          deleteRequestId = null;
          note(key, '삭제 요청을 취소했습니다. 학습 기록 연결은 꺼 둔 채입니다.');
          try { account.changed?.(); } catch { /* 런처가 다시 읽는다 */ }
        });
        return true;
      }
      default: return false;
    }
  }

  /* 새 스냅숏이 들어올 때마다 로그인 단계를 본다. 이번에 끝난 로그인만 알린다(앱을 켜기 전에 끝난 것은 알리지 않는다) */
  function observe(snap) {
    const login = snap?.login || null, prev = lastLogin;
    lastLogin = login ? { id: login.id, stage: login.stage } : null;
    if (prev === undefined || !login || !ENDED.includes(login.stage)) return;
    if (prev && prev.id === login.id && prev.stage === login.stage) return;
    const re = st.relogin ? rowOf(snap, st.relogin) : null;
    const key = re && re.service === login.service ? manageKey(re) : 'add';
    st.ended = { id: login.id, stage: login.stage, key };
    if (login.stage === 'done') {
      if (key === 'add') {
        const text = (addInfo(login.service)?.nm || '') + ' 새 계정 줄을 더했습니다. 요금과 결제일은 그 줄을 열어 고칩니다.';
        st.add = { svc: '' }; st.roomNote = text; note('add', text); closeReq = ask({ key: 'add' });
      } else { st.relogin = null; note(key, '다시 연결했습니다. 바로 한 번 읽습니다.'); }
    } else if (login.stage === 'cancelled') {
      note(key, '로그인을 취소했습니다.');
      if (key !== 'add') st.relogin = null;
    }
  }

  /* 방을 열 때: 구독 줄에서 왔으면 그 구독의 첫 계정 줄, 손볼 계정이 있으면 그 계정 줄, 계정이 없으면 계정 더하기를 연 채 연다(설계 9.3) */
  function open(name, { svc = null } = {}) {
    close();
    current = name;
    if (name === 'manage') {
      const key = manageOpenKey(snapshot(), svc, now());
      openReq = key ? ask({ key }) : null;
    }
    // 내 계정은 열 때마다 읽는다. 앞에 읽은 자료가 있으면 그것을 보이며 조용히 읽는다
    if (name === 'account') void accLoad({ quiet: !!acc.data });
  }
  function close() {
    disarm();
    st.notes.clear(); st.roomNote = ''; st.grps.clear(); st.ended = null;
    acc.askDelete = false;
    focusReq = null; openReq = null; closeReq = null; current = null;
  }
  function reset() {
    gen += 1;
    accGen += 1;
    close();
    Object.assign(st, { add: { svc: '' }, relogin: null, kinds: {}, busy: null, tokAll: false });
    st.installing.clear();
    lastLogin = undefined; loginEmail = undefined;
    tokReset();
    acc = freshAcc(); deleteRequestId = null;
  }

  return {
    handle,
    observe,
    open,
    close,
    reset,
    disarm() { if (st.armed) { disarm(); changed(); } },
    armed: () => armedNow(),
    hasAccount: () => !!account,
    costRow: () => costRow(snapshot(), view(), now()),
    tokRow: () => tokRow(tok.state, view(), now()),
    tokStart,
    tokLoad,
    syncLive,
    accountChanged,
    /* ctx: { checking, name(로그인 정보의 이름), accountKey } */
    scene({ aside = null, checking = false, name = '', accountKey = '' } = {}) {
      const req = { focus: focusReq, opening: openReq, closing: closeReq };
      if (aside === 'manage') return { manage: { ...manageRoom(snapshot(), view(), now(), { checking, sentence }), ...req } };
      if (aside === 'account') return { account: { ...accountRoom(acc, view(), now(), { name, accountKey }), ...req } };
      return null;
    },
  };
}
