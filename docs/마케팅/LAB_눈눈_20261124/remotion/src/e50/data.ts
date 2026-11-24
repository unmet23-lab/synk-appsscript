// LAB 영어 E50 「눈 = eye · snow」(11-24 07시 회차) — 장면 정본: 그림 · 한국어 · 소리 · 박자.
// 원본 xa5CKrQkOk4(20.1초) 뼈대 1:1 — 0~3초 「눈」 퀴즈(몽글은 하늘을 보며 「눈!」, 친구는 제 눈을 가리키며 「눈?」) → 3.0초 친구 「이거, 눈!」(eye)
// → 6.5초 몽글 「저것도 눈!」(snow) → 10.0초 큰 눈송이가 몽글 눈으로 떨어짐(원본 10.0초 쏟아짐 자리) → 10.4초 몽글 눈에 쏙 「눈에 눈!」(한 장면)
// → 11.9초 친구가 웃음 「눈에 눈이네!」 → 14.0초 둘이 함께 — 「눈 = eye · 눈 = snow」 이름표가 그림 속 눈과 눈송이를 가리킴 → 16.9초 다른 눈에도 쏙 「안 보여~!」(끝 3초에 한 장면이 다시).
// 그림은 판/_지시문만들기.py로 구운 펠트 장면 일곱 장 + 눈송이 한 장(오려서 떨어뜨림). 목소리는 소진(몽글) · 범수(친구), 효과음은 소리/만들기.py.
export const FPS = 30;
export const TOTAL = 20.1;

export type Spot = { cx: number; cy: number; rx: number; ry: number };
export type Cell = { at: number; img: string; push?: [number, number]; origin?: [number, number] };
export const CELLS: Cell[] = [
  { at: 0.0, img: 'e_open.jpg', push: [1.0, 1.05], origin: [540, 1100] },
  { at: 3.0, img: 'e_eye.jpg', push: [1.0, 1.06], origin: [420, 800] },
  { at: 6.5, img: 'e_up.jpg', push: [1.0, 1.06], origin: [540, 1150] },
  // 원본 10.0초 쏟아짐 — 몽글 얼굴로 확 다가가며 눈송이가 떨어진다(같은 그림을 이어서 당김 — 컷이 아니라 다가감)
  { at: 10.0, img: 'e_up.jpg', push: [1.06, 1.32], origin: [540, 1150] },
  { at: 10.4, img: 'e_splat.jpg', push: [1.12, 1.05], origin: [540, 1150] },
  { at: 11.9, img: 'e_laugh.jpg', push: [1.0, 1.05], origin: [540, 900] },
  { at: 14.0, img: 'e_two.jpg', push: [1.0, 1.04], origin: [600, 1100] },
  { at: 16.9, img: 'e_both.jpg', push: [1.1, 1.0], origin: [540, 1150] },
];

// 몽글 자리(그림 좌표) — 그림을 구운 뒤 잰다
export const MONGLE: Record<string, Spot> = {};
// 눈송이가 떨어져 닿는 자리(그림 좌표) — 첫째는 e_up의 몽글 왼쪽 눈, 둘째는 e_two의 몽글 열린 눈
export const HIT1 = { x: 450, y: 1015, size: 240 }; // 11-24 15시 회차가 e_up_164026에서 잼(몽글 왼쪽 눈) — e_splat의 눈송이는 (435, 1110) · 폭 약 240
export const HIT2 = { x: 804, y: 1155, size: 150 }; // e_two_165035의 몽글 열린 눈
export const FALL1 = { from: 9.55, to: 10.4 };
export const FALL2 = { from: 16.35, to: 16.9 };

// 목소리 [초, 파일]
export const VO: [number, string][] = [
  [0.3, 'vo/m1'], // 눈!
  [1.25, 'vo/f1'], // 눈?
  [3.12, 'vo/f2'], // 이거, 눈!
  [6.62, 'vo/m2'], // 저것도 눈!
  [10.5, 'vo/m3'], // 눈에 눈!
  [12.0, 'vo/f3'], // 눈에 눈이네!
  [17.05, 'vo/m4'], // 안 보여~!
];

// 효과음 [초, 파일, 크기]
export const SFX: [number, string, number][] = [
  [0.05, 'chime.wav', 0.12], // 첫눈 반짝 — 첫 1초 효과음은 음악 아래로(영상 기준 #36 · 11-24)
  [3.0, 'pop.wav', 0.35],
  [6.5, 'pop.wav', 0.3],
  [9.6, 'fall.wav', 0.5], // 눈송이가 내려옴
  [10.4, 'splat.wav', 0.75], // 쏙(눈에 붙음)
  [11.95, 'laugh.wav', 0.0], // 자리만(웃음은 목소리 줄)
  [14.0, 'pop.wav', 0.3],
  [14.5, 'tick.wav', 0.35], // 이름표 1
  [15.3, 'tick.wav', 0.35], // 이름표 2
  [16.4, 'fall.wav', 0.45],
  [16.9, 'splat.wav', 0.8],
  [17.0, 'wobble.wav', 0.45],
];

// 화면 글(영어 판)
export const TXT = {
  hookKo: '눈', hookRead: 'nun', hookQ: 'eye? or snow?',
  m1: '눈!', f1: '눈?',
  f2: '이거, 눈!', f2r: 'i-geo, nun!', f2m: 'This is 눈 — EYE',
  m2: '저것도 눈!', m2r: 'jeo-geot-do nun!', m2m: 'That’s 눈 too — SNOW',
  m3: '눈에 눈!', m3r: 'nu-ne nun!', m3m: 'Snow in my eye!',
  f3: '눈에 눈이네!', f3r: 'nu-ne nu-ni-ne!', f3m: 'Snow in your eye, ha!',
  tagEye: '눈 = eye', tagSnow: '눈 = snow', sumNote: 'One word. Two things.',
  m4: '안 보여~!', m4r: 'an bo-yeo~!', m4m: 'I can’t see~!',
  end: '눈에 눈 = snow in your eye',
};
// 이름표 자리(e_two 그림 좌표) — 몽글의 열린 눈 · 눈에 붙은 눈송이
export const TAG_EYE = { x: 804, y: 1155 }; // e_two_165035에서 잼
export const TAG_SNOW = { x: 675, y: 1134 };
