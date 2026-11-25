// 동아리장 알림 → 튜터 → 실력 파악 다리(world-front-club.mjs, 11-24)의 규칙 시험.
//   node --test experiences/synk-world-app/qa/world-front-club.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {cardable, pickClubRows, clubNote, mapView, MAP_CELLS, explainOf, createFrontClub, TUTOR_SETTINGS} from '../world-front-club.mjs';
import {WHY} from '../world-front-why.mjs';
import {worldPosition} from '../world-position-kit.mjs';

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
  assert.deepEqual(clubNote({club: {tutor: 'taeo'}}), {from: 'club', who: 'taeo', kind: 'level', code: 'tutor.level', slots: {}}, '고르고 나갔으면 그 튜터가 이어서 부른다(여는 것은 처음 만남)');
  const club = {tutor: 'taeo', done: true, at: at(0), results: [{skillId: 'hangul', ok: true}, {skillId: 'ko.reading.grammar', label: 'Reading particles', labelKo: '조사·문형 읽기', ok: false}]};
  const plan = {token: 'p1', title: '첫 인사 세 마디', min: 2, photo: 'ph9-greet'};
  assert.equal(clubNote({club, plan, now: at(0, 22)}), null, '만난 날 밤');
  assert.equal(clubNote({club, plan, now: at(1, 2)}), null, '새벽 4시 전은 같은 날');
  const d1 = clubNote({club, plan, now: at(1)});
  assert.deepEqual([d1.kind, d1.code, d1.who, d1.slots.skill, d1.slots.skillUi], ['review', 'tutor.review.skill', 'taeo', '조사·문형 읽기', 'Reading particles']);
  assert.equal(clubNote({club: {...club, reviewed: ['ko.reading.grammar']}, plan, now: at(1)}).code, 'tutor.today', '복습한 항목은 다시 안 부른다');
  assert.equal(clubNote({club, plan, now: at(3)}).code, 'tutor.level', '셋째 날마다 내 위치');
  assert.equal(clubNote({club, row: {from: 'tutor', read: true, at: at(1, 9)}, plan, now: at(1)}), null, '그날 연 알림은 다시 안 띄운다');
  assert.equal(clubNote({club, row: {from: 'tutor', read: true, at: at(1, 9)}, plan, now: at(2)}).code, 'tutor.review.skill', '날이 바뀌면 다시');
  assert.equal(clubNote({club, row: {from: 'tutor', read: false, at: at(1, 9)}, plan, now: at(1)}).code, 'tutor.review.skill', '내려오기만 하고 안 열었으면 그대로');
  const h0 = {...club, results: [{skillId: 'hangul', ok: false}]};
  assert.equal(clubNote({club: h0, plan, hangul: 'new', hangulFirst: true, now: at(1)}).code, 'tutor.review.hangul');
  assert.equal(clubNote({club: h0, plan, hangul: 'new', hangulFirst: false, now: at(1)}).code, 'tutor.today', '계획이 한글을 지났으면 「한글 이어 하기」를 건네지 않는다');
  assert.equal(clubNote({club: h0, plan, hangul: 'ask', hangulFirst: true, now: at(1)}).code, 'tutor.today', '한글 답을 못 남겼으면 한글 복습이 아니다');
  // 내 위치: 칸 기록 없이도(판으로 연 진단 · 새 기록) 사흘째 날이면, 한글을 처음 배우는 학생은 빼고, 알림에 숫자 · 칸을 싣지 않는다
  const lv = clubNote({club: {tutor: 'taeo', done: true, at: at(0), results: []}, plan, now: at(3)});
  assert.deepEqual([lv.code, lv.slots], ['tutor.level', {}]);
  assert.deepEqual(clubNote({club: {...club, cells: ['done', 'next'], listening: 1}, plan, now: at(6)}).slots, {}, '옛 기록의 cells는 쓰지 않는다');
  assert.equal(clubNote({club, plan, hangul: 'new', now: at(3)}).code, 'tutor.today', '「아직 한글도 몰라요」 학생에게는 내 위치 알림을 건네지 않는다');
  assert.equal(clubNote({club: {...club, results: []}, plan: null, now: at(2)}), null, '근거가 없으면 조용히');
});

test('줄인 지도: 칸은 지도 그대로 셋, 「내 위치」 판과 같은 수, 시도 기록은 싣지 않는다', () => {
  const map = {exam: 'topik1', skills: [{id: 'ko.reading.grammar', domain: 'reading', cell: 'practicing', eventId: 'e1'}, {id: 'ko.listening.word', domain: 'listening', cell: 'notyet'}, {id: 'ko.listening.detail', domain: 'listening', cell: 'independent', itemKey: 'k'}, {id: 'ko.reading.vocabulary', domain: 'reading', cell: 'practicing'}]};
  const v = mapView(map, {lang: 'ko'});
  assert.deepEqual(v.cells, [{id: 'ko.listening.word', domain: 'listening', cell: 'notyet'}, {id: 'ko.listening.detail', domain: 'listening', cell: 'independent'}, {id: 'ko.reading.grammar', domain: 'reading', cell: 'practicing'}, {id: 'ko.reading.vocabulary', domain: 'reading', cell: 'practicing'}]);
  assert.deepEqual([v.exam, v.total, v.listening], ['topik1', 4, 2]);
  // 「내 위치」 판은 같은 지도의 skill.cell을 센다 — 대화 카드의 수가 판과 같다
  assert.deepEqual(v.counts, Object.fromEntries(MAP_CELLS.map(c => [c, map.skills.filter(x => x.cell === c).length])));
  assert.equal(JSON.stringify(v).includes('eventId') || JSON.stringify(v).includes('itemKey'), false);
  assert.equal(typeof v.names.practicing, 'string');
  assert.equal(mapView({exam: 'topik2', skills: [{id: 'ko2.reading.a', domain: 'reading', cell: 'odd'}]}).exam, 'topik2');
  assert.equal(mapView({skills: [{id: 'ko2.reading.a', domain: 'reading', cell: 'odd'}]}).cells[0].cell, 'notyet', '모르는 칸은 아직');
  assert.equal(mapView(null), null);
});

test('해설은 화면 언어, 없으면 한국어', () => {
  assert.equal(explainOf({explanation: '까닭'}, 'en'), '까닭');
  assert.equal(explainOf({explanation: {ko: '가', en: 'A'}}, 'en'), 'A');
  assert.equal(explainOf({explanation: {ko: '가'}}, 'mn'), '가');
  assert.equal(explainOf({}), '');
  const why = {까닭: {en: 'why', mn: 'шалтгаан'}};
  assert.equal(explainOf({explanation: '까닭'}, 'mn', why), 'шалтгаан', '게임 원고의 한국어 한 줄은 번역 표에서');
  assert.equal(explainOf({explanation: '까닭'}, 'ko', why), '까닭');
  assert.equal(explainOf({explanation: '다른 글'}, 'mn', why), '다른 글', '표에 없으면 한국어 그대로');
});

test('해설 번역 표: 튜터가 낼 수 있는 한국어 해설을 빠짐없이, 원고와 같은 글로', () => {
  const need = new Set(worldPosition.items.filter(it => typeof it.explanation === 'string' && cardable(it)).map(it => it.explanation));
  assert.ok(need.size > 0);
  assert.deepEqual([...need].filter(k => !WHY[k]), [], '번역이 없는 해설(원고를 고쳤으면 표의 열쇠도 고친다)');
  assert.deepEqual(Object.keys(WHY).filter(k => !need.has(k)), [], '원고에 없는 열쇠');
  for (const [k, v] of Object.entries(WHY)) {
    assert.ok(v.en.length > 10 && v.mn.length > 10, k);
    assert.equal(/[가-힣]/.test(v.mn.replace(/「[^」]*」/g, '')), false, '몽골어에 따옴표 밖 한국어: ' + k);
    assert.equal(/[가-힣]/.test(v.en.replace(/「[^」]*」/g, '')), false, '영어에 따옴표 밖 한국어: ' + k);
    assert.equal(/[А-Яа-яӨөҮү]/.test(v.en), false, '영어에 키릴: ' + k);
  }
});

function harness({consent = false, ready = true, route = 'lesson', gameId = null, map = null, mapWait = 0, checkWait = 0, lang = 'en', loadWhy, extra = {}} = {}) {
  const marks = {}, calls = [], who = {now: 'guest'};
  const readMark = who => marks[who] || {};
  const writeMark = (who, patch) => { marks[who] = {...readMark(who), ...patch}; };
  let profile = {consent, revision: 3, values: {reasons: ['travel'], support: 'step', explanation: 'brief'}};
  const progress = {learningProfile: () => ({profile}), updateLearningProfile: q => { calls.push(['profile', q]); profile = {...profile, values: q.values}; }};
  const its = [item('r1', 'reading', 1, extra), item('l1', 'listening')];
  let i = -1, results = [];
  const session = {next: () => { i += 1; return its[i] ? {index: i, total: its.length, item: its[i]} : null; }, answer: id => { const r = {skillId: its[i].skillId, verdict: id === its[i].correctId ? 'correct' : 'incorrect'}; results.push(r); return r; },
    replay: () => 'first', delivery: () => true, stop: () => calls.push(['stop'])};
  const education = {
    clubCheck: async ({pick}) => { calls.push(['check', pick(its.map(row)).length]); if (checkWait) await new Promise(r => setTimeout(r, checkWait)); return ready ? {stop: () => calls.push(['check stop']), status: 'ready', session, total: its.length, skillName: id => id, audioUrl: p => '/' + p, finish: () => ({map: {skills: its.map(x => ({id: x.skillId, domain: x.modality, cell: 'notyet'}))}, results})} : {status: 'board'}; },
    practice: id => calls.push(['practice', id]), position: o => calls.push(['position', o]),
    clubMap: async () => { calls.push(['map']); if (mapWait) await new Promise(r => setTimeout(r, mapWait)); if (map instanceof Error) throw map; return map; }
  };
  const club = createFrontClub({same: () => who.now === 'guest', owner: () => who.now, readMark, writeMark, education: () => education, progress: () => progress, lang: () => lang, ...(loadWhy ? {loadWhy} : {}),
    plan: () => ({token: 'p1', title: 'T', min: 2, route, gameId}), openPlan: t => calls.push(['open', t]), stateOf: async () => ({view: 'more'}), baseUrl: () => 'http://x/world/'});
  return {club, marks, calls, who, profileNow: () => profile};
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
  assert.deepEqual([d.item.question, d.item.questionLang], [null, 'ko']);
  const a1 = await h.club.host.clubAnswer('a');
  assert.deepEqual(a1, {correct: true, correctId: 'a', explanation: '까닭'});
  const n = await h.club.host.clubNext();
  assert.equal(n.audio, 'http://x/x/l1.mp3', '소리 주소는 앱 기준의 절대 주소');
  await h.club.host.clubAnswer('b');
  assert.equal(await h.club.host.clubNext(), null);
  const fin = await h.club.host.clubFinish([{skillId: 'hangul', ok: true}, {skillId: 'ko.reading.r1', label: 'R1', labelKo: '읽기1', ok: true}, {skillId: 'ko.listening.l1', label: 'L1', labelKo: '듣기1', ok: false}]);
  assert.deepEqual([fin.minutes, fin.map.total, fin.map.cells.map(c => c.cell)], [null, 2, ['notyet', 'notyet']], '칸은 지도 그대로(답을 덧씌우지 않는다)');
  assert.equal('cells' in h.marks.guest.club || 'listening' in h.marks.guest.club, false, '기기 표에는 결과 줄만');
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

test('내 위치 카드: 대화를 연 뒤 지도를 받는다 — 없음 · 실패 · 기다리는 사이 주인 바뀜이면 null, 알림을 고를 때는 묻지 않는다', async () => {
  const map = {exam: 'topik1', skills: [{id: 'ko.listening.word', domain: 'listening', cell: 'independent'}, {id: 'ko.reading.grammar', domain: 'reading', cell: 'practicing'}]};
  const h = harness({map}), now = Date.now();
  h.marks.guest = {club: {tutor: 'taeo', done: true, at: now - 3 * DAY, results: []}};
  const n = h.club.noteOf('guest', null, 'reads');
  assert.deepEqual([n.code, n.slots], ['tutor.level', {}]);
  assert.equal(h.calls.some(c => c[0] === 'map'), false, '알림을 고를 때(stateOf)는 지도를 묻지 않는다');
  const v = await h.club.host.clubMap();
  assert.deepEqual([v.total, v.counts.independent, v.counts.practicing], [2, 1, 1]);
  assert.equal(await harness({map: null}).club.host.clubMap(), null, '새 길 · 기록 없음');
  assert.equal(await harness({map: new Error('x')}).club.host.clubMap(), null, '실패');
  const w = harness({map, mapWait: 50}); const q = w.club.host.clubMap(); w.who.now = 'other'; assert.equal(await q, null, '기다리는 사이 주인이 바뀌면 버린다');
});

test('한글 복습: 다리가 계획 값(route · gameId)으로 한글 먼저인지 가린다', () => {
  const now = Date.now(), club = {tutor: 'seoha', done: true, at: now - DAY, results: [{skillId: 'hangul', ok: false}]};
  const a = harness({route: 'game', gameId: 'hangul'}); a.marks.guest = {club};
  assert.equal(a.club.noteOf('guest', {token: 'p1', title: '한글 만나기', min: 3}, 'new').code, 'tutor.review.hangul');
  const b = harness({route: 'lesson'}); b.marks.guest = {club};
  assert.equal(b.club.noteOf('guest', {token: 'p1', title: 'T', min: 2}, 'new').code, 'tutor.today');
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

test('빈칸 지시문은 화면 언어로, 읽을 내용인 물음은 한국어 그대로', async () => {
  const ask = async (lang, extra) => { const h = harness({lang, loadWhy: async () => ({WHY: {}}), extra}); return (await h.club.host.clubDiag()).item; };
  const mn = await ask('mn', {ask: 'blank', question: '빈칸에 알맞은 것을 고르세요.'});
  assert.equal(mn.questionLang, 'mn');
  assert.equal(/[가-힣]/.test(mn.question), false);
  assert.ok((await ask('en', {ask: 'blank', question: '빈칸에 알맞은 것을 고르세요.'})).question.length > 5);
  assert.deepEqual((({question, questionLang}) => [question, questionLang])(await ask('mn', {question: '오늘은 어디에서 쉴 수 있나요?'})), ['오늘은 어디에서 쉴 수 있나요?', 'ko']);
});

test('나중에: 나가면 문항을 걷고 알림은 작은 얼굴로 남는다, 고른 튜터부터 잇는다', async () => {
  const h = harness();
  assert.equal(h.club.noteOf('guest', null, 'ask').code, 'club.hello');
  await h.club.host.clubTutor('yuna', {answer: 'none'});
  await h.club.host.clubDiag();
  const next = await h.club.host.clubLater();
  assert.deepEqual(next, {view: 'more'});
  assert.equal(h.calls.some(c => c[0] === 'check stop'), true, '보이던 문항은 걷는다');
  assert.equal(h.marks.guest.ended, true);
  assert.equal(!!h.marks.guest.club.done, false);
  assert.equal(await h.club.host.clubNext(), null);
  assert.equal(h.club.answerOf('guest'), 'none');
  const n = h.club.noteOf('guest', null, 'ask');
  assert.deepEqual([n.from, n.who, n.code, n.read, n.drop], ['club', 'yuna', 'tutor.level', false, false], '그 튜터가 부르고, 오늘은 다시 내려오지 않는다');
  assert.deepEqual(h.club.road.note('guest'), {from: 'club', who: 'yuna', kind: 'level', code: 'tutor.level', slots: {}});
  assert.equal(h.club.road.dropped('guest'), true);
  // 튜터를 고르기 전에 나가면 동아리장 알림이 그대로 남는다
  const b = harness(); await b.club.host.clubLater();
  const m = b.club.noteOf('guest', null, 'ask');
  assert.deepEqual([m.code, m.read, m.drop, b.marks.guest.ended], ['club.hello', false, false, true]);
});

test('고르는 사이 나가면 낸 적 없는 문항으로 걷는다', async () => {
  const h = harness({checkWait: 40, lang: 'ko'}), q = h.club.host.clubDiag();
  await h.club.host.clubLater();
  assert.equal(await q, null);
  assert.equal(h.calls.some(c => c[0] === 'check stop'), true);
  assert.equal(await h.club.host.clubReplay(), null, '열린 세션이 남지 않는다');
  // 번역 표를 받는 사이 나가면 문항을 고르지도 않는다
  const w = harness({lang: 'mn', loadWhy: () => new Promise(r => setTimeout(() => r({WHY: {}}), 30))}), g = w.club.host.clubDiag();
  await w.club.host.clubLater();
  assert.equal(await g, null);
  assert.equal(w.calls.some(c => c[0] === 'check'), false);
});

test('결과를 보고 맞춤 화면으로: 연습을 열지 않고 놓친 항목은 다음 날 복습으로 남는다', async () => {
  const h = harness();
  await h.club.host.clubTutor('taeo', {answer: 'some'});
  await h.club.host.clubDiag();
  await h.club.host.clubFinish([{skillId: 'hangul', ok: true}, {skillId: 'ko.listening.l1', label: 'L1', labelKo: '듣기1', ok: false}]);
  const next = await h.club.host.clubDone({open: false});
  assert.equal(next.view, 'more');
  assert.equal(h.marks.guest.club.done, true);
  assert.deepEqual(h.marks.guest.club.reviewed, undefined);
  await new Promise(r => setTimeout(r, 500));
  assert.equal(h.calls.some(c => c[0] === 'practice' || c[0] === 'open'), false);
  assert.equal(clubNote({club: h.marks.guest.club, now: Date.now() + DAY}).code, 'tutor.review.skill');
});

test('알림 상태는 inbox 한 줄: 연 알림은 그날 다시 안 부르고, 계획이 바뀌어도 하루에 한 번만 내려온다', () => {
  const h = harness(), now = Date.now();
  h.marks.guest = {club: {tutor: 'taeo', done: true, at: now - DAY, results: []}};
  const plan = token => ({token, title: 'T', min: 2});
  const a = h.club.noteOf('guest', plan('p1'), 'reads');
  assert.deepEqual([a.code, a.drop], ['tutor.today', true]);
  h.club.host.clubSeen({dropped: true});
  const b = h.club.noteOf('guest', plan('p2'), 'reads');
  assert.deepEqual([b.slots.token, b.drop, b.read], ['p2', false, false], '같은 날 다른 할 일로 바뀌어도 작은 얼굴로만');
  h.club.host.clubSeen({opened: true});
  assert.equal(h.club.noteOf('guest', plan('p3'), 'reads'), null);
  assert.equal(h.club.noteOf('guest', plan('p3'), 'reads'), null, '다시 그려도 그대로');
  assert.equal(h.marks.guest.inbox.filter(r => r.from === 'tutor').length, 1);
  assert.equal('last' in h.marks.guest.club, false, '알림을 내림 · 읽음은 club에 적지 않는다');
  // 첫 공개판(11-26)이 오늘 적어 둔 표시는 읽는다 — 새 판으로 바뀐 날 이미 연 알림이 다시 내려오지 않게
  const k = new Date(now - 4 * 3600e3), today = `${k.getFullYear()}-${k.getMonth() + 1}-${k.getDate()}`;
  const o = harness(); o.marks.guest = {club: {tutor: 'taeo', done: true, at: now - DAY, results: [], last: {day: today, opened: true, dropped: today}}};
  assert.equal(o.club.noteOf('guest', plan('p1'), 'reads'), null);
  const d = harness(); d.marks.guest = {club: {tutor: 'taeo', done: true, at: now - DAY, results: [], last: {dropped: today}}};
  assert.deepEqual((({code, drop}) => [code, drop])(d.club.noteOf('guest', plan('p1'), 'reads')), ['tutor.today', false]);
  const y = harness(); y.marks.guest = {club: {tutor: 'taeo', done: true, at: now - 2 * DAY, results: [], last: {day: '2020-1-1', opened: true, dropped: '2020-1-1'}}};
  assert.equal(y.club.noteOf('guest', plan('p1'), 'reads').drop, true);
});

test('서울행 내 길의 알림은 주인마다 하루 한 번 내려온다', () => {
  const h = harness();
  assert.equal(h.club.road.dropped('guest'), false);
  h.club.road.drop('guest');
  assert.equal(h.club.road.dropped('guest'), true);
  assert.equal(h.club.road.dropped('other'), false, '같은 기기의 다른 주인은 따로');
  assert.equal(h.club.noteOf('guest', null, 'ask').drop, false, '앞면도 같은 줄을 본다');
  h.marks.guest.inbox[0].at -= DAY;
  assert.equal(h.club.road.dropped('guest'), false, '날이 바뀌면 다시 내려온다');
  h.marks.guest = {club: {tutor: 'taeo', done: true, at: Date.now()}};
  assert.equal(h.club.road.note('guest'), null);
  assert.equal(h.club.road.dropped('guest'), false);
});

test('영어 · 몽골어 화면은 첫 문항을 고를 때 번역 표를 받고, 못 받으면 한국어로 잇는다', async () => {
  let got = 0;
  const h = harness({lang: 'mn', loadWhy: async () => { got += 1; return {WHY: {까닭: {en: 'why', mn: 'шалтгаан'}}}; }});
  await h.club.host.clubDiag();
  assert.equal((await h.club.host.clubAnswer('a')).explanation, 'шалтгаан');
  assert.equal(got, 1);
  const f = harness({lang: 'mn', loadWhy: async () => { throw new Error('x'); }});
  assert.equal((await f.club.host.clubDiag()).status, 'ready');
  assert.equal((await f.club.host.clubAnswer('a')).explanation, '까닭');
  const k = harness({lang: 'ko', loadWhy: async () => { throw new Error('한국어 화면은 받지 않는다'); }});
  await k.club.host.clubDiag();
  assert.equal((await k.club.host.clubAnswer('a')).explanation, '까닭');
});
