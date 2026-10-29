'use strict';
// PC 계정 라이브러리 묶음과 계정 포털 platform 묶음은 플랫폼 라이브러리 기록 검사 하나만 품는다(10-20 화면별 검사 나누기).
// 계정 노트가 다시 personal-data.mjs(다섯 자원 검사)를 부르면 묶음은 원천과 맞는 채로 커져 check:account-bundles는 통과하므로,
// 커밋된 생성물의 이름으로 본다(esbuild 없이). 화면이 다른 자원을 쓰게 되면 이 목록을 그 자원 검사만큼 넓힌다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
// keepNames preserves minified function names as runtime name labels.
const namedCount = (text,name) => (text.match(new RegExp(`function ${name}\\d*\\(`,'g'))||[]).length
  + (text.match(new RegExp(`["']${name}["']`,'g'))||[]).length;
// 다섯 자원을 고르는 서버용 검사와 PC 라이브러리가 부르지 않는 자원 검사들.
const SERVER_ONLY = ['validatePersonalState', 'PERSONAL_RESOURCES', 'validateMemberUnderstanding', 'validateMemberActivity', 'validateTravelAccountDocument'];

test('PC 계정 라이브러리 묶음은 계정 원천 모듈과 라이브러리 기록 검사만 품는다', () => {
  const text = read('desktop/renderer/platform-continuity.mjs');
  const modules = [...text.matchAll(/^\/\/ (\S+\.(?:mjs|js|cjs))$/gm)].map(match => match[1]);
  assert.ok(modules.length >= 10, '모듈 경로 주석: ' + modules.length);
  assert.deepEqual(modules.filter(file => !file.startsWith('experiences/synk-account/src/')), [], '계정 원천 밖 모듈');
  assert.deepEqual(modules.filter(file => /\/(personal-data|member-[^/]*)\.(mjs|cjs)$/.test(file)), [], '다른 자원 검사 모듈');
  for (const name of SERVER_ONLY) assert.ok(!new RegExp(`\\b${name}\\b`).test(text), name);
  assert.match(text, /createAccountNotebook\(\{\s*resource: "platform-library",\s*validateState: validatePlatformLibraryState,/);
});

test('계정 포털 platform 묶음에도 자원 고르기 검사와 PATH 여행 검사가 없다(회원 화면은 생성 사본으로 검사)', () => {
  const text = read('experiences/synk-account/dist/platform.js');
  for (const name of ['validatePersonalState', 'validateTravelAccountDocument']) assert.equal(namedCount(text,name),0,name);
  assert.ok(text.includes('function validatePlatformLibraryState('));
  // 회원 검사는 생성 사본 하나뿐이다 — 원천 사본이 같이 끌려오면 이름 번호가 붙은 정의가 하나 더 생긴다.
  for (const name of ['validateMemberUnderstanding', 'validateMemberActivity']) {
    assert.ok(!new RegExp(`function ${name}\\d*\\(`).test(text),'원천 사본을 직접 싣지 않는다: '+name);
    assert.equal(namedCount(text,name),1,'생성 사본 이름표 하나: '+name);
  }
});

test('여행 notebook의 import graph는 서버의 전체 자원 검사로 돌아가지 않는다', () => {
  const seen = new Set();
  function visit(file) {
    file = path.resolve(file);
    if (seen.has(file)) return;
    seen.add(file);
    const source = fs.readFileSync(file, 'utf8');
    // All product imports are literal relative paths, including lazy notebook imports.
    const imports = /\b(?:import\s*\(\s*|(?:import|export)\s+(?:[^;'"\n]*?\s+from\s*)?|require\s*\(\s*)['"](\.[^'"]+)['"]/g;
    for (const [, specifier] of source.matchAll(imports)) visit(path.resolve(path.dirname(file), specifier.split(/[?#]/)[0]));
  }
  visit(path.join(root, 'experiences/path-travel/planner-account.mjs'));
  const modules = [...seen].map(file => path.relative(root, file).replace(/\\/g, '/'));
  assert.ok(modules.includes('experiences/synk-account/src/account-notebook.mjs'));
  assert.ok(modules.includes('experiences/synk-account/src/personal-state.mjs'));
  assert.deepEqual(modules.filter(file => /\/(?:personal-data|personal-contract|member-[^/]*|platform-library-data)\.(?:mjs|js)$/.test(file)), []);
  assert.deepEqual(modules.filter(file => file.startsWith('experiences/path-vr/')), []);
});
