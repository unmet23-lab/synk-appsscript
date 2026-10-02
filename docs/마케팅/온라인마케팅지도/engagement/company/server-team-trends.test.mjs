import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {createCompanyApp} from './server.mjs';
import {createDemoDataset} from './demo-service.mjs';
import {today} from './store.mjs';
import {shiftDate} from '../analytics.mjs';

async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-team-trends-'));
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false}),address=await app.start(),base=`http://127.0.0.1:${address.port}`;
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-team-trends-'));await rm(directory,{recursive:true,force:true});});
  const store=app.store,end=today(),start=shiftDate(end,-1),baseline=shiftDate(start,-1),users={},cookies={};
  for(const id of ['alpha','beta','empty','inactive'])store.put('teams',id,{id,name:id,active:id!=='inactive'});
  for(const role of ['admin','manager','member','viewer']){
    const user=store.createUser({name:role,email:role+'@example.test',role,teamId:'alpha'});users[role]=user;
    cookies[role]=`synk_company_session=${store.mint('session',user.id,{csrfToken:'fixture'},10)}`;
  }
  for(const [id,teamId,likes,shares] of [['a','alpha',[10,12,15],[0,0,0]],['a-peer','alpha',[5,6,8],[3,4,7]],['b','beta',[100,110,120],[10,15,20]],['missing','alpha',null,null],['off','inactive',[900,1000,1100],[90,100,110]]]){
    store.put('channels',id,{id,teamId,ownerIds:id==='a'?[users.member.id,users.admin.id]:[users.admin.id],platform:'youtube',active:true,displayName:'PRIVATE CHANNEL '+id});
    const postId='private-post-'+id;store.put('posts',postId,{id:postId,channelId:id,title:'PRIVATE POST '+id,publishedDate:shiftDate(baseline,-2)});
    for(const [i,date] of [baseline,start,end].entries())if(likes){store.put('snapshots',postId+date,{id:postId+date,postId,date,likes:likes[i],shares:shares[i]});store.put('channelSnapshots',id+date,{id:id+date,channelId:id,date,followers:likes[i]});}
  }
  store.setSecret('channel:b',{apiKey:'PRIVATE SECRET'});
  const get=async(path=`/api/team-trends?start=${start}&end=${end}&metric=likes`,role='member')=>{const response=await fetch(base+path,{headers:{Cookie:cookies[role]||''}});return{status:response.status,data:await response.json()};};
  return {app,store,directory,end,start,baseline,users,get};
}

test('all active roles see their full team and other-team aggregates while channel details retain existing permissions',async t=>{
  const f=await fixture(t);
  for(const role of ['admin','manager','member','viewer']){
    const {status,data}=await f.get(undefined,role);assert.equal(status,200);assert.equal(data.aggregateOnly,true);assert.equal(data.ownTeamId,'alpha');
    assert.deepEqual(data.teams.map(team=>team.id),['alpha','beta','empty']);
    assert.equal(data.teams[0].summary.latest,23);assert.equal(data.teams[0].summary.period.delta,8);assert.equal(data.teams[0].summary.period.complete,false);
    assert.equal(data.teams[1].summary.latest,120);assert.equal(data.teams[1].summary.period.delta,20);
    for(const privateValue of ['PRIVATE CHANNEL','PRIVATE POST','PRIVATE SECRET','@example.test','ownerIds','postId','channelId'])assert.equal(JSON.stringify(data).includes(privateValue),false);
  }
  assert.equal((await f.get('/api/channels/b/history')).status,404);
  assert.deepEqual((await f.get('/api/state')).data.channels.map(row=>row.id),['a']);
  const report=(await f.get(`/api/analytics?scope=team&teamId=beta&start=${f.start}&end=${f.end}`)).data;
  assert.equal(report.groups.length,0);
});

test('shared ownership counts a channel once and missing, zero, old and negative observations remain distinct',async t=>{
  const f=await fixture(t),url=`/api/team-trends?start=${f.start}&end=${f.end}&metric=shares`;
  let data=(await f.get(url)).data,alpha=data.teams[0];
  assert.equal(alpha.summary.latest,7);assert.equal(alpha.summary.period.delta,4);assert.equal(alpha.summary.eligible,3);
  assert.equal(alpha.series[0].latest,4);assert.equal(alpha.series[0].change.delta,1);
  const empty=data.teams.find(team=>team.id==='empty');assert.equal(empty.summary.latest,null);assert.equal(empty.summary.period.delta,null);
  f.store.remove('snapshots','private-post-a-peer'+f.end);
  data=(await f.get(url)).data;alpha=data.teams[0];
  assert.equal(alpha.summary.latest,4);assert.equal(alpha.summary.stale,1);assert.equal(alpha.series[1].change.delta,0);assert.equal(alpha.series[1].change.complete,false);
  const row=f.store.get('snapshots','private-post-b'+f.end);f.store.put('snapshots',row.id,{...row,shares:9});
  data=(await f.get(url)).data;assert.equal(data.teams[1].series[1].change.delta,-6);
  assert.equal((await f.get(url.replace('shares','followers'))).data.teams[0].summary.latest,23);
});

test('GET is read-only, excludes expired records and inactive teams, and rechecks active identity',async t=>{
  const f=await fixture(t),row=f.store.get('snapshots','private-post-b'+f.end);
  f.store.put('snapshots',row.id,{...row,expiresAt:'2000-01-01T00:00:00Z'});
  const before=f.store.db.prepare('SELECT total_changes() n').get().n,data=(await f.get()).data;
  assert.equal(f.store.db.prepare('SELECT total_changes() n').get().n,before);assert.ok(f.store.get('snapshots',row.id));
  assert.equal(data.teams[1].summary.latest,110);assert.equal(data.teams[1].summary.period.delta,null);
  f.store.put('teams','beta',{id:'beta',name:'beta',active:false});assert.deepEqual((await f.get()).data.teams.map(team=>team.id),['alpha','empty']);
  assert.equal((await f.get(undefined,'anonymous')).status,401);
  f.store.put('users',f.users.member.id,{...f.users.member,active:false});assert.equal((await f.get()).status,401);
});

test('validates dates and metrics and bounds all-history requests without query-based data escalation',async t=>{
  const f=await fixture(t);
  for(const query of [`metric=secret`,`start=2026-02-30&end=${f.end}`,`start=${f.end}&end=${shiftDate(f.end,1)}`,`start=${shiftDate(f.end,-366)}&end=${f.end}`])assert.equal((await f.get('/api/team-trends?'+query)).status,400);
  const result=await f.get(`/api/team-trends?range=all&metric=likes&teamId=inactive&ownerId=${f.users.admin.id}&scope=all`);
  assert.equal(result.status,200);assert.equal(result.data.start,f.baseline);assert.equal(result.data.end,f.end);
  assert.deepEqual(result.data.teams.map(team=>team.id),['alpha','beta','empty']);
  const old=shiftDate(f.end,-500);f.store.put('snapshots','old',{id:'old',postId:'private-post-a',date:old,likes:1});
  const all=(await f.get('/api/team-trends?range=all&metric=likes')).data;assert.equal(all.limitedHistory,true);assert.equal(all.teams[0].series.length,366);
});

test('demo trends share the aggregate implementation and never change the saved demo or real records',async t=>{
  const f=await fixture(t),seed=await createDemoDataset({directory:join(f.directory,'demo'),anchorDate:f.end});
  const before=await readFile(seed.path,'utf8'),query=`/api/demo/team-trends?range=week&start=${f.start}&end=${f.end}&metric=shares`;
  const demo=await f.get(query,'admin');assert.equal(demo.status,200);assert.equal(demo.data.demo.enabled,true);assert.equal(demo.data.teams.length,2);assert.ok(demo.data.teams.some(team=>team.isOwn));
  assert.equal((await f.get(query,'member')).status,403);assert.equal(await readFile(seed.path,'utf8'),before);
  assert.equal((await f.get()).data.teams[0].summary.latest,23);
});
