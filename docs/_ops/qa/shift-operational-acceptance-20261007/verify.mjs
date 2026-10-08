// Task-scoped regression and source snapshot; no operating server/data access.
import {readFile,writeFile,readdir,stat} from 'node:fs/promises';
import {globSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join,relative} from 'node:path';
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../../../..'),company='docs/마케팅/온라인마케팅지도/engagement/company';
const tests=['container-delivery','server','server-readiness','server-messenger','server-synk-identity','server-auth-race','workspace-navigation','workroom-practice-sync','workroom-practice-sync-client','workroom-practice-client','workroom-practice-backup','workspace-backup','backup','store-recovery-key','store-performance','workspace-restore-acceptance'].map(name=>company+'/'+name+'.test.mjs');
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/^SYNK_|^MESSENGER_/.test(key)));
const sources=new Set([company+'/Dockerfile',company+'/Dockerfile.dockerignore',...tests]);
const excluded=path=>/(?:\.test\.mjs$|\/verify-[^/]+\.mjs$|\/[^/]+-check\.mjs$)/.test(path.replaceAll('\\','/'));
for(const line of (await readFile(join(root,company,'Dockerfile'),'utf8')).split(/\r?\n/).filter(line=>line.startsWith('COPY '))){
  const args=JSON.parse(line.slice(5));args.pop();
  async function files(path){
    if(excluded(path))return;
    if((await stat(path)).isDirectory())for(const child of await readdir(path))await files(join(path,child));
    else sources.add(relative(root,path).replaceAll('\\','/'));
  }
  for(const spec of args)for(const path of globSync(spec,{cwd:root}))await files(join(root,path));
}
const sha=async path=>createHash('sha256').update(await readFile(join(root,path))).digest('hex');
const hashes=async()=>Object.fromEntries(await Promise.all([...sources].sort().map(async path=>[path,await sha(path)])));
const before=await hashes();let output='',failure=null;
try{output=(await promisify(execFile)(process.execPath,['--test','--test-concurrency=4',...tests],{cwd:root,env,timeout:180000,maxBuffer:4*1024*1024})).stdout;}
catch(error){output=error.stdout||'';failure={code:error.code,killed:Boolean(error.killed),signal:error.signal||null,message:'One or more task-scoped tests failed or did not finish.'};}
await writeFile(join(here,'tests.txt'),output);
const after=await hashes(),changed=Object.keys(before).filter(path=>before[path]!==after[path]);
const count=label=>Number(output.match(new RegExp('(?:ℹ|#) '+label+' (\\d+)'))?.[1]||0);
const diagnostic=output.split(/\r?\n/).find(line=>line.startsWith('ℹ {"passed":'));
const packaging=diagnostic?JSON.parse(diagnostic.slice(2)):null;
const report={version:1,createdAt:new Date().toISOString(),status:!failure&&count('tests')>0&&count('fail')===0&&changed.length===0?'local-host-recovery-and-packaging-verified':'failed',runtime:process.version,tests:{total:count('tests'),passed:count('pass'),failed:count('fail'),output:'tests.txt',sha256:createHash('sha256').update(output).digest('hex')},stagedNodeHost:{passed:packaging?.passed??0,checks:packaging?.checks??[],dockerBuildAndRun:false},sourceChangesDuringRun:changed,sources:after,boundaries:{syntheticDataOnly:true,operatingDatabaseWrites:0,operatingServerRestarts:0,paidAiCalls:0,externalDeployments:0,realCustomerChecks:0,physicalDeviceChecks:0},failure};
await writeFile(join(here,'candidate-sources.json'),JSON.stringify({version:1,createdAt:report.createdAt,description:'Current local source snapshot, not a built Docker image.',files:after},null,2)+'\n');
await writeFile(join(here,'tests-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,tests:report.tests,packagingChecks:report.stagedNodeHost.passed,candidateFiles:Object.keys(after).length,changed}));
if(report.status==='failed')process.exitCode=1;
