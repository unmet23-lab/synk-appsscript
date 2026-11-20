// B46 시간표 — 컷 · 말 · 소리 한 곳(초). 컷 경계는 원본 KojyBLpl64U 박자(2.1 · 6.0 · 8.2 · 16.4초) × 약 1.25.
// 사진 넘김(N0~N7)은 Seedream으로 같은 판에 포스트잇 글씨만 바꿔 구운 여덟 장이다(바뀐 화소 1% 안팎). 넘기는 컷끼리 카메라가 끊기지 않게
// t0(이어받는 카메라 시각)와 한 줄 path를 함께 쓴다 — 화면에서 바뀌는 것은 포스트잇 글씨뿐이다.
export type Crop = { s: number; cx: number; cy: number; ay?: number; path?: { t: number[]; s?: number[]; cx?: number[]; cy?: number[] } };
export type CutT = { from: number; to: number; src: string; start: number; crop: Crop; drift?: number; audio?: number; d?: number; dPath?: { t: number[]; d: number[] }; land?: boolean; t0?: number };

// 넘김 카메라 — 기기와 포스트잇을 가운데에 두고 넘기는 동안 천천히 다가간다(절대 초)
const flipCam = (t0: number, t1: number): Crop => ({ s: 1.25, cx: 510, cy: 1080, ay: 960, path: { t: [t0, t1], s: [1.22, 1.42], cx: [510, 510], cy: [1060, 1150] } });
const NAMES = ['N0', 'N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7'];
// 넘김 박: 처음은 길게(내 닉네임), 갈수록 빨라진다
// 끝 카메라 — 포스트잇 글씨만 크게(앞 넘김과 다른 그림으로 끝 3초를 세게)
const noteCam = (t0: number, t1: number): Crop => ({ s: 2.1, cx: 510, cy: 1290, ay: 1040, path: { t: [t0, t1], s: [2.05, 2.3], cx: [510, 510], cy: [1270, 1300] } });
const flips = (t0: number, beats: number[], end: number, d = 0, camOf: (a: number, b: number) => Crop = flipCam): CutT[] => {
  const cam = camOf(t0, end);
  return beats.map((b, i) => ({ from: b, to: i + 1 < beats.length ? beats[i + 1] : end, src: `img/${NAMES[i]}.png`, start: 0, crop: cam, drift: 0, d, land: i === 0, t0: b - t0 }));
};

// ── 한 장면 먼저(장면 심사용 · 5.6초) ──
export const SCENE_S = 5.6;
const SB = [0, 0.9, 1.55, 2.1, 2.55, 2.92, 3.22, 3.48];
export const SCENE_CUTS: CutT[] = [
  ...flips(0, SB, 3.75),
  { from: 3.75, to: 5.6, src: 'img/V3.mp4', start: 6.9, crop: { s: 1.0, cx: 540, cy: 960, path: { t: [0, 1.85], s: [1.0, 1.08], cx: [540, 560], cy: [960, 900] } }, drift: 0, audio: 0.9 },
];
export const SCENE_SOUNDS: { t: number; vol: number; src: string; dur?: number }[] = [
  ...SB.slice(1).map((t, i) => ({ t: t - 0.02, src: 'sfx/swish.wav', vol: 0.22 + i * 0.015, dur: 0.6 })),
  { t: 3.95, src: 'sfx/tick.wav', vol: 0.35 },
];

// ── 본편(v2 · 11-20 이해 시험 반영) ──
// 폰 화면은 손 없이 이불 위에 놓인 폰을 위에서 본 판 넷(P1a → P1 사진 도착 · P3a → P3 말풍선 보냄)이다 — 같은 판에서 바뀌는 것은 대화뿐이라
// 둘씩 같은 카메라 길(path · t0)로 잇고, 카메라가 새로 온 것(포스트잇 · 지지 않는 1)으로 옮겨 간다. 화면만 꽉 차게 잡아 폰이 놓인 이불은 보이지 않는다
// (앞뒤 컷에서 폰은 구매자 손에 있다 — 화면 접사로 읽히게).
export const TOTAL_S = 25.2;
const FB = [11.25, 12.15, 12.75, 13.25, 13.65, 13.98, 14.26, 14.5];
const EB = [21.45, 21.9, 22.3, 22.65, 22.95, 23.23, 23.49, 23.73];
// 인증 사진 카메라: 요청 말풍선이 큰 글자 셋째 줄 아래(Y 640 넘게)에 머물고, 처음부터 고른 빠르기(drift 0.02)로 조금씩 다가간다 — 글자가 말풍선을 덮지 않게 · 첫머리가 굳지 않게
const P1CAM: Crop = { s: 1.75, cx: 610, cy: 944, ay: 1040 }; // cx 610 — 오른쪽 말풍선 끝이 단추 자리(920px) 안에
// 운송장 카메라: 운송장 사진에서 보낸 말풍선 옆의 1로
const P3CAM: Crop = { s: 1.9, cx: 560, cy: 876, ay: 1000, path: { t: [0, 1.3, 2.95], s: [1.9, 1.9, 2.05], cx: [560, 560, 620], cy: [876, 880, 900] } };
export const CUTS: CutT[] = [
  // 기 — 구매자의 폰: 「포스트잇 인증 부탁드려요」 아래로 인증 사진(감자칩92)이 도착한다(0.6초 띵)
  { from: 0, to: 0.6, src: 'img/P1a.png', start: 0, crop: P1CAM, drift: 0.02, d: 260 },
  { from: 0.6, to: 3.1, src: 'img/P1.png', start: 0, crop: P1CAM, drift: 0.02, d: 260, land: false, t0: 0.6 },
  // 승 — 믿고 보낸다(V1: 영상 3.0초 톡 · 4.5초 「됐다」 → 이 편 4.3 · 5.8초, 해설 n2가 끝난 뒤)
  { from: 3.1, to: 6.5, src: 'img/V1.mp4', start: 1.8, crop: { s: 1.05, cx: 540, cy: 960 }, drift: 0, audio: 1.0, d: 260 },
  // 운송장 사진이 와 있고, 「언제 도착해요?」를 보내면 옆에 1이 남는다(7.75초 보냄)
  { from: 6.5, to: 7.75, src: 'img/P3a.png', start: 0, crop: P3CAM, drift: 0, d: 260 },
  { from: 7.75, to: 9.45, src: 'img/P3.png', start: 0, crop: P3CAM, drift: 0, d: 260, land: false, t0: 1.25 },
  // 멈칫(V2: 영상 2.5초 「어…?」 → 이 편 9.85초 · 해설 없이)
  { from: 9.45, to: 11.25, src: 'img/V2.mp4', start: 2.1, crop: { s: 1.05, cx: 540, cy: 960 }, drift: 0, audio: 1.0, d: 260 },
  // 전 — 같은 사진, 포스트잇 닉네임만 바뀐다
  ...flips(11.25, FB, 15.1, 260),
  // 판매자 책상 — 같은 사진 여섯 장, 손이 마우스에서 떨어진다(V3)
  { from: 15.1, to: 18.1, src: 'img/V3.mp4', start: 6.5, crop: { s: 1.0, cx: 540, cy: 960, path: { t: [0, 3.0], s: [1.0, 1.08], cx: [540, 560], cy: [960, 900] } }, drift: 0, audio: 0.9, d: 260 },
  // 구매자 — 폰을 내리고 고개를 젖혀 한숨(V4: 영상 5.0초 한숨 → 이 편 18.7초)
  // 얼굴 가까이 — 왼쪽 아래 폰(손이 이마로 갈 때 폰이 다른 손으로 넘어감)은 화면 밖으로 둔다
  { from: 18.1, to: 21.45, src: 'img/V4.mp4', start: 4.4, crop: { s: 1.3, cx: 640, cy: 900, ay: 880 }, drift: 0.01, audio: 1.0, d: 260 },
  // 결 — 끝 3초: 포스트잇 글씨만 크게 다시 넘어가고 끝 줄
  ...flips(21.45, EB, TOTAL_S, 260, noteCam),
];

export const LINES: { lines: string[]; from: number; to: number; size?: number; at?: number[]; butter?: string }[] = [
  { lines: ['포스트잇 인증까지', '받았는데,', '24만 원이 사라졌어요'], from: 0, to: 3.05, size: 84, at: [0, 0.85, 1.75] },
  { lines: ['닉네임 적힌', '게임기 사진이라', '믿고 보냈어요'], from: 3.15, to: 6.45, size: 88, at: [3.15, 3.85, 4.95] },
  { lines: ['운송장 사진까지 왔는데', '그 뒤로 답이 없어요'], from: 6.55, to: 9.45, size: 88, at: [6.55, 8.25] },
  { lines: ['같은 사진에', '포스트잇 글씨만', 'AI로 바꿔 여러 명에게'], from: 11.35, to: 15.05, size: 84, at: [11.35, 11.95, 12.75] },
  { lines: ['이 일당에게 당한 사람은', '천 명이 넘는 걸로 추정돼요'], from: 15.2, to: 18.05, size: 76, at: [15.2, 16.55] },
  { lines: ['경찰과 금감원은', '직접 만나거나', '안전결제로 거래하라고 해요'], from: 18.2, to: 21.4, size: 76, at: [18.2, 19.2, 20.0] },
  { lines: ['포스트잇 사진도', 'AI로 만들어요', '계좌이체 말고, 안전결제'], from: 21.55, to: TOTAL_S, size: 88, at: [21.55, 22.3, 23.35], butter: '안전결제' },
];

// 해설(범수) 줄 시작 초 — 줄 길이는 public/vo/<id>.json
export const VO: { id: string; t: number }[] = [
  { id: 'n1', t: 0.05 }, { id: 'n2', t: 3.15 }, { id: 'n3', t: 6.55 }, { id: 'n4', t: 11.35 }, { id: 'n5', t: 15.2 }, { id: 'n6', t: 18.2 }, { id: 'n7', t: 21.55 },
];

export const SOUNDS: { t: number; vol: number; src: string; dur?: number }[] = [
  { t: 0.56, src: 'sfx/ding.wav', vol: 0.3 },
  { t: 7.73, src: 'sfx/tick.wav', vol: 0.3 },
  ...FB.slice(1).map((t, i) => ({ t: t - 0.02, src: 'sfx/swish.wav', vol: 0.2 + i * 0.012, dur: 0.6 })),
  ...EB.slice(1).map((t) => ({ t: t - 0.02, src: 'sfx/swish.wav', vol: 0.16, dur: 0.6 })),
];
