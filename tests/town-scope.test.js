'use strict';
// 싱크타운 범위 표(세로 조각 설계 §20-7 ③·§20-5, 시험 §20-10 town-scope) — 모든 명령에 범위가 있고, 본인 권리 명령은 rights다.
// talk 쪽 표(lib/town-scope.js)와의 대조는 talk 시험이 이 파일을 읽어 한다(형제 저장소가 있을 때).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, townModule } = require('./lib/town.js');

/** 타운 권한이 받아들이는 명령 이름 — switch의 case 글자와 접두어 묶음에서. */
function commandsInRuntime() {
  const names = new Set();
  // W8: a life activity's commands live in its own module (town/activities — the tea order's TEA_*).
  const activities = fs.readdirSync(path.join(ROOT, 'experiences/synk-town/town/activities')).filter(f => f.endsWith('.mjs') && f !== 'index.mjs').map(f => `town/activities/${f}`);
  for (const file of ['core.mjs', 'day.mjs', 'life.mjs', 'bazaar.mjs', 'support.mjs', ...activities]) {
    const code = fs.readFileSync(path.join(ROOT, 'experiences/synk-town', file), 'utf8');
    for (const [, name] of code.matchAll(/case '([A-Z][A-Z_]+)'/g)) names.add(name);
  }
  return [...names].sort();
}

test('이 조각의 모든 명령에 범위가 있다 — 정액 범위로 닫히는 명령이 없다', async () => {
  const { commandScope } = await townModule('scope');
  const commands = commandsInRuntime();
  assert.ok(commands.length > 60, `명령 ${commands.length}개`);
  assert.deepEqual(commands.filter(type => commandScope(type) === 'subscription'), []);
});

test('본인 권리와 언어 선택 명령은 rights, 수첩·피드백·제안 메뉴는 base, 장면은 first-chapter', async () => {
  const { commandScope, SCOPES, RIGHTS, BASE, FIRST_CHAPTER } = await townModule('scope');
  assert.deepEqual(SCOPES, ['rights', 'base', 'first-chapter', 'subscription']);
  // W6: 자주 오는 때에 맞춰 자리 채우기의 끄기는 그 기록을 비우는 본인 권리라 rights(Fable F7).
  assert.deepEqual([...RIGHTS].sort(), ['EVAL_CONSENT', 'FEEDBACK_REMOVE', 'LANGUAGE_SET', 'MEMORY_CLEAR', 'MEMORY_FORGET', 'OBSERVED_CORRECT', 'PREF_VISIT_BANDS', 'SEEN_CLEAR']);
  for (const type of ['FEEDBACK_GIVE', 'PREF_LESS_OFTEN', 'PREF_TODAY_OTHER', 'PREF_APPROACH', 'PREF_FAMILY', 'DAY_MOVE', 'ACK']) assert.equal(commandScope(type), 'base', type);
  for (const type of ['PLACE', 'DAY_START', 'LIFE_OPEN', 'BAZAAR_START', 'SUPPORT_ANSWER']) assert.equal(commandScope(type), 'first-chapter', type);
  assert.equal(commandScope('SOME_PAID_SCENE'), 'subscription', '표에 없는 명령은 정액');
  for (const [a, b] of [[RIGHTS, BASE], [RIGHTS, FIRST_CHAPTER], [BASE, FIRST_CHAPTER]]) assert.deepEqual([...a].filter(type => b.has(type)), [], '한 명령은 한 범위');
});

test('talk 범위 표와 같다(형제 저장소 SYNK-talk가 이 판을 가졌을 때)', async t => {
  const talk = path.resolve(ROOT, '..', 'SYNK-talk', 'lib', 'town-scope.js');
  const source = fs.existsSync(talk) ? fs.readFileSync(talk, 'utf8') : '';
  if (!source.includes('RIGHTS')) return t.skip('talk 범위 표가 아직 rights를 갖지 않는 판이다(W2b에서 맞춘다)');
  // W6a: 엔진이 먼저 올라가고 talk 표는 W6a talk 반영(같은 묶음 다시 굽기)에서 맞춘다 — 그 사이만 건너뛴다(W2b와 같은 꼴).
  if (!source.includes('PREF_VISIT_BANDS')) return t.skip('talk 범위 표가 아직 W6 판이 아니다(W6a talk 반영에서 맞춘다)');
  const mine = await townModule('scope'), theirs = require(talk);
  for (const key of ['RIGHTS', 'BASE', 'FIRST_CHAPTER']) assert.deepEqual([...theirs[key]].sort(), [...mine[key]].sort(), key);
});
