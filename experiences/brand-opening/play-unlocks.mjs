// 「놀이」 해금 표(2026-11-03, 설계 docs/제2의나_설계_20261102.md 11 · 11-1): 미니게임은 이야기 장면에서 열리고, 열린 뒤에는 「놀이」에서 언제든 한다.
// 표 한 줄 = 놀이 id → where(여는 자리 · 화면 글 키) + open(record)(학생 기록으로 열렸는지). 표에 없는 놀이는 늘 열려 있다.
// 잠긴 놀이도 목록에 이름과 「이야기에서 열려요 — 여는 자리」 한 줄로 보인다(무엇이 남았는지 알아야 다음 이야기를 열 까닭이 된다).
// 바람길 · 한글 만나기 · 말의 리듬은 이 표 전부터 열려 있던 놀이라 그대로 둔다 — 말의 리듬은 축제 무대 연습 회차가 생기면 그 기록으로 옮긴다(11-1 순서 ②).
export const PLAY_UNLOCKS = Object.freeze({
  // 주문 폭주: 싱크타운 카페 알바 시작에서 열린다. 지금 앱의 싱크타운 카페 이야기는 첫 방문(cafe-apply) 하나라 그 완료를 기록으로 읽는다 —
  // 1화 뒤 카페 알바 장면이 생기면 그 장면의 기록으로 바꾼다.
  order: Object.freeze({ where: 'play.where.cafe', open: (record) => record.cafeVisits >= 1 }),
});

/** 홈이 들고 있는 생활 진도(updateLearning의 summary)에서 해금에 쓰는 기록만. 아직 못 읽었으면 null(잠김으로 본다). */
export function playRecord(learningData) {
  const summary = learningData?.summary;
  if (!summary || summary.status?.phase === 'loading') return null;
  return Object.freeze({ cafeVisits: Number(summary.cafe?.completed) || 0 });
}

/** 놀이 하나의 상태: { open } 또는 { open:false, where }. 규칙이 던지거나 기록이 없으면 잠김. */
export function playState(id, record) {
  const rule = PLAY_UNLOCKS[id];
  if (!rule) return { open: true };
  let open = false;
  try { open = !!record && rule.open(record) === true; } catch { open = false; }
  return open ? { open: true } : { open: false, where: rule.where };
}
