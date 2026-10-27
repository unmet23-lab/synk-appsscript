import test from 'node:test';
import assert from 'node:assert/strict';
import { RECENT_LOGIN_KEY, readRecentLogin, writeRecentLogin, forgetRecentLogin, maskEmail, recentMethodName } from '../src/recent-login.mjs';

const memory = () => { const map = new Map();return { map, getItem: key => map.has(key) ? map.get(key) : null, setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key) }; };

test('an e-mail sign-in keeps the address to fill the field; a Google one keeps it masked only', () => {
  const storage = memory();
  assert.equal(writeRecentLogin('email', ' member@synthetic.test ', { storage, now: 1000 }), true);
  assert.deepEqual(JSON.parse(storage.map.get(RECENT_LOGIN_KEY)), { v: 2, method: 'email', email: 'member@synthetic.test', masked: 'me***@synthetic.test', at: 1000 });
  assert.deepEqual(readRecentLogin({ storage }), { method: 'email', email: 'member@synthetic.test', masked: 'me***@synthetic.test', at: 1000 });
  assert.equal(writeRecentLogin('google', 'member@synthetic.test', { storage, now: 2000 }), true);
  assert.deepEqual(JSON.parse(storage.map.get(RECENT_LOGIN_KEY)), { v: 2, method: 'google', masked: 'me***@synthetic.test', at: 2000 });
  assert.deepEqual(readRecentLogin({ storage }), { method: 'google', email: null, masked: 'me***@synthetic.test', at: 2000 });
  forgetRecentLogin({ storage });assert.equal(readRecentLogin({ storage }), null);assert.equal(storage.map.size, 0);
});

test('the rehearsal portal on the same origin keeps its own hint', () => {
  const storage = memory();
  writeRecentLogin('email', 'live@synthetic.test', { storage, realm: '/id/' });writeRecentLogin('google', 'rehearsal@synthetic.test', { storage, realm: '/id-rehearsal/' });
  assert.equal(readRecentLogin({ storage, realm: '/id/' }).email, 'live@synthetic.test');assert.equal(readRecentLogin({ storage }).email, 'live@synthetic.test');
  assert.equal(readRecentLogin({ storage, realm: '/id-rehearsal/' }).method, 'google');assert.ok(storage.map.has(`${RECENT_LOGIN_KEY}:/id-rehearsal/`));
  forgetRecentLogin({ storage, realm: '/id-rehearsal/' });assert.equal(readRecentLogin({ storage, realm: '/id-rehearsal/' }), null);assert.ok(readRecentLogin({ storage }));
});

test('unknown ways, malformed addresses and foreign shapes are neither written nor read', () => {
  const storage = memory();
  for (const [method, email] of [['password', 'a@b.test'], ['google', 'not-an-address'], ['email', ''], ['email', 'a b@c.test']]) assert.equal(writeRecentLogin(method, email, { storage }), false);
  assert.equal(storage.map.size, 0);
  for (const raw of ['{', 'null', '{"v":1,"method":"google","email":"a@b.test","at":1}', '{"v":2,"method":"github","masked":"a*@b.test","at":1}',
    '{"v":2,"method":"email","masked":"a*@b.test","at":1}', '{"v":2,"method":"google","masked":"<b>@x","at":1}', '{"v":2,"method":"google","masked":"a*@b.test"}']) {
    storage.map.set(RECENT_LOGIN_KEY, raw);assert.equal(readRecentLogin({ storage }), null, raw);
  }
  // A Google hint never surfaces a full address even if one was planted beside it.
  storage.map.set(RECENT_LOGIN_KEY, '{"v":2,"method":"google","email":"full@b.test","masked":"fu**@b.test","at":1}');assert.equal(readRecentLogin({ storage }).email, null);
});

test('a blocked or missing storage leaves no hint and never throws', () => {
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  assert.equal(readRecentLogin({ storage: blocked }), null);assert.equal(writeRecentLogin('email', 'a@b.test', { storage: blocked }), false);assert.doesNotThrow(() => forgetRecentLogin({ storage: blocked }));
  assert.equal(readRecentLogin({ storage: null }), null);assert.equal(writeRecentLogin('email', 'a@b.test', { storage: null }), false);
});

test('the shown address keeps the domain and hides most of the name', () => {
  assert.equal(maskEmail('unmet23@gmail.com'), 'un***@gmail.com');
  assert.equal(maskEmail('ab@x.test'), 'a*@x.test');
  assert.equal(maskEmail('a@x.test'), 'a*@x.test');
  assert.equal(maskEmail('김유호@메일.한국'), '김유*@메일.한국');
  assert.equal(maskEmail('broken'), '');
  assert.equal(recentMethodName('google'), 'Google');assert.equal(recentMethodName('email'), '이메일');
});
