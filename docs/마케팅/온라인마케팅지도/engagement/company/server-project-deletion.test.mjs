import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {createCompanyApp} from './server.mjs';

async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-project-deletion-'));
  const options={dataDir:directory,port:0,allowTestHost:true,schedule:false,messengerDriveStorage:{active:async()=>null,status:async()=>({provider:'local'})}};
  let app=createCompanyApp(options),base;
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-project-deletion-'));await rm(directory,{recursive:true,force:true});});
  for(const id of ['marketing','design'])app.store.put('teams',id,{id,name:id,active:true,createdAt:new Date().toISOString()});
  const users={},sessions={};
  function renew(name){sessions[name]=app.store.mint('session',users[name].id,{csrfToken:'deletion-csrf'},20);}
  function addUser(name,role='member',teamId='marketing'){users[name]=app.store.createUser({name,email:name+'@example.test',role,teamId});renew(name);return users[name];}
  addUser('admin','admin',null);addUser('owner');addUser('peer','member','design');addUser('outsider');addUser('manager','manager');addUser('viewer','viewer');
  async function start(){const address=await app.start();base=`http://127.0.0.1:${address.port}`;}
  await start();
  async function restart(){await app.stop();app=createCompanyApp(options);await start();}
  async function request(user,path,{method='GET',body,raw,headers={}}={}){
    return fetch(base+path,{method,headers:{Cookie:`synk_company_session=${sessions[user]}`,Origin:app.origin,'X-CSRF-Token':'deletion-csrf',...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(raw!==undefined?{body:raw}:body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(6000)});
  }
  async function json(user,path,method='GET',body){const response=await request(user,path,{method,body}),data=await response.json();assert.ok(response.ok,`${user} ${method} ${path}: ${response.status} ${JSON.stringify(data)}`);return data;}
  const states={};for(const name of Object.keys(users))states[name]=await json(name,'/messenger/api/bootstrap');
  async function project(names=['peer'],scope='private'){return(await json('owner','/messenger/api/channels','POST',{name:'임시 삭제 검증 프로젝트',category:'project',scope,...(scope==='private'?{memberIds:names.map(name=>states[name].user.id)}:{})})).channel;}
  async function plan(){
    app.store.put('channels','planning-source',{id:'planning-source',platform:'instagram',displayName:'검증 기획 채널',ownerIds:[users.owner.id],teamId:'marketing',active:true,canonicalUrl:'https://www.instagram.com/deletefixture/'});
    return(await json('owner','/api/content-generate','POST',{seriesId:'synkbrief-use',topic:'삭제 및 복원 권한 검토',channelId:'planning-source'})).draft;
  }
  return{get app(){return app;},users,states,request,json,project,plan,restart,addUser,renew};
}

test('deletion and restoration require a participating creator or admin; viewers, outsiders and protected rooms cannot bypass it',async t=>{
  const f=await fixture(t),room=await f.project(['peer','viewer']);
  const path=`/messenger/api/channels/${room.id}`;
  assert.equal(room.canDelete,true);
  for(const [user,status] of [['peer',403],['viewer',403],['outsider',404],['admin',404]])assert.equal((await f.request(user,path,{method:'DELETE'})).status,status);
  assert.equal((await f.request('owner',path,{method:'DELETE',headers:{'X-CSRF-Token':'wrong'}})).status,403);
  await f.json('owner',path+'/members','POST',{memberIds:[f.states.admin.user.id]});
  await f.json('admin',path,'DELETE');await f.json('admin',path,'DELETE');
  const deleted=(await f.json('owner','/messenger/api/channels/deleted')).channels.find(row=>row.id===room.id);
  assert.ok(deleted.deletedAt);assert.equal(deleted.deletedBy.id,f.states.admin.user.id);assert.equal(deleted.canRestore,true);
  assert.equal(deleted.canPost,false);assert.equal(deleted.canManage,false);assert.equal(deleted.canInvite,false);
  for(const user of ['peer','viewer','outsider'])assert.ok(!(await f.json(user,'/messenger/api/channels/deleted')).channels.some(row=>row.id===room.id));
  for(const [user,status] of [['peer',403],['viewer',403],['outsider',404]])assert.equal((await f.request(user,path+'/restore',{method:'POST',body:{}})).status,status);
  assert.equal((await f.request('owner',path+'/restore',{method:'POST',body:{},headers:{'X-CSRF-Token':'wrong'}})).status,403);
  const restored=(await f.json('owner',path+'/restore','POST',{})).channel;assert.equal(restored.id,room.id);assert.equal(restored.deletedAt,null);assert.deepEqual(new Set(restored.memberIds),new Set([...room.memberIds,f.states.admin.user.id]));
  await f.json('owner',path+'/restore','POST',{});
  const ordinary=(await f.json('owner','/messenger/api/channels','POST',{name:'일반 공개방',category:'generic'})).channel;
  const team=(await f.json('owner','/messenger/api/teams/marketing/channel','POST',{})).channel;
  const dm=(await f.json('owner','/messenger/api/dms','POST',{userId:f.states.peer.user.id})).channel;
  for(const id of [ordinary.id,team.id,dm.id,...f.states.owner.channels.filter(row=>row.systemKey||row.kind==='self').map(row=>row.id)])assert.equal((await f.request('owner',`/messenger/api/channels/${id}`,{method:'DELETE'})).status,403);
});

test('a deleted project stays inaccessible after restart and restores its exact message, file and personal collaboration records',async t=>{
  const f=await fixture(t),room=await f.project(['manager']),draft=await f.plan();
  const workspaceLink=(await f.json('owner',`/api/content-drafts/${draft.id}/share-targets`)).workspaceLink;
  const fileBytes=Buffer.from('PROJECT-TOMBSTONE file content\n정확한 원본 보존');
  const upload=await f.request('owner',`/messenger/api/channels/${room.id}/files`,{method:'POST',raw:fileBytes,headers:{'Content-Type':'application/octet-stream','X-File-Name':encodeURIComponent('PROJECT-TOMBSTONE.txt')}});assert.equal(upload.status,201);const file=(await upload.json()).file;
  const message=(await f.json('owner',`/messenger/api/channels/${room.id}/messages`,'POST',{body:'PROJECT-TOMBSTONE 검토 기록',fileIds:[file.id],mentionIds:[f.states.manager.user.id],workspaceLink})).message;
  await f.json('owner',`/messenger/api/messages/${message.id}/task`,'POST',{title:'검토 업무 보존',assigneeId:f.states.manager.user.id});
  await f.json('manager',`/messenger/api/messages/${message.id}/save`,'POST',{});
  const reminder=(await f.json('manager',`/messenger/api/messages/${message.id}/reminder`,'PUT',{remindAt:new Date(Date.now()+3600000).toISOString()})).reminder;
  const original=(await f.json('manager',`/messenger/api/messages/${message.id}`)).message;
  const notifications=(await f.json('manager','/messenger/api/notifications')).items.map(row=>row.id);
  assert.ok(notifications.length>0);
  await f.json('owner',`/messenger/api/channels/${room.id}`,'DELETE');
  // Advance only this disposable reminder past its deadline. Startup and notifications both run delivery.
  f.app.messenger.db.prepare('UPDATE message_reminders SET remind_at=? WHERE id=?').run(new Date(Date.now()-1000).toISOString(),reminder.id);
  await f.restart();
  for(const user of ['owner','manager']){
    assert.ok(!(await f.json(user,'/messenger/api/bootstrap')).channels.some(row=>row.id===room.id));
    for(const path of [`/messenger/api/channels/${room.id}/messages`,`/messenger/api/messages/${message.id}`,file.url,`/messenger/api/files?channelId=${room.id}`,`/messenger/api/tasks?scope=channel&channelId=${room.id}`])assert.equal((await f.request(user,path)).status,404,path);
    for(const path of ['/messenger/api/search?q=PROJECT-TOMBSTONE','/messenger/api/files?q=PROJECT-TOMBSTONE','/messenger/api/saved','/messenger/api/tasks?scope=mine','/messenger/api/notifications','/messenger/api/reminders?status=all'])assert.ok(!JSON.stringify(await f.json(user,path)).includes('PROJECT-TOMBSTONE'),path);
  }
  const targets=await f.json('owner',`/api/content-drafts/${draft.id}/share-targets`);assert.ok(!targets.channels.some(row=>row.id===room.id));
  for(const [path,method,body] of [[`/messenger/api/channels/${room.id}/messages`,'POST',{body:'금지'}],[`/messenger/api/messages/${message.id}`,'PATCH',{body:'금지'}],[`/messenger/api/messages/${message.id}`,'DELETE',undefined],[`/messenger/api/channels/${room.id}/members`,'POST',{memberIds:[f.states.admin.user.id]}],[`/messenger/api/messages/${message.id}/save`,'POST',{}]])assert.equal((await f.request('owner',path,{method,body})).status,404,path);
  assert.equal((await f.request('owner',`/messenger/api/channels/${room.id}/files`,{method:'POST',raw:Buffer.from('blocked'),headers:{'Content-Type':'application/octet-stream','X-File-Name':'blocked.txt'}})).status,404);
  assert.ok(f.app.messenger.db.prepare('SELECT 1 FROM message_reminders WHERE id=?').get(reminder.id),'a due reminder must be retained while the room is deleted');
  await f.json('owner',`/messenger/api/channels/${room.id}/restore`,'POST',{});
  const restored=(await f.json('manager',`/messenger/api/messages/${message.id}`)).message;
  for(const key of ['id','channelId','body','files','user','createdAt','workspaceLink','mentions','task','saved'])assert.deepEqual(restored[key],original[key],key);
  assert.deepEqual(Buffer.from(await(await f.request('manager',file.url)).arrayBuffer()),fileBytes);
  assert.equal(restored.reminder.id,reminder.id);
  const delivered=(await f.json('manager','/messenger/api/notifications')).items;
  assert.ok(notifications.every(id=>delivered.some(row=>row.id===id)));assert.ok(delivered.some(row=>row.kind==='reminder'&&row.message.id===message.id));
  assert.ok(JSON.stringify(await f.json('manager','/messenger/api/saved')).includes(message.body));assert.ok(JSON.stringify(await f.json('manager','/messenger/api/tasks?scope=mine')).includes(message.body));
  assert.equal((await f.json('owner',`/api/content-drafts/${draft.id}/share-targets`)).channels.find(row=>row.id===room.id).allowed,true);
});

test('deleted public and selected projects cannot reappear during new employee synchronization; restoration keeps each audience policy',async t=>{
  const f=await fixture(t),privateRoom=await f.project(),publicRoom=await f.project([],'public');
  for(const room of [privateRoom,publicRoom])await f.json('owner',`/messenger/api/channels/${room.id}`,'DELETE');
  f.addUser('newcomer');f.addUser('newadmin','admin',null);
  for(const user of ['newcomer','newadmin']){
    const state=await f.json(user,'/messenger/api/bootstrap');assert.ok(state.channels.some(row=>row.systemKey==='info'));
    assert.ok(!state.channels.some(row=>[privateRoom.id,publicRoom.id].includes(row.id)));
    assert.ok(!(await f.json(user,'/messenger/api/channels/deleted')).channels.some(row=>[privateRoom.id,publicRoom.id].includes(row.id)));
    assert.equal((await f.request(user,`/messenger/api/channels/${publicRoom.id}/restore`,{method:'POST',body:{}})).status,404);
  }
  await f.restart();
  assert.ok(!(await f.json('newcomer','/messenger/api/bootstrap')).channels.some(row=>row.id===publicRoom.id));
  const publicRestored=(await f.json('admin',`/messenger/api/channels/${publicRoom.id}/restore`,'POST',{})).channel;assert.equal(publicRestored.scope,'public');
  assert.ok((await f.json('newcomer','/messenger/api/bootstrap')).channels.some(row=>row.id===publicRoom.id));
  const privateRestored=(await f.json('owner',`/messenger/api/channels/${privateRoom.id}/restore`,'POST',{})).channel;assert.equal(privateRestored.scope,'private');assert.deepEqual(new Set(privateRestored.memberIds),new Set(privateRoom.memberIds));
  assert.ok(!(await f.json('newcomer','/messenger/api/bootstrap')).channels.some(row=>row.id===privateRoom.id));
});

test('employment revocation while a selected project is deleted survives restoration and reactivation',async t=>{
  const f=await fixture(t),room=await f.project(['admin','peer']);
  await f.json('owner',`/messenger/api/channels/${room.id}`,'DELETE');
  for(const user of ['owner','peer'])await f.json('admin',`/api/members/${f.users[user].id}/status`,'POST',{active:false});
  assert.equal((await f.request('owner',`/messenger/api/channels/${room.id}/restore`,{method:'POST',body:{}})).status,401);
  await f.json('admin',`/api/members/${f.users.peer.id}/status`,'POST',{active:true});f.renew('peer');
  await f.restart();
  const restored=(await f.json('admin',`/messenger/api/channels/${room.id}/restore`,'POST',{})).channel;
  assert.deepEqual(restored.memberIds,[f.states.admin.user.id]);
  assert.ok(!(await f.json('peer','/messenger/api/bootstrap')).channels.some(row=>row.id===room.id));
  assert.equal((await f.request('peer',`/messenger/api/channels/${room.id}/messages`)).status,404);
});

test('restoring an old review card does not restore lost source permissions or allow sharing to the changed audience',async t=>{
  const f=await fixture(t),room=await f.project(['manager']),draft=await f.plan();
  const workspaceLink=(await f.json('owner',`/api/content-drafts/${draft.id}/share-targets`)).workspaceLink;
  const message=(await f.json('owner',`/messenger/api/channels/${room.id}/messages`,'POST',{body:'기록으로 남긴 검토 요청',workspaceLink})).message;
  await f.json('owner',`/messenger/api/channels/${room.id}`,'DELETE');
  await f.json('admin',`/api/members/${f.users.manager.id}/assignment`,'POST',{role:'manager',teamId:'design'});f.renew('manager');
  await f.json('owner',`/messenger/api/channels/${room.id}/restore`,'POST',{});
  assert.equal((await f.json('manager',`/messenger/api/messages/${message.id}`)).message.workspaceLink.title,draft.title,'previously shared title stays in history');
  assert.equal((await f.request('manager',`/api/content-drafts/${draft.id}`)).status,404,'source access is evaluated now');
  assert.equal((await f.json('owner',`/api/content-drafts/${draft.id}/share-targets`)).channels.find(row=>row.id===room.id).allowed,false);
  for(const [path,method] of [[`/messenger/api/channels/${room.id}/messages`,'POST'],[`/messenger/api/messages/${message.id}`,'PATCH']])assert.equal((await f.request('owner',path,{method,body:{body:'새 검토 요청',workspaceLink}})).status,403);
});

test('public project restoration atomically rejects a new audience that cannot read its previously shared planning card',async t=>{
  const f=await fixture(t);
  // Before deletion every employee can read this channel-linked draft.
  for(const user of ['peer','outsider'])await f.json('admin',`/api/members/${f.users[user].id}/assignment`,'POST',{role:'manager',teamId:'marketing'});
  const room=await f.project([],'public'),draft=await f.plan();
  const workspaceLink=(await f.json('owner',`/api/content-drafts/${draft.id}/share-targets`)).workspaceLink;
  const message=(await f.json('owner',`/messenger/api/channels/${room.id}/messages`,'POST',{body:'공개 프로젝트의 기존 기획 검토',workspaceLink})).message;
  await f.json('owner',`/messenger/api/channels/${room.id}`,'DELETE');
  f.addUser('newcomer');const newcomer=await f.json('newcomer','/messenger/api/bootstrap');
  assert.equal((await f.request('owner',`/messenger/api/channels/${room.id}/restore`,{method:'POST',body:{}})).status,403);
  assert.ok((await f.json('owner','/messenger/api/channels/deleted')).channels.some(row=>row.id===room.id));
  assert.equal(f.app.messenger.db.prepare('SELECT 1 FROM memberships WHERE channel_id=? AND user_id=?').get(room.id,newcomer.user.id),undefined,'failed restoration cannot partially enroll the new audience');
  assert.equal((await f.request('newcomer',`/messenger/api/messages/${message.id}`)).status,404);
  await f.json('admin',`/api/members/${f.users.newcomer.id}/assignment`,'POST',{role:'manager',teamId:'marketing'});f.renew('newcomer');
  const restored=(await f.json('owner',`/messenger/api/channels/${room.id}/restore`,'POST',{})).channel;
  assert.equal(restored.scope,'public');assert.ok(restored.memberIds.includes(newcomer.user.id));
  assert.equal((await f.json('newcomer',`/messenger/api/messages/${message.id}`)).message.workspaceLink.title,draft.title);
  assert.equal((await f.json('newcomer',`/api/content-drafts/${draft.id}`)).draft.id,draft.id);
});
