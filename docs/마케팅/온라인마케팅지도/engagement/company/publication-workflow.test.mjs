import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Store} from './store.mjs';
import {createStudioService} from './studio-service.mjs';
import {createPublicationInboxService} from './publication-inbox.mjs';
import {createPublicationPackageService} from './publication-package.mjs';
import {createPostPerformanceService} from './post-performance.mjs';
import {createPublicationWorkflowService,publicationWorkflowHref} from './publication-workflow.mjs';

const BASE='2026-10-10T00:00:00.000Z';
const after=hours=>new Date(Date.parse(BASE)+hours*3600000).toISOString();
function fixture(t,{review}={}){
  const directory=mkdtempSync(join(tmpdir(),'synk-publication-workflow-'));let store=new Store(directory),at=BASE,studio,inbox,packages,performance,workflow;
  const users={};for(const [name,role,teamId]of [['owner','member','a'],['other','member','b'],['peer','member','a'],['manager','manager','a'],['admin','admin',null],['viewer','viewer','a']])users[name]=store.createUser({name,email:name+'@publication-workflow.example',role,teamId});
  const channels={};for(const [id,platform]of [['youtube','youtube'],['instagram','instagram'],['threads','threads']])channels[id]=store.put('channels',id,{id,platform,displayName:'합성 '+id,handle:'example',ownerIds:[users.owner.id],teamId:'a',active:true});
  function services(){
    studio=createStudioService({store,clock:()=>at});inbox=createPublicationInboxService({store,studio,enabled:true,clock:()=>at});packages=createPublicationPackageService({store,studio,clock:()=>at});
    performance=createPostPerformanceService({store,clock:()=>at,isConnected:()=>false,collector:async()=>{throw new Error('No collection may run during a workflow read.');}});
    workflow=createPublicationWorkflowService({store,studio,publicationInbox:inbox,publicationPackages:packages,publicationReview:review,postPerformance:performance,clock:()=>at});
  }services();
  t.after(async()=>{await Promise.all([inbox.stop(),packages.stop(),performance.stop()]);store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.startsWith(join(tmpdir(),'synk-publication-workflow-')));rmSync(directory,{recursive:true,force:true});});
  function source({user=users.owner,title='합성 확정본',formats=['youtube-shorts','instagram-reels']}={}){
    const created=studio.saveProduction(user,{title,stage:'ready'}).production,media={id:randomUUID(),productionId:created.id,diskName:randomUUID()+'.mp4',mimeType:'video/mp4',fileName:'video.mp4',byteSize:128,createdAt:at,createdById:user.id};
    const production=studio.addMedia(user,created.id,media,'확정본').production,version=production.versions.at(-1),id=randomUUID();
    const receipt={id,ownerId:user.id,title,status:'ready',productionId:production.id,versionId:version.id,createdAt:at,updatedAt:at,draft:{productionId:production.id,versionId:version.id,title,body:'PRIVATE-POST-BODY',subtitleText:'PRIVATE-SUBTITLE',channels:formats,mode:'adapt'}};
    store.put('publicationInboxEntries',user.id+':'+id,receipt);return {production,version,receipt,media,user,formats};
  }
  function pack(source,{formats=source.formats,id=randomUUID(),createdById=source.user.id}={}){
    const row={id,productionId:source.production.id,versionId:source.version.id,createdById,createdAt:at,title:source.production.title,body:'PRIVATE-PACKAGE-BODY',channels:formats,source:{...source.media,sha256:'0'.repeat(64)},outputs:[],state:'prepared',published:false};store.put('studioPublicationPackages',id,row);return row;
  }
  function register({packageId=null,channelId='youtube',publicationFormat,extra={}}={}){
    const url=channelId==='instagram'?'https://www.instagram.com/reel/ABC123/':channelId==='threads'?'https://www.threads.com/@example/post/ABC123':'https://www.youtube.com/shorts/abcdefghijk';
    const entry=performance.register(users.owner,{channelId,url,publishedAt:BASE,title:'합성 게시 기록',publicationPackageId:packageId,...extra}).entry;
    if(publicationFormat)store.put('postPerformanceEntries',entry.id,{...store.get('postPerformanceEntries',entry.id),publicationFormat});return entry;
  }
  const item=(user=users.owner)=>workflow.workspace(user).items;
  return {users,channels,source,pack,register,item,get store(){return store;},get studio(){return studio;},get inbox(){return inbox;},get packages(){return packages;},get workflow(){return workflow;},get performance(){return performance;},now(hours){at=after(hours);},async restart(){await Promise.all([inbox.stop(),packages.stop(),performance.stop()]);store.close();store=new Store(directory);services();}};
}

test('ready and duplicate deliveries project one private next action without writing tasks, including after restart',async t=>{
  const f=fixture(t),s=f.source(),duplicate={...s.receipt,id:randomUUID(),status:'duplicate',createdAt:after(1)};f.store.put('publicationInboxEntries',f.users.owner.id+':'+duplicate.id,duplicate);
  const before=f.store.db.prepare('SELECT kind,id,body FROM documents ORDER BY kind,id').all(),items=f.item();assert.equal(items.length,1);assert.equal(items[0].kind,'publication_prepare');assert.equal(items[0].group,'next');assert.equal(items[0].inboxId,s.receipt.id);
  assert.doesNotMatch(JSON.stringify(items),/PRIVATE-POST-BODY|PRIVATE-SUBTITLE|PRIVATE-PACKAGE-BODY|inboxPath/);assert.deepEqual(f.item(),items);assert.deepEqual(f.store.db.prepare('SELECT kind,id,body FROM documents ORDER BY kind,id').all(),before);
  await f.restart();assert.deepEqual(f.item(),items);assert.equal(f.store.all('messengerTasks').length,0);
});

test('partial channel packages retain only missing preparation and deduplicate repeated packages by version and format',t=>{
  const f=fixture(t),s=f.source(),first=f.pack(s,{formats:['youtube-shorts']});let items=f.item();assert.equal(items.length,2);assert.deepEqual(items.find(x=>x.kind==='publication_prepare').channelFormats,['instagram-reels']);const stable=items.find(x=>x.kind==='publication_publish').id;
  f.now(1);const latest=f.pack(s,{formats:['youtube-shorts']});items=f.item();assert.equal(items.filter(x=>x.kind==='publication_publish').length,1);assert.equal(items.find(x=>x.kind==='publication_publish').id,stable);assert.equal(items.find(x=>x.kind==='publication_publish').packageId,latest.id);
  f.pack(s,{formats:['instagram-reels']});items=f.item();assert.equal(items.length,2);assert.ok(items.every(x=>x.kind==='publication_publish'));
  f.register({packageId:first.id});items=f.item();assert.equal(items.length,1);assert.equal(items[0].publicationFormat,'instagram-reels');f.register({packageId:items[0].packageId,channelId:'instagram'});assert.equal(f.item().length,0);
});

test('two YouTube formats need an explicit posting format; an ambiguous legacy address never clears both',t=>{
  const f=fixture(t),s=f.source({formats:['youtube-shorts','youtube-video']}),p=f.pack(s),entry=f.register({packageId:p.id});let items=f.item();assert.equal(items.length,1);assert.equal(items[0].status,'format-required');assert.equal(items[0].entryId,entry.id);assert.deepEqual(items[0].channelFormats,['youtube-shorts','youtube-video']);
  f.store.put('postPerformanceEntries',entry.id,{...f.store.get('postPerformanceEntries',entry.id),publicationFormat:'youtube-shorts'});items=f.item();assert.equal(items.length,1);assert.equal(items[0].publicationFormat,'youtube-video');assert.equal(items[0].status,'publish');
  const videoOnly=f.pack(s,{formats:['youtube-video']});f.register({packageId:videoOnly.id,extra:{url:'https://www.youtube.com/watch?v=lmnopqrstuv'}});assert.equal(f.item().length,0);
});

test('every ambiguous legacy post repairs its original package and remaining new work uses the latest package',t=>{
  const f=fixture(t),s=f.source({formats:['youtube-shorts','youtube-video']}),first=f.pack(s),entryA=f.register({packageId:first.id});
  f.now(.5);const second=f.pack(s),entryB=f.register({packageId:second.id,extra:{url:'https://www.youtube.com/watch?v=lmnopqrstuv',title:'두 번째 기존 게시'}});
  f.now(1);const latest=f.pack(s);let repairs=f.item();assert.equal(repairs.length,2);assert.equal(new Set(repairs.map(row=>row.id)).size,2);
  for(const entry of [entryA,entryB]){
    const item=repairs.find(row=>row.entryId===entry.id),url=new URL(item.href,'https://workspace.example');assert.equal(url.searchParams.get('packageId'),entry.publicationPackageId);assert.equal(url.searchParams.has('publicationFormat'),false);assert.equal(url.searchParams.has('entryId'),false);assert.ok(item.text.includes(entry.url));
  }
  const before=structuredClone(f.store.get('postPerformanceEntries',entryA.id)),repairA=repairs.find(row=>row.entryId===entryA.id);
  const linkedA=f.performance.register(f.users.owner,{channelId:entryA.channelId,url:entryA.url,publishedAt:BASE,publicationPackageId:repairA.packageId,publicationFormat:'youtube-shorts'});assert.equal(linkedA.linked,true);assert.equal(linkedA.entry.publishedAt,before.publishedAt);assert.deepEqual(f.store.get('postPerformanceEntries',entryA.id).checkpoints,before.checkpoints);
  repairs=f.item();assert.equal(repairs.length,1);assert.equal(repairs[0].entryId,entryB.id);assert.equal(repairs[0].id,`publication:format:${entryB.id}`);
  f.performance.register(f.users.owner,{channelId:entryB.channelId,url:entryB.url,publishedAt:BASE,publicationPackageId:repairs[0].packageId,publicationFormat:'youtube-shorts'});
  const remaining=f.item();assert.equal(remaining.length,1);assert.equal(remaining[0].status,'publish');assert.equal(remaining[0].publicationFormat,'youtube-video');assert.equal(remaining[0].packageId,latest.id);
});

test('read-only legacy evidence suppresses duplicate publishing without assigning an impossible format repair',t=>{
  const f=fixture(t),s=f.source({formats:['youtube-shorts','youtube-video']}),p=f.pack(s);f.register({packageId:p.id});assert.equal(f.item()[0].status,'format-required');
  const readOnlyPerformance={list(user){const result=f.performance.list(user);return {...result,entries:result.entries.map(entry=>({...entry,canEdit:false}))};}};
  const workflow=createPublicationWorkflowService({store:f.store,studio:f.studio,publicationInbox:f.inbox,publicationPackages:f.packages,postPerformance:readOnlyPerformance,clock:()=>BASE});
  assert.deepEqual(workflow.workspace(f.users.owner).items,[],'readable ambiguous evidence still suppresses new publishing, but repair requires current write authority');
});

test('an invalid platform or format link cannot hide publication work',t=>{
  const f=fixture(t),s=f.source({formats:['youtube-shorts']}),p=f.pack(s),entry=f.register({packageId:p.id,channelId:'instagram'});assert.equal(f.item().length,1);
  f.store.put('postPerformanceEntries',entry.id,{...f.store.get('postPerformanceEntries',entry.id),platform:'youtube',publicationFormat:'youtube-video'});assert.equal(f.item().length,1);
  f.store.put('postPerformanceEntries',entry.id,{...f.store.get('postPerformanceEntries',entry.id),publicationPackageId:'missing',publicationFormat:'youtube-shorts'});assert.equal(f.item().length,1);
});

test('ready inbox remains actionable when watching is paused; errors and unsupported drafts do not become work',async t=>{
  const f=fixture(t),s=f.source();await f.inbox.configure(f.users.owner,{active:false});assert.equal(f.item().length,1);
  f.store.put('publicationInboxEntries',f.users.owner.id+':'+s.receipt.id,{...s.receipt,status:'error'});assert.equal(f.item().length,0);
  f.store.put('publicationInboxEntries',f.users.owner.id+':'+s.receipt.id,{...s.receipt,draft:{...s.receipt.draft,channels:['unsupported']}});assert.equal(f.item().length,0);
});

test('personal preparation excludes broadly readable coworkers and respects live studio authority',t=>{
  const f=fixture(t),s=f.source(),p=f.pack(s);f.store.put('studioProductions',s.production.id,{...f.store.get('studioProductions',s.production.id),teamId:'a'});
  for(const who of ['peer','manager','admin','viewer','other'])assert.equal(f.item(f.users[who]).length,0,who);
  const changed={...f.store.get('studioProductions',s.production.id),ownerId:f.users.other.id,assigneeId:f.users.other.id,teamId:'b'};f.store.put('studioProductions',s.production.id,changed);assert.equal(f.item().length,0);assert.equal(f.item(f.users.other).filter(x=>x.packageId===p.id).length,2);
  f.store.put('users',f.users.other.id,{...f.users.other,role:'viewer'});assert.equal(f.item({...f.users.other,role:'admin'}).length,0);
  f.store.put('users',f.users.owner.id,{...f.users.owner,active:false});assert.throws(()=>f.item(f.users.owner),{status:401});
});

test('removing a version, media, package or archived production removes only its affected work',t=>{
  const f=fixture(t),first=f.source({title:'A'}),second=f.source({title:'B'}),p=f.pack(first);assert.equal(f.item().length,3);
  const production=f.store.get('studioProductions',first.production.id);f.store.put('studioProductions',first.production.id,{...production,versions:[]});assert.equal(f.item().length,1);assert.equal(f.item()[0].productionId,second.production.id);
  f.store.put('studioProductions',first.production.id,production);f.store.remove('studioMedia',first.media.id);assert.equal(f.item().length,1);
  f.store.put('studioMedia',first.media.id,first.media);f.store.remove('studioPublicationPackages',p.id);assert.equal(f.item().length,2);assert.ok(f.item().every(x=>x.kind==='publication_prepare'));
  f.store.put('studioProductions',first.production.id,{...production,stage:'archived'});assert.equal(f.item().length,1);f.store.remove('studioProductions',second.production.id);assert.equal(f.item().length,0);
});

test('checkpoint timing projects due, failed, retry and missed work without starting collection',t=>{
  const f=fixture(t),entry=f.register();f.now(23.99);assert.equal(f.item().length,0);f.now(24);let item=f.item()[0];assert.equal(item.kind,'publication_performance');assert.equal(item.checkpointHours,24);assert.equal(item.group,'reply');
  const raw=f.store.get('postPerformanceEntries',entry.id),modify=status=>f.store.put('postPerformanceEntries',entry.id,{...raw,checkpoints:raw.checkpoints.map(c=>c.hours===24?{...c,status}:c)});
  modify('manual-required');assert.equal(f.item()[0].statusLabel,'직접 수치 보완');modify('retry');assert.equal(f.item()[0].status,'retry');modify('collecting');assert.equal(f.item().length,0);
  f.now(31);item=f.item()[0];assert.equal(item.status,'missed');assert.match(item.text,/현재 수치는 현재 확인 시각/);f.now(73);assert.deepEqual(f.item().map(x=>x.checkpointHours).sort(),[24,72]);assert.equal(f.store.get('postPerformanceEntries',entry.id).checkpoints[0].status,'collecting','projection never mutates collection state');
});

test('zero is a completed observation and optional unavailable metrics do not cause endless work',t=>{
  const f=fixture(t),entry=f.register();f.now(24);assert.equal(f.item().length,1);f.performance.manualCheckpoint(f.users.owner,entry.id,24,{metrics:{views:0}});assert.equal(f.item().length,0);
  const raw=f.store.get('postPerformanceEntries',entry.id);f.store.put('postPerformanceEntries',entry.id,{...raw,checkpoints:raw.checkpoints.map(c=>c.hours===24?{...c,metrics:{views:null,likes:null}}:c)});assert.equal(f.item().length,1,'a recorded marker without any numeric observation is still missing');
});

test('paused performance disappears, resumes from source state, and follows the actual channel owner',t=>{
  const f=fixture(t),entry=f.register();f.now(25);assert.equal(f.item().length,1);for(const who of ['peer','manager','admin','viewer','other'])assert.equal(f.item(f.users[who]).length,0,who);
  f.performance.setActive(f.users.owner,entry.id,false);assert.equal(f.item().length,0);f.performance.setActive(f.users.owner,entry.id,true);const originalId=f.item()[0].id;
  f.store.put('channels','youtube',{...f.channels.youtube,ownerIds:[f.users.other.id],teamId:'b'});assert.equal(f.item().length,0);assert.equal(f.item(f.users.other)[0].id,originalId);
  f.store.put('channels','youtube',{...f.channels.youtube,ownerIds:[f.users.other.id],active:false});assert.equal(f.item(f.users.other).length,0);
});

test('duplicate observations have one action and unrelated publication registration cannot clear own work',t=>{
  const f=fixture(t),s=f.source({formats:['youtube-shorts']}),p=f.pack(s),entry=f.register({packageId:p.id});f.now(24);const raw=f.store.get('postPerformanceEntries',entry.id),id='duplicate-observation';f.store.put('postPerformanceEntries',id,{...raw,id});assert.equal(f.item().length,1);
  f.store.put('channels','youtube',{...f.channels.youtube,ownerIds:[f.users.other.id],teamId:'b'});assert.equal(f.item().length,1);assert.equal(f.item()[0].kind,'publication_publish');assert.equal(f.item(f.users.other).length,1);
});

test('a currently readable colleague post closes publication work after channel ownership changes',t=>{
  const f=fixture(t),s=f.source({user:f.users.manager,formats:['youtube-shorts']}),p=f.pack(s);
  assert.equal(f.item(f.users.manager).length,1);const entry=f.register({packageId:p.id});assert.equal(f.item(f.users.manager).length,0,'a manager can see a colleague post without being its channel owner');
  f.now(24);assert.equal(f.item(f.users.manager).length,0,'measurement follow-up remains personal to channel owners');assert.equal(f.item(f.users.owner)[0].entryId,entry.id);
  f.store.put('channels','youtube',{...f.channels.youtube,ownerIds:[f.users.peer.id]});assert.equal(f.item(f.users.manager).length,0,'read access and a matching post remain valid after owner reassignment');assert.equal(f.item(f.users.owner).length,0);assert.equal(f.item(f.users.peer)[0].entryId,entry.id);
});

test('a successful observation closes an older duplicate checkpoint without confusing another account',t=>{
  const f=fixture(t),entry=f.register();f.now(24);const raw=f.store.get('postPerformanceEntries',entry.id),id='duplicate-pending';f.store.put('postPerformanceEntries',id,{...raw,id});assert.equal(f.item().length,1);
  f.performance.manualCheckpoint(f.users.owner,entry.id,24,{metrics:{views:0}});assert.equal(f.item().length,0,'the known result also resolves a stale duplicate of the same account and post');
  f.store.put('channels','other-youtube',{...f.channels.youtube,id:'other-youtube'});f.store.put('postPerformanceEntries',id,{...raw,id,channelId:'other-youtube'});assert.equal(f.item().length,1,'different account observations remain independent');
});

test('deep links contain only supported source identifiers and never use user supplied target URLs',t=>{
  const f=fixture(t),s=f.source({title:'https://evil.example/?secret=body'});let row=f.item()[0],url=new URL(row.href,'https://workroom.example');assert.equal(url.origin,'https://workroom.example');assert.equal(url.searchParams.get('publicationAction'),'prepare');assert.equal(url.searchParams.get('inboxId'),s.receipt.id);assert.equal(url.searchParams.has('title'),false);
  const p=f.pack(s);row=f.item()[0];url=new URL(row.href,'https://workroom.example');assert.equal(url.searchParams.get('packageId'),p.id);assert.equal(url.searchParams.get('publicationFormat'),row.publicationFormat);assert.deepEqual([...url.searchParams.keys()],['tab','section','tool','publicationAction','packageId','publicationFormat']);
  const entry=f.register({packageId:p.id});f.now(24);row=f.item().find(x=>x.kind==='publication_performance');url=new URL(row.href,'https://workroom.example');assert.equal(url.searchParams.get('entryId'),entry.id);assert.equal(url.searchParams.get('checkpoint'),'24h');assert.throws(()=>publicationWorkflowHref('https://evil.example'),{status:400});
});

test('one review task replaces duplicate channel tasks and returns to publish after explicit checks',t=>{
  let status='pending';const review={get(_user,packageId){return {review:{packageId,summary:{status,needsWorkCount:status==='needs-work'?1:0}}};}};
  const f=fixture(t,{review}),s=f.source(),p=f.pack(s),before=f.store.all('studioPublicationPackages');
  let items=f.item();assert.equal(items.length,1);assert.equal(items[0].kind,'publication_review');assert.deepEqual(items[0].channelFormats,['youtube-shorts','instagram-reels']);
  const href=new URL(items[0].href,'http://localhost');assert.equal(href.searchParams.get('publicationAction'),'review');assert.equal(href.searchParams.get('packageId'),p.id);
  status='needs-work';assert.equal(f.item()[0].status,'needs-work');status='complete';items=f.item();assert.equal(items.length,2);assert.ok(items.every(row=>row.kind==='publication_publish'));
  status='pending';assert.equal(f.item().length,1);assert.equal(f.item()[0].kind,'publication_review');assert.deepEqual(f.store.all('studioPublicationPackages'),before);assert.equal(f.store.all('messengerTasks').length,0);
});

test('new copy packages get their own review and already published channels do not reopen',t=>{
  const completed=new Set(),review={get(_user,id){return {review:{summary:{status:completed.has(id)?'complete':'pending',needsWorkCount:0}}};}};
  const f=fixture(t,{review}),s=f.source(),first=f.pack(s);completed.add(first.id);assert.equal(f.item().length,2);
  f.now(1);const next=f.pack(s);let items=f.item();assert.equal(items.length,1);assert.equal(items[0].packageId,next.id);assert.equal(items[0].kind,'publication_review');
  f.register({packageId:first.id});items=f.item();assert.equal(items.length,1);assert.deepEqual(items[0].channelFormats,['instagram-reels']);
  f.register({packageId:next.id,channelId:'instagram'});assert.equal(f.item().length,0);
});

test('uploading a new video exposes its preparation and retires old version next actions',t=>{
  const review={get(){return {review:{summary:{status:'pending',needsWorkCount:0}}};}},f=fixture(t,{review}),s=f.source(),old=f.pack(s);
  assert.equal(f.item()[0].packageId,old.id);f.now(1);
  const media={...s.media,id:randomUUID(),diskName:randomUUID()+'.mp4',createdAt:after(1)},production=f.studio.addMedia(f.users.owner,s.production.id,media,'새 완성본').production,version=production.versions.at(-1);
  let items=f.item();assert.equal(items.length,1);assert.equal(items[0].kind,'publication_prepare');assert.equal(items[0].versionId,version.id);
  const url=new URL(items[0].href,'http://localhost');assert.equal(url.searchParams.get('productionId'),production.id);assert.equal(url.searchParams.get('versionId'),version.id);assert.equal(url.searchParams.has('inboxId'),false);
  const next=f.pack({...s,production,version,media});items=f.item();assert.equal(items.length,1);assert.equal(items[0].packageId,next.id);assert.equal(items[0].kind,'publication_review');assert.ok(f.store.get('studioPublicationPackages',old.id));
});

test('review work uses latest applicable package per format and current personal authority',t=>{
  const review={get(){return {review:{summary:{status:'pending',needsWorkCount:0}}};}},f=fixture(t,{review}),s=f.source(),old=f.pack(s);
  f.now(1);const next=f.pack(s,{formats:['youtube-shorts']});const items=f.item();assert.equal(items.length,2);assert.deepEqual(items.find(row=>row.packageId===next.id).channelFormats,['youtube-shorts']);assert.deepEqual(items.find(row=>row.packageId===old.id).channelFormats,['instagram-reels']);
  for(const who of ['other','viewer','manager','admin'])assert.equal(f.item(f.users[who]).length,0,who);
  const production=f.store.get('studioProductions',s.production.id);f.store.put('studioProductions',production.id,{...production,ownerId:f.users.other.id,assigneeId:f.users.other.id,teamId:'b'});assert.equal(f.item().length,0);assert.equal(f.item(f.users.other).length,2);
});
