export const meta = {
  name: 'panjeong-stage-b-measure',
  description: '「내가 재면 되는 것」을 건별로 실제로 재서 완성형 갈래를 만들고, 반박으로 친다',
  phases: [
    { title: 'Measure', detail: '건별로 실제로 잰다 — 저장소·바깥 사실·산수·문안' },
    { title: 'Refute', detail: '건별 적대 검증 — 근거가 이름과 숫자인가' },
  ],
}

// args = { items: [{id, question, options, deadline, how, what_to_measure, blocks, doc}], stampToday: '2026-09-03' }
const ITEMS = (args && args.items) || []
const TODAY = (args && args.stampToday) || '2026-09-03'

const COMMON = `
# 판이 무엇인가

SYNK LAB — 몽골 울란바토르에 2027-02-25 개원하는 한국어 학원(원장 = 유호님 · 1인 창업 · 비개발자).
설계 문서 여섯에 「원장이 정하실 것」이 쌓여 있는데, 그중엔 **원장만 아는 것이 아니라 내가 아직 안 재본 것**이 섞여 있다.
되던지면 원장 시간만 쓰고 답이 안 나온다.

**네 일 = 그 한 건을 실제로 재서, 원장이 «고르기만 하면 되는» 완성형 갈래로 만들어 오는 것이다.**

# 🔴 근거의 자 — 이것을 어기면 산출은 버려진다

- 근거는 **이름과 숫자**로 적는다. 「연구들이 보고했다」·「일반적으로」·「대체로」는 근거가 아니다.
  파일이면 \`경로:행\`, 값이면 출처 URL과 확인한 날, 법이면 법령 이름과 조문 번호.
- **안 잰 것을 「없다」고 쓰지 않는다.** 못 쟀으면 not_measured 칸에 「무엇을 못 쟀고 무엇이 있어야 재나」를 적는다.
- 저장소 안의 사실은 **직접 열어** 확인한다(Grep/Read). 「~일 것이다」로 쓰지 않는다.
- 바깥 사실(법·시세·시장)은 **찾아서** 확인한다. 몽골 현지 값은 특히 «몇 년도 기준인지»를 같이 적는다.
- 오늘은 **${TODAY}** 이다. 값에 날짜를 붙인다.

# 🔴 읽는 사람 — 원장은 비개발자다

- 갈래 이름(label)과 권고(recommend)는 **쉬운 낱말**로. 「똑똑한데 이 분야를 처음 보는 사람」이 자다.
- 처음 쓰는 전문어·줄임말은 그 자리에 괄호로 뜻을 단다(뒤로 미루지 않는다).
- **실물 이름(파일·명령·법령·상품명·버전)은 바꾸지 말고 그대로 두고 옆에 뜻을 단다** — 바꾸면 절차가 죽는다.
- 결론 줄에는 기술 낱말 0. 근거 줄에는 있어도 된다.

# 갈래를 만드는 법

- **2~4개.** 갈래마다 ①무엇인가 ②얼마 드나(액수·시간 · 모르면 「안 재봤다」) ③무엇을 잃나.
- 갈래는 **서로 배타**여야 한다. 「A 또는 A+B」 같은 포갬은 갈래가 아니다.
- **권고를 반드시 하나 낸다**(양비론 금지). 권고가 안 서면 그 까닭과 «무엇이 있어야 서는지»를 적는다.
- 재고 나서도 원장이 정해야 하는 자리가 남으면 now_yuho = true 로 두고, **무엇 하나만 정하면 되는지** 한 줄로 좁힌다.
  (재는 값은 「원장이 안 정해도 된다」가 아니라 「원장이 30초 만에 정할 수 있게 만든다」다.)
`

const MEASURE = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    question: { type: 'string' },
    measured: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          what: { type: 'string' },
          value: { type: 'string' },
          source: { type: 'string' },
        },
        required: ['what', 'value', 'source'],
      },
    },
    branches: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          label: { type: 'string' },
          detail: { type: 'string' },
          cost: { type: 'string' },
          lose: { type: 'string' },
        },
        required: ['label', 'detail', 'cost', 'lose'],
      },
    },
    recommend: { type: 'string' },
    recommend_why: { type: 'string' },
    not_measured: { type: 'string' },
    now_yuho: { type: 'boolean' },
    yuho_one_line: { type: 'string' },
    closes: { type: 'array', items: { type: 'string' } },
    doc_edit: { type: 'string' },
  },
  required: ['id', 'question', 'measured', 'branches', 'recommend', 'recommend_why', 'not_measured', 'now_yuho', 'yuho_one_line', 'closes', 'doc_edit'],
}

const VERDICT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    target: { type: 'string' },
    refuted: { type: 'boolean' },
    severity: { type: 'string', enum: ['fatal', 'major', 'minor', 'none'] },
    problems: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          kind: { type: 'string', enum: ['vague_evidence', 'wrong_fact', 'unmeasured_claimed', 'not_exclusive', 'hard_to_read', 'no_recommend', 'stale', 'other'] },
          quote: { type: 'string' },
          why: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['kind', 'quote', 'why', 'fix'],
      },
    },
    keep: { type: 'string' },
  },
  required: ['target', 'refuted', 'severity', 'problems', 'keep'],
}

phase('Measure')
log(ITEMS.length + '건을 잰다')

const out = await pipeline(
  ITEMS,
  (it) =>
    agent(
      COMMON +
      '\n\n# 네가 맡은 한 건\n\n' +
      '- id = `' + it.id + '`\n' +
      '- 나온 문서 = `' + (it.doc || '-') + '`\n\n' +
      '**먼저 이 건의 카드를 읽는다** — `docs/_ops/판정28_울트라/재료/가르기_' + it.id.split('-')[0] + '.json` 안에서\n' +
      '`id` 가 `' + it.id + '` 인 항목이다. 그 카드에 물음·갈래·마감·「무엇을 재나」·「안 정해지면 멈추는 것」이 다 들어 있다.\n' +
      '(그 「무엇을 재나」는 1단계가 적어 둔 길잡이일 뿐이다. 더 나은 길이 보이면 그리로 간다.)\n\n' +
      '그다음 그 건이 나온 원문 절을 열어 «무엇 위에 서 있는지»를 본다.\n' +
      '그다음 실제로 잰다. 다 재고 나서 갈래를 만든다.\n\n' +
      '- doc_edit 칸 = 답이 정해지면 **어느 파일의 어느 절을 고치는지** 한 줄(경로와 절 번호).\n' +
      '- closes 칸 = 이 답 하나로 **같이 닫히는 다른 건의 id**(없으면 빈 배열).',
      { label: 'measure:' + it.id, phase: 'Measure', schema: MEASURE }
    ),
  (m, it) => {
    if (!m) return { none: true, id: it.id }
    return agent(
      COMMON +
      '\n\n# 네 일 = 적대 검증. 아래 산출을 **깨러** 왔다.\n\n' +
      '```json\n' + JSON.stringify(m, null, 1) + '\n```\n\n' +
      '노리는 것 일곱:\n' +
      '1. **vague_evidence** — 근거가 이름·숫자가 아니라 뭉뚱그린 말인 자리. (「일반적으로」·「보통」·출처 없는 수)\n' +
      '2. **wrong_fact** — 저장소나 바깥 실물과 어긋나는 자리. **직접 열어 확인하고** 어긋나면 원문을 인용한다.\n' +
      '3. **unmeasured_claimed** — 안 재본 것을 잰 것처럼 쓴 자리. not_measured 가 비었는데 실은 못 잰 것이 있나.\n' +
      '4. **not_exclusive** — 갈래가 서로 배타가 아닌 자리(포개지거나, 사실은 같은 것).\n' +
      '5. **hard_to_read** — 비개발자 원장이 못 읽을 낱말이 결론 줄에 있는 자리.\n' +
      '6. **no_recommend** — 권고가 없거나 양비론인 자리.\n' +
      '7. **stale** — 2026-08-26 판 전제 위에 서 있는데 ' + TODAY + ' 현재 그 전제가 죽은 자리.\n\n' +
      '🔑 **근거 없이 「틀렸다」고 하지 않는다.** 문제마다 quote(그 산출의 어느 대목인지)와 why(어긋나는 실물)를 짚는다.\n' +
      '🔑 **살릴 것도 적는다**(keep) — 반박이 산출을 통째로 죽이면 다음 단계가 처음부터 다시 한다.\n' +
      'refuted = 갈래나 권고가 **바뀌어야 하면** true. 표현만 다듬으면 되는 정도면 false + severity minor.',
      { label: 'refute:' + it.id, phase: 'Refute', schema: VERDICT }
    ).then((v) => ({ measured: m, verdict: v }))
  }
)

const got = out.filter((r) => r && !r.none)
log('잰 것 ' + got.length + '/' + ITEMS.length + ' · 뒤집힌 것 ' + got.filter((r) => r.verdict && r.verdict.refuted).length)
return { count: got.length }
