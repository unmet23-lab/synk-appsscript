// 말 랠리 안내 음성(나레이션, 2026-10-07) — 게임이 읽는 목록. 문장과 파일 자리만 둔다.
// 판이 바뀌는 때에만 튼다(한 판 시작·연습 공 뒤·결과). 주고받는 동안과 몽글의 말 위에는 틀지 않는다(app.mjs).
// 몽글과 헷갈리지 않게 다른 목소리로 미리 구웠다(scripts/generate-narration.py — 만든 설정은 assets/narration/*.source.json에만 있고 공개 묶음에서 빠진다).
// 화면에도 같은 문장을 보인다(안내 글·결과 제목).
const line = (id, text) => ({ id, text, file: `assets/narration/${id}.mp3` });

export const NARRATION = {
  intro: line('intro', '몽글이 말을 걸어요. 알맞은 대답으로 받아쳐요!'),
  practiceDone: line('practice-done', '좋아요! 이제 시작해요.'),
  dailyIntro: line('daily-intro', '하루 도전이에요. 오늘은 모두 같은 열두 번이에요.'),
  dailyBest: line('daily-best', '오늘 최고 기록이에요!'),
  result3: line('result-3', '완벽해요! 모두 받아쳤어요.'),
  result2: line('result-2', '아주 잘했어요!'),
  result1: line('result-1', '잘했어요! 조금만 더 해 봐요.'),
  result0: line('result-0', '괜찮아요. 다시 해 볼까요?'),
};
export const NARRATION_LINES = Object.values(NARRATION);

/** 결과의 별 수(0~3)에 맞는 안내. 화면에는 첫 문장을 제목으로, 나머지를 그 아래 한 줄로 보인다. */
export function resultLine(stars) {
  const n = NARRATION[`result${Math.max(0, Math.min(3, stars | 0))}`];
  const m = /^(.+?[.!?])\s+(.+)$/.exec(n.text);
  return { ...n, title: m ? m[1] : n.text, say: m ? m[2] : '' };
}
