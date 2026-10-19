'use strict';
// Deterministic checks on the merge candidate. No model, shell command string or
// agent-provided executable is run here. Native completion is an input, not proof.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawnSync} = require('node:child_process');
const {fileURLToPath} = require('node:url');
const {writeJSON} = require('./monitor.cjs');
const {safeSource, rejectSecrets} = require('./workspace.cjs');
const POLICY = 'auto_verified_v1';
const VALIDATION_CONTRACT = 'multi_language_v2';
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const codeFile = rel => /\.(?:[cm]?js)$/.test(rel);
const dataFile = rel => /\.(?:[cm]?tsx?|jsx|json|jsonc)$/.test(rel);
const testFile = rel => /(?:^|\/)(?:tests?|__tests__)\/.+\.(?:[cm]?js)$/.test(rel) || /\.(?:test|spec)\.(?:[cm]?js)$/.test(rel);
const protectedFile = rel => /^(?:AGENTS\.md|CLAUDE\.md|docs\/AI_운영원칙\.md|tools\/hermes-synk\/|\.github\/|\.claude\/|\.codex\/)/.test(rel)
  || /(?:^|\/)(?:AGENTS|CLAUDE|SKILL)\.md$/i.test(rel)
  || /(?:^|\/)(?:package(?:-lock)?\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lock|\.gitattributes|\.gitignore)$/.test(rel);
class Attention extends Error { constructor(code) { super(code); this.code=code; } }
function regular(root, rel) {
  if (!safeSource(rel)) throw new Attention('UNSAFE_VALIDATION_PATH');
  let current = root;
  for (const part of rel.split('/')) {
    current = path.join(current, part);
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) throw new Attention('VALIDATION_SYMLINK');
  }
  const stat = fs.statSync(current);
  if (!stat.isFile() || stat.size > 4*1024*1024) throw new Attention('VALIDATION_FILE_LIMIT');
  return current;
}
function completion(taskDir, request) {
  const file=path.join(request.workspace_root,'.synk-completion.json');
  if (!fs.existsSync(file) || fs.lstatSync(file).isSymbolicLink() || fs.statSync(file).size > 65536) throw new Attention('COMPLETION_REPORT_MISSING');
  let report;
  try {report=JSON.parse(fs.readFileSync(file,'utf8'));} catch {throw new Attention('COMPLETION_REPORT_INVALID');}
  if(report.version!==1 || report.task_id!==request.id || !['completed','needs_decision','blocked'].includes(report.goal_status)
    || typeof report.summary!=='string' || !report.summary.trim() || report.summary.length>4000) throw new Attention('COMPLETION_REPORT_INVALID');
  if(report.goal_status!=='completed') throw new Attention(report.goal_status==='needs_decision'?'USER_DECISION_REQUIRED':'GOAL_NOT_COMPLETED');
  if(report.decision_reason || report.needs_attention===true) throw new Attention('USER_DECISION_REQUIRED');
  if(!Array.isArray(report.checks) || report.checks.length>12) throw new Attention('VALIDATION_PLAN_INVALID');
  return report;
}
function cleanEnvironment(folder) {
  const env={};
  for(const name of ['PATH','Path','SystemRoot','SYSTEMROOT','WINDIR','ComSpec','COMSPEC','PATHEXT','PROCESSOR_ARCHITECTURE','NUMBER_OF_PROCESSORS'])
    if(process.env[name])env[name]=process.env[name];
  const home=path.join(folder,'empty-home'),temp=path.join(folder,'temp');
  fs.mkdirSync(home,{recursive:true});fs.mkdirSync(temp,{recursive:true});
  return {...env,HOME:home,USERPROFILE:home,APPDATA:home,LOCALAPPDATA:home,TEMP:temp,TMP:temp,
    CI:'1',TZ:'UTC',NO_COLOR:'1',GIT_TERMINAL_PROMPT:'0',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:path.join(home,'no-git-config'),
    SYNK_VALIDATION:'1',HERMES_DISABLE_LAZY_INSTALLS:'1'};
}
function filesFingerprint(root, files) {
  const rows=files.map(item=>typeof item==='string'?item:item.path).sort().map(rel=>[rel,hash(fs.readFileSync(regular(root,rel)))]);
  return {hash:hash(JSON.stringify(rows)),rows};
}
function run(executable,args,cwd,env,runner=spawnSync) {
  const result=runner(executable,args,{cwd,env,encoding:'utf8',windowsHide:true,shell:false,timeout:120000,maxBuffer:8*1024*1024});
  if(result.error || result.signal)throw new Attention('VALIDATION_EXECUTION_FAILED');
  return result;
}
function tapSummary(output) {
  const value=name=>Number([...String(output).matchAll(new RegExp('^# '+name+' (\\d+)\\r?$','gm'))].at(-1)?.[1]??NaN);
  return {tests:value('tests'),pass:value('pass'),fail:value('fail'),cancelled:value('cancelled'),skipped:value('skipped'),todo:value('todo')};
}
function coverageEvidence(folder, candidateRoot) {
  const scripts=new Map();
  if(!fs.existsSync(folder))return scripts;
  const names=fs.readdirSync(folder).filter(x=>/^coverage-.*\.json$/.test(x));
  if(names.length>200)throw new Attention('COVERAGE_LIMIT');
  let total=0;
  for(const name of names){
    const file=path.join(folder,name);
    const stat=fs.lstatSync(file);total+=stat.size;
    if(stat.isSymbolicLink()||!stat.isFile()||stat.size>32*1024*1024||total>128*1024*1024)throw new Attention('COVERAGE_LIMIT');
    const coverage=JSON.parse(fs.readFileSync(file,'utf8'));
    for(const item of coverage.result||[]){
      if(!String(item.url).startsWith('file:'))continue;
      const abs=fileURLToPath(item.url),rel=path.relative(candidateRoot,abs).replaceAll('\\','/');
      if(!rel||rel.startsWith('../')||path.isAbsolute(rel))continue;
      const ranges=[];
      for(const fn of item.functions||[])for(const range of fn.ranges||[]){
        if(!Number.isSafeInteger(range.startOffset)||!Number.isSafeInteger(range.endOffset)||range.startOffset<0
          ||range.endOffset<=range.startOffset||!Number.isSafeInteger(range.count)||range.count<0)throw new Attention('COVERAGE_UNAVAILABLE');
        ranges.push({start:range.startOffset,end:range.endOffset,count:range.count});
      }
      if(!scripts.has(rel))scripts.set(rel,[]);
      scripts.get(rel).push(ranges);
    }
  }
  return scripts;
}
function effectiveSegments(ranges) {
  const starts=new Map(),points=new Set();
  for(const range of ranges){
    if(!starts.has(range.start))starts.set(range.start,[]);
    starts.get(range.start).push(range);points.add(range.start);points.add(range.end);
  }
  const sorted=[...points].sort((a,b)=>a-b),stack=[],segments=[];
  for(let i=0;i<sorted.length-1;i++){
    const at=sorted[i];
    while(stack.length&&stack.at(-1).end<=at)stack.pop();
    for(const range of (starts.get(at)||[]).sort((a,b)=>b.end-a.end||b.count-a.count)){
      // V8 function/block ranges are nested or disjoint. An inconsistent shape
      // cannot serve as execution proof. Equal bounds take the smaller count.
      if(stack.length&&range.end>stack.at(-1).end)throw new Attention('COVERAGE_UNAVAILABLE');
      stack.push(range);
    }
    if(stack.length)segments.push({start:at,end:sorted[i+1],count:stack.at(-1).count});
  }
  return segments;
}
function spansExecuted(scripts, spans) {
  if(!scripts?.length||!spans?.length)return false;
  const deltas=new Map(),add=(at,count)=>deltas.set(at,(deltas.get(at)||0)+count);
  for(const ranges of scripts)for(const segment of effectiveSegments(ranges)){
    add(segment.start,segment.count);add(segment.end,-segment.count);
  }
  const wanted=[...spans].sort((a,b)=>a.start-b.start);
  for(const span of wanted){add(span.start,0);add(span.end,0);}
  const points=[...deltas.keys()].sort((a,b)=>a-b);let count=0,at=0;
  for(let i=0;i<points.length-1;i++){
    const start=points[i],end=points[i+1];count+=deltas.get(start);
    while(at<wanted.length&&wanted[at].end<=start)at++;
    if(at<wanted.length&&wanted[at].start<end&&wanted[at].end>start&&count<=0)return false;
  }
  return true;
}
function coveredFiles(folder, candidateRoot, required=new Map()) {
  const found=new Set(),scripts=coverageEvidence(folder,candidateRoot);
  for(const [rel,entries]of scripts){
    if(required.has(rel)?spansExecuted(entries,required.get(rel)):entries.some(ranges=>ranges.some(range=>range.count>0)))found.add(rel);
  }
  return found;
}
function changedLineSpans({prepared,change,text,evidence,env,runner}) {
  const starts=[0];for(let at=text.indexOf('\n');at>=0;at=text.indexOf('\n',at+1))starts.push(at+1);
  const toSpans=lines=>lines.map(({start,count})=>{
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(count)||start<1||count<1||start+count-1>starts.length)
      throw new Attention('CHANGED_CODE_NOT_EXERCISED');
    const begin=starts[start-1],end=starts[start+count-1]??text.length;
    if(end<=begin)throw new Attention('CHANGED_CODE_NOT_EXERCISED');
    return {start:begin,end};
  });
  if(change.kind==='add'&&change.beforeSha256===null){
    if(!text.length)throw new Attention('CHANGED_CODE_NOT_EXERCISED');
    return [{start:0,end:text.length}];
  }
  if(typeof prepared.sourceRoot!=='string'||!/^[a-f0-9]{64}$/.test(change.beforeSha256||''))throw new Attention('SOURCE_EVIDENCE_UNAVAILABLE');
  let original,before;
  try{original=regular(prepared.sourceRoot,change.path);before=fs.readFileSync(original);}catch{throw new Attention('SOURCE_CHANGED');}
  if(hash(before)!==change.beforeSha256)throw new Attention('SOURCE_CHANGED');
  const diff=path.join(evidence,'diff-'+crypto.randomBytes(6).toString('hex'));fs.mkdirSync(diff);
  const beforeFile=path.join(diff,'before.txt'),afterFile=path.join(diff,'after.txt');
  fs.writeFileSync(beforeFile,before,{flag:'wx',mode:0o600});fs.writeFileSync(afterFile,text,{flag:'wx',mode:0o600});
  const output=run('git',['--no-pager','diff','--no-index','--no-ext-diff','--no-textconv','--text','--unified=0','--',beforeFile,afterFile],evidence,env,runner);
  if(![0,1].includes(output.status))throw new Attention('DIFF_EVIDENCE_UNAVAILABLE');
  try{if(hash(fs.readFileSync(regular(prepared.sourceRoot,change.path)))!==change.beforeSha256)throw new Error();}
  catch{throw new Attention('SOURCE_CHANGED');}
  const lines=[...String(output.stdout).matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)]
    .map(match=>({start:Number(match[1]),count:match[2]===undefined?1:Number(match[2])}));
  if(!lines.length||lines.some(line=>!line.count))throw new Attention('CHANGED_CODE_NOT_EXERCISED');
  return toSpans(lines);
}
function changedPaths(prepared) {
  if(!Array.isArray(prepared.changes))throw new Attention('INTEGRATION_PLAN_INVALID');
  return prepared.changes.map(item=>typeof item==='string'?{path:item,kind:'modify'}:item);
}
async function validatePrepared({taskDir,request,prepared,report,runner,evidenceRoot}) {
  const checks=[];
  if(!['prepared','no_changes'].includes(prepared.status))throw new Attention(prepared.reason_code||prepared.code||'INTEGRATION_PREPARATION_REQUIRED');
  const changes=changedPaths(prepared);
  if(!changes.length || prepared.status==='no_changes')return {status:'no_changes',checks:[{kind:'no_changes',passed:true}]};
  const candidateRoot=prepared.candidateRoot;
  if(!candidateRoot || !Array.isArray(prepared.candidateFiles) || !prepared.planFingerprint)throw new Attention('INTEGRATION_PLAN_INVALID');
  const evidence=evidenceRoot||path.join(taskDir,'validation-evidence');fs.mkdirSync(evidence,{recursive:true});
  const env=cleanEnvironment(evidence),before=filesFingerprint(candidateRoot,prepared.candidateFiles);
  const requested=report.checks||[],tests=[],adapterTests=new Set();
  const kinds=new Set(['node_test','typescript','json_schema','python_unittest','python_pytest','browser']);
  for(const check of requested){
    if(!check||!kinds.has(check.kind))throw new Attention('VALIDATION_ADAPTER_REQUIRED');
    if(check.kind!=='node_test'){
      if(['typescript','json_schema'].includes(check.kind)&&Array.isArray(check.tests))for(const rel of check.tests){
        if(typeof rel!=='string'||!testFile(rel))throw new Attention('VALIDATION_TEST_PATH_INVALID');
        regular(candidateRoot,rel);adapterTests.add(rel);
      }
      continue;
    }
    if(typeof check.path!=='string'||!testFile(check.path))throw new Attention('VALIDATION_TEST_PATH_INVALID');
    regular(candidateRoot,check.path);
    if(!tests.includes(check.path))tests.push(check.path);
  }
  const hasDataChanges=changes.some(change=>dataFile(change.path));
  const compilerConfigs=new Set(requested.filter(check=>check.kind==='typescript').map(check=>check.path));
  let needsTests=false;
  const changedCode=[],requiredCoverage=new Map();
  for(const change of changes){
    if(!change || !safeSource(change.path))throw new Attention('UNSAFE_VALIDATION_PATH');
    if(protectedFile(change.path))throw new Attention('OPERATING_POLICY_REVIEW_REQUIRED');
    const deleted=['delete','deleted','D'].includes(change.kind)||change.deleted===true;
    if(deleted)throw new Attention('DELETION_REVIEW_REQUIRED');
    const file=regular(candidateRoot,change.path),bytes=fs.readFileSync(file);
    rejectSecrets(bytes);
    const text=new TextDecoder('utf8',{fatal:true}).decode(bytes);
    if(/^(?:<<<<<<< |=======\s*$|>>>>>>> )/m.test(text))throw new Attention('CONFLICT_MARKERS');
    if(codeFile(change.path)){
      const result=run(process.execPath,['--check',file],candidateRoot,env,runner);
      if(result.status!==0)throw new Attention('SYNTAX_CHECK_FAILED');
      checks.push({kind:'node_syntax',path:change.path,passed:true});
      const exercisedByAdapter=hasDataChanges&&adapterTests.has(change.path);
      if(!exercisedByAdapter)needsTests=true;
      if(!tests.includes(change.path)&&!exercisedByAdapter){
        changedCode.push(change.path);
        requiredCoverage.set(change.path,changedLineSpans({prepared,change,text,evidence,env,runner}));
      }
    }else if(/\.json$/.test(change.path)){
      if(!compilerConfigs.has(change.path)){
        try{JSON.parse(text);}catch{throw new Attention('JSON_CHECK_FAILED');}
        checks.push({kind:'json_parse',path:change.path,passed:true});
      }
    }else if(/\.(?:jsonc|[cm]?tsx?|jsx|py|html?|css)$/.test(change.path)){
      // Dedicated adapters below require semantic and execution evidence.
    }else if(/\.(?:md|txt)$/.test(change.path)){
      checks.push({kind:'text_integrity',path:change.path,passed:true});
    }else{
      throw new Attention('VALIDATION_ADAPTER_REQUIRED');
    }
  }
  if(needsTests && !tests.length)throw new Attention('RELATED_TESTS_REQUIRED');
  if(tests.length){
    const coverageDir=path.join(evidence,'coverage-'+crypto.randomBytes(6).toString('hex'));fs.mkdirSync(coverageDir);
    const result=run(process.execPath,['--test','--test-reporter=tap',...tests],candidateRoot,{...env,NODE_V8_COVERAGE:coverageDir},runner);
    const summary=tapSummary(result.stdout);
    if(result.status!==0 || !(summary.tests>0) || summary.fail!==0 || summary.cancelled!==0 || summary.skipped!==0 || summary.todo!==0 || summary.pass!==summary.tests)
      throw new Attention('RELATED_TESTS_FAILED_OR_INCOMPLETE');
    const covered=coveredFiles(coverageDir,candidateRoot,requiredCoverage);
    if(changedCode.some(rel=>!covered.has(rel)))throw new Attention('CHANGED_CODE_NOT_EXERCISED');
    checks.push({kind:'node_test',paths:tests,passed:true,...summary,changedCodeExercised:changedCode});
  }
  if(hasDataChanges){
    const result=await require('./validation-data.cjs').validateData({taskDir,request,prepared,report,evidence,env,
      helpers:{regular,run,changedLineSpans,spansExecuted,coveredFiles,coverageEvidence,tapSummary,filesFingerprint}});
    const validated=new Set(result.validatedPaths||[]);
    if(changes.some(change=>dataFile(change.path)&&!validated.has(change.path)))throw new Attention('DATA_VALIDATION_INCOMPLETE');
    checks.push(...result.checks);
  }
  if(changes.some(change=>change.path.endsWith('.py')))
    checks.push(...await require('./validation-python.cjs').validatePython({taskDir,request,prepared,report,evidence,env,runner}));
  if(changes.some(change=>/\.(?:html?|css)$/.test(change.path))){
    const result=await require('./validation-web.cjs').validateWeb({candidateRoot,sourceRoot:prepared.sourceRoot,changes,
      checks:requested.filter(check=>check.kind==='browser'),evidenceDir:path.join(evidence,'browser-'+crypto.randomBytes(6).toString('hex'))});
    const exercised=new Set(result.exercisedFiles||[]);
    if(changes.some(change=>/\.(?:html?|css)$/.test(change.path)&&!exercised.has(change.path)))throw new Attention('WEB_CHANGED_FILE_NOT_EXERCISED');
    checks.push(...result.checks);
  }
  const after=filesFingerprint(candidateRoot,prepared.candidateFiles);
  if(before.hash!==after.hash)throw new Attention('CANDIDATE_CHANGED_DURING_VALIDATION');
  return {status:'passed',checks,candidateFingerprint:after.hash,candidateFiles:after.rows.map(([path,sha256])=>({path,sha256}))};
}
async function validateTask({taskDir,prepare,runner}) {
  taskDir=path.resolve(taskDir);
  let prepared,result;
  const finish=value=>{
    const output={version:1,policy:POLICY,validation_contract:VALIDATION_CONTRACT,checkedAt:new Date().toISOString(),...value};
    writeJSON(path.join(taskDir,'validation.json'),output);
    return output;
  };
  try{
    const request=JSON.parse(fs.readFileSync(path.join(taskDir,'request.json'),'utf8'));
    if(request.integration_policy!==POLICY || !/^synk-[a-f0-9]{12}$/.test(request.id) || path.basename(taskDir)!==request.id)throw new Attention('AUTO_INTEGRATION_NOT_AUTHORIZED');
    if(fs.readFileSync(path.join(taskDir,'native.exit'),'utf8').trim()!=='0')throw new Attention('NATIVE_EXECUTION_FAILED');
    const report=completion(taskDir,request);
    const previous=fs.existsSync(path.join(taskDir,'validation.json'))?JSON.parse(fs.readFileSync(path.join(taskDir,'validation.json'),'utf8')):null;
    // Needs-attention results are not an automatic retry loop.
    if(previous?.status==='needs_attention')return previous;
    if(previous && ['passed','no_changes'].includes(previous.status)){
      const planPath=path.join(taskDir,'integration-plan.json');
      const plan=JSON.parse(fs.readFileSync(planPath,'utf8'));
      if(previous.policy!==POLICY || previous.validation_contract!==VALIDATION_CONTRACT || previous.needs_attention!==false || previous.planPath!==planPath
        || previous.planFingerprint!==plan.planFingerprint || previous.candidateRoot!==plan.candidateRoot
        || previous.completionFingerprint!==hash(fs.readFileSync(path.join(request.workspace_root,'.synk-completion.json')))
        || filesFingerprint(plan.candidateRoot,plan.candidateFiles).hash!==previous.candidateFingerprint)
        throw new Attention('VALIDATION_EVIDENCE_CHANGED');
      // Reuse the exact validated candidate after a crash; never prepare against
      // files that may already have been integrated by the previous invocation.
      return previous;
    }
    prepare ||= require('./integration.cjs').prepareIntegration;
    prepared=await prepare({taskDir});
    result=await validatePrepared({taskDir,request,prepared,report,runner});
    const captured=result.candidateFingerprint?{}:filesFingerprint(prepared.candidateRoot,prepared.candidateFiles);
    return finish({...result,needs_attention:false,planFingerprint:prepared.planFingerprint,changesFingerprint:prepared.changesFingerprint,
      planPath:prepared.planPath||path.join(taskDir,'integration-plan.json'),candidateRoot:prepared.candidateRoot,
      candidateFingerprint:result.candidateFingerprint||captured.hash,
      candidateFiles:result.candidateFiles||captured.rows.map(([path,sha256])=>({path,sha256})),
      completionFingerprint:hash(fs.readFileSync(path.join(request.workspace_root,'.synk-completion.json')))});
  }catch(error){
    const reason_code=error instanceof Attention?error.code: /^[A-Z_]{3,80}$/.test(error.code||'')?error.code:'VALIDATION_UNAVAILABLE';
    return finish({status:'needs_attention',needs_attention:true,reason_code,checks:result?.checks||[],planFingerprint:prepared?.planFingerprint});
  }
}
module.exports={validateTask,validatePrepared,completion,tapSummary,cleanEnvironment,filesFingerprint,protectedFile,coveredFiles,coverageEvidence,spansExecuted,changedLineSpans,regular,run,VALIDATION_CONTRACT};
if(require.main===module){
  const args=process.argv.slice(2);
  if(args.length!==2||args[0]!=='--task-dir'){console.log(JSON.stringify({status:'needs_attention',needs_attention:true,reason_code:'INVALID_VALIDATION_ARGUMENT'}));process.exitCode=2;}
  else validateTask({taskDir:args[1]}).then(result=>console.log(JSON.stringify(result))).catch(()=>{console.log(JSON.stringify({status:'needs_attention',needs_attention:true,reason_code:'VALIDATION_UNAVAILABLE'}));process.exitCode=2;});
}
