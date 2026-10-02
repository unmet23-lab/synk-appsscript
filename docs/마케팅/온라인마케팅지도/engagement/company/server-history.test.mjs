import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCompanyApp } from './server.mjs';
import { createDemoDataset } from './demo-service.mjs';

async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-history-http-'));
  const demo=await createDemoDataset({directory:join(directory,'demo'),anchorDate:'2026-09-30'});
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false});
  const address=await app.start(),base=`http://127.0.0.1:${address.port}`;
  t.after(async()=>{await app.stop();await rm(directory,{recursive:true,force:true});});
  const admin=app.store.createUser({name:'Admin',email:'admin@example.test',role:'admin',teamId:'alpha'});
  const member=app.store.createUser({name:'Member',email:'member@example.test',teamId:'alpha'});
  const viewer=app.store.createUser({name:'Viewer',email:'viewer@example.test',role:'viewer',teamId:'alpha'});
  for(const id of ['alpha','beta'])app.store.put('teams',id,{id,name:id,active:true});
  const channels=[{id:'own',teamId:'alpha',ownerIds:[member.id]},{id:'secret',teamId:'beta',ownerIds:[admin.id]}];
  for(const channel of channels){
    app.store.put('channels',channel.id,{...channel,platform:'youtube',active:true,displayName:channel.id});
    app.store.put('posts',channel.id,{id:channel.id,channelId:channel.id,publishedDate:'2022-01-01',publishedAt:'2022-01-01T00:00:00Z'});
    const values=channel.id==='own'?{'2024-01-01':10,'2026-08-31':100,'2026-09-01':200,'2026-09-29':250,'2026-09-30':270}:{'2023-01-01':10000,'2026-09-30':20000};
    for(const [date,views] of Object.entries(values))app.store.put('snapshots',channel.id+date,{id:channel.id+date,postId:channel.id,date,views,checkedAt:date+'T09:00:00Z'});
  }
  for(const event of [
    {id:'old',channelId:'own',effectiveAt:'2022-01-01T00:00:00Z',beforeOwnerIds:[],afterOwnerIds:[admin.id]},
    {id:'new',channelId:'own',effectiveAt:'2026-09-01T00:00:00Z',beforeOwnerIds:[admin.id],afterOwnerIds:[member.id]},
  ])app.store.put('ownershipEvents',event.id,event);
  const cookies=new Map([admin,member,viewer].map(user=>[user.id,'synk_company_session='+app.store.mint('session',user.id,{csrfToken:'history'},10)]));
  async function get(path,user=admin){const response=await fetch(base+path,{headers:{Cookie:user?cookies.get(user.id):''}});return {status:response.status,data:await response.json()};}
  return {app,admin,member,viewer,get,demo};
}

test('history HTTP is opt-in, spans multiple years independently of report start, and respects team and ownership scope',async t=>{
  const {get,member,viewer,admin}=await fixture(t);
  const path='/api/analytics?start=2026-09-30&end=2026-09-30&scope=team';
  assert.equal((await get(path)).data.history,undefined);
  assert.equal((await get(path+'&history=1',null)).status,401);
  const team=(await get(path+'&history=1')).data;
  assert.equal(team.daily.length,1);assert.equal(team.history.start,'2024-01-01');assert.ok(team.history.days>900);assert.equal(team.history.daily.length,team.history.days);
  assert.equal(team.history.metrics.views.latest,270);assert.equal(team.history.metrics.views.change.delta,260);
  for(const user of [member,viewer]){
    const scoped=(await get('/api/analytics?start=2026-09-30&end=2026-09-30&scope=all&history=1',user)).data.history;
    assert.equal(scoped.start,'2024-01-01');assert.equal(scoped.metrics.views.latest,270);
  }
  const owner=(await get(path+'&history=1&ownerId='+member.id,admin)).data.history;
  assert.equal(owner.start,'2026-09-01');assert.equal(owner.daily[0].metrics.views.change.delta,null);
  assert.equal(owner.metrics.views.change.delta,70);assert.equal(owner.metrics.views.change.baseDate,'2026-09-01');
  const selected=(await get(path+'&history=1&historyStart=2026-09-29&historyEnd=2026-09-30')).data.history;
  assert.equal(selected.start,'2024-01-01');assert.equal(selected.selection.start,'2026-09-29');assert.equal(selected.selection.days,2);assert.equal(selected.selection.metrics.views.change.delta,20);
  const day=(await get('/api/day?date=2026-09-30&scope=team')).data;
  assert.equal(day.groups.length,1);assert.equal(day.groups[0].id,'own');assert.equal(day.groups[0].metrics.views.total,270);assert.equal(day.groups[0].metrics.views.day.delta,20);
  assert.equal((await get(path+'&history=1&historyStart=2026-02-30')).status,400);
});

test('demo history and changing selected periods preserve the stored demo and all detailed report contracts',async t=>{
  const {get,demo,member}=await fixture(t),original=await readFile(demo.path,'utf8');
  const path='/api/demo/analytics?start=2026-09-30&end=2026-09-30&scope=mine';
  const ordinary=(await get(path)).data,full=(await get(path+'&history=1')).data;
  assert.equal(ordinary.history,undefined);assert.deepEqual(full.metrics,ordinary.metrics);assert.deepEqual(full.daily,ordinary.daily);assert.deepEqual(full.groups,ordinary.groups);
  assert.equal(full.history.start,'2026-07-31');assert.equal(full.history.days,62);assert.equal(full.history.selection.start,full.history.start);
  assert.equal(full.history.metrics.views.latest,full.metrics.views.latest);assert.equal(full.history.metrics.views.total,full.metrics.views.total);
  const chosen=(await get(path+'&history=1&historyStart=2026-09-24&historyEnd=2026-09-30')).data.history;
  assert.equal(chosen.daily.length,full.history.daily.length);assert.equal(chosen.selection.days,7);assert.equal(chosen.selection.metrics.views.change.complete,true);
  assert.notEqual(chosen.selection.metrics.views.change.delta,full.history.metrics.views.change.delta);
  assert.equal((await get(path+'&history=1',member)).status,403);
  assert.equal(await readFile(demo.path,'utf8'),original);
});
