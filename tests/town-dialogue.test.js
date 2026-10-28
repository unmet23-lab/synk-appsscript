'use strict';
// W9 끝 기준 「town-dialogue」(세로 §12·§13-2, 다리 §3-3·§10-4): 대화 한 장면의 상태와 습관 요약.
// 장면 시작 판은 고정되고 본인이 누른 되묻기만 그 장면의 말을 낮추며, 장면 끝 요약은 원문·이름 없이 마을 원장에만 간다.
const test = require('node:test'), assert = require('node:assert/strict');
const load = file => import(`../experiences/synk-town/${file}`);

test('장면은 시작 판을 지키고, 판이 없으면 아래 판 가운데 가장 가까운 것으로 연다', async () => {
  const d = await load('dialogue.mjs');
  assert.equal(d.openDialogue({ id: 's', level: 'L3' }).level, 'L3');
  assert.equal(d.openDialogue({ id: 's', level: 'L4', versions: ['L1', 'L2'] }).level, 'L2');
  assert.throws(() => d.openDialogue({ id: 's', level: 'L2', versions: ['L2', 'L3'] }), /L1/);
});

test('되묻기 — 뜻은 그 줄만, 같은 줄 「다시」 두 번째는 세 번째 말부터, 낮은 판 두 번째면 남은 차례도', async () => {
  const d = await load('dialogue.mjs');
  let s = d.openDialogue({ id: 's', level: 'L3' });
  s = d.helpDialogue(s, 't1', 'slower'); assert.equal(d.dialogueLevel(s, 't1'), 'L3');
  s = d.helpDialogue(s, 't1', 'repeat'); assert.equal(d.dialogueLevel(s, 't1'), 'L3');
  s = d.helpDialogue(s, 't1', 'repeat'); assert.equal(d.dialogueLevel(s, 't1'), 'L2');
  assert.equal(d.dialogueOutcome(s), 'helped-once'); assert.equal(d.dialogueLevel(s, 't2'), 'L3');
  s = d.helpDialogue(s, 't2', 'meaning'); assert.equal(d.dialogueLevel(s, 't2'), 'L2');
  assert.equal(d.dialogueOutcome(s), 'eased'); assert.equal(d.dialogueLevel(s, 't3'), 'L2', '남은 차례도 낮은 판');
  assert.equal(d.dialogueOutcome({ ...s, stopped: true }), 'stopped', '그만할래요는 막힘이 아니다');
});

test('습관 요약은 계약의 칸뿐이고 answerMode는 장면의 응답 꼴이다 — 마을 사건 칸 검사를 지난다', async () => {
  const [d, ev] = await Promise.all([load('dialogue.mjs'), load('town/events.mjs')]);
  for (const responseFormat of ['single-choice', 'cup-compose']) {
    let s = d.openDialogue({ id: 'cafe-alley.day.new-tea', level: 'L2', responseFormat });
    s = d.helpDialogue(s, 'offer', 'meaning');
    const summary = d.closeDialogue(s);
    assert.deepEqual(Object.keys(summary).sort(), ['answerMode', 'channel', 'help', 'level', 'outcome', 'sceneId']);
    assert.deepEqual(summary.help, { meaning: 1, repeat: 0, slower: 0 }, '다시 열기(reopen)는 습관 요약의 되묻기가 아니다');
    assert.equal(summary.answerMode, responseFormat);
    assert.equal(ev.eventProblem({ id: 'E-1', kind: 'dialogue.closed', cmdRev: 1, ...summary, atMs: 1 }), null);
  }
  const ok = { id: 'E-1', kind: 'dialogue.closed', cmdRev: 1, sceneId: 's', level: 'L2', channel: 'reading',
    help: { meaning: 0, repeat: 0, slower: 0 }, outcome: 'smooth', answerMode: 'single-choice', atMs: 1 };
  assert.equal(ev.eventProblem(ok), null);
  for (const bad of [{ answerMode: 'choice' }, { level: 'L5' }, { outcome: 'failed' }, { help: { meaning: 1 } },
    { help: { meaning: 0, repeat: 0, slower: 0, reopen: 1 } }, { channel: 'speaking' }])
    assert.notEqual(ev.eventProblem({ ...ok, ...bad }), null, JSON.stringify(bad));
  assert.notEqual(ev.eventProblem({ ...ok, text: '새 차' }), null, '원문은 사건에 들지 않는다');
});

test('C4 새 차 장면 — 네 판이 같은 차례·같은 결과 키, 판을 바꿔도 생활 결과는 같다', async () => {
  const t = await load('new-tea.mjs');
  const outcomes = level => {
    let s = t.startNewTea(level); const seen = [];
    for (const choice of ['sip', 'less', 'agree']) { seen.push(t.newTeaView(s).choices.map(c => c.id).join()); s = t.chooseNewTea(s, choice); }
    return { seen, honey: s.honey, done: s.done };
  };
  const base = outcomes('L1');
  for (const level of ['L2', 'L3', 'L4']) assert.deepEqual(outcomes(level), base, level);
  for (const level of ['L1', 'L2', 'L3', 'L4']) assert.ok(t.goodbye(level).length > 0);
});
