'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { script, html, candidateNote } = require('../tools/라디오차림검수보기.cjs');

const expressions = ['', '기본', '깜빡', '눈웃음', '궁금함', '집중', '안도', '응원', '놀람', '인사'];
const flush = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function api(DJ = '까몽', generation = 0, handler = () => undefined) {
  const calls = { outfits: [], expressions: [], events: [] };
  return {
    calls,
    location: { search: '?DJ=' + encodeURIComponent(DJ) + '&검수차례=' + generation },
    마스코트상태: () => ({ DJ, 준비: true }),
    마스코트차림: selection => {
      calls.outfits.push(JSON.parse(JSON.stringify(selection)));
      return handler(selection);
    },
    마스코트검수표정: name => calls.expressions.push(name),
    마스코트반응: event => calls.events.push(event)
  };
}
function harness({ cached = false, reduced = false, initial = api() } = {}) {
  function element(dataset = {}) {
    return {
      dataset, attributes: {}, listeners: {}, disabled: false, textContent: '', value: '',
      setAttribute(name, value) { this.attributes[name] = String(value); },
      addEventListener(name, handler) { this.listeners[name] = handler; },
      replaceChildren(...children) { this.children = children; this.value = children[0]?.value || ''; }
    };
  }
  const ids = Object.fromEntries(['runtime', 'apply', '의상', '악세', 'genre', 'cycle', 'cycle-state', 'notice', 'state'].map(id => [id, element()]));
  const djButtons = ['까몽', '몽글', '마린'].map(dj => element({ dj }));
  const expressionButtons = expressions.map(expression => element({ expression }));
  const eventButtons = ['인사', '정답', '체크인', '투표'].map(event => element({ event }));
  const document = {
    hidden: false, listeners: {},
    getElementById: id => ids[id],
    querySelectorAll(selector) {
      if (selector === '[data-dj]') return djButtons;
      if (selector === '[data-expression]') return expressionButtons;
      if (selector === '[data-event]') return eventButtons;
      if (selector === '[data-expression],[data-event]') return [...expressionButtons, ...eventButtons];
      throw Error('Untested selector: ' + selector);
    },
    addEventListener(name, handler) { this.listeners[name] = handler; }
  };
  const frame = ids.runtime;
  frame.contentWindow = initial;
  frame.contentDocument = { readyState: cached ? 'complete' : 'loading' };
  const window = { listeners: {}, addEventListener(name, handler) { this.listeners[name] = handler; } };
  const motion = { matches: reduced, listeners: {}, addEventListener(name, handler) { this.listeners[name] = handler; } };
  const timers = new Map();
  let timerId = 0;
  const context = vm.createContext({
    document, window, URLSearchParams,
    Option: function Option(text, value) { this.text = text; this.value = value; },
    matchMedia: () => motion,
    setInterval(fn, ms) { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
    clearInterval(id) { timers.delete(id); }
  });
  vm.runInContext(script, context);
  const click = el => el.disabled ? undefined : el.onclick();
  return {
    ids, document, window, motion, timers, context, frame,
    load(next = initial) { frame.contentWindow = next; frame.contentDocument.readyState = 'complete'; return frame.listeners.load(); },
    selectDJ(name) { return click(djButtons.find(button => button.dataset.dj === name)); },
    expression(name) { return click(expressionButtons.find(button => button.dataset.expression === name)); },
    event(name) { return click(eventButtons.find(button => button.dataset.event === name)); },
    apply: () => click(ids.apply),
    cycle: () => click(ids.cycle),
    intervalCount: ms => [...timers.values()].filter(timer => timer.ms === ms).length,
    tick(ms) { for (const [id, timer] of [...timers]) if (timer.ms === ms && timers.has(id)) timer.fn(); },
    reduce(value) { motion.matches = value; motion.listeners.change(); },
    hide() { document.hidden = true; document.listeners.visibilitychange(); }
  };
}

test('후보 범위를 정확히 알리고 기존 수동·자연·동작 검수를 유지한다', () => {
  assert.equal(candidateNote, '털 고정 수정 후보 · 여름 델 + 전설의 팻말 8표정. 다른 차림은 기존 후보이며 별도 검수 필요.');
  assert.ok(html.includes(candidateNote));
  assert.match(html, /data-expression="" aria-pressed="true">자연 표정/);
  for (const expression of expressions.slice(1)) assert.ok(html.includes('data-expression="' + expression + '"'));
  for (const event of ['인사', '정답', '체크인', '투표']) assert.ok(html.includes('data-event="' + event + '"'));
  assert.match(html, /id="cycle" aria-pressed="false" disabled/);
});

test('첫 iframe 로드가 대표 8표정 후보를 한 번만 입히고 로딩 중 조작을 잠근다', async () => {
  const pending = deferred(), runtime = api('까몽', 0, () => pending.promise);
  const h = harness({ initial: runtime });
  assert.equal(h.ids.apply.disabled, true);
  assert.equal(h.ids.의상.disabled, true);
  assert.equal(h.ids.runtime.attributes['aria-busy'], 'true');
  const loading = h.load();
  assert.deepEqual(runtime.calls.outfits, [{ DJ: '까몽', 의상: '여름 델', 악세: '전설의 팻말' }]);
  assert.equal(h.ids.apply.disabled, true);
  assert.equal(h.ids.cycle.disabled, true);
  assert.equal(h.expression('놀람'), undefined);
  await h.load();
  assert.equal(runtime.calls.outfits.length, 1);
  pending.resolve();
  await loading;
  assert.equal(h.ids.apply.disabled, false);
  assert.equal(h.ids.cycle.disabled, false);
  assert.equal(h.ids.runtime.attributes['aria-busy'], 'false');
  assert.match(h.ids.notice.textContent, /털 고정 수정 후보를 적용했습니다/);
  assert.equal(h.intervalCount(750), 0, '표정 순환은 자동 시작하지 않는다');
});

test('리스너 등록 전에 캐시에서 완료된 iframe도 자동 적용한다', async () => {
  const runtime = api(), h = harness({ initial: runtime, cached: true });
  await flush();
  assert.equal(runtime.calls.outfits.length, 1);
  await h.load();
  assert.equal(runtime.calls.outfits.length, 1);
  assert.equal(h.ids.apply.disabled, false);
});

test('다른 DJ는 기존 로딩을 유지하고 구 세대 iframe 로드는 무시한다', async () => {
  const h = harness();
  await h.load();
  h.selectDJ('몽글');
  assert.match(h.frame.src, /검수차례=1$/);
  const stale = api('까몽', 0);
  await h.load(stale);
  assert.equal(h.ids.apply.disabled, true);
  assert.equal(stale.calls.outfits.length, 0);
  const mong = api('몽글', 1);
  await h.load(mong);
  assert.equal(mong.calls.outfits.length, 0, '몽글에 대표 까몽 차림을 요청하지 않는다');
  assert.match(h.ids.notice.textContent, /몽글 기존 라디오 컷입니다/);
  assert.equal(h.ids.apply.disabled, false);
  assert.equal(h.ids.cycle.disabled, true);
  h.selectDJ('까몽');
  await h.load(api('까몽', 0));
  assert.equal(h.ids.apply.disabled, true, '동일 DJ라도 구 세대 로드는 무시한다');
  const next = api('까몽', 2);
  await h.load(next);
  assert.equal(next.calls.outfits.length, 1);
});

test('이전 DJ의 지연된 자동 적용은 새 화면의 상태를 덮지 않는다', async () => {
  const pending = deferred(), h = harness({ initial: api('까몽', 0, () => pending.promise) });
  const loading = h.load();
  h.selectDJ('마린');
  await h.load(api('마린', 1));
  const notice = h.ids.notice.textContent;
  pending.reject(Error('이전 요청 실패'));
  await loading;
  assert.equal(h.ids.notice.textContent, notice);
  assert.equal(h.ids.apply.disabled, false);
  assert.equal(h.ids.runtime.attributes['aria-busy'], 'false');
  assert.equal(h.ids.cycle.disabled, true);
});

test('공통 입히기는 클릭 당시 선택을 사용하고 실패 후 다시 조작할 수 있다', async () => {
  const runtime = api(), h = harness({ initial: runtime });
  await h.load();
  h.ids.의상.value = '앞치마';
  h.ids.악세.value = '한 달 출석 새싹';
  await h.apply();
  assert.deepEqual(runtime.calls.outfits[1], { DJ: '까몽', 의상: '앞치마', 악세: '한 달 출석 새싹' });
  assert.equal(h.ids.cycle.disabled, true);
  runtime.마스코트차림 = async () => ({ ok: false, 오류: '통합 세트 없음' });
  await h.apply();
  assert.match(h.ids.notice.textContent, /적용하지 않았습니다: 통합 세트 없음/);
  assert.equal(h.ids.apply.disabled, false);
  assert.equal(h.ids.의상.disabled, false);
});

test('750ms 대표 8표정 순환은 수동 시작하고 중지하면 현재 표정을 유지한다', async () => {
  const runtime = api(), h = harness({ initial: runtime });
  await h.load();
  assert.equal(runtime.calls.expressions.length, 0);
  h.cycle();
  assert.equal(h.intervalCount(750), 1);
  assert.equal(h.ids.cycle.attributes['aria-pressed'], 'true');
  for (let i = 0; i < 7; i++) h.tick(750);
  assert.deepEqual(runtime.calls.expressions, expressions.slice(1, 9));
  assert.equal(h.ids['cycle-state'].textContent, '8/8 · 놀람');
  h.tick(750);
  assert.equal(runtime.calls.expressions.at(-1), '기본');
  h.cycle();
  assert.equal(h.intervalCount(750), 0);
  assert.equal(h.ids.cycle.attributes['aria-pressed'], 'false');
  const count = runtime.calls.expressions.length;
  h.tick(750);
  assert.equal(runtime.calls.expressions.length, count);
  assert.match(h.ids['cycle-state'].textContent, /현재 표정 고정/);
});

test('수동·자연·동작·선택 변경·입히기·다른 DJ가 표정 순환을 중지한다', async () => {
  const runtime = api(), h = harness({ initial: runtime });
  await h.load();
  h.cycle(); h.expression('궁금함');
  assert.equal(h.intervalCount(750), 0);
  assert.equal(runtime.calls.expressions.at(-1), '궁금함');
  h.cycle(); h.expression('');
  assert.equal(h.intervalCount(750), 0);
  assert.equal(runtime.calls.expressions.at(-1), null);
  h.cycle(); h.event('정답');
  assert.equal(h.intervalCount(750), 0);
  assert.equal(runtime.calls.expressions.at(-1), null);
  assert.equal(runtime.calls.events.at(-1), '정답');
  h.cycle(); h.ids.의상.onchange();
  assert.equal(h.intervalCount(750), 0);
  h.cycle(); await h.apply();
  assert.equal(h.intervalCount(750), 0);
  h.cycle(); h.selectDJ('몽글');
  assert.equal(h.intervalCount(750), 0);
});

test('움직임 줄임에서는 수동만 제공하고 설정 변경·숨김 때 순환을 멈춘다', async () => {
  const runtime = api(), h = harness({ initial: runtime, reduced: true });
  await h.load();
  assert.equal(h.ids.cycle.disabled, true);
  h.cycle();
  assert.equal(h.intervalCount(750), 0);
  h.expression('눈웃음');
  assert.equal(runtime.calls.expressions.at(-1), '눈웃음');
  assert.match(h.ids['cycle-state'].textContent, /수동 표정/);
  h.reduce(false); h.cycle();
  assert.equal(h.intervalCount(750), 1);
  h.reduce(true);
  assert.equal(h.intervalCount(750), 0);
  assert.match(h.ids['cycle-state'].textContent, /움직임 줄임 설정/);
  h.reduce(false); h.cycle(); h.hide();
  assert.equal(h.intervalCount(750), 0);
  assert.equal(h.intervalCount(500), 1);
  h.window.listeners.pagehide();
  assert.equal(h.timers.size, 0);
});
