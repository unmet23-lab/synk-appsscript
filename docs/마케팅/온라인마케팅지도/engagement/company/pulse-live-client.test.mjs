import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveConnection,freshNotifications,projectRevision,livePaths} from './public/pulse-app/live.mjs';
import {liveView,projectView} from './public/pulse-app/views.mjs';

const flush=()=>new Promise(resolve=>setImmediate(resolve));
class Source extends EventTarget {static instances=[];constructor(url){super();this.url=url;this.closed=false;Source.instances.push(this);}close(){this.closed=true;}}
function environment(){const env=new EventTarget();env.navigator={onLine:true};env.document=new EventTarget();env.document.hidden=false;return env;}

test('existing unread notifications are silent, new unread items notify once across reconnects',()=>{
  const seen=new Set();assert.deepEqual(freshNotifications([{id:'old',unread:true}],seen,true),[]);
  assert.deepEqual(freshNotifications([{id:'new',unread:true},{id:'old',unread:true},{id:'read',unread:false}],seen).map(item=>item.id),['new']);
  assert.deepEqual(freshNotifications([{id:'new',unread:true},{id:'old',unread:true}],seen),[]);
});
test('project revisions and stream endpoints are scoped to the correct role',()=>{
  assert.equal(projectRevision({projects:[{id:'a',revision:9},{id:'b',revision:12}]},'b','staff'),12);
  assert.equal(projectRevision({projectRevision:3},'a','customer'),3);
  assert.equal(projectRevision({projects:[{id:'b',revision:1}]},'a','staff'),undefined);
  assert.equal(livePaths('staff').events,'/api/pulse-events');assert.equal(livePaths('customer').read,'/pulse/api/notifications/read');
});
test('SSE invalidation pulls recipient state, read posts authenticated IDs, and stop removes the stream',async()=>{
  const env=environment(),calls=[],snapshots=[],fresh=[];let response={notifications:[{id:'old',unread:true}],revision:'1'};
  const connection=createLiveConnection({mode:'customer',environment:env,EventSourceImpl:Source,options:()=>({csrf:'synthetic'}),request:async(path,options)=>{calls.push({path,options});return response;},onSnapshot:row=>snapshots.push(row),onFresh:rows=>fresh.push(...rows)});
  await flush();const source=Source.instances.at(-1);assert.equal(source.url,'/pulse/api/events');assert.equal(fresh.length,0);
  response={notifications:[{id:'new',unread:true},{id:'old',unread:true}],revision:'2'};source.dispatchEvent(new Event('changed'));await flush();assert.equal(fresh.length,1);
  await connection.read(['new']);assert.deepEqual(calls.at(-1),{path:'/pulse/api/notifications/read',options:{csrf:'synthetic',body:{ids:['new']}}});
  connection.stop();assert.equal(source.closed,true);assert.ok(snapshots.length>=3);const count=calls.length;env.dispatchEvent(new Event('online'));await flush();assert.equal(calls.length,count);
});
test('revoked access stops events and expires the UI without retrying private state',async()=>{
  let expired=0;const connection=createLiveConnection({mode:'staff',environment:environment(),EventSourceImpl:Source,request:async()=>{throw Object.assign(new Error('expired'),{status:403});},onExpired:()=>expired++});
  await flush();assert.equal(expired,1);assert.equal(Source.instances.at(-1).closed,true);connection.stop();
});
test('late response after account/context stop never reaches the previous UI',async()=>{
  let finish,count=0;const connection=createLiveConnection({mode:'staff',environment:environment(),EventSourceImpl:Source,request:()=>new Promise(resolve=>finish=resolve),onSnapshot:()=>count++});
  connection.stop();finish({notifications:[{id:'private',unread:true}]});await flush();assert.equal(count,0);
});
test('an older in-flight inbox GET cannot undo a successful read acknowledgement',async()=>{
  let slowResolve,requests=0;const snapshots=[];
  const connection=createLiveConnection({mode:'staff',environment:environment(),EventSourceImpl:Source,onSnapshot:row=>snapshots.push(row.unreadCount),request:async(path,options)=>{
    if(options.body)return {notifications:[],unreadCount:0};requests++;
    if(requests===2)return new Promise(resolve=>slowResolve=resolve);
    return {notifications:[],unreadCount:requests===1?1:0};
  }});
  await flush();connection.pull();await flush();await connection.read('all');slowResolve({notifications:[],unreadCount:1});await flush();await flush();connection.stop();
  assert.deepEqual(snapshots,[1,0,0]);
});
test('offline pauses network and returning online resumes both stream and state',async()=>{
  const env=environment();env.navigator.onLine=false;let requests=0;const connection=createLiveConnection({mode:'customer',environment:env,EventSourceImpl:Source,request:async()=>{requests++;return {notifications:[]};}});
  await flush();assert.equal(requests,0);env.navigator.onLine=true;env.dispatchEvent(new Event('online'));await flush();assert.equal(requests,1);assert.equal(Source.instances.at(-1).url,'/pulse/api/events');connection.stop();
});
test('notification text and identifiers are escaped rather than interpreted as markup',()=>{
  const html=liveView({live:{open:true,notifications:[{id:'"><img src=x>',title:'<script>alert(1)</script>',body:'<b>private</b>',unread:true}],unreadCount:1}});
  assert.doesNotMatch(html,/<script>|<b>private|<img src=x>/);assert.match(html,/&lt;script&gt;/);assert.match(html,/aria-label="PULSE 알림함"/);
});
test('an older video draft cannot silently become a support message when a new preview arrives',()=>{
  const state={mode:'customer',tab:'review',versionId:'old',feedbackDraftVersion:'old',feedbackDraftAction:'feedback',project:{id:'p',title:'Test',stage:'review',versions:[{id:'old',kind:'preview',label:'v1'},{id:'new',kind:'preview',label:'v2'}],messages:[],studio:{preferences:{},references:[],concepts:[],scenes:[],comments:[]}}};
  assert.match(projectView(state),/<button type="submit" class="button primary" data-mutate disabled>문의 보내기/);
  state.feedbackDraftAction='support';assert.doesNotMatch(projectView(state),/<button type="submit" class="button primary" data-mutate disabled>문의 보내기/);
});
