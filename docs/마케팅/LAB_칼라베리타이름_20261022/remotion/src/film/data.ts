// 화면에 나가는 글. LAB 「칼라베리타에 내 이름을 한글로」(10-22) — 죽은 자의 날(Día de Muertos) 설탕 해골 이마에 친구 이름을 쓰는 풍습 + 스페인어 이름의 한글 표기.
// 1일 1편 시의성 편 · 역할 전환(끝에서 synk.im/nombre — 내 이름 한글로) — 관용구 퀴즈 #5의 v5b 틀을 복사해 칸 뜻만 바꿨다.
//   idiom = 큰 제목(스페인어 이름) · parts = 소리 실마리(스페인어 글자 → 한글 자모) · guess = 영어식 알파벳 표로 읽은 틀린 표기 · options = 한글 표기 셋.
// 표기는 synk.im/nombre 규칙(외래어 표기법 표 2·제3장 제4절 에스파냐어)으로 낸 값 그대로: Juan 후안 · Regina 레히나 · Guillermo 기예르모(docs/마케팅/맞춤도구/nombre/rules.js convert·intro·readAloud, 10-22).
/** short: v4(10-17) 두 낱말 안팎 보기 — 보기가 뜬 뒤 정답까지 1.6~1.9초라 읽을 양을 줄인다. */
export type Option = { text: string; correct: boolean; short?: string };
export type Question = {
  idiom: string; // 큰 제목
  parts: [string, string][]; // 소리 실마리: [스페인어 글자, 한글]
  guess: string; // 틀린 표기(오답 딱지)
  options: Option[];
  example: string; // [ ]로 감싼 곳에 형광펜
  gloss: string;
  say: [string, string]; // 실제로 말할 때(자기소개 해요체)와 로마자(도구 readAloud)
  art: 'bowl' | 'network' | 'eye'; // 프리미엄판(film/Art.tsx) 선 그림 — 이 편은 키즈판만 쓴다
  name: string; // 칼라베리타 이마 금박 띠에 쓰는 한글 이름(정답 그림)
};

export const QUESTIONS: Question[] = [
  {
    // j → ㅎ(표 2). 영어식 표는 j를 ㅈ으로 읽어 「주안」.
    idiom: 'JUAN',
    parts: [['J', '→ ㅎ']],
    guess: '주안?',
    options: [
      { text: '쥬안', correct: false },
      { text: '후안', correct: true },
      { text: '호안', correct: false },
    ],
    example: '제 이름은 [후안]이에요.',
    gloss: 'Me llamo Juan.',
    say: ['후안이에요', 'hu-a-ni-e-yo'],
    art: 'bowl',
    name: '후안',
  },
  {
    // e·i 앞 g → ㅎ(제3장 제4절 제3항). 영어식으로 읽으면 「레지나」.
    idiom: 'REGINA',
    parts: [['GI', '→ 히']],
    guess: '레지나?',
    options: [
      { text: '레기나', correct: false },
      { text: '레이나', correct: false },
      { text: '레히나', correct: true },
    ],
    example: '[레히나], 선물이에요!',
    gloss: '¡Regina, es un regalo para ti!',
    say: ['레히나예요', 're-hi-na-ye-yo'],
    art: 'network',
    name: '레히나',
  },
  {
    // gu는 e·i 앞에서 ㄱ(제3장 제4절 제1항), ll은 반모음 y(표 2, llama 야마). 글자대로 읽으면 「구일레르모」.
    idiom: 'GUILLERMO',
    parts: [['GUI', '→ 기'], ['LLE', '→ 예']],
    guess: '구일레르모?',
    options: [
      { text: '기예르모', correct: true },
      { text: '길레르모', correct: false },
      { text: '구이예르모', correct: false },
    ],
    example: '[기예르모] 씨, 반가워요!',
    gloss: '¡Mucho gusto, Guillermo!',
    say: ['기예르모예요', 'gi-ye-reu-mo-ye-yo'],
    art: 'eye',
    name: '기예르모',
  },
];

export const RECAP = ['후안', '레히나', '기예르모'];
/** 게임 판·끝 알약에 다는 연재 이름. */
export const EXAM = { name: 'CALAVERITA QUIZ', date: '' };
export const HANDLE = '@synkkorean';
