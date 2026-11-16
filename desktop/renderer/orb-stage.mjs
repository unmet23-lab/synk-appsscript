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

/* ── 구 위의 자리. 공간 하나가 구에 새긴 고리 하나다. 지도의 도시처럼 경도와 위도가 저마다 달라, 구가 돌고 기울어야 그 자리가 앞에 온다 ── */
export const ORB_PLACES = Object.freeze(['solio', 'workspace', 'pulse']);
export const PLACE_LON = Object.freeze({ solio: 0, workspace: rad(-48), pulse: rad(44) });
export const PLACE_CL = Object.freeze({ solio: rad(75), workspace: rad(58), pulse: rad(92) }); // 축에서 자리까지의 각(작을수록 위쪽)
export const RHO = 0.092; // 고리의 크기(구 반지름을 1로 본 값). 셰이더의 RHO와 같아야 한다
export const AXIS = Object.freeze({ rest: Object.freeze([0.28, 0.52, 0.81]), top: Object.freeze([0, 0.972, 0.235]) });

/* 그 자리가 보는 쪽을 똑바로 향하는 축. 지구본처럼 거의 선 축을 자리의 높이만큼 기울인다 */
export const faceAx = name => [0, Math.sin(PLACE_CL[name]), Math.cos(PLACE_CL[name])];

/* 축이 a이고 spin만큼 돌린 구에서, 그 자리가 보는 쪽 좌표로 어디에 오는지 낸다. 경도 0은 축에서 보는 쪽 아래로 내려오는 줄이다 */
export function placeDir(a, spin, name) {
  const n = Math.hypot(a[0], a[1], a[2]) || 1, A = [a[0] / n, a[1] / n, a[2] / n], d = A[2] - A[1];
  let z = [-d * A[0], -1 - d * A[1], 1 - d * A[2]];
  const zn = Math.hypot(z[0], z[1], z[2]) || 1; z = [z[0] / zn, z[1] / zn, z[2] / zn];
  const x = [A[1] * z[2] - A[2] * z[1], A[2] * z[0] - A[0] * z[2], A[0] * z[1] - A[1] * z[0]];
  const l = PLACE_LON[name] + spin, c = Math.cos(PLACE_CL[name]), s = Math.sin(PLACE_CL[name]), cl = Math.cos(l), sl = Math.sin(l);
  return [c * A[0] + s * (cl * z[0] + sl * x[0]), c * A[1] + s * (cl * z[1] + sl * x[1]), c * A[2] + s * (cl * z[2] + sl * x[2])];
}
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

/* 구가 서는 자리 일곱. top은 구의 맨 윗점, r은 반지름(화면 px).
   home은 왼쪽 위의 작은 구 자리(얼굴이 그 단추의 가운데를 알려 준다), dive와 face는 들어갈 공간과 앞에 둘 공간이다 */
export function orbPoses({ W, H, home = { x: 40, y: 40 }, dive = 'solio', face = 'solio', forgeP = 0 }) {
  const r0 = Math.min(H * 0.21, W * 0.3), fg = forgeGeom(W, H, forgeP);
  const rAsk = Math.max(H * 1.9, W * 1.25);
  const g = switchGeom(W, H), rIn = Math.hypot(W, H) * 0.56 / RHO, hr = 13;
  return {
    void: { cx: W / 2, top: H / 2 - r0, r: r0, az: rad(-50), lz: 0.5, lit: 0, focus: 0, ax: AXIS.rest, mark: 0, par: 1, calm: 0 },
    rest: { cx: W / 2, top: H / 2 - r0, r: r0, az: rad(135), lz: 0.5, lit: 1, focus: 0, ax: AXIS.rest, mark: 0, par: 1, calm: 0, eye: 1 },
    /* 새 판을 깎는 동안. 깎는 동안은 어둡고(lit 0.58), 글이 놓일 아래쪽 결은 가라앉힌다. 다 깎이면 얼굴이 빛을 올린다 */
    forge: { cx: W / 2, top: fg.cy - fg.r, r: fg.r, az: rad(128), lz: 0.42, lit: 0.58, focus: 0, ax: AXIS.rest, mark: 0, par: 0.16, calm: 0.85, eye: 1 },
    ask: { cx: W / 2, top: H * 0.25, r: rAsk, az: rad(150), lz: -0.3, lit: 1, focus: 1, ax: AXIS.top, mark: 0, par: 0, calm: 1 },
    /* 들어갈 자리가 보는 쪽을 똑바로 향하고 그 고리가 창보다 커진 때다. 거기까지 가는 길은 mixPose가 자리를 따라가며 잡는다 */
    inside: { cx: W / 2, top: H / 2 - rIn, r: rIn, az: rad(150), lit: 0, focus: 1, ax: faceAx(dive), spin: -PLACE_LON[dive], mark: 1, par: 0, calm: 0, dive: true },
    home: { cx: home.x, top: home.y - hr, r: hr, az: rad(135), lz: 0.5, lit: 1, focus: 0, ax: AXIS.rest, mark: 0, par: 1, calm: 0, eye: 1 },
    /* 공간을 고를 때는 구가 가운데로 와서 지금 있는 자리를 앞에 보인다 */
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
    /* 들어갈 자리가 화면 한가운데로 오도록 구를 옮긴다. 구는 그 자리를 보는 쪽으로 돌리면서 커지고, 고리 안이 열린다 */
    const m = placeDir(S.ax, S.spin, o.dive), ep = smooth(0, 0.7, t);
    S.cx = lerp(o.p0[0], o.W / 2, ep) - S.r * m[0];
    S.top = lerp(o.p0[1], o.H / 2, ep) + S.r * m[1] - S.r;
    S.open = smooth(0.3, 0.8, t);
  } else {
    S.cx = lerp(a.cx, b.cx, e); S.top = lerp(a.top, b.top, e); S.open = lerp(a.open || 0, 0, e);
  }
  return S;
}

const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes, uC;
uniform float uR, uLit, uAz, uLz, uFocus, uGb, uDpr, uSeed, uMark, uCalm;
uniform vec3 uAxis, uM0, uM1, uM2, uHot, uHere, uOpen, uVis;
uniform float uCut, uCutOn;
uniform vec4 uEye;
uniform vec3 uFace, uGaze;
const float RHO = 0.092;
float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
vec2 place(vec3 n, vec3 M, float hot, float here, float open, float z, vec2 l2){
  vec3 dv = n - M;
  float dd = length(dv);
  float zz = max(z, 0.06);
  vec2 gr = vec2(dv.x - dv.z * n.x / zz, dv.y - dv.z * n.y / zz) / max(dd, 0.0001);
  float sd = (dd - RHO) / max(length(gr), 0.05) * uR / uDpr;
  float show = smoothstep(0.02, 0.2, M.z);
  float lift = max(hot, open);
  float lw = mix(0.5, 1.0, hot);
  float ring = (1.0 - smoothstep(lw, lw + 0.75, abs(sd))) * show;
  float bloom = exp(-abs(sd) / 2.6) * mix(0.09, 0.24, lift) * (1.0 - open) * show;
  float facing = 0.5 + 0.5 * dot(dv.xy / max(length(dv.xy), 0.0001), l2);
  float pd = length(n.xy - M.xy) * uR / uDpr;
  float pin = (1.0 - smoothstep(2.2, 3.1, pd)) * here * (1.0 - open) * show;
  float glow = hot * 0.07 * (1.0 - smoothstep(0.0, RHO, dd)) * (1.0 - open) * show;
  return vec2(ring * mix(0.44 + 0.30 * facing, 1.0, lift) + bloom + pin * 0.92 + glow, (1.0 - smoothstep(-1.2, 0.3, sd)) * open * show);
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
    col = vec3(0.0);
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
    vec3 inC = vec3(0.005) + warm * uLit * mix(1.0, 0.1, tiny) * (an * side * groove * mix(0.78, 0.46, uFocus) * pulse + (an2 * groove * 0.09 + rings) * calm + spec * 0.20 * side + 0.010 * max(dot(n, L), 0.0));
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
    col = mix(outC, inC, inside);
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
  float mv = uMark * smoothstep(30.0, 84.0, uR / uDpr) * inside;
  if (mv > 0.001) {
    vec2 l2 = vec2(cos(uAz), sin(uAz));
    vec2 a0 = place(n, uM0, uHot.x, uHere.x, uOpen.x, z, l2) * uVis.x;
    vec2 a1 = place(n, uM1, uHot.y, uHere.y, uOpen.y, z, l2) * uVis.y;
    vec2 a2 = place(n, uM2, uHot.z, uHere.z, uOpen.z, z, l2) * uVis.z;
    col *= 1.0 - max(a0.y, max(a1.y, a2.y)) * mv;
    col += warm * uLit * mv * (a0.x + a1.x + a2.x);
  }
  float g = ign(f + uSeed * 7.31) + ign(f.yx + 17.0 + uSeed * 3.17) - 1.0;
  col += g * 2.8 / 255.0;
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}`;
const UNIFORMS = ['uRes', 'uC', 'uR', 'uLit', 'uAz', 'uLz', 'uFocus', 'uGb', 'uDpr', 'uSeed', 'uAxis', 'uMark', 'uCalm', 'uM0', 'uM1', 'uM2', 'uHot', 'uHere', 'uOpen', 'uVis', 'uCut', 'uCutOn', 'uEye', 'uFace', 'uGaze'];
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
  const eye = { on: options.eyes === true, gate: 0, gateS: 0, mood: 'sleep', open: 1, face: [0, 0], gaze: [0, 0], lid: null, nextBlink: 0, token: 0 };
  const ptr = { x: 0.5, y: 0.5 }, ptrS = { x: 0.5, y: 0.5 };
  const hot = [0, 0, 0], markXY = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];

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
      return true;
    } catch { gl = null; return false; }
  }
  function useFallback() {
    gl = null; U = null;
    if (options.noCanvas) { ctx2d = null; markMode(); return; }
    try { ctx2d = canvas.getContext('2d'); } catch { ctx2d = null; }
    // WebGL 맥락을 이미 받은 캔버스는 2D 맥락을 주지 않는다(장치를 잃었거나 셰이더를 못 만든 때). 같은 자리에 새 캔버스를 두고 거기에 그린다(Fable 최종)
    if (!ctx2d && doc?.createElement && canvas.parentNode) {
      const fresh = doc.createElement('canvas');
      for (const name of canvas.getAttributeNames?.() || []) if (name !== 'width' && name !== 'height') fresh.setAttribute(name, canvas.getAttribute(name));
      canvas.replaceWith(fresh);
      canvas = fresh;
      try { ctx2d = canvas.getContext('2d'); } catch { ctx2d = null; }
      // 새 캔버스는 그림 크기가 기본값(300×150)이다. 곧바로 창에 맞추고 한 장 그린다(Fable 다시 검수)
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
    // 크기를 바꾸면 캔버스가 지워진다. 다음 장을 기다리지 않고 그 자리에서 한 장 그린다(Fable 최종)
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
  function eyesChanged() { const m = eye.gate > 0 ? eye.mood : 'off'; if (m === eyesSaid) return; eyesSaid = m; try { options.onEyes?.(m); } catch { /* 무시 */ } }
  function stepEye(t) {
    const l = eye.lid;
    if (l) { const k = clamp((t - l.t0) / l.ms, 0, 1); eye.open = lerp(l.from, l.to, l.ease(k)); if (k >= 1) { eye.lid = null; l.res(); } }
    eye.gateS += (eye.gate - eye.gateS) * 0.09;
    if (!reduced() && !still && !eye.lid && eye.mood === 'calm' && eye.gateS > 0.9 && S.eye > 0.9 && t > eye.nextBlink) { eye.nextBlink = t + 2600 + Math.random() * 4200; void blink(); }
  }
  async function blink() { const k = ++eye.token; await lidTo(0, 90); if (k !== eye.token) return; await lidTo(1, 170, easeOut); }
  function eyeStop() { ++eye.token; if (eye.lid) { const l = eye.lid; eye.lid = null; l.res(); } }
  async function setMood(m, ms = 0) {
    if (MOOD_NO[m] === undefined) return;
    const k = ++eye.token;
    if (m !== eye.mood) { await lidTo(0, 110); if (k !== eye.token) return; eye.mood = m; eyesChanged(); await lidTo(1, m === 'calm' ? 260 : 190, easeOut); if (k !== eye.token) return; }
    if (ms) { await new Promise(r => win.setTimeout(r, reduced() ? Math.min(ms, 120) : ms)); if (k !== eye.token) return; void setMood('calm'); }
  }
  function eyesAsleep() { eyeStop(); eye.mood = 'sleep'; eye.open = 1; eye.gate = 1; eyesChanged(); wake(); }
  async function eyesWake() {
    const k = ++eye.token; eye.gate = 1;
    await lidTo(0, 160); if (k !== eye.token) return;
    eye.mood = 'calm'; eyesChanged();
    await lidTo(1, 460, easeOut); if (k !== eye.token) return;
    eye.nextBlink = now() + 1100;
  }
  function eyesCalm() { eyeStop(); eye.mood = 'calm'; eye.open = 1; eye.gate = 1; eyesChanged(); wake(); }
  function eyesOff() { eyeStop(); eye.gate = 0; eye.gateS = 0; eye.mood = 'sleep'; eye.open = 1; eyesChanged(); wake(); }
  /* 웅장한 판에서 깎인 만큼에 따라 구가 조금씩 커진다. 자세를 옮기는 중이 아니면 그 자리에서 크기를 맞춘다(시안 forgeAt) */
  function forgeAt(p) {
    cut = clamp(p, 0, 1); forgeP = cut;
    if (poseName === 'forge' && !tw) { const g = forgeGeom(W, H, forgeP); S.r = g.r; S.top = g.cy - g.r; }
    wake();
  }

  function draw(t) {
    const sec = t / 1000, motion = reduced() || still ? 0 : 1;
    ptrS.x += (ptr.x - ptrS.x) * 0.06; ptrS.y += (ptr.y - ptrS.y) * 0.06;
    stepEye(t);
    cutOn += (cutOnWant - cutOn) * (motion ? 0.09 : 1);
    glintBoost += (glintWant - glintBoost) * 0.05;
    for (let i = 0; i < 3; i++) hot[i] += ((hotWant === i ? 1 : 0) - hot[i]) * 0.14;
    // 공간을 고르는 동안에는 가리킨 이름의 자리가(없으면 지금 있는 자리가) 한가운데에 오도록 구가 돌고 기운다
    if (autoFace && !tw) {
      const to = face || space, want = -PLACE_LON[to], ta = faceAx(to), d = Math.atan2(Math.sin(want - S.spin), Math.cos(want - S.spin));
      const q = motion ? 0.1 : 1;
      S.spin += d * q; for (let i = 0; i < 3; i++) S.ax[i] += (ta[i] - S.ax[i]) * q;
    }
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
    if (gl) {
      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      gl.uniform2f(U.uC, cx * DPR, (H - cy) * DPR);
      gl.uniform1f(U.uR, S.r * DPR); gl.uniform1f(U.uLit, lit); gl.uniform1f(U.uAz, az); gl.uniform1f(U.uLz, S.lz); gl.uniform1f(U.uFocus, S.focus);
      gl.uniform1f(U.uGb, gb); gl.uniform1f(U.uDpr, DPR); gl.uniform1f(U.uSeed, frameNo);
      gl.uniform3f(U.uAxis, ax[0], ax[1], ax[2]);
      gl.uniform1f(U.uMark, mark); gl.uniform1f(U.uCalm, S.calm);
      gl.uniform3f(U.uM0, ...mk[0]); gl.uniform3f(U.uM1, ...mk[1]); gl.uniform3f(U.uM2, ...mk[2]);
      gl.uniform3f(U.uHot, hot[0], hot[1], hot[2]);
      gl.uniform3f(U.uHere, ...ORB_PLACES.map(n => (n === space ? 1 : 0)));
      gl.uniform3f(U.uOpen, ...ORB_PLACES.map(n => (n === dive ? S.open : 0)));
      gl.uniform3f(U.uVis, ...ORB_PLACES.map(n => (visible[n] || (n === dive && S.open > 0) ? 1 : 0)));
      gl.uniform1f(U.uCut, cut); gl.uniform1f(U.uCutOn, cutOn);
      gl.uniform4f(U.uEye, eye.on ? 1 : 0, S.eye * eye.gateS, eye.open, MOOD_NO[eye.mood]);
      gl.uniform3f(U.uFace, eye.face[0], eye.face[1], 1);
      gl.uniform3f(U.uGaze, eye.gaze[0], eye.gaze[1], sec % 600);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    } else if (ctx2d) {
      // WebGL이 없을 때: 검정 원과 빛 오는 쪽의 가는 호. 자리는 화면 원으로 그린다
      const c = ctx2d; c.setTransform(DPR, 0, 0, DPR, 0, 0);
      c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
      c.beginPath(); c.arc(cx, cy, S.r, 0, Math.PI * 2); c.fillStyle = '#030303'; c.fill();
      c.lineWidth = 1.4; c.strokeStyle = 'rgba(243,241,236,' + (0.6 * S.lit).toFixed(3) + ')'; c.beginPath(); c.arc(cx, cy, S.r, -az - 1.1, -az + 1.1); c.stroke();
      if (mark > 0.05 && S.r > 30) {
        markXY.forEach((m, i) => {
          if (m[2] < 0.15) return;
          c.lineWidth = hot[i] > 0.5 ? 1.6 : 1; c.strokeStyle = 'rgba(243,241,236,' + (0.5 * mark * S.lit + 0.4 * hot[i]).toFixed(3) + ')';
          c.beginPath(); c.arc(m[0], m[1], RHO * S.r * Math.max(0.3, m[2]), 0, Math.PI * 2); c.stroke();
          if (ORB_PLACES[i] === space) { c.fillStyle = 'rgba(243,241,236,.9)'; c.beginPath(); c.arc(m[0], m[1], 2.6, 0, Math.PI * 2); c.fill(); }
        });
      }
    } else {
      drawStatic(cx, cy, S.r, S.lit);
    }
    options.onRender?.(S);
  }

  /* 움직임이 없고 손도 가만히 있으면 초당 30장으로 줄인다. 창이 가려지면 멈춘다. 60장 가운데 40장 넘게 느리면(움직일 때 24ms, 멈춰 있을 때 50ms 넘음) 촘촘함을 한 단 낮춘다 */
  function idle() { return !tw && !eye.lid && Math.abs(eye.gate - eye.gateS) < 0.01 && Math.abs(cutOnWant - cutOn) < 0.01 && Math.abs(ptr.x - ptrS.x) < 0.001 && Math.abs(ptr.y - ptrS.y) < 0.001 && Math.abs(glintWant - glintBoost) < 0.01 && !autoFace && hot.every((h, i) => Math.abs(h - (hotWant === i ? 1 : 0)) < 0.01); }
  function frame(t) {
    frameId = null;
    if (disposed || paused) return;
    const gap = t - lastDraw;
    const resting = idle();
    if (resting && gap < 32) { frameId = win.requestAnimationFrame(frame); return; }
    // 멈춰 있어 일부러 늦춘 장면(초당 30장, 약 33ms 간격)은 50ms를 넘을 때만 느린 장면으로 센다. 24ms로 세면 장치와 상관없이 배율이 내려갔다(카본 B3).
    // 200ms를 넘는 장면도 센다. 그래픽 가속이 없는 장치가 한 번도 세어지지 않았다. 창이 가려졌다 돌아온 첫 장은 resume()이 lastDraw를 0으로 돌려 세지 않는다(0.4.95 원천 후보 Fable F5)
    if (lastDraw && gap > 0) {
      sampled++; if (gap > (resting ? 50 : 24)) slowFrames++;
      if (sampled >= 60) { if (slowFrames > 40 && dprCap > 1) { dprCap = dprCap > 1.5 ? 1.5 : 1; resize(); } sampled = 0; slowFrames = 0; }
    }
    lastDraw = t;
    stepTween(t); draw(t);
    // 이 장 안에서 resize()가 이미 다음 장을 걸었으면 또 걸지 않는다(고리가 둘로 도는 것을 막는다, Fable 최종)
    if (frameId === null) frameId = win.requestAnimationFrame(frame);
  }
  function wake() { if (!disposed && !paused && frameId === null && typeof win.requestAnimationFrame === 'function') frameId = win.requestAnimationFrame(frame); }

  if (!initGL()) useFallback(); else markMode();
  const glCanvas = canvas;
  const onLost = event => { event.preventDefault(); useFallback(); wake(); };
  // 맥락 복구 알림은 원래 캔버스에 온다. 2D 새 캔버스로 바꿔 두었으면 원래 캔버스로 되돌린 뒤 WebGL을 다시 세운다(0.4.95 원천 후보 카본 B2)
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
    setSpin(v) { S.spin = v; },
    /* 점 로고가 물러나는 순간 작은 구를 한 번 크게 띄운 뒤 제자리로 줄인다(시안 enter의 S.r = 5) */
    setRadius(r) { if (r > 0) S.r = r; wake(); },
    setStill(on) { still = !!on; wake(); },
    setPointer(x, y) { ptr.x = clamp(x, 0, 1); ptr.y = clamp(y, 0, 1); wake(); },
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
    /* 구에 새긴 고리 가운데 (x, y) 아래에 있는 공간 */
    placeUnder(x, y) {
      const reach = RHO * S.r + 12;
      for (let i = 0; i < 3; i++) if (markXY[i][2] > 0.15 && Math.hypot(x - markXY[i][0], y - markXY[i][1]) < reach) return ORB_PLACES[i];
      return null;
    },
    state: () => ({ ...S, ax: [...S.ax], W, H, pose: poseName, moving: !!tw, webgl: !!gl, marks: markXY.map(m => m.map(v => Math.round(v * 100) / 100)), cut, cutOn, eyes: { on: eye.on, gate: eye.gateS, mood: eye.mood, open: eye.open } }),
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
