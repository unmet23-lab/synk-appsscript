// 「인스타 숫자 캡처 다섯 장, 클로드에게 어디서 갈렸나 묻기」 시간표(초). 말 낱말 시각(음성/범수/*.json)에 맞춘 자리다.
export const LEN = 24.1;

export const T = {
  // ① 처음 — 몽글이(Omni o1)와 「제일 잘된 릴스는」. P1 0.40 「제일 잘된 릴스는, 구십구 퍼센트가 팔로워가 아닌 사람이었어요」
  hook: 1.55, // o1이 1.4초에 눈이 커진 직후 실제 화면으로
  n99: 1.59, // 말 「구십구」 1.59
  nf: 2.37, // 말 「팔로워가」 2.37
  five: 3.85,
  // ② 다섯 편 — V2 4.10 「같은 주에 올린 다섯 편을 캡처해서, 잘된 편과 안된 편이 어디서 갈렸냐고 물었어요」
  th0: 3.85,
  thGap: 0.12,
  ask: 5.95, // 말 「잘된 편과」 6.02
  type: 6.15,
  bars: 8.45,
  // ③ 핵심 장면 — V4 8.55 「잘된 세 편은 팔로워 밖으로 퍼졌고, 안된 두 편은 몇천 회에서 멈췄대요」
  bar0: 8.6,
  barGap: 0.12,
  good: 9.24, // 말 「팔로워」 9.24
  bad: 10.5, // 말 「안된」 10.50
  scene: 12.5,
  // ④ 갈린 곳 — V5 12.60 「갈린 건 장면이었어요. 잘된 편은 한 장면에 한 마디, 안된 편은 읽어야 아는 설명이었어요」
  sGood: 14.0, // 말 「잘된 편은」 14.00
  sBad: 15.55, // 말 「안된 편은」 15.55
  six: 17.4,
  // ⑤ 여섯 번 — V6 17.55 「여섯 번을 물어도, 같은 답이었어요」
  quotes: 17.6,
  same: 18.55, // 말 「같은」 18.55
  end: 19.8,
  // ⑥ 끝 — 몽글이(Omni e1). P2 19.95 「찍을 화면이랑 물어볼 한 줄, 캡처라고 댓글 주시면 DM으로 드릴게요」
  e2: 19.97,
  cta: 21.79, // 말 「캡처라고」 21.79
} as const;

/** 키워드 DM이 없는 판의 끝 — 말 P2G 「찍을 화면이랑 물어볼 한 줄은, 게시글에 그대로 있어요」(19.95 + 낱말 시각). */
export const TG = { cta: 21.72 } as const;
export const P2G_AT = 19.95;

export const VO: { id: string; at: number }[] = [
  { id: 'P1', at: 0.4 },
  { id: 'V2', at: 4.1 },
  { id: 'V4', at: 8.55 },
  { id: 'V5', at: 12.6 },
  { id: 'V6', at: 17.55 },
  { id: 'P2', at: 19.95 },
];

export const SFX: { file: string; at: number; v: number }[] = [
  { file: 'swish', at: 1.55, v: 0.36 },
  { file: 'thud', at: 1.62, v: 0.5 },
  { file: 'swish', at: 3.85, v: 0.32 },
  { file: 'tick', at: 3.9, v: 0.3 },
  { file: 'tick', at: 4.02, v: 0.3 },
  { file: 'tick', at: 4.14, v: 0.3 },
  { file: 'tick', at: 4.26, v: 0.3 },
  { file: 'tick', at: 4.38, v: 0.3 },
  { file: 'swish', at: 5.95, v: 0.34 },
  { file: 'swish', at: 8.45, v: 0.36 },
  { file: 'tick', at: 8.6, v: 0.3 },
  { file: 'tick', at: 8.72, v: 0.3 },
  { file: 'tick', at: 8.84, v: 0.3 },
  { file: 'tick', at: 8.96, v: 0.3 },
  { file: 'tick', at: 9.08, v: 0.3 },
  { file: 'thud', at: 9.24, v: 0.48 },
  { file: 'tok', at: 10.5, v: 0.45 },
  { file: 'swish', at: 12.5, v: 0.36 },
  { file: 'tok', at: 14.0, v: 0.42 },
  { file: 'tok', at: 15.55, v: 0.42 },
  { file: 'swish', at: 17.4, v: 0.34 },
  { file: 'thud', at: 18.55, v: 0.45 },
  { file: 'swish', at: 19.8, v: 0.4 },
];

/** 끝 효과음 — 판마다 말 박자가 달라 따로 둔다. */
export const SFX_END: Record<'dm' | 'post', { file: string; at: number; v: number }[]> = {
  dm: [{ file: 'tok', at: 21.79, v: 0.42 }],
  post: [{ file: 'tok', at: 21.72, v: 0.42 }],
};

export const BGM = { file: 'bgm.wav', vol: 0.42, fadeOut: 0.6 };
