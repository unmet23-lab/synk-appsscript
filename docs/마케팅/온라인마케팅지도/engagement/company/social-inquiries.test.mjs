import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {Store} from './store.mjs';
import {createSocialPublishingService} from './social-publishing.mjs';
import {createSocialTracking} from './social-tracking.mjs';
import {createSocialInquiries} from './social-inquiries.mjs';
import {createSocialMarketingService} from './social-marketing.mjs';
import {createSocialPublicRoutes} from './social-public-routes.mjs';
const site='https://site.example.test',origin='https://workspace.example.test';
const input={requestId:'12345678-1234-4234-8234-123456789012',name:'Synthetic customer',email:'visitor-private@example.test',message:'Private inquiry about a course',consent:true,website:''};
const context={origin:site,client:'fixture-address'};
function fixture(t){
  const directory=mkdtempSync(join(tmpdir(),'synk-inquiry-')),store=new Store(directory);
  const admin=store.createUser({email:'admin@test.example',name:'admin',role:'admin'}),owner=store.createUser({email:'owner@test.example',name:'owner',role:'member'}),other=store.createUser({email:'other@test.example',name:'other',role:'member'});
  store.put('channels','ig',{id:'ig',active:true,platform:'instagram',ownerIds:[owner.id]});
  store.put('channels','general',{id:'general',active:true,platform:'instagram',ownerIds:[admin.id]});
  let time='2026-10-20T00:00:00.000Z';const clock=()=>time;
  const publishing=createSocialPublishingService({store,clock}),tracking=createSocialTracking({store,publishing,clock,origin});
  tracking.configure(admin,{enabled:true,allowedOrigins:[site]});
  const post=publishing.savePost(owner,{title:'Course',body:'Try course',variants:[{channelId:'ig',text:'Try course'}]}).post;
  const link=tracking.createLink(owner,{postId:post.id,channelId:'ig',destination:site+'/lab/'}).link;
  const inquiries=createSocialInquiries({store,tracking,clock}),marketing=createSocialMarketingService({store,clock});
  t.after(async()=>{await publishing.close();store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));rmSync(directory,{recursive:true,force:true});});
  return {store,admin,owner,other,clock,publishing,tracking,inquiries,marketing,
    click:()=>tracking.click(link.id).clickId,
    enable:()=>inquiries.configure(admin,{revision:0,enabled:true,channelId:'general'}),
    advance:days=>time=new Date(Date.parse(time)+days*86400000).toISOString()};
}
test('direct inquiry remains unavailable until an administrator selects an accessible channel',t=>{
  const f=fixture(t);
  assert.equal(f.inquiries.status(site).enabled,false);
  assert.throws(()=>f.inquiries.submit(input,context),{status:503});
  assert.throws(()=>f.inquiries.configure(f.owner,{revision:0,enabled:true,channelId:'ig'}),{status:403});
  f.enable();assert.equal(f.inquiries.status(site).enabled,true);
  assert.throws(()=>f.inquiries.configure(f.admin,{revision:0,enabled:false,channelId:'general'}),{status:409});
});
test('accepted inquiry is encrypted, scoped to the attribution channel, immutable and counted only as server-confirmed',t=>{
  const f=fixture(t);f.enable();
  const clickId=f.click(),result=f.inquiries.submit({...input,clickId},context);
  const rows=f.store.all('socialInbox');assert.equal(rows.length,1);assert.equal(rows[0].channelId,'ig');
  assert.equal(rows[0].inquiryTracking,'verified');
  const raw=f.store.db.prepare('SELECT body FROM documents').all().map(v=>v.body).join('\n');
  assert.ok(!raw.includes(input.email)&&!raw.includes(input.message));
  const ciphertext=f.store.db.prepare('SELECT ciphertext FROM credentials').all().map(v=>v.ciphertext).join('\n');
  assert.ok(!ciphertext.includes(input.email)&&!ciphertext.includes(input.message));
  const inbox=user=>f.marketing.workspace(user,{}, {includeInsights:false,includeNotifications:false}).inbox;
  assert.equal(inbox(f.other).length,0);
  const item=inbox(f.owner)[0];assert.match(item.text,/visitor-private@example.test/);
  assert.throws(()=>f.marketing.saveInbox(f.owner,{revision:1,text:'replaced'},item.id),{status:400});
  f.marketing.saveInbox(f.owner,{revision:1,text:item.text,author:item.author,status:'assigned'},item.id);
  assert.ok(!f.store.get('socialInbox',item.id).text.includes(input.email));
  const stats=f.tracking.workspace(f.owner).totals;
  assert.equal(stats.verifiedEvents.inquiry,1);assert.equal(stats.browserEvents.inquiry,null);
  assert.equal(result.accepted,true);assert.equal(result.deleteToken.length,64);
});
test('duplicate submissions retry the same receipt, reject changed payloads and do not create another outcome',t=>{
  const f=fixture(t);f.enable();const payload={...input,clickId:f.click()};
  const first=f.inquiries.submit(payload,context),second=f.inquiries.submit(payload,context);
  assert.equal(second.receiptId,first.receiptId);assert.equal(second.duplicate,true);
  assert.equal(f.store.count('socialInbox'),1);assert.equal(f.store.count('socialTrackingEvents'),1);
  assert.throws(()=>f.inquiries.submit({...payload,message:'changed'},context),{status:409});
});
test('expired attribution still receives the inquiry in the configured general inbox without inventing a conversion',t=>{
  const f=fixture(t);f.enable();const clickId=f.click();f.advance(31);
  f.inquiries.submit({...input,clickId},context);
  assert.equal(f.store.all('socialInbox')[0].channelId,'general');
  assert.equal(f.store.count('socialTrackingEvents'),0);
});
test('a failed attribution write preserves acceptance and maintenance retries exactly once',t=>{
  const f=fixture(t);f.enable();const real=f.tracking.confirmInquiry;
  f.tracking.confirmInquiry=()=>{throw Error('sink unavailable');};
  f.inquiries.submit({...input,clickId:f.click()},context);
  assert.equal(f.store.all('socialInbox')[0].inquiryTracking,'pending');
  f.tracking.confirmInquiry=real;f.inquiries.maintain();f.inquiries.maintain();
  assert.equal(f.store.all('socialInbox')[0].inquiryTracking,'verified');
  assert.equal(f.store.count('socialTrackingEvents'),1);
});
test('an uncertain receipt is recovered without returning PII and an edited inquiry uses a distinct receipt',t=>{
  const f=fixture(t);f.enable();
  assert.equal(f.inquiries.lookup({requestId:input.requestId},context).found,false);
  const original=f.inquiries.submit(input,context);
  assert.throws(()=>f.inquiries.submit({...input,message:'corrected draft'},context),{status:409});
  const recovered=f.inquiries.lookup({requestId:input.requestId},context);
  assert.equal(recovered.receiptId,original.receiptId);assert.equal(recovered.state,'received');
  assert.ok(!JSON.stringify(recovered).includes(input.email));assert.ok(!JSON.stringify(recovered).includes(input.message));
  const second=f.inquiries.submit({...input,requestId:'22345678-1234-4234-8234-123456789012',message:'corrected draft'},context);
  assert.notEqual(second.receiptId,original.receiptId);assert.equal(f.store.count('socialInbox'),2);
  f.inquiries.remove(original,context);
  assert.equal(f.inquiries.lookup({receiptId:original.receiptId,deleteToken:original.deleteToken},context).state,'deleted');
  assert.ok(f.store.secret('social-inquiry:'+second.receiptId));
});
test('receipt status authenticates the capability and reports expiry instead of acceptance',t=>{
  const f=fixture(t);f.enable();const receipt=f.inquiries.submit(input,context);
  assert.throws(()=>f.inquiries.lookup({receiptId:receipt.receiptId,deleteToken:'0'.repeat(64)},context),{status:403});
  assert.throws(()=>f.inquiries.lookup({requestId:input.requestId},{...context,origin:'https://evil.example'}),{status:403});
  f.advance(91);
  assert.deepEqual(f.inquiries.lookup({receiptId:receipt.receiptId,deleteToken:receipt.deleteToken},context),{ok:true,found:false,accepted:false,state:'unavailable'});
  assert.equal(f.store.secret('social-inquiry:'+receipt.receiptId),null);
});
test('closing new intake preserves receipt recovery and deletion for existing inquiries',t=>{
  const f=fixture(t);f.enable();const receipt=f.inquiries.submit(input,context);
  f.inquiries.configure(f.admin,{revision:1,enabled:false,channelId:'general'});
  assert.equal(f.inquiries.status(site).enabled,false);
  assert.equal(f.inquiries.lookup({requestId:input.requestId},context).state,'received');
  assert.throws(()=>f.inquiries.submit({...input,requestId:'22345678-1234-4234-8234-123456789012'},context),{status:503});
  assert.equal(f.inquiries.remove(receipt,context).deleted,true);
  assert.equal(f.store.secret('social-inquiry:'+receipt.receiptId),null);
});
test('permanently expired attribution stops retrying and repeated transient failures do not rewrite the inbox',t=>{
  const f=fixture(t);f.enable();const actual=f.tracking.confirmInquiry;
  f.tracking.confirmInquiry=()=>{throw Error('temporarily unavailable');};
  const receipt=f.inquiries.submit({...input,clickId:f.click()},context);
  let writes=0;const put=f.store.put.bind(f.store);f.store.put=(...args)=>{if(args[0]==='socialInbox')writes++;return put(...args);};
  f.inquiries.maintain();assert.equal(writes,0);
  f.advance(31);f.tracking.confirmInquiry=actual;f.inquiries.maintain();
  assert.equal(f.store.get('socialInbox',receipt.receiptId).inquiryTracking,'unavailable');assert.equal(writes,1);
  f.inquiries.maintain();assert.equal(writes,1);assert.equal(f.store.count('socialTrackingEvents'),0);
});
test('customer receipt deletion removes private data and retry cannot recreate a deleted inquiry',t=>{
  const f=fixture(t);f.enable();const result=f.inquiries.submit(input,context);
  assert.throws(()=>f.inquiries.remove({...result,deleteToken:'0'.repeat(64)},context),{status:403});
  assert.equal(f.inquiries.remove(result,context).deleted,true);
  assert.equal(f.store.count('socialInbox'),0);
  assert.equal(f.store.secret('social-inquiry:'+result.receiptId),null);
  const retry=f.inquiries.submit(input,context);assert.equal(retry.deleted,true);assert.equal(retry.accepted,false);
  assert.equal(f.store.count('socialInbox'),0);
});
test('staff deletion uses current channel access and retention removes encrypted data',t=>{
  const f=fixture(t);f.enable();const result=f.inquiries.submit({...input,clickId:f.click()},context);
  assert.throws(()=>f.inquiries.removeByStaff(f.other,result.receiptId),{status:403});
  f.advance(91);f.inquiries.maintain();
  assert.equal(f.store.count('socialInbox'),0);
  assert.equal(f.store.secret('social-inquiry:'+result.receiptId),null);
});
test('untrusted origin, omitted consent, honeypot and oversized bodies never become received inquiries',t=>{
  const f=fixture(t);f.enable();
  assert.throws(()=>f.inquiries.submit(input,{...context,origin:'https://evil.example'}),{status:403});
  for(const bad of [{...input,consent:false},{...input,website:'spam'},{...input,message:'x'.repeat(4001)}])
    assert.throws(()=>f.inquiries.submit(bad,context),{status:400});
  assert.equal(f.store.count('socialInbox'),0);
  assert.throws(()=>f.tracking.confirmInquiry('missing'),{status:409});
});
test('HTTP intake enforces CORS, JSON and shutdown after body receipt',async t=>{
  const f=fixture(t);f.enable();const controller=new AbortController();
  let read,release;const waiting=new Promise(resolve=>{release=resolve;});
  const handle=createSocialPublicRoutes({tracking:f.tracking,inquiries:f.inquiries,origin,signal:controller.signal,body:async(_req,limits)=>{read=limits;return waiting;},send:()=>assert.fail('must not send'),clientAddress:()=>context.client});
  const res={setHeader(){},writeHead(){},end(){}};
  const url=new URL('/social-inquiry/submit',origin);
  await assert.rejects(handle({method:'POST',headers:{origin:site,'content-type':'text/plain'}},res,{url}),{status:415});
  const pending=handle({method:'POST',headers:{origin:site,'content-type':'application/json'}},res,{url});
  controller.abort();release(input);await assert.rejects(pending,{status:503});
  assert.deepEqual(read,{maxBytes:16000,maxChars:6000});assert.equal(f.store.count('socialInbox'),0);
});
