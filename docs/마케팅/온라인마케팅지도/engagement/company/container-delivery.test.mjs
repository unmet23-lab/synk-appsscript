import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,cp,mkdtemp,rm,readdir} from 'node:fs/promises';
import {globSync} from 'node:fs';
import {dirname,join,resolve,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const run=promisify(execFile),here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../../../../..');
const companyPath=relative(root,here).replaceAll('\\','/');
const unsafe=path=>/(?:^|\/)(?:data|node_modules|\.git|\.env(?:\.[^/]*)?)(?:\/|$)|\.(?:sqlite(?:-(?:wal|shm))?|key)$|(?:^|\/)(?:workspace-integration|drive-storage)\.json$/.test(path);
function globPattern(pattern){
  let regex='';
  for(let i=0;i<pattern.length;i++){
    const char=pattern[i];
    if(char==='*'){if(pattern[i+1]==='*'){regex+='.*';i++;}else regex+='[^/]*';}
    else if(char==='?')regex+='[^/]';
    else regex+=char.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  }
  return new RegExp('^'+regex+'$');
}
async function stageCopy(directory){
  const docker=await readFile(join(here,'Dockerfile'),'utf8');
  const rules=(await readFile(join(here,'Dockerfile.dockerignore'),'utf8')).split(/\r?\n/).map(s=>s.trim()).filter(s=>s&&!s.startsWith('#')).map(s=>({include:s.startsWith('!'),pattern:globPattern((s.startsWith('!')?s.slice(1):s).replace(/\/$/,''))}));
  const included=path=>{
    let keep=true;
    for(const rule of rules)if(rule.pattern.test(path))keep=rule.include;
    return keep;
  };
  const copied=[];
  for(const line of docker.split(/\r?\n/).filter(line=>line.startsWith('COPY '))){
    const text=line.slice(5),args=text.startsWith('[')?JSON.parse(text):text.trim().split(/\s+/),destination=args.pop();
    assert.ok(destination.startsWith('/workspace/'),'All source paths stay in the workspace');
    const dest=destination.slice('/workspace/'.length);
    for(const source of args){
      const matches=[...globSync(source,{cwd:root})];assert.ok(matches.length,'Missing COPY source: '+source);
      for(const match of matches){
        const path=match.replaceAll('\\','/'),entry=resolve(root,path);
        assert.ok(relative(root,entry)&&!relative(root,entry).startsWith('..'));
        const target=join(directory,dest,destination.endsWith('/')?path.split('/').at(-1):'');
        await mkdir(dirname(target),{recursive:true});
        await cp(entry,target,{recursive:true,filter:async path=>{
          const name=relative(root,path).replaceAll('\\','/');
          if(!included(name))return false;
          assert.ok(!unsafe(name),'Private runtime data must not enter the image: '+name);
          copied.push(name);return true;
        }});
      }
    }
  }
  return {docker,copied};
}

test('Docker COPY payload starts the company host and delivers SHIFT, messenger and current source documents',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'synk-company-container-'));
  try{
    const {copied}=await stageCopy(join(directory,'workspace'));
    assert.ok(copied.length>50);assert.ok(copied.every(path=>!unsafe(path)));
    const runner=join(directory,'verify.mjs');
    await writeFile(runner,`
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.argv[2],company=${JSON.stringify(companyPath)},checks=[];
const {createCompanyApp}=await import(pathToFileURL(join(root,company,'server.mjs')));
process.env.SYNK_COMPANY_DATA=process.argv[3];process.env.MESSENGER_DATA_DIR=join(process.argv[3],'messenger');
const app=createCompanyApp({port:0,allowTestHost:true,schedule:false,synkIdentityConfig:null});
try{
  const address=await app.start(),base='http://127.0.0.1:'+address.port;
  const member=app.store.createUser({name:'Packaging fixture',email:'delivery@example.test',role:'member',password:'packaging-fixture-password'});
  const admin=app.store.createUser({name:'Packaging admin',email:'admin@example.test',role:'admin',password:'packaging-fixture-password'});
  const check=(name,condition)=>{assert.ok(condition,name);checks.push(name);};
  check('both databases use the persistent data root',existsSync(join(process.argv[3],'company.sqlite'))&&existsSync(join(process.argv[3],'messenger','messenger.sqlite'))&&!existsSync(join(root,'tools/company-messenger/data')));
  const health=await fetch(base+'/api/health');check('host health',health.ok);
  check('anonymous record denied',(await fetch(base+'/api/workroom-practice/state')).status===401);
  const login=await fetch(base+'/api/login',{method:'POST',headers:{Origin:app.origin,'Content-Type':'application/json'},body:JSON.stringify({email:member.email,password:'packaging-fixture-password'})});
  check('company login',login.ok);const body=await login.json(),cookie=login.headers.get('set-cookie').split(';')[0];
  const response=await fetch(base+'/api/workroom-practice/state',{headers:{Cookie:cookie}}),initial=await response.json();
  check('private empty state',response.ok&&initial.revision===0&&initial.status==='empty');
  const engine=(await import(pathToFileURL(join(root,'atlas/personalization.js')))).default;
  const M=await import(pathToFileURL(join(root,'experiences/shift-workbench/model.mjs')));
  const scope={personId:member.id,productId:'company',contextId:'workroom-practice',domain:'SHIFT'};
  let state=M.startRun(M.newState(),{task:'meeting',goal:'work',minutes:10,support:'independent'},engine,new Date().toISOString(),scope);state.save=true;
  state=M.recordPracticeExposure(state,new Date().toISOString(),scope);state.run.draft='격리한 배포 묶음에서 작성한 가상 업무 결과';
  const saved=await fetch(base+'/api/workroom-practice/state',{method:'POST',headers:{Cookie:cookie,Origin:app.origin,'X-CSRF-Token':body.csrfToken,'Content-Type':'application/json'},body:JSON.stringify({action:'save',expectedRevision:0,activate:true,state})});
  check('validated account save',saved.ok&&(await saved.json()).revision===1);
  const stateAfter=await fetch(base+'/api/workroom-practice/state',{headers:{Cookie:cookie}});
  check('saved draft restored',(await stateAfter.json()).state.run.draft===state.run.draft);
  const guide=await fetch(base+'/api/company-guide',{headers:{Cookie:cookie}});check('company source API',guide.ok);
  const documents=(await guide.json()).documents;check('all 17 source documents',documents.length===17&&documents.every(row=>row.text&&!row.error));
  const creator=await fetch(base+'/api/creator-sources',{headers:{Cookie:cookie}});check('creator source API',creator.ok);
  const library=await creator.json();check('all approved creator assets available',library.assets.length===15&&library.assets.every(asset=>asset.available));
  const {CREATOR_SOURCE_FILES}=await import(pathToFileURL(join(root,company,'creator-sources.mjs')));
  for(const asset of CREATOR_SOURCE_FILES){const r=await fetch(base+'/api/creator-sources/assets/'+asset.id+'?download=1',{headers:{Cookie:cookie}});check('approved download '+asset.id,r.ok&&(await r.arrayBuffer()).byteLength>0&&/attachment/.test(r.headers.get('content-disposition')));}
  check('anonymous private creator download denied',(await fetch(base+'/api/creator-sources/assets/synk-paper-vector?download=1')).status===401);
  const workroom=await fetch(base+'/api/workroom-guide',{headers:{Cookie:cookie}});check('workroom guide API',workroom.ok);
  for(const source of (await workroom.json()).sources){
    const r=await fetch(base+'/api/workroom-source/'+encodeURIComponent(source.id),{headers:{Cookie:cookie}});
    check('workroom source '+source.id,r.ok&&(await r.json()).text.length>0);
  }
  for(const path of ['/', '/workroom-practice.js','/workroom-practice-sync.js','/workroom-practice/model.mjs','/workroom-practice/storage-upgrade.mjs','/workroom-practice/core.js','/workroom-practice/domain.js','/workroom-practice/temper-outcomes.js','/workroom-practice/personalization.js','/messenger/','/messenger/app.js','/messenger/styles.css','/atlas-lab/','/atlas-lab/model-host.mjs','/learning-hub/atlas-learning.js','/learning-hub/assets/scrapbook.css','/consult/core/interpretation.js','/consult/computer/content.js','/consult/computer/rules.js','/order-rush/learning.mjs','/korean-rhythm/core.mjs','/font.woff2','/brand-logo.svg','/messenger/assets/felt-ui/chip-blush-long.webp']){
    const r=await fetch(base+path,{headers:{Cookie:cookie}});check('asset '+path,r.ok&&(await r.arrayBuffer()).byteLength>0);
  }
  const adminLogin=await fetch(base+'/api/login',{method:'POST',headers:{Origin:app.origin,'Content-Type':'application/json'},body:JSON.stringify({email:admin.email,password:'packaging-fixture-password'})});
  const adminCookie=adminLogin.headers.get('set-cookie').split(';')[0];
  for(const path of ['/api/content-benchmarks/research-prompt','/api/content-benchmarks/template']){const r=await fetch(base+path,{headers:{Cookie:adminCookie}});check('admin source '+path,r.ok);}
  console.log(JSON.stringify({passed:checks.length,checks}));
}finally{await app.stop();}
`);
    const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/^SYNK_|^MESSENGER_/.test(key)));
    const {stdout}=await run(process.execPath,[runner,join(directory,'workspace'),join(directory,'data')],{env,maxBuffer:2*1024*1024,timeout:30000});
    const result=JSON.parse(stdout.trim());assert.ok(result.passed>30);t.diagnostic(JSON.stringify(result));
  }finally{
    const target=resolve(directory);assert.ok(target.startsWith(resolve(tmpdir())+sep)&&target.split(sep).at(-1).startsWith('synk-company-container-'));
    await rm(target,{recursive:true,force:true});
  }
});

test('Docker keeps both mutable databases on the persistent data volume',async()=>{
  const docker=await readFile(join(here,'Dockerfile'),'utf8');
  assert.match(docker,/MESSENGER_DATA_DIR=\/data\/messenger/);
  assert.match(docker,/USER node/);
  assert.match(docker,/SYNK_COMPANY_DATA=\/data/);
});
