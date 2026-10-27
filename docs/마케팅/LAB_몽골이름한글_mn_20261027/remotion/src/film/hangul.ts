// 한글 음절을 마커 획(SVG 경로)으로 — 자모마다 획 순서대로, 음절 꼴(옆 모음 · 아래 모음 · 받침)에 따라 자리를 나눈다.
// 이 편에 나오는 자모만 적었다(E1 마크 · 제임스 · 그레이스 + M3 다시 살림 바트바야르의 ㅂ · ㅌ · ㅑ). 없는 자모는 렌더 전에 멈춘다.
import { handPath, Pt } from './geo';

type Stroke = { pts: Pt[]; sharp?: boolean };
type Box = { x: number; y: number; w: number; h: number };

// 0~1 칸 안의 획. 손글씨 순서(위→아래, 왼→오른).
const JAMO: Record<string, Stroke[]> = {
  ㄱ: [{ pts: [[0.08, 0.14], [0.9, 0.14], [0.86, 0.92]], sharp: true }],
  ㄹ: [
    { pts: [[0.1, 0.1], [0.88, 0.1], [0.88, 0.47]], sharp: true },
    { pts: [[0.1, 0.47], [0.88, 0.47]], sharp: true },
    { pts: [[0.1, 0.47], [0.1, 0.9], [0.92, 0.9]], sharp: true },
  ],
  ㅁ: [
    { pts: [[0.12, 0.12], [0.12, 0.9]], sharp: true },
    { pts: [[0.12, 0.12], [0.88, 0.12], [0.88, 0.9]], sharp: true },
    { pts: [[0.12, 0.9], [0.88, 0.9]], sharp: true },
  ],
  ㅅ: [
    { pts: [[0.52, 0.06], [0.42, 0.42], [0.06, 0.92]] },
    { pts: [[0.46, 0.44], [0.68, 0.74], [0.95, 0.9]] },
  ],
  ㅂ: [
    { pts: [[0.14, 0.08], [0.14, 0.92]], sharp: true },
    { pts: [[0.86, 0.08], [0.86, 0.92]], sharp: true },
    { pts: [[0.14, 0.48], [0.86, 0.48]], sharp: true },
    { pts: [[0.14, 0.92], [0.86, 0.92]], sharp: true },
  ],
  ㅇ: [{ pts: circle() }],
  ㅈ: [
    { pts: [[0.1, 0.14], [0.84, 0.14], [0.06, 0.92]], sharp: true },
    { pts: [[0.47, 0.52], [0.95, 0.92]], sharp: true },
  ],
  ㅋ: [
    { pts: [[0.08, 0.12], [0.88, 0.12], [0.84, 0.92]], sharp: true },
    { pts: [[0.12, 0.5], [0.86, 0.5]], sharp: true },
  ],
  ㅌ: [
    { pts: [[0.1, 0.1], [0.88, 0.1]], sharp: true },
    { pts: [[0.12, 0.5], [0.84, 0.5]], sharp: true },
    { pts: [[0.12, 0.1], [0.12, 0.9], [0.92, 0.9]], sharp: true },
  ],
  ㅏ: [
    { pts: [[0.35, 0.04], [0.35, 0.96]], sharp: true },
    { pts: [[0.35, 0.5], [0.82, 0.5]], sharp: true },
  ],
  ㅑ: [
    { pts: [[0.35, 0.04], [0.35, 0.96]], sharp: true },
    { pts: [[0.35, 0.34], [0.82, 0.34]], sharp: true },
    { pts: [[0.35, 0.66], [0.82, 0.66]], sharp: true },
  ],
  ㅔ: [
    { pts: [[0.04, 0.48], [0.4, 0.48]], sharp: true },
    { pts: [[0.4, 0.1], [0.4, 0.9]], sharp: true },
    { pts: [[0.8, 0.02], [0.8, 0.98]], sharp: true },
  ],
  ㅣ: [{ pts: [[0.5, 0.04], [0.5, 0.96]], sharp: true }],
  ㅡ: [{ pts: [[0.04, 0.5], [0.96, 0.5]], sharp: true }],
};

// ㅇ: 위에서 시작해 시계 반대 방향으로 한 바퀴(끝이 시작을 살짝 넘는다)
function circle(): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= 14; i += 1) {
    const a = -Math.PI / 2 - (i / 13) * Math.PI * 2;
    pts.push([0.5 + 0.42 * Math.cos(a), 0.5 + 0.42 * Math.sin(a)]);
  }
  return pts;
}

const L = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const V = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const F = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const BELOW = 'ㅗㅛㅜㅠㅡ';

const split = (ch: string) => {
  const c = ch.charCodeAt(0) - 0xac00;
  if (c < 0 || c > 11171) throw new Error(`한글 음절이 아니다: ${ch}`);
  return { l: L[Math.floor(c / 588)], v: V[Math.floor((c % 588) / 28)], f: F[c % 28] };
};

// 음절 칸(0~1) 안에서 자모 자리
const layout = (l: string, v: string, f: string): [string, Box][] => {
  if (BELOW.includes(v)) {
    if (f) throw new Error('아래 모음 + 받침 꼴은 아직 없다');
    return [[l, { x: 0.16, y: 0.04, w: 0.68, h: 0.52 }], [v, { x: 0.04, y: 0.52, w: 0.92, h: 0.3 }]];
  }
  if (f) {
    return [
      [l, { x: 0.08, y: 0.04, w: 0.46, h: 0.44 }],
      [v, { x: 0.58, y: 0.0, w: 0.3, h: 0.56 }],
      [f, { x: 0.2, y: 0.62, w: 0.6, h: 0.34 }],
    ];
  }
  if (v === 'ㅔ') return [[l, { x: 0.02, y: 0.2, w: 0.46, h: 0.6 }], [v, { x: 0.5, y: 0.04, w: 0.46, h: 0.92 }]];
  return [[l, { x: 0.04, y: 0.2, w: 0.52, h: 0.6 }], [v, { x: 0.6, y: 0.04, w: 0.32, h: 0.92 }]];
};

/** 이름 하나를 가운데 (cx, cy)에 한 변 s인 음절 칸으로 늘어놓은 획 경로들(쓰는 순서). syl = 그 획이 몇째 음절인지. */
export const nameStrokes = (name: string, cx: number, cy: number, s: number, gap: number, seed: string) => {
  const chars = [...name];
  const total = chars.length * s + (chars.length - 1) * gap;
  const out: { d: string; syl: number }[] = [];
  chars.forEach((ch, i) => {
    const { l, v, f } = split(ch);
    const sx = cx - total / 2 + i * (s + gap);
    const sy = cy - s / 2;
    layout(l, v, f).forEach(([j, b], k) => {
      const strokes = JAMO[j];
      if (!strokes) throw new Error(`획을 적지 않은 자모: ${j}`);
      strokes.forEach((st, n) => {
        const pts: Pt[] = st.pts.map(([u, w]) => [sx + (b.x + u * b.w) * s, sy + (b.y + w * b.h) * s]);
        out.push({ d: handPath(pts, { sharp: st.sharp, seed: `${seed}-${i}-${k}-${n}`, jitter: s * 0.012 }), syl: i });
      });
    });
  });
  return { strokes: out, total, sylX: chars.map((_, i) => cx - total / 2 + i * (s + gap) + s / 2) };
};

/** 물음표(끝 화면 빈 이름표) — 고리 하나 + 점. */
export const questionStrokes = (cx: number, cy: number, s: number) => {
  const p = (u: number, w: number): Pt => [cx + u * s, cy + w * s];
  return [
    handPath([p(-0.26, -0.26), p(-0.14, -0.44), p(0.06, -0.48), p(0.24, -0.36), p(0.24, -0.16), p(0.06, -0.02), p(0, 0.1), p(0, 0.2)], { seed: 'q1', jitter: 1.5 }),
    handPath([p(0, 0.4), p(0.01, 0.44)], { sharp: true, seed: 'q2', jitter: 0 }),
  ];
};
