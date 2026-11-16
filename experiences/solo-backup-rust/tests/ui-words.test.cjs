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

/**
 * JS 원천의 문자열 · 템플릿 글 조각을 모두 뽑는다. 주석과 정규식은 뺀다.
 * 템플릿 속 ${…}에는 따라 들어가 그 안의 문자열 · 템플릿까지 뽑는다(정규식 하나로는 겹친 백틱을 못 따라가 안쪽 글이 통째로 빠졌다 — 카본 A7).
 */
function literals(src) {
  const out = [];
  const n = src.length;
  let i = 0, prev = '', word = '';
  const regexMayStart = () => prev === '' || /[(,=:[!&|?{};+\-*%<>~^]/.test(prev) || (prev === 'a' && ['return', 'typeof', 'case', 'in', 'of', 'void', 'delete'].includes(word));
  function str(q) {
    let j = i + 1, buf = '';
    while (j < n && src[j] !== q && src[j] !== '\n') { if (src[j] === '\\') { buf += src[j + 1] ?? ''; j += 2; } else buf += src[j++]; }
    out.push(buf); i = j + 1;
  }
  function tpl() {
    let buf = ''; i++;
    while (i < n) {
      const c = src[i];
      if (c === '\\') { buf += src[i + 1] ?? ''; i += 2; continue; }
      if (c === '`') { i++; break; }
      if (c === '$' && src[i + 1] === '{') { out.push(buf); buf = ''; i += 2; code(true); continue; }
      buf += c; i++;
    }
    out.push(buf);
  }
  function regex() {
    let cls = false; i++;
    while (i < n) {
      const c = src[i];
      if (c === '\\') { i += 2; continue; }
      if (c === '[') cls = true; else if (c === ']') cls = false; else if (c === '/' && !cls) { i++; break; } else if (c === '\n') break;
      i++;
    }
    while (i < n && /[a-z]/i.test(src[i])) i++;
  }
  function code(inner) {
    let depth = 0;
    while (i < n) {
      const c = src[i];
      if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === '/' && src[i + 1] === '*') { const k = src.indexOf('*/', i + 2); i = k < 0 ? n : k + 2; continue; }
      if (c === "'" || c === '"') { str(c); prev = 'a'; word = ''; continue; }
      if (c === '`') { tpl(); prev = 'a'; word = ''; continue; }
      if (c === '/' && regexMayStart()) { regex(); prev = 'a'; word = ''; continue; }
      if (/[A-Za-z0-9_$]/.test(c)) { let j = i; while (j < n && /[A-Za-z0-9_$]/.test(src[j])) j++; word = src.slice(i, j); prev = 'a'; i = j; continue; }
      if (inner && c === '{') depth++;
      if (inner && c === '}') { if (depth === 0) { i++; return; } depth--; }
      if (!/\s/.test(c)) { prev = c; word = ''; }
      i++;
    }
  }
  code(false);
  return out;
}

test('검사 자체: 낱말 읽개가 겹친 템플릿 속 글과 라틴 글을 빠뜨리지 않는다', () => {
  const src = "const a = `바깥 ${x ? `안쪽 ${y ? '가장 안 B2' : \"restic\"} 글` : ''} 끝`; // 주석 snapshot\nconst r = /['\"`]/g; /* bucket */ const b = 'repo';";
  const got = literals(src);
  for (const w of ['바깥 ', '안쪽 ', '가장 안 B2', 'restic', ' 글', ' 끝', 'repo']) assert.ok(got.includes(w), `${w} 빠짐: ${JSON.stringify(got)}`);
  assert.ok(!got.some((s) => /snapshot|bucket/.test(s)), '주석 글이 섞였다');
});

test('화면 원천: 손님이 보는 글(HTML · 화면 스크립트의 문자열)에 걸리는 말이 없다', async () => {
  const { findBanned, visibleText } = await load('banned-words.js');
  const files = fs.readdirSync(UI).filter((f) => /\.(html|js)$/.test(f) && !['banned-words.js', 'engine-fixtures.js', 'orb.js'].includes(f));
  assert.ok(files.length >= 3, `화면 파일이 너무 적다: ${files.join(', ')}`);
  for (const f of files) {
    const src = fs.readFileSync(path.join(UI, f), 'utf8');
    // 주석은 개발자 글이라 뺀다. 스크립트는 문자열 · 템플릿 글 조각을 모두 본다(한글이 없는 라틴 글도). orb.js는 셰이더 원천(GLSL)뿐이고 손님 글이 없어 뺀다
    // 하이픈으로 이은 영문 소문자 값(엔진 상태 값 'no-snapshot' · 작업 종류 'restore-selected')은 코드 이름이라 뺀다. 손님 글은 이런 꼴이 아니다
    const text = f.endsWith('.html') ? visibleText(src) : literals(src).filter((x) => !/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(x)).join(' \n ');
    assert.deepEqual(findBanned(text), [], `${f}`);
  }
});
