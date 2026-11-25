'use strict';
// 11-25 알림해결: 감시가 남긴 오늘 요청을 한 번만 집고, 마지막 답을 감시가 읽는 진단 파일로 남긴다. 도구가 없고 고치지 않는다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { 만들기, 예약상태, 설정, 답가리기, 감시설명, 예약설명, 백업상태 } = require('../tools/크레딧작업/알림해결.js');
const monitor = require('../tools/hermes-synk/monitor.cjs');

function 준비({ 남은분 = 100 } = {}) {
  const 집 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-alert-fix-'));
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-alert-fix-room-'));
  const 자리 = path.join(집, 'runtime/synk-automation'), 보낼곳 = path.join(자리, 'outbox');
  fs.mkdirSync(보낼곳, { recursive: true });
  fs.mkdirSync(path.join(자리, 'diagnosis'), { recursive: true });
  const 지금 = new Date('2026-11-25T00:10:00Z');
  const 묶음 = { version: 1, id: monitor.digestId('2026-11-25'), day: '2026-11-25', createdAt: '2026-11-25T00:05:00.000Z',
    holdUntil: new Date(+지금 + 남은분 * 60000).toISOString(),
    items: [{ id: 'ops-copy-task', incident: 'i1', title: '운영 사본 갱신이 멈춤', detail: '30분 넘게 갱신 기록이 없습니다' }], recoveries: [] };
  fs.writeFileSync(path.join(자리, 'diagnosis/request.json'), JSON.stringify(묶음));
  fs.writeFileSync(path.join(자리, 'state.json'), JSON.stringify({ digest: { day: 묶음.day, id: 묶음.id, status: 'waiting', holdUntil: 묶음.holdUntil } }));
  return { 집, 방, 자리, 보낼곳, 지금, 묶음, 작업: 만들기({ 집고정: 집, 지금고정: 지금 }) };
}

test('오늘 요청을 한 번만 집고 진단을 감시가 읽는 꼴로 남긴다', async () => {
  const f = 준비();
  const 자료 = await f.작업.사전확인({ 방: f.방, 실행: () => ({ code: 0, stdout: 'SYNK 운영 사본 갱신 | Ready | 마지막 2026-11-25 08:50 | 결과 1 | 다음 2026-11-25 08:55\r\n' }) });
  assert.equal(자료.id, f.묶음.id);
  assert.equal(자료.항목[0].id, 'ops-copy-task');
  const 지시 = f.작업.지시문(자료);
  assert.match(지시, /ops-copy-task/);
  assert.match(지시, /SYNK 운영 사본 갱신 \| Ready/, '미리 모은 예약 상태를 넣는다');
  assert.match(지시, /아무것도 고치지 않습니다/);
  assert.equal((await f.작업.사전확인({ 방: f.방 })).할일, false, '같은 요청은 다시 집지 않는다');
  const 답 = JSON.stringify({ items: [
    { id: 'ops-copy-task', 원인: '갱신 예약이 앞 회차 잠금에 막혔다', 해결: '주인 없는 잠금을 넘게 코드를 고친다', 상태: 'AI가 고칠 수 있음' },
    { id: '모르는-알림', 원인: '지어낸 줄', 해결: '버려야 한다', 상태: '유호님 차례' },
  ], note: '' });
  const 사후 = await f.작업.사후({ 글: '끝났습니다.\n' + 답, 비용: 1.2 }, 자료, { 경로: '크레딧' });
  assert.deepEqual(사후, { 항목: 1, 유호님차례: 0 });
  const 진단 = monitor.readDiagnosis(path.join(f.집, 'runtime/synk-automation'), f.묶음.id);
  assert.equal(진단.items.length, 1, '요청에 없는 id는 버린다');
  assert.equal(진단.items[0].incident, 'i1', '물은 사건을 적어 다른 사건에 붙지 않게 한다');
  assert.doesNotMatch(monitor.digestText({ ...f.묶음, items: [{ ...f.묶음.items[0], incident: 'i2' }] }, 진단), /앞 회차 잠금/, '새 사건에는 붙지 않는다');
  const 글 = monitor.digestText(f.묶음, 진단);
  assert.match(글, /원인: 갱신 예약이 앞 회차 잠금에 막혔다/);
  assert.match(글, /해결: AI가 고칠 수 있어요\. 주인 없는 잠금을/);
  assert.equal((await f.작업.사전확인({ 방: f.방 })).할일, false, '진단이 있으면 할 일이 없다');
});

test('진단 실행은 고쳤다고 말할 수 없다', async () => {
  const f = 준비();
  const 자료 = await f.작업.사전확인({ 방: f.방 });
  await f.작업.사후({ 글: JSON.stringify({ items: [{ id: 'ops-copy-task', 원인: 'x', 해결: '고쳐 올렸다', 상태: '고침' }], note: '' }) }, 자료, {});
  const 진단 = monitor.readDiagnosis(path.join(f.집, 'runtime/synk-automation'), f.묶음.id);
  assert.equal(진단.items[0].state, '확인 필요');
  assert.doesNotMatch(monitor.digestText(f.묶음, 진단), /고친 것|고쳐 올렸다/, '고쳤다는 말이 본문에 없다');
});

test('도구를 하나도 주지 않고 크레딧으로만 돈다', () => {
  const f = 준비();
  const 인자 = f.작업.인자();
  assert.equal(인자[인자.indexOf('--tools') + 1], '', '도구를 모두 끈다');
  assert.equal(인자[인자.indexOf('--disallowedTools') + 1], 'mcp__*');
  assert.equal(인자[인자.indexOf('--mcp-config') + 1], '{"mcpServers":{}}');
  assert.ok(인자.includes('--strict-mcp-config') && 인자.includes('--disable-slash-commands'));
  assert.equal(인자[인자.indexOf('--permission-mode') + 1], 'dontAsk');
  assert.deepEqual(JSON.parse(인자[인자.indexOf('--settings') + 1]), 설정);
  assert.deepEqual(설정.permissions.allow, [], '경로 없는 Read 허용은 폴더 밖에도 적용된다');
  for (const 막음 of ['Read', 'Glob', 'Grep', 'Bash', 'PowerShell', 'Edit', 'Write', 'WebFetch', 'WebSearch', 'Task']) assert.ok(설정.permissions.deny.includes(막음), 막음);
  assert.equal(f.작업.구독대체, false);
});

test('지시문에 감시 설명과 걸리는 예약 줄을 넣는다', async () => {
  assert.match(감시설명(), /^## 오늘 확인/);
  assert.match(예약설명(['ops-copy-task']), /운영 사본 갱신/);
  assert.equal(예약설명(['모르는-종류']), '');
  const f = 준비();
  const 지시 = f.작업.지시문(await f.작업.사전확인({ 방: f.방 }));
  assert.match(지시, /도구가 없으므로 아래 글만으로 판단합니다/);
  assert.match(지시, /SYNK 운영 사본 갱신/);
  assert.ok(지시.length < 40000, '지시문 길이 ' + 지시.length);
});

test('예약 상태는 가린 글로 넣고 못 읽으면 빈 글이다', () => {
  assert.equal(예약상태(() => ({ code: 0, stdout: 'SYNK x | Ready | founder@synk.im\n' })), 'SYNK x | Ready | [계정]');
  assert.equal(예약상태(() => ({ code: 1, stdout: 'x' })), '');
  assert.equal(예약상태(() => { throw new Error('없음'); }), '');
  assert.equal(예약상태(undefined), '');
});

test('백업 상태는 칸마다 한 줄로 줄이고 못 읽으면 빈 글이다', () => {
  const 파일 = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'synk-backup-')), 'backup-health.json');
  fs.writeFileSync(파일, JSON.stringify({ checkedAt: '2026-11-25T12:00:00Z', status: 'pending', components: Array.from({ length: 12 }, (_, i) => ({ id: 'c' + i, label: '칸 ' + i, status: i ? 'ok' : 'failed',
    lastSuccessAt: '2026-11-24T03:10:00Z', codes: i ? [] : ['LATE'], receiptPath: 'C:/비밀/길', scope: '긴 글 '.repeat(200) })) }));
  const 글 = 백업상태(파일);
  assert.match(글, /backup-c0 \| 칸 0 \| failed \| .*마지막 성공 2026-11-24T03:10:00Z \| LATE/);
  assert.match(글, /backup-c11 /, '끝 칸까지 남는다');
  assert.doesNotMatch(글, /비밀|긴 글/);
  fs.writeFileSync(파일, '{ 끊긴');
  assert.equal(백업상태(파일), '');
});

test('빈 답은 진단으로 치지 않고 실패 안내를 남긴다', async () => {
  for (const 글 of ['{}', '{"items":[]}', '{"items":[{"id":"ops-copy-task"}]}']) {
    const f = 준비();
    const 자료 = await f.작업.사전확인({ 방: f.방 });
    await f.작업.사후({ 글, 비용: 0.1 }, 자료, {});
    const 진단 = monitor.readDiagnosis(path.join(f.집, 'runtime/synk-automation'), f.묶음.id);
    assert.match(monitor.digestText(f.묶음, 진단), /결과를 내지 못했어요/, 글);
  }
});

test('답에 섞인 비밀 꼴은 본문에 싣지 않는다', async () => {
  const 토큰 = '123456789:' + 'AbCd'.repeat(8);
  assert.equal(답가리기('토큰 ' + 토큰 + ' 끝', 200), '토큰 [인증값] 끝');
  assert.equal(답가리기('SYNK 운영 사본 갱신 예약을 다시 켠다', 200), 'SYNK 운영 사본 갱신 예약을 다시 켠다');
  const f = 준비();
  const 자료 = await f.작업.사전확인({ 방: f.방 });
  await f.작업.사후({ 글: JSON.stringify({ items: [{ id: 'ops-copy-task', 원인: '값 ' + 토큰, 해결: '키 ' + 'a1'.repeat(24), 상태: '확인 필요' }], note: '덧붙임 ' + 토큰 }) }, 자료, {});
  const 글 = monitor.digestText(f.묶음, monitor.readDiagnosis(path.join(f.집, 'runtime/synk-automation'), f.묶음.id));
  assert.ok(!글.includes(토큰) && !글.includes('a1'.repeat(24)), '본문에 비밀 꼴이 없다');
});

test('답을 못 읽어도 진단 파일을 남겨 알림이 기다리지 않게 한다', async () => {
  const f = 준비();
  const 자료 = await f.작업.사전확인({ 방: f.방 });
  await f.작업.사후({ 글: '중간에 끊겼습니다', 비용: 0.3 }, 자료, {});
  const 진단 = monitor.readDiagnosis(path.join(f.집, 'runtime/synk-automation'), f.묶음.id);
  assert.deepEqual(진단.items, []);
  assert.match(monitor.digestText(f.묶음, 진단), /결과를 내지 못했어요/);
});

test('곧 그대로 나갈 요청, 이미 보낸 요청, 꼴이 다른 요청은 집지 않는다', async () => {
  const 곧 = 준비({ 남은분: 5 });
  assert.equal((await 곧.작업.사전확인({ 방: 곧.방 })).할일, false);
  const 보냄 = 준비();
  fs.writeFileSync(path.join(보냄.보낼곳, 보냄.묶음.id + '.claim'), 'sent');
  assert.equal((await 보냄.작업.사전확인({ 방: 보냄.방 })).할일, false);
  for (const 바꿈 of [{ version: 2 }, { id: '../밖' }, { items: [] }]) {
    const f = 준비();
    fs.writeFileSync(path.join(f.자리, 'diagnosis/request.json'), JSON.stringify({ ...f.묶음, ...바꿈 }));
    assert.equal((await f.작업.사전확인({ 방: f.방 })).할일, false, JSON.stringify(바꿈));
  }
  // 감시가 그날을 닫았거나 이미 보내는 중이면 크레딧을 쓰지 않는다.
  for (const 상태 of [{ digest: { id: 보냄.묶음.id, status: 'done' } }, { digest: { id: 보냄.묶음.id, status: 'sending' } }, { digest: { id: 'event-' + '0'.repeat(24), status: 'waiting' } }, {}]) {
    const f = 준비();
    fs.writeFileSync(path.join(f.자리, 'state.json'), JSON.stringify(상태));
    assert.equal((await f.작업.사전확인({ 방: f.방 })).할일, false, JSON.stringify(상태));
  }
  const 없음 = 준비();
  fs.rmSync(path.join(없음.자리, 'diagnosis/request.json'));
  assert.equal((await 없음.작업.사전확인({ 방: 없음.방 })).할일, false);
});
