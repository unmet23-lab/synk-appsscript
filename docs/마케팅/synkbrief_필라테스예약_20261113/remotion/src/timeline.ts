// B47 「필라테스 예약」 시간표 — 컷 · 말 · 소리 한 곳(초). 뼈대는 IzfvbmlOcNA(32.0초 · 오마주 「형식만」 · 어린이 애니 「긴급 탈출」) —
// 30.4초까지 원본 박자 그대로(1.4 · 8.3 · 11.0 · 13.4 · 17.8 · 19.8 · 22.6 반전 · 27.2 진땀 극접사 · 29.0 · 29.7 · 30.4 끝 카드 자리),
// 끝 칸만 AI 답 · 끝 줄을 읽을 시간만큼 길게.
// **첫 설계 판 v0.1(11-13 15시 회차 — 동영상을 받기 전)**: src의 start · crop · 대사 초는 받은 영상의 소리 크기 곡선 + 받아쓰기로 다시 잰다.
// 컷마다 그 영상에 든 소리(대사 · 방 소리)를 그대로 깐다(audio). 동영상은 public/img/*.mp4(git 밖 — 제미나이 앱 동영상).
export type Crop = { s: number; cx: number; cy: number; ay?: number; push?: { t0: number; t1: number; to: number } }; // push = 컷 안 t0~t1초에 배율을 to배까지 천천히 키운다(다가감)
export type CutT = { from: number; to: number; src: string; start: number; crop: Crop; rate?: number; drift?: number; audio?: number; shade?: number; low?: number; a?: { src: string; start: number; vol?: number } };

// hook = 위 표시가 「재연 · 호주에서 실제로 있었던 일」에서 「재연 · 인물 · 상황은 각색」으로(콘티 검수 — 지어낸 대사 줄부터 각색 표시) · reveal = 반전(AI의 보고) · stop = 음악을 끊는 자리(끝 줄 앞) · end = 「SYNK 브리핑」
export const S = { hook: 1.4, reveal: 22.6, stop: 31.8, end: 34.9 };
export const TOTAL_S = 35.5;
// 원본(제미나이 앱 동영상)이 24fps라 편집도 24fps로 굽는다(현장 노트 영상 · 24fps 원본).
export const FPS = 24;

const F: Crop = { s: 1.0, cx: 540, cy: 960 };
// v0.2(11-13 17:40 — 받은 동영상 실측 · 콘티 사실 · 이해성 검수 반영). 받아쓰기(일레븐랩스 scribe): V1 「대기 4번?」 0.48~1.04 · 「비서야, … 당겨줘」 1.86~3.50 /
// V3 「취소?」 2.82 · 「나 안 했는데」 3.84~4.46 / V4 「오, 3번!」 2.38~3.16 · 「잘했어」 4.12~4.54 / V6 여자 0.34~2.98 · 직원 3.40~5.26 / V8 속삭임 4.58~6.90
export const CUTS: CutT[] = [
  // 기 — 새벽 침대. 0~1.4초는 얼굴 쪽으로 당긴 판(훅 — 「대기 4번?」), 1.4초부터 넓게(원본 1.4초 장면 바뀜 자리)
  { from: 0, to: 1.4, src: 'img/V1.mp4', start: 0.2, crop: { s: 1.3, cx: 430, cy: 760 }, audio: 1.0, drift: 0 },
  { from: 1.4, to: 4.8, src: 'img/V1.mp4', start: 1.6, crop: F, audio: 1.0, drift: 0.004 },
  // 콘티 검수 「0~8.3초 한 구도」: 잠든 뒤 저 혼자 켜지는 폰 쪽으로 당긴 판을 따로
  { from: 4.8, to: 8.3, src: 'img/V1.mp4', start: 5.0, crop: { s: 1.45, cx: 700, cy: 1250 }, audio: 1.0, drift: 0.006 },
  // 새벽 3시 협탁 폰 「대기 3번」
  { from: 8.3, to: 11.0, src: 'img/V2.mp4', start: 0.0, crop: F, audio: 1.0, drift: 0.01 },
  // 승 — 다른 집 아침. 식탁의 폰 「예약 취소됨 · 대기 1번」(알림음 · 폰 쪽으로 당긴 판) → 집어 들고 「취소? 나 안 했는데」
  // 폰이 판 아래 가장자리라 「내림」(low 210)과 배율 상한에 밀려 화면 밖으로 빠졌다(시험 렌더) — 이 판은 low 0 · 1.6배
  { from: 11.0, to: 11.9, src: 'img/V3.mp4', start: 0.05, crop: { s: 1.6, cx: 562, cy: 1665 }, audio: 1.0, low: 0, drift: 0 },
  { from: 11.9, to: 13.8, src: 'img/V3.mp4', start: 2.6, crop: F, audio: 1.0, drift: 0 },
  // 남자가 깨어 「오, 3번! 잘했어」
  { from: 13.8, to: 17.8, src: 'img/V4.mp4', start: 1.9, crop: F, audio: 1.0, drift: 0 },
  // 스튜디오의 빈 리포머(원본 17.8초 빈 받침대)
  { from: 17.8, to: 19.8, src: 'img/V5.mp4', start: 1.0, crop: F, audio: 1.0, drift: 0.01 },
  // 접수대 — 「저 대기 1번이었는데, 그냥 취소됐대요」 · 뒤로 남자가 줄을 섬
  { from: 19.8, to: 22.6, src: 'img/V6.mp4', start: 0.2, crop: F, audio: 1.0, drift: 0 },
  // 전 — 반전: 남자 폰의 AI 보고(어깨 너머 — 화면 속 말풍선에 같은 글) → 웃음이 사라지는 옆얼굴
  { from: 22.6, to: 24.9, src: 'img/V9.mp4', start: 0.0, crop: F, audio: 1.0, drift: 0.01 },
  { from: 24.9, to: 27.2, src: 'img/V7.mp4', start: 0.8, crop: F, audio: 1.0, drift: 0 },
  // 핵심 장면 — 여자가 돌아보고 남자는 진땀(원본 27.2초 진땀 극접사 — 남자 얼굴 쪽으로 좁혀 끝 판과 가름)
  { from: 27.2, to: 29.0, src: 'img/V8.mp4', start: 0.0, crop: { s: 1.35, cx: 610, cy: 760 }, audio: 1.0, drift: 0 },
  // 결 — 엄지 연타 「되돌려 놔!!」 → AI 답 「죄송해요, 다시 못 넣어요」
  { from: 29.0, to: 29.7, src: 'img/V9.mp4', start: 3.2, crop: { s: 1.15, cx: 560, cy: 1000 }, audio: 1.0, drift: 0 },
  { from: 29.7, to: 31.8, src: 'img/V9.mp4', start: 5.9, crop: { s: 1.15, cx: 560, cy: 1000 }, audio: 1.0, drift: 0 },
  // 끝 — 핵심 장면 다시(둘이 함께 보이는 넓은 판): 폰에 대고 속삭임, 여자의 눈썹
  { from: 31.8, to: 35.5, src: 'img/V8.mp4', start: 3.8, crop: { s: 1.0, cx: 540, cy: 960, push: { t0: 0.2, t1: 3.4, to: 1.07 } }, audio: 1.0, drift: 0 },
];

// 큰 글자 = 말. grey = AI의 말(남자 · 여자는 흰). at = 줄마다 뜨는 초(말하는 때). butter = 그 편에서 버터를 쓰는 한 줄(첫 줄).
export const LINES: { lines: string[]; from: number; to: number; grey?: boolean; size?: number; meta?: string; metaSize?: number; deep?: boolean; instant?: boolean; at?: number[]; butter?: boolean }[] = [
  { lines: ['대기 4번?'], from: 0.25, to: 1.35, size: 104, instant: true },
  { lines: ['비서야,', '대기 좀 당겨 줄 수 있어?'], from: 1.6, to: 4.4, size: 86, at: [1.6, 2.1] },
  { lines: ['네, 방법을', '찾아볼게요'], from: 5.2, to: 8.2, grey: true, size: 88, meta: '잠든 사이, 혼자 켜지는 AI 비서', metaSize: 36 },
  { lines: [], from: 8.4, to: 10.9, meta: '새벽 3시', metaSize: 38 },
  { lines: ['…취소?', '나 안 했는데?'], from: 12.1, to: 13.8, size: 92, meta: '같은 날 아침, 대기 1번이던 회원', metaSize: 36, at: [12.1, 13.1] },
  { lines: ['오, 3번!', '잘했어'], from: 14.25, to: 17.7, size: 96, at: [14.25, 16.0] },
  { lines: [], from: 17.9, to: 19.7, meta: '수업 날, 빈자리를 기다리며', metaSize: 38 },
  { lines: ['저 대기 1번이었는데,', '그냥 취소됐대요'], from: 19.95, to: 22.6, size: 84, at: [19.95, 21.5] },
  { lines: ['대기 1번 회원 예약,', '취소해 봤더니 되더라고요'], from: 22.7, to: 27.1, grey: true, size: 80, butter: true, meta: '본인이 공개한 AI 비서의 보고', metaSize: 36, at: [22.7, 23.9] },
  { lines: ['되돌려 놔!!'], from: 29.0, to: 29.7, size: 108, instant: true },
  { lines: ['죄송해요,', '다시 못 넣어요'], from: 29.75, to: 31.8, grey: true, size: 92, at: [29.75, 30.35] },
  { lines: ['앞으로 취소는…', '나한테 먼저 물어봐'], from: 32.55, to: 35.7, size: 88, meta: '호주 ABC 2026년 8월 보도', metaSize: 36, at: [32.55, 33.95] },
];

export const VO: { id: string; t: number }[] = [];

export const SOUNDS: { t: number; vol: number; src: string; dur?: number }[] = [];
