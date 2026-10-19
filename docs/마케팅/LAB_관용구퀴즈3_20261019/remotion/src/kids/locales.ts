// 관용구 퀴즈 #3(10-19) 현지어판: 조회가 붙은 계정만(10-19 유호님 「조회수 있는 계정들은 … 그쪽에는 준비해서 올리자」) — 샤오훙수(간체 중국어)·틱톡 미얀마(버마어).
// 영어(en)·몽골어(mn)는 i18n.ts에 있다. 한국어(관용구·예문·해요체)는 모든 판에서 그대로 둔다. 화면 틀 글(ui)은 퀴즈 #2에서 검문을 마친 문장에 연재 번호만 #3으로 바꿨다.
// 칸 뜻은 영어판과 같다: parts = 글자 그대로 읽은 두 조각, guess = 글자 그대로 옮긴 오답 딱지, options = 짧은 보기 셋(정답 자리는 영어판과 같음),
// gloss = 예문 뜻, say = 해요체 읽는 법(두 언어 모두 영어판 로마자 그대로), recap = 끝 화면 복습.
// 문안 검토: 초안(Claude) → 제미나이 직역 역번역·문법 채점(tools/현지어대조.js) → Fable. 원어민 검수는 아직 없다.

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
  quiz: string; // 게임 판·끝 알약의 연재 이름(영어 IDIOM QUIZ #3)
  next: string;
  scoreNext: string;
  yourTurn: string;
};

export type LocQ = { parts: [string, string]; guess: string; options: [string, string, string]; gloss: string; say: string; recap: string };

export type Locale = { name: string; font: string; ui: LocUi; q: [LocQ, LocQ, LocQ] };

const BASE = "'Inter Tight', 'SUIT'";
const RR = ['mi-yeok-guk meo-geo-sseo-yo', 'si-geun juk meok-gi-ye-yo', 'gim-chit-guk ma-si-ji ma-yo'] as const;

// 문제 순서는 data.ts와 같다. 정답 보기 자리: 미역국을 먹다 = 둘째 · 식은 죽 먹기 = 첫째 · 김칫국부터 마시다 = 셋째.
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
      quiz: 'ဆိုရိုးစကား #3',
      next: 'နောက်တစ်ခု ▶',
      scoreNext: 'ရမှတ် ▶',
      yourTurn: 'မင်းအလှည့်',
    },
    q: [
      { parts: ['ပင်လယ်ရေညှိဟင်းချို', 'သောက်'], guess: 'ရေညှိဟင်းချို သောက်?', options: ['မွေးနေ့ရောက်တယ်', 'စာမေးပွဲကျတယ်', 'ကျန်းမာအောင်စားတယ်'], gloss: 'စာမေးပွဲ ထပ်ကျပြန်ပြီ။', say: RR[0], recap: 'စာမေးပွဲကျတယ်' },
      { parts: ['ဆန်ပြုတ်အေး', 'စားတာ'], guess: 'ဆန်ပြုတ်အေး စားတာ?', options: ['အရမ်းလွယ်တယ်', 'ပျင်းစရာကောင်းတယ်', 'အရသာမကောင်းဘူး'], gloss: 'ဒီမေးခွန်းက အရမ်းလွယ်တယ်။', say: RR[1], recap: 'အရမ်းလွယ်တယ်' },
      { parts: ['ကင်မ်ချီဟင်းချို', 'အရင်သောက်'], guess: 'ကင်မ်ချီဟင်းရည် အရင်သောက်?', options: ['ကင်မ်ချီကြိုက်တယ်', 'ရေငတ်တယ်', 'အစောကြီးပျော်နေတယ်'], gloss: 'မသေချာသေးဘူး။ အစောကြီး မပျော်နဲ့ဦး!', say: RR[2], recap: 'အစောကြီးပျော်တယ်' },
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
      quiz: '惯用语挑战 #3',
      next: '下一题 ▶',
      scoreNext: '分数 ▶',
      yourTurn: '轮到你啦',
    },
    q: [
      { parts: ['海带汤', '喝'], guess: '喝海带汤？', options: ['过生日', '考砸了', '吃得健康'], gloss: '我考试又考砸了。', say: RR[0], recap: '考砸了' },
      { parts: ['凉粥', '吃'], guess: '吃凉粥？', options: ['小菜一碟', '很无聊', '很难吃'], gloss: '这道题简直是小菜一碟。', say: RR[1], recap: '小菜一碟' },
      { parts: ['泡菜汤', '先喝'], guess: '先喝泡菜汤？', options: ['爱吃泡菜', '口渴了', '高兴得太早'], gloss: '结果还没出来，别高兴得太早！', say: RR[2], recap: '高兴得太早' },
    ],
  },
};

/** 채널 → 판. 현지어판은 몽골어판처럼 한국어로만 말하는 나레이션(v5b_mn)을 쓴다. */
export type Channel = { id: string; cc: string; lang: 'en' | LocCode; handle: string };
export const CHANNELS: Channel[] = [
  { id: 'lab-mm-tiktok', cc: 'mmtt', lang: 'my', handle: '@synklab.mm' },
  { id: 'lab-cn-xiaohongshu', cc: 'cn', lang: 'zhs', handle: 'SYNK LAB' },
];
