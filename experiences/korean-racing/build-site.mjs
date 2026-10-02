import { cp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('./',import.meta.url));
const destination=path.resolve(process.argv[2]||path.join(root,'site-package'));
await mkdir(destination,{recursive:true});
const games=[
  {id:'korean-racing',source:root,prefix:'',names:['index.html','style.css','garage.css','app.js','startup.js','graphics.js','scenery.js','landscape.js','coastal-rocks.js','seascape-boats.js','atmosphere.js','render-world.js','cityscape.js','city-materials.js','city-life.js','tutorial.js','curriculum.js','campaign.js','finales.js','garage.js','garage-ui.js','vehicles.js','drivers.js','driving.js','learning.js','personalization.js','atlas-learning.js','narration.js','question-audio.js','assets','vendor']},
  {id:'korean-rhythm',source:path.resolve(root,'../korean-rhythm'),prefix:'play/rhythm',names:['index.html','style.css','app.mjs','core.mjs','audio.mjs','stage.mjs','suno-tracks.mjs','listening.mjs','narration.mjs','personalization.mjs','atlas-learning.js','collection.js','assets']},
  {id:'korean-runner',source:path.resolve(root,'../korean-runner'),prefix:'play/runner',names:['index.html','style.css','app.js','core.mjs','instructions.mjs','voice-timing.mjs','controls.mjs','world.mjs','world-cosmetics.mjs','scenery-details.mjs','audio.mjs','learning.mjs','listening-check.mjs','listening-check-ui.mjs','shop.mjs','shop-ui.mjs','shop-assets.mjs','goals-ui.mjs','art.mjs','atlas-learning.js','collection.js','assets','vendor']}
];
const records=[];
const excluded=new Set(['audio-source','qa','tests','node_modules','site-package','__pycache__']);
async function copyRuntime(game,relative){
  const source=path.join(game.source,relative),entries=await readdir(source,{withFileTypes:true}).catch(error=>{
    if(error.code==='ENOTDIR')return null;
    throw error;
  });
  if(entries){
    for(const entry of entries.sort((a,b)=>a.name.localeCompare(b.name)))
      if(!entry.name.startsWith('.')&&!excluded.has(entry.name)&&!entry.isSymbolicLink())await copyRuntime(game,path.join(relative,entry.name));
    return;
  }
  if(/\.(?:wav|zip|pyc)$/i.test(relative)||/\.test\.[cm]?js$/i.test(relative))return;
  const packagePath=path.posix.join(game.prefix,relative.split(path.sep).join('/'));
  const target=path.join(destination,packagePath);
  await mkdir(path.dirname(target),{recursive:true});await cp(source,target);
  const bytes=await readFile(source);
  records.push({path:packagePath,source:path.posix.join(game.id,relative.split(path.sep).join('/')),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
for(const game of games)for(const name of game.names)await copyRuntime(game,name);
records.sort((a,b)=>a.path.localeCompare(b.path));
// Keep unrelated destination files; the declared input list defines the deliverable ZIP.
await writeFile(path.join(destination,'build-manifest.json'),JSON.stringify({version:1,generatedAt:new Date().toISOString(),games:games.map(({id,prefix})=>({id,prefix})),files:records},null,2));
console.log(`Three-game static prototype built: ${destination} (${records.length} runtime files)`);
