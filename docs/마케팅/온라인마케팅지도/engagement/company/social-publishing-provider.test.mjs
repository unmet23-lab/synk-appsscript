import test from 'node:test';
import assert from 'node:assert/strict';
import {createSocialPublishingProvider} from './social-publishing-provider.mjs';

const AT='2026-10-14T10:00:00.000Z';
class MemoryStore{
  rows=new Map();secrets=new Map();
  get(table,id){return structuredClone(this.rows.get(table)?.get(id)||null);}
  put(table,id,value){if(!this.rows.has(table))this.rows.set(table,new Map());this.rows.get(table).set(id,structuredClone(value));}
  all(table){return [...(this.rows.get(table)?.values()||[])].map(row=>structuredClone(row));}
  secret(id){return structuredClone(this.secrets.get(id)||null);}
  setSecret(id,value){this.secrets.set(id,structuredClone(value));}
  transaction(fn){return fn();}
}
const safeFailure=(code,message='검증된 오류')=>Object.assign(new Error(message),{code,providerSafe:true});
function fixture({onCheck,directOverrides={},legacyOverrides={},youtubeProvider}={}){
  const store=new MemoryStore(),calls=[];let at=Date.parse(AT);
  const admin={id:'admin',active:true,role:'admin',teamId:'team'},manager={id:'manager',active:true,role:'manager',teamId:'team'},member={id:'member',active:true,role:'member',teamId:'team'},viewer={id:'viewer',active:true,role:'viewer',teamId:'team'};
  for(const user of [admin,manager,member,viewer])store.put('users',user.id,user);
  const channel={id:'ig',platform:'instagram',externalId:'100',handle:'synk',displayName:'SYNK',active:true,teamId:'team',ownerIds:['member'],connectionVersion:4};
  store.put('channels',channel.id,channel);store.setSecret('channel:ig',{accessToken:'credential-secret',accountId:'100',authType:'instagram-login',scope:'instagram_business_basic instagram_business_content_publish',metaIdentityVersion:1,permissionsVerifiedAt:AT});
  const direct={
    capability(c){const link=store.get('socialDirectConnections',c.id),secret=store.secret('channel:'+c.id),ready=!!link?.enabled&&link.connectionVersion===(c.connectionVersion||0)&&secret?.scope.includes('content_publish');return {provider:'meta-direct',mode:ready?'automatic':'manual',canPublish:ready,formats:['image','reel','carousel'],reason:ready?null:'게시 권한과 직접 연결을 확인해 주세요.',missingScopes:secret?.scope.includes('content_publish')?[]:['instagram_business_content_publish'],errorCode:ready?null:'NOT_CONFIGURED'};},
    async checkConnection(c,context){calls.push(['direct.check',c.id]);context.authorize?.();await onCheck?.(c,context,{store,calls});context.authorize?.();return {accountId:c.externalId,authType:store.secret('channel:'+c.id)?.authType,checkedAt:AT};},
    preflight(input){calls.push(['direct.preflight',input.channel.id]);return {valid:true,errors:[],warnings:[]};},
    async publish(input){calls.push(['direct.publish',input.job.id]);return {provider:'meta-direct',status:'submitted',providerId:'direct-receipt'};},
    async status(input){calls.push(['direct.status',input.job.id]);return {provider:'meta-direct',status:'published',providerId:'direct-receipt'};},
    ...directOverrides
  };
  const legacy={
    capability(){return {provider:'postiz',mode:'automatic',canPublish:true,formats:['text','image','video']};},
    preflight(input){calls.push(['legacy.preflight',input.channel.id]);return {valid:true,errors:[],warnings:[]};},
    async publish(input){calls.push(['legacy.publish',input.job.id]);throw Error('Legacy publish must not run');},
    async status(input){calls.push(['legacy.status',input.job.id]);return {provider:'postiz',status:'published',providerId:'existing-postiz-receipt'};},
    async reconcile(user,input){calls.push(['legacy.reconcile',input.jobId]);return {status:'published'};},
    async stopHealth(){calls.push(['legacy.stop']);},...legacyOverrides
  };
  const provider=createSocialPublishingProvider({store,clock:()=>new Date(at).toISOString(),getProviderConfig:()=>({clientId:'app',clientSecret:'private-app-secret'}),directProvider:direct,legacyProvider:legacy,...(youtubeProvider?{youtubeProvider}:{})});
  const input={channel,job:{id:'job',channelId:channel.id},post:{id:'post'},variant:{channelId:channel.id}};
  return {store,provider,admin,manager,member,viewer,channel,input,calls,direct,legacy,advance:ms=>at+=ms};
}

test('settings exposes supported channels and OAuth route without app secrets or SNS tokens',()=>{
  const f=fixture();f.store.put('channels','hidden',{...f.channel,id:'hidden',hidden:true});f.store.put('channels','other',{...f.channel,id:'other',teamId:'elsewhere',ownerIds:[]});
  const settings=f.provider.settings(f.viewer);assert.equal(settings.provider,'direct');assert.deepEqual(settings.channels.map(c=>c.channelId),['ig']);assert.equal(settings.channels[0].canConfigure,false);assert.equal(settings.channels[0].connectUrl,'/api/oauth/instagram/start?channelId=ig&publishing=1');assert.ok(!JSON.stringify(settings).includes('private-app-secret'));assert.ok(!JSON.stringify(settings).includes('credential-secret'));
});
test('explicit opt-in creates separate generation and leaves comment connectionVersion unchanged',async()=>{
  const f=fixture();assert.equal(f.provider.capability(f.channel).canPublish,false);
  const connected=await f.provider.connect(f.manager,{channelId:'ig'}),row=f.store.get('socialDirectConnections','ig');assert.equal(row.enabled,true);assert.equal(row.accountId,'100');assert.equal(row.authType,'instagram-login');assert.equal(connected.canPublish,true);assert.equal(connected.connection.integrationId,'meta-direct:100:'+row.version);assert.equal(f.store.get('channels','ig').connectionVersion,4);
  assert.deepEqual(f.calls,[['direct.check','ig']]);assert.equal(f.store.get('socialDirectHealth','ig').state,'connected');
});
test('disconnect changes approval generation while keeping the independent channel connection',async()=>{
  const f=fixture();await f.provider.connect(f.admin,{channelId:'ig'});const before=f.store.get('socialDirectConnections','ig');f.provider.disconnect(f.admin,{channelId:'ig'});const after=f.store.get('socialDirectConnections','ig');assert.equal(after.enabled,false);assert.notEqual(after.version,before.version);assert.equal(f.provider.capability(f.channel).connection,null);assert.equal(f.store.get('channels','ig').connectionVersion,4);assert.equal(f.store.secret('channel:ig').accessToken,'credential-secret');
});
test('ordinary owner member and viewer cannot enable automatic publishing',async()=>{
  for(const role of ['member','viewer']){const f=fixture();await assert.rejects(()=>f.provider.connect(f[role],{channelId:'ig'}),{code:'CHANNEL_FORBIDDEN'});assert.equal(f.calls.length,0);assert.equal(f.store.get('socialDirectConnections','ig'),null);}
});
test('revoked manager authority during connection check prevents opt-in saving',async()=>{
  const f=fixture({onCheck:(_channel,_context,{store})=>store.put('users','manager',{...store.get('users','manager'),role:'member'})});await assert.rejects(()=>f.provider.connect(f.manager,{channelId:'ig'}),{code:'CHANNEL_FORBIDDEN'});assert.equal(f.store.get('socialDirectConnections','ig'),null);
});
test('channel identity changed during connection check prevents opt-in saving',async()=>{
  const f=fixture({onCheck:(_channel,_context,{store})=>store.put('channels','ig',{...store.get('channels','ig'),externalId:'999',connectionVersion:5})});await assert.rejects(()=>f.provider.connect(f.admin,{channelId:'ig'}),{code:'CONNECTION_CHANGED'});assert.equal(f.store.get('socialDirectConnections','ig'),null);
});
test('provider account mismatch is rejected without enabling the channel',async()=>{
  const f=fixture({directOverrides:{checkConnection:async()=>({accountId:'999'})}});await assert.rejects(()=>f.provider.connect(f.admin,{channelId:'ig'}),{code:'ACCOUNT_MISMATCH'});assert.equal(f.store.get('socialDirectConnections','ig'),null);
});
test('the same Instagram account cannot be enabled on a second SYNK channel',async()=>{
  const f=fixture();await f.provider.connect(f.admin,{channelId:'ig'});f.store.put('channels','duplicate',{...f.channel,id:'duplicate'});f.store.setSecret('channel:duplicate',f.store.secret('channel:ig'));
  await assert.rejects(()=>f.provider.connect(f.admin,{channelId:'duplicate'}),{code:'INTEGRATION_ALREADY_MAPPED'});assert.equal(f.store.get('socialDirectConnections','duplicate'),null);
});
test('unsupported platforms stay manual even when an old Postiz mapping looks connected',async()=>{
  const f=fixture();const channel={...f.channel,id:'tiktok',platform:'tiktok'};f.store.put('channels',channel.id,channel);const cap=f.provider.capability(channel);assert.equal(cap.canPublish,false);assert.equal(cap.provider,'manual');assert.equal(cap.mode,'manual');
  const result=await f.provider.publish({...f.input,channel});assert.equal(result.status,'manual_required');assert.ok(!f.calls.some(c=>c[0].endsWith('.publish')));await assert.rejects(()=>f.provider.connect(f.admin,{channelId:channel.id}),{code:'UNSUPPORTED_PLATFORM'});
});
test('existing Postiz receipt routes publish attempts to read-only reconciliation',async()=>{
  const f=fixture();f.store.put('socialProviderJobs','receipt',{id:'receipt',jobId:'job',status:'submitting'});const response=await f.provider.publish(f.input);assert.equal(response.provider,'postiz');assert.deepEqual(f.calls,[['legacy.status','job']]);
});
test('known direct and legacy receipts route status to their original provider',async()=>{
  const f=fixture();f.store.put('socialDirectPublishJobs','direct',{id:'direct',jobId:'job'});f.store.put('socialProviderJobs','legacy',{id:'legacy',jobId:'old-job'});await f.provider.status(f.input);await f.provider.status({...f.input,job:{id:'old-job'}});assert.deepEqual(f.calls,[['direct.status','job'],['legacy.status','old-job']]);
});
test('unknown job status cannot trigger fresh publishing',async()=>{
  const f=fixture();const response=await f.provider.status(f.input);assert.equal(response.status,'not_found');assert.equal(response.errorCode,'NOT_SUBMITTED');assert.equal(response.retryable,true);assert.equal(response.definitive,true);assert.equal(f.calls.length,0);
});
test('new supported publication and preflight select direct adapter',async()=>{
  const f=fixture();f.provider.preflight(f.input);await f.provider.publish(f.input);assert.deepEqual(f.calls,[['direct.preflight','ig'],['direct.publish','job']]);
});
test('legacy manual reconciliation requires current channel-management authority',async()=>{
  const f=fixture();f.store.put('socialPublishJobs','job',{id:'job',channelId:'ig'});f.store.put('socialProviderJobs','legacy',{id:'legacy',jobId:'job'});await assert.rejects(()=>f.provider.reconcile(f.member,{jobId:'job'}),{code:'CHANNEL_FORBIDDEN'});assert.equal(f.calls.length,0);await f.provider.reconcile(f.admin,{jobId:'job'});assert.deepEqual(f.calls,[['legacy.reconcile','job']]);
});
test('health checks use read-only account checks and mark matching generation as current',async()=>{
  const f=fixture();await f.provider.connect(f.admin,{channelId:'ig'});f.calls.length=0;const report=await f.provider.checkHealth(f.admin,{channelId:'ig'});const channel=report.channels.find(c=>c.channelId==='ig');assert.equal(channel.state,'connected');assert.equal(channel.stale,false);assert.equal(channel.checkedAt,AT);assert.deepEqual(f.calls,[['direct.check','ig']]);
  f.store.put('socialDirectConnections','ig',{...f.store.get('socialDirectConnections','ig'),version:'new-generation'});assert.equal(f.provider.health(f.admin).channels[0].stale,true);
});
test('connection health sanitizes unexpected error messages',async()=>{
  let fail=false;const f=fixture({onCheck:()=>{if(fail)throw Error('secret-token-with-private-details');}});await f.provider.connect(f.admin,{channelId:'ig'});fail=true;const health=await f.provider.checkHealth(f.admin,{channelId:'ig'});assert.equal(health.channels[0].state,'error');assert.equal(health.channels[0].checkedAt,null);assert.ok(!JSON.stringify(health).includes('secret-token-with-private-details'));
});
test('expired permission health is shown as auth required without changing opt-in',async()=>{
  let fail=false;const f=fixture({onCheck:()=>{if(fail)throw safeFailure('AUTH_REQUIRED','게시 권한을 다시 연결해 주세요.');}});await f.provider.connect(f.admin,{channelId:'ig'});fail=true;const health=await f.provider.checkHealth(f.admin,{channelId:'ig'});assert.equal(health.channels[0].state,'auth_required');assert.equal(health.channels[0].errorCode,'AUTH_REQUIRED');assert.equal(f.store.get('socialDirectConnections','ig').enabled,true);
});
test('scheduled connection checks honor interval and revoked owner authority',async()=>{
  const f=fixture();await f.provider.connect(f.manager,{channelId:'ig'});f.calls.length=0;assert.equal((await f.provider.scanHealthDue()).checked,0);f.advance(3600001);assert.equal((await f.provider.scanHealthDue()).checked,1);assert.deepEqual(f.calls,[['direct.check','ig']]);
  f.advance(3600001);f.store.put('users','manager',{...f.manager,active:false});assert.equal((await f.provider.scanHealthDue()).checked,0);
});
test('stop blocks connection changes and further health scans',async()=>{
  const f=fixture();await f.provider.stopHealth();await assert.rejects(()=>f.provider.connect(f.admin,{channelId:'ig'}),{code:'PROVIDER_STOPPED'});assert.deepEqual(await f.provider.scanHealthDue(),{checked:0});assert.deepEqual(f.calls,[['legacy.stop']]);
});

test('same numeric ID on different SNS platforms is not a duplicate account',async()=>{
  const f=fixture();await f.provider.connect(f.admin,{channelId:'ig'});const facebook={...f.channel,id:'facebook',platform:'facebook'};assert.doesNotThrow(()=>f.provider.assertUnique(facebook));
});
test('duplicate mappings discovered after connect block capability and new sends',async()=>{
  const f=fixture();await f.provider.connect(f.admin,{channelId:'ig'});f.store.put('channels','duplicate',{...f.channel,id:'duplicate'});f.store.put('socialDirectConnections','duplicate',{...f.store.get('socialDirectConnections','ig'),id:'duplicate',channelId:'duplicate'});const cap=f.provider.capability(f.channel);assert.equal(cap.canPublish,false);assert.equal(cap.errorCode,'INTEGRATION_ALREADY_MAPPED');await assert.rejects(()=>f.provider.publish(f.input),{code:'INTEGRATION_ALREADY_MAPPED'});assert.ok(!f.calls.some(c=>c[0].endsWith('.publish')));
});
test('request budget exposes only readable active channels',()=>{
  const f=fixture();f.store.put('channels','private',{...f.channel,id:'private',teamId:'another',ownerIds:[]});f.store.put('channels','hidden',{...f.channel,id:'hidden',hidden:true});f.store.put('channels','archived',{...f.channel,id:'archived',active:false});
  f.store.put('socialDirectPublishRequests','ig',{times:[100,200],retryAt:300});for(const id of ['private','hidden','archived'])f.store.put('socialDirectPublishRequests',id,{times:[900],retryAt:999});
  assert.deepEqual(f.provider.requestBudgetSnapshot(f.viewer),{times:[100,200],retryAfter:300});assert.deepEqual(f.provider.requestBudgetSnapshot(f.admin),{times:[100,200,900],retryAfter:999});
});

test('capacity reads the YouTube adapter namespaced request budget',()=>{
  const f=fixture();f.store.put('channels','yt',{...f.channel,id:'yt',platform:'youtube'});f.store.put('socialDirectPublishRequests','youtube-direct:yt',{provider:'youtube-direct',channelId:'yt',times:[150],retryAt:250});
  assert.deepEqual(f.provider.requestBudgetSnapshot(f.viewer),{times:[150],retryAfter:250});
});

test('connect renews credentials before pinning the account verification',async()=>{
  const f=fixture();let renewals=0;
  const provider=createSocialPublishingProvider({store:f.store,directProvider:f.direct,legacyProvider:f.legacy,getCredentials:async()=>{renewals++;f.store.setSecret('channel:ig',{...f.store.secret('channel:ig'),accessToken:'renewed'});},clock:()=>AT});
  const result=await provider.connect(f.admin,{channelId:'ig'});assert.equal(result.canPublish,true);assert.equal(renewals,1);assert.equal(f.store.get('socialDirectConnections','ig').enabled,true);
});
function youtubeStub(calls){return {
  capability:()=>({provider:'youtube-direct',mode:'automatic',canPublish:true,formats:['video','shorts'],reason:null}),
  checkConnection:async(channel,context)=>{context.authorize?.();calls.push(['youtube.check',channel.id]);return {accountId:channel.externalId,authType:'google-oauth',checkedAt:AT};},
  preflight:input=>{calls.push(['youtube.preflight',input.channel.id]);return {valid:true,errors:[],warnings:[]};},
  publish:async input=>{calls.push(['youtube.publish',input.job.id]);return {provider:'youtube-direct',status:'submitted',providerId:'youtube-receipt'};},
  status:async input=>{calls.push(['youtube.status',input.job.id]);return {provider:'youtube-direct',status:'published',providerId:'youtube-receipt'};}
};}
test('YouTube opt-in, preflight, publish, and receipt use the dedicated adapter',async()=>{
  const calls=[],f=fixture({youtubeProvider:youtubeStub(calls)}),channel={...f.channel,id:'yt',platform:'youtube',externalId:'UCabcdefghijk',handle:'@synk'};f.store.put('channels','yt',channel);f.store.setSecret('channel:yt',{accessToken:'youtube-token',accountId:channel.externalId,authType:'google-oauth'});
  const connected=await f.provider.connect(f.admin,{channelId:'yt'}),row=f.store.get('socialDirectConnections','yt');assert.equal(row.provider,'youtube-direct');assert.equal(connected.connection.integrationId,'youtube-direct:'+channel.externalId+':'+row.version);const input={...f.input,channel,job:{id:'youtube-job'}};f.provider.preflight(input);await f.provider.publish(input);f.store.put('socialDirectPublishJobs','yt-receipt',{id:'yt-receipt',jobId:'youtube-job',provider:'youtube-direct'});f.advance(600001);await f.provider.status(input);
  assert.deepEqual(calls,[['youtube.check','yt'],['youtube.preflight','yt'],['youtube.publish','youtube-job'],['youtube.status','youtube-job']]);assert.equal(f.calls.length,0);
});
test('an existing Meta receipt is never resent through YouTube after platform change',async()=>{
  const calls=[],f=fixture({youtubeProvider:youtubeStub(calls)});f.store.put('socialDirectPublishJobs','receipt',{id:'receipt',jobId:'job',provider:'meta-direct',status:'submitted'});const changed={...f.channel,platform:'youtube',externalId:'UCabcdefghijk'};f.store.put('channels','ig',changed);await f.provider.publish({...f.input,channel:changed});assert.deepEqual(f.calls,[['direct.status','job']]);assert.equal(calls.length,0);
});

const {createHash}=await import('node:crypto');
const ledgerIdOf=(provider,channelId,key)=>createHash('sha256').update(provider==='postiz'?channelId+':'+key:JSON.stringify([provider,channelId,key])).digest('hex');
const countScans=f=>{const scans=[],all=f.store.all.bind(f.store);f.store.all=kind=>{scans.push(kind);return all(kind);};return ()=>scans.filter(kind=>['socialDirectPublishJobs','socialProviderJobs'].includes(kind));};

test('receipts are found by their deterministic ledger id without scanning the ledger tables',async()=>{
  const f=fixture(),id=ledgerIdOf('meta-direct','ig','job');f.store.put('socialDirectPublishJobs',id,{id,jobId:'job',provider:'meta-direct',status:'submitted'});const scans=countScans(f);
  await f.provider.status(f.input);await f.provider.publish(f.input);assert.deepEqual(f.calls,[['direct.status','job'],['direct.publish','job']]);assert.deepEqual(scans(),[]);
  const legacyId=ledgerIdOf('postiz','ig','old');f.store.put('socialProviderJobs',legacyId,{id:legacyId,jobId:'old',status:'submitted'});await f.provider.status({...f.input,job:{id:'old'}});assert.deepEqual(f.calls.at(-1),['legacy.status','old']);assert.deepEqual(scans(),[]);
  const calls=[],g=fixture({youtubeProvider:youtubeStub(calls)}),channel={...g.channel,id:'yt',platform:'youtube',externalId:'UCabcdefghijk'};g.store.put('channels','yt',channel);const ytId=ledgerIdOf('youtube-direct','yt','idem');g.store.put('socialDirectPublishJobs',ytId,{id:ytId,jobId:'youtube-job',provider:'youtube-direct',status:'uploading'});const ytScans=countScans(g);
  await g.provider.status({...g.input,channel,job:{id:'youtube-job',idempotencyKey:'idem'}});assert.deepEqual(calls,[['youtube.status','youtube-job']]);assert.deepEqual(ytScans(),[]);
});

test('rows saved under another id scheme are found through one remembered scan of both ledger tables',async()=>{
  const f=fixture();f.store.put('socialDirectPublishJobs','old-row',{id:'old-row',jobId:'job',provider:'meta-direct',status:'submitted'});const scans=countScans(f);
  for(let n=0;n<3;n++)await f.provider.status(f.input);assert.deepEqual(f.calls,[['direct.status','job'],['direct.status','job'],['direct.status','job']]);assert.equal(scans().length,2);
  f.store.put('socialProviderJobs','old-legacy',{id:'old-legacy',jobId:'other',status:'submitted'});await f.provider.status({...f.input,job:{id:'other'}});assert.ok(!f.calls.some(c=>c[0]==='legacy.status'));assert.equal(scans().length,2);
  f.advance(600001);await f.provider.status({...f.input,job:{id:'other'}});assert.deepEqual(f.calls.at(-1),['legacy.status','other']);assert.equal(scans().length,4);
});

test('a direct-path job without any ledger row is reported as not submitted, while other paths stay unknown',async()=>{
  const f=fixture();const direct=await f.provider.status(f.input);assert.equal(direct.status,'not_found');assert.equal(direct.errorCode,'NOT_SUBMITTED');assert.equal(direct.retryable,true);assert.equal(direct.definitive,true);assert.equal(direct.provider,'meta-direct');assert.equal(f.calls.length,0);
  const tiktok={...f.channel,id:'tiktok',platform:'tiktok'};f.store.put('channels',tiktok.id,tiktok);const other=await f.provider.status({...f.input,channel:tiktok});assert.equal(other.status,'uncertain');assert.equal(other.errorCode,'SUBMISSION_NOT_FOUND');assert.equal(other.retryable,false);assert.equal(f.calls.length,0);
});

const {createSocialPublishingService}=await import('./social-publishing.mjs');
test('a job whose process died before the ledger write is marked unsent after a restart and can be retried',async()=>{
  const f=fixture();let at=Date.parse(AT);const clock=()=>new Date(at).toISOString();f.store.remove=(kind,id)=>{f.store.rows.get(kind)?.delete(id);};
  f.store.put('socialDirectConnections','ig',{id:'ig',channelId:'ig',provider:'meta-direct',enabled:true,version:'v1',connectionVersion:4,accountId:'100',authType:'instagram-login'});
  let crash=false;const direct={...f.direct,capability:()=>({provider:'meta-direct',mode:'automatic',canPublish:true,formats:['text','post','image'],reason:null,errorCode:null}),async publish(input){f.calls.push(['direct.publish',input.job.id]);if(crash)await new Promise(()=>{});return {provider:'meta-direct',status:'published',providerId:'700',url:'https://www.instagram.com/p/ABC/',publishedAt:clock()};},async status(input){f.calls.push(['direct.status',input.job.id]);return {provider:'meta-direct',status:'uncertain',errorCode:'SUBMISSION_NOT_FOUND'};}};
  const service=()=>createSocialPublishingService({store:f.store,clock,provider:createSocialPublishingProvider({store:f.store,clock,directProvider:direct,youtubeProvider:direct,legacyProvider:f.legacy})});
  const first=service();let {post}=first.savePost(f.admin,{title:'제목',body:'본문',variants:[{channelId:'ig',text:'본문',format:'post',media:[]}]});({post}=first.action(f.admin,post.id,{action:'approve',revision:post.revision}));
  const {jobs}=first.action(f.admin,post.id,{action:'schedule',revision:post.revision,scheduledAt:clock(),timezone:'Asia/Seoul'}),job=jobs[0];
  crash=true;void first.tick();await new Promise(resolve=>setTimeout(resolve,20));assert.equal(f.store.get('socialPublishJobs',job.id).status,'publishing');assert.equal(f.store.all('socialDirectPublishJobs').length,0);
  crash=false;const restarted=service();at+=121000;await restarted.tick();const saved=f.store.get('socialPublishJobs',job.id);assert.equal(saved.status,'failed');assert.equal(saved.errorCode,'NOT_SUBMITTED');assert.equal(saved.retryable,true);assert.equal(saved.definitiveFailure,true);assert.ok(!f.calls.some(c=>c[0]==='direct.status'));
  assert.equal((await restarted.jobAction(f.admin,job.id,{action:'retry'})).job.status,'scheduled');await restarted.tick();assert.equal(f.store.get('socialPublishJobs',job.id).status,'published');assert.equal(f.calls.filter(c=>c[0]==='direct.publish').length,2);
});

test('a Postiz receipt that definitely sent nothing hands the job to the direct adapter',async()=>{
  const id=ledgerIdOf('postiz','ig','job'),f=fixture();f.store.put('socialProviderJobs',id,{id,jobId:'job',idempotencyKey:'job',channelId:'ig',status:'failed',definitive:true,retryable:true,errorCode:'NOT_SUBMITTED'});
  await f.provider.publish({...f.input,job:{...f.input.job,attempts:2}});assert.deepEqual(f.calls,[['direct.publish','job']]);
  for(const row of [{status:'failed',definitive:true,providerId:'postiz-post'},{status:'failed',definitive:false},{status:'uncertain'},{status:'submitted',providerId:'postiz-post'}]){const g=fixture();g.store.put('socialProviderJobs',id,{id,jobId:'job',...row});await g.provider.publish({...g.input,job:{...g.input.job,attempts:2}});assert.deepEqual(g.calls,[['legacy.status','job']],JSON.stringify(row));}
  const tiktok=fixture(),channel={...tiktok.channel,id:'tt',platform:'tiktok'};tiktok.store.put('channels','tt',channel);const ttId=ledgerIdOf('postiz','tt','job');tiktok.store.put('socialProviderJobs',ttId,{id:ttId,jobId:'job',status:'failed',definitive:true});await tiktok.provider.publish({...tiktok.input,channel});assert.deepEqual(tiktok.calls,[['legacy.status','job']]);
});
