// LAB 영어 E37 「very」 화면 글 정본(영어 판). 한국어 낱말은 구운 펠트 조각에 바느질로 박힌 글(장면과 한 장) + 한국어 목소리,
// 영어는 화면 글, 읽는 법은 조각 아래 작은 글.
export const FONT = "'Inter Tight', 'SUIT', sans-serif";
export const KO = "'SUIT', 'Inter Tight', sans-serif";
export const TEXT = {
  hook: '“Very” in Korean?',
  ask: 'Just one word… right?',
  more: 'Wait… even MORE words?!',
  line: 'Korean has a LOT of\nwords for “very.”',
  start: 'Easiest one to start with: 진짜',
  sayKo: '한국어… 진짜 어려워…',
  saySub: 'Korean is 진짜 (= really) hard…',
};
// 조각 그림(public/img/wNN.png — 소리/그림.py가 조각판에서 오림) · 읽는 법(로마자 표기)
// 이해 시험 v1 — 시험관 셋(s · h · G)이 「다 같은 뜻인지, 무엇이 다른지」를 짚어 네 낱말에 낱말 뜻 한마디(사전 뜻 — 쓰임 규칙은 출처끼리 엇갈려 넣지 않음)
export const WORDS: { img: string; ko: string; read: string; gloss?: string }[] = [
  { img: 'w01', ko: '아주', read: 'a-ju', gloss: 'very' },
  { img: 'w02', ko: '정말', read: 'jeong-mal', gloss: 'truly' },
  { img: 'w03', ko: '진짜', read: 'jin-jja', gloss: 'really' },
  { img: 'w04', ko: '완전', read: 'wan-jeon', gloss: 'totally' },
  { img: 'w05', ko: '매우', read: 'mae-u', gloss: 'very' },
  { img: 'w06', ko: '너무', read: 'neo-mu', gloss: 'so' },
  { img: 'w07', ko: '엄청', read: 'eom-cheong', gloss: 'super' },
  { img: 'w08', ko: '되게', read: 'doe-ge', gloss: 'really' },
  { img: 'w09', ko: '무척', read: 'mu-cheok', gloss: 'very much' },
  { img: 'w10', ko: '굉장히', read: 'goeng-jang-hi', gloss: 'extremely' },
  { img: 'w11', ko: '몹시', read: 'mop-si', gloss: 'awfully' },
  { img: 'w12', ko: '대단히', read: 'dae-dan-hi', gloss: 'greatly' },
];

// 두 채널 판(기획장부/LAB.md 머리말 「두 채널 판」 3번 — 소리가 한국어 낱말 · 음악 · 효과음뿐인 영어 편) — 영어 화면 글과 낱말 뜻만
// 그 나라 말로 다시 썼다(번역이 아니라 그 나라 학습자의 말로 — 「very」 자리는 중국어 「很」 · 버마어 「အရမ်း」). 조각의 한글 · 읽는 법(로마자)은 모든 판 그대로.
// 검수는 게시/검문/zhs.txt · my.txt(현지어 세 겹).
export type Loc = 'en' | 'zhs' | 'my';
export type LocText = { font: string; scale: number; hook: string; ask: string; more: string; line: string; start: string; sayPre: string; sayPost: string; gloss: string[] };
export const LOCS: Record<Loc, LocText> = {
  en: {
    font: FONT,
    scale: 1,
    hook: TEXT.hook,
    ask: TEXT.ask,
    more: TEXT.more,
    line: TEXT.line,
    start: TEXT.start,
    sayPre: 'Korean is ',
    sayPost: ' (= really) hard…',
    gloss: WORDS.map((w) => w.gloss || ''),
  },
  zhs: {
    font: "'Inter Tight', 'Microsoft YaHei', sans-serif",
    scale: 0.92,
    hook: '韩语的“很”怎么说？',
    ask: '应该就一个词吧……？',
    more: '等等……还有别的词？！',
    line: '韩语里的“很”\n说法多得要命',
    start: '刚开始学，先记 진짜 就好',
    sayPre: '韩语 ',
    sayPost: '（= 真的）好难……',
    gloss: ['很', '真', '真的', '完全、超', '非常', '太', '超级', '特别（口语）', '十分', '极其', '极度', '极为'],
  },
  my: {
    font: "'Inter Tight', 'Myanmar Text', sans-serif",
    scale: 0.78,
    hook: 'ကိုရီးယားလို "အရမ်း" ကို\nဘယ်လိုပြောလဲ?',
    ask: 'စကားလုံး တစ်လုံးတည်းပဲ ဖြစ်မှာပေါ့… ဟုတ်တယ်မလား?',
    more: 'ခဏ…\nစကားလုံးတွေ ထပ်ရှိသေးလား?!',
    line: 'ကိုရီးယားစာမှာ "အရမ်း" လို့\nပြောတဲ့ စကားလုံး အများကြီးပဲ',
    start: 'စလေ့လာရင် 진짜 ကနေ စလိုက်ပါ',
    sayPre: 'ကိုရီးယားစာ ',
    sayPost: ' (= တကယ်) ခက်တယ်…',
    gloss: ['အရမ်း', 'တကယ်ပဲ', 'တကယ်', 'လုံးဝ', 'အလွန်', 'သိပ်ကို', 'တအား', 'တော်တော်', 'အတော်ကို', 'အင်မတန်', 'အရမ်းကို', 'အလွန်အမင်း'],
  },
};
