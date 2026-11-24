// 동아리장 알림 → 튜터 → 실력 파악 다리(world-front-club.mjs, 11-24)의 규칙 시험.
//   node --test experiences/synk-world-app/qa/world-front-club.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {cardable, pickClubRows, clubNote, cellsOf, explainOf, createFrontClub, TUTOR_SETTINGS} from '../world-front-club.mjs';

const item = (id, modality, difficulty = 1, extra = {}) => ({id, skillId: `ko.${modality}.${id}`, modality, difficulty, choices: [{id: 'a', label: '가'}, {id: 'b', label: '나'}], correctId: 'a', explanation: '까닭', audio: modality === 'listening' ? `x/${id}.mp3` : null, ...extra});
const row = it => ({skillId: it.skillId, item: it});
const DAY = 864e5, at = (d, h = 12) => new Date(2026, 10, 24 + d, h).getTime();

test('대화 카드로 낼 수 있는 문항만 고른다', () => {
  assert.equal(cardable(item('a', 'reading')), true);
  assert.equal(cardable(item('b', 'listening', 1, {ask: 'picture'})), false, '그림 보기');
  assert.equal(cardable(item('c', 'reading', 1, {card: {notice: {}}})), false, '입장 카드');
  assert.equal(cardable(item('d', 'listening', 1, {choices: [{id: 'a', label: '🍎'}, {id: 'b', label: '🍌'}]})), false, '그림 문자');
  assert.equal(cardable(null), false);
});

test('넷: 읽기 · 듣기를 번갈아 쉬운 것부터, 한쪽이 모자라면 다른 쪽으로', () => {
  const rows = [item('r2', 'reading', 2), item('l1', 'listening', 1), item('r1', 'reading', 1), item('l3', 'listening', 3), item('r3', 'reading', 3), item('p', 'listening', 1, {ask: 'picture'})].map(row);
  assert.deepEqual(pickClubRows(rows).map(r => r.item.id), ['r1', 'l1', 'r2', 'l3']);
  assert.deepEqual(pickClubRows(rows.filter(r => r.item.modality === 'reading')).map(r => r.item.id), ['r1', 'r2', 'r3']);
  assert.deepEqual(pickClubRows([]), []);
});

test('알림: 처음 만남 전 동아리장, 만난 날 없음, 다음 날부터 하루 하나', () => {
  assert.equal(clubNote({club: null}).code, 'club.hello');
  assert.equal(clubNote({club: {tutor: 'taeo'}}).code, 'club.hello', '고르고 끝내지 않았으면 다시 동아리장');
  const club = {tutor: 'taeo', done: true, at: at(0), results: [{skillId: 'hangul', ok: true}, {skillId: 'ko.reading.grammar', label: 'Reading particles', labelKo: '조사·문형 읽기', ok: false}], cells: ['done', 'next'], listening: 1};
  const plan = {token: 'p1', title: '첫 인사 세 마디', min: 2, photo: 'ph9-greet'};
  assert.equal(clubNote({club, plan, now: at(0, 22)}), null, '만난 날 밤');
  assert.equal(clubNote({club, plan, now: at(1, 2)}), null, '새벽 4시 전은 같은 날');
  const d1 = clubNote({club, plan, now: at(1)});
  assert.deepEqual([d1.kind, d1.code, d1.who, d1.slots.skill, d1.slots.skillUi], ['review', 'tutor.review.skill', 'taeo', '조사·문형 읽기', 'Reading particles']);
  assert.equal(clubNote({club: {...club, reviewed: ['ko.reading.grammar']}, plan, now: at(1)}).code, 'tutor.today', '복습한 항목은 다시 안 부른다');
  assert.equal(clubNote({club, plan, now: at(3)}).code, 'tutor.level', '셋째 날마다 내 위치');
  assert.equal(clubNote({club: {...club, last: {day: '2026-11-25', opened: true}}, plan, now: at(1)}), null, '그날 연 알림은 다시 안 띄운다');
  const hangulPlan = {...plan, line: '한글부터 해요'};
  assert.equal(clubNote({club: {...club, results: [{skillId: 'hangul', ok: false}]}, plan: hangulPlan, hangul: 'new', now: at(1)}).code, 'tutor.review.hangul');
  assert.equal(clubNote({club: {...club, results: [{skillId: 'hangul', ok: false}]}, plan, hangul: 'new', now: at(1)}).code, 'tutor.today', '계획이 한글을 지났으면 「한글 이어 하기」를 건네지 않는다');
  assert.equal(clubNote({club: {...club, results: [{skillId: 'hangul', ok: false}]}, plan: hangulPlan, hangul: 'ask', now: at(1)}).code, 'tutor.today', '한글 답을 못 남겼으면 한글 복습이 아니다');
  assert.equal(clubNote({club: {...club, results: []}, plan: null, now: at(2)}), null, '근거가 없으면 조용히');
});

test('결과 칸: 이번에 본 항목은 그 답, 나머지는 지도 칸', () => {
  const map = {skills: [{id: 'ko.listening.word', domain: 'listening', cell: 'notyet'}, {id: 'ko.listening.detail', domain: 'listening', cell: 'independent'}, {id: 'ko.reading.grammar', domain: 'reading', cell: 'practicing'}, {id: 'ko.reading.vocabulary', domain: 'reading', cell: 'notyet'}]};
  const out = cellsOf(map, [{skillId: 'hangul', ok: true}, {skillId: 'ko.listening.word', ok: true}, {skillId: 'ko.reading.vocabulary', ok: false}]);
  assert.deepEqual(out, {total: 4, cells: ['done', 'done', 'next', 'next'], listening: 2});
  assert.deepEqual(cellsOf(null), {total: 0, cells: [], listening: 0});
});

test('해설은 화면 언어, 없으면 한국어', () => {
  assert.equal(explainOf({explanation: '까닭'}, 'en'), '까닭');
  assert.equal(explainOf({explanation: {ko: '가', en: 'A'}}, 'en'), 'A');
  assert.equal(explainOf({explanation: {ko: '가'}}, 'mn'), '가');
  assert.equal(explainOf({}), '');
});

function harness({consent = false, ready = true, route = 'lesson', map = null} = {}) {
  const marks = {}, calls = [];
  const readMark = who => marks[who] || {};
  const writeMark = (who, patch) => { marks[who] = {...readMark(who), ...patch}; };
  let profile = {consent, revision: 3, values: {reasons: ['travel'], support: 'step', explanation: 'brief'}};
  const progress = {learningProfile: () => ({profile}), updateLearningProfile: q => { calls.push(['profile', q]); profile = {...profile, values: q.values}; }};
  const its = [item('r1', 'reading'), item('l1', 'listening')];
  let i = -1, results = [];
  const session = {next: () => { i += 1; return its[i] ? {index: i, total: its.length, item: its[i]} : null; }, answer: id => { const r = {skillId: its[i].skillId, verdict: id === its[i].correctId ? 'correct' : 'incorrect'}; results.push(r); return r; },
    replay: () => 'first', delivery: () => true, stop: () => calls.push(['stop'])};
  const education = {
    clubCheck: async ({pick}) => { calls.push(['check', pick(its.map(row)).length]); return ready ? {status: 'ready', session, total: its.length, skillName: id => id, audioUrl: p => '/' + p, finish: () => ({map: {skills: its.map(x => ({id: x.skillId, domain: x.modality, cell: 'notyet'}))}, results})} : {status: 'board'}; },
    practice: id => calls.push(['practice', id]), position: o => calls.push(['position', o]),
    clubMap: async () => { calls.push(['map']); return map; }
  };
  const club = createFrontClub({same: () => true, owner: () => 'guest', readMark, writeMark, education: () => education, progress: () => progress, lang: () => 'en',
    plan: () => ({token: 'p1', title: 'T', min: 2, route}), openPlan: t => calls.push(['open', t]), stateOf: async () => ({view: 'more'}), baseUrl: () => 'http://x/world/'});
  return {club, marks, calls, profileNow: () => profile};
}

test('튜터 스타일은 동의한 학생만 학습 설정에 저장한다', async () => {
  const a = harness({consent: false});
  assert.deepEqual(await a.club.host.clubTutor('seoha', {answer: 'some'}), {tutor: 'seoha', saved: false});
  assert.equal(a.marks.guest.club.tutor, 'seoha');
  assert.equal(a.calls.filter(c => c[0] === 'profile').length, 0);
  const b = harness({consent: true});
  assert.deepEqual(await b.club.host.clubTutor('yuna'), {tutor: 'yuna', saved: true});
  const q = b.calls.find(c => c[0] === 'profile')[1];
  assert.equal(q.expectedRevision, 3);
  assert.deepEqual([q.values.support, q.values.explanation, q.values.reasons[0]], [TUTOR_SETTINGS.yuna.support, TUTOR_SETTINGS.yuna.explanation, 'travel'], '다른 값은 그대로');
  assert.equal(await b.club.host.clubTutor('nobody'), null);
});

test('문항 → 답 → 결과 → 놓친 항목 짧은 연습으로 잇는다', async () => {
  const h = harness();
  const d = await h.club.host.clubDiag();
  assert.equal(d.status, 'ready');
  assert.deepEqual([d.item.skillId, d.item.label, d.item.audio], ['ko.reading.r1', 'ko.reading.r1', null]);
  assert.equal('correctId' in d.item, false, '답은 내기 전에 주지 않는다');
  const a1 = await h.club.host.clubAnswer('a');
  assert.deepEqual(a1, {correct: true, correctId: 'a', explanation: '까닭'});
  const n = await h.club.host.clubNext();
  assert.equal(n.audio, 'http://x/x/l1.mp3', '소리 주소는 앱 기준의 절대 주소');
  await h.club.host.clubAnswer('b');
  assert.equal(await h.club.host.clubNext(), null);
  const fin = await h.club.host.clubFinish([{skillId: 'hangul', ok: true}, {skillId: 'ko.reading.r1', label: 'R1', labelKo: '읽기1', ok: true}, {skillId: 'ko.listening.l1', label: 'L1', labelKo: '듣기1', ok: false}]);
  assert.deepEqual(fin, {total: 2, cells: ['next', 'done'], listening: 1, minutes: null});
  assert.equal(h.marks.guest.club.results.length, 3);
  const next = await h.club.host.clubDone();
  assert.equal(next.view, 'more');
  assert.equal(h.marks.guest.club.done, true);
  assert.deepEqual(h.marks.guest.club.reviewed, ['ko.listening.l1'], '단추가 연 연습은 다음 날 복습 알림으로 다시 부르지 않는다');
  await new Promise(r => setTimeout(r, 500));
  assert.deepEqual(h.calls.find(c => c[0] === 'practice'), ['practice', 'ko.listening.l1']);
  assert.equal(h.calls.some(c => c[0] === 'open'), false);
});

test('다 맞히면 오늘 할 일을 열고, 새 길이면 판으로 연다', async () => {
  const h = harness();
  await h.club.host.clubDiag(); await h.club.host.clubAnswer('a');
  await h.club.host.clubFinish([{skillId: 'hangul', ok: true}, {skillId: 'ko.reading.r1', ok: true}]);
  await h.club.host.clubDone(); await new Promise(r => setTimeout(r, 500));
  assert.deepEqual(h.calls.find(c => c[0] === 'open'), ['open', 'p1']);
  const b = harness({ready: false});
  assert.deepEqual(await b.club.host.clubDiag(), {status: 'board', reason: null});
  const s = await b.club.host.clubBoard(); await new Promise(r => setTimeout(r, 500));
  assert.equal(s.view, 'more');
  assert.deepEqual(b.calls.find(c => c[0] === 'position'), ['position', {start: true}]);
});

test('알림 기록: 동아리 · 튜터 알림만 갈아 끼우고 다른 알림은 둔다', () => {
  const h = harness();
  h.marks.guest = {inbox: [{from: 'fan', code: 'fan.x', read: false}]};
  const n = h.club.noteOf('guest', null, 'ask');
  assert.equal(n.code, 'club.hello');
  assert.equal(n.drop, true);
  assert.deepEqual(h.marks.guest.inbox.map(r => r.from), ['fan', 'club']);
  h.club.host.clubSeen({opened: true});
  assert.equal(h.marks.guest.inbox.find(r => r.from === 'club').read, true);
  assert.equal(h.marks.guest.inbox.find(r => r.from === 'fan').read, false);
});

test('튜터 바꾸기: 동아리장에게 한 답은 두고 다시 그릴 state를 준다', async () => {
  const h = harness();
  await h.club.host.clubTutor('taeo', {answer: 'some'});
  const r = await h.club.host.clubTutor('yuna', {change: true});
  assert.equal(h.marks.guest.club.tutor, 'yuna');
  assert.equal(h.marks.guest.club.answer, 'some');
  assert.deepEqual(r.state, {view: 'more'});
});

test('계획이 아직 짧은 진단이면 「맞춤 연습 시작」에 분을 붙이지 않는다', async () => {
  const h = harness({route: 'position'});
  assert.equal((await h.club.host.clubFinish([{skillId: 'hangul', ok: true}])).minutes, null);
  const g = harness();
  assert.equal((await g.club.host.clubFinish([{skillId: 'hangul', ok: true}])).minutes, 2);
});

test('내 위치 알림의 칸은 첫날 기록이 아니라 그날의 지도로 센다(하루 한 번)', async () => {
  const map = {skills: [{id: 'ko.listening.word', domain: 'listening', cell: 'independent'}, {id: 'ko.reading.grammar', domain: 'reading', cell: 'independent'}, {id: 'ko.reading.vocabulary', domain: 'reading', cell: 'practicing'}]};
  const h = harness({map}), now = Date.now();
  h.marks.guest = {club: {tutor: 'taeo', done: true, at: now - 3 * DAY, results: [], cells: ['', '', ''], listening: 1}};
  await h.club.refresh('guest', {view: 'more', plan: null, hangul: 'reads'});
  assert.deepEqual([h.marks.guest.club.cells, h.marks.guest.club.listening], [['done', 'done', 'next'], 1]);
  const n = h.club.noteOf('guest', null, 'reads');
  assert.deepEqual([n.code, n.slots.n, n.slots.t], ['tutor.level', 2, 3]);
  await h.club.refresh('guest', {view: 'more', plan: null, hangul: 'reads'});
  assert.equal(h.calls.filter(c => c[0] === 'map').length, 1, '같은 날 두 번 묻지 않는다');
  const g = harness({map});
  g.marks.guest = {club: {tutor: 'taeo', done: true, at: now - 1 * DAY, results: [], cells: ['']}};
  await g.club.refresh('guest', {view: 'more', plan: null, hangul: 'reads'});
  assert.equal(g.calls.some(c => c[0] === 'map'), false, '내 위치 날이 아니면 지도를 묻지 않는다');
  // 첫날 한 번 맞힌 항목은 지도에서 아직 연습 중(practicing)이다 — 다시 세도 맞힌 칸은 맞힌 칸이다
  const pm = {skills: [{id: 'a.listening.x', domain: 'listening', cell: 'practicing'}, {id: 'a.reading.y', domain: 'reading', cell: 'practicing'}, {id: 'a.reading.z', domain: 'reading', cell: 'practicing'}, {id: 'a.reading.w', domain: 'reading', cell: 'independent'}]};
  const k = harness({map: pm});
  k.marks.guest = {club: {tutor: 'taeo', done: true, at: now - 3 * DAY, results: [{skillId: 'hangul', ok: true}, {skillId: 'a.listening.x', ok: true}, {skillId: 'a.reading.y', ok: false}, {skillId: 'a.reading.w', ok: false}], cells: ['done', 'next', '', ''], listening: 1}};
  await k.club.refresh('guest', {view: 'more', plan: null, hangul: 'reads'});
  assert.deepEqual(k.marks.guest.club.cells, ['done', 'next', 'next', 'done'], '첫날 맞힘은 그대로, 그 뒤 혼자 해낸 칸은 채움');
  const e = harness({map: null});
  e.marks.guest = {club: {tutor: 'taeo', done: true, at: now - 3 * DAY, results: [], cells: ['done', ''], listening: 1}};
  await e.club.refresh('guest', {view: 'more', plan: null, hangul: 'reads'});
  assert.deepEqual(e.marks.guest.club.cells, ['done', ''], '지도를 못 받으면 앞 기록 그대로');
});

test('동의 전에 고른 튜터의 스타일을 처음 동의할 때 쓸 값', async () => {
  const h = harness();
  assert.deepEqual(h.club.valuesOf('guest'), {});
  await h.club.host.clubTutor('seoha', {answer: 'some'});
  assert.deepEqual(h.club.valuesOf('guest'), {support: TUTOR_SETTINGS.seoha.support, explanation: TUTOR_SETTINGS.seoha.explanation});
});

test('날이 바뀌면 같은 꼴의 알림도 새로 내려온다', () => {
  const h = harness(), day = 864e5, now = Date.now();
  h.marks.guest = {club: {tutor: 'seoha', done: true, at: now - 2 * day, results: [{skillId: 'ko.reading.vocabulary', label: 'Reading words', ok: false}]},
    inbox: [{from: 'tutor', who: 'seoha', kind: 'review', code: 'tutor.review.skill', slots: {skillId: 'ko.reading.vocabulary'}, at: now - day, read: true}]};
  const n = h.club.noteOf('guest', null, 'reads');
  assert.equal(n.code, 'tutor.review.skill');
  assert.equal(n.read, false);
  assert.equal(n.drop, true);
});
