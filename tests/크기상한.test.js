'use strict';
// 크기 상한 한 장(docs/_ops/크기_상한.md)의 표와 코드의 숫자가 같은지 본다(2026-11-14).
// 왜: 크기 상한이 열 군데 넘게 흩어져 있어서, 왜 그 값인지와 올려도 되는지를 물을 때마다 저장소를 통째로 뒤져야 했다.
//   그래서 값과 까닭을 한 장에 모았다. 표와 코드가 어긋나면 그 한 장을 믿을 수 없으니, 한쪽만 바뀌면 여기서 깨진다.
//   깨지면: 상한을 바꾼 것이면 코드와 표를 같은 커밋에서 고친다. 새 상한을 만든 것이면 표에 줄을 더하고 아래 「자리」에도 넣는다.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const 뿌리 = path.join(__dirname, '..');
const 읽기 = rel => fs.readFileSync(path.join(뿌리, rel), 'utf8').replace(/\r\n/g, '\n');
const 한장 = 'docs/_ops/크기_상한.md';
const 천 = n => Number(n).toLocaleString('en-US');
const 자 = n => `${천(n)}자`;
const KB = n => `${n}KB`;
const MiB = n => `${n / 1048576}MiB`;

// 표의 첫 칸 이름 → [코드 파일, 그 숫자를 읽는 식, 표의 「값」 칸에 적혀야 하는 모습]
const 자리 = {
  'AGENTS.md': ['tools/lib/git-publish-core.cjs', /'AGENTS\.md': (\d+) \* 1024/, KB],
  '운영 원칙': ['tools/lib/git-publish-core.cjs', /'docs\/AI_운영원칙\.md': (\d+) \* 1024/, KB],
  '결정 표와 트랙의 새 줄': ['tools/lib/git-publish-core.cjs', /긴줄상한 = \{ 'docs\/_ops\/결정\.md': (\d+), 'docs\/_ops\/트랙\.md': \1 \}/, n => KB(n / 1024)],
  '영상 스킬 한 장': ['tests/영상입구.test.js', /읽기\(스킬\)\.length <= (\d+)/, 자],
  '지시문 틀': ['tests/영상입구.test.js', /읽기\(틀\)\.length <= (\d+)/, 자],
  '카본 지시문': ['tools/아르곤웹.js', /^const 지시문한도 = (\d+);/m, 자],
  '카본 첨부': ['tools/아르곤웹.js', /^const 첨부한도 = (\d+);/m, n => `${n}개`],
  '미학맹검 지시문': ['tools/미학맹검.js', /^const 지시문한도 = (\d+);/m, 자],
  '검수 묶음': ['tools/검수묶음.mjs', /^export const 기본크기 = ([\d_]+);/m, n => `${천(n)}바이트`],
  '영상 관문 그림': ['.claude/workflows/video-gate.js', /^const 그림한도 = (\d+)/m, n => `${n}장`],
  '영상 관문 지적': ['.claude/workflows/video-gate.js', /^const 지적한도 = (\d+)/m, n => `${n}개`],
  '헤르메스 요청': ['tools/hermes-synk/plugin/__init__.py', /^MAX_REQUEST_CHARS = (\d+)/m, 자],
  '헤르메스 답': ['tools/hermes-synk/plugin/__init__.py', /^MAX_REPLY_CHARS = (\d+)/m, 자],
  '저장 · 파일 하나': ['tools/git-storage-policy.json', /"maxBlobBytes": (\d+)/, MiB],
  '저장 · 한 번에 올리는 양': ['tools/git-storage-policy.json', /"maxTotalBytes": (\d+)/, MiB],
};

/** 「상한 표」 절의 줄을 { 이름: 값 칸 }으로 읽는다. */
function 표읽기() {
  const 절 = 읽기(한장).split(/^## /m).find(s => s.startsWith('상한 표'));
  assert.ok(절, '크기 상한 한 장에 「상한 표」 절이 없다');
  const 줄들 = 절.split('\n').filter(l => l.startsWith('| ')).slice(1);   // 머리 줄을 뺀다(가름 줄 |---|은 '| '로 시작하지 않는다)
  return Object.fromEntries(줄들.map(l => l.split('|').slice(1, 3).map(s => s.trim())));
}

test('표의 줄마다 코드 자리가 있고, 코드 자리마다 표의 줄이 있다', () => {
  assert.deepEqual(Object.keys(표읽기()).sort(), Object.keys(자리).sort(),
    '표에 줄을 더했으면 이 시험의 「자리」에도 넣고, 상한을 없앴으면 두 곳에서 함께 지운다');
});

for (const [이름, [파일, 식, 모습]] of Object.entries(자리)) {
  test(`${이름} — 표의 값이 코드(${파일})의 숫자와 같다`, () => {
    const 찾음 = 읽기(파일).match(식);
    assert.ok(찾음, `${파일}에서 ${이름} 상한을 못 읽었다 — 코드의 자리가 바뀌었으면 이 시험의 식을 고친다`);
    const 코드값 = 모습(Number(찾음[1].replace(/_/g, '')));
    assert.equal(표읽기()[이름], 코드값, `${한장}의 「${이름}」 값과 코드가 다르다 — 상한을 바꿀 때는 코드와 표를 같은 커밋에서 고친다`);
  });
}

test('한 장이 가리키는 파일이 실제로 있다', () => {
  const 길들 = [...읽기(한장).matchAll(/`((?:tools|tests|docs)\/[^`\s]+)`/g)].map(m => m[1]);
  assert.ok(길들.length >= 3, '한 장에서 파일 길을 못 찾았다');
  for (const 길 of 길들) assert.ok(fs.existsSync(path.join(뿌리, 길)), `한 장이 가리키는 ${길}이 없다`);
});
