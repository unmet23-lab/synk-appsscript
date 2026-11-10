'use strict';
// WORLD 공개 빌드의 참조 문지기(tools/build-world-app-public.mjs의 checkReference)가 Atlas 입구 두 주소만 받아 준다(재설계 §9 · 단계 0).
// 판은 입구 한 줄로 오르내리므로 제품은 /atlas/loader.js · /atlas/loader.mjs만 토큰(?v=) · 조각(#) 없이 절대 주소로 부르고,
// 판 폴더(/atlas/<판>/…)와 다른 /atlas/ 주소는 지금처럼 「WORLD 밖」이다. 빌드 전체는 무거워 함수만 떼어 돌린다(tests/공개.test.js와 같은 방식).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'tools', 'build-world-app-public.mjs'), 'utf8');
const BODY = /function checkReference\(from,value\)\{[\s\S]*?\n\}/.exec(SOURCE)?.[0];

function check(value, from = 'index.html') {
  const missing = [];
  const references = [];
  const make = new Function('config', 'missing', 'references', 'fs', 'path', 'payload', `${BODY}\nreturn checkReference;`);
  make({ basePath: '/world/' }, missing, references, { existsSync: () => true }, path, '/payload')(from, value);
  return { missing, references };
}

test('checkReference를 떼어 낼 수 있다', () => {
  assert.ok(BODY, 'tools/build-world-app-public.mjs의 checkReference');
});

test('Atlas 입구 두 주소는 WORLD 밖이어도 통과하고 참조 목록에도 넣지 않는다(payload에 없다)', () => {
  for (const value of ['/atlas/loader.js', '/atlas/loader.mjs']) {
    assert.deepEqual(check(value), { missing: [], references: [] }, value);
    assert.deepEqual(check(value, 'korean-racing/index.html'), { missing: [], references: [] }, value);
  }
});

test('입구에 토큰 · 조각을 붙이거나 상대 주소로 부르면 막는다', () => {
  for (const value of ['/atlas/loader.js?v=1a2b', '/atlas/loader.mjs#x', '../atlas/loader.js']) {
    assert.deepEqual(check(value).missing.map(row => row.reason), ['atlas-entry-form'], value);
  }
});

test('판 폴더 · 소개 쪽 같은 다른 /atlas/ 주소는 지금처럼 WORLD 밖이다', () => {
  for (const value of ['/atlas/0.1.0/atlas.mjs', '/atlas/', '/atlas/loader.json']) {
    assert.deepEqual(check(value).missing.map(row => row.reason), ['outside-world'], value);
  }
});

test('WORLD 안의 참조는 그대로 참조 목록에 들고, /try/ · 바깥 주소는 지금처럼 건너뛴다', () => {
  assert.deepEqual(check('./app.mjs', 'korean-racing/index.html').references.map(row => row.path), ['korean-racing/app.mjs']);
  assert.deepEqual(check('/try/racing/'), { missing: [], references: [] });
  assert.deepEqual(check('https://synk.im/atlas/loader.js'), { missing: [], references: [] });
});
