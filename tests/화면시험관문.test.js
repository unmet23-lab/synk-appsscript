'use strict';
// 앱화면.cjs · lab-proof.cjs 꼴 qa 스크립트는 전체 시간 한도(tools/lib/화면시험.cjs) 안에서 돈다(2026-11-04).
// 게임 세션들이 앞 게임의 스크립트를 옮겨 새 폴더를 만드는 꼴이라, 한도가 빠진 사본을 올리는 때 바로 알린다. 이 파일 이름이 글에 있어 그 push의 관련 시험으로 뽑힌다.
// 막는 자리는 push 때뿐이다. GitHub CI에서는 진단만 남긴다 — 이 시험이 들어오기 전 바탕에서 일하던 세션이 옛 사본을 올려도 master를 빨갛게 만들어 사람을 부르지 않게.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const 고치는법 = '전체 시간 한도가 없다 — tools/lib/화면시험.cjs의 화면시험({ 분: 20 }, main)으로 감싸고, run은 try/finally로 닫기(browser)를 부른다(현장노트 시험_화면확인)';

test('앱화면 · lab-proof 꼴 스크립트는 모두 화면시험 한도 안에서 돈다', (t) => {
  const 대상 = fs.globSync('experiences/*/qa/**/{앱화면,lab-proof}.cjs', { cwd: ROOT });
  assert.ok(대상.length >= 12, `찾은 수 ${대상.length} — 폴더 모양이 바뀌었는지 본다`);
  const 빠짐 = 대상.filter((상대) => {
    const 글 = fs.readFileSync(path.join(ROOT, 상대), 'utf8');
    return !/require\([^)]*tools\/lib\/화면시험\.cjs['"]\)/.test(글) || !/^화면시험\(\{/m.test(글);
  });
  if (빠짐.length && process.env.GITHUB_ACTIONS) { t.diagnostic(`${고치는법}: ${빠짐.join(' ')}`); return; }
  assert.deepEqual(빠짐, [], 고치는법);
});
