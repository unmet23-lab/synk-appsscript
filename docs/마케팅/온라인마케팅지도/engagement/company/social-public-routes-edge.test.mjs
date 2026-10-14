import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {createHmac} from 'node:crypto';
import {Store} from './store.mjs';
import {createSocialPublishingService} from './social-publishing.mjs';
import {createSocialReview} from './social-review.mjs';
import {createSocialTracking,socialTrackingSignaturePayload} from './social-tracking.mjs';
import {createSocialPublicRoutes} from './social-public-routes.mjs';

const origin='https://workspace.example.test',site='https://site.example.test';
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'social-public-edge-')),store=new Store(directory),clock=()=> '2026-10-13T00:00:00.000Z';
  const user=store.createUser({email:'owner@edge.test',name:'Owner',role:'admin'});store.put('channels','ig',{id:'ig',platform:'instagram',active:true,ownerIds:[user.id]});
  const publishing=createSocialPublishingService({store,clock}),post=publishing.savePost(user,{title:'원문',body:'본문',variants:[{channelId:'ig',format:'text',text:'본문'}]}).post;
  const review=createSocialReview({store,publishing,clock,origin}),tracking=createSocialTracking({store,publishing,clock,origin});tracking.configure(user,{enabled:true,allowedOrigins:[site]});
  const link=tracking.createLink(user,{postId:post.id,channelId:'ig',destination:site+'/start'}).link,{clickId}=tracking.click(link.id);
  t.after(async()=>{await review.stop();await publishing.close();store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  function route({body,signal,isStopped=()=>false,reviewImpl=review}={}){const responses=[];const handle=createSocialPublicRoutes({review:reviewImpl,tracking,body,signal,isStopped,origin,clientAddress:()=> 'fake-client',send:(_res,status,value)=>responses.push({status,value})});const res={headers:{},setHeader(name,value){this.headers[name]=value;},writeHead(status,headers){this.status=status;Object.assign(this.headers,headers);},end(value){this.body=value;}};return {handle,res,responses};}
  return {store,user,publishing,post,review,tracking,clickId,clock,route};
}
function deferred(){let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};}
const request=(path,headers={})=>({req:{method:'POST',headers:{origin:site,...headers}},context:{url:new URL(path,origin)}});

test('browser and verified conversion writes stop if shutdown starts during body receipt',async t=>{
  const f=await fixture(t),key=f.tracking.rotateKey(f.user,{rotate:true}).key;
  for(const path of ['/social-track/event','/social-track/verified']){
    const wait=deferred(),controller=new AbortController(),input={clickId:f.clickId,eventId:path.endsWith('event')?'browser-stop':'verified-stop',event:'signup'},timestamp=String(Date.parse(f.clock())),signature=createHmac('sha256',key).update(socialTrackingSignaturePayload(timestamp,input)).digest('hex');
    const r=f.route({body:()=>wait.promise,signal:controller.signal}),{req,context}=request(path,{'x-synk-timestamp':timestamp,'x-synk-signature':signature});
    const pending=r.handle(req,r.res,context);controller.abort();wait.resolve(input);
    await assert.rejects(pending,{status:503});assert.equal(r.responses.length,0);assert.equal(f.store.all('socialTrackingEvents').length,0);
  }
});

test('customer review writes are not invoked after a stop during body receipt',async t=>{
  const f=await fixture(t),link=await f.review.create(f.user,{postId:f.post.id,revision:f.post.revision}),token=new URL(link.url).hash.split('=')[1],wait=deferred();let stopped=false;
  const r=f.route({body:()=>wait.promise,isStopped:()=>stopped}),{req,context}=request('/api/social-review/respond',{origin,authorization:'Bearer '+token});
  const pending=r.handle(req,r.res,context);stopped=true;wait.resolve({revision:1,requestId:'body-stop-1',decision:'approve'});
  await assert.rejects(pending,{status:503});assert.equal(f.store.all('socialReviewLinks')[0].feedback.length,0);assert.equal(r.responses.length,0);
});

test('review committed before response cancellation remains idempotent when the same request is retried',async t=>{
  const f=await fixture(t),link=await f.review.create(f.user,{postId:f.post.id,revision:f.post.revision}),token=new URL(link.url).hash.split('=')[1],controller=new AbortController(),input={revision:1,requestId:'committed-retry-1',decision:'approve',name:'고객'};
  const wrapper={...f.review,respond:async(...args)=>{const result=await f.review.respond(...args);controller.abort();return result;}},r=f.route({body:async()=>input,signal:controller.signal,reviewImpl:wrapper}),{req,context}=request('/api/social-review/respond',{origin,authorization:'Bearer '+token});
  await assert.rejects(r.handle(req,r.res,context),{status:503});assert.equal(r.responses.length,0);assert.equal(f.store.all('socialReviewLinks')[0].feedback.length,1);
  const retry=f.route({body:async()=>input});await retry.handle(req,retry.res,context);assert.equal(retry.responses[0].status,200);assert.equal(retry.responses[0].value.review.status,'approved');assert.equal(f.store.all('socialReviewLinks')[0].feedback.length,1);
});

test('browser route cannot upgrade a conversion using verified headers and a revoked origin is rechecked after await',async t=>{
  const f=await fixture(t),input={clickId:f.clickId,eventId:'browser-only',event:'signup'},key=f.tracking.rotateKey(f.user,{rotate:true}).key,timestamp=String(Date.parse(f.clock())),signature=createHmac('sha256',key).update(socialTrackingSignaturePayload(timestamp,input)).digest('hex');
  const browser=f.route({body:async()=>input}),{req,context}=request('/social-track/event',{'x-synk-timestamp':timestamp,'x-synk-signature':signature});await browser.handle(req,browser.res,context);
  assert.equal(browser.responses[0].value.source,'browser');assert.equal(f.tracking.workspace(f.user).totals.verifiedEvents.signup,null);
  const wait=deferred(),pendingRoute=f.route({body:()=>wait.promise}),pending=pendingRoute.handle(req,pendingRoute.res,context);f.tracking.configure(f.user,{enabled:true,allowedOrigins:[]});wait.resolve({...input,eventId:'after-revoke'});
  await assert.rejects(pending,{status:404});assert.equal(f.store.all('socialTrackingEvents').length,1);
});

test('short tracking links accept the click parameters SNS apps add but still refuse demo requests and queries on API routes',async t=>{
  const f=await fixture(t),id=f.store.all('socialTrackingLinks')[0].id;
  for(const query of ['?fbclid=IwAR0abc123','?utm_source=ig&igshid=MzRlODBiNWFlZA']){
    const r=f.route();await r.handle({method:'GET',headers:{}},r.res,{url:new URL('/s/'+id+query,origin)});
    assert.equal(r.res.status,302);assert.equal(new URL(r.res.headers.Location).origin,site);
  }
  const demo=f.route();await assert.rejects(demo.handle({method:'GET',headers:{}},demo.res,{url:new URL('/s/'+id+'?demo=1',origin)}),{status:400});
  const header=f.route();await assert.rejects(header.handle({method:'GET',headers:{'x-synk-demo':'1'}},header.res,{url:new URL('/s/'+id,origin)}),{status:400});
  const api=f.route({body:async()=>({})}),{req,context}=request('/social-track/event?fbclid=IwAR0abc123');await assert.rejects(api.handle(req,api.res,context),{status:400});
  assert.equal(f.store.all('socialTrackingClicks').length,3);
});
