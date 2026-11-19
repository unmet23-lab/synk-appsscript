// WebGL도 2D 캔버스도 없을 때의 정적 구(11-16 토큰 세션 전달 — 지금 얼굴의 정적 구와 같은 약속).
// 그리기가 캔버스에 static을 적고 구의 자리 · 크기 · 빛을 CSS 변수로 넘겨, CSS가 어느 단계에서도 같은 자리에 구를 그린다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createOrbStage } from '../renderer/orb-stage.mjs';

function fakeCanvas() {
  const frames = [], props = {};
  const win = { devicePixelRatio: 1, requestAnimationFrame: fn => { frames.push(fn); return frames.length; }, cancelAnimationFrame() {}, performance: { now: () => 1000 } };
  const host = { getBoundingClientRect: () => ({ width: 1200, height: 800 }) };
  const canvas = {
    ownerDocument: { defaultView: win }, parentElement: host, parentNode: host, dataset: {}, width: 0, height: 0,
    style: { setProperty: (k, v) => { props[k] = v; }, getPropertyValue: k => props[k] || '' },
    getContext: () => null, addEventListener() {}, removeEventListener() {},
  };
  return { canvas, frames, props };
}
const px = v => parseFloat(v);

test('with neither WebGL nor a 2D canvas the stage marks static and hands the orb to CSS in every pose', () => {
  const { canvas, frames, props } = fakeCanvas();
  const stage = createOrbStage(canvas, { getHome: () => ({ x: 40, y: 40 }) });
  try {
    assert.equal(canvas.dataset.orbMode, 'static');
    stage.snap('ask');
    frames.shift()?.(1100);
    const ask = { x: px(props['--orb-sx']), y: px(props['--orb-sy']), r: px(props['--orb-sr']) };
    assert.ok(ask.r > 40 && ask.x > 500 && ask.y > 0, JSON.stringify(props));
    assert.match(props['--orb-ring'], /^rgba\(243,241,236,/);
    // 들어온 뒤의 작은 구(배정된 공간이 열리기를 기다리는 동안도 이 자세다)도 사라지지 않는다
    stage.snap('home');
    frames.shift()?.(1200);
    assert.ok(px(props['--orb-sr']) > 0 && px(props['--orb-sr']) < ask.r, JSON.stringify(props));
  } finally { stage.dispose(); }
});

test('the static orb CSS draws from those variables', () => {
  const css = fs.readFileSync(new URL('../renderer/orb-face.css', import.meta.url), 'utf8');
  assert.match(css, /\.orb-canvas\[data-orb-mode="static"\]\{background:radial-gradient\(circle var\(--orb-sr,0px\) at var\(--orb-sx,50%\) var\(--orb-sy,50%\)/);
});

test('every smoothstep in the orb shader rises from its lower edge (0.4.95 carbon B1)', () => {
  // GLSL에서 edge0 >= edge1인 smoothstep은 정의되지 않은 값이다. 장치에 따라 작은 구의 선이 달라진다
  const src = fs.readFileSync(new URL('../renderer/orb-stage.mjs', import.meta.url), 'utf8');
  const calls = [...src.matchAll(/smoothstep\((-?[\d.]+), (-?[\d.]+),/g)].map(m => [Number(m[1]), Number(m[2])]);
  assert.ok(calls.length > 0);
  for (const [a, b] of calls) assert.ok(a < b, 'smoothstep(' + a + ', ' + b + ', ...)');
});

/* WebGL을 흉내 내는 가짜 맥락. 셰이더와 프로그램은 늘 성공하고, 나머지 부름은 빈 값을 돌려준다 */
function fakeGL() {
  const fn = name => () => (/^get(Shader|Program)Parameter$/.test(name) ? true : name === 'getAttribLocation' ? 0 : name === 'getShaderInfoLog' ? '' : name === 'isContextLost' ? false : name === 'getExtension' ? null : {});
  return new Proxy({}, { get: (_, k) => (typeof k !== 'string' ? undefined : /^[A-Z_0-9]+$/.test(k) ? 1 : fn(k)), set: () => true });
}
function fake2D() {
  const self = new Proxy({}, { get: (_, k) => (typeof k !== 'string' ? undefined : () => self), set: () => true });
  return self;
}
function glWorld() {
  const frames = [], parent = { child: null };
  const win = { devicePixelRatio: 1, requestAnimationFrame: fn => { frames.push(fn); return frames.length; }, cancelAnimationFrame() {}, performance: { now: () => 1000 }, addEventListener() {}, removeEventListener() {} };
  const host = { getBoundingClientRect: () => ({ width: 1200, height: 800 }), addEventListener() {}, removeEventListener() {} };
  const make = kind => {
    const listeners = {}, attrs = { class: 'orb-canvas' };
    const c = {
      kind, ownerDocument: null, parentElement: host, dataset: {}, width: 0, height: 0, listeners,
      get parentNode() { return parent.child === c ? host : null; },
      style: { setProperty() {}, getPropertyValue: () => '' },
      getContext: type => (kind === 'gl' ? (type === 'webgl' ? fakeGL() : null) : (type === '2d' ? fake2D() : null)),
      getAttributeNames: () => Object.keys(attrs), getAttribute: n => attrs[n], setAttribute: (n, v) => { attrs[n] = v; },
      addEventListener: (type, f) => { listeners[type] = f; }, removeEventListener: type => { delete listeners[type]; },
      replaceWith: other => { parent.child = other; },
    };
    return c;
  };
  const doc = { defaultView: win, hidden: false, createElement: () => { const c = make('2d'); c.ownerDocument = doc; return c; }, addEventListener() {}, removeEventListener() {} };
  const canvas = make('gl');
  canvas.ownerDocument = doc;
  parent.child = canvas;
  return { canvas, frames, parent };
}

test('after the WebGL context comes back the orb returns to its own canvas and draws with WebGL again (0.4.95 carbon B2)', () => {
  const { canvas, frames, parent } = glWorld();
  const stage = createOrbStage(canvas, { getHome: () => ({ x: 40, y: 40 }) });
  try {
    assert.equal(canvas.dataset.orbMode, 'webgl');
    canvas.listeners.webglcontextlost({ preventDefault() {} });
    const fresh = parent.child;
    assert.notEqual(fresh, canvas, 'a lost context moves the orb to a fresh 2D canvas');
    assert.equal(fresh.dataset.orbMode, '2d');
    assert.equal(typeof canvas.listeners.webglcontextrestored, 'function', 'the restore notice is still heard on the WebGL canvas');
    canvas.listeners.webglcontextrestored();
    assert.equal(parent.child, canvas, 'the WebGL canvas is back in its place');
    assert.equal(canvas.dataset.orbMode, 'webgl');
    frames.splice(0).forEach(f => f(1100));
  } finally { stage.dispose(); }
  assert.equal(canvas.listeners.webglcontextrestored, undefined, 'dispose removes the listeners from the WebGL canvas');
});

test('a device that takes over 200 ms a frame, even at rest, draws less finely; a normal resting device does not (0.4.95 Fable F5)', () => {
  for (const [gap, lowered] of [[250, true], [33.4, false], [70, true]]) {
    const { canvas, frames } = glWorld();
    const stage = createOrbStage(canvas, { getHome: () => ({ x: 40, y: 40 }) });
    try {
      const before = canvas.width;
      assert.equal(before, 2400, 'starts at twice the screen dots');
      let t = 1000;
      for (let i = 0; i < 64 && frames.length; i++) { t += gap; frames.shift()(t); }
      assert.equal(canvas.width < before, lowered, 'gap ' + gap + ' ms: width ' + canvas.width);
    } finally { stage.dispose(); }
  }
});

/* 2단계 첫 조각 · 구 곁의 펼침(설계 1.3절, 검토 1차 8 · 15) */
test('the fan grows the static orb too, and the map shows a star for each visible place with the lines between them', () => {
  const { canvas, frames, props } = fakeCanvas();
  const stage = createOrbStage(canvas, { getHome: () => ({ x: 40, y: 38 }) });
  try {
    stage.setVisiblePlaces(['solio', 'workspace', 'pulse']);
    stage.snap('home'); frames.shift()?.(1000);
    const small = px(props['--orb-sr']);
    assert.deepEqual(stage.state().map, { lit: 0, lines: 0 }, 'no map on the small orb');
    stage.snap('fan'); frames.shift()?.(1100);   // 쉬는 구는 32ms 안에 다시 그리지 않는다
    assert.ok(px(props['--orb-sr']) > small * 3, JSON.stringify(props));
    assert.deepEqual(stage.state().map, { lit: 9, lines: 2 });
    stage.setVisiblePlaces(['solio']); frames.shift()?.(1200);
    assert.deepEqual(stage.state().map, { lit: 7, lines: 0 }, 'one star, six far stars, nothing to join');
    assert.equal(stage.placeUnder(stage.state().marks[1][0], stage.state().marks[1][1]), null, 'a hidden place cannot be pointed at');
    assert.equal(stage.placeUnder(stage.state().marks[0][0], stage.state().marks[0][1]), 'solio');
  } finally { stage.dispose(); }
});

test('reduced motion never grows the small orb near the pointer', () => {
  const { canvas, frames } = fakeCanvas();
  const stage = createOrbStage(canvas, { getHome: () => ({ x: 40, y: 38 }), getReducedMotion: () => true });
  try {
    stage.snap('home'); stage.setNear(true); stage.setPointer(40 / 1200, 38 / 800);
    for (let i = 0; i < 30; i++) frames.shift()?.(1000 + i * 16);
    assert.equal(stage.state().nearK, 0);
  } finally { stage.dispose(); }
});

test('with places off the fan still grows but draws no map', () => {
  const { canvas, frames } = fakeCanvas();
  const stage = createOrbStage(canvas, { getHome: () => ({ x: 40, y: 38 }), places: false });
  try {
    stage.setSpace('pulse'); stage.snap('fan'); frames.shift()?.(1000);
    const s = stage.state();
    assert.ok(s.r >= 50 && s.mark === 1, JSON.stringify({ r: s.r, mark: s.mark }));
    assert.deepEqual(s.map, { lit: 0, lines: 0 });
    const src = fs.readFileSync(new URL('../renderer/orb-stage.mjs', import.meta.url), 'utf8');
    assert.match(src, /const mark = options\.places === false \? 0 : S\.mark;/);
  } finally { stage.dispose(); }
});

test('the small orb grows up to a fifth as the pointer comes near, only while near is on', () => {
  const { canvas, frames } = fakeCanvas();
  const stage = createOrbStage(canvas, { getHome: () => ({ x: 40, y: 38 }) });
  try {
    stage.snap('home'); stage.setPointer(40 / 1200, 38 / 800);
    for (let i = 0; i < 80; i++) frames.shift()?.(1000 + i * 40);
    assert.equal(stage.state().nearK, 0, 'off by default');
    stage.setNear(true);
    for (let i = 0; i < 200; i++) frames.shift()?.(5000 + i * 40);
    assert.ok(stage.state().nearK > 0.9, String(stage.state().nearK));
  } finally { stage.dispose(); }
});

/* Fable 최종 검수 F2 */
test('entering from the sign-in pose, where the orb has no eyes, never shows the eyes on the way', async () => {
  const { canvas, frames } = fakeCanvas();
  let t = 1000;
  canvas.ownerDocument.defaultView.performance.now = () => t;
  const stage = createOrbStage(canvas, { getHome: () => ({ x: 40, y: 38 }), eyes: true });
  try {
    stage.setVisiblePlaces(['solio']); stage.eyesCalm({ instant: true });
    stage.snap('ask'); frames.shift()?.(t);
    assert.equal(stage.state().eyeShown, 0);
    stage.setDive('solio'); void stage.tween('inside', 1250);
    let most = 0;
    for (let i = 0; i < 40 && frames.length; i++) { t += 40; frames.shift()(t); most = Math.max(most, stage.state().eyeShown); }
    assert.equal(most, 0, 'the eyes stayed hidden all the way in');
    // 눈이 보이는 작은 구에서 지도를 켤 때는 첫머리에 눈이 물러난다
    stage.snap('home'); t += 100; frames.shift()?.(t);
    assert.equal(stage.state().eyeShown, 1);
    void stage.tween('fan', 440);
    const seen = [];
    for (let i = 0; i < 20 && frames.length; i++) { t += 40; frames.shift()(t); seen.push(stage.state().eyeShown); }
    assert.ok(seen.some(v => v > 0 && v < 1) && seen[seen.length - 1] === 0, JSON.stringify(seen.map(v => +v.toFixed(2))));
  } finally { stage.dispose(); }
});
