// 주문 폭주 — WORLD 캠퍼스 판 2판의 연출(2026-11-03): 사건마다 소리 · 음악 · 움직임 · 진동을 한 박자로 겹친다.
// app.mjs의 WORLD 분기만 불러온다(LAB 화면은 audio.mjs의 옛 소리 · style.css 그대로). 규칙 · 판정 · 학습 기록 · 코인은 app.mjs · core.mjs 그대로 —
// 여기서는 보이고 들리는 것만 바꾼다. 주문 음성의 재생 길(audio.mjs의 <audio>)도 건드리지 않는다: 목소리 막대는 미리 구운 포락선
// (assets/world/voice-env.json, qa/world-campus-20261103/목소리포락선.py)을 재생 위치로 읽는다(2판 설계 검토 P0-1 — 그래프에 물리면 아이폰에서 무음 위험).
// 설계: qa/world-campus-20261103/2판_설계.md. 움직임 값은 world-fx.mjs의 토큰 여섯, 소리는 world-sfx.mjs, 음악은 world-music.mjs.
import { createSfx } from './world-sfx.mjs';
import { createMusic } from './world-music.mjs';
import * as fx from './world-fx.mjs';
import { ICE_LAND } from './stage.mjs';

/** 맞음 한 박자(ms): 컵 미끄러짐 · 서빙 소리 t0 → 받음 얼굴 +120 → 맞음 소리 · 점수 굴림 +180 → 손님 떠남 +620 → 다음 손님 +900.
 *  손님이 계산대에 서면 문 종 뒤 320ms에 주문을 말한다(종이 첫 음절을 덮지 않게). */
export const BEAT = Object.freeze({ face: 120, correct: 180, leave: 620, next: 900, chime: 320 });
const COMBO_AT = new Set([3, 5, 8]);
const SFX_VOL = 'synk.order-rush.sfx.volume';
const ING = ['coffee', 'tea', 'milk', 'ice', 'sugar', 'cold'];

const recall = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const remember = (k, v) => { try { localStorage.setItem(k, v); } catch { /* 이번 판에서만 */ } };
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

/** 컵에 담긴 재료 수(사다리 음의 칸): 커피·차 · 우유 · 얼음 · 설탕 · (얼음 없이) 차갑게. */
export function cupCount(c) {
  if (!c) return 0;
  return (c.base ? 1 : 0) + (c.milk ? 1 : 0) + (c.ice ? 1 : 0) + (c.sugar ? 1 : 0) + (c.temp === 'cold' && !c.ice ? 1 : 0);
}
/** 누른 재료가 컵에 들어갔나(아니면 빠졌다). */
export function wasAdded(action, after) {
  if (action === 'coffee' || action === 'tea') return after.base === action;
  if (action === 'cold') return after.temp === 'cold';
  return !!after[action];
}

/**
 * audio: CafeAudio(주문 음성 · 오디오 문맥), stage: () => 지금 작업대(CafeStage | FlatStage | null), cupLabel: 컵 이름(cafe.mjs).
 *
 * 부드러움(11-03 밤 유호님 「전환될 때 프레임이 끊기는 느낌 — 몰입을 방해」, 크롬 추적으로 잰 원인 · 고침):
 *  ① 첫 손짓에 오디오 문맥을 만들면 장치 묻기(이 PC에서 0.2~1초)가 그 탭을 멈췄다 → 입구에서 미리(멈춘 채) 만들고 손짓에는 resume만.
 *     WORLD 공통 world-sound.mjs도 첫 손짓에 문맥을 하나 더 만들어 게임 틀에 들이지 않는다(설정 열쇠 · 진동 · 아이폰 오디오 세션만 여기서 같은 꼴로).
 *  ② 오픈 곡(2MB → 풀면 40MB)을 시작 순간에 풀면 0.2초 넘게 멈췄다 → 입구에서 미리 푼다.
 *  ③ 바뀐 화면의 첫 그리기(큰 사진 · 유리 흐림 · 3D 첫 장)가 0.2~0.5초 → 화면을 바꾸는 순간 바탕색 막으로 덮고, 장면이 매끄럽게 두 번
 *     나온 뒤(GPU 래스터가 끝난 뒤) 걷는다.
 *  ④ 손님이 바뀔 때 앞 손님이 사라진 뒤 빈 홀이 비쳤다 → 앞 손님 위로 새 손님이 스며든다.
 *  ⑤ 카메라 다가감(4초 확대)은 그 위 유리 흐림을 매 장 다시 그리게 해 뺐다. 손님 사진은 입구에서 미리 풀어 둔다.
 *  ⑥ 입구 첫 등장: 사진 → (멈춘 화면에서) 3D 작업대 셰이더 → 제목 → (제목이 다 선 뒤) 오디오 문맥 · 곡 풀기 → 바쁜 박자 순서로 겹치지 않게.
 *     끝난 등장 애니메이션은 떼어 낸다 — 남아 있으면 같은 글자의 CSS 박자가 합성기로 못 가고 메인 스레드에서 돌아 자주 끊겼다.
 */
export function createWorldPlay({ audio, stage = () => null, cupLabel = () => '' }) {
  let ctx = null, sfx = null, music = null, env = null, envLoading = null, meter = null, ducked = false;
  let entered = false, faceToken = 0, front = null, back = null, faceSettle = null, lastPlay = new Map(), lastTick = null;
  let rollers = null, results = null, coinWaiting = false, orderNo = 17;
  let curtainOn = false, curtainToken = 0, pendingReveal = 0, hideToken = 0;
  const warmed = new Map();   // 미리 푼 그림(참조를 들고 있어야 풀린 판이 남는다)
  const groups = { face: new Set(), beat: new Set(), results: new Set() };
  const later = (ms, fn, group = 'beat') => {
    const id = setTimeout(() => { groups[group].delete(id); fn(); }, ms);
    groups[group].add(id);
    return id;
  };
  const cancel = (group) => { for (const id of groups[group]) clearTimeout(id); groups[group].clear(); };

  /* ── 소리 ── */
  // WORLD 앱 설정 「효과음」 · 「진동」 — world-sound.mjs PREF_KEYS와 같은 열쇠(기본 켜짐)
  const pref = (name) => recall(`synk.world.${name}`) !== 'false';
  const sfxOn = () => audio.isOn() && pref('sound');
  const sfxVolume = () => { const raw = recall(SFX_VOL), v = Number(raw); return raw !== null && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1; };
  /** 문맥(멈춘 채라도) 위에 효과음 · 음악 그래프를 만든다. 소리는 손짓으로 resume된 뒤에 난다. */
  function ensure() {
    if (sfx) return true;
    if (!audio.context) audio.unlock();
    ctx = audio.context;
    if (!ctx) return false;
    sfx = createSfx(ctx, { on: sfxOn, volume: sfxVolume() });
    music = createMusic(ctx, { storage: (() => { try { return localStorage; } catch { return null; } })() });
    music.setOn(audio.isOn());
    return true;
  }
  /** 효과음 하나. 같은 소리를 50ms 안에 또 부르면(키 연타) 건너뛴다. */
  function play(name, opts) {
    if (!sfx) return 0;
    const now = performance.now(), prev = lastPlay.get(name) || 0;
    if (now - prev < 50 && name !== 'roll') return 0;
    lastPlay.set(name, now);
    ambient();
    return sfx.play(name, opts);
  }
  /* 아이폰 오디오 세션 — world-sound.mjs와 같은 규칙: 주문 음성(<audio>)이 나는 동안만 playback(무음 모드에서도 들린다), 효과음 · 음악을 낼 때는
   * ambient(무음 스위치를 따르고 듣던 음악과 섞인다). 그 모듈은 게임 틀에 들이지 않아(위 ①) 이 문서의 <audio>에 여기서 같은 꼴로 건다 —
   * 걸지 않으면 바깥 앱이 ambient로 둔 세션에서 주문 음성이 무음 모드에 묻힐 수 있다. audioSession이 없는 브라우저에서는 아무것도 하지 않는다. */
  const playingMedia = new Set();
  const session = (type) => { try { const s = navigator.audioSession; if (s && s.type !== type) s.type = type; } catch { /* 없음 */ } };
  const ambient = () => { if (!playingMedia.size) session('ambient'); };
  function guardMedia() {
    const proto = globalThis.HTMLMediaElement?.prototype;
    if (!proto || !globalThis.navigator?.audioSession || proto.__synkAudioSession) return;
    const native = proto.play;
    Object.defineProperty(proto, '__synkAudioSession', { value: true });
    proto.play = function (...args) {
      let done = null;
      if (!this.muted) {
        playingMedia.add(this); session('playback');
        done = () => { for (const type of ['pause', 'ended', 'error']) this.removeEventListener(type, done); playingMedia.delete(this); };
        for (const type of ['pause', 'ended', 'error']) this.addEventListener(type, done);
      }
      const result = native.apply(this, args);
      if (done && result?.then) result.then(null, () => { if (this.paused) done(); });   // 거절되면 pause · ended가 오지 않는다
      return result;
    };
  }
  /** 아주 짧은 진동(world-sound.mjs haptic과 같은 꼴): 안드로이드는 vibrate, 아이폰은 스위치 입력을 한 번 눌러 탭틱. 앱 「진동」을 끄면 없다. */
  function haptic(kind = 'ok') {
    if (!pref('haptic')) return;
    try {
      if (typeof navigator.vibrate === 'function') { navigator.vibrate(kind === 'done' ? [14, 40, 18] : kind === 'tap' ? [8] : [10]); return; }
      if (!('switch' in HTMLInputElement.prototype) || !/iPhone/.test(navigator.userAgent || '')) return;
      const label = document.createElement('label'), input = document.createElement('input');
      input.type = 'checkbox'; input.setAttribute('switch', ''); label.setAttribute('aria-hidden', 'true'); label.style.display = 'none'; label.append(input);
      label.addEventListener('click', (e) => e.stopPropagation());
      document.head.append(label); label.click(); label.remove();
    } catch { /* 진동 없음 */ }
  }
  /** 입구에서 쉬는 동안: 오디오 문맥을 멈춘 채 만들고(①) 효과음 · 음악 그래프 · 오픈 곡 풀기(②), 그림 풀기(⑤). */
  function early() {
    if (!audio.context) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (C) { try { audio.context = new C({ latencyHint: 'interactive' }); } catch { /* 손짓 때 audio.unlock()이 만든다 */ } }
    }
    if (ensure()) music?.preload('calm');
    warm(['assets/world/bench.webp', 'assets/world/close.webp', 'assets/world/hall.webp', ...ING.map((k) => `assets/world/ingredients/${k}.webp`)]);
  }
  /** 그림을 미리 풀어 둔다(처음 그릴 때 풀면 그 장이 늦는다). 돌려주는 값: 다 풀리면 끝나는 약속. */
  function warm(srcs) {
    return Promise.all(srcs.map((src) => {
      if (warmed.has(src)) return warmed.get(src).p;
      const im = new Image(); im.decoding = 'async'; im.src = src;
      const p = (im.decode ? im.decode() : Promise.resolve()).catch(() => {});
      warmed.set(src, { im, p });
      return p;
    }));
  }

  /* ── 화면 바꿈 가림막(③): 바꾸는 순간 바탕색으로 바로 덮고, 새 화면이 두 장 그려지고 사진이 풀리면 260ms에 걷는다(투명도만 — 합성 층) ── */
  function curtainEl() {
    let el = $('#w-curtain');
    if (!el) { el = document.createElement('div'); el.id = 'w-curtain'; el.setAttribute('aria-hidden', 'true'); document.body.append(el); }
    return el;
  }
  function cover() {
    const el = curtainEl();
    el.getAnimations().forEach((a) => a.cancel());
    el.classList.add('on');
    curtainOn = true;
    return ++curtainToken;
  }
  const within = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);
  // 덮은 뒤 최소 160ms, 그다음 매끄러운 장면 둘(rAF 간격 22ms 아래 두 번)을 기다린다: 새 화면의 첫 래스터(큰 사진 · 카드 — 처음이면 셰이더 굽기까지)는
  // 화면을 바꾸고 50ms쯤 뒤에 GPU에서 시작해 100~200ms 간다. 그 앞의 장면 두셋은 매끄럽게 나와서 「매끄러움」만 보면 너무 일찍 걷고, 걷기(260ms 투명도)가
  // 래스터와 겹쳐 걷는 도중에 장면을 버렸다(11-03 밤 추적: 덮고 50ms에 걷기 시작 → 걷는 중 2~4장). 길어도 650ms.
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
  async function reveal(token, waits = [], after = null) {
    await within(Promise.all(waits), 700);
    await smooth();
    if (token !== curtainToken) return;
    const el = curtainEl();
    el.classList.remove('on');
    curtainOn = false;
    if (fx.motionOn()) el.animate([{ opacity: 0.99 }, { opacity: 0 }], { duration: 260, easing: fx.M.eslow.easing });   // 덮은 투명도(world-skin.css .on)에서
    after?.();
  }

  /* ── 주문 음성: 덕킹 · 목소리 막대 ── */
  function loadEnv() {
    if (env) return Promise.resolve(env);
    envLoading ||= fetch('assets/world/voice-env.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((j) => { env = j; return j; });
    return envLoading;
  }
  /** 막대 다섯: 지금 재생 위치의 포락선(25fps · 다섯 대역) — 공격 30ms · 해제 180ms로 부드럽게. 움직임 줄이기면 점 셋 그대로. */
  function startMeter(id) {
    stopMeter();
    const box = $('#b-dots');
    if (!box || !fx.motionOn()) return;
    const bars = $$('i', box), data = env?.orders?.[id], fps = env?.fps || 25, B = env?.bands || 5;
    if (!data || !bars.length) return;
    box.classList.add('w-live');
    const level = new Float32Array(bars.length);
    let raf = 0, alive = true, prev = performance.now();
    const el = audio.element;
    const loop = (now) => {
      if (!alive) return;
      const dt = Math.min(0.1, Math.max(0, (now - prev) / 1000)); prev = now;
      const k = Math.floor((el.currentTime || 0) * fps), live = !el.paused && el.readyState >= 2;
      bars.forEach((b, i) => {
        const ch = live ? data[k * B + (i % B)] : null;
        const target = ch ? parseInt(ch, 36) / 35 : 0;
        const tau = target > level[i] ? 0.03 : 0.18;
        level[i] += (target - level[i]) * (1 - Math.exp(-dt / tau));
        b.style.transform = `scaleY(${(0.14 + level[i] * 0.86).toFixed(3)})`;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    meter = { stop() { alive = false; cancelAnimationFrame(raf); box.classList.remove('w-live'); bars.forEach((b) => { b.style.transform = ''; }); } };
  }
  function stopMeter() { meter?.stop(); meter = null; }
  function duck(deep) { ducked = true; music?.voice(true, { deep }); sfx?.duck(true); }
  function release() { if (!ducked) return; ducked = false; music?.voice(false); sfx?.duck(false); stopMeter(); }

  /* ── 손님 얼굴: 두 장을 겹쳐 바꾼다(src만 바꾸면 깜빡인다). slide면 새 손님이 오른쪽 14px에서 스며든다(④) ── */
  function faces() {
    if (!front) { front = $('#guest-img'); back = $('#w-guest-next'); }
    return front && back;
  }
  function showFace(src, alt = null, { delay = 0, slide = false } = {}) {
    if (!faces()) return;
    const token = ++faceToken;
    cancel('face');
    const run = () => {
      if (token !== faceToken) return;
      faceSettle?.();   // 앞 전환이 아직 스미는 중이면 먼저 끝낸다 — 얼굴 둘이 겹친 채 남거나 앞 손님이 뒤에서 다시 비치지 않게
      if (alt !== null) { front.alt = alt; back.alt = ''; }
      if (front.getAttribute('src') === src) return;
      back.src = src;
      const swap = () => {
        if (token !== faceToken) return;
        back.style.zIndex = '2'; front.style.zIndex = '1';
        back.hidden = false;
        const a = fx.effect(back, [{ opacity: 0 }, { opacity: 1 }], slide ? fx.M.eslow : fx.M.ebase);
        if (slide) fx.spatial(back, [{ transform: 'translateX(14px)' }, { transform: 'none' }], fx.M.base);
        const done = () => {
          if (faceSettle !== done) return;   // 이미 끝냈다(다음 전환이 먼저 끝냄 · 취소된 finished)
          faceSettle = null;
          const old = front; front = back; back = old;
          back.hidden = true; back.style.zIndex = ''; front.style.zIndex = '';
          front.alt = alt ?? old.alt; old.alt = '';
          front.id = 'guest-img'; old.id = 'w-guest-next';   // app.mjs는 #guest-img를 지금 보이는 얼굴로 안다
          a?.cancel();
        };
        faceSettle = done;
        if (a) a.finished.then(done, done); else done();
      };
      (back.decode ? back.decode() : Promise.resolve()).then(swap, swap);
    };
    if (delay) later(delay, run, 'face'); else run();
  }

  /* ── 작은 연출 ── */
  /** 재료 카드 눌림: 눌린 쪽은 CSS(:active, 효과 150ms), 뗄 때 빠른 공간으로 제자리(살짝 넘침). */
  function springBack(card) { fx.spatial(card, [{ transform: 'scale(.96)' }, { transform: 'scale(1)' }], fx.M.fast); }
  /** 다 들은 순간: 재료 카드 줄이 한 번 깨어난다(카드마다 30ms) — 흐리거나 막지 않는다(듣는 중에도 담기는 규칙 그대로). */
  function wake() {
    $$('.ingredients .ing').forEach((b, i) => fx.spatial(b, [{ transform: 'translateY(-4px)' }, { transform: 'none' }], { duration: 220, easing: fx.M.fast.easing }, { delay: i * 30 }));
  }
  /** 다름: 컵이 한 번 좌우로(4px · 220ms). */
  function shake() {
    const c = $('#stage');
    if (!c || !fx.motionOn()) return;
    c.animate([{ transform: 'none' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(-2px)' }, { transform: 'none' }], { duration: 220, easing: 'ease-out' });
  }
  function comboChip(n) {
    const chip = $('#w-combo');
    if (!chip) return;
    chip.textContent = `연속 ${n}`;
    chip.hidden = false;
    chip.getAnimations().forEach((a) => a.cancel());
    fx.spatial(chip, [{ transform: 'translateY(8px) scale(.9)' }, { transform: 'none' }], fx.M.fast);
    fx.effect(chip, [{ opacity: 0 }, { opacity: 1 }], fx.M.efast);
    later(900, () => { const a = fx.effect(chip, [{ opacity: 1 }, { opacity: 0 }], fx.M.ebase); const hide = () => { chip.hidden = true; }; if (a) a.finished.then(hide, hide); else hide(); });
  }
  /** 재료 사진 조각이 카드에서 지금 컵 테두리로 날아든다(stage가 테두리의 화면 자리를 안다). */
  function flyFrom(card, action) {
    const st = stage(), img = card?.querySelector('img');
    if (!img || !st) return;
    const p = st.rimPoint?.(st.active ?? 0);
    const box = $('#bench')?.getBoundingClientRect();
    const to = p ? { left: p.x - 1, top: p.y - 1, width: 2, height: 2 } : box && { left: box.left + box.width / 2 - 1, top: box.top + box.height * 0.45, width: 2, height: 2 };
    if (to) fx.fly(img.currentSrc || img.src, card, to, { size: 44, lift: 70 });
  }

  /* ── 결과: 마감한 홀 포스터(1판 앞면) 위의 연출 ──
   * 제목이 올라오고, 주문마다 점 하나가 110ms 간격으로 찍히며(작은 틱) 첫 서빙에 맞힌 점마다 큰 숫자가 하나 오른다 → 앉는 소리 · 숫자 튐 →
   * (8/8이면) 잉크 도장. 코인 줄이 그 사이에 오면 소리는 앉은 뒤에. 포스터를 탭하면 모든 연출이 바로 끝난다(기록 · 코인은 그대로). */
  function buildDots(records) {
    const ol = $('#w-dots');
    if (!ol) return;
    ol.replaceChildren(...records.map((r) => {
      const li = document.createElement('li');
      li.className = !r.presentationId ? 'skip' : r.first === true ? 'ok' : r.first === false && r.outcome === 'served' ? 'fix' : 'skip';
      return li;
    }));
  }
  function playResults({ firstOk, perfect }) {
    cancel('results');
    const hero = $('#results .res-hero'), title = $('#r-title'), dots = $$('#w-dots li'), big = $('#r-correct'), stamp = $('#w-stamp');
    if (stamp) { stamp.hidden = !perfect; stamp.classList.remove('on'); }
    const anims = [];
    const keep = (a) => { if (a) anims.push(a); return a; };
    let landed = false;
    const land = () => {
      if (landed) return;
      landed = true;
      play('land');
      keep(fx.spatial(big, [{ transform: 'scale(1.12)' }, { transform: 'none' }], fx.M.fast));
      if (coinWaiting) { coinWaiting = false; later(160, () => play('coin'), 'results'); }
      if (perfect && stamp) later(300, () => { stamp.classList.add('on'); play('combo'); haptic('done'); }, 'results');
    };
    const finishAll = (sound = true) => {   // 포스터 탭(이벤트) · 연출 없음은 기다리던 코인 소리를 낸다, 화면을 떠날 때(skip)는 내지 않는다
      cancel('results');
      for (const a of anims) { try { a.finish(); } catch { /* 이미 끝 */ } }
      if (big) big.textContent = String(firstOk);
      for (const d of dots) d.classList.add('on');
      if (perfect && stamp) stamp.classList.add('on');
      if (coinWaiting && sound !== false) play('coin');
      landed = true; coinWaiting = false;
      hero?.removeEventListener('click', finishAll);
      results = null;
    };
    results = { skip: () => finishAll(false), get landed() { return landed; } };
    if (!fx.motionOn()) { finishAll(); return; }
    hero?.addEventListener('click', finishAll);
    keep(fx.spatial(title, [{ transform: 'translateY(28px)' }, { transform: 'none' }], fx.M.base));
    keep(fx.effect(title, [{ opacity: 0 }, { opacity: 1 }], fx.M.ebase));
    if (big) big.textContent = '0';
    let count = 0;
    dots.forEach((d, i) => later(380 + i * 110, () => {
      d.classList.add('on');
      play('roll');
      if (d.classList.contains('ok') && big) { count += 1; big.textContent = String(count); keep(fx.spatial(big, [{ transform: 'scale(1.06)' }, { transform: 'none' }], fx.M.fast)); }
    }, 'results'));
    later(380 + dots.length * 110 + 120, () => { if (big) big.textContent = String(firstOk); land(); }, 'results');
  }
  /** WORLD 「움직임 줄이기」(바깥 창 :root[data-motion=reduced])를 게임 문서에도 적는다 — CSS 연출(입구 박자 · 결과 사진 다가감)이 따른다. */
  function syncMotion() {
    const root = document.documentElement;
    let outer = false;
    try { outer = window.parent?.document?.documentElement?.dataset?.motion === 'reduced' && window.parent !== window; } catch { outer = false; }
    if (outer) root.dataset.motion = 'reduced'; else if (root.dataset.motion === 'reduced') delete root.dataset.motion;
  }

  /* ── 사건 ── */
  return {
    BEAT,
    /** 놀이 틀 안에서 처음 한 번: 입구 세 층 · 재료 사진 · 목소리 막대 · 얼굴 두 장 · 연속 칩 · 멈춤 창 크기 둘 · 영수증 자리. */
    setup() {
      const hero = $('#lobby .hero'), h1 = $('#lobby .hero h1');
      if (hero && h1) {
        const art = document.createElement('div');
        art.className = 'w-art';
        const photo = Object.assign(document.createElement('img'), { className: 'w-photo', src: 'assets/world/lobby.webp', alt: '', decoding: 'async' });
        const glass = Object.assign(document.createElement('img'), { className: 'w-glass', src: 'assets/world/lobby-glass.webp', alt: '', decoding: 'async' });
        const echo = (w) => `<span class="w-echo" aria-hidden="true">${w}</span>`.repeat(3);   // 바쁜 박자의 색 잔상(읽기 프로그램은 제목 하나만)
        h1.innerHTML = `<span class="w-l"><span>주문</span>${echo('주문')}</span> <span class="w-l"><span>폭주</span>${echo('폭주')}<span class="w-hot" aria-hidden="true">폭주</span></span>`;
        $('#lobby .hero-copy>.kicker')?.insertAdjacentHTML('afterend', '<span class="w-ticker" aria-hidden="true">ORDER #<b id="w-orderno">017</b></span>');
        art.append(photo, h1, glass);
        hero.prepend(art);
        const lede = $('#lobby .hero .lede');
        if (lede) { lede.classList.add('w-lede'); $('#lobby .start-card')?.prepend(lede); }
      }
      for (const b of $$('[data-ingredient]')) {
        const img = b.querySelector('img');
        if (img) img.src = `assets/world/ingredients/${b.dataset.ingredient}.webp`;
      }
      $('#serve>span')?.insertAdjacentHTML('afterend', '<small class="w-serve-cup" aria-hidden="true"></small>');
      const dots = $('#b-dots');
      if (dots) for (let i = 0; i < 2; i += 1) dots.insertBefore(document.createElement('i'), dots.querySelector('.sr'));
      const g = $('#guest'), img = $('#guest-img');
      if (g && img) {
        const cam = document.createElement('div');
        cam.className = 'w-cam';
        const next = Object.assign(document.createElement('img'), { id: 'w-guest-next', alt: '', hidden: true });
        cam.append(img, next);
        g.append(cam);
      }
      $('#arena')?.insertAdjacentHTML('beforeend', '<p class="w-combo" id="w-combo" aria-hidden="true" hidden></p>');
      // 결과 포스터: 주문 점(아래 「이번 영업의 주문」 목록이 글로 다시 말하므로 읽기 프로그램에서는 숨긴다) · 8/8 도장
      $('#results .res-hero .big-cap')?.insertAdjacentHTML('afterend', '<ol class="w-dots" id="w-dots" aria-hidden="true"></ol>');
      $('#results .res-hero > div')?.insertAdjacentHTML('beforeend', '<p class="w-stamp" id="w-stamp" aria-hidden="true" hidden>전부 첫 서빙</p>');
      // 멈춤 창: 음악 · 효과음 크기(손님 목소리는 듣기 내용이라 늘 그대로 — 아이폰은 미디어 크기를 못 바꾼다)
      const quit = $('#quit');
      if (quit) {
        quit.insertAdjacentHTML('beforebegin', `<div class="w-mix" role="group" aria-label="소리 크기">
          <label><span>음악</span><input id="w-vol-music" type="range" min="0" max="100" step="5"></label>
          <label><span>효과음</span><input id="w-vol-sfx" type="range" min="0" max="100" step="5"></label></div>`);
        const vm = $('#w-vol-music'), vs = $('#w-vol-sfx');
        const mv = Number(recall('synk.order-rush.music.volume'));
        vm.value = String(Math.round((recall('synk.order-rush.music.volume') !== null && Number.isFinite(mv) ? mv : 1) * 100));
        vs.value = String(Math.round(sfxVolume() * 100));
        vm.addEventListener('input', () => { ensure(); music?.setVolume(Number(vm.value) / 100); });
        vs.addEventListener('input', () => { ensure(); remember(SFX_VOL, String(Number(vs.value) / 100)); sfx?.setVolume(Number(vs.value) / 100); });
        vs.addEventListener('change', () => play('tap'));
      }
      rollers = { score: $('#g-score') && fx.roller($('#g-score')), count: $('#g-count') && fx.roller($('#g-count')), order: $('#w-orderno') && fx.roller($('#w-orderno')) };
      // 입구 박자마다 주문 번호가 1~3씩 오른다(제목 첫 줄의 박자 애니메이션이 한 바퀴 돌 때)
      const beat = () => { orderNo += 1 + Math.floor(Math.random() * 3); const no = $('#w-orderno'); if (no) no.textContent = String(orderNo).padStart(3, '0'); };
      const line = $('#lobby .w-art h1 .w-l>span');
      line?.addEventListener('animationstart', beat);
      line?.addEventListener('animationiteration', beat);
      syncMotion();
      document.documentElement.classList.add('w-ready');   // 이제 WORLD 겉이 다 붙었다 — 화면을 보인다(world-skin.css)
      // 앱 「효과음」 설정(같은 출처 localStorage)은 효과음을 낼 때마다 읽는다(sfxOn). 음악은 게임 안 소리 단추 · 멈춤 창 크기를 따른다.
      // 첫 손짓: 미리 만든 문맥을 깨운다(resume만 — 입구는 음악 없이 조용하다, 「카페 문 열기」에서 시작)
      const first = () => { audio.unlock(); ensure(); removeEventListener('pointerdown', first, true); removeEventListener('keydown', first, true); };
      addEventListener('pointerdown', first, true);
      addEventListener('keydown', first, true);
      guardMedia();   // 주문 음성이 나는 동안만 playback(아이폰 무음 모드에서도 들린다)
      loadEnv();   // 오디오 문맥 · 음악 풀기 · 그림 풀기(early)는 처음 lobby()가 제목을 다 올린 뒤(움직임이 멈췄을 때) 부른다
      // 점심 러시를 고르면 러시 곡도 그때 풀어 둔다
      $('.modes [data-mode=rush]')?.addEventListener('click', () => { if (ensure()) music?.preload('rush'); });
    },
    /** 그림 미리 풀기(app.mjs가 손님 사진을 넘긴다). */
    warm,
    later,
    /** 손님이 말을 시작하기까지(문 종 뒤): 가림막이 걷히는 중이면 그만큼 더 기다린다. */
    chimeDelay() { return BEAT.chime + (curtainOn ? 320 : 0); },

    /** 입구: 음악 없이. 처음 한 번만 제목 두 줄이 잔 뒤에서 올라온다. */
    /** 입구. 처음 한 번은 prepare(app.mjs의 3D 작업대 만들기)를 받아 제목이 오르기 전에 부른다. */
    lobby({ prepare } = {}) {
      release();
      music?.stop(0.8);
      results?.skip();
      syncMotion();
      const art = $('#lobby .w-art');
      if (entered) {   // 영업 · 결과에서 돌아올 때: 가림막으로 덮고 입구가 그려지면 걷는다(③)
        const tok = cover();
        reveal(tok, [], () => { if (fx.motionOn()) art?.setAttribute('data-rush', ''); else art?.removeAttribute('data-rush'); });
        return;
      }
      entered = true;
      // 처음: 사진이 먼저 그려지고 → 3D 작업대(셰이더 굽기 — GPU를 잡는다)를 화면이 멈춰 있을 때 만들고 → 제목이 오르고 →
      // 등장이 끝나 아무것도 움직이지 않을 때 오디오 문맥 · 음악 · 그림 풀기(early — 메인 스레드를 잡는다. 이 PC에서 문맥 하나에 0.2~1초) → 바쁜 박자.
      // 첫 그리기(큰 사진 래스터) · 셰이더 굽기 · 오디오 문맥이 움직임과 겹치면 프레임을 버린다(11-03 밤 추적: 등장 중 7장).
      const anims = !fx.motionOn() ? [] : [
        ...$$('#lobby .hero h1 .w-l > span:first-child').map((s, i) => fx.spatial(s, [{ transform: 'translateY(108%)' }, { transform: 'none' }], fx.M.base, { delay: 120 + i * 80 })),
        fx.effect($('#lobby .w-lede'), [{ opacity: 0 }, { opacity: 1 }], fx.M.ebase, { delay: 280 }),
      ].filter(Boolean);
      anims.forEach((a) => a.pause());   // 첫 장면(제목은 잔 뒤 · 소개 글은 투명)에서 멈춰 둔다
      const settle = (fn) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(fn, 0)));
      // 끝난 등장은 떼어 낸다 — 같은 글자에 끝난 WAAPI가 남아 있으면 그 위에 거는 CSS 박자(wRushA/B)가 합성기로 못 가고(compositeFailed 64)
      // 메인 스레드에서 돌아, 메인 스레드가 잠깐만 바빠도 제목 박자가 끊겼다(11-03 밤 추적). 끝 모습(transform none · opacity 1)이 본래 모습이라 보이는 변화는 없다.
      // early는 따로 한 일(task)로 — finished 약속은 그리기 단계 안에서 풀려, 거기서 0.2~1초를 잡으면 그 장면이 늦게 나간다
      const rush = () => setTimeout(() => { early(); settle(() => { if (anims.length && !$('#lobby')?.hidden) art?.setAttribute('data-rush', ''); }); }, 0);
      settle(() => {
        try { prepare?.(); } catch { /* 작업대는 영업을 시작할 때 다시 만든다 */ }
        settle(() => {
          if (!anims.length || $('#lobby')?.hidden) { anims.forEach((a) => a.cancel()); early(); return; }   // 움직임 줄이기 · 그새 영업을 시작했다
          anims.forEach((a) => a.play());
          // 등장(0.7초)이 끝나면 바쁜 박자 — 3.4초마다 떠밀림 · 색 잔상 · 「폭주」 달아오름(CSS), 주문 번호(위 beat)
          Promise.all(anims.map((a) => a.finished)).then(() => { anims.forEach((a) => a.cancel()); rush(); }, rush);
        });
      });
    },
    /** 영업 시작: 문 종 + 불 켜지는 바람, 종 뒤 300ms에 음악 첫 박. */
    start(mode) {
      ensure();
      cancel('beat'); cancel('face');
      pendingReveal = cover();   // 첫 손님 사진이 풀리고 새 화면이 다 그려지면 걷는다(guest → reveal) — 손님이 없으면 0.9초 뒤 스스로
      const tok = pendingReveal;
      later(900, () => { if (pendingReveal === tok) { pendingReveal = 0; reveal(tok); } }, 'face');
      results?.skip();
      $('#lobby .w-art')?.removeAttribute('data-rush');   // 숨은 입구의 박자를 멈춘다(돌아오면 다시)
      play('open');
      later(300, () => { ambient(); music?.play(mode === 'rush' ? 'rush' : 'calm'); });
      if (mode === 'rush') music?.preload('rush');
      const chip = $('#w-combo'); if (chip) chip.hidden = true;
      lastTick = null;
    },
    /** 새 손님이 계산대에 선다 · 손님마다 다른 문 종. wasShown(앞 손님이 서 있었나)이면 앞 손님 위로 새 손님이 스며들고(④),
     *  비어 있었으면 오른쪽 24px에서 제자리. 영업을 막 연 첫 손님은 가림막 뒤에서 사진이 풀린 뒤 막이 걷힌다(③). */
    guest(t, id, src, name, wasShown = false) {
      const g = $('#guest');
      hideToken += 1;
      g.getAnimations().forEach((a) => a.cancel());   // 앞 손님 사라짐(hideGuest)의 끝 상태를 지운다
      if (faces()) {
        if (wasShown && !pendingReveal && fx.motionOn()) showFace(src, name, { slide: true });
        else { faceToken += 1; cancel('face'); faceSettle?.(); front.src = src; front.alt = name; back.hidden = true; back.removeAttribute('src'); }
      }
      if (pendingReveal) {
        const tok = pendingReveal; pendingReveal = 0;
        reveal(tok, [front?.decode ? front.decode().catch(() => {}) : Promise.resolve()]);
      } else if (!wasShown) {
        fx.spatial(g, [{ transform: 'translateX(24px)' }, { transform: 'none' }], fx.M.base);
        fx.effect(g, [{ opacity: 0 }, { opacity: 1 }], fx.M.ebase);
      }
      const bubble = $('#bubble');
      if (bubble && wasShown) fx.effect(bubble, [{ opacity: 0.35 }, { opacity: 1 }], fx.M.ebase);
      ensure();
      play('arrive', { guest: id });
    },
    /** 줄이 비어 계산대가 빌 때: 손님 · 말풍선이 200ms에 걸쳐 사라진 뒤 숨긴다(새 손님이 그사이 오면 그만둔다). */
    hideGuest(done) {
      const g = $('#guest'), b = $('#bubble'), tok = ++hideToken;
      const a = fx.effect(g, [{ opacity: 1 }, { opacity: 0 }], fx.M.ebase, { fill: 'forwards' });
      if (b && !b.hidden) fx.effect(b, [{ opacity: 1 }, { opacity: 0 }], fx.M.ebase);
      const end = () => { if (tok === hideToken) done(); };
      if (a) a.finished.then(end, end); else end();
    },
    /** 표정 바꾸기(app.mjs setMood): 받음은 컵이 미끄러진 뒤 120ms에. */
    face(src, mood) { showFace(src, null, { delay: mood === 'thanks' ? BEAT.face : 0 }); },
    /** CafeAudio 상태: 'playing'이면 음악 · 효과음을 내리고 막대를 움직인다. 처음 다 들은 순간이면 「내 차례」. */
    voice(status, t) {
      if (status === 'playing') {
        ensure();
        duck(!!t?.heard);
        const id = audio.order?.id;
        loadEnv().then(() => { if (audio.busy && audio.order?.id === id) startMeter(id); });
        return;
      }
      release();
      if (status === 'ready' && t && !t.worldTurn) { t.worldTurn = true; wake(); }
    },
    /** 영업 화면 한 장면마다: 음성이 다른 길로 멈췄으면(멈춤 · 다른 손님 · 서빙) 덕킹을 푼다. */
    frame() { if (ducked && !audio.busy) release(); },
    /** 재료 하나: 소리(재료 질감 + 그 컵의 n번째 칸) · 사진 조각이 컵으로 · 카드 복귀 · 진동. */
    ingredient(action, before, after, card) {
      ensure();
      const added = wasAdded(action, after), step = cupCount(after);
      // 얼음 땡은 3D 얼음이 컵 바닥에 닿는 시각에(stage.mjs ICE_LAND)
      if (added) { play(action, action === 'ice' ? { step, hits: ICE_LAND } : { step }); flyFrom(card, action); } else play('remove', { step: Math.max(1, step) });
      springBack(card);
      haptic('tap');
    },
    /** 컵을 다시 그릴 때: 서빙 알약 안 음료 이름, 빈 컵이면 알약을 흐리게(막지는 않는다). */
    cups(cups, active) {
      const label = $('#serve .w-serve-cup'), serve = $('#serve');
      const empty = cups.every((c) => !cupCount(c));
      if (label) label.textContent = cups.length > 1 ? `${cups.length}잔` : empty ? '' : cupLabel(cups[active] || cups[0]);
      serve?.classList.toggle('w-empty', empty);
    },
    cup(kind) { ensure(); play(kind === 'add' ? 'cup' : 'clear'); },
    /** 맞음: t0 서빙 소리(컵은 stage가 미끄러뜨린다) → +180 맞음 소리 · 점수 굴림 · 연속 칩. app.mjs가 점수를 쓰기 전에 부른다. */
    correct(t, { combo }) {
      ensure();
      play('serve');
      rollers?.score?.hold?.(BEAT.correct);
      later(BEAT.correct, () => {
        play('correct', { combo });
        haptic('ok');
        if (COMBO_AT.has(combo)) { comboChip(combo); later(170, () => play('combo')); }
      });
    },
    /** 손님이 받아 간 뒤: 받음 얼굴은 다음 손님이 스며들 때까지 그대로 둔다(사라졌다 나타나면 빈 홀이 비쳐 끊겨 보였다 — ④). */
    leave() {},
    /** 다름: 묻는 두 음 · 컵 좌우 한 번(벌주는 소리 · 빨간 표시 없음). */
    differ() { ensure(); play('differ'); shake(); },
    /** 점심 러시에서 기다리다 떠난 손님: 같은 문 종을 작게. */
    left(t) { play('leave', { guest: t?.worldGuest || 'g1' }); },
    /** 점수판을 쓴 뒤: 러시 끝 10초는 1초마다 똑딱(마지막 셋은 한 음 위), 시간 캡슐은 코랄(CSS data-last). */
    metrics(s) {
      const hud = $('.game-bar .hud');
      if (!s || s.mode !== 'rush') { hud?.removeAttribute('data-last'); return; }
      const leftSec = Math.max(0, Math.ceil(s.tuning.duration - s.time));
      hud?.toggleAttribute('data-last', leftSec <= 10 && leftSec > 0);
      if (leftSec <= 10 && leftSec > 0 && leftSec !== lastTick) { lastTick = leftSec; play('tick', { n: leftSec, last: leftSec <= 3 }); }
    },
    pause() { music?.pause(true); },
    resume() { music?.pause(false); },
    quit() { release(); music?.stop(0.6); cancel('beat'); cancel('face'); },
    /** 영업 끝: 음악은 1.2초에 걸쳐 물러나고(결과는 결과 소리가 주인공), 포스터 위에 주문 점이 찍히며 숫자가 오른다. */
    finish({ records, firstOk, total }) {
      release();
      cancel('beat'); cancel('face');
      music?.stop(1.2);
      syncMotion();
      buildDots(records);
      const big = $('#r-correct');
      if (big && fx.motionOn()) big.textContent = '0';
      // 가림막이 걷히기 전에 코인 정산이 먼저 와도 소리는 숫자가 앉은 뒤에(앞 판의 끝난 results가 남아 있어도 덮는다).
      coinWaiting = false;
      results = { landed: false, skip() { results = null; coinWaiting = false; } };
      const tok = cover();
      reveal(tok, [warm(['assets/world/close.webp'])], () => {
        play('done');
        haptic('done');
        playResults({ firstOk, perfect: total > 0 && firstOk === total });
      });
    },
    /** 코인 줄이 채워졌을 때(결과): 맑은 두 음. */
    coin() { if (results && !results.landed) coinWaiting = true; else play('coin'); },
    /** 게임 소리 켜기 · 끄기(게임 안 단추): 음악까지 따른다. */
    sound(on) { ensure(); music?.setOn(on); if (on) play('tap'); else release(); },
    tap() { ensure(); play('tap'); },
    /** 확인용(?qa): 덕킹 · 음악 상태. */
    state() { return { ducked, music: music?.state?.() || null, sfx: !!sfx }; },
  };
}
