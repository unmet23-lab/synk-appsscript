import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { Store } from './store.mjs';
import { createCompanyApp } from './server.mjs';

const password = 'disposable-collaboration-test';
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'synk-collaboration-test-'));
  const store = new Store(directory);
  const users = Object.fromEntries(['admin', 'member', 'peer', 'outsider', 'viewer'].map(key => [key, store.createUser({name:key,email:`${key}@example.test`,password,role:key === 'admin' ? 'admin' : key === 'viewer' ? 'viewer' : 'member'})]));
  const app = createCompanyApp({store, dataDir:directory, port:0, allowTestHost:true, schedule:false, messengerDriveStorage:{active:async()=>null,status:async()=>({provider:'local'})}});
  const address = await app.start(), base = `http://127.0.0.1:${address.port}`;
  t.after(async () => {
    await app.stop();
    const target=resolve(directory);
    assert.ok(target.startsWith(resolve(tmpdir())+sep) && target.split(sep).at(-1).startsWith('synk-collaboration-test-'));
    await rm(target,{recursive:true,force:true});
  });
  async function client(key) {
    let cookie='', csrf='';
    async function raw(path, method='GET', body, headers={}) {
      const response=await fetch(base+path,{method,headers:{Origin:app.origin,Cookie:cookie,'X-CSRF-Token':csrf,...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(6000)});
      const session=response.headers.getSetCookie().find(value=>value.startsWith('synk_company_session='));
      if(session)cookie=session.split(';')[0];
      return response;
    }
    async function json(path, method='GET', body) {
      const response=await raw(path,method,body), data=await response.json();
      assert.ok(response.ok,`${path}: ${response.status} ${JSON.stringify(data)}`);
      if(data.csrfToken)csrf=data.csrfToken;
      return data;
    }
    await json('/api/login','POST',{email:users[key].email,password});
    return {raw,json};
  }
  let admin=await client('admin');
  const team=(await admin.json('/api/teams','POST',{name:'검증팀'})).team;
  const otherTeam=(await admin.json('/api/teams','POST',{name:'외부팀'})).team;
  for(const key of Object.keys(users))await admin.json(`/api/members/${users[key].id}/assignment`,'POST',{...(key==='admin'?{}:{role:users[key].role}),teamId:key==='outsider'?otherTeam.id:team.id});
  const clients={};for(const key of Object.keys(users))clients[key]=await client(key);
  const states={};for(const key of Object.keys(users))states[key]=await clients[key].json('/messenger/api/bootstrap');
  const room=(await clients.member.json(`/messenger/api/teams/${team.id}/channel`,'POST',{})).channel;
  return {app,users,clients,states,room,otherTeam,client};
}

test('integrated viewers can manage personal attention and acknowledge notices without gaining posting or task rights', async t => {
  const {clients:c,states:s,room}=await fixture(t);
  const noticeRoom=s.admin.channels.find(row=>row.systemKey==='announcements');
  const notice=(await c.admin.json(`/messenger/api/channels/${noticeRoom.id}/messages`,'POST',{body:'검토 일정 확인',ackRequired:true})).message;
  await c.viewer.json(`/messenger/api/messages/${notice.id}/ack`,'POST',{});
  const acks=await c.admin.json(`/messenger/api/messages/${notice.id}/acks`);
  assert.ok(acks.acknowledged.some(row=>row.user.id===s.viewer.user.id));
  assert.ok(!acks.pending.some(row=>row.id===s.viewer.user.id));
  const message=(await c.member.json(`/messenger/api/channels/${room.id}/messages`,'POST',{body:'뷰어의 개인 저장과 멘션 검증',mentionIds:[s.viewer.user.id]})).message;
  await c.viewer.json(`/messenger/api/messages/${message.id}/save`,'POST',{});
  await c.viewer.json(`/messenger/api/messages/${message.id}/reminder`,'PUT',{remindAt:new Date(Date.now()+3600000).toISOString()});
  await c.viewer.json(`/messenger/api/channels/${room.id}/notifications`,'PATCH',{mode:'mute'});
  await c.viewer.json('/messenger/api/notifications/read-all','POST',{});
  const saved=await c.viewer.json('/messenger/api/saved');
  assert.ok(JSON.stringify(saved).includes(message.body));
  for(const [path,body] of [
    [`/messenger/api/channels/${room.id}/messages`,{body:'forbidden'}],
    [`/messenger/api/messages/${message.id}/task`,{title:'forbidden',assigneeId:s.viewer.user.id}],
  ])assert.equal((await c.viewer.raw(path,'POST',body)).status,403);
  assert.equal((await c.viewer.raw(`/messenger/api/messages/${message.id}/save`,'DELETE',undefined,{'X-CSRF-Token':'incorrect'})).status,403);
});

test('team transfer removes old team notifications, saved items, reminders and tasks; private attention is never visible to another crew', async t => {
  const {clients:c,states:s,room,users,otherTeam,client}=await fixture(t);
  const body='TEAM-ONLY collaboration secret';
  const message=(await c.member.json(`/messenger/api/channels/${room.id}/messages`,'POST',{body,mentionIds:[s.peer.user.id]})).message;
  await c.member.json(`/messenger/api/messages/${message.id}/task`,'POST',{title:'TEAM-ONLY task',assigneeId:s.peer.user.id,status:'todo'});
  await c.peer.json(`/messenger/api/messages/${message.id}/save`,'POST',{});
  await c.peer.json(`/messenger/api/messages/${message.id}/reminder`,'PUT',{remindAt:new Date(Date.now()+3600000).toISOString()});
  for(const path of ['/messenger/api/notifications','/messenger/api/saved','/messenger/api/reminders?status=all','/messenger/api/tasks?scope=mine']) {
    assert.ok(JSON.stringify(await c.peer.json(path)).includes(body),`${path} should contain the crew's item before transfer`);
    assert.ok(!JSON.stringify(await c.outsider.json(path)).includes(body),`${path} must be private`);
  }
  await c.admin.json(`/api/members/${users.peer.id}/assignment`,'POST',{role:users.peer.role,teamId:otherTeam.id});
  const moved=await client('peer');
  for(const path of ['/messenger/api/notifications','/messenger/api/saved','/messenger/api/reminders?status=all','/messenger/api/tasks?scope=mine','/messenger/api/search?q=TEAM-ONLY'])assert.ok(!JSON.stringify(await moved.json(path)).includes(body),`${path} leaked a revoked team's message`);
  assert.equal((await moved.raw(`/messenger/api/messages/${message.id}`)).status,404);
  assert.equal((await c.outsider.raw(`/messenger/api/messages/${message.id}/save`,'POST',{})).status,404);
  assert.equal((await c.member.raw(`/messenger/api/messages/${message.id}/task`,'PATCH',{assigneeId:s.outsider.user.id})).status,400);
});
