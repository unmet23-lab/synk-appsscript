// 말 랠리 — WORLD 캠퍼스 판의 연출(2026-11-04): 동아리 탁구장, 상대는 태오 선배. 사건마다 표정 · 소리 · 음악 · 움직임을 한 박자로 겹친다.
// app.mjs의 WORLD 분기만 불러온다(LAB 화면은 몽글 · 펠트 그대로). 규칙 · 문항 · 판정 · 학습 기록 · 코인은 core.mjs · learning.mjs · app.mjs 그대로 — 여기서는 보이고 들리는 것만 바꾼다.
// 움직임 토큰 · 음악 · 화면 효과음은 주문 폭주 2판과 같은 것(world-fx · world-music · world-sfx), 탁구 손맛 소리는 sfx.mjs 그대로다.
// 설계: qa/world-campus-20261104/설계.md
import { ITEMS, PRACTICE } from './content.mjs';
import { NARRATION } from './narration.mjs';
import * as sound from './audio.mjs';
import { createSfx } from './world-sfx.mjs';
import { createMusic } from './world-music.mjs';
import * as fx from './world-fx.mjs';
import { SCENE, PLATES, CLIPS, CLIP_BOX, CAST_ART } from './world-scene.mjs';
import { FEEL, LANES } from './stage.mjs';
import { WHO, WHO_FULL, REACT, itemVoice, reactVoice, narrationVoice, NARRATION_WORLD } from './world-lines.mjs';

export { WHO, WHO_FULL, SCENE };

// 몽글 대신 태오: 문항 음성 · 안내 음성 · 짧은 반응 파일 자리를 바꾼다. 문항 글과 정답은 그대로다.
for (const it of [PRACTICE, ...ITEMS]) it.voice = itemVoice(it.id);
for (const [k, v] of Object.entries(NARRATION_WORLD)) { NARRATION[k].text = v.text; NARRATION[k].file = narrationVoice(k); }
for (const k of Object.keys(REACT)) sound.FILES[k] = reactVoice(k);
delete sound.FILES.tap; delete sound.FILES.done;   // 몽글 소리는 앱에 없다 — 단추 소리는 world-sfx

/** 한 박자(ms). plate: 표정 판을 겹쳐 바꾸는 길이. waitLine: 공이 라켓 앞에서 이만큼 기다리면 태오가 「천천히 골라요」(한 판에 한 번). */
export const BEAT = Object.freeze({ swing: 300, plate: 130, waitLine: 7000 });
const RALLY_AT = new Set([3, 6, 9, 12]);
const SFX_VOL = 'synk.talk-rally.sfx.volume';
const MUSIC_VOL = 'synk.talk-rally.music.volume';

const recall = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const remember = (k, v) => { try { localStorage.setItem(k, v); } catch { /* 이번 판에서만 */ } };
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

export function createWorldPlay() {
  let ctx = null, sfx = null, music = null, analyser = null, meterRaf = 0, voices = 0;
  let plateKey = 'ready', front = null, back = null, plateToken = 0, plateHold = 0, sceneEl = null, pushAnim = null;
  let clipNow = null, afterClip = null, ralliedNext = false, missStreak = 0, lastLines = {}, waitTimer = 0, waitSaid = false, lastLineMs = 0;
  const clips = {};
  let rollers = null, resultsRun = null, coinWaiting = false, inGame = false, paused = false, farTimer = 0, lastLobbyAnim = false;
  let curtainOn = false, curtainToken = 0;
  const warmed = new Map();
  const groups = { beat: new Set(), results: new Set() };
  const later = (ms, fn, group = 'beat') => { const id = setTimeout(() => { groups[group].delete(id); fn(); }, ms); groups[group].add(id); return id; };
  const cancel = (group) => { for (const id of groups[group]) clearTimeout(id); groups[group].clear(); };

  /* ── 소리 ── */
  const pref = (name) => recall(`synk.world.${name}`) !== 'false';   // WORLD 앱 설정 「효과음」 · 「진동」과 같은 열쇠
  const sfxOn = () => sound.isOn() && pref('sound');
  const volume = (key) => { const raw = recall(key), v = Number(raw); return raw !== null && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1; };
  sound.hooks.ready = (c, bus) => {
    ctx = c;
    sfx = createSfx(c, { on: sfxOn, volume: volume(SFX_VOL) });
    music = createMusic(c, { destination: bus.out, storage: (() => { try { return localStorage; } catch { return null; } })() });
    analyser = c.createAnalyser(); analyser.fftSize = 512; analyser.smoothingTimeConstant = 0.5;
  };
  sound.hooks.tap = () => analyser;
  sound.hooks.voice = (on, { deep = false } = {}) => {
    voices = Math.max(0, voices + (on ? 1 : -1));
    music?.voice(voices > 0, { deep }); sfx?.duck(voices > 0);
    // 아이폰 무음 스위치: 듣기 게임이라 목소리가 나는 동안만 playback(WORLD 공통 규칙과 같은 꼴)
    try { const s = navigator.audioSession; const type = voices > 0 ? 'playback' : 'ambient'; if (s && s.type !== type) s.type = type; } catch { /* 없음 */ }
    // 태오가 말하는 동안은 언제나(문항 · 안내 · 짧은 반응) 머리 위 캡슐에 막대가 움직인다. 소리를 끈 때는 이 길을 타지 않는다
    const box = $('#speech');
    if (box && inGame) box.hidden = voices === 0;
    if (voices > 0) startMeter(); else stopMeter();
  };
  const play = (name, opts) => (sfx ? sfx.play(name, opts) : 0);
  /** 입구에서 쉬는 동안: 오디오 문맥을 멈춘 채 만들고 곡을 푼다(첫 손짓에 만들면 그 탭이 0.2~1초 멈춘다 — 주문 폭주 11-03 실측). */
  function early() {
    sound.unlock();
    music?.preload('calm');
    warm(Object.values(PLATES));
    loadClips();
  }
  function warm(srcs) {
    return Promise.all(srcs.map((src) => {
      if (warmed.has(src)) return warmed.get(src).p;
      const im = new Image(); im.decoding = 'async'; im.src = src;
      const p = (im.decode ? im.decode() : Promise.resolve()).catch(() => {});
      warmed.set(src, { im, p });
      return p;
    }));
  }
  function haptic(kind = 'ok') {
    if (!pref('haptic')) return;
    try {
      if (typeof navigator.vibrate === 'function') { navigator.vibrate(kind === 'done' ? [14, 40, 18] : [10]); return; }
      if (!('switch' in HTMLInputElement.prototype) || !/iPhone/.test(navigator.userAgent || '')) return;
      const label = document.createElement('label'), input = document.createElement('input');
      input.type = 'checkbox'; input.setAttribute('switch', ''); label.setAttribute('aria-hidden', 'true'); label.style.display = 'none'; label.append(input);
      label.addEventListener('click', (e) => e.stopPropagation());
      document.head.append(label); label.click(); label.remove();
    } catch { /* 진동 없음 */ }
  }

  /* ── 뒤쪽 탁구대의 먼 소리: 방이 살아 있게(몇 번 주고받다 쉰다). 태오가 말하는 동안 · 멈춤 창에서는 내지 않는다 ── */
  function farLoop(hits = 0, hi = false) {
    clearTimeout(farTimer);
    if (!inGame) return;
    const rally = hits > 0;
    farTimer = setTimeout(() => {
      if (inGame && !paused && voices === 0) play('far', { hi });
      farLoop(rally ? hits - 1 : 4 + Math.floor(Math.random() * 6), !hi);
    }, rally ? 620 + Math.random() * 240 : 2600 + Math.random() * 2600);
  }

  /* ── 화면 바꿈 가림막: 바꾸는 순간 바탕색으로 덮고, 새 화면이 두 장 그려지면 260ms에 걷는다(주문 폭주 11-03 — 첫 그리기의 끊김을 가린다) ── */
  function curtainEl() {
    let el = $('#w-curtain');
    if (!el) { el = document.createElement('div'); el.id = 'w-curtain'; el.setAttribute('aria-hidden', 'true'); document.body.append(el); }
    return el;
  }
  const within = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);
  const smooth = (min = 160, max = 650) => new Promise((resolve) => {
    const t0 = performance.now(); let last = null, calm = 0;
    const tick = (t) => {
      if (last !== null) calm = t - last < 22 ? calm + 1 : 0;
      last = t;
      const waited = performance.now() - t0;
      if ((calm >= 2 && waited >= min) || waited > max) resolve(); else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  function cover() {
    const el = curtainEl();
    el.getAnimations().forEach((a) => a.cancel());
    el.classList.add('on');
    curtainOn = true;
    return ++curtainToken;
  }
  async function reveal(token, waits = [], after = null) {
    await within(Promise.all(waits), 700);
    await within(smooth(), 900);   // 탭이 가려져 장면이 안 돌아도 걷는다
    if (token !== curtainToken) return;
    const el = curtainEl();
    el.classList.remove('on');
    curtainOn = false;
    if (fx.motionOn()) el.animate([{ opacity: 0.99 }, { opacity: 0 }], { duration: 260, easing: fx.M.eslow.easing });
    after?.();
  }

  /* ── 태오 표정: 판 두 장을 겹쳐 바꾼다(탁구대는 같은 자리라 사람만 바뀐다) ── */
  function setPlate(key, { hold = 0 } = {}) {
    if (!front || !PLATES[key]) return;
    if (hold) plateHold = performance.now() + hold;
    plateKey = key;
    const src = PLATES[key], token = ++plateToken;
    if (front.getAttribute('src') === src) return;
    back.src = src;
    const swap = () => {
      if (token !== plateToken) return;
      back.hidden = false; back.style.zIndex = '2'; front.style.zIndex = '1';
      const a = fx.effect(back, [{ opacity: 0 }, { opacity: 1 }], { duration: BEAT.plate, easing: fx.M.ebase.easing });
      const done = () => {
        if (token !== plateToken) return;
        const old = front; front = back; back = old;
        back.hidden = true; back.style.zIndex = ''; front.style.zIndex = '';
        a?.cancel();
      };
      if (a) a.finished.then(done, done); else done();
    };
    (back.decode ? back.decode() : Promise.resolve()).then(swap, swap);
  }
  /** 무대 표정(stage.setFace): talk · idle. 놓침 · 웃음은 landed가 정한다. 움직임 영상이 도는 동안은 영상이 끝난 뒤의 판만 정해 둔다. */
  function face(k) {
    const want = k === 'talk' ? (ralliedNext ? 'speak' : 'talk') : k === 'idle' ? 'ready' : null;
    if (!want) return;
    if (clipNow) { afterClip = want; return; }
    if (k === 'idle' && performance.now() <= plateHold) return;
    setPlate(want);
  }

  /* ── 움직임 영상: 태오가 좌 · 가운데 · 우로 움직여 치는 짧은 영상(소리 없음)을 사진 위 같은 자리에 겹친다. 탁구대 아래쪽은 사진 그대로라 3D와 어긋나지 않는다 ── */
  function loadClips() {
    for (const [k, c] of Object.entries(CLIPS)) {
      if (clips[k]) continue;
      const el = Object.assign(document.createElement('video'), { muted: true, playsInline: true, preload: 'auto', className: 'w-clip' });
      el.setAttribute('playsinline', ''); el.setAttribute('aria-hidden', 'true'); el.hidden = true;
      clips[k] = { el, ready: false, ...c };
      sceneEl?.insertBefore(el, sceneEl.querySelector('.stage-gl') || sceneEl.querySelector('#fx'));
      fetch(c.src).then((r) => r.blob()).then((b) => { el.src = URL.createObjectURL(b); el.load(); clips[k].ready = true; }).catch(() => { /* 영상이 없으면 표정 판으로 친다 */ });
    }
  }
  /** 영상 하나를 튼다. 틀 수 없으면(움직임 줄이기 · 못 받음) false — 부른 쪽이 표정 판으로 친다. */
  function playClip(name, next = 'ready') {
    const c = clips[name];
    if (!c?.ready || !fx.motionOn() || paused) return false;
    stopClip();
    const el = c.el;
    clipNow = c; afterClip = next;
    if (el.currentTime > 0.01) try { el.currentTime = 0; } catch { /* 처음 */ }
    el.hidden = false; el.style.opacity = '0';
    const shown = () => { if (clipNow === c) { el.style.opacity = '1'; fx.effect(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 100, easing: 'linear' }); } };
    if (el.requestVideoFrameCallback) el.requestVideoFrameCallback(shown); else el.addEventListener('playing', shown, { once: true });
    el.onended = () => { if (clipNow !== c) return; finishClip(); };
    const started = el.play();
    if (started?.catch) started.catch(() => { if (clipNow === c) finishClip(); });
    return true;
  }
  function finishClip() {
    const c = clipNow;
    if (!c) return;
    clipNow = null;
    const want = afterClip === 'speak' && voices === 0 ? 'ready' : afterClip;
    plateHold = 0;
    if (want) setPlate(want);
    const el = c.el, a = fx.effect(el, [{ opacity: 1 }, { opacity: 0 }], { duration: BEAT.plate, easing: fx.M.ebase.easing });
    const hide = () => { if (clipNow !== c) { el.hidden = true; el.style.opacity = ''; rewind(el); } };
    if (a) a.finished.then(hide, hide); else hide();
  }
  function stopClip() {
    const c = clipNow;
    if (!c) return;
    clipNow = null;
    try { c.el.pause(); } catch { /* 이미 멈춤 */ }
    c.el.hidden = true; c.el.style.opacity = '';
    rewind(c.el);
  }
  /** 다음에 틀 때 찾아가는 틈이 없게 끝나자마자 처음 장으로 돌려 둔다(찾아가는 틈만큼 태오가 공보다 늦는다). */
  function rewind(el) { try { el.currentTime = 0; } catch { /* 아직 못 받음 */ } }
  /** 같은 말을 연달아 하지 않게 고른다. */
  function pickLine(kind, list) {
    const pool = list.filter((x) => x !== lastLines[kind]);
    const name = (pool.length ? pool : list)[Math.floor(Math.random() * (pool.length || list.length))];
    lastLines[kind] = name;
    return name;
  }

  /* ── 목소리: 막대 다섯(실제 소리의 다섯 대역) · 카메라 다가감 ── */
  function startMeter() {
    const box = $('#speech');
    if (!box || !analyser || !fx.motionOn()) return;
    cancelAnimationFrame(meterRaf);
    const bars = $$('i', box), data = new Uint8Array(analyser.frequencyBinCount), B = [[2, 6], [6, 11], [11, 18], [18, 30], [30, 50]];
    const level = new Float32Array(bars.length);
    let prev = performance.now();
    box.classList.add('w-live');
    const loop = (now) => {
      meterRaf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, Math.max(0, (now - prev) / 1000)); prev = now;
      analyser.getByteFrequencyData(data);
      bars.forEach((b, i) => {
        let sum = 0; const [lo, hi] = B[i];
        for (let k = lo; k < hi; k += 1) sum += data[k];
        const target = Math.min(1, (sum / (hi - lo) / 255) * 1.35);
        const tau = target > level[i] ? 0.03 : 0.18;
        level[i] += (target - level[i]) * (1 - Math.exp(-dt / tau));
        b.style.transform = `scaleY(${(0.14 + level[i] * 0.86).toFixed(3)})`;
      });
    };
    meterRaf = requestAnimationFrame(loop);
  }
  function stopMeter() {
    cancelAnimationFrame(meterRaf);
    const box = $('#speech');
    if (!box) return;
    box.classList.remove('w-live');
    for (const b of $$('i', box)) b.style.transform = '';
  }
  /** 태오가 말하는 동안 카메라가 아주 천천히 다가가고(1 → 1.03), 공을 치면 빠르게 돌아온다. 흔들지 않는다. */
  function pushIn(ms) {
    if (!sceneEl || !fx.motionOn()) return;
    pushAnim?.cancel();
    pushAnim = sceneEl.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.03)' }], { duration: Math.max(1800, ms), easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'forwards' });
  }
  function pushOut() {
    if (!sceneEl || !pushAnim) return;
    const now = getComputedStyle(sceneEl).transform;
    pushAnim.cancel();
    pushAnim = null;
    if (fx.motionOn() && now && now !== 'none') sceneEl.animate([{ transform: now }, { transform: 'scale(1)' }], { ...fx.M.base, easing: 'cubic-bezier(.3,.7,.3,1)' });
  }

  /* ── 작은 연출 ── */
  function cardsIn() { $$('#cards .card').forEach((b, i) => { fx.spatial(b, [{ transform: 'translateY(16px)', opacity: 0 }, { transform: 'none', opacity: 1 }], fx.M.base, { delay: i * 45 }); }); }
  function cardsWake() { $$('#cards .card').forEach((b, i) => { if (!b.classList.contains('dim')) fx.spatial(b, [{ transform: 'translateY(-4px)' }, { transform: 'none' }], { duration: 220, easing: fx.M.fast.easing }, { delay: i * 30 }); }); }
  function rallyChip(n) {
    const chip = $('#w-rally');
    if (!chip) return;
    chip.textContent = `랠리 ${n}`;
    chip.hidden = false;
    chip.getAnimations().forEach((a) => a.cancel());
    fx.spatial(chip, [{ transform: 'translateY(8px) scale(.9)' }, { transform: 'none' }], fx.M.fast);
    fx.effect(chip, [{ opacity: 0 }, { opacity: 1 }], fx.M.efast);
    later(1000, () => { const a = fx.effect(chip, [{ opacity: 1 }, { opacity: 0 }], fx.M.ebase); const hide = () => { chip.hidden = true; }; if (a) a.finished.then(hide, hide); else hide(); });
  }
  function syncMotion() {
    const root = document.documentElement;
    let outer = false;
    try { outer = window.parent?.document?.documentElement?.dataset?.motion === 'reduced' && window.parent !== window; } catch { outer = false; }
    if (outer) root.dataset.motion = 'reduced'; else if (root.dataset.motion === 'reduced') delete root.dataset.motion;
  }

  /* ── 결과: 포스터 위의 연출. 주고받기마다 점이 찍히며 맞힐 때마다 큰 숫자가 오르고, 앉는 소리 → (12/12면) 도장. 탭하면 바로 끝난다 ── */
  function playResults(results) {
    cancel('results');
    const hero = $('#results .res-hero'), title = $('#r-title'), big = $('#r-correct'), stamp = $('#w-stamp'), ol = $('#w-dots');
    const correct = results.filter((r) => r.correct).length, perfect = results.length > 0 && correct === results.length;
    if (ol) ol.replaceChildren(...results.map((r) => { const li = document.createElement('li'); li.className = r.correct ? 'ok' : 'miss'; return li; }));
    const dots = $$('#w-dots li');
    if (stamp) { stamp.hidden = !perfect; stamp.classList.remove('on'); }
    const anims = [], keep = (a) => { if (a) anims.push(a); return a; };
    let landed = false;
    const land = () => {
      if (landed) return;
      landed = true;
      play('land');
      keep(fx.spatial(big, [{ transform: 'scale(1.12)' }, { transform: 'none' }], fx.M.fast));
      if (coinWaiting) { coinWaiting = false; later(160, () => play('coin'), 'results'); }
      if (perfect && stamp) later(300, () => { stamp.classList.add('on'); play('combo'); haptic('done'); }, 'results');
    };
    const finishAll = () => {
      cancel('results');
      for (const a of anims) { try { a.finish(); } catch { /* 이미 끝 */ } }
      if (big) big.textContent = String(correct);
      for (const d of dots) d.classList.add('on');
      if (perfect && stamp) stamp.classList.add('on');
      landed = true; coinWaiting = false;
      hero?.removeEventListener('click', finishAll);
      resultsRun = null;
    };
    resultsRun = { skip: finishAll };
    if (!fx.motionOn()) { finishAll(); return; }
    hero?.addEventListener('click', finishAll);
    keep(fx.spatial(title, [{ transform: 'translateY(28px)' }, { transform: 'none' }], fx.M.base));
    keep(fx.effect(title, [{ opacity: 0 }, { opacity: 1 }], fx.M.ebase));
    if (big) big.textContent = '0';
    let count = 0;
    dots.forEach((d, i) => later(420 + i * 95, () => {
      d.classList.add('on');
      play('roll');
      if (d.classList.contains('ok') && big) { count += 1; big.textContent = String(count); keep(fx.spatial(big, [{ transform: 'scale(1.06)' }, { transform: 'none' }], fx.M.fast)); }
    }, 'results'));
    later(420 + dots.length * 95 + 120, () => { if (big) big.textContent = String(correct); land(); }, 'results');
  }

  /** 짧은 말 하나를 낸다. kind가 smash면 랠리 길이로, miss면 연달아 틀린 수로 고른다. */
  function say(kind, rally = 0) {
    const name = kind === 'smash' ? (rally >= 9 ? 'pump1' : rally >= 6 ? pickLine('wow', ['wow1', 'wow2']) : pickLine('joy', ['joy1', 'joy2']))
      : kind === 'miss' ? (missStreak >= 2 ? pickLine('up', ['up1', 'up2']) : pickLine('calm', ['calm1', 'calm2'])) : kind;
    const sec = sound.fileSeconds(name);
    lastLineMs = sec * 1000;
    sound.hooks.voice(true);
    later(Math.max(500, lastLineMs), () => sound.hooks.voice(false));
    sound.play(name);
  }

  /* ── 입구 처음 등장: 사진 → 제목 → (다 선 뒤) 오디오 문맥 · 곡 풀기 → 제목의 공 박자. 끝난 등장 애니메이션은 떼어 낸다(world-fx) ── */
  function lobbyIn() {
    const art = $('.w-title');
    if (!art) return;
    const lines = $$('.w-w', art), lede = $('.w-lede'), start = $('#btn-start');
    const go = () => { art.toggleAttribute('data-rally', fx.motionOn()); };
    if (lastLobbyAnim || !fx.motionOn()) { go(); return; }
    lastLobbyAnim = true;
    lines.forEach((n, i) => {
      fx.spatial(n, [{ transform: 'translateY(105%)' }, { transform: 'none' }], fx.M.base, { delay: 120 + i * 80 });
    });
    fx.effect(lede, [{ opacity: 0 }, { opacity: 1 }], fx.M.eslow, { delay: 300 });
    fx.effect(start, [{ opacity: 0 }, { opacity: 1 }], fx.M.eslow, { delay: 360 });
    setTimeout(go, 900);
  }

  /* ── 사건 ── */
  return {
    BEAT,
    /** 3D 무대를 얹을 자리(사진 · 3D · 덧그림이 함께 다가가는 상자). */
    host: () => sceneEl,
    /** 처음 한 번: 장면 상자 · 입구 · 목소리 막대 · 랠리 칩 · 결과 자리 · 멈춤 창 크기. */
    setup() {
      // 장면: 흐린 바탕(넓은 화면 양옆) → 표정 판 두 장 → 3D · 덧그림. #arena의 누르기 · 카드 · 안내는 그대로 위에 있다
      const arena = $('#arena');
      sceneEl = document.createElement('div');
      sceneEl.id = 'w-scene';
      const sideL = Object.assign(document.createElement('div'), { className: 'w-side' });
      front = Object.assign(document.createElement('img'), { className: 'w-plate', alt: '', decoding: 'async', src: PLATES.ready });
      back = Object.assign(document.createElement('img'), { className: 'w-plate', alt: '', hidden: true, decoding: 'async' });
      sceneEl.append(sideL, front, back);
      const overlay = $('#fx');
      arena.prepend(sceneEl);
      sceneEl.append(overlay);
      SCENE.onLayout = (L, W, H) => {
        for (const img of [front, back]) Object.assign(img.style, { left: `${L.x}px`, top: `${L.y}px`, width: `${L.w}px`, height: `${L.h}px` });
        // 움직임 영상은 사진의 위쪽(탁구대 앞까지)만 덮는다
        arena.style.setProperty('--w-clip-x', `${L.x}px`); arena.style.setProperty('--w-clip-y', `${L.y + L.h * CLIP_BOX.top}px`);
        arena.style.setProperty('--w-clip-w', `${L.w}px`); arena.style.setProperty('--w-clip-h', `${L.h * CLIP_BOX.height}px`);
        sceneEl.toggleAttribute('data-wide', !!L.wide);
        arena.style.setProperty('--w-photo-x', `${L.x}px`); arena.style.setProperty('--w-photo-w', `${L.w}px`);
        // 다가가는 중심 = 태오 얼굴(사진 위쪽 가운데)
        sceneEl.style.transformOrigin = `${L.x + L.w * 0.5}px ${Math.max(0, L.y + L.h * 0.34)}px`;
        // 사진 안 자리: 목소리 막대를 태오 머리 바로 위에 둔다
        arena.style.setProperty('--w-head-y', `${Math.max(112, L.y + L.h * 0.295)}px`);
        arena.style.setProperty('--w-table-y', `${L.y + L.h * 0.595}px`);
      };
      // 입구: 태오가 라켓을 건네는 사진 · 큰 제목(공이 두 낱말 사이를 오간다)
      const hero = $('#lobby .hero'), h1 = $('#lobby .hero h1');
      if (hero && h1) {
        const art = document.createElement('div');
        art.className = 'w-art';
        art.append(Object.assign(document.createElement('img'), { className: 'w-photo', src: CAST_ART.lobby, alt: '', decoding: 'async' }));
        h1.innerHTML = '<span class="w-l"><span class="w-w">말</span></span> <span class="w-l"><span class="w-w">랠리</span></span><i class="w-ball" aria-hidden="true"></i>';
        h1.classList.add('w-title');
        hero.prepend(art);
        hero.append(h1);
        const lede = $('#lobby .hero .lede');
        if (lede) { lede.classList.add('w-lede'); $('#lobby .start-card')?.prepend(lede); }
      }
      const speech = $('#speech');
      if (speech) {
        for (let i = 0; i < 2; i += 1) speech.insertBefore(document.createElement('i'), speech.querySelector('.sr'));
        speech.insertAdjacentHTML('afterbegin', `<b class="w-who" aria-hidden="true">${WHO_FULL}</b>`);
        speech.querySelector('.sr').textContent = `${WHO_FULL}가 말하는 중`;
      }
      arena.insertAdjacentHTML('beforeend', '<p class="w-rally" id="w-rally" aria-hidden="true" hidden></p>');
      // 결과: 포스터 사진은 CSS, 주고받기 점(아래 목록이 글로 다시 말하므로 읽기 프로그램에서는 숨긴다) · 도장
      $('#results .res-hero .stars')?.insertAdjacentHTML('afterend', '<ol class="w-dots" id="w-dots" aria-hidden="true"></ol>');
      $('#results .res-hero > div')?.insertAdjacentHTML('beforeend', '<p class="w-stamp" id="w-stamp" aria-hidden="true" hidden>전부 받아쳤어요</p>');
      // 멈춤 창: 음악 · 효과음 크기(태오 목소리는 듣기 내용이라 늘 그대로)
      const quit = $('#quit');
      if (quit) {
        quit.insertAdjacentHTML('beforebegin', `<div class="w-mix" role="group" aria-label="소리 크기">
          <label><span>음악</span><input id="w-vol-music" type="range" min="0" max="100" step="5"></label>
          <label><span>효과음</span><input id="w-vol-sfx" type="range" min="0" max="100" step="5"></label></div>`);
        const vm = $('#w-vol-music'), vs = $('#w-vol-sfx');
        vm.value = String(Math.round(volume(MUSIC_VOL) * 100));
        vs.value = String(Math.round(volume(SFX_VOL) * 100));
        vm.addEventListener('input', () => { music?.setVolume(Number(vm.value) / 100); });
        vs.addEventListener('input', () => { remember(SFX_VOL, String(Number(vs.value) / 100)); sfx?.setVolume(Number(vs.value) / 100); });
        vs.addEventListener('change', () => play('tap'));
      }
      rollers = { score: $('#g-score') && fx.roller($('#g-score')), count: $('#g-count') && fx.roller($('#g-count')), rally: $('#g-rally') && fx.roller($('#g-rally')) };
      // 단추 소리: 카드(휙 · 톡이 따로 있다)와 시작 단추(자기 소리) 말고 모든 단추
      document.addEventListener('click', (e) => {
        const b = e.target.closest?.('button,a');
        if (!b || b.closest('#cards') || b.matches('#btn-start,#btn-daily,#r-again,#r-daily-again')) return;
        play('tap');
      }, true);
      // 사진 경로는 CSS가 아니라 고른 상대에서(world-cast.mjs)
      document.documentElement.style.setProperty('--w-art-result', `url(${CAST_ART.result})`);
      document.documentElement.style.setProperty('--w-art-ready', `url(${CAST_ART.ready})`);
      syncMotion();
      document.documentElement.classList.add('w-ready');   // 이제 WORLD 겉이 다 붙었다 — 화면을 보인다(world-skin.css)
      const first = () => { sound.unlock(); removeEventListener('pointerdown', first, true); removeEventListener('keydown', first, true); };
      addEventListener('pointerdown', first, true);
      addEventListener('keydown', first, true);
      // 오디오 문맥 · 곡 풀기 · 그림 풀기는 입구 제목이 다 선 뒤(움직임이 멈췄을 때)
      setTimeout(() => { (window.requestIdleCallback || ((fn) => setTimeout(fn, 200)))(early, { timeout: 2000 }); }, 1200);
    },
    warm,
    later,
    face,
    /** 화면 바꿈(app.mjs show): 가림막으로 덮고 그린 뒤 걷는다. */
    screen(id, waits = []) {
      const token = cover();
      syncMotion();
      if (id !== 'results') resultsRun?.skip();
      reveal(token, waits, id === 'lobby' ? lobbyIn : null);
    },
    /** 입구로 돌아옴. */
    lobby() { inGame = false; clearTimeout(farTimer); clearTimeout(waitTimer); music?.stop(1); cancel('beat'); stopClip(); pushOut(); },
    /** 시합 시작: 공 두 번 튀기는 소리 · 음악. */
    start() {
      play('start');
      inGame = true; paused = false; missStreak = 0; waitSaid = false; ralliedNext = false;
      loadClips();
      setPlate('ready');
      warm([CAST_ART.result]);
      later(300, () => music?.play('calm'));
      farLoop();
    },
    /** 다음 말의 꼴: rallied면 앞 공을 받아친 순간이라 공을 손에 들지 않은 말 판이다. */
    next({ rallied = false } = {}) { ralliedNext = rallied; },
    /** 태오가 한마디 시작: 카드 들어옴 · 카메라 다가감. duration(초)은 그 말 길이. 표정 판은 face('talk')가 이미 정했다. */
    talk(duration, { rallied = false } = {}) {
      cardsIn();
      pushIn((duration || 1.5) * 1000 + 700);
      if (rallied && !clipNow) setPlate('speak');
    },
    /** 공이 떴다: 카메라가 돌아오고 카드 줄이 깨어난다(들은 순간 = 내 차례). 받아치며 말하던 판은 다 들은 순간 기다림 판으로. */
    served() { pushOut(); cardsWake(); haptic('tap'); },
    /** 공을 띄워 치는 움직임. 라켓이 공에 닿을 때까지의 밀리초를 돌려준다(그 뒤에 3D 공이 뜬다). 영상을 못 틀면 받아침 판을 잠깐 보이고 바로. */
    serveClip() {
      const c = clips.serve;
      if (playClip('serve', 'ready')) return Math.round(c.contact * 1000);
      setPlate('return', { hold: BEAT.swing });
      later(BEAT.swing + 200, () => { if (plateKey === 'return') setPlate('ready'); });
      return 0;
    },
    /** 공이 라켓 앞에서 기다리기 시작함. 오래 기다리면 한 판에 한 번 「천천히 골라요」. */
    hold() {
      clearTimeout(waitTimer);
      if (waitSaid) return;
      waitTimer = setTimeout(() => {
        if (!inGame || paused) return;
        waitSaid = true;
        setPlate('wait', { hold: 2600 });
        say('wait1');
      }, BEAT.waitLine);
    },
    /** 대답을 골랐다. */
    chose() { clearTimeout(waitTimer); if (plateKey === 'wait') { plateHold = 0; setPlate('ready'); } },
    /** 내 라켓에 공이 맞았다: 맞으면 칭찬 표정(빠르면 놀람) → 공이 그 칸에 닿기 전에 태오가 그쪽으로 움직여 라켓이 공에 닿는 때를 맞춘다. 스매시는 받지 못하고 놓친다. */
    returned({ lane, ok, smash, quick }) {
      clearTimeout(waitTimer);
      if (!ok) { missStreak += 1; return; }
      missStreak = 0;
      if (smash) return;
      setPlate(quick ? 'quick' : 'nod', { hold: 500 });
      const clip = clips[['hitL', 'hitC', 'hitR'][lane]], ballMs = (FEEL.stop.ok + (FEEL.returnSec + 0.42) * 1000);
      const go = () => {
        if (!inGame) return;
        if (!playClip(['hitL', 'hitC', 'hitR'][lane], 'ready')) setPlate('return', { hold: BEAT.swing });
      };
      later(Math.max(0, ballMs - (clip?.contact ?? 0.3) * 1000), go);
    },
    /** 받아친 공이 칸에 닿음: 스매시는 랠리 길이에 따라 다른 표정, 틀리면 놓침(연달아 틀리면 응원). */
    landed({ verdict, smash, rally }) {
      if (verdict === 'ok') {
        if (smash) setPlate(rally >= 9 ? 'pump' : rally >= 6 ? 'wow' : 'cheer', { hold: 1400 });
        if (RALLY_AT.has(rally)) { rallyChip(rally); play('combo'); }
      } else setPlate(missStreak >= 2 ? 'cheerup' : 'miss', { hold: 1600 });
    },
    /** 공이 태오에게 닿는 순간(또는 스매시로 지나간 순간). 소리는 다음 공을 칠 때 무대가 낸다. */
    caught({ smash } = {}) { if (smash) stopClip(); },
    /** 짧은 말: 상황마다 다른 말을 고르고, 음악 아래에 묻히지 않게 잠깐 덕킹한다. */
    say(kind, rally = 0) { say(kind, rally); },
    /** 스매시 뒤 다음 공까지 기다릴 시간(짧은 말이 끝나도록). */
    reactMs() { return Math.max(1100, lastLineMs + 500); },
    finish(results) {
      inGame = false; clearTimeout(farTimer); clearTimeout(waitTimer); stopClip();
      music?.stop(1.2);
      pushOut();
      cancel('beat');
      playResults(results);
    },
    coin() { if (resultsRun) coinWaiting = true; else play('coin'); },
    pause() { paused = true; music?.pause(true); clearTimeout(waitTimer); try { clipNow?.el.pause(); } catch { /* 없음 */ } },
    resume() { paused = false; music?.pause(false); clipNow?.el.play()?.catch?.(() => finishClip()); },
    quit() { inGame = false; clearTimeout(farTimer); clearTimeout(waitTimer); music?.stop(0.6); cancel('beat'); stopClip(); pushOut(); stopMeter(); },
    /** 확인용(?qa). */
    state: () => ({ plate: plateKey, clip: clipNow?.src || null, clipsReady: Object.values(clips).filter((c) => c.ready).length, voices, music: music?.state?.() || null, ctx: ctx?.state || null }),
  };
}
