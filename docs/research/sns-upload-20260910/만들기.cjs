'use strict';
// 조사 원고를 기존 SYNK Loom 지면으로 렌더링한다. 외부 게시/서버 연결 없음.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'../../..');
const bundle=process.env.SNS_REPORT_NODE_MODULES || path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const {marked}=require(path.join(bundle,'marked'));
const loom=require(path.join(root,'tools/lib/loom.js'));
const font=require(path.join(root,'tools/lib/브랜드폰트.js'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const input=path.join(__dirname,'보고서.md');
const md=fs.readFileSync(input,'utf8');
const sources=[...md.matchAll(/<a id="(s\d+)"><\/a>/g)].map(x=>x[1]);
if(sources.length!==55 || new Set(sources).size!==55)throw Error('Expected 55 distinct source entries');
for(const m of md.matchAll(/\]\(#(s\d+)\)/g))if(!sources.includes(m[1]))throw Error('Missing source '+m[1]);
const inter=[['Regular',400],['Medium',500],['SemiBold',600],['Bold',700]].map(([n,w])=>{
 const p=path.join(root,`docs/브랜드_폰트/InterTight/InterTight-${n}.ttf`);
 return `@font-face{font-family:'Inter Tight';font-weight:${w};font-display:block;src:url(data:font/ttf;base64,${fs.readFileSync(p).toString('base64')}) format('truetype')}`;
}).join('\n');
const css=font.면()+inter+loom.css({지면:'밝은부품',범위:'.loom',천:null})+loom.계정컬렉션()+loom.마케팅실행();
// 기존 지면 색/폰트 유지. 좁은 화면에서 긴 출처 단어와 표가 넘치지 않도록만 보완.
const accessCss='.execution .editorial{overflow-wrap:anywhere}.execution .toolbar{flex-wrap:wrap;justify-content:flex-start}.execution .editorial td:first-child{min-width:7em}.execution .table-scroll{overflow-x:auto}.execution :target{scroll-margin-top:24px}';
let content=marked.parse(md).replace(/<h2>(\d+)\. /g,'<h2 id="section-$1">$1. ');
content=content.replace(/<table>/g,'<div class="table-scroll" tabindex="0" role="region" aria-label="플랫폼 비교표"><table>').replace(/<\/table>/g,'</table></div>');
const nav='<nav class="toolbar no-print" aria-label="보고서 바로가기"><a href="#section-2">플랫폼 비교</a><a href="#section-3">노출 영향</a><a href="#section-4">정지 사례</a><a href="#section-5">게시 대안</a><a href="#section-10">출처</a><a href="보고서.md" download>원문 받기</a></nav>';
const html=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SNS 자동 업로드와 계정 위험 비교 · SYNK</title><style>${css}${accessCss}</style></head><body class="account-collection execution">${nav}<main class="editorial"><p class="kicker">SYNK / RESEARCH / 2026.09.10</p>${content}</main></body></html>`;
fs.writeFileSync(path.join(__dirname,'보고서.html'),html);
async function check(){
 const {chromium}=require(path.join(bundle,'playwright'));
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage();
 const issues=[];page.on('pageerror',e=>issues.push(e.message));
 const result={sourceEntries:sources.length,sourceHash:hash(input),htmlHash:hash(path.join(__dirname,'보고서.html')),views:[],issues};
 fs.mkdirSync(path.join(__dirname,'검증'),{recursive:true});
 for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
  await page.setViewportSize({width,height});
  await page.goto(pathToFileURL(path.join(__dirname,'보고서.html')).href);
  await page.evaluate(()=>document.fonts.ready);
  const view=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,tables:document.querySelectorAll('table').length,missingAnchors:[...document.querySelectorAll('a[href^="#"]')].map(a=>a.getAttribute('href').slice(1)).filter(id=>!document.getElementById(id)),fontsLoaded:document.fonts.status,localLinks:[...document.querySelectorAll('a[href]')].map(a=>a.getAttribute('href')).filter(h=>!h.startsWith('#')&&!/^https?:/.test(h))}));
  if(view.scrollWidth>view.width)issues.push(name+': page overflow');
  if(view.missingAnchors.length)issues.push(name+': missing anchor');
  for(const link of view.localLinks)if(!fs.existsSync(path.resolve(__dirname,decodeURIComponent(link))))issues.push('Missing file '+link);
  await page.screenshot({path:path.join(__dirname,'검증',name+'-opening.png')});
  await page.locator('#section-2').evaluate(e=>e.scrollIntoView());
  await page.screenshot({path:path.join(__dirname,'검증',name+'-comparison.png')});
  result.views.push({name,...view});
 }
 await browser.close();
 fs.writeFileSync(path.join(__dirname,'검증','지면검사.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result,null,2));
 if(issues.length)process.exitCode=1;
}
if(process.argv.includes('--check'))check().catch(e=>{console.error(e);process.exitCode=1});
else console.log('Rendered report: '+path.join(__dirname,'보고서.html'));
