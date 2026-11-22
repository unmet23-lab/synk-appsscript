'use strict';
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { createHmac } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { goodId, MAX_ANSWER } = require('./office-task-store.cjs');

const RPC_TIMEOUT = 25_000;
const MAX_FRAME = 12 * 1024 * 1024;
const POLL_MS = 900;
const TURN_IDLE_MS = 10 * 60_000;
const reviewer = { approvalPolicy: 'on-request', approvalsReviewer: 'user' };
const error = code => Object.assign(new Error(code), {code});

function providerError(raw, fallback = 'PROVIDER') {
  const info = raw?.codexErrorInfo ?? raw?.data?.codexErrorInfo;
  const http = info && typeof info === 'object' ? Object.values(info)[0]?.httpStatusCode : null;
  if (info === 'unauthorized' || http === 401) return error('LOGIN');
  if (['usageLimitExceeded','rateLimitExceeded','sessionBudgetExceeded'].includes(info) || http === 429) return error('LIMIT');
  const message = String(raw?.message || '');
  if (/\b(sign in|not logged in|not authenticated|unauthorized)\b/i.test(message)) return error('LOGIN');
  if (/\b(usage limit|rate limit|quota exceeded)\b/i.test(message)) return error('LIMIT');
  return error(fallback);
}

async function checkpoint(hooks) {
  if (hooks.signal.aborted || !await hooks.checkpoint() || hooks.signal.aborted) throw error('CANCELLED');
}

// One child owns one stdio connection. Notifications and replies may arrive in either order.
function connect(spec, hooks, tools, receive, args=['app-server','--stdio','-c','model_provider="openai"','-c','approvals_reviewer="user"']) {
  let child;
  try { child = tools.spawn(tools.file,args,{cwd:spec.cwd,env:tools.env,stdio:['pipe','pipe','pipe'],shell:false,windowsHide:true}); }
  catch { throw error('NATIVE'); }
  const pending = new Map();
  let tail = '', next = 0, ended = false, fault = null, finishClose, activeTurn;
  const closed = new Promise(resolve=>{ finishClose = resolve; });
  const fail = e => {
    fault ??= e;
    for (const request of pending.values()) request.reject(fault);
    pending.clear();
  };
  const finish = () => {
    if (ended) return;
    ended = true;
    fail(error(hooks.signal.aborted ? 'CANCELLED' : 'NATIVE'));
    finishClose();
  };
  function send(data) {
    if (fault || ended) throw fault || error('NATIVE');
    try { child.stdin.write(JSON.stringify(data)+'\n'); } catch { throw error('NATIVE'); }
  }
  function parse(line) {
    let message;
    try { message = JSON.parse(line); } catch { fail(error('NATIVE')); return; }
    if (message?.method) { receive(message); return; }
    const request = pending.get(message?.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(providerError(message.error));
    else request.resolve(message.result);
  }
  child.stderr.on('data',()=>{});
  child.on('error',finish);
  child.on('close',finish);
  child.on('exit',finish);
  child.stdin.on('error',()=>fail(error(hooks.signal.aborted ? 'CANCELLED' : 'NATIVE')));
  child.stdout.setEncoding('utf8');
  child.stdout.on('data',chunk=>{
    if (fault) return;
    tail += chunk;
    let cut;
    while ((cut=tail.indexOf('\n'))>=0) {
      if (cut>MAX_FRAME) { fail(error('RESULT_TOO_LARGE')); return; }
      const line=tail.slice(0,cut).trim();
      tail=tail.slice(cut+1);
      if (line) parse(line);
      if (fault) return;
    }
    if (tail.length>MAX_FRAME) fail(error('RESULT_TOO_LARGE'));
  });
  function rpc(method,params,timeoutMs=RPC_TIMEOUT) {
    if (fault) return Promise.reject(fault);
    const id=++next;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{pending.delete(id);reject(error('NATIVE'));},timeoutMs);
      const finish = fn => value=>{clearTimeout(timer);fn(value);};
      const request={resolve:finish(resolve),reject:finish(reject)};
      pending.set(id,request);
      try { send({id,method,params}); } catch(e) { pending.delete(id);request.reject(e); }
    });
  }
  function kill() { try { child.kill(); } catch {} }
  function interruptActive() {
    if (!activeTurn || ended || fault) return;
    const params=activeTurn;
    activeTurn=null;
    try {send({id:++next,method:'turn/interrupt',params});} catch {}
  }
  const abort = () => { interruptActive();fail(error('CANCELLED')); };
  hooks.signal.addEventListener('abort',abort,{once:true});
  if (hooks.signal.aborted) abort();
  return {
    rpc, send, get fault(){return fault;}, active(turn){activeTurn=turn;}, interruptActive,
    async close() {
      hooks.signal.removeEventListener('abort',abort);
      try {
        if (ended) return true;
        try { child.stdin.end(); } catch {}
        if (await waitClosed(closed,850)) return true;
        kill();return await waitClosed(closed,1600);
      } finally {
        // A descendant may keep inherited pipe handles open after the server has exited.
        child.stdin.destroy();child.stdout.destroy();child.stderr.destroy();child.unref?.();
      }
    }
  };
}

function waitClosed(closed,ms) {
  return new Promise(resolve=>{
    const timer=setTimeout(()=>resolve(false),ms);
    closed.then(()=>{clearTimeout(timer);resolve(true);});
  });
}

async function openAccount(client,salt,capture) {
  await client.rpc('initialize',{clientInfo:{name:'solio_office',title:'Solio',version:'1.0.0'},capabilities:{experimentalApi:true}});
  client.send({method:'initialized'});
  return readAccount(client,salt,capture);
}

async function readAccount(client,salt,capture) {
  const result=await client.rpc('account/read',{refreshToken:false});
  if (result?.account?.type !== 'chatgpt') throw error('LOGIN');
  const user=typeof result.userId==='string' ? result.userId.trim() : '';
  const mail=typeof result.account.email==='string' ? result.account.email.trim().toLowerCase() : '';
  if (!user && !mail) throw error('LOGIN');
  const workspace=result.workspaceRouting?.chatgptAccountId;
  // An unidentified workspace may start a fresh task but cannot prove ownership of earlier turns.
  if (typeof workspace!=='string' || !workspace.trim()) return null;
  const identity=[user?'id':'email',user||mail,workspace.trim()];
  const tagFor=key=>createHmac('sha256',key).update(JSON.stringify(identity)).digest('hex');
  capture?.(workspace.trim(),tagFor);
  return tagFor(salt);
}

function sameAccount(first,current) {
  return !!first && first===current;
}

function sameDirectory(a,b) {
  if (typeof a!=='string' || typeof b!=='string' || !path.isAbsolute(a) || !path.isAbsolute(b)) return false;
  const key=p=>process.platform==='win32' ? path.toNamespacedPath(path.resolve(p)).toLowerCase() : path.resolve(p);
  return key(a)===key(b);
}

function answerCandidate(item) {
  if (item?.type!=='agentMessage' || item.phase!=null && item.phase!=='final_answer' ||
      typeof item.text!=='string' || !item.text.trim()) return null;
  return item.text.length>MAX_ANSWER ? {tooLarge:true} : {text:item.text};
}

function complete(turn,last) {
  if (turn?.status==='failed') throw providerError(turn.error);
  if (turn?.status==='interrupted') throw error('CANCELLED');
  if (turn?.status!=='completed') throw error('SESSION');
  // A missing phase is allowed by the native schema. Only the last substantive
  // completed item in a successful turn can supply an unphased compatibility answer.
  let candidate=last;
  for (const item of turn.items || []) {
    if (item?.type!=='contextCompaction') candidate=answerCandidate(item);
  }
  if (candidate?.tooLarge) throw error('RESULT_TOO_LARGE');
  if (!candidate?.text) throw error('NO_ANSWER');
  return candidate.text;
}

const pause = (ms,signal)=>delay(ms,undefined,{signal}).catch(()=>{throw error('CANCELLED');});

// Keep only the current thread's terminal messages. Command output, request contents and deltas are discarded.
function liveTurn() {
  let threadId = null, selected = null, invalid = null;
  const turns = new Map();
  function receive(message) {
    const p=message.params || {};
    const owner=p.threadId ?? p.conversationId;
    if (message.id!=null && !owner && threadId) {
      invalid=error(/auth.*(token|refresh)/i.test(message.method)?'LOGIN':'PERMISSION');
      return;
    }
    if (!threadId || owner!==threadId) return;
    const id=p.turnId ?? p.turn?.id;
    if (!goodId(id)) {
      if (message.id!=null) invalid=error('PERMISSION');
      return;
    }
    if (selected && selected!==id) return;
    if (!turns.has(id)) {
      if (turns.size>=32) { invalid=error('SESSION');return; }
      turns.set(id,{});
    }
    const receipt=turns.get(id);
    if (message.id!=null || message.method.startsWith('item/') || message.method.startsWith('turn/')) {
      receipt.activity=performance.now();
    }
    if (message.id!=null) { receipt.protected=true;return; }
    if (p.item?.type!=='contextCompaction') {
      if (message.method==='item/started') receipt.answer=null;
      if (message.method==='item/completed') receipt.answer=answerCandidate(p.item);
    }
    if (message.method==='turn/completed') receipt.end=p.turn;
  }
  return {receive,thread(id){threadId=id;},turn(id){selected=id;},get(id){if(invalid)throw invalid;return turns.get(id)||{};}};
}

function nativePrompt(taskId) {
  if (!goodId(taskId)) throw error('SESSION');
  return '솔리오 업무 '+taskId+'를 이어 주세요. 직전 차례에서 이미 실행한 작업을 확인하고, 끝난 작업은 되풀이하지 마세요. 남은 작업에 필요한 권한은 이 터미널에서 사용자에게 물어보세요.';
}

async function nativeContinuation(spec,hooks,tools,threadId,identity,salt) {
  // A positional prompt submits it immediately. The operator enters the continuation in the official terminal.
  const args=['resume','--no-daemon','--sandbox','read-only','--ask-for-approval','on-request','-c','approvals_reviewer="user"','-c','model_provider="openai"',threadId];
  let active=true,opening=null,handle=null,closed=null,ended=false,closeFailed=false,stopIssued=false;
  async function verify(client) {
    if (!sameAccount(identity,await readAccount(client,salt))) throw error('LOGIN');
  }
  function stopOwned() {
    if (!handle || ended || stopIssued) return;
    stopIssued=true;
    try { handle.stop(); } catch {}
  }
  async function launch() {
    await checkpoint(hooks);
    const verifier=connect(spec,hooks,tools,()=>{});
    try {
      if (!sameAccount(identity,await openAccount(verifier,salt))) throw error('LOGIN');
      await checkpoint(hooks);
      await verify(verifier);
      let window;
      try { window=await tools.open(tools.file,args,spec.cwd); } catch { throw error('NATIVE'); }
      if (!window || typeof window.focus!=='function' || !window.closed || typeof window.stop!=='function') throw error('NATIVE');
      handle=window;
      closed=Promise.resolve(handle.closed).then(()=>{ended=true;},()=>{ended=true;closeFailed=true;});
      await checkpoint(hooks);
      await verify(verifier);
      return true;
    } finally { await verifier.close(); }
  }
  const open=async()=>{
    if (!active || hooks.signal.aborted || ended) return false;
    if (!opening) {
      opening=launch();
      try { return await opening; } catch { return false; }
    }
    try { return await opening && !ended && !!await handle.focus(); } catch { return false; }
  };
  hooks.signal.addEventListener('abort',stopOwned,{once:true});
  try {
    if (!await hooks.terminal(open,'PERMISSION')) {
      if (opening) await opening;
      throw error('CANCELLED');
    }
    while (!opening) {
      await checkpoint(hooks);
      await pause(POLL_MS,hooks.signal);
    }
    await opening;
    await checkpoint(hooks);
    if (!await hooks.terminal(open,'MANUAL_RESULT')) throw error('CANCELLED');
    // The independent process owns its messages. Its account and answer cannot be attested by a reader.
    // Solio's separate, member-initiated paste action is the only way to store a terminal answer.
    while (!ended) {
      await checkpoint(hooks);
      await pause(POLL_MS,hooks.signal);
    }
    await checkpoint(hooks);
    throw error(closeFailed?'NATIVE':'MANUAL_RESULT');
  } finally {
    active=false;
    hooks.signal.removeEventListener('abort',stopOwned);
    if (opening) await opening.catch(()=>{});
    stopOwned();
    // Hold this thread's lease until its dedicated terminal has actually exited.
    if (closed) await closed;
  }
}

async function runCodex(spec,hooks,tools) {
  const rootId=spec.providerSalt ?? spec.id;
  if (!goodId(spec.id) || !goodId(rootId)) throw error('SESSION');
  if (spec.previousId!=null && (!goodId(spec.previousId) || !goodId(spec.sessionId))) throw error('SESSION');
  if (spec.sessionId!=null) {
    const hasSavedTag=typeof spec.providerTag==='string' && /^[a-f0-9]{64}$/.test(spec.providerTag);
    if (!goodId(spec.sessionId) || !goodId(spec.providerSalt) || !hasSavedTag) throw error('SESSION');
  }
  if (!path.isAbsolute(tools.file || '') || /\.(bat|cmd|ps1)$/i.test(tools.file)) throw error('NATIVE');
  await checkpoint(hooks);
  const live=liveTurn();
  const client=connect(spec,hooks,tools,live.receive);
  const salt='solio:office:codex:account-workspace:v2\0'+rootId.toLowerCase();
  let threadId,turnId,identity,handOff=false;
  try {
    identity=await openAccount(client,salt);
    if (spec.sessionId && !sameAccount(spec.providerTag,identity)) throw error('LOGIN');
    await checkpoint(hooks);
    const options={cwd:spec.cwd,modelProvider:'openai',...reviewer,sandbox:'read-only'};
    if (spec.sessionId) {
      const saved=await client.rpc('thread/read',{threadId:spec.sessionId,includeTurns:false});
      if (saved?.thread?.id!==spec.sessionId || saved.thread.modelProvider!=='openai' || !sameDirectory(saved.thread.cwd,spec.cwd) || saved.thread.status?.type==='active') throw error('SESSION');
    }
    const thread = spec.sessionId
      ? await client.rpc('thread/resume',{...options,threadId:spec.sessionId,excludeTurns:true})
      : await client.rpc('thread/start',{...options,ephemeral:false});
    threadId=thread?.thread?.id;
    if (!goodId(threadId) || spec.sessionId && threadId!==spec.sessionId || thread.modelProvider!=='openai' || !sameDirectory(thread.thread.cwd,spec.cwd)) throw error('SESSION');
    live.thread(threadId);
    if (!await hooks.session(threadId,identity)) throw error('CANCELLED');
    await checkpoint(hooks);
    const content=[];
    if (spec.role) content.push({type:'text',text:'담당 역할\n'+spec.role,text_elements:[]});
    content.push({type:'text',text:spec.prompt,text_elements:[]});
    const started=await client.rpc('turn/start',{threadId,clientUserMessageId:spec.id,input:content,...reviewer,sandboxPolicy:{type:'readOnly',networkAccess:false}});
    turnId=started?.turn?.id;
    if (!goodId(turnId)) throw error('SESSION');
    live.turn(turnId);
    client.active({threadId,turnId});
    const began=performance.now();
    let interruptAt=null,interruptReason=null,nextCheck=0;
    for (;;) {
      if (Date.now()>=nextCheck) {await checkpoint(hooks);nextCheck=Date.now()+1000;}
      const receipt=live.get(turnId);
      if (receipt.end) {
        client.active(null);
        if (interruptReason==='permission' && receipt.end.status==='interrupted') { handOff=true;break; }
        if (interruptReason==='idle' && receipt.end.status==='interrupted') throw error('NO_ANSWER');
        await checkpoint(hooks);
        return {answer:complete(receipt.end,receipt.answer),sessionId:threadId};
      }
      if (client.fault) throw client.fault;
      const idle=performance.now()-(receipt.activity??began)>=TURN_IDLE_MS;
      if (interruptAt===null && (receipt.protected || idle)) {
        await checkpoint(hooks);
        interruptAt=performance.now();
        interruptReason=receipt.protected?'permission':'idle';
        client.active(null);
        // Leave the server's approval request unanswered; the client can only interrupt its own turn.
        try {await client.rpc('turn/interrupt',{threadId,turnId});}
        catch(e){if(!live.get(turnId).end)throw e;}
      }
      if (interruptAt!==null && performance.now()-interruptAt>RPC_TIMEOUT) throw error(interruptReason==='permission'?'PERMISSION':'PROVIDER');
      await pause(150,hooks.signal);
    }
  } finally {
    client.interruptActive();
    const closed=await client.close();
    if (handOff && !closed) throw error('NATIVE');
  }
  await checkpoint(hooks);
  return nativeContinuation(spec,hooks,tools,threadId,identity,salt);
}
async function withMailPlannerAccount(spec,hooks,tools,work) {
  const {mailServerArgs,mailTurn}=require('./office-mail-rpc.cjs');
  const root=spec.quoteRecipient?spec.quoteAccountSalt:spec.providerSalt||spec.id;
  if(!goodId(root)||!goodId(spec.id))throw error('SESSION');
  const prefix='solio:office:mail-planner:v1\0',salt=prefix+root;
  if(spec.requireJudgedAccount&&(!goodId(spec.judgedAccountSalt)||!spec.judgedAccountTag))throw error('LOGIN');
  await checkpoint(hooks);
  const turn=mailTurn(providerError),client=connect(spec,hooks,tools,turn.receive,mailServerArgs());
  let workspace;
  const capture=(current,tagFor)=>{
    if(workspace&&workspace!==current)throw error('LOGIN');
    workspace=current;
    if(spec.judgedAccountTag&&!sameAccount(spec.judgedAccountTag,tagFor(prefix+(spec.judgedAccountSalt||root))))throw error('LOGIN');
  };
  try{
    const account=await openAccount(client,salt,capture),continuing=spec.previousMail&&!spec.mailJudge&&!spec.mailPlanOnly;
    if(!account||continuing&&!sameAccount(account,spec.providerTag)||spec.quoteRecipient&&!sameAccount(account,spec.quoteAccountTag))throw error('LOGIN');
    turn.guard();
    await checkpoint(hooks);
    const sessionId=continuing?spec.sessionId:spec.id;
    if(!goodId(sessionId)||!await hooks.session(sessionId,account))throw error('CANCELLED');
    const verify=async()=>{await checkpoint(hooks);if(!sameAccount(account,await readAccount(client,salt,capture)))throw error('LOGIN');turn.check();};
    const result=await work((prompt,schema)=>turn.ask(client,{cwd:spec.cwd,id:spec.id,workspace,signal:hooks.signal,verify},prompt,schema));
    await verify();
    return result;
  }finally{client.interruptActive();await client.close();}
}
/* 셋째 조각 기능의 도구 없는 차례(기능줄_경쟁사_설계.md 2.4). 메일 계획과 같은 서버 설정·계정 확인을 쓰고,
   차례마다 새 스레드와 새 상태를 잡는다. 실패 코드는 기능이 정한다 */
async function withSchemaAccount(spec,hooks,tools,work,codes) {
  const {mailServerArgs}=require('./office-mail-rpc.cjs');
  const {schemaTurn}=require('./office-schema-turn.cjs');
  if(!goodId(spec.id))throw error('SESSION');
  const salt='solio:office:feature:v1\0'+spec.id;
  await checkpoint(hooks);
  const turn=schemaTurn(providerError,codes),client=connect(spec,hooks,tools,turn.receive,mailServerArgs());
  let workspace;
  const capture=current=>{if(workspace&&workspace!==current)throw error('LOGIN');workspace=current;};
  try{
    const account=await openAccount(client,salt,capture);
    if(!account)throw error('LOGIN');
    turn.guard();
    await checkpoint(hooks);
    const verify=async()=>{await checkpoint(hooks);if(!sameAccount(account,await readAccount(client,salt,capture)))throw error('LOGIN');turn.check();};
    const result=await work((prompt,schema,options={})=>turn.ask(client,{cwd:spec.cwd,workspace,signal:hooks.signal,verify,...options},prompt,schema));
    await verify();
    return result;
  }finally{client.interruptActive();await client.close();}
}
module.exports={runCodex,nativePrompt,withMailPlannerAccount,withSchemaAccount};

