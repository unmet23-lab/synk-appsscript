#!/usr/bin/env node
/**
 * session-decisions — 세션 시작에 **유호님이 답해야 풀리는 것**을 띄운다.
 *
 * 왜 있나 (2026-08-05 · 유호님 확정):
 *   유호님 질문 — "이 버그들을 잡는 게 3년 계획에 도움이 되나?"
 *   실측으로 답이 갈렸다: 마찰 101건 중 **79%가 AI 자기 살림 도구**에 대한 것이고
 *   유호님 사업 물건은 6%였다. 그런데 정작 3년 계획의 속도를 정하는 것은
 *   **유호님 답을 기다리는 미결 57건**이다(memory decision-queue-bottleneck).
 *   그 큐는 tools/decision-queue.js 가 이미 세고 있었는데 **헤르메스 텔레그램으로만 나갔다** —
 *   PC 앞에 앉은 세션 시작 화면에는 한 번도 안 떴다. 이 훅이 그 자리를 채운다.
 *
 * 유호님 지시 — 「도전안을 받아들이되 **그 뒤에도 수리할 것들도 같이** 나오게」:
 *   그래서 기존 startup 훅(rot-check·session-handoff·작업본소유자)을 **하나도 건드리지 않는다.**
 *   이 훅은 더하기만 한다. 수리 목록을 감추는 변경은 이 파일의 목적에 반한다.
 *
 * 설계:
 *   ① **읽기 전용** — decision-queue 의 원칙을 그대로 물려받는다. 메모리도 repo 도 쓰지 않는다.
 *   ② **판정을 두 곳에 적지 않는다** — 순위·회전·차단자 계산은 전부 tools/decision-queue.js 에서
 *      require 해 온다. 여기서 다시 구현하면 두 목록이 갈라진다(CLAUDE.md 신뢰성 4항).
 *   ③ **미실행이 「0건」처럼 보이면 안 된다** — 메모리 정본이 없는 환경(클라우드 세션·CI)에서는
 *      조용히 빈 출력을 내지 말고 **왜 못 셌는지**를 말한다. 통과와 미실행은 같은 모양이면 안 된다.
 *   ④ **매 세션 상주 비용** — 3건·각 2줄로 묶는다. 전체는 `node tools/decision-queue.js --all`.
 */
'use strict';

const MAX_LEN = 96;   // 터미널 한 줄로 읽히는 길이(텔레그램용 300자보다 짧게 — 매 세션 상주한다)
const COUNT = 3;

/** 한 줄로 접는다 — 개행·연속 공백을 없애고 길면 자른다 */
function oneLine(s, limit = MAX_LEN) {
  const flat = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  return flat.length > limit ? flat.slice(0, limit - 1) + '…' : flat;
}

/** 토픽 슬러그에서 꼬리 날짜를 떼 화면을 좁힌다 (print-doc-pipeline-2026-08-04 → print-doc-pipeline) */
function shortTopic(topic) {
  return String(topic || '').replace(/-\d{4}-\d{2}-\d{2}$/, '');
}

function main() {
  let q; let dq;
  try {
    // decision-queue 는 날문자 센티널(CODE_MARK)을 담고 있어 손 편집이 위험한 파일이다.
    // 여기서는 **읽기만** 한다 — 배선이 그 파일을 고치지 않아도 되도록 export 를 쓴다.
    dq = require('../../tools/decision-queue.js');
    q = dq.build({ count: COUNT });
  } catch (e) {
    // ③ 미실행을 침묵으로 위장하지 않는다. 단 세션 시작을 막지도 않는다(exit 0).
    process.stdout.write(`🗳 결정 큐를 못 셌다 — ${oneLine(e && e.message, 120)}\n`);
    return;
  }

  /* 폐기함 — [2026-08-07 · F173] 큐에서 **걸러진** ⏳ 건수. 오탐을 막는 필터가 미탐을 만드는데
   * 그 폐기함은 도구를 손으로 돌려야만 보였다: 헤르메스 잠금(보안) 제안이 (⏳) 표기 탓에
   * 지시어로 분류돼 이틀간 유호님께 한 번도 안 갔다. 문구는 tools/decision-queue.js 에서
   * 가져온다 — 여기서 다시 쓰면 두 목록이 갈라진다(이 훅의 원칙 ②). */
  let 경고 = '';
  try { 경고 = dq.버려진줄(q) || ''; } catch { /* 폐기함을 못 재도 일일 큐는 나가야 한다 */ }

  if (!q || !q.total) {
    /* 🔑 미결 0인데 걸러진 게 있으면 「없다」가 아니라 **「안 보인다」**다 —
     *    필터가 큐를 통째로 삼킨 사고가 「깨끗함」과 같은 모양이면 안 된다(render() 와 같은 판정). */
    process.stdout.write(`🗳 유호님 답 대기 0건 — 결정 큐가 비었습니다.${경고 ? `\n  ${경고}` : ''}\n`);
    return;
  }

  const out = [`🗳 유호님 답 대기 ${q.total}건 — 오늘 ${q.today.length}건 (전체: node tools/decision-queue.js --all)`];
  /* [경량 2차 · 유호 지시 08-13] 항목당 2줄 → 1줄 — 머리(토픽·⛔)와 본문을 한 줄에 붙인다.
   * 본문이 보여야 하는 계약(tests/결정큐훅.test.js)은 그대로다 — 줄 수만 줄었다. */
  q.today.forEach((it, i) => {
    const head = it.unblocks > 0
      ? `⛔ 이거 하나로 ${it.unblocks}건이 풀립니다 —`
      : `[${shortTopic(it.topic)}]`;
    out.push(`  ${i + 1}. ${head} ${oneLine(it.text)}`);
  });
  out.push('  답은 그냥 여기 쓰시면 됩니다 — 제가 읽고 반영합니다.');

  if (경고) out.push(`  ${경고}`);

  /* 주간 한 장 — **배달로는 큐가 안 준다. 닫아야 준다**(08-06 유호님 채택).
   * 하루 3건 회전은 노출일 뿐이라 회전 한 바퀴보다 새 항목이 빨리 쌓인다.
   * 여기서는 **알리기만** 한다 — 이 훅의 원칙 ①(읽기 전용)을 깨지 않는다. 발행은 도구가 한다. */
  try {
    const s = dq.한장밀림(new Date());
    if (s.밀림) {
      const 언제 = s.지난날 == null ? '아직 한 번도 안 나갔습니다' : `${s.지난날}일째 밀렸습니다`;
      out.push(`  📄 주간 한 장이 ${언제} — 유호님께 전량 ${q.total}건을 한 장으로 보여드리려면:`);
      out.push('     node tools/decision-queue.js --한장   (끝난 번호를 받으면 --닫음 3,7,12)');
    }
  } catch { /* 한 장을 못 재도 일일 큐는 나가야 한다 */ }

  /* 봉인 예측의 «채점 대기» — 이 훅에 붙이는 이유는 **방아쇠가 같기 때문**이다.
   * 채점할 것이 생기는 순간은 「유호님이 답해서 그 줄이 큐에서 빠졌을 때」이고, 그걸 아는
   * 자리가 바로 여기다. 안 붙이면 `docs/_ops/판정예측.jsonl` 은 아무도 안 여는 파일이 되고,
   * 그건 이 저장소가 반복해서 겪은 실패(⑨ 「자동으로 도는데 아무것도 안 바꿈」) 그 자체다.
   * ⚠ **0건이면 한 줄도 안 낸다** — 상시 뜨는 줄은 배경 소음이 되어 진짜가 섞여도 안 읽힌다.
   *   원칙 ①(읽기 전용)도 그대로다: 읽기만 하고 채점은 사람이 도구로 한다. */
  try {
    const 예측 = require('../../tools/판정예측.js');
    const 항목 = 예측.큐항목들();
    if (항목) {
      const 대기 = 예측.채점대기(예측.접기(예측.읽기()).목록, 항목.map((it) => it.지문));
      if (대기.length) {
        out.push(`  🔒 봉인 예측 ${대기.length}건이 **채점 대기**입니다 — 답이 왔거나 그 줄의 문구가 바뀌었습니다.`);
        out.push('     (제가 미리 적어 둔 답과 대조하는 자리입니다 · node tools/판정예측.js)');
      }
    }
  } catch { /* 예측 장부를 못 재도 일일 큐는 나가야 한다 */ }

  process.stdout.write(out.join('\n') + '\n');
}

if (require.main === module) main();
module.exports = { oneLine, shortTopic, MAX_LEN, COUNT };
