'use strict';
const fs=require('node:fs'),path=require('node:path');
const script=JSON.parse(fs.readFileSync(path.join(__dirname,'extra-narration-script.json'),'utf8'));
(async()=>{const status=await fetch('http://127.0.0.1:4371/status').then(r=>r.json());if(!status.connected)throw Error('Typecast 연결을 먼저 완료해 주세요.');for(const s of script.segments){const r=await fetch('http://127.0.0.1:4371/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:s.id}),signal:AbortSignal.timeout(210000)});const data=await r.json();if(!r.ok)throw Error(data.error);console.log(JSON.stringify(data));}})().catch(e=>{console.error(e.message);process.exitCode=1;});

