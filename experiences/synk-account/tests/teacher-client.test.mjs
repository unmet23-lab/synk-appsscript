import test from 'node:test';
import assert from 'node:assert/strict';
import {startTeacherClient} from '../src/teacher-session.mjs';
import {createTeacherWorkspace} from '../src/teacher-workspace.mjs';

class Node {
  constructor(tag='div'){this.tagName=tag;this.children=[];this.hidden=false;this.disabled=false;this.value='';}
  append(...nodes){this.children.push(...nodes);for(const node of nodes)node.parent=this;}
  replaceChildren(...nodes){this.children=[];this.innerHTML='';this.append(...nodes);}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
  setAttribute(key,value){this[key]=value;}
  scrollIntoView(){this.scrolled=true;}
  addEventListener(key,fn){this.listeners??=new Map();this.listeners.set(key,fn);}
  removeEventListener(key){this.listeners?.delete(key);}
}
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const settle=async()=>{for(let i=0;i<6;i++)await new Promise(r=>setImmediate(r));};
function dom(){const ids=new Map(),events=new Map();return {documentObject:{getElementById:id=>{if(!ids.has(id))ids.set(id,new Node());return ids.get(id);},createElement:tag=>new Node(tag)},windowObject:{addEventListener:(key,fn)=>events.set(key,fn),removeEventListener:key=>events.delete(key)},events};}
const signed=(id='teacher',generation=1)=>({configured:true,signedIn:true,status:'signed-in',sessionGeneration:generation,account:{synk_user_id:id}});
const signedOut={configured:true,signedIn:false,status:'signed-out'};
async function session(t,overrides={}){
  const page=dom(),scopes=[];let state=signed(),listener;
  const bridge={getEnvironment:async()=>({clientId:'teacher',authProduct:'world'}),authStatus:async()=>state,onAuthChanged:fn=>{listener=fn;return()=>{listener=null;};},accountRequest:async()=>({ok:true}),authSignIn:async()=>state,authCancelSignIn:async()=>signedOut,authSignOut:async()=>{state=signedOut;listener(state);return {ok:true,serverRevoked:false};},...overrides};
  const emit=next=>{state=next;listener?.(next);};
  const start=startTeacherClient({...page,bridge,locationHref:'http://localhost/synk-account/teacher.html',workspaceFactory:options=>{const scope={...options,stopped:false,load:async()=>{},stop(){this.stopped=true;}};scopes.push(scope);return scope;}});
  const result={...page,bridge,scopes,emit,start,get:id=>page.documentObject.getElementById(id)};
  t.after(async()=>{(await start).stop();});return result;
}

test('teacher client rejects a WORLD bridge and handles ordinary browser without account access',async()=>{
  const page={...dom(),locationHref:'http://localhost/synk-account/teacher.html'};await assert.rejects(startTeacherClient({...page,bridge:{authStatus(){},getEnvironment:async()=>({clientId:'world',authProduct:'world'})}}),/교사 로그인/);
  await startTeacherClient({...page,bridge:null});assert.equal(page.documentObject.getElementById('setup').hidden,false);
});
test('new auth event wins over a delayed initial snapshot',async t=>{
  const pending=deferred(),p=await session(t,{authStatus:()=>pending.promise});await settle();p.emit(signed('new',2));await settle();pending.resolve(signed('old',1));await p.start;
  assert.equal(p.scopes.length,1);assert.doesNotThrow(p.scopes[0].guard);
});
test('same-session refresh preserves class renderer; changed account invalidates old transport',async t=>{
  const p=await session(t);await p.start;const old=p.scopes[0];p.emit({configured:true,status:'restoring',signedIn:false,sessionGeneration:1});await settle();assert.equal(old.stopped,false);
  p.emit(signed());await settle();assert.equal(p.scopes.length,1);p.emit(signed('other',2));await settle();assert.equal(old.stopped,true);assert.throws(old.guard,{code:'ACCOUNT_CHANGED'});assert.equal(p.scopes.length,2);
});

test('temporary same-session verification failure preserves selection and a working logout control',async t=>{
 const p=await session(t);await p.start;const scope=p.scopes[0];
 p.emit({...signed(),signedIn:false,status:'restoring',canSignOut:true,error:{code:'ACCOUNT_VERIFY_UNAVAILABLE',message:'잠시 연결을 확인하고 있어요.',retryable:true}});await settle();
 assert.equal(scope.stopped,false);assert.equal(p.scopes.length,1);assert.equal(p.get('connect').hidden,true);assert.equal(p.get('sign-out').hidden,false);
 p.emit(signed());await settle();assert.equal(p.scopes.length,1);
 await p.get('sign-out').onclick();assert.equal(scope.stopped,true);
});
test('logout closes scoped host before IPC and keeps incomplete server revocation visible despite auth event',async t=>{
  const p=await session(t);await p.start;const old=p.scopes[0];await p.get('sign-out').onclick();assert.equal(old.stopped,true);assert.throws(old.guard,{code:'ACCOUNT_CHANGED'});assert.equal(p.scopes.length,1);assert.match(p.get('notice').textContent,/서버의 로그인 종료/);assert.match(p.get('notice').className,/error/);
});
test('failed logout cannot reopen classroom on refresh and offers a retry',async t=>{
  const p=await session(t,{authSignOut:async()=>{throw Error('IPC unavailable');}});await p.start;await p.get('sign-out').onclick();p.emit(signed());await settle();assert.equal(p.scopes.length,1);assert.equal(p.scopes[0].stopped,true);assert.equal(p.get('sign-out').hidden,false);assert.equal(p.get('connect').hidden,true);
});
test('late login response cannot restore a replaced account or a stopped page',async t=>{
  const pending=deferred(),p=await session(t,{authSignIn:()=>pending.promise});await p.start;const login=p.get('connect').onclick();p.emit(signed('replacement',2));await settle();pending.resolve(signed('old',1));await login;assert.equal(p.scopes.length,2);assert.equal(p.scopes[1].stopped,false);
  p.events.get('pagehide')();p.emit(signed('after-close',3));await settle();assert.equal(p.scopes.length,2);assert.equal(p.scopes[1].stopped,true);
});
function classroom(t){const page=dom(),root=new Node(),calls=[],notices=[];let rows=[{id:'a',name:'A',role:'teacher'}],reply=null,overviewReply=null,learnerRows={},snapshotRows={},workspaceHold=null,hold=null;
  const workspace=createTeacherWorkspace({...page,root,guard(){},notice:(...args)=>notices.push(args),locationHref:'http://localhost/synk-account/teacher.html',pollMs:100000,transport:async(operation,params)=>{calls.push([operation,params]);if(operation==='classes'){if(hold)return hold.promise;if(reply)throw reply;return {mode:'account-linked',classes:rows};}if(operation==='teacherOverview'){if(overviewReply)throw overviewReply;return {mode:'account-linked',classes:rows.map(row=>({...row,learners:learnerRows[row.id]||[]})),care:[],assignments:[]};}if(operation==='workspace'&&workspaceHold){const pending=workspaceHold;workspaceHold=null;return pending.promise;}return {mode:'account-linked',classes:[{id:params.classId,learners:snapshotRows[params.classId]||[]}]};}});
  t.after(()=>workspace.stop());return {...page,root,workspace,calls,notices,rows:value=>rows=value,learners:value=>learnerRows=value,snapshots:value=>snapshotRows=value,workspaceHold:value=>workspaceHold=value,error:value=>reply=value,overviewError:value=>overviewReply=value,hold:value=>hold=value};
}

const privacyLearner=(id,revision=2,enabled=true)=>({id,name:id,accountConnected:true,sharing:{revision,enabled},skills:[]});
const selectOverview=async(page,id)=>{page.root.children[2].listeners.get('click')({target:{closest:()=>({disabled:false,dataset:{overviewClassId:'a',overviewStudent:id}})}});await settle();};
test('known withdrawal replaces only the selected student scope and rejects its pending older snapshot',async t=>{
  const page=classroom(t),before=privacyLearner('student-a'),after=privacyLearner('student-a',3,false);page.learners({a:[before]});page.snapshots({a:[before]});await page.workspace.load();await selectOverview(page,'student-a');
  const old=page.windowObject.SYNKClassroomHost,pending=deferred();page.workspaceHold(pending);const response=old.request('/api/workspace');
  page.learners({a:[after]});page.snapshots({a:[after]});await page.workspace.load();assert.notEqual(page.windowObject.SYNKClassroomHost,old);assert.deepEqual(page.windowObject.SYNKClassroomSelection,{classId:'a',learnerId:'student-a'});
  pending.resolve({mode:'account-linked',classes:[{id:'a',learners:[before]}]});await assert.rejects(response,{code:'ACCOUNT_CHANGED'});
});
test('another student withdrawal preserves the selected scope but rejects stale rows in a held class response',async t=>{
  const page=classroom(t),a=privacyLearner('student-a'),b=privacyLearner('student-b'),revoked=privacyLearner('student-a',3,false);page.learners({a:[a,b]});page.snapshots({a:[a,b]});await page.workspace.load();await selectOverview(page,'student-b');
  const same=page.windowObject.SYNKClassroomHost,pending=deferred();page.workspaceHold(pending);const response=same.request('/api/workspace');
  page.learners({a:[revoked,b]});page.snapshots({a:[revoked,b]});await page.workspace.load();assert.equal(page.windowObject.SYNKClassroomHost,same);assert.equal(page.windowObject.SYNKClassroomSelection.learnerId,'student-b');
  pending.resolve({mode:'account-linked',classes:[{id:'a',learners:[a,b]}]});await assert.rejects(response,{code:'CLASSROOM_SNAPSHOT_CHANGED'});assert.equal((await same.request('/api/workspace')).classes[0].learners[0].sharing.revision,3);
});
// 쓰던 것이 있을 때 고른 학생의 공유가 바뀜: 교사 화면(iframe)이 그 자리에서 거르면 화면을 다시 만들지 않아 과제 첨삭 초안이 남는다.
const frameOf=page=>page.root.children[3].children[0];
const openFrame=(page,view)=>{let prompts=0;page.windowObject.confirm=()=>{prompts++;return true;};frameOf(page).contentWindow={postMessage(){},SYNKTeacherView:view};return {prompts:()=>prompts};};
test('selected student withdrawal with unsaved work is fenced inside the open frame, without asking and without discarding the review',async t=>{
  const page=classroom(t),before=privacyLearner('student-a'),other=privacyLearner('student-b'),after=privacyLearner('student-a',3,false);page.learners({a:[before,other]});page.snapshots({a:[before,other]});await page.workspace.load();await selectOverview(page,'student-a');
  const host=page.windowObject.SYNKClassroomHost,frame=frameOf(page),applied=[],view=openFrame(page,{hasDraft:()=>true,applySharing:scope=>{applied.push(scope);return true;}});
  const pending=deferred();page.workspaceHold(pending);const stale=host.request('/api/workspace');
  page.learners({a:[after,other]});page.snapshots({a:[after,other]});await page.workspace.load();
  assert.equal(page.windowObject.SYNKClassroomHost,host);assert.equal(frameOf(page),frame);assert.equal(view.prompts(),0);assert.equal(page.notices.length,0);
  assert.equal(applied.length,1);assert.equal(applied[0].classId,'a');assert.deepEqual(applied[0].learners.map(row=>[row.id,row.revision,row.enabled,row.connected,row.revoked]),[['student-a',3,false,true,false],['student-b',2,true,true,false]]);
  assert.deepEqual(page.windowObject.SYNKClassroomSelection,{classId:'a',learnerId:'student-a'});
  // 걸러진 뒤에도 바뀌기 전 판의 늦은 응답은 그 학생의 기록을 되살리지 못한다.
  pending.resolve({mode:'account-linked',classes:[{id:'a',learners:[before,other]}]});await assert.rejects(stale,{code:'CLASSROOM_SNAPSHOT_CHANGED'});
  assert.equal((await host.request('/api/workspace')).classes[0].learners[0].sharing.enabled,false);
});
test('a selected student who leaves the class is fenced in place and the selection is cleared',async t=>{
  const page=classroom(t),a=privacyLearner('student-a'),b=privacyLearner('student-b');page.learners({a:[a,b]});page.snapshots({a:[a,b]});await page.workspace.load();await selectOverview(page,'student-a');
  const host=page.windowObject.SYNKClassroomHost,frame=frameOf(page),applied=[];openFrame(page,{hasDraft:()=>true,applySharing:scope=>{applied.push(scope);return true;}});
  page.learners({a:[b]});page.snapshots({a:[b]});await page.workspace.load();
  assert.equal(page.windowObject.SYNKClassroomHost,host);assert.equal(frameOf(page),frame);assert.deepEqual(applied.at(-1).learners.map(row=>row.id),['student-b']);
  assert.deepEqual(page.windowObject.SYNKClassroomSelection,{classId:'a',learnerId:null});assert.doesNotMatch(page.root.children[2].innerHTML,/student-a/);
});
for(const [name,view] of [['an older frame without in-place fencing',{hasDraft:()=>true}],['a frame that declines the scope',{hasDraft:()=>true,applySharing:()=>false}],['a frame that fails while fencing',{hasDraft:()=>true,applySharing:()=>{throw Error('broken frame');}}]])
  test(`${name} is rebuilt at once on withdrawal and the closed unsaved work is announced`,async t=>{
    const page=classroom(t),before=privacyLearner('student-a'),after=privacyLearner('student-a',3,false);page.learners({a:[before]});page.snapshots({a:[before]});await page.workspace.load();await selectOverview(page,'student-a');
    const old=page.windowObject.SYNKClassroomHost,frame=frameOf(page),opened=openFrame(page,view);
    page.learners({a:[after]});page.snapshots({a:[after]});await page.workspace.load();
    assert.notEqual(page.windowObject.SYNKClassroomHost,old);assert.notEqual(frameOf(page),frame);assert.equal(opened.prompts(),0);assert.throws(()=>old.request('/api/workspace'),{code:'ACCOUNT_CHANGED'});
    assert.match(page.notices.at(-1)[0],/공유 상태가 바뀌어 수업 화면을 새로 열었어요\. 저장하지 않은 내용은 닫혔어요/);assert.equal(page.notices.at(-1)[1],true);
  });
test('incomplete sharing metadata never asks the frame to keep a withdrawn scope',async t=>{
  const page=classroom(t),before=privacyLearner('student-a'),after=privacyLearner('student-a',3,false),unknown={id:'student-b',name:'student-b',sharing:{revision:1,enabled:true},skills:[]};
  page.learners({a:[before,unknown]});page.snapshots({a:[before,unknown]});await page.workspace.load();await selectOverview(page,'student-a');
  const old=page.windowObject.SYNKClassroomHost,applied=[];openFrame(page,{hasDraft:()=>false,applySharing:scope=>{applied.push(scope);return true;}});
  page.learners({a:[after,unknown]});page.snapshots({a:[after,unknown]});await page.workspace.load();
  assert.equal(applied.length,0);assert.notEqual(page.windowObject.SYNKClassroomHost,old);assert.equal(page.notices.length,0);
});

test('two real sixteen-member classes open together and selecting one student preserves a single class-scoped detail',async t=>{
  const page=classroom(t),rows=[{id:'a',name:'오전반',role:'teacher'},{id:'b',name:'오후반',role:'teacher'}];page.rows(rows);
  page.learners(Object.fromEntries(rows.map(row=>[row.id,Array.from({length:16},(_,index)=>({id:row.id+'-'+index,name:'학생 '+index,accountConnected:true,sharing:{enabled:true,revision:1},skills:[]}))])));
  await page.workspace.load();assert.equal(page.windowObject.SYNKClassroomHost,undefined);const overview=page.root.children[2];assert.equal([...overview.innerHTML.matchAll(/data-overview-student=/g)].length,32);assert.equal([...overview.innerHTML.matchAll(/class="overview-class"/g)].length,2);
  overview.listeners.get('click')({target:{closest:()=>({disabled:false,dataset:{overviewClassId:'b',overviewStudent:'b-7'}})}});await settle();
  assert.equal(page.windowObject.SYNKClassroomHost.classId,'b');assert.deepEqual(page.windowObject.SYNKClassroomSelection,{classId:'b',learnerId:'b-7'});assert.equal(page.root.children[3].children.length,1);assert.equal(page.calls.at(-1)[1].classId,'b');
});
test('membership-confirmed revocation removes old class and frame before a later overview network failure',async t=>{
  const page=classroom(t);page.learners({a:[{id:'a-private',name:'철회되는 학생',accountConnected:true,sharing:{enabled:true,revision:1},skills:[]}]});await page.workspace.load();const old=page.windowObject.SYNKClassroomHost;
  page.rows([{id:'b',name:'다른 현재 반',role:'teacher'}]);page.overviewError(Object.assign(Error('offline'),{code:'NETWORK_ERROR'}));await assert.rejects(page.workspace.load());
  assert.equal(page.windowObject.SYNKClassroomHost,undefined);assert.throws(()=>old.request('/api/workspace'),{code:'ACCOUNT_CHANGED'});assert.doesNotMatch(page.root.children[2].innerHTML||'',/철회되는 학생/);assert.match(page.root.children[2].children[0].textContent,/담당 1개 반/);
});
test('teacher host contains only selected classroom methods and learner memberships never open teacher UI',async t=>{
  const p=classroom(t);p.rows([{id:'learner',name:'Learner',role:'learner'}]);await p.workspace.load();assert.equal(p.windowObject.SYNKClassroomHost,undefined);
  p.rows([{id:'a',name:'A',role:'teacher'}]);await p.workspace.load();const host=p.windowObject.SYNKClassroomHost;assert.deepEqual(Object.keys(host),['mode','classId','focusWorkspace','request']);assert.equal(host.classId,'a');await host.request('/api/assignments',{title:'test'});assert.equal(p.calls.find(row=>row[0]==='assignments')[1].classId,'a');assert.throws(()=>host.request('/api/world/learning'),{code:'FORBIDDEN'});
});
test('membership removal and malformed class response invalidate captured teacher host',async t=>{
  const p=classroom(t);await p.workspace.load();const old=p.windowObject.SYNKClassroomHost;p.rows([]);await p.workspace.load();assert.equal(p.windowObject.SYNKClassroomHost,undefined);assert.throws(()=>old.request('/api/workspace'),{code:'ACCOUNT_CHANGED'});
  p.rows([{id:'a',name:'A',role:'teacher'}]);await p.workspace.load();const second=p.windowObject.SYNKClassroomHost;p.rows([{id:42,name:'invalid',role:'teacher'}]);await assert.rejects(p.workspace.load(),{code:'INVALID_CLASSROOM_RESPONSE'});assert.equal(p.windowObject.SYNKClassroomHost,undefined);assert.throws(()=>second.request('/api/workspace'),{code:'ACCOUNT_CHANGED'});
});
test('network loss blocks requests until successful membership recheck, and forbidden closes frame',async t=>{
  const p=classroom(t);await p.workspace.load();const host=p.windowObject.SYNKClassroomHost;p.error(Object.assign(Error('offline'),{code:'NETWORK_ERROR'}));await assert.rejects(p.workspace.load());assert.throws(()=>host.request('/api/workspace'),{code:'NETWORK_ERROR'});
  p.error(null);await p.workspace.load();assert.equal(p.windowObject.SYNKClassroomHost,host);await host.request('/api/workspace');assert.match(p.root.children[1].textContent,/학생이 공유한 학습 기록/);assert.match(p.notices.at(-1)[0],/수업 연결이 복구/);assert.notEqual(p.notices.at(-1)[1],true);p.error(Object.assign(Error('forbidden'),{status:403}));await assert.rejects(p.workspace.load());assert.equal(p.windowObject.SYNKClassroomHost,undefined);
});
test('late membership response after page shutdown cannot attach a frame',async t=>{
  const p=classroom(t),pending=deferred();p.hold(pending);const load=p.workspace.load();p.workspace.stop();pending.resolve({mode:'account-linked',classes:[{id:'a',name:'A',role:'teacher'}]});await assert.rejects(load,{code:'ACCOUNT_CHANGED'});assert.equal(p.windowObject.SYNKClassroomHost,undefined);assert.equal(p.root.hidden,true);
});
