'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {configuration}=require('../src/auth-config.cjs');
const {teacherAccountRequest,bindTeacherIPC}=require('../src/teacher-account.cjs');
const {TEACHER}=require('../src/teacher-preview.cjs');
const raw={version:1,supabaseUrl:'https://synthetic.invalid',supabasePublishableKey:'sb_publishable_synthetic',clients:{world:{clientId:'world-only',redirectUri:'http://127.0.0.1:43822/synk/oauth/world/callback'},teacher:{clientId:'teacher-only',redirectUri:'http://127.0.0.1:43824/synk/oauth/teacher/callback'}}};
test('teacher is a distinct OAuth registration and vault fingerprint within the existing world product',()=>{
 const teacher=configuration(raw,'teacher','development'),world=configuration(raw,'world','development');
 assert.equal(teacher.product,'world');assert.equal(teacher.clientKey,'teacher');assert.equal(teacher.clientId,'teacher-only');assert.notEqual(teacher.fingerprint,world.fingerprint);
 assert.throws(()=>configuration({...raw,clients:{world:raw.clients.world}},'teacher','development'),{code:'AUTH_CONFIG_INVALID'});
 assert.throws(()=>configuration({...raw,clients:{...raw.clients,teacher:{...raw.clients.teacher,clientId:'world-only'}}},'teacher','development'),{code:'AUTH_CONFIG_INVALID'});
 assert.throws(()=>configuration({...raw,clients:{...raw.clients,teacher:{...raw.clients.teacher,redirectUri:raw.clients.world.redirectUri}}},'teacher','development'),{code:'AUTH_CONFIG_INVALID'});
});
test('teacher broker cannot access learner learning, town, company or arbitrary API operations',async()=>{
 const calls=[],auth={accountRequest:async(...args)=>{calls.push(args);return{ok:true};}};
 for(const operation of ['load','release','updateProfile','revokeSession','revokeAll','requestDeletion','exportPage'])assert.equal((await teacherAccountRequest(auth,operation)).ok,true);
 for(const operation of ['classes','workspace','assignments','assignmentUpdate','assignmentCancel','observations'])assert.equal((await teacherAccountRequest(auth,'classroom',{operation})).ok,true);
 const before=calls.length;
 for(const operation of ['setLearning','learningGet','learningPost','memoryGet','memoryPost','atlasSummary','companyRequest','__proto__'])assert.equal((await teacherAccountRequest(auth,operation)).error.code,'INVALID_REQUEST');
 for(const operation of ['student','account','startRun','submit','sharing','townRead','townCommand','learningPost'])assert.equal((await teacherAccountRequest(auth,'classroom',{operation})).error.code,'INVALID_REQUEST');
 assert.equal(calls.length,before);
});
test('real teacher handler rejects other windows and frames before account dispatch',async()=>{
 const handlers=new Map(),ipcMain={removeHandler:k=>handlers.delete(k),handle:(k,v)=>handlers.set(k,v)},frame={url:TEACHER.entry},webContents={mainFrame:null};webContents.mainFrame=frame;
 const window={webContents,isDestroyed:()=>false},calls=[],auth={accountRequest:async(...a)=>{calls.push(a);return{ok:true};},status:()=>({signedIn:true})};
 const remove=bindTeacherIPC({ipcMain,getWindow:()=>window,auth,environment:{clientId:'teacher'}}),handler=handlers.get('synk-teacher:account-request');
 const good={sender:webContents,senderFrame:frame};assert.equal((await handler(good,'load')).ok,true);
 for(const event of [{...good,sender:{}},{...good,senderFrame:{url:TEACHER.entry}},{...good,senderFrame:null}])await assert.rejects(handler(event,'load'),/UNTRUSTED_SENDER/);
 frame.url='http://127.0.0.1:4280/synk-account/client.html?product=world';await assert.rejects(handler(good,'load'),/UNTRUSTED_SENDER/);
 assert.equal(calls.length,1);remove();assert.equal(handlers.size,0);
});
