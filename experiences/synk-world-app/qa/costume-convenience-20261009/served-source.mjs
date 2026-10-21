import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const base='http://127.0.0.1:4296',root=process.cwd(),files=[
['/wardrobe-studio.mjs','experiences/synk-world-home/wardrobe-studio.mjs'],['/wardrobe-studio.css','experiences/synk-world-home/wardrobe-studio.css'],
['/wardrobe-stage.mjs','experiences/synk-world-home/wardrobe-stage.mjs'],['/wardrobe-workbench.mjs','experiences/synk-world-home/wardrobe-workbench.mjs'],['/wardrobe-album.mjs','experiences/synk-world-home/wardrobe-album.mjs'],
['/avatar-v3.mjs','experiences/synk-world-home/avatar-v3.mjs'],['/avatar-wardrobe.mjs','experiences/synk-world-home/avatar-wardrobe.mjs'],['/scene-v3.mjs','experiences/synk-world-home/scene-v3.mjs'],['/app.mjs','experiences/synk-world-home/app.mjs'],
['/app-shell.mjs','experiences/synk-world-app/app-shell.mjs'],['/app-shell.css','experiences/synk-world-app/app-shell.css'],['/world-client.mjs','experiences/synk-world-app/world-client.mjs'],['/world-town-client.mjs','experiences/synk-world-app/world-town-client.mjs'],['/town/day-scene.mjs','experiences/synk-town/day-scene.mjs']];
const rows=await Promise.all(files.map(async([url,file])=>{const response=await fetch(base+url),body=Buffer.from(await response.arrayBuffer()),local=fs.readFileSync(path.join(root,file)),hash=data=>crypto.createHash('sha256').update(data).digest('hex');return {url,file,status:response.status,matches:response.ok&&hash(body)===hash(local),sha256:hash(local),bytes:local.length};}));
const record={checkedAt:new Date().toISOString(),base,passed:rows.filter(row=>row.matches).length,rows,scope:'Current local running frontend source only'};
fs.writeFileSync('experiences/synk-world-app/qa/costume-convenience-20261009/served-source.json',JSON.stringify(record,null,2));console.log(JSON.stringify({passed:record.passed,total:rows.length,failures:rows.filter(row=>!row.matches)}));if(rows.some(row=>!row.matches))process.exitCode=1;

