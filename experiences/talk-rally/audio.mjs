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
 */
export function speak(item, { onEnd = () => {} } = {}) {
  note('voice', item.id);
  const buf = voices.get(item.id);
  if (!enabled || !ctx || ctx.state !== 'running' || !buf) {   // 글로 보여 주는 동안 읽을 시간(말 길이에 맞춰 0.9~3.2초)
    const wait = Math.min(3.2, Math.max(0.9, 0.35 + item.line.length * 0.11)), id = setTimeout(() => onEnd(false), wait * 1000);
    return { duration: wait, heard: false, stop: () => clearTimeout(id) };
  }
  const src = ctx.createBufferSource(); src.buffer = buf; src.connect(bus.out);
  let stopped = false;
  src.onended = () => { if (!stopped) onEnd(true); };
  src.start();
  return { duration: buf.duration, heard: true, stop: () => { stopped = true; try { src.stop(); } catch { /* 이미 끝남 */ } } };
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
