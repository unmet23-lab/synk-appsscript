// Task-scoped release evidence. Uses Node's test runner; never touches live data.
import {readFile,writeFile,readdir,stat} from 'node:fs/promises';
import {globSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join,relative} from 'node:path';
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../../../..'),company='docs/마케팅/온라인마케팅지도/engagement/company';
const tests=['container-delivery','server','server-readiness','server-messenger','server-synk-identity','server-auth-race','workspace-navigation','workroom-practice-sync','workroom-practice-sync-client','workroom-practice-client','workroom-practice-backup','workspace-backup','backup'].map(name=>company+'/'+name+'.test.mjs');
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/^SYNK_|^MESSENGER_/.test(key)));
const paths=[company+'/Dockerfile',company+'/Dockerfile.dockerignore',company+'/server.mjs',...tests];
const hashes=async paths=>Object.fromEntries(await Promise.all(paths.map(async path=>[path,createHash('sha256').update(await readFile(join(root,path))).digest('hex')])));
const sources=new Set(paths);
for(const line of (await readFile(join(root,company,'Dockerfile'),'utf8')).split(/\r?\n/).filter(line=>line.startsWith('COPY '))){
  const args=JSON.parse(line.slice(5));args.pop();
  async function files(path){
    if((await stat(path)).isDirectory()){for(const child of await readdir(path))await files(join(path,child));}
    else sources.add(relative(root,path).replaceAll('\\','/'));
  }
  for(const spec of args)for(const path of globSync(spec,{cwd:root}))if(!/(?:\.test\.mjs$|\/verify-[^/]+\.mjs$|\/-?[^/]+-check\.mjs$)/.test(path.replaceAll('\\','/')))await files(join(root,path));
}
const checkedSources=[...sources].sort(),before=await hashes(checkedSources);let output='',failure=null;
try{output=(await promisify(execFile)(process.execPath,['--test',...tests],{cwd:root,env,timeout:60000,maxBuffer:4*1024*1024})).stdout;}
catch(error){output=error.stdout||'';failure={message:'One or more local regression tests failed',code:error.code};}
await writeFile(join(here,'release-tests.txt'),output);
const after=await hashes(checkedSources),changed=checkedSources.filter(path=>before[path]!==after[path]);
const count=label=>Number(output.match(new RegExp('(?:ℹ|#) '+label+' (\\d+)'))?.[1]||0);
const diagnostic=output.split(/\r?\n/).find(line=>line.startsWith('ℹ {"passed":'));
const deliveryChecks=diagnostic?JSON.parse(diagnostic.slice(2)):null;
const candidate={version:1,createdAt:new Date().toISOString(),description:'Current source payload for the local company-host deployment candidate; source hash manifest, not a built Docker image.',files:after};
await writeFile(join(here,'candidate-sources.json'),JSON.stringify(candidate,null,2)+'\n');
const report={version:1,createdAt:new Date().toISOString(),status:!failure&&count('fail')===0&&changed.length===0?'local-release-preparation-verified':'failed',runtime:process.version,tests:{total:count('tests'),passed:count('pass'),failed:count('fail'),output:'release-tests.txt',sha256:createHash('sha256').update(output).digest('hex'),changedDuringRun:changed},packaging:{dockerfile:company+'/Dockerfile',dockerCliAvailable:false,dockerBuildOrRunVerified:false,verification:'Actual Docker COPY sources and allowlist staged in a fresh directory; Node host started, synthetic HTTP login and private state save/read and source/asset requests passed.',checks:deliveryChecks?.passed??0,checkNames:deliveryChecks?.checks??[],sourceManifest:'candidate-sources.json',originalFailure:'ERR_MODULE_NOT_FOUND: atlas/work.js imported by crew-profile-service.mjs. Additional messenger/model/static JSON/source documents were absent.',mutableStorage:'Company DB and messenger DB are both beneath /data in the prepared Docker configuration.'},boundaries:{deployed:false,productionDatabaseWrites:0,actualServerRestarts:0,paidAiCalls:0,physicalDevicesTested:0,realCompanyAccountsTested:false},failure,sources:after};
await writeFile(join(here,'container-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,tests:report.tests,packagingChecks:report.packaging.checks,candidateFiles:Object.keys(candidate.files).length}));
if(report.status==='failed')process.exitCode=1;
