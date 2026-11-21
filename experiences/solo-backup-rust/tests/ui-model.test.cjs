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
  // 대문자 약어는 글자 이름으로 읽는다(「거실 PC를」 · 「IBM을」)
  assert.equal(f.josa('거실 PC', '을/를'), '거실 PC를');
  assert.equal(f.josa('IBM', '을/를'), 'IBM을');
  assert.equal(f.josa('LG', '으로/로'), 'LG로');
  assert.equal(f.placesKo(4), '네 곳');
  assert.equal(f.josa('사무실', '으로/로'), '사무실로');
  assert.equal(f.josa('PC 1', '으로/로'), 'PC 1로');
  assert.equal(f.josa('새 데스크톱', '으로/로'), '새 데스크톱으로');
  assert.equal(f.josa('노트북', '으로/로'), '노트북으로');
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
  assert.equal(ok.evidence.total.k, '네 곳 합계');
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

// 카본 검수(11-16 묶음 workbackup-ui-20261116b)에서 실제 엔진 상태로 틀린 말을 하던 자리들
test('기본 화면: 실제 엔진 상태의 빈칸 · 갈래에서 틀린 말을 하지 않는다', async () => {
  const { homeModel } = await load('screen-model.js');
  const { STATES, NOW } = await load('engine-fixtures.js');
  const base = STATES.home;
  // A1 — 엔진 lastProbe에 개수가 없으면 「0개」라 하지 않는다
  const probe = homeModel({ ...base, lastProbe: { result: 'passed', at: base.lastProbe.at } }, { now: NOW });
  assert.equal(probe.evidence.proof.short, '원본과 같음');
  assert.doesNotMatch(probe.evidence.proof.text, /0개|0B/);
  // A5 — 백업이 아닌 일을 「백업하고 있습니다」라 하지 않고, 설정 전에는 되살리기 · 옮겨 오기를 내밀지 않는다
  const check = homeModel({ ...base, job: { kind: 'check', stage: '점검 중', percent: null } }, { now: NOW });
  assert.equal(check.title, '백업을 점검하고 있습니다.');
  const selected = homeModel({ ...base, job: { kind: 'restore-selected', stage: '복구 중', percent: 10 } }, { now: NOW });
  assert.equal(selected.title, '파일을 되살리고 있습니다.');
  // 도는 되살리기에는 「되살리기 그만두기」만 둔다(요청 16) — 되살리기 · 옮겨 오기는 내밀지 않는다
  assert.deepEqual(selected.actions.map((a) => a.id), ['restore-stop']);
  const setup = homeModel({ ...STATES.start, job: { kind: 'setup', stage: '준비 중', percent: null } }, { now: NOW });
  assert.equal(setup.title, '보호를 준비하고 있습니다.');
  assert.deepEqual(setup.actions, []);
  assert.equal(setup.evidence, null);
  // A6 — 여럿이 빠지면 몇 곳인지 쓰고, 모두 빠지면 백업했다고 하지 않고, 되살리기만 하는 연결에는 쓰기 단추가 없다
  const two = homeModel({ ...base, missingSources: [base.sources[2], base.sources[3]] }, { now: NOW });
  assert.equal(two.title, '폴더 두 곳을 찾을 수 없습니다.');
  assert.match(two.sub, /폴더 두 곳\(「사진」, 「Projects」\)이 없어 그 폴더들만 빼고 백업했습니다\. 나머지 두 곳은/);
  assert.equal(two.actions[1].drawer, true);
  const all = homeModel({ ...base, missingSources: [...base.sources] }, { now: NOW });
  assert.equal(all.title, '지키는 폴더를 모두 찾을 수 없습니다.');
  assert.doesNotMatch(all.sub, /백업했습니다/);
  const ro = homeModel({ ...base, readOnly: true, missingSources: [base.sources[3]], protection: { level: 'restoreOnly', reason: 'restoreOnly' } }, { now: NOW });
  assert.equal(ro.id, 'home-restore-only');
  assert.deepEqual(ro.actions.map((a) => a.id), ['restore']);
  // 엔진 순서처럼 연결 끊김이 빠진 폴더보다 먼저다
  const cred = homeModel({ ...base, credentialRequired: true, missingSources: [base.sources[3]], protection: { level: 'attention', reason: 'credential' } }, { now: NOW });
  assert.equal(cred.id, 'home-credential');
  // A8 — 모르는 까닭의 「확인 필요」를 「안전합니다」로 내리지 않는다
  const odd = homeModel({ ...base, protection: { level: 'attention', reason: 'something-new' } }, { now: NOW });
  assert.equal(odd.id, 'home-attention');
  assert.notEqual(odd.title, '안전합니다.');
  // B5 — 쉬는 동안 · 연결이 끊긴 동안의 다음 확인
  const paused = homeModel(STATES['home-paused'], { now: NOW });
  assert.deepEqual(paused.evidence.head[1], { k: '다음 확인', v: '오후 6시 무렵' });
  assert.equal(homeModel(STATES['home-credential'], { now: NOW }).evidence.head.length, 1);
  // B6 — 부분 판이 마지막 확인이다
  const part = homeModel(STATES['home-partial'], { now: NOW });
  assert.equal(part.evidence.head[0].v, '오후 2:02');
  assert.deepEqual(part.evidence.extra[0], { k: '쓰는 중이라 앞 판으로', v: '2개 · 오후 1:02' });
  // 첫 백업이 부분 판이면 「앞 판으로 지킨다」고 하지 않는다
  const firstPart = homeModel({ ...STATES['home-partial'], lastBackup: { id: 'b'.repeat(64), at: STATES['home-partial'].lastPartial.at, files: 12480, bytes: 1 } }, { now: NOW });
  assert.equal(firstPart.title, '쓰는 중인 파일은 아직 담지 못했습니다.');
  // B10 — 「세 곳」은 띄어 쓴다
  const miss = homeModel(STATES['home-missing'], { now: NOW });
  assert.match(miss.sub, /나머지 세 곳은/);
  assert.equal(miss.evidence.head[0].v, '오후 2:02 · 세 곳');
});

test('그리기: 실제 상태에서는 예시 값으로 메우지 않는다(카본 B2 · B3 · B7 · B9 · B15)', async () => {
  const { renderScreen, drawer } = await load('screen-view.js');
  const { homeModel } = await load('screen-model.js');
  const { STATES, NOW } = await load('engine-fixtures.js');
  const real = { ...STATES.home, device: undefined, recovery: undefined };
  const move = renderScreen('move-0', { state: real, now: NOW, model: homeModel(real, { now: NOW }) }).html;
  assert.doesNotMatch(move, /studio@example\.com|작업 노트북|다시 깔 프로그램<\/span>/);
  const s3 = renderScreen('start-3', { state: { ...real, job: { kind: 'protect', percent: null } }, now: NOW }).html;
  assert.match(s3, /aria-valuenow="0"/);
  const part = { ...STATES['home-partial'], admin: undefined };
  const p = renderScreen('partial', { state: part, now: NOW }).html;
  assert.doesNotMatch(p, /4시간|오후 5:02|관리자/);
  assert.doesNotMatch(p, /오늘 오늘/);
  const miss = renderScreen('home', { state: STATES['home-missing'], now: NOW, model: homeModel(STATES['home-missing'], { now: NOW }) }).html;
  assert.equal((miss.match(/찾을 수 없음/g) || []).length, 1);
  assert.doesNotMatch(drawer({ ...real, device: '' }), /이 PC\(이 PC\)/);
});

// Fable 5.2 최종 검수(11-16)에서 실제 엔진의 답과 대조해 나온 자리들
test('기본 화면: 엔진의 실제 답과 맞춘다(Fable F1 · F2 · F9 · F10)', async () => {
  const { homeModel } = await load('screen-model.js');
  const { STATES, NOW } = await load('engine-fixtures.js');
  const base = STATES.home;
  // F1 — 예약을 다시 거는 것은 setLaunchAtLogin(true)다
  const startup = homeModel(STATES['home-startup'], { now: NOW });
  assert.equal(startup.id, 'home-startup');
  assert.deepEqual([startup.actions[0].call, startup.actions[0].arg], ['setLaunchAtLogin', true]);
  assert.doesNotMatch(startup.sub, /창을 닫으면/);
  // F2 — 되살린 뒤 「되살린 폴더 열기」, 실패면 까닭, 이 창이 지켜본 전체 되살리기 실패는 백업 실패라 하지 않는다
  const restored = homeModel(STATES['home-restored'], { now: NOW });
  assert.match(restored.restored.text, /오후 2:20에 고른 파일 3개를 되살렸습니다/);
  assert.equal(restored.restored.act.call, 'openSelectedRestoreFolder');
  const selErr = homeModel({ ...base, lastSelectedRestoreError: { code: 'NO_SPACE', at: new Date(NOW - 60000).toISOString() } }, { now: NOW });
  assert.equal(selErr.restored.bad, true);
  assert.match(selErr.restored.text, /다른 드라이브를 골라/);
  // 전체 되살리기가 건너뛴 수(엔진 lastRestore.skipped — 연결 · 특수 파일 · 쓸 수 없는 이름, 폴더도 센다)
  const skippedFull = homeModel({ ...base, lastRestore: { path: 'x', at: new Date(NOW - 60000).toISOString(), skipped: 4 } }, { now: NOW });
  assert.match(skippedFull.restored.text, /전체를 되살렸습니다\. 4개는 만들지 않고 건너뛰었습니다\. 다른 곳을 가리키는 연결, 특수 파일, Windows에서 쓸 수 없는 이름입니다\./);
  const { findBanned } = await load('banned-words.js');
  assert.deepEqual(findBanned(skippedFull.restored.text), []); // 예시 상태 묶음에 없는 글이라 화면 글 검사를 여기서 건다
  assert.doesNotMatch(homeModel({ ...base, lastRestore: { path: 'x', at: new Date(NOW - 60000).toISOString() } }, { now: NOW }).restored.text, /건너뛰었습니다/);
  const old = homeModel({ ...base, lastRestore: { path: 'x', at: new Date(NOW - 2 * 86400000).toISOString() } }, { now: NOW });
  assert.equal(old.restored, undefined);
  // 백업 실패(lastError)는 되살리기 실패로 읽지 않는다 — 엔진이 되살리기 실패를 lastRestoreError에 따로 적는다(조율 세션 25d66f324)
  assert.equal(homeModel({ ...STATES['home-error'], lastError: '복구 폴더를 만들지 못했습니다.' }, { now: NOW }).id, 'home-error');
  const restoring = homeModel({ ...base, job: { kind: 'restore', stage: '복구 중', percent: 5 } }, { now: NOW });
  assert.doesNotMatch(restoring.sub, /엽니다\./);
  // F9 — 다시 로그인은 첫 시작 화면으로 보내지 않고, 복구 정보는 Google이 이어져 있지 않으면 먼저 잇는다
  assert.ok(homeModel(STATES['home-credential'], { now: NOW }).actions[0].pending);
  const rec = (recovery) => homeModel({ ...base, recoverySaved: false, recovery, protection: { level: 'attention', reason: 'recovery' } }, { now: NOW }).actions[0];
  assert.equal(rec({ available: true, connected: false }).call, 'connectRecovery');
  assert.equal(rec({ available: true, connected: true }).call, 'syncRecovery');
  assert.ok(rec({ available: false, connected: false }).pending);
  // F10 — 엔진의 되살려 보기는 파일 하나다. 「1개 모두」라 하지 않고, 건너뛰면 엔진이 다시 하는 날을 쓴다
  const one = homeModel({ ...base, lastProbe: { result: 'passed', at: base.lastProbe.at, files: 1, bytes: 2048 } }, { now: NOW });
  assert.equal(one.evidence.proof.short, '파일 1개가 원본과 같음');
  const limit = homeModel({ ...base, lastProbe: { result: 'skipped', reason: 'limit', at: base.lastProbe.at } }, { now: NOW });
  assert.match(limit.evidence.proof.text, /12월 10일\(목\)에 다시 해 봅니다/);
  const incomplete = homeModel({ ...base, lastProbe: { result: 'incomplete', reason: 'unconfirmed', at: base.lastProbe.at } }, { now: NOW });
  assert.match(incomplete.evidence.proof.short, /11월 17일\(화\)에 다시 해 봄/);
});

test('실패 글: 기다려도 풀리지 않는 까닭에 「잠시 뒤」라 하지 않는다(Fable F3)', async () => {
  const { failureText } = await load('state-store.js');
  for (const code of ['RESTORE_FAILED', 'ENOSPC', 'EACCES', 'EPERM', 'ENOENT', 'OUTPUT_UNSAFE', 'NO_SPACE', 'CATALOG_TOO_LARGE', 'SELECTION_LIMIT', 'CREDENTIAL_REQUIRED', 'NO_SNAPSHOT', 'UNSAFE_MANIFEST', 'LAST_FOLDER', 'INTEGRITY_FAILED']) {
    assert.doesNotMatch(failureText(code), /잠시 뒤/, code);
  }
  assert.match(failureText('OUTPUT_UNSAFE'), /지키는 폴더 밖/);
});

test('그리기: 엔진 목록 줄의 번호 붙은 폴더 이름을 손님 말로(Fable F6) · 새 PC 쪽은 아직이라고 먼저 말한다(F8)', async () => {
  const { renderScreen } = await load('screen-view.js');
  const { STATES, NOW } = await load('engine-fixtures.js');
  const cat = { token: 't', profile: 'b2', loading: false, total: 1, offset: 0, query: '', selection: { revision: 1, count: 0 }, rows: [{ id: '1', name: '견적.pdf', source: '01-Documents', path: '/견적/견적.pdf', size: 10 }] };
  const html = renderScreen('restore', { state: STATES.home, now: NOW, catalog: cat }).html;
  assert.match(html, /문서 › 견적/);
  assert.doesNotMatch(html, /01-Documents/);
  const err = renderScreen('restore', { state: STATES.home, now: NOW, catalog: { loading: false, error: '까닭', rows: [] } }).html;
  assert.match(err, /data-act="reopen"/);
  assert.match(renderScreen('move-0', { state: STATES.home, now: NOW }).html, /다음 업데이트에서 열립니다/);
  assert.doesNotMatch(renderScreen('move-0', { state: STATES.home, now: NOW, fake: true }).html, /다음 업데이트에서 열립니다/);
});

test('셋째: 전체 되살리기 실패 칸(lastRestoreError)과 점검 주의를 되살리기 말로 쓴다(조율 세션 25d66f324)', async () => {
  const { homeModel } = await load('screen-model.js');
  const { renderScreen } = await load('screen-view.js');
  const { STATES, NOW } = await load('engine-fixtures.js');
  const { findBanned } = await load('banned-words.js');
  const m = homeModel(STATES['home-restore-error'], { now: NOW });
  assert.equal(m.id, 'home-restore-error');
  assert.equal(m.title, '파일을 되살리지 못했습니다.');
  assert.match(m.sub, /빈 공간과 인터넷 연결/);
  assert.doesNotMatch(m.sub, /만들다 만 폴더/, '폴더를 만들기 전의 실패에는 만들다 만 폴더 말이 없다');
  // 쓰는 도중의 실패(ENOSPC · 만든 폴더 있음)는 그 폴더를 쓰지 말라고 한다(Fable 셋째 F4 — 엔진이 실제로 적는 꼴)
  const mid = { ...STATES['home-restore-error'], lastRestoreError: { code: 'ENOSPC', at: STATES['home-restore-error'].lastRestoreError.at, path: 'C:\\Users\\studio\\Downloads\\되살린 파일 (11월 13일)' } };
  const mm = homeModel(mid, { now: NOW });
  assert.match(mm.sub, /빈 공간이 모자랍니다/);
  assert.match(mm.sub, /「되살린 파일 \(11월 13일\)」의 파일은 다 확인하지 못했으니/);
  assert.equal(m.restored, undefined, '제목이 된 실패를 줄로 또 쓰지 않는다');
  assert.deepEqual(m.actions.map((a) => a.id), ['restore', 'check']);
  assert.equal(m.actions[0].label, '다시 되살리기');
  assert.doesNotMatch(renderScreen('home', { state: STATES['home-restore-error'], model: m, now: NOW }).html, /백업 점검을 마치지 못했습니다/);
  // 카본 A1 — 같은 날 먼저 성공한 되살리기 줄을 실패 제목 아래에 띄우지 않는다. 실패 뒤의 고른 파일 되살리기는 띄운다
  const earlierOk = { ...STATES['home-restore-error'], lastRestore: { path: 'x', at: new Date(NOW - 3 * 3600000).toISOString() }, lastSelectedRestore: { path: 'y', at: new Date(NOW - 2 * 3600000).toISOString(), files: 2 } };
  assert.equal(homeModel(earlierOk, { now: NOW }).restored, undefined);
  const laterSel = { ...earlierOk, lastSelectedRestore: { path: 'y', at: new Date(NOW - 60000).toISOString(), files: 2 } };
  assert.match(homeModel(laterSel, { now: NOW }).restored.text, /고른 파일 2개를 되살렸습니다/);
  // 점검 주의가 되살리기와 따로 걸린 것(다른 때)이면 점검 말 그대로
  const apart = { ...STATES['home-restore-error'], health: { ...STATES['home-restore-error'].health, checkedAt: new Date(NOW - 5 * 3600000).toISOString() } };
  assert.equal(homeModel(apart, { now: NOW }).id, 'home-health');
  assert.match(homeModel(apart, { now: NOW }).restored.text, /전체를 되살리지 못했습니다/);
  // 점검 주의 없이 실패만(놓을 자리 거절)이면 기본 화면에 한 줄
  const u = homeModel(STATES['home-restore-unsafe'], { now: NOW });
  assert.equal(u.id, 'home');
  assert.equal(u.restored.bad, true);
  assert.match(u.restored.text, /오후 2:21에 전체를 되살리지 못했습니다\. 지키는 폴더 밖의 자리를/);
  assert.deepEqual(findBanned(u.restored.text), []);
  assert.deepEqual(findBanned(m.sub), []);
  // 그 뒤에 성공했거나 하루가 지났으면 내린다 · 백업 실패와 섞지 않는다
  assert.match(homeModel({ ...STATES['home-restore-unsafe'], lastRestore: { path: 'x', at: new Date(NOW - 60000).toISOString() } }, { now: NOW }).restored.text, /전체를 되살렸습니다/);
  assert.equal(homeModel({ ...STATES['home-restore-unsafe'], lastRestoreError: { code: 'OUTPUT_UNSAFE', at: new Date(NOW - 2 * 86400000).toISOString() } }, { now: NOW }).restored, undefined);
  assert.equal(homeModel({ ...STATES.home, lastRestoreError: { code: 'NO_SPACE', at: new Date(NOW - 2 * 86400000).toISOString() }, health: STATES['home-restore-error'].health, protection: STATES['home-restore-error'].protection }, { now: NOW }).id, 'home-health');
});

test('셋째: 되살릴 자리 — 기본은 다운로드 › 되살린 파일 (날짜), 「자리 바꾸기」, 다운로드를 지키면 처음부터 고르기', async () => {
  const { restorePlace } = await load('screen-model.js');
  const { renderScreen } = await load('screen-view.js');
  const { STATES, NOW } = await load('engine-fixtures.js');
  assert.deepEqual(restorePlace(STATES.home, null, NOW), { mode: 'default', name: '되살린 파일 (11월 13일)', guarded: false, unsafe: false });
  assert.equal(restorePlace(STATES.home, 'pick', NOW).mode, 'pick');
  for (const p of ['C:\\Users\\studio\\Downloads', 'C:\\Users\\studio\\Downloads\\견적', 'C:\\Users\\studio', 'D:\\', 'C:']) {
    const r = restorePlace({ sources: [p] }, 'default', NOW);
    assert.equal(r.mode, 'pick', p); assert.equal(r.guarded, true, p);
  }
  assert.equal(restorePlace({ sources: ['C:\\Users\\studio\\Documents'] }, null, NOW).guarded, false);
  const cat = { token: 't', profile: 'b2', rows: [], total: 0, fileCount: 3, selection: { count: 0, bytes: 0, revision: 1 } };
  const draw = (state, ui) => renderScreen('restore', { state, now: NOW, catalog: cat, ui }).html;
  const d = draw(STATES.home, {});
  assert.match(d, /놓을 자리 <b>다운로드 › 되살린 파일 \(11월 13일\)<\/b>/);
  assert.match(d, /data-act="place-pick"/);
  assert.doesNotMatch(d, /고르는 창이/);
  const p = draw(STATES.home, { place: 'pick' });
  assert.match(p, /누를 때 고름/); assert.match(p, /data-act="place-default"/); assert.match(p, /고르는 창이 한 번 뜹니다/);
  const g = draw({ ...STATES.home, sources: ['C:\\Users\\studio\\Downloads'] }, {});
  assert.doesNotMatch(g, /data-act="place-default"/); assert.match(g, /다운로드도 지키는 폴더라/);
  // Fable 셋째 F1 — 기본 자리에서도 단추 아래에 자리를 쓰고, 전체 되살리기는 확인 한 걸음을 거친다
  assert.match(d, /다운로드 안의 「되살린 파일 \(11월 13일\)」 폴더에 바로 놓습니다\. 같은 이름이 있으면 번호를/);
  const all = renderScreen('restore', { state: STATES.home, now: NOW, catalog: cat, ui: {} });
  assert.equal(all.acts['restore-all'].call, undefined); assert.equal(all.acts['restore-all'].confirmAll, true);
  const sure = renderScreen('restore', { state: STATES.home, now: NOW, catalog: cat, ui: { confirmAll: true } });
  assert.match(sure.html, /전체 3개 · 18\.4GB를 되살릴까요\?/); assert.match(sure.html, /data-act="restore-all-go"/); assert.match(sure.html, /data-act="restore-all-no"/);
  assert.equal(sure.acts['restore-all-go'].call, 'restoreLatest');
  assert.equal(renderScreen('restore', { state: STATES.home, now: NOW, catalog: cat, ui: { place: 'pick' } }).acts['restore-all'].call, 'restoreLatest', '고르는 창이 확인을 겸한다');
  // Fable 셋째 F3 — 하루 안에 놓을 자리가 겹쳐 거절됐으면(복구 전용 연결처럼 지키는 폴더가 비어도) 고르기로 시작한다
  const refused = { ...STATES['home-restore-read'], lastSelectedRestoreError: { code: 'OUTPUT_UNSAFE', at: new Date(NOW - 600000).toISOString() } };
  const sentAt = NOW - 660000;
  assert.deepEqual(restorePlace(refused, null, NOW, sentAt), { mode: 'pick', name: '되살린 파일 (11월 13일)', guarded: true, unsafe: true });
  assert.equal(restorePlace({ ...refused, lastSelectedRestoreError: { code: 'OUTPUT_UNSAFE', at: new Date(NOW - 2 * 86400000).toISOString() } }, null, NOW, sentAt).mode, 'default');
  assert.match(draw(refused, { sentDefaultAt: sentAt }), /다운로드에는 놓을 수 없어/);
  // Fable 셋째 -b FA1 — 손님이 고른 자리의 거절(기본 자리로 보낸 적이 없거나, 그보다 앞선 거절)은 다운로드 탓으로 읽지 않는다
  assert.equal(restorePlace(refused, null, NOW).mode, 'default');
  assert.equal(restorePlace(refused, null, NOW, NOW - 60000).mode, 'default');
  // 확인 상자는 새로 뜰 때 읽힌다
  // 확인 글은 열릴 때 창이 한 번만 알린다 — 다시 그릴 때마다 읽히는 role=alert는 두지 않는다(-c FA2)
  const box = renderScreen('restore', { state: STATES.home, now: NOW, catalog: cat, ui: { confirmAll: true } }).html;
  assert.match(box, /<div class="box rise i3" id="confirm-all"><b>전체/); assert.doesNotMatch(box, /role="alert"/);
});

test('셋째: 결과 줄에 실제로 만든 폴더 이름(Fable 셋째 F2) · 되돌리기의 「연결된 앱」은 연결된 앱 페이지(F5)', async () => {
  const { homeModel } = await load('screen-model.js');
  const { renderScreen } = await load('screen-view.js');
  const { STATES, NOW } = await load('engine-fixtures.js');
  const at = new Date(NOW - 60000).toISOString();
  assert.match(homeModel({ ...STATES.home, lastRestore: { path: 'C:\\Users\\studio\\Downloads\\되살린 파일 (11월 13일) 2', at } }, { now: NOW }).restored.text, /전체를 「되살린 파일 \(11월 13일\) 2」에 되살렸습니다/);
  assert.match(homeModel({ ...STATES.home, lastSelectedRestore: { path: 'C:\\Users\\studio\\Downloads\\되살린 파일 (11월 13일)', at, files: 3 } }, { now: NOW }).restored.text, /고른 파일 3개를 「되살린 파일 \(11월 13일\)」에 되살렸습니다/);
  // 손님이 고른 자리의 엔진 이름(선택복구-…)은 쓰지 않는다
  assert.match(homeModel({ ...STATES.home, lastSelectedRestore: { path: 'E:\\보관\\선택복구-2026-11-13T05-39-00-000Z-abcdef123456', at, files: 3 } }, { now: NOW }).restored.text, /고른 파일 3개를 되살렸습니다/);
  const u2 = renderScreen('undo-2', { state: STATES.home, now: NOW, undo: null, fake: true }).html;
  assert.match(u2, /data-act="g-apps"/); assert.doesNotMatch(u2, /data-act="g-app"/);
});

test('셋째: Google 계정 페이지 단추(openGoogleAccount)와 같은 PC의 앞선 연결(sameInstall)', async () => {
  const { homeModel, deviceLine } = await load('screen-model.js');
  const { renderScreen, drawer } = await load('screen-view.js');
  const { STATES, NOW } = await load('engine-fixtures.js');
  const draw = (id, state, extra = {}) => renderScreen(id, { state, model: homeModel(state, { now: NOW }), now: NOW, ...extra });
  // Google 걸음 상자가 있는 화면마다 두 페이지 단추가 있다(창이 click에서 openGoogleAccount('devices' · 'removal')로 보낸다)
  for (const [id, st, extra] of [['home', STATES['home-lost-step']], ['lost-2', STATES['home-lost-step'], { acct: { lost: { name: '거실 PC', at: NOW } } }], ['start-2', { ...STATES['start-read'], account: { ...STATES['start-read'].account, googleStepRequired: true } }], ['start-2', STATES['start-google-step']]]) {
    const html = draw(id, st, extra).html;
    assert.match(html, /data-act="g-dev"/, id); assert.match(html, /data-act="g-app"/, id);
  }
  const lost2 = draw('lost-2', STATES['home-lost-step'], { acct: { lost: { name: '거실 PC', at: NOW } } });
  assert.equal(lost2.acts['g-dev'], undefined, '「준비 중」 표식을 걷었다');
  assert.match(lost2.html, /myaccount\.google\.com\/connections/, '창을 다시 열어도 상태의 정리 페이지 주소를 쓴다');
  // 같은 PC의 앞선 연결은 「이 PC · 앞서 깐 것」이고 분실 신고 단추가 없다
  assert.equal(deviceLine({ id: 'o'.repeat(12), name: '작업 노트북', state: 'active', role: 'read' }, NOW, ['o'.repeat(12)]).name, '작업 노트북(이 PC · 앞서 깐 것)');
  assert.equal(deviceLine({ id: 'o'.repeat(12), name: '작업 노트북', state: 'active', role: 'read' }, NOW, []).name, '작업 노트북');
  const st = { ...STATES['home-writekey'], account: { ...STATES['home-writekey'].account, sameInstall: ['o'.repeat(12)] } };
  const devices = [{ id: 'd'.repeat(12), name: '작업 노트북', current: true, state: 'active', role: 'write' }, { id: 'o'.repeat(12), name: '작업 노트북', state: 'active', role: 'read' }, { id: 'x'.repeat(12), name: '거실 PC', state: 'active', role: 'read' }];
  const dr = drawer(st, { devices, now: NOW });
  assert.match(dr, /작업 노트북\(이 PC · 앞서 깐 것\)/);
  assert.equal((dr.match(/data-act="lost-dev"/g) || []).length, 1);
  assert.match(dr, /data-device="xxxxxxxxxxxx"/);
});

test('예약이 빠졌으면 다음 확인 시각을 쓰지 않는다 · 마지막 폴더 글 · 이 창의 일로 막힘(Fable FA3 · FA5 · FA6)', async () => {
  const { homeModel } = await load('screen-model.js');
  const { failureText, createStore } = await load('state-store.js');
  const { STATES, NOW } = await load('engine-fixtures.js');
  assert.equal(homeModel(STATES['home-startup'], { now: NOW }).evidence.head.length, 1);
  assert.match(failureText('LAST_FOLDER'), /적어도 하나/);
  const api = { getState: async () => ({ ok: true, value: { version: '0.7.0' } }), openFileCatalog: async () => ({ ok: false, error: '진행 중인 작업이 끝난 뒤 다시 눌러 주세요.' }) };
  assert.deepEqual(await createStore(api).call('openFileCatalog', {}), { ok: false, code: 'JOB_BUSY' });
});

// 개통 잇기(11-16 · 조율 세션 48f797b69의 메서드 13개 · Fable 개통 설계 검토 「고쳐서 간다」)
test('개통: 첫 시작의 걸음, 이어서 백업 · 연결 다시 받기 · 복구 정보 · 되돌리기 답 없음 갈래', async () => {
  const { homeModel, startStep, writerName, deviceLine } = await load('screen-model.js');
  const { STATES, NOW } = await load('engine-fixtures.js');
  assert.equal(startStep(STATES.start), 'signin');
  assert.equal(startStep(STATES['start-signin']), 'signin');
  assert.equal(startStep(STATES['start-write']), 'scope');
  assert.equal(startStep(STATES['start-read']), 'read');
  assert.equal(homeModel(STATES['start-write'], { now: NOW }).id, 'start');
  // 복구 전용으로 남은 PC가 쓰는 기기면 「이어서 백업」 — 고른 폴더가 없으면 부르지 않는다(Fable 지적 1 · 2)
  const opened = { ...STATES.home, mode: 'restore', protection: { level: 'restoreOnly', reason: 'restoreOnly' }, account: STATES['start-write'].account };
  const m1 = homeModel(opened, { now: NOW });
  assert.equal(m1.id, 'home-continue');
  // 폴더가 비면 이어서 백업을 부르지 않고 폴더 고르기부터(복구 전용 연결에서도 chooseSources가 된다 — c725f319c 부탁 12)
  assert.equal(m1.actions[0].call, 'chooseSources');
  assert.ok(!m1.actions.some((a) => a.call === 'continueBackup'));
  const m2 = homeModel({ ...opened, selection: { sources: ['C:\\Users\\studio\\Documents'] } }, { now: NOW });
  assert.equal(m2.actions[0].call, 'continueBackup');
  assert.equal(m2.actions[0].account, true);
  // 연 뒤에 고른 폴더(nextSources)도 고른 것으로 센다
  assert.equal(homeModel({ ...opened, nextSources: ['D:\\Projects'] }, { now: NOW }).actions[0].call, 'continueBackup');
  // 읽기 기기의 복구 전용 연결: 폴더를 고르면 「이 PC에서 이어서 백업」(takeOver 차례)
  const readOpened = { ...opened, account: STATES['start-read'].account };
  assert.equal(homeModel(readOpened, { now: NOW }).id, 'home-restore-read');
  // 둘째 단추는 「이 PC로 옮겨 오기」(d32d25233 뒤), 그다음이 이어서 백업의 차례다
  assert.equal(homeModel(readOpened, { now: NOW }).actions[1].to, 'move-1');
  assert.equal(homeModel(readOpened, { now: NOW }).actions[2].call, 'chooseSources');
  assert.equal(homeModel({ ...readOpened, nextSources: ['D:\\Projects'] }, { now: NOW }).actions[2].flow, 'takeOver');
  // 되돌리기 멈춤(account.restore.hold) — 확인하러 가기
  const held = homeModel({ ...STATES.home, account: { ...STATES['home-writekey'].account, needs: [], restore: { hold: true, jobId: 'j1', state: 'done', awaitingChoice: true, at: NOW - 86400000, byThisDevice: true, error: null, undo: false } } }, { now: NOW });
  assert.equal(held.id, 'home-restore-hold');
  assert.equal(held.title, '되돌린 백업을 확인할 차례입니다.');
  assert.equal(held.actions[0].to, 'undo-3');
  const wk = homeModel(STATES['home-writekey'], { now: NOW });
  assert.equal(wk.id, 'home-writekey');
  assert.equal(wk.actions[0].call, 'takeWriteSeat');
  const rk = homeModel(STATES['home-lost-step'], { now: NOW });
  assert.equal(rk.id, 'home-readkey');
  assert.equal(rk.googleStep, true);
  assert.ok(rk.box && /Google/.test(rk.box.title));
  const wait = homeModel({ ...STATES.home, account: { ...STATES['home-writekey'].account, needs: ['restore', 'write-key'] } }, { now: NOW });
  assert.equal(wait.id, 'home-restore-wait');
  assert.equal(wait.evidence.head.length, 1, '쉬는 동안 다음 확인 시각을 약속하지 않는다');
  // 쓰는 기기 이름은 상태가 비면 기기 목록에서(Fable 지적 12)
  assert.equal(writerName(STATES['start-read']), '작업 노트북');
  const devices = [{ id: 'a'.repeat(12), name: '사무실 PC', role: 'write', state: 'active', current: false }, { id: 'b'.repeat(12), name: '새 데스크톱', role: 'read', state: 'active', current: true }];
  assert.equal(writerName({ account: { writer: null } }, devices), '사무실 PC');
  assert.equal(writerName({ account: { writer: null } }, []), null);
  assert.deepEqual(deviceLine({ name: '옛 노트북', role: 'write', state: 'lost', lastSeenAt: Date.parse('2026-11-12T10:00:00+09:00') }, NOW), { name: '옛 노트북', role: '분실 신고함', seen: '마지막 연결 어제 오전 10:00', earlier: false });
  assert.equal(deviceLine({ name: '새 데스크톱', role: 'read', state: 'active', current: true }, NOW).name, '새 데스크톱(이 PC)');
  // 쓰는 자리가 다른 PC로 간 옛 PC(엔진 movedTo, def8dde6d) — 「이 PC로 다시 백업」은 takeWriteSeat
  const moved = homeModel(STATES['home-moved'], { now: NOW });
  assert.equal(moved.id, 'home-moved');
  assert.equal(moved.actions.find((a) => a.id === 'reclaim').call, 'takeWriteSeat');
});

test('개통: 첫 시작 · 보호 범위 · 다른 PC가 쓰는 계정 · 되돌리기 미리 보기를 실제 상태로 그린다', async () => {
  const { renderScreen } = await load('screen-view.js');
  const { homeModel } = await load('screen-model.js');
  const { STATES, NOW } = await load('engine-fixtures.js');
  const draw = (id, state, extra = {}) => renderScreen(id, { state, model: homeModel(state, { now: NOW }), now: NOW, fake: true, ...extra });
  const s1 = draw('start-1', STATES['start-signin']);
  assert.equal(s1.acts.google.call, 'signInGoogle');
  assert.match(draw('start-1', STATES['start-signin'], { acct: { signing: true } }).html, /브라우저에서 계속해 주세요[\s\S]*5분/);
  const full = draw('start-1', STATES['start-signin'], { acct: { limit: [{ id: 'a'.repeat(12), name: '옛 노트북', role: 'write', state: 'active' }] } }).html;
  assert.match(full, /기기가 다 찼습니다/);
  assert.match(full, /옛 노트북/);
  // 백업하는 기기만 있으면 끊는 단추가 없다(되살리기만 하는 기기의 끊기는 아래 「기기가 다 찼을 때」 시험, 화면 요청 9)
  assert.doesNotMatch(full, /data-act="limit-revoke/);
  // 보호 범위: 고른 폴더가 없으면 보호 시작을 막는다 · 예시 값(진단 · 예상 크기)을 그리지 않는다
  const empty = draw('start-2', STATES['start-write']);
  assert.match(empty.html, /지킬 폴더를 고르세요/);
  assert.match(empty.html, /data-act="protect" aria-disabled="true"/);
  assert.equal(empty.acts.protect.call, 'startProtection');
  assert.equal(empty.acts.pick.call, 'chooseSources');
  assert.doesNotMatch(empty.html, /찾아낸 작업 폴더 ·|OneDrive에만 있는 파일/);
  const picked = draw('start-2', STATES['start-write-picked']);
  assert.doesNotMatch(picked.html, /data-act="protect" aria-disabled/);
  assert.match(picked.html, /Pictures/);
  // 분실 신고 뒤: Google 걸음을 확인해야 단추가 열린다
  assert.match(draw('start-2', STATES['start-google-step']).html, /data-act="protect" aria-disabled="true"/);
  assert.doesNotMatch(draw('start-2', STATES['start-google-step'], { acct: { googleAck: true } }).html, /data-act="protect" aria-disabled/);
  // 저장소가 이미 있음 → 이어서 백업
  const again = draw('start-2', STATES['start-write-picked'], { acct: { repoExists: true } });
  assert.match(again.html, /이미 백업이 있습니다/);
  assert.equal(again.acts.continue.call, 'continueBackup');
  // 다른 PC가 쓰는 계정: 옮겨 오기는 계정의 백업을 연 뒤 연다(d32d25233 뒤 · Fable 옮겨 오기 검토 F1)
  const read = draw('start-2', STATES['start-read']);
  assert.match(read.html, /「작업 노트북」이 하고 있습니다/);
  assert.equal(read.acts.move.flow, 'moveOpen', '옮겨 오기는 계정의 백업을 연 뒤 연다');
  assert.equal(read.acts.take.id, 'take', '이 PC에서 이어서 백업은 c725f319c 뒤에 잇는다');
  // 상태에 계정이 없는 예시 화면은 지금의 예시 그대로
  assert.match(draw('start-2', STATES.start).html, /찾아낸 작업 폴더/);
  // 되돌리기 미리 보기 — 서버 답(suggestions · plan)으로 그리고, 실행은 아직 잇지 않는다(Fable 지적 4 · 5)
  const at = Date.parse('2026-11-12T14:59:00+09:00');
  const value = { suggestions: [{ at, reason: 'before-mass-hide' }, { at: at - 86400000, reason: 'before-overwrite' }], plan: { at, counts: { copy: 3412, hide: 120, unchanged: 9000 }, copyBytes: 5 * 1024 ** 3 }, oldestAt: NOW - 29 * 86400000 };
  const plans = { [at]: value.plan };
  const u1 = draw('undo-1', STATES.home, { undo: { value, plans, pickAt: at } });
  assert.match(u1.html, /11월 12일 오후 2:59/);
  assert.match(u1.html, /한꺼번에 지워지기 직전/);
  assert.match(u1.html, /aria-checked="true" data-act="undo-pick"/);
  assert.doesNotMatch(u1.html, /class="bars"/, '서버가 주지 않는 시간 막대를 그리지 않는다');
  assert.match(draw('undo-1', STATES.home, { undo: { value: { suggestions: [], plan: null, oldestAt: 0 }, plans: {} } }).html, /찾지 못했습니다/);
  const u2 = draw('undo-2', STATES.home, { undo: { value, plans, pickAt: at } });
  assert.match(u2.html, /3,412개/);
  assert.match(u2.html, /5GB/);
  assert.equal(u2.acts.run.call, 'restoreRun', '되돌리기 실행은 c725f319c 뒤에 잇는다');
  assert.equal(u2.acts.run.arg, at);
  assert.equal(u2.acts.run.google, true);
  // 예시 화면(창이 아무것도 묻지 않은 예시 모드)은 지금의 예시 그대로
  assert.match(draw('undo-1', STATES.home).html, /class="bars"/);
  // 카본 A4 — 받침 있는 숫자로 끝나는 시각 뒤 조사
  const at3 = Date.parse('2026-11-12T15:00:00+09:00');
  assert.match(draw('undo-2', STATES.home, { undo: { value: { ...value, plan: { ...value.plan, at: at3 } }, plans: { [at3]: { ...value.plan, at: at3 } }, pickAt: at3 } }).html, /오후 3:00으로/);
  // 카본 B1 — 기기가 다 찼을 때 한도에 들지 않는 끊긴 기기는 보이지 않는다
  const fullHtml = draw('start-1', STATES['start-signin'], { acct: { limit: [{ id: 'a'.repeat(12), name: '작업 노트북', role: 'write', state: 'active' }, { id: 'b'.repeat(12), name: '옛 데스크톱', role: 'read', state: 'revoked' }] } }).html;
  assert.match(fullHtml, /작업 노트북/);
  assert.doesNotMatch(fullHtml, /옛 데스크톱/);
  // 카본 A2 — 기기 목록을 읽지 못하면 「없다」고 말하지 않는다
  const failed = draw('start-2', STATES['start-read'], { acct: { devices: null, devicesError: '서버에 닿지 못했습니다.' } }).html;
  assert.match(failed, /읽지 못했습니다/);
  assert.doesNotMatch(failed, /비어 있습니다/);
  const { drawer } = await load('screen-view.js');
  assert.match(drawer(STATES['home-lost-step'], { devices: null, devicesError: 'x' }), /다른 기기를 읽지 못했습니다/);
  assert.doesNotMatch(drawer(STATES['home-lost-step'], { devices: null, devicesError: 'x' }), /다른 기기는 없습니다/);
  // Fable F2 — 다른 PC가 쓰는 계정 화면에서 못 읽은 기기 목록은 다시 읽을 수 있다
  assert.match(failed, /data-act="devices-reload"/);
  // Fable F3 — 실제 상태의 첫 화면은 폴더를 고르는 흐름대로 말한다(예시 화면은 시안 글 그대로)
  assert.match(draw('start-1', STATES['start-signin']).html, /지킬 폴더를 고르면/);
  assert.match(draw('start-1', STATES.start).html, /찾아낸 작업 폴더를 암호화해/);
  // Fable F1 — 계정 PC의 보호 시작이 복구 정보 걸음에서 멈추면 옛 연결이 아니라 startProtection으로 잇는다
  const stuck = { ...STATES['start-write-picked'], configured: true, lastBackup: null, recoverySaved: false, protection: { level: 'attention', reason: 'recovery', nextAction: 'recovery' } };
  const rm = homeModel(stuck, { now: NOW });
  assert.equal(rm.id, 'home-recovery');
  assert.equal(rm.actions[0].call, 'startProtection');
  assert.equal(rm.actions[0].label, '이어서 보호 시작');
  const rmStep = homeModel({ ...stuck, account: { ...stuck.account, googleStepRequired: true } }, { now: NOW });
  assert.equal(rmStep.googleStep, true, 'Google 걸음 확인 단추가 함께 온다');
  assert.equal(homeModel({ ...STATES.home, protection: { level: 'attention', reason: 'recovery' } }, { now: NOW }).actions[0].call, 'connectRecovery', '계정에 잇지 않은 PC는 옛 길 그대로');
  // Fable F4 — 복구 전용 연결(sources 빔)에 「지키는 폴더 0곳」을 쓰지 않는다
  assert.doesNotMatch(draw('home', STATES['home-continue']).html, /0곳/);
  // Fable FA3 — sources는 비었어도 마지막 판이 담은 폴더가 있으면 그 수로 센다
  const restoreOnly = { ...STATES.home, mode: 'restore', sources: [], protection: { level: 'restoreOnly', reason: 'restoreOnly' } };
  assert.match(draw('home', restoreOnly).html, /지키는 폴더<\/span><span class="v">네 곳/);
  // Fable FA2 — 도는 중인 단추는 창 상태(acct.running)로 막혀 다시 그려도 막힌 채 나온다
  assert.match(draw('home', STATES['home-writekey'], { acct: { running: 'writekey' } }).html, /data-act="writekey" aria-disabled="true"/);
  assert.doesNotMatch(draw('home', STATES['home-writekey']).html, /data-act="writekey" aria-disabled/);
  // Fable -c FA1 — rotateReadKey는 받아 둔 열쇠가 없을 때만 브라우저를 연다: 두 경우에 다 맞는 안내(maybe)
  assert.equal(homeModel(STATES['home-lost-step'], { now: NOW }).actions[0].google, 'maybe');
  assert.equal(homeModel(STATES['home-writekey'], { now: NOW }).actions[0].google, true);
  // Fable -c FA2 — 보호 범위 화면도 도는 중인 단추를 막는다
  const busy = draw('start-2', STATES['start-write-picked'], { acct: { running: 'pick' } }).html;
  assert.match(busy, /data-act="protect" aria-disabled="true"/);
  assert.match(busy, /data-act="pick" aria-disabled="true"/);
});

test('개통: 호출 응답의 details와 상태를 품은 답, 오류 부호 글', async () => {
  const { createStore, failureText } = await load('state-store.js');
  const devices = [{ id: 'a'.repeat(12), name: '옛 노트북' }];
  const api = { getState: async () => ({ ok: true, value: { version: '0.7.0' } }),
    signInGoogle: async () => ({ ok: false, error: '…', code: 'LIMIT_DEVICES', details: { devices } }),
    takeWriteSeat: async () => ({ ok: true, value: { previous: '옛 노트북', state: { version: '0.7.0', configured: true } } }) };
  const store = createStore(api);
  assert.deepEqual(await store.call('signInGoogle', {}), { ok: false, code: 'LIMIT_DEVICES', details: { devices } });
  const r = await store.call('takeWriteSeat', {});
  assert.equal(r.ok, true);
  assert.equal(store.state?.configured, true, '{ state }를 품은 답의 상태를 받아 들인다');
  for (const code of ['NO_GOOGLE', 'NOT_WRITER', 'REPO_EXISTS', 'GOOGLE_STEP', 'LIMIT_DEVICES', 'RESTORE_PENDING', 'NOT_INVITED', 'SUB_MISMATCH', 'DEVICE_GONE', 'RATE', 'TOO_OLD', 'SERVER', 'NETWORK']) {
    assert.notEqual(failureText(code), failureText('UNKNOWN_CODE'), code);
  }
});

// 둘째 증분(조율 세션 c725f319c — 덧붙임 2의 7 · 8 · 10 · 11 · 12 · 13)
test('개통 둘째: 되돌리기 진행 · 고르기 · 실패 · 취소 중, 분실 신고, 이어서 백업, Google 로그인 그만두기', async () => {
  const { renderScreen, drawer } = await load('screen-view.js');
  const { homeModel } = await load('screen-model.js');
  const { STATES, NOW } = await load('engine-fixtures.js');
  const draw = (id, state, extra = {}) => renderScreen(id, { state, model: homeModel(state, { now: NOW }), now: NOW, fake: true, ...extra });
  // 기본 화면의 되돌리기 멈춤 갈래
  assert.equal(homeModel(STATES['home-restore-run'], { now: NOW }).title, '백업을 되돌리는 중입니다.');
  // 엔진은 실패 때 멈춤을 푼다(hold:false) — 기본 화면은 그대로 돌고, 다시 할 수 있는 끊김은 한 줄로 알린다(Fable 둘째 F4)
  const fm = homeModel(STATES['home-restore-failed'], { now: NOW });
  assert.match(fm.restored.text, /중간에 끊겼습니다/);
  assert.equal(fm.restored.act.to, 'undo-3');
  // 멈춤이 남은 실패는 기본 화면의 갈래로
  assert.equal(homeModel({ ...STATES['home-restore-failed'], account: { ...STATES['home-restore-failed'].account, restore: { ...STATES['home-restore-failed'].account.restore, hold: true } } }, { now: NOW }).title, '되돌리기가 중간에 멈췄습니다.');
  assert.equal(homeModel(STATES['home-restore-undo'], { now: NOW }).title, '되돌리기를 취소하는 중입니다.');
  // undo-3: 고르기 — 계속 · 취소는 작업 번호와 함께, 취소는 Google 확인
  const choose = draw('undo-3', STATES['home-restore-choose']);
  assert.match(choose.html, /11월 12일 오후 2:59로/);
  assert.deepEqual(choose.acts.go.args, ['job-1', 'continue']);
  assert.deepEqual(choose.acts.cancel.args, ['job-1', 'undo']);
  assert.equal(choose.acts.cancel.google, true);
  assert.doesNotMatch(choose.html, /복구 코드/, '아직 없는 복구 코드를 약속하지 않는다');
  // 다른 기기가 요청한 되돌리기는 이 PC에서 고르지 않는다
  const other = draw('undo-3', { ...STATES['home-restore-choose'], account: { ...STATES['home-restore-choose'].account, restore: { ...STATES['home-restore-choose'].account.restore, byThisDevice: false } } });
  assert.match(other.html, /다른 기기가/);
  assert.equal(other.acts.go, undefined);
  // 실패: 끊긴 것(INTERRUPTED)은 같은 시각으로 다시
  const failed = draw('undo-3', STATES['home-restore-failed']);
  assert.equal(failed.acts.retry.call, 'restoreRun');
  assert.equal(failed.acts.retry.arg, Date.parse('2026-11-12T14:59:00+09:00'));
  const failedOther = draw('undo-3', { ...STATES['home-restore-failed'], account: { ...STATES['home-restore-failed'].account, restore: { ...STATES['home-restore-failed'].account.restore, error: 'KEYS' } } });
  assert.doesNotMatch(failedOther.html, /data-act="retry"/);
  assert.match(failedOther.html, /SYNK에 연락/);
  // 진행 중 · 취소 중에는 고르는 단추가 없다
  assert.doesNotMatch(draw('undo-3', STATES['home-restore-run']).html, /data-act="go"/);
  assert.match(draw('undo-3', STATES['home-restore-undo']).html, /취소하는 중입니다/);
  // 예시 화면(계정 칸 없음)은 지금의 예시 그대로
  assert.match(draw('undo-3', STATES.home).html, /새 복구 코드 만들기/);
  // 분실 신고: 서랍의 다른 active 기기 줄마다 단추, 끊긴 기기에는 없다
  const devices = [{ id: 'a'.repeat(12), name: '작업 노트북', role: 'write', state: 'active', current: true }, { id: 'b'.repeat(12), name: '옛 데스크톱', role: 'read', state: 'revoked' }, { id: 'd'.repeat(12), name: '거실 PC', role: 'read', state: 'active' }];
  const dr = drawer(STATES['home-lost-step'], { devices, now: NOW });
  assert.match(dr, /data-act="lost-dev" data-device="dddddddddddd"/);
  assert.doesNotMatch(dr, /data-device="bbbbbbbbbbbb"/);
  assert.doesNotMatch(dr, /data-device="aaaaaaaaaaaa"/, '이 PC는 분실 신고하지 않는다');
  const l1 = draw('lost', STATES['home-lost-step'], { acct: { lostTarget: { id: 'd'.repeat(12), name: '거실 PC' } } });
  assert.match(l1.html, /「거실 PC」를/);
  assert.equal(l1.acts.next.call, 'reportLost');
  assert.equal(l1.acts.next.arg, 'd'.repeat(12));
  const l2 = draw('lost-2', STATES['home-lost-step'], { acct: { lost: { name: '거실 PC', at: NOW - 300000, url: 'https://myaccount.google.com/connections' } } });
  assert.match(l2.html, /myaccount\.google\.com\/device-activity/);
  assert.equal(l2.acts.next.call, 'rotateReadKey');
  assert.deepEqual(l2.acts.next.arg, { googleStepDone: true });
  // 다른 PC가 쓰는 계정의 「이 PC에서 이어서 백업」 — 폴더를 고르기 전에는 막힌다
  const take = draw('start-2', STATES['start-read'], { acct: { take: true } });
  assert.match(take.html, /data-act="take-go" aria-disabled="true"/);
  assert.equal(take.acts['take-go'].flow, 'takeOver');
  const takeReady = draw('start-2', { ...STATES['start-read'], selection: { sources: ['D:\\Projects'], target: null } }, { acct: { take: true } });
  assert.doesNotMatch(takeReady.html, /data-act="take-go" aria-disabled/);
  assert.match(takeReady.html, /「작업 노트북」은 그때부터 백업하지 않습니다/);
  // 기본 화면(복구 전용 · 읽기 역할)도 같은 차례로 잇는다
  assert.equal(homeModel(STATES['home-restore-read'], { now: NOW }).actions[2].flow, 'takeOver');
  // Google 로그인 그만두기 — 기다리는 동안만
  assert.match(draw('start-1', STATES['start-signin'], { acct: { signing: true } }).html, /data-act="google-cancel"/);
  assert.doesNotMatch(draw('start-1', STATES['start-signin']).html, /data-act="google-cancel"/);
  assert.match(draw('home', STATES['home-writekey'], { acct: { running: 'writekey', googleWait: true } }).html, /data-act="google-cancel"/);
});

test('개통 둘째: 창의 호출 줄을 잡지 않는 cancelGoogle, READ_KEY 글', async () => {
  const { createStore, failureText } = await load('state-store.js');
  let release;
  const api = { getState: async () => ({ ok: true, value: { version: '0.7.0' } }),
    signInGoogle: () => new Promise((r) => { release = r; }),
    cancelGoogle: async () => { release({ ok: false, error: 'Google 로그인을 그만두었습니다.', code: 'CANCELED' }); return { ok: true, value: null }; } };
  const store = createStore(api);
  const waiting = store.call('signInGoogle', {});
  assert.equal(store.busy, 'signInGoogle');
  assert.deepEqual(await store.aside('cancelGoogle'), { ok: true, value: null }, '기다리는 호출이 있어도 BUSY로 튕기지 않는다');
  assert.deepEqual(await waiting, { ok: false, code: 'CANCELED' });
  assert.match(failureText('READ_KEY'), /권한을 새로 받아야/);
});

test('개통 둘째: 카본 지적 자리(workbackup-ui-acct2-20261116)', async () => {
  const { renderScreen, drawer } = await load('screen-view.js');
  const { homeModel } = await load('screen-model.js');
  const { failureText } = await load('state-store.js');
  const { STATES, NOW } = await load('engine-fixtures.js');
  const draw = (id, state, extra = {}) => renderScreen(id, { state, model: homeModel(state, { now: NOW }), now: NOW, fake: true, ...extra });
  // A1 — 분실 신고 뒤의 복구 전용 · 읽기 PC도 「복구 정보 다시 맡기기」가 먼저 온다
  const lostRead = { ...STATES['home-restore-read'], account: { ...STATES['home-restore-read'].account, googleStepRequired: true } };
  assert.equal(homeModel(lostRead, { now: NOW }).id, 'home-readkey');
  assert.equal(homeModel(lostRead, { now: NOW }).actions[0].call, 'rotateReadKey');
  // A2 — 읽기 역할 복구 전용 화면도 폴더를 다시 고른다
  assert.ok(homeModel(STATES['home-restore-read'], { now: NOW }).actions.some((a) => a.id === 'pick' && a.call === 'chooseSources'));
  // A4 — 되돌리기 고르기 화면이 열렸으니 「다음 업데이트」라 하지 않는다
  assert.doesNotMatch(failureText('RESTORE_PENDING'), /다음 업데이트/);
  // A5 — 다른 기기가 요청한 되돌리기는 이 PC에서 고른다고 하지 않는다
  const otherRun = { ...STATES['home-restore-run'], account: { ...STATES['home-restore-run'].account, restore: { ...STATES['home-restore-run'].account.restore, byThisDevice: false } } };
  assert.match(draw('undo-3', otherRun).html, /고르기는 그 기기에서/);
  assert.doesNotMatch(homeModel(otherRun, { now: NOW }).sub, /이 창에서 고를 수 있습니다/);
  // A6 — 취소 작업의 실패에 되돌리기를 다시 걸지 않는다
  const undoFailed = { ...STATES['home-restore-failed'], account: { ...STATES['home-restore-failed'].account, restore: { ...STATES['home-restore-failed'].account.restore, undo: true } } };
  assert.doesNotMatch(draw('undo-3', undoFailed).html, /data-act="retry"/);
  assert.match(draw('undo-3', undoFailed).html, /되돌리기 취소가/);
  assert.equal(homeModel({ ...undoFailed, account: { ...undoFailed.account, restore: { ...undoFailed.account.restore, hold: true } } }, { now: NOW }).title, '되돌리기 취소가 중간에 멈췄습니다.');
  assert.equal(homeModel(undoFailed, { now: NOW }).restored, undefined, '취소 작업의 끊김에는 되돌리기를 다시 권하지 않는다');
  // A7 — 작업이 없으면 확인서를 그리지 않는다
  const none = draw('undo-3', { ...STATES.home, account: { ...STATES['home-writekey'].account, needs: [], restore: null } });
  assert.doesNotMatch(none.html, /요청한 곳/);
  // A8 · B2 · B7 — 서랍
  const plain = drawer(STATES.home);
  assert.doesNotMatch(plain, /data-act="lost"/, '계정에 잇지 않은 PC에는 준비 중 단추를 두지 않는다');
  assert.doesNotMatch(plain, /다음 업데이트에서 엽니다\)/);
  assert.doesNotMatch(drawer(STATES['home-lost-step'], { devices: [], now: NOW }), /미리 보기까지/);
  assert.doesNotMatch(drawer(STATES['home-lost-step'], { devices: [], now: NOW }), /aria-label="사고가 났을 때 되돌리기 되돌리기"/);
  // B1 · A3 — 1번은 기기 관리 주소, 2번은 서버가 준 연결된 앱 주소
  const l2 = draw('lost-2', STATES['home-lost-step'], { acct: { lost: { name: '거실 PC', at: NOW, url: 'https://myaccount.google.com/connections' } } }).html;
  assert.match(l2, /device-activity[\s\S]*connections/);
  // B3 — 다른 PC가 쓰는 계정 화면에 설정과 「파일만 되살리기」
  const read = draw('start-2', STATES['start-read']);
  assert.equal(read.acts.open.flow, 'openRead', '파일만 되살리기 — 분실 뒤에는 새 출입증부터(Fable 둘째 F2)');
  assert.match(draw('start-2', { ...STATES['start-read'], account: { ...STATES['start-read'].account, googleStepRequired: true } }).html, /data-act="open" aria-disabled="true"/);
  assert.match(draw('start-2', { ...STATES['start-read'], account: { ...STATES['start-read'].account, googleStepRequired: true } }).html, /data-act="google-ack"/);
  assert.ok(read.top.some((t) => t.id === 'drawer'));
  // B4 — Google 걸음 상자는 두 걸음을 다 말한다
  assert.match(homeModel(STATES['home-lost-step'], { now: NOW }).box.text, /로그아웃[\s\S]*접근을 지운/);
  // B5 · B6 — 같은 단추 이름, 갈래에 맞는 확인서
  const choose = draw('undo-3', STATES['home-restore-choose']).html;
  assert.doesNotMatch(choose, /파일 꺼내기/);
  assert.match(draw('undo-3', STATES['home-restore-undo']).html, /취소가 끝날 때까지 멈춤/);
  assert.match(draw('undo-3', STATES['home-restore-run']).html, /되돌릴 시각/);
});

test('개통 둘째: Fable 지적 자리(workbackup-ui-acct2-20261116)', async () => {
  const { renderScreen, drawer } = await load('screen-view.js');
  const { homeModel } = await load('screen-model.js');
  const { STATES, NOW } = await load('engine-fixtures.js');
  const draw = (id, state, extra = {}) => renderScreen(id, { state, model: homeModel(state, { now: NOW }), now: NOW, fake: true, ...extra });
  const withRestore = (base, v) => ({ ...base, account: { ...base.account, restore: { ...base.account.restore, ...v } } });
  // F1 — 복구 전용 PC의 서랍은 되돌리기를 연다고 하지 않는다
  // 되돌리기 셋(57c3d17e6) 뒤로 복구 전용 PC의 서랍도 되돌리기를 연다
  assert.doesNotMatch(drawer(STATES['home-restore-read'], { devices: [], now: NOW }), /되돌립니다 · 다음 업데이트에서 엽니다/);
  assert.doesNotMatch(draw('start-2', STATES['start-read']).html, /사고를 되돌릴 때/);
  // F3 — 복구 전용 PC의 복구 정보 갈래는 백업이 돈다고 하지 않는다
  const lostRead = { ...STATES['home-restore-read'], account: { ...STATES['home-restore-read'].account, googleStepRequired: true } };
  assert.doesNotMatch(homeModel(lostRead, { now: NOW }).sub, /매시간 돕니다/);
  // F5 — 취소 작업이 실패해 원래 작업이 undo 표시로 돌아와도 고르기를 보인다
  const chooseUndo = withRestore(STATES['home-restore-choose'], { undo: true });
  assert.equal(draw('undo-3', chooseUndo).acts.go.call, 'restoreChoose');
  assert.equal(homeModel(chooseUndo, { now: NOW }).title, '되돌린 백업을 확인할 차례입니다.');
  // F6 — 답을 잃은 되돌리기(번호 · 상태 없음)는 「답을 받지 못했습니다」
  const lostAnswer = { ...STATES.home, account: { ...STATES['home-writekey'].account, needs: ['restore'], restore: { hold: true, jobId: null, state: null, awaitingChoice: false, at: null, byThisDevice: true, error: null, undo: false } } };
  assert.equal(homeModel(lostAnswer, { now: NOW }).id, 'home-restore-wait');
  // F7 — 창이 지켜본 작업이 끝나 상태에서 빠지면 끝났다고 알린다
  const ended = draw('undo-3', { ...STATES.home, account: { ...STATES['home-writekey'].account, needs: [], restore: null } }, { acct: { restoreEnded: { undo: true } } });
  assert.match(ended.html, /되돌리기 취소를[\s\S]*마쳤습니다/);
});

test('개통 둘째: Fable 다시 검수 지적 자리(workbackup-ui-acct2-20261116b)', async () => {
  const { renderScreen } = await load('screen-view.js');
  const { homeModel } = await load('screen-model.js');
  const { STATES, NOW } = await load('engine-fixtures.js');
  const draw = (id, state, extra = {}) => renderScreen(id, { state, model: homeModel(state, { now: NOW }), now: NOW, fake: true, ...extra });
  const withRestore = (base, v) => ({ ...base, account: { ...base.account, restore: { ...base.account.restore, ...v } } });
  // FA1 — 분실 뒤 「파일만 되살리기」는 브라우저를 열 수 있어 안내 표시를 단다
  const stepRead = { ...STATES['start-read'], account: { ...STATES['start-read'].account, googleStepRequired: true } };
  assert.equal(draw('start-2', stepRead).acts.open.google, 'maybe');
  assert.equal(draw('start-2', STATES['start-read']).acts.open.google, undefined);
  // FA2 — 취소가 실패해 고르기로 돌아온 작업의 확인서는 「고를 때까지 멈춤」
  const html = draw('undo-3', withRestore(STATES['home-restore-choose'], { undo: true })).html;
  assert.match(html, /고를 때까지 멈춤/);
  assert.doesNotMatch(html, /취소가 끝날 때까지 멈춤/);
  // FA3 — 확인하러 간 끊긴 되돌리기는 다시 띄우지 않는다
  assert.ok(homeModel(STATES['home-restore-failed'], { now: NOW }).restored);
  assert.equal(homeModel(STATES['home-restore-failed'], { now: NOW, undoSeen: 'job-1' }).restored, undefined);
  // FA4 — 백업이 돌지 않는 갈래에는 「백업은 다시 돕니다」를 붙이지 않는다
  const offFailed = { ...STATES['home-off'], account: STATES['home-restore-failed'].account };
  const om = homeModel(offFailed, { now: NOW });
  assert.match(om.restored.text, /끊겼습니다/);
  assert.doesNotMatch(om.restored.text, /다시 돕니다/);
  assert.doesNotMatch(draw('undo-3', STATES['home-restore-failed']).html, /백업은 다시 돕니다/);
  assert.doesNotMatch(draw('undo-3', offFailed).html, /쉬지 않음/, '자동 백업이 꺼진 PC에 백업이 돈다고 하지 않는다');
  assert.match(draw('undo-3', offFailed).html, /되돌리기로 멈추지 않음/);
});

test('되돌리기 셋(조율 세션 57c3d17e6): 복구 전용 PC의 되돌리기 · 취소 실패 부호 · 끝난 결과', async () => {
  const { homeModel } = await load('screen-model.js');
  const { renderScreen, drawer } = await load('screen-view.js');
  const { STATES, NOW } = await load('engine-fixtures.js');
  const { findBanned } = await load('banned-words.js');
  const draw = (id, state, extra = {}) => renderScreen(id, { state, model: homeModel(state, { now: NOW }), now: NOW, ...extra });
  // 복구 전용 PC의 멈춤은 「되살리기만 합니다」에 가리지 않는다. 고른 뒤에도 백업한다고 하지 않는다
  const ro = homeModel(STATES['home-restore-read-hold'], { now: NOW });
  assert.equal(ro.id, 'home-restore-hold');
  assert.match(ro.sub, /저절로 다시 돌지 않습니다/);
  assert.doesNotMatch(ro.sub, /백업이 다시 돕니다/);
  const roPage = draw('undo-3', STATES['home-restore-read-hold']).html;
  assert.match(roPage, /되돌린 판을 이 계정의 백업으로 둡니다/); assert.match(roPage, /이 PC는 되살리기만 함/);
  assert.match(roPage, /취소가 끝나도 백업은 저절로 다시 돌지 않으니/); assert.doesNotMatch(roPage, /이 계정의 백업이 쉽니다/);
  assert.doesNotMatch(roPage, /이 PC의 지금 파일로 다시 매시간 백업합니다/);
  assert.match(drawer(STATES['home-restore-read'], { devices: [], now: NOW }), /29일 안이면 그 시각으로 되돌립니다<\/span>/);
  // 취소 실패 부호(undoError)는 고를 때까지 보인다
  const uf = homeModel(STATES['home-restore-undofail'], { now: NOW });
  assert.equal(uf.title, '되돌리기 취소를 마치지 못했습니다.'); assert.equal(uf.tone, 'bad');
  assert.doesNotMatch(uf.sub, /빈 공간/, '서버 작업의 실패에 파일 되살리기 글을 붙이지 않는다');
  assert.ok(ro.actions.some((a) => a.id === 'restore'), '복구 전용 PC의 멈춤 화면에도 파일 되살리기'); assert.equal(ro.kick, '새 데스크톱 · 되돌리기를 확인하는 중');
  const ufPage = draw('undo-3', STATES['home-restore-undofail']);
  assert.match(ufPage.html, /되돌리기 취소를 마치지 못했습니다/); assert.equal(ufPage.acts.go.call, 'restoreChoose');
  // 끝난 결과는 기본 화면 한 줄과 「확인」(restoreSeen) — 끝난 쪽 화면의 「돌아가기」도 restoreSeen을 부른다
  const ended = homeModel(STATES['home-restore-ended'], { now: NOW });
  assert.match(ended.restored.text, /오전 11:20에 사고 되돌리기를 마쳤습니다\. 이 PC는 다시 매시간 백업합니다\./);
  assert.deepEqual([ended.restored.act.call, ended.restored.act.arg], ['restoreSeen', 'job-1']);
  const undone = { ...STATES['home-restore-ended'], account: { ...STATES['home-restore-ended'].account, restoreEnded: { jobId: 'job-2', result: 'undone', at: NOW - 60000 } } };
  assert.match(homeModel(undone, { now: NOW }).restored.text, /되돌리기 취소를 마쳤습니다/);
  // 카본 A1(workbackup-ui-leftout) — 담지 못한 이름이 있어도 매시간 도는 PC면 「다시 매시간 백업합니다」를 붙인다
  const endedLeft = homeModel({ ...STATES['home-restore-ended'], leftOutNames: STATES['home-leftout'].leftOutNames }, { now: NOW });
  assert.equal(endedLeft.id, 'home-leftout'); assert.match(endedLeft.restored.text, /사고 되돌리기를 마쳤습니다\. 이 PC는 다시 매시간 백업합니다\./);
  const endPage = draw('undo-3', STATES['home-restore-ended']);
  assert.match(endPage.html, /되돌리기를[\s\S]*마쳤습니다/); assert.deepEqual([endPage.acts.home.call, endPage.acts.home.arg, endPage.acts.home.then], ['restoreSeen', 'job-1', 'home']);
  // 카본 A2 — 되살리기만 하는 PC는 쓰는 자리를 쥐었을 때만 「어느 PC도 백업하지 않습니다」. 다른 PC가 가져갔으면 그 말을 하지 않는다
  const roEnded = { ...STATES['home-restore-read'], account: { ...STATES['home-restore-read'].account, restoreEnded: { jobId: 'job-3', result: 'continued', at: NOW - 60000 } } };
  assert.doesNotMatch(homeModel(roEnded, { now: NOW }).restored.text, /어느 PC도 백업하지 않습니다/);
  const roSeat = { ...roEnded, account: { ...roEnded.account, role: 'write' } };
  assert.match(homeModel(roSeat, { now: NOW }).restored.text, /어느 PC도 백업하지 않습니다\. 이 PC에서 「이어서 백업」을 누르거나, 옛 PC에서 「이 PC로 다시 백업」/);
  // 카본 A3 — 자동 백업이 꺼졌거나 다른 PC가 맡은 PC에 「다시 매시간 백업합니다」라고 하지 않는다. 새 되돌리기가 열리면 앞선 끝 줄은 숨긴다
  const off = { ...STATES['home-restore-ended'], automatic: false, protection: { level: 'off', reason: 'off', nextAction: 'protect' } };
  assert.match(homeModel(off, { now: NOW }).restored.text, /자동 백업이 꺼져 있습니다/);
  assert.match(draw('undo-3', off).html, /돌지 않음/);
  const moved = { ...STATES['home-restore-ended'], movedTo: { device: '새 데스크톱', at: new Date(NOW - 60000).toISOString() } };
  assert.match(homeModel(moved, { now: NOW }).restored.text, /다른 PC가 맡고 있습니다/);
  const again = { ...STATES['home-restore-ended'], account: { ...STATES['home-restore-ended'].account, restore: { hold: true, jobId: 'job-9', state: 'running', awaitingChoice: false, at: NOW - 3600000, byThisDevice: true, error: null, undo: false } } };
  assert.doesNotMatch(homeModel(again, { now: NOW }).restored?.text || '', /마쳤습니다/);
  // 카본 A1 — 다른 기기가 요청한 되돌리기에 「이 PC도 다시 백업합니다」라고 하지 않는다
  const other = { ...STATES['home-restore-choose'], account: { ...STATES['home-restore-choose'].account, restore: { ...STATES['home-restore-choose'].account.restore, byThisDevice: false } } };
  assert.doesNotMatch(homeModel(other, { now: NOW }).sub, /이 PC도 다시 백업합니다/);
  assert.doesNotMatch(draw('undo-3', other).html, /이 PC도 다시 백업합니다/);
  // 카본 B1 — 깨끗한 다른 PC에서 되돌리는 길을 「다음 업데이트」라고 하지 않는다
  assert.doesNotMatch(renderScreen('undo-2', { state: STATES.home, now: NOW, fake: true }).html, /깨끗한 다른 PC에서 되돌리는 길은 다음 업데이트/);
  for (const t of [ro.sub, uf.sub, ended.restored.text]) assert.deepEqual(findBanned(t), []);
});

test('되돌리기 셋: Fable 지적 자리(workbackup-ui-undo3-20261116)', async () => {
  const { homeModel } = await load('screen-model.js');
  const { renderScreen } = await load('screen-view.js');
  const { STATES, NOW } = await load('engine-fixtures.js');
  const draw = (id, state, extra = {}) => renderScreen(id, { state, model: homeModel(state, { now: NOW }), now: NOW, ...extra });
  const PICK = Date.parse('2026-11-12T14:59:00+09:00');
  const undo = { value: { suggestions: [{ at: PICK, reason: 'before-mass-hide' }], plan: { at: PICK, counts: { copy: 1, hide: 1, unchanged: 1 }, copyBytes: 10 }, oldestAt: 0 }, plans: {}, pickAt: PICK };
  // F1 — 되살리기만 하는 PC의 미리 보기는 옛 PC의 백업이 멈추고 백업이 저절로 돌지 않는다고 누르기 전에 말한다
  const roU2 = draw('undo-2', STATES['home-restore-read'], { undo }).html;
  assert.match(roU2, /옛 PC는 백업을 쉽니다/); assert.match(roU2, /저절로 다시 돌지 않습니다/); assert.doesNotMatch(roU2, /하나를 고르면 다시 돕니다/);
  assert.match(draw('undo-2', STATES.home, { undo }).html, /하나를 고르면 다시 돕니다/);
  // F2 · F5 — 되살리기만 하는 PC의 취소 진행 중
  const roUndoing = { ...STATES['home-restore-read-hold'], account: { ...STATES['home-restore-read-hold'].account, restore: { ...STATES['home-restore-read-hold'].account.restore, state: 'running', awaitingChoice: false, undo: true } } };
  assert.match(draw('undo-3', roUndoing).html, /끝나도 백업은 저절로 다시 돌지 않습니다/); assert.doesNotMatch(draw('undo-3', roUndoing).html, /끝날 때까지 백업을 쉽니다/);
  assert.match(homeModel(roUndoing, { now: NOW }).sub, /취소가 끝나면 되돌리기 전으로 돌아갑니다[\s\S]*저절로 다시 돌지 않습니다/);
  assert.match(homeModel(STATES['home-restore-undo'], { now: NOW }).sub, /^취소가 끝나면 되돌리기 전으로 돌아갑니다/);
  // F4 — 지금 도는 갈래가 아니면 「다시 매시간 백업합니다」를 붙이지 않는다
  for (const k of ['home-startup', 'home-credential', 'home-paused']) {
    const st = { ...STATES[k], account: STATES['home-restore-ended'].account };
    assert.doesNotMatch(homeModel(st, { now: NOW }).restored?.text || '', /다시 매시간 백업합니다/, k);
  }
  // F6 — 창 기억만 있는 끝은 결과를 단정하지 않는다. restore 칸에 남은 끝도 이 PC의 상태로 말하고 restoreSeen을 부른다
  const memo = draw('undo-3', { ...STATES.home, account: { ...STATES['home-writekey'].account, needs: [], restore: null } }, { acct: { restoreEnded: { undo: false } } }).html;
  assert.match(memo, /되돌리기가[\s\S]*끝났습니다/); assert.doesNotMatch(memo, /되돌린 판에서 이어 갑니다/);
  const leftover = { ...STATES['home-restore-read-hold'], account: { ...STATES['home-restore-read-hold'].account, restore: { ...STATES['home-restore-read-hold'].account.restore, hold: false, awaitingChoice: false, state: 'continued' } } };
  const lo = draw('undo-3', leftover);
  assert.doesNotMatch(lo.html, /다시 매시간 백업합니다/); assert.equal(lo.acts.home.call, 'restoreSeen');
});

test('옮겨 오기: 놓일 자리 · 까닭 · 확인서 · 넘길 폴더(조율 세션 d32d25233 · moveState · roots)', async () => {
  const m = await load('screen-model.js');
  const { MOVE_MV } = await load('engine-fixtures.js');
  const P = MOVE_MV.plan.preview.folders;
  // 갈래는 why가 아니라 실제 자리로(Fable F3) — 다른 드라이브 폴더의 기본은 「옮겨 온 자료」 아래, 같은 드라이브를 고르면 옛 경로
  assert.equal(m.movePlace(P[0]).kind, 'same');
  assert.equal(m.movePlace(P[3]).kind, 'moved');
  assert.deepEqual(m.movePlace(P[3], { mode: 'original', sameDrive: true }), { kind: 'sameDrive', path: 'D:\\Projects', drive: 'D' });
  assert.equal(m.movePlace({ original: 'C:\\x', mode: 'original', destination: 'C:\\Users\\a\\옮겨 온 자료\\따로 둔 것\\x' }).kind, 'side');
  assert.equal(m.movePlace(P[1]).kind, 'newFolder');
  assert.equal(m.movePlace(P[0], { mode: 'skip' }).kind, 'skip');
  assert.deepEqual(m.moveModes(P[3]).map((x) => x.id), ['original', 'sameDrive', 'newFolder', 'skip']);
  assert.equal(m.moveModes(P[3])[0].label, '「옮겨 온 자료」 아래');
  // 동기화 폴더는 OneDrive만이 아니다(F13) · 동기화 폴더 안을 직접 고르면 공간 경고
  assert.match(m.moveWhy(P[1], { mode: 'newFolder' }), /OneDrive 안이라, OneDrive 밖 새 폴더/); // E3 newSync
  assert.match(m.moveWhy({ ...P[1], newSync: undefined }, { mode: 'newFolder' }), /동기화 폴더 밖 새 폴더/);
  assert.match(m.moveWhy(P[1], { mode: 'original' }), /동기화가 멈출 수 있습니다/);
  assert.match(m.moveWhy({ ...P[0], why: 'old-synced', mode: 'newFolder' }, {}), /온라인에만 있던 파일은 백업에 없으니/);
  assert.doesNotMatch(m.moveWhy({ ...P[0], why: 'new-synced' }, {}), /OneDrive 안이라/);
  // 「옮기지 않음」으로 바꿔도 처음 본 수를 쓰고 합계에서는 뺀다(F12)
  const rows = m.moveRows(MOVE_MV.open.preview, MOVE_MV.open.choices, MOVE_MV.open.first);
  assert.equal(rows.places, 4); assert.equal(rows.files, 5310 + 420 + 1870 + 36);
  assert.equal(rows.rows.find((r) => r.label === '사진').files, 4880);
  assert.equal(m.moveVolumes(MOVE_MV.short.preview).short.length, 1);
  assert.equal(m.moveVolumes({ volumes: [{ volume: 'C:\\', bytes: 1, free: null, enough: null }] }).short.length, 0);
  // 자리 정보 — 없음은 kitAt으로, 앱 쪽 문제만 있으면 말하지 않는다(F14)
  assert.match(m.moveKitNote({ kitAt: null, kitProblems: ['size'] }), /자리 정보가 백업에 없어/);
  assert.match(m.moveKitNote({ kitAt: 'x', kitProblems: ['known:documents'] }), /일부를 읽지 못했습니다/);
  assert.equal(m.moveKitNote({ kitAt: 'x', kitProblems: ['app', 'file:obsidian'] }), null);
  // 옛 기기 — 이어 하기면 저장된 기기, 아니면 지금 백업하는 기기, 없으면 가장 새 판(F6 · F18)
  const devs = [{ from: 'a'.repeat(12), lastBackupAt: '2026-11-13T05:00:00Z' }, { from: 'b'.repeat(12), lastBackupAt: '2026-11-01T05:00:00Z' }];
  const acc = [{ id: 'b'.repeat(12), role: 'write', state: 'active', name: '옛 노트북' }];
  assert.equal(m.moveFrom(devs, { from: 'a'.repeat(12), unfinished: true }, acc), 'a'.repeat(12));
  // 끝났거나 「끊지 않기」를 고른 옮겨 오기의 기기는 기본이 아니다(카본 A5)
  assert.equal(m.moveFrom(devs, { from: 'a'.repeat(12), unfinished: false, resultAt: 'x' }, acc), 'b'.repeat(12));
  assert.equal(m.moveFrom(devs, null, acc), 'b'.repeat(12));
  assert.equal(m.moveFrom(devs, { from: 'gone' }, []), 'a'.repeat(12));
  assert.equal(m.moveDeviceName('b'.repeat(12), acc), '옛 노트북');
  assert.equal(m.moveDeviceName('c'.repeat(12), acc), '이름을 알 수 없는 PC');
  assert.equal(m.moveDeviceName('DESKTOP-OLD1', acc), 'DESKTOP-OLD1');
  // 멈춘 까닭 — 이번 시작 전의 실패는 쓰지 않는다(F5) · 부호 없는 실패는 다시 시작을 권한다(F11)
  const st = { startedAt: '2026-11-13T05:10:00Z' };
  assert.match(m.moveStopText({ lastMoveError: { code: 'ENOSPC', at: '2026-11-13T05:00:00Z' } }, st), /^옛 PC의 백업은 그대로 있습니다/);
  assert.match(m.moveStopText({ lastMoveError: { code: 'ENOSPC', at: '2026-11-13T05:20:00Z' } }, st), /빈 공간/);
  assert.match(m.moveStopText({ lastMoveError: { code: 'MOVE_FAILED', at: '2026-11-13T05:20:00Z' } }, st), /멈춘 곳부터 잇습니다/);
  // 까닭 부호 — Windows 오류 번호가 붙은 호스트 부호도 가른다
  assert.equal(m.moveReason('MOVE_OPEN:5'), 'denied'); assert.equal(m.moveReason('MOVE_RENAME:32'), 'busy');
  assert.equal(m.moveReason('MOVE_SKIP_LINK'), 'link'); assert.equal(m.moveReason('link'), 'link'); assert.equal(m.moveReason('ENOSPC'), 'space');
  assert.equal(m.moveReason('MOVE_NOT_IN_STREAM'), 'stream'); assert.equal(m.moveReason('WHAT'), 'other');
  // 확인서 — 까닭별로 묶고 주의를 앞에(F9) · 「다」와 「모두 같다」는 맞을 때만(F10)
  const res = MOVE_MV.result.result, g = m.moveGroups(res);
  assert.deepEqual(g.list.map((x) => [x.key, x.n, x.tone]), [['fail:busy', 1, 'warn'], ['skip:link', 4, 'info']]);
  assert.equal(g.cut, false);
  assert.ok(m.moveGroups({ items: [{ result: 'onedrive', u: true, p: 'x' }, { result: 'same-unverified', p: 'y' }] }).list.every((x) => x.tone === 'warn'));
  assert.deepEqual([m.moveTitle(res).main, m.moveTitle(res).soft], ['옮겨 왔습니다.', '1개는 옮겨 오지 못했습니다.']);
  assert.equal(m.moveTitle(MOVE_MV.ok.result).main, '다 옮겨 왔습니다.');
  assert.match(m.moveTitle({ counts: { placed: 3, skip: 4 }, complete: false }).soft, /옛 PC 백업에 그대로/);
  assert.equal(m.moveTitle({ counts: { same: 3 }, complete: true }).then, '');
  // 이 PC에 놓거나 확인한 파일이 없으면 「옮겨 왔습니다」라고 하지 않는다(카본 A7)
  assert.equal(m.moveTitle({ counts: { fail: 10 }, complete: false }).main, '옮겨 오지 못했습니다.');
  // 폴더를 만들지 못해 건너뛴 것도 옮겨 오지 못한 것이다 — 큰 글 · 넘기기가 같은 수를 쓴다(Fable 화면 검수 F2)
  const blockedDir = { counts: { placed: 10, skip: 500 }, complete: false, items: Array.from({ length: 500 }, (_, i) => ({ result: 'skip', original: 'C:\\U\\D', name: `f${i}`, c: 'MOVE_MKDIR:5' })) };
  assert.deepEqual([m.moveTitle(blockedDir).soft, m.moveTitle(blockedDir).tone], ['500개는 옮겨 오지 못했습니다.', 'warn']);
  assert.equal(m.moveLeft(blockedDir).n, 500);
  assert.equal(m.moveLeft({ counts: { skip: 4 }, items: [{ result: 'skip', c: 'link' }] }).n, 0);
  // 이 PC에 이미 있어 그대로 둔 파일(견주지 못함)은 「옮겨 오지 못했습니다」로 세지 않는다(Fable 화면 검수 FA1)
  const unv = { counts: { same: 300, 'same-unverified': 5 }, complete: false, items: Array.from({ length: 5 }, () => ({ result: 'same-unverified', p: 'x' })) };
  assert.deepEqual([m.moveTitle(unv).soft, m.moveLeft(unv).failed, m.moveLeft(unv).unverified], ['5개는 내용을 견주지 못했습니다.', 0, 5]);
  assert.equal(m.moveTitle({ counts: { skip: 4 }, complete: false }).main, '옮겨 온 파일이 없습니다.');
  assert.deepEqual(m.moveCounts(res).map((x) => x.key), ['placed', 'same', 'copy', 'side', 'skip', 'fail']);
  // 넘길 폴더 — 실제 뿌리에서 「따로 둔 것」을 빼고, 서로 포함되면 바깥 것만(엔진 validateSources), 더한 폴더도 같은 규칙
  const roots = m.moveRoots({ folders: [{ roots: [{ path: 'C:\\U\\Documents', kind: 'place' }, { path: 'C:\\U\\Documents\\a', kind: 'moved' }, { path: 'C:\\U\\옮겨 온 자료\\따로 둔 것', kind: 'side' }] }, { rootsCut: true, roots: [] }] }, ['c:\\u\\documents\\', 'D:\\Work']);
  assert.deepEqual(roots.list.map((x) => x.path), ['C:\\U\\Documents', 'C:\\U\\Documents\\a', 'D:\\Work']); assert.equal(roots.cut, true);
  // 체크된 바깥 폴더만 안쪽을 가린다 — 바깥을 끄면 안쪽이 다시 보이고 넘길 목록에 든다(카본 A3)
  const nest = { result: { folders: [{ roots: [{ path: 'C:\\U\\Documents', kind: 'place' }] }] }, added: ['C:\\U\\Documents\\Work'] };
  assert.deepEqual(m.moveTakeList({}, nest).checked, ['C:\\U\\Documents']);
  assert.deepEqual(m.moveTakeList({}, { ...nest, off: ['c:\\u\\documents'] }).checked, ['C:\\U\\Documents\\Work']);
  assert.equal(m.moveTakeList({}, { ...nest, off: ['c:\\u\\documents'] }).list.length, 2);
  const take = m.moveTakeList({}, { ...MOVE_MV.result, off: ['c:\\users\\studio\\pictures'] });
  assert.equal(take.list.length, 4); assert.equal(take.checked.length, 3); assert.ok(take.isOff('C:\\Users\\studio\\Pictures'));
  assert.deepEqual(m.moveTakeList({ nextSources: ['C:\\A'] }, { quit: true, result: res, added: ['D:\\B'] }).checked, ['C:\\A', 'D:\\B']);
  // 옛 PC의 새 판 — 마지막 시작 뒤에 판이 있으면 한 번 더 옮겨 오기를 권한다(F15)
  assert.equal(m.moveFresh(MOVE_MV.result.devices, MOVE_MV.result.state, res), null);
  assert.ok(m.moveFresh(MOVE_MV.fresh.devices, MOVE_MV.fresh.state, res));
});

test('옮겨 오기: 기본 화면 갈래와 화면 넷', async () => {
  const { homeModel, moveJob } = await load('screen-model.js');
  const { renderScreen } = await load('screen-view.js');
  const { STATES, NOW, MOVE_MV, MOVE_ACCT } = await load('engine-fixtures.js');
  const home = (state, move) => homeModel(state, { now: NOW, move });
  const read = STATES['home-move-read'];
  // 기본 화면 — 멈춤 → 이어서, 끝났고 「끊지 않기」를 고르지 않음 → 넘기기, 고르면 → 되살리기만 하는 연결(설계 검토 권고 3)
  assert.equal(home(read, MOVE_MV.stopped.state).id, 'home-move-stopped');
  assert.equal(home(read, MOVE_MV.stopped.state).actions[0].flow, 'moveResume');
  assert.equal(home(read, MOVE_MV.result.state).id, 'home-move-done');
  assert.equal(home(read, { ...MOVE_MV.result.state, released: '2026-11-13T05:50:00Z' }).id, 'home-restore-read');
  assert.equal(home(read, null).id, 'home-restore-read');
  assert.ok(home(read, null).actions.some((a) => a.to === 'move-1'));
  // 쓰는 PC가 되면(mode backup) 옮겨 오기 줄을 두지 않는다
  assert.equal(home({ ...STATES.home, account: { ...STATES['home-writekey'].account, needs: [] } }, MOVE_MV.result.state).id, 'home');
  // 도는 옮겨 오기 — 계정 프로필(b2)의 작업만 본다(F5)
  const run = STATES['home-move-run'];
  assert.equal(home(run, MOVE_MV.run.state).id, 'home-run');
  assert.equal(home(run, null).actions[0].to, 'move-2');
  assert.equal(home(run, null).progress.stage, '옮겨 오는 중');
  assert.equal(home(STATES['home-move-reading'], null).progress.stage, '옮겨 올 목록 읽는 중');
  assert.equal(moveJob({ profile: 'local', job: { kind: 'move' }, profiles: { b2: { job: null } } }), null);
  assert.ok(moveJob({ profile: 'local', job: null, profiles: { b2: { job: { kind: 'move' } } } }));
  // 지금 프로필이 로컬이어도 계정 프로필의 옮겨 오기는 기본 화면에서 도는 작업이다(카본 A4)
  assert.equal(home({ ...read, profile: 'local', job: null, profiles: { b2: { job: { kind: 'move', stage: '옮겨 오는 중', percent: 5 } } } }, null).id, 'home-run');
  // 화면 넷 — 예시 기억(mv)이 있으면 엔진 갈래로 그린다
  const draw = (id, state, mv) => renderScreen(id, { state, model: home(state, mv?.state || null), now: NOW, ui: {}, acct: { ...MOVE_ACCT }, mv, fake: true });
  const one = draw('move-1', read, MOVE_MV.plan);
  assert.match(one.html, /「작업 노트북」의 백업을 찾았습니다/); assert.equal(one.acts['move-go'].flow, 'moveGo');
  assert.doesNotMatch(one.html, /약 <b class="num">\d+분/); // 시간 숫자는 짓지 않는다(F16)
  assert.match(draw('move-1', read, MOVE_MV.short).html, /data-act="move-go" aria-disabled="true"/);
  assert.match(draw('move-1', read, MOVE_MV.nokit).html, /앞서 멈춘 옮겨 오기를 잇습니다/);
  assert.doesNotMatch(draw('move-1', read, MOVE_MV.nokit).html, /data-act="move-open"/);
  assert.match(draw('move-1', read, MOVE_MV.open).html, /data-mode="sameDrive"[^>]*>D 드라이브의 같은 자리/);
  assert.match(draw('move-2', run, MOVE_MV.run).html, /aria-valuenow="42"/);
  assert.doesNotMatch(draw('move-2', run, MOVE_MV.run).html, /잠시 멈추기/);
  // 받은 양 · 속도 · 남은 시간은 엔진의 진행(E7)이 있을 때만 쓴다
  assert.match(draw('move-2', run, MOVE_MV.run).html, /7\.7GB \/ 18\.4GB<\/span> · 남은 시간 약 8분 · 초당 24MB[\s\S]*지금 받는 폴더 · 사진/);
  assert.doesNotMatch(draw('move-2', { ...run, move: { reinstall: null, progress: null } }, MOVE_MV.run).html, /남은 시간|초당/);
  assert.match(draw('move-2', read, MOVE_MV.stopped).html, /data-act="move-resume"/);
  // 미리 본 기기가 실제로 옮긴 기기와 다르면 진행 화면은 옮긴 기기로 부르고 미리 본 계획을 쓰지 않는다(카본 B1)
  const other = draw('move-2', read, { ...MOVE_MV.stopped, from: 'OLD-DESKTOP', preview: MOVE_MV.plan.preview, first: MOVE_MV.plan.first });
  assert.match(other.html, /「작업 노트북」에서/); assert.doesNotMatch(other.html, /바탕화면/);
  const three = draw('move-3', read, MOVE_MV.result);
  assert.match(three.html, /1개는 옮겨 오지 못했습니다/); assert.doesNotMatch(three.html, /다 옮겨 왔습니다/);
  assert.equal(three.acts['move-next'].to, 'move-apps'); // 4b — 확인서 다음은 프로그램과 설정
  const four = draw('move-4', read, MOVE_MV.result);
  assert.equal((four.html.match(/data-act="move-root"/g) || []).length, 4);
  assert.doesNotMatch(four.html, /따로 둔 것<\/span><span class="ds">/);
  assert.match(four.html, /옮겨 오지 못한 파일\(1개\)은/);
  assert.doesNotMatch(four.html, /한 번 더 옮겨 오기/);
  assert.match(draw('move-4', read, MOVE_MV.fresh).html, /한 번 더 옮겨 오기/);
  assert.equal(four.acts['move-take'].flow, 'moveTake'); assert.equal(four.acts['move-release'].flow, 'moveRelease');
  assert.match(draw('move-4', STATES['home-move-quit'], MOVE_MV.quit).html, /data-act="home"[^>]*>돌아가기/);
  // 읽기 전(undefined)은 「읽는 중」 — 결과를 읽기 전에 고른 폴더로 넘기기 목록을 채우지 않는다
  assert.match(draw('move-3', read, { state: MOVE_MV.result.state }).html, /확인서를[\s\S]*읽고 있습니다/);
  assert.doesNotMatch(draw('move-4', STATES['home-move-quit'], { state: MOVE_MV.result.state }).html, /data-act="move-take"/);
  assert.match(draw('move-2', read, {}).html, /옮겨 오기 상태를[\s\S]*읽고 있습니다/);
  // 첫 시작의 「이 PC로 옮겨 오기」는 계정의 백업을 연 뒤 연다(F1)
  const s2 = renderScreen('start-2', { state: STATES['start-read'], model: homeModel(STATES['start-read'], { now: NOW }), now: NOW, acct: {}, fake: true });
  assert.equal(s2.acts.move.flow, 'moveOpen'); assert.doesNotMatch(s2.html, /옮겨 오기는 다음 업데이트에서 열립니다/);
});

test('옮겨 오기: 조율 세션 c6ae51da6의 엔진 값(E3 · E4 · E5 · E6 · E7 · E9 · E10 · E13 · E14 · E15)을 잇는다', async () => {
  const m = await load('screen-model.js');
  const { renderScreen } = await load('screen-view.js');
  const { failureText } = await load('state-store.js');
  const { STATES, NOW, MOVE_MV, MOVE_ACCT } = await load('engine-fixtures.js');
  const home = (state, move) => m.homeModel(state, { now: NOW, move });
  const draw = (id, state, mv) => renderScreen(id, { state, model: home(state, mv?.state || null), now: NOW, ui: {}, acct: { ...MOVE_ACCT }, mv, fake: true });
  const read = STATES['home-move-read'], P = MOVE_MV.plan.preview.folders;
  // E3 — 「따로 둔 것」은 엔진의 side로 가르고, 옛 PC의 OneDrive 폴더는 일부만 올 수 있다고 쓴다
  assert.equal(m.movePlace({ original: 'C:\\x', mode: 'original', destination: 'C:\\Users\\a\\x', side: true }).kind, 'side');
  assert.equal(m.movePlace({ original: 'C:\\x', mode: 'original', destination: 'C:\\Users\\a\\옮겨 온 자료\\따로 둔 것\\x', side: false }).kind, 'moved');
  const od = P.find((f) => f.partial);
  assert.match(m.moveWhy(od, {}), /OneDrive 안이던 폴더라 일부만 올 수 있습니다/);
  assert.match(m.moveWhy({ ...od, partial: false, oldSync: 'other' }, {}), /Dropbox나 Google Drive 같은/);
  assert.match(m.moveWhy({ ...od, mode: 'oneDriveGaps' }, { mode: 'oneDriveGaps' }), /같은 OneDrive 계정이라/); // 같은 계정이면 일부 경고보다 먼저
  // E4 · E9 GA1 — 목록 초과(늘 장부 전)로 멈췄으면 자리를 다시 고르게 한다. 공간 부족은 놓기 시작한 뒤 이어 할 때도 나서
  // 엔진이 처음 자리를 지키므로 이어서 한다(카본 A2 — begun을 받으면 그것으로 가른다). 시작 전의 실패는 이번 실패가 아니다
  const ns = STATES['home-move-listbig'], st = MOVE_MV.nospace.state, space = STATES['home-move-nospace'], fresh = MOVE_MV.nospaceFresh.state;
  // 앞선 판이 남긴 목록 초과 실패는 이제 이어서 한다 — 지금 판은 그 폴더만 빼고 옮겨 온다(E25, 앞서는 Fable F1로 되살리기로 보냈다).
  // 그 폴더를 「파일 되살리기」로 꺼낼 수 있다고 권하지 않는다(조율 세션이 확인하지 않았다)
  assert.equal(m.moveRechoose(ns, st), false); assert.equal(m.moveBlocked, undefined);
  assert.equal(home(ns, st).actions[0].flow, 'moveResume'); assert.match(home(ns, st).sub, /그 폴더만 빼고 옮겨 옵니다\. 이어서 옮겨 오면/);
  assert.doesNotMatch(home(ns, st).sub, /파일 되살리기/); assert.doesNotMatch(failureText('MOVE_LIST_TOO_BIG'), /파일 되살리기|옮겨 올 수 없습니다/);
  assert.match(draw('move-2', ns, MOVE_MV.nospace).html, /data-act="move-resume"[^>]*>이어서 옮겨 오기/);
  assert.equal(m.moveRechoose(space, st), false); assert.equal(m.moveRechoose(space, { ...st, begun: false }), true); assert.equal(m.moveRechoose(space, { ...st, begun: true }), false);
  assert.equal(home(space, st).actions[0].flow, 'moveResume'); assert.match(home(space, st).sub, /공간을 비운 뒤 다시 눌러 주세요/);
  assert.equal(m.moveRechoose({ ...ns, lastMoveError: { code: 'MOVE_LIST_TOO_BIG', at: '2026-11-13T05:00:00Z' } }, st), false);
  assert.equal(m.moveRechoose({ ...ns, lastMoveError: { ...ns.lastMoveError, code: 'MOVE_NETWORK' } }, st), false);
  // 한 파일도 놓기 전(begun 거짓)의 공간 부족은 자리를 다시 고른다
  assert.equal(home(space, fresh).actions[0].to, 'move-1');
  assert.equal(home(space, fresh).actions[0].label, '자리 다시 고르기');
  assert.match(draw('move-2', space, MOVE_MV.nospaceFresh).html, /data-act="move-in"[^>]*>자리 다시 고르기/);
  const one = draw('move-1', space, MOVE_MV.nospaceFresh).html;
  assert.match(one, /파일을 놓기 전에 멈춰 자리를 다시 고를 수 있습니다/); assert.match(one, /data-act="move-open"/);
  assert.doesNotMatch(one, /앞서 멈춘 옮겨 오기를 잇습니다/);
  for (const code of ['MOVE_NO_SPACE', 'MOVE_LIST_TOO_BIG', 'MOVE_PROFILE', 'MOVE_SNAPSHOT_GONE', 'MOVE_NETWORK', 'MOVE_GONE', 'SOURCES_MISSING']) assert.notEqual(failureText(code), failureText('UNKNOWN_X'), code);
  assert.match(m.moveStopText({ ...ns, lastMoveError: { ...ns.lastMoveError, code: 'MOVE_NETWORK' } }, st), /인터넷 연결이 끊겨 멈췄습니다[\s\S]*멈춘 곳부터 잇습니다/);
  // E13 — 다시 시작했다가 멈춰도 앞선 결과가 남는다. 기본 화면은 멈춤이 먼저이고, 확인서는 그 앞의 것이라고 쓴다
  const rr = MOVE_MV.rerun;
  assert.equal(home(read, rr.state).id, 'home-move-stopped');
  assert.match(home(read, rr.state).sub, /앞서 옮겨 온 결과는 그대로 있습니다/);
  assert.match(draw('move-3', read, rr).html, /앞서 마친 옮겨 오기의 확인서입니다/);
  assert.doesNotMatch(draw('move-3', read, MOVE_MV.result).html, /앞서 마친 옮겨 오기의 확인서입니다/);
  assert.match(draw('move-2', read, rr).html, /data-act="move-result"[^>]*>앞서 옮겨 온 결과 보기/);
  // E5 — OneDrive에서 견주지 못한 수는 따로 센다. 줄로 보이되 합계에는 더하지 않는다(onedrive의 일부)
  const u = { ...MOVE_MV.ok.result, complete: false, counts: { placed: 10, onedrive: 5, unverified: 2 } };
  assert.deepEqual(m.moveLeft(u), { n: 2, failed: 0, unverified: 2, cut: false, big: 0 });
  assert.match(m.moveTitle(u).soft, /2개는 내용을 견주지 못했습니다/);
  const three = draw('move-3', read, { ...MOVE_MV.ok, result: u }).html;
  assert.match(three, /그 가운데 내용은 견주지 못함<\/span><span class="v">2개/); assert.match(three, /합계<\/span><span class="v">15개/);
  // E6 — 옮겨 온 자리마다 「폴더 열기」(결과가 적은 자리만). 「따로 둔 것」이 있으면 그 자리도 연다
  const res3 = draw('move-3', read, MOVE_MV.result).html;
  assert.match(res3, /data-act="move-folder" data-path="C:\\Users\\studio\\옮겨 온 자료\\바탕화면"/);
  assert.match(res3, /data-act="move-folder" data-path="C:\\Users\\studio\\옮겨 온 자료\\따로 둔 것"/);
  // E15 — 지금 없는 자리는 열 단추 없이 「지금 없음」, 넘기기에서는 체크하지 못하게 뺀다
  const gone3 = draw('move-3', read, MOVE_MV.gone).html;
  assert.doesNotMatch(gone3, /data-path="C:\\Users\\studio\\Pictures"/); assert.match(gone3, /사진<\/span><span class="vl">지금 없음/);
  const take = m.moveTakeList(read, MOVE_MV.gone);
  assert.ok(!take.checked.some((p) => /Pictures$/.test(p))); assert.equal(take.checked.length, 3);
  const four = draw('move-4', read, MOVE_MV.gone).html;
  assert.match(four, /role="checkbox" aria-checked="false" data-act="move-root" data-root="C:\\Users\\studio\\Pictures" aria-disabled="true"/);
  assert.match(four, /이 PC에 없는 1곳은 뺐습니다/);
  // 넘기기가 없다고 돌려준 자리(SOURCES_MISSING의 paths → mv.gone)도 뺀다
  assert.ok(!m.moveTakeList(read, { ...MOVE_MV.result, gone: ['c:\\users\\studio\\documents'] }).checked.some((p) => /Documents$/.test(p)));
  // E10 — 넘기기 고름은 엔진의 nextSources로 짐작하지 않는다(카본 A3). 옮겨 오기 전에 고른 폴더가 옮겨 온 자리와 겹쳐도 나머지를 끄지 않는다
  const saved = m.moveTakeList(STATES['home-move-saved'], MOVE_MV.saved);
  assert.ok(!saved.isOff('C:\\Users\\studio\\Pictures')); assert.ok(!saved.checked.includes('E:\\거래처')); assert.equal(saved.checked.length, 4);
  // E11 — 넘겨받은 수(carried)는 다른 수의 일부라 합계에 더하지 않고, 이번에 받지 않았다고 말한다
  const car = draw('move-3', read, MOVE_MV.carried).html;
  assert.match(car, /합계<\/span><span class="v">12,480개/); assert.match(car, /앞선 옮겨 오기에서 확인한 11,800개는 지금도 크기와 시각이 같아/);
  assert.doesNotMatch(car, /모두 디스크에 쓴 뒤 다시 읽어/);
  assert.match(draw('move-3', read, MOVE_MV.result).html, /못 옮긴 파일, 「\(복구본\)」으로 둔 파일, 견주지 못한 파일, 그 뒤 바뀐 파일은 다시 받습니다/); assert.doesNotMatch(draw('move-3', read, MOVE_MV.result).html, /처음부터 다시 받아/);
  // E8 · E11 — 미리 보기가 받을 것만 세므로 0개일 수 있다
  const zero = { ...MOVE_MV.plan, state: MOVE_MV.result.state, preview: { ...MOVE_MV.plan.preview, folders: MOVE_MV.plan.preview.folders.map((x) => ({ ...x, files: 0, bytes: 0 })) }, first: null };
  const z = draw('move-1', read, zero);
  assert.match(z.html, /받을 파일이 없습니다\. 앞서 옮겨 온 파일은 다시 받지 않습니다/);
  // 받을 것이 없으면 시작하지 않고 확인서로 보낸다. 고름을 바꿨으면 아직 세지 않았다고 쓴다(Fable F3)
  assert.match(z.html, /data-act="move-result"[^>]*>확인서 보기/); assert.equal(z.acts['move-result'].to, 'move-3'); assert.doesNotMatch(z.html, /data-act="move-go"/);
  assert.match(draw('move-1', read, { ...zero, dirty: true }).html, /바꾼 자리로는 아직 세지 않았습니다/);
  assert.match(draw('move-1', read, { ...zero, state: null }).html, /data-act="move-go" aria-disabled="true"[\s\S]*받을 파일이 없어 시작하지 않습니다/);
  // E7 — 남은 시간 어림은 속도가 있을 때만
  assert.equal(m.etaKo(30), '1분 안'); assert.equal(m.etaKo(8 * 60), '약 8분'); assert.equal(m.etaKo(125 * 60), '약 2시간 5분'); assert.equal(m.etaKo(NaN), '');
  assert.equal(m.moveProgress({ move: { progress: { bytes: 5, total: 10, folder: null, bytesPerSecond: null } } }).leftSec, null);
});

test('옮겨 오기 4b: 프로그램과 설정(다시 깔기 · 앱 설정 되돌리기 · 다시 로그인할 곳, Fable 5.2 설계 검토 D1~D18)', async () => {
  const m = await load('screen-model.js');
  const { renderScreen, SCREENS } = await load('screen-view.js');
  const { STATES, NOW, MOVE_MV, MOVE_ACCT, MOVE_APPS } = await load('engine-fixtures.js');
  const draw = (id, state, mv) => renderScreen(id, { state, model: m.homeModel(state, { now: NOW, move: mv?.state || null }), now: NOW, ui: {}, acct: { ...MOVE_ACCT }, mv, fake: true });
  const read = STATES['home-move-read'];
  assert.ok(SCREENS.includes('move-apps'));
  // 자리 — 확인서와 넘기기 사이, 걸음은 다섯(권고 1 · 5). 확인서 단추는 둘
  const three = draw('move-3', read, MOVE_MV.result);
  assert.equal(three.acts['move-next'].to, 'move-apps'); assert.match(three.html, /다음 · 프로그램과 설정/); assert.doesNotMatch(three.html, /건너뛰고/);
  assert.deepEqual(draw('move-apps', read, MOVE_MV['apps-pick']).seg, [4, 5]); assert.deepEqual(draw('move-4', read, MOVE_MV.result).seg, [5, 5]);
  assert.equal(draw('move-4', read, MOVE_MV.result).back, 'move-apps');
  // 고르기 — 표는 엔진의 chosen이 기본, 표 밖은 고르지 않음, 이미 깔린 것은 고르지 않는다
  const rows = m.appsRows(MOVE_APPS.list);
  assert.deepEqual(rows.ids, ['Git.Git', 'OpenJS.NodeJS.LTS', 'Kakao.KakaoTalk', 'Microsoft.VisualStudioCode', 'Obsidian.Obsidian', 'Anthropic.ClaudeCode']);
  assert.equal(rows.machine, 3); assert.equal(rows.outside, 0);
  assert.equal(m.appsRows(MOVE_APPS.list, { 'Google.Chrome': true }).ids.includes('Google.Chrome'), false);
  const picked = m.appsRows(MOVE_APPS.list, { 'Studio.InvoiceTool': true, 'Git.Git': false });
  assert.equal(picked.outside, 1); assert.equal(picked.noLicense, 1); assert.ok(!picked.ids.includes('Git.Git'));
  // winget이 준비되지 않으면 아무것도 고르지 않고, 설정 되돌리기도 두지 않는다(D5)
  assert.deepEqual(m.appsRows(MOVE_APPS.notReady('WINGET_MISSING')).ids, []);
  const nr = draw('move-apps', read, MOVE_MV['apps-notready']);
  assert.match(nr.html, /data-act="apps-reload"[^>]*>목록 다시 읽기/); assert.doesNotMatch(nr.html, /설정만 되돌리기|data-act="apps-go"/);
  assert.match(m.wingetText({ reason: 'WINGET_OLD' }), /앱 설치 관리자/);
  // 고르는 화면 — 관리자 확인 안내는 「확인」 단추와 창 제목으로(D3), 사용권 줄은 주 단추 바로 위에 고른 것이 있을 때만(D14)
  const pick = draw('move-apps', read, MOVE_MV['apps-pick']).html;
  assert.match(pick, /「SYNK 업무 백업 — 프로그램 다시 깔기」 창에서 「확인」을 한 번 더/); assert.doesNotMatch(pick, /「깔기」를/);
  assert.match(pick, /사용권 계약에 동의하게 됩니다[\s\S]{0,200}data-act="apps-go"[^>]*>고른 6개 깔고 설정 되돌리기/);
  assert.match(pick, /한 시간 넘게 걸릴 수 있습니다/);
  const none = draw('move-apps', read, MOVE_MV['apps-none']).html;
  assert.match(none, /설정만 되돌리기/); assert.doesNotMatch(none, /사용권 계약에 동의/);
  const open = draw('move-apps', read, MOVE_MV['apps-open']).html;
  assert.match(open, /사용권 주소를 읽지 못했습니다 · winget show --id Studio\.InvoiceTool -e/); assert.match(open, /「그 밖에 winget이 찾은 프로그램」은 설치기가 스스로 관리자 확인을/); assert.doesNotMatch(open, /표 밖|표에 없는/); // 카본 C9
  assert.match(open, /<span class="ds cmd">winget install --id Git\.Git -e<\/span>/); assert.match(open, /공식 · https:\/\/whale\.naver\.com\//);
  // 줄의 고르는 단추와 주소 글은 따로다(주소를 골라 복사할 수 있게, E16 전)
  assert.match(open, /<button class="pickb" type="button" role="checkbox" aria-checked="false" data-act="app-pick" data-app="Kakao\.KakaoTalk">/);
  // 깔고 있는 동안 — 확인을 기다릴 때만 「눌러 주세요」(E18 approval, 앞서는 D2로 두 때를 함께 덮었다), 지금 까는 것과 남은 수,
  // 창을 닫아도 계속 깐다(E20, 앞서는 D4로 「닫으면 끝난다」고 썼다), 단추 없음. 넘기기는 막지 않는다(E19). 다시 옮겨 오기는 막는다
  const el = draw('move-apps', STATES['home-move-apps-elevated'], MOVE_MV['apps-running']);
  assert.doesNotMatch(el.html, /관리자 확인 창에서/); assert.match(el.html, /지금 「Node\.js LTS」를 깔고 있습니다\. 이것까지 5개가 남았습니다/);
  assert.match(el.html, /창을 닫아도 앱이 뒤에서 계속 깝니다/); assert.doesNotMatch(el.html, /창을 닫으면 앱이 끝나/); assert.doesNotMatch(el.html, /data-act="apps-later"|data-act="apps-go"/);
  const ap = draw('move-apps', STATES['home-move-apps-approval'], MOVE_MV['apps-running']).html;
  assert.match(ap, /관리자 확인 창에서 「예」를 눌러 주세요/); assert.match(ap, /10분 안에 누르지 않으면 닫히고/); assert.match(ap, /Git<\/span><span class="vl">확인을 기다림/);
  assert.doesNotMatch(draw('move-apps', STATES['home-move-apps-user'], MOVE_MV['apps-running']).html, /관리자 확인 창에서/);
  const take = draw('move-4', STATES['home-move-apps-elevated'], MOVE_MV['apps-running']).html;
  assert.doesNotMatch(take, /data-act="move-take" aria-disabled="true"/); assert.match(take, /넘겨도 프로그램은 뒤에서 계속 깝니다/);
  assert.match(draw('move-3', STATES['home-move-apps-elevated'], MOVE_MV.result).html, /data-act="move-again" aria-disabled="true"/);
  // 결과 줄은 설치 목록 확인(listed)을 먼저 본다(D6) — 실패라 했어도 목록에 있으면 깔려 있음
  assert.equal(m.appResult({ id: 'a', state: 'failed', listed: true }).ok, true);
  assert.match(m.appResult({ id: 'a', state: 'installed', listed: false }).text, /설치 목록에 없습니다/);
  assert.match(m.appResult({ id: 'a', state: 'installed', listed: null }).text, /확인하지 못했습니다/);
  assert.match(m.appResult({ id: 'a', state: 'declined' }).text, /관리자 확인을 받지 못해/); // 누가 눌렀는지 말하지 않는다(D16)
  assert.match(m.appResult({ id: 'a', state: 'timeout', listed: false }).text, /시간이 지나 끝내지 못했습니다/);
  assert.match(m.appReason('EXIT_2'), /앞서 시작한 깔기가 아직 돌고 있을 수/); assert.match(m.appReason('WINGET_ADMIN_MISSING'), /관리자에게/);
  assert.match(m.appReason('EXIT_-1978335189'), /0x8A15002B/); assert.match(m.appReason('EXIT_1603'), /오류 번호 1603/);
  // 표 밖 프로그램의 결과는 이름이 없어 목록에서 들고 있던 이름을 쓴다(D8)
  assert.equal(m.appResult({ id: 'VideoLAN.VLC', name: null, state: 'installed', scope: 'outside', listed: true }, { 'VideoLAN.VLC': 'VLC media player' }).name, 'VLC media player');
  // 설정은 하나라도 깔렸을 때만 저절로 되돌린다(D9). 모두 확인을 받지 못했거나 결과를 못 읽으면 고르는 화면에 남아 까닭을 알린다
  assert.equal(m.appsOutcome(STATES['home-move-apps-done'].move.reinstall).restore, true);
  assert.equal(m.appsOutcome(STATES['home-move-apps-declined'].move.reinstall).restore, false);
  assert.equal(m.appsOutcome(STATES['home-move-apps-failed'].move.reinstall).restore, false);
  assert.equal(m.appsOutcome({ running: true }), null);
  const dec = draw('move-apps', STATES['home-move-apps-declined'], MOVE_MV['apps-declined']).html;
  assert.match(dec, /지난번에 3개를 깔지 못했습니다/); assert.match(dec, /지난번 깔기 · 관리자 확인을 받지 못해 깔지 않았습니다/);
  assert.match(draw('move-apps', STATES['home-move-apps-failed'], MOVE_MV['apps-failed']).html, /깔기 결과를 읽지 못했습니다/);
  // 결과 — 주 단추 하나, 밑줄 단추는 해당할 때만(「다시 깔기」 · 「설정 다시 되돌리기」)
  const res = draw('move-apps', STATES['home-move-apps-done'], MOVE_MV['apps-result']);
  assert.match(res.html, /1개는<br><span class="soft">깔지 못했습니다/);
  assert.match(res.html, /data-act="apps-next"[^>]*>다음 · 백업 켜기[\s\S]*data-act="apps-reload"[^>]*>다시 깔기[\s\S]*data-act="apps-restore"[^>]*>설정 다시 되돌리기/);
  assert.match(res.html, /실행 명령이 든 Terminal 프로필 1개\(서버 접속\)는 옮기지 않았습니다/);
  assert.match(res.html, /열쇠로 보이는 글이 있어 옮기지 않은 것이 1개 있습니다/);
  assert.match(res.html, /프로그램이 깔려 있지 않아 따로 둔 곳에만 두었습니다/);
  assert.match(res.html, /AI 도구 지침 파일을 되돌렸습니다/); assert.match(res.html, /code --install-extension ms-python\.python/);
  const ok = draw('move-apps', STATES['home-move-apps-ok'], MOVE_MV['apps-ok']).html;
  assert.match(ok, /프로그램을 깔고<br><span class="soft">설정을 되돌렸습니다/); assert.doesNotMatch(ok, /data-act="apps-restore"/);
  // 다 깔려도 목록으로 돌아가는 길과 직접 까실 것이 남는다(카본 C2)
  assert.match(ok, /data-act="apps-reload"[^>]*>다른 프로그램 더 깔기/); assert.match(ok, /직접 까실 것 · 4개/);
  const se = draw('move-apps', STATES['home-move-apps-done'], MOVE_MV['apps-settings-error']).html;
  assert.match(se, /설정을<br><span class="soft">되돌리지 못했습니다/); assert.match(se, /data-act="apps-restore"[^>]*>설정 되돌리기/);
  // 앱 설정 줄 — 뺀 칸 수 · 쓰지 못한 파일(D8)
  const lines = m.settingRows([{ app: 'vscode', name: 'VS Code', restored: ['a'], kept: [], side: [], dropped: 4, droppedProfiles: [], extensions: [], failed: [{ path: 'x', code: 'MOVE_MKDIR' }], left: [] }])[0];
  assert.ok(lines.warn); assert.ok(lines.lines.some((t) => /그 밖의 4칸은 뺐습니다/.test(t))); assert.ok(lines.lines.some((t) => /1개는 쓰지 못했습니다/.test(t)));
  // 다시 로그인할 곳 — 어느 상태에서도 보인다(D10). 넘기기 화면에는 남은 수 한 줄
  for (const k of ['apps-pick', 'apps-notready', 'apps-error', 'apps-loading', 'apps-result']) assert.match(draw('move-apps', read, MOVE_MV[k]).html, /다시 로그인할 곳 · 남은 7곳/, k);
  assert.equal(m.checksLeft(MOVE_APPS.checklist), 7);
  assert.match(draw('move-4', read, { ...MOVE_MV.result, apps: { checks: MOVE_APPS.checklist } }).html, /data-act="move-apps-open">프로그램과 설정 · 다시 로그인할 곳 7곳 남음/);
  // 깔고 있는 동안에는 그 단추가 「까는 중」이라 말한다 — 안내 글의 「프로그램과 설정」과 이름이 같다(카본 B8 · C5)
  assert.match(draw('move-4', STATES['home-move-apps-elevated'], MOVE_MV['apps-running']).html, /data-act="move-apps-open">프로그램과 설정 · 까는 중/);
  // 넘긴 뒤에도 다시 열 수 있다고 쓴다(E19 — 앞서는 카본 C4로 「다시 열 수 없다」고 썼다)
  assert.match(draw('move-4', read, MOVE_MV.result).html, /넘긴 뒤에도 「설정」의 「프로그램과 설정」에서/); assert.doesNotMatch(draw('move-4', read, MOVE_MV.result).html, /다시 열 수 없습니다/);
  assert.doesNotMatch(draw('move-4', read, MOVE_MV.result).html, /다음 업데이트에서 이 자리에 열립니다/);
  // 빈 목록 — 설정은 되돌릴 수 있다. 꾸러미가 없는지는 엔진의 kitProblems로 가른다(E21 — 앞서는 D11로 미리 보기의 kitAt만 보았다)
  const empty = draw('move-apps', read, MOVE_MV['apps-empty']).html;
  assert.match(empty, /프로그램을 찾지 못했습니다/); assert.match(empty, /data-act="apps-go"[^>]*>설정 되돌리기/);
  assert.match(draw('move-apps', read, { ...MOVE_MV['apps-empty'], apps: { ...MOVE_MV['apps-empty'].apps, list: { ...MOVE_APPS.empty, kitProblems: ['no-kit'] } } }).html, /프로그램 목록이 백업에 없습니다/);
  assert.doesNotMatch(draw('move-apps', read, { ...MOVE_MV['apps-empty'], preview: { kitAt: null } }).html, /프로그램 목록이 백업에 없습니다/);
  // 보호 범위 — 프로그램 목록과 앱 설정도 함께 지킨다(4.6 꾸러미)
  const { drawer } = await load('screen-view.js');
  assert.match(drawer({ ...STATES.home, moveKit: { at: '2026-11-13T01:00:00Z', apps: 4, tooBig: [] } }), /앱 설정 4개도 함께 지킵니다/);
  assert.doesNotMatch(drawer(STATES.home), /앱 설정 \d+개도 함께/);
});

test('옮겨 오기 4b: 카본 검수 지적 자리(workbackup-ui-move4b-20261116 A1~C10)', async () => {
  const m = await load('screen-model.js');
  const { renderScreen } = await load('screen-view.js');
  const { STATES, NOW, MOVE_MV, MOVE_ACCT, MOVE_APPS } = await load('engine-fixtures.js');
  const draw = (id, state, mv) => renderScreen(id, { state, model: m.homeModel(state, { now: NOW, move: mv?.state || null }), now: NOW, ui: {}, acct: { ...MOVE_ACCT }, mv, fake: true });
  const read = STATES['home-move-read'];
  // A1 — 아직 정해지지 않은 진행 칸(null)을 0으로 읽지 않는다
  const p = m.moveProgress({ move: { progress: { bytes: null, total: null, folder: null, bytesPerSecond: null } } });
  assert.equal(p.bytes, null); assert.equal(p.total, null);
  assert.doesNotMatch(draw('move-2', { ...STATES['home-move-run'], move: { reinstall: null, progress: { bytes: null, total: null, folder: null, bytesPerSecond: null } } }, MOVE_MV.run).html, /0B \//);
  // A5 — 옮기지 않은 것만 있으면 「옮기지 않음」
  assert.equal(m.settingRows([{ app: 'claude-code', name: 'Claude Code', restored: [], kept: [], side: [], left: [{ entry: 'settings', why: 'secret-looking' }] }])[0].label, '옮기지 않음');
  assert.equal(m.settingRows([{ app: 'x', name: 'X', restored: [], kept: [], side: [], left: [] }])[0].label, '옮길 것 없음');
  // A6 · C8 — 번호 읽는 소리에 맞는 조사
  assert.match(m.appReason('EXIT_1603'), /1603으로 끝났습니다/); assert.match(m.appReason('EXIT_-1978335189'), /0x8A15002B로 끝났습니다/);
  // B1 · C1 — 결과를 못 읽었으면 「목록 다시 읽기」 단추가 있다
  assert.match(draw('move-apps', STATES['home-move-apps-failed'], MOVE_MV['apps-failed']).html, /data-act="apps-reload"[^>]*>목록 다시 읽기/);
  // B2 · C4 — winget이 없으면 명령을 붙여 넣어도 깔린다고 하지 않는다
  const nr = draw('move-apps', read, MOVE_MV['apps-notready']).html;
  assert.doesNotMatch(nr, /붙여 넣어도 깔립니다/); assert.match(nr, /winget이 준비된 뒤에/); assert.match(nr, /넘긴 뒤에도 「설정」의 「프로그램과 설정」에서 다시 열 수 있습니다/);
  // B3 — 다시 켠 뒤의 길은 고르는 화면의 「설정만 되돌리기」이고, 그 단추가 고르는 화면에 있다
  const rb = { ...STATES['home-move-apps-done'], move: { reinstall: { ...STATES['home-move-apps-done'].move.reinstall, results: [{ id: 'Git.Git', name: 'Git', state: 'reboot', scope: 'machine', listed: false }] }, progress: null } };
  assert.match(draw('move-apps', rb, MOVE_MV['apps-result']).html, /「프로그램과 설정」을 열어 「설정만 되돌리기」를 누르면/);
  assert.match(draw('move-apps', read, MOVE_MV['apps-pick']).html, /data-act="apps-restore"[^>]*>설정만 되돌리기/);
  // B4 · C7 — 깔는 동안의 줄은 단계와 설치 범위로 가른다. 지금 까는 것(E18 current)과 그 앞뒤는 엔진이 까는 차례로 가른다
  const user = draw('move-apps', STATES['home-move-apps-user'], MOVE_MV['apps-running']).html;
  assert.match(user, /Git<\/span><span class="vl">차례 지남/); assert.match(user, /Visual Studio Code<\/span><span class="vl">차례 지남/);
  assert.match(user, /Obsidian<\/span><span class="vl">까는 중/); assert.match(user, /Claude Code<\/span><span class="vl">차례를 기다림/); assert.match(user, /<p>남은 2개<\/p>/);
  assert.match(draw('move-apps', STATES['home-move-apps-elevated'], MOVE_MV['apps-running']).html, /Git<\/span><span class="vl">관리자 권한으로 깔기/);
  // B5 — 표의 프로그램이 없고 그 밖의 것이 접혀 있으면 「주소와 명령 보기」를 두지 않는다
  const onlyOthers = { ...MOVE_MV['apps-pick'], apps: { ...MOVE_MV['apps-pick'].apps, list: { ...MOVE_APPS.list, table: [], machine: [], user: [] } } };
  assert.doesNotMatch(draw('move-apps', read, onlyOthers).html, /data-act="app-cmds"/);
  // F2 — 읽지 못한 체크 목록은 다시 읽는 단추를 둔다(「다시 열면 다시 읽습니다」라 하지 않는다)
  const nochk = draw('move-apps', read, { ...MOVE_MV['apps-pick'], apps: { ...MOVE_MV['apps-pick'].apps, checks: null } }).html;
  assert.match(nochk, /data-act="app-checks-reload"[^>]*>다시 읽기/); assert.doesNotMatch(nochk, /다시 열면 다시 읽습니다/);
  // FA2 — 쓰지 못한 파일이 섞여도 되돌린 파일이 있으면 「되돌렸습니다」다
  const mixed = { ...MOVE_MV['apps-ok'], apps: { ...MOVE_MV['apps-ok'].apps, settings: [{ app: 'git', name: 'Git', restored: ['a'], kept: [], side: [], failed: [{ path: 'b', code: 'MOVE_MKDIR' }], left: [] }] } };
  assert.match(draw('move-apps', STATES['home-move-apps-ok'], mixed).html, /프로그램을 깔고<br><span class="soft">설정을 되돌렸습니다/);
  // 옛 PC가 둘 이상이면 다른 옛 PC를 고를 수 있다(목록 초과로 막히던 갈래는 E25로 걷었다)
  const two = { ...MOVE_MV.toobig, devices: [...MOVE_MV.toobig.devices, { from: 'OLD-DESKTOP', lastBackupAt: '2026-09-02T09:10:00Z' }] };
  assert.match(draw('move-1', read, two).html, /data-act="move-from" data-from="OLD-DESKTOP"/);
  assert.doesNotMatch(draw('move-1', read, MOVE_MV.toobig).html, /data-act="move-from"/);
  // FA3 — 멈춘 옮겨 오기를 이을 때는 남은 것이 0이어도 막지 않는다
  const tail = { ...MOVE_MV.nokit, preview: { ...MOVE_MV.nokit.preview, folders: MOVE_MV.nokit.preview.folders.map((x) => ({ ...x, files: 0, bytes: 0 })) }, first: null };
  const tailHtml = draw('move-1', read, tail).html;
  assert.match(tailHtml, /남은 파일이 없습니다\. 누르면 확인서를 마저 씁니다/); assert.doesNotMatch(tailHtml, /data-act="move-go" aria-disabled="true"/);
  // F4 — 되돌린 것이 없으면 큰 글이 「되돌렸습니다」가 아니다
  const sideOnly = { ...MOVE_MV['apps-ok'], apps: { ...MOVE_MV['apps-ok'].apps, settings: MOVE_APPS.settings.filter((a) => a.notInstalled) } };
  assert.match(draw('move-apps', read, sideOnly).html, /설정을<br><span class="soft">따로 두었습니다/);
  assert.match(draw('move-apps', read, { ...MOVE_MV['apps-ok'], apps: { ...MOVE_MV['apps-ok'].apps, settings: [] } }).html, /되돌린 설정이<br><span class="soft">없습니다/);
  // B6 — 빈 체크 목록은 「모두 했습니다」가 아니다
  assert.match(draw('move-apps', read, { ...MOVE_MV['apps-pick'], apps: { ...MOVE_MV['apps-pick'].apps, checks: [] } }).html, /다시 로그인할 곳을 찾지 못했습니다/);
  // B7 — 「다시 옮겨 오기」 단추가 없으면 그 안내도 없다
  assert.doesNotMatch(draw('move-3', STATES['home-move-apps-elevated'], MOVE_MV.ok).html, /다 깐 뒤에 다시 옮겨 올 수 있습니다/);
  // B9 — 같은 이름의 단추에 대상 이름
  assert.match(draw('move-3', read, MOVE_MV.result).html, /aria-label="「바탕화면」 폴더 열기"/);
  assert.match(draw('move-apps', read, MOVE_MV['apps-open']).html, /aria-label="직접 까실 것 접기"/);
  // B10 — 「로그인 정보와 비밀번호」로 맞춘다
  for (const k of ['apps-pick', 'apps-result']) assert.doesNotMatch(draw('move-apps', STATES['home-move-apps-done'], MOVE_MV[k]).html, /로그인과 암호|로그인 정보와 암호/, k);
  // C3 — 설정 되돌리기가 앞의 일에 밀렸으면 예약 백업이라 하지 않는다
  const se = draw('move-apps', STATES['home-move-apps-done'], MOVE_MV['apps-settings-error']).html;
  assert.match(se, /앞의 일이 끝나지 않아 되돌리지 못했습니다/); assert.doesNotMatch(se, /예약 백업/);
  // C6 — 다시 시작했다가 멈춘 옮겨 오기의 확인서는 「이어서 옮겨 오기」다
  const rerun = draw('move-3', read, MOVE_MV.rerun);
  assert.equal(rerun.acts['move-resume'].flow, 'moveResume'); assert.match(rerun.html, /data-act="move-resume"[^>]*>이어서 옮겨 오기/);
  assert.doesNotMatch(rerun.html, /data-act="move-again"|처음부터 다시 받아/);
  // C10 — 빈 목록은 패널에도 없다고 쓰고, 넘어가는 단추는 「다음 · 백업 켜기」
  const empty = draw('move-apps', read, MOVE_MV['apps-empty']).html;
  assert.match(empty, /<p class="empty">다시 깔 프로그램이 없습니다/); assert.match(empty, /data-act="apps-later"[^>]*>다음 · 백업 켜기/);
});

test('옮겨 오기 4b 엔진 판 잇기(E16~E24 · 조율 세션 e244f42e4): 넘긴 뒤에도 연다, 앱을 다시 켜도 남는 결과, 확인 기다림, 꾸러미 사정', async () => {
  const m = await load('screen-model.js');
  const { renderScreen, drawer } = await load('screen-view.js');
  const { STATES, NOW, MOVE_MV, MOVE_ACCT, MOVE_APPS } = await load('engine-fixtures.js');
  const { failureText } = await load('state-store.js');
  const draw = (id, state, mv) => renderScreen(id, { state, model: m.homeModel(state, { now: NOW, move: mv?.state || null, checks: mv?.apps?.checks }), now: NOW, ui: {}, acct: { ...MOVE_ACCT }, mv, fake: true });
  const read = STATES['home-move-read'], home = STATES.home, handed = MOVE_MV.handed.state;
  // E19 — 넘긴 PC(이 PC가 백업한다)만 넘긴 뒤 화면을 연다. 옮겨 오기 전 · 「끊지 않기」를 고른 · 결과 없이 넘긴 PC는 아니다
  assert.equal(m.movedHere(home, handed), true);
  assert.equal(m.movedHere(read, handed), false);
  assert.equal(m.movedHere(home, { ...handed, released: '2026-11-13T14:38:00+09:00' }), false);
  assert.equal(m.movedHere(home, { ...handed, resultAt: null }), false);
  assert.equal(m.movedHere(home, null), false);
  // 기본 화면의 한 줄 — 다시 로그인할 곳의 남은 수(E17 checklistLeft). 창이 읽은 체크가 있으면 그 수를 쓰고, 다 했으면 줄이 없다
  const hm = m.homeModel(home, { now: NOW, move: handed });
  assert.match(hm.restored.text, /다시 로그인할 곳이 7곳 남았습니다/); assert.equal(hm.restored.act.to, 'move-apps');
  assert.ok(!m.homeModel(home, { now: NOW, move: handed, checks: MOVE_MV['apps-handed-done'].apps.checks }).restored);
  assert.ok(!m.homeModel(home, { now: NOW, move: { ...handed, checklistLeft: 0 } }).restored);
  assert.ok(!m.homeModel(home, { now: NOW, move: { ...handed, checklistLeft: null } }).restored);
  assert.match(draw('home', home, MOVE_MV.handed).html, /data-act="move-apps-home"[^>]*>프로그램과 설정/);
  // 첫 백업이 도는 동안에도 둔다(E19). 깔고 있으면 「진행 보기」
  assert.match(m.homeModel(STATES['home-handed-run'], { now: NOW, move: handed }).restored.text, /7곳 남았습니다/);
  const inst = m.homeModel(STATES['home-handed-installing'], { now: NOW, move: handed });
  assert.match(inst.restored.text, /옛 PC의 프로그램을 깔고 있습니다/); assert.equal(inst.restored.act.label, '진행 보기');
  // Fable F6 — 옮겨 온 지 두 주가 지나면 기본 화면 줄은 거둔다(깔고 있으면 남는다). 서랍 줄은 남는다
  const late = NOW + 15 * 86400000;
  assert.ok(!m.homeModel(home, { now: late, move: handed }).restored);
  assert.match(m.homeModel(STATES['home-handed-installing'], { now: late, move: handed }).restored.text, /깔고 있습니다/);
  assert.match(drawer(home, { now: late, moved: m.movedApps(home, handed) }), /다시 로그인할 곳 7곳 남음/);
  // 설정 서랍의 줄 — 넘긴 PC에만
  const dr = drawer(home, { now: NOW, moved: m.movedApps(home, handed) });
  assert.match(dr, /프로그램과 설정<\/span><span class="vl">옛 PC의 프로그램을 다시 깔고 설정을 되돌립니다 · 다시 로그인할 곳 7곳 남음/);
  assert.match(dr, /data-act="move-apps" aria-label="프로그램과 설정 열기"/);
  assert.match(drawer(home, { now: NOW, moved: m.movedApps(STATES['home-handed-installing'], handed) }), /옛 PC의 프로그램을 깔고 있습니다/);
  assert.doesNotMatch(drawer(home, { now: NOW, moved: m.movedApps(read, handed) }), /data-act="move-apps"/);
  // 넘긴 뒤의 화면 — 옮겨 오기 걸음 없이, 끝 단추는 기본 화면으로. 넘기기 전에는 「나중에 하고 백업 켜기」와 다시 여는 곳을 쓴다
  const hd = draw('move-apps', home, MOVE_MV['apps-handed']);
  assert.equal(hd.seg, null); assert.equal(hd.back, 'home'); assert.equal(hd.acts['apps-later'].to, 'home');
  assert.match(hd.html, /data-act="apps-later"[^>]*>기본 화면으로/); assert.doesNotMatch(hd.html, /넘긴 뒤에도/);
  const pk = draw('move-apps', read, MOVE_MV['apps-pick']);
  assert.match(pk.html, /data-act="apps-later"[^>]*>나중에 하고 백업 켜기/); assert.equal(pk.acts['apps-later'].to, 'move-4');
  assert.match(pk.html, /넘긴 뒤에도 「설정」의 「프로그램과 설정」에서 다시 열 수 있습니다/);
  // 둔 꾸러미가 없는 앞선 판의 옮겨 오기는 첫 백업 중 목록을 못 읽는다(JOB_BUSY) — 백업이 끝나면 다시 읽는다고 쓴다
  const busy = draw('move-apps', STATES['home-handed-run'], MOVE_MV['apps-handed-busy']).html;
  assert.match(busy, /백업이 도는 동안에는 옛 PC의 프로그램 목록을 읽지 못합니다\. 백업이 끝나면 저절로 다시 읽습니다/); assert.match(busy, /data-act="app-checks-reload"/);
  // Fable F3 — 도는 일이 없으면 「저절로 다시 읽습니다」라고 하지 않는다
  assert.doesNotMatch(draw('move-apps', home, MOVE_MV['apps-handed-busy']).html, /저절로 다시 읽습니다/);
  // E17 — 앱을 다시 켜도 엔진이 적은 마지막 깔기 · 설정 결과를 보인다. 그때를 쓴다
  const sv = draw('move-apps', read, MOVE_MV['apps-saved']).html;
  assert.match(sv, /오후 2:39에 마친 결과입니다/); assert.match(sv, /<h3>깐 프로그램<\/h3>/); assert.match(sv, /<h3>되돌린 설정<\/h3>/);
  assert.equal(m.appsPhase(read, MOVE_MV['apps-saved'].apps, MOVE_MV['apps-saved'].state), 'result');
  // 「다른 프로그램 더 깔기」로 다시 고르러 오면(fresh) 지난 결과를 접는다. 이 창에서 새로 깐 뒤에도 앞선 설정 결과를 쓰지 않는다
  const fresh = { ...MOVE_MV['apps-saved'], apps: { ...MOVE_MV['apps-saved'].apps, fresh: true } };
  assert.equal(m.appsPhase(read, fresh.apps, fresh.state), 'pick'); assert.doesNotMatch(draw('move-apps', read, fresh).html, /마친 결과입니다/);
  assert.equal(m.appsSettings({}, MOVE_MV['apps-saved'].state, STATES['home-move-apps-done'].move.reinstall), null);
  // 깐 뒤 설정을 되돌리기 전에 앱이 끝났으면(적힌 깔기가 적힌 설정보다 뒤) 고르는 화면에서 알리고, 깔지 못한 것도 함께 쓴다
  const un = draw('move-apps', read, MOVE_MV['apps-unrestored']).html;
  assert.match(un, /지난번에 깐 프로그램의 설정을 아직 되돌리지 않았습니다[\s\S]*깔지 못한 1개의 까닭은 목록의 줄마다 적었습니다/); assert.doesNotMatch(un, /마친 결과입니다/);
  // Fable F4 — 그때는 「설정만 되돌리기」가 채운 단추이고, 깔기는 선 단추다
  assert.match(un, /class="pill main" type="button" data-act="apps-restore">설정만 되돌리기/); assert.doesNotMatch(un, /class="pill main" type="button" data-act="apps-go"/);
  assert.equal((un.match(/data-act="apps-restore"/g) || []).length, 1);
  assert.equal(m.appsUnrestored(MOVE_MV['apps-saved'].apps, MOVE_MV['apps-saved'].state, m.appsJob(read, MOVE_MV['apps-saved'].state)), false);
  // 이 창이 지켜본 깔기가 엔진에 적힌 것보다 먼저다
  assert.equal(m.appsJob(STATES['home-move-apps-done'], MOVE_MV['apps-saved'].state), STATES['home-move-apps-done'].move.reinstall);
  assert.equal(m.appsJob(read, MOVE_MV['apps-saved'].state).saved, true); assert.equal(m.appsJob(read, null), null);
  // E23 — 확인 창 10분 초과는 따로 쓰고 「다시 누르면 확인 창이 다시 뜬다」고 한다. 사용자용 시간 초과도 시간 초과다
  assert.match(m.appResult({ id: 'a', state: 'approval-timeout' }).text, /확인 창이 닫혀 깔지 않았습니다/);
  assert.match(m.appResult({ id: 'a', state: 'approval-timeout' }).why, /10분 안에 누르지 않아 닫혔습니다/);
  assert.equal(m.appsOutcome(STATES['home-move-apps-late'].move.reinstall).declined, true);
  const lt = draw('move-apps', STATES['home-move-apps-late'], MOVE_MV['apps-late']).html;
  assert.match(lt, /지난번에 4개를 깔지 못했습니다\.<\/b>관리자 확인을 받지 못한 프로그램은 다시 누르면/);
  assert.match(lt, /지난번 깔기 · 확인 창이 닫혀 깔지 않았습니다\. 확인 창을 10분 안에/); assert.match(lt, /지난번 깔기 · 시간이 지나 끝내지 못했습니다/);
  // E21 — 꾸러미 없음, 규칙 판이 달라 앱 설정을 쓰지 않음, 이 PC에 깔린 목록을 못 읽음, 목록을 담은 때
  assert.match(draw('move-apps', read, MOVE_MV['apps-nokit']).html, /옛 PC의 프로그램 목록이 백업에 없습니다/);
  const ro = draw('move-apps', read, MOVE_MV['apps-rulesold']).html;
  // Fable F5 — 「앱」이 두 뜻이던 글을 업무 백업의 이름으로 부른다
  assert.match(ro, /프로그램 설정은 되돌리지 않습니다/); assert.doesNotMatch(ro, /옛 PC의 앱이/);
  assert.match(ro, /data-act="apps-go">고른 6개 깔기</); assert.doesNotMatch(ro, /data-act="apps-restore"/);
  // Fable FA4 — 깐 프로그램의 설정은 「프로그램 설정」, 업무 백업은 이름으로 — 같은 화면에서 「앱 설정」 · 「이 앱」을 쓰지 않는다
  for (const k of ['apps-pick', 'apps-empty', 'apps-open', 'apps-result', 'apps-nokit', 'apps-rulesold']) {
    const html = draw('move-apps', k === 'apps-result' ? STATES['home-move-apps-done'] : read, MOVE_MV[k]).html.replace(/<[^>]+>/g, ' ');
    assert.doesNotMatch(html, /앱 설정|이 앱|앱 \d+개의 설정|앱마다/, k);
  }
  assert.match(draw('move-apps', STATES['home-move-apps-done'], MOVE_MV['apps-result']).html, /프로그램 6개의 설정을 살폈습니다\. 프로그램마다 무엇을 되돌렸는지/);
  const none = Object.fromEntries(MOVE_APPS.list.table.map((p) => [p.id, false]));
  const ro0 = draw('move-apps', read, { ...MOVE_MV['apps-rulesold'], apps: { ...MOVE_MV['apps-rulesold'].apps, picks: none } }).html;
  assert.doesNotMatch(ro0, /data-act="apps-go"/); assert.match(ro0, /class="pill main" type="button" data-act="apps-later">다음 · 백업 켜기/);
  // 카본 A1 — rules-old면 빈 목록 · 깔는 중 · 결과 · 다시 켠 뒤 안내가 모두 「설정을 되돌리지 않는다」고 한다
  const roEmpty = draw('move-apps', read, { ...MOVE_MV['apps-empty'], apps: { ...MOVE_MV['apps-empty'].apps, list: { ...MOVE_APPS.empty, kitProblems: ['rules-old'] } } }).html;
  assert.match(roEmpty, /옛 PC의 업무 백업이 이 PC와 다른 판이라 프로그램 설정도 되돌리지 않습니다/); assert.doesNotMatch(roEmpty, /그대로 되돌릴 수 있습니다/); assert.doesNotMatch(roEmpty, /data-act="apps-go"/);
  const roApps = { ...MOVE_MV['apps-rulesold'].apps, ran: MOVE_APPS.list.machine.concat(MOVE_APPS.list.user) };
  const roRun = draw('move-apps', STATES['home-move-apps-user'], { ...MOVE_MV['apps-rulesold'], apps: roApps }).html;
  assert.match(roRun, /프로그램 설정은 되돌리지 않습니다/); assert.doesNotMatch(roRun, /설정을 저절로 되돌립니다/);
  const rbJob = { ...STATES['home-move-apps-done'], move: { reinstall: { ...STATES['home-move-apps-done'].move.reinstall, results: [{ id: 'Git.Git', name: 'Git', state: 'reboot', scope: 'machine', listed: false }] }, progress: null } };
  const roRes = draw('move-apps', rbJob, { ...MOVE_MV['apps-rulesold'], apps: { ...roApps, settings: [] } }).html;
  assert.match(roRes, /옛 PC의 업무 백업이 이 PC와 다른 판이라 프로그램 설정은 되돌리지 않았습니다/); assert.doesNotMatch(roRes, /data-act="apps-restore"/); assert.doesNotMatch(roRes, /「설정만 되돌리기」를 누르면/);
  // 카본 A2 — 되돌리지 않은 설정과 깔지 못한 것을 함께 쓸 때 문장이 겹치지 않는다
  const unDecl = { ...MOVE_MV['apps-unrestored'], state: { ...MOVE_MV['apps-unrestored'].state, reinstall: { ...MOVE_MV['apps-unrestored'].state.reinstall, results: MOVE_APPS.late } } };
  assert.match(draw('move-apps', read, unDecl).html, /깔지 못한 4개의 까닭은 목록의 줄마다 적었습니다\. 관리자 확인을 받지 못한 프로그램은 다시 누르면/);
  const uk = draw('move-apps', read, MOVE_MV['apps-unknown']).html;
  assert.match(uk, /이 PC에 깔린 프로그램 목록을 읽지 못했습니다/); assert.match(uk, /data-act="apps-reload"[^>]*>목록 다시 읽기/);
  assert.doesNotMatch(pk.html, /깔린 프로그램 목록을 읽지 못했습니다/);
  assert.match(pk.html, /옛 PC가 오후 1:02에 담은 목록입니다/);
  // E22 — 깔린 목록을 못 읽어 설정 되돌리기가 거절됨
  assert.match(failureText('REINSTALL_LIST_FAILED'), /깔린 프로그램 목록을 읽지 못했습니다\. 잠시 뒤 다시 눌러 주세요/);
  const lf = { ...MOVE_MV['apps-result'], apps: { ...MOVE_MV['apps-result'].apps, settings: undefined, settingsError: 'REINSTALL_LIST_FAILED' } };
  assert.match(draw('move-apps', STATES['home-move-apps-done'], lf).html, /설정을<br><span class="soft">되돌리지 못했습니다[\s\S]*이 PC에 깔린 프로그램 목록을 읽지 못했습니다/);
  // E16 — 펼친 표의 프로그램은 공식 · 사용권 페이지를 연다. 표 밖 프로그램의 주소(winget이 준 값)는 열지 않는다. 접어 두면 단추도 없다
  const op = draw('move-apps', read, MOVE_MV['apps-open']).html;
  assert.match(op, /data-act="app-page" data-app="Git\.Git" data-kind="site" aria-label="Git 공식 페이지 열기">공식 페이지 열기/);
  assert.match(op, /data-act="app-page" data-app="Git\.Git" data-kind="license" aria-label="Git 사용권 열기">사용권 열기/);
  assert.doesNotMatch(op, /data-app="VideoLAN\.VLC" data-kind/);
  assert.doesNotMatch(pk.html, /data-act="app-page"/);
});

test('옮겨 오기 E25(조율 세션 178555524): 100만 개 넘는 폴더는 그 폴더만 옮기지 않고 나머지를 옮겨 온다', async () => {
  const m = await load('screen-model.js');
  const { renderScreen } = await load('screen-view.js');
  const { STATES, NOW, MOVE_MV, MOVE_ACCT } = await load('engine-fixtures.js');
  const draw = (id, state, mv) => renderScreen(id, { state, model: m.homeModel(state, { now: NOW, move: mv?.state || null }), now: NOW, ui: {}, acct: { ...MOVE_ACCT }, mv, fake: true });
  const read = STATES['home-move-read'], big = MOVE_MV.toobig, res = MOVE_MV.toobigResult;
  // 놓을 자리 — 그 폴더는 손님이 고른 자리가 있어도 「옮기지 않음」이고, 수와 크기에 들지 않는다. 바꾸는 단추도 없다
  const rows = m.moveRows(big.preview, big.choices, big.first);
  const pic = rows.rows.find((r) => r.label === '사진');
  assert.equal(pic.tooBig, true); assert.equal(pic.place.kind, 'skip'); assert.equal(pic.files, 0); assert.deepEqual(pic.modes, []);
  assert.equal(rows.big.length, 1); assert.equal(rows.places, 4);
  assert.equal(rows.files, rows.rows.filter((r) => r.label !== '사진').reduce((n, r) => n + r.files, 0));
  const one = draw('move-1', read, big).html;
  assert.match(one, /「사진」 폴더는 옮겨 오지 못합니다\.<\/b>파일과 폴더가 100만 개를 넘는 폴더라 옮기지 않고, 나머지 폴더만 옮겨 옵니다/);
  // 카본 A2 — 모든 폴더가 너무 크면 「나머지 폴더만」이라 하지 않는다
  const allBig = { ...big, preview: { ...big.preview, folders: big.preview.folders.map((x) => ({ ...x, tooBig: true, mode: 'skip', modes: ['skip'], files: 0, bytes: 0 })) } };
  assert.match(draw('move-1', read, allBig).html, /옮겨 올 수 있는 폴더가 없습니다/); assert.doesNotMatch(draw('move-1', read, allBig).html, /나머지 폴더만/);
  assert.match(one, /<span class="nm">사진<\/span><span class="vl"><\/span><span class="ds">너무 커서 옮기지 않음<\/span>/);
  assert.doesNotMatch(one, /data-folder="[^"]*Pictures"/); assert.doesNotMatch(one, /파일 되살리기로|「파일 되살리기」로 꺼/);
  assert.match(draw('move-1', read, { ...big, open: true }).html, /data-act="move-mode" data-folder="C:\\Users\\studio\\Documents"/);
  assert.doesNotMatch(draw('move-1', read, { ...big, open: true }).html, /data-act="move-mode" data-folder="C:\\Users\\studio\\Pictures"/);
  // 모든 폴더가 너무 크면 「옮기지 않음을 풀어 주세요」가 아니다
  const all = { ...big, preview: { ...big.preview, folders: big.preview.folders.map((x) => ({ ...x, tooBig: true, mode: 'skip', modes: ['skip'], files: 0, bytes: 0 })) } };
  assert.match(draw('move-1', read, all).html, /모든 폴더가 너무 커서 옮겨 올 폴더가 없습니다/); assert.doesNotMatch(draw('move-1', read, all).html, /풀어 주세요/);
  // 확인서 — 폴더 단위로 따로 묶고, 「N개는 옮겨 오지 못했습니다」의 파일 수에 섞지 않는다. 「다시 옮겨 오기」를 권하지 않는다
  const left = m.moveLeft(res.result);
  assert.equal(left.big, 1); assert.equal(left.failed, 0); assert.equal(left.n, 0);
  const t = m.moveTitle(res.result);
  assert.equal(t.main, '옮겨 왔습니다.'); assert.equal(t.soft, '「사진」 폴더는 너무 커서 옮기지 않았습니다.'); assert.equal(t.tone, 'warn');
  const three = draw('move-3', read, res).html;
  // 폴더는 「곳」으로 센다
  assert.match(three, /너무 커서 옮기지 않은 폴더<\/span><span class="vl"><span class="x">1곳<\/span>/); assert.match(three, /옛 PC의 백업에는 그대로 있습니다\. 「옛 PC 백업에서 꺼내기」에서 안쪽 폴더를 골라 통째로 꺼낼 수 있습니다\. 옛 PC를 정리하기 전에 그 화면에 한 번 들어가, 꺼낼 수 없다고 나오는 것이 없는지 확인해 주세요\./);
  assert.match(three, /<span class="ds">C:\\Users\\studio\\Pictures<\/span>/);
  assert.doesNotMatch(three, /data-act="move-again"/); assert.doesNotMatch(three, /파일 되살리기로/);
  // 넘기기 — 그 폴더는 지킬 폴더에 없고(엔진이 roots []를 준다), 옛 PC의 백업에 남는다고 쓴다
  const four = draw('move-4', read, res).html;
  assert.match(four, /「사진」 폴더는 너무 커서 옮기지 않았습니다\. 「작업 노트북」의 백업에는 그대로 있습니다\. 「옛 PC 백업에서 꺼내기」에서 안쪽 폴더를 골라 통째로 꺼낼 수 있습니다\. 「작업 노트북」을 정리하기 전에 그 화면에 한 번 들어가, 꺼낼 수 없다고 나오는 것이 없는지 확인해 주세요\. 넘긴 뒤에도 「파일 되살리기」 화면의 「옛 PC 백업에서 꺼내기」 단추로 다시 들어올 수 있습니다\./);
  assert.doesNotMatch(four, /data-root="C:\\Users\\studio\\Pictures"/);
  // Fable F1 — 항목이 2,000개를 넘어 폴더 항목이 잘려도 묶음은 결과의 폴더 목록으로 만든다(「이상」을 붙이지 않는다)
  const cut = { ...res, result: { ...res.result, items: Array.from({ length: 2000 }, (_, i) => ({ original: 'C:\\Users\\studio\\Documents', name: `f${i}`, result: 'side', p: `x${i}` })) } };
  const cutG = m.moveGroups(cut.result).list.find((g) => g.key === 'toobig');
  assert.equal(cutG.n, 1); assert.equal(cutG.exact, true); assert.deepEqual(cutG.examples, ['C:\\Users\\studio\\Pictures']);
  const cut3 = draw('move-3', read, cut).html;
  // Fable -b FA1 — 정확히 센 폴더 묶음만 있으면 「앞의 2,000개 안에서 센 것」이라는 아래 글을 붙이지 않는다
  assert.doesNotMatch(cut3, /앞의 2,000개만 남겼습니다/);
  const cutMixed = { ...cut, result: { ...cut.result, items: cut.result.items.map((x, i) => (i < 5 ? { ...x, result: 'fail', c: 'MOVE_BUSY' } : x)) } };
  assert.match(draw('move-3', read, cutMixed).html, /앞의 2,000개만 남겼습니다\. 파일 수는 그 안에서 센 것입니다/);
  assert.match(cut3, /너무 커서 옮기지 않은 폴더<\/span><span class="vl"><span class="x">1곳<\/span>/); assert.match(cut3, /<span class="ds">C:\\Users\\studio\\Pictures<\/span>/);
  // Fable F5 — 옛 PC를 쓸 수 있을 때의 조건문을 붙인다(그 폴더는 「파일 되살리기」로 꺼낼 수 없다 — 이 PC의 최신 판만 열고 20만 개까지, E26)
  // E27(조율 세션 ced52da00) — 안쪽 폴더를 골라 통째로 꺼낼 수 있게 되어, 옛 PC를 정리하기 전에 직접 옮겨 두라는 말을 거둔다
  for (const html of [one, three, four]) { assert.doesNotMatch(html, /USB나 외장 디스크|직접 옮겨 두세요|폴더를 통째로 꺼내는 길은 아직 없습니다/); }
  assert.match(one, /옮겨 온 뒤 「옛 PC 백업에서 꺼내기」에서 안쪽 폴더를 골라 통째로 꺼낼 수 있습니다\. 옛 PC를 정리하기 전에 그 화면에 한 번 들어가/);
  // E26 — 옛 PC의 판에는 남지만 「파일 되살리기」는 이 PC의 최신 판만 연다. 네 자리 모두 지금은 꺼낼 수 없다고 함께 밝힌다
  for (const html of [one, three, four]) { assert.match(html, /「옛 PC 백업에서 꺼내기」/); assert.doesNotMatch(html, /지금은 이 앱으로 꺼낼 수 없습니다/); }
  // 확인서와 넘기기에는 꺼내는 단추가 있다(놓을 자리는 옮겨 오기 전이라 없다)
  for (const html of [three, four]) assert.match(html, /data-act="old-start"/); assert.doesNotMatch(one, /data-act="old-start"/);
  // Fable E26 F2 — 놓을 자리에서 그 말은 위 상자에 한 번만 나온다(폴더 줄은 까닭만)
  assert.equal(m.TOO_BIG_WHY, '파일과 폴더가 100만 개를 넘는 폴더라 옮겨 오지 못합니다.');
  assert.equal(one.split('「옛 PC 백업에서 꺼내기」').length - 1, 1);
  // Fable E26 F1 — 넘기기 전 기본 화면도 그 폴더를 밝히고 지금은 꺼낼 수 없다고 쓴다. 결과를 아직 안 읽었으면 결과로 보내는 글만 쓴다
  const homeDone = (result) => m.homeModel(read, { now: NOW, move: res.state, result });
  assert.equal(homeDone(res.result).id, 'home-move-done');
  assert.equal(homeDone(res.result).sub, '「사진」 폴더는 너무 커서 옮기지 않았습니다. 옛 PC의 백업에는 그대로 있습니다. 「옛 PC 백업에서 꺼내기」에서 안쪽 폴더를 골라 통째로 꺼낼 수 있습니다. 옛 PC를 정리하기 전에 그 화면에 한 번 들어가, 꺼낼 수 없다고 나오는 것이 없는지 확인해 주세요. 결과를 본 뒤 이 PC로 이어서 백업하세요.');
  assert.equal(homeDone(null).sub, '옮긴 것과 옮기지 않은 것을 결과에서 본 뒤 이 PC로 이어서 백업하세요.');
  // Opus -b 1 — 큰 폴더와 옮기지 못한 파일이 섞이면 둘 다 말한다(확인서의 큰 글과 같은 셈)
  const mixed = { ...res.result, counts: { ...res.result.counts, fail: 1 }, items: [...res.result.items, { original: 'C:\\Users\\studio\\Documents', name: 'a.txt', result: 'fail', c: 'MOVE_BUSY' }] };
  assert.equal(m.moveLeft(mixed).failed, 1); assert.equal(m.moveLeft(mixed).big, 1);
  assert.equal(homeDone(mixed).sub, '1개는 옮겨 오지 못했습니다. 「사진」 폴더는 너무 커서 옮기지 않았습니다. 옛 PC의 백업에는 그대로 있습니다. 「옛 PC 백업에서 꺼내기」에서 안쪽 폴더를 골라 통째로 꺼낼 수 있습니다. 옛 PC를 정리하기 전에 그 화면에 한 번 들어가, 꺼낼 수 없다고 나오는 것이 없는지 확인해 주세요. 결과를 본 뒤 이 PC로 이어서 백업하세요.');
  // Opus -b 2 — 연결 건너뜀만 남은 흔한 결과(complete 거짓)는 확인서처럼 못했다고 단정하지 않는다
  const linksOnly = { ...res.result, items: res.result.items.filter((x) => x.result !== 'folder-skip'), folders: res.result.folders.map((x) => ({ ...x, tooBig: undefined })) };
  assert.equal(m.moveLeft(linksOnly).n, 0); assert.equal(m.moveLeft(linksOnly).big, 0); assert.equal(m.moveTitle(linksOnly).tone, 'ok');
  assert.equal(homeDone(linksOnly).sub, '옮긴 것과 옮기지 않은 것을 결과에서 본 뒤 이 PC로 이어서 백업하세요.');
  assert.equal(homeDone(linksOnly).title, '옮겨 왔습니다.'); assert.equal(homeDone(null).title, '옮겨 왔습니다.');
  // Opus -c 참고 — 놓은 파일 없이 실패만 있으면 제목도 확인서처럼 「옮겨 오지 못했습니다.」
  const noneHere = { ...linksOnly, counts: { fail: 2, skip: 4 }, items: [0, 1].map((i) => ({ original: 'C:\\Users\\studio\\Documents', name: `f${i}.txt`, result: 'fail', c: 'MOVE_BUSY' })) };
  assert.equal(m.moveTitle(noneHere).main, '옮겨 오지 못했습니다.');
  // Opus -d 1 — 제목이 「옮겨 오지 못했습니다.」이면 아래 글은 「N개는」으로 대조하지 않고 확인서처럼 잇는다
  assert.equal(homeDone(noneHere).title, '옮겨 오지 못했습니다.'); assert.equal(homeDone(noneHere).sub, '이 PC에 놓은 파일이 없습니다. 결과를 본 뒤 이 PC로 이어서 백업하세요.');
  // Opus -d 2 — 시험 자료의 경로가 진짜 경로로 읽힌다
  assert.equal(noneHere.items[0].original, ['C:', 'Users', 'studio', 'Documents'].join(String.fromCharCode(92)));
  // 모든 폴더가 너무 커서 놓은 파일이 없으면 제목은 「옮겨 온 파일이 없습니다.」, 글은 큰 폴더를 말한다
  const allBigRes = { ...res.result, counts: { 'folder-skip': res.result.folders.length }, items: [], folders: res.result.folders.map((x) => ({ ...x, mode: 'skip', roots: [], tooBig: true })) };
  assert.equal(homeDone(allBigRes).title, '옮겨 온 파일이 없습니다.');
  // Opus -e 참고 — 놓은 파일도 실패도 큰 폴더도 없으면 「옮긴 것과」로 잇지 않는다
  // 놓은 파일이 0인 결과답게 항목은 연결 건너뜀 넷만 두고 놓은 자리는 비운다(Opus -f 참고)
  const nothing = { ...linksOnly, counts: { skip: 4 }, items: linksOnly.items.filter((x) => x.result === 'skip'), folders: linksOnly.folders.map((x) => ({ ...x, roots: [] })) };
  assert.equal(nothing.items.length, 4); assert.ok(nothing.folders.every((x) => x.roots.length === 0));
  assert.equal(m.moveTitle(nothing).main, '옮겨 온 파일이 없습니다.'); assert.equal(m.moveLeft(nothing).n, 0); assert.equal(m.moveLeft(nothing).big, 0);
  assert.equal(homeDone(nothing).title, '옮겨 온 파일이 없습니다.'); assert.equal(homeDone(nothing).sub, '옮기지 않은 까닭을 결과에서 본 뒤 이 PC로 이어서 백업하세요.');
  assert.match(homeDone(allBigRes).sub, /^「[^」]+」 등 폴더 \d+곳은 너무 커서 옮기지 않았습니다\. 옛 PC의 백업에는 그대로 있습니다\. 「옛 PC 백업에서 꺼내기」에서 안쪽 폴더를 골라 통째로 꺼낼 수 있습니다\. 옛 PC를 정리하기 전에 그 화면에 한 번 들어가, 꺼낼 수 없다고 나오는 것이 없는지 확인해 주세요\. 결과를 본 뒤 이 PC로 이어서 백업하세요\.$/);
  for (const r of [res.result, null]) assert.doesNotMatch(homeDone(r).sub, /옛 PC 백업에 그대로 있습니다/);
  // Fable F3 — 예시의 공간과 합계가 남은 폴더의 합이다
  assert.equal(big.preview.volumes[0].bytes, big.preview.bytes); assert.equal(big.preview.files, rows.files);
  // 폴더 묶음의 주어 말 — 셋 이상이어도 「외 2곳 폴더는」처럼 단위가 겹치지 않는다(카본 A1)
  assert.equal(m.folderSubjectKo([{ label: '사진' }]), '「사진」 폴더');
  assert.equal(m.folderSubjectKo([{ label: '사진' }, { label: '영상' }]), '「사진」과 「영상」 폴더');
  assert.equal(m.folderSubjectKo([{ label: '문서' }, { label: '사진' }, { label: '영상' }]), '「문서」 등 폴더 3곳');
  const three3 = { ...res, result: { ...res.result, folders: res.result.folders.map((x) => ({ ...x, mode: 'skip', roots: [], tooBig: true })) } };
  assert.match(m.moveTitle(three3.result).soft, /^「문서」 등 폴더 4곳은 너무 커서 옮기지 않았습니다\.$/);
  assert.doesNotMatch(draw('move-4', read, three3).html, /곳 폴더/);
});

test('옛 PC 백업에서 꺼내기(조율 세션 793e0d6dc): 옛 PC 판의 폴더를 한 층씩 골라 그 범위로 목록을 연다', async () => {
  const m = await load('screen-model.js');
  const { renderScreen, SCREENS } = await load('screen-view.js');
  const { STATES, NOW, MOVE_MV, MOVE_ACCT, OLD_PC, OLD_CATALOG } = await load('engine-fixtures.js');
  const read = STATES['home-move-read'], res = MOVE_MV.toobigResult;
  const draw = (id, extra = {}) => renderScreen(id, { state: read, model: m.homeModel(read, { now: NOW, move: res.state, result: res.result }), now: NOW, ui: {}, acct: { ...MOVE_ACCT }, mv: res, fake: true, ...extra });
  assert.ok(SCREENS.includes('restore-old'));
  // 첫 목록은 옮겨 온 결과의 폴더 — 너무 커서 옮기지 않은 폴더가 앞이다
  const folders = m.oldFolders(res.result);
  assert.equal(folders[0].label, '사진'); assert.equal(folders[0].tooBig, true); assert.ok(folders.slice(1).every((f) => !f.tooBig));
  // Opus 대체 검수 F1 — 손님이 「옮기지 않음」으로 고른 폴더(mode skip)는 「옮겨 옴」이 아니고, 옮긴 폴더보다 앞이다
  const skipped = { ...res.result, folders: res.result.folders.map((f) => (f.label === '바탕화면' ? { ...f, mode: 'skip', roots: [] } : f)) };
  assert.deepEqual(m.oldFolders(skipped).map((f) => [f.label, f.tooBig, f.skip]).slice(0, 2), [['사진', true, false], ['바탕화면', false, true]]);
  assert.match(draw('restore-old', { mv: { ...res, result: skipped }, old: OLD_PC.root }).html, /<span class="nm">바탕화면<\/span><span class="vl">옮기지 않음<\/span>/);
  assert.equal(m.oldWhere('사진', '2024/여행'), '「사진 › 2024 › 여행」'); assert.equal(m.oldWhere('사진', ''), '「사진」');
  assert.equal(m.oldUp('2024/여행'), '2024'); assert.equal(m.oldUp('2024'), '');
  // 거절 글 — 한 층 읽기의 CATALOG_TOO_LARGE는 안쪽 목록을 읽을 수 없는 층, 목록 열기의 것은 통째로 꺼내거나 안쪽 폴더로 나눠 열라는 뜻이다
  assert.equal(m.oldFailText('CATALOG_TOO_LARGE', '작업 노트북'), m.OLD_NO_SPLIT);
  assert.match(m.oldFailText('CATALOG_TOO_LARGE', '작업 노트북', { open: true }), /통째로 꺼내거나, 안쪽 폴더를 골라 나눠 열어 주세요/);
  assert.match(m.oldFailText('UNSAFE_MANIFEST', '작업 노트북', { open: true }), /통째로 꺼내면 그런 이름의 파일과 폴더는 그 안까지 빼고 나머지를 꺼냅니다/);
  assert.match(m.oldFailText('NO_SNAPSHOT', '작업 노트북'), /^「작업 노트북」의 확인된 백업이 없어/);
  assert.match(m.oldFailText('INVALID_REQUEST', '작업 노트북'), /처음부터 다시 골라 주세요/);
  assert.equal(m.oldFailText('JOB_BUSY', '작업 노트북'), null);
  // 첫 화면 — 폴더 고르기
  const root = draw('restore-old', { old: OLD_PC.root });
  assert.match(root.html, /어느 폴더에서/); assert.match(root.html, /data-act="old-folder" data-folder="C:\\Users\\studio\\Pictures"/);
  assert.match(root.html, /너무 커서 옮기지 않음/); assert.equal(root.here, '옛 PC 백업에서 꺼내기');
  assert.match(renderScreen('restore-old', { state: read, model: m.homeModel(read, { now: NOW }), now: NOW, ui: {}, acct: { ...MOVE_ACCT }, mv: { ...res, result: undefined }, old: OLD_PC.root, fake: true }).html, /읽고 있습니다/);
  // 한 층 — 바로 아래 폴더와 파일 수
  const b = draw('restore-old', { old: OLD_PC.browse });
  for (const n of ['2023', '2024', '2025', '카메라 원본']) assert.match(b.html, new RegExp(`data-act="old-in" data-name="${n}"`));
  assert.match(b.html, /바로 안의 파일은 <b class="num">12<\/b>개입니다/);
  // E27 — 주 단추는 「이 폴더 통째로 꺼내기」(restoreScope), 파일을 고르는 길은 「파일 골라 꺼내기」. 안쪽 층(「사진 › 2025」)에서 본다 — 맨 위 「사진」은 100만 개가 넘는다
  const inner = draw('restore-old', { old: { ...OLD_PC.browse, sub: '2025' } });
  assert.match(inner.html, /<button class="pill main" type="button" data-act="old-whole">이 폴더 통째로 꺼내기/); assert.match(inner.html, /data-act="old-open">파일 골라 꺼내기/);
  assert.equal(inner.acts['old-whole'].call, 'restoreScope'); assert.match(b.html, /다른 폴더 고르기/); assert.equal(b.back, 'restore-old'); assert.equal(root.back, 'home');
  assert.match(inner.html, /어떻게 꺼낼까요/); assert.match(inner.html, /누르면 다운로드 안의 「되살린 파일 \(\d+월 \d+일\)」 폴더에 바로 놓습니다/); assert.match(inner.html, /data-act="place-pick"/);
  // 안쪽 층 — 「한 칸 위로」, 뺀 폴더
  const d = draw('restore-old', { old: OLD_PC.deep });
  assert.match(d.html, /「사진 › 2024」/); assert.match(d.html, /한 칸 위로/); assert.match(d.html, /Windows에 둘 수 없는 이름의 폴더 1곳은 열 수 없어 뺐습니다/); assert.equal(d.back, 'restore-old');
  // Opus 대체 검수 F3 — 뺀 이름이 있는 층은 목록으로 열면 반드시 거절되므로 파일을 골라 꺼내지 않는다. E27 — 통째로는 그런 이름만 빼고 꺼낸다
  assert.match(d.html, /data-act="old-open" aria-disabled="true"/); assert.match(d.html, /이 층은 파일을 골라 꺼낼 수 없습니다\. 통째로 꺼내면 그런 이름의 폴더와 그 안의 파일은 빼고 나머지를 꺼냅니다/);
  assert.doesNotMatch(d.html, /data-act="old-whole" aria-disabled/); assert.doesNotMatch(d.html, /이 앱으로 꺼낼 수 없습니다|직접 옮겨 두세요/);
  // 고를 안쪽 폴더가 없는 그런 층도 통째로는 꺼낸다 — 막다른 곳이 아니다
  const dead = draw('restore-old', { old: { ...OLD_PC.deep, level: { ...OLD_PC.deep.level, folders: [], files: 40 } } });
  assert.doesNotMatch(dead.html, /data-act="old-whole" aria-disabled/); assert.doesNotMatch(dead.html, /안쪽 폴더만 필요하면/); assert.match(dead.html, /어떻게 꺼낼까요/);
  // Opus 대체 검수 F7 — 좁은 창에서는 목록이 글 아래라 「오른쪽에서」라고 쓰지 않는다
  assert.doesNotMatch(b.html, /오른쪽에서/); assert.match(b.html, /「안쪽 폴더」 목록에서/);
  // 읽는 중에는 열지도, 통째로 꺼내지도 않는다
  const reading = draw('restore-old', { old: { ...OLD_PC.reading, sub: '2025' } }).html;
  assert.match(reading, /data-act="old-open" aria-disabled="true"/); assert.match(reading, /data-act="old-whole" aria-disabled="true"/);
  // Fable F4 — 막힌 동안에는 꺼내는 법 · 놓을 자리 안내를 그리지 않고 그 상태를 말한다
  assert.match(reading, /안쪽 폴더를 읽고 있습니다\. 다 읽으면 꺼낼 수 있습니다/); assert.doesNotMatch(reading, /바로 놓습니다|data-act="place-pick"|「이 폴더 통째로 꺼내기」는 안의/);
  const staleHtml = draw('restore-old', { old: OLD_PC.stale }).html;
  assert.match(staleHtml, /이 층을 읽지 못해 지금은 꺼낼 수 없습니다/); assert.doesNotMatch(staleHtml, /바로 놓습니다|data-act="place-pick"/);
  // Fable -b 1 — 단추가 도는 동안에도 놓을 자리 안내는 남고, 「자리 바꾸기」만 막힌다
  const busyInner = draw('restore-old', { old: { ...OLD_PC.browse, sub: '2025' }, acct: { ...MOVE_ACCT, running: 'old-whole' } }).html;
  assert.match(busyInner, /바로 놓습니다/); assert.match(busyInner, /data-act="place-pick" aria-disabled="true"/); assert.match(busyInner, /data-act="old-whole" aria-disabled="true"/);
  // Fable -b 2 — 기기 이름을 모르면 「옛 PC」로 부른다
  assert.equal(m.tooBigKept('이름을 알 수 없는 PC'), m.tooBigKept());
  assert.match(m.tooBigKept(), /^옛 PC의 백업에는 그대로 있습니다\..* 옛 PC를 정리하기 전에/); assert.match(m.tooBigKept('작업 노트북'), / 「작업 노트북」을 정리하기 전에/);
  // 안쪽 목록을 읽을 수 없는 층 — 목록으로는 열지 않고 통째로 꺼내게 한다. 100만 개를 넘을 때만 직접 옮기라는 말이 한 번 나온다
  const ns = draw('restore-old', { old: OLD_PC.noSplit });
  assert.match(ns.html, /안쪽 폴더를 보여 드릴 수 없습니다/); assert.match(ns.html, /data-act="old-open" aria-disabled="true"/); assert.doesNotMatch(ns.html, /data-act="old-whole" aria-disabled/);
  assert.equal(ns.html.split('USB나 외장 디스크').length - 1, 1); assert.doesNotMatch(ns.html, /이 앱으로는 꺼낼 수 없습니다/);
  // 너무 커서 옮기지 않은 폴더(100만 개 넘음)의 맨 위 층은 통째로 꺼낼 수 없다 — 안쪽 폴더를 고르게 한다. 안쪽 층에서는 된다
  const bigTop = b;
  assert.match(bigTop.html, /data-act="old-whole" aria-disabled="true"/); assert.match(bigTop.html, /data-act="old-open" aria-disabled="true"/);
  // 그 층 바로 안의 파일(12개)은 어느 길로도 꺼낼 수 없다 — 그때만 직접 옮겨 두라고 쓴다. 바로 안에 파일이 없으면 그 말이 없다
  assert.match(bigTop.html, /바로 안의 파일 12개는 이 앱으로 꺼낼 수 없으니, 옛 PC를 아직 쓸 수 있으면 정리하기 전에 직접 옮겨 두세요/);
  assert.doesNotMatch(draw('restore-old', { old: { ...OLD_PC.browse, level: { ...OLD_PC.browse.level, files: 0 } } }).html, /직접 옮겨 두세요/); assert.match(bigTop.html, /100만 개를 넘어 통째로도, 목록으로도 꺼낼 수 없습니다\. 「안쪽 폴더」 목록에서 안쪽 폴더를 골라/);
  assert.doesNotMatch(d.html, /data-act="old-whole" aria-disabled/);
  // 통째로 꺼내기의 거절 글(부르는 자리와 끝난 실패 칸에 함께 쓴다)
  assert.match(m.scopeFailText('CATALOG_TOO_LARGE'), /100만 개를 넘어 통째로 꺼낼 수 없습니다\. 안쪽 폴더를 골라 주세요/);
  // 카본 A2 — 엔진이 거절하는 자리를 모두 말한다(지키는 폴더 · 저장소 · 옛 PC가 백업하던 폴더와 그 안 · 위)
  assert.equal(m.scopeFailText('OUTPUT_UNSAFE'), '놓을 자리가 이 PC가 지키는 폴더나 백업을 담는 폴더, 또는 옛 PC가 백업하던 폴더와 겹칩니다. 그 폴더들의 안이나 위 폴더에는 놓을 수 없으니 다른 폴더를 골라 주세요.');
  assert.equal(m.scopeFailText('NO_SPACE'), null);
  // 카본 A3 — 한 층의 놓을 자리 안내도 범위 목록과 같이 위 폴더까지 말한다
  assert.match(inner.html, /옛 PC가 백업하던 폴더와 그 안, 그 폴더들이 든 위 폴더에는 놓을 수 없습니다/);
  // 카본 A1 — 100만 개 넘는 폴더의 맨 위 층이 안쪽 목록도 못 읽으면 막힌 「통째로 꺼내기」를 권하지 않고 직접 옮겨 두라고 쓴다
  const stuck = draw('restore-old', { old: { ...OLD_PC.noSplit, sub: '' } }).html;
  assert.match(stuck, /<span class="soft">이 앱으로는 꺼낼 수 없습니다\.<\/span>/); assert.match(stuck, /data-act="old-whole" aria-disabled="true"/);
  assert.doesNotMatch(stuck, /「이 폴더 통째로 꺼내기」로 꺼내 주세요/); assert.equal(stuck.split('직접 옮겨 두세요').length - 1, 1);
  // 맨 위 층을 읽지 못했으면(고를 안쪽 목록이 없음) 그 목록에서 고르라고 하지 않는다
  const topFail = draw('restore-old', { old: { ...OLD_PC.browse, level: null, code: 'OPERATION_FAILED', error: 'x' } }).html;
  assert.doesNotMatch(topFail, /목록에서 안쪽 폴더를 골라/); assert.match(topFail, /data-act="old-reload"/);
  // 판이 바뀌어 고른 자리가 없음 — 처음부터
  assert.match(draw('restore-old', { old: OLD_PC.stale }).html, /data-act="old-top"/);
  // 범위로 연 목록 — 꺼내기만 있고 「전체 되살리기」는 없다
  const c = draw('restore', { catalog: OLD_CATALOG.ok });
  assert.match(c.html, /무엇을 꺼낼까요/); assert.match(c.html, /「사진 › 2024 › 여행」 안의 파일입니다/); assert.match(c.html, /고른 2개 꺼내기/);
  assert.match(c.html, /「작업 노트북」 백업 · /); assert.match(c.html, /data-act="old-back"/);
  assert.doesNotMatch(c.html, /data-act="restore-all"/); assert.equal(c.acts['restore-all'], undefined); assert.equal(c.back, 'restore-old');
  // 카본 A3 — 파일이 든 폴더는 고른 폴더부터 › 로 잇고, 고른 폴더 바로 아래 파일은 그 폴더 이름이다
  assert.match(c.html, /<span class="ds">사진 › 2024 › 여행 › 제주<\/span>/); assert.match(c.html, /일정표\.xlsx<\/span>.*?<span class="ds">사진 › 2024 › 여행<\/span>/);
  const top = { ...OLD_CATALOG.ok, req: { ...OLD_CATALOG.ok.req, sub: '' }, rows: [{ id: '9', name: 'IMG_0001.jpg', source: '03-Pictures', path: '/IMG_0001.jpg', size: 1, mtime: null, selected: false }] };
  assert.match(draw('restore', { catalog: top }).html, /IMG_0001\.jpg<\/span><span class="vl">[^<]*<\/span><span class="ds">사진<\/span>/);
  // 카본 A1 — 옛 기기 이름은 그릴 때 기기 목록에서 정한다(목록이 늦게 와도 맞다)
  // 이름을 모르면 머리줄은 「옛 PC 백업」(Opus 대체 검수 F5)
  assert.match(draw('restore', { catalog: OLD_CATALOG.ok, acct: { ...MOVE_ACCT, devices: null } }).html, /<\/i>옛 PC 백업 · /);
  assert.doesNotMatch(draw('restore-old', { old: OLD_PC.browse, acct: { ...MOVE_ACCT, devices: null } }).html, /이름을 알 수 없는 PC/);
  // Opus 대체 검수 F3 — 이름 때문에 목록을 못 열면 돌아가 통째로 꺼내라고 쓰고(E27), 같은 실패를 되풀이할 「목록 다시 열기」를 두지 않는다
  const unsafe = draw('restore', { catalog: { ...OLD_CATALOG.tooLarge, errorCode: 'UNSAFE_MANIFEST', error: 'x' } });
  assert.match(unsafe.html, /Windows에 둘 수 없는 이름이 있어 목록을 열 수 없습니다\. 「다른 폴더 고르기」로 돌아가 통째로 꺼내면/); assert.doesNotMatch(unsafe.html, /data-act="reopen"|전체 되살리기/);
  // Opus 대체 검수 F4 · -b FA1 — 옛 PC가 백업하던 폴더 모두와 그 안, 그 위 폴더에는 놓지 못한다고 미리 쓴다
  assert.match(c.html, /옛 PC가 백업하던 폴더\(사진 · 문서 · 바탕화면 · Projects\)와 그 안, 그 폴더들이 든 위 폴더에는 놓을 수 없습니다/);
  assert.match(draw('restore', { catalog: OLD_CATALOG.ok, mv: { ...res, result: undefined } }).html, /옛 PC가 백업하던 폴더와 그 안, 그 폴더들이 든 위 폴더에는/);
  // Opus 대체 검수 F2 — 찾은 것이 1,000개 이하면 모두 고르는 단추, 넘으면 범위를 줄이라는 글
  assert.doesNotMatch(c.html, /data-act="old-all"/); assert.match(c.html, /1,000개를 넘어 모두 고를 수는 없습니다/);
  const few = draw('restore', { catalog: { ...OLD_CATALOG.ok, total: 3 } });
  assert.match(few.html, /data-act="old-all">찾은 3개 모두 고르기/); assert.doesNotMatch(few.html, /1,000개를 넘어/);
  // -c FA1 — 모두 고르기는 이미 고른 것과의 합집합이라 화면이 미리 막지 않는다. 모두 고른 직후(찾은 600 · 고른 600)에도 못 고른다는 글이 없다
  const allPicked = draw('restore', { catalog: { ...OLD_CATALOG.ok, total: 600, selection: { revision: 4, count: 600, bytes: 1 } } });
  assert.match(allPicked.html, /data-act="old-all">찾은 600개 모두 고르기/); assert.doesNotMatch(allPicked.html, /모두 고를 수 없습니다/); assert.match(allPicked.html, /고른 600개 꺼내기/);
  const crowded = draw('restore', { catalog: { ...OLD_CATALOG.ok, total: 980, selection: { revision: 2, count: 50, bytes: 1 } } });
  assert.match(crowded.html, /data-act="old-all">찾은 980개 모두 고르기/); assert.doesNotMatch(crowded.html, /모두 고를 수 없습니다/);
  assert.match(draw('restore-old', { old: { ...OLD_PC.browse, level: null, code: 'NO_SNAPSHOT', error: 'x' } }).html, /「작업 노트북」의 확인된 백업이 없어 꺼낼 수 없습니다/);
  // 카본 A5 — 판이 바뀌어 목록을 못 열면 처음부터 고르는 단추가 있다
  const stale = draw('restore', { catalog: { ...OLD_CATALOG.tooLarge, errorCode: 'INVALID_REQUEST', error: 'x' } });
  assert.match(stale.html, /처음부터 다시 골라 주세요/); assert.match(stale.html, /data-act="old-top"/); assert.doesNotMatch(stale.html, /data-act="reopen"/);
  const tl = draw('restore', { catalog: OLD_CATALOG.tooLarge });
  assert.match(tl.html, /안쪽 폴더를 골라 나눠 열어 주세요/); assert.doesNotMatch(tl.html, /data-act="reopen"/);
  // 이 PC의 「파일 되살리기」 — 옮겨 온 PC에만 옛 PC 판으로 가는 길이 있다
  // Opus 대체 검수 F5 — 입구 이름을 다른 화면과 같게 쓴다
  assert.match(draw('restore', { catalog: null }).html, /data-act="old-start">옛 PC 백업에서 꺼내기/);
  assert.doesNotMatch(renderScreen('restore', { state: STATES.home, model: m.homeModel(STATES.home, { now: NOW }), now: NOW, ui: {}, fake: true }).html, /old-start/);
  // 넘기기 전 기본 화면 — 너무 큰 폴더가 있을 때만 꺼내는 길
  assert.ok(m.homeModel(read, { now: NOW, move: res.state, result: res.result }).actions.some((a) => a.id === 'old-start'));
  assert.ok(!m.homeModel(read, { now: NOW, move: MOVE_MV.result.state, result: MOVE_MV.result.result }).actions.some((a) => a.id === 'old-start'));
});

test('기기가 다 찼을 때(화면 요청 9 · 15, 개통 서버 ecbb3f91d): 되살리기만 하는 기기를 끊고, 다시 깐 PC의 옛 연결을 「이 PC」로 부른다', async () => {
  const { homeModel, deviceLine } = await load('screen-model.js');
  const { renderScreen } = await load('screen-view.js');
  const { STATES, NOW } = await load('engine-fixtures.js');
  const draw = (acct) => renderScreen('start-1', { state: STATES['start-signin'], model: homeModel(STATES['start-signin'], { now: NOW }), now: NOW, fake: true, acct });
  const W = { id: 'a'.repeat(12), name: '작업 노트북', role: 'write', state: 'active' }, R1 = { id: 'd'.repeat(12), name: '거실 PC', role: 'read', state: 'active' }, R2 = { id: 'e'.repeat(12), name: '옛 노트북', role: 'read', state: 'active' };
  // 요청 15 — 목록의 줄마다 오는 sameInstall이 참이면 「이 PC · 앞서 깐 것」이다(계정 상태의 목록이 없어도)
  assert.match(deviceLine({ ...W, sameInstall: true }, NOW, []).name, /\(이 PC · 앞서 깐 것\)$/); assert.equal(deviceLine({ ...W, sameInstall: true }, NOW, []).earlier, true);
  assert.equal(deviceLine({ ...W, sameInstall: false }, NOW, []).earlier, false);
  // 요청 9 — 되살리기만 하는 기기에만 「끊기」. 백업하는 기기는 서버가 끊지 않는다
  const full = draw({ limit: [W, R1, R2] }).html;
  assert.match(full, /data-act="limit-revoke" data-device="d{12}"/); assert.match(full, /data-act="limit-revoke" data-device="e{12}"/);
  assert.doesNotMatch(full, /data-device="a{12}"/); assert.match(full, /쓰지 않는 되살리기 기기를 끊으면 이 PC를 이을 수 있습니다/);
  assert.doesNotMatch(full, /다음 업데이트에서 엽니다/);
  // 다시 깐 PC의 옛 연결이 백업하는 기기 — 되살리기 기기 하나를 끊고 이은 뒤 자리를 옮기는 길
  const same = draw({ limit: [{ ...W, sameInstall: true }, R1, R2] }).html;
  assert.match(same, /작업 노트북\(이 PC · 앞서 깐 것\)/); assert.match(same, /「이 PC로 옮겨 오기」나 「되살리지 않고 이 PC에서 이어서 백업」을 고르면 이 PC가 백업을 이어받습니다/);
  assert.doesNotMatch(full, /이 PC가 백업을 이어받습니다/);
  // 백업하는 기기만 남은 목록 — 끊을 것이 없다고 쓴다
  assert.match(draw({ limit: [W] }).html, /백업하는 기기는 여기서 끊을 수 없습니다/);
  // 끊는 중 · 끊은 뒤
  const busy = draw({ limit: [W, R1, R2], running: 'limit-revoke', revoking: R1.id }).html;
  // 끊는 줄은 「끊는 중」과 그 줄의 「그만두기」(Fable F3 · F4), 다른 줄의 「끊기」는 막힘. 그만두기는 그 줄에만 있다
  assert.match(busy, /<span class="meta">끊는 중<\/span> <button class="lnk sm" type="button" data-act="google-cancel" data-device="d{12}" aria-label="「거실 PC」 연결 끊기 그만두기">그만두기<\/button>/);
  assert.match(busy, /data-device="e{12}"[^>]*aria-disabled="true">끊기/); assert.doesNotMatch(busy, /data-act="limit-revoke" data-device="d{12}"/);
  assert.equal((busy.match(/data-act="google-cancel"/g) || []).length, 1);
  assert.equal((draw({ limit: [W, R1, R2], running: 'limit-revoke', revoking: R1.id, googleWait: true }).html.match(/data-act="google-cancel"/g) || []).length, 1);
  // 끊는 동안 「다시 시작」도 막힌다(signIn이 목록을 지우지 않게)
  assert.match(busy, /data-act="google"[^>]*aria-disabled="true"/); assert.doesNotMatch(full, /data-act="google"[^>]*aria-disabled/);
  assert.match(busy, /「계속」을 눌러 주세요\. 그러면 그 기기의 연결을 끊습니다/); assert.doesNotMatch(full, /그 기기의 연결을 끊습니다/);
  const freed = draw({ limit: [W, { ...R1, state: 'revoked' }, R2], freed: '거실 PC' }).html;
  assert.match(freed, /「거실 PC」 연결을 끊었습니다<\/b>「다시 시작」을 누르면 이 PC를 이을 수 있습니다/); assert.match(freed, /data-act="google"[^]*?<\/svg>다시 시작<\/button>/); assert.doesNotMatch(freed, /거실 PC<\/span>|data-device="d{12}"/);
  // 끊지 못한 까닭은 상자에 남는다(Fable -b 2). 끊기 단추는 그대로 둔다
  const why = draw({ limit: [W, R1, R2], limitWhy: { name: '거실 PC', text: '이 Google 계정에서 「거실 PC」를 찾지 못했습니다. 다시 눌러 주세요.' } }).html;
  assert.match(why, /<b>「거실 PC」 연결을 끊지 못했습니다<\/b>이 Google 계정에서 「거실 PC」를 찾지 못했습니다/); assert.match(why, /data-device="d{12}"/);
  // 끊는 줄의 「그만두기」도 같은 기기 번호를 달아, 다시 그려도 포커스가 그 줄에 남는다(Fable -b 1)
  assert.match(busy, /data-act="google-cancel" data-device="d{12}"/);
  // 끊은 뒤에는 남은 줄에 「끊기」를 두지 않는다 — 한 자리면 이을 수 있다(Fable F2)
  assert.match(freed, /옛 노트북/); assert.doesNotMatch(freed, /data-act="limit-revoke"/);
});

test('도는 되살리기 그만두기(요청 16, 조율 세션 60a9de51e): 진행 화면에 「되살리기 그만두기」, 그만두는 중, 그만둔 뒤의 한 줄', async () => {
  const { homeModel } = await load('screen-model.js');
  const { renderScreen } = await load('screen-view.js');
  const { STATES, NOW } = await load('engine-fixtures.js');
  const home = (s) => homeModel(s, { now: NOW });
  // 도는 동안 — 「되살리기 그만두기」 하나(cancelRestore)와 그만두면 폴더를 그대로 둔다는 안내
  const run = home(STATES['home-restoring']);
  assert.equal(run.id, 'home-run'); assert.deepEqual(run.actions.map((a) => [a.id, a.call]), [['restore-stop', 'cancelRestore']]);
  assert.match(run.hint, /그때까지 만든 폴더는 그대로 둡니다/);
  const html = renderScreen('home', { state: STATES['home-restoring'], model: run, now: NOW }).html;
  assert.match(html, /data-act="restore-stop"[^>]*>[^<]*되살리기 그만두기/);
  // 고른 파일 되살리기도 같다
  assert.deepEqual(home({ ...STATES['home-restoring'], job: { kind: 'restore-selected', stage: '고른 파일 되살리는 중', percent: 10 } }).actions.map((a) => a.id), ['restore-stop']);
  // 마무리에 들어간 되살리기(job.final)는 그만둘 수 없다 — 단추를 두지 않는다
  assert.deepEqual(home({ ...STATES['home-restoring'], job: { ...STATES['home-restoring'].job, final: true } }).actions, []);
  // 백업은 그만두기가 없다
  assert.ok(!home(STATES['home-run']).actions.some((a) => a.id === 'restore-stop'));
  // 그만두는 중 — 큰 문장이 바뀌고 단추가 없다
  const stopping = home(STATES['home-restore-stopping']);
  assert.equal(stopping.title, '되살리기를 그만두는 중입니다.'); assert.deepEqual(stopping.actions, []); assert.equal(stopping.hint, null);
  // 진행 줄은 「그만두는 중」이고 퍼센트를 그리지 않는다(엔진은 percent를 null로 둔다 — Number(null)이 0%로 그려지지 않게)
  assert.equal(stopping.kick, '작업 노트북 · 되살리기 그만두는 중'); assert.deepEqual(stopping.progress, { label: '파일 되살리기', stage: '그만두는 중', percent: null });
  assert.equal(stopping.evidence.run.percent, null);
  assert.doesNotMatch(renderScreen('home', { state: STATES['home-restore-stopping'], model: stopping, now: NOW }).html, />0%</);
  // 그만둔 뒤 — 실패가 아니라 그만둔 것으로 쓰고, 만들다 만 폴더 이름과 그 폴더를 쓰지 말라는 말을 붙인다(괄호로 끝나는 이름의 조사)
  const stopped = home(STATES['home-restore-stopped']);
  assert.equal(stopped.id, 'home');
  assert.equal(stopped.restored.bad, undefined);
  assert.equal(stopped.restored.text, '오후 2:21에 전체 되살리기를 그만두었습니다. 만들다 만 폴더 「되살린 파일 (11월 13일)」은 그대로 두었습니다. 그 안의 파일은 다 확인하지 못했으니 쓰지 말고 지워 주세요.');
  const at = STATES['home-restore-stopped'].lastRestoreError.at;
  const sel = home({ ...STATES.home, lastSelectedRestoreError: { code: 'CANCELED', at, path: 'D:\\받기\\사진' } });
  assert.equal(sel.restored.text, '오후 2:21에 고른 파일 되살리기를 그만두었습니다. 만들다 만 폴더 「사진」은 그대로 두었습니다. 그 안의 파일은 다 확인하지 못했으니 쓰지 말고 지워 주세요.');
  // 폴더가 적히지 않았으면 그만두었다는 말만
  assert.equal(home({ ...STATES.home, lastSelectedRestoreError: { code: 'CANCELED', at } }).restored.text, '오후 2:21에 고른 파일 되살리기를 그만두었습니다.');
  // 다른 실패는 전과 같다
  assert.equal(home({ ...STATES.home, lastSelectedRestoreError: { code: 'NO_SPACE', at } }).restored.bad, true);
  // 실패해 점검 주의가 걸린 뒤 다시 하다 그만두면 — 「되살리지 못했습니다」가 아니라 점검 주의 화면에 그만두었다는 줄(Fable F1)
  const errAt = STATES['home-restore-error'].lastRestoreError.at;
  const again = home({ ...STATES['home-restore-error'], lastRestoreError: { code: 'CANCELED', at: errAt, path: 'C:\\Users\\studio\\Downloads\\되살린 파일 (11월 13일) 2' } });
  assert.equal(again.id, 'home-health'); assert.doesNotMatch(`${again.title} ${again.sub}`, /되살리지 못했습니다/);
  assert.match(again.restored.text, /전체 되살리기를 그만두었습니다\. 만들다 만 폴더 「되살린 파일 \(11월 13일\) 2」는 그대로 두었습니다/);
  // 엔진의 전체 되살리기 단계(퍼센트 없음)는 「되살리는 중」이고 0%를 그리지 않는다(Fable F3)
  assert.equal(run.progress.percent, null); assert.doesNotMatch(html, />0%</);
});

test('범위를 통째로 받기 · 옛 PC 판의 실패 · 만들다 만 폴더 열기 · 끊은 뒤 안내(E27 · E26 알림 · E29 · E28, 조율 세션 ced52da00)', async () => {
  const { homeModel } = await load('screen-model.js');
  const { renderScreen } = await load('screen-view.js');
  const { STATES, NOW } = await load('engine-fixtures.js');
  const home = (s) => homeModel(s, { now: NOW });
  const at = STATES['home-scope-done'].lastRestore.at;
  // E27 — 통째로 받은 범위(lastRestore.scope)는 그 범위를 말하고, 건너뛴 이름의 수와 폴더 열기를 그대로 둔다
  const done = home(STATES['home-scope-done']);
  assert.equal(done.restored.text, '오후 2:21에 옛 PC 백업의 「사진 › 2024 › 여행」 폴더를 「되살린 파일 (11월 13일)」에 통째로 꺼냈습니다. 2개는 만들지 않고 건너뛰었습니다. 다른 곳을 가리키는 연결, 특수 파일, Windows에서 쓸 수 없는 이름입니다.');
  assert.equal(done.restored.act.call, 'openRestoreFolder'); assert.equal(done.restored.act.arg, undefined);
  // 범위 없는 「지금 상태」 되살리기는 전과 같다
  assert.match(home({ ...STATES['home-scope-done'], lastRestore: { ...STATES['home-scope-done'].lastRestore, scope: undefined } }).restored.text, /가장 최근 판 전체를/);
  // E26 알림 — 옛 PC 판의 실패(from)는 그 말로 쓰고, 100만 개 넘는 범위는 안쪽 폴더를 고르라며 그 화면으로 돌아가는 길을 둔다
  const big = home(STATES['home-scope-big']);
  assert.equal(big.restored.text, '오후 2:21에 옛 PC 백업에서 폴더를 꺼내지 못했습니다. 파일과 폴더가 100만 개를 넘어 통째로 꺼낼 수 없습니다. 안쪽 폴더를 골라 주세요.');
  assert.equal(big.restored.bad, true); assert.equal(big.restored.act.id, 'old-start');
  // 고른 파일 받기가 옛 PC의 원래 자리와 겹치면 「지키는 폴더 안에는」만이 아니라 그 까닭을 쓴다
  const unsafeSel = home(STATES['home-scope-unsafe-sel']);
  assert.match(unsafeSel.restored.text, /옛 PC 백업에서 고른 파일을 꺼내지 못했습니다\. 놓을 자리가 이 PC가 지키는 폴더나 백업을 담는 폴더, 또는 옛 PC가 백업하던 폴더와 겹칩니다/);
  // 이 PC 판의 겹침은 전과 같은 글이다
  assert.doesNotMatch(home({ ...STATES.home, lastSelectedRestoreError: { code: 'OUTPUT_UNSAFE', at } }).restored.text, /옛 PC/);
  // 옛 PC 판 받기의 실패가 점검 주의를 걸면 — 그 말로 쓰고, 다시 꺼내는 길과 만들다 만 폴더 열기를 둔다
  const failed = home(STATES['home-scope-failed']);
  assert.equal(failed.id, 'home-restore-error'); assert.equal(failed.title, '옛 PC 백업에서 폴더를 꺼내지 못했습니다.');
  assert.deepEqual(failed.actions.map((a) => a.id), ['old-start', 'check', 'open-left']);
  assert.deepEqual(failed.actions[2].arg, { unfinished: true });
  // 이 PC 판의 실패는 전과 같이 「다시 되살리기」(만들다 만 폴더가 있으면 그 열기도)
  assert.deepEqual(home(STATES['home-restore-error']).actions.map((a) => a.id), ['restore', 'check']);
  // E29 — 그만두었거나 실패한 되살리기의 만들다 만 폴더 열기. 전체는 openRestoreFolder({ unfinished }), 고른 파일은 openSelectedRestoreFolder({ profile, unfinished })
  const stopped = home(STATES['home-restore-stopped']);
  assert.deepEqual(stopped.restored.act, { id: 'open-left', label: '만들다 만 폴더 열기', kind: 'link', call: 'openRestoreFolder', arg: { unfinished: true } });
  const sel = home({ ...STATES.home, lastSelectedRestoreError: { code: 'CANCELED', at, path: 'D:\\받기\\사진' } });
  assert.deepEqual(sel.restored.act, { id: 'open-left-sel', label: '만들다 만 폴더 열기', kind: 'link', call: 'openSelectedRestoreFolder', withProfile: true, extra: { unfinished: true } });
  // 폴더가 적히지 않은 실패에는 여는 단추가 없다
  assert.equal(home({ ...STATES.home, lastSelectedRestoreError: { code: 'NO_SPACE', at } }).restored.act, undefined);
  // 옛 PC 판을 그만두면 「옛 PC 백업 꺼내기를 그만두었습니다」
  assert.match(home({ ...STATES.home, lastRestoreError: { code: 'CANCELED', at, from: 'f'.repeat(12), path: 'D:\\받기\\사진' } }).restored.text, /^오후 2:21에 옛 PC 백업 꺼내기를 그만두었습니다\. 만들다 만 폴더 「사진」은/);
  // 그린 화면에 그 단추가 실린다
  assert.match(renderScreen('home', { state: STATES['home-restore-stopped'], model: stopped, now: NOW }).html, /data-act="open-left"[^>]*>[^<]*만들다 만 폴더 열기/);
  // E28 — 끊은 뒤에는 이은 뒤 「복구 정보 다시 맡기기」를 한 번 더 하라고 쓴다(엔진이 read-key를 실을 때 그 단추가 나온다)
  const freed = renderScreen('start-1', { state: STATES['start-signin'], model: homeModel(STATES['start-signin'], { now: NOW }), now: NOW, fake: true, acct: { limit: [{ id: 'a'.repeat(12), name: '작업 노트북', role: 'write', state: 'active' }], freed: '거실 PC' } }).html;
  assert.match(freed, /이은 뒤 「복구 정보 다시 맡기기」 단추가 보이면 눌러 주세요\. 눌러야 끊은 기기가 이 백업을 더는 열지 못합니다\./);
  const rk = home({ ...STATES.home, account: { connected: true, role: 'read', needs: ['read-key'] }, mode: 'restore' });
  assert.equal(rk.id, 'home-readkey'); assert.equal(rk.actions[0].call, 'rotateReadKey');
});

test('Google 동의 화면의 Drive 칸(개통 서버 세션 실측 11-17): 누르기 전과 DENIED 뒤에 그 칸을 켜라고 쓴다', async () => {
  const { homeModel } = await load('screen-model.js');
  const { renderScreen } = await load('screen-view.js');
  const { failureText } = await load('state-store.js');
  const { STATES, NOW } = await load('engine-fixtures.js');
  const draw = (acct) => renderScreen('start-1', { state: STATES['start-signin'], model: homeModel(STATES['start-signin'], { now: NOW }), now: NOW, fake: true, acct }).html;
  // 누르기 전 · 기다리는 동안 · 끊는 동안 모두 그 칸을 말한다
  assert.match(draw({}), /Google Drive가 적힌 칸이 나오면 꼭 켜 주세요/);
  assert.match(draw({ signing: true }), /Google Drive가 적힌 칸이 나오면 켜고 「계속」을 눌러 주세요\. 5분 안에/);
  assert.match(draw({ limit: [{ id: 'd'.repeat(12), name: '거실 PC', role: 'read', state: 'active' }], running: 'limit-revoke', revoking: 'd'.repeat(12) }), /계정을 고르고 「계속」을 누르세요\. Google Drive가 적힌 칸이 나오면 켜고 「계속」을 눌러 주세요\. 그러면 그 기기의 연결을 끊습니다\.'?/);
  // DENIED 뒤 — 상자로 그 칸과 까닭을 보이고, 다음 누름에 비운다(app.js signIn). 기기가 다 찬 목록이 있으면 그 상자가 먼저다
  const denied = draw({ denied: true });
  assert.match(denied, /<b>Google에서 허락을 받지 못했습니다<\/b>Google 화면의 Google Drive가 적힌 칸은 꺼진 채로 나옵니다\. 그 칸을 켜지 않고 넘어가면/);
  // Opus 대체 검수 F1 — 다시 누르면 칸 없는 「추가 액세스」 화면이 뜰 수 있어, 칸은 조건으로만 말한다(세 거절 글 모두)
  assert.match(denied, /다시 눌러 「계속」까지 눌러 주세요\. 그 칸이 나오면 켜 주세요\./);
  const appSrc = require('node:fs').readFileSync(path.join(__dirname, '..', 'ui', 'app.js'), 'utf8');
  for (const text of [denied, failureText('DENIED'), appSrc]) assert.doesNotMatch(text, /칸을 켜고 「계속」까지/);
  assert.match(appSrc, /허락을 받지 못해 끊지 않았습니다\. 다시 눌러 Google 화면에서 「계속」까지 눌러 주세요\. Google Drive가 적힌 칸이 나오면 켜 주세요\./);
  assert.doesNotMatch(denied, /Google Drive 칸/, '같은 칸을 한 이름으로 부른다(카본 A2)');
  assert.doesNotMatch(draw({}), /허락을 받지 못했습니다/);
  assert.doesNotMatch(draw({ denied: true, limit: [{ id: 'd'.repeat(12), name: '거실 PC', role: 'read', state: 'active' }] }), /허락을 받지 못했습니다/);
  // 공용 거절 글(다른 Google 로그인 단추 — 복구 정보 다시 맡기기 · 이어서 백업 등)도 그 칸을 말한다. 「취소」를 눌러도 DENIED라 두 경우에 맞는 말이다
  assert.equal(failureText('DENIED'), 'Google에서 허락을 받지 못했습니다. 다시 눌러 Google 화면에서 「계속」까지 눌러 주세요. Google Drive가 적힌 칸이 나오면 켜 주세요.');
});

test('솔리오 잇기(엔진 305e380fe · 설계 4.13 · 4.14 · 4.16): 처음 시작 이어 하기 · 쉬는 Wi-Fi · AI 도구', async () => {
  const m = await load('screen-model.js');
  const { renderScreen, drawer, SCREENS } = await load('screen-view.js');
  const { STATES, NOW } = await load('engine-fixtures.js');
  assert.ok(SCREENS.includes('rest-net') && SCREENS.includes('ai-tools'));
  const draw = (id, st, extra = {}) => renderScreen(id, { state: st, model: m.homeModel(st, { now: NOW }), now: NOW, ui: {}, acct: {}, fake: true, ...extra }).html;
  // 설정 서랍 — solio 칸이 있는 엔진만 두 줄을 그린다
  const dr = drawer(STATES['home-solio'], { now: NOW });
  assert.match(dr, /「휴대폰 핫스팟」, 「Cafe_Free」 외 1곳에서는 매시간 백업을 쉽니다/); assert.match(dr, /data-act="rest-net"/);
  assert.match(dr, /백업 안 파일 찾기 켜짐 · AI 도구에 파일 이름과 폴더 이름이 나갑니다/); assert.match(dr, /data-act="ai-tools"/);
  assert.match(drawer(STATES.home, { now: NOW }), /백업 상태만 답합니다 · 파일 이름은 나가지 않습니다/);
  assert.doesNotMatch(drawer({ ...STATES.home, solio: undefined }, { now: NOW }), /rest-net|ai-tools/);
  // 쉬는 Wi-Fi — 지금 Wi-Fi(ui.wifi)의 네 갈래
  const st = STATES['home-solio'];
  const here = draw('rest-net', st, { ui: { wifi: '집 Wi-Fi' } });
  assert.match(here, /지금 이어진 Wi-Fi는 「집 Wi-Fi」입니다\. <button class="lnk sm" type="button" data-act="rest-here">이 Wi-Fi에서 쉬기/);
  assert.match(draw('rest-net', st, { ui: { wifi: 'Cafe_Free' } }), /지금 이어진 Wi-Fi 「Cafe_Free」에서는 매시간 백업을 쉽니다\. 이미 고른 Wi-Fi입니다/);
  assert.match(draw('rest-net', st, { ui: { wifi: null } }), /이름을 읽지 못했습니다\. Wi-Fi가 아닌 회선에 이어져 있거나, Windows가 위치 권한을 막았을/);
  assert.match(draw('rest-net', st, { ui: {} }), /확인하고 있습니다/);
  assert.doesNotMatch(draw('rest-net', st, { ui: { wifi: false } }), /지금 이어진 Wi-Fi/);
  assert.equal((here.match(/data-act="rest-drop"/g) || []).length, 3);
  assert.match(here, /「데이터 통신 연결」을 켜 두세요/);
  // 고르는 동안은 단추를 막고 칸은 읽기만(포커스를 지킨다), 20개가 차면 칸을 막는다
  // Opus 대체 검수 F1 — 매시간 저절로 도는 백업만 쉰다. F3 — 칸의 글(초안)은 그림에 넣지 않는다. F4 — 이름은 글자 그대로 견준다
  assert.doesNotMatch(here, /첫 백업/); assert.match(here, /매시간 저절로 도는 백업을 쉬고.*「보호 시작」, 「이어서 백업」, 「지금 백업」을 직접 눌러 도는 백업은 쉬지 않습니다/s);
  assert.match(here, /대소문자와 띄어쓰기까지 같게 적어 주세요/);
  const busy = draw('rest-net', st, { ui: { wifi: '집 Wi-Fi', restDraft: '새 이름' }, acct: { running: 'setRestNetworks' } });
  assert.match(busy, /id="rest-in"[^>]* readonly/); assert.doesNotMatch(busy, /value="새 이름"/); assert.match(busy, /data-act="rest-add" aria-disabled="true"/); assert.match(busy, /data-act="rest-here" aria-disabled="true"/);
  const full = draw('rest-net', { ...st, solio: { ...st.solio, restNetworks: Array.from({ length: 20 }, (_, i) => `망${i}`) } }, { ui: { wifi: false } });
  assert.match(full, /id="rest-in"[^>]* disabled/); assert.match(full, /data-act="rest-add" aria-disabled="true"/);
  // 거르기 — 엔진(solio.cjs okNetworkName · writeAiTools)과 같은 꼴
  assert.equal(m.restNameProblem('가'.repeat(10)), null); assert.equal(m.restNameProblem('a'.repeat(32)), null);
  assert.match(m.restNameProblem('가'.repeat(11)), /너무 깁니다/); assert.match(m.restNameProblem('a'.repeat(33)), /너무 깁니다/);
  assert.match(m.restNameProblem(''), /적어 주세요/); assert.match(m.restNameProblem('a\u0007b'), /쓸 수 없는 글자/);
  assert.match(m.restNameProblem('x', ['x']), /이미 고른/); assert.match(m.restNameProblem('y', Array.from({ length: 20 }, (_, i) => `n${i}`)), /20개까지/);
  assert.equal(m.maskProblem(' 건강 '), null); assert.match(m.maskProblem('   '), /적어 주세요/); assert.match(m.maskProblem('x'.repeat(41)), /40자까지/);
  assert.match(m.maskProblem(' 계약', ['계약']), /이미 가리는/); assert.match(m.maskProblem('z', Array.from({ length: 20 }, (_, i) => `m${i}`)), /20개까지/);
  // AI 도구 — 켜고 끄기 · 가리는 낱말 · 이어 온 도구(화면에 들어와 다시 읽은 것이 먼저)
  const ai = draw('ai-tools', st);
  assert.match(ai, /켜면 AI 도구에 파일 이름과 폴더 이름이 나갑니다<\/b>파일 내용은 나가지 않습니다/);
  assert.match(ai, /백업 상태.*늘 답함/s); assert.doesNotMatch(ai, /data-tool="protection_status"/);
  assert.match(ai, /꺼짐 <button class="lnk sm" type="button" data-act="ai-tool" data-tool="space_report" aria-label="공간 보고서 켜기">켜기/); assert.match(ai, /data-tool="find_restorable" aria-label="백업 안 파일 찾기 끄기">끄기/);
  assert.equal((ai.match(/data-act="mask-drop"/g) || []).length, 2);
  assert.match(ai, /claude-code <span class="num">2\.1\.0<\/span><\/span><span class="v"><span class="meta">C:\\Users\\studio\\AppData\\Local\\AnthropicClaude\\claude\.exe/);
  assert.match(ai, /처음 11월 10일 · 마지막 오후 1:40/); assert.match(ai, /스스로 알린 것입니다/);
  assert.match(draw('ai-tools', st, { ui: { aiClients: [] } }), /아직 이 앱에 이은 AI 도구가 없습니다/);
  assert.match(draw('ai-tools', STATES.home), /가리는 낱말이 없습니다/);
  assert.match(draw('ai-tools', st, { acct: { running: 'setAiTools' } }), /data-tool="space_report" aria-disabled="true"/);
  // 처음 시작 — 솔리오가 연 로그인의 까닭, 옮겨 올 PC가 없을 때의 상자
  assert.match(draw('start-1', STATES['start-signin'], { acct: { signing: true, solio: 'protect' } }), /솔리오에서 「보호 시작」을 눌러 Google 로그인을 바로 열었습니다\. 브라우저에서/);
  assert.match(draw('start-1', STATES['start-signin'], { acct: { signing: true, solio: 'move' } }), /솔리오에서 「이 PC로 옮겨 오기」를 눌러/);
  assert.doesNotMatch(draw('start-1', STATES['start-signin'], { acct: { signing: false, solio: 'protect' } }), /솔리오에서/);
  assert.match(draw('start-2', STATES['start-write'], { acct: { solioNoMove: true } }), /<b>옮겨 올 PC가 없습니다<\/b>.*이 PC를 지키려면 지킬 폴더를 고르세요/);
  assert.match(draw('start-2', STATES['start-write'], { acct: { solioNoMove: true, repoExists: true } }), /이 계정의 백업에 이어서 이 PC가 백업할 수 있습니다/);
  assert.doesNotMatch(draw('start-2', STATES['start-write']), /옮겨 올 PC가 없습니다/);
  // Opus 대체 검수 F2 · 다시 검수 -b — 이미 설정한 PC로 온 처음 시작은 기본 화면에 까닭과, 지금 화면에 있는 단추 이름으로 다음 걸음을 쓴다
  const readSt = STATES['home-move-read'];
  const home = (st, sb) => renderScreen('home', { state: st, model: m.homeModel(st, { now: NOW }), now: NOW, acct: { solioBox: sb }, fake: true }).html;
  const boxed = home(readSt, { mode: 'protect', restore: true });
  assert.match(boxed, /<b>솔리오의 「보호 시작」을 여기서 바로 잇지 못했습니다<\/b>이 PC는 이미 한 Google 계정의 백업에 이어 둔 연결이라 처음부터 새로 시작하지 않았습니다\. 아직 이 PC에서는 백업하지 않고 있습니다\. 같은 Google 계정으로 이 PC에서 백업하려면 아래 「이 PC에서 백업할 폴더 고르기」를 누르세요\. 다른 Google 계정으로/);
  assert.match(boxed, /data-act="pick"/); assert.doesNotMatch(boxed, /옮겨 온 백업/);
  assert.match(home({ ...readSt, selection: { sources: ['C:\\work'], target: null } }, { mode: 'protect', restore: true }), /아래 「되살리지 않고 이 PC에서 이어서 백업」을 누르세요/);
  // 이어서 백업해 백업하는 PC가 되면 걷는다. 처음부터 백업하던 PC(외장 드라이브만 쓰는 PC 등)는 그 까닭을 쓴다
  assert.doesNotMatch(home(STATES.home, { mode: 'protect', restore: true }), /여기서 바로 잇지 못했습니다/);
  assert.match(home(STATES.home, { mode: 'protect', restore: false }), /이미 이 앱으로 백업하도록 설정되어 있습니다/);
  assert.doesNotMatch(home(readSt, null), /여기서 바로 잇지 못했습니다/);
  // 다시 검수 -c · -d — 짚는 단추는 화면 모델이 표시한 걸음(take)뿐이다. 이어서 백업할 차례 · 되돌리기 확인 · 옮겨 오기가 멈춘 화면과 끝난 화면
  const cont = STATES['home-continue'];
  assert.match(home(cont, { mode: 'protect', restore: true }), /아래 「이어서 백업」을 누르세요/); assert.doesNotMatch(home(cont, { mode: 'protect', restore: true }), /폴더 다시 고르기」를 누르세요/);
  assert.match(home({ ...cont, selection: { sources: [], target: null } }, { mode: 'protect', restore: true }), /아래 「지킬 폴더 고르기」를 누르세요/);
  const hold = home(STATES['home-restore-read-hold'], { mode: 'protect', restore: true });
  assert.match(hold, /여기서 바로 잇지 못했습니다<\/b>이 PC는 이미 한 Google 계정의 백업에 이어 둔 연결이라 처음부터 새로 시작하지 않았습니다/); assert.doesNotMatch(hold, /누르세요/);
  // 다시 검수 -e — 계정이 이어지지 않은 되살리기 연결은 머리 글과 같은 이름(「되살리기만 하는 연결」)으로 부르고, 짚을 단추가 없다
  const noAcct = { ...readSt, account: { ...readSt.account, connected: false } };
  assert.equal(m.homeModel(noAcct, { now: NOW }).id, 'home-restore-only');
  const loose = home(noAcct, { mode: 'protect', restore: true });
  assert.match(loose, /<\/b>이 PC는 이미 되살리기만 하는 연결로 설정되어 있어 처음부터 새로 시작하지 않았습니다\. 다른 Google 계정으로/); assert.doesNotMatch(loose, /누르세요|백업을 되살리는 연결/);
  // 옮겨 오기가 멈춘 화면과 끝난 화면 — 옮겨 오기 상태(mv)로 그린다
  const { MOVE_MV } = await load('engine-fixtures.js');
  const mvHome = (mv) => { const mm = m.homeModel(readSt, { now: NOW, move: mv.state, result: mv.result || null }); return { mm, html: renderScreen('home', { state: readSt, model: mm, now: NOW, acct: { solioBox: { mode: 'protect', restore: true } }, mv, fake: true }).html }; };
  assert.equal(mvHome(MOVE_MV.stopped).mm.id, 'home-move-stopped'); assert.match(mvHome(MOVE_MV.stopped).html, /아래 「그만두고 이 PC로 이어서 백업」을 누르세요/);
  assert.equal(mvHome(MOVE_MV.result).mm.id, 'home-move-done'); assert.match(mvHome(MOVE_MV.result).html, /아래 「이 PC로 이어서 백업」을 누르세요/);
  for (const [name, mv] of Object.entries(MOVE_MV)) {
    if (!mv?.state) continue;
    const { mm, html } = mvHome(mv), named = (html.match(/아래 「([^」]+)」/) || [])[1];
    assert.ok(mm.actions.filter((x) => x.take).length <= 1, `옮겨 오기 ${name}: 걸음은 하나`);
    if (/^home-move-(stopped|done)$/.test(mm.id)) assert.ok(named && mm.actions.some((x) => x.take && x.label === named), `옮겨 오기 ${name}: ${mm.id}`);
  }
  // 짚는 단추는 그 화면의 단추 줄에 실제로 있다 — 되살리기 쪽 예시 상태 모두
  for (const [name, st] of Object.entries(STATES)) {
    if (st.mode !== 'restore') continue;
    const mm = m.homeModel(st, { now: NOW });
    const html = renderScreen('home', { state: st, model: mm, now: NOW, acct: { solioBox: { mode: 'protect', restore: true } }, fake: true }).html;
    const named = (html.match(/아래 「([^」]+)」/) || [])[1];
    assert.ok(mm.actions.filter((x) => x.take).length <= 1, `${name}: 걸음은 하나`);
    if (named) assert.ok(mm.actions.some((x) => x.take && x.label === named), `${name}: 「${named}」`);
  }
});

test('한꺼번에 지워짐(설계 4.4 — 엔진 massHold, 조율 세션 9ddcbeb40): 갈래마다 글, 한 번 더 묻기, 되살린 뒤, 목록 화면', async () => {
  const m = await load('screen-model.js');
  const { renderScreen } = await load('screen-view.js');
  const { STATES, NOW } = await load('engine-fixtures.js');
  const strip = (x) => x.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const draw = (s, opts = {}, ui = {}) => { const mm = m.homeModel(s, { now: NOW, ...opts }); return { mm, html: strip(renderScreen('home', { state: s, model: mm, now: NOW, ui, acct: {}, fake: true }).html) }; };
  const home = (name, opts) => draw(STATES[name], opts);
  const PICS = 'C:\\Users\\studio\\Pictures';

  // 지워짐 — 그 갈래(지워짐)의 수가 있는 폴더만 「등 N곳」으로 센다. 견준 두 판의 시각을 쓴다
  const a = home('home-mass');
  assert.equal(a.mm.id, 'home-mass'); assert.equal(a.mm.tone, 'bad');
  assert.equal(a.mm.sub, '어제 오전 11:02부터 오늘 오후 2:02 사이에 「문서」에서 파일 3,980개가 사라졌습니다. 확인하기 전까지 그 전의 판을 지우지 않습니다.');
  assert.deepEqual(a.mm.actions.map((x) => [x.id, x.label, x.massAsk || x.call]), [['mass-restore', '지워지기 전으로 되살리기', 'restore'], ['mass-ok', '내가 한 일이 맞음', 'ok']]);
  assert.equal(a.mm.link.label, '지워지거나 바뀐 파일 3,992개 보기'); assert.equal(a.mm.link.to, 'mass-list');
  assert.deepEqual(a.mm.evidence.folders.rows.filter((r) => r.x).map((r) => [r.k, r.main, r.mark]), [['문서', '1,330개', '−3,980'], ['사진', '4,880개', '바뀜 12']]);
  assert.deepEqual(a.mm.evidence.extra, []); assert.equal(a.mm.evidence.folders.more, 0);
  // Opus 대체 검수 FA3 — 네 폴더가 모두 바뀌면 많이 바뀐 두 곳만 줄로, 나머지는 「그 밖의 폴더」 한 줄
  const four = home('home-mass-four');
  assert.deepEqual(four.mm.evidence.folders.rows.filter((r) => r.x).map((r) => r.k), ['문서', '사진']); assert.equal(four.mm.evidence.folders.more, 2);
  // -b 1 — 큰 파일이 지워진 멈춤은 지운 수로 고른다(둘째 줄이 말하는 폴더가 확인서에 남는다)
  const bigSmall = draw({ ...STATES['home-mass-bytes'], massHold: { ...STATES['home-mass-bytes'].massHold, folders: [{ path: 'C:\\Users\\studio\\Documents', removed: 0, changed: 40 }, { path: 'C:\\Users\\studio\\Pictures', removed: 0, changed: 30 }, { path: 'D:\\Projects', removed: 3, changed: 0 }] } });
  assert.deepEqual(bigSmall.mm.evidence.folders.rows.filter((r) => r.x).map((r) => r.k), ['문서', 'Projects']);
  assert.match(four.html, /그 밖의 폴더 2곳 더 바뀜/);
  assert.equal(a.mm.evidence.total.v, '8,500개 · 12.3GB');
  assert.match(a.html, /되살린 파일은 다운로드 안의 「되살린 파일 \(11월 13일\)」 폴더에 놓습니다\. 자리 바꾸기/);
  assert.match(a.html, /문서 1,330개 −3,980 사진 4,880개 바뀜 12/); assert.doesNotMatch(a.html, /되살려 본 날/);
  // 내용이 바뀜 · 큰 파일 · 폴더를 가르지 못한 판
  const c = home('home-mass-changed');
  assert.equal(c.mm.title, '많은 파일의 내용이 한꺼번에 바뀌었습니다.');
  assert.match(c.mm.sub, /「사진」 등 2곳에서 파일 2,412개의 내용이 바뀌었습니다\./);
  assert.equal(c.mm.actions[0].label, '바뀌기 전으로 되살리기'); assert.equal(c.mm.link.label, '바뀐 파일 2,412개 보기');
  assert.match(c.mm.notes[0], /직접 고쳤거나/);
  const b = home('home-mass-bytes');
  assert.equal(b.mm.title, '큰 파일이 한꺼번에 지워졌습니다.');
  assert.match(b.mm.sub, /「Projects」에서 파일 3개가 사라졌습니다\. 모두 4\.1GB입니다\./);
  const nf = home('home-mass-nofolder');
  assert.match(nf.mm.sub, /사이에 백업한 폴더에서 파일 3,980개가 사라졌습니다/); assert.equal(nf.mm.evidence.folders.rows.filter((r) => r.x).length, 0);

  // 놓을 자리 — 기본 자리는 한 번 더 묻고, 고르는 자리는 바로 부른다(그 창이 묻는다). 다운로드를 지키면 다운로드에 놓기가 없다
  const pick = home('home-mass', { place: 'pick' });
  assert.equal(pick.mm.actions[0].call, 'restoreMassBefore'); assert.equal(pick.mm.actions[0].massAsk, undefined);
  assert.equal(pick.mm.hint, '누르면 놓을 폴더를 고르는 창이 뜹니다.'); assert.equal(pick.mm.hintAct.id, 'place-default');
  const guarded = draw({ ...STATES['home-mass'], sources: [...STATES['home-mass'].sources, 'C:\\Users\\studio\\Downloads'] });
  assert.equal(guarded.mm.actions[0].call, 'restoreMassBefore'); assert.equal(guarded.mm.hintAct, null);
  assert.match(guarded.mm.hint, /다운로드도 지키는 폴더라/);

  // 한 번 더 묻기 — 확인을 마침 · 바뀐 폴더 모두 · 한 폴더
  const ok = home('home-mass', { massAsk: 'ok' });
  assert.equal(ok.mm.box.title, '확인을 마치면 이전 판을 다시 정리합니다');
  assert.match(ok.mm.box.text, /붙들어 둔 어제 오전 11:02 판도 그때 지워질 수 있습니다/);
  assert.deepEqual(ok.mm.actions.map((x) => [x.id, x.call]), [['mass-ok-go', 'massConfirm'], ['mass-no', undefined]]); assert.equal(ok.mm.link, null);
  const all = home('home-mass', { massAsk: { folder: null } });
  assert.equal(all.mm.box.title, '바뀐 폴더 2곳을 지워지기 전 판으로 되살릴까요?');
  assert.match(all.mm.box.text, /어제 오전 11:02 판에서 통째로 꺼내 다운로드 안의 「되살린 파일 \(11월 13일\)」 폴더에 놓습니다/);
  assert.deepEqual([all.mm.actions[0].id, all.mm.actions[0].call, all.mm.actions[0].folder], ['mass-restore-go', 'restoreMassBefore', null]);
  const one = home('home-mass', { massAsk: { folder: PICS.toUpperCase() } });
  assert.equal(one.mm.box.title, '「사진」 폴더를 지워지기 전 판으로 되살릴까요?'); assert.equal(one.mm.actions[0].folder, PICS);
  // 바뀐 폴더가 아닌 것을 물으면, 그리고 고르는 자리로 바꾸면 묻지 않는다
  assert.equal(home('home-mass', { massAsk: { folder: 'C:\\Elsewhere' } }).mm.box, null);
  assert.equal(home('home-mass', { massAsk: { folder: null }, place: 'pick' }).mm.box, null);

  // 되살린 뒤 — 결과 줄이 그 판을 말하고, 주 단추는 「확인을 마침」이다
  const done = home('home-mass-restored');
  assert.deepEqual(done.mm.actions.map((x) => [x.id, x.label, x.massAsk || x.call]), [['mass-done', '확인을 마침', 'ok'], ['mass-restore', '다시 되살리기', 'restore']]);
  assert.equal(done.mm.restored.text, '오후 2:30에 어제 오전 11:02 판에서 바뀐 폴더를 「되살린 파일 (11월 13일)」에 통째로 되살렸습니다.');
  assert.equal(done.mm.restored.act.call, 'openRestoreFolder');
  // 카본 A3 — 되살린 뒤의 「확인을 마침」 상자는 「내가 한 일이 맞을 때만」이라 하지 않는다
  const doneOk = home('home-mass-restored', { massAsk: 'ok' }).mm.box.text;
  assert.match(doneOk, /되살린 파일에서 필요한 것을 다 옮겼을 때 누르세요\./); assert.doesNotMatch(doneOk, /내가 한 일이 맞을 때만/);
  assert.match(ok.mm.box.text, /내가 한 일이 맞을 때만 누르세요\./);
  // FA1 — 한 폴더만 받았거나 범위를 모르면 「확인을 마침」을 앞세우지 않는다
  const got1 = home('home-mass-restored-one');
  assert.deepEqual(got1.mm.actions.map((x) => [x.id, x.kind]), [['mass-restore', 'main'], ['mass-done', 'line']]);
  assert.equal(got1.mm.notes[0], '아직 「문서」 폴더는 되살리지 않았습니다. 다 받은 뒤 「확인을 마침」을 누르세요.');
  // -b 2 — 창이 모아 둔 받은 폴더와 합쳐, 하나씩 다 받았으면 「확인을 마침」이 주 단추다
  const got1s = STATES['home-mass-restored-one'];
  assert.equal(draw(got1s, { massGot: { beforeId: got1s.massHold.beforeId, all: false, folders: ['C:\\Users\\studio\\Documents'] } }).mm.actions[0].id, 'mass-done');
  assert.equal(draw(got1s, { massGot: { beforeId: 'd'.repeat(64), all: false, folders: ['C:\\Users\\studio\\Documents'] } }).mm.actions[0].id, 'mass-restore');
  assert.equal(got1.mm.restored.text, '오후 2:30에 어제 오전 11:02 판에서 「사진」 폴더를 「되살린 파일 (11월 13일)」에 통째로 되살렸습니다.');
  const unk = home('home-mass-restored-unknown');
  assert.equal(unk.mm.actions[0].id, 'mass-restore'); assert.match(unk.mm.notes[0], /바뀐 폴더가 다 왔는지/);
  assert.equal(unk.mm.restored.text, '오후 2:30에 어제 오전 11:02 판에서 「되살린 파일 (11월 13일)」에 되살렸습니다.');
  // 엔진이 범위를 적지 않아도 이 창이 보낸 것(massSent)으로 가린다 — 보낸 뒤에 끝난 결과만
  const u0 = STATES['home-mass-restored-unknown'], sentAt = Date.parse('2026-11-13T14:10:00+09:00');
  assert.equal(draw(u0, { massSent: { beforeId: u0.massHold.beforeId, folder: null, at: sentAt } }).mm.actions[0].id, 'mass-done');
  const sentOne = draw(u0, { massSent: { beforeId: u0.massHold.beforeId, folder: PICS, at: sentAt } });
  assert.equal(sentOne.mm.actions[0].id, 'mass-restore'); assert.match(sentOne.mm.restored.text, /「사진」 폴더를/); assert.match(sentOne.mm.notes[0], /아직 「문서」 폴더는/);
  assert.equal(draw(u0, { massSent: { beforeId: u0.massHold.beforeId, folder: null, at: Date.parse('2026-11-13T14:35:00+09:00') } }).mm.actions[0].id, 'mass-restore');
  assert.equal(draw(u0, { massSent: { beforeId: 'd'.repeat(64), folder: null, at: sentAt } }).mm.actions[0].id, 'mass-restore');
  // 다시 검수 -c 1 — 남은 폴더는 두 곳까지 이름으로, 나머지는 「등 N곳」
  const f4 = STATES['home-mass-four'], DOCS = 'C:\\Users\\studio\\Documents', DESK = 'C:\\Users\\studio\\Desktop';
  const f4got = { ...f4, lastRestore: { ...r0Done(), mass: { beforeId: f4.massHold.beforeId, beforeAt: f4.massHold.beforeAt } } };
  assert.equal(draw(f4got, { massSent: { beforeId: f4.massHold.beforeId, folder: DOCS, at: sentAt } }).mm.notes[0], '아직 「바탕화면」 · 「사진」 등 3곳은 되살리지 않았습니다. 다 받은 뒤 「확인을 마침」을 누르세요.');
  // -c 2 — 100만 개를 넘어 지금 받을 수 없는 폴더는 「다 받은 뒤」에서 뺀다
  const bigErr = { ...f4got, lastRestoreError: { code: 'CATALOG_TOO_LARGE', at: '2026-11-13T05:38:00.000Z' } };
  const bigOpts = { massGot: { beforeId: f4.massHold.beforeId, all: false, folders: [DOCS] }, massSent: { beforeId: f4.massHold.beforeId, folder: DESK, at: Date.parse('2026-11-13T14:35:00+09:00') } };
  const bigNote = draw(bigErr, bigOpts).mm;
  assert.equal(bigNote.notes[0], '아직 「사진」 · 「Projects」 폴더는 되살리지 않았습니다. 다 받은 뒤 「확인을 마침」을 누르세요.');
  assert.match(bigNote.restored.text, /「바탕화면」 폴더는 파일과 폴더가 100만 개를 넘어 통째로 받을 수 없습니다/);
  const bigRest = draw(bigErr, { ...bigOpts, massGot: { ...bigOpts.massGot, folders: [DOCS, 'C:\\Users\\studio\\Pictures', 'D:\\Projects'] } }).mm;
  assert.equal(bigRest.notes[0], '「바탕화면」 폴더 말고는 다 되살렸습니다. 그 폴더가 필요 없으면 「확인을 마침」을 누르세요.');
  // -d FA2 — 남은 것이 받을 수 없는 큰 폴더뿐이면 반드시 실패할 전체 되살리기를 단추로 두지 않는다
  assert.deepEqual(bigRest.actions.map((a) => [a.id, a.kind]), [['mass-done', 'line']]);
  // GPT 검수 r9 GA1 — 목록 화면도 창 기억(massBig)을 받아 기본 화면과 같은 단추만 둔다
  const ro = STATES['home-mass-restored-one'], roDocs = ro.massHold.folders.find((f) => /Documents/.test(f.path)).path, roAcct = { massBig: { beforeId: ro.massHold.beforeId, folders: [roDocs] } };
  assert.deepEqual(m.homeModel(ro, { now: NOW, massBig: roAcct.massBig }).actions.map((a) => a.id), ['mass-done']);
  const roList = renderScreen('mass-list', { state: ro, model: m.homeModel(ro, { now: NOW, massBig: roAcct.massBig }), now: NOW, ui: {}, acct: roAcct, fake: true }).html;
  assert.doesNotMatch(roList, /data-act="mass-restore"/); assert.match(roList, /data-act="mass-done"/);
  // r9fix F1 — 받을 수 없는 큰 폴더 줄에는 「이 폴더만 되살리기」를 두지 않고 그렇다고 쓴다. 다른 폴더 줄은 그대로
  assert.deepEqual([...roList.matchAll(/data-act="mass-one" data-path="([^"]+)"/g)].map((x) => x[1]).filter((p) => p === roDocs), []);
  assert.match(roList, /<span class="meta">[^<]*Documents<\/span><br><span class="meta">100만 개가 넘어 지금은 받을 수 없음<\/span>/); assert.match(roList, /data-act="mass-one" data-path="[^"]*Pictures"/);
  assert.deepEqual(m.massBigOf(ro, null, { beforeId: 'f'.repeat(64), folders: [roDocs] }).list, []);
  // -d FA1 — 다음 되살리기가 실패 칸을 지운 뒤에도 창이 모은 큰 폴더(massBig)는 「다 받은 뒤」에서 빠진다
  const cleared = draw(f4got, { ...bigOpts, massBig: { beforeId: f4.massHold.beforeId, folders: [DESK] } }).mm;
  assert.equal(cleared.notes[0], '아직 「사진」 · 「Projects」 폴더는 되살리지 않았습니다. 다 받은 뒤 「확인을 마침」을 누르세요.');
  assert.match(draw(f4got, { ...bigOpts, massBig: { beforeId: 'e'.repeat(64), folders: [DESK] } }).mm.notes[0], /「바탕화면」 · 「사진」 등 3곳은/);
  // -d FA3 — 옛 PC 백업 꺼내기의 실패(from)는 멈춤의 100만 개 실패가 아니다
  assert.equal(m.massTooBig({ ...bigErr, lastRestoreError: { ...bigErr.lastRestoreError, from: 'ffffffffffff' } }, bigOpts.massSent), null);
  assert.equal(m.massTooBig(bigErr, bigOpts.massSent), DESK);
  // E31(엔진 b18e0775b) — 실패 칸에 범위가 있으면 그것만 믿는다. 바뀐 폴더 모두(null)면 이 창이 앞서 보낸 한 폴더로 가리지 않는다
  assert.equal(m.massTooBig({ ...bigErr, lastRestoreError: { ...bigErr.lastRestoreError, mass: { folder: DOCS, sub: '' } } }, bigOpts.massSent), DOCS);
  assert.equal(m.massTooBig({ ...bigErr, lastRestoreError: { ...bigErr.lastRestoreError, mass: { folder: null, sub: '' } } }, bigOpts.massSent), null);
  // 바뀐 폴더가 하나뿐이면 그 폴더를 받은 것이 모두다
  const b0 = STATES['home-mass-bytes'];
  assert.equal(draw({ ...b0, lastRestore: { ...r0Done(), mass: { beforeId: b0.massHold.beforeId, beforeAt: b0.massHold.beforeAt, folder: b0.massHold.path } } }).mm.actions[0].id, 'mass-done');
  // 다른 판(beforeId)에서 받았거나 멈추기 전에 받은 것은 이 멈춤의 것이 아니다
  const r0 = STATES['home-mass-restored'];
  function r0Done() { return STATES['home-mass-restored'].lastRestore; }
  assert.equal(draw({ ...r0, lastRestore: { ...r0.lastRestore, mass: { ...r0.lastRestore.mass, beforeId: 'd'.repeat(64) } } }).mm.actions[0].id, 'mass-restore');
  assert.equal(draw({ ...r0, lastRestore: { ...r0.lastRestore, at: '2026-11-13T05:00:00.000Z' } }).mm.actions[0].id, 'mass-restore');
  // 멈춤이 풀린 뒤에도 하루는 그 결과 줄을 둔다
  assert.match(draw({ ...r0, massHold: null, protection: STATES.home.protection }).mm.restored.text, /어제 오전 11:02 판에서 바뀐 폴더를/);

  // 멈춤이 있는 동안 끝난 되살리기의 실패 — 「전체」라 하지 않는다
  assert.equal(home('home-mass-failed').mm.restored.text, '오후 2:20에 되살리기를 마치지 못했습니다. 100만 개가 넘는 폴더가 있습니다. 「지워지거나 바뀐 파일 3,992개 보기」에서 폴더마다 되살려 주세요.');
  assert.equal(home('home-mass-failed').mm.notes.length, 1);
  // 카본 A4 — 멈추기 전의 실패는 멈춤의 실패가 아니다(「전체를」 글 그대로, 안내 줄도 둘 다)
  const preErr = draw({ ...STATES['home-mass-failed'], lastRestoreError: { code: 'NO_SPACE', at: '2026-11-13T05:00:00.000Z' } });
  assert.match(preErr.mm.restored.text, /전체를 되살리지 못했습니다/); assert.equal(preErr.mm.notes.length, 2);
  const f0 = STATES['home-mass-failed'];
  assert.match(draw({ ...f0, massHold: STATES['home-mass-bytes'].massHold }).mm.restored.text, /파일과 폴더가 100만 개를 넘습니다\. 안쪽 폴더만 꺼내는 길은 다음 업데이트에서 엽니다\./);
  assert.equal(draw({ ...f0, lastRestoreError: { code: 'CANCELED', at: f0.lastRestoreError.at } }).mm.restored.text, '오후 2:20에 되살리기를 그만두었습니다.');
  // FA5 — 한 폴더만 받다 100만 개를 넘었으면 그 폴더를 말하고 폴더마다 받으라고 하지 않는다
  const tooOne = draw(f0, { massSent: { beforeId: f0.massHold.beforeId, folder: PICS, at: Date.parse('2026-11-13T14:10:00+09:00') } }).mm.restored.text;
  assert.match(tooOne, /「사진」 폴더는 파일과 폴더가 100만 개를 넘어 통째로 받을 수 없습니다\. 안쪽 폴더만 꺼내는 길은 다음 업데이트에서 엽니다\./); assert.doesNotMatch(tooOne, /폴더마다/);
  assert.match(draw({ ...f0, lastRestoreError: { code: 'NO_SPACE', at: f0.lastRestoreError.at } }).mm.restored.text, /되살리기를 마치지 못했습니다\. 놓을 드라이브에 빈 공간이 모자랍니다/);

  // 목록 화면 — 바뀐 폴더(폴더마다 되살리기)와 이름 500개
  const s = STATES['home-mass'], list = renderScreen('mass-list', { state: s, model: m.homeModel(s, { now: NOW }), now: NOW, ui: {}, acct: {}, fake: true });
  assert.equal(list.here, '한꺼번에 지워짐'); assert.equal(list.back, 'home');
  assert.equal((list.html.match(/class="fl plain"/g) || []).length, 500);
  assert.match(strip(list.html), /파일 3,992개 가운데 500개/); assert.match(strip(list.html), /목록은 500개까지만 보입니다/);
  assert.match(list.html, /<span class="nm">계약서 001\.docx<\/span><span class="vl">지워짐<\/span><span class="ds">문서 › 계약 › 2026<\/span>/);
  assert.match(list.html, /<span class="nm">IMG_4101\.jpg<\/span><span class="vl"><span class="x">바뀜<\/span><\/span><span class="ds">사진 › 2026 송년회<\/span>/);
  assert.deepEqual([...list.html.matchAll(/data-act="mass-one" data-path="([^"]+)"/g)].map((x) => x[1].replace(/\\/g, '/')), ['C:/Users/studio/Documents', 'C:/Users/studio/Pictures']);
  assert.deepEqual(list.acts['mass-one'], { id: 'mass-one', massAsk: 'one' });
  const listPick = renderScreen('mass-list', { state: s, model: m.homeModel(s, { now: NOW }), now: NOW, ui: { place: 'pick' }, acct: {}, fake: true });
  assert.deepEqual(listPick.acts['mass-one'], { id: 'mass-one', call: 'restoreMassBefore', perFolder: true });
  // 카본 A2 — 고르는 자리에서 「확인을 마침」 상자를 연 채로도 폴더마다 단추는 바로 부른다
  const pickOk = renderScreen('mass-list', { state: s, model: m.homeModel(s, { now: NOW, massAsk: 'ok', place: 'pick' }), now: NOW, ui: { place: 'pick', massAsk: 'ok' }, acct: {}, fake: true });
  assert.deepEqual(pickOk.acts['mass-one'], { id: 'mass-one', call: 'restoreMassBefore', perFolder: true });
  // 목록 화면에서 한 번 더 묻는 동안(링크가 없는 모델)에도 그린다 — 앞 판은 여기서 멈췄다
  for (const ask of [{ folder: PICS }, { folder: null }, 'ok']) {
    const asked = renderScreen('mass-list', { state: s, model: m.homeModel(s, { now: NOW, massAsk: ask }), now: NOW, ui: { massAsk: ask }, acct: {}, fake: true });
    assert.match(asked.html, /class="box/); assert.equal((asked.html.match(/class="fl plain"/g) || []).length, 500);
  }
  // FA2 — 목록 화면에 있는 동안 기본 화면이 다른 일(도는 백업)을 먼저 보이면 멈춤 단추를 다 막고 까닭을 쓴다
  const runSt = { ...s, job: { kind: 'backup', stage: '백업 중', percent: 10, scheduled: true } };
  const listRun = renderScreen('mass-list', { state: runSt, model: m.homeModel(runSt, { now: NOW }), now: NOW, ui: {}, acct: {}, fake: true }).html;
  assert.match(listRun, /지금 다른 일이 도는 중입니다\. 끝나면 누를 수 있습니다\./);
  assert.equal((listRun.match(/data-act="mass-(restore|ok|one)"[^>]*aria-disabled="true"/g) || []).length, 4);
  // 도는 호출이 있으면 폴더마다의 단추와 자리 바꾸기를 막는다
  const busy = renderScreen('mass-list', { state: s, model: m.homeModel(s, { now: NOW }), now: NOW, ui: {}, acct: { running: 'mass-restore-go' }, fake: true }).html;
  assert.equal((busy.match(/data-act="mass-one"[^>]*aria-disabled="true"/g) || []).length, 2); assert.match(busy, /data-act="place-pick" aria-disabled="true"/);
  // 바뀐 폴더가 하나면 폴더마다의 단추가 없다. 폴더를 가르지 못한 판은 판 안의 경로로 쓴다
  const sb = STATES['home-mass-bytes'], lb = renderScreen('mass-list', { state: sb, model: m.homeModel(sb, { now: NOW }), now: NOW, ui: {}, acct: {}, fake: true });
  assert.doesNotMatch(lb.html, /data-act="mass-one"/); assert.equal(lb.acts['mass-one'], undefined); assert.doesNotMatch(lb.html, /500개까지만/);
  const sn = STATES['home-mass-nofolder'], ln = renderScreen('mass-list', { state: sn, model: m.homeModel(sn, { now: NOW }), now: NOW, ui: {}, acct: {}, fake: true }).html;
  assert.match(ln, /<span class="nm">계약서 001\.docx<\/span><span class="vl">지워짐<\/span><span class="ds">C › Users › studio › Documents › 계약 › 2026<\/span>/); assert.doesNotMatch(ln, /<h2>바뀐 폴더/);
  assert.match(ln, /되살리기는 백업한 폴더를 통째로 받으므로/);
  // 이름은 h()로 막는다
  const evil = { ...s, massHold: { ...s.massHold, list: [{ folder: s.massHold.path, name: '<img src=x onerror=alert(1)>.txt', kind: 'removed' }] } };
  assert.doesNotMatch(renderScreen('mass-list', { state: evil, model: m.homeModel(evil, { now: NOW }), now: NOW, ui: {}, acct: {}, fake: true }).html, /<img/);
  // 멈춤이 없으면 목록 화면은 기본 화면을 그린다
  assert.equal(renderScreen('mass-list', { state: STATES.home, model: m.homeModel(STATES.home, { now: NOW }), now: NOW, ui: {}, acct: {}, fake: true }).kind, 'home');
  // 빠지거나 이상한 칸을 견딘다
  const odd = draw({ ...STATES.home, massHold: { kind: 'changed', removed: 'x', changed: -3, folders: null, list: [{}, { name: 5 }, null], path: 7 } });
  assert.equal(odd.mm.title, '많은 파일의 내용이 한꺼번에 바뀌었습니다.'); assert.match(odd.mm.sub, /^백업한 폴더에서 파일 0개의 내용이 바뀌었습니다/);
  assert.equal(m.massOf({ massHold: { list: [{}, { name: 5 }, null, { name: 'a', folder: '' }] } }).list.length, 1);

  // 「파일 되살리기」 화면 — 지워지기 전 판은 기본 화면의 단추로 꺼낸다
  const rs = strip(renderScreen('restore', { state: s, model: m.homeModel(s, { now: NOW }), now: NOW, ui: {}, acct: {}, fake: true }).html);
  assert.match(rs, /한꺼번에 지워지기 전의 판은 기본 화면에서 꺼냅니다\. 이 목록은 가장 최근 판입니다\./);
  assert.doesNotMatch(rs, /준비 중/);
});

test('이 백업에 담지 못하는 이름(설계 4.2 — leftOutNames, 조율 세션 부탁 · GPT 검수 workbackup-oddnames-20261120 GA1): 주의 · 목록', async () => {
  const m = await load('screen-model.js');
  const { renderScreen } = await load('screen-view.js');
  const { STATES, NOW } = await load('engine-fixtures.js');
  const strip = (x) => x.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const draw = (s, opts = {}) => { const mm = m.homeModel(s, { now: NOW, ...opts }); return { mm, html: strip(renderScreen('home', { state: s, model: mm, now: NOW, ui: {}, acct: {}, fake: true }).html), out: renderScreen('home', { state: s, model: mm, now: NOW, ui: {}, acct: {}, fake: true }) }; };

  // 「안전합니다」 대신 주의 — 수와 이름 둘, 나머지 수, 목록 고리
  const a = draw(STATES['home-leftout']);
  assert.equal(a.mm.id, 'home-leftout'); assert.equal(a.mm.tone, 'warn'); assert.equal(a.mm.title, '이름 때문에 담지 못한 파일이 있습니다.');
  assert.equal(a.mm.sub, '이름 끝에 점(.)이나 빈칸이 있는 파일이나 폴더 3개는 Windows에서 백업할 수 없습니다. 이름을 바꾸면 다음 백업에 담깁니다.');
  assert.deepEqual(a.mm.notes, ['「2026 견적서.」 · C: › Users › studio › Documents › 견적', '「회의록 」(끝에 빈칸 1개) · C: › Users › studio › Desktop', '외 1개']);
  assert.deepEqual(a.mm.links.map((l) => [l.label, l.to]), [['어떤 파일인지 보기', 'left-out']]); assert.equal(a.out.acts['left-out'].to, 'left-out');
  assert.equal(a.mm.actions[0].label, '파일 되살리기'); assert.ok(a.mm.actions.filter((x) => x.kind === 'main').length <= 1);
  // 쓰는 중인 파일과 함께 — 둘 다 쓰고 고리도 둘
  const p = draw(STATES['home-leftout-partial']);
  assert.equal(p.mm.id, 'home-leftout'); assert.match(p.mm.notes.at(-1), /Outlook이 쓰는 중인 파일 2개는 앞 판으로 지킵니다\./);
  assert.deepEqual(p.mm.links.map((l) => l.to), ['left-out', 'partial']); assert.ok(p.out.acts.partial && p.out.acts['left-out']);
  assert.match(p.html, /어떤 파일인지 보기.*쓰는 중인 파일 보기/);
  // 많음(cut) — 「1,000개 이상은」
  const many = draw(STATES['home-leftout-many']);
  assert.match(many.mm.sub, /폴더 1,000개 이상은 Windows에서/); assert.equal(many.mm.notes.at(-1), '외 998개 이상');
  // 자동 백업이 꺼진 PC에도 한 줄과 고리(알림이 뜨지 않는다)
  const off = draw(STATES['home-leftout-off']);
  assert.equal(off.mm.id, 'home-off'); assert.equal(off.mm.link.to, 'left-out'); assert.equal(off.mm.link.label, '백업에 담지 못한 이름 3개 보기');
  // Opus 대체 검수 F1 — 백업이 도는 다른 주의 화면에도 무엇인지 말하는 고리. 한 번 더 묻는 동안은 두지 않는다
  for (const k of ['home-lost-step', 'home-writekey', 'home-missing', 'home-probe', 'home-restore-error', 'home-health', 'home-error', 'home-overdue', 'home-credential', 'home-startup', 'home-paused']) {
    const w = draw(STATES[`${k}-leftout`]);
    assert.notEqual(w.mm.id, 'home-leftout', k); assert.deepEqual(w.mm.notes, draw(STATES[k]).mm.notes, `${k} — 줄은 더하지 않는다`);
    assert.ok(w.mm.links.at(-1).to === 'left-out' && w.mm.links.at(-1).label === '백업에 담지 못한 이름 3개 보기' && w.out.acts['left-out'], k);
    if (draw(STATES[k]).mm.link) assert.ok(w.mm.links.length === 2 && w.mm.links[0].to !== 'left-out', `${k} — 원래 고리를 지킨다`);
  }
  const mw = draw(STATES['home-mass-leftout']);
  assert.deepEqual(mw.mm.links.map((l) => l.to), ['mass-list', 'left-out']); assert.match(draw({ ...STATES['home-mass'], leftOutNames: STATES['home-leftout-many'].leftOutNames }).mm.links[1].label, /백업에 담지 못한 이름 1,000개 이상 보기/);
  assert.equal(draw(STATES['home-mass-leftout'], { massAsk: 'ok' }).mm.links, undefined);
  // 다시 검수 -b 2 — 한꺼번에 지워짐에서 되살리기가 실패한 날에도 고리를 둔다(멈춘 동안에도 백업은 돈다)
  const mf = draw(STATES['home-mass-failed-leftout']);
  assert.ok(mf.mm.restored && mf.mm.notes.length === 1 && mf.mm.links.map((l) => l.to).join() === 'mass-list,left-out' && mf.out.acts['left-out'], JSON.stringify(mf.mm.links));
  // 넘긴 PC · 되살리기만 하는 PC에는 두지 않는다
  assert.ok(!draw({ ...STATES['home-moved'], leftOutNames: STATES['home-leftout'].leftOutNames }).mm.links);
  // F3 — 쓰는 중인 파일 줄이 있으니 확인서에 「쓰는 중이라 앞 판으로」 줄을 또 두지 않는다
  assert.ok(!p.mm.evidence.rows?.some?.((r) => r.k === '쓰는 중이라 앞 판으로') && !JSON.stringify(p.mm.evidence).includes('쓰는 중이라 앞 판으로'));
  // F2 — 목록의 이름 줄은 줄을 바꾸는 꼴(lo)이다
  assert.match(renderScreen('left-out', { state: STATES['home-leftout'], model: m.homeModel(STATES['home-leftout'], { now: NOW }), now: NOW, ui: {}, acct: {}, fake: true }).html, /class="fl plain lo"/);
  // 찾은 것이 없으면(다 보지 못했어도) 그대로 안전
  assert.equal(draw(STATES['home-leftout-none']).mm.id, 'home');
  // 다른 주의(한꺼번에 지워짐 등)가 먼저다
  assert.equal(draw({ ...STATES['home-mass'], leftOutNames: STATES['home-leftout'].leftOutNames }).mm.id, 'home-mass');

  // 목록 — 이름은 끝의 점이나 빈칸이 보이게 「」로, 위 폴더 경로, 다 보지 못한 날의 한 줄, 「외 N개」
  const s = STATES['home-leftout'], list = renderScreen('left-out', { state: s, model: m.homeModel(s, { now: NOW }), now: NOW, ui: {}, acct: {}, fake: true });
  assert.equal(list.here, '담지 못한 이름'); assert.equal(list.back, 'home');
  assert.match(list.html, /<span class="nm">「회의록 」<\/span><span class="vl">끝에 빈칸 1개<\/span><span class="ds">C: › Users › studio › Desktop<\/span>/);
  assert.equal((list.html.match(/class="fl plain lo"/g) || []).length, 3); assert.doesNotMatch(strip(list.html), /다 보지 못했습니다/);
  assert.match(strip(list.html), /파일이나 폴더 3개는 이름 때문에 백업에 담지 못했습니다\./); assert.match(strip(list.html), /3개 · 오후 2:02에 찾음/);
  const un = STATES['home-leftout-unchecked'];
  assert.match(strip(renderScreen('left-out', { state: un, model: m.homeModel(un, { now: NOW }), now: NOW, ui: {}, acct: {}, fake: true }).html), /이번 백업은 폴더를 다 보지 못했습니다\./);
  const mn = STATES['home-leftout-many'], lm = renderScreen('left-out', { state: mn, model: m.homeModel(mn, { now: NOW }), now: NOW, ui: {}, acct: {}, fake: true }).html;
  assert.equal((lm.match(/class="fl plain lo"/g) || []).length, 1000); assert.doesNotMatch(lm, /외 0개/);
  const more = { ...s, leftOutNames: { ...s.leftOutNames, count: 1500, cut: false } };
  assert.match(strip(renderScreen('left-out', { state: more, model: m.homeModel(more, { now: NOW }), now: NOW, ui: {}, acct: {}, fake: true }).html), /외 1,497개/);
  // 이름은 h()로 막는다 · 없으면 기본 화면 · 이상한 칸을 견딘다
  const evil = { ...s, leftOutNames: { ...s.leftOutNames, names: ['C:\\x\\<img src=x onerror=alert(1)>.'] } };
  assert.doesNotMatch(renderScreen('left-out', { state: evil, model: m.homeModel(evil, { now: NOW }), now: NOW, ui: {}, acct: {}, fake: true }).html, /<img/);
  assert.equal(renderScreen('left-out', { state: STATES.home, model: m.homeModel(STATES.home, { now: NOW }), now: NOW, ui: {}, acct: {}, fake: true }).kind, 'home');
  // Opus 대체 검수(leftout-engine) F1 — 수는 알지만 이름을 모르는 몫(names 빈 목록)이면 「외」 대신 그렇다고 쓴다
  const unnamed = { ...STATES.home, leftOutNames: { at: s.leftOutNames.at, count: 5, names: [], cut: true, checked: false } };
  assert.deepEqual(m.homeModel(unnamed, { now: NOW }).notes, [m.UNNAMED]);
  assert.deepEqual(m.homeModel(unnamed, { now: NOW }).links.map((l) => [l.label, l.to]), [['자세히 보기', 'left-out']]);
  // 더 급한 주의 화면의 고리도 이름을 모르면 이름을 보여 준다고 하지 않는다
  assert.deepEqual(m.homeModel({ ...STATES['home-missing'], leftOutNames: unnamed.leftOutNames }, { now: NOW }).links.at(-1), { label: '이름 때문에 담지 못한 파일 자세히 보기', to: 'left-out' });
  const ul = strip(renderScreen('left-out', { state: unnamed, model: m.homeModel(unnamed, { now: NOW }), now: NOW, ui: {}, acct: {}, fake: true }).html);
  assert.match(ul, /이름은 아직 알아내지 못했습니다/); assert.doesNotMatch(ul, /외 5개|찾은 이름이 없습니다/);
  // GPT 검수 r9 GA3 — 끝 빈칸이 하나인 이름과 둘인 이름을 화면 글로 가른다(목록은 칸을 접지 않는 꼴 · 「끝에 빈칸 N개」, 기본 화면 줄도 같은 말)
  const two = { ...s, leftOutNames: { ...s.leftOutNames, names: [String.raw`C:\x\회의록 `, String.raw`C:\x\회의록  `, String.raw`C:\x\메모 . `] } };
  assert.deepEqual(m.homeModel(two, { now: NOW }).notes.slice(0, 2), ['「회의록 」(끝에 빈칸 1개) · C: › x', '「회의록  」(끝에 빈칸 2개) · C: › x']);
  const tl = renderScreen('left-out', { state: two, model: m.homeModel(two, { now: NOW }), now: NOW, ui: {}, acct: {}, fake: true }).html;
  assert.deepEqual([...tl.matchAll(/<span class="vl">([^<]*)<\/span>/g)].map((x) => x[1]), ['끝에 빈칸 1개', '끝에 빈칸 2개', '끝에 빈칸 1개']);
  // r9fix F2 — 기본 화면의 이름 줄도 빈칸을 접지 않는 꼴(keep)이다
  assert.match(renderScreen('home', { state: two, model: m.homeModel(two, { now: NOW }), now: NOW, ui: {}, acct: {}, fake: true }).html, /<p class="note lo">「회의록  」/);
  assert.equal(m.leftOutName(String.raw`C:\x\견적서.`).mark, ''); assert.equal(m.leftOutName(String.raw`C:\x\회의록 .`).mark, '');
  const odd = m.leftOutOf({ leftOutNames: { count: 'x', names: [null, 5, 'C:\\a.'], checked: 0 } });
  assert.deepEqual([odd.count, odd.names.length, odd.checked, odd.cut], [1, 1, true, false]);
  assert.equal(m.leftOutOf({ leftOutNames: null }), null);
});
