'use strict';
/**
 * tests/절단문서.test.js — 소급불가 정본이 낡았는지 재는 주간 점검(`rot-check` 절단문서 검사)의 회귀.
 *
 * 왜 픽스처인가: 이 검사의 재료는 **git 이력 + 형제 저장소** 둘 다 repo 밖이다. CI 체크아웃에는
 * 형제가 없고, 실저장소로 재면 옆 세션이 talk 에 커밋하는 순간 초록/적색이 뒤집힌다.
 * 그래서 탐지력은 전부 여기 임시 저장소가 지고(CLAUDE.md 「탐지는 픽스처가 진다」),
 * 실저장소에는 아무것도 안 건다 — 이 파일은 `.claude/state` 도 만지지 않는다(F209).
 *
 * 무엇을 잠그나:
 *   ① 문서를 담은 뒤 형제에서 ①②항목을 말한 커밋이 나면 **잡는다**
 *   ② 항목을 안 말하는 커밋은 안 잡는다(거짓양성)
 *   ③ 🔑 문서 커밋과 **같은 초**의 형제 커밋은 안 잡는다 — `--since` 는 경계를 포함하고 git 시각은
 *      초 단위라, 1초를 안 밀면 문서를 갱신한 그 순간의 커밋이 「뒤」로 딸려 들어온다(F062 계열)
 *   ④ 문서를 다시 담으면 조용해진다 — 처방을 따르면 꺼지는가(따를 수 없는 처방 금지 · F103)
 *   ⑤ 형제가 없으면 **미측정으로 드러낸다**(통과와 미실행이 같은 모양이면 안 된다)
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const { 절단문서Section } = require('../tools/rot-check.js');
const 문서경로 = 'docs/_ops/심문_P0_소급불가_절단.md';

/* 🔴 기준 시각은 **현실적인 epoch** 여야 한다. 처음엔 1000·2000·3000 초(=1970년)로 짰는데
 *   git 의 `--since` 가 그 구간을 통째로 빈 결과로 돌려줘 **탐지 검사가 전부 0건**이었다.
 *   0 을 기대하는 검사(②③)는 그래도 초록이라, 픽스처 결함이 「검사 통과」로 보였다. */
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
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'cutdoc-'));
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

function 문서담기(메인, 시각, 본문 = '# 절단\n\n| 닫힘 | 남음 |\n') {
  fs.mkdirSync(path.join(메인, 'docs', '_ops'), { recursive: true });
  fs.writeFileSync(path.join(메인, 문서경로), 본문);
  git(메인, ['add', '--', 문서경로]);
  git(메인, ['commit', '-m', '절단문서 갱신', '--', 문서경로], 시각);
}

test('① 문서를 담은 뒤 형제가 ①-N 을 말하면 잡는다', (t) => {
  const { 메인, 형제 } = 판(t);
  문서담기(메인, T + 100);
  git(형제, ['commit', '--allow-empty', '-m', 'c9 생산자가 섰다 (①-2·①-12)'], T + 200);

  const r = 절단문서Section(메인);
  assert.equal(r.측정, true, '못 쟀다 — 형제 지목이나 문서 커밋 시각 읽기가 깨졌다');
  assert.equal(r.뒤.length, 1, `잡아야 할 커밋을 놓쳤다: ${JSON.stringify(r.뒤)}`);
  assert.match(r.뒤[0].제목, /①-2/);
  assert.equal(r.뒤[0].저장소, 'SYNK-talk', '어느 저장소인지 안 실으면 사람이 대조를 못 한다');
});

test('② 항목을 말하지 않는 커밋은 안 잡는다 (거짓양성)', (t) => {
  const { 메인, 형제 } = 판(t);
  문서담기(메인, T + 100);
  git(형제, ['commit', '--allow-empty', '-m', '아이콘 크기 조정'], T + 200);
  git(형제, ['commit', '--allow-empty', '-m', 'docs: 보드 — 트랙 종결 갱신'], T + 210);

  const r = 절단문서Section(메인);
  assert.equal(r.측정, true);
  assert.equal(r.뒤.length, 0, `엉뚱한 커밋을 잡는다: ${JSON.stringify(r.뒤)}`);
});

test('③ 문서 커밋과 **같은 초**의 형제 커밋은 「뒤」가 아니다 (--since 경계 포함)', (t) => {
  const { 메인, 형제 } = 판(t);
  문서담기(메인, T + 100);
  // 같은 초에 난 커밋 = 문서를 갱신하면서 함께 낸 것일 수 있다. 이걸 세면 갱신 직후에도 계속 운다.
  // 실측: `--since=@X` 는 X 초 커밋을 **포함한다**(그래서 +1 이 있다) — 이 줄이 그 근거다.
  git(형제, ['commit', '--allow-empty', '-m', '같은 초에 난 ①-3 커밋'], T + 100);

  const r = 절단문서Section(메인);
  assert.equal(r.측정, true);
  assert.equal(r.뒤.length, 0, '같은 초를 「뒤」로 센다 — 갱신해도 경고가 안 꺼진다(1초 밀기가 죽었다)');
});

test('④ 문서를 다시 담으면 조용해진다 — 처방을 따르면 꺼진다', (t) => {
  const { 메인, 형제 } = 판(t);
  문서담기(메인, T + 100);
  git(형제, ['commit', '--allow-empty', '-m', '①-12 를 닫았다'], T + 200);
  assert.equal(절단문서Section(메인).뒤.length, 1, '전제가 안 섰다');

  문서담기(메인, T + 300, '# 절단\n\n| 닫힘 | 남음 |\n| 12 | 0 |\n');
  assert.equal(절단문서Section(메인).뒤.length, 0, '갱신해도 계속 운다 — 따를 수 없는 처방이 된다(F103)');
});

test('⑤ 형제가 없으면 침묵이 아니라 **미측정**이다', (t) => {
  const { 메인 } = 판(t);
  문서담기(메인, T + 100);
  process.env.SYNK_OWNER_SIBLINGS = '../없는저장소';

  const r = 절단문서Section(메인);
  assert.equal(r.present, true);
  assert.equal(r.측정, false, '형제가 없는데 「쟀다」고 한다 — 0건이 통과처럼 보인다');
  assert.match(r.사유, /형제/);
});

test('⑥ 문서가 아예 없으면 부패가 아니다 (present:false · 사유를 지어내지 않는다)', (t) => {
  const { 메인 } = 판(t);
  const r = 절단문서Section(메인);
  assert.equal(r.present, false);
  assert.equal(r.측정, undefined, '없는 문서에 측정 판정을 붙이면 「미측정 경고」가 영원히 뜬다');
});

test('⑦ 미커밋 문서는 「못 읽었다」로 드러난다 (0건으로 접지 않는다)', (t) => {
  const { 메인 } = 판(t);
  git(메인, ['commit', '--allow-empty', '-m', '씨앗'], T);
  fs.mkdirSync(path.join(메인, 'docs', '_ops'), { recursive: true });
  fs.writeFileSync(path.join(메인, 문서경로), '# 아직 안 담김\n');

  const r = 절단문서Section(메인);
  assert.equal(r.present, true);
  assert.equal(r.측정, false, '커밋 시각이 없는데 쟀다고 한다 — 기준 없이 「뒤」를 계산하게 된다');
});
