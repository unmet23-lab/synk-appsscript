import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createCompanyApp} from './server.mjs';

const NOW='2026-10-11T12:00:00.000Z',HOUR=3600000;
const before=hours=>new Date(Date.parse(NOW)-hours*HOUR).toISOString();
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-publication-learning-http-'));let externalCalls=0;
  const deny=async()=>{externalCalls++;throw Error('No external calls in this test');};
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,clock:()=>NOW,collector:deny,contentFetch:deny});
  const address=await app.start(),base=`http://127.0.0.1:${address.port}`;
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-publication-learning-http-'));await rm(directory,{recursive:true,force:true});});
  const users=Object.fromEntries(['owner','other','viewer'].map(name=>[name,app.store.createUser({name,email:name+'@example.test',role:name==='viewer'?'viewer':'member'})]));
  const sessions=Object.fromEntries(Object.entries(users).map(([name,user])=>[name,app.store.mint('session',user.id,{csrfToken:'learning-test'},20)]));
  const channel={id:'learning-youtube',platform:'youtube',displayName:'Synthetic channel',active:true,ownerIds:[users.owner.id,users.viewer.id]};app.store.put('channels',channel.id,channel);
  async function request(path,input,user='owner',headers={}){
    const response=await fetch(base+path,{method:input===undefined?'GET':'POST',headers:{...(user?{Cookie:'synk_company_session='+sessions[user]}:{}),...(input===undefined?{}:{Origin:app.origin,'Content-Type':'application/json','X-CSRF-Token':'learning-test'}),...headers},...(input===undefined?{}:{body:JSON.stringify(input)})});
    const type=response.headers.get('content-type')||'';return {status:response.status,data:type.includes('json')?await response.json():await response.text(),headers:response.headers};
  }
  async function createPackage(){
    const production=(await request('/api/studio-productions',{title:'Learning source',stage:'ready'})).data.production;
    const file=join(directory,'source.mp4');await promisify(execFile)('ffmpeg',['-v','error','-f','lavfi','-i','color=c=blue:s=320x180:r=15','-t','0.4','-c:v','libx264','-pix_fmt','yuv420p','-y',file],{windowsHide:true,timeout:30000});
    const bytes=await readFile(file),response=await fetch(base+'/api/studio-productions/'+production.id+'/media',{method:'POST',headers:{Cookie:'synk_company_session='+sessions.owner,Origin:app.origin,'X-CSRF-Token':'learning-test','Content-Type':'video/mp4','X-File-Name':'source.mp4','X-Version-Label':'learning-fixture'},body:bytes});
    assert.equal(response.status,201);const uploaded=await response.json(),version=uploaded.production.versions.at(-1);
    const result=await request('/api/publication-packages',{productionId:production.id,versionId:version.id,title:'Learning package',body:'Synthetic body',channels:['youtube-shorts'],mode:'adapt',language:'ko'});assert.equal(result.status,201,JSON.stringify(result.data));
    return {package:result.data.package,file,bytes,production,version};
  }
  async function post(id,hours,metrics,packageId){
    const publishedAt=before(hours),result=await request('/api/post-performance',{channelId:channel.id,url:'https://www.youtube.com/shorts/'+id,title:'Synthetic '+id,publishedAt,...(packageId?{publicationPackageId:packageId,publicationFormat:'youtube-shorts'}:{})});
    assert.equal(result.status,201,JSON.stringify(result.data));
    if(metrics){const recorded=await request('/api/post-performance/'+result.data.entry.id+'/checkpoints/72',{metrics,measuredAt:new Date(Date.parse(publishedAt)+72*HOUR).toISOString(),note:'Synthetic historical observation; not real SNS data.'});assert.equal(recorded.status,200,JSON.stringify(recorded.data));}
    return result.data.entry;
  }
  return {app,base,request,users,channel,createPackage,post,externalCalls:()=>externalCalls};
}

test('real publication source and 72h evidence flow into the existing private content draft without automatic writes',async t=>{
  const f=await fixture(t),source=await f.createPackage();
  for(let i=0;i<3;i++)await f.post('learnAAA00'+i,240-i*24,{views:100+i*20,completionRatePct:60,toolVisits:10},source.package.id);
  const target=await f.post('learnAAA003',96,{views:0,completionRatePct:30,toolVisits:2},source.package.id);
  const future=await f.post('learnAAA004',1,null,source.package.id);
  const performanceBefore=JSON.stringify(f.app.store.all('postPerformanceEntries')),draftsBefore=f.app.store.all('contentDrafts').length;
  const result=await f.request('/api/publication-learning');assert.equal(result.status,200);assert.match(result.headers.get('cache-control'),/no-store/);
  const card=result.data.cards.find(row=>row.entryId===target.id);assert.ok(card);assert.equal(card.status,'ready');assert.equal(card.canPlan,true);assert.equal(card.facts.find(row=>row.id==='views').value,0);assert.equal(card.facts.find(row=>row.id==='views').comparison.sampleCount,3);assert.equal(card.source.productionId,source.production.id);assert.equal(card.source.versionId,source.version.id);assert.ok(card.experiments.length);
  assert.equal(result.data.cards.find(row=>row.entryId===future.id).status,'waiting');
  const workspace=await f.request('/api/publication-workspace');assert.equal(workspace.status,200);assert.ok(workspace.data.learning.cards.some(row=>row.entryId===target.id));
  const path='/api/publication-learning/'+target.id+'/plan',body={experimentId:card.experiments[0].id};
  const prepared=await f.request(path,body);assert.equal(prepared.status,200,JSON.stringify(prepared.data));assert.equal(prepared.data.input.channelId,'');assert.match(prepared.data.input.editorialNote,/72/);assert.ok(prepared.data.input.editorialNote.includes(target.url));assert.ok(prepared.data.input.editorialNote.includes(card.experiments[0].title));assert.ok(prepared.data.input.editorialNote.length<=3000);
  await f.request(path,body);await f.request('/api/publication-learning');assert.equal(f.app.store.all('contentDrafts').length,draftsBefore);assert.equal(JSON.stringify(f.app.store.all('postPerformanceEntries')),performanceBefore);assert.deepEqual(await readFile(source.file),source.bytes);
  const saved=await f.request('/api/content-generate',{...prepared.data.input,seriesId:'synkbrief-use'});assert.equal(saved.status,201,JSON.stringify(saved.data));assert.equal(saved.data.draft.channelId,null);assert.equal(saved.data.draft.input.editorialNote,prepared.data.input.editorialNote);assert.equal(saved.data.draft.input.proof,'');assert.deepEqual(saved.data.draft.input.personalization,{situation:'',choice:'',nextStep:''});assert.ok(!JSON.stringify(saved.data.draft.plan.ideas).includes(target.url));assert.ok(!JSON.stringify(saved.data.draft.plan.ideas).includes(card.experiments[0].measure));
  const reopened=await f.request('/api/content-drafts/'+saved.data.draft.id);assert.equal(reopened.status,200);assert.equal(reopened.data.draft.input.editorialNote,prepared.data.input.editorialNote);
  const script=await f.request('/publication-learning-plan.js');assert.equal(script.status,200);assert.match(script.data,/openPublicationLearningPlan/);
  assert.equal(f.externalCalls(),0);
});

test('learning endpoints enforce current session, CSRF, source access, maturity and allowed experiment',async t=>{
  const f=await fixture(t),target=await f.post('learnBBB001',96,{views:0});
  const card=(await f.request('/api/publication-learning')).data.cards.find(row=>row.entryId===target.id);assert.equal(card.status,'limited');assert.equal(card.canPlan,true);
  const path='/api/publication-learning/'+target.id+'/plan',input={experimentId:card.experiments[0].id};
  assert.equal((await f.request('/api/publication-learning',undefined,null)).status,401);
  assert.equal((await f.request('/api/publication-learning',undefined,'other')).data.cards.length,0);
  assert.equal((await f.request('/api/publication-learning',undefined,'owner',{'X-SYNK-Demo':'1'})).status,400);
  assert.equal((await f.request(path,input,'owner',{'X-CSRF-Token':'wrong'})).status,403);
  assert.ok([403,404].includes((await f.request(path,input,'other')).status));
  assert.equal((await f.request(path,input,'viewer')).status,403);
  assert.ok([400,409].includes((await f.request(path,{experimentId:'unlisted'})).status));
  const future=await f.post('learnBBB002',2,null);assert.ok([403,409].includes((await f.request('/api/publication-learning/'+future.id+'/plan',input)).status));
  f.app.store.put('channels',f.channel.id,{...f.channel,ownerIds:[f.users.other.id]});assert.equal((await f.request('/api/publication-learning')).data.cards.length,0);assert.ok([403,404].includes((await f.request(path,input)).status));
  f.app.store.put('users',f.users.owner.id,{...f.users.owner,active:false});assert.equal((await f.request('/api/publication-learning')).status,401);assert.ok([401,403].includes((await f.request(path,input)).status));assert.equal(f.externalCalls(),0);
});
