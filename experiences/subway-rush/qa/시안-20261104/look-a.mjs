// 그림 길 A 「실사 깊이 판」(설계 8절): 실사 정지 한 장 + 깊이 지도. WebGL 셰이더 한 장이 깊이로 픽셀을 밀어 카메라가 다가가는 착시를 낸다.
// 표지 글은 빈 판 위에 캔버스로 먼저 그려 사진과 한 장으로 올린다(그림 속 한글을 생성에 맡기지 않는다 · 사진과 함께 움직인다).
// 카메라 흔들림 없음(멀미) — 다가감과 옆 미끄러짐뿐. 모든 좌표는 그림 좌표(0~1, y 아래로).
const VERT = `attribute vec2 p;varying vec2 v;void main(){v=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}`;
const FRAG = `precision highp float;
varying vec2 v;
uniform sampler2D uImg,uDep,uNext,uNextDep,uOpen;
uniform vec2 uRes,uC,uNextC,uPan;
uniform float uAspect,uFit,uPush,uShift,uNextPush,uMix,uBlur,uFade,uFadeTo,uDoorOpen,uHasOpen,uPhase,uStreak;
uniform vec4 uDoor;
vec2 toImg(vec2 uv){float a=uRes.x/uRes.y;vec2 q=uv-.5;q.x*=a;float w=a*uFit,h=w/uAspect;return vec2(q.x/w+.5,q.y/h+.5);}
vec2 mir(vec2 p){return abs(mod(p+1.,2.)-1.);}
float near(float d){return .05+1.15*d*d;}
vec2 inv(vec2 q,sampler2D dep,vec2 c,float push,float shift){vec2 p=q;for(int i=0;i<5;i++){float d=texture2D(dep,mir(p)).r;float s=1.+push*near(d);vec2 o=vec2(shift*(.012+.11*d),0.);p=c+(q-o-c)/s;}return p;}
// 차 안 창: 터널 등 빛이 흐른다(달리는 동안만). 양쪽 문 유리 칸.
float glassMask(vec2 p){float m=0.;m+=step(.0,p.x)*step(p.x,.06)*step(.31,p.y)*step(p.y,.55);m+=step(.105,p.x)*step(p.x,.145)*step(.33,p.y)*step(p.y,.52);m+=step(.86,p.x)*step(p.x,.92)*step(.33,p.y)*step(p.y,.52);m+=step(.945,p.x)*step(p.x,1.)*step(.31,p.y)*step(p.y,.55);return clamp(m,0.,1.);}
vec3 shade(sampler2D img,vec2 p,vec2 c,float blur){vec3 sum=vec3(0.);float n=0.;for(int i=0;i<7;i++){float k=float(i)/6.;vec2 s=c+(p-c)*(1.-blur*k);sum+=texture2D(img,mir(s)).rgb;n+=1.;}return sum/n;}
void main(){
  vec2 q=toImg(v)+uPan;
  vec2 p=inv(q,uDep,uC,uPush,uShift);
  vec3 col=shade(uImg,p,uC,uBlur);
  if(uHasOpen>.5&&uDoorOpen>0.){
    // 문이 양쪽으로 열린다: 문 칸 가운데서 바깥으로 넓어지는 틈에만 열린 판을 보이고, 밖은 천천히 겹친다
    vec2 dc=uDoor.xy;float hw=uDoor.z*uDoorOpen;float inside=step(abs(p.x-dc.x),hw)*step(abs(p.y-dc.y),uDoor.w);
    vec3 o=shade(uOpen,p,uC,uBlur);col=mix(col,o,max(inside,smoothstep(.55,1.,uDoorOpen)));
  }
  if(uStreak>0.){
    vec2 mp=mir(p);float m=glassMask(mp);float d=texture2D(uDep,mp).r;
    // 터널 등 빛: 깊이를 따라 앞에서 뒤로 흐르는 띠(먼 곳은 촘촘, 가까운 곳은 넓게) — 달릴 때만, 설수록 느려지다 사라진다. 흔들림 없이 움직임을 준다.
    float z=1./(d+.12);float t=fract(z*.46-uPhase);float lamp=smoothstep(.0,.16,t)*smoothstep(.52,.16,t);
    col*=1.+lamp*.13*uStreak;col+=lamp*vec3(.05,.04,.02)*uStreak;
    // 문 유리 칸: 밖으로 스치는 등 빛
    float g=fract(mp.y*5.+uPhase*2.4);float band=smoothstep(.0,.05,g)*smoothstep(.16,.05,g);col+=m*band*vec3(.9,.86,.72)*.55*uStreak;
  }
  if(uMix>0.){vec2 pn=inv(q,uNextDep,uNextC,uNextPush,0.);vec3 cn=shade(uNext,pn,uNextC,uBlur*.6);col=mix(col,cn,uMix);}
  col=mix(col,vec3(uFadeTo),uFade);
  gl_FragColor=vec4(col,1.);
}`;

function compile(gl, type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s)); return s; }
const loadImage = (url) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(Error('그림을 못 받음 ' + url)); i.src = url; });

export const SIGN_PANELS = {
  // 갈림 판의 빈 표지 자리(그림 좌표, fork 판 실측)
  fork: [[0.0244, 0.3665, 0.3066, 0.4150], [0.3695, 0.3665, 0.6340, 0.4150], [0.7040, 0.3665, 0.9825, 0.4150]],
};
// 표지 한 장을 빈 판 위에: 노선 색 원 + 글(우리 판형 — 운영사 표지를 베끼지 않음)
export function drawSign(ctx, [x0, y0, x1, y1], W, H, sign) {
  const x = x0 * W, y = y0 * H, w = (x1 - x0) * W, h = (y1 - y0) * H, m = h * 0.5;
  ctx.save(); ctx.fillStyle = '#0d1b3e'; ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const r = h * 0.3; let tx = x + Math.max(w * 0.07, (sign.inL || 0) * W - x);
  if (sign.line) {
    ctx.fillStyle = sign.color; ctx.beginPath(); ctx.arc(tx + r, y + m, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `800 ${r * 1.35}px SUIT`; ctx.textAlign = 'center'; ctx.fillText(sign.line, tx + r, y + m + 1); ctx.textAlign = 'left'; tx += r * 2 + w * 0.045;
  }
  let size = h * 0.42; ctx.font = `700 ${size}px SUIT`; ctx.fillStyle = '#fff';
  const right = Math.min(x + w, (sign.inR || 1) * W);
  while (ctx.measureText(sign.text).width > right - tx - w * 0.02 && size > 8) { size -= 1; ctx.font = `700 ${size}px SUIT`; }
  ctx.fillText(sign.text, tx, y + m + 1); ctx.restore();
}

export async function createLookA(canvas, { base, tween, ease }) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  if (!gl) throw Error('WebGL을 쓸 수 없다');
  const prog = gl.createProgram(); gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(prog); gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = (n) => gl.getUniformLocation(prog, n);
  const tex = (unit, source) => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source); return t; };
  const bind = (unit, t) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); };

  const [trainI, trainD, openI, forkI, forkD] = await Promise.all(['train.webp', 'train.depth.png', 'train-open.webp', 'fork.webp', 'fork.depth.png'].map((f) => loadImage(base + f)));
  const compose = (img, draw) => { const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; const x = c.getContext('2d'); x.drawImage(img, 0, 0); draw?.(x, c.width, c.height); return c; };
  const textures = { train: tex(0, trainI), trainD: tex(1, trainD), open: tex(2, openI), forkD: tex(3, forkD), fork: null };
  const scenes = {
    train: { img: 'train', dep: 'trainD', c: [0.5, 0.42] },
    fork: { img: 'fork', dep: 'forkD', c: [0.5, 0.515] },
  };
  const state = { scene: 'train', next: null, push: 0, shift: 0, pan: [0, 0], c: [0.5, 0.42], nextC: [0.5, 0.5], nextPush: 0, mix: 0, blur: 0, fade: 0, fadeTo: 0, doorOpen: 0, door: [0.926, 0.54, 0.085, 0.30], hasOpen: 0, streak: 0, fit: 1.15, phase: 0 };
  const set = (name, ...v) => { const l = U(name); if (v.length === 1) gl.uniform1f(l, v[0]); else if (v.length === 2) gl.uniform2f(l, v[0], v[1]); else gl.uniform4f(l, ...v); };
  ['uImg', 'uDep', 'uNext', 'uNextDep', 'uOpen'].forEach((n, i) => gl.uniform1i(U(n), i));

  return {
    name: 'a', state,
    setSigns(signs) {
      if (textures.fork) gl.deleteTexture(textures.fork);
      const c = compose(forkI, (x, W, H) => signs.forEach((s, i) => drawSign(x, SIGN_PANELS.fork[i], W, H, { ...s, inL: i === 0 ? 0.095 : 0, inR: i === 2 ? 0.905 : 1 })));
      textures.fork = tex(4, c);
    },
    // ── 시안 흐름이 부르는 동사(B와 같은 이름) ──
    enterTrain() { this.show('train'); state.streak = 1; state.fade = 0; },
    trainSpeed(v) { state.streak = v; state.push = (1 - v) * 0.014; },              // 서면서 몸이 살짝 앞으로(흔들림 없음)
    async openDoor() { state.hasOpen = 1; await tween(0.95, (k) => { state.doorOpen = k; }, ease.door); },
    async leaveTrain(side) {
      // 문 쪽으로 돌아보며 다가가 문을 지나간다. 움직임 줄이기 때는 흐름이 가림막으로 바뀐다.
      const dir = side === 'right' ? 1 : -1, c0 = [...state.c], from = state.push, fromPan = state.pan[0];
      state.next = 'fork'; state.nextC = [0.5, 0.515]; state.nextPush = 0; state.mix = 0;
      await tween(1.25, (k) => {
        state.c = [c0[0] + (0.5 + dir * 0.43 - c0[0]) * k, c0[1] + (0.55 - c0[1]) * k];
        state.pan = [fromPan + dir * 0.13 * Math.min(1, k * 1.5), 0];
        state.push = from + 1.25 * k * k; state.blur = 0.13 * k * k;
        state.mix = Math.max(0, (k - 0.72) / 0.28);
      }, ease.inOut);
    },
    enterFork(signs) { this.setSigns(signs); this.show('fork'); },
    runTo(p) { state.push = p * 0.62; state.blur = p < 1 ? 0.02 : 0; },
    async slide(lane) {
      const c0 = [...state.c], p0 = state.pan[0], s0 = state.shift, cx = 0.5 + lane * 0.3, px = lane * 0.082, sx = -lane * 0.28;
      await tween(0.35, (k) => { state.c = [c0[0] + (cx - c0[0]) * k, c0[1]]; state.pan = [p0 + (px - p0) * k, 0]; state.shift = s0 + (sx - s0) * k; }, ease.out);
    },
    async dash(lane) {
      const c0 = [...state.c], p0 = state.push, target = [[0.165, 0.5], [0.5, 0.515], [0.86, 0.62]][lane + 1];
      await tween(1.3, (k) => {
        state.c = [c0[0] + (target[0] - c0[0]) * k, c0[1] + (target[1] - c0[1]) * k];
        state.push = p0 + 1.5 * k * k; state.blur = 0.17 * k * k;
        state.fade = Math.max(0, (k - 0.62) / 0.38); state.fadeTo = 1;
      }, ease.inOut);
    },
    async peek(lane) { const c0 = [...state.c], p0 = state.push; await tween(0.5, (k) => { state.c = [c0[0] + (0.5 + lane * 0.3 - c0[0]) * k, c0[1]]; state.push = p0 + 0.14 * k; }, ease.out); },
    atMouth() { state.push = 0.62; state.blur = 0; state.c = [0.5, 0.515]; state.pan = [0, 0]; state.shift = 0; state.fade = 0; },
    show(name) { state.scene = name; state.next = null; state.mix = 0; state.c = [...scenes[name].c]; state.push = 0; state.shift = 0; state.pan = [0, 0]; state.blur = 0; state.doorOpen = 0; state.hasOpen = 0; },
    resize() { const dpr = Math.min(window.devicePixelRatio || 1, 2); const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr); if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; } gl.viewport(0, 0, w, h); },
    render(dt) {
      state.phase += dt * state.streak * 0.95;
      const s = scenes[state.scene], n = state.next ? scenes[state.next] : s;
      const a = textures[s.img], d = textures[s.dep], na = textures[n.img] || a, nd = textures[n.dep];
      bind(0, a); bind(1, d); bind(2, na); bind(3, nd); bind(4, textures.open);
      set('uRes', canvas.width, canvas.height); set('uAspect', 1024 / 1536); set('uFit', state.fit);
      set('uC', ...state.c); set('uPan', ...state.pan); set('uPush', state.push); set('uShift', state.shift);
      set('uNextC', ...state.nextC); set('uNextPush', state.nextPush); set('uMix', state.mix); set('uBlur', state.blur);
      set('uFade', state.fade); set('uFadeTo', state.fadeTo); set('uDoorOpen', state.doorOpen); set('uHasOpen', state.hasOpen);
      set('uDoor', ...state.door); set('uPhase', state.phase); set('uStreak', state.streak);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
}
