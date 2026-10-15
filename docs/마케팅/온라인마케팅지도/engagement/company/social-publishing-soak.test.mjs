import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {Store} from './store.mjs';
import {createSocialPublishingService} from './social-publishing.mjs';
import {createSocialDirectYouTube} from './social-direct-youtube.mjs';
import {refreshCredentials} from './oauth.mjs';

// Synthetic elapsed time and local SQLite only. No real SNS request or real-time soak.
const DAY=86400000,START=Date.parse('2026-10-15T00:00:00.000Z'),JOBS='socialPublishJobs';
const iso=at=>new Date(at).toISOString();
const capability=()=>({mode:'automatic',canPublish:true,formats:['video'],maxTextLength:5000,maxMediaCount:1});
async function fixture(t,{providerFactory,onPublished}={}){
  const directory=await mkdtemp(join(tmpdir(),'synk-social-soak-'));
  let store=new Store(directory),service,at=START;
  const manager=store.createUser({email:'manager@soak.test',name:'합성 관리자',role:'admin'}),sends=[],outcomes=[];
  store.put('channels','yt',{id:'yt',platform:'youtube',displayName:'합성 채널',active:true,ownerIds:[manager.id],connectionVersion:1});
  const now=()=>iso(at);
  const build=()=>{
    const provider=providerFactory?.({store,now,authorize:args=>service.assertExecution(args)})||{
      capability,publish:async args=>{sends.push(args.job.id);return {status:'published',url:'https://youtu.be/abcdefghijk',publishedAt:now()};},
      status:async()=>({status:'unknown'})
    };
    service=createSocialPublishingService({store,clock:now,provider,onPublished:onPublished||(({job})=>{outcomes.push(job.id);return {performanceEntryId:'performance-'+job.id};})});
  };
  build();
  const stop=async()=>{if(service){await service.close();service=null;}if(store){store.close();store=null;}};
  t.after(async()=>{await stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const restart=async()=>{await stop();store=new Store(directory);build();};
  const create=(extra={})=>{const draft=service.savePost(manager,{title:'장기 예약 합성 원고',body:'승인 원문',variants:[{channelId:'yt',title:'합성 제목',text:'합성 게시문',format:'video'}],...extra}).post;return service.action(manager,draft.id,{action:'approve',revision:draft.revision}).post;};
  const schedule=(post,scheduledAt=now())=>service.action(manager,post.id,{action:'schedule',revision:post.revision,scheduledAt,timezone:'Asia/Seoul'}).jobs[0];
  return {directory,manager,sends,outcomes,now,create,schedule,restart,stop,setTime(value){at=value;},get store(){return store;},get service(){return service;}};
}

test('28 daily occurrences survive 28 SQLite reopenings and never publish early or twice',async t=>{
  const f=await fixture(t),post=f.create({recurrence:{intervalDays:1,maxOccurrences:28}});
  f.schedule(post,iso(START+DAY));
  for(let day=1;day<=28;day++){
    f.setTime(START+day*DAY-1);await f.restart();await f.service.tick();
    assert.equal(f.sends.length,day-1,'future reservation must stay pending');
    f.setTime(START+day*DAY);await f.service.tick();await f.service.tick();
    const rows=f.store.all(JOBS).filter(row=>row.postId===post.id);
    assert.equal(f.sends.length,day);assert.equal(rows.filter(row=>row.status==='published').length,day);
    assert.equal(rows.filter(row=>row.status==='scheduled').length,day===28?0:1);
    assert.ok(rows.every(row=>row.attempts<=1&&row.approvalHash===post.approval.hash));
  }
  assert.equal(new Set(f.sends).size,28);assert.equal(f.outcomes.length,28);
  f.setTime(START+60*DAY);await f.restart();await f.service.tick();assert.equal(f.sends.length,28);
});

test('a 14-day outage preserves a missed reservation until an explicit reschedule',async t=>{
  const f=await fixture(t),job=f.schedule(f.create(),iso(START+DAY));
  f.setTime(START+14*DAY);await f.restart();await f.service.tick();
  assert.equal(f.store.get(JOBS,job.id).status,'missed');assert.equal(f.sends.length,0);
  await f.service.jobAction(f.manager,job.id,{action:'reschedule',scheduledAt:iso(START+21*DAY)});
  f.setTime(START+21*DAY-1);await f.restart();await f.service.tick();assert.equal(f.sends.length,0);
  f.setTime(START+21*DAY);await f.service.tick();await f.restart();await f.service.tick();
  assert.equal(f.sends.length,1);assert.equal(f.store.get(JOBS,job.id).attempts,1);
});

test('an uncertain submission remains read-only for 21 simulated days across restarts',async t=>{
  let sends=0,polls=0;
  const f=await fixture(t,{providerFactory:()=>({capability,publish:async()=>{sends++;throw Error('lost synthetic response');},status:async()=>{polls++;return {status:'unknown'};}})});
  const job=f.schedule(f.create());await f.service.tick();
  for(let day=1;day<=21;day++){
    f.setTime(START+day*DAY);await f.restart();await f.service.tick();
    const row=f.store.get(JOBS,job.id);assert.equal(row.status,'unknown');assert.equal(row.attempts,1);
    assert.ok(Date.parse(row.nextAttemptAt)>START+day*DAY);assert.ok(Date.parse(row.nextAttemptAt)<=START+day*DAY+3600000);
    await f.service.tick();
    await assert.rejects(f.service.jobAction(f.manager,job.id,{action:'retry'}),{status:409});
  }
  assert.equal(sends,1);assert.equal(polls,21);
});

test('current approval authority and content expiry are rechecked after a month of waiting',async t=>{
  const f=await fixture(t),job=f.schedule(f.create(),iso(START+28*DAY));
  const expiring=f.schedule(f.create({title:'만료 원고',expiresAt:iso(START+20*DAY)}),iso(START+19*DAY));
  f.setTime(START+21*DAY);await f.restart();await f.service.tick();assert.equal(f.store.get(JOBS,expiring.id).status,'expired');
  f.store.put('users',f.manager.id,{...f.store.get('users',f.manager.id),role:'viewer'});
  f.setTime(START+28*DAY);await f.restart();await f.service.tick();
  assert.equal(f.store.get(JOBS,job.id).status,'failed');assert.equal(f.store.get(JOBS,job.id).errorCode,'PERMISSION_OR_VERSION_CHANGED');assert.equal(f.sends.length,0);
});

async function crashAfterPublication(f){
  const now=f.now();await f.stop();
  const source=`
    import {Store} from ${JSON.stringify(new URL('./store.mjs',import.meta.url).href)};
    import {createSocialPublishingService} from ${JSON.stringify(new URL('./social-publishing.mjs',import.meta.url).href)};
    const store=new Store(process.argv[1]),at=process.argv[2];
    const service=createSocialPublishingService({store,clock:()=>at,provider:{capability:()=>({mode:'automatic',canPublish:true,formats:['video']}),publish:async()=>({status:'published',url:'https://youtu.be/abcdefghijk',publishedAt:at})},onPublished:()=>process.exit(75)});
    await service.tick();process.exit(76);
  `;
  const child=spawnSync(process.execPath,['--input-type=module','-e',source,f.directory,now],{encoding:'utf8',timeout:15000,windowsHide:true});
  assert.equal(child.error,undefined);assert.equal(child.status,75,'child must exit inside the outcome callback');
  await f.restart();
}

test('a process exit after publication cannot lose the next recurring reservation',async t=>{
  const f=await fixture(t),post=f.create({recurrence:{intervalDays:1,maxOccurrences:3}}),first=f.schedule(post);
  await crashAfterPublication(f);
  assert.equal(f.store.get(JOBS,first.id).status,'published');
  const next=f.store.all(JOBS).find(row=>row.postId===post.id&&row.occurrence===2);
  assert.ok(next,'next reservation must be durable before the asynchronous outcome callback');
  assert.equal(next.scheduledAt,iso(START+DAY));
  f.setTime(START+DAY);await f.service.tick();await f.restart();await f.service.tick();
  assert.deepEqual(f.sends,[next.id]);assert.equal(f.store.all(JOBS).filter(row=>row.occurrence===3).length,1);
});

test('a process exit during outcome linkage retries only the outcome after restart',async t=>{
  const f=await fixture(t),job=f.schedule(f.create());
  await crashAfterPublication(f);f.setTime(START+7*DAY);await f.service.tick();await f.restart();await f.service.tick();
  const row=f.store.get(JOBS,job.id);assert.equal(row.status,'published');assert.equal(row.attempts,1);
  assert.equal(row.performanceEntryId,'performance-'+job.id);assert.ok(row.outcomeLinkedAt);assert.equal(row.outcomeRetryAt,null);
  assert.equal(f.sends.length,0);assert.deepEqual(f.outcomes,[job.id]);
});

test('a successor write failure rolls back publication state and reconciles without a second submission',async t=>{
  let sends=0,polls=0;
  const f=await fixture(t,{providerFactory:({now})=>({capability,publish:async()=>{sends++;return {status:'published',url:'https://youtu.be/abcdefghijk',publishedAt:now()};},status:async()=>{polls++;return {status:'published',url:'https://youtu.be/abcdefghijk',publishedAt:iso(START)};}})});
  const post=f.create({recurrence:{intervalDays:1,maxOccurrences:2}}),job=f.schedule(post),original=f.store.put.bind(f.store);let failOnce=true;
  f.store.put=(kind,id,row)=>{if(kind===JOBS&&row.occurrence===2&&failOnce){failOnce=false;throw Error('synthetic next reservation write failure');}return original(kind,id,row);};
  await f.service.tick();
  assert.equal(f.store.get(JOBS,job.id).status,'unknown');assert.equal(f.store.all(JOBS).length,1);assert.equal(f.outcomes.length,0);
  f.setTime(START+300000);await f.restart();await f.service.tick();
  assert.equal(f.store.get(JOBS,job.id).status,'published');assert.equal(f.store.all(JOBS).length,2);assert.equal(f.outcomes.length,1);
  assert.equal(sends,1);assert.equal(polls,1);
});

test('an interrupted backlog cannot authorize stale posts after a 14-day scheduler gap without a restart',async t=>{
  const f=await fixture(t);for(let i=0;i<26;i++)f.schedule(f.create({title:'한꺼번에 예약 '+i}));
  const later=f.schedule(f.create({title:'중단 중 지난 예약'}),iso(START+7*DAY));
  await f.service.tick();assert.equal(f.sends.length,25);assert.equal(f.store.all(JOBS).filter(row=>row.status==='scheduled').length,2);
  f.setTime(START+14*DAY);await f.service.tick();
  assert.equal(f.sends.length,25,'a long interruption is not scheduler-caused processing delay');
  assert.equal(f.store.get(JOBS,later.id).status,'missed');assert.equal(f.store.all(JOBS).filter(row=>row.status==='missed').length,2);
});

test('a backwards clock correction discards the old backlog reference for newly approved work',async t=>{
  const f=await fixture(t);for(let i=0;i<26;i++)f.schedule(f.create({title:'시계 보정 전 '+i}));
  await f.service.tick();assert.equal(f.sends.length,25);
  f.setTime(START-600000);const current=f.schedule(f.create({title:'시계 보정 후 현재 예약'}));await f.service.tick();
  assert.equal(f.store.get(JOBS,current.id).status,'published');assert.equal(f.sends.length,26);
  assert.equal(f.store.all(JOBS).filter(row=>row.status==='scheduled').length,1,'the original future reservation stays pending');
});

test('28-day scheduled YouTube publishing renews expired OAuth access while preserving approval and encrypted credentials',async t=>{
  t.mock.timers.enable({apis:['Date'],now:START});
  const cid='UC1234567890123456789012',bytes=Buffer.alloc(32);bytes.write('ftyp',4);bytes.write('isom',8);
  const ref={assetId:'soak-video',url:'/api/social/media/soak-video',mimeType:'video/mp4',type:'video',byteSize:32,sha256:createHash('sha256').update(bytes).digest('hex')};
  const metadata=new Map(),requests=[],refreshes=[];let ids=0;
  const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers});
  const f=await fixture(t,{providerFactory:({store,now,authorize})=>createSocialDirectYouTube({store,clock:now,authorizePublish:authorize,resolveMedia:async()=>({bytes}),
    getCredentials:async channel=>{
      const previous=store.secret('channel:'+channel.id),next=await refreshCredentials('youtube',previous,{clientId:'synthetic-client',clientSecret:'synthetic-secret'},{fetchImpl:async(url,options)=>{
        assert.equal(url,'https://oauth2.googleapis.com/token');assert.equal(options.body.get('refresh_token'),'synthetic-refresh');refreshes.push(now());
        return json({access_token:'synthetic-renewed-'+refreshes.length,expires_in:3600});
      }});store.setSecret('channel:'+channel.id,next);return next;
    },
    fetchImpl:async(url,options)=>{
      requests.push({method:options.method,at:now()});const target=new URL(url);
      if(target.pathname==='/youtube/v3/channels')return json({items:[{id:cid}]});
      if(options.method==='POST'){
        const id=String(++ids).padStart(11,'0');metadata.set(id,{...JSON.parse(options.body),at:now()});
        return new Response('',{status:200,headers:{location:'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&upload_id='+id}});
      }
      if(options.method==='PUT')return json({id:target.searchParams.get('upload_id')},201);
      if(target.pathname==='/youtube/v3/videos'){
        const id=target.searchParams.get('id'),row=metadata.get(id);assert.ok(row);
        return json({items:[{id,snippet:{...row.snippet,channelId:cid,publishedAt:row.at},status:{...row.status,uploadStatus:'processed'},processingDetails:{processingStatus:'succeeded'}}]});
      }
      throw Error('unexpected synthetic endpoint');
    }
  })});
  f.store.put('channels','yt',{...f.store.get('channels','yt'),externalId:cid});
  f.store.setSecret('channel:yt',{authType:'google-oauth',accountId:cid,accessToken:'synthetic-initial',refreshToken:'synthetic-refresh',expiresAt:iso(START+3600000),issuedAt:iso(START),permissionsVerifiedAt:iso(START),scope:'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly'});
  f.store.put('socialDirectConnections','yt',{enabled:true,version:'synthetic-link',connectionVersion:1,accountId:cid,authType:'google-oauth'});
  const post=f.create({recurrence:{intervalDays:7,maxOccurrences:4},variants:[{channelId:'yt',title:'합성 제목',text:'합성 게시문',format:'video',media:[ref],options:{privacy:'public',madeForKids:false}}]});
  f.schedule(post,iso(START+7*DAY));
  for(const day of [7,14,21,28]){
    t.mock.timers.setTime(START+day*DAY);f.setTime(START+day*DAY);await f.restart();await f.service.tick();await f.service.tick();
    const row=f.store.all(JOBS).find(item=>item.occurrence===day/7);assert.equal(row.status,'published');assert.equal(row.attempts,1);assert.equal(row.approvalHash,post.approval.hash);
    const secret=f.store.secret('channel:yt');assert.equal(secret.refreshToken,'synthetic-refresh');assert.equal(secret.accountId,cid);assert.equal(secret.expiresAt,iso(START+day*DAY+3600000));
    assert.doesNotMatch(JSON.stringify(f.store.all('socialDirectPublishJobs')),/synthetic-refresh|synthetic-renewed/);
  }
  assert.equal(refreshes.length,4);assert.equal(requests.filter(row=>row.method==='POST').length,4);assert.equal(requests.filter(row=>row.method==='PUT').length,4);
  assert.equal(f.store.all(JOBS).length,4);assert.ok(f.store.all(JOBS).every(row=>row.status==='published'));
});
