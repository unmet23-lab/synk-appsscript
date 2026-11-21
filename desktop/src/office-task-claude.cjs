'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID,createHmac}=require('node:crypto');
const {setTimeout:delay}=require('node:timers/promises');
const {hashPrompt}=require('./office-task-claude-hook.cjs');
const exec=require('node:util').promisify(require('node:child_process').execFile);
const fail = code=>Object.assign(new Error(code),{code});

async function runClaude(spec,hooks,tools) {
  const {file,nodeExe,base}=tools;
  if(!await hooks.checkpoint()) throw fail('CANCELLED');
  const sessionId=spec.sessionId || randomUUID();
  const dir=await fs.mkdtemp(path.join(base,'claude-'));
  let terminal=null,closed=false;
  try {
    const dest=path.join(dir,'settings.json');
    const profileDir=path.join(dir,'console-profiles');
    await fs.mkdir(profileDir,{mode:0o700});
    if(tools.env)tools.env.ANTHROPIC_CONFIG_DIR=profileDir;
    const names=['SessionStart','UserPromptSubmit','Notification','Stop','SubagentStop','StopFailure','SessionEnd'];
    const nativeHooks={};
    for(const name of names){
      const command={type:'command',command:nodeExe,args:[require.resolve('./office-task-claude-hook.cjs'),dir,sessionId,name],timeout:20};
      if(name==='UserPromptSubmit')command.onFailure='block';
      nativeHooks[name]=[{hooks:[command]}];
    }
    await fs.writeFile(dest,JSON.stringify({env:{ANTHROPIC_CONFIG_DIR:profileDir},hooks:nativeHooks}),{flag:'wx',mode:0o600});
    const subscriber=await tools.auth(file,hooks.signal,dest);
    if(!subscriber)throw fail('LOGIN');
    const providerTag=createHmac('sha256',spec.providerSalt || spec.id).update(String(subscriber)).digest('hex');
    if(spec.sessionId){
      if(!spec.providerTag)throw fail('SESSION');
      if(spec.providerTag!==providerTag)throw fail('LOGIN');
    }
    // If managed policy changes after the probe, the actual console can receive
    // only this random dispatch marker. Its verified submit hook supplies the work.
    const prompt='솔리오 사무실 업무 '+randomUUID()+'. 이 차례에 전달된 업무 설명을 수행하세요. 설명이 없으면 작업하지 말고 기다리세요.';
    const expected=hashPrompt(prompt);
    const probeId=randomUUID(),nonce=randomUUID();
    const body=(spec.role?'부서의 역할\n'+spec.role+'\n\n':'')+'회원이 맡긴 업무\n'+spec.prompt;
    await fs.writeFile(path.join(dir,'request.txt'),body,{flag:'wx',mode:0o600});
    await fs.writeFile(path.join(dir,'subscriber.json'),JSON.stringify({file,cwd:spec.cwd,subscriber,prompt:expected,bodyHash:hashPrompt(body),probeId,nonce}),{flag:'wx',mode:0o600});
    if(!await hooks.checkpoint())throw fail('CANCELLED');
    // Managed settings can suppress every per-session hook. Test the actual CLI
    // in this folder without a user message before starting a conversation.
    const checkArgs=['--init-only','--session-id',probeId,'--setting-sources','user','--settings',dest];
    try{
      const check=tools.initOnly||exec;
      await check(file,checkArgs,{cwd:spec.cwd,env:tools.env,signal:hooks.signal,timeout:30000,maxBuffer:262144,windowsHide:true,shell:false});
    }catch{throw fail(hooks.signal.aborted?'CANCELLED':'HOOKS_OFF');}
    const proof=await fs.readFile(path.join(dir,'probe-ready.json'),'utf8').then(JSON.parse).catch(()=>null);
    if(proof?.id!==probeId || proof?.nonce!==nonce)throw fail('HOOKS_OFF');
    if(proof.privateProfile!==true)throw fail('LOGIN');
    const args=[spec.sessionId?'--resume':'--session-id',sessionId,'--setting-sources','user','--settings',dest,'--permission-mode','default'];
    args.push('--',prompt);
    if(!await hooks.session(sessionId,providerTag) || !await hooks.checkpoint()) throw fail('CANCELLED');
    if(spec.sessionId && await tools.auth(file,hooks.signal,dest)!==subscriber)throw fail('LOGIN');
    const startedAt=Date.now();
    terminal=await tools.open(file,args,spec.cwd);
    void terminal.closed.then(()=>{closed=true;});
    if(!await hooks.terminal(terminal.focus,null)) throw fail('CANCELLED');
    let matched=false, candidate=null, published=null, savedPreview=null, eligible=false, idle=false, lastActivity=Date.now(), nextAccessCheck=0, nextProof=0, waiting=true;
    async function resultIfReady(ending=false){
      if(!candidate)return null;
      const confirmed=eligible && await (tools.confirmTurn||confirmClaudeTurn)({transcript:candidate.transcript,sessionId,cwd:spec.cwd,prompt,answer:candidate.answer,startedAt,idle});
      if(!confirmed && !ending && (savedPreview===candidate || !hooks.provisional))return null;
      let account;
      try{account=await tools.auth(file,hooks.signal,dest);}
      catch(error){
        if(error.code==='PROVIDER'){
          if(!ending)return null;
          if(savedPreview)return {answer:savedPreview.answer,sessionId,unconfirmed:true};
        }
        throw error;
      }
      if(account!==subscriber)throw fail('LOGIN');
      if(!confirmed && !ending){
        published=candidate;
        try{
          if(!await hooks.provisional(candidate.answer))throw fail('CANCELLED');
          savedPreview=candidate;
        }
        catch(error){
          // A transient disk failure must not end a turn that can still complete.
          if(error.code!=='WRITE')throw error;
        }
        return null;
      }
      return {answer:candidate.answer,sessionId,...(confirmed?{}:{unconfirmed:true})};
    }
    for(;;) {
      if(hooks.signal.aborted)throw fail('CANCELLED');
      if(Date.now()>=nextAccessCheck){
        if(!await hooks.checkpoint())throw fail('CANCELLED');
        nextAccessCheck=Date.now()+3000;
      }
      const files=(await fs.readdir(dir)).filter(f=>/^\d+-[a-f0-9-]{36}\.event$/.test(f)).sort();
      for(const name of files) {
        const where=path.join(dir,name), event=JSON.parse(await fs.readFile(where,'utf8'));
        await fs.unlink(where); lastActivity=Date.now();
        if(event.type==='prompt'){
          if(matched || event.hash!==expected){eligible=false;if(candidate)return await resultIfReady(true);throw fail('SESSION');}
          matched=true;waiting=false;await hooks.running();
        } else if(event.type==='terminal' || event.type==='unknown'){
          candidate=published;eligible=false;waiting=true;await hooks.terminal(terminal.focus);
        } else if((event.type==='working' || event.type==='wake') && matched){
          candidate=published;eligible=false;waiting=false;await hooks.running();
        } else if(event.type==='fail'){
          if(event.code==='SESSION' && candidate){eligible=false;return await resultIfReady(true);}
          throw fail(event.code);
        } else if(event.type==='answer' && matched){candidate=event;eligible=true;nextProof=0;idle=false;}
        else if(event.type==='idle' || event.type==='idleEnd' || event.type==='end'){
          idle=event.type==='idle';
          const result=await resultIfReady(!idle);if(result)return result;
          if(!idle)throw fail('TERMINAL_CLOSED');
        }
      }
      if(closed && !files.length){const result=await resultIfReady(true);if(result)return result;throw fail('TERMINAL_CLOSED');}
      if(!matched && Date.now()-startedAt>60000 && !await fs.stat(path.join(dir,'console-ready.json')).catch(()=>null))throw fail('HOOKS_OFF');
      if(candidate && (eligible || candidate===published && savedPreview!==candidate) && Date.now()>=nextProof){
        const result=await resultIfReady();if(result)return result;
        nextProof=Date.now()+1500;
      }
      if(!waiting && !candidate && Date.now()-lastActivity>90000){waiting=true;await hooks.terminal(terminal.focus,null);}
      await delay(250,undefined,{signal:hooks.signal}).catch(()=>{throw fail('CANCELLED');});
    }
  } finally {
    if(terminal) {terminal.stop();await terminal.closed;}
    // This randomly created, immediate child of base only contains our private hook settings and receipts.
    if(path.dirname(path.resolve(dir))===path.resolve(base)) await fs.rm(dir,{recursive:true,force:true}).catch(()=>{});
  }
}
const {goodId}=require('./office-task-store.cjs');
const {constants:fsFlags}=require('node:fs');
const os=require('node:os');
const MAX_TRANSCRIPT_TAIL=16*1024*1024;
const MAX_TRANSCRIPT_LINES=50000;
const normalText=text=>typeof text==='string'?text.replace(/\r\n/g,'\n'):null;
const samePath=(left,right)=>typeof left==='string'&&path.isAbsolute(left)&&path.relative(left,right)==='';

function messageText(message,assistant=false){
  const content=message?.content;
  if(typeof content==='string')return normalText(content);
  if(!Array.isArray(content))return null;
  const parts=[];
  for(const block of content){
    if(block?.type==='text' && typeof block.text==='string')parts.push(block.text);
    else if(!assistant || !['thinking','redacted_thinking'].includes(block?.type))return null;
  }
  return parts.length?normalText(parts.join('\n')):null;
}

// Only the single session reported by this job may provide evidence. Bound the
// read even when a long resumed conversation has a large local history.
async function transcriptTail(transcript,root,sessionId){
  if(!path.isAbsolute(transcript)||!path.isAbsolute(root))return null;
  const relative=path.relative(root,transcript);
  const parts=relative.split(path.sep);
  if(path.isAbsolute(relative)||parts.length!==2||!parts[0]||parts[0]==='..'||
    parts[1]!==sessionId+'.jsonl')return null;
  const project=path.dirname(transcript);
  const [rootStat,folderStat,fileStat,realRoot,realFile]=await Promise.all([
    fs.lstat(root),fs.lstat(project),fs.lstat(transcript),fs.realpath(root),fs.realpath(transcript)
  ]);
  if(!rootStat.isDirectory()||!folderStat.isDirectory()||!fileStat.isFile()||fileStat.nlink>1||
    !samePath(realRoot,root)||!samePath(realFile,transcript))return null;
  const handle=await fs.open(transcript,fsFlags.O_RDONLY|(fsFlags.O_NOFOLLOW||0));
  try {
    const opened=await handle.stat();
    if(!opened.isFile()||opened.dev!==fileStat.dev||opened.ino!==fileStat.ino||!opened.size)return null;
    const offset=Math.max(0,opened.size-MAX_TRANSCRIPT_TAIL),count=opened.size-offset;
    const buffer=Buffer.alloc(count);
    let read=0;
    while(read<count){
      const part=await handle.read(buffer,read,count-read,offset+read);
      if(!part.bytesRead)return null;
      read+=part.bytesRead;
    }
    const after=await handle.stat();
    if(after.size!==opened.size||after.mtimeMs!==opened.mtimeMs||!samePath(await fs.realpath(transcript),transcript))return null;
    // A writer may not have finished the final JSONL record yet.
    if(buffer[count-1]!==10)return null;
    const first=offset?buffer.indexOf(10)+1:0;
    if(offset&&!first)return null;
    return buffer.subarray(first).toString('utf8');
  } finally {await handle.close();}
}

function trackBackgroundLaunch(row,promptId,calls,agents){
  if(!goodId(promptId))return;
  const content=row.message?.content;
  if(!Array.isArray(content))return;
  if(row.type==='assistant'){
    for(const block of content){
      // Ctrl+B can move an already-running foreground Agent into the background.
      // Its native async_launched result below is the authority on how it ran.
      if(block?.type==='tool_use'&&['Agent','Task'].includes(block.name)&&typeof block.id==='string')
        calls.set(block.id,{source:row.uuid,parent:promptId});
    }
  }else if(row.type==='user'){
    const result=row.toolUseResult;
    if(result?.isAsync!==true||result.status!=='async_launched'||typeof result.agentId!=='string'||typeof result.description!=='string')return;
    for(const block of content){
      const call=calls.get(block?.tool_use_id);
      if(block?.type==='tool_result'&&call&&call.source===row.sourceToolAssistantUUID){
        agents.set(result.agentId,{id:result.agentId,tool:block.tool_use_id,parent:call.parent,description:result.description});
      }
    }
  }
}

// The official 2.1.323 submission hook runs before the queue item acquires its
// system-origin transcript row. Bind the whole queue body to the observed child
// completion, including the parts outside its answer, before allowing it through.
function agentNotice(body,launch,answerHash){
  const text=normalText(body);
  if(!text||!launch)return false;
  const note='A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.';
  const prefix='<task-notification>\n<task-id>'+launch.id+'</task-id>\n<tool-use-id>'+launch.tool+'</tool-use-id>\n<status>completed</status>\n<summary>Agent "'+launch.description+'" finished</summary>\n<note>'+note+'</note>\n<result>';
  if(!text.startsWith(prefix))return false;
  const end=/<\/result>\n<usage><subagent_tokens>\d{1,12}<\/subagent_tokens><tool_uses>\d{1,12}<\/tool_uses><duration_ms>\d{1,15}<\/duration_ms><\/usage>\n<\/task-notification>$/.exec(text);
  if(!end||end.index<prefix.length)return false;
  return answerHash===undefined||hashPrompt(text.slice(prefix.length,end.index))===answerHash;
}

function nativeWakeRow(row,agents){
  if(row.origin?.kind!=='task-notification'||row.origin.producer!=='session-task'||
    typeof row.origin.runId!=='string'||!row.origin.runId||row.turnOrigin!=='task_notification'||
    row.promptSource!=='system'||!goodId(row.promptId)||row.message?.role!=='user')return false;
  const body=messageText(row.message);
  const id=body&&/^<task-notification>\n<task-id>([a-zA-Z0-9_-]{1,80})<\/task-id>\n/.exec(body)?.[1];
  return id&&agentNotice(body,agents.get(id))?id:null;
}

async function queuedClaudeWakeParent({transcript,sessionId,cwd,firstPromptId,firstHash,agent,body,answerHash,projectsRoot}){
  if(typeof transcript!=='string'||!goodId(sessionId)||!goodId(firstPromptId)||typeof cwd!=='string'||!path.isAbsolute(cwd))return false;
  try{
    const root=projectsRoot??path.join(os.homedir(),'.claude','projects');
    const text=await transcriptTail(transcript,root,sessionId);
    if(text===null)return false;
    const lines=text.split('\n');
    if(lines.length>MAX_TRANSCRIPT_LINES)return false;
    const calls=new Map(),agents=new Map();
    const queue=[];
    let nextQueued=0,tail=null,turn=null,released=false;
    for(const line of lines){
      if(!line.trim())continue;
      const row=JSON.parse(line);
      if(row.isSidechain===true)continue;
      if(tail&&row.type==='queue-operation'){
        if(row.sessionId!==sessionId)return false;
        if(row.operation==='enqueue')queue.push(normalText(row.content)===normalText(body));
        else if(row.operation==='dequeue' && nextQueued<queue.length){
          if(queue[nextQueued++])released=true;
        }else return false;
        continue;
      }
      if(!['user','assistant','attachment','system'].includes(row.type))continue;
      if(!tail){
        if(row.type!=='user'||row.promptId!==firstPromptId)continue;
        const first=messageText(row.message);
        if(row.message?.role!=='user'||row.origin?.kind!=='human'||row.promptSource!=='typed'||
          row.turnOrigin!=='human'||first===null||hashPrompt(first)!==firstHash)return false;
        turn=firstPromptId;
      }else{
        if(row.parentUuid!==tail)return false;
        if(row.type==='user' && !Array.isArray(row.message?.content)){
          if(!nativeWakeRow(row,agents))return false;
          if(messageText(row.message)===normalText(body))released=false;
          turn=row.promptId;
        }else if(row.type==='user'&&row.message.content.some(block=>block?.type!=='tool_result'))return false;
      }
      if(row.isSidechain!==false||row.sessionId!==sessionId||!samePath(row.cwd,cwd)||!goodId(row.uuid))return false;
      tail=row.uuid;trackBackgroundLaunch(row,turn,calls,agents);
    }
    const launch=agents.get(agent);
    return released&&agentNotice(body,launch,answerHash)?launch.parent:null;
  }catch{return false;}
}

function confirmedTranscript(text,{sessionId,cwd,prompt,answer,startedAt}){
  let tail=null,stage='waiting',summary=null;
  let turn=null;
  const calls=new Map(),agents=new Map(),reported=new Set();
  const expectedPrompt=normalText(prompt),expectedAnswer=normalText(answer);
  let start=0,lines=0;
  while(start<text.length){
    if(++lines>MAX_TRANSCRIPT_LINES)return false;
    const end=text.indexOf('\n',start);
    if(end<0)return false;
    const line=text.slice(start,end);
    start=end+1;
    if(!line.trim())continue;
    const row=JSON.parse(line);
    if(!row||typeof row!=='object')return false;
    if(row.isSidechain===true)continue;
    if(!['user','assistant','attachment','system'].includes(row.type))continue;
    const human=row.type==='user' && (row.origin?.kind==='human'||row.promptSource==='typed'||row.turnOrigin==='human');
    if(!tail){
      if(!human||row.sessionId!==sessionId||!samePath(row.cwd,cwd))continue;
      const at=Date.parse(row.timestamp);
      if(!Number.isFinite(at))return false;
      if(at<startedAt)continue;
      if(row.isSidechain!==false||!goodId(row.uuid)||row.origin?.kind!=='human'||row.promptSource!=='typed'||
        row.turnOrigin!=='human'||row.message?.role!=='user'||messageText(row.message)!==expectedPrompt)return false;
      tail=row.uuid;turn=row.promptId;stage='working';continue;
    }
    if(row.isSidechain!==false||row.sessionId!==sessionId||!samePath(row.cwd,cwd)||!goodId(row.uuid)||
      row.parentUuid!==tail||human)return false;
    tail=row.uuid;
    trackBackgroundLaunch(row,turn,calls,agents);
    if(row.type==='user'){
      // Tool results can occur between the job's typed request and its answer.
      // A second text prompt or an interruption belongs to a different input.
      const wake=nativeWakeRow(row,agents);
      if(wake){reported.add(agents.get(wake));turn=row.promptId;}
      else if(row.message?.role!=='user'||!Array.isArray(row.message.content)||!row.message.content.length||
        !row.message.content.every(block=>block?.type==='tool_result'))return false;
      stage='working';summary=null;
    }else if(row.type==='assistant'){
      if(row.message?.role!=='assistant')return false;
      stage=row.message.stop_reason==='end_turn' && messageText(row.message,true)===expectedAnswer?'answer':'working';
      summary=null;
    }else if(row.type==='attachment'){
      if(/interrupt|cancel|abort|queued_command/i.test(row.attachment?.type||''))return false;
    }else if(row.subtype==='stop_hook_summary'){
      const clean=row.preventedContinuation===false&&Array.isArray(row.hookErrors)&&!row.hookErrors.length&&
        !row.stopReason&&Array.isArray(row.hookAdditionalContext)&&!row.hookAdditionalContext.length;
      stage=stage==='answer'&&clean?'summary':'working';summary=stage==='summary'?row.uuid:null;
    }else if(row.subtype==='turn_duration'){
      stage=stage==='summary'&&row.parentUuid===summary?'confirmed':'working';summary=null;
    }else{
      // A future lifecycle event cannot certify the preceding answer.
      return false;
    }
  }
  return stage==='confirmed'&&Array.from(agents.values()).every(launch=>reported.has(launch));
}

async function confirmClaudeTurn({transcript,sessionId,cwd,prompt,answer,startedAt,projectsRoot}={}){
  if(typeof transcript!=='string'||!goodId(sessionId)||typeof cwd!=='string'||!path.isAbsolute(cwd)||
    typeof prompt!=='string'||!prompt||typeof answer!=='string'||!answer||!Number.isSafeInteger(startedAt)||startedAt<=0)return false;
  try {
    const root=projectsRoot===undefined?path.join(os.homedir(),'.claude','projects'):projectsRoot;
    if(typeof root!=='string')return false;
    const text=await transcriptTail(transcript,root,sessionId);
    return text!==null&&confirmedTranscript(text,{sessionId,cwd,prompt,answer,startedAt});
  }catch{return false;}
}

module.exports={runClaude,confirmClaudeTurn,queuedClaudeWakeParent};
