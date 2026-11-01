// 판별 화면 글. 영어판(en)이 정본이고, 두 채널 판(기획장부/LAB.md 머리말 「두 채널 판」)은 영어 목소리를 빼고(「피읖.」 한국어 한 줄만 남김)
// 그 말을 그 초의 화면 글로 옮긴다 — E5 간체판이 이 꼴로 넘었다. 한국어(ㅍ)와 읽는 법(pieup, 영어 로마자)은 모든 판에서 그대로다.
export type Loc = 'en' | 'zhs' | 'my';

export type LocText = {
  font: string | null; // --kids-font(EN 글꼴 줄) 자리에 깔 글꼴 줄 — null이면 영어판 그대로
  voice: boolean; // 영어 진행 목소리를 얹는가
  bgm: number; // 배경음 세기(목소리가 없는 판은 조금 올린다)
  kicker: string; // 빈 글이면 상자를 두지 않는다
  title: string[]; // 첫 화면 큰 글 줄(첫 줄 앞에 kicker). 「ㅍ」은 한글 서체로 바뀐다
  sub: string; // 첫 화면 작은 줄 — {pieup} 자리는 고정폭 pieup
  fix: [string, string]; // 둘째 장 제목 두 줄
  end: [string, string]; // 끝 화면 두 줄
  tags: { copy: string; a1: string; a2: string; a3: string };
  strokes: [string, string, string, string]; // 네 획 자리 이름(그 획을 긋는 동안 칸 위 줄에서 켜진다)
  parts: [string, string, string, string]; // 바른 획마다 붙는 빨간 펜 이름(등 · 다리 · 다리 · 바닥)
  partFont?: string; // SVG 글자 서체(없으면 Inter Tight)
  partSize?: number; // 빨간 펜 이름 크기(없으면 64)
  nameLine: string; // 「피읖.」 소리 아래 한 줄 — {name} 자리는 한글 「피읖」
  says?: { a1: string; a2: string; a3: string; d?: string; e1: string }; // 목소리 없는 판 — 그 말을 그 초의 화면 글로
  size: { big: number; fix: number; end: number; endSub: number; lineHeight: number; kicker: number; sub: number; tag: number; tagPlain: number; strokes: number; name: number };
};

const EN_TEXT: LocText = {
  font: null,
  voice: true,
  bgm: 0.11,
  kicker: 'POV:',
  title: ['your first ㅍ'],
  sub: '(a Korean letter)',
  fix: ['The real way:', '4 strokes'],
  end: ['ㅍ in 4 strokes', ''],
  tags: { copy: 'copy this', a1: 'π?', a2: 'a hashtag?', a3: 'a dog?!' },
  strokes: ['top', 'left', 'right', 'bottom'],
  parts: ['back', 'leg', 'leg', 'floor'],
  nameLine: 'say "pee-eup"',
  size: { big: 90, fix: 92, end: 92, endSub: 54, lineHeight: 1.06, kicker: 50, sub: 40, tag: 52, tagPlain: 42, strokes: 54, name: 62 },
};

// 두 채널 판 — 영어 목소리를 빼고(「피읖.」 한국어 한 줄만) 그 말을 그 초의 화면 글로. 뜻 · 개그는 번역이 아니라 그 나라 말로 다시 썼다.
// 읽는 법은 영어 로마자 그대로(LAB 장부 머리말 「두 채널 판」). 검수는 게시/검문/zhs.txt · my.txt.
const ZHS_FONT = "'Inter Tight', 'Microsoft YaHei', sans-serif";
const ZHS_TEXT: LocText = {
  ...EN_TEXT,
  font: ZHS_FONT,
  voice: false,
  bgm: 0.6,
  kicker: '',
  title: ['第一次写 ㅍ'],
  sub: '（一个韩文字母）',
  fix: ['正确写法：', '4 笔'],
  end: ['ㅍ 一共 4 笔', ''],
  tags: { copy: '照着写', a1: 'π？', a2: '井号？', a3: '小狗？🐶' },
  strokes: ['上横', '左竖', '右竖', '下横'],
  parts: ['后背', '腿', '腿', '地面'],
  partFont: ZHS_FONT,
  nameLine: '名字读作“pee-eup”',
  says: { a1: '这是 π。', a2: '现在变成井号了。', a3: '等等……这是小狗？', d: '咦？又变成小狗了？', e1: '看到了吧？就是一只站在地上的小狗。' },
  size: { ...EN_TEXT.size, big: 96, fix: 92, end: 92, sub: 44, tag: 50, tagPlain: 42, strokes: 50, name: 60 },
};
const MY_FONT = "'Inter Tight', 'Myanmar Text', sans-serif";
const MY_TEXT: LocText = {
  ...EN_TEXT,
  font: MY_FONT,
  voice: false,
  bgm: 0.6,
  kicker: '',
  title: ['ㅍ ကို', 'ပထမဆုံး ရေးကြည့်တယ်'],
  sub: '(ကိုရီးယား အက္ခရာ)',
  fix: ['မှန်တဲ့ ရေးနည်း —', 'ရေးချက် 4 ချက်'],
  end: ['ㅍ ကို ရေးချက် 4 ချက်နဲ့ ရေးပါ', ''],
  tags: { copy: 'ကူးရေးပါ', a1: 'π?', a2: '# လား?', a3: 'ခွေးလေး? 🐶' },
  strokes: ['အပေါ်', 'ဘယ်', 'ညာ', 'အောက်'],
  parts: ['ကျော', 'ခြေထောက်', 'ခြေထောက်', 'ကြမ်းပြင်'],
  partFont: MY_FONT,
  partSize: 48,
  nameLine: '"pee-eup" လို့ ဖတ်ပါ',
  says: { a1: 'ဒါ π ပဲ။', a2: 'အခု # ဖြစ်သွားပြီ။', a3: 'ခဏလေး… ဒါ ခွေးလေးလား?', d: 'ဟင်… ခွေးလေး ပြန်ဖြစ်သွားပြီလား?', e1: 'မြင်လား? ကြမ်းပြင်ပေါ် ရပ်နေတဲ့ ခွေးလေးပဲ။' },
  size: { ...EN_TEXT.size, big: 72, lineHeight: 1.35, fix: 72, end: 58, sub: 42, tag: 46, tagPlain: 40, strokes: 50, name: 56 },
};

export const LOCALES: Record<Loc, LocText> = {
  en: EN_TEXT,
  zhs: ZHS_TEXT,
  my: MY_TEXT,
};
