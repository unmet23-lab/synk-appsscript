'use strict';
// 전송할 내용과 ID는 먼저 확정한다. 수신 확인 전 종료되면 같은 ID로 재시도한다.
// Telegram의 중복 제거 계약: https://core.telegram.org/api/updates#updatemessageid-updates
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, randomBytes } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const busy = error => error?.errcode === 5 || /database is locked/i.test(error?.message || '');

function open(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  try {
    db.exec(`PRAGMA busy_timeout=5000; PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS notice (id INTEGER PRIMARY KEY CHECK(id=1), message TEXT NOT NULL, sent INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS notice_claim (id INTEGER PRIMARY KEY CHECK(id=1), token TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS notice_outbox (
        token TEXT PRIMARY KEY, random_id TEXT NOT NULL UNIQUE, message TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending','sent')), bot_id TEXT, target TEXT, receipt TEXT,
        next_attempt_at INTEGER NOT NULL DEFAULT 0, last_error TEXT
      )`);
    return db;
  } catch (error) { db.close(); throw error; }
}
function transaction(db, action) {
  db.exec('BEGIN IMMEDIATE');
  try { const result = action(); db.exec('COMMIT'); return result; }
  catch (error) { try { db.exec('ROLLBACK'); } catch { /* close도 미완료 트랜잭션을 되돌린다. */ } throw error; }
}
function ensureOutbox(db) {
  const current = db.prepare('SELECT n.message, n.sent, c.token FROM notice n LEFT JOIN notice_claim c ON c.id=n.id WHERE n.id=1').get();
  if (!current || current.sent === 1) return;
  if (current.token && db.prepare('SELECT 1 FROM notice_outbox WHERE token=?').get(current.token)) return;
  // 이전 Bot API 전송의 결과 미확인은 새 MTProto ID로 다시 보내면 중복될 수 있다.
  if (current.sent === 2) return;
  let randomId;
  do { randomId = randomBytes(8).readBigInt64BE().toString(); } while (randomId === '0');
  const token = randomUUID();
  db.prepare("INSERT INTO notice_outbox(token,random_id,message,status) VALUES(?,?,?,'pending')").run(token, randomId, current.message);
  db.prepare('INSERT INTO notice_claim(id,token) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET token=excluded.token').run(token);
}
function enqueue(file, message) {
  message = String(message).toWellFormed();
  const db = open(file);
  try {
    transaction(db, () => {
      db.prepare('INSERT OR IGNORE INTO notice(id,message,sent) VALUES(1,?,0)').run(message);
      ensureOutbox(db);
    });
  } finally { db.close(); }
}
function acquireSendLock(folder) {
  const db = new DatabaseSync(path.join(folder, '.송신잠금'));
  try {
    db.exec('CREATE TABLE IF NOT EXISTS send_lock(id INTEGER PRIMARY KEY); BEGIN IMMEDIATE');
    return db;
  } catch (error) { db.close(); if (busy(error)) return null; throw error; }
}
async function dispatch(file, send) {
  if (!fs.existsSync(file)) return 0;
  const lock = acquireSendLock(path.dirname(file));
  if (!lock) return 0; // enqueue는 이 별도 잠금과 상관없이 이미 확정돼 있다.
  let db, count = 0;
  try {
    db = open(file);
    transaction(db, () => ensureOutbox(db));
    const pending = db.prepare("SELECT * FROM notice_outbox WHERE status='pending' AND next_attempt_at<=? ORDER BY rowid").all(Date.now());
    if (!pending.length) {
      if (db.prepare('SELECT sent FROM notice WHERE id=1').get()?.sent === 2) {
        console.error('  ! 이전 Bot API 알림 전송 결과 미확인 — 확인 없이 새 ID로 재전송하지 않는다');
      }
      return 0;
    }
    // 주입한 송신 함수는 시험용이며 실제 비밀값을 읽지 않는다. 기본 송신기는 identity를 제공한다.
    const identity = send.identity ? await send.identity() : { botId: 'injected', target: 'injected' };
    if (!identity?.botId || !identity?.target) throw new Error('알림 전송 계정·대상을 확인하지 못했다');
    const errors = [];
    for (const row of pending) {
      try {
        transaction(db, () => {
          if (row.bot_id === null && row.target === null) {
            db.prepare('UPDATE notice_outbox SET bot_id=?,target=? WHERE token=? AND bot_id IS NULL AND target IS NULL').run(identity.botId, identity.target, row.token);
          } else if (row.bot_id !== identity.botId || row.target !== identity.target) {
            throw Object.assign(new Error('알림에 확정한 봇·대상이 현재 설정과 다르다 — 원래 전송 기록을 보존한다'), { code: 'OUTBOX_IDENTITY_CHANGED' });
          }
        });
        // 알림 DB의 쓰기 트랜잭션은 이 외부 호출 동안 잡지 않는다.
        const receipt = await send(row.message, { token: row.token, randomId: row.random_id, botId: identity.botId, target: identity.target });
        transaction(db, () => {
          db.prepare("UPDATE notice_outbox SET status='sent',receipt=?,last_error=NULL WHERE token=? AND status='pending'").run(JSON.stringify(receipt ?? { confirmedByAdapter: true }), row.token);
          db.prepare('UPDATE notice SET sent=1 WHERE id=1 AND EXISTS(SELECT 1 FROM notice_claim WHERE id=1 AND token=?)').run(row.token);
        });
        count++;
      }
      catch (error) {
        const seconds = Number.isSafeInteger(error?.retryAfter) && error.retryAfter > 0 ? Math.min(error.retryAfter, 2**31 - 1) : 0;
        const code = /^[A-Z][A-Z0-9_]{0,60}$/.test(error?.code || '') ? error.code : 'DELIVERY_FAILED';
        try {
          transaction(db, () => db.prepare("UPDATE notice_outbox SET next_attempt_at=?,last_error=? WHERE token=? AND status='pending'").run(Date.now() + seconds * 1000, code, row.token));
        } catch (recordError) {
          errors.push(new AggregateError([error, recordError], `알림과 재시도 기록을 처리하지 못했다: ${error.message} / 기록: ${recordError.message}`, { cause: error }));
          continue;
        }
        errors.push(error);
      }
    }
    if (errors.length) throw Object.assign(new AggregateError(errors, `${count}건 수신 확인·${errors.length}건 전송 대기: ${errors.map(e => e.message).join('; ')}`), { sent: count });
    return count;
  } finally {
    db?.close();
    try { lock.exec('ROLLBACK'); } finally { lock.close(); }
  }
}
function clear(file) {
  if (!fs.existsSync(file)) return;
  const db = open(file);
  try { transaction(db, () => {
    db.prepare('DELETE FROM notice WHERE id=1').run();
    db.prepare('DELETE FROM notice_claim WHERE id=1').run();
  }); }
  finally { db.close(); }
  // outbox는 수신 확인 전에는 지우지 않는다. 이전 회차의 완료가 새 회차를 바꾸지도 않는다.
}
module.exports = { enqueue, dispatch, clear };
