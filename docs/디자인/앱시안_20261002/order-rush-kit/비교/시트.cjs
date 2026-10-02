'use strict';
// 찍기.cjs가 남긴 _raw/ 화면으로 전후 비교 시트(JPG)를 만든다(2026-10-02).
// 쓰는 법: node docs/디자인/앱시안_20261002/order-rush-kit/비교/시트.cjs
const path=require('node:path'),fs=require('node:fs');
const NM=process.env.SYNK_QA_NODE_MODULES||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const sharp=require(require.resolve('sharp',{paths:[NM]}));
const RAW=path.join(__dirname,'_raw');
const STATES=[['a_lobby','① 입구'],['b_play','② 주문 중 · 컵에 재료 둘, 글로 보기'],['e_wrong','③ 틀리게 서빙한 직후'],['c_served','④ 맞게 서빙한 직후'],['d_results','⑤ 결과']];
const SIDES=[['before','지금 · experiences/order-rush'],['after','키트 시안 · order-rush-kit']];
const BG='#f3efeb',INK='#2a120d',MUTED='#6f6460',CORAL='#ae322a';
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
const text=(x,y,s,{size=24,weight=700,fill=INK,anchor='start'}={})=>`<text x="${x}" y="${y}" font-family="Malgun Gothic" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(s)}</text>`;
const FOOT='같은 조작(소리 끔, 새 브라우저 기록): 시작 → 글로 보기 → 커피+얼음 → 서빙(틀림) → 따뜻한 커피로 고쳐 서빙 → 두 주문 더 → 영업 마치기. 두 쪽 모두 주문 o01, 점수 360. 시안은 화면 표현만 바꿨다.';

async function tile(file,w){const img=sharp(file).resize({width:w});const buf=await img.toBuffer();const m=await sharp(buf).metadata();
 const framed=await sharp(buf).extend({top:1,bottom:1,left:1,right:1,background:'#d8d1ca'}).toBuffer();return {buf:framed,w:m.width+2,h:m.height+2};}

async function mobile(){
 const W=468,M=40,G=24,HEAD=118,ROWL=58,CAP=40,FOOTH=70;
 const sample=await tile(path.join(RAW,'mobile_before_a_lobby.png'),W);const IH=sample.h,IW=sample.w;
 const width=M*2+STATES.length*IW+(STATES.length-1)*G,height=HEAD+SIDES.length*(ROWL+CAP+IH)+(SIDES.length-1)*36+FOOTH;
 const comps=[],svg=[text(M,62,'주문 폭주 · SNS 키트 적용 전후 — 휴대폰 390×844',{size:38,weight:800}),text(M,98,'2026-10-02 시안 v3(펠트 부품) · 같은 상태를 같은 조작으로 찍었다. 위가 지금, 아래가 키트 시안',{size:22,weight:400,fill:MUTED})];
 let y=HEAD;
 for(const [side,label] of SIDES){
  svg.push(text(M,y+40,label,{size:28,weight:800,fill:side==='after'?CORAL:INK}));y+=ROWL;
  for(let i=0;i<STATES.length;i++){const x=M+i*(IW+G);svg.push(text(x,y+28,STATES[i][1],{size:20,weight:700,fill:MUTED}));
   const t=await tile(path.join(RAW,`mobile_${side}_${STATES[i][0]}.png`),W);comps.push({input:t.buf,left:x,top:y+CAP});}
  y+=CAP+IH+36;
 }
 svg.push(text(M,height-28,FOOT,{size:19,weight:400,fill:MUTED}));
 const over=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${svg.join('')}</svg>`);
 await sharp({create:{width,height,channels:3,background:BG}}).composite([...comps,{input:over,left:0,top:0}]).jpeg({quality:84,mozjpeg:true}).toFile(path.join(__dirname,'비교_모바일.jpg'));
 return [width,height];
}

async function desktop(){
 const W=900,M=40,G=32,HEAD=118,COLL=50,CAP=38,RG=30,FOOTH=70;
 const sample=await tile(path.join(RAW,'desktop_before_a_lobby.png'),W);const IH=sample.h,IW=sample.w;
 const width=M*2+2*IW+G,height=HEAD+COLL+STATES.length*(CAP+IH)+(STATES.length-1)*RG+FOOTH;
 const comps=[],svg=[text(M,62,'주문 폭주 · SNS 키트 적용 전후 — 데스크톱 1440×900',{size:38,weight:800}),text(M,98,'2026-10-02 시안 v3(펠트 부품) · 같은 상태를 같은 조작으로 찍었다. 왼쪽이 지금, 오른쪽이 키트 시안',{size:22,weight:400,fill:MUTED})];
 SIDES.forEach(([side,label],j)=>svg.push(text(M+j*(IW+G),HEAD+34,label,{size:28,weight:800,fill:side==='after'?CORAL:INK})));
 let y=HEAD+COLL;
 for(const [state,cap] of STATES){
  svg.push(text(M,y+27,cap,{size:21,weight:700,fill:MUTED}));
  for(let j=0;j<SIDES.length;j++){const t=await tile(path.join(RAW,`desktop_${SIDES[j][0]}_${state}.png`),W);comps.push({input:t.buf,left:M+j*(IW+G),top:y+CAP});}
  y+=CAP+IH+RG;
 }
 svg.push(text(M,height-28,FOOT,{size:19,weight:400,fill:MUTED}));
 const over=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${svg.join('')}</svg>`);
 await sharp({create:{width,height,channels:3,background:BG}}).composite([...comps,{input:over,left:0,top:0}]).jpeg({quality:84,mozjpeg:true}).toFile(path.join(__dirname,'비교_데스크톱.jpg'));
 return [width,height];
}

(async()=>{const m=await mobile(),d=await desktop();
 for(const f of ['비교_모바일.jpg','비교_데스크톱.jpg'])console.log(f,(fs.statSync(path.join(__dirname,f)).size/1024).toFixed(0)+'KB');
 console.log('mobile',m,'desktop',d);})().catch(e=>{console.error(e);process.exitCode=1;});
