// B54 「원생 명단」 시간표 — 컷 · 말 · 소리 한 곳(초). 뼈대는 형식 원본 92mUc9V0eJY(AI 사기 예방 재연 숏드라마 · 39.2초):
// 0.5 훅(우는 얼굴 ↔ 휴대폰 속 상대) · 3.9~7.7 화면 속 요구 · 7.7~13.2 「말하지 마」 통제 · 13.2 이체 화면 · 17.2 조여 옴 · 24.6 문소리 · 25.8 진짜가 들어옴(반전) ·
// 34.0 진짜 앞에서 가짜가 계속(끝 장치) · 37.2 사례 · 지키는 법 글.
// 컷마다 그 영상에 든 소리(대사 · 휴대폰 속 목소리 · 방 소리)를 그대로 깐다(audio). 동영상은 public/img/*.mp4(git 밖 — 제미나이 앱 동영상).
// 첫 판(11-15 08시) — 동영상을 받기 전 설계 초. 받은 판의 받아쓰기로 시작 초를 맞춘다.
export type Crop = { s: number; cx: number; cy: number; ay?: number; push?: { t0: number; t1: number; to: number } };
export type CutT = { from: number; to: number; src: string; start: number; crop: Crop; rate?: number; drift?: number; audio?: number; shade?: number; low?: number; blur?: number; a?: { src: string; start: number; vol?: number } };

// reveal = 반전(문 종 · 경찰관) · stop = 음악을 줄이는 자리 · card = 사실 카드(위 표시를 잠깐 뺌) · end = 당부(「SYNK 브리핑」을 위 표시에 붙임)
export const S = { hook: 0, reveal: 24.6, stop: 48.0, card: [41.6, 44.8] as [number, number], end: 44.8 };
export const TOTAL_S = 48.0;
export const FPS = 24;

const F: Crop = { s: 1.0, cx: 540, cy: 960 };
// 콘티 검수(맥락 없는 Opus 5.5 · 11-15 09시 — Fable 한도 대체) 반영 판: 첫 글 한 줄 · 「우리 애들…?」 2초 · 몰래 누르는 손(V10) · 시간 끄는 말 줄임(V5b) ·
// 문 컷 원장 앞쪽 구도(V6) · 끝 순서 「뚝 → 안도 · 경찰관 한마디(V9) → 사실 카드 3초 넘게 → 당부(V9 뒤쪽)」 · 위 표시 「실제 사건을 바탕으로 꾸민 장면」.
export const CUTS: CutT[] = [
  // 기 — 밤 학원. 원장 근접(V1): 메일 알림 뒤 굳음 · 손이 입으로
  { from: 0.0, to: 1.3, src: 'img/V1.mp4', start: 0.6, crop: F, audio: 1.0, drift: 0 },
  // 메일 접사(V2) — 제목 「원생 명단 갖고 있다」(화면 속 글)
  { from: 1.3, to: 3.2, src: 'img/V2.mp4', start: 0.5, crop: F, audio: 1.0, drift: 0 },
  // 원장 「우리 애들… 명단을…?」(V1 뒤쪽 — 대본 정렬: 「우리」 4.00 · 「애들」 4.32 · 「명단을」 5.20~5.92 → 3.6 · 3.92 · 4.80~5.52)
  { from: 3.2, to: 5.6, src: 'img/V1.mp4', start: 3.6, crop: F, audio: 1.0, drift: 0 },
  // 메일 아래 줄 「3일 안에 연락 없으면 / 학부모님들께 보낸다」(V2 뒤쪽)
  { from: 5.6, to: 6.5, src: 'img/V2.mp4', start: 5.0, crop: F, audio: 1.0, drift: 0 },
  // 몰래 누르는 손(V10 · 화면은 안 보임) — 반전 「신고하신 원장님?」의 씨앗
  { from: 6.5, to: 7.7, src: 'img/V10.mp4', start: 0.3, crop: F, audio: 1.0, drift: 0 },
  // 승 — 휴대폰이 울리고 받음 · 「메일 보셨죠? 경찰에 알리면, 바로 뿌립니다」(V3)
  { from: 7.7, to: 13.8, src: 'img/V3.mp4', start: 1.5, crop: F, audio: 1.0, drift: 0.008 },
  // 송금 화면 · 「10분 드릴게요. 안 그러면 단톡방에 올립니다」(V4)
  { from: 13.8, to: 17.6, src: 'img/V4.mp4', start: 1.2, crop: F, audio: 1.0, drift: 0 },
  // 「…네」 · 볼펜 딸깍 · 눈이 문 쪽으로 · 「잠깐만요…」(V5b)
  { from: 17.6, to: 22.6, src: 'img/V5b.mp4', start: 2.5, crop: F, audio: 1.0, drift: 0 },
  // 엄지가 「보내기」 가까이 내려가다 멈칫(V4 뒤쪽) — 바로 다음에 문 종
  { from: 22.6, to: 24.6, src: 'img/V4.mp4', start: 5.2, crop: F, audio: 1.0, drift: 0 },
  // 전 — 문 종 · 원장이 돌아보며 「쉿」 · 경찰관 「신고하신 원장님 맞으시죠?」 · 휴대폰을 책상에(V6)
  { from: 24.6, to: 29.4, src: 'img/V6.mp4', start: 0.4, crop: F, audio: 1.0, drift: 0.006 },
  // 핵심 장면(V7): 스피커폰 협박범 → 「근데요, 지금 경찰분이 옆에서 같이 듣고 계세요」 → 뚝
  { from: 29.4, to: 37.6, src: 'img/V7.mp4', start: 0.2, crop: { s: 1.0, cx: 540, cy: 960, push: { t0: 0.5, t1: 8.0, to: 1.07 } }, audio: 1.0, drift: 0 },
  // 결 — 같은 두 사람 구도(V9): 숨을 내쉼 · 경찰관 「이제부터는 저희가 맡을게요」
  { from: 37.6, to: 41.6, src: 'img/V9.mp4', start: 1.0, crop: F, audio: 1.0, drift: 0.006 },
  // 근거 한 장(흐린 V7 위 · 3.2초)
  { from: 41.6, to: 44.8, src: 'img/V7.mp4', start: 0.5, crop: F, drift: 0.01, blur: 22 },
  // 끝 — V9 뒤쪽(안도의 웃음 → 노트북 쪽으로 돌아앉음) 위 당부
  { from: 44.8, to: 48.0, src: 'img/V9.mp4', start: 5.0, crop: F, audio: 1.0, drift: 0.006 },
];

// 큰 글자 = 말. grey = 전화 속 남자 · 경찰관의 말(원장은 흰). at = 줄마다 뜨는 초. butter = 버터를 쓰는 한 줄(버터 줄 번호 bi, 없으면 첫 줄).
export const LINES: { lines: string[]; from: number; to: number; grey?: boolean; size?: number; meta?: string; metaSize?: number; deep?: boolean; instant?: boolean; at?: number[]; butter?: boolean; bi?: number }[] = [
  { lines: ['학원 원장에게 온', '메일 한 통'], from: 0.25, to: 3.15, size: 104, instant: true },
  { lines: ['우리 애들…', '명단을…?'], from: 3.55, to: 5.55, size: 104, at: [3.55, 4.75] },
  { lines: ['메일 보셨죠?', '경찰에 알리면 바로 뿌립니다'], from: 10.0, to: 13.7, grey: true, size: 84, at: [10.0, 11.4] },
  { lines: ['10분 드릴게요', '안 그러면 단톡방에 올립니다'], from: 14.6, to: 17.5, grey: true, size: 84, at: [14.6, 15.8] },
  { lines: ['잠깐만요…'], from: 20.6, to: 22.5, size: 104 },
  { lines: ['신고하신 원장님', '맞으시죠?'], from: 27.3, to: 29.3, grey: true, size: 96 },
  { lines: ['여보세요?', '왜 말이 없어요'], from: 29.6, to: 32.4, grey: true, size: 92 },
  { lines: ['근데요, 지금 경찰분이', '옆에서 같이 듣고 계세요'], from: 33.6, to: 36.9, size: 88, at: [33.6, 34.9] },
  { lines: ['이제부터는', '저희가 맡을게요'], from: 39.0, to: 41.5, grey: true, size: 96 },
  { lines: ['실제 사건의 범인은 IT 비전공자', 'AI로 업체 90여 곳을 털었다'], from: 41.7, to: 44.7, size: 80, meta: '서울경찰청 발표 · 2026년 10월 26일', metaSize: 42, deep: true, at: [41.7, 42.5] },
  { lines: ['협상도 송금도 말고', '바로 신고'], from: 44.95, to: 47.8, size: 104, meta: '경찰 당부', metaSize: 42, butter: true, bi: 1, at: [44.95, 45.6] },
];

export const VO: { id: string; t: number }[] = [];

export const SOUNDS: { t: number; vol: number; src: string; dur?: number }[] = [
  // 메일 알림음 — V1 자체 알림음이 작으면 두 음 「띵동」(sfx/알림.wav)을 얹는다
  { t: 0.15, vol: 0.6, src: 'sfx/알림.wav', dur: 24 },
];
