// 옷 가게 소리 (2026-11-05) — 웹 오디오로 그 자리에서 만든다(파일 없음, 받는 데 0).
// 고리가 봉을 스치는 쇳소리 · 나무 옷걸이 딸깍 · 봉 끝에 닿는 둔탁한 소리 · 천 스침 · 상자 닫힘 · 테이프.
// 처음 누르기 전에는 소리를 내지 않는다(브라우저 자동 재생 규칙). 효과음을 끄는 앱 설정은 앱에 넣을 때 잇는다.
export function createSound() {
  let ctx = null, master = null, noiseBuf = null, slideSrc = null, slideGain = null, slideBand = null;
  const off = new URLSearchParams(location.search).get('sound') === 'off';
  function unlock() {
    if (off) return;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
  }
  const ready = () => ctx && ctx.state === 'running';
  function env(g, t, a, peak, decay) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + decay); }
  function noise(t, dur, type, freq, q, peak, decay, a = 0.002) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); env(g, t, a, peak, decay);
    s.connect(f).connect(g).connect(master); s.start(t, Math.random() * 0.5, dur + 0.05);
  }
  function tone(t, freq, peak, decay, type = 'sine', to = 0) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + decay);
    const g = ctx.createGain(); env(g, t, 0.002, peak, decay);
    o.connect(g).connect(master); o.start(t); o.stop(t + decay + 0.05);
  }
  return {
    unlock,
    /** 고리가 봉 위 이음매를 지날 때 — 작은 쇳소리. 세기 0~1 */
    tick(v = 0.5) {
      if (!ready()) return; const t = ctx.currentTime, k = 0.25 + 0.75 * v, p = 1 + (Math.random() - 0.5) * 0.08;
      tone(t, 3180 * p, 0.05 * k, 0.07); tone(t, 4710 * p, 0.03 * k, 0.05); tone(t, 7020 * p, 0.012 * k, 0.03);
      noise(t, 0.02, 'highpass', 5000, 0.7, 0.05 * k, 0.015);
    },
    /** 끄는 동안 고리들이 봉을 미끄러지는 소리 — 빠를수록 크게 */
    slide(v) {
      if (!ready()) return;
      if (!slideSrc && v > 0.03) {
        slideSrc = ctx.createBufferSource(); slideSrc.buffer = noiseBuf; slideSrc.loop = true;
        slideBand = ctx.createBiquadFilter(); slideBand.type = 'bandpass'; slideBand.frequency.value = 3600; slideBand.Q.value = 3;
        slideGain = ctx.createGain(); slideGain.gain.value = 0;
        slideSrc.connect(slideBand).connect(slideGain).connect(master); slideSrc.start();
      }
      if (!slideSrc) return;
      const t = ctx.currentTime;
      slideGain.gain.setTargetAtTime(Math.min(0.05, v * 0.06), t, 0.05);
      slideBand.frequency.setTargetAtTime(2800 + v * 1800, t, 0.08);
      if (v <= 0.001) { const s = slideSrc; slideSrc = null; setTimeout(() => { try { s.stop(); } catch { /* 이미 멈춤 */ } }, 400); }
    },
    /** 마우스가 옷에 닿을 때 — 아주 옅은 스침 */
    brush() { if (!ready()) return; const t = ctx.currentTime; noise(t, 0.12, 'bandpass', 1800, 0.8, 0.018, 0.1, 0.02); tone(t, 3300, 0.012, 0.05); },
    /** 옷걸이를 집을 때 — 나무 딸깍 */
    pick() { if (!ready()) return; const t = ctx.currentTime; tone(t, 620, 0.16, 0.05, 'triangle', 340); noise(t, 0.03, 'bandpass', 2400, 1.5, 0.07, 0.025); tone(t + 0.012, 3900, 0.03, 0.06); },
    /** 옷걸이를 봉에 다시 걸 때 */
    drop() { if (!ready()) return; const t = ctx.currentTime; tone(t, 2900, 0.05, 0.12); tone(t, 4350, 0.025, 0.09); tone(t + 0.04, 3100, 0.02, 0.08); noise(t, 0.02, 'highpass', 4200, 0.7, 0.04, 0.02); },
    /** 봉 끝 — 둔탁한 쿵 + 짧은 울림 */
    bump() { if (!ready()) return; const t = ctx.currentTime; tone(t, 190, 0.18, 0.12, 'sine', 120); tone(t, 2200, 0.025, 0.25); noise(t, 0.04, 'lowpass', 900, 0.7, 0.08, 0.04); },
    /** 옷을 돌릴 때 — 천이 스치는 바람 */
    turn() {
      if (!ready()) return; const t = ctx.currentTime;
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.9;
      f.frequency.setValueAtTime(700, t); f.frequency.exponentialRampToValueAtTime(2600, t + 0.22);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.07); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      s.connect(f).connect(g).connect(master); s.start(t, Math.random() * 0.5, 0.4);
    },
    /** 입은 나 — 인화지가 떠오를 때: 종이 스침 + 아주 작은 맑은 소리 */
    print() { if (!ready()) return; const t = ctx.currentTime; noise(t, 0.28, 'bandpass', 3200, 0.6, 0.035, 0.24, 0.03); tone(t + 0.18, 1568, 0.035, 0.5); tone(t + 0.18, 2349, 0.018, 0.4); },
    /** 얇은 종이 — 바스락 */
    tissue() { if (!ready()) return; const t = ctx.currentTime; for (let i = 0; i < 6; i++) noise(t + i * 0.07 + Math.random() * 0.03, 0.06, 'highpass', 2600 + Math.random() * 2000, 0.6, 0.03 + Math.random() * 0.02, 0.05, 0.004); },
    /** 송장 스티커 — 톡 */
    label() { if (!ready()) return; const t = ctx.currentTime; noise(t, 0.04, 'bandpass', 1400, 1.2, 0.09, 0.035, 0.002); tone(t, 260, 0.05, 0.05, 'sine', 180); },
    /** 상자 뚜껑이 닫힐 때 */
    thump() { if (!ready()) return; const t = ctx.currentTime; noise(t, 0.12, 'lowpass', 420, 0.8, 0.22, 0.1, 0.004); tone(t, 110, 0.12, 0.1, 'sine', 70); },
    /** 테이프 — 찍찍 */
    tape() {
      if (!ready()) return; const t = ctx.currentTime;
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1400;
      const g = ctx.createGain(); g.gain.value = 0;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 34; const lg = ctx.createGain(); lg.gain.value = 0.05; lfo.connect(lg).connect(g.gain);
      const e = ctx.createGain(); env(e, t, 0.02, 1, 0.38);
      s.connect(f).connect(g).connect(e).connect(master); s.start(t, 0, 0.5); lfo.start(t); lfo.stop(t + 0.5);
    },
  };
}
