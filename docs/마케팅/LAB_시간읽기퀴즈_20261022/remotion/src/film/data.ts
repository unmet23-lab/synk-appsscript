// 화면에 나가는 글. LAB 「한국어로 시간 읽기」 퀴즈(10-22) — 시는 고유어 수(한·두·세), 분은 한자어 수(일·이·삼), 30분은 「반」.
// 1일 1편 상시 편 · 역할 육성(학습자의 좌절과 성공) — 관용구 퀴즈 #5(LAB_관용구퀴즈5_동물_20261021)의 v5b 틀을 복사해 칸 뜻만 바꿨다.
//   idiom = 큰 제목(숫자로 적은 시각) · parts = 시·분 두 조각 · guess = 학습자가 흔히 하는 틀린 읽기(오답 딱지) · options = 한국어 읽기 셋.
// 근거는 기획.md 「문제」 표(사전 원문 확인).
/** short: v4(10-17) 두 낱말 안팎 보기 — 보기가 뜬 뒤 정답까지 1.6~1.9초라 읽을 양을 줄인다. */
export type Option = { text: string; correct: boolean; short?: string };
export type Question = {
  idiom: string; // 큰 제목
  parts: [string, string][]; // 글자 그대로 읽은 조각: [한국어, 영어]
  guess: string; // 틀린 읽기(오답 딱지)
  options: Option[];
  example: string; // [ ]로 감싼 곳에 형광펜
  gloss: string;
  say: [string, string]; // 실제로 말할 때와 로마자
  art: 'bowl' | 'network' | 'eye'; // 프리미엄판(film/Art.tsx) 선 그림 — 이 편은 키즈판만 쓴다
};

export const QUESTIONS: Question[] = [
  {
    // 3:30 — 시는 고유어(셋 → 세), 분은 한자어(삼십). 학습자가 흔히 「삼 시」라고 읽는다.
    idiom: '3시 30분',
    parts: [['3시', "3 o'clock"], ['30분', '30 min']],
    guess: '삼 시 삼십 분?',
    options: [
      { text: '세 시 서른 분', correct: false },
      { text: '세 시 삼십 분', correct: true },
      { text: '셋 시 삼십 분', correct: false },
    ],
    example: '우리 [세 시 삼십 분]에 만나요.',
    gloss: "Let's meet at 3:30!",
    say: ['세 시 삼십 분', 'se si sam-sip bun'],
    art: 'bowl',
  },
  {
    // 1:10 — 하나 → 한, 십 분. 시와 분을 거꾸로 읽는 실수(「일 시 열 분」).
    idiom: '1시 10분',
    parts: [['1시', "1 o'clock"], ['10분', '10 min']],
    guess: '일 시 열 분?',
    options: [
      { text: '한 시 십 분', correct: true },
      { text: '하나 시 십 분', correct: false },
      { text: '한 시 열 분', correct: false },
    ],
    example: '수업이 [한 시 십 분]에 끝나요.',
    gloss: 'Class ends at 1:10!',
    say: ['한 시 십 분', 'han si sip bun'],
    art: 'network',
  },
  {
    // 2:30 — 둘 → 두, 30분 = 반(절반). 보기 셋이 모두 「반」이라 시 읽기만 고르면 된다.
    idiom: '2시 30분',
    parts: [['2시', "2 o'clock"], ['30분', '30 min']],
    guess: '이 시 삼십 분?',
    options: [
      { text: '둘 시 반', correct: false },
      { text: '이 시 반', correct: false },
      { text: '두 시 반', correct: true },
    ],
    example: '벌써 [두 시 반]이에요!',
    gloss: "It's already 2:30. 반 = half!",
    say: ['두 시 반', 'du si ban'],
    art: 'eye',
  },
];

export const RECAP = ['세 시 삼십 분', '한 시 십 분', '두 시 반'];
/** 게임 판·끝 알약에 다는 연재 이름. */
export const EXAM = { name: 'KOREAN TIME QUIZ', date: '' };
export const HANDLE = '@synkkorean';

/** 끝 화면 규칙 카드(0초 약속 「1 RULE」을 끝에서 준다) — 영어판. 몽골어판은 i18n.ts MN_RULE. */
export const RULE = {
  title: 'THE RULE',
  rows: [
    { ko: '시', what: 'hours', nums: '한 · 두 · 세 · 네' },
    { ko: '분', what: 'minutes', nums: '일 · 이 · 삼 · 사' },
  ],
  bonus: '30분 = 반 (half)',
  comment: 'What time is it for you? Comment in Korean ↓',
};
