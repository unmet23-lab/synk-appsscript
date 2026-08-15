/* 도장을 «찍는» 층의 회귀 — 잰 사람이 그 자리에서 남기는가 (마찰 F482 · 대기열 #Q97).
 *
 * ■ 실사고 2026-08-15 (같은 시각·같은 트리에서 두 갈래로 쟀다)
 *   `배포판점검 --라이브` = 「(루트): 라이브 = 저장소 @HEAD · 배포집합 16개 **바이트 동일** · 미커밋 0」
 *   그 **직후** `작업본소유자 --hook` = 「🚀 커밋 27개 사이에 배포 파일 **5개**가 바뀌었다」.
 *   바이트로 잰 층이 0인데 커밋으로 잰 층이 5다. 원인 두 겹:
 *     ㉠ 기준선이 «채번 커밋»이라, 한 판번호 안에서 배포 파일을 고친 **뒤 커밋**들은 실제로
 *        밀렸어도 영원히 「안 나갔다」로 남는다. 정상 순서가 채번→커밋→push→clasp 라 이 자리는
 *        예외가 아니라 기본값이다.
 *     ㉡ 그 거짓양성을 재우는 도장을 **만드는 자리가 `rot-check`(하루 1회·네트워크) 하나**였다.
 *        그래서 경보가 인쇄해 주는 처방(`--라이브`)을 그대로 돌려 초록을 받아도 도장이 안 남고,
 *        다음 세션에 같은 🔴 가 뜬다 — 따를 수 없는 경보는 우회를 정상 통로로 만든다(F103).
 *   유호님 판정(08-15 「승인할게」): 감시자가 더 자주 재게 하는 것이 아니라 **라이브를 방금 민
 *   사람이 그 자리에서 남긴다.** 이 파일은 그 배선을 못박는다.
 *
 * ■ 왜 픽스처인가 (가드 맹점 ② — 탐지력은 픽스처가 진다)
 *   이 갈래가 서려면 「배포 파일이 채번 뒤에 바뀌었고 라이브는 그것까지 실었다」는 상태를 연출해야
 *   한다. 실저장소는 배포 직후면 어차피 초록이고 옆 세션이 상시 커밋해 그날 운에 걸린다.
 *
 * ■ 이 회귀의 대가 (새 장치엔 대가를 적는다)
 *   · 틀릴 때의 모습 = **git 을 못 부르는 판에서 통째로 skip**(F296). 그 자리를 글자로 남긴다.
 *   · 새는 방향 = 이 배선이 과하게 재우면 **거짓음성**(진짜 미배포가 조용해짐)이라, 「초록이
 *     아닐 때는 안 재운다」·「안 잰 것을 초록으로 접지 않는다」를 각각 따로 건다(③④).
 *   · 닫을 것 = **없다.** 새 경보가 아니라 이미 있는 `가라앉힘` 통로에 «쓰는 자리»를 붙인 것이라
 *     끌 대상이 없다. `배포기준선.test.js` 는 도장을 **손으로** 찍어 읽는 층을 재고, 이 파일은
 *     그 도장이 **실제로 찍히는가**를 잰다 — 겹치지 않는다.
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const 점검 = require(path.join(REPO, 'tools', '배포판점검.js'));

function git(dir, args, 날짜) {
  const env = { ...process.env };
  if (날짜) { env.GIT_AUTHOR_DATE = 날짜; env.GIT_COMMITTER_DATE = 날짜; }
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] });
}
const 날 = (d) => `2026-01-0${d}T12:00:00+09:00`;
const ms = (d) => Date.parse(날(d));

/**
 * **F482 그대로**: 채번은 c0 하나뿐이고, 그 «뒤»에 배포 파일이 바뀌었다(c1).
 * 라이브는 c1 까지 실려 있다 — 즉 안 나간 변경은 실제로 0인데, 채번 기준선으로 재면 1건이 나온다.
 */
function 픽스처() {
  const 뿌리 = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'synk-도장-')));
  git(뿌리, ['init', '-b', 'master']);
  git(뿌리, ['config', 'user.email', 'test@synk.local']);
  git(뿌리, ['config', 'user.name', 'test']);
  git(뿌리, ['config', 'commit.gpgsign', 'false']);

  const 쓰기 = (f, s) => fs.writeFileSync(path.join(뿌리, f), s, 'utf8');
  쓰기('Code.js', "const SYNK_VERSION = 'v9.241';\n");
  쓰기('엔진.js', 'function a() { return 1; }\n');
  git(뿌리, ['add', '--', 'Code.js', '엔진.js']);
  git(뿌리, ['commit', '-m', '[v9.241] 채번'], 날(1));

  /* 🔑 급소 — 같은 판번호 안에서 배포 파일이 또 바뀐다(채번 없음). 실제 사고의 `8bee7db1` 자리다. */
  쓰기('엔진.js', 'function a() { return 2; }\n');
  git(뿌리, ['add', '--', '엔진.js']);
  git(뿌리, ['commit', '-m', '[v9.241] 후속 수리 — 이 판까지 라이브에 실렸다'], 날(2));

  /* ⚠ 상태 파일은 **프로젝트 밖**에 둔다 — `*.json` 이 기본 배포 대상이라, 뿌리 안에 두면
   *   도장을 찍는 행위 자체가 배포집합 지문을 바꿔 놓는다(재는 층이 값을 깨뜨리는 자리 · 첫 판이
   *   실제로 그렇게 빨갰다). 실운영에서는 rot-check 상태가 애초에 저장소 밖이라 안 나는 일이다. */
  const 상태집 = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'synk-도장상태-')));
  return { 뿌리, 상태파일: path.join(상태집, 'rot-state.json') };
}

/** git 이 없는 판은 fail 이 아니라 **skip** 이다 — 안 잰 것을 통과로 세지 않는다(F296). */
function 준비(t) {
  try { return 픽스처(); } catch (e) { t.skip(`git 을 못 돌린다(${e.code || e.message}) — 이 축은 안 쟀다`); return null; }
}

/** 상태 파일 경로를 갈아 끼우고 돌린다(`SYNK_ROT_STATE` = rot-check 의 공용 통로). */
function 상태로(상태파일, fn) {
  const 옛 = process.env.SYNK_ROT_STATE;
  process.env.SYNK_ROT_STATE = 상태파일;
  try { return fn(); }
  finally { if (옛 === undefined) delete process.env.SYNK_ROT_STATE; else process.env.SYNK_ROT_STATE = 옛; }
}

/** `--라이브` CLI 가 하는 그대로 — 잰 결과에 실측을 접어 도장을 찍는다. */
function 잰다(F, { level = 'ok', 측정 = true } = {}) {
  const r = { 이름: '(루트)', level, 측정, 라이브판: null };
  return 상태로(F.상태파일, () => 점검.도장찍기(
    [{ ...r, 실측: 점검.실측접기(r, F.뿌리, F.뿌리) }], { now: ms(3) },
  ));
}

const 재기 = (F) => 상태로(F.상태파일, () => 점검.안나간변경(F.뿌리, [F.뿌리]));

/* ── ① 급소 — 잰 자리에서 찍으면 그 경보가 실제로 꺼진다 ─────────────────── */

test('☠️ [F482 급소] 채번 «뒤»에 바뀐 배포 파일 — 초록을 잰 자리에서 도장을 찍으면 가라앉는다', (t) => {
  const F = 준비(t); if (!F) return;

  /* 분모 먼저 — 도장이 없으면 이 층은 채번에 견줘 「안 나갔다」 1건을 낸다.
   * ⚠ 이 줄은 「버그가 남아 있어야 한다」는 요구가 아니다: 아래 가라앉힘이 **무엇을 재웠는지**
   *   말하려면 재우기 전 값이 있어야 한다(0 은 분모와 함께 · 유호 확정 08-14). */
  const 전 = 재기(F);
  assert.strictEqual(전.기준선[0].종류, '채번', '도장이 없으면 기준선은 채번이다');
  assert.deepStrictEqual(전.프로젝트들.map((p) => p.파일들).flat(), ['엔진.js']);
  assert.strictEqual(전.가라앉힘.length, 0, '도장이 없는데 무언가를 재웠다면 그 침묵은 근거가 없다');

  const s = 잰다(F);
  assert.deepStrictEqual({ 찍음: s.찍음, 전체: s.전체 }, { 찍음: 1, 전체: 1 },
    `🔴 잰 자리에서 도장이 안 남았다(${s.사유 || '사유 없음'}) — 경보가 자기 처방으로 안 꺼진다(F482)`);

  const 후 = 재기(F);
  assert.strictEqual(후.프로젝트들.length, 0,
    '🔴 초록을 바이트로 재고 도장까지 찍었는데 여전히 🚀 를 낸다 — 따를 수 없는 경보는 무시가 습관이 된다(F103)');
  assert.strictEqual(후.가라앉힘.length, 1,
    '조용히 지우면 안 된다 — 재운 것은 **구조로** 남아야 「이게 전부」로 안 읽힌다');
});

test('☠️ 배포 파일이 그 뒤 바뀌면 도장이 **다시 깨어난다** — 지문이 급소다(거짓음성 방지)', (t) => {
  const F = 준비(t); if (!F) return;
  잰다(F);
  assert.strictEqual(재기(F).프로젝트들.length, 0, '도장 직후엔 조용하다');

  fs.writeFileSync(path.join(F.뿌리, '엔진.js'), 'function a() { return 3; }\n', 'utf8');
  assert.strictEqual(재기(F).프로젝트들.length, 1,
    '🔴 도장을 찍은 뒤 배포 파일이 바뀌었는데도 조용하다 — 시각만 남기고 지문을 안 보면 거짓음성이 된다');
});

/* ── ② 함정 — 남의 시각을 갱신하지 않는다 ─────────────────────────────── */

test('☠️ [함정] 도장은 «배포실측» 키만 병합한다 — 최상위 `at` 을 건드리면 그날 부패 점검이 통째로 건너뛰어진다', (t) => {
  const F = 준비(t); if (!F) return;
  /* rot-check 의 최상위 `at` 은 「부패 점검이 돈 시각」이다. 여기서 갱신하면 그 하루가 조용히
   * 사라지는데, 사라진 모습이 「오늘 이미 돌았다」라 **맞는 얼굴로 틀린 값**이 된다(맹점 ④). */
  const 옛상태 = { at: '2026-01-01T00:00:00.000Z', mem: { ok: true }, 장부: { 판: 3 } };
  fs.writeFileSync(F.상태파일, JSON.stringify(옛상태), 'utf8');

  잰다(F);

  const 새 = JSON.parse(fs.readFileSync(F.상태파일, 'utf8'));
  assert.strictEqual(새.at, 옛상태.at, '🔴 최상위 `at` 을 갱신했다 — 그날 rot-check 이 통째로 안 돈다');
  assert.deepStrictEqual(새.mem, 옛상태.mem, '🔴 남의 절 상태를 덮었다 — 이 함수는 자기 키 하나만 만진다');
  assert.deepStrictEqual(새.장부, 옛상태.장부, '🔴 남의 절 상태를 덮었다');
  assert.ok(새[점검.도장키] && 새[점검.도장키].프로젝트들['(루트)'], '정작 자기 키는 안 썼다');
  assert.strictEqual(새[점검.도장키].at, ms(3), '도장 «자신»의 시각은 찍은 때다 — 이 값이 「채번보다 나중인가」 판정 재료다');
});

test('🔑 상태 파일이 아예 없으면 `at` 없이 쓴다 — rot-check 은 그것을 「안 돌았다」로 읽어 **도는 쪽**으로 떨어진다', (t) => {
  const F = 준비(t); if (!F) return;
  assert.ok(!fs.existsSync(F.상태파일));
  잰다(F);
  const 새 = JSON.parse(fs.readFileSync(F.상태파일, 'utf8'));
  assert.strictEqual(새.at, undefined, '없던 `at` 을 지어내면 부패 점검을 하루 건너뛰게 만든다 — 막히는 방향이 안전한 방향이다');
});

/* ── ③④ 안 재우는 자리 — 새는 방향은 「초록」이다 ────────────────────── */

test('☠️ 초록이 아니면(=라이브가 뒤처졌으면) 안 재운다 — 재우면 진짜 미배포가 조용해진다', (t) => {
  const F = 준비(t); if (!F) return;
  잰다(F, { level: 'stale' });
  const r = 재기(F);
  assert.strictEqual(r.가라앉힘.length, 0, '🔴 뒤처진 판의 도장이 경보를 재웠다 — 거짓음성이고, 이 장치가 고치려는 병의 반대편이다');
  assert.strictEqual(r.프로젝트들.length, 1, '경보는 그대로 서 있어야 한다');
});

test('☠️ **안 잰 것**을 초록으로 접지 않는다 — `측정: false`(고정 배포 없음)는 초록이 아니다', (t) => {
  const F = 준비(t); if (!F) return;
  /* `점검()` 은 고정 배포가 없는 프로젝트에서 `level:'ok' · 측정:false` 를 낸다(=「안 쟀다」).
   * 그 둘을 한 칸으로 접으면 **한 번도 라이브를 안 본 판정이 경보를 영구히 재운다**(F207). */
  const 실측 = 점검.실측접기({ level: 'ok', 측정: false, 라이브판: null }, F.뿌리, F.뿌리);
  assert.strictEqual(실측.초록, false, '🔴 안 잰 것을 초록으로 적었다 — 0 을 분모 없이 통과로 세는 그 자리다');
  잰다(F, { 측정: false });
  assert.strictEqual(재기(F).가라앉힘.length, 0);
});

test('🔑 지문을 못 잰 프로젝트는 도장에 **안 남는다** — 0 을 분모와 함께 낸다', () => {
  const s = 점검.도장찍기([{ 이름: '(없는것)', 실측: { 지문: null, 초록: true, 라이브판: null } }], { now: ms(3) });
  assert.deepStrictEqual({ 찍음: s.찍음, 전체: s.전체 }, { 찍음: 0, 전체: 1 });
  assert.match(String(s.사유 || ''), /지문/, '왜 0인지 안 말하면 「찍었는데 안 재웠다」와 구분이 안 된다');
});

/* ── ⑤ 등록층 — 스스로 발화하지 않는 장치는 안 돈다 ──────────────────────
 * 🔑 위 검사들은 `도장찍기()` 를 **직접** 부른다. 그러니 라이브를 실제로 재는 통로가 그것을
 *   안 부르면 이 장치는 운영에서 통째로 안 도는데 회귀는 전부 초록이다(CLAUDE.md 신뢰성).
 * ⚠ 한계: CLI 를 실제로 띄우려면 `clasp pull`(네트워크)이 돌아 CI 에서 못 쓴다. 그래서 이 두
 *   검사는 **배선이 소스·문서에 있는가**까지만 진다 — 그 이상은 위 ①이 함수 층에서 이미 졌다. */

test('☠️ CLI 의 `--라이브` 갈래가 도장을 찍는다 — 잰 자리와 남기는 자리가 갈리면 F482 가 그대로 산다', () => {
  const src = fs.readFileSync(path.join(REPO, 'tools', '배포판점검.js'), 'utf8');
  const 본문 = src.slice(src.indexOf('if (require.main === module)'));
  assert.ok(본문.includes('도장찍기('), '🔴 CLI 가 도장을 안 찍는다 — 사람이 처방을 따라도 다음 세션에 같은 🔴 가 뜬다');
  assert.ok(/if\s*\(라이브\)/.test(본문), '🔴 라이브를 안 잰 갈래에서도 찍으면 **안 본 것**을 도장으로 남기게 된다');
});

test('☠️ /deploy 가 `--라이브` 로 부른다 — 배포한 자가 그 자리에서 찍는다(유호 승인 08-15)', () => {
  const skill = fs.readFileSync(path.join(REPO, '.claude', 'skills', 'deploy', 'SKILL.md'), 'utf8');
  assert.match(skill, /배포판점검\.js --라이브/,
    '🔴 배포 절차가 `--라이브` 없이 부른다 — 그 갈래는 라이브를 읽지도, 도장을 남기지도 않는다');
});
