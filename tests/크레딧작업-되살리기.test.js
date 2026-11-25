'use strict';
// 11-26 되살리기: 하루 한 번 도는 백업 예약이 실패하거나 끊겼을 때만, 한 번에 하나, 같은 실패에 한 번 다시 시작한다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { 되살리기, 고르기, 막는까닭, 조회명령, 시작명령, 최근기록, 다시돌릴예약 } = require('../tools/크레딧작업/되살리기.js');
const { 만들기 } = require('../tools/크레딧작업/알림해결.js');

const 지금 = new Date('2026-11-22T20:55:00Z'); // 11-23 05:55 KST
const 앞 = (분) => new Date(+지금 - 분 * 60000).toISOString(), 뒤 = (시간) => new Date(+지금 + 시간 * 3600000).toISOString();
const 예약 = (덮기 = {}) => ({ exists: true, enabled: true, state: 'Ready', result: 1, lastRunAt: 앞(25), nextRunAt: 뒤(23), ...덮기 });
const 칸 = (id, status = 'healthy', codes = [], task = {}) => ({ id, status, codes, task: 예약(task) });
const 상태 = (...칸들) => ({ schemaVersion: 1, checkedAt: 앞(8), components: 칸들 });
const 끊김 = ['PROCESS_OR_HEARTBEAT_MISSING', 'SCHEDULE_LAST_RUN_FAILED'];

test('11-23 재시작처럼 끊긴 매일 백업을 고른다', () => {
  const r = 고르기(상태(칸('server', 'interrupted', 끊김), 칸('workspace', 'interrupted', 끊김), 칸('restorebundle', 'interrupted', 끊김), 칸('media')), [], +지금);
  assert.deepEqual(r, { 예약: 'SYNK 매일 백업', 칸: ['server', 'workspace'], 코드: [...끊김].sort(), 앞실행: 앞(25), 다음정기: 뒤(23) });
  // 앞의 것을 이미 다시 돌렸으면 다음 것
  const 다음 = 고르기(상태(칸('server', 'interrupted', 끊김), 칸('restorebundle', 'interrupted', 끊김)), [{ 예약: 'SYNK 매일 백업', 시각: 앞(15), 다음정기: 뒤(23) }], +지금);
  assert.equal(다음.예약, 'SYNK 복원 묶음 백업');
  // 새 영수증을 쓰기 전에 실패한 예약은 attention이다(backup-health.py)
  for (const [s, c] of [['failed', ['MEDIA_RUNNER_FAILED', 'SCHEDULE_LAST_RUN_FAILED']], ['partial_failure', ['BACKUP_PARTIAL_FAILURE', 'SCHEDULE_LAST_RUN_FAILED']], ['missed', ['BACKUP_STALE']],
    ['attention', ['SCHEDULE_LAST_RUN_FAILED']]]) {
    assert.equal(고르기(상태(칸('media', s, c)), [], +지금).예약, 'SYNK 미디어 원본 백업', s);
  }
});

test('다시 돌려도 소용없거나 건드리면 안 되는 경우에는 고르지 않는다', () => {
  const 안고름 = (이름, 상태값, 회차들 = []) => assert.equal(고르기(상태값, 회차들, +지금).예약, undefined, 이름);
  안고름('모두 정상', 상태(칸('server'), 칸('media'), 칸('restorebundle')));
  안고름('꺼진 예약 · 준비 미완료 · 의도적 중지는 다시 돌리지 않는다', 상태(칸('server', 'attention', ['SCHEDULE_MISSING_OR_DISABLED']), 칸('media', 'blocked', ['BACKUP_PUBLIC_KEY_MISSING']), 칸('restorebundle', 'paused', ['BACKUP_STOPPED'])));
  안고름('모르는 사유가 섞였다', 상태(칸('media', 'failed', ['MEDIA_RUNNER_FAILED', 'MEDIA_SOURCE_DEFERRED_STALE'])));
  안고름('사유가 없다', 상태(칸('media', 'failed', [])));
  안고름('하나라도 도는 중이면 기다린다', 상태(칸('server', 'interrupted', 끊김), 칸('media', 'running', [], { state: 'Running' })));
  안고름('예약이 도는 중', 상태(칸('server', 'interrupted', 끊김, { state: 'Running' })));
  안고름('예약이 꺼졌다', 상태(칸('server', 'interrupted', 끊김, { state: 'Disabled', enabled: false })));
  안고름('예약이 없다', 상태({ id: 'server', status: 'interrupted', codes: 끊김, task: null }));
  안고름('방금 돌았다', 상태(칸('server', 'interrupted', 끊김, { lastRunAt: 앞(10) })));
  안고름('곧 다음 예약이다', 상태(칸('server', 'interrupted', 끊김, { nextRunAt: 뒤(2) })));
  안고름('다음 예약을 모른다', 상태(칸('server', 'interrupted', 끊김, { nextRunAt: null })));
  안고름('같은 실패를 이미 다시 돌렸다', 상태(칸('server', 'interrupted', 끊김)), [{ 예약: 'SYNK 매일 백업', 시각: 앞(13 * 60), 다음정기: 뒤(10) }]);
  안고름('기록에 다음 정기 시각이 없으면 하루를 기다린다', 상태(칸('server', 'interrupted', 끊김)), [{ 예약: 'SYNK 매일 백업', 시각: 앞(20 * 60) }]);
  안고름('시각을 읽을 수 없는 기록이 있다', 상태(칸('server', 'interrupted', 끊김)), [{ 예약: 'SYNK 매일 백업', 시각: 'x', 다음정기: 앞(40) }, { 예약: 'SYNK 매일 백업', 시각: 'x', 다음정기: 앞(40) }]);
  안고름('사흘에 두 번 다시 돌렸다', 상태(칸('server', 'interrupted', 끊김)), [{ 예약: 'SYNK 매일 백업', 시각: 앞(24 * 60), 다음정기: 앞(25) }, { 예약: 'SYNK 매일 백업', 시각: 앞(70 * 60), 다음정기: 앞(50 * 60) }]);
  안고름('상태가 오래됐다', { ...상태(칸('server', 'interrupted', 끊김)), checkedAt: 앞(41) });
  안고름('상태의 시각이 앞선다', { ...상태(칸('server', 'interrupted', 끊김)), checkedAt: new Date(+지금 + 6 * 60000).toISOString() });
  for (const 값 of [null, {}, { schemaVersion: 2, checkedAt: 앞(1), components: [] }, { schemaVersion: 1, checkedAt: 앞(1) }]) 안고름(JSON.stringify(값), 값);
  안고름('목록 밖 백업', 상태(칸('onedrive', 'failed', ['SCHEDULE_LAST_RUN_FAILED']), 칸('github', 'failed', ['SCHEDULE_LAST_RUN_FAILED']), 칸('archive', 'failed', ['SCHEDULE_LAST_RUN_FAILED'])));
  // 다음 정기 회차가 또 실패했으면 다시 돌린다. 사흘보다 앞의 것은 세지 않는다
  assert.equal(고르기(상태(칸('server', 'interrupted', 끊김)), [{ 예약: 'SYNK 매일 백업', 시각: 앞(80 * 60), 다음정기: 앞(60 * 60) }, { 예약: 'SYNK 매일 백업', 시각: 앞(24 * 60), 다음정기: 앞(25) }], +지금).예약, 'SYNK 매일 백업');
});

test('시작 직전에 본 예약으로 다시 거른다', () => {
  const 고른 = { 예약: 'SYNK 매일 백업', 앞실행: 앞(25) };
  const 줄 = (덮기 = {}) => ({ name: 'SYNK 매일 백업', state: 'Ready', enabled: true, result: 1073807364, last: 앞(25), next: 뒤(23), ...덮기 });
  const 남 = (덮기 = {}) => ({ ...줄(), name: 'SYNK 복원 묶음 백업', ...덮기 });
  assert.equal(막는까닭([줄(), 남()], 고른, +지금), null, 'PC를 다시 켜서 끊긴 회차(0x40010004)');
  assert.equal(막는까닭([줄({ result: 267014 })], 고른, +지금), '사람이 끝낸 회차', '작업 스케줄러에서 끝냈다');
  assert.equal(막는까닭([줄(), 남({ state: 'Running' })], 고른, +지금), '백업이 도는 중');
  assert.equal(막는까닭([줄(), 남({ state: 'Queued' })], 고른, +지금), '백업이 도는 중');
  assert.equal(막는까닭([줄({ last: 앞(3) })], 고른, +지금), '그사이 새로 돎');
  assert.equal(막는까닭([줄({ last: new Date(+지금 - 25 * 60000 + 40000).toISOString(), result: 0 })], 고른, +지금), '그사이 새로 돎', '40초 뒤에 새로 시작해 성공했다');
  assert.equal(막는까닭([줄({ last: null })], 고른, +지금), '그사이 새로 돎');
  assert.equal(막는까닭([줄({ next: 뒤(2) })], 고른, +지금), '다음 예약이 가까움');
  assert.equal(막는까닭([줄({ next: null })], 고른, +지금), '다음 예약이 가까움');
  for (const 값 of [[남()], [줄({ enabled: false })], [줄({ state: 'Disabled' })], [null], []]) assert.equal(막는까닭(값, 고른, +지금), '예약이 없거나 꺼짐');
  for (const 값 of [null, undefined, {}, 'x']) assert.equal(막는까닭(값, 고른, +지금), '예약 상태를 읽지 못함');
});

function 방만들기(상태값) {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-revive-'));
  const 창고 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-revive-store-'));
  const 상태파일 = path.join(창고, 'backup-health.json');
  fs.writeFileSync(상태파일, JSON.stringify(상태값));
  // 예약 셋의 지금 상태는 시험이 바꿀 수 있다. 시작 명령만 부름에 남긴다.
  const 부름 = [], 예약들 = Object.fromEntries(다시돌릴예약.map((x) => [x.예약, { name: x.예약, state: 'Ready', enabled: true, result: 1, last: 앞(25), next: 뒤(23) }]));
  const 실행 = (명령, 인자) => {
    if (!글읽기(인자).includes('Start-ScheduledTask')) return { code: 0, stdout: '\uFEFF' + JSON.stringify(Object.values(예약들)) + '\r\n' };
    부름.push([명령, 인자]);
    return { code: 0, stdout: 'Running\r\n' };
  };
  return { 방, 창고, 상태파일, 부름, 예약들, 실행, 장부: () => JSON.parse(fs.readFileSync(path.join(방, '되살리기.json'), 'utf8')).회차 };
}
const 글읽기 = (인자) => Buffer.from(인자[인자.indexOf('-EncodedCommand') + 1], 'base64').toString('utf16le');
const 고장 = () => 상태(칸('server', 'interrupted', 끊김), 칸('restorebundle', 'interrupted', 끊김));
/** 시작 명령만 바꾼 실행. */
const 시작은 = (f, 답) => (명령, 인자) => (글읽기(인자).includes('Start-ScheduledTask') ? 답() : f.실행(명령, 인자));

test('고른 예약만 시작하고 남긴다', () => {
  const f = 방만들기(고장());
  const r = 되살리기({ ...f, 지금 });
  assert.equal(r.예약, 'SYNK 매일 백업');
  assert.equal(r.결과, '시작함');
  assert.equal(f.부름.length, 1);
  const [명령, 인자] = f.부름[0];
  assert.equal(명령, 'powershell');
  const 글 = 글읽기(인자);
  assert.match(글, /Start-ScheduledTask -TaskName \$n -ErrorAction Stop/);
  assert.match(글, /\$n = 'SYNK 매일 백업';/);
  assert.doesNotMatch(글, /Stop-ScheduledTask|Register-|Set-ScheduledTask|Disable-|Enable-|Remove-/);
  assert.deepEqual(f.장부(), [r]);
  // 15분 뒤: 감시 파일은 그대로여도 앞서 시작한 것이 도는 동안에는 다음 것을 시작하지 않는다
  f.예약들['SYNK 매일 백업'].state = 'Running';
  assert.match(되살리기({ ...f, 지금: new Date(+지금 + 15 * 60000) }).이유, /백업이 도는 중/);
  // 끝났으면 다음 것, 그다음은 없음
  f.예약들['SYNK 매일 백업'].state = 'Ready';
  assert.equal(되살리기({ ...f, 지금: new Date(+지금 + 25 * 60000) }).예약, 'SYNK 복원 묶음 백업');
  assert.equal(되살리기({ ...f, 지금: new Date(+지금 + 30 * 60000) }).예약, undefined);
  assert.equal(f.부름.length, 2);
});

test('예약을 조회하는 동안 끄거나 백업을 멈추면 시작하지 않는다', () => {
  for (const [어디, 이름, 이유] of [['방', '되살리기_꺼둠', '꺼 둠'], ['창고', 'upload.stop', '백업을 일부러 멈춘 동안']]) {
    const f = 방만들기(고장());
    const 실행 = (명령, 인자) => { const r = f.실행(명령, 인자); fs.writeFileSync(path.join(f[어디], 이름), ''); return r; };
    assert.equal(되살리기({ ...f, 실행, 지금 }).이유, 이유);
    assert.equal(f.부름.length, 0);
    assert.equal(fs.existsSync(path.join(f.방, '되살리기.json')), false, '시작하지 않은 회차는 세지 않는다');
  }
});

test('다음 정기 시각은 시작 직전에 읽은 것을 남긴다', () => {
  // 감시가 읽은 다음 예약은 내일인데 그사이 예약 시각이 오늘 저녁으로 바뀌었다
  const f = 방만들기(상태(칸('server', 'interrupted', 끊김)));
  f.예약들['SYNK 매일 백업'].next = 뒤(13);
  assert.equal(되살리기({ ...f, 지금 }).다음정기, 뒤(13));
  const 때 = new Date(+지금 + 14 * 3600000);
  fs.writeFileSync(f.상태파일, JSON.stringify({ ...상태(칸('server', 'failed', ['BACKUP_RUNNER_FAILED'], { lastRunAt: 뒤(13), nextRunAt: 뒤(37) })), checkedAt: new Date(+때 - 60000).toISOString() }));
  Object.assign(f.예약들['SYNK 매일 백업'], { last: 뒤(13), next: 뒤(37) });
  assert.equal(되살리기({ ...f, 지금: 때 }).예약, 'SYNK 매일 백업', '저녁 정기 회차의 실패는 새 실패다');
});

test('시작하기 전의 증거를 함께 남기고, 증거를 못 읽어도 시작한다', () => {
  const f = 방만들기(고장());
  const 증거 = (칸들) => { assert.deepEqual(칸들, ['server']); assert.equal(f.부름.length, 0, '시작하기 전에 읽는다'); return '앞 회차'; };
  assert.equal(되살리기({ ...f, 지금, 증거 }).앞영수증, '앞 회차');
  assert.equal(f.장부()[0].앞영수증, '앞 회차');
  const g = 방만들기(고장());
  const r = 되살리기({ ...g, 지금, 증거: () => { throw new Error('못 읽음'); } });
  assert.deepEqual([r.결과, '앞영수증' in r], ['시작함', false]);
});

test('예약을 조회하지 못하면 시작하지 않고, 앞의 것이 막히면 다음 것을 본다', () => {
  for (const 답 of [{ code: 1, stdout: '' }, { code: 0, stdout: '' }, { code: 0, stdout: '깨진' }, null]) {
    const f = 방만들기(고장());
    assert.match(되살리기({ ...f, 실행: () => 답, 지금 }).이유, /예약 상태를 읽지 못함/);
    assert.equal(fs.existsSync(path.join(f.방, '되살리기.json')), false);
  }
  const 실패 = 방만들기(고장());
  assert.match(되살리기({ ...실패, 실행: (명령, 인자) => ({ ...실패.실행(명령, 인자), code: 1 }), 지금 }).이유, /예약 상태를 읽지 못함/, '끝 코드가 0이 아니면 글이 있어도 믿지 않는다');
  const f = 방만들기(고장());
  f.예약들['SYNK 매일 백업'].result = 267014;
  assert.equal(되살리기({ ...f, 지금 }).예약, 'SYNK 복원 묶음 백업');
  f.예약들['SYNK 복원 묶음 백업'].result = 267014;
  assert.match(되살리기({ ...f, 지금: new Date(+지금 + 5 * 60000) }).이유, /SYNK 매일 백업: 사람이 끝낸 회차/);
  assert.equal(f.부름.length, 1);
  // 후보가 없으면 PowerShell을 부르지 않는다
  const 정상 = 방만들기(상태(칸('server'), 칸('media')));
  assert.equal(되살리기({ ...정상, 실행: () => { throw new Error('부르면 안 된다'); }, 지금 }).이유, '다시 돌릴 백업 없음');
});

test('같은 실패에는 한 번만 시작하고, 다음 정기 회차가 실패하면 다시 시작한다', () => {
  const f = 방만들기(상태(칸('server', 'interrupted', 끊김)));
  assert.equal(되살리기({ ...f, 실행: 시작은(f, () => ({ code: 1, stdout: '' })), 지금 }).결과, '시작하지 못함');
  const 다시 = (시각, 마지막, 다음) => {
    const 때 = new Date(시각), 줄 = 칸('server', 'failed', ['BACKUP_RUNNER_FAILED', 'SCHEDULE_LAST_RUN_FAILED'], { lastRunAt: 마지막, nextRunAt: 다음 });
    fs.writeFileSync(f.상태파일, JSON.stringify({ ...상태(줄), checkedAt: new Date(+때 - 60000).toISOString() }));
    Object.assign(f.예약들['SYNK 매일 백업'], { last: 마지막, next: 다음 });
    return 되살리기({ ...f, 지금: 때 });
  };
  // 12시간 15분 뒤에도 마지막 실행이 그대로다
  assert.equal(다시(+지금 + 12.25 * 3600000, 앞(25), 뒤(23)).예약, undefined);
  // 되살린 회차가 돌았지만 또 실패했다(정기 회차는 아직)
  assert.equal(다시(+지금 + 14 * 3600000, 뒤(1), 뒤(23)).예약, undefined);
  // 다음 정기 회차가 실패했다
  assert.equal(다시(+지금 + 24 * 3600000, 뒤(23), 뒤(47)).예약, 'SYNK 매일 백업');
  assert.equal(f.장부().length, 2);
});

test('시작하지 못해도 한 번으로 세고 조용히 끝난다', () => {
  for (const 답 of [{ code: 1, stdout: '' }, { code: 0, stdout: 'Disabled' }]) {
    const f = 방만들기(고장());
    assert.equal(되살리기({ ...f, 실행: 시작은(f, () => 답), 지금 }).결과, '시작하지 못함');
    assert.equal(f.장부()[0].결과, '시작하지 못함');
  }
  // 시작하다 죽어도 적힌 것이 남아 같은 예약을 15분마다 시작하지 않는다
  const f = 방만들기(고장());
  assert.throws(() => 되살리기({ ...f, 실행: 시작은(f, () => { throw new Error('끊김'); }), 지금 }));
  assert.equal(f.장부()[0].결과, '시작하는 중');
  assert.equal(되살리기({ ...f, 지금: new Date(+지금 + 15 * 60000) }).예약, 'SYNK 복원 묶음 백업');
  const g = 방만들기(고장());
  assert.equal(되살리기({ ...g, 실행: 시작은(g, () => ({ code: 0, stdout: 'Ready' })), 지금 }).결과, '시작했으나 도는 것을 못 봄');
});

test('꺼 두었거나 백업을 일부러 멈췄거나 기록을 못 읽으면 시작하지 않는다', () => {
  const 끔 = 방만들기(고장());
  fs.writeFileSync(path.join(끔.방, '되살리기_꺼둠'), '');
  assert.equal(되살리기({ ...끔, 지금 }).이유, '꺼 둠');
  const 멈춤 = 방만들기(고장());
  fs.writeFileSync(path.join(멈춤.창고, 'upload.stop'), '');
  assert.equal(되살리기({ ...멈춤, 지금 }).이유, '백업을 일부러 멈춘 동안');
  for (const 깨진 of ['{ 끊긴', '[]', '{"회차":1}']) {
    const f = 방만들기(고장());
    fs.writeFileSync(path.join(f.방, '되살리기.json'), 깨진);
    assert.equal(되살리기({ ...f, 지금 }).이유, '되살리기 기록을 읽지 못함', 깨진);
    assert.equal(f.부름.length, 0);
  }
  const 없음 = 방만들기(고장());
  fs.rmSync(없음.상태파일);
  assert.equal(되살리기({ ...없음, 지금 }).이유, '백업 상태를 읽지 못함');
  for (const f of [끔, 멈춤, 없음]) assert.equal(f.부름.length, 0);
});

test('예약 이름에 명령으로 읽힐 글자가 없다', () => {
  for (const { 예약: 이름 } of 다시돌릴예약) {
    assert.match(이름, /^SYNK [가-힣 ]+$/);
    assert.equal(시작명령(이름)[0], '-NoProfile');
  }
  assert.match(글읽기(조회명령()), /\$ErrorActionPreference = 'Stop'/, '조회 오류는 명령 실패로 끝난다');
  assert.doesNotMatch(글읽기(조회명령()), /SilentlyContinue/);
  assert.doesNotMatch(글읽기(조회명령()), /Start-ScheduledTask|Stop-ScheduledTask|Register-|Set-ScheduledTask|Disable-|Enable-|Remove-/, '조회는 읽기만 한다');
});

test('알림해결은 되살리기를 먼저 하고, 그것이 막혀도 요청을 본다', async () => {
  const 집 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-revive-home-')), 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-revive-room-'));
  const 실행 = () => ({ code: 0, stdout: '' });
  let 받은;
  const 부름 = 만들기({ 집고정: 집, 지금고정: 지금, 되살리기: (x) => { 받은 = x; return { 예약: 'SYNK 매일 백업', 결과: '시작함' }; } });
  assert.match((await 부름.사전확인({ 방, 실행 })).이유, /기다리는 요청 없음 · 되살리기: SYNK 매일 백업 시작함/);
  assert.equal(받은.방, 방);
  assert.equal(받은.실행, 실행);
  assert.equal(+받은.지금, +지금);
  const 막힘 = 만들기({ 집고정: 집, 지금고정: 지금, 되살리기: () => { throw new Error('x'); } });
  assert.match((await 막힘.사전확인({ 방, 실행 })).이유, /기다리는 요청 없음 · 되살리기: 되살리기 오류/);
  assert.equal((await 만들기({ 집고정: 집, 지금고정: 지금 }).사전확인({ 방, 실행 })).이유, '기다리는 요청 없음', '시험에서는 진짜 예약을 시작하지 않는다');
});

test('되살린 기록은 이틀 것만 지시문에 들어간다', async () => {
  const f = 방만들기(고장());
  되살리기({ ...f, 지금 });
  fs.writeFileSync(path.join(f.방, '되살리기.json'), JSON.stringify({ 회차: [{ 예약: 'SYNK 미디어 원본 백업', 시각: 앞(50 * 60), 코드: [] }, ...f.장부()] }));
  assert.deepEqual(최근기록(f.방, 지금).map((x) => x.예약), ['SYNK 매일 백업']);
  assert.deepEqual(최근기록(path.join(f.방, '없음'), 지금), []);
  const 작업 = 만들기({ 집고정: f.방 });
  const 지시 = 작업.지시문({ 항목: [{ id: 'backup-server', 제목: 't' }], 풀린일: [], 만든때: 지금, 기다림끝: 지금, 되살린기록: 최근기록(f.방, 지금), 백업영수증: '영수증 줄', 운영기록: '기록 줄' });
  assert.match(지시, /기계가 다시 시작하려 한 백업 예약/);
  assert.match(지시, /11-23 05:55 KST · SYNK 매일 백업 · 결과 시작함 · 까닭 PROCESS_OR_HEARTBEAT_MISSING/);
  assert.match(지시, /영수증 줄/);
  assert.match(지시, /기록 줄/);
});
