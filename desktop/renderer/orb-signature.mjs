// 점으로 된 synk 표. 구 안으로 들어온 순간, 줄마다 어긋나 있던 점이 제자리에 맞춰졌다가 물러난다.
// 시안 docs/디자인/플랫폼_클라이언트_검정구_20261116/검정구.html의 sig를 그대로 옮겼다. 글자 모양은 desktop/assets/launcher/synk.svg의 워드마크다.

const GLYPHS = ['M35.8 57.9 25.9 58.5Q25.5 56.6 23.8 55.3Q22.1 53.9 19.3 53.9Q16.7 53.9 15.0 55.0Q13.3 56.0 13.3 57.8Q13.3 59.2 14.4 60.2Q15.5 61.2 18.2 61.8L25.4 63.2Q31.1 64.3 33.9 66.9Q36.7 69.5 36.7 73.8Q36.7 77.7 34.5 80.6Q32.2 83.5 28.3 85.1Q24.4 86.8 19.3 86.8Q11.5 86.8 6.8 83.5Q2.2 80.2 1.4 74.6L12.1 74.1Q12.6 76.5 14.5 77.7Q16.3 78.9 19.3 78.9Q22.1 78.9 23.9 77.8Q25.7 76.7 25.7 75.0Q25.7 72.0 20.6 71.0L13.8 69.6Q8.1 68.5 5.3 65.6Q2.5 62.8 2.5 58.4Q2.5 54.6 4.5 51.9Q6.6 49.2 10.4 47.7Q14.1 46.2 19.1 46.2Q26.6 46.2 30.8 49.3Q35.1 52.5 35.8 57.9Z M44.0 100.7Q41.9 100.7 40.1 100.4Q38.3 100.1 37.1 99.6L39.6 91.5L39.9 91.6Q42.7 92.4 44.6 91.9Q46.6 91.5 47.6 88.8L48.2 87.1L34.1 46.7H45.6L53.7 75.6H54.1L62.3 46.7H73.8L58.6 90.3Q57.5 93.4 55.6 95.8Q53.7 98.1 50.9 99.4Q48.0 100.7 44.0 100.7Z M84.0 63.3V86.0H73.1V46.7H83.8V53.7H84.2Q85.5 50.2 88.4 48.2Q91.4 46.2 95.7 46.2Q99.8 46.2 102.9 48.0Q105.9 49.8 107.6 53.1Q109.3 56.4 109.3 61.0V86.0H98.4V62.9Q98.4 59.4 96.6 57.3Q94.7 55.2 91.4 55.2Q89.2 55.2 87.6 56.2Q85.9 57.2 84.9 59.0Q84.0 60.8 84.0 63.3Z', 'M117.3046875 86.0V33.6171875H126.55078125V62.48046875H127.21875L141.31640625 46.6953125H152.14453125L136.91339111328125 63.68389129638672L153.0234375 86.0H141.94921875L129.9180908203125 69.20931243896484L126.55078125 72.82667541503906V86.0Z'];
/* 글자 넷(s · y · n · k)을 따로 뜬다: [그림, 왼쪽 끝, 오른쪽 끝, 뒤에 비울 칸 수]. 글자마다 왼쪽 끝을 칸에 맞추고 사이를 한두 칸으로 고르게 둔다 */
const LETTERS = [...GLYPHS[0].split(/(?=M)/).map(d => d.trim()).filter(Boolean), GLYPHS[1]].map((d, i) => [d, [1.4, 34.1, 73.1, 117.3][i], [36.7, 73.8, 109.3, 153.03][i], [1, 1, 2, 0][i]]);
const BASE = 86, XH = 39.3, ASC = 52.4, DESC = 14.7, FADE = 320, STEP = 66;
const rnd = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* 길이 둘: 처음 로그인해 들어올 때(맞춰짐 460ms · 머묾 400ms)와, 다시 켤 때 · 공간을 옮길 때의 짧은 판(320ms · 240ms) */
export const SIGNATURE_TIMING = Object.freeze({ full: Object.freeze({ tune: 460, hold: 400 }), quick: Object.freeze({ tune: 320, hold: 240 }), reduced: Object.freeze({ tune: 0, hold: 260 }) });

export function createOrbSignature(canvas, { getReducedMotion = () => false, getWidth = () => 1440 } = {}) {
  const c = canvas.getContext('2d'), win = canvas.ownerDocument?.defaultView || globalThis;
  const now = () => (win.performance?.now ? win.performance.now() : Date.now());
  let dots = [], pitch = 5, dotR = 1.8, gx = 0, gy = 0, gc = 56, gr = 25, cw = 0, ch = 0, key = '', phase = 'off', t0 = 0, tuneMs = 460, holdMs = 400, done = null, timer = 0, seed = 1, frameId = null;
  /* 글자 모양을 전광판처럼 고른 간격, 같은 크기의 점으로 뜬다. 칸의 절반 넘게 글자에 든 칸만 켠다 */
  function build() {
    if (!c) return;
    const want = clamp(getWidth() * 0.21, 184, 330), dpr = Math.min(win.devicePixelRatio || 1, 3), id = Math.round(want) + '/' + dpr;
    if (id === key) return; key = id;
    const unit = XH / (want < 230 ? 11 : 14), up = Math.ceil(ASC / unit - 0.2), rows = up + Math.ceil(DESC / unit - 0.2);
    const spans = LETTERS.map(l => Math.ceil((l[2] - l[1]) / unit - 0.15)), cols = spans.reduce((a, b) => a + b, 0) + LETTERS.reduce((a, l) => a + l[3], 0);
    pitch = want / cols; dotR = pitch * 0.37; cw = Math.ceil(want + pitch * 16); ch = Math.ceil((rows + 10) * pitch);
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr); canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    const at = [1 / 6, 0.5, 5 / 6], cells = [];
    c.setTransform(1, 0, 0, 1, 0, 0);
    let col0 = 0;
    LETTERS.forEach(([d, x0, , gap], li) => {
      const p = new win.Path2D(d);
      for (let row = 0; row < rows; row++) for (let col = 0; col < spans[li]; col++) {
        let n = 0;
        for (const sy of at) for (const sx of at) if (c.isPointInPath(p, x0 + (col + sx) * unit, BASE + (row - up + sy) * unit)) n++;
        if (n >= 5) cells.push([col0 + col, row]);
      }
      col0 += spans[li] + gap;
    });
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const top = Math.min(...cells.map(q => q[1]));
    const bot = Math.max(...cells.map(q => q[1]));
    gx = (cw - cols * pitch) / 2; gy = (ch - (bot - top + 1) * pitch) / 2 - top * pitch; gc = cols; gr = rows;
    dots = cells.sort((a, b) => a[1] - b[1] || a[0] - b[0]).map(([col, row], i) => ({ x: gx + (col + 0.5) * pitch, y: gy + (row + 0.5) * pitch, row, i }));
  }
  /* 시작한 지 ms 지난 때의 모습. 맞춰지는 동안에는 몇 줄씩 묶여 옆으로 밀리고, 점이 듬성듬성 빠지고, 낟알이 떠돈다 */
  function paint(ms, alpha) {
    if (!c) return;
    c.clearRect(0, 0, cw, ch);
    const tune = tuneMs ? clamp(ms / tuneMs, 0, 1) : 1, on = tune >= 1, no = Math.floor(ms / STEP) + seed;
    const amp = on ? 0 : 6 * Math.pow(1 - tune, 1.7), keep = on ? 1 : 0.38 + 0.62 * tune * tune, band = 2 + Math.floor(rnd(no, 5.3) * 3);
    const a = (on ? 1 : 0.55 + 0.4 * tune) * alpha;
    c.fillStyle = '#F3F1EC'; c.globalAlpha = a; c.beginPath();
    for (const d of dots) {
      if (!on && rnd(d.i * 0.731, no) > keep) continue;
      const g = Math.floor(d.row / band), dx = on ? 0 : Math.round((rnd(g * 3.1, no * 7.3) - 0.5) * 2 * amp * (rnd(g, no * 1.9) > 0.35 ? 1 : 0.15)) * pitch;
      c.moveTo(d.x + dx + dotR, d.y); c.arc(d.x + dx, d.y, dotR, 0, 6.2832);
    }
    c.fill();
    if (!on) {
      c.globalAlpha = a * 0.5; c.beginPath();
      for (let i = 0, n = Math.round(36 * (1 - tune)); i < n; i++) {
        const x = gx + (Math.floor(rnd(i, no * 3.3) * (gc + 14)) - 7 + 0.5) * pitch, y = gy + (Math.floor(rnd(i * 1.7, no * 5.1) * (gr + 6)) - 3 + 0.5) * pitch;
        c.moveTo(x + dotR, y); c.arc(x, y, dotR, 0, 6.2832);
      }
      c.fill();
    }
    c.globalAlpha = 1;
  }
  function finish() { clearTimeout(timer); if (done) { const d = done; done = null; d(); } }
  function step() {
    frameId = null;
    const t = now();
    if (phase === 'in') { paint(t - t0, 1); if (t - t0 >= tuneMs + holdMs) finish(); }
    else if (phase === 'out') { const q = clamp((t - t0) / FADE, 0, 1); paint(tuneMs + holdMs, 1 - q); if (q >= 1) { phase = 'off'; c?.clearRect(0, 0, cw, ch); } }
    if (phase !== 'off' && typeof win.requestAnimationFrame === 'function') frameId = win.requestAnimationFrame(step);
  }
  function loop() { if (frameId === null && typeof win.requestAnimationFrame === 'function') frameId = win.requestAnimationFrame(step); }
  return {
    /* 맞춰지고 잠깐 머문 뒤에 끝난다. kind는 full · quick */
    play(kind = 'full') {
      // 앞의 재생이 끝나기 전에 다시 부르면 앞의 타이머와 약속을 먼저 끝낸다(검수 B5)
      finish();
      build(); seed = (seed * 7 + 3) % 97;
      const timing = getReducedMotion() ? SIGNATURE_TIMING.reduced : SIGNATURE_TIMING[kind] || SIGNATURE_TIMING.full;
      tuneMs = timing.tune; holdMs = timing.hold; t0 = now(); phase = 'in'; loop();
      return new Promise(res => { done = res; timer = setTimeout(finish, tuneMs + holdMs + 120); });
    },
    fade() { if (phase === 'in') { phase = 'out'; t0 = now(); loop(); } },
    stop() { phase = 'off'; if (cw) c?.clearRect(0, 0, cw, ch); finish(); },
    /* 화면 확인용: 그 순간의 모습으로 선다. ms를 안 주면 지운다 */
    show(ms) { phase = 'off'; finish(); key = ''; build(); tuneMs = 460; if (ms === undefined || ms === null) c?.clearRect(0, 0, cw, ch); else paint(ms, 1); return dots.length; },
    get active() { return phase !== 'off'; },
  };
}
