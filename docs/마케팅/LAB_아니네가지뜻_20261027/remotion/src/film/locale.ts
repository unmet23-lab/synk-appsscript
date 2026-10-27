// 판별 화면 글. 영어판(en)이 원본이고, 두 채널 판(간체 등)은 기획장부/LAB.md 머리말 「두 채널 판」대로 이 표에 칸을 더한다.
// 한국어 소리(바리스타 범수)와 한국어 글(말풍선 · 자막 · 두 줄)은 판마다 그대로다.
export type Loc = 'en';

export type LocText = {
  font: string | null; // --kids-font(EN 글꼴 줄) 자리에 깔 글꼴 줄 — null이면 영어판 그대로
  voice: boolean; // 영어 해설 줄(n1 · n3 · n4)을 얹는가
  pov: { kicker: string; title: string[]; sub: string; titleSize: number; subSize: number };
  sub1: string; // 바리스타 「아니?!」 아래 줄
  bubble1: { tag: string; line: string };
  sub2: string; // 「아니~ 뭘 이런 걸!」 아래 줄
  again: string; // 몽글 「또 아니?!」 아래 줄
  lesson: { head: string; title: string; tone: string; whenWhat: string; what: string; whenAww: string; aww: string; turn: string };
  bubble2: string;
  sub3: string; // 「서비스예요!」 아래 줄
  end: string[]; // 끝 판 줄(마지막 줄 끝에 👇)
  endSize: number;
};

export const LOCALES: Record<Loc, LocText> = {
  en: {
    font: null,
    voice: true,
    pov: { kicker: 'POV:', title: ['you learned Korean', 'from an app'], sub: '…so 아니 always means “no”. Right?', titleSize: 84, subSize: 48 },
    sub1: 'What?!',
    // v2 시험 「4초 She said NO?!가 앞 장면과 바로 안 이어진다」 — 무엇을 거절당했다고 믿는지 말풍선에
    bubble1: { tag: '📱 textbook Korean: 아니 = “no”', line: '“She said NO to my coins?!”' }, // v4: 「won't take」도 사정이 안 이어졌다 — 아니 = NO와 바로 잇는다
    sub2: 'Aww, you shouldn’t have!',
    again: '“NO again?!”',
    lesson: {
      head: 'REAL KOREAN THAT WORKS',
      title: 'isn’t always “no”',
      tone: 'It depends on the tone 🎵', // v4: 「↗ · 〰가 억양 표시인지 확신 못 함」
      // v2 시험 「둘째 표현 · 서비스예요를 언제 쓰는지 모름」 — 줄마다 쓰는 때를 붙인다
      whenWhat: '😲 When you’re shocked:',
      what: '= “What?!”',
      whenAww: '🎁 When you get a gift:',
      aww: '= “Aww, you shouldn’t have!”',
      turn: 'YOUR TURN: say it out loud!',
    },
    bubble2: '“Aww, you shouldn’t have!”',
    sub3: 'A free cookie for you! 🍪',
    end: ['Which 아니', 'have you heard', 'in K-dramas?', 'Comment below 👇'],
    endSize: 80,
  },
};
