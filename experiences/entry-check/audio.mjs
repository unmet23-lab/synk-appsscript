// 소리: 브랜드 사운드킷(획득·성취·알림)과 몽글 목소리를 그대로 쓴다. 규칙 ② 실패음 없음 — 틀려도 버저를 울리지 않는다.
// 도장 '톡'은 사운드킷에 아직 없는 새 소리라 사인파로 만든 후보다(400ms 이하·사인만). 시청 확정 전이다.
// 목소리(손님 대사·안내 나레이션)는 미리 구운 파일(assets/voice)만 튼다. 접속 중에 음성 합성을 부르지 않는다.
const FILES = {
  earn: 'assets/sound/earn.wav', achieve: 'assets/sound/achieve.wav', notify: 'assets/sound/notify.wav',
  joy1: 'assets/sound/mongle-miyu.wav', joy2: 'assets/sound/mongle-myang.wav',
  calm1: 'assets/sound/mongle-mii.wav', calm2: 'assets/sound/mongle-miyuu.wav',
  done: 'assets/sound/mongle-moong.wav', tap: 'assets/sound/mongle-mu.wav', ask: 'assets/sound/mongle-ppong.wav',
};
const KEY = 'synk.entry-check.sound';
const VOICE_KEY = 'synk.entry-check.voice';
let ctx = null, master = null, voiceBus = null;
const buffers = new Map();
const read = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* 저장 불가: 이번 접속에만 적용 */ } };
let enabled = read(KEY, 'on') !== 'off';
let voiceEnabled = read(VOICE_KEY, 'on') !== 'off';

export const isOn = () => enabled;
export function setOn(value) {
  enabled = !!value; write(KEY, enabled ? 'on' : 'off');
  if (master) master.gain.value = enabled ? 0.9 : 0;
  if (!enabled) stopVoice();
}
export const isVoiceOn = () => voiceEnabled;
export function setVoiceOn(value) {
  voiceEnabled = !!value; write(VOICE_KEY, voiceEnabled ? 'on' : 'off');
  if (!voiceEnabled) stopVoice();
}

/** 사용자 조작 뒤에만 호출한다(브라우저 자동 재생 정책). */
export async function unlock() {
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = enabled ? 0.9 : 0; master.connect(ctx.destination);
      voiceBus = ctx.createGain(); voiceBus.gain.value = 1; voiceBus.connect(master);
      await Promise.all(Object.entries(FILES).map(async ([k, url]) => {
        try { const res = await fetch(url); buffers.set(k, await ctx.decodeAudioData(await res.arrayBuffer())); } catch { /* 소리 하나가 없어도 게임은 계속 */ }
      }));
    }
    if (ctx.state === 'suspended') await ctx.resume();
  } catch { ctx = null; }
}

export function play(name, volume = 1) {
  if (!ctx || !enabled) return;
  const buf = buffers.get(name);
  if (!buf) return;
  const src = ctx.createBufferSource(); const g = ctx.createGain();
  g.gain.value = volume; src.buffer = buf; src.connect(g).connect(master); src.start();
}

/** 도장: 낮은 사인 두 개가 짧게 눌린다(펠트를 누르는 둔한 '톡'). */
export function stamp() {
  if (!ctx || !enabled) return;
  const t = ctx.currentTime;
  for (const [f0, f1, v, d] of [[196, 65.4, .55, .16], [392, 131, .16, .09]]) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0008, t + d + 0.08);
    o.connect(g).connect(master); o.start(t); o.stop(t + d + 0.1);
  }
}

export const pick = (a, b) => (Math.random() < 0.5 ? a : b);

/* ── 목소리 ── */
let catalog = null;                 // voices.json의 줄 목록(없으면 목소리 없이 진행)
const voiceBuffers = new Map();     // id → Promise<AudioBuffer|null>
let current = null;                 // 지금 말하는 소리
let speakToken = 0;                 // 새 말이 시작되면 이전 말 차례(queue)를 끊는다
let onSpeak = null;                 // (id|null) 화면의 말하는 표시

export async function loadCatalog() {
  try { const res = await fetch('assets/voice/voices.json', { cache: 'no-cache' }); catalog = res.ok ? (await res.json()).lines || {} : {}; } catch { catalog = {}; }
  return catalog;
}
export const hasVoice = (id) => !!catalog?.[id];
export const onSpeaking = (fn) => { onSpeak = fn; };

function loadVoice(id) {
  if (!hasVoice(id) || !ctx) return Promise.resolve(null);
  if (!voiceBuffers.has(id)) {
    voiceBuffers.set(id, fetch(`assets/voice/${id}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : null))
      .then((ab) => (ab ? ctx.decodeAudioData(ab) : null)).catch(() => null));
  }
  return voiceBuffers.get(id);
}
/** 이번 근무에 쓸 목소리를 미리 받아 둔다(한 번에 여섯 개씩). 앞 근무의 목소리는 놓아 준다(풀어 둔 소리는 한 줄에 수백 KB라 쌓이면 휴대폰에 무겁다). */
export async function preloadVoices(ids) {
  const keep = new Set(ids);
  for (const id of [...voiceBuffers.keys()]) if (!keep.has(id)) voiceBuffers.delete(id);
  const list = [...keep].filter(hasVoice);
  for (let i = 0; i < list.length; i += 6) await Promise.all(list.slice(i, i + 6).map(loadVoice));
}

export function stopVoice() {
  speakToken += 1;
  if (current) { try { current.stop(); } catch { /* 이미 끝남 */ } current = null; }
  onSpeak?.(null);
}

/** 한 줄 말하기. 끝나면(또는 못 틀면 바로) 풀린다. 다른 말이 시작되면 false로 풀린다. */
export async function say(id, { token = null } = {}) {
  const mine = token ?? ++speakToken;
  if (!voiceEnabled || !enabled || !ctx || !hasVoice(id)) return true;
  if (current) { try { current.stop(); } catch { /* 이미 끝남 */ } current = null; }
  const buf = await loadVoice(id);
  if (!buf || mine !== speakToken) return mine === speakToken;
  const src = ctx.createBufferSource(); src.buffer = buf; src.connect(voiceBus);
  current = src; onSpeak?.(id);
  return new Promise((resolve) => {
    src.onended = () => { if (current === src) { current = null; onSpeak?.(null); } resolve(mine === speakToken); };
    src.start();
  });
}
/** 여러 줄을 차례로. 중간에 다른 말이 시작되면 멈춘다. gap: 줄 사이 쉼(ms). */
export async function sayAll(ids, gap = 260) {
  const mine = ++speakToken;
  for (let i = 0; i < ids.length; i++) {
    if (i > 0) { await new Promise((r) => setTimeout(r, gap)); if (mine !== speakToken) return false; }
    const ok = await say(ids[i], { token: mine });
    if (!ok || mine !== speakToken) return false;
  }
  return true;
}
