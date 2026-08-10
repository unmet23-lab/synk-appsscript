'use strict';
/**
 * tests/대기열낡음.test.js — 「형제가 이 층을 걸고 끝냈는데 대기열은 그대로다」(F289) 검사의 회귀.
 *
 * 왜 픽스처인가: 재료가 **git 이력 + 형제 저장소**라 둘 다 repo 밖이다. CI 체크아웃엔 형제가
 * 없고, 실저장소로 재면 옆 세션이 talk 에 커밋하는 순간 초록/적색이 뒤집힌다(이 저장소는 상시
 * 3~7 세션이 돈다). 그래서 탐지력은 전부 여기 임시 저장소가 진다 — CLAUDE.md 「탐지는 픽스처가
 * 진다 · 실저장소 검사는 거짓양성만」. 실저장소·`.claude/state` 는 한 글자도 안 건드린다(F209).
 *
 * 무엇을 잠그나:
 *   ① 형제가 「대기열 P1」을 걸고 커밋했는데 P1 층이 그 뒤로 안 바뀌면 **잡는다**
 *   ② 그 층을 갱신해 커밋하면 **조용해진다** — 차단 사유가 시키는 동작이 곧 출구인가(F103)
 *   ③ 🔑 **다른 층을 고쳐도 P1 은 계속 운다** — 층이 아니라 파일 단위로 재면 이 검사는
 *      F289 를 원리상 못 막는다(그날도 대기열 파일 자체는 여러 번 담겼다)
 *   ④ 「대기열」을 안 적은 형제 커밋은 안 잡는다(거짓양성)
 *   ⑤ 대기열 커밋과 **같은 초**의 형제 커밋은 「뒤」가 아니다 — 빌려 쓰는 1초 밀기가 살아 있나
 *   ⑥ 형제가 없으면 침묵이 아니라 **미측정**
 *   ⑦ 대기열이 미커밋이면 **미측정**(0건으로 접지 않는다)
 *   ⑧ 한 층에서 여러 번 일했으면 **한 줄로 접고 건수를 밝힌다**(같은 처방을 여러 줄로 = 소음)
 *   ⑨ 🔑 P 층 **뒤의 비-P 절**을 고쳐도 그 층은 계속 운다 — 층 절은 다음 `##` 에서 끝난다
 *   ⑩ 반대로 층 절 **안쪽**(`###`)을 고치면 조용해진다 — ⑨ 의 리셋이 과하면 여기가 빨개진다
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const { 낡음후보 } = require('../tools/대기열.js');
const 대기열좌표 = 'docs/_ops/작업대기열.md';

/* 🔴 기준 시각은 **현실적인 epoch** 여야 한다 — 1970년대 값을 쓰면 git 의 `--since` 가 그 구간을
 *   통째로 빈 결과로 돌려주고, 그러면 0 을 기대하는 검사만 초록인 채 탐지가 전부 죽는다
 *   (tests/절단문서.test.js 가 같은 함정을 이미 실측했다). */
const T = 1780000000;

function git(cwd, args, 시각) {
  const env = { ...process.env };
  if (시각 !== undefined) {
    env.GIT_AUTHOR_DATE = `@${시각} +0000`;
    env.GIT_COMMITTER_DATE = `@${시각} +0000`;
  }
  return execFileSync('git', args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function 저장소(뿌리) {
  fs.mkdirSync(뿌리, { recursive: true });
  git(뿌리, ['init', '-b', 'master']);
  git(뿌리, ['config', 'user.email', 'f@x']);
  git(뿌리, ['config', 'user.name', 'f']);
  git(뿌리, ['config', 'commit.gpgsign', 'false']);
  return 뿌리;
}

/** 메인 + 형제 한 쌍. 형제 이름은 기본 목록에 없어도 되게 `SYNK_OWNER_SIBLINGS` 로 지목한다. */
function 판(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'queuerot-'));
  const 메인 = 저장소(path.join(base, 'main'));
  const 형제 = 저장소(path.join(base, 'SYNK-talk'));
  git(형제, ['commit', '--allow-empty', '-m', '씨앗'], T);

  const 옛 = process.env.SYNK_OWNER_SIBLINGS;
  process.env.SYNK_OWNER_SIBLINGS = '../SYNK-talk';
  t.after(() => {
    if (옛 === undefined) delete process.env.SYNK_OWNER_SIBLINGS;
    else process.env.SYNK_OWNER_SIBLINGS = 옛;
    try { fs.rmSync(base, { recursive: true, force: true }); } catch (_) { /* 윈도우 잠금 */ }
  });
  return { 메인, 형제 };
}

/* 🔑 픽스처는 **실제 파일의 모양**이어야 한다 — 층 절만 있는 문서로 재면 층 귀속이 절 경계를
 *   안 지켜도 초록이다(2026-08-10 실측). 실제 `docs/_ops/작업대기열.md` 는 P 절 **앞뒤로**
 *   비-P `##` 절을 달고 있고, 그 뒤쪽 절이 마지막 P 층에 귀속돼 경보를 거짓으로 껐다. */
const 기본 = [
  '# 작업 대기열',
  '',
  '## 층 — 위가 먼저다',            // P 절 **앞**의 비-P 절
  '',
  '- 위에서부터 집는다',
  '',
  '## P0 — 개원을 막는 것',
  '',
  '- [ ] **운영 명부가 비었다**',
  '',
  '## P1 — 수집이 엔진에 닿는 자리',
  '',
  '- [ ] **⑦ 성과 회수**',
  '',
  '### 곁가지 — 이 층 안쪽',        // `###` 은 층 절 **안**이라 P1 소속이어야 한다
  '',
  '- [ ] **회수율 분모**',
  '',
  '## P3 — 도구·하네스',
  '',
  '- [ ] **역방향 회귀를 넓힌다**',
  '',
  '## 지금 막혀 있어 여기 못 올리는 것 (유호님 답이 열쇠)',   // P 절 **뒤**의 비-P 절
  '',
  '- 미니게임 게이트 AND/OR · C0 동결 범위',
  '',
].join('\n');

function 대기열담기(메인, 시각, 본문 = 기본) {
  fs.mkdirSync(path.join(메인, 'docs', '_ops'), { recursive: true });
  fs.writeFileSync(path.join(메인, 대기열좌표), 본문);
  git(메인, ['add', '--', 대기열좌표]);
  git(메인, ['commit', '-m', '대기열 갱신', '--', 대기열좌표], 시각);
}

/** 층 문자열 → 그 층의 미반영 건수(없으면 0). */
const 건수 = (r, 층) => (r.층별.find((g) => g.층 === 층) || { 건수: 0 }).건수;

test('① 형제가 「대기열 P1」을 걸고 끝냈는데 P1 층이 그대로면 잡는다', (t) => {
  const { 메인, 형제 } = 판(t);
  대기열담기(메인, T + 100);
  git(형제, ['commit', '--allow-empty', '-m', '성과 회수를 세운다 (대기열 P1 · 사슬 ⑦)'], T + 200);

  const r = 낡음후보(메인);
  assert.equal(r.측정, true, `못 쟀다 — ${r.사유}`);
  assert.equal(r.미반영.length, 1, `놓쳤다: ${JSON.stringify(r.미반영)}`);
  assert.equal(r.미반영[0].층, 'P1');
  assert.equal(r.미반영[0].저장소, 'SYNK-talk', '어느 저장소인지 안 실으면 사람이 대조를 못 한다');
});

test('② 그 층을 갱신해 커밋하면 조용해진다 — 처방을 따르면 꺼진다(F103)', (t) => {
  const { 메인, 형제 } = 판(t);
  대기열담기(메인, T + 100);
  git(형제, ['commit', '--allow-empty', '-m', '성과 회수를 세운다 (대기열 P1)'], T + 200);
  assert.equal(낡음후보(메인).미반영.length, 1, '전제가 안 섰다');

  대기열담기(메인, T + 300, 기본.replace('- [ ] **⑦ 성과 회수**', '- [ ] **⑦ 성과 회수 — ✅ 앞은 섰다**'));
  assert.equal(낡음후보(메인).미반영.length, 0, '갱신해도 계속 운다 — 따를 수 없는 처방이 된다');
});

test('③ 다른 층을 고쳐도 P1 은 계속 운다 — 파일 단위로 접으면 F289 를 못 막는다', (t) => {
  const { 메인, 형제 } = 판(t);
  대기열담기(메인, T + 100);
  git(형제, ['commit', '--allow-empty', '-m', '성과 회수를 세운다 (대기열 P1)'], T + 200);

  // P3 만 손대고 담는다 — 실제로 벌어지는 일이 이것이다(대기열은 하루에도 여러 번 담긴다).
  대기열담기(메인, T + 300, 기본.replace('- [ ] **역방향 회귀를 넓힌다**', '- [ ] **역방향 회귀 — 착수**'));

  const r = 낡음후보(메인);
  assert.equal(건수(r, 'P1'), 1, 'P1 이 조용해졌다 — 층이 아니라 파일 단위로 재고 있다');
});

test('④ 「대기열」을 안 적은 형제 커밋은 안 잡는다 (거짓양성)', (t) => {
  const { 메인, 형제 } = 판(t);
  대기열담기(메인, T + 100);
  git(형제, ['commit', '--allow-empty', '-m', '아이콘 크기 조정'], T + 200);
  git(형제, ['commit', '--allow-empty', '-m', 'docs: 보드 — 트랙 종결 갱신'], T + 210);

  const r = 낡음후보(메인);
  assert.equal(r.측정, true);
  assert.equal(r.미반영.length, 0, `엉뚱한 커밋을 잡는다: ${JSON.stringify(r.미반영)}`);
});

test('⑤ 대기열 커밋과 **같은 초**의 형제 커밋은 「뒤」가 아니다 (1초 밀기)', (t) => {
  const { 메인, 형제 } = 판(t);
  대기열담기(메인, T + 100);
  // 한 세션이 두 저장소에 연달아 커밋하는 것이 정상 절차라 같은 초가 드물지 않다.
  git(형제, ['commit', '--allow-empty', '-m', '같은 초에 난 (대기열 P1) 커밋'], T + 100);

  assert.equal(낡음후보(메인).미반영.length, 0,
    '같은 초를 「뒤」로 센다 — 갱신 직후에도 계속 울고, 그러면 이 알림은 꺼진다');
});

test('⑥ 형제가 없으면 침묵이 아니라 미측정이다', (t) => {
  const { 메인 } = 판(t);
  대기열담기(메인, T + 100);
  process.env.SYNK_OWNER_SIBLINGS = '../없는저장소';

  const r = 낡음후보(메인);
  assert.equal(r.측정, false, '형제가 없는데 「쟀다」고 한다 — 0건이 통과처럼 보인다');
  assert.match(r.사유, /형제/);
});

test('⑦ 대기열이 미커밋이면 미측정이다 (0건으로 접지 않는다)', (t) => {
  const { 메인 } = 판(t);
  git(메인, ['commit', '--allow-empty', '-m', '씨앗'], T);
  fs.mkdirSync(path.join(메인, 'docs', '_ops'), { recursive: true });
  fs.writeFileSync(path.join(메인, 대기열좌표), 기본);   // 담지 않는다

  const r = 낡음후보(메인);
  assert.equal(r.측정, false, '커밋 시각이 없는데 쟀다고 한다 — 기준 없이 「뒤」를 계산하게 된다');
});

test('⑨ P 층 **뒤의 비-P 절**만 고쳐도 그 층은 계속 운다 — 절 경계에서 귀속이 끊긴다', (t) => {
  const { 메인, 형제 } = 판(t);
  대기열담기(메인, T + 100);
  git(형제, ['commit', '--allow-empty', '-m', '역방향 회귀를 넓힌다 (대기열 P3)'], T + 200);
  assert.equal(건수(낡음후보(메인), 'P3'), 1, '전제가 안 섰다');

  /* §막힘 절만 고친다 — 지어낸 모양이 아니라 실제로 벌어진 일이다(2026-08-10 `85b70f55` 가
   * 대기열에서 그 한 줄만 고쳤고, 그 커밋이 P3 의 마지막 갱신 시각으로 잡혔다). */
  대기열담기(메인, T + 300,
    기본.replace('- 미니게임 게이트 AND/OR · C0 동결 범위', '- C0 동결 범위'));

  assert.equal(건수(낡음후보(메인), 'P3'), 1,
    '§막힘 절 편집이 마지막 P 층에 귀속됐다 — 아무도 P3 를 안 고쳤는데 경보가 꺼진다');
});

test('⑩ 층 절 **안쪽**의 `###` 하위 절을 고치면 그 층은 조용해진다 (리셋이 과하지 않은가)', (t) => {
  const { 메인, 형제 } = 판(t);
  대기열담기(메인, T + 100);
  git(형제, ['commit', '--allow-empty', '-m', '성과 회수를 세운다 (대기열 P1)'], T + 200);
  assert.equal(건수(낡음후보(메인), 'P1'), 1, '전제가 안 섰다');

  /* ⑨ 의 반대 방향이다 — 절 경계를 `###` 까지 넓히면 하위 절 아래가 **아무 층에도** 안 속해
   * 그 층을 실제로 갱신해도 계속 운다. 따를 수 없는 처방이 되어 알림이 통째로 꺼진다(F103). */
  대기열담기(메인, T + 300,
    기본.replace('- [ ] **회수율 분모**', '- [ ] **회수율 분모 — ✅ 닫았다**'));

  assert.equal(건수(낡음후보(메인), 'P1'), 0,
    '층 절 안쪽 하위 절을 층 밖으로 떨어뜨렸다 — 그 층을 갱신해도 안 꺼진다');
});

test('⑧ 한 층에서 여러 번 일했으면 한 줄로 접고 건수를 밝힌다', (t) => {
  const { 메인, 형제 } = 판(t);
  대기열담기(메인, T + 100);
  git(형제, ['commit', '--allow-empty', '-m', '첫째 (대기열 P1)'], T + 200);
  git(형제, ['commit', '--allow-empty', '-m', '둘째 (대기열 P1)'], T + 210);
  git(형제, ['commit', '--allow-empty', '-m', '셋째 (대기열 P0)'], T + 220);

  const r = 낡음후보(메인);
  assert.equal(r.미반영.length, 3, '전제가 안 섰다');
  assert.equal(r.층별.length, 2, `층으로 안 접힌다: ${JSON.stringify(r.층별)}`);
  assert.equal(건수(r, 'P1'), 2);
  // 최신이 앞이어야 사람이 「가장 최근에 무슨 일이 있었나」를 첫 줄에서 읽는다.
  assert.match(r.층별.find((g) => g.층 === 'P1').최신.제목, /둘째/,
    'git log 는 역시간순인데 첫 것을 최신으로 안 잡았다');
});
