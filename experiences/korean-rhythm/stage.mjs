// 말의 리듬 — 펠트 무대(Canvas 2D).
// 크림 펠트 벽 아래로 코랄 펠트 바닥이 원근으로 깔리고, 그 위의 두 쿠션 레인(왼쪽 O 라피스 · 오른쪽 X 분홍)이
// 화면 아래 두 단추(#pad-0·#pad-1) 가운데로 모인다. 판정선은 크림 펠트 띠, 노트는 크림 펠트 배지에 O·X 글자.
// 모두 kit/felt의 실제 펠트 사진을 그린다(펠트를 그레이디언트로 흉내 내지 않는다. 빛·그림자만 얹는다).
// 움직이지 않는 벽·바닥·레인·판정선은 크기가 바뀔 때만 한 장으로 그려 두고, 장면마다 노트·빛·반짝이만 얹는다.
// 시계는 app.mjs가 넘기는 음악 시각(AudioContext)이다. 카메라는 흔들지 않는다.
// preview: 입구 그림 — 같은 레인·판정선·배지를 코랄 머리 면 위에 멈춘 채 한 번 그린다(벽·바닥 없이, 움직임 없음).

const FELT = 'kit/felt/';
const SRC = { wall: 'wide-cream', floor: 'tex-coral', cream: 'tex-cream', lane0: 'cushion-lapis-strip', lane1: 'cushion-blush-strip', badge: 'badge-cream', sparkle: 'sparkle' };
const GLYPH = ['O', 'X'];
const INK = ['#1d3f8c', '#a3302a'];   // O(라피스 레인)·X(분홍 레인) 글자 색
const DEPTH = 3.1;   // 노트가 나타나는 곳: 판정선 크기의 1/DEPTH
const LANE_DEPTH = 7;   // 레인(쿠션 띠)은 그보다 더 멀리, 벽 가까이까지 깐다
const TILT = 0.72;   // 바닥을 비스듬히 내려다보는 만큼(결의 세로 줄임)
// badge-cream.webp(156×160) 안의 펠트 원: 가운데 (72.5, 73), 지름 143 — 아래·오른쪽은 바닥 그림자
const BADGE = { cx: 72.5 / 156, cy: 73 / 160, d: 143 / 156 };

function loadImage(url) {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => im.decode().catch(() => {}).then(() => resolve(im));
    im.onerror = () => resolve(null);
    im.src = url;
  });
}
const clamp01 = (v) => Math.max(0, Math.min(1, v));

export class Stage {
  constructor(canvas, { pads = [], preview = false } = {}) {
    this.canvas = canvas;
    this.preview = preview;
    this.ctx = canvas.getContext('2d');
    this.pads = pads;
    this.bg = document.createElement('canvas');
    this.img = {};
    this.g = null;
    this.dpr = 1;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.flash = [0, 0];
    this.sparks = [];
    this.frames = 0;
    this.ready = Promise.all([
      ...Object.entries(SRC).map(([key, name]) => loadImage(`${FELT}${name}.webp`).then((im) => { this.img[key] = im; })),
      document.fonts?.load?.('900 40px SUIT').catch(() => {}),
    ]).then(() => this.resize(true));
    new ResizeObserver(() => this.resize()).observe(canvas);
  }

  /** 새 곡: 빛·반짝이를 비운다. */
  reset() { this.flash = [0, 0]; this.sparks = []; }

  resize(force = false) {
    const r = this.canvas.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
    const g = this.preview ? this.previewGeometry(r) : this.geometry(r);
    const same = this.g && W === this.canvas.width && H === this.canvas.height && Math.abs(g.yJ - this.g.yJ) < 0.5 && Math.abs(g.lx[0] - this.g.lx[0]) < 0.5;
    if (same && !force) return;
    this.canvas.width = W; this.canvas.height = H;
    this.dpr = dpr; this.g = g;
    if (this.preview) { this.paintPreview(); return; }
    const parent = this.canvas.parentElement, host = parent?.style, parentRect = parent?.getBoundingClientRect();
    host?.setProperty('--runway-x', `${(g.vx + r.left - (parentRect?.left ?? r.left)).toFixed(1)}px`);
    host?.setProperty('--runway-y', `${(g.yL + 3 + r.top - (parentRect?.top ?? r.top)).toFixed(1)}px`);
    this.paintBackground();
  }

  /** 무대 치수(CSS px). 레인은 두 단추의 가운데에서 시작해 지평선의 한 점으로 모인다. */
  geometry(r) {
    const W = r.width, H = r.height;
    const rects = this.pads.map((p) => p?.getBoundingClientRect?.()).filter((b) => b && b.width > 0);
    let x0 = W * 0.28, x1 = W * 0.72, padW = W * 0.42, padTop = H - 120;
    if (rects.length === 2) {
      x0 = rects[0].left + rects[0].width / 2 - r.left;
      x1 = rects[1].left + rects[1].width / 2 - r.left;
      padW = rects[0].width;
      padTop = Math.min(rects[0].top, rects[1].top) - r.top;
    }
    const compact = H < 280;
    const yJ = padTop - (compact ? 14 : Math.round(Math.max(20, Math.min(34, H * 0.04))));   // 판정선: 단추 바로 위
    const yh = Math.round(compact ? Math.max(14, H * 0.08) : Math.max(52, H * 0.22));       // 낮은 가로 무대에도 노트가 내려올 길을 남긴다.
    const vx = (x0 + x1) / 2;
    const wJ = Math.min(padW * 0.9, (x1 - x0) * 0.86);                     // 판정선에서 레인 폭
    return { W, H, yh, yJ, vx, lx: [x0, x1], wJ, d: Math.min(wJ * 0.58, compact ? H * 0.25 : 92),
      yF: yh + (yJ - yh) / DEPTH, yL: yh + (yJ - yh) / LANE_DEPTH, yN: yJ + (yJ - yh) * 0.08 };
  }

  /** 입구 그림의 치수: 오른쪽은 몽글 자리로 비우고, 레인은 그림 위쪽 멀리의 한 점으로 모인다(머리 면에는 바닥이 없어 원근을 순하게). */
  previewGeometry(r) {
    const W = r.width, H = r.height, wide = W > 520;
    const vx = W * (wide ? 0.4 : 0.36), yh = -H * 1.5, yJ = H * 0.8;
    const wJ = Math.min(W * (wide ? 0.15 : 0.2), H * 0.38), gap = wJ * 0.16;
    const zf = ((yJ - yh) / -yh) * 1.04;   // 그림 위 끝의 깊이: 레인 결을 보이는 길이에만 깐다(늘어나 번지지 않게)
    return { W, H, yh, yJ, vx, lx: [vx - (wJ + gap) / 2, vx + (wJ + gap) / 2], wJ, d: wJ * 0.62, zf,
      yF: yh + (yJ - yh) / DEPTH, yL: yh + (yJ - yh) / zf, yN: yJ + (yJ - yh) * 0.1 };
  }

  /** 입구 그림: 레인 둘 · 판정선 · O·X 배지 넷(하나는 판정선 위, 옆에 반짝이). 레인의 먼 끝은 머리 면 결 속으로 옅어진다. */
  paintPreview() {
    const c = this.ctx, g = this.g, I = this.img;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    for (const lane of [0, 1]) if (I[`lane${lane}`]) this.paintLane(c, g, lane);
    const top = Math.max(0, g.yL), far = top + g.H * 0.3, fade = c.createLinearGradient(0, top, 0, far);   // 위로 갈수록 머리 면 결 속으로
    fade.addColorStop(0, 'rgba(0,0,0,1)'); fade.addColorStop(1, 'rgba(0,0,0,0)');
    c.save(); c.globalCompositeOperation = 'destination-out'; c.fillStyle = fade; c.fillRect(0, 0, g.W, far); c.restore();
    if (I.cream) this.paintJudge(c, g);
    for (const [lane, p] of [[1, 0.9], [0, 0.935], [1, 0.968], [0, 1]]) this.drawBadge(lane, this.scaleAt(p), 1);
    if (I.sparkle) {
      const at = this.pointAt(0, 1), size = g.d * 0.42;
      c.drawImage(I.sparkle, at.x + g.d * 0.42, at.y - g.d * 0.62, size, size * I.sparkle.height / I.sparkle.width);
    }
    this.frames += 1;
  }

  /** 노트 진행 p(0 = 먼 끝, 1 = 판정선)의 크기 배율 s와 화면 위치 */
  scaleAt(p) { return 1 / (1 + (DEPTH - 1) * (1 - p)); }
  pointAt(lane, s) { const g = this.g; return { x: g.vx + (g.lx[lane] - g.vx) * s, y: g.yh + (g.yJ - g.yh) * s }; }
  /** 판정선 위 레인 가운데(판정 글자를 띄울 곳, CSS px) */
  judgeAt(lane) { const g = this.g; return g ? { x: g.lx[lane], y: g.yJ } : null; }

  /* ── 움직이지 않는 판: 벽 · 바닥 · 레인 · 판정선 ── */
  paintBackground() {
    const g = this.g, I = this.img;
    if (!g) return;
    this.bg.width = this.canvas.width; this.bg.height = this.canvas.height;
    const c = this.bg.getContext('2d');
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = '#efe3d0'; c.fillRect(0, 0, g.W, g.yh + 1);
    c.fillStyle = '#e45a49'; c.fillRect(0, g.yh, g.W, g.H - g.yh);
    if (I.wall) this.paintWall(c, g);
    if (I.floor) this.paintFloor(c, g);
    for (const lane of [0, 1]) if (I[`lane${lane}`]) this.paintLane(c, g, lane);
    if (I.floor) this.paintHaze(c, g);
    if (I.cream) this.paintJudge(c, g);
    this.bgReady = !!(I.wall && I.floor);
  }

  paintWall(c, g) {
    const im = this.img.wall, dw = Math.max(2560, g.W), dh = dw * im.height / im.width;
    c.save();
    c.beginPath(); c.rect(0, 0, g.W, g.yh + 1); c.clip();
    c.drawImage(im, (g.W - dw) / 2, (g.yh - dh) / 2, dw, dh);
    c.fillStyle = 'rgba(251,247,240,.38)'; c.fillRect(0, 0, g.W, g.yh);   // 키트 판 벽과 같은 밝기
    const light = c.createRadialGradient(g.vx, g.yh * 0.7, 10, g.vx, g.yh * 0.7, g.W * 0.6);
    light.addColorStop(0, 'rgba(255,255,255,.32)'); light.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = light; c.fillRect(0, 0, g.W, g.yh);
    const base = c.createLinearGradient(0, g.yh - 22, 0, g.yh);   // 벽 아래 그늘
    base.addColorStop(0, 'rgba(120,70,45,0)'); base.addColorStop(1, 'rgba(120,70,45,.16)');
    c.fillStyle = base; c.fillRect(0, g.yh - 22, g.W, 22);
    c.restore();
  }

  /** 코랄 펠트 바닥: 결을 깊이에 맞춰 줄여 가며 가로 띠로 깐다(멀수록 작고 납작하게). */
  paintFloor(c, g) {
    const im = this.img.floor, pat = c.createPattern(im, 'repeat');
    const T = 190 / im.width;                       // 판정선 깊이에서 결 한 장이 190px(키트 머리 면과 같은 크기)
    const span = g.yJ - g.yh, Kv = span / (T * TILT);
    const step = 1 / this.dpr * 2;
    for (let y = g.yh; y < g.H; y += step) {
      const s = Math.max(0.015, (y + step / 2 - g.yh) / span), Z = 1 / s;
      const m = new DOMMatrix().translateSelf(g.vx, y).scaleSelf(T * s, T * TILT * s * s).translateSelf(0, Kv * Z);
      pat.setTransform(m);
      c.fillStyle = pat; c.fillRect(0, y, g.W, step + 0.01);
    }
    c.fillStyle = 'rgba(249,104,89,.36)'; c.fillRect(0, g.yh, g.W, g.H - g.yh);   // 키트 코랄 면과 같은 색 덮기
    if (g.W > 700) {   // 넓은 화면: 바닥 양옆을 조금 어둡게(가운데 레인으로 눈이 가게)
      const side = c.createLinearGradient(0, 0, g.W, 0);
      side.addColorStop(0, 'rgba(90,30,20,.2)'); side.addColorStop(0.32, 'rgba(90,30,20,0)');
      side.addColorStop(0.68, 'rgba(90,30,20,0)'); side.addColorStop(1, 'rgba(90,30,20,.2)');
      c.fillStyle = side; c.fillRect(0, g.yh, g.W, g.H - g.yh);
    }
    const front = c.createLinearGradient(0, g.yJ, 0, g.H);   // 앞쪽은 조금 어둡게(단추가 떠 보이게)
    front.addColorStop(0, 'rgba(90,30,20,0)'); front.addColorStop(1, 'rgba(90,30,20,.16)');
    c.fillStyle = front; c.fillRect(0, g.yJ, g.W, g.H - g.yJ);
  }

  /** 먼 바닥과 레인의 먼 끝이 벽 앞에서 옅어지게(결이 자글자글해지지 않게) 한 번의 안개 */
  paintHaze(c, g) {
    const far = g.yL + (g.yJ - g.yh) * 0.14, mist = c.createLinearGradient(0, g.yh, 0, far);
    mist.addColorStop(0, 'rgba(236,128,108,.88)'); mist.addColorStop(1, 'rgba(236,128,108,0)');
    c.fillStyle = mist; c.fillRect(0, g.yh, g.W, far - g.yh);
    const seam = c.createLinearGradient(0, g.yh, 0, g.yh + 14);   // 벽과 바닥이 만나는 곳의 그늘
    seam.addColorStop(0, 'rgba(110,40,28,.28)'); seam.addColorStop(1, 'rgba(110,40,28,0)');
    c.fillStyle = seam; c.fillRect(0, g.yh, g.W, 14);
  }

  /**
   * 쿠션 레인: 가로로 긴 펠트 띠(cushion-*-strip)를 세워 원근으로 깐다. 화면 한 줄(장치 픽셀)마다 그 깊이에 맞는
   * 띠의 한 조각을 그 폭으로 그린다(멀수록 촘촘). 레인은 띠 한 장보다 길다 — 한 장을 늘이면 가까운 쪽 결이 번져서,
   * 둥근 두 끝은 그대로 두고 가운데 결만 거울로 홀수 번 이어 붙인다(이음매에서 결이 끊기지 않게).
   * 왼쪽 레인은 그늘이 왼쪽, 오른쪽 레인은 오른쪽으로 오게 돌린다.
   */
  paintLane(c, g, lane) {
    const im = this.img[`lane${lane}`], iw = im.width, ih = im.height;
    const span = g.yJ - g.yh, Zf = g.zf || LANE_DEPTH, Zn = span / (g.yN - g.yh), cap = 0.07;
    const mids = Math.max(1, 2 * Math.round(((Zf - Zn) / 2 - 2 * cap) / (1 - 2 * cap) / 2 - 0.5) + 1);   // 가운데 결 장수(홀수)
    const per = (Zf - Zn) / (mids * (1 - 2 * cap) + 2 * cap), total = (Zf - Zn) / per;   // 띠 한 장이 덮는 깊이 · 레인 길이(장)
    const dpr = this.dpr, top = Math.floor(g.yL * dpr), bottom = Math.ceil(g.yN * dpr);
    const u = (Y) => {   // 화면 줄 → 띠의 가로 위치(0~1)
      const w = (Zf - span / (Y / dpr - g.yh)) / per;
      if (w <= cap) return clamp01(w);
      if (w >= total - cap) return clamp01(1 - (total - w));
      const m = (w - cap) / (1 - 2 * cap), k = Math.floor(m), f = m - k;
      return cap + (k % 2 ? 1 - f : f) * (1 - 2 * cap);
    };
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    for (let Y = top; Y < bottom; Y += 1) {
      let u1 = u(Y), u2 = u(Y + 1);
      if (u2 < u1) [u1, u2] = [u2, u1];   // 거울로 꺾이는 줄
      const s = (Y + 0.5) / dpr - g.yh;
      const k = s / span, cx = (g.vx + (g.lx[lane] - g.vx) * k) * dpr, w = g.wJ * k * dpr;
      const sx = u1 * iw, sw = Math.max(0.35, (u2 - u1) * iw);
      if (lane === 0) c.setTransform(0, 1, -1, 0, cx + w / 2, Y);   // 90° 돌림: 띠의 길이 → 화면 아래, 띠의 아래(그늘) → 왼쪽
      else c.setTransform(0, -1, 1, 0, cx - w / 2, Y + 1);          // -90° 돌림: 띠의 아래(그늘) → 오른쪽
      c.drawImage(im, sx, 0, sw, ih, 0, 0, 1, w);
    }
    c.restore();
  }

  /** 판정선: 두 레인을 가로지르는 크림 펠트 띠(tex-cream 결로 채운 둥근 띠 + 바닥 그림자). */
  paintJudge(c, g) {
    const x0 = g.lx[0] - g.wJ / 2 - 12, x1 = g.lx[1] + g.wJ / 2 + 12, h = Math.max(13, Math.min(22, g.wJ * 0.11));
    const pat = c.createPattern(this.img.cream, 'repeat');
    pat.setTransform(new DOMMatrix().scaleSelf(0.5, 0.5));
    c.save();
    c.shadowColor = 'rgba(73,40,25,.38)'; c.shadowBlur = 10; c.shadowOffsetY = 4;
    c.beginPath(); c.roundRect(x0, g.yJ - h / 2, x1 - x0, h, h / 2);
    c.fillStyle = pat; c.fill();
    c.restore();
    c.save();   // 위쪽 빛받이·아래쪽 옆면(두께) — 펠트 띠가 바닥에서 도톰하게 보이게
    c.beginPath(); c.roundRect(x0, g.yJ - h / 2, x1 - x0, h, h / 2); c.clip();
    const lip = c.createLinearGradient(0, g.yJ - h / 2, 0, g.yJ + h / 2);
    lip.addColorStop(0, 'rgba(255,255,255,.35)'); lip.addColorStop(0.35, 'rgba(255,255,255,0)'); lip.addColorStop(1, 'rgba(120,80,50,.22)');
    c.fillStyle = lip; c.fillRect(x0, g.yJ - h / 2, x1 - x0, h);
    c.restore();
  }

  /* ── 장면마다 ── */
  /** 맞힌 노트: 그 레인의 판정선이 잠깐 밝아지고(효과 줄이기에서는 덜), 반짝이 몇 개가 위로 흩어진다. */
  hit(lane, quality) {
    this.flash[lane] = quality > 0 ? 1 : 0.2;
    if (this.reduced || quality < 0.8 || !this.g) return;
    const { x, y } = this.judgeAt(lane), n = quality >= 1 ? 4 : 2;
    for (let i = 0; i < n; i += 1) {
      this.sparks.push({ x: x + (Math.random() - 0.5) * this.g.wJ * 0.5, y: y - 6, vx: (Math.random() - 0.5) * 90, vy: -150 - Math.random() * 90,
        age: 0, life: 0.42 + Math.random() * 0.18, size: 14 + Math.random() * 9, rot: (Math.random() - 0.5) * 0.8 });
    }
    if (this.sparks.length > 40) this.sparks.splice(0, this.sparks.length - 40);
  }

  draw(round, time, pressed, dt) {
    const c = this.ctx, g = this.g;
    if (!g) return;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.bgReady) c.drawImage(this.bg, 0, 0);
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (round) {
      this.drawBeats(round, time);
      this.drawGlow(pressed, dt);
      this.drawNotes(round, time);
      this.drawAnswers(round, time);
    }
    this.drawSparks(dt);
    this.frames += 1;
  }

  /** 박자 줄: 레인 위에 크림색 얇은 줄(마디 첫 박은 조금 진하게). 답할 때 박자를 미리 셀 수 있게. */
  drawBeats(round, time) {
    const c = this.ctx, g = this.g, beats = round.track?.beatTimes;
    if (!beats) return;
    const A = round.level.approach;
    let i = Math.max(0, Math.floor((time - 0.2) / round.beat) - 2);
    while (i < beats.length && beats[i] < time - 0.05) i += 1;
    for (; i < beats.length && beats[i] <= time + A; i += 1) {
      const p = 1 - (beats[i] - time) / A;
      if (p < 0 || p > 1) continue;
      const s = this.scaleAt(p), fade = Math.min(1, p / 0.15);
      c.fillStyle = `rgba(255,250,242,${(i % 4 === 0 ? 0.34 : 0.15) * fade})`;
      for (const lane of [0, 1]) {
        const { x, y } = this.pointAt(lane, s), w = g.wJ * s * 0.78;
        c.fillRect(x - w / 2, y - Math.max(0.6, 1.6 * s) / 2, w, Math.max(0.6, 1.6 * s));
      }
    }
  }

  drawGlow(pressed, dt) {
    const c = this.ctx, g = this.g;
    for (const lane of [0, 1]) {
      const on = pressed.has(lane) ? 0.22 : 0, f = this.reduced ? Math.min(this.flash[lane], 0.35) : this.flash[lane];
      const a = Math.max(on, f * 0.5);
      this.flash[lane] = Math.max(0, this.flash[lane] - dt * 4.2);
      if (a < 0.01) continue;
      const x = g.lx[lane], r = g.wJ * 0.62;
      const glow = c.createRadialGradient(x, g.yJ, 4, x, g.yJ, r);
      glow.addColorStop(0, `rgba(255,252,238,${a})`); glow.addColorStop(1, 'rgba(255,252,238,0)');
      c.fillStyle = glow;
      c.beginPath(); c.ellipse(x, g.yJ, r, r * 0.55, 0, 0, Math.PI * 2); c.fill();
    }
  }

  drawNotes(round, time) {
    const A = round.level.approach;
    for (let i = round.notes.length - 1; i >= 0; i -= 1) {   // 먼 노트부터(가까운 노트가 위에 오게)
      const n = round.notes[i];
      if (n.state === 'hit' || n.state === 'missed' || n.state === 'broken') continue;
      if (n.time - time > A) continue;
      let p = 1 - (n.time - time) / A;
      const tail = 1 - (n.endTime - time) / A;
      if (tail > 1.1 || p < 0) continue;
      if (n.state === 'holding') p = 1;
      const alpha = Math.min(clamp01(p / 0.08), p > 1 ? clamp01(1 - (p - 1) / 0.1) : 1);
      if (n.duration) this.drawRibbon(n.lane, Math.max(0, tail), Math.min(p, 1.08), alpha, n.state === 'holding');
      this.drawBadge(n.lane, this.scaleAt(Math.min(p, 1.1)), alpha);
    }
  }

  /** 길게 누르는 노트의 몸통: 크림 펠트 결로 채운 띠(레인 위에 눕힘). */
  drawRibbon(lane, pTail, pHead, alpha, holding) {
    const c = this.ctx, g = this.g;
    const sT = this.scaleAt(pTail), sH = this.scaleAt(pHead);
    const a = this.pointAt(lane, sT), b = this.pointAt(lane, sH), wa = g.wJ * 0.36 * sT, wb = g.wJ * 0.36 * sH;
    if (!this.ribbonFill) { this.ribbonFill = c.createPattern(this.img.cream, 'repeat'); this.ribbonFill?.setTransform(new DOMMatrix().scaleSelf(0.42, 0.42)); }
    c.save();
    c.globalAlpha = alpha * (holding ? 1 : 0.92);
    c.shadowColor = 'rgba(20,30,70,.3)'; c.shadowBlur = 6; c.shadowOffsetY = 2;
    c.beginPath();
    c.moveTo(a.x - wa / 2, a.y); c.lineTo(a.x + wa / 2, a.y); c.lineTo(b.x + wb / 2, b.y); c.lineTo(b.x - wb / 2, b.y); c.closePath();
    c.fillStyle = this.ribbonFill || '#f1e8da'; c.fill();
    c.restore();
    if (holding) {   // 누르는 동안 몸통이 빛난다
      c.save(); c.globalAlpha = 0.28;
      c.beginPath(); c.moveTo(a.x - wa / 2, a.y); c.lineTo(a.x + wa / 2, a.y); c.lineTo(b.x + wb / 2, b.y); c.lineTo(b.x - wb / 2, b.y); c.closePath();
      c.fillStyle = '#fffaf0'; c.fill(); c.restore();
    }
    this.drawBadge(lane, sT, alpha * 0.95, { small: true, glyph: false });   // 꼬리 끝 작은 배지
  }

  /** 크림 펠트 배지 + O·X 글자. big: 듣기 문제의 답 노트, picked: 고른 답(크림 칼선 스티커). */
  drawBadge(lane, s, alpha, { big = false, picked = false, small = false, glyph = true } = {}) {
    const c = this.ctx, g = this.g, im = this.img.badge;
    const { x, y } = this.pointAt(lane, s);
    const d = g.d * s * (big ? 1.22 : small ? 0.5 : 1);
    if (d < 2 || alpha <= 0) return;
    c.save();
    c.globalAlpha = alpha;
    if (picked) { c.fillStyle = '#fffaf2'; c.beginPath(); c.arc(x, y, d / 2 + Math.max(2.5, d * 0.05), 0, Math.PI * 2); c.fill(); }
    if (im) {
      const bw = d / BADGE.d, bh = bw * im.height / im.width;
      c.drawImage(im, x - bw * BADGE.cx, y - bh * BADGE.cy, bw, bh);
    } else { c.fillStyle = '#efe5d6'; c.beginPath(); c.arc(x, y, d / 2, 0, Math.PI * 2); c.fill(); }
    if (glyph && d > 16) {   // 아주 작은 먼 배지에는 글자를 얹지 않는다
      c.fillStyle = INK[lane];
      c.font = `900 ${Math.round(d * (big ? 0.5 : 0.46))}px SUIT, "Apple SD Gothic Neo", sans-serif`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(GLYPH[lane], x, y + d * 0.035);
    }
    c.restore();
  }

  /** 듣기 문제의 답 노트: 답할 때가 되면 두 레인에 큰 O·X 배지가 함께 온다. 고른 답에는 크림 칼선. */
  drawAnswers(round, time) {
    const c = this.ctx, A = round.level.approach;
    for (const q of round.questions) {
      if (q.state !== 'pending' || time < q.answerOpen) continue;
      const p = 1 - (q.time - time) / A;
      if (p < 0 || p > 1.08) continue;
      const alpha = Math.min(clamp01((time - q.answerOpen) / 0.25), p > 1 ? clamp01(1 - (p - 1) / 0.08) : 1);
      const s = this.scaleAt(Math.min(p, 1.08));
      for (const lane of [0, 1]) {
        const { x, y } = this.pointAt(lane, s), r = this.g.d * s * 1.05;
        const halo = c.createRadialGradient(x, y, r * 0.3, x, y, r);   // 답 노트 둘레의 빛(다른 노트와 구분)
        halo.addColorStop(0, `rgba(255,246,214,${0.75 * alpha})`); halo.addColorStop(1, 'rgba(255,246,214,0)');
        c.fillStyle = halo; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
        this.drawBadge(lane, s, alpha, { big: true, picked: q.intent === lane });
      }
    }
  }

  drawSparks(dt) {
    const c = this.ctx, im = this.img.sparkle;
    if (!im || !this.sparks.length) return;
    for (let i = this.sparks.length - 1; i >= 0; i -= 1) {
      const p = this.sparks[i];
      p.age += dt;
      if (p.age > p.life || this.reduced) { this.sparks.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt;
      c.save();
      c.globalAlpha = 1 - p.age / p.life;
      c.translate(p.x, p.y); c.rotate(p.rot);
      c.drawImage(im, -p.size / 2, -p.size / 2, p.size, p.size * im.height / im.width);
      c.restore();
    }
  }
}
