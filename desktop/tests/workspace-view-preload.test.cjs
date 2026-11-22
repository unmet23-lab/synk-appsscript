'use strict';
// 검정 구 4단계 구현 설계 3.3: 플랫폼 창 안의 Workspace 뷰 preload. 회사 출처의 최상위 / 문서에만 window.synkDesktop의 일곱 이름을 준다.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {installWorkspaceViewPreload,CHANNEL,TEACHER_CHANNEL}=require('../src/workspace-view-preload.cjs');
const {NATIVE_CHANNEL,TEACHER_CHANNEL:MAIN_TEACHER_CHANNEL,WORKSPACE_VIEW_PRELOAD}=require('../src/workspace-app.cjs');

// 회사 화면이 부르는 일곱 이름과 「내 수업」의 teacher 하나(4단계 구현 설계 14.3)
const NAMES=['accountRequest','authCancelSignIn','authSignIn','authSignOut','authStatus','companyRequest','onAuthChanged','teacher'];
const TEACHER_NAMES=['accountRequest','authCancelSignIn','authSignIn','authSignOut','authStatus','getEnvironment','onAuthChanged'];
const OPERATIONS=['status','challenge','exchange','renew','logout'];
function pageAt(href,{framed=false}={}){const win={location:{href}};win.top=framed?{location:{href:'https://workspace.synk.im/'}}:win;return win;}
function rendererIpc(){
  const invoked=[],listeners=new Map();
  return {invoked,listeners,
    invoke(channel,...args){invoked.push([channel,...args]);return Promise.resolve({ok:true,channel});},
    on(channel,listener){if(!listeners.has(channel))listeners.set(channel,new Set());listeners.get(channel).add(listener);},
    removeListener(channel,listener){listeners.get(channel)?.delete(listener);},
    emit(channel,value){for(const listener of [...(listeners.get(channel)||[])])listener({sender:'main'},value);}};
}
function install(href,options){const ipc=rendererIpc(),exposed=[];const api=installWorkspaceViewPreload({ipcRenderer:ipc,contextBridge:{exposeInMainWorld:(name,value)=>exposed.push([name,value])},window:pageAt(href,options)});return {api,ipc,exposed};}
const refused={ok:false,error:{code:'INVALID_REQUEST',message:'회사 요청을 처리하지 못했어요. 다시 해 주세요.'}};

test('the preload is the one main loads into the view and uses main\'s channel names',()=>{
  assert.equal(WORKSPACE_VIEW_PRELOAD,path.join(__dirname,'..','src','workspace-view-preload.cjs'));
  assert.deepEqual(CHANNEL,NATIVE_CHANNEL);assert.equal(Object.isFrozen(CHANNEL),true);
  assert.deepEqual(TEACHER_CHANNEL,MAIN_TEACHER_CHANNEL);assert.equal(Object.isFrozen(TEACHER_CHANNEL),true);
});
test('the company top document at / exposes exactly the seven names and teacher, frozen',()=>{
  for(const href of ['https://workspace.synk.im/','https://workspace.synk.im/?tab=messenger','https://workspace.synk.im/?tab=social&section=inbox#x']){
    const {api,exposed}=install(href);
    assert.equal(exposed.length,1,href);assert.equal(exposed[0][0],'synkDesktop');assert.equal(exposed[0][1],api);
    assert.deepEqual(Object.keys(api).sort(),NAMES);assert.equal(Object.isFrozen(api),true);
    for(const name of NAMES.filter(name=>name!=='teacher'))assert.equal(typeof api[name],'function',name);
    assert.deepEqual(Object.keys(api.teacher).sort(),TEACHER_NAMES);assert.equal(Object.isFrozen(api.teacher),true);
    for(const name of TEACHER_NAMES)assert.equal(typeof api.teacher[name],'function','teacher.'+name);
  }
});
test('teacher (내 수업) sends classroom only with plain object params; its auth calls send their own channel with no page arguments',async()=>{
  const {api,ipc}=install('https://workspace.synk.im/?tab=teaching');const t=api.teacher;
  await t.accountRequest('classroom',{operation:'classes'});assert.deepEqual(ipc.invoked.at(-1),[TEACHER_CHANNEL.account,'classroom',{operation:'classes'}]);
  await t.accountRequest('classroom');assert.deepEqual(ipc.invoked.at(-1),[TEACHER_CHANNEL.account,'classroom',{}],'no params is an empty object');
  const sent=ipc.invoked.length;
  for(const operation of ['load','CLASSROOM','revokeAll',undefined,null,{toString:()=>'classroom'}])assert.equal((await t.accountRequest(operation,{})).error.code,'INVALID_REQUEST',String(operation));
  for(const params of [[],null,'x',5,()=>{}])assert.equal((await t.accountRequest('classroom',params)).error.code,'INVALID_REQUEST',String(params));
  assert.equal(ipc.invoked.length,sent);
  await t.getEnvironment('x');await t.authStatus('x');await t.authSignIn('x');await t.authCancelSignIn('x');await t.authSignOut('x');
  assert.deepEqual(ipc.invoked.slice(-5),[[TEACHER_CHANNEL.environment],[TEACHER_CHANNEL.status],[TEACHER_CHANNEL.signIn],[TEACHER_CHANNEL.cancel],[TEACHER_CHANNEL.signOut]]);
  for(const bad of [undefined,null,'f',{}])assert.throws(()=>t.onAuthChanged(bad),TypeError);
  const seen=[];const off=t.onAuthChanged(value=>seen.push(value));
  ipc.emit(TEACHER_CHANNEL.changed,{signedIn:true});ipc.emit(CHANNEL.changed,{signedIn:false});assert.deepEqual(seen,[{signedIn:true}],'only the teacher notices');
  off();ipc.emit(TEACHER_CHANNEL.changed,{signedIn:false});assert.deepEqual(seen,[{signedIn:true}]);assert.equal(ipc.listeners.get(TEACHER_CHANNEL.changed).size,0);
});
test('a frame, another path, another origin, http or user info exposes nothing',()=>{
  const pages=[['https://workspace.synk.im/?tab=messenger',{framed:true}],['https://workspace.synk.im/messenger/'],['https://workspace.synk.im/messenger/?tab=messenger'],['https://workspace.synk.im/entry/'],
    ['https://workspace.synk.im/pulse-app/'],['https://evil.invalid/'],['https://workspace.synk.im.evil/'],['http://workspace.synk.im/'],['https://user:pw@workspace.synk.im/'],['https://workspace.synk.im:8443/'],
    ['about:blank'],['file:///C:/workspace/'],['not a url']];
  for(const [href,options] of pages){const {api,exposed}=install(href,options);assert.equal(api,null,href);assert.deepEqual(exposed,[],href);}
  const throwing={get top(){throw Error('합성');},location:{href:'https://workspace.synk.im/'}};const exposed=[];
  assert.equal(installWorkspaceViewPreload({ipcRenderer:rendererIpc(),contextBridge:{exposeInMainWorld:(...args)=>exposed.push(args)},window:throwing}),null);assert.deepEqual(exposed,[]);
  const page=pageAt('https://workspace.synk.im/');
  assert.equal(installWorkspaceViewPreload({contextBridge:{exposeInMainWorld(){}},window:page}),null);assert.equal(installWorkspaceViewPreload({ipcRenderer:rendererIpc(),window:page}),null);
  assert.equal(installWorkspaceViewPreload({ipcRenderer:rendererIpc(),contextBridge:{exposeInMainWorld(){}}}),null);assert.equal(installWorkspaceViewPreload(),null);
  assert.equal(installWorkspaceViewPreload({ipcRenderer:rendererIpc(),contextBridge:{exposeInMainWorld(){throw Error('이미 있음');}},window:page}),null);
});
test('companyRequest sends only the five operations with plain object params; anything else answers an error without sending',async()=>{
  const {api,ipc}=install('https://workspace.synk.im/?tab=messenger');
  for(const operation of OPERATIONS){assert.deepEqual(await api.companyRequest(operation,{nonce:'x'}),{ok:true,channel:CHANNEL.company});assert.deepEqual(ipc.invoked.at(-1),[CHANNEL.company,operation,{nonce:'x'}]);}
  await api.companyRequest('status');assert.deepEqual(ipc.invoked.at(-1),[CHANNEL.company,'status',{}],'no params is an empty object');
  const sent=ipc.invoked.length;
  for(const operation of ['link','load','STATUS','__proto__','constructor','',undefined,null,5,['status'],{toString:()=>'status'}])assert.deepEqual(await api.companyRequest(operation,{}),refused,String(operation));
  for(const params of [[],['x'],null,'x',5,true,()=>{}])assert.deepEqual(await api.companyRequest('status',params),refused,JSON.stringify(params)??String(params));
  assert.equal(ipc.invoked.length,sent);
});
test('accountRequest sends load only; the auth calls send their own channel with no page arguments',async()=>{
  const {api,ipc}=install('https://workspace.synk.im/');
  await api.accountRequest('load',{extra:'x'});assert.deepEqual(ipc.invoked.at(-1),[CHANNEL.account,'load']);
  const sent=ipc.invoked.length;
  for(const operation of ['renew','logout','status','LOAD',undefined,{op:'load'}])assert.deepEqual(await api.accountRequest(operation),{ok:false,code:'INVALID_REQUEST'},String(operation));
  assert.equal(ipc.invoked.length,sent);
  await api.authStatus('x');await api.authSignIn('x');await api.authCancelSignIn('x');await api.authSignOut('x');
  assert.deepEqual(ipc.invoked.slice(-4),[[CHANNEL.status],[CHANNEL.signIn],[CHANNEL.cancel],[CHANNEL.signOut]]);
});
test('onAuthChanged needs a function, passes only the value and returns its own unsubscribe',()=>{
  const {api,ipc}=install('https://workspace.synk.im/?tab=messenger');
  for(const bad of [undefined,null,'f',{},[]])assert.throws(()=>api.onAuthChanged(bad),TypeError);
  assert.equal(ipc.listeners.get(CHANNEL.changed)?.size??0,0);
  const seen=[],other=[];const off=api.onAuthChanged(value=>seen.push(value));const offOther=api.onAuthChanged(value=>other.push(value));
  assert.equal(typeof off,'function');ipc.emit(CHANNEL.changed,{signedIn:true});assert.deepEqual(seen,[{signedIn:true}]);assert.deepEqual(other,[{signedIn:true}]);
  off();ipc.emit(CHANNEL.changed,{signedIn:false});assert.deepEqual(seen,[{signedIn:true}]);assert.deepEqual(other,[{signedIn:true},{signedIn:false}]);
  offOther();assert.equal(ipc.listeners.get(CHANNEL.changed).size,0);
});
test('as a real preload it installs itself from electron, and does nothing without electron',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../src/workspace-view-preload.cjs'),'utf8');
  // 샌드박스 preload에는 URL이 있고 module은 없다
  const run=(electron,href)=>{const exposed=[],ipc=rendererIpc();
    vm.runInNewContext(source,{require:name=>{assert.equal(name,'electron');if(electron instanceof Error)throw electron;return electron==='ipc'?{ipcRenderer:ipc,contextBridge:{exposeInMainWorld:(...args)=>exposed.push(args)}}:electron;},window:pageAt(href),URL});
    return {exposed,ipc};};
  const {exposed,ipc}=run('ipc','https://workspace.synk.im/?tab=messenger');
  assert.equal(exposed.length,1);assert.equal(exposed[0][0],'synkDesktop');assert.deepEqual(Object.keys(exposed[0][1]).sort(),NAMES);
  void exposed[0][1].authStatus();assert.deepEqual(ipc.invoked,[[CHANNEL.status]]);
  assert.deepEqual(run('ipc','https://workspace.synk.im/messenger/').exposed,[]);
  for(const electron of ['C:\\electron\\electron.exe',null,{},new Error('Cannot find module')])assert.deepEqual(run(electron,'https://workspace.synk.im/').exposed,[],String(electron));
});
