// synkbrief 「엄마 옛날 사진 살릴 때 붙이는 두 줄」 시간표 — 장면 · 말 · 소리 한 곳(초).
// 뼈대(11-20 주 세션 지시): 표지와 같은 첫 화면(결과 먼저) → 실제로 겪은 실패(「살아 움직이게 해 줘」 → 지어낸 목소리로 말함)
//   → 움직이는 줄(입 다문 채 살짝 웃음 — 앞 결과와 나란히) → 깨끗하게 하는 줄 전후 → 끝 3초 살짝 웃는 얼굴 위 「댓글에 「사진」」.
// r2(이해 시험 r1 반영): 두 줄에 이름(움직이는 줄 · 깨끗하게 하는 줄)을 붙이고 요청문은 「 」로 묶었다. 원래 사진과 나란히 두던 칸(넷이 「차이를 모르겠다」)은
//   앞 결과(V1)와 바꾼 결과(M2)를 나란히 두고 위에 그 요청문을 적었다. 끝 말은 받을 것과 받는 길을 말한다.
// V1의 지어낸 목소리는 쓰지 않고 화면 글로 전한다. 결과 영상은 원래 빠르기로, 한 구간을 두 번 쓰지 않는다(scripts/재료.sh).
// 큰 글이 뜨는 초는 음성/범수/<줄>.json의 낱말 시각에 맞췄다. 구성마다 첫 줄은 그 구성의 첫 프레임부터 서 있다(Film.tsx Big).
export const FPS = 30;

// 장면이 시작하는 초
export const S = {
  hook: 0, // 표지와 같은 화면 — 깨끗하게 복원한 사진(큰 판) + 보낸 원래 사진(작게) + 제목
  sent: 2.0, // 아래가 보낸 원래 사진(인화지 판)으로 바뀐다(「…제미나이에 올리고,」 뒤)
  ask: 2.4, // 「살아 움직이게 해 줘」 — V1이 같은 자리에서 움직이기 시작한다(V1 0초부터)
  talk: 4.75, // 큰 판에서 V1이 말하는 구간(V1 2.35초부터 이어서)
  fix: 6.95, // 움직이는 줄 — 같은 사진을 새 대화에
  fixVid: 8.3, // M2가 같은 자리에서 겹쳐 뜬다(M2 0초부터 — 보낸 사진과 같은 짜임이라 사진이 그대로 살아난다)
  pair: 10.8, // 앞 결과(V1 4.6초부터)와 바꾼 결과(M2 2.5초부터)를 나란히 — 「얼굴 그대로, 살짝만」
  clean: 13.25, // 깨끗하게 하는 줄 — 원래 사진이 위에서 아래로 복원한 사진으로
  wipe0: 14.7,
  wipe1: 16.3,
  end: 17.15, // 끝 — 살짝 웃는 얼굴이 화면 가득
  cta: 19.11,
  total: 22.3,
};
export const TOTAL_S = S.total;

// 말(범수) — public/vo/<id>.wav
export const VO: { id: string; t: number }[] = [
  { id: 'N1', t: 0.15 }, // 엄마 옛날 사진을 제미나이에 올리고,(2.03)
  { id: 'N2', t: 2.42 }, // 살아 움직이게 해 줘, 이렇게만 보냈더니,(2.19)
  { id: 'N3', t: 4.85 }, // 지어낸 목소리로 말까지 했어요.(1.72)
  { id: 'N4', t: 7.05 }, // 움직이는 줄은, 얼굴은 그대로 두고, 입은 다문 채 살짝 웃으며.(3.64)
  { id: 'N5', t: 10.9 }, // 그랬더니 얼굴 그대로, 살짝만 웃어요.(2.24)
  { id: 'N6', t: 13.35 }, // 깨끗하게 하는 줄은, 이 사진 깨끗하게 복원해 줘.(2.68)
  { id: 'N7', t: 17.25 }, // 두 줄 전부와 얼굴 확인하는 법, 댓글에 사진 남기면 보내 드려요.(3.70)
];

// 위 작은 줄 — 도구 이름은 시청자가 따라 할 도구라 적는다. 첫 줄은 표지와 같은 크기(34), 나머지는 40
export const TAGS: { from: number; to: number; b: string; i?: string; size?: number; bar?: boolean }[] = [
  { from: S.hook, to: S.sent, b: 'SYNK 브리핑', i: '제미나이 앱', size: 34 },
  { from: S.sent, to: S.end, b: '제미나이 앱', i: '사진 속 인물은 AI로 만든 예시예요', bar: true },
  { from: S.end, to: S.total + 1, b: 'SYNK 브리핑' },
];

// 큰 글 = 말. at = 줄마다 뜨는 초. [ ] = 버터 글자(화면마다 한 곳). 「 」 안은 보낸 요청문 원문 그대로다
export type Line = { lines: string[]; from: number; to: number; at: number[]; size: number; hard?: boolean };
export const LINES: Line[] = [
  { lines: ['「살아 움직이게 해 줘」', '이렇게만 보냈더니'], from: S.sent, to: S.talk, at: [S.sent, 3.56], size: 80 },
  { lines: ['지어낸 목소리로', '[말까지 했어요]'], from: S.talk, to: S.fix, at: [4.87, 5.69], size: 104 },
  { lines: ['움직이는 줄은', '「얼굴은 그대로 두고,', '[입은 다문 채]', '살짝 웃으며 …」'], from: S.fix, to: S.pair, at: [7.07, 7.99, 9.25, 9.88], size: 76 },
  { lines: ['그랬더니 얼굴 그대로,', '[살짝만] 웃어요'], from: S.pair, to: S.clean, at: [10.92, 12.2], size: 84 },
  { lines: ['깨끗하게 하는 줄은', '「이 사진 깨끗하게', '[복원해 줘]」'], from: S.clean, to: S.end, at: [13.37, 14.64, 15.46], size: 84 },
  { lines: ['두 줄 전부와', '얼굴 확인하는 법'], from: S.end, to: S.cta, at: [17.27, 17.94], size: 104 },
  { lines: ['댓글에', '[「사진」]'], from: S.cta, to: S.total + 1, at: [S.cta, S.cta + 0.35], size: 150 },
];

// 나란히 칸 위 작은 글 — 두 칸이 어느 요청문의 결과인지
export const PAIR_LABELS = ['「살아 움직이게 해 줘」', '「입은 다문 채 …」'];

// 효과음 — 말머리와 겹치지 않는 자리에만
export const SOUNDS: { t: number; src: string; vol: number }[] = [
  { t: S.sent - 0.04, src: 'sfx/swish.wav', vol: 0.2 },
  { t: S.fix - 0.04, src: 'sfx/swish.wav', vol: 0.22 },
  { t: S.pair - 0.04, src: 'sfx/tok.wav', vol: 0.24 },
  { t: S.clean - 0.04, src: 'sfx/swish.wav', vol: 0.22 },
  { t: S.wipe1 + 0.05, src: 'sfx/tok.wav', vol: 0.28 },
  { t: S.end - 0.04, src: 'sfx/swish.wav', vol: 0.22 },
  { t: S.cta + 0.35, src: 'sfx/thud.wav', vol: 0.28 },
];

// 배경음(보유곡 따뜻_118의 20초부터) 볼륨 — 끝까지 깔고 목소리 아래로, 끝 0.9초만 닫는다
export const BGM = { t: [0, 0.25, S.total - 0.9, S.total], v: [0.12, 0.28, 0.28, 0] };
