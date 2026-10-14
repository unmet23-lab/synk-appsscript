import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from './store.mjs';
import {createSocialProvider} from './social-provider.mjs';

const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
function fixture(t){
  const directory=mkdtempSync(join(tmpdir(),'synk-provider-health-')),store=new Store(directory);t.after(()=>{store.close();rmSync(directory,{recursive:true,force:true});});
  const admin={id:'admin',active:true,role:'admin'},member={id:'member',active:true,role:'member',teamId:'a'},other={id:'other',active:true,role:'member',teamId:'b'};for(const u of [admin,member,other])store.put('users',u.id,u);
  const channel={id:'channel',active:true,platform:'threads',handle:'synk',ownerIds:['member'],teamId:'a',connectionVersion:1};store.put('channels',channel.id,channel);
  let at='2026-10-13T00:00:00.000Z',handler,rows=[{id:'integration',identifier:'threads',name:'SYNK',profile:'synk',disabled:false}];const calls=[];
  const fetchImpl=async(url,init)=>{calls.push({url,init});const path=new URL(url).pathname.split('/').at(-1),special=await handler?.(path,init);if(special)return special;if(path==='me')return json({organization:{id:'org',name:'SYNK'}});if(path==='integrations')return json(rows);if(path==='is-connected')return json({connected:true});throw Error('Unexpected fake endpoint');};
  const create=()=>createSocialProvider({store,fetchImpl,clock:()=>at}),provider=create();
  return {store,admin,member,other,channel,calls,provider,create,advance:ms=>at=new Date(Date.parse(at)+ms).toISOString(),setHandler:fn=>handler=fn,setRows:value=>rows=value,configure:async()=>{await provider.configure(admin,{apiKey:'synthetic-postiz-secret'});await provider.connect(admin,{channelId:'channel',integrationId:'integration'});calls.length=0;}};
}

test('Postiz health distinguishes API credential proof from social account list and does not reconnect',async t=>{
  const f=fixture(t);assert.equal(f.provider.health(f.admin).api.state,'unconfigured');assert.equal((await f.provider.scanHealthDue()).checked,0);assert.equal(f.calls.length,0);await f.configure();const before=f.store.get('socialConnections','channel');const result=await f.provider.checkHealth(f.admin);
  assert.equal(result.api.state,'connected');assert.equal(result.api.stale,false);assert.equal(result.channels[0].state,'listed');assert.equal(result.channels[0].message.includes('발행 때'),true);assert.deepEqual(f.store.get('socialConnections','channel'),before);assert.equal(f.calls.length,3);assert.ok(f.calls.every(c=>c.init.method==='GET'&&c.init.redirect==='error'));assert.ok(!JSON.stringify(result).includes('secret'));
  assert.deepEqual(f.provider.health(f.other).channels,[]);assert.equal(f.provider.health(f.member).canCheck,false);assert.throws(()=>f.provider.checkHealth(f.member),{code:'ADMIN_REQUIRED'});assert.throws(()=>f.provider.checkHealth({id:'unknown',role:'admin',active:true}),{code:'ADMIN_REQUIRED'});
});

test('health cache persists across restarts and becomes stale without network or false refresh',async t=>{
  const f=fixture(t);await f.configure();await f.provider.checkHealth(f.admin);const checked=f.provider.health(f.admin).api.checkedAt,count=f.calls.length;assert.equal((await f.create().checkHealth(f.admin)).cached,true);assert.equal(f.calls.length,count);f.advance(3600001);assert.equal(f.provider.health(f.admin).api.stale,true);assert.equal(f.calls.length,count);
  f.setHandler(path=>path==='is-connected'?json({error:'synthetic-postiz-secret'},503):null);const result=await f.provider.checkHealth(f.admin);assert.equal(result.api.state,'error');assert.equal(result.api.checkedAt,checked);assert.equal(result.api.stale,true);assert.ok(!JSON.stringify(result).includes('secret'));assert.equal(result.channels[0].state,'listed');assert.equal(result.channels[0].stale,true);
});

test('account list absence, disabled and profile mismatch are separate from a working API',async t=>{
  for(const mode of ['missing','disabled','changed']){const f=fixture(t);await f.configure();f.setRows(mode==='missing'?[]:[{id:'integration',identifier:'threads',profile:mode==='changed'?'different':'synk',disabled:mode==='disabled'}]);const result=await f.provider.checkHealth(f.admin);assert.equal(result.api.state,'connected');assert.equal(result.channels[0].state,mode);assert.equal(f.store.get('socialConnections','channel').status,'connected');}
});

test('bad API token or different Postiz organization never reports account check success',async t=>{
  for(const mode of ['token','disconnected','organization']){const f=fixture(t);await f.configure();f.setHandler(path=>mode==='token'&&path==='is-connected'?json({private:'secret'},401):mode==='disconnected'&&path==='is-connected'?json({connected:false}):mode==='organization'&&path==='me'?json({organization:{id:'other'}}):null);const result=await f.provider.checkHealth(f.admin);assert.equal(result.api.state,'auth_required');assert.equal(result.api.checkedAt,null);assert.equal(result.channels[0].state,'unknown');assert.ok(!JSON.stringify(result).includes('secret'));}
});

test('configuration, credential generation and session changes discard awaited health results',async t=>{
  for(const mode of ['config','credential','user','session']){const f=fixture(t);await f.configure();let allowed=true;f.setHandler(path=>{if(path==='integrations'){if(mode==='config')f.store.put('socialProviderSettings','postiz',{...f.store.get('socialProviderSettings','postiz'),version:'new'});if(mode==='credential')f.store.setSecret('social:postiz',{...f.store.secret('social:postiz'),apiKey:'new'});if(mode==='user')f.store.put('users','admin',{...f.admin,active:false});if(mode==='session')allowed=false;}});await assert.rejects(f.provider.checkHealth(f.admin,{}, {authorize(){if(!allowed)throw Error('revoked');}}));assert.ok(!f.store.get('socialProviderHealth','postiz').checkedAt);assert.equal(f.provider.health(f.admin).api.checkedAt,null);}
});

test('health coalesces concurrent checks and reauthorizes each joined caller',async t=>{
  const f=fixture(t);await f.configure();let release,entered,allowed=true;const started=new Promise(r=>entered=r);f.setHandler(path=>path==='is-connected'?(entered(),new Promise(r=>release=()=>r(json({connected:true})))):null);const first=f.provider.checkHealth(f.admin);await started;const second=f.provider.checkHealth(f.admin,{}, {authorize(){if(!allowed)throw Error('revoked');}});const rejected=assert.rejects(second);allowed=false;release();assert.equal((await first).api.state,'connected');await rejected;assert.equal(f.calls.length,3);
});

test('health scans honor cadence, failure state, active configuration owner and shutdown',async t=>{
  const f=fixture(t);await f.configure();f.setHandler(path=>path==='is-connected'?json({private:'secret'},503):null);assert.deepEqual(await f.provider.scanHealthDue(),{checked:1,failed:1});const count=f.calls.length;assert.equal((await f.provider.scanHealthDue()).checked,0);assert.equal(f.calls.length,count);f.advance(3600000);f.store.put('users','admin',{...f.admin,role:'member'});assert.equal((await f.provider.scanHealthDue()).checked,0);assert.equal(f.calls.length,count);
  f.store.put('users','admin',f.admin);let entered;const started=new Promise(r=>entered=r);f.setHandler((path,init)=>path==='is-connected'?(entered(),new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}))):null);const checking=f.provider.checkHealth(f.admin);const rejected=assert.rejects(checking);await started;await f.provider.stopHealth();await rejected;await f.provider.waitForHealthIdle();assert.equal((await f.provider.scanHealthDue()).checked,0);assert.throws(()=>f.provider.checkHealth(f.admin),{code:'HEALTH_STOPPED'});
});
