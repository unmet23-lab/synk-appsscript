// ───────────────────────────── 실행 B1-fill: 통합 1 + 빠진 반박 15 ─────────────────────────────
const SYN = (e) => `${MAT}/종합_${e}.json`
const engineMaterials = (e) => [`${MAT}/철학.json`, `${MAT}/횡단.json`, `${MAT}/${e}_독해.json`, `${MAT}/${e}_정찰.json`, SYN(e)]
const MISSING = { Trail: ['실현성', '차원', '확정·실물 낡음'], Prism: ['철학 충돌', '실현성', '차원', '확정·실물 낡음'], Temper: ['철학 충돌', '실현성', '차원', '확정·실물 낡음'], Reed: ['철학 충돌', '실현성', '차원', '확정·실물 낡음'] }

function integratePromptF() {
  return `${COMMON}
【과제】 엔진 일곱의 종합 설계를 받아 «한 시스템»으로 통합한다 — 일곱이 따로 좋아지는 게 아니라 «한 사람을 깊이 이해하는 교육 시스템»이 한 차원 오르는 설계.
먼저 읽는다(전부): ${MAT}/철학.json(특히 vertical_line · one_dimension_up_definition · three_layers · clauses_no_engine_serves) · ${MAT}/횡단.json(계약·래칫·큐·유호 확정) · ${MAT}/세계1등.json · 그리고 일곱 종합 설계 ${ENGINES.map(SYN).join(' · ')}. 필요하면 ${REPO}/docs/관통왕복_명세.md · ${REPO}/docs/엔진도달_설계.md §5·§8 · ${REPO}/docs/엔진/SYNK_엔진_지도.html(텍스트 grep) 을 연다.
요구:
1. vertical_line_v2 — 1년차 목표 「㉡㉢ 엔진 도달 + 학생 한 명분 세로줄 1회 관통」을 «상향된» 형태로 다시 쓴다. 일곱이 각각 어느 칸을 맡는지.
2. shared_contracts — 두 엔진 이상이 쓰는 데이터·사건·스탬프를 이름·생산자·소비자·모양·까닭으로. 기존 계약(c14~c16 · 학습자상태 · 개입 스탬프 · 사건 출처)과 «새로 필요한 것»을 가른다. 자산층은 읽기만(자기 수집 통로 신설 금지).
3. conflicts_resolved — 일곱 설계가 서로 충돌하는 자리(같은 데이터를 두 엔진이 «소유» · 같은 판정을 두 자로 잼 · 학생 화면에 두 엔진이 동시에 닿음 · Reed 가 Atlas 에 기여하려 함 · 같은 정찰 항목을 두 엔진이 따로 반입 · 계약 판올림을 여럿이 따로 요구 등)를 찾아 해소한다. 「한 값을 두 곳이 알면 갈린다」·「같은 판정을 두 자로 재면 어긋난다」가 자다.
4. engine_order — «문이 닫히는 순서»(소급 불가 · 개원 전에만 되는 것 · 첫 학생의 첫 주는 한 번뿐)가 먼저, 그 다음 세로줄 기여. 12~20 걸음.
5. atlas_definition — 상향된 SYNK Atlas(학생 한 명분 이해)가 «무엇으로» 이루어지고 어떻게 갱신·평가·돌려주기 되나.
6. what_changes_for_student_day — 개원 첫 달 학생 한 명의 하루 장면(현행 대비 달라지는 것만). what_changes_for_yuho — 유호님이 보는 것·누르는 칸(판단 자리 하나만 남는가).
7. measures — 「더 좋아졌다」를 재는 자 전량(이름·도구·분모). 학생 0명이라 못 재는 것은 「첫 학생 뒤」로 표시.
8. open_yuho_decisions — 일곱에서 올라온 것 + 통합에서 생긴 것. 완성형(질문·선택지·권고·왜 유호님만). 정지선 넷(돈·모델픽·소급불가·확정충돌) 밖의 것은 여기 넣지 않는다(그건 내가 진행한다). 같은 질문이 여러 엔진에서 올라왔으면 하나로 합친다.
9. removed_list — 걷어내는 옛것 전량.
10. 철학.json 의 clauses_no_engine_serves 항목마다 «어느 엔진이 이제 맡는가»를 conflicts_resolved 또는 vertical_line_v2 안에 이름으로 답한다.`
}

function refutePromptF(target, lens, designRef, files) {
  return `${COMMON}
【과제】 아래 설계를 «반박»한다. 기본값은 반박이다 — 확신이 없으면 refuted 에 넣고 severity 를 낮춘다. 살릴 것은 kept 에 이름만.
대상: ${target}
${lens.prompt}
먼저 읽는다(전부): ${files.join(' · ')}
반박할 설계 = ${designRef}
severity 기준: 치명 = 철학 정면 위반 · 소급 불가를 놓침 · 없는 실물을 있다고 씀 · 유호 확정을 조용히 뒤집음 · 지을 수 없음. 중대 = 고치면 되지만 지금 형태로는 틀림. 경미 = 문구·순서.
evidence 는 파일:줄 · 정본 문구 · URL 중 하나를 반드시 댄다. fix 는 완성형(무엇을 무엇으로). refuted 의 item 은 설계 안의 upgrades[].name 또는 절 이름을 그대로 쓴다. target 칸에는 반드시 「${target}」을 그대로 적는다.`
}

log('B1-fill — 통합 1 + 빠진 반박 15 (동시)')
const jobs = [
  () => agent(integratePromptF(), { label: '통합:7종', phase: '통합', schema: SYSTEM_SCHEMA, effort: 'max' }),
  ...ENGINES.flatMap((engine) => REFUTE_LENSES.filter((lens) => MISSING[engine] && MISSING[engine].includes(lens.key)).map((lens) => () => agent(refutePromptF(`엔진 ${engine} 종합 설계`, lens, `${SYN(engine)} (파일을 열어 읽는다)`, engineMaterials(engine)), { label: `반박:${engine}:${lens.key.slice(0, 2)}`, phase: '반박', schema: VERDICT_SCHEMA, effort: 'high' }))),
]
const out = await parallel(jobs)
const system = out[0]
const verdicts = out.slice(1).filter(Boolean)
log(`통합 ${system ? 1 : 0} · 반박 ${verdicts.length}/15`)
return { system, verdicts }
