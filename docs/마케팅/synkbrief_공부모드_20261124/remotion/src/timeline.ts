// synkbrief B72 「ChatGPT 공부하기 — 답만 달라고 해도 힌트로 되묻게 하기」 시간표 — 장면 · 말 · 소리 한 곳(초).
// 뼈대(이해 시험 1회로 다시 짬 — 「첫 2초가 멈춤」 · 「힌트만 뒤에 바로 답이 와 앞뒤가 안 맞음」 · 「끝이 안내로 흐지부지」):
//   문제 먼저 — 공부하기만 켠 채팅에 「그냥 답만 알려 줘」 → 1.25초 「정답: x = 7」 → 3.55초 한 줄을 붙인 채팅은 같은 말에 「아까 약속한 대로 정답 대신 힌트를 줄게!」
//   → 켜는 곳(+ → 「공부」 → 공부하기)과 사진에 붙이는 한 줄 → 실제로 보낸 한 줄과 ChatGPT의 약속 → 아이가 빈칸을 하나씩(6 → 맞아! · 14 → 정확해!)
//   → 7 → 「정답이야! 🎉 스스로 문제를 잘 풀었어.」 → 끝 3초 붙인 한 줄과 「스스로 문제를 잘 풀었어」를 함께 크게 두고 「아래 글에」.
// 화면은 모두 2026-11-24 ChatGPT에서 실제로 받은 것(실험 E11~E17, 밝은 화면으로 찍음 — scripts/재료.py)이다. 아이 대신 우리가 답을 쳤다.
// 큰 글이 뜨는 초는 음성/범수/<줄>.json의 낱말 시각에 맞췄다.
export const FPS = 30;

export type Variant = 'ig' | 'yt';
// cta2At = 둘째 줄 「적어 뒀어요」가 뜨는 초 — 말의 「적어」에 맞춘다(원본 끝 자리 54.1초 ↔ 우리 22.6초, 오마주 나란히 「뼈대 자리」)
export const END: Record<Variant, { vo: string; dur: number; ctaAt: number; cta2At: number; cta: string[] }> = {
  ig: { vo: 'N7', dur: 2.427, ctaAt: 0.848, cta2At: 1.716, cta: ['아래 글에 그대로', '[적어 뒀어요]'] }, // 「아래」 0.848 · 「적어」 1.716
  yt: { vo: 'N7Y', dur: 2.173, ctaAt: 0.85, cta2At: 1.463, cta: ['고정 댓글에 그대로', '[적어 뒀어요]'] }, // 「고정」 0.643 — 앞 글이 뜬 뒤 5/6초를 넘기려 0.85 · 「적어」 1.463
};

// 장면이 시작하는 초
export const S = {
  hook: 0, // 문제 먼저 — 공부하기만 켠 채팅: 빈칸 질문 · 「그냥 답만 알려 줘」 → 「정답: x = 7」(1.25)
  fix: 3.55, // 한 줄을 붙인 채팅: 같은 질문 · 같은 말 → 「아까 약속한 대로 정답 대신 힌트를 줄게! 😊」 · 힌트(5.2 「힌트만」)
  turn: 6.3, // 켜는 곳 — + 메뉴(6.3) → 「공부」를 쳐서 뜬 「공부하기」(7.31 「공부하기를」) → 사진 · 공부하기 · 한 줄이 든 입력 칸(8.45 「사진에」)
  turnStudy: 6.4 + 0.909,
  turnPhoto: 6.4 + 2.049,
  guard: 10.1, // 실제로 보낸 한 줄(말풍선) → ChatGPT의 약속(11.57 「힌트로」)
  guardAck: 10.2 + 1.372,
  fill: 13.0, // 아이가 빈칸을 하나씩 — 6 → 맞아! 잘했어 · 14 → 정확해!
  last: 18.1, // 7 → 정답이야! 🎉 스스로 문제를 잘 풀었어.
  end: 20.8, // 끝 — 붙인 한 줄과 「스스로 문제를 잘 풀었어」를 함께 크게
};
export const N7_AT = 20.9;
export const PLAIN_ANSWER = 1.25; // 「정답: x = 7」이 뜨는 초(「하면,」 뒤)
export const HINT_AT = 3.65 + 1.553; // 「힌트만」
export const totalOf = (v: Variant) => Math.round((N7_AT + END[v].dur + 0.95) * 10) / 10;

// 말(범수) — public/vo/<id>.wav
export const VO: { id: string; t: number }[] = [
  { id: 'N1', t: 0.15 }, // 아이가 답만 알려 달라고 하면, 공부하기를 켜도 바로 답이 나와요.(3.21)
  { id: 'N2', t: 3.65 }, // 한 줄을 붙이면, 같은 말에도 힌트만 줘요.(2.30)
  { id: 'N3', t: 6.4 }, // 입력 칸 플러스에서 공부하기를 고르고, 사진에 이 한 줄을 붙여요.(3.35)
  { id: 'N4', t: 10.2 }, // 답만 알려 달라고 해도, 힌트로 다시 물어봐 줘.(2.41 — 실제로 보낸 한 줄 원문)
  { id: 'N5', t: 13.1 }, // 그러면 아이가 빈칸을 하나씩 채워요.(1.77)
  { id: 'N6', t: 18.2 }, // 마지막 답은, 아이가 직접 찾아요.(2.20)
];

// 위 작은 줄 — 굵은 낱말 | 옅은 설명
export const TAGS: { from: number; to: number; b: string; i: string }[] = [
  { from: S.hook, to: S.fix, b: 'ChatGPT 공부 모드', i: '공부하기만 켰어요' }, // 이해 시험 1 · 2회 s · h 「공부하기가 무엇인지 모름」
  { from: S.fix, to: S.turn, b: 'ChatGPT 공부 모드', i: '공부하기 + 한 줄을 붙였어요' },
  { from: S.turn, to: S.guard, b: 'ChatGPT 앱', i: '입력 칸의 + 메뉴' },
  { from: S.guard, to: S.fill, b: 'ChatGPT 앱', i: '실제로 보낸 한 줄' },
  { from: S.fill, to: S.end, b: 'ChatGPT 앱', i: '아이 대신 저희가 답해 봤어요' },
  { from: S.end, to: 99, b: 'SYNK 브리핑', i: '저희가 만든 문제로 해 봤어요' },
];

// 큰 글 = 말. at = 줄마다 뜨는 초(첫 줄은 구성 첫 프레임부터). [ ] = 버터 글자(화면마다 한 곳)
// 새 글은 앞 글이 뜬 뒤 5/6초 안에 띄우지 않는다(화면 글 머무름) — 낱말이 가까우면 두 줄을 함께 띄운다
export type Line = { lines: string[]; from: number; to: number; at: number[]; size: number };
export const LINES: Line[] = [
  { lines: ['공부하기를 켜도', '[답만 알려 줘] 하면', '답이 바로 나와요'], from: S.hook, to: S.fix, at: [0, 0, 0], size: 96 },
  { lines: ['[한 줄]을 붙이면', '같은 말에도', '힌트만 줘요'], from: S.fix, to: S.turn, at: [S.fix, 3.65 + 1.02, 3.65 + 1.02], size: 104 },
  { lines: ['입력 칸 +에서', '[공부하기]를 고르고', '사진에 한 줄 붙이기'], from: S.turn, to: S.guard, at: [S.turn, S.turnStudy, S.turnPhoto], size: 96 },
  { lines: ['「답만 알려 달라고 해도', '힌트로 [다시 물어봐 줘]」'], from: S.guard, to: S.fill, at: [S.guard, S.guardAck], size: 84 },
  { lines: ['아이가 빈칸을', '[하나씩] 채워요'], from: S.fill, to: S.last, at: [S.fill, S.fill], size: 110 },
  { lines: ['마지막 답은', '[아이가] 직접 찾아요'], from: S.last, to: S.end, at: [S.last, 18.2 + 1.108], size: 108 },
];
export const END_LINES = { lines: ['[이 한 줄]'], at: [S.end], size: 120 }; // 이해 시험 2회 h 「켜는 법을 말하는데 화면에 없다」 — 끝 말은 붙인 한 줄만 가리킨다

// 빈칸 채우기 — 단계마다 식 · 질문 → 아이 답 말풍선 → 칭찬 줄과 같은 자리의 채워진 식(다음 답에 실제로 나온 식). 글 · 값은 받은 화면 그대로다
export const STAGES: { at: number; eq: string; q: string; b: string; bAt: number; ok: string[]; okAt: number; fill?: string; pre?: string }[] = [
  { at: S.fill, eq: 'g_eq1', q: 'g_hint', b: 'g_b6', bAt: 13.1 + 0.661, ok: ['g_ok6'], okAt: 14.6, fill: 'g_f6' }, // 「빈칸을」
  { at: 15.45, pre: 'g_move', eq: 'g_eq2', q: 'g_ask2', b: 'g_b14', bAt: 16.3, ok: ['g_ok14'], okAt: 17.15, fill: 'g_f14' },
  { at: S.last, eq: 'g_eq3', q: 'g_ask3', b: 'g_b7', bAt: 18.2 + 0.402, ok: ['g_ok7a', 'g_ok7b'], okAt: 18.2 + 1.108 }, // 「답은」 · 「아이가」
];

// 효과음 — 말머리와 겹치지 않는 자리에만
export const SOUNDS: { t: number; src: string; vol: number }[] = [
  { t: PLAIN_ANSWER, src: 'sfx/thud.wav', vol: 0.22 },
  { t: S.fix - 0.06, src: 'sfx/swish.wav', vol: 0.2 },
  { t: HINT_AT, src: 'sfx/tick.wav', vol: 0.18 },
  { t: S.turn - 0.06, src: 'sfx/swish.wav', vol: 0.2 },
  { t: S.turnStudy - 0.04, src: 'sfx/tick.wav', vol: 0.18 },
  { t: S.turnPhoto - 0.04, src: 'sfx/tick.wav', vol: 0.2 },
  { t: S.guard - 0.06, src: 'sfx/swish.wav', vol: 0.2 },
  { t: S.fill - 0.06, src: 'sfx/swish.wav', vol: 0.18 },
  ...STAGES.flatMap((st) => [
    { t: st.bAt, src: 'sfx/pop.wav', vol: 0.18 },
    { t: st.okAt, src: 'sfx/tick.wav', vol: 0.17 },
  ]),
  { t: S.end - 0.08, src: 'sfx/swish.wav', vol: 0.22 },
];

// 배경음(보유곡 「따뜻_118」의 10초부터 27초 — −38dB 0.6초 넘는 무음 없음) — 끝까지 깔고 목소리 아래로, 끝 0.9초만 닫는다
export const bgmOf = (total: number) => ({ t: [0, 0.25, total - 0.9, total], v: [0.14, 0.24, 0.24, 0] });

// 한 장면 심사용 구성(scene, 6초) — 한 줄을 붙인 채팅을 실제 차례대로: 붙인 한 줄과 약속 → 빈칸 질문 → 「그냥 답만 알려 줘」 → 「약속한 대로 정답 대신 힌트」 → 6 → 「맞아! 잘했어」
export const SCENE_DUR = 6.0;
export const SCENE_CHAT: { n: string; at: number; k: number; r?: boolean; c?: boolean }[] = [
  { n: 'g_bubble', at: 0, k: 1.05, r: true },
  { n: 'g_ack', at: 0, k: 0.95 },
  { n: 'g_eq0', at: 0.9, k: 1.35, c: true },
  { n: 'g_ask0', at: 0.9, k: 1.12 },
  { n: 'g_bubble2', at: 1.9, k: 1.12, r: true },
  { n: 'g_refuse', at: 2.9, k: 1.1 },
  { n: 'g_hint', at: 2.9, k: 1.12 },
  { n: 'g_b6', at: 4.1, k: 1.15, r: true },
  { n: 'g_ok6', at: 5.0, k: 1.2 },
];
export const SCENE_SOUNDS: { t: number; src: string; vol: number }[] = [
  { t: 1.9, src: 'sfx/pop.wav', vol: 0.18 },
  { t: 2.9, src: 'sfx/tick.wav', vol: 0.17 },
  { t: 4.1, src: 'sfx/pop.wav', vol: 0.18 },
  { t: 5.0, src: 'sfx/tick.wav', vol: 0.17 },
];
