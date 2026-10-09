import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { createServer } from './server.mjs';
import { newRoom, newPlayer, command, project, STAGES } from './core.mjs';

const uid=()=>randomUUID().replaceAll('-','');
async function setup(t,options={}){
  const server=createServer(options);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`,controllers=[];
  t.after(async()=>{controllers.forEach(c=>c.abort());server.closeGame();await new Promise(resolve=>server.close(resolve));});
  const request=async(route,method='GET',body,session,headers={})=>{const response=await fetch(base+'/api/spaceship'+route,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(session?{Authorization:'Bearer '+session.token}:{}),...headers},body:body?JSON.stringify(body):undefined});return{status:response.status,data:await response.json()};};
  const create=async()=>{const r=await request('/rooms','POST',{id:uid()});assert.equal(r.status,201);return r.data;};
  const join=async a=>{const r=await request(`/rooms/${a.code}/join`,'POST',{id:uid()});assert.equal(r.status,201);return r.data;};
  const snapshot=async p=>(await request(`/rooms/${p.code}/state`,'GET',undefined,p)).data;
  const connect=async p=>{const c=new AbortController();controllers.push(c);const r=await fetch(`${base}/api/spaceship/rooms/${p.code}/events`,{headers:{Authorization:'Bearer '+p.token},signal:c.signal});assert.equal(r.status,200);return{controller:c,reader:r.body.getReader()};};
  const act=async(p,type,fields={})=>{const s=await snapshot(p);return request(`/rooms/${p.code}/commands`,'POST',{type,id:uid(),revision:s.revision,...fields},p);};
  return{server,base,request,create,join,snapshot,connect,act};
}
test('two real clients repair all eighteen devices, alternate roles and jointly launch',async t=>{
  const h=await setup(t),a=await h.create(),b=await h.join(a);await h.connect(a);await h.connect(b);
  assert.equal((await h.act(a,'ready')).status,200);assert.equal((await h.act(b,'ready')).status,200);
  for(let round=0;round<18;round++){
    const players=[a,b];let s=await h.snapshot(a);
    if(s.phase==='tutorial'){
      for(const p of players)for(const clip of s.stage.words)assert.equal((await h.act(p,'study',{clip})).status,200);
      for(const p of players)assert.equal((await h.act(p,'ready')).status,200);
    }
    const nav=players[round%2],pilot=players[1-round%2],n=await h.snapshot(nav),p=await h.snapshot(pilot);
    assert.equal(n.role,'navigator');assert.equal(p.role,'pilot');assert.ok(n.target);assert.ok(!('target'in p));assert.ok(!JSON.stringify(p).includes('token'));assert.ok(!('rounds'in p));
    assert.equal((await h.act(pilot,'send',{clip:n.target})).status,403);
    assert.equal((await h.act(pilot,'act',{choice:n.target})).data.error,'NO_SIGNAL');
    assert.equal((await h.act(nav,'send',{clip:n.target})).status,200);
    assert.equal((await h.act(pilot,'act',{choice:n.target})).data.phase,'celebrate');
    assert.equal((await h.act(nav,'next')).status,403);
    assert.equal((await h.act(pilot,'next')).status,200);
  }
  assert.equal((await h.snapshot(a)).phase,'launch');assert.equal((await h.act(a,'launch')).data.phase,'launch');
  const result=(await h.act(b,'launch')).data;assert.equal(result.phase,'complete');assert.equal(result.summary.repaired,18);assert.equal(result.records.length,18);assert.equal(result.summary.teamHelp,0);assert.equal(result.stats.listeningAttempts,9);
});
test('command ids are idempotent, stale revisions reject and forged role data rejects',async t=>{
  const h=await setup(t),a=await h.create(),b=await h.join(a);await h.connect(a);await h.connect(b);const s=await h.snapshot(a);
  const payload={type:'ready',id:uid(),revision:s.revision};const first=await h.request(`/rooms/${a.code}/commands`,'POST',payload,a);assert.equal(first.status,200);
  const duplicate=await h.request(`/rooms/${a.code}/commands`,'POST',payload,a);assert.equal(duplicate.data.revision,first.data.revision);
  assert.equal((await h.request(`/rooms/${a.code}/commands`,'POST',{...payload,type:'leave'},a)).data.error,'ID_REUSED');
  assert.equal((await h.request(`/rooms/${a.code}/commands`,'POST',{...payload,id:uid()},b)).data.error,'REVISION');
  assert.equal((await h.act(b,'ready',{target:'red'})).data.error,'SCHEMA');
  const unauthorized=await h.request(`/rooms/${a.code}/state`);assert.equal(unauthorized.status,401);
});
test('duplicate join recovers only its original join id and third player cannot enter',async t=>{
  const h=await setup(t),a=await h.create(),joinId=uid();const first=await h.request(`/rooms/${a.code}/join`,'POST',{id:joinId});const same=await h.request(`/rooms/${a.code}/join`,'POST',{id:joinId});assert.equal(first.data.token,same.data.token);
  assert.equal((await h.request(`/rooms/${a.code}/join`,'POST',{id:uid()})).status,409);
  assert.notEqual(first.data.token,a.token);assert.equal((await h.request(`/rooms/${a.code}/state`,'GET',undefined,{token:'wrong'})).status,401);
});
test('same token in a new tab replaces the old stream without disconnecting the player',async t=>{
  const h=await setup(t),a=await h.create(),b=await h.join(a),old=await h.connect(a);await old.reader.read();await h.connect(b);const fresh=await h.connect(a);
  let data='';for(let i=0;i<4;i++){const read=await old.reader.read();if(read.done)break;data+=new TextDecoder().decode(read.value);if(data.includes('event: replaced'))break;}
  assert.ok(data.includes('event: replaced'));assert.equal((await h.snapshot(a)).connected,true);assert.equal((await h.snapshot(b)).partnerConnected,true);fresh.controller.abort();
});
test('disconnect pauses actions; authenticated reconnect preserves exact game state',async t=>{
  const h=await setup(t),a=await h.create(),b=await h.join(a);await h.connect(a);const connection=await h.connect(b);await h.act(a,'ready');await h.act(b,'ready');const before=await h.snapshot(b);connection.controller.abort();
  for(let i=0;i<25;i++){if((await h.snapshot(a)).paused)break;await new Promise(r=>setTimeout(r,10));}
  assert.equal((await h.snapshot(a)).paused,true);assert.equal((await h.act(a,'ready')).data.error,'PARTNER_OFFLINE');
  await h.connect(b);const after=await h.snapshot(b);assert.equal(after.paused,false);assert.equal(after.phase,before.phase);assert.equal(after.round,before.round);assert.equal(after.slot,before.slot);
});
test('room expiry, leaving, origin protection and static source isolation',async t=>{
  let now=1000;const h=await setup(t,{now:()=>now,roomTtl:1000}),a=await h.create();
  const foreign=await h.request(`/rooms/${a.code}/join`,'POST',{id:uid()},null,{Origin:'https://evil.example'});assert.equal(foreign.status,403);
  const rebound=await new Promise((resolve,reject)=>{const req=httpRequest(h.base+'/api/spaceship/health',{headers:{Host:'evil.example'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end();});assert.equal(rebound,403);
  for(const file of ['server.mjs','core.mjs','server.test.mjs','qa/ui.cjs'])assert.equal((await fetch(h.base+'/'+file)).status,404);
  assert.equal((await fetch(h.base+'/experiences/spaceship-coop/index.html')).status,200);
  assert.equal((await fetch(h.base+'/assets/audio/manifest.json')).status,200);
  now=2001;assert.equal((await h.request(`/rooms/${a.code}/state`,'GET',undefined,a)).status,404);
  const c=await h.create();assert.equal((await h.act(c,'leave')).data.phase,'closed');assert.equal((await h.request(`/rooms/${c.code}/join`,'POST',{id:uid()})).status,409);
});
test('wrong navigator sound differs from pilot mishearing; help and replay stay separate',()=>{
  const r=newRoom('ABC234');r.players[1]=newPlayer(1);r.players.forEach(p=>p.connected=true);r.phase='playing';r.rounds[0].target='red';
  const act=(slot,type,fields={})=>command(r,slot,{type,id:uid(),revision:r.revision,...fields});
  act(0,'send',{clip:'blue'});act(1,'act',{choice:'blue'});assert.equal(r.feedback.listeningCorrect,true);assert.equal(r.feedback.success,false);assert.equal(r.phase,'playing');
  act(0,'send',{clip:'red'});act(1,'act',{choice:'blue'});assert.equal(r.feedback.listeningCorrect,false);assert.equal(r.feedback.effect,'spin');
  act(1,'help');act(1,'replay');act(1,'act',{choice:'red'});assert.equal(r.phase,'celebrate');assert.equal(r.records[0].firstTry,false);assert.equal(r.players[1].stats.help,1);assert.equal(r.players[1].stats.replays,1);assert.equal(r.players[1].stats.listeningAttempts,3);assert.equal(r.players[1].stats.listeningCorrect,2);
  assert.ok(!('target' in project(r,1)));assert.ok(project(r,1).players.every(p=>!('stats'in p)));
});
test('new stages require each sound before ready; both players encounter all meanings',()=>{
  const r=newRoom('ABC234');r.players[1]=newPlayer(1);r.players.forEach(p=>p.connected=true);r.phase='tutorial';
  assert.throws(()=>command(r,0,{type:'ready',id:uid(),revision:0}),/모든 소리/);
  for(let stage=0;stage<3;stage++)for(let slot=0;slot<2;slot++){const words=new Set(r.rounds.filter((x,i)=>x.stage===stage&&i%2===slot).map(x=>x.target));assert.deepEqual([...words].sort(),[...STAGES[stage].words].sort());}
});
