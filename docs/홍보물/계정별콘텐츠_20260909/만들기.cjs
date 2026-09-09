'use strict';
// 원고 → Loom 정적 지면, 계정별 게시 문안, 휴대 가능한 모아보기.
// --render 는 자신의 출력 디렉터리만 다시 만든다. 기존 소개서/영상은 읽기 전용.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {pathToFileURL} = require('node:url');
const sharp = require('sharp');
const {chromium} = require('playwright');
const ROOT = path.resolve(__dirname, '../../..');
const loom = require(path.join(ROOT, 'tools/lib/loom.js'));
const fonts = require(path.join(ROOT, 'tools/lib/브랜드폰트.js'));
const logo = require(path.join(ROOT, 'tools/lib/로고정본.js'));
const C = loom.정본().색;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const write = (p, s) => {fs.mkdirSync(path.dirname(p), {recursive:true});fs.writeFileSync(p, s, 'utf8');};
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const dataFile = path.join(__dirname, '콘텐츠원고.json');
const data = read(dataFile);
if (data.items.length !== 16) throw new Error('계정 분모는 16이어야 한다');
if (new Set(data.items.map(p => p.id)).size !== 16) throw new Error('중복 계정 ID');
for (const p of data.items) {
  if (!/^[0-9]{2}-[a-z-]+$/.test(p.id)) throw new Error('안전하지 않은 ID: '+p.id);
  if (!p.cards?.length || !p.caption || !p.title) throw new Error('미완성 원고: '+p.id);
  if (p.format === 'video' && !p.scenes?.length) throw new Error('영상 장면 없음: '+p.id);
  if (p.derivativeOf && !data.items.some(x=>x.id===p.derivativeOf)) throw new Error('없는 원작: '+p.id);
}
const SOURCE = path.join(ROOT, 'docs/홍보물/브랜드소개_20260909');
const assetSources = Object.fromEntries(['paper','ink','texture','mong','smile','curious','notebook','compass','letter','book','scissors','radio','window','classroom','roof','cafe','house','lake','meadow','city','clipboard','seal','logo','korean','headphones','night','moon','woolLogo','stitch'].map(k=>[k,path.join(SOURCE,'assets',k+'.webp')]));
Object.assign(assetSources, {
  labpage:path.join(SOURCE,'소개서_4K/lab-1.png'),
  labinside:path.join(SOURCE,'소개서_4K/lab-2.png'),
  shiftpage:path.join(SOURCE,'소개서_4K/shift-1.png'),
  pulsepage:path.join(SOURCE,'소개서_4K/pulse-1.png'),
  synkpage:path.join(SOURCE,'소개서_4K/synk-1.png'),
});
const selected = new Set(['stitch','paper','night','labpage']);
for (const p of data.items) for (const x of [...p.cards,...(p.scenes||[])]) {
  if(x.asset) selected.add(x.asset);
  for(const a of x.assets || []) selected.add(a);
}
function lockup(brand, large=false) {
  return `<div class="brand-lock">${logo.워드마크({판:'라이트',표현:'민',신호:'k',색갈래:'단색'})}${brand==='SYNK'?'':`<span class="division-label">${esc(brand)}${large?'<img src="../assets/stitch.webp" alt="">':''}</span>`}</div>`;
}
function card(p, x, i) {
  const layout = x.layout || 'lesson';
  const asset = x.asset;
  const footer = p.brand==='PULSE' ? 'PULSE · 소리와 장면' : p.brand==='SYNK' ? 'SYNK · 배움과 다음 경험' : p.language==='mn' ? 'SYNK LAB · Солонгос хэл' : p.account.split(' · ')[0].replace(/^@/,'');
  const image = asset && !['diptych','worksheet'].includes(layout) ? `<img class="hero-asset" data-asset="${esc(asset)}" src="../assets/${esc(asset)}.webp" alt="${esc(x.alt||'브랜드 제작 자산')}" decoding="sync">` : '';
  const diptych = layout==='diptych' ? `<div class="diptych">${(x.assets||['labpage','night']).map(a=>`<img data-asset="${esc(a)}" src="../assets/${esc(a)}.webp" alt="${esc(a==='night'?'PULSE 밤 장면':'완성된 LAB 소개서')}">`).join('')}</div>` : '';
  const lines=x.lines?.length?`<ul class="lines" data-count="${x.lines.length}">${x.lines.map(s=>`<li>${esc(layout==='worksheet'?s.replace(/:\s*_+/g,''):s)}${layout==='worksheet'?'<span class="write-line" aria-hidden="true"></span>':''}</li>`).join('')}</ul>`:'';
return `<div class="canvas-wrap"><section class="artboard" data-id="${p.id}" data-card="${i+1}" data-brand="${p.brand}" data-layout="${layout}">${lockup(p.brand,i===0)}<div class="copy"><p class="eyebrow">${esc(x.eyebrow)}</p><h1 class="headline">${esc(x.title)}</h1>${x.body?`<p class="body-copy">${esc(x.body)}</p>`:''}${x.kr?`<p class="kr" lang="ko">${esc(x.kr)}</p>`:''}${x.mn?`<p class="mn" lang="mn">${esc(x.mn)}</p>`:''}${lines}</div>${image}${diptych}<footer class="folio"><span>${esc(footer)}</span><span>${String(i+1).padStart(2,'0')} / ${String(p.cards.length).padStart(2,'0')}</span></footer></section></div>`;
}
const html = (title, body, relative='') => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><link rel="stylesheet" href="${relative}collection.css"></head><body class="account-collection">${body}</body></html>`;
const formatNames={video:'영상',carousel:'캐러셀',image:'이미지',text:'글 + 이미지',letter:'편지 + 표지'};
function articleHtml(article) {
  return article.split(/\n\s*\n/).map(s=>s.startsWith('## ')?`<h2>${esc(s.slice(3))}</h2>`:s.startsWith('# ')?`<h1>${esc(s.slice(2))}</h1>`:`<p>${esc(s).replaceAll('\n','<br>')}</p>`).join('\n');
}
function buildPages() {
  const inter=[['Regular',400],['Medium',500],['SemiBold',600],['Bold',700]].map(([n,w])=>`@font-face{font-family:'Inter Tight';font-weight:${w};font-display:block;src:url(data:font/ttf;base64,${fs.readFileSync(path.join(ROOT,`docs/브랜드_폰트/InterTight/InterTight-${n}.ttf`)).toString('base64')}) format('truetype')}`).join('\n');
  write(path.join(__dirname,'collection.css'), fonts.면()+inter+loom.css({지면:'밝은부품',범위:'.loom',천:null})+loom.계정컬렉션());
  const evidence = [];
  let student = '# 계정별 학생 접점 최종 원고 · 2026-09-09\n\n원천: `docs/홍보물/계정별콘텐츠_20260909/콘텐츠원고.json`. 이 문서는 동일 원고에서 자동 내보냈다. 원어민 감수 상태는 납품 폴더의 검증 기록을 따른다. 실제 학생 사례가 아닌 학습 예시다.\n\n';
  for(const p of data.items) {
    const folder=path.join(__dirname,p.id);
    write(path.join(folder,'cards.html'),html(p.title,`<nav class="toolbar"><a href="../index.html">모아보기</a><a href="게시문안.txt" download>게시 문안</a></nav>${p.cards.map((x,i)=>card(p,x,i)).join('')}<script>if(new URLSearchParams(location.search).has('export'))document.body.classList.add('export');function fit(){document.querySelectorAll('.canvas-wrap').forEach(x=>x.style.setProperty('--scale',x.clientWidth/1080))}fit();addEventListener('resize',fit)</script>`,'../'));
    write(path.join(folder,'게시문안.txt'),p.caption+'\n');
    write(path.join(folder,'제목.txt'),p.title+'\n');
    write(path.join(folder,'대체텍스트.txt'),p.alt+'\n');
    const missingNative = p.language==='mn'?'몽골어: 별도 모델 검토 기록 확인. 사람 원어민 감수 완료를 뜻하지 않음.':'한국어 원고. 청중 반응/사업 성과는 측정하지 않음.';
    write(path.join(folder,'사용안내.md'),`# ${p.platform} · ${p.account}\n\n${p.title}\n\n- 형식: ${formatNames[p.format]}\n- 상태: ${p.status==='preparation'?'준비용 · 개별 프로필/개설 확인 전':'개설 기록 있음 · 오늘 로그인/발행 기능 실사 아님'}\n- 원작: ${p.derivativeOf?`\`${p.derivativeOf}\`에서 파생`:'이번 컬렉션 원작'}\n- 받을 사람: ${p.target}\n- 가져갈 것: ${p.benefit}\n- 명품 기준의 적용: ${p.luxuryDecision}\n- 파일: ${p.format==='video'?'video.mp4를 업로드, 카드 이미지는 표지':'번호순 upload-01.jpg부터 사용'}. 게시문안.txt는 제목/내부 안내를 섞지 않은 복사 본문.\n- 고해상도: master-XX.png = 2160×2700. 업로드용: upload-XX.jpg = 1080×1350. 원본 자산의 실제 해상도는 사용자산.json 참조.\n- 언어: ${missingNative}\n- 외부 게시·계정 수정·광고비 집행 없음.\n${p.format==='letter'?'\nSubstack의 창업 이야기 섹션 원고입니다. 기존 초안/발송 설정은 변경하지 않았습니다. 본체 교육 섹션에 자동 발송하지 않습니다.\n':''}`);
    const guideFile=path.join(folder,'사용안내.md');
    let guide=fs.readFileSync(guideFile,'utf8').replace('사용자산.json 참조.','전체 꾸러미의 사용자산.json 참조.');
    if(p.format==='letter')guide=guide.replace('번호순 upload-01.jpg부터 사용. 게시문안.txt는 제목/내부 안내를 섞지 않은 복사 본문.','본문.md = 게시할 편지 전문. upload-01.jpg = 표지. 게시문안.txt = 편지를 소개하는 짧은 문안.');
    write(guideFile,guide);
    if(p.article){write(path.join(folder,'본문.md'),p.article+'\n');write(path.join(folder,'letter.html'),html(p.title,`<nav class="toolbar"><a href="../index.html">모아보기</a><a href="본문.md" download>편지 원고</a></nav><article class="article"><img src="upload-01.jpg" alt="${esc(p.alt)}">${articleHtml(p.article)}</article>`,'../'));}
    if(p.language==='mn') student+=`## ${p.id} · ${p.title}\n\n### 게시 본문\n\n${p.caption}\n\n### 카드/영상 화면의 말\n\n${[...p.cards,...(p.scenes||[])].map(x=>[x.eyebrow,x.title,x.body,x.kr,x.mn,...(x.lines||[])].filter(Boolean).join('\n\n')).join('\n\n---\n\n')}\n\n`;
    evidence.push({id:p.id,account:p.account,platform:p.platform,status:p.status,format:p.format,cards:p.cards.length,derivativeOf:p.derivativeOf||null,expectedVideo:p.format==='video',duration:p.scenes?.reduce((s,x)=>s+x.duration,0)||null});
  }
  write(path.join(ROOT,'.claude/skills/synk-content/references/계정별_20260909.md'),student);
  write(path.join(__dirname,'납품명세.json'),JSON.stringify({sourceSha256:hash(dataFile),recorded:evidence.filter(x=>x.status==='recorded').length,preparation:evidence.filter(x=>x.status==='preparation').length,items:evidence},null,2));
  const entries=data.items.map(p=>`<article class="entry" data-brand="${p.brand}" data-status="${p.status}"><a href="${p.id}/${p.format==='letter'?'letter':'cards'}.html"><img class="entry-cover" src="${p.id}/upload-01.jpg" alt="${esc(p.alt)}" loading="lazy"></a><p class="metadata">${esc(p.platform)} · ${esc(p.account)} · ${formatNames[p.format]}</p><h2>${esc(p.title)}</h2><span class="status">${p.status==='preparation'?'준비용 · 계정 확인 전':'개설 기록 있음'}</span><p>${esc(p.benefit)}</p><p class="metadata">${esc(p.luxuryDecision)}</p>${p.derivativeOf?`<p class="metadata">파생 원작: ${esc(p.derivativeOf)}</p>`:''}<div class="actions"><a class="download" href="${p.id}/${p.format==='letter'?'letter':'cards'}.html">${p.format==='letter'?'편지 읽기':'카드 전체'}</a>${p.format==='video'?`<a class="download" href="${p.id}/video.mp4" download>영상 받기</a>`:''}<a class="download" href="${p.id}/게시문안.txt" download>게시 문안</a><a class="download" href="packages/${p.id}.zip" download>계정 꾸러미</a></div>${p.format==='video'?`<details><summary>영상 재생</summary><video class="film" src="${p.id}/video.mp4" poster="${p.id}/upload-01.jpg" controls preload="none" playsinline></video></details>`:''}<details><summary>게시 문안 읽기</summary><p class="caption-preview">${esc(p.caption)}</p></details></article>`).join('');
  write(path.join(__dirname,'index.html'),html('SYNK · 계정별 콘텐츠 컬렉션',`<main class="collection-shell"><header class="collection-intro"><p class="kicker">SYNK · 2026.09.09 · CONTENT COLLECTION</p><h1>같은 기준.<br>서로 다른 한 편.</h1><p>LAB의 자기 말, SHIFT의 쓸 수 있는 판단, PULSE의 작은 감상. 각 계정이 건네는 것을 다르게 만들었습니다.</p><p>개설 기록 13곳 + 개별 프로필 확인 전 준비용 3곳. 게시한 콘텐츠가 아니라 완성 파일 모음입니다. PULSE 감상은 LAB YouTube 한 계정에 포함됩니다.</p><a class="download" href="계정별콘텐츠_전체.zip" download>전체 꾸러미 내려받기</a> <a class="download" href="읽어주세요.md">사용·검증 안내</a></header><nav class="filters" aria-label="브랜드 필터"><button type="button" data-filter="all" aria-pressed="true">전체 16</button>${['LAB','SHIFT','PULSE','SYNK'].map(b=>`<button type="button" data-filter="${b}" aria-pressed="false">${b}</button>`).join('')}<button type="button" data-filter="preparation" aria-pressed="false">준비용 3</button></nav><section class="collection-grid">${entries}</section></main><script>document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));document.querySelectorAll('.entry').forEach(x=>x.hidden=!(b.dataset.filter==='all'||x.dataset.brand===b.dataset.filter||x.dataset.status===b.dataset.filter));}));</script>`));
  // The extracted gallery must not link to its own enclosing ZIP: it cannot
  // contain that archive recursively. Individual account ZIPs remain available.
  const galleryFile=path.join(__dirname,'index.html');
  write(galleryFile,fs.readFileSync(galleryFile,'utf8').replace('<a class="download" href="계정별콘텐츠_전체.zip" download>전체 꾸러미 내려받기</a> ',''));
}
async function prepare() {
  const manifest=[];
  for(const key of selected){
    const source=assetSources[key];if(!source||!fs.existsSync(source))throw new Error('없는 자산: '+key);
    const target=path.join(__dirname,'assets',key+'.webp');fs.mkdirSync(path.dirname(target),{recursive:true});
    const meta=await sharp(source).metadata();
    if(!fs.existsSync(target)){
      if(path.extname(source)==='.webp')fs.copyFileSync(source,target);
      else await sharp(source).resize({width:3840,height:3840,fit:'inside',withoutEnlargement:true}).webp({quality:96}).toFile(target);
    }
    manifest.push({key,source:path.relative(ROOT,source).split(path.sep).join('/'),sourceWidth:meta.width,sourceHeight:meta.height,sourceSha256:hash(source),output:'assets/'+key+'.webp',outputSha256:hash(target),note:key.endsWith('page')||key==='labinside'?'완성 소개서의 실제 지면':'기존 승인 브랜드 자산. 실사 시설/학생 사진 아님'});
  }
  write(path.join(__dirname,'사용자산.json'),JSON.stringify(manifest,null,2));
}
async function render() {
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--allow-file-access-from-files']});
  const context=await browser.newContext({viewport:{width:1080,height:1350},deviceScaleFactor:2});
  const page=await context.newPage();
  const results=[], errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const p of data.items){
    const folder=path.join(__dirname,p.id);
    await page.goto(pathToFileURL(path.join(folder,'cards.html')).href+'?export',{waitUntil:'load'});
    await page.evaluate(async()=>{await Promise.all([document.fonts.load('800 48px "SUIT Variable"','한국어'),document.fonts.load('600 48px "Inter Tight"','Өөрийн үг')]);await document.fonts.ready;await Promise.all(Array.from(document.images).map(x=>x.decode()));});
    const checks=await page.evaluate(()=>Array.from(document.querySelectorAll('.artboard')).map(b=>{
      const br=b.getBoundingClientRect(),copy=b.querySelector('.copy'),cr=copy.getBoundingClientRect(),f=b.querySelector('.folio').getBoundingClientRect();
      const text=Array.from(copy.querySelectorAll('h1,p,li')).map(e=>{const r=e.getBoundingClientRect();return {text:e.textContent,top:r.top-br.top,bottom:r.bottom-br.top,left:r.left-br.left,right:r.right-br.left,overflow:e.scrollWidth>e.clientWidth+1};});
      const assets=Array.from(b.querySelectorAll('.hero-asset,.diptych')).map(e=>{const r=e.getBoundingClientRect();return{top:r.top-br.top,bottom:r.bottom-br.top,left:r.left-br.left,right:r.right-br.left};});
      return{card:b.dataset.card,fonts:{suit:document.fonts.check('800 48px "SUIT Variable"','한국어'),inter:document.fonts.check('600 48px "Inter Tight"','Өөрийн үг')},copyBottom:cr.bottom-br.top,footerTop:f.top-br.top,text,assets,textOverflow:text.some(x=>x.overflow||x.right>992||x.bottom>f.top-br.top-16),collision:assets.some(a=>a.top<cr.bottom-br.top+24&&a.right>cr.left-br.left)};
    }));
    for(let i=0;i<p.cards.length;i++){
      const n=String(i+1).padStart(2,'0');const master=path.join(folder,`master-${n}.png`);
      await page.locator('.artboard').nth(i).screenshot({path:master,animations:'disabled'});
      await sharp(master).resize(1080,1350).jpeg({quality:96,chromaSubsampling:'4:4:4'}).toFile(path.join(folder,`upload-${n}.jpg`));
      results.push({id:p.id,index:i+1,master:`${p.id}/master-${n}.png`,upload:`${p.id}/upload-${n}.jpg`,...checks[i]});
    }
    console.log(`${p.id}: ${p.cards.length}장`);
  }
  await browser.close();
  const report={sourceSha256:hash(dataFile),renderedAt:new Date().toISOString(),cards:results.length,errors,results};
  write(path.join(__dirname,'_검토/정적_경계검사.json'),JSON.stringify(report,null,2));
  const thumbs=await Promise.all(results.map(async(r,i)=>({input:await sharp(path.join(__dirname,r.upload)).resize(270,338).png().toBuffer(),left:(i%6)*286,top:Math.floor(i/6)*366})));
  fs.mkdirSync(path.join(__dirname,'미리보기'),{recursive:true});
  await sharp({create:{width:6*286,height:Math.ceil(results.length/6)*366,channels:3,background:C.Oat}}).composite(thumbs).png().toFile(path.join(__dirname,'미리보기/전체카드.png'));
  for(const p of data.items){const rs=results.filter(x=>x.id===p.id);const composites=await Promise.all(rs.map(async(r,i)=>({input:await sharp(path.join(__dirname,r.upload)).resize(324,405).png().toBuffer(),left:i*340,top:0})));await sharp({create:{width:rs.length*340-16,height:405,channels:3,background:C.Oat}}).composite(composites).png().toFile(path.join(__dirname,'미리보기',p.id+'.png'));}
  console.log(JSON.stringify({cards:results.length,overflow:results.filter(x=>x.textOverflow).map(x=>[x.id,x.index]),collision:results.filter(x=>x.collision).map(x=>[x.id,x.index]),errors}));
}
(async()=>{await prepare();buildPages();if(process.argv.includes('--render'))await render();console.log('계정별 지면/원고 생성 완료');})().catch(e=>{console.error(e.stack);process.exitCode=1;});
