'use strict';
// Editable SVG typography over the existing approved ImageGen photographs.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const sharp=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const dir=__dirname,root=path.resolve(dir,'../../../..'),old=path.join(dir,'../커버');
const at=n=>path.join(dir,n),src=n=>path.join(old,n);
const plan=JSON.parse(fs.readFileSync(at('문구.json'),'utf8'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const imageCache=new Map();
const uri=(p,m='image/png')=>imageCache.get(p)||`data:${m};base64,${fs.readFileSync(p).toString('base64')}`;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const tokens=JSON.parse(fs.readFileSync(path.join(root,'docs/디자인_토큰.json'),'utf8'));
const colors=Object.fromEntries(tokens.색.킷.map(x=>[x.이름,x.hex]));
const kitDir=path.join(root,'docs/홍보물/마케팅실행_20260909/브랜드킷');
const kit=JSON.parse(fs.readFileSync(path.join(kitDir,'배치명세.json'),'utf8')).items;
const paper=path.join(root,'docs/Loom_자산/구움/펠트_종이바탕.webp');
const black=path.join(root,'docs/홍보물/첫게시물_20260910/assets/felt-dark.webp');
const req=[];const designs=[];
function T(d,text,x,y,size,maxWidth,weight=800,kind='head') {const i=req.push({text,size,weight,tracking:kind==='head'?-.04:-.02})-1;d.text.push({i,text,x,y,size,maxWidth,weight,kind});}
function logo(d,brand,x,y,w){d.logo={brand,x,y,w};}
function photo(d,file,crop,x,y,w,h){d.photos.push({file,crop,x,y,w,h});}
const shiftCrop=[560,180,1450,370],briefCrop=[35,230,1600,415],labCrop=[15,245,1635,420];
for(const p of plan.covers){
  const d={...p,text:[],photos:[],dark:true,w:1500,h:500};
  if(p.id==='synk-linkedin-company'){
    Object.assign(d,{w:1512,h:256,safe:{x:320,y:20,w:1030,h:220}});
    T(d,p.headline[0],340,86,49,570);T(d,p.headline[1],340,146,49,570);
    T(d,p.sub,340,216,40,590,500,'sub');T(d,p.footer,1140,214,34,185,500,'sub');
    photo(d,'synk-company-safe-gpt-source.png',[580,250,1330,190],950,42,380,130);
  }else if(p.id.endsWith('-youtube')){
    Object.assign(d,{w:2560,h:1440,safe:{x:508,y:509,w:1544,h:422},dark:p.id==='yuhobuilds-youtube'});
    if(p.id==='yuhobuilds-youtube'){
      T(d,p.label,580,582,40,750,500,'label');
      T(d,p.headline[0],580,681,77,790);T(d,p.headline[1],580,775,77,790);
      T(d,p.sub,584,851,40,805,500,'sub');
      photo(d,'shift-master-gpt-source.png',[655,195,642,320],1435,565,555,320);
    }else if(p.id==='synkbrief-youtube'){
      T(d,p.label,580,582,40,750,500,'label');
      T(d,p.headline[0],580,681,77,805);T(d,p.headline[1],580,775,77,805);
      T(d,p.sub,584,851,40,805,500,'sub');
      photo(d,'synkbrief-master-gpt-source.png',briefCrop,1435,591,555,254);
    }else{
      logo(d,'LAB',580,539,230);
      T(d,p.headline[0],580,687,58,820);T(d,p.headline[1],580,761,52,830);
      T(d,p.sub,584,845,40,820,500,'sub');
      photo(d,'lab-master-gpt-source.png',[15,245,960,420],1480,581,500,295);
    }
  }else if(p.id==='yuhobuilds-x'){
    T(d,p.label,440,100,34,550,500,'label');
    T(d,p.headline[0],440,192,60,610);T(d,p.headline[1],440,270,60,620);
    T(d,p.sub,444,345,39,620,500,'sub');
    photo(d,'shift-master-gpt-source.png',[1600,200,410,330],1100,109,310,270);
  }else if(p.id==='yuho-linkedin-primary'){
    Object.assign(d,{w:1584,h:396});
    T(d,p.label,450,82,34,650,500,'label');
    T(d,p.headline[0],450,166,60,710);T(d,p.headline[1],450,250,76,710);
    T(d,p.sub,454,327,40,735,500,'sub');
    photo(d,'shift-master-gpt-source.png',[1300,180,285,330],1240,61,250,280);
  }else if(p.id==='shift-tistory'){
    Object.assign(d,{w:2400,h:900,dark:false});logo(d,'SHIFT',130,73,365);
    T(d,p.headline[0],130,399,123,1150);T(d,p.headline[1],130,544,123,1150);
    T(d,p.sub,140,681,49,1120,500,'sub');
    photo(d,'shift-master-gpt-source.png',[645,170,665,360],1420,213,850,470);
  }else if(p.id==='shift-naverblog'){
    Object.assign(d,{w:966,h:360,dark:false});logo(d,'SHIFT',46,24,168);
    T(d,p.headline[0],46,151,48,515);T(d,p.headline[1],46,217,55,515);
    T(d,p.sub,50,288,26,510,500,'sub');
    photo(d,'shift-master-gpt-source.png',[650,190,650,340],600,81,320,200);
  }else if(p.id==='shift-pinterest'){
    Object.assign(d,{w:1600,h:900});logo(d,'SHIFT',104,41,290);
    T(d,p.headline[0],106,236,82,1380);T(d,p.headline[1],106,345,93,1380);
    T(d,p.sub,111,421,42,1280,500,'sub');
    photo(d,'shift-centered-gpt-source.png',[160,300,1355,310],105,482,1390,325);
  }else if(p.id==='shift-behance'){
    Object.assign(d,{w:3200,h:410});logo(d,'SHIFT',680,24,260);
    T(d,p.headline[0],680,245,110,1670);T(d,p.sub,686,354,84,1610,500,'sub');
    photo(d,'shift-master-gpt-source.png',shiftCrop,2470,96,620,242);
  }else if(p.id==='lab-facebook'){
    Object.assign(d,{w:1640,h:924,dark:false,safe:{x:180,y:160,w:1280,h:600}});
    logo(d,'LAB',220,162,245);
    T(d,p.headline[0],220,324,62,1190);T(d,p.sub,226,397,45,1190,500,'sub');
    photo(d,'lab-master-gpt-source.png',labCrop,219,445,1200,234);
  }
  designs.push(d);
}
const mobile={...plan.covers.find(x=>x.id==='shift-tistory'),id:'shift-tistory-mobile',w:390,h:300,dark:false,text:[],photos:[]};
logo(mobile,'SHIFT',24,15,138);T(mobile,'AI로 회사를 만드는 과정',24,106,27,342);
T(mobile,'무엇을 만들었고, 왜 고쳤는지.',26,148,16,338,500,'sub');
photo(mobile,'shift-master-gpt-source.png',shiftCrop,24,180,342,90);designs.push(mobile);

async function main(){
  // librsvg does not reliably decode embedded WebP; use lossless PNG data URIs.
  for(const file of [paper,black])imageCache.set(file,`data:image/png;base64,${(await sharp(file).png().toBuffer()).toString('base64')}`);
  const py=spawnSync('python',['-X','utf8',at('글자윤곽.py')],{input:JSON.stringify(req),encoding:'utf8',maxBuffer:40*1024*1024});
  if(py.status!==0)throw Error(py.stderr);const glyphs=JSON.parse(py.stdout);
  const outputs=[];const thumbs=[];
  for(const [n,d] of designs.entries()){
    const ink=d.dark?colors.Paper:colors.Ink;
    const ground=d.dark?black:paper;
    const defs=`<defs><pattern id="feltType" width="180" height="180" patternUnits="userSpaceOnUse"><rect width="180" height="180" fill="${ink}"/><image width="180" height="180" href="${uri(paper,'image/webp')}" opacity="${d.dark?'.32':'.04'}" preserveAspectRatio="xMidYMid slice"/></pattern><filter id="depth" x="-10%" y="-20%" width="120%" height="145%"><feDropShadow dx="0" dy="1.1" stdDeviation=".8" flood-color="#000" flood-opacity=".3"/></filter></defs>`;
    let body=`<rect width="100%" height="100%" fill="${d.dark?colors['Ink Deep']:colors.Paper}"/><image width="100%" height="100%" href="${uri(ground,'image/webp')}" opacity="${d.dark?'.55':'.6'}" preserveAspectRatio="xMidYMid slice"/>`;
    for(const [i,p] of d.photos.entries()){
      const [left,top,width,height]=p.crop;
      const img=await sharp(src(p.file)).extract({left,top,width,height}).resize(p.w,p.h,{fit:'contain',background:{r:8,g:6,b:5,alpha:0}}).png().toBuffer();
      const id=`photo-${i}`;const radius=d.dark?0:Math.round(Math.min(p.w,p.h)*.08);
      const mask=d.dark?`<linearGradient id="${id}-x"><stop offset="0" stop-color="black"/><stop offset=".04" stop-color="white"/><stop offset=".96" stop-color="white"/><stop offset="1" stop-color="black"/></linearGradient><linearGradient id="${id}-y" x2="0" y2="1"><stop offset="0" stop-color="black"/><stop offset=".08" stop-color="white"/><stop offset=".92" stop-color="white"/><stop offset="1" stop-color="black"/></linearGradient><mask id="${id}-mx"><rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="url(#${id}-x)"/></mask><mask id="${id}-my"><rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="url(#${id}-y)"/></mask>`:'';
      const backing=d.dark?'':`<image x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" href="${uri(black)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>`;
      body+=`<defs>${mask}<clipPath id="${id}"><rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="${radius}"/></clipPath></defs>${backing}<g ${d.dark?`mask="url(#${id}-my)"`:''}><image x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" href="data:image/png;base64,${img.toString('base64')}" clip-path="url(#${id})" ${d.dark?`mask="url(#${id}-mx)"`:''}/></g>`;
    }
    if(d.logo){const l=d.logo;const panel=d.dark&&l.brand==='SHIFT';const a=kit.find(x=>x.brand===l.brand&&x.variant===(!panel&&d.dark?'Paper':'Ink'));const p=path.join(kitDir,a.file);if(hash(p)!==a.sha256)throw Error('Logo source changed');const lh=l.w*a.height/a.width;if(panel){body+=`<defs><clipPath id="logo-panel"><rect x="${l.x-16}" y="${l.y-10}" width="${l.w+32}" height="${lh+20}" rx="12"/></clipPath></defs><image x="${l.x-16}" y="${l.y-10}" width="${l.w+32}" height="${lh+20}" href="${uri(paper)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#logo-panel)"/>`;}body+=`<image x="${l.x}" y="${l.y}" width="${l.w}" height="${lh}" href="${uri(p)}"/>`;}
    const qa=[];
    for(const t of d.text){const g=glyphs[t.i];const scale=Math.min(1,t.maxWidth/g.width);const box={x:t.x+g.box[0]*scale,y:t.y+g.box[1]*scale,w:(g.box[2]-g.box[0])*scale,h:(g.box[3]-g.box[1])*scale};const safe=d.safe||{x:0,y:0,w:d.w,h:d.h};if(box.x<safe.x||box.y<safe.y||box.x+box.w>safe.x+safe.w||box.y+box.h>safe.y+safe.h)throw Error('Text outside safe area '+d.id+' '+t.text);qa.push({text:t.text,...box,size:t.size*scale,fonts:g.fonts});body+=`<g aria-label="${esc(t.text)}" transform="translate(${t.x} ${t.y}) scale(${scale})" fill="${t.kind==='head'?'url(#feltType)':ink}" opacity="${t.kind==='sub'?'.82':'1'}" ${t.kind==='head'?'filter="url(#depth)"':''}><title>${esc(t.text)}</title><path d="${g.d}"/></g>`;}
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${d.w}" height="${d.h}" viewBox="0 0 ${d.w} ${d.h}" role="img" aria-label="${esc(d.role)}">${defs}${body}</svg>`;
    fs.writeFileSync(at(d.id+'.svg'),svg);await sharp(Buffer.from(svg)).png().toFile(at(d.id+'.png'));
    const isYT=d.id.endsWith('-youtube');let preview=sharp(at(d.id+'.png'));if(isYT)preview=preview.extract({left:508,top:509,width:1544,height:422});
    const ph=isYT?107:Math.round(390*d.h/d.w);await preview.resize(390,ph).png().toFile(at(d.id+'.preview.png'));
    outputs.push({id:d.id,role:d.role,file:d.id+'.png',svg:d.id+'.svg',w:d.w,h:d.h,bytes:fs.statSync(at(d.id+'.png')).size,sha256:hash(at(d.id+'.png')),status:'local-not-published',text:qa,photos:d.photos,logo:d.logo||null,safe:d.safe||null,languageReview:d.languageReview||null});
    let thumbImage=sharp(at(d.id+'.png'));if(isYT)thumbImage=thumbImage.extract({left:508,top:509,width:1544,height:422});
    const thumb=await thumbImage.resize(700,210,{fit:'contain',background:'#EDE7DC'}).png().toBuffer();thumbs.push({input:thumb,left:20+(n%2)*730,top:50+Math.floor(n/2)*255});
  }
  await sharp({create:{width:1480,height:Math.ceil(designs.length/2)*255+20,channels:3,background:'#EDE7DC'}}).composite(thumbs).png().toFile(at('전체보기.png'));
  fs.writeFileSync(at('명세.json'),JSON.stringify({revision:plan.revision,createdAt:new Date().toISOString(),status:'local-not-published',fontMethod:'Exact SUIT/Inter Tight glyph outlines; no font fallback',outputs},null,2)+'\n');
  const cards=outputs.map(d=>`<section><h2>${esc(d.id)} <small>${esc(d.role)}</small></h2><img src="${d.file}" alt="${esc(d.text.map(t=>t.text).join(' '))}"><details><summary>390px 미리보기</summary><img class="small" src="${d.id}.preview.png" alt="로컬 축소 미리보기"></details></section>`).join('');
  fs.writeFileSync(at('index.html'),`<!doctype html><html lang="ko"><meta charset="utf-8"><title>SYNK · 역할별 문구 커버</title><style>body{margin:0;padding:40px;background:#eeeae4;color:#2b2320;font-family:system-ui,sans-serif}main{max-width:1400px;margin:auto}h1{font-size:32px}h2{font-size:20px}small{font-size:14px;font-weight:400;margin-left:15px}section{margin:42px 0}img{display:block;max-width:100%;height:auto}.small{width:390px}summary{margin:12px 0;cursor:pointer}</style><main><h1>역할별 문구를 더한 펠트 커버</h1><p>11개 커버 + Tistory 모바일 1개. 현재 로컬 수정본이며 공개 계정 반영 전입니다. 몽골어 원어민 감수는 완료되지 않았습니다.</p>${cards}</main></html>`);
  console.log(JSON.stringify({outputs:outputs.length,checkedText:qaCount(outputs),file:at('index.html')}));
}
function qaCount(o){return o.reduce((sum,x)=>sum+x.text.length,0);}
main().catch(e=>{console.error(e);process.exitCode=1;});
