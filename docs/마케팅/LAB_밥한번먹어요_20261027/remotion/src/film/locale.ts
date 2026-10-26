// 판별 화면 글. 영어판(en)이 원본이고, 두 채널 판(간체 등)은 기획장부/LAB.md 머리말 「두 채널 판」대로 이 표에 칸을 더한다.
// 한국어 소리(바리스타 범수 · 해설 「네, 좋아요!」)와 한국어 글(말풍선 · 자막 · 두 줄)은 판마다 그대로다.
// 간체(zhs, 샤오훙수 · 10-27)는 영어 해설 셋(뜻 · 「Your turn」 · 끝 질문)을 빼고 그 말을 그 초의 화면 글로 옮긴다 — 따라 말하기
// 자리에는 한국어 해설 「네, 좋아요!」를 한 번 더 들려준다(E3 간체판과 같은 꼴). 영어 목소리로 짠 편이라 간체판만(장부 머리말 3번).
export type Loc = 'en' | 'zhs';

export type LocText = {
  font: string | null; // --kids-font(EN 글꼴 줄) 자리에 깔 글꼴 줄 — null이면 영어판 그대로
  voice: boolean; // 영어 해설 줄(n1 · n3 · n4)을 얹는가
  pov: { kicker: string; title: string[]; sub: string; titleSize: number; subSize: number };
  sub1: string; // 바리스타 「다음에 밥 한번 먹어요!」 아래 줄
  bubble1: { tag: string; line: string };
  stamp: string;
  sub2: string; // 「아, 네. 그냥, 다음에요.」 아래 줄
  lesson: { head: string; notPlan: string; means: string; justSay: string; joayo: string; turn: string; again?: string }; // again: 목소리 없는 판에서 해설을 한 번 더 들려줄 때 「한 번 더 들어 봐」
  bubble2: string;
  sub3: string; // 「네! 또 오세요!」 아래 줄
  end: string[]; // 끝 판 줄(마지막 줄 끝에 👇)
  endSize: number;
  lessonScale?: number; // 멈춘 칸의 뜻 · 대답 머리 · 풀이 글 배율(간체 올릴 판 시험 「8~18초 글이 작고 많다」)
  freezeCss?: string; // 멈춘 카페 배경 필터 — 목소리 없는 판은 덜 어둡게(간체 다시 시험 「8~18초 회색 화면이 10초 넘게 멈춰 있다」)
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
      notPlan: '✗ not a real plan',
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
  zhs: {
    font: "'Inter Tight', 'Microsoft YaHei', sans-serif",
    voice: false,
    pov: { kicker: 'POV:', title: ['你的韩语', '全是App教的'], sub: '……结果咖啡店店员约你吃饭？！', titleSize: 92, subSize: 46 },
    sub1: '下次一起吃个饭吧！',
    bubble1: { tag: '📱 课本脑：这是真邀请！', line: '哇！什么时候？📅 周二7点？' }, // Fable: 반각 따옴표 + 전각 ！？ 사이가 벌어진다 — 말풍선 대사는 따옴표 없이
    stamp: '只是客套话！',
    sub2: '啊，好吧。那……下次吧。', // Fable P1: 15자는 두 줄로 꺾여 「吧。」가 아래 글자 자리(1428)에 걸렸다 — 12자 한 줄
    lesson: {
      head: '实际生活中的韩语', // Opus 역번역: 管用은 「효과 있는」 — 이 편은 「실제 뜻」
      notPlan: '其实不是真的要约你', // ✗ 뒤 부정문은 이중 부정으로 읽힌다(Opus 역번역)
      means: '= “回头见”！👋',
      justSay: '听到这句，回一句：',
      joayo: '好呀！',
      turn: '轮到你啦：大声说出来！',
      again: '再听一遍 👂',
    },
    bubble2: '好呀！',
    sub3: '好嘞！欢迎再来！', // Fable P2: 손님 대답을 받는 밝은 점원 말투
    end: ['你还知道哪些', '韩国人的“客套话”？', '评论区告诉我 👇'],
    endSize: 76,
    lessonScale: 1.18,
    freezeCss: 'grayscale(0.5) brightness(0.72)',
  },
};
