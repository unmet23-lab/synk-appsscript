import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCompanyApp } from './server.mjs';
import { createDemoDataset, createDemoService, extendDemoHistory } from './demo-service.mjs';
import { buildGrowthSummary } from './growth-summary.mjs';
import { shiftDate } from '../analytics.mjs';

test('growth=1 HTTP uses the existing channel permission and selected historical ownership records',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'synk-growth-http-'));
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false});
  const address=await app.start(),base=`http://127.0.0.1:${address.port}`;
  t.after(async()=>{await app.stop();await rm(directory,{recursive:true,force:true});});
  const admin=app.store.createUser({name:'Admin',email:'admin@example.test',role:'admin'}),member=app.store.createUser({name:'New',email:'new@example.test'});
  const channel={id:'c',platform:'youtube',ownerIds:[member.id],teamId:null,displayName:'Own',active:true};
  app.store.put('channels',channel.id,channel);
  app.store.put('channels','foreign',{...channel,id:'foreign',ownerIds:[admin.id]});
  const events=[
    {id:'old',channelId:'c',effectiveAt:'2024-01-01T00:00:00Z',beforeOwnerIds:[],afterOwnerIds:[admin.id],afterTeamId:null},
    {id:'handover',channelId:'c',effectiveAt:'2024-03-02T00:00:00Z',beforeOwnerIds:[admin.id],afterOwnerIds:[member.id],afterTeamId:null},
  ];
  for(const event of events)app.store.put('ownershipEvents',event.id,event);
  for(const id of ['c','foreign']){
    app.store.put('posts',id,{id,channelId:id,publishedDate:'2024-01-02',publishedAt:'2024-01-02T00:00:00Z'});
    for(const [date,views] of Object.entries({'2024-01-31':10,'2024-02-03':20,'2024-02-18':30,'2024-02-25':80,'2024-02-29':100,'2024-03-01':110,'2024-03-02':130,'2024-03-03':140})){
      app.store.put('snapshots',id+date,{id:id+date,postId:id,date,views:id==='foreign'?views*100:views,checkedAt:date+'T09:00:00Z'});
    }
  }
  const cookies=new Map([admin,member].map(user=>[user.id,'synk_company_session='+app.store.mint('session',user.id,{csrfToken:'x'},10)]));
  async function get(user,query){const response=await fetch(base+'/api/analytics?start=2024-03-01&end=2024-03-03&'+query,{headers:{Cookie:cookies.get(user.id)}});assert.equal(response.status,200);return response.json();}
  const ordinary=await get(admin,'scope=all');assert.equal(ordinary.growth,undefined);
  const selected=await get(admin,'scope=all&ownerId='+member.id+'&growth=1');
  assert.equal(selected.growth.metrics.views.today.total,140);assert.equal(selected.growth.metrics.views.day.delta,10);
  assert.equal(selected.growth.metrics.views.month.current.delta,null);assert.equal(selected.growth.metrics.views.month.previous.delta,null);
  assert.equal(selected.growth.metrics.views.week.current.delta,null);assert.equal(selected.growth.metrics.views.week.previous.delta,null);
  assert.equal(selected.growth.metrics.views.today.total,selected.metrics.views.total);
  const personal=await get(member,'scope=all&ownerId='+admin.id+'&growth=1');
  assert.equal(personal.channels.length,1);assert.equal(personal.growth.metrics.views.today.total,140);
  assert.equal(personal.growth.metrics.views.week.current.delta,60);assert.equal(personal.growth.metrics.views.week.previous.delta,50);
  const filtered=await get(admin,'scope=all&channel=foreign&growth=1');assert.equal(filtered.growth.metrics.views.today.total,14000);
  assert.equal(filtered.growth.metrics.views.week.current.delta,6000);assert.equal(filtered.growth.metrics.views.week.previous.delta,5000);
  const none=await get(member,'scope=all&channel=foreign&growth=1');assert.equal(none.growth.metrics.views.today.total,null);
  assert.equal(none.growth.metrics.views.week.current.delta,null);
});

test('demo history expansion backs up and preserves every existing row, identity and anchor; repeated runs make no change',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'synk-growth-demo-history-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const first=await createDemoDataset({directory,anchorDate:'2026-09-30'}),data=first.data;
  assert.equal(data.dataFrom,'2026-07-31');
  const originalFrom=shiftDate(data.anchorDate,-56);
  const original={...data,dataFrom:originalFrom,baselineDate:originalFrom,historyDays:56,
    snapshots:data.snapshots.filter(row=>row.date>=originalFrom),channelSnapshots:data.channelSnapshots.filter(row=>row.date>=originalFrom)};
  const originalBytes=JSON.stringify(original,null,2);await writeFile(first.path,originalBytes);
  const service=createDemoService({directory}),query=new URLSearchParams('growth=1&scope=mine');
  assert.equal(service.report(query).growth.metrics.views.month.comparable,false);
  const extended=await extendDemoHistory({directory});assert.equal(extended.changed,true);assert.equal(extended.data.dataFrom,'2026-07-31');
  assert.equal(await readFile(extended.backup,'utf8'),originalBytes);
  assert.equal(extended.data.anchorDate,original.anchorDate);assert.equal(extended.data.createdAt,original.createdAt);
  for(const key of ['members','channels','teams','posts','hypeObservations'])assert.deepEqual(extended.data[key],original[key]);
  for(const key of ['snapshots','channelSnapshots']){
    const ids=new Set(original[key].map(row=>row.id));
    assert.deepEqual(extended.data[key].filter(row=>ids.has(row.id)),original[key]);
    assert.ok(extended.data[key].filter(row=>!ids.has(row.id)).every(row=>row.date<original.dataFrom));
    assert.equal(new Set(extended.data[key].map(row=>row.id)).size,extended.data[key].length);
  }
  assert.ok(extended.addedSnapshots>0);assert.ok(extended.addedChannelSnapshots>0);
  const report=service.report(query);assert.equal(report.growth.metrics.views.month.comparable,true);assert.equal(typeof report.growth.metrics.views.month.rate,'number');
  assert.equal(report.growth.metrics.views.today.total,report.metrics.views.total);
  const saved=await readFile(first.path,'utf8'),again=await extendDemoHistory({directory});
  assert.equal(again.changed,false);assert.equal(again.backup,null);assert.equal(await readFile(first.path,'utf8'),saved);
  assert.equal((await readdir(directory)).length,2,'only the data and original backup remain');
});

test('new demos include enough monthly history and growth stays opt-in with the same detailed report data',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'synk-growth-demo-fresh-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const {data}=await createDemoDataset({directory,anchorDate:'2026-09-30'}),service=createDemoService({directory});
  const originalBytes=await readFile(join(directory,'marketing-demo.json'),'utf8');
  const query=new URLSearchParams('scope=mine'),ordinary=service.report(query);assert.equal(ordinary.growth,undefined);
  query.set('growth','1');const grown=service.report(query);
  assert.deepEqual(grown.metrics,ordinary.metrics);assert.deepEqual(grown.daily,ordinary.daily);assert.deepEqual(grown.groups,ordinary.groups);
  const selected=data.channels.filter(channel=>channel.ownerIds.includes('demo-person-minji'));
  const expected=buildGrowthSummary(data,{channels:selected.map(channel=>({...channel,ready:true}))},{asOf:data.anchorDate});
  assert.deepEqual(grown.growth,expected);assert.equal(grown.growth.metrics.views.month.comparable,true);
  assert.equal(grown.growth.week.current.start,'2026-09-28');assert.equal(grown.growth.week.previous.end,'2026-09-23');
  assert.equal(grown.growth.metrics.views.week.trend.length,3);assert.equal(grown.growth.metrics.views.week.comparable,true);
  assert.equal(await readFile(join(directory,'marketing-demo.json'),'utf8'),originalBytes,'weekly reads cannot rewrite the persisted demo');
  assert.equal(grown.growth.month.previous.start,'2026-08-01');assert.equal(grown.growth.month.previous.end,'2026-08-30');
  assert.equal(data.dataFrom,'2026-07-31');assert.ok(data.snapshots.some(row=>row.date==='2026-07-31'));
});
