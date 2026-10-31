// LAB E9 「미안 세 단계」 — 오마주 doci Ia6gYNDm-7o(9칸 · 박자 1.0 2.3 4.4 6.1 9.3 10.1 11.2 12.5 · 14.7초)의 칸표.
// 칸 초는 원본 실측 그대로(오마주.json 「박자」). 그림은 칸마다 앞 칸을 참고로 구운 한 장(판/칸N_*.png → public/img/kN.jpg).
// 목소리(소진 · 세기 1.0)는 한국어 줄만 — 칸이 바뀌기 0.1~0.2초 앞에 말이 끝나게 놓았다(원본의 칸 앞 숨).
// 판별 글: 영어판(en)이 원본이고, 두 채널 판(간체 · 버마어)은 LAB 장부 머리말 「두 채널 판」대로 이 표에 칸을 더한다(한국어 줄은 그대로).
// v2(이해 시험 v1 — sonnet 3 · haiku 4, haiku 「지난 아니 편과 같아 보임」): 반전의 까닭을 말에(7 「내가 왜 사과해?」 · 8 「네가 부딪쳤잖아!」),
// 5칸은 「매일 두 잔씩!」을 더해 칸 안에서 한 번 더 바뀌게(두 시험관 다 「6.1~9.3초가 늘어진다」), 4칸에 사극 말투 꼬리.
// v3(이해 시험 v2 — haiku 이해 3 · 재미 3 · 「아니 편과 같아 보임」, 둘 다 「왜 쏟았는지 · 누가 부딪쳤는지 장면이 없다」): 무대를 카페에서
// 학교 복도로 바꾸고 커피를 뒤집어쓴 선생님을 왼쪽에 세웠다(판/v3칸N). 말풍선은 선생님 얼굴을 비켜 오른쪽, 5칸은 낱말씩.
// v4(10-31 다시 살림 — 「다시 살린다면」): 0~0.6초 부딪힘 칸(k0)을 앞에 · 1~5칸을 그만큼 당겨 넣고 반전 9.3 · 끝 12.5는 그대로 · 9.3초부터 꼬리가
// 뒤로 젖힌 몽글로 · 8 · 9칸 화살표가 선생님을 가리킴. 끝에 원본에 없는 한 방을 더했다 — 선생님 눈빛(k10) → 몽글 하나가 납작 엎드려 「죄송합니다.」(k11).
// v6(이해 시험 v5 — 셋이 같이 짚은 「사옵니다」는 꼬리표로 「사극에서만」, 9~13초 급함은 7~9칸을 0.4~0.5초 늘려서. 볼 이유 심사의 약한 자리 6~9초는
// 평생 커피를 바치는 상상 장면 두 장으로 — k5a(줄 선 몽글마다 한 잔) → 「매일 두 잔씩!」 k5b(두 잔 · 컵 산에 놀란 선생님)).
// v8(이해 시험 v7 — 셋이 또 짚은 「죽을죄를 지었사옵니다」는 그림으로: 4칸을 사극 궁궐 장면 k4p로. 볼 이유 심사의 약한 자리 11.6~15.2초와 haiku의 화자 착각은
// 9칸을 몽글이 왕좌에 앉고 선생님이 커피를 바치는 역전 장면 k9r로. 8칸 화살표에 「네가 = you」).
// v9(이해 시험 v8 — 셋이 세 번째 짚은 낱말을 쉬운 말로: 4칸 「전하! 죄송합니다!」. 사다리를 LV.99 · LV.999로 이어 과장임을 분명히. 볼 이유 심사의 약한 자리 9.3~13초는
// 그림으로 — 「근데…」부터 몽글 전부가 눈물을 그치고 선생님을 째려본다(k6g · k7g · k8g)).
// v10(이해 시험 v9 — haiku가 두 번 화자를 선생님으로 읽어 몽글에도 이름표, 「전하」를 둘이 짚어 4칸은 한국어 · 뜻을 한 줄씩 짝으로.
// 볼 이유 심사: 5칸 말풍선이 컵 더미를 가리고 글이 많다 — 문장을 줄이고(s5c) 말풍선을 아래로, 컵 더미는 1.4초 보인다).
// v12(이해 시험 v5 · v7 · v8 · v9 · v11 — GPT가 내내 「왜 다시 사과하나」, 볼 이유 심사 「0초 충돌을 증거처럼」): 끝 눈빛 앞에 0초 부딪힘을 되감아 보인다(REPLAY) —
// 몽글이 부딪친 것이 증거로 나오고, 그래서 눈빛 한 번에 무너진다.
export const FPS = 30;
export const TOTAL = 18.9;

export type Cell = {
  at: number; // 칸이 시작하는 초(원본 박자)
  img: string;
  vo: string;
  voAt: number;
  ko: string;
  koSize: number;
  level?: number; // 1~3단계 표(배울 세 낱말만)
  roman?: string; // 배울 세 낱말만 읽는 법
  more?: { at: number }; // 칸 안에서 뜻 줄이 한 번 더 붙는 때(5칸)
  words?: [string, number, boolean?][]; // 목소리에 맞춰 낱말씩 나오는 한국어 줄 — [낱말, 목소리 안 초, 강조] · '\n'은 줄바꿈(v3)
  bare?: boolean; // 글 없는 칸(부딪힘 · 눈빛)
  next?: { at: number; img: string }; // 칸 안에서 그림이 한 번 더 바뀌는 때(5칸 상상 장면)
  tail?: 'back' | 'end' | 'dream' | 'palace' | 'throne'; // 말풍선 자리 — 없으면 처음 몽글, back은 뒤로 젖힌 몽글(반전), end는 납작 엎드린 몽글, 나머지 셋은 상상 장면
  arrow?: boolean; // 「네가」가 가리키는 선생님 쪽 화살표
  pairs?: boolean; // 한국어 · 뜻을 한 줄씩 번갈아(4칸)
  replay?: boolean; // 0초 부딪힘 되감기 칸
};

export const CELLS: Cell[] = [
  { at: 0.0, img: 'k0.jpg', vo: '', voAt: 0, ko: '', koSize: 0, bare: true },
  { at: 0.6, img: 'k1.jpg', vo: 's1', voAt: 0.7, ko: '미안.', koSize: 124, level: 1, roman: 'mi-an' },
  { at: 1.5, img: 'k2.jpg', vo: 's2', voAt: 1.52, ko: '미안해요.', koSize: 116, level: 2, roman: 'mi-an-hae-yo' },
  { at: 2.8, img: 'k3.jpg', vo: 's3', voAt: 2.85, ko: '죄송합니다.', koSize: 112, level: 3, roman: 'joe-song-ham-ni-da' },
  { at: 4.3, img: 'k4p.jpg', vo: 's4b', voAt: 4.33, ko: '전하!\n죄송합니다!', koSize: 90, level: 99, tail: 'palace', pairs: true },
  {
    at: 6.2, img: 'k5a.jpg', vo: 's5c', voAt: 6.4, ko: '평생 커피 사겠습니다,\n매일 두 잔씩!', koSize: 72, level: 999, more: { at: 7.91 }, next: { at: 7.9, img: 'k5b.jpg' }, tail: 'dream',
    // v3: 말 박자대로 낱말이 붙어 칸 안에서 계속 바뀐다(s5c.json 낱말 시각)
    words: [['평생', 0.02], ['커피', 0.4], ['사겠습니다,', 0.63], ['\n', 0], ['매일', 1.51, true], ['두', 1.82, true], ['잔씩!', 1.94, true]],
  },
  { at: 9.3, img: 'k6g.jpg', vo: 's6', voAt: 9.3, ko: '근데…', koSize: 112, tail: 'back' },
  { at: 10.2, img: 'k7g.jpg', vo: 's7b', voAt: 10.22, ko: '내가 왜\n사과해?', koSize: 100, tail: 'back' },
  { at: 11.6, img: 'k8g.jpg', vo: 's8b', voAt: 11.62, ko: '네가\n부딪쳤잖아!', koSize: 92, tail: 'back', arrow: true },
  { at: 13.0, img: 'k9r.jpg', vo: 's9', voAt: 13.05, ko: '커피값도 당연히\n네가 내야지.', koSize: 80, tail: 'throne' },
  { at: 15.2, img: 'k0.jpg', vo: '', voAt: 0, ko: '', koSize: 0, bare: true, replay: true },
  { at: 16.1, img: 'k10.jpg', vo: '', voAt: 0, ko: '', koSize: 0, bare: true },
  { at: 17.0, img: 'k11.jpg', vo: 's10', voAt: 17.12, ko: '죄송합니다.', koSize: 96, level: 3, roman: 'joe-song-ham-ni-da', tail: 'end' },
];

// 효과음(직접 합성 — remotion/소리.py). 목소리 머리에 겹치지 않는 자리에만 둔다.
export const SFX: { file: string; at: number; vol: number }[] = [
  { file: 'thud.wav', at: 0.0, vol: 1 },
  { file: 'splash.wav', at: 0.03, vol: 0.8 },
  { file: 'rewind.wav', at: 15.2, vol: 0.8 },
  { file: 'thud.wav', at: 15.55, vol: 0.8 },
  { file: 'sting.wav', at: 16.1, vol: 1 },
  { file: 'flop.wav', at: 17.0, vol: 0.9 },
];

export type Loc = 'en' | 'zh' | 'my';

export type LocText = {
  font: string | null; // 뜻 줄 글꼴 줄 — null이면 Inter Tight
  levelWord: string; // 단계 표 앞말(LV)
  levelTail?: string; // 단계 표 뒷말(간체 「第○级」)
  meanColor?: string; // 뜻 줄 색 — 간체는 더 어둡게(획이 굵어 올리기 전 검사 ⑤-2가 흰 말풍선을 「흰 기본 글자」로 오인했다, 10-31)
  teacher: string; // 선생님 이름표(시험관이 「이 할머니가 선생님인가」를 확신 못 함)
  you: string; // 화살표 옆 「네가 = ○」의 ○
  replay: string; // 되감기 칸 표시
  student: string; // 몽글 이름표(haiku가 말하는 쪽을 선생님으로 읽음)
  lines: { text: string; tag?: string; size: number; more?: string }[]; // 칸마다 뜻 줄 · 쓰는 자리 꼬리 · 둘째 걸음 뜻
};

export const LOCALES: Record<Loc, LocText> = {
  en: {
    font: null,
    levelWord: 'LV.',
    teacher: 'teacher',
    you: 'you',
    replay: 'REPLAY',
    student: 'student',
    lines: [
      { text: '', size: 0 },
      { text: 'Sorry.', tag: '👫 friends only', size: 60 },
      { text: 'I’m sorry.', tag: '🙂 polite', size: 60 },
      { text: 'I’m very sorry.', tag: '🙇 for teachers', size: 60 },
      { text: 'Your Majesty!\nI’m so sorry!', tag: '👑 palace dramas only', size: 54 },
      { text: 'Your coffee for life,', size: 52, more: 'two cups a day!' },
      { text: 'Wait…', size: 60 },
      { text: 'Why am I the one\nsaying sorry?', size: 54 },
      { text: 'YOU bumped into ME!', size: 50 },
      { text: 'So YOU pay for the coffee.\nObviously.', size: 50 },
      { text: '', size: 0 },
      { text: '', size: 0 },
      { text: 'I’m very sorry.', tag: '🙇 for teachers', size: 56 },
    ],
  },
  // 두 채널 판(샤오훙수 간체) — 번역이 아니라 중국어로 다시 쓴 뜻 줄. 4칸 사극 말투는 중국 궁중극 말투로.
  zh: {
    font: "'Inter Tight', 'Microsoft YaHei', sans-serif",
    levelWord: '第',
    levelTail: '级',
    teacher: '老师',
    meanColor: '#8A2414',
    you: '你',
    replay: '回放',
    student: '学生',
    lines: [
      { text: '', size: 0 },
      { text: '不好意思啦。', tag: '👫 只对朋友', size: 60 },
      { text: '对不起。', tag: '🙂 有礼貌', size: 60 },
      { text: '非常抱歉。', tag: '🙇 对老师', size: 60 },
      { text: '殿下！\n臣知错了！', tag: '👑 只在宫廷剧里', size: 56 },
      { text: '您的咖啡我包一辈子，', size: 50, more: '每天两杯！' },
      { text: '等等……', size: 60 },
      { text: '凭什么是我道歉？', size: 58 },
      { text: '明明是你撞的我！', size: 50 },
      { text: '所以咖啡钱，\n当然你来付。', size: 54 },
      { text: '', size: 0 },
      { text: '', size: 0 },
      { text: '非常抱歉。', tag: '🙇 对老师', size: 56 },
    ],
  },
  // 두 채널 판(틱톡 버마어) — 버마어로 다시 쓴 뜻 줄. 몽글은 성별이 없어 공손한 1인칭 대명사를 빼고 쓴다.
  my: {
    font: "'Inter Tight', 'Myanmar Text', sans-serif",
    levelWord: 'အဆင့် ',
    teacher: 'ဆရာမ',
    you: 'မင်း',
    replay: 'ပြန်ကြည့်ရအောင်',
    student: 'ကျောင်းသား',
    lines: [
      { text: '', size: 0 },
      { text: 'ဆောရီး။', tag: '👫 သူငယ်ချင်းကိုပဲ', size: 50 },
      { text: 'တောင်းပန်ပါတယ်။', tag: '🙂 ယဉ်ယဉ်ကျေးကျေး', size: 50 },
      { text: 'အလေးအနက် တောင်းပန်ပါတယ်။', tag: '🙇 ဆရာမကို', size: 48 },
      { text: 'အရှင်မင်းကြီး!\nခွင့်လွှတ်တော်မူပါ ဘုရား!', tag: '👑 နန်းတွင်းဇာတ်လမ်းတွဲမှာပဲ', size: 46 },
      { text: 'တစ်သက်လုံး ကော်ဖီ ဝယ်တိုက်ပါ့မယ်၊', size: 42, more: 'နေ့တိုင်း နှစ်ခွက်စီ!' },
      { text: 'ခဏနေဦး…', size: 50 },
      { text: 'ဘာလို့ ငါက\nတောင်းပန်နေရတာလဲ?', size: 48 },
      { text: 'မင်းက ငါ့ကို\nဝင်တိုက်တာလေ!', size: 48 },
      { text: 'ဒီတော့ ကော်ဖီဖိုး\nမင်းပဲ ပေးရမယ်နော်!', size: 46 },
      { text: '', size: 0 },
      { text: '', size: 0 },
      { text: 'အလေးအနက် တောင်းပန်ပါတယ်။', tag: '🙇 ဆရာမကို', size: 46 },
    ],
  },
};
