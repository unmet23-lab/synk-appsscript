'use strict';
// 알림 고침(무인)의 관문 — tools/lib/알림고침관문.js. 임시 git 저장소에서 바뀐 것을 만들고 하나씩 막는지 본다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const 관문 = require('../tools/lib/알림고침관문.js');

const 종류 = 관문.종류표['tip-worker'];
// 실제 팁 적용안처럼 막을 구간 넷(머리 상수 · 권한 설정 · 작업 머리 · claude 인자)이 있는 대역
const 원본 = [
  "const 파이썬 = 'p';", 'const 판단언제 = {};',
  'const 설정 = {', '  permissions: {', "    allow: ['Read',", "      'Bash(ffmpeg:*)'],", "    deny: ['Task'],", '  },', '};',
  'function 줄(x) { return x.trim(); }',
  'module.exports = {', "  모델: 'claude',", '  줄,', '  async 사전확인() { return { 할일: false }; },', '  인자() {', "    return ['-p'];", '  },', '};', ''].join('\n');

function 저장소(t) {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-fixgate-'));
  t.after(() => fs.rmSync(뿌리, { recursive: true, force: true, maxRetries: 5 }));
  const 사본 = path.join(뿌리, 'r');
  fs.mkdirSync(사본);
  const g = (...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'core.autocrlf=false', ...a], { cwd: 사본, encoding: 'utf8' });
  const 쓰기 = (p, s) => { fs.mkdirSync(path.dirname(path.join(사본, p)), { recursive: true }); fs.writeFileSync(path.join(사본, p), s); };
  g('init', '-q', '-b', 'master');
  g('config', 'core.autocrlf', 'false');
  쓰기('tools/크레딧작업/팁적용안.js', 원본);
  쓰기('tools/크레딧작업/팁판단자료.js', 'module.exports = {};\n');
  쓰기('tests/팁적용안.test.js', "require('node:test')('a', () => {});\n");
  쓰기('tools/other.js', 'module.exports = 1;\n');
  g('add', '-A');
  g('commit', '-qm', 'base');
  return { 뿌리, 사본, g, 쓰기, 바탕: g('rev-parse', 'HEAD').trim() };
}
const 새시험 = 'tests/알림고침-팁빈줄.test.js';
const 고친원천 = 원본.replace('return x.trim();', "return String(x ?? '').trim();");
const 시험글 = "const test = require('node:test');\nconst assert = require('node:assert/strict');\ntest('빈 값', () => assert.equal(require('../tools/크레딧작업/팁적용안.js').줄(undefined), ''));\n";

test('관문: 원천을 고치고 새 시험을 더한 고침은 지나간다', (t) => {
  const r = 저장소(t);
  r.쓰기('tools/크레딧작업/팁적용안.js', 고친원천);
  r.쓰기(새시험, 시험글);
  const 판 = 관문.관문(관문.바뀐것(r.사본, r.바탕), 종류);
  assert.equal(판.통과, true, 판.까닭);
  assert.deepEqual([판.원천, 판.새시험], [['tools/크레딧작업/팁적용안.js'], [새시험]]);
});

for (const [이름, 바꾸기, 까닭] of [
  ['표 밖의 파일', (r) => r.쓰기('tools/other.js', 'module.exports = 2;\n'), /고칠 수 없는 파일이다: tools\/other\.js/],
  ['기존 시험 고치기', (r) => r.쓰기('tests/팁적용안.test.js', "require('node:test')('a', () => { throw 1; });\n"), /고칠 수 없는 파일이다: tests\/팁적용안\.test\.js/],
  ['원천 지우기', (r) => fs.rmSync(path.join(r.사본, 'tools/크레딧작업/팁판단자료.js')), /원천은 고치기만 한다\(D\)/],
  ['고치면 안 되는 줄', (r) => r.쓰기('tools/크레딧작업/팁적용안.js', 고친원천.replace("'claude'", "'haiku'")), /고치면 안 되는 줄/],
  ['only', (r) => r.쓰기(새시험, 시험글.replace("test('빈 값'", "test.only('빈 값'")), /only · skip · todo/],
  ['비밀값', (r) => r.쓰기(새시험, 시험글 + "// sk-ant-api03-abcdefghijklmnopqrstuvwxyz\n"), /비밀값 꼴/],
  ['메일 주소', (r) => r.쓰기(새시험, 시험글 + '// 보낼 곳 person@company.co.kr\n'), /메일 주소/],
  ['PC 경로', (r) => r.쓰기(새시험, 시험글 + "const p = 'C:\\\\Users\\\\someone\\\\x';\n"), /PC 경로/],
  ['제어 글자', (r) => r.쓰기(새시험, 시험글 + '// \u202e뒤집기\n'), /제어 글자/],
  ['이진 파일', (r) => fs.writeFileSync(path.join(r.사본, 'tests/알림고침-팁이진.test.js'), Buffer.from([0, 1, 2, 0, 255, 0])), /이진 파일/],
  ['큰 변경', (r) => r.쓰기(새시험, 시험글 + '// 한 줄\n'.repeat(410)), /바뀐 줄이 \d+줄/],
]) {
  test(`관문: ${이름}은 막는다`, (t) => {
    const r = 저장소(t);
    r.쓰기('tools/크레딧작업/팁적용안.js', 고친원천);
    r.쓰기(새시험, 시험글);
    바꾸기(r);
    const 판 = 관문.관문(관문.바뀐것(r.사본, r.바탕), 종류);
    assert.equal(판.통과, false);
    assert.match(판.까닭, 까닭);
  });
}

test('관문: 새 시험만 · 원천만 · 아무것도 아님 · 표에 없는 종류는 막는다', (t) => {
  const r = 저장소(t);
  assert.match(관문.관문(관문.바뀐것(r.사본, r.바탕), 종류).까닭, /바뀐 것이 없다/);
  assert.match(관문.관문([], undefined).까닭, /종류 표에 없는/);
  r.쓰기(새시험, 시험글);
  assert.match(관문.관문(관문.바뀐것(r.사본, r.바탕), 종류).까닭, /원천을 고치지 않았다/);
  fs.rmSync(path.join(r.사본, 새시험));
  r.쓰기('tools/크레딧작업/팁적용안.js', 고친원천);
  assert.match(관문.관문(관문.바뀐것(r.사본, r.바탕), 종류).까닭, /새 시험이 없다/);
});

test('원천되돌리기 · 후입히기: 고치기 전 판과 고친 판을 오가고 blob은 인덱스의 것이다', (t) => {
  const r = 저장소(t);
  r.쓰기('tools/크레딧작업/팁적용안.js', 고친원천);
  r.쓰기(새시험, 시험글);
  관문.바뀐것(r.사본, r.바탕);
  const blob = 관문.blob들(r.사본, ['tools/크레딧작업/팁적용안.js', 새시험]);
  assert.equal(Object.keys(blob).length, 2);
  관문.원천되돌리기(r.사본, r.바탕, ['tools/크레딧작업/팁적용안.js']);
  assert.equal(fs.readFileSync(path.join(r.사본, 'tools/크레딧작업/팁적용안.js'), 'utf8'), 원본);
  assert.ok(fs.existsSync(path.join(r.사본, 새시험)), '새 시험은 남는다');
  관문.후입히기(r.사본, blob, ['tools/크레딧작업/팁적용안.js']);
  assert.equal(fs.readFileSync(path.join(r.사본, 'tools/크레딧작업/팁적용안.js'), 'utf8'), 고친원천);
});

test('환경과 시험돌리기: 자격 · 운영 경로를 빼고, 셈을 읽고, 실패와 헛 결과를 통과로 치지 않는다', (t) => {
  const r = 저장소(t);
  const env = 관문.환경(path.join(r.뿌리, '시도'), { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ANTHROPIC_API_KEY: 'x', SYNK_운영사본_상태: 'y', HERMES_HOME: 'z', LOCALAPPDATA: 'w', GITHUB_TOKEN: 'v' });
  for (const k of ['ANTHROPIC_API_KEY', 'SYNK_운영사본_상태', 'HERMES_HOME', 'GITHUB_TOKEN']) assert.equal(env[k], undefined, k);
  assert.ok(env.LOCALAPPDATA.startsWith(path.join(r.뿌리, '시도')), '앱 자료는 시도 폴더 안');
  assert.ok(env.HOME.startsWith(path.join(r.뿌리, '시도')) && !env.HOME.includes(`${path.sep}r${path.sep}`), '집 폴더는 사본 밖');
  assert.match(fs.readFileSync(env.GIT_CONFIG_GLOBAL, 'utf8'), /example\.invalid/);
  r.쓰기('tests/알림고침-팁통과.test.js', "require('node:test')('ok', () => {});\nrequire('node:test')('ok2', () => {});\n");
  r.쓰기('tests/알림고침-팁실패.test.js', "require('node:test')('bad', () => { throw new Error('x'); });\n");
  r.쓰기('tests/알림고침-팁환경.test.js', "const assert = require('node:assert/strict');\nrequire('node:test')('env', () => { assert.equal(process.env.ANTHROPIC_API_KEY, undefined); assert.equal(process.env.SYNK_운영사본_상태, undefined); });\n");
  const 통과 = 관문.시험돌리기({ 사본: r.사본, 파일들: ['tests/알림고침-팁통과.test.js', 'tests/알림고침-팁환경.test.js'], env });
  assert.deepEqual([통과.통과함, 통과.시험, 통과.통과, 통과.실패], [true, 3, 3, 0], JSON.stringify(통과));
  const 실패 = 관문.시험돌리기({ 사본: r.사본, 파일들: ['tests/알림고침-팁실패.test.js'], env });
  assert.deepEqual([실패.통과함, 실패.실패], [false, 1]);
  assert.match(실패.실패이름[0], /bad/);
  const 없음 = 관문.시험돌리기({ 사본: r.사본, 파일들: ['tests/없는.test.js'], env });
  assert.equal(없음.통과함, false, '시험이 하나도 돌지 않으면 통과가 아니다');
});

test('관문: 막은 구간(권한 설정 · claude 인자)은 낱말이 없는 줄을 넣어도 막고, 바탕에서 구간을 못 찾으면 막는다(GA7)', (t) => {
  for (const [바꾼, 구간] of [[원본.replace("    allow: ['Read',\n", "    allow: ['Read',\n      'Glob',\n"), '권한 설정'], [원본.replace("    return ['-p'];\n", "    void 0;\n    return ['-p'];\n"), 'claude 인자']]) {
    const r = 저장소(t);
    r.쓰기('tools/크레딧작업/팁적용안.js', 바꾼.replace('return x.trim();', "return String(x ?? '').trim();"));
    r.쓰기(새시험, 시험글);
    const 판 = 관문.관문(관문.바뀐것(r.사본, r.바탕), 종류);
    assert.equal(판.통과, false, 구간);
    assert.match(판.까닭, new RegExp(`막은 구간 「${구간}」을 건드렸다`));
  }
  const r = 저장소(t);
  r.쓰기('tools/크레딧작업/팁적용안.js', 'function 줄(x) { return x.trim(); }\nmodule.exports = { 줄 };\n');
  r.g('commit', '-qam', '구간 없는 바탕');
  const 바탕 = r.g('rev-parse', 'HEAD').trim();
  r.쓰기('tools/크레딧작업/팁적용안.js', "function 줄(x) { return String(x ?? '').trim(); }\nmodule.exports = { 줄 };\n");
  r.쓰기(새시험, 시험글);
  assert.match(관문.관문(관문.바뀐것(r.사본, 바탕), 종류).까닭, /막을 구간 「머리 상수[^」]*」을 바탕에서 찾지 못했다/);
});

test('관문: ++ · --로 시작하는 내용 줄도 검사하고, 메일은 주소마다 본다(GA8 · GA9)', (t) => {
  for (const [더할, 까닭] of [["const s = `\n++ sk-ant-api03-abcdefghijklmnopqrstuvwxyz\n`;\n", /비밀값 꼴/], ['// 보낼 곳 a@example.com b@company.co.kr\n', /메일 주소/]]) {
    const r = 저장소(t);
    r.쓰기('tools/크레딧작업/팁적용안.js', 고친원천);
    r.쓰기(새시험, 시험글 + 더할);
    const 판 = 관문.관문(관문.바뀐것(r.사본, r.바탕), 종류);
    assert.equal(판.통과, false);
    assert.match(판.까닭, 까닭);
  }
  const d = 관문.diff읽기('diff --git a/x b/x\n--- a/x\n+++ b/x\n@@ -0,0 +1,2 @@\n+++ 내용\n+-- 내용\n@@ -5 +7,0 @@\n--- 지운 줄\n');
  assert.deepEqual([d.더한줄, d.뺀줄], [['++ 내용', '-- 내용'], ['-- 지운 줄']]);
  assert.deepEqual(d.덩이.map((x) => [x.기점, x.기수]), [[0, 0], [5, 1]]);
});

test('관문: 조건으로 건너뛰는 시험은 관문이 막고, 실제로 건너뛴 시험은 시험돌리기가 통과로 치지 않는다(GA6)', (t) => {
  const r = 저장소(t);
  r.쓰기('tools/크레딧작업/팁적용안.js', 고친원천);
  r.쓰기(새시험, "require('node:test')('x', { skip: process.platform !== 'none' }, () => {});\n");
  assert.match(관문.관문(관문.바뀐것(r.사본, r.바탕), 종류).까닭, /only · skip · todo/);
  const env = 관문.환경(path.join(r.뿌리, '시도'), { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot });
  r.쓰기('tests/알림고침-팁건너뜀.test.js', "const test = require('node:test');\ntest('a', () => {});\ntest('b', (c) => { c.skip('조건'); });\n");
  const 결과 = 관문.시험돌리기({ 사본: r.사본, 파일들: ['tests/알림고침-팁건너뜀.test.js'], env });
  assert.deepEqual([결과.통과함, 결과.실패, 결과.건너뜀], [false, 0, 1], JSON.stringify(결과));
});

test('올리기환경: 집 폴더 · PATH는 두고 자격 · 운영 경로 · 시험 끄기 값은 뺀다(GA3)', () => {
  const env = 관문.올리기환경({ PATH: 'p', HOME: 'h', USERPROFILE: 'u', SYNK_운영사본_상태: 'x', SYNK_관련시험: '끔', HERMES_HOME: 'x', ANTHROPIC_API_KEY: 'x',
    GITHUB_TOKEN: 'x', MY_SECRET: 'x', SOME_API_KEY: 'x', CLAUDE_CONFIG_DIR: 'x', SSH_AUTH_SOCK: 'x', GIT_ASKPASS: 'x', NODE_TEST_CONTEXT: 'child' });
  assert.deepEqual(Object.keys(env).sort(), ['HOME', 'PATH', 'USERPROFILE']);
});

test('관문: 원천에 더한 줄의 위험 낱말(this · module · require( · process.)은 막고 process.execPath는 둔다, 머리 상수 구간도 막는다(r2 GA9 · Fable v4)', (t) => {
  for (const [바꿀, 까닭] of [
    ["this.인자 = () => []; return String(x ?? '').trim(); }", /실행 설정을 바꿀 수 있는 낱말/],
    ["require('fs'); return String(x ?? '').trim(); }", /실행 설정을 바꿀 수 있는 낱말/],
    ["process.env.X = 1; return String(x ?? '').trim(); }", /고치면 안 되는 줄|실행 설정을 바꿀 수 있는 낱말/],
  ]) {
    const r = 저장소(t);
    r.쓰기('tools/크레딧작업/팁적용안.js', 원본.replace('return x.trim(); }', 바꿀));
    r.쓰기(새시험, 시험글);
    const 판 = 관문.관문(관문.바뀐것(r.사본, r.바탕), 종류);
    assert.equal(판.통과, false, 바꿀);
    assert.match(판.까닭, 까닭);
  }
  const r = 저장소(t);
  r.쓰기('tools/크레딧작업/팁적용안.js', 원본.replace('return x.trim();', "return String(x ?? process.execPath.slice(0, 0)).trim();"));
  r.쓰기(새시험, 시험글);
  assert.equal(관문.관문(관문.바뀐것(r.사본, r.바탕), 종류).통과, true, 'process.execPath는 원래 쓰는 것');
  const r2 = 저장소(t);
  r2.쓰기('tools/크레딧작업/팁적용안.js', 원본.replace("const 판단언제 = {};", "const 덧 = 1;\nconst 판단언제 = {};").replace('return x.trim();', "return String(x ?? '').trim();"));
  r2.쓰기(새시험, 시험글);
  assert.match(관문.관문(관문.바뀐것(r2.사본, r2.바탕), 종류).까닭, /막은 구간 「머리 상수/);
});

test('지문재기: 작업 머리 · 인자 · 지시문 · 내보낸 함수가 같으면 같은 글, 하나라도 다르면 다른 글, 불러오기 실패는 오류', (t) => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-fixprint-'));
  t.after(() => fs.rmSync(방, { recursive: true, force: true }));
  const 파일 = path.join(방, 'tools/크레딧작업/팁적용안.js');
  fs.mkdirSync(path.dirname(파일), { recursive: true });
  const 판 = (모델, 더 = '') => "module.exports = { 모델: '" + 모델 + "', 노력: 'high', 인자({ 크레딧 }) { return ['-p', String(크레딧), this.모델]; }, 지시문(자료, ctx) { return 자료.줄.length + ctx.루트; }" + 더 + ' };\n';
  const env = 관문.환경(path.join(방, '시도'), { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot });
  const 재기 = () => 관문.지문재기({ 사본: 방, 종류: 종류, env });
  fs.writeFileSync(파일, 판('claude-opus-5-5'));
  const 앞 = 재기();
  assert.ok(앞.글 && JSON.parse(앞.글).인자[0].includes('claude-opus-5-5'), JSON.stringify(앞));
  fs.writeFileSync(파일, '// 주석만 바꿈\n' + 판('claude-opus-5-5'));
  assert.equal(재기().글, 앞.글);
  fs.writeFileSync(파일, 판('claude-haiku'));
  assert.notEqual(재기().글, 앞.글);
  fs.writeFileSync(파일, 판('claude-opus-5-5', ', 새것() {}'));
  assert.notEqual(재기().글, 앞.글, '내보낸 함수가 늘면 다르다');
  fs.writeFileSync(파일, 'throw new Error("불러오기 실패");\n');
  assert.match(재기().오류, /지문을 재지 못했다/);
});

test('시험돌리기: 자리를 받으면 시험마다 정의한 자리(파일:줄:칸)와 결과를 중첩까지 모은다(r4 GA8)', (t) => {
  const r = 저장소(t);
  r.쓰기('tests/알림고침-팁이름.test.js', "const test = require('node:test');\ntest('겉', async (c) => { await c.test('속 통과', () => {}); });\ntest('깨짐', () => { throw new Error('x'); });\n");
  const env = 관문.환경(path.join(r.뿌리, '시도'), { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot });
  const 결과 = 관문.시험돌리기({ 사본: r.사본, 파일들: ['tests/알림고침-팁이름.test.js'], env, 자리: true });
  const 본 = Object.fromEntries(결과.자리들.map((x) => [x.자리, x.결과]));
  assert.deepEqual(본, { 'tests/알림고침-팁이름.test.js:2:1': '통과', 'tests/알림고침-팁이름.test.js:2:34': '통과', 'tests/알림고침-팁이름.test.js:3:1': '실패' }, JSON.stringify(결과.자리들));
  assert.deepEqual([결과.자리셈맞음, 결과.자리겹침, 결과.실패이름[0]], [true, false, '깨짐']);
  assert.deepEqual(관문.시험돌리기({ 사본: r.사본, 파일들: ['tests/알림고침-팁이름.test.js'], env }).자리들, [], '자리를 받지 않으면 비어 있다');
});

test('시험돌리기 · 자리같나: 없거나 디렉터리인 시험 경로를 섞으면 돌리지 않고, 조건 · 별칭으로 전후에 다른 자리를 세우거나 반복으로 자리가 겹치면 같지 않다(r3 GA3 · r4 GA5 · GA7 · GA8)', (t) => {
  const r = 저장소(t);
  const env = (옛) => ({ ...관문.환경(path.join(r.뿌리, '시도'), { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot }), 옛판: 옛 ? '1' : '' });
  fs.mkdirSync(path.join(r.사본, 'tests/디렉터리.test.js'), { recursive: true });
  r.쓰기('tests/알림고침-팁묶음.test.js', "const { describe, it } = require('node:test');\ndescribe('묶음', () => { it('하나', () => {}); it('둘', () => {}); });\n");
  for (const 섞을 of ['tests/없음.test.js', 'tests/디렉터리.test.js']) {
    const 섞음 = 관문.시험돌리기({ 사본: r.사본, 파일들: ['tests/알림고침-팁묶음.test.js', 섞을], env: env(false) });
    assert.deepEqual([섞음.통과함, 섞음.없는파일, 섞음.시험], [false, [섞을], null], `${섞을}이 섞이면 돌리지 않는다`);
  }
  assert.equal(관문.파일인가(r.사본, 'tests/디렉터리.test.js'), false);
  const 묶음 = 관문.시험돌리기({ 사본: r.사본, 파일들: ['tests/알림고침-팁묶음.test.js'], env: env(false), 자리: true });
  assert.deepEqual([묶음.통과함, 묶음.시험, 묶음.묶음, 묶음.자리들.length, 묶음.자리셈맞음], [true, 2, 1, 3, true], JSON.stringify(묶음));
  assert.equal(관문.자리같나(묶음, 묶음), true);
  // 고치기 전에는 깨지는 시험, 고친 뒤에는 변수 이름 · 별칭으로 세운 같은 이름의 헛시험 — 이름은 같지만 자리가 다르다
  r.쓰기('tests/알림고침-팁조건.test.js', "const test = require('node:test');\nconst 이름 = '빈 값';\nconst 별칭 = test;\nif (process.env.옛판) test('빈 값', () => { throw new Error('옛'); });\nelse 별칭(이름, () => {});\n");
  const 전 = 관문.시험돌리기({ 사본: r.사본, 파일들: ['tests/알림고침-팁조건.test.js'], env: env(true), 자리: true });
  const 후 = 관문.시험돌리기({ 사본: r.사본, 파일들: ['tests/알림고침-팁조건.test.js'], env: env(false), 자리: true });
  assert.deepEqual([전.실패, 후.통과함, 전.자리들[0].자리, 후.자리들[0].자리], [1, true, 'tests/알림고침-팁조건.test.js:4:21', 'tests/알림고침-팁조건.test.js:5:6']);
  assert.equal(관문.자리같나(전, 후), false, '조건 · 별칭으로 바꿔 세운 시험');
  // 반복으로 만든 시험은 한 자리에 둘이다
  r.쓰기('tests/알림고침-팁반복.test.js', "const test = require('node:test');\nfor (const n of ['가', '나']) test(n, () => {});\n");
  const 반복 = 관문.시험돌리기({ 사본: r.사본, 파일들: ['tests/알림고침-팁반복.test.js'], env: env(false), 자리: true });
  assert.deepEqual([반복.통과함, 반복.자리겹침, 관문.자리같나(반복, 반복)], [true, true, false]);
  // test(…)로 등록하지 않고 맨 위 코드만 있는 파일은 그 파일 경로 이름의 1:1 결과 하나로 찍힌다 — 파일째라 믿지 않는다(r5 GA1 · GA5)
  r.쓰기('tests/알림고침-팁맨위.test.js', "if (process.env.옛판) throw new Error('옛');\n");
  const 맨위전 = 관문.시험돌리기({ 사본: r.사본, 파일들: ['tests/알림고침-팁맨위.test.js'], env: env(true), 자리: true });
  const 맨위후 = 관문.시험돌리기({ 사본: r.사본, 파일들: ['tests/알림고침-팁맨위.test.js'], env: env(false), 자리: true });
  assert.deepEqual([맨위전.실패, 맨위후.통과함, 맨위전.파일째, 맨위후.파일째, 맨위후.자리들[0]?.자리], [1, true, true, true, 'tests/알림고침-팁맨위.test.js:1:1']);
  assert.equal(관문.자리같나(맨위전, 맨위후), false, '파일째 결과');
  // 새 시험 파일마다 등록한 시험이 돌아야 한다 — 빈 describe만 둔 파일이 섞이면 믿지 않는다(r6 GA3)
  r.쓰기('tests/알림고침-팁빈묶음.test.js', "const { describe } = require('node:test');\ndescribe('빈 묶음', () => {});\n");
  const 섞임 = 관문.시험돌리기({ 사본: r.사본, 파일들: ['tests/알림고침-팁빈묶음.test.js', 'tests/알림고침-팁묶음.test.js'], env: env(false), 자리: true });
  assert.deepEqual([섞임.통과함, 섞임.파일째, 섞임.빈파일, 관문.자리같나(섞임, 섞임)], [true, false, ['tests/알림고침-팁빈묶음.test.js'], false]);
  // 건너뛰거나 할 일로 둔 시험은 돌지 않은 것이다 — 고치기 전 판에서 하나를 건너뛰고 고친 뒤 통과시켜도 믿지 않는다(r7 GA2)
  r.쓰기('tests/알림고침-팁건너뛰기.test.js', "const test = require('node:test');\ntest('가', (c) => { if (process.env.옛판) c.skip('옛'); });\n");
  const 건전 = 관문.시험돌리기({ 사본: r.사본, 파일들: ['tests/알림고침-팁건너뛰기.test.js', 'tests/알림고침-팁조건.test.js'], env: env(true), 자리: true });
  const 건후 = 관문.시험돌리기({ 사본: r.사본, 파일들: ['tests/알림고침-팁건너뛰기.test.js', 'tests/알림고침-팁조건.test.js'], env: env(false), 자리: true });
  assert.deepEqual([건전.자리건너뜀, 건후.자리건너뜀, 관문.자리같나(건전, 건후)], [true, false, false]);
  // 이름이 그 파일 경로인 진짜 시험(3:1)은 파일째가 아니다(r6 GA1)
  r.쓰기('tests/알림고침-팁제목.test.js', "const test = require('node:test');\n\ntest('tests/알림고침-팁제목.test.js', () => {});\n");
  const 제목 = 관문.시험돌리기({ 사본: r.사본, 파일들: ['tests/알림고침-팁제목.test.js'], env: env(false), 자리: true });
  assert.deepEqual([제목.통과함, 제목.파일째, 제목.빈파일, 관문.자리같나(제목, 제목)], [true, false, [], true]);
  assert.equal(관문.시험돌리기({ 사본: r.사본, 파일들: [], env: env(false) }).통과함, false, '빈 목록은 돌리지 않는다');
});

test('시험돌리기 · 자리같나: before 훅 실패 · 시간 넘김으로 몸통이 안 돈 시험이 있는 판은 자리를 믿지 않는다(r8 GA4)', (t) => {
  const r = 저장소(t);
  const env = (옛) => ({ ...관문.환경(path.join(r.뿌리, '시도'), { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot }), 옛판: 옛 ? '1' : '' });
  r.쓰기('tests/알림고침-팁훅.test.js', "const { describe, it, before } = require('node:test');\ndescribe('묶음', () => { before(() => { if (process.env.옛판) throw new Error('훅'); }); it('안', () => {}); });\n");
  r.쓰기('tests/알림고침-팁깨짐.test.js', "const test = require('node:test');\ntest('깨짐', () => { if (process.env.옛판) throw new Error('옛'); });\n");
  const 파일들 = ['tests/알림고침-팁훅.test.js', 'tests/알림고침-팁깨짐.test.js'];
  const 전 = 관문.시험돌리기({ 사본: r.사본, 파일들, env: env(true), 자리: true });
  const 후 = 관문.시험돌리기({ 사본: r.사본, 파일들, env: env(false), 자리: true });
  // 다른 파일의 진짜 실패가 있어도, 훅 실패로 몸통 없이 취소된 「안」이 있으면 고치기 전 판을 믿지 않는다
  assert.deepEqual([전.실패, 전.취소, 전.자리셈맞음, 전.자리취소, 후.통과함, 후.자리취소], [1, 1, true, true, true, false], JSON.stringify(전.자리들));
  assert.equal(관문.자리같나(전, 후), false);
  const 진짜만 = 관문.시험돌리기({ 사본: r.사본, 파일들: ['tests/알림고침-팁깨짐.test.js'], env: env(true), 자리: true });
  assert.deepEqual([진짜만.실패, 진짜만.자리취소], [1, false], '몸통이 돌다 깬 실패는 믿는다');
  r.쓰기('tests/알림고침-팁느림.test.js', "const test = require('node:test');\ntest('느림', { timeout: 50 }, async () => { await new Promise((ok) => setTimeout(ok, 400)); });\n");
  const 느림 = 관문.시험돌리기({ 사본: r.사본, 파일들: ['tests/알림고침-팁느림.test.js'], env: env(true), 자리: true });
  assert.deepEqual([느림.통과함, 느림.취소, 느림.자리취소], [false, 1, true]);
});
