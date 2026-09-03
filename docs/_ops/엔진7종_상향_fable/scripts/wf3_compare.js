export const meta = {
  name: 'engine7-model-compare',
  description: '엔진 7종 상향 설계 두 판(갑·을 · 눈가림)을 절마다 렌즈 셋으로 심사하고 종합·반박해 비교 보고서를 쓴다',
  phases: [
    { title: '심사', detail: '절 17 × 렌즈 3 — 사실·정합 / 철학·깊이 / 읽힘·결정' },
    { title: '종합', detail: '절 심사 51벌 + 기계 자 → 보고서 한 벌' },
    { title: '반박', detail: '보고서의 결론 셋을 근거로 되짚는다 → 수리' },
  ],
}

// args = { base, sections, measured, outReport }
//   base      = 비교 폴더(갑/ 을/ 재료_갑/ 재료_을/ 가 있다)
//   sections  = ['§0', …, '§16']
//   measured  = 기계 자(JSON · 에이전트 없이 잰 값)
//   outReport = 보고서 경로(.md)
const REPO = 'C:/Users/q1212/Documents/SYNK-appsscript'
const TALK = 'C:/Users/q1212/Documents/SYNK-talk'
const BASE = args.base
const SECTIONS = args.sections
const MEASURED = args.measured
const OUT = args.outReport

const COMMON = `
【공통 규칙】
- 오늘 2026-09-03 · 개원 2027-02-25 · 학생 0명 · 1인 창업(유호님 비개발자) · 몽골 UB. 저장소 ${REPO} · 앱 ${TALK}.
- 비교 대상 = «같은 재료·같은 스크립트»로 두 모델이 따로 쓴 설계 문서 두 판. 이름은 갑·을이고 어느 모델인지는 모른다 — 추측하지 말고 문서 자체만 본다.
- 두 판의 재료는 같다(${BASE}/재료_공통). 다른 것은 «Loom 수리»와 «통합 수리» 두 파일뿐이며 판마다 제 것이 있다(${BASE}/재료_갑 · ${BASE}/재료_을). 철학 정본 = ${REPO}/docs/SYNK_철학.md.
- 자 = 유호님이 세운 것: 시제 규약(없는 것을 있다고 쓰지 않는다) · 숫자엔 자·분모·날짜 · 「0건」과 「안 재봤다」를 가른다 · 낯선 낱말은 그 문장 안에서 뜻을 단다 · 결론 먼저 · 학생 화면에 수·분모·비율 금지(철학 Ⅱ-8) · 자산층 셋(Trail·Prism·Temper)은 읽기만 · 유호님이 정할 것은 정지선(돈·모델 픽·소급 불가·유호 확정 충돌)만 완성형(질문·선택지·권고·마감)으로.
- 출력은 다음 단계가 읽는 데이터다. 한국어. 서론 없이 스키마대로. 근거는 «인용문 + 어느 절·어느 문단»으로 — 줄번호 대신 문자열 앵커.
`

const AXES = [
  '①철학 정합(조항 인용이 정확한가 · 시제 규약을 지켰나)',
  '②실물 정확(문서가 「있다·없다·0건·코드 0」이라 말한 실물이 저장소와 맞나 — 이 절에서 표본 최소 5곳을 골라 grep/열어 확인)',
  '③한 차원 깊이(종류 변화가 섰나 · 항목마다 대가·자·닫히는 문·효력 시점이 있나 · 「AI 가 좋아질수록 커지는가」가 정직한가)',
  '④유호 판정 완성형(정지선에 걸리는 것만 올렸나 · 질문·선택지·권고·마감이 다 있나)',
  '⑤읽힘(비개발자가 읽는가 · 낯선 낱말이 그 자리에서 풀리나 · 문장 길이 · 표가 훑어지나)',
  '⑥내부 정합(수·이름·개수가 절 사이에서 어긋나지 않나)',
  '⑦빠짐(재료 대비 빠진 상향·조항·정찰이 있나)',
]

const LENSES = [
  { key: '사실정합', focus: '②실물 정확과 ⑥내부 정합이 네 중심이다. 저장소를 실제로 연다(grep · 파일 열기). 다른 축도 채점하되 근거는 짧게.', effort: 'high' },
  { key: '철학깊이', focus: '①철학 정합·③한 차원 깊이·⑦빠짐이 네 중심이다. 철학 정본과 재료(수리_<엔진>.json 의 design.upgrades · 통합.json)를 열어 대조한다. 다른 축도 채점하되 근거는 짧게.', effort: 'high' },
  { key: '읽힘결정', focus: '④유호 판정 완성형·⑤읽힘이 네 중심이다. 유호님(똑똑하지만 이 분야를 처음 보는 사람)이 이 절만 읽고 무엇이 달라지고 무엇을 정해야 하는지 아는가로 판정한다. 다른 축도 채점하되 근거는 짧게.', effort: 'high' },
]

const VERDICT_SCHEMA = {
  type: 'object',
  required: ['section', 'lens', 'axes', 'better', 'why', 'factual_errors', 'best_of_each'],
  properties: {
    section: { type: 'string' },
    lens: { type: 'string' },
    axes: {
      type: 'array',
      items: {
        type: 'object',
        required: ['axis', 'gap', 'eul', 'evidence_gap', 'evidence_eul'],
        properties: {
          axis: { type: 'string' },
          gap: { type: 'integer', minimum: 1, maximum: 5 },
          eul: { type: 'integer', minimum: 1, maximum: 5 },
          evidence_gap: { type: 'string' },
          evidence_eul: { type: 'string' },
        },
      },
    },
    better: { type: 'string', enum: ['갑', '을', '동점'] },
    why: { type: 'string' },
    factual_errors: {
      type: 'array',
      items: {
        type: 'object',
        required: ['doc', 'claim', 'evidence', 'verdict'],
        properties: {
          doc: { type: 'string', enum: ['갑', '을'] },
          claim: { type: 'string' },
          evidence: { type: 'string' },
          verdict: { type: 'string', enum: ['틀림', '맞음', '못 재봄'] },
        },
      },
    },
    best_of_each: { type: 'string', description: '합친다면 갑에서 가져올 것 · 을에서 가져올 것 — 항목 이름으로' },
  },
}

function judgePrompt(section, lens) {
  return `${COMMON}
【과제】 절 「${section}」을 두 판에서 읽고 렌즈 「${lens.key}」로 심사한다.
읽는다: ${BASE}/갑/${section}.md 와 ${BASE}/을/${section}.md (둘 다 전문). 필요하면 ${BASE}/갑/§0.md·${BASE}/을/§0.md(요약)와 재료를 연다.
${lens.focus}
축 일곱을 둘 다 1~5 로 채점한다(5 = 유호님이 세운 자를 다 지켰다 · 1 = 자를 어겼거나 비었다):
${AXES.map((a) => '- ' + a).join('\n')}
채점마다 근거를 «인용문 + 어디»로 적는다. 같은 재료를 썼으니 «무엇을 더 깊이·더 정확히·더 읽히게 썼나»가 갈림이다.
factual_errors 에는 이 절에서 네가 실제로 확인한 실물 주장(있다·없다·0건·숫자·파일·함수·계약 칸)을 판마다 최소 3개씩 넣고 verdict 를 단다(못 재본 것은 「못 재봄」).
better 는 축 합계가 아니라 «유호님이 이 절을 어느 판으로 읽어야 하나»로 정한다. section 칸에 「${section}」, lens 칸에 「${lens.key}」를 그대로 적는다.`
}

const SYNTH_SCHEMA = {
  type: 'object',
  required: ['verdict', 'top_claims', 'report_bytes'],
  properties: {
    verdict: { type: 'string', enum: ['갑', '을', '합친다'] },
    top_claims: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 5 },
    report_bytes: { type: 'integer' },
  },
}

function synthPrompt(verdictsRef) {
  return `${COMMON}
【과제】 절 심사 결과 전량과 기계 자를 합쳐 유호님이 읽을 비교 보고서를 ${OUT} 에 Write 로 저장한다(마크다운 · 한국어 · 결론 먼저 · 쉬운 낱말 · 낯선 낱말은 그 자리에 뜻).
심사 결과 = 파일 ${verdictsRef} (JSON 배열 · 절 17 × 렌즈 3 · 전부 읽는다 · 큰 파일이니 node 로 축·절별 평균을 먼저 뽑고 근거는 원문을 연다).
기계 자(에이전트 없이 잰 값): ${JSON.stringify(MEASURED)}
보고서 규격:
- 머리: 「두 판은 같은 재료·같은 절차로 두 모델이 따로 쓴 것 · 심사는 눈가림 · 어느 판이 어느 모델인지는 맨 끝에 붙는다(지금은 모른다)」.
- §0 결론 한 장: 어느 판을 정본으로 삼을지(갑/을/합친다) · 왜 · 합친다면 무엇을 어디서 가져오나(항목 이름).
- §1 축별 표: 축 일곱 × 갑·을 평균점(렌즈 셋 평균 · 소수 첫째) + 한 줄 근거.
- §2 절별 표: 절 17 × better(갑/을/동점) + 한 줄 이유.
- §3 실물 오류: 판마다 「틀림」 판정 목록 전량(주장 · 근거) + 개수 · 「못 재봄」 개수.
- §4 두 판의 «결» — 각 판이 잘하는 것·못하는 것을 장면으로(추상어 금지 · 인용으로).
- §5 기계 자 표(크기·판정 개수·「안 재봤다」 수·정찰 출처 수·문서 그래프·시간·토큰) — 수마다 자를 단다.
- §6 심사가 갈린 자리(렌즈 셋이 서로 다른 better 를 낸 절)와 그 까닭.
- §7 이 비교의 한계(눈가림이라 못 본 것 · 절 단위라 못 본 것 · 심사 모델 자체의 편향 가능성 — 심사 모델은 두 판 중 하나와 같은 모델이다).
저장 뒤 verdict · top_claims(보고서의 결론을 받치는 주장 3~5개 · 각각 «절·인용»으로 검증 가능하게) · report_bytes 를 낸다.`
}

const SKEPTIC_SCHEMA = {
  type: 'object',
  required: ['claims', 'overall'],
  properties: {
    claims: {
      type: 'array',
      items: {
        type: 'object',
        required: ['claim', 'refuted', 'evidence'],
        properties: { claim: { type: 'string' }, refuted: { type: 'boolean' }, evidence: { type: 'string' } },
      },
    },
    overall: { type: 'string', enum: ['결론 유지', '결론 흔들림'] },
  },
}

function skepticPrompt(synth) {
  return `${COMMON}
【과제】 비교 보고서 ${OUT} 의 결론을 «반박»한다. 기본값은 반박이다 — 확신이 없으면 refuted=true.
보고서의 핵심 주장: ${JSON.stringify(synth.top_claims)}
주장마다 보고서가 댄 근거 자리를 ${BASE}/갑/·${BASE}/을/ 에서 직접 열어 인용이 맞는지, 반대 사례가 같은 절에 있는지 본다. 실물 주장은 저장소를 연다.
overall 은 핵심 주장 중 절반 이상이 refuted 면 「결론 흔들림」.`
}

function fixPrompt(skeptic) {
  return `${COMMON}
【과제】 반박 결과를 받아 ${OUT} 를 제자리에서 수리한다(Edit). 반박: ${JSON.stringify(skeptic)}
refuted=true 인 주장은 근거를 고치거나 주장을 낮춘다(「안 재봤다」로). 결론이 흔들리면 §0 의 결론을 «합친다» 쪽으로 바꾸고 그 까닭을 적는다. 끝나면 고친 자리 목록을 낸다.`
}

// ───────────── 실행 — args.stage = 'judge' | 'synth' (두 런으로 가른다 · 한도에 걸려도 심사 결과가 파일로 남게) ─────────────
const STAGE = args.stage || 'judge'

if (STAGE === 'judge') {
  log(`심사 ${SECTIONS.length}절 × 렌즈 ${LENSES.length}`)
  const DONE = new Set(args.done || []) // 앞 런에서 이미 산 «절:렌즈» 짝은 건너뛴다(한도로 끊긴 뒤 빠진 것만 돌린다)
  const jobs = []
  for (const s of SECTIONS) for (const l of LENSES) if (!DONE.has(`${s}:${l.key}`)) jobs.push({ s, l })
  if (DONE.size) log(`건너뜀 ${DONE.size} · 돌릴 것 ${jobs.length}`)
  const verdicts = (await parallel(jobs.map(({ s, l }) => () =>
    agent(judgePrompt(s, l), { label: `심사:${s}:${l.key}`, phase: '심사', schema: VERDICT_SCHEMA, effort: l.effort })
  ))).filter(Boolean)
  log(`심사 ${verdicts.length}/${jobs.length}`)
  return { verdicts, missing: jobs.length - verdicts.length }
}

// stage === 'synth' — args.verdictsPath = 심사 결과 JSON 파일(본세션이 저널에서 뽑아 저장한 것)
phase('종합')
const synth = await agent(synthPrompt(args.verdictsPath), { label: '종합:보고서', phase: '종합', schema: SYNTH_SCHEMA, effort: 'max' })

phase('반박')
let skeptic = null
let fix = null
if (synth) {
  skeptic = await agent(skepticPrompt(synth), { label: '반박:결론', phase: '반박', schema: SKEPTIC_SCHEMA, effort: 'high' })
  if (skeptic && skeptic.claims.some((c) => c.refuted)) {
    fix = await agent(fixPrompt(skeptic), { label: '수리:보고서', phase: '반박', effort: 'high' })
  }
}
return { synth, skeptic, fix }
