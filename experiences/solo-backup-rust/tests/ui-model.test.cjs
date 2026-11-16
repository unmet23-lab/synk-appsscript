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
  const old = homeModel({ ...base, lastRestore: { path: 'x', at: new Date(NOW - 2 * 86400000).toISOString() } }, { now: NOW });
  assert.equal(old.restored, undefined);
  const failed = { ...STATES['home-error'], lastError: '복구 폴더를 만들지 못했습니다.' };
  assert.equal(homeModel(failed, { now: NOW, restoreFail: { error: '복구 폴더를 만들지 못했습니다.' } }).id, 'home-restore-failed');
  assert.equal(homeModel(failed, { now: NOW }).id, 'home-error');
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
  for (const code of ['OUTPUT_UNSAFE', 'NO_SPACE', 'CATALOG_TOO_LARGE', 'SELECTION_LIMIT', 'CREDENTIAL_REQUIRED', 'NO_SNAPSHOT', 'UNSAFE_MANIFEST', 'LAST_FOLDER', 'INTEGRITY_FAILED']) {
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

test('전체 되살리기 실패 가리기: 엔진의 실제 알림 순서(작업이 남은 채 lastError를 적고, 그 뒤 작업을 비움)로 본다(Fable FA1)', async () => {
  const { createRestoreWatch } = await load('screen-model.js');
  const run = (states) => { const w = createRestoreWatch(); let last = null; for (const s of states) last = w.see(s); return last; };
  const job = { kind: 'restore', stage: '복구 중', percent: null };
  // 실패: 시작 → 단계 → save(작업 남음, lastError 적힘) → 작업 비움
  assert.deepEqual(run([{ lastError: null }, { job, lastError: null }, { job: { ...job, stage: '내려받는 중' }, lastError: null }, { job, lastError: '복구 폴더를 만들지 못했습니다.' }, { job: null, lastError: '복구 폴더를 만들지 못했습니다.' }]), { error: '복구 폴더를 만들지 못했습니다.' });
  // 앞서 백업 실패가 있었는데 되살리기가 성공해 지워졌으면 아무것도 아니다
  assert.equal(run([{ lastError: '백업 실패' }, { job, lastError: '백업 실패' }, { job, lastError: null }, { job: null, lastError: null }]), null);
  // 앞서 백업 실패가 있었고 되살리기도 실패하면 되살리기 실패다
  assert.deepEqual(run([{ lastError: '백업 실패' }, { job, lastError: '백업 실패' }, { job, lastError: '되살리기 실패' }, { job: null, lastError: '되살리기 실패' }]), { error: '되살리기 실패' });
  // 되살리기가 아닌 작업의 실패는 건드리지 않는다
  assert.equal(run([{ lastError: null }, { job: { kind: 'backup' }, lastError: null }, { job: null, lastError: '백업 실패' }]), null);
  // 실패를 알린 뒤 lastError가 지워지면(다음 백업 성공) 되살리기 실패도 내린다
  const w = createRestoreWatch(); w.see({ job, lastError: null }); w.see({ job: null, lastError: 'X' });
  assert.equal(w.see({ job: null, lastError: null }), null);
  // 같은 글로 두 번 실패해도 둘째도 되살리기 실패다(Fable 셋째 회차 FA1 — 엔진은 작업 시작 때 lastError를 지우지 않는다)
  const E = '분리된 복구 폴더를 선택해 주세요.';
  assert.deepEqual(run([{ lastError: null }, { job, lastError: null }, { job, lastError: E }, { job: null, lastError: E }, { job, lastError: E }, { job, lastError: E }, { job: null, lastError: E }]), { error: E });
  // 실제 화면 길: 실패 화면의 「파일 되살리기」는 목록 열기(browse)를 거친다. 목록만 보고 돌아와도, 이어서 같은 글로 또 실패해도 되살리기 실패다(넷째 회차 FA1)
  const browse = { kind: 'browse', stage: '파일 목록 확인 중', percent: null };
  assert.deepEqual(run([{ lastError: null }, { job, lastError: null }, { job, lastError: E }, { job: null, lastError: E }, { job: browse, lastError: E }, { job: null, lastError: E }]), { error: E });
  assert.deepEqual(run([{ lastError: null }, { job, lastError: null }, { job, lastError: E }, { job: null, lastError: E }, { job: browse, lastError: E }, { job: null, lastError: E }, { job, lastError: E }, { job: null, lastError: E }]), { error: E });
  assert.deepEqual(run([{ lastError: null }, { job, lastError: null }, { job: null, lastError: E }, { job: { kind: 'restore-selected' }, lastError: E }, { job: null, lastError: E }]), { error: E });
  // 되살리기 실패 뒤 예약 백업이 같은 글로 실패하면 그것은 백업 실패다(FA2)
  assert.equal(run([{ lastError: null }, { job, lastError: null }, { job: null, lastError: E }, { job: { kind: 'backup' }, lastError: E }, { job: null, lastError: E }]), null);
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
