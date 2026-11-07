// 판별 화면 글. 영어판(en)이 정본이다. 한국어(ㅈ · 쪽지 「잘했어!」)는 모든 판에서 그대로다.
export type Loc = 'en';

export type LocText = {
  voice: boolean; // 영어 진행 목소리를 얹는가
  bgm: number; // 배경음 세기
  kicker: string;
  title: string[]; // 첫 화면 큰 글 줄(첫 줄 앞에 kicker). 「ㅈ」은 한글 서체로 바뀐다
  sub: string;
  note: [string, string]; // 둘째 장 제목 두 줄(쪽지)
  same: string; // ✓ 뒤 제목
  two: string; // 두 꼴 나란히 제목
  end: [string, string]; // 끝 화면 두 줄
  tags: { copy: string; a1: string; a2: string; a3: string };
  size: { big: number; note: number; noteSub: number; end: number; endSub: number; kicker: number; sub: number; tag: number; tagPlain: number };
};

const EN_TEXT: LocText = {
  voice: true,
  bgm: 0.11,
  kicker: 'POV:',
  title: ['your first ㅈ'],
  sub: '(a Korean letter)',
  note: ['My Korean friend wrote:', '“Well done!”'],
  same: 'Same shape!',
  two: '2 ways to write ㅈ',
  end: ['both right!', 'Just never a Z.'],
  // 이해 시험 v1: 셋이 「왜 일본어 같다는지 모르겠다」 — 이름표에 그 일본 글자 ス를 함께, sonnet 「nice ✓가 어느 쪽인지 헷갈림」 → right ✓
  tags: { copy: 'copy this', a1: 'a Z?', a2: 'right ✓', a3: 'Japanese ス?!' },
  size: { big: 90, note: 70, noteSub: 56, end: 96, endSub: 66, kicker: 50, sub: 40, tag: 52, tagPlain: 42 },
};

export const LOCALES: Record<Loc, LocText> = { en: EN_TEXT };
