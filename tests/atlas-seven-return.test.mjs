// 재방문 맞춤 연습(7개 공개 게임): 합성 기록은 실제 Atlas 기록 경로(present·delivery·help·answer)로만 만들고, 판정과 판 구성은 게임의 실제 함수로 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { ITEMS as RALLY_ITEMS } from '../experiences/talk-rally/content.mjs';
import { composeRound as rallyRound } from '../experiences/talk-rally/core.mjs';
import { itemMetadata as rallyMeta, missedPractice as rallyMissed, RETURN_PATTERNS as RALLY_PATTERNS } from '../experiences/talk-rally/learning.mjs';
import { dailyRound, dateSeed } from '../experiences/talk-rally/daily.mjs';
import { ITEMS as SLICE_ITEMS } from '../experiences/blank-slice/content.mjs';
import { composeRound as sliceRound } from '../experiences/blank-slice/core.mjs';
import { itemMetadata as sliceMeta, missedPractice as sliceMissed, RETURN_PATTERNS as SLICE_PATTERNS } from '../experiences/blank-slice/learning.mjs';
import { VENUES } from '../experiences/entry-check/content.mjs';
import { composeShift, unlocked } from '../experiences/entry-check/core.mjs';
import { caseMetadata, missedPractice as entryMissed, RETURN_PATTERNS as ENTRY_PATTERNS } from '../experiences/entry-check/learning.mjs';
import { instructionMetadata } from '../experiences/korean-runner/learning.mjs';
import { INSTRUCTIONS } from '../experiences/korean-runner/instructions.mjs';
import { LISTENING_CHECKS, checkMetadata, createListeningCheck, createListeningCheckRound, missedCheck, AUDIO_RETRY_NEXT, RETURN_PATTERNS as RUNNER_PATTERNS } from '../experiences/korean-runner/listening-check.mjs';
import { TRACKS, LEVELS, buildChart, RoundState } from '../experiences/korean-rhythm/core.mjs';
import { NARRATION } from '../experiences/korean-rhythm/narration.mjs';
import { rhythmItem, missedRhythm, returnLine as rhythmLine, RETURN_PATTERNS as RHYTHM_PATTERNS } from '../experiences/korean-rhythm/personalization.mjs';
import { supplementalItems } from '../experiences/korean-rhythm/supplemental.mjs';
import { missedSupplementalPool } from '../experiences/korean-rhythm/supplemental-player.mjs';
import { RACING_CANDIDATES, racingItem, personalizedStage, missedRacing, RETURN_PATTERNS as RACING_PATTERNS } from '../experiences/korean-racing/personalization.js';
import { EPISODE } from '../experiences/story-classroom/story.mjs';
import { StoryGame } from '../experiences/story-classroom/core.mjs';
import { missionMetadata, missedStory, returnLine as storyLine, RETURN_PATTERNS as STORY_PATTERNS } from '../experiences/story-classroom/learning.mjs';
import { supportedPractice } from '../experiences/story-classroom/supported-practice.mjs';
import { names as STORY_NAMES } from '../experiences/story-classroom/stage.mjs';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url), { createGame } = require('../atlas/game-learning.js'), { createMap } = require('../strata/index.js');
const map = createMap(require('../strata/topik-i').topikMap());
const memory = () => { const data = new Map(); return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; };
const newCoach = (gameId, options = {}) => createGame({ gameId, map, storage: memory(), ...options });

/** 실제 한 문항: 소리를 끝까지 듣고(듣기) 도움 없이 첫 시도로 답한다. audio·help로 다른 경로를 만든다. */
function play(coach, meta, correct, { audio = 'completed', help = null, skip = false } = {}) {
  const pid = coach.present(meta);
  if (meta.audioRequired) coach.delivery(pid, { audio });
  if (help) coach.help(pid, help);
  return coach.answer(pid, skip ? { correct: null, assessable: false, reason: 'unanswered' } : { correct, assessable: true });
}
const rally = (id) => rallyMeta(RALLY_ITEMS.find((x) => x.id === id));
const slice = (id) => sliceMeta(SLICE_ITEMS.find((x) => x.id === id));
const entryCase = (id) => VENUES.flatMap((v) => v.cases).find((c) => c.id === id);
const entry = (id) => caseMetadata(entryCase(id));
const check = (id) => checkMetadata(LISTENING_CHECKS.find((x) => x.id === id));
const mission = (id) => [...EPISODE.acts.flatMap((a) => a.missions), ...EPISODE.review].find((m) => m.id === id);
const racing = (id) => racingItem(RACING_CANDIDATES.find((c) => c.id === id).item);
const OPEN = VENUES.map((v) => v.id);

test('말 랠리: 놓친 종류에 따라 다른 새 말이 다음 판 첫 공이 되고 첫 공에 안내와 같은 말이 온다', () => {
  for (const [pattern, ids, prefix] of [['yn', ['r01', 'r02', 'r03'], 'r'], ['wh', ['w01', 'w02', 'w03'], 'w'], ['follow', ['f01', 'f02', 'f03'], 'f']]) {
    const coach = newCoach('talk-rally');
    ids.forEach((id, i) => play(coach, rally(id), i === 0));
    const plan = rallyMissed(coach);
    assert.equal(plan.patternId, pattern); assert.equal(plan.misses, 2); assert.equal(plan.target.item.id[0], prefix);
    assert.ok(!ids.includes(plan.target.id));
    const round = rallyRound(RALLY_ITEMS, { ranked: null, seed: 3, lead: plan.target.id });
    assert.equal(round[0].id, plan.target.id); assert.equal(round.length, 12);
    assert.equal(new Set(round.map((x) => x.id)).size, 12);
    const kinds = round.reduce((n, x) => ({ ...n, [x.kind]: (n[x.kind] || 0) + 1 }), {});
    assert.ok(kinds.answer >= 4 && kinds.follow >= 4);
  }
});

test('말 랠리: 난도 2로 저작한 말도 첫 공이 되고, 소리를 끄면 듣기 맞춤을 약속하지 않으며, 하루 도전은 그대로다', () => {
  const round = rallyRound(RALLY_ITEMS, { seed: 2, lead: 'w06' });
  assert.equal(round[0].id, 'w06');
  const coach = newCoach('talk-rally');
  ['r01', 'r02', 'r03'].forEach((id) => play(coach, rally(id), false));
  assert.equal(rallyMissed(coach, { audioAvailable: false }), null);
  const date = '2026-11-03';
  assert.deepEqual(dailyRound(date).map((x) => x.id), rallyRound(RALLY_ITEMS, { seed: dateSeed(`talk-rally:${date}`) }).map((x) => x.id));
});

test('독립 오답만 근거다: 한 번·전부 정답·소리 실패·도움·답 안 함·같은 문항 반복은 말하지 않는다', () => {
  const cases = {
    once: (c) => play(c, rally('r01'), false),
    allRight: (c) => ['r01', 'r02', 'r03'].forEach((id) => play(c, rally(id), true)),
    audioFailed: (c) => ['r01', 'r02', 'r03'].forEach((id) => play(c, rally(id), false, { audio: 'failed' })),
    replayHelp: (c) => ['r01', 'r02', 'r03'].forEach((id) => play(c, rally(id), false, { help: 'replay' })),
    textHelp: (c) => ['r01', 'r02', 'r03'].forEach((id) => play(c, rally(id), false, { help: 'text' })),
    unanswered: (c) => ['r01', 'r02', 'r03'].forEach((id) => play(c, rally(id), null, { skip: true })),
    sameItem: (c) => { for (let i = 0; i < 3; i++) play(c, rally('r01'), false); },
    twoOfTwo: (c) => ['r01', 'r02'].forEach((id) => play(c, rally(id), false)),
  };
  for (const [name, fill] of Object.entries(cases)) {
    const coach = newCoach('talk-rally'); fill(coach);
    assert.equal(rallyMissed(coach), null, name);
  }
});

test('회복하면 안내가 사라지고, 칸이 최근 혼자 해낸 상태면 말하지 않으며, 다른 패턴은 섞이지 않는다', () => {
  const recovered = newCoach('talk-rally');
  [['r01', false], ['r02', true], ['r03', true], ['r04', false], ['r05', true]].forEach(([id, ok]) => play(recovered, rally(id), ok));
  assert.equal(rallyMissed(recovered), null);
  const steady = newCoach('talk-rally');
  // 말 랠리는 능력 칸이 하나다: 칸 전체가 12개 중 10개 정답이면 마지막 묶음에 오답 둘이 있어도 「놓쳤다」고 하지 않는다.
  ['f01', 'f02', 'f03', 'f04', 'f05', 'f07', 'f08', 'f09', 'f10'].forEach((id) => play(steady, rally(id), true));
  [['r01', false], ['r02', false], ['r03', true]].forEach(([id, ok]) => play(steady, rally(id), ok));
  assert.equal(steady.summary().skills.find((s) => s.id === 'ko.listening.response').levels[1].formats['single-choice'].status, 'recent-independent');
  assert.equal(rallyMissed(steady), null);
  const mixed = newCoach('talk-rally');
  [['r01', false], ['w01', false], ['f01', false]].forEach(([id, ok]) => play(mixed, rally(id), ok));
  assert.equal(rallyMissed(mixed), null, '서로 다른 종류의 오답 하나씩은 한 종류의 실수가 아니다');
});

test('다른 게임의 오답·과제·불완전 기록·접힌 기록은 이 게임의 실수로 말하지 않는다', () => {
  const storage = memory(), other = createGame({ gameId: 'order-rush', map, storage });
  ['r01', 'r02', 'r03'].forEach((id) => play(other, rally(id), false));
  assert.equal(rallyMissed(createGame({ gameId: 'talk-rally', map, storage })), null);
  const assigned = newCoach('talk-rally');
  ['r01', 'r02', 'r03'].forEach((id) => play(assigned, rally(id), false));
  assert.equal(rallyMissed(assigned).patternId, 'yn');
  assigned.assignment = () => ({ skillId: 'ko.listening.response' });
  assert.equal(rallyMissed(assigned), null);
  const ended = newCoach('talk-rally');
  ['r01', 'r02', 'r03'].forEach((id) => play(ended, rally(id), false));
  ended.assignment = () => { throw Object.assign(new Error('ended'), { code: 'RUN_ENDED' }); };
  assert.equal(rallyMissed(ended), null);
  const partial = newCoach('talk-rally', { historyComplete: false });
  ['r01', 'r02', 'r03'].forEach((id) => play(partial, rally(id), false));
  assert.equal(rallyMissed(partial), null);
  assert.equal(rallyMissed(null), null);
  let now = Date.parse('2026-11-01T00:00:00Z');
  const folded = newCoach('talk-rally', { fold: { max: 6, keep: 1, ageMs: 1 }, clock: () => new Date(now += 5000).toISOString() });
  ['r01', 'r02', 'r03'].forEach((id) => play(folded, rally(id), false));
  for (const id of ['f01', 'f02']) play(folded, rally(id), true);
  assert.ok(folded.summary().storage.folded > 0, '기록이 실제로 접혔다');
  assert.equal(rallyMissed(folded), null, '접힌 응답은 출처를 잇지 못하므로 세지 않는다');
  const reset = newCoach('talk-rally');
  ['r01', 'r02', 'r03'].forEach((id) => play(reset, rally(id), false));
  reset.reset();
  assert.equal(rallyMissed(reset), null);
});

test('빈칸 베기: 조사·문형·낱말이 각각 다른 새 문장을 첫 문장으로 낸다', () => {
  for (const [pattern, ids, kinds] of [['particle', ['p01', 'p02', 'p03'], ['particle']], ['noun', ['v01', 'v05', 'v06'], ['noun']],
    ['predicate', ['v02', 'v07', 'v04'], ['verb', 'adjective']], ['ending', ['e01', 'e02', 'e04'], ['ending']]]) {
    const coach = newCoach('blank-slice');
    ids.forEach((id, i) => play(coach, slice(id), i === 2));
    const plan = sliceMissed(coach);
    assert.equal(plan.patternId, pattern); assert.ok(kinds.includes(plan.target.item.kind)); assert.ok(!ids.includes(plan.target.id));
    assert.equal(sliceRound(SLICE_ITEMS, { seed: 4, lead: plan.target.id })[0].id, plan.target.id);
  }
});

test('빈칸 베기: 이음말은 둘을 놓치면 남은 하나로 잇고, 새 문장이 없거나 패턴이 없는 말은 말하지 않는다', () => {
  const connector = newCoach('blank-slice');
  ['g01', 'g02'].forEach((id) => play(connector, slice(id), false));
  assert.equal(sliceMissed(connector).patternId, 'connector'); assert.equal(sliceMissed(connector).target.id, 'g03');
  play(connector, slice('g03'), false);
  assert.equal(sliceMissed(connector), null, '새 문장이 없으면 재노출을 새 문장으로 부르지 않는다');
  const counter = newCoach('blank-slice');
  ['v03', 'v09', 't01'].forEach((id) => play(counter, slice(id), false));
  assert.equal(sliceMissed(counter), null);
  const hard = newCoach('blank-slice');
  ['e03', 'e05', 'e09'].forEach((id) => play(hard, slice(id), false));
  const plan = sliceMissed(hard);
  assert.equal(plan.patternId, 'ending');
  assert.equal(sliceRound(SLICE_ITEMS, { seed: 1, lead: plan.target.id })[0].id, plan.target.id);
});

test('입장 검사: 놓친 능력의 새 손님이 근무에 반드시 들어가고 근무의 약속(6명·규칙·시각·알림)은 그대로다', () => {
  for (const [pattern, ids] of [['negation', ['pool-02', 'pool-07', 'library-06']], ['condition', ['pool-03', 'pool-05', 'pool-06']], ['detail', ['pool-01', 'pool-04', 'library-01']]]) {
    const coach = newCoach('entry-check');
    ids.forEach((id, i) => play(coach, entry(id), i === 2));
    const plan = entryMissed(coach, OPEN);
    assert.equal(plan.patternId, pattern); assert.ok(!ids.includes(plan.target.id)); assert.equal(plan.target.item.followupOnly, undefined);
    const venue = VENUES.find((v) => v.id === plan.target.venueId);
    assert.ok(composeShift(venue, { ranked: [plan.target.id] }).some((c) => c.id === plan.target.id));
  }
  for (const venue of VENUES) for (const c of venue.cases.filter((x) => !x.followupOnly)) {
    const base = composeShift(venue, {}), shift = composeShift(venue, { ranked: [c.id] });
    assert.ok(shift.some((x) => x.id === c.id), `${c.id} 포함`);
    assert.equal(shift.length, base.length, `${c.id} 크기`);
    assert.equal(new Set(shift.map((x) => x.id)).size, shift.length);
    assert.deepEqual(shift.map((x) => x.at), [...shift.map((x) => x.at)].sort());
    for (const rule of [...venue.notice.rules, ...(venue.memo ? [venue.memo.rule] : [])]) assert.ok(shift.some((x) => x.answer === rule.id), `${c.id}: 규칙 ${rule.id}`);
    assert.ok(shift.some((x) => x.answer === 'pass'), `${c.id}: 통과 손님`);
    if (venue.memo) assert.ok(shift.some((x) => x.at < venue.memo.at) && shift.filter((x) => x.at >= venue.memo.at).length >= 2, `${c.id}: 알림 전후`);
  }
});

test('입장 검사: 잠긴 근무지와 수동으로 고른 근무지 밖의 손님은 약속하지 않고, 연수 손님은 대상이 아니다', () => {
  const coach = newCoach('entry-check');
  ['pool-02', 'pool-07', 'library-06'].forEach((id) => play(coach, entry(id), false));
  assert.equal(entryMissed(coach, ['pool']), null, '수영장의 부정 손님은 이미 만났고 확인용 손님은 대상이 아니다');
  assert.equal(entryMissed(coach, ['pool', 'library']), null);
  assert.equal(entryMissed(coach, OPEN).target.venueId === 'museum' || entryMissed(coach, OPEN).target.venueId === 'concert', true);
  assert.equal(unlocked({ stars: {} }, 'museum'), false);
});

test('바람길: 달리기 응답은 근거가 아니고, 듣기 확인에서 놓친 능력의 새 문항이 듣기 확인 첫 문제다', () => {
  const run = newCoach('korean-runner');
  INSTRUCTIONS.filter((x) => instructionMetadata(x).skillId === 'ko.listening.sequence').slice(0, 4).forEach((x) => {
    const pid = run.present(instructionMetadata(x)); run.delivery(pid, { audio: 'completed' }); run.answer(pid, { correct: false, assessable: false, reason: 'motor' });
  });
  assert.equal(missedCheck(run), null);
  for (const [pattern, ids] of [['sequence', ['check-duck-jump', 'check-middle-left', 'check-right-before-jump']], ['detail', ['check-star-middle', 'check-wide-left', 'check-fence-jump']], ['negation', ['check-not-middle', 'check-not-left', 'check-no-fence']]]) {
    const coach = newCoach('korean-runner');
    ids.forEach((id, i) => play(coach, check(id), i === 1));
    const plan = missedCheck(coach);
    assert.equal(plan.patternId, pattern); assert.ok(!ids.includes(plan.target.id));
    const round = createListeningCheckRound(coach, { assignment: null, lead: plan.target.item }), first = round.next();
    assert.equal(first.item.id, plan.target.id); assert.equal(first.index, 0); assert.equal(first.exposure, 'new');
    const pid = coach.present(checkMetadata(first.item));
    assert.ok(pid);
    assert.notEqual(round.next({ item: first.item, result: { verdict: 'correct' } }).item?.id, first.item.id);
  }
});

test('바람길: 과제가 있으면 맨 앞 문항을 바꾸지 않는다', () => {
  const coach = newCoach('korean-runner'), items = LISTENING_CHECKS.filter((x) => checkMetadata(x).skillId === 'ko.listening.detail');
  const assignment = { ...checkMetadata(items[0]), familyKeys: items.map((x) => checkMetadata(x).familyKey), itemKeys: items.map((x) => checkMetadata(x).itemKey), requiredAttempts: 3 };
  const lead = LISTENING_CHECKS.find((x) => x.id === 'check-duck-jump');
  assert.notEqual(createListeningCheckRound(coach, { assignment, lead }).next().item.id, lead.id);
});

// 11-04: 순서를 두 번 놓친 뒤 맞춤 첫 문제(마지막 새 순서 문장)의 소리가 실패한 채 답 없이 나가면 다음 방문에 안내가 사라졌다.
const SEQ_MISSED = ['check-duck-jump', 'check-middle-left', 'check-left-run'], SEQ_LEFT = 'check-right-before-jump';
const checkItem = (id) => LISTENING_CHECKS.find((x) => x.id === id);
function sequenceMissed(options) {
  const coach = newCoach('korean-runner', options);
  SEQ_MISSED.forEach((id, i) => play(coach, check(id), i === 1));
  return coach;
}
/** 게임과 같은 길: 듣기 확인 한 문제를 열고 소리 상태를 거친 뒤 답하지 않고 닫는다. */
function leave(coach, id, audio = ['failed'], { help = null } = {}) {
  const run = createListeningCheck(coach), token = run.begin(checkItem(id));
  for (const status of audio) run.delivery(token, status);
  if (help) coach.help(run.current.pid, help);
  run.cancel();
}
test('바람길: 소리를 마치지 못하고 답 없이 남긴 맞춤 첫 문제는 같은 문장 다시 듣기로 다시 첫 문제가 되고, 정상 답 뒤에는 사라진다', () => {
  const coach = sequenceMissed();
  const first = missedCheck(coach);
  assert.equal(first.target.id, SEQ_LEFT); assert.equal(first.repeat, false); assert.equal(first.next, RUNNER_PATTERNS.sequence.next);
  leave(coach, SEQ_LEFT);
  const again = missedCheck(coach);
  assert.equal(again.patternId, 'sequence'); assert.equal(again.target.id, SEQ_LEFT); assert.equal(again.repeat, true);
  assert.equal(`${again.why} ${again.next}`, `${RUNNER_PATTERNS.sequence.why} ${AUDIO_RETRY_NEXT}`);
  assert.match(again.next, /‘소리를 마치지 못한 문장 다시 듣기’/);
  const round = createListeningCheckRound(coach, { assignment: null, lead: again.target.item }), lead = round.next();
  assert.equal(lead.item.id, SEQ_LEFT); assert.equal(lead.index, 0);
  assert.equal(lead.exposure, 'review'); assert.doesNotMatch(lead.note, /처음 듣는/);
  // 다시 연 문장을 소리 없이 또 닫아도 아직 마치지 못한 문장이라 제안이 남는다.
  leave(coach, SEQ_LEFT, []);
  assert.equal(missedCheck(coach).repeat, true); assert.equal(missedCheck(coach).target.id, SEQ_LEFT);
  // 이번에는 소리가 끝까지 나오고 정답 하나: 채점된 답이 하나 생기고 다음 방문에는 이 제안이 없다.
  const run = createListeningCheck(coach), token = run.begin(lead.item);
  run.delivery(token, 'completed');
  assert.equal(run.answer(lead.item.correct).verdict, 'correct');
  assert.equal(missedCheck(coach)?.repeat ?? null, null);
  assert.equal(missedCheck(coach), null);
  // 오답 하나도 정상 응답이라 해소된다.
  const wrong = sequenceMissed(); leave(wrong, SEQ_LEFT);
  const w = createListeningCheck(wrong), wt = w.begin(checkItem(SEQ_LEFT)); w.delivery(wt, 'completed'); w.answer((checkItem(SEQ_LEFT).correct + 1) % 3);
  assert.equal(missedCheck(wrong), null);
});
test('바람길: 같은 패턴의 새 문장이 남아 있으면 소리 실패보다 새 문장이 먼저고, 새 문항 안내도 그대로다', () => {
  const coach = sequenceMissed();
  leave(coach, 'check-left-run');
  const plan = missedCheck(coach);
  assert.equal(plan.target.id, SEQ_LEFT); assert.equal(plan.repeat, false); assert.equal(plan.next, RUNNER_PATTERNS.sequence.next);
  assert.equal(createListeningCheckRound(coach, { assignment: null, lead: plan.target.item }).next().exposure, 'new');
});
test('바람길: 소리 실패가 아니거나 근거가 다른 경우에는 소리를 마치지 못한 문장 안내가 뜨지 않는다', () => {
  const noRetry = (coach, label) => assert.ok(!missedCheck(coach)?.repeat && missedCheck(coach)?.next !== AUDIO_RETRY_NEXT, label);
  noRetry(newCoach('korean-runner'), '기록 없는 새 학생');
  const unplayed = sequenceMissed(); leave(unplayed, SEQ_LEFT, []); noRetry(unplayed, '소리를 틀지 않고 닫음');
  const pending = sequenceMissed(); leave(pending, SEQ_LEFT, ['pending']); noRetry(pending, '재생 중 닫음(실패 아님)');
  const unanswered = sequenceMissed(); leave(unanswered, SEQ_LEFT, ['failed', 'pending', 'completed']); noRetry(unanswered, '끝까지 들은 뒤 답 없이 닫음');
  const hinted = sequenceMissed(); leave(hinted, SEQ_LEFT, ['failed'], { help: 'text' }); noRetry(hinted, '도움을 본 문장');
  const once = newCoach('korean-runner'); play(once, check('check-duck-jump'), false); leave(once, SEQ_LEFT); noRetry(once, '오답 한 건뿐');
  const removed = sequenceMissed(); leave(removed, SEQ_LEFT);
  removed.exclude(removed.events().find((e) => e.type === 'practice.delivery' && e.audio === 'failed').id); noRetry(removed, '지운 소리 기록');
  const partial = sequenceMissed(); leave(partial, SEQ_LEFT);
  noRetry({ ...partial, summary: () => ({ ...partial.summary(), evidenceComplete: false }), events: () => partial.events(), exposure: (m) => partial.exposure(m), recommend: (...a) => partial.recommend(...a) }, '기록을 다 받지 못함');
  const assigned = sequenceMissed(); leave(assigned, SEQ_LEFT); assigned.assignment = () => ({ skillId: 'ko.listening.sequence' }); assert.equal(missedCheck(assigned), null, '과제');
  // 다른 게임이 같은 문장 꼴을 열다 소리가 실패한 기록: 같은 저장소의 다른 게임 기록이라 이 게임 문장으로 되살리지 않는다.
  const storage = memory(), runner = createGame({ gameId: 'korean-runner', map, storage });
  SEQ_MISSED.forEach((id, i) => play(runner, check(id), i === 1));
  const other = createGame({ gameId: 'korean-rhythm', map, storage }), pid = other.present(check(SEQ_LEFT));
  other.delivery(pid, { audio: 'failed' }); other.answer(pid, { correct: null, assessable: false });
  const shared = createGame({ gameId: 'korean-runner', map, storage });
  assert.ok(shared.events().some((e) => e.type === 'practice.delivery' && e.presentationId === pid), '다른 게임 기록이 같은 장부에 있다');
  noRetry(shared, '다른 게임');
});

test('말의 리듬: 관문을 옮겨도 음성·질문·기록은 같은 문항이고 모든 곡·난이도·문항에서 문제없이 만들어진다', () => {
  for (const track of TRACKS) for (const level of Object.keys(LEVELS)) for (let lead = 0; lead < track.questions.length; lead++) for (const seed of [1, 77]) {
    const { questions } = buildChart(track, level, seed, { lead }), plain = buildChart(track, level, seed);
    assert.equal(questions[0].sourceIndex, lead);
    assert.deepEqual(questions.map((q) => q.sourceIndex).sort(), [0, 1, 2, 3, 4]);
    assert.deepEqual(questions.map((q) => q.beat), plain.questions.map((q) => q.beat));
    for (const q of questions) {
      const same = plain.questions.find((x) => x.sourceIndex === q.sourceIndex);
      assert.equal(q.voice, NARRATION[`t${track.id}q${q.sourceIndex}v${q.variant}`]);
      assert.equal(q.recall.voice, NARRATION[`t${track.id}q${q.sourceIndex}r`]);
      assert.equal(q.question, same.question); assert.equal(q.variant, same.variant); assert.equal(q.answer, same.answer);
      assert.equal(rhythmItem(track.id, q).familyKey, rhythmItem(track.id, same).familyKey);
      assert.ok(q.showTime >= 1 && q.voiceEnd <= q.answerOpen - .4 && q.answerOpen < q.closeTime);
    }
    assert.deepEqual(plain.questions.map((q) => q.sourceIndex), [0, 1, 2, 3, 4]);
  }
  assert.equal(new RoundState(TRACKS[1], 'easy', 1, { lead: 3 }).questions[0].sourceIndex, 3);
  const assigned = { ...TRACKS[0], variantChoices: { 2: [1] } };
  assert.equal(buildChart(assigned, 'easy', 3, { lead: 2 }).questions[0].variant, 1);
});

test('말의 리듬: 곡에 새 문항이 있으면 그 곡 첫 관문으로, 없으면 보충 연습의 새 대화로 연다', () => {
  const song = newCoach('korean-rhythm');
  [[0, 0], [0, 1], [1, 1]].forEach(([t, i], at) => play(song, rhythmItem(t, { sourceIndex: i, variant: 0 }), at === 2));
  let plan = missedRhythm(song);
  assert.equal(plan.patternId, 'detail'); assert.equal(plan.target.item.kind, 'song');
  assert.deepEqual([plan.target.item.trackId, plan.target.item.sourceIndex], [1, 3]);
  assert.match(rhythmLine(plan), /첫 문제도 그런 문제/);
  const supply = newCoach('korean-rhythm');
  [2, 3, 4].forEach((i, at) => play(supply, rhythmItem(0, { sourceIndex: i, variant: 0 }), at === 0));
  plan = missedRhythm(supply);
  assert.equal(plan.patternId, 'negation'); assert.equal(plan.target.item.kind, 'supplemental');
  assert.equal(plan.target.meta.skillId, 'ko.listening.negation'); assert.equal(plan.target.meta.difficulty, 1);
  assert.match(rhythmLine(plan), /놓친 표현 바로 연습/);
  const pool = missedSupplementalPool(supply, plan.target.item.row);
  assert.equal(pool[0].id, plan.target.id); assert.ok(pool.length >= 3);
  assert.ok(pool.every((x) => x.skillId === 'ko.listening.negation' && x.difficulty === 1));
  assert.equal(missedRhythm(supply, { songsOnly: true }), null, '보충 연습이 없는 체험 판은 없는 단추를 약속하지 않는다');
  const reason = newCoach('korean-rhythm');
  [0, 2, 4].forEach((i) => play(reason, rhythmItem(1, { sourceIndex: i, variant: 0 }), false));
  assert.equal(missedRhythm(reason).patternId, 'reason');
  const noAudio = newCoach('korean-rhythm');
  [0, 2, 4].forEach((i) => play(noAudio, rhythmItem(1, { sourceIndex: i, variant: 0 }), false, { audio: 'failed' }));
  assert.equal(missedRhythm(noAudio), null);
  assert.ok(supplementalItems().every((x) => x.supplyRole === 'practice'));
});

test('말의 리듬: 들은 보충 대화는 다시 새 대화로 내지 않는다', () => {
  const coach = newCoach('korean-rhythm');
  [2, 3, 4].forEach((i) => play(coach, rhythmItem(0, { sourceIndex: i, variant: 0 }), false));
  const pool = supplementalItems({ skillId: 'ko.listening.negation', difficulty: 1 });
  play(coach, pool[0], false); play(coach, pool[1], false);
  const plan = missedRhythm(coach);
  assert.ok(![pool[0].id, pool[1].id].includes(plan.target.id));
  assert.ok(!missedSupplementalPool(coach, plan.target.item.row).some((x) => [pool[0].id, pool[1].id].includes(x.id)));
});

test('레이싱: 코스 묶음마다 다른 새 문항이 맞춤 5문항의 첫 문제이고, 듣기 맞춤은 소리가 없으면 나오지 않는다', () => {
  for (const [pattern, ids, prefix] of [['read.particle', ['c03q1', 'c03q2', 'c03q3'], 'c03'], ['read.connector', ['c04q1', 'c04q2', 'c04q3'], 'c04'], ['listen.short', ['c01q1', 'c01q2', 'c01q3'], 'c0'], ['read.detail', ['c09q1', 'c09q2', 'c09q3'], 'c']]) {
    const coach = newCoach('korean-racing');
    ids.forEach((id, i) => play(coach, racing(id), i === 0));
    const plan = missedRacing(coach);
    assert.equal(plan.patternId, pattern); assert.ok(plan.target.id.startsWith(prefix)); assert.ok(!ids.includes(plan.target.id));
    const personal = personalizedStage(coach, { lead: plan.target.item });
    assert.equal(personal.stage.items[0].id, plan.target.id); assert.equal(personal.stage.items.length, 5);
    assert.equal(new Set(personal.stage.items.map((q) => q.id)).size, 5);
  }
  const quiet = newCoach('korean-racing');
  ['c01q1', 'c01q2', 'c01q3'].forEach((id) => play(quiet, racing(id), false));
  assert.equal(missedRacing(quiet, { audioAvailable: false }), null);
  assert.equal(missedRacing(quiet, { modality: 'reading' }), null);
  const negation = newCoach('korean-racing');
  ['c06q3', 'c07q2'].forEach((id) => play(negation, racing(id), false));
  assert.equal(missedRacing(negation).target.id, 'c08q3');
  const finale = newCoach('korean-racing');
  ['f01q1', 'f01q2', 'f01q3'].forEach((id) => { const pid = finale.present({ ...racing('c01q1'), id, itemKey: `korean-racing:${id}:v1`, familyKey: `korean-racing:${id}:v1` }); finale.delivery(pid, { audio: 'completed' }); finale.answer(pid, { correct: false, assessable: true }); });
  assert.equal(missedRacing(finale), null, '결승 문항은 맞춤 근거와 대상이 아니다');
  assert.deepEqual(RACING_CANDIDATES.filter((c) => c.id.startsWith('f')).length, 0);
});

test('이야기 교실: 혼자 읽은 부탁만 근거이고, 새 부탁을 먼저 열며, 없으면 다시 읽는 것이라고 말한다', () => {
  const detail = newCoach('story-classroom');
  ['cleanup-snacks', 'clue-flowers', 'surprise-cake'].forEach((id, i) => play(detail, missionMetadata(mission(id)), i === 0));
  let plan = missedStory(detail);
  assert.equal(plan.patternId, 'detail'); assert.equal(plan.target.id, 'review-snacks'); assert.equal(plan.repeat, false);
  assert.match(storyLine(plan), /새 부탁/);
  const game = new StoryGame();
  assert.equal(game.startPractice([plan.target.id]), true);
  assert.equal(game.phase, 'review'); assert.ok(game.missions.some((m) => m.id === plan.target.id));
  const readAloud = newCoach('story-classroom');
  ['cleanup-snacks', 'clue-flowers', 'surprise-cake'].forEach((id) => play(readAloud, missionMetadata(mission(id)), false, { help: 'replay' }));
  assert.equal(missedStory(readAloud), null, '자동 읽기를 들은 답은 독립 응답이 아니다');
  const negation = newCoach('story-classroom');
  ['cleanup-paper', 'review-paper'].forEach((id) => play(negation, missionMetadata(mission(id)), false));
  plan = missedStory(negation);
  assert.equal(plan.patternId, 'negation'); assert.equal(plan.repeat, true); assert.equal(plan.target.id, 'review-paper');
  assert.match(storyLine(plan), /이미 본/);
  const sequence = newCoach('story-classroom');
  ['clue-letter', 'surprise-ribbon', 'review-cake'].forEach((id, i) => play(sequence, missionMetadata(mission(id)), i === 2));
  plan = missedStory(sequence);
  assert.equal(plan.patternId, 'sequence'); assert.equal(plan.repeat, true); assert.equal(plan.target.id, 'surprise-ribbon');
  const scene = new StoryGame();
  assert.equal(scene.startPractice([plan.target.id]), true);
  assert.ok(scene.missions.some((m) => m.id === 'surprise-cake'), '순서 부탁은 앞 부탁과 같은 장면에서 연다');
  sequence.assignment = () => ({ skillId: 'ko.reading.sequence' });
  assert.equal(missedStory(sequence), null);
});

// ── 재방문 안내 문구: 패턴 값이 아니라 학생에게 실제로 보이는 문장으로 본다 ──
const source = (rel) => readFileSync(new URL(`../experiences/${rel}`, import.meta.url), 'utf8');
const whyAndNext = '`${plan.why} ${plan.next}`';
const warmupCopy = { rally: ' 연습 공을 마치면 바로 나와요.', slice: ' 연습 문장을 마치면 바로 나와요.' };
/** 파일별로 화면에 나가는 고정 템플릿. 코드에 그대로 있는지 확인하고, 없는 경로가 새로 생기면 아래 개수 대조에서 걸린다. */
const TEMPLATES = {
  rally: { patterns: RALLY_PATTERNS, file: 'talk-rally/app.mjs', codes: [whyAndNext, '`${plan.why} ‘다음 판 시작’의 첫 공도 그런 말이에요.`'] },
  slice: { patterns: SLICE_PATTERNS, file: 'blank-slice/app.mjs', codes: [whyAndNext, '`${plan.why} 다음 판 첫 문장도 그런 문장이에요.`'] },
  entry: { patterns: ENTRY_PATTERNS, file: 'entry-check/app.mjs', codes: [whyAndNext, '`${state.returnPlan.why} ${state.returnPlan.next}`', '`${drill.why} 이 손님 한 명만 보고 근무지 고르는 화면으로 돌아와요.`', '`${plan.why} ‘추천 근무 시작’에 그런 손님이 와요.`'] },
  runner: { patterns: RUNNER_PATTERNS, file: 'korean-runner/app.mjs', codes: [whyAndNext] },
};
const fill = (code, pattern) => code.slice(1, -1).replace(/\$\{[\w.]*\.why\}/, pattern.why).replace(/\$\{[\w.]*\.next\}/, pattern.next);
// 레이싱의 안내는 lobby.js 안에만 있어 불러올 수 없으므로 원문 조각을 대조해 조합한다.
const RACING_TAILS = ['이 코스 첫 문제도 그런 문제예요.', '‘놓친 문제 바로 연습’의 첫 문제도 그런 문제예요.'], RACING_FIRST_RUN = ' 조작 연습을 마치거나 건너뛰면 바로 이어져요.';
const STORY_RESUME = ' 하던 이야기는 이어 하기로 계속할 수 있어요.';
const SUPPLY = supplementalItems({ purpose: 'practice' });
const ALL_MISSIONS = [...EPISODE.acts.flatMap((a) => a.missions), ...EPISODE.review];
/** 게임별로 학생이 실제로 볼 수 있는 재방문 안내 전부(패턴 × 분기). 이야기의 들은 부탁 제안은 원고를 인용하는 기능이라 따로 본다. */
function visibleLines() {
  const lines = {};
  for (const [game, { patterns, file, codes }] of Object.entries(TEMPLATES)) {
    const code = source(file);
    for (const template of codes) assert.ok(code.includes(template), `${file}에 없는 템플릿 ${template}`);
    const warmup = warmupCopy[game];
    if (warmup) assert.ok(code.includes(`${whyAndNext} + (progress.practiced ? '' : '${warmup}')`), `${file}의 첫 조작 연습 안내`);
    lines[game] = Object.values(patterns).flatMap((pattern) => codes.flatMap((template) => {
      const text = fill(template, pattern);
      return warmup && template === whyAndNext ? [text, text + warmup] : [text];
    }));
  }
  // 바람길의 소리를 마치지 못한 문장 다시 듣기: 같은 템플릿에 next만 바뀐다(listening-check.mjs의 missedCheck).
  lines.runner.push(...Object.values(RUNNER_PATTERNS).map((pattern) => fill(whyAndNext, { ...pattern, next: AUDIO_RETRY_NEXT })));
  const lobby = source('korean-racing/lobby.js');
  for (const piece of [...RACING_TAILS, RACING_FIRST_RUN]) assert.ok(lobby.includes(piece), `lobby.js에 없는 안내 ${piece}`);
  lines.racing = Object.values(RACING_PATTERNS).flatMap(({ why }) => RACING_TAILS.flatMap((tail) => [`${why} ${tail}`, `${why} ${tail}${RACING_FIRST_RUN}`]));
  lines.rhythm = Object.values(RHYTHM_PATTERNS).flatMap(({ why }) => [
    ...TRACKS.map((_, trackId) => rhythmLine({ why, target: { item: { kind: 'song', trackId } } })),
    rhythmLine({ why, target: { item: { kind: 'supplemental' } } }),
  ]);
  assert.ok(source('story-classroom/app.mjs').includes(`'${STORY_RESUME}'`));
  lines.story = Object.values(STORY_PATTERNS).flatMap(({ why }) => [false, true].flatMap((repeat) => [storyLine({ why, repeat }), `${storyLine({ why, repeat })}${STORY_RESUME}`]));
  return lines;
}
/** 들으며 놓친 사실로 실제 함수가 만든 제안: 서로 다른 장면의 묶음(세 종류)과 약한 제안. */
function storyOffers() {
  const missing = (ids) => { const coach = newCoach('story-classroom'); for (const id of ids) play(coach, missionMetadata(mission(id)), false, { help: 'replay' }); return supportedPractice(coach); };
  const offers = [missing(['cleanup-snacks', 'clue-flowers']), missing(['clue-letter', 'surprise-ribbon']), missing(['cleanup-paper', 'review-paper'])];
  offers.forEach((offer) => assert.equal(offer.strength, 'repeated'));
  const once = newCoach('story-classroom');
  play(once, missionMetadata(mission('clue-flowers')), true, { help: 'replay' });
  const gentle = supportedPractice(once);
  assert.equal(gentle.strength, 'gentle');
  return [...offers, gentle];
}
const TONE = /틀렸|틀린|모르|못하|약해|부족/;
// 조사처럼 짧은 답(을·이·에서)은 보통 글자와 겹치므로 답을 짚어 인용했을 때만 잡는다. 긴 답은 글 어디에 있어도 잡는다.
// 이야기의 답은 친구·물건·놓을 곳의 이름이라 짧아도 보통 글자와 겹치지 않으므로 그대로 찾는다.
const quoted = (text, answer) => [`‘${answer}’`, `“${answer}”`, `「${answer}」`, `'${answer}'`, `"${answer}"`].some((mark) => text.includes(mark));
const leaks = (text, answer) => (answer.length >= 3 ? text.includes(answer) : quoted(text, answer));
const standaloneOX = /(^|[^A-Za-z])[OX]([^A-Za-z]|$)/;
const textOf = (row) => { const choice = row.choices.find((c) => c.id === row.correctId); return choice.text ?? choice.label ?? choice.word; };
/** 게임별 「정답」. 입장 검사의 답은 규칙 줄이므로 규칙 이름과 원문이고, 리듬은 판단할 문장과 정답 보기다. */
const ANSWERS = {
  rally: RALLY_ITEMS.map((x) => x.answer),
  slice: SLICE_ITEMS.map((x) => x.answer),
  entry: VENUES.flatMap((v) => [...v.notice.rules, ...(v.memo ? [v.memo.rule] : [])]).flatMap((rule) => [rule.short, rule.text]).filter(Boolean),
  runner: LISTENING_CHECKS.map((x) => x.choices[x.correct]),
  racing: RACING_CANDIDATES.map((c) => c.item.word).filter(Boolean),
  rhythm: [...TRACKS.flatMap((t) => t.questions.flatMap((q) => [q.prompt, ...q.claims.map((c) => c.question)])), ...SUPPLY.flatMap((row) => [row.question, textOf(row)])].filter(Boolean),
  story: [...ALL_MISSIONS.map((m) => m.text), ...new Set(ALL_MISSIONS.flatMap((m) => [m.actor, m.object, m.destination]).map((id) => STORY_NAMES[id]))],
};

test('재방문 안내: 7개 게임의 패턴은 사실만 말하고, 화면에 나가는 문장 전부에 단정 표현이 없다', () => {
  const all = { RALLY_PATTERNS, SLICE_PATTERNS, ENTRY_PATTERNS, RUNNER_PATTERNS, RHYTHM_PATTERNS, RACING_PATTERNS, STORY_PATTERNS };
  for (const [name, patterns] of Object.entries(all)) for (const [id, pattern] of Object.entries(patterns)) assert.match(pattern.why, /놓친 적이 있어요\.$/, `${name}.${id}`);
  const lines = visibleLines();
  assert.deepEqual(Object.keys(lines).sort(), Object.keys(ANSWERS).sort());
  for (const [game, list] of Object.entries(lines)) {
    assert.ok(list.length > 0, game);
    for (const line of list) { assert.doesNotMatch(line, TONE, `${game}: ${line}`); assert.doesNotMatch(line, /undefined|\$\{/, `${game}: ${line}`); }
  }
});
test('재방문 안내: 고정 템플릿 표에 없는 안내 경로가 화면 코드에 새로 생기면 알아챈다', () => {
  const count = (file) => (source(file).match(/\$\{[\w.]*(?:plan|Plan|drill)\.why\}/g) || []).length;
  for (const { file, codes } of Object.values(TEMPLATES)) assert.equal(count(file), codes.length, file);
  assert.equal((source('korean-racing/lobby.js').match(/returnPlan\.why\}/g) || []).length, 1);
  assert.equal(count('korean-rhythm/app.mjs'), 0, '리듬 화면은 returnLine으로만 말한다');
  assert.equal(count('story-classroom/app.mjs'), 0, '이야기 화면은 returnLine으로만 말한다');
});
test('재방문 안내: 7개 게임의 문장에 저작 정답·규칙·판단 문장이 없다(짧은 답은 인용한 경우만 본다)', () => {
  const lines = visibleLines();
  for (const [game, answers] of Object.entries(ANSWERS)) {
    assert.ok(answers.length > 0, game);
    for (const line of lines[game]) for (const answer of answers) assert.ok(!(game === 'story' ? line.includes(answer) : leaks(line, answer)), `${game}: 「${answer}」 → ${line}`);
  }
  for (const line of lines.rhythm) assert.doesNotMatch(line, standaloneOX, line);
  // 판별력 확인: 보통 글자는 잡지 않고, 짚어 인용한 답은 잡는다.
  assert.equal(leaks('이번 첫 문장도 그런 문장이에요.', '이'), false);
  assert.equal(leaks('이번에는 ‘에서’를 고르세요.', '에서'), true);
  assert.doesNotMatch('BOX와 OK 안내', standaloneOX);
  assert.match('정답은 O예요', standaloneOX);
});
test('이야기: 들으며 한 부탁 제안은 그 부탁 원문만 인용하고, 나머지 말에는 단정 표현과 답이 없다', () => {
  for (const offer of storyOffers()) {
    const own = ALL_MISSIONS.find((m) => m.id === offer.missionId);
    assert.ok(offer.line.includes(`‘${own.text}’`), '이 기능은 부탁 원문을 그대로 보여 준다');
    const rest = offer.line.replace(`‘${own.text}’`, ' ');
    assert.doesNotMatch(rest, TONE, offer.line);
    for (const answer of ANSWERS.story) assert.ok(!rest.includes(answer), `「${answer}」 → ${offer.line}`);
  }
});
