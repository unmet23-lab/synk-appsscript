import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { createCompanyApp } from './server.mjs';
import { hash } from './store.mjs';

test('deactivation during an unfinished password request cannot reactivate the employee', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'synk-body-race-'));
  const app = createCompanyApp({dataDir:dir,port:0,allowTestHost:true,schedule:false});
  const address = await app.start(), base = `http://127.0.0.1:${address.port}`;
  let partialRequest;
  t.after(async()=>{partialRequest?.destroy();await app.stop();await rm(dir,{recursive:true,force:true});});
  const admin = app.store.createUser({name:'Admin',email:'admin@example.test',password:'valid-admin-password',role:'admin'});
  const staff = app.store.createUser({name:'Staff',email:'staff@example.test',password:'valid-staff-password'});
  const adminSession = app.store.mint('session',admin.id,{csrfToken:'admin-csrf'},10);
  const staffSession = app.store.mint('session',staff.id,{csrfToken:'staff-csrf'},10);
  let began;
  const started = new Promise(resolve=>{began=resolve;});
  const readToken = app.store.readToken.bind(app.store);
  t.mock.method(app.store,'readToken',(value,purpose)=>{
    const row=readToken(value,purpose);
    if(value===staffSession&&purpose==='session')began();
    return row;
  });
  const input = JSON.stringify({oldPassword:'valid-staff-password',password:'replacement-staff-password'});
  const finished = new Promise((resolve,reject)=>{
    partialRequest=request(base+'/api/account/password',{method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(input),Origin:app.origin,'X-CSRF-Token':'staff-csrf',Cookie:`synk_company_session=${staffSession}`}},res=>{
      let raw='';res.setEncoding('utf8');res.on('data',part=>{raw+=part;});res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(raw),cookie:res.headers['set-cookie']}));
    });
    partialRequest.on('error',reject);
    partialRequest.write(input.slice(0,8));
  });
  await started;
  const deactivated=await fetch(base+`/api/members/${staff.id}/status`,{method:'POST',headers:{'Content-Type':'application/json',Origin:app.origin,'X-CSRF-Token':'admin-csrf',Cookie:`synk_company_session=${adminSession}`},body:JSON.stringify({active:false})});
  assert.equal(deactivated.status,200);
  partialRequest.end(input.slice(8));
  const rejected=await finished;
  assert.equal(rejected.status,401);
  assert.equal(rejected.cookie,undefined);
  assert.equal(app.store.get('users',staff.id).active,false);
  assert.equal(app.store.get('users',staff.id).passwordHash,staff.passwordHash);
  assert.equal(app.store.readToken(staffSession,'session'),null);
});

test('logout during OAuth code exchange prevents saving the new connection',async t=>{
  let release,began;
  const held=new Promise(r=>{release=r;}),started=new Promise(r=>{began=r;});
  const nativeFetch=globalThis.fetch;
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    if(String(url)==='https://oauth2.googleapis.com/token'){
      began();await held;
      return{ok:true,status:200,json:async()=>({access_token:'new-test-token',refresh_token:'new-test-refresh',expires_in:3600})};
    }
    return nativeFetch(url,options);
  });
  const dir=await mkdtemp(join(tmpdir(),'synk-oauth-session-race-'));
  const app=createCompanyApp({dataDir:dir,port:0,allowTestHost:true,schedule:false,collector:async()=>({channel:{externalId:'channel-test'},posts:[],coverage:{status:'complete'},warnings:[]})});
  const address=await app.start(),base=`http://127.0.0.1:${address.port}`;
  t.after(async()=>{release();await app.stop();await rm(dir,{recursive:true,force:true});});
  const user=app.store.createUser({name:'Staff',email:'staff@example.test',password:'valid-staff-password'});
  const session=app.store.mint('session',user.id,{csrfToken:'staff-csrf'},10);
  const channel={id:'channel-fixture',platform:'youtube',canonicalUrl:'https://www.youtube.com/@company',handle:'company',ownerIds:[user.id],active:true,status:'not-connected'};
  app.store.put('channels',channel.id,channel);
  app.store.setSecret('provider:youtube',{clientId:'fixture-client',clientSecret:'fixture-secret'});
  const state=app.store.mint('oauth',user.id,{channelId:channel.id,sessionHash:hash(session),platform:'youtube'},10);
  const pending=nativeFetch(base+`/api/oauth/youtube/callback?state=${state}&code=fixture-code`,{headers:{Cookie:`synk_company_session=${session}`},redirect:'manual'});
  await started;
  const logout=await nativeFetch(base+'/api/logout',{method:'POST',headers:{Cookie:`synk_company_session=${session}`,'Content-Type':'application/json',Origin:app.origin,'X-CSRF-Token':'staff-csrf'},body:'{}'});
  assert.equal(logout.status,200);
  release();
  const response=await pending;
  assert.equal(response.status,302);
  assert.match(response.headers.get('location'),/^\/\?connectionError=/);
  assert.equal(app.store.secret('channel:'+channel.id),null);
  assert.equal(app.store.all('channelSnapshots').length,0);
  assert.equal(app.store.all('runs').length,0);
});
