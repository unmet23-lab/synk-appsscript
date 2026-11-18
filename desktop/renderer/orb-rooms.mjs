// 솔리오 안쪽의 방(2단계 둘째 조각)의 상태와 동작. DOM이 없다. 컨트롤러(orb-face.mjs)가 만들고, 화면이 보낸 「room」 동작을 여기에 넘긴다.
// 설계: docs/디자인/플랫폼_클라이언트_검정구_20261116/2단계_둘째조각_구현설계.md 1.3절 · 4절 · 8절. 자료와 동작은 옛 구독 판이 쓰던 다리(options.subscriptions)만 쓴다.
// 되돌릴 수 없는 일의 첫 누름(armed)은 1분 장면이 와도 지워지지 않게 화면이 아니라 여기에 둔다(설계 8.2).
import { manageRoom, costRow, codeSay, manageKey, manageOpenKey, addInfo, parseCost, parsePass, parseApi, parseFlow, parseManual, checkCode, checkKey, checkEmail, checkRate } from './solio-rooms.mjs';
import { isUsedUp, num, nameOf } from './subscriptions-model.mjs';
import { SOLIO_TODAY_NAMES, josa } from './solio-today.mjs';

/* 두 번 누르기의 막이(설계 8.2, 설계 검토 D1). 묻고 0.6초 안의 두 번째 누름은 받지 않고(더블클릭 · Enter 되풀이), 10초가 지나면 물음을 거둔다 */
export const ROOM_TIMING = Object.freeze({ armGuard: 600, armExpire: 10000 });
/* 펼침이나 구독 방에서 여는 방. 내 계정 · 설정 방은 다음 묶음에서 더한다 */
export const ASIDE_ROOMS = Object.freeze(['manage']);

const ENDED = ['done', 'error', 'cancelled'];
const rowOf = (snap, id) => snap?.rows?.find(r => r.id === id) || null;
const idOf = key => (typeof key === 'string' && key.startsWith('a:') ? key.slice(2) : null);
const who = row => (row?.source === 'auto' ? [SOLIO_TODAY_NAMES[row.service] || '', nameOf(row), '계정'].filter(Boolean).join(' ') : String(row?.label || '').trim()) || '그 계정';
const eul = w => josa(w, ['을', '를']);
const failCode = res => res?.code || res?.error?.code || null;
const hasRows = res => !!res && res.ok !== false && Array.isArray(res.rows);

export function createOrbRooms({ subs = null, now = () => Date.now(), setTimer = globalThis.setTimeout, clearTimer = globalThis.clearTimeout, snapshot = () => null, accept = () => {}, reread = () => {}, copyText = null, changed = () => {}, sentence = s => s } = {}) {
  const st = { armed: null, grps: new Set(), add: { svc: '' }, relogin: null, kinds: {}, installing: new Set(), busy: null, notes: new Map(), ended: null, roomNote: '' };
  let gen = 0, armTimer = null, lastLogin, loginEmail;
  let focusReq = null, openReq = null, closeReq = null, seq = 0;

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

  async function handle(p = {}) {
    const key = String(p.key || ''), act = String(p.act || ''), arg = p.arg == null ? '' : String(p.arg), fields = p.fields && typeof p.fields === 'object' ? p.fields : {};
    if (act === 'disarm') { if (st.armed && (!key || st.armed.key === key)) { disarm(); changed(); } return true; }
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
    if (name !== 'manage') return;
    const key = manageOpenKey(snapshot(), svc, now());
    openReq = key ? ask({ key }) : null;
  }
  function close() {
    disarm();
    st.notes.clear(); st.roomNote = ''; st.grps.clear(); st.ended = null;
    focusReq = null; openReq = null; closeReq = null;
  }
  function reset() {
    gen += 1;
    close();
    Object.assign(st, { add: { svc: '' }, relogin: null, kinds: {}, busy: null });
    st.installing.clear();
    lastLogin = undefined; loginEmail = undefined;
  }

  return {
    handle,
    observe,
    open,
    close,
    reset,
    disarm() { if (st.armed) { disarm(); changed(); } },
    armed: () => armedNow(),
    costRow: () => costRow(snapshot(), view(), now()),
    scene({ aside = null, checking = false } = {}) {
      if (aside !== 'manage') return null;
      return { manage: { ...manageRoom(snapshot(), view(), now(), { checking, sentence }), focus: focusReq, opening: openReq, closing: closeReq } };
    },
  };
}
