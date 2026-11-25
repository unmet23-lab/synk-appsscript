'use strict';
// 11-25 알림해결: 감시가 기다리게 둔 하루 묶음을 한 번만 집고, 마지막 답을 감시가 읽는 진단 파일로 남긴다. 읽기만 하고 고치지 않는다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { 만들기, 예약상태, 설정 } = require('../tools/크레딧작업/알림해결.js');
const monitor = require('../tools/hermes-synk/monitor.cjs');

function 준비({ 남은분 = 100 } = {}) {
  const 집 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-alert-fix-'));
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-alert-fix-room-'));
  const 보낼곳 = path.join(집, 'runtime/synk-automation/outbox');
  fs.mkdirSync(보낼곳, { recursive: true });
  const 지금 = new Date('2026-11-25T00:10:00Z');
  const events = [{ id: 'ops-copy-task', fingerprint: 'f1', incident: 'i1', needs_attention: true }];
  const 묶음 = { ...monitor.attentionNotification([{ id: 'ops-copy-task', attention_fingerprint: 'f1', incident: 'i1', title: '운영 사본 갱신이 멈춤', detail: '30분 넘게 갱신 기록이 없습니다' }], 'SYNK · 오늘 확인할 일'),
    events, createdAt: '2026-11-25T00:05:00.000Z',
    digest: { day: '2026-11-25', holdUntil: new Date(+지금 + 남은분 * 60000).toISOString(), items: [{ id: 'ops-copy-task', title: '운영 사본 갱신이 멈춤', detail: '30분 넘게 갱신 기록이 없습니다' }], recoveries: [] } };
  fs.writeFileSync(path.join(보낼곳, 묶음.id + '.json'), JSON.stringify(묶음));
  return { 집, 방, 보낼곳, 지금, 묶음, 작업: 만들기({ 집고정: 집, 지금고정: 지금 }) };
}

test('기다리는 묶음을 한 번만 집고 진단을 감시가 읽는 꼴로 남긴다', async () => {
  const f = 준비();
  const 자료 = await f.작업.사전확인({ 방: f.방, 실행: () => ({ code: 0, stdout: 'SYNK 운영 사본 갱신 | Ready | 마지막 2026-11-25 08:50 | 결과 1 | 다음 2026-11-25 08:55\r\n' }) });
  assert.equal(자료.id, f.묶음.id);
  assert.equal(자료.항목[0].id, 'ops-copy-task');
  const 지시 = f.작업.지시문(자료);
  assert.match(지시, /ops-copy-task/);
  assert.match(지시, /SYNK 운영 사본 갱신 \| Ready/, '미리 모은 예약 상태를 넣는다');
  assert.match(지시, /아무것도 고치지 않습니다/);
  assert.equal((await f.작업.사전확인({ 방: f.방 })).할일, false, '같은 묶음은 다시 집지 않는다');
  const 답 = JSON.stringify({ items: [
    { id: 'ops-copy-task', 원인: '갱신 예약이 앞 회차 잠금에 막혔다', 해결: '주인 없는 잠금을 넘게 코드를 고친다', 상태: 'AI가 고칠 수 있음' },
    { id: '모르는-알림', 원인: '지어낸 줄', 해결: '버려야 한다', 상태: '유호님 차례' },
  ], note: '' });
  const 사후 = await f.작업.사후({ 글: '끝났습니다.\n' + 답, 비용: 1.2 }, 자료, { 경로: '크레딧' });
  assert.deepEqual(사후, { 항목: 1, 유호님차례: 0 });
  const 진단 = monitor.readDiagnosis(path.join(f.집, 'runtime/synk-automation'), f.묶음.id);
  assert.equal(진단.items.length, 1, '묶음에 없는 id는 버린다');
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
  assert.doesNotMatch(monitor.digestText(f.묶음, 진단), /고친 것/);
});

test('읽기 도구만 열고 크레딧으로만 돈다', () => {
  const f = 준비();
  const 인자 = f.작업.인자();
  assert.equal(인자[인자.indexOf('--permission-mode') + 1], 'dontAsk');
  assert.deepEqual(JSON.parse(인자[인자.indexOf('--settings') + 1]), 설정);
  assert.deepEqual(설정.permissions.allow, ['Read', 'Glob', 'Grep']);
  for (const 막음 of ['Bash', 'PowerShell', 'Edit', 'Write', 'WebFetch', 'WebSearch', 'Task']) assert.ok(설정.permissions.deny.includes(막음), 막음);
  assert.equal(f.작업.구독대체, false);
});

test('예약 상태는 가린 글로 넣고 못 읽으면 빈 글이다', () => {
  assert.equal(예약상태(() => ({ code: 0, stdout: 'SYNK x | Ready | founder@synk.im\n' })), 'SYNK x | Ready | [계정]');
  assert.equal(예약상태(() => ({ code: 1, stdout: 'x' })), '');
  assert.equal(예약상태(() => { throw new Error('없음'); }), '');
  assert.equal(예약상태(undefined), '');
});

test('답을 못 읽어도 진단 파일을 남겨 묶음이 기다리지 않게 한다', async () => {
  const f = 준비();
  const 자료 = await f.작업.사전확인({ 방: f.방 });
  await f.작업.사후({ 글: '중간에 끊겼습니다', 비용: 0.3 }, 자료, {});
  const 진단 = monitor.readDiagnosis(path.join(f.집, 'runtime/synk-automation'), f.묶음.id);
  assert.deepEqual(진단.items, []);
  assert.match(monitor.digestText(f.묶음, 진단), /결과를 내지 못했어요/);
});

test('곧 그대로 나갈 묶음이나 보낸 묶음은 집지 않는다', async () => {
  const 곧 = 준비({ 남은분: 5 });
  assert.equal((await 곧.작업.사전확인({ 방: 곧.방 })).할일, false);
  const 보냄 = 준비();
  fs.writeFileSync(path.join(보냄.보낼곳, 보냄.묶음.id + '.claim'), 'sent');
  assert.equal((await 보냄.작업.사전확인({ 방: 보냄.방 })).할일, false);
});
