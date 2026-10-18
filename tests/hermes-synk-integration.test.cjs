'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const {execFileSync,spawn}=require('node:child_process');
const {prepareWorkspace}=require('../tools/hermes-synk/workspace.cjs');
const {prepareIntegration,applyIntegration}=require('../tools/hermes-synk/integration.cjs');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function fixture(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'synk-integration-test-')),repo=path.join(root,'source');fs.mkdirSync(repo);fs.mkdirSync(path.join(root,'tasks'));
  const git=(...args)=>execFileSync('git',args,{cwd:repo,windowsHide:true,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
  const write=(rel,bytes)=>{const file=path.join(repo,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);};
  git('init','-q','-b','main');git('config','user.name','Fixture');git('config','user.email','fixture@localhost');git('config','core.autocrlf','false');git('config','extensions.worktreeConfig','true');
  write('AGENTS.md','Read source.\n');write('CLAUDE.md','@AGENTS.md\n');write('.gitignore','node_modules/\n.env\n');
  write('package.json',JSON.stringify({scripts:{'check:storage':'node tools/git-storage-check.cjs --cached'}}));
  for(const name of ['git-storage-check.cjs','git-storage-policy.json'])write('tools/'+name,fs.readFileSync(path.join(__dirname,'../tools',name)));
  write('docs/task.md','first\nsecond\nthird\nfourth\nfifth\n');write('docs/delete.md','delete me\n');write('other/unrelated.md','outside scope\n');git('add','.');git('commit','-qm','baseline');
  const taskId='synk-'+crypto.randomBytes(6).toString('hex'),taskDir=path.join(root,'tasks',taskId);
  t.after(()=>{const checked=fs.realpathSync(root);assert.ok(checked.startsWith(fs.realpathSync(os.tmpdir())+path.sep)&&path.basename(checked).startsWith('synk-integration-test-'));fs.rmSync(checked,{recursive:true,force:true});});
  return {root,repo,taskId,taskDir,write,git,options:{taskDir,allowedRoots:[repo]},async workspace(){
    const receipt=await prepareWorkspace({repo,taskDir,taskId,scope:['docs/task.md','docs/delete.md','docs/new.md','docs/nested'],allowedRoots:[repo]});assert.equal(receipt.ok,true,JSON.stringify(receipt));
    fs.writeFileSync(path.join(taskDir,'request.json'),JSON.stringify({id:taskId,state:'finalizing',finalization_state:'integrating',integration_policy:'auto_verified_v1',notification_policy:'attention_only_v1',workspace_root:receipt.path}));
    fs.writeFileSync(path.join(taskDir,'native.exit'),'0\n');fs.writeFileSync(path.join(taskDir,'native-result.json'),JSON.stringify({version:1,snapshot:{status:'exited',exit_code:0},final_found:true,native_error:false,quota_limited:false,permission_denials:0}));
    fs.writeFileSync(path.join(receipt.path,'.synk-completion.json'),JSON.stringify({version:1,task_id:taskId,goal_status:'completed',summary:'Fixture complete',checks:[]}));
    return receipt.path;
  }};
}
function validate(f,plan){fs.writeFileSync(path.join(f.taskDir,'validation.json'),JSON.stringify({version:1,policy:'auto_verified_v1',validation_contract:'multi_language_v2',status:plan.status==='no_changes'?'no_changes':'passed',needs_attention:false,planFingerprint:plan.planFingerprint,changesFingerprint:plan.changesFingerprint,candidateFingerprint:plan.candidateFingerprint,candidateFiles:plan.candidateFiles,completionFingerprint:hash(fs.readFileSync(path.join(f.taskDir,'workspace/.synk-completion.json')))}));}
function index(f){return hash(fs.readFileSync(path.join(f.repo,'.git/index')));}
test('prepares current source plus nonoverlapping agent changes without touching original',async t=>{
  const f=fixture(t),work=await f.workspace();
  fs.writeFileSync(path.join(work,'docs/task.md'),'first agent\nsecond\nthird\nfourth\nfifth\n');f.write('docs/task.md','first\nsecond\nthird\nfourth\nfifth user\n');
  const before=index(f),head=f.git('rev-parse','HEAD'),plan=await prepareIntegration(f.options);
  assert.equal(plan.status,'prepared',JSON.stringify(plan));assert.equal(plan.changes.length,1);
  assert.equal(fs.readFileSync(path.join(plan.candidateRoot,'docs/task.md'),'utf8'),'first agent\nsecond\nthird\nfourth\nfifth user\n');
  assert.equal(fs.existsSync(path.join(plan.candidateRoot,'.synk-completion.json')),false);
  assert.equal(fs.readFileSync(path.join(f.repo,'docs/task.md'),'utf8'),'first\nsecond\nthird\nfourth\nfifth user\n');assert.equal(index(f),before);assert.equal(f.git('rev-parse','HEAD'),head);
});
test('holds actual overlapping conflict and preserves other app edit',async t=>{
  const f=fixture(t),work=await f.workspace();fs.writeFileSync(path.join(work,'docs/task.md'),'agent\n');f.write('docs/task.md','user\n');
  const result=await prepareIntegration(f.options);assert.equal(result.code,'SOURCE_MERGE_CONFLICT');assert.equal(fs.readFileSync(path.join(f.repo,'docs/task.md'),'utf8'),'user\n');
});
test('dirty source at task admission is the baseline and completion metadata is excluded',async t=>{
  const f=fixture(t);f.write('docs/task.md','dirty baseline\n');const work=await f.workspace();fs.writeFileSync(path.join(work,'docs/task.md'),'agent based on dirty\n');
  const plan=await prepareIntegration(f.options);assert.equal(plan.status,'prepared',JSON.stringify(plan));assert.deepEqual(plan.changes.map(x=>x.path),['docs/task.md']);
});
test('holds outside scope materialization and credential output',async t=>{
  const f=fixture(t),work=await f.workspace();fs.mkdirSync(path.join(work,'other'));fs.writeFileSync(path.join(work,'other/new.md'),'unauthorized\n');
  assert.equal((await prepareIntegration(f.options)).code,'WORKSPACE_SCOPE_VIOLATION');fs.unlinkSync(path.join(work,'other/new.md'));
  fs.writeFileSync(path.join(work,'docs/task.md'),'-----BEGIN PRIVATE KEY-----\nfixture\n');assert.equal((await prepareIntegration(f.options)).code,'SECRET_OR_EMBEDDED_MEDIA');
});
test('Windows exclusive apply preserves branch, staged index, current dirty bytes and durable backup; retry does not reapply', {skip:process.platform!=='win32'},async t=>{
  const f=fixture(t),work=await f.workspace();fs.writeFileSync(path.join(work,'docs/task.md'),'first agent\nsecond\nthird\nfourth\nfifth\n');
  f.write('docs/task.md','first\nsecond\nthird\nfourth\nfifth user\n');f.write('other/unrelated.md','other staged\n');f.git('add','other/unrelated.md');const before=index(f),head=f.git('rev-parse','HEAD');
  const plan=await prepareIntegration(f.options);assert.equal(plan.status,'prepared',JSON.stringify(plan));validate(f,plan);const result=await applyIntegration(f.options);
  assert.equal(result.state,'integrated',JSON.stringify(result));assert.equal(result.verified,true);assert.equal(result.needs_attention,false);
  assert.equal(fs.readFileSync(path.join(f.repo,'docs/task.md'),'utf8'),'first agent\nsecond\nthird\nfourth\nfifth user\n');
  assert.equal(fs.readFileSync(path.join(f.taskDir,'integration-backups/docs/task.md'),'utf8'),'first\nsecond\nthird\nfourth\nfifth user\n');
  assert.equal(index(f),before);assert.equal(f.git('rev-parse','HEAD'),head);assert.equal(fs.existsSync(path.join(f.repo,'.git/index.lock')),false);
  f.write('docs/task.md','subsequent user work\n');assert.deepEqual(await applyIntegration(f.options),result);assert.equal(fs.readFileSync(path.join(f.repo,'docs/task.md'),'utf8'),'subsequent user work\n');
});
test('changed source after validation holds all writes including additions', {skip:process.platform!=='win32'},async t=>{
  const f=fixture(t),work=await f.workspace();fs.writeFileSync(path.join(work,'docs/task.md'),'agent\n');fs.writeFileSync(path.join(work,'docs/new.md'),'new\n');const plan=await prepareIntegration(f.options);validate(f,plan);f.write('docs/task.md','late user\n');
  const result=await applyIntegration(f.options);assert.equal(result.state,'needs_attention',JSON.stringify(result));assert.equal(result.verified,false);assert.equal(fs.existsSync(path.join(f.repo,'docs/new.md')),false);assert.equal(fs.readFileSync(path.join(f.repo,'docs/task.md'),'utf8'),'late user\n');
});
test('candidate tampering or old request policy cannot apply',async t=>{
  const f=fixture(t),work=await f.workspace();fs.writeFileSync(path.join(work,'docs/task.md'),'agent\n');const plan=await prepareIntegration(f.options);validate(f,plan);fs.writeFileSync(path.join(plan.candidateRoot,'docs/task.md'),'changed after check\n');
  assert.equal((await applyIntegration(f.options)).reason_code,'CANDIDATE_CHANGED');const request=JSON.parse(fs.readFileSync(path.join(f.taskDir,'request.json')));delete request.integration_policy;fs.writeFileSync(path.join(f.taskDir,'request.json'),JSON.stringify(request));assert.equal((await applyIntegration(f.options)).reason_code,'AUTO_INTEGRATION_NOT_AUTHORIZED');
});
test('no changes is verified quietly and does not write source',async t=>{
  const f=fixture(t);await f.workspace();const before=index(f),plan=await prepareIntegration(f.options);assert.equal(plan.status,'no_changes',JSON.stringify(plan));validate(f,plan);const result=await applyIntegration(f.options);assert.equal(result.state,'no_changes');assert.equal(result.verified,true);assert.equal(index(f),before);
});
test('Windows applies bounded additions/deletions through owned handles', {skip:process.platform!=='win32'},async t=>{
  const f=fixture(t);f.write('docs/nested/keep.md','existing parent\n');const work=await f.workspace();fs.unlinkSync(path.join(work,'docs/delete.md'));fs.writeFileSync(path.join(work,'docs/nested/new.md'),'new nested\n');const plan=await prepareIntegration(f.options);validate(f,plan);const result=await applyIntegration(f.options);
  assert.equal(result.state,'integrated',JSON.stringify(result));assert.equal(fs.existsSync(path.join(f.repo,'docs/delete.md')),false);assert.equal(fs.readFileSync(path.join(f.repo,'docs/nested/new.md'),'utf8'),'new nested\n');
});
test('Windows actual open writer prevents application and preserves bytes', {skip:process.platform!=='win32'},async t=>{
  const f=fixture(t),work=await f.workspace();fs.writeFileSync(path.join(work,'docs/task.md'),'agent\n');const plan=await prepareIntegration(f.options);validate(f,plan);
  const script=path.join(f.root,'hold.ps1'),ready=path.join(f.root,'ready');fs.writeFileSync(script,"param($File,$Ready)\n$s=[IO.FileStream]::new($File,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::Read)\n[IO.File]::WriteAllText($Ready,'ready')\ntry{Start-Sleep -Seconds 30}finally{$s.Dispose()}\n");
  const child=spawn('pwsh.exe',['-NoProfile','-File',script,path.join(f.repo,'docs/task.md'),ready],{windowsHide:true,stdio:'ignore'});t.after(()=>child.kill());
  const deadline=Date.now()+10000;while(!fs.existsSync(ready)&&Date.now()<deadline)await new Promise(r=>setTimeout(r,50));assert.equal(fs.existsSync(ready),true);
  const result=await applyIntegration(f.options);assert.equal(result.state,'needs_attention',JSON.stringify(result));assert.equal(fs.readFileSync(path.join(f.repo,'docs/task.md'),'utf8'),'first\nsecond\nthird\nfourth\nfifth\n');child.kill();
});
test('Windows journal restart resumes only unapplied deltas and keeps original preimage backup', {skip:process.platform!=='win32'},async t=>{
  const f=fixture(t),work=await f.workspace();fs.writeFileSync(path.join(work,'docs/task.md'),'agent\n');fs.writeFileSync(path.join(work,'docs/new.md'),'new\n');const plan=await prepareIntegration(f.options);validate(f,plan);
  fs.mkdirSync(path.join(f.taskDir,'integration-backups/docs'),{recursive:true});fs.copyFileSync(path.join(f.repo,'docs/task.md'),path.join(f.taskDir,'integration-backups/docs/task.md'));
  f.write('docs/task.md','agent\n');fs.writeFileSync(path.join(f.taskDir,'integration-journal.jsonl'),JSON.stringify({kind:'prepared',planFingerprint:plan.planFingerprint})+'\n'+JSON.stringify({kind:'write_started',path:'docs/task.md'})+'\n');
  const result=await applyIntegration(f.options);assert.equal(result.state,'integrated',JSON.stringify(result));assert.equal(fs.readFileSync(path.join(f.repo,'docs/new.md'),'utf8'),'new\n');assert.equal(fs.readFileSync(path.join(f.taskDir,'integration-backups/docs/task.md'),'utf8'),'first\nsecond\nthird\nfourth\nfifth\n');
});
test('Windows partial journal bytes or external recovery edits hold without overwriting them', {skip:process.platform!=='win32'},async t=>{
  const f=fixture(t),work=await f.workspace();fs.writeFileSync(path.join(work,'docs/task.md'),'agent\n');fs.writeFileSync(path.join(work,'docs/new.md'),'new\n');const plan=await prepareIntegration(f.options);validate(f,plan);
  f.write('docs/task.md','partial or later external edit\n');fs.writeFileSync(path.join(f.taskDir,'integration-journal.jsonl'),JSON.stringify({kind:'prepared',planFingerprint:plan.planFingerprint})+'\n');
  const result=await applyIntegration(f.options);assert.equal(result.verified,false);assert.equal(result.reason_code,'RECOVERY_SOURCE_CONFLICT');assert.equal(fs.readFileSync(path.join(f.repo,'docs/task.md'),'utf8'),'partial or later external edit\n');assert.equal(fs.existsSync(path.join(f.repo,'docs/new.md')),false);
});
test('Windows source index movement after validation holds before touching content', {skip:process.platform!=='win32'},async t=>{
  const f=fixture(t),work=await f.workspace();fs.writeFileSync(path.join(work,'docs/task.md'),'agent\n');const plan=await prepareIntegration(f.options);validate(f,plan);f.write('other/unrelated.md','new staged bytes\n');f.git('add','other/unrelated.md');const staged=index(f);
  const result=await applyIntegration(f.options);assert.equal(result.reason_code,'SOURCE_GIT_CHANGED');assert.equal(index(f),staged);assert.equal(fs.readFileSync(path.join(f.repo,'docs/task.md'),'utf8'),'first\nsecond\nthird\nfourth\nfifth\n');
});
test('Windows hardlink target holds before changing any linked file', {skip:process.platform!=='win32'},async t=>{
  const f=fixture(t),work=await f.workspace();const outside=path.join(f.root,'other-app.md');fs.linkSync(path.join(f.repo,'docs/task.md'),outside);fs.writeFileSync(path.join(work,'docs/task.md'),'agent\n');
  const plan=await prepareIntegration(f.options);validate(f,plan);const result=await applyIntegration(f.options);assert.equal(result.state,'needs_attention',JSON.stringify(result));assert.equal(fs.readFileSync(outside,'utf8'),'first\nsecond\nthird\nfourth\nfifth\n');
});
test('new safe source in selected directory after validation holds before writing',async t=>{
  const f=fixture(t),work=await f.workspace();fs.writeFileSync(path.join(work,'docs/task.md'),'agent\n');const plan=await prepareIntegration(f.options);validate(f,plan);f.write('docs/nested/dependency.md','new dependency\n');
  const result=await applyIntegration(f.options);assert.equal(result.reason_code,'SOURCE_CHANGED');assert.equal(fs.readFileSync(path.join(f.repo,'docs/task.md'),'utf8'),'first\nsecond\nthird\nfourth\nfifth\n');
});
test('preparation of a new scoped directory leaves original unchanged',async t=>{
  const f=fixture(t),work=await f.workspace();fs.mkdirSync(path.join(work,'docs/nested'));fs.writeFileSync(path.join(work,'docs/nested/new.md'),'new\n');
  const result=await prepareIntegration(f.options);assert.equal(result.status,'prepared',JSON.stringify(result));assert.equal(fs.existsSync(path.join(f.repo,'docs/nested')),false);
});
test('Windows final locked source-set check catches files added after Node recapture', {skip:process.platform!=='win32'},async t=>{
  const f=fixture(t);f.write('docs/nested/keep.md','existing\n');const work=await f.workspace();fs.writeFileSync(path.join(work,'docs/task.md'),'agent\n');const plan=await prepareIntegration(f.options);validate(f,plan);
  const helperPath=path.join(f.root,'race.ps1'),native=path.join(__dirname,'../tools/hermes-synk/integration-windows.ps1');
  const quote=value=>"'"+value.replaceAll("'","''")+"'";
  fs.writeFileSync(helperPath,'param($TaskDir,$PlanHash,$ValidationHash,$GlobalGuard)\n[IO.File]::WriteAllText('+quote(path.join(f.repo,'docs/nested/late.md'))+",'late dependency')\n& "+quote(native)+' @PSBoundParameters\n');
  const result=await applyIntegration({...f.options,helperPath});assert.equal(result.reason_code,'SOURCE_SCOPE_CHANGED',JSON.stringify(result));assert.equal(fs.readFileSync(path.join(f.repo,'docs/task.md'),'utf8'),'first\nsecond\nthird\nfourth\nfifth\n');
});
test('ignored new agent source is held before preparation',async t=>{
  const f=fixture(t);f.write('.gitignore','node_modules/\n.env\ndocs/new.md\n');const work=await f.workspace();fs.writeFileSync(path.join(work,'docs/new.md'),'ignored new source\n');const plan=await prepareIntegration(f.options);assert.equal(plan.code,'IGNORED_SCOPE_SOURCE');
});
test('mode-only agent changes require review instead of quiet no-changes',async t=>{
  const f=fixture(t),work=await f.workspace();execFileSync('git',['update-index','--chmod=+x','docs/task.md'],{cwd:work,windowsHide:true,stdio:'pipe'});
  const result=await prepareIntegration(f.options);assert.equal(result.code,'FILE_MODE_REVIEW_REQUIRED');
});
