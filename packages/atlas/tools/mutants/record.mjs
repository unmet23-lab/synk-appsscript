// 기록 · 저장(단계 3)의 변형 목록 — 저장 규칙을 하나씩 일부러 깬 사본을 record 묶음(장면 · 서버 접기 · 기기 얹기 · 측정 계약 임의 시험)이
// 모두 잡아야 한다(설계 §11 · 단계 3 계획 §7). 변형 하나 = [잡을 묶음, 갈래, 이름, 바꿀 파일, 바꿀 글, 바꾼 글].
// 바꿀 글은 그 파일에 꼭 한 번 있어야 한다(test/build/mutants.test.mjs가 본다). 저장 규칙을 더하거나 고치면 여기에 깬 변형을 함께 더한다.
const R = 'record';
const SERVER = 'src/record/server.mjs';
const ADAPT = 'src/record/adapt.mjs';
const LOG = 'src/record/log.mjs';
const OWN = 'src/record/own.mjs';
const ROWS = 'src/record/rows.mjs';
const EVENTS = 'src/record/events.mjs';

export const RECORD_MUTANTS = [
  // ── 저장 · 올리기 — 부모 없는 자식이 올리기를 막지 않게, 저장소가 요약 수만큼 커지지 않게(Fable 끝 판 P1 둘 · P2) ──
  [
    R,
    '기기',
    '부모 저장이 실패해도 자식을 쓴다(서버가 받지 못할 사건이 대기열 맨 앞에 남는다)',
    LOG,
    'if (state.unsaved.has(parentOf(event))) {',
    'if (false) {',
  ],
  [
    R,
    '사건 꼴',
    '받지 못한 답의 차례를 되돌리지 않는다(건너뛴 차례 뒤의 맞는 답까지 뺀다)',
    EVENTS,
    'if (attempt) attempts.set(event.presentationId, before);',
    'void before;',
  ],
  [
    R,
    '기기',
    '새 요약이 서도 앞 요약 기록을 지우지 않는다(받을 때마다 요약이 쌓인다)',
    LOG,
    'if (next) await dropRows(state.summaryRows, state.summaryKey);',
    'void next;',
  ],
  [
    R,
    '기기',
    '꼬리 읽기를 내 덧붙이기 자리부터 한다(다른 탭이 먼저 쓴 기록을 건너뛴다)',
    LOG,
    'for (const row of await port.range(state.readKey)) {',
    'for (const row of await port.range(state.lastKey)) {',
  ],
  // ── 어댑터 — 2판 제시의 firstExposure false(제품만 아는 앞선 노출)는 장부 만남, null은 읽지 않음(계획 §14-8) ──
  [
    R,
    '어댑터',
    '2판 제시의 firstExposure false를 읽지 않는다(이미 본 지문의 답을 처음 본 답으로 센다)',
    ADAPT,
    'isCurrent(presented) ? presented.firstExposure === false : presented.firstExposure !== true;',
    'isCurrent(presented) ? false : presented.firstExposure !== true;',
  ],
  [
    R,
    '어댑터',
    '2판 제시의 firstExposure null(모름)도 앞선 만남으로 센다',
    ADAPT,
    'isCurrent(presented) ? presented.firstExposure === false : presented.firstExposure !== true;',
    'isCurrent(presented) ? presented.firstExposure !== true : presented.firstExposure !== true;',
  ],
  [
    R,
    '어댑터',
    '장부 만남의 차례 열쇠를 그 첫 만남 사건이 아니라 제시 열쇠로 둔다(눌린 같은 시각에서 다른 제시의 먼저 낸 답을 앞지른다)',
    ADAPT,
    'id: justBefore(first.key),',
    'id: `${state.presentationKey}.prior`,',
  ],
  [
    R,
    '기기',
    '2판 제시의 장부 만남을 얹지 않는다(이미 본 지문의 답을 처음 본 답으로 얹는다)',
    OWN,
    'return isPrior(fold) && firstMeetingPending(folds, pending);',
    'return false;',
  ],
  // ── 서버 접기 — 닿은 것만 다시 접은 줄 = 처음부터 전부, 표지는 접은 데까지(§5-3 · 4차 「접기 표지」) ──
  [
    R,
    '서버 접기',
    '표지를 접은 데보다 앞(로그 끝)으로 올린다',
    SERVER,
    'const until = records.at(-1).seq;',
    'const until = await store.maxSeq();',
  ],
  [
    R,
    '서버 접기',
    '근거 줄을 묶음마다 다시 짓지 않고 처음 한 번만 짓는다(사건 종류마다 고치는 길)',
    SERVER,
    'if (!same(before, after)) await store.replaceRows(sourceId, after);',
    'if (!before.length) await store.replaceRows(sourceId, after);',
  ],
  [
    R,
    '서버 접기',
    '계열이 닿아도 그 계열에 서는 다른 능력은 다시 접지 않는다',
    SERVER,
    'for (const row of rows) if (row.skill) touched.skills.add(row.skill);',
    'void rows;',
  ],
  [
    R,
    '서버 접기',
    '묶음을 읽을 때 이번 접기의 끝 차례 뒤의 사건까지 넣는다(Fable P2-6)',
    SERVER,
    'const group = groupEntries(await store.group(sourceId, until));',
    'const group = groupEntries(await store.group(sourceId));',
  ],
  [
    R,
    '시각과 차례',
    '서버가 받은 시각으로 누르지 않는다(4차 「시각과 차례」)',
    SERVER,
    'atMs: Math.min(at, receivedMs),',
    'atMs: at,',
  ],
  // ── 어댑터 — 측정 계약 · 등급(§5-2 · §3-2 · Fable P1-1) ──
  [
    R,
    '어댑터',
    '답 뒤에 본 도움을 만남으로 내지 않는다 — 이어서 혼자 맞힌 수가 안 끊긴다(Fable P1-1)',
    ADAPT,
    'if (!state.firstHelp) state.firstHelp = entry;',
    'if (!state.answered && !state.firstHelp) state.firstHelp = entry;',
  ],
  [
    R,
    '어댑터',
    '해설을 본 뒤 맞힘을 놓침으로 치지 않는다',
    ADAPT,
    "const SHOWN = new Set(['explanation', 'answer']);",
    "const SHOWN = new Set(['answer']);",
  ],
  [
    R,
    '어댑터',
    '거둔 전달을 아직 증거로 쓴다',
    ADAPT,
    "state.audio = context.targets.has(event.id) ? 'pending' : event.audio;",
    'state.audio = event.audio;',
  ],
  [
    R,
    '측정 계약',
    '옛 꼴 제시의 firstExposure(앞선 만남 · 이력 모름)를 버린다',
    ADAPT,
    'isCurrent(presented) ? presented.firstExposure === false : presented.firstExposure !== true;',
    'isCurrent(presented) ? presented.firstExposure === false : false;',
  ],
  [
    R,
    '사건 꼴',
    '2판 답의 부모로 옛 꼴 제시를 받는다',
    EVENTS,
    'if (!parent || parent.schema !== EVENT_FORM.current || !wanted.includes(parent.type))',
    'if (!parent || !wanted.includes(parent.type))',
  ],
  // ── 기기 — 얹거나 기다린다, 받았다 ≠ 접었다(§5-4 · 4차 「접기 표지」) ──
  [
    R,
    '기기',
    '서버가 누른 사건이 요약에 들기 전에도 얹는다',
    LOG,
    'if ([...pending].some(id => state.clamped.has(id))) return [WAIT];',
    'void WAIT;',
  ],
  [
    R,
    '기기',
    '받은 표지만으로 접혔다고 본다(받았다 = 접었다)',
    LOG,
    'seq <= state.summary.foldedUntil',
    'true',
  ],
  [
    R,
    '기기',
    '두 탭이 덧붙인 요약 가운데 갱신 차례가 작은 것도 쓴다',
    LOG,
    'next.lineSeq >= current.lineSeq',
    'true',
  ],
  [
    R,
    '기기',
    '아직 요약에 안 든 내 답을 이미 접힌 제외가 거둬도 얹는다',
    OWN,
    'if (pending.has(fold.ref)) out.push(fold);',
    'void 0;',
  ],
  [
    R,
    '기기',
    '전달을 거두어 접힌 답의 판정이 바뀌어도 기다리지 않는다',
    OWN,
    '...deliveryWaits(group, pending, touches),',
    '',
  ],
  [
    R,
    '기기',
    '접힌 장부를 거두어도 기다리지 않는다',
    OWN,
    'if (carryPulled(group, pending)) return [WAIT];',
    'void carryPulled;',
  ],
  [
    R,
    '기기',
    '계열 줄에 그 계열의 능력들을 싣지 않는다(내 이른 답이 첫 만남을 가져갈 때 기다릴 능력을 모른다)',
    ROWS,
    'const skills = [...new Set(rows.filter(row => row.skill).map(row => row.skill))].sort();',
    'const skills = [];',
  ],
];
