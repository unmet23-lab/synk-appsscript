#!/usr/bin/env node
// 아틀라스 학습자 칸 짜임 시안의 비교 쪽(한 장짜리 HTML)을 낸다(2026-11-16).
//   node 비교쪽.mjs <찍은 폴더(찍기.cjs 출력)> <비교자료.json> <낼 HTML>
//   그림은 jpg로 줄여 쪽 안에 싣는다. 낸 뒤 `node tools/lib/브랜드폰트.js --심기 <낼 HTML>`로 글꼴을 심는다.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const [찍은, 자료파일, 낼] = process.argv.slice(2);
if (!낼) { console.error('쓰기: node 비교쪽.mjs <찍은 폴더> <비교자료.json> <낼 HTML>'); process.exit(1); }
const 자료 = JSON.parse(fs.readFileSync(자료파일, 'utf8'));
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// png → jpg(폭 상한) base64. 파이썬 PIL로 줄인다.
const jpg = (파일, 폭) => {
  const out = execFileSync('python', ['-I', '-X', 'utf8', '-c', `import sys,io,base64
from PIL import Image
im=Image.open(sys.argv[1]).convert('RGB'); w=int(sys.argv[2])
if im.width>w: im=im.resize((w,round(im.height*w/im.width)),Image.LANCZOS)
b=io.BytesIO(); im.save(b,'JPEG',quality=84,optimize=True,progressive=True); sys.stdout.write(base64.b64encode(b.getvalue()).decode())`, path.join(찍은, 파일), String(폭)], { maxBuffer: 64 << 20 }).toString();
  return `data:image/jpeg;base64,${out}`;
};
const 잰 = (키, m) => JSON.parse(fs.readFileSync(path.join(찍은, `${키}-${m}.json`), 'utf8'));
const 점 = v => v == null ? '—' : esc(v);

const 판들 = 자료.판.map(p => ({ ...p, d: 잰(p.키, 'd'), m: 잰(p.키, 'm') }));
// 맹검표: [{ 제목, 글?, 판: [{ 키, 컴퓨터: {구별, 읽힘, 임팩트, 전후, 회사, 글, 판정, 순위}, 휴대폰: {…} }] }] — 회차마다 한 표
const 이름 = 키 => (자료.판.find(p => p.키 === 키) || {}).이름 || 키;
const 점수표 = (자료.맹검표 || []).map(t => `<div class="col"><h3>${esc(t.제목)}</h3>${t.글 ? `<p>${t.글}</p>` : ''}</div>
<div class="tablebox"><table><thead><tr><th></th><th>기기</th><th class="n">구별</th><th class="n">읽힘</th><th class="n">임팩트</th><th class="n">전후 견줌</th><th class="n">회사 확신</th><th>글 양</th><th>판정</th><th class="n">순위</th></tr></thead><tbody>
${t.판.map(p => { const 기기들 = ['컴퓨터', '휴대폰'].filter(d => p[d]); return 기기들.map((기기, i) => { const s = p[기기]; const 추천 = (자료.판.find(x => x.키 === p.키) || {}).추천; return `<tr${추천 ? ' class="pick"' : ''}>${i === 0 ? `<th rowspan="${기기들.length}">${esc(이름(p.키))}</th>` : ''}<td class="ref">${기기}</td><td class="n">${점(s.구별)}</td><td class="n">${점(s.읽힘)}</td><td class="n">${점(s.임팩트)}</td><td class="n">${점(s.전후)}</td><td class="n">${점(s.회사)}</td><td>${점(s.글)}</td><td>${점(s.판정)}</td><td class="n">${점(s.순위)}</td></tr>`; }).join(''); }).join('\n')}
</tbody></table></div>`).join('\n');
const 잰표 = `<div class="tablebox"><table><thead><tr><th></th><th class="n">칸 높이 · 컴퓨터</th><th class="n">칸 높이 · 휴대폰</th><th class="n">쪽 본문 · 컴퓨터(관문 7)</th><th class="n">쪽 본문 · 휴대폰(관문 10)</th></tr></thead><tbody>
${판들.map(p => `<tr><th>${esc(p.이름)}</th><td class="n">${Math.round(p.d.h).toLocaleString('en-US')}px</td><td class="n">${Math.round(p.m.h).toLocaleString('en-US')}px</td><td class="n">${p.d.bodyScreens}화면</td><td class="n">${p.m.bodyScreens}화면</td></tr>`).join('\n')}
</tbody></table></div>`;
const 판칸 = 판들.map(p => `<section id="${p.키}">
<div class="col"><p class="small">${esc(p.꼬리)}</p><h2>${esc(p.이름)}${p.추천 ? ' <span class="badge">추천</span>' : ''}</h2><p>${esc(p.설명)}</p>${p.고친것 ? `<ul>${p.고친것.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}${(p.말 || []).map(q => `<blockquote>${esc(q)}</blockquote>`).join('')}</div>
<figure><div class="stage"><img src="${jpg(`${p.키}-d-sec.png`, 1440)}" alt="${esc(p.이름)} — 컴퓨터 화면(폭 1440)"></div><figcaption>컴퓨터 화면, 폭 1440px</figcaption></figure>
<figure><div class="stage phone"><img src="${jpg(`${p.키}-m-sec.png`, 780)}" alt="${esc(p.이름)} — 휴대폰 화면(폭 390)"></div><figcaption>휴대폰 화면, 폭 390px, 학습자 칸 전체</figcaption></figure>
</section>`).join('\n');

const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>아틀라스 학습자 칸 시안</title>
<style>
:root{--paper:#fff;--ink:#0b0b0d;--mute:#5f636b;--line:#e3e4e8;--panel:#f4f5f7;--stage:#08090c;--hot:#c2412f;--pick:#3d6bc9;
--f:'SUIT Variable','Pretendard','Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif;--s1:13px;--s2:15px;--s3:17px;--s4:22px;--s5:30px;--s6:clamp(32px,5vw,48px)}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--paper:#08090c;--ink:#fafaf9;--mute:#a0a3ab;--line:#26272c;--panel:#121317;--stage:#000;--hot:#ff9385;--pick:#86a8ee;color-scheme:dark}}
:root[data-theme="dark"]{--paper:#08090c;--ink:#fafaf9;--mute:#a0a3ab;--line:#26272c;--panel:#121317;--stage:#000;--hot:#ff9385;--pick:#86a8ee;color-scheme:dark}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--f);font-size:var(--s3);line-height:1.72;word-break:keep-all;overflow-wrap:anywhere;-webkit-font-smoothing:antialiased}
.wrap{max-width:1180px;margin:0 auto;padding:56px 16px 96px;display:flex;flex-direction:column;gap:80px}
@media (min-width:720px){.wrap{padding-inline:24px}}
.col{max-width:700px;display:flex;flex-direction:column;gap:16px}
h1,h2,h3,p,ul,ol,figure{margin:0}
h1{font-size:var(--s6);line-height:1.18;font-weight:700;text-wrap:balance}
h2{font-size:var(--s5);line-height:1.25;font-weight:700}
h3{font-size:var(--s4);line-height:1.35;font-weight:700}
.lead{font-size:var(--s4);line-height:1.55}
.small{font-size:var(--s1);color:var(--mute);line-height:1.6}
b{font-weight:600}
section{display:flex;flex-direction:column;gap:24px}
.badge{display:inline-block;vertical-align:middle;margin-left:8px;padding:2px 10px;border-radius:999px;background:var(--hot);color:#fff;font-size:var(--s1);font-weight:600;line-height:1.6}
.box{border-top:2px solid var(--ink);padding-top:18px;display:flex;flex-direction:column;gap:12px;max-width:760px}
.stage{background:var(--stage);border:1px solid var(--line);overflow:hidden}
.stage img{display:block;width:100%;height:auto}
.stage.phone{display:flex;justify-content:center;padding:24px 0}
.stage.phone img{width:min(390px,100%)}
figure{display:flex;flex-direction:column;gap:8px}
figcaption{font-size:var(--s1);color:var(--mute)}
.tablebox{overflow-x:auto;border-top:1px solid var(--ink)}
table{border-collapse:collapse;width:100%;font-size:var(--s2);line-height:1.5;font-variant-numeric:tabular-nums}
th,td{text-align:left;padding:10px 14px 10px 0;border-bottom:1px solid var(--line);vertical-align:top}
th{font-weight:600;white-space:nowrap}
td.n,th.n{text-align:right;padding-right:18px;white-space:nowrap}
td{white-space:nowrap}td.ref{color:var(--mute)}
tr.pick th,tr.pick td{color:var(--hot)}
blockquote{margin:0;padding:2px 0 2px 16px;border-left:2px solid var(--line);color:var(--mute);font-size:var(--s2);line-height:1.65}
ul,ol{padding-left:20px;display:flex;flex-direction:column;gap:8px}
.jump{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:var(--s2)}.jump a{color:var(--mute)}
</style></head><body><div class="wrap">
<header class="col">
<p class="small">${esc(자료.날)} · 공개하지 않은 로컬 시안입니다</p>
<h1>${esc(자료.제목)}</h1>
${(자료.머리 || []).map((p, i) => `<p${i === 0 ? ' class="lead"' : ''}>${p}</p>`).join('\n')}
<p class="jump">${판들.map(p => `<a href="#${p.키}">${esc(p.이름)}</a>`).join('')}<a href="#scores">맹검 점수</a><a href="#next">고르신 뒤</a></p>
</header>
<div class="box"><h3>고르실 것</h3>${(자료.추천 || []).map(p => `<p>${p}</p>`).join('')}</div>
${판칸}
<section id="scores"><div class="col"><h2>맹검 점수</h2>${(자료.맹검설명 || []).map(p => `<p>${p}</p>`).join('')}</div>
${점수표}
<div class="col"><h3>잰 값</h3><p>학습자 칸의 높이와, 쪽 본문(첫 화면부터 질문창 앞까지)의 길이입니다. 같은 도구로 같은 창 크기에서 쟀습니다.</p></div>${잰표}</section>
<section id="next"><div class="col"><h2>고르신 뒤</h2><ul>${(자료.다음 || []).map(x => `<li>${x}</li>`).join('')}</ul></div></section>
</div></body></html>`;
fs.writeFileSync(낼, html);
console.log(path.basename(낼), (Buffer.byteLength(html) / 1048576).toFixed(2) + 'MB');
