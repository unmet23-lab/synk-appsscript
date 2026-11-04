// 게시판 해독 — 효과음 · 복도 소리(설계 8절). 파일 없이 Web Audio로 만든다. 규칙은 찰칵 낱말 · 주문 폭주와 같다:
//   ① 한 소리는 400ms 이하  ② 실패음이 없다 — 틀림은 장면의 생활음 하나, 내려가는 음이 없다
//   ③ 음이 있는 층은 사인 · 트라이앵글  ④ 음높이는 C 펜타토닉, 몸통은 C4 이상  ⑤ 잡음 층은 짧게. sfx.test.mjs가 시험한다.
export const N = { C4: 261.63, D4: 293.66, E4: 329.63, G4: 392, A4: 440, C5: 523.25, D5: 587.33, E5: 659.26, G5: 783.99, A5: 880, C6: 1046.5, D6: 1174.66, E6: 1318.51 };
const tone = (f, opts = {}) => ({ f, t: 0, d: 0.16, v: 0.14, type: 'sine', ...opts });
const noise = (lo, hi, opts = {}) => ({ noise: [lo, hi], t: 0, d: 0.1, v: 0.12, q: 0.8, ...opts });

export const SOUNDS = Object.freeze({
  tear: [noise(1400, 6000, { d: 0.22, v: 0.22, q: 0.6 }), noise(3000, 7000, { t: 0.05, d: 0.11, v: 0.1, q: 2 })],
  paper: [noise(1800, 3200, { d: 0.09, v: 0.1, q: 0.7 })],
  tap: [noise(900, 1800, { d: 0.04, v: 0.08, q: 1.2 })],
  message: [tone(N.C6, { d: 0.2, v: 0.1 }), tone(N.E6, { t: 0.09, d: 0.27, v: 0.09 })],
  pencil: [0, 0.05, 0.1, 0.15].map((t) => noise(3500, 5200, { t, d: 0.04, v: 0.05, q: 3 })),
  scene: [noise(300, 700, { d: 0.3, v: 0.05, q: 0.5 }), tone(N.G4, { t: 0.02, d: 0.3, v: 0.05 })],
  tape: [noise(900, 3800, { d: 0.13, v: 0.22, q: 0.7 }), noise(180, 260, { t: 0.13, d: 0.05, v: 0.3, q: 0.9 }), tone(N.C4, { t: 0.13, d: 0.09, v: 0.1, type: 'triangle' })],
  stamp: [noise(240, 420, { d: 0.05, v: 0.2, q: 0.9 }), tone(N.E4, { d: 0.08, v: 0.08, type: 'triangle' })],
  open: [tone(N.E5, { d: 0.16, v: 0.08 }), tone(N.G5, { t: 0.06, d: 0.2, v: 0.08 })],
});
// 맞음: 연속일수록 한 칸 위, 5단계 천장. 두 음은 펜타토닉 안에서 오른다.
export const RIGHT = Object.freeze([[N.C5, N.G5], [N.D5, N.A5], [N.E5, N.A5], [N.G5, N.C6], [N.A5, N.E6]]);
export const rightSound = (n) => { const [a, b] = RIGHT[Math.min(Math.max(n, 0), RIGHT.length - 1)]; return [tone(a, { d: 0.16, v: 0.14, type: 'triangle' }), tone(b, { t: 0.07, d: 0.22, v: 0.1, type: 'triangle' }), noise(500, 900, { d: 0.05, v: 0.06, q: 1 })]; };

/** 한 소리를 그 자리에서 그린다. */
function render(c, out, layers) {
  const at = c.currentTime;
  for (const l of layers) {
    const start = at + (l.t || 0), g = c.createGain();
    g.gain.setValueAtTime(0.0001, start); g.gain.linearRampToValueAtTime(l.v, start + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, start + l.d);
    g.connect(out);
    if (l.noise) {
      const n = Math.max(1, Math.floor(c.sampleRate * l.d)), buf = c.createBuffer(1, n, c.sampleRate), data = buf.getChannelData(0);
      for (let i = 0; i < n; i += 1) data[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource(); src.buffer = buf;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = l.q; f.frequency.setValueAtTime(l.noise[0], start); f.frequency.exponentialRampToValueAtTime(l.noise[1], start + l.d);
      src.connect(f); f.connect(g); src.start(start);
    } else {
      const o = c.createOscillator(); o.type = l.type; o.frequency.value = l.f; o.connect(g); o.start(start); o.stop(start + l.d + 0.02);
    }
  }
}

/** 소리 묶음. canPlay()가 거짓이면(앱 소리 끔 · 내 소리 끔) 아무것도 안 낸다. */
export function createSound({ canPlay }) {
  let c = null, out = null, room = null, roomGain = null;
  const ready = () => {
    if (!c) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false; c = new AC(); out = c.createDynamicsCompressor(); out.connect(c.destination); try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* 없는 브라우저 */ } }
    if (c.state === 'suspended') c.resume().catch(() => {});
    return true;
  };
  const level = () => (canPlay() ? 0.09 : 0);
  return {
    wake: ready,
    play(name) { if (canPlay() && ready() && SOUNDS[name]) render(c, out, SOUNDS[name]); },
    right(n) { if (canPlay() && ready()) render(c, out, rightSound(n)); },
    /** 복도 소리: 낮은 잡음 하나(읽기를 방해하지 않게). 곡은 싣지 않는다. */
    room() {
      if (!ready() || room) return;
      const n = c.sampleRate * 4, buf = c.createBuffer(1, n, c.sampleRate), data = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < n; i += 1) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; data[i] = last * 3.5; }
      room = c.createBufferSource(); room.buffer = buf; room.loop = true;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
      roomGain = c.createGain(); roomGain.gain.value = 0;
      room.connect(f); f.connect(roomGain); roomGain.connect(c.destination); room.start();
      roomGain.gain.linearRampToValueAtTime(level(), c.currentTime + 1.2);
    },
    refresh() { if (roomGain && c) roomGain.gain.linearRampToValueAtTime(level(), c.currentTime + 0.25); },
    pause() { if (c && c.state === 'running') c.suspend().catch(() => {}); },
    resume() { if (c && c.state === 'suspended') c.resume().catch(() => {}); },
  };
}
