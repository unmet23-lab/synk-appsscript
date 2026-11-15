// Facebook 통계 연결 시작(11-14 실연결 P1): 예전에 받은 read_insights를 다시 요청하지 않고, 저장된 연결은 그대로 둔다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCompanyApp} from './server.mjs';

test('Facebook statistics start never re-requests a legacy read_insights grant and keeps the stored connection',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'synk-oauth-facebook-scope-')),app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false});
  const address=await app.start();
  t.after(async()=>{await app.stop();await rm(directory,{recursive:true,force:true});});
  const admin=app.store.createUser({name:'Synthetic admin',email:'oauth-admin@example.test',role:'admin'});
  const cookie=`synk_company_session=${app.store.mint('session',admin.id,{csrfToken:'fixture'},10)}`;
  app.store.setSecret('provider:facebook',{clientId:'synthetic-app',clientSecret:'synthetic-secret'});
  app.store.put('channels','fb-page',{id:'fb-page',platform:'facebook',canonicalUrl:'https://www.facebook.com/synkpulse',handle:'synkpulse',displayName:'Synthetic page',ownerIds:[admin.id],teamId:null,active:true,status:'ready',connectionVersion:1});
  const legacy={accessToken:'synthetic-page-token',authType:'facebook-user',scope:'pages_show_list pages_read_engagement read_insights pages_manage_posts',permissionsVerifiedAt:'2026-10-01T00:00:00.000Z',connectedBy:admin.id};
  app.store.setSecret('channel:fb-page',legacy);
  const response=await fetch(`http://127.0.0.1:${address.port}/api/oauth/facebook/start?channelId=fb-page`,{headers:{Cookie:cookie},redirect:'manual'});
  await response.text();
  assert.equal(response.status,302);
  const location=new URL(response.headers.get('location'));
  assert.equal(location.hostname,'www.facebook.com');
  assert.deepEqual(location.searchParams.get('scope').split(','),['pages_show_list','pages_read_engagement','pages_manage_posts']);
  assert.ok(location.searchParams.get('state'));
  assert.deepEqual(app.store.secret('channel:fb-page'),legacy,'starting a reconnect neither deletes nor rewrites the stored grant');
});
