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

test('공개 직후 캐시에 옛 생성물이 남아도 마을은 뜬다 — 마음 줄은 이름 공간으로 읽는다', () => {
  // 이름 있는 가져오기(import { MOOD_LINES })였다면 옛 data.gen.mjs에서 모듈 연결이 실패해 화면 전체가 멈춘다(빛 표와 같은 길, town-light 시험).
  const code = require('node:fs').readFileSync(path.join(ROOT, 'experiences/synk-town/day-mood.mjs'), 'utf8');
  assert.match(code, /import \* as generated from '\.\/town\/data\.gen\.mjs'/);
  assert.doesNotMatch(code, /import \{[^}]*\bMOOD_LINES\b[^}]*\} from/);
  assert.match(code, /generated\.MOOD_LINES \|\| \[\]/);
});

// 카드가 쓰는 DOM 조각만 흉내 낸다(장면·카드 층·카드·글·단추). 카드는 120×60px, 장면은 800×600px.
function fakeScene() {
  class El {
    constructor() { this.dataset = {}; this.attrs = {}; this.children = []; this.classes = new Set(); this.listeners = {}; this.style = {}; this.hidden = false; this.textContent = ''; this.offsetWidth = 120; this.offsetHeight = 60; this.rects = 0; }
    set className(v) { this.classes = new Set(v.split(/\s+/)); }
    get classList() { return { toggle: (name, on) => (on ? this.classes.add(name) : this.classes.delete(name)) }; }
    set innerHTML(_html) { this.text = new El(); this.help = new El(); this.help.parent = this; }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    querySelector(sel) { return sel === '.mood-text' ? this.text : sel === '.mood-help' ? this.help : null; }
    addEventListener(type, fn) { this.listeners[type] = fn; }
    append(child) { this.children.push(child); child.parent = this; }
    remove() { this.parent.children = this.parent.children.filter(c => c !== this); }
    contains(x) { return x === this || x === this.help || this.children.includes(x); }
    closest(sel) { return sel === '[tabindex]' ? this.parent : null; }
    focus() { globalThis.document.activeElement = this; }
    getBoundingClientRect() { this.rects++; return { width: 800, height: 600 }; }
  }
  globalThis.document = { createElement: () => new El(), activeElement: null };
  const scene = new El(), container = new El(); scene.append(container);
  return { scene, container, live: { textContent: '' } };
}
const near = (lines, mood, t, { distance = 1, label = { x: 400, y: 200 } } = {}) => lines.update({ segments: [{ npc: 'researcher', startMs: t - 50, endMs: t + 50, mood }], t,
  rows: [{ id: 'researcher', live: true, x: 0, z: 0 }], player: { x: distance, z: 0 }, labelAt: () => label, names: { researcher: '연구원' } });
const researcherLines = async () => (await import(pathToFileURL(path.join(ROOT, 'experiences/synk-town/town/data.gen.mjs')).href)).MOOD_LINES.filter(line => line.npc === 'researcher');

test('카드는 이름표 위에 걸려 주민과 플레이어를 가리지 않고, 장면 위쪽에 자리가 없을 때만 이름표 아래로 간다(화면 검수)', async () => {
  const { createMoodLines } = await screen(), [a] = await researcherLines();
  const { container, live } = fakeScene(), lines = createMoodLines(container, live);
  near(lines, a.id, 100);
  const card = container.children[0];
  assert.equal(card.style.transform, 'translate(340px, 126px)', '아랫변이 이름표 가운데 14px 위(200 − 14 − 60)');
  near(lines, a.id, 100, { label: { x: 790, y: 50 } });
  assert.equal(card.style.transform, 'translate(664px, 64px)', '위가 모자라면 이름표 아래(50 + 14), 오른쪽은 16px 여백 안(800 − 120 − 16)');
  delete globalThis.document;
});

test('옛 day.html(카드 층 없음)이 캐시에 남아도 update는 던지지 않는다 — 걷기 프레임 고리가 계속 돈다(화면 검수)', async () => {
  const { createMoodLines } = await screen(), [a] = await researcherLines();
  fakeScene();
  const lines = createMoodLines(null, null);
  assert.deepEqual(near(lines, a.id, 100), []);
  delete globalThis.document;
});

test('경계에서 깜빡이지 않는다 — 떠 있는 카드는 반경 + 0.25m까지 남고, 새 카드는 반경 안에서만 뜬다 · 카드가 없으면 배치를 재지 않는다', async () => {
  const { createMoodLines } = await screen(), { WALK_NEAR_RADIUS } = await import(pathToFileURL(path.join(ROOT, 'experiences/synk-town/walk.mjs')).href);
  const [a] = await researcherLines(), { container, live } = fakeScene(), lines = createMoodLines(container, live);
  assert.deepEqual(near(lines, a.id, 100, { distance: WALK_NEAR_RADIUS + 0.1 }), [], '새 카드는 반경 밖에서 안 뜬다');
  assert.equal(container.rects, 0, '카드가 없는 프레임은 층 크기를 읽지 않는다');
  assert.equal(near(lines, a.id, 100, { distance: WALK_NEAR_RADIUS - 0.1 }).length, 1);
  assert.equal(near(lines, a.id, 100, { distance: WALK_NEAR_RADIUS + 0.2 }).length, 1, '떠 있으면 조금 더 남는다');
  assert.deepEqual(near(lines, a.id, 100, { distance: WALK_NEAR_RADIUS + 0.3 }), []);
  assert.equal(container.children.length, 0);
  delete globalThis.document;
});

test('「무슨 뜻이에요?」로 바뀐 판은 화면 읽기에도 다시 읽히고, 단추에 있던 키보드 초점은 카드가 사라지면 장면으로 돌아간다', async () => {
  const { createMoodLines } = await screen(), [a] = await researcherLines();
  const { scene, container, live } = fakeScene(), lines = createMoodLines(container, live);
  near(lines, a.id, 100);
  assert.equal(live.textContent, `연구원: ${a.levels.L2}`);
  const help = container.children[0].querySelector('.mood-help');
  help.listeners.click();
  assert.equal(live.textContent, `연구원: ${a.levels.L1}`);
  globalThis.document.activeElement = help;
  near(lines, a.id, 100, { distance: 5 });
  assert.equal(globalThis.document.activeElement, scene);
  delete globalThis.document;
});

test('「무슨 뜻이에요?」는 그 카드에만: 곁에 선 채 다음 조각의 다른 줄로 바뀌어도 앞 줄의 쉬운 판이 남지 않는다(검수 A1)', async () => {
  const { createMoodLines, lineLevel } = await screen(), [a, b] = await researcherLines();
  const { container, live } = fakeScene(), lines = createMoodLines(container, live);
  const view = (mood, t) => near(lines, mood, t);
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
