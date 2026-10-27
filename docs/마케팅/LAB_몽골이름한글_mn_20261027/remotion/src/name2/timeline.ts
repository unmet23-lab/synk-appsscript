// M3 다시 살림(10-28) 시간표(초) — 도구 시연 대신 규칙 하나를 이름 하나로: Батбаяр는 몽골어로 3음절(Бат · ба · яр),
// 한글로는 바트바야르 5음절. 이름표에 한 칸씩 쓰며 칸을 다 쓴 박자에 그 소리(한국어 음절) · 칸 위 숫자 1~5 · 칸 아래 키릴 읽기.
// LAB E1 다시 살림(LAB_댓글이름한글_20261027/remotion/src/film2)의 틀을 옮겼다. 몽골어 목소리는 없고(장부 머리말) 한국어 음절만 들린다.
import { nameStrokes, questionStrokes } from '../film/hangul';
import { at, fr, FPS, len, STICKER, Timed, WRITE } from '../film/timeline';

export { at, fr, FPS, len, STICKER, WRITE };
export type { Timed };

// public/vo/pick/*.json의 dur — 바 · 트 · 바 · 야 · 르, 이름 전체
export const VO = { syl: [0.436, 0.526, 0.436, 0.48, 0.501], full: 1.432 };
export const SYL_ID = ['b1', 't2', 'b1', 'y4', 'r5'];

const strokeDur = (d: string) => Math.min(0.24, Math.max(0.09, len(d) / 1150));
const moveDur = (a: string, b: string) => {
  const p = at(a, 1), q = at(b, 0);
  return Math.min(0.13, Math.max(0.05, Math.hypot(q[0] - p[0], q[1] - p[1]) / 2600));
};
const schedule = (strokes: { d: string; syl: number }[], start: number, sylPause: number): Timed[] => {
  let t = start;
  return strokes.map((s, i) => {
    if (i > 0) t += moveDur(strokes[i - 1].d, s.d) + (s.syl !== strokes[i - 1].syl ? sylPause : 0);
    const out = { ...s, t: [t, t + strokeDur(s.d)] as const };
    t = out.t[1];
    return out;
  });
};

// 0초에 ㅂ 첫 획을 긋는 중 — 빈 이름표로 시작하지 않게(E1 v2 이해 시험 「0~2초 빈 칸」)
const n = nameStrokes('바트바야르', WRITE.cx, WRITE.cy, WRITE.s, WRITE.gap, 'batbayar');
const strokes = schedule(n.strokes, -0.12, 0.2);
const sylEnd = n.sylX.map((_, k) => Math.max(...strokes.filter((s) => s.syl === k).map((s) => s.t[1])));
const W = { strokes, sylX: n.sylX, sylEnd, end: strokes[strokes.length - 1].t[1] };
const syl = sylEnd.map((t) => t + 0.02); // 칸을 다 쓴 때 그 소리 · 숫자 · 읽기
const full = Math.max(W.end, syl[4] + VO.syl[4]) + 0.25; // 「바트바야르!」 — 다섯 칸이 차례로 통통
const five = full + 0.2; // 「→ Солонгос үсгээр 5 үе!」
// 고침 2(고침 1 3점 — 묶음 괄호가 오히려 헷갈림): 칸마다 위에 그 칸이 된 키릴 조각(ба · т · ба · я · р)을 먼저 띄우고 그 칸을 쓴다.
// 다 쓴 뒤 위 띠가 「т, р가 따로 한 음절씩 됐다」로 바뀐다.
const rule = five + 0.6;
const out = five + 3.2; // 3 → 5와 규칙을 읽을 틈

// ── 끝: 빈 이름표 + 물음표 + 말풍선 「Таны нэр|」, 위 띠가 「Солонгос үсгээр хэдэн үе вэ?」로 바뀐다 ──
const end = out;
const QS = questionStrokes(WRITE.cx, WRITE.cy, 186);
const q0 = end + 0.35;
const q0d = Math.min(0.5, len(QS[0]) / 900);
const Q: Timed[] = [
  { d: QS[0], syl: 0, t: [q0, q0 + q0d] },
  { d: QS[1], syl: 0, t: [q0 + q0d + 0.12, q0 + q0d + 0.2] },
];
const comment = end + 1.0; // 「Нэрээ сэтгэгдэлд бичээрэй 👇」(역번역: 「댓글란에 써」만으로는 이름인지 숫자인지 두 가지로 읽힘)
const link = end + 2.2; // 「synk.im/name」 — 끝 1초 남짓만(다시 살린다면: 도구는 끝 1초 · 캡션으로만)
// 소리 없는 끝 화면이라 읽을 시간을 넉넉히 — 길이는 정지 검사 0.5초 칸 끝에 맞춘다
const total = Math.ceil((end + 3.6) * 2) / 2;

// src: 그 칸이 된 키릴 조각 — т · р는 모음 없이 혼자 한 칸(ㅡ를 붙여 트 · 르)
export const NAME = { mn: 'Батбаяр', src: ['ба', 'т', 'ба', 'я', 'р'], hot: [false, true, false, false, true] };
const sylStart = n.sylX.map((_, k) => strokes.filter((s) => s.syl === k)[0].t[0]);
export const T = { slap: 0.18, sylStart, syl, full, five, rule, end, comment, link, total };
export { W };
export const QMARK = Q;
export const TOTAL_FRAMES = fr(total);
