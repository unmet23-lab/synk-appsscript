'use strict';

// Offline editorial production. No accounts, messaging, publication, or paid service calls.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const ROOT=path.resolve(__dirname,'../../../..');
const loom=require(path.join(ROOT,'tools/lib/loom.js'));
const brandFont=require(path.join(ROOT,'tools/lib/브랜드폰트.js'));
const {loadVisions}=require(path.join(ROOT,'tools/lib/비전정본.js'));
const C=loom.정본().색, W=2160,H=2700,M=loom.정본().율.단계.막.px*2;
const title='배운 것을 펼칠 곳. 함께 성장할 사람.';
const vision=loadVisions().shift;
const philosophy='올바른 가치관과 탄탄한 역량이 기회를 만나도록, 개인과 조직을 연결합니다.';
const education='기관 강의와 기업 컨설팅으로 현장의 역량과 일하는 방식을 발전시킵니다.';
const advertising='브랜딩과 광고로 기업의 가치를 알리고, 고객과 연결합니다.';
const connection='유학부터 취업까지 교육기관과 기업을 연결해, 개인이 배운 것을 펼치고 역량을 발휘할 기회를 넓힙니다.';
const sources=new Map();
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function read(rel,mime){const b=fs.readFileSync(path.join(ROOT,rel));sources.set(rel,{path:rel,sha256:hash(b),bytes:b.length});return mime?`data:${mime};base64,${b.toString('base64')}`:b.toString('utf8');}
const kit='docs/홍보물/마케팅실행_20260909/브랜드킷';
for(const rel of ['AGENTS.md','docs/AI_운영원칙.md','DESIGN.md','docs/SYNK_철학.md','docs/비전_정본.md','docs/디자인_토큰.json','docs/브랜드_폰트_정본.md','docs/로고_중립색_정본_v1.md','docs/명품_기준_v1.md','docs/마케팅/SHIFT.md','docs/SHIFT/관리자연수_아웃라인_v0.md','docs/SHIFT/첫30일_체크리스트_v1.md',`${kit}/사용규칙.md`])read(rel);
const canon=read('docs/SYNK_철학.md');
for(const exact of [philosophy,education,advertising,connection])if(!canon.includes(exact))throw new Error('Current copy drift: '+exact);
const placements=JSON.parse(read(`${kit}/배치명세.json`)).items;
const logos={};
for(const variant of ['Paper','Ink']){const p=placements.find(x=>x.brand==='SHIFT'&&x.variant===variant);const rel=`${kit}/${p.file}`;logos[variant]={...p,path:rel,uri:read(rel,'image/png')};if(sources.get(rel).sha256!==p.sha256)throw new Error('Logo hash mismatch');}
const fonts={medium:read('docs/브랜드_폰트/InterTight/InterTight-Medium.ttf','font/ttf'),bold:read('docs/브랜드_폰트/InterTight/InterTight-Bold.ttf','font/ttf')};
read('docs/브랜드_폰트/SUIT/SUIT-Variable.woff2');
const licenses=[['SUIT-OFL.txt','docs/브랜드_폰트/SUIT/LICENSE_OFL.txt'],['InterTight-OFL.txt','docs/브랜드_폰트/InterTight/OFL.txt']].map(([name,p])=>({name,text:read(p)}));
const dark=read('docs/Loom_자산/구움/펠트_어두운판.webp','image/webp');
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const fontCSS=`${brandFont.면()}\n@font-face{font-family:'Inter Tight';src:url('${fonts.medium}') format('truetype');font-weight:500;font-display:block}@font-face{font-family:'Inter Tight';src:url('${fonts.bold}') format('truetype');font-weight:700;font-display:block}`;
const textItems=[];
function text(lines,y,size,{weight=500,color=C.Paper,leading=1.3,role='body'}={}){if(!Array.isArray(lines))lines=[lines];return lines.map((line,i)=>{const id='t'+(textItems.length+1);textItems.push({id,text:line,size,weight,role});const safe=esc(line).replace(/[A-Za-z0-9“”.,·…]+/g,s=>`<tspan font-family="Inter Tight" font-weight="${weight>=700?700:500}">${s}</tspan>`);return `<text id="${id}" x="${M}" y="${y+i*size*leading}" font-size="${size}" font-weight="${weight}" fill="${color}" data-role="${role}">${safe}</text>`;}).join('');}
const visionLines=['개인과 조직의 성장이','서로의 기회가 되는','미래를 만듭니다.'];
if(visionLines.join(' ')!==vision.headline)throw new Error('Exact vision reflow mismatch');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}"><defs><style>${fontCSS}text{font-family:'SUIT Variable',sans-serif;letter-spacing:-.035em;font-synthesis:none}</style></defs><rect width="${W}" height="${H}" fill="${C['Ink Deep']}"/><image href="${dark}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice" opacity=".50"/><image href="${logos.Paper.uri}" x="${M}" y="180" width="920" height="${920*logos.Paper.height/logos.Paper.width}"/>${text(visionLines,795,130,{weight:900,leading:1.3,role:'official-vision'})}<path d="M${M} 1300H${W-M}" stroke="${C['Deep Wool']}" stroke-width="3"/>${text(['배운 것을 펼칠 곳.','함께 성장할 사람.'],1518,104,{weight:800,leading:1.38,role:'title'})}${text('기관·기업의 성장',1935,88,{weight:800,role:'axis'})}${text('강의·컨설팅·브랜딩·광고',2060,78,{color:C.Stone})}${text('개인이 역량을 펼칠 기회',2305,88,{weight:800,role:'axis'})}${text('유학부터 취업까지의 연결',2430,78,{color:C.Stone})}</svg>`;
const sections=[
  {heading:null,paragraphs:[vision.headline,'안녕하세요, SYNK SHIFT입니다.',philosophy]},
  {heading:'기관·기업의 성장',paragraphs:[education,advertising]},
  {heading:'개인이 역량을 펼칠 기회',paragraphs:[connection]},
  {heading:'지금 준비하고 있는 것',paragraphs:['현재는 자체 제작물과 교육·지원 설계를 만들고 확인하고 있습니다. 관리자 연수 아웃라인과 첫 30일 체크리스트는 초안 단계입니다. 이미 운영한 연수나 고객의 성과를 소개하는 것은 아닙니다.','AI와 회사를 만드는 과정은 유호의 개인 채널에서 별도로 나눕니다. 이곳에서는 SYNK SHIFT의 사업 방향과 협업 안내를 전하겠습니다.']},
  {heading:'협업은 구체적인 일에서 시작합니다',paragraphs:['기관과 기업은 어떤 업무가 달라져야 하는지, 개인은 어떤 배움을 어디에서 펼치고 싶은지. 그 이야기에서 출발해 범위와 담당, 필요한 조건과 다음 단계를 확인합니다.','협업 주제와 필요한 범위를 간단히 남겨 주세요. 공개 댓글에는 개인정보나 비공개 업무 자료를 남기지 말아 주세요.','서비스별 진행 가능 여부·담당·지원 범위·조건은 현재 준비 상태에 맞춰 별도로 확인합니다. 소개한 방향이 입학·취업이나 사업 성과를 보장하는 것은 아닙니다.',vision.subtext]}
];
const body=sections.map(s=>[s.heading,...s.paragraphs].filter(Boolean).join('\n\n')).join('\n\n');
const inquiry='기관 강의·기업 컨설팅·브랜딩·광고, 유학·취업 연계와 관련한 연락을 받습니다.\n\n협업 주제와 필요한 범위를 간단히 남겨 주세요. 공개 댓글에는 개인정보나 비공개 업무 자료를 남기지 말아 주세요.\n\n진행 가능 여부·범위·조건은 현재 준비 상태에 맞춰 별도로 확인합니다.';
const alt='어두운 펠트 바탕에 공식 SYNK SHIFT 로고. 공식 비전 “개인과 조직의 성장이 서로의 기회가 되는 미래를 만듭니다.”가 가장 크게 적혀 있다. 아래에는 “배운 것을 펼칠 곳. 함께 성장할 사람.”과 두 사업 축이 이어진다. 기관·기업의 성장은 강의·컨설팅·브랜딩·광고, 개인이 역량을 펼칠 기회는 유학부터 취업까지의 연결로 설명한다. 페이지 번호 없는 한 장짜리 회사 방향 안내이며 실제 고객 성과나 서비스 개시를 보여 주는 화면이 아니다.';
const articleHTML=sections.map((s,i)=>`<section${s.heading?'':' class="opening"'}>${s.heading?`<h2>${esc(s.heading)}</h2>`:''}${s.paragraphs.map((p,j)=>`<p${i===0&&j===0?' class="vision"':''}>${esc(p)}</p>`).join('')}</section>`).join('');
function write(name,value){fs.writeFileSync(path.join(__dirname,name),value);}
async function build(){
  fs.mkdirSync(path.join(__dirname,'qa'),{recursive:true});fs.mkdirSync(path.join(__dirname,'licenses'),{recursive:true});
  for(const l of licenses)write('licenses/'+l.name,l.text);
  write('대표.svg',svg);
  write('대표.html',`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${loom.css({지면:'부품만'})}html,body{margin:0;padding:0;width:100%;background:${C['Ink Deep']}}body>svg{display:block;width:100%;height:auto}</style>${svg}</html>`);
  write('첫소식-게시본문.txt',body+'\n');write('문의안내.txt',inquiry+'\n');
  write('첫소식.md',`# ${title}\n\n> 카카오톡 채널 SYNK SHIFT 전용 첫 소식 · 로컬 원고, 미게시\n> 아래 본문은 제목과 분리했습니다. 읽기 HTML의 제작 표시·다운로드 링크는 공개 본문에 포함하지 않습니다.\n\n## 게시 본문\n\n${body}\n\n## 문의 안내 짧은본\n\n${inquiry}\n\n## 제작·게시 경계\n\n- 완결 소식 1편, 문의 안내 1개와 단독 이미지 1장입니다. 기존 SHIFT 캐러셀의 1/7 표시를 떼어낸 편집본이 아니라 동일한 공식 자산을 사용한 새 정적 조판입니다. 새 슬로건을 정본화하지 않았습니다.\n- 실제 상담 개시·응답시간·입학·취업·공인 자격·고객 성과를 약속하지 않습니다. 문의 원고는 채널 내 어떤 입력칸에도 저장하지 않았습니다.\n- 이미지 2160×2700은 제작 해상도이며 카카오 공식 권장 규격 확인이나 업로더 통과 결과가 아닙니다. 실제 소식 편집기의 제목·본문 한도·이미지 크롭·대체텍스트 지원은 별도 확인해야 합니다.\n- 공개 URL·발행 ID 없음. 구독자 메시지·비즈니스 심사·광고·유료 도구·계정 설정은 사용하지 않았습니다.\n`);
  write('대체텍스트.md',`# 카카오 첫 소식 이미지 대체 텍스트\n\n## 대표.png\n\n${alt}\n\n현재 카카오 편집기의 대체텍스트 입력 지원은 확인하지 않았습니다. 지원되지 않는 경우에도 게시 본문에서 비전과 두 사업 축의 같은 의미를 읽을 수 있습니다.\n`);
  write('index.html',`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · SYNK SHIFT</title><style>${fontCSS}:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:${C.Paper};color:${C.Ink};font-family:'Inter Tight','SUIT Variable',sans-serif;font-weight:500;font-synthesis:none}main{max-width:1160px;margin:auto;padding:48px 32px 80px}header{padding-bottom:32px;border-bottom:1px solid ${C.Stone}}header img{width:270px;max-width:100%;height:auto}.meta{font-size:14px;color:${C['Deep Wool']};line-height:1.6}h1{font-size:42px;line-height:1.22;letter-spacing:-.04em;font-weight:800;max-width:900px;margin:32px 0 16px}.layout{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(280px,.8fr);gap:56px;margin-top:40px}article{min-width:0}section{margin:0 0 36px}h2{font-size:23px;line-height:1.4;letter-spacing:-.035em;font-weight:800;margin:0 0 16px}p{font-size:18px;line-height:1.75;word-break:keep-all;overflow-wrap:anywhere;margin:0 0 18px}.vision{font-size:23px;line-height:1.5;font-weight:800;letter-spacing:-.035em}aside figure{margin:0}aside img{display:block;width:100%;height:auto}figcaption{font-size:14px;line-height:1.6;color:${C['Deep Wool']};margin-top:12px}.inquiry{margin-top:32px;padding:24px;background:${C.Oat};border-radius:8px}.inquiry p{font-size:17px}.files{margin-top:32px;padding-top:24px;border-top:1px solid ${C.Stone}}.files a{display:inline-block;margin:0 18px 12px 0;color:${C['Lapis Deep']};font-size:16px;line-height:1.6;text-underline-offset:4px}a:focus-visible{outline:3px solid ${C['Lapis Deep']};outline-offset:4px}@media(max-width:760px){main{padding:28px 24px 48px}header img{width:240px}h1{font-size:34px}.layout{grid-template-columns:1fr;gap:28px;margin-top:32px}.inquiry{padding:20px}aside{max-width:460px}h2{font-size:22px}}</style><main><header><img src="${logos.Ink.uri}" alt="SYNK SHIFT 공식 로고"><p class="meta">카카오톡 채널 첫 소식 · 읽기 확인용 · 미게시</p><h1>${esc(title)}</h1></header><div class="layout"><article>${articleHTML}</article><aside><figure><a href="대표.html"><img src="대표.png" alt="${esc(alt)}"></a><figcaption>단독 이미지 1장 · 2160×2700<br>원본은 편집 가능한 HTML·SVG와 함께 제공합니다. 실제 카카오 표시 화면이 아닙니다.</figcaption></figure><section class="inquiry" id="inquiry"><h2>문의 안내 짧은본</h2>${inquiry.split('\n\n').map(p=>`<p>${esc(p)}</p>`).join('')}</section></aside></div><nav class="files" aria-label="로컬 제작 파일"><a href="첫소식-게시본문.txt">게시 본문</a><a href="문의안내.txt">문의 안내</a><a href="대표.png">이미지 PNG</a><a href="대표.svg">편집 SVG</a><a href="대체텍스트.md">대체텍스트</a><a href="검증결과.md">검증 결과</a></nav><p class="meta">공개 URL·발행 ID 없음. 이 화면의 제작 표시는 공개 원고와 분리되어 있습니다.</p></main></html>`);
  const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:W,height:H},deviceScaleFactor:1});const external=[];
  page.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url());});
  const ready=async()=>page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(x=>x.decode()));});
  await page.goto(pathToFileURL(path.join(__dirname,'대표.html')).href);await ready();
  const boxes=await page.locator('svg text').evaluateAll(ns=>ns.map(e=>{const r=e.getBoundingClientRect();return {id:e.id,text:e.textContent,x:r.x,y:r.y,width:r.width,height:r.height};}));
  const overflow=boxes.filter(b=>b.x<M-1||b.x+b.width>W-M+1||b.y<0||b.y+b.height>H);
  if(overflow.length)throw new Error('Text exceeds safe layout '+JSON.stringify(overflow));
  const cdp=await page.context().newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');const {root}=await cdp.send('DOM.getDocument');const actualFonts=[];
  for(const b of boxes){const node=await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector:'#'+b.id});const f=await cdp.send('CSS.getPlatformFontsForNode',{nodeId:node.nodeId});actualFonts.push({id:b.id,fonts:f.fonts});}
  await cdp.detach();await page.screenshot({path:path.join(__dirname,'대표.png'),animations:'disabled'});
  await page.setViewportSize({width:390,height:488});await page.screenshot({path:path.join(__dirname,'qa/대표-390.png'),animations:'disabled'});
  // Keep Korean title phrases intact at narrow widths; do not split 성장 mid-word.
  const readingFile=path.join(__dirname,'index.html');
  fs.writeFileSync(readingFile,fs.readFileSync(readingFile,'utf8').replace('h1{font-size:42px','h1{word-break:keep-all;text-wrap:balance;font-size:42px'));
  const reading=[];
  for(const width of [1280,390]){await page.setViewportSize({width,height:900});await page.goto(pathToFileURL(path.join(__dirname,'index.html')).href);await ready();const data=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,images:[...document.images].map(i=>({complete:i.complete,width:i.naturalWidth})),links:[...document.querySelectorAll('a[href]')].map(a=>a.getAttribute('href'))}));reading.push(data);if(data.scrollWidth>width||data.images.some(i=>!i.complete||!i.width))throw new Error('Reading HTML failed');await page.screenshot({path:path.join(__dirname,`qa/읽기-${width}-전체.png`),fullPage:true,animations:'disabled'});await page.screenshot({path:path.join(__dirname,`qa/읽기-${width}-첫화면.png`),animations:'disabled'});await page.locator('#inquiry').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(__dirname,`qa/읽기-${width}-문의.png`),animations:'disabled'});}
  await browser.close();
  const drift=[...sources.values()].filter(s=>hash(fs.readFileSync(path.join(ROOT,s.path)))!==s.sha256).map(s=>s.path);
  const manifest={title,brand:'SYNK SHIFT',platform:'KakaoTalk Channel',status:'local-rendered-unpublished',builtAt:new Date().toISOString(),published:false,publicURL:null,accountOperations:[],paidTools:[],approval:'not inferred',officialCopy:{vision:vision.headline,subtext:vision.subtext,philosophy,education,advertising,connection},copy:{body:'첫소식-게시본문.txt',bodyCharacters:[...body].length,inquiry:'문의안내.txt',inquiryCharacters:[...inquiry].length,titleCharacters:[...title].length},visual:{png:'대표.png',svg:'대표.svg',html:'대표.html',width:W,height:H,sha256:hash(fs.readFileSync(path.join(__dirname,'대표.png'))),alt,composition:'new standalone deterministic composition; no pagination; exact supplied assets',logo:logos.Paper.path,logoSHA256:logos.Paper.sha256,textItems,textBBoxes:boxes,overflow,actualFonts,mobile:'qa/대표-390.png',sizeClaim:'production resolution, not verified Kakao specification'},readingHTML:{file:'index.html',viewports:reading,externalRequests:external},sources:[...sources.values()],sourceDriftAtEnd:drift,remaining:['actual Kakao title/body fields and length limits','actual uploader crop and mobile rendering','actual alt-text support','publication and user approval not performed']};
  write('manifest.json',JSON.stringify(manifest,null,2)+'\n');
  if(drift.length||external.length)throw new Error('Source drift or external requests');
  process.stdout.write(JSON.stringify({png:'대표.png',textBoxes:boxes.length,sourceCount:sources.size,sourceDrift:drift,externalRequests:external,bodyCharacters:[...body].length,inquiryCharacters:[...inquiry].length,visualQA:'manual review pending'},null,2)+'\n');
}
build().catch(e=>{console.error(e);process.exitCode=1;});
