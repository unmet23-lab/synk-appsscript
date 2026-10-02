'use strict';

// Current canon + supplied photographic lockups. This builds layout, never redraws logos.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '../../../..');
const { loadVisions, sourceDigest } = require(path.join(root, 'tools/lib/비전정본.js'));
const tokens = JSON.parse(fs.readFileSync(path.join(root, 'docs/디자인_토큰.json'), 'utf8'));
const colors = Object.fromEntries(tokens.색.킷.map(c => [c.이름, c.hex]));
const spacing = Object.fromEntries(Object.entries(tokens.율.단계).map(([k,v]) => [k,v.px]));
const visions = loadVisions();
const kitDir = path.join(root, 'docs/홍보물/마케팅실행_20260909/브랜드킷');
const kit = JSON.parse(fs.readFileSync(path.join(kitDir, '배치명세.json'), 'utf8')).items;
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const data = (p,mime) => `data:${mime};base64,${fs.readFileSync(p).toString('base64')}`;
const suit = path.join(root,'docs/브랜드_폰트/SUIT/SUIT-Variable.woff2');
const inter = path.join(root,'docs/브랜드_폰트/InterTight/InterTight-Medium.ttf');
const interBold = path.join(root,'docs/브랜드_폰트/InterTight/InterTight-Bold.ttf');
const paper = path.join(root,'docs/Loom_자산/구움/펠트_종이바탕.webp');
const darkFelt = path.join(root,'docs/홍보물/첫게시물_20260910/assets/felt-dark.webp');
const stitchStrip = path.join(root,'docs/홍보물/마케팅실행_20260909/assets/stitch.webp');
const imagegenCovers = Object.fromEntries([
  'synk-linkedin-company',
  'yuhobuilds-youtube',
  'synkbrief-youtube',
  'lab-youtube',
  'yuhobuilds-x',
  'yuho-linkedin-primary',
  'shift-tistory',
  'shift-naverblog',
  'shift-pinterest',
  'shift-behance',
  'lab-facebook',
].map(id=>[id,path.join(__dirname,`${id}-gpt.png`)]));
// Corrected after actual platform crop inspection on 2026-09-19.
for (const id of ['synk-linkedin-company','yuhobuilds-youtube','shift-pinterest']) {
  imagegenCovers[id] = path.join(__dirname,`${id}-safe-gpt.png`);
}
const tistoryMobileImagegen = path.join(__dirname,'shift-tistory-mobile-gpt.png');
const feltPatches = {
  LAB:path.join(root,'docs/캐릭터/펠트패치_0815/Coral.png'),
  SHIFT:path.join(root,'docs/캐릭터/펠트패치_0815/Lapis.png'),
  PULSE:path.join(root,'docs/캐릭터/펠트패치_0815/Pop.png'),
  PATH:path.join(root,'docs/캐릭터/펠트패치_0815/Meadow.png'),
  BASE:path.join(root,'docs/캐릭터/펠트패치_0815/DeepWool.png'),
};
const fontCSS = `@font-face{font-family:'SUIT Variable';src:url('${data(suit,'font/woff2')}') format('woff2');font-weight:100 900}@font-face{font-family:'Inter Tight';src:url('${data(inter,'font/ttf')}') format('truetype');font-weight:500}@font-face{font-family:'Inter Tight';src:url('${data(interBold,'font/ttf')}') format('truetype');font-weight:700}*{font-synthesis:none}`;
const sourceFiles = new Set(['docs/비전_정본.md','docs/마케팅/프로필최신화_20260919/계정별_문구.json','docs/디자인_토큰.json','docs/브랜드_폰트_정본.md','docs/브랜드_폰트/SUIT/SUIT-Variable.woff2','docs/브랜드_폰트/InterTight/InterTight-Medium.ttf','docs/브랜드_폰트/InterTight/InterTight-Bold.ttf','docs/Loom_자산/구움/펠트_종이바탕.webp','docs/홍보물/첫게시물_20260910/assets/felt-dark.webp','docs/홍보물/마케팅실행_20260909/assets/stitch.webp','docs/캐릭터/펠트패치_0815/Coral.png','docs/캐릭터/펠트패치_0815/Lapis.png','docs/캐릭터/펠트패치_0815/Pop.png','docs/캐릭터/펠트패치_0815/Meadow.png','docs/캐릭터/펠트패치_0815/DeepWool.png','docs/마케팅/프로필최신화_20260919/커버/synk-linkedin-company-gpt.png']);
for(const generated of Object.values(imagegenCovers)) sourceFiles.add(path.relative(root,generated).replaceAll('\\','/'));
sourceFiles.add(path.relative(root,tistoryMobileImagegen).replaceAll('\\','/'));

const layouts = [
  {id:'synk-linkedin-company',brand:'synk',w:1512,h:256,mode:'company',label:'SYNK',headline:['LAB · SHIFT · PULSE · PATH','synk.im'],role:'Brand map, without a campaign slogan'},
  {id:'yuhobuilds-youtube',brand:'shift',w:2560,h:1440,mode:'youtube',label:'유호 · YUHO BUILDS',headline:['AI 회사 제작기','웹 · 콘텐츠 · 교육 · 자동화'],role:'SYNK SHIFT'},
  {id:'synkbrief-youtube',brand:'shift',w:2560,h:1440,mode:'youtube',label:'SYNK BRIEF',headline:['회사에서 쓰는 AI','소개서 · 홍보글 · 영상 · 자동화'],role:'짧고 정확한 실무 노트'},
  {id:'lab-youtube',brand:'lab',w:2560,h:1440,mode:'youtube',label:'한국어 학습 · K-LOFI24',headline:['Хийж үзмээр зүйлээ','солонгосоор хэлж үзье.'],role:'몽골어로 이해하고, 한국어로 직접 연습합니다.',languageStatus:'Existing public Mongolian direction retained; human native review remains incomplete'},
  {id:'yuhobuilds-x',brand:'shift',w:1500,h:500,mode:'profile',label:'유호 · YUHO BUILDS',headline:['AI 회사 제작기','웹 · 콘텐츠 · 교육 · 자동화'],role:'SYNK SHIFT'},
  {id:'yuho-linkedin-primary',brand:'shift',w:1584,h:396,mode:'profile',label:'유호 · SYNK SHIFT',headline:['AI 교육 · 컨설팅','기업 브랜딩'],role:'SYNK FOUNDER'},
  {id:'shift-tistory',brand:'shift',w:2400,h:900,mode:'wide',label:'유호 · SYNK SHIFT',headline:['AI 회사 제작기','웹 · 콘텐츠 · 교육 · 자동화'],role:'만든 결과와 수정 과정을 기록합니다.'},
  {id:'shift-naverblog',brand:'shift',w:966,h:360,mode:'naver-title',label:'유호 · SYNK SHIFT',headline:['AI 회사 제작기','웹 · 콘텐츠 · 교육 · 자동화'],role:'BUILD LOG'},
  {id:'shift-pinterest',brand:'shift',w:1600,h:900,mode:'wide',label:'SYNK SHIFT',headline:['브랜드 · 웹 · 콘텐츠','제작 기록'],role:'만든 결과와 수정 과정',roleSize:54},
  {id:'shift-behance',brand:'shift',w:3200,h:410,mode:'panorama',label:'유호 · SYNK SHIFT',headline:['BRAND · WEB · CONTENT','BUILD LOG'],role:'SYNK SHIFT'},
  {id:'lab-facebook',brand:'lab',w:1640,h:924,mode:'wide',label:'SYNK LAB',headline:['Хүүхэдтэйгээ ярилцах','солонгос хэл'],role:'관심사 · 한국어 표현 · 유학 생활 준비',roleSize:44,languageStatus:'Existing public Mongolian direction shortened; human native review remains incomplete'},
];

function logo(brand,x,y,w) {
  const item=kit.find(a=>a.brand===(brand==='synk'?'SYNK':brand.toUpperCase())&&a.variant==='Ink');
  const p=path.join(kitDir,item.file);
  if(hash(p)!==item.sha256) throw Error('Current logo differs from placement manifest: '+item.file);
  sourceFiles.add(path.relative(root,p).replaceAll('\\','/'));
  return `<image x="${x}" y="${y}" width="${w}" height="${w*item.height/item.width}" href="${data(p,'image/png')}" preserveAspectRatio="xMidYMid meet"/>`;
}
function text(s,x,y,size,weight=500,color=colors.Ink,attrs='') {
  return `<text x="${x}" y="${y}" fill="${color}" font-family="Inter Tight,SUIT Variable,sans-serif" font-weight="${weight}" font-size="${size}" letter-spacing="${size*-.04}" ${attrs}>${escape(s)}</text>`;
}
function lines(a) {
  if(!Array.isArray(a.headline)||a.headline.length!==2) throw Error('Each cover needs exactly two headline lines: '+a.id);
  return a.headline;
}
function feltPanel(key,x,y,w,h,r,idSuffix) {
  const p=feltPatches[key];
  const id=`felt-${key.toLowerCase()}-${idSuffix}`;
  return `<defs><clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/></clipPath><filter id="shadow-${id}" x="-30%" y="-40%" width="160%" height="190%"><feDropShadow dx="0" dy="6" stdDeviation="7" flood-color="#000" flood-opacity=".48"/></filter></defs><image x="${x}" y="${y}" width="${w}" height="${h}" href="${data(p,'image/png')}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})" filter="url(#shadow-${id})"/>`;
}
function feltStitch(x,y,w,h=22,id='line') {
  const tileW=Math.round(h*2048/283);
  return `<defs><pattern id="stitch-${id}" patternUnits="userSpaceOnUse" width="${tileW}" height="${h}"><image width="${tileW}" height="${h}" href="${data(stitchStrip,'image/webp')}" preserveAspectRatio="xMidYMid slice"/></pattern></defs><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#stitch-${id})"/>`;
}
function svg(a) {
  const imagegenCover=a.id==='shift-tistory'&&a.mode==='tistory-mobile'?tistoryMobileImagegen:imagegenCovers[a.id];
  if(imagegenCover) {
    if(!fs.existsSync(imagegenCover)) throw Error('Missing ImageGen cover base: '+a.id);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${a.w}" height="${a.h}" viewBox="0 0 ${a.w} ${a.h}" role="img" aria-label="${escape(a.label)} 펠트 커버"><image width="${a.w}" height="${a.h}" href="${data(imagegenCover,'image/png')}" preserveAspectRatio="xMidYMid slice"/></svg>`;
  }
  const accent=a.brand==='lab'?colors['Coral 3']:a.brand==='shift'?colors['Lapis Deep']:colors['Deep Wool'];
  const isYT=a.mode==='youtube';
  const zone=isYT?{x:558,y:536,w:1444,h:365}:a.mode==='company'?{x:64,y:16,w:1384,h:224}:a.mode==='profile'?{x:a.w*.28,y:a.h*.16,w:a.w*.66,h:a.h*.68}:{x:a.w*.1,y:a.h*.12,w:a.w*.8,h:a.h*.76};
  const {x,y,w,h}=zone;
  let body='';
  const displayLines=lines(a);
  const hasMongolian=/[А-Яа-яӨөҮүЁё]/.test(displayLines.join(''));
  const displayWeight=hasMongolian?700:800;
  const displayScale=hasMongolian?1.04:1;
  if(hasMongolian) {
    sourceFiles.add('docs/마케팅/전사새출발_20260914/LAB_몽골어_전체검토_요청1.json');
    sourceFiles.add('docs/마케팅/전사새출발_20260914/LAB_몽골어_전체검토_응답1.json');
  }
  if(a.mode==='tistory-mobile') {
    const inset=spacing.단+2;
    const titleLines=lines(a);
    const roleParts=a.role.split(' · ');
    body+=logo(a.brand,inset,inset,170);
    titleLines.forEach((line,i)=>{body+=text(line,inset,116+i*34,21,800);});
    body+=text(roleParts.slice(0,2).join(' · '),inset,224,16,500,colors['Deep Wool']);
    body+=text(roleParts.slice(2).join(' · '),inset,250,16,500,colors['Deep Wool']);
  } else if(a.mode==='naver-title') {
    // Actual Remocon title uploader: fixed 966px width, height 50–600px.
    // Keep the approved copy and lockup; lay out at 1:1 instead of cropping a 1920px banner.
    const inset=spacing.장;
    const roleParts=a.role.split(' · ');
    body+=logo(a.brand,inset,spacing.켜,240);
    body+=text(displayLines[0],inset,166,48,800);
    body+=text(displayLines[1],inset,226,48,800);
    body+=text(roleParts.slice(0,2).join(' · '),inset,282,26,500,colors['Deep Wool']);
    body+=text(roleParts.slice(2).join(' · '),inset,319,26,500,colors['Deep Wool']);
  } else if(a.mode==='panorama') {
    body+=logo(a.brand,850,145,470);
    body+=text(lines(a)[0],1350,180,88,800);
    body+=text(lines(a)[1],1350,288,88,800);
    body+=text(a.role,1350,360,52,500,colors['Deep Wool']);
  } else if(a.mode==='company') {
    // LinkedIn already shows the company avatar and name below the banner.
    // Keep the avatar overlap area quiet and use the cover only as a compact brand map.
    const items=[
      {key:'LAB',desc:'한국어 학습'},
      {key:'SHIFT',desc:'AI 교육 · 컨설팅'},
      {key:'PULSE',desc:'음악 · 영상 · 캐릭터'},
      {key:'PATH',desc:'유학 · 생활 · 취업'},
    ];
    body+=feltStitch(350,42,1062,26,'company');
    items.forEach((item,i)=>{
      const px=356+i*270;
      const ink=item.key==='SHIFT'?colors.Paper:colors.Ink;
      body+=feltPanel(item.key,px,63,234,118,18,i);
      body+=feltStitch(px+18,76,198,14,`card-${i}`);
      body+=text(item.key,px+22,128,30,700,ink,`letter-spacing="1"`);
      body+=text(item.desc,px+22,163,18,600,ink,`letter-spacing="-.15"`);
    });
    body+=feltPanel('BASE',1286,203,126,36,18,'url');
    body+=text('synk.im',1349,228,17,600,colors.Paper,`text-anchor="middle" letter-spacing=".5"`);
  } else {
    const lw=isYT?260:a.mode==='profile'?250:Math.min(w*.28,400);
    const sx=x;
    const sw=w;
    const baseSize=isYT?70:a.mode==='profile'?Math.min(68,sw/15):Math.min(110,sw/17.5);
    if(isYT) {
      body+=logo(a.brand,x,y,lw);
      body+=text(a.label,x+316,y+51,48,500,accent);
      body+=text(displayLines[0],sx,y+168,baseSize*displayScale,displayWeight);
      body+=text(displayLines[1],sx,y+257,baseSize*displayScale,displayWeight);
      body+=text(a.role,sx,y+340,42,500,colors['Deep Wool']);
    } else {
      body+=logo(a.brand,x,y,lw);
      const lh=lw*(kit.find(k=>k.brand===(a.brand==='synk'?'SYNK':a.brand.toUpperCase())&&k.variant==='Ink').height/kit.find(k=>k.brand===(a.brand==='synk'?'SYNK':a.brand.toUpperCase())&&k.variant==='Ink').width);
      const titleY=a.mode==='profile'?y+lh+baseSize*1.4:y+lh+baseSize*1.3;
      if(a.mode==='profile') body+=text(a.label,x+300,y+52,42,500,accent);
      body+=text(displayLines[0],x,titleY,baseSize*displayScale,displayWeight);
      body+=text(displayLines[1],x,titleY+baseSize*1.2,baseSize*displayScale,displayWeight);
      if(a.mode!=='profile') {
        const roleLines=a.role.split(' · ').length>3
          ? [a.role.split(' · ').slice(0,2).join(' · '),a.role.split(' · ').slice(2).join(' · ')]
          : [a.role];
        const roleSize=a.roleSize||Math.max(42,baseSize*.55);
        roleLines.forEach((line,i)=>{body+=text(line,x,titleY+baseSize*2.3+i*roleSize*1.35,roleSize,500,colors['Deep Wool']);});
      }
    }
  }
  // Existing Loom paper, kept quiet enough for exact type and photographic lockups.
  const ground=a.mode==='company'
    ? `<rect width="100%" height="100%" fill="${colors['Ink Deep']}"/><image width="100%" height="100%" href="${data(darkFelt,'image/webp')}" preserveAspectRatio="xMidYMid slice" opacity=".58"/><rect width="100%" height="100%" fill="${colors['Ink Deep']}" opacity=".18"/>`
    : `<rect width="100%" height="100%" fill="${colors.Paper}"/><image width="100%" height="100%" href="${data(paper,'image/webp')}" preserveAspectRatio="xMidYMid slice" opacity=".18"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${a.w}" height="${a.h}" viewBox="0 0 ${a.w} ${a.h}" role="img" aria-label="${escape(a.label+' — '+lines(a).join(' '))}"><defs><style>${fontCSS}</style></defs>${ground}${body}</svg>`;
}

async function main() {
  const args=process.argv.slice(2);
  if(args.length && (args.length!==2||args[0]!=='--only'||!layouts.some(a=>a.id===args[1]))) throw Error('Usage: node 만들기.cjs [--only <cover-id>]');
  const selected=args.length?layouts.filter(a=>a.id===args[1]):layouts;
  const manifestPath=path.join(__dirname,'명세.json');
  const previous=args.length?JSON.parse(fs.readFileSync(manifestPath,'utf8')):null;
  if(previous&&previous.visionDigest!==sourceDigest()) throw Error('Vision changed: a partial rebuild cannot certify unchanged covers');
  const playwright=require(process.env.SYNK_PLAYWRIGHT_MODULE||'C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  const browser=await playwright.chromium.launch({channel:'chrome',headless:true});
  const manifest={...(previous||{}),status:previous?.status||'draft-not-published',visionDigest:sourceDigest(),builtAt:new Date().toISOString(),outputs:previous?.outputs||[],sources:previous?.sources||[]};
  try {
    for(const a of selected) {
      const s=svg(a);
      fs.writeFileSync(path.join(__dirname,a.id+'.svg'),s);
      const doc=`<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:${a.w}px;height:${a.h}px;overflow:hidden}svg{display:block}</style>${s}`;
      const temp=path.join(__dirname,a.id+'.html');
      fs.writeFileSync(temp,doc);
      const page=await browser.newPage({viewport:{width:a.w,height:a.h},deviceScaleFactor:1});
      await page.goto(pathToFileURL(temp).href);
      await page.evaluate(async()=>{await document.fonts.ready;await document.fonts.load('700 16px "Inter Tight"');});
      const qa=await page.evaluate(()=>({fonts:[...document.fonts].map(f=>({family:f.family,status:f.status})),text:[...document.querySelectorAll('text')].map(el=>{const b=el.getBBox();return {text:el.textContent,x:b.x,y:b.y,w:b.width,h:b.height};})}));
      if(!imagegenCovers[a.id]&&qa.fonts.some(f=>f.status!=='loaded')) throw Error('Font not loaded '+a.id);
      if(qa.text.some(t=>t.x<0||t.y<0||t.x+t.w>a.w||t.y+t.h>a.h)) throw Error('Text beyond canvas '+a.id);
      if(a.mode==='naver-title') {
        qa.uploadTarget={width:966,minHeight:50,maxHeight:600,basis:'Main agent observed Naver Remocon title upload UI on 2026-09-14; not a universal mobile-cover specification'};
        if(a.w!==966||a.h<50||a.h>600) throw Error('Outside observed Naver title upload size');
        if(qa.text.some(t=>t.x<spacing.장||t.x+t.w>a.w-spacing.장||t.y<spacing.켜||t.y+t.h>a.h-spacing.단)) throw Error('Text beyond Naver title inset');
      }
      if(a.mode==='youtube') {
        const safe={x:508.125,y:508.75,w:1543.75,h:422.5}; // 1235x338 at 2048x1152, scaled 1.25.
        qa.safeArea={...safe,basis:'Proportional calculation from official minimum size, not a live crop'};
        if(qa.text.some(t=>t.x<safe.x||t.y<safe.y||t.x+t.w>safe.x+safe.w||t.y+t.h>safe.y+safe.h)) throw Error('Text beyond YouTube calculated safe area '+a.id);
      }
      const png=path.join(__dirname,a.id+'.png');
      await page.screenshot({path:png});
      const tistoryMobile=a.id==='shift-tistory';
      const mobileHeight=tistoryMobile?300:Math.ceil(390*(a.mode==='youtube'?422.5/1543.75:a.h/a.w));
      const mobileSvg=tistoryMobile?svg({...a,w:390,h:300,mode:'tistory-mobile'}):a.mode==='youtube'?s.replace(`viewBox="0 0 ${a.w} ${a.h}"`,'viewBox="508.125 508.75 1543.75 422.5"'):s;
      const mobileDoc=`<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:390px;height:${mobileHeight}px;overflow:hidden}svg{display:block;width:390px;height:${mobileHeight}px}</style>${mobileSvg}`;
      const mobileHTML=path.join(__dirname,a.id+'.mobile.html');
      fs.writeFileSync(mobileHTML,mobileDoc);
      await page.setViewportSize({width:390,height:mobileHeight});
      await page.goto(pathToFileURL(mobileHTML).href);
      await page.evaluate(()=>document.fonts.ready);
      let mobileQa;
      if(tistoryMobile) {
        mobileQa=await page.evaluate(()=>({fonts:[...document.fonts].map(f=>({family:f.family,status:f.status})),text:[...document.querySelectorAll('text')].map(el=>{const b=el.getBBox();return {text:el.textContent,fontSize:Number.parseFloat(getComputedStyle(el).fontSize),x:b.x,y:b.y,w:b.width,h:b.height};})}));
        if(mobileQa.fonts.some(f=>f.status!=='loaded')) throw Error('Tistory mobile font not loaded');
        if(mobileQa.text.some(t=>t.fontSize<16||t.x<spacing.단||t.x+t.w>390-spacing.단||t.y<spacing.단||t.y+t.h>300-spacing.단)) throw Error('Tistory mobile text too small or beyond inset');
      }
      const mobileFile=a.id+'.mobile.png';
      await page.screenshot({path:path.join(__dirname,mobileFile)});
      const mobileDetail=tistoryMobile?{layout:'dedicated-mobile-title',sha256:hash(path.join(__dirname,mobileFile)),bytes:fs.statSync(path.join(__dirname,mobileFile)).size,qa:mobileQa}:{};
      const output={...a,file:a.id+'.png',bytes:fs.statSync(png).size,sha256:hash(png),qa,mobile:{file:mobileFile,width:390,height:mobileHeight,scope:tistoryMobile?'Dedicated mobile cover asset; local render only, not actual platform UI':'Simulated layout only, not actual platform UI',...mobileDetail},liveCropVerified:false};
      const outputIndex=manifest.outputs.findIndex(item=>item.id===a.id);
      if(outputIndex<0) manifest.outputs.push(output); else manifest.outputs[outputIndex]=output;
      await page.close();
    }
  } finally { await browser.close(); }
  const sourceMap=new Map(manifest.sources.map(source=>[source.file,source]));
  for(const file of sourceFiles) sourceMap.set(file,{file,sha256:hash(path.join(root,file))});
  manifest.sources=[...sourceMap.values()];
  fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2));
  const cards=layouts.map(a=>`<section><h2>${escape(a.label)} <small>${a.w} × ${a.h}</small></h2><img src="${a.id}.png" alt="${escape(lines(a).join(' '))}"><p>${escape(a.id)} · 공개 저장 전 시안</p></section>`).join('');
  fs.writeFileSync(path.join(__dirname,'index.html'),`<!doctype html><html lang="ko"><meta charset="utf-8"><title>SYNK 새 펠트 커버</title><style>${fontCSS}body{margin:0;padding:48px;background:${colors.Oat};color:${colors.Ink};font-family:Inter Tight,SUIT Variable,sans-serif}main{max-width:1400px;margin:auto}h1{font-size:40px}h2{font-size:23px}small,p{font-size:16px;font-weight:500;color:${colors['Deep Wool']}}section{margin:48px 0}img{display:block;width:100%;height:auto;box-shadow:0 16px 44px ${colors.Ink}12}p{margin-top:12px}</style><main><h1>새 커버 · 펠트 시스템</h1><p>ImageGen으로 만든 실제 펠트 장면을 계정별 규격에 맞춰 편집한 로컬 시안. 공개 저장은 별도 확인합니다.</p>${cards}</main></html>`);
  console.log(JSON.stringify({count:manifest.outputs.length,rendered:selected.map(a=>a.id),output:__dirname,status:manifest.status}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
