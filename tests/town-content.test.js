'use strict';
// 싱크타운 원고 검사기(세로 조각 설계 §16-3) — 실제 원고는 문제 0건이어야 하고, 검사기는 금지 말을 놓치지 않아야 한다.
const test = require('node:test');
const assert = require('node:assert/strict');
const { toolModule } = require('./lib/town.js');

const line = (id, levels, extra = {}) => ({ id, npc: id.split('.')[0], kind: id.split('.')[1], meaning: '시험', slots: [], levels, ...extra });
const check = async (docs, allow = []) => (await toolModule('town-lines-check')).checkDocuments(docs.map((doc, i) => ({ file: `시험${i}.json`, doc })), { allow });

test('실제 원고와 허용 목록은 문제 0건이다', async () => {
  const { checkDocuments, loadDocuments, loadAllow } = await toolModule('town-lines-check');
  const result = checkDocuments(loadDocuments(), { allow: loadAllow() });
  assert.deepEqual(result.problems, []);
  assert.deepEqual(result.unusedAllow, [], '쓰이지 않는 허용은 지운다');
});

test('금지 말 네 갈래를 모두 잡는다', async () => {
  const { scanText } = await toolModule('town-lines-check');
  const rules = text => scanText(text).map(hit => hit.rule);
  for (const text of ['오랜만이에요.', '며칠 만에 왔네요.', '그동안 뭐 했어요?', '계속 기다렸어요.', '보고 싶었어요.', '왜 안 왔어요?', '이제야 왔네요.', '덕분에 다 했어요.', '그 사이에 비가 왔어요.'])
    assert.ok(rules(text).includes('period'), text);
  for (const text of ['네가 없어서 때문에 못 했어요.', '조금 서운해요.', '섭섭했어요.', '실망했어요.']) assert.ok(rules(text).includes('blame'), text);
  for (const text of ['빨리 와요.', '어서 와요.']) assert.ok(rules(text).includes('nag'), text);
  for (const text of ['결혼했어요?', '애인 있어요?', '몸무게가 늘었네요.', '살이 빠졌네요.', '돈벌이는 어때요?']) assert.ok(rules(text).includes('topic'), text);
  for (const text of ['어서 오세요. 앉으세요.', '받침이 단단해져서 잔을 더 놓아요.', '손목이 시큰해서 안쪽만 열었어요.', '공방 주인이 받침을 새로 맞췄대요.'])
    assert.deepEqual(rules(text), [], text);
  assert.deepEqual(scanText('덕분에 잘 마셨어요', { speaker: 'player' }), [], '플레이어 보기는 기간·탓 말 대상이 아니다');
  assert.equal(scanText('결혼했어요?', { speaker: 'player' })[0].rule, 'topic');
});

test('「그동안 달라진 것」 줄은 허용 목록으로도 지나가지 않는다', async () => {
  const doc = [line('town.changes.habit-seat.1', { L1: '공방 주인이 내 자리에서 쉬었어요.', L2: '내가 없는 동안 공방 주인이 쉬었어요.' })];
  const allow = [{ id: 'town.changes.habit-seat.1', level: '*', rule: 'period', phrase: '없는 동안', reason: '시험' }];
  const result = await check([doc], allow);
  assert.equal(result.problems.length, 1);
  assert.equal(result.problems[0].rule, 'period');
  assert.match(result.problems[0].message, /그동안 달라진 것/);
});

test('주민 줄은 사람이 확인한 쓰임만 지나가고, 허용 목록에는 까닭이 있어야 한다', async () => {
  const doc = [line('researcher.mood.low-energy.1', { L1: '좀 쉴게요.', L2: '제가 쉬는 동안 판을 봐 주세요.' })];
  assert.equal((await check([doc])).problems[0].rule, 'period');
  const allow = [{ id: 'researcher.mood.low-energy.1', level: 'L2', rule: 'period', phrase: '쉬는 동안', reason: '주민 자기 쉼 — 플레이어와 상관없음' }];
  const ok = await check([doc], allow);
  assert.deepEqual(ok.problems, []);
  assert.deepEqual(ok.unusedAllow, []);
  const noReason = await check([doc], [{ ...allow[0], reason: '' }]);
  assert.ok(noReason.problems.some(p => p.rule === 'allow'));
  const otherLevel = await check([doc], [{ ...allow[0], level: 'L3' }]);
  assert.equal(otherLevel.problems[0].rule, 'period', '다른 판의 허용은 이 판을 덮지 않는다');
  assert.equal(otherLevel.unusedAllow.length, 1);
});

test('ID 꼴·중복·L1 판을 본다', async () => {
  const result = await check([
    [line('cafe-owner.mood.rain-wrist.1', { L1: '손목이 아파요.' }), line('cafe-owner.mood.rain-wrist.1', { L1: '손목이 아파요.' })],
    [{ id: 'cafe owner mood', levels: { L1: '안녕하세요.' } }, line('cafe-owner.mood.busy.1', { L2: '바빠요.' }), line('cafe-owner.mood.tired.1', { L1: '쉬어요.', L5: '…' })],
  ]);
  const messages = result.problems.map(p => `${p.rule}:${p.id}`);
  assert.ok(messages.includes('duplicate:cafe-owner.mood.rain-wrist.1'));
  assert.ok(messages.includes('shape:cafe owner mood'));
  assert.ok(result.problems.some(p => p.id === 'cafe-owner.mood.busy.1' && /L1/.test(p.message)));
  assert.ok(result.problems.some(p => p.id === 'cafe-owner.mood.tired.1' && /L5/.test(p.message)));
});

test('대화 장면은 주민 줄과 플레이어 보기를 나눠 본다', async () => {
  const scene = { sceneId: 'cafe-alley.day.new-tea', versions: { L1: { turns: [
    { npc: 'cafe-owner', line: '새 차 마셔 볼래요?', choices: [{ text: '네, 좋아요', outcome: 'taste.sip' }] },
    { npc: 'cafe-owner', byOutcome: { 'tea.aroma': { line: '오랜만에 향이 좋죠?', choices: [{ text: '덕분에 잘 마셨어요', outcome: 'x' }] } } },
  ], stop: '네, 또 와요.' } } };
  const result = await check([scene]);
  assert.equal(result.problems.length, 1);
  assert.equal(result.problems[0].phrase, '오랜만');
  assert.equal(result.texts, 5);
  assert.ok((await check([{ sceneId: 'cafe-alley.x', versions: { L2: { turns: [] } } }])).problems.some(p => /L1/.test(p.message)));
});
