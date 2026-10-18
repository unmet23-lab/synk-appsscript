import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createCompanyApp} from './server.mjs';
import {today} from './store.mjs';

const retainedKinds=new Set(['posts','snapshots','channelSnapshots','hypeObservations']);
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-analytics-read-'));let at=today()+'T00:00:00.000Z';
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,clock:()=>at});
  const address=await app.start(),base=`http://127.0.0.1:${address.port}`;
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-analytics-read-'));await rm(directory,{recursive:true,force:true});});
  const users={};for(const [name,role,teamId] of [['admin','admin',null],['member','member','a'],['manager','manager','a'],['viewer','viewer','a'],['other','member','b']])users[name]=app.store.createUser({name,email:name+'@synthetic.test',role,teamId});
  const cookies=Object.fromEntries(Object.entries(users).map(([name,user])=>[name,'synk_company_session='+app.store.mint('session',user.id,{csrfToken:'synthetic'},10)]));
  app.store.put('settings','company',{companyName:'Synthetic',enabled:false,hourKst:9});
  for(const [id,owner,team] of [['own',users.member,'a'],['foreign',users.other,'b']])app.store.put('channels',id,{id,platform:'youtube',ownerIds:[owner.id],teamId:team,displayName:id,active:true});
  const get=async(route,user='admin')=>{const r=await fetch(base+route,{headers:user?{Cookie:cookies[user]}:{}});const text=await r.text();return {status:r.status,text,data:r.headers.get('content-type')?.includes('application/json')?JSON.parse(text):null};};
  const snapshot=()=>createHash('sha256').update(JSON.stringify(['documents','tokens','credentials'].map(table=>app.store.db.prepare(`SELECT * FROM ${table} ORDER BY 1,2`).all()))).digest('hex');
  const put=(kind,id,body)=>app.store.put(kind,id,{id,...body});
  const metrics={reads:0,parsedRows:0,transactions:0,removed:0,byKind:{}};
  const originalAll=app.store.all.bind(app.store),originalTransaction=app.store.transaction.bind(app.store),originalRemove=app.store.remove.bind(app.store);
  app.store.all=kind=>{const rows=originalAll(kind);if(retainedKinds.has(kind)){metrics.reads++;metrics.parsedRows+=rows.length;metrics.byKind[kind]=(metrics.byKind[kind]||0)+1;}return rows;};
  app.store.transaction=fn=>{metrics.transactions++;return originalTransaction(fn);};
  app.store.remove=(...args)=>{metrics.removed++;return originalRemove(...args);};
  return {app,directory,users,get,put,snapshot,metrics,at:()=>at,setAt:value=>{at=value;},reset(){Object.assign(metrics,{reads:0,parsedRows:0,transactions:0,removed:0,byKind:{}});}};
}
function seed(f){
  const at=f.at(),date=today(),future=new Date(Date.parse(at)+86400000).toISOString();
  f.put('posts','live',{channelId:'own',title:'live-title',publishedDate:date,publishedAt:at,expiresAt:future});
  f.put('posts','expired',{channelId:'own',title:'expired-title',publishedDate:date,publishedAt:at,expiresAt:at});
  f.put('posts','foreign-post',{channelId:'foreign',title:'foreign-title',publishedDate:date,publishedAt:at,expiresAt:future});
  for(const [id,postId,views,expiresAt] of [['live-snapshot','live',10,future],['expired-snapshot','live',999,at],['expired-post-snapshot','expired',1000,future],['foreign-snapshot','foreign-post',5000,future]])f.put('snapshots',id,{postId,date,checkedAt:at,views,expiresAt,ownership:{known:true,ownerIds:[postId==='foreign-post'?f.users.other.id:f.users.member.id],teamId:postId==='foreign-post'?'b':'a'}});
  f.put('channelSnapshots','live-channel',{channelId:'own',date,checkedAt:at,followers:12,expiresAt:future});
  f.put('channelSnapshots','expired-channel',{channelId:'own',date,checkedAt:at,followers:999,expiresAt:at});
  f.put('hypeObservations','expired-hype',{postId:'live',channelId:'own',checkedAt:at,expiresAt:at});
  f.put('hypeObservations','orphan-hype',{postId:'missing',channelId:'own',checkedAt:at,expiresAt:future});
}
for(const route of ['/api/analytics','/api/day','/api/export.csv','/api/day?leaders=1'])test(`${route} reads hide expired records without deleting anything`,async t=>{
  const f=await fixture(t);seed(f);const before=f.snapshot();f.reset();
  const result=await f.get(route,'member');assert.equal(result.status,200,result.text);assert.doesNotMatch(result.text,/expired-title|foreign-title/);assert.match(result.text,/live-title/);
  assert.equal(f.metrics.transactions,0);assert.equal(f.metrics.removed,0);assert.equal(f.metrics.byKind.hypeObservations,undefined,'analytics never scans the unrelated hype retention collection');
  assert.equal(f.snapshot(),before,'GET keeps all stored rows and tokens byte-identical');
  if(result.data?.metrics){assert.equal(result.data.metrics.views.latest,10);assert.equal(result.data.metrics.followers.latest,12);assert.equal(result.data.overview.postCount,1);}
});
test('analytics/day/CSV remain readable while another SQLite connection holds the writer reservation',async t=>{
  const f=await fixture(t);seed(f);const before=f.snapshot(),blocker=new DatabaseSync(join(f.directory,'company.sqlite'));
  f.app.store.db.exec('PRAGMA busy_timeout=0');blocker.exec('BEGIN IMMEDIATE');
  try{for(const route of ['/api/analytics','/api/day','/api/export.csv'])assert.equal((await f.get(route,'member')).status,200,route);}
  finally{blocker.exec('ROLLBACK');blocker.close();}
  assert.equal(f.snapshot(),before);
});
for(const route of ['/api/analytics','/api/day','/api/export.csv'])test(`${route} and overview scan each retained collection once for a 2,000-post history`,async t=>{
  const f=await fixture(t),date=today(),at=f.at();
  f.app.store.transaction(()=>{for(let n=0;n<2000;n++){const id='p'+n;f.put('posts',id,{channelId:'own',publishedDate:date,publishedAt:at});f.put('snapshots',id,{postId:id,date,checkedAt:at,views:1});f.put('channelSnapshots',id,{channelId:'own',date,checkedAt:at,followers:1});f.put('hypeObservations',id,{postId:id,channelId:'own',checkedAt:at});}});
  f.reset();const start=performance.now(),result=await f.get(route,'member'),elapsedMs=performance.now()-start;
  t.diagnostic(JSON.stringify({route,posts:2000,...f.metrics,elapsedMs:Number(elapsedMs.toFixed(2))}));assert.equal(result.status,200);
  assert.deepEqual(f.metrics.byKind,{posts:1,snapshots:1,channelSnapshots:1});assert.equal(f.metrics.parsedRows,6000);assert.equal(f.metrics.transactions,0);
});
test('existing scheduled cleanup retains the same expiry boundary, eight-day hype retention and orphan removal',async t=>{
  const f=await fixture(t);seed(f);const now=Date.parse(f.at()),future=new Date(now+1).toISOString();
  f.put('posts','no-expiry',{channelId:'own'});f.put('posts','invalid-expiry',{channelId:'own',expiresAt:'not-a-date'});f.put('posts','just-future',{channelId:'own',expiresAt:future});
  for(const [id,checkedAt,postId] of [['age-boundary',new Date(now-8*86400000).toISOString(),'live'],['age-retained',new Date(now-8*86400000+1).toISOString(),'live'],['invalid-time','invalid','live'],['expired-parent',f.at(),'expired']])f.put('hypeObservations',id,{channelId:'own',postId,checkedAt,expiresAt:future});
  assert.equal((await f.get('/api/analytics','member')).status,200);assert.ok(f.app.store.get('posts','expired'),'read does not run physical cleanup');
  await f.app.scheduledTick(f.at());
  for(const [kind,id] of [['posts','expired'],['snapshots','expired-snapshot'],['channelSnapshots','expired-channel'],['hypeObservations','expired-hype'],['hypeObservations','orphan-hype'],['hypeObservations','age-boundary'],['hypeObservations','invalid-time'],['hypeObservations','expired-parent']])assert.equal(f.app.store.get(kind,id),null,kind+'/'+id);
  for(const id of ['live','no-expiry','invalid-expiry','just-future'])assert.ok(f.app.store.get('posts',id),id);
  assert.ok(f.app.store.get('hypeObservations','age-retained'));
  assert.ok(f.app.store.get('snapshots','expired-post-snapshot'),'unexpired snapshot physical retention stays unchanged even when its parent expires');
  assert.doesNotMatch((await f.get('/api/analytics','member')).text,/expired-title/);
});
test('ownership filters and overview scope remain separate, with no cross-team data for member/manager/viewer',async t=>{
  const f=await fixture(t);seed(f);
  for(const user of ['member','manager','viewer']){const r=await f.get('/api/analytics?channel=foreign&growth=1&history=1',user);assert.equal(r.status,200);assert.equal(r.data.channels.length,0);assert.equal(r.data.overview.channelCount,1);assert.doesNotMatch(r.text,/foreign-title|foreign-post/);}
  const selected=await f.get('/api/analytics?channel=own&ownerId='+f.users.member.id,'admin');assert.equal(selected.data.metrics.views.latest,10);assert.equal(selected.data.overview.channelCount,2);assert.equal(selected.data.overview.postCount,2);
  assert.equal((await f.get('/api/analytics',null)).status,401);
  f.app.store.put('users',f.users.member.id,{...f.users.member,active:false});assert.equal((await f.get('/api/analytics','member')).status,401);
});

test('unavailable inventory rows stay stored but are excluded from analytics, day and CSV aggregates',async t=>{
  const f=await fixture(t);seed(f);
  const routes=['/api/analytics','/api/day','/api/export.csv'];
  const baseline=new Map();for(const route of routes){const result=await f.get(route,'member');assert.equal(result.status,200,result.text);assert.match(result.text,/live-title/);baseline.set(route,result.text);}
  const at=f.at(),future=new Date(Date.parse(at)+86400000).toISOString();
  f.put('posts','unavailable-own',{channelId:'own',title:'unavailable-own-title',url:'https://example.test/unavailable-own',publishedDate:today(),publishedAt:at,expiresAt:future,unavailableAt:at});
  f.put('snapshots','unavailable-own-snapshot',{postId:'unavailable-own',date:today(),checkedAt:at,views:987654321,expiresAt:future,ownership:{known:true,ownerIds:[f.users.member.id],teamId:'a'}});
  const before=f.snapshot();f.reset();
  for(const route of routes){
    const result=await f.get(route,'member');assert.equal(result.status,200,result.text);
    assert.doesNotMatch(result.text,/unavailable-own|987654321/);
    assert.equal(result.text,baseline.get(route),'unavailable owned posts and snapshots change neither rows nor aggregates: '+route);
    if(result.data?.metrics){assert.equal(result.data.metrics.views.latest,10);assert.equal(result.data.overview.postCount,1);}
  }
  assert.equal(f.metrics.transactions,0);assert.equal(f.metrics.removed,0);assert.equal(f.snapshot(),before,'HTTP reads preserve raw documents, tokens and credentials');
  assert.ok(f.app.store.get('posts','unavailable-own'));assert.ok(f.app.store.get('snapshots','unavailable-own-snapshot'));
});
