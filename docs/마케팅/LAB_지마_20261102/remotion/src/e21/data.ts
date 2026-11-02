// LAB 영어 E21 「-지 마 = don't」 화면 글 정본. 읽기 줄은 영어 편 규칙대로 로마자(개정 표기, 음절 사이 붙임표).
export const TEXT = {
  rule: "don't",
  last: 'That suitcase…\nit was his last day here.',
};

// 이야기 줄 — 말풍선이 아니라 화면 아래 · 위의 작은 자막(장면을 덮지 않게)
export const CAPTION = {
  last: 'His last day at the café.',
  // v7 「He was saving it for you…」(쪽지 앞) · v8 (끝 3초)도 시험했으나 쪽지를 발견하기 전에 말하거나 여운을 깎아 v6 판으로 둔다(기획.md 「이해 시험」)
  note: 'He left a note…',
};

// tip = 말풍선 꼬리 끝(화면 1080×1920 좌표)
export type Line = { ko: string; read: string; en: string; vo: string; left: number; width: number; tip: [number, number]; top?: number };
export const LINES: Line[] = [
  { ko: '먹지 마!', read: 'meok-ji ma', en: "Don't eat it!", vo: 'm1', left: 60, width: 640, tip: [700, 640] },
  // 앞치마 판은 바리스타 머리가 화면 440부터라 말풍선을 조금 올린다
  { ko: '입지 마!', read: 'ip-ji ma', en: "Don't wear it!", vo: 'm2b', left: 30, width: 600, tip: [560, 520], top: 180 },
  // 뒷문 판은 바리스타 머리가 화면 384부터라 말풍선을 위로 올린다
  { ko: '열지 마!', read: 'yeol-ji ma', en: "Don't open it!", vo: 'm3', left: 360, width: 640, tip: [640, 450], top: 110 },
  { ko: '가지 마…', read: 'ga-ji ma', en: "Don't go…", vo: 'm4', left: 60, width: 640, tip: [320, 690] },
  { ko: '울지 마.', read: 'ul-ji ma', en: "Don't cry.", vo: 'm5', left: 50, width: 450, tip: [560, 660] },
  // 끝 — 쪽지의 말. 「먹지 마!」에서 「지 마」가 떨어져 「먹어.」가 된다(Flip)
  { ko: '먹어.', read: 'meo-geo', en: 'Eat it.', vo: 'm6', left: 240, width: 600, tip: [0, 0] },
];
