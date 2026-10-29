// LAB 몽골 M11 「친구에겐 '미안', 교수님 · 사장님께는 '죄송합니다'」 — E9와 같은 오마주 뼈대(doci Ia6gYNDm-7o 9칸 · 박자 1.0 2.3 4.4
// 6.1 9.3 10.1 11.2 12.5 · 14.7초). 무대는 E9 카페에 팔짱 낀 사장님(E3 바리스타)을 세운 판 — 몽글은 사장님께 커피를 쏟은 아르바이트생이다.
// 몽골어 먼저: 1~3칸은 같은 「사과」가 누구에게 하느냐로 갈리는 것을 꼬리로 보이고, 반전(8칸)은 사장님께 반말(몽골어 «чи»).
// 화면은 LAB 몽골 꼴 — 한글 · 키릴 읽기 · 몽골 뜻 세 줄(읽기는 배울 세 낱말만). 몽골어는 세 겹 검수(몽골어대조 4차 + 바뀐 줄 · Opus 역번역 · Fable
// 「고쳐서 올림」 — 검문/) — 1 · 3 · 5칸 뜻은 Сорри(속어) → Уучлаарай(표준) → Хүлцэл өчье(격식), 13 · 14칸 «чи» · 맨 명령형은 일부러 쓴 무례. E9 이해 시험(v1 · v2)에서 고친 것을 같이 옮겼다:
// 몽글의 흰 말풍선(화자) · 반전의 까닭(「사장님이 부딪쳤잖아!」) · 5칸 낱말씩 + 「주말에도!」. 말풍선은 사장님 얼굴을 비켜 오른쪽.
export const FPS = 30;
export const TOTAL = 14.8;

export type Cell = {
  at: number;
  img: string;
  vo: string;
  voAt: number;
  ko: string;
  koSize: number;
  level?: number;
  read?: string; // 키릴 읽기(배울 세 낱말만)
  mn: string;
  mnSize: number;
  tag?: string; // 누구에게 쓰는 말인가
  more?: { at: number; mn: string }; // 칸 안에서 뜻 줄이 한 번 더 붙는 때와 말(5칸)
  words?: [string, number, boolean?][]; // 목소리에 맞춰 낱말씩 나오는 한국어 줄 — [낱말, 목소리 안 초, 강조] · '\n'은 줄바꿈
};

export const CELLS: Cell[] = [
  { at: 0.0, img: 'k1.jpg', vo: 's1', voAt: 0.12, ko: '미안.', koSize: 116, level: 1, read: 'миан', mn: 'Сорри.', mnSize: 56, tag: '👫 зөвхөн найздаа' },
  { at: 1.0, img: 'k2.jpg', vo: 's2', voAt: 1.02, ko: '미안해요.', koSize: 104, level: 2, read: 'мианхэё', mn: 'Уучлаарай.', mnSize: 56, tag: '🙂 эелдэг' },
  { at: 2.3, img: 'k3.jpg', vo: 's3', voAt: 2.35, ko: '죄송합니다.', koSize: 96, level: 3, read: 'жвэсонхамнида', mn: 'Хүлцэл өчье.', mnSize: 56, tag: '🙇 багш, даргадаа ✓' },
  { at: 4.4, img: 'k4.jpg', vo: 's4', voAt: 4.42, ko: '죽을죄를\n지었사옵니다.', koSize: 76, mn: 'Өршөөн соёрхоно уу,\nэзэн хаан минь!', mnSize: 50, tag: '👑 Солонгос түүхэн кинонд гардаг үг' },
  {
    at: 6.1, img: 'k5.jpg', vo: 'm5b', voAt: 6.12, ko: '앞으로 평생\n공짜로 일하겠습니다,\n주말에도!', koSize: 58, mn: 'Насан туршдаа\nцалингүй ажиллая,', mnSize: 48,
    more: { at: 8.27, mn: 'амралтын өдөр ч гэсэн!' },
    words: [['앞으로', 0.02], ['평생', 0.42], ['\n', 0], ['공짜로', 0.86], ['일하겠습니다,', 1.28], ['\n', 0], ['주말에도!', 2.17, true]],
  },
  { at: 9.3, img: 'k6.jpg', vo: 's6', voAt: 9.3, ko: '근데…', koSize: 104, mn: 'Гэхдээ…', mnSize: 54 },
  { at: 10.1, img: 'k7.jpg', vo: 's7b', voAt: 10.12, ko: '내가 왜\n사과해?', koSize: 96, mn: 'Би яагаад\nуучлалт гуйх ёстой юм?', mnSize: 48 },
  { at: 11.2, img: 'k8.jpg', vo: 'm8b', voAt: 11.2, ko: '사장님이\n부딪쳤잖아!', koSize: 84, mn: 'Дарга аа, чи л\nмөргөчихсөн шүү дээ!', mnSize: 48 },
  { at: 12.5, img: 'k9.jpg', vo: 'm9', voAt: 12.55, ko: '시급도 당연히\n올려 줘야지.', koSize: 76, mn: 'Тэгээд мэдээж цагийн\nхөлсийг минь нэм.', mnSize: 46 },
];

// 두 채널 판(샤오훙수 간체 · 틱톡 버마어) — LAB 장부 머리말 「두 채널 판」 2번(그날 만든 몽골 화면 글 편)으로 M11을 옮긴다. 그림 · 한국어 목소리 · 한국어 줄은
// 그대로, 읽는 법은 로마자(배울 세 낱말만), 뜻 줄은 번역이 아니라 그 나라 말로 다시 썼다(사장님 · 아르바이트 줄거리 그대로). 검수는 게시/검문/.
export type Loc = 'mn' | 'zh' | 'my';
// v2(이해 시험 v1 — 두 시험관 다 「늘어나는 인형이 무엇인지 모르겠다」, haiku 「LV가 레벨인지 단계인지」 · 「한국어 → 키릴 → 몽골어 3단이 지난 편과 같은 짜임」):
// 맨 위에 「숙일수록 공손」 한 줄, 단계 표는 그 나라 말로, 말풍선은 그 나라 뜻 → 한국어 → 읽는 법 순서(몽골어 먼저).
export const HEAD: Record<Loc, string> = { mn: 'Бөхийх тусам эелдэг 🙇', zh: '鞠躬越深，越有礼貌 🙇', my: 'ခေါင်းငုံ့လေ ယဉ်ကျေးလေ 🙇' };
export const LEVEL: Record<Loc, (n: number) => string> = { mn: (n) => `Түвшин ${n}`, zh: (n) => `第${n}级`, my: (n) => `အဆင့် ${n}` };
export const ROMAN = ['mi-an', 'mi-an-hae-yo', 'joe-song-ham-ni-da'];
export type PortLine = { text: string; size: number; tag?: string; more?: string };
export const PORTS: Record<'zh' | 'my', { font: string; lines: PortLine[] }> = {
  zh: {
    font: "'Inter Tight', 'Microsoft YaHei', sans-serif",
    lines: [
      { text: '抱歉啦。', size: 58, tag: '👫 只对朋友' },
      { text: '对不起。', size: 58, tag: '🙂 有礼貌' },
      { text: '非常抱歉。', size: 58, tag: '🙇 对老师、老板 ✓' },
      { text: '奴才罪该万死！', size: 56, tag: '👑 宫廷剧台词' },
      { text: '以后我一辈子\n免费给您打工，', size: 52, more: '周末也干！' },
      { text: '等等……', size: 58 },
      { text: '凭什么是我道歉？', size: 54 },
      { text: '老板，\n明明是你撞的我！', size: 54 },
      { text: '还有，我的时薪\n你当然得涨！', size: 52 },
    ],
  },
  my: {
    font: "'Inter Tight', 'Myanmar Text', sans-serif",
    lines: [
      { text: 'ဆောရီး။', size: 50, tag: '👫 သူငယ်ချင်းကိုပဲ' },
      { text: 'တောင်းပန်ပါတယ်။', size: 50, tag: '🙂 ယဉ်ကျေးစွာ' },
      { text: 'အထူး တောင်းပန်ပါတယ်။', size: 48, tag: '🙇 ဆရာ၊ သူဌေးကို ✓' },
      { text: 'အရှင်မင်းကြီး…\nအပြစ်ကြီးလှပါပြီ!', size: 46, tag: '👑 ကိုရီးယား နန်းတွင်းဇာတ်ကား စကား' },
      { text: 'နောက်ဆို တစ်သက်လုံး\nလခမယူဘဲ လုပ်ပေးပါ့မယ်၊', size: 42, more: 'စနေ တနင်္ဂနွေလည်း!' },
      { text: 'ခဏနေဦး…', size: 50 },
      { text: 'ဘာလို့ ငါက\nတောင်းပန်နေရတာလဲ?', size: 46 },
      { text: 'သူဌေး၊ မင်းက ငါ့ကို\nဝင်တိုက်တာလေ!', size: 46 },
      { text: 'ပြီးတော့ ငါ့ နာရီလုပ်ခလည်း\nတိုးပေးရမယ်နော်!', size: 42 },
    ],
  },
};
