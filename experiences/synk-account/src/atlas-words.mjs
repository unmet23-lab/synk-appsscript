// Words for Core's account summary (synk-account ?view=atlas) and the WORLD games with the
// situations they practise. A summary describes choices and practice, never ability or a trait.
export const SETTING_WORDS = { support: { step: '단계별로 도와줘요', choose: '그때그때 맞춰 줘요', independent: '혼자 해 볼게요' },
  textSize: { standard: '보통 글씨', large: '큰 글씨' }, explanation: { brief: '짧은 설명', standard: '보통 설명', detailed: '자세한 설명' },
  motion: { full: '움직임 그대로', reduced: '움직임 줄이기' }, audio: { off: '소리 끄기', available: '소리 쓰기' } };
// Short names of the learning reasons (계약/배우는이유_선택응답_계약.json, every 값; a test keeps them equal).
export const REASON_WORDS = { culture: '드라마·음악·웹툰', travel: '한국 여행', people: '가족·친구와 이야기', life: '한국 생활', study: '한국에서 공부',
  work: '한국에서 일', career: '지금 하는 일', exam: '시험·자격', hobby: '배우는 즐거움', other: '다른 이유' };
// A game names a Strata situation only where that situation is the game's own practice (a café's
// orders, an entrance notice, spoken directions); a game that merely touches many everyday topics
// names none. These links are a draft for teacher review.
export const WORLD_GAMES = Object.freeze([
  { path: 'korean-racing', label: '한국어 레이싱', situations: [] },
  { path: 'korean-runner', label: '바람길', situations: ['sit-travel-directions', 'sit-work-instructions'] },
  { path: 'korean-rhythm', label: '한국어 리듬', situations: [] },
  { path: 'order-rush', label: '주문 폭주', situations: ['sit-travel-order'] },
  { path: 'entry-check', label: '입장 검사', situations: ['sit-life-notice'] },
  { path: 'story-classroom', label: '선생님이 돌아왔다', situations: [] },
  { path: 'blank-slice', label: '빈칸 베기', situations: [] },
].map(game => Object.freeze({ ...game, situations: Object.freeze([...game.situations]) })));

// Practice picked for the declared reasons (at most three): serve as many reasons as possible, each
// game once, and among equal choices keep the earlier reason and situation (the contract's order).
// The line is Vellum's, sent by the server with the situation; a reason no game serves gets no line
// rather than a near match.
export function picksForReasons(forReasons, games = WORLD_GAMES) {
  if (!Array.isArray(forReasons)) return [];
  const options = forReasons.map(entry => (Array.isArray(entry?.situations) ? entry.situations : [])
    .filter(situation => typeof situation?.id === 'string' && typeof situation.line === 'string' && situation.line)
    .flatMap(situation => games.filter(game => game.situations.includes(situation.id)).map(game => ({ entry, situation, game }))));
  let best = [];
  const search = (i, used, chosen) => {
    if (chosen.length + options.length - i <= best.length) return;
    if (i === options.length) { best = chosen; return; }
    for (const option of options[i]) if (!used.has(option.game.path)) search(i + 1, new Set([...used, option.game.path]), [...chosen, option]);
    search(i + 1, used, chosen);
  };
  search(0, new Set(), []);
  return best.map(({ entry, situation, game }) => ({ reason: entry.reason, situation: situation.id, game: game.path, label: game.label, line: situation.line }));
}
