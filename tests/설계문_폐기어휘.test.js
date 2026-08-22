/* 상태기반 과제선택 설계문 — «폐기 어휘 잔존» 가드 · 2026-08-13 신설 (세션 local_34297acc).
 *
 * 왜: 이 설계문은 5판 연속 적대 심문에서 떨어졌고, **v5 낙방 46갈래 중 12가 «한 동작»에서 나왔다** —
 *   새 절을 얹고 그 값을 쓰는 «형제 절»을 안 걷은 것(처분표 v5 §3 머리말). §3-5-b 를 새로 쓰고
 *   §3-5·§3-6·§12-13·§15-D 에 옛 어휘(`generation_claims`·`시도`·`landed`·`포기`)를 남겼고,
 *   §7-2 를 고치고 §4·§11-3 의 `출처` 값을 남겼다.
 *   그리고 v5.2 집행 중에도 **같은 형태가 한 건 더** 나왔다: §13 에 「🚫 claim 회수에서 펜싱토큰을
 *   안 올리기」가 그대로 남아 새 §3-5-b 의 A5 처방(회수는 펜싱을 «안» 올린다)과 정면으로 반대였다.
 *   ⇒ **같은 절차에서 2번째 = 실수가 아니라 시스템 결함**(CLAUDE.md 신뢰성). 처방으로 남긴 규율
 *   (「한 절을 고치면 형제 절을 전수 grep」)은 «프로즈»라 사람이 그날 기억해야 한다. 여기서 기계가 진다.
 *
 * 무엇을 지키나:
 *   ① 폐기된 식별자·상태 이름이 설계문에 **«살아 있는 서술»로** 남아 있지 않다.
 *      — 역사·철회·금지 표기가 붙은 줄은 통과시킨다(과거를 지우는 것이 목적이 아니다).
 *   ② 대체어가 실제로 본문에 서 있다 — 폐기어만 지우고 새 이름을 안 넣은 「빈 자리」를 막는다.
 *
 * 탐지력은 **픽스처로 못박는다** — 실저장소가 초록이어도 「잡을 수 있는 눈」인지는 가짜 입력으로
 * 증명한다(가드의 두 맹점 ②: 버그가 아직 있길 요구하는 회귀 금지 · CLAUDE.md).
 * 설계문이 없거나 못 읽으면 **fail 이 아니라 skip** 으로 드러낸다(F296: repo 밖·부재를 적색으로 위장 금지).
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const 설계문 = path.join(ROOT, 'docs', '상태기반_과제선택_설계.md');

/** 폐기어 → 그 자리를 대신하는 현행 이름. 한 곳에서만 관리한다(두 목록은 갈라진다 · F080). */
const 폐기어휘 = {
  generation_claims: 'generation_jobs',
  펜싱토큰: 'fence',
  jobs_적재: 'jobs_load',
  jobs_집기: 'jobs_claim',
  job_종료: 'jobs_finalize',
  배정사건_id: 'assigned_event_id',
  요청본문칸: 'request_body',
};

/**
 * 그 줄이 «역사·철회·금지»를 말하고 있나 — 그런 줄의 폐기어는 정상이다.
 * (폐기 사실을 적으려면 폐기어를 쓸 수밖에 없다.)
 */
const 역사표기 = /역사|걷었다|걷어|철회|폐기|되돌리기|되살리|옛 어휘|대체|아니었다|v5\.2|🚫/;

/** 코드펜스 밖·안을 가리지 않고 줄 단위로 훑는다(DDL 안에 남은 폐기어도 잡아야 한다). */
function 살아있는잔존(본문) {
  const 걸린것 = [];
  본문.split('\n').forEach((줄, i) => {
    if (역사표기.test(줄)) return;
    for (const 낱말 of Object.keys(폐기어휘)) {
      if (줄.includes(낱말)) 걸린것.push({ 줄번호: i + 1, 낱말, 본문: 줄.trim().slice(0, 90) });
    }
  });
  return 걸린것;
}

test('픽스처 — 폐기 어휘가 «살아 있는 서술»이면 잡는다 (탐지력 증명)', () => {
  const 가짜 = [
    '# 가짜 설계문',
    '- 실행 장부 `engine.generation_claims` 에 대기 행을 적는다.', // ← 잡혀야 한다
    '- 워커가 `job_종료` 를 부르면 착지한다.', // ← 잡혀야 한다
  ].join('\n');

  const 걸린것 = 살아있는잔존(가짜);
  assert.equal(걸린것.length, 2, '살아 있는 폐기어 2건을 잡아야 한다');
  assert.deepEqual(
    걸린것.map((x) => x.낱말).sort(),
    ['generation_claims', 'job_종료'],
  );
});

test('픽스처 — 역사·철회 표기가 붙은 줄은 통과시킨다 (거짓양성 0)', () => {
  const 가짜 = [
    '🔴 v5.2(A1) — 여기 있던 `generation_claims` 칸 표를 «걷었다».',
    '| D | 예약이 멱등을 안 준다 | §3-5 ⚠ **(v5 에서 대체 — 역사)** |',
    '🚫 `generation_claims` 한 표로 되돌리기.',
  ].join('\n');

  assert.deepEqual(살아있는잔존(가짜), [], '역사·금지 표기가 붙은 줄은 잡으면 안 된다');
});

test('실저장소 — 설계문에 살아 있는 폐기 어휘가 0건이다', (t) => {
  if (!fs.existsSync(설계문)) {
    t.skip('설계문이 없다 — 부재를 적색으로 위장하지 않는다(F296)');
    return;
  }
  const 본문 = fs.readFileSync(설계문, 'utf8');
  const 걸린것 = 살아있는잔존(본문);
  assert.deepEqual(
    걸린것,
    [],
    '폐기 어휘가 살아 있는 서술로 남았다 — 형제 절 미수거다:\n' +
      걸린것.map((x) => `  줄 ${x.줄번호}: ${x.낱말} → ${x.본문}`).join('\n'),
  );
});

test('실저장소 — 대체어가 실제로 본문에 서 있다 (빈 자리 방지)', (t) => {
  if (!fs.existsSync(설계문)) {
    t.skip('설계문이 없다 — 부재를 적색으로 위장하지 않는다(F296)');
    return;
  }
  const 본문 = fs.readFileSync(설계문, 'utf8');
  const 없는것 = [...new Set(Object.values(폐기어휘))].filter((대체어) => !본문.includes(대체어));
  assert.deepEqual(없는것, [], `폐기어만 지우고 대체어가 안 선 자리가 있다: ${없는것.join(', ')}`);
});
