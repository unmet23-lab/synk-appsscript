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
/* 주석 제거는 통로가 하나다 — 지역 사본은 저마다 다르게 틀린다(F401·#Q114). */
const { 코드만, 파일소스 } = require('./lib/소스검사.js');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const 도구경로 = path.join(ROOT, 'tools', '원격ci.js');
const { 판정, 상태결정, 브랜치정하기, 담는가만들기, 미기동인가 } = require(도구경로);

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

/* ── 취소 = 증거 아님 (cancel-in-progress c0f035a 상시화의 귀결) ──────────────
 * 08-07 실측: 낡은 판 run 31173804076 이 취소로 «완료»되자 이 도구가 적색+빈 로그 처방을
 * 냈다 — 상위 run 이 4분 뒤 초록을 줬는데 그 창 동안 거짓 적색이었다. 취소는 「새 판이
 * 검사를 이어받았다」이지 판정이 아니다 — 적색으로도 초록으로도 읽으면 안 된다. */

test('🔴 취소된 낡은 판 + 도는 새 판 = 「대기」 — 적색으로 읽으면 그 창마다 거짓 적색이다', () => {
  const runs = [
    run({ databaseId: 31, status: 'in_progress', conclusion: null, createdAt: '2026-08-06T10:06:00Z' }),
    run({ databaseId: 30, conclusion: 'cancelled', createdAt: '2026-08-06T10:05:00Z' }),
  ];
  const r = 판정({ runs, 담는가: 전부담김 });
  assert.equal(r.상태, '대기', '취소 완료본을 증거로 쓰면 상위 run 이 도는 몇 분 동안 거짓 적색이 나간다');
  assert.equal(r.run.databaseId, 31, '기다릴 대상은 취소본이 아니라 도는 run 이다');
});

test('담은 run 이 취소뿐이고 도는 것도 없으면 「취소뿐」 — 초록도 대기도 아니다', () => {
  const r = 판정({ runs: [run({ conclusion: 'cancelled' })], 담는가: 전부담김 });
  assert.equal(r.상태, '취소뿐', '취소만 남은 커밋은 미검증이다 — 어느 쪽으로도 단정하면 샌다');
  assert.equal(r.담긴, 1);
});

test('취소본이 최신이어도 완주본이 증거다 — 초록/적색은 완주한 판의 결론', () => {
  /* 손 취소가 완주 뒤에 일어난 모양 — 필터 없는 구현은 최신 완료본(=취소)을 적색으로 읽는다. */
  const runs = [
    run({ databaseId: 41, conclusion: 'cancelled', createdAt: '2026-08-06T10:09:00Z' }),
    run({ databaseId: 40, createdAt: '2026-08-06T10:05:00Z' }),
  ];
  const r = 판정({ runs, 담는가: 전부담김 });
  assert.equal(r.상태, '초록', '취소를 증거 풀에 남기면 최신 취소본이 완주본을 가린다');
  assert.equal(r.run.databaseId, 40);
});

test('담은 것과 안 담은 것이 섞이면 담은 것만 본다', () => {
  const runs = [
    run({ headSha: 'b'.repeat(40), conclusion: 'failure', createdAt: '2026-08-06T12:00:00Z' }),
    run({ headSha: 'c'.repeat(40), conclusion: 'success', createdAt: '2026-08-06T11:00:00Z' }),
  ];
  const 담는가 = (h) => h === 'c'.repeat(40);
  assert.equal(판정({ runs, 담는가 }).상태, '초록', '내 커밋을 안 담은 적색을 내 적색으로 읽었다');
});

// ── 미실행의 두 종류 · 브랜치 (적대 반박 1패스가 잡은 것) ──────────────────

test('🔴 push 안 된 커밋은 「미push」다 — 「웹훅 끊김」과 처방이 반대다', () => {
  /* 둘 다 run 0건이라 증상이 같다. 한 문구로 내면 처방(`gh workflow run --ref master`)이
   * origin 을 돌려 내 커밋을 영영 안 담는다 — 따라 해도 안 풀리는 처방이 된다. */
  const r = 상태결정({ push됨: false, runs: [], 담는가: 전부아님 });
  assert.equal(r.상태, '미push');
});

test('🔴 미push 는 초록 run 이 있어도 이긴다 — 남의 초록을 내 초록으로 읽지 않는다', () => {
  const r = 상태결정({ push됨: false, runs: [run({})], 담는가: 전부담김 });
  assert.equal(r.상태, '미push', 'push 도 안 한 커밋을 초록이라 했다');
});

test('push 됐으면 평소 판정으로 넘어간다', () => {
  assert.equal(상태결정({ push됨: true, runs: [run({})], 담는가: 전부담김 }).상태, '초록');
  assert.equal(상태결정({ push됨: true, runs: [], 담는가: 전부담김 }).상태, '미검증');
});

test('분리 HEAD·빈 값은 master 로 떨어진다 — 「HEAD 라는 브랜치」를 조회하면 0건이 미검증이 된다', () => {
  assert.equal(브랜치정하기('HEAD'), 'master');
  assert.equal(브랜치정하기(''), 'master');
  assert.equal(브랜치정하기(undefined), 'master');
  assert.equal(브랜치정하기(' master\n'), 'master');
  assert.equal(브랜치정하기('claude/foo-bar'), 'claude/foo-bar', '진짜 브랜치를 master 로 뭉갰다');
});

test('🔴 gh 조회에 --branch 를 실제로 넘긴다 (남의 브랜치 초록이 내 초록이 된다)', () => {
  /* ⚠ 주석을 지우고 본다 — 위 설명 주석에 `--branch` 가 적혀 있어 검사가 산문을 보고 통과한다(F087). */
  const 소스 = 코드만(파일소스(도구경로));
  assert.match(소스, /'run',\s*'list'[\s\S]{0,120}'--branch'/,
    'gh run list 가 브랜치 필터 없이 돈다 — 폰 작업 claude/* run 이 같은 목록에 섞인다');
});

// ── 적색의 두 종류 — 미기동(0스텝)은 코드 판정이 아니다 (F210 · 08-07 실측) ──────────

test('🔴 전 job 0스텝이면 미기동이다 — 빌링 차단 run 을 코드 적색으로 읽지 않는다', () => {
  /* F210 실물: 결제 실패로 job 이 시작조차 안 됐는데 run 은 3초 만에 failure 로 «완료»된다.
   * 같은 ❌ 로 내면 처방(--log-failed)이 빈 로그를 가리킨다 — 세션 4개가 이 판별을 손으로 재도출했다. */
  assert.equal(미기동인가([{ steps: [] }]), true);
  assert.equal(미기동인가([]), true, 'job 자체가 없는 run 도 실행이 아니다');
  assert.equal(미기동인가(undefined), true);
  assert.equal(미기동인가([{ steps: undefined }, {}]), true, 'steps 필드 부재도 0스텝이다');
});

test('🔴 스텝이 하나라도 돌았으면 미기동이 아니다 — 진짜 적색을 미기동으로 뭉개면 깨진 코드가 숨는다', () => {
  assert.equal(미기동인가([{ steps: [{ name: 'checkout' }] }]), false);
  assert.equal(미기동인가([{ steps: [] }, { steps: [{ name: 'test' }] }]), false,
    '한 job 만 돌았어도 실행은 실행이다 — 그 실패는 코드 쪽을 봐야 한다');
});

test('적색 분기가 jobs 를 실제로 읽고 미기동을 가른다 — 판별 함수만 있고 배선이 없으면 그대로 샌다', () => {
  /* ⚠ 주석을 지우고 본다 — 설명 주석의 문구로 검사가 산문을 보고 통과하면 안 된다(F087). */
  const 소스 = 코드만(파일소스(도구경로));
  assert.match(소스, /'--json',\s*'jobs'/, 'run 의 jobs 를 안 읽는다 — 미기동 판별의 재료가 없다');
  assert.match(소스, /미기동인가\(jobs\)/, '판별 함수가 적색 분기에 배선돼 있지 않다');
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

test('🔴 행동: 커밋이 아닌 인자는 「모름」이다 — exit 0 을 「읽었다」로 읽지 않는다',
  { skip: !git있음 && 'git 없음' }, () => {
    /* `git rev-parse --help` 는 exit 0 + 빈 출력이다. 그걸 통과시키면 대상이 빈 문자열이 되고
     * 커밋 칸이 빈 채로 확신에 찬 「미검증」 + 있지도 않은 웹훅 처방이 나온다.
     * 네트워크를 안 탄다 — rev-parse 단계에서 끝나므로 CI 에서도 그대로 돈다. */
    const r = spawnSync(process.execPath, [도구경로, '--help'], { cwd: ROOT, encoding: 'utf8' });
    assert.notEqual(r.status, 0, '커밋이 아닌 인자로 초록을 냈다');
    assert.match(String(r.stderr) + String(r.stdout), /모름/,
      '「모름」이 아니라 다른 판정을 냈다 — 못 잰 것을 잰 것처럼 말한다');
  });

test('🔴 사용자 인자를 rev-parse 에 넘기는 도구는 옵션 종료 표식을 쓴다 (F191)', () => {
  const fs = require('node:fs');
  /* 바로 위 테스트가 사고 현장이었다 — 도구를 `--help` 로 돌리는데 그 인자가 git 옵션으로 먹히면
   * Git for Windows 가 **도움말 HTML 을 기본 브라우저로 연다**. 테스트 1회 = 탭 1개이고,
   * 세션마다 test-ci 를 돌리므로 유호님 화면에 계속 떴다. 부작용이 프로세스 밖이라 행동으로는
   * 못 잡는다 — 소스에서 못박는 것이 유일하게 값싼 검사다. */
  for (const 상대 of ['tools/원격ci.js', 'tools/승인.js']) {
    assert.match(fs.readFileSync(path.join(ROOT, 상대), 'utf8'),
      /rev-parse',\s*'--verify',\s*'--end-of-options'/,
      `${상대}: 사용자 인자를 옵션 종료 표식 없이 rev-parse 에 넘긴다 — 돌릴 때마다 브라우저가 열린다`);
  }
});

test('🔴 지침·안내가 가리키는 경로가 실재한다 (죽은 명령을 상주 지침이 가리키면 안 된다)', () => {
  const fs = require('node:fs');
  const 상대 = 'tools/원격ci.js';
  assert.ok(fs.existsSync(path.join(ROOT, 상대)), `${상대} 가 없다`);
  for (const [파일, 사유] of [
    ['CLAUDE.md', '매 턴 상주하는 지침이 없는 명령을 가리킨다'],
    ['tools/test-ci.js', 'CI 모사 마지막 안내가 이 도구를 안 가리킨다 — 스스로 발화하지 않는 장치는 안 돈다'],
  ]) {
    assert.match(fs.readFileSync(path.join(ROOT, 파일), 'utf8'), new RegExp(상대), `${파일}: ${사유}`);
  }
});
