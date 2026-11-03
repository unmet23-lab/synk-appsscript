// 「haha → 하하」 칠판판(SYNK LAB 시험, 2026-11-03): 유튜브에 올린 v7(공책 · 연필, 15.0초)과 같은 목소리 여덟 마디를
// 같은 초에 두고, 그림만 칠판 스타일로 바꾼다. 세로 1080×1920 · 30fps.
// 분필 셋: 흰색(선생님 · 뼈대) · 주황(이 수업이 따라가는 한 부분 = h와 ㅎ) · 노랑(학생 손 — 모자 · 얼굴 낙서와 이름표).
// 단위: 칠판 슬레이트(x 0…6400, y 0…1700). 앞 판(FL)만 쓰고 판은 밀지 않는다.
import { clamp, lerp, eio } from '/core/lib.js';
import { Stroke, catmull } from './chalk.js';
import { writeChar, writeLine, writeLatin, latinWidth } from './hand.js';

export const G1 = null, G2 = null, SMALL = [];
// 목소리(소진, Typecast — v7과 같은 파일): 길이(초)
export const VO = { g1: 1.845, m1: 1.298, m2: 1.209, m3: .586, k2: .506, g3: 1.586 };
export const needOf = txt => Math.max(1.5, [...txt].filter(c => !/\s/.test(c)).length / 15 + 1.5);

const SZ = 430;                                   // 하 한 글자(월드 단위)
const C1 = [1400, 960], C2 = [1870, 960];         // 두 하의 가운데
const bp = (c, x, y) => [c[0] + (x - 50) * SZ / 100, c[1] + (y - 50) * SZ / 100];   // 글자 상자(100) → 월드

export function build(W = 1080, H = 1920) {
  const S = [], TX = [], EV = [], SUBS = [], T = {};
  const add = (arr, layer = 'FL') => { arr.forEach(s => { s.layer = layer; s.phase = 'pre'; S.push(s); }); return arr; };
  const text = (id, txt, strokes, t1 = 1e9, pad = 6) => {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const s of strokes) for (const [x, y] of s.pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    TX.push({ id, text: txt, layer: 'FL', box: [x0 - pad, y0 - pad, x1 + pad, y1 + pad], t0: strokes[0].t0, t1 });
  };
  const line = (pts, o, t0, dur) => { const s = new Stroke(o.smooth ? catmull(pts, 10) : pts, { kind: 'write', taper: .2, taperLen: .2, land: .6, skip: .14, endSpecks: true, specks: .6, ...o }); s.t0 = t0; s.t1 = t0 + dur; return s; };
  const kid = (pts, t0, dur, o = {}) => line(pts, { w: 7.5, color: 'kid', smooth: true, wob: 2.2, taper: .1, ...o }, t0, dur);
  const vo = (id, t) => { EV.push({ t, type: 'vo', id }); return t + VO[id]; };
  // 한 획을 정한 시각 · 길이로(목소리에 맞춘다)
  const stroke = (c, i, t, d, color) => { const s = writeChar('하', c[0], c[1], SZ, 0, { seed: c === C1 ? 11 : 12, only: [i], colors: { [i]: color } }); s[0].t0 = t; s[0].t1 = t + d; return add(s)[0]; };
  // 라틴 글자 하나씩(색을 글자마다)
  const latinRun = (letters, x, by, cap, t, gap, o = {}) => {
    const out = []; let X = x;
    letters.forEach(([ch, color], k) => {
      const s = writeLatin(ch, X, by, cap, t + k * gap, { seed: 5 + k, lspeed: 70, color, ...o });
      out.push(...s); X = s.x;
    });
    return add(out);
  };

  // ───────── 0.0 · 위 줄: 영어 haha(0초에 이미 쓰는 중 = 훅), h는 주황
  vo('g1', .12);
  const HAHA = [['h', 'orange'], ['a', 'white'], ['h', 'orange'], ['a', 'white']], CAP = 150;
  const hw = latinWidth('haha', CAP);
  const haha = latinRun(HAHA, 1600 - hw / 2, 420, CAP, -.3, .3);
  text('haha', 'haha', haha);
  // 아래로 화살표
  add([line([[1620, 500], [1622, 650]], { w: 9, color: 'white' }, 1.62, .2),
    line([[1576, 606], [1622, 652], [1668, 604]], { w: 9, color: 'white', taper: .1 }, 1.84, .14)]);

  // ───────── 2.05 · 「First, a hat.」 짧은 줄 · 긴 줄(주황) → 학생이 모자 옆선을 그어 실크해트가 된다
  vo('m1', 2.05);
  stroke(C1, 0, 2.15, .24, 'orange');
  stroke(C1, 1, 2.55, .36, 'orange');
  const crown = (c, t) => add([kid([bp(c, 25, 16), bp(c, 25.5, 23), bp(c, 25, 30)], t, .14), kid([bp(c, 41, 15), bp(c, 41.5, 22), bp(c, 41, 29.5)], t + .16, .14)]);
  crown(C1, 2.98);
  const hatL = add(writeLatin('hat', bp(C1, 8, 0)[0] - latinWidth('hat', 62, 'child') - 16, bp(C1, 0, 31)[1] + 4, 62, 3.05, { hand: 'child', seed: 41, lspeed: 60 }));
  text('hat', 'hat', hatL);

  // ───────── 3.55 · 「Then a face!」 동그라미(12시에서 왼쪽으로) → 학생이 웃는 눈 · 입
  vo('m2', 3.55);
  stroke(C1, 2, 3.62, .78, 'orange');
  const face = (c, t) => {
    const e1 = kid([bp(c, 24.5, 59), bp(c, 27, 55.5), bp(c, 29.5, 59)], t, .1, { w: 6.5 });
    const e2 = kid([bp(c, 36.5, 59), bp(c, 39, 55.5), bp(c, 41.5, 59)], t + .12, .1, { w: 6.5 });
    const m = kid([bp(c, 25, 66), bp(c, 29, 71.5), bp(c, 33, 73), bp(c, 37, 71.5), bp(c, 41, 66)], t + .26, .2, { w: 7 });
    return add([e1, e2, m]);
  };
  face(C1, 4.46);
  const faceL = add(writeLatin('face', bp(C1, 15, 0)[0] - latinWidth('face', 62, 'child') - 14, bp(C1, 0, 66)[1], 62, 4.62, { hand: 'child', seed: 43, lspeed: 60 }));
  text('face', 'face', faceL);

  // ───────── 5.1 · 「And 'a'.」 ㅏ(흰색)
  vo('m3', 5.1);
  stroke(C1, 3, 5.15, .3, 'white');
  stroke(C1, 4, 5.52, .14, 'white');
  text('ha1', '하', S.filter(s => s.ch === '하' && s.t0 < 5.9));

  // ───────── 5.95 · 둘째 하 — 빠르게, 끝나면 학생이 모자 · 얼굴을 또
  stroke(C2, 0, 5.95, .14, 'orange');
  stroke(C2, 1, 6.13, .22, 'orange');
  stroke(C2, 2, 6.39, .4, 'orange');
  stroke(C2, 3, 6.83, .2, 'white');
  stroke(C2, 4, 7.06, .1, 'white');
  crown(C2, 7.2);
  face(C2, 7.48);
  text('ha2', '하', S.filter(s => s.ch === '하' && s.t0 >= 5.9));

  // ───────── 7.85 · 자모 밑에 h · a · h · a(h는 주황) — 위의 haha와 이어진다
  const sub = [];
  [[C1, 33, 'h', 'orange'], [C1, 76, 'a', 'white'], [C2, 33, 'h', 'orange'], [C2, 76, 'a', 'white']].forEach(([c, x, ch, color], k) => {
    const cap = 96, X = bp(c, x, 0)[0] - latinWidth(ch, cap) / 2;
    sub.push(...add(writeLatin(ch, X, 1330, cap, 7.85 + k * .2, { seed: 70 + k, lspeed: 60, color })));
  });
  text('sub-haha', 'h a h a', sub);

  // ───────── 8.75 하하. / 9.9 다가가면 학생이 말풍선 「하!」 둘 / 10.3 하하. / 11.45 Now you can laugh in Korean. / 14.3 하하.
  vo('k2', 8.75);
  T.cut = 9.9;
  const bubble = (cx, cy, rx, ry, tail, t) => {
    const P = []; for (let a = -100; a <= 250; a += 18) { const r = a * Math.PI / 180; P.push([cx + rx * Math.cos(r), cy + ry * Math.sin(r)]); }
    const b = kid(P, t, .34, { w: 7 }), tl = kid([[cx + tail * rx * .35, cy + ry * .92], [cx + tail * rx * .55, cy + ry * 1.5], [cx + tail * rx * .05, cy + ry * .98]], t + .35, .12, { w: 7, smooth: false });
    add([b, tl]);
    return add(writeLine('하!', cx - 88, cy + 2, 104, t + .5, { hand: 'child', seed: 90 + Math.round(cx), speed: 26 }));
  };
  text('bubble1', '하!', bubble(bp(C1, 33, 0)[0], 650, 128, 80, 1, T.cut + .05));
  text('bubble2', '하!', bubble(bp(C2, 33, 0)[0], 650, 128, 80, 1, T.cut + .35));
  vo('k2', 10.3);
  vo('g3', 11.45);
  // 끝: 선생님이 h a h a 밑에 한 줄을 긋는다
  add([line([[1180, 1385], [1640, 1381], [2080, 1376]], { w: 9, color: 'white', smooth: true, taper: .05 }, 13.25, .42)]);
  vo('k2', 14.3);
  T.DUR = 15.0;

  const slideX = () => 0;
  // ───────── 카메라: [t, cx, cy, s](s는 가로 1920 기준 배율)
  const shots = [
    { t0: 0, keys: [[0, 1600, 560, 1.95], [1.85, 1600, 580, 1.92], [2.7, 1585, 850, 1.52], [9.9, 1588, 880, 1.64]] },
    { t0: T.cut, keys: [[T.cut, 1592, 850, 1.66], [11.15, 1592, 845, 1.69], [12.7, 1610, 700, 1.2], [T.DUR, 1612, 690, 1.15]] },
  ];
  shots.forEach((s, i) => s.t1 = i + 1 < shots.length ? shots[i + 1].t0 : 1e9);
  const camAt = tt => {
    let i = 0; while (i + 1 < shots.length && tt >= shots[i + 1].t0) i++;
    const K = shots[i].keys;
    let k = 0; while (k + 1 < K.length - 1 && tt > K[k + 1][0]) k++;
    const a = K[k], b = K[Math.min(K.length - 1, k + 1)], u = b[0] > a[0] ? eio(clamp((tt - a[0]) / (b[0] - a[0]))) : 1;
    return { cx: lerp(a[1], b[1], u), cy: lerp(a[2], b[2], u), s: lerp(a[3], b[3], u), shot: i };
  };
  for (const st of S) {
    if (st.t1 <= 0 || st.t0 >= T.DUR) continue;
    const c = camAt((st.t0 + st.t1) / 2), p = st.at(st.len / 2), sx = (p[0] - c.cx) * c.s / 1920 * 2;
    if (Math.abs(sx) > 1.3) continue;
    EV.push({ t: +Math.max(0, st.t0).toFixed(3), type: 'chalk', d: +(st.t1 - Math.max(0, st.t0)).toFixed(3), len: Math.round(st.len * c.s), color: st.color, pan: +clamp(sx * .6, -.7, .7).toFixed(2), big: st.w > 12 ? 1 : 0 });
  }
  EV.push({ t: T.cut, type: 'cut' });
  EV.sort((a, b) => a.t - b.t);
  T.back0 = 1e9;
  return { S, TX, EV, SUBS, T, wet: null, wipe: null, slideX, camAt, shots, DUR: T.DUR, G1, G2, SMALL };
}
