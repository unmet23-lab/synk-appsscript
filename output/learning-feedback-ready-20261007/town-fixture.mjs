// Isolated local setup only. No answers or learning events are injected.
import {createLinkedServer} from '../../experiences/teacher-world/linked-server.mjs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const folder=await fs.mkdtemp(path.join(os.tmpdir(),'synk-ready-town-'));
const server=await createLinkedServer();
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
async function post(route,body,token){const response=await fetch(origin+route,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});if(!response.ok)throw Error(`${route}: ${response.status}`);return response.json();}
const teacher=await post('/api/teacher/session',{key:server.ownerKey});
const link=await post('/api/links',{classId:'class-local',name:'교육흐름 합성 검증'},teacher.token);
const file=path.join(folder,'join.json');await fs.writeFile(file,JSON.stringify({origin,code:link.code}),{mode:0o600});
console.log(JSON.stringify({origin,joinFile:file}));
process.on('SIGINT',()=>server.close(()=>process.exit(0)));
