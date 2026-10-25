// 판별 화면 글(10-25 두 채널 판 — 기획장부/LAB.md 머리말 「두 채널 판」). 영어판(en)은 10-24 올린 그대로다.
// 간체(zhs, 샤오훙수) · 버마어(my, 틱톡)는 영어 목소리 아홉 줄을 빼고(「리을.」 한국어 한 줄만 남김) 그 말을 그 초의 화면 글로 옮긴다.
// 한국어(ㄹ · ㄱ · ㄴ)와 읽는 법(rieul, 영어 로마자)은 모든 판에서 그대로다. 문안 검수: 현지어대조(아르곤) · Opus 직역 역번역 · Fable — 기획.md 「두 채널 판」.
export type Loc = 'en' | 'zhs' | 'my';

export type LocText = {
  font: string | null; // --kids-font(EN 글꼴 줄) 자리에 깔 글꼴 줄 — null이면 영어판 그대로
  voice: boolean; // 영어 진행 목소리를 얹는가
  bgm: number; // 배경음 세기(목소리가 없는 판은 조금 올린다)
  kicker: string; // 빈 글이면 상자를 두지 않는다
  title: string[]; // 첫 화면 큰 글 줄(첫 줄 앞에 kicker). 「ㄹ」은 한글 서체로 바뀐다
  sub: string; // 첫 화면 작은 줄 — {rieul} 자리는 고정폭 rieul
  fix: [string, string]; // 둘째 장 제목 두 줄
  end: [string, string]; // 끝 화면 두 줄(둘째 줄 끝에 👇) — 목소리가 없는 판은 두 줄이 함께 뜬다
  tags: { copy: string; a1: string; a2: string; a3: string };
  grade?: boolean; // 끝의 빨간 펜 「?/10」 — 없으면 둔다(영어 · 버마어)
  nameLine?: string; // 「리을.」 소리 아래 한 줄 — {name} 자리는 한글 「리을」
  size: { big: number; fix: number; end?: number; endSub: number; lineHeight: number; kicker: number; sub: number; tag: number; tagPlain: number };
};

export const LOCALES: Record<Loc, LocText> = {
  en: {
    font: null,
    voice: true,
    bgm: 0.11,
    kicker: 'POV:',
    title: ['writing ㄹ', 'for the first time'],
    sub: '(the Korean letter {rieul})',
    fix: ['Easy fix:', '3 strokes'],
    end: ['Rate my new ㄹ', 'Comment 1–10 '],
    tags: { copy: 'copy this', a1: 'a 2?', a2: 'a Z?', a3: 'a snake?' },
    size: { big: 84, fix: 92, endSub: 70, lineHeight: 1.06, kicker: 46, sub: 38, tag: 50, tagPlain: 42 },
  },
  zhs: {
    font: "'Inter Tight', 'Microsoft YaHei', sans-serif",
    voice: false,
    bgm: 0.18,
    // 첫 렌더 이해 시험(10-25 18:2x) 3점 · 8초 이탈 — 말이 없으니 앞 8초에 얻을 것이 안 보였다 → POV 상자를 빼고 약속 줄, 틀린 칸에 빨간 ✗(Film.tsx)
    kicker: '',
    title: ['第一次写 ㄹ', '就写错了？'], // 최종본 시험(3점) 「앞 6초에 약속이 눈에 안 들어온다」 → 묻는 말을 큰 제목으로
    sub: '看到最后，教你写对', // 약속 줄. 「写歪」(살짝 삐뚤다)는 2 · Z · 뱀 같은 잘못과 안 맞아 「写错」(Opus 역번역)
    fix: ['其实很简单：', '分 3 笔写'],
    // v3 이해 시험 3점 — 「?/10」을 「내 글씨를 매기라는 것」으로 읽었고 13초 「리을」 소리가 무엇인지 몰랐다 → 첫 시도 맞히기 댓글 놀이 · 이름 줄
    end: ['你第一次写的 ㄹ\n像什么？', '像 2，像 Z，还是像蛇？\n评论区告诉我 '], // 「2、」는 목록 번호로 읽혀 쉼표 · 「像」 되풀이(Opus 역번역)
    grade: false,
    nameLine: '这个字母叫“{name}”', // 간체 표준 따옴표
    tags: { copy: '照着写', a1: '像数字 2？', a2: '像字母 Z？', a3: '像条蛇？' }, // 「像个 2」는 「2(二) = 바보」 속어로도 읽혀 「数字」(Opus 역번역)
    size: { big: 80, fix: 96, end: 80, endSub: 62, lineHeight: 1.2, kicker: 46, sub: 58, tag: 50, tagPlain: 42 },
  },
  my: {
    font: "'Inter Tight', 'Myanmar Text', sans-serif",
    voice: false,
    bgm: 0.18,
    // 첫 렌더 이해 시험 3점 · 8초 이탈(간체와 같은 까닭) → POV 상자를 빼고 약속 줄
    kicker: '',
    title: ['ㄹ ကို မှားရေးမိလား?'], // 최종본 시험(3점) — 묻는 말을 큰 제목 한 줄로(두 줄 제목은 위 머리 자리 269px에도 걸렸다)
    sub: 'ဗီဒီယို အဆုံးမှာ\nမှန်အောင် ရေးနည်း ပြပေးမယ်', // 「ပြမယ်」보다 다정한 「ပြပေးမယ်」(Fable) // 「နောက်ဆုံးမှာ」은 「결국에는」으로도 읽혀 「영상 끝에서」, 틀린 예라는 신호로 묻는 줄을 앞에
    fix: ['ပြင်ရတာ လွယ်ပါတယ်', '3 ချက် ခွဲရေးပါ'], // 숫자는 농담의 2와 같은 아라비아 숫자로. 「ခဲတံ(연필) 3 ချက်နဲ့」는 아르곤이 「연필 세 자루 · 연필로 세 번 치기」로 어색하다고 해 뺐다 — 획 뜻은 화면의 번호 1 · 2 · 3이 받친다
    end: ['ဒီ ㄹ ကို\nဘယ်နှမှတ် ပေးမလဲ?', 'ကွန်မန့်မှာ အမှတ် 1–10 ရေးပေးပါ '], // 반말 대명사 ငါ(나)는 쓰지 않는다 — 처음 보는 어른에게 얕보는 말투가 되지 않게
    tags: { copy: 'ကူးရေးပါ', a1: '2 လား?', a2: 'Z လား?', a3: 'မြွေလား?' },
    size: { big: 74, fix: 84, endSub: 50, lineHeight: 1.5, kicker: 42, sub: 52, tag: 46, tagPlain: 40 },
  },
};
