'use strict';
const fs = require('node:fs/promises');
const {renameSync} = require('node:fs');
const path = require('node:path');
const { randomUUID,createHash } = require('node:crypto');
const { ID: MEMBER } = require('./site-visits.cjs');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROVIDERS = ['claude', 'codex'];
const STATES = ['queued', 'paused', 'running', 'terminal', 'completed', 'interrupted', 'failed'];
const REASONS = ['RESTART', 'AUTH_CHANGED', 'CANCELLED', 'NO_CLI', 'LOGIN', 'LIMIT', 'PROVIDER', 'TERMINAL_CLOSED', 'NO_ANSWER', 'FOLDER', 'SESSION', 'PERMISSION', 'NATIVE', 'WRITE', 'RESULT_TOO_LARGE', 'UNCONFIRMED', 'HOOKS_OFF', 'MANUAL_RESULT','MEMBER_RESULT'];
REASONS.push('MAIL_CHOOSE','MAIL_REVIEW','MAIL_CONNECT','MAIL_RECONNECT','MAIL_CONFIG','MAIL_PLAN','MAIL_NETWORK','MAIL_STORAGE','MAIL_LIMIT','MAIL_SCOPE','MAIL_CANCELLED','MAIL_CHANGED','MAIL_BUSY','MAIL_TIMEOUT','MAIL_NOT_FOUND','MAIL_NO_MAILBOX');
const MAX_PROMPT = 8000;
const MAX_ANSWER = 512 * 1024;
const MAX_BYTES = 32 * 1024 * 1024;
const MAX_TASKS = 512;
const originalRow=Symbol('unreadable receipt');
const legacyNative=Symbol('archived terminal result');
const digest=text=>createHash('sha256').update(text).digest('hex');
const previewName=(id,ref)=>id+'.preview-'+ref+'.txt';
const problem = code => ({ ok: false, code });
const goodId = value => typeof value === 'string' && UUID.test(value);
const goodDepartment = id => id === null || typeof id === 'string' && /^[A-Za-z0-9_-]{4,32}$/.test(id);

function submission(value) {
  if (!value || !goodId(value.id) || !PROVIDERS.includes(value.provider) || !goodDepartment(value.departmentId ?? null)) return null;
  if (value.previousId != null && !goodId(value.previousId)) return null;
  if (typeof value.prompt !== 'string' || value.prompt.length > MAX_PROMPT || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value.prompt)) return null;
  const prompt = value.prompt.trim();
  if(value.mailSearch!=null&&(typeof value.mailSearch!=='boolean'||value.mailSearch&&value.provider!=='codex'))return null;
  if(value.quoteHandoff!=null&&(typeof value.quoteHandoff!=='boolean'||value.quoteHandoff&&(value.provider!=='codex'||value.mailSearch===false||value.mailRetry)))return null;
  if(value.quoteResumeOf!=null&&(!goodId(value.quoteResumeOf)||value.quoteHandoff!==true||value.mailSearch!==true||value.previousId!=null))return null;
  if(value.mailRetry!=null&&(typeof value.mailRetry!=='boolean'||value.mailRetry&&(!value.mailSearch||!value.previousId)))return null;
  return prompt ? { id: value.id.toLowerCase(), provider: value.provider, departmentId: value.departmentId ?? null, prompt, previousId: value.previousId?.toLowerCase() ?? null,...(typeof value.mailSearch==='boolean'?{mailSearch:value.mailSearch}:{}),...(value.mailRetry===true?{mailRetry:true}:{}),...(value.quoteHandoff===true?{quoteHandoff:true}:{}),...(value.quoteResumeOf?{quoteResumeOf:value.quoteResumeOf.toLowerCase()}:{}) } : null;
}
function validRow(row) {
  return submission(row) && STATES.includes(row.status) && typeof row.departmentName === 'string' &&
    typeof row.answer === 'string' && row.answer.length <= MAX_ANSWER && (row.reason === null || REASONS.includes(row.reason)) &&
    (row.provisionalRef==null || typeof row.provisionalRef==='string' && /^[a-f0-9]{64}$/.test(row.provisionalRef)) &&
    (row.provisional==null || (row.provider==='claude' && ['running','terminal'].includes(row.status) &&
     typeof row.provisional==='string' && row.provisional.length<=MAX_ANSWER)) &&
    Number.isSafeInteger(row.createdAt) && Number.isSafeInteger(row.updatedAt) && (row.sessionId == null || goodId(row.sessionId));
}
function baseTask(row) {
  const {id, provider, departmentId, departmentName, prompt, previousId, status, answer, reason, createdAt, updatedAt} = row;
  if(row.quoteOrigin){
    const receipt=status==='completed'?row.mailReceipt:null;
    return {id,provider,departmentId,departmentName,prompt,previousId,status,reason,createdAt,updatedAt,mailSearch:true,
      quoteSource:{...row.quoteOrigin},quoteOutcome:receipt?.quoteOutcome||null,answer:receipt?.draftText||''};
  }
  if(row.mailSearch){
    const {visibleReceipt,summary}=require('./office-mail.cjs');
    const receipt=status==='completed'?row.mailReceipt:null;
    return {id,provider,departmentId,departmentName,prompt,previousId,status,reason,createdAt,updatedAt,mailSearch:true,
      ...(row.quoteHandoff?{quoteHandoff:true,handoffs:[]}:{}),answer:receipt?summary(receipt):'',...(receipt?{mailResult:visibleReceipt(receipt)}:{})};
  }
  if(provider==='codex' && row.viaTerminal===true && (status==='completed' || ['UNCONFIRMED','MANUAL_RESULT'].includes(reason))){
    return {id,provider,departmentId,departmentName,prompt,previousId,status:status==='terminal'?'terminal':'interrupted',
      answer:'',reason:'MANUAL_RESULT',createdAt,updatedAt,viaTerminal:true,...(row.mailSearch===false?{mailSearch:false}:{})};
  }
  const visibleAnswer=provider==='codex' && row.viaTerminal===true && reason!=='MEMBER_RESULT'?'':answer;
  return { id, provider, departmentId, departmentName, prompt, previousId, status, answer:visibleAnswer, reason, createdAt, updatedAt, viaTerminal:row.viaTerminal===true,...(row.mailSearch===false?{mailSearch:false}:{}) };
}

function publicTask(row){
  const visible=baseTask(row);
  if(['pending','ordinary','choose'].includes(row.mailDecision))visible.mailDecision=row.mailDecision;
  if(row.mailDecision==='choose'&&REASONS.includes(row.mailDecisionReason))visible.mailDecisionReason=row.mailDecisionReason;
  return visible;
}
// A metadata-only read can update one task while preserving its neighbours' original receipts.
function editMetadata(row){delete row[originalRow];return row;}

// Checking the current login and publishing the prepared file share one main-thread turn.
function commitFile(from,to,current) {
  if(!current())throw new Error('AUTH_CHANGED');
  renameSync(from,to);
}

// A single source instance owns this member's ledger. Never replace an unreadable ledger.
function createTaskStore(userData, io = fs, mail=null) {
  const memberDir = member => {
    if (typeof member !== 'string' || !MEMBER.test(member) || ['.','..'].includes(member)) throw new Error('ACCOUNT');
    return path.join(userData, 'Office', member);
  };
  const storedAnswers = new Set();
  async function loadMemberAnswer(member,row){
    if(row.provider!=='codex')return false;
    const file=path.join(memberDir(member),'answers',row.id+'.member.json');
    let receipt;
    try{
      if((await io.stat(file)).size>6*MAX_ANSWER+512)throw new Error('STORAGE');
      receipt=JSON.parse(await io.readFile(file,'utf8'));
    }catch(error){
      if(error.code==='ENOENT' && row.reason!=='MEMBER_RESULT')return false;
      throw error;
    }
    if(receipt?.id!==row.id || receipt.source!=='member' || typeof receipt.answer!=='string' || !receipt.answer.trim() ||
        receipt.answer.length>MAX_ANSWER || !Number.isSafeInteger(receipt.updatedAt))throw new Error('STORAGE');
    Object.assign(row,{status:'interrupted',reason:'MEMBER_RESULT',answer:receipt.answer,updatedAt:receipt.updatedAt,viaTerminal:true,answerFile:true});
    storedAnswers.add(member+'/'+row.id+'/member');
    return true;
  }
  async function loadAnswer(member, row) {
    const answers=path.join(memberDir(member),'answers'), file=path.join(answers,row.id+'.json');
    let receipt;
    try {
      if((await io.stat(file)).size>6*MAX_ANSWER+512)throw new Error('STORAGE');
      receipt=JSON.parse(await io.readFile(file,'utf8'));
    }catch(e){
      if(e.code!=='ENOENT')throw e;
      if(row.answerFile!==true)return;
      const legacyTerminal=row.provider==='codex' && row.viaTerminal===true && row.status==='interrupted' && row.reason==='UNCONFIRMED';
      if(!legacyTerminal && (row.status!=='completed' || row.reason!==null))throw e;
      const legacy=path.join(answers,row.id+'.txt');
      if((await io.stat(legacy)).size>4*MAX_ANSWER)throw new Error('STORAGE');
      const answer=await io.readFile(legacy,'utf8');
      if(!answer.trim() || answer.length>MAX_ANSWER)throw new Error('STORAGE');
      row.answer=answer;
      return;
    }
    if(!receipt || receipt.id!==row.id || !Number.isSafeInteger(receipt.updatedAt) ||
      receipt.sessionId!=null && !goodId(receipt.sessionId) ||
      typeof receipt.answer!=='string' || !receipt.answer.trim() || receipt.answer.length>MAX_ANSWER ||
      receipt.unconfirmed!=null && typeof receipt.unconfirmed!=='boolean')throw new Error('STORAGE');
    delete row.provisional;
    Object.assign(row,{status:receipt.unconfirmed?'interrupted':'completed',reason:receipt.unconfirmed?'UNCONFIRMED':null,
      answer:receipt.answer,viaTerminal:receipt.viaTerminal===true || receipt.viaTerminal==null && row.viaTerminal===true,
      sessionId:receipt.sessionId,updatedAt:receipt.updatedAt,answerFile:true});
    storedAnswers.add(member+'/'+row.id);
  }
  async function read(member,{metadataOnly=false,mailIds=null}={}) {
    const file = path.join(memberDir(member), 'tasks.json');
    let raw;
    try {
      if ((await io.stat(file)).size > MAX_BYTES) throw new Error('STORAGE');
      raw = await io.readFile(file, 'utf8');
    } catch (err) { if (err.code === 'ENOENT') return []; throw err; }
    const doc = JSON.parse(raw);
    if (doc?.version !== 1 || !Array.isArray(doc.tasks) || doc.tasks.length>MAX_TASKS || new Set(doc.tasks.map(t=>typeof t?.id==='string'?t.id.toLowerCase():null)).size !== doc.tasks.length) throw new Error('STORAGE');
    for(const row of doc.tasks){
      const skipReceipt=row?.mailSearch===true&&mailIds&&!mailIds.has(row.id);
      const saved=(metadataOnly||skipReceipt)&&row?{...row}:null;
      if((row?.mailSearch===true||row?.mailChoice===true||row?.mailDecision==='choose')&&typeof row.mailReason==='string'){row.reason=row.mailReason;delete row.mailReason;}
      if(row?.mailDecision==='review'&&row.status==='failed'&&row.reason==='MAIL_PLAN')row.reason='MAIL_REVIEW';
      if(!row || !validRow(row))throw new Error('STORAGE');
      // A pending mode choice only needs the ledger. A later write retains the
      // original rows and pointers without opening other tasks' encrypted results.
      if(metadataOnly||skipReceipt){row[originalRow]=saved;continue;}
      if(row.mailDecision==='pending'||row.mailDecision==='choose')continue;
      if(row.mailSearch){
        if(row.status==='completed'||['running','terminal'].includes(row.status)){
          try{
            const receipt=await mail?.vault.read(member,row.id);
            if(receipt && Array.isArray(receipt.groups) && Array.isArray(receipt.bindings)&&(!row.quoteAttempt||row.quoteAttempt===receipt.quoteAttempt)){
              row.mailReceipt=receipt;row.status='completed';row.reason=null;
            }else if(row.status==='completed')throw new Error('MAIL_STORAGE');
          }catch{row[originalRow]={...row};row.status='failed';row.reason='MAIL_STORAGE';}
        }
        row.answer='';continue;
      }
      if(row.answerFile===true || row.viaTerminal===true || row.reason==='MANUAL_RESULT' || ['running','terminal'].includes(row.status)){
        const metadata={...row};
        try{
          if(!await loadMemberAnswer(member,row)){
            if(row.provider!=='codex' || row.viaTerminal!==true)await loadAnswer(member,row);
            if(row.provider==='codex' && row.viaTerminal===true && row.status!=='terminal'){
              if(row.reason!=='MANUAL_RESULT')row[legacyNative]=metadata;
              Object.assign(row,{status:'interrupted',reason:'MANUAL_RESULT',answer:''});
            }
          }else if(metadata.viaTerminal && !['MEMBER_RESULT','MANUAL_RESULT'].includes(metadata.reason)){
            row[legacyNative]=metadata;
          }
          if(row.provisionalRef && ['running','terminal'].includes(row.status)){
            const preview=path.join(memberDir(member),'answers',previewName(row.id,row.provisionalRef));
            if((await io.stat(preview)).size>4*MAX_ANSWER)throw new Error('STORAGE');
            const body=await io.readFile(preview,'utf8');
            if(!body.trim() || body.length>MAX_ANSWER || digest(body)!==row.provisionalRef)throw new Error('STORAGE');
            row.provisional=body;
          }
        }
        catch{
          // Other tasks remain usable and later writes retain the original pointer.
          row[originalRow]=metadata;
          row.status='failed';row.reason='WRITE';row.answer='';
          storedAnswers.delete(member+'/'+row.id);
        }
      }
      row.id=row.id.toLowerCase(); if(row.previousId)row.previousId=row.previousId.toLowerCase();
    }
    return doc.tasks;
  }
  async function write(member, tasks, current=()=>true) {
    if(tasks.length>MAX_TASKS)throw new Error('STORAGE_FULL');
    const dir = memberDir(member);
    const index=[],expiredPreviews=[];
    for(let task of tasks){
      if(task[originalRow]){index.push(task[originalRow]);continue;}
      if(task.mailSearch||task.mailChoice||task.mailDecision==='pending'||task.mailDecision==='choose'){
        const {mailReceipt,mailReviewRecord,...metadata}=task;
        if(mailReviewRecord&&task.status==='failed'&&task.reason==='MAIL_REVIEW'){
          if(!mail)throw new Error('MAIL_STORAGE');
          const stored=await mail.vault.read(member,task.id);
          if(stored&&stored.kind!=='mail-review')throw new Error('MAIL_STORAGE');
          if(!stored||JSON.stringify(stored)!==JSON.stringify(mailReviewRecord))await mail.vault.write(member,task.id,mailReviewRecord,current);
          metadata.mailReviewStored=true;
        }
        const mailKey=member+'/'+task.id+'/mail'+(task.quoteAttempt?'/'+task.quoteAttempt:'');
        if(mailReceipt && task.status==='completed' && !storedAnswers.has(mailKey)){
          // A previously published encrypted receipt can be read after disconnecting.
          // Only newly generated receipts require the same live mailbox grant.
          if(!mail)throw new Error('MAIL_STORAGE');
          const stored=await mail.vault.read(member,task.id);
          if(!stored||stored.kind==='mail-review'||task.quoteAttempt&&stored.quoteAttempt!==task.quoteAttempt){
            await mail.vault.write(member,task.id,mailReceipt,()=>current()&&mail.valid(mailReceipt.readBindings||mailReceipt.bindings)&&
              (!mailReceipt.mailBindingVersion||mail.atGeneration(member,mailReceipt.mailBindingVersion)));
          }else if(!Array.isArray(stored.groups)||!Array.isArray(stored.bindings))throw new Error('MAIL_STORAGE');
          storedAnswers.add(mailKey);
        }
        if(mailReceipt&&task.status==='completed')delete metadata.mailReviewStored;
        // Previous office builds still open unrelated cards when encountering a newer mail error.
        const mailReason=metadata.reason==='MAIL_REVIEW'?'MAIL_PLAN':metadata.reason?.startsWith('MAIL_')?metadata.reason:null;
        index.push({...metadata,...(mailReason?{reason:'PROVIDER',mailReason}:{}),answer:''});continue;
      }
      if(task.provider==='codex' && task.reason==='MEMBER_RESULT'){
        const key=member+'/'+task.id+'/member';
        if(!storedAnswers.has(key)){
          if(!goodId(task.id) || typeof task.answer!=='string' || !task.answer.trim() || task.answer.length>MAX_ANSWER)throw new Error('STORAGE');
          const results=path.join(dir,'answers');
          await io.mkdir(results,{recursive:true,mode:0o700});
          const receipt={id:task.id,source:'member',updatedAt:task.updatedAt,answer:task.answer};
          await atomic(results,task.id+'.member.json',JSON.stringify(receipt),current);
          storedAnswers.add(key);
        }
        index.push(task[legacyNative]||{...task,answer:'',answerFile:true});
        continue;
      }
      if(task[legacyNative]){index.push(task[legacyNative]);continue;}
      if(task.provisional || task.provisionalRef){
        const previous=task.provisionalRef;
        const next=task.provisional?digest(task.provisional):null;
        const results=path.join(dir,'answers');
        if(next && next!==previous){
          if(!goodId(task.id)||task.provisional.length>MAX_ANSWER)throw new Error('STORAGE');
          await io.mkdir(results,{recursive:true,mode:0o700});
          await atomic(results,previewName(task.id,next),task.provisional,current);
        }
        // Publish the new pointer before removing the old text. An interrupted
        // write leaves the previous indexed version readable on restart.
        task={...task};
        delete task.provisional;
        if(next)task.provisionalRef=next;else delete task.provisionalRef;
        if(previous && previous!==next)expiredPreviews.push(path.join(results,previewName(task.id,previous)));
      }
      if(!task.answer){index.push(task);continue;}
      const k=member+'/'+task.id;
      if(!storedAnswers.has(k)){
        if(!goodId(task.id) || task.answer.length>MAX_ANSWER)throw new Error('STORAGE');
        const results=path.join(dir,'answers');
        await io.mkdir(results,{recursive:true,mode:0o700});
        const receipt={id:task.id,sessionId:task.sessionId,viaTerminal:task.viaTerminal===true,unconfirmed:task.reason==='UNCONFIRMED',updatedAt:task.updatedAt,answer:task.answer};
        await atomic(results,task.id+'.json',JSON.stringify(receipt),current);
        storedAnswers.add(k);
      }
      index.push({...task,answer:'',answerFile:true});
    }
    const contents = JSON.stringify({ version: 1, tasks:index });
    if (Buffer.byteLength(contents) > MAX_BYTES) throw new Error('STORAGE_FULL');
    await io.mkdir(dir, { recursive: true, mode: 0o700 });
    // A receipt committed under the correct login is the durable result.
    // If the index write fails afterward, read() recovers that same result.
    await atomic(dir,'tasks.json',contents,current);
    for(const file of expiredPreviews)await io.rm(file,{force:true}).catch(()=>{});
  }
  async function atomic(dir,name,contents,current){
    const temp = path.join(dir, 'tasks.' + randomUUID() + '.tmp');
    try {
      await io.writeFile(temp, contents, { encoding:'utf8', flag:'wx', mode:0o600 });
      await (io.commit || commitFile)(temp,path.join(dir,name),current);
    } finally { await io.rm(temp, { force:true }).catch(()=>{}); }
  }
  return {read, write};
}
module.exports = {createTaskStore, commitFile, submission, publicTask, editMetadata, goodId, REASONS, MAX_ANSWER, MAX_TASKS, problem};
