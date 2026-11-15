#!/usr/bin/env node
// 「오늘」 한 장 뼈대 다시 짜기 시안(11-16 — 유호님 「전부 자율로 진행해줘 뼈대도 다시 짜도 돼」). 11-14 카본이 A안을 「흔한 어두운 화면 틀」
// (사진 위 + 어두운 판 + 유리 카드 + 흰 알약)이라고 짚었다. 그 틀을 버린 두 안을 실제 기록 값(뽑기.mjs A · B --after)으로 짓는다.
//   1안 「일력」 — 밝은 종이 한 장. 날짜 숫자가 주인공이고, 태오는 동그란 영상 쪽지로 작게 붙는다. 다 하면 그 장을 뜯고 다음 장이 보인다.
//   2안 「극장」 — 어두운 무대를 지키되 카드를 없앤다. 가로로 자른 장면 한 칸, 그 아래 자막, 끝 자막처럼 글로만 쌓은 세 줄.
// 자립형 HTML 한 장씩(글꼴 · 태오 사진 · 듣는 고리 영상을 안에 싣는다). 결과는 .tmp에 쓴다.
//   node experiences/drama/qa/오늘한장-20261114/뼈대시안.mjs [--out .tmp/today-20261116]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { proofLine as proof } from '../../pilot/today/plan.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../..');
const args = process.argv.slice(2);
const OUT = path.resolve(ROOT, args.includes('--out') ? args[args.indexOf('--out') + 1] : '.tmp/today-20261116');
const MEDIA = path.join(ROOT, 'experiences/drama/pilot/media');
fs.mkdirSync(OUT, { recursive: true });

const NOW = Date.parse('2026-11-16T09:00:00+09:00');
const pick = (s) => JSON.parse(execFileSync(process.execPath, [path.join(HERE, '뽑기.mjs'), s, '--after', '--now', new Date(NOW).toISOString()], { encoding: 'utf8' }));
const DATA = { A: pick('A'), B: pick('B') };
fs.writeFileSync(path.join(OUT, '값.json'), JSON.stringify(DATA, null, 1));

const b64 = (f) => fs.readFileSync(path.join(MEDIA, f)).toString('base64');
const FONTS = `@font-face{font-family:'SUIT';src:url(data:font/woff2;base64,${b64('SUIT-Variable.woff2')}) format('woff2');font-weight:100 900;font-display:block}
@font-face{font-family:'Inter Tight';src:url(data:font/woff2;base64,${b64('InterTight-Medium.woff2')}) format('woff2');font-weight:400 600;font-display:block}
@font-face{font-family:'DM Mono';src:url(data:font/woff2;base64,${b64('DMMono-Medium.woff2')}) format('woff2');font-weight:500;font-display:block}`;
const STILL = `data:image/webp;base64,${b64('taeo-still.webp')}`;
const LOOP = `data:video/mp4;base64,${b64('taeo-listen.mp4')}`;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const yo = (s) => esc(s).replace(/&#39;요&#39;/g, '<em class="yo">요</em>');
const KIND = { again: '복습', new: '오늘 공부', check: '점검' };
const WD = '일월화수목금토';
const day = (ms) => { const d = new Date(ms + 9 * 3600e3); return { m: d.getUTCMonth() + 1, d: d.getUTCDate(), w: d.getUTCDay() }; };
// 다음에 할 것의 「내일」 · 「11월 18일」을 날짜로 — 일력 장 번호로 쓴다.
const whenDay = (when) => {
 if (when === '내일') return day(NOW + 864e5);
 const m = /(\d+)월 (\d+)일/.exec(when || '');
 if (!m) return null;
 const ms = Date.UTC(2026, +m[1] - 1, +m[2], 3);
 return day(ms);
};
const lunar = (ms) => { try { const f = new Intl.DateTimeFormat('ko-KR-u-ca-dangi', { month: 'numeric', day: 'numeric', timeZone: 'Asia/Seoul' }); if (f.resolvedOptions().calendar !== 'dangi') return ''; const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value])); return `음력 ${p.month}월 ${p.day}일`; } catch { return ''; } };
const words = (s, at = 160) => String(s).split(' ').map((w, i) => `<span class="w" style="animation-delay:${at + i * 60}ms">${yo(w)}</span>`).join(' ');

/* ───────── 1안 「일력」 ───────── */
const CSS1 = `
:root{--paper:#f2efe7;--paper-2:#e9e5da;--ink:#17160f;--ink-2:rgba(23,22,15,.62);--ink-3:rgba(23,22,15,.44);--rule:rgba(23,22,15,.12);
 --mark:#ffd34d;--sun:#d2402c;--sat:#2c5ad2;--spring:cubic-bezier(.22,1,.36,1);
 --sans:'SUIT',system-ui,-apple-system,'Apple SD Gothic Neo',sans-serif;--num:'Inter Tight','SUIT',sans-serif;--mono:'DM Mono',ui-monospace,monospace;color-scheme:light}
*{box-sizing:border-box}html,body{margin:0;height:100%;background:#0b0b0c;color:var(--ink);font-family:var(--sans);-webkit-font-smoothing:antialiased}
body{font-size:15px;line-height:1.5;letter-spacing:-.012em;word-break:keep-all;overflow:hidden}
button{font:inherit;color:inherit;border:0;background:none;cursor:pointer;text-align:left;-webkit-tap-highlight-color:transparent;padding:0}
em.yo{font-style:normal;background:linear-gradient(transparent 52%,var(--mark) 52%,var(--mark) 92%,transparent 92%);padding:0 .08em}
.cal{position:fixed;inset:0;display:flex;flex-direction:column;background:var(--paper)}
/* 위 묶음 — 일력의 풀칠한 머리와 뜯는 점선 */
.bind{flex:none;height:max(14px,env(safe-area-inset-top));background:var(--ink);position:relative}
.bind::after{content:'';position:absolute;left:0;right:0;bottom:-7px;height:4px;background:radial-gradient(circle,rgba(23,22,15,.28) 1.1px,transparent 1.6px) 0 50%/7px 4px repeat-x}
.edges{flex:none;height:5px;background:linear-gradient(var(--paper-2),var(--paper-2)) 0 0/100% 1px no-repeat,linear-gradient(var(--paper-2),var(--paper-2)) 0 3px/100% 1px no-repeat}
.sheet{flex:1;min-height:0;display:flex;flex-direction:column;padding:10px 20px 0;overflow:auto;scrollbar-width:none}
.sheet::-webkit-scrollbar{display:none}
.date{display:grid;grid-template-columns:auto 1fr;align-items:end;column-gap:14px;padding-top:6px}
.ym{grid-column:1/-1;display:flex;justify-content:space-between;font-size:13px;font-weight:600;color:var(--ink-2)}
.ym .mono{font-family:var(--mono);font-weight:500;font-size:11px;letter-spacing:.08em;color:var(--ink-3)}
.num{font-family:var(--num);font-weight:500;font-size:128px;line-height:.86;letter-spacing:-.065em;margin:6px 0 0 -6px;font-variant-numeric:tabular-nums}
.num.sun{color:var(--sun)}.num.sat{color:var(--sat)}
.wd{padding-bottom:10px}
.wd b{display:block;font-size:22px;font-weight:700;letter-spacing:-.03em;line-height:1.1}
.wd span{display:block;margin-top:4px;font-size:13px;color:var(--ink-2)}
.say{display:grid;grid-template-columns:64px 1fr;gap:14px;align-items:start;margin:22px 0 4px;padding:16px 0 18px;border-top:1px solid var(--ink)}
.bub{position:relative;width:64px;height:64px;border-radius:50%;overflow:hidden;background:#222;box-shadow:0 0 0 1px var(--rule),0 10px 24px -12px rgba(23,22,15,.5)}
.bub video,.bub img{width:100%;height:100%;object-fit:cover;object-position:50% 24%;transform:scale(1.9);transform-origin:50% 28%}
.bub i{position:absolute;right:-1px;bottom:-1px;width:22px;height:22px;border-radius:50%;background:var(--ink);box-shadow:0 0 0 2px var(--paper);display:grid;place-items:center}
.bub i::before{content:'';border-left:7px solid var(--paper);border-top:4.5px solid transparent;border-bottom:4.5px solid transparent;margin-left:2px}
.who{margin:2px 0 0;font-size:12.5px;font-weight:700;color:var(--ink-2)}
.line{margin:4px 0 0;font-size:19px;font-weight:600;line-height:1.42;letter-spacing:-.03em;text-wrap:pretty}
.line .w{display:inline-block;animation:word .5s var(--spring) both}
.sec{display:flex;justify-content:space-between;align-items:baseline;margin:10px 0 0;padding-bottom:8px;font-size:12.5px;font-weight:700;color:var(--ink-2);border-bottom:1px solid var(--rule)}
.sec .n{font-family:var(--num);font-size:13px;font-weight:600;color:var(--ink)}
.row{display:block;width:100%;padding:14px 0 15px;border-bottom:1px solid var(--rule);position:relative;transition:background .2s}
.row:active{background:rgba(23,22,15,.04)}
.row .k{display:flex;gap:8px;align-items:baseline;font-size:12px;font-weight:700;color:var(--ink-3)}
.row .k b{font-family:var(--num);font-weight:600;color:var(--ink-3)}
.row h3{margin:3px 28px 0 0;font-size:17px;font-weight:700;letter-spacing:-.03em;line-height:1.32}
.row .why{margin:5px 0 0;font-size:14px;line-height:1.52;color:var(--ink-2)}
.row .pf{display:grid;grid-template-rows:0fr;transition:grid-template-rows .32s var(--spring)}
.row .pf>p{overflow:hidden;margin:0;font-size:12.5px;color:var(--ink-3)}
.row.open .pf{grid-template-rows:1fr}.row.open .pf>p{padding-top:8px}
.row .plus{position:absolute;right:0;top:34px;width:14px;height:14px}
.row .plus::before,.row .plus::after{content:'';position:absolute;left:0;right:0;top:6px;height:1.6px;background:var(--ink-3);transition:transform .3s var(--spring)}
.row .plus::after{transform:rotate(90deg)}.row.open .plus::after{transform:rotate(0)}
.foot{flex:none;padding:12px 20px max(16px,env(safe-area-inset-bottom));background:linear-gradient(transparent,var(--paper) 30%)}
.go{display:flex;align-items:center;gap:12px;width:100%;height:60px;padding:0 20px;border-radius:14px;background:var(--ink);color:var(--paper);font-size:17px;font-weight:700;letter-spacing:-.02em;transition:transform .22s var(--spring)}
.go:active{transform:scale(.98)}
.go .m{margin-left:auto;font-family:var(--num);font-weight:600;font-size:15px;color:rgba(242,239,231,.6)}
.go .arr{width:18px;height:2px;background:currentColor;position:relative}
.go .arr::after{content:'';position:absolute;right:0;top:-4px;width:8px;height:8px;border:solid currentColor;border-width:2px 2px 0 0;transform:rotate(45deg)}
.rise{animation:rise .55s var(--spring) both}
@keyframes rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@keyframes word{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
/* 끝 — 전은 줄을 긋고, 후는 형광 체크 */
.chg{padding:14px 0 15px;border-bottom:1px solid var(--rule)}
.chg .k{font-size:12px;font-weight:700;color:var(--ink-3)}
.chg .was{margin:5px 0 0;font-size:14px;color:var(--ink-3);text-decoration:line-through;text-decoration-color:rgba(23,22,15,.5);text-decoration-thickness:1.2px}
.chg .now{margin:3px 0 0;display:flex;gap:9px;align-items:baseline;font-size:17px;font-weight:700;letter-spacing:-.03em}
.chg .now::before{content:'';flex:none;width:6px;height:11px;border:solid var(--ink);border-width:0 2.4px 2.4px 0;transform:rotate(45deg) translate(-2px,-3px);box-shadow:3px 3px 0 0 var(--mark)}
.pages{margin:18px 0 6px}
.pg{display:grid;grid-template-columns:52px 1fr;align-items:start;gap:12px;padding:12px 12px 12px 0;border-bottom:1px dashed rgba(23,22,15,.22)}
.pg .d{display:flex;align-items:baseline;gap:3px;font-family:var(--num);font-weight:500;font-size:28px;letter-spacing:-.05em;line-height:1}
.pg .d small{font-family:var(--sans);font-size:12px;font-weight:700;letter-spacing:0;color:var(--ink-3)}
.pg p{margin:0;font-size:14.5px;font-weight:600;color:var(--ink)}
.pg p+p{margin-top:8px}
.pg p span{display:block;font-size:12px;font-weight:700;color:var(--ink-3)}
/* 뜯기 — 다 하면 이 장을 뜯고 다음 장이 보인다. 시작하면 장이 들려 어두운 장면이 보인다. */
.stack{flex:1;min-height:0;position:relative}
.stack>.sheet{position:absolute;inset:0;background:var(--paper)}
.top-sheet{box-shadow:0 -1px 0 rgba(23,22,15,.06)}
.top-sheet .right>.sec,.under .right>.sec{margin-top:20px;padding-top:12px;border-top:1px solid var(--ink)}
.under .row{cursor:default}
.cal.torn .top-sheet{display:none}
.cal.tearing .top-sheet{animation:tear .95s cubic-bezier(.55,0,.8,.2) forwards;transform-origin:8% 0;pointer-events:none}
@keyframes tear{0%{transform:none}16%{transform:rotate(1.4deg) translateY(6px)}100%{transform:translate(-4%,-118%) rotate(-10deg);box-shadow:0 40px 80px -30px rgba(0,0,0,.45)}}
.cal.lifting .sheet{animation:lift .8s cubic-bezier(.6,0,.75,.2) forwards;transform-origin:50% 0}
.cal.lifting .foot{opacity:0;transition:opacity .2s}
@keyframes lift{to{transform:translateY(-105%) rotate(-2.5deg);box-shadow:0 50px 90px -30px rgba(0,0,0,.6)}}
.cal.lifting{background:#060608;transition:background .5s .2s}
.cal.lifting .bind,.cal.lifting .edges{opacity:0;transition:opacity .4s}
@media (max-width:1023px){
 .sheet>.left,.sheet>.right{display:contents}
 .foot{position:sticky;bottom:0;order:9;margin:auto -20px 0;padding:14px 20px max(16px,env(safe-area-inset-bottom))}
 .top-sheet .date{order:0}.top-sheet .right>.sec,.top-sheet .chg{order:1}.top-sheet .pages{order:2}
 .date.small .num{font-size:92px}
 .date.small .wd b{font-size:19px}
}
@media (min-width:1024px){
 html,body{background:var(--paper)}
 .cal{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);grid-template-rows:auto 1fr;column-gap:0;padding:0}
 .bind{grid-column:1/-1;height:18px}.edges{display:none}
 .stack{grid-column:1/-1}
 .sheet{grid-column:1/-1;display:grid;grid-template-columns:minmax(0,520px) minmax(0,520px);justify-content:center;align-items:center;column-gap:96px;padding:56px 64px 48px;overflow:hidden}
 .date.small .num{font-size:220px}
 .left,.right{align-self:center}
 .sheet{align-content:center}
 .top-sheet .right>.sec,.under .right>.sec{margin-top:0}
 .num{font-size:300px;margin-left:-14px}
 .wd b{font-size:34px}.wd span{font-size:15px}
 .say{grid-template-columns:96px 1fr;margin-top:36px;padding-top:24px}
 .bub{width:96px;height:96px}
 .line{font-size:26px}
 .right{display:flex;flex-direction:column}
 .foot{padding:22px 0 0;background:none}
 .row h3{font-size:19px}
}
@media (prefers-reduced-motion:reduce){.rise,.line .w{animation:none!important}}
`;
function todayCal(t) {
 const d = day(NOW);
 const left = `<div class="left">
  <header class="date rise"><div class="ym"><span>2026년 ${d.m}월</span></div>
   <div class="num${d.w === 0 ? ' sun' : d.w === 6 ? ' sat' : ''}">${d.d}</div><div class="wd"><b>${WD[d.w]}요일</b><span>${lunar(NOW)}</span></div></header>
  <section class="say rise" style="animation-delay:80ms"><div class="bub"><video src="__LOOP__" poster="__STILL__" autoplay muted loop playsinline></video><i></i></div>
   <div><p class="who">태오</p><p class="line">${words(t.line.text)}</p></div></section></div>`;
 const right = `<div class="right">
  <p class="sec rise" style="animation-delay:200ms"><span>오늘 할 것</span><span class="n">${t.minutes}분</span></p>
  ${t.items.map((it, i) => `<button type="button" class="row rise" data-card style="animation-delay:${260 + i * 60}ms"><span class="k">${KIND[it.kind]}<b>${it.minutes}분</b></span><h3>${esc(it.title)}</h3><p class="why">${yo(it.why.text)}</p><div class="pf"><p>${esc(proof(it))}</p></div><span class="plus"></span></button>`).join('')}
  <div class="foot rise" style="animation-delay:460ms"><button type="button" class="go">오늘 시작<span class="m">${t.minutes}분</span><span class="arr"></span></button></div></div>`;
 return `<main class="cal"><div class="bind"></div><div class="edges"></div><article class="sheet">${left}${right}</article></main>`;
}
// 다음에 할 것을 날짜(일력의 다음 장)로 묶는다.
function nextPages(a) {
 const by = new Map();
 for (const x of a.tomorrow) { const w = whenDay(x.when); const k = w ? `${w.m}-${w.d}` : x.when; if (!by.has(k)) by.set(k, { w, when: x.when, items: [] }); by.get(k).items.push(x); }
 return [...by.values()];
}
function afterCal(t, a) {
 const d = day(NOW);
 const pages = nextPages(a);
 const [first] = pages;
 const head = `<header class="date small rise"><div class="ym"><span>2026년 ${d.m}월</span></div>
   <div class="num">${d.d}</div><div class="wd"><b>${WD[d.w]}요일</b><span>오늘 공부 끝</span></div></header>`;
 const changed = `<p class="sec rise" style="animation-delay:120ms"><span>오늘 달라진 것</span></p>
  ${a.changed.map((c, i) => `<div class="chg rise" style="animation-delay:${180 + i * 70}ms"><p class="k">${yo(c.what)}</p><p class="was">${esc(c.before)}</p><p class="now">${esc(c.after)}</p></div>`).join('')}`;
 const next = `<section class="pages rise" style="animation-delay:420ms"><p class="sec"><span>${a.tomorrow.every((x) => x.when === '내일') ? '내일 할 것' : '다음에 할 것'}</span></p>
  ${pages.map((p) => `<div class="pg"><span class="d">${p.w ? p.w.d : ''}<small>${p.w ? WD[p.w.w] : ''}</small></span><div>${p.items.map((x) => `<p><span>${esc(x.when)} · ${KIND[x.kind]}</span>${esc(x.title)}</p>`).join('')}</div></div>`).join('')}</section>`;
 const go = `<div class="foot rise" style="animation-delay:520ms"><button type="button" class="go" data-tear>오늘은 여기까지<span class="m">다음 장</span><span class="arr"></span></button></div>`;
 // 다 하고 뜯으면 보이는 다음 장(내일).
 const tw = first?.w || day(NOW + 864e5);
 const under = `<article class="sheet under" aria-hidden="true"><div class="left"><header class="date"><div class="ym"><span>2026년 ${tw.m}월</span></div>
   <div class="num${tw.w === 0 ? ' sun' : tw.w === 6 ? ' sat' : ''}">${tw.d}</div><div class="wd"><b>${WD[tw.w]}요일</b><span>${lunar(Date.UTC(2026, tw.m - 1, tw.d, 3))}</span></div></header></div>
   <div class="right"><p class="sec"><span>${first?.when === '내일' ? '내일 할 것' : '이날 할 것'}</span></p>${(first?.items || []).map((x) => `<div class="row"><span class="k">${KIND[x.kind]}</span><h3>${esc(x.title)}</h3></div>`).join('')}</div></article>`;
 return `<main class="cal after"><div class="bind"></div><div class="edges"></div><div class="stack">${under}<article class="sheet top-sheet"><div class="left">${head}${next}</div><div class="right">${changed}${go}</div></article></div></main>`;
}

/* ───────── 2안 「극장」 ───────── */
const CSS2 = `
:root{--bg:#060608;--ink:#f4f5f8;--dim:rgba(244,245,248,.62);--muted:rgba(244,245,248,.5);--rule:rgba(255,255,255,.1);--accent:#8b7bff;--warm:#ffcf5c;
 --spring:cubic-bezier(.22,1,.36,1);--sans:'SUIT',system-ui,-apple-system,'Apple SD Gothic Neo',sans-serif;--num:'Inter Tight','SUIT',sans-serif;--mono:'DM Mono',ui-monospace,monospace;color-scheme:dark}
*{box-sizing:border-box}html,body{margin:0;height:100%;background:var(--bg);color:var(--ink);font-family:var(--sans);-webkit-font-smoothing:antialiased}
body{font-size:15px;line-height:1.5;letter-spacing:-.01em;word-break:keep-all;overflow:hidden}
button{font:inherit;color:inherit;border:0;background:none;cursor:pointer;text-align:left;-webkit-tap-highlight-color:transparent;padding:0}
em.yo{font-style:normal;color:var(--warm)}
.th{position:fixed;inset:0;display:flex;flex-direction:column;overflow:auto;scrollbar-width:none}
.top{display:flex;justify-content:space-between;align-items:baseline;padding:max(18px,env(safe-area-inset-top)) 20px 14px;font-size:13px;font-weight:600;color:var(--dim)}
.top .mono{font-family:var(--mono);font-size:11px;font-weight:500;letter-spacing:.1em;color:var(--muted)}
.frame{position:relative;margin:0;aspect-ratio:1.85;overflow:hidden;background:#000}
.frame video,.frame img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 30%;animation:push 9s linear both}
.frame::after{content:'';position:absolute;inset:0;box-shadow:inset 0 0 0 1px rgba(255,255,255,.06);background:radial-gradient(120% 90% at 50% 40%,transparent 60%,rgba(0,0,0,.35))}
@keyframes push{from{transform:scale(1.08)}to{transform:scale(1)}}
.sub{padding:18px 24px 0;text-align:center;min-height:118px}
.spk{font-family:var(--mono);font-size:10.5px;font-weight:500;letter-spacing:.14em;color:var(--muted)}
.line{margin:8px auto 0;max-width:22em;font-size:20px;font-weight:700;line-height:1.38;letter-spacing:-.03em;text-wrap:balance}
.line .w{display:inline-block;animation:word .5s var(--spring) both}
.cr{list-style:none;margin:18px 20px 0;padding:0;border-top:1px solid var(--rule)}
.cr li{border-bottom:1px solid var(--rule)}
.cr button{display:grid;grid-template-columns:68px 1fr;column-gap:12px;width:100%;padding:15px 0 16px}
.cr .k{font-size:12px;font-weight:700;color:var(--muted);padding-top:3px}
.cr .k b{display:block;margin-top:2px;font-family:var(--num);font-weight:500;font-size:12px;color:var(--muted)}
.cr h3{margin:0;font-size:16.5px;font-weight:700;letter-spacing:-.025em;line-height:1.34}
.cr .why{margin:5px 0 0;font-size:13.5px;line-height:1.52;color:var(--dim)}
.cr .pf{grid-column:2;display:grid;grid-template-rows:0fr;transition:grid-template-rows .32s var(--spring)}
.cr .pf>p{overflow:hidden;margin:0;font-size:12px;color:var(--muted)}
.cr .open .pf{grid-template-rows:1fr}.cr .open .pf>p{padding-top:8px}
.foot{position:sticky;bottom:0;margin-top:auto;padding:14px 20px max(16px,env(safe-area-inset-bottom));background:linear-gradient(transparent,var(--bg) 34%)}
.go{display:flex;align-items:center;justify-content:space-between;width:100%;height:58px;padding:0 22px;border-radius:12px;background:var(--accent);color:#0b0a14;font-size:17px;font-weight:800;letter-spacing:-.02em;transition:transform .22s var(--spring);box-shadow:0 20px 50px -24px rgba(139,123,255,.9)}
.go:active{transform:scale(.98)}
.go .m{font-family:var(--num);font-weight:600;font-size:15px;color:rgba(11,10,20,.6)}
.rise{animation:rise .55s var(--spring) both}
@keyframes rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@keyframes word{from{opacity:0;filter:blur(8px);transform:translateY(6px)}to{opacity:1;filter:none;transform:none}}
.after .frame img{filter:brightness(.55) saturate(.8)}
.chg{display:grid;grid-template-columns:68px 1fr;column-gap:12px;padding:15px 0 16px;border-bottom:1px solid var(--rule)}
.chg .k{grid-row:span 3;font-size:12px;font-weight:700;color:var(--muted);padding-top:2px}
.chg .what{margin:0;font-size:12.5px;font-weight:700;color:var(--dim)}
.chg .was{margin:4px 0 0;font-size:13.5px;color:var(--muted);text-decoration:line-through;text-decoration-color:rgba(255,255,255,.35)}
.chg .now{margin:3px 0 0;font-size:16.5px;font-weight:700;letter-spacing:-.025em;color:var(--ink)}
.chg .now::before{content:'✓ ';color:var(--warm)}
.nx{margin:18px 20px 0;display:grid;gap:8px}
.nx p{margin:0;display:grid;grid-template-columns:68px 1fr;column-gap:12px;font-size:14px;font-weight:600;color:var(--dim)}
.nx p b{font-size:12px;font-weight:700;color:var(--ink)}
.nx .h{font-size:12px;font-weight:700;color:var(--muted)}
@media (min-width:1024px){
 .th{align-items:center}
 .top{width:min(1120px,calc(100% - 128px));padding:36px 0 18px}
 .frame{width:min(1120px,calc(100% - 128px));aspect-ratio:2.39;border-radius:4px}
 .sub{min-height:0;padding-top:22px}
 .line{font-size:28px}
 .cr{width:min(1120px,calc(100% - 128px));margin:30px 0 0;display:grid;grid-template-columns:repeat(3,1fr);column-gap:32px;border:0}
 .cr li{border-bottom:0;border-top:1px solid var(--rule)}
 .cr button{grid-template-columns:1fr;row-gap:4px}
 .cr .pf{grid-column:1}
 .foot{position:static;width:min(1120px,calc(100% - 128px));display:flex;justify-content:flex-end;padding:22px 0 40px;background:none}
 .go{width:360px}
 .after .cr-a{width:min(1120px,calc(100% - 128px));display:grid;grid-template-columns:repeat(3,1fr);column-gap:32px;margin:30px 0 0}
 .after .chg{grid-template-columns:1fr;border-top:1px solid var(--rule);border-bottom:0}
 .after .chg .k{grid-row:auto}
 .nx{width:min(1120px,calc(100% - 128px));margin:18px 0 0}
}
@media (prefers-reduced-motion:reduce){.rise,.line .w,.frame video,.frame img{animation:none!important}}
`;
function todayTh(t) {
 const d = day(NOW);
 // 자막 규칙(11-05) — 한 화면에 한 문장. 시안은 첫 문장만 띄우고 넘김은 화면 코드가 소리 쉬는 자리에서 한다.
 const first = t.line.text.split(/(?<=[?.!])\s+/)[0];
 return `<main class="th"><header class="top rise"><span>${d.m}월 ${d.d}일 ${WD[d.w]}요일</span><span>오늘 할 것 · ${t.minutes}분</span></header>
 <figure class="frame rise"><video src="__LOOP__" poster="__STILL__" autoplay muted loop playsinline></video></figure>
 <section class="sub"><p class="spk">TAEO</p><p class="line">${words(first, 300)}</p></section>
 <ol class="cr">${t.items.map((it, i) => `<li class="rise" style="animation-delay:${380 + i * 70}ms"><button type="button" data-card><span class="k">${KIND[it.kind]}<b>${it.minutes}분</b></span><span><h3>${esc(it.title)}</h3><p class="why">${yo(it.why.text)}</p></span><div class="pf"><p>${esc(proof(it))}</p></div></button></li>`).join('')}</ol>
 <div class="foot rise" style="animation-delay:600ms"><button type="button" class="go">오늘 시작<span class="m">${t.minutes}분</span></button></div></main>`;
}
function afterTh(t, a) {
 const d = day(NOW);
 const head = a.tomorrow.every((x) => x.when === '내일') ? '내일 할 것' : '다음에 할 것';
 return `<main class="th after"><header class="top rise"><span>${d.m}월 ${d.d}일 ${WD[d.w]}요일</span><span>오늘 공부 끝</span></header>
 <figure class="frame rise"><img src="__STILL__" alt=""></figure>
 <section class="sub"><p class="line">${words('오늘 달라진 것', 200)}</p></section>
 <div class="cr-a" style="margin:0 20px">${a.changed.map((c, i) => `<div class="chg rise" style="animation-delay:${300 + i * 70}ms"><span class="k">${KIND[t.items[i]?.kind] || ''}</span><p class="what">${yo(c.what)}</p><p class="was">${esc(c.before)}</p><p class="now">${esc(c.after)}</p></div>`).join('')}</div>
 <div class="nx rise" style="animation-delay:520ms"><span class="h">${head}</span>${a.tomorrow.map((x) => `<p><b>${esc(x.when)}</b>${esc(x.title)}</p>`).join('')}</div>
 <div class="foot rise" style="animation-delay:600ms"><button type="button" class="go">오늘은 여기까지</button></div></main>`;
}

const STATES = [['A', '기록 A · 어제 놓친 줄'], ['B', '기록 B · 8일 전 새 상황'], ['after', '끝 · 기록 A 뒤'], ['next', '뜯은 뒤 다음 장']];
function page(opt) {
 const one = opt === '1';
 const views = {
  A: one ? todayCal(DATA.A.today) : todayTh(DATA.A.today),
  B: one ? todayCal(DATA.B.today) : todayTh(DATA.B.today),
  after: one ? afterCal(DATA.A.today, DATA.A.after) : afterTh(DATA.A.today, DATA.A.after),
 };
 views.next = views.after;
 const title = one ? '오늘 · 1안 일력' : '오늘 · 2안 극장';
 return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${title}</title><style>${FONTS}${one ? CSS1 : CSS2}
.tool{position:fixed;z-index:99;left:50%;bottom:10px;transform:translateX(-50%);display:flex;gap:4px;padding:4px;border-radius:10px;background:rgba(0,0,0,.72);font:600 12px/1 system-ui}
.tool a{color:#fff;text-decoration:none;padding:7px 9px;border-radius:7px;opacity:.6}.tool a.on{opacity:1;background:rgba(255,255,255,.16)}.shot .tool{display:none}</style></head><body>
<div id="view"></div>
<nav class="tool">${STATES.map(([k, n]) => `<a href="#${k}" data-k="${k}">${n}</a>`).join('')}</nav>
<script>
const V=${JSON.stringify(views).replace(/<\//g, '<\\/')},LOOP='${LOOP}',STILL='${STILL}';
const show=()=>{const k=(location.hash.slice(1)||'A');const v=document.getElementById('view');v.innerHTML=(V[k]||V.A).replaceAll('__LOOP__',LOOP).replaceAll('__STILL__',STILL);
 if(k==='next')v.querySelector('main')?.classList.add('torn');
 v.querySelector('[data-tear]')?.addEventListener('click',()=>v.querySelector('main').classList.add('tearing'));
 v.querySelectorAll('.go:not([data-tear])').forEach(g=>g.addEventListener('click',()=>{const m=v.querySelector('main');m.classList.add('lifting');setTimeout(()=>m.classList.remove('lifting'),1900);}));
 v.querySelectorAll('[data-card]').forEach(c=>c.addEventListener('click',()=>(c.closest('li')||c).classList.toggle('open')));
 document.querySelectorAll('.tool a').forEach(a=>a.classList.toggle('on',a.dataset.k===k));};
addEventListener('hashchange',show);if(new URLSearchParams(location.search).has('shot'))document.body.classList.add('shot');show();
</script></body></html>`;
}
for (const opt of ['1', '2']) fs.writeFileSync(path.join(OUT, `${opt}안.html`), page(opt));
console.log(`시안 → ${OUT}`);
