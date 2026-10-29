// 다시 살림(10-28) 시간표(초) — Grace는 한 칸을 다 쓸 때마다 그 소리(그 · 레 · 이 · 스)가 들리고 칸 위 숫자가 1 → 4로
// 오른다(쓰는 박자 = 세는 박자). 첫 렌더는 예시 둘(Mark → Grace)이었고 고침 2에서 Grace 하나로 줄였다(아래).
// 목소리 길이는 public/vo2/pick/*.json의 dur. 획 · 음절 꼴은 film/hangul.ts 그대로.
// 영어 해설 둘(e4s · e6)은 10-29에 하나 → 소진으로 다시 구웠다 — 길이 · 낱말 시각을 그 줄 파일에서 바로 읽어
// 줄을 바꿔도 시간표가 따라간다(옛 하나 판은 public/vo2/pick_하나/).
import { nameStrokes, questionStrokes } from '../film/hangul';
import { at, fr, FPS, len, STICKER, Timed, WRITE } from '../film/timeline';
import e4sVo from '../../public/vo2/pick/e4s.json';
import e6Vo from '../../public/vo2/pick/e6.json';

export { at, fr, FPS, len, STICKER, WRITE };
export type { Timed };

const wordAt = (vo: { words: { text: string; start: number }[] }, text: string) => {
  const w = vo.words.find((x) => x.text.replace(/[^A-Za-z']/g, '') === text);
  if (!w) throw Error(`목소리 줄에 낱말 ${text}이 없다`);
  return w.start;
};

// 고침 1(첫 렌더 이해 시험 3점 — 4~6초 빈 이름표에 「One syllable」만 들려 넘김): 「Grace?」 뒤 곧바로 쓰고,
// 다 쓴 뒤 첫 판 v3(시험 통과)의 한 줄 「One syllable in English. Four in Korean!」으로 받친다.
export const VO = { h0: 0.62, k3: 1.052, e4: e4sVo.dur, e6: e6Vo.dur, g: [0.407, 0.479, 0.457, 0.579] };
const E4_ONE = wordAt(e4sVo, 'One'); // 「One sound」
const E4_FOUR = wordAt(e4sVo, 'Four');
const E6 = { comment: wordAt(e6Vo, 'Comment'), write: wordAt(e6Vo, 'write') };

// 마커 속도는 첫 판과 같다: 획은 1초에 1150px 안팎, 획 사이 옮김은 거리에 따라
const strokeDur = (d: string) => Math.min(0.24, Math.max(0.09, len(d) / 1150));
const moveDur = (a: string, b: string) => {
  const p = at(a, 1), q = at(b, 0);
  return Math.min(0.13, Math.max(0.05, Math.hypot(q[0] - p[0], q[1] - p[1]) / 2600));
};
const schedule = (strokes: { d: string; syl: number }[], start: number, sylPause = 0): Timed[] => {
  let t = start;
  return strokes.map((s, i) => {
    if (i > 0) t += moveDur(strokes[i - 1].d, s.d) + (s.syl !== strokes[i - 1].syl ? sylPause : 0);
    const out = { ...s, t: [t, t + strokeDur(s.d)] as const };
    t = out.t[1];
    return out;
  });
};
const mk = (ko: string, start: number, seed: string, sylPause = 0) => {
  const n = nameStrokes(ko, WRITE.cx, WRITE.cy, WRITE.s, WRITE.gap, seed);
  const strokes = schedule(n.strokes, start, sylPause);
  const sylEnd = n.sylX.map((_, k) => Math.max(...strokes.filter((s) => s.syl === k).map((s) => s.t[1])));
  return { strokes, sylX: n.sylX, sylEnd, end: strokes[strokes.length - 1].t[1] };
};

// 고침 2(고침 1 이해 시험 3점 — 4초에 Mark → Grace 이름표가 바뀌는 자리에서 「새 영상 같다」로 넘김, 「syllable」이 낯섦):
// Mark를 빼고 Grace 하나로, 첫 말은 「Grace?」 — 0초에 ㄱ을 긋는 중이고 곧바로 「그」 칸을 마저 써서 소리 · 숫자, 이어 레 · 이 · 스.
// 「Comment your name…」은 위 띠(0초부터)와 끝 말이 맡는다. 끝 설명은 「One sound in English. Four in Korean!」.
const h0 = 0.05;
// 첫 획(ㄱ)만 0초 전부터 천천히 그어 「Grace?」가 끝날 때 「그」 칸이 다 되게
const raw = mk('그레이스', 0.32, 'grace', 0.2);
const strokes2: Timed[] = raw.strokes.map((s, i) => (i ? s : { ...s, t: [-0.15, s.t[1]] as const }));
const W2 = { ...raw, strokes: strokes2 };
const syl = W2.sylEnd.map((t) => t + 0.02); // 그 칸을 다 쓴 때 그 소리 · 숫자
const k3 = Math.max(W2.end, syl[3] + VO.g[3]) + 0.2;
const e4 = k3 + VO.k3 + 0.12;
const out2 = e4 + VO.e4 + 0.8; // 「1 → 4」를 다 본 뒤 끝 화면으로

// ── 끝: 빈 이름표 ──
const end = out2;
const e6 = end + 0.2;
const QS = questionStrokes(WRITE.cx, WRITE.cy, WRITE.s);
const q0 = end + 0.35;
const q0d = Math.min(0.5, len(QS[0]) / 900);
const Q: Timed[] = [
  { d: QS[0], syl: 0, t: [q0, q0 + q0d] },
  { d: QS[1], syl: 0, t: [q0 + q0d + 0.12, q0 + q0d + 0.2] },
];
// 끝 정지는 0.9초 안팎 — 길이를 정지 검사의 0.5초 칸 끝에 맞춘다(현장 노트 영상 「CBR 10M 판의 정지 판정」)
const total = Math.ceil((e6 + VO.e6 + 1.1) * 2) / 2;

export const CARDS = [{ en: 'Grace', ko: '그레이스', rom: ['geu', 're', 'i', 'seu'], w: W2, in: -1, out: out2, e: h0, k: k3 }] as const;

export const T = {
  slap: 0.18,
  one: e4 + E4_ONE,
  syl,
  k3,
  e4,
  four: e4 + E4_FOUR,
  end,
  e6,
  comment: e6 + E6.comment,
  write: e6 + E6.write,
  total,
};
export const QMARK = Q;
export const TOTAL_FRAMES = fr(total);
