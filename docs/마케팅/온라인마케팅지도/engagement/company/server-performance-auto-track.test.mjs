import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCompanyApp} from './server.mjs';
import {Store} from './store.mjs';

// 서버 예약 수집이 저장한 새 공개 게시물이 성과 자동 수집 회차에서 24·72시간 관측에 오르는지(10-20).
async function fixture(t,{autoTrackEnv,performanceAutoTrack}={}){
  const keys=['SYNK_COMPANY_BACKGROUND_JOBS_ENABLED','SYNK_COMPANY_WORKROOM_SCHEDULE_ENABLED','SYNK_COMPANY_PERFORMANCE_AUTO_TRACK'],before=keys.map(k=>process.env[k]);
  process.env[keys[0]]='0';process.env[keys[1]]='1';if(autoTrackEnv===undefined)delete process.env[keys[2]];else process.env[keys[2]]=autoTrackEnv;
  const directory=await mkdtemp(join(tmpdir(),'synk-performance-auto-')),seed=new Store(directory);
  const user=seed.createUser({name:'Synthetic admin',email:'auto-track@example.test',role:'admin'});
  seed.put('settings','company',{enabled:true,hourKst:0});
  seed.put('channels','lab',{id:'lab',platform:'youtube',canonicalUrl:'https://www.youtube.com/@lab',handle:'lab',ownerIds:[user.id],active:true,status:'not-connected'});
  seed.setSecret('collection:youtube-public',{clientId:'synthetic-client',clientSecret:'synthetic-secret',accessToken:'synthetic-access',refreshToken:'synthetic-refresh',expiresAt:new Date(Date.now()+3600000).toISOString(),connectedBy:user.id,channelIds:['lab']});seed.close();
  const publishedAt=new Date(Date.now()-3600000).toISOString();
  const collector=async c=>({channel:{externalId:c.id,followers:0,views:13,metrics:{posts:2}},posts:[
    {externalId:'shortsAAAAA',url:'https://www.youtube.com/watch?v=shortsAAAAA',title:'새 쇼츠',publishedAt,publicationFormat:'youtube-shorts',metrics:{views:13,likes:0,comments:0}},
    {externalId:'oldVideoBBB',url:'https://www.youtube.com/watch?v=oldVideoBBB',title:'지난 영상',publishedAt:'2026-10-10T00:00:00Z',publicationFormat:'youtube-video',metrics:{views:3,likes:0,comments:0}}],
    coverage:{status:'complete',inventoryComplete:true,ownerAuthorized:false}});
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,channelCollectionEnabled:true,synkIdentityConfig:null,synkCustomerIdentityConfig:null,teachingConfig:null,collector,dailyTrendsCollector:async()=>{throw Error('unrelated');},...(performanceAutoTrack===undefined?{}:{performanceAutoTrack})});
  t.after(async()=>{await app.stop();for(let i=0;i<keys.length;i++)if(before[i]===undefined)delete process.env[keys[i]];else process.env[keys[i]]=before[i];await rm(directory,{recursive:true,force:true});});
  await app.start();await app.waitForIdle();await app.collectPublicationPerformance();await app.waitForIdle();
  return {app,user};
}

test('a scheduled collection keeps the post format and the performance pass auto-registers only the fresh public post',async t=>{
  const f=await fixture(t);
  const posts=Object.fromEntries(f.app.store.all('posts').map(post=>[post.externalId,post]));
  assert.equal(posts.shortsAAAAA.publicationFormat,'youtube-shorts');assert.equal(posts.oldVideoBBB.publicationFormat,'youtube-video');
  const entries=f.app.store.all('postPerformanceEntries');
  assert.equal(entries.length,1);
  assert.equal(entries[0].url,'https://www.youtube.com/watch?v=shortsAAAAA');assert.equal(entries[0].origin,'auto');assert.equal(entries[0].publicationFormat,'youtube-shorts');assert.equal(entries[0].createdBy,f.user.id);
  // 같은 회차를 다시 돌려도 새로 올리지 않는다.
  await f.app.collectPublicationPerformance();await f.app.waitForIdle();
  assert.equal(f.app.store.all('postPerformanceEntries').length,1);
});

test('auto registration can be switched off by the server setting or the option',async t=>{
  const byEnv=await fixture(t,{autoTrackEnv:'0'});
  assert.equal(byEnv.app.store.all('posts').length,2);assert.equal(byEnv.app.store.all('postPerformanceEntries').length,0);
  const byOption=await fixture(t,{performanceAutoTrack:false});
  assert.equal(byOption.app.store.all('postPerformanceEntries').length,0);
});

test('an invalid auto registration setting stops the server before opening data',async()=>{
  const before=process.env.SYNK_COMPANY_PERFORMANCE_AUTO_TRACK;process.env.SYNK_COMPANY_PERFORMANCE_AUTO_TRACK='yes';
  try{assert.throws(()=>createCompanyApp({dataDir:join(tmpdir(),'synk-performance-auto-never-created'),port:0,synkIdentityConfig:null,synkCustomerIdentityConfig:null,teachingConfig:null}),/SYNK_COMPANY_PERFORMANCE_AUTO_TRACK/);}
  finally{if(before===undefined)delete process.env.SYNK_COMPANY_PERFORMANCE_AUTO_TRACK;else process.env.SYNK_COMPANY_PERFORMANCE_AUTO_TRACK=before;}
});
