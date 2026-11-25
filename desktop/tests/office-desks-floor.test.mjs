// 부서별 책상의 그림(desktop/renderer/office-floor.mjs, docs/디자인/솔리오_사무실책상_20261125/README.md 7절).
// 실제 픽셀은 흐름 시험의 캡처가 본다. 여기서는 가짜 캔버스로 언제 겹쳐 넘어가는지, 책상마다의 불, 나뭇결 모음, 누르는 자리를 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createOfficeFloor, FLOOR_MOTION } from '../renderer/office-floor.mjs';

function setup({ still = false, width = 900, height = 500, ghost = true } = {}) {
  let t = 1000, frames = [], size = { width, height }, texts = [], events = [];
  const calls = new Map(), count = name => calls.get(name) || 0, listeners = {}, pressed = [];
  const ctxOf = props => new Proxy(props, {
    get(target, name) {
      if (name in target) return target[name];
      if (name === 'createRadialGradient' || name === 'createLinearGradient') return () => ({ addColorStop() {} });
      if (name === 'measureText') return text => ({ width: String(text).length * 7 });
      return (...args) => { calls.set(name, count(name) + 1); if (name === 'clearRect') events = []; if (name === 'fillText') { texts.push(args); events.push('name'); } };
    },
    set(target, name, value) { target[name] = value; if (name === 'strokeStyle' && value === '#0b0b0a') events.push('bang'); return true; },
  });
  const ctx = ctxOf({});
  const win = { performance: { now: () => t }, requestAnimationFrame: fn => { frames.push(fn); return frames.length; }, cancelAnimationFrame() { frames = []; }, devicePixelRatio: 1 };
  const canvas = {
    width: 0, height: 0, style: {}, getContext: () => ctx, addEventListener(k, fn) { listeners[k] = fn; }, removeEventListener() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, ...size }), parentElement: { getBoundingClientRect: () => size },
    ...(ghost ? { ownerDocument: { createElement: () => ({ width: 0, height: 0, getContext: () => ctxOf({}) }) } } : {}),
  };
  const floor = createOfficeFloor(canvas, { win, reduced: () => still, onPress: (zone, staff) => pressed.push([zone, staff]) });
  const tick = ms => { t += ms; const run = frames; frames = []; for (const fn of run) fn(t); };
  return { floor, canvas, count, pressed, texts: () => texts.splice(0), order: () => events, bangs: () => events.filter(e => e === 'bang'), tick, run: ms => { for (let d = 0; d < ms; d += 34) tick(34); }, click: (x, y) => listeners.click({ clientX: x, clientY: y }), resize: (w, h) => { size = { width: w, height: h }; floor.show(false); floor.show(true); }, drawn: () => count('clearRect') };
}
const people = (n, zone, status = 'working') => Array.from({ length: n }, (_, i) => ({ id: `${zone}-${i}`, status, alert: false, subagents: 0, provider: 'claude', zone, hat: null, picked: false }));
const dept = (key, n, desk = {}, status) => ({ key: 'd:' + key, kind: 'dept', name: key, urgent: false, desk, held: 0, staff: people(n, 'd:' + key, status) });
const scene = (zones, patch = {}) => ({ view: 'tilted', viewSeq: 0, skin: 'black', skinSeq: 0, deskSeq: 0, seats: 3, zones, ...patch });

test('the motions of the desks are named and short', () => {
  assert.equal(FLOOR_MOTION.layoutMs, 380);
  assert.equal(FLOOR_MOTION.freshMs, 1400);
});

test('the first picture stands at once; a desk that is added cross-fades once and ends, with nothing sliding', () => {
  const h = setup();
  h.floor.setScene(scene([dept('mkt', 3), dept('dev', 1)]));
  h.floor.show(true);
  assert.equal(h.floor.fading(), false);
  assert.deepEqual(h.floor.desks(), ['d:mkt#0', 'd:dev#0']);
  h.floor.setScene(scene([dept('mkt', 4), dept('dev', 1)]));
  assert.deepEqual(h.floor.desks(), ['d:mkt#0', 'd:mkt#1', 'd:dev#0']);
  assert.equal(h.floor.fading(), true);
  h.run(340);
  assert.equal(h.floor.fading(), true);
  h.run(80);
  assert.equal(h.floor.fading(), false);
  assert.ok(h.count('drawImage') > 0);
});

test('a status that changes in the middle neither cuts nor restarts the fade; the same desks do not fade', () => {
  const h = setup();
  h.floor.setScene(scene([dept('mkt', 3)]));
  h.floor.show(true);
  h.floor.setScene(scene([dept('mkt', 7)]));
  h.run(200);
  h.floor.setScene(scene([dept('mkt', 7, {}, 'resting')]));
  assert.equal(h.floor.fading(), true);
  h.run(220);
  assert.equal(h.floor.fading(), false, 'the fade kept its own clock');
  h.floor.setScene(scene([dept('mkt', 8, {}, 'resting')]));
  assert.equal(h.floor.fading(), false, 'eight staff sit at the same three desks');
});

test('reduced motion, a hidden room and a canvas without a document change at once', () => {
  const r = setup({ still: true });
  r.floor.setScene(scene([dept('mkt', 3)]));
  r.floor.show(true);
  r.floor.setScene(scene([dept('mkt', 9)]));
  assert.equal(r.floor.fading(), false);
  const h = setup();
  h.floor.setScene(scene([dept('mkt', 3)]));
  h.floor.show(true);
  h.floor.show(false);
  h.floor.setScene(scene([dept('mkt', 9)]));
  h.floor.show(true);
  assert.equal(h.floor.fading(), false, 'desks that came while the room was hidden stand when it opens');
  const bare = setup({ ghost: false });
  bare.floor.setScene(scene([dept('mkt', 3)]));
  bare.floor.show(true);
  bare.floor.setScene(scene([dept('mkt', 9)]));
  assert.equal(bare.floor.fading(), false);
  assert.equal(bare.floor.desks().length, 3);
});

test('a finish the user picks fades; a finish the board brings does not; a new size of window does not', () => {
  const h = setup();
  h.floor.setScene(scene([dept('mkt', 2)]));
  h.floor.show(true);
  h.floor.setScene(scene([dept('mkt', 2, { finish: 'walnut' })], { deskSeq: 1 }));
  assert.equal(h.floor.fading(), true);
  h.run(440);
  h.floor.setScene(scene([dept('mkt', 2, {})], { deskSeq: 1 }));
  assert.equal(h.floor.fading(), false);
  h.floor.setScene(scene(['mkt', 'dev', 'law', 'acc'].map(k => dept(k, 12)), { deskSeq: 1 }));
  assert.equal(h.floor.fading(), true);
  h.resize(380, 144);
  assert.equal(h.floor.fading(), false);
  assert.ok(h.floor.pack().cap > 0, 'the small window seats fewer');
});

test('a finish of its own and a skin change draw both, in any order, and the skin change still ends', () => {
  const h = setup();
  const zones = () => [dept('mkt', 4, { finish: 'walnut' }), dept('dev', 4, { finish: 'black' }), dept('law', 2, { size: 1, count: 6 }), dept('acc', 1, { size: 4 })];
  h.floor.setScene(scene(zones()));
  h.floor.show(true);
  h.floor.setScene(scene(zones(), { skin: 'walnut', skinSeq: 1 }));
  assert.deepEqual(h.floor.skin(), { from: 'black', to: 'walnut' });
  h.run(120);
  h.floor.setScene(scene([dept('mkt', 8, { finish: 'walnut' }), ...zones().slice(1)], { skin: 'walnut', skinSeq: 1 }));
  assert.equal(h.floor.fading(), true);
  h.run(1200);
  assert.deepEqual(h.floor.skin(), { from: 'walnut', to: 'walnut' });
  assert.equal(h.floor.fading(), false);
});

test('a light for each desk, taken away with the desk; the grain is kept small through many layouts', () => {
  const h = setup();
  h.floor.setScene(scene([dept('mkt', 12), dept('dev', 1)], { skin: 'walnut' }));
  h.floor.show(true);
  assert.equal(h.floor.lampSize(), 5);
  h.floor.setScene(scene([dept('mkt', 2), dept('dev', 1)], { skin: 'walnut' }));
  h.run(100);
  assert.equal(h.floor.lampSize(), 2);
  for (let n = 1; n <= 24; n++) { h.floor.setScene(scene([dept('mkt', n, { size: 1 }), dept('dev', 24 - n, { size: 2 })], { skin: 'walnut' })); h.run(70); }
  assert.ok(h.floor.texSize() <= 40, String(h.floor.texSize()));
});

test('a name written on the floor in front of the last desks of a row never runs past the right edge of the picture', () => {
  const h = setup({ width: 260, height: 420 });
  const zones = ['mkt', 'dev', '아주 긴 이름의 고객지원 특별 대응 부서'].map(k => dept(k, 1, { size: 1 }));
  h.floor.setScene(scene(zones));
  h.floor.show(true);
  h.texts();
  h.tick(40);
  const names = h.texts().filter(([s]) => /이름|아주/.test(s));
  assert.ok(names.length > 0);
  for (const [s, x] of names) assert.ok(x + s.length * 7 <= 252, `${s} at ${x.toFixed(0)}`);
});

test('an alert is drawn however small the staff are, and a name on the floor is written after the staff (Fable F1, F4)', () => {
  const h = setup({ width: 380, height: 150 }), list = people(6, 'd:mkt').map((s, i) => ({ ...s, status: 'done', alert: i < 3 }));
  const zones = () => ['mkt', 'dev', 'law', 'acc', 'ops', 'cs'].map(k => dept(k, 6, { count: 3 }));
  const all = zones(); all[0].staff = list;
  h.floor.setScene(scene(all));
  h.floor.show(true);
  h.texts(); h.run(400);
  assert.equal(h.bangs().length, 3, 'three alerts in one picture');
  const order = h.order();
  assert.ok(order.lastIndexOf('name') > order.lastIndexOf('bang'), 'names come after the staff');
});

test('every desk of a department, and the floor between them, picks that department', () => {
  const h = setup();
  h.floor.setScene(scene([dept('mkt', 0, { count: 4 }), dept('dev', 0)]));
  h.floor.show(true);
  const hits = new Set();
  for (let x = 0; x < 900; x += 6) for (let y = 0; y < 500; y += 6) h.click(x, y);
  for (const [zone] of h.pressed) hits.add(zone);
  assert.deepEqual([...hits].map(String).sort(), ['d:dev', 'd:mkt', 'null']);
  const mkt = h.pressed.filter(([z]) => z === 'd:mkt').length, dev = h.pressed.filter(([z]) => z === 'd:dev').length;
  assert.ok(mkt > dev * 1.4, `${mkt} and ${dev}: four desks take more of the floor than one`);
});

test('with many staff the picture is drawn less often, and more often again when they leave', () => {
  const per = n => {
    const h = setup();
    h.floor.setScene(scene(['a', 'b', 'c', 'd'].map(k => dept(k, n))));
    h.floor.show(true);
    const from = h.drawn();
    for (let i = 0; i < 60; i++) h.tick(17);
    return h.drawn() - from;
  };
  assert.ok(per(6) >= 28, 'about thirty a second');
  assert.ok(per(20) <= 22, 'about twenty a second with eighty staff');
});
