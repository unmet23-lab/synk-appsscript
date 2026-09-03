export const meta = {
  name: 'engine7-b2-repair',
  description: '엔진 7종 상향 설계 B2단 — 수리 7 → 재반박 → 재수리 · 통합 반박 4 → 통합 수리 (반박_*.json·통합_수리전.json 을 읽는다)',
  phases: [
    { title: '설계', detail: '엔진별 렌즈 셋으로 독립 설계 3안' },
    { title: '심사', detail: '심사 2 + 종합 1 (엔진별)' },
    { title: '통합', detail: '일곱을 한 시스템으로 — 세로줄·계약·순서' },
    { title: '반박', detail: '철학·실현·차원·확정 네 렌즈 반박 → 수리 → 재반박' },
    { title: '집필', detail: '정본 문서 집필 → 완결 비평 → 수리' },
  ],
}

const REPO = 'C:/Users/q1212/Documents/SYNK-appsscript'
const TALK = 'C:/Users/q1212/Documents/SYNK-talk'
const MEM = 'C:/Users/q1212/.claude/projects/C--Users-q1212-Documents-SYNK-appsscript/memory'
const MAT = args && args.materialsDir ? args.materialsDir : 'C:/Users/q1212/Documents/SYNK-appsscript/docs/_ops/엔진7종_상향_인계/재료'
const OUT_DOC = args && args.outDoc ? args.outDoc : `${REPO}/docs/엔진7종_상향설계_v1.md`
const TODAY = '2026-09-02'
const ENGINES = ['Core', 'Loom', 'Vellum', 'Trail', 'Prism', 'Temper', 'Reed']
const ENGINE_LINE = {
  Core: '닿는 셋 1호 — 학습 엔진·회사의 뇌(수집→계약→추론) · 제품 = SYNK Atlas',
  Loom: '닿는 셋 2호 — 그래픽·재질(펠트 굽기·부품·율·재질·배치 판단층·살아있는 재질·Patina)',
  Vellum: '닿는 셋 3호 — 학생에게 닿는 면(가이드 셋·3축 캐릭터·함께한 날·Amber)',
  Trail: '쌓는 셋 1호 — 궤적(목표했고 어디 도착했나 · 명예 졸업생 카드)',
  Prism: '쌓는 셋 2호 — 대조(학생 하나의 교정 → 몽골어 화자 일반 분포)',
  Temper: '쌓는 셋 3호 — 처방(개입→효과 짝 · 가르치는 법)',
  Reed: '무대층 — 라디오24·자습 소리(배움이 일어나는 자리)',
}

const COMMON = `
【공통 규칙】
- 오늘 ${TODAY} · 개원 2027-02-25 · 학생 0명 · 1인 창업(유호님 비개발자) · 몽골 UB · AI(나)가 원격으로 짓고 검증한다 · 노트북 램 16GB · Arc B390.
- 저장소 ${REPO} · 앱 ${TALK} · 기억 ${MEM}. 실물이 궁금하면 파일을 연다(큰 파일은 grep/offset).
- 재료 폴더 = ${MAT} (JSON): 철학.json(자·게이트·금지·조항 배분·「한 차원 위」 정의) · 횡단.json(유호 확정·엔진 사이 갭·큐·계약·래칫) · 공통스택.json(2026-09 AI 스택 정찰) · 세계1등.json(세계 최상 대조) · <엔진>_독해.json(현행 설계 지도) · <엔진>_정찰.json(엔진별 최신 정찰). 재료에 없는 것은 「안 재봤다」로 적고 지어내지 않는다.
- 유호님 원지시: 「철학정본을 전부 훑어보고 지금 7종의 모든 엔진 시스템을 최신정보에 기반해서 «한 차원 업그레이드 된 시스템 설계»로 발전시켜줘. 기회비용 생각하지 마.」 ⇒ 기회비용·매몰비용·「지금 바쁘다」는 기각 사유가 아니다. 정지선 넷(돈·모델픽·소급불가·유호 확정 충돌)도 기각 사유가 아니라 «유호님께 요청할 자리»로 적는다.
- 「한 차원 위」 = 기능 개수가 아니라 엔진의 «종류»가 바뀌는 것. 자 셋: ①AI 가 두 배 똑똑해지면 같이 좋아지는가(철학 Ⅰ-2) ②대체불가 3문(모델이 두 배 똑똑해지면 커지나 · 돈으로 살 수 있나 · 우리 말고 누가) ③「선생님의 뇌」의 재료는 학생이 «한 것»(말한 것이 아니라).
- 승계할 제약: 철학 ㉡(사람 손 안 늘림) ㉢(학생에게 «보이는» 비교 금지) ㉣(식별자 밖으로 안 나감) · Ⅰ-4 관찰=시스템/판정=사람(실시간 자동 판정 금지 — 목표 가까워졌나) · 자산층 3규칙(자기 수집 통로 신설 금지 · 학생 화면 직접 안 닿음 · 분모 없는 숫자 금지) · 🚫의 «기술적 이유»(미래정보 누출·데이터 오염·검증 불가·낙인 고착·소급 불가)는 형태로 푼다.
- 시제 규약(철학 §0): 없는 것을 있다고 쓰지 않는다 — 「짓는다/지을 것이다」.
- 출력은 다음 단계 에이전트가 읽는 데이터다. 한국어. 서론 없이 스키마대로.
`

const UPGRADE_ITEM = {
  type: 'object',
  required: ['name', 'what', 'why_one_dimension_up', 'serves_clauses', 'scouting_used', 'removes', 'constraint_handling', 'ai_scales', 'remote_buildable', 'cost', 'failure_mode', 'one_thing_to_close', 'effect_timing', 'closing_door', 'measure'],
  properties: {
    name: { type: 'string' },
    what: { type: 'string', description: '무엇을 어떻게 짓나 — 장면으로 열고(학생/강사/유호님이 무엇을 보나) 구조로 닫는다(입력·출력·저장·읽는 부품)' },
    why_one_dimension_up: { type: 'string' },
    serves_clauses: { type: 'array', items: { type: 'string' }, description: '철학 조항 이름(Ⅰ-2 · Ⅱ-8 · ㉡ …)' },
    scouting_used: { type: 'array', items: { type: 'string' }, description: '정찰 finding 이름 + 출처 URL (없으면 빈 배열)' },
    removes: { type: 'string', description: '이것이 대체하는 옛것의 이름 · 없으면 «없음(빈 칸)»' },
    constraint_handling: { type: 'string', description: '승계 제약(㉡㉢㉣·관찰/판정·자산층 3규칙·🚫 기술 이유)을 어떻게 형태로 풀었나' },
    ai_scales: { type: 'boolean' },
    remote_buildable: { type: 'boolean' },
    cost: { type: 'string' },
    failure_mode: { type: 'string' },
    one_thing_to_close: { type: 'string' },
    effect_timing: { type: 'string', enum: ['now', 'before_opening', 'after_first_students', 'later'] },
    closing_door: { type: 'string', description: '지금 안 하면 영영 못 갖는 것(소급 불가)이 있으면 그것 · 없으면 «없음»' },
    measure: { type: 'string', description: '더 좋아졌음을 재는 자(무엇을·어디서·분모)' },
    yuho_decision_needed: { type: 'string', description: '정지선에 걸리면 유호님께 물을 완성형 질문(값·선택지·권고) · 없으면 «없음»' },
  },
}

const DESIGN_SCHEMA = {
  type: 'object',
  required: ['engine', 'lens', 'thesis', 'kind_before', 'kind_after', 'architecture', 'upgrades', 'vertical_line_contribution', 'io_with_other_engines', 'what_not_to_do', 'build_order', 'open_yuho_decisions'],
  properties: {
    engine: { type: 'string' },
    lens: { type: 'string' },
    thesis: { type: 'string', description: '한 문장 — 이 엔진의 종류가 무엇에서 무엇으로 바뀌나' },
    kind_before: { type: 'string' },
    kind_after: { type: 'string' },
    architecture: { type: 'object', required: ['layers', 'inputs', 'outputs', 'stores'], properties: { layers: { type: 'array', items: { type: 'string' } }, inputs: { type: 'array', items: { type: 'string' } }, outputs: { type: 'array', items: { type: 'string' } }, stores: { type: 'array', items: { type: 'string' } } } },
    upgrades: { type: 'array', items: UPGRADE_ITEM, minItems: 3 },
    vertical_line_contribution: { type: 'string' },
    io_with_other_engines: { type: 'array', items: { type: 'object', required: ['engine', 'gives', 'takes'], properties: { engine: { type: 'string' }, gives: { type: 'string' }, takes: { type: 'string' } } } },
    what_not_to_do: { type: 'array', items: { type: 'string' } },
    build_order: { type: 'array', items: { type: 'string' }, description: '문이 닫히는 순서(소급 불가 먼저) → 세로줄 기여 순' },
    open_yuho_decisions: { type: 'array', items: { type: 'string' } },
  },
}

const JUDGE_SCHEMA = {
  type: 'object',
  required: ['engine', 'scores', 'winner', 'graft', 'fatal_flaws'],
  properties: {
    engine: { type: 'string' },
    scores: { type: 'array', items: { type: 'object', required: ['lens', 'philosophy_fit', 'dimension_up', 'ai_scales', 'feasible_solo_remote', 'craft', 'vertical_line', 'cost_named', 'total', 'note'], properties: { lens: { type: 'string' }, philosophy_fit: { type: 'number' }, dimension_up: { type: 'number' }, ai_scales: { type: 'number' }, feasible_solo_remote: { type: 'number' }, craft: { type: 'number' }, vertical_line: { type: 'number' }, cost_named: { type: 'number' }, total: { type: 'number' }, note: { type: 'string' } } } },
    winner: { type: 'string' },
    graft: { type: 'array', items: { type: 'object', required: ['from_lens', 'item', 'why'], properties: { from_lens: { type: 'string' }, item: { type: 'string' }, why: { type: 'string' } } } },
    fatal_flaws: { type: 'array', items: { type: 'object', required: ['lens', 'item', 'why'], properties: { lens: { type: 'string' }, item: { type: 'string' }, why: { type: 'string' } } } },
  },
}

const SYSTEM_SCHEMA = {
  type: 'object',
  required: ['thesis', 'vertical_line_v2', 'shared_contracts', 'conflicts_resolved', 'engine_order', 'atlas_definition', 'what_changes_for_student_day', 'what_changes_for_yuho', 'measures', 'open_yuho_decisions', 'removed_list'],
  properties: {
    thesis: { type: 'string', description: '일곱이 한 시스템으로 «한 차원 위»가 된다는 것을 한 문장으로' },
    vertical_line_v2: { type: 'string', description: '상향된 세로줄 — 오늘의 오답(㉠)+집중(㉡)+원하는 것(㉢)→한 판정→다음 과제가 달라진다→30일 뒤 효과 짝 … 을 일곱이 어떻게 나눠 맡나' },
    shared_contracts: { type: 'array', items: { type: 'object', required: ['name', 'producer', 'consumers', 'shape', 'why'], properties: { name: { type: 'string' }, producer: { type: 'string' }, consumers: { type: 'array', items: { type: 'string' } }, shape: { type: 'string' }, why: { type: 'string' } } } },
    conflicts_resolved: { type: 'array', items: { type: 'object', required: ['conflict', 'between', 'resolution'], properties: { conflict: { type: 'string' }, between: { type: 'string' }, resolution: { type: 'string' } } } },
    engine_order: { type: 'array', items: { type: 'object', required: ['step', 'engine', 'item', 'why_this_order', 'closing_door'], properties: { step: { type: 'number' }, engine: { type: 'string' }, item: { type: 'string' }, why_this_order: { type: 'string' }, closing_door: { type: 'string' } } } },
    atlas_definition: { type: 'string', description: '상향된 SYNK Atlas — 학생 한 명분 이해가 «무엇으로» 이루어지고 어떻게 갱신·평가·돌려주기 되나' },
    what_changes_for_student_day: { type: 'string', description: '장면 — 개원 첫 달 학생 한 명의 하루가 현행 대비 무엇이 달라지나' },
    what_changes_for_yuho: { type: 'string' },
    measures: { type: 'array', items: { type: 'object', required: ['name', 'instrument', 'denominator'], properties: { name: { type: 'string' }, instrument: { type: 'string' }, denominator: { type: 'string' } } } },
    open_yuho_decisions: { type: 'array', items: { type: 'object', required: ['question', 'options', 'recommendation', 'why_only_yuho'], properties: { question: { type: 'string' }, options: { type: 'array', items: { type: 'string' } }, recommendation: { type: 'string' }, why_only_yuho: { type: 'string' } } } },
    removed_list: { type: 'array', items: { type: 'string' }, description: '이 설계가 걷어내는 옛것 전량(대체는 걷어내기까지가 한 벌)' },
  },
}

const VERDICT_SCHEMA = {
  type: 'object',
  required: ['target', 'lens', 'refuted', 'kept', 'overall'],
  properties: {
    target: { type: 'string' },
    lens: { type: 'string' },
    refuted: { type: 'array', items: { type: 'object', required: ['item', 'severity', 'why', 'evidence', 'fix'], properties: { item: { type: 'string' }, severity: { type: 'string', enum: ['치명', '중대', '경미'] }, why: { type: 'string' }, evidence: { type: 'string', description: '파일:줄 · 정본 문구 · 출처 URL 중 하나' }, fix: { type: 'string' } } } },
    kept: { type: 'array', items: { type: 'string' } },
    overall: { type: 'string', enum: ['통과', '수리 후 통과', '재설계'] },
  },
}

const REPAIR_SCHEMA = {
  type: 'object',
  required: ['engine', 'design', 'change_log', 'rejected_refutations'],
  properties: {
    engine: { type: 'string' },
    design: DESIGN_SCHEMA,
    change_log: { type: 'array', items: { type: 'object', required: ['refutation', 'change'], properties: { refutation: { type: 'string' }, change: { type: 'string' } } } },
    rejected_refutations: { type: 'array', items: { type: 'object', required: ['refutation', 'why_rejected'], properties: { refutation: { type: 'string' }, why_rejected: { type: 'string' } } } },
  },
}

const CRITIC_SCHEMA = {
  type: 'object',
  required: ['missing', 'wrong', 'hard_to_read', 'verdict'],
  properties: {
    missing: { type: 'array', items: { type: 'object', required: ['what', 'where_it_should_go', 'source'], properties: { what: { type: 'string' }, where_it_should_go: { type: 'string' }, source: { type: 'string' } } } },
    wrong: { type: 'array', items: { type: 'object', required: ['what', 'evidence', 'fix'], properties: { what: { type: 'string' }, evidence: { type: 'string' }, fix: { type: 'string' } } } },
    hard_to_read: { type: 'array', items: { type: 'object', required: ['where', 'why', 'rewrite'], properties: { where: { type: 'string' }, why: { type: 'string' }, rewrite: { type: 'string' } } } },
    verdict: { type: 'string', enum: ['통과', '수리 필요'] },
  },
}

const LENSES = [
  { key: 'A·AI가 세질수록 세지는 구조', prompt: '렌즈 A: 「AI 가 두 배 똑똑해지면 이 엔진은 두 배 좋아지는가」에서 출발한다. 규칙·프롬프트로 «읽는» 층을 «배우고 스스로 갱신되는» 층으로 바꾼다. 재료(학생이 «한 것»)·계약·평가(시험지·래칫)·모델 교체 자동 재심사 고리를 먼저 세우고, 모델은 갈아끼우는 부품으로 둔다. 정찰 재료(공통스택.json · <엔진>_정찰.json)에서 2026-09 의 새 능력을 실제로 쓴다.' },
  { key: 'B·학생 한 명의 하루·명품', prompt: '렌즈 B: 개원 첫 달, 학생 한 명(16세 몽골 학생)의 하루 «장면»에서 출발한다 — 아침 알림·교실·저녁 숙제·잠들기 전 라디오. 이 엔진이 그 하루의 어느 순간에 «무엇으로» 닿는가. 철학 Ⅰ-8 재료의 급(BGM·촉감·여백·글자 크기까지) · Ⅰ-3⑤ 자기설명 · Ⅰ-5 누구에게(학생 본인) · Ⅱ-2 케어받는 느낌 · Ⅱ-8 돌려주기 · ㉢ 비교 금지 를 자로 쓴다. 명품은 «더 많이»가 아니라 «더 정확히·더 따뜻하게·설명 없이 알게»다.' },
  { key: 'C·세계 1등 대조·종류 변화', prompt: '렌즈 C: 세계1등.json 과 <엔진>_정찰.json 의 ceiling_reference 에서 출발한다 — 이 엔진 자리에서 지금 세계 최상은 무엇을 하고, 우리는 무엇을 «못 하고» 무엇을 «그들이 못 하나»(오프라인 교실·삶 이해·몽골어 화자·1인 학원의 밀도). 철학.json 의 one_dimension_up_definition 을 자로, 이 엔진의 «종류»를 바꾸는 설계를 낸다. 반드시 «걷어낼 것»을 이름으로 댄다(대체는 걷어내기까지가 한 벌 · 동점이면 기존 유지).' },
]

function designPrompt(engine, lens) {
  return `${COMMON}
【과제】 SYNK 엔진 「${engine}」(${ENGINE_LINE[engine]})의 «한 차원 위» 설계를 낸다.
${lens.prompt}

먼저 읽는다(전부): ${MAT}/철학.json · ${MAT}/횡단.json · ${MAT}/${engine}_독해.json · ${MAT}/${engine}_정찰.json · ${MAT}/공통스택.json · ${MAT}/세계1등.json.
그 다음 <엔진>_독해.json 의 files_read 중 핵심 정본 2~3벌(소개서 원고 · 설계 정본)을 직접 열어 재료가 낡지 않았나 대조한다(실물이 이긴다).

요구:
1. thesis 는 «종류 변화» 한 문장. kind_before/kind_after 로 지금과 뒤를 가른다.
2. upgrades 는 최소 3, 최대 7. 각각 «장면으로 열고 구조로 닫는다». 정찰을 실제로 쓴 것은 scouting_used 에 출처 URL 까지. 걷어낼 옛것을 removes 에 이름으로.
3. 승계 제약을 형태로 푼 자리를 constraint_handling 에 적는다(예: ㉢ 는 «학생 화면에 안 나감»으로 · Ⅰ-4 는 «판정 칸을 강사 시즌 회고에 둠»으로 · 자산층은 «읽기만»으로).
4. 현행 정본·유호 확정을 뒤집는 것이 있으면 숨기지 말고 open_yuho_decisions 에 완성형(값·선택지·권고)으로 적는다. 뒤집지 않고 형태로 풀 수 있으면 그쪽이 먼저다.
5. build_order 는 «문이 닫히는 순서»(소급 불가·개원 전에만 되는 것) → 세로줄 기여 순. 「전부 다」는 순서가 아니다.
6. 이 엔진이 다른 여섯과 주고받는 것(io_with_other_engines)을 빠짐없이. 자산층(Trail·Prism·Temper)은 닿는 셋이 걷은 것을 «읽기만» 한다.
7. 없는 것을 있다고 쓰지 않는다. 숫자는 자·날짜와 함께.`
}

function judgePrompt(engine, designs, angle) {
  return `${COMMON}
【과제】 엔진 「${engine}」의 독립 설계 3안을 심사한다. 심사 각도: ${angle}
먼저 ${MAT}/철학.json · ${MAT}/${engine}_독해.json 을 읽는다.
3안(JSON):
${JSON.stringify(designs)}

채점(각 0~10): philosophy_fit(철학 정합 — ㉡㉢㉣·게이트·관찰/판정 분리·자산층 3규칙) · dimension_up(기능 더미가 아니라 종류 변화인가) · ai_scales(AI 두 배 시험) · feasible_solo_remote(1인·원격·램16GB·학생 0·개원까지 6개월) · craft(재료의 급·자기설명·누구에게=학생) · vertical_line(세로줄 기여) · cost_named(대가·닫을 것·자를 적었나). total = 합.
winner 를 고르고, 나머지 두 안에서 «이식할 것»을 graft 에, 어느 안이든 «치명 결함»(철학 정면 위반 · 소급 불가를 놓침 · 없는 실물을 있다고 씀 · 유호 확정을 조용히 뒤집음)을 fatal_flaws 에 적는다. 점수 근거는 note 에 한 줄.`
}

function synthPrompt(engine, designs, judges) {
  return `${COMMON}
【과제】 엔진 「${engine}」의 설계 3안과 심사 2벌을 받아 «하나의 설계»로 종합한다.
먼저 ${MAT}/철학.json · ${MAT}/${engine}_독해.json · ${MAT}/${engine}_정찰.json 을 읽는다.
3안: ${JSON.stringify(designs)}
심사: ${JSON.stringify(judges)}
규칙: 승자 안을 뼈대로, graft 는 전부 옮겨 심되 중복은 합친다. fatal_flaws 는 전부 고친다(고칠 수 없으면 뺀다). upgrades 는 5~9 개로 정리하고 각 항목의 필수 칸(정찰 출처·걷어낼 것·제약 처리·대가·닫을 것·자·효력 시점·닫히는 문)을 빠짐없이 채운다. lens 칸에는 「종합」이라 적고 어느 렌즈에서 무엇을 가져왔는지 thesis 뒤에 괄호로 적는다.`
}

function integratePrompt(synths) {
  return `${COMMON}
【과제】 엔진 일곱의 종합 설계를 받아 «한 시스템»으로 통합한다 — 일곱이 따로 좋아지는 게 아니라 «한 사람을 깊이 이해하는 교육 시스템»이 한 차원 오르는 설계.
먼저 ${MAT}/철학.json(특히 vertical_line · one_dimension_up_definition · three_layers) · ${MAT}/횡단.json(계약·래칫·큐·유호 확정) · ${MAT}/세계1등.json 을 읽는다. 필요하면 ${REPO}/docs/관통왕복_명세.md · ${REPO}/docs/엔진도달_설계.md §5·§8 · ${REPO}/docs/엔진/SYNK_엔진_지도.html(텍스트 grep) 을 연다.
일곱 설계(JSON): ${JSON.stringify(synths)}
요구:
1. vertical_line_v2 — 1년차 목표 「㉡㉢ 엔진 도달 + 학생 한 명분 세로줄 1회 관통」을 «상향된» 형태로 다시 쓴다. 일곱이 각각 어느 칸을 맡는지.
2. shared_contracts — 두 엔진 이상이 쓰는 데이터·사건·스탬프를 이름·생산자·소비자·모양·까닭으로. 기존 계약(c14~c16 · 학습자상태 · 개입 스탬프 · 사건 출처)과 «새로 필요한 것»을 가른다. 자산층은 읽기만(자기 수집 통로 신설 금지).
3. conflicts_resolved — 일곱 설계가 서로 충돌하는 자리(같은 데이터를 두 엔진이 «소유» · 같은 판정을 두 자로 잼 · 학생 화면에 두 엔진이 동시에 닿음 · Reed 가 Atlas 에 기여하려 함 등)를 찾아 해소한다. 「한 값을 두 곳이 알면 갈린다」·「같은 판정을 두 자로 재면 어긋난다」가 자다.
4. engine_order — «문이 닫히는 순서»(소급 불가 · 개원 전에만 되는 것 · 첫 학생의 첫 주는 한 번뿐)가 먼저, 그 다음 세로줄 기여. 12~20 걸음.
5. atlas_definition — 상향된 SYNK Atlas(학생 한 명분 이해)가 «무엇으로» 이루어지고 어떻게 갱신·평가·돌려주기 되나.
6. what_changes_for_student_day — 개원 첫 달 학생 한 명의 하루 장면(현행 대비 달라지는 것만). what_changes_for_yuho — 유호님이 보는 것·누르는 칸(판단 자리 하나만 남는가).
7. measures — 「더 좋아졌다」를 재는 자 전량(이름·도구·분모). 학생 0명이라 못 재는 것은 「첫 학생 뒤」로 표시.
8. open_yuho_decisions — 일곱에서 올라온 것 + 통합에서 생긴 것. 완성형(질문·선택지·권고·왜 유호님만).
9. removed_list — 걷어내는 옛것 전량.`
}

const REFUTE_LENSES = [
  { key: '철학 충돌', prompt: '렌즈 = 철학 정면 충돌. ㉡(사람 손 늘림) ㉢(학생에게 보이는 비교) ㉣(식별자 유출) · Ⅰ-4 관찰/판정 분리(실시간 자동 판정 · 「목표에 가까워졌나」를 기계가 판정) · Ⅱ-8 돌려주기의 형태 규칙(새 화면 늘리기 금지 · 계기판 금지 · 재촉 장치 금지 · 셋 다 안 떨어진다) · Ⅱ-9 바깥 AI(엔진이 학생을 잘못 배우는 길) · 자산층 3규칙 · 재료의 급 · 자기설명. 철학.json 과 docs/SYNK_철학.md 원문을 열어 조항 문구로 반박한다.' },
  { key: '실현성', prompt: '렌즈 = 실현성. 1인 · 비개발자 유호님 · AI 원격 · 램 16GB · Apps Script + Supabase + Expo 스택 · 개원까지 약 6개월 · 학생 0명 · 몽골어 검수자 미채용 · 돈 드는 API 는 가오픈 때. 「지을 수 있나」보다 「지어 놓고 «도는가»·«닿는가»·«늘어나는가»(④ 3칸)」를 묻는다. 실물(코드·계약)을 열어 설계가 가정한 것이 실재하나 대조한다(${REPO} · ${TALK}). 비용은 단가×횟수로 검산한다.' },
  { key: '차원', prompt: '렌즈 = «진짜 한 차원 위인가». 기능을 쌓은 것과 종류가 바뀐 것을 가른다. AI 두 배 시험 · 대체불가 3문 · 「선생님의 뇌」 재료(학생이 «한 것») · 세계1등.json 의 ceiling 대비. «걷어낼 것»이 이름으로 있나(대체 아닌 추가면 지적). 같은 값을 두 곳이 알게 하나. 정찰 출처가 실제로 그 능력을 말하나(URL 을 열어 확인 — WebFetch 를 ToolSearch 로 불러온다).' },
  { key: '확정·실물 낡음', prompt: '렌즈 = 유호 확정 충돌 + 🚫 기술 이유 승계 + 실물 낡음. 횡단.json 의 yuho_confirmed_engine_wide · 각 독해의 yuho_confirmed · inherited_constraints 와 대조해 «조용히 뒤집은 것»을 잡는다(뒤집으려면 open_yuho_decisions 에 있어야 한다). 설계가 「이미 있다/없다」고 가정한 실물을 저장소에서 grep 으로 확인해 낡은 가정을 잡는다. 시제 규약 위반(없는 것을 있다고)을 잡는다.' },
]

function refutePrompt(target, lens, payload, materialFiles) {
  return `${COMMON}
【과제】 아래 설계를 «반박»한다. 기본값은 반박이다 — 확신이 없으면 refuted 에 넣고 severity 를 낮춘다. 살릴 것은 kept 에 이름만.
대상: ${target}
${lens.prompt}
먼저 읽는다: ${materialFiles.join(' · ')}
설계(JSON): ${JSON.stringify(payload)}
severity 기준: 치명 = 철학 정면 위반 · 소급 불가를 놓침 · 없는 실물을 있다고 씀 · 유호 확정을 조용히 뒤집음 · 지을 수 없음. 중대 = 고치면 되지만 지금 형태로는 틀림. 경미 = 문구·순서.
evidence 는 파일:줄 · 정본 문구 · URL 중 하나를 반드시 댄다. fix 는 완성형(무엇을 무엇으로).`
}

function repairPrompt(engine, design, verdicts) {
  return `${COMMON}
【과제】 엔진 「${engine}」의 종합 설계를 반박 ${verdicts.length}벌로 수리한다.
먼저 ${MAT}/철학.json · ${MAT}/${engine}_독해.json · ${MAT}/${engine}_정찰.json 을 읽는다.
설계: ${JSON.stringify(design)}
반박: ${JSON.stringify(verdicts)}
규칙: 치명·중대는 전부 처리한다 — 고치거나(change_log) 근거를 대고 기각한다(rejected_refutations · 기각은 실물·정본 문구로만). 경미는 고칠 수 있으면 고친다. 고친 뒤에도 DESIGN_SCHEMA 전 칸이 채워져 있어야 한다. 반박이 «실물이 없다»고 했으면 저장소를 열어 확인하고 그 결과를 change_log 에 적는다.`
}

function repairSystemPrompt(system, verdicts) {
  return `${COMMON}
【과제】 일곱 통합 설계를 반박 ${verdicts.length}벌로 수리한다.
먼저 ${MAT}/철학.json · ${MAT}/횡단.json 을 읽는다.
통합 설계: ${JSON.stringify(system)}
반박: ${JSON.stringify(verdicts)}
규칙: 치명·중대는 전부 처리(고치거나 실물·정본 근거로 기각). 수리한 통합 설계를 SYSTEM_SCHEMA 그대로 낸다. 기각한 반박은 conflicts_resolved 끝에 「기각: …」 항목으로 남긴다.`
}

function writerPrompt(system, repaired) {
  return `${COMMON}
【과제】 유호님이 읽을 «정본 문서»를 집필해 ${OUT_DOC} 에 Write 로 저장한다. 마크다운. 한국어. 이 문서가 이번 일의 유일한 산출물이다 — 빠짐없이, 그러나 읽히게.
먼저 읽는다: ${MAT}/철학.json · ${MAT}/횡단.json · ${MAT}/공통스택.json · ${MAT}/세계1등.json · 각 ${MAT}/<엔진>_정찰.json(출처 URL 을 문서에 실어야 하므로) · 그리고 문체 참조로 ${REPO}/docs/세층합류_설계_v1.md 의 머리 40줄과 ${REPO}/docs/Reed_설계_v0.1.md 의 §0 「한 장 요약(비개발자용)」.
통합 설계: ${JSON.stringify(system)}
엔진별 수리된 설계(7): ${JSON.stringify(repaired)}

문서 규격:
- 머리: HTML 주석 3줄(<!-- 정본: v1.0 --> · <!-- 파생: docs/SYNK_철학.md@v1.13 --> · 유호 지시 ${TODAY} 원문 「철학정본을 전부 훑어보고 지금 7종의 모든 엔진 시스템을 최신정보에 기반해서 한차원 업그레이드 된 시스템 설계로 발전시켜줘. 다시한번 말하지만 기회비용 생각하지 마」 + 제작 방법 한 줄(독해 9·정찰 9 → 설계 3안×7 → 심사 2×7 → 종합 7 → 통합 1 → 반박 4갈래×8 → 수리 → 재반박 → 집필 → 완결 비평)).
- 제목: # 엔진 7종 상향 설계 v1 — «한 사람을 깊이 이해하는 시스템»이 한 차원 오르는 길
- > 상태 줄: 「유호님 채택 전 = 제안」 · 철학 대조 기준 v1.13 · 정찰 기준일 ${TODAY} · 「이 문서는 현행 정본(소개서 7벌·설계 정본들)을 대체하지 않고 그 «다음 판»을 제안한다 — 채택되면 각 정본이 제 절을 갱신하고 이 문서는 그 갱신을 잇는 색인으로 남는다」.
- §0 한 장 요약(비개발자용) — 장면으로 연다: 개원 첫 달 학생 한 명의 하루가 현행 대비 무엇이 달라지나(what_changes_for_student_day). 그 다음 «종류 변화» 한 줄씩 일곱(kind_before → kind_after). 그 다음 유호님이 정할 것 개수와 첫 걸음 셋.
- §1 자 — 이 설계가 통과한 자(철학에서 도출한 「한 차원 위」 정의 · AI 두 배 · 대체불가 3문 · 승계 제약 · 정찰 게이트 3) 를 짧게. 정본 문구 인용.
- §2 세계 눈높이 — 2026-09 세계 최상이 하는 것과 우리가 못 하는 것·그들이 못 하는 것(세계1등.json · 출처 URL).
- §3 일곱을 한 시스템으로 — thesis · vertical_line_v2 · atlas_definition · shared_contracts(표) · conflicts_resolved.
- §4~§10 엔진별(Core·Loom·Vellum·Trail·Prism·Temper·Reed 순 · kicker 규약 「닿는 엔진 N호 / 쌓는 엔진 N호 / 무대층」): 한 문장 → 지금(독해 기준 «돈다/짓고 있다/없다») → 종류 변화 → 상향 항목(각 항목: 장면 → 구조 → 정찰 근거(출처·날짜) → 걷어내는 것 → 승계 제약 처리 → 대가(틀릴 때의 모습 + 닫을 것 하나) → 자(무엇으로 재나) → 효력 시점 → 닫히는 문) → 다른 엔진과의 입출력 → 하지 않는 것 → 순서.
- §11 순서 — engine_order 표(걸음·엔진·항목·왜 이 순서·닫히는 문). 「개원 전에만 되는 것」을 굵게.
- §12 유호님이 정할 것 — open_yuho_decisions 전량, 각각 질문·선택지·권고·왜 유호님만. 정지선 넷(돈·모델픽·소급불가·확정충돌)만 여기 온다 — 나머지는 내가 진행한다고 적는다.
- §13 걷어내는 것 — removed_list.
- §14 재는 자 — measures 표. 학생 0명이라 못 재는 것은 「첫 학생 뒤」.
- §15 정찰 장부 — 이번에 웹에서 확인한 것 전량(엔진별 findings 이름·날짜·URL·게이트 결과) + 기각 목록. 벤더 숫자는 가장 빨리 썩는 층이라 «측정일 붙은 사진»이라 적는다.
- §16 대가 — 이 설계 전체가 틀릴 때의 모습 셋과 각각 닫을 것.
- 문체: 결론 먼저 · 쉬운 낱말(어려운 낱말은 괄호로 풀이) · 한 문장 한 뜻 · 표는 넓으면 쪼갠다 · 없는 것을 있다고 안 쓴다(시제 §0) · 숫자엔 자·날짜 · 「0건」과 「안 재봤다」를 가른다. 유호님은 비개발자다 — 코드 이름은 꼭 필요한 자리에만.
- 길이 제한 없음. 빠짐이 죄다. 다만 같은 말을 두 번 하지 않는다.
- 저장 후 파일 크기(바이트)와 절 목록을 최종 텍스트로 낸다.`
}

function criticPrompt() {
  return `${COMMON}
【과제】 ${OUT_DOC} 를 «완결 비평»한다 — 유호님 원지시와 재료 대비 빠진 것·틀린 것·읽기 어려운 것.
읽는다: ${OUT_DOC}(전문) · ${MAT}/철학.json · ${MAT}/횡단.json · ${MAT}/세계1등.json · ${MAT}/공통스택.json · 각 ${MAT}/<엔진>_정찰.json · 각 ${MAT}/<엔진>_독해.json(필요한 만큼).
검사 축:
① 엔진 일곱이 전부 «종류 변화»로 서 있나(하나라도 기능 목록에 그쳤으면 missing).
② 철학 조항 전량(Ⅰ 한 문장·㉡㉢㉣·Ⅰ-1~9·Ⅱ-1~9·Ⅲ 요지·부록 C 1~7)이 어느 엔진 절에든 닿나 — 철학.json 의 clauses_no_engine_serves 가 문서에서 답을 받았나.
③ 정찰 finding 중 게이트를 지난 것이 문서에 빠졌나(정찰 장부 §15 대조).
④ 유호님이 정할 것이 완성형(질문·선택지·권고)인가 · 정지선 넷 밖의 것이 거기 섞였나(그건 내가 진행할 것).
⑤ 시제 위반(없는 것을 있다고) · 숫자에 자·날짜 없음 · 「0건」과 「안 재봤다」 뭉갬.
⑥ 읽기: 비개발자 유호님이 §0 만 읽고 무엇이 달라지는지·무엇을 정해야 하는지 아나. 어려운 낱말·긴 문장·설명 없는 코드 이름.
⑦ 대가·닫을 것·자가 항목마다 있나.
verdict 는 치명적 빠짐이 하나라도 있으면 「수리 필요」.`
}

function fixDocPrompt(critic) {
  return `${COMMON}
【과제】 완결 비평을 받아 ${OUT_DOC} 를 «제자리에서» 수리한다(Edit/Write). 비평: ${JSON.stringify(critic)}
missing 은 재료(${MAT}) 에서 찾아 채운다(재료에 없으면 「안 재봤다」로 적는다 · 지어내지 않는다). wrong 은 증거대로 고친다. hard_to_read 는 rewrite 대로 바꾼다.
끝나면 고친 자리 목록(절·무엇을)과 파일 크기(바이트)를 최종 텍스트로 낸다.`
}

// ───────────────────────────── 실행 B2: 수리 → 재반박 → 재수리 · 통합 반박 → 수리 (파일 기반) ─────────────────────────────
const SYN = (e) => `${MAT}/종합_${e}.json`
const VER = (e) => `${MAT}/반박_${e}.json`
const SYS0 = `${MAT}/통합_수리전.json`
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
【과제】 엔진 「${engine}」의 종합 설계를 반박으로 수리한다.
먼저 ${MAT}/철학.json · ${MAT}/${engine}_독해.json · ${MAT}/${engine}_정찰.json 을 읽는다.
설계 = ${designRef}
반박 = ${verdictsRef}
규칙: 치명·중대는 전부 처리한다 — 고치거나(change_log) 근거를 대고 기각한다(rejected_refutations · 기각은 실물·정본 문구로만). 경미는 고칠 수 있으면 고친다. 고친 뒤에도 DESIGN_SCHEMA 전 칸이 채워져 있어야 한다(design 칸에 수리된 설계 «전체»를 낸다 — 바뀐 부분만 내지 않는다). 반박이 «실물이 없다»고 했으면 저장소를 열어 확인하고 그 결과를 change_log 에 적는다. lens 칸은 「종합·수리」. engine 칸은 반드시 「${engine}」이라는 낱말을 포함한다.`
}

function repairSystemPromptF(verdicts) {
  return `${COMMON}
【과제】 일곱 통합 설계를 반박 ${verdicts.length}벌로 수리한다.
먼저 ${MAT}/철학.json · ${MAT}/횡단.json · 통합 설계 ${SYS0} 를 읽는다.
반박: ${JSON.stringify(verdicts)}
규칙: 치명·중대는 전부 처리(고치거나 실물·정본 근거로 기각). 수리한 통합 설계를 SYSTEM_SCHEMA 그대로 «전체» 낸다. 기각한 반박은 conflicts_resolved 끝에 「기각: …」 항목으로 남긴다.`
}

log('B2 — 수리 7 → 재반박 2갈래 → (재수리) ∥ 통합 반박 4 → 통합 수리')
const engineWork = pipeline(
  ENGINES,
  (engine) => agent(repairPromptF(engine, `${SYN(engine)} (파일을 열어 읽는다)`, `${VER(engine)} (파일을 열어 읽는다 · 배열)`), { label: `수리:${engine}`, phase: '반박', schema: REPAIR_SCHEMA, effort: 'high' }),
  (rep, engine) => {
    if (!rep) return null
    return parallel([REFUTE_LENSES[0], REFUTE_LENSES[3]].map((lens) => () => agent(refutePromptF(`엔진 ${engine} 수리 설계(2차)`, lens, JSON.stringify(rep.design), engineMaterials(engine)), { label: `재반박:${engine}:${lens.key.slice(0, 2)}`, phase: '반박', schema: VERDICT_SCHEMA, effort: 'high' })))
      .then((vs2) => {
        const v = vs2.filter(Boolean)
        const fatal = v.flatMap((x) => x.refuted).filter((r) => r.severity === '치명')
        if (!fatal.length) return { ...rep, second_round: v }
        return agent(repairPromptF(engine, JSON.stringify(rep.design), JSON.stringify(v)), { label: `재수리:${engine}`, phase: '반박', schema: REPAIR_SCHEMA, effort: 'high' }).then((rep2) => rep2 ? { ...rep2, second_round: v, second_repair: true } : { ...rep, second_round: v })
      })
  },
)
const systemWork = parallel(REFUTE_LENSES.map((lens) => () => agent(refutePromptF('일곱 통합 설계', lens, `${SYS0} (파일을 열어 읽는다)`, [`${MAT}/철학.json`, `${MAT}/횡단.json`, `${MAT}/세계1등.json`, ...ENGINES.map(SYN)]), { label: `반박:통합:${lens.key.slice(0, 2)}`, phase: '반박', schema: VERDICT_SCHEMA, effort: 'high' })))
  .then((vs) => vs.filter(Boolean))
  .then((sysVerdicts) => agent(repairSystemPromptF(sysVerdicts), { label: '수리:통합', phase: '반박', schema: SYSTEM_SCHEMA, effort: 'max' }).then((sys) => ({ sys, sysVerdicts })))
const [repaired, sysOut] = await Promise.all([engineWork, systemWork])
const repairedOk = repaired.filter(Boolean)
log(`엔진 수리 ${repairedOk.length}/7 · 통합 수리 ${sysOut && sysOut.sys ? 1 : 0}`)
return { system: sysOut ? sysOut.sys : null, sysVerdicts: sysOut ? sysOut.sysVerdicts : [], repaired: repairedOk, missing: ENGINES.filter((e, i) => !repaired[i]) }
