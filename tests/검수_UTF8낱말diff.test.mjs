import test from 'node:test';
import assert from 'node:assert/strict';
import { 낱말줄이기, UTF8낱말원문, 두판diff } from '../tools/검수묶음.mjs';
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
