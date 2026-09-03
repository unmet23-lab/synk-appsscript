// ───────────────────────────── 실행 A2: 빠진 심사·종합만 (파일 기반) ─────────────────────────────
const DES = (e) => `${MAT}/설계_${e}.json`
const JUD = (e) => `${MAT}/심사_${e}.json`
const TODO = [
  { engine: 'Loom', judgeAngle: null },
  { engine: 'Prism', judgeAngle: '실현성·명품·세로줄 기여 우선' },
  { engine: 'Temper', judgeAngle: '철학 정합·차원 변화 우선' },
  { engine: 'Reed', judgeAngle: '철학 정합·차원 변화 우선' },
]

function judgePromptF(engine, angle) {
  return `${COMMON}
【과제】 엔진 「${engine}」의 독립 설계 3안을 심사한다. 심사 각도: ${angle}
먼저 ${MAT}/철학.json · ${MAT}/${engine}_독해.json 을 읽고, 설계 3안은 ${DES(engine)} (배열 · 같은 lens 가 둘이면 upgrades 가 더 완전한 쪽만 심사한다) 를 연다.
채점(각 0~10): philosophy_fit(철학 정합 — ㉡㉢㉣·게이트·관찰/판정 분리·자산층 3규칙) · dimension_up(기능 더미가 아니라 종류 변화인가) · ai_scales(AI 두 배 시험) · feasible_solo_remote(1인·원격·램16GB·학생 0·개원까지 6개월) · craft(재료의 급·자기설명·누구에게=학생) · vertical_line(세로줄 기여) · cost_named(대가·닫을 것·자를 적었나). total = 합.
winner 를 고르고, 나머지 두 안에서 «이식할 것»을 graft 에, 어느 안이든 «치명 결함»(철학 정면 위반 · 소급 불가를 놓침 · 없는 실물을 있다고 씀 · 유호 확정을 조용히 뒤집음)을 fatal_flaws 에 적는다. 점수 근거는 note 에 한 줄.`
}

function synthPromptF(engine, extraJudge) {
  return `${COMMON}
【과제】 엔진 「${engine}」의 설계 3안과 심사 2벌을 받아 «하나의 설계»로 종합한다.
먼저 ${MAT}/철학.json · ${MAT}/${engine}_독해.json · ${MAT}/${engine}_정찰.json 을 읽는다.
설계 3안 = ${DES(engine)} (배열 · 같은 lens 가 둘이면 upgrades 가 더 완전한 쪽을 쓴다) · 심사 = ${JUD(engine)} (배열)${extraJudge ? ' + 아래 추가 심사 1벌' : ''}.
${extraJudge ? '추가 심사: ' + JSON.stringify(extraJudge) : ''}
규칙: 승자 안을 뼈대로, graft 는 전부 옮겨 심되 중복은 합친다. fatal_flaws 는 전부 고친다(고칠 수 없으면 뺀다). upgrades 는 5~9 개로 정리하고 각 항목의 필수 칸(정찰 출처·걷어낼 것·제약 처리·대가·닫을 것·자·효력 시점·닫히는 문)을 빠짐없이 채운다. lens 칸에는 「종합」이라 적고 어느 렌즈에서 무엇을 가져왔는지 thesis 뒤에 괄호로 적는다. engine 칸은 반드시 「${engine}」이라는 낱말을 포함한다.`
}

log('A2 — 빠진 심사 3 + 종합 4')
const results = await pipeline(
  TODO,
  (t) => t.judgeAngle ? agent(judgePromptF(t.engine, t.judgeAngle), { label: `심사:${t.engine}:보충`, phase: '심사', schema: JUDGE_SCHEMA, effort: 'high' }) : Promise.resolve(null),
  (extraJudge, t) => agent(synthPromptF(t.engine, extraJudge), { label: `종합:${t.engine}`, phase: '심사', schema: DESIGN_SCHEMA, effort: 'high' }).then((s) => ({ engine: t.engine, synth: s, extraJudge })),
)
const ok = results.filter(Boolean).filter((r) => r.synth)
log(`A2 종합 완료 ${ok.length}/4`)
return { synths: ok.map((r) => r.synth), extraJudges: ok.map((r) => ({ engine: r.engine, judge: r.extraJudge })), missing: TODO.map((t) => t.engine).filter((e, i) => !results[i] || !results[i].synth) }
