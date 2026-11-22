// 솔리오 「사무실」 방의 사무실 그림(구현설계 11.2, 시안 사무실.html 553~755행의 그리기를 옮겼다). 캔버스 하나에 부서 좌대, 자리, 직원(구의 작은 분신)을 그린다.
// 유호님 11-20 취향 기록에 따라 시안에서 바꾼 것: 빈 자리의 동그라미 대신 가는 짧은 선 하나, 승인 물음의 물결 고리 없음, 도우미는 구 곁의 꽉 찬 작은 점(셋까지)을 가만히 둔다.
// 손을 따라 기우는 카메라, 위아래로 뜨는 몸, 몸을 도는 빛줄기, 구에서 날아오는 새 직원을 뺐다.
// 움직이는 것과 그 크기(이것 말고는 움직이지 않는다):
//  · 눈 깜빡임: 직원마다 2.4~7.6초에 한 번, 0.12초쯤 눈을 감았다 뜬다.
//  · 눈길: 승인을 물은 직원은 손(포인터) 쪽을 본다. 눈의 점이 구 반지름의 20% 안에서만 옮긴다. 일하는 직원의 눈은 9초 주기로 반지름의 8%만큼 좌우로 흐른다.
//  · 일하는 중: 테두리 밝기가 3.2초 주기로 0.38~0.62 사이를 천천히 오간다. 몸은 그 자리에 있다.
//  · 느낌표: 알림이 새로 붙을 때 0.42초 동안 커지며 나오고, 승인을 물은 직원의 느낌표는 1.6초 주기로 2.5px 안에서 위아래로 뛴다.
//  · 새 직원: 제자리에서 0.3초 동안 나타난다.
//  · 보기 바꾸기: 손님이 설정에서 「비스듬히」 · 「위에서」를 바꿀 때만 카메라가 한 번 옮겨 간다(0.7초쯤).
//  · 움직임 줄이기가 켜져 있으면 모두 멈추고, 장면이 바뀔 때마다 한 번만 그린다.
// 방이 보이는 동안만 그린다(show). 화면 밀도는 2배까지만 쓴다. 모듈 맨 위에서는 DOM을 건드리지 않는다.

import { countWord } from './office-model.mjs';

export const FLOOR_MOTION = Object.freeze({
  blinkMin: 2400, blinkSpan: 5200, blinkMs: 120,
  gazePeriod: 9000, gaze: 0.08, look: 0.2,
  rimPeriod: 3200, rimLow: 0.38, rimHigh: 0.62,
  bangPeriod: 1600, bangPx: 2.5, popMs: 420,
  fadeMs: 300, viewTau: 230, frameMs: 33,
});
const M = FLOOR_MOTION;
const INK = '243,241,236';
const ink = a => `rgba(${INK},${a})`;
/* 사무실의 치수(시안 값). 부서 좌대 하나가 3.2 × 2.4, 사이 0.6, 직원 반지름 0.3이다 */
const ZW = 3.2, ZD = 2.4, GAP = 0.6, SLAB = 0.1, R0 = 0.3, STRIP = 1.1, STEP = 1.2;
/* 상태마다의 밝기와 높이. 소식이 없는 직원도 점선 테두리 없이 흐린 테두리로 둔다(빽빽한 점 무늬를 쓰지 않는다) */
const LOOK = Object.freeze({
  working: { rim: 0.5, glow: 0.16, lift: 0.14, eye: 0.9, mode: 'open' },
  asked: { rim: 0.98, glow: 0.34, lift: 0.24, eye: 1, mode: 'look' },
  silent: { rim: 0.3, glow: 0.08, lift: 0.06, eye: 0.6, mode: 'open' },
  done: { rim: 0.62, glow: 0.15, lift: 0.05, eye: 0.9, mode: 'smile' },
  resting: { rim: 0.24, glow: 0.06, lift: 0, eye: 0.42, mode: 'closed' },
  // 「조용합니다」(훅 소식이 없는 세션 포함)는 그림에서 쉬는 직원과 같은 모습이다(4.2)
  quiet: { rim: 0.24, glow: 0.06, lift: 0, eye: 0.42, mode: 'closed' },
});
const lookOf = s => LOOK[s] || LOOK.quiet;
/* 자리보다 직원이 많으면 승인을 물은 직원, 느낌표가 붙은 직원, 일하는 직원부터 앉힌다. 처음 본 차례로만 앉히면 오래 조용한 직원이 자리를 차지해,
   맨 위 글은 「열둘이 일하고 있습니다」인데 그림에는 하나만 눈을 뜨고 있었다(유호님 PC 실제 확인 11-22, 직원 스물셋).
   지난 그림에도 앉아 있던 직원은 그 자리를 그대로 쓰고, 새로 앉는 직원이 빠진 직원의 자리를 채운다. 그러지 않으면 한 명이 조용해질 때마다
   그 사이 직원이 모두 한 칸씩 옮겨 앉는다(검수 solio-office-seats-20261122 F1). 자리 수보다 적으면 전처럼 처음 본 차례다.
   자리 수와 같을 때는 지난 배치의 자리 수도 같으면 지난 자리를 잇는다(검수 -r2 FA1) */
const SEAT_RANK = Object.freeze({ working: 2, done: 3, quiet: 4, resting: 5 });
const seatRank = s => (s.status === 'asked' ? 0 : s.alert ? 1 : SEAT_RANK[s.status] ?? 9);
/* 구역 이름표. 자리를 넘어 그림에 없는 직원이 있으면 그 수를 알린다(맨 위 글은 일하는 수를 다 세므로, 검수 solio-office-seats-20261122 F2).
   이름이 먼저다: 이름과 함께 다 들어갈 때만 「 · 열다섯 더」, 그다음 「 +15」를 붙이고, 그래도 안 들어가면 전처럼 이름만 줄여 쓴다(검수 solio-office-ga1-20261122 F1).
   「그 밖 셋」은 이름의 수가 부서 수라 「직원」을 붙인다(F4). fits(글): 그 글이 이름표 폭에 들어가는가. short: 이 장면은 짧은 꼴로만 쓴다.
   form은 쓴 꼴(long · short · none)이고, clip이면 그리는 쪽이 줄인다 */
export function floorZoneLabel(z, fits, short = false) {
  const name = String(z?.name || ''), n = z && z.hidden > 0 ? z.hidden : 0;
  if (n) {
    const who = z.kind === 'other' ? '직원 ' : '';
    const forms = [['long', ' · ' + who + countWord(n) + ' 더'], ['short', (who ? ' · ' + who : ' ') + '+' + n]].filter(([f]) => !short || f === 'short');
    for (const [form, tail] of forms) if (fits(name + tail)) return { text: name + tail, clip: false, form };
  }
  return { text: name, clip: true, form: 'none' };
}
/* 이 장면을 짧은 꼴로 쓰는가: 빠진 수가 있는 구역 가운데 긴 꼴은 안 들어가고 짧은 꼴은 들어가는 구역이 하나라도 있으면 그렇다.
   어느 꼴도 안 들어가는 구역(수를 적지 못함)은 이 판단에서 뺀다(검수 solio-office-ga1b-20261122-r2 FA1). fitsOf(구역): 그 구역 이름표 폭의 fits */
export const floorShortForm = (zones, fitsOf) => (Array.isArray(zones) ? zones : []).some(z => z && z.hidden > 0 && floorZoneLabel(z, fitsOf(z)).form === 'short');
function seated(staff, n, before) {
  // 자리 수와 같아질 때도 지난 자리를 잇는다. 넘쳤다가 그림에 없던 직원이 빠져 자리 수와 같아질 때 모두가 옮겨 앉지 않게(검수 -r2 F1)
  if (staff.length < n || (staff.length === n && !(before && before.spots?.length === n))) return staff;
  const chosen = staff.map((s, i) => [s, i]).sort(([a, i], [b, j]) => seatRank(a) - seatRank(b) || i - j).slice(0, n).sort((a, b) => a[1] - b[1]).map(([s]) => s);
  if (!before || before.spots?.length !== n || !Array.isArray(before.staff)) return chosen;
  const byId = new Map(chosen.map(s => [s.id, s]));
  const seats = Array.from({ length: n }, (_, i) => (before.staff[i] && byId.has(before.staff[i].id) ? byId.get(before.staff[i].id) : null));
  const kept = new Set(seats.filter(Boolean).map(s => s.id));
  const fresh = chosen.filter(s => !kept.has(s.id));
  return seats.map(s => s || fresh.shift());
}

/* 자리 잡기: 부서는 셋씩 두 줄, 그 아래 한 띠에 「부서 없는 일」과 「그 밖」을 나란히 둔다. 빈 부서도 그린다 */
export function floorLayout(scene, prev = null) {
  const was = key => (Array.isArray(prev) ? prev.find(p => p && p.key === key) : null);
  const zones = Array.isArray(scene?.zones) ? scene.zones : [];
  const depts = zones.filter(z => z.kind === 'dept'), bottom = zones.filter(z => z.kind !== 'dept');
  const seats = Math.max(1, Math.min(3, Number(scene?.seats) || 1));
  const cols = Math.min(3, Math.max(1, depts.length)), rows = depts.length ? Math.ceil(depts.length / cols) : 0;
  const out = [];
  depts.forEach((z, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const cx = (col - (cols - 1) / 2) * (ZW + GAP), cz = (row - (rows - 1) / 2) * (ZD + GAP);
    const n = Math.min(6, Math.max(seats, z.staff.length));
    const spots = [];
    const line = (k, z0) => { const f = k === 1 ? [0.5] : k === 2 ? [0.34, 0.66] : [0.22, 0.5, 0.78]; for (const x of f) spots.push({ x: cx - ZW / 2 + ZW * x, z: z0 }); };
    if (n <= 3) line(n, cz - 0.18); else { line(Math.ceil(n / 2), cz - 0.55); line(n - Math.ceil(n / 2), cz + 0.35); }
    const shown = seated(z.staff, n, was(z.key));
    out.push({ ...z, staff: shown, hidden: z.staff.length - shown.length, rect: { x0: cx - ZW / 2, x1: cx + ZW / 2, z0: cz - ZD / 2, z1: cz + ZD / 2 }, spots });
  });
  if (bottom.length) {
    const gridHalf = depts.length ? (cols * ZW + (cols - 1) * GAP) / 2 : 0;
    const need = bottom.map(z => Math.max(2, Math.min(8, z.staff.length)) * STEP + 0.8);
    const half = Math.max(gridHalf, (need.reduce((a, b) => a + b, 0) + GAP * (bottom.length - 1)) / 2);
    const z0 = rows ? (rows * ZD + (rows - 1) * GAP) / 2 + 0.65 : -STRIP / 2;
    // 남는 폭은 구역마다 필요한 폭에 비례해 나눈다. 고르게 나누면 직원이 많은 구역의 구슬이 좌대 밖으로 나간다(0.5.2 공개 검수 A5)
    const total = need.reduce((a, b) => a + b, 0), spare = Math.max(0, 2 * half - GAP * (bottom.length - 1) - total);
    let x = -half;
    bottom.forEach((z, i) => {
      const width = need[i] + spare * (need[i] / total);
      const x0 = x, x1 = x0 + width, mid = (x0 + x1) / 2, n = Math.min(8, z.staff.length);
      x = x1 + GAP;
      const spots = Array.from({ length: n }, (_, k) => ({ x: mid + (k - (n - 1) / 2) * STEP, z: z0 + STRIP / 2 - 0.05 }));
      const shown = seated(z.staff, n, was(z.key));
      out.push({ ...z, staff: shown, hidden: z.staff.length - shown.length, rect: { x0, x1, z0, z1: z0 + STRIP }, spots });
    });
  }
  return out;
}

/* canvas: 그림을 그릴 캔버스(자리 요소 안에 꽉 찬다). reduced(): 움직임 줄이기. isOpen(key): 그 부서 줄이 열려 있는가.
   onHover(zone, staff): 손이 가리키는 부서 열쇠와 직원 번호(바뀔 때만). onPress(zone, staff): 눌린 부서와 직원(빈 곳이면 null) */
export function createOfficeFloor(canvas, { win = globalThis, reduced = () => false, isOpen = () => false, onHover = () => {}, onPress = () => {} } = {}) {
  const ctx = canvas?.getContext?.('2d') || null;
  const raf = fn => (typeof win.requestAnimationFrame === 'function' ? win.requestAnimationFrame(fn) : setTimeout(() => fn(Date.now()), M.frameMs));
  const unraf = id => (typeof win.cancelAnimationFrame === 'function' ? win.cancelAnimationFrame(id) : clearTimeout(id));
  const clock = () => { try { return win.performance?.now?.() ?? Date.now(); } catch { return Date.now(); } };
  let scene = { view: 'tilted', viewSeq: 0, seats: 1, zones: [] }, sceneKey = '', layout = [];
  let view = 1, viewTo = 1, viewSeq = null, shown = false, frame = 0, lastDraw = -1e9, W = 0, H = 0;
  let hot = { zone: null, staff: null }, ptr = { x: -1e4, y: -1e4 }, over = { zone: null, staff: null };
  const life = new Map(); // 직원마다: 나타난 때, 깜빡임, 느낌표가 붙은 때
  let first = true;
  const cam = { cy: 1, sy: 0, ca: 0, sa: 1, k: 0, S: 50, ox: 0, oy: 0 };
  let zonesOnScreen = [], staffOnScreen = [];

  function setCam(t) {
    const e = t * t * (3 - 2 * t);
    const yaw = (-16 * e) * Math.PI / 180, pitch = (90 - 43 * e) * Math.PI / 180;
    cam.cy = Math.cos(yaw); cam.sy = Math.sin(yaw); cam.ca = Math.cos(pitch); cam.sa = Math.sin(pitch); cam.k = 0.028 * e;
  }
  function P0(x, y, z) {
    const xr = x * cam.cy - z * cam.sy, zr = x * cam.sy + z * cam.cy;
    const d = zr * cam.ca + y * cam.sa, s = 1 / (1 - d * cam.k);
    return [xr * s, (zr * cam.sa - y * cam.ca) * s, d, s];
  }
  const P = (x, y, z) => { const p = P0(x, y, z); return [cam.ox + p[0] * cam.S, cam.oy + p[1] * cam.S, p[2], p[3]]; };
  function fit() {
    let a = 1e9, b = -1e9, c = 1e9, e = -1e9;
    for (const z of layout) for (const x of [z.rect.x0, z.rect.x1]) for (const zz of [z.rect.z0, z.rect.z1]) for (const y of [0, 1.05]) {
      const p = P0(x, y, zz); a = Math.min(a, p[0]); b = Math.max(b, p[0]); c = Math.min(c, p[1]); e = Math.max(e, p[1]);
    }
    if (!(b > a) || !(e > c)) return false;
    const pad = 10;
    cam.S = Math.max(1, Math.min((W - pad * 2) / (b - a), (H - pad * 2) / (e - c), 120));
    cam.ox = W / 2 - (a + b) / 2 * cam.S;
    cam.oy = pad + (H - pad * 2 - (e - c) * cam.S) * 0.3 - c * cam.S;
    return true;
  }
  function poly(pts) { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); }
  function clipText(text, max) {
    if (ctx.measureText(text).width <= max) return text;
    let s = text;
    while (s.length > 1 && ctx.measureText(s + '…').width > max) s = s.slice(0, -1);
    return s + '…';
  }
  function eyes(x, y, R, mode, gx, gy, blink, a) {
    const ex = 0.21 * R, ey = -0.06 * R, er = Math.max(1.05, R * 0.085);
    ctx.fillStyle = ctx.strokeStyle = ink(a); ctx.lineWidth = Math.max(1, er * 0.95); ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      const cx = x + s * ex + gx, cy = y + ey + gy;
      ctx.beginPath();
      if (mode === 'closed') { ctx.moveTo(cx - er * 1.4, cy + er); ctx.lineTo(cx + er * 1.4, cy + er); ctx.stroke(); }
      else if (mode === 'smile') { ctx.arc(cx, cy + er * 1.3, er * 1.7, Math.PI * 1.18, Math.PI * 1.82); ctx.stroke(); }
      else { ctx.ellipse(cx, cy, er, Math.max(0.3, er * (1 - blink)), 0, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  /* 직원 위의 느낌표. 막대 하나와 점 하나다 */
  function bang(x, y, R, s, life1, now, still) {
    const k = still || first ? 1 : Math.min(1, (now - (life1.popAt ?? -1e9)) / M.popMs);
    const e = 1 + 2.70158 * Math.pow(k - 1, 3) + 1.70158 * Math.pow(k - 1, 2);
    const h = Math.max(8, R * 0.95) * e, lw = Math.max(1.5, R * 0.16);
    const by = y - R - 6 - (s.status === 'asked' && !still ? Math.abs(Math.sin(now * Math.PI / M.bangPeriod)) * M.bangPx : 0);
    ctx.strokeStyle = ctx.fillStyle = ink(0.95); ctx.lineWidth = lw; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, by - h); ctx.lineTo(x, by - h * 0.38); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, by - lw * 0.2, lw * 0.62 * Math.min(1, e), 0, Math.PI * 2); ctx.fill();
  }
  function orb(x, y, R, s, now, t3, still) {
    const L = lookOf(s.status), one = life.get(s.id), isHot = hot.staff === s.id || over.staff === s.id;
    ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fillStyle = '#000'; ctx.fill();
    const g = ctx.createRadialGradient(x - R * 0.3, y - R * 0.38, 0, x - R * 0.3, y - R * 0.38, R * 1.15);
    g.addColorStop(0, ink(L.glow * (0.4 + 0.6 * t3))); g.addColorStop(1, ink(0));
    ctx.fillStyle = g; ctx.fill();
    // 일하는 중은 테두리 밝기만 천천히 오간다(빛줄기 · 고리 없음)
    let rim = L.rim;
    if (s.status === 'working') rim = still ? (M.rimLow + M.rimHigh) / 2 : M.rimLow + (M.rimHigh - M.rimLow) * (0.5 + 0.5 * Math.sin(now * 2 * Math.PI / M.rimPeriod + (one?.phase || 0)));
    ctx.strokeStyle = ink(isHot ? Math.max(rim, 0.85) : rim); ctx.lineWidth = s.status === 'asked' ? 1.3 : 1;
    ctx.stroke();
    if (R < 5) return;
    let gx = 0, gy = 0, mode = L.mode === 'look' ? 'open' : L.mode;
    if (L.mode === 'look') {
      const dx = ptr.x - x, dy = ptr.y - y, m = Math.hypot(dx, dy) || 1, k = ptr.x < -9000 || still ? 0 : Math.min(1, m / 120) * R * M.look;
      gx = dx / m * k; gy = dy / m * k;
    } else if (mode === 'open') { gy = R * 0.16; gx = still ? 0 : Math.sin(now * 2 * Math.PI / M.gazePeriod + (one?.phase || 0)) * R * M.gaze; }
    eyes(x, y, R, mode, gx, gy, one?.blink || 0, L.eye);
    if (s.alert) bang(x, y, R, s, one || {}, now, still);
  }
  /* 도우미: 구 오른쪽 아래에 꽉 찬 작은 점, 셋까지. 움직이지 않는다 */
  function helpers(x, y, R, n) {
    const r = Math.max(1.6, R * 0.14);
    ctx.fillStyle = ink(0.7);
    for (let i = 0; i < Math.min(3, n); i++) { ctx.beginPath(); ctx.arc(x + R + 4 + r + i * (r * 2 + 3), y + R * 0.55, r, 0, Math.PI * 2); ctx.fill(); }
  }

  function draw(now = clock()) {
    lastDraw = now;
    if (!ctx || !W || !H) return;
    const still = reduced();
    const dt = Math.min(400, Math.max(0, now - (draw.last ?? now))); draw.last = now;
    view += (viewTo - view) * (still ? 1 : 1 - Math.exp(-dt / M.viewTau));
    if (Math.abs(viewTo - view) < 0.001) view = viewTo;
    ctx.clearRect(0, 0, W, H);
    zonesOnScreen = []; staffOnScreen = [];
    if (!layout.length) return;
    const t3 = view * view * (3 - 2 * view), slab = SLAB * t3;
    setCam(view);
    if (!fit()) return;
    ctx.font = '400 12.5px SUIT, "Malgun Gothic", sans-serif'; ctx.textBaseline = 'alphabetic';
    const order = [...layout].sort((a, b) => P0(0, 0, a.rect.z0)[2] - P0(0, 0, b.rect.z0)[2]);
    // 이름표 폭. 한 장면 안에서는 빠진 수를 한 꼴로 적는다: 어느 구역이든 긴 꼴이 안 들어가면 모두 짧은 꼴이다(검수 solio-office-ga1b-20261122 F2)
    const labelFits = z => { const q = z.rect, y = z.kind === 'dept' ? slab : 0, room = Math.max(24, P(q.x1 - 0.2, y, q.z1 - 0.2)[0] - P(q.x0 + 0.2, y, q.z1 - 0.2)[0]); return t => ctx.measureText(t).width <= room; };
    const shortForm = floorShortForm(layout, labelFits);
    for (const z of order) {
      const q = z.rect, hotZ = hot.zone === z.key || over.zone === z.key || isOpen(z.key);
      const y = z.kind === 'dept' ? slab : 0;
      const topF = [P(q.x0, y, q.z0), P(q.x1, y, q.z0), P(q.x1, y, q.z1), P(q.x0, y, q.z1)];
      if (z.kind === 'dept' && slab > 0.004) {
        const base = [P(q.x0, 0, q.z0), P(q.x1, 0, q.z0), P(q.x1, 0, q.z1), P(q.x0, 0, q.z1)];
        poly(base); ctx.strokeStyle = ink(hotZ ? 0.2 : 0.07); ctx.lineWidth = 1; ctx.stroke();
        ctx.beginPath(); for (let i = 0; i < 4; i++) { ctx.moveTo(base[i][0], base[i][1]); ctx.lineTo(topF[i][0], topF[i][1]); } ctx.stroke();
      }
      poly(topF);
      ctx.fillStyle = hotZ ? 'rgb(13,13,12)' : z.kind === 'dept' ? 'rgb(5,5,5)' : 'rgb(3,3,3)'; ctx.fill();
      ctx.strokeStyle = ink(hotZ ? 0.5 : z.urgent ? 0.3 : z.kind === 'dept' ? 0.13 : 0.09); ctx.lineWidth = 1; ctx.stroke();
      zonesOnScreen.push({ key: z.key, pts: topF });
      const lp = P(q.x0 + 0.2, y, q.z1 - 0.2), lr = P(q.x1 - 0.2, y, q.z1 - 0.2);
      ctx.fillStyle = ink(hotZ || z.urgent ? 0.95 : 0.5);
      const room = Math.max(24, lr[0] - lp[0]), label = floorZoneLabel(z, labelFits(z), shortForm);
      ctx.fillText(label.clip ? clipText(label.text, room) : label.text, lp[0], lp[1]);
      // 빈 자리는 가는 짧은 선 하나다
      for (let i = z.staff.length; i < z.spots.length; i++) {
        const c = z.spots[i], a = P(c.x - 0.17, y, c.z + 0.3), b = P(c.x + 0.17, y, c.z + 0.3);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.strokeStyle = ink(hotZ ? 0.22 : 0.12); ctx.lineWidth = 1; ctx.stroke();
      }
    }
    const list = [];
    for (const z of layout) {
      const base = z.kind === 'dept' ? slab : 0;
      z.staff.slice(0, z.spots.length).forEach((s, i) => {
        const c = z.spots[i], L = lookOf(s.status), y = base + R0 + L.lift * (0.25 + 0.75 * t3), p = P(c.x, y, c.z);
        list.push({ s, c, base, y, p, R: R0 * cam.S * p[3], depth: p[2] });
        const one = life.get(s.id);
        if (one && !still) {
          if (one.blink > 0) one.blink = Math.max(0, one.blink - dt / M.blinkMs);
          else if (now > one.nextBlink) { one.blink = 1; one.nextBlink = now + M.blinkMin + Math.random() * M.blinkSpan; }
        }
      });
    }
    list.sort((a, b) => a.depth - b.depth);
    for (const { s, c, base, y, p, R } of list) {
      const one = life.get(s.id);
      const alpha = still || first || !one ? 1 : Math.min(1, (now - one.bornAt) / M.fadeMs);
      ctx.save(); ctx.globalAlpha = alpha;
      if (t3 > 0.02 && y - R0 - base > 0.02) { const b = P(c.x, base, c.z), a = P(c.x, y - R0, c.z); ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(a[0], a[1]); ctx.strokeStyle = ink(0.16 * t3); ctx.lineWidth = 1; ctx.stroke(); }
      if (s.subagents > 0) helpers(p[0], p[1], R, s.subagents);
      orb(p[0], p[1], R, s, now, t3, still);
      ctx.restore();
      staffOnScreen.push({ id: s.id, zone: s.zone, x: p[0], y: p[1], r: R });
    }
    first = false;
  }
  function loop(t) {
    frame = 0;
    if (!shown || reduced()) return;
    frame = raf(loop);
    if (t - lastDraw >= M.frameMs) draw(t);
  }
  function kick() {
    if (!shown) return;
    if (reduced()) { if (frame) { unraf(frame); frame = 0; } draw(); return; }
    if (!frame) frame = raf(loop);
  }
  function resize() {
    if (!canvas) return;
    const box = canvas.parentElement?.getBoundingClientRect?.() || { width: 0, height: 0 };
    const dpr = Math.min(2, Number(win.devicePixelRatio) || 1);
    W = Math.round(box.width); H = Math.round(box.height);
    const cw = Math.max(1, Math.round(W * dpr)), ch = Math.max(1, Math.round(H * dpr));
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (shown) draw();
  }
  const ro = typeof win.ResizeObserver === 'function' && canvas?.parentElement ? new win.ResizeObserver(() => resize()) : null;
  ro?.observe(canvas.parentElement);

  /* 손: 부서에 다가가면 그 부서의 줄이 열리고(화면이 정한 머무는 시간 뒤), 직원을 가리키면 그 직원의 줄이 밝아진다 */
  function inside(pts, x, y) { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
  function hit(x, y) {
    let st = null;
    for (const s of staffOnScreen) if (Math.hypot(x - s.x, y - s.y) < s.r + 6) st = s;
    let zone = st ? st.zone : null;
    // 「그 밖」 구역은 줄이 따로 없어 누를 곳이 아니다. 그 안의 직원은 제 부서로 간다(카본 A4)
    if (!zone) for (const q of zonesOnScreen) if (q.key !== 'other' && inside(q.pts, x, y)) zone = q.key;
    return { zone, staff: st ? st.id : null };
  }
  const at = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const onMove = e => {
    const p = at(e); ptr = p;
    const h = hit(p.x, p.y);
    canvas.style.cursor = h.zone ? 'pointer' : '';
    if (h.zone !== over.zone || h.staff !== over.staff) { over = h; if (reduced()) draw(); onHover(h.zone, h.staff, e); }
  };
  const onLeave = e => { ptr = { x: -1e4, y: -1e4 }; canvas.style.cursor = ''; if (over.zone || over.staff) { over = { zone: null, staff: null }; if (reduced()) draw(); onHover(null, null, e); } };
  const onClick = e => { const p = at(e), h = hit(p.x, p.y); onPress(h.zone, h.staff); };
  canvas?.addEventListener?.('pointermove', onMove);
  canvas?.addEventListener?.('pointerleave', onLeave);
  canvas?.addEventListener?.('click', onClick);

  return {
    /* 장면을 받는다. 같은 장면이면 아무것도 하지 않는다. 보기는 손님이 바꾼 때(viewSeq가 바뀜)만 옮겨 가고, 그 밖에는 바로 그 각도다 */
    setScene(next) {
      const s = next && typeof next === 'object' ? next : { view: 'tilted', viewSeq: 0, seats: 1, zones: [] };
      const key = JSON.stringify(s);
      if (key === sceneKey) return;
      sceneKey = key; scene = s;
      const want = s.view === 'top' ? 0 : 1;
      if (viewSeq === null || s.viewSeq === viewSeq || reduced()) { view = viewTo = want; } else viewTo = want;
      viewSeq = s.viewSeq;
      layout = floorLayout(s, layout);
      const t = clock(), ids = new Set();
      for (const z of layout) for (const st of z.staff) {
        ids.add(st.id);
        const one = life.get(st.id);
        if (!one) life.set(st.id, { bornAt: first ? -1e9 : t, blink: 0, nextBlink: t + 1500 + Math.random() * 5000, phase: Math.random() * Math.PI * 2, alert: st.alert, popAt: st.alert && !first ? t : -1e9 });
        else { if (st.alert && !one.alert) one.popAt = t; one.alert = st.alert; }
      }
      for (const id of [...life.keys()]) if (!ids.has(id)) life.delete(id);
      if (shown) { draw(); kick(); }
    },
    setHot(next) { const h = { zone: next?.zone || null, staff: next?.staff || null }; if (h.zone === hot.zone && h.staff === hot.staff) return; hot = h; if (shown && reduced()) draw(); },
    /* 방이 보이는 동안만 그린다 */
    show(on) {
      const want = !!on;
      if (want === shown) { if (want) kick(); return; }
      shown = want;
      if (!want) { if (frame) { unraf(frame); frame = 0; } first = true; return; }
      resize();
      draw();
      kick();
    },
    redraw() { if (shown) draw(); },
    zones: () => layout.map(z => z.key),
    view: () => (viewTo ? 'tilted' : 'top'),
    dispose() {
      shown = false;
      if (frame) { unraf(frame); frame = 0; }
      ro?.disconnect();
      canvas?.removeEventListener?.('pointermove', onMove);
      canvas?.removeEventListener?.('pointerleave', onLeave);
      canvas?.removeEventListener?.('click', onClick);
    },
  };
}
