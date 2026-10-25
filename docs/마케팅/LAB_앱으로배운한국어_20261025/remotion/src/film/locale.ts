// 판별 화면 글(10-26 두 채널 판 — 기획장부/LAB.md 머리말 「두 채널 판」 · 대기 표 T3). 영어판(en)은 10-25 올린 그대로다.
// 간체(zhs, 샤오훙수)는 영어 목소리 두 줄(「Your turn. Say it out loud!」 · 끝 질문)을 빼고 그 말을 그 초의 화면 글로 옮긴다.
// 한국어 소리(바리스타 범수 · 해설 「아이스 아메리카노 하나 주세요.」)와 한국어 글(말풍선 · 자막 · 세 조각)은 그대로다.
// 영어 목소리로 짠 편이라 간체판만 낸다(버마어판은 10-25 T2에서 같은 꼴이 이해 시험을 세 번 넘지 못함 — 장부 머리말 3번).
// 문안 검수: 현지어대조(아르곤) · Opus 직역 역번역 · Fable — 기획.md 「두 채널 판」.
export type Loc = 'en' | 'zhs';

export type LocText = {
  font: string | null; // --kids-font(EN 글꼴 줄) 자리에 깔 글꼴 줄 — null이면 영어판 그대로
  voice: boolean; // 영어 해설 두 줄(n3 · n4)을 얹는가. 끄면 n3 자리에 한국어 해설 n2를 한 번 더 들려준다
  pov: { kicker: string; title: string[]; sub: string; titleSize: number; subSize: number };
  sub1: string; // 바리스타 「주문하시겠어요?」 아래 줄
  bubble1: { tag: string; line: string };
  stamp: string;
  sub2: string; // 「아, 네. 따뜻한 거요, 아이스요?」 아래 줄
  bubble2: { tag: string; line: string };
  lesson: { head: string; ice: string; hana: string; juseyo: string; any: string; turn: string; again?: string }; // again: 해설을 한 번 더 들려줄 때(목소리 없는 판) 「한 번 더 들어 봐」 — 따라 말할 틈 전까지
  bubble3: string;
  sub3: string; // 「네, 아이스 아메리카노 하나요!」 아래 줄
  end: string[]; // 끝 판 줄(마지막 줄 끝에 👇)
  endSize: number;
};

export const LOCALES: Record<Loc, LocText> = {
  en: {
    font: null,
    voice: true,
    pov: { kicker: 'POV:', title: ['you learned Korean', 'from an app'], sub: '…and now you order coffee', titleSize: 84, subSize: 52 },
    sub1: 'Ready to order?',
    bubble1: { tag: '📱 textbook Korean', line: '“Greetings. I desire coffee.”' },
    stamp: 'WAY TOO FORMAL',
    sub2: 'Uh, okay. Hot or iced?',
    bubble2: { tag: '😵 panic → random app sentence', line: '“The apple… is red.”' },
    lesson: { head: 'REAL KOREAN THAT WORKS', ice: 'iced americano', hana: 'one', juseyo: 'please', any: 'any menu item + ', turn: 'YOUR TURN: say it out loud!' },
    bubble3: '“One iced americano, please!”',
    sub3: 'Sure! One iced americano.',
    end: ["What's the weirdest", 'sentence your app', 'taught you? 👇'],
    endSize: 76,
  },
  zhs: {
    font: "'Inter Tight', 'Microsoft YaHei', sans-serif",
    voice: false,
    pov: { kicker: 'POV:', title: ['你的韩语', '全是App教的'], sub: '……现在要去点咖啡了', titleSize: 92, subSize: 56 },
    sub1: '请问要点什么？',
    bubble1: { tag: '📱 课本韩语', line: '“您好。本人想要咖啡。”' }, // 「我渴望咖啡」는 「갈망」이라 애절하게 읽혀 「太正式了」와 안 맞았다 — 공문서 투 「本人」(Opus 역번역)
    stamp: '太正式了！',
    sub2: '呃，好的。要热的还是冰的？',
    bubble2: { tag: '😵 一慌 → 冒出App例句', line: '“苹果……是红色的。”' },
    lesson: { head: '真正管用的韩语', ice: '冰美式', hana: '一个', juseyo: '请给我', any: '想点的东西 + ', // 「想点什么」는 「뭐 시킬래?」 의문문으로 읽혔다(Opus 역번역)
      turn: '轮到你啦：大声说出来！', again: '再听一遍 👂' }, // 첫 렌더 이해 시험 「12~16초 같은 말이 두 번 나와 멈춘 것 같다 · 무엇을 하라는지 모름」
    bubble3: '“请给我一杯冰美式！”',
    sub3: '好的！一杯冰美式。',
    end: ['App教过你最奇怪的', '韩语句子是哪句？👇'],
    endSize: 76,
  },
};
