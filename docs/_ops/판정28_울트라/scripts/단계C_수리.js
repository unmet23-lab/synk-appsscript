export const meta = {
  name: 'panjeong-stage-c-repair',
  description: '반박이 잡은 것을 채택·기각으로 처분하고 갈래를 다시 세운다',
  phases: [{ title: 'Repair', detail: '건별로 반박을 처분하고 고친 갈래를 낸다' }],
}

// args = { ids: ['ending-2', ...], stampToday: '2026-09-03' }
const IDS = (args && args.ids) || []
const TODAY = (args && args.stampToday) || '2026-09-03'

const REPAIRED = {
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
        properties: { what: { type: 'string' }, value: { type: 'string' }, source: { type: 'string' } },
        required: ['what', 'value', 'source'],
      },
    },
    branches: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { label: { type: 'string' }, detail: { type: 'string' }, cost: { type: 'string' }, lose: { type: 'string' } },
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
  },
  required: ['id', 'question', 'measured', 'branches', 'recommend', 'recommend_why', 'not_measured', 'now_yuho', 'yuho_one_line', 'closes', 'doc_edit', 'change_log'],
}

phase('Repair')
log(IDS.length + '건을 수리한다')

const out = await parallel(IDS.map((id) => () =>
  agent(
    '# 판이 무엇인가\n\n' +
    'SYNK LAB(몽골 울란바토르 · 2027-02-25 개원하는 한국어 학원 · 원장 = 유호님 · 비개발자)의 설계 문서에\n' +
    '「원장이 정하실 것」이 쌓여 있다. 앞 단계가 그중 한 건을 재서 «완성형 갈래»를 만들었고,\n' +
    '그다음 다른 에이전트가 그것을 **깨러** 들어가 지적을 냈다.\n\n' +
    '**네 일 = 그 지적을 처분하고 갈래를 다시 세우는 것이다.**\n\n' +
    '# 읽을 것 셋\n\n' +
    '1. 잰 것 = `docs/_ops/판정28_울트라/재료/잰것_' + id + '.json`\n' +
    '2. 반박 = `docs/_ops/판정28_울트라/재료/반박_' + id + '.json`\n' +
    '3. 원래 카드 = `docs/_ops/판정28_울트라/재료/가르기_' + id.split('-')[0] + '.json` 의 `id` 가 `' + id + '` 인 항목\n\n' +
    '# 🔴 반박을 액면 그대로 고치지 않는다\n\n' +
    '반박은 근거를 대고 오지만 «틀릴 수 있다». 지적마다 **네가 직접 실물을 열어 다시 재고** 처분한다.\n' +
    '- **accepted** — 재봤더니 반박이 맞다. 고친다.\n' +
    '- **rejected** — 재봤더니 반박이 틀렸다. **왜 틀렸는지 파일·행으로 짚는다.** 기각은 근거가 있을 때만.\n' +
    '- **partly** — 사실은 맞는데 처방이 과하거나 좁다. 어디까지 받았는지 적는다.\n\n' +
    'change_log 에 지적 하나마다 한 줄씩. 하나도 빠뜨리지 않는다.\n\n' +
    '# 🔴 근거의 자\n\n' +
    '- 주장마다 **이름과 숫자**. 「연구들이 보고했다」·「일반적으로」·「대체로」는 근거가 아니다.\n' +
    '- 저장소 사실은 **직접 열어** 본다(Grep/Read). 파일이면 `경로:행`으로 짚는다.\n' +
    '- 바깥 사실(법·시세·시장)은 **찾아서** 확인하고 출처와 확인한 날을 적는다. 몽골 값은 몇 년 기준인지 같이.\n' +
    '- **안 잰 것을 「없다」로 쓰지 않는다.** not_measured 에 「무엇을 못 쟀고 무엇이 있어야 재나」를 적는다.\n' +
    '- 오늘은 **' + TODAY + '** 이다.\n\n' +
    '# 🔴 읽는 사람은 비개발자다\n\n' +
    '- 갈래 이름과 권고는 **쉬운 낱말**로. 자는 「똑똑한데 이 분야를 처음 보는 사람」.\n' +
    '- 처음 쓰는 전문어·줄임말은 그 자리에 괄호로 뜻을 단다.\n' +
    '- **실물 이름(파일·명령·법령·상품명·버전)은 바꾸지 말고 그대로 두고 옆에 뜻을 단다.**\n' +
    '- 결론 줄에는 기술 낱말 0.\n\n' +
    '# 갈래를 다시 세우는 법\n\n' +
    '- **2~4개.** 서로 배타여야 한다. 갈래마다 ①무엇인가 ②얼마 드나 ③무엇을 잃나.\n' +
    '- **권고 하나를 반드시 낸다**(양비론 금지). 안 서면 「무엇이 있어야 서는지」를 적는다.\n' +
    '- 재고도 원장이 정해야 할 자리가 남으면 now_yuho = true 로 두고, **무엇 하나만 정하면 되는지**\n' +
    '  yuho_one_line 에 한 줄로 좁힌다. 그 한 줄은 원장이 30초 안에 답할 수 있어야 한다.\n' +
    '- doc_edit = 답이 정해지면 **어느 파일 어느 절을 고치는지** 한 줄.\n' +
    '- closes = 이 답으로 같이 닫히는 다른 건의 id(없으면 빈 배열).\n\n' +
    '반박이 「갈래가 통째로 깨졌다」고 했으면 **갈래를 새로 만든다.** 살릴 것(keep)은 그대로 들고 간다.',
    { label: 'repair:' + id, phase: 'Repair', schema: REPAIRED }
  )
))

const got = out.filter(Boolean)
log('수리 ' + got.length + '/' + IDS.length)
return { count: got.length }
