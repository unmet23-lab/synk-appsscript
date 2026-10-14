import { cp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('./',import.meta.url));
const destination=path.resolve(process.argv[2]||path.join(root,'site-package'));
await mkdir(destination,{recursive:true});
const games=[
  // 2026-10-07 SYNK LAB PLAY 키트로 다시 만듦: kit/(lab.css·lab.mjs·펠트·글꼴), 화면 모듈(lobby·hud·results·screens·links·garage-ui), 3D 모듈(world-build·race-gate·race-car), ?qa 관찰(qa-hook). coast-drive.css는 style.css로 합쳤다.
  {id:'korean-racing',source:root,prefix:'',names:['index.html','style.css','garage.css','kit','app.js','lobby.js','hud.js','results.js','screens.js','links.js','qa-hook.js','world-build.js','race-gate.js','race-car.js','startup.js','terrain-startup.js','terrain-worker.js','terrain-data.js','course.js','graphics.js','coast-drive.js','race-pacing.js','coast-radio.js','scenery.js','landscape.js','coastal-rocks.js','seascape-boats.js','atmosphere.js','render-world.js','cityscape.js','city-materials.js','city-life.js','tutorial.js','curriculum.js','campaign.js','finales.js','garage.js','garage-core.js','garage-ui.js','collection.js','beginner-catalog.js','play-catalog.js','vehicles.js','drivers.js','driving.js','learning.js','personalization.js','atlas-learning.js','narration.js','question-audio.js','assets','vendor']},
  {id:'korean-rhythm',source:path.resolve(root,'../korean-rhythm'),prefix:'play/rhythm',names:['index.html','style.css','app.mjs','core.mjs','audio.mjs','stage.mjs','suno-tracks.mjs','listening.mjs','narration.mjs','personalization.mjs','atlas-learning.js','collection.js','kit','assets']},
  {id:'korean-runner',source:path.resolve(root,'../korean-runner'),prefix:'play/runner',names:['index.html','style.css','app.mjs','core.mjs','instructions.mjs','voice-timing.mjs','controls.mjs','audio.mjs','learning.mjs','listening-check.mjs','listening-check-ui.mjs','report.mjs','world.mjs','course-motion.mjs','scenery.mjs','hero.mjs','atlas-learning.js','collection.js','kit','assets','vendor']}
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
