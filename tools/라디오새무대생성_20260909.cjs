'use strict';
// 공식 구독 CLI로 승인된 배경을 영상화한다. 기존 국소 remap은 사용하지 않는다.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/_ops/라디오생동_20260909/v3');
fs.mkdirSync(out,{recursive:true});
const source=path.join(root,'docs/Loom_자산/라디오생동/추석_기준.png');
const record=path.join(out,'생성_A.json');
if(fs.existsSync(record))throw new Error('생성 기록이 이미 있음. 중복 호출하지 않는다.');
const prompt='Single uninterrupted locked-off tripod shot. A gentle night breeze passes through this wool miniature courtyard: the wispy wool clouds drift slowly as coherent soft forms, while persimmon twigs sway together from their joints with a little natural lag in the fruit. Warm window light breathes very softly and independently. The moon stays round and still. Roofs, ground, stars, foreground objects and embroidered lettering remain firmly in place. Preserve dry tactile fibers and every object shape, stable exposure and focus. Graceful, quiet motion for long contemplative viewing. The breeze gently returns to the starting arrangement for a seamless loop. Empty courtyard, fixed framing throughout.';
const args=['generate','create','seedance_2_0','--prompt',prompt,'--start-image',source,'--end-image',source,'--duration','12','--resolution','1080p','--aspect_ratio','16:9','--bitrate_mode','high','--mode','std','--generate_audio','false','--wait','--wait-timeout','20m','--json'];
const state={started:new Date().toISOString(),source,sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'),model:'seedance_2_0',duration:12,resolution:'1080p',prompt,startAndEndSameImage:true,audio:false,status:'starting'};
fs.writeFileSync(record,JSON.stringify(state,null,2));
const p=spawn('higgsfield',args,{windowsHide:true});let stdout='',stderr='';
p.stdout.on('data',d=>{stdout+=d;});
p.stderr.on('data',d=>{stderr+=d;const safe=String(d).replace(/https?:\/\/\S+/g,'[생성 주소]');process.stdout.write(safe);});
p.on('error',e=>{state.status='cli_error';state.error=e.message;fs.writeFileSync(record,JSON.stringify(state,null,2));process.exitCode=1;});
p.on('close',code=>{
 state.finished=new Date().toISOString();state.exitCode=code;state.status=code===0?'completed':'needs_review';
 try{state.result=JSON.parse(stdout);}catch{state.output=stdout;}
 state.log=stderr.replace(/https?:\/\/\S+/g,'[생성 주소]');fs.writeFileSync(record,JSON.stringify(state,null,2));
 console.log(JSON.stringify({status:state.status,record,result:state.result},null,2));if(code!==0)process.exitCode=1;
});
