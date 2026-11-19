// LAB 몽골 M64 「아무거나~」 장면 정본(11-19) — 그림 · 한국어(말의 한글 · 목소리) · 소리 · 박자. 판본마다 같다.
// 우리편 M37 「피곤할 때 네 마디」(검증된 틀 ③ 상황 쌓임 + 게이지 — 11-15 인스타 72시간 10,917회 · 평소의 3.9배 · 공유 157 · 저장 263)의 뼈대를 1:1로 —
// 머리 칸 → 상황 칸 + 표현 칸 넷 → 끝 칸. M37은 몽글의 배터리가 줄었다면, 이 편은 친구의 참을성이 줄어든다.
// 상황 칸에서는 친구가 메뉴를 고르자고 하고(뭐 먹을래? · 떡볶이? · 치킨? · 라면…?), 표현 칸에서는 몽글이 네 마디로 넘긴다(아무거나~ · 그건 좀… · 다른 거 없어? · 글쎄…).
// 끝은 참을성 0%에 친구가 메뉴판을 내밀며 「그럼 네가 골라!」 → 몽글 「…아무거나~」 → 친구가 메뉴판에 엎어진다.
// 그 나라 글(머리 글 · 말 읽는 법 · 뜻 · 게이지 이름표 · 끝 줄)은 판본 글 하나(./판본/<KEY>.json — ./판본.ts)가 원천이다.
// 소리는 소진(몽글) · 범수(친구) · 효과음은 직접 합성(../../../소리/만들기.py) · 음악은 보유곡 시티팝_147 한 토막.
export const FPS = 30;
export const TOTAL = 30.4;

// 몽글의 네 마디(표현 칸)
export type Phrase = {
  n: number; // 1~4 — 판본 글 reads · means의 차례(n - 1)
  ko: string;
  patience: number; // 이 칸에서 내려가는 친구의 참을성(0~1)
  head: [number, number]; // 「−25%」가 튀는 자리 — 뒤에 선 친구 머리 위(이해 시험 v2 둘: 게이지가 왜 줄어드는지)
  dropAt: number; // 게이지가 떨어지는 초 — 몽글이 한 번 말한 뒤 둘째 박자(이해 시험 v1: 같은 말 두 번이 늘어진다 · 게이지가 왜 줄어드는지 늦게 안다)
  right: number; // 글 덩이 오른쪽 끝(px, 화면 왼쪽에서)
  bottom: number; // 글 덩이 아래 끝(px, 화면 위에서)
  width: number;
  koSize?: number; // 한글 글자 크기(기본 124) — 뒤에 선 친구 얼굴을 가리지 않게 칸마다 줄인다
  koShow?: string; // 화면에 그릴 한글(줄 바꿈 문자로 두 줄) — 없으면 ko
};

// 친구의 말(상황 칸 · 끝 칸) — 흰 말풍선, 꼬리는 친구 입 쪽
export type Ask = {
  n: number; // 판본 글 asks · askReads의 차례(0~3), 4 = 끝 칸 「그럼 네가 골라!」(boomRead · boomMean)
  ko: string;
  left: number;
  top: number;
  width: number;
  tail: [number, number]; // 꼬리 끝(친구 입 쪽)
};

export type Cell = {
  at: number;
  img: string;
  ask?: Ask;
  phrase?: Phrase;
  vo?: { id: string; at: number }[];
};

export const KO_LINES = {
  open: '아무거나~', // 머리 칸 몽글 작은 말 — openRead · openMean(첫째 마디를 첫 칸에도)
  last: '…아무거나~', // 끝 칸 몽글 — lastRead · lastMean
};

export const CELLS: Cell[] = [
  // 머리 칸 — 저녁 끝 모습을 앞에서 먼저: 참을성 1%, 머리를 감싼 친구 곁에서 해맑은 몽글
  { at: 0.0, img: 'open.jpg', vo: [{ id: 'm1', at: 0.55 }] },
  { at: 3.2, img: 'ask.jpg', vo: [{ id: 'f1', at: 3.32 }], ask: { n: 0, ko: '뭐 먹을래?', left: 470, top: 410, width: 450, tail: [330, 790] } },
  {
    at: 5.0, img: 'any.jpg', vo: [{ id: 'm1', at: 5.12 }],
    phrase: { n: 1, ko: '아무거나~', patience: 0.75, dropAt: 6.45, head: [250, 520], right: 920, bottom: 700, width: 540, koSize: 108 },
  },
  { at: 7.7, img: 'ttok1.jpg', vo: [{ id: 'f2', at: 7.82 }], ask: { n: 1, ko: '떡볶이?', left: 500, top: 400, width: 420, tail: [420, 800] } },
  {
    at: 9.6, img: 'ttok2.jpg', vo: [{ id: 'm2', at: 9.72 }],
    phrase: { n: 2, ko: '그건 좀…', patience: 0.5, dropAt: 11.1, head: [320, 470], right: 920, bottom: 860, width: 440, koSize: 96 }, // 두 줄(그건 / 좀…)은 끊겨 보였다(이해 시험 v1 그록)
  },
  { at: 12.5, img: 'chick1.jpg', vo: [{ id: 'f3', at: 12.62 }], ask: { n: 2, ko: '치킨?', left: 500, top: 420, width: 420, tail: [420, 920] } },
  {
    at: 14.4, img: 'chick2.jpg', vo: [{ id: 'm3', at: 14.52 }],
    phrase: { n: 3, ko: '다른 거 없어?', patience: 0.25, dropAt: 16.0, head: [230, 470], right: 920, bottom: 880, width: 420, koSize: 110, koShow: '다른 거\n없어?' },
  },
  { at: 17.5, img: 'ramen1.jpg', vo: [{ id: 'f4', at: 17.62 }], ask: { n: 3, ko: '라면…?', left: 500, top: 400, width: 420, tail: [370, 800] } },
  {
    at: 19.4, img: 'ramen2.jpg', vo: [{ id: 'm4', at: 19.52 }],
    phrase: { n: 4, ko: '글쎄…', patience: 0.01, dropAt: 21.0, head: [280, 540], right: 920, bottom: 820, width: 460, koSize: 116 },
  },
  // 끝 — 참을성 0%에 「그럼 네가 골라!」 → 몽글이 메뉴판을 한참 보다 「…아무거나~」 → 친구가 의자에 주저앉아 메뉴판에 엎어진다(한 장면 — 끝 3초가 이 장면이다)
  // 첫 컷 검사 v1(다른 눈): 메뉴판 바탕이 컷 사이에 바뀜 · 서 있던 친구가 앉는 칸 없이 엎어짐 · 「…아무거나~」가 1.5초 안 → 같은 메뉴판으로 다시 굽고 「주저앉음」 칸을 더하고 박자를 늘렸다(v2)
  { at: 22.5, img: 'boom.jpg', vo: [{ id: 'f5', at: 22.62 }], ask: { n: 4, ko: '그럼 네가 골라!', left: 110, top: 400, width: 810, tail: [320, 770] } },
  // 원본 M37의 반전(25.3초 100% 번쩍) · 끝 장치(28.6초 다음 날) 자리에 「…아무거나~」와 엎어짐을 둔다(나란히 뼈대 자리)
  { at: 24.6, img: 'menu1.jpg' },
  { at: 25.3, img: 'menu2.jpg', vo: [{ id: 'm5', at: 25.42 }] },
  // 첫 컷 검사 v2(다른 눈): 앉는 동작 · 엎어지는 동작이 없이 자세만 바뀜 → 중간 동작 두 칸(털썩 · 기울어짐)을 더했다(v3)
  // 첫 컷 검사 v6(다른 눈): 손에 든 메뉴판이 다음 칸에 이미 탁자 위 — 두 손으로 판을 탁자에 내려놓는 칸을 더했다(v7)
  { at: 26.6, img: 'lower.jpg' },
  { at: 27.0, img: 'drop.jpg' },
  { at: 27.5, img: 'sit.jpg' },
  { at: 28.25, img: 'lean.jpg' },
  { at: 28.6, img: 'flop.jpg' },
];

export const BOOM_AT = 22.5;
export const MENU_AT = 24.6;
export const LAST_AT = 25.42;
export const DROP_AT = 27.0;
export const SIT_AT = 27.5;
export const LEAN_AT = 28.25;
export const FLOP_AT = 28.6;
export const END_AT = 28.85;

// 몽글 자리(그림옮기기로 1080×1920에 맞춘 좌표) — 움직임 조각이 여기서 난다. 그림을 다시 구우면 다시 잰다.
export const MONGLE: Record<string, { cx: number; cy: number; rx: number; ry: number }> = {
  'open.jpg': { cx: 735, cy: 1389, rx: 175, ry: 190 }, // 첫화면2 — 위 42%를 하늘로 비운 판(머리 글이 친구 머리에 겹쳐서 다시 구움)
  'ask.jpg': { cx: 765, cy: 1170, rx: 240, ry: 250 },
  'any.jpg': { cx: 675, cy: 1200, rx: 330, ry: 360 },
  'ttok1.jpg': { cx: 795, cy: 1020, rx: 230, ry: 220 },
  'ttok2.jpg': { cx: 735, cy: 1260, rx: 290, ry: 330 },
  'chick1.jpg': { cx: 705, cy: 1260, rx: 220, ry: 230 },
  'chick2.jpg': { cx: 735, cy: 1230, rx: 290, ry: 310 },
  'ramen1.jpg': { cx: 825, cy: 1110, rx: 230, ry: 220 },
  'ramen2.jpg': { cx: 660, cy: 1380, rx: 370, ry: 330 },
  'boom.jpg': { cx: 870, cy: 1120, rx: 200, ry: 240 },
  'boom2.jpg': { cx: 870, cy: 1120, rx: 200, ry: 240 },
  'menu1.jpg': { cx: 770, cy: 1360, rx: 300, ry: 380 },
  'menu2.jpg': { cx: 750, cy: 1380, rx: 300, ry: 340 },
  'lower.jpg': { cx: 840, cy: 1280, rx: 215, ry: 205 },
  'drop.jpg': { cx: 840, cy: 1280, rx: 215, ry: 205 },
  'sit.jpg': { cx: 840, cy: 1280, rx: 215, ry: 205 },
  'lean.jpg': { cx: 840, cy: 1280, rx: 215, ry: 205 },
  'flop.jpg': { cx: 800, cy: 1300, rx: 205, ry: 205 },
};

// 친구 자리(떨림 · 엎어짐 조각)
export const FRIEND: Record<string, { cx: number; cy: number; rx: number; ry: number }> = {
  'boom.jpg': { cx: 255, cy: 1080, rx: 270, ry: 560 },
  'boom2.jpg': { cx: 255, cy: 1080, rx: 270, ry: 560 },
  'drop.jpg': { cx: 300, cy: 1060, rx: 280, ry: 440 },
  'sit.jpg': { cx: 280, cy: 1060, rx: 260, ry: 420 },
  'lean.jpg': { cx: 330, cy: 1100, rx: 290, ry: 420 },
  'flop.jpg': { cx: 330, cy: 1150, rx: 300, ry: 420 },
};

// 배경음 — public/sfx/bgm.wav는 보유곡 시티팝_147의 27.5~58.5초(26.25~27초 빈 마디를 피함). 내내 낮게, 폭발에서 한 번 낮추고 끝에서 다시
export const BGM_LOW = 0.16; // 올리기 전 검사(11-19): 0.12에서 음악이 전체보다 12.3dB 작아 말 없는 자리가 빈 듯 들림 → 올림
export const BGM_DIP = 0.09;

export const SFX: { file: string; at: number; vol: number }[] = [
  { file: 'deflate.wav', at: 1.5, vol: 0.45 },
  { file: 'pop.wav', at: 3.2, vol: 0.3 },
  { file: 'whoosh.wav', at: 3.12, vol: 0.35 }, // ⏪ 30분 전으로 감기
  { file: 'step.wav', at: 3.25, vol: 0.4 },
  { file: 'drain.wav', at: 6.47, vol: 0.5 },
  { file: 'sizzle.wav', at: 7.7, vol: 0.5 },
  { file: 'drip.wav', at: 9.9, vol: 0.45 },
  { file: 'drain.wav', at: 11.12, vol: 0.5 },
  { file: 'crunch.wav', at: 12.55, vol: 0.45 },
  { file: 'drain.wav', at: 16.02, vol: 0.5 },
  { file: 'ding.wav', at: 17.55, vol: 0.35 },
  { file: 'think.wav', at: 19.7, vol: 0.4 },
  { file: 'drain.wav', at: 21.02, vol: 0.55 },
  { file: 'low.wav', at: 21.55, vol: 0.4 },
  { file: 'low.wav', at: 22.0, vol: 0.4 },
  { file: 'kettle.wav', at: 22.2, vol: 0.55 },
  { file: 'whoosh.wav', at: 22.55, vol: 0.55 },
  { file: 'think.wav', at: 24.7, vol: 0.35 },
  { file: 'pop.wav', at: 25.34, vol: 0.25 },
  { file: 'whoosh.wav', at: DROP_AT - 0.04, vol: 0.4 },
  { file: 'deflate.wav', at: SIT_AT + 0.05, vol: 0.4 },
  { file: 'whoosh.wav', at: LEAN_AT - 0.02, vol: 0.35 },
  { file: 'thud.wav', at: FLOP_AT, vol: 0.75 },
  { file: 'low.wav', at: FLOP_AT + 0.25, vol: 0.3 },
];
