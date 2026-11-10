// 사건 2판의 이름표(설계 §5-1). 단계 2(접기의 입력)와 단계 3(기록 포트 · 서버 접기)이 같은 이름을 쓰도록 한 곳에 둔다.
// 단계 0은 이름과 칸만 적는다 — 꼴 검사와 사건 만들기는 단계 3이 이 파일에 짓는다. 칸 이름은 단계 0이 고른 출발 이름이고,
// 단계 3이 서버(SYNK-talk의 사건 표)와 맞대어 처음 쓸 때 확정한다. 그 전에 바꿔도 되지만 여기 한 곳에서만 바꾼다.
//
// 지키는 것(지금 계약 그대로): 사건 꼴의 뼈대(제시 → 소리 전달 → 도움 → 답), 제외와 철회, 답 글과 신원을 싣지 않는 규칙.
// 응답 시간 · 글 · 음성은 넣지 않는다(§14-1). 학습자에게서 새로 받는 것은 본인 말 둘과 「모르겠어요」뿐이다.

// 사건마다 꼴 번호가 있어 서버와 기기가 옛 꼴(1)과 새 꼴(2)을 갈라 읽는다(§5-6).
export const EVENT_FORM = Object.freeze({ legacy: 1, current: 2 });

export const EVENT_TYPES = Object.freeze({
  presented: 'practice.presented',
  delivery: 'practice.delivery',
  helped: 'practice.helped',
  attempted: 'practice.attempted',
  excluded: 'record.excluded',
  // 새 사건 둘
  stated: 'unit.stated',
  carried: 'record.carried',
  // 연습 한 판 단위로만 남는다 — 문항마다 붙던 decision.made · experience.completed는 없앤다
  setDecided: 'decision.made',
  setCompleted: 'experience.completed',
  feedback: 'feedback.given',
});

// 2판 사건이면 모두 싣는 칸: 꼴 번호와 만든 때의 동의 판 번호(서버는 지금 판과 같은 것만 받는다 — §5-3).
export const COMMON_FIELDS_V2 = Object.freeze(['form', 'consentEpoch']);

// 제시 사건에 더하는 칸(엔진이 낸 값이다). 나머지 칸 — 문항 · 계열 · 능력 · 난도 · 응답 꼴 · 영역 · 소리 필요 · units ·
// 첫 만남 여부 — 은 지금 꼴(atlas/trail.js) 그대로다.
export const PRESENTED_FIELDS_V2 = Object.freeze({
  // 판 이름 — 기억 · 난도 · 고르기 · 문항 색인
  editions: Object.freeze(['memory', 'ability', 'select', 'index']),
  // 예상 성공 확률 — 찍기 바닥 · 기억 항 · 능력 항을 따로(§3-4)
  expected: Object.freeze(['floor', 'memory', 'skill']),
  // 회차 구분 — 맞춤 / 기본 / 채우기
  arm: Object.freeze(['adaptive', 'baseline', 'filler']),
  // 보여 준 이유 — 종류와 근거 칸, 겨눈 단위 · 층 · 이 제시로 처음 낸 단위들(실패를 적을 단위와 하루 한도를 사건만 보고 안다)
  reason: Object.freeze(['code', 'slots', 'evidence', 'target', 'tier', 'introduced']),
  // 연습 한 판 번호
  set: Object.freeze(['setId']),
});

// 답 사건의 결과 값 하나 더 — 「모르겠어요」(제품이 그 선택지를 둔 고르는 꼴 문항에서만). 놓침으로 친다(§3-2).
export const ATTEMPT_UNKNOWN = 'unknown';

// 본인이 직접 누른 말 — 「이미 알아요」 · 「다시 배울래요」. 다른 사건처럼 record.excluded로 거둘 수 있다.
export const STATED_SAYS = Object.freeze(['known', 'relearn']);

// 옮겨 온 장부 — 이번에 새로 든 계열의 만난 표 · 앞 장부를 뜬 때(처음이면 없음) · 칸 요약(처음 옮길 때만, 보여 주기만 한다).
export const CARRIED_FIELDS = Object.freeze(['families', 'after', 'cells']);
