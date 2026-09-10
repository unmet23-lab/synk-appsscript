'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'../../..'),loom=require(path.join(root,'tools/lib/loom')),font=require(path.join(root,'tools/lib/브랜드폰트'));
const sharp=require('sharp'),{chromium}=require('playwright'),{marked}=require('marked');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,p),'utf8').replace(/^\uFEFF/,''));
const put=(p,s)=>{const f=path.join(__dirname,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s)};
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const esc=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const br=s=>esc(s).replace(/\n/g,'<br>');
const assets=Object.fromEntries(read('_검토/자산과원본.json').assets.map(x=>[x.key,x.file]));
const shapes={portrait:[1080,1350],vertical:[1080,1920],wide:[1920,1080],pin:[1000,1500],square:[1080,1080]};
const shapeOf=item=>item.platform==='Substack'?'letterhead':item.platform==='Pinterest'?'pin':item.platform==='Kakao Channel'?'square':item.format==='video'&&item.orientation==='portrait'?'vertical':'portrait';
function html(title,body,rel='',lang='ko'){return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><link rel="stylesheet" href="${rel}edition.css"></head><body class="first-edition">${body}</body></html>`}
function logo(brand,rel=''){return `<img class="web-logo" src="${rel}assets/${assets['logo-'+brand.toLowerCase()]}" alt="${brand==='SYNK'?'SYNK':'SYNK '+brand}">`}
function art(item,s,i,shape='portrait'){
 const boardBrand=item.id==='01-lab-youtube'?'LAB':item.brand;
 const src=assets[s.asset];if(s.asset&&!src)throw Error('Unknown asset '+s.asset);
 return `<section class="first-art" data-id="${item.id}" data-brand="${boardBrand}" data-layout="${s.layout||'cover'}" data-shape="${shape}" aria-label="${esc(s.alt||s.title)}">
 <img class="art-logo" src="../assets/${assets['logo-'+boardBrand.toLowerCase()]}" alt="SYNK ${boardBrand}"><p class="art-label">${esc(item.platform.toUpperCase())} / 01</p>
 <div class="art-copy">${s.kicker?`<p class="art-kicker">${br(s.kicker)}</p>`:''}<h1 class="art-title">${br(s.title)}</h1>${s.body?`<p class="art-body">${br(s.body)}</p>`:''}${s.primary?`<p class="art-primary">${br(s.primary)}</p>`:''}${s.secondary?`<p class="art-secondary">${br(s.secondary)}</p>`:''}${s.items?`<ul class="art-items">${s.items.map(x=>typeof x==='string'?`<li>${br(x)}</li>`:`<li>${x.label?`<strong>${br(x.label)}</strong>`:''}${br(x.text)}</li>`).join('')}</ul>`:''}${s.note?`<p class="art-note">${br(s.note)}</p>`:''}</div>
 ${src?`<img class="art-image" src="../assets/${src}" alt="">`:''}<div class="art-foot"><span>${esc(item.displayAccount||item.account)}</span><span>${String(i+1).padStart(2,'0')} / ${String(item.slides.length).padStart(2,'0')}</span></div></section>`;
}
function getItems(){
 const result=['원고/static.json','원고/video.json'].flatMap(f=>{if(!fs.existsSync(path.join(__dirname,f)))return [];const x=read(f);return Array.isArray(x)?x:x.items});
 return result.sort((a,b)=>a.id.localeCompare(b.id));
}
function stylesheet(){
 const inter=['Regular','Medium','SemiBold','Bold','ExtraBold'].map((n,i)=>{const p=path.join(root,`docs/브랜드_폰트/InterTight/InterTight-${n}.ttf`);if(!fs.existsSync(p))return '';return `@font-face{font-family:'Inter Tight';font-weight:${[400,500,600,700,800][i]};font-display:block;src:url(data:font/ttf;base64,${fs.readFileSync(p).toString('base64')}) format('truetype')}`}).join('\n');
 put('edition.css',font.면()+inter+loom.첫게시물());
}
function sourceResources(){
 const base=path.join(root,'docs/홍보물/마케팅실행_20260909/제공자료');
 const names=[['shift-intro','01_소개문'],['shift-offer','02_상품한장'],['shift-content-map','03_콘텐츠지도'],['shift-inquiry','04_문의답변'],['shift-ai-workflow','05_AI업무지도'],['shift-lesson','06_강의실습설계']];
 const entries=[...names,['shift-follow-up','소통_후속도움']],aliases=Object.fromEntries(entries.map(([id,name])=>[name+'.md',id+'.html']));
 const linkedHtml=md=>marked.parse(md).replace(/href="([^"]+)"/g,(tag,url)=>{let decoded;try{decoded=decodeURIComponent(url)}catch{return tag}return aliases[decoded]?`href="${aliases[decoded]}"`:tag});
 const records=[];
 for(const [id,name] of entries){
  const src=path.join(base,name+'.md');if(!fs.existsSync(src))continue;
  const md=fs.readFileSync(src,'utf8');put(`resources/${id}.md`,md);put(`resources/${name}.md`,md);
  const pdf=path.join(base,name+'.pdf'),hasPdf=fs.existsSync(pdf);
  put(`resources/${id}.html`,html(name,`<article class="reader">${logo('SHIFT','../')}<nav class="actions no-print"><a class="button" href="../index.html">첫 게시물 모음</a><a class="button" href="${id}.md" download>고쳐 쓰는 원본</a>${hasPdf?`<a class="button" href="${id}.pdf" download>PDF</a>`:''}</nav>${linkedHtml(md)}</article>`,'../'));
  if(hasPdf)fs.copyFileSync(pdf,path.join(__dirname,'resources',id+'.pdf'));
  records.push({id,source:path.relative(root,src),sha256:sha(src),pdf:hasPdf?{source:path.relative(root,pdf),sha256:sha(pdf)}:null,reused:true,originalMarkdownPreserved:true,htmlRelatedLinksAdapted:true,supportGuide:id==='shift-follow-up'});
 }
 put('_검토/재사용자료.json',JSON.stringify(records,null,2));
}
function guide(item){
 let extra=item.id==='13-yuhobuilds-linkedin'?'게시할자료.pdf를 문서 게시물로 선택합니다. JPG는 표지 및 검토용입니다.':item.format==='video'?`video.mp4를 업로드합니다. ${item.orientation==='landscape'?'1920×1080 가로 영상이며 thumbnail.jpg를 표지로 사용합니다.':'1080×1920 세로 영상입니다. cover.jpg는 게시 화면에서 표지를 지정할 수 있을 때 사용합니다.'}`:item.platform==='Pinterest'?'upload-01.jpg는 1000×1500, 2:3 이미지 핀입니다. 링크.txt의 주소를 핀의 링크 입력란에 넣습니다.':'upload-01.jpg부터 번호순으로 한 게시물에 넣습니다. 텍스트 중심 계정은 이미지가 선택 첨부입니다.';
 if(item.id==='01-lab-youtube')extra+='\n\nvoice-studio.wav는 수정한 목소리만 따로 듣는 무손실 파일입니다. 같은 목소리가 video.mp4에 이미 들어 있으므로 업로드할 때 별도로 합칠 필요는 없습니다.';
 if(item.revision==='2026-09-10-approved01-continuity-v1')extra+='\n\n이번 수정본은 승인된 1편의 밝고 자연스러운 여성 음색과 편안한 음량을 이어갑니다. 새 목소리와 배경음, 마지막 내용에서 이어지는 회사 로고 엔딩이 video.mp4에 모두 포함되어 있습니다. 별도 음원이나 엔딩 파일을 합칠 필요가 없습니다.';
 return `# ${item.platform} · ${item.account}\n\n${item.title}\n\n## 이 계정의 첫 약속\n\n- 대상: ${item.target}\n- 지금 필요한 것: ${item.need}\n- 먼저 받는 것: ${item.promise}\n- 철학을 보여주는 선택: ${item.philosophy}\n\n## 올리는 파일\n\n${extra}\n\n게시문안.txt는 공개 본문입니다. 제목.txt는 제목 칸이 있는 플랫폼에서 씁니다. 대체텍스트.txt는 지원되는 이미지 설명 칸에 사용하고, 미지원이면 본문에 필요한 의미를 남깁니다. 긴 글 계정은 본문.md 또는 본문.html의 글을 함께 사용합니다.\n\n${item.platform==='YouTube'?'자막.srt를 자막으로 추가합니다. Shorts 설명의 외부 URL은 클릭 경로로 약속하지 않습니다. 가로 본편은 업로드 후 원하는 경우 채널 홈의 트레일러로 지정할 수 있습니다. 관련영상은 실제 업로드된 같은 채널 영상과 지원 조건을 확인한 뒤 연결합니다.\n\n':''}${item.id==='18-shift-kakao'?'일반 사진과 소식 본문 기준입니다. 카드뷰로 바꾸려면 해당 편집기의 1:1 또는 3:4 틀을 다시 확인하세요.\n\n':''}## 다음 자리\n\n${item.nextAction}\n\n${item.resourceId?`resources/${item.resourceId}.html에 기존 완성 예시와 사용법, 수정 원본을 함께 담았습니다. 공개 본문에 적은 자료 주소는 실제 공개 자료와 대조해야 하며 로컬 파일 경로를 SNS에 붙이지 않습니다.\n\n`:''}## 첫 편과 이후 편의 관계\n\n${item.relationship}\n\n## 상태와 게시 화면 확인\n\n신규 첫 게시물 제작본입니다. SNS 게시·새 계정 개설은 수행하지 않았습니다. 준비 계정과 희망 핸들은 계정 설정에서 확인한 뒤 사용하세요. ${item.language==='mn'?'몽골어는 장면과 의도 중심 작성 및 독립 AI 의미 대조를 거칩니다. 사람 원어민 감수 여부는 완료 기록에 별도로 남깁니다.':''}\n\n영상에는 합성음성을 사용했으며 대표자의 실제 목소리가 아닙니다. 공개 예시는 실제 고객·학생 성과가 아닙니다. 가격·개강일·응답시간·자동 DM을 추가로 약속하지 않습니다.\n`;
}
function prepare(items,{selected=items,refreshShared=true}={}){
 if(refreshShared){stylesheet();sourceResources();}
 for(const item of selected){
  put(`${item.id}/원고.json`,JSON.stringify(item,null,2));put(`${item.id}/게시문안.txt`,item.caption+'\n');put(`${item.id}/제목.txt`,item.title+'\n');put(`${item.id}/업로드안내.md`,guide(item));
  if(item.id==='19-shift-pinterest')put(`${item.id}/링크.txt`,'https://synk-field-notes.unmet23.chatgpt.site/제공자료/01_소개문.html\n');
  if(item.captionKo)put(`${item.id}/게시문안_한국어뜻.txt`,item.captionKo+'\n');
  const alt=item.slides.map((s,i)=>`${i+1}. ${s.alt||(Array.isArray(item.alt)?item.alt[i]:item.alt)||[s.title,s.body,s.primary,s.secondary,...(s.items||[]).map(x=>typeof x==='string'?x:[x.label,x.text].filter(Boolean).join(' ')),s.note].filter(Boolean).join('. ')}`).join('\n\n');
  put(`${item.id}/대체텍스트.txt`,alt+'\n');
  const shape=shapeOf(item);
  put(`${item.id}/cards.html`,html(item.title,item.slides.map((s,i)=>art(item,s,i,shape)).join(''),'../',item.language||'ko'));
  if(item.orientation==='landscape')put(`${item.id}/thumbnail.html`,html(item.title,art(item,item.thumbnail||item.slides[0],0,'wide'),'../',item.language||'ko'));
  if(item.article){put(`${item.id}/본문.md`,item.article);put(`${item.id}/본문.html`,html(item.title,`<article class="reader">${logo(item.brand,'../')}${marked.parse(item.article)}</article>`,'../',item.language||'ko'))}
  let visual=item.format==='video'?'<video controls preload="metadata" poster="'+(item.orientation==='landscape'?'thumbnail.jpg':'cover.jpg')+'"><source src="video.mp4" type="video/mp4"><track kind="captions" src="자막.vtt" srclang="'+(item.language||'ko')+'" label="자막"></video><a class="button" href="video.mp4" download>영상 받기</a>':'';
  if(item.id==='01-lab-youtube')visual+='<a class="button" href="voice-studio.wav" download>수정한 목소리 WAV 받기</a>';
  const pictures=item.slides.map((s,i)=>`<figure><img src="upload-${String(i+1).padStart(2,'0')}.jpg" alt="${esc(s.alt||s.title)}" loading="lazy"><figcaption>${i+1} / ${item.slides.length}</figcaption></figure>`).join('');
  put(`${item.id}/index.html`,html(item.title,`<article class="reader">${logo(item.brand==='PULSE'?'LAB':item.brand,'../')}<a class="button" href="../index.html">전체 첫 게시물</a><p class="eyebrow">${esc(item.platform)} · ${esc(item.account)}</p><h1>${esc(item.title)}</h1><p>${esc(item.promise)}</p><p class="state">대상: ${esc(item.target)}<br>신규 첫 게시물 제작 · SNS 미게시</p><nav class="actions"><a class="button" href="게시문안.txt" download>게시 문구</a><a class="button" href="업로드안내.md">사용 안내</a>${item.article?'<a class="button" href="본문.html">긴 글 전체</a>':''}${item.id==='13-yuhobuilds-linkedin'?'<a class="button" href="게시할자료.pdf" download>LinkedIn 문서 PDF</a>':''}${item.resourceId?`<a class="button" href="../resources/${item.resourceId}.html">제공 자료와 수정 원본</a>`:''}${item.id==='04-yuhobuilds-youtube'?'<a class="button" href="../resources/first-work.html">직접 작성하고 TXT 받기</a>':''}</nav>${visual}<h2>게시할 글</h2><div class="copy-text" lang="${item.language||'ko'}">${esc(item.caption)}</div>${item.article?`<h2>본문</h2>${marked.parse(item.article)}`:''}<h2>${item.format==='video'?'영상 표지':'게시할 이미지'}</h2>${pictures}<h2>이 계정에서 맡는 역할</h2><p>${esc(item.philosophy)}</p><p>${esc(item.relationship)}</p></article>`,'../',item.language||'ko'));
 }
 const brandText={LAB:'몽골 학생에게는 직접 골라 쓰는 한국어를, 보호자에게는 함께 이해하고 대화할 자료를.',SHIFT:'1인 기업의 브랜드·상품·콘텐츠·고객 접점을 완성 예시와 방법, 수정 원본으로.',SYNK:'배움과 방법, 작품을 만드는 한 회사. 완성물에 남긴 선택으로 기준을 보여줍니다.'};
 const sections=['LAB','SHIFT','SYNK'].map(brand=>{const group=items.filter(x=>x.brand===brand||(brand==='LAB'&&x.id==='01-lab-youtube'));return `<section class="brand-section" data-group="${brand}"><h2>${brand==='SYNK'?'SYNK':`SYNK ${brand}`} <small>${group.length}</small></h2><p>${brandText[brand]}</p><div class="grid">${group.map(x=>`<article class="entry" data-platform="${esc(x.platform)}"><a href="${x.id}/index.html"><img src="${x.id}/upload-01.jpg" alt="${esc(x.title)}" loading="lazy"></a><p class="meta">${esc(x.platform)} / ${esc(x.account)}</p><h3>${esc(x.title)}</h3><p>${esc(x.promise)}</p><p class="meta">${esc(x.target)}</p><a class="button" href="${x.id}/index.html">실물 · 게시 문구 · 제공 자료</a></article>`).join('')}</div></section>`}).join('');
 put('index.html',html('SYNK · 첫 만남',`<main class="sheet"><header class="masthead">${logo('SYNK')}<p class="eyebrow">FIRST EDITION / 2026.09.10</p><h1>처음부터,<br>당신에게 남을 것.</h1><p>각 계정의 첫 만남을 준비했습니다. 누구에게 무엇을 주는지, 어떤 생각으로 만드는지, 앞으로 무엇을 기대할 수 있는지 한 편 안에서 경험하도록 만들었습니다.</p><div class="actions"><a class="button" href="전체_업로드.zip" download>전체 업로드 꾸러미</a><a class="button" href="타겟과플랫폼.html">19개 계정의 타겟·제공 가치</a><a class="button" href="읽어주세요.md">사용·검증 안내</a></div><p class="eyebrow">게임 제외 · LAB YouTube 안에 K-LOFI24 감상 갈래 포함 · 계정 개설과 SNS 게시는 별도</p></header>${sections}</main>`));
 const rows=items.map(x=>`<tr><td>${esc(x.brand)}<br>${esc(x.platform)}<br>${esc(x.account)}</td><td>${esc(x.target)}<br>${esc(x.need)}</td><td>${esc(x.promise)}</td><td>${esc(x.philosophy)}</td><td>${esc(x.nextAction)}</td></tr>`).join('');
 put('타겟과플랫폼.html',html('19개 계정의 첫 만남 설계',`<main class="sheet">${logo('SYNK')}<a class="button" href="index.html">실물 모음</a><h1>한 회사의 철학, 계정마다 다른 첫 약속.</h1><p>타겟의 상황은 현행 마케팅 정본에서 가져온 가설입니다. 실제 인터뷰·게시 성과를 확인한 결과로 표현하지 않습니다.</p><div class="table-scroll"><table><thead><tr><th>계정</th><th>대상과 상황</th><th>먼저 주는 것</th><th>철학이 보이는 선택</th><th>다음 자리</th></tr></thead><tbody>${rows}</tbody></table></div></main>`));
 put('콘텐츠원고.json',JSON.stringify({version:1,date:'2026-09-10',state:'신규 첫 게시물 제작; SNS 미게시',items},null,2));
}
function mergeVerification(previous,records,selectedIds){
 const selected=new Set(selectedIds),keep=rows=>(rows||[]).filter(r=>!selected.has(r.file.split('/')[0]));
 const merged=[...keep(previous.records),...keep(previous.documents),...records].sort((a,b)=>a.file.localeCompare(b.file));
 const images=merged.filter(r=>r.kind!=='pdf');
 return {count:images.length,records:images,documents:merged.filter(r=>r.kind==='pdf')};
}
async function render(items,{selective=false}={}){
 const previous=selective?read('_검토/이미지검증.json'):{records:[],documents:[]};
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--allow-file-access-from-files']});
 const page=await browser.newPage({viewport:{width:1920,height:1600},deviceScaleFactor:2});const records=[];
 for(const item of items){
  await page.goto(pathToFileURL(path.join(__dirname,item.id,'cards.html')).href);await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()))});
  const checks=await page.evaluate(()=>[...document.querySelectorAll('.first-art')].map(a=>{const r=a.getBoundingClientRect(),copy=a.querySelector('.art-copy').getBoundingClientRect(),im=a.querySelector('.art-image');if(im){const available=r.height-(copy.bottom-r.top)-150;const max=Number.parseFloat(getComputedStyle(im).height);if(available<150)im.style.display='none';else im.style.height=Math.min(max,available)+'px'}return {width:r.width,height:r.height,copyBottom:copy.bottom-r.top,overflow:copy.bottom>r.bottom-110}}));
  if(checks.some(x=>x.overflow))throw Error(item.id+' text overflow '+JSON.stringify(checks));
  for(let i=0;i<item.slides.length;i++){const n=String(i+1).padStart(2,'0'),master=path.join(__dirname,item.id,`master-${n}.png`),file=`${item.id}/upload-${n}.jpg`;const renderedPng=await page.locator('.first-art').nth(i).screenshot();await sharp(renderedPng).resize(checks[i].width,checks[i].height).jpeg({quality:95,chromaSubsampling:'4:4:4'}).toFile(path.join(__dirname,file));records.push({file,sha256:sha(path.join(__dirname,file)),...checks[i]})}
  fs.copyFileSync(path.join(__dirname,item.id,'upload-01.jpg'),path.join(__dirname,item.id,'cover.jpg'));
  if(item.id==='13-yuhobuilds-linkedin'){
   await page.evaluate(async()=>{for(const im of document.images){if(getComputedStyle(im).display==='none')continue;const box=im.getBoundingClientRect(),scale=Math.min(1,Math.max(box.width,box.height)*2/Math.max(im.naturalWidth,im.naturalHeight));if(scale>=1)continue;const canvas=document.createElement('canvas');canvas.width=Math.round(im.naturalWidth*scale);canvas.height=Math.round(im.naturalHeight*scale);canvas.getContext('2d').drawImage(im,0,0,canvas.width,canvas.height);im.src=canvas.toDataURL('image/png');await im.decode();}});
   await page.pdf({path:path.join(__dirname,item.id,'게시할자료.pdf'),width:'1080px',height:'1350px',printBackground:true,margin:{top:0,right:0,bottom:0,left:0}});
   records.push({file:`${item.id}/게시할자료.pdf`,kind:'pdf',pages:item.slides.length,sha256:sha(path.join(__dirname,item.id,'게시할자료.pdf'))});
  }
  if(item.orientation==='landscape'){await page.goto(pathToFileURL(path.join(__dirname,item.id,'thumbnail.html')).href);await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()))});const thumbnailPng=await page.locator('.first-art').screenshot();await sharp(thumbnailPng).resize(1920,1080).jpeg({quality:94,chromaSubsampling:'4:4:4'}).toFile(path.join(__dirname,item.id,'thumbnail.jpg'))}
 }
 const verification=mergeVerification(previous,records,items.map(x=>x.id));
 const imageRecords=verification.records;const cols=5,tile=216,rows=Math.ceil(imageRecords.length/cols);const tiles=await Promise.all(imageRecords.map(async(r,i)=>({input:await sharp(path.join(__dirname,r.file)).resize(tile,270,{fit:'contain',background:loom.정본().색.Paper}).png().toBuffer(),left:i%cols*228,top:Math.floor(i/cols)*282})));
 await sharp({create:{width:cols*228,height:rows*282,channels:3,background:loom.정본().색.Oat}}).composite(tiles).png().toFile(path.join(__dirname,'_검토/전체이미지.png'));
 put('_검토/이미지검증.json',JSON.stringify(verification,null,2));await browser.close();console.log(JSON.stringify({rendered:records.filter(r=>r.kind!=='pdf').length,recorded:imageRecords.length,accounts:items.length}));
}
(async()=>{
 const skip=(process.argv.find(x=>x.startsWith('--skip='))||'').slice(7),idArg=process.argv.find(x=>x.startsWith('--id=')),id=idArg?.slice(5);
 const items=getItems();if(!items.length)throw Error('No new first-post scripts');
 if(idArg&&!items.some(x=>x.id===id))throw Error('Unknown first-post id: '+id);
 const selective=Boolean(idArg||skip),selected=selective?items.filter(x=>(!idArg||x.id===id)&&(!skip||!x.id.startsWith(skip))):items;
 if(!selected.length)throw Error('No first-post scripts selected');
 // Refresh existing artwork without rewriting in-progress scripts or voice notices.
 if(!process.argv.includes('--render-only'))prepare(items,{selected,refreshShared:!selective});
 if(process.argv.includes('--render'))await render(selected,{selective});
 console.log('prepared '+selected.length+' / catalog '+items.length);
})().catch(e=>{console.error(e);process.exitCode=1});
