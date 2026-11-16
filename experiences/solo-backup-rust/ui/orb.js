// 왼쪽 위의 작은 구 — 이 창의 하나뿐인 물건(결정 11-16 「SYNK 플랫폼 PC 클라이언트 방향」 · 「업무 백업 엔진 창 · 검정 클라이언트 말씨로」).
// 결을 깎은 검정 구(「구 가」)의 셰이더는 플랫폼 클라이언트 시안(docs/디자인/플랫폼_클라이언트_검정구_20261116/검정구.html)에서 그대로 옮겼다.
// 엔진 창에서는 구가 늘 왼쪽 위에 작게 있으므로, 화면 전체가 아니라 구 둘레의 작은 캔버스에만 그린다(가벼움 — 회차 사이 상주 0과 함께 창의 몫도 줄인다).
// 하는 일은 셋이다: 창을 열 때 한 번 켜지고, 백업이 도는 동안 빛줄기가 시곗바늘처럼 돌고, 손을 따라 빛이 조금 돈다.
// Windows 「애니메이션 효과」를 끄면(prefers-reduced-motion) 켜진 채 멈춰 있다.

const BOX = 96;        // 캔버스 한 변(CSS px). 구 반지름 13px에 빛 번짐을 담는다
const R = 13;          // 구 반지름 — 클라이언트의 「들어온 뒤 왼쪽 위의 구」와 같다
const AX = [0.28, 0.52, 0.81];

const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
const FS = `

#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes, uC;
uniform float uR, uLit, uAz, uLz, uFocus, uGb, uDpr, uSeed, uMark, uCalm;
uniform vec3 uAxis, uM0, uM1, uM2, uHot, uHere, uOpen;
const float RHO = 0.092;
float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
/* 구에 새긴 자리 하나: 가는 고리와, 지금 있는 곳을 알리는 가운데 점. x는 더할 빛, y는 고리 안을 비우는 정도다.
   가리킨 자리는 고리가 밝아지고, 들어갈 자리는 고리 안이 열린다 */
vec2 place(vec3 n, vec3 M, float hot, float here, float open, float z, vec2 l2){
  vec3 dv = n - M;
  float dd = length(dv);
  /* 화면에서 고리까지 몇 점 떨어졌는지 잰다(밖이 +). 옆으로 돌아가 납작해진 고리도 선 굵기가 같고 또렷하다 */
  float zz = max(z, 0.06);
  vec2 gr = vec2(dv.x - dv.z * n.x / zz, dv.y - dv.z * n.y / zz) / max(dd, 0.0001);
  float sd = (dd - RHO) / max(length(gr), 0.05) * uR / uDpr;
  float show = smoothstep(0.02, 0.2, M.z);   /* 뒤로 넘어간 자리는 보이지 않는다 */
  float lift = max(hot, open);
  /* 가리킨 고리는 선이 굵어진다. 고리 둘레에 옅은 빛 번짐을 둬, 덧그린 선이 아니라 켜진 표시로 보이게 한다 */
  float lw = mix(0.5, 1.0, hot);
  float ring = (1.0 - smoothstep(lw, lw + 0.75, abs(sd))) * show;
  float bloom = exp(-abs(sd) / 2.6) * mix(0.09, 0.24, lift) * (1.0 - open) * show;
  float facing = 0.5 + 0.5 * dot(dv.xy / max(length(dv.xy), 0.0001), l2);
  /* 가운데 점은 구가 커지거나 돌아가도 화면에서 같은 크기의 동그란 점으로 남는다 */
  float pd = length(n.xy - M.xy) * uR / uDpr;
  float pin = (1.0 - smoothstep(2.2, 3.1, pd)) * here * (1.0 - open) * show;
  float glow = hot * 0.07 * (1.0 - smoothstep(0.0, RHO, dd)) * (1.0 - open) * show;
  return vec2(ring * mix(0.44 + 0.30 * facing, 1.0, lift) + bloom + pin * 0.92 + glow, (1.0 - smoothstep(-1.2, 0.3, sd)) * open * show);
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
    /* 구에서 먼 자리는 셈하지 않는다. 구가 작게 남아 있는 동안 화면 대부분이 여기다 */
    col = vec3(0.0);
  } else {
    /* 결을 깎은 구: 축을 둘러 가는 가는 홈이 빛을 한 줄로 모은다 */
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
    /* 홈 사이가 화면 점 몇 개인지로 보일지 정한다. 너무 촘촘해 물결무늬가 낄 결은 그리지 않는다 */
    float sp = 3.14159265 / N1 * uR;
    /* 축이 지나는 점 둘레는 결을 거둬 매끈한 꼭지로 둔다(선반으로 깎은 물건의 한가운데처럼). 홈이 한 점에 뭉쳐 물결무늬가 끼지 않는다 */
    float cap = smoothstep(7.0, 24.0, tl * uR / uDpr);
    float v1 = smoothstep(2.4, 6.0, sp * z) * cap;
    float v2 = smoothstep(2.4, 6.0, sp / 5.0 * z) * cap;
    float v3 = smoothstep(2.4, 6.0, sp / 25.0 * z) * cap;
    float s1 = sin(2.0 * N1 * th), s2 = sin(10.0 * N1 * th), s3 = sin(50.0 * N1 * th);
    /* 사인 물결을 날 선 홈 모양으로 세운다. 크게 보일수록 홈의 턱을 더 세워, 구가 창을 채울 만큼 커져도 흐릿하지 않게 한다 */
    float e1 = clamp(7.5 / max(sp * z, 0.001), 0.06, 0.265), e2 = clamp(7.5 / max(sp / 5.0 * z, 0.001), 0.06, 0.265);
    float w1 = s1 / sqrt(s1 * s1 + e1 * e1), w2 = s2 / sqrt(s2 * s2 + e2 * e2), w3 = s3 / sqrt(s3 * s3 + 0.12);
    vec3 nn = normalize(n + B * (0.22 * w1 * v1 + 0.10 * w2 * v2 + 0.05 * w3 * v3));
    /* 축이 지나는 점에서는 빛줄기를 거둬 한 점으로 뾰족하게 모이지 않게 한다 */
    float pole = smoothstep(mix(0.03, 0.12, uMark), mix(0.30, 0.58, uMark), tl);
    float tdh = dot(T, H);
    float an = pow(max(1.0 - tdh * tdh, 0.0), mix(44.0, 110.0, uFocus)) * pole;
    float side = smoothstep(-0.28, 0.32, dot(n, L));
    float groove = 0.60 + 0.40 * (0.70 * w1 * v1 * (1.0 - 0.7 * v2) + 0.42 * w2 * v2 * (1.0 - 0.5 * v3) + 0.30 * w3 * v3);
    float spec = pow(max(dot(nn, H), 0.0), 30.0);
    float amb = 0.5 + 0.5 * dot(nn, normalize(vec3(-0.25, 0.7, 0.66)));
    float rings = ((0.5 + 0.5 * w1) * v1 * 0.036 + (0.5 + 0.5 * w2) * v2 * 0.016 + (0.5 + 0.5 * w3) * v3 * 0.010) * amb;
    vec3 L2 = normalize(vec3(-L.x * 0.7 + 0.35, -L.y * 0.5 - 0.3, 0.6));
    vec3 H2 = normalize(L2 + V);
    float t2 = dot(T, H2);
    float an2 = pow(max(1.0 - t2 * t2, 0.0), 28.0) * pole * smoothstep(-0.2, 0.4, dot(n, L2));
    /* 글이 놓일 아래쪽은 결을 가라앉혀, 단추와 글이 줄무늬 위에서 탁해지지 않게 한다 */
    float calm = mix(1.0, mix(0.16, 1.0, smoothstep(0.47, 0.69, f.y / uRes.y)), uCalm);
    /* 작게 줄었을 때는 속의 빛을 줄이고 둘레를 가늘게 다 둘러, 얼룩이 아니라 구로 읽히게 한다 */
    float tiny = smoothstep(60.0, 14.0, uR / uDpr);
    vec3 inC = vec3(0.005) + warm * uLit * mix(1.0, 0.1, tiny) * (an * side * groove * mix(0.78, 0.46, uFocus) * pulse + (an2 * groove * 0.09 + rings) * calm + spec * 0.20 * side + 0.010 * max(dot(n, L), 0.0));
    /* 작을 때의 둘레선은 번지지 않게 또렷이 긋고, 빛 오는 쪽을 더 밝게 한다 */
    float edge = (1.0 - smoothstep(0.35, 1.0, abs(px))) * tiny * (0.26 + 0.5 * cres);
    float soft = 1.0 - 0.75 * tiny;
    inC += warm * uLit * (cres * (pow(1.0 - z, 5.0) * 0.14 + line * 0.16) * pulse * soft + edge);
    vec3 outC = warm * uLit * (cres * (line * 0.16 + halo * 0.03) * pulse * soft + edge);
    col = mix(outC, inC, inside);
  }
  /* 새긴 자리. 구가 작게 줄면 보이지 않는다 */
  float mv = uMark * smoothstep(30.0, 84.0, uR / uDpr) * inside;
  if (mv > 0.001) {
    vec2 l2 = vec2(cos(uAz), sin(uAz));
    vec2 a0 = place(n, uM0, uHot.x, uHere.x, uOpen.x, z, l2);
    vec2 a1 = place(n, uM1, uHot.y, uHere.y, uOpen.y, z, l2);
    vec2 a2 = place(n, uM2, uHot.z, uHere.z, uOpen.z, z, l2);
    col *= 1.0 - max(a0.y, max(a1.y, a2.y)) * mv;
    col += warm * uLit * mv * (a0.x + a1.x + a2.x);
  }
  /* 어두운 번짐이 계단으로 끊기지 않게 낟알을 얹는다 */
  float g = ign(f + uSeed * 7.31) + ign(f.yx + 17.0 + uSeed * 3.17) - 1.0;
  col += g * 2.8 / 255.0;
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}`;

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function createOrb(canvas, anchor, { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches } = {}) {
  let gl = null, U = null, ctx2d = null, dpr = 1, raf = 0, frameNo = 0, stopped = false;
  let lit = 0, litFrom = 0, litTo = 1, litT0 = 0, litMs = 900, busy = 0, busyWant = 0, spin = 0, last = 0;
  const ptr = { x: 0.5, y: 0.5 }, ptrS = { x: 0.5, y: 0.5 };

  function initGL() {
    try { gl = canvas.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: false, powerPreference: 'low-power' }); } catch { gl = null; }
    if (!gl) return false;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader'); return s; };
    try {
      const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error('link');
      gl.useProgram(pr);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      U = {}; for (const k of ['uRes', 'uC', 'uR', 'uLit', 'uAz', 'uLz', 'uFocus', 'uGb', 'uDpr', 'uSeed', 'uAxis', 'uMark', 'uCalm', 'uM0', 'uM1', 'uM2', 'uHot', 'uHere', 'uOpen']) U[k] = gl.getUniformLocation(pr, k);
      return true;
    } catch { gl = null; return false; }
  }

  /** 캔버스를 구 단추 한가운데에 맞춘다 */
  function place() {
    const b = anchor.getBoundingClientRect(), s = canvas.parentElement.getBoundingClientRect();
    const cx = b.left - s.left + b.width / 2, cy = b.top - s.top + b.height / 2;
    canvas.style.left = `${Math.round(cx - BOX / 2)}px`; canvas.style.top = `${Math.round(cy - BOX / 2)}px`;
    canvas.style.width = `${BOX}px`; canvas.style.height = `${BOX}px`;
    dpr = Math.min(Math.max(window.devicePixelRatio || 1, 2), 3);
    const px = Math.round(BOX * dpr);
    if (canvas.width !== px || canvas.height !== px) { canvas.width = px; canvas.height = px; }
    if (gl) gl.viewport(0, 0, px, px);
  }

  function draw(now) {
    const t = now / 1000, still = reduce ? 0 : 1;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
    lit = litFrom + (litTo - litFrom) * (1 - Math.pow(1 - Math.min(1, (now - litT0) / litMs), 3));
    busy += (busyWant - busy) * (still ? 0.05 : 1);
    spin += busy * dt * 1.4 * still;
    ptrS.x += (ptr.x - ptrS.x) * 0.06; ptrS.y += (ptr.y - ptrS.y) * 0.06;
    const az = 2.356 + spin + ((ptrS.x - 0.5) * -0.7 + 0.05 * Math.sin(t * 0.4)) * still;
    const ax = [AX[0] + (ptrS.x - 0.5) * 0.24 * still, AX[1] - (ptrS.y - 0.5) * 0.2 * still, AX[2]];
    const l = lit * (1 + 0.03 * Math.sin(t * 0.9) * still);
    const c = (BOX / 2) * dpr;
    if (still) frameNo = (frameNo + 1) % 64;
    if (gl) {
      gl.uniform2f(U.uRes, canvas.width, canvas.height); gl.uniform2f(U.uC, c, c);
      gl.uniform1f(U.uR, R * dpr); gl.uniform1f(U.uLit, l); gl.uniform1f(U.uAz, az); gl.uniform1f(U.uLz, 0.5); gl.uniform1f(U.uFocus, 0);
      gl.uniform1f(U.uGb, busy * (1.2 + 0.8 * Math.sin(t * 3.1)) * still); gl.uniform1f(U.uDpr, dpr); gl.uniform1f(U.uSeed, frameNo);
      gl.uniform3f(U.uAxis, ax[0], ax[1], ax[2]); gl.uniform1f(U.uMark, 0); gl.uniform1f(U.uCalm, 0);
      for (const k of ['uM0', 'uM1', 'uM2']) gl.uniform3f(U[k], 0, 0, -1);
      gl.uniform3f(U.uHot, 0, 0, 0); gl.uniform3f(U.uHere, 0, 0, 0); gl.uniform3f(U.uOpen, 0, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    } else if (ctx2d) {
      const g = ctx2d; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, BOX, BOX);
      g.beginPath(); g.arc(BOX / 2, BOX / 2, R, 0, Math.PI * 2); g.fillStyle = '#030303'; g.fill();
      g.lineWidth = 1.2; g.strokeStyle = `rgba(243,241,236,${(0.7 * lit).toFixed(3)})`; g.beginPath(); g.arc(BOX / 2, BOX / 2, R, -az - 1.1, -az + 1.1); g.stroke();
    }
  }

  // 켜는 동안 · 도는 동안 · 손이 움직인 뒤 잠깐만 그린다. 가만히 있으면 30장/초로 숨만 쉰다
  let idleAt = 0;
  function loop(now) {
    if (stopped) return;
    draw(now);
    const settling = now - litT0 < litMs + 200 || busyWant > 0 || busy > 0.01 || now < idleAt;
    raf = settling ? requestAnimationFrame(loop) : (reduce ? 0 : setTimeout(() => { raf = requestAnimationFrame(loop); }, 33));
  }
  function kick() { if (!raf && !stopped) raf = requestAnimationFrame(loop); }

  if (!initGL()) ctx2d = canvas.getContext('2d');
  canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());
  canvas.addEventListener('webglcontextrestored', () => { initGL(); place(); });
  const onMove = (e) => { ptr.x = e.clientX / window.innerWidth; ptr.y = e.clientY / window.innerHeight; idleAt = performance.now() + 1500; };
  if (!reduce) window.addEventListener('pointermove', onMove);
  const ro = new ResizeObserver(() => place()); ro.observe(canvas.parentElement);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(raf); clearTimeout(raf); raf = 0; } else kick(); });
  place();

  return {
    /** 창이 열릴 때 한 번 켜진다 */
    lightUp() { litFrom = reduce ? 1 : 0; litTo = 1; litT0 = performance.now(); litMs = reduce ? 1 : 900; kick(); },
    /** 백업이 도는 동안 빛줄기가 돈다 */
    setBusy(on) { busyWant = on && !reduce ? 1 : 0; kick(); },
    place, draw: () => draw(performance.now()),
    get webgl() { return !!gl; },
    stop() { stopped = true; cancelAnimationFrame(raf); clearTimeout(raf); ro.disconnect(); window.removeEventListener('pointermove', onMove); },
  };
}
