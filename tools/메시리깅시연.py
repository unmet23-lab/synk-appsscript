# 메시 리깅 시연 — 정본 «픽셀을 그대로 두고» 살아 움직이게 하는 통로의 실증 (2026-08-26).
#
# ■ 무엇을 재는가 (이 지면 하나가 전체 판정의 급소다)
#   ① 펠트 질감이 «휘어도» 사는가 — 원본 픽셀을 삼각형 메시로 변형만 한다(색 연산 0 · 재생성 0).
#   ② 3D 회전을 2D 메시로 얼마나 그럴듯하게 흉내내는가 — 몸을 «원통»으로 가정해 감는다.
#      08-15 「투영 인형」의 요 ±13° 한계가 이 통로에서 어디까지 늘어나는지가 판정 재료다.
#
# ■ 왜 이 통로인가 (실측으로 세운 근거)
#   · 몽글이 정본은 **3D 소스가 없다** — 생성 이미지를 재염색한 PNG 뿐이다(커밋 15e2290d5).
#     까몽·마린은 절차적 블렌더라 3D 가 열려 있다. 즉 3D 통로는 **주인공이 빠진다.**
#     2D 메시는 «그림만 있으면» 되므로 모든 캐릭터를 한 통로로 덮는다.
#   · 유호 확정 08-14 「재생성 금지 — AI 티가 난다」 · 「원본 픽셀을 두고 좌표만 바꾼다」와 정합.
#     🚫 SVG 변환 금지(질감 사망)도 지킨다 — 벡터로 다시 그리지 않고 비트맵을 휘게만 한다.
#   · 앱이 이미 React Native 라 `@shopify/react-native-skia` 의 `Vertices`+`ImageShader` 가
#     **같은 원리**로 그대로 받는다(삼각형 메시 + 텍스처 좌표). 이 지면의 로직이 곧 앱 명세다.
#
# ■ 모션 값은 지어내지 않았다 — 08-15 `마스코트인형리깅.py` 의 확정 박자를 그대로 옮겼다.
#   요 9°+4° · 기울 2.2° · 호흡 1.3% · 부유 1.2% · 깜빡임 2.75s·7.4s · 10초 무한 루프(이음매 0).
#
# ⚠ 백그라운드 탭에서 rAF 가 안 돈다(memory review-page-css-pitfalls ②).
#   그래서 **첫 프레임을 rAF 없이 즉시 그린다** — 탭을 안 보셔도 화면이 비지 않는다.
#   움직임은 탭을 앞으로 가져오시는 순간부터 돈다(지면 머리에 그 한 줄을 적는다).
#
# 쓰기: python tools/메시리깅시연.py
import base64
import io
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
누끼 = os.path.join(ROOT, 'docs', '캐릭터', '펠트코랄_0815', '누끼')
산출 = os.path.join(ROOT, 'docs', '캐릭터', '생명공방_0826', '메시리깅_실증.html')

컷 = {'본체': '재염색_본체', '눈감음': '재염색_눈감음', '눈웃음': '재염색_눈웃음'}


def 데이터URI(이름):
    """정본 누끼를 WebP data URI 로. 화질 95 — 펠트 결이 판정 대상이라 깎지 않는다."""
    경로 = os.path.join(누끼, 이름 + '.png')
    if not os.path.exists(경로):
        sys.exit(f'🔴 정본 누끼가 없다: {경로} — 경로 주인은 tools/lib/마스코트자산.js 다')
    버퍼 = io.BytesIO()
    Image.open(경로).save(버퍼, 'WEBP', quality=95, method=6)
    return 'data:image/webp;base64,' + base64.b64encode(버퍼.getvalue()).decode('ascii')


지면 = r'''<!doctype html>
<meta charset="utf-8">
<title>메시 리깅 실증 — 픽셀을 그대로 두고 살아 움직이게</title>
<style>
  :root{
    --paper:#FBF7F0; --ink:#2B2320; --coral:#F96859; --coral3:#AE322A;
    --stitch:#F0E3C8; --oat:#EDE7DC; --stone:#C7BFB2; --ash:#8D857A;
    --meadow:#7DB45A; --lapis:#3D6BC9;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--paper);color:var(--ink);
       font-family:"Pretendard","Malgun Gothic",system-ui,sans-serif;
       line-height:1.7;-webkit-font-smoothing:antialiased}
  .wrap{max-width:1180px;margin:0 auto;padding:48px 28px 80px}
  h1{font-size:30px;line-height:1.35;margin:0 0 10px;letter-spacing:-.02em}
  .sub{color:var(--ash);margin:0 0 6px;font-size:15px}
  .note{display:inline-block;margin:14px 0 0;padding:9px 14px;border-radius:10px;
        background:#FEF0E9;border:1px solid var(--stitch);font-size:14px;color:var(--coral3)}
  .stage{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin:34px 0 0}
  .card{background:#fff;border:1px solid var(--stitch);border-radius:16px;padding:18px 18px 14px}
  .card h2{font-size:14px;margin:0 0 4px;letter-spacing:.02em;color:var(--ash);font-weight:600}
  .card .lead{font-size:13px;color:var(--ash);margin:0 0 12px}
  .box{position:relative;width:100%;aspect-ratio:1/1;border-radius:12px;overflow:hidden;
       background:var(--oat)}
  .box img,.box canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
  .tag{position:absolute;left:10px;top:10px;z-index:2;font-size:11px;padding:3px 9px;
       border-radius:999px;background:rgba(43,35,32,.72);color:var(--paper);letter-spacing:.02em}
  .panel{margin:30px 0 0;background:#fff;border:1px solid var(--stitch);border-radius:16px;padding:20px 22px}
  .panel h2{font-size:15px;margin:0 0 14px}
  .rows{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px 26px}
  .row{display:flex;align-items:center;gap:12px;font-size:13px}
  .row label{flex:0 0 96px;color:var(--ash)}
  .row input[type=range]{flex:1;accent-color:var(--coral)}
  .row output{flex:0 0 56px;text-align:right;font-variant-numeric:tabular-nums;color:var(--ink)}
  .toggles{margin:16px 0 0;display:flex;gap:18px;flex-wrap:wrap;font-size:13px;color:var(--ash)}
  .toggles label{display:flex;align-items:center;gap:7px;cursor:pointer}
  .read{margin:30px 0 0;background:#fff;border:1px solid var(--stitch);border-radius:16px;padding:22px 24px}
  .read h2{font-size:15px;margin:0 0 12px}
  .read ol{margin:0;padding-left:20px}
  .read li{margin:0 0 10px;font-size:14px}
  .read b{color:var(--coral3)}
  .k{font-family:ui-monospace,Consolas,monospace;font-size:12px;background:var(--oat);
     padding:1px 6px;border-radius:5px}
  .foot{margin:26px 0 0;font-size:12.5px;color:var(--ash)}
</style>
<div class="wrap">
  <h1>픽셀을 그대로 두고, 살아 움직이게</h1>
  <p class="sub">정본 누끼를 삼각형 메시로 «휘게만» 한다 — 다시 그리지 않고, 색 연산 0.
     모션 박자는 08-15 확정판 그대로(요 9°+4° · 기울 2.2° · 호흡 1.3% · 깜빡임 2.75s·7.4s · 10초 무한 루프).</p>
  <div class="note">⚠ 이 탭을 <b>앞으로 가져오셔야</b> 움직입니다 — 백그라운드 탭에서는 브라우저가 애니메이션을 멈춥니다.</div>

  <div class="stage">
    <div class="card">
      <h2>지금 — 앱에 실제로 들어가 있는 것</h2>
      <p class="lead">정지 그림 한 장. 표정은 컷 교체로만 바뀐다.</p>
      <div class="box"><span class="tag">정지</span><img id="정지" alt="몽글이 정지"></div>
    </div>
    <div class="card">
      <h2>메시 리깅 — 같은 픽셀, 살아 움직임</h2>
      <p class="lead">몸을 원통으로 가정해 감는다. 원본 픽셀은 한 점도 새로 그리지 않았다.</p>
      <div class="box"><span class="tag">실시간</span><canvas id="무대" width="900" height="900"></canvas></div>
    </div>
  </div>

  <div class="panel">
    <h2>손잡이 — 직접 돌려 보시면서 판정해 주세요</h2>
    <div class="rows">
      <div class="row"><label>고개 돌림</label><input id="s요" type="range" min="0" max="70" value="9" step="1"><output id="o요"></output></div>
      <div class="row"><label>몸 둥글기</label><input id="s원" type="range" min="20" max="170" value="110" step="5"><output id="o원"></output></div>
      <div class="row"><label>호흡</label><input id="s숨" type="range" min="0" max="60" value="13" step="1"><output id="o숨"></output></div>
      <div class="row"><label>기울임</label><input id="s기" type="range" min="0" max="12" value="2.2" step="0.2"><output id="o기"></output></div>
      <div class="row"><label>깊이 음영</label><input id="s음" type="range" min="0" max="100" value="35" step="5"><output id="o음"></output></div>
      <div class="row"><label>격자 촘촘</label><input id="s격" type="range" min="4" max="40" value="24" step="2"><output id="o격"></output></div>
    </div>
    <div class="toggles">
      <label><input id="c격자" type="checkbox"> 뼈대(삼각형 격자) 보기</label>
      <label><input id="c정지" type="checkbox"> 멈추고 한 자세로 보기</label>
      <label><input id="c표정" type="checkbox" checked> 깜빡임·눈웃음 켜기</label>
    </div>
  </div>

  <div class="read">
    <h2>무엇을 보시면 되나 — 이 셋이 판정 재료입니다</h2>
    <ol>
      <li><b>펠트 결이 휘어도 사는가.</b> 털·실땀·구슬 눈이 늘어나거나 뭉개지지 않는지 봐 주세요.
          휘는 것은 픽셀 «위치»뿐이고 색은 한 번도 계산되지 않습니다 — 그래서 「AI 티」가 원리상 안 생깁니다.</li>
      <li><b>고개 돌림이 어디까지 그럴듯한가.</b> 08-15 투영 인형은 <span class="k">±13°</span>가 한계였습니다.
          「고개 돌림」을 올리시면서 <b>어느 각도에서 거짓말로 보이기 시작하는지</b>가 곧 이 통로의 상한입니다.
          「몸 둥글기」가 그 상한을 만드는 손잡이입니다 — 낮추면 종잇장, 높이면 공처럼 감깁니다.</li>
      <li><b>이게 「살아있다」로 읽히는가.</b> 숨·흔들림·깜빡임만으로 충분한지, 아니면 팔·걸음처럼
          더 큰 움직임이 있어야 하는지 — 그 답이 다음 걸음(3D 통로를 여는지)을 가릅니다.</li>
    </ol>
  </div>

  <p class="foot">그림 = 정본 <span class="k">펠트코랄_0815</span> 누끼 3컷(본체·눈감음·눈웃음) ·
     이 지면을 짓는 자 = <span class="k">tools/메시리깅시연.py</span> ·
     같은 원리가 앱에서는 <span class="k">react-native-skia</span>의 <span class="k">Vertices</span>로 그대로 돕니다.</p>
</div>

<script>
const 컷 = { 본체: "__본체__", 눈감음: "__눈감음__", 눈웃음: "__눈웃음__" };
document.getElementById('정지').src = 컷.본체;

const 캔 = document.getElementById('무대');
const gl = 캔.getContext('webgl', { premultipliedAlpha: false, antialias: true });

const VS = `
attribute vec2 a_uv;
uniform float u_yaw, u_tilt, u_breath, u_float, u_phi, u_scale;
varying vec2 v_uv; varying float v_depth;
void main(){
  v_uv = a_uv;
  float halfPhi = u_phi * 0.5;
  float R = 0.5 / sin(halfPhi);
  float ang = (a_uv.x - 0.5) * u_phi + u_yaw;
  // sin(u_yaw) 를 빼는 것이 «제자리에서 돌게» 하는 한 항이다.
  // 안 빼면 몸 중심이 원통 표면을 따라 옆으로 «미끄러진다»(45°에서 화면 밖으로 나갔다 · 08-26 실측).
  float x = (sin(ang) - sin(u_yaw)) * R;
  v_depth = cos(ang) / cos(halfPhi);
  float y = 0.5 - a_uv.y;
  y *= u_breath;
  x *= (2.0 - u_breath);
  float cy = -0.52;
  float dx = x, dy = y - cy;
  float c = cos(u_tilt), s = sin(u_tilt);
  x = dx * c - dy * s;
  y = cy + dx * s + dy * c;
  y += u_float;
  gl_Position = vec4(x * u_scale, y * u_scale, 0.0, 1.0);
}`;

const FS = `
precision mediump float;
uniform sampler2D u_tex; uniform float u_shade; uniform int u_wire;
varying vec2 v_uv; varying float v_depth;
void main(){
  if (u_wire == 1) { gl_FragColor = vec4(0.976, 0.408, 0.349, 0.55); return; }
  vec4 c = texture2D(u_tex, v_uv);
  float sh = mix(1.0, clamp(v_depth, 0.25, 1.0), u_shade);
  gl_FragColor = vec4(c.rgb * sh, c.a);
}`;

function 셰이더(종류, src){
  const s = gl.createShader(종류); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
const 프로 = gl.createProgram();
gl.attachShader(프로, 셰이더(gl.VERTEX_SHADER, VS));
gl.attachShader(프로, 셰이더(gl.FRAGMENT_SHADER, FS));
gl.linkProgram(프로); gl.useProgram(프로);

const 위치 = {};
for (const n of ['u_yaw','u_tilt','u_breath','u_float','u_phi','u_scale','u_shade','u_tex','u_wire'])
  위치[n] = gl.getUniformLocation(프로, n);
const a_uv = gl.getAttribLocation(프로, 'a_uv');

const uv버퍼 = gl.createBuffer();
const 면버퍼 = gl.createBuffer();
const 선버퍼 = gl.createBuffer();
let 면수 = 0, 선수 = 0;

/* 격자 짓기 — 정점은 UV 하나뿐이다. 변형은 전부 정점 셰이더가 한다
   (같은 구조를 Skia Vertices 로 옮길 때 vertices/textures 두 배열이 되는 자리). */
function 격자(N){
  const uvs = [];
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) uvs.push(i / N, j / N);
  const 면 = [], 선 = [];
  const idx = (i, j) => j * (N + 1) + i;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++){
    const a = idx(i,j), b = idx(i+1,j), c = idx(i+1,j+1), d = idx(i,j+1);
    면.push(a,b,c, a,c,d);
    선.push(a,b, a,d);
  }
  for (let j = 0; j < N; j++) 선.push(idx(N,j), idx(N,j+1));
  for (let i = 0; i < N; i++) 선.push(idx(i,N), idx(i+1,N));
  gl.bindBuffer(gl.ARRAY_BUFFER, uv버퍼);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvs), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, 면버퍼);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(면), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, 선버퍼);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(선), gl.STATIC_DRAW);
  면수 = 면.length; 선수 = 선.length;
}

const 텍 = {};
let 준비 = 0;
for (const [이름, uri] of Object.entries(컷)){
  const im = new Image();
  im.onload = () => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.generateMipmap(gl.TEXTURE_2D);
    텍[이름] = t;
    if (++준비 === 3) { 그리기(0); 돌리기(); }   /* 첫 프레임은 rAF 없이 즉시 — 배경 탭 대비 */
  };
  im.src = uri;
}

const 손 = {};
for (const id of ['s요','s원','s숨','s기','s음','s격']) 손[id] = document.getElementById(id);
const 값 = {};
for (const id of ['o요','o원','o숨','o기','o음','o격']) 값[id] = document.getElementById(id);
const c격자 = document.getElementById('c격자');
const c정지 = document.getElementById('c정지');
const c표정 = document.getElementById('c표정');

let 마지막N = -1;
function 손잡이(){
  값.o요.textContent = 손.s요.value + '°';
  값.o원.textContent = 손.s원.value + '°';
  값.o숨.textContent = (손.s숨.value / 10).toFixed(1) + '%';
  값.o기.textContent = (+손.s기.value).toFixed(1) + '°';
  값.o음.textContent = 손.s음.value + '%';
  값.o격.textContent = 손.s격.value + '×' + 손.s격.value;
  const N = +손.s격.value;
  if (N !== 마지막N) { 격자(N); 마지막N = N; }
  if (준비 === 3) 그리기(현재t);
}
for (const k in 손) 손[k].addEventListener('input', 손잡이);
for (const c of [c격자, c정지, c표정]) c.addEventListener('change', () => { if (준비 === 3) 그리기(현재t); });

/* 표정 — 08-15 확정 박자(10초 루프 안에서 2.75s·7.4s 깜빡 · 5.4s 눈웃음) */
function 표정(t){
  if (!c표정.checked) return '본체';
  const 창 = (시작, 길이) => t >= 시작 && t < 시작 + 길이;
  if (창(2.75, 0.23) || 창(7.40, 0.23)) return '눈감음';
  if (창(5.40, 1.10)) return '눈웃음';
  return '본체';
}

const 라 = Math.PI / 180;
let 현재t = 0;

function 그리기(t){
  현재t = t;
  const T = 2 * Math.PI * t / 10;
  const 요세기 = +손.s요.value, 숨세기 = +손.s숨.value / 1000, 기세기 = +손.s기.value;
  const 멈춤 = c정지.checked;
  /* 멈춤이면 «슬라이더 값 그대로»가 각도다 — 유호님이 「몇 도에서 무너지나」를 눈금으로 읽으셔야 한다.
     돌 때는 그 값이 «흔들림 진폭»이다(08-15 확정 박자: 주진동 + 0.44배 3배음). */
  const yaw   = 멈춤 ? 요세기 * 라
                     : (요세기 * Math.sin(T) + 요세기 * 0.44 * Math.sin(3 * T + 1.1)) * 라;
  const tilt  = 멈춤 ? 0 : 기세기 * Math.sin(2 * T + 0.6) * 라;
  const breath= 멈춤 ? 1 : 1 + 숨세기 * Math.sin(3 * T);
  const 부유  = 멈춤 ? 0 : 0.012 * Math.sin(2 * T + 0.9);

  gl.viewport(0, 0, 캔.width, 캔.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  gl.uniform1f(위치.u_yaw, yaw);
  gl.uniform1f(위치.u_tilt, tilt);
  gl.uniform1f(위치.u_breath, breath);
  gl.uniform1f(위치.u_float, 부유);
  gl.uniform1f(위치.u_phi, +손.s원.value * 라);
  gl.uniform1f(위치.u_scale, 1.72);
  gl.uniform1f(위치.u_shade, +손.s음.value / 100);

  gl.bindBuffer(gl.ARRAY_BUFFER, uv버퍼);
  gl.enableVertexAttribArray(a_uv);
  gl.vertexAttribPointer(a_uv, 2, gl.FLOAT, false, 0, 0);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, 텍[표정(t)]);
  gl.uniform1i(위치.u_tex, 0);

  gl.uniform1i(위치.u_wire, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, 면버퍼);
  gl.drawElements(gl.TRIANGLES, 면수, gl.UNSIGNED_SHORT, 0);

  if (c격자.checked){
    gl.uniform1i(위치.u_wire, 1);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, 선버퍼);
    gl.drawElements(gl.LINES, 선수, gl.UNSIGNED_SHORT, 0);
  }
}

const 시작 = performance.now();
function 돌리기(){
  그리기(((performance.now() - 시작) / 1000) % 10);
  requestAnimationFrame(돌리기);
}
격자(24); 손잡이();
</script>
'''

for 이름, 파일 in 컷.items():
    지면 = 지면.replace(f'__{이름}__', 데이터URI(파일))

os.makedirs(os.path.dirname(산출), exist_ok=True)
with open(산출, 'w', encoding='utf-8') as f:
    f.write(지면)
print(f'[메시리깅시연] 저장: {산출}  {os.path.getsize(산출) // 1024}KB')
