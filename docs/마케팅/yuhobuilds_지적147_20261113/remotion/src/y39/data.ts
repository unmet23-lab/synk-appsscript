// Y39 숫자 — 11-08 「되풀이 지적의 뿌리 20묶음」(docs/마케팅/제작양식/되풀이지적_원인_20261108.md 「한눈에」 · 「단계별로 보면」) 그대로.
// rep = 되풀이(서로 다른 날 · 편 · 자리에서 나온 말씀을 한 번씩), distinct = 모음(슬롭점검_모음.json)에서 그 묶음에 든 지적 수(합 147).
// plan = 주 원인 단계가 「기획 · 원본 고르기」인 묶음(G02 · G03 · G06 · G14, 되풀이 합 81).
export type Group = { id: string; rep: number; distinct: number; plan: boolean };

export const GROUPS: Group[] = [
  { id: 'G02', rep: 38, distinct: 17, plan: true },
  { id: 'G07', rep: 22, distinct: 8, plan: false },
  { id: 'G01', rep: 21, distinct: 14, plan: false },
  { id: 'G03', rep: 21, distinct: 12, plan: true },
  { id: 'G04', rep: 21, distinct: 7, plan: false },
  { id: 'G05', rep: 18, distinct: 7, plan: false },
  { id: 'G11', rep: 15, distinct: 7, plan: false },
  { id: 'G09', rep: 14, distinct: 7, plan: false },
  { id: 'G06', rep: 13, distinct: 9, plan: true },
  { id: 'G12', rep: 13, distinct: 8, plan: false },
  { id: 'G13', rep: 12, distinct: 4, plan: false },
  { id: 'G18', rep: 12, distinct: 3, plan: false },
  { id: 'G15', rep: 10, distinct: 7, plan: false },
  { id: 'G08', rep: 9, distinct: 7, plan: false },
  { id: 'G14', rep: 9, distinct: 6, plan: true },
  { id: 'G19', rep: 9, distinct: 7, plan: false },
  { id: 'G16', rep: 6, distinct: 4, plan: false },
  { id: 'G20', rep: 6, distinct: 6, plan: false },
  { id: 'G10', rep: 5, distinct: 2, plan: false },
  { id: 'G17', rep: 5, distinct: 5, plan: false },
];

export const REAL = { sessions: 224, notes: 147, groups: 20, repeats: 279, top: 38, plan: 81 };

// 결정적 난수(프레임마다 같은 값)
export const rnd = (i: number, salt = 0) => {
  const x = Math.sin(i * 127.1 + salt * 311.7 + 13.37) * 43758.5453;
  return x - Math.floor(x);
};

export type Paper = { i: number; g: number; level: number; distinct: boolean; wall: number; last: boolean };

/** 종이 279장 — 앞 147장이 벽의 쪽지(지적 하나씩), 나머지 132장은 「같은 말을 또 한 것」. */
export const PAPERS: Paper[] = (() => {
  const out: Paper[] = [];
  let i = 0;
  GROUPS.forEach((gr, g) => {
    for (let l = 0; l < gr.distinct; l++) out.push({ i: i++, g, level: l, distinct: true, wall: -1, last: false });
  });
  GROUPS.forEach((gr, g) => {
    for (let l = gr.distinct; l < gr.rep; l++) out.push({ i: i++, g, level: l, distinct: false, wall: -1, last: g === 0 && l === gr.rep - 1 });
  });
  // 벽 자리 — 묶음이 섞이게 흩는다
  const order = out.filter((p) => p.distinct).map((p) => p.i).sort((a, b) => rnd(a, 5) - rnd(b, 5));
  order.forEach((id, slot) => {
    out[id].wall = slot;
  });
  return out;
})();
