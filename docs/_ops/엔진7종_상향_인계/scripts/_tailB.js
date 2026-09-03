// ───────────────────────────── 실행 B: 통합 → 반박 → 수리 → 재반박 ─────────────────────────────
const SYN = (e) => `${MAT}/종합_${e}.json`
const engineMaterials = (e) => [`${MAT}/철학.json`, `${MAT}/횡단.json`, `${MAT}/${e}_독해.json`, `${MAT}/${e}_정찰.json`, SYN(e)]

function integratePromptF() {
  return `${COMMON}
【과제】 엔진 일곱의 종합 설계를 받아 «한 시스템»으로 통합한다 — 일곱이 따로 좋아지는 게 아니라 «한 사람을 깊이 이해하는 교육 시스템»이 한 차원 오르는 설계.
먼저 읽는다(전부): ${MAT}/철학.json(특히 vertical_line · one_dimension_up_definition · three_layers · clauses_no_engine_serves) · ${MAT}/횡단.json(계약·래칫·큐·유호 확정) · ${MAT}/세계1등.json · 그리고 일곱 종합 설계 ${ENGINES.map(SYN).join(' · ')}. 필요하면 ${REPO}/docs/관통왕복_명세.md · ${REPO}/docs/엔진도달_설계.md §5·§8 · ${REPO}/docs/엔진/SYNK_엔진_지도.html(텍스트 grep) 을 연다.
요구:
1. vertical_line_v2 — 1년차 목표 「㉡㉢ 엔진 도달 + 학생 한 명분 세로줄 1회 관통」을 «상향된» 형태로 다시 쓴다. 일곱이 각각 어느 칸을 맡는지.
2. shared_contracts — 두 엔진 이상이 쓰는 데이터·사건·스탬프를 이름·생산자·소비자·모양·까닭으로. 기존 계약(c14~c16 · 학습자상태 · 개입 스탬프 · 사건 출처)과 «새로 필요한 것»을 가른다. 자산층은 읽기만(자기 수집 통로 신설 금지).
3. conflicts_resolved — 일곱 설계가 서로 충돌하는 자리(같은 데이터를 두 엔진이 «소유» · 같은 판정을 두 자로 잼 · 학생 화면에 두 엔진이 동시에 닿음 · Reed 가 Atlas 에 기여하려 함 · 같은 정찰 항목을 두 엔진이 따로 반입 등)를 찾아 해소한다. 「한 값을 두 곳이 알면 갈린다」·「같은 판정을 두 자로 재면 어긋난다」가 자다.
4. engine_order — «문이 닫히는 순서»(소급 불가 · 개원 전에만 되는 것 · 첫 학생의 첫 주는 한 번뿐)가 먼저, 그 다음 세로줄 기여. 12~20 걸음.
5. atlas_definition — 상향된 SYNK Atlas(학생 한 명분 이해)가 «무엇으로» 이루어지고 어떻게 갱신·평가·돌려주기 되나.
6. what_changes_for_student_day — 개원 첫 달 학생 한 명의 하루 장면(현행 대비 달라지는 것만). what_changes_for_yuho — 유호님이 보는 것·누르는 칸(판단 자리 하나만 남는가).
7. measures — 「더 좋아졌다」를 재는 자 전량(이름·도구·분모). 학생 0명이라 못 재는 것은 「첫 학생 뒤」로 표시.
8. open_yuho_decisions — 일곱에서 올라온 것 + 통합에서 생긴 것. 완성형(질문·선택지·권고·왜 유호님만). 정지선 넷(돈·모델픽·소급불가·확정충돌) 밖의 것은 여기 넣지 않는다(그건 내가 진행한다).
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
evidence 는 파일:줄 · 정본 문구 · URL 중 하나를 반드시 댄다. fix 는 완성형(무엇을 무엇으로). refuted 의 item 은 설계 안의 upgrades[].name 또는 절 이름을 그대로 쓴다.`
}

function repairPromptF(engine, designRef, verdicts) {
  return `${COMMON}
【과제】 엔진 「${engine}」의 종합 설계를 반박 ${verdicts.length}벌로 수리한다.
먼저 ${MAT}/철학.json · ${MAT}/${engine}_독해.json · ${MAT}/${engine}_정찰.json 을 읽는다.
설계 = ${designRef}
반박: ${JSON.stringify(verdicts)}
규칙: 치명·중대는 전부 처리한다 — 고치거나(change_log) 근거를 대고 기각한다(rejected_refutations · 기각은 실물·정본 문구로만). 경미는 고칠 수 있으면 고친다. 고친 뒤에도 DESIGN_SCHEMA 전 칸이 채워져 있어야 한다(design 칸에 수리된 설계 «전체»를 낸다 — 바뀐 부분만 내지 않는다). 반박이 «실물이 없다»고 했으면 저장소를 열어 확인하고 그 결과를 change_log 에 적는다. lens 칸은 「종합·수리」.`
}

function repairSystemPromptF(system, verdicts) {
  return `${COMMON}
【과제】 일곱 통합 설계를 반박 ${verdicts.length}벌로 수리한다.
먼저 ${MAT}/철학.json · ${MAT}/횡단.json 을 읽는다.
통합 설계: ${JSON.stringify(system)}
반박: ${JSON.stringify(verdicts)}
규칙: 치명·중대는 전부 처리(고치거나 실물·정본 근거로 기각). 수리한 통합 설계를 SYSTEM_SCHEMA 그대로 낸다. 기각한 반박은 conflicts_resolved 끝에 「기각: …」 항목으로 남긴다.`
}

log('통합 — 일곱을 한 시스템으로')
let system = await agent(integratePromptF(), { label: '통합:7종', phase: '통합', schema: SYSTEM_SCHEMA, effort: 'max' })
if (!system) throw new Error('통합 실패')

log('반박 4갈래 × 엔진 7 → 수리 → 재반박 2갈래')
const repaired = await pipeline(
  ENGINES,
  (engine) => parallel(REFUTE_LENSES.map((lens) => () => agent(refutePromptF(`엔진 ${engine} 종합 설계`, lens, `${SYN(engine)} (파일을 열어 읽는다)`, engineMaterials(engine)), { label: `반박:${engine}:${lens.key.slice(0, 2)}`, phase: '반박', schema: VERDICT_SCHEMA, effort: 'high' }))).then((vs) => vs.filter(Boolean)),
  (verdicts, engine) => agent(repairPromptF(engine, `${SYN(engine)} (파일을 열어 읽는다)`, verdicts), { label: `수리:${engine}`, phase: '반박', schema: REPAIR_SCHEMA, effort: 'high' }).then((rep) => ({ rep, verdicts })),
  ({ rep, verdicts }, engine) => {
    if (!rep) return null
    return parallel([REFUTE_LENSES[0], REFUTE_LENSES[3]].map((lens) => () => agent(refutePromptF(`엔진 ${engine} 수리 설계(2차)`, lens, JSON.stringify(rep.design), engineMaterials(engine).slice(0, 4)), { label: `재반박:${engine}:${lens.key.slice(0, 2)}`, phase: '반박', schema: VERDICT_SCHEMA, effort: 'high' })))
      .then((vs2) => {
        const v = vs2.filter(Boolean)
        const fatal = v.flatMap((x) => x.refuted).filter((r) => r.severity === '치명')
        if (!fatal.length) return { ...rep, first_round: verdicts, second_round: v }
        return agent(repairPromptF(engine, JSON.stringify(rep.design), v), { label: `재수리:${engine}`, phase: '반박', schema: REPAIR_SCHEMA, effort: 'high' }).then((rep2) => rep2 ? { ...rep2, first_round: verdicts, second_round: v, second_repair: true } : { ...rep, first_round: verdicts, second_round: v })
      })
  },
)
const repairedOk = repaired.filter(Boolean)
log(`엔진 수리 완료 ${repairedOk.length}/7`)

log('통합 반박 4갈래 → 수리')
const sysVerdicts = (await parallel(REFUTE_LENSES.map((lens) => () => agent(refutePromptF('일곱 통합 설계', lens, JSON.stringify(system), [`${MAT}/철학.json`, `${MAT}/횡단.json`, `${MAT}/세계1등.json`, ...ENGINES.map(SYN)]), { label: `반박:통합:${lens.key.slice(0, 2)}`, phase: '반박', schema: VERDICT_SCHEMA, effort: 'high' })))).filter(Boolean)
const systemRepaired = await agent(repairSystemPromptF(system, sysVerdicts), { label: '수리:통합', phase: '반박', schema: SYSTEM_SCHEMA, effort: 'max' })
return { system: systemRepaired || system, systemBeforeRepair: system, sysVerdicts, repaired: repairedOk, missing: ENGINES.filter((e, i) => !repaired[i]) }
