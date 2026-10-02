import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {createCompanyApp} from './server.mjs';
import {normalizeReelUrl} from './content-service.mjs';

const at='2026-09-27T06:00:00.000Z';
const valid={seriesId:'synkbrief-use',topic:'회의록 정리',audience:'팀 동료',experience:'회의록을 정리했다.',proof:'원본과 결과 대조',takeaway:'검토 순서',entertainment:'단계별 발견',authenticity:{basis:'사용 기록',ownPerspective:'직접 비교',limits:'한 번의 실험',disclosure:'AI로 초안 보조'}};
async function fixture(t,contentFetch){
  const dir=await mkdtemp(join(tmpdir(),'synk-content-')),app=createCompanyApp({dataDir:dir,port:0,allowTestHost:true,schedule:false,clock:()=>at,contentFetch});
  const address=await app.start(),base=`http://127.0.0.1:${address.port}`;
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(dir)),resolve(tmpdir()));assert.ok(dir.includes('synk-content-'));await rm(dir,{recursive:true,force:true});});
  const users={};for(const [name,role,teamId] of [['admin','admin',null],['alice','member','a'],['bob','member','a'],['other','member','b'],['manager','manager','a'],['viewer','viewer','a']])users[name]=app.store.createUser({name,email:name+'@example.test',role,teamId});
  const sessions=Object.fromEntries(Object.entries(users).map(([name,u])=>[name,app.store.mint('session',u.id,{csrfToken:'csrf-test'},10)]));
  for(const name of ['alice','bob','other'])app.store.put('channels',name,{id:name,platform:'instagram',displayName:name,ownerIds:[users[name].id],teamId:users[name].teamId,active:true,canonicalUrl:'https://www.instagram.com/'+name+'/'});
  const call=async(path,body,user='alice',headers={},method=body===undefined?'GET':'POST')=>{
    const response=await fetch(base+path,{method,headers:{...(user?{Cookie:`synk_company_session=${sessions[user]}`} : {}),...(body===undefined?{}:{'Content-Type':'application/json',Origin:app.origin,'X-CSRF-Token':'csrf-test'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const raw=await response.text();return {status:response.status,data:response.headers.get('content-type')?.includes('application/json')?JSON.parse(raw):raw,headers:response.headers};
  };
  return{app,users,call};
}

test('content API requires authentication, same origin and CSRF; viewers are read only',async t=>{
  const f=await fixture(t);
  assert.equal((await f.call('/api/content-workspace',undefined,null)).status,401);
  assert.equal((await f.call('/api/content-generate',valid,'alice',{'X-CSRF-Token':'bad'})).status,403);
  assert.equal((await f.call('/api/content-generate',valid,'alice',{Origin:'https://evil.example'})).status,403);
  for(const path of ['/api/content-generate','/api/content-references','/api/content-search','/api/content-search-settings'])assert.equal((await f.call(path,valid,'viewer')).status,403);
  assert.equal((await f.call('/api/content-workspace',undefined,'viewer')).status,200);
  assert.equal(f.app.store.all('contentDrafts').length,0);
});

test('review targets expose only title and link, reject unreadable team rooms and suggest permitted reviewers',async t=>{
  const f=await fixture(t);f.app.store.put('teams','a',{id:'a',name:'마케팅팀',active:true});
  const draft=(await f.call('/api/content-generate',{...valid,channelId:'alice'})).data.draft;
  const privateDraft=(await f.call('/api/content-generate',{...valid,topic:'개인 기획'})).data.draft;
  const adminState=(await f.call('/messenger/api/bootstrap',undefined,'admin')).data;
  const managerState=(await f.call('/messenger/api/bootstrap',undefined,'manager')).data;
  const bobState=(await f.call('/messenger/api/bootstrap',undefined,'bob')).data;
  const dm=(await f.call('/messenger/api/dms',{userId:adminState.user.id})).data.channel;
  const team=(await f.call('/messenger/api/teams/a/channel',{})).data.channel;
  const result=await f.call(`/api/content-drafts/${draft.id}/share-targets`);assert.equal(result.status,200);
  const targets=result.data;assert.deepEqual(Object.keys(targets.workspaceLink).sort(),['kind','title','url']);assert.equal(targets.workspaceLink.kind,'content-review');assert.ok(targets.workspaceLink.url.includes('draftId='+draft.id));
  assert.ok(!JSON.stringify(targets).includes('원본과 결과 대조'));assert.ok(!JSON.stringify(targets).includes('authenticity'));assert.ok(!JSON.stringify(targets).includes('readerIds'));
  assert.equal(targets.channels.find(room=>room.id===dm.id).allowed,true);assert.equal(targets.channels.find(room=>room.id===team.id).allowed,false);assert.match(targets.channels.find(room=>room.id===team.id).reason,/참여자/);
  assert.ok(targets.people.some(person=>person.id===adminState.user.id));assert.ok(targets.people.some(person=>person.id===managerState.user.id));assert.ok(!targets.people.some(person=>person.id===bobState.user.id));
  const personal=(await f.call(`/api/content-drafts/${privateDraft.id}/share-targets`)).data;assert.ok(!personal.people.some(person=>person.id===managerState.user.id));
  assert.equal((await f.call(`/api/content-drafts/${draft.id}/share-targets`,undefined,'bob')).status,404);assert.equal((await f.call(`/api/content-drafts/${draft.id}/share-targets`,undefined,'viewer')).status,403);
  f.app.store.put('users',f.users.bob.id,{...f.app.store.get('users',f.users.bob.id),teamId:'b'});
  const allowed=(await f.call(`/api/content-drafts/${draft.id}/share-targets`)).data.channels.find(room=>room.id===team.id);assert.equal(allowed.allowed,true,'every remaining team participant can read the channel-linked draft');
});

test('message commit rechecks source and every recipient rather than trusting review picker or card title',async t=>{
  const f=await fixture(t),draft=(await f.call('/api/content-generate',{...valid,channelId:'alice'})).data.draft;
  const ownerState=(await f.call('/messenger/api/bootstrap')).data,adminState=(await f.call('/messenger/api/bootstrap',undefined,'admin')).data,bobState=(await f.call('/messenger/api/bootstrap',undefined,'bob')).data;
  const dm=(await f.call('/messenger/api/dms',{userId:adminState.user.id})).data.channel,bobDm=(await f.call('/messenger/api/dms',{userId:bobState.user.id})).data.channel;
  const info=ownerState.channels.find(room=>room.systemKey==='info'),link=(await f.call(`/api/content-drafts/${draft.id}/share-targets`)).data.workspaceLink;
  for(const channelId of [info.id,bobDm.id])assert.equal((await f.call(`/messenger/api/channels/${channelId}/messages`,{body:'검토 부탁해요',workspaceLink:link})).status,403);
  const posted=await f.call(`/messenger/api/channels/${dm.id}/messages`,{body:'검토 부탁해요',workspaceLink:{...link,title:'위조된 제목'}});assert.equal(posted.status,201);assert.equal(posted.data.message.workspaceLink.title,draft.title);assert.equal(posted.data.message.workspaceLink.url,link.url);assert.ok(!JSON.stringify(posted.data).includes('원본과 결과 대조'));
  const ownPlain=(await f.call(`/messenger/api/channels/${bobDm.id}/messages`,{body:'일반 대화'})).data.message;
  assert.equal((await f.call(`/messenger/api/messages/${ownPlain.id}`,{body:'일반 대화',workspaceLink:link},'alice',{},'PATCH')).status,403,'editing a prior message must also validate its recipients');
  const foreign=(await f.call('/api/content-generate',{...valid,topic:'다른 사람 비공개'},'bob')).data.draft;
  const inaccessible={...link,url:'/#view=content&section=plan&draftId='+foreign.id};assert.equal((await f.call(`/messenger/api/channels/${dm.id}/messages`,{body:'',workspaceLink:inaccessible})).status,404);
  f.app.store.put('users',f.users.admin.id,{...f.app.store.get('users',f.users.admin.id),role:'member'});
  assert.equal((await f.call(`/messenger/api/channels/${dm.id}/messages`,{body:'',workspaceLink:link})).status,403,'a previously valid selection cannot bypass a later role change');
  assert.equal((await f.call(`/api/content-drafts/${draft.id}`,undefined,'admin')).status,404,'opening a historic card uses current source permissions');
  assert.equal((await f.call(`/messenger/api/messages/${posted.data.message.id}`)).data.message.workspaceLink.title,draft.title,'the already shared title remains part of message history');
});

test('private drafts stay private; explicit channel drafts allow the current team and admin',async t=>{
  const f=await fixture(t);
  const own=(await f.call('/api/content-generate',valid)).data.draft;
  const shared=(await f.call('/api/content-generate',{...valid,channelId:'alice'})).data.draft;
  await f.call('/api/content-generate',{...valid,topic:'다른 팀 비공개'},'other');
  const ids=async user=>(await f.call('/api/content-workspace',undefined,user)).data.drafts.map(d=>d.id);
  assert.deepEqual(new Set(await ids('alice')),new Set([own.id,shared.id]));
  assert.deepEqual(await ids('manager'),[shared.id]);assert.deepEqual(await ids('viewer'),[shared.id]);assert.deepEqual(await ids('bob'),[]);
  assert.equal((await ids('admin')).length,3);
  for(const user of ['bob','other','manager'])assert.equal((await f.call(`/api/content-drafts/${own.id}/export`,undefined,user)).status,404);
  assert.equal((await f.call(`/api/content-drafts/${shared.id}`,{status:'review'},'manager')).status,200);
  assert.equal((await f.call(`/api/content-drafts/${shared.id}`,{status:'ready'},'viewer')).status,403);
  f.app.store.put('channels','alice',{...f.app.store.get('channels','alice'),teamId:'b'});
  assert.deepEqual(await ids('manager'),[]);assert.deepEqual(await ids('viewer'),[]);
  assert.equal((await f.call('/api/content-generate',{...valid,channelId:'other'})).status,404);
});

test('draft updates whitelist fields, preserve authenticity, validate selection and export as an attachment',async t=>{
  const f=await fixture(t),created=await f.call('/api/content-generate',{...valid,ownerId:'forged',status:'ready'});assert.equal(created.status,201);
  const d=created.data.draft;assert.equal(d.ownerId,f.users.alice.id);assert.equal(d.status,'draft');assert.deepEqual(d.input.authenticity,valid.authenticity);
  assert.equal((await f.call(`/api/content-drafts/${d.id}`,{status:'published'})).status,400);
  assert.equal((await f.call(`/api/content-drafts/${d.id}`,{selectedIdeaId:'foreign'})).status,400);
  const updated=await f.call(`/api/content-drafts/${d.id}`,{title:'검토한 기획',status:'ready',selectedIdeaId:d.plan.ideas[1].id,ownerId:f.users.other.id,plan:{bad:true}});
  assert.equal(updated.data.draft.ownerId,d.ownerId);assert.equal(updated.data.draft.plan.ideas.length,3);assert.equal(updated.data.draft.selectedIdeaId,d.plan.ideas[1].id);
  const exported=await f.call(`/api/content-drafts/${d.id}/export`);assert.equal(exported.status,200);assert.match(exported.headers.get('content-disposition'),/^attachment;/);assert.match(exported.headers.get('content-type'),/text\/markdown/);assert.match(exported.data,/검토한 기획/);assert.match(exported.data,/사용 기록/);
  assert.equal((await f.call('/api/content-generate',{...valid,topic:'x'.repeat(301)})).status,400);
  assert.equal((await f.call('/api/content-generate',{...valid,authenticity:{basis:'x'.repeat(2001)}})).status,400);
  assert.equal((await f.call('/api/content-generate',{...valid,seriesId:'invalid'})).status,400);
  assert.equal((await f.call('/api/content-generate',null)).status,400);
  await f.call(`/api/content-drafts/${d.id}`,{title:'<script>alert(1)</script> ![leak](https://evil.test)'});
  const safeExport=await f.call(`/api/content-drafts/${d.id}/export`);assert.ok(!safeExport.data.includes('<script>'));assert.ok(!safeExport.data.includes('![leak]'));
});

test('workspace projects only draft summaries and detail reads enforce the same private/team permissions',async t=>{
  const f=await fixture(t),privateDraft=(await f.call('/api/content-generate',valid)).data.draft;
  const shared=(await f.call('/api/content-generate',{...valid,channelId:'alice'})).data.draft;
  const saved=f.app.store.get('contentDrafts',privateDraft.id);
  f.app.store.put('contentDrafts',saved.id,{...saved,plan:{...saved.plan,largeFixture:'x'.repeat(524288)}});
  const originalAll=f.app.store.all.bind(f.app.store);
  f.app.store.all=kind=>{assert.notEqual(kind,'contentDrafts','list must not load full draft JSON into memory');return originalAll(kind);};
  const workspace=await f.call('/api/content-workspace');
  f.app.store.all=originalAll;
  assert.equal(workspace.status,200);assert.equal(workspace.data.drafts.length,2);
  const expected=['id','title','ownerId','ownerName','channelId','status','createdAt','updatedAt','selectedIdeaId','seriesId'].sort();
  for(const row of workspace.data.drafts){assert.deepEqual(Object.keys(row).sort(),expected);assert.equal(row.seriesId,valid.seriesId);assert.ok(!('plan' in row));assert.ok(!('input' in row));}
  assert.ok(JSON.stringify(workspace.data.drafts).length<2000);
  const detail=await f.call(`/api/content-drafts/${privateDraft.id}`);assert.equal(detail.status,200);assert.equal(detail.data.draft.plan.largeFixture.length,524288);assert.deepEqual(detail.data.draft.input.authenticity,valid.authenticity);
  assert.equal((await f.call(`/api/content-drafts/${privateDraft.id}`,undefined,'admin')).status,200);
  for(const user of ['bob','other','manager','viewer'])assert.equal((await f.call(`/api/content-drafts/${privateDraft.id}`,undefined,user)).status,404);
  for(const user of ['manager','viewer'])assert.equal((await f.call(`/api/content-drafts/${shared.id}`,undefined,user)).status,200);
  assert.equal((await f.call(`/api/content-drafts/${shared.id}`,undefined,null)).status,401);
  f.app.store.put('channels','alice',{...f.app.store.get('channels','alice'),teamId:'b'});
  assert.equal((await f.call(`/api/content-drafts/${shared.id}`,undefined,'manager')).status,404);
});

test('references accept canonical HTTPS Instagram reel URLs and never fetch submitted URLs',async t=>{
  let calls=0;const f=await fixture(t,async()=>{calls++;throw new Error('must not call');});
  for(const url of ['http://www.instagram.com/reel/abc/','https://instagram.com.evil.test/reel/abc/','https://www.instagram.com@evil.test/reel/abc/','https://www.instagram.com/p/abc/','http://127.0.0.1/','javascript:alert(1)','https://www.instagram.com:444/reel/abc/'])assert.throws(()=>normalizeReelUrl(url));
  const r=await f.call('/api/content-references',{url:'https://instagram.com/reel/Ab_c-1/?igsh=secret#part',title:'회의록',metrics:{likes:0,views:100},publishedAt:'2026-09-26',formatNotes:'질문 다음에 답 공개',evidenceStatus:'verified'});
  assert.equal(r.status,201);assert.equal(r.data.reference.url,'https://www.instagram.com/reel/Ab_c-1/');assert.equal(r.data.reference.metrics.likes,0);assert.equal(r.data.reference.metrics.shares,null);assert.equal(r.data.reference.evidenceStatus,'user-submitted');assert.equal(calls,0);
  assert.equal((await f.call('/api/content-generate',{...valid,referenceId:r.data.reference.id},'bob')).status,404);
  assert.equal((await f.call('/api/content-generate',{...valid,referenceId:r.data.reference.id})).data.draft.plan.input.reference.url,r.data.reference.url);
  assert.equal((await f.call('/api/content-references',{url:r.data.reference.url,title:'test',metrics:{likes:-1}})).status,400);
  assert.equal((await f.call('/api/content-references',{url:r.data.reference.url,title:'test',publishedAt:'2026-10-01'})).status,400);
  assert.equal((await f.call('/api/content-references',{url:r.data.reference.url,title:'test',publishedAt:'2026-02-30'})).status,400);
});

test('local search uses only visible saved references and connected API posts, preserving unknown metrics',async t=>{
  let calls=0;const f=await fixture(t,async()=>{calls++;throw new Error('no key');});
  await f.call('/api/content-references',{url:'https://www.instagram.com/reel/visible/',title:'회의록 메모'});
  await f.call('/api/content-references',{url:'https://www.instagram.com/reel/private/',title:'회의록 비밀'},'other');
  for(const id of ['alice','other']){
    f.app.store.setSecret('channel:'+id,{accessToken:'fixture'});
    f.app.store.put('posts',id,{id,channelId:id,title:'회의록 '+id,url:'https://www.instagram.com/reel/'+id+'/',publishedAt:'2026-09-26T00:00:00Z',source:'api:instagram'});
    f.app.store.put('snapshots',id,{id,postId:id,checkedAt:at,source:'api:instagram',views:0,likes:3});
  }
  f.app.store.put('posts','old',{id:'old',channelId:'alice',title:'회의록 old',url:'https://www.instagram.com/reel/old/',publishedAt:'2025-01-01T00:00:00Z',source:'api:instagram'});
  f.app.store.put('posts','manual',{id:'manual',channelId:'alice',title:'회의록 manual',url:'https://www.instagram.com/reel/manual/',publishedAt:'2026-09-26T00:00:00Z',source:'manual'});
  const r=await f.call('/api/content-search',{query:'회의록',days:30});assert.equal(r.status,200);assert.equal(r.data.mode,'local');assert.equal(calls,0);assert.equal(r.data.links.length,2);assert.equal(r.data.results.length,2);assert.ok(!JSON.stringify(r.data.results).includes('other'));assert.ok(!JSON.stringify(r.data.results).includes('private'));
  const post=r.data.results.find(x=>x.source==='company-post');assert.equal(post.metrics.views,0);assert.equal(post.metrics.shares,null);assert.equal(post.evidenceStatus,'collected');
  f.app.store.deleteSecret('channel:alice');assert.equal((await f.call('/api/content-search',{query:'회의록'})).data.results.length,1);
  assert.equal((await f.call('/api/content-search',{query:'회의록',days:31})).status,400);
  assert.equal((await f.call('/api/content-search',{query:'x'.repeat(201)})).status,400);
});

test('Exa is opt in, uses a fixed endpoint and query only, validates URLs/dates, protects keys and limits calls',async t=>{
  const calls=[];const f=await fixture(t,async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify({results:[{title:'후보',url:'https://instagram.com/reel/candidate/?tracking=yes',publishedDate:'2026-09-25T00:00:00Z',author:'public',highlights:['형식 관찰']},{title:'악성',url:'https://evil.example/reel/abc/'},{title:'오래됨',url:'https://www.instagram.com/reel/old/',publishedDate:'2025-01-01'},{title:'미래',url:'https://www.instagram.com/reel/future/',publishedDate:'2027-01-01'}]}),{status:200,headers:{'Content-Type':'application/json'}});});
  assert.equal((await f.call('/api/content-search-settings',{apiKey:'fixture-secret-key'},'alice')).status,403);
  const set=await f.call('/api/content-search-settings',{apiKey:'fixture-secret-key'},'admin');assert.equal(set.status,200);assert.equal(set.data.search.configured,true);assert.equal(calls.length,0);
  assert.equal(f.app.store.secret('content-search:exa').apiKey,'fixture-secret-key');
  const encrypted=f.app.store.db.prepare('SELECT ciphertext FROM credentials WHERE id=?').get('content-search:exa').ciphertext;assert.ok(!encrypted.includes('fixture-secret-key'));
  const r=await f.call('/api/content-search',{query:'회의록',experience:'PRIVATE EXPERIENCE',apiKey:'evil',endpoint:'http://127.0.0.1'});assert.equal(r.status,200);assert.equal(r.data.mode,'exa');assert.equal(r.data.results.length,1);assert.equal(r.data.results[0].metrics.views,null);assert.equal(r.data.results[0].evidenceStatus,'search-candidate');assert.equal(r.data.results[0].dateStatus,'provider-reported');
  assert.equal(calls[0].url,'https://api.exa.ai/search');assert.equal(calls[0].options.redirect,'error');const payload=JSON.parse(calls[0].options.body);assert.equal(payload.query,'회의록');assert.deepEqual(payload.includeDomains,['instagram.com']);assert.equal(payload.startPublishedDate,'2026-08-28T06:00:00.000Z');assert.deepEqual(payload.contents,{highlights:true});assert.ok(!calls[0].options.body.includes('PRIVATE'));assert.ok(!JSON.stringify(r.data).includes('fixture-secret-key'));
  const workspace=await f.call('/api/content-workspace');assert.ok(!JSON.stringify(workspace.data).includes('fixture-secret-key'));
  for(let i=0;i<4;i++)assert.equal((await f.call('/api/content-search',{query:'회의록'})).status,200);
  assert.equal((await f.call('/api/content-search',{query:'회의록'})).status,429);assert.equal(calls.length,5);
  assert.equal((await f.call('/api/content-search-settings',{apiKey:''},'admin')).data.search.configured,false);
  assert.equal((await f.call('/api/content-search',{query:'회의록'})).data.mode,'local');assert.equal(calls.length,5);
});

test('provider failures safely fall back and never disclose response bodies or API credentials',async t=>{
  const f=await fixture(t,async()=>new Response('fixture-secret-key <script>oops</script>',{status:402}));
  await f.call('/api/content-search-settings',{apiKey:'fixture-secret-key'},'admin');
  const r=await f.call('/api/content-search',{query:'회의록'});assert.equal(r.status,200);assert.equal(r.data.mode,'local-fallback');assert.ok(!JSON.stringify(r.data).includes('fixture-secret-key'));assert.ok(!JSON.stringify(r.data).includes('<script>'));
});

test('oversized provider responses are bounded and never returned to the client',async t=>{
  const f=await fixture(t,async()=>new Response('x'.repeat(524289),{headers:{'Content-Type':'application/json'}}));
  await f.call('/api/content-search-settings',{apiKey:'fixture'},'admin');
  const result=await f.call('/api/content-search',{query:'회의록'});assert.equal(result.status,200);assert.equal(result.data.mode,'local-fallback');assert.deepEqual(result.data.results,[]);
  assert.equal((await f.call('/api/content-search-settings',{},'admin')).status,400);
  assert.equal((await f.call('/api/content-workspace')).data.search.configured,true);
});

test('search rechecks channel scope and revoked sessions after asynchronous provider requests',async t=>{
  let release,started;const signal=new Promise(resolve=>{started=resolve;});
  const f=await fixture(t,async()=>{started();await new Promise(resolve=>{release=resolve;});return new Response('{"results":[]}');});
  await f.call('/api/content-search-settings',{apiKey:'fixture'},'admin');
  await f.call('/api/content-references',{url:'https://www.instagram.com/reel/shared/',title:'회의록',channelId:'alice'});
  const pending=f.call('/api/content-search',{query:'회의록'},'manager');await signal;
  f.app.store.put('channels','alice',{...f.app.store.get('channels','alice'),teamId:'b'});release();assert.equal((await pending).data.results.length,0);
  const next=f.call('/api/content-search',{query:'회의록'},'alice');await new Promise(resolve=>setTimeout(resolve,20));f.app.store.revokeUser(f.users.alice.id);release();assert.equal((await next).status,401);
});
