// synkbrief B75 「교재 사진 한 장으로 퀴즈 다섯 문제」 시간표 — 장면 · 말 · 소리 한 곳(초).
// 뼈대(오마주 원본 @sabrina_ramonov 공부 명령어 릴스 De4TAw2jqsu, 갈래 형식만): 첫 1.7초 약속 → 「보낸 말 → 받은 화면」 → 끝 할 일.
//   원본의 「명령어 꼬리표 → 받은 화면」 열 번을, 한 가지 일(공부 쪽 → 퀴즈 → 채점 → 틀린 것만 다시)의 네 걸음으로 바꿨다(오마주.json 「다르게」).
// 화면은 모두 2026-11-27 ChatGPT 임시 채팅(휴대폰 크기 · 어두운 화면)에 실제로 보낸 실험 E05의 화면이다(scripts/재료.py).
// 큰 글이 뜨는 초는 음성/범수/<줄>.json의 낱말 시각에 맞췄다.
export const FPS = 30;

// 말(범수) — public/vo/<id>.wav. 이해 시험 1 · 2회에 h · G 「VLOOKUP 같은 낱말을 모름」으로 N1에 「엑셀」, s · G 「답은 맨 끝이라더니 바로 채점」으로 N3를 다시 샀다
export const VO: { id: string; t: number }[] = [
  { id: 'N1', t: 0.15 }, // 엑셀 교재 사진 한 장에 한 줄을 붙였더니, 퀴즈 다섯 문제가 나왔어요.(3.65)
  { id: 'N2', t: 4.9 }, // 붙인 한 줄은 이거예요. 이 쪽으로 퀴즈 다섯 개 내 줘, 답은 맨 끝에.(3.53)
  { id: 'N3', t: 8.75 }, // 답은 숨겨 뒀다가, 보기를 누르면 그때 채점해 줘요. 틀리면 정답과 까닭까지 나와요.(5.14)
  { id: 'N4', t: 14.15 }, // 저는 다섯 개 중에 네 개를 틀렸어요.(1.79)
  { id: 'N5', t: 17.3 }, // 그래서 틀린 문제만 다시 내 줘, 했더니 그 네 문제만 다시 나왔어요.(3.64)
  { id: 'N6', t: 21.5 }, // 내일 볼 쪽 하나 찍어서, 퇴근길에 풀어 보세요.(2.56)
];
export const TOTAL = 26.3; // 마지막 말 24.06초 뒤 꼬리 2.2초 — 끝 화면(찍은 쪽과 누른 퀴즈 카드)과 끝 소리 한 방(누름 「쿵」)

// 장면이 시작하는 초 — 장면 심사 v2 · v4 · v5가 모두 넘김(볼 이유 2)이었다. 두 심사의 공통 지적(찍는 장면이 「찍는다」로 안 읽힘 · 정답이 너무 빨리 나옴 ·
// 끝에 처음과 같은 미응답 카드가 다시 뜸)으로 v5부터 인과 순서다: 찍는 손(셔터 빛 · 찰칵) → 찍힌 공부 쪽 → 흰 줄로 퀴즈 카드 → 풀어 볼 틈 → 누름(틀림 · 정답).
export const S = {
  a: 0, // 지하철에서 공부 쪽을 찍는 손(Omni) — 첫 장부터
  aFlash: 0.3, // 셔터 빛 · 찰칵
  a2: 0.6, // 찍힌 공부 쪽
  aWipe: 1.0, // 공부 쪽이 오른쪽부터 퀴즈 카드(1/5)로 쓸려 바뀐다
  aCard: 1.6, // 1/5 카드 — 문제와 보기 넷(풀어 볼 틈)
  aTap: 2.9, // A(첫 번째 행)를 누른다 → 틀림(빨강)과 정답(초록 B) · 까닭. 장면 심사 v5 「1.5~3초 문제 화면이 그대로 멈춤」으로 풀어 볼 틈을 1.3초로
  c: 4.8, // 보낸 사진 미리보기와 보낸 한 줄(실제 말풍선) — 뒤에 받은 1번 카드가 어둡게
  c2: 4.9 + 2.776, // 「답은」
  d: 8.65, // 「답은 숨겨 뒀다가」 — 말풍선이 빠지고 뒤의 1번 카드(답이 안 보이는 처음 화면)가 밝아진다
  d1: 8.75 + 1.359, // 「보기를」
  dTap: 8.75 + 2.036, // 「그때」 — 4/5에서 O를 눌러 맞음(초록)
  d2: 8.75 + 3.405, // 「틀리면」 — 2/5 틀림(빨강)과 정답 · 까닭
  e: 14.05, // 틀린 5번(채점된 모두 고르기) — 이해 시험 r4 s · h 「3번 수식이 작아 모르겠다」로 3번 대신
  f: 17.2, // 같은 대화에 이어 보낸 한 줄 「틀린 문제만 다시 내 줘.」
  fRe: 17.3 + 1.663, // 「했더니」 — 받은 답(틀린 1 · 2 · 3 · 5번만 다시 · 1/4)
  f2: 17.3 + 2.385, // 「네」
  g: 21.4, // 끝 — 찍는 손(Omni) 「내일 볼 쪽 하나 찍어서」
  gFlash: 21.5 + 0.78, // 「찍어서」 — 셔터 빛 · 찰칵
  g2: 22.55, // 찍힌 공부 쪽
  gWipe: 22.9, // 공부 쪽이 퀴즈 카드로
  gCard: 23.5,
  g3: 21.5 + 1.495, // 「퇴근길에」
  gTap: 24.3, // A를 누른다(말이 끝난 뒤) — 누른 결과와 찍은 쪽으로 닫는다
  gEnd: 24.45, // 끝 큰 글 · 찍은 쪽 사진이 카드 위에 얹힌다(이해 시험 2회 h · G 「끝이 처음 퀴즈 화면의 반복 — 흐지부지」)
};

// 위 작은 줄 — 굵은 낱말 | 옅은 설명(오른쪽 끝 920px 안). 이해 시험 r4 · r5 s 「「예시」가 무엇의 예시인지」 · h · G 「엑셀이라고 안 한다」
export const TAGS: { from: number; to: number; b: string; i: string }[] = [
  { from: S.a2, to: S.aCard, b: '찍은 쪽', i: '저희가 쓴 엑셀 공부 쪽' }, // 미학 맹검(r5) 「AI로 구운 지하철 책장 위에 『저희가 쓴 공부 쪽』」 — 실제 공부 쪽이 뜰 때부터
  { from: S.aCard, to: S.c, b: 'ChatGPT', i: '받은 엑셀 퀴즈 1번' },
  { from: S.c, to: S.d, b: 'ChatGPT', i: '사진과 함께 보낸 한 줄' },
  { from: S.d, to: S.dTap - 0.2, b: 'ChatGPT', i: '받은 퀴즈 1번' },
  { from: S.dTap - 0.2, to: S.d2, b: 'ChatGPT', i: '4번 문제' },
  { from: S.d2, to: S.e, b: 'ChatGPT', i: '2번 문제' },
  { from: S.e, to: S.f, b: 'ChatGPT', i: '5번 문제' },
  { from: S.f, to: S.g, b: 'ChatGPT', i: '같은 대화에 이어서' },
  { from: S.g2, to: S.gCard, b: '찍은 쪽', i: '저희가 쓴 엑셀 공부 쪽' },
  { from: S.gCard, to: 99, b: 'ChatGPT', i: '받은 퀴즈 1번' },
];

// 큰 글 = 말. at = 줄마다 뜨는 초(첫 줄은 구성 첫 프레임부터). [ ] = 버터 글자(화면마다 한 곳)
export type Line = { lines: string[]; from: number; to: number; at: number[]; size: number };
export const LINES: Line[] = [
  { lines: ['교재 사진 한 장으로', '[퀴즈 다섯 문제]'], from: S.a, to: S.c, at: [0, 0], size: 104 },
  { lines: ['퀴즈 다섯 개 내 줘', '답은 [맨 끝에]'], from: S.c, to: S.d, at: [S.c, S.c2], size: 92 }, // 큰 글 끝 마침표 뺌(미학 맹검 r5)
  { lines: ['답은 숨겨 뒀다가', '누르면 그때 [채점]'], from: S.d, to: S.d2, at: [S.d, S.d1], size: 92 },
  { lines: ['틀리면', '정답과 [까닭]까지'], from: S.d2, to: S.e, at: [S.d2, S.d2], size: 104 },
  { lines: ['다섯 개 중에', '[네 개] 틀렸어요'], from: S.e, to: S.f, at: [S.e, S.e], size: 104 },
  { lines: ['틀린 것만 다시 냈더니', '[네 문제]만 다시'], from: S.f, to: S.g, at: [S.f, S.f2], size: 92 },
  { lines: ['내일 볼 쪽 하나 찍어서', '[퇴근길]에 풀어 보세요'], from: S.g, to: S.gEnd, at: [S.g, S.g3], size: 88 },
  { lines: ['교재 한 쪽이', '[퀴즈 다섯 문제]로'], from: S.gEnd, to: 99, at: [S.gEnd, S.gEnd], size: 104 },
];

// 효과음 — 말머리와 겹치지 않는 자리에만. 찍음 「찰칵」, 틀림 「쿵」, 맞음 「톡」(장면 심사 v2 「오답 순간에 소리가 없다」)
export const SOUNDS: { t: number; src: string; vol: number }[] = [
  { t: S.aFlash - 0.02, src: 'sfx/shutter.wav', vol: 0.3 },
  { t: S.aWipe - 0.02, src: 'sfx/swish.wav', vol: 0.22 },
  { t: S.aTap - 0.24, src: 'sfx/tick.wav', vol: 0.22 },
  { t: S.aTap + 0.02, src: 'sfx/thud.wav', vol: 0.2 },
  { t: S.c - 0.06, src: 'sfx/pop.wav', vol: 0.18 },
  { t: S.dTap - 0.04, src: 'sfx/tick.wav', vol: 0.22 },
  { t: S.dTap + 0.06, src: 'sfx/tok.wav', vol: 0.2 },
  { t: S.d2 - 0.04, src: 'sfx/thud.wav', vol: 0.18 },
  { t: S.e - 0.05, src: 'sfx/thud.wav', vol: 0.14 },
  { t: S.f - 0.06, src: 'sfx/pop.wav', vol: 0.2 },
  { t: S.fRe - 0.03, src: 'sfx/swish.wav', vol: 0.2 },
  { t: S.gFlash - 0.02, src: 'sfx/shutter.wav', vol: 0.3 },
  { t: S.gWipe - 0.02, src: 'sfx/swish.wav', vol: 0.2 },
  { t: S.gTap - 0.24, src: 'sfx/tick.wav', vol: 0.22 },
  { t: S.gTap + 0.02, src: 'sfx/thud.wav', vol: 0.22 }, // 끝 소리 한 방(마지막 말 24.06초 뒤)
  { t: S.gEnd + 0.1, src: 'sfx/pop.wav', vol: 0.16 },
];

// 배경음(보유곡 「시티팝_147」의 28초부터 — 곡 안 빈 마디 26.25~27초 밖) — 끝까지 깔고 목소리 아래로, 끝 0.9초만 닫는다
export const BGM = { t: [0, 0.25, TOTAL - 0.9, TOTAL], v: [0.12, 0.18, 0.18, 0] };

// 한 장면 심사용(글 · 말 없이) — v5: 찍는 손(셔터 빛 · 찰칵) → 찍힌 공부 쪽 → 흰 줄로 퀴즈 카드 → 1.8초 풀어 볼 틈 → A 누름(틀림 · 정답)
// v1 { wipe: 0.9, tap: 2.4, q2: 3.9, q3: 4.8 } · 5.8초(공부 쪽부터), v2 { page: 1.3, wipe: 1.75, tap: 3.0, q2: 4.4, q3: 5.2 } · 6.0초(Omni부터),
// v3 { tap: 1.0, omni: 2.2, page: 3.1, wipe: 3.3 } · 5.2초(문제 먼저), v4 { tap: 0.9, omni: 3.0, page: 3.9, wipe: 4.6 } · 6.0초(v3의 누른 결과 2.1초 · 공부 쪽 0.7초)
export const SCENE = { flash: 0.3, page: 0.6, wipe: 1.0, card: 1.6, tap: 3.4 };
export const SCENE_DUR = 5.8;
