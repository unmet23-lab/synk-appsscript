'use strict';
// A fixed, credential-free Python validator. No package installation, model,
// shell command string or retry after a test failure is performed here.
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const {safeSource,rejectSecrets}=require('./workspace.cjs');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const TEST=/^(?:.*\/)?(?:test_[^/]+|[^/]+_test)\.py$/;
const KINDS=new Set(['python_unittest','python_pytest']);
class PythonAttention extends Error{constructor(code){super(code);this.code=code;}}
function regular(root,rel){
  if(!safeSource(rel)||!rel.endsWith('.py'))throw new PythonAttention('PYTHON_UNSAFE_PATH');
  let file=root;for(const part of rel.split('/')){file=path.join(file,part);if(fs.lstatSync(file).isSymbolicLink())throw new PythonAttention('PYTHON_SYMLINK');}
  const stat=fs.statSync(file);if(!stat.isFile()||stat.size>4*1024*1024)throw new PythonAttention('PYTHON_FILE_LIMIT');return file;
}
function cleanEnvironment(base,evidence){
  const env={};for(const key of ['PATH','Path','SystemRoot','SYSTEMROOT','WINDIR','ComSpec','COMSPEC','PATHEXT','PROCESSOR_ARCHITECTURE','NUMBER_OF_PROCESSORS'])if(base?.[key]||process.env[key])env[key]=base?.[key]||process.env[key];
  const home=path.join(evidence,'empty-home'),temp=path.join(evidence,'temp');fs.mkdirSync(home,{recursive:true});fs.mkdirSync(temp,{recursive:true});
  return {...env,HOME:home,USERPROFILE:home,APPDATA:home,LOCALAPPDATA:home,TEMP:temp,TMP:temp,CI:'1',TZ:'UTC',NO_COLOR:'1',
    PYTHONDONTWRITEBYTECODE:'1',PYTHONNOUSERSITE:'1',PYTEST_DISABLE_PLUGIN_AUTOLOAD:'1',PYTEST_ADDOPTS:'',PYTEST_PLUGINS:'',
    SYNK_VALIDATION:'1',HERMES_DISABLE_LAZY_INSTALLS:'1',GIT_TERMINAL_PROMPT:'0',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:path.join(home,'no-git-config')};
}
function runtimeCandidates(prepared={},request={}){
  const home=os.homedir(),result=[];
  result.push(path.join(home,'.cache','codex-runtimes','codex-primary-runtime','dependencies','python',process.platform==='win32'?'python.exe':'bin/python3'));
  // Preview sourceRoot is the baseline snapshot, not the project's runtime.
  // source_root is plugin-verified and can be a different SYNK sibling repo.
  const project=request.source_root||prepared.sourceRoot;
  if(project)for(const name of ['.venv','venv'])result.push(path.join(project,name,...(process.platform==='win32'?['Scripts','python.exe']:['bin','python'])));
  const locals=[process.env.LOCALAPPDATA,path.join(home,'AppData','Local')].filter(Boolean);
  for(const local of [...new Set(locals)]){
    const folder=path.join(local,'Python');if(fs.existsSync(folder))for(const name of fs.readdirSync(folder).filter(name=>/^pythoncore-\d[\d.-]*-\w+$/.test(name)).sort().reverse())result.push(path.join(folder,name,'python.exe'));
    const programs=path.join(local,'Programs','Python');if(fs.existsSync(programs))for(const name of fs.readdirSync(programs).filter(name=>/^Python\d+$/.test(name)).sort().reverse())result.push(path.join(programs,name,'python.exe'));
  }
  // Real system binaries only: Windows Store/manager aliases can install or
  // launch a UI, so they are deliberately not executed as a fallback.
  if(process.platform!=='win32')for(const folder of (process.env.PATH||'').split(path.delimiter))for(const name of ['python3','python'])result.push(path.join(folder,name));
  return [...new Set(result.filter(file=>{try{return fs.statSync(file).isFile();}catch{return false;}}).map(file=>fs.realpathSync(file)))].slice(0,12);
}
function run(executable,args,cwd,env,runner,timeout=120000){
  const result=(runner||spawnSync)(executable,args,{cwd,env,encoding:'utf8',windowsHide:true,shell:false,timeout,maxBuffer:8*1024*1024});
  if(result.error||result.signal)throw new PythonAttention('PYTHON_EXECUTION_FAILED');return result;
}
function selectRuntime({prepared,request,evidence,env,runner,pythonCandidates}){
  const probe='import sys,importlib.util,json;print(json.dumps({"executable":sys.executable,"version":sys.version.split()[0],"major":sys.version_info.major,"minor":sys.version_info.minor,"pytest":importlib.util.find_spec("pytest") is not None}))';
  const needsPytest=prepared.pythonNeedsPytest;
  let found=false;
  for(const executable of pythonCandidates||runtimeCandidates(prepared,request)){
    let result,info;try{result=run(executable,['-I','-B','-c',probe],evidence,env,runner,10000);if(result.status!==0)continue;info=JSON.parse(result.stdout);}catch{continue;}
    if(info.major!==3||info.minor<10||typeof info.version!=='string'||typeof info.executable!=='string')continue;
    found=true;if(needsPytest&&!info.pytest)continue;return {...info,executable};
  }
  throw new PythonAttention(found&&needsPytest?'PYTHON_PYTEST_UNAVAILABLE':'PYTHON_RUNTIME_UNAVAILABLE');
}
function rangesForChange({prepared,change,file,evidence,env,runner}){
  if(change.kind==='add'&&change.beforeSha256===null)return {all:true,ranges:[],before:null};
  if(!prepared.sourceRoot||!/^[a-f0-9]{64}$/.test(change.beforeSha256||''))throw new PythonAttention('PYTHON_SOURCE_EVIDENCE_UNAVAILABLE');
  let before;try{before=fs.readFileSync(regular(prepared.sourceRoot,change.path));}catch{throw new PythonAttention('SOURCE_CHANGED');}
  if(hash(before)!==change.beforeSha256)throw new PythonAttention('SOURCE_CHANGED');
  const folder=path.join(evidence,'diff-'+crypto.randomBytes(6).toString('hex'));fs.mkdirSync(folder);
  const beforeFile=path.join(folder,'before.py');fs.writeFileSync(beforeFile,before,{flag:'wx',mode:0o600});
  const output=run('git',['--no-pager','diff','--no-index','--no-ext-diff','--no-textconv','--text','--unified=0','--',beforeFile,file],evidence,env,runner);
  if(![0,1].includes(output.status))throw new PythonAttention('PYTHON_DIFF_UNAVAILABLE');
  try{if(hash(fs.readFileSync(regular(prepared.sourceRoot,change.path)))!==change.beforeSha256)throw new Error();}catch{throw new PythonAttention('SOURCE_CHANGED');}
  const ranges=[...String(output.stdout).matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)].map(match=>({start:Number(match[1]),count:match[2]===undefined?1:Number(match[2])}));
  if(!ranges.length||ranges.some(item=>item.count<1))throw new PythonAttention('PYTHON_CHANGED_LINES_UNAVAILABLE');
  return {all:false,ranges,before:before.toString('base64')};
}
function frozenFiles(prepared){return prepared.candidateFiles.map(item=>{if(!safeSource(item.path))throw new PythonAttention('PYTHON_UNSAFE_PATH');const file=path.join(prepared.candidateRoot,item.path);let current=prepared.candidateRoot;for(const part of item.path.split('/')){current=path.join(current,part);if(fs.lstatSync(current).isSymbolicLink())throw new PythonAttention('PYTHON_SYMLINK');}const stat=fs.statSync(file);if(!stat.isFile()||stat.nlink>1||stat.size>4*1024*1024)throw new PythonAttention('PYTHON_FILE_LIMIT');const bytes=fs.readFileSync(file),sha256=hash(bytes);if(item.sha256!==sha256)throw new PythonAttention('CANDIDATE_CHANGED_DURING_VALIDATION');return [item.path,sha256];}).sort(([a],[b])=>a<b?-1:a>b?1:0);}
async function validatePython({taskDir,request,prepared,report,evidence,env,runner,pythonCandidates}={}){
  const changes=(prepared?.changes||[]).filter(item=>item?.path?.endsWith('.py'));
  if(!changes.length)return [];
  if(!Array.isArray(prepared.candidateFiles)||!prepared.candidateRoot)throw new PythonAttention('PYTHON_PLAN_INVALID');
  const chosen=(report?.checks||[]).filter(item=>KINDS.has(item?.kind));
  if(!chosen.length||chosen.length>12)throw new PythonAttention('PYTHON_TESTS_REQUIRED');
  const tests=[];
  for(const item of chosen){if(typeof item.path!=='string'||!TEST.test(item.path))throw new PythonAttention('PYTHON_TEST_PATH_INVALID');try{regular(prepared.candidateRoot,item.path);}catch(error){if(error instanceof PythonAttention)throw error;throw new PythonAttention('PYTHON_TEST_PATH_INVALID');}if(!tests.some(test=>test.kind===item.kind&&test.path===item.path))tests.push({kind:item.kind,path:item.path});}
  const folder=path.join(evidence||path.join(taskDir,'validation-evidence'),'python-'+crypto.randomBytes(6).toString('hex'));fs.mkdirSync(folder,{recursive:true});
  const clean=cleanEnvironment(env,folder),before=frozenFiles(prepared),files=[];
  for(const change of changes){if(change.kind==='delete'||change.deleted)throw new PythonAttention('DELETION_REVIEW_REQUIRED');const file=regular(prepared.candidateRoot,change.path),bytes=fs.readFileSync(file);rejectSecrets(bytes);
    const lines=rangesForChange({prepared,change,file,evidence:folder,env:clean,runner});files.push({path:change.path,sha256:hash(bytes),...lines});}
  const runtime=selectRuntime({prepared:{...prepared,pythonNeedsPytest:tests.some(item=>item.kind==='python_pytest')},request,evidence:folder,env:clean,runner,pythonCandidates});
  const manifest={version:1,task_id:request?.id||null,candidate_root:fs.realpathSync(prepared.candidateRoot),files,tests,
    candidate_files:before.map(([path,sha256])=>({path,sha256})),pytest_config:path.join(folder,'pytest.ini')};
  fs.writeFileSync(manifest.pytest_config,'[pytest]\n',{flag:'wx',mode:0o600});
  const manifestPath=path.join(folder,'manifest.json'),resultPath=path.join(folder,'result.json');fs.writeFileSync(manifestPath,JSON.stringify(manifest),{flag:'wx',mode:0o600});
  const executed=run(runtime.executable,['-I','-B',path.join(__dirname,'validation-python.py'),'--manifest',manifestPath,'--result',resultPath],prepared.candidateRoot,clean,runner);
  let result;try{if(fs.lstatSync(resultPath).isSymbolicLink()||fs.statSync(resultPath).size>8*1024*1024)throw new Error();result=JSON.parse(fs.readFileSync(resultPath,'utf8'));}catch{throw new PythonAttention('PYTHON_RESULT_UNAVAILABLE');}
  if(executed.status!==0||result.status!=='passed'){const code=/^[A-Z_]{3,80}$/.test(result.code||'')?result.code:'PYTHON_TESTS_FAILED';throw new PythonAttention(code);}
  if(result.version!==1||result.task_id!==manifest.task_id||result.manifest_sha256!==hash(fs.readFileSync(manifestPath))||!Array.isArray(result.tests)||!Array.isArray(result.coverage))throw new PythonAttention('PYTHON_RESULT_INVALID');
  if(JSON.stringify(frozenFiles(prepared))!==JSON.stringify(before))throw new PythonAttention('CANDIDATE_CHANGED_DURING_VALIDATION');
  if(result.tests.length!==tests.length||result.tests.some((entry,i)=>entry.path!==tests[i].path||entry.kind!==tests[i].kind||!(entry.tests>0)||entry.passed!==entry.tests||entry.failed!==0||entry.errors!==0||entry.skipped!==0||entry.expected_failures!==0||entry.unexpected_successes!==0))throw new PythonAttention('PYTHON_TESTS_FAILED_OR_INCOMPLETE');
  const syntax=files.map(item=>({kind:'python_syntax',path:item.path,passed:true,runtime:runtime.version}));
  return [...syntax,{kind:'python_tests',passed:true,runtime:runtime.version,executable:runtime.executable,frameworks:[...new Set(tests.map(item=>item.kind))],
    tests:result.tests.reduce((sum,item)=>sum+item.tests,0),pass:result.tests.reduce((sum,item)=>sum+item.passed,0),fail:0,skipped:0,
    paths:tests.map(item=>item.path),changedLinesExercised:result.coverage,evidence:resultPath,evidenceFingerprint:hash(fs.readFileSync(resultPath))}];
}
module.exports={validatePython,PythonAttention,runtimeCandidates,selectRuntime,cleanEnvironment,rangesForChange};
