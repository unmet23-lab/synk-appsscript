// MT 바닷가 자전거 레이스(WORLD 판)의 인물 말(설계 qa/world-mt-20261104/설계.md 5절). 게임 말풍선 · 목소리 굽기가 이 표 하나를 함께 쓴다.
// 태오 선배는 드라마 1화의 말씨(해요체)와 같은 배역 목소리다. 동기는 2화 인물이 정해질 때까지 목소리 없이 말풍선만.
export const TAEO_LINES = Object.freeze({
  start: { text: '꼴찌가 오늘 설거지예요!', tag: 'playful, teasing' },
  ahead: { text: '먼저 갈게요~', tag: 'cheerful, teasing' },
  passed: { text: '어? 벌써요?', tag: 'surprised, laughing' },
  praise: { text: '오, 제법인데요?', tag: 'impressed' },
  win: { text: '졌어요. 설거지는 제가 할게요.', tag: 'wry, good-natured' },
  mid: { text: '오늘 설거지는 저 아니에요!', tag: 'delighted, teasing' },
  lose: { text: '자, 고무장갑 여기요!', tag: 'teasing, cheerful' },
});
export const HARIN_LINES = Object.freeze({ ahead: { text: '먼저 갈게.' }, passed: { text: '따라왔네?' } });
export const lineOf = (who, key) => (who === 'taeo' ? TAEO_LINES : HARIN_LINES)[key] || null;
/** 꼴찌 → 결과 사진 · 한 줄 · 태오 말. 판돈은 꼴찌가 오늘 저녁 설거지(내 순위가 아니라 실제 꼴찌로 정한다). */
export const RESULT_BY_LAST = Object.freeze({
  taeo: { photo: 'assets/world/mt-win.webp', line: '태오 선배가 오늘 설거지', voice: 'win' },
  harin: { photo: 'assets/world/mt-mid.webp', line: '하린 씨가 오늘 설거지', voice: 'mid' },
  me: { photo: 'assets/world/mt-lose.webp', line: '오늘 설거지는 내 차례', voice: 'lose' },
});
