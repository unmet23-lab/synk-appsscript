import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCompanyApp } from './server.mjs';
import { today } from './store.mjs';
import { shiftDate } from '../analytics.mjs';

async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-team-overview-'));
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false});
  const address=await app.start(),base=`http://127.0.0.1:${address.port}`;
  t.after(async()=>{await app.stop();await rm(directory,{recursive:true,force:true});});
  const store=app.store,end=today(),start=shiftDate(end,-1),baseline=shiftDate(start,-1);
  for(const [id,active] of [['alpha',true],['beta',true],['empty',true],['inactive',false]])store.put('teams',id,{id,name:id,active});
  const users={};
  for(const [name,role,teamId,active] of [
    ['admin','admin','alpha',true],['manager','manager','alpha',true],['member','member','alpha',true],
    ['peer','member','alpha',true],['viewer','viewer','alpha',true],['other','member','beta',true],
    ['disabled','member','alpha',false],['unassigned','member',null,true],['inactiveTeam','manager','inactive',true],
  ]){
    const user=store.createUser({name,email:`${name}@example.test`,role,teamId});
    users[name]=store.put('users',user.id,{...user,active});
  }
  function channel(id,teamId,owners,values,followers,extra={}){
    const channel={id,teamId,ownerIds:owners.map(owner=>users[owner].id),platform:'youtube',displayName:id,active:true,status:'not-connected',...extra};
    store.put('channels',id,channel);
    const postId=`post-${id}`;
    store.put('posts',postId,{id:postId,channelId:id,title:id,publishedDate:shiftDate(baseline,-1)});
    for(const [i,date] of [baseline,start,end].entries()){
      if(values?.[i]!==undefined)store.put('snapshots',`${postId}:${date}`,{id:`${postId}:${date}`,postId,date,views:values[i]});
      if(followers?.[i]!==undefined)store.put('channelSnapshots',`${id}:${date}`,{id:`${id}:${date}`,channelId:id,date,followers:followers[i]});
    }
    return channel;
  }
  channel('alpha-owned','alpha',['member'],[100,150,220],[10,15,18]);
  channel('alpha-zero','alpha',['peer'],[0,0,0],[0,0,0]);
  channel('alpha-unknown','alpha',['manager']);
  channel('beta-owned','beta',['other','member'],[900,950,999],[90,95,99]);
  channel('inactive-owned','inactive',['inactiveTeam'],[5000,6000,7000],[500,600,700]);
  store.setSecret('channel:alpha-owned',{apiKey:'fixture-only-secret'});
  const cookies=new Map();
  for(const user of Object.values(users))cookies.set(user.id,`synk_company_session=${store.mint('session',user.id,{csrfToken:'fixture-csrf'},10)}`);
  const query=`?start=${start}&end=${end}`;
  async function get(person='admin',suffix=query){
    const response=await fetch(base+'/api/team-overview'+suffix,{headers:{Cookie:person?cookies.get(users[person].id):''}});
    return {status:response.status,data:await response.json()};
  }
  return {app,store,users,end,start,baseline,query,get,channel};
}

test('team overview compares the selected period, preserving zero, unknown and empty teams',async t=>{
  const {get,start,end,baseline}=await fixture(t);
  const result=await get();assert.equal(result.status,200);
  assert.equal(result.data.start,start);assert.equal(result.data.end,end);
  assert.deepEqual(result.data.teams.map(team=>team.id),['alpha','beta','empty']);
  const [alpha,beta,empty]=result.data.teams;
  assert.deepEqual([alpha.memberCount,alpha.channelCount,alpha.connectedCount,alpha.postCount,alpha.newPosts],[5,3,1,3,0]);
  assert.equal(alpha.metrics.views.latest,220);assert.equal(alpha.metrics.views.latestCount,2);assert.equal(alpha.metrics.views.eligible,3);
  assert.equal(alpha.metrics.views.day.delta,70);assert.equal(alpha.metrics.views.period.delta,120);
  assert.equal(alpha.metrics.views.period.rate,120);assert.equal(alpha.metrics.views.period.baseDate,baseline);
  assert.equal(alpha.metrics.views.period.endDate,end);assert.equal(alpha.metrics.views.period.complete,false);
  assert.equal(alpha.metrics.views.period.count,2);assert.equal(alpha.metrics.followers.latest,18);
  assert.equal(alpha.metrics.followers.day.delta,3);assert.equal(alpha.metrics.followers.period.delta,8);
  assert.equal(alpha.metrics.likes.latest,null);assert.equal(alpha.metrics.likes.period.delta,null);
  assert.deepEqual([beta.memberCount,beta.channelCount,beta.metrics.views.latest,beta.metrics.views.period.delta],[1,1,999,99]);
  assert.deepEqual([empty.memberCount,empty.channelCount,empty.connectedCount,empty.postCount],[0,0,0,0]);
  for(const metric of Object.values(empty.metrics)){
    assert.equal(metric.latest,null);assert.equal(metric.total,null);assert.equal(metric.eligible,0);
    assert.equal(metric.period.delta,null);assert.equal(metric.period.rate,null);assert.equal(metric.period.complete,false);
  }
  const zero=await get('peer');assert.equal(zero.data.teams[0].metrics.views.latest,0);assert.equal(zero.data.teams[0].metrics.views.period.delta,0);
  assert.equal(zero.data.teams[0].metrics.views.period.rate,null);
  const serialized=JSON.stringify(result.data);
  for(const secret of ['@example.test','fixture-only-secret','ownerIds','accessToken','apiKey'])assert.equal(serialized.includes(secret),false);
});

test('team overview respects current role, member visibility and active team limits without query escalation',async t=>{
  const {get,store,users,query}=await fixture(t);
  assert.equal((await get(null)).status,401);assert.equal((await get('disabled')).status,401);
  for(const person of ['manager','viewer']){
    const result=await get(person,query+'&teamId=beta&scope=all&ownerId='+users.other.id);
    assert.equal(result.status,200);assert.deepEqual(result.data.teams.map(team=>team.id),['alpha']);
    assert.equal(result.data.teams[0].channelCount,3);assert.equal(result.data.teams[0].metrics.views.latest,220);
  }
  const member=(await get('member',query+'&teamId=beta')).data.teams;
  assert.equal(member.length,1);assert.equal(member[0].id,'alpha');assert.equal(member[0].memberCount,1);
  assert.equal(member[0].channelCount,1);assert.equal(member[0].metrics.views.eligible,1);
  assert.equal(member[0].metrics.views.period.complete,true);
  assert.deepEqual((await get('unassigned')).data.teams,[]);
  assert.deepEqual((await get('inactiveTeam')).data.teams,[]);
  store.put('users',users.member.id,{...users.member,teamId:'beta'});
  assert.deepEqual((await get('member')).data.teams.map(team=>team.id),['beta']);
  store.put('users',users.member.id,{...users.member,active:false});
  assert.equal((await get('member')).status,401);
  store.put('teams','beta',{id:'beta',name:'beta',active:false});
  assert.deepEqual((await get()).data.teams.map(team=>team.id),['alpha','empty']);
});

test('team overview reads each record collection once and filters retention without changing stored data',async t=>{
  const {get,store,channel,end,baseline}=await fixture(t);
  channel('archived','alpha',['manager'],[4,5,8],[1,2,3],{active:false});
  store.setSecret('channel:archived',{apiKey:'fixture-only-archived'});
  const expired='2000-01-01T00:00:00.000Z';
  const staleId=`post-alpha-owned:${end}`,stale=store.get('snapshots',staleId);
  store.put('snapshots',staleId,{...stale,expiresAt:expired});
  channel('expired-post','alpha',['peer'],[10000,20000,30000],[0,0,0]);
  const expiredPost=store.get('posts','post-expired-post');store.put('posts',expiredPost.id,{...expiredPost,expiresAt:expired});
  const unknownFollower=store.get('channelSnapshots',`alpha-owned:${end}`);
  store.put('channelSnapshots',unknownFollower.id,{...unknownFollower,expiresAt:expired});
  for(let i=0;i<40;i++)store.put('teams',`empty-${i}`,{id:`empty-${i}`,name:`빈 팀 ${i}`,active:true});
  const reads=new Map(),originalAll=store.all.bind(store);
  store.all=kind=>{reads.set(kind,(reads.get(kind)||0)+1);return originalAll(kind);};
  const changes=()=>store.db.prepare('SELECT total_changes() AS count').get().count;
  const before=changes(),result=await get();assert.equal(result.status,200);assert.equal(changes(),before);
  assert.equal(result.data.teams.length,43);
  for(const kind of ['posts','snapshots','channelSnapshots'])assert.equal(reads.get(kind),1,kind);
  const alpha=result.data.teams.find(team=>team.id==='alpha');
  assert.equal(alpha.channelCount,5);assert.equal(alpha.connectedCount,1);assert.equal(alpha.postCount,4);
  assert.equal(alpha.metrics.views.latest,158);assert.equal(alpha.metrics.views.stale,1);
  assert.equal(alpha.metrics.views.period.delta,4);assert.equal(alpha.metrics.views.period.baseDate,baseline);
  assert.equal(alpha.metrics.followers.latest,18);assert.equal(alpha.metrics.followers.stale,1);
  assert.ok(store.get('snapshots',staleId));assert.ok(store.get('posts',expiredPost.id));assert.ok(store.get('channelSnapshots',unknownFollower.id));
});

test('team overview validates periods before returning any team data',async t=>{
  const {get,end}=await fixture(t);
  for(const suffix of [
    '?start=2026-02-30&end=2026-03-01',
    '?start=2026-03-02&end=2026-03-01',
    '?start=2024-01-01&end=2026-01-01',
    `?start=${end}&end=${shiftDate(end,1)}`,
    '?end=not-a-date',
  ]){
    const result=await get('admin',suffix);assert.equal(result.status,400);assert.equal(result.data.teams,undefined);
  }
});
