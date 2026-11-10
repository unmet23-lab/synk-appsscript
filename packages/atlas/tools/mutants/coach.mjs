// 코치 3판(단계 4)의 변형 목록 — 코치의 규칙을 하나씩 일부러 깬 사본을 coach · unit 묶음이 잡아야 한다(단계 4 계획 §11 시험 10).
// 변형 하나 = [잡을 묶음, 갈래, 이름, 바꿀 파일, 바꿀 글, 바꾼 글]. 바꿀 글은 그 파일에 꼭 한 번 있어야 한다(test/build/mutants.test.mjs).
// 코치의 규칙을 더하거나 고치면 여기에 깬 변형을 함께 더한다.
const C = 'coach';
const SESSION = 'src/coach/session.mjs';
const HOST = 'src/coach/host.mjs';
const FIELDS = 'src/coach/fields.mjs';

export const COACH_MUTANTS = [
  [
    C,
    '저장 실패',
    '저장이 실패한 답도 판 상태를 다시 세울 때 돌린다',
    SESSION,
    'if (!s.failed.has(op.eventId) && !s.failed.has(op.parent)) replay(tmp, op);',
    'replay(tmp, op);',
  ],
  [
    C,
    '호스트',
    '지도를 기록부를 연 뒤에 넣는다(요약 판 묶음이 엇갈린다)',
    HOST,
    '  if (map) index.add(map);',
    '',
  ],
  [
    C,
    '제시 칸',
    '처음 낸 단위를 사건에 싣지 않는다(하루 한도가 사건만 보고 서지 않는다)',
    FIELDS,
    'introduced: [...row.brandNew],',
    'introduced: [],',
  ],
  [
    C,
    '판 열기',
    '판이 없을 때 present가 판을 먼저 열지 않는다(제품 순서 문항 · 아르곤 A2)',
    SESSION,
    'const ensure = () => (s.learner?.session ? s.learner : openSet({}));',
    'const ensure = () => s.learner;',
  ],
  [
    'unit',
    'Vellum',
    '그 언어 줄이 없으면 한국어로 물러선다',
    'src/vellum/index.mjs',
    '  const row = TABLE[lang]?.[code];',
    '  const row = TABLE[lang]?.[code] ?? TABLE.ko[code];',
  ],
];
