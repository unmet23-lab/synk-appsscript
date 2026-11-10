// LAB 몽골 M32 「수고하세요 ↔ 안녕히 계세요」 화면 글 · 시간표(11-09). 몽골어는 세 겹 검수(../../../게시/검문/)를 거친 글만 둔다.
// 오마주 같은분야 — Rosetta Stone 「Germans before & after you say hello」(형식): 같은 사람이 인사 전 · 후로 뒤집힌다 → 우리는 같은 교수님 · 같은 방이 말 한마디에 얼음 ↔ 햇살.
// 키릴 읽는 법은 우리 몽골 편 규칙(ㅓ=ө · ㅐㅔ=э · ㅜ=у · ㅡ=ы · 받침 ㅇ=н · ㅈ=ж · ㅛ=ё).
export const FPS = 30;
export const T = {
  total: 22.6,
  a1: 0.25, // 몽글 「교수님, 수고하세요!」(1.44초)
  freeze: 1.75, // 말이 끝나는 순간 교수 책상에서 서리가 번지기 시작(한 장면 — 심사 답 1 「0~2초 움직임이 없다」로 앞당김)
  frozen: 3.25, // 온 방이 얼음
  close: 3.85, // 얼어붙은 교수님 가까이 — 말없이
  why: 5.5, // 넓게 — 떠는 몽글 · 왜인가
  rewind: 8.7, // 되감기 — 얼음이 걷힌다
  a2: 9.4, // 몽글 꾸벅 「안녕히 계세요!」
  sun: 10.6, // 햇살 · 교수님 손 흔듦
  b1: 11.0, // 교수 「그래요, 잘 가요.」
  rule: 12.9, // 위아래 판 — 얼음 ✕ / 햇살 ✓
  gag: 16.4, // 교수 「수고해요.」
  a3: 17.3, // 몽글 버릇처럼 「네! 수고하…」
  creep: 17.9, // 서리가 다시 번진다(한 장면이 끝에 한 번 더)
  a4: 19.1, // 몽글 다급히 「안녕히 계세요!!」
  back: 19.15, // 몽글이 외치는 순간 서리가 걷히기 시작
  end: 20.6, // 끝 줄
} as const;
export const fr = (sec: number) => Math.round(sec * FPS);
export const TOTAL_FRAMES = fr(T.total);
export const SCENE = { from: 0.0, to: 5.5 } as const; // 장면 심사(인사 → 번지는 서리 → 얼어붙은 교수님)

// 11-10 두 채널 판(샤오훙수 간체 · 틱톡 버마어) — 같은 정본에서 렌더한다(판끼리 따로 고치지 않는다). 한국어 말풍선 · 한국어 목소리는 그대로,
// 머리 글 · 뜻 줄만 그 나라 말, 읽는 법은 로마자(장부 머리말 「두 채널 판」). 현지어는 세 겹 검수(../../../게시/검문/zhs.txt · my.txt)를 거친 글만 둔다.
export type Lang = 'mn' | 'cn' | 'mm';
export const FONTS: Record<Lang, string> = {
  mn: "'Inter Tight', 'SUIT', sans-serif",
  cn: "'Microsoft YaHei', 'Inter Tight', 'SUIT', sans-serif",
  mm: "'Inter Tight', 'SUIT', 'Myanmar Text', sans-serif",
};
const MN = {
  hook: 'Багшдаа «수고하세요» гэвэл…',
  a1Ko: '교수님, 수고하세요!',
  a1Read: 'гёсуним, сугохасэё!',
  a1Mn: 'Багш аа, ажлаа сайн хийгээрэй!',
  whyKo: '수고하세요 = «Ажлаа сайн хийгээрэй!»',
  whyMn: 'Ахмад хүнд заримдаа эвгүй сонсогдоно',
  again: 'Харин «안녕히 계세요» гэвэл…', // 머리 글과 짝 — 시험관 둘이 「왜 다시 도나」를 같이 짚음
  a2Ko: '안녕히 계세요!',
  a2Read: 'аннёнхи гэсэё!',
  a2Mn: 'Сайн сууж байгаарай!',
  b1Ko: '그래요, 잘 가요',
  b1Read: 'гырэё, жал гаё',
  b1Mn: 'За, сайн яваарай',
  ruleFriend: 'Найз, хамтрагчдаа',
  ruleElder: 'Багш, даргадаа',
  no: '교수님, 수고하세요',
  yes: '교수님, 안녕히 계세요',
  b2Ko: '수고해요',
  b2Read: 'сугохэё',
  b2Mn: '', // 두 채널 판만 — 시험관 셋(간체 s · h · K, 버마어 h)이 「수고해요와 수고하세요의 차이」를 같이 짚음
  gagMn: 'Ахмад хүн танд хэлж болно',
  a3Ko: '네! 수고하…',
  a3Read: 'нэ! сугоха…',
  a4Ko: '안녕히 계세요!!',
  a4Read: 'аннёнхи гэсэё!!',
  end: 'Багшдаа:',
  endKo: '안녕히 계세요!',
};
export type Pack = typeof MN;
export const TEXTS: Record<Lang, Pack> = {
  mn: MN,
  cn: {
    b2Mn: "「수고하세요」的随意说法",
    hook: "对教授说「수고하세요」的话…",
    a1Mn: "教授，好好工作哦！",
    whyKo: "수고하세요 =「好好工作哦！」",
    whyMn: "对长辈、上级说，有时不太合适",
    again: "那换成「안녕히 계세요」呢…",
    a2Mn: "教授再见！",
    b1Mn: "好，慢走",
    ruleFriend: "对朋友、同事",
    ruleElder: "对教授、上司",
    gagMn: "长辈、上级可以对你说",
    end: "对教授：",
    a1Ko: "교수님, 수고하세요!",
    a2Ko: "안녕히 계세요!",
    b1Ko: "그래요, 잘 가요",
    no: "교수님, 수고하세요",
    yes: "교수님, 안녕히 계세요",
    b2Ko: "수고해요",
    a3Ko: "네! 수고하…",
    a4Ko: "안녕히 계세요!!",
    endKo: "안녕히 계세요!",
    a1Read: "gyosunim, sugohaseyo!",
    a2Read: "annyeonghi gyeseyo!",
    b1Read: "geuraeyo, jal gayo",
    b2Read: "sugohaeyo",
    a3Read: "ne! sugoha…",
    a4Read: "annyeonghi gyeseyo!!",
  },
  mm: {
    b2Mn: "«수고하세요» ရဲ့ ရင်းနှီးတဲ့ ပုံစံ",
    hook: "ဆရာ့ကို «수고하세요» လို့ ပြောရင်…",
    a1Mn: "ဆရာ၊ အလုပ်ကောင်းကောင်းလုပ်နော်!",
    whyKo: "수고하세요 = «အလုပ်ကောင်းကောင်းလုပ်နော်!»",
    whyMn: "လူကြီးကို ပြောရင် တစ်ခါတလေ\nမသင့်တော်သလို ဖြစ်တတ်တယ်",
    again: "«안녕히 계세요» လို့ ပြောရင်တော့…",
    a2Mn: "ကောင်းကောင်းနေခဲ့ပါနော်!",
    b1Mn: "အေးပါ၊ ကောင်းကောင်းသွားနော်",
    ruleFriend: "သူငယ်ချင်း၊ လုပ်ဖော်ကိုင်ဖက်ကို",
    ruleElder: "ဆရာ၊ အထက်လူကြီးကို",
    gagMn: "လူကြီးက ကိုယ့်ကို ပြောလို့ရတယ်",
    end: "ဆရာ့ကို:",
    a1Ko: "교수님, 수고하세요!",
    a2Ko: "안녕히 계세요!",
    b1Ko: "그래요, 잘 가요",
    no: "교수님, 수고하세요",
    yes: "교수님, 안녕히 계세요",
    b2Ko: "수고해요",
    a3Ko: "네! 수고하…",
    a4Ko: "안녕히 계세요!!",
    endKo: "안녕히 계세요!",
    a1Read: "gyosunim, sugohaseyo!",
    a2Read: "annyeonghi gyeseyo!",
    b1Read: "geuraeyo, jal gayo",
    b2Read: "sugohaeyo",
    a3Read: "ne! sugoha…",
    a4Read: "annyeonghi gyeseyo!!",
  },
};
