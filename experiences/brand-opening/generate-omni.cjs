// One artifact-specific Gemini Omni request. No model/account fallback or resubmission.
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const policy=require('../../tools/모델정책.js');
const variant=process.argv[2];
if(!['portrait','landscape'].includes(variant))throw Error('Choose portrait or landscape');
const revision=process.argv.find(s=>s.startsWith('--revision='))?.split('=')[1]||'v6';
if(!['v6','v7','v8','v9'].includes(revision))throw Error('Choose a recorded revision: v6, v7, v8 or v9');
const editVideo=process.argv.includes('--source-video=v6');
if(editVideo&&revision!=='v8')throw Error('Video-reference correction belongs to v8');
policy.유료API요구('User-requested Gemini Omni opening');
const project='synk-bake-unmet27',model='gemini-omni-1.1-flash-preview';
if(policy.벌텍스프로젝트()!==project)throw Error('Approved project differs; no account fallback');
const dir=path.join(__dirname,`raw/felt-trio-${revision}`);fs.mkdirSync(dir,{recursive:true});
const ledger=path.join(dir,`${variant}.job.json`),endpoint=`https://aiplatform.googleapis.com/v1beta1/projects/${project}/locations/global/interactions`;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const save=job=>fs.writeFileSync(ledger,JSON.stringify(job,null,2)+'\n');
async function request(url,body){
 const token=await policy.벌텍스토큰();
 const r=await fetch(url,{method:body?'POST':'GET',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(180000)});
 const j=await r.json().catch(()=>({}));
 if(!r.ok)throw Object.assign(Error(`Google ${r.status}: ${j.error?.message||'No diagnostic'}`),{status:r.status});
 return j;
}
function finish(job,result){
 if(result.model&&result.model!==model)throw Error(`Unexpected returned model: ${result.model}`);
 const outputs=[result.output_video,...(result.outputs||[]),...(result.steps||[]).filter(s=>s.type==='model_output').flatMap(s=>s.content||[])].filter(Boolean);
 const video=outputs.find(v=>(v.type==='video'||v.mime_type==='video/mp4')&&v.data);
 if(!video){job.status='unsupported-output';job.outputMetadata=outputs.map(v=>({type:v.type,mime_type:v.mime_type,uri:v.uri,keys:Object.keys(v)}));save(job);throw Error('No inline video returned; inspect recorded output metadata');}
 const bytes=Buffer.from(video.data,'base64');if(bytes.length<10000)throw Error('Empty video');
 const file=path.join(dir,`${variant}-omni11-1080p-${revision}.mp4`);fs.writeFileSync(file,bytes);
 Object.assign(job,{status:'complete',completedAt:new Date().toISOString(),file,bytes:bytes.length,sha256:sha(bytes),usage:result.usage,returnedModel:result.model});save(job);
 console.log(JSON.stringify({status:job.status,variant,file,bytes:bytes.length,model,usage:result.usage}));
}
async function main(){
 let job=fs.existsSync(ledger)?JSON.parse(fs.readFileSync(ledger,'utf8')):null;
 if(job?.status==='complete'){console.log(JSON.stringify({status:'already-complete',file:job.file}));return;}
 if(job&&!job.interactionId)throw Error('Prior submission has no confirmed interaction; inspect ledger, do not resubmit');
 if(!job){
  const input=path.join(__dirname,editVideo?`raw/felt-trio-v6/${variant}-omni11-1080p-v6.mp4`:`raw/felt-trio-v5/${variant}-last.png`),bytes=fs.readFileSync(input),prompt=fs.readFileSync(path.join(dir,'omni.prompt.txt'),'utf8');
  const format=editVideo?{type:'video',resolution:'1080p'}:{type:'video',aspect_ratio:variant==='portrait'?'9:16':'16:9',resolution:'1080p',duration:'10s'};
  job={date:'2026-10-10',createdAt:new Date().toISOString(),project,model,variant,revision,status:'submitting',inputFile:input,inputSha256:sha(bytes),sameFirstLastFrame:!editVideo,inputMode:editVideo?'video-edit':'first-last-frames',promptSha256:sha(Buffer.from(prompt)),responseFormat:format,estimatedUsd:editVideo?1.65:1.55,actualChargesVerified:false,automaticResubmission:false};save(job);
  try{
   const parts=editVideo?[{type:'video',mime_type:'video/mp4',data:bytes.toString('base64')},{type:'text',text:prompt}]:[{type:'image',mime_type:'image/png',data:bytes.toString('base64')},{type:'image',mime_type:'image/png',data:bytes.toString('base64')},{type:'text',text:prompt}];
   const result=await request(endpoint,{model,input:parts,response_format:[format],...(editVideo?{generation_config:{video_config:{task:'edit'}}}:{}),background:true,store:true});
   job.interactionId=result.id;job.status=result.status;save(job);
   if(result.status==='completed'){finish(job,result);return;}
   if(!result.id)throw Error('Missing interaction id');
   console.log(JSON.stringify({status:result.status,variant,model}));
  }catch(e){job.status=e.status?'rejected':'submission-outcome-unknown';job.error=e.message;save(job);throw e;}
 }
 for(let n=0;n<120;n++){
  await new Promise(r=>setTimeout(r,10000));
  const result=await request(`${endpoint}/${encodeURIComponent(job.interactionId)}`);
  job.status=result.status;job.lastPolledAt=new Date().toISOString();save(job);
  if(result.status==='completed'){finish(job,result);return;}
  if(['failed','cancelled','incomplete'].includes(result.status)){job.error=result.errors||result.error;job.usage=result.usage;save(job);throw Error(`Generation ${result.status}: ${JSON.stringify(job.error||{})}`);}
  if(n%3===0)console.log(JSON.stringify({status:result.status,variant,elapsedSeconds:(n+1)*10}));
 }
 throw Error('Still running; resume this recorded interaction only');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
