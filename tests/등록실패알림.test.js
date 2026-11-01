'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { DatabaseSync } = require('node:sqlite');
const notices = require('../tools/lib/등록실패알림.js');
const makeReceiver = require('./_notification-receiver.cjs');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'failure-outbox-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, 'notice.sqlite');
  const receiver = makeReceiver(path.join(root, 'receiver.sqlite'));
  return { file, receiver, query(sql, ...args) { const db = new DatabaseSync(file); try { return db.prepare(sql).all(...args); } finally { db.close(); } },
    exec(sql) { const db = new DatabaseSync(file); try { db.exec(sql); } finally { db.close(); } } };
}
const withIdentity = (send, botId = 'bot', target = 'peer') => Object.assign(send, { identity: () => ({ botId, target }) });

test('등록 성공이 현재 실패 회차를 지워도 미전송 알림과 새 회차를 모두 한 번씩 보낸다', async t => {
  const f = fixture(t);
  notices.enqueue(f.file, 'old');
  await assert.rejects(notices.dispatch(f.file, async () => { throw Error('offline'); }), /offline/);
  notices.clear(f.file);
  notices.enqueue(f.file, 'new');
  assert.equal(await notices.dispatch(f.file, f.receiver), 2);
  assert.deepEqual(f.receiver.rows().map(x => x.body), ['old', 'new']);
  assert.equal(new Set(f.receiver.rows().map(x => x.random_id)).size, 2);
  assert.equal(await notices.dispatch(f.file, f.receiver), 0);
});

test('전송 중에도 같은 파일에 새 회차를 기록할 수 있고 전송 잠금이 바빠도 큐는 남는다', async t => {
  const f = fixture(t); let release;
  notices.enqueue(f.file, 'old');
  const pending = notices.dispatch(f.file, async () => { await new Promise(resolve => { release = resolve; }); });
  notices.clear(f.file);
  notices.enqueue(f.file, 'new');
  assert.equal(await notices.dispatch(f.file, f.receiver), 0);
  assert.equal(f.query("SELECT * FROM notice_outbox WHERE status='pending'").length, 2);
  release(); assert.equal(await pending, 1);
  assert.equal(f.query('SELECT sent FROM notice')[0].sent, 0, '옛 완료는 새 회차를 확정하지 않는다');
  assert.equal(await notices.dispatch(f.file, f.receiver), 1);
  assert.equal(f.receiver.rows()[0].body, 'new');
});

test('한 실패 회차를 다시 기록해도 본문과 ID는 바뀌지 않는다', t => {
  const f = fixture(t);
  notices.enqueue(f.file, 'first');
  const first = f.query('SELECT * FROM notice_outbox')[0];
  notices.enqueue(f.file, 'second');
  assert.deepEqual(f.query('SELECT * FROM notice_outbox'), [first]);
});

test('오류 글을 자르며 생긴 불완전한 유니코드도 전송 가능한 동일 본문으로 보관한다', async t => {
  const f = fixture(t), text = ('a'.repeat(299) + '😀').slice(0, 300);
  notices.enqueue(f.file, text);
  assert.equal(await notices.dispatch(f.file, f.receiver), 1);
  const body = f.receiver.rows()[0].body;
  assert.equal(body.isWellFormed(), true);
  assert.equal(Buffer.from(body).toString('utf8'), body);
});

test('수신 결과 유실 뒤 봇·대상을 바꾸면 기존 알림 ID의 재사용을 거절한다', async t => {
  const f = fixture(t); notices.enqueue(f.file, 'fixture');
  await assert.rejects(notices.dispatch(f.file, withIdentity(async (text, delivery) => { await f.receiver(text, delivery); throw Error('response lost'); })), /response lost/);
  for (const send of [withIdentity(async () => assert.fail('다른 봇에 보내면 안 된다'), 'other'), withIdentity(async () => assert.fail('다른 대상에 보내면 안 된다'), 'bot', 'other')]) {
    await assert.rejects(notices.dispatch(f.file, send), /봇·대상/);
  }
  assert.equal(await notices.dispatch(f.file, withIdentity(f.receiver)), 1);
  assert.equal(f.receiver.rows().length, 1);
});

test('2^53보다 큰 int64 ID도 저장·재시도에서 문자열 그대로 유지한다', async t => {
  const f = fixture(t); notices.enqueue(f.file, 'fixture');
  f.exec("UPDATE notice_outbox SET random_id='9223372036854775806'");
  await assert.rejects(notices.dispatch(f.file, async (text, delivery) => {
    assert.equal(delivery.randomId, '9223372036854775806'); await f.receiver(text, delivery); throw Error('response lost');
  }), /response lost/);
  assert.equal(await notices.dispatch(f.file, f.receiver), 1);
  assert.equal(f.receiver.rows()[0].random_id, '9223372036854775806');
  assert.equal(f.receiver.rows().length, 1);
});

test('앞의 알림이 현재 봇과 다르더라도 뒤의 새 회차 알림은 전송하고 부분 실패를 알린다', async t => {
  const f = fixture(t); notices.enqueue(f.file, 'old');
  await assert.rejects(notices.dispatch(f.file, withIdentity(async () => { throw Error('offline'); }, 'old-bot')), /offline/);
  notices.clear(f.file); notices.enqueue(f.file, 'new');
  await assert.rejects(notices.dispatch(f.file, withIdentity(f.receiver, 'new-bot')), error => error.sent === 1 && /봇·대상/.test(error.message));
  assert.deepEqual(f.receiver.rows().map(x => x.body), ['new']);
  assert.deepEqual(f.query('SELECT status FROM notice_outbox ORDER BY rowid').map(x => x.status), ['pending', 'sent']);
});

test('설정이 없어도 먼저 큐에 보관하고, 준비되면 같은 알림을 보낸다', async t => {
  const f = fixture(t); notices.enqueue(f.file, 'fixture');
  await assert.rejects(notices.dispatch(f.file, Object.assign(async () => assert.fail('인증 전 전송 금지'), { identity: () => { throw Error('config missing'); } })), /config missing/);
  assert.equal(f.query('SELECT status,bot_id FROM notice_outbox')[0].status, 'pending');
  assert.equal(await notices.dispatch(f.file, f.receiver), 1);
  assert.equal(f.receiver.rows().length, 1);
});

test('FLOOD_WAIT는 송신 중에 잠들지 않고 정해진 시각 뒤 같은 ID로 이어 보낸다', async t => {
  const f = fixture(t); notices.enqueue(f.file, 'fixture');
  await assert.rejects(notices.dispatch(f.file, async () => { throw Object.assign(Error('slow down'), { code: 'FLOOD_WAIT', retryAfter: 3600 }); }), /slow down/);
  const row = f.query('SELECT * FROM notice_outbox')[0];
  assert.equal(row.last_error, 'FLOOD_WAIT');
  assert.ok(row.next_attempt_at > Date.now() + 3500000);
  assert.equal(await notices.dispatch(f.file, async () => assert.fail('대기 시각 전 재전송 금지')), 0);
  f.exec('UPDATE notice_outbox SET next_attempt_at=0');
  assert.equal(await notices.dispatch(f.file, f.receiver), 1);
  assert.equal(f.receiver.rows()[0].random_id, row.random_id);
});

test('RANDOM_ID_DUPLICATE는 아직 처리 중이므로 성공으로 세지 않고 나중에 확인한다', async t => {
  const f = fixture(t); notices.enqueue(f.file, 'fixture');
  await assert.rejects(notices.dispatch(f.file, async () => { throw Object.assign(Error('in flight'), { code: 'RANDOM_ID_DUPLICATE' }); }), /in flight/);
  assert.equal(f.query('SELECT status FROM notice_outbox')[0].status, 'pending');
  assert.equal(await notices.dispatch(f.file, f.receiver), 1);
});
