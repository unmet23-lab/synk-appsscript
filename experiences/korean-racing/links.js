// 다른 게임(바람길·말의 리듬)으로 가는 링크. 같은 브라우저 저장 공간(공통 코인·학습 기록)을 함께 쓰도록 이 페이지가 열린 자리에 맞춘다.
// 학습 허브(/korean-racing/) → /korean-runner/, 공개 사이트(/try/racing/) → /try/runner/, 레이싱 패키지·로컬 서버 → ./play/runner/
// index.html의 바람길·리듬 링크(/play/runner/·/play/rhythm/)는 두 번씩 있다(입구 하는 방법 · 결과 다음 레이스). 공개 동기화(SYNK-website sync-play-games.mjs)가 그 횟수를 확인한다.
export const GAME_LINKS = [['runner-play', 'runner'], ['rhythm-play', 'rhythm'], ['runner-play-next', 'runner'], ['rhythm-play-next', 'rhythm']];

export function gameHref(game, pathname, href) {
  if (pathname.startsWith('/korean-racing/')) return `/korean-${game}/`;
  if (pathname.startsWith('/try/')) return `/try/${game}/`;
  return new URL(`./play/${game}/`, href).href;
}

export function wireGameLinks(doc = document, loc = location) {
  for (const [id, game] of GAME_LINKS) {
    const link = doc.getElementById(id);
    if (link) link.href = gameHref(game, loc.pathname, loc.href);
  }
}
