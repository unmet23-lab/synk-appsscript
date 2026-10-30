// LAB 영어 E17 「잠도 와요」 화면 글 정본. 장면 그림은 판/*.png(GPT 이미지 2.5, 몽글 정본은 생김새 참고로만)를 public/img로 옮긴 것.
// 줄 차례는 잠 → 친구 → 비 → 눈 → 전화(timeline.ts flips와 같은 차례). 목소리 줄은 M18과 같은 소진 줄(vo/w1~w6)을 옮겨 쓴다.
export const TEXT = {
  hook: 'In Korean, sleep “comes.”',
  snapKo: '와요',
  endLine: 'Sleep comes. 😴',
  endLineKo: '잠이 와요',
};

// fx = 그 장면에서 「오는」 움직임 · vo = public/vo 줄 · cam = 장면 그림(940×1672 좌표)에서 다가갈 자리
export type Scene = {
  img: string;
  subj: string;
  read: string;
  lit: string;
  mean?: string;
  verb: string; // 영어로는 이 동사(기획 · 캡션용)
  sent: string; // 끝 카드에서 그 줄 옆에 붙는 영어 문장 뜻(v4: 「= get sleepy」 꼴은 와요 뜻이 여럿으로 읽힘)
  vo: string;
  fx: 'zzz' | 'bell' | 'rain' | 'snow' | 'buzz';
  cam: [number, number];
};
export const SCENES: Scene[] = [
  { img: 'img/jam.jpg', subj: '잠이', read: 'jami wayo', lit: 'Sleep comes.', mean: '= I’m sleepy.', verb: 'get sleepy', sent: 'I’m sleepy', vo: 'w4', fx: 'zzz', cam: [470, 820] },
  { img: 'img/friend.jpg', subj: '친구가', read: 'chinguga wayo', lit: 'My friend comes.', verb: 'come', sent: 'My friend is here', vo: 'w1', fx: 'bell', cam: [520, 950] },
  { img: 'img/rain.jpg', subj: '비가', read: 'biga wayo', lit: 'Rain comes.', mean: '= It’s raining.', verb: 'fall', sent: 'It’s raining', vo: 'w2', fx: 'rain', cam: [470, 800] },
  { img: 'img/snow.jpg', subj: '눈이', read: 'nuni wayo', lit: 'Snow comes.', mean: '= It’s snowing.', verb: 'fall', sent: 'It’s snowing', vo: 'w3', fx: 'snow', cam: [520, 800] },
  { img: 'img/phone.jpg', subj: '전화가', read: 'jeonhwaga wayo', lit: 'A call comes.', mean: '= My phone rings.', verb: 'ring', sent: 'My phone rings', vo: 'w5', fx: 'buzz', cam: [450, 900] },
];

// ── 두 채널 판(기획장부/LAB.md 머리말 「두 채널 판」 — 판끼리 따로 고치지 않고 이 표 한 곳에서 렌더) ──────────────
// 한국어(subj · 와요 · 끝 줄 「잠이 와요」 · 소진 목소리)와 읽는 법(read, 영어 로마자)은 모든 판에서 그대로이고, 영어 글만 그 나라 말로 다시 쓴다.
// 글꼴은 퀴즈 #5 locales.ts · E11 Film4와 같은 윈도우 글꼴 줄이다 — 저장소가 공개라 Microsoft 글꼴 파일을 public/fonts에 넣지 않는다.
// 문안 검문: 게시/검문/zhs.txt · my.txt(tools/현지어대조.js).
export type Loc = 'en' | 'zhs' | 'my';
export type LocPack = {
  font: string;
  hook: string; // 버마어는 줄바꿈 자리를 글 안에 \n으로 둔다
  hookSize: number;
  hookLine: number;
  litSize: number; // 장면 띠 직역 · 뜻 줄
  litLine: number;
  sentSize: number; // 끝 카드 문장 뜻
  endLine: string;
  endLineSize: number;
  scenes: { lit: string; mean?: string; sent: string }[]; // 차례는 SCENES와 같다
};
export const LOCS: Record<Loc, LocPack> = {
  en: {
    font: "'Inter Tight', 'SUIT', sans-serif",
    hook: TEXT.hook,
    hookSize: 56,
    hookLine: 1.1,
    litSize: 46,
    litLine: 1.2,
    sentSize: 42,
    endLine: TEXT.endLine,
    endLineSize: 56,
    scenes: SCENES.map((s) => ({ lit: s.lit, mean: s.mean, sent: s.sent })),
  },
  zhs: {
    font: "'Inter Tight', 'Microsoft YaHei', 'SUIT', sans-serif",
    hook: '韩语里，连犯困都用“来”',
    hookSize: 60,
    hookLine: 1.2,
    litSize: 52,
    litLine: 1.25,
    sentSize: 60,
    endLine: '睡意来了 😴',
    endLineSize: 60,
    scenes: [
      { lit: '睡意来了', mean: '= 我困了', sent: '我困了' },
      { lit: '朋友来了', sent: '朋友来了' },
      { lit: '雨来了', mean: '= 下雨了', sent: '下雨了' },
      { lit: '雪来了', mean: '= 下雪了', sent: '下雪了' },
      { lit: '电话来了', sent: '来电话了' },
    ],
  },
  my: {
    font: "'Inter Tight', 'SUIT', 'Myanmar Text', sans-serif",
    hook: 'ကိုရီးယားလိုဆို အိပ်ချင်တာကိုတောင်\n“လာတယ်” လို့ ပြောတယ်', // 줄바꿈 자리를 정한다(ICU 자동 줄바꿈은 တာ / ကို · ကို / တောင်에서 갈랐다)
    hookSize: 46,
    hookLine: 1.35,
    litSize: 50,
    litLine: 1.4,
    sentSize: 52,
    endLine: 'အိပ်ချင်စိတ် လာတယ် 😴',
    endLineSize: 56,
    scenes: [
      { lit: 'အိပ်ချင်စိတ် လာတယ်', mean: '= အိပ်ချင်တယ်', sent: 'အိပ်ချင်တယ်' },
      { lit: 'သူငယ်ချင်း လာတယ်', sent: 'သူငယ်ချင်း ရောက်ပြီ' },
      { lit: 'မိုး လာတယ်', mean: '= မိုးရွာနေတယ်', sent: 'မိုးရွာနေတယ်' },
      { lit: 'ဆီးနှင်း လာတယ်', mean: '= ဆီးနှင်းကျနေတယ်', sent: 'ဆီးနှင်းကျနေတယ်' },
      { lit: 'ဖုန်း လာတယ်', mean: '= ဖုန်းမြည်နေတယ်', sent: 'ဖုန်းမြည်နေတယ်' },
    ],
  },
};
