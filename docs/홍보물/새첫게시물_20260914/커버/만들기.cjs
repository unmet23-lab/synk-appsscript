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
const fontCSS = `@font-face{font-family:'SUIT Variable';src:url('${data(suit,'font/woff2')}') format('woff2');font-weight:100 900}@font-face{font-family:'Inter Tight';src:url('${data(inter,'font/ttf')}') format('truetype');font-weight:500}@font-face{font-family:'Inter Tight';src:url('${data(interBold,'font/ttf')}') format('truetype');font-weight:700}*{font-synthesis:none}`;
const sourceFiles = new Set(['docs/비전_정본.md','docs/디자인_토큰.json','docs/브랜드_폰트_정본.md','docs/브랜드_폰트/SUIT/SUIT-Variable.woff2','docs/브랜드_폰트/InterTight/InterTight-Medium.ttf','docs/브랜드_폰트/InterTight/InterTight-Bold.ttf','docs/Loom_자산/구움/펠트_종이바탕.webp']);

const layouts = [
  {id:'synk-linkedin-company',brand:'synk',w:1512,h:256,mode:'company',label:'SYNK',role:'한 사람을 깊이 이해한 개인화 시스템을 만듭니다.'},
  {id:'yuhobuilds-youtube',brand:'shift',w:2560,h:1440,mode:'youtube',label:'유호 · AI와 회사 만들기',role:'직접 해보고, 막히면 고치고, 쓸 만한 방법을 나눕니다.'},
  {id:'synkbrief-youtube',brand:'shift',w:2560,h:1440,mode:'youtube',label:'SYNK 브리핑',role:'회사 일에 쓰는 AI · 방법과 판단을 나눕니다.'},
  {id:'lab-youtube',brand:'lab',w:2560,h:1440,mode:'youtube',label:'한국어 · K-LOFI24',role:'가고 싶은 방향에 집중할 수 있는 환경을 만듭니다.',displayLines:['Хийж үзмээр зүйлээ','солонгосоор хэлж үзье.'],languageStatus:'Mongolian channel-role draft; not native-reviewed; Korean canon retained'},
  {id:'yuhobuilds-x',brand:'shift',w:1500,h:500,mode:'profile',label:'유호 · AI와 회사 만들기',role:'직접 해보고, 막히면 고치고, 쓸 만한 방법을 나눕니다.'},
  {id:'yuho-linkedin-primary',brand:'shift',w:1584,h:396,mode:'profile',label:'유호 · SYNK',role:'개인과 조직을 연결하는 일을 만듭니다.'},
  {id:'shift-tistory',brand:'shift',w:2400,h:900,mode:'wide',label:'유호 · AI와 회사 만들기',role:'기관 강의 · 기업 컨설팅 · 브랜딩과 광고 · 유학과 취업 연계'},
  {id:'shift-naverblog',brand:'shift',w:966,h:360,mode:'naver-title',label:'SYNK SHIFT',role:'기관 강의 · 기업 컨설팅 · 브랜딩과 광고 · 유학과 취업 연계'},
  {id:'shift-pinterest',brand:'shift',w:1600,h:900,mode:'wide',label:'SYNK SHIFT',role:'기업의 가치를 알리고, 고객과 연결합니다.',roleSize:60},
  {id:'shift-behance',brand:'shift',w:3200,h:410,mode:'panorama',label:'유호 · SYNK SHIFT',role:'브랜딩과 광고로 기업의 가치를 알리고, 고객과 연결합니다.'},
  {id:'lab-facebook',brand:'lab',w:1640,h:924,mode:'wide',label:'SYNK LAB · 가족의 대화',role:'가고 싶은 방향에 집중할 수 있는 환경을 만듭니다.',roleSize:44,displayLines:['Хүүхэдтэйгээ сонирхол,','сурах чиглэлийн талаар ярилцъя.'],languageStatus:'Mongolian parent-channel role draft; not native-reviewed; Korean canon retained'},
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
function lines(brand) {
  const v=visions[brand].headline;
  if(brand==='shift') return ['개인과 조직의 성장이','서로의 기회가 되는 미래를 만듭니다.'];
  if(brand==='lab') return ['가고 싶은 방향에','집중할 수 있는 환경을 만듭니다.'];
  return ['저마다의 삶을 온전히 누리는','미래를 만듭니다.'];
}
function svg(a) {
  const accent=a.brand==='lab'?colors['Coral 3']:a.brand==='shift'?colors['Lapis Deep']:colors['Deep Wool'];
  const isYT=a.mode==='youtube';
  const zone=isYT?{x:558,y:536,w:1444,h:365}:a.mode==='company'?{x:64,y:16,w:1384,h:224}:a.mode==='profile'?{x:a.w*.28,y:a.h*.16,w:a.w*.66,h:a.h*.68}:{x:a.w*.1,y:a.h*.12,w:a.w*.8,h:a.h*.76};
  const {x,y,w,h}=zone;
  let body='';
  const displayLines=a.displayLines||lines(a.brand);
  const displayWeight=a.displayLines?700:800;
  const displayScale=a.displayLines?1.04:1;
  if(a.displayLines) sourceFiles.add('docs/마케팅/전사새출발_20260914/LAB_몽골어_초안.md');
  if(a.mode==='tistory-mobile') {
    const inset=spacing.단;
    const titleLines=['개인과 조직의 성장이','서로의 기회가 되는','미래를 만듭니다.'];
    if(titleLines.join(' ')!==visions[a.brand].headline) throw Error('Tistory mobile canon copy mismatch');
    const roleParts=a.role.split(' · ');
    body+=logo(a.brand,inset,inset,170);
    titleLines.forEach((line,i)=>{body+=text(line,inset,112+i*36,26,800);});
    body+=text(roleParts.slice(0,2).join(' · '),inset,236,16,500,colors['Deep Wool']);
    body+=text(roleParts.slice(2).join(' · '),inset,262,16,500,colors['Deep Wool']);
  } else if(a.mode==='naver-title') {
    // Actual Remocon title uploader: fixed 966px width, height 50–600px.
    // Keep the approved copy and lockup; lay out at 1:1 instead of cropping a 1920px banner.
    const inset=spacing.장;
    const roleParts=a.role.split(' · ');
    body+=logo(a.brand,inset,spacing.켜,240);
    body+=text(displayLines[0],inset,166,48,800);
    body+=text(displayLines[1],inset,226,48,800);
    body+=text(roleParts.slice(0,3).join(' · '),inset,282,26,500,colors['Deep Wool']);
    body+=text(roleParts.slice(3).join(' · '),inset,319,26,500,colors['Deep Wool']);
  } else if(a.mode==='panorama') {
    body+=logo(a.brand,850,145,470);
    body+=text(lines(a.brand)[0],1350,180,88,800);
    body+=text(lines(a.brand)[1],1350,288,88,800);
    body+=text(a.role,1350,360,52,500,colors['Deep Wool']);
  } else if(a.mode==='company') {
    body+=logo(a.brand,x,y+spacing.참,230);
    body+=text(lines(a.brand)[0],x+340,y+64,54,800);
    body+=text(lines(a.brand)[1],x+340,y+129,54,800);
    body+=text(visions[a.brand].subtext,x+340,y+201,34,500,colors['Deep Wool']);
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
        const roleLines=a.role.includes('기관 강의')?['기관 강의 · 기업 컨설팅 · 브랜딩과 광고','유학과 취업 연계']: [a.role];
        const roleSize=a.roleSize||Math.max(42,baseSize*.55);
        roleLines.forEach((line,i)=>{body+=text(line,x,titleY+baseSize*2.3+i*roleSize*1.35,roleSize,500,colors['Deep Wool']);});
      }
    }
  }
  // Existing Loom paper, kept quiet enough for exact type and photographic lockups.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${a.w}" height="${a.h}" viewBox="0 0 ${a.w} ${a.h}" role="img" aria-label="${escape(a.label+' — '+visions[a.brand].headline)}"><defs><style>${fontCSS}</style></defs><rect width="100%" height="100%" fill="${colors.Paper}"/><image width="100%" height="100%" href="${data(paper,'image/webp')}" preserveAspectRatio="xMidYMid slice" opacity=".18"/>${body}</svg>`;
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
      if(lines(a.brand).join(' ')!==visions[a.brand].headline) throw Error('Canon copy mismatch '+a.id);
      fs.writeFileSync(path.join(__dirname,a.id+'.svg'),s);
      const doc=`<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:${a.w}px;height:${a.h}px;overflow:hidden}svg{display:block}</style>${s}`;
      const temp=path.join(__dirname,a.id+'.html');
      fs.writeFileSync(temp,doc);
      const page=await browser.newPage({viewport:{width:a.w,height:a.h},deviceScaleFactor:1});
      await page.goto(pathToFileURL(temp).href);
      await page.evaluate(async()=>{await document.fonts.ready;await document.fonts.load('700 16px "Inter Tight"');});
      const qa=await page.evaluate(()=>({fonts:[...document.fonts].map(f=>({family:f.family,status:f.status})),text:[...document.querySelectorAll('text')].map(el=>{const b=el.getBBox();return {text:el.textContent,x:b.x,y:b.y,w:b.width,h:b.height};})}));
      if(qa.fonts.some(f=>f.status!=='loaded')) throw Error('Font not loaded '+a.id);
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
  const cards=layouts.map(a=>`<section><h2>${escape(a.label)} <small>${a.w} × ${a.h}</small></h2><img src="${a.id}.png" alt="${escape(visions[a.brand].headline)}"><p>${escape(a.id)} · 공개 저장 전 시안</p></section>`).join('');
  fs.writeFileSync(path.join(__dirname,'index.html'),`<!doctype html><html lang="ko"><meta charset="utf-8"><title>SYNK 새 커버</title><style>${fontCSS}body{margin:0;padding:48px;background:${colors.Oat};color:${colors.Ink};font-family:Inter Tight,SUIT Variable,sans-serif}main{max-width:1400px;margin:auto}h1{font-size:40px}h2{font-size:23px}small,p{font-size:16px;font-weight:500;color:${colors['Deep Wool']}}section{margin:48px 0}img{display:block;width:100%;height:auto;box-shadow:0 16px 44px ${colors.Ink}12}p{margin-top:12px}</style><main><h1>새 커버 · 비전의 자리</h1><p>공식 로고와 최신 비전을 보존한 편집 원본. 계정별 실제 잘림과 공개 저장은 별도 확인합니다.</p>${cards}</main></html>`);
  console.log(JSON.stringify({count:manifest.outputs.length,rendered:selected.map(a=>a.id),output:__dirname,status:manifest.status}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
