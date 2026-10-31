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
  strokes: [string, string, string, string]; // 네 획 자리 이름(그 획을 긋는 동안 칸 아래 줄에서 켜진다)
  nameLine: string; // 「피읖.」 소리 아래 한 줄 — {name} 자리는 한글 「피읖」
  says?: { a1: string; a2: string; a3: string; e1: string }; // 목소리 없는 판 — 그 말을 그 초의 화면 글로
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
  nameLine: 'say "pee-eup"',
  size: { big: 90, fix: 92, end: 92, endSub: 54, lineHeight: 1.06, kicker: 50, sub: 40, tag: 52, tagPlain: 42, strokes: 54, name: 62 },
};

export const LOCALES: Record<Loc, LocText> = {
  en: EN_TEXT,
  zhs: EN_TEXT, // 간체판 글은 영어판이 이해 시험을 넘은 뒤에 쓴다
  my: EN_TEXT,
};
