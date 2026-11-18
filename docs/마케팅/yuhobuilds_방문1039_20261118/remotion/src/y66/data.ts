// Y66 — 화면 숫자는 모두 기록 값이다(docs/마케팅/사이트방문_분석/현황_20261117.md 「1. Microsoft Clarity」 표).
// 광고 서비스 페이지 한 곳 · 11-06~11-16(11일) · 진짜 주소의 방문(세션)만 나눠 셈: 사람 17 · 로봇 1,022 = 1,039.
// 사람 17 가운데 들어온 곳이 회사 사이트인 8번과 시험 꼬리표 2번은 우리 방문일 가능성이 크다(확인 안 함) → 「10번쯤은 아마 나」.
export const TOTAL_VISITS = 1039;
export const ROBOTS = 1022;
export const HUMANS = 17;
export const MAYBE_ME = 10;

export const STAGE = '#0D0E11';
export const INK = '#F4F2EC';
export const ROBOT = '#5A5D67';
export const BUTTER = '#F5C445';

// 원근 홀: 먼 줄(위)은 작고 가까운 줄(아래)은 크다. 한 점이 방문 한 번.
export const COLS = 31;
export const ROWS = 34;
const S_FAR = 0.55;
const ROW_GAP = 40;
const PITCH = 33.6;
export const HALL_TOP = 700;

export type Fig = { i: number; r: number; c: number; x: number; y: number; s: number; human: boolean; me: boolean };

// 같은 씨앗이면 늘 같은 자리(렌더마다 같다).
const rng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

const rowScale = (r: number) => S_FAR + (1 - S_FAR) * (r / (ROWS - 1));

export const rowY: number[] = (() => {
  const ys: number[] = [];
  let y = HALL_TOP;
  for (let r = 0; r < ROWS; r++) {
    ys.push(y);
    y += ROW_GAP * rowScale(r);
  }
  return ys;
})();

export const FIGS: Fig[] = (() => {
  const out: Fig[] = [];
  let i = 0;
  for (let r = 0; r < ROWS && i < TOTAL_VISITS; r++) {
    const s = rowScale(r);
    const n = Math.min(COLS, TOTAL_VISITS - i);
    const w = PITCH * s;
    const x0 = 540 - ((n - 1) * w) / 2;
    for (let c = 0; c < n; c++) {
      out.push({ i, r, c, x: x0 + c * w, y: rowY[r], s, human: false, me: false });
      i++;
    }
  }
  // 사람 17 — 가운데 · 가까운 줄(12~30줄)에 흩어 둔다. 이웃끼리 붙지 않게.
  const pick = rng(66);
  const chosen: Fig[] = [];
  while (chosen.length < HUMANS) {
    const r = 12 + Math.floor(pick() * 19);
    const c = 2 + Math.floor(pick() * (COLS - 4));
    const f = out.find((g) => g.r === r && g.c === c);
    if (!f || f.human) continue;
    if (chosen.some((g) => Math.abs(g.r - r) <= 1 && Math.abs(g.c - c) <= 2)) continue;
    f.human = true;
    chosen.push(f);
  }
  // 그중 10 — 「아마 나」 꼬리표를 다는 자리(가까운 줄부터).
  [...chosen].sort((a, b) => b.r - a.r || a.c - b.c).slice(0, MAYBE_ME).forEach((f) => (f.me = true));
  return out;
})();

export const HUMAN_FIGS = FIGS.filter((f) => f.human);
export const HALL_BOTTOM = rowY[ROWS - 1] + 40;
