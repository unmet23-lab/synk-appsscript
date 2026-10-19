import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createCollaborationService } from '../collaboration-service.mjs';
import { createMessenger } from '../server.mjs';

const stamp = '2026-10-08T01:00:00.000Z';

function meter(db) {
  const original = db.prepare.bind(db);
  let preparing = 0, executing = 0;
  db.prepare = sql => {
    preparing++;
    const statement = original(sql);
    return new Proxy(statement, { get(target, name) {
      const value = Reflect.get(target, name, target);
      if (['get', 'all', 'run', 'iterate'].includes(name)) return (...args) => { executing++; return value.apply(target, args); };
      return typeof value === 'function' ? value.bind(target) : value;
    } });
  };
  return { reset() { preparing = executing = 0; }, result() { return { prepares: preparing, executions: executing }; } };
}

function fixture(t) {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,role TEXT,active INTEGER DEFAULT 1,team_id TEXT);
    CREATE TABLE channels(id TEXT PRIMARY KEY,system_key TEXT,deleted_at TEXT,scope TEXT,team_id TEXT);
    CREATE TABLE memberships(channel_id TEXT REFERENCES channels(id),user_id TEXT REFERENCES users(id),PRIMARY KEY(channel_id,user_id));
    CREATE TABLE messages(id INTEGER PRIMARY KEY,channel_id TEXT REFERENCES channels(id),user_id TEXT REFERENCES users(id),body TEXT,created_at TEXT,reply_to_id INTEGER,edited_at TEXT);
    INSERT INTO users VALUES('sender','sender','owner',1,'red'),('recipient','recipient','member',1,'red'),('other','other','member',1,'blue');
    INSERT INTO channels VALUES('room',NULL,NULL,'public',NULL),('private',NULL,NULL,'private',NULL),('team',NULL,NULL,'team','red');
    INSERT INTO memberships VALUES('room','sender'),('room','recipient'),('private','recipient'),('team','recipient');`);
  const sql = meter(db), denied = new Set();
  let shapes = 0, external = [], personal = [];
  const check = (value, status) => { if (!value) throw Object.assign(new Error('not accessible'), { status }); };
  const members = () => db.prepare('SELECT * FROM users WHERE active=1').all();
  const requireChannel = (userId, channelId) => {
    const row = db.prepare('SELECT c.*,u.team_id AS current_team FROM channels c JOIN memberships m ON m.channel_id=c.id JOIN users u ON u.id=m.user_id WHERE c.id=? AND m.user_id=?').get(channelId, userId);
    check(row && !row.deleted_at && !denied.has(channelId) && (row.scope !== 'team' || row.team_id === row.current_team), 404);
    return row;
  };
  const requireMessage = (id, userId) => { const row = db.prepare('SELECT * FROM messages WHERE id=?').get(id); check(row, 404); requireChannel(userId, row.channel_id); return row; };
  const service = createCollaborationService({ db, assert: check, textField: value => value, now: () => stamp,
    transaction: fn => { db.exec('BEGIN'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; } },
    members, requireChannel, requireMessage, requirePosting: requireChannel, publish() {}, backgroundJobsEnabled: false,
    messageShape: (row, userId) => { shapes++; return { id: String(row.id), channelId: row.channel_id, ...service.messageExtras(row, userId) }; },
    externalNotifications: { list: () => external, read() {}, readAll() {} },
  });
  service.setPersonalNotifications({ list: () => personal, read() {} });
  let next = 1;
  return {
    db, service, denied, sql,
    get shapes() { return shapes; },
    adapters(value, other) { external = value; personal = other; },
    seed(count, { channel = 'room', userId = 'recipient', readAt = null } = {}) {
      const message = db.prepare('INSERT INTO messages(id,channel_id,user_id,body,created_at) VALUES(?,?,?,?,?)');
      const notification = db.prepare('INSERT INTO notifications VALUES(?,?,?,?,?,?,?)');
      const ids = [];
      for (let i = 0; i < count; i++) { const id = next++; message.run(id, channel, 'sender', 'synthetic', stamp); notification.run('n' + id, userId, id, 'mention', 'dedupe' + id, stamp, readAt); ids.push(id); }
      return ids;
    },
    async inbox(userId = 'recipient') {
      let result;
      assert.equal(await service.handle({ p: '/api/notifications', method: 'GET', url: new URL('http://fixture.test/api/notifications'), user: { id: userId }, respond: (_status, value) => { result = value; } }), true);
      return result;
    },
  };
}

test('unread count matches the inbox for read markers, recipients and duplicate message kinds without writing', async t => {
  const f = fixture(t), [id] = f.seed(1);
  f.seed(1, { readAt: stamp }); f.seed(1, { readAt: '' }); f.seed(1, { readAt: '0' }); f.seed(1, { userId: 'other' });
  f.db.prepare('INSERT INTO notifications VALUES(?,?,?,?,?,?,?)').run('second-kind', 'recipient', id, 'task', 'other-kind', stamp, null);
  const changes = f.db.prepare('SELECT total_changes() AS n').get().n;
  assert.equal(f.service.unreadCount('recipient'), 3);
  assert.equal(f.service.unreadCount('recipient'), (await f.inbox()).unreadCount);
  assert.equal(f.db.prepare('SELECT total_changes() AS n').get().n, changes);
  f.db.prepare('UPDATE notifications SET read_at=? WHERE user_id=?').run(stamp, 'recipient');
  assert.equal(f.service.unreadCount('recipient'), 0);
});

test('membership, archived rooms, team authority and inactive users are rechecked on each count', async t => {
  const f = fixture(t);
  f.seed(2); f.seed(3, { channel: 'private' }); f.seed(4, { channel: 'team' });
  const same = async expected => { assert.equal(f.service.unreadCount('recipient'), expected); assert.equal((await f.inbox()).unreadCount, expected); };
  await same(9);
  f.db.exec("DELETE FROM memberships WHERE channel_id='private' AND user_id='recipient'"); await same(6);
  f.db.exec("INSERT INTO memberships VALUES('private','recipient')"); await same(9);
  f.db.exec("UPDATE channels SET deleted_at='archived' WHERE id='room'"); await same(7);
  f.db.exec("UPDATE users SET team_id='blue' WHERE id='recipient'"); await same(3);
  f.denied.add('private'); await same(0);
  f.denied.clear(); f.db.exec("UPDATE channels SET deleted_at=NULL; UPDATE users SET team_id='red',active=0 WHERE id='recipient'"); await same(0);
  f.db.exec("UPDATE users SET active=1 WHERE id='recipient'"); await same(9);
});

test('message deletion removes the count; a dangling legacy reference is not counted', async t => {
  const f = fixture(t), ids = f.seed(3);
  f.db.prepare('DELETE FROM messages WHERE id=?').run(ids[0]);
  assert.equal(f.service.unreadCount('recipient'), 2);
  f.db.exec('PRAGMA foreign_keys=OFF'); f.db.prepare('DELETE FROM messages WHERE id=?').run(ids[1]); f.db.exec('PRAGMA foreign_keys=ON');
  assert.equal(f.service.unreadCount('recipient'), 1);
  assert.equal((await f.inbox()).unreadCount, 1);
});

test('muting delivery does not hide an existing message notification; adapters retain their read semantics', async t => {
  const f = fixture(t); f.seed(1);
  f.db.exec("INSERT INTO channel_notifications VALUES('room','recipient','mute')");
  f.adapters([{ id: 'e1', createdAt: stamp, readAt: null, pushEligible: false }, { id: 'e2', createdAt: stamp, readAt: stamp }], [{ id: 'p1', createdAt: stamp }, { id: 'p2', createdAt: stamp, readAt: stamp }]);
  assert.equal(f.service.unreadCount('recipient'), 3);
  assert.equal((await f.inbox()).unreadCount, 3);
  assert.deepEqual(f.service.notificationsForPush('recipient').map(row => row.id), ['p2', 'p1', 'e2']);
});

test('due digest visibility remains the authority for the one durable deadline notification', async t => {
  const f = fixture(t), [messageId] = f.seed(1, { readAt: stamp });
  f.db.prepare('INSERT INTO message_tasks(id,message_id,assignee_id,creator_id,title,due_date,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').run('task', messageId, 'recipient', 'sender', 'synthetic task', '2026-10-08', 'todo', stamp, stamp);
  f.db.prepare('INSERT INTO due_digests VALUES(?,?,?,?,?)').run('due:one', 'recipient', '2026-10-08', stamp, null);
  f.db.exec("INSERT INTO due_digest_tasks VALUES('due:one','task')");
  assert.equal(f.service.unreadCount('recipient'), 1);
  assert.equal((await f.inbox()).unreadCount, 1);
  f.db.exec("INSERT INTO channel_notifications VALUES('room','recipient','mute')"); assert.equal(f.service.unreadCount('recipient'), 0);
  f.db.exec("DELETE FROM channel_notifications; UPDATE due_digests SET read_at='read'"); assert.equal(f.service.unreadCount('recipient'), 0);
  f.db.exec("UPDATE due_digests SET read_at=NULL; UPDATE message_tasks SET status='done'"); assert.equal(f.service.unreadCount('recipient'), 0);
});

test('read history does not shape messages or add queries to an unread count', t => {
  const f = fixture(t); f.seed(1, { readAt: stamp }); f.sql.reset();
  assert.equal(f.service.unreadCount('recipient'), 0); const small = f.sql.result();
  f.seed(999, { readAt: stamp }); f.sql.reset();
  assert.equal(f.service.unreadCount('recipient'), 0); const large = f.sql.result();
  t.diagnostic(JSON.stringify({ case: '1000 read notifications', small, large, shapes: f.shapes }));
  assert.deepEqual(large, small); assert.equal(f.shapes, 0);
});

test('unread message queries scale with accessible rooms rather than notification count', t => {
  const f = fixture(t); f.seed(1); f.sql.reset();
  assert.equal(f.service.unreadCount('recipient'), 1); const small = f.sql.result();
  f.seed(999); f.sql.reset();
  assert.equal(f.service.unreadCount('recipient'), 1000); const large = f.sql.result();
  t.diagnostic(JSON.stringify({ case: '1000 unread notifications in one room', small, large, shapes: f.shapes }));
  assert.deepEqual(large, small); assert.equal(f.shapes, 0);
});

test('the actual company summary keeps bounded SQL and honors a live team move', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'synk-unread-count-'));
  let roster = [{ id: 'company-recipient', name: 'synthetic', role: 'member', active: true, teamId: 'red' }];
  const app = createMessenger({ dataDir: directory, backgroundJobsEnabled: false, voice: {}, driveStorage: { active: async () => null }, integration: {
    origin: 'http://fixture.test', listUsers: () => roster, listTeams: () => [{ id: 'red', name: 'Red', active: true }],
    authenticate: () => ({ companyUserId: 'company-recipient', canManage: false, canWrite: true, token: 'synthetic' }),
  } });
  t.after(async () => { await app.close(); assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep) && directory.split(sep).at(-1).startsWith('synk-unread-count-')); await rm(directory, { recursive: true, force: true }); });
  const db = app.db, userId = db.prepare('SELECT id FROM users').get().id, channelId = db.prepare("SELECT id FROM channels WHERE system_key='social'").get().id;
  const sql = meter(db);
  const message = db.prepare('INSERT INTO messages(channel_id,user_id,body,created_at) VALUES(?,?,?,?)');
  const notification = db.prepare('INSERT INTO notifications VALUES(?,?,?,?,?,?,?)');
  for (let i = 0; i < 1000; i++) { const id = Number(message.run(channelId, userId, 'synthetic', stamp).lastInsertRowid); notification.run('n' + id, userId, id, 'mention', 'dedupe' + id, stamp, stamp); }
  sql.reset(); assert.equal(app.summary({ headers: {} }).notificationUnread, 0); const read = sql.result();
  db.prepare('UPDATE notifications SET read_at=NULL').run(); sql.reset();
  assert.equal(app.summary({ headers: {} }).notificationUnread, 1000); const unread = sql.result();
  t.diagnostic(JSON.stringify({ case: 'actual integrated company summary, 1000 notifications', read, unread }));
  assert.ok(read.executions < 100, JSON.stringify(read)); assert.ok(unread.executions < 100, JSON.stringify(unread));
  db.prepare("UPDATE channels SET scope='team',team_id='red' WHERE id=?").run(channelId);
  assert.equal(app.summary({ headers: {} }).notificationUnread, 1000);
  roster = roster.map(user => ({ ...user, teamId: null }));
  assert.equal(app.summary({ headers: {} }).notificationUnread, 0);
});
