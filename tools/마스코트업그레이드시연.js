#!/usr/bin/env node
/**
 * 마스코트 업그레이드 판정 지면 — 09-02 축 A·B 를 «눈으로» 판정하는 자리.
 *
 * ■ 왜 지면인가 (가이드 정본 §11)
 *   「확률·방치를 기다려서는 검수가 불가능하다 — **버튼 눌러 바로 보기**가 없으면 판정을 못 하신다」.
 *   4D 세기와 거리 배율은 색·질감과 같은 축이라 **유호님 눈이 판정 축**이다(숫자로 확정 안 한다).
 *   재회는 며칠을 기다려야 한 번 나는 반응이라, 기다려서는 영원히 못 보신다.
 *
 * ■ 🔴 이 지면은 «정본이 아니다»
 *   수식은 앱(talk `src/마스코트몸.js`)이 진다. 여기는 그 값을 **브라우저로 옮겨 그린 것**이고,
 *   유호님이 슬라이더로 고르신 값을 내가 앱에 손으로 옮긴다(브라우저는 앱 코드를 못 부른다).
 *   ⇒ 지면이 보여 주는 것과 앱이 다르면 **앱이 옳다.**
 *
 * ■ 깊이 격자와 문구는 «구울 때» 박아 넣는다
 *   file:// 에서 fetch 가 막히기 때문이다. 그림은 상대 경로 <img> 로 둔다 —
 *   깊이를 이미 뽑아 두었으므로 getImageData 가 필요 없고, drawImage 는 tainted canvas 에서도 된다.
 *
 * 쓰기: node tools/마스코트업그레이드시연.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const 저장소 = path.join(__dirname, '..');
const 깊이격자 = require(path.join(저장소, 'tools', 'lib', '깊이격자.js'));
const { 기본N: N, 앱용뽑기, png읽기, 줄이기 } = 깊이격자;
const 마스코트 = require(path.join(저장소, 'tools', 'lib', '마스코트자산.js'));

/* ── 그림을 지면에 «박아 넣는다» ─────────────────────────────────────────────
 * 🔴 상대 경로 <img> 로 두었더니 안 떴다(09-02 실렌더 실측: `complete:true` 인데
 *   `naturalWidth:0` — 「다 됐다」와 「그려졌다」가 다른 자리다). 지면을 어디로 옮기거나
 *   미리보기로 열면 그 순간 그림이 사라지고, **캔버스는 조용히 빈 채로 돈다**(오류 0).
 * 🔑 원본은 1024² 로 1.9MB 라 통째로 박으면 지면이 2.5MB 가 된다. 지면의 최대 확대가
 *   3배(312px)이므로 **512² 면 남는다** — 그래서 줄여서 박는다. */
const 미리보기폭 = 512;

/** CRC32 — PNG 청크마다 필요하다(표는 한 번만 만든다). */
const crc표 = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crc표[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function 청크(형, 몸) {
  const 머리 = Buffer.alloc(8);
  머리.writeUInt32BE(몸.length, 0);
  머리.write(형, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(형, 'ascii'), 몸])), 0);
  return Buffer.concat([머리, 몸, crc]);
}

/** RGBA 픽셀 버퍼 → PNG(색타입 6 · 필터 0). 지면에 박을 작은 판을 만들려는 것뿐이다. */
function png쓰기(rgba, 폭, 높이) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(폭, 0);
  ihdr.writeUInt32BE(높이, 4);
  ihdr[8] = 8;      // bit depth
  ihdr[9] = 6;      // RGBA
  const 줄들 = Buffer.alloc(높이 * (폭 * 4 + 1));
  for (let y = 0; y < 높이; y++) {
    줄들[y * (폭 * 4 + 1)] = 0;   // 필터 없음 — 지면용이라 크기보다 단순함이 값이다
    rgba.copy(줄들, y * (폭 * 4 + 1) + 1, y * 폭 * 4, (y + 1) * 폭 * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    청크('IHDR', ihdr),
    청크('IDAT', zlib.deflateSync(줄들, { level: 9 })),
    청크('IEND', Buffer.alloc(0)),
  ]);
}

/** 그림 파일 → data: URI (512² 로 줄여서). */
function 박을그림(절대) {
  const img = png읽기(절대);
  const 작게 = 줄이기(img, 미리보기폭);
  return `data:image/png;base64,${png쓰기(작게, 미리보기폭, 미리보기폭).toString('base64')}`;
}

const 나갈곳 = path.join(저장소, 'docs', '캐릭터', '마스코트_업그레이드_09-02.html');

/* ── 재료 ① 깊이 — 앱이 쓰는 것과 «같은 모듈»이 낸다 ─────────────────────── */
const 가이드들 = [
  { 이름: '몽글', 절대: 마스코트.절대경로('본체', { 누끼: true }) },
  { 이름: '까몽', 절대: path.join(저장소, 마스코트.까몽경로('본체', { 누끼: true })) },
];
const 깊이 = {};
const 그림URI = {};
for (const g of 가이드들) {
  const { z, 기준, 눈대몸 } = 앱용뽑기(g.절대);
  깊이[g.이름] = { z, 기준, 눈대몸: Math.round(눈대몸*100)/100, 눈밀기: Math.round((Math.max(...z)-기준)*1000)/1000 };
  그림URI[g.이름] = 박을그림(g.절대);
}

/* ── 재료 ② 재회 문구 — 정본에서 그대로 (앱이 고르는 풀과 같은 자리) ────────── */
const 혼잣말 = JSON.parse(fs.readFileSync(path.join(저장소, 'docs', '캐릭터', '혼잣말_정본.json'), 'utf8'));
const 재회 = {};
for (const r of 혼잣말.문구) {
  if (!r.자리.startsWith('재회') || r.갈래 !== '짧') continue;
  (재회[r.캐릭터] ||= {});
  (재회[r.캐릭터][r.자리] ||= []).push(r.문구);
}

/* ── 지면 ───────────────────────────────────────────────────────────────── */
const 자료 = JSON.stringify({ N, 깊이, 재회 });

const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>마스코트 업그레이드 — 09-02 판정 지면</title>
<style>
  :root{
    --바탕:#14161a; --판:#1d2027; --글:#eef0f4; --흐림:#9aa3b2; --선:#2b3039;
    --코랄:#f36758; --좋음:#7fd1a4;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--바탕);color:var(--글);
       font-family:"Pretendard","Malgun Gothic",system-ui,sans-serif;line-height:1.65}
  .품{max-width:1080px;margin:0 auto;padding:32px 20px 80px}
  h1{font-size:26px;margin:0 0 6px;letter-spacing:-.02em}
  .머리흐림{color:var(--흐림);font-size:14px;margin:0 0 28px}
  h2{font-size:19px;margin:38px 0 4px;letter-spacing:-.01em}
  h2 .번호{color:var(--코랄);margin-right:8px}
  .절설명{color:var(--흐림);font-size:13.5px;margin:0 0 18px;max-width:72ch}
  .판{background:var(--판);border:1px solid var(--선);border-radius:14px;padding:20px}
  .가로{display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start}
  .무대{background:#0f1114;border:1px solid var(--선);border-radius:12px;
        display:flex;align-items:center;justify-content:center;position:relative}
  .꼬리표{position:absolute;left:10px;top:8px;font-size:11px;color:var(--흐림);letter-spacing:.02em}
  .조절{flex:1;min-width:280px}
  .줄{display:flex;align-items:center;gap:12px;margin:0 0 14px}
  .줄 label{width:112px;font-size:13px;color:var(--흐림);flex:none}
  .줄 input[type=range]{flex:1;accent-color:var(--코랄)}
  .값{width:60px;text-align:right;font-variant-numeric:tabular-nums;font-size:13px;color:var(--글)}
  button{background:#262b34;color:var(--글);border:1px solid var(--선);border-radius:9px;
         padding:8px 14px;font-size:13px;cursor:pointer;font-family:inherit}
  button:hover{border-color:var(--코랄)}
  button.켬{background:var(--코랄);border-color:var(--코랄);color:#1a0f0d;font-weight:600}
  .단추줄{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px}
  .집{margin-top:16px;padding:14px 16px;background:#0f1114;border-radius:10px;
      border-left:3px solid var(--코랄);font-size:13px;color:var(--흐림)}
  .집 b{color:var(--글);font-weight:600}
  .말풍선{position:absolute;right:calc(100% + 12px);top:14px;background:#262b34;
          border:1px dashed rgba(240,227,200,.5);border-radius:13px;padding:8px 12px;
          font-size:13px;white-space:nowrap;opacity:0;transition:opacity .18s}
  .말풍선.보임{opacity:1}
  table{border-collapse:collapse;width:100%;font-size:13px;margin-top:10px}
  th,td{border:1px solid var(--선);padding:7px 10px;text-align:left}
  th{background:#0f1114;color:var(--흐림);font-weight:500}
  td.수{text-align:right;font-variant-numeric:tabular-nums}
  .좋{color:var(--좋음)} .빔{color:var(--코랄)}
</style></head><body><div class="품">

<h1>마스코트 업그레이드 — 09-02</h1>
<p class="머리흐림">유호님이 고르신 넷 중 <b>A 기억감</b>·<b>B 4D 깊이</b>가 앱에 섰습니다.
세기는 색·질감과 같아서 <b>유호님 눈이 판정 축</b>이라, 여기서 직접 보시고 정해 주십시오.
고르신 값을 제가 앱에 옮깁니다.</p>

<h2><span class="번호">B</span>옆을 봅니다 — 4D 깊이</h2>
<p class="절설명">그림 한 장에서 픽셀마다 깊이를 재고, 시점이 움직이면 그만큼 반대로 밉니다.
눈이 몸보다 <b>먼저</b> 움직이고, 그 어긋남이 「고개를 돌렸다」로 읽힙니다.
새 그림도 새 굽기도 없습니다 — 사진 한 장 그대로입니다.
<br>왼쪽이 <b>앱 실제 크기(84px)</b>이고 오른쪽은 같은 것을 3배로 키운 것입니다.</p>
<div class="판">
  <div class="단추줄">
    <button id="깊이끔">4D 끄기 (전)</button>
    <button id="깊이켬" class="켬">4D 켜기 (후)</button>
    <button id="가이드전환">까몽으로</button>
  </div>
  <div class="가로">
    <div class="무대" style="width:150px;height:150px">
      <span class="꼬리표">실제 84px</span>
      <canvas id="작은판" width="208" height="208" style="width:104px;height:104px"></canvas>
    </div>
    <div class="무대" style="width:330px;height:330px">
      <span class="꼬리표">3배</span>
      <canvas id="큰판" width="624" height="624" style="width:312px;height:312px"></canvas>
    </div>
    <div class="조절">
      <div class="줄"><label>시차(입체)</label><input id="시차" type="range" min="0" max="0.60" step="0.01" value="0.17"><span class="값" id="시차값">0.17</span></div>
      <div class="줄"><label>가로 진폭</label><input id="가로" type="range" min="0" max="0.60" step="0.01" value="0.30"><span class="값" id="가로값">0.30</span></div>
      <div class="줄"><label>세로 진폭</label><input id="세로" type="range" min="0" max="0.30" step="0.01" value="0.05"><span class="값" id="세로값">0.05</span></div>
      <div class="줄"><label>쉬는 참(초)</label><input id="쉬는참" type="range" min="0" max="20" step="0.5" value="9.5"><span class="값" id="쉬는참값">9.5</span></div>
      <div class="줄"><label>돌아보기(초)</label><input id="돌아보기" type="range" min="0.6" max="4" step="0.1" value="1.7"><span class="값" id="돌아보기값">1.7</span></div>
      <div class="집" id="4D집"></div>
    </div>
  </div>
</div>

<h2><span class="번호">A</span>며칠 만인지 압니다 — 재회</h2>
<p class="절설명">그동안 학생이 사흘 만에 앱을 열어도 마스코트는 <b>처음 만난 것처럼</b> 똑같이 웃었습니다.
이제 며칠 만인지에 따라 다르게 반가워합니다. 며칠 만인지 눌러 보십시오.
<br>🔴 재회는 <b>기쁨이지 추궁이 아닙니다</b> — 「왜 안 왔어?」 꼴은 한 줄도 없습니다. 없던 날을 세지 않고 온 날만 맞습니다.</p>
<div class="판">
  <div class="단추줄" id="날단추"></div>
  <div class="가로">
    <div class="무대" style="width:200px;height:200px;overflow:visible">
      <div id="말풍선" class="말풍선"></div>
      <canvas id="재회판" width="240" height="240" style="width:120px;height:120px"></canvas>
    </div>
    <div class="조절">
      <div class="집" id="재회집">며칠 만인지 골라 주십시오.</div>
      <table id="문구표"></table>
    </div>
  </div>
</div>

<h2><span class="번호">A</span>오래 볼수록 가까이 옵니다 — 길들여짐</h2>
<p class="절설명">오래 같이 지낸 아이에게 마스코트가 조금 더 가까이 섭니다.
<b>표정이 아니라 거리</b>로 짓습니다(장면의 변화 축 = 거리·시선·자세).
첫 주는 안 움직이고, 석 달에 걸쳐 84px → 92px 이 됩니다.
<br>🔒 <b>멀어지지 않습니다</b> — 한 달을 안 와도 가까워진 거리는 그대로입니다. 멀어지면 그것이 곧 벌이 됩니다.</p>
<div class="판">
  <div class="가로">
    <div class="무대" style="width:200px;height:200px">
      <span class="꼬리표">첫날</span>
      <canvas id="거리처음" width="168" height="168" style="width:84px;height:84px"></canvas>
    </div>
    <div class="무대" style="width:200px;height:200px">
      <span class="꼬리표" id="거리표">오늘</span>
      <canvas id="거리지금" width="200" height="200" style="width:100px;height:100px"></canvas>
    </div>
    <div class="조절">
      <div class="줄"><label>함께한 날</label><input id="날수" type="range" min="0" max="120" step="1" value="0"><span class="값" id="날수값">0일</span></div>
      <div class="집" id="거리집"></div>
    </div>
  </div>
</div>

<h2><span class="번호">·</span>아직 비어 있는 것</h2>
<p class="절설명">정직하게 적습니다 — 이번에 <b>안</b> 선 것들입니다.</p>
<div class="판"><table>
  <tr><th>자리</th><th>지금</th><th>왜 비었나</th></tr>
  <tr><td>몽글 표정</td><td class="빔">5컷 (까몽은 9컷)</td><td>축 C — 2D 워프로 늘립니다(유호님 픽 09-02). 다음 차례</td></tr>
  <tr><td>마린 그림</td><td class="빔">0컷</td><td>외주 대기 — 지금은 몽글 컷으로 폴백</td></tr>
  <tr><td>궤적 반응</td><td class="빔">0</td><td>「어제 그 문장 또 나왔네」 — 서버 꼬리에 «종류» 칸이 없어 재료가 없습니다</td></tr>
  <tr><td>자발 장치 13</td><td class="빔">일부</td><td>축 E — 날씨·명절·변덕·거절할 줄 안다 등. 다음 차례</td></tr>
</table></div>

<img id="원본몽글" src="${그림URI.몽글}" style="display:none">
<img id="원본까몽" src="${그림URI.까몽}" style="display:none">

<script>
const 자료 = ${자료};
const $ = (id) => document.getElementById(id);

/* 받침이 있으면 「은」 없으면 「는」 — 이름을 문장에 넣을 때 조사가 틀리면 그것부터 읽힌다
   (09-02 실렌더가 「몽글는」을 잡았다). */
function 은는(말){
  const c = 말.charCodeAt(말.length-1);
  if(c < 0xAC00 || c > 0xD7A3) return '는';
  return (c - 0xAC00) % 28 ? '은' : '는';
}

/* ── 깊이 읽기 — 앱 src/마스코트몸.js 의 z읽기 와 같은 겹선형 ─────────────── */
function z읽기(z, zN, u, v){
  const fx=u*zN, fy=v*zN;
  const i0=Math.min(zN-1,Math.max(0,Math.floor(fx))), j0=Math.min(zN-1,Math.max(0,Math.floor(fy)));
  const tx=fx-i0, ty=fy-j0;
  const g=(i,j)=> z[j*(zN+1)+i] ?? 0;
  return g(i0,j0)*(1-tx)*(1-ty)+g(i0+1,j0)*tx*(1-ty)+g(i0,j0+1)*(1-tx)*ty+g(i0+1,j0+1)*tx*ty;
}

/* 삼각형 메시로 그린다 — 칸을 각자 밀면 이웃 사이에 «틈»이 생긴다(릴에서 실측된 사고).
   꼭짓점을 공유하면 틈이 생길 수가 없다. */
const 가로칸=12, 세로칸=14;
function 그리기(ctx, 그림, 옵션){
  const {폭, z, 기준, 시차, 시점x, 시점y, 숨=0, 배율=1} = 옵션;
  ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);
  if(!그림 || !그림.complete || !그림.naturalWidth) return;
  const S = 폭*배율;
  const 여백 = (ctx.canvas.width - S)/2;
  const 점 = [];
  for(let j=0;j<=세로칸;j++){
    for(let i=0;i<=가로칸;i++){
      const u=i/가로칸, yr=j/세로칸, v=1-yr;
      let dx=0, dy=0;
      if(z){
        /* 기준보다 얼마나 앞인가만 민다 — 가장자리는 0 이라 못 박히고 안쪽만 흐른다.
           조건문을 두면 이웃 칸끼리 「한쪽 0, 한쪽 큼」이 되어 격자가 찢긴다(09-02 찌그러짐). */
        const 밀기 = Math.max(0, z읽기(z, 자료.N, u, v) - 기준);
        dx=시점x*밀기*시차*S; dy=시점y*밀기*시차*S;
      }
      /* 숨 — 앱과 같은 결(발치가 먼저, 머리가 늦게) */
      const 위상 = 숨*Math.PI*2 - (1-yr)*0.35*Math.PI*2;
      const 숨값 = Math.sin(위상);
      const 숨세로 = 숨값*0.9*yr, 숨가로 = 숨값*0.5*(1-Math.abs((u-0.5)*2))*(0.4+yr*0.6);
      점.push([여백+u*S+dx+숨가로, 여백+yr*S+dy+숨세로]);
    }
  }
  const tw=그림.naturalWidth, th=그림.naturalHeight;
  for(let j=0;j<세로칸;j++){
    for(let i=0;i<가로칸;i++){
      const a=j*(가로칸+1)+i, b=a+1, c=a+(가로칸+1), d=c+1;
      삼각형(ctx,그림,점[a],점[b],점[c], [i/가로칸*tw,j/세로칸*th],[(i+1)/가로칸*tw,j/세로칸*th],[i/가로칸*tw,(j+1)/세로칸*th]);
      삼각형(ctx,그림,점[b],점[d],점[c], [(i+1)/가로칸*tw,j/세로칸*th],[(i+1)/가로칸*tw,(j+1)/세로칸*th],[i/가로칸*tw,(j+1)/세로칸*th]);
    }
  }
}
function 삼각형(ctx,img,p0,p1,p2,t0,t1,t2){
  ctx.save();
  ctx.beginPath();
  /* 0.4px 부풀려 삼각형 «경계»의 반픽셀 틈을 덮는다(캔버스를 2배로 그려 CSS 로 반 줄이므로
     이 부풀림이 서브픽셀로 묻힌다 — 릴이 쓴 것과 같은 처방) */
  const cx=(p0[0]+p1[0]+p2[0])/3, cy=(p0[1]+p1[1]+p2[1])/3;
  const 부 = (p)=>[p[0]+(p[0]-cx)*0.012+ (p[0]>cx?0.4:-0.4), p[1]+(p[1]-cy)*0.012+(p[1]>cy?0.4:-0.4)];
  const q0=부(p0),q1=부(p1),q2=부(p2);
  ctx.moveTo(q0[0],q0[1]); ctx.lineTo(q1[0],q1[1]); ctx.lineTo(q2[0],q2[1]); ctx.closePath(); ctx.clip();
  const dx1=t1[0]-t0[0], dy1=t1[1]-t0[1], dx2=t2[0]-t0[0], dy2=t2[1]-t0[1];
  const det=dx1*dy2-dx2*dy1;
  if(!det){ ctx.restore(); return; }
  const a=(p1[0]-p0[0])*dy2-(p2[0]-p0[0])*dy1, b=(p2[0]-p0[0])*dx1-(p1[0]-p0[0])*dx2;
  const c=(p1[1]-p0[1])*dy2-(p2[1]-p0[1])*dy1, d=(p2[1]-p0[1])*dx1-(p1[1]-p0[1])*dx2;
  ctx.transform(a/det,c/det,b/det,d/det, p0[0]-(a*t0[0]+b*t0[1])/det, p0[1]-(c*t0[0]+d*t0[1])/det);
  ctx.drawImage(img,0,0);
  ctx.restore();
}

/* ── ① 4D ──────────────────────────────────────────────────────────────── */
let 입체켬 = true, 지금가이드 = '몽글';
const 세기 = { 시차:0.17, 가로:0.30, 세로:0.05, 쉬는참:9.5, 돌아보기:1.7 };
const 그림들 = { 몽글: $('원본몽글'), 까몽: $('원본까몽') };
for(const k of ['시차','가로','세로','쉬는참','돌아보기']){
  $(k).addEventListener('input', (e)=>{ 세기[k]=+e.target.value; $(k+'값').textContent=세기[k].toFixed(2); 집갱신(); });
}
$('깊이끔').onclick = ()=>{ 입체켬=false; $('깊이켬').classList.remove('켬'); $('깊이끔').classList.add('켬'); };
$('깊이켬').onclick = ()=>{ 입체켬=true; $('깊이끔').classList.remove('켬'); $('깊이켬').classList.add('켬'); };
$('가이드전환').onclick = ()=>{
  지금가이드 = 지금가이드==='몽글' ? '까몽' : '몽글';
  $('가이드전환').textContent = 지금가이드==='몽글' ? '까몽으로' : '몽글로';
};
function 집갱신(){
  const d = 자료.깊이[지금가이드];
  /* 눈이 몸보다 앞서는 양 — 84px 화면 기준. 눈밀기·눈대몸은 구울 때 재서 실어 둔 값이다. */
  const 눈어긋 = 세기.가로 * d.눈밀기 * (1 - 1/d.눈대몸) * 세기.시차 * 84;
  $('4D집').innerHTML = '지금 값이면 <b>84px 화면에서 눈이 몸보다 최대 '
    + 눈어긋.toFixed(1) + 'px 앞서</b> 움직입니다. '
    + (눈어긋 < 0.8 ? '<span class="빔">이 정도면 눈에 안 보입니다.</span>'
      : 눈어긋 > 3.5 ? '<span class="빔">너무 큽니다 — 얼굴이 미끄러져 보일 수 있습니다.</span>'
      : '<span class="좋">읽히는 범위입니다.</span>')
    + '<br>눈 대 몸 대비 ' + d.눈대몸 + '배 · 실루엣 가장자리는 <b>0 이라 제자리에 못 박힙니다</b>(테두리가 안 흔들립니다).'
    + '<br>앱에 지금 들어간 값 = 시차 0.17 · 가로 0.30 · 세로 0.05 · 쉬는 참 9.5초 · 돌아보기 1.7초';
}
집갱신();

/* ── ② 재회 ────────────────────────────────────────────────────────────── */
const 눈금표 = [
  {일:0,  이름:'오늘 또',     자리:null},
  {일:1,  이름:'어제도 왔다', 자리:null},
  {일:3,  이름:'사흘 만',     자리:'재회잠깐'},
  {일:8,  이름:'여드레 만',   자리:'재회오랜만'},
  {일:30, 이름:'한 달 만',    자리:'재회한참'},
];
let 재회표정 = null, 재회끝 = 0;
눈금표.forEach((n,i)=>{
  const b=document.createElement('button');
  b.textContent=n.이름;
  b.onclick=()=>{
    [...$('날단추').children].forEach(x=>x.classList.remove('켬'));
    b.classList.add('켬');
    보이기(n);
  };
  $('날단추').appendChild(b);
});
function 보이기(n){
  const 말 = $('말풍선');
  if(!n.자리){
    말.classList.remove('보임');
    $('재회집').innerHTML = '<b>조용합니다.</b> 매일 오는 것이 기본이라, 매일 「반가워!」를 하면 그 말이 값을 잃습니다. '
      + '하루 만에 온 것에는 반응하지 않습니다.';
    $('문구표').innerHTML='';
    return;
  }
  const 풀 = (자료.재회[지금가이드]||{})[n.자리]||[];
  const 글 = 풀[Math.floor(Math.random()*풀.length)] || '';
  말.textContent = 글; 말.classList.add('보임');
  재회표정 = n.자리; 재회끝 = performance.now()+2600;
  const 이름 = {재회잠깐:'잠깐 (2~3일)', 재회오랜만:'오랜만 (4~13일)', 재회한참:'한참 (14일+)'}[n.자리];
  $('재회집').innerHTML = '<b>'+이름+'</b> — '+지금가이드+은는(지금가이드)+' 이 자리에서 '+풀.length+'가지로 말합니다. '
    + (지금가이드==='까몽' ? '까몽은 반가운데 아닌 척합니다(허세 3박자).' : '몽글은 감탄사가 먼저 나옵니다.');
  const 표=$('문구표');
  표.innerHTML='<tr><th>'+지금가이드+'가 이 자리에서 하는 말</th></tr>'
    + 풀.map(g=>'<tr><td>'+g.replace(/</g,'&lt;')+'</td></tr>').join('');
}
setTimeout(()=>$('날단추').children[2].click(), 300);

/* ── ③ 거리 ────────────────────────────────────────────────────────────── */
function 거리배율(날수){
  const 시작=7, 최대일=90, 최대배율=1.10;
  const t = Math.max(0, Math.min(1, (날수-시작)/(최대일-시작)));
  return 1 + (최대배율-1)*t;
}
$('날수').addEventListener('input',(e)=>{
  const d=+e.target.value;
  $('날수값').textContent=d+'일';
  const b=거리배율(d);
  $('거리표').textContent = d+'일째';
  $('거리집').innerHTML = '기본 크기 <b>'+Math.round(84*b)+'px</b> (배율 '+b.toFixed(3)+')<br>'
    + (d<=7 ? '첫 주는 안 움직입니다 — 처음 며칠에 눈에 띄게 커지면 길들여짐이 아니라 연출입니다.'
      : d>=90 ? '상한입니다. 십 년을 다녀도 여기까지입니다.'
      : '천천히 가까워지는 중입니다. 학생이 「변했다」를 의식하면 실패이고, 오래 쓴 뒤 옛 화면을 보면 다르게 느껴지는 정도가 과녁입니다.');
});
$('날수').dispatchEvent(new Event('input'));

/* ── 그리는 루프 ────────────────────────────────────────────────────────── */
function 루프(t){
  const 초 = t/1000;
  const d = 자료.깊이[지금가이드];
  const 그림 = 그림들[지금가이드];
  /* 🔴 09-02 둘째 수리 — 유호님 「멀미도 나고 뭔가 자연스럽지못한느낌」.
     쉬지 않고 도는 사인 둘을 **사건**으로 바꿨다: 평소엔 완전 정지, 가끔 한쪽을 슬쩍 돌아본다.
     살아 있는 것은 늘 흔들리지 않는다 — 가만히 있다가 가끔 고개를 돌린다. */
  let 시점x = 0, 시점y = 0;
  if(입체켬){
    const 한바퀴 = 세기.쉬는참 + 세기.돌아보기;
    const 회차 = Math.floor(초/한바퀴);
    const 안에서 = 초 - 회차*한바퀴;
    if(안에서 < 세기.돌아보기){
      const 크기 = Math.sin(안에서/세기.돌아보기*Math.PI);          // 0 → 1 → 0 (갔다가 돌아온다)
      시점x = 크기 * (회차%2===0 ? 1 : -1) * 세기.가로;             // 회차마다 좌우가 바뀐다
      시점y = Math.sin(안에서/세기.돌아보기*Math.PI*2) * 세기.세로;  // 곁들이는 끄덕임
    }
  }
  const 숨 = 초/3.6;
  const 공통 = { z:입체켬?d.z:null, 기준:d.기준, 시차:세기.시차, 시점x, 시점y, 숨 };

  그리기($('작은판').getContext('2d'), 그림, {폭:168, 배율:1, ...공통});
  그리기($('큰판').getContext('2d'), 그림, {폭:560, 배율:1, ...공통});

  /* 재회 무대 — 표정 대신 «반가움의 몸짓»(작은 점프)으로 보여 드린다.
     컷 교체는 지면에 그 그림이 없어 못 한다(앱은 표정컷을 갈아끼운다). */
  const 뛴 = 재회표정 && t < 재회끝 ? Math.max(0, Math.sin((재회끝-t)/2600*Math.PI*3))*10 : 0;
  const rc = $('재회판').getContext('2d');
  rc.save(); rc.translate(0,-뛴);
  그리기(rc, 그림, {폭:200, 배율:1, ...공통});
  rc.restore();
  if(재회표정 && t>재회끝) { $('말풍선').classList.remove('보임'); 재회표정=null; }

  const b = 거리배율(+$('날수').value);
  그리기($('거리처음').getContext('2d'), 그림, {폭:168, 배율:1, ...공통});
  그리기($('거리지금').getContext('2d'), 그림, {폭:168*b/1.19, 배율:1.19, ...공통});

  requestAnimationFrame(루프);
}
/* 그림은 data: URI 라 곧 준비되지만, 그리기() 가 매 프레임 complete 와 naturalWidth 를
   «함께» 본다 — 「다 됐다」와 「그려진다」는 다른 자리다(09-02 실렌더가 그걸로 빈 캔버스를 잡았다). */
requestAnimationFrame(루프);
</script>
</div></body></html>
`;

fs.writeFileSync(나갈곳, html, 'utf8');
console.log(`판정 지면 — ${path.relative(저장소, 나갈곳)} (${(fs.statSync(나갈곳).size / 1024).toFixed(0)}KB)`);
for (const g of 가이드들) {
  const d = 깊이[g.이름];
  console.log(`  ${g.이름}: 기준 ${d.기준} · 눈밀기 ${d.눈밀기} · 눈대몸 ${d.눈대몸}배`
    + ` · 재회 ${Object.values(재회[g.이름] || {}).flat().length}벌`);
}
