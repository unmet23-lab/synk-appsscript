// LAB 몽골 M17 「교수님께 첫 문자」 화면 글 정본. 몽골어는 세 겹 검수(../검문/)를 거친 글만 둔다.
// 키릴 읽는 법은 우리 몽골 편 규칙(ㅓ=ө · ㅐㅔ=э · ㅡ=ы, 「아는 단어 총동원」 data.ts · M2 채팅 줄임말과 같음)
// — 안녕하세요 = аннёнхасэё, 감사합니다 = гамсахамнида, 교수님 = гёсуним, 바트입니다 = батыимнида.

export type Item = {
  ko: string; // 카드의 한국어 한 줄(채팅에 보낸 그대로)
  read: string; // 키릴 읽기
  mn: string; // 몽골 뜻
  note?: string; // 카드 아래 작은 줄
  mongle: string; // 카드 몽글 그림
};

export const MN = {
  band: 'Багшдаа анх удаа мессеж бичихдээ',
  rule: 'Эхлээд мэндчилээд, дараа нь нэрээ хэлнэ', // ③ Fable 1차 P2: 「그다음」(순서)을 살림
  hookNo: 'Багшдаа ингэж бичиж болохгүй!',
  hookWhy: 'Ингэж зөвхөн найздаа л бичдэг 👫', // v1 이해 시험: 「왜 틀렸는지 설명이 없다」 — 친구에게만 쓰는 말투라는 한 줄(③ P3: л로 「만」 강조)
  hookGloss: '“Багш аа, сайн уу~ Маргааш хичээл хэдэн цагт вэ?”', // ① 2차: 의문사 뒤 вэ
  replyTitle: 'Багш хариу бичлээ!',
  replyGloss: '“10 цагт.”',
  // ② 역번역 1차: 「바트 → өөрийн нэр」은 「바트 자신의 이름」으로도 읽힘 · ① 대조기 1차: 몽골어 줄에 한글 바트가 그냥 섞여 「파손」
  // ① 2차: 한글 「바트」 대신 앞 줄 «Би Бат байна»의 키릴 Бат을, өөрийн + -ээ 겹침은 нэрээ 하나로 · ③ P2: гэсний оронд는 딱딱 → -ын оронд
  nameNote: '«Бат»-ын оронд нэрээ бичээрэй',
  endQ: 'Багшдаа анх юу гэж бичсэн бэ?', // ③ P2: бичиж байсан은 「쓰고 있었어요」(진행)로 들림
  endC: 'Сэтгэгдэлд бичээрэй',
  endS: 'Солонгост сурч байгаа найздаа явуулаарай',
  prof: '교수님',
};

export const ITEMS: Item[] = [
  { ko: '안녕하세요, 교수님.', read: 'аннёнхасэё, гёсуним', mn: 'Сайн байна уу, багш аа.', mongle: 'img/mongle_bow.jpg' },
  { ko: '바트입니다.', read: 'батыимнида', mn: 'Би Бат байна.', note: MN.nameNote, mongle: 'img/mongle_name.jpg' },
  { ko: '감사합니다!', read: 'гамсахамнида', mn: 'Баярлалаа!', mongle: 'img/mongle_happy.jpg' },
];

export type Msg = { from: 'me' | 'prof'; text: string; at: number; typing?: number; item?: number; wrong?: boolean };

// ── 판별 글(10-28 두 채널 판 — 기획장부/LAB.md 머리말 「두 채널 판」 2번: 그날 만든 몽골 화면 글 편) ──────────────
// 몽골판(mn)은 위 MN · ITEMS 그대로다. 간체판(zhs, 샤오훙수 SYNK LAB) · 버마어판(mm, 틱톡 @synklab.mm)은 한글(채팅 · 카드의 한국어 줄)을 그대로 두고,
// 띠 · 규칙 · 첫 카드 · 뜻 · 답장 카드 · 끝 카드는 그 나라 말로 다시 쓴다. 읽는 법은 키릴 대신 영어 로마자(장부 머리말 「두 채널 판」).
// 예시 이름 「바트」는 그대로 둔다(한국 대학 유학생 누구나의 이야기라 이름만 몽골식 — 꼬리표가 「내 이름으로 바꿔」를 말한다).
// 버마어는 위아래로 쌓이는 글자라 같은 px에서 작게 보이고 줄 높이를 크게 잡는다(M2 버마어판).
export type Loc = 'mn' | 'zhs' | 'mm';
export type LocText = Omit<typeof MN, 'prof' | 'hookGloss' | 'endS'> & {
  hookGloss?: string; // 첫 카드의 반말 문자 뜻 — 몽골판은 화면에서 뺐고(올릴 파일 시험 「작다」), 두 채널 판 첫 시험은 「내일 수업 몇 시? 풀이가 없다」라 되살림
  cardAt?: { ko: number; read: number; mn: number; note: number }; // 카드 안 줄이 뜨는 때 — 두 채널 판 첫 시험: 2초 정지컷에 뜻 줄이 아직 안 떠 「칸이 비었다」
  replyGlossAt: number; // 답장 카드에서 뜻 줄이 뜨는 때(카드 시작에서 초) — 몽골판은 처음대로 0.45
  items: Item[]; // Item.mn 자리에 그 판의 뜻
  font: string | null; // --kids-font(EN 글꼴 줄) 자리에 깔 글꼴 줄 — null이면 몽골판 그대로
  lh: number; // 현지어 글 줄 높이 배율
  size: { band: number; rule: number; hookNo: number; hookWhy: number; mean: number; note: number; replyTitle: number; replyGloss: number; endQ: number; endC: number };
};

export const LOCS: Record<Loc, LocText> = {
  mn: {
    ...MN,
    items: ITEMS,
    hookGloss: undefined, // 몽골판 올릴 파일은 이 줄을 화면에서 뺐다
    replyGlossAt: 0.45,
    font: null,
    lh: 1,
    size: { band: 54, rule: 39, hookNo: 62, hookWhy: 50, mean: 52, note: 42, replyTitle: 66, replyGloss: 54, endQ: 56, endC: 40 },
  },
  zhs: {
    band: '第一次给教授发消息时',
    rule: '先打招呼，再说自己的名字',
    hookNo: '不能这样\n给教授发消息！', // 첫 정지컷: 「发 / 消息」로 갈림 — 줄 바꿈 자리를 글에
    hookWhy: '这种说法只适合发给朋友\u00A0👫', // ② 역번역: 「这样只能发给朋友」는 기능 제약으로도 읽힘 — 말투임을 드러냄
    hookGloss: '“教授，你好~\n明天的课几点？”',
    replyTitle: '教授回复了！',
    replyGlossAt: 0.1,
    cardAt: { ko: 0, read: 0.05, mn: 0.05, note: 0.35 }, // 두 채널 판 둘째 정지컷: 12초에 「감사합니다」 카드 뜻이 아직 안 뜸
    replyGloss: '明天的课几点？\n→ 10点。', // 첫 시험: 존댓말 질문 · 답장 「10시예요」의 뜻이 안 보임 — 질문과 답을 한 줄로
    nameNote: '把“바트”换成你的名字',
    endQ: '你第一次给教授\n发了什么？', // 첫 정지컷: 「什 / 么」로 갈림
    endC: '写在评论区吧',
    items: [
      { ...ITEMS[0], read: 'annyeonghaseyo, gyosunim', mn: '教授，您好。' },
      { ...ITEMS[1], read: 'bateu-imnida', mn: '我是巴特。', note: '把“바트”换成你的名字' },
      { ...ITEMS[2], read: 'gamsahamnida', mn: '谢谢您！' },
    ],
    font: "'Inter Tight', 'Microsoft YaHei', sans-serif",
    lh: 1.12,
    size: { band: 54, rule: 44, hookNo: 58, hookWhy: 42, mean: 56, note: 40, replyTitle: 64, replyGloss: 54, endQ: 50, endC: 40 },
  },
  mm: {
    band: 'ပါမောက္ခဆီ ပထမဆုံး မက်ဆေ့ချ် ပို့တဲ့အခါ',
    rule: 'အရင် နှုတ်ဆက်ပါ၊ ပြီးမှ ကိုယ့်နာမည် ပြောပါ',
    hookNo: 'ပါမောက္ခဆီ\nဒီလို မပို့ရဘူး!', // 첫 정지컷: 「ဘူး」가 낱말 가운데서 갈림
    hookWhy: 'ဒါမျိုးက သူငယ်ချင်းတွေဆီပဲ ပို့တာ\u00A0👫', // ② 역번역: 「ဒီလိုက」는 「이런 문자는」이 약함 · 친구는 복수로
    replyTitle: 'ပါမောက္ခ\nပြန်စာပို့လာပြီ!',
    hookGloss: '“ဆရာ ဟိုင်း~\nမနက်ဖြန် အတန်း ဘယ်နှနာရီလဲ?”',
    replyGloss: 'မနက်ဖြန် အတန်း ဘယ်နှနာရီလဲ?\n→ ၁၀ နာရီပါ', // 첫 시험: 질문 · 답장 뜻이 안 보임 → 질문과 답을 한 줄로 · ② 역번역: 「၁၀ နာရီ」는 10시간으로도 → ပါ
    replyGlossAt: 0.1,
    cardAt: { ko: 0, read: 0.05, mn: 0.05, note: 0.35 }, // 두 채널 판 둘째 정지컷: 12초에 「감사합니다」 카드 뜻이 아직 안 뜸
    nameNote: '“바트” နေရာမှာ ကိုယ့်နာမည် ရေးပါ',
    endQ: 'ပါမောက္ခဆီ ပထမဆုံး\nဘာရေးခဲ့လဲ?',
    endC: 'ကွန်မန့်မှာ ရေးပေးပါ',
    items: [
      { ...ITEMS[0], read: 'annyeonghaseyo, gyosunim', mn: 'မင်္ဂလာပါ ဆရာ။' },
      { ...ITEMS[1], read: 'bateu-imnida', mn: 'ဘတ် ဖြစ်ပါတယ်။', note: '“바트” နေရာမှာ ကိုယ့်နာမည် ရေးပါ' },
      { ...ITEMS[2], read: 'gamsahamnida', mn: 'ကျေးဇူးတင်ပါတယ်!' },
    ],
    font: "'Inter Tight', 'Myanmar Text', sans-serif",
    lh: 1.4,
    size: { band: 46, rule: 44, hookNo: 50, hookWhy: 35, mean: 50, note: 38, replyTitle: 52, replyGloss: 34, endQ: 46, endC: 38 }, // 두 채널 v2 시험: 「버마어 글씨가 작다」
  },
};
