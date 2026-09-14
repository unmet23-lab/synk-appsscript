'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const {pathToFileURL}=require('node:url');
const ROOT=path.resolve(__dirname,'../../..');
const BASE=path.join(ROOT,'tools/patent-studio');
const OUT='C:/Users/q1212/.codex/visualizations/2026/09/11/01a08f0d-d3c5-7c41-9c85-d69384fa2412/IP_디딤돌_준비/미팅완성본/최종미팅가이드_20260915';
const NAME='SYNK_특허미팅_최종가이드';
const R=f=>fs.readFileSync(f,'utf8'),H=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const assets=path.join(BASE,'public/assets');
const data=(f,m)=>`data:${m};base64,${fs.readFileSync(f).toString('base64')}`;
async function main(){
 const qaFile=path.join(__dirname,'qa/meeting-ready.json');
 const qa=JSON.parse(R(qaFile));if(!qa.passed||!/^http:\/\/127\.0\.0\.1:\d+/.test(qa.baselineUrl))throw Error('Current meeting QA missing');
 for(const [file,hash] of Object.entries(qa.sourceSha256||qa.checks?.sourceSha256||{})){if(H(path.join(BASE,file))!==hash)throw Error('QA source changed: '+file);}
 const manifest=JSON.parse(R(path.join(assets,'manifest.json'))).manifest;
 const names=['suit.woff2','inter-tight.ttf','inter-tight-bold.ttf','inter-tight-semibold.ttf','dm-mono.ttf','bracket.ttf','tokens.css','mascot.webp'];
 for(const name of names){const x=manifest.find(a=>a.name===name);if(!x||H(path.join(assets,name))!==x.sha256||H(path.join(ROOT,x.source))!==(x.sourceSha256||x.sha256))throw Error('Changed asset '+name);}
 const logo=path.join(ROOT,'docs/홍보물/마케팅실행_20260909/브랜드킷/배치용/SYNK-Ink.png');
 const fonts=[['SUIT Variable','suit.woff2','100 900',''],['Inter Tight','inter-tight.ttf','500',''],['Inter Tight','inter-tight-semibold.ttf','600',''],['Inter Tight','inter-tight-bold.ttf','700 900',''],['DM Mono','dm-mono.ttf','500',''],['SYNK Bracket','bracket.ttf','100 900','unicode-range:U+300C-300D;']].map(([f,n,w,x])=>`@font-face{font-family:'${f}';src:url('${data(path.join(assets,n),n.endsWith('woff2')?'font/woff2':'font/ttf')}');font-weight:${w};font-display:block;${x}}`).join('');
 const loom=cp.execFileSync(process.execPath,[path.join(ROOT,'tools/lib/loom.js'),'--css','문서'],{encoding:'utf8',maxBuffer:8e6});
 const rhythm=loom.match(/:root\s*\{[^}]+\}/)?.[0];if(!rhythm)throw Error('Loom spacing missing');
 const baseCss=path.join(BASE,'grant-path-20260913/meeting-pair-20260914/style.css');
 const css=R(path.join(assets,'tokens.css'))+rhythm+fonts+R(baseCss)+R(path.join(__dirname,'guide.css'));
 const claimFile=path.join(BASE,'grant-path-20260913/targeted/CLAIM_DECISIONS.md');
 const claims=[...R(claimFile).matchAll(/^\*\*\[P1-0[1-7]\]\*\*[^\r\n]+/gm)].map(m=>m[0]);if(claims.length!==7)throw Error('P1 count');
 let md=R(path.join(__dirname,'GUIDE.md')).replace('{{P1_A}}',claims.slice(0,4).join('\n\n')).replace('{{P1_B}}',claims.slice(4).join('\n\n'));
 const slots={BASE_URL:qa.baseUrl,BASELINE_URL:qa.baselineUrl,CHECKED_AT:new Date(qa.checkedAt).toLocaleString('sv-SE',{timeZone:'Asia/Seoul'})+' KST'};
 for(const [k,v] of Object.entries(slots))md=md.replaceAll('{{'+k+'}}',v);
 if(/\{\{[A-Z_]+\}\}|공개\s*이력|공개\s*시점|unmet23|C:[\\/]Users/.test(md))throw Error('Unresolved or outbound private text');
 fs.mkdirSync(path.join(OUT,'검수'),{recursive:true});fs.mkdirSync(path.join(OUT,'자산'),{recursive:true});
 const images={logo,mascot:path.join(assets,'mascot.webp')};
 for(const name of ['before','after','ledger','replay']){const key=name==='before'?'beforeObject':name==='after'?'afterObject':name;if(!qa.screenshots[key])throw Error('Missing image '+key);images[name]=path.resolve(__dirname,qa.screenshots[key]);}
 let mdSource=md;for(const [k,f] of Object.entries(images)){const ext=path.extname(f);fs.copyFileSync(f,path.join(OUT,'자산',k+ext));mdSource=mdSource.replaceAll('asset:'+k,'자산/'+k+ext);}
 fs.writeFileSync(path.join(OUT,NAME+'.md'),mdSource);
 const {marked}=await import(pathToFileURL('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/marked/lib/marked.esm.js').href);
 const parts=md.split(/\r?\n<!-- page -->\r?\n/).map(s=>s.trim());
 let html=parts.map((p,i)=>`<article class="page final-guide${i===0?' cover':''}" id="p${i+1}"><header><span class="brand">SYNK / CORE</span><span>특허 미팅 최종 가이드 · 2026.09.15</span></header><main>${marked.parse(p)}</main><footer><span>대한민국 출원 검토 · 합성 시제품 시연</span><span class="page-num">${String(i+1).padStart(2,'0')} / ${parts.length}</span></footer></article>`).join('');
 for(const [k,f] of Object.entries(images))html=html.replaceAll('asset:'+k,data(f,f.endsWith('.webp')?'image/webp':'image/png'));
 const file=path.join(OUT,NAME+'.html');
 fs.writeFileSync(file,`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SYNK 특허 미팅 최종 가이드</title><style>${css}</style></head><body><nav aria-label="문서 도구"><a href="${qa.baselineUrl}">시제품 열기</a><a href="#p2">1. 질문</a><a href="#p3">2. 답변</a><a href="#p5">3. 시연</a><button onclick="window.print()">인쇄·PDF</button></nav>${html}</body></html>`);
 const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 let layout,expectedText,mobile;const errors=[],requests=[];
 try{const page=await browser.newPage({viewport:{width:1000,height:1300}});
 await page.route('**/*',r=>{if(/^https?:/.test(r.request().url())){requests.push(r.request().url());return r.abort();}return r.continue();});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(file).href);await page.evaluate(async()=>{await Promise.all(['500 16px "SUIT Variable"','800 32px "SUIT Variable"','500 16px "Inter Tight"','600 16px "Inter Tight"','800 32px "Inter Tight"','500 12px "DM Mono"','500 12px "SYNK Bracket"'].map(f=>document.fonts.load(f,'한글 SYNK 0123 「」')));await document.fonts.ready;});await page.emulateMedia({media:'print'});
 layout=await page.evaluate(()=>[...document.querySelectorAll('.page')].map(p=>{const main=p.querySelector('main').getBoundingClientRect(),foot=p.querySelector('footer').getBoundingClientRect();return {page:p.id,gap:Math.round(foot.top-main.bottom),outside:[...p.querySelectorAll('main *')].filter(x=>{const r=x.getBoundingClientRect();return r.width&&(r.left<main.left-2||r.right>main.right+2);}).map(x=>x.tagName+':'+x.textContent.slice(0,20))};}));
 const bad=layout.filter(x=>x.gap<18||x.outside.length);if(bad.length)throw Error(JSON.stringify({bad}));
 expectedText=await page.evaluate(()=>[...document.querySelectorAll('.page')].map(p=>[...p.querySelectorAll('main h1,main h2,main h3,main p,main th,main td,main li,main .flow>div,main .phrase,main .card b')].map(x=>x.innerText).filter(Boolean)));
 if(expectedText.flat().some(t=>t.includes('**'))||errors.length||requests.length)throw Error('Markup, JS or external request error');
 await page.pdf({path:path.join(OUT,NAME+'.pdf'),format:'A4',printBackground:true,preferCSSPageSize:true,tagged:true,outline:true});
 await page.emulateMedia({media:'screen'});await page.setViewportSize({width:390,height:844});mobile=await page.evaluate(()=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth,outside:[...document.querySelectorAll('main *')].filter(x=>{const r=x.getBoundingClientRect();return r.width&&(r.left<0||r.right>innerWidth+2);}).map(x=>x.tagName+':'+x.textContent.slice(0,20))}));if(mobile.documentWidth>392||mobile.outside.length)throw Error(JSON.stringify({mobile}));
 }finally{await browser.close();}
 const sourceFiles=['core.cjs','projection.cjs','temporal-evidence.cjs','store.cjs','public/app.js','public/index.html','grant-path-20260913/targeted/CLAIM_DECISIONS.md','grant-path-20260913/model-review-20260914/SECOND_REVIEW.md'];
 const record={name:NAME,generatedAt:new Date().toISOString(),pages:parts.length,pdfHash:H(path.join(OUT,NAME+'.pdf')),htmlHash:H(file),qaHash:H(qaFile),baseUrl:qa.baseUrl,baselineUrl:qa.baselineUrl,layout,expectedText,mobile,errors,externalRequests:requests.length,sourceHashes:Object.fromEntries(sourceFiles.map(f=>[f,H(path.join(BASE,f))])),assets:Object.fromEntries(Object.entries(images).map(([k,f])=>[k,H(f)])),fontAndTokenHashes:Object.fromEntries(names.map(n=>[n,H(path.join(assets,n))])),baseCssHash:H(baseCss),loomHash:H(path.join(ROOT,'tools/lib/loom.js'))};
 fs.writeFileSync(path.join(OUT,'검수/verification.json'),JSON.stringify(record,null,2));console.log(JSON.stringify({output:OUT,name:NAME,pages:record.pages,pdfHash:record.pdfHash,minGap:Math.min(...layout.map(x=>x.gap))},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
