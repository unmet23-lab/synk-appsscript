'use strict';
// 11-25 알림해결: 감시가 기다리게 둔 하루 묶음을 한 번만 집고, 마지막 답을 감시가 읽는 진단 파일로 남긴다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { 만들기 } = require('../tools/크레딧작업/알림해결.js');
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
  const 자료 = await f.작업.사전확인({ 방: f.방 });
  assert.equal(자료.id, f.묶음.id);
  assert.equal(자료.항목[0].id, 'ops-copy-task');
  assert.match(f.작업.지시문(자료), /ops-copy-task/);
  assert.match(f.작업.지시문(자료), /텔레그램을 보내지 않습니다/);
  assert.equal((await f.작업.사전확인({ 방: f.방 })).할일, false, '같은 묶음은 다시 집지 않는다');
  const 답 = JSON.stringify({ items: [
    { id: 'ops-copy-task', 원인: '갱신 예약이 앞 회차 잠금에 막혔다', 해결: '주인 없는 잠금을 넘게 고쳐 올리고 예약을 다시 돌렸다', 상태: '고침' },
    { id: '모르는-알림', 원인: '지어낸 줄', 해결: '버려야 한다', 상태: '고침' },
  ], 올린커밋: 'abc1234def', note: '' });
  const 사후 = await f.작업.사후({ 글: '끝났습니다.\n' + 답, 비용: 1.2 }, 자료, { 경로: '크레딧' });
  assert.deepEqual(사후, { 항목: 1, 고침: 1, 커밋: 'abc1234def' });
  const 진단 = monitor.readDiagnosis(path.join(f.집, 'runtime/synk-automation'), f.묶음.id);
  assert.equal(진단.items.length, 1, '묶음에 없는 id는 버린다');
  const 글 = monitor.digestText(f.묶음, 진단);
  assert.match(글, /원인: 갱신 예약이 앞 회차 잠금에 막혔다/);
  assert.match(글, /고친 것: 주인 없는 잠금을/);
  assert.match(글, /올린 커밋 abc1234def/);
  assert.equal((await f.작업.사전확인({ 방: f.방 })).할일, false, '진단이 있으면 할 일이 없다');
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
