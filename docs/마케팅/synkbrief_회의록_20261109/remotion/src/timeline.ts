// B37 시간표 — 컷 · 말 · 소리 한 곳(초). 컷 경계는 B21 박자 × 약 1.28(오마주 1:1 뼈대), 대사 초는 받은 영상의 받아쓰기 · 소리 크기로 잰 값.
// 컷마다 그 영상에 든 소리(대사 · 진동 · 방 소리)를 그대로 깐다(audio). 동영상은 public/img/V*.mp4(git 밖 — 제미나이 앱 동영상 77yuhbs 구독 몫 7편).
// v3(11-10): 이해 시험 넷이 같이 짚은 자리 — 14~28초 늘어짐(정적 · 웃음 사이 · 노트북 화면을 줄임) · 40초 해설(무슨 일이었는지로 바꿈) · 회의록 작은 글.
//   사람 움직임 재기에서 V4 7~9.5초(부장이 고개 든 채 웃음)가 0.03~0.08로 굳어 반전 컷을 V7(돌아봄 · 돋보기 벗고 웃음 · 일어섬)로 다시 뽑았다.
export type Crop = { s: number; cx: number; cy: number; ay?: number };
export type CutT = { from: number; to: number; src: string; start: number; crop: Crop; rate?: number; drift?: number; audio?: number; d?: number };

export const S = {
  ago: 6.84, lid: 22.56, minutes: 28.28, scroll: 29.2, scrollEnd: 31.0, focus: 32.08, minutesEnd: 34.08,
  reveal: 36.58, v5: 42.98, v6: 49.48,
};
export const TOTAL_S = 54.48;

const FULL: Crop = { s: 1.0, cx: 540, cy: 960 };
export const CUTS: CutT[] = [
  // 기 — 결과부터: 3분 뒤 부장 책상의 폰이 켜진다 → 부장 → 집어 듦 → 넓게(유리 안 두 사람) → 웃는 두 사람
  // v5(11-10 미학 맹검 「손 접사가 붓고 폰 화면이 뭉개짐」): 여는 컷을 넓은 그림으로 — 부장 책상 · 켜지는 폰 · 뒤 유리 회의실
  // v9(11-10 미학 맹검 v8 01 기각 「폰이 아래로 잘려 켜지는 순간이 안 읽힘 · 1.4초 같은 각도 확대 점프컷」): 첫 컷은 조금 당기고 덜 내려 켜지는 폰이 보이게,
  //   1.4초는 같은 각도 확대 대신 자기 폰을 내려다보는 다른 직원(「전원의 폰」)
  { from: 0, to: 1.4, src: 'img/V4.mp4', start: 0.0, crop: { s: 1.25, cx: 600, cy: 1300 }, audio: 0.9, drift: 0.02, d: 200 },
  { from: 1.4, to: 1.9, src: 'img/V4.mp4', start: 1.45, crop: { s: 2.2, cx: 790, cy: 1040 }, audio: 0.9 },
  { from: 1.9, to: 3.48, src: 'img/V4.mp4', start: 2.0, crop: { s: 1.45, cx: 470, cy: 1150 }, audio: 0.9 },
  { from: 3.48, to: 4.44, src: 'img/V4.mp4', start: 3.58, crop: { s: 1.55, cx: 860, cy: 900 }, audio: 0.9 },
  { from: 4.44, to: 6.84, src: 'img/V4.mp4', start: 4.54, crop: { s: 2.1, cx: 930, cy: 900 }, audio: 0.9 },
  // 3분 전 — 문이 닫히자 험담
  { from: 6.84, to: 8.64, src: 'img/V2.mp4', start: 0.0, crop: { s: 1.1, cx: 540, cy: 1000 }, audio: 1.15 },
  { from: 8.64, to: 12.6, src: 'img/V2.mp4', start: 1.8, crop: { s: 1.35, cx: 560, cy: 1000 }, audio: 1.15 },
  { from: 12.6, to: 14.04, src: 'img/V2.mp4', start: 5.76, crop: { s: 1.8, cx: 760, cy: 950 }, audio: 1.15 },
  { from: 14.04, to: 15.84, src: 'laptop', start: 0, crop: FULL },
  // 승 — 더 심한 말 · 비밀 약속
  { from: 15.84, to: 17.04, src: 'img/V3.mp4', start: 0.7, crop: { s: 1.05, cx: 540, cy: 960 }, audio: 1.15 },
  { from: 17.04, to: 18.36, src: 'img/V3.mp4', start: 1.9, crop: { s: 1.6, cx: 760, cy: 900 }, audio: 1.15 },
  { from: 18.36, to: 19.26, src: 'img/V3.mp4', start: 3.22, crop: { s: 1.6, cx: 330, cy: 950 }, audio: 1.15 },
  { from: 19.26, to: 21.38, src: 'img/V3.mp4', start: 5.5, crop: { s: 1.25, cx: 520, cy: 950 }, audio: 1.15 },
  { from: 21.38, to: 22.56, src: 'img/V3.mp4', start: 7.9, crop: { s: 1.6, cx: 760, cy: 900 }, audio: 1.15 },
  // 전 — 덮는 순간부터: 탁 → 정적 → 진동 박자에 폰 두 대 접사 → 뒤 동료들 → 대리 얼굴 → 회의록(장면 심사 11-10 반영)
  { from: 22.56, to: 24.7, src: 'img/V1.mp4', start: 0.5, crop: { s: 1.1, cx: 540, cy: 1000 }, audio: 1.15 },
  // v5(11-10 미학 맹검 「진동 접사 — 사원증 줄이 옷에 녹아듦 · 초점 없는 구도」): 접사를 빼고 두 사람과 켜지는 폰 두 대가 함께 보이는 중간 크기로
  // v9(11-10 미학 맹검 v8 03 기각 「두 번째 폰이 잘려 없음 · 26.1초 같은 각도 20% 확대 점프컷 · 글 없는 구간인데 위가 빈 검은 띠」):
  //   글자가 없는 24.7~34.08초는 내리지 않고 전체 화면으로(탁자 위 두 폰이 다 보임) · 26.1초는 과장 근접 → 대리 근접으로 맞받기
  { from: 24.7, to: 26.1, src: 'img/V1.mp4', start: 2.92, crop: { s: 1.0, cx: 540, cy: 960 }, audio: 1.15, d: 0 },
  { from: 26.1, to: 26.82, src: 'img/V1.mp4', start: 4.32, crop: { s: 1.7, cx: 800, cy: 1000 }, audio: 1.15, d: 0 },
  { from: 26.82, to: 28.28, src: 'img/V1.mp4', start: 5.04, crop: { s: 1.7, cx: 330, cy: 1050 }, audio: 1.15, d: 0 },
  // v9(11-10 미학 맹검 v8 04 기각 「코드로 급조한 다크모드 템플릿 · 베젤 · 반사 · 심도 없는 평면 그래픽」): 회의록은 탁자 위 폰 화면까지 장면과 한 장으로 구운 판(GPT 이미지 2.5)에 천천히 다가간다
  { from: 28.28, to: 34.08, src: 'img/minutes_phone.png', start: 0, crop: { s: 1.12, cx: 520, cy: 760, ay: 900 }, drift: 0.022, d: 0 },
  { from: 34.08, to: 36.58, src: 'img/V1.mp4', start: 7.4, crop: { s: 1.1, cx: 540, cy: 1000 }, audio: 1.15 },
  // 반전 — 유리 너머 부장이 돌아본다 · 돋보기를 벗고 웃는다 · 일어선다(V7)
  { from: 36.58, to: 38.98, src: 'img/V7.mp4', start: 1.2, crop: { s: 1.05, cx: 540, cy: 960 }, audio: 0.8 },
  // v8(11-10 미학 맹검 05 기각 「돋보기를 벗는 순간 안경알과 테가 뭉개짐」 V7 4.8~5.2): 벗는 순간을 건너뛴다 — 안경에 손 → (끊고) 벗어 든 채 웃음 → 접고 일어섬
  // v9(11-10 미학 맹검 v8 05 기각 「얼굴 크기 · 각도가 같은 근접 두 컷 점프컷 · 안경이 사라짐」): 근접(안경에 손) → 넓게(손에 든 안경을 접고 일어섬) 한 컷으로
  { from: 38.98, to: 39.88, src: 'img/V7.mp4', start: 3.6, crop: { s: 1.6, cx: 400, cy: 820 }, audio: 0.8 },
  { from: 39.88, to: 42.98, src: 'img/V7.mp4', start: 5.9, crop: { s: 1.0, cx: 540, cy: 960 }, audio: 0.8 },
  // 결 — 부장이 들어와 앉는다 · 끝 줄(뒤로 부장과 빨간 점)
  { from: 42.98, to: 49.48, src: 'img/V5.mp4', start: 1.4, crop: { s: 1.1, cx: 540, cy: 1000 }, audio: 0.85 },
  { from: 49.48, to: 52.42, src: 'img/V6.mp4', start: 1.0, crop: { s: 1.05, cx: 480, cy: 1000 }, audio: 0.62 },
  // v9: v8의 끝 노트북 근접은 맹검에서 「빈 회색 칸 가짜 화면 · 앞뒤 컷 자리 어긋남」 기각 3이라 거두고 과장 근접으로 되돌림(v7 고쳐서 5)
  { from: 52.42, to: 54.48, src: 'img/V6.mp4', start: 3.94, crop: { s: 1.22, cx: 470, cy: 960 }, audio: 0.62, drift: 0.008 },
];

// 큰 글자 = 말. grey = 대리(두 사람 말은 흰 · 회색으로만 가른다). 회의록 화면 위 해설(n4b)은 화면 글과 겹치지 않게 글자를 띄우지 않는다.
export const LINES: { lines: string[]; from: number; to: number; grey?: boolean; size?: number; meta?: string; instant?: boolean }[] = [
  { lines: ['회의 끝나고 3분 뒤,', '전원의 폰이 울렸어요'], from: 0, to: 3.4, size: 88, instant: true },
  { lines: ['저 둘만', '아직 몰라요'], from: 3.5, to: 6.75, size: 112 },
  { lines: [], from: 6.9, to: 7.7, meta: '3분 전 · 회의 끝' },
  { lines: ['갔어요?'], from: 7.7, to: 9.1, grey: true, size: 112, meta: '3분 전 · 회의 끝' },
  { lines: ['갔어'], from: 9.15, to: 9.75, size: 112 },
  { lines: ['부장님 오늘 같은 말', '세 번 하신 거 알죠?'], from: 9.78, to: 12.55, grey: true, size: 84 },
  { lines: ['네 번'], from: 12.95, to: 14.0, size: 112 },
  { lines: ['AI는 아직', '안 나갔어요'], from: 14.1, to: 15.8, size: 112 },
  { lines: ['본인도 회의', '왜 하는지 모르실걸요?'], from: 16.09, to: 18.6, size: 84 },
  { lines: ['이거 부장님한텐', '비밀이에요'], from: 19.42, to: 21.36, grey: true, size: 88 },
  { lines: ['당연하지'], from: 21.52, to: 22.5, size: 112 },
  { lines: ['자, 진짜 끝'], from: 23.22, to: 24.6, size: 112 },
  { lines: ['왜?'], from: 35.32, to: 36.5, size: 112 },
  { lines: ['미국에선 실제로, 남아서 한 말이', '이렇게 가서 거래가 깨졌어요'], from: 36.65, to: 39.85, size: 70 },
  { lines: ['아까 그 얘기,', '다섯 번째로 하지'], from: 43.62, to: 47.82, size: 88 },
  { lines: ['기록은 켜 두고'], from: 47.87, to: 49.47, size: 96 },
  { lines: ['회의 끝나면,', 'AI 기록부터 끄세요'], from: 49.92, to: 54.48, size: 92, meta: 'SYNK 브리핑' },
];

export const VO: { id: string; t: number }[] = [
  { id: 'n1', t: 0.05 }, { id: 'n2', t: 3.55 }, { id: 'n3', t: 14.25 }, { id: 'n4b', t: 28.4 }, { id: 'n6', t: 36.65 },
];

export const SOUNDS: { t: number; vol: number; src: string; dur?: number }[] = [
  { t: 0.36, src: 'sfx/buzz_many.wav', vol: 0.32, dur: 60 },
  { t: 3.48, src: 'sfx/thud.wav', vol: 0.26 },
  { t: 14.04, src: 'sfx/tok.wav', vol: 0.3 },
  { t: 28.28, src: 'sfx/thud.wav', vol: 0.3 },
  { t: 32.08, src: 'sfx/tok.wav', vol: 0.4 },
  { t: 36.58, src: 'sfx/thud.wav', vol: 0.3 },
];
