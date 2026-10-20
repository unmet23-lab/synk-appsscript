// 관용구 퀴즈 #4(10-20) 현지어판: 조회가 붙은 계정만(제작 방식 v2 §4-3 「조회가 붙은 계정은 판정을 기다리지 않는다」) — 샤오훙수(간체 중국어)·틱톡 미얀마(버마어).
// 영어(en)·몽골어(mn)는 i18n.ts에 있다. 한국어(관용구·예문·해요체)는 모든 판에서 그대로 둔다. 화면 틀 글(ui)은 퀴즈 #2·#3에서 검문을 마친 문장에 연재 번호만 #4로 바꿨다.
// 칸 뜻은 영어판과 같다: parts = 글자 그대로 읽은 두 조각, guess = 글자 그대로 옮긴 오답 딱지, options = 짧은 보기 셋(정답 자리는 영어판과 같음),
// gloss = 예문 뜻, say = 해요체 읽는 법(두 언어 모두 영어판 로마자 그대로), recap = 끝 화면 복습.
// 뜻 풀이는 그 나라 말로 다시 쓴다: 중국어는 용기를 쓸개(胆)로 말하므로 「胆子大」·「吓了一大跳」, 버마어는 「သတ္တိရှိ」(용기 있다)·「လန့်」(놀라다).
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
  quiz: string; // 게임 판·끝 알약의 연재 이름(영어 IDIOM QUIZ #4)
  next: string;
  scoreNext: string;
  yourTurn: string;
};

export type LocQ = { parts: [string, string]; guess: string; options: [string, string, string]; gloss: string; say: string; recap: string };

export type Locale = { name: string; font: string; ui: LocUi; q: [LocQ, LocQ, LocQ] };

const BASE = "'Inter Tight', 'SUIT'";
const RR = ['ga-ni kong-al-man hae-jyeo-sseo-yo', 'gan tteo-reo-jil ppeon-hae-sseo-yo', 'ga-ni keu-ne-yo'] as const;

// 문제 순서는 data.ts와 같다(콩알 · 떨어지다 · 크다). 정답 보기 자리: 간이 콩알만 해지다 = 둘째 · 간 떨어지다 = 셋째 · 간이 크다 = 첫째.
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
      quiz: 'ဆိုရိုးစကား #4',
      next: 'နောက်တစ်ခု ▶',
      scoreNext: 'ရမှတ် ▶',
      yourTurn: 'မင်းအလှည့်',
    },
    q: [
      { parts: ['အသည်း', 'ပဲစေ့လောက်'], guess: 'အသည်း ပဲစေ့လောက် ကျုံ့?', options: ['နေမကောင်းဘူး', 'အရမ်းကြောက်တယ်', 'ပဲကြိုက်တယ်'], gloss: 'အဖွားရဲ့ ပန်းအိုးကို ခွဲမိသွားတယ်။ အရမ်းကြောက်တယ်!', say: RR[0], recap: 'သိပ်ကြောက်တယ်' }, // 끝 화면 복습 폭 240px 안(「အရမ်း…」은 두 줄로 꺾여 점수 카드에 닿음, 10-20 Fable)
      { parts: ['အသည်း', 'ပြုတ်ကျ'], guess: 'အသည်း ပြုတ်ကျ?', options: ['အိပ်ပျော်သွားတယ်', 'အစားအစာ ပြုတ်ကျတယ်', 'အရမ်းလန့်သွားတယ်'], gloss: 'မိုးချုန်းသံကြောင့် လန့်သွားလိုက်တာ!', say: RR[1], recap: 'အရမ်းလန့်တယ်' },
      { parts: ['အသည်း', 'ကြီး'], guess: 'အသည်းကြီး?', options: ['သတ္တိရှိတယ်', 'အရပ်ရှည်တယ်', 'အစားကြီးတယ်'], gloss: 'သရဲကား တစ်ယောက်တည်း ကြည့်တာလား? သတ္တိရှိလိုက်တာ!', say: RR[2], recap: 'သတ္တိရှိတယ်' },
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
      quiz: '惯用语挑战 #4',
      next: '下一题 ▶',
      scoreNext: '分数 ▶',
      yourTurn: '轮到你啦',
    },
    q: [
      { parts: ['肝', '缩成豆粒'], guess: '肝缩成豆粒？', options: ['身体不舒服', '吓坏了', '爱吃豆子'], gloss: '打碎了奶奶的花瓶，吓死我了！', say: RR[0], recap: '吓坏了' },
      { parts: ['肝', '掉下来'], guess: '肝掉下来？', options: ['睡着了', '食物掉了', '吓了一大跳'], gloss: '打雷声吓得我心都快跳出来了！', say: RR[1], recap: '吓了一大跳' },
      { parts: ['肝', '大'], guess: '肝很大？', options: ['胆子大', '个子很高', '饭量大'], gloss: '你一个人看恐怖片？胆子真大！', say: RR[2], recap: '胆子大' },
    ],
  },
};

/** 채널 → 판. 현지어판은 몽골어판처럼 한국어로만 말하는 나레이션(q4ko)을 쓰고, 문제 순서도 몽골어판과 같다(떨어지다 → 콩알 → 크다). */
export type Channel = { id: string; cc: string; lang: 'en' | LocCode; handle: string };
export const CHANNELS: Channel[] = [
  { id: 'lab-mm-tiktok', cc: 'mmtt', lang: 'my', handle: '@synklab.mm' },
  { id: 'lab-cn-xiaohongshu', cc: 'cn', lang: 'zhs', handle: 'SYNK LAB' },
];
