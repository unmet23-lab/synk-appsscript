/* 원격ci 회귀 — 「내 커밋을 담은 run」 축이 「최신 run」 축으로 미끄러지지 않는가 (F175)
 *
 * 이 도구가 막는 사고는 하나다: **run 이 0건인데 화면이 초록으로 보이는 것**.
 *   그래서 탐지력 검사의 중심도 「초록을 초록이라 하는가」가 아니라
 *   **「초록이 아닌 넷(미검증·대기·적색·못 봄)을 각각 다르게 말하는가」**다.
 *
 * ⚠ 탐지력은 픽스처로 못박는다 — 실저장소 run 목록은 며칠이면 흘러가 검사가 죽는다.
 *   실저장소에는 거짓양성만 묻는다(CLAUDE.md 가드 맹점 ②).
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const { 판정, 담는가만들기 } = require(path.join(ROOT, 'tools', '원격ci.js'));

const run = (o) => ({
  headSha: 'a'.repeat(40), status: 'completed', conclusion: 'success',
  createdAt: '2026-08-06T10:00:00Z', databaseId: 1, ...o,
});
const 전부담김 = () => true;
const 전부아님 = () => false;

// ── 탐지력 (픽스처) ────────────────────────────────────────────────────────

test('담은 run 이 success 면 초록', () => {
  const r = 판정({ runs: [run({})], 담는가: 전부담김 });
  assert.equal(r.상태, '초록');
});

test('🔴 담은 run 이 0건이면 「미검증」 — 이게 이 도구의 존재 이유다', () => {
  /* 웹훅이 끊겨 run 자체가 안 생긴 상태. run 목록에는 남의 초록이 가득한데
   * 내 커밋을 담은 것은 하나도 없다 — 「최신 run」을 보면 초록으로 보이는 바로 그 자리. */
  const r = 판정({ runs: [run({}), run({ databaseId: 2 })], 담는가: 전부아님 });
  assert.equal(r.상태, '미검증', '남의 초록 run 을 내 커밋의 초록으로 읽었다');
  assert.equal(r.담긴, 0);
});

test('run 목록 자체가 비어도 초록이 아니다', () => {
  assert.equal(판정({ runs: [], 담는가: 전부담김 }).상태, '미검증');
  assert.equal(판정({ runs: undefined, 담는가: 전부담김 }).상태, '미검증');
});

test('담은 run 이 failure 면 적색', () => {
  const r = 판정({ runs: [run({ conclusion: 'failure' })], 담는가: 전부담김 });
  assert.equal(r.상태, '적색');
});

test('아직 도는 중이면 「대기」 — 「곧 초록이겠지」는 판정이 아니다', () => {
  const r = 판정({ runs: [run({ status: 'queued', conclusion: null })], 담는가: 전부담김 });
  assert.equal(r.상태, '대기', 'queued 를 초록이나 적색으로 단정했다');
});

test('🔴 로컬에 없는 헤드(판정 불가)를 「담지 않음」으로 뭉개지 않는다', () => {
  /* null = 못 봤다. false = 안 담는다. 둘을 같게 다루면 「못 본 것」이 조용히 사라진다. */
  const r = 판정({ runs: [run({}), run({ databaseId: 2 })], 담는가: () => null });
  assert.equal(r.상태, '미검증', '못 본 run 을 근거로 초록이라 했다');
  assert.equal(r.판정불가, 2, '못 본 run 개수를 세지 않아 화면에서 사라졌다');
});

test('🔴 담은 run 중 **최신 완료본**이 이긴다 — 옛 초록이 새 적색을 못 덮는다', () => {
  const runs = [
    run({ databaseId: 10, conclusion: 'success', createdAt: '2026-08-05T00:00:00Z' }),
    run({ databaseId: 11, conclusion: 'failure', createdAt: '2026-08-06T00:00:00Z' }),
  ];
  assert.equal(판정({ runs, 담는가: 전부담김 }).상태, '적색');
  assert.equal(판정({ runs: [...runs].reverse(), 담는가: 전부담김 }).상태, '적색',
    '입력 순서에 판정이 흔들린다 — gh 가 순서를 바꾸면 결과가 갈린다');
});

test('대기 중인 새 run 이 있어도 완료본이 있으면 그 결론을 쓴다', () => {
  const runs = [
    run({ databaseId: 20, status: 'queued', conclusion: null, createdAt: '2026-08-06T12:00:00Z' }),
    run({ databaseId: 21, conclusion: 'failure', createdAt: '2026-08-06T11:00:00Z' }),
  ];
  assert.equal(판정({ runs, 담는가: 전부담김 }).상태, '적색');
});

test('담은 것과 안 담은 것이 섞이면 담은 것만 본다', () => {
  const runs = [
    run({ headSha: 'b'.repeat(40), conclusion: 'failure', createdAt: '2026-08-06T12:00:00Z' }),
    run({ headSha: 'c'.repeat(40), conclusion: 'success', createdAt: '2026-08-06T11:00:00Z' }),
  ];
  const 담는가 = (h) => h === 'c'.repeat(40);
  assert.equal(판정({ runs, 담는가 }).상태, '초록', '내 커밋을 안 담은 적색을 내 적색으로 읽었다');
});

// ── 거짓양성 (실저장소) ────────────────────────────────────────────────────

const git있음 = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).status === 0;

test('실저장소: 커밋은 자기 자신을 담는 run 을 인정한다', { skip: !git있음 && 'git 없음' }, () => {
  const HEAD = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).stdout.trim();
  assert.equal(담는가만들기(HEAD)(HEAD), true, '자기 자신을 담는 것으로 안 본다 — 모든 판정이 미검증이 된다');
});

test('실저장소: 없는 헤드·쓰레기 입력은 null 이지 예외가 아니다', { skip: !git있음 && 'git 없음' }, () => {
  const 담는가 = 담는가만들기('HEAD');
  assert.equal(담는가('f'.repeat(40)), null, '존재하지 않는 SHA');
  assert.equal(담는가('not-a-sha'), null, '형식이 아닌 입력');
  assert.equal(담는가(''), null);
  assert.equal(담는가(undefined), null);
});
