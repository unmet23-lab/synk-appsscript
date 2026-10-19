'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {prepareWorkspace}=require('../tools/hermes-synk/workspace.cjs');
const {previewTask}=require('../tools/hermes-synk/validation-preview.cjs');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const sentinelFiles=['validation.json','integration.json','integration-plan.json'];
function files(root){const rows=[];function visit(folder,prefix){for(const entry of fs.readdirSync(folder,{withFileTypes:true})){const rel=prefix?prefix+'/'+entry.name:entry.name;if(rel==='.git')continue;if(entry.isDirectory())visit(path.join(folder,entry.name),rel);else rows.push([rel,hash(fs.readFileSync(path.join(folder,entry.name)))]);}}visit(root,'');return rows.sort(([a],[b])=>a<b?-1:a>b?1:0);}
async function fixture(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'synk-preview-test-')),repo=path.join(root,'source'),taskId='synk-'+crypto.randomBytes(6).toString('hex'),taskDir=path.join(root,'tasks',taskId);
  fs.mkdirSync(repo);const write=(rel,text)=>{const file=path.join(repo,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);};
  const git=(...args)=>execFileSync('git',args,{cwd:repo,encoding:'utf8',windowsHide:true,stdio:['pipe','pipe','pipe']}).trim();
  git('init','-q','-b','main');git('config','user.name','Preview fixture');git('config','user.email','fixture@localhost');git('config','core.autocrlf','false');git('config','extensions.worktreeConfig','true');
  write('AGENTS.md','Use only this admitted fixture scope.\n');write('CLAUDE.md','@AGENTS.md\n');write('package.json',JSON.stringify({scripts:{'check:storage':'node tools/git-storage-check.cjs --cached'}}));write('.gitignore','.tmp/\nnode_modules/\n.env\n');
  for(const name of ['git-storage-check.cjs','git-storage-policy.json'])write('tools/'+name,fs.readFileSync(path.join(__dirname,'../tools',name)));
  write('code/app.cjs','exports.calculate = value => value + 1;\n');write('tests/app.test.cjs',"const test=require('node:test'),assert=require('node:assert/strict');\nconst {calculate}=require('../code/app.cjs');\ntest('calculation',()=>assert.equal(calculate(3),4));\n");
  write('code/calculator.py','def calculate(value):\n    return value + 1\n');write('tests/test_calculator.py','import unittest\nimport importlib.util\nfrom pathlib import Path\nspec=importlib.util.spec_from_file_location("code_calculator",Path("code/calculator.py"))\nmodule=importlib.util.module_from_spec(spec)\nspec.loader.exec_module(module)\nclass Calculation(unittest.TestCase):\n    def test_value(self):\n        self.assertEqual(module.calculate(3),4)\n');
  write('docs/note.md','Admitted source note.\n');write('outside/kept.md','This source is outside the scope.\n');git('add','.');git('commit','-qm','preview baseline');
  const receipt=await prepareWorkspace({repo,taskDir,taskId,scope:['code','tests','docs/note.md'],allowedRoots:[repo]});assert.equal(receipt.ok,true,JSON.stringify(receipt));
  const work=receipt.path,snapshot=path.join(taskDir,'snapshot-files');
  const request={id:taskId,state:'running',integration_policy:'auto_verified_v1',notification_policy:'attention_only_v1',workspace_root:work,source_root:repo,native_session_id:'one-existing-native-session'};
  fs.writeFileSync(path.join(taskDir,'request.json'),JSON.stringify(request));for(const name of sentinelFiles)fs.writeFileSync(path.join(taskDir,name),JSON.stringify({sentinel:name,keep:true})+'\n');
  const report=(checks=[],extra={})=>fs.writeFileSync(path.join(work,'.synk-completion.json'),JSON.stringify({version:1,task_id:taskId,goal_status:'completed',summary:'Completed fixture work.',checks,...extra}));report();
  const edit=(rel,text)=>{const file=path.join(work,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);};
  const receipts=()=>sentinelFiles.map(name=>[name,fs.readFileSync(path.join(taskDir,name),'utf8')]);
  t.after(()=>{const real=fs.realpathSync(root);assert.ok(real.startsWith(fs.realpathSync(os.tmpdir())+path.sep)&&path.basename(real).startsWith('synk-preview-test-'));fs.rmSync(real,{recursive:true,force:true});});
  return {root,repo,taskId,taskDir,work,snapshot,receipt,request,write,edit,report,receipts,git};
}
test('same native workspace can fix a failed JS preview and pass without source or final receipt changes',async t=>{
  const f=await fixture(t);f.edit('code/app.cjs','exports.calculate = value => value + 2;\n');f.edit('tests/app.test.cjs',"const test=require('node:test'),assert=require('node:assert/strict');\nconst {calculate}=require('../code/app.cjs');\ntest('calculation',()=>assert.equal(calculate(3),6));\n");f.report([{kind:'node_test',path:'tests/app.test.cjs'}]);
  f.write('docs/note.md','Concurrent original user edit after admission.\n');const original=files(f.repo),snapshot=files(f.snapshot),receipts=f.receipts(),index=hash(fs.readFileSync(path.join(f.repo,'.git/index'))),head=f.git('rev-parse','HEAD'),request=fs.readFileSync(path.join(f.taskDir,'request.json'),'utf8');
  const first=await previewTask({taskDir:f.taskDir});assert.equal(first.status,'needs_attention');assert.equal(first.reason_code,'RELATED_TESTS_FAILED_OR_INCOMPLETE');assert.equal(first.preview,true);
  f.edit('tests/app.test.cjs',"const test=require('node:test'),assert=require('node:assert/strict');\nconst {calculate}=require('../code/app.cjs');\ntest('calculation',()=>assert.equal(calculate(3),5));\n");
  const next=await previewTask({taskDir:f.taskDir});assert.equal(next.status,'passed',JSON.stringify(next));assert.equal(next.needs_attention,false);assert.notEqual(next.evidence,first.evidence);assert.ok(next.checks.some(item=>item.kind==='node_test'&&item.tests===1));
  assert.deepEqual(files(f.repo),original);assert.deepEqual(files(f.snapshot),snapshot);assert.deepEqual(f.receipts(),receipts);assert.equal(hash(fs.readFileSync(path.join(f.repo,'.git/index'))),index);assert.equal(f.git('rev-parse','HEAD'),head);assert.equal(fs.readFileSync(path.join(f.taskDir,'request.json'),'utf8'),request);assert.equal(fs.existsSync(path.join(f.taskDir,'native.exit')),false);
});
test('Markdown preview passes the same validator without inventing functional tests',async t=>{
  const f=await fixture(t);f.edit('docs/note.md','A revised source-backed note.\n');const receipts=f.receipts(),result=await previewTask({taskDir:f.taskDir});assert.equal(result.status,'passed',JSON.stringify(result));assert.deepEqual(result.changes,['docs/note.md']);assert.ok(result.checks.some(item=>item.kind==='text_integrity'));assert.deepEqual(f.receipts(),receipts);
});
test('Python preview exercises changed function lines using the admission snapshot',async t=>{
  const f=await fixture(t);f.edit('code/calculator.py','def calculate(value):\n    return value + 2\n');f.edit('tests/test_calculator.py','import unittest\nimport importlib.util\nfrom pathlib import Path\nspec=importlib.util.spec_from_file_location("code_calculator",Path("code/calculator.py"))\nmodule=importlib.util.module_from_spec(spec)\nspec.loader.exec_module(module)\nclass Calculation(unittest.TestCase):\n    def test_value(self):\n        self.assertEqual(module.calculate(3),5)\n');f.report([{kind:'python_unittest',path:'tests/test_calculator.py'}]);
  const original=files(f.repo),result=await previewTask({taskDir:f.taskDir});assert.equal(result.status,'passed',JSON.stringify(result));const proof=result.checks.find(item=>item.kind==='python_tests');assert.equal(proof.tests,1);assert.ok(proof.changedLinesExercised.some(item=>item.path==='code/calculator.py'&&item.required_lines.includes(2)));assert.deepEqual(files(f.repo),original);
});
test('completion metadata and .tmp evidence are excluded and unchanged work stays no_changes on repeat',async t=>{
  const f=await fixture(t);f.edit('.tmp/unrelated/not-source.bin',Buffer.from([0,1,2]));f.edit('.tmp/unrelated/looks-like-a-token.env','discarded fixture-only text');f.report([],{summary:'Metadata changed without source edits.'});const receipts=f.receipts(),one=await previewTask({taskDir:f.taskDir}),two=await previewTask({taskDir:f.taskDir});
  assert.equal(one.status,'no_changes',JSON.stringify(one));assert.equal(two.status,'no_changes',JSON.stringify(two));assert.deepEqual(two.changes,[]);assert.deepEqual(f.receipts(),receipts);assert.ok(two.evidence.startsWith(path.join(f.work,'.tmp','synk-validation-preview')+path.sep));assert.equal(fs.existsSync(path.join(f.work,'outside/kept.md')),false);
});
test('safe source materialized outside the admitted scope holds without changing final receipts',async t=>{
  const f=await fixture(t);f.edit('outside/unauthorized.md','An unauthorized new file.\n');const receipts=f.receipts(),result=await previewTask({taskDir:f.taskDir});assert.equal(result.reason_code,'WORKSPACE_SCOPE_VIOLATION');assert.equal(result.needs_attention,true);assert.deepEqual(f.receipts(),receipts);assert.equal(fs.existsSync(path.join(f.work,'.tmp')),false);
});
test('secret filenames and invalid completion state do not become successful preview work',async t=>{
  const f=await fixture(t);f.edit('.env','FIXTURE_ONLY=not-a-credential\n');assert.equal((await previewTask({taskDir:f.taskDir})).reason_code,'UNSAFE_AGENT_OUTPUT');fs.unlinkSync(path.join(f.work,'.env'));f.report([],{goal_status:'needs_decision',decision_reason:'Fixture requires a choice.'});assert.equal((await previewTask({taskDir:f.taskDir})).reason_code,'USER_DECISION_REQUIRED');
});
test('different workspace receipt path is rejected before evidence is written',async t=>{
  const f=await fixture(t),request={...f.request,workspace_root:f.snapshot};fs.writeFileSync(path.join(f.taskDir,'request.json'),JSON.stringify(request));const result=await previewTask({taskDir:f.taskDir});assert.equal(result.reason_code,'PREVIEW_RECEIPT_INVALID');assert.equal(fs.existsSync(path.join(f.work,'.tmp')),false);
});
test('junction at preview evidence parent cannot redirect writes outside the workspace',async t=>{
  const f=await fixture(t),outside=path.join(f.root,'outside-evidence');fs.mkdirSync(outside);fs.mkdirSync(path.join(f.work,'.tmp'));const link=path.join(f.work,'.tmp','synk-validation-preview');fs.symlinkSync(outside,link,process.platform==='win32'?'junction':'dir');
  try{const result=await previewTask({taskDir:f.taskDir});assert.equal(result.status,'needs_attention');assert.equal(result.reason_code,'VALIDATION_SYMLINK');assert.deepEqual(fs.readdirSync(outside),[]);}finally{fs.unlinkSync(link);}
});
test('workspace-root junction cannot authorize writes into an external directory',async t=>{
  const f=await fixture(t),saved=f.work+'.original',outside=path.join(f.root,'outside-workspace');fs.cpSync(f.work,outside,{recursive:true});fs.writeFileSync(path.join(outside,'docs/note.md'),'External candidate modification.\n');fs.renameSync(f.work,saved);fs.symlinkSync(outside,f.work,process.platform==='win32'?'junction':'dir');
  try{const result=await previewTask({taskDir:f.taskDir});assert.equal(result.status,'needs_attention',JSON.stringify(result));assert.equal(fs.existsSync(path.join(outside,'.tmp')),false);}finally{fs.unlinkSync(f.work);fs.renameSync(saved,f.work);}
});
test('snapshot-root junction cannot substitute a different admission baseline',async t=>{
  const f=await fixture(t),saved=f.snapshot+'.original',outside=path.join(f.root,'outside-snapshot');fs.cpSync(f.snapshot,outside,{recursive:true});fs.renameSync(f.snapshot,saved);fs.symlinkSync(outside,f.snapshot,process.platform==='win32'?'junction':'dir');
  try{const result=await previewTask({taskDir:f.taskDir});assert.equal(result.status,'needs_attention',JSON.stringify(result));assert.equal(fs.existsSync(path.join(f.work,'.tmp')),false);}finally{fs.unlinkSync(f.snapshot);fs.renameSync(saved,f.snapshot);}
});
test('an unrelated adapter declaration cannot exempt changed JavaScript tests from actual execution',async t=>{
  const f=await fixture(t);f.edit('tests/app.test.cjs','exports.unexecuted = true;\n');f.report([{kind:'typescript',tests:['tests/app.test.cjs']}]);
  const result=await previewTask({taskDir:f.taskDir});assert.equal(result.status,'needs_attention',JSON.stringify(result));assert.equal(result.needs_attention,true);
});
