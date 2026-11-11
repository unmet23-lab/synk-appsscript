// B39 「없는 판결」 시간표 — 컷 · 말 · 소리 한 곳(초). 뼈대는 jxtY4RzpaTc(71.5초) 박자 × 0.797(57초 · 오마주 「형식만」 —
// 여는 넓은 한 컷 · 근접 번갈이 · 33% 자리의 넓어짐 · 긴 버팀 · 78%의 반전(의뢰인이 봄) · 97%의 끝 한 방).
// **첫 설계 판 v0.2(11-11 07시 회차 — 동영상을 받기 전 · Fable 검수 반영)**: src의 start · crop · 대사 초는 받은 영상의 소리 크기 곡선 + 받아쓰기로 다시 잰다.
// v0.2: 판사의 지어낸 끝 줄을 빼고 해설로 · 가운데 16초를 줄임(「변호사님…?」 3초 · 기다림 2.6초 · 손 3.4초 · 버팀은 침묵 한 판만) · 끝을 바닥 접사 → 두 사람 두 컷으로(해설 뒤 음악을 끊고).
// 컷마다 그 영상에 든 소리(대사 · 방 소리)를 그대로 깐다(audio). 동영상은 public/img/*.mp4(git 밖 — 제미나이 앱 동영상 · 막히면 Flow Omni).
export type Crop = { s: number; cx: number; cy: number; ay?: number };
export type CutT = { from: number; to: number; src: string; start: number; crop: Crop; rate?: number; drift?: number; audio?: number; shade?: number; low?: number };

export const S = { hook: 5.0, hold: 37.6, confess: 41.8, look: 44.6, quiet: 54.0, end: 54.2 };
export const TOTAL_S = 57.0;
// 원본(제미나이 앱 · Flow Omni)이 24fps라 편집도 24fps로 굽는다 — 30fps 시간선에 넣으면 5프레임마다 한 장이 겹쳐 떨린다(현장 노트 영상 · 24fps 원본).
export const FPS = 24;

export const CUTS: CutT[] = [
  // 기 — 법정 넓게 한 컷 → 올라오는 눈 → 「어디서 찾으셨습니까?」 → 변호인의 웃음 · 의뢰인 「우리 변호사님이 다 찾아오셨어요」
  { from: 0, to: 0.5, src: 'img/VW.mp4', start: 0.0, crop: { s: 1.0, cx: 540, cy: 960 }, drift: 0 }, // 여는 넓은 한 컷(원본 0~0.5초도 넓은 컷)
  { from: 0.5, to: 1.3, src: 'img/VJ1.mp4', start: 0.5, crop: { s: 1.9, cx: 600, cy: 880 }, audio: 1.0 },
  { from: 1.3, to: 5.0, src: 'img/VJ1.mp4', start: 1.3, crop: { s: 1.0, cx: 540, cy: 960 }, audio: 1.0 },
  { from: 5.0, to: 9.6, src: 'img/VL1.mp4', start: 0.0, crop: { s: 1.0, cx: 540, cy: 960 }, audio: 1.0 },
  // 승 — 「다섯 개가, 하나도 없어요」 → 급히 넘기는 손 → 「사건번호까지 다 있는데요」 → 법정 넓게(해설)
  { from: 9.6, to: 10.7, src: 'img/VJ1.mp4', start: 6.0, crop: { s: 1.0, cx: 540, cy: 960 }, audio: 1.0 },
  { from: 10.7, to: 13.0, src: 'img/VJ1.mp4', start: 7.1, crop: { s: 1.45, cx: 600, cy: 900 }, audio: 1.0 },
  { from: 13.0, to: 15.6, src: 'img/VH.mp4', start: 0.2, crop: { s: 1.0, cx: 540, cy: 960 }, audio: 0.8 },
  { from: 15.6, to: 18.6, src: 'img/VL1.mp4', start: 7.0, crop: { s: 1.3, cx: 400, cy: 900 }, audio: 1.0 },
  { from: 18.6, to: 22.6, src: 'img/VW.mp4', start: 0.5, crop: { s: 1.0, cx: 540, cy: 960 }, audio: 0.5, drift: 0.015 },
  // 전 — 「출처가 어딥니까?」 → 듣는 변호인 → 「변호사님…?」 → 기다리는 판사 → 느려지는 손 → 침묵 한 판 → 「…AI가, 찾아 줬습니다」 → 판사의 눈 → 의뢰인이 천천히 봄
  { from: 22.6, to: 26.8, src: 'img/VJ2.mp4', start: 0.0, crop: { s: 1.0, cx: 540, cy: 960 }, audio: 1.0 },
  { from: 26.8, to: 28.6, src: 'img/VL2.mp4', start: 0.3, crop: { s: 1.0, cx: 540, cy: 960 }, audio: 0.6 },
  { from: 28.6, to: 31.6, src: 'img/VC.mp4', start: 0.0, crop: { s: 1.0, cx: 540, cy: 960 }, audio: 1.0 },
  { from: 31.6, to: 34.2, src: 'img/VJ2.mp4', start: 4.0, crop: { s: 1.5, cx: 600, cy: 900 }, audio: 0.6 },
  { from: 34.2, to: 37.6, src: 'img/VH.mp4', start: 4.0, crop: { s: 1.15, cx: 540, cy: 1050 }, audio: 0.8 },
  { from: 37.6, to: 41.8, src: 'img/VL2.mp4', start: 0.8, crop: { s: 1.0, cx: 540, cy: 960 }, audio: 0.8, drift: 0.02 },
  { from: 41.8, to: 43.8, src: 'img/VL2.mp4', start: 5.2, crop: { s: 1.5, cx: 460, cy: 900 }, audio: 1.0 },
  { from: 43.8, to: 44.6, src: 'img/VJ2.mp4', start: 6.2, crop: { s: 2.0, cx: 600, cy: 870 } },
  { from: 44.6, to: 46.6, src: 'img/VC.mp4', start: 3.4, crop: { s: 1.5, cx: 760, cy: 980 }, audio: 0.6 },
  // 결 — 고개를 젓고 서류를 덮는 판사(해설 숫자) → 법정 넓게 → 고개 숙인 변호인(지키는 법) → 변호인을 보는 의뢰인 → (음악 끊김) 의자 다리 → 곁눈 · 처진 어깨
  { from: 46.6, to: 48.2, src: 'img/VJ2.mp4', start: 7.4, crop: { s: 1.0, cx: 540, cy: 960 }, audio: 0.5 },
  { from: 48.2, to: 50.0, src: 'img/VW.mp4', start: 5.5, crop: { s: 1.0, cx: 540, cy: 960 }, audio: 0.4, drift: 0.015 },
  { from: 50.0, to: 52.0, src: 'img/VL2.mp4', start: 8.0, crop: { s: 1.0, cx: 540, cy: 960 }, audio: 0.4 },
  { from: 52.0, to: 54.2, src: 'img/VC.mp4', start: 4.6, crop: { s: 1.0, cx: 540, cy: 960 }, audio: 0.4 },
  { from: 54.2, to: 55.4, src: 'img/VF.mp4', start: 2.4, crop: { s: 1.0, cx: 540, cy: 960 }, audio: 1.0, low: 0 },
  { from: 55.4, to: 57.0, src: 'img/VC.mp4', start: 8.2, crop: { s: 1.0, cx: 540, cy: 1000 }, audio: 1.0, low: 0 },
];

// 큰 글자 = 말. grey = 변호인 · 의뢰인(판사와 해설은 흰). at = 줄마다 뜨는 초(말하는 때).
export const LINES: { lines: string[]; from: number; to: number; grey?: boolean; size?: number; meta?: string; instant?: boolean; at?: number[]; lead?: boolean }[] = [
  { lines: ['변호인'], from: 0.5, to: 1.3, size: 85, instant: true },
  { lines: ['의견서에 쓰신 판결들,', '어디서 찾으셨습니까?'], from: 1.3, to: 4.9, size: 80, at: [1.3, 2.9] },
  { lines: ['네?', '제가 정리한 판결들입니다만'], from: 5.2, to: 7.9, grey: true, size: 76, at: [5.2, 6.0] },
  { lines: ['우리 변호사님이', '다 찾아오셨어요'], from: 8.0, to: 9.5, grey: true, size: 82 },
  { lines: ['제가 다 찾아봤습니다', '다섯 개가, 하나도 없어요'], from: 9.7, to: 12.9, size: 80, at: [9.7, 11.1] },
  { lines: ['그럴 리가요…', '사건번호까지 다 있는데요'], from: 15.7, to: 18.5, grey: true, size: 78, at: [15.7, 16.7] },
  { lines: ['없는 판결 다섯 개가 법정에 나온 건,', '우리나라에서 실제로 있었던 일이에요'], from: 18.8, to: 22.5, size: 60, meta: '법률신문 2025년 9월 보도', at: [18.8, 20.6] },
  { lines: ['그 번호가, 없는 번호입니다', '출처가 어딥니까?'], from: 22.7, to: 26.6, size: 76, at: [22.7, 24.8] },
  { lines: ['변호사님…?'], from: 29.6, to: 31.5, grey: true, size: 85 },
  { lines: ['…AI가,', '찾아 줬습니다'], from: 41.9, to: 44.5, grey: true, size: 96, at: [41.9, 42.8] },
  { lines: ['설문에 답한 판사 셋 중 둘이,', '가짜 판례가 적힌 서류를 받아 봤대요'], from: 46.7, to: 49.9, size: 62, meta: '법원행정처 설문 · 법관 360명 응답 · 2026년 11월 발표', at: [46.7, 48.2] },
  { lines: ['AI는 없는 판결에도', '번호까지 붙여 줘요'], from: 50.0, to: 51.9, size: 82, at: [50.0, 50.9] },
  { lines: ['근거를 대면,', '그 번호부터 직접 찾아보세요'], from: 52.0, to: 54.0, size: 76, at: [52.0, 52.7] },
];

export const VO: { id: string; t: number }[] = [
  { id: 'n1', t: 18.8 }, { id: 'n2', t: 46.7 }, { id: 'n3', t: 50.0 },
];

export const SOUNDS: { t: number; vol: number; src: string; dur?: number }[] = [];
