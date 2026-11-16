'use strict';
// 화면 글 검사(설계 4.12 · T18) — 기본 화면의 모든 상태와 손님이 보는 화면 원천에 restic · 스냅샷 · 버킷 · 출입증 · 저장소 · pack · prune 같은 말이 없어야 한다.
process.env.TZ = 'Asia/Seoul';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const UI = path.join(__dirname, '..', 'ui');
const load = (name) => import(pathToFileURL(path.join(UI, name)).href);

test('검사 자체: 걸러야 할 말은 걸고, 비슷한 보통 말은 넘긴다', async () => {
  const { findBanned } = await load('banned-words.js');
  assert.deepEqual(findBanned('B2 암호화 저장소 연결 중'), ['저장소', 'B2']);
  assert.deepEqual(findBanned('restic snapshot prune'), ['restic', 'snapshot', 'prune']);
  assert.deepEqual(findBanned('pack 파일'), ['pack']);
  assert.deepEqual(findBanned('package · backpack · 저장 · 백업 · 되살리기 · 보호 확인서'), []);
});

test('기본 화면의 모든 상태: 모델의 글에 걸리는 말이 없다', async () => {
  const { findBanned } = await load('banned-words.js');
  const { homeModel } = await load('screen-model.js');
  const { STATES, NOW } = await load('engine-fixtures.js');
  for (const [name, state] of Object.entries(STATES)) {
    const m = homeModel(state, { now: NOW });
    const text = JSON.stringify(m, (k, v) => (['id', 'to', 'call', 'tone', 'kind', 'arg'].includes(k) ? undefined : v));
    assert.deepEqual(findBanned(text), [], `${name}: ${text.slice(0, 200)}`);
  }
});

test('화면 원천: 손님이 보는 글(HTML · 화면 스크립트의 문자열)에 걸리는 말이 없다', async () => {
  const { findBanned, visibleText } = await load('banned-words.js');
  const files = fs.readdirSync(UI).filter((f) => /\.(html|js)$/.test(f) && !['banned-words.js', 'engine-fixtures.js'].includes(f));
  assert.ok(files.length >= 3, `화면 파일이 너무 적다: ${files.join(', ')}`);
  for (const f of files) {
    const src = fs.readFileSync(path.join(UI, f), 'utf8');
    // 주석은 개발자 글이라 뺀다. 스크립트는 따옴표 · 백틱 안의 글만 본다
    const text = f.endsWith('.html')
      ? visibleText(src)
      : [...src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1').matchAll(/'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`|"((?:[^"\\\n]|\\.)*)"/g)]
        .map((m) => m[1] ?? m[2] ?? m[3]).filter((s) => /[가-힣]/.test(s)).join(' \n ');
    assert.deepEqual(findBanned(text), [], `${f}`);
  }
});
