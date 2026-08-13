/* 보안검토 과녁 회귀 — 「판단 층 게이트가 **내 것을 봤나**」 (마찰 F306).
 *
 * 실사고 2026-08-10: `/security-review` 가 내 변경이 아니라 옆 세션이 방금 커밋한 마크다운을
 * 읽고 판정하려 했다. 겉보기엔 정상 실행이었다(`git status` 절엔 내 파일이 보인다). 기계 검사는
 * 아는 패턴만 보니 **처음 보는 결함을 보는 층은 여기뿐**인데, 남의 문서를 읽고 나온 「취약점
 * 없음」이 내 코드의 검토 통과로 기록된다 — 미실행이 통과와 같은 모양으로 오는 F207 계열이고
 * 새는 방향은 언제나 「통과」다.
 *
 * 여기서 못박는 것 넷:
 *   ① **미실행과 0건을 가른다** — 보고서가 과녁을 하나도 안 말하면 종료 3(미실행)이지 0 이 아니다.
 *   ② **못 잼은 0건이 아니다**(F207) — git 을 못 부르면 `null`·종료 2 다. 통과로도 미실행으로도 안 접는다.
 *   ③ **과녁 0건은 미실행이 아니다** — 내보낼 바이트가 없으면 대조할 것이 없다. 여기서 적색을 내면
 *      정상 배포가 상시 막히고, 막힌 처방은 우회를 정상 통로로 만든다(F103).
 *   ④ **탐지력은 픽스처가 진다** — 실저장소엔 불변식(거짓양성 0)만 건다(가드 맹점 ②).
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const 과녁도구 = require(path.join(REPO, 'tools', '보안검토과녁.js'));
/* 자식은 **공용 통로**로 띄운다 — 직접 spawnSync 하면 「안 떴다」가 빈 출력이 되어
 * 통과를 기대하는 검사가 조용히 초록이 된다(`tests/훅통로.test.js` 가 옛 형태를 금지한다). */
const { 훅띄우기 } = require(path.join(REPO, 'tests', 'lib', '훅띄우기.js'));
const TOOL = path.join(REPO, 'tools', '보안검토과녁.js');

/** 이 파일이 재는 것은 **판정과 종료 코드**이지 배포집합 계산이 아니다(그건 배포판점검 몫).
 *  그래서 목록을 손으로 주고 **공개된 `언급했나` 하나만** 쓴다 — 판정 규칙(언급 ≥1 → 돌았다)을
 *  여기 다시 적으면 두 벌이 되므로, 그 규칙은 아래 CLI 종료 코드 검사가 진다. */
function 판정(보고서, 목록) {
  const 언급 = 목록.filter((f) => 과녁도구.언급했나(String(보고서 || ''), f));
  return { 언급, 미언급: 목록.filter((f) => !언급.includes(f)) };
}

/* ── ① 언급 판정 — 무엇을 「봤다」로 세나 ──────────────────────────── */

test('☠️ 경로로 언급하면 봤다 — 보고서가 쓰는 실제 표기다', () => {
  assert.ok(과녁도구.언급했나('DIFF CONTENT: docs/a.md 와 tools/lib/보드.js 를 읽었다', 'tools/lib/보드.js'));
});

test('☠️ **파일 이름만** 써도 봤다 — 좁게 틀리면 정상 검토가 「미실행」으로 나온다(거짓 적색이 배포를 막는다)', () => {
  /* ⚠ 과녁이 `Code.js` 처럼 최상위면 경로 == 이름이라 이 갈래를 **안 지난다** — 실측으로 갈렸다
   *   (변이 「경로만 본다」가 그 픽스처에서 살아남았다). 디렉터리가 있는 과녁이 진짜 경계다. */
  assert.ok(과녁도구.언급했나('`보드.js` 안의 정규식은 문제없다', 'tools/lib/보드.js'),
    '보고서가 이름만 써도 「봤다」로 세야 한다 — 거짓 적색은 배포를 막고, 막힌 처방은 우회를 부른다(F103)');
  assert.ok(과녁도구.언급했나('DIFF: tools/lib/보드.js', 'tools/lib/보드.js'));
});

test('☠️ F306 실사고 그대로 — 남의 마크다운만 든 보고서는 내 배포집합을 **하나도** 안 말한다', () => {
  /* 실측 본문의 모양: 내 대상은 unstaged 라 빠지고, 남이 방금 커밋한 인계문·보드가 들어왔다. */
  const 남의보고서 = [
    'DIFF CONTENT',
    ' docs/_ops/인계문/ed0a2064.md | 12 ++++',
    ' docs/_ops/보드/ed0a2064.md   |  3 +-',
    ' docs/세션보드_아카이브.md      |  5 +-',
    '결론: 취약점 없음.',
  ].join('\n');
  const r = 판정(남의보고서, ['Code.js', '엔진_두뇌.js', '상담AI.js']);
  assert.deepStrictEqual(r.언급, [], '🔴 남의 문서만 읽은 보고서를 「내 것을 봤다」로 셌다 — 미실행이 통과가 된다');
});

test('🔑 짧은 이름은 이름만으로 안 센다 — 3자 이하가 보고서 아무 데나 걸리면 미실행이 통과가 된다', () => {
  assert.ok(!과녁도구.언급했나('아무 상관 없는 문장 abc 가 있다', 'x/abc'));
});

/* ── ② 종료 코드 계약 — 미실행·못잼·통과를 CLI 가 갈라 낸다 ─────────── */

const 임시 = (내용) => {
  const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sec-target-')), 'report.md');
  fs.writeFileSync(p, 내용, 'utf8');
  return p;
};
/** 미커밋을 **못 재는** 뿌리 — git 저장소가 아닌 임시 디렉터리라 `git status` 가 죽는다.
 *  (이음매가 여기인 이유: `claspProjects()` 는 인자를 안 받아 자기 ROOT 를 본다 — 그 도구 머리말.) */
const 못재는뿌리 = () => fs.mkdtempSync(path.join(os.tmpdir(), 'sec-noroot-'));
const 돌리기 = (args, root) => 훅띄우기([TOOL, ...args], {
  encoding: 'utf8', 통과코드: [0, 1, 2, 3],
  env: { ...process.env, SYNK_REVIEW_ROOT: root },
});

test('☠️ 과녁을 **못 재면** 종료 2 — 「대상 0건」으로 접으면 미실행이 통과가 된다(F207)', () => {
  const r = 돌리기([], 못재는뿌리());
  assert.strictEqual(r.status, 과녁도구.코드.못잼, `못 잰 것을 다른 코드로 냈다:\n${r.stdout}${r.stderr}`);
  assert.match(r.stdout, /못 쟀다/);
  assert.doesNotMatch(r.stdout, /0건이 아니다\s*$/);   // 문구가 아니라 코드로 가른다는 계약의 짝
});

test('☠️ 대조에서도 못 재면 종료 2 — 보고서가 멀쩡해도 «내 것을 봤는지»는 판정 불가다', () => {
  const r = 돌리기(['--대조', 임시('전부 안전합니다.')], 못재는뿌리());
  assert.strictEqual(r.status, 과녁도구.코드.못잼);
  assert.doesNotMatch(r.stdout, /봤다/, '판정 불가를 「봤다」로 적으면 그게 F306 이 만든 그 기록이다');
});

test('☠️ 보고서를 **못 읽으면** 종료 2 — 없는 파일을 「통과」로도 「미실행」으로도 안 접는다', () => {
  const r = 돌리기(['--대조', path.join(os.tmpdir(), '없는보고서_' + process.pid + '.md')], REPO);
  assert.strictEqual(r.status, 과녁도구.코드.못잼);
});

test('🔑 `--대조` 에 경로를 안 주면 거절한다 — 인자 빠뜨림이 조용한 통과가 되지 않는다', () => {
  const r = 돌리기(['--대조'], REPO);
  assert.strictEqual(r.status, 1);
});

/** 과녁을 고정해 급소(미실행)를 CLI 끝까지 태운다 — 실저장소 미커밋은 옆 세션이 상시 바꾼다. */
const 고정돌리기 = (args, 과녁들) => 훅띄우기([TOOL, ...args], {
  encoding: 'utf8', 통과코드: [0, 1, 2, 3],
  env: { ...process.env, SYNK_REVIEW_ROOT: REPO, SYNK_REVIEW_TARGETS: 과녁들.join(',') },
});

test('☠️ [F306 급소] 보고서가 과녁을 하나도 안 말하면 종료 **3(미실행)** — 0(통과)이 아니다', () => {
  const 남의보고서 = 임시('DIFF CONTENT\n docs/_ops/인계문/ed0a2064.md | 12 ++++\n결론: 취약점 없음.');
  const r = 고정돌리기(['--대조', 남의보고서], ['Code.js', '엔진_두뇌.js', '상담AI.js']);
  assert.strictEqual(r.status, 과녁도구.코드.미실행,
    `🔴 남의 문서만 읽은 보고서가 통과로 나갔다 — 그 초록이 「보안 검토 통과」로 기록된다(F306)\n${r.stdout}`);
  assert.match(r.stdout, /미실행/, '왜 막혔는지 안 적으면 다음 세션이 「취약점 0건」으로 읽는다');
  assert.match(r.stdout, /Code\.js/, '무엇을 안 봤는지 안 보여주면 다시 부를 과녁을 못 만든다');
});

test('☠️ 하나라도 언급하면 종료 0 — 「돌았다」와 「꼼꼼했다」를 섞어 재지 않는다', () => {
  const r = 고정돌리기(['--대조', 임시('`Code.js` 의 리터럴은 문제없다.')], ['Code.js', '엔진_두뇌.js']);
  assert.strictEqual(r.status, 과녁도구.코드.통과);
  assert.match(r.stdout, /엔진_두뇌\.js/, '안 언급된 것을 조용히 넘기면 그 침묵이 「전부 봤다」로 읽힌다');
});

test('☠️ 이음매가 켜지면 **스스로 밝힌다** — 조용한 이음매는 곧 우회다', () => {
  const r = 고정돌리기([], ['Code.js']);
  assert.match(r.stdout, /고정됐다.*실측이 아니다/s,
    '🔴 고정 과녁으로 낸 초록이 실측처럼 보인다 — 이 도구가 없애려던 모양 그 자체다');
});

/* ── ③ 실저장소 — 불변식만(탐지력은 위 픽스처가 진다) ──────────────── */

test('☠️ 실저장소 거짓양성 — 과녁은 언제나 배포집합의 부분집합이다(검토할 파일을 지어내지 않는다)', () => {
  const 목록 = 과녁도구.과녁(REPO);
  if (목록 === null) return;   // 못 재는 판은 위 픽스처가 진다
  const 배포 = new Set(점검전체());
  for (const f of 목록) assert.ok(배포.has(f), `배포집합에 없는 파일을 검토 과녁으로 냈다: ${f}`);
});

test('☠️ 실저장소 거짓양성 — 과녁은 전부 **미커밋**이다(이미 커밋된 남의 바이트를 내 과녁으로 세지 않는다)', () => {
  const 목록 = 과녁도구.과녁(REPO);
  if (목록 === null) return;
  const 점검 = require(path.join(REPO, 'tools', '배포판점검.js'));
  const 미커밋 = 점검.미커밋집합(REPO);
  if (미커밋 === null) return;   // git 을 못 불렀다 — fail 아닌 skip 과 같다(F296)
  for (const f of 목록) assert.ok(미커밋.has(f), `커밋된 파일을 과녁으로 냈다: ${f} — F306 은 «남의 커밋을 읽은» 사고다`);
});

test('🔑 과녁 0건이면 CLI 가 **미실행이 아니라고** 말하고 0 으로 끝낸다 (F103 — 막힌 처방 금지)', () => {
  /* 배포집합은 읽히는데 미커밋이 0인 판을 실저장소로는 못 고정한다(옆 세션이 상시 더럽힌다).
   * 그래서 «분기 자체»를 순수부로 잰다 — 목록이 빈 배열이면 언급도 미언급도 0 이다. */
  const r = 판정('아무 보고서', []);
  assert.deepStrictEqual([r.언급, r.미언급], [[], []]);
});

function 점검전체() {
  const 점검 = require(path.join(REPO, 'tools', '배포판점검.js'));
  const out = new Set();
  for (const p of 점검.claspProjects(REPO)) for (const f of 점검.배포집합(p, REPO)) out.add(f);
  return [...out];
}
