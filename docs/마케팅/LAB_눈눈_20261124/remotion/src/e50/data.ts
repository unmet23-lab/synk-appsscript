// LAB 영어 E50 「눈 = eye · snow」(11-24 07시 회차가 세우고 11-25 15시 회차가 영상 판으로 바꿈) — 장면 정본: 영상 · 한국어 · 소리 · 박자.
// 편 전체를 영상으로(제작 절차 lab-whole-video): 샷 여섯은 11-24에 구운 펠트 판을 시작 · 끝 그림으로 Flow Omni 1.2 Flash가 구운 720×1280 영상(public/vid — git 밖, tools/플로우영상.js 「넣기」)이다.
// 원본 xa5CKrQkOk4(20.1초) 뼈대 1:1 — 0~3초 「눈」 퀴즈(몽글은 하늘을 보며 「눈!」, 친구는 제 눈을 가리키며 「눈?」) → 3.0초 친구 「이거, 눈!」(eye)
// → 6.5초 몽글 「저것도 눈!」(snow) → 9.7초 큰 눈송이가 몽글 눈으로 떨어짐(원본 10.0초 쏟아짐 자리) → 10.4초 몽글 눈에 쏙 「눈에 눈!」(한 장면)
// → 11.9초 친구가 웃음 「눈에 눈이네!」 → 14.0초 둘이 함께 — 「눈 = eye · 눈 = snow」 이름표가 그림 속 눈과 눈송이를 가리킴 → 16.9초 다른 눈에도 쏙 「안 보여~!」(끝 3초에 한 장면이 다시).
// 목소리는 소진(몽글) · 범수(친구), 효과음은 소리/만들기.py.
export const FPS = 30;
export const TOTAL = 22.15;
export const fr = (sec: number) => Math.round(sec * FPS);

// 샷 — at: 편 초 · len: 쓸 길이 · from: 영상 안 시작 초
// 당김: 얼굴 가까이로 끊어 보이는 칸 — 배율과 그 가운데(화면 %). 움직이는 밀기가 아니라 컷이다(멀미 11-20)
export type Shot = { at: number; len: number; vid: string; from?: number; rate?: number; 당김?: { 배율: number; x: number; y: number } };
export const SHOTS: Shot[] = [
  { at: 0.0, len: 3.0, vid: 's1.mp4', from: 0.25, rate: 0.92 }, // 첫눈 골목 — 하늘을 보는 몽글 · 제 눈 밑을 톡톡 두드리는 친구
  { at: 3.0, len: 3.5, vid: 's2.mp4', from: 0.55, rate: 0.75 }, // 친구 가슴 위 — 「이거, 눈!」
  { at: 6.5, len: 2.75, vid: 's3.mp4' }, // 몽글 낮은 앵글 — 큰 눈송이를 올려다보며 「저것도 눈!」
  { at: 9.25, len: 3.4, vid: 's3.mp4', from: 3.1, rate: 0.85, 당김: { 배율: 1.32, x: 50, y: 55 } }, // 얼굴 가까이로 컷 — 눈송이가 내려와 한쪽 눈에 쏙 「눈에 눈!」
  { at: 12.65, len: 2.0, vid: 's4.mp4' }, // 친구 낮은 앵글 — 웃음 「눈에 눈이네!」
  { at: 14.65, len: 3.4, vid: 's5.mp4', rate: 0.87 }, // 옆 두 사람 — 이름표 둘
  { at: 18.05, len: 0.57, vid: 's6c.mp4' }, // 몽글 — 남은 눈으로 올려다봄(둘째 눈송이는 FLAKE2가 떨어진다)
  { at: 18.62, len: 3.53, vid: 's6.mp4', from: 0.667, rate: 0.92 }, // 다른 눈에도 쏙 — 비틀 「안 보여~!」
];
// 쏙 — 눈송이가 붙는 초(받은 영상에서 잰다)
export const HIT1 = 10.07;
export const HIT2 = 18.62;
// 둘째 눈송이 — 구운 판(s6 a)은 떨어지는 동안 뜬 눈에 흰자가 보여 잘랐고, c는 첫 눈 위로 떨어져 쓰지 못했다. s6 a에서 오린 펠트 눈송이(img/flake2.png)가 s6c(앞 0.57초) 위로 떨어져 s6이 이어받는다
export const FLAKE2 = { from: 18.11, to: 18.62, x: [720, 669], y: [-160, 1066], rot: [-50, 4], w: 276 };
// 장면 심사(한 장면 먼저) — 9.25~12.65초(한쪽 눈에 쏙) + 18.05~20.85초(다른 눈에도 쏙)
export const SCENE = { from: 9.25, to: 12.65, 뒤: 18.05, 뒤끝: 20.85 };

// 목소리 [초, 파일]
export const VO: [number, string][] = [
  [0.85, 'vo/m1'], // 눈!
  [1.75, 'vo/f1'], // 눈?
  [3.12, 'vo/f2'], // 이거, 눈!
  [6.62, 'vo/m2'], // 저것도 눈!
  [10.35, 'vo/m3'], // 눈에 눈!
  [12.75, 'vo/f3'], // 눈에 눈이네!
  [19.0, 'vo/m4'], // 안 보여~!
];

// 효과음 [초, 파일, 크기]
export const SFX: [number, string, number][] = [
  [0.05, 'chime.wav', 0.12], // 첫눈 반짝 — 첫 1초 효과음은 음악 아래로(영상 기준 #36 · 11-24)
  [3.0, 'pop.wav', 0.35],
  [6.5, 'pop.wav', 0.3],
  [9.25, 'fall.wav', 0.5], // 눈송이가 내려옴
  [10.07, 'splat.wav', 0.75], // 쏙(눈에 붙음)
  [14.65, 'pop.wav', 0.3],
  [14.75, 'tick.wav', 0.35], // 이름표 1(눈 = eye)
  [15.6, 'tick.wav', 0.35], // 이름표 2(눈 = snow)
  [18.0, 'fall.wav', 0.45],
  [18.62, 'splat.wav', 0.8],
  [18.8, 'wobble.wav', 0.45],
];

// 화면 글(영어 판)
export const TXT = {
  hookKo: '눈', hookRead: 'nun', hookQ: 'eye? or snow?',
  m1: '눈!', f1: '눈?',
  f2: '이거, 눈!', f2r: 'i-geo, nun!', f2m: 'This is 눈 — EYE',
  m2: '저것도 눈!', m2r: 'jeo-geot-do nun!', m2m: 'That up there\nis 눈 too — SNOW',
  m3: '눈에 눈!', m3r: 'nu-ne nun!', m3m: 'Snow in my eye!\n(눈에 = in my eye)',
  f3: '하하, 눈에 눈!', f3r: 'ha-ha, nu-ne nun!', f3m: 'Ha! Snow in your eye!',
  tagEye: '눈 = eye', tagSnow: '눈 = snow', sumNote: 'One word. Two things.',
  m4: '안 보여~!', m4r: 'an bo-yeo~!', m4m: 'I can’t see~!',
  end: '눈에 눈 = snow in your eye',
};
// 이름표가 가리키는 자리(s5 화면 좌표) — 몽글의 열린 눈 · 눈에 붙은 눈송이
export const TAG_EYE = { x: 806, y: 1140 };
export const TAG_SNOW = { x: 668, y: 1090 };
