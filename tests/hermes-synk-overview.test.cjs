'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const status = require('../tools/hermes-synk/status.cjs');
const { readOverview, readTaskRecords, LEDGER_CACHE, LEDGER_TTL_MS, ARGON_CACHE, SNS_CACHE, BACKUP_CACHE, GATEWAY_RECOVERY_STATUS, MONITOR_STATE } = require('../tools/hermes-synk/overview.cjs');
const { plan } = require('../tools/hermes-synk/monitor.cjs');
const NOW = new Date('2026-10-18T08:00:00Z');
const ID = 'synk-123456abcdef';
const UNAVAILABLE = async () => ({ connected: false, tasks: [], checkedAt: null });

function write(base, relative, value) {
  const file = path.join(base, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value), 'utf8');
}

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-overview-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const root = path.join(directory, 'repo');
  const home = path.join(directory, 'hermes');
  fs.mkdirSync(root); fs.mkdirSync(home);
  write(root, 'docs/_ops/트랙.md', '# 트랙\n## 앱\n' + Array.from({ length: 12 }, (_, i) => `- **작업 ${i}:** 확인 기록\n`).join(''));
  write(root, 'docs/참고카드/카드/적용.md', '---\n제목: 적용 카드\n게시물ID: post123\n장부: 2행\n상태: 적용함 (검증기록)\n대상: WORLD 앱\n언제: 지금\n공유일: 2026-10-18\n---\n');
  const docs = { full: 'document_full_id_12345', 'yt-tt': 'document_yt_id_1234567', 'meta-brand': 'document_meta_id_12345', synkbrief: 'document_brief_id_1234' };
  write(root, 'tools/argon-schedules/configuration/docs.json', docs);
  const options = { root, hermesHome: home, now: NOW,
    readArgonRemote: async () => { throw new Error('OFFLINE_TEST'); },
    // 시험은 회사 서버·이 PC의 실제 백업 상태 파일에 닿지 않는다.
    readSnsRemote: async () => { throw new Error('OFFLINE_TEST'); },
    backupHealthFile: path.join(directory, 'no-backup-health.json'), uptimeSeconds: 0,
    readStatus: options => status.readStatus({ ...options, readClaude: UNAVAILABLE, readCodexStatus: UNAVAILABLE }) };
  return { directory, root, home, docs, options };
}

function ledger(rows = [{ row: 2, 게시물ID: 'post123', 상태: '새로', 어디에: 'WORLD 앱', 언제: '지금' }]) { return { ok: true, rows }; }
function task(f, extra = {}) {
  const value = { version: 1, id: ID, repo_root: f.root, engine: 'codex', state: 'running', delivery_mode: 'native_result_direct_v1', created_at: '2026-10-18T07:00:00Z', ...extra };
  write(f.home, `runtime/synk-tasks/${ID}/request.json`, value);
  return value;
}

test('기본 조회는 원격 호출·파일 쓰기 없이 전체 변경 snapshot을 제공한다', async t => {
  const f = fixture(t);
  let calls = 0;
  const report = await readOverview({ ...f.options, readLedger: async () => { calls++; return ledger(); } });
  assert.equal(calls, 0);
  assert.equal(fs.existsSync(path.join(f.home, LEDGER_CACHE)), false);
  assert.equal(report.snapshot.track.items.length, 12);
  assert.equal(report.events.filter(row => row.kind === 'track').length, 12);
  assert.equal(report.coverage.trackComplete, true);
  assert.equal(report.coverage.ledgerAvailable, false);
  assert.equal(report.coverage.noModelCalls, true);
  assert.match(report.text, /현재 원격 상태 미확인/);
  assert.ok(report.text.length <= 3900);
});

test('명시 갱신만 장부를 읽고 카드 원문을 우선하며 비밀없는 캐시만 보관한다', async t => {
  const f = fixture(t);
  const report = await readOverview({ ...f.options, remoteRefresh: true,
    readLedger: async () => ledger([{ row: 2, 게시물ID: 'post123', 상태: '새로', 어디에: 'WORLD 앱', 언제: '지금', token: 'private-secret', 요약: '개인 대화' }]),
  });
  assert.equal(report.snapshot.tips.counts.mismatch, 1);
  assert.equal(report.snapshot.tips.items[0].effectiveStatus, '적용함 (검증기록)');
  assert.equal(report.snapshot.tips.items[0].statusSource, '카드 원문');
  assert.equal(report.snapshot.ledger.stale, false);
  assert.equal(report.snapshot.ledger.cacheSaved, true);
  assert.match(report.text, /장부와 상태 다름 1/);
  const cache = fs.readFileSync(path.join(f.home, LEDGER_CACHE), 'utf8');
  assert.doesNotMatch(cache, /private-secret|개인 대화|token/);
  const cached = await readOverview(f.options);
  assert.equal(cached.snapshot.ledger.available, true);
  assert.equal(cached.snapshot.tips.counts.mismatch, 1);
});

test('조회 시각·mtime·런타임 진행 개수가 바뀌어도 내용 fingerprint는 안정적이다', async t => {
  const f = fixture(t);
  await readOverview({ ...f.options, remoteRefresh: true, readLedger: async () => ledger() });
  const first = await readOverview(f.options);
  const second = await readOverview({ ...f.options, now: new Date(NOW.getTime() + 60_000) });
  assert.equal(first.fingerprint, second.fingerprint);
  const cardPath = path.join(f.root, 'docs/참고카드/카드/적용.md');
  fs.utimesSync(cardPath, new Date('2020-01-01'), new Date('2020-01-01'));
  const touched = await readOverview(f.options);
  assert.equal(first.fingerprint, touched.fingerprint);
  const source = await f.options.readStatus({ root: f.root, now: NOW });
  const a = await readOverview({ ...f.options, readStatus: async () => ({ ...source, runtimes: [{ source: 'Claude', connected: true, stale: false, note: '조회 시점', counts: { running: 1 } }] }) });
  const b = await readOverview({ ...f.options, readStatus: async () => ({ ...source, runtimes: [{ source: 'Claude', connected: true, stale: false, note: '조회 시점', counts: { running: 5 } }] }) });
  assert.equal(a.fingerprint, b.fingerprint);
});

test('장부 실패·TTL 만료는 마지막 성공과 시각을 보존하고 오류원문을 감춘다', async t => {
  const f = fixture(t);
  await readOverview({ ...f.options, remoteRefresh: true, readLedger: async () => ledger() });
  const original = fs.readFileSync(path.join(f.home, LEDGER_CACHE), 'utf8');
  const failed = await readOverview({ ...f.options, remoteRefresh: true, readLedger: async () => { throw new Error('private token URL'); } });
  assert.equal(failed.snapshot.ledger.available, true);
  assert.equal(failed.snapshot.ledger.stale, true);
  assert.equal(failed.snapshot.ledger.refreshFailed, true);
  assert.equal(failed.snapshot.ledger.checkedAt, NOW.toISOString());
  assert.equal(fs.readFileSync(path.join(f.home, LEDGER_CACHE), 'utf8'), original);
  assert.doesNotMatch(JSON.stringify(failed), /private token URL/);
  const expired = await readOverview({ ...f.options, now: new Date(NOW.getTime() + LEDGER_TTL_MS + 1) });
  assert.equal(expired.snapshot.ledger.stale, true);
  assert.equal(expired.snapshot.ledger.rows.length, 1);
});

test('50행 조회 상한과 재사용된 행 번호의 다른 게시물은 구분한다', async t => {
  const f = fixture(t);
  const rows = Array.from({ length: 50 }, (_, i) => ({ row: i + 2, 게시물ID: 'other_' + i, 상태: '새로' }));
  const report = await readOverview({ ...f.options, remoteRefresh: true, readLedger: async () => ledger(rows) });
  assert.equal(report.snapshot.ledger.limited, true);
  assert.equal(report.snapshot.tips.items[0].ledgerStatus, null);
  assert.equal(report.snapshot.tips.items[0].mismatch, false);
});

test('앞 여섯 이후의 트랙 내용 변화도 같은 ID의 변경으로 검출한다', async t => {
  const f = fixture(t);
  const before = await readOverview(f.options);
  const file = path.join(f.root, 'docs/_ops/트랙.md');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('- **작업 11:** 확인 기록', '- **작업 11:** 실제 변경'));
  const after = await readOverview(f.options);
  const old = before.events.find(row => row.title === '작업 11');
  const next = after.events.find(row => row.id === old.id);
  assert.notEqual(old.fingerprint, next.fingerprint);
  assert.notEqual(before.fingerprint, after.fingerprint);
});

test('트랙 읽기 실패는 complete false이며 삭제·완료 이벤트를 만들지 않는다', async t => {
  const f = fixture(t);
  fs.unlinkSync(path.join(f.root, 'docs/_ops/트랙.md'));
  const report = await readOverview(f.options);
  assert.equal(report.coverage.trackComplete, false);
  assert.ok(report.events.some(row => row.id === 'coverage-track'));
  assert.equal(report.events.some(row => /삭제됨|완료됨/.test(row.title)), false);
});

test('작업은 원문·route·개인 세션·결과 본문을 내보내지 않고 실패·미전달을 구분한다', async t => {
  const f = fixture(t);
  task(f, { request: '민감한 개인 요청 원문', route: { user_id: 'private-user-id' }, native_session_id: 'private-session', state: 'exited', exit_code: 0 });
  write(f.home, `runtime/synk-tasks/${ID}/delivery.json`, { status: 'unconfirmed', quota_limited: true, native_error: true, final_found: false, message_id: 'private-message' });
  write(f.home, `runtime/synk-tasks/${ID}/result.txt`, '비밀 결과 원문 sk-private-result');
  const report = await readOverview(f.options);
  const row = report.events.find(row => row.id === 'task-' + ID);
  assert.equal(row.severity, 'error');
  assert.match(row.detail, /오류\/한도/);
  assert.match(row.detail, /전달 미확인/);
  assert.equal(report.snapshot.tasks.items[0].resultAvailable, true);
  const text = JSON.stringify(report);
  for (const secret of ['민감한 개인 요청 원문', 'private-user-id', 'private-session', 'private-message', '비밀 결과 원문', 'sk-private-result', f.root, f.home]) assert.equal(text.includes(secret), false);
});

test('성공 종료·메시지 전송·사용자 잠금 해제는 실제 목표 완료와 구분한다', async t => {
  const f = fixture(t);
  task(f, { state: 'exited', exit_code: 0 });
  write(f.home, `runtime/synk-tasks/${ID}/delivery.json`, { status: 'sent', final_found: true });
  const report = await readOverview(f.options);
  const row = report.events.find(row => row.id === 'task-' + ID);
  assert.equal(row.severity, 'info');
  assert.match(row.detail, /목표 달성은 결과 확인 필요/);
  assert.match(row.detail, /열람 미확인/);
  task(f, { state: 'closed_by_user', exit_code: 1, due_at: '2026-10-17T08:00:00Z', due_source: 'user' });
  const closed = await readOverview(f.options);
  assert.equal(closed.events.find(row => row.id === 'task-' + ID).severity, 'info');
  assert.equal(closed.events.some(row => row.kind === 'deadline'), false);
});

test('명시된 구조화 기한·승인대기만 표시하며 본문 날짜·문장으로 추정하지 않는다', async t => {
  const f = fixture(t);
  task(f, { request: '10월17일까지 해줘. 승인 필요?', due_at: '2026-10-17T08:00:00Z' });
  const inferred = await readOverview(f.options);
  assert.equal(inferred.events.some(row => ['approval', 'deadline'].includes(row.kind)), false);
  task(f, { due_at: '2026-10-17T08:00:00+09:00', due_source: 'user', attention: { kind: 'approval', status: 'pending', summary: '게시 준비 결과 판단' } });
  const explicit = await readOverview(f.options);
  assert.equal(explicit.events.find(row => row.kind === 'deadline').severity, 'warning');
  assert.equal(explicit.events.find(row => row.kind === 'approval').detail, '게시 준비 결과 판단');
  task(f, { due_at: '2026-10-17 08:00', due_source: 'user' });
  assert.equal((await readOverview(f.options)).events.some(row => row.kind === 'deadline'), false);
});

test('다른 저장소·불일치ID·symlink 작업 폴더·잘못된 JSON은 읽지 않는다', async t => {
  const f = fixture(t);
  task(f, { repo_root: f.home, request: '외부 비밀' });
  let report = await readOverview(f.options);
  assert.equal(report.snapshot.tasks.items.length, 0);
  assert.equal(report.coverage.tasksComplete, false);
  task(f, { id: 'synk-aaaaaaaaaaaa' });
  assert.equal(readTaskRecords({ root: f.root, hermesHome: f.home }).items.length, 0);
  const taskFolder = path.join(f.home, `runtime/synk-tasks/${ID}`);
  fs.rmSync(taskFolder, { recursive: true });
  fs.symlinkSync(f.root, taskFolder, process.platform === 'win32' ? 'junction' : 'dir');
  report = await readOverview(f.options);
  assert.equal(report.snapshot.tasks.items.length, 0);
  assert.equal(report.snapshot.tasks.complete, false);
  assert.doesNotMatch(JSON.stringify(report), /외부 비밀/);
});

test('장부 캐시·캐시 쓰기의 symlink가 외부 자료를 읽거나 덮지 않는다', async t => {
  const f = fixture(t);
  const external = path.join(f.directory, 'outside');
  fs.mkdirSync(external);
  write(external, 'ledger-cache.json', { version: 1, checkedAt: NOW.toISOString(), rows: ledger().rows });
  fs.mkdirSync(path.join(f.home, 'runtime'));
  fs.symlinkSync(external, path.join(f.home, 'runtime/synk-overview'), process.platform === 'win32' ? 'junction' : 'dir');
  const bytes = fs.readFileSync(path.join(external, 'ledger-cache.json'));
  const read = await readOverview(f.options);
  assert.equal(read.snapshot.ledger.available, false);
  const refresh = await readOverview({ ...f.options, remoteRefresh: true, readLedger: async () => ledger() });
  assert.equal(refresh.snapshot.ledger.available, true);
  assert.equal(refresh.snapshot.ledger.cacheSaved, false);
  assert.deepEqual(fs.readFileSync(path.join(external, 'ledger-cache.json')), bytes);
});

test('Argon 링크는 고정 문서매핑만 허용하고 저장된 검증과 현재 원격확인을 구분한다', async t => {
  const f = fixture(t);
  const sha = 'a'.repeat(64);
  write(f.root, 'tools/argon-schedules/verification/20261018.json', { firstProduction: {
    role: 'yt-tt', status: 'verified', expectedDocumentId: f.docs['yt-tt'], checkedAt: '2026-10-18T05:35:00Z',
    acceptance: { scheduledRunObserved: true, argonExecutionVerified: true, docsReadbackVerified: true, newDocsSaveVerified: true },
    runState: { status: 'complete', completedAt: '2026-10-18T05:12:51Z', sha256: sha }, docs: { sha256: sha },
  } });
  const report = await readOverview(f.options);
  assert.equal(report.snapshot.research.items.length, 4);
  assert.equal(report.snapshot.research.items.find(row => row.role === 'yt-tt').storedVerified, true);
  assert.equal(report.coverage.argonRemoteVerified, false);
  assert.match(report.events.find(row => row.id === 'research-yt-tt').detail, /당시 Argon 실행/);
  write(f.root, 'tools/argon-schedules/configuration/docs.json', { ...f.docs, full: 'https://evil.test/private' });
  const hostile = await readOverview(f.options);
  assert.equal(hostile.snapshot.research.items.length, 3);
  assert.doesNotMatch(JSON.stringify(hostile), /evil.test/);
});

test('서로 다른 원문의 오류와 인증값은 전체 실패 대신 제한된 범위로 표시한다', async t => {
  const f = fixture(t);
  const report = await readOverview({ ...f.options,
    readStatus: async () => { throw new Error('private-auth-status'); },
    readTasks: async () => { throw new Error('private-task-log'); },
    readArgon: async () => { throw new Error('private-research'); },
    remoteRefresh: true, readLedger: async () => ({ ok: false, error: 'private-ledger-token' }),
  });
  assert.equal(report.coverage.trackComplete, false);
  assert.equal(report.coverage.tasksComplete, false);
  assert.equal(report.coverage.ledgerAvailable, false);
  assert.doesNotMatch(JSON.stringify(report), /private-auth|private-task|private-research|private-ledger/);
  assert.ok(report.text.length < 3900);
});

test('v2 격리준비·원본 미통합과 durable 결과 영수증의 실패를 읽는다', async t => {
  const f = fixture(t);
  task(f, { version: 2, state: 'preparing', integration: 'not_merged', source_root: f.root, workspace_root: 'private-workspace', output_mode: 'durable_cli_files_v1' });
  const preparing = await readOverview(f.options);
  assert.match(preparing.events.find(row => row.id === 'task-' + ID).detail, /격리 작업본 준비 기록/);
  assert.match(preparing.events.find(row => row.id === 'task-' + ID).detail, /원본에 미통합/);
  write(f.home, `runtime/synk-tasks/${ID}/native-result.json`, { snapshot: { status: 'exited', exit_code: 1 }, quota_limited: true, final_found: true, text: '비공개 CLI 결과', native_session_id: 'private-native' });
  const ended = await readOverview(f.options);
  assert.equal(ended.snapshot.tasks.items[0].state, 'exited');
  assert.equal(ended.events.find(row => row.id === 'task-' + ID).severity, 'error');
  assert.doesNotMatch(JSON.stringify(ended), /비공개 CLI 결과|private-native|private-workspace/);
});

test('전송 claim만 있고 영수증이 없으면 전달 대기가 아닌 미확인이다', async t => {
  const f = fixture(t);
  task(f, { state: 'exited', exit_code: 0 });
  write(f.home, `runtime/synk-tasks/${ID}/delivery.claim`, '비공개 claim');
  const report = await readOverview(f.options);
  assert.equal(report.snapshot.tasks.items[0].deliveryStatus, 'unconfirmed');
  const event = report.events.find(row => row.id === 'task-' + ID);
  assert.equal(event.severity, 'warning');
  assert.match(event.detail, /자동 재전송 안 함/);
  assert.doesNotMatch(JSON.stringify(report), /비공개 claim/);
});

test('미래 캐시·너무 많은 행·잘못된 원문은 성공 상태로 오인하지 않는다', async t => {
  const f = fixture(t);
  write(f.home, LEDGER_CACHE, { version: 1, checkedAt: '2030-01-01T00:00:00Z', rows: ledger().rows });
  const future = await readOverview(f.options);
  assert.equal(future.snapshot.ledger.available, false);
  assert.equal(future.snapshot.ledger.checkedAt, null);
  const overflow = await readOverview({ ...f.options, remoteRefresh: true,
    readLedger: async () => ledger(Array.from({ length: 51 }, (_, i) => ({ row: i + 2, 상태: '새로' }))),
  });
  assert.equal(overflow.snapshot.ledger.available, false);
  write(f.root, 'docs/_ops/트랙.md', '손상된 형식');
  const broken = await readOverview(f.options);
  assert.equal(broken.coverage.trackComplete, false);
});

test('인증형식·개인 경로가 구조화된 주의사항에 있어도 개요에서 숨긴다', async t => {
  const f = fixture(t);
  task(f, { attention: { kind: 'approval', status: 'pending', summary: 'token=private-token client_secret=private-secret ~/private/file user@example.test "token":"private-json-secret"' } });
  const report = await readOverview(f.options);
  const text = JSON.stringify(report);
  for (const secret of ['private-token', 'private-secret', '~/private/file', 'user@example.test', 'private-json-secret']) assert.equal(text.includes(secret), false);
  assert.match(report.events.find(row => row.kind === 'approval').detail, /인증값 숨김/);
});

test('Argon 명시갱신은 4역할 영수증만 캐시하고 실패 시 마지막 성공을 보존한다', async t => {
  const f = fixture(t);
  let calls = 0;
  const roles = Object.keys(f.docs).map(role => ({ role, status: 'complete', completedAt: '2026-10-18T07:59:00Z', modelMatches: true, documentId: f.docs[role], sha256: 'b'.repeat(64),
    timerActive: true, timerEnabled: true, serviceState: 'inactive', serviceResult: 'success', exitCode: 0, token: 'private-token', raw: 'private-body' }));
  const remote = async () => { calls++; return { roles, secret: 'private-root' }; };
  await readOverview({ ...f.options, readArgonRemote: remote });
  assert.equal(calls, 0);
  const fresh = await readOverview({ ...f.options, remoteRefresh: true, readLedger: async () => ledger(), readArgonRemote: remote });
  assert.equal(calls, 1);
  assert.equal(fresh.coverage.argonStatusAvailable, true);
  assert.equal(fresh.coverage.argonRemoteVerified, false);
  assert.equal(fresh.snapshot.research.stale, false);
  assert.equal(fresh.snapshot.research.items.every(row => row.current.documentMatches), true);
  const proof = fs.readFileSync(path.join(f.home, ARGON_CACHE), 'utf8');
  assert.doesNotMatch(proof, /private-token|private-body|private-root/);
  const cached = await readOverview({ ...f.options, readArgonRemote: remote });
  assert.equal(calls, 1);
  assert.equal(cached.fingerprint, fresh.fingerprint);
  const failed = await readOverview({ ...f.options, remoteRefresh: true, readLedger: async () => ledger() });
  assert.equal(failed.snapshot.research.stale, true);
  assert.equal(failed.snapshot.research.remoteStatusAvailable, true);
  assert.equal(fs.readFileSync(path.join(f.home, ARGON_CACHE), 'utf8'), proof);
});

test('Argon 단일역할 오류와 불완전한 원격 응답·잘못된 문서 대응을 구분한다', async t => {
  const f = fixture(t);
  const roles = Object.keys(f.docs).map(role => ({ role, status: role === 'yt-tt' ? 'failed' : 'missing', documentId: f.docs[role], modelMatches: true,
    timerActive: true, timerEnabled: true, serviceState: role === 'yt-tt' ? 'failed' : 'inactive', serviceResult: role === 'yt-tt' ? 'exit-code' : 'success', errorCode: role === 'yt-tt' ? 'DOCS_CONFLICT' : null }));
  const report = await readOverview({ ...f.options, remoteRefresh: true, readLedger: async () => ledger(), readArgonRemote: async () => ({ roles }) });
  assert.equal(report.events.find(row => row.id === 'research-yt-tt').severity, 'error');
  assert.equal(report.events.find(row => row.id === 'research-full').severity, 'info');
  const partial = await readOverview({ ...f.options, remoteRefresh: true, readLedger: async () => ledger(), readArgonRemote: async () => ({ roles: roles.slice(0, 3) }) });
  assert.equal(partial.snapshot.research.refreshFailed, true);
  assert.equal(partial.snapshot.research.remoteStatusAvailable, true);
});

test('이미 전달한 결과·시작실패는 중복 즉시알림을 끄고 미확인은 켠다', async t => {
  const f = fixture(t);
  task(f, { state: 'exited', exit_code: 0 });
  write(f.home, `runtime/synk-tasks/${ID}/delivery.json`, { status: 'sent' });
  assert.equal((await readOverview(f.options)).events.find(row => row.id === 'task-' + ID).notify, false);
  task(f, { state: 'launch_failed' });
  fs.unlinkSync(path.join(f.home, `runtime/synk-tasks/${ID}/delivery.json`));
  assert.equal((await readOverview(f.options)).events.find(row => row.id === 'task-' + ID).notify, false);
  task(f, { state: 'unknown' });
  assert.equal((await readOverview(f.options)).events.find(row => row.id === 'task-' + ID).notify, true);
});

test('durable exit만 먼저 생겨도 실행종료를 읽으며 종료코드 미확인은 오류로 단정하지 않는다', async t => {
  const f = fixture(t);
  task(f, { state: 'running', output_mode: 'durable_cli_files_v1' });
  write(f.home, `runtime/synk-tasks/${ID}/native.exit`, '0\n');
  const done = await readOverview(f.options);
  assert.equal(done.snapshot.tasks.items[0].state, 'exited');
  assert.equal(done.events.find(row => row.id === 'task-' + ID).severity, 'info');
  fs.unlinkSync(path.join(f.home, `runtime/synk-tasks/${ID}/native.exit`));
  task(f, { state: 'exited' });
  const unknown = await readOverview(f.options);
  assert.equal(unknown.events.find(row => row.id === 'task-' + ID).severity, 'warning');
  assert.match(unknown.events.find(row => row.id === 'task-' + ID).detail, /종료코드 미확인/);
});

test('종료한 구형 작업·닫힌 작업의 영수증 부재를 전달 대기로 오해하지 않는다', async t => {
  const f = fixture(t);
  task(f, { state: 'exited', exit_code: 1, delivery_mode: null, notify_on_complete: true });
  const legacy = await readOverview(f.options);
  const old = legacy.events.find(row => row.id === 'task-' + ID);
  assert.match(old.detail, /전달 영수증 없음 · 이전 전달 여부 미확인/);
  assert.doesNotMatch(old.detail, /전달 대기/);
  assert.equal(old.notify, false);
  task(f, { state: 'closed_by_user' });
  const closed = (await readOverview(f.options)).events.find(row => row.id === 'task-' + ID);
  assert.match(closed.detail, /전달 영수증 없음/);
  assert.equal(closed.notify, false);
});

test('검증된 자동 통합·변경 없음의 조용한 성공은 배달 실패나 판단 요청이 아니다', async t => {
  const f = fixture(t);
  for (const state of ['integrated','no_changes']) {
    task(f,{state:'exited',exit_code:0,integration:'not_merged',integration_policy:'auto_verified_v1',notification_policy:'attention_only_v1',finalization_state:'completed',due_at:'2026-10-17T08:00:00Z',due_source:'user'});
    write(f.home,`runtime/synk-tasks/${ID}/integration.json`,{version:1,policy:'auto_verified_v1',state,verified:true,needs_attention:false,reason_code:'VERIFIED',completed_at:'2026-10-18T07:59:00Z',private:'private integration body'});
    write(f.home,`runtime/synk-tasks/${ID}/validation.json`,{status:state==='integrated'?'passed':'no_changes',private:'private validation body'});
    write(f.home,`runtime/synk-tasks/${ID}/delivery.json`,{status:'suppressed_success'});
    const report=await readOverview(f.options);
    const item=report.snapshot.tasks.items[0];
    assert.equal(item.integration,state);
    assert.equal(item.notificationPolicy,'attention_only_v1');
    const event=report.events.find(row=>row.id==='task-'+ID);
    assert.equal(event.needs_attention,false);
    assert.equal(event.notify,false);
    assert.equal(event.severity,'info');
    assert.match(event.detail,/알림 생략/);
    assert.doesNotMatch(event.detail,/전달 미확인|전달 대기|원본에 미통합/);
    assert.equal(report.events.some(row=>row.kind==='deadline'),false);
    assert.doesNotMatch(JSON.stringify(report),/private integration body|private validation body/);
  }
});

test('finalizing·검증 진행은 종료 표식이 있어도 실제 완료로 앞당기거나 알리지 않는다', async t => {
  const f=fixture(t);
  task(f,{state:'finalizing',exit_code:0,output_mode:'durable_cli_files_v1',integration_policy:'auto_verified_v1',notification_policy:'attention_only_v1',finalization_state:'validating'});
  write(f.home,`runtime/synk-tasks/${ID}/native.exit`,'0\n');
  write(f.home,`runtime/synk-tasks/${ID}/validation.json`,{status:'passed'});
  const report=await readOverview(f.options);
  assert.equal(report.snapshot.tasks.items[0].state,'finalizing');
  const event=report.events.find(row=>row.id==='task-'+ID);
  assert.equal(event.needs_attention,false);
  assert.match(event.detail,/검증·통합 처리 중/);
  assert.match(event.detail,/자동 통합 영수증 대기/);
  assert.doesNotMatch(event.detail,/통합 완료/);
});

test('새 정책의 통합 충돌은 플러그인이 전달하며 monitor는 판단 상태만 표시한다', async t => {
  const f=fixture(t);
  task(f,{state:'exited',exit_code:0,integration_policy:'auto_verified_v1',notification_policy:'attention_only_v1',finalization_state:'attention'});
  write(f.home,`runtime/synk-tasks/${ID}/integration.json`,{version:1,policy:'auto_verified_v1',state:'needs_attention',verified:true,needs_attention:true,reason_code:'SOURCE_CHANGED'});
  const report=await readOverview(f.options);
  const event=report.events.find(row=>row.id==='task-'+ID);
  assert.equal(event.needs_attention,true);
  assert.equal(event.notify,false);
  assert.equal(event.severity,'warning');
  assert.match(event.detail,/SOURCE_CHANGED/);
  write(f.home,`runtime/synk-tasks/${ID}/delivery.json`,{status:'sent'});
  const sent=(await readOverview(f.options)).events.find(row=>row.id==='task-'+ID);
  assert.equal(sent.needs_attention,true);
  assert.equal(sent.notify,false);
});

test('request 갱신과 직접 발송 사이 모든 단계에서 monitor task·approval 중복 알림을 막는다', async t => {
  const f=fixture(t);
  const base={integration_policy:'auto_verified_v1',notification_policy:'attention_only_v1'};
  task(f,{...base,state:'running',finalization_state:'pending'});
  let observed=plan(null,await readOverview(f.options),NOW).state;
  task(f,{...base,state:'exited',exit_code:0,finalization_state:'attention',attention:{kind:'approval',status:'pending',summary:'검증·통합 확인 필요 · SOURCE_CHANGED'}});
  write(f.home,`runtime/synk-tasks/${ID}/integration.json`,{version:1,policy:'auto_verified_v1',state:'needs_attention',verified:false,needs_attention:true,reason_code:'SOURCE_CHANGED'});
  for(const delivery of [null,'waiting','sending','unconfirmed','sent']) {
    if(delivery)write(f.home,`runtime/synk-tasks/${ID}/delivery.json`,{status:delivery});
    const report=await readOverview(f.options);
    const resultEvents=report.events.filter(row=>['task','approval'].includes(row.kind));
    assert.equal(resultEvents.length,2,delivery||'receipt absent');
    assert.equal(resultEvents.every(row=>row.needs_attention===true&&row.notify===false),true,delivery||'receipt absent');
    const collected=plan(observed,report,new Date(NOW.getTime()+60_000));
    assert.deepEqual(collected.notifications,[],delivery||'receipt absent');
    observed=collected.state;
  }
  task(f,{...base,state:'exited',exit_code:0,finalization_state:'attention',due_source:'user',due_at:'2026-10-17T08:00:00Z'});
  const overdue=await readOverview(f.options);
  const deadline=overdue.events.find(row=>row.kind==='deadline');
  assert.equal(deadline.needs_attention,true);
  assert.notEqual(deadline.notify,false);
  const collected=plan(observed,overdue,new Date(NOW.getTime()+120_000));
  assert.deepEqual(collected.notifications[0].events.map(row=>row.id),['due-'+ID]);
});

test('기존 정책의 직접 전달 미확인·승인 사건은 기존 monitor 소유권을 유지한다', async t => {
  const f=fixture(t);
  task(f,{state:'unknown',attention:{kind:'approval',status:'pending',summary:'기존 판단 대기'}});
  write(f.home,`runtime/synk-tasks/${ID}/delivery.json`,{status:'unconfirmed'});
  const report=await readOverview(f.options);
  const resultEvents=report.events.filter(row=>['task','approval'].includes(row.kind));
  assert.equal(resultEvents.length,2);
  assert.equal(resultEvents.every(row=>row.needs_attention===true&&row.notify===true),true);
});

test('검증·판단 완료 필드가 불완전하거나 정책이 다른 통합 주장은 반영 완료로 읽지 않는다', async t => {
  const f=fixture(t);
  task(f,{state:'exited',exit_code:0,integration:'not_merged',integration_policy:'auto_verified_v1',notification_policy:'attention_only_v1',finalization_state:'completed'});
  for(const proof of [{version:1,policy:'auto_verified_v1',state:'integrated',verified:false,needs_attention:false},
    {version:1,policy:'other',state:'integrated',verified:true,needs_attention:false},
    {version:1,policy:'auto_verified_v1',state:'integrated',verified:true},
    {version:1,policy:'auto_verified_v1',state:'integrated',verified:true,needs_attention:true}]) {
    write(f.home,`runtime/synk-tasks/${ID}/integration.json`,proof);
    const report=await readOverview(f.options);
    assert.notEqual(report.snapshot.tasks.items[0].integration,'integrated');
    assert.doesNotMatch(report.events.find(row=>row.id==='task-'+ID).detail,/원본 통합 완료/);
  }
  write(f.home,`runtime/synk-tasks/${ID}/integration.json`,{version:1,policy:'auto_verified_v1',state:'integrated',verified:true,needs_attention:false});
  write(f.home,`runtime/synk-tasks/${ID}/validation.json`,{status:'needs_attention',needs_attention:true,reason_code:'USER_DECISION_REQUIRED'});
  const conflicted=await readOverview(f.options);
  assert.notEqual(conflicted.snapshot.tasks.items[0].integration,'integrated');
  assert.equal(conflicted.events.find(row=>row.id==='task-'+ID).needs_attention,true);
});

test('보통 기록·성공·짧은 sending에는 판단 플래그가 없고 인증 실패·기한 경과에는 있다', async t => {
  const f=fixture(t);
  task(f,{state:'exited',exit_code:0});
  write(f.home,`runtime/synk-tasks/${ID}/delivery.json`,{status:'sending'});
  let report=await readOverview(f.options);
  assert.equal(report.events.find(row=>row.id==='task-'+ID).needs_attention,false);
  assert.equal(report.events.filter(row=>['track','tip','completion'].includes(row.kind)).every(row=>row.needs_attention===false),true);
  task(f,{state:'exited',exit_code:1,notification_policy:'attention_only_v1',due_at:'2026-10-17T08:00:00Z',due_source:'user'});
  write(f.home,`runtime/synk-tasks/${ID}/delivery.json`,{status:'waiting',quota_limited:true});
  report=await readOverview(f.options);
  assert.equal(report.events.find(row=>row.id==='task-'+ID).needs_attention,true);
  assert.equal(report.events.find(row=>row.kind==='deadline').needs_attention,true);
});

test('같은 조사 실패의 판단 키는 영수증 시각·캐시 경과로 반복 바뀌지 않는다', async t => {
  const f=fixture(t);
  const roles=Object.keys(f.docs).map(role=>({role,status:'failed',errorCode:'AUTH_FAILED',completedAt:'2026-10-18T07:00:00Z',timerActive:true,timerEnabled:true,serviceState:'failed',serviceResult:'exit-code',documentId:f.docs[role]}));
  const first=await readOverview({...f.options,remoteRefresh:true,readLedger:async()=>ledger(),readArgonRemote:async()=>({roles})});
  const a=first.events.find(row=>row.id==='research-yt-tt');
  assert.equal(a.needs_attention,true);
  const second=await readOverview({...f.options,now:new Date(NOW.getTime()+LEDGER_TTL_MS+1)});
  const b=second.events.find(row=>row.id==='research-yt-tt');
  assert.equal(a.attention_fingerprint,b.attention_fingerprint);
});

function backupFile(f, components, checkedAt = '2026-10-18T07:50:00Z') {
  const file = path.join(f.directory, 'backup-health.json');
  fs.writeFileSync(file, JSON.stringify({ schemaVersion: 1, checkedAt, status: 'attention', components }), 'utf8');
  return file;
}
const onedrive = (status, lastSuccessAt = '2026-10-18T03:00:00Z', codes = []) =>
  ({ id: 'onedrive', label: 'OneDrive 문서·소스', status, lastSuccessAt, codes, task: { path: 'C:/private/path', result: 1 } });

test('PC 백업 실패는 다음 성공까지 같은 판단으로 이어지고 실행 중으로 바뀌어도 다시 알리지 않는다', async t => {
  const f = fixture(t);
  const options = { ...f.options, backupHealthFile: backupFile(f, [onedrive('failed', undefined, ['SCHEDULE_LAST_RUN_FAILED'])]), persistState: true };
  const failed = await readOverview(options);
  const first = failed.events.find(row => row.id === 'backup-onedrive');
  assert.equal(first.needs_attention, true);
  assert.equal(first.severity, 'error');
  assert.match(first.detail, /실패 · 마지막 성공 .* · SCHEDULE_LAST_RUN_FAILED/);
  backupFile(f, [onedrive('running')]);
  const later = new Date(NOW.getTime() + 5 * 60_000);
  const running = await readOverview({ ...options, now: later });
  const second = running.events.find(row => row.id === 'backup-onedrive');
  assert.equal(second.needs_attention, true, '실패 뒤 다음 회차가 도는 동안에도 판단을 유지한다');
  assert.equal(second.attention_fingerprint, first.attention_fingerprint);
  let state = plan(null, { events: [] }, NOW).state;
  const alerted = plan(state, failed, NOW);
  assert.equal(alerted.notifications.length, 1);
  assert.match(alerted.notifications[0].text, /PC 백업 · OneDrive/);
  state = alerted.state;
  assert.equal(plan(state, running, later).notifications.length, 0, '같은 실패를 30분마다 다시 보내지 않는다');
  const cache = fs.readFileSync(path.join(f.home, BACKUP_CACHE), 'utf8');
  assert.doesNotMatch(cache, /private|SCHEDULE_LAST_RUN_FAILED/, '캐시에는 실패 표시와 마지막 성공 시각만 둔다');
  backupFile(f, [onedrive('healthy', '2026-10-18T08:04:00Z')]);
  const healthy = await readOverview({ ...options, now: new Date(NOW.getTime() + 10 * 60_000) });
  assert.equal(healthy.events.find(row => row.id === 'backup-onedrive').needs_attention, false);
});

test('PC 백업은 짧은 유예 안의 실패·켠 직후의 오래된 기록·일회성 조회에서는 알리지 않는다', async t => {
  const f = fixture(t);
  const fresh = await readOverview({ ...f.options, backupHealthFile: backupFile(f, [onedrive('failed', '2026-10-18T07:10:00Z')]) });
  const row = fresh.events.find(item => item.id === 'backup-onedrive');
  assert.equal(row.needs_attention, false, 'OneDrive는 두 시간 유예 안의 실패를 기다린다');
  assert.equal(row.severity, 'warning');
  assert.equal(fs.existsSync(path.join(f.home, BACKUP_CACHE)), false, '감시 프로세스가 아닌 조회는 파일을 쓰지 않는다');
  const file = backupFile(f, [onedrive('healthy', '2026-10-18T04:00:00Z')], '2026-10-18T04:30:00Z');
  const boot = await readOverview({ ...f.options, backupHealthFile: file, uptimeSeconds: 600 });
  assert.equal(boot.events.find(item => item.id === 'backup-monitor'), undefined);
  const stopped = await readOverview({ ...f.options, backupHealthFile: file, uptimeSeconds: 3600 });
  assert.equal(stopped.events.find(item => item.id === 'backup-monitor').needs_attention, true);
  assert.match(stopped.text, /PC 백업 1종/);
});

test('헤르메스 복구는 재시작 뒤에도 그대로이거나 30분 넘게 미룬 어긋남만 한 번 알리고, 오래된 기록으로는 판단을 바꾸지 않는다', async t => {
  const f = fixture(t);
  const GENERATION = 'e3240b89a48f4632a4a798146f6a9034';
  const at = minutes => new Date(NOW.getTime() + minutes * 60_000);
  const record = (minutes, extra) => write(f.home, GATEWAY_RECOVERY_STATUS,
    { schemaVersion: 1, checkedAt: at(minutes).toISOString().replace('.000', ''), code: 0, drift: false, selected: null, since: null, ...extra });
  const look = minutes => readOverview({ ...f.options, now: at(minutes) });
  const row = report => report.events.find(item => item.id === 'gateway-recovery');
  const drift = { drift: true, selected: GENERATION, since: '2026-10-18T07:20:00Z' };
  const step = async (state, minutes) => plan(state, await look(minutes), at(minutes));

  const none = await look(0);
  assert.equal(row(none), undefined, '기록이 없으면 사건도 줄도 없다');
  assert.doesNotMatch(none.text, /게이트웨이/);
  let state = plan(null, none, at(0)).state;
  record(0, {});
  const healthy = await look(1);
  assert.equal(row(healthy).needs_attention, false);
  assert.match(healthy.text, /헤르메스 게이트웨이 복구 점검 · 확인할 문제 없음/);
  record(1, { ...drift, code: 0 });
  assert.equal(row(await look(2)).needs_attention, false, '처음 본 어긋남과 짧은 미룸은 복구 작업이 스스로 처리한다');

  record(30, { ...drift, code: 6 });
  const busy = await look(31);
  const shown = row(busy).title + ' ' + row(busy).detail;
  assert.equal(row(busy).needs_attention, true);
  assert.ok(!shown.includes(GENERATION.slice(0, 8)) && !/코드|code/i.test(shown), '종료 코드·세대 번호는 글에 보이지 않는다');
  assert.match(busy.text, /헤르메스 게이트웨이 복구 점검 · 확인 필요/);
  let result = plan(state, busy, at(31));
  assert.equal(result.notifications.length, 1);
  assert.match(result.notifications[0].text, /바빠서 재시작을 30분 넘게 미룸/);
  record(35, { ...drift, code: 6 });
  result = await step(result.state, 36);
  assert.equal(result.notifications.length, 0, '같은 미룸을 다시 보내지 않는다');
  record(40, { ...drift, code: 4 });
  result = await step(result.state, 41);
  assert.equal(result.notifications.length, 1, '다시 켰는데도 그대로면 새 사건이다');
  assert.match(result.notifications[0].text, /재시작 뒤에도 새 패키지를 못 씀/);

  const stale = await look(70);
  assert.equal(row(stale), undefined, '15분 넘은 기록은 해결로도 문제로도 보지 않는다');
  assert.match(stale.text, /기록이 오래됨/);
  result = plan(result.state, stale, at(70));
  record(71, { ...drift, code: 4 });
  result = await step(result.state, 72);
  assert.equal(result.notifications.length, 0, '절전에서 깨어난 뒤 같은 문제를 다시 보내지 않는다');
  record(80, {});
  result = await step(result.state, 81);
  record(90, { ...drift, code: 4 });
  result = await step(result.state, 91);
  assert.equal(result.notifications.length, 1, '풀린 뒤 다시 생기면 새로 알린다');
});

test('헤르메스 복구 작업 자체가 멈추면 감시가 끊김 없이 30분 넘게 돈 뒤 한 번 알리고, 절전에서 깬 직후에는 판단을 바꾸지 않는다', async t => {
  const f = fixture(t);
  const GENERATION = 'e3240b89a48f4632a4a798146f6a9034';
  const at = minutes => new Date(NOW.getTime() + minutes * 60_000);
  // 복구 작업처럼 기록을 쓰고, 파일 수정 시각도 그 점검 시각에 맞춘다.
  const record = (minutes, extra) => {
    write(f.home, GATEWAY_RECOVERY_STATUS,
      { schemaVersion: 1, checkedAt: at(minutes).toISOString().replace('.000', ''), code: 0, drift: false, selected: null, since: null, ...extra });
    fs.utimesSync(path.join(f.home, GATEWAY_RECOVERY_STATUS), at(minutes), at(minutes));
  };
  const drift = { drift: true, code: 4, selected: GENERATION, since: '2026-10-18T07:50:00Z' };
  const task = report => report.events.find(item => item.id === 'gateway-recovery-task');
  // 감시처럼 6분마다 판단하고 그 상태를 state.json에 남긴다(collect가 하는 일과 같다).
  let state = null;
  let report = null;
  const poll = async (from, to = from) => {
    const sent = [];
    for (let minutes = from; minutes <= to; minutes += 6) {
      report = await readOverview({ ...f.options, now: at(minutes) });
      const result = plan(state, report, at(minutes));
      state = result.state;
      write(f.home, MONITOR_STATE, state);
      sent.push(...result.notifications);
    }
    return sent;
  };

  record(0, {});
  await poll(0);
  assert.equal(task(report).needs_attention, false);
  record(5, drift);
  let sent = await poll(6);
  assert.equal(sent.length, 1);
  assert.match(sent[0].text, /재시작 뒤에도 새 패키지를 못 씀/);

  // 10분 점검을 끝으로 작업이 꺼졌다. 15분이 지나면 어긋남 판단은 그대로 두고, 30분이 되기 전에는 아무것도 보내지 않는다.
  record(10, drift);
  assert.deepEqual(await poll(12, 36), []);
  assert.equal(task(report), undefined, '30분이 되기 전에는 멈춤으로 단정하지 않는다');
  assert.match(report.text, /기록이 오래됨/);
  sent = await poll(42);
  assert.equal(sent.length, 1, '감시가 끊김 없이 42분 도는 동안 32분째 새 기록이 없다');
  assert.match(sent[0].text, /헤르메스 복구 작업이 멈춤/);
  assert.match(sent[0].text, /마지막 점검 2026-10-18 17:10 KST/, '알림 글이 잘리지 않는다');
  assert.ok(!sent[0].text.includes(GENERATION.slice(0, 8)) && !/코드|code/i.test(sent[0].text), '종료 코드·세대 번호는 글에 보이지 않는다');
  assert.match(report.text, /헤르메스 게이트웨이 복구 점검 · 복구 작업이 멈춤 · 확인 필요/);
  assert.deepEqual(await poll(48), [], '같은 멈춤을 다시 보내지 않는다');

  // 48분 회차 뒤 절전, 140분에 깼다. 깬 뒤 30분은 멈춤을 가를 수 없어 사건을 빼고, 다시 드러나도 같은 사건이다.
  assert.deepEqual(await poll(140, 164), []);
  assert.equal(task(report), undefined, '절전에서 깬 직후에는 판단을 바꾸지 않는다');
  assert.deepEqual(await poll(170), [], '절전 전에 알린 멈춤을 다시 보내지 않는다');
  assert.equal(task(report).needs_attention, true);

  // 작업을 다시 켰다. 어긋남은 그대로라도 이미 알린 사건이라 다시 보내지 않고, 멈춤은 풀린다.
  record(172, drift);
  assert.deepEqual(await poll(176), []);
  assert.equal(task(report).needs_attention, false);
  assert.match(report.text, /헤르메스 게이트웨이 복구 점검 · 확인 필요/);
  record(178, drift);
  sent = await poll(182, 212);
  assert.equal(sent.length, 1, '풀린 뒤 다시 멈추면 새로 알린다');
  assert.match(sent[0].text, /헤르메스 복구 작업이 멈춤/);
});

test('헤르메스 복구 기록이 없거나 못 읽거나 PC를 켠 직후에도 감시가 끊김 없이 30분 돈 뒤에만 멈춤으로 본다', async t => {
  const f = fixture(t);
  const at = minutes => new Date(NOW.getTime() + minutes * 60_000);
  const look = minutes => readOverview({ ...f.options, now: at(minutes) });
  const file = path.join(f.home, GATEWAY_RECOVERY_STATUS);
  // 어제 끈 PC: 감시 상태와 복구 기록이 모두 하루 묵었다. 켠 뒤 첫 조회는 깨어 있던 시간을 새로 센다.
  write(f.home, MONITOR_STATE, { checkedAt: at(-24 * 60).toISOString(), awakeSince: at(-30 * 60).toISOString() });
  write(f.home, GATEWAY_RECOVERY_STATUS, { schemaVersion: 1, checkedAt: at(-24 * 60).toISOString(), code: 0, drift: false, selected: null, since: null });
  fs.utimesSync(file, at(-24 * 60), at(-24 * 60));
  const boot = await look(1);
  assert.equal(boot.snapshot.gateway.stopped, false);
  assert.equal(boot.events.find(item => item.id === 'gateway-recovery-task'), undefined);
  assert.match(boot.text, /기록이 오래됨/);

  // 기록이 한 번도 없는 채로 감시가 6분마다 돈다. 30분째 회차에서 처음 멈춤으로 본다.
  fs.rmSync(file);
  fs.rmSync(path.join(f.home, MONITOR_STATE));
  let state = null;
  const stopped = [];
  for (let minutes = 0; minutes <= 30; minutes += 6) {
    const report = await look(minutes);
    stopped.push(report.snapshot.gateway.stopped);
    state = plan(state, report, at(minutes)).state;
    write(f.home, MONITOR_STATE, state);
    if (minutes < 30) assert.doesNotMatch(report.text, /게이트웨이/);
    else {
      assert.equal(report.events.find(item => item.id === 'gateway-recovery-task').needs_attention, true);
      assert.match(report.events.find(item => item.id === 'gateway-recovery-task').detail, /점검 기록 없음/);
      assert.match(report.text, /헤르메스 게이트웨이 복구 점검 · 복구 작업이 멈춤 · 확인 필요 · 기록 미확인/);
    }
  }
  assert.deepEqual(stopped, [false, false, false, false, false, true]);

  // 내용을 못 읽는 기록(형식이 다르거나 읽는 순간 막힘)은 파일이 쓰인 시각으로 본다. 방금 쓰였으면 작업은 돌고 있다.
  fs.writeFileSync(file, '{"schemaVersion":2');
  fs.utimesSync(file, at(34), at(34));
  const unreadable = await look(36);
  assert.equal(unreadable.snapshot.gateway.stopped, false, '한 번 못 읽었다고 멈춤으로 보지 않는다');
  assert.equal(unreadable.events.find(item => item.id === 'gateway-recovery-task'), undefined, '못 읽은 기록으로는 판단을 바꾸지 않는다');
  fs.utimesSync(file, at(0), at(0));
  const silent = await look(36);
  assert.equal(silent.snapshot.gateway.stopped, true);
  assert.match(silent.events.find(item => item.id === 'gateway-recovery-task').detail, /마지막 점검 2026-10-18 17:00 KST/);
  assert.match(silent.text, /복구 작업이 멈춤 · 확인 필요 · 기록 2026-10-18 17:00 KST/);
});

test('SNS 연결은 세 시간에 한 번만 읽고 코드·시각만 보관하며 끊김·지연·장기 미조회를 판단으로 올린다', async t => {
  const f = fixture(t);
  let calls = 0;
  const payload = { appRunning: true, token: 'private-token',
    connections: [
      { platform: 'youtube', state: 'connected', errorCode: null, checkedAt: '2026-10-18T07:40:00Z', requiresReconnect: false, failureCode: null, accessToken: 'private-token' },
      { platform: 'instagram', state: 'error', errorCode: 'OAUTH_EXPIRED', checkedAt: '2026-10-18T07:40:00Z', requiresReconnect: true, failureCode: null }],
    inbox: [{ platform: 'facebook', lastStatus: 'partial', lastErrorCode: null, lastSyncedAt: '2026-10-18T07:50:00Z', body: 'private-body' }],
    jobs: { total: 7, overdue: 1, overdueRefs: ['a'.repeat(12)], recentFailed: 0, recentFailedRefs: [] } };
  const remote = async () => { calls++; return payload; };
  const offline = await readOverview({ ...f.options, readSnsRemote: remote });
  assert.equal(calls, 0, '기본 조회는 회사 서버를 읽지 않는다');
  assert.equal(offline.snapshot.sns.available, false);
  const fresh = await readOverview({ ...f.options, remoteRefresh: true, readLedger: async () => ledger(), readSnsRemote: remote });
  assert.equal(calls, 1);
  const byId = (report, id) => report.events.find(row => row.id === id);
  assert.equal(byId(fresh, 'sns-connection-youtube').needs_attention, false);
  assert.equal(byId(fresh, 'sns-connection-instagram').needs_attention, true);
  assert.match(byId(fresh, 'sns-connection-instagram').detail, /OAUTH_EXPIRED/);
  assert.equal(byId(fresh, 'sns-jobs').needs_attention, true);
  assert.equal(byId(fresh, 'sns-comments-facebook').needs_attention, false);
  assert.match(fresh.text, /SNS 연결 2개·댓글 수집 1개 · 확인 필요 2건/);
  assert.doesNotMatch(fs.readFileSync(path.join(f.home, SNS_CACHE), 'utf8'), /private-token|private-body/);
  const hour = await readOverview({ ...f.options, now: new Date(NOW.getTime() + 60 * 60_000), remoteRefresh: true, readLedger: async () => ledger(), readSnsRemote: remote });
  assert.equal(calls, 1, '세 시간 안에는 다시 읽지 않는다');
  assert.equal(byId(hour, 'sns-connection-instagram').attention_fingerprint, byId(fresh, 'sns-connection-instagram').attention_fingerprint);
  const blocked = async () => { calls++; throw new Error('SSH_BLOCKED'); };
  const failed = await readOverview({ ...f.options, now: new Date(NOW.getTime() + 4 * 60 * 60_000), remoteRefresh: true, readLedger: async () => ledger(), readSnsRemote: blocked });
  assert.equal(calls, 2);
  assert.equal(failed.snapshot.sns.available, true, '실패한 조회는 마지막 성공 사본을 지우지 않는다');
  assert.equal(failed.snapshot.sns.refreshFailed, true);
  assert.equal(byId(failed, 'coverage-sns'), undefined, '이틀 안의 조회 실패는 알리지 않는다');
  const long = await readOverview({ ...f.options, now: new Date(NOW.getTime() + 49 * 60 * 60_000), remoteRefresh: true, readLedger: async () => ledger(), readSnsRemote: blocked });
  assert.equal(byId(long, 'coverage-sns').needs_attention, true);
  assert.equal(byId(long, 'sns-connection-youtube').needs_attention, true, '서버의 연결 점검 기록이 오래되면 판단으로 올린다');
});

test('SNS 응답 모양이 다르면 성공으로 저장하지 않는다', async t => {
  const f = fixture(t);
  const report = await readOverview({ ...f.options, remoteRefresh: true, readLedger: async () => ledger(), readSnsRemote: async () => ({ connections: [] }) });
  assert.equal(report.snapshot.sns.available, false);
  assert.equal(report.snapshot.sns.refreshFailed, true);
  assert.equal(fs.existsSync(path.join(f.home, SNS_CACHE)), false);
});
