import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCompanyApp } from './server.mjs';
import { createDemoDataset } from './demo-service.mjs';

const date='2026-09-30',prior='2026-09-29';
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-content-leaders-'));
  const demo=await createDemoDataset({directory:join(directory,'demo'),anchorDate:date});
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false});
  const address=await app.start(),base=`http://127.0.0.1:${address.port}`;
  t.after(async()=>{await app.stop();await rm(directory,{recursive:true,force:true});});
  const users={};
  for(const [name,role,teamId] of [['admin','admin','alpha'],['manager','manager','alpha'],['member','member','alpha'],['viewer','viewer','alpha'],['peer','member','alpha'],['other','member','beta']])users[name]=app.store.createUser({name,email:name+'@example.test',role,teamId});
  for(const id of ['alpha','beta'])app.store.put('teams',id,{id,name:id,active:true});
  for(const channel of [{id:'own',owner:'member',teamId:'alpha',platform:'youtube'},{id:'peer',owner:'peer',teamId:'alpha',platform:'instagram'},{id:'secret',owner:'other',teamId:'beta',platform:'tiktok'}])app.store.put('channels',channel.id,{...channel,ownerIds:[users[channel.owner].id],displayName:channel.id,active:true});
  for(const [id,before,after,owner] of [['positive',20,25,'admin'],['zero',5,5,'admin'],['negative',5,2,'admin'],['stale',9999,undefined,'admin'],['no-baseline',undefined,500,'admin'],['unknown',100,101,null],['peer-post',10,1000,'peer'],['secret-post',10,100000,'other']]){
    const channelId=id==='peer-post'?'peer':id==='secret-post'?'secret':'own';
    app.store.put('posts',id,{id,title:id,channelId,publishedDate:'2025-02-01',publishedAt:'2025-02-01T00:00:00Z'});
    for(const [d,value] of [[prior,before],[date,after]])if(value!==undefined)app.store.put('snapshots',id+d,{id:id+d,postId:id,date:d,views:value,...(owner?{checkedAt:d+'T09:00:00Z',ownership:{known:true,ownerIds:[users[owner].id],teamId:channelId==='secret'?'beta':'alpha'}}:{})});
  }
  app.store.put('ownershipEvents','baseline',{id:'baseline',channelId:'own',effectiveAt:'2025-01-01T00:00:00Z',beforeOwnerIds:[],afterOwnerIds:[users.admin.id],afterTeamId:'alpha'});
  const cookies=new Map(Object.values(users).map(user=>[user.id,'synk_company_session='+app.store.mint('session',user.id,{csrfToken:'leaders'},10)]));
  async function get(path,as='admin'){const response=await fetch(base+path,{headers:{Cookie:as?cookies.get(users[as].id):''}});return {status:response.status,data:await response.json()};}
  return {app,users,get,demo};
}

test('compact day leaders preserve channel, team, metric and historical owner filters without replacing normal day reports',async t=>{
  const {get,users}=await fixture(t),path='/api/day?date='+date+'&leaders=1';
  const own=await get(path+'&channel=own&mode=change');assert.equal(own.status,200);
  assert.equal(own.data.count,4);assert.equal(own.data.eligible,6);assert.equal(own.data.complete,false);assert.equal(own.data.groups,undefined);assert.equal(own.data.daily,undefined);
  assert.deepEqual(own.data.items.map(item=>[item.id,item.value]),[['positive',5],['unknown',1],['zero',0]]);
  assert.equal(own.data.items[0].creatorBasis,'observed-owner');assert.deepEqual(own.data.items[0].creatorNames,['admin']);
  assert.equal(own.data.items[1].creatorBasis,'unregistered');
  const total=(await get(path+'&channel=own&mode=total')).data;
  assert.equal(total.count,5);assert.deepEqual(total.items.map(item=>item.id),['no-baseline','unknown','positive']);assert.ok(total.items.every(item=>item.id!=='stale'));
  const team=(await get(path+'&scope=team')).data;assert.equal(team.eligible,7);assert.equal(team.items[0].id,'peer-post');assert.ok(team.items.every(item=>item.id!=='secret-post'));
  const instagram=(await get(path+'&platform=instagram')).data;assert.equal(instagram.eligible,1);assert.equal(instagram.items[0].id,'peer-post');
  const historical=(await get(path+'&channel=own&ownerId='+users.admin.id)).data;assert.equal(historical.items[0].id,'positive');
  const newlyOwned=(await get(path+'&channel=own&ownerId='+users.member.id)).data;assert.deepEqual(newlyOwned.items,[]);
  const followers=(await get(path+'&metric=followers')).data;assert.equal(followers.emptyReason,'account-metric');assert.deepEqual(followers.items,[]);
  const normal=(await get('/api/day?date='+date+'&channel=own')).data;assert.ok(normal.groups);assert.ok(normal.daily);assert.ok(normal.metrics);
  assert.equal((await get(path+'&metric=not-real')).status,400);assert.equal((await get(path+'&mode=latest')).status,400);
});

test('leaders cannot expose another team or unavailable historical crew names and recheck revoked sessions',async t=>{
  const {get,app,users}=await fixture(t),path='/api/day?date='+date+'&leaders=1';
  assert.equal((await get(path,null)).status,401);
  const member=(await get(path+'&ownerId='+users.other.id,'member')).data;
  assert.equal(member.eligible,6);assert.equal(member.items[0].id,'positive');assert.deepEqual(member.items[0].creatorNames,[]);assert.equal(member.items[0].creatorBasis,'unregistered');
  assert.deepEqual((await get(path+'&channel=secret','member')).data.items,[]);
  const viewer=(await get(path,'viewer')).data;assert.equal(viewer.eligible,7);assert.ok(viewer.items.every(item=>item.id!=='secret-post'));
  const manager=(await get(path,'manager')).data;assert.equal(manager.items.find(item=>item.id==='positive').creatorBasis,'observed-owner');
  app.store.put('users',users.member.id,{...users.member,active:false});assert.equal((await get(path,'member')).status,401);
});

test('demo leaders use explicit synthetic creator labels, match exact report numbers and never modify persisted demo data',async t=>{
  const {get,demo}=await fixture(t),original=await readFile(demo.path,'utf8'),path='/api/demo/day?date='+date+'&scope=mine';
  const regular=(await get(path)).data,result=(await get(path+'&leaders=1&metric=views&mode=change')).data;
  assert.equal(result.demo.enabled,true);assert.equal(result.items.length,3);assert.equal(result.groups,undefined);
  const expected=regular.byPost.filter(post=>post.metrics.views.day.complete&&Number.isFinite(post.metrics.views.day.delta)).sort((a,b)=>b.metrics.views.day.delta-a.metrics.views.day.delta||a.title.localeCompare(b.title,'ko')||a.id.localeCompare(b.id,'en')).slice(0,3);
  assert.deepEqual(result.items.map(item=>item.id),expected.map(post=>post.id));
  for(const item of result.items){assert.equal(item.creatorBasis,'demo-creator');assert.deepEqual(item.creatorNames,['민지']);assert.equal(item.value,regular.byPost.find(post=>post.id===item.id).metrics.views.day.delta);}
  const total=(await get(path+'&leaders=1&mode=total')).data;assert.ok(total.items.every(item=>item.value===regular.byPost.find(post=>post.id===item.id).metrics.views.total));
  assert.equal((await get(path+'&leaders=1','member')).status,403);
  assert.equal(await readFile(demo.path,'utf8'),original);
});
