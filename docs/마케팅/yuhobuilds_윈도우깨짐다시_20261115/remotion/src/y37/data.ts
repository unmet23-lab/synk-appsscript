// 두 드라이브 칸 데이터 — 숫자는 11-07 실제 정리 기록(지우던 회차 16:00:49 ~ 17:09:18) 그대로.
// 칸 하나 = 같은 용량(1TB · 2TB 칸 밀도가 같다). 칸 위치 · 짝은 씨앗 고정이라 어느 프레임을 뽑아도 같다.

export const GB_PER_CELL = 952.6 / 1536; // 1TB 칸 64×24 = 1536칸이 실제 C: 크기 952.6GB(기록의 GB = 1024³과 같은 단위 · 11-12 Get-Volume 바이트 ÷ 1024³)

export const REAL = {
  cSize: 952.6,
  dSize: 1906.6,
  cFreeBefore: 78.7,
  cFreeAfter: 298.4,
  dFreeBefore: 898.7,
  dFreeAfter: 1383.1,
  cOld: 222.6, // 1TB에 남아 있던 옛 사본(2TB로 옮긴 것과 같은 파일)
  dBackupSame: 479.2, // 2TB 백업 가운데 1TB와 같은 파일
  kept: 79.5, // 1TB에 없거나 달라진 옛 판 — 남김
  total: 701.9, // 기록 끝 줄 「지움 합 701.9GB」
  files: 4718952, // 240,955 + 133,613 + 15 + 278 + 3,469 + 4,340,622
  keptFiles: 496931,
  minutes: 68,
} as const;

export const COLS = 64;
export const C_ROWS = 24;
export const D_ROWS = 48;
export const C_N = COLS * C_ROWS;
export const D_N = COLS * D_ROWS;

const cells = (gb: number) => Math.round(gb / GB_PER_CELL);

export const C_USED0 = cells(REAL.cSize - REAL.cFreeBefore); // 1417
export const C_USED1 = cells(REAL.cSize - REAL.cFreeAfter); // 1088
export const D_USED0 = cells(REAL.dSize - REAL.dFreeBefore); // 1725
export const D_USED1 = cells(REAL.dSize - REAL.dFreeAfter); // 997
export const C_DEL = C_USED0 - C_USED1; // 1TB에서 빠지는 칸
export const D_DEL = D_USED0 - D_USED1; // 2TB에서 빠지는 칸
export const KEPT = cells(REAL.kept); // 119

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 쓰인 칸 가운데서 덩이(폴더처럼 붙은 칸들)로 n칸을 고른다. */
function pickRuns(r: () => number, used: number, n: number, avoid: Set<number>, runs: number[]): number[] {
  const out: number[] = [];
  const taken = new Set(avoid);
  for (const len of runs) {
    let guard = 0;
    while (guard++ < 400) {
      const start = Math.floor(r() * (used - len));
      let ok = true;
      for (let k = 0; k < len; k++) if (taken.has(start + k)) { ok = false; break; }
      if (!ok) continue;
      for (let k = 0; k < len; k++) { taken.add(start + k); out.push(start + k); }
      break;
    }
  }
  // 모자라면 낱칸으로 채운다
  while (out.length < n) {
    const i = Math.floor(r() * used);
    if (!taken.has(i)) { taken.add(i); out.push(i); }
  }
  return out.slice(0, n);
}

/** 덩이 길이를 실제 비율대로 나눈다. */
const split = (n: number, parts: number[]) => {
  const sum = parts.reduce((a, b) => a + b, 0);
  const res = parts.map((p) => Math.max(1, Math.round((n * p) / sum)));
  return res;
};

const r = rng(20261107);

// 1TB: 지울 옛 사본 다섯 덩이(110.2 · 70.8 · 16.5 · 8.6 · 16.5GB)
export const C_DEL_IDX = pickRuns(r, C_USED0, C_DEL, new Set(), split(C_DEL, [110.2, 70.8, 16.5, 8.6, 16.5]).flatMap((l) => (l > 40 ? [Math.ceil(l / 3), Math.ceil(l / 3), l - 2 * Math.ceil(l / 3)] : [l])));
const cDelSet = new Set(C_DEL_IDX);
// 1TB에 남는 칸 가운데 2TB 백업과 같은 파일(짝) — 백업에서 빠질 칸 수만큼
const cKeep = Array.from({ length: C_USED0 }, (_, i) => i).filter((i) => !cDelSet.has(i));
export const C_TWIN_IDX = pickRuns(r, cKeep.length, D_DEL, new Set(), split(D_DEL, Array.from({ length: 14 }, () => 1)).flatMap((l) => [Math.ceil(l / 2), l - Math.ceil(l / 2)])).map((k) => cKeep[k]);

// 2TB: 앞쪽은 옮긴 자료(1TB 옛 사본의 짝), 그다음 백업(같은 파일 + 남길 옛 판), 그다음 다른 자료
const dMoved = Array.from({ length: C_DEL }, (_, i) => i); // 0 .. C_DEL-1
const dBackupStart = C_DEL + 90; // 옮긴 자료 뒤 다른 자료 조금
const dBackupLen = D_DEL + KEPT;
const backup = Array.from({ length: dBackupLen }, (_, i) => dBackupStart + i);
const kr = rng(1109);
const keptPick = new Set<number>();
// 남길 옛 판은 백업 곳곳에 작은 덩이로
while (keptPick.size < KEPT) {
  const at = Math.floor(kr() * (dBackupLen - 6));
  const len = 2 + Math.floor(kr() * 5);
  for (let k = 0; k < len && keptPick.size < KEPT; k++) keptPick.add(at + k);
}
export const D_KEPT_IDX = backup.filter((_, i) => keptPick.has(i));
export const D_DEL_IDX = backup.filter((_, i) => !keptPick.has(i));
export const D_TWIN_IDX = dMoved;

/** 짝: [지울 칸의 판(0=1TB · 1=2TB), 지울 칸, 남는 짝 칸]. 훑는 순서는 섞어서 두 판이 함께 켜진다. */
export type Pair = [0 | 1, number, number, number];
const pr = rng(77);
const pairsRaw: Pair[] = [
  ...C_DEL_IDX.map((i, k) => [0, i, D_TWIN_IDX[k], pr()] as Pair),
  ...D_DEL_IDX.map((i, k) => [1, i, C_TWIN_IDX[k], pr()] as Pair),
];
// 훑기 순서: 화면 위치(가로)와 조금의 흔들림 — 왼쪽에서 오른쪽으로 쓸고 지나간다
export const PAIRS = pairsRaw
  .map((p) => {
    const col = (p[0] === 0 ? p[1] : p[2]) % COLS;
    return [p[0], p[1], p[2], col / COLS + p[3] * 0.18] as Pair;
  })
  .sort((a, b) => a[3] - b[3]);
