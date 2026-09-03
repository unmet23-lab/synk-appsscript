// ───────────────────────────── 실행 B2b: 재반박 2갈래 × 7 → 치명 남으면 재수리 (파일 기반) ─────────────────────────────
const REPF = (e) => `${MAT}/수리_${e}.json`
const engineMaterials = (e) => [`${MAT}/철학.json`, `${MAT}/횡단.json`, `${MAT}/${e}_독해.json`, `${MAT}/${e}_정찰.json`]

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
【과제】 엔진 「${engine}」의 수리 설계를 2차 반박으로 다시 수리한다.
먼저 ${MAT}/철학.json · ${MAT}/${engine}_독해.json · ${MAT}/${engine}_정찰.json 을 읽는다.
설계 = ${designRef}
반박 = ${verdictsRef}
규칙: 치명·중대는 전부 처리한다 — 고치거나(change_log) 근거를 대고 기각한다(rejected_refutations · 기각은 실물·정본 문구로만). 경미는 고칠 수 있으면 고친다. 고친 뒤에도 DESIGN_SCHEMA 전 칸이 채워져 있어야 한다(design 칸에 수리된 설계 «전체»를 낸다 — 바뀐 부분만 내지 않는다). 앞선 change_log 는 그대로 잇고 새 항목을 뒤에 붙인다. lens 칸은 「종합·수리·2차」. engine 칸은 반드시 「${engine}」이라는 낱말을 포함한다.`
}

log('B2b — 재반박 2갈래 × 7 → 치명 남으면 재수리')
const out = await pipeline(
  ENGINES,
  (engine) => parallel([REFUTE_LENSES[0], REFUTE_LENSES[3]].map((lens) => () => agent(refutePromptF(`엔진 ${engine} 수리 설계(2차)`, lens, `${REPF(engine)} 의 design 칸 (파일을 열어 읽는다 · change_log 는 수리 이력)`, engineMaterials(engine)), { label: `재반박:${engine}:${lens.key.slice(0, 2)}`, phase: '반박', schema: VERDICT_SCHEMA, effort: 'high' }))).then((vs) => vs.filter(Boolean)),
  (v, engine) => {
    const fatal = v.flatMap((x) => x.refuted).filter((r) => r.severity === '치명')
    if (!fatal.length) return { engine, second_round: v, second_repair: false }
    return agent(repairPromptF(engine, `${REPF(engine)} 의 design 칸 (파일을 열어 읽는다)`, JSON.stringify(v)), { label: `재수리:${engine}`, phase: '반박', schema: REPAIR_SCHEMA, effort: 'high' }).then((rep2) => ({ engine, second_round: v, second_repair: !!rep2, rep2 }))
  },
)
const ok = out.filter(Boolean)
log(`재반박 완료 ${ok.length}/7 · 재수리 ${ok.filter((x) => x.second_repair).length}`)
return { rounds: ok, missing: ENGINES.filter((e, i) => !out[i]) }
