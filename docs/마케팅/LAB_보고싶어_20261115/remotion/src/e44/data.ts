// LAB 영어 E44 「보고 싶어」(11-15 07시 회차) — 원본 같은분야 「Stop saying 'saRanghae'」(21.5초 · 바로잡기 꼴: 틀린 말 ✗ → 까닭 → 틀린 · 바른 짝 → 끝 권유).
// 우리: 밤 방, 친구 문자 「보고 싶어~」를 말 그대로(보고 = see · 싶어 = want to) 읽은 몽글이 셀카를 찍어 수십 장을 쏟아 보낸다(핵심 장면) →
// 친구 「ㅋㅋㅋ 아니 그게 아니라…」 → 「보고 싶어 = I miss you」 → 몽글이 「나도 보고 싶어!」로 답한다.
// v4(이해 시험 v3 · 볼 이유 v2 · v3 뒤): 0~0.85초에 사진이 쏟아지는 장면을 먼저 보이고 되감는다(원본 0~2.3초가 바로잡을 말을 먼저 보이는 자리 —
// 우리는 바로잡을 반응을 먼저). 볼 이유가 두 번 「0~2초가 같은 그림」을 가장 약한 자리로 짚었다.
// 그림 · 한국어 목소리 · 박자는 여기, 화면 글(영어 판과 두 채널 판)은 LOCS.
export const FPS = 30;
export const TOTAL = 18.0; // 원본 21.5초의 84%

export type Cell = { at: number; img: string };
export const CELLS: Cell[] = [
  { at: 0.0, img: 'b5.jpg' }, // 여는 칸(v4) — 폰에서 사진이 쏟아지는 끝장을 먼저(훅 — 원본 0~2.3초 「SaR✗ngHae」 자리)
  { at: 0.85, img: 'b1.jpg' }, // 되감기 — 문자가 온 폰을 보는 몽글
  { at: 2.3, img: 'b2.jpg' }, // 말 그대로 읽고 신난 몽글(원본 2.3초 까닭 설명 시작)
  { at: 5.1, img: 'b3.jpg' }, // 셀카 1 · 찰칵(원본 5.1초 R → L)
  { at: 6.4, img: 'b4.jpg' }, // 셀카 2
  { at: 7.7, img: 'b5.jpg' }, // 핵심 장면: 셀카 수십 장이 폰에서 쏟아진다
  { at: 9.7, img: 'b6c.jpg' }, // 받는 사람 — 친구 폰을 가까이: 입을 가리고 웃는 친구(원본 9.7 박자 · 장면 심사 v1 「받는 사람의 반응을 화면 가득」)
  { at: 10.7, img: 'b6.jpg' }, // 다시 방 — 사진이 온 방에 걸리고 깔린 채 어리둥절한 몽글(원본 10.7초 컷)
  { at: 12.2, img: 'b7.jpg' }, // 부끄러워 줄어드는 몽글 · 사진이 쏟아져 내린다(원본 12.2초 바른 말)
  { at: 14.8, img: 'b8.jpg' }, // 다정한 답장(원본 14.8초 · 끝 권유 17.6초)
];

// 몽글 목소리(소진) — 초 · 파일
export const VO: [number, string][] = [
  [2.4, 'm1'], // 보고 싶어? 나를?!
  [4.35, 'm2'], // 알았어! 찰칵!(「찰칵」이 0.76초 뒤 — 5.12초 플래시에 닿게. v4: 카드도 이때 뜬다 — 이해 시험 v3 sonnet · GPT 「4초 찰칵을 6초 풀이로만 앎」)
  [6.38, 'm3'], // 찰칵! 찰칵!
  [12.25, 'm4'], // 아…
  [15.0, 'm5'], // 나도 보고 싶어!
];

// 화면 글이 뜨는 때
export const T = {
  rewind: 0.85, // 되감기(여는 칸 → 문자가 오기 전)
  hookTo: 2.3, // 이름표
  msg1: 1.0, // 친구 문자 「보고 싶어~」
  literal: 2.4, // 낱말대로: 보고 see · 싶어 want to → “I want to see you”
  selfie: 4.35,
  sent: 7.9, // 사진 수십 장 보냄
  reply: 9.8, // 친구 답장
  oh: 12.3, // 몽글 「아…」 말풍선(머리 옆 — 이해 시험 v2 sonnet · haiku 「12.3초 아…를 모름」)
  ohTo: 13.3, // v4: 바로잡기 카드와 오래 겹치지 않게(볼 이유 v3 「14초에 글이 몰림」)
  fix: 12.5, // 보고 싶어 → I miss you ✓
  my: 15.0, // 몽글 답장 「나도 보고 싶어 ❤️」
  burst2: 15.9, // 끝 3초 — 답장과 함께 셀카를 또 쏟아 보낸다(핵심 장면이 끝에 한 번 더, 제작 절차 「한 장면 먼저」 ③)
  ask: 16.6, // 끝 질문
};

// 핵심 장면 카메라 — 셀카가 쏟아질 때 살짝 당겨 들어감, 플래시
export const FLASH = [0.85, 5.12, 5.85, 6.4, 7.32, 15.9];
export const FLOOD = { from: 7.7, to: 9.7, zoom: 0.08 };
// 되감은 뒤 밀어 들어가기 — 몽글 얼굴(판의 가로 55% · 세로 52%) 쪽으로 12%(볼 이유 v2 「0~2초 몽글이 가만히 서 있다」)
export const OPEN = { from: 1.0, to: 2.25, zoom: 0.12, origin: '55% 52%' };

export const SFX: [number, string, number][] = [
  [0.0, 'whoosh_up.wav', 0.3], // 여는 칸 — 쏟아짐
  [0.2, 'pop.wav', 0.18],
  [0.5, 'pop.wav', 0.18],
  [0.85, 'whoosh_down.wav', 0.3], // 되감기
  [1.0, 'ding.wav', 0.3], // 문자 알림
  [2.3, 'sparkle.wav', 0.22],
  [5.12, 'shutter.wav', 0.42],
  [5.85, 'shutter.wav', 0.38],
  [6.4, 'shutter.wav', 0.4],
  [7.32, 'shutter.wav', 0.38],
  [7.7, 'whoosh_up.wav', 0.34],
  [7.9, 'pop.wav', 0.2],
  [8.3, 'pop.wav', 0.18],
  [8.7, 'pop.wav', 0.18],
  [9.8, 'ding.wav', 0.26], // 친구 답장
  [12.2, 'freeze.wav', 0.2],
  [12.35, 'whoosh_down.wav', 0.24],
  [15.0, 'ding.wav', 0.24],
  [15.9, 'shutter.wav', 0.4],
  [16.0, 'whoosh_up.wav', 0.3],
  [16.2, 'pop.wav', 0.18],
  [16.6, 'pop.wav', 0.2],
];

// 화면 글(영어 판 정본) — 한국어 · 읽는 법(로마자)은 모든 판 그대로, 영어 · 뜻만 판마다
export type Loc = 'en' | 'zhs' | 'my';
export type LocText = {
  font: string;
  rewind: string; // 되감기 딱지
  hook: string; // 보낸 이 이름표
  msgRead: string; // 친구 첫 문자 아래 읽기 · 물음
  literalSee: string; // 보고
  literalWant: string; // 싶어
  literalSum: string; // 카드 머리
  literalSay: string; // 낱말대로 옮긴 문장
  mongleThinks: string; // 몽글 속생각(말풍선 뜻 줄)
  selfie: string; // 셀카
  sent: string; // 사진 보냄
  replyMean: string; // 친구 답장 뜻
  ohMean: string; // 몽글 「아…」 뜻
  fixMean: string; // 보고 싶어 = …
  fixNot: string; // 낱말대로는
  openSub: string; // 여는 칸 「+37 photos sent」 아래 뜻 줄
  myMean: string; // 나도 보고 싶어 뜻
  ask: string; // 끝 질문
};
export const FONT = "'Inter Tight', 'SUIT', sans-serif";
export const LOCS: Record<Loc, LocText> = {
  en: {
    font: FONT,
    rewind: '⏪ 10 seconds earlier',
    hook: 'Your Korean friend · 11:47 PM', // v3: 큰 영어 머리 글 대신 문자 창 이름표(이해 시험 v2 haiku 9번 「지난 편과 같은 영어 머리 글」)
    msgRead: 'bo-go si-peo = ❓', // v4: GPT · haiku 「0~2초 보고 싶어 뜻이 없다」 — 모르는 것을 물음으로 걸어 둔다
    literalSee: 'see',
    literalWant: 'want to',
    literalSum: 'Word by word:',
    literalSay: '→ “(I) want to see (you)”', // v4: GPT · 그록 「누가 누구를 보고 싶은지(주어)가 없다」 — 한국어는 나 · 너를 빼고 말한다
    mongleThinks: '“She wants to SEE me? Photos!” 📸', // v4: 몽글의 오해는 카드가 아니라 몽글 말풍선으로
    selfie: '“Okay! *click*”',
    sent: '+37 photos sent 📸',
    replyMean: 'ㅋㅋㅋ = lol\n“no, that’s not what I meant…”', // v3: 셋이 「ㅋㅋㅋ」 뜻을 짚음
    ohMean: '“Oh…”',
    fixMean: 'I miss you',
    fixNot: '“I want to see you” is how\nKoreans say “I miss you” 💗', // v5(시험 없이): haiku · 그록 v4 「카드에 I miss you와 I want to see you가 같이 있어 헷갈림」
    openSub: 'me, after ONE text 😳', // v5(시험 없이): v4 넷이 「첫 0.85초에 사진이 왜 쏟아지는지 모름」 // v3: GPT 「want to see와 I miss you가 어떻게 이어지나」
    myMean: '“I miss you too!”',
    ask: 'Who would you text\n“보고 싶어” to? 👇',
  },
  zhs: { font: "'Inter Tight', 'Microsoft YaHei', sans-serif", rewind: '', hook: '', msgRead: '', literalSee: '', literalWant: '', literalSum: '', literalSay: '', mongleThinks: '', selfie: '', sent: '', replyMean: '', ohMean: '', fixMean: '', fixNot: '', openSub: '', myMean: '', ask: '' },
  my: { font: "'Inter Tight', 'Myanmar Text', sans-serif", rewind: '', hook: '', msgRead: '', literalSee: '', literalWant: '', literalSum: '', literalSay: '', mongleThinks: '', selfie: '', sent: '', replyMean: '', ohMean: '', fixMean: '', fixNot: '', openSub: '', myMean: '', ask: '' },
};
