// 입장 검사 — WORLD 캠퍼스 판의 연출(2026-11-04 2판): 입장 부스 1인칭, 내 손짓마다 손님 얼굴이 받아친다.
// app.mjs는 WORLD일 때 이 모듈을 만들기만 하고, 여기서는 게임 화면의 사건(손님 사진 · 서류 · 짐 · 도장 자국 · 판정 판 · 결과)을 지켜보며
// 보이고 들리는 것만 더한다 — 규칙 · 판정 · 학습 기록 · 코인 · 목소리 재생 길은 app.mjs · core.mjs · audio.mjs 그대로다. view()는 복사본이라 읽기만 된다.
// 주문 폭주 2판의 효과음 규칙 · 음악 덕킹 · 움직임 토큰 여섯을 그대로 쓴다. 설계: qa/world-campus-20261104/2판_설계.md.
//
// 표정(5절): 찍기 전 반응(긴장)은 답과 상관없이 늘 같다 — 표정이 답을 알려 주면 혼자 해낸 읽기 기록이 오염된다.
// 맞고 틀림은 찍은 뒤의 얼굴로만 돌려준다(통과 · 머쓱 · 몰래 · 갸웃). 움직임은 도장이 닿는 순간과 얼굴에 몰아 쓴다(조사: 많이 움직일수록 싸 보인다).
import { createSfx, createLimiter } from './world-sfx.mjs';
import { createMusic } from './world-music.mjs';
import * as fx from './world-fx.mjs';
import { WORLD_VENUES, MOODS, RULE_KEYS, EXPRESSIONS, SNEAKY, worldGuestImage, worldGuestFace } from './world-content.mjs';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const recall = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const COMBO_AT = new Set([3, 5]);
// LAB 원고가 화면 글에 직접 쓴 근무지 이름(app.mjs 입구 안내) → 캠퍼스 판 이름. 원고 글은 world-content.mjs가 이미 바꿨다.
const VENUE_NAMES = Object.values(WORLD_VENUES).map((v) => [v.from, v.name]);
const fixNames = (t) => VENUE_NAMES.reduce((s, [a, b]) => s.split(a).join(b), t);
const INK = { pass: '#2F6B3A', reject: '#B5372B' };
const TICK = '<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M7 15l5 5 10-12"/></svg>';
const inkSvg = (word, color) => `<svg viewBox="0 0 116 66" aria-hidden="true"><g filter="url(#ink)" transform="rotate(-5 58 33)"><rect x="3" y="3" width="110" height="60" rx="11" fill="none" stroke="${color}" stroke-width="4"/><text x="58" y="44" text-anchor="middle" font-family="SUIT" font-weight="900" font-size="30" fill="${color}" letter-spacing="3">${word}</text></g></svg>`;

/**
 * sound: audio.mjs(목소리 · 오디오 문맥), CAST: 원고 손님(이름 · 하는 일), view: app.mjs 근무 상태의 복사본.
 * 손님 · 짐 · 근무지 사진은 assets/world/manifest.json에 있는 것만 쓴다 — 아직 굽지 않은 표정은 말함 판 그대로, 굽지 않은 짐은 글 칸이다.
 */
export function createWorldPlay({ sound, CAST = {}, view = () => null }) {
  let sfx = null, music = null, analyser = null, levels = null, bars = [], barRaf = 0;
  let have = { guests: new Set(), items: new Set(), venues: new Set(), masks: new Set() }, haveReady = false;
  const lastPlay = new Map(), warmed = new Map();
  const pref = (name) => recall(`synk.world.${name}`) !== 'false';   // WORLD 앱 「효과음」 · 「진동」(world-sound.mjs와 같은 열쇠)
  const moving = () => fx.motionOn() && !document.body.classList.contains('still');
  const decided = () => !!view()?.done;

  /* ── 소리: audio.mjs의 문맥 하나를 함께 쓴다(문맥을 둘 만들면 첫 탭이 멈췄다 — 주문 폭주 11-03 추적) ── */
  sound.useWorldMode({ skipVoice: (id) => id.startsWith('nar-') });   // 안내 목소리(몽글)는 내지 않는다 — 연수 · 알림 · 「그 뒤에 생긴 일」은 글로만
  function ensure() {
    if (sfx) return true;
    const ctx = sound.context();
    if (!ctx) return false;
    const output = createLimiter(ctx);   // 목소리 · 효과음 · 음악의 합이 스피커에서 찌그러지지 않게 한 끝으로 모은다
    sound.routeOutput(output);
    sfx = createSfx(ctx, { on: () => sound.isOn() && pref('sound'), destination: output });
    music = createMusic(ctx, { storage: (() => { try { return localStorage; } catch { return null; } })(), destination: output });
    music.setOn(sound.isOn());
    try {   // 목소리 막대: 목소리 마디 옆에 분석기만 단다(소리 길은 그대로)
      analyser = ctx.createAnalyser(); analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.55;
      sound.voiceOutput()?.connect(analyser);
      levels = new Uint8Array(analyser.frequencyBinCount);
    } catch { analyser = null; }
    return true;
  }
  function play(name, opts) {
    if (!ensure()) return 0;
    const now = performance.now();
    if (now - (lastPlay.get(name) || 0) < 50 && name !== 'roll') return 0;
    lastPlay.set(name, now);
    return sfx.play(name, opts);
  }
  function haptic(kind = 'ok') {
    if (!pref('haptic') || !navigator.userActivation?.hasBeenActive) return;
    try { if (typeof navigator.vibrate === 'function') navigator.vibrate(kind === 'stamp' ? [16] : kind === 'done' ? [14, 40, 18] : [8]); } catch { /* 없음 */ }
  }
  // 아이폰 무음 스위치: 효과음 · 음악은 ambient(무음 모드를 따른다). 손님 목소리도 같은 Web Audio 길이라 따로 걸지 않는다.
  const ambient = () => { try { const s = navigator.audioSession; if (s && s.type !== 'ambient') s.type = 'ambient'; } catch { /* 없음 */ } };

  /* ── 얼굴 ── 두 장을 번갈아 겹쳐 바꾼다(얼굴 안쪽만 다른 판이라 몸 · 풍경은 움직이지 않는다) */
  let curWho = null, reactTimer = 0, speakingNow = false, shownMood = 'talk';
  let moodLayers = [];
  function warmGuest(who) {
    for (const mood of MOODS) {
      const key = `${who}-${mood}`;
      if (!have.guests.has(key) || warmed.has(key)) continue;
      const im = new Image(); im.src = worldGuestImage(who, mood); im.decode?.().catch(() => {}); warmed.set(key, im);
    }
  }
  function face(mood) {
    if (!curWho || !moodLayers.length) return;
    clearTimeout(reactTimer);
    for (const l of moodLayers) l.onload = null;   // 받는 중이던 앞 표정이 뒤늦게 지금 얼굴을 덮지 않게
    shownMood = mood;
    const [top, under] = moodLayers;
    if (mood === 'talk' || !have.guests.has(`${curWho}-${mood}`)) { top.style.opacity = '0'; under.style.opacity = '0'; shownMood = 'talk'; return; }
    const src = worldGuestImage(curWho, mood);
    if (top.getAttribute('src') === src) { top.style.opacity = '1'; return; }
    const show = () => { under.onload = null; under.style.zIndex = '2'; top.style.zIndex = '1'; under.style.opacity = '1'; top.style.opacity = '0'; moodLayers = [under, top]; };
    under.src = src;
    if (under.complete && under.naturalWidth) show(); else under.onload = show;
  }
  const rest = () => { if (!decided()) face(speakingNow ? 'talk' : 'idle'); };
  /** 찍기 전 잠깐의 반응: 답과 상관없이 같은 표정, 잠시 뒤 제자리로. */
  function react(mood, ms = 1800) {
    if (!curWho || decided()) return;
    face(mood);
    reactTimer = setTimeout(rest, ms);
  }

  /* ── 목소리: 음악 덕킹 · 효과음 −4dB · 자막 막대 · 입 ── */
  let pendingOops = null, oopsTimer = 0, verdictAt = 0;
  sound.addSpeakingListener((id) => {
    const guest = !!id && !id.startsWith('nar-');
    speakingNow = guest;
    if (!ensure()) return;
    music.voice(guest);
    sfx.duck(guest);
    $('#bubble')?.classList.toggle('w-speaking', guest);
    if (guest && analyser && !barRaf) barRaf = requestAnimationFrame(drawBars);
    if (decided()) {   // 대답 목소리가 끝난 다음 박자에 「그 뒤에 생긴 일」(그 글은 목소리가 없다)
      if (!guest && pendingOops) { clearTimeout(oopsTimer); oopsTimer = setTimeout(showOops, Math.max(240, verdictAt + 1100 - performance.now())); }
    } else if (!guest && shownMood === 'talk') face('idle');   // 말이 끝나면 입을 다문다
    else if (guest && id.startsWith('line-')) face('talk');
  });
  function drawBars() {
    barRaf = 0;
    const live = $$('.w-speaking .w-bars i');
    if (!live.length || !analyser) { for (const b of bars) b.style.transform = ''; return; }
    analyser.getByteFrequencyData(levels);
    const bands = [[2, 6], [6, 12], [12, 20], [20, 32], [32, 48]];
    live.forEach((b, i) => {
      const [a, z] = bands[i % bands.length];
      let m = 0; for (let k = a; k < z; k += 1) m = Math.max(m, levels[k]);
      b.style.transform = moving() ? `scaleY(${(0.22 + Math.min(1, m / 210) * 0.78).toFixed(3)})` : '';
    });
    barRaf = requestAnimationFrame(drawBars);
  }

  /* ── DOM: WORLD에서만 붙이는 층(id · data-* · 클래스는 LAB 그대로) ── */
  function setup() {
    const frame = $('.frame'), guest = $('#guest');
    // 근무 화면의 제목 · 별점을 읽기 프로그램도 알게(LAB HTML은 그대로): 근무 화면에 숨은 제목, 별점은 그림 하나로
    if (!$('#game h1')) { const h = document.createElement('h1'); h.className = 'w-sr'; h.textContent = '입장 검사 근무'; $('#game')?.prepend(h); }
    $('#r-stars')?.setAttribute('role', 'img');
    for (const id of ['#who', '#line']) { const n = $(id); if (n) n.textContent = ''; }   // LAB HTML에 적힌 자리 글(옛 손님 이름) — 첫 손님이 오면 app.mjs가 채운다
    if (frame && !$('.w-booth', frame)) {
      const booth = new Image(); booth.className = 'w-booth'; booth.alt = ''; booth.src = 'assets/world/booth.webp'; booth.decoding = 'async';
      frame.prepend(booth);
      for (let i = 0; i < 2; i += 1) { const m = new Image(); m.className = 'w-mood'; m.alt = ''; m.decoding = 'async'; guest?.append(m); moodLayers.push(m); }
      const word = document.createElement('div'); word.className = 'w-word'; word.setAttribute('aria-hidden', 'true');
      const frontImg = new Image(); frontImg.className = 'w-front'; frontImg.alt = ''; frontImg.hidden = true;
      guest?.after(word, frontImg);
      const blind = document.createElement('div'); blind.className = 'w-blind'; blind.setAttribute('aria-hidden', 'true');
      blind.innerHTML = '<i></i>'.repeat(9);
      frame.append(blind);
    }
    const who = $('#bubble .who');
    if (who && !$('.w-role', who)) { const r = document.createElement('span'); r.className = 'w-role'; $('#who')?.after(r); }
    if (who && !$('.w-bars', who)) { const b = document.createElement('span'); b.className = 'w-bars'; b.setAttribute('aria-hidden', 'true'); b.innerHTML = '<i></i>'.repeat(5); who.append(b); }
    // 판정 뒤 자막: 대답 · 그 뒤에 생긴 일. 읽기 프로그램은 app.mjs의 announce가 맡으니 이 칸은 다시 읽지 않는다
    if (!$('.w-said')) { const s = document.createElement('p'); s.className = 'w-said'; s.setAttribute('aria-hidden', 'true'); $('#line')?.after(s); }
    bars = $$('.w-bars i');
    if (!$('#w-stamp-head')) { const h = new Image(); h.id = 'w-stamp-head'; h.alt = ''; h.hidden = true; h.decoding = 'async'; h.src = 'assets/world/stamp-head.webp'; document.body.append(h); }
    for (const btn of $$('.stamp-btn')) if (!$('.w-pad-stamp', btn)) { const s = new Image(); s.className = 'w-pad-stamp'; s.alt = ''; s.draggable = false; s.src = 'assets/world/stamp-head.webp'; btn.prepend(s); }
    // 손님 칸 여섯(오늘의 도장 판)은 위 막대에 — renderShiftLog는 id로 찾으니 그대로 그린다
    const bar = $('.game-bar'), log = $('#shiftlog');
    if (bar && log && log.parentElement !== bar) bar.insertBefore(log, $('#pause'));
    // 입구: 빈 부스 창 사진 위에 「입장 검사」 도장 자국 제목(hero-art의 펠트 그림 · 몽글은 CSS로 숨긴다 — app.mjs가 id로 찾는 것은 남긴다)
    const hero = $('.hero');
    if (hero && !$('.w-hero', hero)) {
      const art = document.createElement('div'); art.className = 'w-hero'; art.setAttribute('aria-hidden', 'true');
      art.innerHTML = `<img src="assets/world/booth.webp" alt="" decoding="async"><div class="w-hero-stamp"><svg viewBox="0 0 320 132"><g filter="url(#ink)">
        <rect x="6" y="6" width="308" height="120" rx="18" fill="none" stroke="currentColor" stroke-width="6"/>
        <rect x="18" y="18" width="284" height="96" rx="11" fill="none" stroke="currentColor" stroke-width="2"/>
        <text x="160" y="84" text-anchor="middle" font-family="SUIT" font-weight="900" font-size="58" letter-spacing="6" fill="currentColor">입장 검사</text>
        <text x="160" y="106" text-anchor="middle" font-family="DM Mono" font-size="12" letter-spacing="3" fill="currentColor">CAMPUS FESTIVAL · STAFF</text></g></svg></div>`;
      hero.prepend(art);
    }
    // 입구 글: 축제 스태프 알바(LAB의 「수영장, 도서관 …」 소개 대신)
    const COPY = [
      ['.hero-copy .kicker', '봄 축제 주간 · 입장 스태프 알바'],
      ['.hero-copy .sub', '날마다 규칙이 바뀌고, 몰래 들어오려는 손님도 와요. 안내문을 읽고 표와 짐을 맞춰 보고 도장을 찍어요.'],
      ['#how-title', '나는 오늘의 입장 스태프'],
    ];
    for (const [sel, text] of COPY) { const n = $(sel); if (n) n.textContent = text; }
    // 결과 아래 흰 알약 「우리 동네로」(말의 리듬 · 주문 폭주 WORLD와 같은 꼴). 닿지 않으면(틀 밖) 근무지 고르기로.
    const results = $('#results');
    if (results && !$('.w-room-bar', results)) {
      const roomBar = document.createElement('div'); roomBar.className = 'w-room-bar';
      roomBar.innerHTML = '<button id="w-room" class="felt-cta w-room" type="button"><span>우리 동네로</span><i class="disc" aria-hidden="true"></i></button>';
      roomBar.firstChild.addEventListener('click', backToTown);
      results.append(roomBar);
    }
    addTicks();
    document.documentElement.classList.add('w-ready');
    // 입구 첫 순간(처음 한 번): 사진이 밝아지고(느린 효과) 「입장 검사」 도장이 사진 위에 내려앉는다(빠른 공간)
    const photo = $('.w-hero>img'), stamp = $('.w-hero-stamp');
    if (photo && stamp) {
      fx.effect(photo, [{ opacity: .6 }, { opacity: 1 }], fx.M.eslow);   // 큰 사진에 흐림을 걸면 합성기로 못 가 끊긴다
      fx.spatial(stamp, [{ transform: 'translateX(-50%) rotate(-6deg) scale(1.6)', opacity: 0 }, { transform: 'translateX(-50%) rotate(-6deg) scale(1)', opacity: .94 }], fx.M.fast, { delay: 420 });
    }
  }
  function backToTown() {
    music?.stop(0.4); sound.stopVoice();
    for (const t of stampTimers) clearTimeout(t);
    stampTimers = [];
    try {
      const town = window.parent?.__synkHome?.goTown;
      if (town) { town(); return; }
      const close = window.parent?.document?.getElementById('panel-close');
      if (close) { close.click(); return; }
    } catch { /* 다른 출처의 틀 */ }
    $('#r-home')?.click();
  }

  /* ── 내 체크: 안내문 줄을 누르면 펜으로 체크(점수 · 기록과 상관없다, 다음 손님에 지워진다). 손님은 긴장한다 ── */
  function addTicks() {
    for (const li of $$('#rules li, #memo-rules li')) {
      if ($('.w-tick', li)) continue;
      const no = $('.rn', li)?.textContent || '';
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'w-tick'; b.setAttribute('aria-pressed', 'false'); b.setAttribute('aria-label', `${no}번 규칙 확인 표시`); b.innerHTML = TICK;
      b.addEventListener('click', (e) => { e.stopPropagation(); toggleTick(b); });
      li.append(b);
    }
  }
  function toggleTick(b) {
    if (decided() || $('#notice').classList.contains('choosing')) return;
    const on = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(on));
    play('tap');
    if (on) react('nervous', 1600);
  }

  /* ── 도장 집기: 누른 채 들고 있으면 손 밑에 도장이 따라오고 손님이 반응한다(통과는 기대, 거절은 긴장 — 답과 상관없이 같다).
   *  책상이나 창 위에 놓거나 그 자리에서 떼면 찍히고, 도장 줄의 다른 곳에 놓으면 내려놓은 것이다. 그냥 탭은 지금까지와 똑같다. ── */
  let carriedFrom = null;
  function setupCarry() {
    const head = $('#w-stamp-head'), dock = $('.dock');
    for (const [sel, mood] of [['#btn-pass', 'pass'], ['#btn-reject', 'nervous']]) {
      const btn = $(sel);
      if (!btn || !head) continue;
      let timer = 0, carrying = false, last = null, swallow = false;
      const follow = (e) => { last = { x: e.clientX, y: e.clientY }; head.style.left = `${e.clientX - 60}px`; head.style.top = `${e.clientY - 100}px`; };
      btn.addEventListener('pointerdown', (e) => {
        if (btn.disabled || decided() || e.button) return;
        last = { x: e.clientX, y: e.clientY };
        const id = e.pointerId;
        clearTimeout(timer);
        // 들기 전에 손을 떼면 들지 않는다 — 마우스는 단추 밖에서 뗄 수 있어 창에서 듣는다
        const letGo = () => { clearTimeout(timer); removeEventListener('pointerup', letGo); removeEventListener('pointercancel', letGo); };
        addEventListener('pointerup', letGo);
        addEventListener('pointercancel', letGo);
        timer = setTimeout(() => {
          removeEventListener('pointerup', letGo); removeEventListener('pointercancel', letGo);
          if (btn.disabled || decided()) return;
          carrying = true;
          try { btn.setPointerCapture(id); } catch { /* 이미 뗌 */ }
          btn.classList.add('w-out');
          follow({ clientX: last.x, clientY: last.y });
          head.hidden = false;
          play('choose');
          face(mood);
        }, 140);
      });
      btn.addEventListener('pointermove', (e) => { if (carrying) follow(e); else last = { x: e.clientX, y: e.clientY }; });
      const drop = (e, cancelled = false) => {
        clearTimeout(timer);
        if (!carrying) return;
        carrying = false;
        head.hidden = true;
        btn.classList.remove('w-out');
        const box = btn.getBoundingClientRect(), overBtn = e.clientX >= box.left && e.clientX <= box.right && e.clientY >= box.top && e.clientY <= box.bottom;
        const stamped = !cancelled && (overBtn || e.clientY < dock.getBoundingClientRect().top);
        // 브라우저가 뒤따라 내는 진짜 click은 삼킨다(길게 누른 뒤에는 오기도 안 오기도 한다)
        swallow = true; setTimeout(() => { swallow = false; }, 400);
        if (stamped) { if (sel === '#btn-pass') carriedFrom = last; btn.click(); } else rest();   // 거절은 이유를 고른 뒤에 찍혀 손 자리를 잇지 않는다
      };
      btn.addEventListener('pointerup', (e) => drop(e));
      btn.addEventListener('pointercancel', (e) => drop(e, true));
      btn.addEventListener('lostpointercapture', (e) => drop(e, true));
      btn.addEventListener('contextmenu', (e) => { if (carrying) e.preventDefault(); });
      btn.addEventListener('click', (e) => { if (e.isTrusted && swallow) { swallow = false; e.stopImmediatePropagation(); e.preventDefault(); } }, true);
    }
  }

  /* ── 책상 ── 창은 늘 보이고 책상만 스크롤된다. 판정 판이 덮는 만큼을 빼고 도장 칸 · 근거 줄이 보이게 민다(근거 줄이 먼저) */
  function settleDesk(rule, { smooth = true } = {}) {
    const desk = $('.desk'), doc = $('#doc'), fb = $('#feedback');
    if (!desk || !doc) return;
    const box = desk.getBoundingClientRect();
    const covered = fb && !fb.hidden && (!rule || fb.getBoundingClientRect().left < rule.getBoundingClientRect().right);
    const room = Math.min(box.bottom, covered ? innerHeight - fb.offsetHeight : box.bottom) - box.top - 8;
    const at = (n) => { const r = n.getBoundingClientRect(); return [r.top - box.top + desk.scrollTop, r.bottom - box.top + desk.scrollTop]; };
    let y = at(doc)[1] - room;
    if (rule) { const [top, bottom] = at(rule); if (bottom - y > room) y = bottom - room; if (top - 6 < y) y = top - 6; }
    desk.scrollTo({ top: Math.max(0, y), behavior: smooth && moving() ? 'smooth' : 'auto' });
  }

  /* ── 사건 ── */
  /** 손님 사진(#guest-img)이 바뀌면: 오른쪽 24px에서 제자리(기본 공간) + 손님 종. */
  function onGuest(img) {
    const m = /guests\/(\w+)-talk/.exec(img.getAttribute('src') || '');
    if (!m) return;
    curWho = m[1];
    clearEvidence();
    pendingOops = null; clearTimeout(oopsTimer);
    for (const l of moodLayers) { l.style.opacity = '0'; l.removeAttribute('src'); }
    shownMood = 'talk';
    const role = $('.w-role'); if (role) role.textContent = CAST[curWho]?.label || '';
    const frame = $('.frame'), g = $('#guest');
    frame.dataset.who = curWho;   // 아이 손님은 얼굴이 아래쪽이라 사진 자리를 내린다(world-skin.css)
    const word = $('.w-word'), front = $('.w-front');
    if (word) { word.getAnimations?.().forEach((a) => a.cancel()); word.textContent = ''; word.style.opacity = '0'; }
    if (front) front.hidden = true;
    frame.classList.remove('w-after', 'w-verdict');
    $('#bubble')?.classList.remove('w-answered', 'w-after-line');
    for (const t of $$('.w-tick[aria-pressed=true]')) t.setAttribute('aria-pressed', 'false');
    for (const b of $$('.stamp-btn.w-out')) b.classList.remove('w-out');
    const st = view();
    warmGuest(curWho);
    setTimeout(() => { for (const who of st?.queue?.slice((st.index ?? 0) + 1, (st.index ?? 0) + 3) || []) warmGuest(who); }, 700);   // 다음 손님은 들어오는 움직임이 끝난 뒤에
    play('arrive', { guest: curWho });
    for (const a of g.getAnimations?.() || []) a.cancel();   // 앞 손님이 물러난 끝 상태(fill forwards)를 걷는다
    fx.spatial(g, [{ transform: 'translateX(24px)', opacity: 0 }, { transform: 'none', opacity: 1 }], fx.M.base);
    fx.effect($('#bubble'), [{ opacity: 0 }, { opacity: 1 }], fx.M.eslow, { delay: 120 });
    // 말이 끝나면 입을 다문다 — 글로만 나오는 손님 · 목소리를 끈 사람은 잠시 뒤에
    if (st?.item?.textOnly || !sound.isVoiceOn() || !sound.isOn()) reactTimer = setTimeout(rest, 1500);
  }
  /** 다음 손님으로 넘길 때: 들여보낸 손님은 왼쪽으로, 돌려보낸 손님은 오른쪽으로 물러난다. */
  function onLeave(kind) {
    if (!curWho) return;
    play('leave', { guest: curWho });
    fx.spatial($('#guest'), [{ transform: 'none', opacity: 1 }, { transform: `translateX(${kind === 'in' ? -28 : 28}px)`, opacity: 0 }], fx.M.base, { fill: 'forwards' });
    const word = $('.w-word'), front = $('.w-front');
    if (word) word.style.opacity = '0';
    if (front) front.hidden = true;
  }
  /** 도장(#stamp-mark.hit) — 이 게임의 간판 한 박자, 판정 판이 뜨는 380ms 안에 끝난다:
   *  t0 도장이 패드를 떠나 표 위로 내려온다(130ms, 내려치는 가속 곡선 하나만 토큰 밖 — 주문 폭주 제목의 떠밀림과 같은 곡선) →
   *  +130 닿음: 고무 소리 · 진동 · 잉크가 도장 칸에 찍히고 표가 받힌다(빠른 공간) → +200 도장이 올라가 사라진다(기본 효과). */
  function onStamp(mark) {
    const pass = /통과/.test(mark.textContent || ''), svg = $('svg', mark), doc = $('#doc');
    const btn = $(pass ? '#btn-pass' : '#btn-reject');
    ambient();
    btn?.classList.add('w-out');
    settleDesk(null, { smooth: false });   // 도장 칸이 책상 아래로 내려가 있으면 먼저 끌어온다
    const contact = () => {
      play(pass ? 'stampPass' : 'stampReject');
      haptic('stamp');
      if (svg) { svg.style.opacity = ''; fx.spatial(svg, [{ transform: 'scale(1.1)', opacity: .35 }, { transform: 'scale(1)', opacity: 1 }], fx.M.fast); }
      fx.spatial(doc, [{ transform: 'rotate(-.35deg) translateY(0)' }, { transform: 'rotate(-.35deg) translateY(3px) scale(.996)' }, { transform: 'rotate(-.35deg)' }], fx.M.fast);
    };
    const head = $('#w-stamp-head');
    const done = () => { btn?.classList.remove('w-out'); };
    if (!head || !head.complete || !head.naturalWidth || !moving() || !mark.getBoundingClientRect().width) { contact(); done(); return; }
    if (svg) svg.style.opacity = '0';
    const r = mark.getBoundingClientRect(), size = 120;
    head.style.left = `${r.left + r.width / 2 - size / 2}px`;
    head.style.top = `${r.top + r.height - size * 0.96}px`;   // 받침 아래가 자국 아래에 닿는다
    head.hidden = false;
    // 들고 있던 도장은 손 자리에서 바로 내려온다
    const landX = r.left + r.width / 2, landY = r.top + r.height - size * 0.96 + 100, from = carriedFrom;
    carriedFrom = null;
    const start = from ? { transform: `translate(${from.x - landX}px,${from.y - landY}px) scale(1.14)`, opacity: 1 } : { transform: 'translateY(-150px) scale(1.14)', opacity: 0 };
    const down = head.animate([start, ...(from ? [] : [{ transform: 'translateY(-60px) scale(1.06)', opacity: 1, offset: .4 }]), { transform: 'none', opacity: 1 }], { duration: 130, easing: 'cubic-bezier(.55,0,.9,.45)', fill: 'forwards' });
    down.finished.then(() => {
      contact();
      setTimeout(() => {
        const up = head.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(-70px) scale(1.05)', opacity: 0 }], { ...fx.M.ebase, fill: 'forwards' });
        down.cancel();
        up.finished.then(() => { head.hidden = true; up.cancel(); done(); }, () => { head.hidden = true; done(); });
      }, 70);
    }, () => { contact(); head.hidden = true; done(); });
  }

  /** 근거: 근거 규칙의 핵심 낱말에 형광펜 + 같은 색으로 표 칸 · 짐 · 시계. 하나의 색이 둘을 잇는다(네모 · 동그라미 · 선을 겹치지 않는다). */
  function showEvidence(st) {
    const { item, venue, itemRule, docRule } = st, ids = item.evidence || [];
    let first = null;
    for (const id of ids) {
      const rt = $(`#notice .rule[data-rule="${id}"] .rt`);
      if (!rt) continue;
      first ||= rt;
      const plain = rt.dataset.plain ?? rt.textContent;
      rt.dataset.plain = plain;
      let html = esc(plain);
      for (const phrase of RULE_KEYS[`${venue.id}.${id}`] || []) html = html.split(esc(phrase)).join(`<mark class="w-key">${esc(phrase)}</mark>`);
      rt.innerHTML = html;
    }
    if (item.look === 'clock') $('#clock-wrap')?.classList.add('w-evidence');
    if (item.look === 'doc') {
      const keys = ids.flatMap((r) => docRule[r] || []);
      for (const dd of $$('#doc-rows dd')) if (keys.includes(dd.dataset.key)) dd.classList.add('w-evidence');
    }
    if (item.look === 'items') for (const li of $$('#tray li[data-item]')) if (ids.includes(itemRule[li.dataset.item])) li.classList.add('w-evidence');
    settleDesk(first);
    requestAnimationFrame(() => { for (const m of $$('mark.w-key')) m.classList.add('on'); });
  }
  function clearEvidence() {
    for (const rt of $$('#notice .rt[data-plain]')) { rt.textContent = rt.dataset.plain; delete rt.dataset.plain; }
    for (const n of $$('.w-evidence')) n.classList.remove('w-evidence');
    $('.desk')?.scrollTo?.({ top: 0 });
  }
  /** 큰 글자가 사람 뒤로: 사진 → 글자 → 사람만 도려낸 같은 사진. 마스크가 없는 손님은 글자를 얹지 않는다. */
  function bigWord(text, kind, mood) {
    const word = $('.w-word'), front = $('.w-front');
    if (!word || !front || !curWho || !have.masks.has(curWho)) return;
    word.textContent = text; word.dataset.kind = kind;
    front.style.setProperty('--who-mask', `url(assets/world/guests/mask/${curWho}.webp)`);
    front.src = worldGuestImage(curWho, have.guests.has(`${curWho}-${mood}`) ? mood : 'talk');
    const who = curWho, show = () => {
      if (who !== curWho || !view()?.done) return;
      front.hidden = false; word.style.opacity = '1';
      fx.spatial(word, [{ transform: 'scale(1.2) translateY(10px)', opacity: 0 }, { transform: 'none', opacity: 1 }], fx.M.fast);
    };
    (front.decode?.() || Promise.resolve()).then(show, show);
  }
  function said(text, { after = false } = {}) {
    const box = $('.w-said'), bubble = $('#bubble');
    if (!box || !bubble) return;
    box.textContent = text;
    bubble.classList.add('w-answered');
    bubble.classList.toggle('w-after-line', after);
  }
  /** 찍은 뒤의 사건(코미디 한 박자): 놓친 손님은 창이 흑백으로 가라앉고 자막이 그 뒤에 생긴 일로 바뀐다. */
  function showOops() {
    if (!pendingOops) return;
    const { text, letIn } = pendingOops;
    pendingOops = null;
    if (letIn) $('.frame')?.classList.add('w-after');
    said(text, { after: true });
  }
  /** 판정 판(#feedback)이 열리면: 얼굴 → 큰 글자 → 판 → 근거. 맞음은 맞음 오르막, 틀림은 묻는 두 음(실패음 없음). */
  function onVerdict(fb) {
    const st = view(), r = st?.results?.at(-1);
    if (!r || !st.item) return;
    verdictAt = performance.now();
    const pass = r.choice === 'pass';
    // 놓친 손님의 씩 웃음은 몰래 들어오려던 대사에만 — 그냥 물어본 아이 · 어르신은 「고마워요」 웃음(원고의 말과 맞춘다)
    const mood = r.correct ? (pass ? 'pass' : 'sorry') : pass ? (SNEAKY.has(r.caseId) ? 'sly' : 'pass') : 'puzzled';
    face(mood);
    $('.frame')?.classList.add('w-verdict');
    bigWord(r.correct ? (pass ? '통과' : '거절') : '아차!', r.correct ? (pass ? 'pass' : 'reject') : 'oops', mood);
    const combo = st.combo || 0;
    if (r.correct) { play('correct', { combo }); if (COMBO_AT.has(combo)) setTimeout(() => play('combo'), 260); haptic(); }
    else play('differ');
    said(($('#fb-reply')?.textContent || '').replace(/^[^:“]*:\s*/, '').replace(/^“|”$/g, ''));
    // 얼굴을 먼저 보게 판은 한 박자 늦게 올라온다
    fx.spatial(fb, [{ transform: 'translateY(100%)' }, { transform: 'none' }], fx.M.base, { delay: 220 });
    setTimeout(() => { if (view()?.item?.id === st.item.id) showEvidence(st); }, moving() ? 300 : 0);
    const wrongDoor = !r.correct && (pass || r.expected === 'pass');
    if (wrongDoor && st.item.oops) {
      pendingOops = { text: st.item.oops, letIn: pass };
      clearTimeout(oopsTimer);
      oopsTimer = setTimeout(() => { if (!speakingNow) showOops(); }, moving() ? 1600 : 600);
    }
  }
  /** 표 · 카드: 손님 쪽(위)에서 책상으로 놓인다 + 종이 쓱. */
  function onDoc() {
    const doc = $('#doc'), item = view()?.item;
    if (doc) doc.dataset.kind = item?.doc?.kind || 'ticket';
    if (!$('#doc-rows').children.length) return;
    play('slide');
    fx.spatial(doc, [{ transform: 'translateY(-26px) rotate(-2deg)', opacity: 0 }, { transform: 'rotate(-.35deg)', opacity: 1 }], fx.M.base, { delay: 180 });
  }
  /** 짐: 오린 사진으로 바꾸고(굽지 않은 짐은 글 칸) 하나씩 쇠 쟁반에 놓인다(놓일 때마다 한 칸 위 땡). */
  function onTray({ quiet = false } = {}) {
    $$('#tray li[data-item]').forEach((li, i) => {
      const id = li.dataset.item, img = $('img', li);
      if (haveReady) {   // 목록을 받기 전에는 칸을 건드리지 않는다(받으면 다시 부른다)
        if (img) { if (have.items.has(id)) img.src = `assets/world/items/${id}.webp`; else img.remove(); }
        li.classList.toggle('w-photo', have.items.has(id));
      }
      if (quiet) return;
      const at = 320 + i * 110;
      setTimeout(() => play('place', { step: i + 1 }), at);
      fx.spatial(li, [{ transform: 'translateY(-14px) scale(1.06)', opacity: 0 }, { transform: 'none', opacity: 1 }], fx.M.fast, { delay: at });
    });
  }
  function onQueue() {
    for (const img of $$('#queue img')) {
      const m = /guests\/(\w+)-talk/.exec(img.getAttribute('src') || '');
      if (m) img.src = worldGuestFace(m[1]);
    }
  }
  /** 도장 판(위 막대의 손님 칸): 찍을 때마다 그 칸에 잉크가 찍힌다. */
  let doneShown = 0;
  function onSlots() {
    const done = $$('#shiftlog li.done');
    if (done.length > doneShown && done.at(-1)) fx.spatial(done.at(-1), [{ transform: 'scale(1.7)' }, { transform: 'scale(1)' }], fx.M.fast);
    doneShown = done.length;
  }
  /** 근무 전 안내: 오늘 근무지 사진 + 큰 제목. 「창문 열기」에서 블라인드가 걷히며(느린 공간) 음악이 들어온다. */
  function onBrief(n) {
    const st = view(), id = st?.venue?.id;
    n.style.setProperty('--venue-img', `url(assets/world/${have.venues.has(id) ? `venues/${id}.webp` : 'booth.webp'})`);
    closeBlind(); music?.stop(0.6); doneShown = 0;
    // 새 화면의 첫 그리기(큰 사진 · 게임 화면)가 끝난 뒤에 움직인다 — 같이 시작하면 처음 몇 장이 끊긴다
    fx.spatial($('#brief-title'), [{ transform: 'translateY(16px)', opacity: 0 }, { transform: 'none', opacity: 1 }], fx.M.base, { delay: 320 });
    fx.effect($('.brief-card p', n), [{ opacity: 0 }, { opacity: 1 }], fx.M.eslow, { delay: 480 });
    // 첫 손님 표정 판은 안내 화면의 움직임이 지난 뒤에 미리 받는다(느린 회선에서도 첫 표정이 제때 바뀌게). 다음 손님들은 onGuest가 받는다
    setTimeout(() => { const s = view(), who = s?.queue?.[s.index ?? 0]; if (who) warmGuest(who); }, 900);
  }
  function onBegin() {
    ensure(); ambient();
    play('open');
    const blind = $('.w-blind');
    if (blind) {
      blind.classList.add('open');
      if (moving()) fx.spatial(blind, [{ transform: 'translateY(0)' }, { transform: 'translateY(-101%)' }], fx.M.slow, { fill: 'forwards' });
    }
    setTimeout(() => music?.play('calm'), 300);
  }
  function closeBlind() {
    const blind = $('.w-blind');
    if (!blind) return;
    blind.getAnimations?.().forEach((a) => a.cancel());
    blind.classList.remove('open');
  }
  /** 결과: 음악이 물러나고 근무 끝 소리, 큰 숫자가 오르고, 도장 판에 손님마다 잉크가 찍히고, 그날 읽은 표현이 나온다. 탭하면 바로 끝. */
  let counter = null, stampTimers = [];
  function onResults() {
    const srLive = $('#sr-live');
    if (srLive) srLive.textContent = '';   // 결과 화면을 읽을 때 직전 손님 판정이 먼저 들리지 않게
    music?.stop(1.2);
    play('done'); haptic('done');
    const big = $('#r-correct'), to = Number(big?.textContent) || 0;
    let last = 0;
    counter = big ? fx.countUp(big, to, { duration: 260 + to * 120, onTick: () => { const n = performance.now(); if (n - last > 70) { last = n; play('roll'); } }, onLand: () => play('land') }) : null;
    for (const img of $$('#r-log img.face')) { const m = /guests\/(\w+)-talk/.exec(img.getAttribute('src') || ''); if (m) img.src = worldGuestFace(m[1]); }
    buildResults();
  }
  function buildResults() {
    const st = view(), grid = $('.res-grid');
    if (!st?.venue || !grid) return;
    $('.w-stampcard')?.remove(); $('.w-expr')?.remove();
    for (const t of stampTimers) clearTimeout(t);
    stampTimers = [];
    const cases = new Map(st.venue.cases.map((c) => [c.id, c]));
    const card = document.createElement('section'); card.className = 'w-stampcard';
    card.innerHTML = `<h2>오늘의 도장 판</h2><ol>${st.results.map((r) => {
      const who = CAST[r.who] || {};
      return `<li aria-label="${esc(`${who.name || ''} ${r.choice === 'pass' ? '통과' : '거절'} ${r.correct ? '맞음' : '다시 보기'}`)}"><img src="${worldGuestFace(r.who)}" alt="">${inkSvg(r.choice === 'pass' ? '통과' : '거절', r.choice === 'pass' ? INK.pass : INK.reject)}<small>${esc(r.correct ? (who.call || '') : '다시 보기')}</small></li>`;
    }).join('')}</ol>`;
    grid.prepend(card);
    $$('svg', card).forEach((s, i) => {
      if (!moving()) return;
      s.style.opacity = '0';
      stampTimers.push(setTimeout(() => {
        s.style.opacity = '';
        fx.spatial(s, [{ transform: 'rotate(-7deg) scale(1.5)', opacity: 0 }, { transform: 'rotate(-7deg) scale(1)', opacity: 1 }], fx.M.fast);
        play('place', { step: Math.min(5, i + 1) });
      }, 500 + i * 130));
    });
    // 오늘 읽은 표현: 틀린 손님의 근거 규칙을 앞에(다시 볼 표현), 나머지는 안내문 순서
    const missed = new Set(st.results.filter((r) => !r.correct).flatMap((r) => cases.get(r.caseId)?.evidence || []));
    const rules = [...st.venue.notice.rules, ...(st.venue.memo && st.memoShown ? [st.venue.memo.rule] : [])];
    const rows = [...rules.filter((r) => missed.has(r.id)), ...rules.filter((r) => !missed.has(r.id))].map((r) => ({ id: r.id, e: EXPRESSIONS[`${st.venue.id}.${r.id}`] })).filter((x) => x.e);
    const expr = document.createElement('article'); expr.className = 'paper w-expr';
    expr.innerHTML = `<h2>오늘 읽은 표현</h2><ul>${rows.map(({ id, e }) => `<li class="${missed.has(id) ? 'miss' : ''}"><b>${esc(e.form)}</b><q>${esc(e.quote)}</q><span>${esc(e.plain)}</span></li>`).join('')}</ul>`;
    card.after(expr);
  }
  /** 입구 근무지 카드: 펠트 그림 대신 근무지 사진(아직 없으면 빈 부스 창). */
  function onVenues() {
    for (const img of $$('#venues .thumb img')) {
      const id = img.closest('.venue')?.dataset.venue;
      const src = have.venues?.has(id) ? `assets/world/venues/${id}.webp` : 'assets/world/booth.webp';
      if (!img.src.endsWith(src)) img.src = src;
    }
  }

  const watch = (sel, opts, fn) => { const n = $(sel); if (n) new MutationObserver(() => fn(n)).observe(n, opts); return n; };
  watch('#guest-img', { attributes: true, attributeFilter: ['src'] }, onGuest);
  watch('#guest', { attributes: true, attributeFilter: ['class'] }, (g) => {
    if (g.classList.contains('leave-in')) onLeave('in'); else if (g.classList.contains('leave-out')) onLeave('out');
  });
  watch('#stamp-mark', { attributes: true, attributeFilter: ['class'] }, (m) => { if (m.classList.contains('hit')) onStamp(m); });
  watch('#feedback', { attributes: true, attributeFilter: ['hidden'] }, (fb) => { if (!fb.hidden) onVerdict(fb); });
  watch('#doc-rows', { childList: true }, onDoc);
  watch('#tray', { childList: true }, () => onTray());
  watch('#queue', { childList: true }, onQueue);
  watch('#shiftlog', { childList: true }, onSlots);
  watch('#rules', { childList: true }, addTicks);
  watch('#memo-rules', { childList: true }, addTicks);
  watch('#memo-alert', { attributes: true, attributeFilter: ['hidden'] }, (n) => { if (!n.hidden) { ambient(); play('notify'); } });
  // 거절 도장을 들면(이유 고르는 중) 긴장 — 취소하면 제자리로. 답과 상관없이 같다.
  watch('#notice', { attributes: true, attributeFilter: ['class'] }, (() => { let was = false; return (n) => {
    const now = n.classList.contains('choosing');
    if (now && !was) { play('choose'); if (!decided()) face('nervous'); } else if (!now && was) rest();
    was = now;
  }; })());
  watch('#btn-hint', { attributes: true, attributeFilter: ['data-level'] }, (() => { let lv = 0; return (b) => { const n = Number(b.dataset.level) || 0; if (n > lv) play('hint'); lv = n; }; })());
  watch('#briefing', { attributes: true, attributeFilter: ['hidden'] }, (n) => { if (!n.hidden) onBrief(n); });
  watch('#results', { attributes: true, attributeFilter: ['hidden'] }, (n) => {
    if (!n.hidden) { onResults(); return; }
    for (const t of stampTimers) clearTimeout(t);   // 결과를 떠나면 도장 판 소리도 멈춘다
    stampTimers = [];
  });
  watch('#lobby', { attributes: true, attributeFilter: ['hidden'] }, (n) => { if (!n.hidden) { music?.stop(0.6); onVenues(); } });
  watch('#venues', { childList: true }, onVenues);
  watch('#pause-dialog', { attributes: true, attributeFilter: ['open'] }, (d) => music?.pause(d.open));
  for (const sel of ['#rec-reason', '#r-next-reason', '#r-note', '#r-next-name']) {
    watch(sel, { childList: true, characterData: true, subtree: true }, (n) => { const t = fixNames(n.textContent); if (t !== n.textContent) n.textContent = t; });
  }
  for (const t of $$('[data-sound-toggle]')) new MutationObserver(() => music?.setOn(sound.isOn())).observe(t, { attributes: true, attributeFilter: ['aria-pressed'] });
  $('#btn-begin')?.addEventListener('click', onBegin);
  $('#results')?.addEventListener('pointerdown', () => counter?.skip(), { capture: true });
  // 손짓 반응: 표 · 짐을 살피거나 돋보기를 내가 누르면 손님이 긴장한다(저절로 뜬 돋보기에는 움찔하지 않는다). 모두 답과 상관없이 같다.
  $('#btn-hint')?.addEventListener('click', () => react('nervous'));
  $('#doc')?.addEventListener('click', () => { if (decided()) return; react('nervous'); fx.spatial($('#doc'), [{ transform: 'rotate(-.35deg) scale(1.015)' }, { transform: 'rotate(-.35deg)' }], fx.M.fast); });
  $('#tray')?.addEventListener('click', (e) => { const li = e.target.closest('li[data-item]'); if (!li || decided()) return; react('nervous'); fx.spatial(li, [{ transform: 'scale(1.1)' }, { transform: 'none' }], fx.M.fast); });
  // 첫 손짓 전에 문맥을 멈춘 채 만들어 둔다(첫 탭의 장치 묻기 멈춤을 입구로 옮긴다). 메인 스레드를 1~2초 잡으므로 입구 움직임이 끝난 뒤에
  setTimeout(() => { sound.unlock(); ensure(); }, 1400);

  fetch('assets/world/manifest.json').then((r) => (r.ok ? r.json() : null)).then((m) => {
    if (!m) return;
    have = { guests: new Set(m.guests || []), items: new Set(m.items || []), venues: new Set(m.venues || []), masks: new Set(m.masks || []) };
    haveReady = true;
    onVenues(); onTray({ quiet: true });
  }).catch(() => {});
  setup();
  setupCarry();
  onVenues();
  return {
    state: () => ({ music: music?.state() || null, who: curWho, mood: shownMood, have: { guests: [...have.guests], items: [...have.items], masks: [...have.masks] } }),
  };
}
