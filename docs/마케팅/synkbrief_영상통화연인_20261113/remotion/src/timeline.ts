// B43 「영상통화까지 한 그 사람」 시간표 — 컷 · 말 · 소리 한 곳(초). 뼈대는 MnUWYBp0a_c(148.9초 · 오마주 「형식만」)의 줄기를 같은 비율 자리로:
// 0초 첫 말(얼굴) · 2~4초마다 얼굴 · 손 · 넓은 판 · 들통은 원본 70% 자리(우리 21.5초 「없는 사람이에요」) · 끝은 손 근접.
// **설계 판 v0.2(11-13 새벽 — 동영상을 받기 전)**: EXT가 png인 동안은 시작 그림으로 박자 · 글자만 본다. 동영상을 받으면 EXT를 mp4로 바꾸고
// start · crop · 대사 초를 받은 영상의 소리 크기 곡선 + 받아쓰기로 다시 잰다.
// 컷마다 그 영상에 든 소리(대사 · 차 안 · 사무실 소리)를 그대로 깐다(audio). 말은 듣는 쪽 그림 위에도 깐다(a = 그 컷 밑에 까는 다른 영상의 소리).
// 동영상은 public/img/*.mp4(git 밖 — 제미나이 앱 동영상 · 막히면 Flow Omni).
export type Crop = { s: number; cx: number; cy: number; ay?: number; push?: { t0: number; t1: number; to: number } }; // push = 컷 안 t0~t1초에 배율을 to배까지 천천히 키운다(다가감)
export type CutT = { from: number; to: number; src: string; start: number; crop: Crop; rate?: number; drift?: number; audio?: number; shade?: number; low?: number; a?: { src: string; start: number; vol?: number } };

const EXT = 'png';
const V = (n: number) => `img/V${n}.${EXT}`;

// hook = 위 표시가 「재연 · 실제 사건을 바탕으로 한 장면이에요」에서 「재연 · 인물 · 상황은 각색」으로 · desk = 경찰서 책상(음악이 빠짐) · taxi = 다시 택시 안 · end = 「SYNK 브리핑」
export const S = { hook: 4.7, desk: 14.5, taxi: 24.0, end: 30.4 };
export const TOTAL_S = 31.2;
// 원본(제미나이 앱 동영상)이 24fps라 편집도 24fps로 굽는다 — 30fps 시간선에 넣으면 5프레임마다 한 장이 겹쳐 떨린다(현장 노트 영상 · 24fps 원본).
export const FPS = 24;

const F: Crop = { s: 1.0, cx: 540, cy: 960 };
export const CUTS: CutT[] = [
  // 기 — 화면을 꽉 채운 폰 속 얼굴이 먼저 말을 건다 → 기사 얼굴 → 넓게(혼자인 택시 안)
  { from: 0, to: 2.3, src: V(1), start: 0.0, crop: F, audio: 1.0, drift: 0.008 },
  { from: 2.3, to: 4.7, src: V(2), start: 0.0, crop: F, audio: 1.0, drift: 0 },
  { from: 4.7, to: 7.0, src: V(3), start: 0.5, crop: F, audio: 0.8, drift: 0.01 },
  // 승 — 「나 믿죠?」 → 망설임과 끄덕임 → 보내는 엄지
  { from: 7.0, to: 10.0, src: V(1), start: 5.0, crop: { s: 1.12, cx: 540, cy: 760 }, audio: 1.0, drift: 0.008 },
  { from: 10.0, to: 12.5, src: V(2), start: 5.5, crop: { s: 1.1, cx: 540, cy: 860 }, audio: 1.0, drift: 0 },
  { from: 12.5, to: 14.5, src: V(4), start: 1.2, crop: F, audio: 0.9, drift: 0 },
  // 전 — 경찰서 책상: 넓게(사진이 놓임) → 기사 얼굴 → 위에서 본 사진 여섯 장(핵심 장면 · 「없는 사람이에요」)
  { from: 14.5, to: 18.5, src: V(5), start: 0.0, crop: F, audio: 1.0, drift: 0 },
  { from: 18.5, to: 20.7, src: V(7), start: 0.5, crop: F, audio: 1.0, drift: 0 },
  { from: 20.7, to: 24.0, src: V(6), start: 1.2, crop: F, audio: 1.0, drift: 0, low: 0 },
  // 결 — 다시 택시 안: 또 걸려 온 그 얼굴 → 엎어 놓은 폰과 손(끝 그림)
  { from: 24.0, to: 27.5, src: V(8), start: 3.0, crop: F, audio: 1.0, drift: 0 },
  { from: 27.5, to: 31.2, src: V(9), start: 0.5, crop: F, audio: 1.0, drift: 0, low: 0 },
];

// 큰 글자 = 말. grey = 화면 속 그 사람의 말(기사 · 수사관 · 해설은 흰). at = 줄마다 뜨는 초(말하는 때). butter = 그 편에서 버터를 쓰는 한 줄(첫 줄).
// 11-13 콘티 검수 반영: 「영상통화까지 한」(보도보다 세던 「매일 영상통화한」을 고침) · 「이번 투자」 · 「돈을 보냈어요」 · 건너뜀마다 작은 글(「몇 달 뒤 · 경찰서」 · 「그 뒤에도 전화는 왔어요」) · 끝 줄에 기관 출처를 붙이지 않는다(우리 말이다)
export const LINES: { lines: string[]; from: number; to: number; grey?: boolean; size?: number; meta?: string; instant?: boolean; at?: number[]; butter?: boolean }[] = [
  { lines: ['영상통화까지 한', '그 사람'], from: 0.0, to: 2.25, size: 100, instant: true, at: [0.0, 0.0] },
  { lines: ['밥은요? 먹었어요?'], from: 2.4, to: 4.6, size: 88 },
  { lines: ['오빠, 나 믿죠?', '이번 투자, 같이 해요'], from: 7.1, to: 9.95, grey: true, size: 88, at: [7.1, 8.4] },
  { lines: ['…알았어요'], from: 11.0, to: 12.45, size: 92 },
  { lines: ['그렇게,', '돈을 보냈어요'], from: 12.6, to: 14.45, size: 92, at: [12.6, 13.0] },
  { lines: ['이분, 아시죠?'], from: 16.3, to: 18.45, size: 92, meta: '몇 달 뒤 · 경찰서' },
  { lines: ['없는 사람', '이에요'], from: 21.4, to: 22.85, size: 112, instant: true, butter: true, at: [21.4, 21.4] },
  { lines: ['남의 사진을 합성해 만든', '가짜 인물이었어요', '경찰이 밝힌 피해자 100여 명'], from: 22.9, to: 27.0, size: 70, meta: '울산경찰청 발표 · 2026년 1월', at: [22.9, 23.9, 25.2] },
  { lines: ['얼굴을 봤어도,', '만난 적 없는 사람에겐', '돈을 보내지 마세요'], from: 27.6, to: 31.15, size: 78, at: [27.6, 28.5, 29.7] },
];

export const VO: { id: string; t: number }[] = [
  { id: 'n1', t: 12.7 }, { id: 'n2', t: 22.9 }, { id: 'n3', t: 27.6 },
];

export const SOUNDS: { t: number; vol: number; src: string; dur?: number }[] = [];
