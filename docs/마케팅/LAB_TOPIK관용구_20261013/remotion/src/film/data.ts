// 화면에 나가는 글. 뜻의 근거는 표준국어대사전 관용구 뜻풀이, 시험일은 제108회 TOPIK(2026-10-17·18, 지역마다 다름).
export type Option = { text: string; correct: boolean };
export type Question = {
  idiom: string; // 큰 제목
  parts: [string, string][]; // 글자 그대로 읽은 조각: [한국어, 영어]
  guess: string; // 글자 그대로 옮긴 오답
  options: Option[];
  example: string; // [ ]로 감싼 곳에 형광펜
  gloss: string;
  say: [string, string]; // 실제로 말할 때(해요체)와 로마자
  art: 'bowl' | 'network' | 'eye';
};

export const QUESTIONS: Question[] = [
  {
    idiom: '손이 크다',
    parts: [['손', 'hand'], ['크다', 'big']],
    guess: 'big hands?',
    options: [
      { text: 'Has big hands', correct: false },
      { text: 'Generous — makes too much', correct: true },
      { text: 'Good at crafts', correct: false },
    ],
    example: '할머니는 [손이 커서] 음식을 늘 많이 하세요.',
    gloss: 'Grandma always cooks way too much.',
    say: ['손이 커요', 'so-ni keo-yo'],
    art: 'bowl',
  },
  {
    idiom: '발이 넓다',
    parts: [['발', 'foot'], ['넓다', 'wide']],
    guess: 'wide feet?',
    options: [
      { text: 'Knows lots of people', correct: true },
      { text: 'Has wide feet', correct: false },
      { text: 'Walks everywhere', correct: false },
    ],
    example: '민수는 [발이 넓어서] 어디를 가도 아는 사람이 있어요.',
    gloss: 'Minsu knows someone everywhere he goes.',
    say: ['발이 넓어요', 'ba-ri neol-beo-yo'],
    art: 'network',
  },
  {
    idiom: '눈이 높다',
    parts: [['눈', 'eye'], ['높다', 'high']],
    guess: 'high eyes?',
    options: [
      { text: 'Has big eyes', correct: false },
      { text: 'Can see far away', correct: false },
      { text: 'Has high standards', correct: true },
    ],
    example: '언니는 [눈이 높아서] 소개팅을 다 거절해요.',
    gloss: 'My sister turns down every blind date.',
    say: ['눈이 높아요', 'nu-ni no-pa-yo'],
    art: 'eye',
  },
];

export const RECAP = ['generous', 'knows everyone', 'picky'];
export const EXAM = { name: 'TOPIK 108', date: 'Oct 17–18' };
export const HANDLE = '@synkkorean';
