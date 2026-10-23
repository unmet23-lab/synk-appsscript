// 시간선 셈 — 영상(time.ts)과 정지컷 도구(정지컷.mjs)가 같은 것을 쓴다(둘이 따로 셈하면 어긋난다, Fable 10-23).
// 장면 끝은 고정값이 아니라 「마지막 줄 끝 + 꼬리」다. 의도한 멈춤(01 생각할 틈, 03 「자료에 있는 것만」, 06 틈 둘, 11 끝 화면)만 길게 둔다.
// 구운 줄은 실제 길이(dur)와 낱말 시각(words)을 쓰고, 아직 안 구운 줄은 음절 수로 어림한다(초당 5.2음절 — 범수 0.85배 실측).

/** @type {{id: string, lead: number, tail: number, pause?: Record<string, number>}[]} */
export const SCENE_SPECS = [
  { id: '01', lead: 0.5, tail: 0.9, pause: { a1: 1.5 } },
  { id: '02', lead: 0.7, tail: 0.9 },
  { id: '03', lead: 0.8, tail: 2.2 },
  { id: '04', lead: 0.8, tail: 1.0 },
  { id: '05', lead: 0.6, tail: 1.0 },
  { id: '06', lead: 0.6, tail: 1.0, pause: { f2: 2, f3: 3 } },
  { id: '07', lead: 0.6, tail: 1.0 },
  { id: '08', lead: 0.6, tail: 1.0 },
  { id: '09', lead: 0.8, tail: 1.0 },
  { id: '10', lead: 0.8, tail: 1.2 },
  { id: '11', lead: 0.6, tail: 5.0 },
];
export const SYL = 5.2;
export const GAP = 0.35;
const syllables = (s) => [...s].filter((ch) => /[가-힣]/.test(ch)).length;

/**
 * 큐 경계: 몽골어 글자 수 비율로 나눈 자리에서 가장 가까운 한국어 낱말 끝(쉼표·마침표 뒤를 먼저)으로 옮긴다.
 * 낱말 시각이 없으면 비율 그대로.
 */
function cueSplits(dur, mn, words) {
  const total = mn.reduce((a, m) => a + m.length, 0);
  const raw = [];
  let acc = 0;
  for (let i = 0; i < mn.length - 1; i++) {
    acc += mn[i].length;
    raw.push((dur * acc) / total);
  }
  if (!words?.length) return raw;
  return raw.map((t) => {
    let best = null;
    for (const [text, , e] of words) {
      const score = Math.abs(e - t) - (/[.,?!]$/.test(text) ? 0.6 : 0);
      if (best === null || score < best.score) best = { score, e };
    }
    return best ? best.e : t;
  });
}

/**
 * @param {{id: string, scene: string, say: string, mn: string[]}[]} lines
 * @param {{dur?: Record<string, number>, words?: Record<string, [string, number, number][]>}} vo
 * @param {number} fps
 */
export function buildTimeline(lines, vo, fps) {
  const f = (sec) => Math.round(sec * fps);
  const lineTime = {};
  const cues = [];
  const scenes = {};
  let t0 = 0;
  for (const sc of SCENE_SPECS) {
    let t = t0 + sc.lead;
    let last = t;
    for (const l of lines.filter((x) => x.scene === sc.id)) {
      const dur = vo.dur?.[l.id] ?? syllables(l.say) / SYL;
      lineTime[l.id] = { from: f(t), to: f(t + dur), sec: t, dur };
      const splits = cueSplits(dur, l.mn, vo.words?.[l.id]);
      const edges = [0, ...splits, dur];
      l.mn.forEach((m, i) => cues.push({ from: f(t + edges[i]), to: f(t + edges[i + 1]), line: l.id, text: m }));
      last = t + dur;
      t = last + GAP + (sc.pause?.[l.id] ?? 0);
    }
    const end = last + sc.tail;
    scenes[sc.id] = { from: f(t0), to: f(end) };
    t0 = end;
  }
  return { lineTime, cues, scenes, total: f(t0) };
}
