import test from 'node:test';
import assert from 'node:assert/strict';
import {startTeacherClient} from '../src/teacher-session.mjs';
import {createTeacherWorkspace} from '../src/teacher-workspace.mjs';

class Node {
  constructor(tag='div'){this.tagName=tag;this.children=[];this.hidden=false;this.disabled=false;this.value='';}
  append(...nodes){this.children.push(...nodes);for(const node of nodes)node.parent=this;}
  replaceChildren(...nodes){this.children=[];this.append(...nodes);}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
  setAttribute(key,value){this[key]=value;}
  scrollIntoView(){this.scrolled=true;}
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
  const page={...dom(),locationHref:'http://localhost/synk-account/teacher.html'};await assert.rejects(startTeacherClient({...page,bridge:{authStatus(){},getEnvironment:async()=>({clientId:'world',authProduct:'world'})}}),/독립 교사/);
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
function classroom(t){const page=dom(),root=new Node(),calls=[],notices=[];let rows=[{id:'a',name:'A',role:'teacher'}],reply=null,hold=null;
  const workspace=createTeacherWorkspace({...page,root,guard(){},notice:(...args)=>notices.push(args),locationHref:'http://localhost/synk-account/teacher.html',pollMs:100000,transport:async(operation,params)=>{calls.push([operation,params]);if(operation==='classes'){if(hold)return hold.promise;if(reply)throw reply;return {mode:'account-linked',classes:rows};}return {mode:'account-linked',classes:[{id:params.classId}]};}});
  t.after(()=>workspace.stop());return {...page,root,workspace,calls,notices,rows:value=>rows=value,error:value=>reply=value,hold:value=>hold=value};
}
test('teacher host contains only selected classroom methods and learner memberships never open teacher UI',async t=>{
  const p=classroom(t);p.rows([{id:'learner',name:'Learner',role:'learner'}]);await p.workspace.load();assert.equal(p.windowObject.SYNKClassroomHost,undefined);
  p.rows([{id:'a',name:'A',role:'teacher'}]);await p.workspace.load();const host=p.windowObject.SYNKClassroomHost;assert.deepEqual(Object.keys(host),['mode','classId','focusWorkspace','request']);assert.equal(host.classId,'a');await host.request('/api/assignments',{title:'test'});assert.equal(p.calls.at(-1)[1].classId,'a');assert.throws(()=>host.request('/api/world/learning'),{code:'FORBIDDEN'});
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
