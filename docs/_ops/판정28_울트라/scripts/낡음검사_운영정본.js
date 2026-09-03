export const meta = {
  name: 'unyoung-jeongbon-rot-scan',
  description: '운영 시스템 정본의 낡은 자리와 저장소 전체의 교재 오염을 전수로 찾는다(찾기만 · 고치지 않는다)',
  phases: [
    { title: 'Scan', detail: '여덟 축으로 갈라 실물과 대조한다' },
    { title: 'Merge', detail: '틀린 지적을 걸러내고 값 순으로 정렬한다' },
  ],
}

const F = 'docs/정본/SYNK LAB/About Syestem/SYNK_리라이팅_v2/05_운영_시스템.txt'

const COMMON = `
# 판이 무엇인가

SYNK LAB — 몽골 울란바토르에 2027-02-25 개원하는 한국어 학원(원장 = 유호님 · 1인 창업 · 비개발자).
저장소 = \`C:/Users/q1212/Documents/SYNK-appsscript\` · 형제 저장소 = \`../SYNK-talk\`(새 앱 · Expo).

**유호님 지시 2026-09-03 = 「전부 꼼꼼히 체크해보고 이어서 교재관련 오염되거나 낡은거 있으면 다 지워줘」.**

# 🔴 네 일 = «찾기»다. 한 글자도 고치지 않는다.

파일을 **수정하지 마라.** 산출은 「어디가 · 왜 낡았고 · 무엇이 참이며 · 어떻게 고칠지」의 목록뿐이다.
지우는 것은 본세션이 갈래를 갈라 판정한 뒤에 한다 — 네가 지우면 살아 있는 것이 같이 죽는다.

# 🔴 «낡았다»의 자 — 실물이 문서를 이긴다

문서가 무엇을 주장하든 **실물이 참이다.** 실물의 순서:
1. **코드** — \`Code.js\` · \`엔진_*.js\` · \`contents_*.js\` · 형제 저장소 \`../SYNK-talk\`
2. **유호님 확정** — \`docs/_ops/결정.md\`(464건 · 최신이 «아래»에 쌓인다)
3. **남은 일감** — \`docs/_ops/트랙.md\`
4. **버전 이력** — \`docs/버전_이력.md\`(지금 v9.307)
5. 다른 정본 문서

# 찾을 것 여섯 갈래(kind)

- **stale_status** — 상태 표시가 틀렸다. 과녁 문서는 세 가지만 쓴다:
  \`[이미 돈다]\`(사람 손 없이 지금 자동 실행) · \`[짓는 중]\`(코드·화면은 섰는데 사람에게 안 닿음 · 스위치만 켜면 도는 것 포함) · \`[개원과 함께]\`(학생·교실이 있어야 시작).
  🔑 **[짓는 중] 인데 이미 선 것**을 특히 노려라 — 그 문서가 선 뒤 코드가 v9.307 까지 왔다.
- **dead_feature** — 없어진 기능을 아직 있는 것처럼 적는다.
- **wrong_number** — 숫자가 실측과 다르다(개수·총량·달력·비율).
- **missing_real** — 가리키는 파일·함수·시트·열이 실재하지 않는다.
- **contradicts_decision** — 유호님 확정과 어긋난다.
- **superseded** — 더 새 정본이 이미 서서 이 자리가 두 번째 사본이 됐다.

# 🔴 이미 아는 것 셋 — 여기서 출발하되 여기서 멈추지 마라

1. **08-27 「비교하는거 최대한 없애자」로 걷힌 것**(리그·명예의 전당·1등 칭호·이달의 스타)은
   2026-09-03 에 과녁 문서에서 **이미 지웠다**(커밋 ebdf19df2). 또 남았는지만 확인하고 없으면 「0건」으로 적어라.
2. 🔴 **「세어 본 결과」 표(과녁 문서 43~55행 · 합계 131)가 틀렸다 — 본세션이 이미 쟀다.**
   실측 = [이미 돈다] 78 · [짓는 중] 46 · [개원과 함께] 8 = **132**. 어긋나는 자리 셋 =
   1부(문서 4 vs 실측 5) · 5부(69 vs 68) · 6부(문서는 「6부·7부는 표시를 안 쓴다」인데 489행에 하나 있다).
   까닭도 찾았다 — 같은 항목(「정량과 정성이 만나는 자리 = 강사 화면 ②학생」)이 1부 88행과 6부 489행에
   두 번 적혀 둘 다 표시가 붙었다. **이건 이미 아는 것이니 다시 보고하지 말고, 그 밖의 숫자를 재라.**
3. 🔴 **유호 확정 2026-09-03 「교재와 앱은 아예 별개다. 교재 제작은 재헌님이 맡고, 앱·엔진 설계는
   교재를 전제하지 않는다. 교재는 기각하고 어디 안 보이는 곳에 보관만 해 달라」**

# 🔴 교재 축의 함정 — 이름만 보고 걷으면 살아 있는 것이 죽는다

\`교재연동.js\` 는 넷을 품고 **그중 둘만 교재에 기댄다**:

| 갈래 | 교재에 기대나 |
|---|---|
| A 목소리 타임랩스 | 🔴 기댄다(「교재 권1 1·4·8과 과업」을 읽게 한다) |
| B 연습 노트 | 🔴 기댄다(「네 약점 → 교재 몇 과를 다시 펴라」) — 기각 과녁의 핵심 |
| C AI 문법 판정 | ✅ 안 기댄다(학생이 숙제로 낸 «문장»만 본다) |
| 목소리 걷어오기 배치 | ✅ 안 기댄다(녹음을 걷어 기록에 앉힌다) — **발음 데이터 수집 통로** |

⚠ **통째로 걷으면 발음 데이터 수집이 죽고 그건 소급 불가다**(그날 학생이 낸 소리는 그날만 있다).
⇒ 교재 관련을 찾을 때는 **갈래 단위로** 적고, 그 갈래가 «교재에 실제로 기대는지»를 코드로 확인해 evidence 에 쓴다.
⇒ 「교재」라는 낱말이 든 자리를 전부 오염으로 세지 마라. **급수 요목·문법 뱅크·학생 수행(말한 것·쓴 것·낸 것)은 우리 것이라 교재가 아니다.**

# 🔴 근거의 자

- 주장마다 **파일과 행**으로 짚는다(\`엔진_운영배치.js:3718\` 꼴). 「~일 것이다」 금지.
- **직접 열어 확인한다**(Grep/Read). 이름만 보고 추정하면 그 산출은 버려진다.
- **안 잰 것을 「없다」로 쓰지 않는다.** 못 쟀으면 evidence 에 「무엇을 못 쟀나」를 적는다.
- 🔑 **이름이 같은 «다른 물건»을 조심하라.** 09-03 실례 — 「명예의 전당」이 둘이었다:
  08-27 에 걷힌 «달마다의 챔피언 전당»(앱 화면)과, 지금도 사는 «졸업생 전당»(\`hall_of_fame\` 시트 ·
  원장이 손으로 적는다 · \`엔진_셋업확장.js:167,798\`). 낱말로 훑으면 산 것을 죽은 것으로 적는다.

# 읽는 사람

유호님(비개발자)이 이 목록을 읽고 무엇을 지울지 정하신다.
- \`why\`(왜 낡았나)와 \`fix\`(어떻게 고치나)는 **쉬운 낱말**로. 자 = 「똑똑한데 이 분야를 처음 보는 사람」.
- 처음 쓰는 전문어·줄임말은 그 자리에 괄호로 뜻을 단다.
- **실물 이름(파일·함수·시트·버전)은 바꾸지 말고 그대로 두고 옆에 뜻을 단다.**
- \`evidence\`(근거)에는 기술 낱말이 있어도 된다.
`

const FOUND = {
  type: 'object',
  additionalProperties: false,
  properties: {
    axis: { type: 'string' },
    checked: { type: 'number' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          file: { type: 'string' },
          line: { type: 'number' },
          quote: { type: 'string' },
          kind: { type: 'string', enum: ['stale_status', 'dead_feature', 'wrong_number', 'missing_real', 'contradicts_decision', 'superseded'] },
          severity: { type: 'string', enum: ['high', 'mid', 'low'] },
          textbook: { type: 'boolean' },
          why: { type: 'string' },
          evidence: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['file', 'line', 'quote', 'kind', 'severity', 'textbook', 'why', 'evidence', 'fix'],
      },
    },
    not_measured: { type: 'string' },
  },
  required: ['axis', 'checked', 'findings', 'not_measured'],
}

const AXES = [
  { key: 'engine', label: '운영정본 1부 엔진 + 2부의 [이미 돈다]', task: '과녁 = `' + F + '` **1부(78~130행) 전체와 2부(131~268행)의 `[이미 돈다]` 자리 전량**을 코드로 확인한다. 자동화 달력(1-3)의 트리거·함수가 실재하는지, 데이터가 흐르는 길(1-1)의 통로가 실재하는지, 2부의 34자리가 각각 코드에 있는지. 🔑 「스위치만 켜면 돈다」와 「지금 돈다」를 가른다 — 전자는 [짓는 중]이다.' },
  { key: 'building', label: '운영정본 2부의 [짓는 중] — 이미 선 것 찾기', task: '과녁 = `' + F + '` **2부(131~268행)의 `[짓는 중]` 14자리와 2-3 「새 앱에서 서 있는 것」**. 그 문서가 선 뒤 코드가 v9.307 까지 왔으니 **이미 서 버린 것**이 있을 것이다. `docs/버전_이력.md` 를 v9.2xx 부터 훑어 대조하라. 2-8 「콘텐츠 자산 총량 — 코드 실측」의 숫자도 `contents_*.js` 를 열어 다시 세라.' },
  { key: 'textbook-doc', label: '운영정본 3부 교재 + 4부 온라인 강의', task: '과녁 = `' + F + '` **3부(269~307행)와 4부(308~340행)** 전체. 🔴 급소 = **유호 확정 09-03 「교재와 앱은 아예 별개」**. 3부 제목이 「교재 × 커리큘럼 × 앱」이고 3-2 가 「커리큘럼이 정본이고 교재와 앱이 따른다」인데, 그 확정 뒤에도 참인지 재라. `docs/_ops/결정.md` 에서 그 행 원문을 찾아 인용하라. 3-1 「교재 라인업」이 실제로 무엇을 가리키는지, 3-3 「남은 배선」이 교재에 기대는지 갈래로 갈라라. 교재에 기대는 자리는 `textbook: true` 로 표시한다.' },
  { key: 'ops-a', label: '운영정본 5부 앞쪽 — CRM · 재무 · 게임화', task: '과녁 = `' + F + '` **5-1 학생 CRM 과 소통(343~373행) · 5-2 재무(374~386행) · 5-3 출석·포인트·게임화(387~397행)**. 게임화는 08-27 에 크게 걷혔으니 특히 판다. 재무는 `docs/_ops/결정.md` 의 수치 확정(실효 ARPU 42.7만 · 손익분기 117명 등)과 맞는지. CRM 은 상담 봇·크루카드·명부 통로가 실재하는지.' },
  { key: 'ops-b', label: '운영정본 5부 뒤쪽 — 교육품질 · 인사 · 인프라', task: '과녁 = `' + F + '` **5-4 교육 운영과 품질(398~410행) · 5-5 인사와 조직(411~421행) · 5-6 IT 인프라와 위기 대응(422~469행)**. 5-6 이 가장 길다(47행). 인프라는 Supabase·배포·트리거·백업이 실제로 그렇게 도는지 코드와 트랙으로 확인한다. 인사는 강사 채용 확정(08-26 자격 요건·계약 발효 = 개원일·부트캠프 폐기)과 어긋나는지 본다.' },
  { key: 'head', label: '운영정본 머리 · 6부 · 7부', task: '과녁 = `' + F + '` **머리(1~77행) · 6부(470~492행) · 7부(493~522행)**. 급소 둘: ①**「이 문서가 지금 못 답하는 것 — 다섯」(13~20행)** — 그중 이미 닫힌 것이 있나(예: 강사·원장 화면 정본 · 온라인 강의 플랫폼 · 포인트 경제 수치 · 보스·레이드 서사) ②**「값의 정본 지도」(56~77행)** — 가리키는 정본 파일이 실재하고 그 이름이 지금도 맞는지 하나씩 열어 확인. 7부의 개원 순서가 `docs/_ops/트랙.md` 와 어긋나는지 본다. ⚠ 「세어 본 결과」 표는 이미 쟀으니 다시 보고하지 말 것.' },
  { key: 'textbook-code', label: '🔴 교재 오염 — 코드 전수', task: '**이 저장소의 코드 전량**(`Code.js` · `엔진_*.js` · `contents_*.js` · `tools/` · `crewcard/`)에서 **교재를 전제한 자리**를 전수로 찾는다. 찾는 법 = `교재`·`권1`·`권2`·`과업`·`몇 과`·`단원`·`textbook`·`lesson` 등으로 grep 한 뒤 **하나씩 열어** 그것이 «재헌님이 만드는 교재»에 실제로 기대는지 판정한다. 🔴 위 함정 표를 반드시 적용하라 — `교재연동.js` 의 넷 중 둘(C AI 문법 판정 · 목소리 걷어오기 배치)은 교재와 무관하고, 후자를 걷으면 발음 수집이 죽는다. 갈래마다 `textbook: true/false` 와 「걷으면 무엇이 같이 죽나」를 evidence 에 적어라.' },
  { key: 'textbook-docs', label: '🔴 교재 오염 — 문서 전수', task: '**`docs/` 전량**에서 교재를 전제한 설계·문서를 찾는다(운영 시스템 정본 3부는 다른 축이 보므로 제외). 특히 `docs/커리큘럼_정본_v1.md` · `docs/커리큘럼_Lv1_*` · `docs/강사_교수법_매뉴얼_v1.md` · `docs/SYNK_철학.md` · `docs/발음데이터_규격.md` · `docs/_ops/트랙.md` · `DESIGN.md` 를 열어 본다. 🔑 **급수 요목·문법 뱅크·학생 수행은 우리 것이라 교재가 아니다.** 「교재로 TOPIK 수업」처럼 08-26 확정에 든 자리는 유호님 확정과 09-03 확정이 부딪히는 자리이니 **둘 다 인용해서** 올려라(어느 쪽이 나중인지 `git log` 로 재라).' },
]

// args.only = 돌릴 축 키 배열. 없으면 전부.
// 🔑 09-03 에 아홉을 한꺼번에 띄웠다가 전부 529(서버 과부하)로 죽었다 — 넷씩 나눠 돌린다.
const ONLY = (args && args.only) || null
const 돌릴것 = ONLY ? AXES.filter((a) => ONLY.includes(a.key)) : AXES
const 합치나 = !ONLY || (args && args.merge) === true

phase('Scan')
const scans = (await parallel(돌릴것.map((a) => () =>
  agent(
    COMMON +
    '\n\n# 네가 맡은 축 = ' + a.label + '\n\n' + a.task +
    '\n\n먼저 그 범위를 통째로 읽는다. 그다음 실물을 열어 하나씩 대조한다.\n' +
    'axis 칸에 「' + a.key + '」를 적고, checked 에 **실제로 대조한 자리 수**를 적는다.\n' +
    '낡은 것이 없으면 findings 를 빈 배열로 낸다 — 억지로 찾지 않는다.',
    { label: 'scan:' + a.key, phase: 'Scan', schema: FOUND }
  )
))).filter(Boolean)

log('돌린 ' + 돌릴것.length + ' 중 ' + scans.length + ' 벌 산 것 · 찾은 것 ' + scans.reduce((n, s) => n + s.findings.length, 0) + '건')
if (!합치나) return { scans_done: scans.length, found: scans.reduce((n, s) => n + s.findings.length, 0) }

const MERGED = {
  type: 'object',
  additionalProperties: false,
  properties: {
    total: { type: 'number' },
    textbook_count: { type: 'number' },
    by_kind: { type: 'object', additionalProperties: { type: 'number' }, propertyNames: { type: 'string' } },
    wrong: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { file: { type: 'string' }, line: { type: 'number' }, why: { type: 'string' } },
        required: ['file', 'line', 'why'],
      },
    },
    duplicates: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { where: { type: 'string' }, why: { type: 'string' } },
        required: ['where', 'why'],
      },
    },
    dont_delete: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { what: { type: 'string' }, why: { type: 'string' } },
        required: ['what', 'why'],
      },
    },
    missed: { type: 'array', items: { type: 'string' } },
    verdict: { type: 'string' },
  },
  required: ['total', 'textbook_count', 'by_kind', 'wrong', 'duplicates', 'dont_delete', 'missed', 'verdict'],
}

phase('Merge')
const merged = await agent(
  COMMON +
  '\n\n# 네 일 = 여덟 축을 합쳐 «참인 목록» 하나로 만든다\n\n' +
  '```json\n' + JSON.stringify(scans, null, 1) + '\n```\n\n' +
  '1. **wrong** — 근거가 실물과 안 맞는 지적. **표본으로 직접 열어 확인하라.** 특히 ⓐ이름이 같은 다른 물건을 헷갈린 것 ⓑ절 제목만 보고 본문을 추정한 것 ⓒ「없다」고 썼는데 실은 안 재본 것 ⓓ**교재가 아닌데 교재 오염으로 센 것**(급수 요목·문법 뱅크·학생 수행).\n' +
  '2. **duplicates** — 두 축이 같은 자리를 다르게 적은 것.\n' +
  '3. 🔴 **dont_delete** — **지우면 안 되는 것**. 교재라는 이름이 붙었지만 걷으면 살아 있는 기능이 같이 죽는 자리를 전부 여기 모아라. 발음 데이터 수집(소급 불가)이 그 첫째다. 본세션이 지울 때 이 목록이 벽이 된다.\n' +
  '4. **missed** — 여덟 축이 통째로 못 본 갈래.\n' +
  '5. **verdict** — 유호님이 읽을 한 문단. 「이 문서가 얼마나 낡았나」와 「교재 오염이 얼마나 퍼졌나」를 숫자와 함께. 쉬운 낱말로.',
  { label: 'merge', phase: 'Merge', schema: MERGED }
)

return { merged }
