'use strict';
// Read-only inventory; writes evidence only beside this script.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createRequire}=require('node:module');
const root=path.resolve(__dirname,'../../../..');
const sharp=createRequire('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json')('sharp');
const L=require(path.join(root,'tools/lib/옷목록.js')),M=require(path.join(root,'tools/lib/마스코트자산.js'));
const rel=p=>path.relative(root,p).replaceAll('\\','/');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const exists=p=>fs.existsSync(path.join(root,p));
const walk=d=>fs.existsSync(d)?fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]):[];
const expressions={까몽:M.까몽누끼컷,몽글:M.몽글누끼컷,마린:M.마린표정컷};
const bodyLists={까몽:M.까몽컷,몽글:M.표정,마린:M.마린컷};
const bodyPath={까몽:M.까몽경로,몽글:M.경로,마린:M.마린경로};
const bodies=Object.entries(bodyLists).flatMap(([character,cuts])=>cuts.map(cut=>({character,cut,path:bodyPath[character](cut),angle:M.각도컷[character].includes(cut)})));
const characters={};
for(const character of ['까몽','몽글','마린']){
 const items=L.목록(character),garments=items.filter(x=>x.갈래==='의상'),accessories=items.filter(x=>x.갈래==='악세');
 const combos=[...items.map(x=>[x.이름]),...garments.flatMap(g=>accessories.map(a=>[g.이름,a.이름]))].map(parts=>{
  const token=L.옷토막(character,parts),rawCandidates=['GPT','GPT정액시험'].map(d=>`${L.옷방뿌리}/${d}/${character}_${token}.png`).filter(exists);
  const stages=Object.fromEntries(Object.entries(L.방).map(([stage])=>[stage,(stage.startsWith('표정')||stage==='앱'?expressions[character]:[null]).map(cut=>({cut,path:L.옷경로(character,parts,cut,stage)})).map(x=>({...x,exists:exists(x.path)}))]));
  return {parts,token,rawCandidates,selectedRaw:rawCandidates[0]||null,stages};
 });
 characters[character]={counts:L.차림수(character),expressions:expressions[character],combos,legacyLayers:items.map(x=>({name:x.이름,path:`docs/Loom_자산/옷층/옷_${character}_${x.이름.replaceAll(' ','')}.webp`}))};
}
const radioRoot='docs/Loom_자산/라디오차림',radioManifest=JSON.parse(fs.readFileSync(path.join(root,radioRoot,'목록.json'),'utf8')),radio=[];
for(const [character,block] of Object.entries(radioManifest.캐릭터))for(const [key,entry] of Object.entries(block.차림)){
 const record=entry.출처,recordPath=`${radioRoot}/_기록/${key}.json`,standalone=JSON.parse(fs.readFileSync(path.join(root,recordPath),'utf8'));
 const files=Object.entries(record.파일||{}).map(([cut,f])=>({cut,input:f.원본,inputExpectedSha:f.원본_sha256,output:`${radioRoot}/${f.결과}`,outputExpectedSha:f.결과_sha256}));
 radio.push({character,key,status:entry.상태,recordPath,manifestRecordSame:JSON.stringify(record)===JSON.stringify(standalone),files});
}
const inventory=new Set([...walk(path.join(root,L.옷방뿌리)),...walk(path.join(root,'docs/Loom_자산/옷층'))].filter(p=>/\.(png|webp|avif|jpg|jpeg)$/i.test(p)).map(rel));
for(const f of bodies)inventory.add(f.path);
for(const r of radio)for(const f of r.files){inventory.add(f.input);inventory.add(f.output);}
const files=[];let at=0;const list=[...inventory].sort();
async function main(){
 await Promise.all(Array.from({length:3},async()=>{while(at<list.length){const i=at++,p=list[i];try{const m=await sharp(path.join(root,p)).metadata();files.push({path:p,bytes:fs.statSync(path.join(root,p)).size,width:m.width,height:m.height,format:m.format,channels:m.channels,hasAlpha:m.hasAlpha,sha256:sha(p)});}catch(e){files.push({path:p,error:e.message});}if((i+1)%1000===0)console.log(`metadata/hash ${i+1}/${list.length}`);}}));
 files.sort((a,b)=>a.path.localeCompare(b.path));const byPath=new Map(files.map(f=>[f.path,f]));
 for(const r of radio)for(const f of r.files){f.inputShaMatches=byPath.get(f.input)?.sha256===f.inputExpectedSha;f.outputShaMatches=byPath.get(f.output)?.sha256===f.outputExpectedSha;}
 const summary=Object.fromEntries(Object.entries(characters).map(([n,c])=>[n,{...c.counts,expressionCount:c.expressions.length,selectedRaw:c.combos.filter(x=>x.selectedRaw).length,rawPairs:c.combos.filter(x=>x.parts.length===2&&x.selectedRaw).length,rawDuplicateSources:c.combos.filter(x=>x.rawCandidates.length>1).map(x=>({token:x.token,paths:x.rawCandidates,hashes:x.rawCandidates.map(p=>byPath.get(p)?.sha256)})),completeExpressionSets:c.combos.filter(x=>x.stages.앱.every(f=>f.exists)).length,finalExpressionCount:c.combos.reduce((n,x)=>n+x.stages.앱.filter(f=>f.exists).length,0),expectedFinal:c.combos.length*c.expressions.length,legacyLayerCount:c.legacyLayers.filter(f=>exists(f.path)).length}]));
 const folders={};for(const f of files){const dir=path.posix.dirname(f.path);(folders[dir]||={files:0,bytes:0,sizes:{},errors:0}).files++;folders[dir].bytes+=f.bytes||0;folders[dir].errors+=!!f.error;const k=`${f.width}x${f.height}/${f.format}/alpha:${f.hasAlpha}`;folders[dir].sizes[k]=(folders[dir].sizes[k]||0)+1;}
 const report={createdAt:new Date().toISOString(),scope:'Current metadata and SHA-256 for all outfit raster stages, mapped body assets and active radio inputs/outputs. Not visual acceptance, live-state verification or decode-all-pixels validation.',summary,bodies,characters,radio,files,folders,totals:{files:files.length,errors:files.filter(f=>f.error).length,bytes:files.reduce((n,f)=>n+(f.bytes||0),0),bodyMapped:bodies.length,bodyExpressionOnly:bodies.filter(b=>!b.angle).length,radioSets:radio.length,radioFiles:radio.reduce((n,r)=>n+r.files.length,0),radioRecordMismatches:radio.filter(r=>!r.manifestRecordSame).length,radioInputMismatches:radio.flatMap(r=>r.files.filter(f=>!f.inputShaMatches)).length,radioOutputMismatches:radio.flatMap(r=>r.files.filter(f=>!f.outputShaMatches)).length}};
 console.log(JSON.stringify({summary,totals:report.totals},null,2));fs.writeFileSync(path.join(__dirname,'현행재고검사.json'),JSON.stringify(report,null,2)+'\n');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
