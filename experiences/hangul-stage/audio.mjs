// 소리. 2026-09-19 결정: 글자 소리는 정한 목소리 하나만, 귀로 확인한 파일만 쓴다. 10-03 목소리는 Typecast로 정했다(유호님).
// tools/한글단계_목소리.cjs가 pack.audioManifest() 목록대로 만든 파일은 assets/voice/에 있고, 유호님이 귀로 확인해
// voices.json이 approved:true가 되면 그 파일을 먼저 튼다(voices.json: { "approved": true, "clips": { "아": "….mp3", … } }).
// 그전과 목록에 없는 소리는 이 기기의 한국어 음성으로 낸다. 기기마다 음성이 달라 들리는 소리가 다를 수 있다.
// 효과음은 브랜드 사운드킷 그대로다. 실패음은 없다 — 틀려도 버저를 울리지 않는다.

const EFFECTS = { earn: 'assets/sound/earn.wav', achieve: 'assets/sound/achieve.wav', joy: 'assets/sound/mongle-miyu.wav', calm: 'assets/sound/mongle-mii.wav' };
const EFFECT_KEY = 'synk.hangul-stage.effects';
const read = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* 이번 접속에만 */ } };

let effectsOn = read(EFFECT_KEY, 'on') !== 'off';
let clips = null;           // 목소리가 정해진 뒤의 파일 목록(없으면 null)
// 여러 목소리로 듣고 고르기(HVPT, 10-09): 가·카·까 · 받침 ㄱ·ㄷ·ㅂ · ㅓ/ㅗ 음절은 목소리 여럿(talkers.json — 귀로 확인한 것만)을 돌려 쓴다.
// 근거: docs/한글단계_노래영상_근거점검_20261008.md §4-1(HVPT 메타분석 g=0.67, 목소리 수가 효과를 가름). 굽기 tools/한글단계_여러목소리.cjs.
let talkers = null;         // [{ name, clips: { "가": "talkers/jinhee/xz4.mp3", … } }] — 없으면 기본 목소리 하나
let voice = null;           // 기기의 한국어 음성
let voiceState = 'unknown'; // 'ready' | 'missing' | 'unsupported'
const listeners = new Set();
const emit = () => { for (const fn of listeners) { try { fn(voiceState); } catch { /* 화면 갱신 실패가 소리를 막지 않는다 */ } } };

function chooseVoice() {
  const synth = globalThis.speechSynthesis;
  if (!synth) { voiceState = 'unsupported'; emit(); return; }
  const list = synth.getVoices().filter(v => /^ko(-|_|$)/i.test(v.lang));
  // 기기 안에서 도는(로컬) 음성을 먼저: 네트워크가 끊겨도 소리가 난다.
  voice = list.sort((a, b) => (b.localService === true) - (a.localService === true) || (b.default === true) - (a.default === true))[0] || null;
  voiceState = voice ? 'ready' : 'missing';
  emit();
}
export function initAudio() {
  const synth = globalThis.speechSynthesis;
  if (synth) { chooseVoice(); synth.addEventListener?.('voiceschanged', chooseVoice); }
  else { voiceState = 'unsupported'; emit(); }
  fetch('assets/voice/voices.json').then(r => (r.ok ? r.json() : null))
    .then(v => { if (v?.approved === true && v.clips && Object.keys(v.clips).length) { clips = v.clips; emit(); } }).catch(() => {});
  fetch('assets/voice/talkers.json').then(r => (r.ok ? r.json() : null))
    .then(v => { if (v?.approved === true && Array.isArray(v.talkers) && v.talkers.length) talkers = v.talkers.map(t => ({ name: t.name, clips: t.clips || {} })); }).catch(() => {});
  // 음성 목록이 늦게 오는 브라우저: 잠시 뒤 한 번 더 본다.
  setTimeout(() => { if (voiceState !== 'ready') chooseVoice(); }, 1200);
}
export const onVoice = fn => { listeners.add(fn); fn(voiceState); return () => listeners.delete(fn); };
// 화면 점검용(?qa=silent): 소리 없이 흐름만 돈다. 소리를 내지 않았으니 기록에는 「전달 못 함」으로 남는다.
let silent = false;
export function setSilent(on) { silent = !!on; emit(); }
export const voiceReady = () => silent || voiceState === 'ready' || !!clips;
export const voiceStatus = () => (silent ? 'silent' : clips ? 'files' : voiceState);

let current = null;
export function stop() {
  try { globalThis.speechSynthesis?.cancel(); } catch { /* 없음 */ }
  if (current) { current.pause(); current = null; }
}
/** 이 소리를 가진 목소리 번호들: 0은 기본 글자 소리, 1부터는 talkers의 목소리(순수 함수 — 시험용으로도 쓴다). */
export function voicesFor(text, mainClips, talkerList) {
  return [mainClips?.[text] ? 0 : null, ...(talkerList || []).map((t, i) => (t.clips?.[text] ? i + 1 : null))].filter(v => v != null);
}
/** 여러 목소리 가운데 이 문항이 쓸 목소리 하나(key로 정해진다 — 같은 문항은 다시 들어도 같은 목소리). 목소리가 하나뿐이면 0. */
export function pickTalker(text, key, mainClips, talkerList) {
  const have = voicesFor(text, mainClips, talkerList);
  if (have.length < 2) return 0;
  let h = 0x811c9dc5;
  for (const ch of String(key)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return have[h % have.length];
}
export const talkerFor = (text, key) => pickTalker(text, key, clips, talkers);
export const talkerCount = text => voicesFor(text, clips, talkers).length;
/** 글자·음절·낱말 하나를 말한다. 끝까지 났으면 true, 못 냈으면 false로 끝난다. slow는 천천히 다시 듣기, talker는 여러 목소리 가운데 번호(0 기본). */
export function say(text, { slow = false, talker = 0 } = {}) {
  stop();
  if (silent) return wait(150).then(() => false);
  const file = (talker > 0 ? talkers?.[talker - 1]?.clips?.[text] : null) || clips?.[text];
  if (file) {
    return new Promise(resolve => {
      const a = new Audio(`assets/voice/${file}`); a.playbackRate = slow ? 0.75 : 1; current = a;
      a.onended = () => resolve(true); a.onerror = () => resolve(false);
      a.play().catch(() => resolve(false));
    });
  }
  const synth = globalThis.speechSynthesis;
  if (!synth || !voice) return Promise.resolve(false);
  return new Promise(resolve => setTimeout(() => {
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice; u.lang = voice.lang; u.rate = slow ? 0.55 : 0.8; u.pitch = 1;
    let done = false;
    const finish = ok => { if (!done) { done = true; resolve(ok); } };
    u.onend = () => finish(true); u.onerror = () => finish(false);
    // 끝 알림을 주지 않는 음성도 있어 글자 수에 맞춘 넉넉한 시간 뒤에는 끝난 것으로 본다.
    setTimeout(() => finish(true), 1600 + text.length * 700 * (slow ? 1.6 : 1));
    synth.speak(u);
  }, 60)); // 막 멈춘 직후에 말하면 첫 소리를 삼키는 브라우저가 있다
}
// 기기 음성은 처음 한 번 깨는 데 2초쯤 걸린다(10-03 Heami 실측: 첫 소리 2.1초 뒤 시작, 그다음은 0.03~0.13초).
// 「시작」을 누를 때 소리 없이 한 번 말해 두면, 이유 한 줄을 보는 동안 깨어난다.
let warmed = false;
export function warm() {
  const synth = globalThis.speechSynthesis;
  if (warmed || silent || clips || !synth || !voice) return;
  warmed = true;
  try { const u = new SpeechSynthesisUtterance('아'); u.voice = voice; u.lang = voice.lang; u.volume = 0; synth.speak(u); } catch { warmed = false; }
}
/** 소리를 두 번(만나기 카드). */
export async function sayTwice(text) { const a = await say(text); await wait(350); const b = await say(text); return a && b; }
export const wait = ms => new Promise(r => setTimeout(r, ms));

const cache = new Map();
export function effect(name) {
  if (!effectsOn || !EFFECTS[name]) return;
  try {
    let a = cache.get(name);
    if (!a) { a = new Audio(EFFECTS[name]); a.volume = 0.55; cache.set(name, a); }
    a.currentTime = 0; a.play().catch(() => {});
  } catch { /* 효과음은 없어도 된다 */ }
}
export const effectsEnabled = () => effectsOn;
export function setEffects(on) { effectsOn = !!on; write(EFFECT_KEY, on ? 'on' : 'off'); }
