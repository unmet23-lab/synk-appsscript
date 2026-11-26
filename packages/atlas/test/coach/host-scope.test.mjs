// 같은 출처의 가장 위 창(hostScope) — srcdoc · about:blank 틀은 주소의 출처(location.origin)가 "null"이어도 위 창의 출처를 물려받는다
// (window.origin). 불투명 출처끼리 · 다른 출처의 위 창 · 읽을 수 없는 위 창에서는 오르지 않는다(5-3 ① 엔진 d 카본 C).
import assert from 'node:assert/strict';
import test from 'node:test';
import { subject } from '../support/subject.mjs';

const { hostScope } = await subject('coach/host.mjs');

// 창 하나 — origin은 문서의 출처, address는 주소의 출처(location.origin), parent가 없으면 가장 위 창이다.
function windowOf(origin, address = origin, parent = null) {
  const scope = { origin, location: { origin: address } };
  scope.parent = parent ?? scope;
  return scope;
}

test('srcdoc · about:blank 틀은 문서의 출처(window.origin)로 위 창과 같은 출처를 알아 셸 창까지 오른다', () => {
  const top = windowOf('https://world.test');
  const srcdoc = windowOf('https://world.test', 'null', top);
  assert.equal(hostScope(srcdoc), top, 'srcdoc 틀은 위 창의 호스트를 쓴다');
  const nested = windowOf('https://world.test', 'null', srcdoc);
  assert.equal(hostScope(nested), top, '틀 안의 틀도 가장 위 창까지');
  // origin이 없는 창(시험의 가짜 창)은 주소의 출처로 견준다(지금 판과 같다).
  const plainTop = { location: { origin: 'https://world.test' } };
  plainTop.parent = plainTop;
  const plain = { location: { origin: 'https://world.test' }, parent: plainTop };
  assert.equal(hostScope(plain), plainTop);
});

test('불투명 출처(샌드박스 틀) · 다른 출처의 위 창 · 읽을 수 없는 위 창에서는 오르지 않는다', () => {
  const opaqueTop = windowOf('null');
  const sandboxed = windowOf('null', 'null', opaqueTop);
  assert.equal(hostScope(sandboxed), sandboxed, '「null」끼리는 같은 출처가 아니다');
  const other = windowOf('https://other.test');
  const framed = windowOf('https://world.test', 'https://world.test', other);
  assert.equal(hostScope(framed), framed, '다른 출처의 위 창에서 멈춘다');
  const blocked = { origin: 'https://world.test', location: { origin: 'https://world.test' } };
  blocked.parent = {
    get origin() {
      throw new Error('SecurityError');
    },
    location: {},
  };
  assert.equal(hostScope(blocked), blocked, '읽을 수 없는 위 창에서 멈춘다');
});
