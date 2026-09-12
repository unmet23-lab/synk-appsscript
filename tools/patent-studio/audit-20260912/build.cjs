'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{pathToFileURL}=require('node:url');
const data=require('./content.cjs');
const ROOT=path.resolve(__dirname,'../../..'),ASSETS=path.join(__dirname,'../public/assets');
const VROOT='C:/Users/q1212/.codex/visualizations/2026/09/11/01a08f0d-d3c5-7c41-9c85-d69384fa2412/IP_디딤돌_준비/미팅완성본';
const OUT=path.join(VROOT,'선행대조_종합검수_20260912'),QA=path.join(OUT,'검수');
const detailFiles=['CORE_PRIOR_ART.md','COMPANY_CANDIDATES.md','EVIDENCE_AUDIT.md','SUPPLEMENTAL_PRIOR_ART.md','KR_SEARCH_LOG.md'];
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function build(){
  fs.mkdirSync(QA,{recursive:true});
  const manifest=JSON.parse(fs.readFileSync(path.join(ASSETS,'manifest.json'),'utf8'));
  for(const a of manifest.manifest)if(hash(path.join(ASSETS,a.name))!==a.sha256||hash(path.join(ROOT,a.source))!==(a.sourceSha256||a.sha256))throw Error('Current asset mismatch: '+a.name);
  const templatePath=path.join(VROOT,'등록우선전략_20260912/SYNK_등록특허_1건을_위한_전략.html');
  const template=fs.readFileSync(templatePath,'utf8'),css=template.match(/<style>([\s\S]*?)<\/style>/)[1]+'\n@media screen and (max-width:760px){.cover h2{font-size:30px;letter-spacing:-1.3px;word-break:keep-all}.head h2{word-break:keep-all}}';
  const uri=(name,mime)=>`data:${mime};base64,${fs.readFileSync(path.join(ASSETS,name)).toString('base64')}`;
  const logo=uri('logo.webp','image/webp'),mascot=uri('mascot.webp','image/webp');
  const block=b=>b.type==='p'?`<p>${esc(b.text)}</p>`:b.type==='note'?`<aside><h3>${esc(b.title)}</h3><p>${esc(b.text)}</p></aside>`:b.type==='table'?`<table><thead><tr>${b.headers.map(x=>`<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${b.rows.map(r=>`<tr>${r.map(x=>`<td>${esc(x).replace(/\n/g,'<br>')}</td>`).join('')}</tr>`).join('')}</tbody></table>`:b.type==='steps'?`<ol class="steps">${b.items.map(([t,s])=>`<li><strong>${esc(t)}</strong><p>${esc(s)}</p></li>`).join('')}</ol>`:b.type==='sources'?`<p class="sources">${b.items.map(([t,u])=>`<a href="${esc(u)}">${esc(t)}</a>`).join(' · ')}</p>`:'';
  let html=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SYNK · 특허 후보 선행 대조와 종합 검수</title><style>${css}</style></head><body><div class="mobile"><b>SYNK · 특허 후보 대조</b><button id="menu" aria-expanded="false">목차</button></div><nav id="nav"><img src="${logo}" alt="SYNK LAB"><h1>선행 대조와<br>종합 검수</h1><small>2026.09.12 · CORE 0.5.0<br>기술 감사 · 출원 상담용 · ${data.pages.length}쪽</small><div class="actions"><button onclick="window.print()">인쇄 / PDF</button><a href="../현재_미팅본_20260912/00_여기서시작.html">미팅 시작 화면</a></div>${data.pages.map((p,i)=>`<a class="item" href="#${p.id}"><b>${String(i+1).padStart(2,'0')}</b><span>${esc(p.tag.split(' / ')[1])}</span></a>`).join('')}<small>상세 근거 5개</small>${detailFiles.map((f,i)=>`<a class="item detail" href="${f}" target="_blank"><b>${i+1}</b><span>${['Core 청구 관계·선행','회사 내 실제 후보','구현·비교 근거 검수','교차 분야 선행·심사기준','국내 검색 확인 범위'][i]}</span></a>`).join('')}</nav><main>${data.pages.map((p,i)=>`<article class="page ${i===0?'cover':''}" id="${p.id}"><div class="mast"><img src="${logo}" alt="SYNK LAB"><span>PATENT / TECHNICAL AUDIT</span></div>${i===0?`<img class="mascot" data-synk-mascot src="${mascot}" alt="생각하는 몽글">`:''}<header class="head"><div class="tag">${esc(p.tag)}</div><h2>${esc(p.title).replace(/\n/g,'<br>')}</h2><p class="lead">${esc(p.lead)}</p></header><section class="body">${p.blocks.map(block).join('')}</section><footer class="folio"><span>SYNK · 선행·후보·구현 근거 대조 · 2026.09.12</span><b>${String(i+1).padStart(2,'0')} / ${data.pages.length}</b></footer></article>`).join('')}</main><script>const n=document.querySelector('nav'),m=document.querySelector('#menu');m.onclick=()=>{n.classList.toggle('open');m.setAttribute('aria-expanded',String(n.classList.contains('open')))};n.querySelectorAll('.item').forEach(a=>a.onclick=()=>{n.classList.remove('open');m.setAttribute('aria-expanded','false')});document.addEventListener('keydown',e=>{if(e.key==='Escape'){n.classList.remove('open');m.setAttribute('aria-expanded','false')}});</script></body></html>`;
  const htmlPath=path.join(OUT,data.title+'.html'),pdfPath=path.join(OUT,data.title+'.pdf');
  fs.writeFileSync(htmlPath,html);
  let markdown='# SYNK · 특허 후보 선행 대조와 종합 검수\n\n2026-09-12 · Core 0.5.0 / 78628146a875 · 기술 감사 및 출원 상담용\n\n';
  for(const page of data.pages){markdown+='## '+page.title.replace(/\n/g,' ')+'\n\n'+page.lead+'\n\n';for(const b of page.blocks){if(b.type==='p')markdown+=b.text+'\n\n';if(b.type==='note')markdown+='**'+b.title+'**\n\n'+b.text+'\n\n';if(b.type==='table')markdown+='| '+b.headers.join(' | ')+' |\n| '+b.headers.map(()=>'---').join(' | ')+' |\n'+b.rows.map(r=>'| '+r.map(x=>x.replace(/\n/g,' / ')).join(' | ')+' |').join('\n')+'\n\n';if(b.type==='steps')markdown+=b.items.map(([t,s],i)=>`${i+1}. **${t}**: ${s}`).join('\n')+'\n\n';if(b.type==='sources')markdown+=b.items.map(([t,u])=>`[${t}](${u})`).join(' · ')+'\n\n';}}
  markdown+='## 상세 대조 근거\n\n'+detailFiles.map(f=>`- [${f}](${f})`).join('\n')+'\n';
  fs.writeFileSync(path.join(__dirname,'REPORT.md'),markdown);fs.writeFileSync(path.join(OUT,data.title+'.md'),markdown);
  for(const name of detailFiles)fs.copyFileSync(path.join(__dirname,name),path.join(OUT,name));
  const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[],external=[];
    page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>{if(/^https?:/.test(r.request().url())){external.push(r.request().url());return r.abort();}return r.continue();});
    await page.goto(pathToFileURL(htmlPath).href);await page.evaluate(()=>document.fonts.ready);await page.emulateMedia({media:'print'});
    const fit=await page.evaluate(()=>[...document.querySelectorAll('.page')].map(p=>{const gap=()=>p.querySelector('.folio').getBoundingClientRect().top-p.querySelector('.body').getBoundingClientRect().bottom;for(const c of ['compact','tight'])if(gap()<16)p.classList.add(c);return{id:p.id,className:p.className,gap:gap()};}));
    if(fit.some(f=>f.gap<15))throw Error('Overflow '+JSON.stringify(fit));
    for(const f of fit){const old=`class="page ${f.id==='decision'?'cover':''}" id="${f.id}"`;if(!html.includes(old))throw Error('Missing page '+f.id);html=html.replace(old,`class="${f.className}" id="${f.id}"`);}
    fs.writeFileSync(htmlPath,html);await page.pdf({path:pdfPath,format:'A4',printBackground:true,preferCSSPageSize:true});
    await page.emulateMedia({media:'screen'});await page.screenshot({path:path.join(QA,'desktop.png')});await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(QA,'mobile.png')});
    const checks=await page.evaluate(()=>({noOverflow:document.documentElement.scrollWidth===innerWidth,fonts:['SUIT Variable','Inter Tight','DM Mono'].map(f=>({family:f,loaded:document.fonts.check(`500 16px "${f}"`)})),images:[...document.images].every(i=>i.complete&&i.naturalWidth>0)}));
    await page.click('#menu');await page.locator('nav a[href="#meeting"]').click();if(await page.locator('nav').isVisible())throw Error('Mobile nav remained open');
    if(!checks.noOverflow||checks.fonts.some(f=>!f.loaded)||!checks.images||errors.length||external.length)throw Error(JSON.stringify({checks,errors,external}));
    fs.writeFileSync(path.join(QA,'verification.json'),JSON.stringify({generatedAt:new Date().toISOString(),pageCount:data.pages.length,fit,checks,errors,externalRequests:external.length,template:{path:templatePath,sha256:hash(templatePath)},assets:manifest.manifest.map(a=>({name:a.name,sha256:a.sha256}))},null,2));
    const files=fs.readdirSync(OUT).filter(n=>fs.statSync(path.join(OUT,n)).isFile()&&n!=='파일지문.json');
    fs.writeFileSync(path.join(OUT,'파일지문.json'),JSON.stringify({generatedAt:new Date().toISOString(),currentCore:'0.5.0',reviewedHead:'78628146a875c2891e78017ef9253f86af64532b',files:files.map(n=>({path:n,bytes:fs.statSync(path.join(OUT,n)).size,sha256:hash(path.join(OUT,n))})),producer:{content:hash(path.join(__dirname,'content.cjs')),build:hash(__filename)}},null,2));
    console.log(JSON.stringify({html:htmlPath,pdf:pdfPath,pages:data.pages.length,fit,checks,externalRequests:external.length}));
  }finally{await browser.close();}
}
build().catch(e=>{console.error(e);process.exitCode=1;});
