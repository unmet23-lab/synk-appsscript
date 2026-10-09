'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {suiteKey,validRecord,createSuiteStore,createSuitePublisher,createSuiteFollower}=require('../src/suite-session.cjs');
const key=suiteKey({supabaseUrl:'https://identity.example.test',accountApiUrl:'https://api.example.test'},'development');
const record=(status='signed-in',accountId='account-a',generation='login:1')=>({version:2,key,status,accountId:status==='signed-in'?accountId:null,generation,updatedAt:1000});
test('suite metadata contains no credentials, binds the authority and preserves other app vaults',t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'synk-suite-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const vault=path.join(directory,'auth-session.enc');fs.writeFileSync(vault,'retained-fixture');const store=createSuiteStore({directory,key});assert.equal(store.read(),null);
 store.write(record());assert.deepEqual(store.read(),record());store.write(record('signed-out'));assert.equal(store.read().status,'signed-out');assert.equal(fs.readFileSync(vault,'utf8'),'retained-fixture');
 assert.equal(validRecord({...record(),accessToken:'forbidden'},key),false);assert.equal(validRecord(record(),'different-issuer'),false);assert.throws(()=>store.write({...record(),status:'trusted'}));
 assert.equal(fs.readdirSync(directory).filter(name=>name.endsWith('.tmp')).length,0);
});
function publisher(initial=null){let stored=initial,fail=false;const writes=[];
 const service=createSuitePublisher({store:{read:()=>stored,write:value=>{if(fail)throw Error('disk unavailable');stored=value;writes.push(value);}},key,now:()=>2000});
 return {service,writes,stored:()=>stored,fail:value=>{fail=value;}};
}
const signed=(accountId='account-a')=>({status:'signed-in',signedIn:true,sessionGeneration:1,account:{synk_user_id:accountId}});
test('same-account refresh, focus and process exit retain the durable choice without repeated writes',()=>{
 const p=publisher();p.service.publish({status:'restoring',signedIn:false,sessionGeneration:1});assert.equal(p.writes.length,0);
 p.service.publish(signed());const chosen=p.stored();p.service.publish({status:'restoring',signedIn:false,sessionGeneration:1});p.service.publish(signed());assert.equal(p.writes.length,1);
 p.service.dispose();assert.deepEqual(p.stored(),chosen);
 const restarted=publisher(chosen);restarted.service.publish({status:'restoring',signedIn:false});restarted.service.publish(signed());assert.equal(restarted.writes.length,0);assert.equal(restarted.stored().generation,chosen.generation);
});
test('pending, failed and cancelled platform sign-in retain the choice until a new account is verified',()=>{
 const original=record(),p=publisher(original);assert.equal(p.service.beginSignIn(),true);assert.deepEqual(p.stored(),original);
 p.service.publish({status:'signed-out',signedIn:false});p.service.publish({status:'signing-in',signedIn:false});p.service.publish({status:'signed-out',signedIn:false,error:{code:'AUTH_CANCELLED'}});assert.deepEqual(p.stored(),original);
 p.service.beginSignIn();p.service.publish(signed('account-b'));assert.equal(p.stored().accountId,'account-b');assert.equal(p.service.signOut(),true);assert.equal(p.stored().status,'signed-out');
});
test('failed sign-in or logout preflight never publishes an abandoned request later',()=>{
 for(const operation of ['beginSignIn','signOut']){const old=record(),p=publisher(old);p.fail(true);assert.equal(p.service[operation](),false);assert.deepEqual(p.stored(),old);assert.equal(p.service.project(signed()).signedIn,false);
 p.fail(false);assert.equal(p.service.refresh(),true);assert.deepEqual(p.stored(),old);assert.equal(p.service.project(signed()).signedIn,true);}
});
test('failed new-account publication keeps Platform masked until the new choice is durable',()=>{
 const p=publisher(record());p.fail(true);assert.equal(p.service.publish(signed('account-b')),false);assert.equal(p.stored().accountId,'account-a');assert.equal(p.service.project(signed('account-b')).signedIn,false);
 p.fail(false);assert.equal(p.service.refresh(),true);assert.equal(p.stored().accountId,'account-b');assert.equal(p.service.project(signed('account-b')).signedIn,true);
});
test('a durable logout wins on next startup even when clearing a surviving vault fails',async()=>{
 const p=publisher(record('signed-out')),calls=[];const auth={status:()=>({status:'signed-out',signedIn:false}),initialize:async()=>{calls.push('initialize');return signed();},signOut:async()=>{calls.push('clear');return {ok:false,error:{code:'storage-failure'}};}};
 const state=await p.service.initialize(auth);assert.equal(state.signedIn,false);assert.deepEqual(calls,['clear']);assert.equal(p.stored().status,'signed-out');
});
function follower(t){let value=record(),snapshot={signedIn:false,status:'signed-out'},closed=0;const calls=[];
 const auth={bindPlatform:next=>{calls.push(['bind',next?.status??null,next?.accountId??null]);snapshot={...snapshot,signedIn:snapshot.signedIn&&(!next||snapshot.account?.synk_user_id===next.accountId&&next.status==='signed-in')};},initialize:async()=>{calls.push(['initialize']);},status:()=>snapshot,signOut:async()=>{calls.push(['out']);snapshot={signedIn:false,status:'signed-out'};},signIn:async()=>{calls.push(['in']);}};
 const service=createSuiteFollower({store:{read:()=>{if(value instanceof Error)throw value;return value;}},auth,schedule:()=>42,unschedule:()=>closed++});t.after(()=>service.dispose());return {service,auth,calls,set:v=>{value=v;},state:v=>{snapshot=v;},get closed(){return closed;}};
}
test('a separately launched app without a platform choice restores its own verified vault',async t=>{const f=follower(t);f.set(null);await f.service.start();assert.deepEqual(f.calls,[['bind',null,null],['initialize']]);});
test('explicit signed-out platform never starts OAuth using a surviving browser login',async t=>{const f=follower(t);f.set(record('signed-out'));await f.service.start();assert.deepEqual(f.calls.map(x=>x[0]),['bind','out']);});
test('matching verified app session is reused; a changed account starts a fresh guarded OAuth flow',async t=>{const f=follower(t);f.state({signedIn:true,status:'signed-in',account:{synk_user_id:'account-a'}});await f.service.start();assert.equal(f.calls.filter(x=>x[0]==='in').length,0);f.set(record('signed-in','account-b','login:2'));await f.service.refresh();assert.deepEqual(f.calls.slice(-3).map(x=>x[0]),['initialize','out','in']);});
test('an OAuth failure is attempted once per platform generation and stops on logout',async t=>{const f=follower(t);await f.service.start();for(let n=0;n<4;n++)await f.service.refresh();assert.equal(f.calls.filter(x=>x[0]==='in').length,1);f.set(record('checking',null,'login:1'));await f.service.refresh();f.set(record());await f.service.refresh();assert.equal(f.calls.filter(x=>x[0]==='in').length,1);f.set(record('signed-out',null,'login:2'));await f.service.refresh();assert.equal(f.calls.at(-1)[0],'out');});
test('manual logout from a restored child is not undone by transient coordination errors',async t=>{
 const f=follower(t);f.state({signedIn:true,status:'signed-in',account:{synk_user_id:'account-a'}});await f.service.start();await f.auth.signOut();f.set(new Error('temporary read failure'));await f.service.refresh();f.set(record());await f.service.refresh();assert.equal(f.calls.filter(x=>x[0]==='in').length,0);
});
test('platform switch fences a pending restore before it can open a browser',async t=>{const f=follower(t);let release;f.auth.initialize=()=>new Promise(resolve=>{release=resolve;});const pending=f.service.start();await Promise.resolve();await Promise.resolve();f.set(record('signed-out',null,'login:2'));const ended=f.service.refresh();assert.deepEqual(f.calls.at(-1),['bind','signed-out',null]);release();await pending;await ended;assert.equal(f.calls.filter(x=>x[0]==='in').length,0);});
test('unreadable or unexpectedly missing metadata blocks exposure without interpreting it as logout',async t=>{
 const f=follower(t);f.state({signedIn:true,status:'signed-in',account:{synk_user_id:'account-a'}});await f.service.start();const count=f.calls.length;
 f.set(null);await f.service.refresh();assert.deepEqual(f.calls.slice(count),[['bind','checking',null]]);
 f.set(new Error('read failure'));await f.service.refresh();assert.equal(f.calls.filter(x=>x[0]==='out'||x[0]==='in').length,0);
});
