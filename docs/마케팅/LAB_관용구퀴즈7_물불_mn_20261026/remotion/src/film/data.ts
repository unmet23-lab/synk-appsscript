// 화면에 나가는 글. 관용구 퀴즈 #7 몽골판(10-26) — 물 · 불 관용구: 물에 빠진 생쥐 · 불 보듯 뻔하다 · 물 건너가다.
// 뜻·용례의 근거는 한국어기초사전(10-26 22:2x 원문, 속담·관용구 갈래): 「물에 빠진 생쥐」 물에 흠뻑 젖어 모습이 매우 초라해 보이는 모습 ·
//   「불(을) 보듯 뻔하다[훤하다]」 의심할 것 없이 확실하다(용례 「결과가 불 보듯 뻔하다」) · 「물 건너가다」 일의 상황이 이미 끝나 어떠한 조치도 할 수 없다.
// 1일 1편 상시 편(연재) — 퀴즈 #6(LAB_관용구퀴즈6_하늘_20261026)의 틀을 복사했다. 이 편은 몽골어판 하나(영어판은 다음 주).
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
    // 사전(관용구): 물에 흠뻑 젖어 모습이 매우 초라해 보이는 모습. 사전 용례가 없어 학습자에게 흔한 꼴(「우산이 없어서 … 됐어요」)로 썼다.
    idiom: '물에 빠진 생쥐',
    parts: [['물에 빠진', 'fallen in water'], ['생쥐', 'mouse']],
    guess: 'a swimming mouse?',
    options: [
      { text: 'Loves swimming', correct: false, short: 'Loves swimming' },
      { text: 'Soaking wet', correct: true, short: 'Soaking wet' },
      { text: 'Very scared', correct: false, short: 'Very scared' },
    ],
    example: '우산이 없어서 [물에 빠진 생쥐가] 됐어요.',
    gloss: 'No umbrella. I got soaked!',
    say: ['물에 빠진 생쥐가 됐어요', 'mu-re ppa-jin saeng-jwi-ga dwae-sseo-yo'],
    art: 'bowl',
  },
  {
    // 사전(관용구): 불(을) 보듯 뻔하다[훤하다] — 의심할 것 없이 확실하다. 사전 용례 「결과가 불 보듯 뻔하다」를 고양이 장면에 붙여 해요체로.
    idiom: '불 보듯 뻔하다',
    parts: [['불', 'fire'], ['보듯', 'like seeing']],
    guess: 'staring at fire?',
    options: [
      { text: 'Loves fire', correct: false, short: 'Loves fire' },
      { text: 'Very hot', correct: false, short: 'Very hot' },
      { text: 'So obvious', correct: true, short: 'So obvious' },
    ],
    example: '고양이 앞에 생선을 두면? 결과는 [불 보듯 뻔해요]!',
    gloss: 'A fish in front of a cat? Obvious!',
    say: ['불 보듯 뻔해요', 'bul bo-deut ppeon-hae-yo'],
    art: 'network',
  },
  {
    // 사전(관용구): 일의 상황이 이미 끝나 어떠한 조치도 할 수 없다. 사전 용례가 없어 기차를 놓친 장면으로 썼다.
    idiom: '물 건너가다',
    parts: [['물', 'water'], ['건너가다', 'cross over']],
    guess: 'crossing the water?',
    options: [
      { text: 'Too late now', correct: true, short: 'Too late now' },
      { text: 'Go abroad', correct: false, short: 'Go abroad' },
      { text: 'Go fishing', correct: false, short: 'Go fishing' },
    ],
    example: '기차가 벌써 떠났어요. 여행은 [물 건너갔어요].',
    gloss: 'The train already left. The trip is off!',
    say: ['물 건너갔어요', 'mul geon-neo-ga-sseo-yo'],
    art: 'eye',
  },
];

export const RECAP = ['soaking wet', 'so obvious', 'too late now'];
/** 게임 판·끝 알약에 다는 연재 이름. */
export const EXAM = { name: 'IDIOM QUIZ #7', date: '' };
export const HANDLE = '@synkkorean';
