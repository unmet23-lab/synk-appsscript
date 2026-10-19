#!/usr/bin/env node
'use strict';
// Read-only preservation audit. A local upload receipt is not a fresh remote or restore verification.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const {createReadStream} = fs;
const ROOT = path.resolve(__dirname, '..');
const LEDGER = 'docs/마케팅/제작양식/만족사례_장부.md';
const REPORT = path.join(ROOT, '.tmp/preservation/latest.json');
const LABELS = {first_run_pending:'첫 정기 실행 전',unconfigured:'첫 실행 기준 확인 필요',running:'백업 실행 중',success:'최근 백업 완료',partial_failure:'백업 일부 실패',failed:'백업 실패',paused:'백업 의도적 중지',blocked:'백업 준비 확인 필요',missed:'백업 실행 누락',interrupted:'백업 실행 중단',unknown:'백업 상태 확인 필요'};
const SECRET = /(^|[\\/])(?:\.env(?:\.[^/]*)?|auth\.json|\.clasprc\.json|drive-storage\.json|[^/]*(?:credential|token)[^/]*\.json|[^/]*\.(?:pem|key|p12|pfx))$/i;
const SKIP = new Set(['node_modules','.git','.venv','venv','__pycache__','.cache','CacheClip','models','hf-cache']);
const norm = value => path.resolve(value).replace(/\\/g,'/').toLowerCase();
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
function json(file, maxBytes=100*1024*1024) {if(fs.statSync(file).size>maxBytes)throw new Error('REPORT_TOO_LARGE');return JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));}
function atomicJson(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});const temp=file+'.'+crypto.randomUUID()+'.tmp';try{fs.writeFileSync(temp,JSON.stringify(value,null,2)+'\n',{flag:'wx'});fs.renameSync(temp,file);}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}}
function unavailable(kind,code){return {kind,status:'unknown',label:kind==='backup'?'백업 상태 미확인':'보존 점검 미실행',checkedAt:null,lastSuccessAt:null,nextExpectedAt:null,counts:{},issues:[{code,label:'점검 결과를 아직 읽을 수 없습니다.'}],source:{available:false,stale:true}};}
function readBackupSummary({backupRoot,now=Date.now()}={}) {
  // Callers must explicitly choose the authorized backup folder; fixtures never read the user's files.
  if(!backupRoot)return unavailable('backup','BACKUP_ROOT_NOT_CONFIGURED');
  try{
    const data=json(path.join(backupRoot,'backup-monitor.json'),1024*1024),checked=Date.parse(data.checkedAt);
    if(data.schemaVersion!==1||!Object.hasOwn(LABELS,data.status)||!Number.isFinite(checked))throw new Error('INVALID');
    const stale=now-checked>2*60*60*1000||checked>now+60*1000;
    return {kind:'backup',status:stale?'unknown':data.status,label:stale?'백업 감시 갱신 지연':LABELS[data.status],checkedAt:data.checkedAt,
      lastSuccessAt:data.lastSuccessAt||null,nextExpectedAt:data.nextExpectedAt||null,
      counts:{steps:Number(data.counts?.steps)||0,success:Number(data.counts?.success)||0,failed:Number(data.counts?.failed)||0},
      issues:stale?[{code:'BACKUP_MONITOR_STALE',label:'상태 감시가 2시간 넘게 갱신되지 않았습니다.'}]:
        (data.issues||[]).slice(0,8).map(x=>({code:/^[A-Z_]+$/.test(x.code)?x.code:'BACKUP_CHECK_REQUIRED',label:LABELS[data.status]})),
      source:{available:true,stale},scope:'기존 백업 실행 결과. 실제 복원 성공은 별도 확인.'};
  }catch{return unavailable('backup','BACKUP_STATUS_UNREADABLE');}
}
function readPreservationSummary({reportPath=REPORT,now=Date.now()}={}) {
  try{
    const data=json(reportPath),checked=Date.parse(data.checkedAt);
    if(data.schemaVersion!==1||!data.counts||!Number.isFinite(checked))throw new Error('INVALID');
    const stale=now-checked>7*24*60*60*1000||checked>now+60*1000;
    const keys=['cases','references','files','missing','missingWithBackupRecord','missingWithoutBackupRecord','unreadable','manifestUnreadable','unresolved','external','temporary','hashChecked','hashDeferred','cloudDeferred','backupMatched','backupRecordOnly','backupUnrecorded','backupChanged','declaredMissing'];
    const counts=Object.fromEntries(keys.map(k=>[k,Number(data.counts[k])||0]));
    const issues=[];
    if(counts.missing||counts.declaredMissing)issues.push({code:'PRESERVATION_MISSING',label:`로컬 경로 미발견 ${counts.missing}곳 (보관 기록 있음 ${counts.missingWithBackupRecord}곳), 기존 미발견 기록 ${counts.declaredMissing}건`});
    if(counts.temporary)issues.push({code:'PRESERVATION_TEMPORARY',label:`임시 경로 ${counts.temporary}곳`});
    if(counts.backupChanged)issues.push({code:'PRESERVATION_CHANGED',label:`백업 기록과 현재 파일 불일치 ${counts.backupChanged}개`});
    if(counts.backupUnrecorded)issues.push({code:'PRESERVATION_BACKUP_UNRECORDED',label:`백업 근거 미발견 ${counts.backupUnrecorded}개`});
    if(counts.hashDeferred||counts.unresolved)issues.push({code:'PRESERVATION_PARTIAL',label:'경로 해석 또는 지문 계산이 남은 자료가 있습니다.'});
    if(counts.unreadable||counts.manifestUnreadable)issues.push({code:'PRESERVATION_READ_FAILED',label:`자료 경로 ${counts.unreadable}곳·보관 기록 ${counts.manifestUnreadable}개를 온전히 읽지 못했습니다.`});
    if(stale)issues.push({code:'PRESERVATION_REPORT_STALE',label:'보존 점검 결과가 7일 넘게 갱신되지 않았습니다.'});
    return {kind:'preservation',status:stale?'unknown':issues.length?'attention':'ready',label:issues.length?'만족 사례 보존 확인 필요':'만족 사례 로컬 대조 완료',checkedAt:data.checkedAt,lastSuccessAt:null,nextExpectedAt:null,counts,issues,source:{available:true,stale},scope:'로컬 파일과 보관 기록 대조. 현재 원격 존재·복호화·복원은 확인하지 않음.'};
  }catch{return unavailable('preservation','PRESERVATION_REPORT_UNREADABLE');}
}

function aliasesFrom(text,root){
  const aliases={};
  for(const line of text.split(/\r?\n/)){
    const m=/^\|\s*`\[([^\]]+)\]`\s*\|\s*(?:저장소\s*)?`([^`]+)`/.exec(line);
    if(m)aliases[m[1]]=m[2];
  }
  for(let pass=0;pass<8;pass++)for(const [key,value] of Object.entries(aliases)){
    const nested=/^\[([^\]]+)\](.*)$/.exec(value);
    if(nested&&aliases[nested[1]]&&!aliases[nested[1]].startsWith('['))aliases[key]=aliases[nested[1]]+nested[2];
  }
  for(const key of Object.keys(aliases))if(!path.isAbsolute(aliases[key])&&!/^[A-Za-z]:[\\/]/.test(aliases[key])&&!aliases[key].startsWith('['))aliases[key]=path.resolve(root,aliases[key]);
  return aliases;
}
function resolveReference(raw,{root,ledger,aliases,base,markdown=false}){
  raw=raw.replace(/\\/g,'/').trim();
  if(/^https?:\/\//i.test(raw))return {external:true};
  if(/[…*<>]|\.\.\./.test(raw)||/^(?:codex|app):/.test(raw))return {unresolved:true};
  const alias=/^\[([^\]]+)\](.*)$/.exec(raw);
  let candidate;
  if(alias){if(!aliases[alias[1]]||aliases[alias[1]].startsWith('['))return {unresolved:true};candidate=path.join(aliases[alias[1]],alias[2]);}
  else if(path.isAbsolute(raw)||/^[A-Za-z]:\//.test(raw))candidate=raw;
  else if(/^(?:docs|tools|experiences|\.tmp)\//.test(raw))candidate=path.resolve(root,raw);
  else if(markdown)candidate=path.resolve(path.dirname(ledger),decodeURIComponent(raw.split('#')[0]));
  else if(base){
    candidate=path.resolve(base,raw);
    // A folder followed by a bare sibling (v2_raw/ then v2_check/) is common
    // in this ledger. Use an existing sibling only, never invent a moved path.
    if(!fs.existsSync(candidate)&&/[\\/]/.test(raw)){
      const sibling=path.resolve(path.dirname(base),raw);
      if(fs.existsSync(sibling))candidate=sibling;
    }
  }
  else return {unresolved:true};
  if(SECRET.test(candidate))return {excluded:true};
  return {absolute:path.resolve(candidate),temporary:/(^|[\\/])(?:\.tmp|tmp|temp|scratchpad|worktrees)([\\/]|$)/i.test(candidate)};
}
function parseLedger(text,{root=ROOT,ledger=path.join(root,LEDGER)}={}){
  const aliases=aliasesFrom(text,root),cases=[];let current;
  const lines=text.split(/\r?\n/);
  for(let index=0;index<lines.length;index++){
    const line=lines[index],heading=/^###\s+(S\d+)\s*[·・-]\s*(.+)/.exec(line);
    if(heading){current={id:heading[1],title:heading[2],references:[],declaredMissing:[]};cases.push(current);continue;}
    if(/^##\s/.test(line)){current=null;continue;}
    if(!current)continue;
    if(/^- \*\*(?:결과물|지시문|출처|음악·나레이션|방법)/.test(line)||/^\s+- /.test(line)||/\]\(https?:/.test(line)){
      if(/찾지 못|파일은 없음|원문이 남아 있지/.test(line))current.declaredMissing.push({line:index+1,code:'LEDGER_DECLARES_MISSING'});
      let base,lastDirectory;
      const codes=[...line.matchAll(/`([^`]+)`/g)].map(m=>({raw:m[1],index:m.index,markdown:false}));
      const links=[...line.matchAll(/(?<!!)\[[^\]]+\]\(([^)]+)\)/g)].map(m=>({raw:m[1],index:m.index,markdown:true}));
      for(const token of [...codes,...links].sort((a,b)=>a.index-b.index)){
        if(!token.markdown&&!/[\\/]|\.[a-zA-Z0-9]{1,8}$/.test(token.raw))continue;
        if(!token.markdown&&(/^(?:node |codex |@|--|\?)/.test(token.raw)||/^\/u\/\d+\/$/.test(token.raw)))continue;
        const resolved=resolveReference(token.raw,{root,ledger,aliases,base,markdown:token.markdown});
        // A bare filename immediately described under a child directory belongs there;
        // subsequent directory references still use the explicitly named parent base.
        if(!token.markdown&&lastDirectory&&!/[\\/]|^\[/.test(token.raw)){
          const child=path.resolve(lastDirectory,token.raw);
          if(fs.existsSync(child)&&!SECRET.test(child))Object.assign(resolved,{absolute:child,unresolved:false});
        }
        if(/처음엔[^)]*$/.test(line.slice(0,token.index))){delete resolved.absolute;resolved.unresolved=true;resolved.reason='historical_path_not_specified';}
        if(resolved.absolute&&(/^(?:\[|[A-Za-z]:[\\/]|docs\/|tools\/|experiences\/|\.tmp\/)/.test(token.raw)||token.markdown)){
          const suffix=/[\\/]$/.test(token.raw);base=suffix?resolved.absolute:path.dirname(resolved.absolute);
        }
        if(resolved.absolute)lastDirectory=/[\\/]$/.test(token.raw)?resolved.absolute:path.dirname(resolved.absolute);
        const role=/결과물/.test(line)?'result':/지시문|방법|음악/.test(line)?'reproduction':'provenance';
        current.references.push({reference:token.raw,role,line:index+1,...resolved});
      }
    }
  }
  return {aliases,cases};
}

function defaultManifests(root=ROOT,backupRoot=path.resolve(root,'../SYNK_원본창고')){
  const docs=path.dirname(root),home=path.dirname(docs),list=[
    {file:path.join(docs,'PC_백업_20261003/복원목록.json'),base:root,kind:'restore'},
    {file:path.join(docs,'PC_백업_20261014_HappyGangster/upload-done.jsonl'),base:path.join(home,'Videos'),kind:'uploaded'},
  ];
  const roots={Videos:path.join(home,'Videos'),'SYNK-LoRA':'C:/SYNK-LoRA',Documents:docs,'SYNK-appsscript':root,'SYNK-talk':path.join(docs,'SYNK-talk')};
  for(const [group,base] of Object.entries(roots))list.push({file:path.join(backupRoot,'상태',group,'upload-done.jsonl'),base,kind:'uploaded'});
  return list;
}
function loadManifests(definitions){
  const byPath=new Map(),byHash=new Map(),sources=[];
  for(const def of definitions){
    let rows,invalidRows=0;
    try{
      if(def.file.endsWith('.jsonl')){
        rows=[];
        for(const line of fs.readFileSync(def.file,'utf8').replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean)){
          try{rows.push(JSON.parse(line));}catch{invalidRows++;}
        }
      }else rows=json(def.file);
      if(!Array.isArray(rows))rows=rows?.['파일'];if(!Array.isArray(rows))throw new Error('FORMAT');
    }
    catch(error){sources.push({name:path.basename(def.file),group:path.basename(path.dirname(def.file)),kind:def.kind,available:false,rows:0,reason:['ENOENT','ENOTDIR'].includes(error.code)?'not_found':'unreadable'});continue;}
    let accepted=0;
    for(const row of rows){
      if(!row||typeof row!=='object'){invalidRows++;continue;}
      const rel=row.path||row['경로'],bytes=row.bytes??row['크기'],sha=row.sha256;
      if(typeof rel!=='string'||SECRET.test(rel)||!Number.isSafeInteger(bytes)||bytes<0||!/^[a-f\d]{64}$/i.test(sha||''))continue;
      const uploaded=def.kind==='restore'?['drive','drive-zip','게임백업'].includes(row['위치']):row.ok===true&&typeof row.id==='string';
      if(!uploaded)continue;
      const absolute=path.resolve(def.base,rel),key=norm(absolute),record={sha256:sha.toLowerCase(),bytes,source:path.basename(def.file),kind:def.kind};
      const existing=byPath.get(key)||[];existing.push(record);byPath.set(key,existing);
      byHash.set(record.sha256+':'+bytes,record);accepted++;
    }
    sources.push({name:path.basename(def.file),group:path.basename(path.dirname(def.file)),kind:def.kind,available:true,rows:rows.length,accepted,invalidRows});
  }
  return {byPath,byHash,sources};
}
async function fingerprint(file){const digest=crypto.createHash('sha256');for await(const chunk of createReadStream(file))digest.update(chunk);return digest.digest('hex');}
function walkFiles(directory,{maxEntries=5000}={}){
  const files=[];let truncated=false,unreadable=0;
  function walk(dir){let entries;try{entries=fs.readdirSync(dir,{withFileTypes:true});}catch{unreadable++;return;}
    for(const entry of entries){
    if(SKIP.has(entry.name)||SECRET.test(entry.name)||entry.isSymbolicLink())continue;
    if(files.length>=maxEntries){truncated=true;return;}
    const full=path.join(dir,entry.name);if(entry.isDirectory())walk(full);else if(entry.isFile())files.push(full);
  }}
  walk(directory);return {files,truncated,unreadable};
}
async function audit({root=ROOT,ledger=path.join(root,LEDGER),manifestDefinitions=defaultManifests(root),maxHashBytes=4*1024**3,maxFileBytes=256*1024**2,now=new Date()}={}){
  const text=fs.readFileSync(ledger,'utf8'),parsed=parseLedger(text,{root,ledger}),backup=loadManifests(manifestDefinitions),seen=new Map();let usedBytes=0;
  const counts={cases:parsed.cases.length,references:0,files:0,missing:0,missingWithBackupRecord:0,missingWithoutBackupRecord:0,unreadable:0,manifestUnreadable:backup.sources.filter(x=>x.reason==='unreadable'||x.invalidRows>0).length,unresolved:0,external:0,temporary:0,hashChecked:0,hashDeferred:0,cloudDeferred:0,backupMatched:0,backupRecordOnly:0,backupUnrecorded:0,backupChanged:0,declaredMissing:0};
  async function checkFile(file){
    const key=norm(file);if(seen.has(key))return seen.get(key);
    let stat;try{stat=fs.lstatSync(file);}catch{return {status:'unreadable'};}
    if(!stat.isFile()||stat.isSymbolicLink()||SECRET.test(file))return {status:'excluded'};
    counts.files++;
    const out={path:file,bytes:stat.size,modifiedAt:stat.mtime.toISOString(),status:'present',fingerprint:'deferred',backup:'unrecorded'};
    const records=backup.byPath.get(key)||[];
    // A cloud placeholder read can hydrate/download the original. Without a local-only
    // file-attribute proof, report its metadata and defer hashing rather than trigger that.
    const cloudManaged=/(^|[\\/])OneDrive(?: - [^\\/]+)?([\\/]|$)/i.test(file);
    if(!cloudManaged&&stat.size<=maxFileBytes&&usedBytes+stat.size<=maxHashBytes){
      usedBytes+=stat.size;
      try{out.sha256=await fingerprint(file);const after=fs.statSync(file);if(after.size!==stat.size||after.mtimeMs!==stat.mtimeMs){out.fingerprint='changed_during_read';delete out.sha256;counts.hashDeferred++;}
      else{out.fingerprint='sha256';counts.hashChecked++;}}catch{out.fingerprint='unreadable';counts.hashDeferred++;}
    }else{counts.hashDeferred++;if(cloudManaged){out.fingerprint='cloud_locality_unconfirmed';counts.cloudDeferred++;}}
    if(out.sha256){
      if(records.some(x=>x.bytes===stat.size&&x.sha256===out.sha256)||backup.byHash.has(out.sha256+':'+stat.size)){out.backup='fingerprint_matches_local_record';counts.backupMatched++;}
      else if(records.length){out.backup='differs_from_local_record';counts.backupChanged++;}
      else counts.backupUnrecorded++;
    }else if(records.some(x=>x.bytes===stat.size)){out.backup='record_exists_hash_unchecked';counts.backupRecordOnly++;}
    else counts.backupUnrecorded++;
    seen.set(key,out);return out;
  }
  for(const item of parsed.cases){
    counts.declaredMissing+=item.declaredMissing.length;
    for(const ref of item.references){
      counts.references++;
      if(ref.excluded){ref.status='excluded';continue;}
      if(ref.external){ref.status='external_unchecked';counts.external++;continue;}
      if(ref.unresolved){ref.status='unresolved';counts.unresolved++;continue;}
      if(ref.temporary)counts.temporary++;
      let stat;try{stat=fs.lstatSync(ref.absolute);}catch(error){
        if(!['ENOENT','ENOTDIR'].includes(error.code)){ref.status='unreadable';counts.unreadable++;continue;}
        ref.status='missing';counts.missing++;ref.backupRecord=backup.byPath.has(norm(ref.absolute));counts[ref.backupRecord?'missingWithBackupRecord':'missingWithoutBackupRecord']++;continue;
      }
      if(stat.isSymbolicLink()){ref.status='symlink_not_followed';counts.unresolved++;continue;}
      if(stat.isFile()){ref.status='present';ref.file=await checkFile(ref.absolute);}
      else if(stat.isDirectory()){
        ref.status='directory';const found=walkFiles(ref.absolute);ref.truncated=found.truncated;ref.unreadableDirectories=found.unreadable;counts.unreadable+=found.unreadable;ref.files=[];
        for(const file of found.files)ref.files.push(await checkFile(file));
        if(found.truncated)counts.unresolved++;
      }else{ref.status='unsupported';counts.unresolved++;}
    }
  }
  return {schemaVersion:1,kind:'preservation',checkedAt:now.toISOString(),ledger:{path:ledger,sha256:hash(text)},counts,
    limits:{maxHashBytes,maxFileBytes,hashedBytes:usedBytes},manifestSources:backup.sources,cases:parsed.cases,
    scope:{localOnly:true,remoteChecked:false,restoreChecked:false,deleted:0,modifiedOriginals:0},
    notes:['지문 일치는 로컬 업로드·복원 기록과의 대조이며 현재 Drive 존재를 뜻하지 않습니다.','해석하지 못한 약칭·생략 경로는 누락으로 단정하지 않습니다.','원본을 읽기만 하며 업로드·삭제·복원·계정 연결을 수행하지 않습니다.']};
}
async function main(){
  const args=process.argv.slice(2),value=name=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
  if(args.includes('--summary')){console.log(JSON.stringify(readPreservationSummary({reportPath:value('--out')||REPORT}),null,2));return;}
  const root=path.resolve(value('--root')||ROOT),out=path.resolve(value('--out')||REPORT),ledger=path.join(root,LEDGER);
  let before;try{before=json(out);}catch{}
  if(args.includes('--refresh-if-needed')&&before?.ledger?.sha256===hash(fs.readFileSync(ledger,'utf8'))&&Date.now()-Date.parse(before.checkedAt)<24*3600000){
    console.log(JSON.stringify({status:'unchanged',checkedAt:before.checkedAt}));return;
  }
  fs.mkdirSync(path.dirname(out),{recursive:true});const lock=out+'.lock';let handle;
  try{handle=fs.openSync(lock,'wx');fs.writeFileSync(handle,JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}));}
  catch(error){
    if(error.code!=='EEXIST')throw error;
    let owner;try{owner=json(lock,1024);}catch{}
    if(owner&&Number.isSafeInteger(owner.pid)&&owner.pid>0){
      try{process.kill(owner.pid,0);console.log(JSON.stringify({status:'already_running'}));return;}
      catch(probe){if(probe.code!=='ESRCH'){console.log(JSON.stringify({status:'lock_owner_unconfirmed'}));process.exitCode=2;return;}}
      fs.unlinkSync(lock);handle=fs.openSync(lock,'wx');fs.writeFileSync(handle,JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}));
    }else{console.log(JSON.stringify({status:'lock_owner_unconfirmed'}));process.exitCode=2;return;}
  }
  try{
    const report=await audit({root,ledger,maxHashBytes:value('--max-hash-bytes')===undefined?undefined:Number(value('--max-hash-bytes'))});
    const gaps=report.cases.map(c=>({id:c.id,
      missing:c.references.filter(x=>['missing','unresolved','unreadable'].includes(x.status)||x.unreadableDirectories).map(x=>x.reference).sort(),
      temporary:c.references.filter(x=>x.temporary).map(x=>x.reference).sort(),
      backup:c.references.flatMap(x=>x.file?[x.file]:x.files||[])
        .filter(x=>['unrecorded','differs_from_local_record'].includes(x.backup))
        .map(x=>[x.path,x.backup]).sort((a,b)=>a[0].localeCompare(b[0])),declared:c.declaredMissing.length}));
    report.issueFingerprint=hash(JSON.stringify({gaps,manifestUnreadable:report.counts.manifestUnreadable}));
    atomicJson(out,report);
    if(before?.issueFingerprint!==report.issueFingerprint&&(report.counts.missing||report.counts.unreadable||report.counts.manifestUnreadable||report.counts.unresolved||report.counts.declaredMissing||report.counts.temporary||report.counts.backupUnrecorded||report.counts.backupChanged)){
      fs.appendFileSync(path.join(path.dirname(out),'events.jsonl'),JSON.stringify({at:report.checkedAt,kind:'preservation',id:report.issueFingerprint,counts:report.counts,caseIds:gaps.filter(c=>c.missing.length||c.temporary.length||c.backup.length||c.declared).map(c=>c.id)})+'\n');
    }
    console.log(JSON.stringify({out,counts:report.counts,scope:report.scope},null,2));
  }finally{if(handle!==undefined)fs.closeSync(handle);if(fs.existsSync(lock))fs.unlinkSync(lock);}
}
module.exports={parseLedger,resolveReference,aliasesFrom,loadManifests,defaultManifests,audit,readBackupSummary,readPreservationSummary,atomicJson};
if(require.main===module)main().catch(error=>{console.error('보존 점검 실패: '+(error.code||'AUDIT_FAILED'));process.exitCode=1;});
