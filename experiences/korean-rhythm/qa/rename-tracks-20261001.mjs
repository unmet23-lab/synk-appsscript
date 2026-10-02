import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const aliases={'파란 신호가 켜지면':'초록','바다까지 한 시간':'해안선','오후 네 시의 약속':'네 시'};
for(const name of ['suno-tracks.mjs','index.html','README.md','app.mjs','core.mjs']){
  const file=path.join(root,name);let text=await readFile(file,'utf8');
  for(const [before,after] of Object.entries(aliases)) text=text.replaceAll(before,after);
  text=text.replaceAll('20261001-suno','20261001-titles');
  await writeFile(file,text);
}
const concepts=path.resolve(root,'../mini-game-concepts.json');
let text=await readFile(concepts,'utf8');
for(const [before,after] of Object.entries(aliases))text=text.replaceAll(before,after);
await writeFile(concepts,text);
console.log('Updated game display titles; audio files and source IDs unchanged.');
