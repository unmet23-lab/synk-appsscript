import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readdir,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {request as httpRequest} from 'node:http';
import {Readable} from 'node:stream';
import {createCompanyApp} from './server.mjs';
import {mediaRange,validMediaSignature,STUDIO_MEDIA_LIMIT,receiveStudioMedia} from './studio-media.mjs';

const PNG=Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082','hex');
const VIDEO=Buffer.concat([Buffer.from([0,0,0,16]),Buffer.from('ftypisom0000'),Buffer.alloc(64)]);
async function fixture(t){
  const dir=await mkdtemp(join(tmpdir(),'synk-studio-')),app=createCompanyApp({dataDir:dir,port:0,allowTestHost:true,schedule:false}),address=await app.start(),base=`http://127.0.0.1:${address.port}`;
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(dir)),resolve(tmpdir()));assert.ok(dir.includes('synk-studio-'));await rm(dir,{recursive:true,force:true});});
  const users={},sessions={};for(const [name,role,teamId] of [['admin','admin',null],['owner','member','a'],['assignee','member','a'],['reviewer','member','a'],['teammate','member','a'],['manager','manager','a'],['other','member','b'],['viewer','viewer','a']]){users[name]=app.store.createUser({name,email:name+'@example.test',role,teamId});sessions[name]=app.store.mint('session',users[name].id,{csrfToken:'csrf-test'},10);}
  for(const id of ['a','b'])app.store.put('teams',id,{id,name:'Team '+id,active:true});
  const headers=(user='owner',extra={})=>({...user?{Cookie:`synk_company_session=${sessions[user]}`}:{},Origin:app.origin,'X-CSRF-Token':'csrf-test',...extra});
  const call=async(path,body,user='owner',extra={})=>{const res=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:headers(user,{'Content-Type':'application/json',...extra}),...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:res.status,data:await res.json(),headers:res.headers};};
  const upload=async(id,bytes=PNG,user='owner',extra={})=>{const res=await fetch(base+`/api/studio-productions/${id}/media`,{method:'POST',headers:headers(user,{'Content-Type':'image/png','X-File-Name':encodeURIComponent('검토 이미지.png'),'X-Version-Label':encodeURIComponent('첫 완성본'),...extra}),body:bytes});return {status:res.status,data:await res.json()};};
  return {app,dir,base,users,sessions,headers,call,upload};
}

test('studio authenticates writes and scopes private/team productions, assignees, reviewers and linked drafts',async t=>{
  const f=await fixture(t);assert.equal((await f.call('/api/studio-workspace',undefined,null)).status,401);
  assert.equal((await f.call('/api/studio-productions',{title:'no csrf'},'owner',{'X-CSRF-Token':'wrong'})).status,403);
  const draft={id:'private-draft',ownerId:f.users.owner.id,title:'PRIVATE-DRAFT-TITLE',input:{secret:'PRIVATE-BODY'},plan:{secret:'PRIVATE-PLAN'}};f.app.store.put('contentDrafts',draft.id,draft);
  const made=await f.call('/api/studio-productions',{title:'Private production',assigneeId:f.users.assignee.id,reviewerId:f.users.reviewer.id,draftId:draft.id,ownerId:f.users.other.id});assert.equal(made.status,201);const p=made.data.production;assert.equal(p.ownerId,f.users.owner.id);assert.equal(p.canReadDraft,true);
  for(const role of ['owner','assignee','reviewer','admin'])assert.equal((await f.call('/api/studio-productions/'+p.id,undefined,role)).status,200);
  for(const role of ['teammate','manager','other','viewer'])assert.equal((await f.call('/api/studio-productions/'+p.id,undefined,role)).status,404);
  const read=await f.call('/api/studio-productions/'+p.id,undefined,'assignee');assert.equal(read.data.production.draftId,null);assert.equal(read.data.production.canReadDraft,false);assert.ok(!JSON.stringify(read.data).includes('PRIVATE-DRAFT'));
  assert.equal((await f.call('/api/studio-productions/'+p.id,{stage:'making'},'reviewer')).status,403);
  assert.equal((await f.call('/api/studio-productions/'+p.id,{stage:'making'},'assignee')).status,200);
  await f.call('/api/studio-productions/'+p.id,{teamId:'a'});
  for(const role of ['teammate','manager','viewer'])assert.equal((await f.call('/api/studio-productions/'+p.id,undefined,role)).status,200);
  assert.equal((await f.call('/api/studio-productions/'+p.id,{nextAction:'review'},'manager')).status,200);
  assert.equal((await f.call('/api/studio-productions/'+p.id,{stage:'ready'},'viewer')).status,403);
  assert.equal((await f.call('/api/studio-productions',{title:'cross team',assigneeId:f.users.other.id})).status,403);
  assert.equal((await f.call('/api/studio-productions',{title:'cross team',teamId:'b'})).status,403);
  const workspace=(await f.call('/api/studio-workspace')).data;assert.ok(workspace.assignableMembers.every(u=>!u.email&&!u.passwordHash));assert.ok(!workspace.assignableMembers.some(u=>u.id===f.users.other.id));assert.ok(workspace.productions.every(row=>!row.versions&&!row.notes));
});

test('materials remain private by default and require explicit company sharing without exposing other private sources',async t=>{
  const f=await fixture(t),m=(await f.call('/api/studio-materials',{title:'실제 경험',body:'PRIVATE EXPERIENCE',tags:['메모']})).data.material;
  assert.equal(m.visibility,'private');assert.equal((await f.call('/api/studio-workspace',undefined,'manager')).data.materials.length,0);
  assert.equal((await f.call('/api/studio-materials/'+m.id,{body:'unauthorized'},'manager')).status,404);
  assert.equal((await f.call('/api/studio-materials/'+m.id,{visibility:'company'})).status,400);
  await f.call('/api/studio-materials/'+m.id,{visibility:'team',teamId:'a'});
  assert.equal((await f.call('/api/studio-materials/'+m.id,{body:'팀 검토'},'manager')).status,200);
  assert.equal((await f.call('/api/studio-workspace',undefined,'other')).data.materials.length,0);
  await f.call('/api/studio-materials/'+m.id,{visibility:'company',shareConfirmed:true});
  assert.equal((await f.call('/api/studio-workspace',undefined,'other')).data.materials[0].body,'팀 검토');
  assert.equal((await f.call('/api/studio-materials/'+m.id,{body:'bad'},'other')).status,403);
  assert.equal((await f.call('/api/studio-materials',{title:'bad',sourceUrl:'javascript:alert(1)'})).status,400);
  assert.equal((await f.call('/api/studio-materials',{title:'bad',body:'x'.repeat(5001)})).status,400);
  assert.equal((await f.call('/api/studio-materials',{title:'bad',tags:Array(9).fill('tag')})).status,400);
});

test('direct good examples preserve existing shared versions and never expose hidden studio records',async t=>{
  const f=await fixture(t),body={title:'좋은 비교 구성',kind:'link',url:'https://example.test/reference',whyGood:'결과를 먼저 보여 주고 차이를 설명한다.',lesson:'우리 실험의 전후 장면부터 시작한다.',axis:'usefulness',shareConfirmed:true};
  for(const role of [null,'owner','viewer'])assert.equal((await f.call('/api/studio-examples/direct',body,role)).status,403);
  assert.equal((await f.call('/api/studio-examples',undefined,null)).status,401);
  assert.equal((await f.call('/api/studio-examples/direct',body,'admin',{'X-CSRF-Token':'wrong'})).status,403);
  assert.equal((await f.call('/api/studio-examples/direct',body,'admin',{Origin:'https://attacker.example'})).status,403);
  const made=await f.call('/api/studio-examples/direct',{...body,productionId:'private-production',publisherId:f.users.other.id,mediaId:'private-media',version:{kind:'image',mediaId:'private-media'}},'manager');
  assert.equal(made.status,201);assert.equal(made.data.example.version.kind,'link');assert.equal(made.data.example.version.mediaId,undefined);assert.equal(made.data.example.productionId,undefined);assert.equal(made.data.example.canArchive,true);
  assert.equal(f.app.store.all('studioProductions').length,0,'registering an example must not create a hidden production workflow');
  const p=(await f.call('/api/studio-productions',{title:'PRIVATE TITLE'})).data.production;
  await f.call(`/api/studio-productions/${p.id}/versions`,{kind:'text',label:'private version',text:'PRIVATE BODY'});
  const revised=(await f.call(`/api/studio-productions/${p.id}/versions`,{kind:'text',label:'selected version',text:'공유한 원고'})).data.production;
  await f.call('/api/studio-productions/'+p.id,{stage:'ready'});
  await f.call('/api/studio-examples',{productionId:p.id,versionId:revised.versions[1].id,title:'기존 예시',whyGood:'좋은 이유',lesson:'배울 점',shareConfirmed:true},'admin');
  const textExample=await f.call('/api/studio-examples/direct',{...body,kind:'text',text:'<script>원문 그대로 기록</script>',url:'javascript:ignored'},'admin');
  assert.equal(textExample.status,201);assert.equal(textExample.data.example.version.url,undefined);
  const read=await f.call('/api/studio-examples',undefined,'viewer');assert.equal(read.status,200);assert.equal(read.data.canCreate,false);assert.equal(read.data.examples.length,3);
  assert.ok(read.data.examples.some(row=>row.version.text==='공유한 원고'));assert.ok(read.data.examples.some(row=>row.version.text==='<script>원문 그대로 기록</script>'));
  for(const key of ['productions','materials','assignableMembers'])assert.equal(read.data[key],undefined);
  assert.ok(!JSON.stringify(read.data).includes('PRIVATE'));assert.ok(!JSON.stringify(read.data).includes('private-media'));
  assert.equal((await f.call('/api/studio-examples/'+made.data.example.id,{archived:true},'owner')).status,403);
  assert.equal((await f.call('/api/studio-examples/'+made.data.example.id,{archived:true},'manager')).status,200);
  assert.equal((await f.call('/api/studio-examples',undefined,'viewer')).data.examples.length,2);
  assert.equal(f.app.store.get('studioProductions',p.id).versions.length,2,'example archiving preserves the original studio content');
});

test('direct good example validation rejects malformed or unconfirmed records before storing anything',async t=>{
  const f=await fixture(t),body={title:'예시',kind:'link',url:'https://example.test/example',whyGood:'이유',lesson:'배울 점',shareConfirmed:true};
  for(const changed of [{shareConfirmed:false},{kind:'video'},{kind:'text',text:''},{kind:'text',text:'x'.repeat(20001)},{url:'javascript:alert(1)'},{url:'https://user:pass@example.test'},{axis:'automatic-score'},{title:''},{lesson:''}]){
    assert.equal((await f.call('/api/studio-examples/direct',{...body,...changed},'admin')).status,400);
  }
  assert.equal(f.app.store.all('studioExamples').length,0);
});

test('immutable versions and timecoded review notes enforce writer/reviewer roles and same-version ownership',async t=>{
  const f=await fixture(t),p=(await f.call('/api/studio-productions',{title:'Review',reviewerId:f.users.reviewer.id,teamId:'a'})).data.production;
  const text=(await f.call(`/api/studio-productions/${p.id}/versions`,{label:'원고1',kind:'text',text:'원본 원고'})).data.production;
  const video=(await f.call(`/api/studio-productions/${p.id}/versions`,{label:'영상1',kind:'video',url:'https://example.test/video.mp4'})).data.production,videoId=video.versions[1].id;
  assert.equal(video.versions[0].text,'원본 원고');assert.equal(video.versions[0].id,text.versions[0].id);
  assert.equal((await f.call(`/api/studio-productions/${p.id}/versions`,{label:'bad',kind:'text',text:'overwrite'},'reviewer')).status,403);
  assert.equal((await f.call(`/api/studio-productions/${p.id}/notes`,{versionId:text.versions[0].id,text:'bad time',atSeconds:2},'reviewer')).status,400);
  assert.equal((await f.call(`/api/studio-productions/${p.id}/notes`,{versionId:'foreign',text:'bad'},'reviewer')).status,404);
  assert.equal((await f.call(`/api/studio-productions/${p.id}/notes`,{versionId:videoId,text:'bad',atSeconds:86401},'reviewer')).status,400);
  assert.equal((await f.call(`/api/studio-productions/${p.id}/notes`,{versionId:videoId,text:'outsider'},'teammate')).status,403);
  const noted=await f.call(`/api/studio-productions/${p.id}/notes`,{versionId:videoId,text:'10초의 예시를 더 명확히',atSeconds:10.5,axis:'usefulness'},'reviewer');assert.equal(noted.status,201);const note=noted.data.production.notes[0];assert.equal(note.atSeconds,10.5);assert.equal(note.canResolve,true);assert.equal(noted.data.production.openNotes,1);
  assert.equal((await f.call(`/api/studio-productions/${p.id}/notes/${note.id}`,{resolved:true},'viewer')).status,403);
  assert.equal((await f.call(`/api/studio-productions/${p.id}/notes/${note.id}`,{resolved:true},'owner')).data.production.openNotes,0);
});

test('binary uploads persist exact bytes, authorize every Range request and reject HTML/SVG, wrong signatures and extensions',async t=>{
  const f=await fixture(t),p=(await f.call('/api/studio-productions',{title:'Media'})).data.production;
  assert.equal((await f.upload(p.id,PNG,'other')).status,404);
  assert.equal((await f.upload(p.id,PNG,'viewer')).status,403);
  assert.equal((await f.upload(p.id,Buffer.from('<svg onload="alert(1)"/>'),'owner',{'Content-Type':'image/svg+xml','X-File-Name':'x.svg'})).status,415);
  assert.equal((await f.upload(p.id,Buffer.from('<html>bad</html>'))).status,415);
  assert.equal((await f.upload(p.id,PNG,'owner',{'X-File-Name':'image.exe'})).status,415);
  assert.equal(f.app.store.all('studioMedia').length,0);assert.deepEqual(await readdir(join(f.dir,'studio-media')),[]);
  const uploaded=await f.upload(p.id);assert.equal(uploaded.status,201);const version=uploaded.data.production.versions[0],saved=f.app.store.get('studioMedia',version.mediaId);assert.equal(version.kind,'image');assert.equal(version.mimeType,'image/png');assert.ok(!JSON.stringify(uploaded.data).includes('diskName'));assert.deepEqual(await readFile(join(f.dir,'studio-media',saved.diskName)),PNG);
  assert.equal((await fetch(f.base+version.url,{headers:f.headers('other')})).status,404);
  assert.equal((await fetch(f.base+version.url)).status,401);
  const range=await fetch(f.base+version.url,{headers:f.headers('owner',{Range:'bytes=3-11'})});assert.equal(range.status,206);assert.equal(range.headers.get('content-range'),`bytes 3-11/${PNG.length}`);assert.match(range.headers.get('cache-control'),/private.*no-store/);assert.equal(range.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await range.arrayBuffer()),PNG.subarray(3,12));
  const suffix=await fetch(f.base+version.url,{headers:f.headers('owner',{Range:'bytes=-8'})});assert.equal(suffix.status,206);assert.deepEqual(Buffer.from(await suffix.arrayBuffer()),PNG.subarray(-8));
  const bad=await fetch(f.base+version.url,{headers:f.headers('owner',{Range:'bytes=999999-'})});assert.equal(bad.status,416);assert.equal(bad.headers.get('content-range'),`bytes */${PNG.length}`);
  const head=await fetch(f.base+version.url,{method:'HEAD',headers:f.headers()});assert.equal(head.status,200);assert.equal(head.headers.get('content-length'),String(PNG.length));assert.equal((await head.arrayBuffer()).byteLength,0);
  assert.equal((await f.upload(p.id,VIDEO,'owner',{'Content-Type':'video/mp4','X-File-Name':'video.mp4'})).status,201);
  assert.equal(STUDIO_MEDIA_LIMIT,100*1024*1024);assert.ok(validMediaSignature('video/mp4',VIDEO));assert.throws(()=>mediaRange('bytes=0-1,4-5',10));
});

test('company examples expose only the chosen immutable version and revoke shared media access when archived',async t=>{
  const f=await fixture(t),p=(await f.call('/api/studio-productions',{title:'PRIVATE-PROJECT-TITLE',nextAction:'PRIVATE-NEXT'})).data.production;
  const first=(await f.upload(p.id)).data.production.versions[0];const second=(await f.upload(p.id,VIDEO,'owner',{'Content-Type':'video/mp4','X-File-Name':'private-other.mp4'})).data.production.versions[1];
  await f.call(`/api/studio-productions/${p.id}/notes`,{versionId:first.id,text:'PRIVATE-NOTE'});
  const payload={productionId:p.id,versionId:first.id,title:'좋은 예시',whyGood:'핵심이 보인다.',lesson:'정보 순서를 배운다.',axis:'usefulness',shareConfirmed:true};
  assert.equal((await f.call('/api/studio-examples',payload,'admin')).status,403);
  await f.call('/api/studio-productions/'+p.id,{stage:'ready'});
  assert.equal((await f.call('/api/studio-examples',payload,'owner')).status,403);
  assert.equal((await f.call('/api/studio-examples',{...payload,shareConfirmed:false},'admin')).status,400);
  const saved=await f.call('/api/studio-examples',payload,'admin');assert.equal(saved.status,201);
  const examples=(await f.call('/api/studio-workspace',undefined,'other')).data.examples;assert.equal(examples.length,1);assert.equal(examples[0].version.id,first.id);assert.ok(!JSON.stringify(examples).includes('PRIVATE'));assert.ok(!JSON.stringify(examples).includes(p.id));assert.ok(!JSON.stringify(examples).includes(second.id));
  assert.equal((await fetch(f.base+first.url,{headers:f.headers('other')})).status,200);
  assert.equal((await fetch(f.base+second.url,{headers:f.headers('other')})).status,404);
  assert.equal((await f.call('/api/studio-productions/'+p.id,undefined,'other')).status,404);
  await f.call('/api/studio-examples/'+saved.data.example.id,{archived:true},'admin');
  assert.equal((await fetch(f.base+first.url,{headers:f.headers('other')})).status,404);
  assert.equal((await fetch(f.base+first.url,{headers:f.headers('owner')})).status,200);
});

test('unchanged cross-team assignments and hidden draft links survive legitimate assignee edits',async t=>{
  const f=await fixture(t);f.app.store.put('contentDrafts','admin-draft',{id:'admin-draft',ownerId:f.users.admin.id,title:'hidden'});
  const p=(await f.call('/api/studio-productions',{title:'Cross-team',assigneeId:f.users.owner.id,reviewerId:f.users.other.id,teamId:'b',draftId:'admin-draft'},'admin')).data.production;
  const updated=await f.call('/api/studio-productions/'+p.id,{title:'Edited',assigneeId:p.assigneeId,reviewerId:p.reviewerId,teamId:p.teamId,draftId:'admin-draft'});assert.equal(updated.status,200);assert.equal(updated.data.production.title,'Edited');assert.equal(updated.data.production.draftId,null);assert.equal(f.app.store.get('studioProductions',p.id).draftId,'admin-draft');
  assert.equal((await f.call('/api/studio-productions/'+p.id,{assigneeId:f.users.other.id})).status,403);
});

test('UTF-8 JSON split inside a Korean character preserves original text and rejects malformed bytes',async t=>{
  const f=await fixture(t),body=Buffer.from(JSON.stringify({title:'한글 원문',body:'경험 그대로'})),position=body.indexOf(Buffer.from('한'))+1;
  const send=bytes=>new Promise((resolve,reject)=>{const req=httpRequest(f.base+'/api/studio-materials',{method:'POST',headers:f.headers('owner',{'Content-Type':'application/json','Content-Length':bytes.length})},res=>{let raw='';res.on('data',chunk=>{raw+=chunk;});res.on('end',()=>resolve({status:res.statusCode,data:JSON.parse(raw)}));});req.on('error',reject);req.write(bytes.subarray(0,position));setTimeout(()=>req.end(bytes.subarray(position)),15);});
  const result=await send(body);assert.equal(result.status,201);assert.equal(result.data.material.title,'한글 원문');assert.equal(result.data.material.body,'경험 그대로');
  const malformed=Buffer.concat([Buffer.from('{"title":"'),Buffer.from([255]),Buffer.from('"}')]);assert.equal((await send(malformed)).status,400);
  assert.equal((await send(Buffer.from(JSON.stringify({title:'Bound',extra:'x'.repeat(256000)})))).status,413);
  assert.equal((await send(Buffer.alloc(768001,32))).status,413);
});

test('logout and revoked production access during uploads remove unfinished bytes and never save a version',async t=>{
  for(const mode of ['logout','reassignment']){
    const f=await fixture(t),p=(await f.call('/api/studio-productions',{title:'Pending upload',assigneeId:f.users.owner.id},'admin')).data.production;
    let req;const response=new Promise((resolve,reject)=>{req=httpRequest(f.base+`/api/studio-productions/${p.id}/media`,{method:'POST',headers:f.headers('owner',{'Content-Type':'image/png','Content-Length':PNG.length,'X-File-Name':'pending.png','X-Version-Label':'pending'})},res=>{let raw='';res.on('data',chunk=>{raw+=chunk;});res.on('end',()=>resolve({status:res.statusCode,data:JSON.parse(raw)}));});req.on('error',reject);req.write(PNG.subarray(0,12));});
    let started=false;for(let i=0;i<100;i++){const names=await readdir(join(f.dir,'studio-media')).catch(()=>[]);if(names.some(name=>name.endsWith('.upload'))){started=true;break;}await new Promise(resolve=>setTimeout(resolve,5));}assert.equal(started,true);
    if(mode==='logout')f.app.store.revokeUser(f.users.owner.id);else assert.equal((await f.call('/api/studio-productions/'+p.id,{assigneeId:null},'admin')).status,200);
    req.end(PNG.subarray(12));const result=await response;assert.equal(result.status,mode==='logout'?401:404);
    assert.equal(f.app.store.all('studioMedia').length,0);assert.equal(f.app.store.get('studioProductions',p.id).versions.length,0);assert.deepEqual(await readdir(join(f.dir,'studio-media')),[]);
  }
});

test('the 100MiB streaming ceiling and interrupted streams clean their temporary files',async t=>{
  const f=await fixture(t),chunk=Buffer.alloc(1024*1024);
  const stream=Readable.from((async function*(){for(let i=0;i<101;i++)yield chunk;})());stream.headers={'content-type':'image/png','x-file-name':'large.png'};
  await assert.rejects(receiveStudioMedia(stream,f.dir),error=>error.status===413);assert.deepEqual(await readdir(join(f.dir,'studio-media')),[]);
  const interrupted=Readable.from((async function*(){yield PNG.subarray(0,12);throw new Error('fixture disconnected');})());interrupted.headers={'content-type':'image/png','x-file-name':'partial.png'};
  await assert.rejects(receiveStudioMedia(interrupted,f.dir),/fixture disconnected/);assert.deepEqual(await readdir(join(f.dir,'studio-media')),[]);
});
