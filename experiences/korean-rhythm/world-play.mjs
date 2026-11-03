// 말의 리듬 — WORLD 캠퍼스 판(축제 무대 연습실, 2026-11-04)의 사건마다 소리 · 빛 · 움직임. 설계는 qa/world-campus-20261104/설계.md.
// app.mjs의 WORLD 분기만 이 파일을 부른다(data-host=world일 때 동적 import). LAB 화면은 불러오지 않는다.
// 규칙 · 보면 · 판정 · 학습 기록 · 음성 재생 길(audio.mjs)은 건드리지 않는다 — 키음은 곡과 같은 AudioContext에 따로 버스를 붙여(음악 크기 길 밖)
// 누른 순간에 내고, 입구 미리듣기 · 결과 소리는 따로 만든 화면 소리 문맥에서 낸다(곡 문맥은 결과에서 닫힌다).
import { createSfx } from './world-sfx.mjs';
import * as fx from './world-fx.mjs';
import { loadRecording } from './audio.mjs';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const MILESTONES = new Set([10, 25, 50, 100, 150, 200]);
const KEYS_KEY = 'synk.world.rhythm.keys';   // 키 소리 켜고 끄기(이 기기)
const LATE = 0.18;   // 출력 지연이 이보다 크면(블루투스 이어폰 같은) 그 판의 키음을 끈다 — 늦게 나는 키음은 손을 흐트러뜨린다(Arcaea ±100ms 밖 노트음 0). 휴대폰 유선 지연(100ms 안팎)은 넘기지 않게 잡았다
const recall = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const remember = (k, v) => { try { localStorage.setItem(k, v); } catch { /* 저장 못 함 */ } };
const session = (type) => { try { const s = navigator.audioSession; if (s && s.type !== type) s.type = type; } catch { /* 없음 */ } };
// 곡이 도는 동안 WORLD 공통 소리(world-sound.mjs)의 「오디오 파일이 나는 동안만 playback」 목록에 자리 하나를 잡아 둔다 —
// 그 모듈은 단추 소리마다 ambient로 되돌리는데, 곡 · 문장은 Web Audio라 그 목록에 없어 아이폰 무음 모드에서 조용해진다.
const ROUND_MEDIA = { synk: 'korean-rhythm round' };
const holdPlayback = (on) => {
  const list = globalThis.__synkPlayingMedia;
  if (on) { list?.add(ROUND_MEDIA); session('playback'); } else { list?.delete(ROUND_MEDIA); if (!list?.size) session('ambient'); }
};

/**
 * @param {{ music: import('./audio.mjs').MusicPlayer, stage: any, state: any, tracks: any[], sound: () => any }} o
 *   sound(): WORLD 공통 소리 모듈(world-sound.mjs) — 앱 「효과음」 · 「보상 연출」 설정과 진동을 읽는다. 아직 못 불러왔으면 null.
 */
export function createWorldPlay({ music, stage, state, tracks, sound }) {
  // 공개 직후 10분 안에는 새 app.mjs가 캐시의 옛 stage.mjs와 만날 수 있다(모듈끼리는 ?v= 없이 부른다) — 그러면 이 판을 켜지 않고 앞 판으로 돈다
  if (typeof stage?.setHush !== 'function') return null;
  let ui = null, uiSfx = null, game = null, cue = null, keysLate = false, preview = null, previewToken = 0, previewFetch = null;
  let curtainToken = 0, results = null, beatTimer = 0, curtainDone = Promise.resolve();
  const appSound = () => { try { return sound()?.getPref ? sound().getPref('sound') !== false : true; } catch { return true; } };
  const celebrate = () => { try { return sound()?.getPref ? sound().getPref('celebrate') !== false : true; } catch { return true; } };
  const keysOn = () => recall(KEYS_KEY) !== 'off' && !keysLate && appSound();

  // WORLD 「움직임 줄이기」(부모 창 설정)를 이 문서에 옮겨 적는다: 무대(worldCalm) · 판정 글자(.calm) · CSS 움직임(data-w-calm)
  function syncMotion() {
    const off = !fx.motionOn();
    stage.worldCalm = off;
    document.documentElement.toggleAttribute('data-w-calm', off);
    $('#game')?.classList.toggle('calm', state.reduced || off);
  }

  /* ── 소리 문맥 ── */
  // 화면 소리 문맥(입구 미리듣기 · 시작 · 결과): 입구가 다 그려진 뒤 한가할 때 만들고(첫 탭에 만들면 장치 묻기로 0.2~1초 멈춘다 — 주문 폭주 11-03),
  // 첫 손짓에 깨운다. 곡을 시작하면 곡 문맥(music.context)이 키음을 맡는다.
  function uiContext() {
    if (ui && ui.state !== 'closed') return ui;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ui = new AC({ latencyHint: 'interactive' }); uiSfx = createSfx(ui, { on: appSound }); } catch { ui = null; uiSfx = null; }
    return ui;
  }
  // 아직 잠들어 있으면 깨운 뒤에 낸다(휴대폰의 첫 손짓은 pointerdown이 아니라 손을 뗄 때 먹는다 — 몇 ms 늦어도 되는 소리들이다)
  const uiPlay = (name, opts) => {
    const c = uiContext();
    if (!c) return 0;
    if (c.state === 'suspended') { c.resume().then(() => uiSfx?.play(name, opts)).catch(() => {}); return 0; }
    return uiSfx?.play(name, opts) || 0;
  };

  /* ── 화면 바꿈 가림막: 바꾸는 순간 바탕색으로 덮고, 새 화면이 두 장 매끄럽게 그려진 뒤(최소 160ms) 260ms에 걷는다(주문 폭주 「부드러움」 ④) ── */
  function curtainEl() {
    let el = $('#w-curtain');
    if (!el) { el = document.createElement('div'); el.id = 'w-curtain'; el.setAttribute('aria-hidden', 'true'); document.body.append(el); }
    return el;
  }
  const smooth = (min = 160, max = 650) => new Promise((resolve) => {
    const t0 = performance.now();
    let last = null, calm = 0;
    const tick = (t) => {
      if (last !== null) calm = t - last < 22 ? calm + 1 : 0;
      last = t;
      const waited = performance.now() - t0;
      if ((calm >= 2 && waited >= min) || waited > max) resolve(); else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  async function curtain() {
    const el = curtainEl(), token = ++curtainToken;
    el.getAnimations().forEach((a) => a.cancel());
    el.classList.add('on');
    await smooth();
    if (token !== curtainToken) return;
    const a = fx.effect(el, [{ opacity: 0.99 }, { opacity: 0 }], { duration: 260, easing: 'cubic-bezier(.34,.88,.34,1)' });
    el.classList.remove('on');
    await a?.finished.catch(() => {});
  }

  /* ── 입구 ── */
  /** 고른 곡의 빠르기로 제목 네 글자가 한 박씩 눌리고 코랄 점이 그 글자로 옮겨 간다(노래방 공). 미리듣기가 나면 그 곡의 첫 마디에 맞춰 다시 건다. */
  function titleBeat(track, delayMs = 0) {
    const art = $('#lobby .w-art');
    if (!art || !track) return;
    clearTimeout(beatTimer);
    art.style.setProperty('--beat', `${(60 / track.bpm).toFixed(4)}s`);
    art.removeAttribute('data-beat');
    if (!fx.motionOn() || state.reduced) return;
    beatTimer = setTimeout(() => { void art.offsetWidth; art.setAttribute('data-beat', ''); }, Math.max(0, delayMs));
  }
  function stopPreview() {
    previewToken += 1;
    previewFetch?.abort(); previewFetch = null;   // 받는 중인 곡은 끊는다(곡을 빠르게 바꾸거나 바로 시작할 때 다 받지 않게)
    const p = preview; preview = null;
    $$('#track-grid .song.w-playing').forEach((b) => b.classList.remove('w-playing'));
    if (!p) return;
    holdPlayback(false);
    try { const now = p.ctx.currentTime; p.gain.gain.cancelScheduledValues(now); p.gain.gain.setTargetAtTime(0, now, 0.08); p.src.stop(now + 0.5); } catch { /* 이미 멈춤 */ }
  }
  /** 곡 미리듣기: 곡의 42% 자리 마디 첫 박부터 10초를 낮게(−7dB) — 0.35초에 올라 끝 1.4초에 걸쳐 내린다. 배경 음악을 끈 판에서는 나지 않는다. */
  async function playPreview(id) {
    stopPreview();
    const track = tracks[id];
    if (!track || !state.musicOn || state.screen !== 'lobby') return;
    const ctx = uiContext();
    if (!ctx) return;
    const token = previewToken;
    $(`#track-grid .song[data-track="${id}"]`)?.classList.add('w-playing');
    try {
      await ctx.resume();
      previewFetch = new AbortController();
      const buffer = await loadRecording(track, ctx, previewFetch.signal);
      if (token !== previewToken || state.screen !== 'lobby') return;
      const beats = track.beatTimes, at = Math.floor((beats.length * 0.42) / 4) * 4, from = beats[at] ?? track.duration * 0.42;
      const src = ctx.createBufferSource(), gain = ctx.createGain(), t0 = ctx.currentTime + 0.06, len = 10;
      gain.gain.value = 0;
      gain.gain.setValueAtTime(0.0001, t0); gain.gain.linearRampToValueAtTime(0.45, t0 + 0.35);
      gain.gain.setValueAtTime(0.45, t0 + len - 1.4); gain.gain.linearRampToValueAtTime(0, t0 + len);
      src.buffer = buffer; src.connect(gain); gain.connect(ctx.destination);
      src.start(t0, from, len + 0.05);
      src.onended = () => { if (preview?.src === src) { preview = null; holdPlayback(false); $$('#track-grid .song.w-playing').forEach((b) => b.classList.remove('w-playing')); } };
      preview = { ctx, src, gain };
      holdPlayback(true);
      titleBeat(track, (t0 - ctx.currentTime) * 1000);   // 첫 마디에 제목 박자를 맞춘다
    } catch { $$('#track-grid .song.w-playing').forEach((b) => b.classList.remove('w-playing')); }
  }

  /** 첫 등장(1.1초 안): 사진 흐림 → 또렷, 제목 두 줄이 마이크 뒤에서 올라온다. 다 선 뒤 화면 소리 문맥을 만들고 제목 박자를 건다. */
  function enterLobby() {
    const art = $('#lobby .w-art');
    if (!art) return;
    const lines = $$('h1 .w-l>span', art);
    if (fx.motionOn() && !state.reduced) {   // 사진 흐림 → 또렷은 넣지 않는다(큰 사진 blur는 첫 순간 래스터 부담 — 주문 폭주 2판 P1-3)
      lines.forEach((el, i) => fx.spatial(el, [{ transform: 'translateY(105%)' }, { transform: 'translateY(0)' }], fx.M.base, { delay: 120 + i * 80 }));
    }
    // 제목이 다 선 뒤 아무것도 움직이지 않을 때 소리 문맥을 만들고(윈도우에서 장치 묻기로 메인 스레드를 1초쯤 잡는다), 그다음에 박자를 건다
    setTimeout(() => {
      const idle = window.requestIdleCallback || ((f) => setTimeout(f, 60));
      idle(() => {
        uiContext();
        requestAnimationFrame(() => requestAnimationFrame(() => { if (state.screen === 'lobby') titleBeat(tracks[state.track]); }));
      }, { timeout: 1200 });
    }, 760);
  }

  /* ── 결과 ── */
  function skipResults() { results?.skip(); }
  function runResults(round) {
    results?.skip();
    const hero = $('#results .res-hero'), dots = $('#w-dots'), stamp = $('#w-stamp'), big = $('#r-correct');
    if (!hero || !dots || !big) return;
    const qs = round.questions, correct = round.correctCount, total = qs.length, perfect = correct === total;
    dots.replaceChildren(...qs.map((q) => {
      const ok = q.response !== null && q.options[q.response] === q.answer, i = document.createElement('li');
      i.className = ok ? 'ok' : q.response === null ? 'none' : 'ko';
      return i;
    }));
    if (stamp) stamp.hidden = true;
    const stats = ['#result-score', '#result-accuracy', '#result-combo'].map((s) => $(s)).filter(Boolean);
    const finals = stats.map((el) => el.textContent);
    const timers = [];
    let counts = [], done = false;
    const finish = () => {
      if (done) return;
      done = true; timers.forEach(clearTimeout); counts.forEach((c) => c.skip());
      big.textContent = String(correct);
      $$('li', dots).forEach((li) => li.classList.add('on'));
      stats.forEach((el, i) => { el.textContent = finals[i]; });
      if (stamp && perfect) stamp.hidden = false;
      if (celebrate() && fx.motionOn() && !state.reduced) hero.classList.add('w-zoom');
      results = null;
    };
    results = { skip: finish };
    hero.classList.remove('w-zoom'); void hero.offsetWidth;
    if (!celebrate() || !fx.motionOn() || state.reduced) {   // 보상 연출을 끄거나 움직임 줄이기: 끝 상태 그대로(소리는 무대 끝 화음 하나)
      if (celebrate()) uiPlay('done');
      finish();
      return;
    }
    hero.classList.add('w-zoom');
    big.textContent = '0';
    stats.forEach((el) => { el.textContent = el.id === 'result-accuracy' ? '0%' : '0'; });
    let n = 0;
    const lis = $$('li', dots), gap = 140, first = 420;
    // 무대 끝 화음과 점 찍기는 가림막이 걷히면서 시작한다(가림막은 길어도 0.9초 — 그동안 끝 상태가 아니라 0에서 기다린다)
    const go = () => {
    if (done) return;
    uiPlay('done');
    lis.forEach((li, i) => timers.push(setTimeout(() => {
      li.classList.add('on');
      const ok = li.classList.contains('ok');
      if (ok) { n += 1; big.textContent = String(n); fx.spatial(big, [{ transform: 'translateY(.08em) scale(.94)' }, { transform: 'none' }], fx.M.fast); }
      fx.spatial(li, [{ transform: 'scale(.4)' }, { transform: 'none' }], fx.M.fast);
      uiPlay('dot', { step: n || 1, ok });
    }, first + i * gap)));
    const landAt = first + lis.length * gap + 80;
    timers.push(setTimeout(() => {
      uiPlay('land');
      let last = 0;
      counts = stats.map((el, i) => {
        const raw = finals[i], num = Number(String(raw).replace(/[^\d.]/g, '')) || 0, pct = /%$/.test(raw), dec = pct && /\.\d/.test(raw);
        if (pct) { el.textContent = raw; return { skip() {} }; }   // 정확도(소수) 글은 그대로 — 박자 점수 · 최대 콤보만 굴린다
        return fx.countUp(el, Math.round(num), { duration: 700, onTick: () => { const t = performance.now(); if (t - last > 66) { last = t; uiPlay('roll'); } }, onLand: () => { if (dec) el.textContent = raw; } });
      });
    }, landAt));
    if (perfect && stamp) timers.push(setTimeout(() => {
      stamp.hidden = false;
      fx.spatial(stamp, [{ transform: 'rotate(-8deg) scale(1.5)', opacity: 0 }, { transform: 'rotate(-8deg) scale(1)', opacity: 1 }], fx.M.base);
      uiPlay('stamp');
    }, landAt + 820));
    timers.push(setTimeout(finish, landAt + (perfect ? 1500 : 900)));
    };
    curtainDone.then(go, go);
  }

  return {
    /** 처음 한 번: 입구 세 층(사진 · 제목 · 마이크) · 결과 점 · 도장 · 키 소리 단추 · 미리듣기 · 첫 손짓. */
    setup() {
      // 앱에는 마스코트가 없다(10-31 ④): LAB과 같은 HTML의 몽글 그림 · 입구 그림 무대를 DOM에서 걷는다(app.mjs는 WORLD에서 이 칸들을 만지지 않는다)
      $$('#lobby .hero-art, #stage-mongle, #r-mongle').forEach((el) => el.remove());
      const hero = $('#lobby .hero'), h1 = $('#lobby .hero h1');
      if (hero && h1) {
        const art = document.createElement('div');
        art.className = 'w-art';
        const photo = Object.assign(document.createElement('img'), { className: 'w-photo', src: 'assets/world/lobby.webp', alt: '', decoding: 'async' });
        const mic = Object.assign(document.createElement('img'), { className: 'w-mic', src: 'assets/world/lobby-mic.webp', alt: '', decoding: 'async' });
        const syl = (w) => [...w].map((ch) => `<i class="w-s">${ch}</i>`).join('');
        h1.setAttribute('aria-label', '말의 리듬');
        h1.innerHTML = `<span class="w-l"><span aria-hidden="true">${syl('말의')}</span></span> <span class="w-l"><span aria-hidden="true">${syl('리듬')}</span></span>`;
        $$('.w-s', h1).forEach((el, i) => el.style.setProperty('--i', String(i)));   // 박자 차례(인라인 style 속성은 WORLD CSP가 막아 JS로 쓴다)
        art.append(photo, h1, mic);
        hero.prepend(art);
      }
      $('#results .res-hero .r-label')?.insertAdjacentHTML('afterend', '<ol class="w-dots" id="w-dots" aria-hidden="true"></ol>');
      $('#results .res-hero > div')?.insertAdjacentHTML('beforeend', '<p class="w-stamp" id="w-stamp" aria-hidden="true" hidden>전부 잘 들었어요</p>');
      $('#results .res-hero')?.addEventListener('pointerdown', skipResults);
      // WORLD 공통 단추 소리(톡)를 뺄 곳: 시작 · 한 곡 더는 불 켜지는 소리, 곡 카드는 미리듣기가 맡는다(겹치지 않게)
      for (const el of [$('#start-button'), $('#replay-button'), $('#track-grid')]) el?.setAttribute('data-sound', 'none');
      syncMotion();
      // 키 소리 켜고 끄기(설정 · 멈춤 창의 스위치 줄) — 앱 「효과음」을 끄면 키 소리도 나지 않는다
      for (const box of $$('.dialog-toggles')) box.insertAdjacentHTML('beforeend', '<button class="chip-btn" type="button" data-w-keys aria-pressed="true">키 소리 켜짐</button>');
      const syncKeys = () => { const on = recall(KEYS_KEY) !== 'off'; for (const b of $$('[data-w-keys]')) { b.setAttribute('aria-pressed', String(on)); b.textContent = on ? '키 소리 켜짐' : '키 소리 꺼짐'; } };
      for (const b of $$('[data-w-keys]')) b.addEventListener('click', () => { remember(KEYS_KEY, recall(KEYS_KEY) === 'off' ? 'on' : 'off'); syncKeys(); });
      syncKeys();
      // 미리듣기: 곡 카드를 직접 누르면(앱의 고르기가 먼저 돈 뒤 — 부모로 올라온 클릭)
      $('#track-grid')?.addEventListener('click', (e) => {
        const b = e.target.closest?.('.song');
        if (!b || !e.isTrusted || b.disabled) return;
        titleBeat(tracks[Number(b.dataset.track)]);
        void playPreview(Number(b.dataset.track));
      });
      // 배경 음악을 끄면 미리듣기도 멈춘다(앱 손잡이가 state를 바꾼 뒤에 본다)
      for (const b of $$('[data-sound-toggle]')) b.addEventListener('click', () => setTimeout(() => { if (!state.musicOn) stopPreview(); }, 0));
      document.addEventListener('visibilitychange', () => { if (document.hidden) stopPreview(); });
      // 화면 소리 문맥은 깨어날 때까지 손짓마다 깨운다(터치의 pointerdown은 활성화 손짓이 아니다 — world-sound.mjs와 같은 네 사건)
      const GESTURES = ['pointerdown', 'touchend', 'click', 'keydown'];
      const first = () => { const c = uiContext(); c?.resume().then(() => { if (c.state === 'running') for (const type of GESTURES) removeEventListener(type, first, true); }).catch(() => {}); };
      for (const type of GESTURES) addEventListener(type, first, true);
      enterLobby();
    },
    /** 화면이 바뀔 때(app.mjs show): 가림막 · 입구로 돌아오면 제목 박자 다시 · 결과에서 나가면 연출 끝. */
    screen(name) {
      syncMotion();
      if (name !== 'lobby') { stopPreview(); clearTimeout(beatTimer); $('#lobby .w-art')?.removeAttribute('data-beat'); }
      else { titleBeat(tracks[state.track]); if (!preview) holdPlayback(false); }
      if (name !== 'results') skipResults();
      curtainDone = fx.motionOn() ? curtain() : Promise.resolve();
    },
    /** 무대 연습 시작을 누른 순간: 미리듣기를 멈추고 불 켜지는 소리. */
    starting() { stopPreview(); uiPlay('open'); $('#results .res-hero')?.classList.remove('w-zoom'); },
    stopPreview,
    /** 곡 문맥이 준비된 뒤 · 네 박 카운트 전: 키음 버스를 곡 문맥에 붙이고 카운트 소리를 바꾼다. 출력이 늦으면 그 판의 키음을 끄고 안내 글을 돌려준다. */
    roundReady() {
      const ctx = music.context;
      game = ctx ? createSfx(ctx, { on: keysOn }) : null;
      cue = ctx ? createSfx(ctx, { on: appSound }) : null;
      const late = (ctx?.outputLatency || 0) + (ctx?.baseLatency || 0);
      keysLate = late > LATE;
      syncMotion();
      // 네 박 · 문장 안내음은 곡 시계(음성과 같은 문맥 · 같은 예약)로 — 멈추면 함께 멈추고, 건너뛰면 지우고 다시 건다. 음악은 음성 0.5초 전부터 낮아져 안내음이 그 위에서 난다
      // 키 소리 스위치 · 지연 자동 끄기는 키음(key · release · pick)만 끈다 — 네 박 · 안내음 · 맞음 · 다름 · 이정표는 cue 버스(앱 효과음 설정만 따름)
      music.countSound = (when, i) => { cue?.at('count', when, { accent: i === 3 }); };
      music.voiceCue = (start) => { cue?.at('listen', start - 0.45); };
      music.cueReset = () => { try { cue?.bus.out.disconnect(); } catch { /* 이미 끊김 */ } cue = ctx && ctx.state !== 'closed' ? createSfx(ctx, { on: appSound }) : null; };
      music.duckLead = 0.5;
      holdPlayback(true);   // 곡 · 문장은 듣기 내용이다 — 아이폰 무음 모드에서도 들린다
      return keysLate && appSound() && recall(KEYS_KEY) !== 'off' ? '이어폰 소리가 늦게 나서 이번 곡은 키 소리를 껐어요' : null;
    },
    /** 장면마다: 안내음(곡 시계로 예약됨)부터 답할 때까지 방을 어둡게 · 키음을 −4dB. */
    frame(round, t) {
      if (!round) return;
      const listening = round.questions.some((q) => q.state === 'pending' && t >= q.showTime - 0.45 && t < q.answerOpen);
      stage.setHush(listening);
      game?.duck(listening);
    },
    /** 답을 먼저 골랐다(「골랐어요」): 그 레인 음을 작게. */
    intent(lane) { game?.play('pick', { lane }); },
    /** 노트를 쳤다(quality > 0): 키음(길게 누른 노트를 끝까지면 떼는 소리). */
    hit(event) { if (event.type === 'hold-end') game?.play('release'); else game?.play('key', { lane: event.lane, quality: event.quality }); },
    /** 판정 하나 뒤: 콤보(노트 뒤 숫자 · 이정표 소리 10 · 25 · 50 · 100) · 놓친 노트는 그 레인 판정선만 잠깐 어둡게(소리 없음). */
    after(event, round) {
      if (!round) return;
      stage.setCombo(round.combo);
      if (MILESTONES.has(round.combo) && event.quality > 0) cue?.play('milestone');
      if (event.quality === 0 && ['miss', 'hold-miss', 'hold-break'].includes(event.type)) stage.miss(event.lane);
    },
    /** 들은 내용의 답: 맞음 = 오르막 소리 · 불이 따뜻하게 · 진동, 다름 = 묻는 두 음, 답 없음 = 소리 없음. */
    verdict(result, round) {
      if (result === 'ok') { const n = round.questions.filter((q) => q.response !== null && q.options[q.response] === q.answer).length; cue?.play('right', { n }); stage.warm(); }
      else if (result === 'ko') cue?.play('differ');
      if (result !== 'none') { try { sound()?.haptic?.(result === 'ok' ? 'ok' : 'retry'); } catch { /* 진동 없음 */ } }
    },
    /** 곡 끝 · 결과: 무대 끝 화음 → 문장 점 → 큰 숫자 → 박자 기록 굴림 → 5/5 도장. 탭하면 끝. */
    results(round) { runResults(round); },   // 세션 자리는 결과에서도 쥔다 — 「다시 듣기」 · 새 문장 확인도 듣기다. 입구로 돌아갈 때 푼다
    /** 곡 중간에 나갈 때. */
    leave() { holdPlayback(false); stage.setHush(false); },
  };
}
