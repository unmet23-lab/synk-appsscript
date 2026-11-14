#!/usr/bin/env node
// 「오늘」 한 장 화면 시안 두 안(11-14 — 유호님이 A안을 고르셨고 화면 코드에는 A안만 남겼다. 이 파일은 고를 때 쓴 기록이다) — 값은 실제 기록기로 심은 기록에서 뽑은 것(뽑기.mjs A · B --after)을 그대로 쓴다.
// 자립형 HTML 한 장씩(글꼴 · 태오 사진 · 듣는 고리 영상을 안에 싣는다) — 공개 저장소에는 이 짓는 파일만 두고 결과는 .tmp에 쓴다.
//   node experiences/drama/qa/오늘한장-20261114/시안짓기.mjs [--out .tmp/today-20261114]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { proofLine as proof } from '../../pilot/today/plan.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../..');
const args = process.argv.slice(2);
const OUT = path.resolve(ROOT, args.includes('--out') ? args[args.indexOf('--out') + 1] : '.tmp/today-20261114');
const MEDIA = path.join(ROOT, 'experiences/drama/pilot/media');
fs.mkdirSync(OUT, { recursive: true });

const pick = (s) => JSON.parse(execFileSync(process.execPath, [path.join(HERE, '뽑기.mjs'), s, '--after'], { encoding: 'utf8' }));
const DATA = { A: pick('A'), B: pick('B') };
fs.writeFileSync(path.join(OUT, '값.json'), JSON.stringify(DATA, null, 1));

const b64 = (f) => fs.readFileSync(path.join(MEDIA, f)).toString('base64');
const FONTS = `@font-face{font-family:'SUIT';src:url(data:font/woff2;base64,${b64('SUIT-Variable.woff2')}) format('woff2');font-weight:100 900;font-display:block}
@font-face{font-family:'DM Mono';src:url(data:font/woff2;base64,${b64('DMMono-Medium.woff2')}) format('woff2');font-weight:500;font-display:block}`;
const STILL = `data:image/webp;base64,${b64('taeo-still.webp')}`;
const LOOP = `data:video/mp4;base64,${b64('taeo-listen.mp4')}`;
const BLUR = `data:image/webp;base64,${b64('taeo-still-blur.webp')}`;

const CSS = `
:root{--bg:#09090b;--ink:#f4f5f8;--dim:rgba(244,245,248,.62);--muted:rgba(244,245,248,.54);--glass:rgba(255,255,255,.075);--glass-2:rgba(255,255,255,.12);
 --edge:inset 0 0 0 1px rgba(255,255,255,.13);--warm:#ffcf5c;--spring:cubic-bezier(.22,1,.36,1);--sans:'SUIT',system-ui,-apple-system,'Apple SD Gothic Neo',sans-serif;--mono:'DM Mono',ui-monospace,monospace;color-scheme:dark}
*{box-sizing:border-box}html,body{margin:0;height:100%;background:var(--bg);color:var(--ink);font-family:var(--sans);-webkit-font-smoothing:antialiased}
body{font-size:15px;line-height:1.5;letter-spacing:-.01em;word-break:keep-all;overflow:hidden}
button{font:inherit;color:inherit;border:0;background:none;cursor:pointer;-webkit-tap-highlight-color:transparent}
.mono{font-family:var(--mono);font-weight:500;letter-spacing:.12em;text-transform:uppercase}
em.yo{font-style:normal;color:var(--warm)}
/* 바탕 — 넓은 화면에서만 보이는 흐린 장면 */
.field{position:fixed;inset:-60px;background:url(${BLUR}) center/cover;filter:blur(40px) brightness(.28) saturate(1.1);transform:scale(1.1);z-index:0}
.app{position:relative;z-index:1;height:100dvh;width:100%;overflow:hidden;isolation:isolate;display:flex;flex-direction:column;justify-content:flex-end;padding:0 16px max(16px,env(safe-area-inset-bottom))}
.app>.right{position:relative;z-index:4;display:flex;flex-direction:column;gap:8px;min-height:0}
.stage{position:absolute;inset:0;height:100%;overflow:hidden;background:#000}
.stage video,.stage img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 20%}
.stage .shade{position:absolute;inset:-1px;background:linear-gradient(180deg,rgba(0,0,0,.5),transparent 14%,transparent 30%,rgba(9,9,11,.78) 52%,rgba(9,9,11,.96) 68%,var(--bg) 100%)}
.stage .grain{position:absolute;inset:0;opacity:.08;mix-blend-mode:overlay;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E")}
.top{position:absolute;z-index:5;top:max(16px,env(safe-area-inset-top));left:20px;right:20px;display:flex;align-items:center;gap:10px}
.top-d{display:none}
.tag{font-size:12.5px;font-weight:600;padding:7px 12px;border-radius:999px;background:rgba(255,255,255,.1);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:var(--edge)}
.who{font-size:13px;font-weight:700;color:rgba(255,255,255,.7)}
.line{margin:6px 0 0;font-weight:800;letter-spacing:-.035em;line-height:1.26;text-wrap:balance}
.eyebrow{display:flex;align-items:baseline;gap:8px;font-size:12px;font-weight:700;color:var(--dim)}
.eyebrow .mono{font-size:11px;font-weight:500;color:var(--muted)}
.eyebrow .end{margin-left:auto;font-size:12px;font-weight:600;color:var(--muted)}
h3{margin:4px 0 0;font-size:17px;font-weight:700;letter-spacing:-.025em;line-height:1.35}
.why{margin:6px 0 0;font-size:13.5px;font-weight:400;line-height:1.5;color:var(--dim)}
.proof{margin:10px 0 0;font-size:12px;color:var(--muted);display:none}
.open .proof{display:block}
.go{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;height:58px;border-radius:999px;background:#f4f5f8;color:#0b0b0d;font-size:17px;font-weight:800;letter-spacing:-.02em;
 box-shadow:0 18px 40px -18px rgba(255,255,255,.5);transition:transform .22s var(--spring)}
.go:active{transform:scale(.97)}
.go .play{width:0;height:0;border-left:11px solid #0b0b0d;border-top:7px solid transparent;border-bottom:7px solid transparent}
.go .min{font-weight:600;color:rgba(11,11,13,.55)}
.quiet{display:block;margin:14px auto 0;font-size:13px;font-weight:600;color:rgba(244,245,248,.55)}
.card{border-radius:20px;background:var(--glass);box-shadow:var(--edge);backdrop-filter:blur(22px) saturate(1.2);-webkit-backdrop-filter:blur(22px) saturate(1.2)}
@keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes word{from{opacity:0;filter:blur(8px);transform:translateY(6px)}to{opacity:1;filter:none;transform:none}}
.rise{animation:rise .52s var(--spring) both}
.line .w{display:inline-block;animation:word .5s var(--spring) both}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}

/* ── A안: 무대 + 세 장(까닭이 한눈에) ── */
.A .stage,.after .stage{height:44%}
.A .stage .shade,.after .stage .shade{background:linear-gradient(180deg,rgba(0,0,0,.45),transparent 18%,transparent 62%,var(--bg) 100%)}
.A .stage video,.after .stage img{object-position:50% 12%}
.A .talk{padding:0 6px 8px}
.A .line{font-size:24px}
.A .deck{display:grid;gap:8px}
.A .item{padding:13px 16px 14px;text-align:left;width:100%}
.A .item:active{transform:scale(.985)}
.A .go{margin-top:8px}
/* ── B안: 꽉 찬 태오 + 한 장씩 ── */
.B .stage .shade{background:linear-gradient(180deg,rgba(0,0,0,.55),transparent 14%,transparent 34%,rgba(9,9,11,.88) 54%,var(--bg) 70%)}
.B .rail{display:flex;gap:4px;flex:1}
.B .rail i{flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,.22)}
.B .rail i.on{background:#fff}
.B .meta{font-size:12.5px;font-weight:600;color:rgba(255,255,255,.75)}
.B .bottom{display:grid;gap:10px}
.B .talk{padding:0 6px 6px}
.B .line{font-size:26px}
.B .focus{padding:16px 18px 18px}
.B .focus h3{font-size:18px}
.B .next{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;margin:0 -16px;padding:0 16px}
.B .cap{flex:none;display:flex;align-items:center;gap:8px;height:44px;padding:0 16px 0 12px;border-radius:999px;background:var(--glass);box-shadow:var(--edge);font-size:14px;font-weight:600;color:var(--dim);white-space:nowrap;
 backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);transition:background .2s,color .2s,transform .2s var(--spring)}
.B .cap .mono{font-size:10.5px;color:var(--muted)}
.B .cap.on{background:var(--glass-2);color:var(--ink)}
.B .cap:active{transform:scale(.97)}

/* ── 끝(오늘 기록에 더하는 것) ── */
.after .stage img{filter:brightness(.62)}
.after .sheet{display:flex;flex-direction:column;gap:8px;max-height:calc(100dvh - 140px);overflow:auto;scrollbar-width:none}
.after h2{margin:0 6px 6px;font-size:24px;font-weight:800;letter-spacing:-.035em}
.after .chg{padding:14px 16px 15px}
.after .before{margin:6px 0 0;font-size:13.5px;color:var(--muted)}
.after .now{margin:2px 0 0;font-size:17px;font-weight:700;letter-spacing:-.025em;display:flex;gap:8px;align-items:baseline}
.after .now::before{content:'';flex:none;width:7px;height:12px;border:solid var(--warm);border-width:0 2.5px 2.5px 0;transform:rotate(45deg) translateY(-3px);margin:0 4px 0 2px}
.after .tm{display:flex;flex-wrap:wrap;gap:8px;margin:2px 0 0}
.after .tm span{display:inline-flex;gap:8px;align-items:center;height:40px;padding:0 14px;border-radius:999px;background:var(--glass);box-shadow:var(--edge);font-size:13.5px;font-weight:600;color:var(--dim)}
.after .tm b{font-weight:700;color:var(--ink)}
.after .sec{margin:12px 6px 2px}
.after .go{margin-top:auto;flex:none}
.Bafter .hero{padding:4px 6px 10px}
.Bafter .hero .before{font-size:14px}
.Bafter .hero .now{font-size:26px;font-weight:800;line-height:1.25}
.Bafter .hero .now::before{width:9px;height:16px;border-width:0 3px 3px 0}
.Bafter .mini{display:flex;flex-wrap:wrap;gap:8px}
.Bafter .mini span{display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 14px;border-radius:999px;background:var(--glass);box-shadow:var(--edge);font-size:13.5px;font-weight:600}
.Bafter .mini span i{font-style:normal;color:var(--warm)}

/* ── 넓은 화면(≥1024): 세로 무대 기둥(원본 720 → 1.05배) + 비대칭 데크, 바탕은 흐린 장면 ── */
@media (min-width:1024px){
 .app{display:grid;grid-template-columns:min(calc((100dvh - 96px) * 9 / 16),506px) minmax(420px,520px);justify-content:center;align-items:center;gap:72px;padding:48px 64px}
 .app>.right{display:grid;gap:12px;align-content:center}
 .stage,.A .stage,.after .stage{position:relative;inset:auto;height:min(calc(100dvh - 96px),900px);border-radius:28px;box-shadow:0 60px 120px -50px rgba(0,0,0,.9),var(--edge)}
 .stage .shade,.A .stage .shade,.B .stage .shade,.after .stage .shade{background:linear-gradient(180deg,rgba(0,0,0,.35),transparent 18%,transparent 80%,rgba(0,0,0,.4))}
 .top{display:none}.top-d{display:flex!important;align-items:center;gap:10px;margin-bottom:8px}
 .B .top-d .rail{max-width:180px}
 .A .talk,.B .talk{padding:0}
 .A .line,.B .line{font-size:44px;line-height:1.18;margin-bottom:18px}
 .B .line{font-size:52px}
 .who{font-size:14px}
 .after .sheet{max-height:calc(100dvh - 96px)}
 .after h2{font-size:40px}
 .B .next{margin:0;padding:0;flex-wrap:wrap}
}
/* 시안 도구 띠(디자인 밖) — ?shot이면 숨긴다 */
.tool{position:fixed;z-index:50;left:50%;bottom:6px;transform:translateX(-50%);display:flex;gap:4px;padding:4px;border-radius:999px;background:rgba(20,20,24,.9);box-shadow:0 0 0 1px rgba(255,255,255,.18);font-size:11.5px}
.tool a{padding:5px 10px;border-radius:999px;color:#bbb;text-decoration:none}.tool a.on{background:#fff;color:#000}
body.shot .tool{display:none}
@media (max-width:1023px){.tool{top:auto;bottom:auto;top:max(54px,env(safe-area-inset-top) + 44px)}}
`;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// '요' 강조: 태오 한 줄과 끝맺음 까닭 글의 따옴표 '요'만(뜻이 있는 자리 하나).
const yo = (s) => esc(s).replace(/&#39;요&#39;|'요'/g, "<em class=\"yo\">'요'</em>");
const words = (s) => String(s).split(' ').map((w, i) => `<span class="w" style="animation-delay:${120 + i * 70}ms">${yo(w)}</span>`).join(' ');
const KIND = { again: '복습', new: '오늘 공부', check: '점검' };
const DATE_TAG = (iso) => { const d = new Date(iso); return `${d.getMonth() + 1}월 ${d.getDate()}일 ${'일월화수목금토'[d.getDay()]}요일`; };
// 근거 한 줄(누르면 펼침)은 화면과 같은 함수(plan.mjs proofLine).
const items = (t) => t.items;

function todayA(t, tag) {
 return `<main class="app A">
 <div class="stage"><video src="__LOOP__" poster="__STILL__" autoplay muted loop playsinline></video><div class="shade"></div><div class="grain"></div></div>
 <header class="top"><span class="tag">${DATE_TAG(t.asOf)}</span></header>
 <div class="right">
 <div class="top-d"><span class="tag">${DATE_TAG(t.asOf)}</span></div>
 <section class="talk"><span class="who">태오</span><p class="line">${words(t.line.text)}</p></section>
 <section class="deck">
  ${items(t).map((it, i) => `<button type="button" class="card item rise" style="animation-delay:${420 + i * 60}ms" onclick="this.classList.toggle('open')">
   <div class="eyebrow"><span>${KIND[it.kind]}</span><span class="end">${it.minutes}분</span></div>
   <h3>${esc(it.title)}</h3><p class="why">${yo(it.why.text)}</p><p class="proof">${esc(proof(it))}</p></button>`).join('')}
  <button type="button" class="go rise" style="animation-delay:${420 + t.items.length * 60}ms"><span class="play"></span>오늘 시작 <span class="min">· ${t.minutes}분</span></button>
 </section>
 </div>
</main>`;
}
function todayB(t, tag) {
 const its = items(t);
 return `<main class="app B">
 <div class="stage"><video src="__LOOP__" poster="__STILL__" autoplay muted loop playsinline></video><div class="shade"></div><div class="grain"></div></div>
 <header class="top"><div class="rail">${its.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div><span class="meta">${its.length}가지 · ${t.minutes}분</span></header>
 <div class="right">
 <div class="top-d"><div class="rail">${its.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div><span class="meta">${DATE_TAG(t.asOf)} · ${t.minutes}분</span></div>
 <section class="bottom">
  <section class="talk"><span class="who">태오</span><p class="line">${words(t.line.text)}</p></section>
  <article class="card focus rise" style="animation-delay:420ms" data-focus>
   ${its.map((it, i) => `<div data-i="${i}" ${i ? 'hidden' : ''}><div class="eyebrow"><span class="mono">0${i + 1}</span><span>${KIND[it.kind]}</span><span class="end">${it.minutes}분</span></div>
    <h3>${esc(it.title)}</h3><p class="why">${yo(it.why.text)}</p><p class="proof" style="display:block">${esc(proof(it))}</p></div>`).join('')}
  </article>
  <div class="next rise" style="animation-delay:480ms">${its.map((it, i) => `<button type="button" class="cap${i ? '' : ' on'}" data-pick="${i}"><span class="mono">0${i + 1}</span>${esc(it.title)}</button>`).join('')}</div>
  <button type="button" class="go rise" style="animation-delay:540ms"><span class="play"></span>오늘 시작 <span class="min">· ${t.minutes}분</span></button>
 </section>
 </div>
</main>
<script>
const caps=[...document.querySelectorAll('[data-pick]')],panes=[...document.querySelectorAll('[data-focus] [data-i]')];
const pick=i=>{caps.forEach((c,k)=>c.classList.toggle('on',k===i));panes.forEach((p,k)=>p.hidden=k!==i);};
caps.forEach(c=>c.onclick=()=>pick(+c.dataset.pick));
addEventListener('keydown',e=>{const n=+e.key;if(n>=1&&n<=caps.length)pick(n-1);});
</script>`;
}
function afterA(t, a) {
 return `<main class="app after">
 <div class="stage"><img src="__STILL__" alt=""><div class="shade"></div><div class="grain"></div></div>
 <header class="top"><span class="tag">오늘 공부 끝</span></header>
 <div class="right"><div class="top-d"><span class="tag">오늘 공부 끝</span></div><section class="sheet">
  <h2 class="rise">오늘 달라진 것</h2>
  ${a.changed.map((c, i) => `<div class="card chg rise" style="animation-delay:${120 + i * 60}ms"><div class="eyebrow"><span>${yo(c.what)}</span></div><p class="before">${esc(c.before)}</p><p class="now">${esc(c.after)}</p></div>`).join('')}
  <p class="eyebrow sec rise" style="animation-delay:340ms"><span>내일 할 것</span></p>
  <div class="tm rise" style="animation-delay:380ms">${a.tomorrow.map((x) => `<span><b>${esc(x.when)}</b>${esc(x.title)}</span>`).join('')}</div>
  <button type="button" class="go rise" style="animation-delay:440ms">오늘은 여기까지</button>
 </section></div>
</main>`;
}
function afterB(t, a) {
 const [first, ...rest] = a.changed;
 return `<main class="app after Bafter">
 <div class="stage"><img src="__STILL__" alt=""><div class="shade"></div><div class="grain"></div></div>
 <header class="top"><span class="tag">오늘 공부 끝</span></header>
 <div class="right"><div class="top-d"><span class="tag">오늘 공부 끝</span></div><section class="sheet">
  <div class="hero rise"><div class="eyebrow"><span>${yo(first.what)}</span></div><p class="before">${esc(first.before)}</p><p class="now">${esc(first.after)}</p></div>
  <div class="mini rise" style="animation-delay:160ms">${rest.map((c) => `<span><i>✓</i>${esc(c.what)} · ${esc(c.after.replace(/^오늘 /, ''))}</span>`).join('')}</div>
  <p class="eyebrow sec rise" style="animation-delay:260ms"><span>내일 할 것</span></p>
  <div class="tm rise" style="animation-delay:300ms">${a.tomorrow.map((x) => `<span><b>${esc(x.when)}</b>${esc(x.title)}</span>`).join('')}</div>
  <button type="button" class="go rise" style="animation-delay:380ms">오늘은 여기까지</button>
 </section></div>
</main>`;
}

const STATES = [['A', '기록 A · 어제 놓친 줄'], ['B', '기록 B · 8일 전 새 상황'], ['after', '끝 · 기록 A 뒤']];
function page(opt) {
 const views = {
  A: opt === 'A' ? todayA(DATA.A.today) : todayB(DATA.A.today),
  B: opt === 'A' ? todayA(DATA.B.today) : todayB(DATA.B.today),
  after: opt === 'A' ? afterA(DATA.A.today, DATA.A.after) : afterB(DATA.A.today, DATA.A.after),
 };
 const title = opt === 'A' ? '오늘 · A안 무대와 세 장' : '오늘 · B안 한 장씩';
 return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${title}</title><style>${FONTS}${CSS}</style></head><body>
<div class="field"></div>
<div id="view"></div>
<nav class="tool">${STATES.map(([k, n]) => `<a href="#${k}" data-k="${k}">${n}</a>`).join('')}</nav>
<script>
const V=${JSON.stringify(views).replace(/<\//g, '<\\/')},LOOP='${LOOP}',STILL='${STILL}';
const show=()=>{const k=(location.hash.slice(1)||'A');const v=document.getElementById('view');v.innerHTML=(V[k]||V.A).replaceAll('__LOOP__',LOOP).replaceAll('__STILL__',STILL);
 v.querySelectorAll('script').forEach(s=>{const n=document.createElement('script');n.textContent=s.textContent;s.replaceWith(n);});
 document.querySelectorAll('.tool a').forEach(a=>a.classList.toggle('on',a.dataset.k===k));};
addEventListener('hashchange',show);if(new URLSearchParams(location.search).has('shot'))document.body.classList.add('shot');show();
</script></body></html>`;
}
for (const opt of ['A', 'B']) fs.writeFileSync(path.join(OUT, `${opt}안.html`), page(opt));
console.log(`시안 → ${OUT}`);
