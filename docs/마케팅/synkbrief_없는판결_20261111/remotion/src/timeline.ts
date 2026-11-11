// B39 「없는 판결」 시간표 — 컷 · 말 · 소리 한 곳(초). 뼈대는 jxtY4RzpaTc(71.5초) 박자 × 0.797(57초 · 오마주 「형식만」 —
// 여는 넓은 한 컷 · 근접 번갈이 · 33% 자리의 넓어짐 · 긴 버팀 · 78%의 반전(의뢰인이 봄) · 97%의 끝 한 방).
// **첫 설계 판 v0.2(11-11 07시 회차 — 동영상을 받기 전 · Fable 검수 반영)**: src의 start · crop · 대사 초는 받은 영상의 소리 크기 곡선 + 받아쓰기로 다시 잰다.
// v0.2: 판사의 지어낸 끝 줄을 빼고 해설로 · 가운데 16초를 줄임(「변호사님…?」 3초 · 기다림 2.6초 · 손 3.4초 · 버팀은 침묵 한 판만) · 끝을 바닥 접사 → 두 사람 두 컷으로(해설 뒤 음악을 끊고).
// 컷마다 그 영상에 든 소리(대사 · 방 소리)를 그대로 깐다(audio). 동영상은 public/img/*.mp4(git 밖 — 제미나이 앱 동영상 · 막히면 Flow Omni).
export type Crop = { s: number; cx: number; cy: number; ay?: number };
export type CutT = { from: number; to: number; src: string; start: number; crop: Crop; rate?: number; drift?: number; audio?: number; shade?: number; low?: number };

export const S = { hook: 5.0, hold: 32.4, confess: 39.9, look: 44.2, quiet: 55.7, end: 55.9 };
export const TOTAL_S = 59.7;
// 원본(제미나이 앱 동영상)이 24fps라 편집도 24fps로 굽는다 — 30fps 시간선에 넣으면 5프레임마다 한 장이 겹쳐 떨린다(현장 노트 영상 · 24fps 원본).
export const FPS = 24;

// v1(11-11 15시 회차 — 받은 영상의 소리 크기 곡선 · 받아쓰기로 다시 잼). 침묵 한 판은 한 앵글로 끌지 않고 변호인 → 기다리는 판사 → 느려지는 손 → 변호인(고백)으로 쪼갰다.
export const CUTS: CutT[] = [
  // 기
  { from: 0, to: 0.5, src: 'img/VW2.mp4', start: 0.2, crop: { s: 1.0, cx: 540, cy: 960 }, drift: 0 },
  { from: 0.5, to: 1.3, src: 'img/VJ1.mp4', start: 1.1, crop: { s: 1.7, cx: 600, cy: 800 }, audio: 1.0, drift: 0 },
  { from: 1.3, to: 5.0, src: 'img/VJ1.mp4', start: 1.9, crop: { s: 1.0, cx: 540, cy: 960 }, audio: 1.0 },
  { from: 5.0, to: 10.0, src: 'img/VL1.mp4', start: 0.4, crop: { s: 1.0, cx: 540, cy: 960 }, audio: 1.0 },
  // 승
  { from: 10.0, to: 10.9, src: 'img/VJ1.mp4', start: 5.75, crop: { s: 1.0, cx: 540, cy: 960 }, audio: 0.8 },
  { from: 10.9, to: 14.2, src: 'img/VJ1.mp4', start: 6.65, crop: { s: 1.3, cx: 640, cy: 900 }, audio: 1.0 },
  { from: 14.2, to: 16.8, src: 'img/VH.mp4', start: 0.2, crop: { s: 1.0, cx: 540, cy: 960 }, audio: 0.8 },
  { from: 16.8, to: 19.5, src: 'img/VL1.mp4', start: 7.2, crop: { s: 1.0, cx: 540, cy: 960 }, audio: 1.0 },
  { from: 19.5, to: 23.7, src: 'img/VW2.mp4', start: 0.7, crop: { s: 1.0, cx: 540, cy: 960 }, audio: 0.4, drift: 0.015 },
  // 전
  { from: 23.7, to: 27.2, src: 'img/VJ2.mp4', start: 0.7, crop: { s: 1.0, cx: 540, cy: 960 }, audio: 1.0 },
  { from: 27.2, to: 28.1, src: 'img/VL2.mp4', start: 0.3, crop: { s: 1.0, cx: 540, cy: 960 }, audio: 0.6 },
  { from: 28.1, to: 29.4, src: 'img/VJ2.mp4', start: 4.75, crop: { s: 1.0, cx: 540, cy: 960 }, audio: 1.0 },
  { from: 29.4, to: 32.4, src: 'img/VCa.mp4', start: 0.2, crop: { s: 1.0, cx: 540, cy: 960 }, audio: 1.0 },
  { from: 32.4, to: 34.4, src: 'img/VL2.mp4', start: 1.2, crop: { s: 1.0, cx: 540, cy: 960 }, audio: 0.8 },
  { from: 34.4, to: 36.3, src: 'img/VJ2.mp4', start: 6.1, crop: { s: 1.0, cx: 540, cy: 960 }, audio: 0.6 },
  { from: 36.3, to: 38.9, src: 'img/VH.mp4', start: 4.0, crop: { s: 1.0, cx: 540, cy: 960 }, audio: 0.8 },
  { from: 38.9, to: 43.4, src: 'img/VL2.mp4', start: 3.4, crop: { s: 1.0, cx: 540, cy: 960 }, audio: 1.0 },
  { from: 43.4, to: 44.2, src: 'img/VJ2.mp4', start: 8.0, crop: { s: 1.0, cx: 540, cy: 960 } },
  { from: 44.2, to: 47, src: 'img/VCa.mp4', start: 5.6, crop: { s: 1.0, cx: 540, cy: 960 }, audio: 0.6 },
  // 결
  { from: 47, to: 48.3, src: 'img/VJ2.mp4', start: 8.7, crop: { s: 1.0, cx: 540, cy: 960 }, audio: 0.5 },
  { from: 48.3, to: 50.8, src: 'img/VW2.mp4', start: 6.0, crop: { s: 1.0, cx: 540, cy: 960 }, audio: 0.4, drift: 0.015 },
  { from: 50.8, to: 53, src: 'img/VL2.mp4', start: 7.8, crop: { s: 1.0, cx: 540, cy: 960 }, audio: 0.4 },
  { from: 53, to: 55.9, src: 'img/VCb.mp4', start: 0.0, crop: { s: 1.0, cx: 540, cy: 960 }, audio: 0.4 },
  { from: 55.9, to: 57.3, src: 'img/VF2.mp4', start: 1.2, crop: { s: 1.0, cx: 540, cy: 960 }, audio: 1.0, low: 0 },
  { from: 57.3, to: 59.7, src: 'img/VCb.mp4', start: 6.0, crop: { s: 1.0, cx: 540, cy: 960 }, audio: 1.0, low: 0 },
];

// 큰 글자 = 말. grey = 변호인 · 의뢰인(판사와 해설은 흰). at = 줄마다 뜨는 초(말하는 때).
export const LINES: { lines: string[]; from: number; to: number; grey?: boolean; size?: number; meta?: string; instant?: boolean; at?: number[]; lead?: boolean }[] = [
  { lines: ['변호인'], from: 0.6, to: 1.3, size: 85, instant: true },
  { lines: ['의견서에 쓰신 판결들,', '어디서 찾으셨습니까?'], from: 1.6, to: 4.9, size: 80, at: [1.6, 3.1] },
  { lines: ['네?', '제가 정리한 판결들입니다만'], from: 5.1, to: 7.7, grey: true, size: 76, at: [5.1, 6.0] },
  { lines: ['우리 변호사님이', '다 찾아오셨어요'], from: 7.85, to: 9.95, grey: true, size: 82 },
  { lines: ['제가 다 찾아봤습니다', '다섯 개가, 하나도 없어요'], from: 11.4, to: 14.15, size: 80, at: [11.4, 12.8] },
  { lines: ['그럴 리가요…', '사건번호까지 다 있는데요'], from: 17.0, to: 19.45, grey: true, size: 78, at: [17.0, 18.1] },
  { lines: ['없는 판결 다섯 개가 법정에 나온 건,', '우리나라에서 실제로 있었던 일이에요'], from: 19.6, to: 23.6, size: 60, meta: '법률신문 2025년 9월 보도', at: [19.6, 21.5] },
  { lines: ['그 번호가, 없는 번호입니다'], from: 23.9, to: 27.1, size: 76 },
  { lines: ['출처가 어딥니까?'], from: 28.2, to: 29.35, size: 85 },
  { lines: ['변호사님…?'], from: 29.8, to: 32.3, grey: true, size: 85 },
  { lines: ['…AI가,', '찾아 줬습니다'], from: 39.9, to: 43.3, grey: true, size: 96, at: [39.9, 42.5] },
  { lines: ['설문에 답한 판사 셋 중 둘이,', '가짜 판례가 적힌 서류를 받아 봤대요'], from: 47, to: 50.7, size: 62, meta: '법원행정처 설문 · 법관 360명 응답 · 2026년 11월 발표', at: [47, 48.5] },
  { lines: ['AI는 없는 판결에도', '번호까지 붙여 줘요'], from: 50.8, to: 52.9, size: 82, at: [50.8, 51.7] },
  { lines: ['근거를 대면,', '그 번호부터 직접 찾아보세요'], from: 53, to: 55.7, size: 76, at: [53, 53.8] },
];

export const VO: { id: string; t: number }[] = [
  { id: 'n1', t: 19.6 }, { id: 'n2', t: 47 }, { id: 'n3', t: 50.8 },
];

export const SOUNDS: { t: number; vol: number; src: string; dur?: number }[] = [];
