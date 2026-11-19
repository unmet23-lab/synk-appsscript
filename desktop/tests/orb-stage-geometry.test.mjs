// 검정 구 무대의 셈 시험(PC 클라이언트 1단계, 1단계_구현설계.md 15절). 그리기 없이 자세와 자리 좌표만 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ORB_PLACES, PLACE_LON, PLACE_STAR, STAR_LINE, AXIS, MAP_DOTS, DOT_MAX, faceAx, placeDir, placeXY, orbPoses, mixPose, mapDots, mapLines, switchGeom, easeIO, RHO } from '../renderer/orb-stage.mjs';

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

/* 공간은 구 위의 별이다(2026-11-20 유호님 「6번으로」). 별은 정해진 자리에 있고 구는 돌지 않는다 */
test('each place is a star at its own fixed spot on the front of the orb, whatever the axis or spin', () => {
  for (const name of ORB_PLACES) {
    const q = PLACE_STAR[name], d = placeDir(faceAx(name), -PLACE_LON[name], name), e = placeDir([0, 1, 0], 1.3, name);
    assert.ok(near(d[0], q[0]) && near(d[1], q[1]) && d[2] > 0.5, name + ': ' + d.map(v => v.toFixed(4)));
    assert.deepEqual(d, e, 'the star does not move with the axis or the spin');
    assert.ok(near(Math.hypot(...d), 1), 'on the unit sphere');
    assert.equal(PLACE_LON[name], 0);
    assert.deepEqual(faceAx(name), [...AXIS.rest], 'the orb keeps its resting axis while it shows the map');
  }
  // 별 셋은 서로 떨어져 있어 손으로 가리킬 때 겹치지 않는다
  for (const a of ORB_PLACES) for (const b of ORB_PLACES) if (a < b) assert.ok(Math.hypot(PLACE_STAR[a][0] - PLACE_STAR[b][0], PLACE_STAR[a][1] - PLACE_STAR[b][1]) > 4 * RHO, a + ' ' + b);
});

test('in the space switch pose the stars stay put when another place is faced', () => {
  for (const [W, H] of [[1440, 900], [960, 680], [390, 800]]) {
    const base = orbPoses({ W, H, face: 'solio' }).sw;
    for (const face of ORB_PLACES) {
      const sw = orbPoses({ W, H, face }).sw;
      assert.deepEqual(sw.ax, [...AXIS.rest]);
      assert.ok(near(sw.spin, 0), 'no spin');
      for (const name of ORB_PLACES) {
        const [x, y] = placeXY(sw, name), [bx, by] = placeXY(base, name);
        assert.ok(near(x, bx) && near(y, by), W + 'x' + H + ' ' + face + ' ' + name);
        assert.ok(near(x, sw.cx + sw.r * PLACE_STAR[name][0]) && near(y, sw.top + sw.r - sw.r * PLACE_STAR[name][1]));
      }
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

test('diving puts the chosen star in the middle of the window and lets the rest recede', () => {
  const W = 1440, H = 900;
  const poses = orbPoses({ W, H, dive: 'pulse' });
  const S = { ...poses.rest, ax: [...poses.rest.ax], spin: 0, open: 0 };
  mixPose(S, { ...S, ax: [...S.ax] }, poses.inside, 1, { ease: easeIO, W, H, dive: 'pulse', p0: placeXY(S, 'pulse') });
  const [x, y] = placeXY(S, 'pulse');
  assert.ok(near(x, W / 2, 1e-3) && near(y, H / 2, 1e-3), `${x}, ${y}`);
  assert.equal(S.open, 1);
  assert.ok(S.r * (1 - Math.hypot(...PLACE_STAR.pulse)) > Math.hypot(W, H) / 2, 'the orb covers the whole window around the star');
});

test('the switch pose keeps the orb above the names on wide and narrow windows', () => {
  for (const [W, H] of [[1440, 900], [960, 680], [390, 800]]) {
    const g = switchGeom(W, H);
    assert.ok(g.cy - g.r > 0, `${W}x${H} orb top inside the window`);
    assert.ok(g.cy + g.r < H * 0.75, `${W}x${H} room left for the names`);
  }
});

/* 2단계 첫 조각 · 구 곁의 펼침(2단계_첫조각_구현설계.md 1.3절) */
test('the fan pose grows the small orb in place from its top-left corner and keeps the stars where they are', async () => {
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
      assert.ok(near(x, p.fan.cx + p.fan.r * PLACE_STAR[face][0], 1e-6) && near(y, p.fan.top + p.fan.r - p.fan.r * PLACE_STAR[face][1], 1e-6), `${face} star`);
      assert.deepEqual(p.fan.ax, [...AXIS.rest]);
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

/* 지도의 점: 눈의 점 스물둘이 흩어져 별이 된다(시안 지도_20261120 · 6번) */
const dotsAt = (mark, extra = {}) => mapDots({ mark, r: 70, face: [0, 0], gaze: [0, 0], seen: true, open: 0, dive: 'solio', space: 'solio', hot: [0, 0, 0], shown: () => true, ...extra });
const lit = d => { const out = []; for (let i = 0; i < MAP_DOTS; i++) if (d.att[i * 3 + 1] > 0.003) out.push({ i, x: d.pos[i * 3], y: d.pos[i * 3 + 1], r: d.att[i * 3], a: d.att[i * 3 + 1], glow: d.att[i * 3 + 2] }); return out; };
const close = (a, b) => near(a, b, 1e-5);   // 점의 자리는 32비트 소수에 담긴다

test('with the map off no dot is drawn, so the resting orb is untouched', () => {
  assert.equal(MAP_DOTS, 22);
  assert.equal(lit(dotsAt(0)).length, 0);
});

test('as the map opens the dots leave from where the eyes were: eleven on each side of the centre', () => {
  const d = lit(dotsAt(0.02));
  assert.equal(d.length, 22);
  assert.equal(d.filter(p => p.x < 0).length, 11);
  assert.equal(d.filter(p => p.x > 0).length, 11);
  for (const p of d) assert.ok(Math.abs(p.x) > 0.1 && Math.abs(p.x) < 0.5 && Math.abs(p.y - 0.06) < 0.25, JSON.stringify(p));
});

test('with the map open three dots are the stars of the three places and six are faint far stars', () => {
  const d = lit(dotsAt(1));
  assert.equal(d.length, 9);
  const stars = d.filter(p => p.glow > 0), far = d.filter(p => p.glow === 0);
  assert.equal(stars.length, 3); assert.equal(far.length, 6);
  for (const name of ORB_PLACES) assert.ok(stars.some(p => close(p.x, PLACE_STAR[name][0]) && close(p.y, PLACE_STAR[name][1])), name);
  const here = stars.find(p => close(p.x, PLACE_STAR.solio[0]));
  for (const p of stars) if (p !== here) assert.ok(here.r > p.r && here.glow > p.glow, 'the place you are in is the larger star');
  for (const p of far) assert.ok(p.a < 0.5 && p.r < here.r, 'far stars stay faint and small');
});

test('a pointed place brightens only its own star', () => {
  const base = lit(dotsAt(1)), hot = lit(dotsAt(1, { hot: [0, 0, 1] }));
  const at = (list, name) => list.find(p => close(p.x, PLACE_STAR[name][0]) && close(p.y, PLACE_STAR[name][1]));
  assert.ok(at(hot, 'pulse').r > at(base, 'pulse').r && at(hot, 'pulse').glow > at(base, 'pulse').glow);
  assert.ok(close(at(hot, 'workspace').r, at(base, 'workspace').r));
});

test('a place that is not shown gets no star and no line, and its dots fade away', () => {
  const shown = name => name !== 'pulse';
  const d = lit(dotsAt(1, { shown }));
  assert.ok(!d.some(p => close(p.x, PLACE_STAR.pulse[0]) && close(p.y, PLACE_STAR.pulse[1])));
  assert.equal(d.filter(p => p.glow > 0).length, 2);
  assert.deepEqual(mapLines(shown), [[...PLACE_STAR.workspace, ...PLACE_STAR.solio], null]);
  assert.deepEqual(mapLines(() => true), [[...PLACE_STAR.workspace, ...PLACE_STAR.solio], [...PLACE_STAR.solio, ...PLACE_STAR.pulse]]);
  assert.deepEqual(mapLines(name => name !== 'solio'), [[...PLACE_STAR.workspace, ...PLACE_STAR.pulse], null]);
  assert.deepEqual(mapLines(name => name === 'solio'), [null, null]);
  assert.deepEqual([...STAR_LINE].sort(), [...ORB_PLACES].sort());
});

test('while diving only the star of the place you enter stays and it grows', () => {
  const d = lit(dotsAt(1, { dive: 'workspace', open: 1 }));
  assert.equal(d.length, 1);
  assert.ok(close(d[0].x, PLACE_STAR.workspace[0]) && close(d[0].y, PLACE_STAR.workspace[1]));
  const before = lit(dotsAt(1, { dive: 'workspace' })).find(p => close(p.x, PLACE_STAR.workspace[0]));
  assert.ok(d[0].r > before.r);
});

test('every dot stays on the face of the orb all the way from the eyes to the stars', () => {
  for (let m = 0.01; m <= 1; m += 0.03) for (const r of [13, 60, 190, 400]) for (const p of lit(dotsAt(m, { r, face: [0.3, -0.2], gaze: [1, -1] }))) assert.ok(Math.hypot(p.x, p.y) < 0.99 && p.r > 0 && p.a <= 1, m + ' ' + r + ' ' + JSON.stringify(p));
});

/* Fable 최종 검수 F2: 로그인을 묻는 큰 구(눈이 없다)에서 들어갈 때 창만 한 구의 눈 자리에 큰 점이 찍히지 않는다 */
test('where no eyes were showing the dots do not fly from the eyes: they light up in place, and never grow past a small dot', () => {
  const spots = [...ORB_PLACES.map(n => PLACE_STAR[n]), [-0.16, 0.64], [0.34, 0.58], [-0.72, -0.20], [-0.24, -0.14], [0.74, -0.36], [-0.30, -0.72]];
  for (const m of [0.05, 0.2, 0.4, 0.7, 1]) for (const r of [154, 900, 1800, 6000]) {
    const d = lit(dotsAt(m, { r, seen: false }));
    for (const p of d) {
      assert.ok(spots.some(s => close(p.x, s[0]) && close(p.y, s[1])), 'mark ' + m + ' r ' + r + ': a dot away from every star ' + JSON.stringify(p));
      assert.ok(p.r <= DOT_MAX + 0.001, 'mark ' + m + ' r ' + r + ': radius ' + p.r);
    }
  }
  assert.equal(lit(dotsAt(0.04, { r: 1800, seen: false })).length, 0, 'nothing shows at the very start');
  // 눈이 보이던 자세에서 떠나는 점도 구가 아무리 커도 작은 점이다
  for (const r of [400, 1800, 6000]) for (const p of lit(dotsAt(0.02, { r }))) assert.ok(p.r <= DOT_MAX, 'r ' + r + ': ' + p.r);
  // 그리지 않는 공간으로 가던 점은 눈이 없던 자세에서는 아예 보이지 않는다
  assert.ok(lit(dotsAt(0.5, { seen: false, shown: n => n === 'solio' })).every(p => p.a > 0));
  assert.equal(lit(dotsAt(1, { seen: false, shown: n => n === 'solio' })).filter(p => p.glow > 0).length, 1);
});
