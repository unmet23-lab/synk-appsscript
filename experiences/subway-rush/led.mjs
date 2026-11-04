// LED 전광판(설계 5절): 비트맵 글꼴을 점으로 찍어 앰버 불빛으로 그린다. 점 간격은 고정, 꺼진 점도 희미하게 보인다.
// 왼쪽 큰 시각 · 가운데 상태 말 · 오른쪽 목소리에 따라 뛰는 도트 파형. 잠깐 흐르는 말(「빠른 환승!」)은 상태 자리를 차지한다.
// 정지한 칸은 밑판에 구워 두고 파형 · 흐르는 말만 그려서 휴대폰에서도 가볍다. 학습자가 읽어야 하는 글은 여기 쓰지 않는다(설계 5절 「읽기 쉬움이 먼저」).
const FONT_PX = 16;
const COLOR = Object.freeze({ amber: [255, 176, 40], green: [70, 226, 138], red: [255, 74, 58], white: [255, 240, 214] });

function dotSprite(rgb, size) {
  const c = document.createElement('canvas'); c.width = c.height = size * 3;
  const x = c.getContext('2d'), m = size * 1.5;
  const g = x.createRadialGradient(m, m, 0, m, m, m);
  g.addColorStop(0, `rgba(${rgb.join(',')},1)`); g.addColorStop(0.2, `rgba(${rgb.join(',')},.95)`); g.addColorStop(0.27, `rgba(${rgb.join(',')},.22)`); g.addColorStop(0.6, `rgba(${rgb.join(',')},.05)`); g.addColorStop(1, `rgba(${rgb.join(',')},0)`);
  x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = 'rgba(255,255,255,.5)'; x.beginPath(); x.arc(m, m, size * 0.16, 0, Math.PI * 2); x.fill();
  return c;
}

export function createLed(canvas, { font = 'SubwayLED', rows: ROWS = 20 } = {}) {
  const TOP = Math.floor((ROWS - FONT_PX) / 2);
  const ctx = canvas.getContext('2d');
  const raster = document.createElement('canvas'); raster.width = 512; raster.height = 32;
  const rx = raster.getContext('2d', { willReadFrequently: true });
  const cache = new Map();
  let dpr = 1, pitch = 4, cols = 0, base = null, plate = null, plateKey = '', clockEnd = 0, waveX = 0, sprites = {}, out = ctx, lastLevels = 0;
  const state = { clock: '8:41', status: '', statusColor: 'amber', flash: null, levels: [0, 0, 0, 0, 0], dirty: true };

  /** 글 하나를 켜진 점 목록으로. 비트맵 글꼴을 16px에 맞춰 찍고 알파로 가른다. */
  function dots(text) {
    if (cache.has(text)) return cache.get(text);
    rx.clearRect(0, 0, raster.width, raster.height);
    rx.font = `${FONT_PX}px ${font}`; rx.textBaseline = 'top'; rx.fillStyle = '#fff';
    rx.fillText(text, 0, 0);
    const width = Math.ceil(rx.measureText(text).width), data = rx.getImageData(0, 0, Math.max(1, width), FONT_PX).data, on = [];
    for (let y = 0; y < FONT_PX; y++) for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3] > 110) on.push([x, y]);
    const out = { on, width }; cache.set(text, out); return out;
  }
  function resize() {
    const cssW = canvas.clientWidth, cssH = canvas.clientHeight; if (!cssW || !cssH) return;
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = Math.round(cssW * dpr), h = Math.round(cssH * dpr);
    if (canvas.width === w && canvas.height === h && base) return;
    canvas.width = w; canvas.height = h;
    pitch = h / ROWS; cols = Math.floor(w / pitch);
    sprites = Object.fromEntries(Object.entries(COLOR).map(([k, v]) => [k, dotSprite(v, Math.max(2, Math.round(pitch)))]));
    // 밑판: 꺼진 점이 다 보이는 검은 판
    base = document.createElement('canvas'); base.width = w; base.height = h;
    const b = base.getContext('2d'); b.fillStyle = '#080604'; b.fillRect(0, 0, w, h);
    b.fillStyle = 'rgba(92,58,22,.34)';
    const r = pitch * 0.3;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < cols; x++) { b.beginPath(); b.arc((x + 0.5) * pitch, (y + 0.5) * pitch, r, 0, Math.PI * 2); b.fill(); }
    state.dirty = true;
  }
  const put = (sprite, x, y) => { const s = sprite.width, cx = (x + 0.5) * pitch, cy = (y + 0.5) * pitch; out.drawImage(sprite, cx - s / 2, cy - s / 2); };
  function drawText(text, x0, color) { const d = dots(text), sp = sprites[color]; for (const [x, y] of d.on) { const X = x0 + x; if (X >= 0 && X < cols) put(sp, X, TOP + y); } return d.width; }
  /** 시각 · 상태 말이 바뀔 때만 다시 굽는 판. 파형은 이 판 위에 그린다. */
  function bakePlate() {
    const key = `${canvas.width}x${canvas.height}|${state.clock}|${state.status}|${state.statusColor}`;
    if (plate && plateKey === key) return;
    plateKey = key;
    plate = plate || document.createElement('canvas'); plate.width = canvas.width; plate.height = canvas.height;
    const px = plate.getContext('2d'); px.globalCompositeOperation = 'source-over'; px.drawImage(base, 0, 0);
    px.globalCompositeOperation = 'lighter'; out = px;
    clockEnd = drawText(state.clock, 2, 'amber') + 7;
    waveX = clockEnd + (state.status ? drawText(state.status, clockEnd, state.statusColor) : 0) + 4;
    out = ctx;
  }

  return {
    state,
    setClock(text) { if (state.clock !== text) { state.clock = text; state.dirty = true; } },
    setStatus(text, color = 'amber') { if (state.status !== text || state.statusColor !== color) { state.status = text; state.statusColor = color; state.dirty = true; } },
    setLevels(levels) { const now = performance.now(); if (now - lastLevels < 50 && levels.some((v) => v > 0)) return; lastLevels = now; state.levels = levels; state.dirty = true; },
    flash(text, seconds = 2.2, color = 'green') { state.flash = { text, until: seconds, color, t: 0 }; },
    /** 매 장면. 움직일 것이 없으면 그리지 않는다. */
    render(dt) {
      resize(); if (!base) return;
      const f = state.flash; if (f) { f.t += dt; if (f.t >= f.until) state.flash = null; state.dirty = true; }
      if (!state.dirty) return; state.dirty = false;
      bakePlate();
      ctx.globalCompositeOperation = 'source-over';
      if (state.flash) {
        // 흐르는 말: 시각만 남기고 상태 칸을 차지한다
        const x = clockEnd, d = dots(state.flash.text), area = cols - x - 2, offset = d.width <= area ? Math.round((area - d.width) / 2) : Math.round(area - (state.flash.t / state.flash.until) * (d.width + area * 0.2));
        ctx.drawImage(base, 0, 0);
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, x * pitch, canvas.height); ctx.clip(); ctx.drawImage(plate, 0, 0); ctx.restore();
        ctx.globalCompositeOperation = 'lighter';
        ctx.save(); ctx.beginPath(); ctx.rect(x * pitch, 0, area * pitch, canvas.height); ctx.clip();
        drawText(state.flash.text, x + offset, state.flash.color); ctx.restore();
      } else {
        ctx.drawImage(plate, 0, 0);
        // 목소리 파형: 위아래로 대칭인 점 기둥
        const n = cols - waveX - 2, mid = TOP + 8;
        if (n > 6 && (state.status || state.levels.some((v) => v > 0.02))) {
          ctx.globalCompositeOperation = 'lighter';
          const sp = sprites[state.status ? state.statusColor : 'white'];
          for (let i = 0; i < n; i += 2) {
            const k = i / n * (state.levels.length - 1), a = Math.floor(k), t = k - a, lv = (state.levels[a] || 0) * (1 - t) + (state.levels[a + 1] || 0) * t;
            const shape = 0.65 + 0.35 * Math.sin(i * 1.7 + a), h = Math.round(lv * shape * 7);
            for (let y = -h; y <= h; y++) put(sp, waveX + i, mid + y);
          }
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    },
    invalidate() { state.dirty = true; base = null; plate = null; cache.clear(); },
  };
}
