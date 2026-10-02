import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {createCompanyApp} from './server.mjs';

async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-project-integration-'));
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,messengerDriveStorage:{active:async()=>null,status:async()=>({provider:'local'})}});
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-project-integration-'));await rm(directory,{recursive:true,force:true});});
  for(const id of ['marketing','design'])app.store.put('teams',id,{id,name:id==='marketing'?'마케팅팀':'디자인팀',active:true,createdAt:new Date().toISOString()});
  const users={},sessions={};
  function addUser(name,role='member',teamId='marketing'){
    const user=app.store.createUser({name,email:name+'@example.test',role,teamId});users[name]=user;renew(name);return user;
  }
  function renew(name){sessions[name]=app.store.mint('session',users[name].id,{csrfToken:'project-csrf'},20);}
  addUser('admin','admin',null);addUser('owner');addUser('peer','member','design');addUser('outsider');addUser('manager','manager');addUser('viewer','viewer');
  const address=await app.start(),base=`http://127.0.0.1:${address.port}`;
  async function request(user,path,{method='GET',body,headers={}}={}){
    return fetch(base+path,{method,headers:{Cookie:`synk_company_session=${sessions[user]}`,Origin:app.origin,'X-CSRF-Token':'project-csrf',...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(6000)});
  }
  async function json(user,path,method='GET',body){
    const response=await request(user,path,{method,body}),data=await response.json();assert.ok(response.ok,`${user} ${method} ${path}: ${response.status} ${JSON.stringify(data)}`);return data;
  }
  const states={};for(const name of Object.keys(users))states[name]=await json(name,'/messenger/api/bootstrap');
  async function project(memberNames=['peer'],name='선택한 크루의 프로젝트'){
    return(await json('owner','/messenger/api/channels','POST',{name,category:'project',memberIds:memberNames.map(key=>states[key].user.id)})).channel;
  }
  return{app,users,states,request,json,project,addUser,renew};
}

test('a selected project spans teams but never grants an uninvited administrator conversation access',async t=>{
  const f=await fixture(t),room=await f.project();
  assert.equal(room.scope,'private');assert.equal(room.category,'project');assert.deepEqual(new Set(room.memberIds),new Set([f.states.owner.user.id,f.states.peer.user.id]));
  assert.equal(room.canInvite,true);
  for(const body of [{scope:'public'},{category:'generic'},{memberIds:[f.states.admin.user.id]}])assert.equal((await f.request('owner',`/messenger/api/channels/${room.id}`,{method:'PATCH',body})).status,400,'ordinary edits cannot widen the project audience or bypass invitations');
  const participantList=await f.json('peer',`/messenger/api/channels/${room.id}/members`);
  assert.equal(participantList.channel.canInvite,false);assert.deepEqual(new Set(participantList.members.map(row=>row.id)),new Set(room.memberIds));
  const message=(await f.json('owner',`/messenger/api/channels/${room.id}/messages`,'POST',{body:'PROJECT-PRIVATE cross-team brief'})).message;
  assert.ok((await f.json('peer',`/messenger/api/channels/${room.id}/messages`)).messages.some(row=>row.id===message.id));
  for(const user of ['admin','outsider']){
    const bootstrap=await f.json(user,'/messenger/api/bootstrap');assert.ok(!bootstrap.channels.some(row=>row.id===room.id));
    for(const path of [`/messenger/api/channels/${room.id}/members`,`/messenger/api/channels/${room.id}/messages`,`/messenger/api/messages/${message.id}`,`/messenger/api/files?channelId=${room.id}`])assert.equal((await f.request(user,path)).status,404,`${user} ${path}`);
    const search=await f.json(user,'/messenger/api/search?q=PROJECT-PRIVATE');assert.ok(!JSON.stringify(search).includes(message.body));
    assert.equal((await f.request(user,`/messenger/api/channels/${room.id}/members`,{method:'POST',body:{memberIds:[f.states[user].user.id]}})).status,404);
  }
  assert.equal((await f.request('viewer','/messenger/api/channels',{method:'POST',body:{name:'readonly',category:'project',memberIds:[f.states.owner.user.id]}})).status,403);
});

test('new employees join legacy public projects while selected projects stay private through roster synchronization',async t=>{
  const f=await fixture(t),room=await f.project();
  // This is an isolated legacy fixture: the old API created category=project rooms with public scope.
  const legacy=(await f.json('owner','/messenger/api/channels','POST',{name:'기존 공개 프로젝트',category:'generic'})).channel;
  f.app.messenger.db.prepare("UPDATE channels SET category='project' WHERE id=?").run(legacy.id);
  f.addUser('newcomer','member','design');const newcomer=await f.json('newcomer','/messenger/api/bootstrap');
  assert.ok(newcomer.channels.some(row=>row.id===legacy.id&&row.scope==='public'&&row.category==='project'));
  assert.ok(newcomer.channels.some(row=>row.systemKey==='info'));assert.ok(!newcomer.channels.some(row=>row.id===room.id));
  const owner=await f.json('owner','/messenger/api/bootstrap');assert.deepEqual(new Set(owner.channels.find(row=>row.id===room.id).memberIds),new Set([f.states.owner.user.id,f.states.peer.user.id]));
});

test('suspension removes selected project membership and reactivation requires an explicit invitation',async t=>{
  const f=await fixture(t),room=await f.project();
  const message=(await f.json('owner',`/messenger/api/channels/${room.id}/messages`,'POST',{body:'이용 중지 전에 작성한 내용'})).message;
  await f.json('admin',`/api/members/${f.users.peer.id}/status`,'POST',{active:false});
  assert.equal((await f.request('peer',`/messenger/api/messages/${message.id}`)).status,401);
  const after=(await f.json('owner','/messenger/api/bootstrap')).channels.find(row=>row.id===room.id);
  assert.ok(!after.memberIds.includes(f.states.peer.user.id));
  assert.equal(f.app.messenger.db.prepare('SELECT 1 FROM memberships WHERE channel_id=? AND user_id=?').get(room.id,f.states.peer.user.id),undefined);
  await f.json('admin',`/api/members/${f.users.peer.id}/status`,'POST',{active:true});f.renew('peer');
  assert.ok(!(await f.json('peer','/messenger/api/bootstrap')).channels.some(row=>row.id===room.id));
  assert.equal((await f.request('peer',`/messenger/api/messages/${message.id}`)).status,404);
  await f.json('owner',`/messenger/api/channels/${room.id}/members`,'POST',{memberIds:[f.states.peer.user.id]});
  assert.equal((await f.json('peer',`/messenger/api/messages/${message.id}`)).message.id,message.id);
});

test('only an authorized project manager can add active participants and CSRF failure cannot change membership',async t=>{
  const f=await fixture(t),room=await f.project(['peer','viewer']);
  const path=`/messenger/api/channels/${room.id}/members`,body={memberIds:[f.states.outsider.user.id]};
  assert.equal((await f.request('peer',path,{method:'POST',body})).status,403);
  assert.equal((await f.request('viewer',path,{method:'POST',body})).status,403);
  assert.equal((await f.request('owner',path,{method:'POST',body,headers:{'X-CSRF-Token':'wrong'}})).status,403);
  assert.ok(!(await f.json('outsider','/messenger/api/bootstrap')).channels.some(row=>row.id===room.id));
  await f.json('owner',path,'POST',{memberIds:[f.states.admin.user.id]});
  const added=await f.json('admin',path,'POST',body);assert.ok(added.channel.memberIds.includes(f.states.outsider.user.id));
  await f.json('admin',path,'POST',body);
  const members=(await f.json('owner','/messenger/api/bootstrap')).channels.find(row=>row.id===room.id).memberIds;
  assert.equal(members.filter(id=>id===f.states.outsider.user.id).length,1);
  await f.json('admin',`/api/members/${f.users.outsider.id}/status`,'POST',{active:false});
  const inactive=await f.request('owner',path,{method:'POST',body});assert.ok([400,404].includes(inactive.status));
});

test('selected project review cards preserve source permissions for current and subsequently invited participants',async t=>{
  const f=await fixture(t),room=await f.project(['manager'],'기획 검토 프로젝트');
  f.app.store.put('channels','plan-channel',{id:'plan-channel',platform:'instagram',displayName:'임시 기획 채널',ownerIds:[f.users.owner.id],teamId:'marketing',active:true,canonicalUrl:'https://www.instagram.com/projectfixture/'});
  const draft=(await f.json('owner','/api/content-generate','POST',{seriesId:'synkbrief-use',topic:'선택한 검토자에게만 보이는 기획',channelId:'plan-channel',proof:'원문 자료를 메시지에 복사하지 않음'})).draft;
  const targets=await f.json('owner',`/api/content-drafts/${draft.id}/share-targets`),workspaceLink=targets.workspaceLink;
  assert.equal(targets.channels.find(row=>row.id===room.id).allowed,true);
  const posted=(await f.json('owner',`/messenger/api/channels/${room.id}/messages`,'POST',{body:'기획 검토 부탁해요.',workspaceLink})).message;
  assert.equal(posted.workspaceLink.title,draft.title);assert.ok(!JSON.stringify(posted).includes('원문 자료를 메시지에 복사하지 않음'));
  const rejected=await f.request('owner',`/messenger/api/channels/${room.id}/members`,{method:'POST',body:{memberIds:[f.states.peer.user.id]}});
  assert.equal(rejected.status,403,'inviting a person must not expose a previously protected card title');
  assert.ok(!(await f.json('peer','/messenger/api/bootstrap')).channels.some(row=>row.id===room.id));
  await f.json('owner',`/messenger/api/channels/${room.id}/members`,'POST',{memberIds:[f.states.admin.user.id]});
  assert.equal((await f.json('admin',`/messenger/api/messages/${posted.id}`)).message.workspaceLink.title,draft.title);
  // A project remains cross-team, but the linked source still follows the current company team/role.
  await f.json('admin',`/api/members/${f.users.manager.id}/assignment`,'POST',{role:'manager',teamId:'design'});f.renew('manager');
  assert.ok((await f.json('manager','/messenger/api/bootstrap')).channels.some(row=>row.id===room.id));
  assert.equal((await f.request('manager',`/api/content-drafts/${draft.id}`)).status,404);
  const updated=await f.json('owner',`/api/content-drafts/${draft.id}/share-targets`);assert.equal(updated.channels.find(row=>row.id===room.id).allowed,false);
  for(const [path,method] of [[`/messenger/api/channels/${room.id}/messages`,'POST'],[`/messenger/api/messages/${posted.id}`,'PATCH']])assert.equal((await f.request('owner',path,{method,body:{body:'변경된 권한으로 다시 공유 시도',workspaceLink}})).status,403);
  assert.equal((await f.json('owner',`/messenger/api/channels/${room.id}/messages`,'POST',{body:'원문 링크 없는 일반 프로젝트 대화'})).message.body,'원문 링크 없는 일반 프로젝트 대화');
});
