'use strict';
// tools/원격ci.js — 담은 run 판정, push 경로 필터, 기록 전용 커밋의 이어받기, 여러 워크플로 종합(2026-10-20).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { 판정, 푸시필터, 경로패턴, 걸리나, 이어받기, 워크플로판정, 종합 } = require('../tools/원격ci.js');

const run = (headSha, extra = {}) => ({ headSha, status: 'completed', conclusion: 'success', createdAt: '2026-10-20T10:00:00Z', databaseId: 1, ...extra });
// 커밋 그림: a ← b ← c(대상) ← d. 담는가 = 대상의 자손이거나 자신, 조상인가 = 대상의 조상이거나 자신.
const 순서 = ['a', 'b', 'c', 'd'];
const 담는가 = (h) => (순서.includes(h) ? 순서.indexOf(h) >= 2 : null);
const 조상인가 = (h) => (순서.includes(h) ? 순서.indexOf(h) <= 2 : null);

test('담은 run 판정은 예전 그대로 — 취소·건너뜀은 증거가 아니고 최신 완료본을 쓴다', () => {
  assert.equal(판정({ runs: [run('d')], 담는가 }).상태, '초록');
  assert.equal(판정({ runs: [run('d', { conclusion: 'failure' })], 담는가 }).상태, '적색');
  assert.equal(판정({ runs: [run('c', { conclusion: 'cancelled' })], 담는가 }).상태, '취소뿐');
  assert.equal(판정({ runs: [run('c', { conclusion: 'cancelled' }), run('d', { status: 'queued', conclusion: null })], 담는가 }).상태, '대기');
  assert.equal(판정({ runs: [run('c', { conclusion: 'skipped' })], 담는가 }).상태, '건너뜀');
  assert.equal(판정({ runs: [run('b')], 담는가 }).상태, '미검증');
  assert.equal(판정({ runs: [run('zz')], 담는가 }).판정불가, 1);
});

test('push 경로 필터를 읽는다 — 모르는 꼴이면 「모름」', () => {
  assert.deepEqual(푸시필터('on:\n  push:\n  workflow_dispatch:\n'), { 종류: '전부' });
  assert.deepEqual(푸시필터('on: [push, workflow_dispatch]\n'), { 종류: '전부' });
  assert.deepEqual(푸시필터('on:\n  schedule:\n    - cron: "1 2 * * 1"\n  workflow_dispatch:\n'), { 종류: '없음' });
  assert.deepEqual(푸시필터("on:\n  push:\n    paths-ignore:\n      - 'docs/_ops/트랙.md'\n      - \"docs/현장노트/**\"  # 주석\n    # 사이 주석\n      - docs/_ops/*.jsonl\n  workflow_dispatch:\n"),
    { 종류: 'paths-ignore', 패턴: ['docs/_ops/트랙.md', 'docs/현장노트/**', 'docs/_ops/*.jsonl'] });
  assert.deepEqual(푸시필터('on:\n  push:\n    paths:\n    - tools/a.js\n'), { 종류: 'paths', 패턴: ['tools/a.js'] });
  assert.equal(푸시필터('on:\n  push:\n    branches: [master]\n').종류, '모름');
  assert.equal(푸시필터('on:\n  push:\n    paths: [a, b]\n').종류, '모름');
  assert.equal(푸시필터('on:\n  push:\n    paths:\n      - a\n    paths-ignore:\n      - b\n').종류, '모름');
  assert.equal(푸시필터('name: x\n').종류, '모름');
});

test('경로 패턴은 GitHub 처럼 * 는 / 를 넘지 않고 ** 는 넘는다', () => {
  assert.ok(경로패턴('docs/현장노트/**').test('docs/현장노트/지난기록/git.md'));
  assert.ok(경로패턴('docs/_ops/*.jsonl').test('docs/_ops/a.jsonl'));
  assert.ok(!경로패턴('docs/_ops/*.jsonl').test('docs/_ops/보관/a.jsonl'));
  assert.ok(경로패턴('**/*.md').test('a.md') && 경로패턴('**/*.md').test('x/y/a.md'));
  assert.equal(경로패턴('docs/?.md'), null);
});

test('걸리나 — paths-ignore 는 하나라도 안 빠지는 파일이 있으면, paths 는 하나라도 걸리면 뜬다', () => {
  const 무거운 = { 종류: 'paths-ignore', 패턴: ['docs/_ops/트랙.md', 'docs/현장노트/**'] };
  assert.equal(걸리나(무거운, ['docs/_ops/트랙.md', 'docs/현장노트/git.md']), false);
  assert.equal(걸리나(무거운, ['docs/_ops/트랙.md', 'tools/a.js']), true);
  const 기록 = { 종류: 'paths', 패턴: ['docs/_ops/트랙.md', 'docs/현장노트/**', '!docs/현장노트/지난기록/**'] };
  assert.equal(걸리나(기록, ['tools/a.js']), false);
  assert.equal(걸리나(기록, ['docs/현장노트/git.md']), true);
  assert.equal(걸리나(기록, ['docs/현장노트/지난기록/git.md']), false);
  assert.equal(걸리나({ 종류: '전부' }, ['x']), true);
  assert.equal(걸리나({ 종류: '모름' }, ['x']), null);
  assert.equal(걸리나({ 종류: 'paths', 패턴: ['a?'] }, ['x']), null);
});

test('기록 전용 커밋은 담은 run 이 없어도 무거운 검사의 조상 판정을 이어받는다 — 걸리는 파일이 있으면 미검증', () => {
  const 필터 = { 종류: 'paths-ignore', 패턴: ['docs/_ops/트랙.md'] };
  const runs = [run('a', { createdAt: '2026-10-20T09:00:00Z' }), run('b', { createdAt: '2026-10-20T09:30:00Z', databaseId: 2 })];
  const 기록만 = () => ['docs/_ops/트랙.md'];
  const r = 워크플로판정({ push됨: true, runs, 담는가, 조상인가, 필터, 바뀐파일: 기록만 });
  assert.equal(r.상태, '초록'); assert.equal(r.이어받음, true); assert.equal(r.run.headSha, 'b', '가장 최근 조상 run');
  const 적색 = 워크플로판정({ push됨: true, runs: [run('b', { conclusion: 'failure' })], 담는가, 조상인가, 필터, 바뀐파일: 기록만 });
  assert.equal(적색.상태, '적색'); assert.equal(적색.이어받음, true);
  assert.equal(워크플로판정({ push됨: true, runs, 담는가, 조상인가, 필터, 바뀐파일: () => ['tools/a.js'] }).상태, '미검증');
  assert.equal(워크플로판정({ push됨: true, runs, 담는가, 조상인가, 필터: { 종류: '모름' }, 바뀐파일: 기록만 }).상태, '미검증');
  assert.equal(워크플로판정({ push됨: true, runs, 담는가, 조상인가, 필터, 바뀐파일: () => null }).상태, '미검증');
  // 조상 run 이 아직 도는 중이면 이어받아도 대기다.
  assert.equal(이어받기({ runs: [run('b', { status: 'in_progress', conclusion: null })], 조상인가, 필터, 바뀐파일: 기록만 }).상태, '대기');
  // 취소된 조상 run 은 건너뛰고 그 앞의 완료본을 본다.
  const 앞 = 이어받기({ runs: [run('a', { createdAt: '2026-10-20T09:00:00Z' }), run('b', { conclusion: 'cancelled', createdAt: '2026-10-20T09:30:00Z' })], 조상인가, 필터, 바뀐파일: 기록만 });
  assert.equal(앞.run.headSha, 'a');
  // 담은 run 이 있으면 이어받지 않는다(담은 run 이 적색이면 적색).
  assert.equal(워크플로판정({ push됨: true, runs: [run('d', { conclusion: 'failure' }), ...runs], 담는가, 조상인가, 필터, 바뀐파일: 기록만 }).상태, '적색');
});

test('종합 — 모두 초록(이어받은 초록 포함)일 때만 초록, 적색이 대기보다, 대기가 미검증보다 먼저다', () => {
  const x = (상태, extra = {}) => ({ w: { 파일: 상태 + '.yml' }, 결과: { 상태, ...extra } });
  assert.equal(종합([x('초록'), x('초록', { 이어받음: true })]).상태, '초록');
  assert.equal(종합([x('초록'), x('미검증')]).상태, '미검증');
  assert.equal(종합([x('대기'), x('적색'), x('미검증')]).상태, '적색');
  assert.equal(종합([x('미검증'), x('대기')]).상태, '대기');
  assert.equal(종합([]).상태, '미검증');
});

test('저장소의 push 워크플로는 모두 필터를 읽을 수 있다 — 못 읽으면 이어받기가 조용히 꺼진다', () => {
  const dir = path.join(__dirname, '..', '.github', 'workflows');
  const 결과 = fs.readdirSync(dir).filter((f) => /\.ya?ml$/.test(f))
    .map((f) => [f, 푸시필터(fs.readFileSync(path.join(dir, f), 'utf8'))]);
  for (const [f, 필터] of 결과) {
    assert.notEqual(필터.종류, '모름', `${f}: push 필터를 못 읽는다`);
    for (const p of 필터.패턴 || []) assert.ok(경로패턴(p.replace(/^!/, '')), `${f}: 패턴 ${p} 를 못 읽는다`);
  }
  assert.ok(결과.some(([f]) => f === 'syntax-check.yml'));
});
