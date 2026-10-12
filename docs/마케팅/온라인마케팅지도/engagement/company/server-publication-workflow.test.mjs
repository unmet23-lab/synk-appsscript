import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createCompanyApp} from './server.mjs';
import {stagePublicationDelivery} from '../../../../../tools/완성본등록.mjs';
const BASE='2026-10-11T00:00:00.000Z';

async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-publication-workflow-api-'));let clock=BASE,calls=0;
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,clock:()=>clock,collector:async()=>{calls++;throw Error('external collection forbidden');}});
  const address=await app.start(),base=`http://127.0.0.1:${address.port}`;
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-publication-workflow-api-'));await rm(directory,{recursive:true,force:true});});
  const users=Object.fromEntries(['owner','other','viewer'].map(name=>[name,app.store.createUser({name,email:name+'@example.test',role:name==='viewer'?'viewer':'member'})]));
  const sessions=Object.fromEntries(Object.entries(users).map(([name,user])=>[name,app.store.mint('session',user.id,{csrfToken:'workflow-test'},20)]));
  async function request(path,input,user='owner'){
    const response=await fetch(base+path,{method:input===undefined?'GET':'POST',headers:{...(user?{Cookie:'synk_company_session='+sessions[user]}:{}),...(input===undefined?{}:{Origin:app.origin,'Content-Type':'application/json','X-CSRF-Token':'workflow-test'})},...(input===undefined?{}:{body:JSON.stringify(input)})});
    return {status:response.status,data:await response.json(),headers:response.headers};
  }
  for(const platform of ['youtube','instagram'])app.store.put('channels',platform,{id:platform,platform,displayName:platform,ownerIds:[users.owner.id],active:true});
  async function deliver(channels=['youtube-shorts','instagram-reels']){
    const configured=await request('/api/publication-inbox/settings',{active:true});assert.equal(configured.status,200);
    const video=join(directory,'final.mp4');await promisify(execFile)('ffmpeg',['-v','error','-f','lavfi','-i','color=c=blue:s=320x180:r=15','-t','0.4','-c:v','libx264','-pix_fmt','yuv420p','-y',video],{windowsHide:true,timeout:30000});
    await stagePublicationDelivery({inbox:configured.data.inboxPath,video,title:'Local workflow example',body:'Synthetic copy',channels,confirmed:true});
    const scanned=await request('/api/publication-inbox/scan',{});assert.equal(scanned.status,200);const receipt=scanned.data.entries.find(row=>row.status==='ready');assert.ok(receipt,JSON.stringify(scanned.data));
    const draft=(await request('/api/publication-inbox/'+receipt.id+'/draft')).data.draft;
    return {receipt,draft,video};
  }
  return {app,users,request,deliver,calls:()=>calls,setHours(hours){clock=new Date(Date.parse(BASE)+hours*3600000).toISOString();}};
}

test('today publication actions follow real intake, package, partial publication and metric completion without duplicated tasks',async t=>{
  const f=await fixture(t);
  assert.equal((await f.request('/api/publication-workflow',undefined,null)).status,401);
  const {draft,receipt,video}=await f.deliver(),original=await readFile(video);
  let result=await f.request('/api/publication-workflow');assert.equal(result.status,200);assert.match(result.headers.get('cache-control'),/no-store/);assert.equal(result.data.items.length,1);assert.equal(result.data.items[0].kind,'publication_prepare');assert.match(result.data.items[0].href,new RegExp(receipt.id));
  assert.equal((await f.request('/api/publication-workflow',undefined,'other')).data.items.length,0);assert.equal((await f.request('/api/publication-workflow',undefined,'viewer')).data.items.length,0);
  await f.request('/messenger/api/bootstrap');const before=Number(f.app.messenger.db.prepare('SELECT COUNT(*) AS n FROM message_tasks').get().n);
  const created=await f.request('/api/publication-packages',draft);assert.equal(created.status,201,JSON.stringify(created.data));const packageId=created.data.package.id;
  result=await f.request('/api/publication-workflow');assert.equal(result.data.items.length,1);assert.equal(result.data.items[0].kind,'publication_review');assert.equal(result.data.items[0].packageId,packageId);
  let review=(await f.request('/api/publication-packages/'+packageId+'/review')).data.review;
  for(const check of review.manual.filter(row=>!row.locked)){
    const saved=await f.request('/api/publication-packages/'+packageId+'/review',{revision:review.revision,checkId:check.id,status:'confirmed',note:'합성 시험 자료의 상태 전이 확인'});assert.equal(saved.status,200);review=saved.data.review;
  }
  assert.equal(review.summary.status,'complete');result=await f.request('/api/publication-workflow');assert.equal(result.data.items.length,2);assert.ok(result.data.items.every(row=>row.kind==='publication_publish'));
  const registered=await f.request('/api/post-performance',{channelId:'youtube',url:'https://www.youtube.com/shorts/abcDEF12345',publishedAt:BASE,title:'Published synthetic example',publicationPackageId:packageId});assert.equal(registered.status,201,JSON.stringify(registered.data));assert.equal(registered.data.entry.publicationFormat,'youtube-shorts');
  result=await f.request('/api/publication-workflow');assert.equal(result.data.items.length,1);assert.match(JSON.stringify(result.data.items),/instagram/);
  f.setHours(25);result=await f.request('/api/publication-workflow');assert.equal(result.data.items.filter(row=>row.kind==='publication_performance').length,1);assert.match(result.data.items.find(row=>row.kind==='publication_performance').href,/checkpoint=24h/);
  const saved=await f.request('/api/post-performance/'+registered.data.entry.id+'/checkpoints/24',{metrics:{views:0},measuredAt:new Date(Date.parse(BASE)+25*3600000).toISOString()});assert.equal(saved.status,200);
  result=await f.request('/api/publication-workflow');assert.equal(result.data.items.length,1);assert.equal(result.data.items[0].kind,'publication_publish');
  const assistant=await f.request('/api/assistant',{message:'오늘 할 일'});assert.equal(assistant.status,200,JSON.stringify(assistant.data));assert.equal(assistant.data.data.actionablePublicationCount,1);assert.doesNotMatch(assistant.data.text,/오늘 처리할 일이 없습니다/);
  for(let i=0;i<3;i++)await f.request('/api/publication-workflow');assert.equal(Number(f.app.messenger.db.prepare('SELECT COUNT(*) AS n FROM message_tasks').get().n),before);assert.deepEqual(await readFile(video),original);assert.equal(f.calls(),0);
  f.app.store.put('users',f.users.owner.id,{...f.users.owner,active:false});assert.equal((await f.request('/api/publication-workflow')).status,401);
});

test('YouTube formats remain separate and invalid cross-platform or private package links are rejected',async t=>{
  const f=await fixture(t),{draft}=await f.deliver(['youtube-shorts','youtube-video']);
  const created=await f.request('/api/publication-packages',draft);assert.equal(created.status,201,JSON.stringify(created.data));const id=created.data.package.id;
  const input={channelId:'youtube',url:'https://www.youtube.com/shorts/abcDEF12345',publishedAt:BASE,publicationPackageId:id};
  assert.equal((await f.request('/api/post-performance',input)).status,400);
  assert.equal((await f.request('/api/post-performance',{...input,publicationFormat:'instagram-reels'})).status,400);
  assert.equal((await f.request('/api/post-performance',{...input,channelId:'instagram',url:'https://www.instagram.com/reel/ABC_123/'})).status,400);
  assert.equal((await f.request('/api/post-performance',input,'other')).status,404);
  const added=await f.request('/api/post-performance',{...input,publicationFormat:'youtube-shorts'});assert.equal(added.status,201);
  const items=(await f.request('/api/publication-workflow')).data.items;assert.equal(items.length,1);assert.match(JSON.stringify(items),/youtube-video/);
  assert.equal((await f.request('/api/post-performance',{...input,publicationFormat:'youtube-video'})).status,409);
});
