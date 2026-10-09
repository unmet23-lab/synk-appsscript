import test from 'node:test';
import assert from 'node:assert/strict';
import {createTownSharingControl,validateTownMembership} from '../src/town-sharing.mjs';
import {createClassroomTownHost} from '../src/classroom-town-host.mjs';

const member = (enabled=false,revision=1) => ({mode:'account-linked',town:{id:'town-a',classId:'class-a',name:'합성 봄반 마을',kind:'academy'},membership:{learnerId:'student-a',revision:1},townSharing:{enabled,revision,since:null,blockedByLearningSharing:false}});
class Element {
  constructor(tag='section'){this.tagName=tag;this.children=[];this.dataset={};this.attributes={};this.textContent='';this.checked=false;this.disabled=false;this.hidden=false;}
  append(...values){this.children.push(...values);}
  replaceChildren(...values){this.children=[...values];}
  setAttribute(key,value){this.attributes[key]=String(value);}
}
const documentObject={createElement:tag=>new Element(tag)};
const nodes = root => [root,...root.children.flatMap(nodes)];
const control = options => {
  const root=new Element(), notices=[],closed=[];
  const view=createTownSharingControl({root,documentObject,client:options.client,classId:'class-a',learnerId:'student-a',guard:options.guard||(()=>{}),closeGame:()=>closed.push(true),notice:(...args)=>notices.push(args)});
  return {view,root,input:()=>nodes(root).find(n=>Object.hasOwn(n.dataset,'townSharing')),status:()=>nodes(root).find(n=>Object.hasOwn(n.dataset,'townSharingStatus')),notices,closed};
};

test('an existing language consent does not enable Town activity visibility; the toggle persists its own revision',async()=>{
  let value=member(),calls=[];
  const page=control({client:{townMembership:async()=>value,townSharing:async body=>{calls.push(body);value=member(body.enabled,body.revision+1);}}});
  await page.view.load(); assert.equal(page.input().checked,false); assert.match(page.status().textContent,/공유 꺼짐/);
  page.input().checked=true; await page.input().onchange(); assert.deepEqual(calls,[{enabled:true,revision:1}]); assert.equal(page.input().checked,true);
  page.input().checked=false; await page.input().onchange(); assert.deepEqual(calls.at(-1),{enabled:false,revision:2}); assert.equal(page.closed.length,2);
});

test('master sharing off blocks an optional grant, and another learners membership is rejected',async()=>{
  const value=member();value.townSharing.blockedByLearningSharing=true;
  const page=control({client:{townMembership:async()=>value}});await page.view.load();assert.equal(page.input().disabled,true);assert.match(page.status().textContent,/먼저 켜면/);
  assert.throws(()=>validateTownMembership({...member(),membership:{learnerId:'student-b'}},{classId:'class-a',learnerId:'student-a'}),{code:'INVALID_RESPONSE'});
  assert.throws(()=>validateTownMembership(member(),{classId:'other-class',learnerId:'student-a'}),{code:'INVALID_RESPONSE'});
});

test('a failed change response never displays an unconfirmed consent; refresh recovers canonical state',async()=>{
  let value=member();
  const page=control({client:{townMembership:async()=>value,townSharing:async()=>{value=member(true,2);throw new TypeError('network interrupted after commit');}}});
  await page.view.load();page.input().checked=true;await page.input().onchange();
  assert.equal(page.input().checked,false);assert.equal(page.input().disabled,true);assert.match(page.status().textContent,/確認|확인하지 못/);
  await page.view.load();assert.equal(page.input().checked,true);assert.equal(page.input().disabled,false);
});

test('a stopped class cannot restore a late membership or announce a late sharing change',async()=>{
  let release;const page=control({client:{townMembership:()=>new Promise(r=>release=r)}});
  const pending=page.view.load();page.view.stop();release(member(true));await pending;
  assert.equal(page.root.children.length,0);assert.equal(page.notices.length,0);
});

test('an actual Town opening reports one opt-in visit, while server commands remain separate',async()=>{
  const activity=[],commands=[];const host=createClassroomTownHost({classId:'class-a',learnerId:'student-a',guard(){},makeId:()=> 'open-1',client:{townRead:async()=>({state:{revision:0}}),townMembership:async()=>member(true,4),townActivity:async b=>{activity.push(b);return {ok:true};},townCommand:async b=>{commands.push(b);return {state:{revision:1}};}}});
  await Promise.all([host.read(),host.read()]);await host.read();await host.command({type:'NEXT'});
  assert.deepEqual(activity,[{eventId:'open-1',revision:4,townId:'town-a',kind:'visit',activity:'town-opened'}]);assert.equal(commands.length,1);
});

test('Town summary outage preserves play and retries exactly the original idempotency key',async()=>{
  const sent=[];const host=createClassroomTownHost({classId:'class-a',learnerId:'student-a',guard(){},makeId:()=> 'open-retry',client:{townRead:async()=>({state:{revision:0}}),townMembership:async()=>member(true,2),townActivity:async b=>{sent.push(b);if(sent.length===1)throw Object.assign(new TypeError('offline'),{code:'NETWORK_ERROR'});}}});
  assert.equal((await host.read()).state.revision,0);await host.read();assert.equal(sent.length,2);assert.deepEqual(sent[0],sent[1]);
});

test('Town nonsharing and a stale account never send a visit',async()=>{
  let sent=0,active=true,release;
  const client={townRead:async()=>({state:{revision:0}}),townMembership:async()=>member(),townActivity:async()=>{sent++;}};
  const host=createClassroomTownHost({classId:'class-a',learnerId:'student-a',guard(){if(!active)throw Object.assign(Error('changed'),{code:'ACCOUNT_CHANGED'});},client});
  await host.read();assert.equal(sent,0);
  client.townMembership=()=>new Promise(r=>release=r);const pending=host.read();await new Promise(r=>setImmediate(r));active=false;release(member(true,3));await assert.rejects(pending,{code:'ACCOUNT_CHANGED'});assert.equal(sent,0);
});

test('a forged or mismatched membership never emits activity or restores a class Town host',async()=>{
  let sent=0;const value=member(true);value.town.classId='foreign-class';
  const host=createClassroomTownHost({classId:'class-a',learnerId:'student-a',guard(){},client:{townRead:async()=>({state:{revision:0}}),townMembership:async()=>value,townActivity:async()=>{sent++;}}});
  await assert.rejects(host.read(),{code:'INVALID_RESPONSE'});assert.equal(sent,0);
});
