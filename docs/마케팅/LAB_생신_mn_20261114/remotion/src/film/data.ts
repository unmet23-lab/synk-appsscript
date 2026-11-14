// LAB 몽골 M50 「친구에겐 '생일', 할머니 · 어른께는 '생신'」(11-14 15시 회차) — 원본은 우리 편 M11 「미안 · 죄송합니다」(검증된 틀 ④ 윗사람 앞 말 고르기)
// v9의 뼈대 그대로: 고정 카메라 한 장면 · 칸마다 같은 몽글의 자세만 바뀜 · 말풍선 단계 알약이 1 → 2 → 3 → 99로 오르다 반전(9.3초)에서 반말 「0 ❌」 · 끝 12.5초.
// 무대는 할머니 댁 생신상(사장님 자리에 할머니 인형). 반전은 할머니 생신 촛불을 몽글이 제가 불어 끄고 케이크까지 차지하는 것 — 11.3~12.5초가 이 편의 핵심 장면이다.
// 판본 틀(11-10): 나라마다 다른 글(뜻 · 읽는 법 · 꼬리 · 단계 · 상황 · 할머니 이름표 · 끝 카드 · 끝 질문)은 판본/<KEY>.json(판본.ts) — 여기에는 그림 · 한국어 · 목소리 · 박자만 둔다.
export const FPS = 30;
export const TOTAL = 14.8;

export type Cell = {
  at: number;
  img: string;
  b: number; // 말풍선 차례(0~7) — 판본 means · meanSizes · tags의 자리. 큰절 세 칸(4.4 · 6.1 · 7.7초)은 같은 3, 「후우~!」 두 칸(11.3 · 11.9초)은 같은 6
  vo: string;
  voAt: number;
  ko: string;
  koSize: number;
  level?: number; // 단계 알약(배울 세 낱말은 1~3 — 판본 reads[level − 1]이 그 읽는 법)
  cont?: boolean; // 앞 칸 말풍선을 그대로 잇는 칸(그림만 바뀜)
  zero?: boolean; // 할머니께 반말 — 「Түвшин 0 ❌」 알약
  words?: [string, number, boolean?][]; // 목소리에 맞춰 낱말씩 나오는 한국어 줄 — [낱말, 목소리 안 초(음성/m4.json 낱말 시각), 강조] · '\n'은 줄바꿈
};

// 큰절(4.4~9.3초): 배운 말 「생신 축하드려요!」를 세 번 — 원본 v8 「죄송합니다!」 세 번과 같은 자리
const BOW: Omit<Cell, 'at' | 'img'> = {
  b: 3, vo: 'm4', voAt: 4.45, ko: '생신 축하드려요!\n생신 축하드려요!\n정말 생신 축하드려요!', koSize: 56, level: 99,
  words: [['생신', 0.02], ['축하드려요!', 0.38], ['\n', 0], ['생신', 1.19], ['축하드려요!', 1.55], ['\n', 0], ['정말', 2.59], ['생신', 3.01, true], ['축하드려요!', 3.35, true]],
};
export const CELLS: Cell[] = [
  { at: 0.0, img: 'g1.jpg', b: 0, vo: 's1', voAt: 0.1, ko: '생일 축하해!', koSize: 92, level: 1 },
  { at: 1.0, img: 'g2.jpg', b: 1, vo: 's2', voAt: 1.02, ko: '생일 축하해요!', koSize: 86, level: 2 },
  { at: 2.3, img: 'g3.jpg', b: 2, vo: 's3', voAt: 2.35, ko: '생신 축하드려요!', koSize: 80, level: 3 },
  { at: 4.4, img: 'g4.jpg', ...BOW },
  // 할머니가 두 손을 모으고 감동 — 같은 자세 4.9초를 끊는다(원본 6.1초 사장님 「괜찮아」 자리)
  { at: 6.1, img: 'g5.jpg', ...BOW, vo: '', cont: true },
  // 엎드린 채 한쪽 눈으로 케이크를 슬쩍 — 반전을 미리 깐다(원본 7.7초)
  { at: 7.7, img: 'g5b.jpg', ...BOW, vo: '', cont: true },
  { at: 9.3, img: 'g6.jpg', b: 4, vo: 's6', voAt: 9.3, ko: '근데…', koSize: 72 },
  { at: 10.1, img: 'g7.jpg', b: 5, vo: 'm8', voAt: 10.12, ko: '촛불은\n내가 끌게!', koSize: 62, zero: true },
  // 핵심 장면: 「후우~!」 촛불 불꽃이 옆으로 눕고(11.3) → 다 꺼져 연기가 오른다(11.9)
  { at: 11.3, img: 'g8a.jpg', b: 6, vo: 's9', voAt: 11.3, ko: '후우~!', koSize: 84 },
  { at: 11.9, img: 'g8b.jpg', b: 6, vo: '', voAt: 11.9, ko: '후우~!', koSize: 84, cont: true },
  { at: 12.5, img: 'g9.jpg', b: 7, vo: 'm10', voAt: 12.55, ko: '케이크도\n내 거!', koSize: 62, zero: true },
];
// 끝 카드 · 끝 질문(판본 endCard · ask, 선택)이 떠오르는 초 — 마지막 칸(12.5초) 말이 시작된 뒤
export const END_AT = 13.2;
// 효과음(초 · 파일 · 크기) — 바람 · 촛불 꺼짐 · 큰절 · 단계 오름
export const SFX: [number, string, number][] = [
  [1.0, 'pop.wav', 0.18],
  [2.3, 'pop.wav', 0.2],
  [4.4, 'thud.wav', 0.28],
  [6.1, 'sparkle.wav', 0.16],
  [9.3, 'freeze.wav', 0.18],
  [10.1, 'boing.wav', 0.14],
  [11.25, 'wind.wav', 0.5],
  [11.9, 'puff.wav', 0.42],
  [12.5, 'tok.wav', 0.2],
];
