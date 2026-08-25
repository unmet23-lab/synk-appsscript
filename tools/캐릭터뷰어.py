# 캐릭터 뷰어 굽기 — GLB 하나를 «파일 한 장»으로 만들어 유호님이 그냥 여시게 한다 (2026-08-26).
#
# ■ 왜 자체 로더인가 (08-26 실측)
#   첫 판은 three.js 를 CDN(importmap)에서 가져왔는데 유호님 화면에서 **「불러오는 중」에서 멈췄다.**
#   오류 문구조차 안 떴다 — 모듈 스크립트가 «실행 자체를» 못 했다는 뜻이고, 그건 외부 CDN 이
#   막혔을 때의 모습이다. 원인을 확정하려 애쓰는 대신 **의존을 통째로 없앴다**:
#   GLB 파싱도 렌더도 이 지면이 직접 한다(WebGL2 · 외부 요청 0 · 파일 한 장).
#   🔑 이 저장소 규율과도 같은 결이다 — 남의 인프라가 있어야 열리는 산출물은 «없는 것»과 같다.
#
# ■ 이 로더가 다루는 것 / 안 다루는 것
#   다룬다: 노드 translation·rotation·scale · TRIANGLES · POSITION/NORMAL/TEXCOORD_0 ·
#           baseColorFactor · baseColorTexture(알파) · alphaMode MASK(alphaCutoff) · doubleSided.
#   안 다룬다: 스킨·애니메이션·PBR 금속/거칠기 정확 계산(첫 판 GLB 에 없다).
#           ⚠ 뼈대·모션이 붙는 날 이 로더도 같이 자란다 — 그때 여기에 스킨을 더한다.
#
# 쓰기: python tools/캐릭터뷰어.py <입력.glb> <출력.html> [제목]
import base64
import json
import os
import struct
import sys

if len(sys.argv) < 3:
    sys.exit('사용법: python tools/캐릭터뷰어.py <입력.glb> <출력.html> [제목]')
GLB, OUT = sys.argv[1], sys.argv[2]
제목 = sys.argv[3] if len(sys.argv) > 3 else '실시간 360°'

raw = open(GLB, 'rb').read()
if raw[:4] != b'glTF':
    sys.exit('GLB 가 아니다: ' + GLB)
off, js = 12, None
while off < len(raw):
    ln, ty = struct.unpack_from('<II', raw, off)
    off += 8
    if ty == 0x4E4F534A:
        js = json.loads(raw[off:off + ln].decode('utf-8'))
    off += ln
삼각 = sum(js['accessors'][p['indices']]['count'] // 3
           for m in js['meshes'] for p in m['primitives'] if 'indices' in p)

지면 = r'''<!doctype html>
<meta charset="utf-8">
<title>__제목__</title>
<style>
  :root{ --paper:#FBF7F0; --ink:#2B2320; --coral:#F96859; --coral3:#AE322A;
         --stitch:#F0E3C8; --oat:#EDE7DC; --ash:#8D857A; }
  *{box-sizing:border-box}
  body{margin:0;background:var(--paper);color:var(--ink);
       font-family:"Pretendard","Malgun Gothic",system-ui,sans-serif;line-height:1.7;
       -webkit-font-smoothing:antialiased}
  .wrap{max-width:1080px;margin:0 auto;padding:44px 26px 72px}
  h1{font-size:29px;margin:0 0 8px;letter-spacing:-.02em}
  .sub{color:var(--ash);margin:0 0 4px;font-size:15px}
  .stage{margin:26px 0 0;background:#fff;border:1px solid var(--stitch);border-radius:18px;
         padding:16px;position:relative}
  #무대{width:100%;aspect-ratio:16/10;border-radius:12px;display:block;background:var(--oat);
        touch-action:none;cursor:grab}
  #무대:active{cursor:grabbing}
  .hud{position:absolute;left:28px;top:28px;z-index:3;display:flex;gap:8px;flex-wrap:wrap}
  .chip{font-size:11.5px;padding:4px 10px;border-radius:999px;background:rgba(43,35,32,.74);
        color:var(--paper);font-variant-numeric:tabular-nums}
  .chip.good{background:rgba(125,180,90,.92);color:#1d2b12}
  .bar{margin:16px 0 0;display:flex;gap:18px;flex-wrap:wrap;align-items:center;font-size:13px;color:var(--ash)}
  .bar label{display:flex;align-items:center;gap:7px;cursor:pointer}
  .bar input[type=range]{accent-color:var(--coral);width:120px}
  .read{margin:26px 0 0;background:#fff;border:1px solid var(--stitch);border-radius:16px;padding:22px 24px}
  .read h2{font-size:15px;margin:0 0 12px}
  .read ol{margin:0;padding-left:20px} .read li{margin:0 0 9px;font-size:14px}
  .read b{color:var(--coral3)}
  .k{font-family:ui-monospace,Consolas,monospace;font-size:12px;background:var(--oat);padding:1px 6px;border-radius:5px}
  .foot{margin:22px 0 0;font-size:12.5px;color:var(--ash)}
  #오류{display:none;margin:14px 0 0;padding:12px 16px;border-radius:10px;background:#FDECEA;
        border:1px solid #E8B4AE;color:var(--coral3);font-size:13.5px;white-space:pre-wrap}
</style>
<div class="wrap">
  <h1>__제목__</h1>
  <p class="sub">마우스로 <b>끌어서</b> 한 바퀴 · <b>휠</b>로 확대. 이 파일 한 장으로 돕니다 — 인터넷도 서버도 필요 없습니다.</p>

  <div class="stage">
    <div class="hud">
      <span class="chip" id="c1">여는 중…</span>
      <span class="chip" id="c2"></span>
    </div>
    <canvas id="무대"></canvas>
    <div class="bar">
      <label><input id="자동" type="checkbox" checked> 자동으로 한 바퀴</label>
      <label>속도 <input id="속도" type="range" min="0" max="60" value="20"></label>
      <label>빛 <input id="빛" type="range" min="40" max="180" value="100"></label>
      <label><input id="뼈대" type="checkbox"> 뼈대(삼각형) 보기</label>
    </div>
  </div>
  <div id="오류"></div>

  <div class="read">
    <h2>무엇을 보시면 되나</h2>
    <ol>
      <li><b>뒤통수까지 펠트인가.</b> 한 바퀴 돌리시면서 어느 각도에서도 털이 끊기지 않는지 봐 주세요.</li>
      <li><b>털이 «진짜 양모»로 읽히는가.</b> 휠로 당겨 결을 보세요 — 그림이 아니라 <b>껍질 8겹</b>이
          실제로 쌓인 것이라 실루엣에서도 보풀이 섭니다.</li>
      <li>⚠ <b>아직 첫 판입니다</b> — 실땀 테두리·표정·색 미세조정이 안 들어갔습니다.
          형태와 재질이 «우리 몽글이»로 읽히는지만 봐 주시면 됩니다.</li>
    </ol>
  </div>
  <p class="foot">자 = <span class="k">tools/캐릭터3D.py</span>(형태·셸 → GLB) +
     <span class="k">tools/캐릭터뷰어.py</span>(이 지면) · 삼각형 <b>__삼각__</b>개</p>
</div>

<script>
"use strict";
const 오류칸 = document.getElementById('오류');
function 알림(m){ 오류칸.style.display='block'; 오류칸.textContent = m; }
window.addEventListener('error', e => 알림('오류: ' + (e.message || e)));

/* ── GLB (인라인) ─────────────────────────────────────────────────────── */
const GLB_B64 = "__GLB__";

function b64바이트(s){
  const bin = atob(s), n = bin.length, a = new Uint8Array(n);
  for (let i = 0; i < n; i++) a[i] = bin.charCodeAt(i);
  return a;
}
function GLB풀기(bytes){
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (dv.getUint32(0, true) !== 0x46546C67) throw new Error('GLB 가 아닙니다');
  let off = 12, json = null, bin = null;
  while (off < bytes.byteLength){
    const len = dv.getUint32(off, true), ty = dv.getUint32(off + 4, true);
    off += 8;
    if (ty === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(bytes.subarray(off, off + len)));
    else if (ty === 0x004E4942) bin = bytes.subarray(off, off + len);
    off += len;
  }
  return { json, bin };
}
const 성분 = { 5120:Int8Array, 5121:Uint8Array, 5122:Int16Array, 5123:Uint16Array, 5125:Uint32Array, 5126:Float32Array };
const 갯수 = { SCALAR:1, VEC2:2, VEC3:3, VEC4:4, MAT4:16 };
function 접근자(g, bin, i){
  const a = g.accessors[i], bv = g.bufferViews[a.bufferView];
  const T = 성분[a.componentType], n = 갯수[a.type];
  const 시작 = (bv.byteOffset || 0) + (a.byteOffset || 0);
  return new T(bin.buffer, bin.byteOffset + 시작, a.count * n);
}

/* ── 작은 행렬 도구 (외부 의존 0) ───────────────────────────────────────── */
const M4 = {
  단위: () => new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]),
  곱: (a,b) => { const o = new Float32Array(16);
    for (let r=0;r<4;r++) for (let c=0;c<4;c++){ let s=0;
      for (let k=0;k<4;k++) s += a[k*4+r]*b[c*4+k]; o[c*4+r]=s; } return o; },
  이동: (x,y,z) => new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]),
  배율: (x,y,z) => new Float32Array([x,0,0,0, 0,y,0,0, 0,0,z,0, 0,0,0,1]),
  사원수: (q) => { const [x,y,z,w]=q;
    return new Float32Array([1-2*(y*y+z*z),2*(x*y+z*w),2*(x*z-y*w),0,
                             2*(x*y-z*w),1-2*(x*x+z*z),2*(y*z+x*w),0,
                             2*(x*z+y*w),2*(y*z-x*w),1-2*(x*x+y*y),0, 0,0,0,1]); },
  원근: (fov,asp,n,f) => { const t = 1/Math.tan(fov/2);
    return new Float32Array([t/asp,0,0,0, 0,t,0,0, 0,0,(f+n)/(n-f),-1, 0,0,2*f*n/(n-f),0]); },
  바라봄: (e,c,u) => {
    const z=[e[0]-c[0],e[1]-c[1],e[2]-c[2]]; let L=Math.hypot(...z); z.forEach((v,i)=>z[i]=v/L);
    const x=[u[1]*z[2]-u[2]*z[1], u[2]*z[0]-u[0]*z[2], u[0]*z[1]-u[1]*z[0]];
    L=Math.hypot(...x)||1; x.forEach((v,i)=>x[i]=v/L);
    const y=[z[1]*x[2]-z[2]*x[1], z[2]*x[0]-z[0]*x[2], z[0]*x[1]-z[1]*x[0]];
    return new Float32Array([x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0,
      -(x[0]*e[0]+x[1]*e[1]+x[2]*e[2]), -(y[0]*e[0]+y[1]*e[1]+y[2]*e[2]), -(z[0]*e[0]+z[1]*e[1]+z[2]*e[2]), 1]); },
  법선3: (m) => {  // 역전치의 좌상단 3×3 (균등 배율이면 그대로 써도 되지만 안전하게)
    const a=m[0],b=m[1],c=m[2],d=m[4],e=m[5],f=m[6],g=m[8],h=m[9],i=m[10];
    const A=e*i-f*h, B=f*g-d*i, C=d*h-e*g, det=a*A+b*B+c*C || 1, id=1/det;
    return new Float32Array([A*id,B*id,C*id, (c*h-b*i)*id,(a*i-c*g)*id,(b*g-a*h)*id,
                             (b*f-c*e)*id,(c*d-a*f)*id,(a*e-b*d)*id]); },
};

/* ── WebGL ────────────────────────────────────────────────────────────── */
const 캔 = document.getElementById('무대');
const gl = 캔.getContext('webgl2', { antialias: true, alpha: false });
if (!gl) 알림('이 브라우저가 WebGL2 를 못 씁니다.');

const VS = `#version 300 es
in vec3 a_pos; in vec3 a_nrm; in vec2 a_uv;
uniform mat4 u_mvp, u_model; uniform mat3 u_nrm;
out vec3 v_nrm; out vec2 v_uv;
void main(){ v_nrm = normalize(u_nrm * a_nrm); v_uv = a_uv; gl_Position = u_mvp * vec4(a_pos,1.0); }`;
const FS = `#version 300 es
precision highp float;
in vec3 v_nrm; in vec2 v_uv;
uniform vec4 u_base; uniform sampler2D u_tex; uniform int u_hasTex;
uniform float u_cut; uniform float u_light; uniform int u_wire;
out vec4 frag;
void main(){
  vec4 c = u_base;
  if (u_hasTex == 1) c *= texture(u_tex, v_uv);
  if (u_cut > 0.0 && c.a < u_cut) discard;     // MASK — 순서와 무관하다
  if (u_wire == 1) { frag = vec4(0.976,0.408,0.349,1.0); return; }
  vec3 n = normalize(v_nrm);
  vec3 L1 = normalize(vec3( 0.55, 0.72, 0.42));
  vec3 L2 = normalize(vec3(-0.62, 0.28, 0.38));
  vec3 L3 = normalize(vec3( 0.05, 0.35,-0.94));
  float d = 0.30 + 0.80*max(dot(n,L1),0.0) + 0.26*max(dot(n,L2),0.0) + 0.30*max(dot(n,L3),0.0);
  vec3 lit = c.rgb * d * u_light;
  frag = vec4(pow(clamp(lit,0.0,1.0), vec3(1.0/2.2)), 1.0);   // 선형 → sRGB
}`;
function 셰이더(t,s){ const o=gl.createShader(t); gl.shaderSource(o,s); gl.compileShader(o);
  if(!gl.getShaderParameter(o,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; }
const 프로 = gl.createProgram();
gl.attachShader(프로, 셰이더(gl.VERTEX_SHADER, VS));
gl.attachShader(프로, 셰이더(gl.FRAGMENT_SHADER, FS));
gl.linkProgram(프로);
if(!gl.getProgramParameter(프로, gl.LINK_STATUS)) 알림(gl.getProgramInfoLog(프로));
gl.useProgram(프로);
const U = {}; for (const n of ['u_mvp','u_model','u_nrm','u_base','u_tex','u_hasTex','u_cut','u_light','u_wire'])
  U[n] = gl.getUniformLocation(프로, n);

/* ── GLB → 그릴 것들 ──────────────────────────────────────────────────── */
const { json: G, bin: BIN } = GLB풀기(b64바이트(GLB_B64));
const 텍들 = [];
let 텍대기 = 0, 준비됨 = false;
(G.images || []).forEach((im, i) => {
  const bv = G.bufferViews[im.bufferView];
  const blob = new Blob([BIN.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength)],
                        { type: im.mimeType || 'image/png' });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  텍대기++;
  img.onload = () => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    텍들[i] = t;
    URL.revokeObjectURL(url);
    if (--텍대기 === 0) { 준비됨 = true; 시작(); }
  };
  img.onerror = () => { 텍대기--; if (텍대기 === 0) { 준비됨 = true; 시작(); } };
  img.src = url;
});
if (텍대기 === 0) { 준비됨 = true; }

const 그릴것 = [];
let 최소 = [1e9,1e9,1e9], 최대 = [-1e9,-1e9,-1e9];
function 노드행렬(n){
  let m = M4.단위();
  if (n.matrix) return new Float32Array(n.matrix);
  if (n.translation) m = M4.곱(m, M4.이동(...n.translation));
  if (n.rotation)    m = M4.곱(m, M4.사원수(n.rotation));
  if (n.scale)       m = M4.곱(m, M4.배율(...n.scale));
  return m;
}
function 노드담기(idx, 부모){
  const n = G.nodes[idx];
  const 모델 = M4.곱(부모, 노드행렬(n));
  if (n.mesh !== undefined){
    for (const p of G.meshes[n.mesh].primitives){
      if ((p.mode !== undefined ? p.mode : 4) !== 4) continue;
      const pos = 접근자(G, BIN, p.attributes.POSITION);
      const nrm = p.attributes.NORMAL !== undefined ? 접근자(G, BIN, p.attributes.NORMAL) : null;
      const uv  = p.attributes.TEXCOORD_0 !== undefined ? 접근자(G, BIN, p.attributes.TEXCOORD_0) : null;
      const idxs = p.indices !== undefined ? 접근자(G, BIN, p.indices) : null;
      const acc = G.accessors[p.attributes.POSITION];
      if (acc.min && acc.max) for (let k=0;k<3;k++){
        // 노드 이동까지 반영해 화면 맞춤에 쓴다(회전·배율은 이 GLB 에 없다)
        최소[k] = Math.min(최소[k], acc.min[k] + 모델[12+k]);
        최대[k] = Math.max(최대[k], acc.max[k] + 모델[12+k]);
      }
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const 붙임 = (data, loc, n) => { const b = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 0, 0); };
      붙임(pos, gl.getAttribLocation(프로,'a_pos'), 3);
      if (nrm) 붙임(nrm, gl.getAttribLocation(프로,'a_nrm'), 3);
      if (uv)  붙임(uv,  gl.getAttribLocation(프로,'a_uv'),  2);
      let 개수 = pos.length/3, 형 = gl.UNSIGNED_SHORT;
      if (idxs){ const eb = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, eb);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idxs, gl.STATIC_DRAW);
        개수 = idxs.length; 형 = (idxs.BYTES_PER_ELEMENT === 4) ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT; }
      gl.bindVertexArray(null);
      const mat = p.material !== undefined ? G.materials[p.material] : {};
      const pbr = mat.pbrMetallicRoughness || {};
      그릴것.push({ vao, 개수, 형, 인덱스: !!idxs, 모델,
        기본: pbr.baseColorFactor || [1,1,1,1],
        텍: pbr.baseColorTexture ? (G.textures[pbr.baseColorTexture.index].source || 0) : -1,
        컷: mat.alphaMode === 'MASK' ? (mat.alphaCutoff !== undefined ? mat.alphaCutoff : 0.5) : 0,
        양면: !!mat.doubleSided });
    }
  }
  for (const c of (n.children || [])) 노드담기(c, 모델);
}
const 뿌리 = (G.scenes && G.scenes[G.scene || 0].nodes) || G.nodes.map((_,i)=>i);
for (const r of 뿌리) 노드담기(r, M4.단위());
그릴것.sort((a,b) => (a.컷 ? 1 : 0) - (b.컷 ? 1 : 0));   // 불투명 먼저

/* ── 카메라·조작 ──────────────────────────────────────────────────────── */
const 중심 = [ (최소[0]+최대[0])/2, (최소[1]+최대[1])/2, (최소[2]+최대[2])/2 ];
const 크기 = Math.max(최대[0]-최소[0], 최대[1]-최소[1], 최대[2]-최소[2]) || 2;
let 요 = 0, 피치 = 0.16, 거리 = 크기 * 2.35, 자전 = 0;
let 끌기 = null;
캔.addEventListener('pointerdown', e => { 끌기 = [e.clientX, e.clientY]; 캔.setPointerCapture(e.pointerId); });
캔.addEventListener('pointerup',   e => { 끌기 = null; });
캔.addEventListener('pointermove', e => {
  if (!끌기) return;
  요 -= (e.clientX - 끌기[0]) * 0.008;
  피치 = Math.max(-1.35, Math.min(1.35, 피치 + (e.clientY - 끌기[1]) * 0.006));
  끌기 = [e.clientX, e.clientY]; 그리기();
});
캔.addEventListener('wheel', e => {
  e.preventDefault();
  거리 = Math.max(크기*0.75, Math.min(크기*7, 거리 * (1 + Math.sign(e.deltaY)*0.12)));
  그리기();
}, { passive: false });

const 자동 = document.getElementById('자동'), 속도 = document.getElementById('속도');
const 빛손 = document.getElementById('빛'), 뼈대 = document.getElementById('뼈대');
[빛손, 뼈대].forEach(o => o.addEventListener('input', 그리기));

function 그리기(){
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = Math.round(캔.clientWidth * dpr), h = Math.round(캔.clientHeight * dpr);
  if (캔.width !== w || 캔.height !== h){ 캔.width = w; 캔.height = h; }
  gl.viewport(0, 0, w, h);
  gl.clearColor(0.929, 0.906, 0.863, 1);       // Oat
  gl.enable(gl.DEPTH_TEST);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const 총요 = 요 + 자전;
  const 눈 = [ 중심[0] + 거리*Math.cos(피치)*Math.sin(총요),
               중심[1] + 거리*Math.sin(피치),
               중심[2] + 거리*Math.cos(피치)*Math.cos(총요) ];
  const V = M4.바라봄(눈, 중심, [0,1,0]);
  const P = M4.원근(34*Math.PI/180, w/h, 0.05, 100);
  const VP = M4.곱(P, V);
  gl.uniform1f(U.u_light, (+빛손.value)/100);
  gl.uniform1i(U.u_wire, 뼈대.checked ? 1 : 0);
  for (const d of 그릴것){
    gl.uniformMatrix4fv(U.u_mvp, false, M4.곱(VP, d.모델));
    gl.uniformMatrix4fv(U.u_model, false, d.모델);
    gl.uniformMatrix3fv(U.u_nrm, false, M4.법선3(d.모델));
    gl.uniform4fv(U.u_base, d.기본);
    gl.uniform1f(U.u_cut, d.컷);
    const 텍 = d.텍 >= 0 ? 텍들[d.텍] : null;
    gl.uniform1i(U.u_hasTex, 텍 ? 1 : 0);
    if (텍){ gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, 텍); gl.uniform1i(U.u_tex, 0); }
    if (d.양면 || d.컷) gl.disable(gl.CULL_FACE); else { gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); }
    gl.bindVertexArray(d.vao);
    if (뼈대.checked) gl.drawElements(gl.LINES, d.개수, d.형, 0);
    else if (d.인덱스) gl.drawElements(gl.TRIANGLES, d.개수, d.형, 0);
    else gl.drawArrays(gl.TRIANGLES, 0, d.개수);
  }
  gl.bindVertexArray(null);
}

let 지난 = performance.now(), 프레임 = 0, fps = 0;
function 돌리기(){
  const 이제 = performance.now(), dt = Math.min((이제-지난)/1000, 0.1);
  if (자동.checked) 자전 += dt * (+속도.value) * Math.PI/180;
  if (이제 > 지난) fps = 0.9*fps + 0.1*(1000/(이제-지난));
  지난 = 이제;
  if (++프레임 % 12 === 0){
    const c2 = document.getElementById('c2');
    c2.textContent = fps.toFixed(0) + ' fps';
    c2.className = 'chip' + (fps > 50 ? ' good' : '');
  }
  그리기();
  requestAnimationFrame(돌리기);
}
function 시작(){
  const c1 = document.getElementById('c1');
  c1.textContent = '삼각형 ' + (__삼각__).toLocaleString() + '개';
  c1.className = 'chip good';
  그리기();                 // 첫 프레임은 rAF 없이 즉시 — 배경 탭에서도 화면이 비지 않는다
  돌리기();
}
if (준비됨) 시작();
window.__점검 = (각) => {
  if (각 !== undefined){ 자전 = 0; 요 = 각*Math.PI/180; }
  그리기();
  const px = new Uint8Array(캔.width*캔.height*4);
  gl.readPixels(0,0,캔.width,캔.height,gl.RGBA,gl.UNSIGNED_BYTE,px);
  let 몸=0,r=0,g=0,b=0;
  for (let i=0;i<px.length;i+=4){ const dr=px[i]-237,dg=px[i+1]-231,db=px[i+2]-220;
    if (dr*dr+dg*dg+db*db > 900){ 몸++; r+=px[i]; g+=px[i+1]; b+=px[i+2]; } }
  return { 몸픽셀:몸, 화면비:(몸/(캔.width*캔.height)*100).toFixed(1)+'%',
    평균색: 몸 ? '#'+[r,g,b].map(v=>Math.round(v/몸).toString(16).padStart(2,'0')).join('') : '-',
    그릴것: 그릴것.length, 텍스처: 텍들.filter(Boolean).length };
};
</script>
'''

지면 = (지면.replace('__제목__', 제목)
            .replace('__삼각__', str(삼각))
            .replace('__GLB__', base64.b64encode(raw).decode('ascii')))
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
with open(OUT, 'w', encoding='utf-8') as f:
    f.write(지면)
print(f'[캐릭터뷰어] {OUT}  {os.path.getsize(OUT)//1024}KB · 삼각형 {삼각:,} · 외부 요청 0')
