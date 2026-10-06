// 소리: 몽글의 말(미리 구운 음성), 브랜드 사운드킷 파일(획득·성취·몽글 목소리), 탁구 손맛 소리 합성(sfx.mjs)을 같은 길로 울린다.
// 틀려도 버저를 울리지 않는다(사운드킷 규칙 ②). 사운드킷 파일은 크기를 바꾸지 않고 그대로 튼다.
import { createBus, VOICES } from './sfx.mjs';

export const FILES = {
  earn: 'assets/sound/earn.wav', achieve: 'assets/sound/achieve.wav', notify: 'assets/sound/notify.wav',
  joy1: 'assets/sound/mongle-miyu.wav', joy2: 'assets/sound/mongle-myang.wav',
  calm1: 'assets/sound/mongle-mii.wav', calm2: 'assets/sound/mongle-miyuu.wav',
  done: 'assets/sound/mongle-moong.wav', tap: 'assets/sound/mongle-mu.wav',
};
const KEY = 'synk.talk-rally.sound';
let ctx = null, bus = null, loading = null;
const buffers = new Map(), voices = new Map();
let enabled = (() => { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } })();
let log = null;   // 확인용(?qa): 울린 소리와 시각

export const isOn = () => enabled;
export const ready = () => !!ctx && ctx.state === 'running';
export function setOn(value) {
  enabled = !!value;
  try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch { /* 이번 접속에만 */ }
  if (bus) bus.out.gain.value = enabled ? 1 : 0;
  if (!enabled) stopNarration();   // 소리를 끄면 안내도 곧바로 멈추고 판을 붙잡지 않는다
}

async function loadInto(c, map, entries) {
  await Promise.all(entries.map(async ([k, url]) => {
    if (map.has(k)) return;
    try { const res = await fetch(url); map.set(k, await c.decodeAudioData(await res.arrayBuffer())); } catch { /* 하나 없어도 계속 */ }
  }));
}

/** 사용자 조작 뒤에만 부른다(자동 재생 정책). */
export async function unlock() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC({ latencyHint: 'interactive' });
      bus = createBus(ctx); bus.out.gain.value = enabled ? 1 : 0;
      loading = loadInto(ctx, buffers, Object.entries(FILES));
    }
    if (ctx.state === 'suspended') await ctx.resume();
    await loading;
  } catch { ctx = null; bus = null; }
}

/** 이번 판의 몽글 말을 미리 풀어 둔다(말하는 순간 끊김 없이). */
export async function preloadVoices(items) {
  if (!ctx) return;
  await loadInto(ctx, voices, items.map((x) => [x.id, x.voice]));
}
export const voiceSeconds = (id) => voices.get(id)?.duration || null;

const note = (kind, name, opts, delay = 0) => { if (log) log.push({ kind, name, opts, t: performance.now() + delay * 1000 }); };

/**
 * 몽글의 말 하나를 끝까지 튼다. 끝나면 onEnd(true), 소리를 꺼 두었거나 틀 수 없으면 곧바로 onEnd(false).
 * 듣기 기록은 끝까지 들려준 말만 혼자 해낸 근거가 된다(learning.mjs heard).
 * 소리 장치가 도중에 멈추면(기기의 소리 길이 바뀌는 중·전화 등) 끝났다는 신호가 오지 않는다. 게임은 그 신호에 공을 치므로,
 * 말 길이 + VOICE_GUARD초가 지나도 신호가 없으면 스스로 넘긴다: 소리 시계가 말 길이만큼 갔으면 들려준 것(신호만 늦음),
 * 아니면 못 들려준 것(onEnd(false) — 게임이 그 말을 글로 보여 준다). 10-05 확인 중 소리 장치가 잠깐 멈춰 게임이 몽글의 말에서
 * 멈춰 있던 것을 보고 넣었다.
 */
export const VOICE_GUARD = 1.5;
export function speak(item, { onEnd = () => {} } = {}) {
  stopNarration();   // 안내 음성은 몽글의 말 위에 겹치지 않는다
  note('voice', item.id);
  const buf = voices.get(item.id);
  if (!enabled || !ctx || ctx.state !== 'running' || !buf) {   // 글로 보여 주는 동안 읽을 시간(말 길이에 맞춰 0.9~3.2초)
    const wait = Math.min(3.2, Math.max(0.9, 0.35 + item.line.length * 0.11)), id = setTimeout(() => onEnd(false), wait * 1000);
    return { duration: wait, heard: false, stop: () => clearTimeout(id) };
  }
  const c = ctx, src = c.createBufferSource(); src.buffer = buf; src.connect(bus.out);
  let done = false, guard = 0;
  const finish = (heard) => { if (done) return; done = true; clearTimeout(guard); onEnd(heard); };
  src.onended = () => finish(true);
  const t0 = c.currentTime;
  guard = setTimeout(() => {
    const played = c.currentTime - t0 >= buf.duration - 0.05;
    if (!played) { try { src.stop(); } catch { /* 시작도 못 함 */ } }
    finish(played);
  }, (buf.duration + VOICE_GUARD) * 1000);
  src.start();
  return { duration: buf.duration, heard: true, stop: () => { done = true; clearTimeout(guard); try { src.stop(); } catch { /* 이미 끝남 */ } } };
}

/**
 * 몽글의 말을 천천히(기본 0.75배) 한 번 더 튼다. 목소리 높이는 그대로 두고 빠르기만 늦춘다(브라우저 오디오 요소의 음높이 유지).
 * 같은 소리 길(버스·리미터·소리 끄기)로 나간다. 듣기 확인용 도움이라 학습 기록은 부른 쪽이 ‘다시 듣기’로 남긴다.
 */
let slowEl = null;
function slowElement() {
  if (!slowEl) { slowEl = new Audio(); slowEl.preload = 'auto'; ctx.createMediaElementSource(slowEl).connect(bus.out); }
  return slowEl;
}
/** 공이 기다리기 시작하면 그 말의 파일을 미리 불러 둔다(처음 누를 때 0.1~0.3초 늦게 시작하지 않게). */
export function prepareSlow(item) {
  if (!enabled || !ctx) return;
  try { const el = slowElement(); if (!el.src.endsWith(item.voice.replace(/^\.?\//, ''))) { el.pause(); el.src = item.voice; } } catch { /* 미리 못 불러도 누를 때 부른다 */ }
}
export function speakSlow(item, { rate = 0.75, onEnd = () => {} } = {}) {
  stopNarration();
  note('voice-slow', item.id, { rate });
  if (!enabled || !ctx || ctx.state !== 'running') { onEnd(false); return { stop() {} }; }
  try {
    slowElement();
    slowEl.pause();
    if (slowEl.src.endsWith(item.voice.replace(/^\.?\//, ''))) slowEl.currentTime = 0;   // 같은 말이면 다시 받지 않고 처음부터
    else slowEl.src = item.voice;
    for (const k of ['preservesPitch', 'mozPreservesPitch', 'webkitPreservesPitch']) if (k in slowEl) slowEl[k] = true;
    slowEl.defaultPlaybackRate = rate; slowEl.playbackRate = rate;   // src를 바꾸면 빠르기가 기본값으로 돌아가니 둘 다 둔다
    let done = false;
    slowEl.onended = () => { if (!done) { done = true; onEnd(true); } };
    slowEl.play().catch(() => { if (!done) { done = true; onEnd(false); } });
    return { stop: () => { done = true; try { slowEl.pause(); } catch { /* 이미 멈춤 */ } } };
  } catch { onEnd(false); return { stop() {} }; }
}
export const slowState = () => (slowEl ? { rate: slowEl.playbackRate, paused: slowEl.paused, time: slowEl.currentTime, src: slowEl.src.split('/').pop(), ready: slowEl.readyState, net: slowEl.networkState, error: slowEl.error?.code || null, ended: slowEl.ended } : null);

/* ── 안내 음성(나레이션, 2026-10-07) ──
 * 판이 바뀌는 때에만 튼다(한 판 시작·연습 공 뒤·결과 — app.mjs). 같은 소리 길이라 소리 끄기를 따르고, 입구의 「안내 음성」으로 따로 끈다.
 * 판을 그 말 길이보다 오래 붙잡지 않는다: 틀 수 없으면 곧바로, 끝났다는 신호가 오지 않으면 말 길이 + NARRATION_GUARD초 뒤에 넘긴다
 * (몽글의 말 VOICE_GUARD와 같은 생각). 몽글의 말·다시 듣기가 시작되면 먼저 멈춘다. */
const NARRATION_KEY = 'synk.talk-rally.narration';
export const NARRATION_GUARD = 0.3;
let narrationOn = (() => { try { return localStorage.getItem(NARRATION_KEY) !== 'off'; } catch { return true; } })();
const narrations = new Map();
let narrating = null;
export const narrationIsOn = () => narrationOn;
export function setNarration(value) {
  narrationOn = !!value;
  try { localStorage.setItem(NARRATION_KEY, narrationOn ? 'on' : 'off'); } catch { /* 이번 접속에만 */ }
  if (!narrationOn) stopNarration();
}
/** 안내 문장 파일을 미리 풀어 둔다(작은 파일 여덟 개). */
export async function preloadNarration(lines) {
  if (!ctx) return;
  await loadInto(ctx, narrations, lines.map((x) => [x.id, x.file]));
}
export const canNarrate = (id) => enabled && narrationOn && !!ctx && ctx.state === 'running' && narrations.has(id);
/** 안내 한 줄. 끝까지 들려주면 true, 틀 수 없거나 도중에 멈추면 false로 풀리는 약속. */
export function narrate(id) {
  stopNarration();
  if (!canNarrate(id)) return Promise.resolve(false);
  const buf = narrations.get(id), src = ctx.createBufferSource(); src.buffer = buf; src.connect(bus.out);
  note('narration', id, { duration: buf.duration });
  return new Promise((resolve) => {
    let done = false, guard = 0;
    const finish = (played) => { if (done) return; done = true; clearTimeout(guard); if (narrating?.src === src) narrating = null; resolve(played); };
    src.onended = () => finish(true);
    guard = setTimeout(() => { try { src.stop(); } catch { /* 시작도 못 함 */ } finish(false); }, (buf.duration + NARRATION_GUARD) * 1000);
    narrating = { id, src, finish };
    src.start();
  });
}
export function stopNarration() {
  const n = narrating; narrating = null;
  if (!n) return;
  note('narration-stop', n.id);
  try { n.src.stop(); } catch { /* 이미 끝남 */ }
  n.finish(false);
}

/** 사운드킷 파일 하나. delay초 뒤에 울릴 수 있다. */
export function play(name, { delay = 0 } = {}) {
  if (!enabled) return;
  note('kit', name, undefined, delay);
  const buf = ctx && buffers.get(name); if (!buf) return;
  const src = ctx.createBufferSource(); src.buffer = buf; src.connect(bus.out); src.start(ctx.currentTime + delay);
}

/** 손맛 소리 하나(sfx.mjs의 VOICES). delay초 뒤에 울릴 수 있다. */
export function sfx(name, opts = {}, { delay = 0 } = {}) {
  if (!enabled || !VOICES[name]) return;
  note('sfx', name, opts, delay);
  if (!ctx || ctx.state !== 'running') return;
  try { VOICES[name](bus, ctx.currentTime + delay, opts); } catch { /* 소리 하나가 실패해도 게임은 계속 */ }
}

export function startLog() { log = []; }
export const takeLog = () => (log ? log.splice(0) : []);
export const pick = (a, b) => (Math.random() < 0.5 ? a : b);
