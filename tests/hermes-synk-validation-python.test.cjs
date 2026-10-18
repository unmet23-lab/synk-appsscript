'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const {validatePython,runtimeCandidates,selectRuntime,cleanEnvironment}=require('../tools/hermes-synk/validation-python.cjs');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const base='def calculate(value):\n    return value + 1\n';
const after='def calculate(value):\n    return value + 2\n';
const passing='import unittest\nfrom calculator import calculate\n\nclass Calculation(unittest.TestCase):\n    def test_value(self):\n        self.assertEqual(calculate(3), 5)\n';
function fixture(t,{source=base,candidate=after,testSource=passing,kind='python_unittest',add=false}={}){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'synk-python-validation-')),sourceRoot=path.join(root,'source'),candidateRoot=path.join(root,'candidate'),taskDir=path.join(root,'synk-123456789abc');
  for(const folder of [sourceRoot,candidateRoot,taskDir])fs.mkdirSync(folder);
  fs.writeFileSync(path.join(sourceRoot,'calculator.py'),source);fs.writeFileSync(path.join(candidateRoot,'calculator.py'),candidate);fs.mkdirSync(path.join(candidateRoot,'tests'));fs.writeFileSync(path.join(candidateRoot,'tests/test_calculator.py'),testSource);
  const prepared={sourceRoot,candidateRoot,changes:[{path:'calculator.py',kind:add?'add':'modify',beforeSha256:add?null:hash(Buffer.from(source)),afterSha256:hash(Buffer.from(candidate))}],candidateFiles:['calculator.py','tests/test_calculator.py'].map(rel=>({path:rel,sha256:hash(fs.readFileSync(path.join(candidateRoot,rel)))}))};
  const options={taskDir,request:{id:'synk-123456789abc'},prepared,report:{checks:[{kind,path:'tests/test_calculator.py'}]},evidence:path.join(taskDir,'validation-evidence'),env:{}};
  t.after(()=>{const actual=fs.realpathSync(root);assert.ok(actual.startsWith(fs.realpathSync(os.tmpdir())+path.sep)&&path.basename(actual).startsWith('synk-python-validation-'));fs.rmSync(actual,{recursive:true,force:true});});
  return {root,sourceRoot,candidateRoot,taskDir,prepared,options};
}
async function rejectsCode(promise,code){await assert.rejects(promise,error=>error.code===code,code);}
test('runs actual unittest and records changed return line execution with runtime version',async t=>{
  const f=fixture(t),checks=await validatePython(f.options),summary=checks.at(-1);assert.equal(summary.kind,'python_tests');assert.equal(summary.tests,1);assert.equal(summary.pass,1);assert.equal(summary.skipped,0);assert.match(summary.runtime,/^3\./);assert.ok(summary.changedLinesExercised[0].required_lines.includes(2));assert.ok(summary.changedLinesExercised[0].executed_lines.includes(2));
  const receipt=JSON.parse(fs.readFileSync(summary.evidence));assert.equal(receipt.status,'passed');assert.equal(receipt.tests[0].errors,0);assert.equal(fs.existsSync(path.join(f.candidateRoot,'__pycache__')),false);
});
test('unrelated passing unittest cannot prove an uncalled changed function body',async t=>{
  const f=fixture(t,{testSource:'import unittest\nclass Other(unittest.TestCase):\n    def test_trivial(self):\n        self.assertTrue(True)\n'});await rejectsCode(validatePython(f.options),'PYTHON_CHANGED_CODE_NOT_EXERCISED');
});
test('syntax-only success is insufficient when no explicit tests were requested',async t=>{
  const f=fixture(t);f.options.report.checks=[];await rejectsCode(validatePython(f.options),'PYTHON_TESTS_REQUIRED');
});
test('missing explicit test is rejected before Python execution',async t=>{
  const f=fixture(t);f.options.report.checks.push({kind:'python_unittest',path:'tests/test_missing.py'});await rejectsCode(validatePython(f.options),'PYTHON_TEST_PATH_INVALID');
});
test('zero-test, failed and skipped unittest runs cannot pass',async t=>{
  for(const source of ['import unittest\n','import unittest\nclass Failure(unittest.TestCase):\n    def test_fail(self):\n        self.fail("fixture")\n','import unittest\nclass Skip(unittest.TestCase):\n    @unittest.skip("fixture")\n    def test_skip(self):\n        self.assertTrue(True)\n']){
    const f=fixture(t,{testSource:source});await rejectsCode(validatePython(f.options),'PYTHON_TESTS_FAILED_OR_INCOMPLETE');
  }
});
test('expected failure is incomplete evidence',async t=>{
  const f=fixture(t,{testSource:'import unittest\nclass Failure(unittest.TestCase):\n    @unittest.expectedFailure\n    def test_fail(self):\n        self.fail("fixture")\n'});await rejectsCode(validatePython(f.options),'PYTHON_TESTS_FAILED_OR_INCOMPLETE');
});
test('changed branch must execute even when the module and other branch ran',async t=>{
  const original='def calculate(value):\n    if value < 0:\n        return value + 1\n    return value + 2\n',candidate=original.replace('return value + 1','return value + 9');
  const f=fixture(t,{source:original,candidate});await rejectsCode(validatePython(f.options),'PYTHON_CHANGED_CODE_NOT_EXERCISED');
});
test('new modules require all executable changed lines rather than only module import',async t=>{
  const f=fixture(t,{candidate:'def calculate(value):\n    if value < 0:\n        return 0\n    return value + 2\n',add:true});await rejectsCode(validatePython(f.options),'PYTHON_CHANGED_CODE_NOT_EXERCISED');
});
test('pure comment edits still run actual tests without inventing executable lines',async t=>{
  const f=fixture(t,{source:'# old\n'+after,candidate:'# new\n'+after});const summary=(await validatePython(f.options)).at(-1);assert.equal(summary.tests,1);assert.equal(summary.changedLinesExercised[0].non_executable_only,true);
});
test('syntax errors fail before a passing unrelated test could hide them',async t=>{
  const f=fixture(t,{candidate:'def calculate(:\n    return 2\n'});await rejectsCode(validatePython(f.options),'PYTHON_SYNTAX_FAILED');
});
test('test execution exceptions and explicit exit cannot masquerade as a completed test',async t=>{
  const f=fixture(t,{testSource:'raise SystemExit(0)\n'});await rejectsCode(validatePython(f.options),'PYTHON_TEST_EXECUTION_FAILED');
});
test('candidate mutation during tests is rejected after execution',async t=>{
  const testSource=passing+'\nfrom pathlib import Path\nPath("calculator.py").write_text("mutated after import\\n",encoding="utf-8")\n';const f=fixture(t,{testSource});await rejectsCode(validatePython(f.options),'CANDIDATE_CHANGED_DURING_VALIDATION');
});
test('Python process receives no parent API credentials or Python import overrides',async t=>{
  const f=fixture(t),env=cleanEnvironment({OPENAI_API_KEY:'fixture-no-secret',PYTHONPATH:'unsafe',PYTEST_ADDOPTS:'--collect-only',HOME:'unsafe'},path.join(f.root,'clean'));
  assert.equal(env.OPENAI_API_KEY,undefined);assert.equal(env.PYTHONPATH,undefined);assert.equal(env.PYTEST_ADDOPTS,'');assert.notEqual(env.HOME,'unsafe');
  const testSource=passing+'\nimport os\nassert "OPENAI_API_KEY" not in os.environ\nassert "PYTHONPATH" not in os.environ\n';fs.writeFileSync(path.join(f.candidateRoot,'tests/test_calculator.py'),testSource);f.prepared.candidateFiles.find(item=>item.path==='tests/test_calculator.py').sha256=hash(Buffer.from(testSource));f.options.env={...process.env,OPENAI_API_KEY:'fixture-no-secret'};
  const summary=(await validatePython(f.options)).at(-1);assert.equal(summary.pass,1);
});
test('missing Python runtime and missing pytest have distinct hold reasons',async t=>{
  const f=fixture(t);await rejectsCode(validatePython({...f.options,pythonCandidates:[]}), 'PYTHON_RUNTIME_UNAVAILABLE');
  const mock=(executable,args)=>({status:0,stdout:JSON.stringify({major:3,minor:12,version:'3.12.14',executable,pytest:false})});
  f.options.report.checks=[{kind:'python_pytest',path:'tests/test_calculator.py'}];f.prepared.changes[0].kind='add';f.prepared.changes[0].beforeSha256=null;await rejectsCode(validatePython({...f.options,pythonCandidates:['fixture-python'],runner:mock}),'PYTHON_PYTEST_UNAVAILABLE');
});
test('runtime lookup is deterministic and never invokes a manager alias',()=>{
  const candidates=runtimeCandidates({});assert.deepEqual(candidates,runtimeCandidates({}));assert.ok(candidates.every(file=>!file.includes('WindowsApps')&&!/[\\/]Python[\\/]bin[\\/]/i.test(file)));assert.ok(candidates.length>0);
});
test('runtime probe selects an existing project pytest before any test execution',()=>{
  const called=[];const runner=(executable,args)=>{called.push([executable,args]);return {status:0,stdout:JSON.stringify({major:3,minor:12,version:'3.12.14',executable,pytest:executable==='project-venv'})};};
  const selected=selectRuntime({prepared:{pythonNeedsPytest:true},evidence:os.tmpdir(),env:{},runner,pythonCandidates:['bundled-python','project-venv','other-python']});assert.equal(selected.executable,'project-venv');assert.deepEqual(called.map(([file])=>file),['bundled-python','project-venv']);assert.ok(called.every(([,args])=>args.includes('-c')));
});
test('project runtime comes from request source_root rather than preview snapshot or policy repo',t=>{
  const f=fixture(t),parts=process.platform==='win32'?['Scripts','python.exe']:['bin','python'];
  const executable=path.join(f.sourceRoot,'.venv',...parts);fs.mkdirSync(path.dirname(executable),{recursive:true});fs.writeFileSync(executable,'fixture executable name only');
  const candidates=runtimeCandidates({sourceRoot:path.join(f.taskDir,'snapshot-files')},{source_root:f.sourceRoot,repo_root:f.root});assert.ok(candidates.includes(fs.realpathSync(executable)));
});
test('a real test failure never retries the task with another interpreter',async t=>{
  const f=fixture(t,{testSource:'import unittest\nclass Failure(unittest.TestCase):\n    def test_fail(self):\n        self.fail("fixture")\n'}),calls=[];
  const runner=(executable,args,options)=>{calls.push([executable,args]);return spawnSync(executable,args,options);};
  const selected=runtimeCandidates({})[0];await rejectsCode(validatePython({...f.options,runner,pythonCandidates:[selected,'not-to-be-run-python']}),'PYTHON_TESTS_FAILED_OR_INCOMPLETE');
  assert.equal(calls.filter(([exe,args])=>exe===selected&&args.includes('-c')).length,1);assert.equal(calls.filter(([,args])=>args.some(arg=>arg.endsWith('validation-python.py'))).length,1);assert.equal(calls.some(([exe])=>exe==='not-to-be-run-python'),false);
});
