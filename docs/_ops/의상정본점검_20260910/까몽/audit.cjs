// Read-only source audit. Writes only derived QA artefacts beside this script.
'use strict';
const fs=require('fs'), path=require('path'), crypto=require('crypto'), sharp=require('sharp');
const ROOT=path.resolve(__dirname,'../../../..'), OUT=__dirname;
const L=require(path.join(ROOT,'tools/lib/옷목록.js'));
const T=require(path.join(ROOT,'docs/디자인_토큰.json'));
const rgbaHex=(name,fallback)=>{const s=JSON.stringify(T.색.킷);const m=s.match(new RegExp('"'+name+'"\\s*:\\s*"(#[0-9A-Fa-f]{6})"'));return m?m[1]:fallback;};
const paper=rgbaHex('Paper','#FBF7F0'),ink=rgbaHex('Ink','#2B2320');
const abs=p=>path.resolve(ROOT,p),rel=p=>path.relative(ROOT,p).replaceAll('\\','/');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function walk(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(path.join(d,x.name)):[path.join(d,x.name)]);}
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const textSvg=(s,w,h)=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${paper}"/><text x="8" y="21" fill="${ink}" font-family="SUIT Variable,Malgun Gothic,sans-serif" font-size="15">${esc(s)}</text></svg>`);
async function sheets(rows,prefix,heads=false){
 const cols=4,per=heads?12:20,cw=300,ch=heads?526:324;
 for(let off=0;off<rows.length;off+=per){let batch=rows.slice(off,off+per),comps=[];
  for(let j=0;j<batch.length;j++){let r=batch[j],left=j%cols*cw,top=Math.floor(j/cols)*ch;
   comps.push({input:await sharp(r.path).resize(292,280,{fit:'contain',background:paper}).flatten({background:paper}).png().toBuffer(),left:left+4,top});
   comps.push({input:textSvg(`${off+j+1}. ${r.label}`,cw,32),left,top:top+282});
   if(heads)comps.push({input:await sharp(r.path).extract({left:245,top:115,width:480,height:320}).resize(292,195).flatten({background:paper}).png().toBuffer(),left:left+4,top:top+322});
   r.sheet=`${prefix}-${String(Math.floor(off/per)+1).padStart(2,'0')}.jpg`;r.tile=j+1;r.number=off+j+1;
  }
  await sharp({create:{width:cols*cw,height:Math.ceil(batch.length/cols)*ch,channels:3,background:paper}}).composite(comps).jpeg({quality:94,chromaSubsampling:'4:4:4'}).toFile(path.join(OUT,batch[0].sheet));
 }
}
async function main(){
 sharp.cache(false);sharp.concurrency(2);
 const manifest=JSON.parse(fs.readFileSync(abs('docs/Loom_자산/라디오차림/목록.json'),'utf8'));
 const items=L.목록('까몽'), clothing=items.filter(x=>x.갈래==='의상'),accessories=items.filter(x=>x.갈래==='악세');
 const keys=[...items.map(x=>[x.이름]),...clothing.flatMap(x=>accessories.map(y=>[x.이름,y.이름]))].map(x=>({key:L.옷토막('까몽',x),parts:x}));
 const all=walk(abs('docs/Loom_자산/옷')).filter(p=>/까몽/.test(path.basename(p))&&/\.(png|webp|avif)$/i.test(p));
 const radioAll=walk(abs('docs/Loom_자산/라디오차림/까몽')).filter(p=>/\.webp$/i.test(p));
 const inventory=[];let n=0;
 for(const p of [...all,...radioAll]){try{const m=await sharp(p).metadata();inventory.push({path:rel(p),bytes:fs.statSync(p).size,width:m.width,height:m.height,channels:m.channels,hasAlpha:m.hasAlpha,format:m.format});}catch(e){inventory.push({path:rel(p),error:e.message});}if(++n%1000===0)console.log('metadata',n);}
 const radio=[];
 for(const k of keys){const entry=manifest.캐릭터.까몽.차림[k.key],p=abs('docs/Loom_자산/라디오차림/'+entry.표정.기본);const base=await sharp(p).ensureAlpha().raw().toBuffer();const expr=[];
  let minX=1024,minY=1024,maxX=-1,maxY=-1,border=0;
  for(let q=0;q<1024*1024;q++)if(base[q*4+3]>128){let x=q%1024,y=q>>10;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);if(x===0||x===1023||y===0||y===1023)border++;}
  for(const [cut,src] of Object.entries(entry.표정).filter(([cut])=>cut!=='기쁨')){const f=abs('docs/Loom_자산/라디오차림/'+src),d=cut==='기본'?base:await sharp(f).ensureAlpha().raw().toBuffer();let alphaDiff=0,rgbaDiff=0,outsideBroadEyeBox=0;for(let q=0;q<1024*1024;q++){let i=q*4;if(base[i+3]!==d[i+3])alphaDiff++;if(base[i]!==d[i]||base[i+1]!==d[i+1]||base[i+2]!==d[i+2]||base[i+3]!==d[i+3]){rgbaDiff++;let x=q%1024,y=q>>10;if(x<300||x>610||y<300||y>440)outsideBroadEyeBox++;}}expr.push({cut,path:rel(f),sha256:sha(f),alphaDiff,rgbaDiff,outsideBroadEyeBox});}
  radio.push({...k,label:k.key,path:p,state:entry.상태,sha256:sha(p),bbox128:[minX,minY,maxX+1,maxY+1],border128:border,expressions:expr});
  if(radio.length%20===0)console.log('radio-pixels',radio.length);
 }
 await sheets(radio,'radio-base-head',true);console.log('radio sheets done');
 const raw=all.filter(p=>['GPT','GPT정액시험','GPT2.5_재굽기'].includes(path.basename(path.dirname(p)))).map(p=>({path:p,label:path.basename(p,'.png').replace('까몽_',''),room:path.basename(path.dirname(p)),sha256:sha(p)}));
 await sheets(raw,'raw-original');console.log('raw sheets done');
 const legacy=all.filter(p=>['층','두그림층','씌움','얹음','두그림'].includes(path.basename(path.dirname(p)))).map(p=>({path:p,label:path.basename(p,'.png').replace('까몽_',''),room:path.basename(path.dirname(p))}));
 await sheets(legacy,'legacy-pieces');console.log('legacy sheets done');
 const candidates=radioAll.filter(p=>p.includes(`${path.sep}_후보${path.sep}`)&&p.endsWith('_본체.webp')).map(p=>({path:p,label:path.basename(p,'_본체.webp')+' / '+path.basename(path.dirname(p)),sha256:sha(p)}));
 await sheets(candidates,'candidate-base-head',true);
 const roomCounts={};for(const r of inventory){const d=path.posix.dirname(r.path);roomCounts[d]=(roomCounts[d]||0)+1;}
 const result={at:new Date().toISOString(),sourceRoot:ROOT,denominator:L.차림수('까몽'),limitations:['Metadata check is not full image decode.','Pixel comparisons are 1032 current catalog radio files only.','Broad eye box is a conservative rejection check, not certification of narrow-mask compliance.','Visual review counts must be recorded separately after opening sheets.','No source images modified.'],roomCounts,inventory,radio,raw,legacy,candidates};
 fs.writeFileSync(path.join(OUT,'inventory.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify({inventory:inventory.length,errors:inventory.filter(x=>x.error).length,radio:radio.length,raw:raw.length,legacy:legacy.length,candidates:candidates.length,alphaAffected:radio.filter(r=>r.expressions.some(e=>e.alphaDiff)).length,broadEyeAffected:radio.filter(r=>r.expressions.some(e=>e.outsideBroadEyeBox)).length,edgeTouched:radio.filter(r=>r.border128).map(r=>[r.key,r.border128])},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
