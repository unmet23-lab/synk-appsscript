// LAB 영어 E25 「잘하고 있어」 화면 글 정본 — 영어 · 간체 · 버마어를 같은 정본에서 렌더한다(판끼리 따로 고치지 않는다).
// 간체 · 버마어는 세 겹 검수(../../게시/검문/)를 거친 글만 둔다. 읽는 법 줄은 영어 로마자(두 나라 공통, LAB 장부 「두 채널 판」).
export type Lang = 'en' | 'cn' | 'mm';
export const ROMAN = { g: 'gwaen-cha-na', j: 'jal-ha-go i-sseo', ga: '가 = ga' };
export const FONT: Record<Lang, string> = {
  en: "'Inter Tight', 'SUIT', sans-serif",
  cn: "'Microsoft YaHei', 'Inter Tight', 'SUIT', sans-serif",
  mm: "'Inter Tight', 'SUIT', 'Myanmar Text', sans-serif",
};
export const TEXT: Record<Lang, { bad: string; coming: string; g: string; j: string; back: string; first: string; today: string; save: string; size: number }> = {
  en: {
    bad: 'Bad day learning Korean?',
    coming: 'Here is what you need to hear, in Korean.',
    g: "It's okay.",
    j: "You're doing well.",
    back: 'Now flip back to your first page.',
    first: "Day 1: you couldn't even write 가.",
    today: 'Today, even your mistakes are whole sentences.',
    save: 'Save this for your next bad day.',
    size: 60,
  },
  cn: {
    bad: '今天学韩语，又不顺？',
    coming: '现在的你，需要听这句韩语。',
    g: '没关系。',
    j: '你做得很好。',
    back: '翻回第一页看看。',
    first: '第一天：你连“가”都写不好。',
    today: '今天：写错的都已经是整句话了。',
    save: '收藏起来，下次难过时再看。',
    size: 58,
  },
  mm: {
    bad: 'ဒီနေ့ ကိုရီးယားစာ လေ့လာတာ အဆင်မပြေဘူးလား။',
    coming: 'အခု မင်း ကြားဖို့လိုတဲ့ စကားကို ကိုရီးယားလို ပြောပြမယ်။',
    g: 'ဘာမှမဖြစ်ပါဘူး။',
    j: 'မင်း ကောင်းကောင်း လုပ်နိုင်နေတာပဲ။',
    back: 'မင်း စာအုပ်ရဲ့ ပထမဆုံး စာမျက်နှာကို ပြန်ကြည့်လိုက်။',
    first: 'ပထမနေ့က 가 တောင် မရေးတတ်ခဲ့ဘူး။',
    today: 'ဒီနေ့တော့ မှားရင်တောင် ဝါကျအပြည့်အစုံ ရေးပြီးမှ မှားတဲ့အဆင့် ရောက်နေပြီ။',
    save: 'နောက်တစ်ခါ စိတ်ညစ်ရင် ကြည့်ဖို့ သိမ်းထားပါ။',
    size: 54,
  },
};
