import test from 'node:test';
import assert from 'node:assert/strict';
import { homography, project, matrix3d, inQuad, quadSize } from './sign.mjs';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

test('네 모서리가 사진 속 판의 네 점으로 간다', () => {
  const quad = [[120, 40], [300, 62], [296, 118], [118, 104]];
  const H = homography(200, 50, quad);
  const corners = [[0, 0], [200, 0], [200, 50], [0, 50]];
  corners.forEach(([x, y], i) => { const [u, v] = project(H, x, y); near(u, quad[i][0]); near(v, quad[i][1]); });
});

test('반듯한 판은 이동 · 늘림만 남는다', () => {
  const H = homography(100, 20, [[10, 10], [210, 10], [210, 50], [10, 50]]);
  near(H[0], 2); near(H[4], 2); near(H[2], 10); near(H[5], 10); near(H[6], 0); near(H[7], 0);
  assert.match(matrix3d(H), /^matrix3d\(2,0,0,0,0,2,0,0,0,0,1,0,10,10,0,1\)$/);
});

test('누르기 판정은 판 안 · 여유만큼 바깥까지', () => {
  const q = [[0, 0], [100, 0], [100, 30], [0, 30]];
  assert.equal(inQuad(q, 50, 15), true);
  assert.equal(inQuad(q, 50, 40), false);
  assert.equal(inQuad(q, 50, 38, 12), true);
  assert.deepEqual(quadSize(q), { w: 100, h: 30 });
});
