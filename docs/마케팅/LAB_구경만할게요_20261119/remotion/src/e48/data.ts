// LAB 영어 E48 「구경만 할게요」(11-19 07시 회차) — 원본 같은분야 Koreanadda 「쇼핑 낱말」(7.3초 · 한 컷:
// 위에 영어 낱말 넷을 고정해 두고 0.3 · 1.4 · 2.6 · 3.9초에 그 아래 한국어가 하나씩 뜬 뒤 7.3초까지 머문다).
// 우리: 화장품 가게(고정 카메라)에서 점원 다섯이 샘플을 들고 몽글을 둘러싼다 — 0.3 · 1.45 · 2.65초에 점원 말이 하나씩 뜨며(원본 낱말 목록처럼 앞 말이 남아 쌓인다) 점점 더 다가오고,
// 4.45초(원본 넷째 낱말 자리 3.9초 + 0.55초 — 셋째 말풍선을 1.8초 두려고)에 몽글이 「구경만 할게요…」 → 점원들이 샘플을 거두고(가까이 · 넓게)
// 물러나(반쯤 · 선반 앞) 한 줄로 고개 숙인다(핵심 장면) → 끝 낱말 카드 → 끝 사건: 몽글이 립스틱에 반하자 다섯이 다시 몰려온다.
// 첫 컷 다른 눈 v1(11-19 GPT 「다시」): 물러나는 중간 칸이 없어 순간이동(#41 · #50) · 붐빈 칸에서 점원이 굳음(#26) · 말풍선 1.5초 밑(P02)
//   → 물러나기를 판 다섯(s4c2 · s4b · s4d · s5 · s6)으로 0.25초씩 잇고, 붐빈 칸은 판을 바꿔 가며(정지 동작처럼) 움직인다.
// 첫 컷 다른 눈 v2(「다시」): 붐빈 칸 두 판의 차이가 작음 · 가까운 판에서 시트 마스크 자리가 바뀜 · 말풍선이 1.5초에 딱 걸림
//   → 크게 움직인 판 s3c를 더하고, 가까운 판을 마스크가 몽글 바로 위에 오게 다시 굽고, 셋째 말 · 몽글 말을 1.8초로 늘렸다.
// 그림 · 한국어 목소리 · 박자는 여기, 화면 글(영어 판 정본)은 LOCS.
export const FPS = 30;
export const TOTAL = 13.9; // 원본 7.29초의 191%(물러나는 사건 · 끝 카드 · 끝 사건 — 오마주.json 「다르게」)

export type Cell = { at: number; img: string; push?: [number, number]; origin?: string };
// 붐빔 → 더 붐빔 → 파묻힘 — 이해 시험 v3에서 넷(h · G · K · 볼 이유)이 「같은 그림이 번갈아 되풀이된다」를 짚어, 번갈기 대신 점점 세게(교훈 L14)
const JOSTLE_IMG = ['s3.jpg', 's3c.jpg', 's3d.jpg'];
const JOSTLE: Cell[] = [2.6, 3.2, 3.8].map((at, k) => ({ at, img: JOSTLE_IMG[k], push: [1.04 + 0.02 * k, 1.06 + 0.02 * k] as [number, number], origin: '50% 55%' }));
export const CELLS: Cell[] = [
  { at: 0.0, img: 's1.jpg', push: [1.0, 1.03], origin: '50% 45%' }, // 훅 — 이미 다섯이 샘플을 들고 둘러쌈(관문 ⑴) · 「어서 오세요~!」(원본 0.3초 첫 낱말)
  { at: 1.4, img: 's2.jpg', push: [1.02, 1.04], origin: '50% 45%' }, // 더 다가옴 · 「이거 써 보세요!」(원본 1.4초)
  ...JOSTLE, // 꽉 낌 · 「이것도요!」(원본 2.6초) — 세 판을 0.3초마다 바꿔 들이미는 움직임(첫 컷 다른 눈 v2 「두 판 차이가 작아 굳어 보인다」로 크게 움직인 s3c를 더함)
  { at: 4.45, img: 's4c.jpg', push: [1.0, 1.08], origin: '50% 68%' }, // 몽글 가까이 — 고개를 들고 「구경만 할게요…」(원본 넷째 낱말 자리)
  { at: 6.3, img: 's4b.jpg', push: [1.0, 1.0], origin: '50% 45%' }, // 넓게 — 샘플을 가슴으로 거두고 한 발 물러나며 「네~ 천천히 보세요~」(다시 시험 v5 s · h · K 「6.4초 몽글만 커진 칸이 왜 나오는지」 — 그 칸 s4c2를 빼고 몽글 말 바로 뒤에 물러남과 대답을 붙였다)
  { at: 6.55, img: 's4d.jpg', push: [1.0, 1.0], origin: '50% 50%' }, // 선반 쪽으로 걸어 물러나는 중
  { at: 6.8, img: 's5.jpg', push: [1.0, 1.0], origin: '50% 55%' }, // 선반 앞에 한 줄로 섬
  { at: 7.05, img: 's6.jpg', push: [1.0, 1.05], origin: '50% 62%' }, // 핵심 장면 — 다섯이 함께 고개 숙임, 혼자 남은 몽글 · 끝 카드
  // 끝 사건(장면 심사 v2 「끝에 반전이 없어 인사로 순하게 끝난다 · 혼자 남은 몽글이 결국 뭘 사는 반전」 · 교훈 L15) — 몽글이 립스틱에 반하자 다섯이 번쩍 고개를 들고, 순식간에 다시 둘러싼다
  { at: 8.75, img: 's6b.jpg', push: [1.0, 1.03], origin: '50% 60%' }, // 넓게 — 몽글이 왼쪽 위 선반의 빨간 립스틱(반짝임)을 보며 「와… 예쁘다…」, 다섯이 번쩍 고개를 듦
  { at: 10.3, img: 's6c.jpg', push: [1.0, 1.06], origin: '55% 45%' }, // 끼워 넣은 가까운 칸 — 몽글이 본 그 립스틱이 반짝(다시 시험 v5 s · h 「10초 립스틱 확대가 무슨 뜻인지」 — 말보다 먼저 나오던 칸을 「와… 예쁘다…」 뒤로 옮겨 「이거요?!」의 「이거」가 된다)
  { at: 10.9, img: 's7.jpg', push: [1.0, 1.05], origin: '50% 45%' }, // 번쩍 — 다섯이 그 립스틱을 들고 다시 몰려와 「이거요?!」 → 끝 카드가 돌아온다, 진땀 흘리는 몽글(끝)
];

// 목소리 — 점원 혜리(c1 · c4 · c6) · 도윤(c2 · c7) · 서현(c3 · c5 · c8), 몽글 소진(m1 · m2)
export const VO: [number, string][] = [
  [0.35, 'vo/c1'], // 어서 오세요~!
  [1.5, 'vo/c2'], // 이거 써 보세요!
  [2.7, 'vo/c3'], // 이것도요!
  [4.55, 'vo/m1'], // 구경만 할게요…
  [6.35, 'vo/c4'], // 네~ 천천히 보세요~
  [6.4, 'vo/c5'], // (함께) 네~ 천천히 보세요~
  [8.8, 'vo/m2'], // 와… 예쁘다…
  [10.93, 'vo/c6'], // 이거요?!(혜리)
  [10.95, 'vo/c7'], // 이거요?!(도윤)
  [10.98, 'vo/c8'], // 이거요?!(서현)
];

export const T = {
  headTo: 1.45, // 머리 글은 훅(0~1.45초)만 — 그 뒤 위 빈 벽은 쌓이는 점원 말풍선 자리
  c1: 0.3, c2: 1.45, c3: 2.65, crowdTo: 4.45, // 점원 말풍선은 원본 낱말 목록처럼 쌓였다가 몽글이 말할 때 함께 사라진다(셋째도 1.8초 — 교훈 P02)
  m1: 4.5, m1To: 6.3, // 1.8초(첫 컷 다른 눈 v2 「1.5초를 넘지 않는다」)
  c4: 6.3, c4To: 7.9, // 물러나면서 바로 대답(다시 시험 v5 s 「점원들이 왜 물러나는지 바로 몰랐다」)
  card: 7.2, card2: 7.5, cardOff: 8.75, cardBack: 12.4, // 끝 카드는 7.2~8.75초에 한 번, 「이거요?!」 말풍선이 진 뒤 12.4초에 다시
  hop: 8.15,
  m2: 8.75, m2To: 10.3,
  c6: 10.95, c6To: 12.4,
  flash: 10.9,
};

export type Body = { cx: number; cy: number; rx: number; ry: number; baseY: number };
// 통통 — 끝에 혼자 남은 몽글이 신나 한 번 튄다(s6 판의 몽글 자리)
export const HOP = { at: T.hop, dur: 0.45, img: 's6.jpg', body: { cx: 545, cy: 1400, rx: 225, ry: 185, baseY: 1560 } as Body };
// 말할 때 — 몽글이 몸을 살짝 부풀렸다 제자리(s4c 판의 몽글 자리)
export const NOD = { at: 4.55, dur: 0.4, img: 's4c.jpg', body: { cx: 550, cy: 1310, rx: 345, ry: 375, baseY: 1680 } as Body };
// 꽉 낌 — 다섯이 들이밀 때 화면이 0.3초 떤다
export const SHAKE = { at: 3.8, dur: 0.3, px: 10 }; // 파묻힐 때
// 말하는 동안 한 번 더 — 끝을 흐리며 몸을 움츠렸다 편다(첫 컷 다른 눈 v3 #26 「대사 접사에서 몸 자세가 같은 상태」)
export const NOD2 = { at: 5.55, dur: 0.45, img: 's4c.jpg' };
// 립스틱 반짝임 — s6b 판 왼쪽 위 선반의 빨간 립스틱 줄
export type GlowSpot = { at: number; to: number; x: number; y: number; r: number; spark: number };
// s6b 왼쪽 위 선반의 빨간 립스틱(작게) → s6c 가까운 칸의 그 립스틱(크게)
export const GLOWS: GlowSpot[] = [
  { at: 8.85, to: 10.3, x: 78, y: 540, r: 130, spark: 0.6 },
  { at: 10.3, to: 10.9, x: 575, y: 760, r: 230, spark: 1 },
];
export const SHAKE2 = { at: 10.9, dur: 0.35, px: 12 }; // 다시 몰려올 때

export const SFX: [number, string, number][] = [
  [0.0, 'rush.wav', 0.45],
  [0.08, 'boing.wav', 0.3],
  [0.3, 'pop.wav', 0.3],
  [1.4, 'slide.wav', 0.45],
  [1.45, 'pop.wav', 0.25],
  [2.6, 'squish.wav', 0.4],
  [2.62, 'slide.wav', 0.35],
  [2.65, 'pop.wav', 0.25],
  [3.2, 'slide.wav', 0.35],
  [3.22, 'squish.wav', 0.35],
  [3.8, 'squish.wav', 0.55],
  [3.82, 'slide.wav', 0.3],
  [4.0, 'drip.wav', 0.35],
  [4.45, 'whoosh.wav', 0.18],
  [4.5, 'pop.wav', 0.3],
  [6.3, 'whoosh.wav', 0.45],
  [6.55, 'whoosh.wav', 0.3],
  [6.8, 'whoosh.wav', 0.2],
  [7.05, 'dingdong.wav', 0.4],
  [7.2, 'pop.wav', 0.35],
  [7.5, 'pop.wav', 0.3],
  [8.15, 'boing.wav', 0.35],
  [8.75, 'whoosh.wav', 0.15],
  [8.78, 'pop.wav', 0.25],
  [8.85, 'sparkle.wav', 0.3],
  [8.95, 'boing.wav', 0.3],
  [10.3, 'sparkle.wav', 0.5],
  [10.9, 'rush.wav', 0.55],
  [10.9, 'whoosh.wav', 0.4],
  [10.92, 'squish.wav', 0.4],
  [10.95, 'pop.wav', 0.3],
  [11.4, 'drip.wav', 0.35],
  [12.4, 'pop.wav', 0.35],
];

// 화면 글(영어 판 정본) — 한국어 · 읽는 법(로마자)은 모든 판 그대로, 영어 · 뜻만 판마다
export type Loc = 'en';
export type LocText = {
  font: string;
  headBig: string;
  headSub: string;
  c1: string; c2: string; c3: string;
  m1: string;
  c4: string;
  cardMean: string;
  m2: string;
  c6: string;
};
export const FONT = "'Inter Tight', 'SUIT', sans-serif";
export const LOCS: Record<Loc, LocText> = {
  en: {
    font: FONT,
    headBig: 'Shopping in Korea',
    headSub: 'How do I escape?!',
    c1: 'Welcome~!',
    c2: 'Try this one!',
    c3: 'This one too!',
    m1: "I'm just\nlooking…",
    c4: 'Sure~ take your time~',
    cardMean: "I'm just looking",
    m2: 'Wow…\nso pretty…',
    c6: 'You like this one?!',
  },
};
