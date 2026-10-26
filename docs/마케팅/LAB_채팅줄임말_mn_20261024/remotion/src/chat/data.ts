// LAB 몽골 M2 「한국 친구와 채팅할 때」 화면 글 정본. 몽골어는 세 겹 검수(../검문/)를 거친 글만 둔다.
// 키릴 읽는 법은 우리 몽골 편 규칙(ㅓ=ө · ㅐㅔ=э · ㅡ=ы, 「아는 단어 총동원」 data.ts와 같음).

export type Item = {
  bubble: string; // 친구가 보낸 말
  syl: string[]; // 원래 낱말(음절)
  init: (string | null)[]; // 음절마다 첫 글자(줄임말에 안 쓰인 음절은 null)
  read: string; // 키릴 읽는 법
  mean: string; // 몽골 뜻
};

export const MN = {
  band: 'Солонгос найзтайгаа чатлахдаа',
  hook: 'Найз чинь юу гэсэн бол?',
  rule: 'Товчлохдоо үе бүрийн эхний үсгийг л бичдэг',
  endQ: 'Өөр ямар товчлол мэддэг вэ?',
  endC: 'Сэтгэгдэлд бичээрэй',
  endS: 'Солонгос хэл сурч байгаа найздаа явуулаарай',
  friend: '민지',
};

// ㅇㅋ(오케이)는 「이」가 빠져 「음절마다」 규칙과 어긋나 풀이에서 뺐다(Fable 1차 P1 · 이해 시험 1 · 2차). 끝 맞히기 「ㅇㅋ = ?」도 답이 없어 허전하다는 말이 두 번 나와 열린 질문으로 바꿨다 — ㅇㅋ는 캡션에만.
export const ITEMS: Item[] = [
  { bubble: 'ㅋㅋ', syl: ['크', '크'], init: ['ㅋ', 'ㅋ'], read: 'кы кы', mean: 'Хаха (инээж байна)' },
  { bubble: 'ㅇㅇ', syl: ['응', '응'], init: ['ㅇ', 'ㅇ'], read: 'ын ын', mean: 'Тийм тийм' },
  { bubble: 'ㄱㅅ', syl: ['감', '사'], init: ['ㄱ', 'ㅅ'], read: 'гамса', mean: 'Баярлалаа' },
];

// 내가 보내는 말은 이모지만(시청자가 모를 한국어 낱말을 늘리지 않는다)
export type Msg = { from: 'me' | 'friend'; text: string; emoji?: boolean; at: number; typing?: number; item?: number };

// ── 판별 글(10-27 두 채널 판 — 기획장부/LAB.md 대기 표 T1) ─────────────────────────────
// 몽골판(mn)은 10-24 올린 그대로다. 버마어판(mm, 틱톡 @synklab.mm)은 한글(채팅 · 줄임말 · 음절 · 첫 글자)을 그대로 두고,
// 띠 · 질문 · 규칙 · 뜻 · 끝 카드는 버마어로 다시 쓴다. 읽는 법은 키릴 대신 영어 로마자(장부 머리말 「두 채널 판」).
// 「크크 = 웃음」은 버마어 웃음 글자 ဟားဟား에 견준다. 버마어는 위아래로 쌓이는 글자라 줄 높이 · 크기를 판마다 둔다.
export type Loc = 'mn' | 'mm';
export type LocText = typeof MN & {
  items: Item[];
  font: string | null; // --kids-font(EN 글꼴 줄) 자리에 깔 글꼴 줄 — null이면 몽골판 그대로
  lh: number; // 현지어 글 줄 높이 배율(버마어는 위아래 쌓임 때문에 크게)
  size: { band: number; rule: number; hook: number; mean: number; endQ: number; endC: number; endS: number };
  ruleTwoLines: boolean; // 규칙 줄이 두 줄이면 띠의 작은 제목을 걷고 규칙을 띠 안에 두 줄로(버마어 — 첫 렌더에서 둘째 줄이 대화 머리에 가려짐)
};

export const LOCS: Record<Loc, LocText> = {
  mn: { ...MN, items: ITEMS, font: null, lh: 1, size: { band: 54, rule: 50, hook: 54, mean: 64, endQ: 58, endC: 40, endS: 30 }, ruleTwoLines: false },
  mm: {
    band: 'ကိုရီးယားသူငယ်ချင်းနဲ့ စာပို့တဲ့အခါ',
    hook: 'သူငယ်ချင်းက ဘာပြောတာလဲ?',
    rule: 'အတိုကောက်ရေးရင် စာလုံး တစ်လုံးချင်းစီရဲ့ ရှေ့ဆုံးဗျည်းကိုပဲ ရေးတယ်', // Opus 역번역: အတိုရေး는 「짧게 쓰다」, ပထမဗျည်း는 「자음 순서의 첫째」로도 — 줄임말 · 한 자씩 · 맨 앞 자음
    endQ: 'တခြား ဘယ်အတိုကောက်တွေ သိသေးလဲ?',
    endC: 'ကွန်မန့်မှာ ရေးပေးပါ',
    endS: 'ကိုရီးယားစာ လေ့လာနေတဲ့ သူငယ်ချင်းဆီ ဒီဗီဒီယို ပို့ပေးလိုက်ပါ', // Opus 역번역: သင်는 배우다 · 가르치다 둘 다
    friend: '민지',
    items: [
      { ...ITEMS[0], read: 'keu keu', mean: 'ဟားဟား (ရယ်နေတာ)' },
      { ...ITEMS[1], read: 'eung eung', mean: 'အင်း အင်း' },
      { ...ITEMS[2], read: 'gamsa', mean: 'ကျေးဇူးပါ' },
    ],
    font: "'Inter Tight', 'Myanmar Text', sans-serif",
    lh: 1.4,
    size: { band: 54, rule: 42, hook: 56, mean: 66, endQ: 44, endC: 38, endS: 30 }, // Fable P2: 끝 작은 줄 26px은 실제 글자 상자 약 18px — 몽골판과 같은 30 // 버마어는 같은 px에서 라틴 · 키릴보다 작게 보인다(첫 렌더) · 끝 카드는 400px 상자에 들게
    ruleTwoLines: true,
  },
};

