// 바람길 입구 그림: 게임과 같은 펠트 길(모래빛 길 · 크림 점선 · 버터 울타리 · 풀빛 나무)을 코랄 머리 면 위에 멈춘 채 한 번 그린다.
// 실제 펠트 사진(kit/felt)을 잘라 칠한다 — 펠트를 그레이디언트로 흉내 내지 않고, 빛·그림자만 얹는다. 움직임 없음.
const FELT = 'kit/felt/';
const SRC = { cream: 'tex-cream', fence: 'cushion-butter-strip' };
const load = (url) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = url; });
let images = null;

function feltFill(g, img, tint, size) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d');
  if (img) x.drawImage(img, 0, 0, size, size); else { x.fillStyle = '#f4ecdf'; x.fillRect(0, 0, size, size); }
  x.globalCompositeOperation = 'multiply'; x.fillStyle = tint; x.fillRect(0, 0, size, size);
  return g.createPattern(c, 'repeat');
}

/** 화면 크기에 맞춰 다시 그린다(입구가 보일 때·크기가 바뀔 때). */
export async function drawHeroRoad(canvas) {
  images ||= Object.fromEntries(await Promise.all(Object.entries(SRC).map(async ([k, n]) => [k, await load(`${FELT}${n}.webp`)])));
  const r = canvas.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2), W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d'), u = Math.min(W, H * 1.6);
  g.clearRect(0, 0, W, H);
  // 원근: 소실점은 왼쪽 위, 길은 아래로 넓어진다. 몽글(오른쪽)과 말풍선(왼쪽 위)을 비켜 그린다
  const vx = W * 0.38, top = H * 0.16, bottom = H * 1.04, halfTop = u * 0.035, halfBottom = W * 0.34;
  const at = (k) => ({ y: top + (bottom - top) * k, half: halfTop + (halfBottom - halfTop) * k, x: vx + (W * 0.02) * k });   // k 0(먼 곳) ~ 1(가까운 곳)
  const road = new Path2D();
  const a = at(0), b = at(1);
  road.moveTo(a.x - a.half, a.y); road.lineTo(a.x + a.half, a.y); road.lineTo(b.x + b.half, b.y); road.lineTo(b.x - b.half, b.y); road.closePath();
  // 길 그림자(코랄 면 위에 살짝 뜬 펠트 판)
  g.save(); g.translate(0, 6 * dpr); g.fillStyle = 'rgba(110,30,20,.22)'; g.filter = `blur(${6 * dpr}px)`; g.fill(road); g.restore();
  g.save(); g.clip(road);
  g.fillStyle = feltFill(g, images.cream, '#ecd8b6', Math.round(150 * dpr)); g.fillRect(0, 0, W, H);
  // 칸 사이 크림 점선(먼 곳일수록 짧고 가늘게)
  for (const lane of [-1 / 3, 1 / 3]) {
    for (let k = 0.05; k < 1; k += 0.16) {
      const p0 = at(k), p1 = at(Math.min(1, k + 0.085)), w0 = Math.max(1.2, 5 * dpr * k), w1 = Math.max(1.2, 5 * dpr * (k + 0.085));
      g.fillStyle = 'rgba(255,250,240,.88)';
      g.beginPath();
      g.moveTo(p0.x + p0.half * lane - w0 / 2, p0.y); g.lineTo(p0.x + p0.half * lane + w0 / 2, p0.y);
      g.lineTo(p1.x + p1.half * lane + w1 / 2, p1.y); g.lineTo(p1.x + p1.half * lane - w1 / 2, p1.y); g.closePath(); g.fill();
    }
  }
  // 먼 곳은 옅게(코랄 면으로 녹는다)
  const fade = g.createLinearGradient(0, top, 0, top + (bottom - top) * 0.45);
  fade.addColorStop(0, 'rgba(249,104,89,.85)'); fade.addColorStop(1, 'rgba(249,104,89,0)');
  g.fillStyle = fade; g.fillRect(0, 0, W, H);
  g.restore();
  // 연석: 길 양쪽 가장자리에 크림 펠트 띠
  g.save(); g.strokeStyle = 'rgba(255,248,236,.75)'; g.lineCap = 'round';
  for (const s of [-1, 1]) {
    const grad = g.createLinearGradient(0, top, 0, bottom); grad.addColorStop(0, 'rgba(255,248,236,0)'); grad.addColorStop(0.4, 'rgba(255,248,236,.85)');
    g.strokeStyle = grad; g.lineWidth = 3.5 * dpr; g.beginPath(); g.moveTo(a.x + s * a.half, a.y); g.lineTo(b.x + s * b.half, b.y); g.stroke();
  }
  g.restore();
  // 울타리: 버터 펠트 판(길 폭 그대로) + 나무 기둥 둘 — 바람이 “뛰어넘으세요!” 하는 그 울타리
  const f = at(0.5), fw = f.half * 2.06, fh = fw / 6.4;
  if (images.fence) {
    g.save(); g.shadowColor = 'rgba(90,40,20,.35)'; g.shadowBlur = 8 * dpr; g.shadowOffsetY = 5 * dpr;
    for (const s of [-1, 1]) { g.fillStyle = '#9b6b50'; g.fillRect(f.x + s * f.half * 0.92 - 3 * dpr, f.y - fh * 1.25, 6 * dpr, fh * 1.7); }
    g.drawImage(images.fence, f.x - fw / 2, f.y - fh * 1.05, fw, fh);
    g.restore();
  }
  // 길가 나무: 크림 펠트 사진에 풀빛을 곱한 둥근 잎(먼 것부터)
  const tree = (k, side, scale, tint) => {
    const p = at(k), x = p.x + side * (p.half + u * 0.035 * (0.4 + k)), rr = u * 0.05 * scale * (0.35 + k * 0.8), y = p.y - rr * 0.9;
    g.save(); g.shadowColor = 'rgba(100,30,20,.28)'; g.shadowBlur = 6 * dpr; g.shadowOffsetY = 4 * dpr;
    g.fillStyle = '#9b6b50'; g.fillRect(x - rr * 0.12, y, rr * 0.24, rr * 1.0);
    g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.arc(x - rr * 0.62, y + rr * 0.25, rr * 0.66, 0, Math.PI * 2); g.arc(x + rr * 0.6, y + rr * 0.2, rr * 0.7, 0, Math.PI * 2);
    g.fillStyle = feltFill(g, images.cream, tint, Math.round(90 * dpr)); g.fill(); g.restore();
  };
  tree(0.12, -1, 0.9, '#a9d08b'); tree(0.3, 1, 1, '#f5b7aa'); tree(0.34, -1, 1.1, '#93c276'); tree(0.7, -1, 1.15, '#c0dea2');
}
