import test from 'node:test';
import assert from 'node:assert/strict';
import {createClassroomTransport,createClassroomClient} from '../src/classroom-client.mjs';
test('browser transport uses only selected class, private bearer headers and preserves run ownership',async()=>{
 const calls=[],transport=createClassroomTransport({url:'https://example.test/functions/v1/synk-account',anonKey:'public',getAccessToken:()=> 'synthetic',guard(){},fetcher:async(url,init)=>{calls.push({url,...init});return Response.json({ok:true});}}),client=createClassroomClient({transport,classId:'class A',guard(){}});
 await client.learning.post({revision:3,events:[{id:'e'}],runId:'r'});assert.equal(calls[0].url,'https://example.test/functions/v1/synk-classroom/api/world/learning?classId=class+A');assert.deepEqual(JSON.parse(calls[0].body),{revision:3,events:[{id:'e'}],runId:'r'});assert.equal(calls[0].credentials,'omit');assert.equal(calls[0].headers.Authorization,'Bearer synthetic');
 await client.learning.get({after:4,revision:3});assert.match(calls[1].url,/after=4&revision=3/);
 assert.throws(()=>client.request('/api/logout',{}),/지원하지/);
 await assert.rejects(transport('assignments',{classId:'a',body:{classId:'b'}}),/scope mismatch/);
});
test('refresh retries once and a late response after account switch is discarded',async()=>{
 let token='old',calls=0;const transport=createClassroomTransport({url:'https://example.test',anonKey:'public',getAccessToken:()=>token,refresh:async()=>{token='new';},guard(){},fetcher:async(url,init)=>{calls++;return init.headers.Authorization==='Bearer old'?Response.json({}, {status:401}):Response.json({ok:true,classes:[]});}});
 assert.deepEqual(await transport('classes'),{ok:true,classes:[]});assert.equal(calls,2);
 let active=true,release;const late=createClassroomTransport({url:'https://example.test',getAccessToken:()=>token,guard(){if(!active)throw Object.assign(Error('changed'),{code:'ACCOUNT_CHANGED'});},fetcher:()=>new Promise(resolve=>release=resolve)});const pending=late('classes');await new Promise(r=>setImmediate(r));active=false;release(Response.json({ok:true}));await assert.rejects(pending,{code:'ACCOUNT_CHANGED'});
});
test('HTML deployment errors fail with a useful unavailable error, malformed success never grants a session',async()=>{
 const transport=createClassroomTransport({url:'https://example.test',guard(){},getAccessToken:()=> 'fixture',fetcher:async()=>new Response('<html>404</html>',{status:404})});await assert.rejects(transport('classes'),{code:'CLASSROOM_UNAVAILABLE'});
});

test('a failed network fetch is distinguishable from a server permission denial',async()=>{
 const options={url:'https://example.test',guard(){},getAccessToken:()=> 'fixture'};
 await assert.rejects(createClassroomTransport({...options,fetcher:async()=>{throw new TypeError('Failed to fetch');}})('classes'),{code:'NETWORK_ERROR'});
 await assert.rejects(createClassroomTransport({...options,fetcher:async()=>Response.json({ok:false,error:{code:'FORBIDDEN'}},{status:403})})('classes'),{code:'FORBIDDEN',status:403});
});

test('teacher overview is unscoped but care and student Town use only their fixed class routes',async()=>{
  const calls=[],transport=createClassroomTransport({url:'https://example.test',guard(){},getAccessToken:()=> 'fixture',fetcher:async(url,init)=>{calls.push({url,...init});return Response.json({ok:true});}}),client=createClassroomClient({transport,classId:'class-a',guard(){}});
  await transport('teacherOverview');assert.equal(calls[0].url,'https://example.test/functions/v1/synk-classroom/api/teacher/overview');
  await client.request('/api/teacher/care');await client.request('/api/teacher/care',{learnerId:'student-a',title:'확인',assigneeId:'teacher-a',dueAt:'2026-10-12T00:00:00Z',status:'open',idempotencyKey:'test'});
  assert.equal(calls[1].method,'GET');assert.equal(calls[2].method,'POST');assert(calls.slice(1).every(row=>row.url.endsWith('/api/teacher/care?classId=class-a')));
  await client.townMembership();await client.townSharing({enabled:true,revision:1});await client.townActivity({eventId:'visit-a',revision:2,townId:'town-a',kind:'visit',activity:'town-opened'});
  assert.deepEqual(calls.slice(3).map(row=>new URL(row.url).pathname),['/functions/v1/synk-classroom/api/world/town/membership','/functions/v1/synk-classroom/api/world/town/sharing','/functions/v1/synk-classroom/api/world/town/activity']);assert(calls.slice(3).every(row=>new URL(row.url).searchParams.get('classId')==='class-a'));
  assert.throws(()=>client.request('/api/teacher/overview'),{code:'FORBIDDEN'});await assert.rejects(transport('teacherOverview',{classId:'class-a'}),/Invalid classroom request/);
});
