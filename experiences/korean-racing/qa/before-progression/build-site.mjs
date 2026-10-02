import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('./',import.meta.url));
const destination=path.resolve(process.argv[2]||path.join(root,'site-package'));
await mkdir(destination,{recursive:true});
for(const name of ['index.html','style.css','app.js','curriculum.js','learning.js','narration.js','assets','vendor'])await cp(path.join(root,name),path.join(destination,name),{recursive:true});
console.log(`Static prototype built: ${destination}`);
