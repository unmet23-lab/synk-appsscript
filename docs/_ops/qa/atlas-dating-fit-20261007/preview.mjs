import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {createDatingServer} from '../../../../experiences/atlas-lab/dating-server.mjs';

const dir=path.dirname(fileURLToPath(import.meta.url));
const databaseDirectory=await fs.mkdtemp(path.join(os.tmpdir(),'synk-dating-fit-preview-'));
const server=createDatingServer({mode:'demo',databasePath:path.join(databaseDirectory,'preview.sqlite')});
server.listen(0,'127.0.0.1',async()=>{
  const origin=`http://127.0.0.1:${server.address().port}`;
  await fs.writeFile(path.join(dir,'preview-launch.json'),JSON.stringify({at:new Date().toISOString(),origin,mode:'demo',isolatedDatabase:true},null,2)+'\n');
  console.log(`SYNK 나다운 만남: ${origin}/atlas-lab/dating.html`);
});
process.once('SIGINT',()=>{server.closeAllConnections();server.close();});
process.once('SIGTERM',()=>{server.closeAllConnections();server.close();});
