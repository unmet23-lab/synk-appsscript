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
  assert.deepEqual(selected.actions, []);
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
  assert.doesNotMatch(m.sub, /멈춘 폴더/, '폴더를 만들기 전의 실패에는 멈춘 폴더 말이 없다');
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
  assert.equal(homeModel(readOpened, { now: NOW }).actions[1].call, 'chooseSources');
  assert.equal(homeModel({ ...readOpened, nextSources: ['D:\\Projects'] }, { now: NOW }).actions[1].flow, 'takeOver');
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
  assert.doesNotMatch(full, /data-act="revoke/, '토큰 없는 끊기는 엔진 부탁 뒤에 연다(Fable 지적 3)');
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
  // 다른 PC가 쓰는 계정: 옮겨 오기 · 이어서 백업은 아직 잇지 않는다(Fable 지적 1)
  const read = draw('start-2', STATES['start-read']);
  assert.match(read.html, /「작업 노트북」이 하고 있습니다/);
  assert.ok(read.acts.move.pending, '옮겨 오기는 옮겨 오기 메서드 뒤에 잇는다');
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
  assert.equal(homeModel(STATES['home-restore-read'], { now: NOW }).actions[1].flow, 'takeOver');
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
  assert.match(drawer(STATES['home-restore-read'], { devices: [], now: NOW }), /사고가 났을 때 되돌리기[\s\S]*다음 업데이트/);
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
