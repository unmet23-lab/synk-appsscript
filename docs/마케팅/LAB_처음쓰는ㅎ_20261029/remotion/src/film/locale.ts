// 판별 화면 글. 영어판(en)이 정본이고, 두 채널 판(기획장부/LAB.md 머리말 「두 채널 판」)은 영어 목소리를 빼고(「히읗.」 한국어 한 줄만 남김)
// 그 말을 그 초의 화면 글로 옮긴다 — E5 간체판이 이 꼴로 넘었고, 같은 꼴의 버마어판은 넘지 못해 이 편은 간체판만 둔다.
// 한국어(ㅎ · ㅇ)와 읽는 법(hieut, 영어 로마자)은 모든 판에서 그대로다.
export type Loc = 'en' | 'zhs';

export type LocText = {
  font: string | null; // --kids-font(EN 글꼴 줄) 자리에 깔 글꼴 줄 — null이면 영어판 그대로
  voice: boolean; // 영어 진행 목소리를 얹는가
  bgm: number; // 배경음 세기(목소리가 없는 판은 조금 올린다)
  kicker: string; // 빈 글이면 상자를 두지 않는다
  title: string[]; // 첫 화면 큰 글 줄(첫 줄 앞에 kicker). 「ㅎ」은 한글 서체로 바뀐다
  sub: string; // 첫 화면 작은 줄 — {hieut} 자리는 고정폭 hieut
  fix: [string, string]; // 둘째 장 제목 두 줄
  end: [string, string]; // 끝 화면 두 줄(첫 줄 끝에 🎩) — 바른 ㅎ에 눈 · 입이 그려지는 반전
  tags: { copy: string; a1: string; a2: string; a3: string };
  strokes: [string, string, string]; // 세 획 이름(그 획을 긋는 동안 칸 아래 식에 뜬다)
  grade?: boolean; // 끝의 빨간 펜 「?/10」 — 없으면 둔다
  nameLine?: string; // 「히읗.」 소리 아래 한 줄 — {name} 자리는 한글 「히읗」
  size: { big: number; fix: number; end?: number; endSub: number; lineHeight: number; kicker: number; sub: number; tag: number; tagPlain: number };
};

const EN_TEXT: LocText = {
  font: null,
  voice: true,
  bgm: 0.11,
  kicker: 'POV:',
  title: ['your first ㅎ'],
  sub: '(the Korean letter {hieut})',
  fix: ['The real way:', '3 strokes'],
  end: ['ㅎ = a guy in a hat', '(the right way: 3 strokes)'], // 끝 반전 — v1 · v2 시험에서 끝 질문 카드가 지난 편들과 같아 보인다는 지적이 네 번이라 댓글 놀이는 고정 댓글로
  tags: { copy: 'copy this', a1: 'a snowman?', a2: 'a heart?', a3: 'a guy in a hat?' },
  strokes: ['short line', 'long line', 'circle'],
  grade: false,
  nameLine: 'its name: {name} (hee-eut)', // v1 · v2 시험 — 「히읗」 소리와 글자가 안 이어진다는 지적이 두 번
  size: { big: 90, fix: 92, end: 84, endSub: 56, lineHeight: 1.06, kicker: 50, sub: 40, tag: 48, tagPlain: 42 },
};

export const LOCALES: Record<Loc, LocText> = {
  en: EN_TEXT,
  zhs: EN_TEXT, // 간체판 글은 영어판이 이해 시험을 넘은 뒤에 쓴다
};
