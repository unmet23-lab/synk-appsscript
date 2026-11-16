// 검정 구 무대의 셈 시험(PC 클라이언트 1단계, 1단계_구현설계.md 15절). 그리기 없이 자세와 자리 좌표만 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ORB_PLACES, PLACE_LON, faceAx, placeDir, placeXY, orbPoses, mixPose, switchGeom, easeIO, RHO } from '../renderer/orb-stage.mjs';

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

test('a place faced by its own axis and spin looks straight at the viewer', () => {
  for (const name of ORB_PLACES) {
    const d = placeDir(faceAx(name), -PLACE_LON[name], name);
    assert.ok(near(d[0], 0) && near(d[1], 0) && near(d[2], 1), `${name}: ${d.map(v => v.toFixed(4))}`);
  }
});

test('in the space switch pose the faced place sits on the orb centre line', () => {
  for (const [W, H] of [[1440, 900], [960, 680], [390, 800]]) {
    for (const face of ORB_PLACES) {
      const sw = orbPoses({ W, H, face }).sw;
      const [x, y] = placeXY(sw, face);
      assert.ok(near(x, W / 2, 1e-6), `${W}x${H} ${face} x=${x}`);
      assert.ok(near(y, sw.top + sw.r, 1e-6), `${W}x${H} ${face} y=${y}`);
    }
  }
});

test('a mix ends exactly at the target pose', () => {
  const W = 1440, H = 900;
  const poses = orbPoses({ W, H, home: { x: 160, y: 52 }, dive: 'workspace', face: 'pulse' });
  for (const [from, to] of [['void', 'rest'], ['rest', 'ask'], ['ask', 'sw'], ['sw', 'home'], ['home', 'ask']]) {
    const S = { ...poses[from], ax: [...poses[from].ax], spin: poses[from].spin || 0, open: 0 };
    mixPose(S, { ...S, ax: [...S.ax] }, poses[to], 1, { ease: easeIO, W, H, dive: 'workspace', p0: [W / 2, H / 2] });
    for (const k of ['r', 'cx', 'top', 'az', 'focus', 'mark', 'calm']) assert.ok(near(S[k], poses[to][k], 1e-6), `${from}→${to} ${k}: ${S[k]} vs ${poses[to][k]}`);
    assert.ok(near(S.lit, poses[to].lit, 1e-6));
  }
});

test('diving puts the chosen ring in the middle of the window and opens it', () => {
  const W = 1440, H = 900;
  const poses = orbPoses({ W, H, dive: 'pulse' });
  const S = { ...poses.rest, ax: [...poses.rest.ax], spin: 0, open: 0 };
  mixPose(S, { ...S, ax: [...S.ax] }, poses.inside, 1, { ease: easeIO, W, H, dive: 'pulse', p0: placeXY(S, 'pulse') });
  const [x, y] = placeXY(S, 'pulse');
  assert.ok(near(x, W / 2, 1e-3) && near(y, H / 2, 1e-3), `${x}, ${y}`);
  assert.equal(S.open, 1);
  assert.ok(RHO * S.r > Math.hypot(W, H) / 2, 'the ring is larger than the window');
});

test('the switch pose keeps the orb above the names on wide and narrow windows', () => {
  for (const [W, H] of [[1440, 900], [960, 680], [390, 800]]) {
    const g = switchGeom(W, H);
    assert.ok(g.cy - g.r > 0, `${W}x${H} orb top inside the window`);
    assert.ok(g.cy + g.r < H * 0.75, `${W}x${H} room left for the names`);
  }
});
