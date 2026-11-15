// B54 「원생 명단」 시간표 — 컷 · 말 · 소리 한 곳(초). 뼈대는 형식 원본 92mUc9V0eJY(AI 사기 예방 재연 숏드라마 · 39.2초):
// 0.5 훅(우는 얼굴 ↔ 휴대폰 속 상대) · 3.9~7.7 화면 속 요구 · 7.7~13.2 「말하지 마」 통제 · 13.2 이체 화면 · 17.2 조여 옴 · 24.6 문소리 · 25.8 진짜가 들어옴(반전) ·
// 34.0 진짜 앞에서 가짜가 계속(끝 장치) · 37.2 사례 · 지키는 법 글.
// 컷마다 그 영상에 든 소리(대사 · 휴대폰 속 목소리 · 방 소리)를 그대로 깐다(audio). 동영상은 public/img/*.mp4(git 밖 — 제미나이 앱 동영상).
// 첫 판(11-15 08시) — 동영상을 받기 전 설계 초. 받은 판의 받아쓰기로 시작 초를 맞춘다.
export type Crop = { s: number; cx: number; cy: number; ay?: number; push?: { t0: number; t1: number; to: number } };
export type CutT = { from: number; to: number; src: string; start: number; crop: Crop; rate?: number; drift?: number; audio?: number; shade?: number; low?: number; blur?: number; a?: { src: string; start: number; vol?: number } };

// reveal = 반전(경찰관이 들어옴) · stop = 음악을 줄이는 자리 · end = 「SYNK 브리핑」
export const S = { hook: 0, reveal: 24.6, stop: 40.0, end: 40.0 };
export const TOTAL_S = 40.5;
export const FPS = 24;

const F: Crop = { s: 1.0, cx: 540, cy: 960 };
export const CUTS: CutT[] = [
  // 기 — 밤 학원. 원장 근접(V1): 메일 알림 뒤 굳음
  { from: 0.0, to: 1.3, src: 'img/V1.mp4', start: 0.6, crop: F, audio: 1.0, drift: 0 },
  // 메일 접사(V2) — 제목 「원생 명단 갖고 있다」
  { from: 1.3, to: 3.2, src: 'img/V2.mp4', start: 0.5, crop: F, audio: 1.0, drift: 0 },
  // 원장 「우리 애들… 명단을…?」(V1 뒤쪽)
  { from: 3.2, to: 3.9, src: 'img/V1.mp4', start: 3.0, crop: F, audio: 1.0, drift: 0 },
  // 메일 아래 줄 「3일 안에 연락 없으면 / 학부모님들께 보낸다」(V2 뒤쪽)
  { from: 3.9, to: 7.7, src: 'img/V2.mp4', start: 3.0, crop: F, audio: 1.0, drift: 0 },
  // 승 — 휴대폰이 울리고 받음 · 「메일 보셨죠? 경찰에 알리면, 바로 뿌립니다」(V3)
  { from: 7.7, to: 13.2, src: 'img/V3.mp4', start: 0.0, crop: F, audio: 1.0, drift: 0.008 },
  // 송금 화면(V4 앞쪽)
  { from: 13.2, to: 14.7, src: 'img/V4.mp4', start: 0.0, crop: F, audio: 1.0, drift: 0 },
  // 「네… 지금… 보내고 있어요」(V5 앞쪽)
  { from: 14.7, to: 17.2, src: 'img/V5.mp4', start: 0.0, crop: F, audio: 1.0, drift: 0 },
  // 「10분 드릴게요. 안 그러면 단톡방에 올립니다」(V4 뒤쪽)
  { from: 17.2, to: 20.7, src: 'img/V4.mp4', start: 2.0, crop: F, audio: 1.0, drift: 0 },
  // 볼펜 딸깍 · 눈이 문 쪽으로 · 「조금만요… 앱이 느려서요」(V5 뒤쪽)
  { from: 20.7, to: 24.6, src: 'img/V5.mp4', start: 3.5, crop: F, audio: 1.0, drift: 0 },
  // 전 — 문 종 · 경찰관 「신고하신 원장님 맞으시죠?」(V6)
  { from: 24.6, to: 27.5, src: 'img/V6.mp4', start: 0.0, crop: F, audio: 1.0, drift: 0.006 },
  // 핵심 장면(V7): 스피커폰 협박범 → 「근데요, 지금 경찰분이 옆에서 같이 듣고 계세요」 → 뚝
  { from: 27.5, to: 35.0, src: 'img/V7.mp4', start: 0.3, crop: F, audio: 1.0, drift: 0 },
  // 결 — 근거 한 장(흐린 V7 위)
  { from: 35.0, to: 37.2, src: 'img/V7.mp4', start: 7.8, crop: F, drift: 0.01, blur: 22 },
  // 끝 — 같은 두 사람 구도(V9): 「잘하셨어요. 같은 메일 받은 학원이 여러 곳이에요」 · 숨 · 웃음
  { from: 37.2, to: 40.5, src: 'img/V9.mp4', start: 1.5, crop: F, audio: 1.0, drift: 0.006 },
];

// 큰 글자 = 말. grey = 전화 속 남자 · 경찰관의 말(원장은 흰). at = 줄마다 뜨는 초. butter = 그 편에서 버터를 쓰는 한 줄(첫 줄).
export const LINES: { lines: string[]; from: number; to: number; grey?: boolean; size?: number; meta?: string; metaSize?: number; deep?: boolean; instant?: boolean; at?: number[]; butter?: boolean }[] = [
  { lines: ['"원생 명단', '갖고 있다"'], from: 0.25, to: 3.1, size: 104, instant: true, butter: true, meta: '학원 원장에게 온 메일 한 통', metaSize: 46 },
  { lines: ['우리 애들…?'], from: 3.25, to: 3.85, size: 104, instant: true },
  { lines: ['메일 보셨죠?', '경찰에 알리면 바로 뿌립니다'], from: 10.0, to: 13.1, grey: true, size: 84, at: [10.0, 11.2] },
  { lines: ['네… 지금', '보내고 있어요'], from: 14.8, to: 17.1, size: 96, at: [14.8, 15.9] },
  { lines: ['10분 드릴게요', '안 그러면 단톡방에 올립니다'], from: 17.4, to: 20.6, grey: true, size: 84, at: [17.4, 18.6] },
  { lines: ['조금만요…', '앱이 느려서요'], from: 22.0, to: 24.5, size: 96, at: [22.0, 23.0] },
  { lines: ['신고하신 원장님', '맞으시죠?'], from: 25.6, to: 27.4, grey: true, size: 96, instant: true },
  { lines: ['여보세요?', '왜 말이 없어요'], from: 27.7, to: 29.9, grey: true, size: 92 },
  { lines: ['근데요, 지금 경찰분이', '옆에서 같이 듣고 계세요'], from: 31.2, to: 34.9, size: 88, at: [31.2, 32.4] },
  { lines: ['잡고 보니 IT 비전공자', 'AI로 업체 90여 곳을 털었다'], from: 35.05, to: 37.15, size: 84, meta: '서울경찰청 발표 · 2026년 10월 26일', metaSize: 42, deep: true },
  { lines: ['돈은 보내지 말고', '바로 신고'], from: 37.4, to: 40.3, size: 104, meta: '경찰 당부', metaSize: 42 },
];

export const VO: { id: string; t: number }[] = [];

export const SOUNDS: { t: number; vol: number; src: string; dur?: number }[] = [
  // 메일 알림음 — V1 자체 알림음이 작으면 두 음 「띵동」(sfx/알림.wav)을 얹는다
  { t: 0.15, vol: 0.6, src: 'sfx/알림.wav', dur: 24 },
];
