#!/usr/bin/env node
'use strict';
// Deterministic three-way preparation and guarded application. No source Git
// add/commit/reset, model invocation, automatic rollback or destructive cleanup.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const {captureScopedSource,safeSource,rejectSecrets,LIMITS} = require('./workspace.cjs');
const POLICY='auto_verified_v1';
const CAP={files:2000,changes:100,bytes:128*1024*1024,changedBytes:16*1024*1024,single:4*1024*1024};
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const sorted=value=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,sorted(value[key])])):value;
const fingerprint=value=>hash(JSON.stringify(sorted(value)));
const same=(a,b)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
const within=(root,file)=>{const rel=path.relative(root,file);return rel!==''&&rel!=='..'&&!rel.startsWith('..'+path.sep)&&!path.isAbsolute(rel);};
const scoped=(name,scope)=>scope.some(root=>name===root||name.startsWith(root+'/'));
class Attention extends Error{constructor(code){super(code);this.code=code;}}
function json(file){if(fs.lstatSync(file).isSymbolicLink()||fs.statSync(file).size>8*1024*1024)throw new Attention('INVALID_INTEGRATION_RECEIPT');return JSON.parse(fs.readFileSync(file,'utf8'));}
function writeJSON(file,value){const tmp=file+'.'+crypto.randomBytes(6).toString('hex')+'.new';const fd=fs.openSync(tmp,'wx',0o600);try{fs.writeFileSync(fd,JSON.stringify(value,null,2)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}fs.renameSync(tmp,file);}
function env(){const value={...process.env,GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0',GIT_NO_LAZY_FETCH:'1',GIT_LFS_SKIP_SMUDGE:'1'};for(const key of ['GIT_INDEX_FILE','GIT_DIR','GIT_WORK_TREE','GIT_COMMON_DIR','GIT_CONFIG','GIT_CONFIG_PARAMETERS','GIT_CONFIG_COUNT'])delete value[key];return value;}
function git(repo,args,{input,allowOne=false}={}){try{return execFileSync('git',['--no-pager','--no-optional-locks','-c','core.fsmonitor=false','-c','diff.external=','-c','core.hooksPath='+path.join(os.tmpdir(),'synk-disabled-hooks'),...args],{cwd:repo,env:env(),input,windowsHide:true,shell:false,timeout:30000,maxBuffer:64*1024*1024,stdio:['pipe','pipe','pipe']});}catch(error){if(allowOne&&error.status===1)return null;throw new Attention('INTEGRATION_GIT_UNAVAILABLE');}}
const gitText=(repo,args)=>git(repo,args).toString('utf8').trim();
function noLinks(root,rel,{missing=false}={}){let file=root;for(const part of rel.split('/')){file=path.join(file,part);try{if(fs.lstatSync(file).isSymbolicLink())throw new Attention('INTEGRATION_SYMLINK');}catch(error){if(missing&&error.code==='ENOENT')return file;throw error;}}return file;}
function readFile(root,rel){if(!safeSource(rel))throw new Attention('UNSAFE_INTEGRATION_PATH');const file=noLinks(root,rel);const stat=fs.statSync(file);if(!stat.isFile()||stat.size>CAP.single)throw new Attention('INTEGRATION_FILE_LIMIT');const bytes=fs.readFileSync(file);rejectSecrets(bytes);return bytes;}
function walk(root,{skipCompletion=false}={}){const found=[];let entries=0;function visit(dir,relative){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){if(++entries>LIMITS.entries)throw new Attention('INTEGRATION_ENTRY_LIMIT');const rel=relative?relative+'/'+ent.name:ent.name;if(rel==='.git'||skipCompletion&&rel==='.synk-completion.json')continue;if(ent.isSymbolicLink())throw new Attention('INTEGRATION_SYMLINK');if(ent.isDirectory()){if(/^(?:node_modules|dist|build|out|coverage|\.cache|\.next|\.nuxt|\.venv|venv|__pycache__|\.tmp|\.codex|\.claude|artifacts|backups)$/i.test(ent.name))continue;visit(path.join(dir,ent.name),rel);}else{if(!safeSource(rel))throw new Attention('UNSAFE_AGENT_OUTPUT');found.push(rel);if(found.length>CAP.files)throw new Attention('INTEGRATION_FILE_LIMIT');}}}visit(root,'');return found.sort();}
function roots(){const documents=path.resolve(__dirname,'../..','..');return ['SYNK-appsscript','SYNK-talk','SYNK-website'].map(name=>path.join(documents,name)).filter(p=>fs.existsSync(p));}
function context(taskDir,allowedRoots){taskDir=fs.realpathSync(path.resolve(taskDir));const request=json(path.join(taskDir,'request.json')),receipt=json(path.join(taskDir,'workspace.json'));
  if(!/^synk-[a-f0-9]{12}$/.test(request.id)||path.basename(taskDir)!==request.id||request.integration_policy!==POLICY||request.notification_policy!=='attention_only_v1')throw new Attention('AUTO_INTEGRATION_NOT_AUTHORIZED');
  if(receipt.version!==1||receipt.state!=='ready'||receipt.taskId!==request.id||!receipt.ignoredScopeChecked||!receipt.sparse||!receipt.storageChecked||!Array.isArray(receipt.scope)||receipt.scope.length>500||receipt.scope.some(rel=>!safeSource(rel)&&!safeSource(rel+'/scope.md')))throw new Attention('WORKSPACE_RECEIPT_INVALID');
  const sourceRoot=fs.realpathSync(receipt.sourceRoot),workspaceRoot=fs.realpathSync(receipt.path);
  if(!(allowedRoots||roots()).some(root=>same(fs.realpathSync(root),sourceRoot))||!same(workspaceRoot,path.join(taskDir,'workspace'))||!same(path.resolve(request.workspace_root),workspaceRoot)||within(sourceRoot,taskDir)||within(sourceRoot,workspaceRoot))throw new Attention('WORKSPACE_RECEIPT_INVALID');
  if(!fs.lstatSync(path.join(workspaceRoot,'.git')).isFile()||!/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(receipt.snapshotCommit||''))throw new Attention('WORKSPACE_RECEIPT_INVALID');
  const common=gitText(sourceRoot,['rev-parse','--path-format=absolute','--git-common-dir']);
  if(!same(fs.realpathSync(common),fs.realpathSync(gitText(workspaceRoot,['rev-parse','--path-format=absolute','--git-common-dir']))))throw new Attention('WORKSPACE_RECEIPT_INVALID');
  if(git(workspaceRoot,['merge-base','--is-ancestor',receipt.snapshotCommit,'HEAD'],{allowOne:true})===null)throw new Attention('WORKSPACE_BASE_CHANGED');
  if(fs.readFileSync(path.join(taskDir,'native.exit'),'utf8').trim()!=='0')throw new Attention('NATIVE_EXECUTION_FAILED');
  const native=json(path.join(taskDir,'native-result.json'));
  if(native.snapshot?.status!=='exited'||native.snapshot?.exit_code!==0||native.final_found!==true||native.native_error||native.quota_limited||native.permission_denials)throw new Attention('NATIVE_EXECUTION_FAILED');
  return {taskDir,request,receipt,sourceRoot,workspaceRoot,common};
}
function normalized(bytes){return bytes.toString('utf8').replace(/\r\n/g,'\n');}
function mergeBytes(current,baseline,agent,folder,number){
  if(normalized(agent)===normalized(baseline))return current;
  if(normalized(current)===normalized(baseline))return encodeLike(normalized(agent),current);
  if(normalized(current)===normalized(agent))return current;
  const names=['current','baseline','agent'].map(name=>path.join(folder,number+'-'+name+'.txt'));
  for(let i=0;i<names.length;i++)fs.writeFileSync(names[i],normalized([current,baseline,agent][i]));
  let result;try{result=execFileSync('git',['merge-file','-p','--diff3',...names],{windowsHide:true,shell:false,timeout:10000,maxBuffer:CAP.single*3,stdio:['ignore','pipe','pipe']});}catch{throw new Attention('SOURCE_MERGE_CONFLICT');}
  return encodeLike(result.toString('utf8'),current);
}
function encodeLike(text,current){const raw=current.toString('utf8');if(/\r(?!\n)/.test(raw)||raw.includes('\r\n')&&/(?<!\r)\n/.test(raw))throw new Attention('MIXED_EOL_REVIEW_REQUIRED');return Buffer.from(raw.includes('\r\n')?text.replace(/\n/g,'\r\n'):text);}
function metadata(sourceRoot,common){const gitDir=gitText(sourceRoot,['rev-parse','--path-format=absolute','--git-dir']);const index=gitText(sourceRoot,['rev-parse','--path-format=absolute','--git-path','index']);let ref=null;try{ref=gitText(sourceRoot,['symbolic-ref','-q','HEAD']);}catch{/* detached source */}
  const files=[path.join(gitDir,'HEAD'),index,path.join(common,'packed-refs')];if(ref){if(!/^refs\/[A-Za-z0-9_./-]+$/.test(ref)||ref.includes('..'))throw new Attention('INVALID_SOURCE_REF');files.push(path.join(common,...ref.split('/')));}
  return {gitDir,commonDir:common,indexPath:index,files:files.map(file=>({path:file,sha256:fs.existsSync(file)?hash(fs.readFileSync(file)):null})),locks:[...new Set(files.map(file=>file+'.lock'))]};
}
function planDigest(plan){const {planFingerprint,...rest}=plan;return fingerprint(rest);}
function verifyPlan(ctx,plan){
  if(plan.version!==1||plan.policy!==POLICY||plan.planFingerprint!==planDigest(plan)||plan.taskId!==ctx.request.id
    ||!same(plan.sourceRoot,ctx.sourceRoot)||!same(plan.workspaceRoot,ctx.workspaceRoot)
    ||!same(plan.candidateRoot,path.join(ctx.taskDir,'integration-candidate'))||plan.baselineCommit!==ctx.receipt.snapshotCommit
    ||JSON.stringify(plan.scope)!==JSON.stringify(ctx.receipt.scope)||!['prepared','no_changes'].includes(plan.status))throw new Attention('INTEGRATION_PLAN_INVALID');
  const validHash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
  for(const rows of [plan.sourceFiles,plan.candidateFiles]){
    if(!Array.isArray(rows)||rows.length>CAP.files||new Set(rows.map(item=>item.path)).size!==rows.length
      ||rows.some(item=>!safeSource(item.path)||item.path==='.synk-completion.json'||!scoped(item.path,plan.scope)||!validHash(item.sha256)))throw new Attention('INTEGRATION_PLAN_INVALID');
  }
  if(!Array.isArray(plan.changes)||plan.changes.length>CAP.changes||new Set(plan.changes.map(item=>item.path)).size!==plan.changes.length||plan.changesFingerprint!==fingerprint(plan.changes))throw new Attention('INTEGRATION_PLAN_INVALID');
  const before=new Map(plan.sourceFiles.map(item=>[item.path,item.sha256])),after=new Map(plan.candidateFiles.map(item=>[item.path,item.sha256]));
  for(const item of plan.changes){if(!safeSource(item.path)||item.path==='.synk-completion.json'||!scoped(item.path,plan.scope)
      ||!['add','modify','delete'].includes(item.kind)||(item.beforeSha256??null)!==(before.get(item.path)??null)||(item.afterSha256??null)!==(after.get(item.path)??null)
      ||item.kind==='add'&&(item.beforeSha256!==null||!validHash(item.afterSha256))
      ||item.kind==='delete'&&(!validHash(item.beforeSha256)||item.afterSha256!==null)
      ||item.kind==='modify'&&(!validHash(item.beforeSha256)||!validHash(item.afterSha256)))throw new Attention('INTEGRATION_PLAN_INVALID');}
  const actual=metadata(ctx.sourceRoot,ctx.common);
  if(!same(actual.gitDir,plan.git?.gitDir||'')||!same(actual.commonDir,plan.git?.commonDir||'')||!same(actual.indexPath,plan.git?.indexPath||'')
    ||JSON.stringify(actual.locks)!==JSON.stringify(plan.git.locks)||JSON.stringify(actual.files.map(item=>item.path))!==JSON.stringify(plan.git.files.map(item=>item.path)))throw new Attention('INTEGRATION_PLAN_INVALID');
}
function verifyCandidate(plan){const rows=walk(plan.candidateRoot).map(rel=>({path:rel,sha256:hash(readFile(plan.candidateRoot,rel))}));if(JSON.stringify(rows)!==JSON.stringify(plan.candidateFiles))throw new Attention('CANDIDATE_CHANGED');return hash(JSON.stringify(rows.map(({path,sha256})=>[path,sha256])));}
async function prepareIntegration({taskDir,allowedRoots}={}){let ctx;try{ctx=context(taskDir,allowedRoots);taskDir=ctx.taskDir;const planPath=path.join(taskDir,'integration-plan.json');
    if(fs.existsSync(planPath)){const previous=json(planPath);verifyPlan(ctx,previous);verifyCandidate(previous);return {...previous,planPath};}
    const {sourceRoot,workspaceRoot,receipt}=ctx;
    const source=captureScopedSource({repo:sourceRoot,scope:receipt.scope});if(source.files.length>CAP.files)throw new Attention('INTEGRATION_FILE_LIMIT');
    const original=new Map(source.files.map(item=>[item.path,item.bytes]));
    const snapshotRoot=path.join(taskDir,'snapshot-files'),baselineNames=walk(snapshotRoot),agentNames=walk(workspaceRoot,{skipCompletion:true});
    const baseline=new Map();for(const rel of baselineNames){if(!scoped(rel,receipt.scope))throw new Attention('WORKSPACE_SCOPE_MISMATCH');const bytes=git(workspaceRoot,['show',receipt.snapshotCommit+':'+rel]);if(bytes.length>CAP.single)throw new Attention('INTEGRATION_FILE_LIMIT');rejectSecrets(bytes);baseline.set(rel,bytes);}
    const diff=git(workspaceRoot,['diff','--name-only','--no-renames','--no-ext-diff','-z',receipt.snapshotCommit,'--']).toString('utf8').split('\0').filter(Boolean);
    const raw=git(workspaceRoot,['diff','--raw','--no-renames','--no-ext-diff','-z',receipt.snapshotCommit,'--']).toString('utf8').split('\0');
    for(let i=0;i<raw.length;i+=2){if(!raw[i])continue;const mode=/^:([0-7]{6}) ([0-7]{6}) /.exec(raw[i]);if(!mode)throw new Attention('INTEGRATION_DIFF_INVALID');if(raw[i+1]==='.synk-completion.json')continue;if((mode[1]!=='000000'&&mode[2]!=='000000'&&mode[1]!==mode[2])||![mode[1],mode[2]].every(value=>['000000','100644','100755'].includes(value)))throw new Attention('FILE_MODE_REVIEW_REQUIRED');}
    for(const rel of [...agentNames,...diff]){if(rel==='.synk-completion.json')continue;if(!safeSource(rel)||!scoped(rel,receipt.scope))throw new Attention('WORKSPACE_SCOPE_VIOLATION');}
    const candidate=new Map(original),changes=[];let changedBytes=0;
    const mergeDir=path.join(taskDir,'integration-merge');fs.mkdirSync(mergeDir,{recursive:true});
    for(const rel of [...new Set([...baselineNames,...agentNames,...diff])].filter(rel=>rel!=='.synk-completion.json').sort()){
      const base=baseline.get(rel),agent=agentNames.includes(rel)?readFile(workspaceRoot,rel):null,now=original.get(rel);
      if(base&&agent&&normalized(base)===normalized(agent)||!base&&!agent)continue;
      let after;
      if(!base){if(now&&agent&&!now.equals(agent))throw new Attention('SOURCE_MERGE_CONFLICT');after=agent;}
      else if(!agent){if(now&&normalized(now)!==normalized(base))throw new Attention('SOURCE_MERGE_CONFLICT');after=null;}
      else{if(!now)throw new Attention('SOURCE_MERGE_CONFLICT');after=mergeBytes(now,base,agent,mergeDir,changes.length);}
      if(after)rejectSecrets(after);
      if(after&&now&&after.equals(now)||!after&&!now)continue;
      changedBytes+=(after?.length||0)+(now?.length||0);if(changes.length>=CAP.changes||changedBytes>CAP.changedBytes)throw new Attention('INTEGRATION_CHANGE_LIMIT');
      changes.push({path:rel,kind:!now?'add':!after?'delete':'modify',beforeSha256:now?hash(now):null,afterSha256:after?hash(after):null});
      if(after)candidate.set(rel,after);else candidate.delete(rel);
    }
    if(changes.length){const ignored=git(sourceRoot,['check-ignore','--stdin','-z'],{input:Buffer.from(changes.map(item=>item.path).join('\0')+'\0'),allowOne:true});if(ignored?.length)throw new Attention('IGNORED_SCOPE_SOURCE');}
    const again=captureScopedSource({repo:sourceRoot,scope:receipt.scope,keepBytes:false});if(again.fingerprint!==source.fingerprint)throw new Attention('SOURCE_CHANGED');
    const candidateRoot=path.join(taskDir,'integration-candidate');if(fs.existsSync(candidateRoot))throw new Attention('INTEGRATION_CANDIDATE_ALREADY_EXISTS');fs.mkdirSync(candidateRoot);
    let total=0;const candidateFiles=[];for(const [rel,bytes]of [...candidate].sort(([a],[b])=>a.localeCompare(b,'en'))){total+=bytes.length;if(total>CAP.bytes)throw new Attention('INTEGRATION_SIZE_LIMIT');const file=path.join(candidateRoot,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes,{flag:'wx'});candidateFiles.push({path:rel,sha256:hash(bytes)});}
    // Use binary code-point order everywhere, including the validator's rows.
    candidateFiles.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
    const plan={version:1,policy:POLICY,status:changes.length?'prepared':'no_changes',taskId:ctx.request.id,sourceRoot,workspaceRoot,candidateRoot,
      baselineCommit:receipt.snapshotCommit,scope:receipt.scope,sourceFingerprint:source.fingerprint,sourceHead:source.head,sourceFiles:source.files.map(({path,sha256})=>({path,sha256})),
      git:metadata(sourceRoot,ctx.common),changes,changesFingerprint:fingerprint(changes),candidateFiles,
      candidateFingerprint:hash(JSON.stringify(candidateFiles.map(({path,sha256})=>[path,sha256]))),createdAt:new Date().toISOString()};
    plan.planFingerprint=planDigest(plan);writeJSON(planPath,plan);return {...plan,planPath};
  }catch(error){return {status:'needs_attention',needs_attention:true,code:/^[A-Z_]{3,80}$/.test(error.code||'')?error.code:'INTEGRATION_PREPARATION_UNAVAILABLE'};}}
function finalReceipt(taskDir,value){const result={version:1,policy:POLICY,completed_at:new Date().toISOString(),...value};writeJSON(path.join(taskDir,'integration.json'),result);return result;}
async function applyIntegration({taskDir,allowedRoots,helperPath=path.join(__dirname,'integration-windows.ps1')}={}){let ctx;try{ctx=context(taskDir,allowedRoots);taskDir=ctx.taskDir;
    const resultPath=path.join(taskDir,'integration.json');if(fs.existsSync(resultPath)){const previous=json(resultPath);if(previous.version===1&&previous.policy===POLICY&&previous.verified===true&&previous.needs_attention===false&&['integrated','no_changes'].includes(previous.state))return previous;if(['needs_attention','unknown'].includes(previous.state))return previous;}
    const planPath=path.join(taskDir,'integration-plan.json'),validationPath=path.join(taskDir,'validation.json'),plan=json(planPath),validation=json(validationPath);
    verifyPlan(ctx,plan);
    if(validation.policy!==POLICY||validation.validation_contract!=='multi_language_v2'||validation.needs_attention!==false||!['passed','no_changes'].includes(validation.status)||validation.planFingerprint!==plan.planFingerprint||validation.changesFingerprint!==plan.changesFingerprint)throw new Attention('VALIDATION_REQUIRED');
    if(validation.completionFingerprint!==hash(fs.readFileSync(path.join(ctx.workspaceRoot,'.synk-completion.json'))))throw new Attention('COMPLETION_CHANGED');
    const candidateFingerprint=verifyCandidate(plan);if(validation.status==='passed'&&(validation.candidateFingerprint!==candidateFingerprint||JSON.stringify(validation.candidateFiles)!==JSON.stringify(plan.candidateFiles)))throw new Attention('VALIDATION_CANDIDATE_MISMATCH');
    if(!plan.changes.length){if(validation.status!=='no_changes')throw new Attention('VALIDATION_REQUIRED');return finalReceipt(taskDir,{state:'no_changes',reason_code:'NO_CHANGES',needs_attention:false,verified:true,planFingerprint:plan.planFingerprint});}
    const current=captureScopedSource({repo:ctx.sourceRoot,scope:ctx.receipt.scope,keepBytes:false});
    if(!fs.existsSync(path.join(taskDir,'integration-journal.jsonl'))){if(current.fingerprint!==plan.sourceFingerprint)throw new Attention('SOURCE_CHANGED');}
    else{
      const allowed=new Map(plan.sourceFiles.map(item=>[item.path,new Set([item.sha256])])),actual=new Map(current.files.map(item=>[item.path,item.sha256]));
      for(const item of plan.changes){if(!allowed.has(item.path))allowed.set(item.path,new Set([null]));allowed.get(item.path).add(item.afterSha256);}
      for(const rel of new Set([...allowed.keys(),...actual.keys()]))if(!allowed.get(rel)?.has(actual.get(rel)??null))throw new Attention('RECOVERY_SOURCE_CONFLICT');
    }
    if(process.platform!=='win32')throw new Attention('EXCLUSIVE_APPLY_PLATFORM_UNSUPPORTED');
    const globalGuard=path.join(path.dirname(taskDir),'synk-integration.guard');
    const args=['-NoProfile','-NonInteractive','-File',helperPath,'-TaskDir',taskDir,'-PlanHash',hash(fs.readFileSync(planPath)),'-ValidationHash',hash(fs.readFileSync(validationPath)),'-GlobalGuard',globalGuard];
    try{execFileSync('pwsh.exe',args,{windowsHide:true,shell:false,timeout:60000,maxBuffer:1024*1024,stdio:['ignore','pipe','pipe']});}catch{/* An interrupted helper must leave a journal or an attention receipt. */}
    if(fs.existsSync(resultPath)){const result=json(resultPath);if(result.planFingerprint===plan.planFingerprint)return result;}
    return finalReceipt(taskDir,{state:'unknown',reason_code:'APPLY_INTERRUPTED_REVIEW_REQUIRED',needs_attention:true,verified:false,planFingerprint:plan.planFingerprint});
  }catch(error){if(!ctx)return {version:1,policy:POLICY,state:'needs_attention',needs_attention:true,verified:false,reason_code:/^[A-Z_]{3,80}$/.test(error.code||'')?error.code:'INTEGRATION_APPLY_UNAVAILABLE'};return finalReceipt(taskDir,{state:'needs_attention',needs_attention:true,verified:false,reason_code:/^[A-Z_]{3,80}$/.test(error.code||'')?error.code:'INTEGRATION_APPLY_UNAVAILABLE'});}}
async function main(args){if(args.length!==3||!['prepare','apply'].includes(args[0])||args[1]!=='--task-dir')return {state:'needs_attention',needs_attention:true,verified:false,reason_code:'INVALID_INTEGRATION_ARGUMENT'};return args[0]==='prepare'?prepareIntegration({taskDir:args[2]}):applyIntegration({taskDir:args[2]});}
module.exports={prepareIntegration,applyIntegration,main,planDigest,fingerprint,verifyCandidate,walk,POLICY,CAP};
if(require.main===module)main(process.argv.slice(2)).then(result=>console.log(JSON.stringify(result))).catch(()=>{console.log(JSON.stringify({state:'needs_attention',needs_attention:true,verified:false,reason_code:'INTEGRATION_UNAVAILABLE'}));process.exitCode=2;});
