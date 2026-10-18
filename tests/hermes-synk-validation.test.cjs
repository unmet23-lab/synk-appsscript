'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {validateTask,tapSummary,cleanEnvironment,spansExecuted}=require('../tools/hermes-synk/validation.cjs');
function fixture(t,{files,changes,sourceFiles={},checks=[],goal='completed'}={}){
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'synk-validation-'));
  t.after(()=>{if(path.dirname(path.resolve(base))!==path.resolve(os.tmpdir())||!path.basename(base).startsWith('synk-validation-'))throw new Error('Fixture cleanup escaped temp root');fs.rmSync(base,{recursive:true,force:true});});
  const taskDir=path.join(base,'synk-123456789abc'),candidateRoot=path.join(taskDir,'candidate'),work=path.join(taskDir,'workspace'),sourceRoot=path.join(base,'source');
  fs.mkdirSync(candidateRoot,{recursive:true});fs.mkdirSync(work);fs.mkdirSync(sourceRoot);
  const content=files||{'docs/note.md':'A short verified note.\n'};
  for(const [rel,text]of Object.entries(content)){const file=path.join(candidateRoot,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);}
  fs.writeFileSync(path.join(taskDir,'request.json'),JSON.stringify({id:path.basename(taskDir),integration_policy:'auto_verified_v1',workspace_root:work}));
  fs.writeFileSync(path.join(taskDir,'native.exit'),'0');
  fs.writeFileSync(path.join(work,'.synk-completion.json'),JSON.stringify({version:1,task_id:path.basename(taskDir),goal_status:goal,summary:'Finished the requested fixture.',checks}));
  const fixedChanges=(changes||Object.keys(content).map(p=>({path:p,kind:'modify'}))).map(change=>{
    if(change.kind==='add')return {...change,beforeSha256:null};
    const before=sourceFiles[change.path]??'',file=path.join(sourceRoot,change.path);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,before);
    return {...change,beforeSha256:crypto.createHash('sha256').update(before).digest('hex')};
  });
  const prepared={status:'prepared',candidateRoot,sourceRoot,planFingerprint:'a'.repeat(64),changesFingerprint:'b'.repeat(64),
    changes:fixedChanges,candidateFiles:Object.keys(content).map(p=>({path:p}))};
  fs.writeFileSync(path.join(taskDir,'integration-plan.json'),JSON.stringify(prepared));
  return {taskDir,candidateRoot,sourceRoot,work,prepared,prepare:async()=>prepared};
}
test('ordinary documents pass integrity checks without unnecessary tests',async t=>{
  const f=fixture(t);const result=await validateTask(f);
  assert.equal(result.status,'passed');assert.equal(result.checks[0].kind,'text_integrity');assert.equal(result.candidateFiles.length,1);
});
test('native exit zero does not substitute for a structured completion report',async t=>{
  const f=fixture(t);fs.unlinkSync(path.join(f.work,'.synk-completion.json'));
  assert.equal((await validateTask(f)).reason_code,'COMPLETION_REPORT_MISSING');
});
test('explicit unresolved user decision cannot integrate',async t=>{
  const f=fixture(t,{goal:'needs_decision'});assert.equal((await validateTask(f)).reason_code,'USER_DECISION_REQUIRED');
});
test('legacy requests cannot gain automatic integration retroactively',async t=>{
  const f=fixture(t);fs.writeFileSync(path.join(f.taskDir,'request.json'),JSON.stringify({id:path.basename(f.taskDir),workspace_root:f.work}));
  assert.equal((await validateTask(f)).reason_code,'AUTO_INTEGRATION_NOT_AUTHORIZED');
});
test('code syntax alone is not sufficient validation',async t=>{
  const f=fixture(t,{files:{'app.cjs':'module.exports = 1;\n'}});
  assert.equal((await validateTask(f)).reason_code,'RELATED_TESTS_REQUIRED');
});
const APP='module.exports = (a,b) => a+b;\n';
const TEST="const test=require('node:test');const assert=require('node:assert/strict');const add=require('../app.cjs');test('adds numbers',()=>assert.equal(add(2,3),5));\n";
test('real Node tests must run and exercise the changed module',async t=>{
  const f=fixture(t,{files:{'app.cjs':APP,'tests/app.test.cjs':TEST},changes:[{path:'app.cjs',kind:'modify'}],checks:[{kind:'node_test',path:'tests/app.test.cjs'}]});
  const result=await validateTask(f);
  assert.equal(result.status,'passed',result.reason_code);const check=result.checks.find(x=>x.kind==='node_test');
  assert.equal(check.tests,1);assert.deepEqual(check.changedCodeExercised,['app.cjs']);
});
test('unrelated passing tests cannot validate untouched changed code',async t=>{
  const f=fixture(t,{files:{'app.cjs':APP,'tests/app.test.cjs':"require('node:test')('unrelated',()=>{});"},changes:[{path:'app.cjs',kind:'modify'}],checks:[{kind:'node_test',path:'tests/app.test.cjs'}]});
  assert.equal((await validateTask(f)).reason_code,'CHANGED_CODE_NOT_EXERCISED');
});
test('a real assertion failure holds the merge',async t=>{
  const f=fixture(t,{files:{'app.cjs':'module.exports=()=>99;','tests/app.test.cjs':TEST},changes:[{path:'app.cjs',kind:'modify'}],checks:[{kind:'node_test',path:'tests/app.test.cjs'}]});
  assert.equal((await validateTask(f)).reason_code,'RELATED_TESTS_FAILED_OR_INCOMPLETE');
});
test('missing explicit test path cannot be silently skipped',async t=>{
  const f=fixture(t,{files:{'app.cjs':APP,'tests/app.test.cjs':TEST},checks:[{kind:'node_test',path:'tests/missing.test.cjs'},{kind:'node_test',path:'tests/app.test.cjs'}]});
  assert.equal((await validateTask(f)).status,'needs_attention');
});
test('changing candidate source during the test invalidates the result',async t=>{
  const modifying=TEST+"require('node:fs').appendFileSync(require('node:path').resolve(__dirname,'../app.cjs'),'// changed during test\\n');";
  const f=fixture(t,{files:{'app.cjs':APP,'tests/app.test.cjs':modifying},changes:[{path:'app.cjs',kind:'modify'}],checks:[{kind:'node_test',path:'tests/app.test.cjs'}]});
  assert.equal((await validateTask(f)).reason_code,'CANDIDATE_CHANGED_DURING_VALIDATION');
});
test('policy changes, deletion and unsupported adapters require a decision',async t=>{
  for(const [rel,kind,expected] of [['AGENTS.md','modify','OPERATING_POLICY_REVIEW_REQUIRED'],['docs/note.md','delete','DELETION_REVIEW_REQUIRED'],['ui.html','modify','WEB_BROWSER_CHECK_REQUIRED'],['schema.sql','modify','VALIDATION_ADAPTER_REQUIRED']]){
    const f=fixture(t,{files:{[rel]:'unchanged'},changes:[{path:rel,kind}]});assert.equal((await validateTask(f)).reason_code,expected);
  }
});
test('a stored attention result is not an automatic repeated test loop',async t=>{
  const f=fixture(t,{files:{'app.cjs':APP}});await validateTask(f);
  let prepared=0;const result=await validateTask({...f,prepare:async()=>{prepared++;return f.prepared;}});
  assert.equal(result.reason_code,'RELATED_TESTS_REQUIRED');assert.equal(prepared,0);
});
test('test child environment excludes credentials and inherited test-worker mode',t=>{
  const f=fixture(t);const env=cleanEnvironment(path.join(f.taskDir,'env'));
  assert.equal(env.NODE_TEST_CONTEXT,undefined);assert.equal(env.OPENAI_API_KEY,undefined);assert.equal(env.ANTHROPIC_API_KEY,undefined);
  assert.notEqual(env.USERPROFILE,process.env.USERPROFILE);assert.equal(env.SYNK_VALIDATION,'1');
});
test('test summary requires all explicit totals',()=>{
  assert.ok(Number.isNaN(tapSummary('').tests));assert.equal(tapSummary('# tests 1\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n').tests,1);
});
test('passed evidence is reused after restart without preparation or test execution',async t=>{
  const f=fixture(t);const first=await validateTask(f);
  const again=await validateTask({...f,prepare:()=>{throw new Error('must not prepare twice');},runner:()=>{throw new Error('must not test twice');}});
  assert.deepEqual(again,first);
});
test('a changed candidate or completion invalidates cached passed evidence',async t=>{
  for(const changed of ['candidate','completion']){
    const f=fixture(t);await validateTask(f);
    fs.appendFileSync(changed==='candidate'?path.join(f.candidateRoot,'docs/note.md'):path.join(f.work,'.synk-completion.json'),' ');
    assert.equal((await validateTask(f)).reason_code,'VALIDATION_EVIDENCE_CHANGED');
  }
});
test('unchanged tasks reuse their no-changes evidence without preparing again',async t=>{
  const f=fixture(t,{changes:[]});f.prepared.status='no_changes';
  fs.writeFileSync(path.join(f.taskDir,'integration-plan.json'),JSON.stringify(f.prepared));
  const first=await validateTask(f);assert.equal(first.status,'no_changes');
  assert.deepEqual(await validateTask({...f,prepare:()=>{throw new Error('must not prepare twice');}}),first);
});

test('loading a module does not prove its changed function executed',async t=>{
  const f=fixture(t,{files:{'app.cjs':'exports.sum=(a,b)=>99;\n','tests/new.test.cjs':"require('../app.cjs');require('node:test')('loads',()=>{});"},
    changes:[{path:'app.cjs',kind:'modify'},{path:'tests/new.test.cjs',kind:'add'}],checks:[{kind:'node_test',path:'tests/new.test.cjs'}]});
  assert.equal((await validateTask(f)).reason_code,'CHANGED_CODE_NOT_EXERCISED');
});

test('an uncovered changed branch holds even when its containing function ran',async t=>{
  const code="module.exports=x=>{\n if(x) return 10;\n return 2;\n};\n";
  const previous=code.replace('return 10','return 1');
  const check="const test=require('node:test'),assert=require('node:assert/strict'),f=require('../app.cjs');test('other branch',()=>assert.equal(f(false),2));";
  const f=fixture(t,{files:{'app.cjs':code,'tests/app.test.cjs':check},sourceFiles:{'app.cjs':previous},changes:[{path:'app.cjs',kind:'modify'}],checks:[{kind:'node_test',path:'tests/app.test.cjs'}]});
  assert.equal((await validateTask(f)).reason_code,'CHANGED_CODE_NOT_EXERCISED');
});

test('an unchanged uncalled function does not block an exercised changed line',async t=>{
  const code="exports.unused=()=>{ return 999; };\nexports.add=(a,b)=>a+b;\n";
  const previous=code.replace('a+b','a-b');
  const check="const test=require('node:test'),assert=require('node:assert/strict'),f=require('../app.cjs');test('new result',()=>assert.equal(f.add(2,3),5));";
  const f=fixture(t,{files:{'app.cjs':code,'tests/app.test.cjs':check},sourceFiles:{'app.cjs':previous},changes:[{path:'app.cjs',kind:'modify'}],checks:[{kind:'node_test',path:'tests/app.test.cjs'}]});
  const result=await validateTask(f);assert.equal(result.status,'passed',result.reason_code);
});

test('multiple test processes combine nested branch coverage rather than retaining a zero from one child',()=>{
  const first=[{start:0,end:100,count:1},{start:10,end:80,count:1},{start:20,end:40,count:0}];
  const second=[{start:0,end:100,count:1},{start:10,end:80,count:1},{start:50,end:70,count:0}];
  const spans=[{start:15,end:75}];
  assert.equal(spansExecuted([first],spans),false);
  assert.equal(spansExecuted([first,second],spans),true);
  assert.equal(spansExecuted([first,first],spans),false);
  assert.equal(spansExecuted([[{start:0,end:100,count:1},{start:0,end:100,count:0}]],spans),false);
});

test('changed helper code under tests fixtures still needs execution evidence',async t=>{
  const f=fixture(t,{files:{'tests/fixtures/app.cjs':'exports.unused=()=>99;\n','tests/app.test.cjs':"require('./fixtures/app.cjs');require('node:test')('loads',()=>{});"},
    changes:[{path:'tests/fixtures/app.cjs',kind:'modify'}],checks:[{kind:'node_test',path:'tests/app.test.cjs'}]});
  assert.equal((await validateTask(f)).reason_code,'CHANGED_CODE_NOT_EXERCISED');
});

test('source hash mismatch and unavailable original evidence cannot validate changed lines',async t=>{
  for(const mode of ['changed','missing']){
    const f=fixture(t,{files:{'app.cjs':APP,'tests/app.test.cjs':TEST},changes:[{path:'app.cjs',kind:'modify'}],checks:[{kind:'node_test',path:'tests/app.test.cjs'}]});
    if(mode==='changed')fs.writeFileSync(path.join(f.sourceRoot,'app.cjs'),'desktop update');
    else delete f.prepared.changes[0].beforeSha256;
    assert.equal((await validateTask(f)).reason_code,mode==='changed'?'SOURCE_CHANGED':'SOURCE_EVIDENCE_UNAVAILABLE');
  }
});

test('JSON changes cannot pass through an unrelated successful test',async t=>{
  const f=fixture(t,{files:{'pricing.json':'{"price":999999}','tests/unrelated.test.cjs':"require('node:test')('unrelated',()=>{});"},
    changes:[{path:'pricing.json',kind:'modify'}],checks:[{kind:'node_test',path:'tests/unrelated.test.cjs'}]});
  assert.equal((await validateTask(f)).reason_code,'DATA_VALIDATION_INCOMPLETE');
});

test('naming a data adapter cannot let a changed test skip actual execution',async t=>{
  const f=fixture(t,{files:{'tests/consumer.test.cjs':"require('node:test')('broken',()=>{throw Error('must run')});"},
    checks:[{kind:'json_schema',path:'unchanged.json',schema:'schema.json',tests:['tests/consumer.test.cjs']}]});
  assert.equal((await validateTask(f)).reason_code,'RELATED_TESTS_REQUIRED');
});

test('compiler-validated tsconfig accepts JSONC while ordinary JSON stays strict',async t=>{
  const f=fixture(t,{files:{'app.ts':'export function value():number { return 2; }\n',
    'tsconfig.json':'{\n// official compiler JSONC\n"compilerOptions":{"target":"ES2022","module":"CommonJS","strict":true,},"files":["app.ts"]}\n',
    'tests/app.test.cjs':"require('node:test')('value',()=>require('node:assert/strict').equal(require('../app.js').value(),2));"},
    sourceFiles:{'app.ts':'export function value():number { return 1; }\n','tsconfig.json':'{"files":["app.ts"]}'},
    changes:[{path:'app.ts',kind:'modify'},{path:'tsconfig.json',kind:'modify'}],
    checks:[{kind:'typescript',path:'tsconfig.json',tests:['tests/app.test.cjs']}]});
  const result=await validateTask(f);assert.equal(result.status,'passed',result.reason_code);
  assert.ok(result.checks.some(check=>check.kind==='typescript'&&check.passed));
  const ordinary=fixture(t,{files:{'data.json':'{"value":2,}'}});
  assert.equal((await validateTask(ordinary)).reason_code,'JSON_CHECK_FAILED');
});

test('nested AGENTS CLAUDE and SKILL instructions require operating policy review',async t=>{
  for(const name of ['src/AGENTS.md','nested/CLAUDE.md','skills/tool/SKILL.md']){
    const f=fixture(t,{files:{[name]:'Updated instructions.'}});
    assert.equal((await validateTask(f)).reason_code,'OPERATING_POLICY_REVIEW_REQUIRED');
  }
});

test('a genuinely exercised new module and new regression test may validate',async t=>{
  const f=fixture(t,{files:{'app.cjs':APP,'tests/app.test.cjs':TEST},changes:[{path:'app.cjs',kind:'add'},{path:'tests/app.test.cjs',kind:'add'}],checks:[{kind:'node_test',path:'tests/app.test.cjs'}]});
  const result=await validateTask(f);assert.equal(result.status,'passed',result.reason_code);
});

test('a cached pass from an older weaker validation contract is not reused',async t=>{
  const f=fixture(t),first=await validateTask(f);
  assert.equal(first.validation_contract,'multi_language_v2');
  delete first.validation_contract;
  fs.writeFileSync(path.join(f.taskDir,'validation.json'),JSON.stringify(first));
  const result=await validateTask({...f,prepare:()=>{throw new Error('must not rebase old evidence');}});
  assert.equal(result.reason_code,'VALIDATION_EVIDENCE_CHANGED');
});
