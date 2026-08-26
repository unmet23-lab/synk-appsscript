#!/usr/bin/env node
/* 지면회귀 — 지면 HTML 이 **지난 판과 달라졌는지**를 렌더된 픽셀로 잰다.
 *
 * 왜 따로 있나(= 브랜드렌더린트·발표물린트로 안 되는 이유):
 *   그 둘은 「**지금** 이 페이지가 규칙을 지키나」를 본다 — 대비·킷 밖 색·서체·직책·쪽 넘침.
 *   그런데 정본 토큰의 값 하나를 고치면 **새 값도 킷 안**이라 두 린트가 전부 초록인 채로
 *   지면 수십 벌의 «모양»만 바뀐다. 규칙 검사는 원리상 그 자리를 못 본다
 *   (같은 무늬 = memory `guard-blind-to-its-own-claim`).
 *   이 도구가 재는 것은 규칙이 아니라 **차이**다.
 *
 * ■ 기준 이미지를 저장소에 넣지 않는다 — git 이 이미 쥐고 있다
 *   옛 판은 `git show <ref>:<경로>` 로 꺼내 **그 자리에서 굽는다**. 그래서 이 도구를 들여도
 *   저장소에 이미지가 0바이트 는다(CLAUDE.md 「보존은 git 이력이 한다 · 사본을 새로 만들지 않는다」).
 *   대가: 매번 두 벌을 굽느라 파일당 굽기가 2회다. 지면 한 벌에 1~2초라 31벌이 1~2분이다.
 *
 * ■ 의존성 0 — 이 저장소의 규율 그대로(도구 120벌 중 npm 패키지를 쓰는 것은 없다)
 *   PNG 디코딩도 npm 을 안 부른다. 두 그림을 **크롬 안 canvas 에서** 비교하고 결과만
 *   `--dump-dom` 으로 회수한다 — 발표물린트의 넘침 측정기와 같은 통로다.
 *
 * 사용법:
 *   node tools/지면회귀.js docs/*.html              # HEAD 와 견준다
 *   node tools/지면회귀.js --기준 HEAD~5 docs/a.html
 *   node tools/지면회귀.js --너비 900 docs/a.html   # 기본 1200
 *   node tools/지면회귀.js --허용 0.1 docs/*.html   # 다른 픽셀 0.1% 까지는 통과(기본 0.02)
 *   node tools/지면회귀.js --보고서 docs/*.html     # 달라진 자리를 겹쳐 보는 HTML 을 낸다
 *
 * 종료 코드: 0 통과 · 1 달라진 지면 있음 · 2 **안 잰 것**(크롬 없음·git 없음 — 통과 아님).
 *   ⚠ 통과(0)와 미실행(2)이 같은 모양이면 안 된다 — CI 에서 조용히 안 도는 게 최악이다.
 *
 * 함정 셋(다시 밟지 말 것):
 *   ⚠ 한글 경로는 `file://` 에서 반드시 encodeURI 한다. 안 하면 빈 문서가 뜨고 —
 *     빈 문서끼리는 «완전히 같아서» 통과로 찍힌다(새는 방향은 언제나 통과다).
 *   ⚠ `file://` 로 불러온 PNG 를 canvas 에 그리면 tainted 가 되어 getImageData 가 막힌다.
 *     그래서 두 그림을 **data URI 로 HTML 에 심어** 보낸다.
 *   ⚠ 폰트·GPU 상태에 따라 픽셀이 미세하게 흔들린다. 그래서 판정은 «0이 아님»이 아니라
 *     **허용 비율**이고, 채널 차 8 이하는 잡음으로 버린다. 임계를 0으로 조이면
 *     매번 빨개지고, 매번 빨간 검사는 아무도 안 본다.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const 기본너비 = 1200;
const 기본높이 = 900;
const 기본허용 = 0.02;   // %
const 잡음문턱 = 8;      // 채널 차가 이 이하면 같은 픽셀로 본다

/** 크롬 경로 — 목록을 여기 베끼지 않는다(같은 판정을 두 곳에 적으면 갈라진다). */
function 크롬찾기() {
  try {
    const { findChrome } = require('./브랜드렌더린트.js');
    return findChrome();
  } catch { return null; }
}

function fileURL(p) { return 'file:///' + encodeURI(p.replace(/\\/g, '/')); }

/** 페이지의 «전체» 높이를 먼저 묻는다 — 못 물으면 null(그러면 기본 높이로 굽는다).
 *  왜 필요한가(08-27 실측): --screenshot 은 **뷰포트만** 찍는다. 지면 31벌은 대개 긴 문서라
 *  첫 화면만 재면 아래쪽 변화가 통째로 «0.000% 통과»로 샌다 — 새는 방향은 언제나 통과다. */
function 전체높이(chrome, htmlPath, 너비, 방) {
  // 원본에 스크립트를 심지 않는다(지면을 건드리면 그 지면을 잰 게 아니다).
  // 대신 같은 너비의 iframe 에 실어 안쪽 scrollHeight 를 되묻는다.
  const 자 = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0}iframe{width:${너비}px;height:${기본높이}px;border:0}</style>
<iframe id="f" src="${fileURL(htmlPath)}"></iframe><pre id="SYNK_H_OUT">SYNK_H=0</pre>
<script>
 const f=document.getElementById('f'), o=document.getElementById('SYNK_H_OUT');
 const 재기=()=>{try{const d=f.contentDocument;
   o.textContent='SYNK_H='+Math.max(d.documentElement.scrollHeight,d.body?d.body.scrollHeight:0);
 }catch(e){o.textContent='SYNK_H=0';}};
 f.addEventListener('load',()=>{재기();setTimeout(재기,400);});
</script>`;
  const p = path.join(방, '자.html');
  try {
    fs.writeFileSync(p, 자, 'utf8');
    const out = execFileSync(chrome, [
      '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
      '--allow-file-access-from-files', '--virtual-time-budget=8000',
      `--window-size=${너비},${기본높이}`, '--dump-dom', fileURL(p),
    ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], timeout: 60000 });
    const m = out.match(/SYNK_H=(\d+)/);
    const h = m ? parseInt(m[1], 10) : 0;
    // 터무니없이 긴 지면은 자른다 — 메모리도, 비교 시간도 여기서 터진다.
    return h > 0 ? Math.min(h, 20000) : null;
  } catch { return null; }
}

/** 한 벌을 굽는다. 실패하면 null. */
function 굽기(chrome, htmlPath, outPng, 너비, 높이) {
  try {
    execFileSync(chrome, [
      '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
      '--allow-file-access-from-files', '--virtual-time-budget=8000',
      `--window-size=${너비},${높이}`, `--screenshot=${outPng}`, fileURL(htmlPath),
    ], { stdio: ['ignore', 'ignore', 'ignore'], timeout: 60000 });
  } catch { return null; }
  if (!fs.existsSync(outPng)) return null;
  const b = fs.readFileSync(outPng);
  // PNG 서명 확인 — 빈 파일을 그림으로 읽지 않는다
  if (b.length < 8 || b.slice(1, 4).toString() !== 'PNG') return null;
  return b;
}

/** 두 PNG 를 크롬 안에서 비교한다. → {다른픽셀, 총픽셀, 비율, 최대차, diff}  */
function 견주기(chrome, a, b, 작업방) {
  const 측정기 = `<!doctype html><meta charset="utf-8">
<img id="A" src="data:image/png;base64,${a.toString('base64')}">
<img id="B" src="data:image/png;base64,${b.toString('base64')}">
<pre id="SYNK_DIFF_OUT">{"오류":"측정기가 끝나기 전에 DOM 을 떴다"}</pre>
<script>
(async () => {
  const out = document.getElementById('SYNK_DIFF_OUT');
  const put = (o) => { out.textContent = JSON.stringify(o); };
  try {
    const [A, B] = [document.getElementById('A'), document.getElementById('B')];
    await Promise.all([A, B].map((i) => i.complete ? 0 : new Promise((r, j) => { i.onload = r; i.onerror = () => j(new Error('그림 로드 실패')); })));
    if (!A.naturalWidth || !B.naturalWidth) throw new Error('그림이 비었다');
    if (A.naturalWidth !== B.naturalWidth || A.naturalHeight !== B.naturalHeight) {
      // 높이가 다른 것 자체가 «달라짐»이다 — 억지로 맞추지 않고 그대로 알린다.
      put({ 크기다름: true, 옛: [A.naturalWidth, A.naturalHeight], 새: [B.naturalWidth, B.naturalHeight] });
      return;
    }
    const w = A.naturalWidth, h = A.naturalHeight;
    const 뜨기 = (img) => { const c = new OffscreenCanvas(w, h); const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0); return x.getImageData(0, 0, w, h).data; };
    const pa = 뜨기(A), pb = 뜨기(B);
    const dc = document.createElement('canvas'); dc.width = w; dc.height = h;
    const dx = dc.getContext('2d');
    const di = dx.createImageData(w, h), dd = di.data;
    let 다름 = 0, 최대 = 0;
    for (let i = 0; i < pa.length; i += 4) {
      const d = Math.max(Math.abs(pa[i] - pb[i]), Math.abs(pa[i+1] - pb[i+1]), Math.abs(pa[i+2] - pb[i+2]), Math.abs(pa[i+3] - pb[i+3]));
      if (d > 최대) 최대 = d;
      if (d > ${잡음문턱}) {
        다름++;
        dd[i] = 249; dd[i+1] = 104; dd[i+2] = 89; dd[i+3] = 255;   // Coral — 달라진 자리
      } else {
        const g = (pb[i] * 0.299 + pb[i+1] * 0.587 + pb[i+2] * 0.114);
        const 옅게 = 255 - (255 - g) * 0.12;                        // 같은 자리는 배경으로 눕힌다
        dd[i] = dd[i+1] = dd[i+2] = 옅게; dd[i+3] = 255;
      }
    }
    dx.putImageData(di, 0, 0);
    put({ 다른픽셀: 다름, 총픽셀: w * h, 최대차: 최대, diff: dc.toDataURL('image/png') });
  } catch (e) { put({ 오류: String(e && e.message || e) }); }
})();
</script>`;
  const tmp = path.join(작업방, 'diff.html');
  fs.writeFileSync(tmp, 측정기, 'utf8');
  let out;
  try {
    out = execFileSync(chrome, [
      '--headless=new', '--disable-gpu', '--no-sandbox',
      '--allow-file-access-from-files', '--virtual-time-budget=15000', '--dump-dom', fileURL(tmp),
    ], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], timeout: 120000 });
  } catch (e) { return { 오류: '측정기 실행 실패: ' + (e.message || e) }; }
  const m = out.match(/<pre id="SYNK_DIFF_OUT">([\s\S]*?)<\/pre>/);
  if (!m) return { 오류: '측정기가 결과를 못 냈다' };
  let r;
  try {
    r = JSON.parse(m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
  } catch (e) { return { 오류: '결과를 못 읽었다: ' + e.message }; }
  if (r.오류) return r;
  if (!r.크기다름) r.비율 = r.총픽셀 ? (r.다른픽셀 / r.총픽셀) * 100 : 0;
  return r;
}

/** 옛 판을 git 에서 꺼내 임시 파일로 놓는다. 그 판에 없던 파일이면 null. */
function 옛판꺼내기(ref, 저장소상대경로, 작업방) {
  let buf;
  try {
    buf = execFileSync('git', ['show', `${ref}:${저장소상대경로}`], { maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch { return null; }
  // 옛 판도 «제 이웃» 곁에 놓아야 한다 — 같은 폴더의 CSS·그림 상대경로가 살아야 렌더가 같다.
  const dir = path.dirname(path.resolve(저장소상대경로));
  const p = path.join(dir, `.지면회귀_옛_${process.pid}_${path.basename(저장소상대경로)}`);
  fs.writeFileSync(p, buf);
  작업방.임시.push(p);
  return p;
}

function 보고서쓰기(결과들, 경로) {
  const 칸 = 결과들.filter((r) => r.diff).map((r) => `
    <section>
      <h2>${r.파일}</h2>
      <p class="수">다른 픽셀 <b>${r.다른픽셀.toLocaleString()}</b> / ${r.총픽셀.toLocaleString()}
         · <b>${r.비율.toFixed(3)}%</b> · 최대 채널차 ${r.최대차}</p>
      <img src="${r.diff}" alt="${r.파일} 달라진 자리">
    </section>`).join('\n');
  const html = `<!doctype html><meta charset="utf-8"><title>지면 회귀 — 달라진 자리</title>
<style>
 :root{--paper:#FBF7F0;--ink:#2B2320;--coral:#AE322A;--stone:#C7BFB2;--oat:#EDE7DC}
 body{margin:0;background:var(--paper);color:var(--ink);
      font-family:'Inter Tight','SUIT Variable',system-ui,'Malgun Gothic',sans-serif;line-height:1.7}
 .wrap{max-width:70rem;margin:0 auto;padding:3rem 1.5rem 5rem}
 h1{font-size:2rem;letter-spacing:-.02em;margin:0 0 .3rem}
 .lede{color:#575046;margin:0 0 2.5rem}
 section{border-top:1px solid var(--oat);padding:2rem 0}
 h2{font-size:1.05rem;font-family:ui-monospace,monospace;font-weight:600;margin:0 0 .4rem;word-break:break-all}
 .수{margin:0 0 1rem;font-family:ui-monospace,monospace;font-size:.85rem;color:#575046;font-variant-numeric:tabular-nums}
 .수 b{color:var(--coral)}
 img{max-width:100%;border:1px solid var(--stone);display:block}
</style>
<div class="wrap">
  <h1>달라진 자리 ${결과들.filter((r) => r.diff).length}벌</h1>
  <p class="lede">코랄로 칠한 픽셀이 지난 판과 다른 자리입니다. 나머지는 눕혀 둔 현재 지면입니다.</p>
  ${칸 || '<p>달라진 지면이 없습니다.</p>'}
</div>`;
  fs.writeFileSync(경로, html, 'utf8');
}

function main(argv) {
  const 보고서 = argv.includes('--보고서');
  const 값 = (이름, 기본) => {
    const i = argv.indexOf(이름);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : 기본;
  };
  const ref = 값('--기준', 'HEAD');
  const 너비 = parseInt(값('--너비', String(기본너비)), 10) || 기본너비;
  const 높이지정 = parseInt(값('--높이', '0'), 10) || 0;   // 0 = 전체 지면을 자동으로 잰다
  const 허용 = parseFloat(값('--허용', String(기본허용)));

  const 먹는인자 = new Set(['--기준', '--너비', '--높이', '--허용']);
  const files = argv.filter((a, i) => !a.startsWith('--') && !먹는인자.has(argv[i - 1]));

  if (!files.length) {
    console.error('사용법: node tools/지면회귀.js [--기준 <ref>] [--너비 N] [--허용 %] [--보고서] <html...>');
    return 2;
  }

  const chrome = 크롬찾기();
  if (!chrome) {
    console.error('SKIP: 크롬을 못 찾았다 — **안 쟀다**(통과 아님). CHROME_PATH 로 지정할 수 있다.');
    return 2;
  }
  try {
    execFileSync('git', ['rev-parse', ref], { stdio: ['ignore', 'ignore', 'ignore'] });
  } catch {
    console.error(`SKIP: git 기준 «${ref}» 을 못 찾았다 — **안 쟀다**(통과 아님).`);
    return 2;
  }

  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-지면회귀-'));
  const 작업방 = { 임시: [] };
  const 결과들 = [];
  let 달라짐 = 0, 못잰것 = 0;

  try {
    for (const f of files) {
      const 이름 = f.replace(/\\/g, '/');
      const 옛 = 옛판꺼내기(ref, 이름, 작업방);
      if (!옛) { console.log(`  신규  ${이름} — «${ref}» 에 없던 지면이라 견줄 상대가 없다`); continue; }

      // 전체 지면을 잰다 — 뷰포트만 찍으면 첫 화면 아래 변화가 「0.000% 통과」로 샌다.
      // 두 판의 높이가 다르면 «큰 쪽»에 맞춰 찍는다(그래야 늘어난 자리도 그림에 보인다).
      let 잴높이 = 높이지정;
      let 높이알림 = '';
      if (!잴높이) {
        const hA = 전체높이(chrome, 옛, 너비, 방);
        const hB = 전체높이(chrome, path.resolve(이름), 너비, 방);
        잴높이 = Math.max(hA || 기본높이, hB || 기본높이);
        if (hA && hB && hA !== hB) 높이알림 = ` · 길이 ${hA}→${hB}px`;
      }

      const pngA = 굽기(chrome, 옛, path.join(방, 'a.png'), 너비, 잴높이);
      const pngB = 굽기(chrome, path.resolve(이름), path.join(방, 'b.png'), 너비, 잴높이);
      if (!pngA || !pngB) {
        console.error(`  ⚠못잼  ${이름} — 굽기 실패(${!pngA ? '옛 판' : '현재 판'})`);
        못잰것++; continue;
      }

      const r = 견주기(chrome, pngA, pngB, 방);
      if (r.오류) { console.error(`  ⚠못잼  ${이름} — ${r.오류}`); 못잰것++; continue; }

      if (r.크기다름) {
        console.log(`  🔴다름 ${이름} — 지면 크기가 바뀌었다 ${r.옛.join('×')} → ${r.새.join('×')}`);
        결과들.push({ 파일: 이름, ...r, 다른픽셀: 0, 총픽셀: 0, 비율: 100, 최대차: 255 });
        달라짐++; continue;
      }

      const 통과 = r.비율 <= 허용;
      결과들.push({ 파일: 이름, ...r });
      if (통과) {
        console.log(`  통과   ${이름} — ${r.비율.toFixed(3)}%${높이알림}`);
      } else {
        console.log(`  🔴다름 ${이름} — ${r.비율.toFixed(3)}% (${r.다른픽셀.toLocaleString()}px · 최대차 ${r.최대차})${높이알림}`);
        달라짐++;
      }
    }
  } finally {
    for (const p of 작업방.임시) { try { fs.rmSync(p, { force: true }); } catch { /* 정리 실패는 판정을 안 바꾼다 */ } }
    try { fs.rmSync(방, { recursive: true, force: true }); } catch { /* 같음 */ }
  }

  if (보고서 && 결과들.some((r) => r.diff)) {
    const 낼곳 = path.join(os.tmpdir(), `지면회귀_보고서_${process.pid}.html`);
    보고서쓰기(결과들, 낼곳);
    console.log(`\n보고서: ${낼곳}`);
  }

  console.log(`\n기준 ${ref} · 잰 지면 ${결과들.length}벌 = 통과 ${결과들.length - 달라짐} + 다름 ${달라짐}` +
              (못잰것 ? ` · 못 잰 것 ${못잰것}` : ''));
  if (못잰것) return 2;      // 못 잰 것이 하나라도 있으면 「통과」라고 말하지 않는다
  return 달라짐 ? 1 : 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { 굽기, 견주기, 크롬찾기, 전체높이 };
