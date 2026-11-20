// SYNK 플랫폼 PC 클라이언트 · 검정 구 지도의 효과음(2026-11-20 유호님 「효과음도 그 아이폰 타이핑소리같은걸로 넣어줘도 좋고 … 더 어울리는 효과음 있으면 넣어줘」).
// 시안 docs/디자인/플랫폼_클라이언트_검정구_20261116/검정구.html의 snd.map · unmap · key를 옮겼다. 소리 파일 없이 그 자리에서 만든다.
// 소리를 낼 수 없는 환경(AudioContext가 없거나 만들다 실패)에서는 아무 일도 하지 않는다. 화면의 움직임은 소리에 매이지 않는다.

/* 지도가 켜질 때의 악보(셈만 한다. Node 시험에 쓴다). small은 구 곁의 작은 지도다.
   tocks는 눈의 점이 흩어지는 동안의 톡 소리, notes는 별 셋이 자리를 잡을 때의 맑은 음 셋(라 · 도# · 미)이다. rand는 0 이상 1 미만의 수를 낸다 */
export function mapScore(small, rand = Math.random) {
  const n = small ? 4 : 7, span = small ? 0.2 : 0.36, gain = small ? 0.045 : 0.065, t0 = small ? 0.24 : 0.44, step = small ? 0.07 : 0.1;
  const tocks = Array.from({ length: n }, (_, i) => ({ at: 0.03 + span * i / n + rand() * 0.02, gain: gain * (0.6 + 0.4 * rand()), freq: 1700 + rand() * 900 }));
  const notes = [880, 1108.73, 1318.51].map((freq, i) => ({ at: t0 + i * step, freq, gain: small ? 0.011 : 0.019, ring: small ? 0.5 : 0.8, over: small ? 0.003 : 0.005 }));
  return { tocks, notes };
}
/* 지도가 꺼질 때: 점이 눈으로 돌아오는 톡 소리 셋(조금씩 낮아지고 작아진다) */
export function unmapScore() {
  return [0, 1, 2].map(i => ({ at: 0.02 + i * 0.055, gain: 0.05 - i * 0.008, freq: 2300 - i * 350 }));
}

/* options: win(AudioContext를 가진 창) · enabled() → 소리를 낼지 */
export function createOrbSound({ win = globalThis, enabled = () => true } = {}) {
  /* turn은 지도가 켜지거나 접힐 때마다 오르는 차례 번호다. 뒤늦게 낼 소리가 그 사이에 지나간 지도의 것인지 가린다 */
  let ac = null, out = null, bus = null, dead = false, waking = null, turn = 0;
  const allowed = () => { try { return enabled() === true; } catch { return false; } };
  /* 소리를 낼 수 있는 때에만 맥락을 돌려준다. 맥락이 멈춰 있으면(창을 한 번도 누르지 않아 브라우저가 소리를 막은 때) 깨우기만 하고 이번 소리는 내지 않는다.
     멈춘 맥락에 예약하면 시계가 서 있어 소리가 쌓였다가, 처음 누르는 순간 한꺼번에 난다(카본 검수 A1) */
  function ctx() {
    if (dead) return null;
    if (!allowed()) return null;
    try {
      if (!ac) {
        const C = win.AudioContext || win.webkitAudioContext;
        if (!C) { dead = true; return null; }
        ac = new C(); out = ac.createGain(); out.gain.value = 0.5; out.connect(ac.destination);
      }
      if (ac.state !== 'running') { waking = ac.resume?.() || null; void waking?.catch?.(() => {}); return null; }
      return ac;
    } catch { dead = true; ac = null; return null; }
  }
  /* 지도의 소리는 한 묶음(bus)으로 낸다. 지도가 접히거나 다시 켜지면 앞 묶음에 남은 소리를 바로 거둔다.
     잠깐 스친 구의 맑은 음 셋이 접힌 뒤까지 울리거나 다음 소리와 겹치지 않는다(카본 검수 A2) */
  function hush() {
    turn++;
    const old = bus; bus = null;
    if (!old || !ac) return;
    try { old.gain.setTargetAtTime(0, ac.currentTime, 0.012); } catch { /* 무시 */ }
  }
  /* 맑은 음 하나: 빠르게 올랐다가 길게 가라앉는다. f2를 주면 그 음으로 미끄러진다 */
  function tone(c, to, f, delay, attack, release, gain, f2) {
    const at = c.currentTime + delay, o = c.createOscillator(), v = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f, at); if (f2) o.frequency.exponentialRampToValueAtTime(f2, at + attack + release);
    v.gain.setValueAtTime(0.0001, at); v.gain.exponentialRampToValueAtTime(gain, at + attack); v.gain.exponentialRampToValueAtTime(0.0001, at + attack + release);
    o.connect(v); v.connect(to); o.start(at); o.stop(at + attack + release + 0.05);
  }
  /* 자판을 치는 듯한 짧은 톡 소리. 아주 짧은 바람 소리를 좁은 대역으로 거르고, 낮게 떨어지는 음 하나를 몸통으로 받친다 */
  function tock(c, to, delay, gain, freq) {
    const at = c.currentTime + delay, n = Math.floor(c.sampleRate * 0.034), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
    const src = c.createBufferSource(), bp = c.createBiquadFilter(), v = c.createGain();
    src.buffer = buf; bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 1.4; v.gain.value = gain;
    src.connect(bp); bp.connect(v); v.connect(to); src.start(at);
    tone(c, to, freq * 0.09, delay, 0.001, 0.03, gain * 0.45, freq * 0.05);
  }
  /* 방금 만든 맥락은 곧 깨어날 수 있다. 0.4초 안에 깨어나면 그 소리 하나만 뒤늦게 낸다(앱을 켠 뒤의 첫 소리가 빠지지 않게, Fable 최종 검수 F4).
     전부터 있던 맥락이 멈춰 있으면 내지 않고 쌓지도 않는다(카본 검수 A1).
     기다리는 사이에 지도가 접히거나 다시 켜졌으면(turn이 달라졌으면), 또는 그사이 소리를 내면 안 되게 됐으면 내지 않는다.
     접힌 지도의 켜지는 소리가 뒤늦게 울리지 않는다(다시 검수 FA1) */
  const play = fn => {
    const made = !ac, c = ctx();
    if (c) { try { fn(c); return true; } catch { return false; } }
    if (made && ac && typeof waking?.then === 'function') {
      const a = ac, t0 = Date.now(), mine = turn;
      void waking.then(() => { if (!dead && a === ac && mine === turn && a.state === 'running' && Date.now() - t0 < 400 && allowed()) { try { fn(a); } catch { /* 무시 */ } } }).catch(() => {});
    }
    return false;
  };
  return {
    /* 지도가 켜질 때 */
    map(small = false) {
      hush();
      return play(c => {
        const to = c.createGain(); to.connect(out); bus = to;
        const s = mapScore(small);
        for (const t of s.tocks) tock(c, to, t.at, t.gain, t.freq);
        for (const n of s.notes) { tone(c, to, n.freq, n.at, 0.005, n.ring, n.gain); tone(c, to, n.freq * 2, n.at, 0.004, 0.3, n.over); }
      });
    },
    /* 지도가 꺼질 때 */
    unmap() { hush(); return play(c => { for (const t of unmapScore()) tock(c, out, t.at, t.gain, t.freq); }); },
    /* 이름이나 별을 가리킬 때: 톡 한 번 */
    key() { return play(c => tock(c, out, 0, 0.055, 2100)); },
    dispose() { dead = true; bus = null; try { void ac?.close?.()?.catch?.(() => {}); } catch { /* 무시 */ } ac = null; out = null; },
  };
}
