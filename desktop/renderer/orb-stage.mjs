// SYNK 플랫폼 PC 클라이언트의 검정 구(「구 가」, 2026-11-16 유호님 확정). 시안 docs/디자인/플랫폼_클라이언트_검정구_20261116/검정구.html의
// 셰이더 · 자세 · 움직임을 그대로 옮겼다. 화면 글이나 단계는 모른다. 얼굴(orb-face-view.mjs)이 자세를 부르고, 이 파일은 그린다.
// 셈만 하는 부분(자리 좌표, 자세, 곡선)은 DOM 없이 내보내 Node 시험에 쓴다(desktop/tests/orb-stage-geometry.test.mjs).

export const rad = d => d * Math.PI / 180;
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const easeOut = t => 1 - Math.pow(1 - t, 3);
export const easeIO = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeIOQ = t => t < .5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;

/* ── 구 위의 자리. 공간 하나가 별 하나다(2026-11-20 유호님 「6번으로」 — 눈이 별이 된다). 별은 구에서 정해진 자리에 있고 구는 돌지 않는다.
      지도가 켜지면 눈의 점이 흩어져 별이 되고, 꺼지면 점이 돌아와 다시 눈이 된다(시안 docs/디자인/플랫폼_클라이언트_검정구_20261116/지도_20261120) ── */
export const ORB_PLACES = Object.freeze(['solio', 'workspace', 'pulse']);
/* 구를 돌려 자리를 앞에 두던 때의 값이다. 별은 돌지 않아 모두 0이다(얼굴이 이 값으로 도는 각을 정하므로 남긴다) */
export const PLACE_LON = Object.freeze({ solio: 0, workspace: 0, pulse: 0 });
/* 별의 자리(구의 반지름을 1로 본 화면 좌표, 위가 +) */
export const PLACE_STAR = Object.freeze({ solio: Object.freeze([0.14, -0.44]), workspace: Object.freeze([-0.50, 0.26]), pulse: Object.freeze([0.55, 0.12]) });
/* 별을 잇는 차례. 보이는 별만 이 차례로 가는 선이 잇는다 */
export const STAR_LINE = Object.freeze(['workspace', 'solio', 'pulse']);
export const RHO = 0.11; // 별을 손으로 가리킬 때 닿는 너비이고, 들어갈 때 구가 커지는 끝을 정한다
export const AXIS = Object.freeze({ rest: Object.freeze([0.28, 0.52, 0.81]), top: Object.freeze([0, 0.972, 0.235]) });

/* 지도를 내보일 때도 구의 축은 쉴 때 그대로다 */
export const faceAx = () => [...AXIS.rest];

/* 그 공간의 별이 보는 쪽 좌표로 어디에 있는지 낸다(축과 도는 각에 매이지 않는다) */
export function placeDir(a, spin, name) { const q = PLACE_STAR[name]; return [q[0], q[1], Math.sqrt(1 - q[0] * q[0] - q[1] * q[1])]; }
/* 어떤 자세 s에서 그 자리가 화면의 어디에 찍히는지 */
export function placeXY(s, name) { const m = placeDir(s.ax, s.spin, name); return [s.cx + s.r * m[0], s.top + s.r - s.r * m[1]]; }

/* 공간 고르기에서 구가 서는 자리 */
export function switchGeom(W, H) {
  const wide = W >= 760 && H >= 470, r = wide ? Math.min(H * 0.2, W * 0.19) : Math.min(H * 0.13, W * 0.23);
  return { wide, r, cy: wide ? H * 0.4 : r + Math.max(64, H * 0.09) };
}

/* 새 판을 받는 동안 구가 서는 자리(웅장한 판, 유호님 11-17 「웅장한 판」). 구가 창보다 크게 다가오고, 깎인 만큼 p가 늘수록 조금 더 커진다.
   글은 왼쪽 아래에 놓인다(시안 forgeGeom의 grand 갈래 그대로) */
export function forgeGeom(W, H, p = 0) {
  return { r: Math.min(H * lerp(0.5, 0.62, clamp(p, 0, 1)), W * 0.78), cy: H * 0.64 };
}

/* 들어온 뒤 왼쪽 위 작은 구의 반지름. 시안은 16이지만 앱은 1단계에서 맞춘 13을 둔다(2단계 첫 조각 설계 검토 1차 ①, 5단계에서 다시 본다) */
export const HOME_R = 13;
/* 구에 다가가 지도가 켜졌을 때의 반지름. 별과 선이 보일 만큼은 커야 한다(시안 fanR 그대로) */
export const fanR = H => clamp(H * 0.086, 50, 84);

/* 구가 서는 자리 여덟. top은 구의 맨 윗점, r은 반지름(화면 px).
   home은 왼쪽 위의 작은 구 자리(얼굴이 그 단추의 가운데를 알려 준다), dive와 face는 들어갈 공간과 앞에 둘 공간이다 */
export function orbPoses({ W, H, home = { x: 40, y: 40 }, dive = 'solio', face = 'solio', forgeP = 0 }) {
  const r0 = Math.min(H * 0.21, W * 0.3), fg = forgeGeom(W, H, forgeP);
  const rLobby = W < 760 ? clamp(H * 0.11, 44, 90) : clamp(H * 0.15, 64, 140);
  const g = switchGeom(W, H), rIn = Math.hypot(W, H) * 0.56 / RHO, hr = HOME_R, fr = fanR(H);
  return {
    void: { cx: W / 2, top: H / 2 - r0, r: r0, az: rad(-50), lz: 0.5, lit: 0, focus: 0, ax: AXIS.rest, mark: 0, par: 1, calm: 0 },
    rest: { cx: W / 2, top: H / 2 - r0, r: r0, az: rad(135), lz: 0.5, lit: 1, focus: 0, ax: AXIS.rest, mark: 0, par: 1, calm: 0, eye: 1 },
    /* 새 판을 깎는 동안. 깎는 동안은 어둡고(lit 0.58), 글이 놓일 아래쪽 결은 가라앉힌다. 다 깎이면 얼굴이 빛을 올린다 */
    forge: { cx: W / 2, top: fg.cy - fg.r, r: fg.r, az: rad(128), lz: 0.42, lit: 0.58, focus: 0, ax: AXIS.rest, mark: 0, par: 0.16, calm: 0.85, eye: 1 },
    /* 로그인을 묻는 로비(유호님 11-26 「두 화면만 바꿔」, docs/디자인/워크스페이스_다시짓기_20261124/시안2 시안 3). 노란 바탕의 오른쪽 아래에 작은 구가 서서 눈으로 사원증을 본다 */
    ask: { cx: W - rLobby - Math.max(28, W * 0.045), top: H - rLobby * 1.62, r: rLobby, az: rad(135), lz: 0.5, lit: 1, focus: 0, ax: AXIS.rest, mark: 0, par: 1, calm: 0, eye: 1 },
    /* 들어갈 공간의 별이 창 한가운데에 있고 구가 창보다 훨씬 커진 때다. 거기까지 가는 길은 mixPose가 별을 따라가며 잡는다 */
    inside: { cx: W / 2, top: H / 2 - rIn, r: rIn, az: rad(150), lit: 0, focus: 1, ax: faceAx(dive), spin: -PLACE_LON[dive], mark: 1, par: 0, calm: 0, dive: true },
    home: { cx: home.x, top: home.y - hr, r: hr, az: rad(135), lz: 0.5, lit: 1, focus: 0, ax: AXIS.rest, mark: 0, par: 1, calm: 0, eye: 1 },
    /* 구에 다가가면 구가 제자리에서 자라 지도가 켜진다. 작은 구의 왼쪽 위 모서리는 그대로 두고 오른쪽 아래로 자란다. 눈은 물러난다(시안 fan) */
    fan: { cx: home.x - hr + fr, top: home.y - hr, r: fr, az: rad(140), lz: 0.45, lit: 1, focus: 0, ax: faceAx(face), spin: -PLACE_LON[face], mark: 1, par: 0, calm: 0 },
    /* 공간을 고를 때는 구가 가운데로 와서 지도가 된다 */
    sw: { cx: W / 2, top: g.cy - g.r, r: g.r, az: rad(140), lz: 0.45, lit: 1, focus: 0, ax: faceAx(face), spin: -PLACE_LON[face], mark: 1, par: 0, calm: 0 },
  };
}

/* 자세 a에서 b로 가는 길의 한순간(t는 0~1)을 S에 적는다. o.ease, o.litCurve, o.p0(들어갈 자리의 처음 화면 좌표), o.W, o.H, o.dive */
export function mixPose(S, a, b, t, o) {
  const e = o.ease(t), dive = !!b.dive, eo = dive ? smooth(0, 0.62, t) : e;
  S.r = Math.exp(lerp(Math.log(a.r), Math.log(b.r), e));
  S.az = lerp(a.az, b.az, eo); S.focus = lerp(a.focus, b.focus, eo);
  S.mark = lerp(a.mark, b.mark, eo); S.par = lerp(a.par, b.par, eo); S.calm = lerp(a.calm, b.calm, eo);
  /* 눈은 자리를 옮기는 길의 앞쪽에서 사라지고 뒤쪽에서 나타난다 */
  const ea = a.eye || 0, ebv = b.eye || 0;
  S.eye = ea > ebv ? lerp(ea, ebv, smooth(0, 0.3, t)) : lerp(ea, ebv, smooth(0.6, 1, t));
  if (b.lz !== undefined) S.lz = lerp(a.lz, b.lz, eo);
  S.ax = [lerp(a.ax[0], b.ax[0], eo), lerp(a.ax[1], b.ax[1], eo), lerp(a.ax[2], b.ax[2], eo)];
  if (b.spin !== undefined) S.spin = lerp(a.spin, b.spin, eo);
  S.lit = o.litCurve ? o.litCurve(t, a.lit, b.lit) : lerp(a.lit, b.lit, e);
  if (dive) {
    /* 들어갈 공간의 별이 화면 한가운데로 오도록 구를 옮기며 키운다. open은 나머지 별과 선이 물러난 정도다 */
    const m = placeDir(S.ax, S.spin, o.dive), ep = smooth(0, 0.7, t);
    S.cx = lerp(o.p0[0], o.W / 2, ep) - S.r * m[0];
    S.top = lerp(o.p0[1], o.H / 2, ep) + S.r * m[1] - S.r;
    S.open = smooth(0.3, 0.8, t);
  } else {
    S.cx = lerp(a.cx, b.cx, e); S.top = lerp(a.top, b.top, e); S.open = lerp(a.open || 0, 0, e);
  }
  return S;
}

/* ── 지도의 점. 눈의 점 스물둘이 흩어져 공간의 별로 모이고, 남은 여섯은 먼 별이 된다. 구는 돌지 않고 점만 움직인다 ── */
const EYE_DOTS = [];
for (const sx of [-1, 1]) for (let r = -2; r <= 2; r++) for (let c = -1; c <= 1; c++) { if (Math.abs(c) === 1 && Math.abs(r) === 2) continue; EYE_DOTS.push([sx, c, r]); }
const FAR_STARS = [[-0.16, 0.64, 1.1], [0.34, 0.58, 0.8], [-0.72, -0.20, 1.0], [-0.24, -0.14, 0.8], [0.74, -0.36, 1.1], [-0.30, -0.72, 0.9]];
/* 점마다 갈 곳: 왼쪽 눈의 점은 워크스페이스(1)로, 가운데 쪽의 점은 솔리오(0)로, 오른쪽 눈의 점은 PULSE(2)로 간다. lead는 별로 남는 점이고 far는 먼 별이 되는 점이다 */
const DOT_TO = EYE_DOTS.map((e, i) => (i < 5 ? { s: 1, lead: i === 2 } : i < 8 ? { far: i - 5 } : i < 14 ? { s: 0, lead: i === 10 } : i < 17 ? { far: i - 11 } : { s: 2, lead: i === 19 }));
export const MAP_DOTS = EYE_DOTS.length;
/* 눈의 점 하나의 반지름 상한(px). 구가 창보다 커지는 자세에서도 점은 점으로 남는다(Fable 최종 검수 F2) */
export const DOT_MAX = 6;
/* 점 스물둘의 자리(pos: 점마다 x, y, 0)와 모습(att: 점마다 반지름 px, 밝기, 번짐)을 적는다.
   o.mark가 0이면 눈의 자리에, 1이면 별의 자리에 있다. o.r은 구의 반지름(px), o.face와 o.gaze는 눈의 얼굴과 눈길(점이 떠나는 자리를 눈이 있던 자리에 맞춘다),
   o.seen은 지도가 꺼진 쪽 자세에서 눈이 보이는지(보이지 않으면 점은 눈 자리에서 날아오지 않고 제자리에서 켜진다), o.open은 들어갈 때 나머지가 물러난 정도, o.dive와 o.space는 들어갈 공간과 지금 공간, o.hot은 가리킨 정도 셋,
   o.shown(name)은 그 공간의 별을 그리는지다. 그리지 않는 공간으로 가던 점은 먼 쪽으로 흩어지며 꺼진다 */
export function mapDots(o, pos = new Float32Array(MAP_DOTS * 3), att = new Float32Array(MAP_DOTS * 3)) {
  att.fill(0);
  const m = o.mark;
  if (!(m > 0.0005)) return { pos, att };
  const R = o.r, small = 1 - smooth(14, 60, R), k = lerp(1, 1.85, small), g = 0.04 * k, sep = 0.22 * lerp(1, 1.12, small);
  const fx = o.face?.[0] || 0, fy = o.face?.[1] || 0, gx = o.gaze?.[0] || 0, gy = o.gaze?.[1] || 0;
  const fl = Math.hypot(fx, fy, 1), F = [fx / fl, fy / fl, 1 / fl], rl = Math.hypot(F[2], F[0]) || 1, Rr = [F[2] / rl, 0, -F[0] / rl];
  const Uu = [F[1] * Rr[2] - F[2] * Rr[1], F[2] * Rr[0] - F[0] * Rr[2], F[0] * Rr[1] - F[1] * Rr[0]];
  const rd = clamp(0.27 * g * R, 0.9, DOT_MAX), sk = clamp(R / 190, 0.62, 1.15), fade = smooth(0, 0.1, m);
  const open = o.open || 0, hot = o.hot || [0, 0, 0], target = ORB_PLACES.indexOf(o.dive), shown = i => (o.shown ? o.shown(ORB_PLACES[i]) === true : true);
  const starR = i => (ORB_PLACES[i] === o.space ? 3.7 : 2.7) * sk + 0.8 * hot[i] + (i === target ? 1.6 * open : 0);
  EYE_DOTS.forEach((e, i) => {
    const u = e[0] * sep + e[1] * g + gx * g, v = 0.06 + e[2] * g + gy * g, w = Math.sqrt(Math.max(0, 1 - u * u - v * v));
    const x0 = Rr[0] * u + Uu[0] * v + F[0] * w, y0 = Rr[1] * u + Uu[1] * v + F[1] * w;
    const t = DOT_TO[i], q = easeIO(clamp((m - 0.03 - ((i * 5) % 22) / 22 * 0.14) / 0.7, 0, 1));
    let bx, by, r, a, glow = 0;
    if (t.far !== undefined) { const b = FAR_STARS[t.far]; bx = b[0]; by = b[1]; r = lerp(rd, Math.max(0.8, b[2] * sk), q); a = lerp(1, 0.4, q) * (1 - open); }
    else if (!shown(t.s)) { const b = FAR_STARS[i % FAR_STARS.length]; bx = b[0]; by = b[1]; r = rd; a = o.seen ? 1 - q : 0; }
    else {
      const c = PLACE_STAR[ORB_PLACES[t.s]]; bx = c[0]; by = c[1];
      r = lerp(rd, t.lead ? starR(t.s) : rd * 0.7, q); a = t.lead ? 1 : 1 - smooth(0.8, 1, q);
      if (t.lead) glow = q * (1 + 0.6 * hot[t.s] + (ORB_PLACES[t.s] === o.space ? 0.3 : 0));
      if (t.s !== target) a *= 1 - open;
    }
    /* 눈이 보이지 않던 자세(로그인을 묻는 큰 구)에서는 점이 눈 자리에서 날아오지 않는다. 갈 자리에서 서서히 켜진다 */
    const x = o.seen ? lerp(x0, bx, q) : bx, y = o.seen ? lerp(y0, by, q) : by;
    if (!o.seen) a *= q;
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = 0; att[i * 3] = r; att[i * 3 + 1] = a * fade; att[i * 3 + 2] = glow;
  });
  return { pos, att };
}
/* 별을 잇는 선 둘. 보이는 별만 STAR_LINE의 차례로 잇는다. 선마다 [ax, ay, bx, by]이고, 이을 별이 없으면 null이다 */
export function mapLines(shown) {
  const list = STAR_LINE.filter(name => shown(name) === true);
  const seg = i => (list[i + 1] ? [...PLACE_STAR[list[i]], ...PLACE_STAR[list[i + 1]]] : null);
  return [seg(0), seg(1)];
}

const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes, uC;
/* 바탕색. 검정이면 지금 화소 그대로다. 로비(로그인)와 「한 번에 처리」에서만 솔리오 노랑으로 바뀐다(유호님 11-26 「두 화면만 바꿔」) */
uniform vec3 uBg;
uniform float uR, uLit, uAz, uLz, uFocus, uGb, uDpr, uSeed, uMark, uCalm;
uniform vec3 uAxis, uOpen;
uniform float uCut, uCutOn;
uniform vec4 uEye;
uniform vec3 uFace, uGaze;
uniform vec3 uDot[22];
uniform vec3 uDotA[22];
uniform vec4 uSeg0, uSeg1;
uniform vec2 uLine;
float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
/* 구 속에 비치는 흐린 빛을 그리는 물결. 칸의 모서리 값이 이웃 칸과 어긋나지 않는 섞기를 쓴다(사인을 쓰면 그래픽 카드에서 칸마다 끊긴다) */
float h3(vec3 p){ p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 p){
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p){ return 0.6 * vnoise(p) + 0.3 * vnoise(p * 2.1 + 7.3) + 0.1 * vnoise(p * 4.3 + 1.7); }
/* 별 둘을 잇는 선. 별에 닿기 전에 멈추고, 그어진 만큼(prog)만 보인다 */
float seg(vec2 p, vec2 a, vec2 b, float prog, float ppx){
  vec2 pa = p - a, ba = b - a; float len = max(length(ba), 0.0001);
  float g0 = min(0.4, 13.0 / (len * ppx));
  float h = clamp(dot(pa, ba) / (len * len), g0, g0 + (1.0 - 2.0 * g0) * prog);
  return (1.0 - smoothstep(0.3, 1.05, length(pa - ba * h) * ppx)) * step(0.002, prog);
}
float sdBox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
/* 눈 하나의 모양(안이 −). p는 눈 가운데에서 잰 자리이고 구의 반지름이 1이다. cz는 평소 모양의 반 폭과 반 높이다.
   표정: 0 평소(세로로 선 알약), 1 웃음(∩), 2 잠(∪), 3 문제(–), 4 일하는 중(도는 점). 감을 때는 위아래에서 닫힌다(시안 그대로, 점 눈만 옮긴다) */
float eyeSd(vec2 p, float open, float mood, float t, vec2 cz){
  if (mood < 0.5) { float h = mix(0.012, cz.y, open); return sdBox(p, vec2(cz.x, h), min(cz.x, h)); }
  float sd;
  if (mood < 1.5) { vec2 c = p - vec2(0.0, -0.060); sd = max(abs(length(c) - 0.100) - 0.014, 0.045 - c.y); }
  else if (mood < 2.5) { vec2 c = p - vec2(0.0, 0.060); sd = max(abs(length(c) - 0.100) - 0.014, c.y + 0.045); }
  else if (mood < 3.5) { sd = sdBox(p, vec2(0.056, 0.013), 0.013); }
  else { float a = t * 5.2; sd = min(length(p - 0.052 * vec2(cos(a), sin(a))) - 0.026, length(p - 0.052 * vec2(cos(a - 1.25), sin(a - 1.25))) - 0.015); }
  return max(sd, abs(p.y) - mix(0.003, 0.2, open));
}
void main(){
  vec2 f = gl_FragCoord.xy;
  vec2 q = f - uC;
  float dist = length(q);
  float px = (dist - uR) / uDpr;
  float inside = 1.0 - smoothstep(-0.7, 0.7, px);
  vec2 dir = q / max(dist, 0.001);
  float d = min(dist / uR, 1.0);
  float z = sqrt(max(0.0, 1.0 - d * d));
  vec3 n = vec3(dir * d, z);
  vec3 warm = vec3(1.0, 0.982, 0.955);
  float line = exp(-abs(px) / 1.1);
  float halo = exp(-max(px, 0.0) / (0.045 * uR / uDpr + 5.0));
  vec2 Ld = normalize(mix(vec2(cos(uAz), sin(uAz)), vec2(-0.22, 1.0), uFocus));
  float mu = dot(dir, Ld);
  float cres = smoothstep(-0.5, 1.0, mu); cres *= cres;
  cres *= mix(1.0, pow(max(mu, 0.0), 7.0), uFocus);
  float pulse = 1.0 + 0.5 * uGb;
  vec3 col;
  if (px > 0.4 * uR / uDpr + 48.0) {
    col = uBg;
  } else {
    float N1 = 110.0;
    float h = sqrt(max(1.0 - uLz * uLz, 0.0));
    vec3 L = vec3(cos(uAz) * h, sin(uAz) * h, uLz);
    vec3 V = vec3(0.0, 0.0, 1.0);
    vec3 H = normalize(L + V);
    vec3 A = normalize(uAxis);
    float th = acos(clamp(dot(n, A), -1.0, 1.0));
    vec3 T = cross(A, n);
    float tl = length(T);
    T /= max(tl, 0.0001);
    vec3 B = cross(n, T);
    float sp = 3.14159265 / N1 * uR;
    float cap = smoothstep(7.0, 24.0, tl * uR / uDpr);
    float v1 = smoothstep(2.4, 6.0, sp * z) * cap;
    float v2 = smoothstep(2.4, 6.0, sp / 5.0 * z) * cap;
    float v3 = smoothstep(2.4, 6.0, sp / 25.0 * z) * cap;
    /* 새 판을 깎는 동안: 축의 꼭지에서부터 결이 깎여 나간다. 아직 깎지 않은 곳은 매끈하다. 보이는 면이 꼭 다 깎이는 때가 끝이다 */
    float eTh = uCut * (1.5708 + acos(clamp(A.z, -1.0, 1.0)) + 0.05);
    float cutM = mix(1.0, 1.0 - smoothstep(eTh - 0.014, eTh + 0.004, th), uCutOn);
    v1 *= cutM; v2 *= cutM; v3 *= cutM;
    float s1 = sin(2.0 * N1 * th), s2 = sin(10.0 * N1 * th), s3 = sin(50.0 * N1 * th);
    float e1 = clamp(7.5 / max(sp * z, 0.001), 0.06, 0.265), e2 = clamp(7.5 / max(sp / 5.0 * z, 0.001), 0.06, 0.265);
    float w1 = s1 / sqrt(s1 * s1 + e1 * e1), w2 = s2 / sqrt(s2 * s2 + e2 * e2), w3 = s3 / sqrt(s3 * s3 + 0.12);
    vec3 nn = normalize(n + B * (0.22 * w1 * v1 + 0.10 * w2 * v2 + 0.05 * w3 * v3));
    float pole = smoothstep(mix(0.03, 0.12, uMark), mix(0.30, 0.58, uMark), tl);
    float tdh = dot(T, H);
    float an = pow(max(1.0 - tdh * tdh, 0.0), mix(44.0, 110.0, uFocus)) * pole * mix(0.07, 1.0, cutM);
    float side = smoothstep(-0.28, 0.32, dot(n, L));
    float groove = 0.60 + 0.40 * (0.70 * w1 * v1 * (1.0 - 0.7 * v2) + 0.42 * w2 * v2 * (1.0 - 0.5 * v3) + 0.30 * w3 * v3);
    float spec = pow(max(dot(nn, H), 0.0), 30.0);
    float amb = 0.5 + 0.5 * dot(nn, normalize(vec3(-0.25, 0.7, 0.66)));
    float rings = ((0.5 + 0.5 * w1) * v1 * 0.036 + (0.5 + 0.5 * w2) * v2 * 0.016 + (0.5 + 0.5 * w3) * v3 * 0.010) * amb;
    vec3 L2 = normalize(vec3(-L.x * 0.7 + 0.35, -L.y * 0.5 - 0.3, 0.6));
    vec3 H2 = normalize(L2 + V);
    float t2 = dot(T, H2);
    float an2 = pow(max(1.0 - t2 * t2, 0.0), 28.0) * pole * smoothstep(-0.2, 0.4, dot(n, L2)) * mix(0.12, 1.0, cutM);
    float calm = mix(1.0, mix(0.16, 1.0, smoothstep(0.47, 0.69, f.y / uRes.y)), uCalm);
    float tiny = 1.0 - smoothstep(14.0, 60.0, uR / uDpr);
    /* 지도가 켜지면 결이 가라앉고, 구 속에 흐린 빛이 한 줄 비친다. 색은 구의 흰빛 그대로다. 지도가 꺼져 있으면(uMark 0) gk는 1이라 쉬는 구의 화소는 그대로다 */
    float gk = mix(1.0, 0.2, uMark);
    vec3 inC = vec3(0.005) + warm * uLit * mix(1.0, 0.1, tiny) * (gk * (an * side * groove * mix(0.78, 0.46, uFocus) * pulse + (an2 * groove * 0.09 + rings) * calm + spec * 0.20 * side) + 0.010 * max(dot(n, L), 0.0));
    if (uMark > 0.001) {
      float lon = atan(n.x, n.z), lat = asin(clamp(n.y, -1.0, 1.0));
      float po = lat - 0.22 * sin(lon * 1.2 + 0.4) + 0.08;
      float stay = 1.0 - max(uOpen.x, max(uOpen.y, uOpen.z));
      inC += mix(warm, vec3(0.74, 0.82, 1.0), 0.55) * uLit * uMark * stay * (1.0 - tiny) * (exp(-po * po * 4.0) * (0.035 + 0.19 * smoothstep(0.3, 0.75, fbm(n * 2.1 + 11.0))) + pow(1.0 - z, 3.0) * 0.06);
    }
    float edge = (1.0 - smoothstep(0.35, 1.0, abs(px))) * tiny * (0.26 + 0.5 * cres);
    float soft = 1.0 - 0.75 * tiny;
    inC += warm * uLit * (cres * (pow(1.0 - z, 5.0) * 0.14 + line * 0.16) * pulse * soft + edge);
    /* 아직 깎지 않은 면은 넓고 흐린 빛 하나만 받는다 */
    inC += warm * uLit * (1.0 - cutM) * pow(max(dot(n, H), 0.0), 9.0) * 0.085 * side;
    /* 깎는 자리: 날이 닿은 가는 선과, 보는 쪽으로 내려오는 날 끝의 불티 하나 */
    float live = uCutOn * step(0.004, uCut) * step(uCut, 0.996);
    float dpx = (th - eTh) * uR / uDpr;
    float seam = exp(-dpx * dpx / 1.5) * smoothstep(0.0, 0.3, z);
    vec3 E1 = normalize(V - A * dot(V, A));
    vec3 P = A * cos(eTh) + E1 * sin(eTh);
    float dP = length(n - P) * uR / uDpr;
    float tool = (exp(-dP * dP / 12.0) + 0.20 * exp(-dP / 22.0)) * smoothstep(-0.03, 0.08, P.z);
    inC += warm * live * (seam * (0.09 + 0.28 * side) + tool * 0.95);
    vec3 outC = warm * uLit * (cres * (line * 0.16 + halo * 0.03) * pulse * soft + edge);
    /* 밝은 바탕이면 새틴 검정 구의 가장자리에 바탕빛이 조금 비치고, 바깥 빛띠는 바탕에 묻히게 줄인다 */
    float bgk = max(uBg.r, max(uBg.g, uBg.b));
    inC += uBg * (0.03 + 0.16 * pow(1.0 - z, 2.0));
    col = mix(uBg + outC * (1.0 - 0.75 * bgk), inC, inside);
  }
  /* 점 눈. uEye는 종류(1 점, 0 없음), 보이는 정도, 뜬 정도, 표정이다. 얼굴(uFace)은 손이 있는 쪽을 보고, 눈은 구 겉에 붙어 얼굴과 함께 돈다.
     점 눈은 구 겉에 뚫은 아주 작은 구멍으로 빛이 새어 나오는 것이라, 꺼지면 구멍도 보이지 않는다(시안 그대로) */
  float ev = uEye.y * inside;
  if (ev > 0.001 && uEye.x > 0.5) {
    vec3 F = normalize(uFace);
    vec3 Rr = normalize(cross(vec3(0.0, 1.0, 0.0), F));
    vec3 Uu = cross(F, Rr);
    vec2 fp = vec2(dot(n, Rr), dot(n, Uu));
    float front = smoothstep(0.10, 0.40, dot(n, F));
    float ppx = uR / uDpr;
    /* 구가 작게 줄면 눈을 몸에 견줘 키우고 조금 더 벌린다(아이콘만 한 크기에서도 두 눈으로 읽히게) */
    float small = 1.0 - smoothstep(14.0, 60.0, ppx);
    float k = mix(1.0, 1.85, small);
    float g = 0.040 * k;
    float sep = 0.220 * mix(1.0, 1.12, small);
    vec2 gz = uGaze.xy * g;
    vec2 eL = vec2(-sep, 0.06) + gz, eR = vec2(sep, 0.06) + gz;
    /* 평소 모양은 가로 셋 세로 다섯 칸에서 네 모서리가 꺼진 알약이다. 아이콘만 한 크기에서는 둥근 점 둘로 모은다 */
    vec2 cz = mix(vec2(0.050, 0.094), vec2(0.046, 0.064), small);
    float sd = min(eyeSd((fp - eL) / k, uEye.z, uEye.w, uGaze.z, cz), eyeSd((fp - eR) / k, uEye.z, uEye.w, uGaze.z, cz)) * k;
    float solid = 1.0 - smoothstep(-0.6, 0.6, sd * ppx);
    /* 칸 가운데가 눈 모양 안에 드는 점만 켠다. 점이 화면에서 뭉개질 만큼 작아지면 한 덩어리로 그린다 */
    vec2 cc = (floor(fp / g) + 0.5) * g;
    float cs = min(eyeSd((cc - eL) / k, uEye.z, uEye.w, uGaze.z, cz), eyeSd((cc - eR) / k, uEye.z, uEye.w, uGaze.z, cz)) * k;
    float tol = uEye.w < 0.5 ? 0.0 : 0.008;
    float on = 1.0 - smoothstep(tol - 0.003, tol + 0.003, cs);
    float edpx = length(fp - cc) * ppx, rd = 0.27 * g * ppx;
    float led = (1.0 - smoothstep(rd - 0.6, rd + 0.6, edpx)) + 0.20 * exp(-max(edpx - rd, 0.0) / (0.4 * rd + 0.5));
    float e = mix(solid, on * led, smoothstep(3.0, 5.0, g * ppx));
    float dim = 0.34 * (1.0 - smoothstep(-0.2 * g, 1.0 * g, sd));
    col *= 1.0 - dim * ev * front;
    col += warm * e * ev * front * 0.96;
  }
  /* 지도. 공간은 별이고 별 사이를 가는 선으로 잇는다. 별은 눈의 점이 날아와 모인 것이라, 점마다 자리(uDot)와 반지름 · 밝기 · 번짐(uDotA)을 받는다.
     점은 구가 커지거나 작아져도 화면에서 동그란 점으로 남는다 */
  float mv = uMark * inside;
  if (mv > 0.001) {
    float mpx = uR / uDpr;
    float ln = max(seg(n.xy, uSeg0.xy, uSeg0.zw, uLine.x, mpx), seg(n.xy, uSeg1.xy, uSeg1.zw, uLine.y, mpx));
    float dl = 0.0;
    for (int i = 0; i < 22; i++) {
      vec3 a = uDotA[i];
      if (a.y > 0.003) {
        float dp = length(n.xy - uDot[i].xy) * mpx;
        dl += a.y * ((1.0 - smoothstep(a.x - 0.6, a.x + 0.6, dp)) + 0.20 * exp(-max(dp - a.x, 0.0) / (0.4 * a.x + 0.5)) + a.z * 0.2 * exp(-dp / (a.x * 2.4 + 3.0)));
      }
    }
    col += warm * uLit * inside * (ln * 0.30 * smoothstep(34.0, 60.0, mpx) + min(dl, 1.25) * 0.96);
  }
  float g = ign(f + uSeed * 7.31) + ign(f.yx + 17.0 + uSeed * 3.17) - 1.0;
  col += g * 2.8 / 255.0;
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}`;
const UNIFORMS = ['uRes', 'uC', 'uBg', 'uR', 'uLit', 'uAz', 'uLz', 'uFocus', 'uGb', 'uDpr', 'uSeed', 'uAxis', 'uMark', 'uCalm', 'uOpen', 'uCut', 'uCutOn', 'uEye', 'uFace', 'uGaze', 'uSeg0', 'uSeg1', 'uLine'];
/* 셰이더 원문. 시안과 화소를 견주는 도구(desktop/tools/orb-parity.cjs)가 같은 셰이더를 그린다 */
export const ORB_SHADER = Object.freeze({ VS, FS, UNIFORMS: Object.freeze([...UNIFORMS]) });

/* 캔버스 하나에 구를 그린다. 브라우저에서만 부른다.
   options: getReducedMotion() · getHome() → 작은 구의 가운데(무대 좌표) · noWebGL(시험용으로 2D 대체를 고른다)
   · noCanvas(시험용으로 WebGL과 2D를 모두 끈다 — 정적 구) · onRender(state)(시험용) */
export function createOrbStage(canvas, options = {}) {
  const win = canvas.ownerDocument?.defaultView || globalThis;
  const doc = canvas.ownerDocument || globalThis.document;
  const host = canvas.parentElement || canvas;
  const reduced = () => { try { return options.getReducedMotion?.() === true; } catch { return false; } };
  const now = () => (win.performance?.now ? win.performance.now() : Date.now());
  let W = 1, H = 1, DPR = 1, dprCap = 2, gl = null, U = null, ctx2d = null, frameId = null, disposed = false, paused = false;
  let tw = null, poseName = 'void', dive = 'solio', face = null, space = 'solio', autoFace = false, still = false;
  let visible = { solio: false, workspace: false, pulse: false };
  let hotWant = -1, glintWant = 0, glintBoost = 0, frameNo = 0, lastDraw = 0, slowFrames = 0, sampled = 0;
  const S = { cx: 0, top: 0, r: 1, az: 0, lz: 0.5, lit: 0, focus: 0, ax: [...AXIS.rest], spin: 0, mark: 0, par: 1, calm: 0, open: 0, eye: 0 };
  /* 새 판을 깎는 정도. cut은 깎인 만큼(0~1), cutOn은 그 장면이 켜진 정도다. forgeP는 웅장한 판에서 구의 크기를 정하는 진행이다 */
  let cut = 1, cutOn = 0, cutOnWant = 0, forgeP = 0;
  /* 점 눈. gate는 눈을 켠 정도, open은 뜬 정도, face는 얼굴이 향한 쪽, gaze는 눈길이 얼굴보다 앞서 간 만큼(점 한 칸이 1)이다(시안 그대로) */
  const MOOD_NO = { calm: 0, smile: 1, sleep: 2, sorry: 3, busy: 4 };
  /* 바탕색(0~1). setBg로 바라는 색을 주면 0.45초 동안 다가간다. 장의 빠르기와 상관없이 시간으로 잰다(가려진 창이나 느린 장치에서도 같은 때 끝난다) */
  const bg = [0, 0, 0], bgWant = [0, 0, 0], bgFrom = [0, 0, 0];
  let bgT0 = 0;
  const BG_MS = 450;
  const bgCss = () => `rgb(${bg.map(v => Math.round(v * 255)).join(',')})`;
  const eye = { on: options.eyes === true, gate: 0, gateS: 0, mood: 'sleep', open: 1, face: [0, 0], gaze: [0, 0], lid: null, nextBlink: 0, token: 0 };
  const ptr = { x: 0.5, y: 0.5 }, ptrS = { x: 0.5, y: 0.5 };
  const hot = [0, 0, 0], markXY = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  /* 구 곁의 펼침. nearK는 손이 작은 구에 다가온 만큼이다(시안 그대로). nearOn은 얼굴이 켠다(들어온 뒤 방에 있을 때만). 움직임 줄이기에서는 nearK를 쓰지 않는다(설계 검토 1차 15) */
  let nearOn = false, nearK = 0, nearGoal = 0;
  /* 지도의 점 스물둘(자리와 모습)과 별을 잇는 선. 그릴 때마다 mapDots와 mapLines가 채운다 */
  const dotPos = new Float32Array(MAP_DOTS * 3), dotAtt = new Float32Array(MAP_DOTS * 3);
  let mapNow = { lit: 0, lines: 0 };
  /* eyeEnd는 지도가 꺼진 쪽 자세에서 눈이 보이는 정도, eyeShown은 방금 그린 장에서 눈이 보인 정도다 */
  let eyeEnd = 0, eyeShown = 0;

  const poses = () => orbPoses({ W, H, home: options.getHome?.() || { x: 40, y: 40 }, dive, face: face || space, forgeP });
  function snap(name) {
    const p = poses()[name];
    for (const k in p) if (k !== 'dive') S[k] = Array.isArray(p[k]) ? [...p[k]] : p[k];
    S.open = name === 'inside' ? 1 : 0; S.eye = p.eye || 0; poseName = name;
    if (tw) { const r = tw.res; tw = null; r(); }
    wake();
  }
  /* elapsed를 주면 그만큼 이미 지난 것으로 보고 길의 중간에서 시작한다(시작 창과 앱 창이 같은 드러남을 이어 그릴 때) */
  function tween(name, ms, ease = easeIO, litCurve = null, { elapsed = 0 } = {}) {
    if (tw) { const r = tw.res; tw = null; r(); }
    poseName = name;
    const from = { ...S, ax: [...S.ax] }, to = poses()[name];
    if (to.spin !== undefined) from.spin = to.spin + Math.atan2(Math.sin(S.spin - to.spin), Math.cos(S.spin - to.spin));
    const length = reduced() ? Math.min(ms, 220) : ms;
    wake();
    return new Promise(res => { tw = { from, p0: placeXY(S, dive), name, t0: now() - clamp(elapsed, 0, length), ms: length, ease, litCurve, res }; if (paused || doc?.hidden) finishTween(); });
  }
  function finishTween() { if (!tw) return; mixPose(S, tw.from, poses()[tw.name], 1, { ...tw, W, H, dive }); const r = tw.res; tw = null; r(); }
  function stepTween(t) {
    if (!tw) return;
    const k = clamp((t - tw.t0) / tw.ms, 0, 1);
    mixPose(S, tw.from, poses()[tw.name], k, { ...tw, W, H, dive });
    if (k >= 1) { const r = tw.res; tw = null; r(); }
  }
  /* 구가 드러나는 동안 누르면 남은 시간을 줄인다 */
  function hurry(name) { if (tw && tw.name === name) tw.ms = Math.min(tw.ms, now() - tw.t0 + 320); }

  function initGL() {
    if (options.noWebGL || options.noCanvas) return false;
    try { gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' }); } catch { gl = null; }
    if (!gl) return false;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader'); return s; };
    try {
      const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error('link');
      gl.useProgram(pr);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      U = {}; for (const k of UNIFORMS) U[k] = gl.getUniformLocation(pr, k);
      U.uDot = gl.getUniformLocation(pr, 'uDot[0]'); U.uDotA = gl.getUniformLocation(pr, 'uDotA[0]');
      return true;
    } catch { gl = null; return false; }
  }
  function useFallback() {
    gl = null; U = null;
    if (options.noCanvas) { ctx2d = null; markMode(); return; }
    try { ctx2d = canvas.getContext('2d'); } catch { ctx2d = null; }
    // WebGL 맥락을 이미 받은 캔버스는 2D 맥락을 주지 않는다(장치를 잃었거나 셰이더를 못 만든 때). 같은 자리에 새 캔버스를 두고 거기에 그린다(최종 검수)
    if (!ctx2d && doc?.createElement && canvas.parentNode) {
      const fresh = doc.createElement('canvas');
      for (const name of canvas.getAttributeNames?.() || []) if (name !== 'width' && name !== 'height') fresh.setAttribute(name, canvas.getAttribute(name));
      canvas.replaceWith(fresh);
      canvas = fresh;
      try { ctx2d = canvas.getContext('2d'); } catch { ctx2d = null; }
      // 새 캔버스는 그림 크기가 기본값(300×150)이다. 곧바로 창에 맞추고 한 장 그린다(다시 검수)
      resize();
    }
    markMode();
  }
  /* 지금 어느 길로 그리는지 캔버스에 적는다. WebGL도 2D도 없으면 「static」이고, CSS가 그 자리에 정적 구를 그린다.
   * 지금 얼굴(portal-entry)의 정적 구처럼 어느 단계에서도 구가 사라지지 않게 한다(11-16 토큰 세션 전달) */
  let staticAt = '';
  function markMode() {
    const mode = gl ? 'webgl' : ctx2d ? '2d' : 'static';
    try { if (canvas.dataset && canvas.dataset.orbMode !== mode) canvas.dataset.orbMode = mode; } catch { /* 무시 */ }
    if (mode !== 'static') staticAt = '';
  }
  function drawStatic(cx, cy, r, lit) {
    const key = Math.round(cx) + ',' + Math.round(cy) + ',' + Math.round(r) + ',' + lit.toFixed(2);
    if (key === staticAt || !canvas.style?.setProperty) return;
    staticAt = key;
    canvas.style.setProperty('--orb-sx', Math.round(cx) + 'px');
    canvas.style.setProperty('--orb-sy', Math.round(cy) + 'px');
    canvas.style.setProperty('--orb-sr', Math.max(0, Math.round(r)) + 'px');
    canvas.style.setProperty('--orb-ring', 'rgba(243,241,236,' + (0.45 * Math.min(1, Math.max(0, lit))).toFixed(3) + ')');
  }

  function resize() {
    if (disposed) return;
    const s = host.getBoundingClientRect();
    W = Math.max(1, s.width); H = Math.max(1, s.height);
    // 가는 결이 물결무늬로 깨지지 않게 화면 점보다 촘촘하게 그린다(시안 그대로). 느린 장치에서는 dprCap이 한 단씩 내려간다
    DPR = Math.min(Math.max(win.devicePixelRatio || 1, dprCap), Math.sqrt(7e6 / (W * H)));
    const cw = Math.round(W * DPR), ch = Math.round(H * DPR);
    const changed = canvas.width !== cw || canvas.height !== ch;
    if (changed) { canvas.width = cw; canvas.height = ch; }
    if (gl) gl.viewport(0, 0, cw, ch);
    if (!tw) { const lit = S.lit; snap(poseName); if (poseName === 'inside') S.lit = lit; }
    // 크기를 바꾸면 캔버스가 지워진다. 다음 장을 기다리지 않고 그 자리에서 한 장 그린다(최종 검수)
    if (changed && !paused) draw(now());
    wake();
  }

  /* 눈꺼풀. 시안의 lidTo · blink · setMood · eyesWake를 그대로 옮겼다. 움직임을 줄인 설정에서는 짧게 끝낸다 */
  function lidTo(v, ms, ease = easeIO) {
    if (eye.lid) eye.lid.res();
    wake();
    return new Promise(res => {
      eye.lid = { from: eye.open, to: v, t0: now(), ms: reduced() ? Math.min(ms, 80) : ms, ease, res };
      if (paused || doc?.hidden) { eye.open = v; const l = eye.lid; eye.lid = null; l.res(); }
    });
  }
  /* 눈의 지금 표정을 얼굴에 알린다(화면 확인이 무대의 data-eyes로 읽는다). 눈을 껐으면 off다 */
  let eyesSaid = null;
  function eyesChanged() { const m = eye.on && eye.gate > 0 ? eye.mood : 'off'; if (m === eyesSaid) return; eyesSaid = m; try { options.onEyes?.(m); } catch { /* 무시 */ } }
  function stepEye(t) {
    const l = eye.lid;
    if (l) { const k = clamp((t - l.t0) / l.ms, 0, 1); eye.open = lerp(l.from, l.to, l.ease(k)); if (k >= 1) { eye.lid = null; l.res(); } }
    eye.gateS += (eye.gate - eye.gateS) * 0.09;
    if (eye.on && !reduced() && !still && !eye.lid && eye.mood === 'calm' && eye.gateS > 0.9 && S.eye > 0.9 && t > eye.nextBlink) { eye.nextBlink = t + 2600 + Math.random() * 4200; void blink(); }
  }
  async function blink() { const k = ++eye.token; await lidTo(0, 90); if (k !== eye.token) return; await lidTo(1, 170, easeOut); }
  function eyeStop() { ++eye.token; if (eye.lid) { const l = eye.lid; eye.lid = null; l.res(); } }
  /* 표정을 바꾸거나 눈을 뜨는 동안에는 깜빡임을 1.4초 뒤로 민다. 눈꺼풀 하나가 끝나는 장에서는 다음 걸음(약속의 뒤)보다 깜빡임 검사가 먼저 돌아,
   * 밀려 있던 깜빡임이 토큰을 올려 막 시작한 표정 바꾸기를 지웠다(웃어야 할 때 웃지 않음, 시안 0932c18ab와 같은 고침) */
  async function setMood(m, ms = 0) {
    if (MOOD_NO[m] === undefined) return;
    eye.nextBlink = now() + 1400;
    const k = ++eye.token;
    if (m !== eye.mood) { await lidTo(0, 110); if (k !== eye.token) return; eye.mood = m; eyesChanged(); await lidTo(1, m === 'calm' ? 260 : 190, easeOut); if (k !== eye.token) return; }
    if (ms) { await new Promise(r => win.setTimeout(r, reduced() ? Math.min(ms, 120) : ms)); if (k !== eye.token) return; void setMood('calm'); }
  }
  /* instant: 다른 창에서 이미 보이던 눈을 잇는 때는 떠오르지 않고 바로 보인다(0.4.96 검수 B3) */
  function eyesAsleep({ instant = false } = {}) { eyeStop(); eye.mood = 'sleep'; eye.open = 1; eye.gate = 1; if (instant) eye.gateS = 1; eyesChanged(); wake(); }
  async function eyesWake() {
    eye.nextBlink = now() + 1400;
    const k = ++eye.token; eye.gate = 1;
    await lidTo(0, 160); if (k !== eye.token) return;
    eye.mood = 'calm'; eyesChanged();
    await lidTo(1, 460, easeOut); if (k !== eye.token) return;
    eye.nextBlink = now() + 1100;
  }
  function eyesCalm({ instant = false } = {}) { eyeStop(); eye.mood = 'calm'; eye.open = 1; eye.gate = 1; if (instant) eye.gateS = 1; eyesChanged(); wake(); }
  function eyesOff() { eyeStop(); eye.gate = 0; eye.gateS = 0; eye.mood = 'sleep'; eye.open = 1; eyesChanged(); wake(); }
  /* 웅장한 판에서 깎인 만큼에 따라 구가 조금씩 커진다. 자세를 옮기는 중이 아니면 그 자리에서 크기를 맞춘다(시안 forgeAt) */
  function forgeAt(p) {
    cut = clamp(p, 0, 1); forgeP = cut;
    if (poseName === 'forge' && !tw) { const g = forgeGeom(W, H, forgeP); S.r = g.r; S.top = g.cy - g.r; }
    wake();
  }

  function draw(t) {
    { const k = reduced() || still ? 1 : clamp((t - bgT0) / BG_MS, 0, 1), e = 1 - (1 - k) * (1 - k); for (let i = 0; i < 3; i++) bg[i] = k >= 1 ? bgWant[i] : bgFrom[i] + (bgWant[i] - bgFrom[i]) * e; }
    const sec = t / 1000, motion = reduced() || still ? 0 : 1;
    ptrS.x += (ptr.x - ptrS.x) * 0.06; ptrS.y += (ptr.y - ptrS.y) * 0.06;
    stepEye(t);
    cutOn += (cutOnWant - cutOn) * (motion ? 0.09 : 1);
    glintBoost += (glintWant - glintBoost) * 0.05;
    for (let i = 0; i < 3; i++) hot[i] += ((hotWant === i ? 1 : 0) - hot[i]) * 0.14;
    // 별은 구에서 정해진 자리에 있어 구는 돌지 않는다(want와 ta가 늘 같은 값이다). 옛 길을 남긴 것은 얼굴이 켜고 끄는 약속을 그대로 두려는 것이다
    if (autoFace && !tw) {
      const to = face || space, want = -PLACE_LON[to], ta = faceAx(to), d = Math.atan2(Math.sin(want - S.spin), Math.cos(want - S.spin));
      const q = motion ? 0.1 : 1;
      S.spin += d * q; for (let i = 0; i < 3; i++) S.ax[i] += (ta[i] - S.ax[i]) * q;
    }
    /* 손이 250px에서 60px로 다가오면 작은 구가 최대 20% 커져 알아챈 티를 낸다 */
    nearGoal = nearOn && motion && poseName === 'home' && !tw ? smooth(250, 60, Math.hypot(ptrS.x * W - S.cx, ptrS.y * H - (S.top + S.r))) : 0;
    nearK += (nearGoal - nearK) * 0.14; if (Math.abs(nearGoal - nearK) < 0.002) nearK = nearGoal;
    const rr = S.r * (1 + 0.2 * nearK);
    const free = S.par * motion, par = free * S.r * 0.05;
    const cx = S.cx + (ptrS.x - 0.5) * par, cy = S.top + S.r + (ptrS.y - 0.5) * par;
    const az = S.az + ((ptrS.x - 0.5) * -(0.7 * free + 0.14 * S.focus + 0.2 * (1 - S.par) * (1 - S.focus)) + 0.05 * Math.sin(sec * 0.4)) * motion;
    const ax = [S.ax[0] + (ptrS.x - 0.5) * 0.24 * free, S.ax[1] - (ptrS.y - 0.5) * 0.2 * free, S.ax[2]];
    // 얼굴은 손이 있는 쪽을 본다. 눈길이 먼저 가고 얼굴이 뒤따른다(시안 그대로)
    {
      const reach = Math.max(280, S.r * 2.6), wx = clamp((ptrS.x * W - cx) / reach, -1, 1) * 0.5, wy = clamp((cy - ptrS.y * H) / reach, -1, 1) * 0.4, q = motion ? 0.1 : 1;
      eye.gaze[0] = clamp((wx - eye.face[0]) * 7, -1, 1); eye.gaze[1] = clamp((wy - eye.face[1]) * 7, -1, 1);
      eye.face[0] += (wx - eye.face[0]) * q; eye.face[1] += (wy - eye.face[1]) * q;
    }
    const mk = ORB_PLACES.map(name => placeDir(ax, S.spin, name));
    mk.forEach((m, i) => { markXY[i] = [cx + S.r * m[0], cy - S.r * m[1], visible[ORB_PLACES[i]] ? m[2] : -1]; });
    const lit = S.lit * (1 + 0.03 * Math.sin(sec * 0.9) * motion);
    const gb = glintBoost * (1.2 + 0.8 * Math.sin(sec * 3.1)) * (motion ? 1 : 0.6);
    if (motion) frameNo = (frameNo + 1) % 64;
    const mark = options.places === false ? 0 : S.mark;
    /* 지도의 점과 선. 들어가는 중인 공간의 별은 보이는 공간이 아니어도 그린다 */
    const shown = name => visible[name] === true || (name === dive && S.open > 0);
    /* 눈이 없는 자세(로그인을 묻는 큰 구)에서 지도로 가거나 그리로 돌아갈 때는 눈도 점도 눈 자리에 그리지 않는다. 그리면 창만 한 구의 눈 자리에 큰 점이 잠깐 찍힌다(Fable 최종 검수 F2) */
    if (tw) { const to = poses()[tw.name]; eyeEnd = (tw.from.mark || 0) <= (to.mark || 0) ? (tw.from.eye || 0) : (to.eye || 0); } else if (mark <= 0.0005) eyeEnd = S.eye;
    mapDots({ mark, r: rr, face: eye.face, gaze: eye.gaze, seen: eye.on && eye.gateS > 0.5 && eyeEnd > 0.5, open: S.open, dive, space, hot, shown }, dotPos, dotAtt);
    const segs = mapLines(shown), lineK = clamp((mark - 0.72) / 0.28, 0, 1) * (1 - S.open);
    let litDots = 0; for (let i = 0; i < MAP_DOTS; i++) if (dotAtt[i * 3 + 1] > 0.003) litDots++;
    mapNow = { lit: litDots, lines: lineK > 0 ? segs.filter(Boolean).length : 0 };
    /* 지도가 켜지는 첫머리에 눈이 물러나고 그 자리에서 점이 떠난다. 꺼질 때는 점이 돌아온 자리에서 눈이 다시 뜬다 */
    const eyeVis = (mark > 0.0005 ? (1 - smooth(0, 0.1, mark)) * eyeEnd : S.eye) * eye.gateS;
    eyeShown = eye.on ? eyeVis : 0;
    if (gl) {
      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      gl.uniform2f(U.uC, cx * DPR, (H - cy) * DPR);
      gl.uniform1f(U.uR, rr * DPR); gl.uniform1f(U.uLit, lit); gl.uniform1f(U.uAz, az); gl.uniform1f(U.uLz, S.lz); gl.uniform1f(U.uFocus, S.focus);
      gl.uniform1f(U.uGb, gb); gl.uniform1f(U.uDpr, DPR); gl.uniform1f(U.uSeed, frameNo);
      gl.uniform3f(U.uBg, bg[0], bg[1], bg[2]);
      gl.uniform3f(U.uAxis, ax[0], ax[1], ax[2]);
      gl.uniform1f(U.uMark, mark); gl.uniform1f(U.uCalm, S.calm);
      gl.uniform3f(U.uOpen, ...ORB_PLACES.map(n => (n === dive ? S.open : 0)));
      gl.uniform3fv(U.uDot, dotPos); gl.uniform3fv(U.uDotA, dotAtt);
      gl.uniform4f(U.uSeg0, ...(segs[0] || [0, 0, 0, 0])); gl.uniform4f(U.uSeg1, ...(segs[1] || [0, 0, 0, 0]));
      gl.uniform2f(U.uLine, segs[0] ? clamp(lineK * 2, 0, 1) : 0, segs[1] ? clamp(lineK * 2 - 1, 0, 1) : 0);
      gl.uniform1f(U.uCut, cut); gl.uniform1f(U.uCutOn, cutOn);
      gl.uniform4f(U.uEye, eye.on ? 1 : 0, eyeVis, eye.open, MOOD_NO[eye.mood]);
      gl.uniform3f(U.uFace, eye.face[0], eye.face[1], 1);
      gl.uniform3f(U.uGaze, eye.gaze[0], eye.gaze[1], sec % 600);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    } else if (ctx2d) {
      // WebGL이 없을 때: 검정 원과 빛 오는 쪽의 가는 호. 지도는 별과 별을 잇는 선만 그린다(점이 날아오는 길은 그리지 않는다)
      const c = ctx2d; c.setTransform(DPR, 0, 0, DPR, 0, 0);
      c.fillStyle = bgCss(); c.fillRect(0, 0, W, H);
      c.beginPath(); c.arc(cx, cy, rr, 0, Math.PI * 2); c.fillStyle = '#030303'; c.fill();
      c.lineWidth = 1.4; c.strokeStyle = 'rgba(243,241,236,' + (0.6 * S.lit).toFixed(3) + ')'; c.beginPath(); c.arc(cx, cy, rr, -az - 1.1, -az + 1.1); c.stroke();
      if (mark > 0.05) {
        c.lineWidth = 1; c.strokeStyle = 'rgba(243,241,236,' + (0.3 * lineK * S.lit).toFixed(3) + ')';
        for (const s of segs) if (s && rr > 40) { c.beginPath(); c.moveTo(cx + rr * s[0], cy - rr * s[1]); c.lineTo(cx + rr * s[2], cy - rr * s[3]); c.stroke(); }
        ORB_PLACES.forEach((name, i) => {
          if (!shown(name)) return;
          const q = PLACE_STAR[name], far = name !== dive ? 1 - S.open : 1;
          c.fillStyle = 'rgba(243,241,236,' + Math.min(1, (0.75 + 0.25 * hot[i]) * mark * S.lit * far).toFixed(3) + ')';
          c.beginPath(); c.arc(cx + rr * q[0], cy - rr * q[1], (name === space ? 3.4 : 2.5) + 0.8 * hot[i], 0, Math.PI * 2); c.fill();
        });
      }
    } else {
      drawStatic(cx, cy, rr, S.lit);
    }
    options.onRender?.(S);
  }

  /* 움직임이 없고 손도 가만히 있으면 초당 30장으로 줄인다. 창이 가려지면 멈춘다. 60장 가운데 40장 넘게 느리면(움직일 때 24ms, 멈춰 있을 때 50ms 넘음) 촘촘함을 한 단 낮춘다 */
  function idle() { return !tw && !eye.lid && bg.every((v, i) => v === bgWant[i]) && Math.abs(eye.gate - eye.gateS) < 0.01 && Math.abs(cutOnWant - cutOn) < 0.01 && Math.abs(ptr.x - ptrS.x) < 0.001 && Math.abs(ptr.y - ptrS.y) < 0.001 && Math.abs(glintWant - glintBoost) < 0.01 && !autoFace && nearK === nearGoal && hot.every((h, i) => Math.abs(h - (hotWant === i ? 1 : 0)) < 0.01); }
  function frame(t) {
    frameId = null;
    if (disposed || paused) return;
    const gap = t - lastDraw;
    const resting = idle();
    if (resting && gap < 32) { frameId = win.requestAnimationFrame(frame); return; }
    // 멈춰 있어 일부러 늦춘 장면(초당 30장, 약 33ms 간격)은 50ms를 넘을 때만 느린 장면으로 센다. 24ms로 세면 장치와 상관없이 배율이 내려갔다(검수 B3).
    // 200ms를 넘는 장면도 센다. 그래픽 가속이 없는 장치가 한 번도 세어지지 않았다. 창이 가려졌다 돌아온 첫 장은 resume()이 lastDraw를 0으로 돌려 세지 않는다(0.4.95 원천 후보 검수 F5)
    if (lastDraw && gap > 0) {
      sampled++; if (gap > (resting ? 50 : 24)) slowFrames++;
      if (sampled >= 60) { if (slowFrames > 40 && dprCap > 1) { dprCap = dprCap > 1.5 ? 1.5 : 1; resize(); } sampled = 0; slowFrames = 0; }
    }
    lastDraw = t;
    stepTween(t); draw(t);
    // 이 장 안에서 resize()가 이미 다음 장을 걸었으면 또 걸지 않는다(고리가 둘로 도는 것을 막는다, 최종 검수)
    if (frameId === null) frameId = win.requestAnimationFrame(frame);
  }
  function wake() { if (!disposed && !paused && frameId === null && typeof win.requestAnimationFrame === 'function') frameId = win.requestAnimationFrame(frame); }

  if (!initGL()) useFallback(); else markMode();
  const glCanvas = canvas;
  const onLost = event => { event.preventDefault(); useFallback(); wake(); };
  // 맥락 복구 알림은 원래 캔버스에 온다. 2D 새 캔버스로 바꿔 두었으면 원래 캔버스로 되돌린 뒤 WebGL을 다시 세운다(0.4.95 원천 후보 검수 B2)
  const onRestored = () => {
    if (canvas !== glCanvas && canvas.parentNode) { canvas.replaceWith(glCanvas); canvas = glCanvas; }
    if (initGL()) ctx2d = null; else useFallback();
    markMode(); resize(); wake();
  };
  glCanvas.addEventListener('webglcontextlost', onLost);
  glCanvas.addEventListener('webglcontextrestored', onRestored);
  const observer = typeof win.ResizeObserver === 'function' ? new win.ResizeObserver(() => resize()) : null;
  observer?.observe(host);
  resize(); snap('void');

  return {
    snap, tween, hurry, resize,
    get pose() { return poseName; },
    get moving() { return !!tw; },
    get webgl() { return !!gl; },
    setDive(name) { if (PLACE_LON[name] !== undefined) dive = name; },
    setSpace(name) { if (PLACE_LON[name] !== undefined) { space = name; wake(); } },
    setFace(name) { face = PLACE_LON[name] !== undefined ? name : null; wake(); },
    setAutoFace(on) { autoFace = !!on; wake(); },
    setVisiblePlaces(list) { visible = Object.fromEntries(ORB_PLACES.map(n => [n, Array.isArray(list) && list.includes(n)])); wake(); },
    setHot(name) { hotWant = name ? ORB_PLACES.indexOf(name) : -1; wake(); },
    setGlint(on) { glintWant = on ? 1 : 0; wake(); },
    setLit(v) { S.lit = v; wake(); },
    /* 바탕색을 [r, g, b](0~255)로 준다. 움직임을 줄였으면 바로 바뀐다. 정적 구(그리기가 없을 때)는 캔버스의 --orb-bg로 같은 색을 쓴다 */
    setBg(rgb) { const v = Array.isArray(rgb) && rgb.length === 3 && rgb.every(Number.isFinite) ? rgb.map(n => clamp(n / 255, 0, 1)) : [0, 0, 0]; if (v.some((n, i) => n !== bgWant[i])) { for (let i = 0; i < 3; i++) { bgFrom[i] = bg[i]; bgWant[i] = v[i]; } bgT0 = now(); } try { canvas.style.setProperty('--orb-bg', `rgb(${v.map(n => Math.round(n * 255)).join(',')})`); } catch { /* 무시 */ } wake(); },
    get bg() { return bgWant.map(n => Math.round(n * 255)); },
    setSpin(v) { S.spin = v; },
    /* 업데이트 뒤의 첫 장면에서 빛줄기와 함께 구가 한 바퀴 돈다(시안 forgeDone의 S.az) */
    setAz(v) { if (Number.isFinite(v)) { S.az = v; wake(); } },
    /* 점 로고가 물러나는 순간 작은 구를 한 번 크게 띄운 뒤 제자리로 줄인다(시안 enter의 S.r = 5) */
    setRadius(r) { if (r > 0) S.r = r; wake(); },
    setStill(on) { still = !!on; wake(); },
    setPointer(x, y) { ptr.x = clamp(x, 0, 1); ptr.y = clamp(y, 0, 1); wake(); },
    /* 손이 다가오면 작은 구가 커지는 것을 켜고 끈다(들어온 뒤 방에 있고 옛 화면이 닫혀 있을 때만 켠다) */
    setNear(on) { nearOn = !!on; wake(); },
    /* 점 눈(유호님 11-17 「점눈으로 하자」). on이 아니면 셰이더가 눈을 그리지 않는다 */
    setEyes(on) { eye.on = !!on; if (!eye.on) eyesOff(); wake(); },
    eyesAsleep, eyesWake, eyesOff, eyesCalm,
    setMood: (m, ms) => setMood(m, ms),
    get mood() { return eye.mood; },
    /* 새 판 깎기. setCutOn(true)이면 깎는 장면이 켜지고, forgeAt(p)는 깎인 만큼이다 */
    setCutOn(on, { instant = false } = {}) { cutOnWant = on ? 1 : 0; if (instant) cutOn = cutOnWant; wake(); },
    setCut(v) { cut = clamp(v, 0, 1); wake(); },
    forgeAt,
    get cut() { return cut; },
    /* 구 위의 별 가운데 (x, y) 아래에 있는 공간 */
    placeUnder(x, y) {
      const reach = RHO * S.r + 12;
      for (let i = 0; i < 3; i++) if (markXY[i][2] > 0.15 && Math.hypot(x - markXY[i][0], y - markXY[i][1]) < reach) return ORB_PLACES[i];
      return null;
    },
    state: () => ({ ...S, ax: [...S.ax], W, H, pose: poseName, moving: !!tw, webgl: !!gl, marks: markXY.map(m => m.map(v => Math.round(v * 100) / 100)), cut, cutOn, eyes: { on: eye.on, gate: eye.gateS, mood: eye.mood, open: eye.open }, eyeShown, map: { ...mapNow }, nearK }),
    draw: () => draw(now()),
    pause() { paused = true; if (frameId !== null) { win.cancelAnimationFrame?.(frameId); frameId = null; } finishTween(); },
    resume() { if (!paused) return; paused = false; lastDraw = 0; wake(); },
    finish: finishTween,
    dispose() {
      if (disposed) return; disposed = true;
      if (frameId !== null) win.cancelAnimationFrame?.(frameId);
      finishTween(); observer?.disconnect();
      glCanvas.removeEventListener('webglcontextlost', onLost); glCanvas.removeEventListener('webglcontextrestored', onRestored);
    },
  };
}
