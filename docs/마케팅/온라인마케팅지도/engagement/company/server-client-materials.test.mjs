import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,unlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createCompanyApp} from './server.mjs';

async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-materials-api-')),app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,backgroundJobsEnabled:false,automationHealthSchedule:false,clock:()=> '2026-10-12T01:00:00.000Z'});
  await app.start();const base=`http://127.0.0.1:${app.server.address().port}`,users={},sessions={};
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-materials-api-'));await rm(directory,{recursive:true,force:true});});
  for(const name of ['owner','other','viewer']){users[name]=app.store.createUser({name,email:name+'@materials-api.test',role:name==='viewer'?'viewer':'member',teamId:name==='other'?'b':'a'});sessions[name]=app.store.mint('session',users[name].id,{csrfToken:'materials-api'},30);}
  const project=app.clientProjects.save(users.owner,{title:'자료 모아보기 API 합성 프로젝트',customerName:'합성 고객',internalNotes:'PRIVATE-API-MEMO'}).project;
  const read=()=>app.store.get('clientProjects',project.id),path=`/api/client-projects/${project.id}/materials`;
  async function api(name,method='GET',headers={},url=path){const response=await fetch(base+url,{method,headers:{...(name?{Cookie:'synk_company_session='+sessions[name]}:{}),...(method==='POST'?{Origin:app.origin,'Content-Type':'application/json','X-CSRF-Token':'materials-api'}:{}),...headers},...(method==='POST'?{body:'{}'}:{})});const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}return {status:response.status,data,headers:response.headers};}
  return {directory,app,api,users,read,id:project.id,path};
}

test('materials HTTP GET is fresh, no-store, read only and available to same-team viewers',async t=>{
  const f=await fixture(t),before=JSON.stringify(f.read()),response=await f.api('owner');assert.equal(response.status,200);assert.equal(response.data.projectId,f.id);assert.equal(response.data.revision,f.read().revision);assert.match(response.headers.get('cache-control'),/no-store/);assert.doesNotMatch(JSON.stringify(response.data),/PRIVATE/);assert.equal(response.data.groups.length,4);assert.deepEqual(response.data.items,[]);
  assert.equal((await f.api('viewer')).status,200);assert.equal(JSON.stringify(f.read()),before);assert.deepEqual(f.app.store.all('clientMaterials'),[]);
  f.app.clientProjects.message(f.users.owner,f.id,{revision:f.read().revision,text:'PRIVATE-NEW-MEMO',visibility:'internal'});const next=await f.api('owner');assert.equal(next.data.revision,response.data.revision+1);assert.deepEqual(next.data.items,response.data.items);
});

test('HTTP rechecks identity, revoked permissions and removed project before exposing file metadata',async t=>{
  const f=await fixture(t);assert.equal((await f.api(null)).status,401);assert.equal((await f.api('other')).status,404);
  f.app.store.put('users',f.users.viewer.id,{...f.users.viewer,teamId:'other'});assert.equal((await f.api('viewer')).status,404);
  f.app.store.put('users',f.users.owner.id,{...f.users.owner,active:false});assert.equal((await f.api('owner')).status,401);f.app.store.put('users',f.users.owner.id,f.users.owner);
  f.app.store.remove('clientProjects',f.id);assert.equal((await f.api('owner')).status,404);
});

test('customer sessions and invitation tokens cannot access staff materials index',async t=>{
  const f=await fixture(t),invitation=f.app.clientProjects.invite(f.users.owner,f.id,{revision:f.read().revision}),customer=f.app.clientProjects.open(invitation.invite),before=JSON.stringify(f.read());
  assert.equal((await f.api(null,'GET',{Cookie:'synk_pulse_session='+customer.session})).status,401);assert.equal((await f.api(null,'GET',{Cookie:'synk_company_session='+customer.session})).status,401);assert.equal((await f.api(null,'GET',{Authorization:'Bearer '+invitation.invite})).status,401);assert.equal(JSON.stringify(f.read()),before);
});

test('no materials mutation or outbound customer message route is added',async t=>{
  const f=await fixture(t),before=JSON.stringify(f.read()),response=await f.api('owner','POST');assert.notEqual(response.status,200);assert.equal(JSON.stringify(f.read()),before);assert.equal(f.read().messages.length,0);
});

test('returned intake link serves its original bytes under ACL and disappears after file deletion',async t=>{
  const f=await fixture(t),id=randomUUID(),bytes=Buffer.from('synthetic original attachment'),file={id,kind:'attachment',diskName:id+'.intake',fileName:'자료.txt',mimeType:'text/plain',byteSize:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};await mkdir(join(f.directory,'studio-media'),{recursive:true});await writeFile(join(f.directory,'studio-media',file.diskName),bytes);const row=f.read();row.intake={files:[file]};f.app.store.put('clientProjects',row.id,row);
  const before=JSON.stringify(f.read()),index=await f.api('owner'),url=index.data.items[0].openUrl;assert.ok(url);const opened=await f.api('owner','GET',{},url);assert.equal(opened.status,200);assert.equal(opened.data,bytes.toString());assert.equal((await f.api('other','GET',{},url)).status,404);assert.equal((await f.api(null,'GET',{},url)).status,401);assert.equal(JSON.stringify(f.read()),before);
  await unlink(join(f.directory,'studio-media',file.diskName));const next=await f.api('owner');assert.equal(next.data.items[0].status,'unavailable');assert.equal(next.data.items[0].openUrl,'');assert.equal(next.data.items[0].downloadUrl,'');assert.equal((await f.api('owner','GET',{},url)).status,404);
});

test('existing studio and delivered-media routes serve index links without new storage copies',async t=>{
  const f=await fixture(t),bytes=Buffer.from([137,80,78,71,13,10,26,10]),assetId=randomUUID(),mediaId=randomUUID(),asset={id:assetId,diskName:assetId+'.png',fileName:'고객 로고.png',mimeType:'image/png',byteSize:bytes.length,author:'customer'},media={...asset,id:mediaId,diskName:mediaId+'.png',fileName:'시안.png'};await mkdir(join(f.directory,'studio-media'),{recursive:true});for(const file of [asset,media])await writeFile(join(f.directory,'studio-media',file.diskName),bytes);
  const row=f.read();row.studio={schemaVersion:1,assets:[asset],references:[],concepts:[],scenes:[],history:[]};row.versions=[{id:randomUUID(),kind:'preview',label:'현재 시안',media,createdAt:'2026-10-12T01:00:00.000Z'}];f.app.store.put('clientProjects',row.id,row);
  const index=await f.api('owner');assert.equal(index.data.items.length,2);for(const item of index.data.items){assert.equal((await f.api('owner','GET',{},item.openUrl)).status,200);assert.equal((await f.api('other','GET',{},item.openUrl)).status,404);assert.equal((await f.api(null,'GET',{},item.openUrl)).status,401);assert.equal(item.downloadUrl,item.openUrl);}
});
