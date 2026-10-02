'use strict';
const fs=require('node:fs'),path=require('node:path');
const script=require('./narration-script.json');
(async()=>{
 const status=await fetch('http://127.0.0.1:4371/status').then(r=>r.json());
 if(!status.connected)throw Error('Local voice connection required');
 for(const s of script.segments){
  const f=path.join(__dirname,'audio','narration-'+s.id+'.json');
  if(fs.existsSync(f)){if(JSON.parse(fs.readFileSync(f,'utf8')).request.text!==s.text)throw Error('Cached text mismatch '+s.id);continue;}
  const r=await fetch('http://127.0.0.1:4371/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:s.id}),signal:AbortSignal.timeout(210000)});
  const d=await r.json();if(!r.ok)throw Error(d.error);console.log(JSON.stringify(d));
 }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
