// 첫날 끝 · 맞춤 앞면(1차) 다리의 순수 함수 — 판별 · 날 · 기록 · 할 일 바꾸기(구현 계획 docs/WORLD_첫날끝_1차_구현계획_20261119.md 5절).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {FRONT_AUTO,frontMode,frontEligible,dayKey,dayIndex,firstOf,frontView,recordOf,studentOf,itemOf,reasonOf,planState,GOAL_REASONS,goalPatch,consentValues} from '../experiences/synk-world-app/world-front-entry.mjs';

const left={version:1,stage:'left',dream:'idol',name:'볼로르',nameEn:'Bolor',call:'언니',from:'몽골',look:'mn_f',best:{s1e01:{n:3,t2:true,tr:false}},
 scenes:[{id:'s1e01.wrap',at:Date.parse('2026-11-19T13:00:00Z'),lines:4}],momAnswer:'fix',updatedAt:Date.parse('2026-11-19T13:05:00Z')};

test('스위치는 켜져 있다(11-20 공개)', () => { assert.equal(FRONT_AUTO, true); });

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
  assert.equal(frontEligible({auto: true, arrival: left, newEngine: true}), false, 'Atlas 새 엔진을 켠 계정은 새 엔진 입구로');
});

test('날: 새벽 4시에 바뀐다', () => {
  assert.equal(dayKey(new Date(2026, 10, 20, 3, 59).getTime()), dayKey(new Date(2026, 10, 19, 23, 0).getTime()));
  assert.notEqual(dayKey(new Date(2026, 10, 20, 4, 1).getTime()), dayKey(new Date(2026, 10, 19, 23, 0).getTime()));
});

test('며칠째: 첫날 1, 새벽 4시 경계, 기록 없으면 1', () => {
  const at = new Date(2026, 10, 19, 22, 40).getTime(), arr = {scenes: [{id: 's1e01.wrap', at}]};
  assert.equal(dayIndex(arr, at + 3600e3), 1);
  assert.equal(dayIndex(arr, new Date(2026, 10, 20, 9, 0).getTime()), 2);
  assert.equal(dayIndex(arr, new Date(2026, 10, 22, 9, 0).getTime()), 4);
  assert.equal(dayIndex(null), 1);
});

test('첫날 기준: 기기 표에 처음 적은 때와 기록 가운데 이른 쪽(1화를 뒤늦게 봐도 날 수가 줄지 않음)', () => {
  const d1 = new Date(2026, 10, 19, 22, 0).getTime(), d2 = new Date(2026, 10, 20, 20, 0).getTime();
  const late = {scenes: [{id: 's1e01.wrap', at: d2}]};
  assert.equal(firstOf(late, {firstAt: d1}), d1);
  assert.equal(dayIndex(late, d2, firstOf(late, {firstAt: d1})), 2);
  assert.equal(frontView({arrival: late, mark: {firstAt: d1, ended: true}, now: d2}), 'day2');
  assert.equal(firstOf(late, {}), d2);
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

test('기록: 있는 사실만, 손님 사본의 1화 기록도 센다(11-23 손님 1화)', () => {
  assert.deepEqual(recordOf(left), {spoke: 4, n: 3, t2: true, tr: false, mom: true, momAnswer: 'fix', wrap: true});
  assert.equal(recordOf({...left, momAnswer: 'ok'}).momAnswer, 'ok');
  assert.deepEqual(recordOf({...left, momAnswer: 'later'}).mom, false);
  assert.deepEqual(recordOf(null), {spoke: 0, n: 0, t2: false, tr: false, mom: false, momAnswer: null, wrap: false});
  // 손님 첫날 끝: 로그인 판을 부르지 않고 내 길(이야기)의 1화로 보낸다. 1화를 봤으면 「1화 다시 보기」
  const app = fs.readFileSync(new URL('../experiences/world-front/app.mjs', import.meta.url), 'utf8');
  const acts = app.slice(app.indexOf('  const acts = P.hangul'), app.indexOf("  const nm = nameUI();"));
  assert.doesNotMatch(acts, /data-act="login"/);
  assert.match(acts, /data-act="story">\$\{esc\(ui\('1화 보기'\)\)\}/);
  assert.match(acts, /data-act="story">\$\{esc\(ui\('1화 다시 보기'\)\)\}/);
  assert.match(app, /mine = !P\.pc/, '손님 기록도 센다');
});

test('학생: 얼굴 그림과 자르기 값', () => {
  const s = studentOf(left);
  assert.equal(s.name, '볼로르');
  assert.equal(s.face, '../seoul-arrival/assets/img/look-mn-f.webp');
  assert.ok(s.faceCrop && s.faceCrop.fw > 0);
  assert.equal(studentOf({...left, look: null}).face, null);
});

test('학생: 내 사진 학생은 받은 서명 주소로 얼굴 원을 그리고, 못 받으면 얼굴 없이', () => {
  const me = {...left, look: null, photo: 'me'}, url = 'https://qiwxeddwwnzkwalpsuty.supabase.co/storage/v1/object/sign/me2-media/x.webp?token=t';
  const s = studentOf(me, url);
  assert.equal(s.face, url);
  assert.deepEqual(s.faceCrop, {fx: .5, fy: .36, fw: .34, w: 1152, h: 1536});
  assert.equal(studentOf(me).face, null, '주소를 못 받음');
  assert.equal(studentOf(me, 'http://x/y.webp').face, null, 'https만');
  assert.equal(studentOf(left, url).face, '../seoul-arrival/assets/img/look-mn-f.webp', '고른 얼굴 학생은 주소가 와도 그 얼굴');
  assert.equal(studentOf({...left, photo: 'me'}, null).face, null, '내 사진 표시가 있으면 남은 look을 쓰지 않는다');
});

test('앞면 다리: 내 사진은 4분 안 주소를 다시 쓰고, 한 요청은 2.5초만 한 번 기다리며, 늦게 와도 화면을 다시 그리지 않는다', () => {
  const src = fs.readFileSync(new URL('../experiences/synk-world-app/world-front-entry.mjs', import.meta.url), 'utf8');
  assert.match(src, /me2Photo=async\(\)=>null\}\)\{/);
  assert.match(src, /PHOTO_FRESH_MS=240000,PHOTO_RETRY_MS=60000,PHOTO_WAIT_MS=2500/);
  assert.match(src, /if\(!guest&&arrival\?\.photo==='me'\)/);
  assert.match(src, /if\(!cur\?\.late\|\|!cur\.ask\)\{photo=await Promise\.race/);
  assert.doesNotMatch(src, /ask\.then\(u=>\{[^}]*show\(/, '늦게 온 사진으로 show를 다시 부르지 않는다');
  assert.match(src, /student:studentOf\(arrival,photo\)/);
  const shell = fs.readFileSync(new URL('../experiences/synk-world-app/app-shell.mjs', import.meta.url), 'utf8');
  assert.match(shell, /me2:\{status:\(\)=>me2Status\(\),open:/);
  assert.match(shell, /me2Photo:async\(\)=>\{const v=photoView\(await me2Status\(\)\);return v\?\.on\?v\.url:null;\}/);
});

test('할 일: 레슨은 사진 · 다루는 것 · 세 마디, 마스코트 이름은 빼고', () => {
  const greet = itemOf({id: 'world.life.greetings-expressions', label: '첫 인사 세 마디', route: 'lesson', lessonId: 'greetings-expressions', minutes: 2});
  assert.equal(greet.title, '첫 인사 세 마디');
  assert.equal(greet.photo, 'ph9-greet');
  assert.equal(greet.topic, '만남 · 감사 · 소개 · {m}분');
  assert.deepEqual(greet.says, ['안녕하세요.', '감사합니다.', '저는 수진이에요.']);
  const story = itemOf({id: 'x', label: '이름표를 찾아서', route: 'lesson', lessonId: 'greetings-story', minutes: 3});
  // 11-22 생활 원고 2단: 이야기 레슨의 소개가 「저는 서하예요」(서울행 정문에서 만난 사람)가 되어 세 마디를 그대로 보인다.
  assert.deepEqual(story.says, ['안녕하세요.', '감사합니다.', '저는 서하예요.']);
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

test('목표 저장: 이유만 바꾸고 나머지는 둔다, 시험 정보가 있으면 시험 밖 목표는 학습 목표 창으로', () => {
  const exam = {reasons: ['exam'], primaryReason: 'exam', examType: 'topik1', targetGrade: 2, examDate: '2027-04', support: 'hints'};
  assert.deepEqual(goalPatch(exam, 'travel'), {window: true});
  assert.deepEqual(goalPatch(exam, 'exam').values, {...exam, reasons: ['exam'], primaryReason: 'exam', goal: null});
  assert.deepEqual(goalPatch({support: 'hints'}, 'travel').values, {support: 'hints', reasons: ['travel'], primaryReason: 'travel', goal: null});
  assert.deepEqual(goalPatch(null, 'life').values, {reasons: ['life'], primaryReason: 'life', goal: null});
});

test('목표 저장: 처음 동의하면 동아리 튜터 스타일을 함께, 이미 동의했으면 덮지 않는다', () => {
  const values = {reasons: ['travel'], primaryReason: 'travel', support: 'step', explanation: 'brief'}, tutor = {support: 'choose', explanation: 'detailed'};
  assert.deepEqual(consentValues({consent: false}, values, tutor), {...values, support: 'choose', explanation: 'detailed'}, '처음 동의');
  assert.deepEqual(consentValues(null, values, tutor), {...values, support: 'choose', explanation: 'detailed'}, '기록 없음도 처음 동의');
  assert.equal(consentValues({consent: true}, values, tutor), values, '이미 동의');
  assert.deepEqual(consentValues({consent: false}, values, {}), values, '튜터를 안 골랐으면 그대로');
});
