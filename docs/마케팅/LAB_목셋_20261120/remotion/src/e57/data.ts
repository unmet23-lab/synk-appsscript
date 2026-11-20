// LAB 영어 E57 「목 · 손목 · 발목」(11-20 07시 회차) — 원본 같은분야 「Gen Z 말을 일본어로 글자 그대로」(22.7초):
// 위에 제목을 둔 채 낱말 하나를 글자 그대로 연기한 장면이 3~4초씩 여섯 번 이어진다(5.0 · 8.4 · 11.3 · 16.0 · 19.0초에 다음 낱말).
// 우리: 눈 내린 저녁 길에서 한국 친구가 목도리(목 · 3.0초) → 손목 토시(손목 · 5.0초) → 긴 양말(발목 · 8.4초)을 차례로 두르고,
// 11.3초 몽글 눈높이에서 올려다본 「목이 셋」 → 몽글 「목이… 셋?!」 → 친구가 몽글에게도 목도리를 둘러 주지만(15.0초) 목이 없어 흘러내린다(16.0초)
// → 「내 목은…?」 → 온몸을 목도리로 감아 준다(19.0초) → 끝: 목이 셋인 친구와 털실 고치가 된 몽글 + 낱말 카드.
// 그림 · 한국어 목소리 · 박자는 여기, 화면 글(영어 판 정본)은 LOCS.
export const FPS = 30;
export const TOTAL = 22.0; // 원본 22.7초의 97%

export type Cell = { at: number; img: string; push?: [number, number]; origin?: string };
export const CELLS: Cell[] = [
  { at: 0.0, img: 's1.jpg', push: [1.0, 1.04], origin: '40% 45%' }, // 훅 — 목도리를 쥐고 덜덜 떠는 친구 · 옆의 몽글 · 머리 글(원본 0~3.5초 제목 칸)
  { at: 3.15, img: 's2.jpg', push: [1.0, 1.03], origin: '45% 50%' }, // 가슴 위 · 목도리를 휙 두름(원본 3.5초 첫 컷 자리 — 첫 박자 0.5초 안)
  { at: 3.55, img: 's2b.jpg', push: [1.0, 1.04], origin: '45% 55%' }, // 다 두르고 턱을 묻음(원본 3.7초)
  { at: 5.0, img: 's3a.jpg', push: [1.0, 1.03], origin: '40% 50%' }, // 내려다본 두 손목 · 토시를 끼우는 중(원본 5.0초 둘째 낱말)
  { at: 5.3, img: 's3b.jpg', push: [1.0, 1.05], origin: '50% 55%' }, // 토시 낀 두 손을 번쩍 · 「손목!」
  { at: 6.9, img: 's3m2.jpg', push: [1.0, 1.05], origin: '45% 65%' }, // 몽글이 몸을 기울여 제 옆구리에서 손목을 찾는다 — 없다(이해 시험 v3 G · K · 볼 이유 「6~11초 같은 낱말 카드 · 손바닥 화면이 길다」, h · s 「몽글이 왜 목이 없는지」 — 볼 이유 심사관 제안대로 끝 반전의 복선)
  { at: 8.4, img: 's4a.jpg', push: [1.0, 1.03], origin: '50% 60%' }, // 눈 위 낮게 · 발목에 뭉친 긴 양말을 잡음(원본 8.4초 셋째 낱말)
  { at: 8.95, img: 's4a2.jpg', push: [1.0, 1.03], origin: '50% 60%' }, // 양말을 정강이 반까지 끌어올림(첫 컷 다른 눈 v1 #41 — 중간 판)
  { at: 9.5, img: 's4b.jpg', push: [1.0, 1.05], origin: '50% 65%' }, // 양말을 다 올리고 뒤꿈치를 듦 · 「발목!」
  { at: 10.3, img: 's4c.jpg', push: [1.02, 1.06], origin: '50% 65%' }, // 뒤꿈치를 탁 내림 · 눈가루(첫 컷 다른 눈 v2 #26 · #41)
  { at: 11.3, img: 's5.jpg', push: [1.0, 1.06], origin: '50% 40%' }, // 몽글 눈높이에서 올려다본 친구 — 목 · 손목 · 발목이 다 노란 털실 · 이름표 셋(핵심 장면 · 원본 11.3초)
  { at: 12.6, img: 's6n.jpg', push: [1.0, 1.03], origin: '50% 55%' }, // 몽글 얼굴 가까이 — 아직 차분히 올려다봄(첫 컷 v1 #33)
  { at: 12.95, img: 's6.jpg', push: [1.02, 1.08], origin: '50% 55%' }, // 같은 자리 — 눈이 휘둥그레 · 땀 · 뒤로 젖힘 · 「목이… 셋?!」
  { at: 14.65, img: 's7.jpg', push: [1.0, 1.03], origin: '60% 60%' }, // 무릎 꿇은 친구가 몽글 머리에 민트 목도리 · 「너도!」(원본 15.0초 — 말풍선을 1.3초 두려고 0.35초 당김)
  { at: 16.0, img: 's8a.jpg', push: [1.0, 1.04], origin: '50% 60%' }, // 목도리가 미끄러져 내려감(원본 16.0초)
  { at: 16.4, img: 's8b.jpg', push: [1.0, 1.05], origin: '50% 55%' }, // 내려다봄 — 바닥에 떨어진 목도리 · 「내 목은…?」
  { at: 19.0, img: 's9.jpg', push: [1.0, 1.03], origin: '60% 60%' }, // 몽글 온몸을 목도리로 빙빙 감음(원본 19.0초)
  { at: 19.3, img: 's9b.jpg', push: [1.0, 1.03], origin: '60% 60%' }, // 더 감음 — 눈만 남음(원본 19.3초)
  { at: 19.6, img: 's10.jpg', push: [1.0, 1.04], origin: '55% 50%' }, // 끝 — 목이 셋인 친구와 털실 고치 몽글 · 「따뜻해~」 · 끝 띠(원본 19.6~22.7초)
];

// 목소리 — 친구 도윤(f1~f5), 몽글 소진(m1~m3). 끝 「하하!」(f6)는 화면 글 없이 들리던 줄이라 뺐다(이해 시험 v3 s)
export const VO: [number, string][] = [
  [0.4, 'vo/f1'], // 으, 추워!
  [3.3, 'vo/f2'], // 목!
  [5.35, 'vo/f3'], // 손목!
  [9.55, 'vo/f4'], // 발목!
  [13.05, 'vo/m1'], // 목이… 셋?!
  [14.75, 'vo/f5'], // 너도!
  [16.55, 'vo/m2'], // 내 목은…?
  [19.75, 'vo/m3'], // 따뜻해~
];

export const T = {
  headTo: 3.15, // 머리 글은 훅(원본 제목 칸 0~3.5초)만
  f1: 0.35, f1To: 2.8,
  w1: 3.25, w1To: 5.0, // 목 띠 — 목도리가 감기자마자(이해 시험 v3 s 「3초 가까운 칸은 웃는 얼굴만 있고 설명이 없다」)
  w2: 5.1, w2b: 5.35, w2To: 8.4, // 손목 띠 — 영어 식도 0.25초 안에(v3 K 「5.2초 칸에는 한국어와 읽는 법만」)
  th: 7.1, thTo: 8.4, // 몽글 생각 「손목…?」(다시 시험 v4 K 「8초 몽글이 땀을 흘리며 눈을 좁힌 이유를 모르겠다」)
  w3: 8.5, w3b: 8.75, w3To: 11.3, // 발목 띠
  tags: [11.35, 11.45, 11.55] as [number, number, number], // 미학 맹검 「발목 표식이 늦게 떠 바로 넘어간다」 — 셋을 0.1초 간격으로 당겨 12.6초까지 1.05~1.25초씩 둔다(v3 K 「12초 다리 쪽 꼬리표를 못 읽음」)
  m1: 13.0, m1To: 14.65,
  f5: 14.7, f5To: 16.0,
  m2: 16.5, m2To: 18.9,
  m3: 19.7, m3To: 21.0,
  card: 20.1, // 끝 띠(가장 센 그림 위 · 원본 끝 장면 20.1초)
};

export type Body = { cx: number; cy: number; rx: number; ry: number; baseY: number };
// 덜덜 — s1 판의 친구(목도리를 쥔 몸)만 떤다
export const SHIVER = { from: 0.0, to: 3.0, img: 's1.jpg', body: { cx: 395, cy: 1000, rx: 230, ry: 560, baseY: 1600 } as Body, px: 5 };
// 놀람 — s6 몽글이 움찔 뒤로 젖혔다 부푼다
export const GASP = { at: 12.95, dur: 1.0, img: 's6.jpg', body: { cx: 680, cy: 1195, rx: 390, ry: 500, baseY: 1660 } as Body }; // 새 s6(11-20 08:33)의 몽글 자리
// 감기는 칸 — s9에서 몽글 쪽이 빙글 기운다
export const SPIN = { from: 19.0, to: 19.3, img: 's9.jpg', body: { cx: 770, cy: 1330, rx: 260, ry: 300, baseY: 1600 } as Body };
// 따뜻 — 끝 칸 털실 고치가 한 번 통통
export const HOP = { at: 20.5, dur: 0.45, img: 's10.jpg', body: { cx: 815, cy: 1390, rx: 210, ry: 230, baseY: 1600 } as Body };

// 이름표 — 올려다본 칸(s5)에서 목 · 손목 · 발목을 가리키는 짧은 선과 작은 점(동그라미 테 · 고리를 쓰지 않는다)
export type Tag = { ko: string; x: number; y: number; px: number; py: number };
export const TAGS_S5: Tag[] = [
  { ko: '목', x: 800, y: 630, px: 520, py: 702 }, // 목도리가 감긴 목(다시 시험 v5 G 「목 표시가 가슴 쪽을 가리킨다」)
  { ko: '손목', x: 175, y: 940, px: 95, py: 760 },
  { ko: '발목', x: 210, y: 1370, px: 365, py: 1640 }, // 신발 바로 위 발목(v5 s · G 「가리키는 부위 · 발목 위치」)
];

export const SFX: [number, string, number][] = [
  [0.0, 'chatter.wav', 0.35],
  [1.2, 'chatter.wav', 0.25],
  [3.15, 'whoosh.wav', 0.3],
  [3.17, 'knit.wav', 0.5],
  [3.25, 'pop.wav', 0.3],
  [5.0, 'knit.wav', 0.45],
  [5.1, 'pop.wav', 0.22],
  [5.3, 'boing.wav', 0.3],
  [6.9, 'squish.wav', 0.3],
  [7.0, 'drip.wav', 0.25],
  [8.4, 'knit.wav', 0.45],
  [8.42, 'slide.wav', 0.3],
  [8.5, 'pop.wav', 0.22],
  [8.95, 'knit.wav', 0.4],
  [9.5, 'boing.wav', 0.3],
  [10.3, 'squish.wav', 0.3],
  [11.3, 'dingdong.wav', 0.35],
  [11.35, 'pop.wav', 0.22],
  [11.45, 'pop.wav', 0.22],
  [11.55, 'pop.wav', 0.22],
  [12.95, 'boing.wav', 0.4],
  [13.0, 'drip.wav', 0.3],
  [14.65, 'knit.wav', 0.35],
  [14.7, 'pop.wav', 0.25],
  [16.0, 'slide.wav', 0.45],
  [16.4, 'squish.wav', 0.3],
  [16.55, 'drip.wav', 0.3],
  [19.0, 'whoosh.wav', 0.35],
  [19.05, 'knit.wav', 0.45],
  [19.3, 'whoosh.wav', 0.25],
  [19.35, 'knit.wav', 0.35],
  [19.6, 'sparkle.wav', 0.4],
  [20.1, 'pop.wav', 0.3],
  [20.5, 'boing.wav', 0.3],
];

// 화면 글(영어 판 정본) — 한국어 · 읽는 법(로마자)은 모든 판 그대로, 영어 · 뜻만 판마다
export type Loc = 'en';
export type LocText = {
  font: string;
  headSmall: string;
  headSub: string;
  th: string;
  headBig: string;
  f1: string;
  neck: string;
  wrist: string; hand: string;
  ankle: string; foot: string;
  m1: string;
  f5: string;
  m2: string;
  m3: string;
  cardHand: string; cardFoot: string;
};
export const FONT = "'Inter Tight', 'SUIT', sans-serif";
export const LOCS: Record<Loc, LocText> = {
  en: {
    font: FONT,
    headSmall: 'In Korean,',
    headSub: 'neck · wrist · ankle',
    th: 'My wrist…?',
    headBig: '3 body parts\nare ‘necks’',
    f1: 'Brr, so cold!',
    neck: 'neck',
    wrist: 'wrist', hand: 'hand',
    ankle: 'ankle', foot: 'foot',
    m1: 'Three… necks?!',
    f5: 'You too!',
    m2: "Where's my neck…?",
    m3: 'So warm~',
    cardHand: 'hand-neck = wrist',
    cardFoot: 'foot-neck = ankle',
  },
};
