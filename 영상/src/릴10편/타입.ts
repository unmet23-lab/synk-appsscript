export type Beat = {start: number; seconds: number; type: 'hook'|'reveal'|'phrase'|'use'|'gift'; ko: string; mn: string};
export type Item = {labelMn: string; ko: string; mn: string};
export type Reel = {
  id: string; topic: string; titleKo: string; hookMn: string; hookKo: string;
  keywordMn: string; mascot: '몽글'|'까몽'; assetName: string; beats: Beat[];
  gift: {titleKo: string; titleMn: string; introMn: string; items: Item[]; noteMn: string};
  ctaMn: string; captionMn: string; replyMn: string; sourceNotes: string[];
};
export const seconds = (r: Reel) => Math.max(...r.beats.map(b => b.start + b.seconds));

/** 긴 복사용 문장은 줄이지 않는다. 같은 자료 안에서 장을 나눈다. */
export const giftPages = (r: Reel): Item[][] => {
  const pages: Item[][] = []; let page: Item[] = []; let used = 0;
  for (const item of r.gift.items) {
    const lines = 2 + Math.ceil(item.ko.length / 29) + Math.ceil(item.mn.length / 42);
    if (used + lines > 22 && page.length) {pages.push(page); page = []; used = 0;}
    page.push(item); used += lines;
  }
  if (page.length) pages.push(page);
  return pages;
};
