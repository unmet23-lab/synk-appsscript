// ───────────────────────────── 실행 B2a-fill: 수리 7 ∥ 통합 반박 2(실현·확정) → 통합 수리(4벌) ─────────────────────────────
const SYN = (e) => `${MAT}/종합_${e}.json`
const VER = (e) => `${MAT}/반박_${e}.json`
const SYS0 = `${MAT}/통합_수리전.json`
const SYSV = `${MAT}/반박_통합.json`

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

function repairPromptF(engine, designRef, verdictsRef) {
  return `${COMMON}
【과제】 엔진 「${engine}」의 종합 설계를 반박으로 수리한다.
먼저 ${MAT}/철학.json · ${MAT}/${engine}_독해.json · ${MAT}/${engine}_정찰.json 을 읽는다.
설계 = ${designRef}
반박 = ${verdictsRef}
규칙: 치명·중대는 전부 처리한다 — 고치거나(change_log) 근거를 대고 기각한다(rejected_refutations · 기각은 실물·정본 문구로만). 경미는 고칠 수 있으면 고친다. 고친 뒤에도 DESIGN_SCHEMA 전 칸이 채워져 있어야 한다(design 칸에 수리된 설계 «전체»를 낸다 — 바뀐 부분만 내지 않는다). 반박이 «실물이 없다»고 했으면 저장소를 열어 확인하고 그 결과를 change_log 에 적는다. lens 칸은 「종합·수리」. engine 칸은 반드시 「${engine}」이라는 낱말을 포함한다.
⚠ 읽기는 필요한 만큼만, 답은 «반드시» 낸다 — 자료를 다 읽고 맨 끝에 한 번에 쓰는 방식은 중간에 끊기면 산출 0 이다. 반박 처리 표(change_log)를 먼저 세우고 design 을 조립한다.`
}

function repairSystemPromptF(newVerdicts) {
  return `${COMMON}
【과제】 일곱 통합 설계를 반박 4벌(파일 2벌 + 아래 2벌)로 수리한다.
먼저 ${MAT}/철학.json · ${MAT}/횡단.json · 통합 설계 ${SYS0} · 반박 2벌 ${SYSV}(배열 · 철학·차원 렌즈) 를 읽는다.
추가 반박 2벌(실현성·확정 렌즈): ${JSON.stringify(newVerdicts)}
규칙: 치명·중대는 전부 처리(고치거나 실물·정본 근거로 기각). 수리한 통합 설계를 SYSTEM_SCHEMA 그대로 «전체» 낸다. 기각한 반박은 conflicts_resolved 끝에 「기각: …」 항목으로 남긴다. ⚠ 답은 반드시 낸다 — 읽기를 마치는 즉시 조립을 시작한다.`
}

log('B2a-fill — 수리 7 ∥ 통합 반박 2 → 통합 수리(4벌)')
const repairs = parallel(ENGINES.map((engine) => () => agent(repairPromptF(engine, `${SYN(engine)} (파일을 열어 읽는다)`, `${VER(engine)} (파일을 열어 읽는다 · 배열 4벌)`), { label: `수리:${engine}`, phase: '반박', schema: REPAIR_SCHEMA, effort: 'high' })))
const systemWork = parallel([REFUTE_LENSES[1], REFUTE_LENSES[3]].map((lens) => () => agent(refutePromptF('일곱 통합 설계', lens, `${SYS0} (파일을 열어 읽는다)`, [`${MAT}/철학.json`, `${MAT}/횡단.json`, `${MAT}/세계1등.json`, ...ENGINES.map(SYN)]), { label: `반박:통합:${lens.key.slice(0, 2)}`, phase: '반박', schema: VERDICT_SCHEMA, effort: 'high' })))
  .then((vs) => vs.filter(Boolean))
  .then((newVerdicts) => agent(repairSystemPromptF(newVerdicts), { label: '수리:통합', phase: '반박', schema: SYSTEM_SCHEMA, effort: 'max' }).then((sys) => ({ sys, newVerdicts })))
const [reps, sysOut] = await Promise.all([repairs, systemWork])
const ok = reps.filter(Boolean)
log(`엔진 수리 ${ok.length}/7 · 통합 반박 ${sysOut ? sysOut.newVerdicts.length : 0}/2 · 통합 수리 ${sysOut && sysOut.sys ? 1 : 0}`)
return { repaired: ok, system: sysOut ? sysOut.sys : null, newVerdicts: sysOut ? sysOut.newVerdicts : [], missing: ENGINES.filter((e, i) => !reps[i]) }
