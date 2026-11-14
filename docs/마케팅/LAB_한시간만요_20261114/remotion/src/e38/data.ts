// LAB 영어 E38 「한 시간만요」 화면 글 정본(영어 판). 한국어 말은 장면 속 말 글자 + 한국어 목소리, 영어는 화면 글.
export const FONT = "'Inter Tight', 'SUIT', sans-serif";
export const KO = "'SUIT', 'Inter Tight', sans-serif";
export const TEXT = {
  hook: 'When you need\na nap in Korea…',
  cafeSmall: 'go to a 만화카페 · man-hwa ka-pe',
  cafe: 'comic café',
  cafeNote: 'Comics + a tiny nap room,\npaid by the hour',
  askRead: '“How many hours?”',
  oneRead: 'han si-gan-man-yo',
  learnBig: '한 시간만요',
  learnNote: '“Just one hour, please.”',
  room: 'Your own tiny room.',
  comic: 'A blanket. Comics. Silence.',
  melt: '…just one hour.',
  later: '3 hours later…',
  back: '…and back to sleep',
  peekRead: '“Want to extend (연장) your time?”',
  noRead: 'a-ni-yo, gwaen-chan-a-yo',
  learn2Big: '아니요, 괜찮아요',
  learn2Note: '“No, thank you.”',
  endSmall: '“한 시간만요” (just one hour)…',
  endBig: '4 hours and counting',
};

// 두 채널 판(기획장부/LAB.md 머리말 「두 채널 판」 3번 — 소리가 한국어 말 · 음악 · 효과음뿐인 영어 편) — 영어 화면 글과 뜻만
// 그 나라 말로 다시 썼다(번역이 아니라 그 나라 학습자의 말로). 한국어 말 · 읽는 법(로마자) · 목소리는 모든 판 그대로.
// 검수는 게시/검문/zhs.txt · my.txt(현지어 세 겹).
export type Loc = 'en' | 'zhs' | 'my';
export type LocText = { font: string; k: number; nk?: number; sk?: number; back: string; hook: string; cafeSmall: string; cafe: string; cafeNote: string; askRead: string; learnNote: string; room: string; melt: string; later: string; peekRead: string; learn2Note: string; endSmall: string; endBig: string };
export const LOCS: Record<Loc, LocText> = {
  en: {
    font: FONT,
    k: 1,
    hook: TEXT.hook,
    cafeSmall: TEXT.cafeSmall,
    cafe: TEXT.cafe,
    cafeNote: TEXT.cafeNote,
    askRead: TEXT.askRead,
    learnNote: TEXT.learnNote,
    room: TEXT.room,
    melt: TEXT.melt,
    later: TEXT.later,
    back: TEXT.back,
    peekRead: TEXT.peekRead,
    learn2Note: TEXT.learn2Note,
    endSmall: TEXT.endSmall,
    endBig: TEXT.endBig,
  },
  zhs: {
    font: "'Inter Tight', 'Microsoft YaHei', sans-serif",
    k: 0.92,
    hook: '在韩国\n困到想睡一觉时……',
    cafeSmall: '就去 만화카페 · man-hwa ka-pe',
    cafe: '漫画咖啡厅',
    cafeNote: '有漫画，有能睡觉的小房间\n按小时收费',
    askRead: '“您要用几个小时？”',
    learnNote: '“就一个小时。”',
    room: '一个人的小房间。',
    melt: '……就睡一小时。',
    later: '3 小时后……',
    back: '……结果又睡着了',
    peekRead: '“要延长时间（연장）吗？”',
    learn2Note: '“不用了，谢谢。”',
    endSmall: '“한 시간만요”（就一个小时）……',
    endBig: '已经第 4 个小时了',
  },
  my: {
    font: "'Inter Tight', 'Myanmar Text', sans-serif",
    k: 0.9,
    sk: 1.1,
    nk: 1.3, // 버마어 글자는 같은 px에서 작아 보인다 — 작은 줄 · 덧붙임 줄만 키움(두 채널 이해 시험 1 · s · h · G)
    hook: 'ကိုရီးယားမှာ\nအိပ်ချင်လာရင်…',
    cafeSmall: '만화카페 · man-hwa ka-pe ကို သွားပါ',
    cafe: 'ကာတွန်း ကော်ဖီဆိုင်',
    cafeNote: 'ကာတွန်း + နားနေခန်းလေး\nနာရီအလိုက် ပိုက်ဆံပေးရတယ်',
    askRead: '"ဘယ်နှစ်နာရီ သုံးမလဲ?"',
    learnNote: '"တစ်နာရီပဲ။"',
    room: 'ကိုယ်ပိုင် အခန်းလေး။',
    melt: '…တစ်နာရီပဲ အိပ်မယ်။',
    later: '3 နာရီ ကြာပြီးနောက်…',
    back: '…ပြန်အိပ်ပျော်သွားပြီ',
    peekRead: '"အချိန် ထပ်တိုးမလား\n(연장)?"',
    learn2Note: '"ရပါတယ်၊ ကျေးဇူးပါ။"',
    endSmall: '"한 시간만요" (တစ်နာရီပဲ)…',
    endBig: '4 နာရီတောင် ကြာသွားပြီ',
  },
};
