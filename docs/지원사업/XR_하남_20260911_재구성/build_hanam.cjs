// Canonical SYNK tokens/assets -> authored IR -> existing font/Loom/PDF pipeline.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const tokens = JSON.parse(fs.readFileSync(path.join(root,'docs/디자인_토큰.json'),'utf8'));
const colors = Object.fromEntries(tokens.색.킷.map(x=>[x.이름,x.hex]));
const visions = require(path.join(root,'tools/lib/비전정본.js')).loadVisions();
const assetDir = path.join(root,'docs/홍보물/마케팅실행_20260909/브랜드킷/배치용');
const used = [];
function asset(file) { const p=path.isAbsolute(file)?file:path.join(assetDir,file); const b=fs.readFileSync(p); used.push({path:p,sha256:crypto.createHash('sha256').update(b).digest('hex')}); return 'data:image/png;base64,'+b.toString('base64'); }
const logos={lab:asset('SYNK-LAB-Ink.png'),synk:asset('SYNK-Ink.png'),paper:asset('SYNK-Paper.png')};
const screenshot=asset('C:/Users/q1212/Downloads/SYNK_신청서류_0901/모두의창업_이미지교체_20260909/새3장/03_app_첫흐름_합성검증.png');
const esc = s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const para = s=>`<p>${s}</p>`;
const tag = s=>`<span class="칩">${s}</span>`;
const block = (label,title,body)=>`<article class="block"><div class="eyebrow">${label}</div><h3>${title}</h3>${para(body)}</article>`;
const row=(a,b,c)=>`<div class="table-row"><div>${a}</div><div>${b}</div><div>${c}</div></div>`;
const stat=(n,l)=>`<div class="stat"><b>${n}</b><span>${l}</span></div>`;
const slides=[];
function slide(kicker,title,body,{cls='',note=''}={}) { slides.push(`<section class="slide ${cls}"><header><span${cls==='cover'?' class="칩"':''}>${kicker}</span><span>SYNK LAB · 2026.09</span></header><h1>${title}</h1><div class="content">${body}</div>${note?`<div class="source">${note}</div>`:''}<footer><span>SYNK · 대표 양유호 · 예비창업</span><span>${String(slides.length+1).padStart(2,'0')}</span></footer></section>`); }
require('./pages_hanam.cjs')({slide,logos,screenshot,visions,esc,para,tag,block,row,stat});
const css=`
/*@FONTS@*/
@page { size:338.667mm 190.5mm; margin:0; }
:root { --paper:${colors.Paper}; --ink:${colors.Ink}; --deep:${colors['Ink Deep']}; --muted:${colors['Deep Wool']}; --line:${colors.Stone}; --oat:${colors.Oat}; --coral:${colors.Coral}; --accent:${colors['Coral 3']}; }
@font-face{font-family:'SYNK Bracket';src:local('Malgun Gothic'),local('Apple SD Gothic Neo');unicode-range:U+300C-300D;}
*{box-sizing:border-box}html,body{margin:0;padding:0;color:var(--ink);background:var(--paper);font-family:'SYNK Bracket','Inter Tight','SUIT',sans-serif;-webkit-font-smoothing:antialiased;print-color-adjust:exact;-webkit-print-color-adjust:exact}
body{counter-reset:page}.slide{width:1280px;height:720px;padding:36px 64px 55px;position:relative;page-break-after:always;break-inside:avoid;background:var(--paper);overflow:hidden}.slide:last-child{page-break-after:auto}
.slide header{height:42px;display:flex;justify-content:space-between;font-size:13px;letter-spacing:.08em;color:var(--muted);border-bottom:1px solid var(--line)}
.slide h1{font-size:44px;line-height:1.23;font-weight:800;letter-spacing:-.035em;word-break:keep-all;text-wrap:balance;margin:30px 0 24px;max-width:1100px}
.slide h3{font-size:24px;line-height:1.4;margin:10px 0 12px;letter-spacing:-.025em;word-break:keep-all;text-wrap:balance;font-weight:800}
.slide p{font-size:20px;line-height:1.6;margin:0 0 15px;word-break:keep-all;text-wrap:pretty;color:var(--muted)}
.slide .content{position:relative}.slide strong{color:var(--ink);font-weight:800}.slide .eyebrow{font-size:13px;font-weight:600;letter-spacing:.06em;color:var(--accent)}
.slide .grid2{display:grid;grid-template-columns:1fr 1fr;gap:44px}.slide .grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:32px}.slide .block{padding-top:20px;border-top:2px solid var(--line)}
.slide .block p{font-size:19px}.slide .lead{font-size:24px;line-height:1.6;max-width:970px}.slide .small{font-size:16px;line-height:1.6}.slide .muted{color:var(--muted)}
.slide .strip{background:var(--oat);padding:18px 28px;margin-top:20px;font-size:20px;line-height:1.5;word-break:keep-all;border-left:4px solid var(--accent)}
.slide .source{position:absolute;left:64px;right:64px;bottom:64px;font-size:11px;line-height:1.5;color:var(--muted)}
.slide footer{position:absolute;bottom:24px;left:64px;right:64px;display:flex;justify-content:space-between;font-size:11px;color:var(--muted)}
.slide .logo{width:280px;height:auto;display:block}.slide .logo.hero{width:500px;margin:12px 0 36px}.slide.cover h1{font-size:51px;max-width:840px;margin-top:0}.slide.cover .lead{max-width:920px}
.slide .stats{display:flex;gap:42px;margin:25px 0}.slide .stat{display:flex;flex-direction:column;gap:8px}.slide .stat b{font-size:44px;font-weight:600;line-height:1.1;letter-spacing:-.03em}.slide .stat span{font-size:15px;color:var(--muted)}
.slide .table{margin-top:20px}.slide .table-row{display:grid;grid-template-columns:1fr 1.55fr 1.55fr;gap:25px;border-bottom:1px solid var(--line);padding:13px 0;font-size:19px;line-height:1.5;word-break:keep-all}.slide .table-row.head{font-size:13px;font-weight:600;color:var(--accent);padding-top:0}.slide .table-row>div:first-child{font-weight:800}
.slide .steps{display:grid;grid-template-columns:repeat(4,1fr);gap:24px;margin-top:25px}.slide .step{padding-top:20px;border-top:3px solid var(--line)}.slide .step .no{font-size:34px;line-height:1.2;font-weight:600;color:var(--accent)}.slide .step p{font-size:18px}.slide .step h3{font-size:23px}
.slide .phone-layout{display:grid;grid-template-columns:1fr 300px;gap:40px}.slide .phone-window{height:350px;overflow:hidden;border-radius:8px;background:var(--deep)}.slide .phone{width:300px;height:auto;display:block}.slide .caption{font-size:12px;text-align:center;margin-top:9px;line-height:1.45}
.slide .quote{font-size:32px;line-height:1.5;letter-spacing:-.035em;font-weight:800;color:var(--ink);margin:18px 0 25px;word-break:keep-all}.slide .timeline{margin-top:28px}.slide .milestone{display:grid;grid-template-columns:180px 1fr;gap:32px;padding:15px 0;border-top:1px solid var(--line)}.slide .milestone b{font-size:24px}.slide .milestone p{font-size:19px;margin:0}
.slide .dark{background:var(--deep)}.slide.closing{background:var(--deep);color:var(--paper)}.slide.closing h1,.slide.closing strong{color:var(--paper)}.slide.closing p,.slide.closing header,.slide.closing footer,.slide.closing .source{color:var(--paper)}.slide.closing .eyebrow{color:var(--line)}
.slide .vision{font-size:31px;line-height:1.4;letter-spacing:-.025em;max-width:970px;margin:18px 0}.slide .vision-sub{font-size:19px;line-height:1.65;max-width:970px}.slide .closing-logo{width:220px;margin:4px 0 12px}.slide .ask{margin-top:20px;padding-top:18px;border-top:1px solid var(--line)}
`;
const html=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>SYNK LAB · 하남 창업경진대회 사업계획서·IR</title><style>${css}</style></head><body>${slides.join('\n')}</body></html>`;
const out=path.join(__dirname,'_src_하남_사업계획서_IR_20260911.html'.replace('SYN K','하남_사업계획서_IR_20260911'));
fs.writeFileSync(out,html);
for(const rel of ['docs/디자인_토큰.json','docs/비전_정본.md','docs/지원사업/모두의창업_일반기술_20260910/신청서.md','docs/개원전판매_설계_v1.md']){const p=path.join(root,rel);used.push({path:p,sha256:crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')});}
fs.writeFileSync(path.join(__dirname,'sources.json'),JSON.stringify({date:'2026-09-11',pages:slides.length,sources:used},null,2));
console.log(JSON.stringify({source:out,pages:slides.length}));
