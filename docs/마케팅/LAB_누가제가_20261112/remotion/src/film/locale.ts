// 판별 화면 글. 영어판(en)이 정본이다. 한국어(시험지 문제 · 손글씨 답)는 모든 판에서 그대로다.
export type Loc = 'en';

export type LocText = {
  font: string | null; // --kids-font(EN 글꼴 줄) 자리에 깔 글꼴 줄 — null이면 영어판 그대로
  voice: boolean;
  bgm: number;
  kicker: string;
  title: string[]; // 첫 화면 큰 글 줄(첫 줄 앞에 kicker)
  q1Gloss: string; // 시험지 1번 문제 아래 영어 뜻
  q2Gloss: string;
  tags: { same: string };
  whatHand: string; // 1번 「뭐」 옆 빨간 손글씨
  whoHand: string; // 2번 「누가」 위 빨간 손글씨
  who: string; // 둘째 장 「누가」 위 빨간 손글씨
  me: string; // 「제가」 아래 빨간 손글씨
  rule: string; // ✓ 뒤 제목(「Who?」 → 제가)
  asFor: string; // 둘째 장 「저는」 위 빨간 손글씨
  rule2: [string, string]; // 두 답 나란히부터 끝까지 — 규칙 두 줄(GPT v1 「What이면 늘 저는?」 → 저는 = 나를 말할 때)
  size: { big: number; lineHeight: number; kicker: number; tag: number; rule: number };
};

const EN_TEXT: LocText = {
  font: null,
  voice: true,
  bgm: 0.11,
  kicker: 'POV:',
  title: ['your first', 'Korean quiz'],
  q1Gloss: 'What did you eat?',
  q2Gloss: 'Who ate the pizza?',
  tags: { same: 'same answer → ✗ ?!' },
  whatHand: 'what?',
  whoHand: 'who?',
  who: 'WHO?',
  me: 'it was ME!',
  rule: 'Answer “Who?” with 제가',
  asFor: 'about me...',
  rule2: ['저는 … about me', '“Who?” → 제가!'],
  size: { big: 88, lineHeight: 1.06, kicker: 50, tag: 50, rule: 92 },
};

export const LOCALES: Record<Loc, LocText> = { en: EN_TEXT };
