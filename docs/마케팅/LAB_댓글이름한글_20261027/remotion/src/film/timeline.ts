// 시간표(초) — 획은 길이로 쓰는 시간을 정하고, 말은 다 쓴 뒤에 붙인다. 목소리 길이는 public/vo/*.json의 dur.
// v2(첫 렌더 이해 시험 3점 뒤): 첫 말이 「Comment your name…」, 되짚기 판을 빼고 「by sound」를 Grace 이름표 위에서,
// 이름표는 옆으로 밀지 않고 새 스티커를 위에 붙인다.
import { getLength, getPointAtLength } from '@remotion/paths';
import { nameStrokes, questionStrokes } from './hangul';
import type { Pt } from './geo';

export const FPS = 30;
export const fr = (s: number) => Math.round(s * FPS);

// 화면 자리(1080×1920)
export const STICKER = { x: 90, y: 660, w: 900, h: 560, band: 180, foot: 46 };
// s 186: 이해 시험을 넘은 v3 크기. 166으로 줄인 최종본은 시험 두 번 3점이라 되돌렸다 — 「그레이스」 오른쪽 끝이
// 카메라가 다가가는 끝에서 오른쪽 단추 안전선(920px)을 조금 넘는 것은 검사 「확인할 것」으로 남긴다.
export const WRITE = { cx: 540, cy: 995, s: 186, gap: 10 };

export const VO = { h0: 2.309, k1: 0.814, e2: 0.947, k2: 0.748, e3: 0.607, k3: 0.687, e4: 3.707, e5: 2.862, k4: 2.832, e6: 3.569 };
// e4 「Four」 2.136초 · k4 「그 · 레 · 이 · 스」 0.01 · 0.679 · 1.548 · 2.368초 · e6 「Comment」 0.875초 · 「write」 2.363초
const E4_FOUR = 2.136;
const K4_SYL = [0.01, 0.679, 1.548, 2.368];

const LEN = new Map<string, number>();
export const len = (d: string) => {
  if (!LEN.has(d)) LEN.set(d, getLength(d));
  return LEN.get(d)!;
};
export const at = (d: string, p: number): Pt => {
  const q = getPointAtLength(d, len(d) * Math.min(1, Math.max(0, p)));
  return q ? [q.x, q.y] : [0, 0];
};

export type Timed = { d: string; syl: number; t: readonly [number, number] };

// 마커 속도: 획은 1초에 1150px 안팎(짧은 획도 0.09초는 걸린다), 획 사이 옮김은 거리에 따라
const schedule = (strokes: { d: string; syl: number }[], start: number): Timed[] => {
  let t = start;
  return strokes.map((s, i) => {
    if (i > 0) {
      const a = at(strokes[i - 1].d, 1), b = at(s.d, 0);
      t += Math.min(0.13, Math.max(0.05, Math.hypot(b[0] - a[0], b[1] - a[1]) / 2600));
    }
    const dur = Math.min(0.24, Math.max(0.09, len(s.d) / 1150));
    const out = { ...s, t: [t, t + dur] as const };
    t += dur;
    return out;
  });
};

const mk = (ko: string, start: number, seed: string) => {
  const n = nameStrokes(ko, WRITE.cx, WRITE.cy, WRITE.s, WRITE.gap, seed);
  const strokes = schedule(n.strokes, start);
  return { strokes, sylX: n.sylX, end: strokes[strokes.length - 1].t[1] };
};

// ── 첫 이름: 0초에 이미 쓰는 중(첫 프레임이 빈 이름표가 아니게), 그동안 「Comment your name…」 ──
const W1 = mk('마크', -0.7, 'mark'); // v3: 0초에 ㅁ이 이미 다 쓰여 있게(v2 이해 시험 「0~2초 빈 칸」)
const h0 = 0.1;
const k1 = Math.max(W1.end + 0.08, h0 + VO.h0 + 0.1);
const out1 = k1 + VO.k1 + 0.22;

// ── 둘째: 새 스티커를 위에 붙인다 ──
const in2 = out1;
const e2 = in2 + 0.15;
const W2 = mk('제임스', in2 + 0.25, 'james');
const k2 = Math.max(W2.end + 0.08, e2 + VO.e2 + 0.1);
const out2 = k2 + VO.k2 + 0.22;

// ── 셋째 + 「1 → 4」 + 「by sound」 ──
const in3 = out2;
const e3 = in3 + 0.15;
const W3 = mk('그레이스', in3 + 0.25, 'grace');
const k3 = Math.max(W3.end + 0.08, e3 + VO.e3 + 0.1);
const e4 = k3 + VO.k3 + 0.12;
const e5 = e4 + VO.e4 + 0.05;
// v3: 「by sound」를 실제 소리로 — 한국어로 「그, 레, 이, 스」를 읽으며 칸이 하나씩 튄다(v2 이해 시험 「by sound가 와닿지 않는다」)
const k4 = e5 + VO.e5 + 0.08;
const out3 = k4 + VO.k4 + 0.15;

// ── 끝: 빈 이름표 ──
const end = out3;
const e6 = end + 0.2;
const QS = questionStrokes(WRITE.cx, WRITE.cy, WRITE.s);
const q0 = end + 0.35;
const q0d = Math.min(0.5, len(QS[0]) / 900);
const Q: Timed[] = [
  { d: QS[0], syl: 0, t: [q0, q0 + q0d] },
  { d: QS[1], syl: 0, t: [q0 + q0d + 0.12, q0 + q0d + 0.2] },
];
// 끝 정지 0.96초 — 길이를 정지 검사의 0.5초 칸 끝(25.0초)에 맞춘다(현장 노트 영상 「CBR 10M 판의 정지 판정」)
const total = Math.max(25.0, e6 + VO.e6 + 0.9);

export const CARDS = [
  { en: 'Mark', ko: '마크', rom: ['ma', 'keu'], w: W1, in: -1, out: out1, e: h0, k: k1 },
  { en: 'James', ko: '제임스', rom: ['je', 'im', 'seu'], w: W2, in: in2, out: out2, e: e2, k: k2 },
  { en: 'Grace', ko: '그레이스', rom: ['geu', 're', 'i', 'seu'], w: W3, in: in3, out: out3, e: e3, k: k3 },
] as const;

export const T = {
  slap: 0.18,
  e4,
  one: e4 + 0.06, // 「One syllable」
  four: e4 + E4_FOUR, // 「Four in Korean!」
  e5,
  k4,
  syl: K4_SYL.map((s) => k4 + s), // 그 · 레 · 이 · 스가 들리는 때
  end,
  e6,
  comment: e6 + 0.875,
  write: e6 + 2.363,
  total,
};
export const QMARK = Q;
export const TOTAL_FRAMES = fr(total);
