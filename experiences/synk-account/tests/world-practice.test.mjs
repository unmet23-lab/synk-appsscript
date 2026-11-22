// WORLD 앱 창 연습 보기: 최근 연습에서 놓친 곳을 고르고 그 곳을 연습하는 게임을 앞에 둔다(2026-11-22).
import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_GAMES } from '../src/atlas-words.mjs';
import { GAME_SKILLS, SKILL_SHORT, STATUS_WORDS, practiceSkills, firstPick, gamesFor, orderGames, particle, ratioOf, createWorldPractice } from '../src/world-practice.mjs';

const paths = WORLD_GAMES.map(game => game.path);
const skill = (id, status, label = SKILL_SHORT[id]) => ({ id, label, status, line: `${label} 줄` });
const SKILLS = [skill('ko.listening.negation', 'practice', '듣고 부정·변경 이해하기'), skill('ko.reading.condition', 'supported', '읽고 조건 이해하기'),
  skill('ko.reading.grammar', 'review', '조사·문형 읽기'), skill('ko.listening.word', 'recent-independent', '낱말 듣기')];

test('every WORLD game has a skill entry, and every listed skill is one of the sixteen the summary sends', () => {
  assert.deepEqual(Object.keys(GAME_SKILLS).sort(), [...paths].sort());
  const known = new Set(Object.keys(SKILL_SHORT));
  assert.equal(known.size, 16);
  for (const [path, entry] of Object.entries(GAME_SKILLS)) for (const id of [...entry.main, ...entry.also]) assert.ok(known.has(id), `${path}: ${id}`);
  assert.deepEqual(Object.keys(STATUS_WORDS).sort(), ['checking', 'practice', 'recent-independent', 'review', 'supported', 'unseen']);
});

test('the first pick is the first skill the server ranks that is not already done alone', () => {
  assert.equal(firstPick(SKILLS).id, 'ko.listening.negation');
  assert.equal(firstPick([SKILLS[3], SKILLS[1]]).id, 'ko.reading.condition');
  assert.equal(firstPick([SKILLS[3]]).id, 'ko.listening.word');
  assert.equal(firstPick([]), null);
  // An older server sends lines without ids; those rows are not used for picking.
  assert.deepEqual(practiceSkills({ practice: { skills: [{ line: '옛 서버 줄' }, null, SKILLS[0]] } }), [SKILLS[0]]);
});

test('games for a skill put main practice first, minor practice after, and stop at three', () => {
  assert.deepEqual(gamesFor('ko.listening.negation', paths), ['korean-runner', 'korean-rhythm', 'order-rush']);
  assert.deepEqual(gamesFor('ko.reading.condition', paths), ['entry-check', 'korean-racing']);
  assert.deepEqual(gamesFor('ko.listening.main', paths), ['korean-racing']);
  assert.deepEqual(gamesFor('ko.reading.main', paths), []);
  assert.deepEqual(gamesFor(undefined, paths), []);
});

test('game order: chosen skill games, then other skills still to practise, then the rest, with all games and shop last', () => {
  const { order, chosen } = orderGames(paths, SKILLS, SKILLS[1]);
  assert.deepEqual(chosen, ['entry-check', 'korean-racing']);
  assert.deepEqual(order.slice(0, 2), chosen);
  assert.equal(order.at(-1), 'learning-hub');
  assert.deepEqual([...order].sort(), [...paths].sort());
  // With no pick, nothing is yellow and the list keeps its own order apart from the shop.
  const plain = orderGames(paths, [], null);
  assert.deepEqual(plain.chosen, []);
  assert.deepEqual(plain.order, [...paths.filter(path => path !== 'learning-hub'), 'learning-hub']);
});

test('the ratio is correct over recent first tries alone, and only when there were some', () => {
  assert.deepEqual(ratioOf({ recent: 9, correct: 4 }), { recent: 9, correct: 4, pct: 44 });
  assert.deepEqual(ratioOf({ recent: 12, correct: 11 }), { recent: 12, correct: 11, pct: 92 });
  for (const bad of [{ recent: 0, correct: 0 }, { recent: 3, correct: 4 }, { recent: 2 }, { recent: 2.5, correct: 1 }, {}, null]) assert.equal(ratioOf(bad), null);
});

test('particles follow the final consonant', () => {
  assert.equal(particle('바람길', '으로', '로'), '로');
  assert.equal(particle('말의 리듬', '으로', '로'), '으로');
  assert.equal(particle('입장 검사', '으로', '로'), '로');
  assert.equal(particle('조건 읽기', '을', '를'), '를');
  assert.equal(particle('부정·변경 듣기', '을', '를'), '를');
  assert.equal(particle('낱말 뜻 읽기', '은', '는'), '는');
  assert.equal(particle('「핵심 듣기」', '을', '를'), '를');
});

class Node {
  constructor(tag) { this.tagName = tag;this.children = [];this.textContent = '';this.dataset = {};this.attributes = {};this.className = ''; }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  getAttribute(key) { return this.attributes[key] ?? null; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
}
const element = (tag, text, className) => { const node = new Node(tag);if (text != null) node.textContent = text;if (className) node.className = className;return node; };
const button = (text, fn, className) => { const node = element('button', text, className);node.onclick = fn;return node; };
const walk = node => [node, ...node.children.flatMap(walk)];
const find = (root, predicate) => walk(root).find(predicate);
const view = () => { const opened = [], account = [];const practice = createWorldPractice({ element, button, games: WORLD_GAMES, openGame: path => opened.push(path), showAccount: () => account.push(true) });return { practice, opened, account }; };

test('the practice view fills from one summary and a picked row moves the hero, the button and the yellow games', async () => {
  const { practice, opened } = view();
  assert.equal(practice.status().state, 'loading');
  practice.setSummary({ shared: 'practice-and-settings', summary: { practice: { answered: 10, independent: 7, assisted: 3, periods: { recent: { answered: 10, independent: 7, assisted: 3, activeDays: 4 } }, skills: [{ ...SKILLS[0], recent: 9, correct: 4 }, SKILLS[1], SKILLS[2], { ...SKILLS[3], recent: 12, correct: 11 }] } } });
  // 유호님 11-22 「비율도 보여 줘」: 줄과 첫 판에 최근 혼자 푼 문항 중 맞힌 비율. 푼 문항이 없는 줄은 비율 없이 상태 말만.
  const pctOf = id => find(find(practice.skills, n => n.dataset.skill === id), n => n.className === 'wp-pct').textContent;
  assert.equal(pctOf('ko.listening.negation'), '44%');assert.equal(pctOf('ko.listening.word'), '92%');assert.equal(pctOf('ko.reading.condition'), '');
  assert.equal(find(practice.hero, n => n.className === 'wp-meta').children[0].textContent, '연습이 필요한 유형 · 최근 첫 시도 9문항 중 4문항 맞힘');
  assert.equal(find(practice.hero, n => n.tagName === 'h2').textContent, '듣고 부정·변경 이해하기');
  const go = () => find(practice.hero, n => Object.hasOwn(n.dataset, 'recGo'));
  assert.equal(go().textContent, '바람길로 연습');
  const games = () => find(practice.games, n => n.className === 'game-links').children;
  assert.deepEqual(games().filter(b => Object.hasOwn(b.dataset, 'rec')).map(b => b.dataset.game), ['korean-runner', 'korean-rhythm', 'order-rush']);
  assert.equal(games()[0].textContent, '바람길');
  assert.equal(games().at(-1).dataset.game, 'learning-hub');
  assert.equal(find(practice.record, n => n.tagName === 'b').textContent, '4');
  assert.equal(practice.record.getAttribute('aria-label'), '최근 30일');
  const row = find(practice.skills, n => n.dataset.skill === 'ko.reading.condition');
  await row.onclick();
  assert.equal(practice.status().pick, 'ko.reading.condition');
  assert.equal(go().textContent, '입장 검사로 연습');
  assert.equal(find(practice.skills, n => n.dataset.skill === 'ko.reading.condition').getAttribute('aria-pressed'), 'true');
  assert.equal(games()[0].dataset.game, 'entry-check');
  assert.equal(games()[0].dataset.skills, '조건 읽기');
  assert.match(find(practice.games, n => n.className === 'small').textContent, /^노란 칸은 「조건 읽기」를/);
  go().onclick();assert.deepEqual(opened, ['entry-check']);
  // A refreshed summary keeps the row the learner picked.
  practice.setSummary({ shared: 'practice-and-settings', summary: { practice: { skills: SKILLS } } });
  assert.equal(practice.status().pick, 'ko.reading.condition');
});

test('learning off, no records and a failed summary each say what to do next without naming ability', () => {
  const off = view();off.practice.setSummary({ shared: 'declared-only', summary: { practice: { skills: [] } } });
  const offGo = find(off.practice.hero, n => Object.hasOwn(n.dataset, 'recGo'));
  assert.equal(offGo.textContent, '내 SYNK ID에서 켜기');offGo.onclick();assert.equal(off.account.length, 1);
  // 연결이 꺼졌으면 게임 머리 글도 계정에 남는다고 말하지 않는다(카본 A1).
  assert.match(find(off.practice.games, n => n.className === 'small').textContent, /이 기기에만/);
  const fresh = view();fresh.practice.setSummary({ shared: 'practice-and-settings', summary: { practice: { answered: 0, periods: { recent: { answered: 0, independent: 0, assisted: 0, activeDays: 0 } }, skills: [] } } });
  // 서버는 연습이 없어도 periods.recent를 보낸다. 새 계정에 「0일 연습했어요」를 보이지 않는다(Fable F5).
  assert.equal(find(fresh.practice.record, n => n.tagName === 'b'), undefined);
  assert.equal(find(fresh.practice.hero, n => Object.hasOwn(n.dataset, 'recGo')).textContent, '바람길로 시작');
  const failed = view();failed.practice.setSummary(null, true);
  assert.equal(failed.practice.status().state, 'error');
  assert.equal(find(failed.practice.hero, n => Object.hasOwn(n.dataset, 'recGo')), undefined);
  for (const { practice } of [off, fresh, failed]) for (const node of [practice.hero, practice.skills, practice.record, practice.games])
    for (const n of walk(node)) assert.doesNotMatch(n.textContent, /실력|등급|레벨|점수|%/);
});
