// creative-research-sync-interval.test.mjs covers the ten-minute check and the 1-2-4-8 minute retry cadence on their own.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {Store} from './store.mjs';
import {createCreativeResearchService} from './creative-research.mjs';
import {createCreativeResearchSyncService,normalizeCreativeResearchDocumentId,parseCompletedCreativeResearch,CREATIVE_RESEARCH_COMPLETE} from './creative-research-sync.mjs';

const initialAt='2026-10-09T02:00:00.000Z',documentId='google_doc_fixture_1234567890',secondDocument='second_doc_fixture_1234567890';
const entry=(extra={})=>({source:'facebook',kind:'reel',title:'공식 제작 사례',sourceUrl:'https://www.facebook.com/reel/123456789012345/',checkedAt:'2026-10-09T01:00:00.000Z',...extra});
const report=(extra={})=>({schemaVersion:1,reportId:'gemini-2026-10-09',date:'2026-10-09',provider:'gemini-spark',entries:[entry()],...extra});
const completed=input=>JSON.stringify(input)+'\n'+CREATIVE_RESEARCH_COMPLETE;
const gate=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};

async function fixture(t,{reader,readerTimeoutMs=60000}={}){
  const directory=await mkdtemp(join(tmpdir(),'synk-research-sync-')),store=new Store(directory),admin=store.createUser({name:'Admin',email:'admin@example.test',role:'admin'}),otherAdmin=store.createUser({name:'Other Admin',email:'other-admin@example.test',role:'admin'}),member=store.createUser({name:'Member',email:'member@example.test',role:'member'}),viewer=store.createUser({name:'Viewer',email:'viewer@example.test',role:'viewer'});
  let at=initialAt,document={text:'',modifiedTime:at};const calls=[],events=[],services=[],research=createCreativeResearchService({store,clock:()=>at});
  const makeService=extra=>{const service=createCreativeResearchSyncService({store,research,clock:()=>at,readerTimeoutMs,reader:async input=>{calls.push(input);return reader?reader(input):document;},onImported:event=>events.push(event),...extra});services.push(service);return service;},service=makeService();
  t.after(async()=>{await Promise.all(services.map(value=>value.stop()));await research.stop();store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-research-sync-'));await rm(directory,{recursive:true,force:true});});
  return {directory,store,research,service,admin,otherAdmin,member,viewer,calls,events,makeService,setClock:value=>{at=value;},setDocument:text=>{document={text,modifiedTime:at};},enable:extra=>service.configure(admin,{enabled:true,documentId,...extra})};
}

test('document inputs accept only specific Google Docs IDs and safe canonical URLs',()=>{
  assert.equal(normalizeCreativeResearchDocumentId(documentId),documentId);assert.equal(normalizeCreativeResearchDocumentId('https://docs.google.com/document/d/'+documentId+'/edit?usp=sharing'),documentId);assert.equal(normalizeCreativeResearchDocumentId('https://docs.google.com/document/d/'+documentId+'/edit?tab=t.0'),documentId);
  for(const suffix of ['?usp=drive_web','?usp=drivesdk&authuser=1','#heading=h.section_123','#bookmark=id.section_123','#tab=t.0'])assert.equal(normalizeCreativeResearchDocumentId('https://docs.google.com/document/u/1/d/'+documentId+'/edit'+suffix),documentId);
  for(const value of ['http://docs.google.com/document/d/'+documentId+'/edit','https://docs.google.com.evil.test/document/d/'+documentId+'/edit','https://user:secret@docs.google.com/document/d/'+documentId+'/edit','https://docs.google.com:444/document/d/'+documentId+'/edit','https://docs.google.com/document/d/'+documentId+'/edit?access_token=private','https://docs.google.com/document/d/'+documentId+'/edit#private','https://docs.google.com/spreadsheets/d/'+documentId+'/edit','../secret'])assert.throws(()=>normalizeCreativeResearchDocumentId(value));
});

test('complete documents contain exactly one JSON or one JSON fence and a final marker',()=>{
  assert.equal(parseCompletedCreativeResearch('',{at:initialAt}).complete,false);assert.equal(parseCompletedCreativeResearch(JSON.stringify(report()),{at:initialAt}).complete,false);
  assert.equal(parseCompletedCreativeResearch(completed(report()),{at:initialAt}).report.entries.length,1);assert.equal(parseCompletedCreativeResearch('```json\n'+JSON.stringify(report())+'\n```\n'+CREATIVE_RESEARCH_COMPLETE,{at:initialAt}).report.entries.length,1);
  for(const text of ['설명\n'+completed(report()),JSON.stringify(report())+'\n'+JSON.stringify(report())+'\n'+CREATIVE_RESEARCH_COMPLETE,JSON.stringify(report())+'\n미완성\n'+CREATIVE_RESEARCH_COMPLETE,'```json\n'+JSON.stringify(report())+'\n```\n추가\n'+CREATIVE_RESEARCH_COMPLETE,CREATIVE_RESEARCH_COMPLETE])assert.throws(()=>parseCompletedCreativeResearch(text,{at:initialAt}),error=>error.code==='SYNC_DOCUMENT_INVALID');
  assert.equal(parseCompletedCreativeResearch(completed(report())+'\n다음 조사 진행 중',{at:initialAt}).complete,false);assert.throws(()=>parseCompletedCreativeResearch('x'.repeat(2*1024*1024+1),{at:initialAt}),error=>error.code==='SYNC_DOCUMENT_TOO_LARGE');
  assert.throws(()=>parseCompletedCreativeResearch(completed(report({date:'2026-10-01'})),{at:initialAt}),error=>error.code==='SYNC_REPORT_INVALID');
});

test('only current admins configure the strict source while public state never exposes document or connection IDs',async t=>{
  const f=await fixture(t);assert.equal(f.service.state().enabled,false);assert.equal(f.service.state().status,'disabled');
  for(const user of [f.member,f.viewer])assert.throws(()=>f.service.configure(user,{enabled:true,documentId}),error=>error.status===403);
  for(const input of [{ownerId:f.otherAdmin.id},{version:100},{documentUrl:'https://docs.google.com/document/d/'+documentId+'/edit'},{enabled:'true'},{enabled:true},{connectionId:'secret;cookie'},{documentId:'https://evil.example/doc'}])assert.throws(()=>f.service.configure(f.admin,input));
  const enabled=f.enable({connectionId:null});assert.equal(enabled.enabled,true);assert.equal(enabled.ownerId,f.admin.id);assert.equal(enabled.documentId,documentId);assert.equal(enabled.connectionId,null);assert.equal(enabled.documentUrl,'https://docs.google.com/document/d/'+documentId+'/edit');assert.equal(enabled.version,1);
  const publicState=f.service.state(f.member);for(const key of ['documentId','documentUrl','connectionId','ownerId','version'])assert.equal(Object.hasOwn(publicState,key),false);assert.equal(Object.hasOwn(f.service.state(),'documentId'),false);
  assert.equal(f.service.configure(f.admin,{enabled:true,documentId}).version,1);assert.equal(f.service.configure(f.otherAdmin,{}).ownerId,f.otherAdmin.id);assert.equal(f.service.state(f.otherAdmin).version,2);
});

test('the independent collector polls every ten minutes, imports company material once and emits only new-report events',async t=>{
  const f=await fixture(t);f.enable();f.setDocument(completed(report()));await f.service.tick();const first=f.service.state(f.admin);assert.equal(first.status,'imported');assert.equal(first.lastReport.createdCount,1);assert.equal(first.lastImportedAt,initialAt);assert.equal(f.calls.length,1);assert.equal(f.calls[0].connectionId,null);assert.equal(f.events.length,1);assert.equal(f.research.workspace(f.member).entries[0].visibility,'company');
  await f.service.tick();assert.equal(f.calls.length,1);f.setClock('2026-10-09T02:09:59Z');await f.service.tick();assert.equal(f.calls.length,1);f.setClock('2026-10-09T02:10:00Z');await f.service.tick();assert.equal(f.calls.length,2);assert.equal(f.calls[1].ifModifiedTime,initialAt);assert.equal(f.events.length,1);assert.equal(f.store.all('creativeResearchReports').length,1);assert.equal(f.store.all('creativeResearchEntries').length,1);
  await f.service.tick(undefined,{force:true});assert.equal(f.calls.length,3);assert.equal(f.events.length,1);assert.equal(f.service.state().lastImportedAt,initialAt);assert.equal(f.service.state(f.admin).lastReport.date,'2026-10-09');
  f.setClock('2026-10-16T02:00:00Z');await f.service.tick();const old=f.service.state(f.admin);assert.equal(old.status,'imported');assert.equal(old.lastReport.date,'2026-10-09');assert.equal(old.lastImportedAt,initialAt);assert.equal(f.events.length,1);
});

test('blank, unfinished, invalid and failed reads preserve the last successful report and all saved notes',async t=>{
  let failRead=false;const f=await fixture(t,{reader:async()=>{if(failRead)throw Error('Bearer private-token access_token=private');return {text:body,modifiedTime:initialAt};}});let body=completed(report());f.enable();await f.service.tick();const id=f.store.all('creativeResearchEntries')[0].id;f.research.update(f.admin,id,{note:'내 메모'});const success=f.service.state(f.admin);
  for(const text of ['',JSON.stringify(report({reportId:'working'})),'설명\n'+completed(report({reportId:'invalid'})),completed(report({reportId:'unsafe',entries:[entry({sourceUrl:'https://evil.example/secret'})]}))]){body=text;await f.service.tick(undefined,{force:true});const result=f.service.state(f.admin);assert.equal(result.lastImportedAt,success.lastImportedAt);assert.equal(result.lastReport.reportId,success.lastReport.reportId);assert.equal(f.store.all('creativeResearchEntries').length,1);assert.equal(f.store.get('creativeResearchEntries',id).note,'내 메모');}
  failRead=true;await f.service.tick(undefined,{force:true});const failed=f.service.state(f.admin);assert.equal(failed.status,'error');assert.equal(failed.lastErrorCode,'SYNC_READ_FAILED');assert.equal(JSON.stringify(failed).includes('private-token'),false);assert.equal(failed.lastReport.reportId,success.lastReport.reportId);assert.equal(f.events.length,1);
});

test('an already imported unchanged report emits no event when received through a newly configured source',async t=>{
  const f=await fixture(t);const original=f.research.importReport(f.admin,{...report(),visibility:'company',shareConfirmed:true},{automaticSourceId:documentId});f.enable();f.setDocument(completed(report()));await f.service.tick();const state=f.service.state(f.admin);assert.equal(state.status,'imported');assert.equal(state.lastReport.id,original.report.id);assert.equal(state.lastImportedAt,null);assert.equal(f.events.length,0);assert.equal(f.store.all('creativeResearchEntries').length,1);
});

test('sync report metadata and aggregate counts follow private entry visibility instead of the inbox sharing setting',async t=>{
  const f=await fixture(t),privateRow=f.research.add(f.admin,entry({title:'관리자의 개인 자료'})).entry,payload=report({reportId:'confidential-report-id',entries:[entry(),entry({sourceUrl:'https://www.facebook.com/reel/999999999999999/'})]});
  f.enable();f.setDocument(completed(payload));await f.service.tick();assert.equal(f.store.get('creativeResearchEntries',privateRow.id).visibility,'private');assert.equal(f.research.workspace(f.member).entries.length,2);
  const automatic=f.store.all('creativeResearchEntries').find(row=>row.automaticSourceId===documentId&&row.sourceUrl===privateRow.sourceUrl);assert.ok(automatic);assert.notEqual(automatic.id,privateRow.id);f.research.update(f.admin,automatic.id,{visibility:'private'});assert.equal(f.research.workspace(f.member).entries.length,1);assert.equal(f.research.workspace(f.member).automation.lastReport,null);
  for(const user of [f.member,f.viewer,undefined]){const state=f.service.state(user);assert.equal(state.status,'imported');assert.equal(state.lastReport,null);assert.equal(JSON.stringify(state).includes('confidential-report-id'),false);assert.equal(JSON.stringify(state).includes('createdCount'),false);}
  assert.equal(f.service.state(f.admin).lastReport.reportId,payload.reportId);assert.equal(f.service.state(f.otherAdmin).lastReport.reportId,payload.reportId);
  f.research.update(f.admin,automatic.id,{visibility:'company',shareConfirmed:true});assert.equal(f.service.state(f.member).lastReport.reportId,payload.reportId);f.research.archive(f.admin,automatic.id);assert.equal(f.service.state(f.member).lastReport.reportId,payload.reportId);
  f.research.update(f.admin,automatic.id,{visibility:'private'});assert.equal(f.service.state(f.member).lastReport,null);assert.equal(f.store.get('creativeResearchEntries',privateRow.id).visibility,'private');
});

test('sync metadata rechecks channel access and active identity just like the main research workspace',async t=>{
  const f=await fixture(t),channel={id:'facebook-owned-channel',platform:'facebook',displayName:'Owned channel',active:true,ownerIds:[f.member.id],teamId:null};f.store.put('channels',channel.id,channel);f.enable();f.setDocument(completed(report({entries:[entry({channelId:channel.id})]})));await f.service.tick();
  assert.equal(f.service.state(f.member).lastReport.reportId,report().reportId);assert.equal(f.service.state(f.viewer).lastReport,null);
  f.store.put('channels',channel.id,{...channel,active:false});assert.equal(f.research.workspace(f.member).automation.lastReport,null);assert.equal(f.service.state(f.member).lastReport,null);
  f.store.put('channels',channel.id,channel);f.store.put('users',f.member.id,{...f.member,active:false});assert.equal(f.service.state(f.member).lastReport,null);assert.equal(f.service.state(f.admin).lastReport.reportId,report().reportId);
});

test('disabling, changing a source or changing its connection during reading invalidates the old body',async t=>{
  for(const change of [{enabled:false},{documentId:secondDocument},{connectionId:'new-connection'}]){
    const entered=gate(),release=gate(),f=await fixture(t,{reader:async()=>{entered.resolve();await release.promise;return {text:completed(report()),modifiedTime:initialAt};}});f.enable();const work=f.service.tick();await entered.promise;f.service.configure(f.admin,change);release.resolve();await work;assert.equal(f.store.all('creativeResearchEntries').length,0);assert.equal(f.events.length,0);assert.equal(f.service.state().enabled,change.enabled!==false);
  }
});

test('revoked or demoted owners cannot persist a completed read and inactive owners are not polled',async t=>{
  for(const update of [{active:false},{role:'member'},{role:'viewer'}]){
    const entered=gate(),release=gate(),f=await fixture(t,{reader:async()=>{entered.resolve();await release.promise;return {text:completed(report()),modifiedTime:initialAt};}});f.enable();const work=f.service.tick();await entered.promise;f.store.put('users',f.admin.id,{...f.admin,...update});release.resolve();await work;assert.equal(f.store.all('creativeResearchEntries').length,0);assert.equal(f.service.state().lastErrorCode,'SYNC_OWNER_UNAVAILABLE');await f.service.tick(undefined,{force:true});assert.equal(f.calls.length,1);
  }
});

test('manual force and scheduled checks share a task and SQLite leases prevent separate service instances from overlapping',async t=>{
  const entered=gate(),release=gate(),f=await fixture(t,{reader:async()=>{entered.resolve();await release.promise;return {text:completed(report()),modifiedTime:initialAt};}});f.enable();const first=f.service.tick();await entered.promise;const forced=f.service.tick(undefined,{force:true});assert.equal(f.calls.length,1);assert.equal(f.service.state().status,'checking');
  const second=f.makeService();await second.tick(undefined,{force:true});assert.equal(f.calls.length,1);release.resolve();await Promise.all([first,forced]);assert.equal(f.store.all('creativeResearchEntries').length,1);assert.equal(f.events.length,1);
});

test('two SQLite connections share a lease and an expired late response cannot replace a newer completed report',async t=>{
  const entered=gate(),release=gate(),f=await fixture(t,{reader:async()=>{entered.resolve();await release.promise;return {text:completed(report()),modifiedTime:initialAt};}});f.enable();const old=f.service.tick();await entered.promise;
  const otherStore=new Store(f.directory),otherResearch=createCreativeResearchService({store:otherStore,clock:()=> '2026-10-09T02:03:00Z'}),other=createCreativeResearchSyncService({store:otherStore,research:otherResearch,clock:()=> '2026-10-09T02:03:00Z',reader:async()=>({text:completed(report({reportId:'newer',entries:[entry({metrics:{likes:200},checkedAt:'2026-10-09T02:03:00Z'})]})),modifiedTime:'2026-10-09T02:03:00Z'})});
  try{f.setClock('2026-10-09T02:03:00Z');await other.tick(undefined,{force:true});release.resolve();await old;assert.equal(f.store.all('creativeResearchEntries').length,1);assert.equal(f.store.all('creativeResearchEntries')[0].metrics.likes,200);assert.equal(f.service.state(f.admin).lastReport.reportId,'newer');assert.equal(f.events.length,0);}finally{release.resolve();await old;await other.stop();await otherResearch.stop();otherStore.close();}
});

test('import transactions recheck source authority after a completed reader and cannot bypass a config race',async t=>{
  const f=await fixture(t);f.enable();f.setDocument(completed(report()));const original=f.research.importReport.bind(f.research);f.research.importReport=(user,input,options)=>{f.service.configure(f.admin,{enabled:false});return original(user,input,options);};
  await f.service.tick();assert.equal(f.store.all('creativeResearchEntries').length,0);assert.equal(f.store.all('creativeResearchReports').length,0);assert.equal(f.events.length,0);assert.equal(f.service.state().enabled,false);
});

test('timeouts and stop preserve material, release leases and prevent subsequent read or save work',async t=>{
  const never=gate(),timed=await fixture(t,{readerTimeoutMs:5,reader:()=>never.promise});timed.enable();const timeout=await timed.service.tick();assert.equal(timeout.lastErrorCode,'SYNC_READ_TIMEOUT');assert.equal(timed.store.all('creativeResearchEntries').length,0);assert.equal(timed.store.get('settings','creative-research-sync-lease'),null);
  const entered=gate(),release=gate(),f=await fixture(t,{reader:async()=>{entered.resolve();await release.promise;return {text:completed(report()),modifiedTime:initialAt};}});f.enable();const work=f.service.tick();await entered.promise;let finished=false;const stopping=f.service.stop().then(()=>{finished=true;});await Promise.resolve();assert.equal(finished,false);release.resolve();await Promise.all([work,stopping]);assert.equal(finished,true);assert.equal(f.store.all('creativeResearchEntries').length,0);await f.service.tick();assert.equal(f.calls.length,1);assert.throws(()=>f.service.configure(f.admin,{enabled:true}),error=>error.status===503);
});

test('the same document stays one company source when a successor admin saves settings and imports the next day',async t=>{
  const f=await fixture(t);f.enable();f.setDocument(completed(report({entries:[entry({metrics:{likes:10}})]})));await f.service.tick();const first=f.store.all('creativeResearchEntries')[0];f.research.update(f.admin,first.id,{note:'이전 담당자의 회사 메모'});
  f.service.configure(f.otherAdmin,{enabled:true,documentId});await f.service.tick();assert.equal(f.store.all('creativeResearchEntries').length,1);assert.equal(f.store.all('creativeResearchReports').length,1);assert.equal(f.events.length,1);assert.equal(f.service.state(f.otherAdmin).ownerId,f.otherAdmin.id);
  f.setClock('2026-10-10T02:00:00Z');f.setDocument(completed(report({reportId:'next-day-doc-report',date:'2026-10-10',entries:[entry({checkedAt:'2026-10-10T01:00:00Z',metrics:{likes:100}})]})));await f.service.tick();const next=f.store.all('creativeResearchEntries')[0];assert.equal(f.store.all('creativeResearchEntries').length,1);assert.equal(next.id,first.id);assert.equal(next.ownerId,f.admin.id);assert.equal(next.note,'이전 담당자의 회사 메모');assert.equal(next.metrics.likes,100);assert.equal(f.events.length,2);
});

test('private manual import of the same report never blocks automatic sharing or exports private notes',async t=>{
  const f=await fixture(t),manual=f.research.importReport(f.admin,report());f.research.update(f.admin,manual.entries[0].id,{note:'PRIVATE_NOTE',hook:'PRIVATE_HOOK'});f.enable();f.setDocument(completed(report()));await f.service.tick();
  assert.equal(f.service.state(f.admin).status,'imported');assert.equal(f.service.state(f.admin).lastError,null);assert.equal(f.store.all('creativeResearchReports').length,2);assert.equal(f.store.all('creativeResearchEntries').length,2);assert.equal(f.store.get('creativeResearchEntries',manual.entries[0].id).visibility,'private');assert.equal(f.store.get('creativeResearchEntries',manual.entries[0].id).note,'PRIVATE_NOTE');
  const publicData=f.research.workspace(f.member);assert.equal(publicData.entries.length,1);assert.equal(JSON.stringify(publicData).includes('PRIVATE_'),false);await f.service.tick(undefined,{force:true});assert.equal(f.store.all('creativeResearchEntries').length,2);assert.equal(f.events.length,1);
});

test('configuration errors distinguish document addresses from completed content and accept official account URLs',async t=>{
  const f=await fixture(t);
  for(const input of [null,[],{enabled:'true'},{connectionId:'private;secret'},{ownerId:f.otherAdmin.id}])assert.throws(()=>f.service.configure(f.admin,input),error=>error.code==='SYNC_CONFIG_INVALID'&&!error.message.includes('JSON'));
  for(const input of [{enabled:true},{documentId:'https://evil.example/document/d/'+documentId},{documentId:'https://docs.google.com/document/d/'+documentId+'/edit?access_token=PRIVATE_TOKEN'}])assert.throws(()=>f.service.configure(f.admin,input),error=>error.code==='SYNC_DOCUMENT_ADDRESS_INVALID'&&!error.message.includes('PRIVATE_TOKEN')&&!error.message.includes('JSON'));
  const configured=f.service.configure(f.admin,{enabled:true,documentId:'https://docs.google.com/document/u/1/d/'+documentId+'/edit?usp=drive_web&authuser=1#heading=h.section_123'});assert.equal(configured.documentId,documentId);assert.equal(configured.documentUrl,'https://docs.google.com/document/d/'+documentId+'/edit');
});

test('synchronous database and time errors reject the tick promise without escaping timer-style catch handlers',async t=>{
  const f=await fixture(t);f.enable();const original=f.store.transaction.bind(f.store);f.store.transaction=()=>{throw Error('SQLITE_BUSY fixture');};let pending;
  assert.doesNotThrow(()=>{pending=f.service.tick().catch(error=>({code:'caught',message:error.message}));});const caught=await pending;assert.equal(caught.code,'caught');assert.match(caught.message,/SQLITE_BUSY/);assert.equal(f.calls.length,0);f.store.transaction=original;
  assert.doesNotThrow(()=>{pending=f.service.tick('invalid-time').catch(error=>error.code);});assert.equal(await pending,'SYNC_DOCUMENT_INVALID');assert.equal(f.store.all('creativeResearchEntries').length,0);
});

test('a new service resumes enabled settings immediately after an interrupted stopped service',async t=>{
  const entered=gate(),release=gate(),f=await fixture(t,{reader:async()=>{entered.resolve();await release.promise;return {text:completed(report()),modifiedTime:initialAt};}});f.enable();const old=f.service.tick();await entered.promise;const stopped=f.service.stop();release.resolve();await Promise.all([old,stopped]);assert.equal(f.store.get('settings','creative-research-sync-state').status,'disabled');assert.equal(f.store.get('settings','creative-research-sync-state').lastErrorCode,'SYNC_STOPPED');
  let reads=0;const resumed=f.makeService({reader:async()=>{reads++;return {text:completed(report()),modifiedTime:initialAt};}}),state=resumed.state(f.admin);assert.equal(state.enabled,true);assert.equal(state.status,'waiting');assert.equal(state.lastError,null);assert.equal(state.lastErrorCode,null);assert.equal(state.nextCheckAt,initialAt);await resumed.tick();assert.equal(reads,1);assert.equal(resumed.state(f.admin).status,'imported');assert.equal(f.store.all('creativeResearchEntries').length,1);
});

test('two registered writers refresh one canonical company source while a source error is isolated',async t=>{
  let secondFails=false;const f=await fixture(t,{reader:async input=>{if(input.documentId===secondDocument&&secondFails)throw Error('private credential');return {text:completed(report({reportId:input.documentId===documentId?'writer-one':'writer-two',entries:[entry({checkedAt:input.documentId===documentId?'2026-10-09T01:00:00Z':'2026-10-09T01:30:00Z',metrics:{likes:input.documentId===documentId?10:20}})]})),modifiedTime:initialAt};}});
  f.service.configure(f.admin,{enabled:true,sources:[{id:'primary',documentId,connectionId:null},{id:'second',documentId:secondDocument,connectionId:'second-account'}]});await f.service.tick();
  assert.equal(f.store.all('creativeResearchEntries').length,1);const row=f.store.all('creativeResearchEntries')[0];assert.equal(row.metrics.likes,20);assert.equal(f.store.all('creativeResearchReports').length,2);assert.equal(f.service.state(f.admin).sources.length,2);assert.equal(f.service.state(f.member).sources,undefined);assert.equal(f.service.state(f.member).documentId,undefined);
  f.research.update(f.admin,row.id,{note:'공동 메모',archived:true});secondFails=true;f.setClock('2026-10-09T02:10:00Z');await f.service.tick();
  const state=f.service.state(f.admin);assert.equal(state.sources[0].status,'imported');assert.equal(state.sources[1].status,'error');assert.equal(state.sources[1].lastErrorCode,'SYNC_READ_FAILED');assert.equal(state.sources[1].lastReport.reportId,'writer-two');assert.equal(f.store.get('creativeResearchEntries',row.id).note,'공동 메모');assert.equal(f.store.get('creativeResearchEntries',row.id).archived,true);assert.equal(f.store.all('creativeResearchEntries').length,1);assert.equal(JSON.stringify(state).includes('credential'),false);
});

test('conditional reads revalidate authority and preserve successful metadata without requiring exported text',async t=>{
  let calls=0;const f=await fixture(t,{reader:async input=>{calls++;if(calls===1){assert.equal(input.ifModifiedTime,undefined);return {text:completed(report()),modifiedTime:initialAt};}assert.equal(input.ifModifiedTime,initialAt);return {notModified:true,modifiedTime:initialAt};}});f.enable();await f.service.tick();const original=f.service.state(f.admin);f.setClock('2026-10-09T02:10:00Z');await f.service.tick();assert.equal(f.service.state(f.admin).lastImportedAt,original.lastImportedAt);assert.equal(f.service.state(f.admin).lastReport.id,original.lastReport.id);assert.equal(f.events.length,1);assert.equal(f.calls.length,2);
  f.store.put('users',f.admin.id,{...f.admin,role:'viewer'});f.setClock('2026-10-09T02:20:00Z');await f.service.tick();assert.equal(f.calls.length,2);assert.equal(f.service.state().lastErrorCode,'SYNC_OWNER_UNAVAILABLE');
});

test('multi-source settings are strict and the old form preserves other writers',async t=>{
  const f=await fixture(t),sources=[{id:'primary',documentId,connectionId:null},{id:'second',documentId:secondDocument,connectionId:'second-account'}];f.service.configure(f.admin,{enabled:true,sources});
  assert.equal(f.service.configure(f.admin,{connectionId:'changed-first-account'}).sources[1].connectionId,'second-account');assert.equal(f.service.state(f.admin).sources.length,2);
  for(const input of [{sources:[sources[0],sources[0]]},{sources:[sources[0],{...sources[1],documentId}]},{sources:[{...sources[0],ownerId:f.otherAdmin.id}]},{sources:'wrong'},{sources,documentId},{sources:[],enabled:true},{sources:Array.from({length:9},(_,i)=>({id:'source-'+i,documentId:'long_document_fixture_'+i+'12345678'}))}])assert.throws(()=>f.service.configure(f.admin,input));
  assert.equal(f.service.state(f.admin).sources.length,2);const next=f.service.configure(f.otherAdmin,{});assert.equal(next.ownerId,f.otherAdmin.id);assert.equal(next.sources.length,2);
});

test('an owner or source-pool change while two reads are pending discards both completed bodies',async t=>{
  for(const change of ['owner','pool']){const entered=gate(),release=gate();let count=0;const f=await fixture(t,{reader:async input=>{if(++count===2)entered.resolve();await release.promise;return {text:completed(report({reportId:input.documentId})),modifiedTime:initialAt};}});f.service.configure(f.admin,{enabled:true,sources:[{id:'primary',documentId},{id:'second',documentId:secondDocument}]});const work=f.service.tick();await entered.promise;if(change==='owner')f.service.configure(f.otherAdmin,{});else f.service.configure(f.admin,{sources:[{id:'primary',documentId}]});release.resolve();await work;assert.equal(f.store.all('creativeResearchEntries').length,0);assert.equal(f.store.all('creativeResearchReports').length,0);assert.equal(f.events.length,0);}
});

test('a not-modified response with missing or mismatched prior identity cannot mark a source successful',async t=>{
  const f=await fixture(t,{reader:async()=>({notModified:true,modifiedTime:initialAt})});f.enable();await f.service.tick();assert.equal(f.service.state().lastErrorCode,'SYNC_DOCUMENT_INVALID');assert.equal(f.store.all('creativeResearchEntries').length,0);
});

test('removing or replacing a writer keeps accepted guide and observation history updatable without duplication',async t=>{
  const deep={summary:'공식 원문의 실제 제작 순서를 확인했습니다.',whyNow:'이전에 확인한 원문을 새 회차에서 재확인합니다.',viewerReason:'다음 제작의 실제 순서를 선택할 수 있습니다.',brands:['LAB'],priority:'high',observedFacts:[{text:'원문에 첫 행동과 결과를 표시합니다.'}],evidenceLevel:'page-read',limitations:'로컬 합성 자료이며 학습 효과와 광고 성과는 미검증입니다.',applications:[{brand:'LAB',idea:'실제 연습 화면으로 시작합니다.',zeroSecondHook:'첫 질문에 답하세요.',action:'조건을 고릅니다.',reward:'선택한 연습을 받습니다.',personalizationTool:'조건으로 연습을 고릅니다.',validation72h:'72시간 도구 시작과 완료를 비교합니다.'}],productionGuide:{formatName:'이전 작성자의 제작 지침',productionSteps:[{order:1,title:'준비',instruction:'실제 연습 화면과 질문을 준비합니다.'},{order:2,title:'촬영',instruction:'첫 행동과 결과를 실제 화면으로 촬영합니다.'},{order:3,title:'확인',instruction:'씨앗 계정에서 72시간 결과를 확인합니다.'}],requiredAssets:['실제 화면과 승인 글꼴'],brandAdaptation:'LAB의 학습자 질문과 맞춤 연습을 연결합니다.',appeal:'조건을 고르고 자기 결과를 받습니다.',estimatedMinutes:45}};
  for(const mode of ['removed','replaced']){
    let modifiedTime=initialAt;const docs=new Map([[documentId,''],[secondDocument,completed(report({reportId:'former-writer',entries:[entry({research:deep}),entry({sourceUrl:'https://www.facebook.com/reel/999999999999999/',metrics:{likes:10}})]}))]]),f=await fixture(t,{reader:async input=>({text:docs.get(input.documentId),modifiedTime})});
    f.service.configure(f.admin,{enabled:true,sources:mode==='removed'?[{id:'primary',documentId},{id:'second',documentId:secondDocument}]:[{id:'primary',documentId:secondDocument}]});await f.service.tick();const [guideRow,observation]=f.store.all('creativeResearchEntries').sort((a,b)=>Number(!!b.research)-Number(!!a.research));f.research.claim(f.member,guideRow.id);f.research.update(f.admin,guideRow.id,{note:'보존할 제작 메모',archived:true});
    modifiedTime='2026-10-10T02:00:00.000Z';f.setClock(modifiedTime);docs.set(documentId,completed(report({reportId:'remaining-writer-new-day',date:'2026-10-10',entries:[entry({checkedAt:'2026-10-10T01:00:00Z',research:{...deep,productionGuide:{...deep.productionGuide,formatName:'현재 작성자가 개선한 지침'}},metrics:{likes:70}}),entry({sourceUrl:observation.sourceUrl,checkedAt:'2026-10-10T01:00:00Z',metrics:{likes:90}})]})));f.service.configure(f.admin,{sources:[{id:'primary',documentId}]});await f.service.tick();
    const next=f.service.state(f.admin).lastReport;assert.equal(next.createdCount,0);assert.equal(next.updatedCount,2);assert.equal(f.store.all('creativeResearchEntries').length,2);const updated=f.store.get('creativeResearchEntries',guideRow.id);assert.equal(updated.automaticSourceId,secondDocument);assert.equal(updated.note,'보존할 제작 메모');assert.equal(updated.archived,true);assert.equal(updated.research.productionGuide.formatName,'현재 작성자가 개선한 지침');assert.equal(updated.productionGuideCheckedAt,'2026-10-10T01:00:00.000Z');assert.equal(f.store.get('creativeResearchEntries',observation.id).metrics.likes,90);assert.equal(f.research.workspace(f.member,{includeArchived:true}).entries.find(row=>row.id===guideRow.id).usage.isMine,true);assert.equal(f.research.workspace(f.member).automation.pool.addedCount,0);await f.service.tick(undefined,{force:true});assert.equal(f.store.all('creativeResearchReports').length,2);assert.equal(f.store.all('creativeResearchEntries').length,2);
  }
});

test('automatic observation deferral is a completed successful source instead of a repeating failed import',async t=>{
  const f=await fixture(t);f.store.transaction(()=>{for(let i=0;i<500;i++)f.store.put('creativeResearchEntries','shelf-'+i,{id:'shelf-'+i,ownerId:f.admin.id,source:'facebook',visibility:'private',archived:true,createdAt:initialAt,updatedAt:initialAt});});f.enable();f.setDocument(completed(report()));await f.service.tick();const first=f.service.state(f.admin);assert.equal(first.status,'imported');assert.equal(first.lastErrorCode,null);assert.equal(first.lastReport.acceptedCount,0);assert.equal(first.lastReport.deferredCount,1);assert.equal(first.lastReport.deferredObservationCount,1);assert.equal(first.lastReport.deferredGuideCount,0);assert.equal(f.events.length,1);await f.service.tick(undefined,{force:true});assert.equal(f.store.all('creativeResearchReports').length,1);assert.equal(f.store.all('creativeResearchEntries').length,500);assert.equal(f.events.length,1);assert.equal(f.service.state(f.admin).lastImportedAt,first.lastImportedAt);
});

test('a slow source never blocks the next due poll of a healthy independent source',async t=>{
  const release=gate(),firstHealthy=gate(),secondHealthy=gate();let healthyReads=0,slowReads=0;
  const f=await fixture(t,{reader:async input=>{if(input.documentId===documentId){slowReads++;return release.promise;}healthyReads++;(healthyReads===1?firstHealthy:secondHealthy).resolve();return {text:completed(report({reportId:'healthy-'+healthyReads})),modifiedTime:initialAt};}});
  f.service.configure(f.admin,{enabled:true,sources:[{id:'primary',documentId},{id:'healthy',documentId:secondDocument}]});const first=f.service.tick();await firstHealthy.promise;await new Promise(setImmediate);assert.equal(f.store.all('creativeResearchReports').length,1);
  f.setClock('2026-10-09T02:10:00Z');const second=f.service.tick();await secondHealthy.promise;assert.equal(healthyReads,2);assert.equal(slowReads,1);release.resolve({text:'',modifiedTime:initialAt});await Promise.all([first,second]);assert.equal(f.store.all('creativeResearchReports').length,2);
});

test('timeouts abort each reader and stop cancels pending work without waiting for a late body',async t=>{
  const signals=[];let active=0;const f=await fixture(t,{readerTimeoutMs:5,reader:({signal})=>new Promise((resolve,reject)=>{signals.push(signal);active++;signal.addEventListener('abort',()=>{active--;reject(signal.reason);},{once:true});})});f.enable();
  for(let index=0;index<3;index++){await f.service.tick(undefined,{force:true});assert.equal(active,0);assert.equal(f.service.state().lastErrorCode,'SYNC_READ_TIMEOUT');}assert.equal(signals.length,3);assert.ok(signals.every(signal=>signal.aborted));
  const entered=gate(),late=gate();let signal;const pending=await fixture(t,{reader:input=>{signal=input.signal;entered.resolve();return late.promise;}});pending.enable();const work=pending.service.tick();await entered.promise;let timer;
  try{await Promise.race([pending.service.stop(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('stop waited for the reader')),1000);})]);}finally{clearTimeout(timer);late.resolve({text:completed(report()),modifiedTime:initialAt});}
  await work;assert.equal(signal.aborted,true);assert.equal(pending.store.all('creativeResearchEntries').length,0);assert.equal(pending.store.get('settings','creative-research-sync-lease'),null);assert.equal(pending.store.get('settings','creative-research-sync-state').lastErrorCode,'SYNC_STOPPED');
});

test('per-source failure backoff persists across restart, is capped and resets after a successful read',async t=>{
  let reads=0,fails=true;const reader=async()=>{reads++;if(fails)throw Error('provider temporarily unavailable');return {text:completed(report()),modifiedTime:initialAt};},f=await fixture(t,{reader});f.enable();let at=Date.parse(initialAt);const delays=[];
  for(let index=0;index<6;index++){f.setClock(new Date(at).toISOString());await f.service.tick();const next=Date.parse(f.service.state().nextCheckAt);delays.push(next-at);at=next;}
  assert.deepEqual(delays,[60000,120000,240000,480000,600000,600000]);const resumed=f.makeService({reader});f.setClock(new Date(at-1).toISOString());await resumed.tick();assert.equal(reads,6);fails=false;f.setClock(new Date(at).toISOString());await resumed.tick();assert.equal(reads,7);assert.equal(resumed.state(f.admin).status,'imported');assert.equal(f.store.get('settings','creative-research-sync-state').consecutiveFailures,0);
  fails=true;at+=600000;f.setClock(new Date(at).toISOString());await resumed.tick();assert.equal(Date.parse(resumed.state().nextCheckAt)-at,60000);assert.equal(f.store.all('creativeResearchEntries').length,1);assert.equal(f.store.all('creativeResearchReports').length,1);
});

test('one failing source does not slow a successful source and aggregate status prioritizes its error',async t=>{
  const counts=new Map();const f=await fixture(t,{reader:async input=>{counts.set(input.documentId,(counts.get(input.documentId)||0)+1);if(input.documentId===documentId)throw Error('provider failed');return {text:completed(report()),modifiedTime:initialAt};}});f.service.configure(f.admin,{enabled:true,sources:[{id:'primary',documentId},{id:'healthy',documentId:secondDocument}]});
  for(const offset of [0,30000,600000,1200000]){f.setClock(new Date(Date.parse(initialAt)+offset).toISOString());await f.service.tick();}assert.equal(counts.get(documentId),3);assert.equal(counts.get(secondDocument),3);const state=f.service.state(f.member);assert.equal(state.status,'error');assert.equal(state.errorSourceCount,1);assert.equal(state.sourceCount,2);assert.equal(state.lastErrorCode,'SYNC_READ_FAILED');assert.equal(state.sources,undefined);assert.equal(state.documentId,undefined);assert.equal(state.connectionId,undefined);assert.equal(state.ownerId,undefined);
});

test('research freshness uses original completion time, while successful reads and later receipts remain separate',async t=>{
  const run={asOfAt:'2026-10-09T00:30:00Z',researchStartedAt:'2026-10-09T00:30:00Z',researchCompletedAt:'2026-10-09T01:00:00Z'},f=await fixture(t);f.enable();f.setDocument(completed(report(run)));await f.service.tick();const initial=f.service.state(f.admin),source=initial.sources[0];assert.equal(initial.checkedAt,initialAt);assert.equal(source.lastReadAt,initialAt);assert.equal(source.researchCompletedAt,'2026-10-09T01:00:00.000Z');assert.equal(source.researchAgeHours,1);assert.equal(source.freshness,'current');assert.equal(source.freshnessLimitHours,36);
  f.setClock('2026-10-09T03:00:00Z');f.setDocument(completed(report({...run,reportId:'same-observation-revised'})));await f.service.tick();assert.equal(f.service.state(f.admin).sources[0].researchCompletedAt,source.researchCompletedAt);const imported=f.service.state(f.admin).lastImportedAt;assert.equal(imported,'2026-10-09T03:00:00.000Z');
  f.setClock('2026-10-10T13:00:00Z');await f.service.tick();assert.equal(f.service.state(f.admin).sources[0].freshness,'current');f.setClock('2026-10-10T13:00:00.001Z');await f.service.tick(undefined,{force:true});const stale=f.service.state(f.admin);assert.equal(stale.sources[0].freshness,'stale');assert.equal(stale.staleSourceCount,1);assert.equal(stale.status,'imported');assert.equal(stale.lastReadAt,'2026-10-10T13:00:00.001Z');assert.equal(stale.lastImportedAt,imported);assert.equal(stale.sources[0].researchCompletedAt,source.researchCompletedAt);assert.equal(stale.errorSourceCount,0);
  const member=f.service.state(f.member);assert.equal(member.staleSourceCount,1);assert.equal(member.sources,undefined);assert.equal(JSON.stringify(member).includes(documentId),false);
});

test('legacy reports have unknown research freshness and inaccessible report times are never exposed',async t=>{
  const f=await fixture(t);f.enable();f.setDocument(completed(report()));await f.service.tick();let state=f.service.state(f.admin);assert.equal(state.sources[0].freshness,'unknown');assert.equal(state.sources[0].researchCompletedAt,null);assert.equal(state.sources[0].researchAgeHours,null);assert.equal(state.staleSourceCount,0);
  f.setClock('2026-10-09T03:00:00Z');f.setDocument(completed(report({reportId:'timed-visible',asOfAt:'2026-10-09T00:30:00Z',researchStartedAt:'2026-10-09T00:30:00Z',researchCompletedAt:'2026-10-09T01:00:00Z'})));await f.service.tick();for(const row of f.store.all('creativeResearchEntries'))f.research.update(f.admin,row.id,{visibility:'private'});f.setClock('2026-10-11T03:00:00Z');assert.equal(f.service.state(f.admin).staleSourceCount,1);const member=f.service.state(f.member);assert.equal(member.lastReport,null);assert.equal(member.staleSourceCount,0);assert.equal(member.sources,undefined);
});
