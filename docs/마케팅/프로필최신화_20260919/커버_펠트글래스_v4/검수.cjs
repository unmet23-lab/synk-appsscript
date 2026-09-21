'use strict';
// Local file / geometry checks only. No browser, sign-in, network or publication.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const sharp=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const dir=__dirname,parent=path.dirname(dir),read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={'lab-youtube':'LAB · YouTube','lab-facebook':'LAB · Facebook','yuhobuilds-youtube':'유호 · YouTube','synkbrief-youtube':'SYNK 브리핑 · YouTube','yuhobuilds-x':'유호 · X','yuho-linkedin-primary':'유호 · LinkedIn','synk-linkedin-company':'SYNK · LinkedIn','shift-tistory':'SHIFT · Tistory','shift-tistory-mobile':'SHIFT · Tistory 모바일','shift-naverblog':'SHIFT · Naver 블로그','shift-behance':'SHIFT · Behance','shift-pinterest':'SHIFT · Pinterest'};
const inside=(a,b)=>a.x>=b.x-1&&a.y>=b.y-1&&a.x+a.w<=b.x+b.w+1&&a.y+a.h<=b.y+b.h+1;
const overlap=(a,b)=>Math.min(a.x+a.w,b.x+b.w)>Math.max(a.x,b.x)&&Math.min(a.y+a.h,b.y+b.h)>Math.max(a.y,b.y);
async function main(){
 const manifest=read(path.join(dir,'명세.json')),plan=read(path.join(parent,'계정별_문구.json')),prior=read(path.join(parent,'최종검수.json'));
 assert.equal(manifest.revision,plan.coverRevision);assert.equal(manifest.outputs.length,12);assert.equal(plan.accounts.length,23);assert.equal(new Set(plan.accounts.map(a=>a.id)).size,23);
 const covers=[];
 for(const o of manifest.outputs){
  const file=path.join(dir,o.file),meta=await sharp(file).metadata(),bytes=fs.statSync(file).size;
  assert.equal(meta.width,o.w);assert.equal(meta.height,o.h);assert.equal(sha(file),o.sha256);assert(bytes<(o.id.endsWith('-youtube')?6000000:3000000));
  assert(Math.abs(o.contentCenterY-o.targetCenterY)<=5,'Unbalanced group '+o.id);
  for(const [i,t] of o.text.entries()){
   assert(t.fonts.length&&t.fonts.every(f=>['ko800','ko500','latin700','latin500'].includes(f)),'Unknown font '+o.id);
   assert(inside(t,o.safe));for(const other of o.text.slice(i+1))assert(!overlap(t,other));for(const asset of o.assets)assert(!overlap(t,asset));
  }
  for(const a of o.assets)assert(inside(a,o.safe));
  if(o.background==='pure-white'){
   const pixel=await sharp(file).extract({left:0,top:0,width:1,height:1}).removeAlpha().raw().toBuffer();assert.deepEqual([...pixel],[255,255,255]);
  }
  const preview=await sharp(path.join(dir,o.id+'.preview.png')).metadata();assert.equal(preview.width,390);
  covers.push({id:o.id,name:names[o.id],file:o.file,width:meta.width,height:meta.height,bytes,sha256:o.sha256,textCount:o.text.length,localGeometry:'pass',background:o.background,localPreviewWidth:390,liveCropVerified:false});
 }
 const accounts=plan.accounts.map(a=>{
  const before=prior.accounts.find(p=>p.id===a.id);assert(before);
  for(const field of ['website','handle','languageReview'])assert.equal(a[field],before[field],'Identity changed '+a.id+' '+field);
  if(/^2026-09-19-natural-profile-v[56]$/.test(plan.copyRevision)){
   assert.notEqual(a.bio,before.bio,'Bio not rewritten '+a.id);
   const limit=a.bioLimit||(['Instagram','Threads'].includes(a.platform)?150:a.platform==='Facebook'?101:1000);
   assert(Array.from(a.bio).length<=limit,'Bio exceeds local budget '+a.id);assert.equal(a.bio,a.bio.trim());assert(!/[\u200B\uFEFF\uFFFD]/u.test(a.bio));
  }else for(const field of ['bio','headline','tagline','authorBio'])assert.equal(a[field],before[field],'Approved copy changed '+a.id+' '+field);
  for(const field of ['cover','mobileCover'])if(a[field])assert(fs.existsSync(path.join(parent,a[field])));
  return {...a,review:/^2026-09-19-natural-profile-v[56]$/.test(plan.copyRevision)?'사용자 요청으로 소개를 새로 작성했습니다. 계정의 독자와 역할, 준비 중인 서비스의 상태, 길이와 줄바꿈을 검토했으며 핸들과 공식 링크는 유지했습니다.':before.review,characters:Array.from(a.bio).length};
 });
 assert.equal(accounts.filter(a=>a.cover).length,11);assert.equal(accounts.filter(a=>a.mobileCover).length,1);
 const cards=accounts.map((a,i)=>`<article id="${a.id}"><p class="meta">${String(i+1).padStart(2,'0')} · ${esc(a.platform)} · ${esc(a.handle)}</p><h2>${esc(names[a.cover?path.basename(a.cover,'.png'):a.id]||a.id)}</h2>${a.cover?`<a href="${esc(a.cover)}"><img src="${esc(a.cover.replace(/\.png$/,'.display.png'))}" alt="${esc(a.platform)} 새 커버" loading="lazy"></a>`:'<p class="meta">별도 커버 제작 대상 아님 · 승인 소개와 기존 프로필 사진 유지</p>'}${a.mobileCover?`<details><summary>Tistory 모바일 전용</summary><img class="phone" src="${esc(a.mobileCover)}" alt="Tistory 모바일 커버"></details>`:''}${a.headline?`<p class="headline">${esc(a.headline)}</p>`:''}${a.tagline?`<p class="headline">${esc(a.tagline)}</p>`:''}<div class="bio">${esc(a.bio)}</div>${a.authorBio?`<p class="meta">작성자 소개</p><div class="bio">${esc(a.authorBio)}</div>`:''}${a.aboutSource?`<p><a href="${esc(a.aboutSource)}">About 원고</a></p>`:''}<p class="meta"><a href="${esc(a.website)}">${esc(a.website)}</a> · 소개 ${a.characters}자</p><details><summary>소개 검토 내용</summary><p>${esc(a.review)}</p>${a.additionalFieldNote?`<p>${esc(a.additionalFieldNote)}</p>`:''}${a.languageReview?'<p>몽골어 AI 검토본 · 원어민 감수 미완료</p>':''}</details></article>`).join('');
 const html=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SYNK SNS · 소개 23개와 펠트·유리 커버</title><style>@font-face{font-family:SUIT;src:url('../../브랜드_폰트/SUIT/SUIT-Variable.woff2')}*{box-sizing:border-box}body{margin:0;color:#242424;background:#fff;font-family:SUIT,system-ui,sans-serif;line-height:1.65}main{max-width:1240px;margin:auto;padding:48px 24px 80px}h1{font-size:34px;letter-spacing:-.04em;line-height:1.25}h2{font-size:23px;line-height:1.35}.intro{max-width:860px}.meta{font-size:13px;color:#626262;overflow-wrap:anywhere}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}article{min-width:0;padding:24px;border:1px solid #e7e7e7;border-radius:16px}article img{display:block;width:100%;height:auto;border-radius:8px}.phone{max-width:390px}.bio{white-space:pre-wrap;overflow-wrap:anywhere;margin:24px 0}.headline{font-weight:750}details{font-size:14px;margin:18px 0}summary{cursor:pointer}a{color:#334e8a;overflow-wrap:anywhere}nav{margin:24px 0 36px}@media(max-width:650px){main{padding:26px 16px}.grid{grid-template-columns:1fr}article{padding:18px}h1{font-size:27px}}</style><main><h1>SNS 소개와 커버</h1><p class="intro">승인한 소개 23개는 유지하고, 커버 제작 대상 11개 계정과 Tistory 모바일용 1종을 새로 마감했습니다. 펠트와 유리의 질감은 이어 가되 채널 역할에 맞게 글·소품·흰색과 검정 바탕을 나눴습니다. 브랜드키트 정본은 변경하지 않았습니다.</p><p class="meta">커버: ${manifest.revision} · 로컬 완성 / v4 업로드 0건<br>소개: ${plan.copyRevision} · 이전에 11개 저장·표시 확인, 나머지 미완료. 자세한 게시 상태는 실행상태.json과 구분해 관리합니다.<br>몽골어 원어민 감수와 새 커버의 실제 플랫폼 자르기 확인은 미완료입니다.</p><nav><a href="커버_펠트글래스_v4/index.html">커버 12종 크게 보기 →</a> · <a href="커버_펠트글래스_v4/전체보기.png">전체 이미지</a> · <a href="커버_펠트글래스_v4/제작기록.md">제작 기록</a></nav><div class="grid">${cards}</div></main></html>`;
 const currentHtml=html.replace(/<p class="intro">[\s\S]*?<\/p>/,'<p class="intro">소개 23개를 계정의 독자와 역할에 맞춰 다시 썼습니다. 승인된 펠트·유리 커버와 프로필 사진은 그대로 유지했습니다. 글로벌 브랜드키트는 변경하지 않았습니다.</p>').replace(/<p class="meta">커버:[\s\S]*?<\/p>/,`<p class="meta">커버: ${manifest.revision} · 소개: ${plan.copyRevision}<br>현재 계정별 저장·공개 확인 결과는 <a href="반영_v5.json">최신 반영 기록</a>에서 구분합니다. 이전 버전의 게시 실적을 이번 버전으로 세지 않습니다.<br>몽골어 원어민 감수는 미완료입니다.</p>`);
 const publicationFile=plan.publicationLedger||'반영_v5.json';
 const publication=read(path.join(parent,publicationFile));
 const statusSection=`<section aria-label="반영 상태"><h2>실제 반영 상태</h2><p>소개 ${publication.summary.biosSaved}/23개 저장 확인 · 커버 ${publication.summary.coverAccountsVerified}/11개 계정 공개 확인. 저장 확인과 공개 전체 문구 확인은 계정별로 구분합니다.</p><p><a href="반영_v5.json">계정별 확인 근거와 남은 작업</a></p><h2>흰 바탕 스티치 로고</h2><p>LinkedIn 회사 프로필에 반영했습니다. 기존 인물·마스코트와 이미 흰 바탕인 자수 배지는 유지합니다.</p><a href="프로필_흰색_v1/synk-white-stitch-v2.png"><img src="프로필_흰색_v1/synk-white-stitch-v2.png" width="220" height="220" alt="흰 바탕의 SYNK 펠트 로고, 밝은 실 스티치와 잔털" style="max-width:100%;height:auto"></a><p><a href="프로필_흰색_v1/제작기록.md">원본과 이미지 편집 프롬프트</a></p></section>`;
 fs.writeFileSync(path.join(parent,'최종본.html'),currentHtml.replace('<div class="grid">',statusSection+'<div class="grid">').replaceAll('반영_v5.json',publicationFile));
 const localReferences=[];
 for(const relative of ['index.html','../최종본.html','../디테일비교.html']){
  const file=path.resolve(dir,relative),source=fs.readFileSync(file,'utf8');
  for(const hit of source.matchAll(/(?:src|href)="([^"]+)"|url\(['"]?([^)'"\s]+)['"]?\)/g)){
   const target=hit[1]||hit[2];if(/^(?:https?:|data:|#)/.test(target))continue;
   const targetPath=path.resolve(path.dirname(file),decodeURIComponent(target.split('#')[0]));assert(fs.existsSync(targetPath),'Broken reference '+target);
   localReferences.push({page:relative,target});
  }
 }
 const assetDir=path.join(dir,'assets');const assets=fs.readdirSync(assetDir).filter(f=>f.endsWith('.png')).map(file=>({file:'assets/'+file,sha256:sha(path.join(assetDir,file)),bytes:fs.statSync(path.join(assetDir,file)).size}));
 const result={revision:manifest.revision,copyRevision:plan.copyRevision,checkedAt:new Date().toISOString(),method:'Local PNG metadata, hashes, geometry, glyph fonts, white pixels, relative file references; no browser or network',summary:{covers:covers.length,textBoxes:covers.reduce((n,o)=>n+o.textCount,0),rewrittenBios:accounts.filter(a=>a.bio!==prior.accounts.find(p=>p.id===a.id).bio).length,identityAndLinksUnchanged:accounts.length,coverAccounts:11,mobileVariant:1,localReferences:localReferences.length},covers,assets,accounts:accounts.map(a=>({id:a.id,bio:a.bio,headline:a.headline,tagline:a.tagline,authorBio:a.authorBio,characters:a.characters,review:a.review})),localReferences,limitations:['This file checks local artifacts only; current publication evidence is in ../반영_v5.json.','390px images were visually reviewed; no new browser-render validation.','Mongolian copy retained from approved AI review; native-speaker review incomplete.']};
 result.limitations[0]=`This file checks local artifacts only; current publication evidence is in ../${publicationFile}.`;
 assert.equal(publication.summary.biosSaved,Object.values(publication.accounts).filter(a=>a.bio==='saved').length,'Publication count mismatch');
 fs.writeFileSync(path.join(dir,'검수.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result.summary));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
