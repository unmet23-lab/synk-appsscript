// 솔리오 안쪽의 방(2단계 둘째 조각)의 상태와 동작. DOM이 없다. 컨트롤러(orb-face.mjs)가 만들고, 화면이 보낸 「room」 동작을 여기에 넘긴다.
// 설계: docs/디자인/플랫폼_클라이언트_검정구_20261116/2단계_둘째조각_구현설계.md 1.3절 · 3~6절 · 8절. 구독과 모델별 토큰은 옛 구독 판이 쓰던 다리(options.subscriptions)를,
// 내 계정은 런처가 넘기는 계정 어댑터(faceOptions.rooms.account, 뒤의 길은 옛 내 계정과 같은 다리)를, 설정은 런처가 넘기는 PC 어댑터(faceOptions.rooms의 desktop ·
// drafts · notices · updates · environment · copyDiagnostics, 뒤의 길은 옛 설정 화면과 같은 다리와 편의의 알림 통로)를 쓴다.
// 되돌릴 수 없는 일의 첫 누름(armed)은 1분 장면이 와도 지워지지 않게 화면이 아니라 여기에 둔다(설계 8.2).
import { manageRoom, costRow, tokRow, accountRoom, accountSay, checkName, dateTimeWords, ACCOUNT_SAY, ACCOUNT_CONFLICTS, CODE_SAY, codeSay, manageKey, manageOpenKey, addInfo, parseCost, parsePass, parseApi, parseFlow, parseFlowUsage, checkCreditTarget, parseManual, checkCode, checkKey, checkEmail, checkRate,
  settingsRoom, subTips, tipDoneWords, updateOf, updateAuto, checkShortcut, checkQuiet, desktopSay, ZOOMS, DIAG_SAY, DRAFT_SAY, careOn, CARE_SAY } from './solio-rooms.mjs';
import { isUsedUp, num, nameOf } from './subscriptions-model.mjs';
import { SOLIO_TODAY_NAMES, josa } from './solio-today.mjs';
import { profileChange, pendingDeletion } from './account-page.mjs';
import { briefLive, tokSample } from './solio-brief.mjs';
import { pcRoom } from './pc-fit-model.mjs';

/* 두 번 누르기의 막이(설계 8.2, 설계 검토 D1). 묻고 0.6초 안의 두 번째 누름은 받지 않고(더블클릭 · Enter 되풀이), 10초가 지나면 물음을 거둔다.
   account는 계정 요청 하나를 기다리는 한도(옛 내 계정과 같다), tokLive는 모델별 토큰 줄이 열린 동안 실시간을 다시 부탁하는 사이다(옛 구독 판과 같다) */
export const ROOM_TIMING = Object.freeze({ armGuard: 600, armExpire: 10000, account: 15000, tokLive: 60000, tokPaint: 1000 });
/* 펼침이나 구독 방에서 여는 방 */
export const ASIDE_ROOMS = Object.freeze(['manage', 'account', 'settings', 'pc']);
const UPDATE_METHOD = Object.freeze({ 'update-check': 'check', 'update-download': 'download', 'update-install': 'install' });
const PREF_KEYS = Object.freeze(['launchAtLogin', 'startHidden', 'closeToTray', 'uiSound']);
/* 알림 잠시 쉬기(옛 설정과 같은 30분 · 1시간 · 쉬지 않음) */
const REST_MINUTES = Object.freeze({ 30: 30, 60: 60, 0: 0 });
const hm = t => (d => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'))(new Date(t));
const TOK_RANGE_KEYS = Object.freeze(['today', 'week', 'month']);
/* 내 계정 방의 줄 열쇠. 계정이 바뀌면 이 줄들의 진행 표시를 지운다 */
const ACCOUNT_ROWS = Object.freeze(['name', 'login', 'places', 'data', 'del']);
/* 다른 일이 도는 동안 누른 되돌릴 수 없는 단추에 쓰는 글(검수 B) */
export const ROOM_BUSY_SAY = '다른 일을 마치는 중입니다. 잠시 뒤 다시 눌러 주세요.';
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
   confirmLeave: 모든 곳에서 로그아웃 전 쓰던 글 확인(런처의 confirmDraftExit). signOut: 이 PC 로그아웃. openOld: 옛 내 계정 화면을 연다(마을 기록 · 내려받기)
   pc: 설정 방의 어댑터 { desktop{get, update, onChange}, drafts{status, set, onChange}, notices{get, set}, care{status, configure, onChange}, updates{status, check, download, install, confirmInstall, onChange}, environment(), copyDiagnostics() }.
       없는 칸은 그 줄을 세우지 않는다 */
export function createOrbRooms({ subs = null, account = null, pc = {}, now = () => Date.now(), setTimer = globalThis.setTimeout, clearTimer = globalThis.clearTimeout, setTick = globalThis.setInterval, clearTick = globalThis.clearInterval, snapshot = () => null, accept = () => {}, reread = () => {}, copyText = null, changed = () => {}, sentence = s => s, confirmLeave = null, signOut = null, openOld = null, randomId = () => globalThis.crypto?.randomUUID?.() || Date.now().toString(16) + Math.random().toString(16).slice(2) } = {}) {
  const st = { armed: null, grps: new Set(), add: { svc: '' }, relogin: null, kinds: {}, installing: new Set(), busy: null, notes: new Map(), ended: null, roomNote: '', tokRange: 'week', tokAll: false, tipDone: new Map(), restChoice: '' };
  const dev = pc && typeof pc === 'object' ? pc : {};
  let gen = 0, armTimer = null, lastLogin, loginEmail;
  let focusReq = null, openReq = null, closeReq = null, seq = 0, current = null;
  /* 모델별 토큰(설계 3.4, 설계 검토 D8). 솔리오에 들어오면 한 번 읽고 알림을 듣는다. 실시간은 줄이 열려 보이는 동안만 부탁한다 */
  // samples · since: 구독 방의 「지금 출력」이 최근 10분을 세는 기억(솔리오 구독 비서 설계 검토 D8). 계정이 바뀌면 tok째 지워진다
  const freshTok = () => ({ state: null, loaded: false, loading: false, open: false, live: false, unsub: null, paint: null, painted: 0, timer: null, samples: [], since: null });
  let tok = freshTok();
  /* 내 계정(설계 5.4). 계정 세대(accGen)가 바뀌면 늦게 온 답을 버린다. 삭제 요청 id는 한 번 만들어 다시 보내도 같은 요청이 되게 한다(옛 251~262행) */
  const freshAcc = () => ({ data: null, identity: null, loading: false, error: '', identityError: false, allSessions: false, askDelete: false, askAt: 0 });
  let acc = freshAcc(), accGen = 0, deleteRequestId = null;
  /* 설정(설계 6.4). 방이 열릴 때 데스크톱 설정 · 쓰던 글 되살리기 · 업데이트 상태를 읽고, 열린 동안 바뀜 알림을 듣고, 닫으면 듣기를 뗀다.
     rev는 업데이트 판이 들어온 차례다. 동작을 보낸 뒤 알림으로 새 판이 먼저 오면 늦게 온 답으로 덮지 않는다(update-view.mjs와 같다).
     member는 방을 그릴 때 받은 「회원으로 보이는가」다. 손님에게 잠긴 칸(쓰던 글 되살리기, 구독 팁)은 동작도 받지 않는다 */
  const freshSet = () => ({ desktop: null, drafts: null, care: null, chatgpt: null, chatgptRead: 0, chatgptAction: null, closed: false, update: null, rev: 0, unsubs: [], member: false });
  let sets = freshSet();
  /* 「이 PC에 이렇게 맞췄습니다」(PC 진단 설계 5.2). 설정 방과 이 판을 열 때 본체가 잰 값을 읽는다(10분 넘은 값은 본체가 다시 잰다).
     판을 열어 「이 PC가 바뀌었습니다」를 보였으면 본체에 본 것으로 알리고, 판이 열린 동안은 그 글을 그대로 둔다(changedShown) */
  const freshPc = () => ({ snap: null, changedShown: null });
  let pcs = freshPc();
  function pcRead({ again = false, opened = false } = {}) {
    const api = dev.pcProfile, my = gen, box = pcs;
    if (!api) { box.snap = { ok: false }; changed(); return Promise.resolve(null); }
    return Promise.resolve().then(() => (again ? api.again() : api.snapshot())).then(v => {
      if (my !== gen || box !== pcs) return null;
      box.snap = v && typeof v === 'object' ? v : { ok: false };
      if (opened && current === 'pc' && Array.isArray(v?.changed) && v.changed.length) { box.changedShown = v.changed; Promise.resolve().then(() => api.seen()).catch(() => {}); }
      changed();
      return v;
    }, () => { if (my === gen && box === pcs) { box.snap = { ok: false }; changed(); } return null; });
  }
  async function pcAct(key, act) {
    const api = dev.pcProfile;
    if (!api) return true;
    if (st.busy) { if (key) refuseBusy(key); return true; }
    // 끝난 뒤 계정이 바뀌었거나(reset) 판을 닫았으면 그 뒤에 시작된 일과 다른 방의 알림을 건드리지 않는다(카본 A3)
    const my = gen, here = () => my === gen && current === 'pc';
    if (act === 'pc-again') {
      st.busy = 'pc:pc-again'; st.roomNote = ''; changed();
      await pcRead({ again: true });
      if (my === gen && st.busy === 'pc:pc-again') { st.busy = null; changed(); }
      return true;
    }
    if (act === 'pc-storage') {
      let res = null;
      try { res = await api.openStorage(); } catch { res = null; }
      if (!here()) return true;
      note(key, res?.ok === true ? 'Windows 설정을 열었습니다. 「새 콘텐츠를 저장할 위치」에서 고릅니다.' : '설정을 열지 못했습니다. Windows 설정의 시스템 → 저장소 → 고급 저장소 설정 → 「새 콘텐츠를 저장할 위치」에서 바꿉니다.');
      changed();
      return true;
    }
    return false;
  }

  const note = (key, text) => { if (text) st.notes.set(key, text); else st.notes.delete(key); };
  // 다른 일이 도는 동안 누른 단추는 보내지 않고 그 줄에 알린다. 그 줄 자신의 일이 도는 중이면(그 단추가 흐려져 있다) 알리지 않는다(검수)
  const refuseBusy = key => { if (st.busy && !st.busy.startsWith(key + ':')) { note(key, ROOM_BUSY_SAY); changed(); } };
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
    if (st.busy || !subs) { refuseBusy(key); return null; }
    const my = gen;
    st.busy = key + ':' + act;
    changed();
    let res;
    try { res = await task(); } catch { res = { ok: false }; }
    if (my !== gen) return null;
    st.busy = null;
    return res ?? { ok: true };
  }
  // Provider credit and Flow read error messages shared with CODE_SAY when mutable.
  const CREDIT_CODE_SAY = {
    CREDIT_SOURCE_UNKNOWN: '공식 화면에서 읽을 위치를 찾지 못했습니다. 아래 혜택이나 Flow 칸에서 공식 화면을 열어 직접 적어 저장해 주세요.',
    CREDIT_WRONG_ACCOUNT: '열린 브라우저 계정이 이 줄의 이메일과 다릅니다. 같은 이메일로 로그인한 뒤 다시 읽거나 공식 화면을 열어 직접 적어 주세요.',
    CREDIT_SIGN_IN: '공식 화면 로그인이 필요합니다. 같은 이메일로 다시 로그인한 뒤 읽거나 공식 화면을 열어 직접 적어 주세요.',
    CREDIT_BROWSER_UNAVAILABLE: '지금 이 PC에서 확인용 브라우저를 열 수 없습니다. 같은 이메일로 로그인한 브라우저에서 공식 화면을 열어 직접 적어 저장해 주세요.',
    CREDIT_CHECK_BUSY: '다른 공식 화면 확인이 이미 진행 중입니다. 잠시 뒤 다시 눌러 주세요.',
  };
  try { Object.assign(CODE_SAY, CREDIT_CODE_SAY); } catch {}
  function parseCreditReadArg(raw) {
    if (typeof raw !== 'string' || !raw) return null;
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch { return null; }
    if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 2) return null;
    if (typeof parsed[0] !== 'string') return null;
    if (parsed.length === 2 && typeof parsed[1] !== 'string') return null;
    const email = parsed[0].trim();
    if (!email || !email.includes('@')) return null;
    const plan = typeof parsed[1] === 'string' ? parsed[1] : '';
    return { email, plan };
  }
  function failed(key, res) {
    const code = failCode(res);
    note(key, CREDIT_CODE_SAY[code] || codeSay(code));
    changed();
  }
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
    const prev = tok.state;
    tok.state = value;
    if (tok.live) tok.samples = tokSample(tok.samples, value, prev, now());
    // 실시간 알림은 에이전트가 여럿 돌면 1초에 몇 번씩 온다. 첫 알림은 바로 그리고, 1초 안에 잇따르는 알림은 모아 한 번만 그린다(솔리오 구독 비서 설계 검토 D7)
    if (!value.scanning && !(tok.live && now() - tok.painted < ROOM_TIMING.tokPaint)) { if (tok.paint !== null) { clearTimer(tok.paint); tok.paint = null; } tok.painted = now(); changed(); return; }
    // 세는 동안 알림이 0.5초마다 와도 줄은 1초에 한 번까지만 다시 그린다(옛 구독 판 규칙)
    if (tok.paint === null) tok.paint = setTimer(() => { tok.paint = null; tok.painted = now(); changed(); }, ROOM_TIMING.tokPaint);
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
  /* 그릴 때마다 컨트롤러가 부른다. 구독 방이 보이고 켜져 있을 때 실시간을 부탁한다. 처음에는 모델별 토큰 줄이 열린 동안만이었고,
     11-20부터 구독 방 맨 위의 「지금 출력」이 늘 보이므로 방이 보이는 동안으로 넓혔다(솔리오 구독 비서 설계 3.3) */
  function syncLive(visible, shown = false) {
    // 맨 위 「지금 출력」이 보이거나(shown) 모델별 토큰 줄이 열렸을 때만이다. 구독이 없거나 자료를 읽기 전에는 그 줄이 보이지 않는다(화면 검수 A10)
    const want = !!visible && (shown || tok.open) && tok.state?.enabled === true && !!subs;
    if (want === tok.live) return;
    tok.live = want;
    if (want) {
      // 켤 때마다 최근 10분 기억을 새로 시작한다. 꺼져 있던 동안 쌓인 몫이 「최근 10분」에 들어가지 않게(설계 검토 D8)
      tok.since = now(); tok.samples = tokSample([], tok.state, null, now());
      tokTick(); if (typeof setTick === 'function') tok.timer = setTick(tokTick, ROOM_TIMING.tokLive);
    } else { tok.since = null; tok.samples = []; if (tok.timer !== null) { clearTick?.(tok.timer); tok.timer = null; } void tokLiveCall(false); }
  }
  function tokReset() {
    try { tok.unsub?.(); } catch { /* 무시 */ }
    if (tok.paint !== null) clearTimer(tok.paint);
    if (tok.timer !== null) clearTick?.(tok.timer);
    // 실시간을 거두는 부탁만 보내고 답은 버린다. 새 세대(gen)로 받으면 앞 계정의 토큰이 새 계정의 줄에 다시 찬다(검수 B)
    if (tok.live && typeof subs?.tokensLive === 'function') { try { void Promise.resolve(subs.tokensLive(false)).catch(() => {}); } catch { /* 본체가 3분 뒤 스스로 멈춘다 */ } }
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
  /* 시작했으면 true다. 다른 일이 돌거나 읽는 중이면 시작하지 않고 false다.
     막이(st.busy)는 이 일이 건 것만 푼다. 다시 읽는 동안 다른 방에서 시작한 일의 막이를 지우지 않는다(검수 B) */
  async function accAct(key, act, task, { reload = true } = {}) {
    if (!account) return false;
    if (st.busy || acc.loading) { if (st.busy) refuseBusy(key); else { note(key, ROOM_BUSY_SAY); changed(); } return false; }
    const my = accGen, tag = key + ':' + act;
    const release = () => { if (st.busy === tag) st.busy = null; };
    st.busy = tag;
    changed();
    try {
      await task(my);
      if (my !== accGen) return true;
      release();
      // 바뀐 뒤에는 다른 줄에 남은 앞의 알림을 거둔다(삭제 요청 뒤의 「학습 기록 연결을 켰습니다.」처럼 사실과 어긋날 수 있다)
      for (const k of ACCOUNT_ROWS) if (k !== key) st.notes.delete(k);
      if (reload) await accLoad({ quiet: true });
    } catch (error) {
      if (my !== accGen || error?.code === 'changed') return true;
      release();
      if (ACCOUNT_CONFLICTS.includes(error?.code)) await accLoad({ quiet: true });
      if (my !== accGen) return true;
      note(key, accountSay(error?.code, error?.retryable));
    } finally {
      if (my === accGen) { release(); changed(); }
    }
    return true;
  }
  /* 런처가 계정 생명주기에서 부른다(같은 사람의 새 세션 포함). 보이던 자료와 오는 중인 답을 버리고, 방이 열려 있으면 다시 읽는다 */
  // 플레저 PC 알림 줄에 마지막으로 쓴 말. 계정마다라 계정이 바뀌면 그 말만 거둔다(카본 검수 C1). 같은 줄의 알림 배너 · 조용한 시간 말은 PC 설정이라 남긴다
  let careNote = '';
  function accountChanged() {
    accGen += 1;
    acc = freshAcc();
    deleteRequestId = null;
    // 쓰던 글 되살리기(draft)도 계정마다라 같이 거둔다(검수 B)
    if (st.busy && (ACCOUNT_ROWS.includes(st.busy.split(':')[0]) || st.busy === 'draft:draft' || st.busy === 'notice:care')) st.busy = null;
    if (st.armed && ACCOUNT_ROWS.includes(st.armed.key)) disarm();
    for (const k of ACCOUNT_ROWS) st.notes.delete(k);
    st.notes.delete('draft');
    st.notes.delete('chatgpt');
    sets.chatgptAction = null;
    if (typeof st.busy === 'string' && st.busy.startsWith('chatgpt:')) st.busy = null;
    if (careNote && st.notes.get('notice') === careNote) st.notes.delete('notice');
    careNote = '';
    if (current === 'account') void accLoad();
    // 쓰던 글 되살리기는 계정마다 따로다. 설정 방이 열려 있으면 새 계정의 상태를 다시 읽는다
    // 플레저 PC 알림도 계정마다다(본체가 계정마다 따로 저장한다)
    if (current === 'settings') { sets.drafts = null; sets.care = null; sets.chatgpt = null; sets.chatgptRead++; readDrafts(); readCare(); void readChatGPT(); }
    changed();
  }

  /* ── 설정(설계 6.4) ── */
  const envNow = () => { try { const e = dev.environment?.(); return e && typeof e === 'object' ? e : null; } catch { return null; } };
  const noticesNow = () => { try { const n = dev.notices?.get?.(); return n && typeof n === 'object' ? n : null; } catch { return null; } };
  function takeUpdate(value, s = sets) {
    const next = updateOf(value);
    if (!next || s !== sets) return false;
    s.update = next;
    s.rev += 1;
    changed();
    return true;
  }
  function readDrafts() {
    if (typeof dev.drafts?.status !== 'function') return;
    const my = gen, a = accGen, s = sets;
    Promise.resolve().then(() => dev.drafts.status()).then(v => { if (my === gen && a === accGen && s === sets) { s.drafts = v && typeof v === 'object' ? v : { ok: false }; changed(); } }, () => { if (my === gen && a === accGen && s === sets) { s.drafts = { ok: false }; changed(); } });
  }
  /* 플레저 PC 알림(PC 0.5.0 설계 4.5 R7). 본체가 「쓸 수 있음」과 로그인을 함께 알려 줄 때만 알림 줄 안쪽에 켜고 끄기가 선다 */
  function readCare() {
    if (typeof dev.care?.status !== 'function') return;
    const my = gen, a = accGen, s = sets;
    Promise.resolve().then(() => dev.care.status()).then(v => { if (my === gen && a === accGen && s === sets) { s.care = v && typeof v === 'object' ? v : { ok: false }; changed(); } }, () => { if (my === gen && a === accGen && s === sets) { s.care = { ok: false }; changed(); } });
  }
  const CHATGPT_ALLOWED = {
    disconnected: ['connect'],
    connecting: ['cancel'],
    connected: ['disconnect'],
    recheck: ['connect', 'disconnect'],
    'storage-error': ['disconnect']
  };
  const CHATGPT_FAIL_NOTES = {
    NETWORK: 'OpenAI에 연결하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.',
    TIMEOUT: '로그인 시간이 지났습니다. 다시 시도해 주세요.',
    BROWSER_UNAVAILABLE: '기본 브라우저를 열지 못했습니다. Windows 기본 앱 설정을 확인한 뒤 다시 시도해 주세요.',
    CALLBACK_UNAVAILABLE: '로그인 응답 주소를 열지 못했습니다. 잠시 후 다시 시도해 주세요.',
    IDENTITY_INVALID: 'ChatGPT 계정 정보를 확인하지 못했습니다. 다시 로그인해 주세요.',
    DIFFERENT_ACCOUNT: '이전에 연결한 ChatGPT 계정과 다릅니다. 같은 계정으로 로그인하거나 먼저 이 기기의 연결을 해제해 주세요.',
    SIGN_IN_FAILED: 'OpenAI에서 로그인을 마치지 못했습니다. 다시 시도해 주세요.',
    CONSENT_DENIED: '로그인을 취소했거나 동의를 마치지 않았습니다. 다시 시도할 수 있습니다.',
    STORAGE_UNAVAILABLE: 'Windows 보안 저장소를 사용할 수 없습니다. 저장소 상태를 확인한 뒤 다시 시도해 주세요.',
    STORAGE_CORRUPTED: 'Windows 보안 저장소의 연결 기록이 손상되었습니다. 이 기기의 연결을 해제한 뒤 다시 연결해 주세요.',
    STORAGE_READ_FAILED: 'Windows 보안 저장소에서 연결 기록을 읽지 못했습니다. 이 기기의 연결을 해제한 뒤 다시 시도해 주세요.',
    STORAGE_WRITE_FAILED: 'Windows 보안 저장소에 연결 기록을 저장하지 못했습니다. 저장소 상태를 확인한 뒤 다시 시도해 주세요.',
    DPAPI_FAILED: 'Windows 암호화 저장소를 처리하지 못했습니다. Windows 로그인 상태를 확인한 뒤 다시 시도해 주세요.',
    STATE_MISMATCH: '로그인 보안 확인이 일치하지 않습니다. 다시 시도해 주세요.',
    OAUTH_STATE_MISMATCH: '로그인 보안 확인이 일치하지 않습니다. 다시 시도해 주세요.',
    TOKEN_EXCHANGE_FAILED: 'OpenAI 인증 확인을 마치지 못했습니다. 잠시 후 다시 시도해 주세요.',
    BUSY: '이미 연결 작업이 진행 중입니다. 잠시만 기다려 주세요.',
    INVALID_STATE: '연결 상태가 바뀌었습니다. 현재 상태를 확인한 뒤 다시 시도해 주세요.'
  };
  function chatgptFailNote(op, code) {
    if (op === 'disconnect') return '이 기기의 연결을 해제하지 못했습니다. 다시 시도해 주세요.';
    if (op === 'cancel') return '로그인 취소를 마치지 못했습니다. 연결 상태를 확인해 주세요.';
    if (op === 'connect' && code && CHATGPT_FAIL_NOTES[code]) return CHATGPT_FAIL_NOTES[code];
    return 'ChatGPT 연결 요청을 마치지 못했습니다. 다시 시도해 주세요.';
  }
  async function readChatGPT() {
    if (typeof dev.chatgpt?.status !== 'function') return;
    const my = gen, owner = accGen, s = sets, revision = ++s.chatgptRead;
    let next;
    try {
      next = await dev.chatgpt.status();
    } catch {
      next = { ok: true, state: 'unavailable' };
    }
    if (my !== gen || owner !== accGen || s !== sets || s.closed || revision !== s.chatgptRead) return;
    if (next && typeof next === 'object') {
      if (next.code === 'ACCOUNT_CHANGED' || next.code === 'STALE_ACCOUNT') return;
      s.chatgpt = next.ok === true ? next : { ok: true, state: 'unavailable', code: next.code || '' };
    } else {
      s.chatgpt = { ok: true, state: 'unavailable' };
    }
    if (s.chatgpt.state === 'connected' || s.chatgpt.state === 'connecting') st.notes.delete('chatgpt');
    changed();
  }
  async function actChatGPT(key, act) {
    if (key !== 'chatgpt' || current !== 'settings' || !sets.member) return;
    const op = act.slice('chatgpt-'.length);
    const curState = sets.chatgpt?.state;
    const canCancelBusy = op === 'cancel' && st.busy === 'chatgpt:connect';
    if (!(canCancelBusy || CHATGPT_ALLOWED[curState]?.includes(op)) || typeof dev.chatgpt?.[op] !== 'function') return;
    if (st.busy && !canCancelBusy) { refuseBusy(key); return; }
    const my = gen, owner = accGen, s = sets, ticket = Symbol('chatgpt');
    s.chatgptAction = ticket;
    s.chatgptRead++;
    st.busy = 'chatgpt:' + op;
    note('chatgpt', '');
    changed();
    let errNote = '';
    try {
      const result = await dev.chatgpt[op]();
      if (result?.ok === false && result.code !== 'CANCELLED' && result.code !== 'CANCELED' && result.code !== 'ACCOUNT_CHANGED' && result.code !== 'STALE_ACCOUNT') {
        errNote = chatgptFailNote(op, result.code);
      }
    } catch {
      errNote = chatgptFailNote(op, '');
    } finally {
      if (my === gen && owner === accGen && s === sets && !s.closed && s.chatgptAction === ticket) {
        await readChatGPT();
      }
      if (s.chatgptAction === ticket && st.busy === 'chatgpt:' + op) {
        st.busy = null;
      }
      if (my === gen && owner === accGen && s === sets && !s.closed && s.chatgptAction === ticket) {
        if (errNote) note('chatgpt', errNote);
        changed();
      }
    }
  }
  function setStart() {
    const my = gen, s = sets;
    s.unsubs.push(() => {
      s.closed = true;
      s.chatgptAction = null;
      st.notes.delete('chatgpt');
      if (typeof st.busy === 'string' && st.busy.startsWith('chatgpt:')) st.busy = null;
    });
    if (typeof dev.desktop?.get === 'function') Promise.resolve().then(() => dev.desktop.get()).then(v => { if (my === gen && s === sets && v?.ok === true) { s.desktop = v; changed(); } }, () => {});
    readDrafts();
    readCare();
    void readChatGPT();
    if (typeof dev.updates?.status === 'function') {
      const start = s.rev;
      Promise.resolve().then(() => dev.updates.status()).then(v => { if (my === gen && s === sets && s.rev === start && !takeUpdate(v, s)) takeUpdate({ ...(s.update || {}), state: 'error', code: 'UPDATE_UNAVAILABLE' }, s); },
        () => { if (my === gen && s === sets && s.rev === start) takeUpdate({ ...(s.update || {}), state: 'error', code: 'UPDATE_UNAVAILABLE' }, s); });
    }
    const listen = (on, fn) => { try { const off = on(fn); if (typeof off === 'function') s.unsubs.push(off); } catch { /* 듣지 못하면 열 때 읽은 값으로 둔다 */ } };
    if (typeof dev.desktop?.onChange === 'function') listen(dev.desktop.onChange, v => { if (s === sets && v?.ok === true) { s.desktop = v; changed(); } });
    if (typeof dev.chatgpt?.onChange === 'function') listen(dev.chatgpt.onChange, () => { if (my === gen && s === sets && !s.closed) void readChatGPT(); });
    if (typeof dev.drafts?.onChange === 'function') listen(dev.drafts.onChange, () => { if (s === sets) readDrafts(); });
    if (typeof dev.care?.onChange === 'function') listen(dev.care.onChange, () => { if (s === sets) readCare(); });
    if (typeof dev.updates?.onChange === 'function') listen(dev.updates.onChange, v => { takeUpdate(v, s); });
  }
  function setStop() { for (const off of sets.unsubs) { try { off(); } catch { /* 무시 */ } } sets = freshSet(); }
  /* 업데이트 동작(update-view.mjs run과 같은 규칙). 설치는 쓰던 글 확인(런처의 confirmUpdateInstall)을 먼저 거치고, 그사이 판이 바뀌었으면 보내지 않는다 */
  async function updateRun(act) {
    const u = dev.updates, s = sets, cur = s.update, platform = envNow()?.platform || '';
    if (u && cur && st.busy) { refuseBusy('update'); return; }
    if (!u || !cur || st.busy || ['disabled', 'checking', 'downloading', 'opening'].includes(cur.state) || (cur.state === 'ready' && updateAuto(cur, platform))) return;
    if ((act === 'update-download' && cur.state !== 'available') || (act === 'update-install' && cur.state !== 'ready')) return;
    const method = UPDATE_METHOD[act];
    if (typeof u[method] !== 'function') return;
    const my = gen;
    st.busy = 'update:' + act;
    changed();
    let start = s.rev;
    try {
      if (act === 'update-install') {
        let go = false;
        try { go = typeof u.confirmInstall === 'function' ? (await u.confirmInstall()) === true : false; } catch { go = false; }
        if (!go || my !== gen || s !== sets || s.update?.state !== 'ready' || s.rev !== start) return;
      }
      start = s.rev;
      const result = await u[method]();
      if (my !== gen || s !== sets || s.rev !== start) return;
      if (!takeUpdate(result, s) && result?.ok === false) takeUpdate({ ...s.update, state: 'error', code: result.code || result.error?.code }, s);
      else if (!result?.state && !result?.status && typeof u.status === 'function') { const v = await u.status(); if (s.rev === start) takeUpdate(v, s); }
    } catch {
      if (my === gen && s === sets && s.rev === start) takeUpdate({ ...s.update, state: 'error', code: act === 'update-install' ? 'INSTALL_OPEN_FAILED' : 'UPDATE_UNAVAILABLE' }, s);
    } finally {
      if (my === gen) { st.busy = null; changed(); }
    }
  }
  /* 데스크톱 설정 한 칸을 바꾼다. 본체가 바꾼 판을 돌려주고, 바뀜 알림으로도 같은 판이 온다 */
  async function deskUpdate(key, act, patch, okText = '') {
    if (typeof dev.desktop?.update !== 'function') return;
    if (st.busy) { refuseBusy(key); return; }
    const my = gen, s = sets;
    st.busy = key + ':' + act;
    changed();
    let res;
    try { res = await dev.desktop.update(patch); } catch { res = { ok: false }; }
    if (my !== gen) return;
    st.busy = null;
    if (res?.ok === true) { if (s === sets) s.desktop = res; note(key, okText); } else note(key, desktopSay(res?.code, patch));
    changed();
  }
  /* 알림 설정은 편의(convenience.mjs)의 통로로 바꾼다. 편의가 저장하고 배너 판단에 바로 쓴다(설계 6.4) */
  function noticeSet(key, patch) {
    if (typeof dev.notices?.set !== 'function') return null;
    let n = null;
    try { n = dev.notices.set(patch); } catch { n = null; }
    if (!n || typeof n !== 'object') { note(key, '알림 설정을 바꾸지 못했습니다. 잠시 뒤 다시 해 주세요.'); changed(); return null; }
    changed();
    return n;
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
    const isGeminiSvc = (svc) => String(svc || '').trim().toLowerCase() === 'gemini';
    const rowUsageOff = Boolean(row && (isGeminiSvc(row.service) || row.usageDisabled));
    const addGemini = isGeminiSvc(arg || (key === 'add' ? st.add.svc : ''));
    if (act !== 'grp' && act !== 'kind-pick') note(key, '');
    if (act === 'pc-again' || act === 'pc-storage') return pcAct(key, act);
    switch (act) {
      case 'add-pick': {
        if (st.add.svc !== arg) { st.add = { svc: addInfo(arg) ? arg : '' }; delete st.kinds.add; st.ended = null; }
        // 진행 중인 로그인이 없으면 앞서 누른 「다시 로그인」은 끝난 것으로 본다(Typecast 키 줄은 로그인 없이 기다린다)
        if (!loginNow()) st.relogin = null;
        changed(); return true;
      }
      case 'kind-pick': st.kinds[key] = arg; focusReq = ask({ key, act, arg }); changed(); return true;
      case 'grp': {
        const name = key + ':' + arg;
        if (st.grps.has(name)) { st.grps.delete(name); focusReq = ask({ key, act: 'grp', arg }); } else { st.grps.add(name); focusReq = ask({ key, grp: arg }); }
        changed(); return true;
      }
      case 'install': {
        if (rowUsageOff || addGemini) return true;
        const res = await run(key, act, () => subs.install(arg));
        if (res === null) return true;
        if (res.ok === false) return failed(key, res), true;
        st.installing.add(arg);
        note(key, (addInfo(arg)?.tool || '') + ' 설치 창을 열었습니다. 끝날 때까지 창을 닫지 말고 기다린 뒤 「다시 확인」을 눌러 주세요.');
        changed(); return true;
      }
      case 'recheck-tools': {
        if (rowUsageOff || addGemini) return true;
        const res = await run(key, act, () => subs.snapshot({ refreshTools: true }));
        if (res === null) return true;
        if (!hasRows(res)) return failed(key, res), true;
        accept(res);
        const ok = !!res.tools?.[arg]?.installed;
        if (ok) st.installing.delete(arg);
        note(key, ok ? (addInfo(arg)?.tool || '') + '가 설치된 것을 확인했습니다.' : '아직 설치를 찾지 못했습니다. 설치가 끝난 뒤 다시 확인해 주세요.');
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
        if (rowUsageOff || addGemini) return true;
        const res = await run(key, act, () => subs.useExisting(arg));
        if (res === null) return true;
        if (res.ok === false) return failed(key, res), true;
        if (res.snapshot) accept(res.snapshot);
        const text = (addInfo(arg)?.nm || '') + ' 계정을 연결했습니다. 바로 한 번 읽었습니다.';
        st.add = { svc: '' }; st.roomNote = text; note('add', text); closeReq = ask({ key: 'add' });
        changed(); return true;
      }
      case 'login': case 'console-login': {
        if (rowUsageOff || addGemini) return true;
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
        // 바꿔 끼울 계정은 키를 넣은 그 줄이다. 「계정 더하기」에서 넣은 키는 새 계정이고, 앞서 누른 「다시 로그인」(st.relogin)을 따라가지 않는다(검수 B)
        const own = key === 'add' ? null : idOf(key);
        const replace = own && rowOf(snap, own)?.service === arg ? own : null;
        // 다른 줄의 브라우저 로그인이 도는 중이면 그 줄을 알아보는 표시(st.relogin)를 남긴다(다시 검수 FA1)
        if (key === 'add' && !loginNow()) st.relogin = null;
        const res = await run(key, act, () => subs.connectKey(arg, k.value, replace ? { replace } : {}));
        if (res === null) { changed(); return true; }
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
        if (!row || rowUsageOff || isGeminiSvc(arg)) return true;
        st.relogin = row.id; st.ended = null;
        if (row.service === 'typecast') { focusReq = ask({ key, field: 'key' }); changed(); return true; }
        loginEmail = row.service === 'claude' ? row.email || undefined : undefined;
        const res = await run(key, act, () => subs.login(row.service, { email: loginEmail }));
        if (res === null) return true;
        if (res.ok === false) { st.relogin = null; return failed(key, res), true; }
        changed(); return true;
      }
      case 'reread-one': {
        if (!row || rowUsageOff || isGeminiSvc(arg)) return true;
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
      case 'read-credit-flow': return true;
      case 'read-credit-api': {
        if (!row || rowUsageOff || isGeminiSvc(arg)) return true;
        const creditArg = parseCreditReadArg(arg);
        if (!creditArg) {
          note(key, CREDIT_CODE_SAY.CREDIT_SOURCE_UNKNOWN);
          changed();
          return true;
        }
        await save(
          key,
          act,
          { creditRead: { kind: 'api', id: row.id, email: creditArg.email, plan: creditArg.plan } },
          () => saved(key, '', '공식 화면에서 혜택 연결 상태를 읽었습니다.'),
        );
        return true;
      }
      case 'pass-used': {
        if (!row) return true;
        const left = Math.max(0, (num(row.passCount) || 0) - 1);
        const res = await save(key, act, { row: { id: row.id, passCount: left, ...(left ? {} : { passUntil: null }) } });
        if (!res) return true;
        saved(key, null, left ? '초기화권을 1장 줄였습니다. ' + left + '장 남았습니다.' : '초기화권을 다 썼습니다.');
        // 쓴 직후 그 계정만 다시 읽어 막힘과 풀리는 때가 바로 바뀌게 한다(옛 판 298행). 그사이 계정이 바뀌었으면 답을 버린다(검수 B)
        const my = gen;
        let c = null;
        try { c = await subs.check?.([row.id]); } catch { c = null; }
        if (my === gen && hasRows(c)) accept(c);
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
      case 'save-benefit': {
        const g = checkCreditTarget(row, arg, 'api');
        if (!g.ok) { const s = codeSay(g.code); note(key, s); if (!row) st.roomNote = s; changed(); return true; }
        await save(key, act, { creditCheck: { kind: 'api', id: row.id, email: g.email, plan: g.plan, status: g.status } }, () => saved(key, 'benefit'));
        return true;
      }
      case 'save-flow-usage': {
        const g = checkCreditTarget(row, arg, 'flow');
        if (!g.ok) { const s = codeSay(g.code); note(key, s); if (!row) st.roomNote = s; changed(); return true; }
        const v = parseFlowUsage(fields, t);
        if (!v.ok) { note(key, v.say); changed(); return true; }
        await save(key, act, { creditCheck: { kind: 'flow', id: row.id, email: g.email, plan: g.plan, from: v.from, to: v.to, used: v.used } }, () => saved(key, 'flow-usage'));
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
        // 다른 일이 도는 동안은 물음을 바꾸지 않는다. 두 번째 누름이 물음만 거두고 말없이 버려지지 않게 한다(검수 B)
        if (st.busy) { note(key, ROOM_BUSY_SAY); changed(); return true; }
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
        // 구독 줄의 팁은 반응한 뒤에도 그 줄에 남아 반응 뒤의 한 줄을 보인다(옛 구독 판의 answered와 같다). 요금 줄의 연간 결제 팁은 쉬는 동안 빠진다
        await save(key, act, { tip: { key: tipKey, action } }, res => { st.tipDone.set(tipKey, action); saved(key, null, tipDoneWords(action, res?.settings, tipKey)); });
        return true;
      }
      /* ── 설정(설계 6.4, 설계 검토 D7 · D9) ── */
      case 'chatgpt-connect': case 'chatgpt-cancel': case 'chatgpt-disconnect': await actChatGPT(key, act); return true;
      case 'update-check': case 'update-download': case 'update-install': await updateRun(act); return true;
      case 'pref': {
        const p = sets.desktop?.preferences;
        // 트레이로 시작은 자동 시작이 켜져 있을 때만 바꾼다
        if (!p || !PREF_KEYS.includes(arg) || (arg === 'startHidden' && p.launchAtLogin !== true)) return true;
        await deskUpdate(key, act, { [arg]: p[arg] !== true });
        return true;
      }
      case 'shortcut-apply': {
        const v = checkShortcut(fields.shortcut);
        if (!v.ok) { note(key, v.say); changed(); return true; }
        if (v.value === String(sets.desktop?.preferences?.globalShortcut || '')) { note(key, '지금 쓰는 단축키와 같습니다.'); changed(); return true; }
        await deskUpdate(key, act, { globalShortcut: v.value }, '단축키를 바꿨습니다.');
        return true;
      }
      case 'shortcut-off': if (sets.desktop?.preferences?.globalShortcut) await deskUpdate(key, act, { globalShortcut: '' }, '단축키를 껐습니다.'); return true;
      case 'zoom': { const z = Number(arg); if (ZOOMS.includes(z)) await deskUpdate(key, act, { zoomFactor: z }); return true; }
      case 'notice': {
        const n = noticesNow();
        if (n && (arg === 'banners' || arg === 'schedule')) noticeSet(key, { [arg]: n[arg] !== true });
        return true;
      }
      case 'quiet-save': {
        const v = checkQuiet(fields);
        if (!v.ok) { note(key, v.say); changed(); return true; }
        const n = noticeSet(key, v.value);
        if (n) saved(key, 'quiet', n.schedule ? '저장했습니다.' : '저장했습니다. 조용한 시간을 켜면 이 시각에 배너를 띄우지 않습니다.');
        return true;
      }
      case 'rest': {
        if (!Object.hasOwn(REST_MINUTES, arg)) return true;
        const m = REST_MINUTES[arg], until = m ? t + m * 60000 : 0;
        if (!noticeSet(key, { mutedUntil: until })) return true;
        st.restChoice = m ? arg : '';
        note(key, m ? hm(until) + '까지 배너를 띄우지 않습니다.' : '배너를 다시 띄웁니다.');
        changed(); return true;
      }
      case 'tips': {
        const s = snap?.ok !== false ? snap : null;
        if (!s?.settings || !sets.member) return true;
        const off = s.settings.tipsOff === true;
        await save(key, act, { settings: { tipsOff: !off } }, () => saved(key, null, off ? '구독 팁을 켰습니다.' : '구독 팁을 껐습니다. 구독 줄과 요금 줄에 팁을 띄우지 않습니다.'));
        return true;
      }
      case 'draft': {
        const d = sets.drafts;
        if (typeof dev.drafts?.set !== 'function' || !(d?.ok === true && d.available === true) || !sets.member) return true;
        if (st.busy) { refuseBusy(key); return true; }
        const my = gen, a = accGen, s = sets;
        st.busy = 'draft:draft';
        changed();
        let res;
        try { res = await dev.drafts.set(d.enabled !== true); } catch { res = { ok: false }; }
        if (my !== gen) return true;
        // 이 요청이 건 막이만 푼다. 계정이 바뀐 뒤 새 계정에서 다시 누른 요청의 막이를 앞 요청의 늦은 답이 풀지 않는다(다시 검수 FA3)
        if (st.busy === 'draft:draft' && a === accGen) st.busy = null;
        // 그사이 계정이 바뀌었거나 방을 닫았으면 앞 요청의 결과(실패 글 포함)를 새 화면에 쓰지 않는다(검수 B)
        if (a !== accGen || s !== sets) { changed(); return true; }
        if (res?.ok === true) s.drafts = res; else note(key, DRAFT_SAY);
        changed(); return true;
      }
      case 'care': {
        const c = sets.care;
        if (typeof dev.care?.configure !== 'function' || !careOn(c) || !sets.member) return true;
        if (st.busy) { refuseBusy(key); return true; }
        const my = gen, a = accGen, s = sets, enabled = c.enabled !== true;
        st.busy = 'notice:care';
        changed();
        let res;
        try { res = await dev.care.configure({ enabled }); } catch { res = { ok: false }; }
        if (my !== gen) return true;
        if (st.busy === 'notice:care' && a === accGen) st.busy = null;
        if (a !== accGen || s !== sets) { changed(); return true; }
        if (res?.ok === true) { s.care = res; careNote = res.enabled === true ? '플레저 PC 알림을 켰습니다.' : '플레저 PC 알림을 껐습니다.'; note(key, careNote); }
        else { careNote = CARE_SAY[res?.code] || CARE_SAY.no; note(key, careNote); readCare(); }
        changed(); return true;
      }
      // 문제 알리기용 정보: 편의와 같은 셈(safeDiagnostics)으로 버전과 연결 상태만 복사한다. 결과는 맨 아래 작은 줄에 쓴다
      case 'diag-copy': {
        if (st.busy) return true;
        st.busy = 'settings:diag-copy';
        changed();
        let ok = false;
        const my = gen;
        try { ok = typeof dev.copyDiagnostics === 'function' ? (await dev.copyDiagnostics()) === true : false; } catch { ok = false; }
        if (my !== gen) return true;
        st.busy = null;
        if (current === 'settings') st.roomNote = ok ? DIAG_SAY.ok : DIAG_SAY.no;
        changed(); return true;
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
        if (st.busy) { note(key, ROOM_BUSY_SAY); changed(); return true; }
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
        // 보낼 수 없는 때(다른 일이 돌거나 계정을 다시 읽는 중)는 묻기 전에 알린다. 두 번 누르고 확인까지 한 뒤 말없이 버리지 않는다(검수 B)
        if (!account) return true;
        if (st.busy || acc.loading) { note(key, ROOM_BUSY_SAY); changed(); return true; }
        const step = twice(key, act);
        if (step !== 'go') { if (step === 'ask') changed(); return true; }
        // 이 PC도 바로 로그아웃되므로, 쓰던 글이 있으면 펼침의 「로그아웃」과 같은 확인을 거친다(설계 8.3, 설계 검토 D1). 묻는 동안 다른 일을 막는다
        const my = accGen, hold = key + ':confirm';
        st.busy = hold;
        changed();
        let go = true;
        try { go = typeof confirmLeave === 'function' ? (await confirmLeave()) !== false : true; } catch { go = false; }
        if (st.busy === hold) st.busy = null;
        if (my !== accGen || !go) { changed(); return true; }
        // 본체가 이 PC의 로그인도 끝내므로 곧 묻는 화면으로 돌아간다. 알림은 옛 화면처럼 런처가 띄운다
        const started = await accAct(key, act, async g => { await accCall('revokeAll', {}, g); note(key, '모든 곳에서 로그아웃했습니다.'); try { account.signedOutAll?.(); } catch { /* 알림만 못 띄운다 */ } }, { reload: false });
        if (!started) { note(key, ROOM_BUSY_SAY); changed(); }
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
    // 알림 글과 방 맨 아래 글은 계정 관리 방이 열려 있을 때만 쓴다. 다른 방(설정 등)의 맨 아래 글 자리에 끼어들지 않는다(검수 B)
    const here = current === 'manage';
    st.ended = here ? { id: login.id, stage: login.stage, key } : null;
    if (login.stage === 'done') {
      if (key === 'add') {
        const text = (addInfo(login.service)?.nm || '') + ' 새 계정 줄을 더했습니다. 요금과 결제일은 그 줄을 열어 고칩니다.';
        st.add = { svc: '' };
        if (here) { st.roomNote = text; note('add', text); closeReq = ask({ key: 'add' }); }
      } else { st.relogin = null; if (here) note(key, '다시 연결했습니다. 바로 한 번 읽습니다.'); }
    } else if (login.stage === 'cancelled') {
      if (here) note(key, '로그인을 취소했습니다.');
      if (key !== 'add') st.relogin = null;
    }
  }

  /* 방을 열 때: 구독 줄에서 왔으면 그 구독의 첫 계정 줄, 손볼 계정이 있으면 그 계정 줄, 계정이 없으면 계정 더하기를 연 채 연다(설계 9.3) */
  /* back: 다른 방(이 PC에 맞춘 것)에서 돌아왔으면 그 방을 연 단추 { key, act }에 초점을 둔다 */
  function open(name, { svc = null, back = null } = {}) {
    close();
    current = name;
    if (back && typeof back.key === 'string' && typeof back.act === 'string') focusReq = ask({ key: back.key, act: back.act });
    if (name === 'manage') {
      const key = manageOpenKey(snapshot(), svc, now());
      openReq = key ? ask({ key }) : null;
    }
    // 내 계정은 열 때마다 읽는다. 앞에 읽은 자료가 있으면 그것을 보이며 조용히 읽는다
    if (name === 'account') void accLoad({ quiet: !!acc.data });
    // 설정은 열 때 읽고, 열린 동안 바뀜 알림을 듣는다(설계 6.4)
    if (name === 'settings') { setStart(); void pcRead(); }
    if (name === 'pc') { pcs.changedShown = null; void pcRead({ opened: true }); }
  }
  function close() {
    disarm();
    // 구독 줄의 팁 알림 줄(svc:…)은 방과 상관없이 남긴다. 방을 닫을 때는 방의 줄 알림만 지운다
    for (const k of [...st.notes.keys()]) if (!k.startsWith('svc:')) st.notes.delete(k);
    st.roomNote = ''; st.grps.clear(); st.ended = null;
    // 브라우저 로그인이 도는 중이면 끝난 뒤 그 줄을 알아보도록 남긴다. 아니면 앞서 누른 「다시 로그인」을 거둔다(검수 B)
    if (!loginNow()) st.relogin = null;
    acc.askDelete = false;
    if (current === 'settings') setStop();
    if (current === 'pc') pcs.changedShown = null;
    focusReq = null; openReq = null; closeReq = null; current = null;
  }
  function reset() {
    gen += 1;
    accGen += 1;
    close();
    st.notes.clear();
    Object.assign(st, { add: { svc: '' }, relogin: null, kinds: {}, busy: null, tokAll: false, restChoice: '' });
    st.tipDone.clear();
    setStop();
    st.installing.clear();
    lastLogin = undefined; loginEmail = undefined;
    tokReset();
    acc = freshAcc(); deleteRequestId = null;
    pcs = freshPc();
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
    /* 구독 방 맨 위의 「지금 출력」 한 줄(솔리오 구독 비서 설계 3.3) */
    // 맨 위 「켜기」의 결과 글(실패, 다른 일이 도는 중, 켰습니다)은 접힌 토큰 줄에만 있으면 보이지 않는다. 지금 출력 줄에도 쓴다(Fable 최종 F6)
    tokLive: () => { const l = briefLive(tok.state, tok.samples, now()), n = st.notes.get('tok'); return l && n ? { ...l, small: [n, l.state === 'on' ? l.small : ''].filter(Boolean).join(' · ') } : l; },
    /* 구독 줄 안쪽의 팁(설계 검토 D7). 서비스 → 팁 한 줄 */
    subTips: () => subTips(snapshot(), view(), now()),
    tokStart,
    tokLoad,
    syncLive,
    accountChanged,
    /* 옛 내 계정 화면에서 돌아올 때 컨트롤러가 부른다. 내 계정 방이 열려 있으면 보이던 자료를 둔 채 조용히 다시 읽는다(검수) */
    reloadAccount() { if (current === 'account') void accLoad({ quiet: true }); },
    /* ctx: { checking, name(로그인 정보의 이름), accountKey, member(회원으로 보이는가) } */
    /* features: 「이 PC에 맞춘 것」 판이 말해도 되는 기능(원클릭 · 사무실이 이 계정에 보이는가, 사무실에서 직접 정한 수) — Fable 최종 P1 · P2-3 */
    scene({ aside = null, checking = false, name = '', accountKey = '', member = false, features = null } = {}) {
      const req = { focus: focusReq, opening: openReq, closing: closeReq };
      if (aside === 'manage') return { manage: { ...manageRoom(snapshot(), view(), now(), { checking, sentence }), ...req } };
      if (aside === 'account') return { account: { ...accountRoom(acc, view(), now(), { name, accountKey }), ...req } };
      if (aside === 'settings') {
        // 구독 팁 켜고 끄기는 회원의 구독 자료가 있을 때만 둔다(저장 자리가 구독 판의 settings.tipsOff다, 설계 검토 D7)
        const snap = snapshot(), tipsOff = member && snap && snap.ok !== false && snap.settings ? snap.settings.tipsOff === true : null;
        sets.member = !!member;
        const room = settingsRoom({ update: sets.update, loading: typeof dev.updates?.status === 'function', desktop: sets.desktop, drafts: sets.drafts, care: sets.care, chatgpt: sets.chatgpt, notices: noticesNow(), env: envNow(), member: !!member, tipsOff, pc: dev.pcProfile ? pcs.snap : undefined }, view(), now());
        return { settings: { ...room, ...req } };
      }
      if (aside === 'pc') return { pc: { ...pcRoom(pcs.snap, { ...view(), changedShown: pcs.changedShown, features: features || {} }, now()), ...req } };
      return null;
    },
  };
}
