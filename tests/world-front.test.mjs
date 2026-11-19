// 첫날 끝 · 맞춤 앞면(1차) 다리의 순수 함수 — 판별 · 날 · 기록 · 할 일 바꾸기(구현 계획 docs/WORLD_첫날끝_1차_구현계획_20261119.md 5절).
import test from 'node:test';
import assert from 'node:assert/strict';
import {FRONT_AUTO,frontMode,frontEligible,dayKey,frontView,recordOf,studentOf,itemOf,reasonOf,planState,GOAL_REASONS} from '../experiences/synk-world-app/world-front-entry.mjs';

const left={version:1,stage:'left',dream:'idol',name:'볼로르',nameEn:'Bolor',call:'언니',from:'몽골',look:'mn_f',best:{s1e01:{n:3,t2:true,tr:false}},
 scenes:[{id:'s1e01.wrap',at:Date.parse('2026-11-19T13:00:00Z'),lines:4}],momAnswer:'fix',updatedAt:Date.parse('2026-11-19T13:05:00Z')};

test('스위치는 공개 전까지 꺼져 있다', () => { assert.equal(FRONT_AUTO, false); });

test('바로가기 주소는 지금 길로 간다', () => {
  for (const q of ['?drama=1', '?seoul=1', '?me2=1', '?cafe=1', '?wardrobe=1', '?exam=topik1', '?tutor=choose', '?opening=off']) assert.equal(frontMode(q), 'bypass', q);
  assert.equal(frontMode(''), null);
  assert.equal(frontMode('?lang=mn'), null);
});

test('자격: 스위치가 켜지고 서울행을 끝낸 학생만', () => {
  assert.equal(frontEligible({auto: false, arrival: left}), false);
  assert.equal(frontEligible({auto: true, arrival: left}), true);
  assert.equal(frontEligible({auto: true, arrival: {...left, stage: 'card'}}), false, '가는 중');
  assert.equal(frontEligible({auto: true, arrival: null}), false, '서울행 기록 없음(옛 학생)');
  assert.equal(frontEligible({auto: true, arrival: left, search: '?drama=1'}), false, '바로가기');
  assert.equal(frontEligible({auto: true, arrival: left, blocked: true}), false, '저장 충돌로 막힘');
});

test('날: 새벽 4시에 바뀐다', () => {
  assert.equal(dayKey(new Date(2026, 10, 20, 3, 59).getTime()), dayKey(new Date(2026, 10, 19, 23, 0).getTime()));
  assert.notEqual(dayKey(new Date(2026, 10, 20, 4, 1).getTime()), dayKey(new Date(2026, 10, 19, 23, 0).getTime()));
});

test('화면: 첫날 끝 → 다시 오면 첫날 맞춤 → 둘째 날 아침 한 번 → 맞춤', () => {
  const first = firstAt => ({...left, scenes: [{id: 's1e01.wrap', at: firstAt}]});
  const night = new Date(2026, 10, 19, 22, 40).getTime(), nextDay = new Date(2026, 10, 20, 9, 0).getTime();
  assert.equal(frontView({arrival: first(night), mark: {}, now: night + 60e3}), 'end');
  assert.equal(frontView({arrival: first(night), mark: {ended: true}, now: night + 600e3}), 'more');
  assert.equal(frontView({arrival: first(night), mark: {ended: true}, now: nextDay}), 'day2');
  assert.equal(frontView({arrival: first(night), mark: {}, now: nextDay}), 'day2', '끝을 못 보고 하루가 지남');
  assert.equal(frontView({arrival: first(night), mark: {ended: true, day2: true}, now: nextDay}), 'front');
  assert.equal(frontView({arrival: first(night), mark: {}, now: night, native: true}), 'more', 'PC 창 첫날은 끝 화면 없이 첫날 맞춤');
  assert.equal(frontView({arrival: first(night), mark: {}, now: nextDay, native: true}), 'front', 'PC 창 다음 날은 아침 없이 맞춤');
});

test('기록: 있는 사실만, 손님은 1화 기록 없음', () => {
  assert.deepEqual(recordOf(left), {spoke: 4, n: 3, t2: true, tr: false, mom: true, momAnswer: 'fix', wrap: true});
  assert.equal(recordOf({...left, momAnswer: 'ok'}).momAnswer, 'ok');
  assert.deepEqual(recordOf({...left, momAnswer: 'later'}).mom, false);
  assert.deepEqual(recordOf(left, {guest: true}), {spoke: 0, n: 0, t2: false, tr: false, mom: false, momAnswer: null, wrap: false});
  assert.deepEqual(recordOf(null), {spoke: 0, n: 0, t2: false, tr: false, mom: false, momAnswer: null, wrap: false});
});

test('학생: 얼굴 그림과 자르기 값', () => {
  const s = studentOf(left);
  assert.equal(s.name, '볼로르');
  assert.equal(s.face, '../seoul-arrival/assets/img/look-mn-f.webp');
  assert.ok(s.faceCrop && s.faceCrop.fw > 0);
  assert.equal(studentOf({...left, look: null}).face, null);
});

test('할 일: 레슨은 사진 · 다루는 것 · 세 마디, 마스코트 이름은 빼고', () => {
  const greet = itemOf({id: 'world.life.greetings-expressions', label: '첫 인사 세 마디', route: 'lesson', lessonId: 'greetings-expressions', minutes: 2});
  assert.equal(greet.title, '첫 인사 세 마디');
  assert.equal(greet.photo, 'ph9-greet');
  assert.equal(greet.topic, '만남 · 감사 · 소개 · {m}분');
  assert.deepEqual(greet.says, ['안녕하세요.', '감사합니다.', '저는 수진이에요.']);
  const story = itemOf({id: 'x', label: '이름표를 찾아서', route: 'lesson', lessonId: 'greetings-story', minutes: 3});
  assert.equal(story.says, null, '「저는 몽글이에요」가 든 이야기 레슨은 세 마디를 보이지 않는다');
  const hangul = itemOf({id: 'g', label: '한글 만나기 · 소리와 글자', route: 'game', gameId: 'hangul', minutes: 5});
  assert.equal(hangul.title, '한글 만나기');
  assert.equal(hangul.kind, '한글 · {m}분');
  assert.equal(hangul.photo, 'ph9-hangul');
  const diag = itemOf({id: 'p', label: '짧은 진단', route: 'position', minutes: 5});
  assert.equal(diag.photo, 'ph6-exam');
  assert.equal(diag.line, '처음 보는 문제로 짧게 확인해요.');
  assert.equal(itemOf(null), null);
});

test('이유: 코드마다 앞면 문장, 모르는 코드는 엔진 문장', () => {
  assert.equal(reasonOf({reasons: ['practice.unseen']}), '아직 안 해 본 것부터 해요.');
  assert.equal(reasonOf({reasons: ['practice.unseen', 'progress.next']}), '마친 레슨 바로 다음이에요. 처음 보는 표현이 나와요.');
  assert.equal(reasonOf({reasons: ['goal.declared', 'plan.recheck']}), '시험 목표에 맞춰 짧은 진단으로 시작점을 먼저 확인해요.');
  assert.equal(reasonOf({reasons: ['practice.checking'], reason: '낱말 뜻 읽기를 조금 더 확인해 봐요.'}), '낱말 뜻 읽기를 조금 더 확인해 봐요.');
});

test('계획 → 오늘 할 일 하나와 다른 걸로 둘', () => {
  const plan = {selected: {id: 'a', label: '첫 인사 세 마디', route: 'lesson', lessonId: 'greetings-expressions', minutes: 2}, reasons: ['practice.unseen'],
    alternatives: [{id: 'a'}, {id: 'b', label: '카페에서 하는 말', route: 'lesson', lessonId: 'cafe-expressions', minutes: 2}, {id: 'c', label: '계산대 앞 세 마디', route: 'lesson', lessonId: 'store-expressions', minutes: 2}, {id: 'd', label: '어디로 가면 될까요?', route: 'lesson', lessonId: 'directions-expressions', minutes: 2}]};
  const {plan: main, alts} = planState(plan);
  assert.equal(main.reason, '아직 안 해 본 것부터 해요.');
  assert.deepEqual(alts.map(a => a.title), ['카페에서 하는 말', '계산대 앞 세 마디']);
  assert.deepEqual(planState(null), {plan: null, alts: []});
});

test('둘째 날 목표 값은 학습 목표 창과 같은 열쇠', () => {
  assert.deepEqual(Object.keys(GOAL_REASONS).sort(), ['culture', 'exam', 'life', 'people', 'travel', 'work']);
});
