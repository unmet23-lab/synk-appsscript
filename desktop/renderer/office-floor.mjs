// 솔리오 「사무실」 방의 사무실 그림(구현설계 11.2, 시안 사무실.html 553~755행의 그리기를 옮겼다). 캔버스 하나에 부서 좌대, 자리, 직원(구의 작은 분신)을 그린다.
// 유호님 11-20 취향 기록에 따라 시안에서 바꾼 것: 빈 자리의 동그라미 대신 가는 짧은 선 하나, 승인 물음의 물결 고리 없음, 도우미는 구 곁의 꽉 찬 작은 점(셋까지)을 가만히 둔다.
// 손을 따라 기우는 카메라, 위아래로 뜨는 몸, 몸을 도는 빛줄기, 구에서 날아오는 새 직원을 뺐다.
// 11-23: 직원은 둘레 선 대신 왼쪽 위에서 빛을 받은 검은 구로 칠하고 눈이 작게 빛난다(첫 팀 고르기 6판의 구운 직원을 따름, 맹검이 「와이어프레임」을 짚음).
// 움직이는 것과 그 크기(이것 말고는 움직이지 않는다):
//  · 눈 깜빡임: 직원마다 2.4~7.6초에 한 번, 0.12초쯤 눈을 감았다 뜬다.
//  · 눈길: 승인을 물은 직원은 손(포인터) 쪽을 본다. 눈의 점이 구 반지름의 20% 안에서만 옮긴다. 일하는 직원의 눈은 9초 주기로 반지름의 8%만큼 좌우로 흐른다.
//  · 일하는 중: 테두리 밝기가 3.2초 주기로 0.38~0.62 사이를 천천히 오간다. 몸은 그 자리에 있다.
//  · 느낌표: 알림이 새로 붙을 때 0.42초 동안 커지며 나오고, 승인을 물은 직원의 느낌표는 1.6초 주기로 2.5px 안에서 위아래로 뛴다.
//  · 새 직원: 제자리에서 0.3초 동안 나타난다.
//  · 보기 바꾸기: 손님이 설정에서 「비스듬히」 · 「위에서」를 바꿀 때만 카메라가 한 번 옮겨 간다(0.7초쯤).
//  · 스킨 바꾸기(꾸미기, 솔리오_사무실스킨_20261123/PC앱_설계.md 5절): 손님이 스킨을 고를 때(skinSeq가 바뀔 때)만, 바닥부터 부서 자리까지 뒤에서 앞으로
//    0.06초 간격으로 0.38초씩 앞 스킨에서 새 스킨으로 겹쳐 넘어간다. 판이 늦게 와서 스킨이 바뀌면 움직이지 않는다.
//  · 탁상 등(호두나무 서재): 부서에 일하는 직원이 서거나 모두 쉬면 0.45초에 걸쳐 켜지고 꺼진다. 첫 그림에서는 바로다.
//  · 스킨을 바꾸거나 첫 모자를 씌우면 바닥과 모자까지 들어가게 그림 크기를 한 번 바로 맞춘다(움직이지 않는다).
//  · 움직임 줄이기가 켜져 있으면 모두 멈추고, 장면이 바뀔 때마다 한 번만 그린다.
// 방이 보이는 동안만 그린다(show). 화면 밀도는 2배까지만 쓴다. 모듈 맨 위에서는 DOM을 건드리지 않는다.

import { countWord } from './office-model.mjs';

export const FLOOR_MOTION = Object.freeze({
  blinkMin: 2400, blinkSpan: 5200, blinkMs: 120,
  gazePeriod: 9000, gaze: 0.08, look: 0.2,
  rimPeriod: 3200, rimLow: 0.38, rimHigh: 0.62,
  bangPeriod: 1600, bangPx: 2.5, popMs: 420,
  fadeMs: 300, viewTau: 230, frameMs: 33,
  skinMs: 380, skinStep: 60, lampTau: 450,
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
/* 스킨마다의 재질(시안 스킨.html의 SK, 미학 맹검 세 번으로 고친 값). rim은 직원 테두리의 빛, label은 부서 이름의 색이다 */
const SKIN = Object.freeze({
  black: { slab: SLAB, rim: INK, label: INK, boost: 1 },
  walnut: {
    slab: 0.12, boost: 1.25, rim: '255,221,182', label: '255,232,206', shadow: 0.55, mat: 'rgba(0,0,0,.26)',
    floor: { thick: 0.16, top: ['#1b120b', '#2a1c12'], front: '#120b06', left: '#0b0703', edge: 'rgba(255,214,170,.16)', seam: 'rgba(0,0,0,.6)', grain: 'rgba(255,212,168,.05)', tone: 'rgba(255,196,140,.028)' },
    ped: { top: ['#452c1c', '#5d3e28'], front: '#2a190e', left: '#1f1209', edge: 'rgba(255,224,190,.36)', line: 'rgba(255,224,190,.10)', hot: 'rgba(255,236,212,.85)', urgent: 'rgba(255,236,212,.6)', hotFill: 'rgba(255,220,180,.05)', grain: 'rgba(255,220,182,.07)' },
  },
});
export const FLOOR_SKINS = Object.freeze(Object.keys(SKIN));
const LAMP_ON = new Set(['working', 'asked', 'silent']);
const FLOOR_PAD = 0.45;
const PLANE_MIN_S = 40, PLANE_PX = 29, PLANE_FONT = `500 ${PLANE_PX}px SUIT, "Malgun Gothic", sans-serif`;
const rng = seed => () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const mixRGB = (a, b, k) => { if (a === b || k <= 0) return a; if (k >= 1) return b; const x = a.split(',').map(Number), y = b.split(',').map(Number); return x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(','); };
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
    // 긴 꼴에는 「직원」을 늘 붙인다. 「부서 없는 일 · 스물둘 더」는 무엇이 더 있는지 몰랐다(11-23 맹검). 짧은 꼴은 좁은 이름표에 들어가는 것이 먼저라 전처럼 둔다
    const who = z.kind === 'other' ? '직원 ' : '';
    const forms = [['long', ' · 직원 ' + countWord(n) + ' 더'], ['short', (who ? ' · ' + who : ' ') + '+' + n]].filter(([f]) => !short || f === 'short');
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
  // 꾸미기: 지금 스킨과 넘어가는 중인 앞 스킨, 부서마다 탁상 등의 밝기, 나뭇결 모음
  let skinFrom = 'black', skinTo = 'black', skinT0 = -1e9, skinSeq = null, rectKey = '';
  const lampK = new Map(), TEX = new Map();

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
  /* fl: 스킨의 바닥 한 판(있으면 그 두께까지 잰다). hatOn: 모자를 쓴 직원이 있으면 모자와 그 위의 느낌표까지 잰다(설계 검토 12) */
  function fit(fl = null, hatOn = false) {
    let a = 1e9, b = -1e9, c = 1e9, e = -1e9;
    const take = (x, y, zz) => { const p = P0(x, y, zz); a = Math.min(a, p[0]); b = Math.max(b, p[0]); c = Math.min(c, p[1]); e = Math.max(e, p[1]); };
    for (const z of layout) for (const x of [z.rect.x0, z.rect.x1]) for (const zz of [z.rect.z0, z.rect.z1]) for (const y of [0, hatOn ? 1.45 : 1.05]) take(x, y, zz);
    if (fl) for (const x of [fl.x0, fl.x1]) for (const zz of [fl.z0, fl.z1]) for (const y of [0, -SKIN.walnut.floor.thick]) take(x, y, zz);
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
      else {
        // 뜬 눈은 작게 빛난다(구운 직원의 눈). 빛은 눈 둘레의 흐린 번짐 하나이고 고리를 긋지 않는다
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, er * 3.2);
        glow.addColorStop(0, ink(a * 0.32)); glow.addColorStop(1, ink(0));
        ctx.fillStyle = glow; ctx.fillRect(cx - er * 3.2, cy - er * 3.2, er * 6.4, er * 6.4);
        ctx.fillStyle = ink(a);
        ctx.beginPath(); ctx.ellipse(cx, cy, er, Math.max(0.3, er * (1 - blink)), 0, 0, Math.PI * 2); ctx.fill();
      }
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
  /* rimInk · boost: 스킨의 테두리 빛과 그 세기. 꾸미기 줄에서 고른 직원(picked)은 테두리가 밝고 눈웃음을 짓는다 */
  function orb(x, y, R, s, now, t3, still, rimInk = INK, boost = 1) {
    const L = lookOf(s.status), one = life.get(s.id), isHot = hot.staff === s.id || over.staff === s.id || !!s.picked;
    const oink = a => `rgba(${rimInk},${a})`;
    // 몸: 왼쪽 위에서 빛을 받은 검은 구(첫 팀 고르기 6판의 구운 직원, 유호님 11-23 「깔끔하다」). 테두리를 고르게 긋지 않는다 —
    // 둘레 전체에 같은 선을 그으면 선으로 그린 밑그림(고리)처럼 보였다(11-23 맹검 「와이어프레임」)
    ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fillStyle = '#000'; ctx.fill();
    const lit = 0.4 + 0.6 * t3;
    const g = ctx.createRadialGradient(x - R * 0.36, y - R * 0.44, R * 0.04, x - R * 0.12, y - R * 0.14, R * 1.2);
    g.addColorStop(0, oink(Math.min(0.46, (0.2 + L.glow * 0.8) * lit)));
    g.addColorStop(0.42, oink((0.05 + L.glow * 0.22) * lit));
    g.addColorStop(1, oink(0.012));
    ctx.fillStyle = g; ctx.fill();
    // 일하는 중은 빛 받은 쪽 가장자리의 밝기만 천천히 오간다(빛줄기 · 고리 없음). 가장자리 빛은 왼쪽 위에서 오른쪽 아래로 사라진다
    let rim = L.rim;
    if (s.status === 'working') rim = still ? (M.rimLow + M.rimHigh) / 2 : M.rimLow + (M.rimHigh - M.rimLow) * (0.5 + 0.5 * Math.sin(now * 2 * Math.PI / M.rimPeriod + (one?.phase || 0)));
    const edge = Math.min(1, (isHot ? Math.max(rim, 0.85) : rim) * boost);
    const e = ctx.createLinearGradient(x - R * 0.8, y - R * 0.9, x + R * 0.7, y + R * 0.8);
    e.addColorStop(0, oink(edge)); e.addColorStop(0.5, oink(edge * 0.28)); e.addColorStop(1, oink(isHot ? edge * 0.22 : 0));
    ctx.strokeStyle = e; ctx.lineWidth = s.status === 'asked' ? 1.3 : 1;
    ctx.stroke();
    if (R < 5) return;
    let gx = 0, gy = 0, mode = L.mode === 'look' ? 'open' : L.mode;
    if (s.picked && s.status !== 'asked') mode = 'smile';
    if (L.mode === 'look') {
      const dx = ptr.x - x, dy = ptr.y - y, m = Math.hypot(dx, dy) || 1, k = ptr.x < -9000 || still ? 0 : Math.min(1, m / 120) * R * M.look;
      gx = dx / m * k; gy = dy / m * k;
    } else if (mode === 'open') { gy = R * 0.16; gx = still ? 0 : Math.sin(now * 2 * Math.PI / M.gazePeriod + (one?.phase || 0)) * R * M.gaze; }
    eyes(x, y, R, mode, gx, gy, one?.blink || 0, L.eye);
    const lift = hat(x, y, R, s.hat);
    if (s.alert) bang(x, y - lift, R, s, one || {}, now, still);
  }
  /* 도우미: 구 오른쪽 아래에 꽉 찬 작은 점, 셋까지. 움직이지 않는다 */
  function helpers(x, y, R, n) {
    const r = Math.max(1.6, R * 0.14);
    ctx.fillStyle = ink(0.7);
    for (let i = 0; i < Math.min(3, n); i++) { ctx.beginPath(); ctx.arc(x + R + 4 + r + i * (r * 2 + 3), y + R * 0.55, r, 0, Math.PI * 2); ctx.fill(); }
  }

  /* ── 꾸미기의 그리기(PC앱_설계.md 5절, 시안 스킨.html 985~1240행을 옮겼다) ──
     스킨은 바닥 · 부서 자리 · 빛만 바꾸고, 직원은 늘 검은 구다. 모자는 머리 위 소품이고 구의 모양 · 색 · 눈은 그대로다 */
  const HQ = (q, y) => [P(q.x0, y, q.z0), P(q.x1, y, q.z0), P(q.x1, y, q.z1), P(q.x0, y, q.z1)];
  const area = f => { let a = 0; for (let i = 0; i < f.length; i++) { const p = f[i], n = f[(i + 1) % f.length]; a += p[0] * n[1] - n[0] * p[1]; } return a / 2; };
  /* 상자의 옆면 가운데 보이는 것만(뒤로 돈 면은 그리지 않는다) */
  function faces(q, y0, y1) {
    const b = HQ(q, y0), t = HQ(q, y1), out = [];
    [['back', 0, 1], ['right', 1, 2], ['front', 2, 3], ['left', 3, 0]].forEach(([kind, i, j]) => { const f = [t[j], t[i], b[i], b[j]]; if (area(f) > 0.5) out.push({ kind, pts: f }); });
    return out;
  }
  const midOf = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  function depthGrad(top, c0, c1) { const a = midOf(top[0], top[1]), b = midOf(top[3], top[2]), g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]); g.addColorStop(0, c0); g.addColorStop(1, c1); return g; }
  function seg(a, b, color, w = 1) { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke(); }
  function wpath(pts, y) { ctx.beginPath(); pts.forEach(([x, z], i) => { const p = P(x, y, z); if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); }
  /* 바닥 위에 퍼지는 둥근 빛이나 그림자. 바닥의 원이 비스듬히 보이는 만큼 납작하게 그린다 */
  function pool(x, y, z, rad, rgb, alpha, op) {
    const p = P(x, y, z), R = rad * cam.S * p[3];
    if (R < 1 || alpha < 0.003) return;
    ctx.save(); if (op) ctx.globalCompositeOperation = op;
    ctx.translate(p[0], p[1]); ctx.scale(1, Math.max(0.22, cam.sa));
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R); g.addColorStop(0, `rgba(${rgb},${alpha})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  /* 재질의 결: 나뭇결, 마루의 널과 이음매. 세계 좌표로 한 번 만들어 두고, 배치가 바뀌면 비운다(설계 검토 11) */
  function tex(id, part, q) {
    const key = [id, part, q.x0, q.z0, q.x1, q.z1].map(v => (typeof v === 'number' ? v.toFixed(2) : v)).join('|');
    if (TEX.has(key)) return TEX.get(key);
    const out = [], r = rng(Math.round(Math.abs(q.x0 * 31 + q.z0 * 17) * 100) + part.length * 7 + id.length);
    const L = (c, pts, w) => out.push({ c, pts, w }), F = (c, pts) => out.push({ c, pts, fill: true });
    const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
    if (id === 'walnut') {
      const pl = part === 'floor' ? 0.44 : 0.2;
      for (let z = q.z0; z < q.z1 - 0.02; z += pl) {
        const z1 = Math.min(q.z1, z + pl);
        if (part === 'floor') {
          if (r() < 0.5) F('tone', rect(q.x0, z, q.x1, z1));
          if (z > q.z0) L('seam', [[q.x0, z], [q.x1, z]]);
          let x = q.x0 + 0.4 + r() * 2.4;
          while (x < q.x1 - 0.4) { L('seam', [[x, z], [x, z1]]); x += 2.3 + r() * 1.9; }
        }
        for (const f of part === 'floor' ? [0.3, 0.7] : [0.5]) {
          const zz = z + (z1 - z) * f, ph = r() * 6, amp = part === 'floor' ? 0.03 : 0.016, pts = [];
          for (let x = q.x0; x <= q.x1 + 0.01; x += 0.4) pts.push([x, zz + Math.sin(x * 1.3 + ph) * amp]);
          L('grain', pts, 0.8);
        }
      }
    }
    TEX.set(key, out);
    return out;
  }
  function paintTex(id, part, q, y) {
    const st = part === 'floor' ? SKIN[id].floor : SKIN[id].ped;
    for (const t of tex(id, part, q)) {
      wpath(t.pts, y);
      if (t.fill) { ctx.closePath(); ctx.fillStyle = st[t.c]; ctx.fill(); } else { ctx.strokeStyle = st[t.c]; ctx.lineWidth = t.w || 1; ctx.stroke(); }
    }
  }
  /* 스킨의 바닥: 부서 자리와 부서 없는 일의 자리까지 덮는 마루 한 판. 등이 켜진 부서 아래에 둥근 빛이 번진다 */
  function paintFloor(id, a, q, t3) {
    const f = SKIN[id].floor;
    if (!f || a < 0.003) return;
    ctx.save(); ctx.globalAlpha *= a;
    const top = HQ(q, 0);
    if (t3 > 0.02) for (const fc of faces(q, -f.thick * t3, 0)) { poly(fc.pts); ctx.fillStyle = fc.kind === 'front' ? f.front : f.left; ctx.fill(); }
    poly(top); ctx.fillStyle = depthGrad(top, f.top[0], f.top[1]); ctx.fill();
    ctx.save(); poly(top); ctx.clip();
    paintTex(id, 'floor', q, 0);
    for (const z of layout) {
      const lk = lampK.get(z.key) || 0;
      if (z.kind === 'dept' && lk > 0.01) pool((z.rect.x0 + z.rect.x1) / 2, 0, (z.rect.z0 + z.rect.z1) / 2, 3.1, '255,168,92', 0.09 * lk, 'lighter');
    }
    ctx.restore();
    seg(top[3], top[2], f.edge);
    ctx.restore();
  }
  /* 호두나무 책상의 탁상 등. 그 부서에 일하는 직원이 있는 동안만 켜진다 */
  function deskLamp(q, slab, lk, t3) {
    // 책상 뒤 왼쪽 귀퉁이에 낮게 둔다. 시안 자리(0.36 · 0.34, 높이 0.72)에서는 첫 직원의 모자와 등불이 겹쳐 뭉개졌다(미학 맹검 11-23 C137)
    const lx = q.x0 + 0.24, lz = q.z0 + 0.22, b = P(lx, slab, lz), t = P(lx, slab + 0.6, lz), s = 1.4 * cam.S * t[3] / 50;
    if (t3 > 0.3) {
      seg(b, t, 'rgba(16,10,5,.95)', Math.max(1, 1.3 * s));
      ctx.save(); ctx.translate(b[0], b[1]); ctx.scale(1, Math.max(0.3, cam.sa)); ctx.beginPath(); ctx.arc(0, 0, 3.6 * s, 0, Math.PI * 2); ctx.fillStyle = '#1a1009'; ctx.fill(); ctx.restore();
    }
    // 위에서 보면 등갓은 위에서 본 꽉 찬 원이다(옆모습을 그대로 두면 시점이 어긋난다, 미학 맹검 2회차). 고리를 쓰지 않는다
    if (t3 <= 0.3) {
      const r = 4.6 * s;
      if (lk > 0.01) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(t[0], t[1], 0, t[0], t[1], r * 3.2); g.addColorStop(0, `rgba(255,196,128,${0.45 * lk})`); g.addColorStop(1, 'rgba(255,196,128,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(t[0], t[1], r * 3.2, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
      ctx.beginPath(); ctx.arc(t[0], t[1], r, 0, Math.PI * 2); ctx.fillStyle = '#21150c'; ctx.fill();
      return;
    }
    const hw0 = 2.2 * s, hw1 = 6.2 * s, h0 = 5.4 * s, cx = t[0], cy = t[1], by = cy + h0 * 0.45;
    ctx.beginPath(); ctx.moveTo(cx - hw0, cy - h0 * 0.55); ctx.lineTo(cx + hw0, cy - h0 * 0.55); ctx.lineTo(cx + hw1, by); ctx.lineTo(cx - hw1, by); ctx.closePath();
    ctx.fillStyle = '#21150c'; ctx.fill(); ctx.strokeStyle = 'rgba(255,224,190,.18)'; ctx.lineWidth = 1; ctx.stroke();
    if (lk > 0.01) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(cx, by, 0, cx, by, 16 * s); g.addColorStop(0, `rgba(255,196,128,${0.55 * lk})`); g.addColorStop(1, 'rgba(255,196,128,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, by, 16 * s, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      seg([cx - hw1, by], [cx + hw1, by], `rgba(255,220,168,${0.9 * lk})`, Math.max(1, 1.3 * s));
    }
  }
  /* 호두나무 책상(부서 자리) */
  function paintPed(id, a, z, q, slab, hotZ, t3) {
    const p = SKIN[id].ped, lk = lampK.get(z.key) || 0;
    ctx.save(); ctx.globalAlpha *= a;
    const top = HQ(q, slab);
    if (slab > 0.004 && t3 > 0.02) for (const fc of faces(q, 0, slab)) { poly(fc.pts); ctx.fillStyle = fc.kind === 'front' ? p.front : p.left; ctx.fill(); ctx.strokeStyle = p.line; ctx.lineWidth = 1; ctx.stroke(); }
    poly(top); ctx.fillStyle = depthGrad(top, p.top[0], p.top[1]); ctx.fill();
    ctx.save(); poly(top); ctx.clip();
    paintTex(id, 'ped', q, slab);
    pool(q.x0 + 1, slab, q.z0 + 0.8, 2.1, '255,176,100', 0.28 * lk, 'lighter');
    if (hotZ) { ctx.fillStyle = p.hotFill; poly(top); ctx.fill(); }
    ctx.restore();
    poly(top); ctx.strokeStyle = hotZ ? p.hot : z.urgent ? p.urgent : p.line; ctx.lineWidth = 1; ctx.stroke();
    seg(top[3], top[2], hotZ ? p.hot : p.edge); // 앞 모서리에 빛이 맺힌다
    deskLamp(q, slab, lk, t3);
    ctx.restore();
  }
  /* 부서 없는 일과 「그 밖」의 자리: 스킨에서는 바닥 위의 깔개다 */
  function paintMat(id, a, z, q, hotZ) {
    ctx.save(); ctx.globalAlpha *= a;
    const top = HQ({ x0: q.x0 + 0.1, x1: q.x1 - 0.1, z0: q.z0 + 0.1, z1: q.z1 - 0.1 }, 0.004);
    poly(top); ctx.fillStyle = SKIN[id].mat; ctx.fill();
    ctx.strokeStyle = `rgba(${SKIN[id].label},${hotZ ? 0.5 : z.urgent ? 0.36 : 0.22})`; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }
  /* 기본 「검정」의 자리: 검은 판과 가는 선. 11-23부터 부서 좌대는 옆면을 칠하고 윗면이 뒤에서 앞으로 어두워져 두께 있는 판으로 보인다
     (선만 있던 판은 맹검이 「얇은 회색 선 사각형」 · 「와이어프레임」이라 했다) */
  function zoneBlack(a, z, q, slab, hotZ) {
    ctx.save(); ctx.globalAlpha *= a;
    const y = z.kind === 'dept' ? slab : 0, topF = HQ(q, y);
    if (z.kind === 'dept' && slab > 0.004) {
      for (const fc of faces(q, 0, slab)) { poly(fc.pts); ctx.fillStyle = fc.kind === 'front' ? 'rgb(13,13,12)' : 'rgb(8,8,8)'; ctx.fill(); }
      const base = HQ(q, 0);
      poly(base); ctx.strokeStyle = ink(hotZ ? 0.2 : 0.07); ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); for (let i = 0; i < 4; i++) { ctx.moveTo(base[i][0], base[i][1]); ctx.lineTo(topF[i][0], topF[i][1]); } ctx.stroke();
    }
    poly(topF);
    ctx.fillStyle = hotZ ? 'rgb(20,20,19)' : z.kind === 'dept' ? depthGrad(topF, 'rgb(17,17,16)', 'rgb(7,7,7)') : 'rgb(5,5,5)'; ctx.fill();
    ctx.strokeStyle = ink(hotZ ? 0.5 : z.urgent ? 0.3 : z.kind === 'dept' ? 0.13 : 0.09); ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }
  /* 바닥 위의 글: 그 자리의 바닥 축(세계의 x, z)대로 눕혀 쓴다. 화면에서 12.5px쯤으로 보이게 키를 맞춘다. 위에서 보면 그대로 똑바르다.
     스킨에서만 쓴다. 똑바른 글은 비스듬한 책상의 앞 모서리를 가로질렀다(미학 맹검 11-23 C014, 시안도 같은 지적으로 눕혔다) */
  function planeText(text, x, y, z, max) {
    ctx.save();
    ctx.font = PLANE_FONT;
    const u = 12.5 / PLANE_PX / Math.max(1, cam.S), fit = max / u;
    let s = text;
    if (ctx.measureText(s).width > fit) { while (s.length > 1 && ctx.measureText(s + '…').width > fit) s = s.slice(0, -1); s += '…'; }
    const o = P(x, y, z), ex = P(x + u, y, z), ez = P(x, y, z + u);
    ctx.translate(o[0], o[1]);
    ctx.transform(ex[0] - o[0], ex[1] - o[1], ez[0] - o[0], ez[1] - o[1], 0, 0);
    ctx.fillText(s, 0, 0);
    ctx.restore();
  }
  /* 부서 이름과 빈 자리의 가는 선. 스킨마다 글의 색이 다르다 */
  function zoneText(id, a, z, q, y, hotZ, labelFits, shortForm) {
    const lc = SKIN[id].label, dark = id === 'black';
    ctx.save(); ctx.globalAlpha *= a;
    const lp = P(q.x0 + 0.2, y, q.z1 - 0.2), lr = P(q.x1 - 0.2, y, q.z1 - 0.2);
    ctx.fillStyle = `rgba(${lc},${hotZ || z.urgent ? 0.95 : dark ? 0.5 : 0.72})`;
    const room = Math.max(24, lr[0] - lp[0]), label = floorZoneLabel(z, labelFits(z), shortForm);
    // 그림이 작으면(좁은 창) 눕힌 글이 뭉개져 똑바로 쓴다(미학 맹검 2회차)
    if (dark || cam.S < PLANE_MIN_S) ctx.fillText(label.clip ? clipText(label.text, room) : label.text, lp[0], lp[1]);
    else planeText(label.text, q.x0 + 0.2, y, q.z1 - 0.2, q.x1 - q.x0 - 0.4);
    // 빈 자리는 가는 짧은 선 하나다
    for (let i = z.staff.length; i < z.spots.length; i++) {
      const c = z.spots[i], s0 = P(c.x - 0.17, y, c.z + 0.3), s1 = P(c.x + 0.17, y, c.z + 0.3);
      seg(s0, s1, `rgba(${lc},${dark ? (hotZ ? 0.22 : 0.12) : (hotZ ? 0.5 : 0.3)})`);
    }
    ctx.restore();
  }
  /* 직원 아래: 자리에 지는 그림자(스킨에만) */
  function underOrb(id, a, c, base, y, t3) {
    const k = SKIN[id];
    if (!k.floor || a < 0.003) return;
    const h = Math.max(0, y - R0 - base), sp = P(c.x, base, c.z), sr = R0 * (1.25 + h * 1.6) * cam.S * sp[3], al = Math.min(0.85, k.shadow * 1.25 * (1 - Math.min(0.5, h * 1.6)) * t3) * a;
    if (sr <= 1 || al <= 0.003) return;
    ctx.save(); ctx.translate(sp[0], sp[1]); ctx.scale(1, Math.max(0.22, cam.sa));
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, sr);
    g.addColorStop(0, `rgba(0,0,0,${al})`); g.addColorStop(0.45, `rgba(0,0,0,${al * 0.55})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, sr, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  function rr(x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
  /* 모자를 그리고, 느낌표를 그만큼 올릴 높이를 돌려준다. 색은 디자인 토큰의 2027 실(버터 · 코랄 · 청금석 · 메도우)이다 */
  function hat(x, y, R, kind) {
    if (!kind || R < 5) return 0;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    let top = 0;
    if (kind === 'beanie') {
      ctx.beginPath(); ctx.ellipse(x, y - R * 0.44, R * 1.0, R * 0.8, 0, Math.PI, Math.PI * 2); ctx.closePath();
      const g = ctx.createLinearGradient(x - R, y - R * 1.2, x + R, y - R * 0.3); g.addColorStop(0, '#FFE08A'); g.addColorStop(1, '#D9A42C'); ctx.fillStyle = g; ctx.fill();
      rr(x - R * 1.05, y - R * 0.6, R * 2.1, R * 0.3, R * 0.12); ctx.fillStyle = '#E3AE33'; ctx.fill(); // 접은 단
      ctx.strokeStyle = 'rgba(126,90,16,.4)'; ctx.lineWidth = Math.max(0.8, R * 0.06);
      for (const f of [-0.6, -0.2, 0.2, 0.6]) { ctx.beginPath(); ctx.moveTo(x + f * R, y - R * 0.56); ctx.lineTo(x + f * R, y - R * 0.34); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(x, y - R * 1.28, R * 0.2, 0, Math.PI * 2); ctx.fillStyle = '#F5C445'; ctx.fill(); // 방울
      top = R * 0.5;
    } else if (kind === 'beret') {
      ctx.translate(x + R * 0.14, y - R * 0.8); ctx.rotate(-0.2);
      ctx.beginPath(); ctx.ellipse(0, 0, R * 1.02, R * 0.36, 0, 0, Math.PI * 2);
      const g = ctx.createLinearGradient(0, -R * 0.36, 0, R * 0.36); g.addColorStop(0, '#D4554A'); g.addColorStop(1, '#8E2620'); ctx.fillStyle = g; ctx.fill();
      ctx.beginPath(); ctx.moveTo(-R * 0.04, -R * 0.32); ctx.lineTo(0, -R * 0.56); ctx.strokeStyle = '#8E2620'; ctx.lineWidth = Math.max(1, R * 0.11); ctx.stroke();
      top = R * 0.25;
    } else if (kind === 'gat') {
      const by = y - R * 0.84;
      ctx.strokeStyle = 'rgba(236,226,206,.36)'; ctx.lineWidth = Math.max(0.7, R * 0.05); // 갓끈
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + s * R * 0.64, by + R * 0.06); ctx.quadraticCurveTo(x + s * R * 0.8, y + R * 0.4, x + s * R * 0.3, y + R * 0.94); ctx.stroke(); }
      ctx.beginPath(); ctx.ellipse(x, by, R * 1.75, R * 0.42, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(22,19,16,.74)'; ctx.fill(); // 양태: 말총이라 비친다
      // 양태와 대우의 테두리는 짙은 나무 바닥에서도 모양이 보이게 조금 밝다(미학 맹검 11-23 C137)
      ctx.beginPath(); ctx.ellipse(x, by, R * 1.75, R * 0.42, 0, Math.PI * 1.06, Math.PI * 1.94); ctx.strokeStyle = 'rgba(236,226,206,.5)'; ctx.lineWidth = 1; ctx.stroke();
      rr(x - R * 0.46, by - R * 0.8, R * 0.92, R * 0.82, R * 0.18); ctx.fillStyle = '#16130F'; ctx.fill(); // 대우
      ctx.strokeStyle = 'rgba(236,226,206,.45)'; ctx.stroke();
      top = R * 0.66;
    } else if (kind === 'phones') {
      ctx.beginPath(); ctx.arc(x, y - R * 0.06, R * 1.14, Math.PI * 1.1, Math.PI * 1.9); ctx.strokeStyle = '#3D6BC9'; ctx.lineWidth = Math.max(1.4, R * 0.17); ctx.stroke();
      for (const s of [-1, 1]) {
        rr(x + s * R * 1.02 - R * 0.21, y - R * 0.42, R * 0.42, R * 0.7, R * 0.19); ctx.fillStyle = '#3D6BC9'; ctx.fill();
        rr(x + s * R * 1.02 - R * 0.21 + (s < 0 ? R * 0.24 : 0), y - R * 0.34, R * 0.18, R * 0.54, R * 0.08); ctx.fillStyle = '#24448C'; ctx.fill();
      }
      top = R * 0.2;
    } else if (kind === 'sprout') {
      const b0 = y - R * 0.98, b1 = y - R * 1.44;
      ctx.beginPath(); ctx.moveTo(x, b0); ctx.quadraticCurveTo(x + R * 0.06, (b0 + b1) / 2, x, b1); ctx.strokeStyle = '#3F6B2E'; ctx.lineWidth = Math.max(1, R * 0.09); ctx.stroke();
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(x, b1); ctx.quadraticCurveTo(x + s * R * 0.24, b1 - R * 0.52, x + s * R * 0.66, b1 - R * 0.3); ctx.quadraticCurveTo(x + s * R * 0.34, b1 + R * 0.06, x, b1);
        ctx.fillStyle = s < 0 ? '#7DB45A' : '#8FC46A'; ctx.fill();
      }
      top = R * 0.8;
    }
    ctx.restore();
    return top;
  }
  /* 스킨이 바뀌는 차례: 바닥(0)부터, 그다음 부서 자리가 뒤에서 앞으로(1, 2, …) 0.06초 간격, 0.38초씩 */
  const skinK = (i, now, still) => {
    if (skinFrom === skinTo || still) return 1;
    const k = Math.min(1, Math.max(0, (now - skinT0 - i * M.skinStep) / M.skinMs));
    return k * k * (3 - 2 * k);
  };
  /* 바닥 한 판: 배치한 자리를 모두 덮고 둘레에 조금 남긴다 */
  function floorRect() {
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const z of layout) { x0 = Math.min(x0, z.rect.x0); x1 = Math.max(x1, z.rect.x1); z0 = Math.min(z0, z.rect.z0); z1 = Math.max(z1, z.rect.z1); }
    return { x0: x0 - FLOOR_PAD, x1: x1 + FLOOR_PAD, z0: z0 - FLOOR_PAD, z1: z1 + FLOOR_PAD };
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
    const t3 = view * view * (3 - 2 * view);
    // 탁상 등: 그 부서에 일하는(승인을 물은 · 소식 없는) 직원이 있으면 켠다. 첫 그림과 움직임 줄이기에서는 바로(설계 검토 10)
    for (const z of layout) {
      const want = z.kind === 'dept' && z.staff.some(s => LAMP_ON.has(s.status)) ? 1 : 0, was = lampK.get(z.key);
      lampK.set(z.key, still || first || was === undefined ? want : was + (want - was) * (1 - Math.exp(-dt / M.lampTau)));
    }
    const A = skinFrom, B = skinTo, order = [...layout].sort((a, b) => P0(0, 0, a.rect.z0)[2] - P0(0, 0, b.rect.z0)[2]);
    if (A !== B && skinK(1 + order.length, now, still) >= 1) skinFrom = skinTo;
    const mix = k => (A === B ? [[B, 1]] : [[A, 1 - k], [B, k]]);
    const floorOn = !!(SKIN[A].floor || SKIN[B].floor), fl = floorOn ? floorRect() : null;
    const hatOn = layout.some(z => z.staff.some(s => s.hat));
    setCam(view);
    if (!fit(fl, hatOn)) return;
    ctx.font = '400 12.5px SUIT, "Malgun Gothic", sans-serif'; ctx.textBaseline = 'alphabetic';
    // 이름표 폭. 한 장면 안에서는 빠진 수를 한 꼴로 적는다: 어느 구역이든 긴 꼴이 안 들어가면 모두 짧은 꼴이다(검수 solio-office-ga1b-20261122 F2)
    const slabB = SKIN[B].slab * t3;
    const labelFits = z => { const q = z.rect, y = z.kind === 'dept' ? slabB : 0, room = Math.max(24, P(q.x1 - 0.2, y, q.z1 - 0.2)[0] - P(q.x0 + 0.2, y, q.z1 - 0.2)[0]); return t => ctx.measureText(t).width <= room; };
    const shortForm = floorShortForm(layout, labelFits);
    if (fl) { const k0 = skinK(0, now, still); for (const [id, a] of mix(k0)) paintFloor(id, a, fl, t3); }
    // 검정 스킨: 사무실 위에서 내리는 흐린 빛 한 겹. 순검정 바탕에 좌대와 직원이 묻히지 않게 한다(11-23 맹검 「배경과 같은 순검정 톤에 묻혀」)
    const blackK = mix(skinK(0, now, still)).reduce((n, [id, a]) => n + (id === 'black' ? a : 0), 0);
    if (blackK > 0.01 && layout.length) {
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
      for (const z of layout) { x0 = Math.min(x0, z.rect.x0); x1 = Math.max(x1, z.rect.x1); z0 = Math.min(z0, z.rect.z0); z1 = Math.max(z1, z.rect.z1); }
      // 화면 좌표로 그리고 그림판 가장자리에 닿기 전에 0이 되게 한다. 가장자리까지 빛이 닿으면 그림판이 밝은 네모로 보였다
      const c = P((x0 + x1) / 2, 0, (z0 + z1) / 2), sy = Math.max(0.22, cam.sa);
      const R = Math.min(c[0], W - c[0], c[1] / sy, (H - c[1]) / sy) * 0.94;
      if (R > 8) {
        ctx.save(); ctx.translate(c[0], c[1]); ctx.scale(1, sy);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
        g.addColorStop(0, ink(0.075 * blackK * (0.4 + 0.6 * t3))); g.addColorStop(0.55, ink(0.03 * blackK)); g.addColorStop(1, ink(0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
    }
    const kZ = new Map(), yZ = new Map();
    order.forEach((z, i) => {
      const q = z.rect, hotZ = hot.zone === z.key || over.zone === z.key || isOpen(z.key) || z.staff.some(s => s.picked);
      const k = A === B ? 1 : skinK(1 + i, now, still), sl = (SKIN[A].slab * (1 - k) + SKIN[B].slab * k) * t3, y = z.kind === 'dept' ? sl : 0;
      kZ.set(z.key, k); yZ.set(z.key, y);
      for (const [id, a] of mix(k)) {
        if (a < 0.003) continue;
        if (id === 'black') zoneBlack(a, z, q, sl, hotZ);
        else if (z.kind === 'dept') paintPed(id, a, z, q, sl, hotZ, t3);
        else paintMat(id, a, z, q, hotZ);
        zoneText(id, a, z, q, y, hotZ, labelFits, shortForm);
      }
      zonesOnScreen.push({ key: z.key, pts: HQ(q, y) });
    });
    const list = [];
    for (const z of layout) {
      const base = yZ.get(z.key) || 0;
      z.staff.slice(0, z.spots.length).forEach((s, i) => {
        const c = z.spots[i], L = lookOf(s.status), y = base + R0 + L.lift * (0.25 + 0.75 * t3), p = P(c.x, y, c.z);
        list.push({ s, z, c, base, y, p, R: R0 * cam.S * p[3], depth: p[2] });
        const one = life.get(s.id);
        if (one && !still) {
          if (one.blink > 0) one.blink = Math.max(0, one.blink - dt / M.blinkMs);
          else if (now > one.nextBlink) { one.blink = 1; one.nextBlink = now + M.blinkMin + Math.random() * M.blinkSpan; }
        }
      });
    }
    list.sort((a, b) => a.depth - b.depth);
    for (const { s, z, c, base, y, p, R } of list) {
      const one = life.get(s.id), k = kZ.get(z.key) ?? 1, near = k < 0.5 ? A : B;
      const alpha = still || first || !one ? 1 : Math.min(1, (now - one.bornAt) / M.fadeMs);
      ctx.save(); ctx.globalAlpha = alpha;
      for (const [id, a] of mix(k)) underOrb(id, a, c, base, y, t3);
      // 기본 「검정」에서는 직원과 자리를 가는 선 하나로 잇는다
      const lineA = (A === 'black' ? 1 - k : 0) + (B === 'black' ? k : 0);
      if (lineA > 0.01 && t3 > 0.02 && y - R0 - base > 0.02) { const b = P(c.x, base, c.z), a = P(c.x, y - R0, c.z); ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(a[0], a[1]); ctx.strokeStyle = ink(0.16 * t3 * lineA); ctx.lineWidth = 1; ctx.stroke(); }
      if (s.subagents > 0) helpers(p[0], p[1], R, s.subagents);
      orb(p[0], p[1], R, s, now, t3, still, mixRGB(SKIN[A].rim, SKIN[B].rim, k), SKIN[near].boost || 1);
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
      // 스킨은 손님이 고른 때(skinSeq가 바뀜)만 겹쳐 넘어가고, 그 밖에는 바로 그 스킨이다(설계 검토 10)
      const skin = Object.hasOwn(SKIN, s.skin) ? s.skin : 'black';
      // 넘어가는 중에 같은 skinSeq의 다른 장면(직원 상태 바뀜)이 와도 넘어가기를 끊지 않는다. 스킨까지 다르면 판을 따라 바로 바꾼다(최종 검수 F3)
      if (skinSeq === null || reduced() || !shown) { skinFrom = skinTo = skin; skinT0 = -1e9; }
      else if (s.skinSeq === skinSeq) { if (skin !== skinTo) { skinFrom = skinTo = skin; skinT0 = -1e9; } }
      else if (skin !== skinTo) { skinFrom = skinTo; skinTo = skin; skinT0 = clock(); }
      skinSeq = s.skinSeq ?? 0;
      const rk = layout.map(z => [z.rect.x0, z.rect.x1, z.rect.z0, z.rect.z1].map(v => v.toFixed(2)).join(',')).join(';');
      if (rk !== rectKey) { rectKey = rk; TEX.clear(); }
      for (const k of [...lampK.keys()]) if (!layout.some(z => z.key === k)) lampK.delete(k);
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
    /* 시험이 본다: 지금 스킨(넘어가는 중이면 앞 스킨도)과 나뭇결 모음의 크기 */
    skin: () => ({ from: skinFrom, to: skinTo }),
    texSize: () => TEX.size,
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
