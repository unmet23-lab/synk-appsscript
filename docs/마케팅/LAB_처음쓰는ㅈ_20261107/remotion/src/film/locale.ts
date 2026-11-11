// 판별 화면 글. 영어판(en)이 정본이고, 두 채널 판(기획장부/LAB.md 머리말 「두 채널 판」)은 영어 목소리를 빼고
// 그 말을 그 초의 화면 글(제목 자리 둘째 줄)로 옮긴다 — E23 「ㅍ」 두 채널 판과 같은 꼴. 한국어(ㅈ · 친구의 「잘했어!」)는 모든 판에서 그대로다.
export type Loc = 'en' | 'zhs' | 'my';

export type LocText = {
  font: string | null; // --kids-font(EN 글꼴 줄) 자리에 깔 글꼴 줄 — null이면 영어판 그대로
  voice: boolean; // 영어 진행 목소리를 얹는가
  bgm: number; // 배경음 세기(목소리가 없는 판은 올린다)
  kicker: string; // 빈 글이면 상자를 두지 않는다
  title: string[]; // 첫 화면 큰 글 줄(첫 줄 앞에 kicker). 「ㅈ」은 한글 서체로 바뀐다
  sub: string;
  note: [string, string]; // 둘째 장 제목 두 줄(친구가 쓴 글)
  same: string; // ✓ 뒤 제목
  two: string; // 두 꼴 나란히 제목
  end: [string, string]; // 끝 화면 두 줄(첫 줄은 빨간 펜 손글씨)
  never: string; // 끝 Z 옆 빨간 펜 손글씨
  handFont?: string; // 빨간 펜 손글씨 서체(없으면 나눔손글씨 펜)
  handSize?: number; // 「never」 손글씨 크기(없으면 84)
  tags: { copy: string; a1: string; a2: string; a3: string };
  says?: { a1: string; a2: string; a3: string; r1: string; r3: string; s2: string }; // 목소리 없는 판 — 그 말을 그 초의 화면 글로
  size: { big: number; lineHeight: number; note: number; noteSub: number; same: number; two: number; end: number; endSub: number; kicker: number; sub: number; tag: number; tagPlain: number; says: number };
};

const EN_TEXT: LocText = {
  font: null,
  voice: true,
  bgm: 0.11,
  kicker: 'POV:',
  title: ['your first ㅈ'],
  sub: '(a Korean letter)',
  note: ['My Korean friend wrote:', '“Well done!”'],
  same: 'Same shape!',
  two: '2 ways to write ㅈ',
  end: ['both right!', 'Just never a Z.'],
  never: 'never Z!',
  // 이해 시험 v1: 셋이 「왜 일본어 같다는지 모르겠다」 — 이름표에 그 일본 글자 ス를 함께, sonnet 「nice ✓가 어느 쪽인지 헷갈림」 → right ✓
  tags: { copy: 'copy this', a1: 'a Z?', a2: 'right ✓', a3: 'Japanese ス?!' },
  size: { big: 90, lineHeight: 1.06, note: 70, noteSub: 56, same: 110, two: 92, end: 96, endSub: 66, kicker: 50, sub: 40, tag: 52, tagPlain: 42, says: 50 },
};

// 두 채널 판 — 영어 목소리를 빼고 그 말을 그 초의 화면 글로. 번역이 아니라 그 나라 말로 다시 썼다. 검수는 게시/검문/zhs.txt · my.txt.
const ZHS_FONT = "'Inter Tight', 'Microsoft YaHei', sans-serif";
const ZHS_TEXT: LocText = {
  ...EN_TEXT,
  font: ZHS_FONT,
  voice: false,
  bgm: 0.9,
  kicker: '',
  title: ['第一次写 ㅈ'],
  sub: '（一个韩文字母）',
  note: ['韩国朋友写了“做得好！”', '咦，朋友的 ㅈ 也这样写？'],
  same: '和朋友写的一模一样！',
  two: 'ㅈ 有 2 种写法',
  end: ['两种都对！', ''],
  never: '别写成 Z！',
  handFont: ZHS_FONT,
  handSize: 64,
  tags: { copy: '照着写', a1: 'Z？', a2: '写对了 ✓', a3: '日文的 ス？！' },
  says: { a1: '这是 Z 吧', a2: '嗯……这个写对了', a3: '等等……这不是日文吗？', r1: '再写一次……', r3: '不行，还是像日文', s2: '原来一直都是对的！' },
  size: { ...EN_TEXT.size, big: 96, note: 62, noteSub: 58, same: 78, two: 88, end: 72, sub: 44, tag: 50, tagPlain: 42 },
};
const MY_FONT = "'Inter Tight', 'Myanmar Text', sans-serif";
const MY_TEXT: LocText = {
  ...EN_TEXT,
  font: MY_FONT,
  voice: false,
  bgm: 0.9,
  kicker: '',
  title: ['ㅈ ကို ပထမဆုံး ရေးကြည့်တယ်'],
  sub: '(ကိုရီးယား အက္ခရာ)',
  note: ['ကိုရီးယား သူငယ်ချင်းက “တော်တယ်!” လို့ ရေးပေးတယ်', 'ဟင်… သူငယ်ချင်းရဲ့ ㅈ လည်း ဒီလိုပဲလား?'],
  same: 'သူငယ်ချင်းရဲ့ ㅈ နဲ့ တူတူပဲ!',
  two: 'ㅈ ရေးနည်း 2 မျိုး',
  end: ['နှစ်မျိုးလုံး မှန်တယ်!', ''],
  never: 'Z လိုတော့ မရေးနဲ့!',
  handFont: MY_FONT,
  handSize: 38,
  tags: { copy: 'ကူးရေးပါ', a1: 'Z လား?', a2: 'မှန်တယ် ✓', a3: 'ဂျပန်စာ ス?!' },
  says: { a1: 'ဒါ Z ပဲ', a2: 'အင်း… ဒါတော့ မှန်တယ်', a3: 'ခဏလေး… ဒါ ဂျပန်စာလား?', r1: 'ထပ်ရေးကြည့်ဦးမယ်…', r3: 'မရဘူး။ ဂျပန်စာလိုပဲ ဖြစ်နေသေးတယ်', s2: 'အစကတည်းက မှန်နေတာပဲ!' },
  size: { ...EN_TEXT.size, big: 60, lineHeight: 1.35, note: 37, noteSub: 46, same: 62, two: 72, end: 56, sub: 40, tag: 44, tagPlain: 38, says: 38 },
};

export const LOCALES: Record<Loc, LocText> = { en: EN_TEXT, zhs: ZHS_TEXT, my: MY_TEXT };
