// LAB 영어 E42 「세트 주세요」(11-17 07시 회차) — 원본 같은분야 Flatty in Korea 「World's Iconic Dishes」(12.9초 · 한 컷:
// 작은 네모가 지도 위를 날아가며 0.73 · 2.57 · 3.90 · 5.23 · 6.57 · 7.93 · 9.27초에 「Tacos 타코 → Pasta 파스타 …」 말풍선을 띄우고, 10초쯤 처음 자리로 돌아간다).
// 우리: 버거 가게 계산대(고정 카메라)에서 몽글이 「버거 · 콜라 · 아이스크림 주세요!」를 한국식으로 주문해 하나씩 받다가,
// 마지막에 영어로 「버거 Set!」 — 점원이 「버거 셋이요?」(셋 = 3)로 되묻고, 몽글이 「네!」 하자 버거 셋을 계산대에 나란히 쾅(핵심 장면) → 「셋 = 3 · 세트 = combo」 →
// 넓게 돌아와(원본 끝 자리) 버거 탑 앞에서 「세… 세트… 주세요…」.
// 박자는 원본 말풍선 초 × 1.182(15.2 / 12.86) — 0.86 · 3.04 · 4.61 · 6.18 · 7.77 · 9.37 · 10.96초, 끝 11.8초.
// 그림 · 한국어 목소리 · 박자는 여기, 화면 글(영어 판 정본)은 LOCS.
export const FPS = 30;
export const TOTAL = 16.4; // 원본 12.86초의 128%(끝에 세트 쟁반 사건을 더함 — 이해 시험 v1 「끝 질문 카드가 지난 편과 같다」)

export type Cell = { at: number; img: string; push?: [number, number]; origin?: string };
export const CELLS: Cell[] = [
  { at: 0.0, img: 's6.jpg', push: [1.12, 1.16], origin: '30% 60%' }, // 훅 — 결과 먼저: 버거 셋 앞에서 놀란 몽글(이해 시험 v1 「처음 3초에 궁금한 사건이 없다」 · 교훈 L16)
  { at: 0.8, img: 's1.jpg', push: [1.0, 1.05], origin: '35% 64%' }, // 처음으로 — 빈 계산대, 신난 몽글 「버거 주세요!」(원본 0.73초 첫 말풍선)
  { at: 2.6, img: 's2.jpg', push: [1.2, 1.25], origin: '28% 74%' }, // 가까이 — 버거가 나옴 · 「콜라 주세요!」(원본 2.57초 — 이해 시험 v2 「1~4초 같은 그림」으로 0.54초 당김)
  { at: 4.61, img: 's3.jpg', push: [1.22, 1.26], origin: '22% 64%' }, // 몽글 가까이 — 콜라 · 「아이스크림 주세요!」(원본 3.90초)
  { at: 6.18, img: 's4.jpg', push: [1.0, 1.05], origin: '33% 62%' }, // 넓게 — 아이스크림 · 우쭐한 몽글 「버거 Set!」(원본 5.23초)
  { at: 7.77, img: 's5.jpg', push: [1.06, 1.1], origin: '45% 55%' }, // 점원이 손가락 셋 「버거 셋이요?」 → 몽글이 끄덕 「네!」(원본 6.57초 — 장면 심사 v1 「1.5초 같은 그림 · 몽글이 잘리고 반응 없음」)
  { at: 9.37, img: 's6.jpg', push: [1.18, 1.22], origin: '30% 60%' }, // 핵심 장면 — 버거 셋이 계산대에 나란히 쾅, 놀란 몽글(원본 7.93초)
  { at: 10.96, img: 's6.jpg', push: [1.48, 1.55], origin: '10% 62%' }, // 몽글 얼굴 가까이 — 굳은 몽글(원본 9.27초 마지막 말풍선 — 이해 시험 v2 「가운데 뜻 풀이 카드가 지난 편과 같은 순서」로 카드를 빼고 끝 이름표로)
  { at: 11.8, img: 's6.jpg', push: [1.0, 1.03], origin: '50% 60%' }, // 넓게 돌아옴(원본 10초 처음 자리로) · 「세… 세트… 주세요…」
  { at: 14.2, img: 's7.jpg', push: [1.0, 1.03], origin: '50% 60%' }, // 끝 — 점원이 웃으며 세트 쟁반을 밀어 줌, 안도한 몽글(교훈 L15 끝은 사건으로)
];

// 목소리 — 몽글 소진(vo_m) · 점원 범수(vo_b)
export const VO: [number, string][] = [
  [0.95, 'vo_m/m1'], // 버거 주세요!
  [2.1, 'vo_b/b1'], // 네~
  [2.7, 'vo_m/m2'], // 콜라 주세요!
  [3.9, 'vo_b/b2'], // 네!
  [4.75, 'vo_m/m3'], // 아이스크림 주세요!
  [6.62, 'vo_m/m4'], // 버거 셋!(영어 set)
  [7.85, 'vo_b/b3'], // 버거 셋이요?
  [8.9, 'vo_m/m6'], // 네!
  [9.55, 'vo_b/b4'], // 버거 셋, 나왔습니다!
  [11.95, 'vo_m/m5'], // 세… 세트… 주세요…
  [13.6, 'vo_b/b5'], // 아~ 세트! 네~!
];

export const T = {
  headTo: 10.96,
  hookTo: 0.8,
  m1: 0.86, m1To: 2.6,
  b1: 1.95, b1To: 2.6,
  m2: 2.6, m2To: 4.61,
  b2: 3.9, b2To: 4.61,
  m3: 4.66, m3To: 6.18,
  m4: 6.18, m4To: 7.77,
  b3: 7.82, b3To: 8.85,
  m6: 8.85, m6To: 9.37,
  slam: 9.37,
  b4: 9.45, b4To: 10.96,
  tag1: 14.2, tag2: 14.2, // 이름표 둘은 끝 판이 바뀌는 순간 함께(원본 박자 · 읽기 2.2초)
  back: 11.8,
  m5: 11.8, m5To: 13.6,
  b5: 13.6,
};

export type Body = { cx: number; cy: number; rx: number; ry: number; baseY: number };
// 통통 — 첫 주문에서 몽글이 신나 한 번 튄다(s1 판 · 이해 시험 v2 「1~4초 같은 그림」)
export const HOP = { at: 0.9, dur: 0.45, img: 's1.jpg', body: { cx: 270, cy: 1265, rx: 250, ry: 215, baseY: 1440 } as Body };

// 끄덕 — 몽글이 「네!」 하며 몸을 눌렀다 튕긴다(s5 판의 몽글 자리)
export const NOD = { at: 8.85, dur: 0.42, img: 's5.jpg', body: { cx: 250, cy: 1265, rx: 250, ry: 215, baseY: 1440 } as Body };

// 쾅 — 버거 셋이 내려앉을 때 화면이 0.35초 떤다
export const SHAKE = { at: 9.37, dur: 0.35, px: 14 };

export const SFX: [number, string, number][] = [
  [0.0, 'boing.wav', 0.3],
  [0.8, 'whoosh.wav', 0.3],
  [0.86, 'pop.wav', 0.35],
  [0.95, 'plop.wav', 0.25],
  [2.0, 'pop.wav', 0.25],
  [2.6, 'slide.wav', 0.45],
  [2.68, 'plop.wav', 0.55],
  [4.61, 'slide.wav', 0.4],
  [4.68, 'plop.wav', 0.5],
  [6.18, 'plop.wav', 0.5],
  [6.3, 'sparkle.wav', 0.4],
  [7.77, 'whoosh.wav', 0.22],
  [7.82, 'huh.wav', 0.45],
  [8.85, 'pop.wav', 0.3],
  [8.88, 'plop.wav', 0.3],
  [9.37, 'slam.wav', 0.85],
  [9.42, 'crumbs.wav', 0.45],
  [9.55, 'ding.wav', 0.3],
  [9.7, 'boing.wav', 0.4],
  [10.96, 'whoosh.wav', 0.2],
  [11.8, 'whoosh.wav', 0.25],
  [12.9, 'womp.wav', 0.4],
  [13.6, 'pop.wav', 0.3],
  [14.2, 'slide.wav', 0.5],
  [14.32, 'plop.wav', 0.5],
  [14.45, 'ding.wav', 0.35],
  [14.55, 'pop.wav', 0.35],
];

// 화면 글(영어 판 정본) — 한국어 · 읽는 법(로마자)은 모든 판 그대로, 영어 · 뜻만 판마다
export type Loc = 'en';
export type LocText = {
  font: string;
  headBig: string;
  headSub: string;
  m1: string; b1: string; m2: string; b2: string; m3: string;
  m4ko: string; m4: string;
  b3: string; m6: string; b4: string;
  tag1: string; tag2: string;
  m5: string;
  b5: string;
};
export const FONT = "'Inter Tight', 'SUIT', sans-serif";
export const LOCS: Record<Loc, LocText> = {
  en: {
    font: FONT,
    headBig: 'How I got 3 burgers 🍔',
    headSub: '',
    m1: 'A burger, please!',
    b1: 'Sure~',
    m2: 'A cola, please!',
    b2: 'Okay!',
    m3: 'Ice cream, please!',
    m4ko: '버거 Set!',
    m4: '…and a burger SET\n(= combo)! 😎', // 이해 시험 v3 넷이 같이 짚은 「Set이 무엇인지 · 친구가 안 보임」 — 시험 없이 고침
    b3: 'THREE burgers? 🤔',
    m6: 'Yep!',
    b4: 'Three burgers, here you go!',
    tag1: 'three 🍔🍔🍔',
    tag2: 'combo 🍔🍟🥤',
    m5: 'A combo… please… 🥲',
    b5: 'Oh, a COMBO! Sure~ 😂',
  },
};
