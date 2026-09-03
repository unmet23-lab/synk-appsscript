// ───────────────────────────── 실행 C: 집필 → 비평 → 수리 ─────────────────────────────
const SYS = `${MAT}/통합.json`
const REP = (e) => `${MAT}/수리_${e}.json`

function writerPromptF() {
  return `${COMMON}
【과제】 유호님이 읽을 «정본 문서»를 집필해 ${OUT_DOC} 에 Write 로 저장한다. 마크다운. 한국어. 이 문서가 이번 일의 유일한 산출물이다 — 빠짐없이, 그러나 읽히게.
먼저 읽는다(전부): 통합 설계 ${SYS} · 엔진별 수리된 설계 ${ENGINES.map(REP).join(' · ')}(각 파일의 design 칸이 설계 본체 · change_log 는 수리 이력) · ${MAT}/철학.json · ${MAT}/횡단.json · ${MAT}/공통스택.json · ${MAT}/세계1등.json · 각 ${MAT}/<엔진>_정찰.json(출처 URL 을 문서에 실어야 하므로) · 문체 참조로 ${REPO}/docs/세층합류_설계_v1.md 의 머리 40줄과 ${REPO}/docs/Reed_설계_v0.1.md 의 §0 「한 장 요약(비개발자용)」.

문서 규격:
- 머리: HTML 주석 3줄(<!-- 정본: v1.0 --> · <!-- 파생: docs/SYNK_철학.md@v1.13 --> · 유호 지시 ${TODAY} 원문 「철학정본을 전부 훑어보고 지금 7종의 모든 엔진 시스템을 최신정보에 기반해서 한차원 업그레이드 된 시스템 설계로 발전시켜줘. 다시한번 말하지만 기회비용 생각하지 마」 + 제작 방법 한 줄(독해 9·정찰 9 → 설계 3안×7 → 심사 2×7 → 종합 7 → 통합 1 → 반박 4갈래×8 → 수리 → 재반박 2갈래×7 → 집필 → 완결 비평)).
- 제목: # 엔진 7종 상향 설계 v1 — «한 사람을 깊이 이해하는 시스템»이 한 차원 오르는 길
- > 상태 줄: 「유호님 채택 전 = 제안」 · 철학 대조 기준 v1.13 · 정찰 기준일 ${TODAY} · 「이 문서는 현행 정본(소개서 7벌·설계 정본들)을 대체하지 않고 그 «다음 판»을 제안한다 — 채택되면 각 정본이 제 절을 갱신하고 이 문서는 그 갱신을 잇는 색인으로 남는다」.
- §0 한 장 요약(비개발자용) — 장면으로 연다: 개원 첫 달 학생 한 명의 하루가 현행 대비 무엇이 달라지나(통합.json what_changes_for_student_day). 그 다음 «종류 변화» 한 줄씩 일곱(kind_before → kind_after). 그 다음 유호님이 정할 것 개수와 첫 걸음 셋.
- §1 자 — 이 설계가 통과한 자(철학에서 도출한 「한 차원 위」 여섯 축 · AI 두 배 · 대체불가 3문 · 승계 제약 · 정찰 게이트 3) 를 짧게. 정본 문구 인용.
- §2 세계 눈높이 — 2026-09 세계 최상이 하는 것과 우리가 못 하는 것·그들이 못 하는 것(세계1등.json · 출처 URL).
- §3 일곱을 한 시스템으로 — thesis · vertical_line_v2 · atlas_definition · shared_contracts(표) · conflicts_resolved · 철학 조항 중 주인 없던 자리가 누구에게 갔나.
- §4~§10 엔진별(Core·Loom·Vellum·Trail·Prism·Temper·Reed 순 · kicker 규약 「닿는 엔진 N호 / 쌓는 엔진 N호 / 무대층」): 한 문장 → 지금(독해 기준 «돈다/짓고 있다/없다») → 종류 변화 → 상향 항목(각 항목: 장면 → 구조 → 정찰 근거(출처·날짜) → 걷어내는 것 → 승계 제약 처리 → 대가(틀릴 때의 모습 + 닫을 것 하나) → 자(무엇으로 재나) → 효력 시점 → 닫히는 문) → 다른 엔진과의 입출력 → 하지 않는 것 → 순서 → 반박에서 살아남은 이력 한 줄(치명 몇·수리 몇·기각 몇).
- §11 순서 — engine_order 표(걸음·엔진·항목·왜 이 순서·닫히는 문). 「개원 전에만 되는 것」을 굵게.
- §12 유호님이 정할 것 — open_yuho_decisions 전량, 각각 질문·선택지·권고·왜 유호님만. 정지선 넷(돈·모델픽·소급불가·확정충돌)만 여기 온다 — 나머지는 내가 진행한다고 적는다.
- §13 걷어내는 것 — removed_list.
- §14 재는 자 — measures 표. 학생 0명이라 못 재는 것은 「첫 학생 뒤」.
- §15 정찰 장부 — 이번에 웹에서 확인한 것 전량(엔진별+공통+세계1등 findings 이름·날짜·URL·게이트 결과·효력 시점) + 기각 목록(이름·사유). 벤더 숫자는 가장 빨리 썩는 층이라 «측정일 붙은 사진»이라 적는다.
- §16 대가 — 이 설계 전체가 틀릴 때의 모습 셋과 각각 닫을 것.
- 문체: 결론 먼저 · 쉬운 낱말(어려운 낱말은 괄호로 풀이) · 한 문장 한 뜻 · 표는 넓으면 쪼갠다 · 없는 것을 있다고 안 쓴다(시제 §0) · 숫자엔 자·날짜 · 「0건」과 「안 재봤다」를 가른다. 유호님은 비개발자다 — 코드 이름은 꼭 필요한 자리에만.
- 길이 제한 없음. 빠짐이 죄다. 다만 같은 말을 두 번 하지 않는다.
- 저장 후 파일 크기(바이트)와 절 목록을 최종 텍스트로 낸다.`
}

function criticPromptF() {
  return `${COMMON}
【과제】 ${OUT_DOC} 를 «완결 비평»한다 — 유호님 원지시와 재료 대비 빠진 것·틀린 것·읽기 어려운 것.
읽는다: ${OUT_DOC}(전문) · ${SYS} · ${MAT}/철학.json · ${MAT}/횡단.json · ${MAT}/세계1등.json · ${MAT}/공통스택.json · 각 ${MAT}/<엔진>_정찰.json · 각 ${MAT}/수리_<엔진>.json(design 칸과 대조).
검사 축:
① 엔진 일곱이 전부 «종류 변화»로 서 있나(하나라도 기능 목록에 그쳤으면 missing).
② 철학 조항 전량(Ⅰ 한 문장·㉡㉢㉣·Ⅰ-1~9·Ⅱ-1~9·Ⅲ 요지·부록 C 1~7)이 어느 엔진 절에든 닿나 — 철학.json 의 clauses_no_engine_serves 가 문서에서 답을 받았나.
③ 정찰 finding 중 게이트를 지난 것이 문서에 빠졌나(정찰 장부 §15 대조 — 엔진 7 + 공통 + 세계1등 전부).
④ 수리된 설계(수리_<엔진>.json design)의 upgrades 가 문서에 빠짐없이 실렸나 · 유호님이 정할 것이 완성형(질문·선택지·권고)인가 · 정지선 넷 밖의 것이 거기 섞였나(그건 내가 진행할 것).
⑤ 시제 위반(없는 것을 있다고) · 숫자에 자·날짜 없음 · 「0건」과 「안 재봤다」 뭉갬.
⑥ 읽기: 비개발자 유호님이 §0 만 읽고 무엇이 달라지는지·무엇을 정해야 하는지 아나. 어려운 낱말·긴 문장·설명 없는 코드 이름.
⑦ 대가·닫을 것·자가 항목마다 있나.
verdict 는 치명적 빠짐이 하나라도 있으면 「수리 필요」.`
}

function fixDocPromptF(critic) {
  return `${COMMON}
【과제】 완결 비평을 받아 ${OUT_DOC} 를 «제자리에서» 수리한다(Edit/Write). 비평: ${JSON.stringify(critic)}
missing 은 재료(${MAT} — 통합.json · 수리_<엔진>.json · <엔진>_정찰.json 등)에서 찾아 채운다(재료에 없으면 「안 재봤다」로 적는다 · 지어내지 않는다). wrong 은 증거대로 고친다. hard_to_read 는 rewrite 대로 바꾼다.
끝나면 고친 자리 목록(절·무엇을)과 파일 크기(바이트)를 최종 텍스트로 낸다.`
}

log('집필 → 완결 비평 → 수리')
const written = await agent(writerPromptF(), { label: '집필:정본', phase: '집필', effort: 'max' })
let critic = await agent(criticPromptF(), { label: '비평:완결', phase: '집필', schema: CRITIC_SCHEMA, effort: 'high' })
const rounds = []
let n = 0
while (critic && critic.verdict === '수리 필요' && n < 3) {
  n += 1
  const fix = await agent(fixDocPromptF(critic), { label: `수리:정본${n}`, phase: '집필', effort: 'high' })
  rounds.push({ critic, fix })
  critic = await agent(criticPromptF(), { label: `비평:완결${n + 1}`, phase: '집필', schema: CRITIC_SCHEMA, effort: 'high' })
}
return { written, finalCritic: critic, rounds }
