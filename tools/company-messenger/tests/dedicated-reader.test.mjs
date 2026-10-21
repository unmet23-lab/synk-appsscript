import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {createDriveStorage,DriveStorageError} from '../drive-storage.mjs';

const documentId='dedicated-document-id',connectionId='fixture-connection',modifiedTime='2026-10-09T11:35:00.000Z';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
async function fixture(t,{metadata={},exportResponse,identity='alpha@example.test',beforeResponse}={}){
  const directory=await mkdtemp(join(tmpdir(),'synk-dedicated-reader-')),file=join(directory,'drive-storage.json');
  const registry={version:1,installationId:'fixture-installation',activeConnectionId:connectionId,connections:[{id:connectionId,email:'alpha@example.test',folderId:'private-messenger-folder',credentials:{client_id:'fake-client',client_secret:'fake-secret',refresh_token:'fake-refresh'}}]};
  let expectedRegistry=JSON.stringify(registry);await writeFile(file,expectedRegistry);const calls=[];let currentIdentity=identity;
  const storage=createDriveStorage({dataDir:directory,fetchImpl:async(input,options={})=>{
    const url=new URL(input);calls.push({url,options});assert.equal(options.redirect,'error');assert.ok(options.signal instanceof AbortSignal);
    await beforeResponse?.(url,options);
    if(url.origin==='https://oauth2.googleapis.com'){assert.equal(url.pathname,'/token');assert.equal(options.method,'POST');if(options.body.get('refresh_token')==='failed-refresh')return json({error:'invalid_grant'},400);return json({access_token:'fake-access-token',expires_in:3600});}
    assert.equal(url.origin,'https://www.googleapis.com');assert.equal(options.method,undefined);assert.equal(options.headers.Authorization,'Bearer fake-access-token');
    if(url.pathname==='/drive/v3/about')return json({user:{emailAddress:currentIdentity,displayName:'Fixture account'},storageQuota:{}});
    if(url.pathname===`/drive/v3/files/${documentId}`)return json({id:documentId,mimeType:'application/vnd.google-apps.document',trashed:false,appProperties:{synkCreativeResearchInbox:'v1'},modifiedTime,...metadata});
    if(url.pathname===`/drive/v3/files/${documentId}/export`){assert.equal(url.searchParams.get('mimeType'),'text/plain');return exportResponse?exportResponse():new Response('SYNK_CREATIVE_RESEARCH_PENDING\n미완료',{headers:{'Content-Type':'text/plain; charset=UTF-8'}});}
    assert.fail('No other Drive file may be requested');
  }});
  t.after(async()=>{assert.equal(await readFile(file,'utf8'),expectedRegistry,'storage does not rewrite registry or stored credentials');assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  return {storage,calls,read:extra=>storage.readCreativeResearchDocument({documentId,connectionId,...extra}),setIdentity:value=>{currentIdentity=value;},mutateRegistry:async change=>{const current=JSON.parse(await readFile(file,'utf8'));change(current);expectedRegistry=JSON.stringify(current);await writeFile(file,expectedRegistry);}};
}

function gateOn(path){let release,entered;const enteredPromise=new Promise(resolve=>{entered=resolve;}),released=new Promise(resolve=>{release=resolve;});let once=false;return {entered:enteredPromise,release,beforeResponse:async url=>{if(!once&&url.pathname===path){once=true;entered();await released;}}};}

test('dedicated reader uses existing authentication and reads only marked Google Doc metadata and bounded export',async t=>{
  const f=await fixture(t),result=await f.read();assert.deepEqual(result,{text:'SYNK_CREATIVE_RESEARCH_PENDING\n미완료',modifiedTime});
  assert.equal(f.calls.length,4);assert.equal(f.calls.filter(call=>call.url.hostname==='oauth2.googleapis.com').length,1);
  assert.equal(f.calls.some(call=>call.url.searchParams.has('q')||call.url.pathname.includes('private-messenger-folder')),false);
  assert.equal(f.calls.filter(call=>call.url.hostname==='www.googleapis.com').every(call=>!call.options.method),true);
  await f.read();assert.equal(f.calls.filter(call=>call.url.hostname==='oauth2.googleapis.com').length,1,'existing in-memory auth cache is reused');
});

test('bad IDs and missing connections are rejected before any network call',async t=>{
  const f=await fixture(t);for(const input of [{documentId:'../../private',connectionId},{documentId,connectionId:''},{documentId,connectionId:'missing-connection'}])await assert.rejects(f.storage.readCreativeResearchDocument(input),DriveStorageError);
  assert.equal(f.calls.length,0);
});

test('unchanged dedicated documents verify identity and metadata but skip text export',async t=>{
  const f=await fixture(t);assert.deepEqual(await f.read({ifModifiedTime:modifiedTime}),{notModified:true,modifiedTime});assert.equal(f.calls.length,3);assert.equal(f.calls.some(call=>call.url.pathname.endsWith('/export')),false);
  assert.deepEqual(await f.read({ifModifiedTime:'2026-10-09T20:35:00.000+09:00'}),{notModified:true,modifiedTime});assert.equal(f.calls.filter(call=>call.url.pathname==='/drive/v3/about').length,2,'account identity is checked again despite the unchanged document');assert.equal(f.calls.filter(call=>call.url.pathname===`/drive/v3/files/${documentId}`).length,2);
});

test('changed documents export the complete bounded text instead of using the cached timestamp',async t=>{
  const f=await fixture(t),result=await f.read({ifModifiedTime:'2026-10-09T11:34:00.000Z'});assert.equal(result.modifiedTime,modifiedTime);assert.equal(result.text,'SYNK_CREATIVE_RESEARCH_PENDING\n미완료');assert.equal(result.notModified,undefined);assert.equal(f.calls.filter(call=>call.url.pathname.endsWith('/export')).length,1);
});

test('invalid cache timestamps fail before authentication or metadata reads',async t=>{
  const f=await fixture(t);for(const ifModifiedTime of [null,modifiedTime.slice(0,10),'11',{},'2030-02-40T00:00:00Z'])await assert.rejects(f.read({ifModifiedTime}),error=>error instanceof DriveStorageError&&error.status===400);assert.equal(f.calls.length,0);
});

test('an unchanged timestamp cannot bypass a revoked marker, wrong Doc, trash or changed account identity',async t=>{
  for(const metadata of [{appProperties:{}},{mimeType:'application/octet-stream'},{trashed:true},{id:'another-document'}]){const f=await fixture(t,{metadata});await assert.rejects(f.read({ifModifiedTime:modifiedTime}),error=>error instanceof DriveStorageError&&error.status===409);assert.equal(f.calls.some(call=>call.url.pathname.endsWith('/export')),false);}
  const f=await fixture(t);await f.read();f.setIdentity('different@example.test');const fileReadsBefore=f.calls.filter(call=>call.url.pathname.includes('/files/')).length;await assert.rejects(f.read({ifModifiedTime:modifiedTime}),error=>error instanceof DriveStorageError&&error.status===409);assert.equal(f.calls.filter(call=>call.url.pathname.includes('/files/')).length,fileReadsBefore,'identity failure prevents even unchanged metadata from being read');
});

test('an OAuth identity mismatch prevents reading any file metadata or content',async t=>{
  const f=await fixture(t,{identity:'different@example.test'});await assert.rejects(f.read(),error=>error instanceof DriveStorageError&&error.status===409);assert.equal(f.calls.some(call=>call.url.pathname.includes('/files/')),false);
});

test('wrong marker, non-Doc, trash, metadata ID or missing modified time prevents export',async t=>{
  for(const metadata of [{appProperties:{}},{appProperties:{synkCreativeResearchInbox:'wrong'}},{mimeType:'application/octet-stream'},{trashed:true},{id:'another-document'},{modifiedTime:null}]){
    const f=await fixture(t,{metadata});await assert.rejects(f.read(),error=>error instanceof DriveStorageError&&error.status===409);assert.equal(f.calls.some(call=>call.url.pathname.endsWith('/export')),false);
  }
});

test('Content-Length and MIME reject unsuitable exports before reading their body',async t=>{
  for(const headers of [{'Content-Type':'text/plain','Content-Length':String(2*1024*1024+1)},{'Content-Type':'application/json'}]){
    const f=await fixture(t,{exportResponse:()=>new Response('ignored',{headers})});await assert.rejects(f.read(),error=>error instanceof DriveStorageError&&error.status===422);
  }
});

test('unknown-length streams are capped at 2MiB and cancelled when they cross the limit',async t=>{
  let cancelled=false;const f=await fixture(t,{exportResponse:()=>new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array(2*1024*1024+1));},cancel(){cancelled=true;}}),{headers:{'Content-Type':'text/plain'}})});
  await assert.rejects(f.read(),error=>error instanceof DriveStorageError&&error.status===422);assert.equal(cancelled,true);
});

test('export failures and stream errors return safe errors without authentication or body contents',async t=>{
  for(const exportResponse of [()=>json({error:{message:'Bearer fake-access-token private-data'}},403),()=>new Response(new ReadableStream({start(controller){controller.error(Error('fake-access-token private-data'));}}),{headers:{'Content-Type':'text/plain'}})]){
    const f=await fixture(t,{exportResponse});await assert.rejects(f.read(),error=>{assert.ok(error instanceof DriveStorageError);assert.equal(error.message.includes('fake-access-token'),false);assert.equal(error.message.includes('private-data'),false);return true;});
  }
});

test('a dedicated report is still rejected by the existing messenger attachment authorization rule',async t=>{
  const f=await fixture(t);await assert.rejects(f.storage.download({connectionId,remoteId:documentId,fileId:'attachment-id'}),error=>error instanceof DriveStorageError&&error.status===409);assert.equal(f.calls.some(call=>call.url.pathname.endsWith('/export')),false);
});

test('credential deletion or account replacement during a read cannot return either unchanged metadata or exported content',async t=>{
  for(const unchanged of [true,false])for(const mutation of [reg=>{reg.connections=[];},reg=>{reg.connections[0].email='different@example.test';reg.connections[0].credentials.refresh_token='different-refresh';}]){
    const gate=gateOn(`/drive/v3/files/${documentId}${unchanged?'':'/export'}`),f=await fixture(t,{beforeResponse:gate.beforeResponse}),pending=f.read(unchanged?{ifModifiedTime:modifiedTime}:{});
    await gate.entered;await f.mutateRegistry(mutation);gate.release();
    await assert.rejects(pending,error=>error instanceof DriveStorageError&&[409,503].includes(error.status));
  }
});

test('changed refresh credentials must retain current account and Doc permission before any result is returned',async t=>{
  for(const unchanged of [true,false]){
    const gate=gateOn(`/drive/v3/files/${documentId}${unchanged?'':'/export'}`),f=await fixture(t,{beforeResponse:gate.beforeResponse}),pending=f.read(unchanged?{ifModifiedTime:modifiedTime}:{});
    await gate.entered;await f.mutateRegistry(reg=>{reg.connections[0].credentials.refresh_token='failed-refresh';});gate.release();
    await assert.rejects(pending,error=>{assert.ok(error instanceof DriveStorageError);assert.equal(error.status,503);assert.equal(/failed-refresh|fake-access-token|private-data/.test(error.message),false);return true;});
  }
});

test('a valid same-account refresh-token rotation preserves both changed and unchanged reads',async t=>{
  for(const unchanged of [true,false]){
    const gate=gateOn(`/drive/v3/files/${documentId}${unchanged?'':'/export'}`),f=await fixture(t,{beforeResponse:gate.beforeResponse}),pending=f.read(unchanged?{ifModifiedTime:modifiedTime}:{});
    await gate.entered;await f.mutateRegistry(reg=>{reg.connections[0].credentials.refresh_token='rotated-refresh';});gate.release();
    const result=await pending;assert.equal(result.modifiedTime,modifiedTime);assert.equal(result.notModified,unchanged?true:undefined);
    assert.equal(f.calls.filter(call=>call.url.pathname==='/drive/v3/about').length,2);assert.equal(f.calls.filter(call=>call.url.pathname===`/drive/v3/files/${documentId}`).length,2);assert.equal(f.calls.filter(call=>call.url.pathname==='/token').length,2);
  }
});

test('replacement refresh credentials cannot reuse the old account identity or old dedicated Doc grant',async t=>{
  for(const unchanged of [true,false]){
    const gate=gateOn(`/drive/v3/files/${documentId}${unchanged?'':'/export'}`),f=await fixture(t,{beforeResponse:gate.beforeResponse}),pending=f.read(unchanged?{ifModifiedTime:modifiedTime}:{});
    await gate.entered;await f.mutateRegistry(reg=>{reg.connections[0].credentials.refresh_token='other-account-refresh';});f.setIdentity('different@example.test');gate.release();
    await assert.rejects(pending,error=>error instanceof DriveStorageError&&error.status===409);
  }
  const metadata={},gate=gateOn(`/drive/v3/files/${documentId}/export`),f=await fixture(t,{metadata,beforeResponse:gate.beforeResponse}),pending=f.read();
  await gate.entered;await f.mutateRegistry(reg=>{reg.connections[0].credentials.refresh_token='rotated-refresh';});metadata.appProperties={};gate.release();
  await assert.rejects(pending,error=>error instanceof DriveStorageError&&error.status===409);
});

test('another credential change during rotated-account verification is rejected before returning the document',async t=>{
  const initial=gateOn(`/drive/v3/files/${documentId}/export`);let aboutReads=0,secondEntered,secondRelease;const secondGate=new Promise(resolve=>{secondEntered=resolve;}),released=new Promise(resolve=>{secondRelease=resolve;});
  const f=await fixture(t,{beforeResponse:async url=>{await initial.beforeResponse(url);if(url.pathname==='/drive/v3/about'&&++aboutReads===2){secondEntered();await released;}}}),pending=f.read();
  await initial.entered;await f.mutateRegistry(reg=>{reg.connections[0].credentials.refresh_token='rotated-refresh';});initial.release();await secondGate;await f.mutateRegistry(reg=>{reg.connections=[];});secondRelease();
  await assert.rejects(pending,error=>error instanceof DriveStorageError&&error.status===503);
});

test('an already cancelled dedicated read performs no authentication or Drive request',async t=>{
  const f=await fixture(t),controller=new AbortController(),reason=Error('fixture cancelled');controller.abort(reason);await assert.rejects(f.read({signal:controller.signal}),error=>error===reason);assert.equal(f.calls.length,0);
});

test('the caller deadline cancels metadata or export network work and prevents subsequent requests',async t=>{
  for(const suffix of ['', '/export']){let entered;const ready=new Promise(resolve=>entered=resolve),controller=new AbortController(),reason=Error('fixture deadline');let networkSignal;const f=await fixture(t,{beforeResponse:async(url,options)=>{if(url.pathname===`/drive/v3/files/${documentId}${suffix}`){networkSignal=options.signal;entered();await new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true}));}}}),pending=f.read({signal:controller.signal});await ready;controller.abort(reason);await assert.rejects(pending,error=>error===reason);assert.equal(networkSignal.aborted,true);if(!suffix)assert.equal(f.calls.some(call=>call.url.pathname.endsWith('/export')),false);}
});

test('cancelling one token consumer preserves the shared refresh and another dedicated reader',async t=>{
  let entered,release;const ready=new Promise(resolve=>entered=resolve),released=new Promise(resolve=>release=resolve);let tokenSignal;const f=await fixture(t,{beforeResponse:async(url,options)=>{if(url.pathname==='/token'){tokenSignal=options.signal;entered();await released;}}}),controller=new AbortController(),reason=Error('cancel only this reader'),cancelled=f.read({signal:controller.signal});await ready;const continuing=f.read();controller.abort(reason);await assert.rejects(cancelled,error=>error===reason);assert.equal(tokenSignal.aborted,false);release();const result=await continuing;assert.equal(result.modifiedTime,modifiedTime);assert.equal(f.calls.filter(call=>call.url.pathname==='/token').length,1);assert.equal(f.calls.filter(call=>call.url.pathname==='/drive/v3/about').length,1);
});
