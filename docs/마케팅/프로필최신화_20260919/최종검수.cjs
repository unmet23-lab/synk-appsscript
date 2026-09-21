'use strict';
// Historical v2 checker. Do not let it overwrite the active v4 gallery.
if (require('./계정별_문구.json').coverRevision === '2026-09-19-felt-glass-v4') {
 throw new Error('현재 v4 검사는 커버_펠트글래스_v4/검수.cjs를 사용하세요. 이 파일은 v2 기록용입니다.');
}
// One-off artifact QA. Does not sign in, publish, or change any remote account.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const sharp=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const dir=__dirname,root=path.resolve(dir,'../../..');
const read=n=>JSON.parse(fs.readFileSync(path.join(dir,n),'utf8'));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const count=s=>Array.from(s).length;
const notes={
  'lab-youtube':'몽골어권 대상과 한국어 병기를 유지. 회화·TOPIK·학습 자료를 앞에 두고, K-LOFI를 상시 방송 중이라고 단정하지 않음.',
  'lab-instagram':'몽골어 주제와 짧은 한국어 설명으로 정리. TOPIK 4급만을 위한 채널로 범위를 좁히지 않음.',
  'lab-tiktok':'짧은 영상 채널에 맞춰 한국어·TOPIK과 몽골어 설명이라는 특징만 남김.',
  'lab-facebook':'자녀가 있는 보호자에게만 말하던 문구를 고쳐 성인 학습자와 보호자 모두를 포함. 수업·유학 준비 안내 역할 유지.',
  'lab-telegram':'학습 자료와 과정 준비 소식을 받는 채널임을 명시. 공식 LAB 링크를 소개 안에도 포함.',
  'yuhobuilds-youtube':'모든 과정을 공개한다는 과한 범위를 줄임. 실제 제작 결과와 시행착오를 다루는 영상 채널로 정리.',
  'yuhobuilds-instagram':'제작자와 작업 분야를 첫 두 줄에 명시. 교육·컨설팅·브랜딩은 준비 상태로 표시.',
  'yuhobuilds-tiktok':'짧은 영상에서 보게 될 실제 작업과 시행착오를 명시. 긴 서비스 설명은 공식 링크로 분리.',
  'yuhobuilds-threads':'작업 중 생각·도구·선택 이유를 나누는 대화형 계정으로 구분.',
  'yuho-linkedin-primary':'대표의 실제 작업과 기업·기관 협업 분야를 분리. 준비 상태를 헤드라인과 본문에 표시. 운영 계정은 unmet25만.',
  'yuhobuilds-telegram':'발행 채널처럼 보이던 문구를 연락용 프로필로 수정. 협업 문의와 공식 링크를 70자 안에 배치.',
  'yuhobuilds-x':'진행 중인 작업과 도구 선택의 이유를 나누는 짧은 기록 계정으로 구분.',
  'yuhobuilds-behance':'포트폴리오 역할을 명시. 프로젝트 결과·설계 의도·제작 과정으로 정리.',
  'yuhobuilds-naver-clip':'제작 과정과 직접 써 본 AI 활용법을 짧은 영상으로 전달하는 역할로 정리.',
  'synkbrief-youtube':'제작자 일기와 구분해 업무 예시·도구·순서·결과 확인 방법을 설명하는 채널로 정리.',
  'synkbrief-instagram':'반복 업무를 만든다는 어색한 연결을 업무 자동화로 수정. 짧은 실제 예시 중심.',
  'synkbrief-tiktok':'실무 설명 채널임을 첫 문장에 표시. 문서·홍보 콘텐츠·자동화로 범위 구체화.',
  'synk-linkedin-company':'준비를 준비한다는 중복과 추상적인 반복을 제거. LAB·SHIFT·PULSE·PATH 역할 및 준비 상태 구분.',
  'synklab-substack':'편지라는 추상적 설명보다 뉴스레터임을 먼저 명시. LAB·SHIFT 두 갈래 유지.',
  'shift-naverblog':'검색해서 찾아오는 AI 활용 기록으로 구분. 작업 종류와 준비 중인 사업을 나눔.',
  'shift-kakao':'기존 문구 유지. 기업·기관 교육·컨설팅·브랜딩이라는 문의 목적과 준비 상태가 이미 명확함.',
  'shift-tistory':'Naver와 같던 문구를 장문 제작 기록에 맞게 분리. 의사결정·시행착오·수정 과정 강조.',
  'shift-pinterest':'시각 자료 모음이라는 역할을 명시. 색·재질·구성과 제작 과정으로 Behance의 프로젝트 설명과 구분.'
};
const coverNames={
  'synk-linkedin-company':'회사 LinkedIn','yuhobuilds-youtube':'유호 YouTube','synkbrief-youtube':'브리핑 YouTube','lab-youtube':'LAB YouTube','yuhobuilds-x':'유호 X','yuho-linkedin-primary':'개인 LinkedIn','shift-tistory':'Tistory','shift-naverblog':'Naver 블로그','shift-pinterest':'Pinterest','shift-behance':'Behance','lab-facebook':'LAB Facebook','shift-tistory-mobile':'Tistory 모바일'
};
const sources=[
  {url:'https://support.google.com/youtube/answer/10456525?hl=en-GB',used:'YouTube 2560×1440, 6 MB 이하, 2048×1152 기준 문자 영역 1235×338'},
  {url:'https://www.linkedin.com/help/linkedin/answer/a563309/image-specifications-for-your-linkedin-pages-and-career-pages',used:'회사 LinkedIn 1512×256, PNG/JPEG 3 MB 이하; 가장자리 잘림 주의'}
];
async function main(){
 const plan=read('계정별_문구.json'),old=read('계정별_문구.검수전.json'),manifest=read('커버_문구포함/명세.json'),coverPlan=read('커버_문구포함/문구.json');
 assert.equal(plan.accounts.length,23);assert.equal(new Set(plan.accounts.map(a=>a.id)).size,23);assert.equal(manifest.outputs.length,12);assert.equal(plan.coverRevision,manifest.revision);assert.equal(coverPlan.revision,manifest.revision);
 const accounts=plan.accounts.map(a=>{
   assert(notes[a.id],`Missing individual review ${a.id}`);assert(a.bio===a.bio.trim());assert(!/[\u200B\uFEFF\uFFFD]/u.test(a.bio));assert.equal(new URL(a.website).host,'synk.im');
   const localBudget=a.bioLimit||(a.platform==='YouTube'?500:a.id.includes('linkedin')?1000:a.platform==='Facebook'?100:150);
   assert(count(a.bio)<=localBudget,`Bio too long ${a.id}`);if(a.headline)assert(count(a.headline)<=220);if(a.tagline)assert(count(a.tagline)<=120);
   for(const key of ['cover','mobileCover'])if(a[key])assert(fs.existsSync(path.join(dir,a[key])),`Missing ${a[key]}`);
   const previous=old.accounts.find(x=>x.id===a.id);assert(previous);
   assert.equal(a.handle,previous.handle);assert.equal(a.website,previous.website);
   return {...a,review:notes[a.id],characters:count(a.bio),localBudget,budgetBasis:a.bioLimit?'previously recorded editor limit':'conservative local copy budget; editor limit must be rechecked',changed:a.bio!==previous.bio||a.headline!==previous.headline||a.tagline!==previous.tagline,copySha256:crypto.createHash('sha256').update(JSON.stringify({bio:a.bio,headline:a.headline,tagline:a.tagline,website:a.website})).digest('hex'),publication:'not-applied-in-this-review'};
 });
 const covers=[];
 for(const o of manifest.outputs){
   const f=path.join(dir,'커버_문구포함',o.file),m=await sharp(f).metadata();assert.equal(m.width,o.w);assert.equal(m.height,o.h);assert.equal(hash(f),o.sha256);
   const bytes=fs.statSync(f).size;assert(bytes<=(o.id.endsWith('-youtube')?6000000:3000000));
   if(o.id.endsWith('-youtube')){assert.equal(o.w,2560);assert.equal(o.h,1440)}if(o.id==='synk-linkedin-company'){assert.equal(o.w,1512);assert.equal(o.h,256)}
   const overlap=(a,b)=>Math.min(a.x+a.w,b.x+b.w)>Math.max(a.x,b.x)&&Math.min(a.y+a.h,b.y+b.h)>Math.max(a.y,b.y);
   for(const [i,t] of o.text.entries()){
     assert(t.x>=0&&t.y>=0&&t.x+t.w<=o.w&&t.y+t.h<=o.h);assert(t.fonts.every(f=>['ko800','ko500','latin700','latin500'].includes(f)));
     for(const t2 of o.text.slice(i+1))assert(!overlap(t,t2),`Overlapping text ${o.id}`);
     for(const p of o.photos)assert(!overlap(t,p),`Text on artwork ${o.id}`);
   }
   for(const p of o.photos){assert(p.x>=0&&p.y>=0&&p.x+p.w<=o.w&&p.y+p.h<=o.h);if(o.safe)assert(p.x>=o.safe.x&&p.y>=o.safe.y&&p.x+p.w<=o.safe.x+o.safe.w&&p.y+p.h<=o.safe.y+o.safe.h)}
   covers.push({id:o.id,file:o.file,w:o.w,h:o.h,bytes,sha256:o.sha256,textCount:o.text.length,localGeometry:'pass',liveCropVerified:false});
 }
 const websites=await Promise.all(['','lab/','shift/','pulse/','path/'].map(async s=>{
   const url='https://synk.im/'+s,r=await fetch(url,{signal:AbortSignal.timeout(20000)}),html=await r.text();assert.equal(r.status,200);assert.equal(new URL(r.url).host,'synk.im');const title=(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||'';assert(title.includes('SYNK'));return {url,finalUrl:r.url,status:r.status,title,checkedAt:new Date().toISOString()};
 }));
 const publicChecks=await Promise.all(['https://yuhobuilds.tistory.com/','https://synklab.substack.com/about'].map(async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(20000)});const html=await r.text();const norm=s=>s.replace(/&middot;/g,'·').replace(/\s+/g,' ').trim();const text=norm(html.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<[^>]*>/g,' '));return {url,status:r.status,checkedAt:new Date().toISOString(),method:'read-only public HTTP body; not browser rendering',previousTistoryBioConfirmed:url.includes('tistory')?text.includes(norm(old.accounts.find(a=>a.id==='shift-tistory').bio)):null,oldSloganPresent:text.includes('개인과 조직의 성장이 서로의 기회가 되는'),obsoleteShiftPathDescriptionPresent:url.includes('substack')?text.includes('브랜딩·광고와 유학·취업 연계'):null};}));
 const about=fs.readFileSync(path.join(dir,'Substack_About_최종.md'),'utf8');assert(about.includes('SYNK PATH'));assert(about.includes('몽골어'));
 const fontURI=(file,mime)=>`data:${mime};base64,${fs.readFileSync(path.join(root,'docs/브랜드_폰트',file)).toString('base64')}`;
 const styles=`@font-face{font-family:SUIT;src:url('${fontURI('SUIT/SUIT-Variable.woff2','font/woff2')}')}@font-face{font-family:Inter;src:url('${fontURI('InterTight/InterTight-Medium.ttf','font/ttf')}');font-weight:400 900}*{box-sizing:border-box}body{margin:0;background:#f3eee6;color:#2b2320;font-family:Inter,SUIT,sans-serif}main{max-width:1180px;margin:auto;padding:40px 24px}h1{font-size:34px;line-height:1.2;margin:0 0 16px}h2{font-size:23px;line-height:1.35}p{line-height:1.65}.intro{max-width:800px}.muted{color:#675c54}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}.card{min-width:0;padding:24px;background:#fffaf3;border-radius:12px}.card img{display:block;width:100%;height:auto}.meta{font-size:13px;overflow-wrap:anywhere}.bio{font-size:16px;white-space:pre-wrap;line-height:1.65;overflow-wrap:anywhere;margin:20px 0}.headline{font-weight:800}.review{font-size:14px;color:#675c54;line-height:1.7}a{color:#184aaa;overflow-wrap:anywhere}details{margin:20px 0}summary{cursor:pointer}.covergrid{display:grid;grid-template-columns:1fr 1fr;gap:20px}.covergrid img{display:block;width:100%;height:auto}.covergrid h3{font-size:16px}@media(max-width:650px){main{padding:24px 16px}.grid,.covergrid{grid-template-columns:1fr}.card{padding:20px}h1{font-size:27px}h2{font-size:21px}}`;
 const cards=accounts.map((a,i)=>`<article class="card" id="${a.id}"><p class="meta muted">${String(i+1).padStart(2,'0')} / ${esc(a.platform)} · ${esc(a.handle)}</p><h2>${esc(a.id)}</h2>${a.cover?`<img src="${esc(a.cover.replace(/\.png$/,'.preview.png'))}" alt="${esc(a.platform)} 커버 미리보기">`:''}${a.headline?`<p class="headline">${esc(a.headline)}</p>`:''}${a.tagline?`<p class="headline">${esc(a.tagline)}</p>`:''}<div class="bio">${esc(a.bio)}</div>${a.authorBio?`<p class="meta">작성자 소개</p><div class="bio">${esc(a.authorBio)}</div>`:''}${a.aboutSource?`<p><a href="${esc(a.aboutSource)}">긴 소개 페이지 최종 원고</a></p>`:''}<p class="meta"><a href="${a.website}">${a.website}</a> · 소개 ${a.characters}자</p><details><summary>검수 내용</summary><p class="review">${esc(a.review)}</p>${a.additionalFieldNote?`<p class="review">${esc(a.additionalFieldNote)}</p>`:''}${a.languageReview?'<p class="review">몽골어 AI 검토본 · 원어민 감수 미완료</p>':''}</details></article>`).join('');
 const gallery=manifest.outputs.map(o=>`<section><h3>${esc(coverNames[o.id])}</h3><a href="커버_문구포함/${o.file}"><img src="커버_문구포함/${o.id}.preview.png" alt="${esc(coverNames[o.id])} 로컬 미리보기"></a><p class="meta">${o.w} × ${o.h} · ${(o.bytes/1000000).toFixed(2)} MB · 공개 반영 전</p></section>`).join('');
 fs.writeFileSync(path.join(dir,'최종본.html'),`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SYNK SNS · 23개 계정 최종 검수본</title><style>${styles}</style><main><h1>SYNK SNS 최종 검수본</h1><p class="intro">소개글 23개를 개별 검수했고, 커버 11종과 Tistory 모바일 1종을 마감했습니다. 아래는 업로드 대상 원고입니다. 브라우저 연결이 없어 이번 최종 수정본은 외부 계정에 저장하지 않았습니다. 이전 게시 상태와 구분합니다.</p><p class="muted">${esc(plan.copyRevision)} · 몽골어는 AI 검토, 원어민 감수 미완료 · 미리보기는 실제 플랫폼 화면이 아닙니다.</p><h2>커버</h2><div class="covergrid">${gallery}</div><h2>계정별 소개글</h2><div class="grid">${cards}</div></main></html>`);
 const browser=await chromium.launch({channel:'chrome',headless:true});const render=[];
 try{
  const page=await browser.newPage();await page.route('**/*',r=>r.request().url().startsWith('http')?r.abort():r.continue());
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});await page.goto(pathToFileURL(path.join(dir,'최종본.html')).href);await page.evaluate(()=>document.fonts.ready);
   const result=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,brokenImages:[...document.images].filter(x=>!x.complete||x.naturalWidth===0).map(x=>x.src),cards:document.querySelectorAll('article').length,suit:document.fonts.check('16px SUIT'),inter:document.fonts.check('16px Inter')}));
   assert.equal(result.overflow,false);assert.equal(result.brokenImages.length,0);assert.equal(result.cards,23);assert(result.suit&&result.inter);
   await page.screenshot({path:path.join(dir,`최종본-${width}.png`),fullPage:true});
   if(width===390)for(const id of ['lab-youtube','synk-linkedin-company','yuhobuilds-telegram'])await page.locator('#'+id).screenshot({path:path.join(dir,`검수-${id}.png`)});
   render.push({width,...result});
  }
 }finally{await browser.close()}
 const report={revision:plan.copyRevision,checkedAt:new Date().toISOString(),localReview:'complete',externalPublication:'not-performed-browser-unavailable',summary:{accounts:23,copyChanged:accounts.filter(a=>a.changed).length,copyRetained:accounts.filter(a=>!a.changed).length,covers:covers.length,websiteResponses200:websites.length,textBoxes:covers.reduce((n,x)=>n+x.textCount,0)},accounts,covers,websites,publicChecks,additionalFields:{substackAbout:'Substack_About_최종.md',substackAboutSha256:hash(path.join(dir,'Substack_About_최종.md')),substackAuthorBio:'계정별_문구.json',tistorySlogan:'blank both existing slogan fields because the cover now includes text; preserve navigation'},render,sources,limitations:['Live upload crop and save/public verification pending','Mongolian native-human review not completed','Local copy budgets are not a guarantee of current platform editor limits']};
 fs.writeFileSync(path.join(dir,'최종검수.json'),JSON.stringify(report,null,2)+'\n');
 const rows=accounts.map(a=>`| ${a.id} | ${a.characters} | ${a.changed?'수정':'유지'} | ${a.review} |`).join('\n');
 fs.writeFileSync(path.join(dir,'최종검수.md'),`# SNS 최종 검수 기록\n\n${plan.copyRevision} · 로컬 검수 완료 / 이번 개정 외부 저장 미실시\n\n소개 23개, 수정 22개·유지 1개. 커버 11종과 Tistory 모바일 1종. 문자 영역 38개, 이미지 치수·용량·지문·겹침 확인. 공식 사이트 5곳 HTTP 200 확인. 로컬 최종본을 1440px / 390px에서 렌더링해 23개 카드, 글꼴 로드, 이미지 누락, 가로 넘침을 검사했다. 플랫폼 실물 검증과 원어민 감수는 별개이며 완료하지 않았다.\n\n[소개와 커버 전체](최종본.html) · [기계 검증 결과](최종검수.json)\n\n## 계정별 검토\n\n| 계정 | 소개 글자 수 | 결과 | 검토 내용 |\n|---|---:|---|---|\n${rows}\n\n## 링크\n\n${websites.map(x=>`- [${x.title}](${x.url}): ${x.status}`).join('\n')}\n\n## 크기 기준\n\n${sources.map(x=>`- [공식 안내](${x.url}): ${x.used}`).join('\n')}\n\n실제 로그인된 계정에서 최종 파일을 올린 뒤 자르기 창, 저장 안내, 공개 화면을 대조해야 한다. 브라우저 연결·파일 접근 허용·Google 로그인은 서로 다른 상태다. 새 최종 원고를 기존 13개 소개 반영 확인 기록과 혼동하지 않는다.\n`);
 console.log(JSON.stringify({revision:report.revision,...report.summary,render}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
