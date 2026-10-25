// 화면에 나가는 글. 관용구 퀴즈 #6(10-26) — 하늘 · 날씨 관용구: 바람맞다 · 하늘의 별 따기 · 해가 서쪽에서 뜨다.
// 뜻·용례의 근거는 한국어기초사전(10-26 07:3x 원문 다시 확인): 「바람맞다」 동사 1번 뜻 · 「하늘의 별 따기」 속담 · 「해가 서쪽에서 뜨다」 관용구.
// 1일 1편 상시 편(연재) — 퀴즈 #5(LAB_관용구퀴즈5_동물_20261021)의 틀을 복사했다.
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
    // 사전(동사): 만나기로 약속한 상대가 약속을 지키지 않아 헛걸음하다(2번 뜻 「중풍에 걸리다」는 쓰지 않는다). 말할 때는 「바람맞았어요」.
    idiom: '바람맞다',
    parts: [['바람', 'wind'], ['맞다', 'get hit']],
    guess: 'hit by the wind?',
    options: [
      { text: 'Caught a cold', correct: false, short: 'Caught a cold' },
      { text: 'Got stood up', correct: true, short: 'Got stood up' },
      { text: 'Bad hair day', correct: false, short: 'Bad hair day' },
    ],
    example: '두 시간 기다렸는데 [바람맞았어요].',
    gloss: 'I waited two hours. They never came!',
    say: ['바람맞았어요', 'ba-ram-ma-ja-sseo-yo'],
    art: 'bowl',
  },
  {
    // 사전(속담): 무엇을 얻거나 이루어내기가 매우 어렵다는 말. 용례 「서민들이 서울에서 집을 마련하기란 하늘의 별 따기이다」를 학습자용 해요체로.
    idiom: '하늘의 별 따기',
    parts: [['하늘의 별', 'star in the sky'], ['따기', 'picking']],
    guess: 'picking a star?',
    options: [
      { text: 'Loves the night', correct: false, short: 'Loves the night' },
      { text: 'Super hard to get', correct: true, short: 'Super hard to get' },
      { text: 'Very tall', correct: false, short: 'Very tall' },
    ],
    example: '콘서트 표 사기는 [하늘의 별 따기]예요.',
    gloss: 'Getting concert tickets is SO hard!',
    say: ['하늘의 별 따기예요', 'ha-neu-re byeol tta-gi-ye-yo'],
    art: 'network',
  },
  {
    // 사전(관용구): 전혀 예상 밖의 일이나 절대로 있을 수 없는 희한한 일이 벌어지다. 사전 용례가 없어 흔한 꼴(「…? 해가 서쪽에서 뜨겠어요!」)로 썼다.
    idiom: '해가 서쪽에서 뜨다',
    parts: [['해가 서쪽에서', 'sun from the west'], ['뜨다', 'rises']],
    guess: 'sun rises in the west?',
    options: [
      { text: 'Woke up late', correct: false, short: 'Woke up late' },
      { text: 'Bad weather', correct: false, short: 'Bad weather' },
      { text: 'That never happens!', correct: true, short: 'Never happens!' },
    ],
    example: '동생이 설거지를 했어요? [해가 서쪽에서 뜨겠어요]!',
    gloss: 'My little brother did the dishes? No way!',
    say: ['해가 서쪽에서 뜨겠어요', 'hae-ga seo-jjo-ge-seo tteu-ge-sseo-yo'],
    art: 'eye',
  },
];

export const RECAP = ['stood up', 'super hard', 'never happens'];
/** 게임 판·끝 알약에 다는 연재 이름. */
export const EXAM = { name: 'IDIOM QUIZ #6', date: '' };
export const HANDLE = '@synkkorean';
