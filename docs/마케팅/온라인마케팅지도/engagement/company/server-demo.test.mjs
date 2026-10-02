import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCompanyApp } from './server.mjs';
import { createDemoDataset, createDemoService } from './demo-service.mjs';
import { today } from './store.mjs';
import { shiftDate, analyze } from '../analytics.mjs';
import { growthMonthWindow } from './growth-summary.mjs';

async function fixture(t,{seed=true}={}){
  const directory=await mkdtemp(join(tmpdir(),'synk-company-demo-')),demoDirectory=join(directory,'demo');
  const seeded=seed?await createDemoDataset({directory:demoDirectory}):null;
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false});
  const address=await app.start(),base=`http://127.0.0.1:${address.port}`;
  t.after(async()=>{await app.stop();await rm(directory,{recursive:true,force:true});});
  const users={};
  for(const role of ['admin','manager','member','viewer'])users[role]=app.store.createUser({name:role,email:role+'@example.test',role,teamId:role==='manager'?'real-team':null});
  const cookies=new Map(Object.values(users).map(user=>[user.id,`synk_company_session=${app.store.mint('session',user.id,{csrfToken:'demo-test'},10)}`]));
  async function request(path,{as='admin',method='GET',body,headers={}}={}){
    const response=await fetch(base+path,{method,headers:{Cookie:as?cookies.get(users[as].id):'',Origin:app.origin,'X-CSRF-Token':'demo-test',...(body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
    const text=await response.text();let data;try{data=JSON.parse(text);}catch{}
    return {status:response.status,data,text,headers:response.headers};
  }
  const stored=()=>JSON.stringify({documents:app.store.db.prepare('SELECT * FROM documents ORDER BY kind,id').all(),credentials:app.store.db.prepare('SELECT * FROM credentials ORDER BY id').all()});
  return {app,users,request,seeded,directory,demoDirectory,stored};
}

test('persistent demo seeds once, keeps its anchor across reloads and never silently recreates removed data',async t=>{
  const {demoDirectory,request,seeded}=await fixture(t,{seed:false});assert.equal(seeded,null);
  assert.equal((await request('/api/state')).data.demoAvailable,false);
  assert.equal((await request('/api/demo/state')).status,404);
  const anchor=shiftDate(today(),-2),first=await createDemoDataset({directory:demoDirectory,anchorDate:anchor});assert.equal(first.created,true);
  const before=await readFile(first.path,'utf8'),mtime=(await stat(first.path)).mtimeMs;
  const second=await createDemoDataset({directory:demoDirectory,anchorDate:today()});assert.equal(second.created,false);
  assert.equal(await readFile(first.path,'utf8'),before);assert.equal((await stat(first.path)).mtimeMs,mtime);
  const service=createDemoService({directory:demoDirectory});assert.equal(service.state().demo.anchorDate,anchor);
  assert.equal((await request('/api/state')).data.demoAvailable,true);
  const state=(await request('/api/demo/state')).data;assert.equal(state.demo.anchorDate,anchor);
  const earliest=[shiftDate(anchor,-56),shiftDate(growthMonthWindow(anchor).previous.start,-1)].sort()[0];
  assert.equal(state.demo.dataFrom,earliest);assert.ok(state.demo.historyDays>=56);
  assert.equal(state.members.length,3);assert.equal(state.channels.length,6);assert.equal(state.teams.length,2);
  assert.equal(state.demo.postCount,24);assert.equal(state.demo.readOnly,true);
  for(const row of [...state.members,...state.channels,...state.teams])assert.ok(row.id.startsWith('demo-'));
  for(const channel of state.channels){assert.equal(new URL(channel.canonicalUrl).hostname,'invalid.example');assert.equal(channel.canEdit,false);assert.equal(channel.canConnect,false);}
  await rm(first.path);
  assert.equal((await request('/api/demo/state')).status,404);assert.equal(service.available(),false);
});

test('demo HTTP reports preserve existing metric shapes and separate personas, own work, team and all data',async t=>{
  const {request,seeded,stored}=await fixture(t),before=stored(),data=seeded.data;
  const reports={};
  for(const scope of ['mine','team','all']){
    const result=await request('/api/demo/analytics?scope='+scope);assert.equal(result.status,200);reports[scope]=result.data;
    assert.equal(result.data.daily.length,28);assert.equal(result.data.start,shiftDate(data.anchorDate,-27));assert.equal(result.data.end,data.anchorDate);
    assert.equal(typeof result.data.metrics.views.period.delta,'number');assert.equal(typeof result.data.metrics.views.previousPeriod.delta,'number');
    assert.equal(result.data.metrics.views.previousPeriod.baseDate,shiftDate(data.anchorDate,-56));
    assert.equal(result.data.memberGroups.length,3);assert.ok(result.data.overview.metrics.views);assert.equal(result.data.demo.enabled,true);
  }
  assert.deepEqual([reports.mine.channels.length,reports.team.channels.length,reports.all.channels.length],[2,4,6]);
  assert.ok(reports.mine.metrics.views.latest<reports.team.metrics.views.latest);assert.ok(reports.team.metrics.views.latest<reports.all.metrics.views.latest);
  const same=analyze(data,{channels:data.channels.map(channel=>({...channel,ready:true}))},{start:shiftDate(data.anchorDate,-27),end:data.anchorDate});
  assert.deepEqual(reports.all.metrics,same.metrics);assert.deepEqual(reports.all.daily,same.daily);
  const all=reports.all;assert.equal(all.byPost.length,24);assert.ok(all.metrics.views.stale>0);assert.ok(all.metrics.saves.latestCount<all.metrics.saves.eligible);
  assert.ok(all.groups.some(group=>group.metrics.followers.period.delta<0));
  assert.ok(all.byPost.some(post=>post.metrics.views.day.delta<0));
  assert.ok(data.snapshots.some(row=>row.comments===0));
  for(const persona of data.members){
    const state=await request('/api/demo/state?persona='+persona.id);assert.equal(state.data.user.id,persona.id);assert.equal(state.data.user.role,'admin');
    const mine=await request('/api/demo/analytics?scope=mine&persona='+persona.id);assert.equal(mine.data.channels.length,2);assert.ok(mine.data.channels.every(channel=>channel.ownerIds.includes(persona.id)));
  }
  const seoyeon=await request('/api/demo/analytics?scope=team&persona=demo-person-seoyeon');assert.equal(seoyeon.data.channels.length,2);
  const missing=await request('/api/demo/analytics?scope=team&teamId=real-team');assert.equal(missing.data.channels.length,0);assert.equal(missing.data.metrics.views.latest,null);
  assert.equal((await request('/api/demo/state?persona=real-admin')).status,404);
  const day=await request('/api/demo/day?scope=all&date='+data.anchorDate);assert.equal(day.data.daily.length,1);assert.equal(day.data.metrics.views.period.delta,all.metrics.views.day.delta);
  const filtered=await request('/api/demo/analytics?scope=all&platform=instagram');assert.equal(filtered.data.channels.length,2);
  const owned=await request('/api/demo/analytics?scope=all&ownerId=demo-person-junho');assert.equal(owned.data.channels.length,2);
  assert.equal(stored(),before,'demo GETs must not change the real company documents or credentials');
});

test('demo summary, CSV and highlights are clearly marked and use the same selected period',async t=>{
  const {request,seeded}=await fixture(t),{anchorDate}=seeded.data,start=shiftDate(anchorDate,-6),query=`?start=${start}&end=${anchorDate}`;
  const result=await request('/api/demo/team-overview'+query);assert.equal(result.status,200);assert.equal(result.data.teams.length,2);
  for(const team of result.data.teams){
    const report=(await request('/api/demo/analytics'+query+'&scope=team&teamId='+team.id)).data;
    assert.equal(team.metrics.views.latest,report.metrics.views.latest);assert.deepEqual(team.metrics.views.period,report.metrics.views.period);
    assert.equal(team.memberCount,team.id==='demo-team-growth'?2:1);
  }
  const csv=await request('/api/demo/export.csv'+query);assert.equal(csv.status,200);assert.match(csv.headers.get('content-type'),/text\/csv/);assert.match(csv.headers.get('content-disposition'),/synk-demo-growth/);
  assert.match(csv.text,/가상 데이터 · 실제 성과 아님/);assert.ok(csv.text.includes(start));
  const hype=await request('/api/demo/hype?scope=all');assert.equal(hype.status,200);assert.ok(Array.isArray(hype.data.items));assert.equal(hype.data.demo.enabled,true);assert.equal(hype.data.collection.enabled,false);
  for(const item of hype.data.items)assert.equal(new URL(item.url).hostname,'invalid.example');
  for(const suffix of [`?start=${anchorDate}&end=${shiftDate(anchorDate,1)}`,'?start=2026-02-30&end=2026-03-01'])assert.equal((await request('/api/demo/analytics'+suffix)).status,400);
});

test('only the actual active admin may view demos, and marked demo requests cannot mutate real routes or messenger',async t=>{
  const {request,app,users,stored}=await fixture(t);
  for(const as of [null,'manager','member','viewer'])for(const path of ['state','analytics','day','team-overview','hype','export.csv']){
    const result=await request('/api/demo/'+path+'?persona=demo-person-minji',{as});assert.equal(result.status,as?403:401);
  }
  const real=await request('/api/state');assert.equal(real.data.user.id,users.admin.id);assert.equal(real.data.demo,undefined);assert.equal(real.data.channels.length,0);assert.equal(real.data.members.length,4);assert.equal(real.data.demoAvailable,true);
  assert.equal((await request('/api/state',{as:'member'})).data.demoAvailable,false);
  const before=stored();
  const writes=[
    ['/api/teams',{name:'Must not exist'}],['/api/members/invite',{email:'not-created@example.test',name:'blocked'}],
    ['/api/channels',{urls:'https://youtube.com/@not-created'}],['/api/settings',{enabled:true}],
    ['/messenger/api/channels',{name:'blocked'}],['/messenger/api/messages/message-id',{body:'blocked'}],
    ['/api/demo/state',{}],
  ];
  for(const [path,body] of writes)for(const method of ['POST','PATCH','DELETE']){
    assert.equal((await request(path,{method,body,headers:{'X-Synk-Demo':'1'}})).status,403);
    assert.equal((await request(path+'?demo=1',{method,body})).status,403);
  }
  assert.equal((await request('/api/demo/analytics',{method:'POST',body:{}})).status,403);
  assert.equal(stored(),before);
  app.store.put('users',users.admin.id,{...users.admin,role:'member'});assert.equal((await request('/api/demo/state')).status,403);
  app.store.put('users',users.admin.id,{...users.admin,active:false});assert.equal((await request('/api/demo/state')).status,401);
});
