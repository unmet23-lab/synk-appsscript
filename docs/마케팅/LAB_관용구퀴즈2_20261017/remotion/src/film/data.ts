// 화면에 나가는 글. 관용구 퀴즈 #2(10-17) — 입이 무겁다 · 귀가 얇다 · 배꼽이 빠지다. 뜻의 근거는 표준국어대사전 관용구 뜻풀이.
// 첫 편(LAB_TOPIK관용구_20261013)의 시험일 훅(TOPIK 108)은 쓰지 않고, 게임 판에는 연재 이름을 단다.
/** short: v4(10-17) 두 낱말 이하 보기 — 보기가 뜬 뒤 정답까지 1.6~1.9초라 읽을 양을 줄인다. */
export type Option = { text: string; correct: boolean; short?: string };
export type Question = {
  idiom: string; // 큰 제목
  parts: [string, string][]; // 글자 그대로 읽은 조각: [한국어, 영어]
  guess: string; // 글자 그대로 옮긴 오답
  options: Option[];
  example: string; // [ ]로 감싼 곳에 형광펜
  gloss: string;
  say: [string, string]; // 실제로 말할 때(해요체)와 로마자
  art: 'bowl' | 'network' | 'eye'; // 프리미엄판(film/Art.tsx) 선 그림 — 이 편은 키즈판만 쓴다
};

export const QUESTIONS: Question[] = [
  {
    idiom: '입이 무겁다',
    parts: [['입', 'mouth'], ['무겁다', 'heavy']],
    guess: 'heavy mouth?',
    options: [
      { text: 'Eats a lot', correct: false, short: 'Big eater' },
      { text: 'Keeps secrets', correct: true, short: 'Keeps secrets' },
      { text: 'Talks slowly', correct: false, short: 'Slow talker' },
    ],
    example: '지우는 [입이 무거워서] 비밀을 잘 지켜요.',
    gloss: 'Jiwoo never tells your secrets.',
    say: ['입이 무거워요', 'i-bi mu-geo-wo-yo'],
    art: 'bowl',
  },
  {
    idiom: '귀가 얇다',
    parts: [['귀', 'ear'], ['얇다', 'thin']],
    guess: 'paper-thin ears?',
    options: [
      { text: 'Hears everything', correct: false, short: 'Good hearing' },
      { text: 'Has tiny ears', correct: false, short: 'Tiny ears' },
      { text: 'Believes anything', correct: true, short: 'Believes anything' },
    ],
    example: '아빠는 [귀가 얇아서] 광고만 보면 다 사요.',
    gloss: 'Dad buys everything he sees in ads.',
    say: ['귀가 얇아요', 'gwi-ga yal-ba-yo'],
    art: 'network',
  },
  {
    idiom: '배꼽이 빠지다',
    parts: [['배꼽', 'belly button'], ['빠지다', 'fall out']],
    guess: 'belly button falls out?',
    options: [
      { text: 'Laughs really hard', correct: true, short: 'Laughs hard' },
      { text: 'Has a tummy ache', correct: false, short: 'Tummy ache' },
      { text: 'Eats too much', correct: false, short: 'Overeats' },
    ],
    example: '너무 웃겨서 [배꼽 빠지겠어요!]',
    gloss: 'So funny, my belly button might fall out!',
    say: ['배꼽 빠지겠어요', 'bae-kkop ppa-ji-ge-sseo-yo'],
    art: 'eye',
  },
];

export const RECAP = ['keeps secrets', 'believes anything', 'laughs hard'];
/** 게임 판·끝 알약에 다는 연재 이름(첫 편은 시험 이름·날짜였다). */
export const EXAM = { name: 'IDIOM QUIZ #2', date: '' };
export const HANDLE = '@synkkorean';
