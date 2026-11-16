import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {loadOptionalFeature} from './optional-feature-modules.mjs';

async function sandbox(t,files={}){
  const root=await mkdtemp(join(tmpdir(),'synk-optional-feature-'));
  t.after(async()=>{
    assert.equal(dirname(resolve(root)),resolve(tmpdir()));
    assert.ok(root.includes('synk-optional-feature-'));
    await rm(root,{recursive:true,force:true});
  });
  for(const [name,body] of Object.entries(files))await writeFile(join(root,name),body);
  return pathToFileURL(join(root,'server.mjs'));
}
const modules=[{file:'./service.mjs',exports:['createService']},{file:'./routes.mjs',exports:['createRoutes']}];

test('a wholly unshipped feature is absent without importing or creating its state',async t=>{
  const base=await sandbox(t);
  assert.equal(await loadOptionalFeature('not-shipped',modules,base),null);
});
test('a partly installed feature stops startup instead of silently disappearing',async t=>{
  const base=await sandbox(t,{'service.mjs':'export function createService(){}'});
  await assert.rejects(loadOptionalFeature('partial',modules,base),/Incomplete optional feature: partial/);
});
test('a complete feature loads its real service and routes',async t=>{
  const base=await sandbox(t,{'service.mjs':'export function createService(){return 17}','routes.mjs':'export function createRoutes(){return 23}'});
  const loaded=await loadOptionalFeature('complete',modules,base);
  assert.equal(loaded[0].createService(),17);assert.equal(loaded[1].createRoutes(),23);
});
test('an installed feature with a missing or nonfunction export stops startup',async t=>{
  const base=await sandbox(t,{'service.mjs':'export const createService=7','routes.mjs':'export function createRoutes(){}'});
  await assert.rejects(loadOptionalFeature('invalid-export',modules,base),/Invalid optional feature export: invalid-export.createService/);
});
test('an error inside an installed module is preserved instead of treated as an absent feature',async t=>{
  const base=await sandbox(t,{'service.mjs':'throw new Error("installed-module-failed");export function createService(){}','routes.mjs':'export function createRoutes(){}'});
  await assert.rejects(loadOptionalFeature('broken-module',modules,base),/installed-module-failed/);
});

test('an installed backend without its required screen asset stops startup',async t=>{
  const base=await sandbox(t,{'service.mjs':'export function createService(){}','routes.mjs':'export function createRoutes(){}'});
  await assert.rejects(loadOptionalFeature('missing-screen',[...modules,{file:'./view.mjs',kind:'asset'}],base),/Incomplete optional feature/);
});
test('a screen asset without its backend is a partial installation',async t=>{
  const base=await sandbox(t,{'view.mjs':'export const view=1'});
  await assert.rejects(loadOptionalFeature('screen-only',[...modules,{file:'./view.mjs',kind:'asset'}],base),/Incomplete optional feature/);
});
test('a dangling module link stops startup instead of disabling the feature',async t=>{
  const base=await sandbox(t),root=dirname(fileURLToPath(base));
  // A Windows junction tests the same dangling-entry case without requiring administrator symlink privileges.
  await symlink(join(root,'missing-target.mjs'),join(root,'service.mjs'),process.platform==='win32'?'junction':'file');
  await assert.rejects(loadOptionalFeature('dangling',[modules[0]],base),error=>error.code==='ENOENT'||error.code==='ERR_MODULE_NOT_FOUND');
});
test('required screen assets are checked without executing them on the server',async t=>{
  const base=await sandbox(t,{'service.mjs':'export function createService(){}','routes.mjs':'export function createRoutes(){}','view.mjs':'throw new Error("browser-only-module")'});
  const loaded=await loadOptionalFeature('browser-asset',[...modules,{file:'./view.mjs',kind:'asset'}],base);
  assert.equal(typeof loaded[0].createService,'function');assert.equal(loaded[2],null);
});

test('the actual server works with all optional groups absent and rejects enabling an absent AI market',{timeout:65000},async()=>{
  const run=async function(){
    const {mock}=await import('node:test'),{default:assert}=await import('node:assert/strict');
    const {mkdtemp,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join,dirname,resolve}=await import('node:path');
    const {createServer}=await import('node:net');
    mock.module(new URL('./optional-feature-modules.mjs',process.argv[1]).href,{exports:{loadOptionalFeature:async()=>null}});
    const {createCompanyApp}=await import(process.argv[1]);
    process.env.SYNK_COMPANY_BACKGROUND_JOBS_ENABLED='1';process.env.SYNK_COMPANY_WORKROOM_SCHEDULE_ENABLED='1';
    const directory=await mkdtemp(join(tmpdir(),'synk-absent-server-')),probe=createServer();
    await new Promise(done=>probe.listen(0,'127.0.0.1',done));const port=probe.address().port;await new Promise(done=>probe.close(done));
    const options={dataDir:directory,port,allowTestHost:true,schedule:false,webPushEnabled:false,
      synkIdentityConfig:null,synkCustomerIdentityConfig:null,teachingConfig:null};
    let app;
    try{
      assert.throws(()=>createCompanyApp({...options,aiMarketEnabled:true}),/AI 마켓 기능 파일이 설치되지 않았습니다/);
      app=createCompanyApp({...options,aiMarketEnabled:false});
      assert.equal(app.socialInquiries,null);
      const password='synthetic-optional-group-password',user=app.store.createUser({name:'Synthetic operator',email:'absent@example.test',role:'admin',password});
      await app.start();const base='http://127.0.0.1:'+port;
      const login=await fetch(base+'/api/login',{method:'POST',headers:{Origin:base,'content-type':'application/json'},body:JSON.stringify({email:user.email,password})});
      assert.equal(login.status,200);const details=await login.json(),cookie=login.headers.get('set-cookie').split(';')[0];
      const request=async(path,method='GET',body)=>{
        const r=await fetch(base+path,{method,headers:{Origin:base,Cookie:cookie,'content-type':'application/json','x-csrf-token':details.csrfToken},...(body?{body:JSON.stringify(body)}:{})});
        await r.arrayBuffer();return r.status;
      };
      for(const path of ['/tip-shares.js','/tip-shares.css','/pulse-app/marketing-view.mjs','/ai-market/','/social-inquiry/status'])assert.equal(await request(path),404,path);
      assert.equal(await request('/api/tip-shares'),404);
      assert.equal(await request('/api/social/inquiries/configure','POST',{}),404);
      assert.equal(await request('/api/client-projects/missing/marketing','POST',{}),404);
      assert.equal(await request('/api/admin/member-directory/workspace','POST',{q:user.id,page:1,status:'all',type:'all',company:'all'}),200);
      assert.equal(await request('/api/social/workspace'),200);
      await app.scheduledTick();await app.waitForIdle();
      console.log('absent optional groups verified');
    }finally{
      await app?.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-absent-server-'));
      await rm(directory,{recursive:true,force:true});
    }
  };
  const result=await promisify(execFile)(process.execPath,['--experimental-test-module-mocks','--input-type=module','-e','('+run.toString()+')()',new URL('./server.mjs',import.meta.url).href],{encoding:'utf8',timeout:60000,maxBuffer:1024*1024});
  assert.match(result.stdout,/absent optional groups verified/);
});
