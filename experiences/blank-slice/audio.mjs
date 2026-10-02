// 소리: 브랜드 사운드킷 파일(획득·성취·몽글 목소리)과 손맛 소리 합성(sfx.mjs)을 같은 길로 울린다.
// 틀려도 버저를 울리지 않는다(사운드킷 규칙 ②). 손맛 소리는 사운드킷의 셋째 가족 ‘게임 효과음’이다(A 「펠트 사각」, 2026-10-02 유호님 확정).
// 사운드킷 파일은 크기를 바꾸지 않고 그대로 튼다(밸런스는 파일에 이미 있다 — 사운드킷 README).
import { createBus, VOICES, VARIANTS } from './sfx.mjs';

export const FILES = {
  earn: 'assets/sound/earn.wav', achieve: 'assets/sound/achieve.wav', notify: 'assets/sound/notify.wav',
  joy1: 'assets/sound/mongle-miyu.wav', joy2: 'assets/sound/mongle-myang.wav',
  calm1: 'assets/sound/mongle-mii.wav', calm2: 'assets/sound/mongle-miyuu.wav',
  done: 'assets/sound/mongle-moong.wav', tap: 'assets/sound/mongle-mu.wav',
};
const KEY = 'synk.blank-slice.sound';
let ctx = null, bus = null, loading = null;
const buffers = new Map();
let enabled = (() => { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } })();
// 손맛 소리는 A 「펠트 사각」(felt)이다. 주소에 ?sfx=clean이 있을 때만 그 접속에서 고르지 않은 후보 B를 들려준다(시청용, 기억하지 않는다).
// 확정 전 시청 페이지가 브라우저에 기억해 둔 변형은 지운다(남아 있으면 그 브라우저만 계속 B가 난다)
const variant = (() => {
  try { localStorage.removeItem('synk.blank-slice.sfx'); } catch { /* 저장소를 못 쓰는 브라우저 */ }
  const q = new URLSearchParams(location.search).get('sfx');
  return VARIANTS.includes(q) ? q : 'felt';
})();
let log = null;   // 확인용(?qa): 울린 소리와 시각. 시연 영상에 같은 소리를 입힐 때 쓴다

export const isOn = () => enabled;
export const sfxVariant = () => variant;
export function setOn(value) {
  enabled = !!value;
  try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch { /* 이번 접속에만 */ }
  if (bus) bus.out.gain.value = enabled ? 1 : 0;
}

export async function loadKit(c, into) {
  await Promise.all(Object.entries(FILES).map(async ([k, url]) => {
    try { const res = await fetch(url); into.set(k, await c.decodeAudioData(await res.arrayBuffer())); } catch { /* 하나 없어도 계속 */ }
  }));
}

/** 사용자 조작 뒤에만 부른다(자동 재생 정책). */
export async function unlock() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC({ latencyHint: 'interactive' });
      bus = createBus(ctx); bus.out.gain.value = enabled ? 1 : 0;
      loading = loadKit(ctx, buffers);
    }
    if (ctx.state === 'suspended') await ctx.resume();
    await loading;
  } catch { ctx = null; bus = null; }
}

const note = (kind, name, opts, delay = 0) => { if (log) log.push({ kind, name, opts, t: performance.now() + delay * 1000 }); };

/** 사운드킷 파일 하나. delay초 뒤에 울릴 수 있다. */
export function play(name, { delay = 0 } = {}) {
  if (!enabled) return;
  note('kit', name, undefined, delay);
  const buf = ctx && buffers.get(name); if (!buf) return;
  const src = ctx.createBufferSource(); src.buffer = buf; src.connect(bus.out); src.start(ctx.currentTime + delay);
}

/** 손맛 소리 하나(sfx.mjs의 VOICES). */
export function sfx(name, opts = {}) {
  if (!enabled || !VOICES[name]) return;
  const o = { ...opts, variant };
  note('sfx', name, o);
  if (!ctx || ctx.state !== 'running') return;
  try { VOICES[name](bus, ctx.currentTime, o); } catch { /* 소리 하나가 실패해도 게임은 계속 */ }
}

export function startLog() { log = []; }
export const takeLog = () => (log ? log.splice(0) : []);
export const pick = (a, b) => (Math.random() < 0.5 ? a : b);
