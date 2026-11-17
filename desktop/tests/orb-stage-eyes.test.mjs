// 검정 구 눈의 깜빡임과 표정(1-가, 시안 세션 전달 11-17): 눈꺼풀 하나가 끝나는 장에서 밀려 있던 깜빡임이 먼저 터져
// 막 시작한 표정 바꾸기를 지우면, 웃어야 할 때 웃지 않는다. 표정 바꾸기와 눈 뜨기는 깜빡임을 뒤로 민다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrbStage } from '../renderer/orb-stage.mjs';

function fakeStage() {
  const frames = [], said = [];
  let t = 1000;
  const win = { devicePixelRatio: 1, requestAnimationFrame: fn => { frames.push(fn); return frames.length; }, cancelAnimationFrame() {}, performance: { now: () => t }, setTimeout: (fn, ms) => setTimeout(fn, 0) };
  const host = { getBoundingClientRect: () => ({ width: 1200, height: 800 }) };
  const props = {};
  const canvas = {
    ownerDocument: { defaultView: win }, parentElement: host, parentNode: host, dataset: {}, width: 0, height: 0,
    style: { setProperty: (k, v) => { props[k] = v; }, getPropertyValue: k => props[k] || '' },
    getContext: () => null, addEventListener() {}, removeEventListener() {},
  };
  const stage = createOrbStage(canvas, { eyes: true, getHome: () => ({ x: 40, y: 40 }), onEyes: m => said.push(m) });
  // 같은 시각에 장을 여러 번 돌린다(눈꺼풀은 그대로, 눈이 드러나는 정도만 오른다)
  const step = (at, times = 1) => { for (let i = 0; i < times; i++) { t = at; const fn = frames.shift(); if (fn) fn(at); } };
  const flush = () => new Promise(r => setImmediate(r));
  return { stage, step, flush, said, at: () => t };
}

test('a blink that was due when the eyes came back does not erase a smile that has just begun', async () => {
  const { stage, step, flush, said } = fakeStage();
  try {
    stage.snap('rest');
    stage.eyesCalm();
    // 눈이 막 다시 보이기 시작한 순간에 웃음을 시작한다. 마지막 깜빡임은 오래전이라 다음 깜빡임은 이미 밀려 있다
    void stage.setMood('smile', 0);
    step(1000, 40);
    // 눈을 감는 눈꺼풀이 끝나는 장: 깜빡임 검사가 웃음의 다음 걸음보다 먼저 돈다
    step(1200); await flush();
    step(1500); await flush();
    step(1800); await flush();
    assert.ok(said.includes('smile'), 'the smile was erased by a blink: ' + JSON.stringify(said));
  } finally { stage.dispose(); }
});


// 0.4.96 카본 B3: 시작 창에서 이미 보이던 눈을 앱 창이 이을 때 눈이 사라졌다가 다시 떠오르지 않는다
test('eyes continued from another window are fully shown on the first frame', () => {
  const { stage, step } = fakeStage();
  try {
    stage.snap('rest');
    stage.eyesOff();
    stage.eyesCalm({ instant: true }); step(1000);
    assert.ok(stage.state().eyes.gate > 0.99, 'calm eyes faded in: ' + stage.state().eyes.gate);
    stage.eyesOff();
    stage.eyesAsleep({ instant: true }); step(1016);
    assert.ok(stage.state().eyes.gate > 0.99, 'sleeping eyes faded in: ' + stage.state().eyes.gate);
    // 처음 떠오르는 눈은 그대로 천천히 떠오른다
    stage.eyesOff(); stage.eyesAsleep(); step(1032);
    assert.ok(stage.state().eyes.gate < 0.2);
  } finally { stage.dispose(); }
});

// 0.4.96 카본 B4: 눈을 끈 구는 무대에 눈 표정을 알리지 않고 깜빡이지도 않는다
test('a stage without eyes reports off and never blinks', async () => {
  const frames = [], said = [];
  let t = 1000;
  const win = { devicePixelRatio: 1, requestAnimationFrame: fn => { frames.push(fn); return frames.length; }, cancelAnimationFrame() {}, performance: { now: () => t }, setTimeout: fn => setTimeout(fn, 0) };
  const host = { getBoundingClientRect: () => ({ width: 1200, height: 800 }) };
  const canvas = { ownerDocument: { defaultView: win }, parentElement: host, parentNode: host, dataset: {}, width: 0, height: 0, style: { setProperty() {}, getPropertyValue: () => '' }, getContext: () => null, addEventListener() {}, removeEventListener() {} };
  const stage = createOrbStage(canvas, { eyes: false, getHome: () => ({ x: 40, y: 40 }), onEyes: m => said.push(m) });
  try {
    stage.snap('rest'); stage.eyesAsleep(); stage.eyesCalm();
    for (let i = 0; i < 60; i++) { t = 1000 + i * 100; const fn = frames.shift(); if (fn) fn(t); }
    assert.ok(said.every(m => m === 'off'), JSON.stringify(said));
    assert.equal(stage.state().eyes.open, 1, 'a hidden eye blinked');
  } finally { stage.dispose(); }
});
