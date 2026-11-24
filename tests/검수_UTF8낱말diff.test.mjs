import test from 'node:test';
import assert from 'node:assert/strict';
import { 낱말줄이기, UTF8낱말원문, 두판diff, 머리걷기, CR보임 } from '../tools/검수묶음.mjs';
const bytes = (...parts) => Buffer.concat(parts.map(p => Buffer.isBuffer(p) ? p : Buffer.from(p)));
const head = '@@ -1 +1 @@\n';

test('reject byte-split Korean markers and keep complete Korean words with the real tokenizer', () => {
  const raw = bytes(head, ' const text="', Buffer.from([0xea, 0xb0]), '\n-', Buffer.from([0x80]), '\n+', Buffer.from([0x81]), '\n ";\n~\n');
  assert.throws(() => 낱말줄이기(raw, { 파일이름: 'fixture.js' }), /encoded data|UTF-8/);
  const result = 두판diff(Buffer.from('const pad="' + '한글 '.repeat(250) + '";const x="가";'), Buffer.from('const pad="' + '한글 '.repeat(250) + '";const x="각";'), 'fixture.js');
  assert.equal(result.꼴, '낱말');
  assert.ok(result.글.includes('[-가-]{+각+}'));
});

test('reject split emoji markers and keep complete emoji with the real tokenizer', () => {
  const raw = bytes(head, ' x="', Buffer.from([0xf0, 0x9f]), '\n-', Buffer.from([0x98]), '\n+', Buffer.from([0x99]), '\n ', Buffer.from([0x80]), '";\n~\n');
  assert.throws(() => 낱말줄이기(raw, { 파일이름: 'fixture.js' }), /encoded data|UTF-8/);
  const prefix = 'const pad="' + '😀'.repeat(550) + '";const x="';
  const result = 두판diff(Buffer.from(prefix + '😀";'), Buffer.from(prefix + '🙀";'), 'fixture.js');
  assert.equal(result.꼴, '낱말');
  assert.ok(result.글.includes('[-😀-]{+🙀+}'));
  assert.equal(Buffer.from(result.글).toString('utf8'), result.글);
});

test('reject separated continuation bytes and keep context clipping on Unicode boundaries', () => {
  const raw = bytes(head, ' x="\n-', Buffer.from([0xea]), '\n+', Buffer.from([0xeb]), '\n ', Buffer.from([0xb0]), '\n-', Buffer.from([0x80]), '\n+', Buffer.from([0x81]), '\n ";\n~\n');
  assert.throws(() => 낱말줄이기(raw, { 파일이름: 'fixture.js' }), /encoded data|UTF-8/);
  const result = 낱말줄이기(head + ' ' + '😀'.repeat(10) + '\n-1\n+2\n~\n', { 파일이름: 'fixture.js', 맥락: 1 }).join('\n');
  assert.equal(Buffer.from(result).toString('utf8'), result);
});

test('a legitimate replacement-character literal remains data and is not a decode error', () => {
  const replacement = String.fromCodePoint(0xfffd), prefix = 'const rule=/' + replacement + '/u;const pad="' + '한글 '.repeat(180) + '";';
  const result = 두판diff(Buffer.from(prefix + 'const count=1;'), Buffer.from(prefix + 'const count=2;'), 'fixture.js');
  assert.equal(result.꼴, '낱말');
  assert.ok(result.글.includes('[-1-]{+2+}'));
});

test('invalid original UTF-8 cannot become an apparently complete word diff', () => {
  assert.throws(() => UTF8낱말원문(bytes(head, '+', Buffer.from([0xea, 0xb0]), '\n~\n')), /encoded data|UTF-8/);
});

test('real Git long-line Korean edits remain concise and preserve changed values', () => {
  const prefix = 'const pad="' + '가나다 '.repeat(240) + '";const value="';
  const result = 두판diff(Buffer.from(prefix + '가";'), Buffer.from(prefix + '각";'), 'fixture.js');
  assert.equal(result.꼴, '낱말');
  assert.ok(result.글.includes('[-가-]{+각+}'));
  assert.ok(result.글.length < prefix.length);
});

test('real Git excludes literal tabs and CRLF from non-ASCII word runs', () => {
  const prefix = 'const pad="' + '한글 '.repeat(240) + '";\tconst value="';
  const result = 두판diff(Buffer.from(prefix + '가";\r\n'), Buffer.from(prefix + '각";\r\n'), 'fixture.js');
  assert.equal(result.꼴, '낱말');
  assert.ok(result.글.includes('[-가-]{+각+}'));
  assert.doesNotMatch(result.글, /\[-[^\]]*[\t\r]|\{\+[^}]*[\t\r]/);
});

test('long Korean line whose word diff would split UTF-8 keeps the original unified diff', () => {
  const before = '최종 소스와 검증한 기록을 보존했다. ' + '원래 문장을 함께 읽는다. '.repeat(70);
  const after = before.replace('최종', '초기').replace('보존했다', '그대로 보존했다');
  const result = 두판diff(Buffer.from(before + '\n'), Buffer.from(after + '\n'), 'README.md');
  assert.equal(result.글.includes('\uFFFD'), false);
  assert.ok(result.글.includes('초기'));
  assert.ok(result.글.includes('최종'));
});
test('머리말을 닮은 내용 줄(「++ 」 · 「-- 」로 시작)은 버리지 않는다 — 줄 차이 · 낱말 차이 · 머리걷기(GPT -e GF1)', () => {
  const 더함 = 두판diff(Buffer.from('a\nb\n'), Buffer.from('a\n++ probe\nb\n'), 'x.txt');
  assert.equal(더함.꼴, 'diff');
  assert.match(더함.글, /^\+\+\+ probe$/m, '「++ 」로 시작하는 더한 줄');
  const 뺌 = 두판diff(Buffer.from('a\n-- gone\nb\n'), Buffer.from('a\nb\n'), 'x.txt');
  assert.match(뺌.글, /^--- gone$/m, '「-- 」로 시작하는 뺀 줄');
  const porcelain = ['diff --git a/v.mjs b/v.mjs', 'index 1..2 100644', '--- a/v.mjs', '+++ b/v.mjs', '@@ -3 +3 @@', ' 앞', '+++ reviewProbe', '--- gone', ' 뒤', '~'].join('\n');
  assert.deepEqual(낱말줄이기(porcelain, { 파일이름: 'v.mjs' }), ['[v.mjs:3] 앞{+++ reviewProbe+}[--- gone-]뒤']);
  // 같은 긴 줄에서 다른 낱말도 바뀌면 낱말 차이로 싣는다 — 「++ reviewProbe」 조각이 머리말로 빠지면 다른 바뀜만 남는다
  const 긴 = 'const pad="' + 'x'.repeat(600) + '";';
  const w = 두판diff(Buffer.from(긴 + 'let v=1;\n'), Buffer.from(긴 + 'let v=2;++ reviewProbe\n'), 'y.js');
  assert.ok(w.글.includes('reviewProbe'), w.글);
  assert.deepEqual(머리걷기(['diff --git a/x b/x', 'index 1..2 100644', '--- a/x', '+++ b/x', '@@ -1,2 +1,3 @@', ' a', '+++ probe', '--- gone', ' b',
    'diff --git a/y b/y', 'new file mode 100644', '--- /dev/null', '+++ b/y', '@@ -0,0 +1 @@', '+y'].join('\n')).split('\n'),
  ['@@ -1,2 +1,3 @@', ' a', '+++ probe', '--- gone', ' b', '@@ -0,0 +1 @@', '+y']);
});

// git 설정 하나를 이 시험 동안만 환경 쌍(GIT_CONFIG_COUNT · KEY · VALUE)으로 더한다. 설정 파일보다 앞서고 도구의 `-c`보다는 뒤라,
// 도구가 `-c`로 정한 값만 이 설정을 이긴다.
function git설정더해(키, 값, 할일) {
  const 열쇠 = ['GIT_CONFIG_COUNT', 'GIT_CONFIG_KEY_', 'GIT_CONFIG_VALUE_'];
  const n = Number(process.env.GIT_CONFIG_COUNT || 0);
  const 앞 = Object.fromEntries([열쇠[0], 열쇠[1] + n, 열쇠[2] + n].map(k => [k, process.env[k]]));
  Object.assign(process.env, { GIT_CONFIG_COUNT: String(n + 1), [열쇠[1] + n]: 키, [열쇠[2] + n]: 값 });
  try { return 할일(); } finally { for (const [k, v] of Object.entries(앞)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
}

test('줄 끝 CR은 ␍로 보인다 — LF를 CRLF로 바꾼 줄이 같은 줄을 빼고 더한 것처럼 보이지 않는다(GPT -e GF2)', () => {
  // 이 PC처럼 core.autocrlf=true인 git을 시험이 스스로 만든다 — 기본값 false인 곳에서는 두판diff가 그 값을 끄지 않아도 통과해 회귀를 못 잡는다(GPT GA2)
  git설정더해('core.autocrlf', 'true', () => {
    const r = 두판diff(Buffer.from('#!/usr/bin/env node\nconsole.log(1);\n'), Buffer.from('#!/usr/bin/env node\r\nconsole.log(1);\n'), 'run.js');
    assert.equal(r.꼴, 'diff');
    assert.match(r.글, /^-#!\/usr\/bin\/env node$/m);
    assert.match(r.글, /^\+#!\/usr\/bin\/env node␍$/m);
    const 긴 = '#!/usr/bin/env node ' + 'x'.repeat(600);
    const w = 두판diff(Buffer.from(긴 + ' a=1\nok\n'), Buffer.from(긴 + ' a=2\r\nok\n'), 'run.js');
    assert.ok(w.글.includes('␍'), '긴 줄에서도 더한 CR이 보인다 — ' + w.글.slice(-200));
  });
  assert.equal(CR보임('a\r\nb'), 'a␍\nb');
});
