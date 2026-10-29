// LAB E9 「미안 세 단계」 — 오마주 doci Ia6gYNDm-7o(9칸 · 박자 1.0 2.3 4.4 6.1 9.3 10.1 11.2 12.5 · 14.7초)의 칸표.
// 칸 초는 원본 실측 그대로(오마주.json 「박자」). 그림은 칸마다 앞 칸을 참고로 구운 한 장(판/칸N_*.png → public/img/kN.jpg).
// 목소리(소진 · 세기 1.0)는 한국어 줄만 — 칸이 바뀌기 0.1~0.2초 앞에 말이 끝나게 놓았다(원본의 칸 앞 숨).
// 판별 글: 영어판(en)이 원본이고, 두 채널 판(간체 · 버마어)은 LAB 장부 머리말 「두 채널 판」대로 이 표에 칸을 더한다(한국어 줄은 그대로).
// v2(이해 시험 v1 — sonnet 3 · haiku 4, haiku 「지난 아니 편과 같아 보임」): 반전의 까닭을 말에(7 「내가 왜 사과해?」 · 8 「네가 부딪쳤잖아!」),
// 5칸은 「매일 두 잔씩!」을 더해 칸 안에서 한 번 더 바뀌게(두 시험관 다 「6.1~9.3초가 늘어진다」), 4칸에 사극 말투 꼬리.
// v3(이해 시험 v2 — haiku 이해 3 · 재미 3 · 「아니 편과 같아 보임」, 둘 다 「왜 쏟았는지 · 누가 부딪쳤는지 장면이 없다」): 무대를 카페에서
// 학교 복도로 바꾸고 커피를 뒤집어쓴 선생님을 왼쪽에 세웠다(판/v3칸N). 말풍선은 선생님 얼굴을 비켜 오른쪽, 5칸은 낱말씩.
export const FPS = 30;
export const TOTAL = 14.8;

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
};

export const CELLS: Cell[] = [
  { at: 0.0, img: 'k1.jpg', vo: 's1', voAt: 0.12, ko: '미안.', koSize: 124, level: 1, roman: 'mi-an' },
  { at: 1.0, img: 'k2.jpg', vo: 's2', voAt: 1.02, ko: '미안해요.', koSize: 116, level: 2, roman: 'mi-an-hae-yo' },
  { at: 2.3, img: 'k3.jpg', vo: 's3', voAt: 2.35, ko: '죄송합니다.', koSize: 112, level: 3, roman: 'joe-song-ham-ni-da' },
  { at: 4.4, img: 'k4.jpg', vo: 's4', voAt: 4.42, ko: '죽을죄를\n지었사옵니다.', koSize: 80 },
  {
    at: 6.1, img: 'k5.jpg', vo: 's5b', voAt: 6.12, ko: '앞으로 평생 커피는\n제가 사겠습니다,\n매일 두 잔씩!', koSize: 70, more: { at: 8.18 },
    // v3: v1 · v2 시험관 셋이 「6.1~9.3초가 늘어진다」 — 말 박자대로 낱말이 붙어 칸 안에서 계속 바뀐다(s5b.json 낱말 시각)
    words: [['앞으로', 0.02], ['평생', 0.34], ['커피는', 0.7], ['\n', 0], ['제가', 1.07], ['사겠습니다,', 1.29], ['\n', 0], ['매일', 2.08, true], ['두', 2.35, true], ['잔씩!', 2.48, true]],
  },
  { at: 9.3, img: 'k6.jpg', vo: 's6', voAt: 9.3, ko: '근데…', koSize: 112 },
  { at: 10.1, img: 'k7.jpg', vo: 's7b', voAt: 10.12, ko: '내가 왜\n사과해?', koSize: 100 },
  { at: 11.2, img: 'k8.jpg', vo: 's8b', voAt: 11.22, ko: '네가 부딪쳤잖아!', koSize: 92 },
  { at: 12.5, img: 'k9.jpg', vo: 's9', voAt: 12.55, ko: '커피값도 당연히\n네가 내야지.', koSize: 80 },
];

export type Loc = 'en' | 'zh' | 'my';

export type LocText = {
  font: string | null; // 뜻 줄 글꼴 줄 — null이면 Inter Tight
  levelWord: string; // 단계 표 앞말(LV)
  lines: { text: string; tag?: string; size: number; more?: string }[]; // 칸마다 뜻 줄 · 쓰는 자리 꼬리 · 둘째 걸음 뜻
};

export const LOCALES: Record<Loc, LocText> = {
  en: {
    font: null,
    levelWord: 'LV.',
    lines: [
      { text: 'Sorry.', tag: '👫 friends only', size: 60 },
      { text: 'I’m sorry.', tag: '🙂 polite', size: 60 },
      { text: 'I’m very sorry.', tag: '🙇 most polite · teachers ✓', size: 60 },
      { text: 'I have sinned,\nYour Majesty!', tag: '👑 K-drama palace talk', size: 54 },
      { text: 'I’ll buy your coffee\nfor the rest of my life,', size: 50, more: 'two cups a day!' },
      { text: 'Wait…', size: 60 },
      { text: 'Why am I the one\nsaying sorry?', size: 54 },
      { text: 'YOU bumped into ME!', size: 58 },
      { text: 'So YOU pay for the coffee.\nObviously.', size: 50 },
    ],
  },
  // 두 채널 판(샤오훙수 간체) — 번역이 아니라 중국어로 다시 쓴 뜻 줄. 4칸 사극 말투는 청나라 궁중극 「奴才罪该万死」로.
  zh: {
    font: "'Inter Tight', 'Microsoft YaHei', sans-serif",
    levelWord: 'LV.',
    lines: [
      { text: '抱歉啦。', tag: '👫 只对朋友', size: 60 },
      { text: '对不起。', tag: '🙂 有礼貌', size: 60 },
      { text: '非常抱歉。', tag: '🙇 最正式 · 对老师 ✓', size: 60 },
      { text: '奴才罪该万死！', tag: '👑 宫廷剧台词', size: 58 },
      { text: '以后您的咖啡，\n我包一辈子，', size: 54, more: '每天两杯！' },
      { text: '等等……', size: 60 },
      { text: '凭什么是我道歉？', size: 58 },
      { text: '明明是你撞的我！', size: 58 },
      { text: '所以咖啡钱，\n当然你来付。', size: 54 },
    ],
  },
  // 두 채널 판(틱톡 버마어) — 버마어로 다시 쓴 뜻 줄. 몽글은 성별이 없어 공손한 1인칭 대명사를 빼고 쓴다.
  my: {
    font: "'Inter Tight', 'Myanmar Text', sans-serif",
    levelWord: 'LV.',
    lines: [
      { text: 'ဆောရီး။', tag: '👫 သူငယ်ချင်းကိုပဲ', size: 50 },
      { text: 'တောင်းပန်ပါတယ်။', tag: '🙂 ယဉ်ကျေးစွာ', size: 50 },
      { text: 'အထူး တောင်းပန်ပါတယ်။', tag: '🙇 အယဉ်ကျေးဆုံး · ဆရာမကို ✓', size: 50 },
      { text: 'အရှင်မင်းကြီး…\nအပြစ်ကြီးလှပါပြီ!', tag: '👑 ကိုရီးယား နန်းတွင်းဇာတ်ကား စကား', size: 48 },
      { text: 'နောက်ဆို တစ်သက်လုံး\nကော်ဖီ ဝယ်တိုက်ပါ့မယ်၊', size: 44, more: 'နေ့တိုင်း နှစ်ခွက်စီ!' },
      { text: 'ခဏနေဦး…', size: 50 },
      { text: 'ဘာလို့ ငါက\nတောင်းပန်နေရတာလဲ?', size: 48 },
      { text: 'မင်းက ငါ့ကို\nဝင်တိုက်တာလေ!', size: 48 },
      { text: 'ဒီတော့ ကော်ဖီဖိုး\nမင်းပဲ ပေးရမယ်နော်!', size: 46 },
    ],
  },
};
