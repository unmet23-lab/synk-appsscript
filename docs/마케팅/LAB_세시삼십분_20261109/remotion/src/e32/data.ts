// LAB 영어 E32 「세 시 삼십 분」 화면 글 정본 — 영어 · 간체 · 버마어를 같은 정본에서 렌더한다(판끼리 따로 고치지 않는다).
// 간체 · 버마어는 세 겹 검수(../../../게시/검문/)를 거친 글만 둔다. 읽는 법 줄은 영어 로마자(두 나라 공통, LAB 장부 「두 채널 판」).
// 11-09 v16: 시험관 셋이 판마다 같이 짚은 「서른 분」을 뺐다 — 몽글은 「세…? 삼…?」(같은 3인데 말이 둘)로 헷갈리고, 그 물음이 곧 바늘 다툼의 까닭이다.
export type Lang = 'en' | 'cn' | 'mm';
const NL = String.fromCharCode(10);
export const ROMAN = {
  read: 'sam si sam-sip bun…?',
  try2: 'se(3)…? sam(3)…?',
  right: 'se si sam-sip bun!',
  small: 'yeol(10) si… sip-o(15) bun…?',
  ten: 'yeol si sip-o bun!',
};
export const FONT: Record<Lang, string> = {
  en: "'Inter Tight', 'SUIT', sans-serif",
  cn: "'Microsoft YaHei', 'Inter Tight', 'SUIT', sans-serif",
  mm: "'Inter Tight', 'SUIT', 'Myanmar Text', sans-serif",
};
type Pack = {
  hook: string; // 0초 머리 글
  seGloss: string; // 세 시 = 3 o'clock
  samsipGloss: string; // 삼십 분 = 30 minutes
  who: string; // 누가 맞아?
  bothTrue: string; // 둘 다 맞다 — 한국어엔 숫자가 두 벌
  hours: string; // 시는 이렇게 센다
  minutes: string; // 분은 이렇게 센다
  now: string; // 이번엔 10:15
  whoNow: string; // 이제 시계가 겁먹었다
  endH: string; // 끝 — 시
  endM: string; // 끝 — 분
  size: number;
  subSize: number;
};
export const TEXT: Record<Lang, Pack> = {
  en: {
    hook: `This clock yells at you${NL}if you read it wrong`,
    seGloss: 'se(3) si = 3 o’clock',
    samsipGloss: 'sam-sip(30) bun = 30 min',
    who: 'Wait… who’s right?',
    bothTrue: `3 = 세 and 삼!${NL}Korean has 2 sets of numbers`,
    hours: 'Hours count',
    minutes: 'Minutes count',
    now: 'Now try 10:15',
    whoNow: 'Now the clock is scared',
    endH: 'Hours',
    endM: 'Minutes',
    size: 64,
    subSize: 44,
  },
  cn: {
    hook: `读错时间的话${NL}这个钟会冲你吼`,
    seGloss: 'se(3) si = 3点',
    samsipGloss: 'sam-sip(30) bun = 30分',
    who: '等等…谁说得对？',
    bothTrue: `3 既是 세，也是 삼！${NL}韩语有两套数字`,
    hours: '“点”这样数',
    minutes: '“分”这样数',
    now: '现在读读 10:15',
    whoNow: '现在轮到钟害怕了',
    endH: '点',
    endM: '分',
    size: 60,
    subSize: 42,
  },
  mm: {
    hook: `အချိန် မှားဖတ်ရင်${NL}ဒီနာရီက အော်ဟောက်တယ်`,
    seGloss: 'se(3) si = ၃ နာရီ',
    samsipGloss: 'sam-sip(30) bun = မိနစ် ၃၀',
    who: 'နေဦး… ဘယ်ဟာ မှန်တာလဲ?',
    bothTrue: `၃ ကို 세 လို့လည်း ခေါ်တယ်၊ 삼 လို့လည်း ခေါ်တယ်!${NL}ကိုရီးယားစကားမှာ ဂဏန်း ၂ မျိုး ရှိတယ်`,
    hours: 'နာရီကို ဒီလို ရေတွက်တယ်',
    minutes: 'မိနစ်ကို ဒီလို ရေတွက်တယ်',
    now: 'အခု 10:15 ကို ဖတ်ကြည့်',
    whoNow: 'အခု နာရီက ကြောက်နေပြီ',
    endH: 'နာရီ',
    endM: 'မိနစ်',
    size: 50,
    subSize: 36,
  },
};
