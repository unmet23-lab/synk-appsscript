// LAB 몽골 M1 「화날 때 네 마디」 화면 글 정본. 몽골어는 세 겹 검수(../../../검문/화면글.txt)를 거친 글만 둔다.
// 원본 Yerok 「When you're angry!」(sxujuQNn7rY · 33.9초)의 뼈대 — 머리 글 → 표현 넷을 차례로 → 끝. 진행자 대신 몽글의 나쁜 하루(상황 칸 + 표현 칸 넷)로.
// 키릴 읽는 법은 우리 몽골 편 규칙(ㅓ=ө · ㅐㅔ=э · ㅡ=ы · 받침 ㅇ=н). 소리는 소진(세기 1.0) · 효과음은 직접 합성(../../소리.py).
export const FPS = 30;
export const TOTAL = 28.6;

export type Bubble = {
  n: number; // 1~4
  ko: string;
  read: string;
  mn: string;
  gauge: number; // 이 칸에서 차오르는 화 게이지(0~1)
  side: 'left' | 'right'; // 말풍선이 붙는 쪽
  bottom: number; // 말풍선 아래 끝(px)
  width: number;
  tip: [number, number]; // 꼬리 끝
};

export type Cell = {
  at: number;
  img: string;
  x?: number; // 그림 왼쪽 자리(기본 -100)
  sit?: string; // 상황 칸의 몽골어 한 줄
  next?: { at: number; img: string }; // 칸 안에서 그림이 한 번 더 바뀌는 때(김밥 뺏긴 뒤 얼굴)
  bubble?: Bubble;
  tremble?: boolean; // 화가 나서 화면이 떨림
  vo?: { id: string; at: number }[];
};

export const TEXT = {
  hook: 'Уурласан үедээ\nхэлэх 4 хэллэг',
  gauge: 'УУР',
  endKo: '네, 사장님~',
  endRead: 'нэ, сажанним',
  endMn: 'За, дарга аа~',
  end1: 'Ахмад хүний өмнө —',
  end2: 'дотроо л бодоорой!',
};

export const CELLS: Cell[] = [
  { at: 0.0, img: 'hook.jpg', tremble: true },
  { at: 3.2, img: 'bus1.jpg', sit: 'Автобус яг нүдэн дээр минь явчихлаа…' },
  {
    at: 5.0, img: 'bus2.jpg', tremble: false, vo: [{ id: 'a1', at: 5.12 }, { id: 'a1', at: 6.5 }],
    bubble: { n: 1, ko: '짜증 나!', read: 'жажын на', mn: 'Ямар бухимдмаар юм бэ!', gauge: 0.25, side: 'right', bottom: 620, width: 700, tip: [560, 700] },
  },
  { at: 7.7, img: 'kim1.jpg', next: { at: 8.6, img: 'kim2.jpg' }, sit: 'Сүүлчийн кимбабыг өөр хүн авчихлаа…' },
  {
    at: 9.6, img: 'kettle.jpg', tremble: true, vo: [{ id: 'a2', at: 9.72 }, { id: 'a2', at: 11.1 }],
    bubble: { n: 2, ko: '열받아!', read: 'ёлбада', mn: 'Дотор минь\nбуцалж байна!', gauge: 0.5, side: 'right', bottom: 590, width: 430, tip: [760, 740] },
  },
  { at: 12.5, img: 'fr1.jpg', sit: 'Надаас мөнгө зээлсэн найз\nшинэ гутал авчихсан байна…' },
  {
    at: 14.4, img: 'soul.jpg', vo: [{ id: 'a3', at: 14.52 }, { id: 'a3', at: 16.0 }],
    bubble: { n: 3, ko: '어이없어…', read: 'өи өбсө', mn: 'Хэлэх үг олдохгүй байна…', gauge: 0.75, side: 'left', bottom: 640, width: 720, tip: [470, 870] },
  },
  { at: 17.5, img: 'cafe1.jpg', sit: 'Аягыг би хагалаагүй шүү дээ…' },
  {
    at: 19.4, img: 'cafe2.jpg', tremble: true, vo: [{ id: 'a4', at: 19.52 }, { id: 'a4', at: 21.0 }],
    bubble: { n: 4, ko: '억울해!', read: 'өгурэ', mn: 'Ямар гомдмоор юм бэ!', gauge: 1, side: 'right', bottom: 620, width: 700, tip: [470, 676] },
  },
  { at: 22.5, img: 'end.jpg', x: -180, vo: [{ id: 'a5', at: 22.7 }], next: { at: 26.9, img: 'end2.jpg' } },
];

// 끝 칸 — 겉말 뒤 속으로 터지는 소리, 그다음 맺음 줄 · 26.9초 사장이 돌아서자 고양이가 컵을 또 민다(볼 이유 심사 v5 「교훈 자막만 얹혀 웃음이 식는다」)
export const END_LINE_AT = 25.3; // 원본 끝 자리(32.5초)를 길이에 맞춘 초 — 이때 화면이 화산 쪽으로 당겨진다
export const INNER_VO = { id: 'a4in', at: 23.75 };

// 배경음 — public/bgm.wav는 보유곡 따뜻_118(docs/홍보물/BGM, 몽글 릴 곡)의 앞 29초다. 없을 때는 말 사이가 완전 무음이라 올리기 전 검사 ⑰에 걸렸다(10-31)
export const BGM_VOL = 0.22;
export const BGM_DUCK = 0.5; // 배울 말이 나오는 동안 −6dB
export const VO_LEN: Record<string, number> = { a1: 0.71, a2: 0.95, a3: 1.03, a4: 1.24, a5: 1.03, a4in: 1.3 };

export const SFX: { file: string; at: number; vol: number }[] = [
  { file: 'boil.wav', at: 0.0, vol: 0.7 },
  { file: 'engine.wav', at: 3.2, vol: 0.8 },
  { file: 'splash.wav', at: 4.92, vol: 1 },
  { file: 'tok.wav', at: 8.6, vol: 0.9 },
  { file: 'whistle.wav', at: 9.6, vol: 0.32 },
  { file: 'pop.wav', at: 12.6, vol: 0.7 },
  { file: 'wind.wav', at: 14.4, vol: 0.5 },
  { file: 'crash.wav', at: 17.5, vol: 0.9 },
  { file: 'sting.wav', at: 22.5, vol: 0.6 },
  { file: 'boom.wav', at: 23.7, vol: 0.7 },
  { file: 'crash.wav', at: 27.5, vol: 1 },
];

// ── 두 채널 판(11-02, 기획장부/LAB.md 머리말 「두 채널 판」) — 샤오훙수 간체 · 틱톡 버마어. 같은 정본에서 렌더하고 판끼리 따로 고치지 않는다.
// 한국어(말풍선 한글 · 소진 목소리)는 그대로, 읽는 법은 영어 로마자(발음대로), 뜻 · 상황 · 머리 글 · 맺음 줄은 그 나라 말로 다시 썼다(현지어 세 겹 검수 — ../../게시/검문/zhs.txt · my.txt).
// 11-05 영어판(유튜브 @synkkorean · 동영상 언어 시험 — 유호님 「제일 좋았던 판으로」): 두 채널 판과 같은 꼴(로마자 읽기 · 영어 뜻 · 첫 화면 김 · 끝 딱지).
export type Loc = 'mn' | 'zhs' | 'my' | 'en';
export type LocPack = {
  font: string; // 그 나라 글 서체 줄(한글 · 키릴 · 로마자는 SUIT · Inter Tight)
  lineH: number;
  hook: string;
  hookSize: number;
  gauge: string;
  sits: string[]; // 상황 칸 넷(차례대로)
  sitSize: number;
  reads: string[]; // 말풍선 읽는 법 넷
  means: string[]; // 말풍선 뜻 넷
  meanSize: number;
  endRead: string;
  endMn: string;
  end1: string;
  end2: string;
  endSize: number;
  inner: string; // 끝 화산 옆 「속으로」 딱지(두 채널 판 v5 — 시험관 둘 「속으로만이 어디와 잇나」)
};
export const LOCS: Record<Loc, LocPack> = {
  mn: {
    font: "'Inter Tight', 'SUIT', sans-serif",
    lineH: 1.14,
    hook: TEXT.hook,
    hookSize: 92,
    gauge: TEXT.gauge,
    sits: CELLS.filter((c) => c.sit).map((c) => c.sit as string),
    sitSize: 60,
    reads: CELLS.filter((c) => c.bubble).map((c) => (c.bubble as Bubble).read),
    means: CELLS.filter((c) => c.bubble).map((c) => (c.bubble as Bubble).mn),
    meanSize: 50,
    endRead: TEXT.endRead,
    endMn: TEXT.endMn,
    end1: TEXT.end1,
    end2: TEXT.end2,
    endSize: 84,
    inner: 'дотроо',
  },
  zhs: {
    font: "'Inter Tight', 'Microsoft YaHei', 'SUIT', sans-serif",
    lineH: 1.2,
    hook: '生气时说的\n4句韩语',
    hookSize: 96,
    gauge: '怒气',
    sits: ['公交车就在我眼前开走了…', '最后一个紫菜包饭被别人拿走了…', '向我借钱的朋友\n居然买了新鞋…', '杯子明明不是我打碎的…'],
    sitSize: 58,
    reads: ['jja-jeung na', 'yeol-ba-da', 'eo-i-eop-sseo', 'eo-gul-hae'],
    means: ['烦死了！', '气到冒烟了！', '无语了……', '太冤枉了！'],
    meanSize: 58,
    endRead: 'ne, sa-jang-nim',
    endMn: '好的，老板～',
    end1: '在长辈和上司面前——',
    end2: '只能在心里说！',
    endSize: 80,
    inner: '心里',
  },
  my: {
    font: "'Inter Tight', 'SUIT', 'Myanmar Text', sans-serif",
    lineH: 1.45,
    hook: 'စိတ်ဆိုးတဲ့အခါ ပြောတဲ့\nကိုရီးယားစကား ၄ ခွန်း',
    hookSize: 64,
    gauge: 'ဒေါသ',
    sits: ['ဘတ်စ်ကားက မျက်စိရှေ့မှာတင်\nထွက်သွားတယ်…', 'နောက်ဆုံးကျန်တဲ့ ကင်မ်ဘပ်ကို\nတခြားလူ ယူသွားတယ်…', 'ငါ့ဆီက ပိုက်ဆံချေးသွားတဲ့ သူငယ်ချင်းက\nဖိနပ်အသစ် ဝယ်ထားတယ်…', 'ခွက်ကို ငါခွဲတာ မဟုတ်ဘူးလေ…'],
    sitSize: 52,
    reads: ['jja-jeung na', 'yeol-ba-da', 'eo-i-eop-sseo', 'eo-gul-hae'],
    means: ['စိတ်ညစ်လိုက်တာ!', 'ဒေါသထွက်\nလိုက်တာ!', 'ဘာပြောရမှန်းတောင်\nမသိတော့ဘူး…', 'မတရားဘူး!'],
    meanSize: 48,
    endRead: 'ne, sa-jang-nim',
    endMn: 'ဟုတ်ကဲ့ပါ သူဌေး~',
    end1: 'လူကြီးတွေရှေ့မှာ —',
    end2: 'စိတ်ထဲမှာပဲ ပြောပါ!',
    endSize: 68,
    inner: 'စိတ်ထဲမှာ',
  },
  en: {
    font: "'Inter Tight', 'SUIT', sans-serif",
    lineH: 1.14,
    hook: '4 Korean words\nfor when you’re ANGRY',
    hookSize: 84,
    gauge: 'ANGER',
    sits: ['The bus left right\nin front of me…', 'Someone took\nthe last kimbap…', 'The friend who owes me money\njust bought new shoes…', 'I did NOT break that cup…'],
    sitSize: 58,
    reads: ['jja-jeung na', 'yeol-ba-da', 'eo-i-eop-sseo', 'eo-gul-hae'],
    means: ['So annoying!', 'I’m boiling!', 'Unbelievable…', 'That’s so unfair!'],
    meanSize: 56,
    endRead: 'ne, sa-jang-nim',
    endMn: 'Yes, boss~',
    end1: 'With elders and bosses —',
    end2: 'keep it in your head!',
    endSize: 76,
    inner: 'in my head',
  },
};
