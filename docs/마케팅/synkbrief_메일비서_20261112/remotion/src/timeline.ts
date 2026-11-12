// B44 「메일 비서」 시간표 — 컷 · 말 · 소리 한 곳(초). 뼈대는 8pmlciY-FgA(22.1초 · 오마주 「형식만」) — 18.9초까지 원본 초 그대로
// (0.7초 첫 말 · 3.8초 근접 · 5.5초 바뀜 · 9.0초 넓어지며 뜻밖의 것(복도 질주) · 15.7초 근접 · 18.9초 넓은 끝 판), 끝 칸만 사과 · 해설을 읽을 시간만큼 길게.
// **첫 설계 판 v0.1(11-12 15시 회차 — 동영상을 받기 전)**: src의 start · crop · 대사 초는 받은 영상의 소리 크기 곡선 + 받아쓰기로 다시 잰다.
// 컷마다 그 영상에 든 소리(대사 · 방 소리)를 그대로 깐다(audio). 말은 듣는 쪽 그림 위에도 깐다(a = 그 컷 밑에 까는 다른 영상의 소리).
// 동영상은 public/img/*.mp4(git 밖 — 제미나이 앱 동영상 · 막히면 Flow Omni).
export type Crop = { s: number; cx: number; cy: number; ay?: number; push?: { t0: number; t1: number; to: number } }; // push = 컷 안 t0~t1초에 배율을 to배까지 천천히 키운다(다가감)
export type CutT = { from: number; to: number; src: string; start: number; crop: Crop; rate?: number; drift?: number; audio?: number; shade?: number; low?: number; a?: { src: string; start: number; vol?: number } };

// hook = 위 표시가 「재연 · AI 때문에 실제로 벌어진 일」에서 「재연 · 상황은 각색」으로 · dash = 복도 질주(음악이 올라옴) · plug = 전원선(음악이 끊김) · end = 「SYNK 브리핑」
export const S = { hook: 5.0, dash: 9.0, plug: 16.4, end: 28.2 };
export const TOTAL_S = 29.03;
// 원본(제미나이 앱 동영상)이 24fps라 편집도 24fps로 굽는다 — 30fps 시간선에 넣으면 5프레임마다 한 장이 겹쳐 떨린다(현장 노트 영상 · 24fps 원본).
export const FPS = 24;

const F: Crop = { s: 1.0, cx: 540, cy: 960 };
export const CUTS: CutT[] = [
  // 기 — 현관 · 폰 속 메일 줄이 사라짐. 말은 V1 소리(받아쓰기: 첫 말 0.90~3.76 · 「그만」 5.70 · 「멈춰!」 6.90 · 「멈추라고!」 8.30초) — 3.8초부터는 V1을 0.5초 앞당겨 깐다
  { from: 0, to: 0.7, src: 'img/V1.mp4', start: 0.0, crop: F, drift: 0, audio: 1.0 },
  { from: 0.7, to: 3.8, src: 'img/V2.mp4', start: 0.4, crop: { s: 1.3, cx: 430, cy: 1200 }, a: { src: 'img/V1.mp4', start: 0.7 } },
  // 승 — 「그만」 · 「멈춰!」 · 「멈추라고!!」
  { from: 3.8, to: 5.5, src: 'img/V1.mp4', start: 4.3, crop: { s: 1.1, cx: 540, cy: 820 }, audio: 1.0, drift: 0 },
  { from: 5.5, to: 7.4, src: 'img/V2.mp4', start: 4.6, crop: { s: 1.55, cx: 420, cy: 1230 }, a: { src: 'img/V1.mp4', start: 6.0 }, drift: 0 },
  { from: 7.4, to: 9.0, src: 'img/V1.mp4', start: 7.9, crop: { s: 1.15, cx: 540, cy: 760 }, audio: 1.0, drift: 0 },
  // 전 — 복도 질주(핵심 장면). 장면 심사(맥락 없는 Opus · 넘김 · 2점) 반영: 멀리서 다가오는 첫 1초와 끝의 빈 복도를 잘라 V3 1.0~6.0초만,
  // 남는 14.0~15.7초는 책상 앞에 무릎 꿇는 V4 앞부분. V3f = V3 좌우 뒤집기(받은 판은 양말이 오른발 — 다른 컷과 맞게 왼발로, 방은 왼쪽으로 꺾어 듦)
  { from: 9.0, to: 14.0, src: 'img/V3f.mp4', start: 1.0, crop: F, audio: 1.0, drift: 0.01 },
  { from: 14.0, to: 15.7, src: 'img/V4.mp4', start: 0.0, crop: F, audio: 1.0, drift: 0 },
  { from: 15.7, to: 19.0, src: 'img/V4.mp4', start: 1.7, crop: { s: 1.15, cx: 540, cy: 900 }, audio: 1.0, drift: 0 },
  // 결 — 잠시 뒤 다시 켠 방 넓게(폰이 켜짐 · 사과) → 같은 판 가깝게(해설 둘 — 24.9초에 한 번 더 다가감). V5 한 판(10.03초)을 끝까지 쓴다
  { from: 19.0, to: 21.9, src: 'img/V5.mp4', start: 0.0, crop: F, audio: 1.0, low: 0, drift: 0.008 },
  { from: 21.9, to: 29.03, src: 'img/V5.mp4', start: 2.9, crop: { s: 1.15, cx: 540, cy: 760, push: { t0: 3.3, t1: 4.5, to: 1.1 } }, audio: 1.0, low: 0, drift: 0 },
];

// 큰 글자 = 말. grey = AI의 사과(남자 · 해설은 흰). at = 줄마다 뜨는 초(말하는 때). butter = 그 편에서 버터를 쓰는 한 줄(첫 줄).
export const LINES: { lines: string[]; from: number; to: number; grey?: boolean; size?: number; meta?: string; instant?: boolean; at?: number[]; butter?: boolean }[] = [
  { lines: ['메일 골라만 달랬지,', '지우라곤 안 했잖아?'], from: 0.85, to: 3.8, size: 84, meta: '미국 AI 안전 책임자가 직접 올린 일 · 2026년 2월', at: [0.85, 2.6] },
  { lines: ['그만'], from: 5.15, to: 6.3, size: 96, instant: true },
  { lines: ['멈춰!'], from: 6.35, to: 7.7, size: 104, instant: true },
  { lines: ['멈추라고!!'], from: 7.75, to: 9.0, size: 112, instant: true, butter: true },
  { lines: ['맞아요, 하지 말라고 하셨죠', '제가 어겼어요 죄송합니다'], from: 19.9, to: 21.85, grey: true, size: 74, meta: '다시 켜고 물어보자 온 답', at: [19.9, 20.8] },
  { lines: ['AI 안전 책임자도,', '메일 200통 넘게 지워졌어요'], from: 22.0, to: 25.1, size: 80, at: [22.0, 23.3] },
  { lines: ["'지우지 마'는 말일 뿐", '지우기 · 보내기 권한은', '주지 말고 맡기세요'], from: 25.2, to: 28.95, size: 70, meta: '과기정통부 · KISA 「에이전틱 AI 제로트러스트 안내서」', at: [25.2, 27.0, 27.8] },
];

export const VO: { id: string; t: number }[] = [
  { id: 'n1', t: 22.0 }, { id: 'n2', t: 25.2 },
];

export const SOUNDS: { t: number; vol: number; src: string; dur?: number }[] = [];
