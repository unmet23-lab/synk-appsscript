// 화면에 나가는 글. 관용구 퀴즈 #5(10-21) — 동물 관용구: 파리(를) 날리다 · 우물 안 개구리 · 고양이 세수하듯.
// 뜻·용례의 근거는 한국어기초사전(10-21 07:5x 원문 다시 확인): 「파리(를) 날리다」 관용구 · 「우물 안 개구리[고기]」 속담 · 「고양이 세수하듯」 속담 1번 뜻.
// 1일 1편 상시 편(연재) — 퀴즈 #4(LAB_관용구퀴즈4_간_20261020)의 v5b 틀을 복사했다.
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
    // 사전: 손님이 없고 장사가 잘 안되어 한가하다. 용례 「부동산 거래가 뜸해져서 요즘은 부동산마다 파리를 날린다」. 말할 때는 「파리만 날려요」가 흔하다.
    idiom: '파리 날리다',
    parts: [['파리', 'fly'], ['날리다', 'let fly']],
    guess: 'flying flies like kites?',
    options: [
      { text: 'Catches bugs', correct: false, short: 'Catches bugs' },
      { text: 'No customers', correct: true, short: 'No customers' },
      { text: 'Dirty room', correct: false, short: 'Dirty room' },
    ],
    example: '비가 와서 가게에 [파리만 날려요].',
    gloss: "It's raining. No customers at all!",
    say: ['파리만 날려요', 'pa-ri-man nal-lyeo-yo'],
    art: 'bowl',
  },
  {
    // 사전: 넓은 세상을 알지 못하거나 보는 눈이 좁아서 자기만 잘난 줄 아는 사람. 용례 「세상 구경도 좀 하고 우물 안 개구리 신세를 벗어나야지」를 학습자용 해요체로.
    idiom: '우물 안 개구리',
    parts: [['우물 안', 'in a well'], ['개구리', 'frog']],
    guess: 'just a frog in a well?',
    options: [
      { text: 'Good swimmer', correct: false, short: 'Good swimmer' },
      { text: 'Loves rain', correct: false, short: 'Loves rain' },
      { text: 'Knows a tiny world', correct: true, short: 'Tiny world view' },
    ],
    example: '여행을 해 보니 저는 [우물 안 개구리]였어요.',
    gloss: 'Traveling showed me how small my world was!',
    say: ['우물 안 개구리였어요', 'u-mul an gae-gu-ri-yeo-sseo-yo'],
    art: 'network',
  },
  {
    // 사전: 얼굴에 물만 묻히고 세수를 마침을 뜻하는 말. 용례 「약속에 늦은 승규는 고양이 세수하듯 얼굴에 대충 물만 묻히고」. 말할 때는 「고양이 세수만 했어요」가 흔하다.
    idiom: '고양이 세수하듯',
    parts: [['고양이', 'cat'], ['세수하듯', 'like washing face']],
    guess: 'washing like a cat?',
    options: [
      { text: 'A quick splash', correct: true, short: 'Quick splash' },
      { text: 'Hates water', correct: false, short: 'Hates water' },
      { text: 'Loves fish', correct: false, short: 'Loves fish' },
    ],
    example: '늦잠을 자서 [고양이 세수만 했어요].',
    gloss: 'I overslept, so I just splashed my face!',
    say: ['고양이 세수만 했어요', 'go-yang-i se-su-man hae-sseo-yo'],
    art: 'eye',
  },
];

export const RECAP = ['no customers', 'tiny world view', 'quick splash'];
/** 게임 판·끝 알약에 다는 연재 이름. */
export const EXAM = { name: 'IDIOM QUIZ #5', date: '' };
export const HANDLE = '@synkkorean';
