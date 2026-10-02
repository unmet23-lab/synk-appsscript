import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {createCompanyApp} from './server.mjs';

async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-project-leave-'));
  const options={dataDir:directory,port:0,allowTestHost:true,schedule:false,messengerDriveStorage:{active:async()=>null,status:async()=>({provider:'local'})}};
  let app=createCompanyApp(options),base;
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-project-leave-'));await rm(directory,{recursive:true,force:true});});
  for(const id of ['marketing','design'])app.store.put('teams',id,{id,name:id,active:true,createdAt:new Date().toISOString()});
  const users={},sessions={};
  function renew(name){sessions[name]=app.store.mint('session',users[name].id,{csrfToken:'leave-csrf'},20);}
  function addUser(name,role='member',teamId='marketing'){users[name]=app.store.createUser({name,email:name+'@example.test',role,teamId});renew(name);return users[name];}
  addUser('admin','admin',null);addUser('owner');addUser('peer','member','design');addUser('outsider');addUser('manager','manager');addUser('viewer','viewer');
  async function start(){const address=await app.start();base=`http://127.0.0.1:${address.port}`;}
  await start();
  async function restart(){await app.stop();app=createCompanyApp(options);await start();}
  async function request(user,path,{method='GET',body,raw,headers={}}={}){
    return fetch(base+path,{method,headers:{Cookie:`synk_company_session=${sessions[user]}`,Origin:app.origin,'X-CSRF-Token':'leave-csrf',...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(raw!==undefined?{body:raw}:body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(6000)});
  }
  async function json(user,path,method='GET',body){const response=await request(user,path,{method,body}),data=await response.json();assert.ok(response.ok,`${user} ${method} ${path}: ${response.status} ${JSON.stringify(data)}`);return data;}
  const states={};for(const name of Object.keys(users))states[name]=await json(name,'/messenger/api/bootstrap');
  async function project(names=['peer'],scope='private'){return(await json('owner','/messenger/api/channels','POST',{name:'임시 나가기 검증 프로젝트',category:'project',scope,...(scope==='private'?{memberIds:names.map(name=>states[name].user.id)}:{})})).channel;}
  return{get app(){return app;},users,states,request,json,project,restart,addUser,renew};
}

test('leaving a selected project removes only the requester and retains the other participants exact messages and files',async t=>{
  const f=await fixture(t),room=await f.project(['peer','manager']);assert.equal(room.canLeave,true);
  const bytes=Buffer.from('원래 참여자가 공유한 프로젝트 파일');
  const upload=await f.request('peer',`/messenger/api/channels/${room.id}/files`,{method:'POST',raw:bytes,headers:{'Content-Type':'application/octet-stream','X-File-Name':encodeURIComponent('PROJECT-LEAVE.txt')}});assert.equal(upload.status,201);const file=(await upload.json()).file;
  const message=(await f.json('peer',`/messenger/api/channels/${room.id}/messages`,'POST',{body:'PROJECT-LEAVE 대화와 자료는 보존',fileIds:[file.id],mentionIds:[f.states.manager.user.id]})).message;
  await f.json('owner',`/messenger/api/messages/${message.id}/task`,'POST',{title:'남은 프로젝트 검토',assigneeId:f.states.peer.user.id});
  await f.json('peer',`/messenger/api/messages/${message.id}/save`,'POST',{});
  await f.json('peer',`/messenger/api/messages/${message.id}/reminder`,'PUT',{remindAt:new Date(Date.now()+3600000).toISOString()});
  const before=(await f.json('owner',`/messenger/api/messages/${message.id}`)).message;
  const membersBefore=[...room.memberIds];
  await f.json('peer',`/messenger/api/channels/${room.id}/leave`,'POST',{});
  const members=(await f.json('owner',`/messenger/api/channels/${room.id}/members`)).channel.memberIds;
  assert.deepEqual(new Set(members),new Set(membersBefore.filter(id=>id!==f.states.peer.user.id)));
  assert.deepEqual((await f.json('owner',`/messenger/api/messages/${message.id}`)).message,before);
  assert.deepEqual(Buffer.from(await(await f.request('manager',file.url)).arrayBuffer()),bytes);
  assert.ok(!(await f.json('peer','/messenger/api/bootstrap')).channels.some(row=>row.id===room.id));
  for(const path of [`/messenger/api/channels/${room.id}/members`,`/messenger/api/channels/${room.id}/messages`,`/messenger/api/messages/${message.id}`,file.url,`/messenger/api/files?channelId=${room.id}`])assert.equal((await f.request('peer',path)).status,404,path);
  for(const path of ['/messenger/api/search?q=PROJECT-LEAVE','/messenger/api/files?q=PROJECT-LEAVE','/messenger/api/saved','/messenger/api/reminders?status=all','/messenger/api/tasks?scope=mine','/messenger/api/notifications'])assert.ok(!JSON.stringify(await f.json('peer',path)).includes('PROJECT-LEAVE'),path);
  assert.equal((await f.request('peer',`/messenger/api/channels/${room.id}/messages`,{method:'POST',body:{body:'접근 철회'}})).status,404);
  await f.restart();
  assert.ok(!(await f.json('peer','/messenger/api/bootstrap')).channels.some(row=>row.id===room.id));
  assert.deepEqual(Buffer.from(await(await f.request('manager',file.url)).arrayBuffer()),bytes);
  await f.json('owner',`/messenger/api/channels/${room.id}/members`,'POST',{memberIds:[f.states.peer.user.id]});
  assert.equal((await f.json('peer',`/messenger/api/messages/${message.id}`)).message.id,message.id);
});

test('leaving public projects survives roster changes, restart and restoration until an explicit invitation',async t=>{
  const f=await fixture(t),room=await f.project([],'public');
  await f.json('peer',`/messenger/api/channels/${room.id}/leave`,'POST',{});
  f.addUser('newcomer');assert.ok((await f.json('newcomer','/messenger/api/bootstrap')).channels.some(row=>row.id===room.id),'new coworkers follow the public room policy');
  assert.ok(!(await f.json('peer','/messenger/api/bootstrap')).channels.some(row=>row.id===room.id));
  await f.json('admin',`/api/members/${f.users.peer.id}/assignment`,'POST',{role:'manager',teamId:'marketing'});f.renew('peer');
  assert.ok(!(await f.json('peer','/messenger/api/bootstrap')).channels.some(row=>row.id===room.id),'a company team and role change cannot erase a departure');
  await f.restart();assert.ok(!(await f.json('peer','/messenger/api/bootstrap')).channels.some(row=>row.id===room.id));
  await f.json('owner',`/messenger/api/channels/${room.id}`,'DELETE');await f.json('owner',`/messenger/api/channels/${room.id}/restore`,'POST',{});
  assert.ok(!(await f.json('peer','/messenger/api/bootstrap')).channels.some(row=>row.id===room.id),'restoring a room cannot override an explicit departure');
  await f.json('owner',`/messenger/api/channels/${room.id}/members`,'POST',{memberIds:[f.states.peer.user.id]});
  assert.ok((await f.json('peer','/messenger/api/bootstrap')).channels.some(row=>row.id===room.id));
  await f.restart();assert.ok((await f.json('peer','/messenger/api/bootstrap')).channels.some(row=>row.id===room.id),'an explicit reinvitation is durable');
});

test('only a current project participant can leave; CSRF and non-project boundaries stay enforced',async t=>{
  const f=await fixture(t),room=await f.project(['peer']);
  const path=`/messenger/api/channels/${room.id}/leave`;
  for(const user of ['outsider','admin'])assert.equal((await f.request(user,path,{method:'POST',body:{}})).status,404);
  assert.equal((await f.request('peer',path,{method:'POST',body:{},headers:{'X-CSRF-Token':'wrong'}})).status,403);
  assert.ok((await f.json('peer','/messenger/api/bootstrap')).channels.some(row=>row.id===room.id));
  const generic=(await f.json('owner','/messenger/api/channels','POST',{name:'일반방',category:'generic'})).channel;
  const team=(await f.json('owner','/messenger/api/teams/marketing/channel','POST',{})).channel;
  const dm=(await f.json('owner','/messenger/api/dms','POST',{userId:f.states.peer.user.id})).channel;
  for(const channel of [generic,team,dm,...f.states.owner.channels.filter(row=>row.systemKey||row.kind==='self')]){
    assert.equal(channel.canLeave,false);
    assert.equal((await f.request('owner',`/messenger/api/channels/${channel.id}/leave`,{method:'POST',body:{}})).status,403);
  }
  await f.json('owner',`/messenger/api/channels/${room.id}`,'DELETE');
  assert.equal((await f.request('peer',path,{method:'POST',body:{}})).status,404);
});

test('a departing creator hands management to an active writing participant without retaining creator powers',async t=>{
  const f=await fixture(t),room=await f.project(['peer','viewer']);
  const message=(await f.json('owner',`/messenger/api/channels/${room.id}/messages`,'POST',{body:'생성자가 나가도 남는 프로젝트'})).message;
  const result=await f.json('owner',`/messenger/api/channels/${room.id}/leave`,'POST',{});assert.equal(result.newManagerId,f.states.peer.user.id);
  const next=(await f.json('peer','/messenger/api/bootstrap')).channels.find(row=>row.id===room.id);assert.equal(next.canManage,true);assert.equal(next.canInvite,true);
  assert.equal((await f.request('owner',`/messenger/api/channels/${room.id}/members`,{method:'POST',body:{memberIds:[f.states.outsider.user.id]}})).status,404);
  const repeated=await f.json('owner',`/messenger/api/channels/${room.id}/leave`,'POST',{});assert.equal(repeated.ok,true);
  await f.restart();
  assert.equal((await f.json('peer',`/messenger/api/messages/${message.id}`)).message.body,message.body);
  assert.ok(!(await f.json('owner','/messenger/api/bootstrap')).channels.some(row=>row.id===room.id));
  await f.json('peer',`/messenger/api/channels/${room.id}/members`,'POST',{memberIds:[f.states.owner.user.id]});
  const rejoined=(await f.json('owner','/messenger/api/bootstrap')).channels.find(row=>row.id===room.id);assert.equal(rejoined.canManage,false,'rejoining does not restore powers transferred to the new project manager');
});

test('a viewer can leave their own project and be explicitly reinvited without receiving write permissions',async t=>{
  const f=await fixture(t),room=await f.project(['viewer']);
  const before=(await f.json('viewer','/messenger/api/bootstrap')).channels.find(row=>row.id===room.id);assert.equal(before.canLeave,true);assert.equal(before.canPost,false);
  await f.json('viewer',`/messenger/api/channels/${room.id}/leave`,'POST',{});
  assert.ok(!(await f.json('viewer','/messenger/api/bootstrap')).channels.some(row=>row.id===room.id));
  assert.equal((await f.request('viewer',`/messenger/api/channels/${room.id}/members`,{method:'POST',body:{memberIds:[f.states.viewer.user.id]}})).status,403);
  await f.json('owner',`/messenger/api/channels/${room.id}/members`,'POST',{memberIds:[f.states.viewer.user.id]});
  assert.equal((await f.json('viewer','/messenger/api/bootstrap')).channels.find(row=>row.id===room.id).canPost,false);
  assert.equal((await f.request('viewer',`/messenger/api/channels/${room.id}/messages`,{method:'POST',body:{body:'작성 권한은 없음'}})).status,403);
});

test('the last participant can recover their automatically archived project after restart while outsiders cannot claim it',async t=>{
  const f=await fixture(t),room=await f.project([]);
  const message=(await f.json('owner',`/messenger/api/channels/${room.id}/messages`,'POST',{body:'혼자 쓰던 프로젝트 보존'})).message;
  const left=await f.json('owner',`/messenger/api/channels/${room.id}/leave`,'POST',{});assert.equal(left.archived,true);assert.equal(left.newManagerId,null);
  assert.ok(!(await f.json('owner','/messenger/api/bootstrap')).channels.some(row=>row.id===room.id));
  assert.equal((await f.request('owner',`/messenger/api/messages/${message.id}`)).status,404);
  await f.restart();
  const archived=(await f.json('owner','/messenger/api/channels/deleted')).channels.find(row=>row.id===room.id);assert.ok(archived);assert.equal(archived.archivedByLeave,true);assert.equal(archived.canRestore,true);
  for(const user of ['admin','outsider']){
    assert.ok(!(await f.json(user,'/messenger/api/channels/deleted')).channels.some(row=>row.id===room.id));
    assert.equal((await f.request(user,`/messenger/api/channels/${room.id}/restore`,{method:'POST',body:{}})).status,404);
  }
  const restored=(await f.json('owner',`/messenger/api/channels/${room.id}/restore`,'POST',{})).channel;
  assert.deepEqual(restored.memberIds,[f.states.owner.user.id]);assert.equal(restored.deletedAt,null);assert.equal(restored.canManage,true);
  assert.equal((await f.json('owner',`/messenger/api/messages/${message.id}`)).message.body,message.body);
  await f.restart();assert.ok((await f.json('owner','/messenger/api/bootstrap')).channels.some(row=>row.id===room.id));
});

test('a last remaining viewer can recover only their own departure archive without receiving writing or management permissions',async t=>{
  const f=await fixture(t),room=await f.project(['viewer']);
  await f.json('owner',`/messenger/api/channels/${room.id}/leave`,'POST',{});
  const left=await f.json('viewer',`/messenger/api/channels/${room.id}/leave`,'POST',{});assert.equal(left.archived,true);
  assert.equal((await f.json('viewer','/messenger/api/channels/deleted')).channels.find(row=>row.id===room.id).canRestore,true);
  assert.ok(!(await f.json('owner','/messenger/api/channels/deleted')).channels.some(row=>row.id===room.id),'the prior creator cannot claim a later participant\'s archive');
  const recovered=(await f.json('viewer',`/messenger/api/channels/${room.id}/restore`,'POST',{})).channel;
  assert.deepEqual(recovered.memberIds,[f.states.viewer.user.id]);assert.equal(recovered.canManage,false);assert.equal(recovered.canPost,false);assert.equal(recovered.canLeave,true);
  assert.equal((await f.request('viewer',`/messenger/api/channels/${room.id}/messages`,{method:'POST',body:{body:'여전히 조회 전용'}})).status,403);
});

test('a viewer restoring their public or selected archive needs current planning access and cannot forge restore purpose to post',async t=>{
  for(const scope of ['public','private']){
  const f=await fixture(t);
  for(const user of ['peer','outsider'])await f.json('admin',`/api/members/${f.users[user].id}/assignment`,'POST',{role:'manager',teamId:'marketing'});
  f.renew('peer');f.renew('outsider');
  const room=await f.project(['admin','peer','outsider','manager','viewer'],scope);
  f.app.store.put('channels','planning-source',{id:'planning-source',platform:'instagram',displayName:'기획 검토 채널',ownerIds:[f.users.owner.id],teamId:'marketing',active:true,canonicalUrl:'https://www.instagram.com/leavefixture/'});
  const draft=(await f.json('owner','/api/content-generate','POST',{seriesId:'synkbrief-use',topic:'조회 크루의 복원 권한',channelId:'planning-source'})).draft;
  const workspaceLink=(await f.json('owner',`/api/content-drafts/${draft.id}/share-targets`)).workspaceLink;
  const message=(await f.json('owner',`/messenger/api/channels/${room.id}/messages`,'POST',{body:'기획 원문을 함께 확인한 기록',workspaceLink})).message;
  for(const user of ['owner','admin','peer','outsider','manager'])await f.json(user,`/messenger/api/channels/${room.id}/leave`,'POST',{});
  assert.equal((await f.json('viewer',`/messenger/api/channels/${room.id}/leave`,'POST',{})).archived,true);
  await f.restart();
  await f.json('admin',`/api/members/${f.users.viewer.id}/assignment`,'POST',{role:'viewer',teamId:'design'});f.renew('viewer');
  const forbidden=await f.request('viewer',`/messenger/api/channels/${room.id}/restore`,{method:'POST',body:{}});assert.equal(forbidden.status,404,'restoration cannot recover source permission revoked while the room was archived');
  assert.ok((await f.json('viewer','/messenger/api/channels/deleted')).channels.some(row=>row.id===room.id));
  assert.equal(f.app.messenger.db.prepare('SELECT 1 FROM memberships WHERE channel_id=? AND user_id=?').get(room.id,f.states.viewer.user.id),undefined);
  await f.json('admin',`/api/members/${f.users.viewer.id}/assignment`,'POST',{role:'viewer',teamId:'marketing'});f.renew('viewer');
  const restored=(await f.json('viewer',`/messenger/api/channels/${room.id}/restore`,'POST',{})).channel;
  assert.equal(restored.scope,scope);assert.deepEqual(restored.memberIds,[f.states.viewer.user.id]);assert.equal(restored.canPost,false);
  assert.equal((await f.json('viewer',`/messenger/api/messages/${message.id}`)).message.workspaceLink.title,draft.title);
  assert.equal((await f.json('viewer',`/api/content-drafts/${draft.id}`)).draft.id,draft.id);
  assert.equal((await f.request('viewer',`/messenger/api/channels/${room.id}/messages`,{method:'POST',body:{body:'위조된 용도',workspaceLink,purpose:'restore'}})).status,403);
  assert.ok(!(await f.json('owner','/messenger/api/bootstrap')).channels.some(row=>row.id===room.id),'restoration must respect everyone else\'s departure');
  }
});
