'use strict';
// Source images are read-only. Full-pixel evidence is written only beside this file.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createRequire}=require('node:module');
const root=path.resolve(__dirname,'../../../..');
const sharp=createRequire('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json')('sharp');
const M=require(path.join(root,'tools/lib/마스코트자산.js'));
const read=p=>sharp(path.join(root,p)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
function compare(base,current){
 const {width:w,height:h}=base.info;
 if(w!==current.info.width||h!==current.info.height)return {sameDimensions:false};
 const a=base.data,b=current.data;let alphaDifferent=0,changed=0,maxDelta=0,minX=w,minY=h,maxX=-1,maxY=-1;
 for(let i=0;i<a.length;i+=4){alphaDifferent+=a[i+3]!==b[i+3];if(!(a[i+3]||b[i+3]))continue;let delta=0;for(let c=0;c<4;c++)delta=Math.max(delta,Math.abs(a[i+c]-b[i+c]));if(delta){changed++;maxDelta=Math.max(maxDelta,delta);const pos=i/4,x=pos%w,y=Math.floor(pos/w);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}}
 return {sameDimensions:true,alphaDifferent,visibleRGBAChanged:changed,maxChannelDelta:maxDelta,changedBoundingBox:maxX<0?null:[minX,minY,maxX+1,maxY+1]};
}
function alphaInfo(raw){let transparent=0,opaque=0,partial=0,edge128=0;const {width:w,height:h}=raw.info;for(let i=3;i<raw.data.length;i+=4){const a=raw.data[i];if(a===0)transparent++;else if(a===255)opaque++;else partial++;const p=(i-3)/4,x=p%w,y=Math.floor(p/w);if(a>128&&(x===0||y===0||x===w-1||y===h-1))edge128++;}return {width:w,height:h,transparent,opaque,partial,edgeAlphaAbove128:edge128,rgbaSha256:crypto.createHash('sha256').update(raw.data).digest('hex')};}
async function main(){
 const sets=[];
 for(const [character,cuts,fn] of [['까몽',M.까몽누끼컷,M.까몽경로],['몽글',M.몽글누끼컷,M.경로],['마린',M.마린표정컷,M.마린경로]])sets.push({kind:'mapped-body-expression-not-outfit',key:character,base:fn('본체'),files:cuts.map(cut=>({cut,path:fn(cut)}))});
 const rroot='docs/Loom_자산/라디오차림',manifest=JSON.parse(fs.readFileSync(path.join(root,rroot,'목록.json'),'utf8'));
 for(const [key,entry] of Object.entries(manifest.캐릭터.까몽.차림))sets.push({kind:'active-radio-candidate',key,base:`${rroot}/${entry.출처.파일.본체.결과}`,files:Object.entries(entry.출처.파일).map(([cut,f])=>({cut,path:`${rroot}/${f.결과}`,expectedRgbaSha:f.검사.RGBA_sha256}))});
 const results=[];
 for(const set of sets){const base=await read(set.base),files=[];for(const file of set.files){try{const current=file.path===set.base?base:await read(file.path),alpha=alphaInfo(current);files.push({...file,...alpha,recordRgbaShaMatches:file.expectedRgbaSha?file.expectedRgbaSha===alpha.rgbaSha256:null,comparison:compare(base,current)});}catch(e){files.push({...file,error:e.message});}}results.push({...set,files});if(results.length%20===0)console.log(`decoded sets ${results.length}/${sets.length}`);}
 const report={createdAt:new Date().toISOString(),scope:'Full RGBA decode, dimensions, alpha and base-expression differences for mapped body-expression cuts (angles excluded) and manifest-active 1024 radio candidates. Changed bounding boxes are measurements, not approved masks or visual verdicts. Original/final 4K outfit PNG/AVIF full-pixel comparison excluded.',sets:results,totals:{sets:results.length,files:results.reduce((n,s)=>n+s.files.length,0),errors:results.flatMap(s=>s.files.filter(f=>f.error)).length,rgbaRecordMismatches:results.flatMap(s=>s.files.filter(f=>f.recordRgbaShaMatches===false)).length,dimensionMismatches:results.flatMap(s=>s.files.filter(f=>f.comparison?.sameDimensions===false)).length,alphaVaryingSets:results.filter(s=>s.files.some(f=>f.comparison?.alphaDifferent>0)).map(s=>s.key)}};
 console.log(JSON.stringify(report.totals,null,2));fs.writeFileSync(path.join(__dirname,'표정기술검사.json'),JSON.stringify(report,null,2)+'\n');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
