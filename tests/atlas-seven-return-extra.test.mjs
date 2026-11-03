// 입장 검사 한 손님 연습 · 이야기 교실 들으며 했던 부탁: 합성 기록은 실제 Atlas 공개 경로(present·help·answer)로만 만든다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(import.meta.dirname, '..');
const EXP = path.join(REPO, 'experiences');
const load = (rel) => import(pathToFileURL(path.join(EXP, rel)).href);
const require = createRequire(path.join(REPO, 'x.js')), { createGame } = require('./atlas/game-learning.js'), { createMap } = require('./strata/index.js');
const map = createMap(require('./strata/topik-i').topikMap());
const memory = () => { const data = new Map(); return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; };
const newCoach = (gameId, options = {}) => createGame({ gameId, map, storage: memory(), ...options });

const { EPISODE } = await load('story-classroom/story.mjs');
const { missionMetadata, missedStory, createStoryLearning } = await load('story-classroom/learning.mjs');
const { supportedPractice } = await load('story-classroom/supported-practice.mjs');
const { StoryGame } = await load('story-classroom/core.mjs');
const { VENUES } = await load('entry-check/content.mjs');
const { composeShift, activeRules, minutes } = await load('entry-check/core.mjs');
const { caseMetadata, soloGuestPlan } = await load('entry-check/learning.mjs');
const { immediateCheck } = await load('entry-check/correction.mjs');

const MISSIONS = new Map([...EPISODE.acts.flatMap(a => a.missions), ...EPISODE.review].map(m => [m.id, m]));
const SEQ = ['clue-letter', 'surprise-ribbon', 'review-cake'], DETAIL = ['cleanup-snacks', 'clue-flowers', 'surprise-cake', 'review-snacks'], NEG = ['cleanup-paper', 'review-paper'];
/** 기본 자동 읽기로 한 시도. help는 게임이 실제로 부르는 수준이다. */
function storyTry(coach, id, correct, { help = ['replay'], confounded = false, answer = 'answer' } = {}) {
  const meta = { ...missionMetadata(MISSIONS.get(id)), confounded };
  const pid = coach.present(meta);
  for (const h of help) coach.help(pid, h);
  if (answer === 'answer') return coach.answer(pid, confounded ? { correct, assessable: false, attemptNo: 1, reason: 'storage' } : { correct, assessable: true, attemptNo: 1 });
  if (answer === 'skip') return coach.answer(pid, { correct: null, assessable: false, reason: 'unanswered' });
  return null;
}
const FORBIDDEN = /틀렸|틀린|못 읽|못읽|어려|모르|끄|자동 읽기|약점|부족/;

test('이야기: 기본 자동 읽기로 서로 다른 두 장면을 놓치면 사실과 그 부탁을 말하고, 독립 근거 경로는 비어 있다', () => {
  const coach = newCoach('story-classroom');
  storyTry(coach, 'clue-letter', false); storyTry(coach, 'surprise-ribbon', false);
  assert.equal(missedStory(coach), null);
  const offer = supportedPractice(coach);
  assert.equal(offer.strength, 'repeated');
  assert.equal(offer.missionId, 'surprise-ribbon');
  assert.match(offer.line, /^부탁을 들으며 했던 ‘케이크를 놓은 다음, 마린은 리본을 칠판에 붙여 줘\.’처럼 먼저 할 일이 있는 부탁을 두 장면에서/);
  assert.match(offer.line, /한 번 더 해 볼까요\?$/);
  assert.doesNotMatch(offer.line, FORBIDDEN);
});
test('이야기: 세 장면이면 세 장면이라고 말하고, 읽어 주기를 안 들은 오답이 섞이면 「들으며」라고 하지 않는다', () => {
  const three = newCoach('story-classroom');
  for (const id of SEQ) storyTry(three, id, false);
  assert.match(supportedPractice(three).line, /세 장면/);
  const mixed = newCoach('story-classroom');
  storyTry(mixed, 'clue-letter', false); storyTry(mixed, 'surprise-ribbon', false, { help: [] });
  assert.match(supportedPractice(mixed).line, /^지난 이야기에서 했던/);
});
test('이야기: 한 번 틀림은 묶음이 아니고, 약한 제안은 결과를 말하지 않으며 놓친 부탁을 집어내지 않는다', () => {
  const coach = newCoach('story-classroom');
  storyTry(coach, 'cleanup-snacks', true); storyTry(coach, 'cleanup-paper', false); storyTry(coach, 'clue-flowers', true);
  const offer = supportedPractice(coach);
  assert.equal(offer.strength, 'gentle');
  assert.equal(offer.missionId, 'clue-flowers');
  assert.doesNotMatch(offer.line, /놓친|다르게|첫 번/);
  assert.doesNotMatch(offer.line, FORBIDDEN);
});
test('이야기: 읽어 주기를 안 들은 사람에게는 「들으며」라는 제안을 하지 않는다', () => {
  const coach = newCoach('story-classroom');
  storyTry(coach, 'cleanup-snacks', true, { help: [] });
  assert.equal(supportedPractice(coach), null);
  storyTry(coach, 'clue-flowers', true); storyTry(coach, 'surprise-cake', true, { help: [] });
  assert.equal(supportedPractice(coach), null);
});
test('이야기: 종류가 다른 오답 둘은 묶지 않는다', () => {
  const coach = newCoach('story-classroom');
  storyTry(coach, 'cleanup-paper', false); storyTry(coach, 'clue-letter', false);
  assert.equal(supportedPractice(coach).strength, 'gentle');
});
test('이야기: 답을 알려 준 도움 뒤 오답·무응답·제시만 된 것·복원 미평가는 세지 않는다', () => {
  for (const spoil of [{ help: ['replay', 'answer'] }, { help: ['answer'] }, { help: ['hint'] }]) {
    const coach = newCoach('story-classroom');
    storyTry(coach, 'clue-letter', false, spoil); storyTry(coach, 'surprise-ribbon', false, spoil);
    assert.equal(supportedPractice(coach), null);
  }
  for (const option of [{ answer: 'skip' }, { answer: 'none' }, { confounded: true }]) {
    const coach = newCoach('story-classroom');
    storyTry(coach, 'clue-letter', false, option); storyTry(coach, 'surprise-ribbon', false, option);
    assert.equal(supportedPractice(coach), null);
  }
});
test('이야기: 다른 게임 기록은 같은 저장소에 있어도 세지 않는다', () => {
  const storage = memory(), other = createGame({ gameId: 'entry-check', map, storage });
  for (const id of ['clue-letter', 'surprise-ribbon']) {
    const pid = other.present(missionMetadata(MISSIONS.get(id))); other.help(pid, 'replay'); other.answer(pid, { correct: false, assessable: true });
  }
  other.flush?.();
  const coach = createGame({ gameId: 'story-classroom', map, storage });
  assert.ok(coach.events().some(e => e.type === 'practice.attempted'), '같은 저장소 공유 확인');
  assert.equal(supportedPractice(coach), null);
});
test('이야기: 다시 해서 첫 시도가 맞으면 묶음이 사라지고, 재시도는 독립 근거가 되지 않는다', () => {
  const coach = newCoach('story-classroom');
  storyTry(coach, 'clue-letter', false); storyTry(coach, 'surprise-ribbon', false);
  assert.equal(supportedPractice(coach).strength, 'repeated');
  const again = storyTry(coach, 'surprise-ribbon', true, { help: [] });
  assert.equal(again.exposure, 'repeat'); assert.equal(again.independent, false);
  assert.notEqual(supportedPractice(coach)?.strength, 'repeated');
});
test('이야기: 읽기만 하고 Trail 요약·칸을 바꾸지 않으며, 들은 오답은 독립 근거 칸에 들어가지 않는다', () => {
  const coach = newCoach('story-classroom');
  storyTry(coach, 'clue-letter', false); storyTry(coach, 'surprise-ribbon', false);
  const before = JSON.stringify(coach.summary()), events = coach.events().length;
  supportedPractice(coach); supportedPractice(coach);
  assert.equal(coach.events().length, events);
  assert.equal(JSON.stringify(coach.summary()), before);
  for (const level of Object.values(coach.summary().skills.find(s => s.id === 'ko.reading.sequence').levels)) for (const cell of Object.values(level.formats)) assert.equal(cell.n || 0, 0);
});
test('이야기: 저장이 안 되거나 기록을 다 못 받으면 묶음을 말하지 않는다', () => {
  assert.equal(supportedPractice(null), null);
  assert.equal(supportedPractice({ summary: () => { throw new Error('x'); }, events: () => [] }), null);
  const coach = newCoach('story-classroom');
  storyTry(coach, 'clue-letter', false); storyTry(coach, 'surprise-ribbon', false);
  assert.equal(supportedPractice({ summary: () => ({ ...coach.summary(), evidenceComplete: false }), events: () => coach.events() }).strength, 'gentle');
  assert.equal(supportedPractice({ summary: () => ({ storage: { available: false } }), events: () => coach.events() }), null);
});
test('이야기: 30일이 지난 기록은 쓰지 않는다', () => {
  const coach = newCoach('story-classroom');
  storyTry(coach, 'clue-letter', false); storyTry(coach, 'surprise-ribbon', false);
  assert.equal(supportedPractice(coach, { now: Date.now() + 31 * 86400000 }), null);
});
test('이야기: 과제가 있거나 독립 근거 맞춤 연습이 있으면 건네지 않는다', () => {
  const learned = (coach) => createStoryLearning({ coach, host: null, runtime: {} }).supportedOffer();
  const assigned = newCoach('story-classroom');
  storyTry(assigned, 'clue-letter', false); storyTry(assigned, 'surprise-ribbon', false);
  assigned.assignment = () => ({ skillId: 'ko.reading.detail' });
  assert.equal(learned(assigned), null);
  const independent = newCoach('story-classroom');
  storyTry(independent, 'cleanup-paper', false, { help: [] }); storyTry(independent, 'review-paper', false, { help: [] });
  assert.ok(missedStory(independent));
  assert.equal(learned(independent), null);
  const free = newCoach('story-classroom');
  storyTry(free, 'clue-letter', false); storyTry(free, 'surprise-ribbon', false);
  assert.equal(learned(free).strength, 'repeated');
});
test('이야기: 건넬 수 있는 부탁은 모두 연습으로 열리고 선행 부탁이 같은 장면에 있다', () => {
  for (const id of [...SEQ, ...DETAIL, ...NEG]) {
    const game = new StoryGame();
    assert.equal(game.startPractice([id]), true);
    for (let i = 0; i < 9 && game.phase === 'intro'; i++) game.advance();
    assert.ok(['play', 'review'].includes(game.phase), id);
    assert.ok(game.missions.some(m => m.id === id), id);
    for (const req of MISSIONS.get(id).requires || []) assert.ok(game.missions.some(m => m.id === req), id);
  }
});

// ── 입장 검사 ──
const entryTry = (coach, c, correct) => { const pid = coach.present(caseMetadata(c)); return coach.answer(pid, { correct, assessable: true }); };
const bySkill = (skill) => VENUES.flatMap(v => v.cases.filter(c => !c.followupOnly && c.skill === skill));
const allIds = VENUES.map(v => v.id);
const DONE = Object.freeze({ tutorial: true, plays: 2, stars: {} });
function missedEntry(skill = 'ko.reading.negation') {
  const coach = newCoach('entry-check');
  bySkill(skill).slice(0, 3).forEach((c, i) => entryTry(coach, c, i === 0));
  return coach;
}
test('입장: 독립 근거가 있고 연수·정규 근무를 마친 사람에게만 한 손님 연습을 건넨다', () => {
  const coach = missedEntry();
  const plan = soloGuestPlan(coach, allIds, DONE);
  assert.equal(plan.patternId, 'negation');
  assert.equal(plan.target.item.skill, 'ko.reading.negation');
  assert.ok(!plan.target.item.followupOnly);
  assert.equal(coach.exposure(plan.target.meta).seen, false);
  assert.equal(soloGuestPlan(coach, allIds, { tutorial: false, plays: 2 }), null);
  assert.equal(soloGuestPlan(coach, allIds, { tutorial: true, plays: 0 }), null);
  assert.equal(soloGuestPlan(newCoach('entry-check'), allIds, DONE), null);
  const assigned = missedEntry(); assigned.assignment = () => ({ skillId: 'ko.reading.detail' });
  assert.equal(soloGuestPlan(assigned, allIds, DONE), null);
});
test('입장: 한 번 오답·회복은 건네지 않고, 건네는 손님은 열린 근무지 안에 있다', () => {
  const once = newCoach('entry-check'); entryTry(once, bySkill('ko.reading.negation')[0], false);
  assert.equal(soloGuestPlan(once, allIds, DONE), null);
});
test('입장: 서로 다른 두 손님을 놓쳐 생긴 제안은 정답이 쌓여 최근 셋에 오답이 하나만 남으면 사라진다', () => {
  const coach = newCoach('entry-check'), neg = bySkill('ko.reading.negation');
  [false, false, true].forEach((ok, i) => entryTry(coach, neg[i], ok));
  const offered = soloGuestPlan(coach, allIds, DONE);
  assert.equal(offered?.patternId, 'negation', '회복을 보기 전에 제안이 실제로 생겨야 한다');
  assert.equal(offered.misses, 2);
  assert.equal(new Set(offered.missedFamilies).size, 2, '오답 둘은 서로 다른 손님이다');
  const rec = entryTry(coach, offered.target.item, true);
  assert.equal(rec.independent, true);
  assert.equal(soloGuestPlan(coach, allIds, DONE), null);
});
test('입장: 건네는 손님은 받은 근무지 안에 있고, 그 안에 새 손님이 없으면 건네지 않는다', () => {
  // missedEntry는 수영장 둘·도서관 하나를 쓴다. 부정 표현의 새 손님은 박물관·음악회에만 남는다.
  const scoped = (ids) => soloGuestPlan(missedEntry(), ids, DONE);
  const museum = scoped(['museum']);
  assert.ok(museum, '새 손님이 있는 근무지만 열려 있어도 건넨다');
  assert.equal(museum.target.venueId, 'museum');
  assert.ok(VENUES.find(v => v.id === 'museum').cases.some(c => c.id === museum.target.id));
  const open = scoped(['pool', 'library', 'museum']);
  assert.ok(open, '열린 곳 중 새 손님이 있는 곳에서 건넨다');
  assert.equal(open.target.venueId, 'museum', '열리지 않은 음악회의 손님을 건네지 않는다');
  assert.equal(scoped(['pool', 'library']), null, '열린 곳의 부정 표현 손님을 다 만났으면 건네지 않는다');
});
test('입장: 한 손님 연습의 돌아갈 곳은 안내·단추·끝 메시지 모두 근무지 고르는 화면이고, 「입구」라고 부르지 않는다', () => {
  const app = readFileSync(path.join(EXP, 'entry-check/app.mjs'), 'utf8'), html = readFileSync(path.join(EXP, 'entry-check/index.html'), 'utf8');
  const note = html.match(/<p id="rec-practice-note"[^>]*>([^<]*)</)[1];
  const brief = app.match(/drill \? `\$\{drill\.why\} ([^`]*)`/)[1];
  const button = app.match(/textContent = state\.drill \? '([^']*)'/)[1];
  const done = app.match(/const line = \['([^']*)', state\.flowLine\]/)[1];
  assert.match(note, /^이 손님 한 명만 보고 근무지 고르는 화면으로 돌아와요\. 별·코인·근무 횟수는 그대로/);
  assert.equal(brief, '이 손님 한 명만 보고 근무지 고르는 화면으로 돌아와요.');
  assert.equal(button, '근무지 고르기로 돌아가기');
  assert.equal(done, '한 손님 연습을 마치고 근무지 고르는 화면으로 돌아왔어요.');
  for (const line of [note, brief, button, done]) assert.doesNotMatch(line, /입구/);
  // 정규 근무의 말과 흐름은 그대로다.
  assert.match(app, /state\.index \+ 1 >= state\.queue\.length \? '근무 마치기'/);
  assert.match(app, /function finishShift\(\) \{\s*if \(state\.drill\) return finishDrill\(\);/);
  assert.match(html, /<button id="r-home"[^>]*>근무지 고르기</);
});
test('입장: 연습 판정은 그 근거에 들어가 창이 움직이고, 같은 손님을 다시 건네지 않으며, 근무 구성은 그대로다', () => {
  const concert = VENUES.find(v => v.memo);
  const before = composeShift(concert, {}).map(c => c.id);
  const coach = missedEntry();
  const plan = soloGuestPlan(coach, allIds, DONE), rec = entryTry(coach, plan.target.item, true);
  assert.equal(rec.independent, true);
  assert.equal(coach.exposure(plan.target.meta).seen, true);
  const next = soloGuestPlan(coach, allIds, DONE);
  if (next) assert.notEqual(next.target.id, plan.target.id);
  assert.deepEqual(composeShift(concert, {}).map(c => c.id), before);
});
test('입장: 음악회 손님의 규칙은 도착 시각으로 정해진다(알림 앞은 안내문만, 뒤에는 알림 규칙까지)', () => {
  const concert = VENUES.find(v => v.memo), at = minutes(concert.memo.at);
  const authored = concert.cases.filter(c => !c.followupOnly);
  const early = authored.find(c => minutes(c.at) < at), late = authored.find(c => minutes(c.at) >= at);
  assert.equal(activeRules(concert, early.at).length, concert.notice.rules.length);
  assert.equal(activeRules(concert, late.at).length, concert.notice.rules.length + 1);
  assert.ok(activeRules(concert, late.at).some(r => r.id === concert.memo.rule.id));
  for (const c of authored) if (c.answer !== 'pass') assert.ok(activeRules(concert, c.at).some(r => r.id === c.answer), c.id);
});
test('입장: 혼자 있는 손님에게 immediateCheck를 부르면 「마지막 손님」이 나오므로 app이 건너뛴다(소스 대조)', () => {
  const v = VENUES[0], c = v.cases.find(x => !x.followupOnly);
  assert.equal(immediateCheck({ venue: v, queue: [c], index: 0, item: c, coach: newCoach('entry-check') }).status, 'round-end');
  const app = readFileSync(path.join(EXP, 'entry-check/app.mjs'), 'utf8');
  assert.match(app, /if \(!state\.drill && !tut\.on && !runClosed\(\)/);
  assert.match(app, /function finishShift\(\) \{\s*if \(state\.drill\) return finishDrill\(\);/);
  assert.match(app, /state\.coinRound = tut\.on \|\| drill \? null/);
});
