import test from 'node:test';
import assert from 'node:assert/strict';
import {createAutomationHealthService} from './automation-health.mjs';

const NOW='2026-10-12T03:00:00.000Z',BEFORE='2026-10-12T02:00:00.000Z',FUTURE='2026-10-13T03:00:00.000Z';
const card=(result,id)=>result.cards.find(row=>row.id===id);
function fixture(overrides={}){
  const data={users:[{id:'owner',active:true,role:'member',teamId:'one'},{id:'peer',active:true,role:'member',teamId:'one'},{id:'admin',active:true,role:'admin'},{id:'viewer',active:true,role:'viewer'}],channels:[{id:'channel',platform:'youtube',active:true,teamId:'one',ownerIds:['owner']}],studioProductions:[],studioPublicationPackages:[]};
  const store={get:(kind,id)=>(data[kind]||[]).find(row=>row.id===id),all:kind=>data[kind]||[],put(){throw new Error('Read must not write');},secret(){throw new Error('Read must not inspect secrets');}};
  const state={at:NOW,runtime:Object.fromEntries(['performance','inbox','links','weekly'].map(id=>[id,{enabled:true,running:false,startAt:NOW,lastAttemptAt:NOW,lastSuccessAt:NOW,lastErrorAt:null,intervalMs:MINUTE}])),performance:{entries:[],channels:[{id:'channel',connected:true,canEdit:true}]},inbox:{available:true,active:true,entries:[],lastScanAt:NOW,message:null},workflow:[],learning:[],projects:[],clients:[],checks:{},weekly:{period:{startDate:'2026-10-05',endAt:'2026-10-11T15:00:00.000Z'},generatedAt:NOW,sections:[],schedule:{nextRunAt:'2026-10-18T15:00:00.000Z'}}};
  const services={store,clock:()=>state.at,runtime:()=>state.runtime,
    studio:{production(user,id){const production=store.get('studioProductions',id);if(!production||production.ownerId!==user.id&&production.assigneeId!==user.id)throw Object.assign(new Error('hidden'),{status:404});return {production};}},
    publicationPackages:{get(user,id){const pack=store.get('studioPublicationPackages',id);services.studio.production(user,pack?.productionId);return {package:pack};}},
    publicationInbox:{state:()=>state.inbox},postPerformance:{list:()=>state.performance},publicationWorkflow:{workspace:()=>({items:state.workflow})},publicationLearning:{workspace:()=>({cards:state.learning})},clientProjects:{workspace:()=>({projects:state.projects})},clientWorkflow:{workspace:()=>({items:state.clients})},publicationLinks:{get:(user,target)=>({check:state.checks[target.kind+':'+target.id]||{status:'unchecked',canCheck:true,checkedAt:null,nextCheckAt:null}})},weeklySummary:{get:()=>state.weekly},...overrides};
  const service=createAutomationHealthService(services);
  function post(extra={}){const row={id:'post-'+state.performance.entries.length,title:'내 게시물',channelId:'channel',platform:'youtube',active:true,canEdit:true,createdBy:'owner',createdAt:NOW,checkpoints:[{hours:24,status:'pending',dueAt:BEFORE,closesAt:'2026-10-12T08:00:00.000Z',metrics:{views:null}}],...extra};state.performance.entries.push(row);return row;}
  function production(extra={}){const row={id:'production-'+data.studioProductions.length,ownerId:'owner',title:'내 완성본',stage:'ready',versions:[{id:'version',kind:'video',mediaId:'media'}],...extra};data.studioProductions.push(row);return row;}
  function pack(source,extra={}){const row={id:'package-'+data.studioPublicationPackages.length,productionId:source.id,versionId:'version',state:'prepared',channels:['youtube-shorts'],createdAt:BEFORE,title:'내 묶음',link:'https://example.invalid/tool',body:'PRIVATE-BODY',...extra};data.studioPublicationPackages.push(row);return row;}
  return {state,data,store,services,service,post,production,pack,get(user='owner'){return service.get(store.get('users',user));}};
}
const MINUTE=60000;

test('seventeen source cards are read-only; no targets is idle even after a runner failure',()=>{
  const f=fixture();f.state.weekly={};for(const state of Object.values(f.state.runtime))state.lastErrorAt='2026-10-12T02:30:00Z',state.lastSuccessAt=null;
  const before=JSON.stringify(f.data),result=f.get();assert.equal(result.cards.length,17);assert.equal(result.issues.length,0);assert.equal(result.counts.partial,0);assert.ok(result.cards.every(row=>row.status==='idle'));assert.equal(JSON.stringify(f.data),before);
});

test('current user and personal ownership exclude viewer, peers, administrator breadth and revoked access',()=>{
  const f=fixture(),source=f.production(),p=f.pack(source);f.post();assert.equal(card(f.get(),'package').counts.targets,1);assert.equal(card(f.get(),'performance').counts.targets,1);
  for(const user of ['peer','admin','viewer']){const result=f.get(user);assert.equal(card(result,'package').counts.targets,0);assert.equal(card(result,'performance').counts.targets,0);assert.equal(result.issues.length,0);}
  source.ownerId='peer';f.data.channels[0].ownerIds=['peer'];const result=f.get();assert.equal(card(result,'package').counts.targets,0);assert.equal(card(result,'performance').counts.targets,0);assert.ok(!JSON.stringify(result).includes(p.id));
  f.data.users[0].active=false;assert.throws(()=>f.get(),{status:401});assert.throws(()=>f.service.get(null),{status:401});
});

test('archived, hidden, inactive and superseded sources cannot create alarms',()=>{
  const f=fixture();f.pack(f.production({stage:'archived'}));f.pack(f.production({hidden:true}));const source=f.production({versions:[{id:'older',kind:'video',mediaId:'media'},{id:'latest',kind:'video',mediaId:'media2'}]});f.pack(source,{versionId:'older'});
  f.post({hidden:true});f.post({active:false});const result=f.get();assert.equal(card(result,'package').counts.targets,0);assert.equal(card(result,'performance').counts.targets,0);assert.equal(card(result,'performance').counts.paused,1);assert.equal(result.issues.length,0);
});

test('future checkpoints wait, slight delay has grace, actual missing observation is delayed',()=>{
  const f=fixture(),post=f.post({checkpoints:[{hours:24,status:'pending',dueAt:FUTURE,closesAt:'2026-10-13T09:00:00Z'}]});let result=f.get();assert.equal(result.issues.length,0);assert.equal(card(result,'performance').nextDueAt,FUTURE);
  post.checkpoints[0]={hours:24,status:'pending',dueAt:'2026-10-12T02:59:00Z',closesAt:'2026-10-12T08:59:00Z'};assert.equal(f.get().issues.length,0);
  post.checkpoints[0].dueAt=BEFORE;result=f.get();assert.equal(result.issues.filter(row=>row.automationId==='performance')[0].status,'delayed');assert.equal(card(result,'performance').status,'delayed');
});

test('collector stale warning uses completed runs after each due time and deduplicates affected entries',()=>{
  const f=fixture(),first=f.post(),second=f.post({checkpoints:[{hours:24,status:'pending',dueAt:'2026-10-12T02:45:00Z',closesAt:'2026-10-12T08:45:00Z'}]});
  first.checkpoints.push({hours:72,status:'retry',dueAt:'2026-10-12T02:30:00Z',closesAt:'2026-10-12T08:30:00Z',nextAttemptAt:FUTURE});
  f.state.runtime.performance.lastSuccessAt='2026-10-12T01:00:00Z';
  const warning=()=>f.get().issues.find(row=>row.code==='post-performance-collector-stale');
  let issue=warning();assert.equal(issue.id,'performance:collector-stale:current');assert.equal(issue.since,BEFORE);assert.deepEqual(issue.affectedEntries,[first.id,second.id]);assert.equal(issue.status,'delayed');
  assert.equal(f.state.runtime.performance.lastAttemptAt,NOW,'a recent attempt does not prove a completed run');
  f.state.runtime.performance.lastSuccessAt='2026-10-12T02:15:00Z';assert.equal(warning().since,'2026-10-12T02:30:00.000Z');
  f.state.runtime.performance.lastSuccessAt='2026-10-12T02:40:00Z';assert.deepEqual(warning().affectedEntries,[second.id]);
  f.state.runtime.performance.lastSuccessAt=NOW;assert.equal(warning(),undefined);assert.ok(f.get().observedIssueIds.includes(issue.id));
});

test('collector stale warning covers absent or invalid success times only after a checkpoint is due',()=>{
  const f=fixture(),post=f.post({checkpoints:[{hours:24,status:'pending',dueAt:NOW,closesAt:FUTURE}]});f.state.runtime.performance.lastSuccessAt=null;
  const warning=()=>f.get().issues.find(row=>row.code==='post-performance-collector-stale');
  assert.equal(warning(),undefined);f.state.at='2026-10-12T03:00:01.000Z';assert.equal(warning().since,NOW);
  f.state.runtime.performance.lastSuccessAt=NOW;assert.equal(warning(),undefined,'a run completing at the due time is current');
  for(const at of ['not-a-time',FUTURE]){f.state.runtime.performance.lastSuccessAt=at;assert.ok(warning());}
  post.checkpoints[0].status='missed';post.checkpoints[0].closesAt=NOW;assert.ok(warning(),'a missed window remains visible until the collector runs again');
  post.checkpoints[0]={...post.checkpoints[0],status:'recorded',metrics:{views:0},recordedAt:NOW};assert.equal(warning(),undefined);assert.ok(f.get().observedIssueIds.includes('performance:collector-stale:current'));
});

test('collector stale warning preserves current ownership and excludes paused, disconnected and manual work',()=>{
  const f=fixture(),post=f.post();f.state.runtime.performance.lastSuccessAt=null;
  const warning=(user='owner')=>f.get(user).issues.find(row=>row.code==='post-performance-collector-stale');
  assert.ok(warning());for(const user of ['peer','admin','viewer'])assert.equal(warning(user),undefined);
  for(const [target,key,value]of [[f.state.runtime.performance,'enabled',false],[f.data.channels[0],'collectionDisabled',true],[f.state.performance.channels[0],'connected',false],[post,'hidden',true],[post,'active',false],[post,'canEdit',false],[f.data.channels[0],'ownerIds',['peer']],[post,'createdBy','missing'],[post.checkpoints[0],'status','manual-required']]){
    const previous=target[key];target[key]=value;const result=f.get();assert.equal(result.issues.some(row=>row.code==='post-performance-collector-stale'),false,key);if(key!=='status')assert.equal(result.observedIssueIds.includes('performance:collector-stale:current'),false,key);target[key]=previous;
  }
  post.platform='threads';f.data.channels[0].platform='threads';assert.equal(warning(),undefined);
});

test('real zero is recorded and does not become missing; null remains unmeasured',()=>{
  const f=fixture(),post=f.post();post.checkpoints[0]={...post.checkpoints[0],status:'recorded',metrics:{views:0},recordedAt:BEFORE};let result=f.get();assert.equal(result.issues.length,0);assert.equal(card(result,'performance').lastResultAt,BEFORE);
  post.checkpoints[0].metrics={views:null};assert.equal(f.get().issues.filter(row=>row.automationId==='performance').length,1);
});

test('collecting leases do not hide a stuck collection; retry, connection and missed window are distinct',()=>{
  const f=fixture(),post=f.post(),cp=post.checkpoints[0];cp.status='collecting';cp.attemptedAt='2026-10-12T02:59:00Z';assert.equal(card(f.get(),'performance').status,'running');
  cp.attemptedAt=BEFORE;assert.equal(f.get().issues[0].status,'delayed');
  cp.status='retry';cp.nextAttemptAt='2026-10-12T03:10:00Z';assert.equal(f.get().issues[0].status,'failed');assert.equal(card(f.get(),'performance').nextDueAt,'2026-10-12T03:10:00.000Z');
  f.state.performance.channels[0].connected=false;assert.equal(f.get().issues[0].status,'connection');
  cp.closesAt='2026-10-12T02:59:59Z';assert.equal(f.get().issues[0].status,'missed');
});

test('manual-only platform and manual confirmation are not automated failure',()=>{
  const f=fixture(),post=f.post({platform:'threads'});f.data.channels[0].platform='threads';f.state.performance.channels[0].connected=false;
  let result=f.get();assert.equal(result.issues.length,0);assert.equal(result.manual.length,1);assert.equal(card(result,'performance').status,'manual');
  post.platform='youtube';f.data.channels[0].platform='youtube';f.state.performance.channels[0].connected=true;post.checkpoints[0].status='manual-required';result=f.get();assert.equal(result.issues.length,0);assert.equal(result.manual[0].statusLabel,'직접 수치 보완');
});

test('intentional entry, channel and server pause does not raise missing collection alarms',()=>{
  const f=fixture(),post=f.post();post.checkpoints[0].closesAt=BEFORE;f.state.runtime.performance.enabled=false;assert.equal(card(f.get(),'performance').status,'paused');assert.equal(f.get().issues.length,0);
  f.state.runtime.performance.enabled=true;f.data.channels[0].collectionDisabled=true;assert.equal(f.get().issues.length,0);assert.equal(card(f.get(),'performance').status,'paused');
  post.active=false;assert.equal(f.get().issues.length,0);assert.equal(card(f.get(),'performance').status,'paused');
});

test('stale registration owner produces connection action without provider data or identities',()=>{
  const f=fixture(),post=f.post({createdBy:'gone'});post.checkpoints[0].message='PRIVATE-PROVIDER-TOKEN';const result=f.get();assert.equal(result.issues[0].status,'connection');assert.doesNotMatch(JSON.stringify(result),/PRIVATE-|gone/);
});

test('inbox failure has stable source key and does not mistake lastScanAt for successful import',()=>{
  const f=fixture();f.state.inbox.entries=[{id:'receipt',status:'error',title:'전달 파일',updatedAt:BEFORE,message:'C:\\PRIVATE\\secret.mp4'}];f.state.inbox.lastScanAt=NOW;let result=f.get();assert.equal(result.issues[0].id,'inbox:import:receipt');assert.equal(card(result,'inbox').lastResultAt,null);assert.doesNotMatch(JSON.stringify(result),/PRIVATE|secret.mp4/);
  f.state.inbox.active=false;result=f.get();assert.equal(result.issues.length,0);assert.equal(card(result,'inbox').status,'paused');assert.ok(!result.observedIssueIds.includes('inbox:import:receipt'));
});

test('manual prepare, publish, review and overdue contact use source links without copied bodies',()=>{
  const f=fixture(),source=f.production(),pack=f.pack(source);f.state.workflow=[{id:'prepare',kind:'publication_prepare',productionId:source.id,versionId:'version',title:'완성본',href:'https://malicious.invalid/'},{id:'review',kind:'publication_review',productionId:source.id,packageId:pack.id,status:'needs-work',title:'게시 점검'}];
  f.state.projects=[{id:'project',ownerId:'owner',title:'고객 프로젝트',nextContactDate:'2026-10-11',nextStep:'PRIVATE-NOTE',followUpHistory:[]}];
  const result=f.get();assert.equal(result.issues.length,0);assert.equal(result.manual.length,3);assert.equal(card(result,'review').status,'manual');assert.equal(card(result,'client').status,'manual');assert.match(result.manual.find(row=>row.automationId==='client').href,/project=project&followUp=1/);assert.doesNotMatch(JSON.stringify(result),/PRIVATE|malicious/);
});

test('future client contact is scheduled by date without claiming a cron or auto-send',()=>{
  const f=fixture();f.state.projects=[{id:'p',ownerId:'owner',title:'연락',nextContactDate:'2026-10-14',followUpHistory:[{at:BEFORE,note:'PRIVATE-NOTE'}]}];const result=f.get(),c=card(result,'client');assert.equal(c.mode,'manual');assert.equal(c.nextDueAt,'2026-10-13T15:00:00.000Z');assert.equal(c.nextRunAt,null);assert.equal(c.lastResultAt,BEFORE);assert.equal(result.issues.length,0);assert.equal(result.manual.length,0);
});

test('limited learning sample is informational and filters broad readable entries',()=>{
  const f=fixture(),post=f.post({checkpoints:[]});f.state.learning=[{entryId:post.id,status:'limited',facts:[{value:0}]},{entryId:'other',status:'ready'}];const result=f.get();assert.equal(card(result,'learning').counts.targets,1);assert.equal(card(result,'learning').status,'ready');assert.equal(result.issues.length,0);
});

test('link HTTP errors differ from access-limited manual checks and duplicate packages collapse',()=>{
  const f=fixture(),source=f.production(),pack=f.pack(source);f.pack(source,{id:'duplicate',createdAt:'2026-10-11T01:00:00Z'});f.state.checks['package:'+pack.id]={status:'error',canCheck:true,checkedAt:BEFORE,nextCheckAt:FUTURE,detail:'PRIVATE-URL'};
  let result=f.get();assert.equal(card(result,'links').counts.targets,1);assert.equal(result.issues[0].id,'links:response:package:'+pack.id);assert.doesNotMatch(JSON.stringify(result),/PRIVATE-URL/);
  f.state.checks['package:'+pack.id].status='manual-required';result=f.get();assert.equal(result.issues.length,0);assert.equal(result.manual.length,1);assert.equal(card(result,'links').status,'manual');
});

test('links use due-time grace and current-run startup grace before late alarms',()=>{
  const f=fixture(),pack=f.pack(f.production());f.state.checks['package:'+pack.id]={status:'reachable',canCheck:true,checkedAt:BEFORE,nextCheckAt:'2026-10-12T02:59:00Z'};assert.equal(f.get().issues.length,0);
  f.state.checks['package:'+pack.id].nextCheckAt=BEFORE;assert.equal(f.get().issues[0].kind,'late');
  delete f.state.checks['package:'+pack.id];assert.equal(f.get().issues.length,0);f.state.runtime.links.startAt='2026-10-11T03:00:00Z';assert.equal(f.get().issues[0].kind,'late');
});

test('a failed whole runner with targets is different from latest individual result',()=>{
  const f=fixture(),pack=f.pack(f.production());f.state.checks['package:'+pack.id]={status:'reachable',canCheck:true,checkedAt:BEFORE,nextCheckAt:'2026-10-12T02:59:00Z'};f.state.runtime.links.lastSuccessAt='2026-10-12T01:00:00Z';f.state.runtime.links.lastErrorAt='2026-10-12T02:30:00Z';let result=f.get();assert.equal(result.issues[0].kind,'runner');assert.equal(card(result,'links').lastResultAt,BEFORE);assert.equal(card(result,'links').lastSuccessAt,'2026-10-12T01:00:00.000Z');
  f.state.runtime.links.lastSuccessAt=NOW;result=f.get();assert.equal(result.issues.length,0);assert.ok(result.observedIssueIds.includes('links:runner:current'));
});

test('missing weekly metadata has startup grace; weekly partial is not an empty successful report',()=>{
  const f=fixture();f.state.weekly.generatedAt=null;assert.equal(f.get().issues.length,0);f.state.runtime.weekly.startAt=BEFORE;assert.equal(f.get().issues[0].id,'weekly:missing:2026-10-05');
  f.state.weekly.sections=[{id:'performance',status:'partial'}];assert.equal(card(f.get(),'weekly').status,'partial');f.state.runtime.weekly.enabled=false;assert.equal(f.get().issues.length,0);
});

test('individual source read failures preserve other cards and expose only a partial marker',()=>{
  const f=fixture({publicationLearning:{workspace(){throw new Error('PRIVATE-ERROR');}}});f.post({checkpoints:[]});const result=f.get();assert.equal(card(result,'learning').status,'partial');assert.equal(card(result,'performance').status,'ready');assert.equal(result.counts.partial,1);assert.doesNotMatch(JSON.stringify(result),/PRIVATE-ERROR/);
});

test('observed keys identify actual recovery, while removal or permission loss cannot imply success',()=>{
  const f=fixture(),post=f.post(),id='performance:late:'+post.id+':24';assert.ok(f.get().issues.some(row=>row.id===id));post.checkpoints[0]={...post.checkpoints[0],status:'recorded',metrics:{views:0},recordedAt:NOW};let result=f.get();assert.ok(!result.issues.some(row=>row.id===id));assert.ok(result.observedIssueIds.includes(id));
  f.data.channels[0].ownerIds=['peer'];result=f.get();assert.ok(!result.observedIssueIds.includes(id));assert.ok(!JSON.stringify(result).includes(post.id));
});

test('viewer never invokes sources or exposes global runner metadata',()=>{
  const f=fixture({runtime(){throw new Error('must not run');},weeklySummary:{get(){throw new Error('must not run');}}});const result=f.get('viewer');assert.equal(result.counts.partial,0);assert.ok(result.cards.every(row=>row.status==='idle'&&row.lastAttemptAt===null));
});

test('inbox scans include older failed receipts beyond the screen limit but exclude revoked and hidden sources',()=>{
  const f=fixture(),source=f.production();f.data.publicationInboxEntries=[{id:'old-error',ownerId:'owner',status:'error',title:'오래된 전달',createdAt:BEFORE},{id:'other-error',ownerId:'peer',status:'error'},{id:'hidden-error',ownerId:'owner',hidden:true,status:'error'},{id:'revoked-error',ownerId:'owner',productionId:source.id,status:'error'}];
  source.ownerId='peer';let result=f.get();assert.deepEqual(result.issues.map(row=>row.id),['inbox:import:old-error']);
  f.state.runtime.inbox.enabled=false;result=f.get();assert.equal(result.issues.length,0);assert.equal(card(result,'inbox').status,'paused');
});

test('malformed responses are partial without mutating the source response',()=>{
  const malformed=Object.freeze({entries:'broken',channels:null}),f=fixture({postPerformance:{list:()=>malformed}}),result=f.get();assert.equal(card(result,'performance').status,'partial');assert.equal(card(result,'learning').status,'partial');assert.deepEqual(malformed,{entries:'broken',channels:null});
});

test('unknown runtime state never claims scheduled success and delayed next check retains its real due timestamp',()=>{
  const f=fixture(),post=f.post();f.state.runtime.performance={};let result=f.get();assert.equal(card(result,'performance').status,'partial');assert.equal(card(result,'performance').lastSuccessAt,null);
  f.state.runtime.performance={enabled:true,lastAttemptAt:BEFORE,intervalMs:MINUTE,running:false};result=f.get();assert.equal(card(result,'performance').nextRunAt,'2026-10-12T02:01:00.000Z');assert.ok(result.issues.some(row=>row.id==='performance:runner-late:current'));assert.ok(post);
});

test('historical completed sources do not turn old global runner failures into personal alarms',()=>{
  const f=fixture(),post=f.post();post.checkpoints[0]={...post.checkpoints[0],status:'recorded',metrics:{views:0},recordedAt:BEFORE};
  f.state.inbox.entries=[{id:'ready',status:'ready',createdAt:BEFORE}];const pack=f.pack(f.production());f.state.checks['package:'+pack.id]={status:'reachable',canCheck:true,checkedAt:BEFORE,nextCheckAt:FUTURE};f.state.checks['post:'+post.id]={status:'reachable',canCheck:true,checkedAt:BEFORE,nextCheckAt:FUTURE};
  for(const runtime of Object.values(f.state.runtime)){runtime.lastAttemptAt=BEFORE;runtime.lastSuccessAt=null;runtime.lastErrorAt=BEFORE;runtime.startAt=BEFORE;}
  const result=f.get();assert.equal(result.issues.length,0);assert.equal(card(result,'performance').status,'ready');assert.ok(!result.observedIssueIds.includes('performance:runner:current'));assert.equal(card(result,'weekly').status,'scheduled');
});

test('paused link scanning does not reissue historical HTTP failures or mark them resolved',()=>{
  const f=fixture(),pack=f.pack(f.production());f.state.checks['package:'+pack.id]={status:'error',canCheck:true,checkedAt:BEFORE,nextCheckAt:BEFORE};let result=f.get();const id='links:response:package:'+pack.id;assert.ok(result.issues.some(row=>row.id===id));
  f.state.runtime.links.enabled=false;result=f.get();assert.equal(result.issues.length,0);assert.equal(card(result,'links').status,'paused');assert.ok(!result.observedIssueIds.includes(id));
});
