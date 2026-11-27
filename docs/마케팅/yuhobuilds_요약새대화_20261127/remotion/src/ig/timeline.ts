// 「대화가 길어지면 요약 한 장 들고 새 대화로」 시간표(초). 말 낱말 시각(음성/범수/*.json)에 맞춘 자리다.
// r2(11-27 09:40): 이해 시험 r1 · Fable 사실 검수를 받아 P1(「다시 읽는 대화가」)과 V2(「그만큼 한도도 빨리 닿고요」)를 다시 사서 V2부터 뒤가 1.65초 밀렸다.
/** 인스타 판(키워드 DM) 길이 · 게시글판 길이 — 마지막 말 뒤 꼬리는 1초 안(제작 절차 「말 없는 자리와 꼬리」). */
export const LEN = 24.6;
export const LEN_POST = 23.6;

export const T = {
  // ① 처음 — 몽글이(Omni o1c)가 대화 종이 더미에 파묻혀 1.2초에 땀방울. P1 0.40 「대화가 길어졌을 때 요약 한 장 들고 새 대화로 갔더니, 다시 읽는 대화가 이십육분의 일이 됐어요」
  hook: 1.95, // 말 「새」 2.05 직전에 결과 화면으로
  bars: 2.25,
  n26: 4.0, // 말 「이십육분의」 4.01
  grow: 5.35,
  // ② 쌓임 — V2 5.45 「한 대화로 오래 일하면, 클로드는 말 한 번마다 앞의 대화까지 다 읽어요. 그만큼 한도도 빨리 닿고요」
  page0: 5.5,
  pageGap: 0.17,
  all: 7.64, // 말 「앞의」 7.64
  limit: 9.02, // 말 「그만큼」 9.02
  ask: 10.5,
  // ③ 보낸 말 — V3 10.60 「그래서 지금까지 정한 것과 남은 일만, 요약해 달라고 했어요」
  type: 10.9, // 말 「지금까지」 10.92
  last: 12.55, // 말 「요약해」 12.58
  key: 13.7,
  // ④ 핵심 장면 — V4 13.80 「그 요약을 새 대화 첫 말에 붙이고 같은 표를 시켰더니, 이만큼 줄었어요」
  sum: 14.0, // 말 「요약을」 14.00
  first: 14.35, // 말 「새」 14.35
  same: 15.7, // 말 「표를」 15.73
  drop: 16.53, // 말 「이만큼」 16.53
  table: 17.5,
  // ⑤ 같은 표 — V5 17.60 「중간에 바꾼 할인 조건도, 표에 그대로 들어갔어요」
  sale: 18.24, // 말 「할인」 18.24
  end: 20.25,
  // ⑥ 끝 — 몽글이(Omni e1). P2 20.40 「요약 받는 한 줄은, 댓글에 요약이라고 남기시면 DM으로 보내 드려요」
  cta: 21.75, // 말 「요약이라고」 21.75
} as const;

/** 키워드 DM이 없는 판의 끝 — 말 P2G 「요약 받는 한 줄은, 게시글에 그대로 적어 뒀어요」(20.40 + 낱말 시각). */
export const TG = { cta: 21.34 } as const;
export const P2G_AT = 20.4;

export const VO: { id: string; at: number }[] = [
  { id: 'P1', at: 0.4 },
  { id: 'V2', at: 5.45 },
  { id: 'V3', at: 10.6 },
  { id: 'V4', at: 13.8 },
  { id: 'V5', at: 17.6 },
  { id: 'P2', at: 20.4 },
];

// 잰 값(시안/실험/잰값.json) — 기준선 68,569토큰을 뺀 「대화 몫」
export const LONG13 = 39283;
export const NEW1 = 1497;
/** 보낸 말 1~13의 대화 몫과 그 말이 든 쪽(시안/화면/shots.json 「보낸말위치」의 y ÷ 1600). */
export const MSGS: { n: number; v: number; page: number }[] = [
  { n: 1, v: 228, page: 0 },
  { n: 2, v: 1374, page: 0 },
  { n: 3, v: 2232, page: 1 },
  { n: 4, v: 4321, page: 2 },
  { n: 5, v: 6661, page: 3 },
  { n: 6, v: 8713, page: 5 },
  { n: 7, v: 11759, page: 6 },
  { n: 8, v: 20640, page: 8 },
  { n: 9, v: 23396, page: 9 },
  { n: 10, v: 27243, page: 11 },
  { n: 11, v: 30858, page: 12 },
  { n: 12, v: 36315, page: 13 },
  { n: 13, v: 39283, page: 15 },
];
export const PAGES = 16;

export const SFX: { file: string; at: number; v: number }[] = [
  { file: 'swish', at: 1.95, v: 0.36 },
  { file: 'tick', at: 2.25, v: 0.3 },
  { file: 'tick', at: 2.45, v: 0.3 },
  { file: 'thud', at: 4.0, v: 0.5 },
  { file: 'swish', at: 5.35, v: 0.32 },
  ...Array.from({ length: 16 }, (_, i) => ({ file: 'tick', at: +(5.5 + i * 0.17).toFixed(2), v: 0.22 })),
  { file: 'thud', at: 7.64, v: 0.4 },
  { file: 'tok', at: 9.02, v: 0.42 },
  { file: 'swish', at: 10.5, v: 0.34 },
  { file: 'tok', at: 12.55, v: 0.4 },
  { file: 'swish', at: 13.7, v: 0.36 },
  { file: 'tok', at: 14.0, v: 0.4 },
  { file: 'tick', at: 15.7, v: 0.3 },
  { file: 'thud', at: 16.53, v: 0.5 },
  { file: 'swish', at: 17.5, v: 0.34 },
  { file: 'tok', at: 18.24, v: 0.42 },
  { file: 'swish', at: 20.25, v: 0.4 },
];

/** 끝 효과음 — 판마다 말 박자가 달라 따로 둔다. */
export const SFX_END: Record<'dm' | 'post', { file: string; at: number; v: number }[]> = {
  dm: [{ file: 'tok', at: 21.75, v: 0.42 }],
  post: [{ file: 'tok', at: 21.34, v: 0.42 }],
};

export const BGM = { file: 'bgm.wav', vol: 0.42, fadeOut: 0.6 };
