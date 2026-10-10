// Artifact-specific Vertex Veo generation. Existing OAuth/project policy owns auth.
// There is no alternate provider, account, model fallback, or automatic resubmission.
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const policy=require('../../tools/모델정책.js');
const variant=process.argv[2];
if(!['portrait','landscape'].includes(variant))throw Error('Choose portrait or landscape');
const revision=process.argv.find(arg=>arg.startsWith('--revision='))?.split('=')[1]||'v2';
const phase=process.argv.find(arg=>arg.startsWith('--phase='))?.split('=')[1]||'base';
const take=Number(process.argv.find(arg=>arg.startsWith('--take='))?.split('=')[1]||1);
if(!['v2','v4','v5'].includes(revision))throw Error('Only the recorded opening revisions are supported');
if(!['base','extend-1','extend-2'].includes(phase))throw Error('Choose a recorded phase');
if(revision==='v2'&&phase!=='base')throw Error('Archived v2 cannot be extended by this plan');
if(revision==='v5'&&phase!=='base')throw Error('V5 is one full native maximum-duration shot with first and last frames');
if(![1,2].includes(take)||take===2&&(revision!=='v4'||phase!=='base'||variant!=='landscape'))throw Error('Only the explicit landscape v4 retry is recorded');
policy.유료API요구('User-requested Vertex Veo title video');
const root=path.join(__dirname,`raw/felt-trio-${revision}`);
const plan=JSON.parse(fs.readFileSync(path.join(root,'veo-plan.json'),'utf8'));
if(policy.벌텍스프로젝트()!==plan.project)throw Error('The approved Vertex project differs; no account fallback.');
const folder=path.join(root,'veo');fs.mkdirSync(folder,{recursive:true});
const phaseSuffix=phase==='base'?'':`-${phase}`;
const takeSuffix=take===1?'':'-take2';
const ledger=path.join(folder,`${variant}${phaseSuffix}${takeSuffix}.job.json`);
const save=value=>fs.writeFileSync(ledger,JSON.stringify(value,null,2)+'\n');
const endpoint=`https://${plan.location}-aiplatform.googleapis.com/v1/projects/${plan.project}/locations/${plan.location}/publishers/google/models/${plan.model}`;
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
async function post(method,body){
 const token=await policy.벌텍스토큰();
 const response=await fetch(`${endpoint}:${method}`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(120000)});
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw Object.assign(Error(`Vertex ${response.status}: ${result.error?.message||'no diagnostic'}`),{status:response.status});
 return result;
}
async function main(){
 let job=fs.existsSync(ledger)?JSON.parse(fs.readFileSync(ledger,'utf8')):null;
 if(job?.status==='complete'&&fs.existsSync(job.file)){console.log(JSON.stringify({status:'reused',file:job.file,model:job.model}));return;}
 if(job&&!job.operationName)throw Error('A prior submission has no confirmed operation. Do not submit again automatically; inspect its ledger.');
 if(!job){
  const extension=phase!=='base';
  const input=extension?path.join(root,'veo',`${variant}-continuation-input-${phase}.mp4`):path.join(__dirname,`raw/felt-trio-v2/${variant}.png`);
  const media=fs.readFileSync(input);
  const promptFile=extension&&variant==='landscape'?'veo.landscape-extend.prompt.txt':extension?'veo.extend.prompt.txt':take===2?'veo.landscape-fixed.prompt.txt':'veo.prompt.txt';
  const prompt=fs.readFileSync(path.join(root,promptFile),'utf8');
  const seconds=extension?7:8;
  const parameters={sampleCount:1,...(extension?{}:{durationSeconds:8}),aspectRatio:variant==='portrait'?'9:16':'16:9',resolution:'1080p',generateAudio:false,enhancePrompt:true,
   negativePrompt:'letters, text, logo, watermark, subtitles, humans, extra characters, extra limbs, mouth on Mongle, deformed eyes, melted fibers, plastic surface, changing character identity, camera movement, cuts, time lapse, strobing, global exposure flicker, rubber bodies, aggressive gestures'};
  if(plan.negativePrompt)parameters.negativePrompt=plan.negativePrompt;
  const estimatedUsd=Number((seconds*plan.estimatedUsdPerSecond).toFixed(2));
  job={date:'2026-10-09',createdAt:new Date().toISOString(),variant,revision,phase,take,project:plan.project,model:plan.model,location:plan.location,parameters,inputFile:input,inputSha256:digest(media),promptSha256:digest(Buffer.from(prompt)),promptFile:`raw/felt-trio-${revision}/${promptFile}`,estimatedUsd,status:'submitting',automaticResubmission:false};
  save(job);
  console.log(JSON.stringify({status:'submit',variant,revision,phase,model:plan.model,seconds,resolution:'1080p',estimateUsd:estimatedUsd}));
  try{
   const instance={prompt,[extension?'video':'image']:{bytesBase64Encoded:media.toString('base64'),mimeType:extension?'video/mp4':'image/png'}};
   if(plan.lastFrame){
    const final=fs.readFileSync(path.join(root,`${variant}-last.png`));
    instance.lastFrame={bytesBase64Encoded:final.toString('base64'),mimeType:'image/png'};
    job.lastFrameSha256=digest(final);save(job);
   }
   const accepted=await post('predictLongRunning',{instances:[instance],parameters});
   if(!accepted.name)throw Error('Missing operation name');
   if(!accepted.name.includes(`/models/${plan.model}/`))throw Error('Returned operation model does not match the requested exact model');
   job.operationName=accepted.name;job.status='running';job.acceptedAt=new Date().toISOString();save(job);
  }catch(error){job.status=error.status?'rejected':'submission-outcome-unknown';job.error=error.message;save(job);throw error;}
 }
 for(let attempt=0;attempt<90;attempt++){
  await new Promise(resolve=>setTimeout(resolve,10000));
  let result;
  try{result=await post('fetchPredictOperation',{operationName:job.operationName});}catch(error){job.pollError=error.message;job.lastPolledAt=new Date().toISOString();save(job);if(error.status&&![429,500,502,503,504].includes(error.status))throw error;continue;}
  job.lastPolledAt=new Date().toISOString();
  if(!result.done){if(attempt%3===0)console.log(JSON.stringify({status:'running',variant,elapsedSeconds:(attempt+1)*10}));save(job);continue;}
  if(result.error){job.status='failed';job.error=result.error.message||JSON.stringify(result.error);save(job);throw Error(job.error);}
  const videos=result.response?.videos||result.response?.generatedSamples||[];
  if(videos.length!==1){job.status='filtered-or-unexpected-count';job.responseMetadata={keys:Object.keys(result.response||{}),raiMediaFilteredCount:result.response?.raiMediaFilteredCount};save(job);throw Error('No single requested output was returned');}
  const item=videos[0],base64=item.bytesBase64Encoded||item.video?.bytesBase64Encoded;
  if(!base64){job.status='unsupported-delivery';job.responseMetadata={keys:Object.keys(item),gcsUri:item.gcsUri||item.video?.gcsUri||null};save(job);throw Error('The result uses a storage delivery path; do not invent a local file.');}
  const bytes=Buffer.from(base64,'base64');
  if(bytes.length<10000)throw Error('Empty or truncated video result');
  job.file=path.join(folder,`${variant}-veo31-1080p${phaseSuffix}${takeSuffix}-${revision}.mp4`);fs.writeFileSync(job.file,bytes);
  job.bytes=bytes.length;job.sha256=digest(bytes);job.status='complete';job.completedAt=new Date().toISOString();job.delivery='Vertex returned bytes';save(job);
  console.log(JSON.stringify({status:'complete',variant,file:job.file,bytes:job.bytes,model:job.model}));return;
 }
 job.status='still-running';save(job);throw Error('Operation is still running. Resume this existing operation; never resubmit automatically.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
