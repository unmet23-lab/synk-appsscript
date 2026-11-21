'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {createHash,randomUUID}=require('node:crypto');
const {execFile}=require('node:child_process');
const exec=require('node:util').promisify(execFile);
const {MAX_ANSWER,goodId}=require('./office-task-store.cjs');

const hashPrompt=s=>createHash('sha256').update(s.replace(/\r\n/g,'\n')).digest('hex');
function claudeSubscriber(status){
  return status?.loggedIn===true && (!status.apiProvider || status.apiProvider==='firstParty') &&
    (!status.authMethod || /^(?:claude\.ai|oauth)$/i.test(status.authMethod)) &&
    /^(?:pro|max|ultra|team|enterprise)$/i.test(String(status.subscriptionType||''));
}
async function readSubscriber(file,cwd,env,signal,settings){
  const args=['--setting-sources','user'];
  if(settings)args.push('--settings',settings);
  try {
    const {stdout}=await exec(file,[...args,'auth','status','--json'],{cwd,env,signal,timeout:10000,maxBuffer:65536,windowsHide:true,shell:false});
    const status=JSON.parse(stdout);
    if(!claudeSubscriber(status))return null;
    const account=status.accountId||status.accountUuid||status.email;
    if(typeof account!=='string'||!account.trim())return null;
    return hashPrompt(JSON.stringify([account.toLowerCase(),status.orgId||'']));
  }catch(e){
    if(signal?.aborted)throw Object.assign(new Error('CANCELLED'),{code:'CANCELLED'});
    try{if(JSON.parse(e.stdout).loggedIn===false)return null;}catch{}
    throw Object.assign(new Error('PROVIDER'),{code:'PROVIDER'});
  }
}
// Direct-argv Claude hooks run only for one Solio-owned console. Discard all tool,
// transcript and account fields before any event reaches the task directory.
const agentId=value=>typeof value==='string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
function receipt(raw,sessionId){
  if (!raw || raw.session_id!==sessionId || raw.agent_id) return null;
  switch(raw.hook_event_name){
    case 'UserPromptSubmit':
      if(typeof raw.prompt!=='string')return null;
      return {type:'prompt',hash:hashPrompt(raw.prompt)};
    case 'Notification':
      if(raw.notification_type==='idle_prompt')return {type:'idle'};
      return ['permission_prompt','elicitation_dialog','elicitation_url_dialog'].includes(raw.notification_type)?{type:'terminal'}:null;
    case 'SessionEnd': return raw.reason==='prompt_input_exit'?{type:'idleEnd'}:{type:'end'};
    case 'StopFailure':
      return {type:'fail',code:['authentication_failed','oauth_org_not_allowed','cloud_credential_error'].includes(raw.error)?'LOGIN':['rate_limit','billing_error','account_on_hold'].includes(raw.error)?'LIMIT':'PROVIDER'};
    case 'Stop':
      if (!Array.isArray(raw.background_tasks) || !Array.isArray(raw.session_crons)) return {type:'unknown'};
      if (raw.background_tasks.length || raw.session_crons.length) return {type:'working'};
      if (typeof raw.last_assistant_message!=='string' || !raw.last_assistant_message.trim()) return {type:'unknown'};
      if (raw.last_assistant_message.length>MAX_ANSWER) return {type:'fail',code:'RESULT_TOO_LARGE'};
      return {type:'answer',answer:raw.last_assistant_message,...(typeof raw.transcript_path==='string' && path.isAbsolute(raw.transcript_path) && path.basename(raw.transcript_path)===sessionId+'.jsonl'?{transcript:raw.transcript_path}:{})};
    default: return null;
  }
}
// Inspect the environment Claude actually gave the hook, including managed settings.
// The empty Console profile directory belongs only to this one terminal.
function privateSubscriptionEnv(env,dir){
  const expected=path.join(dir,'console-profiles'), actual=env.ANTHROPIC_CONFIG_DIR;
  if(typeof actual!=='string' || !path.isAbsolute(actual) || path.relative(expected,actual)!=='')return false;
  const alternate=/^(?:ANTHROPIC_(?:API_KEY|AUTH_TOKEN|BASE_URL|CUSTOM_HEADERS|PROFILE|FEDERATION_RULE_ID|ORGANIZATION_ID|IDENTITY_TOKEN(?:_FILE)?|SERVICE_ACCOUNT_ID|WORKSPACE_ID)|CLAUDE_CODE_(?:API_KEY|OAUTH_TOKEN(?:_FILE_DESCRIPTOR)?|USE_(?:BEDROCK|VERTEX|FOUNDRY)))$/i;
  return !Object.entries(env).some(([name,value])=>alternate.test(name) && value);
}
async function recordHelper(dir,sessionId,raw){
  if(raw?.session_id!==sessionId || !goodId(raw.prompt_id))return;
  if(raw.hook_event_name==='Stop' && !raw.agent_id && Array.isArray(raw.background_tasks)){
    const pending=raw.background_tasks.filter(task=>task?.type==='subagent'&&agentId(task.id)).slice(0,64);
    for(const task of pending){
      try{await fs.writeFile(path.join(dir,'pending-'+raw.prompt_id+'-'+task.id),'',{mode:0o600,flag:'wx'});}
      catch(e){if(e.code!=='EEXIST')throw e;}
    }
  }else if(raw.hook_event_name==='SubagentStop' && agentId(raw.agent_id) &&
    typeof raw.last_assistant_message==='string' && raw.last_assistant_message.length<=MAX_ANSWER){
    const target=path.join(dir,'finished-'+raw.agent_id);
    const evidence={parent:raw.prompt_id,nonce:randomUUID(),answer:hashPrompt(raw.last_assistant_message)};
    const tmp=target+'-'+evidence.nonce+'.tmp';
    await fs.writeFile(tmp,JSON.stringify(evidence),{mode:0o600,flag:'wx'});
    await fs.rename(tmp,target);
  }
}

async function acceptRequestedPrompt(dir,sessionId,raw,gate,projectsRoot){
  const marker=path.join(dir,'submitted'),hash=hashPrompt(raw.prompt);
  if(hash===gate.prompt){
    try{
      await fs.writeFile(marker,JSON.stringify({id:raw.prompt_id||null}),{flag:'wx',mode:0o600});
      return {type:'prompt',hash};
    }catch(e){if(e.code!=='EEXIST')throw e;}
  }
  // UserPromptSubmit also receives human input. A notification-shaped string
  // alone authorizes nothing, even when it contains an outstanding agent ID.
  const match=/^<task-notification>\n<task-id>([a-zA-Z0-9_-]{1,80})<\/task-id>\n/.exec(raw.prompt.replace(/\r\n/g,'\n'));
  if(!match || !goodId(raw.prompt_id))return {type:'fail',code:'SESSION'};
  try{
    const first=JSON.parse(await fs.readFile(marker,'utf8'));
    const end=JSON.parse(await fs.readFile(path.join(dir,'finished-'+match[1]),'utf8'));
    if(!goodId(first.id)||!goodId(end.parent)||!goodId(end.nonce)||first.id===raw.prompt_id)throw new Error('SESSION');
    if(end.parent!==first.id)await fs.access(path.join(dir,'wake-prompt-'+end.parent));
    const {queuedClaudeWakeParent}=require('./office-task-claude.cjs');
    const parent=await queuedClaudeWakeParent({transcript:raw.transcript_path,sessionId,cwd:gate.cwd,firstPromptId:first.id,
      firstHash:gate.prompt,agent:match[1],body:raw.prompt,answerHash:end.answer,projectsRoot});
    if(!goodId(parent))throw new Error('SESSION');
    await fs.access(path.join(dir,'pending-'+parent+'-'+match[1]));
    // Each genuine completion may authorize exactly one following prompt.
    await fs.writeFile(path.join(dir,'wake-used-'+end.nonce),'',{flag:'wx',mode:0o600});
    await fs.writeFile(path.join(dir,'wake-prompt-'+raw.prompt_id),'',{flag:'wx',mode:0o600});
    return {type:'wake'};
  }catch{return {type:'fail',code:'SESSION'};}
}
async function receive(dir,sessionId,stream=process.stdin,guardPrompt=false,declaredEvent){
  let size=0;const chunks=[];
  for await(const chunk of stream){ size+=chunk.length;if(size>4*1024*1024)return !guardPrompt;chunks.push(chunk); }
  const raw=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if(declaredEvent && raw?.hook_event_name!==declaredEvent)return false;
  if(declaredEvent==='SessionStart'){
    const gate=JSON.parse(await fs.readFile(path.join(dir,'subscriber.json'),'utf8'));
    if(raw.agent_id || !goodId(raw.session_id) || (raw.session_id!==sessionId && raw.session_id!==gate.probeId) ||
      !path.isAbsolute(raw.cwd||'') || path.relative(gate.cwd,raw.cwd)!=='')return false;
    const file=raw.session_id===gate.probeId?'probe-ready.json':'console-ready.json';
    const proof={nonce:gate.nonce,id:raw.session_id,privateProfile:privateSubscriptionEnv(process.env,dir)};
    await fs.writeFile(path.join(dir,file),JSON.stringify(proof),{mode:0o600,flag:'wx'});
    return true;
  }
  if(raw.hook_event_name==='Stop'||raw.hook_event_name==='SubagentStop')await recordHelper(dir,sessionId,raw);
  let event=receipt(raw,sessionId);
  if(!event)return !guardPrompt || raw.hook_event_name!=='UserPromptSubmit';
  const beforePrompt=guardPrompt && event.type==='prompt';
  let context;
  if(beforePrompt){
    const gate=JSON.parse(await fs.readFile(path.join(dir,'subscriber.json'),'utf8'));
    const ready=await fs.readFile(path.join(dir,'console-ready.json'),'utf8').then(JSON.parse).catch(()=>null);
    let subscriber=null;
    if(ready?.nonce===gate.nonce && ready?.id===sessionId && ready.privateProfile && privateSubscriptionEnv(process.env,dir)){
      try{subscriber=await readSubscriber(gate.file,gate.cwd,process.env,undefined,path.join(dir,'settings.json'));}catch{}
    }
    if(!ready || ready.nonce!==gate.nonce || ready.id!==sessionId)event={type:'fail',code:'HOOKS_OFF'};
    else if(!subscriber || subscriber!==gate.subscriber)event={type:'fail',code:'LOGIN'};
    else {
      event=await acceptRequestedPrompt(dir,sessionId,raw,gate);
      if(event.type==='prompt'){
        const body=await fs.readFile(path.join(dir,'request.txt'),'utf8');
        if(body.length>10000 || hashPrompt(body)!==gate.bodyHash)event={type:'fail',code:'SESSION'};
        else context=body;
      }
    }
  }
  // The native monotonic clock is shared between hook processes. A UUID alone
  // cannot order a prompt and a stop delivered during the same wall-clock millisecond.
  const name=process.hrtime.bigint().toString().padStart(22,'0')+'-'+randomUUID(),tmp=path.join(dir,name+'.tmp');
  // The app creates this directory. An orphaned callback must never recreate it.
  await fs.writeFile(tmp,JSON.stringify(event),{mode:0o600,flag:'wx'});
  await fs.rename(tmp,path.join(dir,name+'.event'));
  if(context)process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:'UserPromptSubmit',additionalContext:context}}));
  return !(beforePrompt && event.type==='fail');
}
if(require.main===module){
  const [dir,sessionId,declaredEvent]=process.argv.slice(2);
  const submission=declaredEvent==='UserPromptSubmit';
  receive(dir,sessionId,process.stdin,submission,declaredEvent).then(allowed=>{
    if(submission && !allowed){
      process.stderr.write('Solio could not verify this task and subscription.');
      process.exitCode=2;
    }
  }).catch(()=>{
    // A failing Stop hook must never ask the model to run another turn.
    if(submission)process.exitCode=2;
  });
}
module.exports={receipt,receive,hashPrompt,claudeSubscriber,readSubscriber,privateSubscriptionEnv,acceptRequestedPrompt};
