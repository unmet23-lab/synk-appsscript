// B60 시간표 — 컷 · 말 · 소리 한 곳(초). 컷 경계는 원본 m4KW26GzoK4의 컷 · 카메라 박(3.8 · 4.4 · 5.5 · 7.3 · 13.4 · 19.2 · 22.3 · 30.0초) × 약 1.13.
// v2(11-21 이해 시험 · 최종본 검사 반영): 0초 훅(축하 넓게) → 4.7초 반전 인서트(폰의 의심 글) → 6.45초 굳는 얼굴 → 8.25초 며칠 뒤 촬영실 →
// 11.2초 고백(12.45초 「제가…」) → 15.5초 대가(밤 사무실 현수막) → 20.1초 녹화가 꺼진 뒤 → 24.8초 끝 3초: 같은 순간을 꽃다발 높이에서 가까이 + 끝 줄.
// 촬영실 세 컷은 사무실과 같은 옷으로 다시 받았다(시험관 둘이 옷이 바뀐 그를 다른 사람으로 봄). 앉는 장면을 줄였다(셋이 12~16초가 늘어진다고 함).
export type Crop = { s: number; cx: number; cy: number; ay?: number; path?: { t: number[]; s?: number[]; cx?: number[]; cy?: number[] } };
export type CutT = { from: number; to: number; src: string; start: number; crop: Crop; drift?: number; audio?: number; d?: number; dPath?: { t: number[]; d: number[] }; land?: boolean; t0?: number };

export const TOTAL_S = 28.8;
export const BGM_B_AT = 15.5;

// ── 한 장면 먼저(장면 심사용 · 5초 — 심사 지적대로 정지 1초를 빼고 손이 들어오는 자리부터) ──
export const SCENE_S = 5.0;
export const SCENE_CUTS: CutT[] = [
  { from: 0, to: 5.0, src: 'img/V5.mp4', start: 2.2, crop: { s: 1.0, cx: 540, cy: 960 }, drift: 0, audio: 1.0 },
];
export const SCENE_SOUNDS: { t: number; vol: number; src: string; dur?: number }[] = [];

const FULL: Crop = { s: 1.0, cx: 540, cy: 960 };
export const CUTS: CutT[] = [
  // 기 — 사무실 박수 속 꽃다발(V1). 현수막 「축 수석 합격」이 큰 글자 아래에 오게 판을 많이 내린다
  { from: 0, to: 4.7, src: 'img/V1.mp4', start: 0.4, crop: FULL, drift: 0.008, audio: 0.9, d: 520 },
  // 반전 인서트 — 폰 화면의 의심 글(P1 = 판/폰_의심c_1). 제목과 댓글 둘을 화면 가운데 띠(800~1210px)에 — 아래 앱 글자 자리(1428px)에 걸리지 않게 다시 구웠다
  { from: 4.7, to: 6.45, src: 'img/P1.png', start: 0, crop: { s: 1.15, cx: 470, cy: 0, ay: 0, path: { t: [0, 1.75], s: [1.15, 1.22] } }, drift: 0, d: 120 },
  // 굳는 얼굴(V2) — 화면을 쓸어 올리고 웃음이 사라짐
  { from: 6.45, to: 8.25, src: 'img/V2.mp4', start: 2.3, crop: { s: 1.12, cx: 540, cy: 860 }, drift: 0.01, audio: 0.8, d: 260 },
  // 전 — 며칠 뒤 촬영실, 카메라 너머로 앉는다(V3)
  { from: 8.25, to: 11.2, src: 'img/V3.mp4', start: 0.6, crop: { s: 1.2, cx: 560, cy: 900 }, drift: 0.006, audio: 0.7, d: 260 },
  // 고백(V4) — 대사는 동영상 속 목소리(src 3.55 「제가」 · 4.8 「AI로…」 · 6.3 끝). 말이 끝나고 0.3초 뒤 끊는다
  { from: 11.2, to: 15.5, src: 'img/V4.mp4', start: 2.3, crop: FULL, drift: 0.004, audio: 1.0, d: 260 },
  // 결 — 밤 빈 사무실, 현수막이 뜯겨 떨어짐(V5 — 한 장면)
  { from: 15.5, to: 20.1, src: 'img/V5.mp4', start: 2.4, crop: FULL, drift: 0.004, audio: 1.0, d: 260 },
  // 녹화가 꺼진 뒤 홀로 남은 그(V7)
  { from: 20.1, to: 24.8, src: 'img/V7.mp4', start: 1.6, crop: FULL, drift: 0.006, audio: 0.5, d: 260 },
  // 끝 3초 — 같은 순간을 꽃다발 높이에서 가까이(V6). V6은 5.5초부터 벽에 현수막이 흐리게 다시 생겨, 벽 윗부분을 빼고 꽃다발과 떨어지는 현수막만 잡는다
  { from: 24.8, to: TOTAL_S, src: 'img/V6.mp4', start: 4.4, crop: { s: 1.35, cx: 540, cy: 1350, ay: 880 }, drift: 0.012, audio: 1.0, d: 260 },
];

export const LINES: { lines: string[]; from: number; to: number; size?: number; at?: number[]; butter?: string; color?: string }[] = [
  { lines: ['평균 30점 과목에서', '혼자 100점,', '세무사 시험 수석'], from: 0, to: 4.65, size: 90, at: [0, 1.56, 2.51] },
  { lines: ['그런데 너무', '완벽한 점수에', '의심이 쏟아졌어요'], from: 4.8, to: 8.2, size: 88, at: [4.8, 5.56, 6.59] },
  { lines: ['며칠 뒤, 본인이 직접', '유튜브 영상에 나와', '털어놨어요'], from: 8.4, to: 11.15, size: 84, at: [8.4, 9.81, 10.66] },
  { lines: ['「제가…', 'AI로 답을 받았습니다」'], from: 12.45, to: 15.45, size: 84, at: [12.45, 13.7], color: 'rgba(214,214,214,0.95)' },
  { lines: ['경찰에 자수서를 냈고', '시험을 맡은 기관도', '그를 고소했어요'], from: 15.65, to: 19.7, size: 84, at: [15.65, 17.28, 18.42] },
  { lines: ['정부는 시험 무효 절차', '올해 국가자격시험도', '전부 다시 조사'], from: 20.2, to: 24.7, size: 82, at: [20.2, 22.29, 23.22] },
  { lines: ['AI로 딴 100점', '남은 건 무효 절차와', '경찰 수사'], from: 24.9, to: TOTAL_S, size: 96, at: [24.9, 26.15, 27.13], butter: '무효' },
];

// 해설(범수) 줄 시작 초 — 줄 길이는 public/vo/<id>.json
export const VO: { id: string; t: number }[] = [
  { id: 'n1', t: 0.1 }, { id: 'n2', t: 4.8 }, { id: 'n3', t: 8.4 }, { id: 'n4', t: 15.65 }, { id: 'n5', t: 20.2 }, { id: 'n6', t: 24.9 },
];

export const SOUNDS: { t: number; vol: number; src: string; dur?: number }[] = [
  { t: 4.68, src: 'sfx/ding.wav', vol: 0.26 },
  { t: 15.52, src: 'sfx/thud.wav', vol: 0.3 },
];
