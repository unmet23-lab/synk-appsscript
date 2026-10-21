// 관용구 퀴즈 #5(10-21) 현지어판: 조회가 붙은 계정만(제작 방식 v2 §4-3 「조회가 붙은 계정은 판정을 기다리지 않는다」) — 샤오훙수(간체 중국어)·틱톡 미얀마(버마어).
// 영어(en)·몽골어(mn)는 i18n.ts에 있다. 한국어(관용구·예문·해요체)는 모든 판에서 그대로 둔다. 화면 틀 글(ui)은 퀴즈 #2~#4에서 검문을 마친 문장에 연재 번호만 #5로 바꿨다.
// 칸 뜻은 영어판과 같다: parts = 글자 그대로 읽은 두 조각, guess = 글자 그대로 옮긴 오답 딱지, options = 짧은 보기 셋(정답 자리는 영어판과 같음),
// gloss = 예문 뜻, say = 해요체 읽는 법(두 언어 모두 영어판 로마자 그대로), recap = 끝 화면 복습.
// 뜻 풀이는 그 나라 말로 다시 쓴다. 「우물 안 개구리」는 중국어(井底之蛙)·버마어(ရေတွင်းထဲက ဖား)에 같은 비유가 있어 예문에 그 말을 그대로 쓴다 — 게시글 💡 줄의 「너희 말에도 있지?」.
// 문안 검토: 초안(Claude) → 제미나이 직역 역번역·문법 채점(tools/현지어대조.js) → Opus 뜻 대조 → Fable. 원어민 검수는 하지 않는다(10-19 유호님).

export type LocCode = 'my' | 'zhs';

export type LocUi = {
  guess3: string;
  nope: string;
  question: string;
  sayIt: string;
  clearHud: string;
  level: string; // {n} 자리에 문제 번호
  finish: string;
  stageClear: string;
  howMany: string;
  comment: string;
  commentSize?: number;
  gotThis: string;
  quiz: string; // 게임 판·끝 알약의 연재 이름(영어 IDIOM QUIZ #5)
  next: string;
  scoreNext: string;
  yourTurn: string;
};

export type LocQ = { parts: [string, string]; guess: string; options: [string, string, string]; gloss: string; say: string; recap: string };

export type Locale = { name: string; font: string; ui: LocUi; q: [LocQ, LocQ, LocQ] };

const BASE = "'Inter Tight', 'SUIT'";
const RR = ['pa-ri-man nal-lyeo-yo', 'u-mul an gae-gu-ri-yeo-sseo-yo', 'go-yang-i se-su-man hae-sseo-yo'] as const;

// 문제 순서는 data.ts와 같다(파리 · 개구리 · 고양이). 정답 보기 자리: 파리 날리다 = 둘째 · 우물 안 개구리 = 셋째 · 고양이 세수하듯 = 첫째.
export const LOCALES: Record<LocCode, Locale> = {
  my: {
    name: 'မြန်မာ',
    font: `${BASE}, 'Myanmar Text', sans-serif`,
    ui: {
      guess3: '၃ စက္ကန့်အတွင်း ဖြေပါ!',
      nope: 'မှားတယ်!',
      question: 'တကယ့်အဓိပ္ပာယ်က ဘာလဲ?',
      sayIt: 'လိုက်ပြောပါ',
      clearHud: 'ပြီးပြီ!',
      level: 'အဆင့် {n}!',
      finish: 'ပြီးပါပြီ!',
      stageClear: 'အောင်ပြီ!',
      howMany: 'ဘယ်နှစ်ခု မှန်လဲ?',
      comment: 'ရမှတ်ကို ကွန်မန့်မှာ ရေးပါ ↓',
      commentSize: 48,
      gotThis: 'နောက်တစ်ချီမှာ တွေ့မယ်!',
      quiz: 'ဆိုရိုးစကား #5',
      next: 'နောက်တစ်ခု ▶',
      scoreNext: 'ရမှတ် ▶',
      yourTurn: 'မင်းအလှည့်',
    },
    q: [
      { parts: ['ယင်ကောင်', 'လွှတ်'], guess: 'ယင်ကောင် လွှတ်?', options: ['ပိုးကောင်ဖမ်း', 'ဝယ်သူမရှိ', 'အခန်းညစ်ပတ်'], gloss: 'မိုးရွာလို့ ဆိုင်မှာ ဝယ်⁠သူ တစ်ယောက်မှ မရှိဘူး!' /* ဝယ်/သူ가 줄 끝에서 갈려 단어 결합자 U+2060(10-21 Fable P2) */, say: RR[0], recap: 'ဝယ်သူမရှိ' },
      { parts: ['ရေတွင်းထဲက', 'ဖား'], guess: 'ရေတွင်းထဲက ဖား?', options: ['ရေကူးတော်', 'မိုးကြိုက်', 'အမြင်ကျဉ်း'] /* ကောင်း은 「~하기 좋다」로 읽혀 တော်(잘한다)로 — Opus 역번역 */, gloss: 'ခရီးထွက်ကြည့်မှ ကိုယ်က ရေတွင်းထဲက ဖားပါလား!', say: RR[1], recap: 'အမြင်ကျဉ်း' },
      { parts: ['ကြောင်', 'မျက်နှာသစ်သလို'], guess: 'ကြောင်လို မျက်နှာသစ်?', options: ['ရေပဲ ပက်', 'ရေကြောက်', 'ငါးကြိုက်'], gloss: 'အိပ်ရာထ နောက်ကျလို့ မျက်နှာကို ရေပဲ ပက်လိုက်တယ်!', say: RR[2], recap: 'ရေပဲ ပက်' },
    ],
  },
  zhs: {
    name: '简体中文 (小红书)',
    font: `${BASE}, 'Microsoft YaHei', sans-serif`,
    ui: {
      guess3: '3秒猜猜看！',
      nope: '不对！',
      question: '真正的意思是？',
      sayIt: '跟着说',
      clearHud: '过关！',
      level: '第{n}关！',
      finish: '完成！',
      stageClear: '全部过关！',
      howMany: '你答对了几题？',
      comment: '评论区告诉我分数 ↓',
      gotThis: '下一关见！',
      quiz: '惯用语挑战 #5',
      next: '下一题 ▶',
      scoreNext: '分数 ▶',
      yourTurn: '轮到你啦',
    },
    q: [
      { parts: ['苍蝇', '放飞'], guess: '放飞苍蝇？', options: ['抓虫子', '没有客人', '房间很脏'], gloss: '下雨了，店里一个客人都没有！', say: RR[0], recap: '没有客人' },
      { parts: ['井里', '青蛙'], guess: '井里的青蛙？', options: ['很会游泳', '喜欢下雨', '见识太少'], gloss: '出去旅行才发现，原来我就是井底之蛙！', say: RR[1], recap: '见识太少' },
      { parts: ['猫', '洗脸似的'], guess: '像猫一样洗脸？', options: ['随便洗一下', '怕水', '爱吃鱼'], gloss: '睡过头了，只用水抹了一把脸！', say: RR[2], recap: '随便洗一下' },
    ],
  },
};

/** 채널 → 판. 현지어판은 몽골어판처럼 한국어로만 말하는 나레이션(q5ko)을 쓰고, 문제 순서도 몽골어판과 같다(파리 → 고양이 → 개구리). */
export type Channel = { id: string; cc: string; lang: 'en' | LocCode; handle: string };
export const CHANNELS: Channel[] = [
  { id: 'lab-mm-tiktok', cc: 'mmtt', lang: 'my', handle: '@synklab.mm' },
  { id: 'lab-cn-xiaohongshu', cc: 'cn', lang: 'zhs', handle: 'SYNK LAB' },
];
