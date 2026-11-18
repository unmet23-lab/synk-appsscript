// B53 「사장님 목소리로 지금 바로 송금해」 시간표 — 컷 · 말 · 소리 한 곳(초). 뼈대는 형식 원본 MnUWYBp0a_c(AI 목소리 사기 반전 숏드라마 · 148.9초):
// 0 훅(다급한 송금 요구) · 99.6 반전(원래 번호로 건 통화에 진짜 아들) · 144.1 끝 장치(한 판으로 녹아 닫힘). 우리는 원본 초 × 0.31 안팎으로 앉힌다(오마주.json 「다르게」 — 길이).
// 컷마다 그 영상에 든 소리(윤 대리 대사 · 방 소리)를 그대로 깐다(audio). 동영상은 public/img/*.mp4(git 밖 — 제미나이 앱 동영상).
// 사장님 목소리는 가짜(전화)와 진짜(회의실) 모두 같은 일레븐 v4 공유 목소리 「Hyeonwoo」로 구워 VO로 얹는다 — 전화 너머는 300~3,300Hz 전화 결(*_전화.wav), 회의실은 맨소리(*_방.wav).
// 이 판은 받은 판 전 설계 초다 — 받은 판의 대사 시각은 받아쓰기로 말을 맞춘 뒤 0.1초 소리 크기로 잡아 고친다.
export type Crop = { s: number; cx: number; cy: number; ay?: number; push?: { t0: number; t1: number; to: number }; path?: { t: number[]; cy: number[] } };
export type CutT = { from: number; to: number; src: string; start: number; crop: Crop; rate?: number; drift?: number; audio?: number; shade?: number; low?: number; blur?: number; look?: 'past' | 'dim'; join?: boolean; a?: { src: string; start: number; vol?: number } };

// reveal = 반전(진짜 사장님 「무슨 송금?」) · card = 사실 한 장(위 표시를 잠깐 뺌) · end = 끝 3초(핵심 장면 다시)
export const S = { hook: 0, reveal: 30.4, stop: 46.5, card: [38.5, 43.5] as [number, number], end: 43.5 };
export const TOTAL_S = 46.5;
export const FPS = 24;

const F: Crop = { s: 1.0, cx: 540, cy: 960 };
export const CUTS: CutT[] = [
  // 훅 — 휴대폰을 귀에 댄 윤 대리(V1 0~1.3) · 0.2초부터 전화 너머 사장님 F1
  { from: 0.0, to: 1.3, src: 'img/V1.mp4', start: 0.0, crop: F, audio: 1.0, drift: 0.008 },
  // 이체 화면 48,000,000원(V2 0~1.3)
  { from: 1.3, to: 2.6, src: 'img/V2.mp4', start: 0.0, crop: F, audio: 0.8, drift: 0.01 },
  // 윤 대리(V1 1.3~8.6) 「네? 지금요?」 · 듣는 동안 F2 · 「네… 알겠습니다」
  { from: 2.6, to: 9.9, src: 'img/V1.mp4', start: 1.3, crop: F, audio: 1.0, drift: 0.006 },
  // 이체 화면(V2 1.3~6.4) 커서가 「이체하기」 위로 · 멈칫 + F3 「비밀 거래니까, 아무한테도 말하지 마」
  { from: 9.9, to: 15.0, src: 'img/V2.mp4', start: 1.3, crop: F, audio: 0.8, drift: 0.008 },
  // 윤 대리 의심(V4 0~8) · 「사장님, 확인하고 바로 다시 전화드릴게요」 · 통화 종료
  { from: 15.0, to: 21.0, src: 'img/V4.mp4', start: 1.0, crop: F, audio: 1.0, drift: 0.006 },
  // 책상 전화로 직접 누름(V5 0~5) · 연결음
  { from: 21.0, to: 24.0, src: 'img/V5.mp4', start: 0.5, crop: F, audio: 1.0, drift: 0.008 },
  // 회의실 진짜 사장님(V6 0~5) 진동 · 받음 · R1 「어, 윤 대리. 나 회의 중인데?」
  { from: 24.0, to: 27.4, src: 'img/V6.mp4', start: 1.4, crop: F, audio: 0.6, drift: 0.006 },
  // 윤 대리(V7 0.8~4.6) 「사장님, 방금 사천팔백 송금하라고 하셨잖아요」
  { from: 27.4, to: 30.4, src: 'img/V7.mp4', start: 0.9, crop: F, audio: 1.0, drift: 0.006 },
  // 반전 — 진짜 사장님(V6 6.8~9.8) R2 「…무슨 송금? 나 전화한 적 없는데」
  { from: 30.4, to: 33.2, src: 'img/V6.mp4', start: 6.9, crop: F, audio: 0.6, drift: 0.006 },
  // 핵심 장면(V8 0~7.5) 휴대폰이 다시 울림 · R3(수화기) 「그거 나 아니야. 받지 마」 · 빨간 단추
  { from: 33.2, to: 38.5, src: 'img/V8.mp4', start: 0.5, crop: F, audio: 1.0, drift: 0.004 },
  // 사실 한 장 — 어둡게 깐 이체 화면(V2 뒤쪽)
  { from: 38.5, to: 43.5, src: 'img/V2.mp4', start: 6.0, crop: F, drift: 0.008, look: 'dim', low: 330 },
  // 끝 3초 — 핵심 장면 다시(V8 앞쪽, 울리는 휴대폰) → 마지막 0.6초 꺼진 화면(V8 뒤쪽)
  { from: 43.5, to: 45.9, src: 'img/V8.mp4', start: 1.5, crop: F, drift: 0.004, low: 460 },
  { from: 45.9, to: 46.5, src: 'img/V8.mp4', start: 8.4, crop: F, drift: 0.004, low: 460 },
];

// 큰 글자 = 말. 흰 = 윤 대리 · 회의실의 사장님, grey = 전화 너머 목소리. at = 줄마다 뜨는 초. [ ] = 버터 글자(이 편의 버터 한 곳 — 끝 줄의 「아는 번호」).
export const LINES: { lines: string[]; from: number; to: number; grey?: boolean; size?: number; meta?: string; metaSize?: number; deep?: boolean; instant?: boolean; at?: number[]; butter?: boolean; bi?: number; metaBelow?: boolean }[] = [
  // 훅 — 전화 너머 F1 「윤 대리, 나야. 지금 바로 송금 좀 해 줘」를 머리 글이 맡는다(같은 자리에 말 자막을 따로 두지 않음)
  { lines: ['사장님 목소리로', '"지금 바로 송금해"'], from: 0.05, to: 2.6, size: 96, instant: true, deep: true },
  { lines: ['네? 지금요?'], from: 3.3, to: 4.6, size: 104 },
  { lines: ['거래처 계약금이야', '사천팔백, 삼십 분 안에 보내'], from: 5.0, to: 8.6, grey: true, size: 88, at: [5.0, 6.6] },
  { lines: ['네… 알겠습니다'], from: 8.9, to: 9.9, size: 100 },
  { lines: ['아, 그리고', '비밀 거래니까', '아무한테도 말하지 마'], from: 11.2, to: 15.0, grey: true, size: 92, at: [11.2, 12.1, 13.2], deep: true },
  { lines: ['사장님, 확인하고', '바로 다시 전화드릴게요'], from: 17.5, to: 20.4, size: 92, at: [17.5, 18.6] },
  { lines: ['어, 윤 대리', '나 회의 중인데?'], from: 24.9, to: 27.3, size: 96, meta: '같은 시각 · 거래처 회의실', metaSize: 46, at: [25.3, 26.2], deep: true },
  { lines: ['방금 사천팔백', '송금하라고 하셨잖아요'], from: 27.6, to: 30.3, size: 92, at: [27.6, 28.6] },
  { lines: ['…무슨 송금?', '나 전화한 적 없는데'], from: 30.5, to: 33.1, size: 100, at: [30.5, 31.7] },
  { lines: ['그거 나 아니야', '받지 마'], from: 34.6, to: 37.0, grey: true, size: 100, at: [34.6, 35.8] },
  { lines: ['회사 대표 목소리를 AI로 흉내 내', '직원에게 송금시킨 혐의', '약 1억 2,900만 달러'], from: 38.6, to: 43.4, size: 78, meta: '미국 검찰 기소 발표(2026년 11월)', metaSize: 46, deep: true, at: [38.6, 39.4, 40.6] },
  { lines: ['급한 송금 전화는', '끊고, [아는 번호]로 다시'], from: 43.55, to: 46.6, size: 110, meta: '미국 FBI 권고', metaSize: 50, instant: true, metaBelow: true, deep: true },
];

export const SPOTS: { from: number; to: number; x: number; y: number; w: number; h: number; a: number }[] = [];

// 배경음(일레븐 음악 · 52초 · 47.5초부터 사그라짐 — 그 앞에서 끝남) 볼륨 곡선. 받은 판을 보고 고친다
export const BGM = {
  t: [0, 0.6, 30.2, 30.6, 33.0, 33.4, 38.3, 38.7, 43.3, 43.7, 46.0, 46.5],
  v: [0.08, 0.12, 0.12, 0.07, 0.07, 0.12, 0.12, 0.16, 0.16, 0.22, 0.22, 0],
};

// 사장님 목소리(일레븐 v4 「Hyeonwoo」 한 목소리) — 전화 너머는 *_전화, 회의실 맨소리는 *_방
export const VO: { id: string; t: number }[] = [
  { id: 'F1_전화', t: 0.2 },
  { id: 'F2_전화', t: 5.0 },
  { id: 'F3_전화', t: 11.2 },
  { id: 'R1_방', t: 25.3 },
  { id: 'R2_방', t: 30.5 },
  { id: 'R3_전화', t: 34.6 },
];

export const SOUNDS: { t: number; vol: number; src: string; dur?: number }[] = [
  // 연결음(책상 전화로 건 뒤) → 회의실 휴대폰 진동
  { t: 22.4, vol: 0.35, src: 'sfx/ringback.wav', dur: 38 },
  { t: 24.0, vol: 0.6, src: 'sfx/buzz.wav', dur: 34 },
  // 핵심 장면 — 휴대폰이 다시 울림(빨간 단추에서 멈춤)
  { t: 33.2, vol: 0.7, src: 'sfx/buzz.wav', dur: 120 },
  // 끝 3초 — 핵심 장면 다시(진동 한 번 더 → 꺼짐)
  { t: 43.5, vol: 0.55, src: 'sfx/buzz.wav', dur: 58 },
];
