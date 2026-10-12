import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter,once} from 'node:events';
import {createServer,request} from 'node:http';
import {createCreativeResearchEvents} from './creative-research-events.mjs';

class Response extends EventEmitter{
  constructor(){super();this.frames=[];this.writableEnded=false;this.destroyed=false;this.endCount=0;this.destroyCount=0;}
  writeHead(status,headers){this.status=status;this.headers=headers;}
  flushHeaders(){}
  write(frame){if(this.writeError)throw new Error('closed socket');this.frames.push(frame);return !this.backpressured;}
  end(){this.endCount++;this.writableEnded=true;this.emit('finish');}
  destroy(){this.destroyCount++;this.destroyed=true;this.emit('close');}
}
const req=(userId='owner',session='original')=>Object.assign(new EventEmitter(),{userId,session,aborted:false});
const payloads=res=>res.frames.filter(frame=>frame.startsWith('event: changed\n')).map(frame=>JSON.parse(frame.split('\ndata: ')[1]));
function fixture(t,options={}){
  const users=new Map(['owner','other'].map(id=>[id,{session:'original',active:true,role:'member',readable:true,revision:'visible-'+id}]));
  const calls=[];
  const events=createCreativeResearchEvents({resolveAccess(input){calls.push(input.userId);const user=users.get(input.userId);return user?.session===input.session&&user.active&&['admin','member','viewer'].includes(user.role)&&user.readable?{revision:user.revision,entries:[{private:'must never be sent'}]}:null;},...options});
  t.after(()=>events.stop());
  function connect(userId){const input=req(userId),res=new Response(),disconnect=events.connect(input,res);return {req:input,res,disconnect};}
  return {events,users,calls,connect};
}

test('SSE starts with only a revision and a private change never alerts another viewer',t=>{
  const f=fixture(t),owner=f.connect('owner'),other=f.connect('other');
  assert.equal(owner.res.status,200);assert.match(owner.res.headers['Content-Type'],/^text\/event-stream/);
  assert.equal(owner.res.headers['Cache-Control'],'no-store');assert.equal(owner.res.headers['X-Accel-Buffering'],'no');
  assert.deepEqual(payloads(owner.res),[{revision:'visible-owner'}]);assert.deepEqual(payloads(other.res),[{revision:'visible-other'}]);
  assert.equal(f.events.changed(),0);
  f.users.get('owner').revision='owner-private-edit';
  assert.equal(f.events.changed(),1);assert.deepEqual(payloads(owner.res),[{revision:'visible-owner'},{revision:'owner-private-edit'}]);
  assert.deepEqual(payloads(other.res),[{revision:'visible-other'}]);
  f.users.get('owner').revision='company-new';f.users.get('other').revision='company-new';
  assert.equal(f.events.changed(),2);assert.equal(f.events.changed(),0);
  for(const stream of [owner,other])for(const payload of payloads(stream.res))assert.deepEqual(Object.keys(payload),['revision']);
  assert.ok(f.calls.filter(id=>id==='other').length>=5);
});

for(const invalidation of ['session','active','role','readable']){
  test(`a ${invalidation} change closes a live stream before any changed event`,t=>{
    const f=fixture(t),stream=f.connect('owner'),user=f.users.get('owner');
    user[invalidation]=({session:'revoked',active:false,role:'retired',readable:false})[invalidation];user.revision='secret-after-revocation';
    assert.equal(f.events.changed(),0);assert.equal(stream.res.writableEnded,true);
    assert.deepEqual(payloads(stream.res),[{revision:'visible-owner'}]);
    assert.equal(stream.req.listenerCount('aborted'),0);assert.equal(stream.res.listenerCount('close'),0);
    assert.equal(f.events.changed(),0);assert.equal(stream.res.endCount,1);
  });
}

test('heartbeat revalidates access and discovers missed changes without sending a body',t=>{
  t.mock.timers.enable({apis:['setInterval']});
  const f=fixture(t,{heartbeatMs:20}),owner=f.connect('owner'),other=f.connect('other');
  t.mock.timers.tick(20);
  assert.equal(owner.res.frames.at(-1),': heartbeat\n\n');assert.deepEqual(payloads(owner.res),[{revision:'visible-owner'}]);
  f.users.get('owner').revision='missed-change';f.users.get('other').session='revoked';
  t.mock.timers.tick(20);
  assert.deepEqual(payloads(owner.res),[{revision:'visible-owner'},{revision:'missed-change'}]);
  assert.equal(other.res.writableEnded,true);assert.deepEqual(payloads(other.res),[{revision:'visible-other'}]);
  const before=f.calls.length;f.events.stop();t.mock.timers.tick(100);
  assert.equal(f.calls.length,before);assert.equal(owner.res.writableEnded,true);
});

test('authorization failures and malformed or asynchronous revisions fail closed',t=>{
  let access=null;const events=createCreativeResearchEvents({resolveAccess(){if(access==='throw')throw new Error('private details');return access;}});
  t.after(()=>events.stop());
  for(const denied of [null,{revision:''},{revision:1},{revision:'x'.repeat(257)},Promise.resolve({revision:'async'}),Promise.reject(new Error('async authorization failed')),'throw']){
    access=denied;const res=new Response();assert.throws(()=>events.connect(req(),res),{status:401});assert.equal(res.status,undefined);assert.equal(res.frames.length,0);
  }
  access={revision:'readable'};const res=new Response();events.connect(req(),res);access='throw';
  assert.equal(events.changed(),0);assert.equal(res.writableEnded,true);assert.deepEqual(payloads(res),[{revision:'readable'}]);
});

test('authorization is checked again after stream headers before the initial event',t=>{
  let readable=true;const events=createCreativeResearchEvents({resolveAccess:()=>readable?{revision:'secret'}:null});t.after(()=>events.stop());
  const res=new Response();res.flushHeaders=()=>{readable=false;};events.connect(req(),res);
  assert.equal(res.frames.length,0);assert.equal(res.writableEnded,true);
});

test('connection cap releases slots on client close and ignores completed GET request close',t=>{
  const f=fixture(t,{maxConnections:1}),first=f.connect('owner'),blocked=new Response();
  assert.throws(()=>f.events.connect(req('other'),blocked),{status:503});assert.equal(blocked.frames.length,0);assert.equal(blocked.status,undefined);
  first.req.emit('close');assert.equal(first.res.writableEnded,false);
  first.res.emit('close');assert.equal(first.res.endCount,1);const second=f.connect('other');
  second.req.aborted=true;second.req.emit('aborted');assert.equal(second.res.writableEnded,true);
  f.connect('owner');
});

test('disconnect, response finish and errors remove listeners and stop heartbeats',t=>{
  t.mock.timers.enable({apis:['setInterval']});
  const f=fixture(t,{maxConnections:1,heartbeatMs:10});
  for(const end of ['disconnect','finish','response-error','request-error']){
    const stream=f.connect('owner');
    if(end==='disconnect'){stream.disconnect();stream.disconnect();}
    else if(end==='finish')stream.res.emit('finish');
    else if(end==='response-error')stream.res.emit('error',new Error('socket closed'));
    else stream.req.emit('error',new Error('request closed'));
    assert.equal(stream.req.listenerCount('aborted'),0);assert.equal(stream.req.listenerCount('error'),0);
    assert.equal(stream.res.listenerCount('close'),0);assert.equal(stream.res.listenerCount('finish'),0);assert.equal(stream.res.listenerCount('error'),0);
    const before=f.calls.length;t.mock.timers.tick(30);assert.equal(f.calls.length,before);
  }
});

test('slow or broken writes destroy a stream rather than keeping unbounded pending frames',t=>{
  const f=fixture(t,{maxConnections:1}),slow=f.connect('owner');slow.res.backpressured=true;f.users.get('owner').revision='next';
  assert.equal(f.events.changed(),0);assert.equal(slow.res.destroyCount,1);assert.equal(slow.res.listenerCount('close'),0);
  const broken=f.connect('other');broken.res.writeError=true;f.users.get('other').revision='next';
  assert.equal(f.events.changed(),0);assert.equal(broken.res.destroyCount,1);f.connect('owner');
});

test('stop is idempotent, closes all clients, and rejects later connections',t=>{
  const f=fixture(t),owner=f.connect('owner'),other=f.connect('other');f.events.stop();f.events.stop();
  assert.equal(owner.res.endCount,1);assert.equal(other.res.endCount,1);assert.equal(f.events.changed(),0);
  assert.throws(()=>f.events.connect(req(),new Response()),{status:503});
});

test('revision JSON cannot inject another SSE event or expose resolver metadata',t=>{
  const revision='hash\nevent: secret\ndata: private';const events=createCreativeResearchEvents({resolveAccess:()=>({revision,private:'never'})});t.after(()=>events.stop());
  const res=new Response();events.connect(req(),res);assert.deepEqual(payloads(res),[{revision}]);
  assert.equal(res.frames[0].split('\n').length,4);assert.equal(res.frames[0].includes('"private"'),false);
});

test('a real HTTP GET stays open, receives a committed revision, then ends on revocation',async t=>{
  let revision='initial',allowed=true;
  const events=createCreativeResearchEvents({resolveAccess:()=>allowed?{revision}:null,heartbeatMs:1000});
  const server=createServer((input,res)=>events.connect(input,res));
  let client;
  t.after(async()=>{events.stop();client?.destroy();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const response=await new Promise((resolve,reject)=>{client=request({host:'127.0.0.1',port:server.address().port,path:'/'},resolve);client.on('error',reject);client.end();});
  response.setEncoding('utf8');let text='';const seen=new EventEmitter();response.on('data',chunk=>{text+=chunk;seen.emit('data');});
  async function received(expected){while(!text.includes(expected))await once(seen,'data',{signal:AbortSignal.timeout(2000)});}
  await received('"revision":"initial"');assert.equal(response.complete,false);
  revision='committed';assert.equal(events.changed(),1);await received('"revision":"committed"');
  const ended=once(response,'end',{signal:AbortSignal.timeout(2000)});allowed=false;assert.equal(events.changed(),0);await ended;
  assert.equal(response.complete,true);assert.equal(text.includes('private'),false);
});
