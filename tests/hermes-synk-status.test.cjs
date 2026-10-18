'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { readStatus, readText, normalizeQuery, plain, MAX_TEXT } = require('../tools/hermes-synk/status.cjs');

const NOW = new Date('2026-10-18T07:00:00.000Z');
const SCRIPT = path.resolve(__dirname, '../tools/hermes-synk/status.cjs');

function fixture(t, { track, cards = [] } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-hermes-status-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'docs/_ops'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs/참고카드/카드'), { recursive: true });
  if (track !== null) fs.writeFileSync(path.join(root, 'docs/_ops/트랙.md'), track ?? '# 트랙\n## 3. 앱\n- **WORLD 입장:** 남은 일: 휴대폰 화면 확인.\n- **바람길:** 음원 듣기 미확인.\n', 'utf8');
  for (const [name, contents] of cards) fs.writeFileSync(path.join(root, 'docs/참고카드/카드', name), contents, 'utf8');
  return root;
}

function card(title, status, target = 'WORLD 앱') {
  return `---\n제목: ${title}\n공유일: 2026-10-18\n대상: ${target}\n${status ? `상태: ${status}\n` : ''}언제: 그 작업 때\n한줄: 문 열기 움직임\n---\n개인 대화 본문을 보내지 않는다.\n`;
}

function inputs(root, overrides = {}) {
  return {
    root, now: NOW,
    readClaude: async () => ({ connected: false, tasks: [], checkedAt: null }),
    readCodexStatus: async () => ({ connected: false, tasks: [], checkedAt: null }),
    ...overrides,
  };
}

test('원문 기록과 런타임을 구분하고 카드 상태를 파일에서 읽는다', async t => {
  const root = fixture(t, { cards: [['1.md', card('적용된 카드', '적용함 (abc)')], ['2.md', card('새 카드', '새로')], ['3.md', card('상태 빠짐', null)]] });
  const report = await readStatus(inputs(root));
  assert.equal(report.documents.track.available, true);
  assert.equal(report.documents.track.total, 2);
  assert.equal(report.documents.track.items[0].line, 3);
  assert.equal(report.documents.track.items[0].status, '문서 기록 · 현재 실행 미확인');
  assert.deepEqual(report.documents.cards.counts, { applied: 1, pending: 1, unknown: 1 });
  assert.equal(report.documents.cards.items.find(row => row.title === '상태 빠짐').status, '미기록');
  assert.match(report.text, /2026-10-18 16:00:00 KST/);
  assert.match(report.text, /현재 실행 상태 미확인/);
  assert.match(report.text, /팁 장부의 원격 상태는 이번 조회에 포함하지 않습니다/);
  assert.doesNotMatch(JSON.stringify(report), /개인 대화 본문/);
});

test('조회 오류·원문 없음은 0개나 완료로 바꾸지 않는다', async t => {
  const root = fixture(t, { track: null });
  fs.rmSync(path.join(root, 'docs/참고카드/카드'), { recursive: true });
  const report = await readStatus(inputs(root, { readClaude: async () => { throw new Error('secret error body'); } }));
  assert.equal(report.documents.track.available, false);
  assert.equal(report.documents.track.total, null);
  assert.equal(report.documents.cards.available, false);
  assert.equal(report.runtimes[0].total, null);
  assert.equal(report.runtimes[0].connected, false);
  assert.doesNotMatch(report.text, /secret error body|조회된 작업 0/);
});

test('검색은 대소문자·한글을 처리하며 메타문자를 문자 그대로 검색한다', async t => {
  const root = fixture(t, { track: '# 트랙\n## 앱\n- **WORLD:** 휴대폰 확인\n- **원문 [.*]:** 그대로 찾기\n- **바람길:** 듣기\n', cards: [['1.md', card('문 열림', '새로')]] });
  const world = await readStatus(inputs(root, { query: 'world' }));
  assert.equal(world.documents.track.matched, 1);
  assert.equal(world.documents.cards.matched, 1);
  const literal = await readStatus(inputs(root, { query: '[.*]' }));
  assert.equal(literal.documents.track.matched, 1);
  const noMatch = await readStatus(inputs(root, { query: '없는검색어' }));
  assert.equal(noMatch.documents.track.matched, 0);
  assert.match(noMatch.text, /완료나 할 일 없음의 근거는 아닙니다/);
  assert.equal(normalizeQuery('  전체 '), '전체');
  assert.throws(() => normalizeQuery('x\n명령'), /80자/);
  assert.throws(() => normalizeQuery('x'.repeat(81)), /80자/);
});

test('정확한 저장소 런타임 개수만 내보내고 제목·ID·경로·토큰은 내보내지 않는다', async t => {
  const root = fixture(t);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-hermes-outside-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  const task = { id: 'private-session-id', cwd: root, title: 'private conversation', status: 'running', token: 'sk-private' };
  const report = await readStatus(inputs(root, {
    readClaude: async () => ({ connected: true, checkedAt: NOW.toISOString(), stale: false, tasks: [task, { ...task, cwd: outside }, { ...task, status: 'hostile-status' }] }),
    readCodexStatus: async () => ({ connected: true, checkedAt: new Date(NOW - 46 * 60_000).toISOString(), tasks: [task] }),
  }));
  assert.deepEqual(report.runtimes[0].counts, { running: 1, unknown: 1 });
  assert.equal(report.runtimes[0].total, 2);
  assert.equal(report.runtimes[0].stale, false);
  assert.equal(report.runtimes[1].stale, true);
  assert.match(report.text, /지난 조회 기록 · 현재 실행 미확인/);
  const data = JSON.stringify(report);
  for (const privateText of ['private-session-id', 'private conversation', 'sk-private', root, outside, 'hostile-status']) assert.equal(data.includes(privateText), false);
});

test('캐시의 잘못된 시각·미래 시각·응답 형식은 미확인으로 표시한다', async t => {
  const root = fixture(t);
  for (const payload of [
    { checkedAt: 'broken', tasks: [] },
    { checkedAt: new Date(NOW.getTime() + 120_000).toISOString(), tasks: [] },
    { checkedAt: NOW.toISOString(), tasks: 'private body' },
  ]) {
    const report = await readStatus(inputs(root, { readCodexStatus: async () => ({ connected: true, ...payload }) }));
    assert.equal(report.runtimes[1].connected, false);
    assert.equal(report.runtimes[1].total, null);
    assert.match(report.runtimes[1].note, /미확인/);
  }
});

test('문서의 이메일·인증 문자열·절대 경로·제어 문자를 숨긴다', async t => {
  const root = fixture(t, { track: '# 트랙\n## 앱\n- **연결:** user@example.test Bearer private-access api_key=private-key C:\\private\\file sk-abcdefghijklmnop \u0000\u202E test\n' });
  const report = await readStatus(inputs(root));
  const text = JSON.stringify(report);
  for (const value of ['user@example.test', 'private-access', 'private-key', 'private\\\\file', 'abcdefghijklmnop']) assert.equal(text.includes(value), false);
  assert.equal(plain('가\u202E나\u0000다'), '가 나 다');
  assert.match(report.text, /인증값 숨김/);
});

test('UTF-8 BOM과 CRLF는 보존해 읽고 잘못된 UTF-8은 미확인 처리한다', async t => {
  const root = fixture(t, { track: '\uFEFF# 트랙\r\n## 앱\r\n- **한글🙂:** 듣기 확인\r\n', cards: [['1.md', '\uFEFF' + card('한글🙂 카드', '새로').replaceAll('\n', '\r\n')]] });
  const report = await readStatus(inputs(root));
  assert.equal(report.documents.track.items[0].title, '한글🙂');
  assert.equal(report.documents.cards.items[0].title, '한글🙂 카드');
  fs.writeFileSync(path.join(root, 'docs/_ops/트랙.md'), Buffer.from([0xff, 0xfe, 0x00]));
  const invalid = await readStatus(inputs(root));
  assert.equal(invalid.documents.track.available, false);
});

test('루트 밖 경로와 symlink/junction 원문·카드는 읽지 않는다', async t => {
  const root = fixture(t);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-hermes-outside-docs-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  fs.writeFileSync(path.join(outside, '트랙.md'), '# 트랙\n## 앱\n- **OUTSIDE SECRET:** 읽히면 안 됨\n');
  fs.writeFileSync(path.join(outside, '1.md'), card('OUTSIDE SECRET', '새로'));
  assert.throws(() => readText(root, '../outside.txt', 100));
  fs.rmSync(path.join(root, 'docs/_ops'), { recursive: true });
  fs.symlinkSync(outside, path.join(root, 'docs/_ops'), process.platform === 'win32' ? 'junction' : 'dir');
  fs.rmSync(path.join(root, 'docs/참고카드/카드'), { recursive: true });
  fs.symlinkSync(outside, path.join(root, 'docs/참고카드/카드'), process.platform === 'win32' ? 'junction' : 'dir');
  const report = await readStatus(inputs(root));
  assert.equal(report.documents.track.available, false);
  assert.equal(report.documents.cards.available, false);
  assert.doesNotMatch(JSON.stringify(report), /OUTSIDE SECRET/);
});

test('너무 큰 문서·잘못된 카드 머리는 안전하게 미확인으로 남긴다', async t => {
  const root = fixture(t, { track: 'x'.repeat(3_000_001), cards: [['1.md', '머리 없음'], ['2.md', card('정상', '새로')]] });
  const report = await readStatus(inputs(root));
  assert.equal(report.documents.track.available, false);
  assert.equal(report.documents.cards.total, 1);
  assert.equal(report.documents.cards.unreadable, 1);
});

test('긴 원문은 목록·요약·텔레그램 문자 한도로 제한한다', async t => {
  const track = '# 트랙\n## 앱\n' + Array.from({ length: 90 }, (_, i) => `- **WORLD ${i} ${'제목'.repeat(90)}:** ${'남은 확인🙂 '.repeat(1000)}\n`).join('');
  const cards = Array.from({ length: 12 }, (_, i) => [`${i}.md`, card('카드 ' + i + '가'.repeat(500), '새로')]);
  const root = fixture(t, { track, cards });
  const report = await readStatus(inputs(root));
  assert.equal(report.documents.track.total, 90);
  assert.equal(report.documents.track.items.length, 6);
  assert.equal(report.documents.track.omitted, 84);
  assert.equal(report.documents.cards.items.length, 4);
  assert.equal(report.documents.cards.omitted, 8);
  assert.ok(report.text.length <= MAX_TEXT);
  assert.equal(/\uFFFD/.test(Buffer.from(report.text, 'utf8').toString('utf8')), false);
});

test('CLI는 모르는 플래그·추가 인자를 거부하며 셸로 넘기지 않는다', () => {
  for (const args of [['--root', 'other'], ['WORLD', 'extra'], ['--token']]) {
    const result = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', shell: false, windowsHide: true });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /사용:/);
    assert.equal(result.stdout, '');
  }
});

test('변경 비교 snapshot은 처음 여섯 트랙·네 카드 이후까지 포함한다', async t => {
  const root = fixture(t, {
    track: '# 트랙\n## 앱\n' + Array.from({ length: 12 }, (_, i) => `- **WORLD ${i}:** ${'본문'.repeat(200)} 끝 ${i}\n`).join(''),
    cards: Array.from({ length: 7 }, (_, i) => [`${i}.md`, card('카드 ' + i, '새로')]),
  });
  const before = await readStatus(inputs(root));
  assert.equal(before.documents.track.items.length, 6);
  assert.equal(before.snapshot.track.items.length, 12);
  assert.equal(before.snapshot.cards.items.length, 7);
  assert.equal(before.snapshot.track.complete, true);
  const file = path.join(root, 'docs/_ops/트랙.md');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('끝 11', '끝 변경11'));
  const after = await readStatus(inputs(root));
  assert.equal(before.snapshot.track.items[11].id, after.snapshot.track.items[11].id);
  assert.notEqual(before.snapshot.track.items[11].fingerprint, after.snapshot.track.items[11].fingerprint);
  assert.deepEqual(before.snapshot.track.items.slice(0, 11), after.snapshot.track.items.slice(0, 11));
});

test('snapshot ID는 행 추가·표제의 기록 날짜 변경에도 유지된다', async t => {
  const root = fixture(t, { track: '# 트랙\n## 앱\n- **WORLD (10-17 점검):** 다음 확인\n' });
  const before = await readStatus(inputs(root));
  fs.writeFileSync(path.join(root, 'docs/_ops/트랙.md'), '# 트랙\n\n\n## 앱\n- **WORLD (10-18 점검):** 다음 확인\n');
  const after = await readStatus(inputs(root));
  assert.equal(before.snapshot.track.items[0].id, after.snapshot.track.items[0].id);
  assert.notEqual(before.snapshot.track.items[0].line, after.snapshot.track.items[0].line);
  assert.notEqual(before.snapshot.track.items[0].fingerprint, after.snapshot.track.items[0].fingerprint);
});

test('트랙 snapshot 상한·읽기 실패는 complete false이며 삭제로 해석할 수 없다', async t => {
  const root = fixture(t, { track: '# 트랙\n## 앱\n' + Array.from({ length: 2001 }, (_, i) => `- **작업 ${i}:** 문서 기록\n`).join('') });
  const limited = await readStatus(inputs(root));
  assert.equal(limited.snapshot.track.items.length, 2000);
  assert.equal(limited.snapshot.track.complete, false);
  fs.unlinkSync(path.join(root, 'docs/_ops/트랙.md'));
  const missing = await readStatus(inputs(root));
  assert.equal(missing.snapshot.track.available, false);
  assert.equal(missing.snapshot.track.complete, false);
});
