export const meta = {
  name: 'engine7-d-review',
  description: '엔진 7종 상향 설계 ④ — 마지막 비평이 남긴 목록과 사람 검토 축을 저장소 대조 뒤 문서에 닫는다(수리 1 → 확인 1)',
  phases: [
    { title: '수리', detail: '남은 비평 + 검토 축 → 저장소 대조 → 제자리 수리' },
    { title: '확인', detail: '고쳐졌나 · 표 칸 수 · 개수 정합 · 문서 그래프' },
  ],
}

// args = { outDoc, materialsDir, finalCritic, extraChecks }
const REPO = 'C:/Users/q1212/Documents/SYNK-appsscript'
const TALK = 'C:/Users/q1212/Documents/SYNK-talk'
const MEM = 'C:/Users/q1212/.claude/projects/C--Users-q1212-Documents-SYNK-appsscript/memory'
const DOC = args.outDoc
const MAT = args.materialsDir
const CRITIC = args.finalCritic
const EXTRA = args.extraChecks || []

const COMMON = `
【공통 규칙】
- 오늘 2026-09-03 · 개원 2027-02-25 · 학생 0명 · 1인 창업(유호님 비개발자) · 몽골 UB. 저장소 ${REPO} · 앱 ${TALK} · 기억 ${MEM} · 재료 ${MAT}.
- 문서 = ${DOC}. 유호님이 읽을 제안서다 — 시제 규약(없는 것을 있다고 쓰지 않는다) · 숫자엔 자·분모·날짜 · 「0건」과 「안 재봤다」를 가른다 · 낯선 낱말은 그 자리에 뜻 · 결론 먼저 · 한 판정에 자 하나(같은 것을 두 수로 말하지 않는다).
- 비평의 지적은 근거를 대고 오지만 액면 그대로 고치지 않는다 — 먼저 저장소·기억·재료를 열어 참인지 잰다. 참이면 문서 구조를 열어 «어디에 어떻게» 넣을지 정하고 고친다. 거짓이면 안 고치고 그 근거를 적는다.
- 편집은 Edit 로 제자리에서. 표를 고치면 칸 수를 기계로 센다. 수(개수·바이트·줄)를 바꾸면 그 수를 말하는 모든 자리를 grep 으로 찾아 같이 고친다.
- 출력은 다음 단계가 읽는 데이터다. 한국어. 서론 없이.
`

const FIX_SCHEMA = {
  type: 'object',
  required: ['fixed', 'rejected', 'doc_bytes'],
  properties: {
    fixed: { type: 'array', items: { type: 'object', required: ['item', 'where', 'what'], properties: { item: { type: 'string' }, where: { type: 'string' }, what: { type: 'string' } } } },
    rejected: { type: 'array', items: { type: 'object', required: ['item', 'why'], properties: { item: { type: 'string' }, why: { type: 'string' } } } },
    doc_bytes: { type: 'integer' },
  },
}

function fixPrompt() {
  return `${COMMON}
【과제】 ④ 사람 검토 단계. 아래 두 목록을 전부 처리한다 — 고치거나(fixed) 근거를 대고 기각한다(rejected). 하나도 빠뜨리지 않는다.
㉠ 마지막 완결 비평이 남긴 목록(수리 회전이 안 돌아 그대로 남았다): ${JSON.stringify(CRITIC)}
㉡ 사람 검토 축(본세션이 건 것): ${JSON.stringify(EXTRA)}
읽는다: 문서 전문(큰 파일이니 grep·offset 으로) · 필요한 재료(${MAT}/통합.json · ${MAT}/수리_<엔진>.json · ${MAT}/철학.json · ${MAT}/횡단.json) · 저장소 실물 · 기억 파일(${MEM}/yuho-open-decisions.md 등).
끝나면 문서 바이트 수를 wc -c 로 재서 doc_bytes 에 넣는다.`
}

const CHECK_SCHEMA = {
  type: 'object',
  required: ['ok', 'problems', 'counts'],
  properties: {
    ok: { type: 'boolean' },
    problems: { type: 'array', items: { type: 'string' } },
    counts: { type: 'object', additionalProperties: true },
  },
}

function checkPrompt(fix) {
  return `${COMMON}
【과제】 ④ 수리가 실제로 됐는지 «기계로» 확인한다. 수리 보고: ${JSON.stringify(fix)}
검사: ① fixed 항목마다 문서에서 그 자리를 grep 으로 찾아 고쳐졌는지 본다 ② 마크다운 표 전량의 칸 수가 헤더와 같은가(줄마다 | 개수를 세는 짧은 node/python 로 잰다) ③ 「유호님이 정하실 것 N개」 같은 개수 주장이 §0·§12 제목·§12-0 표 행 수·### D 제목 수와 다 같은가 ④ 「재반박」이 «했다»로 적힌 자리가 0인가(뺀 단계) ⑤ node ${REPO}/tools/doc-graph.js 를 돌려 이 문서가 빨강·경고에 뜨는가 ⑥ 문서 머리 3줄(정본·파생·유호 지시)이 서 있나.
problems 에는 남은 문제를 «자리 + 무엇»으로, counts 에는 잰 수(바이트·줄·D 개수·표 불일치 수·doc-graph 언급 수)를 넣는다. ok 는 problems 가 0 일 때만 true. 고치지는 않는다.`
}

log('④ 수리 → 확인')
const fix = await agent(fixPrompt(), { label: '④수리:정본', phase: '수리', schema: FIX_SCHEMA, effort: 'high' })
const check = fix ? await agent(checkPrompt(fix), { label: '④확인', phase: '확인', schema: CHECK_SCHEMA, effort: 'medium' }) : null
return { fix, check }
