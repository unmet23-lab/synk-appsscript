import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductAccount } from '../src/product-account.mjs';

// createProductAccount의 앱 계정 설정 검사(인증 경계)를 표로 지킨다 — PC 0.4.88 held 일곱 검수(pc-held-seven-0488-20261111) Fable F1.
// path-app은 endpoint · scope · resource 넷이 모두 맞을 때만 받고, 옛 세 클라이언트(care · path · path-travel)의 검사는 느슨해지지 않는다.
// 만들기만 하고 init하지 않는다 — 네트워크 · 저장소 · 주소는 건드리지 않는 가짜를 넣는다.
const stubs = {
  validateState: () => true,
  fetcher: async () => { throw new Error('no network in this test'); },
  storage: { getItem: () => null, setItem() {}, removeItem() {} },
  getUrl: () => 'https://synk.im/path/app/',
  replaceUrl() {}, navigate() {},
};
const make = options => createProductAccount({ ...stubs, ...options });
const rejects = options => assert.throws(() => make(options), err => err instanceof TypeError && err.message === '앱 계정 설정 형식이 맞지 않아요.', JSON.stringify(options));

const PATH_APP = { clientKey: 'path-app', endpoint: 'synk-path', scope: 'synk-path', resource: 'path-app' };

test('path-app is accepted only with endpoint, scope and resource all set to the PATH app values', () => {
  const account = make(PATH_APP);
  assert.equal(typeof account.status, 'function');
  for (const [key, wrong] of [['endpoint', 'synk-personal'], ['endpoint', 'synk-care'], ['scope', 'synk-personal'], ['scope', undefined], ['resource', null], ['resource', 'path'], ['resource', 'path-travel']]) {
    rejects({ ...PATH_APP, [key]: wrong });
  }
  rejects({ ...PATH_APP, validateState: undefined });
});

test('the synk-path endpoint cannot be borrowed by any other client', () => {
  for (const clientKey of ['care', 'path', 'path-travel', 'world', 'messenger', 'platform', '']) {
    rejects({ ...PATH_APP, clientKey });
  }
});

test('the three older product clients keep their endpoint check unchanged', () => {
  for (const clientKey of ['care', 'path', 'path-travel']) {
    for (const endpoint of ['synk-care', 'synk-personal']) {
      for (const [scope, resource] of [[undefined, null], ['synk-personal', clientKey], ['anything', 'anything']]) {
        assert.doesNotThrow(() => make({ clientKey, endpoint, scope, resource }), `${clientKey} ${endpoint}`);
      }
    }
    for (const endpoint of ['synk-path', 'synk-world', '', undefined]) rejects({ clientKey, endpoint });
  }
  for (const clientKey of ['world', 'messenger', 'platform', 'path-app ', 'PATH-APP']) rejects({ clientKey, endpoint: 'synk-care' });
});
