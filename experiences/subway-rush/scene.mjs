// 실사 깊이 판(설계 8절): 사진 한 장 + 깊이 지도를 WebGL 셰이더 한 장으로 움직인다. 카메라 흔들림 없음(멀미) — 다가감 · 옆 미끄러짐뿐.
// 표지 글 · 바닥 유도선은 그림 좌표에 구워 사진과 함께 움직인다(떠 있는 UI가 아니라 사진 속 물건, 설계 5절). 모든 좌표는 그림 좌표(0~1, y 아래로).
const VERT = 'attribute vec2 p;varying vec2 v;void main(){v=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}';
const FRAG = `precision highp float;
varying vec2 v;
uniform sampler2D uImg,uDep,uNext,uNextDep,uOpen,uDecal;
uniform vec2 uRes,uC,uNextC,uPan,uLamp;
uniform float uAspect,uFit,uDrop,uPush,uShift,uNextPush,uMix,uBlur,uFade,uFadeTo,uDoorOpen,uHasOpen,uPhase,uStreak,uDecalA,uLampOn;
uniform vec4 uDoor;
vec2 toImg(vec2 uv){float a=uRes.x/uRes.y;vec2 q=uv-.5;q.x*=a;float w=a*uFit,h=w/uAspect;return vec2(q.x/w+.5,(q.y-uDrop)/h+.5);}
vec2 mir(vec2 p){return abs(mod(p+1.,2.)-1.);}
float near(float d){return .05+1.15*d*d;}
vec2 inv(vec2 q,sampler2D dep,vec2 c,float push,float shift){vec2 p=q;for(int i=0;i<5;i++){float d=texture2D(dep,mir(p)).r;float s=1.+push*near(d);vec2 o=vec2(shift*(.012+.11*d),0.);p=c+(q-o-c)/s;}return p;}
float glassMask(vec2 p){float m=0.;m+=step(.0,p.x)*step(p.x,.06)*step(.31,p.y)*step(p.y,.55);m+=step(.105,p.x)*step(p.x,.145)*step(.33,p.y)*step(p.y,.52);m+=step(.86,p.x)*step(p.x,.92)*step(.33,p.y)*step(p.y,.52);m+=step(.945,p.x)*step(p.x,1.)*step(.31,p.y)*step(p.y,.55);return clamp(m,0.,1.);}
vec3 shade(sampler2D img,vec2 p,vec2 c,float blur){if(blur<.002)return texture2D(img,mir(p)).rgb;vec3 sum=vec3(0.);for(int i=0;i<7;i++){float k=float(i)/6.;sum+=texture2D(img,mir(c+(p-c)*(1.-blur*k))).rgb;}return sum/7.;}
vec3 sticker(vec3 col,vec2 p){
  // 바닥 유도선: 바닥 밝기를 곱해 인쇄된 것처럼(바닥 결이 비쳐 보임). 켜진 스티커는 알파 위쪽 값으로 빛을 더한다.
  if(uDecalA<=0.||p.y<.5||p.y>1.||p.x<0.||p.x>1.)return col;vec4 d=texture2D(uDecal,vec2(p.x,(p.y-.5)*2.));if(d.a<=.001)return col;
  float lum=dot(col,vec3(.3,.59,.11));vec3 printed=d.rgb*(.88+.2*lum);return mix(col,printed,d.a*uDecalA);
}
void main(){
  vec2 q=toImg(v)+uPan;
  vec2 p=inv(q,uDep,uC,uPush,uShift);
  vec3 col=shade(uImg,p,uC,uBlur);
  if(uHasOpen>.5&&uDoorOpen>0.){
    vec2 dc=uDoor.xy;float hw=uDoor.z*uDoorOpen;float inside=step(abs(p.x-dc.x),hw)*step(abs(p.y-dc.y),uDoor.w);
    vec3 o=shade(uOpen,p,uC,uBlur);col=mix(col,o,max(inside,smoothstep(.55,1.,uDoorOpen)));
  }
  col=sticker(col,toImg(v));
  if(uLampOn>0.){float dl=distance(mir(p)*vec2(uAspect,1.),uLamp*vec2(uAspect,1.));col+=vec3(.25,1.,.55)*smoothstep(.05,.0,dl)*.9*uLampOn+vec3(.2,.8,.45)*smoothstep(.2,.0,dl)*.14*uLampOn;}
  if(uStreak>0.){
    vec2 mp=mir(p);float m=glassMask(mp);float d=texture2D(uDep,mp).r;
    float z=1./(d+.12);float t=fract(z*.46-uPhase);float lamp=smoothstep(.0,.16,t)*smoothstep(.52,.16,t);
    col*=1.+lamp*.13*uStreak;col+=lamp*vec3(.05,.04,.02)*uStreak;
    float g=fract(mp.y*5.+uPhase*2.4);float band=smoothstep(.0,.05,g)*smoothstep(.16,.05,g);col+=m*band*vec3(.9,.86,.72)*.55*uStreak;
  }
  if(uMix>0.){vec2 pn=inv(q,uNextDep,uNextC,uNextPush,0.);vec3 cn=shade(uNext,pn,uNextC,uBlur*.6);col=mix(col,cn,uMix);}
  col=mix(col,vec3(uFadeTo),uFade);
  gl_FragColor=vec4(col,1.);
}`;

function compile(gl, type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s) || 'shader'); return s; }
export const loadImage = (url) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(Error('그림을 받지 못했어요: ' + url)); i.src = url; });

// ── 표지: 사진의 빈 판에 백라이트 판을 입힌다 ──
const SIGN_FONT = 'SubwaySign';
function fitFont(ctx, text, weight, size, width, min = 8) { let s = size; ctx.font = `${weight} ${s}px ${SIGN_FONT}`; while (ctx.measureText(text).width > width && s > min) { s -= 1; ctx.font = `${weight} ${s}px ${SIGN_FONT}`; } return s; }
function arrowPath(ctx, cx, cy, r, angle) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(angle);
  ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r * 0.45, 0); ctx.moveTo(r * 0.02, -r * 0.62); ctx.lineTo(r * 0.72, 0); ctx.lineTo(r * 0.02, r * 0.62);
  ctx.lineWidth = r * 0.34; ctx.lineCap = 'butt'; ctx.lineJoin = 'miter'; ctx.stroke(); ctx.restore();
}
/** 표지 한 장. rect는 픽셀 [x0,y0,x1,y1]. sign: { line, color, text, exit, arrow, inL, inR } — 글은 보이는 자리(inL~inR) 안에 든다. */
export function paintSign(ctx, rect, sign) {
  const [x0, y0, x1, y1] = rect, w = x1 - x0, h = y1 - y0, W = ctx.canvas.width;
  ctx.save();
  ctx.beginPath(); ctx.rect(x0 + 2, y0 + 2, w - 4, h - 4); ctx.clip();
  // 판: 짙은 남색 + 안쪽에서 비치는 불빛(가운데가 조금 밝다)
  ctx.fillStyle = '#08142e'; ctx.fillRect(x0, y0, w, h);
  const glow = ctx.createLinearGradient(0, y0, 0, y1); glow.addColorStop(0, 'rgba(70,104,180,.12)'); glow.addColorStop(0.5, 'rgba(92,132,214,.26)'); glow.addColorStop(1, 'rgba(50,80,150,.10)');
  ctx.fillStyle = glow; ctx.fillRect(x0, y0, w, h);
  const pad = h * 0.16, innerL = Math.max(x0 + pad, (sign.inL || 0) * W), innerR = Math.min(x1 - pad, (sign.inR || 1) * W);
  const draw = (blur) => {
    ctx.filter = blur ? `blur(${blur}px)` : 'none';
    let tx = innerL;
    const m = y0 + h * 0.52;
    if (sign.exit != null) {
      // 출구 번호: 노란 사각 + 검은 숫자
      const s = h * 0.68, sx = tx, sy = y0 + (h - s) / 2;
      ctx.fillStyle = '#ffd400'; ctx.beginPath(); ctx.roundRect(sx, sy, s, s, s * 0.14); ctx.fill();
      if (!blur) { ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `900 ${s * 0.78}px ${SIGN_FONT}`; ctx.fillText(String(sign.exit), sx + s / 2, sy + s * 0.53); ctx.textAlign = 'left'; }
      tx += s + h * 0.16;
    } else if (sign.line) {
      const r = h * 0.3;
      ctx.fillStyle = sign.color; ctx.beginPath(); ctx.arc(tx + r, m, r, 0, Math.PI * 2); ctx.fill();
      if (!blur) { ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `800 ${r * 1.45}px ${SIGN_FONT}`; ctx.fillText(String(sign.line), tx + r, m + r * 0.06); ctx.textAlign = 'left'; }
      tx += r * 2 + h * 0.14;
    }
    if (sign.text) {
      const room = innerR - tx - (sign.arrow != null ? h * 0.62 : 0);
      const size = fitFont(ctx, sign.text, 600, h * 0.46, room);
      ctx.font = `600 ${size}px ${SIGN_FONT}`; ctx.fillStyle = '#f6f8ff'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillText(sign.text, tx, m + size * 0.03);
    }
    if (sign.arrow != null) { ctx.strokeStyle = '#f6f8ff'; arrowPath(ctx, innerR - h * 0.26, m, h * 0.2, sign.arrow); }
    ctx.filter = 'none';
  };
  // 빛 번짐 먼저, 그 위에 또렷한 글자(사진 속 불빛 표지처럼 가장자리가 조금 번진다)
  ctx.globalAlpha = 0.5; draw(h * 0.07); ctx.globalAlpha = 1; draw(0);
  // 위쪽 유리 반사 한 줄
  const sheen = ctx.createLinearGradient(0, y0, 0, y0 + h * 0.4); sheen.addColorStop(0, 'rgba(255,255,255,.07)'); sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen; ctx.fillRect(x0, y0, w, h * 0.4);
  ctx.restore();
}

// ── 바닥 유도선 ──
const DECAL_W = 1024, DECAL_H = 768;
function drawTrapezoid(target, source, cx, topY, botY, topW, botW) {
  // 원근: 위로 갈수록 좁아지게 가로줄을 잘라 그린다(바닥 평면)
  const rows = Math.round(botY - topY);
  for (let i = 0; i < rows; i++) {
    const k = i / rows, w = topW + (botW - topW) * k, x = cx(k) - w / 2, y = topY + i;
    // 먼 쪽은 원본을 더 많이 눌러 담는다
    const sy = Math.pow(k, 0.82) * source.height;
    target.drawImage(source, 0, sy, source.width, source.height / rows + 1, x, y, w, 1.2);
  }
}
function stickerCanvas(option, state, lane) {
  const c = document.createElement('canvas'); c.width = 460; c.height = 260; const x = c.getContext('2d');
  const door = !!option.arrow;
  const fill = state === 'on' ? '#fff7c9' : door ? '#f7c800' : option.line ? option.color || '#0052A4' : '#f7c800';
  const ink = state === 'on' || door || !option.line ? '#15130c' : '#ffffff';
  x.fillStyle = fill; x.beginPath(); x.roundRect(6, 6, c.width - 12, c.height - 12, 24); x.fill();
  x.strokeStyle = ink; x.globalAlpha = 0.85; x.lineWidth = 7; x.beginPath(); x.roundRect(20, 20, c.width - 40, c.height - 40, 14); x.stroke(); x.globalAlpha = 1;
  x.fillStyle = ink; x.strokeStyle = ink; x.textBaseline = 'middle'; x.textAlign = 'center';
  const midX = c.width / 2;
  if (door) {
    const a = { left: Math.PI, right: 0, stay: -Math.PI / 2 }[option.arrow];
    arrowPath(x, midX, 84, 48, a);
    x.font = `800 ${fitFont(x, option.text, 800, 76, c.width - 60)}px ${SIGN_FONT}`; x.fillText(option.text, midX, 184);
  } else {
    // 갈림: 화살표만 크게(답이 되는 글자는 위 걸이 표지에)
    const a = [-Math.PI * 0.72, -Math.PI / 2, -Math.PI * 0.28][lane];
    arrowPath(x, midX, c.height / 2, 82, a);
  }
  return c;
}

export async function createScene(canvas, { base, tween, ease, files }) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!gl) throw Error('WebGL을 쓸 수 없어요');
  const prog = gl.createProgram(); gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(prog); gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uniforms = new Map(); const U = (n) => { if (!uniforms.has(n)) uniforms.set(n, gl.getUniformLocation(prog, n)); return uniforms.get(n); };
  const set = (name, ...v) => { const l = U(name); if (v.length === 1) gl.uniform1f(l, v[0]); else if (v.length === 2) gl.uniform2f(l, v[0], v[1]); else gl.uniform4f(l, ...v); };
  ['uImg', 'uDep', 'uNext', 'uNextDep', 'uOpen', 'uDecal'].forEach((n, i) => gl.uniform1i(U(n), i));
  const makeTex = (source) => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE7); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source); return t; };
  const bind = (unit, t) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); };

  const images = {}, textures = {};
  async function need(name) { if (textures[name]) return textures[name]; const img = images[name] || (images[name] = await loadImage(base + files[name])); textures[name] = makeTex(img); return textures[name]; }
  const blank = (() => { const c = document.createElement('canvas'); c.width = c.height = 2; return makeTex(c); })();
  const decalCanvas = document.createElement('canvas'); decalCanvas.width = DECAL_W; decalCanvas.height = DECAL_H; const decalCtx = decalCanvas.getContext('2d');
  let decalTex = makeTex(decalCanvas);

  const state = { img: null, dep: null, open: null, nextImg: null, nextDep: null, c: [0.5, 0.42], nextC: [0.5, 0.5], push: 0, shift: 0, pan: [0, 0], nextPush: 0, mix: 0, blur: 0, fade: 0, fadeTo: 0, doorOpen: 0, door: [0.926, 0.54, 0.085, 0.3], hasOpen: 0, streak: 0, fit: 1.15, drop: 0.03, phase: 0, decalA: 0, lamp: [0.92, 0.27], lampOn: 0 };

  function composeSigns(imgName, panels, signs) {
    const img = images[imgName], c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    signs.forEach((s, i) => { const [a, b, d, e] = panels[i]; paintSign(x, [a * c.width, b * c.height, d * c.width, e * c.height], { ...s, inL: i === 0 ? 0.095 : 0, inR: i === signs.length - 1 ? 0.905 : 1 }); });
    if (textures[imgName + ':signed']) gl.deleteTexture(textures[imgName + ':signed']);
    textures[imgName + ':signed'] = makeTex(c);
    return textures[imgName + ':signed'];
  }

  function composeDraw(imgName, draw) {
    const img = images[imgName], c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; const x = c.getContext('2d'); x.drawImage(img, 0, 0); draw(x);
    if (textures[imgName + ':drawn']) gl.deleteTexture(textures[imgName + ':drawn']);
    textures[imgName + ':drawn'] = makeTex(c);
    return textures[imgName + ':drawn'];
  }

  return {
    state,
    need,
    async show({ img, dep, open = null, c = [0.5, 0.42], panels = null, signs = null, draw = null, streak = 0, push = 0 }) {
      await need(img); await need(dep); if (open) await need(open);
      state.img = panels ? composeSigns(img, panels, signs) : draw ? composeDraw(img, draw) : textures[img]; state.dep = textures[dep]; state.open = open ? textures[open] : null;
      Object.assign(state, { nextImg: null, nextDep: null, mix: 0, c: [...c], push, shift: 0, pan: [0, 0], blur: 0, doorOpen: 0, hasOpen: 0, fade: 0, streak, decalA: 0, lampOn: 0 });
    },
    /** 다음 판을 미리 받아 둔다(문을 지나갈 때 겹쳐 보이는 판). */
    async prepareNext({ img, dep, c = [0.5, 0.5], panels = null, signs = null }) {
      await need(img); await need(dep);
      state.nextImg = panels ? composeSigns(img, panels, signs) : textures[img]; state.nextDep = textures[dep]; state.nextC = [...c]; state.nextPush = 0;
    },
    trainSpeed(v) { state.streak = v; state.push = (1 - v) * 0.014; },
    async openDoor(open, door, lamp) { await need(open); state.open = textures[open]; state.door = door; state.lamp = lamp; state.hasOpen = 1; state.lampOn = 1; await tween(0.95, (k) => { state.doorOpen = k; }, ease.door); },
    /** 지금 판에서 어느 자리로 다가가 지나간다. 끝나면 다음 판이 떠 있다. */
    async goThrough(target, { pan = 0, push = 1.25, seconds = 1.25, blur = 0.13, fadeWhite = false } = {}) {
      const c0 = [...state.c], from = state.push, p0 = state.pan[0];
      await tween(seconds, (k) => {
        state.c = [c0[0] + (target[0] - c0[0]) * k, c0[1] + (target[1] - c0[1]) * k];
        state.pan = [p0 + pan * Math.min(1, k * 1.5), 0];
        state.push = from + push * k * k; state.blur = blur * k * k;
        if (state.nextImg) state.mix = Math.max(0, (k - 0.72) / 0.28);
        if (fadeWhite) { state.fadeTo = 1; state.fade = Math.max(0, (k - 0.62) / 0.38); }
      }, ease.inOut);
    },
    settleNext() { if (!state.nextImg) return; Object.assign(state, { img: state.nextImg, dep: state.nextDep, c: [...state.nextC], nextImg: null, nextDep: null, mix: 0, push: 0, pan: [0, 0], shift: 0, blur: 0, doorOpen: 0, hasOpen: 0, lampOn: 0, streak: 0, decalA: 0 }); },
    runTo(p, reach = 0.62) { state.push = p * reach; state.blur = p < 1 ? 0.02 : 0; },
    async peek(lane) { const c0 = [...state.c], p0 = state.push; await tween(0.5, (k) => { state.c = [c0[0] + (0.5 + lane * 0.3 - c0[0]) * k, c0[1]]; state.push = p0 + 0.14 * k; }, ease.out); },
    /** 바닥 유도선 세 칸. pressed: 눌린 칸 번호. */
    paintDecals(options, pressed = null) {
      decalCtx.clearRect(0, 0, DECAL_W, DECAL_H);
      const lanes = [0.205, 0.5, 0.795], vanish = 0.5;   // 화면 ⅓ 칸의 가운데(가장자리는 잘려 보이는 폭 기준)
      options.forEach((opt, i) => {
        const dim = pressed != null && pressed !== i;
        if (dim) return;
        const src = stickerCanvas(opt, pressed === i ? 'on' : 'off', i);
        const botX = lanes[i] * DECAL_W, topX = botX + (vanish * DECAL_W - botX) * 0.13;
        const cx = (k) => topX + (botX - topX) * k;
        drawTrapezoid(decalCtx, src, cx, DECAL_H * 0.54, DECAL_H * 0.93, DECAL_W * 0.232, DECAL_W * 0.272);
      });
      gl.activeTexture(gl.TEXTURE7); gl.bindTexture(gl.TEXTURE_2D, decalTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, decalCanvas);
    },
    async showDecals() { await tween(0.42, (k) => { state.decalA = k; }, ease.out); },
    hideDecals() { state.decalA = 0; },
    resize() { const dpr = Math.min(window.devicePixelRatio || 1, 2); const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr); if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); state.fit = Math.max(1, Math.min(1.15, 0.93 * (1024 / 1536) / (w / h))); } },   // 넓은 창에서도 바닥 스티커가 화면 안에 들도록 그림을 덜 키운다
    render(dt) {
      state.phase += dt * state.streak * 0.95;
      if (!state.img) return;
      bind(0, state.img); bind(1, state.dep); bind(2, state.nextImg || state.img); bind(3, state.nextDep || state.dep); bind(4, state.open || blank); bind(5, decalTex);
      set('uRes', canvas.width, canvas.height); set('uAspect', 1024 / 1536); set('uFit', state.fit); set('uDrop', state.drop);
      set('uC', ...state.c); set('uPan', ...state.pan); set('uPush', state.push); set('uShift', state.shift);
      set('uNextC', ...state.nextC); set('uNextPush', state.nextPush); set('uMix', state.mix); set('uBlur', state.blur);
      set('uFade', state.fade); set('uFadeTo', state.fadeTo); set('uDoorOpen', state.doorOpen); set('uHasOpen', state.hasOpen);
      set('uDoor', ...state.door); set('uPhase', state.phase); set('uStreak', state.streak); set('uDecalA', state.decalA);
      set('uLamp', ...state.lamp); set('uLampOn', state.lampOn);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
}
