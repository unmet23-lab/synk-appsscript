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

/* 2단계 첫 조각 · 구 곁의 펼침(2단계_첫조각_구현설계.md 1.3절) */
test('the fan pose grows the small orb in place from its top-left corner and faces the current place', async () => {
  const { fanR, HOME_R } = await import('../renderer/orb-stage.mjs');
  for (const [W, H] of [[1440, 900], [960, 680], [640, 453]]) {
    const home = { x: 40, y: 38 };
    for (const face of ORB_PLACES) {
      const p = orbPoses({ W, H, home, face });
      // 왼쪽 위 모서리는 앱의 실제 작은 구(반지름 13)의 모서리다(시안의 16을 옮기지 않는다, 설계 검토 1차 ①)
      assert.ok(near(p.fan.cx - p.fan.r, p.home.cx - HOME_R) && near(p.fan.top, p.home.top), `${W}x${H} corner`);
      assert.ok(near(p.fan.r, Math.max(50, Math.min(84, H * 0.086))) && near(p.fan.r, fanR(H)), `${W}x${H} r=${p.fan.r}`);
      assert.equal(p.fan.mark, 1);
      assert.equal(p.fan.eye, undefined, 'eyes recede in the fan pose');
      const [x, y] = placeXY(p.fan, face);
      assert.ok(near(x, p.fan.cx, 1e-6) && near(y, p.fan.top + p.fan.r, 1e-6), `${face} faces the viewer`);
    }
  }
});

test('home to fan and back ends exactly at each pose', () => {
  const W = 960, H = 680, poses = orbPoses({ W, H, home: { x: 40, y: 38 }, face: 'workspace' });
  for (const [from, to] of [['home', 'fan'], ['fan', 'home']]) {
    const S = { ...poses[from], ax: [...poses[from].ax], spin: poses[from].spin || 0, open: 0 };
    mixPose(S, { ...S, ax: [...S.ax] }, poses[to], 1, { ease: easeIO, W, H, p0: [0, 0] });
    for (const k of ['r', 'cx', 'top', 'mark']) assert.ok(near(S[k], poses[to][k], 1e-6), `${from}→${to} ${k}`);
  }
});
