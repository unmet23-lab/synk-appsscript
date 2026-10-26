// 관용구 퀴즈 #6(10-26, 퀴즈 #5 틀) 현지어판: 조회가 붙은 계정만(제작 방식 v2 §4-3 「조회가 붙은 계정은 판정을 기다리지 않는다」) — 샤오훙수(간체 중국어)·틱톡 미얀마(버마어).
// 영어(en)·몽골어(mn)는 i18n.ts에 있다. 한국어(관용구·예문·해요체)는 모든 판에서 그대로 둔다. 화면 틀 글(ui)은 퀴즈 #2~#4에서 검문을 마친 문장에 연재 번호만 #5로 바꿨다.
// 칸 뜻은 영어판과 같다: parts = 글자 그대로 읽은 두 조각, guess = 글자 그대로 옮긴 오답 딱지, options = 짧은 보기 셋(정답 자리는 영어판과 같음),
// gloss = 예문 뜻, say = 해요체 읽는 법(두 언어 모두 영어판 로마자 그대로), recap = 끝 화면 복습.
// 뜻 풀이는 그 나라 말로 다시 쓴다. 「해가 서쪽에서 뜨다」는 중국어 「太阳从西边出来了」와 같은 말이라 간체판 예문에 그 말을 그대로 쓴다 — 게시글 💡 줄의 「너희 말에도 있지?」(퀴즈 #5 우물 안 개구리처럼).
// 그래서 간체판 셋째 오답 딱지만 글자 그대로 옮기지 않는다(그대로 옮기면 중국 사람에겐 정답 뜻이라 NOPE 도장과 부딪힌다).
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
  quiz: string; // 게임 판·끝 알약의 연재 이름(영어 IDIOM QUIZ #6)
  next: string;
  scoreNext: string;
  yourTurn: string;
};

export type LocQ = { parts: [string, string]; guess: string; options: [string, string, string]; gloss: string; say: string; recap: string };

export type Locale = { name: string; font: string; ui: LocUi; q: [LocQ, LocQ, LocQ] };

const BASE = "'Inter Tight', 'SUIT'";
const RR = ['ba-ram-ma-ja-sseo-yo', 'ha-neu-re byeol tta-gi-ye-yo', 'hae-ga seo-jjo-ge-seo tteu-ge-sseo-yo'] as const;

// 문제 순서는 data.ts와 같다(바람 · 별 · 해). 정답 보기 자리: 바람맞다 = 둘째 · 하늘의 별 따기 = 둘째 · 해가 서쪽에서 뜨다 = 셋째.
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
      quiz: 'ဆိုရိုးစကား #6',
      next: 'နောက်တစ်ခု ▶',
      scoreNext: 'ရမှတ် ▶',
      yourTurn: 'မင်းအလှည့်',
    },
    q: [
      // 10-26 Opus 직역 역번역 반영: 조각 둘이 딱지와 글자 그대로 맞게(တိုက်ခံရ) · 「하늘 위의 별」(ပေါ်က — က만 쓰면 주어 표지로도 읽힘) · 둘째 문제 보기를 셋 다 「~ 아주 ~」 꼴로(정답만 튀지 않게, ညကြိုက်는 낯선 조어) ·
      //   셋째 정답은 「있을 수 없는 일이 일어남」(ဘယ်တော့မှ မဖြစ်တာ는 「절대 안 되는 것(금지)」로도 읽힘) · 예문은 평서형 + ?가 아니라 의문형(…နေတာလား?), 말하는 형 곰이 남자라 ညီလေး(남동생) 그대로.
      //   셋째 딱지는 버마어에도 같은 굳은 말일 수 있어(50~60%) 간체 · 몽골어판처럼 엉뚱한 글자 해석 「지구가 거꾸로 도나?」로.
      { parts: ['လေ', 'တိုက်ခံရ'], guess: 'လေတိုက်ခံရ?', options: ['အအေးမိ', 'ချိန်းပြီး မလာ', 'ဆံပင်ရှုပ်'], gloss: 'နှစ်နာရီ စောင့်ခဲ့တာ သူ မလာဘူး!', say: RR[0], recap: 'ချိန်းပြီး မလာ' },
      { parts: ['ကောင်းကင်ပေါ်က ကြယ်', 'ခူး'], guess: 'ကြယ်ခူး?', options: ['ညကို အရမ်းကြိုက်', 'ရဖို့ အရမ်းခက်', 'အရပ် အရမ်းရှည်'], gloss: 'ကွန်ဆတ်လက်မှတ် ဝယ်ရတာ\nအရမ်းခက်တယ်!', say: RR[1], recap: 'ရဖို့ အရမ်းခက်' },
      { parts: ['နေ အနောက်ဘက်က', 'ထွက်'], guess: 'ကမ္ဘာကြီး နောက်ပြန်လည်?', options: ['အိပ်ရာထ နောက်ကျ', 'ရာသီဥတု ဆိုး', 'မဖြစ်နိုင်တာ ဖြစ်လာ'], gloss: 'ညီလေး ပန်းကန်ဆေးနေတာလား?\nမယုံနိုင်ဘူး!', say: RR[2], recap: 'မဖြစ်နိုင်တာ ဖြစ်လာ' },
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
      quiz: '惯用语挑战 #6',
      next: '下一题 ▶',
      scoreNext: '分数 ▶',
      yourTurn: '轮到你啦',
    },
    q: [
      { parts: ['风', '挨打'], guess: '被风打了？', options: ['感冒了', '被放鸽子', '头发乱了'], gloss: '等了两个小时，\n对方根本没来！', say: RR[0], recap: '被放鸽子' },
      // 10-26 Opus 직역 역번역 반영: 둘째 문제 보기를 모두 4자로(超级难得到는 혼자 5자 + 강조어라 정답이 튀고 번역투, 喜欢晚上은 밋밋함) · 복습도 정답 보기와 같은 글 ·
      //   셋째 딱지 「太阳从西边升起？」는 중국어 「太阳从西边出来了」와 같은 말이라 중국 사람은 정답 뜻으로 읽는다(확신 95%) — 글자 그대로의 엉뚱한 해석 「地球倒着转？」(지구가 거꾸로 도나?)로.
      { parts: ['天上的星星', '摘'], guess: '摘星星？', options: ['喜欢熬夜', '很难到手', '个子很高'], gloss: '抢演唱会门票，\n简直难如登天！', say: RR[1], recap: '很难到手' },
      { parts: ['太阳从西边', '升起'], guess: '地球倒着转？', options: ['睡过头了', '天气不好', '太稀奇了'], gloss: '弟弟居然洗碗了？\n太阳从西边出来了！', say: RR[2], recap: '太稀奇了' },
    ],
  },
};

/** 채널 → 판. 현지어판은 몽골어판처럼 한국어로만 말하는 나레이션(q6ko)을 쓰고, 문제 순서는 모든 판이 같다(바람 → 별 → 해). */
export type Channel = { id: string; cc: string; lang: 'en' | LocCode; handle: string; hook: string }; // hook: 첫 문제 0초 문구(글자 그대로의 뜻이 아니다)
export const CHANNELS: Channel[] = [
  { id: 'lab-mm-tiktok', cc: 'mmtt', lang: 'my', handle: '@synklab.mm', hook: 'တိုက်ရိုက်အဓိပ္ပာယ် မဟုတ်ဘူး!' },
  { id: 'lab-cn-xiaohongshu', cc: 'cn', lang: 'zhs', handle: 'SYNK LAB', hook: '不是字面意思！' },
];
