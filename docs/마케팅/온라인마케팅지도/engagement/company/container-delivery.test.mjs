import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,cp,mkdtemp,rm,readdir,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {globSync} from 'node:fs';
import {dirname,join,resolve,relative,sep,posix} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const run=promisify(execFile),here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../../../../..');
const companyPath=relative(root,here).replaceAll('\\','/');
const unsafe=path=>/(?:^|\/)(?:data|node_modules|\.git|\.env(?:\.[^/]*)?)(?:\/|$)|\.(?:sqlite(?:-(?:wal|shm))?|key)$|(?:^|\/)(?:workspace-integration|drive-storage)\.json$/.test(path);
const dependencyCopies=[
  {stage:'synk-ffmpeg-build',sources:['/opt/synk-ffmpeg/bin/ffmpeg'],destination:'/usr/local/bin/ffmpeg'},
  {stage:'synk-ffmpeg-build',sources:['/opt/synk-ffmpeg/bin/ffprobe'],destination:'/usr/local/bin/ffprobe'},
  {stage:'synk-ffmpeg-build',sources:['/opt/synk-ffmpeg/share/'],destination:'/usr/local/share/synk-ffmpeg/'}
];
function sourceCopies(docker){
  const sources=[],dependencies=[];
  for(const line of docker.split(/\r?\n/).map(value=>value.trim()).filter(value=>/^COPY\s/.test(value))){
    const text=line.replace(/^COPY\s+/,''),stage=/^--from=([^\s]+)\s+(.+)$/.exec(text);
    const value=stage?stage[2]:text;
    assert.ok(stage||value.startsWith('['),'Application COPY must use the JSON allowlist');
    const args=value.startsWith('[')?JSON.parse(value):value.split(/\s+/);
    assert.ok(Array.isArray(args)&&args.length>=2&&args.every(arg=>typeof arg==='string'&&arg.length),'COPY requires source paths and a destination');
    const destination=args.at(-1),row={sources:args.slice(0,-1),destination};
    if(stage){dependencies.push({stage:stage[1],...row});continue;}
    assert.ok(destination.startsWith('/workspace/')&&posix.normalize(destination).startsWith('/workspace/'),'All source paths stay in the workspace');
    assert.ok(row.sources.every(source=>!posix.isAbsolute(source)&&!source.split('/').includes('..')&&!unsafe(source)),'Private or escaping COPY source');
    sources.push(row);
  }
  assert.deepEqual(dependencies,dependencyCopies,'Only the three reviewed FFmpeg dependency copies are allowed');
  return sources;
}
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
  const docker=await readFile(join(here,'Dockerfile'),'utf8'),dockerignore=await readFile(join(here,'Dockerfile.dockerignore'),'utf8');
  const rules=dockerignore.split(/\r?\n/).map(s=>s.trim()).filter(s=>s&&!s.startsWith('#')).map(s=>({include:s.startsWith('!'),pattern:globPattern((s.startsWith('!')?s.slice(1):s).replace(/\/$/,''))}));
  const included=path=>{
    let keep=true;
    for(const rule of rules)if(rule.pattern.test(path))keep=rule.include;
    return keep;
  };
  const copied=[];
  for(const {sources:args,destination} of sourceCopies(docker)){
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
  return {docker,dockerignore,copied};
}

test('Docker COPY parser validates exact build-stage dependencies and retains source boundaries',()=>{
  const dependencies=dependencyCopies.map(row=>'COPY --from='+row.stage+' '+[...row.sources,row.destination].join(' '));
  const application='COPY ["app/server.mjs","/workspace/app/server.mjs"]',docker=[...dependencies,application].join('\n');
  assert.deepEqual(sourceCopies(docker),[{sources:['app/server.mjs'],destination:'/workspace/app/server.mjs'}]);
  for(const changed of [
    dependencies.slice(1).join('\n')+'\n'+application,
    docker+'\n'+dependencies[0],
    docker.replace('--from=synk-ffmpeg-build','--from=unreviewed-image'),
    docker.replace('/opt/synk-ffmpeg/bin/ffmpeg','/opt/synk-ffmpeg/bin/other'),
    docker.replace('/usr/local/bin/ffmpeg','/usr/local/bin/other'),
    docker.replace('COPY --from=','COPY --chown=0:0 --from='),
    docker.replace('/workspace/app/server.mjs','/data/server.mjs'),
    docker.replace('/workspace/app/server.mjs','/workspace/../data/server.mjs'),
    docker.replace('app/server.mjs','../server.mjs'),
    docker.replace('app/server.mjs','data/company.sqlite')
  ])assert.throws(()=>sourceCopies(changed));
});

test('Docker static COPY allowlist contains the complete local server import graph',async t=>{
  const docker=await readFile(join(here,'Dockerfile'),'utf8'),ignore=await readFile(join(here,'Dockerfile.dockerignore'),'utf8');
  const rules=ignore.split(/\r?\n/).map(value=>value.trim()).filter(value=>value&&!value.startsWith('#')).map(value=>({include:value.startsWith('!'),pattern:globPattern((value.startsWith('!')?value.slice(1):value).replace(/\/$/,''))}));
  const included=path=>{let keep=true;for(const rule of rules)if(rule.pattern.test(path))keep=rule.include;return keep;};
  const payload=new Map();
  for(const {sources:args,destination} of sourceCopies(docker)){
    for(const source of args){const matches=[...globSync(source,{cwd:root})];assert.ok(matches.length,'Missing COPY source: '+source);for(const match of matches){
      const sourcePath=match.replaceAll('\\','/'),entry=join(root,match),info=await lstat(entry),target=posix.join(destination.slice('/workspace/'.length),destination.endsWith('/')?posix.basename(sourcePath):'');
      if(info.isFile()){if(included(sourcePath))payload.set(target,sourcePath);continue;}
      if(!included(sourcePath))continue;
      for(const child of await readdir(entry,{recursive:true})){
        const full=join(entry,child),file=posix.join(sourcePath,child.replaceAll('\\','/'));
        if((await lstat(full)).isFile()&&included(file))payload.set(posix.join(target,child.replaceAll('\\','/')),file);
      }
    }
    }
  }
  const queue=[companyPath+'/server.mjs'],visited=new Set(),missing=[];
  // Resolve relative imports against their path inside the image, not against
  // the developer checkout where an accidentally omitted module still exists.
  while(queue.length){
    const imagePath=queue.pop();if(visited.has(imagePath))continue;visited.add(imagePath);
    const source=payload.get(imagePath);if(!source){missing.push(imagePath);continue;}
    if(!/\.[cm]?js$/.test(source))continue;
    const code=await readFile(join(root,source),'utf8');
    const imports=[...code.matchAll(/(?:\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?|\b(?:import|require)\s*\(\s*)['"]([^'"\r\n]+)['"]/g)].map(match=>match[1]).filter(specifier=>specifier.startsWith('.'));
    for(const specifier of imports){
      const base=posix.normalize(posix.join(posix.dirname(imagePath),specifier));
      const dependency=[base,base+'.js',base+'.json',base+'/index.js'].find(candidate=>payload.has(candidate))||base;
      if(!payload.has(dependency))missing.push(imagePath+' -> '+dependency);else queue.push(dependency);
    }
  }
  assert.deepEqual(missing,[],'Docker COPY or dockerignore omitted a runtime dependency');
  assert.ok(visited.has('tools/company-messenger/productivity-service.mjs'),'Productivity service must be reached through the real messenger import');
  assert.ok(visited.has('tools/company-messenger/web-push-service.mjs'),'Web push must be reached through the real company import');
  for(const name of ['client-workflow.mjs','client-notifications.mjs','assistant-productivity.mjs','publication-link-check.mjs','client-delivery-check.mjs','client-completion-records-render.mjs','client-delivery-archive.mjs','client-rights-reminders.mjs','client-material-usage.mjs'])assert.ok(visited.has(companyPath+'/'+name),name+' must be reached through the real company import');
  for(const name of ['pdfkit.cjs','SUIT-Regular.otf','SUIT-OFL.txt','THIRD-PARTY-LICENSES.txt'])assert.ok(payload.has(companyPath+'/vendor/completion-pdf/'+name),name+' must be present in the PDF runtime payload');
  for(const name of ['device-notifications.js','device-notifications.css','notification-sw.js','client-delivery-archive.js','client-delivery-archive.css','client-material-usage.js','client-material-usage.css','client-rights.js','automation-health.js'])assert.ok(payload.has(companyPath+'/public/'+name),name+' must be present in the copied browser payload');
  t.diagnostic(`Pure file-read verification: ${payload.size} image files, ${visited.size} transitive runtime imports; no image build, server or database was started.`);
});

test('Docker COPY payload starts the company host and delivers SHIFT, messenger and current source documents',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'synk-company-container-'));
  try{
    const payload=join(directory,'workspace');
    const {copied,docker,dockerignore}=await stageCopy(payload);
    assert.ok(copied.length>50);assert.ok(copied.every(path=>!unsafe(path)));
    assert.ok(copied.every(path=>posix.dirname(path)!==companyPath||!/^preview-[^/]+\.mjs$/.test(posix.basename(path))),'Company-root local preview launchers must not enter the runtime image');
    const runner=join(directory,'verify.mjs');
    await writeFile(runner,`
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const root=process.argv[2],company=${JSON.stringify(companyPath)},checks=[];
const {createCompanyApp}=await import(pathToFileURL(join(root,company,'server.mjs')));
process.env.SYNK_COMPANY_DATA=process.argv[3];process.env.MESSENGER_DATA_DIR=join(process.argv[3],'messenger');
const app=createCompanyApp({port:0,allowTestHost:true,schedule:false,synkIdentityConfig:null,synkCustomerIdentityConfig:null});
try{
  const address=await app.start(),base='http://127.0.0.1:'+address.port;
  const member=app.store.createUser({name:'Packaging fixture',email:'delivery@example.test',role:'member',password:'packaging-fixture-password'});
  const admin=app.store.createUser({name:'Packaging admin',email:'admin@example.test',role:'admin',password:'packaging-fixture-password'});
  const check=(name,condition)=>{assert.ok(condition,name);checks.push(name);};
  check('both databases use the persistent data root',existsSync(join(process.argv[3],'company.sqlite'))&&existsSync(join(process.argv[3],'messenger','messenger.sqlite'))&&!existsSync(join(root,'tools/company-messenger/data')));
  const health=await fetch(base+'/api/health');check('host health',health.ok);
  const probe=await promisify(execFile)(process.execPath,[join(root,company,'deploy/healthcheck.mjs')],{env:{...process.env,SYNK_COMPANY_ORIGIN:app.origin,SYNK_COMPANY_PORT:String(address.port)},timeout:5000});
  check('container readiness command runs from the copied payload',probe.stdout.trim()==='SYNK company health: ready');
  const discovery=await import(pathToFileURL(join(root,'experiences/atlas-lab/discovery.mjs')));
  check('Atlas discovery imports its region vocabulary from the image',typeof discovery.createDiscoveryAdapter==='function');
  const regionAsset=await fetch(base+'/atlas-lab/meeting-regions.mjs');
  check('Atlas region vocabulary is served to the browser',regionAsset.ok&&/MEETING_REGION_VERSION/.test(await regionAsset.text()));
  for(const path of ['/consultation/','/consultation/customer-computer.js','/consultation/customer-computer-state.mjs','/consultation/customer-computer.css','/consultation/consultation.mjs','/consultation/interpretation.mjs','/consultation/model-host.mjs','/consultation/core/domain.js','/consultation/core/interpretation.js','/consultation/core/ask.js','/consultation/computer/content.js','/consultation/computer/rules.js','/consultation/assets/scrapbook.css','/consultation/assets/SUIT-Variable.woff2','/consultation/assets/laptop-felt.webp','/consultation/assets/fb-tile-cream-long.webp','/consultation/assets/fb-tile-butter-long.webp','/consultation/assets/fb-slab-black-long.webp']){
    const r=await fetch(base+path);check('public customer asset '+path,r.ok&&(await r.arrayBuffer()).byteLength>0);
  }
  check('anonymous customer draft denied',(await fetch(base+'/api/customer/computer-draft')).status===401);
  check('anonymous record denied',(await fetch(base+'/api/workroom-practice/state')).status===401);
  const login=await fetch(base+'/api/login',{method:'POST',headers:{Origin:app.origin,'Content-Type':'application/json'},body:JSON.stringify({email:member.email,password:'packaging-fixture-password'})});
  check('company login',login.ok);const body=await login.json(),cookie=login.headers.get('set-cookie').split(';')[0];
  check('employee cookie does not authenticate a customer',(await(await fetch(base+'/api/customer/me',{headers:{Cookie:cookie}})).json()).authenticated===false);
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
  for(const path of ['/', '/workroom-practice.js','/workroom-practice-sync.js','/workroom-practice/model.mjs','/workroom-practice/storage-upgrade.mjs','/workroom-practice/core.js','/workroom-practice/domain.js','/workroom-practice/temper-outcomes.js','/workroom-practice/personalization.js','/messenger/','/messenger/app.js','/messenger/styles.css','/signal.css','/messenger/signal.css','/teacher-world/signal.css','/atlas-lab/','/atlas-lab/model-host.mjs','/learning-hub/atlas-learning.js','/learning-hub/assets/scrapbook.css','/consult/core/interpretation.js','/consult/computer/content.js','/consult/computer/rules.js','/order-rush/learning.mjs','/korean-rhythm/core.mjs','/font.woff2','/brand-logo.svg','/messenger/assets/felt-ui/chip-blush-long.webp']){
    const r=await fetch(base+path,{headers:{Cookie:cookie}});check('asset '+path,r.ok&&(await r.arrayBuffer()).byteLength>0);
  }
  const adminLogin=await fetch(base+'/api/login',{method:'POST',headers:{Origin:app.origin,'Content-Type':'application/json'},body:JSON.stringify({email:admin.email,password:'packaging-fixture-password'})});
  const adminCookie=adminLogin.headers.get('set-cookie').split(';')[0];
  for(const path of ['/api/content-benchmarks/research-prompt','/api/content-benchmarks/template']){const r=await fetch(base+path,{headers:{Cookie:adminCookie}});check('admin source '+path,r.ok);}
  for(const path of ['/client-projects.js','/client-projects.css','/client-delivery-archive.js','/client-delivery-archive.css','/client-material-usage.js','/client-material-usage.css','/client-rights.js','/automation-health.js','/brand-quality.js','/brand-quality.css','/pulse/','/pulse/lounge.js','/pulse/lounge.css']){const r=await fetch(base+path);check('brand experience packaged asset '+path,r.ok&&(await r.arrayBuffer()).byteLength>0);}
  const brand=await fetch(base+'/api/brand-quality',{headers:{Cookie:cookie}}),brandData=await brand.json();
  check('packaged brand workspace includes approved source links and six checks',brand.ok&&brandData.sources.length===15&&brandData.checks.length===6);
  const jsonHeaders={Cookie:cookie,Origin:app.origin,'X-CSRF-Token':body.csrfToken,'Content-Type':'application/json'};
  const savedRecipe=await fetch(base+'/api/brand-quality/recipes',{method:'POST',headers:jsonHeaders,body:JSON.stringify({title:'Container recipe',purpose:'Verify the shipped template API',format:'Web',sourceIds:['pulse-felt'],version:{label:'v1',body:'Approved source and usage'}})});
  check('packaged recipe persists immutable first version',savedRecipe.status===201&&(await savedRecipe.json()).recipe.versions.length===1);
  const savedOperation=await fetch(base+'/api/brand-quality/operations',{method:'POST',headers:jsonHeaders,body:JSON.stringify({title:'Container operation'})});
  check('packaged operation starts with six unverified checks',savedOperation.status===201&&(await savedOperation.json()).operation.counts.unverified===6);
  const savedProject=await fetch(base+'/api/client-projects',{method:'POST',headers:jsonHeaders,body:JSON.stringify({title:'Container client project',customerName:'Synthetic client',internalNotes:'PRIVATE PACKAGING NOTE'})}),project=await savedProject.json();
  check('packaged client project save',savedProject.status===201&&project.project.id);
  const invitation=await fetch(base+'/api/client-projects/'+project.project.id+'/invite',{method:'POST',headers:jsonHeaders,body:JSON.stringify({revision:project.project.revision})}),invited=await invitation.json();
  check('packaged customer invitation',invitation.ok&&invited.invite);
  const lounge=await fetch(base+'/pulse/api/open',{method:'POST',headers:{Origin:app.origin,'Content-Type':'application/json'},body:JSON.stringify({invite:invited.invite})}),loungeData=await lounge.json();
  check('packaged isolated customer view omits internal project fields',lounge.ok&&loungeData.project.title==='Container client project'&&!Object.hasOwn(loungeData.project,'internalNotes'));
  const recordsPath='/api/client-projects/'+project.project.id+'/completion-records',recordPreview=await fetch(base+recordsPath,{headers:{Cookie:cookie}}),recordReport=await recordPreview.json();
  check('packaged completion record preview omits private project memo',recordPreview.ok&&recordReport.schema===1&&!JSON.stringify(recordReport).includes('PRIVATE PACKAGING NOTE'));
  for(const format of ['pdf','csv']){
    const output=await fetch(base+recordsPath,{method:'POST',headers:jsonHeaders,body:JSON.stringify({format,fingerprint:recordReport.fingerprint})}),bytes=Buffer.from(await output.arrayBuffer());
    check('packaged completion '+format+' download',output.ok&&/attachment/.test(output.headers.get('content-disposition'))&&(format==='pdf'?bytes.subarray(0,5).toString()==='%PDF-':bytes.subarray(0,3).equals(Buffer.from([239,187,191]))));
  }
  check('packaged verified intake receiver dependency',existsSync(join(root,'docs/마케팅/클라이언트_발주서_20260930/receiver/sync.cjs')));
  console.log(JSON.stringify({passed:checks.length,checks}));
}finally{await app.stop();}
`);
    const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/^SYNK_|^MESSENGER_/.test(key)));
    const {stdout}=await run(process.execPath,[runner,join(directory,'workspace'),join(directory,'data')],{env,maxBuffer:2*1024*1024,timeout:30000});
    const result=JSON.parse(stdout.trim());assert.ok(result.passed>30);t.diagnostic(JSON.stringify(result));
    if(process.env.SYNK_CONTAINER_QA_OUTPUT||process.env.SYNK_CONTAINER_RELEASE_DIR){
      const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),files=[];
      for(const name of (await readdir(payload,{recursive:true})).sort()){
        const file=join(payload,name);if(!(await lstat(file)).isFile())continue;
        const bytes=await readFile(file),source=relative(payload,file).replaceAll('\\','/');
        files.push({source,bytes:bytes.length,sha256:hash(bytes),currentSourceSHA256:hash(await readFile(join(root,source)))});
      }
      const manifest={at:new Date().toISOString(),checks:result.passed,files,sourceChangedDuringRun:files.filter(file=>file.sha256!==file.currentSourceSHA256).map(file=>file.source),dockerfileSHA256:hash(docker),dockerignoreSHA256:hash(dockerignore),includesRuntimeData:false};
      if(process.env.SYNK_CONTAINER_QA_OUTPUT){const output=resolve(process.env.SYNK_CONTAINER_QA_OUTPUT);await mkdir(output,{recursive:true});await writeFile(join(output,'container-payload.json'),JSON.stringify(manifest,null,2)+'\n');}
      if(process.env.SYNK_CONTAINER_RELEASE_DIR){
        assert.deepEqual(manifest.sourceChangedDuringRun,[],'Source changed while validating the release candidate');
        assert.equal(await readFile(join(here,'Dockerfile'),'utf8'),docker,'Dockerfile changed while staging');
        assert.equal(await readFile(join(here,'Dockerfile.dockerignore'),'utf8'),dockerignore,'Docker allowlist changed while staging');
        const output=resolve(process.env.SYNK_CONTAINER_RELEASE_DIR);
        assert.ok(!output.startsWith(resolve(directory)+sep),'Persistent release candidate must be outside temporary QA cleanup');
        await mkdir(dirname(output),{recursive:true});await mkdir(output); // Refuse to overwrite any existing candidate.
        await cp(payload,join(output,'workspace'),{recursive:true,errorOnExist:true,force:false});
        for(const file of files)assert.equal(hash(await readFile(join(output,'workspace',file.source))),file.sha256,'Exported payload differs: '+file.source);
        await writeFile(join(output,'Dockerfile'),docker,{flag:'wx'});await writeFile(join(output,'Dockerfile.dockerignore'),dockerignore,{flag:'wx'});
        await writeFile(join(output,'payload-manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
        await writeFile(join(output,'verification.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
        await writeFile(join(output,'COMPLETE'),'Validated source payload only. Runtime databases, secrets and synthetic QA data are excluded.\n',{flag:'wx'});
      }
    }
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
