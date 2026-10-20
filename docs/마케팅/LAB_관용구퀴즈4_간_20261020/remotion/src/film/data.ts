// 화면에 나가는 글. 관용구 퀴즈 #4(10-20) — 「간」 관용구: 간이 콩알만 해지다 · 간(이) 떨어지다 · 간(이) 크다. 뜻·예문의 근거는 한국어기초사전 「간3(肝)」 관용구(10-20 원문 다시 확인).
// 10-19 월요일 트렌드 스캔 §3 후보 2 · §4 추천 2(핼러윈을 가볍게 + 「으스스한 사실 한 줄」 + r/Korean 관용구 질문 + 퀴즈 연재). 퀴즈 #3(LAB_관용구퀴즈3_20261019)의 v5b 틀을 복사했다.
// 핼러윈 색은 아주 가볍게만(10-29 이태원 참사 4주기 앞): 파티·분장·거리 장면 없음. 예문은 천둥·공포 영화 정도로만.
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
    // 사전: 매우 겁이 나다. 예문은 사전 용례(도자기를 깬 것을 들킬까 봐)를 학습자용 해요체로 줄였다. 「간이 콩알만 하다」(겁이 많다)와는 다른 관용구다.
    idiom: '간이 콩알만 해지다',
    parts: [['간', 'liver'], ['콩알만 해지다', 'bean-sized']],
    guess: 'liver shrinks to a bean?',
    options: [
      { text: 'Feels sick', correct: false, short: 'Feels sick' },
      { text: 'Gets super scared', correct: true, short: 'Super scared' },
      { text: 'Loves beans', correct: false, short: 'Loves beans' },
    ],
    example: '할머니 꽃병을 깼어요. [간이 콩알만 해졌어요].',
    gloss: "I broke Grandma's vase. I'm so scared!",
    say: ['간이 콩알만 해졌어요', 'ga-ni kong-al-man hae-jyeo-sseo-yo'],
    art: 'bowl',
  },
  {
    // 사전: 매우 놀라다. 예문은 사전 용례 「갑자기 천둥이 치는 바람에 나는 간이 떨어질 뻔했다」에서.
    idiom: '간 떨어지다',
    parts: [['간', 'liver'], ['떨어지다', 'falls']],
    guess: 'liver falls out?',
    options: [
      { text: 'Falls asleep', correct: false, short: 'Falls asleep' },
      { text: 'Drops food', correct: false, short: 'Drops food' },
      { text: 'Totally startled', correct: true, short: 'Totally startled' },
    ],
    example: '천둥소리에 [간 떨어질 뻔했어요]!',
    gloss: 'That thunder made me jump!',
    say: ['간 떨어질 뻔했어요', 'gan tteo-reo-jil ppeon-hae-sseo-yo'],
    art: 'network',
  },
  {
    // 사전: 겁이 없다. 「간이 작다」(겁이 많다)의 사전 용례가 「간이 작아서 공포 영화를 못 본다」라 그 반대로 쓴다.
    idiom: '간이 크다',
    parts: [['간', 'liver'], ['크다', 'big']],
    guess: 'a big liver?',
    options: [
      { text: 'Fearless', correct: true, short: 'Fearless' },
      { text: 'Very tall', correct: false, short: 'Very tall' },
      { text: 'Big eater', correct: false, short: 'Big eater' },
    ],
    example: '혼자 공포 영화를 봐요? [간이 크네요]!',
    gloss: 'You watch horror movies alone? So brave!',
    say: ['간이 크네요', 'ga-ni keu-ne-yo'],
    art: 'eye',
  },
];

export const RECAP = ['super scared', 'totally startled', 'fearless'];
/** 게임 판·끝 알약에 다는 연재 이름. */
export const EXAM = { name: 'IDIOM QUIZ #4', date: '' };
export const HANDLE = '@synkkorean';
