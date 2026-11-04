// 「놀이」 해금 표(2026-11-03, 설계 docs/제2의나_설계_20261102.md 11 · 11-1): 미니게임은 이야기 장면에서 열리고, 열린 뒤에는 「놀이」에서 언제든 한다.
// 표 한 줄 = 놀이 id → where(여는 자리 · 화면 글 키) + open(record)(학생 기록으로 열렸는지). 표에 없는 놀이는 늘 열려 있다.
// 잠긴 놀이도 목록에 이름과 「이야기에서 열려요 — 여는 자리」 한 줄로 보인다(무엇이 남았는지 알아야 다음 이야기를 열 까닭이 된다).
// 바람길 · 한글 만나기 · 말의 리듬은 이 표 전부터 열려 있던 놀이라 그대로 둔다 — 말의 리듬은 축제 무대 연습 회차가 생기면 그 기록으로 옮긴다(11-1 순서 ②).
export const PLAY_UNLOCKS = Object.freeze({
  // 게시판 해독(11-04, 설계 board-decode/설계.md 7절): 이야기가 아니라 실력 기록으로 열린다 — 가장 최근 TOPIK II 첫 답 6개 가운데 4개(싱크타운 입장 길 ②와 같은 말).
  // 그 수는 오답으로 도로 떨어질 수 있어, 한 번 「새로 열림」을 본 놀이는 닫지 않는다(sticky). 잠김 글은 「이야기에서 열려요」가 아니다(lockOnly).
  board: Object.freeze({ where: 'play.locked.level', lockOnly: true, sticky: true, open: (record) => record.topik2Near === true }),
  // 주문 폭주: 싱크타운 카페 알바 시작에서 열린다. 지금 앱의 싱크타운 카페 이야기는 첫 방문(cafe-apply) 하나라 그 완료를 기록으로 읽는다 —
  // 1화 뒤 카페 알바 장면이 생기면 그 장면의 기록으로 바꾼다.
  order: Object.freeze({ where: 'play.where.cafe', open: (record) => record.cafeVisits >= 1 }),
  // 말의 리듬: 지금은 늘 열려 있다(11-04 캠퍼스 판 겉까지 마침). 축제 무대 연습 · 아이돌 꿈 연습실 회차가 생기면 그 기록과 화면 글 키로 이 자리에 한 줄:
  // rhythm: Object.freeze({ where: 'play.where.festival', open: (record) => record.festivalRehearsals >= 1 }),
  // 빈칸 베기(11-04): 이야기 자리는 중간고사 전날 밤 도서관(3급 뼈대 U08). 그 회차가 아직 없어 가장 가까운 공부 기록 — 레슨 한 번 — 으로 열고,
  // 카페 첫 방문을 먼저 한 학생도 막지 않는다(엄격하게 막지 않는다). 중간고사 회차가 생기면 그 기록으로 옮긴다.
  blank: Object.freeze({ where: 'play.where.lesson', open: (record) => record.lessons >= 1 || record.cafeVisits >= 1 }),
  // 찰칵 낱말(11-04): 드라마 1화 기록이 아직 홈에 없어, 이름표를 읽고 찾는 이야기(greetings-story)가 든 첫 묶음 「처음 만난 날」을 두 강 이상 들으면 연다.
  // 강 순서를 강제하지 않아 그 강이라는 보장은 없지만, 엄격하게 막지 않는 임시 자리다. 1화 기록이 홈에 오면 그 기록으로 옮긴다.
  snap: Object.freeze({ where: 'play.where.stories', open: (record) => record.greetingLessons >= 2 }),
  // MT 바닷가 자전거 레이스(11-04, 설계 korean-racing/qa/world-mt-20261104/설계.md): 동아리 MT 회차가 아직 없어 가장 가까운 이야기 기록으로 연다 —
  // 지도 찾기 이야기(거꾸로 든 지도) 한 번. MT 회차가 생기면 그 회차의 기록으로 바꾼다.
  racing: Object.freeze({ where: 'play.where.directions', open: (record) => record.directionsDone >= 1 }),
  // 말 랠리(11-04, 설계 talk-rally/qa/world-campus-20261104/설계.md): 동아리 탁구 회차가 아직 없어 빈칸 베기와 같이 가장 가까운 공부 기록 — 레슨 한 번(카페 첫 방문을 먼저 한 학생도 막지 않는다). 그 회차가 생기면 그 기록으로 옮긴다.
  rally: Object.freeze({ where: 'play.where.lesson', open: (record) => record.lessons >= 1 || record.cafeVisits >= 1 }),
  // 환승 러시: 이야기 자리는 1화 아침인데 드라마 기록이 생활 요약에 없어, 가장 가까운 이야기 기록인 레슨 하나를 마침으로 연다(설계 9절) —
  // 1화에 등굣길 장면이 생기면 그 기록으로 바꾼다.
  subway: Object.freeze({ where: 'play.where.lesson', open: (record) => record.lessons >= 1 }),
});

// 대신하는 놀이가 그 학생에게 열리면 「놀이」 목록에서 그 자리를 이어받는다. 잠겨 있는 동안은 그대로 있어 듣기 놀이가 비지 않는다.
// 게임 자체는 그대로 남는다(WORLD 듣기 확인 도구 · 계획 줄이 쓴다) — 목록의 카드만 바뀐다.
export const PLAY_REPLACED_BY = Object.freeze({ runner: 'subway' });

/** 홈이 들고 있는 생활 진도(updateLearning의 summary)에서 해금에 쓰는 기록만. 아직 못 읽었으면 null(잠김으로 본다). */
export function playRecord(learningData, extra = null) {
  const summary = learningData?.summary;
  if (!summary || summary.status?.phase === 'loading') return null;
  const packs = Array.isArray(summary.packs) ? summary.packs : [];
  return Object.freeze({ topik2Near: extra?.topik2Near === true, cafeVisits: Number(summary.cafe?.completed) || 0, lessons: Number(summary.completed) || 0, greetingLessons: Number(packs.find((pack) => pack?.id === 'greetings')?.completed) || 0, directionsDone: Number(packs.find((pack) => pack?.id === 'directions')?.completed) || 0 });
}

/** 「놀이」 목록의 차례. 대신하는 놀이가 열렸으면 앞 놀이의 자리에 놓고 앞 놀이는 뺀다. */
export function playOrder(ids, record) {
  const successors = Object.values(PLAY_REPLACED_BY), out = [];
  for (const id of ids) {
    const next = PLAY_REPLACED_BY[id];
    if (next && playState(next, record).open) out.push(next);
    else if (!successors.includes(id) || !playState(id, record).open) out.push(id);
  }
  return out;
}

/** 놀이 하나의 상태: { open } 또는 { open:false, where }. 규칙이 던지거나 기록이 없으면 잠김. */
export function playState(id, record, seen = null) {
  const rule = PLAY_UNLOCKS[id];
  if (!rule) return { open: true };
  if (rule.sticky && Array.isArray(seen) && seen.includes(id)) return { open: true };
  let open = false;
  try { open = !!record && rule.open(record) === true; } catch { open = false; }
  return open ? { open: true } : { open: false, where: rule.where, ...(rule.lockOnly ? { lockOnly: true } : {}) };
}
