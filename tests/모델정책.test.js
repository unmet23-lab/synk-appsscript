'use strict';
// 제품 API의 모델·계정 격리·유료 옵트인·주소 계약. 네트워크 호출 없이 검사한다.
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const 정책 = require(path.join(ROOT, 'tools', '모델정책.js'));

test('🔑 제미나이 기본 = flash/high — 유호 확정(2026-08-05 "flash high로 세팅해줘") 잠금', () => {
  assert.strictEqual(정책.제미나이.기본, '무료최상');
  const p = 정책.제미나이설정();
  assert.strictEqual(p.model, 'gemini-3.8-flash', '유호 지시 2026-09-03 「전부 3.8 로」와 다르다');
  assert.strictEqual(p.thinking_level, 'high');
});

test('Gemini 3.8 medium은 일시적 503과 무관하게 선택 가능하고 기본 high는 유지한다', () => {
  const 픽 = 정책.제미나이.무료최상;
  const 기존사고 = 픽.thinking_level;
  assert.strictEqual(정책.제미나이설정().thinking_level, 'high');
  try {
    픽.thinking_level = 'medium';
    assert.strictEqual(정책.제미나이설정('무료최상').thinking_level, 'medium');
    픽.thinking_level = 'minimal';
    assert.throws(() => 정책.제미나이설정('무료최상'), /지원하지 않는다/);
  } finally {
    픽.thinking_level = 기존사고;
  }
  assert.strictEqual(정책.제미나이설정().thinking_level, 'high');
});

test('🔑 몽골어대조(첫 라이브 호출자)가 정책 픽을 실제로 소비한다 — 정책이 죽은 장치면 P1 재발 (지적 944e2a1c)', () => {
  const 대조 = require(path.join(ROOT, 'tools', '몽골어대조.js'));
  assert.ok(대조, '몽골어대조 require 실패');
  const src = require('node:fs').readFileSync(path.join(ROOT, 'tools', '몽골어대조.js'), 'utf8');
  assert.match(src, /제미나이설정\(\)/, '몽골어대조가 정책 픽을 안 읽는다');
  assert.doesNotMatch(src, /기본모델 = 'gemini-/, '모델이 다시 하드코딩됐다');
  assert.match(src, /thinking/, '몽골어대조가 사고 수준을 호출에 안 건넨다');
  const 통로 = require('node:fs').readFileSync(path.join(ROOT, 'tools', 'lib', '제미나이호출.js'), 'utf8');
  assert.match(통로, /thinkingLevel/, '사고 수준이 요청에 안 실린다(제미나이호출.js)');
  assert.doesNotMatch(src, /generateContent/, '몽골어대조가 HTTP 를 제 손으로 다시 부른다 — 통로가 둘이면 갈린다');
});

test('제미나이 키는 파일에서만 읽고, 모르는 토큰 여럿이면 null (조용한 401 방지 · 지적 a7be9e8a)', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-gk-'));
  const 이전 = process.env.GEMINI_KEY_PATH_FREE;
  try {
    const f = path.join(d, 'k.txt');
    fs.writeFileSync(f, '﻿설명 텍스트\nAQ.abc123\n');
    process.env.GEMINI_KEY_PATH_FREE = f;
    assert.strictEqual(정책.제미나이키('글'), 'AQ.abc123', '아는 접두어(AQ.)를 못 골랐다');
    fs.writeFileSync(f, 'tok1 tok2\n');
    assert.strictEqual(정책.제미나이키('글'), null, '모르는 토큰 여럿인데 아무거나 집었다');
    fs.writeFileSync(f, '단일토큰\n');
    assert.strictEqual(정책.제미나이키('글'), '단일토큰');
    process.env.GEMINI_KEY_PATH_FREE = path.join(d, '없는파일.txt');
    assert.strictEqual(정책.제미나이키('글'), null, '없는 파일인데 null 이 아니다');
  } finally {
    if (이전 === undefined) delete process.env.GEMINI_KEY_PATH_FREE;
    else process.env.GEMINI_KEY_PATH_FREE = 이전;
  }
});

test('🔴 용도를 안 주면 무료 «글» 열쇠다 · 어느 쪽이 없어도 다른 쪽으로 넘어가지 않는다', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-gk2-'));
  const 옛글 = process.env.GEMINI_KEY_PATH_FREE;
  const 옛돈 = process.env.GEMINI_KEY_PATH;
  try {
    const 글f = path.join(d, 'free.txt');
    const 돈f = path.join(d, 'paid.txt');
    fs.writeFileSync(글f, 'AQ.free\n');
    fs.writeFileSync(돈f, 'AQ.paid\n');
    process.env.GEMINI_KEY_PATH_FREE = 글f;
    process.env.GEMINI_KEY_PATH = 돈f;
    assert.strictEqual(정책.기본용도(), '글', 'API 기본이 무료 AI Studio 문이 아니다');
    assert.strictEqual(정책.제미나이키(), 'AQ.free', '기본이 무료 글 열쇠 쪽이 아니다');
    assert.strictEqual(정책.제미나이키('글'), 'AQ.free');
    assert.strictEqual(정책.제미나이키('돈'), 'AQ.paid');
    process.env.GEMINI_KEY_PATH_FREE = path.join(d, '없다.txt');
    assert.strictEqual(정책.제미나이키('글'), null, '공짜 열쇠가 없을 때 유료로 넘어갔다');
    assert.strictEqual(정책.제미나이키('돈'), 'AQ.paid', '돈 열쇠까지 같이 죽으면 안 된다');
    process.env.GEMINI_KEY_PATH_FREE = 글f;
    process.env.GEMINI_KEY_PATH = path.join(d, '없다2.txt');
    assert.strictEqual(정책.제미나이키(), 'AQ.free', '기본 글 열쇠까지 돈 열쇠 부재에 물들었다');
    assert.strictEqual(정책.제미나이키('돈'), null, '돈 열쇠가 없을 때 글 열쇠로 넘어갔다');
    assert.strictEqual(정책.제미나이키('글'), 'AQ.free', '글 열쇠는 따로 살아 있어야 한다(옵트인 예비)');
    assert.match(정책.제미나이키안내('글'), /만드는 법/, '없다고만 말하면 사람이 다음 수를 모른다');
    assert.throws(() => 정책.제미나이키('아무거나'), /용도/, '모르는 용도가 조용히 통과하면 안 된다');
  } finally {
    if (옛글 === undefined) delete process.env.GEMINI_KEY_PATH_FREE; else process.env.GEMINI_KEY_PATH_FREE = 옛글;
    if (옛돈 === undefined) delete process.env.GEMINI_KEY_PATH; else process.env.GEMINI_KEY_PATH = 옛돈;
  }
});

test('🔒 Vertex 유료 API는 명시 승인 없이는 OAuth 토큰을 만들기 전에 막힌다', async () => {
  const 옛argv = process.argv;
  const 옛env = process.env.SYNK_ALLOW_PAID_API;
  try {
    process.argv = ['node', 'test'];
    delete process.env.SYNK_ALLOW_PAID_API;
    assert.strictEqual(정책.유료API허용(), false);
    await assert.rejects(() => 정책.제미나이헤더('돈'), (e) => e && e.code === 'PAID_API_DISABLED');
    const 생존 = await 정책.제미나이생존({ 용도: '돈' });
    assert.deepStrictEqual([생존.살았나, 생존.종류], [null, '유료차단']);
    assert.strictEqual(정책.유료API허용(['--유료-api'], {}), true);
    assert.strictEqual(정책.유료API허용([], { SYNK_ALLOW_PAID_API: '1' }), true);
  } finally {
    process.argv = 옛argv;
    if (옛env === undefined) delete process.env.SYNK_ALLOW_PAID_API;
    else process.env.SYNK_ALLOW_PAID_API = 옛env;
  }
});

test('명시한 최상 API 모델과 사고 수준을 자동 변경하지 않는다', () => {
  const p = 정책.제미나이설정('최상');
  assert.strictEqual(p.model, 'gemini-3.1-pro-preview');
  assert.strictEqual(p.thinking_level, 'high');
});

test('🔑 폴백허용=false — 무료 키로 최상을 못 부르면 **말하고 멈춘다**(조용히 flash 로 내려가면 「최고로 세팅했다」가 거짓이 된다)', () => {
  assert.strictEqual(정책.제미나이.폴백허용, false);
});

test('무료최상 픽이 이름 붙어 있고, 결제 필요 여부가 표에 박혀 있다 — 등급 착오는 코드가 먼저 안다', () => {
  const p = 정책.제미나이설정('무료최상');
  assert.strictEqual(p.무료등급, true);
  assert.strictEqual(정책.제미나이설정('최상').무료등급, false, '3.1 Pro 는 API 무료 등급이 없다(공식 FAQ) — 이게 true 로 바뀌면 누가 실측 없이 고친 것');
});

test('두 픽 모두 사고 수준이 그 모델의 지원 목록 안이다 — 미지원 수준은 요청이 죽거나 조용히 무시된다', () => {
  for (const 키 of ['최상', '무료최상']) {
    assert.doesNotThrow(() => 정책.제미나이설정(키));
  }
  assert.throws(() => 정책.제미나이설정('없는픽'), /모르는 제미나이 픽/);
});

test('🔴 「돈」 열쇠를 부르는 자리는 목록에 있는 것뿐이다 — 돈 쓰는 자리가 조용히 늘면 안 된다', () => {
  const fs = require('node:fs');
  const 허용 = {
    'tools/lib/이미지굽기.js': '그림 1컷 — 공짜 몫이 없다(가격표 Not available). 쓰는 도구 = 라디오무대굽기·펠트색굽기',
    'tools/음성실측.js': '몽골어 음성(TTS) 실측 — 오디오는 공짜 몫 밖. 제품에 안 붙은 «재보는» 도구다',
  };
  const 훑기 = (상대) => {
    const 절대 = path.join(ROOT, 상대);
    if (!fs.existsSync(절대)) return [];
    return fs.readdirSync(절대, { withFileTypes: true }).flatMap((e) => {
      const 다음 = 상대 ? `${상대}/${e.name}` : e.name;
      if (e.isDirectory()) return /^(node_modules|\.git|worktrees|_archive)$/.test(e.name) ? [] : 훑기(다음);
      return e.isFile() && e.name.endsWith('.js') ? [다음] : [];
    });
  };
  const 찾은 = [];
  for (const 상대 of [...훑기('tools'), ...훑기('evals')]) {
    const 본문 = fs.readFileSync(path.join(ROOT, 상대), 'utf8');
    if (상대 === 'tools/모델정책.js') continue;
    if (/제미나이키(?:경로)?\(\s*['"]돈['"]\s*\)/.test(본문)) 찾은.push(상대);
  }
  const 새것 = 찾은.filter((p) => !(p in 허용));
  assert.deepStrictEqual(새것, [],
    `돈 열쇠를 새로 부르는 곳이 생겼다 — 「항상 무료 먼저」(유호 09-03)를 지나쳤다.\n`
    + `  공짜 몫으로 되는 일이면 용도를 '글'로 바꾸고, 정말 돈이 필요하면 이 시험의 «허용» 표에 이름과 까닭을 올려라.`);
  const 사라진 = Object.keys(허용).filter((p) => !찾은.includes(p));
  assert.deepStrictEqual(사라진, [], '허용 표에 있는데 실물이 그 열쇠를 안 쓴다 — 표가 낡았다');
});

test('🔴 «글» 문은 AI Studio 그대로다 — 옮기면 공짜가 죽는다(결정 09-03)', () => {
  const 글 = 정책.제미나이문('글');
  assert.strictEqual(글.base, 'https://generativelanguage.googleapis.com/v1beta', '글 열쇠는 결제가 안 붙어서 공짜다. 문을 옮기면 결제가 따라와 그 순간 죽는다');
  assert.strictEqual(글.목록가능, true, 'AI Studio 문에는 모델 목록이 있다 — 정찰이 그걸 읽는다');
  assert.match(정책.제미나이URL('글', 'M'), /\/v1beta\/models\/M:generateContent$/);
});

test('🔴 «돈» 문은 Vertex 다 — 무료 크레딧 $300 이 AI Studio 문에는 안 먹는다', () => {
  const 돈 = 정책.제미나이문('돈');
  assert.strictEqual(돈.base, 'https://aiplatform.googleapis.com/v1');
  assert.strictEqual(돈.목록가능, false, 'Vertex 에는 목록 조회가 없다 — 있다고 하면 «안 재봤다»가 «봤다»로 접힌다');
  const 옛프로젝트 = process.env.SYNK_VERTEX_PROJECT;
  try {
    process.env.SYNK_VERTEX_PROJECT = 'synthetic-project';
    assert.match(
      정책.제미나이URL('돈', 'M'),
      /\/v1\/projects\/[^/]+\/locations\/[^/]+\/publishers\/google\/models\/M:generateContent$/,
    );
  } finally {
    if (옛프로젝트 === undefined) delete process.env.SYNK_VERTEX_PROJECT;
    else process.env.SYNK_VERTEX_PROJECT = 옛프로젝트;
  }
  assert.strictEqual(돈.인증, 'oauth', 'Vertex 는 API 키를 못 받는다(조직 밖 프로젝트 · 09-04) — 키로 되돌리면 403 이다');
});

test('🔑 «돈» 문의 프로젝트·위치는 env 로 덮을 수 있다 — 되돌리기는 변수 지우기 하나', () => {
  const 옛 = [process.env.SYNK_VERTEX_PROJECT, process.env.SYNK_VERTEX_LOCATION];
  try {
    process.env.SYNK_VERTEX_PROJECT = 'p-시험';
    process.env.SYNK_VERTEX_LOCATION = 'loc-시험';
    assert.match(정책.제미나이URL('돈', 'M'), /\/projects\/p-시험\/locations\/loc-시험\//);
  } finally {
    if (옛[0] === undefined) delete process.env.SYNK_VERTEX_PROJECT; else process.env.SYNK_VERTEX_PROJECT = 옛[0];
    if (옛[1] === undefined) delete process.env.SYNK_VERTEX_LOCATION; else process.env.SYNK_VERTEX_LOCATION = 옛[1];
  }
  assert.strictEqual(정책.벌텍스위치(), 'global', '기본 위치는 전역이다 — 리전 문은 10% 비싸다');
});

test('🔑 두 문은 서로 다르다 · 모르는 용도는 거절한다', () => {
  assert.notStrictEqual(정책.제미나이문('글').base, 정책.제미나이문('돈').base, '둘이 같아졌다 — 통째 교체가 들어왔다는 뜻이다');
  assert.strictEqual(정책.제미나이문().base, 정책.제미나이문('글').base, 'API 기본은 무료 AI Studio 문이다');
  assert.throws(() => 정책.제미나이문('그림'), /용도는/, '모르는 용도를 조용히 글로 접으면 「돈 문으로 돌렸다」고 믿는 상태가 생긴다');
});

test('🔑 env 로 그 자리만 덮어쓸 수 있다 — 되돌리기는 변수 지우기 하나', () => {
  const 옛 = process.env.GEMINI_BASE_PAID;
  try {
    process.env.GEMINI_BASE_PAID = 'https://example.test/v9/';
    const 돈 = 정책.제미나이문('돈');
    assert.strictEqual(돈.base, 'https://example.test/v9', '끝의 빗금을 안 걷으면 주소에 // 가 생긴다');
    assert.strictEqual(돈.덮어씀, true, '덮어쓴 사실이 안 보이면 「정본대로 돈다」고 믿는다');
    assert.strictEqual(정책.제미나이문('글').덮어씀, undefined, '한쪽 덮어쓰기가 다른 쪽까지 물들면 안 된다');
  } finally {
    if (옛 === undefined) delete process.env.GEMINI_BASE_PAID; else process.env.GEMINI_BASE_PAID = 옛;
  }
  assert.strictEqual(정책.제미나이문('돈').base, 'https://aiplatform.googleapis.com/v1', '변수를 지우면 정본으로 돌아온다');
});

test('🔴 주소를 하드코딩한 파일이 없다 — 문은 모델정책 한 곳만 안다', () => {
  const fs = require('node:fs');
  const 볼것 = [
    'tools/모델정책.js', 'tools/lib/제미나이호출.js', 'tools/lib/이미지굽기.js', 'tools/음성실측.js',
  ];
  const 걸린 = [];
  for (const rel of 볼것) {
    const 본문 = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    본문.split('\n').forEach((줄, i) => {
      if (!/https?:\/\/(generativelanguage|aiplatform)\.googleapis\.com/i.test(줄)) return;
      if (/^\s*[*/]/.test(줄)) return;                       // 주석은 설명이지 주소가 아니다
      if (rel === 'tools/모델정책.js' && /^\s*이름:/.test(줄)) return; // 문 표 = 유일한 정본 자리
      걸린.push(`${rel}:${i + 1} ${줄.trim().slice(0, 90)}`);
    });
  }
  assert.deepStrictEqual(걸린, [], '주소가 코드에 다시 박혔다 — 한쪽만 옮겨지면 그쪽이 조용히 갈린다');
});

test('설정 조회는 API를 호출하지 않고 폐기한 작업 배치 옵션을 거절한다', () => {
  const { spawnSync } = require('node:child_process');
  const env = { ...process.env, GEMINI_KEY_PATH_FREE: path.join(ROOT, 'missing-synthetic-key'), SYNK_VERTEX_OAUTH: path.join(ROOT, 'missing-synthetic-oauth') };
  delete env.SYNK_ALLOW_PAID_API;
  const show = spawnSync(process.execPath, [path.join(ROOT, 'tools', '모델정책.js')], { encoding: 'utf8', env, timeout: 5000, windowsHide: true });
  assert.equal(show.status, 0, show.stderr);
  assert.match(show.stdout, /제품 API 설정/);
  const obsolete = spawnSync(process.execPath, [path.join(ROOT, 'tools', '모델정책.js'), '--배치', '과제글'], { encoding: 'utf8', env, timeout: 5000, windowsHide: true });
  assert.equal(obsolete.status, 2);
  assert.ok(obsolete.stderr.includes('공식 앱/CLI'));
});
