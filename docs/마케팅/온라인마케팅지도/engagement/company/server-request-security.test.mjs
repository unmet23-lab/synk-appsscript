import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCompanyApp } from './server.mjs';

const origin='https://workspace.example.test',password='synthetic-valid-password';
const customer={issuer:'https://identity.example.test',accountApiUrl:'https://identity.example.test/functions/v1/synk-account',publishableKey:'sb_publishable_fixture',clientId:'customer-browser',redirectUri:origin+'/api/customer/synk-id/callback'};
async function fixture(t,options={}){
  const dir=await mkdtemp(join(tmpdir(),'synk-request-security-'));
  const app=createCompanyApp({dataDir:dir,port:0,allowTestHost:true,schedule:false,origin,trustedProxyIps:'127.0.0.1',synkIdentityConfig:{issuer:'https://identity.example.test',accountApiUrl:'https://identity.example.test/functions/v1/synk-account',publishableKey:'fixture',clientId:'employee-browser'},synkCustomerIdentityConfig:customer,...options});
  const address=await app.start(),base=`http://127.0.0.1:${address.port}`;
  t.after(async()=>{await app.stop();await rm(dir,{recursive:true,force:true});});
  const user=app.store.createUser({name:'Fixture',email:'fixture@example.test',password,role:'admin'});
  const post=async(path,input={},ip='198.51.100.10',extra={})=>{const response=await fetch(base+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Forwarded-For':ip,...extra},body:JSON.stringify(input)});return {status:response.status,body:await response.json(),headers:response.headers};};
  return {app,base,user,post};
}

test('one trusted proxy preserves separate customer, employee, PULSE and password budgets for two clients',async t=>{
  const f=await fixture(t);
  for(const [path,input]of [['/api/customer/synk-id/start',{}],['/api/synk-id/challenge',{action:'login'}],['/pulse/api/open',{invite:'invalid-fixture'}]]){
    for(let i=0;i<30;i++)assert.notEqual((await f.post(path,input)).status,429,path+' '+i);
    assert.equal((await f.post(path,input)).status,429,path);
    assert.notEqual((await f.post(path,input,'198.51.100.11')).status,429,path);
  }
  for(let i=0;i<8;i++)assert.equal((await f.post('/api/login',{email:f.user.email,password:'wrong'})).status,401);
  assert.equal((await f.post('/api/login',{email:f.user.email,password})).status,429);
  assert.equal((await f.post('/api/login',{email:f.user.email,password},'198.51.100.11')).status,200);
});

test('untrusted callers cannot rotate XFF to evade password failures; email rotation hits the IP cap',async t=>{
  const f=await fixture(t,{trustedProxyIps:''});
  for(let i=0;i<8;i++)assert.equal((await f.post('/api/login',{email:f.user.email,password:'wrong'},`198.51.100.${i+1}`)).status,401);
  assert.equal((await f.post('/api/login',{email:f.user.email,password},'203.0.113.99')).status,429);
  for(let i=0;i<22;i++)assert.equal((await f.post('/api/login',{email:`missing-${i}@example.test`,password:'wrong'},`203.0.113.${i+1}`)).status,401);
  assert.equal((await f.post('/api/login',{email:'another@example.test',password:'wrong'},'203.0.113.100')).status,429);
});

test('unexpected production faults return generic 500 and only a fixed log label, including failures in response authorization',async t=>{
  const old=process.env.NODE_ENV;process.env.NODE_ENV='production';t.after(()=>{if(old===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=old;});
  const f=await fixture(t),logged=[];t.mock.method(console,'error',(...args)=>logged.push(args.join(' ')));
  const all=f.app.store.all.bind(f.app.store);
  t.mock.method(f.app.store,'all',kind=>{if(kind==='users')throw Object.assign(Error('/data/private-key customer-secret'),{code:'SQLITE_FULL'});return all(kind);});
  const response=await fetch(f.base+'/api/me');assert.equal(response.status,500);
  assert.deepEqual(await response.json(),{error:'처리하지 못했습니다. 관리자에게 문의해 주세요.'});
  assert.deepEqual(logged,['SYNK_COMPANY_SERVER REQUEST_FAILED SQLITE_FULL']);
});

test('user validation keeps 400 while internal typed 500 messages are masked on a public host',async t=>{
  const f=await fixture(t,{host:'0.0.0.0'}),logged=[];
  const token=f.app.store.mint('invite',null,{email:'new@example.test',name:'New',role:'member'},10);
  const invalid=await f.post('/api/join',{token,name:'New',password:'short'});
  assert.equal(invalid.status,400);assert.match(invalid.body.error,/12~256/);
  t.mock.method(console,'error',(...args)=>logged.push(args.join(' ')));
  t.mock.method(f.app.store,'all',()=>{throw Object.assign(Error('internal-secret-path'),{status:500,code:'PRIVATE_secret'});});
  const response=await fetch(f.base+'/api/me');assert.equal(response.status,500);
  assert.doesNotMatch(JSON.stringify(await response.json()),/internal|secret|path/);
  assert.deepEqual(logged,['SYNK_COMPANY_SERVER REQUEST_FAILED INTERNAL_ERROR']);
});

test('deactivation while async password verification runs cannot issue a login session',async t=>{
  const f=await fixture(t);let changed=false;
  const all=f.app.store.all.bind(f.app.store);
  t.mock.method(f.app.store,'all',kind=>{const result=all(kind);if(kind==='users'&&!changed){changed=true;setImmediate(()=>f.app.store.put('users',f.user.id,{...f.user,active:false}));}return result;});
  const response=await f.post('/api/login',{email:f.user.email,password});
  assert.equal(response.status,401);assert.equal(response.headers.get('set-cookie'),null);assert.equal(f.app.store.get('users',f.user.id).active,false);
});
