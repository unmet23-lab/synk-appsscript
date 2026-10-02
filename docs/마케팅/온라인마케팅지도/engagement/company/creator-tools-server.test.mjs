import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createCompanyApp} from './server.mjs';
import {CREATOR_SOURCE_FILES} from './creator-sources.mjs';

const at='2026-10-02T01:00:00.000Z';
const sourceRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../../../../..');
const image={name:'완성본.png',kind:'image',mime:'image/png',bytes:5000,width:1080,height:1920};
const input=(extras={})=>({title:'개인 완성본 점검',preset:'vertical',media:image,audience:'처음 보는 사람이 다음 행동을 알 수 있게',rights:'직접 촬영한 이미지와 승인 자산',measurement:'저장과 구체적인 질문',checks:{},...extras});
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-creator-tools-api-')),app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,clock:()=>at}),address=await app.start(),base='http://127.0.0.1:'+address.port;
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-creator-tools-api-'));await rm(directory,{recursive:true,force:true});});
  const users={},sessions={};
  for(const role of ['admin','manager','member','other','viewer']){
    const actualRole=role==='other'?'member':role;
    users[role]=app.store.createUser({name:'Fixture '+role,email:role+'@creator-tools.example.test',role:actualRole,teamId:['member','manager','viewer'].includes(role)?'team-a':null});
    sessions[role]=app.store.mint('session',users[role].id,{csrfToken:'creator-tools-csrf'},10);
  }
  app.store.put('teams','team-a',{id:'team-a',name:'Fixture team',active:true});
  async function request(path,{body,user='member',method=body===undefined?'GET':'POST',headers={}}={}){
    const response=await fetch(base+path,{method,headers:{...(user?{Cookie:'synk_company_session='+sessions[user]}:{}),...(body===undefined?{}:{Origin:app.origin,'X-CSRF-Token':'creator-tools-csrf','Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const bytes=Buffer.from(await response.arrayBuffer()),text=bytes.toString('utf8');
    return {status:response.status,headers:response.headers,bytes,text,data:response.headers.get('content-type')?.startsWith('application/json')&&text?JSON.parse(text):null};
  }
  return {app,users,sessions,request};
}

test('creator read endpoints require login and approved assets are shared with every active role',async t=>{
  const f=await fixture(t);
  for(const path of ['/api/creator-reviews','/api/creator-sources','/api/creator-sources/assets/suit-license','/api/creator-sources/assets/synk-ink-vector'])assert.equal((await f.request(path,{user:null})).status,401);
  assert.equal((await f.request('/api/creator-sources/assets/synk-ink-vector',{user:null,method:'HEAD'})).status,401);
  for(const user of ['admin','manager','member','other','viewer']){
    const reviews=await f.request('/api/creator-reviews',{user}),sources=await f.request('/api/creator-sources',{user});
    assert.equal(reviews.status,200);assert.deepEqual(reviews.data.records,[]);assert.equal(reviews.data.canWrite,user!=='viewer');assert.equal(sources.status,200);assert.equal(sources.data.assets.length,15);assert.equal(sources.data.guides.length,4);
    assert.ok(sources.data.assets.every(row=>row.available&&row.byteSize>0));assert.ok(!sources.text.includes(sourceRoot));assert.ok(!sources.text.includes('encryption.key'));
  }
});

test('saved review records remain strictly personal even for team managers and company admins',async t=>{
  const f=await fixture(t),saved=await f.request('/api/creator-reviews',{body:input({ownerId:f.users.other.id})});
  assert.equal(saved.status,201);const record=saved.data.record;assert.equal(record.ownerId,f.users.member.id);assert.equal(record.revision,1);assert.equal(record.checkCount,0);
  assert.equal((await f.request('/api/creator-reviews')).data.records.length,1);
  for(const user of ['other','manager','admin','viewer']){
    const workspace=await f.request('/api/creator-reviews',{user});assert.equal(workspace.status,200);assert.deepEqual(workspace.data.records,[]);assert.ok(!workspace.text.includes(record.title));
    if(user!=='viewer'){
      assert.equal((await f.request('/api/creator-reviews/'+record.id,{user,body:input({revision:record.revision})})).status,404);
      assert.equal((await f.request('/api/creator-reviews/'+record.id+'/archive',{user,body:{revision:record.revision,archived:true}})).status,404);
    }
  }
});

test('review create update archive enforce Origin CSRF and viewer write restrictions',async t=>{
  const f=await fixture(t);
  assert.equal((await f.request('/api/creator-reviews',{body:input(),headers:{'X-CSRF-Token':'wrong'}})).status,403);
  assert.equal((await f.request('/api/creator-reviews',{body:input(),headers:{Origin:'https://evil.example.test'}})).status,403);
  // Existing write guard checks the session-bound CSRF token before the route's login branch.
  assert.equal((await f.request('/api/creator-reviews',{user:null,body:input()})).status,403);
  assert.equal((await f.request('/api/creator-reviews',{user:'viewer',body:input()})).status,403);
  const saved=await f.request('/api/creator-reviews',{body:input()}),id=saved.data.record.id;
  for(const path of ['/api/creator-reviews/'+id,'/api/creator-reviews/'+id+'/archive']){
    const body=path.endsWith('/archive')?{revision:1,archived:true}:input({revision:1});
    assert.equal((await f.request(path,{user:'viewer',body})).status,403);
    assert.equal((await f.request(path,{body,headers:{'X-CSRF-Token':'wrong'}})).status,403);
    assert.equal((await f.request(path,{body,headers:{Origin:'https://evil.example.test'}})).status,403);
  }
  assert.equal(f.app.store.all('creatorReviews').length,1);assert.equal(f.app.store.get('creatorReviews',id).revision,1);
});

test('personal review updates preserve notes and reject stale revisions through archive and restore',async t=>{
  const f=await fixture(t),workspace=await f.request('/api/creator-reviews'),checkId=workspace.data.review[0].id;
  const saved=await f.request('/api/creator-reviews',{body:input({checks:{[checkId]:{checked:true,note:'전체 영상을 직접 보고 첫 장면과 마지막 행동 확인'}}})}),id=saved.data.record.id;
  assert.equal(saved.data.record.checkCount,1);assert.equal(saved.data.record.checks[checkId].note,'전체 영상을 직접 보고 첫 장면과 마지막 행동 확인');
  const updated=await f.request('/api/creator-reviews/'+id,{body:input({title:'2차 검토',revision:1,checks:saved.data.record.checks})});assert.equal(updated.status,200);assert.equal(updated.data.record.revision,2);assert.equal(updated.data.record.createdAt,saved.data.record.createdAt);
  assert.equal((await f.request('/api/creator-reviews/'+id,{body:input({revision:1})})).status,409);
  assert.equal((await f.request('/api/creator-reviews/'+id+'/archive',{body:{revision:1,archived:true}})).status,409);
  const archived=await f.request('/api/creator-reviews/'+id+'/archive',{body:{revision:2,archived:true}});assert.equal(archived.status,200);assert.equal(archived.data.record.archived,true);assert.equal(archived.data.record.revision,3);
  const read=await f.request('/api/creator-reviews');assert.equal(read.data.records.length,1);assert.equal(read.data.records[0].archived,true);
  assert.equal((await f.request('/api/creator-reviews/'+id,{body:input({revision:3})})).status,409);
  const restored=await f.request('/api/creator-reviews/'+id+'/archive',{body:{revision:3,archived:false}});assert.equal(restored.status,200);assert.equal(restored.data.record.revision,4);assert.equal(restored.data.record.archived,false);assert.equal(restored.data.record.checks[checkId].checked,true);
});

test('media metadata is normalized and official file matching never creates a quality approval',async t=>{
  const f=await fixture(t),video={name:'완성본.mp4',kind:'video',mime:'video/mp4',bytes:10000,width:1080,height:1920,duration:60};
  const saved=await f.request('/api/creator-reviews',{body:input({preset:'youtube-shorts',media:video})});assert.equal(saved.status,201);const record=saved.data.record;
  assert.equal(record.media.provenance,'browser-metadata');assert.equal(record.analysis.find(row=>row.label==='재생 시간').status,'match');assert.equal(record.analysis.find(row=>row.label==='소리·자막·사용권').status,'unknown');assert.equal(record.checkCount,0);assert.equal(record.approved,undefined);
  const long=await f.request('/api/creator-reviews',{body:input({preset:'youtube-shorts',media:{...video,duration:181}})});assert.equal(long.status,201);assert.equal(long.data.record.analysis.find(row=>row.label==='재생 시간').status,'review');
  const noFile=await f.request('/api/creator-reviews',{body:input({media:null})});assert.equal(noFile.status,201);assert.equal(noFile.data.record.analysis[0].status,'unknown');
  for(const body of [input({media:{...image,name:'../secret.png'}}),input({media:{...image,width:0}}),input({media:{...video,duration:0}}),input({checks:{invented:{checked:true,note:''}}}),input({title:'x'.repeat(161)}),input({preset:'unknown'})])assert.equal((await f.request('/api/creator-reviews',{body})).status,400);
});

test('asset HEAD and download return original bytes with private no-store and safe disposition',async t=>{
  const f=await fixture(t),asset=CREATOR_SOURCE_FILES.find(row=>row.id==='synk-ink-vector'),expected=await readFile(resolve(sourceRoot,asset.path));
  const preview=await f.request('/api/creator-sources/assets/'+asset.id),head=await f.request('/api/creator-sources/assets/'+asset.id,{method:'HEAD'}),download=await f.request('/api/creator-sources/assets/'+asset.id+'?download=1');
  for(const result of [preview,head,download]){
    assert.equal(result.status,200);assert.equal(result.headers.get('cache-control'),'private, no-store');assert.equal(result.headers.get('content-type'),'image/svg+xml');assert.equal(result.headers.get('x-content-type-options'),'nosniff');assert.equal(Number(result.headers.get('content-length')),expected.length);assert.ok(result.headers.get('content-security-policy').includes("default-src 'self'"));
  }
  assert.deepEqual(preview.bytes,expected);assert.deepEqual(download.bytes,expected);assert.equal(head.bytes.length,0);assert.equal(preview.headers.get('content-disposition'),null);assert.equal(head.headers.get('content-disposition'),null);
  assert.match(download.headers.get('content-disposition'),/^attachment; filename="synk-brand-asset\.svg"; filename\*=UTF-8''SYNK-Ink\.svg$/);
  const license=await f.request('/api/creator-sources/assets/suit-license?download=1',{user:'viewer'});assert.equal(license.status,200);assert.match(license.text,/SIL OPEN FONT LICENSE Version 1\.1/);assert.match(license.headers.get('content-type'),/^text\/plain/);assert.ok(license.headers.get('content-disposition').includes('SUIT-LICENSE-OFL.txt'));
  for(const suffix of ['does-not-exist','synk-ink-vector?download=1&file=encryption.key']){
    const result=await f.request('/api/creator-sources/assets/'+suffix);assert.equal(result.status,suffix.startsWith('synk-')?200:404);if(result.status===200)assert.deepEqual(result.bytes,expected);
  }
  assert.equal((await f.request('/api/creator-sources/assets/does-not-exist',{method:'HEAD'})).status,404);
});

test('session revocation and inactive users lose reviews sources and license access immediately',async t=>{
  const f=await fixture(t);await f.request('/api/creator-reviews',{body:input()});f.app.store.revokeUser(f.users.member.id);
  for(const path of ['/api/creator-reviews','/api/creator-sources','/api/creator-sources/assets/synk-ink-vector','/api/creator-sources/assets/suit-license'])assert.equal((await f.request(path)).status,401);
  assert.equal((await f.request('/api/creator-reviews',{body:input()})).status,403);assert.equal((await f.request('/api/creator-sources/assets/suit-license',{method:'HEAD'})).status,401);
  f.app.store.put('users',f.users.viewer.id,{...f.app.store.get('users',f.users.viewer.id),active:false});
  for(const path of ['/api/creator-reviews','/api/creator-sources','/api/creator-sources/assets/suit-license'])assert.equal((await f.request(path,{user:'viewer'})).status,401);
});

test('creator tools static resources have required MIME and security headers without protected payloads',async t=>{
  const f=await fixture(t);
  for(const name of ['publish-rules.js','publish-check.js','maker-tools.js','maker-tools.css','subtitle-lab.js','subtitle-lab.css','creator-sources.js','creator-sources.css']){
    const response=await f.request('/'+name,{user:null});assert.equal(response.status,200,name);assert.match(response.headers.get('content-type'),name.endsWith('.css')?/^text\/css/:/^text\/javascript/);assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.equal(response.headers.get('referrer-policy'),'no-referrer');assert.equal(response.headers.get('x-frame-options'),'DENY');assert.ok(response.headers.get('content-security-policy').includes("connect-src 'self'"));assert.ok(response.bytes.length>0);assert.ok(!response.text.includes(sourceRoot));
  }
  const head=await f.request('/creator-sources.js',{user:null,method:'HEAD'});assert.equal(head.status,200);assert.equal(head.bytes.length,0);
});
