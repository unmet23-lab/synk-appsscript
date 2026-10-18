import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createCompanyApp} from './server.mjs';
const run=promisify(execFile);

async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-publication-api-'));let at='2026-10-11T00:00:00.000Z',calls=0;
  const postPerformanceFetch=async input=>{const url=new URL(input);assert.equal(url.origin,'https://www.googleapis.com');return Response.json({items:[{id:url.searchParams.get('id'),snippet:{channelId:'UCabcdefghijklmnopqrstuv',publishedAt:'2026-10-11T00:00:00.000Z',title:'합성 게시'},contentDetails:{duration:'PT30S'}}]});};
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,clock:()=>at,postPerformanceFetch,collector:async()=>{calls++;throw new Error('No external connections in publication API tests.');}}),address=await app.start(),base=`http://127.0.0.1:${address.port}`;
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-publication-api-'));await rm(directory,{recursive:true,force:true});});
  const owner=app.store.createUser({name:'Owner',email:'owner@example.test',role:'member'}),other=app.store.createUser({name:'Other',email:'other@example.test',role:'member'}),viewer=app.store.createUser({name:'Viewer',email:'viewer@example.test',role:'viewer'}),sessions=new Map([owner,other,viewer].map(user=>[user.id,app.store.mint('session',user.id,{csrfToken:'publication-test'},10)]));
  const channel={id:'publication-channel',platform:'youtube',displayName:'Test channel',canonicalUrl:'https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv',externalId:'UCabcdefghijklmnopqrstuv',ownerIds:[owner.id],active:true};app.store.put('channels',channel.id,channel);
  app.store.setSecret('channel:'+channel.id,{apiKey:'synthetic-lookup-key'});
  async function request(path,input,user=owner,extra={}){
    const response=await fetch(base+path,{method:input===undefined?'GET':'POST',headers:{...(user?{Cookie:'synk_company_session='+sessions.get(user.id)}:{}),...(input===undefined?{}:{'Content-Type':'application/json',Origin:app.origin,'X-CSRF-Token':'publication-test'}),...extra},...(input===undefined?{}:{body:JSON.stringify(input)})});return {status:response.status,data:await response.json(),headers:response.headers};
  }
  async function upload(productionId,file){const bytes=await readFile(file),response=await fetch(base+'/api/studio-productions/'+productionId+'/media',{method:'POST',headers:{Cookie:'synk_company_session='+sessions.get(owner.id),Origin:app.origin,'X-CSRF-Token':'publication-test','Content-Type':'video/mp4','X-File-Name':'fixture.mp4','X-Version-Label':encodeURIComponent('완성본 시험')},body:bytes});return {status:response.status,data:await response.json()};}
  return {app,directory,base,owner,other,viewer,channel,sessions,request,upload,setTime:value=>{at=value;},calls:()=>calls};
}

test('publication routes preserve authentication, Origin, CSRF, role and channel ownership boundaries',async t=>{
  const f=await fixture(t),input={channelId:f.channel.id,url:'https://www.youtube.com/watch?v=abcDEF12345',publishedAt:'2026-10-11T00:00:00.000Z',title:'등록 시험'};
  assert.equal((await f.request('/api/publication-workspace',undefined,null)).status,401);
  assert.equal((await f.request('/api/post-performance',input,f.owner,{Origin:'https://other.invalid'})).status,403);
  assert.equal((await f.request('/api/post-performance',input,f.owner,{'X-CSRF-Token':'invalid'})).status,403);
  assert.equal((await f.request('/api/post-performance',input,f.viewer)).status,403);
  assert.equal((await f.request('/api/post-performance',input,f.other)).status,403);
  const saved=await f.request('/api/post-performance',input);assert.equal(saved.status,201);assert.equal(saved.data.entry.checkpoints.length,2);
  const again=await f.request('/api/post-performance',input);assert.equal(again.status,200);assert.equal(again.data.entry.id,saved.data.entry.id);
  assert.equal((await f.request('/api/post-performance',undefined,f.other)).data.entries.length,0);
  assert.equal((await f.request('/api/post-performance/'+saved.data.entry.id+'/checkpoints/24',{metrics:{views:30}},f.other)).status,404);
  const workspace=await f.request('/api/publication-workspace');assert.equal(workspace.status,200);assert.equal(workspace.data.performance.lookupAvailable,true);assert.equal(workspace.data.performance.entries.length,1);assert.ok(Array.isArray(workspace.data.catalog.channels));assert.equal(f.calls(),0);
});

test('registered publications persist missing metrics and actual observation times without enabling broad collection',async t=>{
  const f=await fixture(t),saved=await f.request('/api/post-performance',{channelId:f.channel.id,url:'https://youtu.be/abcDEF12345',publishedAt:'2026-10-11T00:00:00.000Z',title:'성과 시험'}),id=saved.data.entry.id;
  f.app.store.setSecret('channel:'+f.channel.id,{});
  assert.equal((await f.request(`/api/post-performance/${id}/checkpoints/24`,{metrics:{views:2}})).status,400);
  f.setTime('2026-10-12T00:05:00.000Z');await f.app.collectPublicationPerformance();
  assert.equal(f.calls(),0);
  const result=await f.request(`/api/post-performance/${id}/checkpoints/24`,{metrics:{views:200,likes:0},measuredAt:'2026-10-12T00:03:00.000Z',note:'Synthetic fixture, no real platform data'});
  assert.equal(result.status,200);const point=result.data.entry.checkpoints.find(row=>row.hours===24);assert.equal(point.metrics.views,200);assert.equal(point.metrics.likes,0);assert.equal(point.metrics.shares,null);assert.equal(point.observedAt,'2026-10-12T00:03:00.000Z');assert.equal(point.recordedAt,'2026-10-12T00:05:00.000Z');
  assert.equal((await f.request(`/api/post-performance/${id}/checkpoints/72`,{metrics:{views:210},measuredAt:'2026-10-14T00:00:00.000Z'})).status,400);
  f.app.store.put('channels',f.channel.id,{...f.channel,ownerIds:[f.other.id]});assert.equal((await f.request('/api/post-performance')).data.entries.length,0);
});

test('real uploaded video becomes downloadable per-channel files while original and private access remain intact',async t=>{
  const f=await fixture(t),file=join(f.directory,'fixture.mp4');
  await run('ffmpeg',['-v','error','-f','lavfi','-i','color=c=blue:s=320x180:r=15','-f','lavfi','-i','sine=frequency=440:sample_rate=44100','-t','0.5','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest','-y',file],{windowsHide:true,timeout:30000});
  const production=(await f.request('/api/studio-productions',{title:'완성본 시험',stage:'making'})).data.production,uploaded=await f.upload(production.id,file);assert.equal(uploaded.status,201);const version=uploaded.data.production.versions.at(-1),source=await readFile(join(f.directory,'studio-media',version.mediaId+'.mp4'));
  const input={productionId:production.id,versionId:version.id,title:'완성본 시험',body:'게시문 시험',language:'ko',channels:['youtube-shorts','instagram-reels'],mode:'adapt',subtitleFileName:'ko.srt',subtitleText:'1\n00:00:00,000 --> 00:00:00,400\n안녕하세요\n'};
  assert.equal((await f.request('/api/publication-packages',input,f.other)).status,404);
  const created=await f.request('/api/publication-packages',input);assert.equal(created.status,201,JSON.stringify(created.data));assert.ok(created.data.package.id);
  assert.deepEqual(await readFile(join(f.directory,'studio-media',version.mediaId+'.mp4')),source);
  const preview=await fetch(f.base+created.data.package.outputs[0].previewUrl,{headers:{Cookie:'synk_company_session='+f.sessions.get(f.owner.id),Range:'bytes=0-31'}});assert.equal(preview.status,206);assert.equal((await preview.arrayBuffer()).byteLength,32);assert.match(preview.headers.get('content-range'),/^bytes 0-31\//);
  const privatePreview=await fetch(f.base+created.data.package.outputs[0].previewUrl,{headers:{Cookie:'synk_company_session='+f.sessions.get(f.other.id)}});assert.equal(privatePreview.status,404);
  assert.equal((await f.request('/api/publication-packages/'+created.data.package.id,undefined,f.other)).status,404);
  const downloaded=await fetch(f.base+'/api/publication-packages/'+created.data.package.id+'/download',{headers:{Cookie:'synk_company_session='+f.sessions.get(f.owner.id)}});assert.equal(downloaded.status,200);assert.match(downloaded.headers.get('content-type'),/zip/);assert.match(downloaded.headers.get('cache-control'),/no-store/);const zip=Buffer.from(await downloaded.arrayBuffer());assert.equal(zip.readUInt32LE(0),0x04034b50);assert.ok(zip.includes(Buffer.from('youtube-shorts')));assert.ok(zip.includes(Buffer.from('instagram-reels')));
  const outsider=await fetch(f.base+'/api/publication-packages/'+created.data.package.id+'/download',{headers:{Cookie:'synk_company_session='+f.sessions.get(f.other.id)}});assert.equal(outsider.status,404);
});
