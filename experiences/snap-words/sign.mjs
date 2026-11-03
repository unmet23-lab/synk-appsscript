// 판 위 글자 얹기(설계 4절): 사진에는 글자를 굽지 않고, 반듯한 글 상자(w × h)를 사진 속 빈 판의 네 모서리로 비틀어 얹는다.
// 네 점 → 네 점 원근 변환(호모그래피)을 풀어 CSS matrix3d로 낸다. 모서리 순서는 왼쪽 위 · 오른쪽 위 · 오른쪽 아래 · 왼쪽 아래.

/** 8×8 연립방정식을 가우스 소거로 푼다(부분 피벗). 풀 수 없으면 null. */
function solve(a, b) {
  const n = b.length, m = a.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
    if (Math.abs(m[p][c]) < 1e-12) return null;
    [m[c], m[p]] = [m[p], m[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = m[r][c] / m[c][c];
      for (let k = c; k <= n; k++) m[r][k] -= f * m[c][k];
    }
  }
  return m.map((row, i) => row[n] / row[i]);
}

/** 사각형 (0,0)-(w,h)를 quad [[x,y]×4]로 보내는 3×3 호모그래피(행 우선 9개, 끝은 1). */
export function homography(w, h, quad) {
  const src = [[0, 0], [w, 0], [w, h], [0, h]], a = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = quad[i];
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const s = solve(a, b);
  return s ? [...s, 1] : null;
}

/** 한 점을 호모그래피로 옮긴다(시험 · 돋보기 자리 셈). */
export function project(H, x, y) {
  const d = H[6] * x + H[7] * y + H[8];
  return [(H[0] * x + H[1] * y + H[2]) / d, (H[3] * x + H[4] * y + H[5]) / d];
}

/** CSS transform 글(transform-origin 0 0 기준). 3×3을 4×4 열 우선으로 편다. */
export function matrix3d(H) {
  const [a, b, c, d, e, f, g, h, i] = H;
  const m = [a, d, 0, g, b, e, 0, h, 0, 0, 1, 0, c, f, 0, i];
  return `matrix3d(${m.map((n) => +n.toFixed(9)).join(',')})`;
}

/** 판 모서리(사진 비율 %)를 화면 픽셀로. size = 사진이 그려진 너비 · 높이. */
export const quadPx = (quad, size) => quad.map(([x, y]) => [x / 100 * size.w, y / 100 * size.h]);

/** 네 모서리의 평균 가로 · 세로 길이 — 글 상자 비율과 글자 크기를 정할 때 쓴다. */
export function quadSize(q) {
  const len = (p, r) => Math.hypot(r[0] - p[0], r[1] - p[1]);
  return { w: (len(q[0], q[1]) + len(q[3], q[2])) / 2, h: (len(q[0], q[3]) + len(q[1], q[2])) / 2 };
}

/** 점에서 볼록 사각형까지의 거리(안이면 0) — 누르기 판정은 이 값이 여유(픽셀) 안인지로 본다. */
export function quadDistance(q, x, y) {
  let sign = 0, inside = true, best = Infinity;
  for (let i = 0; i < 4; i++) {
    const [x1, y1] = q[i], [x2, y2] = q[(i + 1) % 4];
    const cross = (x2 - x1) * (y - y1) - (y2 - y1) * (x - x1);
    if (cross !== 0) { if (sign && Math.sign(cross) !== sign) inside = false; sign = sign || Math.sign(cross); }
    const dx = x2 - x1, dy = y2 - y1, t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy)));
  }
  return inside ? 0 : best;
}

/** 점이 볼록 사각형 안인지(누르기 판정). 판 밖 여유 pad(픽셀)까지 안으로 본다. */
export const inQuad = (q, x, y, pad = 0) => quadDistance(q, x, y) <= pad;
