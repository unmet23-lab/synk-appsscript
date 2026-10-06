// 말 랠리 소리 시청 페이지: 게임과 같은 합성(sfx.mjs)·같은 사운드킷 파일·같은 몽글 음성으로 장면별 소리를 들려준다.
// 확인용으로 같은 소리를 파일처럼 굽는 기능(window.__lab.render)도 여기 있다(qa/sound.cjs가 쓴다).
import { createBus, VOICES } from './sfx.mjs';
import { FILES } from './audio.mjs';
import { NARRATION_LINES } from './narration.mjs';

const T = (t, kind, name, opts) => ({ t, kind, name, opts });
const LANE = [-0.74, 0, 0.74];
/** 장면: [시각(초), 종류(sfx·kit·voice), 이름, 설정]. 게임의 흐름과 같은 순서·간격(공 2.4초, 받아친 공 0.62초). */
export const SEQ = {
  hitOk: () => [T(0, 'sfx', 'hit', { correct: true, rally: 1, power: 0.7, x: 0 })],
  /** 빠르게: 공이 라켓 앞에서 기다리기 전에 골라 받아침 → 톡·팅 0.11초 뒤 사운드킷 ‘획득’ */
  quick: () => [T(0, 'sfx', 'hit', { correct: true, rally: 2, power: 0.7, x: 0 }), T(0.11, 'kit', 'earn')],
  hitWrong: () => [T(0, 'sfx', 'hit', { correct: false, power: 0.7, x: LANE[0] })],
  smash: () => [T(0, 'sfx', 'hit', { correct: true, rally: 3, smash: true, power: 0.7, x: LANE[2] }), T(0.26, 'kit', 'joy1')],
  opponent: () => [T(0, 'sfx', 'opponent', { power: 0.6, x: 0.3 })],
  bounceNear: () => [T(0, 'sfx', 'bounce', { near: 1, x: 0.1 })],
  bounceFar: () => [T(0, 'sfx', 'bounce', { near: 0, x: LANE[1] })],
  swingSoft: () => [T(0, 'sfx', 'swing', { power: 0.35, x: 0, to: LANE[0] * 1.6 })],
  swingHard: () => [T(0, 'sfx', 'swing', { power: 1, x: 0, to: LANE[2] * 1.6 })],
  /** 한 번 주고받기: 몽글의 말 → 몽글 톡 → 내 쪽 틱 → (고르며 휙) → 받아치기 톡·팅 → 몽글 쪽 틱 */
  exchange: () => [T(0, 'voice', 'f01'), T(0.95, 'sfx', 'opponent', { power: 0.55, x: 0.35 }), T(1.55, 'sfx', 'swing', { power: 0.35, x: 0, to: LANE[1] }),
    T(0.95 + 2.4 * 0.62, 'sfx', 'bounce', { near: 1, x: 0.15 }), T(0.95 + 2.4, 'sfx', 'hit', { correct: true, rally: 1, power: 0.7, x: 0 }),
    T(0.95 + 2.4 + 0.62, 'sfx', 'bounce', { near: 0, x: 0 })],
  /** 틀린 칸으로 받아치기: 같은 톡(팅 없음) → 칸에 틱 → 몽글 ‘괜찮아’ */
  wrong: () => [T(0, 'sfx', 'hit', { correct: false, power: 0.7, x: LANE[0] }), T(0.62, 'sfx', 'bounce', { near: 0, x: LANE[0] }), T(0.62 + 0.24, 'kit', 'calm1')],
  /** 랠리 여섯 번(세 번째·여섯 번째 스매시) — 계단이 오르는지 */
  rally: () => Array.from({ length: 6 }, (_, i) => [T(i * 0.9, 'sfx', 'hit', { correct: true, rally: i + 1, smash: (i + 1) % 3 === 0, power: 0.7, x: LANE[i % 3] }),
    T(i * 0.9 + 0.5, 'sfx', 'bounce', { near: 0, x: LANE[i % 3] })]).flat(),
  /** 가장 많이 겹치는 순간: 몽글 말 + 스매시 + 틱 + 몽글 기쁨 + 성취 — 리미터가 넘치지 않는지 */
  stress: () => [T(0, 'voice', 'r06'), T(0.1, 'sfx', 'hit', { correct: true, rally: 9, smash: true, power: 1, x: 0 }), T(0.12, 'sfx', 'bounce', { near: 1, x: 0 }),
    T(0.14, 'kit', 'joy2'), T(0.15, 'kit', 'achieve'), T(0.16, 'sfx', 'opponent', { power: 1, x: 0.3 })],
  stars: () => [T(0, 'kit', 'achieve'), ...[0, 1, 2].map((i) => T(0.3 + i * 0.22, 'sfx', 'star', { i }))],
  /** 결과 장면: 성취 → 별 셋 → 1.05초 뒤 결과 안내 음성(게임과 같은 간격) */
  results: () => [T(0, 'kit', 'achieve'), ...[0, 1, 2].map((i) => T(0.3 + i * 0.22, 'sfx', 'star', { i })), T(1.05, 'narr', 'result-3')],
  /** 안내와 몽글: 시작 안내가 끝나고 0.5초 뒤 몽글의 첫 말(게임과 같은 순서) — 두 목소리의 크기를 견준다 */
  introThenLine: () => [T(0, 'narr', 'intro'), T(3.79 + 0.5, 'voice', 'f01')],
};
/** 안내 음성 하나씩(시청 페이지 단추·qa/sound.cjs). */
for (const n of NARRATION_LINES) SEQ[`narr:${n.id}`] = () => [T(0, 'narr', n.id)];

async function loadInto(c, map, entries) {
  await Promise.all(entries.map(async ([k, url]) => { try { map.set(k, await c.decodeAudioData(await (await fetch(url)).arrayBuffer())); } catch { /* 없어도 계속 */ } }));
}
const VOICE_IDS = ['f01', 'r06'];
async function loadAll(c, kit) {
  await loadInto(c, kit, [...Object.entries(FILES), ...VOICE_IDS.map((id) => [`voice:${id}`, `assets/voice/${id}.mp3`]), ...NARRATION_LINES.map((n) => [`narr:${n.id}`, n.file])]);
}

function schedule(b, kit, events, t0) {
  for (const e of events) {
    const at = t0 + e.t;
    if (e.kind === 'sfx') VOICES[e.name](b, at, e.opts || {});
    else { const buf = kit.get(e.kind === 'voice' || e.kind === 'narr' ? `${e.kind}:${e.name}` : e.name); if (!buf) continue; const s = b.c.createBufferSource(); s.buffer = buf; s.connect(b.out); s.start(at); }
  }
}

let ctx = null, bus = null; const kit = new Map();
async function ready() {
  if (!ctx) { ctx = new (window.AudioContext || window.webkitAudioContext)(); bus = createBus(ctx); await loadAll(ctx, kit); }
  if (ctx.state === 'suspended') await ctx.resume();
}
export async function playSeq(events) { await ready(); schedule(bus, kit, events, ctx.currentTime + 0.05); }

/** 같은 소리를 파일처럼 굽는다(OfflineAudioContext). 반환: 16비트 스테레오 WAV의 base64. */
export async function render(events, seconds, { sampleRate = 44100, seed = 11 } = {}) {
  const off = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  const b = createBus(off, { seed }), k = new Map();
  await loadAll(off, k);
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

if (typeof document !== 'undefined') {
  for (const btn of document.querySelectorAll('[data-play]')) btn.addEventListener('click', () => { const seq = SEQ[btn.dataset.play]; if (seq) playSeq(seq()); });
  window.__lab = { render, SEQ };
}
