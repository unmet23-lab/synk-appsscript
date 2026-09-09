'use strict';
// 기존 그림을 실제 레이어 순서로 그리는 진단. 새 의상 자산을 생성/채택하지 않는다.
const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const deps=createRequire('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json');
const sharp=deps('sharp');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/_ops/의상라디오검수_20260909/기존층');
const L=require('./lib/옷목록.js'),colors=Object.fromEntries(require('../docs/디자인_토큰.json').색.킷.map(x=>[x.이름,x.hex]));
const esc=x=>x.replace(/&/g,'&amp;').replace(/</g,'&lt;');
const tile=320,row=380;
const text=(s,w=tile,h=60)=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><text x="12" y="24" fill="${colors.Ink}" font-size="15" font-family="Malgun Gothic">${esc(s)}</text></svg>`);
const cloth=(dj,n)=>path.join(root,'docs/Loom_자산/옷층',`옷_${dj}_${n.replace(/\s/g,'')}.webp`);
const body=(dj,n)=>path.join(root,'docs/캐릭터/화면_1024',`${dj}_${n}.webp`);
async function panel(dj,n,names,size=tile){
 const bg=await sharp({create:{width:size,height:size,channels:4,background:colors.Paper}}).png().toBuffer();
 const layers=[];
 for(const p of [body(dj,n),...names.map(x=>cloth(dj,x))])layers.push({input:await sharp(p).resize(size,size).png().toBuffer()});
 return sharp(bg).composite(layers).png().toBuffer();
}
async function sheet(dj,entries,name){
 const cols=4,rows=Math.ceil(entries.length/cols),parts=[];
 for(let i=0;i<entries.length;i++){
  const e=entries[i],left=(i%cols)*tile,top=Math.floor(i/cols)*row;
  parts.push({input:await panel(dj,e.exp||'본체',e.names),left,top});
  parts.push({input:text(e.label),left,top:top+tile});
 }
 await sharp({create:{width:cols*tile,height:rows*row,channels:4,background:colors.Paper}}).composite(parts).png().toFile(path.join(out,name));
}
async function main(){
 fs.mkdirSync(out,{recursive:true});const summary={scope:'기존 레이어 합성 진단. 통합 GPT 차림/실제 방송 채택 아님.',characters:{}};
 const expressions=['본체','눈감음','눈웃음','궁금함','집중','안도','응원','놀람'];
 for(const dj of ['몽글','마린']){
  const list=L.목록(dj),garments=list.filter(x=>x.갈래==='의상').map(x=>x.이름),acc=list.filter(x=>x.갈래==='악세').map(x=>x.이름);
  const pairs=garments.flatMap(a=>acc.map(b=>[a,b]));
  for(let i=0;i<pairs.length;i+=16)await sheet(dj,pairs.slice(i,i+16).map((names,j)=>({names,label:`${i+j+1}. ${names.join(' + ')}`})),`${dj}_짝_${String(i/16+1).padStart(2,'0')}.png`);
  const names=[garments.includes('SYNK 후드')?'SYNK 후드':garments[0],'펠트 헤드폰'];
  const cuts=dj==='마린'?[...expressions,'인사']:expressions;
  await sheet(dj,cuts.map(exp=>({names,exp,label:exp+' · '+names.join('+')})),`${dj}_표정.png`);
  const neutral=await sharp(body(dj,'본체')).ensureAlpha().raw().toBuffer();const changes=[];
  for(const exp of cuts.slice(1)){
   const raw=await sharp(body(dj,exp)).ensureAlpha().raw().toBuffer();let bodyPixels=0,changed=0,sum=0;
   for(let y=650;y<1024;y++)for(let x=0;x<1024;x++){const k=(y*1024+x)*4;if(neutral[k+3]<128&&raw[k+3]<128)continue;bodyPixels++;const d=Math.max(...[0,1,2,3].map(c=>Math.abs(raw[k+c]-neutral[k+c])));sum+=d;if(d>12)changed++;}
   changes.push({expression:exp,region:'y>=650/1024 body+clothing area',pixels:bodyPixels,changedAbove12:changed,ratio:changed/bodyPixels,meanMaxChannelDifference:sum/bodyPixels});
  }
  summary.characters[dj]={pairs:pairs.length,expressions:cuts,diagnosticOutfit:names,bodyChanges:changes};
  console.log(dj+' '+pairs.length+'짝 + '+cuts.length+'표정');
 }
 fs.writeFileSync(path.join(out,'기존층검사.json'),JSON.stringify(summary,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
