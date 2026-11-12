// B39 「없는 판결」 시간표 — 컷 · 말 · 소리 한 곳(초). 뼈대는 jxtY4RzpaTc(71.5초) 박자 × 0.797(57초 · 오마주 「형식만」 —
// 여는 넓은 한 컷 · 근접 번갈이 · 33% 자리의 넓어짐 · 긴 버팀 · 78%의 반전(의뢰인이 봄) · 97%의 끝 한 방).
// **첫 설계 판 v0.2(11-11 07시 회차 — 동영상을 받기 전 · Fable 검수 반영)**: src의 start · crop · 대사 초는 받은 영상의 소리 크기 곡선 + 받아쓰기로 다시 잰다.
// v0.2: 판사의 지어낸 끝 줄을 빼고 해설로 · 가운데 16초를 줄임(「변호사님…?」 3초 · 기다림 2.6초 · 손 3.4초 · 버팀은 침묵 한 판만) · 끝을 바닥 접사 → 두 사람 두 컷으로(해설 뒤 음악을 끊고).
// 컷마다 그 영상에 든 소리(대사 · 방 소리)를 그대로 깐다(audio). 동영상은 public/img/*.mp4(git 밖 — 제미나이 앱 동영상 · 막히면 Flow Omni).
export type Crop = { s: number; cx: number; cy: number; ay?: number; push?: { t0: number; t1: number; to: number } }; // push = 컷 안 t0~t1초에 배율을 to배까지 천천히 키운다(다가감)
export type CutT = { from: number; to: number; src: string; start: number; crop: Crop; rate?: number; drift?: number; audio?: number; shade?: number; low?: number; a?: { src: string; start: number; vol?: number } };

export const S = { hook: 5.0, hold: 33.8, confess: 36.5, look: 41.0, quiet: 55.3, end: 55.4 };
export const TOTAL_S = 59.7;
// 원본(제미나이 앱 동영상)이 24fps라 편집도 24fps로 굽는다 — 30fps 시간선에 넣으면 5프레임마다 한 장이 겹쳐 떨린다(현장 노트 영상 · 24fps 원본).
export const FPS = 24;

// v8(11-11 밤 — 맹검 기각 둘 · 최종 확인 지적): 굳은 두 사람 판(VC)을 빼고, 올려다보는 컷은 불어나는 마이크가 안 보이게 당기고, 끝은 찌그러지는 의자 접사(VF2) 대신 변호인의 곁눈 → 두 사람. v3(11-11 15시 회차): 컷 자리를 원본 박자 × 0.835에 맞췄다(나란히 v2 — 박자 35% · 반전 · 끝 자리 어긋남). 말은 듣는 사람 위에도 깐다(a = 그 컷 밑에 까는 다른 영상의 소리).
const F: Crop = { s: 1.0, cx: 540, cy: 960 };
const JF: Crop = { s: 1.15, cx: 600, cy: 1080 }; // 판사 판: 얼굴을 화면 가운데로 올린다(맹검 — 얼굴이 아래로 몰림)
export const CUTS: CutT[] = [
  // 기
  { from: 0, to: 0.5, src: 'img/VW2.mp4', start: 0.0, crop: F, drift: 0 },
  { from: 0.5, to: 1.3, src: 'img/VH.mp4', start: 2.5, crop: F, drift: 0, a: { src: 'img/VJ1.mp4', start: 1.1 } },
  { from: 1.3, to: 2.9, src: 'img/VJ1.mp4', start: 1.9, crop: JF, audio: 1.0 },
  { from: 2.9, to: 4.4, src: 'img/VW2.mp4', start: 0.5, crop: F, drift: 0.015, a: { src: 'img/VJ1.mp4', start: 3.5 } },
  { from: 4.4, to: 5.5, src: 'img/VL1.mp4', start: 0.0, crop: F, audio: 1.0 },
  { from: 5.5, to: 7.4, src: 'img/VH.mp4', start: 6.3, crop: F, drift: 0, a: { src: 'img/VL1.mp4', start: 1.1 } },
  { from: 7.4, to: 9.7, src: 'img/VL1.mp4', start: 3.0, crop: F, audio: 1.0 },
  // 승
  { from: 9.7, to: 11.0, src: 'img/VJ1.mp4', start: 5.8, crop: JF, audio: 0.8 },
  { from: 11.0, to: 12.3, src: 'img/VL3.mp4', start: 0.3, crop: F, drift: 0, a: { src: 'img/VJ1.mp4', start: 7.1 } },
  { from: 12.3, to: 14.0, src: 'img/VJ1.mp4', start: 8.4, crop: { s: 1.3, cx: 640, cy: 900 }, audio: 1.0, drift: 0 },
  { from: 14.0, to: 15.9, src: 'img/VH.mp4', start: 0.2, crop: F, audio: 0.8 },
  { from: 15.9, to: 18.4, src: 'img/VL1.mp4', start: 7.2, crop: F, audio: 1.0 },
  { from: 18.4, to: 21.4, src: 'img/VW2.mp4', start: 2.0, crop: F, audio: 0.4, drift: 0.015 },
  { from: 21.4, to: 23.4, src: 'img/VL3.mp4', start: 4.6, crop: F, drift: 0 },
  // 전
  { from: 23.4, to: 25.8, src: 'img/VJ2.mp4', start: 0.6, crop: JF, audio: 1.0 },
  { from: 25.8, to: 27.2, src: 'img/VL2.mp4', start: 0.0, crop: F, a: { src: 'img/VJ2.mp4', start: 3.0 } },
  { from: 27.2, to: 29.6, src: 'img/VJ2.mp4', start: 4.4, crop: JF, audio: 1.0 },
  { from: 29.6, to: 31.9, src: 'img/VL2.mp4', start: 1.4, crop: F, audio: 0.8 },
  { from: 31.9, to: 34.0, src: 'img/VCa.mp4', start: 0.9, crop: F, audio: 1.0 },
  { from: 34.0, to: 35.5, src: 'img/VW2.mp4', start: 5.0, crop: F, audio: 0.4, drift: 0.015 },
  { from: 35.5, to: 39.2, src: 'img/VL2.mp4', start: 3.4, crop: F, audio: 1.0 },
  { from: 39.2, to: 41.0, src: 'img/VJ2.mp4', start: 6.8, crop: JF, a: { src: 'img/VL2.mp4', start: 7.1 } },
  { from: 41.0, to: 44.6, src: 'img/VCa.mp4', start: 5.2, crop: { s: 1.5, cx: 600, cy: 800 }, audio: 0.6, drift: 0 },
  { from: 44.6, to: 46.2, src: 'img/VL2.mp4', start: 7.3, crop: { s: 1.25, cx: 540, cy: 760 }, audio: 0.4, drift: 0 },
  // 결 — 해설 둘 → (음악 끊김) 끝 한 방은 한 판으로: 의뢰인이 의자째 빠져나감 → 곁눈 → 한숨
  { from: 46.2, to: 47.6, src: 'img/VJ2.mp4', start: 8.6, crop: JF, audio: 0.5 },
  { from: 47.6, to: 48.9, src: 'img/VW2.mp4', start: 7.4, crop: F, audio: 0.4, drift: 0.015 },
  { from: 48.9, to: 50.4, src: 'img/VCa.mp4', start: 3.2, crop: F, audio: 0.4, drift: 0 },
  { from: 50.4, to: 52.6, src: 'img/VH.mp4', start: 7.8, crop: F, audio: 0.4 },
  { from: 52.6, to: 54.4, src: 'img/VL3.mp4', start: 7.2, crop: F, audio: 0.4, drift: 0 },
  { from: 54.4, to: 59.7, src: 'img/VE.mp4', start: 0.4, crop: { s: 1.0, cx: 0, cy: 1010, push: { t0: 0.4, t1: 1.5, to: 1.3 } }, audio: 1.0, low: 0, drift: 0 },
];

// 큰 글자 = 말. grey = 변호인 · 의뢰인(판사와 해설은 흰). at = 줄마다 뜨는 초(말하는 때).
// v14(11-12 15시 회차 · GPT 대체 맹검 04 기각): 해설 세 줄 사이 0.1초 틈에 글 없이 위 그늘만 남던 자리를 없앤다 — 앞 줄 끝 = 다음 줄 시작(교차해 바뀜).
export const LINES: { lines: string[]; from: number; to: number; grey?: boolean; size?: number; meta?: string; instant?: boolean; at?: number[]; lead?: boolean }[] = [
  { lines: ['변호인'], from: 0.6, to: 1.3, size: 85, instant: true },
  { lines: ['의견서에 쓰신 판결들,', '어디서 찾으셨습니까?'], from: 1.6, to: 4.35, size: 80, at: [1.6, 3.1] },
  { lines: ['네?', '제가 정리한 판결들입니다만'], from: 4.8, to: 7.35, grey: true, size: 76, at: [4.8, 5.8] },
  { lines: ['우리 변호사님이', '다 찾아오셨어요'], from: 7.6, to: 9.65, grey: true, size: 82 },
  { lines: ['제가 다 찾아봤습니다', '다섯 개가, 하나도 없어요'], from: 11.1, to: 13.95, size: 80, at: [11.1, 12.4] },
  { lines: ['그럴 리가요…', '사건번호까지 다 있는데요'], from: 16.0, to: 18.35, grey: true, size: 78, at: [16.0, 17.1] },
  { lines: ['없는 판결 다섯 개가 법정에 나온 건,', '우리나라에서 실제로 있었던 일이에요'], from: 18.5, to: 22.6, size: 56, meta: '법률신문 2025년 9월 보도', at: [18.5, 20.4] },
  { lines: ['그 번호가,', '없는 번호입니다'], from: 23.7, to: 27.15, size: 80, at: [23.7, 25.8] },
  { lines: ['출처가 어딥니까?'], from: 27.7, to: 29.5, size: 85 },
  { lines: ['변호사님…?'], from: 32.6, to: 33.9, grey: true, size: 85 },
  { lines: ['…AI가,', '찾아 줬습니다'], from: 36.5, to: 40.9, grey: true, size: 96, at: [36.5, 39.1] },
  { lines: ['설문에 답한 판사 셋 중 둘이,', '가짜 판례가 적힌 서류를 받아 봤대요'], from: 46.3, to: 50.2, size: 57, meta: '법원행정처 설문 · 법관 360명 응답 · 2026년 11월', at: [46.3, 47.8] },
  { lines: ['AI는 없는 판결에도', '번호까지 붙여 줘요'], from: 50.2, to: 52.5, size: 82, at: [50.2, 51.1] },
  { lines: ['근거를 대면,', '그 번호부터 직접 찾아보세요'], from: 52.5, to: 55.3, size: 76, meta: '판결은 대법원 사법정보공개포털 「허위 사건번호 확인」', at: [52.5, 53.3] },
];

export const VO: { id: string; t: number }[] = [
  { id: 'n1', t: 18.5 }, { id: 'n2', t: 46.3 }, { id: 'n3', t: 50.2 },
];

export const SOUNDS: { t: number; vol: number; src: string; dur?: number }[] = [];
