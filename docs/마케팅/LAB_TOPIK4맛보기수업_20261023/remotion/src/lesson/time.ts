// 시간선. 목소리를 굽기 전(이미지 콘티) 판은 대사 음절 수로 어림한다 — 초당 5.5음절, 줄 사이 0.35초, 콘티의 장면 칸 시간.
// 굽고 나면 같은 모양으로 Typecast 낱말 시각(take.json)에서 만든다.
import { FPS } from './tokens';
import { LINES } from './data';
import { VO_DUR } from './vo.generated';

type SceneSpec = { id: string; start: number; end: number; lead: number; pause?: Record<string, number> };

/** 콘티 v1.1 장면 칸(초). pause = 그 줄 뒤에 더 쉬는 초(01 생각할 틈 · 06 생각할 틈과 계산 판). */
export const SCENE_SPECS: SceneSpec[] = [
  { id: '01', start: 0, end: 12, lead: 0.5, pause: { a1: 1.5 } },
  { id: '02', start: 12, end: 21, lead: 0.7 },
  { id: '03', start: 21, end: 41, lead: 0.8 },
  { id: '04', start: 41, end: 69, lead: 0.8 },
  { id: '05', start: 69, end: 95, lead: 0.6 },
  { id: '06', start: 95, end: 143, lead: 0.6, pause: { f2: 2, f3: 3 } },
  { id: '07', start: 143, end: 174, lead: 0.6 },
  { id: '08', start: 174, end: 196, lead: 0.6 },
  { id: '09', start: 196, end: 244, lead: 0.8 },
  { id: '10', start: 244, end: 255, lead: 0.8 },
  { id: '11', start: 255, end: 279, lead: 0.6 },
];

const SYL = 5.5;
const GAP = 0.35;
const syllables = (s: string) => [...s].filter((ch) => /[가-힣]/.test(ch)).length;
const f = (sec: number) => Math.round(sec * FPS);

export type Span = { from: number; to: number };
export type Cue = Span & { line: string; text: string };

export const lineTime: Record<string, Span> = {};
export const cues: Cue[] = [];
for (const sc of SCENE_SPECS) {
  let t = sc.start + sc.lead;
  for (const l of LINES.filter((x) => x.scene === sc.id)) {
    // 구운 줄은 실제 길이, 아직 안 구운 줄은 음절 수 어림.
    const dur = VO_DUR[l.id] ?? syllables(l.say) / SYL;
    lineTime[l.id] = { from: f(t), to: f(t + dur) };
    // 큐는 줄 길이를 몽골어 글자 수 비율로 나눈다.
    const total = l.mn.reduce((a, m) => a + m.length, 0);
    let c = t;
    for (const m of l.mn) {
      const d = (dur * m.length) / total;
      cues.push({ from: f(c), to: f(c + d), line: l.id, text: m });
      c += d;
    }
    t += dur + GAP + (sc.pause?.[l.id] ?? 0);
  }
}

export const SCENES: Record<string, Span> = Object.fromEntries(SCENE_SPECS.map((s) => [s.id, { from: f(s.start), to: f(s.end) }]));
export const TOTAL = f(SCENE_SPECS[SCENE_SPECS.length - 1].end);

/** 그 줄의 frac(0~1) 자리 — 전체 프레임. */
export const at = (id: string, frac = 0) => {
  const s = lineTime[id];
  if (!s) throw new Error(`없는 줄 ${id}`);
  return Math.round(s.from + (s.to - s.from) * frac);
};
export const end = (id: string) => lineTime[id].to;
