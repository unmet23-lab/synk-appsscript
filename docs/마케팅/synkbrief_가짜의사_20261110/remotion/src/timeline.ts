// B38 시간표 — 컷 · 말 · 소리 한 곳(초). 뼈대는 VtzxG-Ait0I(65초) 박자 × 약 0.8(오마주 「형식만」 — 첫 한 구성 · 근접 번갈이 · 긴 버팀 칸 · 77% 전환 · 98% 끝 반전).
// 컷마다 그 영상에 든 소리(대사 · 방 소리)를 그대로 깐다(audio). 동영상은 public/img/*.mp4(git 밖 — 제미나이 앱 동영상 77yuhbs 구독 몫).
// 광고 속 의사의 말(A1 · A3)은 그 광고 동영상의 소리를 폰 스피커 결로 깐다(phone: true — 높은 · 낮은 소리를 깎는다).
export type Crop = { s: number; cx: number; cy: number; ay?: number };
export type CutT = { from: number; to: number; src: string; start: number; crop: Crop; rate?: number; drift?: number; audio?: number; ad?: boolean };

export const S = {
  search: 25.9, searchResult: 27.2, searchEnd: 28.7,
  flip: 50.6, end: 51.6,
};
export const TOTAL_S = 54.0;

const FULL: Crop = { s: 1.0, cx: 540, cy: 960 };
export const CUTS: CutT[] = [
  // 기 — 광고 속 의사 → 넓게(식탁의 아버지 · 상자 일곱 · 뒤의 아들) → 아들 가까이 → 아버지 근접 「선생님이 드시래」 → 상자
  { from: 0, to: 1.4, src: 'img/A1.mp4', start: 1.2, crop: FULL, ad: true },
  { from: 1.4, to: 5.0, src: 'img/V1.mp4', start: 0.2, crop: { s: 1.0, cx: 540, cy: 960 }, audio: 0.9, drift: 0.015 },
  { from: 5.0, to: 7.4, src: 'img/V1.mp4', start: 3.8, crop: { s: 1.9, cx: 860, cy: 1030 }, audio: 0.9 },
  { from: 7.4, to: 9.8, src: 'img/V2.mp4', start: 1.6, crop: { s: 1.05, cx: 540, cy: 960 }, audio: 1.0 },
  { from: 9.8, to: 11.2, src: 'img/V2.mp4', start: 4.0, crop: { s: 1.6, cx: 560, cy: 1500, ay: 1100 }, audio: 1.0 },
  // 승 — 「이거 몇 개째예요?」 → 「유명한 선생님이야」 → 「이 선생님, 어느 병원이에요?」 → 「…어디더라」
  { from: 11.2, to: 14.0, src: 'img/V3.mp4', start: 0.3, crop: { s: 1.1, cx: 600, cy: 1000 }, audio: 1.0 },
  { from: 14.0, to: 15.8, src: 'img/V2.mp4', start: 6.6, crop: { s: 1.3, cx: 560, cy: 900 }, audio: 1.0 },
  { from: 15.8, to: 19.5, src: 'img/V3.mp4', start: 4.0, crop: { s: 1.45, cx: 640, cy: 900 }, audio: 1.0 },
  { from: 19.5, to: 22.9, src: 'img/V4.mp4', start: 0.3, crop: { s: 1.05, cx: 540, cy: 980 }, audio: 1.0 },
  // 전 — 찾아봄 → 재연용 검색 화면 「일치하는 결과가 없습니다」 → 「이 얼굴, 아무 데도 없는데요」 → 해설 → 폰을 내려놓음
  { from: 22.9, to: 25.9, src: 'img/V4.mp4', start: 3.4, crop: { s: 1.6, cx: 760, cy: 1150 }, audio: 1.0 },
  { from: 28.7, to: 30.7, src: 'img/V4.mp4', start: 5.6, crop: { s: 1.05, cx: 540, cy: 980 }, audio: 1.0 },
  { from: 30.7, to: 34.6, src: 'img/V4.mp4', start: 7.0, crop: { s: 1.6, cx: 360, cy: 950 }, audio: 0.7, rate: 0.85 },
  { from: 34.6, to: 39.4, src: 'img/V4.mp4', start: 8.2, crop: { s: 1.05, cx: 540, cy: 1000 }, audio: 0.7, rate: 0.5 },
  // 결 — 머쓱한 웃음 → 끝 줄 → 폰이 저절로 켜짐 → 광고 속 의사 2 → 마주 봄 → 엎음 → 웃음
  { from: 39.4, to: 42.0, src: 'img/V5.mp4', start: 0.3, crop: { s: 1.0, cx: 540, cy: 960 }, audio: 1.0 },
  { from: 42.0, to: 46.6, src: 'img/V5.mp4', start: 2.8, crop: { s: 1.45, cx: 760, cy: 940 }, audio: 1.0 },
  { from: 46.6, to: 48.0, src: 'img/V6.mp4', start: 0.2, crop: { s: 1.0, cx: 540, cy: 1000 }, audio: 0.5 },
  { from: 48.0, to: 49.4, src: 'img/A3.mp4', start: 0.4, crop: FULL, ad: true },
  { from: 49.4, to: 50.6, src: 'img/V6.mp4', start: 2.6, crop: { s: 1.35, cx: 540, cy: 900 }, audio: 0.9 },
  { from: 50.6, to: 51.6, src: 'img/V6.mp4', start: 4.6, crop: { s: 1.0, cx: 540, cy: 1000 }, audio: 1.0 },
  { from: 51.6, to: 54.0, src: 'img/V6.mp4', start: 5.6, crop: { s: 1.12, cx: 540, cy: 960 }, audio: 1.0, drift: 0.008 },
];

// 큰 글자 = 말. grey = 아들(두 사람 말은 흰 · 회색으로만 가른다). 광고 속 의사의 말은 흰 글자에 위 작은 「광고 속 의사」.
export const LINES: { lines: string[]; from: number; to: number; grey?: boolean; size?: number; meta?: string; instant?: boolean }[] = [
  { lines: ['하루 두 알이면,', '몸이 거꾸로 젊어집니다'], from: 0, to: 3.3, size: 88, instant: true, meta: '광고 속 의사' },
  { lines: ['저도 매일', '두 알씩 먹습니다'], from: 4.25, to: 6.5, size: 96, meta: '광고 속 의사' },
  { lines: ['선생님이 드시래', '하루 두 알'], from: 7.6, to: 9.8, size: 100 },
  { lines: ['아버지,', '이거 몇 개째예요?'], from: 11.5, to: 13.9, grey: true, size: 100 },
  { lines: ['유명한 선생님이야'], from: 14.1, to: 15.7, size: 100 },
  { lines: ['이 선생님,', '어느 병원이에요?'], from: 16.6, to: 19.3, grey: true, size: 112 },
  { lines: ['…어디더라', '유튜브에 맨날 나오시는 분인데'], from: 19.7, to: 22.8, size: 84 },
  { lines: ['…이 얼굴,', '아무 데도 없는데요'], from: 28.8, to: 30.6, grey: true, size: 100 },
  { lines: ['그 의사, 사람이 아니었어요', 'AI로 만든 가상 인물이었어요'], from: 30.8, to: 34.5, size: 80 },
  { lines: ['아버지만 산 게 아니었어요'], from: 34.7, to: 36.0, size: 84 },
  { lines: ['아홉 달 동안 65만 개,', '81억 원어치가 팔렸어요'], from: 36.1, to: 39.3, size: 88, meta: '식약처 발표 · 2026년 6월' },
  { lines: ['허허…', '비싼 거 아니야'], from: 39.6, to: 41.9, size: 100 },
  { lines: ['저도 몰랐는데,', '의사가 권하는 영양제 광고는', '원래 안 되는 거래요'], from: 42.1, to: 46.5, grey: true, size: 80 },
  { lines: ['안녕하세요,', '삼십 년 차 약사입니다'], from: 46.8, to: 49.3, size: 96, meta: '다음 광고' },
];

export const VO: { id: string; t: number }[] = [
  { id: 'n1', t: 30.75 }, { id: 'n2', t: 34.65 }, { id: 'n3', t: 36.1 },
];

export const SOUNDS: { t: number; vol: number; src: string; dur?: number }[] = [
  { t: 50.62, src: 'sfx/tok.wav', vol: 0.34 },
];

// 광고 소리(폰 스피커 결): 광고 동영상의 소리를 그 초부터 깐다 — A1은 0초부터 c03 끝까지, A3(같은 얼굴 · 약사)는 c16부터 마주 보는 c18 첫머리까지
export const AD_AUDIO: { src: string; from: number; to: number; start: number; vol: number }[] = [
  { src: 'img/A1.mp4', from: 0, to: 6.6, start: 1.2, vol: 0.9 },
  { src: 'img/A3.mp4', from: 46.6, to: 50.0, start: 0.0, vol: 0.85 },
];
