// The work-backup mail relay (server/mail-relay/relay.gs) run in Node vm with fake Apps
// Script services, fed by the server's own mailer: signature, one send per key, and the
// recipient allow list (STAGE1_DESIGN.md 「개통 서버 구현 설계」 메일, Fable S12).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { createMailer } from '../mail.mjs';
import { Store } from '../store.mjs';

const source = fs.readFileSync(new URL('../mail-relay/relay.gs', import.meta.url), 'utf8');
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const nHex = Buffer.from(publicKey.export({ format: 'jwk' }).n, 'base64url').toString('hex');
const signed = (bytes) => [...bytes].map((b) => (b > 127 ? b - 256 : b));
const hash = (s) => crypto.createHash('sha256').update(s.toLowerCase()).digest('hex');

function relay(allow) {
  const props = new Map([['SERVER_KEY_N', nHex], ...(allow ? [['ALLOW_SHA256', allow]] : [])]), sent = [];
  const context = {
    BigInt, JSON, Math, Number, String, Date, isFinite, parseInt,
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' }, Charset: { UTF_8: 'UTF_8' },
      base64Decode: (v) => signed(Buffer.from(v, 'base64')),
      // Apps Script hashes a string as single bytes unless UTF_8 is given (카본 r6 D2).
      computeDigest: (alg, value, charset) => {
        if (alg !== 'SHA_256') throw new Error('algorithm');
        return signed(crypto.createHash('sha256').update(value, typeof value === 'string' && charset !== 'UTF_8' ? 'latin1' : 'utf8').digest());
      },
      formatDate: (date, tz, fmt) => {
        if (tz !== 'Asia/Seoul' || fmt !== 'yyyyMMdd') throw new Error('formatDate arguments');
        return new Date(date.getTime() + 9 * 3600000).toISOString().slice(0, 10).replaceAll('-', '');
      },
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (n) => (props.has(n) ? props.get(n) : null), setProperty: (n, v) => props.set(n, String(v)), deleteProperty: (n) => props.delete(n), getProperties: () => Object.fromEntries(props) }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    MailApp: { getRemainingDailyQuota: () => 100, sendEmail: (m) => sent.push(JSON.parse(JSON.stringify(m))) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (text) => ({ text, setMimeType() { return this; } }) },
  };
  vm.createContext(context); vm.runInContext(source, context);
  return { sent, post: (body) => JSON.parse(context.doPost({ postData: { contents: body } }).text) };
}

// loseFirst: the relay acts on the first request but its answer never arrives.
async function throughMailer(r, to, { loseFirst = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-relay-'));
  const store = new Store(path.join(dir, 'm.sqlite'));
  try {
    const answers = [], bodies = [];
    let lose = loseFirst;
    const mailer = createMailer({ store, enabled: true, relayUrl: 'https://script.google.com/macros/s/x/exec', privateKey, operator: 'ops@example.com',
      fetchImpl: async (_u, o) => { bodies.push(o.body); const a = r.post(o.body); answers.push(a); if (lose) { lose = false; throw new Error('cut'); } return new Response(JSON.stringify(a)); } });
    mailer.toCustomer({ id: 'abcdefghijklmnop', email: to }, 'repo-changed', { daysLeft: 29 }, '2026-11-16:content');
    await mailer.flush();
    if (loseFirst) await mailer.flush();
    const state = store.all('select state from outbox')[0].state;
    return { answers, state, bodies };
  } finally { store.close(); fs.rmSync(dir, { recursive: true, force: true }); }
}

test('relay: a server-signed mail to an allowed address goes once, with the relay\'s own sender', async () => {
  const r = relay(`${hash('Pilot@Example.com')},${hash('ops@example.com')}`);
  const { answers, state, bodies } = await throughMailer(r, 'pilot@example.com');
  assert.equal(answers[0].status, 'sent'); assert.equal(state, 'sent');
  assert.equal(r.sent.length, 1);
  // 카본 D4: the same signed request again does not send again.
  const again = r.post(bodies[0]);
  assert.equal(again.ok, true); assert.equal(again.status, 'duplicate');
  assert.equal(r.sent.length, 1);
  // 카본 r6 D3: the first answer lost on the way — the next flush gets 「duplicate」 and closes the row.
  const r2 = relay(`${hash('pilot@example.com')}`);
  const lost = await throughMailer(r2, 'pilot@example.com', { loseFirst: true });
  assert.deepEqual(lost.answers.map((a) => a.status), ['sent', 'duplicate']);
  assert.equal(lost.state, 'sent'); assert.equal(r2.sent.length, 1);
  assert.equal(r.sent[0].name, 'SYNK 업무 백업');
  assert.match(r.sent[0].subject, /^〔SYNK 업무 백업〕 백업이 바뀌었습니다 — 되돌릴 수 있는 날이 29일 남았습니다$/);
});

test('relay: an address outside the allow list, or an empty list, is refused even with a good signature', async () => {
  for (const allow of [hash('someone@example.com'), null, 'not-a-hash']) {
    const r = relay(allow);
    const { answers } = await throughMailer(r, 'pilot@example.com');
    assert.equal(answers[0].code, 'to_not_allowed');
    assert.equal(r.sent.length, 0);
  }
});

test('relay: a PULSE-signed request is not a work-backup request', () => {
  const r = relay(hash('pilot@example.com'));
  const ts = Date.now(), req = { v: 1, op: 'send', key: 'wb:test:000000000000', ts, to: 'pilot@example.com', subject: '〔SYNK 업무 백업〕 x', body: 'y' };
  const message = JSON.stringify(['pulse-mail/v1', req.op, req.key, req.ts, req.to, req.subject, req.body]);
  req.sig = crypto.sign('sha256', Buffer.from(message), privateKey).toString('base64');
  assert.equal(r.post(JSON.stringify(req)).code, 'signature');
});
