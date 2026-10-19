import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { request } from 'node:http';
import { createServer, createRequestHandler } from './server.mjs';
import { productionOptions } from './deploy/runtime.mjs';

const id=()=>randomUUID().replaceAll('-','');
async function publicServer(t,options={}){
  const server=createServer({...productionOptions({SYNK_SPACESHIP_PUBLIC:'1'}),trustedProxyIps:['127.0.0.1'],...options});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{server.closeGame();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
  const send=(route,{method='GET',body,headers={}}={})=>new Promise((resolve,reject)=>{
    const req=request({host:'127.0.0.1',port:server.address().port,path:'/api/spaceship'+route,method,headers:{Host:'workspace.synk.im',Origin:'https://synk.im','Sec-Fetch-Site':'cross-site','X-Forwarded-For':'198.51.100.20',...(body?{'Content-Type':'application/json'}:{}),...headers}},res=>{
      let data='';res.on('data',chunk=>data+=chunk);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,data:data?JSON.parse(data):null}));
    });req.on('error',reject);req.end(body?JSON.stringify(body):undefined);
  });
  const create=(headers={})=>send('/rooms',{method:'POST',body:{id:id()},headers});
  return {server,send,create};
}

test('public mode fails closed without explicit origins, hosts, proxy and room cap',()=>{
  assert.throws(()=>productionOptions({}),/Explicit public/);
  assert.equal(productionOptions({SYNK_SPACESHIP_PUBLIC:'1'}).maxRooms,50);
  for(const value of ['0','51','2.2','NaN'])assert.throws(()=>productionOptions({SYNK_SPACESHIP_PUBLIC:'1',SYNK_SPACESHIP_MAX_ROOMS:value}),/room limit/);
  for(const options of [{publicMode:true},{allowedOrigins:['*']},{allowedOrigins:['https://synk.im/']},{allowedOrigins:['http://synk.im']},{trustedProxyIps:['172.30.77.0/29']},{maxRateEntries:0}])assert.throws(()=>createRequestHandler(options));
});

test('only the public game origin can preflight GET/POST room requests without cookies',async t=>{
  const h=await publicServer(t);
  const valid=await h.send('/rooms',{method:'OPTIONS',headers:{'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization, content-type'}});
  assert.equal(valid.status,204);assert.equal(valid.headers['access-control-allow-origin'],'https://synk.im');assert.equal(valid.headers['access-control-allow-credentials'],undefined);
  assert.equal(valid.headers['access-control-allow-methods'],'GET, POST');assert.equal(valid.headers.vary,'Origin');
  for(const headers of [{Origin:'https://evil.example'},{Origin:'https://synk.im.evil.example'},{Origin:'null'},{Origin:'https://synk.im/'},{Origin:'https://workspace.synk.im'},{Origin:''}]){
    const rejected=await h.create(headers);assert.equal(rejected.status,403);assert.equal(rejected.headers['access-control-allow-origin'],undefined);
  }
  for(const headers of [{'Access-Control-Request-Method':'DELETE'},{'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'x-account-token'}])assert.equal((await h.send('/rooms',{method:'OPTIONS',headers})).status,403);
});

test('public host restriction and static isolation preserve the internal health probe',async t=>{
  const h=await publicServer(t);
  for(const Host of ['evil.example','workspace.synk.im.evil.example','127.0.0.1','localhost','evil@workspace.synk.im'])assert.equal((await h.create({Host})).status,403);
  const health=await h.send('/health',{headers:{Host:'127.0.0.1:4318',Origin:'','Sec-Fetch-Site':'none'}});assert.equal(health.status,200);assert.equal(health.data.storage,'ephemeral');assert.equal(health.data.maxRooms,50);
  const response=await fetch(`http://127.0.0.1:${h.server.address().port}/server.mjs`);assert.equal(response.status,404);
});

test('verified Caddy addresses have independent room limits; forged chains fail',async t=>{
  const h=await publicServer(t,{maxRoomsPerAddress:1});
  const a=await h.create();assert.equal(a.status,201);
  assert.equal((await h.create()).data.error,'ROOM_LIMIT');
  assert.equal((await h.create({'X-Forwarded-For':'198.51.100.21'})).status,201);
  for(const value of ['198.51.100.21, 198.51.100.22','not-an-ip',''])assert.equal((await h.create({'X-Forwarded-For':value})).data.error,'PROXY');
  const state=await h.send(`/rooms/${a.data.code}/state`,{headers:{Authorization:`Bearer ${a.data.token}`}});
  assert.equal(state.status,200);assert.ok(!JSON.stringify(state.data).includes('198.51.100.20'));
});

test('forwarded IPs from an untrusted peer cannot bypass a room limit',async t=>{
  const h=await publicServer(t,{trustedProxyIps:['172.30.77.3'],maxRoomsPerAddress:1});
  assert.equal((await h.create()).status,201);
  assert.equal((await h.create({'X-Forwarded-For':'198.51.100.21'})).data.error,'ROOM_LIMIT');
});

test('room and rate registries stay bounded and expiry frees capacity',async t=>{
  let now=1000;const h=await publicServer(t,{now:()=>now,maxRooms:1,roomTtl:1000,maxRateEntries:4});
  const a=await h.create();assert.equal(a.status,201);
  assert.equal((await h.create({'X-Forwarded-For':'198.51.100.21'})).data.error,'CAPACITY');
  assert.equal((await h.create({'X-Forwarded-For':'198.51.100.22'})).data.error,'RATE_CAPACITY');
  now+=61000;assert.equal((await h.create({'X-Forwarded-For':'198.51.100.22'})).status,201);
});

test('public room token works independently of arbitrary account or company cookies',async t=>{
  const h=await publicServer(t),created=await h.create();assert.equal(created.status,201);
  const route=`/rooms/${created.data.code}/state`;
  assert.equal((await h.send(route,{headers:{Cookie:'company_session=synthetic',Authorization:'Bearer synthetic-account-token'}})).status,401);
  const restored=await h.send(route,{headers:{Cookie:'company_session=synthetic',Authorization:`Bearer ${created.data.token}`}});
  assert.equal(restored.status,200);assert.equal(restored.headers['set-cookie'],undefined);
  const joined=await h.send(`/rooms/${created.data.code}/join`,{method:'POST',body:{id:id()},headers:{'X-Forwarded-For':'198.51.100.21'}});assert.equal(joined.status,201);
  h.server.closeGame();assert.equal((await h.send(route,{headers:{Authorization:`Bearer ${created.data.token}`}})).data.error,'SHUTDOWN');
});

test('cross-origin SSE retains CORS headers, private role views and shutdown notification',async t=>{
  const h=await publicServer(t),created=await h.create(),a=created.data;
  const joined=await h.send(`/rooms/${a.code}/join`,{method:'POST',body:{id:id()},headers:{'X-Forwarded-For':'198.51.100.21'}}),b=joined.data;
  const requests=[];t.after(()=>requests.forEach(req=>req.destroy()));
  const connect=player=>new Promise((resolve,reject)=>{
    const req=request({host:'127.0.0.1',port:h.server.address().port,path:`/api/spaceship/rooms/${a.code}/events`,headers:{Host:'workspace.synk.im',Origin:'https://synk.im','Sec-Fetch-Site':'cross-site','X-Forwarded-For':'198.51.100.20',Authorization:`Bearer ${player.token}`}},res=>{
      const stream={headers:res.headers,data:'',done:new Promise(done=>res.on('end',done))};
      res.on('data',chunk=>{stream.data+=chunk;resolve(stream);});
    });req.on('error',reject);requests.push(req);req.end();
  });
  const sa=await connect(a),sb=await connect(b);
  for(const stream of [sa,sb]){
    assert.equal(stream.headers['access-control-allow-origin'],'https://synk.im');assert.equal(stream.headers['content-type'],'text/event-stream');
    const view=JSON.parse(stream.data.match(/^data: (.+)$/m)[1]);assert.ok(!('target' in view));assert.ok(!JSON.stringify(view).includes(a.token));
  }
  h.server.closeGame();await Promise.all([sa.done,sb.done]);assert.match(sa.data,/event: shutdown/);assert.match(sb.data,/event: shutdown/);
});
