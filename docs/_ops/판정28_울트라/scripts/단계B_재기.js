export const meta = {
  name: 'panjeong-stage-b-measure',
  description: '「내가 재면 되는 것」을 건별로 실제로 재서 완성형 갈래를 만들고, 반박으로 친다',
  phases: [
    { title: 'Measure', detail: '건별로 실제로 잰다 — 저장소·바깥 사실·산수·문안' },
    { title: 'Refute', detail: '건별 적대 검증 — 근거가 이름과 숫자인가' },
    { title: 'Repair', detail: '반박을 채택·기각으로 처분하고 갈래를 다시 세운다' },
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

🔴 **09-03 1차에서 반박이 사실 오류 40건을 잡았다. 그 넷이 되풀이된 무늬다 — 같은 자리를 밟지 마라:**
1. **절 제목만 보고 본문을 추정했다.** 제목의 낱말과 본문의 그 낱말이 «같은 것»을 가리키는지 확인한다.
   (실제 사고: 절 제목의 「이름이 없다」가 문패가 아니라 «반 걸이판»의 이름 칸을 가리키고 있었다.)
2. **같은 낱말이 두 곳에서 다른 것을 가리키는데 한 낱말로 붙였다.** 문서마다 그 낱말의 정의를 다시 찾는다.
3. **수를 옮겨 적고 다시 안 셌다.** 「문패 4벌인데 이름을 지을 반은 24개」처럼 두 수가 안 맞는 자리를 찾는다.
4. **「막혀 있다」를 확인 없이 썼다.** 정말 막혔는지 그 자리를 열어 본다(트랙·결정·원문이 이미 열어 둔 적이 있다).

🔴 **branches 의 detail 과 recommend_why 에도 근거를 붙인다** — measured 칸에만 출처를 적고
갈래·권고를 근거 없이 쓰면 반박이 그 자리를 친다. 「어느 파일 몇 행이 그렇게 말하나」를 문장 안에 넣는다.

🔴 **갈래를 내기 전에 스스로 검사한다** — 두 갈래를 나란히 놓고 「둘 다 고를 수 있나?」를 묻는다.
고를 수 있으면 배타가 아니다. 갈래를 다시 짠다.
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

// 수리 산출 = 잰 것과 같은 꼴 + change_log
const REPAIRED = {
  type: 'object',
  additionalProperties: false,
  properties: Object.assign({}, MEASURE.properties, {
    change_log: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          kind: { type: 'string' },
          verdict: { type: 'string', enum: ['accepted', 'rejected', 'partly'] },
          what_changed: { type: 'string' },
          why: { type: 'string' },
        },
        required: ['kind', 'verdict', 'what_changed', 'why'],
      },
    },
  }),
  required: MEASURE.required.concat(['change_log']),
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
      '- 나온 문서 = `' + (it.doc || '-') + '`\n' +
      (it.merge
        ? '- 🔴 **이 건은 `' + it.merge + '` 와 «같은 물음»이다**(완결 비평 판정). 까닭 = ' + (it.merge_why || '한 답이 둘을 닫는다') + '\n' +
          '  ⇒ 두 카드를 «둘 다» 읽고 **한 벌로 재서 답 하나**를 낸다. closes 칸에 `' + it.merge + '` 를 반드시 넣는다.\n' +
          '  ⇒ 갈래는 두 건을 동시에 가르는 것이어야 한다. 한쪽만 닫는 갈래는 갈래가 아니다.\n'
        : '') +
      '\n**먼저 이 건의 카드를 읽는다** — `docs/_ops/판정28_울트라/재료/가르기_' + it.id.split('-')[0] + '.json` 안에서\n' +
      '`id` 가 `' + it.id + '` 인 항목이다. 그 카드에 물음·갈래·마감·「무엇을 재나」·「안 정해지면 멈추는 것」이 다 들어 있다.\n' +
      (it.merge ? '짝 카드는 `docs/_ops/판정28_울트라/재료/가르기_' + it.merge.split('-')[0] + '.json` 의 `' + it.merge + '` 항목이다.\n' : '') +
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
  },
  (r, it) => {
    if (!r || r.none || !r.measured) return { none: true, id: it.id }
    if (!r.verdict || (r.verdict.severity === 'none' && !r.verdict.refuted)) {
      return { measured: r.measured, verdict: r.verdict, repaired: r.measured, clean: true }
    }
    return agent(
      COMMON +
      '\n\n# 네 일 = 수리. 앞 단계가 재고, 다른 에이전트가 그것을 깨러 들어갔다.\n\n' +
      '## 잰 것\n```json\n' + JSON.stringify(r.measured, null, 1) + '\n```\n\n' +
      '## 반박\n```json\n' + JSON.stringify(r.verdict, null, 1) + '\n```\n\n' +
      '# 🔴 반박을 액면 그대로 고치지 않는다\n\n' +
      '반박은 근거를 대고 오지만 «틀릴 수 있다». 지적마다 **네가 직접 실물을 열어 다시 재고** 처분한다.\n' +
      '- **accepted** — 재봤더니 반박이 맞다. 고친다.\n' +
      '- **rejected** — 재봤더니 반박이 틀렸다. **왜 틀렸는지 파일·행으로 짚는다.** 근거 없는 기각은 안 된다.\n' +
      '- **partly** — 사실은 맞는데 처방이 과하거나 좁다. 어디까지 받았는지 적는다.\n\n' +
      'change_log 에 지적 하나마다 한 줄. 하나도 빠뜨리지 않는다.\n' +
      '반박이 「갈래가 통째로 깨졌다」고 했으면 갈래를 새로 만든다. 살릴 것(keep)은 그대로 들고 간다.\n\n' +
      '고친 산출을 위 「잰 것」과 같은 꼴로 내고, change_log 를 더한다.',
      { label: 'repair:' + it.id, phase: 'Repair', schema: REPAIRED }
    ).then((rp) => ({ measured: r.measured, verdict: r.verdict, repaired: rp }))
  }
)

const got = out.filter((r) => r && !r.none)
log('잰 것 ' + got.length + '/' + ITEMS.length + ' · 뒤집힌 것 ' + got.filter((r) => r.verdict && r.verdict.refuted).length)
return { count: got.length }
