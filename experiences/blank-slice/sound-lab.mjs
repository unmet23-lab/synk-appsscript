// 빈칸 베기 — 손맛 소리 시청 페이지. 게임과 같은 합성(sfx.mjs)과 같은 사운드킷 파일(audio.mjs의 FILES)로 소리를 낸다.
// 확인용으로 같은 소리를 파일처럼 굽는 기능(window.__lab.render)도 여기 있다(qa/sound.cjs·qa/demo.cjs가 쓴다).
import { createBus, VOICES } from './sfx.mjs';
import { loadKit } from './audio.mjs';

// 벤 뒤 낱말이 빈칸에 끼워질 때까지: 히트스톱 85ms + 날아가기 380ms(stage.mjs FEEL.stop.ok · app.mjs flyToBlank)
const LAND = 0.465;
const S = (t, name, opts = {}) => ({ t, kind: 'sfx', name, opts });
const K = (t, name) => ({ t, kind: 'kit', name });

/** 들어 볼 장면. v = 'felt'(A) | 'clean'(B). 시각은 초. 게임의 흐름(app.mjs)과 같은 간격이다. */
export const SEQ = {
  flow: (v) => [
    S(0, 'launch', { n: 1, x: -0.72, variant: v }), S(0.12, 'launch', { n: 1, x: -0.24, variant: v }),
    S(0.24, 'launch', { n: 1, x: 0.24, variant: v }), S(0.36, 'launch', { n: 1, x: 0.72, variant: v }),
    S(1.3, 'whoosh', { power: 0.75, x: -0.7, to: 0.1, variant: v }),
    S(1.36, 'slice', { correct: true, combo: 1, x: -0.3, variant: v }),
    S(1.36 + LAND, 'snap', { x: 0 }), K(1.36 + LAND + 0.015, 'earn'),
  ],
  combo: (v) => Array.from({ length: 6 }, (_, i) => {
    const t = i * 0.8, x = i % 2 ? 0.35 : -0.35;
    return [
      S(t, 'whoosh', { power: 0.8, x: -x, to: x, variant: v }),
      S(t + 0.05, 'slice', { correct: true, combo: i + 1, x, variant: v }),
      S(t + 0.05 + LAND, 'snap', { x: 0 }), K(t + 0.05 + LAND + 0.015, 'earn'),
      ...(i + 1 === 4 ? [K(t + 0.05 + 0.3, 'joy1')] : []),   // 4연속마다 몽글 기쁨
    ];
  }).flat(),
  wrong: (v) => [S(0, 'whoosh', { power: 0.7, x: 0.5, to: -0.2, variant: v }), S(0.06, 'slice', { correct: false, x: 0.2, variant: v }), K(0.3, 'calm1')],
  sliceOk: (v) => [S(0, 'slice', { correct: true, combo: 1, variant: v })],
  sliceWrong: (v) => [S(0, 'slice', { correct: false, variant: v })],
  sliceSide: (v) => [S(0, 'slice', { correct: true, combo: 4, x: 0.72, variant: v })],   // 가장 큰 경우: 화면 가장자리 + 4연속 겹음
  swingSoft: (v) => [S(0, 'whoosh', { power: 0.25, x: -0.6, to: 0.6, variant: v })],
  swingHard: (v) => [S(0, 'whoosh', { power: 1, x: -0.6, to: 0.6, variant: v })],
  launch: (v) => [S(0, 'launch', { n: 2, x: -0.5, variant: v }), S(0.1, 'launch', { n: 2, x: 0.5, variant: v })],
  fill: () => [S(0, 'snap', { x: 0 }), K(0.015, 'earn')],
  snapOnly: () => [S(0, 'snap', { x: 0 })],
  starOnly: () => [S(0, 'star', { i: 0 })],
  // 확인용: 가장 많이 겹치는 순간(몽글 목소리 + 9연속 베기 + 빠른 휙 + 던지기 넷 + 끼워짐)
  stress: (v) => [K(0, 'calm1'), K(0.01, 'joy1'), S(0.02, 'whoosh', { power: 1, variant: v }), S(0.03, 'slice', { correct: true, combo: 9, variant: v }),
    ...[0, 0.01, 0.02, 0.03].map((t, i) => S(0.03 + t, 'launch', { n: 2, x: i / 2 - 0.75, variant: v })), S(0.05, 'snap'), K(0.065, 'earn'), K(0.06, 'achieve')],
  stars: () => [K(0, 'achieve'), S(0.3, 'star', { i: 0 }), S(0.52, 'star', { i: 1 }), S(0.74, 'star', { i: 2 })],
};

function schedule(b, kit, events, t0) {
  for (const e of events) {
    if (e.kind === 'kit') {
      const buf = kit.get(e.name); if (!buf) continue;
      const s = b.c.createBufferSource(); s.buffer = buf; s.connect(b.out); s.start(t0 + e.t);
    } else VOICES[e.name]?.(b, t0 + e.t, e.opts || {});
  }
}

let ctx = null, bus = null;
const kit = new Map();
async function ready() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    bus = createBus(ctx);
    await loadKit(ctx, kit);
  }
  if (ctx.state === 'suspended') await ctx.resume();
}
export async function playSeq(events) { await ready(); schedule(bus, kit, events, ctx.currentTime + 0.05); }

/** 같은 소리를 파일처럼 굽는다(OfflineAudioContext). 반환: 16비트 스테레오 WAV의 base64. */
export async function render(events, seconds, { sampleRate = 44100, seed = 11 } = {}) {
  const off = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  const b = createBus(off, { seed }), k = new Map();
  await loadKit(off, k);
  schedule(b, k, events.filter((e) => e.t >= 0 && e.t < seconds), 0);
  return wavBase64(await off.startRendering());
}
function wavBase64(buf) {
  const ch = buf.numberOfChannels, n = buf.length, sr = buf.sampleRate, size = 44 + n * ch * 2;
  const dv = new DataView(new ArrayBuffer(size)); let o = 0;
  const str = (s) => { for (const c of s) dv.setUint8(o++, c.charCodeAt(0)); };
  const u32 = (v) => { dv.setUint32(o, v, true); o += 4; }, u16 = (v) => { dv.setUint16(o, v, true); o += 2; };
  str('RIFF'); u32(size - 8); str('WAVE'); str('fmt '); u32(16); u16(1); u16(ch); u32(sr); u32(sr * ch * 2); u16(ch * 2); u16(16); str('data'); u32(n * ch * 2);
  const data = Array.from({ length: ch }, (_, i) => buf.getChannelData(i));
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, data[c][i])); dv.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2; }
  const u8 = new Uint8Array(dv.buffer); let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}

// ── 페이지 ──
if (typeof document !== 'undefined') {
  for (const btn of document.querySelectorAll('[data-play]')) {
    btn.addEventListener('click', () => {
      const seq = SEQ[btn.dataset.play]; if (!seq) return;
      btn.classList.remove('playing'); void btn.offsetWidth; btn.classList.add('playing');
      playSeq(seq(btn.dataset.v || 'felt'));
    });
  }
  window.__lab = { render, SEQ: Object.fromEntries(Object.entries(SEQ).map(([k, f]) => [k, (v) => f(v)])) };
}
