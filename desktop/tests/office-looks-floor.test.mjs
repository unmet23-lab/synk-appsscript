// 사무실 그림의 꾸미기(desktop/renderer/office-floor.mjs, docs/디자인/솔리오_사무실스킨_20261123/PC앱_설계.md 5절).
// 실제 픽셀은 흐름 시험의 캡처가 본다. 여기서는 가짜 캔버스로 스킨이 언제 겹쳐 넘어가는지, 나뭇결 모음, 작은 직원의 모자를 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createOfficeFloor, FLOOR_SKINS, FLOOR_MOTION } from '../renderer/office-floor.mjs';

function fakeCanvas(width = 900, height = 520) {
  const calls = new Map(), props = {};
  const count = name => calls.get(name) || 0;
  const ctx = new Proxy(props, {
    get(target, name) {
      if (name in target) return target[name];
      if (name === 'createRadialGradient' || name === 'createLinearGradient') return () => { calls.set(name, count(name) + 1); return { addColorStop() {} }; };
      if (name === 'measureText') return text => ({ width: String(text).length * 7 });
      return (...args) => { calls.set(name, count(name) + 1); };
    },
    set(target, name, value) { target[name] = value; return true; },
  });
  const canvas = {
    width: 0, height: 0, style: {}, getContext: () => ctx, addEventListener() {}, removeEventListener() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width, height }),
    parentElement: { getBoundingClientRect: () => ({ width, height }) },
  };
  return { canvas, calls, count, reset: () => calls.clear() };
}
function setup({ still = false, width, height } = {}) {
  let t = 1000, frames = [];
  const win = { performance: { now: () => t }, requestAnimationFrame: fn => { frames.push(fn); return frames.length; }, cancelAnimationFrame() {}, devicePixelRatio: 1 };
  const c = fakeCanvas(width, height);
  const floor = createOfficeFloor(c.canvas, { win, reduced: () => still });
  return { floor, c, tick: ms => { t += ms; const run = frames; frames = []; for (const fn of run) fn(t); } };
}
const staff = (id, zone, status = 'working', extra = {}) => ({ id, status, alert: false, subagents: 0, provider: 'claude', zone, hat: null, picked: false, ...extra });
const scene = (patch = {}) => ({
  view: 'tilted', viewSeq: 0, skin: 'black', skinSeq: 0, seats: 2,
  zones: [
    { key: 'd:dmkt', kind: 'dept', name: '마케팅부', urgent: false, staff: [staff('s1', 'd:dmkt'), staff('s2', 'd:dmkt', 'resting', { hat: 'gat' })] },
    { key: 'd:ddev', kind: 'dept', name: '개발부', urgent: false, staff: [staff('s3', 'd:ddev', 'resting', { hat: 'beanie' })] },
    { key: 'lobby', kind: 'lobby', name: '부서 없는 일', urgent: false, staff: [staff('s4', 'lobby', 'working', { hat: 'sprout', picked: true })] },
  ],
  ...patch,
});

test('the two skins and the new motions are named', () => {
  assert.deepEqual(FLOOR_SKINS, ['black', 'walnut']);
  assert.equal(FLOOR_MOTION.skinMs, 380);
  assert.equal(FLOOR_MOTION.lampTau, 450);
});

test('opening the room on walnut draws walnut at once; a late board that changes the skin does not cross-fade (설계 검토 10)', () => {
  const h = setup();
  h.floor.setScene(scene({ skin: 'walnut' }));
  h.floor.show(true);
  assert.deepEqual(h.floor.skin(), { from: 'walnut', to: 'walnut' });
  assert.ok(h.c.count('clip') > 0, 'the floor and the desks are drawn with their grain');
  h.floor.setScene(scene({ skin: 'black' }));
  assert.deepEqual(h.floor.skin(), { from: 'black', to: 'black' }, 'same skinSeq: the board caught up, so no motion');
});

test('a pick the user made (a new skinSeq) cross-fades, and the fade ends after the last desk', () => {
  const h = setup();
  h.floor.setScene(scene());
  h.floor.show(true);
  h.floor.setScene(scene({ skin: 'walnut', skinSeq: 1 }));
  assert.deepEqual(h.floor.skin(), { from: 'black', to: 'walnut' });
  h.tick(200);
  assert.deepEqual(h.floor.skin(), { from: 'black', to: 'walnut' }, 'still crossing');
  h.tick(FLOOR_MOTION.skinMs + FLOOR_MOTION.skinStep * 6);
  h.tick(40);
  assert.deepEqual(h.floor.skin(), { from: 'walnut', to: 'walnut' });
});

test('최종 검수 F3: a scene with the same skinSeq that comes during the cross-fade does not cut it short', () => {
  const h = setup();
  h.floor.setScene(scene());
  h.floor.show(true);
  h.floor.setScene(scene({ skin: 'walnut', skinSeq: 1 }));
  const busier = scene({ skin: 'walnut', skinSeq: 1 });
  busier.zones[1].staff[0].status = 'working';
  h.floor.setScene(busier);
  assert.deepEqual(h.floor.skin(), { from: 'black', to: 'walnut' }, 'still crossing after a staff change');
  h.floor.setScene(scene({ skin: 'black', skinSeq: 1 }));
  assert.deepEqual(h.floor.skin(), { from: 'black', to: 'black' }, 'a board that says another skin wins at once');
});

test('with reduced motion a pick switches at once', () => {
  const h = setup({ still: true });
  h.floor.setScene(scene());
  h.floor.show(true);
  h.floor.setScene(scene({ skin: 'walnut', skinSeq: 1 }));
  assert.deepEqual(h.floor.skin(), { from: 'walnut', to: 'walnut' });
});

test('the grain is cached per layout and emptied when the layout changes (설계 검토 11)', () => {
  const h = setup({ still: true });
  h.floor.show(true);
  for (let n = 1; n <= 8; n++) {
    const s = scene({ skin: 'walnut' });
    s.zones[2].staff = Array.from({ length: n }, (_, i) => staff('l' + i, 'lobby'));
    h.floor.setScene(s);
  }
  assert.ok(h.floor.texSize() <= 4, `one floor and the desks of this layout only (${h.floor.texSize()})`);
});

test('hats are drawn on staff big enough to see, and not on tiny ones', () => {
  const big = setup({ still: true }), bare = setup({ still: true });
  const noHats = scene();
  for (const z of noHats.zones) z.staff = z.staff.map(s => ({ ...s, hat: null, picked: false }));
  big.floor.setScene(scene()); big.floor.show(true);
  bare.floor.setScene(noHats); bare.floor.show(true);
  assert.ok(big.c.count('ellipse') > bare.c.count('ellipse'), 'the gat, beanie and sprout add shapes');
  const tiny = setup({ still: true, width: 70, height: 46 });
  tiny.floor.setScene(scene()); tiny.floor.show(true);
  assert.equal(tiny.c.count('ellipse'), 0, 'below a 5px radius neither eyes nor hats are drawn');
});
