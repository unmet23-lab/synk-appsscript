// 화면에 나가는 글. 관용구 퀴즈 #3(10-19) — 음식 관용구: 미역국을 먹다 · 식은 죽 먹기 · 김칫국부터 마시다. 뜻의 근거는 표준국어대사전 관용구·속담 뜻풀이.
// 10-19 유호님 「조회수 있는 계정들은 … 그쪽에는 준비해서 올리자」 → 몽골(인스타 @synk.mn · 페북 SYNK)·샤오훙수·틱톡 미얀마. 퀴즈 #2(LAB_관용구퀴즈2_20261017)의 v5b 틀을 복사했다.
/** short: v4(10-17) 두 낱말 안팎 보기 — 보기가 뜬 뒤 정답까지 1.6~1.9초라 읽을 양을 줄인다. */
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
    // 미역이 미끄러워 「미끄러지다(떨어지다)」로 이어진 말. 미역국은 생일에 먹는 국이라 「생일」을 함정 보기로 둔다.
    idiom: '미역국을 먹다',
    parts: [['미역국', 'seaweed soup'], ['먹다', 'eat']],
    guess: 'eat seaweed soup?',
    options: [
      { text: 'Has a birthday', correct: false, short: 'Birthday' },
      { text: 'Fails a test', correct: true, short: 'Fails a test' },
      { text: 'Eats healthy', correct: false, short: 'Eats healthy' },
    ],
    example: '시험에서 또 [미역국을 먹었어요].',
    gloss: 'I failed the test again.',
    say: ['미역국 먹었어요', 'mi-yeok-guk meo-geo-sseo-yo'],
    art: 'bowl',
  },
  {
    idiom: '식은 죽 먹기',
    parts: [['식은 죽', 'cold porridge'], ['먹기', 'eating']],
    guess: 'eating cold porridge?',
    options: [
      { text: 'Super easy', correct: true, short: 'Super easy' },
      { text: 'Very boring', correct: false, short: 'Boring' },
      { text: 'Tastes bad', correct: false, short: 'Tastes bad' },
    ],
    example: '이 문제는 [식은 죽 먹기예요].',
    gloss: 'This question is a piece of cake.',
    say: ['식은 죽 먹기예요', 'si-geun juk meok-gi-ye-yo'],
    art: 'network',
  },
  {
    // 떡을 줄 사람은 생각도 않는데 떡 먹을 때 곁들일 김칫국부터 마신다는 속담. 해요체는 말할 때 흔히 줄이는 「김칫국 마시지 마요」.
    idiom: '김칫국부터 마시다',
    parts: [['김칫국부터', 'kimchi soup first'], ['마시다', 'drink']],
    guess: 'drink kimchi soup first?',
    options: [
      { text: 'Loves kimchi', correct: false, short: 'Loves kimchi' },
      { text: 'Is thirsty', correct: false, short: 'Thirsty' },
      { text: 'Celebrates too early', correct: true, short: 'Hopes too early' },
    ],
    example: '아직 몰라요. [김칫국부터 마시지 마세요]!',
    gloss: "We don't know yet. Don't celebrate too early!",
    say: ['김칫국 마시지 마요', 'gim-chit-guk ma-si-ji ma-yo'],
    art: 'eye',
  },
];

export const RECAP = ['fails a test', 'super easy', 'hopes too early'];
/** 게임 판·끝 알약에 다는 연재 이름. */
export const EXAM = { name: 'IDIOM QUIZ #3', date: '' };
export const HANDLE = '@synkkorean';
