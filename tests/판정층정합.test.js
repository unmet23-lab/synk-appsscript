/**
 * 판정층 정합 — 「test-ci 초록 = 배포 게이트 통과」를 기계로 지킨다 (F389).
 *
 * 왜 (F389 · 2026-08-12 실측): test-ci 는 HOME 을 비워 CI 를 모사하는데 clasp-guard 의
 * 안전테스트 폴백은 실 HOME 으로 같은 스위트를 돌렸다. repo 밖(메모리층) 검사 둘이
 * 모사에선 skip(초록) · 게이트에선 적색 — 「CI 모사 초록 2895/0」인데 배포가 막혔고,
 * 그 적색은 배포자 트랙 밖(남의 메모리 줄)이라 주인이 볼 통로도 없었다.
 *
 * 처방 = 환경 조리법을 tools/lib/ci모사환경.js **한 벌**로 모으고 두 소비자가 그것만 쓴다.
 * 이 스위트는 ①한 벌의 조리법 자체(픽스처) ②두 소비자의 사용(소스 핀)을 못박는다 —
 * 어느 쪽이든 인라인 조립이 되살아나면 여기가 빨개진다(갈라짐은 늘 「통과」로 샌다).
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
/* 부정 단언의 주어만 정제한다 — 주석이 금지 패턴을 «설명»하면 그 설명이 위반으로 잡힌다(대기열 #Q72). */
const { 코드만 } = require('./lib/소스검사.js');

const REPO = path.join(__dirname, '..');
const 모사환경 = require(path.join(REPO, 'tools', 'lib', 'ci모사환경.js'));

// ── 1. 조리법 픽스처 ─────────────────────────────────────────────
test('만들기: TZ=UTC · HOME=존재하는 빈 임시 폴더 · SYNK_MEMORY_DIR 제거 · 나머지 보존', () => {
  const 모사 = 모사환경.만들기({
    TZ: 'Asia/Seoul', HOME: '/진짜홈', USERPROFILE: '/진짜홈',
    SYNK_MEMORY_DIR: '/명시지정', PATH: process.env.PATH || '',
  });
  try {
    assert.strictEqual(모사.env.TZ, 'UTC', 'TZ 를 안 지우면 날짜·월 계산이 CI 와 갈린다(F036·F039)');
    assert.strictEqual(모사.env.HOME, 모사.fakeHome, 'HOME 이 임시 홈이 아니다');
    assert.strictEqual(모사.env.USERPROFILE, 모사.fakeHome, '윈도우 도구는 USERPROFILE 을 읽는다 — 한쪽만 비우면 반쪽 모사다');
    assert.ok(fs.existsSync(모사.fakeHome), 'HOME 은 **존재하는** 폴더라야 한다 — 없는 경로면 도구가 경로 오류로 죽어 CI 와 다른 실패가 난다');
    assert.strictEqual(fs.readdirSync(모사.fakeHome).length, 0, 'HOME 은 **빈** 폴더라야 한다 — 남은 파일이 곧 「CI 에 없는 것」이다');
    assert.ok(!('SYNK_MEMORY_DIR' in 모사.env), '명시 지정이 남으면 홈을 비운 의미가 사라진다(모사가 조용히 무력화)');
    assert.strictEqual(모사.env.PATH, process.env.PATH || '', '무관한 변수까지 지우면 node 를 못 찾아 다른 실패가 난다');
  } finally { 모사.치우기(); }
  assert.ok(!fs.existsSync(모사.fakeHome), '치우기가 임시 홈을 안 지운다 — 게이트가 부를 때마다 쓰레기가 쌓인다');
});

// ── 2. 소비자 소스 핀 — 두 자리가 같은 한 벌을 쓰는가 ───────────
test('test-ci 가 한 벌을 쓰고, 인라인 홈 조립이 없다', () => {
  const src = fs.readFileSync(path.join(REPO, 'tools', 'test-ci.js'), 'utf8');
  assert.ok(/ci모사환경/.test(src), 'test-ci 가 lib/ci모사환경 을 안 쓴다');
  assert.ok(!/mkdtempSync/.test(코드만(src)), 'test-ci 에 인라인 홈 조립(mkdtempSync)이 남았다 — 조리법이 두 벌이면 갈라진다');
});

test('clasp-guard 안전테스트 폴백이 한 벌의 env 로 스위트를 돈다 (F389 의 원형이 실 HOME 실행이었다)', () => {
  const src = fs.readFileSync(path.join(REPO, '.claude', 'hooks', 'clasp-guard.js'), 'utf8');
  assert.ok(/ci모사환경/.test(src), 'clasp-guard 가 lib/ci모사환경 을 안 쓴다');
  /* require 만 하고 안 넘기면 이 회귀가 있어도 샌다 — --test 스폰에 env: 모사.env 가 실제로 붙는지 본다.
   * (스폰 형태가 바뀌면 이 정규식을 같이 고친다 — 그 비용이 「게이트가 조용히 실 HOME 으로 돌아가는」
   *  비용보다 싸다. F389 는 정확히 그 조용한 되돌아감이었다.) */
  assert.ok(
    /execFileSync\(process\.execPath,\s*\['--test'[\s\S]{0,220}?env:\s*모사\.env/.test(src),
    'clasp-guard 의 --test 스폰이 모사 env 를 안 받는다 — 게이트가 실 HOME 눈금으로 되돌아갔다(F389 재발)'
  );
  assert.ok(/치우기\(\)/.test(src), '게이트가 임시 홈을 안 치운다');
});

test('auto-commit 의 「실을 테스트」 러너도 같은 한 벌로 돈다 — 같은 스위트의 셋째(마지막) 러너 (F389)', () => {
  /* 이 러너가 지키는 것은 「원격 CI(UTC·홈 없음)가 빨개질 테스트 파일을 안 싣는 것」이라 재는
   * 눈금도 그 층이라야 한다 — 실 HOME 이면 CI 에선 초록일 파일이 남의 메모리 상태로 손커밋 강등된다. */
  const src = fs.readFileSync(path.join(REPO, '.claude', 'hooks', 'auto-commit.js'), 'utf8');
  assert.ok(/ci모사환경/.test(src), 'auto-commit 이 lib/ci모사환경 을 안 쓴다 — 실 HOME 갈래가 되살아났다');
  assert.ok(/const 자식env = 모사\.env/.test(src), '모사 env 가 자식 러너에 실제로 물리지 않았다(require 만으론 안 재진다)');
  assert.ok(/delete 자식env\.NODE_TEST_CONTEXT/.test(src),
    'NODE_TEST_CONTEXT 삭제가 사라졌다 — 「status 0·빈 stdout」의 영구 초록(F207 얼굴)이 되살아난다');
});
