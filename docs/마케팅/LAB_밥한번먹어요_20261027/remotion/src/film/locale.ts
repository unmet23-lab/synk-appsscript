// 판별 화면 글. 영어판(en)이 원본이고, 두 채널 판(간체 등)은 기획장부/LAB.md 머리말 「두 채널 판」대로 이 표에 칸을 더한다.
// 한국어 소리(바리스타 범수 · 해설 「네, 좋아요!」)와 한국어 글(말풍선 · 자막 · 두 줄)은 판마다 그대로다.
export type Loc = 'en';

export type LocText = {
  font: string | null; // --kids-font(EN 글꼴 줄) 자리에 깔 글꼴 줄 — null이면 영어판 그대로
  voice: boolean; // 영어 해설 줄(n1 · n3 · n4)을 얹는가
  pov: { kicker: string; title: string[]; sub: string; titleSize: number; subSize: number };
  sub1: string; // 바리스타 「다음에 밥 한번 먹어요!」 아래 줄
  bubble1: { tag: string; line: string };
  stamp: string;
  sub2: string; // 「아, 네. 그냥, 다음에요.」 아래 줄
  lesson: { head: string; notPlan: string; means: string; justSay: string; joayo: string; turn: string };
  bubble2: string;
  sub3: string; // 「네! 또 오세요!」 아래 줄
  end: string[]; // 끝 판 줄(마지막 줄 끝에 👇)
  endSize: number;
};

export const LOCALES: Record<Loc, LocText> = {
  en: {
    font: null,
    voice: true,
    pov: { kicker: 'POV:', title: ['you learned Korean', 'from an app'], sub: '…and the barista asks you to dinner?!', titleSize: 84, subSize: 42 }, // 50px은 오른쪽 끝 963px(안전선 920) — 올리기 전 검사
    sub1: "Let's grab a meal sometime!",
    bubble1: { tag: '📱 textbook Korean: a real invite!', line: '“Wow! When? 📅 Tuesday at 7?”' }, // 첫 렌더 시험 「폰이 계산기 같다」 — 달력이라는 걸 글로
    stamp: 'NOT A REAL PLAN',
    sub2: 'Uh… yeah. Just… sometime.',
    lesson: {
      head: 'REAL KOREAN THAT WORKS',
      notPlan: 'not a real plan',
      means: '= “See you around!” 👋',
      justSay: 'When you hear it, just say:', // 첫 렌더 시험 「진짜 초대에는 네, 좋아요」로 잘못 읽음 — 이 말에 하는 대답이라는 것을
      joayo: 'Sounds good!',
      turn: 'YOUR TURN: say it out loud!',
    },
    bubble2: '“Sounds good!”',
    sub3: 'Great! Come again!',
    end: ['What other Korean', '“polite lies”', 'do you know?', 'Comment below 👇'], // 첫 렌더 시험 「무엇을 하라는 건지 모름」
    endSize: 76,
  },
};
