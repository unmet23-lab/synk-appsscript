'use strict';
// 싱크타운 마음 한 줄 화면 모듈(세로 조각 설계 §7-3, W4) — 원고 검사기가 허용하는 그림 이름마다 그림이 있고, 지금 조각의 마음 줄만 고르며,
// 「무슨 뜻이에요?」는 한 단계 아래 판(L1 아래는 없음)이다. 판 고르기는 W9가 꽂을 함수 하나로 지금은 L2다.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { ROOT, toolModule } = require('./lib/town.js');

const screen = () => import(pathToFileURL(path.join(ROOT, 'experiences/synk-town/day-mood.mjs')).href);

test('그림: 원고 검사기가 허용하는 그림 이름마다 화면 그림이 있고, 실제 원고의 그림은 모두 그 안이다', async () => {
  const { ICONS } = await screen(), { MOOD_ICONS, loadDocuments } = await toolModule('town-lines-check');
  assert.deepEqual(Object.keys(ICONS).sort(), [...MOOD_ICONS].sort());
  for (const svg of Object.values(ICONS)) assert.match(svg, /^<(path|circle|rect|ellipse)/, '선 그림 조각');
  const icons = loadDocuments().flatMap(({ doc }) => (Array.isArray(doc) ? doc : [])).filter(e => e.kind === 'mood').map(e => e.icon);
  assert.ok(icons.length > 0 && icons.every(icon => Object.hasOwn(ICONS, icon)));
});

test('지금 조각의 마음 줄만: 시각이 조각 안이고 원고가 있는 줄 · 판은 L2, 「무슨 뜻이에요?」는 한 단계 아래', async () => {
  const { moodAt, lineLevel, easier } = await screen();
  const segments = [
    { npc: 'researcher', startMs: 100, arriveMs: 120, endMs: 200, mood: 'researcher.mood.tomorrow-clear.1' },
    { npc: 'researcher', startMs: 200, arriveMs: 210, endMs: 300 },
    { npc: 'cafe-owner', startMs: 100, arriveMs: 100, endMs: 300, mood: 'cafe-owner.mood.no-such-line.1' },
  ];
  assert.equal(moodAt(segments, 'researcher', 150), 'researcher.mood.tomorrow-clear.1');
  assert.equal(moodAt(segments, 'researcher', 200), null, '다음 조각에는 줄이 없다');
  assert.equal(moodAt(segments, 'researcher', 99), null);
  assert.equal(moodAt(segments, 'cafe-owner', 150), null, '원고에 없는 줄은 그리지 않는다');
  assert.equal(lineLevel({ kind: 'mood', npc: 'researcher', id: 'researcher.mood.tomorrow-clear.1' }), 'L2');
  assert.deepEqual(['L4', 'L3', 'L2', 'L1'].map(easier), ['L3', 'L2', 'L1', 'L1']);
});

// 카드가 쓰는 DOM 조각만 흉내 낸다(카드·글·단추·층).
function fakeScene() {
  class El {
    constructor() { this.dataset = {}; this.attrs = {}; this.children = []; this.classes = new Set(); this.listeners = {}; this.style = {}; this.hidden = false; this.textContent = ''; this.offsetWidth = 120; }
    set className(v) { this.classes = new Set(v.split(/\s+/)); }
    get classList() { return { toggle: (name, on) => (on ? this.classes.add(name) : this.classes.delete(name)) }; }
    set innerHTML(_html) { this.text = new El(); this.help = new El(); }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    querySelector(sel) { return sel === '.mood-text' ? this.text : sel === '.mood-help' ? this.help : null; }
    addEventListener(type, fn) { this.listeners[type] = fn; }
    append(child) { this.children.push(child); child.parent = this; }
    remove() { this.parent.children = this.parent.children.filter(c => c !== this); }
    getBoundingClientRect() { return { width: 800, height: 600 }; }
  }
  globalThis.document = { createElement: () => new El() };
  return { container: new El(), live: { textContent: '' } };
}

test('「무슨 뜻이에요?」는 그 카드에만: 곁에 선 채 다음 조각의 다른 줄로 바뀌어도 앞 줄의 쉬운 판이 남지 않는다(검수 A1)', async () => {
  const { createMoodLines, lineLevel } = await screen(), { MOOD_LINES } = await import(pathToFileURL(path.join(ROOT, 'experiences/synk-town/town/data.gen.mjs')).href);
  const [a, b] = MOOD_LINES.filter(line => line.npc === 'researcher');
  const { container, live } = fakeScene(), lines = createMoodLines(container, live);
  const view = (mood, t) => lines.update({ segments: [{ npc: 'researcher', startMs: t - 50, endMs: t + 50, mood }], t,
    rows: [{ id: 'researcher', live: true, x: 0, z: 0 }], player: { x: 1, z: 0 }, labelAt: () => ({ x: 400, y: 200 }) });
  view(a.id, 100);
  container.children[0].querySelector('.mood-help').listeners.click();
  assert.deepEqual(view(a.id, 100), [{ npc: 'researcher', id: a.id, eased: true }]);
  assert.equal(container.children[0].querySelector('.mood-text').textContent, a.levels.L1);
  assert.deepEqual(view(b.id, 200), [{ npc: 'researcher', id: b.id, eased: false }], '바뀐 줄은 원래 판');
  // 앞 줄이 다시 오면(이튿날 같은 이유 등) 누르지 않았으니 원래 판이다.
  assert.deepEqual(view(a.id, 300), [{ npc: 'researcher', id: a.id, eased: false }]);
  const card = container.children[0];
  assert.equal(container.children.length, 1);
  assert.equal(card.querySelector('.mood-text').textContent, a.levels[lineLevel()]);
  assert.equal(card.querySelector('.mood-help').attrs['aria-expanded'], 'false');
  delete globalThis.document;
});
