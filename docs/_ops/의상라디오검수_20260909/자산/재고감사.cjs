'use strict';
// Read-only source audit: writes only this audit directory. Never generates or modifies assets.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {createRequire} = require('node:module');
const repo = path.resolve(__dirname, '../../../..');
const req = createRequire('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json');
const sharp = req('sharp');
const L = require(path.join(repo, 'tools/lib/옷목록.js'));
const M = require(path.join(repo, 'tools/lib/마스코트자산.js'));
const base = path.join(repo, L.옷방뿌리);
const rel = p => path.relative(repo, p).replaceAll('\\', '/');
function walk(dir) { return fs.readdirSync(dir, {withFileTypes:true}).flatMap(e => e.isDirectory() ? walk(path.join(dir,e.name)) : [path.join(dir,e.name)]); }
function exists(p) { return fs.existsSync(path.join(repo, p)); }
const stageFolders = ['GPT','GPT정액시험','GPT_표정','GPT_표정_누끼','GPT_표정_누끼_틀','GPT_표정_누끼_틀_avif','GPT_누끼_틀_avif'];
const expressions = {까몽:M.까몽누끼컷, 몽글:M.몽글누끼컷, 마린:M.마린표정컷};
async function main() {
  const all = [...walk(base),...walk(path.join(repo,'docs/Loom_자산/옷층'))].filter(p => /\.(png|avif|webp|jpe?g)$/i.test(p));
  const canonical = walk(path.join(repo,M.정본폴더)).filter(p => /(?:까몽|몽글|마린)_[^/\\]+\.png$/.test(p) && path.dirname(p) === path.join(repo,M.정본폴더));
  const files = [];
  let at = 0;
  await Promise.all(Array.from({length:3}, async () => {
    while(at < all.length + canonical.length) {
      const i = at++; const p = i < all.length ? all[i] : canonical[i-all.length];
      try {
        const meta = await sharp(p).metadata();
        const item = {path:rel(p),bytes:fs.statSync(p).size,width:meta.width,height:meta.height,format:meta.format,hasAlpha:meta.hasAlpha,channels:meta.channels,space:meta.space};
        if (['GPT','GPT정액시험','GPT2.5_재굽기'].includes(path.basename(path.dirname(p)))) item.sha256 = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
        files.push(item);
      } catch(e) {files.push({path:rel(p),error:String(e.message)});}
      if((i+1)%1000 === 0) console.log(`metadata ${i+1}/${all.length+canonical.length}`);
    }
  }));
  files.sort((a,b)=>a.path.localeCompare(b.path));
  const byPath = new Map(files.map(f=>[f.path,f]));
  const characters = {};
  for(const name of ['까몽','몽글','마린']) {
    const list=L.목록(name), garments=list.filter(x=>x.갈래==='의상').map(x=>x.이름), accessories=list.filter(x=>x.갈래==='악세').map(x=>x.이름);
    const selections = [...garments.map(x=>[x]),...accessories.map(x=>[x]),...garments.flatMap(a=>accessories.map(b=>[a,b]))];
    const combos = selections.map(selection => {
      const token=L.옷토막(name,selection); const prefix=`${name}_${token}`;
      const sources=['GPT','GPT정액시험'].map(d=>`${L.옷방뿌리}/${d}/${prefix}.png`).filter(exists);
      const stages=Object.fromEntries(stageFolders.map(d=>[d,d.includes('표정') ? expressions[name].filter(e=>exists(`${L.옷방뿌리}/${d}/${prefix}_${e}.${d.endsWith('avif')?'avif':'png'}`)) : exists(`${L.옷방뿌리}/${d}/${prefix}.${d.endsWith('avif')?'avif':'png'}`)]));
      return {selection,token,isPair:selection.length===2,sources,sourceMetadata:sources.map(p=>byPath.get(p)),stages,missingFinalExpressions:expressions[name].filter(e=>!stages.GPT_표정_누끼_틀_avif.includes(e))};
    });
    const legacy = Object.fromEntries(['얹음','층','초록','씌움','두그림','두그림층'].map(d=>[d,files.filter(f=>f.path.startsWith(`${L.옷방뿌리}/${d}/`) && path.basename(f.path).includes(name+'_')).map(f=>f.path)]));
    const radioLayers=list.map(x=>({name:x.이름,path:`docs/Loom_자산/옷층/옷_${name}_${x.이름.replaceAll(' ','')}.webp`})).map(x=>({...x,exists:exists(x.path),metadata:byPath.get(x.path)}));
    characters[name] = {garments,accessories,garmentCount:garments.length,accessoryCount:accessories.length,pairCount:garments.length*accessories.length,singleCount:list.length,totalDressedCount:combos.length,expressionCount:expressions[name].length,expressions:expressions[name],rawExisting:combos.filter(c=>c.sources.length).length,rawPairsExisting:combos.filter(c=>c.isPair&&c.sources.length).length,finalExpressionExpected:combos.length*expressions[name].length,finalExpressionExisting:combos.reduce((n,c)=>n+c.stages.GPT_표정_누끼_틀_avif.length,0),fullExpressionCombos:combos.filter(c=>!c.missingFinalExpressions.length).length,fullExpressionPairs:combos.filter(c=>c.isPair&&!c.missingFinalExpressions.length).length,rawMissing:combos.filter(c=>!c.sources.length).map(c=>c.selection),finalMissing:combos.filter(c=>c.missingFinalExpressions.length).map(c=>({selection:c.selection,expressions:c.missingFinalExpressions})),legacy,radioLayers,combos};
  }
  const folderStats = Object.fromEntries([...new Set(files.map(f=>path.posix.dirname(f.path)))].map(folder=>{
    const group=files.filter(f=>path.posix.dirname(f.path)===folder), sizes={};
    for(const f of group){const key=`${f.width}x${f.height}/${f.format}/alpha:${f.hasAlpha}`;sizes[key]=(sizes[key]||0)+1;}
    return [folder,{count:group.length,bytes:group.reduce((n,f)=>n+(f.bytes||0),0),sizes,errors:group.filter(f=>f.error)}];
  }));
  const rawHashes = {};
  for(const f of files.filter(f=>f.sha256)) (rawHashes[f.sha256] ||= []).push(f.path);
  const report={createdAt:new Date().toISOString(),scope:'Metadata and existence for all outfit raster assets. Not a visual acceptance, decode-all-pixels test, animation test, or runtime proof.',rule:'At most one garment and one accessory; naked is excluded from dressed-count.',characters,folderStats,rawDuplicateGroups:Object.values(rawHashes).filter(a=>a.length>1),files};
  fs.writeFileSync(path.join(__dirname,'재고감사.json'), JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({files:files.length,metadataErrors:files.filter(f=>f.error).length,characters:Object.fromEntries(Object.entries(characters).map(([name,c])=>[name,{garments:c.garmentCount,accessories:c.accessoryCount,pairs:c.pairCount,total:c.totalDressedCount,expressions:c.expressionCount,raw:c.rawExisting,rawPairs:c.rawPairsExisting,final:c.finalExpressionExisting,expectedFinal:c.finalExpressionExpected,full:c.fullExpressionCombos,fullPairs:c.fullExpressionPairs,legacy:Object.fromEntries(Object.entries(c.legacy).map(([k,v])=>[k,v.length]))}])),rawDuplicateGroups:report.rawDuplicateGroups},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
