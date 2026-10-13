import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {Store} from './store.mjs';
import {createStudioService} from './studio-service.mjs';
import {createPublicationPackageService} from './publication-package.mjs';
import {createPostPerformanceService} from './post-performance.mjs';
import {createPublicationLinkCheckService} from './publication-link-check.mjs';

const BASE='2026-10-12T03:00:00.000Z',RESOURCE='https://example.test/guide';
const reached=url=>({status:'reachable',reason:'http-response',detail:'HTTP 응답만 확인했습니다.',httpStatus:200,finalUrl:url});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
function fixture(t,{probe}={}){
  const directory=mkdtempSync(join(tmpdir(),'synk-link-check-'));let store=new Store(directory),at=BASE,service,studio,packages,performance;const calls=[];
  const users={};for(const [name,role,teamId] of [['owner','member','a'],['peer','member','a'],['other','member','b'],['viewer','viewer','a'],['admin','admin',null]])users[name]=store.createUser({name,email:name+'@link-check.example',role,teamId});
  const channel={id:'channel',platform:'youtube',canonicalUrl:'https://www.youtube.com/@synk',handle:'synk',displayName:'SYNK',ownerIds:[users.owner.id],teamId:'a',active:true};store.put('channels',channel.id,channel);
  function services(){studio=createStudioService({store,clock:()=>at});packages=createPublicationPackageService({store,studio,clock:()=>at});performance=createPostPerformanceService({store,clock:()=>at,isConnected:()=>false,collector:async()=>{throw new Error('No external collection in tests');}});service=createPublicationLinkCheckService({store,studio,publicationPackages:packages,postPerformance:performance,clock:()=>at,probe:async(url,options)=>{calls.push(url);return probe?probe(url,options):reached(url);}});}services();
  t.after(async()=>{await service.stop();await packages.stop();store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.startsWith(join(tmpdir(),'synk-link-check-')));rmSync(directory,{recursive:true,force:true});});
  function addVersion(production){const media={id:randomUUID(),diskName:randomUUID()+'.mp4',mimeType:'video/mp4',fileName:'video.mp4',byteSize:100};production=studio.addMedia(users.owner,production.id,media,'최종 영상').production;return {production,media,version:production.versions.at(-1)};}
  function source(){return addVersion(studio.saveProduction(users.owner,{title:'자료 안내',stage:'ready'}).production);}
  function pack({origin=source(),link=RESOURCE,createdAt=at,channels=['youtube-shorts']}={}){const row={id:randomUUID(),productionId:origin.production.id,versionId:origin.version.id,state:'prepared',createdAt,title:'게시 묶음',body:'게시문',link,channels,source:{...origin.media,productionId:origin.production.id,sha256:'0'.repeat(64)},outputs:[]};store.put('studioPublicationPackages',row.id,row);return {row,...origin,target:{kind:'package',id:row.id}};}
  function post(input={}){const entry=performance.register(users.owner,{channelId:channel.id,url:'https://www.youtube.com/watch?v=abcdefghijk',publishedAt:BASE,title:'게시 기록',...input}).entry;return {entry,target:{kind:'post',id:entry.id}};}
  return {users,calls,channel,pack,post,source,addVersion,get service(){return service;},get store(){return store;},now(value){at=typeof value==='number'?new Date(Date.parse(BASE)+value).toISOString():value;},async restart(){await service.stop();await packages.stop();store.close();store=new Store(directory);services();}};
}

test('GET reads only saved targets with current permission, and absent resource links return null without side effects',async t=>{
  const f=fixture(t),p=f.pack(),none=f.pack({link:''}),post=f.post(),before=f.store.db.prepare('SELECT kind,id,body FROM documents ORDER BY kind,id').all();
  const check=f.service.get(f.users.owner,p.target).check;assert.equal(check.status,'unchecked');assert.equal(check.url,RESOURCE);assert.equal(check.revision,0);assert.equal(check.canCheck,true);assert.deepEqual(f.service.get(f.users.owner,none.target),{check:null});assert.equal(f.service.get(f.users.owner,post.target).check.url,post.entry.url);
  for(const target of [{...p.target,url:'https://injected.example/'},{kind:'url',id:RESOURCE},null,[]])assert.throws(()=>f.service.get(f.users.owner,target),{status:400});
  assert.throws(()=>f.service.get(f.users.other,p.target),{status:404});assert.deepEqual(f.store.db.prepare('SELECT kind,id,body FROM documents ORDER BY kind,id').all(),before);assert.deepEqual(f.calls,[]);
});

test('a stored response preserves URL, HTTP evidence and server time across restart; cooldown is separate from staleness',async t=>{
  const f=fixture(t),p=f.pack(),saved=(await f.service.check(f.users.owner,p.target)).check;assert.equal(saved.status,'reachable');assert.equal(saved.label,'HTTP 응답 확인');assert.equal(saved.checkedAt,BASE);assert.equal(saved.cooldownUntil,'2026-10-12T03:01:00.000Z');assert.equal(saved.nextCheckAt,'2026-10-12T09:00:00.000Z');assert.equal(saved.httpStatus,200);assert.equal(saved.finalUrl,RESOURCE);assert.equal(saved.revision,1);
  f.now(59999);assert.deepEqual((await f.service.check(f.users.owner,p.target)).check,saved);assert.equal(f.calls.length,1);await f.restart();assert.deepEqual(f.service.get(f.users.owner,p.target).check,saved);f.now(60000);assert.equal((await f.service.check(f.users.owner,p.target)).check.revision,2);assert.equal(f.calls.length,2);const row=f.store.all('publicationLinkChecks')[0];assert.equal(row.history.length,2);assert.equal(row.history[0].actorId,f.users.owner.id);assert.deepEqual(f.store.get('studioPublicationPackages',p.row.id),p.row);
});

test('same URL on another package and a changed saved URL do not inherit previous checks',async t=>{
  const f=fixture(t),p=f.pack();await f.service.check(f.users.owner,p.target);const sibling=f.pack({origin:p});assert.equal(f.service.get(f.users.owner,sibling.target).check.status,'unchecked');f.store.put('studioPublicationPackages',p.row.id,{...p.row,link:'https://example.test/new'});assert.equal(f.service.get(f.users.owner,p.target).check.status,'unchecked');await f.service.check(f.users.owner,p.target);assert.equal(f.store.all('publicationLinkChecks').length,2);assert.deepEqual(f.calls,[RESOURCE,'https://example.test/new']);
});

test('concurrent checks share one network job while every caller rechecks its own authorization',async t=>{
  const response=deferred(),f=fixture(t,{probe:()=>response.promise}),p=f.pack();let authorizations=0;
  const first=f.service.check(f.users.owner,p.target,{authorize:()=>{authorizations++;}}),second=f.service.check(f.users.admin,p.target);await Promise.resolve();assert.equal(f.calls.length,1);response.resolve(reached(RESOURCE));const [a,b]=await Promise.all([first,second]);assert.deepEqual(a,b);assert.equal(a.check.revision,1);assert.equal(f.store.all('publicationLinkChecks')[0].history.length,1);assert.equal(authorizations,3);
});

test('late responses are discarded after source URL changes, deletion, archiving or current account deactivation',async t=>{
  for(const mode of ['url','delete','archive','deactivate','role','scope']){
    const response=deferred(),f=fixture(t,{probe:()=>response.promise}),p=f.pack(),pending=f.service.check(f.users.owner,p.target);await Promise.resolve();
    if(mode==='url')f.store.put('studioPublicationPackages',p.row.id,{...p.row,link:'https://example.test/changed'});
    if(mode==='delete')f.store.remove('studioPublicationPackages',p.row.id);
    if(mode==='archive')f.store.put('studioProductions',p.production.id,{...p.production,stage:'archived'});
    if(mode==='deactivate')f.store.put('users',f.users.owner.id,{...f.users.owner,active:false});
    if(mode==='role')f.store.put('users',f.users.owner.id,{...f.users.owner,role:'viewer'});
    if(mode==='scope')f.store.put('studioProductions',p.production.id,{...p.production,ownerId:f.users.other.id,assigneeId:f.users.other.id,teamId:'b'});
    response.resolve(reached(RESOURCE));await assert.rejects(pending,error=>[401,403,404,409].includes(error.status),mode);assert.equal(f.store.all('publicationLinkChecks').length,0,mode);
  }
});

test('session authorization is checked again before persistence and failures do not save late results',async t=>{
  const response=deferred(),f=fixture(t,{probe:()=>response.promise}),p=f.pack();let allowed=true;
  const pending=f.service.check(f.users.owner,p.target,{authorize:()=>{if(!allowed)throw Object.assign(new Error('session expired'),{status:401});}});await Promise.resolve();allowed=false;response.resolve(reached(RESOURCE));await assert.rejects(pending,{status:401});assert.equal(f.store.all('publicationLinkChecks').length,0);
});

test('post checks follow current channel ownership and active state, including changes while the request is running',async t=>{
  const response=deferred(),f=fixture(t,{probe:()=>response.promise}),p=f.post();assert.equal(f.service.get(f.users.viewer,p.target).check.canCheck,false);await assert.rejects(f.service.check(f.users.viewer,p.target),{status:403});
  const pending=f.service.check(f.users.owner,p.target);await Promise.resolve();f.store.put('channels',f.channel.id,{...f.channel,ownerIds:[f.users.other.id],teamId:'b'});response.resolve(reached(p.entry.url));await assert.rejects(pending,{status:404});assert.equal(f.store.all('publicationLinkChecks').length,0);assert.throws(()=>f.service.get(f.users.owner,p.target),{status:404});assert.equal(f.service.get(f.users.other,p.target).check.canCheck,true);
  f.store.put('postPerformanceEntries',p.entry.id,{...p.entry,active:false});assert.throws(()=>f.service.get(f.users.other,p.target),{status:404});
});

test('source-read access alone never permits a probe, and stale caller roles cannot elevate current authority',async t=>{
  const f=fixture(t),p=f.pack();f.store.put('studioProductions',p.production.id,{...p.production,teamId:'a'});assert.equal(f.service.get(f.users.peer,p.target).check.canCheck,false);await assert.rejects(f.service.check(f.users.peer,p.target),{status:403});f.store.put('users',f.users.owner.id,{...f.users.owner,role:'viewer'});assert.equal(f.service.get({...f.users.owner,role:'admin'},p.target).check.canCheck,false);await assert.rejects(f.service.check({...f.users.owner,role:'admin'},p.target),{status:403});assert.equal(f.calls.length,0);
});

test('aborting a request or stopping the service discards even probes that ignore cancellation and drains pending work',async t=>{
  for(const mode of ['abort','stop']){
    const response=deferred(),f=fixture(t,{probe:()=>response.promise}),p=f.pack(),controller=new AbortController(),pending=f.service.check(f.users.owner,p.target,{signal:controller.signal});await Promise.resolve();const rejected=assert.rejects(pending,{status:499});if(mode==='abort')controller.abort();else await f.service.stop();await rejected;await f.service.waitForIdle();response.resolve(reached(RESOURCE));await Promise.resolve();assert.equal(f.store.all('publicationLinkChecks').length,0);if(mode==='stop'){await assert.rejects(f.service.check(f.users.owner,p.target),{status:503});assert.deepEqual(await f.service.scanDue(),{checked:0,skipped:0,failed:0});}
  }
});

test('unexpected probe errors expose only sanitized connection evidence and histories retain the latest 50 observations',async t=>{
  const f=fixture(t,{probe:()=>{throw new Error('secret-token internal-host');}}),p=f.pack();for(let i=0;i<52;i++){f.now(i*60000);await f.service.check(f.users.owner,p.target);}const check=f.service.get(f.users.owner,p.target).check;assert.equal(check.status,'error');assert.equal(check.reason,'connection-error');assert.ok(!JSON.stringify(check).includes('secret'));const row=f.store.all('publicationLinkChecks')[0];assert.equal(row.revision,52);assert.equal(row.history.length,50);assert.equal(row.history[0].revision,3);
});

test('automatic scans check only the newest package per format of the newest video and respect six-hour staleness',async t=>{
  const f=fixture(t),origin=f.source(),old=f.pack({origin,createdAt:'2026-10-12T00:00:00.000Z',link:'https://example.test/old'}),latest=f.pack({origin,createdAt:'2026-10-12T01:00:00.000Z',link:'https://example.test/latest'}),alternate=f.pack({origin,channels:['instagram-reels'],createdAt:'2026-10-12T01:00:00.000Z',link:'https://example.test/alternate'}),entry=f.post();
  let result=await f.service.scanDue();assert.equal(result.checked,3);assert.deepEqual(new Set(f.calls),new Set([latest.row.link,alternate.row.link,entry.entry.url]));assert.equal(f.service.get(f.users.owner,old.target).check.status,'unchecked');assert.equal((await f.service.scanDue()).checked,0);f.now(6*3600000);assert.equal((await f.service.scanDue()).checked,3);
  const next=f.addVersion(f.store.get('studioProductions',origin.production.id));const current=f.pack({origin:next,link:'https://example.test/new-video'});f.calls.length=0;result=await f.service.scanDue();assert.equal(result.checked,1);assert.deepEqual(f.calls,[current.row.link]);
});

test('a newer linkless package suppresses old resource checks, while inactive and unowned sources are skipped',async t=>{
  const f=fixture(t),origin=f.source();f.pack({origin,createdAt:'2026-10-12T00:00:00.000Z'});f.pack({origin,link:'',createdAt:'2026-10-12T01:00:00.000Z'});const archived=f.pack(),unowned=f.pack(),entry=f.post();f.store.put('studioProductions',archived.production.id,{...archived.production,stage:'archived'});f.store.put('studioProductions',unowned.production.id,{...unowned.production,ownerId:'deleted',assigneeId:'deleted'});f.store.put('postPerformanceEntries',entry.entry.id,{...entry.entry,active:false});assert.equal((await f.service.scanDue()).checked,0);assert.equal(f.calls.length,0);
});

test('scans coalesce, process sequentially with a ten-request ceiling, and retry remaining work next run',async t=>{
  const gate=deferred();let active=0,maxActive=0;const f=fixture(t,{probe:async url=>{active++;maxActive=Math.max(maxActive,active);await gate.promise;active--;return reached(url);}});for(let i=0;i<12;i++)f.pack({link:`https://example.test/${i}`});const first=f.service.scanDue(),second=f.service.scanDue();assert.equal(first,second);await Promise.resolve();assert.equal(f.calls.length,1);gate.resolve();assert.equal((await first).checked,10);assert.equal(maxActive,1);assert.equal((await f.service.scanDue()).checked,2);assert.equal(f.calls.length,12);
});

test('automatic scans resolve current owners instead of trusting saved assignment or the creator',async t=>{
  const f=fixture(t),p=f.pack(),entry=f.post();f.store.put('studioProductions',p.production.id,{...p.production,ownerId:f.users.other.id,assigneeId:f.users.other.id,teamId:'b'});f.store.put('channels',f.channel.id,{...f.channel,ownerIds:[f.users.other.id],teamId:'b'});f.store.put('users',f.users.owner.id,{...f.users.owner,active:false});const result=await f.service.scanDue();assert.equal(result.checked,2);assert.ok(f.store.all('publicationLinkChecks').every(row=>row.actorId===f.users.other.id));assert.equal(f.service.get(f.users.other,entry.target).check.status,'reachable');
});

function checkedPosts(f,count){
  const original=f.post().entry;f.store.remove('postPerformanceEntries',original.id);
  f.store.transaction(()=>{for(let i=0;i<count;i++){
    const id='synthetic-post-'+i,url='https://www.youtube.com/watch?v='+String(i).padStart(11,'0'),fingerprint=createHash('sha256').update(url).digest('hex');
    f.store.put('postPerformanceEntries',id,{...original,id,url});
    f.store.put('publicationLinkChecks',`post:${id}:${fingerprint}`,{id,kind:'post',url,fingerprint,status:'reachable',nextCheckAt:'2026-10-12T09:00:00.000Z'});
  }});
}

test('fresh post scans read the history once and never assemble analytics or decrypt channel credentials',async t=>{
  const f=fixture(t);checkedPosts(f,100);let postReads=0;
  const all=f.store.all.bind(f.store);f.store.all=kind=>{if(kind==='postPerformanceEntries')postReads++;return all(kind);};
  f.store.secret=()=>{throw Error('Link checks do not need credentials');};
  assert.deepEqual(await f.service.scanDue(),{checked:0,skipped:100,failed:0});
  assert.equal(postReads,1);assert.equal(f.calls.length,0);
});

test('fresh-only scans yield to requests and honor cancellation before the next batch',async t=>{
  const f=fixture(t);checkedPosts(f,60);const controller=new AbortController();
  const turn=new Promise(resolve=>setImmediate(()=>{controller.abort();resolve();}));
  const result=await f.service.scanDue({signal:controller.signal});await turn;
  assert.ok(result.skipped>0&&result.skipped<60);assert.equal(result.checked,0);assert.equal(f.calls.length,0);
  assert.equal((await f.service.scanDue()).skipped,60);
});

test('scheduled post checks recheck ownership after yielding between skipped batches',async t=>{
  const f=fixture(t);checkedPosts(f,26);
  const target=f.store.get('postPerformanceEntries','synthetic-post-25'),fingerprint=createHash('sha256').update(target.url).digest('hex');
  f.store.remove('publicationLinkChecks',`post:${target.id}:${fingerprint}`);
  const turn=new Promise(resolve=>setImmediate(()=>{f.store.put('channels',f.channel.id,{...f.channel,ownerIds:[f.users.other.id],teamId:'b'});resolve();}));
  const result=await f.service.scanDue();await turn;
  assert.deepEqual(result,{checked:0,skipped:26,failed:0});assert.equal(f.calls.length,0);
  assert.equal((await f.service.scanDue()).checked,1);assert.deepEqual(f.calls,[target.url]);
});
