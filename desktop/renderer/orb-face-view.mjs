// 검정 구 얼굴의 화면(PC 클라이언트 1단계). 컨트롤러(orb-face.mjs)가 넘긴 장면을 그리고, 누른 것을 컨트롤러에 알린다.
// 화면 층은 셋이다(묻기 · 공간 고르기 · 들어온 뒤). 글과 자리 값은 시안 docs/디자인/플랫폼_클라이언트_검정구_20261116/검정구.html을 따른다.
// 호스트(portal-host.mjs)가 이름으로 찾는 요소(#portal-invite-input, [data-portal-pane="invite"], #portal-invite-error,
// [data-portal-auth-feedback], [data-portal-action="close-invite"], [data-portal-action="continue-personal"])를 같은 뜻으로 둔다(설계 6절).
// 모듈 맨 위에서는 DOM을 건드리지 않는다.
import { createOrbStage, easeIO, easeIOQ, easeOut, lerp, smooth, switchGeom, PLACE_LON } from './orb-stage.mjs';
import { createOrbSignature } from './orb-signature.mjs';
import { rowSpeech } from './site-visits-model.mjs';

export const PORTAL_STATE_EVENT = 'synk:portal-state';
export const QA_GUEST_EVENT = 'synk:qa-guest-entry';

const EASE = { io: easeIO, ioq: easeIOQ, out: easeOut };
const NON_HOST_TAGS = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'LINK', 'META', 'NOSCRIPT']);
const FOCUSABLE = 'button:not([disabled]),input:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])';
const MARK_SVG = '<svg class="mark rise" style="--i:0" viewBox="0 0 560 328" role="img" aria-label="싱크"><path d="M87 8h58v30c0 46 23 76 61 103l-34 43c-29-19-52-45-66-70-15 30-36 54-64 72L8 143c49-32 79-64 79-112Z"/><path d="M222 8h58v172h-58Z"/><path fill-rule="evenodd" d="M157 192c-76 0-124 24-124 65s48 65 124 65 124-24 124-65-48-65-124-65Zm0 45c42 0 67 8 67 20s-25 20-67 20-67-8-67-20 25-20 67-20Z"/><path d="M326 8h226L464 312h-61l40-138H322v-54h137l16-55H326Z"/></svg>';
/* 솔리오 안의 프로그램 오브제(시안 .rail의 그림). 이름은 컨트롤러가 장면으로 넘긴다. 백업은 방이 생길 때 구독 다음 자리에 넣는다 */
const PROGRAM_ICON = Object.freeze({
  subs: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6.6" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M10 10V3.4A6.6 6.6 0 0 1 16.6 10Z" fill="currentColor"/></svg>',
  visits: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6.6" fill="none" stroke="currentColor" stroke-width="1.1"/><circle cx="14.7" cy="5.3" r="1.9" fill="currentColor"/></svg>',
});
/* 다가가서 잠깐 머물러야 열리고, 벗어나서 잠깐 지나야 닫힌다(시안 NEAR). pad는 오브제 줄에 다가갔다고 보는 거리(px) */
const NEAR = Object.freeze({ row: 120, prog: 180, close: 400, pad: 64 });
/* 오브제 이름이 다 펼쳐지는 데 걸리는 시간. 이름 하나가 0.46초에 펼쳐지고 오브제마다 70ms씩 늦게 시작한다(CSS .obj-n).
 * 이름이 펼쳐지는 동안에는 그 위에 머물러도 프로그램을 열지 않는다. 셋이면 620ms(시안 railSettle), 둘이면 550ms다(사이트방문 설계 6절, 맡긴 세션 11-18) */
export function railSettleMs(count) {
  return 460 + 70 * Math.max(0, count - 1) + 20;
}
const CHEVRON = '<svg viewBox="0 0 8 5" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" d="M1 1l3 3 3-3"/></svg>';

function markup() {
  return `<div class="orb-stage" data-portal-stage data-ui="none" data-mode="portal">
  <canvas class="orb-canvas" aria-hidden="true"></canvas>
  <canvas class="orb-sig" aria-hidden="true"></canvas>
  <button class="orb-wake" type="button" data-orb-act="wake" aria-label="시작하기"></button>
  <h1 class="sr" data-orb-heading tabindex="-1"></h1>
  <section class="orb-layer" data-layer="ask" aria-label="로그인 방법">
    <div class="ask-in">
      ${MARK_SVG}
      <p class="ask-unconf rise" style="--i:1" data-ask-unconf hidden></p>
      <div class="ask-ways"><button class="way way-main rise" style="--i:1" type="button" data-orb-act="signin" data-portal-action="signin">로그인</button></div>
      <p class="ask-feedback" role="alert" data-portal-auth-feedback hidden></p>
      <button class="quiet signup rise" style="--i:2" type="button" data-orb-act="signup" data-portal-action="signup">처음이라면 가입하기</button>
      <p class="ask-note" role="status" aria-live="polite" data-ask-note></p>
      <form class="invite rise" style="--i:4" data-portal-pane="invite" autocomplete="off" novalidate>
        <label for="portal-invite-input">초대받으셨다면</label>
        <input id="portal-invite-input" name="code" type="text" placeholder="여기에 코드를 붙여 넣으세요" spellcheck="false" autocapitalize="off" autocorrect="off" maxlength="200">
      </form>
      <div class="status" data-ask-status-box>
        <p role="status" aria-live="polite" data-ask-status></p>
        <p id="portal-invite-error" role="alert" data-portal-invite-error></p>
        <div class="status-acts" data-ask-actions></div>
      </div>
    </div>
  </section>
  <section class="orb-layer" data-layer="switch" aria-label="공간 고르기">
    <div class="sw-top"><p class="sw-lead" data-sw-lead></p><p class="sw-error" role="alert" data-sw-error></p></div>
    <div class="sw-names" data-sw-names></div>
    <p class="sw-foot rise" style="--i:4" data-sw-foot></p>
    <button class="back rise" style="--i:3" type="button" data-orb-act="close-switch">돌아가기<kbd>Esc</kbd></button>
  </section>
  <section class="orb-layer" data-layer="app" aria-label="솔리오">
    <div class="here">
      <button class="here-orb" type="button" data-orb-act="open-switch" aria-label="다른 공간으로 가기"></button>
      <button class="here-name" type="button" data-orb-act="open-switch" aria-label="다른 공간으로 가기"><span data-here-text>SOLIO</span>${CHEVRON}</button>
      <nav class="rail" aria-label="이 공간의 프로그램" data-orb-rail hidden>
        <button class="obj" type="button" data-orb-prog="subs" aria-current="false" style="--k:0">${PROGRAM_ICON.subs}<span class="obj-n"></span></button>
        <button class="obj" type="button" data-orb-prog="visits" aria-current="false" style="--k:1">${PROGRAM_ICON.visits}<span class="obj-n"></span></button>
      </nav>
      <button class="quiet legacy-back" type="button" data-orb-act="legacy-back">돌아가기</button>
    </div>
    <div class="room" data-room="solio">
      <p class="sr" role="status" aria-live="polite" data-solio-status></p>
      <p class="say rise" style="--i:1"><span data-say></span><span class="then" data-then></span></p>
      <div class="rows rise" style="--i:3" role="group" aria-label="구독별 남은 양" data-rows></div>
      <p class="read rise" style="--i:5"><span data-read></span><button class="reread" type="button" data-orb-act="reread">다시 읽기</button><button class="reread" type="button" data-orb-act="connect" hidden>구독 연결하기</button><button class="reread" type="button" data-orb-act="recheck-auth" hidden>다시 확인</button></p>
    </div>
    <div class="room" data-room="solio-visits" hidden>
      <p class="say rise" style="--i:1"><span data-vis-say></span><span class="then" data-vis-then></span></p>
      <div class="rows vis rise" style="--i:3" role="group" aria-label="synk.im 방문자 분석" data-vis-rows></div>
      <p class="read rise" style="--i:5"><span data-vis-when></span><span data-vis-scope></span></p>
    </div>
    <div class="room" data-room="space">
      <p class="say rise" style="--i:1"><span data-space-say></span><span class="then" data-space-then></span></p>
      <p class="read rise" style="--i:3"><span data-space-error role="alert"></span><button class="reread" type="button" data-orb-act="reopen-space">다시 열기</button></p>
    </div>
  </section>
</div>`;
}

function isVisible(el) {
  if (!el || el.hidden || el.disabled) return false;
  if (typeof el.getClientRects === 'function' && el.getClientRects().length === 0) return false;
  const win = el.ownerDocument?.defaultView;
  const style = win?.getComputedStyle?.(el);
  return !(style && (style.visibility === 'hidden' || style.display === 'none'));
}

export function createOrbFaceView(root, { options = {}, look = {}, onAction = () => false, getMode = () => 'portal', getReducedMotion = () => false } = {}) {
  const doc = root.ownerDocument || globalThis.document;
  const win = doc?.defaultView || globalThis;
  root.id = root.id || 'portal-entry';
  root.classList.add('orb-face-root');
  root.innerHTML = markup();

  const $ = sel => root.querySelector(sel);
  const stageEl = $('.orb-stage');
  const heading = $('[data-orb-heading]');
  const layers = { ask: $('[data-layer="ask"]'), switch: $('[data-layer="switch"]'), app: $('[data-layer="app"]') };
  const ask = {
    unconf: $('[data-ask-unconf]'), signin: $('[data-orb-act="signin"]'), feedback: $('[data-portal-auth-feedback]'), signup: $('[data-orb-act="signup"]'),
    note: $('[data-ask-note]'), form: $('[data-portal-pane="invite"]'), input: $('#portal-invite-input'), status: $('[data-ask-status]'),
    inviteError: $('#portal-invite-error'), actions: $('[data-ask-actions]'), ways: $('.ask-ways'), statusBox: $('[data-ask-status-box]'),
  };
  const sw = { lead: $('[data-sw-lead]'), error: $('[data-sw-error]'), names: $('[data-sw-names]'), foot: $('[data-sw-foot]'), close: $('[data-orb-act="close-switch"]') };
  const app = {
    orbBtn: $('.here-orb'), nameBtn: $('.here-name'), name: $('[data-here-text]'), legacyBack: $('.legacy-back'),
    solio: $('[data-room="solio"]'), say: $('[data-say]'), then: $('[data-then]'), rows: $('[data-rows]'), read: $('[data-read]'),
    reread: $('[data-orb-act="reread"]'), connect: $('[data-orb-act="connect"]'), recheck: $('[data-orb-act="recheck-auth"]'), solioStatus: $('[data-solio-status]'),
    space: $('[data-room="space"]'), spaceSay: $('[data-space-say]'), spaceThen: $('[data-space-then]'), spaceError: $('[data-space-error]'), reopen: $('[data-orb-act="reopen-space"]'),
    rail: $('[data-orb-rail]'), objs: [...root.querySelectorAll('[data-orb-prog]')],
    visits: $('[data-room="solio-visits"]'), visSay: $('[data-vis-say]'), visThen: $('[data-vis-then]'), visRows: $('[data-vis-rows]'), visWhen: $('[data-vis-when]'), visScope: $('[data-vis-scope]'),
  };

  let disposed = false;
  // 구의 움직임 세대. 점 로고가 도는 동안 다른 움직임(로그아웃으로 묻는 화면에 돌아가기 따위)이 시작되면
  // arrive가 남은 자리 옮기기를 하지 않는다(검수 A8)
  let motionGen = 0;
  let scene = null;
  let appliedFocusSeq = -1;
  let hostLocked = false;
  const savedHost = new Map();
  let introWait = null;
  let lastLayer = 'none';
  // 솔리오 안의 프로그램과 방문자 분석의 줄. 펼침은 화면만의 상태다(컨트롤러는 어느 프로그램이 열렸는지만 안다)
  let lastProg = null;
  let visKey = '';
  let restoringVis = false;
  const moreKeys = new WeakMap();
  let railSince = -1e9, progTimer = 0, visTimer = 0, visLeave = 0;
  const clock = () => { try { return win.performance?.now?.() ?? Date.now(); } catch { return Date.now(); } };
  // 키보드로 옮긴 초점인가. 창에 초점이 없으면 :focus-visible이 맞지 않으므로 마지막 입력이 자판이었는지도 본다
  let keyboardModality = false;
  const focusVisible = el => { if (keyboardModality) return true; try { return el.matches(':focus-visible'); } catch { return false; } };
  const onAnyKey = event => { if (event.key === 'Tab' || event.key?.startsWith?.('Arrow')) keyboardModality = true; };
  const onAnyPointer = () => { keyboardModality = false; };

  const reduced = () => {
    try { if (getReducedMotion() === true) return true; } catch { /* 무시 */ }
    if (doc?.documentElement?.dataset?.motion === 'reduced') return true;
    try { return win.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true; } catch { return false; }
  };
  const homePoint = () => {
    const b = app.orbBtn.getBoundingClientRect(), s = stageEl.getBoundingClientRect();
    return { x: b.left - s.left + b.width / 2, y: b.top - s.top + b.height / 2 };
  };
  let noWebGL = false, noCanvas = false;
  try { noWebGL = globalThis.__synkOrbNoWebGL === true || win.__synkOrbNoWebGL === true; } catch { noWebGL = false; }
  try { noCanvas = globalThis.__synkOrbNoCanvas === true || win.__synkOrbNoCanvas === true; } catch { noCanvas = false; }
  /* 시작 창에서 넘어올 때: 드러남이 시작 창과 같은 자세에서 이어지는 첫 장을 그리면 본체에 알린다. 본체는 그때 앱 창을 보이고 시작 창을 없앤다(1-가 구현 설계 2절) */
  let introPainted = false, firstFrameSent = false;
  const onRender = () => { if (!introPainted || firstFrameSent) return; firstFrameSent = true; try { void Promise.resolve(options.onFirstFrame?.()).catch(() => {}); } catch { /* 무시 */ } };
  const stage = createOrbStage($('.orb-canvas'), { getReducedMotion: reduced, getHome: homePoint, places: look.places !== false, eyes: look.eyes !== false, noWebGL, noCanvas, onRender, onEyes: m => { stageEl.dataset.eyes = m; } });
  const sig = createOrbSignature($('.orb-sig'), { getReducedMotion: reduced, getWidth: () => stageEl.getBoundingClientRect().width || win.innerWidth || 1440 });

  /* ── 옛 런처 가리기(지금 얼굴의 lockHostElements와 같다) ── */
  function hostElements() {
    if (Array.isArray(options.hostElements) && options.hostElements.length > 0) return options.hostElements.filter(el => el && el !== root && el.nodeType === 1);
    const parent = root.parentElement;
    if (!parent) return [];
    return [...parent.children].filter(el => el && el !== root && el.nodeType === 1 && !NON_HOST_TAGS.has(el.tagName) && el.tagName !== 'DIALOG' && el.id !== 'toast');
  }
  function setHostLocked(locked) {
    if (locked === hostLocked) return;
    if (locked) {
      for (const el of hostElements()) {
        if (!savedHost.has(el)) savedHost.set(el, { inert: Boolean(el.inert), inertAttr: el.hasAttribute?.('inert') === true, ariaHidden: el.getAttribute?.('aria-hidden') ?? null });
        el.inert = true; el.setAttribute?.('inert', ''); el.setAttribute?.('aria-hidden', 'true');
      }
    } else {
      for (const [el, prev] of savedHost.entries()) {
        el.inert = prev.inert;
        if (prev.inertAttr || prev.inert) el.setAttribute?.('inert', ''); else el.removeAttribute?.('inert');
        if (prev.ariaHidden === null) el.removeAttribute?.('aria-hidden'); else el.setAttribute?.('aria-hidden', prev.ariaHidden);
      }
      savedHost.clear();
    }
    hostLocked = locked;
  }

  /* ── 그리기 ── */
  function setText(el, text) { if (el && el.textContent !== (text || '')) el.textContent = text || ''; }
  function button(cls, text, attrs = {}) {
    const b = doc.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.textContent = text;
    for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) b.setAttribute(k, v);
    return b;
  }
  function renderActions(container, actions, busy, busyAction) {
    const key = JSON.stringify(actions.map(a => [a.action, a.label, a.key]));
    if (container.dataset.key !== key) {
      container.dataset.key = key;
      container.replaceChildren(...actions.map(a => button('quiet', a.label, { 'data-orb-act': a.action, 'data-portal-action': a.action, 'data-orb-key': a.key || '' })));
    }
    for (const b of container.querySelectorAll('button')) {
      const isCancel = b.dataset.orbKey === 'cancel';
      b.disabled = busy && !(isCancel && (busyAction === 'invite' || busyAction === 'signin'));
    }
  }

  function renderAsk(s) {
    const a = s.ask;
    ask.unconf.hidden = !a.unconfigured;
    setText(ask.unconf, a.unconfigured ? `로그인 설정을 찾지 못했습니다. ${a.unconfiguredText}` : '');
    ask.ways.hidden = !a.showSignIn;
    ask.signin.hidden = !a.showSignIn;
    ask.signup.hidden = !a.showSignUp;
    ask.form.hidden = !a.showInvite;
    ask.feedback.hidden = !a.authFeedback;
    setText(ask.feedback, a.authFeedback);
    setText(ask.note, a.note);
    setText(ask.status, a.status);
    setText(ask.inviteError, a.inviteError);
    if (a.wait) stageEl.dataset.wait = a.wait; else delete stageEl.dataset.wait;
    // 기다리는 동안 사라지는 칸과, 기다리지 않을 때 숨은 상태 묶음은 inert로 둔다. CSS가 0.35초 뒤에 숨기는 동안에도 초점과 Tab이 밟지 않게 한다(0.4.95 원천 후보 검수)
    for (const el of [ask.ways, ask.signup, ask.form]) el.inert = Boolean(a.wait);
    ask.statusBox.inert = !a.wait;
    renderActions(ask.actions, a.actions, s.busy, s.busyAction);
    const busy = s.busy;
    ask.signin.disabled = busy;
    ask.signup.disabled = busy;
    ask.input.disabled = busy;
  }

  function renderSwitch(s) {
    const w = s.switch;
    if (!w) return;
    stageEl.dataset.switchKind = w.kind;
    setText(sw.lead, w.lead);
    setText(sw.error, w.error);
    const key = JSON.stringify(w.names.map(n => [n.space, n.current]));
    if (sw.names.dataset.key !== key) {
      sw.names.dataset.key = key;
      sw.names.replaceChildren(...w.names.map((n, i) => {
        const b = doc.createElement('button');
        b.type = 'button'; b.className = 'sw rise'; b.style.setProperty('--i', String(i));
        b.dataset.go = n.space;
        b.setAttribute('aria-current', String(n.current));
        const label = doc.createElement('span'); label.className = 'sw-n'; label.textContent = n.label;
        const desc = doc.createElement('span'); desc.className = 'sw-d'; desc.textContent = n.desc;
        const here = doc.createElement('span'); here.className = 'sw-now'; here.textContent = '지금 여기';
        b.append(label, desc, here);
        return b;
      }));
    }
    const footItems = w.kind === 'entry' ? w.actions.map(a => ({ ...a, kind: 'act' })) : w.foot.map(f => ({ ...f, kind: 'foot' }));
    const fkey = JSON.stringify(footItems.map(f => [f.kind, f.action, f.label]));
    if (sw.foot.dataset.key !== fkey) {
      sw.foot.dataset.key = fkey;
      sw.foot.replaceChildren(...footItems.map(f => (f.kind === 'foot'
        ? button('quiet', f.label, { 'data-orb-act': 'foot', 'data-foot': f.action })
        : button('quiet', f.label, { 'data-orb-act': f.action, 'data-portal-action': f.action }))));
    }
    sw.close.hidden = !w.showClose;
    for (const b of [...sw.names.querySelectorAll('button'), ...sw.foot.querySelectorAll('button'), sw.close]) b.disabled = s.busy;
    layoutSwitch();
  }
  function layoutSwitch() {
    const r = stageEl.getBoundingClientRect();
    const g = switchGeom(r.width || 1, r.height || 1);
    sw.names.style.top = Math.round(g.cy + g.r + (g.wide ? Math.max(40, (r.height || 1) * 0.075) : 22)) + 'px';
  }

  function renderRows(today) {
    const rows = today.rows || [];
    const key = JSON.stringify(rows.map(r => [r.key, r.name, r.sub, r.gauge, r.val, r.when, r.urgent, r.label]));
    if (app.rows.dataset.key === key) return;
    app.rows.dataset.key = key;
    app.rows.replaceChildren(...rows.map(r => {
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = 'row' + (r.urgent ? ' now' : '');
      b.dataset.svc = r.key;
      b.setAttribute('aria-label', r.label);
      const nm = doc.createElement('span'); nm.className = 'nm'; nm.textContent = r.name;
      if (r.sub) { const small = doc.createElement('small'); small.textContent = r.sub; nm.append(small); }
      const gauge = doc.createElement('span'); gauge.className = 'gauge'; gauge.setAttribute('aria-hidden', 'true');
      const fill = doc.createElement('i'); fill.style.setProperty('--v', (typeof r.gauge === 'number' ? Math.max(0, Math.min(100, r.gauge)) : 0) + '%');
      if (typeof r.gauge !== 'number') fill.hidden = true;
      gauge.append(fill);
      const val = doc.createElement('span'); val.className = 'val'; val.textContent = r.val || '';
      const when = doc.createElement('span'); when.className = 'when'; when.textContent = r.when || '';
      b.append(nm, gauge, val, when);
      return b;
    }));
  }

  function renderApp(s) {
    const room = s.room;
    setText(app.name, s.spaceLabel);
    // 보이는 공간 이름이 낭독 이름에도 들어가게 한다(검수 A6, WCAG 2.5.3)
    const nameLabel = s.spaceLabel ? `${s.spaceLabel}, 다른 공간으로 가기` : '다른 공간으로 가기';
    if (app.nameBtn?.getAttribute?.('aria-label') !== nameLabel) app.nameBtn?.setAttribute?.('aria-label', nameLabel);
    app.orbBtn.setAttribute('aria-label', `지금 ${s.spaceLabel}. 다른 공간으로 가기`);
    app.legacyBack.hidden = s.mode !== 'legacy';
    if (!room) { renderRail(s, [], null); lastProg = null; return; }
    const solio = room.space === 'solio';
    const prog = solio ? (room.prog || 'subs') : null;
    app.solio.hidden = !solio || prog !== 'subs';
    app.visits.hidden = prog !== 'visits';
    app.space.hidden = solio;
    renderRail(s, solio ? room.programs || [] : [], prog);
    renderVisits(solio ? room.visits : null);
    if (prog !== lastProg) {
      closeMores(true);
      if (lastProg !== null && prog) enterRoom(prog);
      lastProg = prog;
    }
    // 방이 가려진 동안(옛 화면, 다른 공간) 스크롤은 사건 없이 0으로 돌아온다. 그릴 때마다 위쪽 흐림 표시를 지금 스크롤에 맞춘다(0.4.97 검수 A3)
    for (const r of [app.solio, app.visits]) if (r.classList.contains('scrolled') && !(r.scrollTop > 0)) r.classList.remove('scrolled');
    layers.app.setAttribute('aria-label', solio ? '솔리오' : room.space === 'workspace' ? 'Workspace' : 'PULSE');
    if (solio) {
      const t = room.solio;
      setText(app.say, t.say);
      setText(app.then, t.then);
      renderRows(t);
      app.rows.classList.toggle('dim', Boolean(t.dim));
      app.rows.hidden = !(t.rows && t.rows.length);
      setText(app.read, t.read);
      app.reread.hidden = t.action !== 'reread';
      app.connect.hidden = t.action !== 'connect';
      app.recheck.hidden = t.action !== 'recheck-auth';
      // 계정 확인을 기다리는 문장은 낭독기에도 알린다(단추가 「사용할 수 없음」으로 바뀐 것만 읽히지 않게, 다시 검수 -e)
      // 앱 층이 보일 때에만 넣는다. 들어가는 움직임 동안(층이 inert) 먼저 넣으면 층이 보인 뒤 알릴 변화가 없다(다시 검수 -f)
      setText(app.solioStatus, s.layer === 'app' && t.state === 'waiting' ? [t.say, t.then].filter(Boolean).join(' ') : '');
      // 누를 수 없는 동안에도 disabled를 쓰지 않는다. 눌러 둔 단추가 disabled가 되면 브라우저가 초점을 body로 옮긴다(다시 검수 -d)
      setUnavailable(app.reread, Boolean(t.rereading) || s.busy);
      setUnavailable(app.recheck, Boolean(t.checking) || s.busy);
      app.reread.closest('.read').hidden = !t.read && !t.action;
    } else {
      setText(app.spaceSay, room.say);
      setText(app.spaceThen, room.then);
      setText(app.spaceError, room.error);
      app.reopen.hidden = !room.action;
      app.reopen.disabled = s.busy;
    }
  }

  /* ── 솔리오 안의 프로그램(시안 .rail) ── */
  function renderRail(s, programs, prog) {
    const on = s.mode === 'app' && programs.length > 0;
    app.rail.hidden = !on;
    // 같은 값은 다시 쓰지 않는다(장면은 1분마다 다시 그린다)
    if (on && stageEl.dataset.rail !== '1') stageEl.dataset.rail = '1'; else if (!on && 'rail' in stageEl.dataset) delete stageEl.dataset.rail;
    if (prog && stageEl.dataset.prog !== prog) stageEl.dataset.prog = prog; else if (!prog && 'prog' in stageEl.dataset) delete stageEl.dataset.prog;
    if (!on) { app.rail.classList.remove('near'); clearTimeout(progTimer); }
    for (const o of app.objs) {
      const p = programs.find(x => x.key === o.dataset.orbProg);
      o.hidden = !p;
      if (!p) continue;
      const label = p.note ? `${p.label}, ${p.note}` : p.label;
      if (o.getAttribute('aria-label') !== label) {
        o.setAttribute('aria-label', label);
        const name = o.querySelector('.obj-n');
        const parts = [doc.createTextNode(p.label)];
        if (p.note) { const small = doc.createElement('small'); small.textContent = p.note; parts.push(small); }
        name.replaceChildren(...parts);
      }
      o.setAttribute('aria-current', String(o.dataset.orbProg === prog));
    }
  }
  /* 다른 프로그램의 방이 뜰 때 안의 것들이 차례로 떠오른다(시안 flashRoom) */
  function enterRoom(prog) {
    const el = prog === 'visits' ? app.visits : app.solio;
    el.scrollTop = 0;
    el.classList.remove('scrolled');
    el.classList.remove('enter');
    void el.offsetWidth;
    el.classList.add('enter');
  }
  /* 포인터가 오브제 줄 가까이 오면 이름이 차례로 펼쳐진다. 펼쳐지기 시작한 때를 적어 둔다 */
  function updateNear(x, y) {
    if (app.rail.hidden || scene?.layer !== 'app') { app.rail.classList.remove('near'); return; }
    const r = app.rail.getBoundingClientRect();
    const near = x > r.left - NEAR.pad && x < r.right + NEAR.pad && y > r.top - NEAR.pad && y < r.bottom + NEAR.pad;
    if (near === app.rail.classList.contains('near')) return;
    app.rail.classList.toggle('near', near);
    if (near) railSince = clock();
  }
  const onRailOver = event => {
    const o = event.target?.closest?.('.obj[data-orb-prog]');
    if (!o || event.pointerType !== 'mouse' || o.contains(event.relatedTarget)) return;
    updateNear(event.clientX, event.clientY);
    clearTimeout(progTimer);
    // 이름이 다 펼쳐지기 전에는 열지 않는다. 펼쳐지는 동안 이름 밑으로 지나가던 오브제가 열리지 않게 한다
    const settle = railSettleMs(app.objs.filter(x => !x.hidden).length);
    progTimer = setTimeout(() => { if (!disposed && !o.hidden && scene?.layer === 'app') onAction('prog', o.dataset.orbProg); }, Math.max(NEAR.prog, railSince + settle - clock()));
  };
  const onRailOut = event => {
    const o = event.target?.closest?.('.obj[data-orb-prog]');
    if (o && !o.contains(event.relatedTarget)) clearTimeout(progTimer);
  };
  /* 방이 조금이라도 내려가 있으면 위쪽 끝도 흐린다. 맨 위로 돌아오면(줄을 접어 스크롤이 0이 된 때 포함) 뗀다(시안 세션 11-18) */
  const onRoomScroll = event => {
    const r = event.target;
    if (r && r.nodeType === 1 && r.classList.contains('room')) r.classList.toggle('scrolled', r.scrollTop > 0);
  };
  const onRailFocus = event => {
    const o = event.target?.closest?.('.obj[data-orb-prog]');
    if (o && focusVisible(o)) onAction('prog', o.dataset.orbProg);
  };

  /* ── 방문자 분석의 방(시안 buildVis). 요약에서 온 글이 섞이므로 모두 textContent로만 넣는다(사이트방문 설계 6절, 검토 P2-5) ── */
  function el(tag, cls, text) {
    const n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  }
  /* 장면은 1분마다 새로 온다(상대 시각, 다시 읽은 요약). 줄의 차례가 같으면 그 자리의 줄을 고쳐 쓰고,
     차례가 달라 새로 지을 때도 펼친 줄, 눌러 고정한 줄, 자판 초점을 줄 이름(key)으로 되살린다(0.4.97 공개 후보 검수 A2) */
  function renderVisits(v) {
    const key = v && v.visible ? JSON.stringify([v.say, v.then, v.when, v.scope, v.rows]) : '';
    if (key === visKey) return;
    visKey = key;
    clearTimeout(visTimer);
    if (!key) clearTimeout(visLeave);
    setText(app.visSay, key ? v.say : '');
    setText(app.visThen, key ? v.then : '');
    setText(app.visWhen, key ? v.when : '');
    setText(app.visScope, key ? v.scope : '');
    const rows = key && Array.isArray(v.rows) ? v.rows : [];
    const old = [...app.visRows.querySelectorAll('button.row[data-vis]')];
    if (rows.length && old.length === rows.length && old.every((b, i) => b.dataset.vis === String(rows[i].key))) {
      rows.forEach((r, i) => fillVisRow(old[i], r));
    } else {
      const kept = new Map(rows.length ? old.filter(b => b.classList.contains('opened')).map(b => [b.dataset.vis, b.classList.contains('pin')]) : []);
      const focused = rows.length ? old.find(b => b === doc.activeElement)?.dataset.vis : undefined;
      app.visRows.replaceChildren(...rows.flatMap(visRow));
      // 펼침을 먼저 되살린다. 초점을 옮기면 모양이 계산되어, 그 뒤에 붙인 펼침은 처음부터 다시 펼쳐진다
      for (const b of app.visRows.querySelectorAll('button.row[data-vis]')) if (kept.has(b.dataset.vis)) { setMore(b, true); if (kept.get(b.dataset.vis)) b.classList.add('pin'); }
      const again = focused === undefined ? null : [...app.visRows.querySelectorAll('button.row[data-vis]')].find(b => b.dataset.vis === focused);
      if (again) { restoringVis = true; try { again.focus({ preventScroll: true }); } catch {} finally { restoringVis = false; } }
    }
    app.visRows.hidden = !rows.length;
  }
  function visRow(r) {
    const b = el('button', 'row');
    b.type = 'button';
    b.dataset.vis = String(r.key);
    b.setAttribute('aria-expanded', 'false');
    const more = el('div', 'more');
    more.setAttribute('aria-hidden', 'true');
    more.append(el('div', 'more-in'));
    fillVisRow(b, r, more);
    return [b, more];
  }
  /* 줄 하나의 글을 쓴다. 펼침, 고정, 초점은 건드리지 않는다 */
  function fillVisRow(b, r, more = b.nextElementSibling) {
    b.classList.toggle('now', !!r.now);
    b.classList.toggle('unread', !!r.unread);
    const label = rowSpeech(r);
    if (b.getAttribute('aria-label') !== label) b.setAttribute('aria-label', label);
    const parts = [['nm', r.nm], ['mid', r.mid], ['val', r.val], ['when', r.when]];
    if (b.children.length === parts.length && parts.every(([cls], k) => b.children[k].className === cls)) parts.forEach(([, text], k) => setText(b.children[k], text == null ? '' : String(text)));
    else b.replaceChildren(...parts.map(([cls, text]) => el('span', cls, text)));
    const inner = more?.firstElementChild;
    if (!inner) return;
    const moreKey = JSON.stringify(Array.isArray(r.more) ? r.more : []);
    if (moreKeys.get(inner) === moreKey) return;
    moreKeys.set(inner, moreKey);
    inner.replaceChildren();
    let j = 0;
    const put = n => { n.style.setProperty('--j', String(j++)); inner.append(n); };
    for (const item of Array.isArray(r.more) ? r.more : []) {
      const [kind, a, c, val, when] = Array.isArray(item) ? item : [];
      if (kind === 'say') put(el('p', 'more-say', a));
      else if (kind === 'note') put(el('p', 'more-note', a));
      else if (kind === 'week') {
        const days = (Array.isArray(c) ? c : []).map(x => (typeof x === 'number' && Number.isFinite(x) ? Math.max(0, x) : 0));
        const top = Math.max(1, ...days);
        const row = el('div', 'row sub row-plain'), week = el('span', 'week');
        week.setAttribute('role', 'img');
        week.setAttribute('aria-label', `지난 7일의 하루 방문 수 ${days.join(', ')}`);
        days.forEach((x, k) => { const i = el('i', k === days.length - 1 ? 'today' : ''); i.style.setProperty('--h', Math.round((x / top) * 100) + '%'); week.append(i); });
        row.append(el('span', 'nm', a), week, el('span', 'val', val));
        put(row);
      } else if (kind === 'row') {
        const row = el('div', 'row sub');
        row.append(el('span', 'nm', a), el('span', 'mid', c), el('span', 'val', val), el('span', 'when', when));
        put(row);
      }
    }
  }
  /* 줄 하나를 펼치거나 접는다. pin이면 눌러서 연 것이라 손이 떠나도 열려 있다 */
  function setMore(b, on) {
    const more = b.nextElementSibling;
    if (!more || !more.classList.contains('more')) return;
    more.classList.toggle('open', on);
    if (on) more.removeAttribute('aria-hidden'); else more.setAttribute('aria-hidden', 'true');
    b.classList.toggle('opened', on);
    b.setAttribute('aria-expanded', String(on));
    if (!on) b.classList.remove('pin');
  }
  /* 한 줄을 펼치면 그 아래에 열려 있던 줄은 접는다. 위쪽 줄은 접지 않는다(접으면 손 밑의 줄이 위로 달아난다) */
  function openVis(b, pin = false) {
    const rows = [...app.visRows.querySelectorAll('button.row[data-vis]')], i = rows.indexOf(b);
    if (i < 0) return;
    rows.forEach((r, k) => { if (k > i && !r.classList.contains('pin')) setMore(r, false); });
    if (pin) b.classList.add('pin');
    setMore(b, true);
  }
  function closeMores(all = false) {
    for (const b of app.visRows.querySelectorAll('button.row[data-vis]')) if (all || !b.classList.contains('pin')) setMore(b, false);
  }
  const onVisOver = event => {
    const b = event.target?.closest?.('button.row[data-vis]');
    if (!b || event.pointerType !== 'mouse' || b.contains(event.relatedTarget)) return;
    clearTimeout(visTimer);
    visTimer = setTimeout(() => { if (!disposed && b.isConnected) openVis(b); }, NEAR.row);
  };
  const onVisOut = event => {
    const b = event.target?.closest?.('button.row[data-vis]');
    if (b && !b.contains(event.relatedTarget)) clearTimeout(visTimer);
  };
  const onVisEnter = () => { clearTimeout(visLeave); };
  const onVisLeave = () => { clearTimeout(visTimer); clearTimeout(visLeave); visLeave = setTimeout(() => { if (!disposed) closeMores(); }, NEAR.close); };
  const onVisFocus = event => {
    if (restoringVis) return;
    const b = event.target?.closest?.('button.row[data-vis]');
    if (b && focusVisible(b)) openVis(b);
  };

  function setUnavailable(button, off) {
    button.disabled = false;
    if (off) button.setAttribute('aria-disabled', 'true'); else button.removeAttribute('aria-disabled');
  }

  function headingFor(s) {
    if (s.layer === 'ask') return s.ask.unconfigured ? '로그인 설정 확인' : '로그인 방법';
    if (s.layer === 'switch') return '공간 고르기';
    if (s.layer === 'app') return s.space === 'solio' ? '솔리오' : s.space === 'workspace' ? 'Workspace' : 'PULSE';
    if (s.phase === 'welcome') return 'SYNK Platform';
    return '';
  }

  function render(next) {
    if (disposed) return;
    scene = next;
    const s = next;
    // 뿌리에 지키는 표시(설계 4절)
    root.hidden = s.mode === 'off';
    root.dataset.portalState = s.phase;
    root.dataset.portalActive = String(Boolean(s.active));
    root.dataset.portalAuthStatus = s.authStatus;
    if (s.workspaceStatus) root.dataset.portalWorkspaceStatus = s.workspaceStatus; else delete root.dataset.portalWorkspaceStatus;
    root.dataset.orbClient = s.mode;
    if (doc?.documentElement?.dataset) {
      doc.documentElement.dataset.portalActive = String(Boolean(s.active));
      doc.documentElement.dataset.orbClient = s.mode;
    }
    if (s.orbBusy) root.setAttribute('aria-busy', 'true'); else root.removeAttribute('aria-busy');
    setHostLocked(s.mode === 'portal' || s.mode === 'app');

    stageEl.dataset.mode = s.mode;
    stageEl.dataset.space = s.space;
    if (s.boot) stageEl.dataset.boot = '1'; else delete stageEl.dataset.boot;
    const layer = s.layer;
    if (layer !== lastLayer) {
      stageEl.dataset.ui = layer;
      stageEl.classList.remove('settled');
      clearTimeout(settleTimer);
      if (layer !== 'none') settleTimer = setTimeout(() => stageEl.classList.add('settled'), 1900);
      lastLayer = layer;
    }
    for (const [name, el] of Object.entries(layers)) el.inert = name !== layer;

    stage.setVisiblePlaces(s.places);
    stage.setSpace(s.space);
    stage.setGlint(s.ask?.wait === 'wait' || s.orbBusy);
    stage.setAutoFace(layer === 'switch');
    if (layer !== 'switch') stage.setHot(null);

    renderAsk(s);
    renderSwitch(s);
    renderApp(s);
    setText(heading, headingFor(s));
    applyFocus(s);
  }

  let settleTimer = 0;

  /* ── 초점(설계 13절) ── */
  function focusEl(el, { select = false } = {}) {
    if (!el || doc?.hidden) return false;
    if (!isVisible(el)) return false;
    el.focus?.({ preventScroll: true });
    if (select && typeof el.select === 'function') el.select();
    return doc.activeElement === el;
  }
  function targetFor(key) {
    switch (key) {
      case 'wake': return $('.orb-wake');
      case 'signin': return isVisible(ask.signin) ? ask.signin : ask.input;
      case 'code': case 'code-select': return ask.input;
      case 'cancel': case 'retry': case 'back': case 'go-auth': case 'switch-account':
        return ask.actions.querySelector(`[data-orb-key="${key}"]`) || ask.actions.querySelector('button');
      case 'first-name': return sw.names.querySelector('button') || sw.foot.querySelector('button');
      case 'current-name': return sw.names.querySelector('[aria-current="true"]') || sw.names.querySelector('button');
      case 'here': return app.orbBtn;
      default: return null;
    }
  }
  function applyFocus(s) {
    if (s.focusSeq === appliedFocusSeq || !s.focus) return;
    if (s.focus === 'legacy') { appliedFocusSeq = s.focusSeq; return; }
    if (s.focus === 'root') {
      appliedFocusSeq = s.focusSeq;
      const active = doc.activeElement;
      // 같은 그리기에서 inert로 바뀐 층의 단추에 초점이 남으면, 브라우저가 다음 프레임에 그 초점을 body로 옮겨 포털 밖으로 빠진다.
      // 그래서 inert 안의 초점도 지금 뿌리로 옮긴다(지금 얼굴의 「다시 시도」 초점 고침과 같은 약속, 11-16 토큰 세션 전달)
      if (!active || !root.contains(active) || !isVisible(active) || active.closest?.('[inert]')) { heading.focus?.({ preventScroll: true }); }
      return;
    }
    if (focusEl(targetFor(s.focus), { select: s.focus === 'code-select' })) appliedFocusSeq = s.focusSeq;
  }
  function focusables() {
    return [...root.querySelectorAll(FOCUSABLE)].filter(el => el !== heading && isVisible(el) && !el.closest('[inert]'));
  }
  function trapping() {
    const mode = getMode();
    return mode === 'portal' || mode === 'app';
  }
  function dialogOutside() {
    const open = doc.querySelector?.('dialog[open]');
    return Boolean(open && !root.contains(open));
  }

  /* ── 움직임(컨트롤러가 부른다) ── */
  function wait(ms) {
    return new Promise(resolve => {
      const t = setTimeout(() => { introWait = null; resolve(); }, ms);
      introWait = () => { clearTimeout(t); introWait = null; resolve(); };
    });
  }
  let introHurried = false;
  /* startedAt(본체가 정한 드러남 시작 시각, 밀리초)을 받으면 그만큼 지난 자리에서 이어 그린다. 시작 창이 먼저 그리던 드러남을 앱 창이 끊김 없이 잇는다 */
  async function intro(kind, { delay = 520, ms = 2400, asleepAt = null, wakeAt = null, startedAt = null } = {}) {
    const gen = ++motionGen;
    introHurried = false;
    sig.stop();
    stage.setSpin(0);
    stage.snap('void');
    stage.eyesOff?.();
    const elapsed = Number.isFinite(startedAt) ? Math.max(0, Date.now() - startedAt) : 0;
    /* 눈: 빛이 자리를 잡을 즈음 잠든 눈이 떠오르고 곧 눈을 뜬다. 시작 창에서 이미 뜬 눈이면 뜬 채로 잇는다 */
    if (Number.isFinite(asleepAt) && Number.isFinite(wakeAt)) {
      // 시작 창에서 이미 보이던 눈은 앱 창의 첫 장에서도 그대로 보인다. 떠오르는 중에 넘어오면 0에서 다시 떠오르며 깜빡인 듯 보였다(0.4.96 검수 B3)
      const at = (when, fn) => { const left = when - elapsed; if (left <= 0) fn(true); else setTimeout(() => { if (!disposed && gen === motionGen) fn(false); }, reduced() ? Math.min(left, 120) : left); };
      if (elapsed >= wakeAt) stage.eyesCalm?.({ instant: true });
      else { at(asleepAt, instant => stage.eyesAsleep?.({ instant })); at(wakeAt, () => { void stage.eyesWake?.(); }); }
    }
    if (elapsed >= delay + ms) { stage.snap('rest'); introPainted = true; stage.draw?.(); return; }
    if (elapsed < delay) await wait(reduced() ? Math.min(delay - elapsed, 120) : delay - elapsed);
    // 기다리는 동안 다른 움직임이 시작됐으면 덮지 않는다. 기다리는 동안 서둘렀으면 드러나는 움직임도 짧게 한다(0.4.95 원천 후보 검수)
    if (disposed || gen !== motionGen) return;
    const moving = stage.tween('rest', introHurried ? Math.min(ms, 320) : ms, easeOut, (t, a, b) => lerp(a, b, smooth(0, 0.62, t)), { elapsed: Math.max(0, elapsed - delay) });
    introPainted = true;
    await moving;
  }
  function hurryIntro() {
    introHurried = true;
    if (introWait) introWait();
    stage.hurry('rest');
  }
  async function move(pose, { ms = 760, ease = 'io', face = null } = {}) {
    if (disposed) return;
    motionGen++;
    sig.stop();
    if (pose === 'sw') {
      const to = face || scene?.space || 'solio';
      stage.setFace(null);
      stage.setSpace(scene?.mode === 'portal' ? to : (scene?.space || 'solio'));
      stage.setSpin(-PLACE_LON[to]);
      if (scene?.mode === 'portal') stage.setFace(to);
    } else {
      stage.setFace(null);
    }
    await stage.tween(pose, ms, EASE[ease] || easeIO);
  }
  async function dive(space, ms = 1250) {
    if (disposed) return;
    const gen = ++motionGen;
    sig.stop();
    stage.setFace(null);
    stage.setAutoFace(false);
    stage.setDive(space);
    stage.setHot(space);
    if (stage.state().mark < 0.05) stage.setSpin(-PLACE_LON[space]);
    await stage.tween('inside', ms, easeIO, (t, a) => a * (1 - smooth(0.7, 0.97, t)));
    if (disposed || gen !== motionGen) return;
    stage.setSpace(space);
  }
  /* 점 로고가 맞춰지고 물러나며 왼쪽 위의 작은 구가 된다. 작은 구가 자리를 잡기 시작하는 순간에 돌아온다 */
  async function arrive(space, sigKind, { smile = false } = {}) {
    if (disposed) return;
    const gen = motionGen;
    if (sigKind && !doc?.hidden) await sig.play(sigKind);
    if (disposed || gen !== motionGen) return;
    stage.setHot(null);
    stage.snap('home');
    stage.setLit(0);
    stage.setRadius(5);
    stage.eyesCalm?.();
    sig.fade();
    // 처음 들어온 때는 작은 구가 자리를 잡은 뒤 잠깐 웃는다(시안 enter). 점 로고를 끈 판에서도 같다
    void Promise.resolve(stage.tween('home', 700, easeOut)).then(() => { if (smile && !disposed && gen === motionGen) void stage.setMood?.('smile', 1100); });
  }

  /* ── 누름 · 자판 · 붙여 넣기 ── */
  const onClick = event => {
    if (disposed) return;
    const target = event.target?.nodeType === 1 ? event.target : event.target?.parentElement;
    if (!target) return;
    const name = target.closest?.('.sw[data-go]');
    if (name && root.contains(name)) { event.preventDefault(); onAction('go', name.dataset.go); return; }
    const visRowEl = target.closest?.('button.row[data-vis]');
    if (visRowEl && root.contains(visRowEl)) {
      event.preventDefault();
      clearTimeout(visTimer);
      if (visRowEl.classList.contains('pin')) setMore(visRowEl, false); else openVis(visRowEl, true);
      return;
    }
    const obj = target.closest?.('.obj[data-orb-prog]');
    if (obj && root.contains(obj)) { event.preventDefault(); clearTimeout(progTimer); onAction('prog', obj.dataset.orbProg); return; }
    const row = target.closest?.('button.row[data-svc]');
    if (row && root.contains(row)) { event.preventDefault(); onAction('row', row.dataset.svc); return; }
    const act = target.closest?.('[data-orb-act]');
    if (act && root.contains(act)) {
      if (act.disabled || act.getAttribute('aria-disabled') === 'true') return;
      event.preventDefault();
      onAction(act.dataset.orbAct, act.dataset.foot);
      return;
    }
    // 공간 고르기에서 빈 곳을 누르면 닫히고, 구에 새긴 고리를 누르면 그 공간으로 간다
    if (scene?.layer === 'switch' && layers.switch.contains(target) && !target.closest('.sw,.back,.sw-foot,.sw-top')) {
      const r = stageEl.getBoundingClientRect();
      const place = stage.placeUnder(event.clientX - r.left, event.clientY - r.top);
      if (place && scene.places.includes(place)) onAction('go', place);
      else if (scene.switch?.kind === 'app') onAction('close-switch');
    }
  };
  const onSubmit = event => {
    if (!event.target?.closest?.('[data-portal-pane="invite"]')) return;
    event.preventDefault();
    onAction('invite-submit');
  };
  const onInput = event => { if (event.target === ask.input) onAction('invite-input'); };
  const onPointerMove = event => {
    const r = stageEl.getBoundingClientRect();
    if (!r.width || !r.height) return;
    if (!reduced()) stage.setPointer((event.clientX - r.left) / r.width, (event.clientY - r.top) / r.height);
    if (scene?.layer === 'app') updateNear(event.clientX, event.clientY);
    if (scene?.layer === 'switch' && !event.target?.closest?.('.sw,.back,.sw-foot,.sw-top')) {
      const place = stage.placeUnder(event.clientX - r.left, event.clientY - r.top);
      const ok = place && scene.places.includes(place);
      layers.switch.style.cursor = ok ? 'pointer' : '';
      stage.setHot(ok ? place : null);
    }
  };
  const onPointerLeave = () => { stage.setPointer(0.5, 0.5); app.rail.classList.remove('near'); clearTimeout(progTimer); };
  const onNameHover = event => {
    if (scene?.layer !== 'switch') return;
    const name = event.target?.closest?.('.sw[data-go]');
    const on = event.type === 'pointerover' || event.type === 'focusin';
    if (name && on) { stage.setHot(name.dataset.go); stage.setFace(name.dataset.go); for (const b of sw.names.children) b.classList.toggle('hot', b === name); }
    else if (!on) { stage.setHot(null); stage.setFace(null); for (const b of sw.names.children) b.classList.remove('hot'); }
  };
  const onKeyDown = event => {
    if (disposed || event.defaultPrevented || event.isComposing) return;
    const mode = getMode();
    if (mode === 'off') return;
    const t = event.target && typeof event.target.nodeType === 'number' ? event.target : null;
    const typing = Boolean(t?.closest?.('input,textarea,select,[contenteditable="true"]'));
    if (event.key === 'Escape') {
      if (mode === 'legacy' && (dialogOutside() || typing || (t && !root.contains(t) && t.closest?.('dialog')))) return;
      if (dialogOutside()) return;
      if (onAction('escape')) { event.preventDefault(); event.stopPropagation(); }
      else if (typing && t && root.contains(t)) t.blur?.();
      return;
    }
    if (event.key === 'Tab' && trapping() && !dialogOutside()) {
      const items = focusables();
      if (!items.length) { event.preventDefault(); return; }
      const first = items[0], last = items[items.length - 1], active = doc.activeElement;
      // 제목(heading)처럼 Tab 목록 밖에 초점이 있어도 얼굴 안에서 돈다(0.4.95 원천 후보 검수)
      const outside = !items.includes(active);
      if (event.shiftKey) { if (outside || active === first) { event.preventDefault(); last.focus?.({ preventScroll: true }); } }
      else if (outside || active === last) { event.preventDefault(); first.focus?.({ preventScroll: true }); }
      return;
    }
    if (mode === 'legacy' || typing || event.ctrlKey || event.metaKey || event.altKey) return;
    if ((event.key === 'Enter' || event.key === ' ') && scene?.boot) { event.preventDefault(); onAction('wake'); return; }
    if (event.key === 'Enter' && scene?.layer === 'ask' && !scene.ask.wait && !(t?.closest?.('button')) && scene.ask.showSignIn) { event.preventDefault(); onAction('signin'); return; }
    if (scene?.layer === 'switch' && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
      const list = [...sw.names.querySelectorAll('button')];
      if (!list.length) return;
      event.preventDefault();
      const i = Math.max(0, list.indexOf(doc.activeElement));
      list[(i + (event.key === 'ArrowRight' ? 1 : list.length - 1)) % list.length].focus?.({ preventScroll: true });
    }
  };
  /* 화면 어디에서 붙여 넣어도 코드가 들어간다(설계 5절 auth 줄) */
  const onPaste = event => {
    if (disposed || scene?.layer !== 'ask' || event.target === ask.input) return;
    if (scene.ask.wait === 'wait' || scene.ask.wait === 'done' || !scene.ask.showInvite || scene.busy) return;
    if (dialogOutside()) return;
    const text = (event.clipboardData?.getData?.('text') || '').trim();
    if (!text) return;
    event.preventDefault();
    if (scene.ask.wait === 'error') onAction('close-invite');
    ask.input.value = text.slice(0, 200);
    ask.input.dispatchEvent(new win.Event('input', { bubbles: true }));
    if (typeof ask.form.requestSubmit === 'function') ask.form.requestSubmit();
    else ask.form.dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
  };
  /* 새 얼굴이 보이는 동안 초점이 뿌리 밖으로 나가면 돌려놓는다. 뿌리 밖에 열린 대화상자와 legacy에서는 끌어오지 않는다(설계 검토 2차 3) */
  const onFocusIn = event => {
    if (disposed || !trapping()) return;
    const t = event.target && typeof event.target.nodeType === 'number' ? event.target : null;
    if (!t || root.contains(t) || t === doc.body) return;
    if (dialogOutside() || t.closest?.('dialog')) return;
    const items = focusables();
    if (items.length) items[0].focus?.({ preventScroll: true });
    else heading.focus?.({ preventScroll: true });
  };
  const onVisibility = () => {
    if (doc.hidden) { stage.pause(); return; }
    stage.resume();
    onAction('visible');
  };
  const onPageShow = event => { onAction('pageshow', event?.persisted === true); };
  const onPageHide = () => { if (ask.input) ask.input.value = ''; stage.pause(); };
  const onQaGuest = () => { onAction('qa-guest'); };
  const resizeObserver = typeof win.ResizeObserver === 'function' ? new win.ResizeObserver(() => { if (scene?.layer === 'switch') layoutSwitch(); }) : null;

  root.addEventListener('click', onClick);
  root.addEventListener('scroll', onRoomScroll, true);
  root.addEventListener('submit', onSubmit);
  root.addEventListener('input', onInput);
  root.addEventListener(QA_GUEST_EVENT, onQaGuest);
  stageEl.addEventListener('pointermove', onPointerMove, { passive: true });
  stageEl.addEventListener('pointerleave', onPointerLeave);
  sw.names.addEventListener('pointerover', onNameHover);
  sw.names.addEventListener('pointerout', onNameHover);
  sw.names.addEventListener('focusin', onNameHover);
  sw.names.addEventListener('focusout', onNameHover);
  app.rail.addEventListener('pointerover', onRailOver);
  app.rail.addEventListener('pointerout', onRailOut);
  app.rail.addEventListener('focusin', onRailFocus);
  app.visRows.addEventListener('pointerover', onVisOver);
  app.visRows.addEventListener('pointerout', onVisOut);
  app.visRows.addEventListener('pointerenter', onVisEnter);
  app.visRows.addEventListener('pointerleave', onVisLeave);
  app.visRows.addEventListener('focusin', onVisFocus);
  doc.addEventListener('keydown', onAnyKey, true);
  doc.addEventListener('pointerdown', onAnyPointer, true);
  doc.addEventListener('keydown', onKeyDown);
  doc.addEventListener('paste', onPaste);
  doc.addEventListener('focusin', onFocusIn);
  doc.addEventListener('visibilitychange', onVisibility);
  if (options.managePageShow !== true) win.addEventListener?.('pageshow', onPageShow);
  win.addEventListener?.('pagehide', onPageHide);
  resizeObserver?.observe(stageEl);

  return {
    render,
    intro,
    hurryIntro,
    move,
    dive,
    arrive,
    getInviteValue: () => ask.input?.value ?? '',
    setInviteValue(value) { if (ask.input && ask.input.value !== value) ask.input.value = value; },
    isHidden: () => doc?.hidden === true,
    prefersReducedMotion: reduced,
    emitState(detail) {
      if (typeof win.CustomEvent === 'function') root.dispatchEvent(new win.CustomEvent(PORTAL_STATE_EVENT, { bubbles: true, detail }));
    },
    /* 화면 확인용: 그 순간 무대의 값(흐름 시험이 읽는다) */
    debug: () => ({ stage: stage.state(), sigActive: sig.active }),
    dispose() {
      if (disposed) return;
      disposed = true;
      clearTimeout(settleTimer);
      clearTimeout(progTimer);
      clearTimeout(visTimer);
      clearTimeout(visLeave);
      if (introWait) introWait();
      root.removeEventListener('click', onClick);
      root.removeEventListener('scroll', onRoomScroll, true);
      root.removeEventListener('submit', onSubmit);
      root.removeEventListener('input', onInput);
      root.removeEventListener(QA_GUEST_EVENT, onQaGuest);
      stageEl.removeEventListener('pointermove', onPointerMove);
      stageEl.removeEventListener('pointerleave', onPointerLeave);
      doc.removeEventListener('keydown', onAnyKey, true);
      doc.removeEventListener('pointerdown', onAnyPointer, true);
      doc.removeEventListener('keydown', onKeyDown);
      doc.removeEventListener('paste', onPaste);
      doc.removeEventListener('focusin', onFocusIn);
      doc.removeEventListener('visibilitychange', onVisibility);
      if (options.managePageShow !== true) win.removeEventListener?.('pageshow', onPageShow);
      win.removeEventListener?.('pagehide', onPageHide);
      resizeObserver?.disconnect();
      sig.stop();
      stage.dispose();
      setHostLocked(false);
      root.hidden = true;
      root.dataset.portalActive = 'false';
      root.dataset.portalState = 'entered';
      root.dataset.orbClient = 'off';
      delete root.dataset.portalAuthStatus;
      delete root.dataset.portalWorkspaceStatus;
      if (doc?.documentElement?.dataset) { delete doc.documentElement.dataset.portalActive; delete doc.documentElement.dataset.orbClient; }
      root.innerHTML = '';
    },
  };
}
