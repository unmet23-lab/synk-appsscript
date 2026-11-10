// 바람길 입구·결과의 다음 달리기 안내: 실제 Atlas 기록 경로(present·delivery·help·answer)로 쌓은 합성 기록을 실제 판정 함수로 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { INSTRUCTIONS } from './instructions.mjs';
import { LISTENING_CHECKS, checkMetadata, createListeningCheckRound, missedCheck } from './listening-check.mjs';
import { actionEvidence, chooseInstruction, instructionMetadata } from './learning.mjs';
import { doneChecks, runReason, RUN_NEXT, RUN_SCOPE } from './report.mjs';

const require = createRequire(import.meta.url), { createGame } = require('../../atlas/game-learning.js'), { createMap } = require('../../strata/index.js');
const map = createMap(require('../../strata/maps/topik-i.json'));
const newCoach = (gameId = 'korean-runner', rows = new Map()) => createGame({ gameId, map, storage: { getItem: (k) => rows.get(k) ?? null, setItem: (k, v) => rows.set(k, v) } });
const check = (id) => checkMetadata(LISTENING_CHECKS.find((x) => x.id === id));
const DETAILS = ['check-star-middle', 'check-wide-left', 'check-fence-jump', 'check-sign-duck'];
const SEQUENCES = ['check-duck-jump', 'check-middle-left', 'check-right-before-jump', 'check-left-run'];
const NEGATIONS = ['check-not-middle', 'check-no-fence', 'check-high-sign', 'check-not-left'];
function play(coach, id, correct, { audio = 'completed', help = null, skip = false } = {}) {
  const pid = coach.present(check(id));
  coach.delivery(pid, { audio });
  if (help) coach.help(pid, help);
  return coach.answer(pid, skip ? { correct: null, assessable: false, reason: audio === 'completed' ? 'unanswered' : 'audio' } : { correct, assessable: true });
}
const plan = (coach) => chooseInstruction(coach, INSTRUCTIONS);
const DETAIL_LINE = `듣기 확인에서 방향이나 동작을 말하는 문제 4개를 처음 듣고 도움 없이 맞혔어요. ${RUN_NEXT}`;

test('서로 다른 세부 정보 문제 넷을 처음 듣고 혼자 맞히면 해낸 일과 방식을 먼저 말하고, 달리기 방식을 안내한다', () => {
  const coach = newCoach();
  for (const id of DETAILS) play(coach, id, true);
  const next = plan(coach);
  assert.equal(next.state, 'unseen'); assert.equal(next.responseFormat, 'action');
  // 엔진 문구(정책판 5, 11-10): 달리기 칸은 비어 있고 같은 능력 · 단계의 듣기 확인 칸에 기록이 있어 「다른 방식」이다. 입구 문장(runReason)은 그대로다.
  assert.equal(next.reason, '「듣고 세부 정보 찾기」를 다른 방식으로 확인해 봐요.');
  assert.equal(doneChecks(coach).count, 4);
  assert.equal(runReason(coach, next), DETAIL_LINE);
  assert.doesNotMatch(runReason(coach, next), /기록이 적어요|잘하|좋아하|실력|틀렸|틀린|모르|못하|약해|부족/);
});

test('순서 문제 넷도 그 말로 말하고, 입구가 말하는 일은 실제 다음 달리기의 응답 방식과 같다', () => {
  const coach = newCoach();
  for (const id of SEQUENCES) play(coach, id, true);
  const next = plan(coach);
  assert.match(runReason(coach, next), /^듣기 확인에서 두 동작의 순서를 말하는 문제 4개를/);
  assert.equal(instructionMetadata(next.selected).responseFormat, 'action');
});

test('근거가 부족한 기록은 해낸 일로 말하지 않고 달리기 방식으로만 좁혀 이유를 밝힌다', () => {
  const cases = {
    '셋만 맞힘': (c) => DETAILS.slice(0, 3).forEach((id) => play(c, id, true)),
    '넷 중 하나 틀림': (c) => DETAILS.forEach((id, i) => play(c, id, i !== 0)),
    '넷 다 다시 듣기 도움': (c) => DETAILS.forEach((id) => play(c, id, true, { help: 'replay' })),
    '둘 도움': (c) => DETAILS.forEach((id, i) => play(c, id, true, i < 2 ? { help: 'replay' } : {})),
    '소리 실패': (c) => DETAILS.forEach((id) => play(c, id, true, { audio: 'failed' })),
    '미응답': (c) => DETAILS.forEach((id) => play(c, id, null, { skip: true })),
    '같은 문제 되풀이': (c) => [0, 1, 2, 3].forEach(() => play(c, DETAILS[0], true)),
    '난도가 나뉜 부정 넷': (c) => NEGATIONS.forEach((id) => play(c, id, true)),
    '달리기 동작만': (c) => { for (const item of INSTRUCTIONS.slice(0, 8)) { const pid = c.present(instructionMetadata(item)); c.delivery(pid, { audio: 'completed' }); c.answer(pid, actionEvidence({ steps: [{ status: 'done' }] }, true)); } },
  };
  for (const [name, seed] of Object.entries(cases)) {
    const coach = newCoach(); seed(coach);
    assert.equal(doneChecks(coach), null, name);
    assert.equal(runReason(coach, plan(coach)), RUN_SCOPE, name);
  }
});

test('다른 게임에서 쌓은 같은 칸의 기록은 이 게임이 해낸 일로 옮기지 않는다', () => {
  const rows = new Map(), other = newCoach('talk-rally', rows);
  for (const id of DETAILS) play(other, id, true);
  const coach = newCoach('korean-runner', rows), cell = coach.summary().skills.find((s) => s.id === 'ko.listening.detail').levels[1].formats['single-choice'];
  assert.equal(cell.status, 'recent-independent', '공통 칸은 다른 게임 기록으로 차 있다');
  assert.equal(doneChecks(coach), null);
  assert.equal(runReason(coach, plan(coach)), RUN_SCOPE);
});

test('기록을 다 받지 못했거나 저장할 수 없거나 읽기가 실패하면 해낸 일로 말하지 않는다', () => {
  const coach = newCoach();
  for (const id of DETAILS) play(coach, id, true);
  const real = coach.summary(), wrap = (over) => Object.assign(Object.create(coach), over);
  assert.equal(doneChecks(wrap({ summary: () => ({ ...real, evidenceComplete: false }) })), null);
  assert.equal(doneChecks(wrap({ summary: () => ({ ...real, storage: { available: false } }) })), null);
  assert.equal(doneChecks(wrap({ events: () => [] })), null, '근거의 출처를 잇지 못하는 접힌 기록');
  assert.equal(doneChecks(wrap({ events: () => { throw Error('closed'); } })), null);
  assert.equal(runReason(null, plan(coach)), RUN_SCOPE);
});

test('과제가 있으면 해낸 일 안내를 내지 않는다', () => {
  const coach = newCoach();
  for (const id of DETAILS) play(coach, id, true);
  coach.assignment = () => ({ ...check(DETAILS[0]), familyKeys: [check(DETAILS[0]).familyKey], itemKeys: [check(DETAILS[0]).itemKey], requiredAttempts: 1 });
  assert.equal(doneChecks(coach), null);
});

test('엔진이 달리기 칸의 빈 기록이 아닌 까닭을 말할 때는 그 말을 바꾸지 않는다', () => {
  const coach = newCoach();
  for (const state of ['supported', 'checking', 'practice', 'review', 'recent-independent']) assert.equal(runReason(coach, { state, responseFormat: 'action', reason: 'x' }), null, state);
  assert.equal(runReason(coach, { state: 'unseen', responseFormat: 'single-choice', reason: 'x' }), null);
  assert.equal(runReason(coach, null), null);
});

test('두 오답 뒤 한 번만 맞히면 놓친 안내가 남고, 두 번 맞히면 풀리되 해낸 일로 올리지 않는다', () => {
  const coach = newCoach();
  play(coach, 'check-duck-jump', false); play(coach, 'check-middle-left', false);
  play(coach, 'check-right-before-jump', true);
  assert.equal(missedCheck(coach)?.patternId, 'sequence');
  play(coach, 'check-left-run', true);
  assert.equal(missedCheck(coach), null);
  assert.equal(doneChecks(coach), null);
  assert.equal(runReason(coach, plan(coach)), RUN_SCOPE);
});

test('입구의 첫 문제 약속: 답한 뒤에도 안내를 다시 읽으면 실제 다음 판의 첫 문제와 같다', () => {
  const coach = newCoach();
  play(coach, 'check-duck-jump', false); play(coach, 'check-middle-left', false); play(coach, 'check-right-before-jump', true);
  const before = missedCheck(coach); assert.equal(before.patternId, 'sequence');
  const round = (c) => createListeningCheckRound(c, { lead: missedCheck(c)?.target.item ?? null }).next().item.id;
  assert.equal(round(coach), before.target.item.id);
  play(coach, before.target.item.id, true);   // 여기서 가까운 3개 창이 오답 하나만 남기면 맞춤이 풀린다
  const after = missedCheck(coach), next = round(coach);
  assert.equal(after, null); assert.notEqual(next, before.target.item.id, '풀린 뒤에는 그 문제를 약속하지 않는다');
  assert.equal(runReason(coach, plan(coach)), RUN_SCOPE);
});

test('처음 방문은 기존 첫 출발 안내의 조건 그대로다(기록 0건)', () => {
  const coach = newCoach(), s = coach.summary();
  assert.equal(s.evidenceComplete, true); assert.equal(s.counts.attempts, 0); assert.equal(plan(coach).state, 'unseen');
});

test('화면 코드: 닫기 뒤 입구를 실제 다음 판으로 다시 쓰고, 안내 순서는 오답·복구 → 첫 방문 → 달리기 안내 → 엔진 이유다', () => {
  const source = readFileSync(new URL('./app.mjs', import.meta.url), 'utf8');
  assert.match(source, /function closeListeningCheck\(\) \{[\s\S]*?else if \(screen === 'lobby'\) \{ refreshRecommendation\(\); paintLobbyReason\(\); \}/);
  assert.match(source, /returnReason\(\) \|\| \(noPracticeYet\(\) \? '[^']+' : null\) \|\| runReason\(coach, nextPlan\) \|\| nextPlan\?\.reason/);
  assert.match(source, /returnReason\(\) \|\| runReason\(coach, nextPlan\) \|\| `\$\{nextPlan\?\.reason/);
  assert.doesNotMatch(source, /from '\.\/listening-check\.mjs\?v=/, 'lead는 같은 모듈의 문항 객체여야 한다');
  assert.match(source, /from '\.\/report\.mjs\?v=(?!runner-listening-scope-20261014)/, '새 내보내기를 낡은 캐시에서 읽지 않는다');
});
