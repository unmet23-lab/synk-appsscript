// 4-5 「나」(단계 4 계획 §22)의 변형 목록 — 「나」 칸이 읽는 엔진 규칙(요약 칸 넷 · 흔들림 · 또렷함 갈래 · 비우기 · 판 응답 빼기)을
// 하나씩 일부러 깬 사본을 coach 묶음이 잡아야 한다(§22-9 — 엔진 변형 실행기의 새 갈래 「나(4-5)」).
// 변형 하나 = [잡을 묶음, 갈래, 이름, 바꿀 파일, 바꿀 글, 바꾼 글]. 바꿀 글은 그 파일에 꼭 한 번 있어야 한다(test/build/mutants.test.mjs).
const C = 'coach';
const MEMORY = 'src/memory/index.mjs';
const COACH = 'src/coach/index.mjs';

export const ME_MUTANTS = [
  [
    C,
    '나(4-5)',
    '「이미 알아요」를 직접 말함으로 가르지 않는다',
    MEMORY,
    "    if (last === 'known') return 'said';\n",
    '',
  ],
  [
    C,
    '나(4-5)',
    '힌트 뒤 맞힘을 흔들림에 넣지 않는다',
    MEMORY,
    "    if (last === 'again' || last === 'hard' || state.stubborn === true) return 'shaky';\n",
    "    if (last === 'again' || state.stubborn === true) return 'shaky';\n",
  ],
  [
    C,
    '나(4-5)',
    '끈질긴 단위를 흔들림에 넣지 않는다',
    MEMORY,
    "    if (last === 'again' || last === 'hard' || state.stubborn === true) return 'shaky';\n",
    "    if (last === 'again' || last === 'hard') return 'shaky';\n",
  ],
  [
    C,
    '나(4-5)',
    '놓친 적 있는 말의 흔들림에 간격 조건이 없다 — 또렷한 말이 돌아오면 연습 없이 흔들림으로 넘어간다(Fable F3 · 카본 A7)',
    MEMORY,
    "    if (state.lapses >= 1 && recall < params.retention && interval < CLEAR_DAYS) return 'shaky';\n",
    "    if (state.lapses >= 1 && recall < params.retention) return 'shaky';\n",
  ],
  [
    C,
    '나(4-5)',
    '또렷함에 간격 조건이 없다 — 처음 혼자 맞힌 말이 바로 또렷함',
    MEMORY,
    "    if (recall >= params.retention && interval >= CLEAR_DAYS) return 'clear';\n",
    "    if (recall >= params.retention) return 'clear';\n",
  ],
  [
    C,
    '나(4-5)',
    '또렷함의 간격이 7일이 아니다',
    MEMORY,
    'export const CLEAR_DAYS = 7;\n',
    'export const CLEAR_DAYS = 5;\n',
  ],
  [
    C,
    '나(4-5)',
    '요약 단위 줄에 마지막 자리의 결과를 싣지 않는다(§19-1 ⑤)',
    COACH,
    '            last: line.open.grade,\n',
    '            last: null,\n',
  ],
  [
    C,
    '나(4-5)',
    '요약 단위 줄의 갈래를 standing으로 정하지 않는다',
    COACH,
    '            state: memory.standing(line, now),\n',
    '            state: null,\n',
  ],
  [
    C,
    '나(4-5)',
    '요약 단위 줄의 이름이 코치 옵션 label(제품이 이미 연 조각의 이름 사전)을 읽지 않는다',
    COACH,
    '            label: label(unit),\n',
    '            label: state.map.unit(unit)?.label ?? null,\n',
  ],
  [
    C,
    '나(4-5)',
    '판의 끝을 저장된 제시 수로 잰다 — 제시가 모두 저장에 실패한 판이 끝나지 않는다(§22-5 · Fable F6)',
    'src/coach/session.mjs',
    "      journaled(['present', 'say']) > 0 && journaled(['present']) < length && !aged(host.now())\n",
    "      journaled(['present', 'say']) > 0 &&\n      s.journal.filter(op => op.kind === 'present' && kept(op)).length < length &&\n      !aged(host.now())\n",
  ],
];
