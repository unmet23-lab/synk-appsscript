'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),vm=require('node:vm'),{EventEmitter}=require('node:events');
const {TEACHER,teacherPreviewAvailable,createTeacherPreview,teacherNavigation,teacherResource,teacherPolicy,assertTeacherSender,teacherFrame}=require('../src/teacher-preview.cjs');
const {CLIENTS}=require('../src/catalog.cjs');
function fixture(overrides={}){const calls=[],options={packaged:false,mode:'development',clientId:'platform',executable:'C:\\fixed\\electron.exe',appRoot:path.resolve(__dirname,'..'),spawn:(exe,args,opts)=>{calls.push({exe,args,opts});const child=new EventEmitter();child.unref=()=>{};queueMicrotask(()=>child.emit('spawn'));return child;},...overrides};return {calls,options,service:createTeacherPreview(options)};}
test('teacher preview remains separate from the three installed release clients and has its own profile',()=>{
  assert.deepEqual(Object.keys(CLIENTS),['platform','world','messenger']);
  assert.equal(TEACHER.id,'teacher');assert.equal(TEACHER.entry,'http://127.0.0.1:4280/synk-account/teacher.html');
  assert.equal(TEACHER.sessionScope,'im.synk.teacher.preview');assert.ok(!Object.values(CLIENTS).some(c=>TEACHER.appId.startsWith(c.appId+'.')));
});
test('only an unpackaged development platform can launch the fixed separate teacher process with no shell',async()=>{
  const {calls,options,service}=fixture();assert.equal(service.available(),true);
  assert.deepEqual(await service.open('https://evil.invalid/'),{ok:true,preview:true,separateClient:true});
  assert.equal(calls.length,1);assert.equal(calls[0].exe,options.executable);assert.deepEqual(calls[0].args,[path.join(options.appRoot,'src','teacher-main.cjs'),'--synk-teacher-preview']);assert.equal(calls[0].opts.shell,false);assert.equal(calls[0].opts.detached,true);
  for(const change of [{packaged:true},{mode:'release'},{clientId:'world'},{clientId:'messenger'},{clientId:'teacher'}]){const denied=fixture(change);assert.equal(denied.service.available(),false);assert.equal((await denied.service.open()).code,'PREVIEW_DEVELOPMENT_ONLY');assert.equal(denied.calls.length,0);}
  assert.equal(teacherPreviewAvailable({packaged:null,mode:'development',clientId:'platform'}),false);
});
test('double clicks share pending launch and OS spawn failure allows a later retry',async()=>{
  let child;const {service,calls}=fixture({spawn:(exe,args,opts)=>{calls.push({exe,args,opts});child=new EventEmitter();child.unref=()=>{};return child;}});
  const first=service.open(),second=service.open();assert.equal(first,second);assert.equal(calls.length,1);
  child.emit('error',Error('synthetic'));assert.equal((await first).code,'PREVIEW_LAUNCH_FAILED');
  const retry=service.open();child.emit('spawn');assert.equal((await retry).ok,true);assert.equal(calls.length,2);
});
test('teacher navigation and resources cannot cross to platform, WORLD, company, arbitrary URLs or credentials',()=>{
  for(const value of [TEACHER.entry,TEACHER.entry+'#classrooms'])assert.equal(teacherNavigation(value),true);
  for(const value of [TEACHER.entry+'?product=world',TEACHER.entry+'api/learners','http://127.0.0.1:4280/','http://127.0.0.1:4191/','http://127.0.0.1:4290.evil.invalid/','http://user:pass@127.0.0.1:4290/','https://127.0.0.1:4290/','file:///C:/Windows/System32/cmd.exe','synk-desktop://platform/index.html'])assert.equal(teacherNavigation(value),false,value);
  assert.equal(teacherResource('http://127.0.0.1:4280/teacher-world/app.mjs'),true);assert.equal(teacherResource('http://127.0.0.1:4280/api/local-teacher/state'),false);
  for(const value of ['https://external.invalid/','http://127.0.0.1:4191/api/','http://user@127.0.0.1:4290/','file:///local.txt'])assert.equal(teacherResource(value),false);
  assert.match(teacherPolicy(),/connect-src 'self'/);assert.match(teacherPolicy(),/frame-src 'self'/);assert.match(teacherPolicy(),/object-src 'none'/);
});
test('teacher preload exposes fixed account operations without launcher, company, tokens or raw IPC',async()=>{
  let bridgeName,bridge;const calls=[];
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../src/teacher-preload.cjs'),'utf8'),{require:name=>{assert.equal(name,'electron');return {contextBridge:{exposeInMainWorld:(name,value)=>{bridgeName=name;bridge=value;}},ipcRenderer:{invoke:async channel=>{calls.push(channel);return {configured:false};}}};}});
  assert.equal(bridgeName,'synkTeacher');assert.deepEqual(Object.keys(bridge).sort(),['accountRequest','authCancelSignIn','authSignIn','authSignOut','authStatus','getEnvironment','onAuthChanged']);assert.equal(Object.isFrozen(bridge),true);
  await bridge.getEnvironment();await bridge.authStatus();assert.deepEqual(calls,['synk-teacher:environment','synk-teacher:auth-status']);
});
test('teacher IPC denies sibling windows, child frames, missing frames and foreign documents',()=>{
  const frame={url:TEACHER.entry},webContents={mainFrame:frame},window={webContents,isDestroyed:()=>false},event={sender:webContents,senderFrame:frame};
  assert.doesNotThrow(()=>assertTeacherSender(event,window));
  for(const bad of [{...event,sender:{}},{...event,senderFrame:{url:TEACHER.entry}},{...event,senderFrame:null}])assert.throws(()=>assertTeacherSender(bad,window),/UNTRUSTED_SENDER/);
  frame.url='http://127.0.0.1:4191/';assert.throws(()=>assertTeacherSender(event,window),/UNTRUSTED_SENDER/);
  frame.url='http://127.0.0.1:4280/teacher-world/?account=1';assert.equal(teacherFrame(frame.url),true);assert.throws(()=>assertTeacherSender(event,window),/UNTRUSTED_SENDER/);
  frame.url=TEACHER.entry;assert.throws(()=>assertTeacherSender(event,{...window,isDestroyed:()=>true}),/UNTRUSTED_SENDER/);
});
test('only the account teacher frame is allowed; local classroom demo stays a separate entry',()=>{
  for(const url of ['http://127.0.0.1:4280/teacher-world/?account=1','http://127.0.0.1:4280/teacher-world/index.html?account=1']){assert.equal(teacherFrame(url),true);assert.equal(teacherNavigation(url),false);}
  for(const url of ['http://127.0.0.1:4295/','http://127.0.0.1:4280/teacher-world/','http://127.0.0.1:4280/teacher-world/?account=1&account=1','http://127.0.0.1:4280/teacher-world/?account=1&token=hidden','http://127.0.0.1:4280/synk-account/client.html?product=world'])assert.equal(teacherFrame(url),false,url);
});
test('platform forwards only its main-process configured public auth file to the separate teacher process',async()=>{
  const {service,calls}=fixture({authConfigPath:'C:/synthetic/public-auth.json'});await service.open();assert.equal(calls[0].args[2],'--auth-config='+path.resolve('C:/synthetic/public-auth.json'));assert.equal(calls[0].opts.windowsHide,true);
});
