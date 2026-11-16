'use strict';
// 화면 모델(ui/screen-model.js)과 표기(ui/ko-format.js) — 엔진 상태가 시안 A의 기본 화면 여섯 상태와 주의 상태로 옮겨지는지,
// 날짜 · 시각 · 마감일을 실제 값에서 셈하는지 본다(시안 README 5절).
process.env.TZ = 'Asia/Seoul';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = (name) => import(pathToFileURL(path.join(__dirname, '..', 'ui', name)).href);

test('표기: 오전 · 오후 시각, 요일 붙은 날짜, 크기, 개수', async () => {
  const f = await load('ko-format.js');
  assert.equal(f.timeKo('2026-11-13T14:02:00+09:00'), '오후 2:02');
  assert.equal(f.timeKo('2026-11-13T00:30:00+09:00'), '오전 12:30');
  assert.equal(f.timeKo('2026-11-13T12:10:00+09:00'), '오후 12:10');
  assert.equal(f.timeKo('2026-11-13T09:05:00+09:00'), '오전 9:05');
  assert.equal(f.dayKo('2026-11-10T10:00:00+09:00'), '11월 10일 화');
  assert.equal(f.dayParen('2026-11-17T10:00:00+09:00'), '11월 17일(화)');
  const now = Date.parse('2026-11-13T14:40:00+09:00');
  assert.equal(f.whenKo('2026-11-13T14:02:00+09:00', now), '오후 2:02');
  assert.equal(f.whenKo('2026-11-12T18:02:00+09:00', now), '어제 오후 6:02');
  assert.equal(f.whenKo('2026-11-10T18:02:00+09:00', now), '11월 10일 화 오후 6:02');
  assert.equal(f.size(Math.round(18.4 * 1024 ** 3)), '18.4GB');
  assert.equal(f.size(61 * 1024 * 1024), '61MB');
  assert.equal(f.size(860 * 1024 * 1024), '860MB');
  assert.equal(f.count(12480), '12,480');
  assert.equal(f.josa('Outlook', '이/가'), 'Outlook이');
  assert.equal(f.josa('문서', '이/가'), '문서가');
  assert.equal(f.placesKo(4), '네 곳');
});

test('표기: 되돌리기 마감은 숨긴 시각 T + 29일이고 남은 날은 내림한다(설계 4.4-7)', async () => {
  const f = await load('ko-format.js');
  const m = await load('screen-model.js');
  const w = m.undoWindow('2026-11-12T14:59:00+09:00', Date.parse('2026-11-13T14:40:00+09:00'));
  assert.equal(w.untilKo, '12월 11일 오후 2:59');
  assert.equal(w.daysLeft, 28);
  assert.equal(f.daysLeft(w.until, w.until + 1), 0);
});

test('기본 화면: 예시 상태마다 시안 A의 화면 이름과 첫 할 일이 맞다', async () => {
  const { homeModel } = await load('screen-model.js');
  const { STATES, NOW } = await load('engine-fixtures.js');
  const want = {
    home: ['home', '안전합니다.', '파일 되살리기'],
    'home-run': ['home-run', '지금 백업하고 있습니다.', '파일 되살리기'],
    'home-partial': ['home-partial', '안전합니다.', '파일 되살리기'],
    'home-missing': ['home-missing', '폴더 하나를 찾을 수 없습니다.', '다시 고르기'],
    'home-mass': ['home-mass', '많은 파일이 한꺼번에 지워졌습니다.', '지워지기 전으로 되살리기'],
    'home-moved': ['home-moved', '백업이 「새 데스크톱」으로 옮겨졌습니다.', '파일 되살리기'],
    'home-overdue': ['home-overdue', '2일 동안 백업하지 못했습니다.', '지금 백업'],
    'home-credential': ['home-credential', '다시 로그인해야 이어서 지킵니다.', '다시 로그인'],
    'home-health': ['home-health', '백업 점검을 마치지 못했습니다.', '다시 점검'],
    'home-paused': ['home-paused', '백업을 잠시 쉬고 있습니다.', '지금 다시 시작'],
    'home-off': ['home-off', '자동 백업이 꺼져 있습니다.', '자동 백업 켜기'],
    'home-probe': ['home-probe', '되살려 본 파일이 원본과 달랐습니다.', '다시 되살려 보기'],
    'home-error': ['home-error', '지난 백업을 마치지 못했습니다.', '지금 백업'],
    start: ['start', '업무 자료를 매시간 저절로 지킵니다.', '보호 시작'],
  };
  for (const [name, [id, title, first]] of Object.entries(want)) {
    const m = homeModel(STATES[name], { now: NOW });
    assert.equal(m.id, id, name);
    assert.equal(m.title, title, name);
    assert.equal(m.actions[0]?.label, first, name);
    assert.ok(m.actions.filter((a) => a.kind === 'main').length <= 1, `${name}: 채운 단추는 한 화면에 하나`);
  }
});

test('기본 화면: 확인서 줄은 실제 값에서 셈한다', async () => {
  const { homeModel } = await load('screen-model.js');
  const { STATES, NOW } = await load('engine-fixtures.js');
  const ok = homeModel(STATES.home, { now: NOW });
  assert.equal(ok.kick, '작업 노트북 · 매시간 저절로 지키는 중');
  assert.deepEqual(ok.evidence.head, [{ k: '마지막 확인', v: '오후 2:02' }, { k: '다음 확인', v: '오후 3:02 무렵' }]);
  assert.deepEqual(ok.evidence.folders.rows.map((r) => [r.k, r.v]), [['문서', '5,310개'], ['바탕화면', '420개'], ['사진', '4,880개'], ['Projects', '1,870개']]);
  assert.equal(ok.evidence.total.v, '12,480개 · 18.4GB');
  assert.equal(ok.evidence.total.k, '네곳 합계');
  assert.equal(ok.evidence.proof.day, '11월 10일 화');
  assert.match(ok.evidence.proof.text, /파일 23개\(61MB\)/);
  assert.match(ok.evidence.proof.text, /다음은 11월 17일\(화\)입니다/);
  const miss = homeModel(STATES['home-missing'], { now: NOW });
  assert.equal(miss.evidence.folders.rows[3].v, '찾을 수 없음');
  assert.equal(miss.evidence.total.v, '10,610개 · 16.2GB');
  const run = homeModel(STATES['home-run'], { now: NOW });
  assert.deepEqual(run.progress, { label: '예약 백업', stage: '올리는 중', percent: 62 });
});

test('기본 화면: 엔진의 오류 · 단계 글을 그대로 옮기지 않는다', async () => {
  const { homeModel } = await load('screen-model.js');
  const { STATES, NOW } = await load('engine-fixtures.js');
  const err = homeModel(STATES['home-error'], { now: NOW });
  assert.doesNotMatch(JSON.stringify(err), /restic|B2|저장소|exit/);
  const run = homeModel({ ...STATES['home-run'], job: { kind: 'setup', stage: 'B2 암호화 저장소 연결 중', percent: null } }, { now: NOW });
  assert.equal(run.progress.stage, '준비 중');
  assert.doesNotMatch(JSON.stringify(run), /B2|저장소/);
});
