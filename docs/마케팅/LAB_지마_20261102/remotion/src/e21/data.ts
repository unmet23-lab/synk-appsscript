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

// 두 채널 판(11-03) — 샤오훙수 간체 · 틱톡 버마어. 한국어(말풍선 한글 · 목소리)와 로마자 읽기는 그대로, 뜻 · 이야기 자막만 그 나라 말로(현지어 세 겹 — ../게시/검문).
// c = 「지 마」와 같은 색으로 묶는 자리(영어 Don't · 간체 别 · 버마어 မ…နဲ့). 끝의 먹어 칸은 뜻 줄의 색칠한 자리가 떨어진다.
export type Loc = 'en' | 'zhs' | 'my';
export type Seg = { t: string; c?: boolean };
export type LocPack = { font: string; lineH: number; size: number; capSize: number; means: Seg[][]; caption: { last: string; note: string } };
export const LOCS: Record<Loc, LocPack> = {
  en: {
    font: "'Inter Tight', 'SUIT', sans-serif",
    lineH: 1.2,
    size: 58,
    capSize: 60,
    means: [
      [{ t: "Don't", c: true }, { t: ' eat it!' }],
      [{ t: "Don't", c: true }, { t: ' wear it!' }],
      [{ t: "Don't", c: true }, { t: ' open it!' }],
      [{ t: "Don't", c: true }, { t: ' go…' }],
      [{ t: "Don't", c: true }, { t: ' cry.' }],
      [{ t: 'Eat it.' }],
    ],
    caption: CAPTION,
  },
  zhs: {
    font: "'Inter Tight', 'Microsoft YaHei', 'SUIT', sans-serif",
    lineH: 1.2,
    size: 62,
    capSize: 58,
    means: [
      [{ t: '别', c: true }, { t: '吃！' }],
      [{ t: '别', c: true }, { t: '穿！' }],
      [{ t: '别', c: true }, { t: '打开！' }],
      [{ t: '别', c: true }, { t: '走…' }],
      [{ t: '别', c: true }, { t: '哭。' }],
      [{ t: '吃吧。' }],
    ],
    caption: { last: '这是他在咖啡馆的最后一天。', note: '他留了一张纸条…' },
  },
  my: {
    font: "'Inter Tight', 'SUIT', 'Myanmar Text', sans-serif",
    lineH: 1.45,
    size: 56,
    capSize: 58,
    means: [
      [{ t: 'မ', c: true }, { t: 'စား' }, { t: 'နဲ့', c: true }, { t: '!' }],
      [{ t: 'မ', c: true }, { t: 'ဝတ်' }, { t: 'နဲ့', c: true }, { t: '!' }],
      [{ t: 'မ', c: true }, { t: 'ဖွင့်' }, { t: 'နဲ့', c: true }, { t: '!' }],
      [{ t: 'မ', c: true }, { t: 'သွား' }, { t: 'နဲ့', c: true }, { t: '…' }],
      [{ t: 'မ', c: true }, { t: 'ငို' }, { t: 'နဲ့', c: true }, { t: '။' }],
      [{ t: 'စားလိုက်။' }],
    ],
    caption: { last: 'ကော်ဖီဆိုင်မှာ သူ့ရဲ့ နောက်ဆုံးနေ့', note: 'သူ စာရွက်လေး ချန်ခဲ့တယ်…' },
  },
};
