import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm,symlink,unlink} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID,createHash} from 'node:crypto';
import {Store} from './store.mjs';
import {createStudioService} from './studio-service.mjs';
import {createPublicationInboxService} from './publication-inbox.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
const video=Buffer.concat([Buffer.from([0,0,0,16]),Buffer.from('ftypisom0000'),Buffer.alloc(80)]);
const subtitle='1\n00:00:00,000 --> 00:00:00,900\n안녕하세요.\n';
async function fixture(t,{enabled=true}={}){
  const directory=await mkdtemp(join(tmpdir(),'synk-publication-inbox-')),store=new Store(directory),studio=createStudioService({store}),owner=store.createUser({name:'완성본 담당',email:'owner@example.test'}),other=store.createUser({name:'다른 담당',email:'other@example.test'}),viewer=store.createUser({name:'열람',email:'viewer@example.test',role:'viewer'});
  const service=createPublicationInboxService({store,studio,enabled}),services=[service];
  t.after(async()=>{for(const item of services)await item.stop();store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-publication-inbox-'));await rm(directory,{recursive:true,force:true});});
  async function delivery({user=owner,id=randomUUID(),change={},bytes=video,captions=subtitle,partial=false,ready=true}={}){
    const inboxPath=service.state(user).inboxPath,folder=join(inboxPath,partial?'.partial-'+id:id);await mkdir(folder,{recursive:true});
    const manifest={schema:1,deliveryId:id,confirmed:true,finalizedAt:'2026-10-11T12:00:00+09:00',title:'확정한 한 편',body:'직접 해 보는 한국어 한 문장',link:'https://example.test/resource',language:'ko',channels:['youtube-shorts','instagram-reels'],mode:'adapt',video:{fileName:'video.mp4',byteSize:bytes.length,sha256:hash(bytes)},...(captions!==null?{subtitle:{fileName:'subtitle.srt',byteSize:Buffer.byteLength(captions),sha256:hash(captions)}}:{}),...change};
    await writeFile(join(folder,'video.mp4'),bytes);if(captions!==null)await writeFile(join(folder,'subtitle.srt'),captions);if(ready)await writeFile(join(folder,'ready.json'),JSON.stringify(manifest));return {id,folder,manifest};
  }
  const restart=()=>{const next=createPublicationInboxService({store,studio,enabled});services.push(next);return next;};
  return {directory,store,studio,owner,other,viewer,service,delivery,restart};
}

test('local opt-in creates only the current user folder, rejects viewers and revoked configure sessions',async t=>{
  const f=await fixture(t);assert.equal(f.service.state(f.owner).active,false);
  const result=await f.service.configure(f.owner,{active:true,userId:f.other.id,directory:'C:/elsewhere'});assert.equal(result.inboxPath,join(f.directory,'publication-inbox',f.owner.id));assert.equal(result.active,true);
  await assert.rejects(f.service.configure(f.viewer,{active:true}),error=>error.status===403);assert.equal(f.service.state(f.viewer).inboxPath,undefined);
  let calls=0;await assert.rejects(f.service.configure(f.other,{active:true},{authorize(){if(++calls===2)throw new Error('revoked');}}),/revoked/);assert.equal(f.service.state(f.other).active,false);
  const disabled=createPublicationInboxService({store:f.store,studio:f.studio,enabled:false});await assert.rejects(disabled.configure(f.owner,{active:true}),error=>error.status===403);assert.equal(disabled.state(f.owner).available,false);await disabled.stop();
});

test('confirmed files become one private Studio version and a ready package draft, originals remain intact',async t=>{
  const f=await fixture(t);await f.service.configure(f.owner,{active:true});const delivered=await f.delivery();await f.service.scan();
  const state=f.service.state(f.owner);assert.equal(state.entries.length,1);const entry=state.entries[0];assert.equal(entry.status,'ready');assert.equal(entry.title,'확정한 한 편');assert.ok(state.lastScanAt);
  const {draft,production}=f.service.readDraft(f.owner,delivered.id);assert.equal(production.stage,'ready');assert.equal(production.ownerId,f.owner.id);assert.equal(production.teamId,null);assert.equal(production.versions.length,1);assert.equal(draft.subtitleText,subtitle.trim());assert.equal(draft.body,delivered.manifest.body);assert.deepEqual(draft.channels,delivered.manifest.channels);
  const media=f.studio.readableMedia(f.owner,production.versions[0].mediaId);assert.deepEqual(await readFile(join(f.directory,'studio-media',media.diskName)),video);assert.deepEqual(await readFile(join(delivered.folder,'video.mp4')),video);assert.equal(await readFile(join(delivered.folder,'subtitle.srt'),'utf8'),subtitle);
  assert.equal(f.service.state(f.other).entries.length,0);assert.throws(()=>f.service.readDraft(f.other,delivered.id),error=>error.status===404);assert.throws(()=>f.studio.readableMedia(f.other,media.id),error=>error.status===404);
  assert.equal(f.store.all('studioPublicationPackages').length,0,'only prepares a draft; no render or public post');assert.equal(f.store.all('postPerformanceEntries').length,0);
});

test('partial folders and folders without ready.json stay pending until explicit completion',async t=>{
  const f=await fixture(t);await f.service.configure(f.owner,{active:true});await f.delivery({partial:true});const pending=await f.delivery({ready:false});await f.service.scan();assert.equal(f.service.state(f.owner).entries.length,0);
  await writeFile(join(pending.folder,'ready.json'),JSON.stringify(pending.manifest));await f.service.scan();assert.equal(f.service.state(f.owner).entries.length,1);
});

test('inactive settings and freshly revoked users never import, with no stale client authority',async t=>{
  const f=await fixture(t);const d=await f.delivery();await f.service.scan();assert.equal(f.store.all('studioProductions').length,0);await f.service.configure(f.owner,{active:true});
  f.store.put('users',f.owner.id,{...f.owner,role:'viewer'});await f.service.scan();assert.equal(f.store.all('studioProductions').length,0);assert.throws(()=>f.service.scan({user:f.owner}),error=>error.status===403);
  f.store.put('users',f.owner.id,{...f.owner,active:false});await f.service.scan();assert.equal(f.store.all('studioProductions').length,0);assert.throws(()=>f.service.state(f.owner),error=>error.status===401);
  f.store.put('users',f.owner.id,f.owner);await f.service.scan();assert.equal(f.service.readDraft(f.owner,d.id).production.ownerId,f.owner.id);
});

test('rescan and process restart reuse the receipt; same content with a new delivery ID deduplicates',async t=>{
  const f=await fixture(t);await f.service.configure(f.owner,{active:true});const first=await f.delivery();await f.service.scan();const original=f.service.readDraft(f.owner,first.id);await f.service.scan();
  await f.service.stop();const restarted=f.restart();await restarted.scan();assert.equal(f.store.all('studioProductions').length,1);assert.equal(f.store.all('studioMedia').length,1);
  const next=await f.delivery({change:{finalizedAt:'2026-10-11T13:00:00+09:00'}});await restarted.scan();const row=restarted.state(f.owner).entries.find(x=>x.id===next.id);assert.equal(row.status,'duplicate');assert.equal(row.productionId,original.production.id);assert.equal(f.store.all('studioProductions').length,1);assert.equal((await readdir(join(f.directory,'studio-media'))).length,1);
});

test('changed duplicate ID cannot overwrite the stored original or package draft',async t=>{
  const f=await fixture(t);await f.service.configure(f.owner,{active:true});const first=await f.delivery();await f.service.scan();const before=f.service.readDraft(f.owner,first.id),stored=f.store.all('studioMedia')[0];
  await writeFile(join(first.folder,'ready.json'),JSON.stringify({...first.manifest,title:'변경한 제목'}));await f.service.scan();const entry=f.service.state(f.owner).entries[0];assert.equal(entry.status,'error');assert.match(entry.message,/보존/);assert.equal(f.service.readDraft(f.owner,first.id).draft.title,before.draft.title);assert.deepEqual(await readFile(join(f.directory,'studio-media',stored.diskName)),video);assert.equal(f.store.all('studioProductions').length,1);
  await writeFile(join(first.folder,'ready.json'),JSON.stringify(first.manifest));await f.service.scan();assert.equal(f.service.state(f.owner).entries[0].status,'ready');
});

test('invalid confirmation, traversal, signature, hash, subtitle, copy and unsupported channels surface actionable errors',async t=>{
  const f=await fixture(t);await f.service.configure(f.owner,{active:true});
  const cases=[{change:{confirmed:false}}, {change:{video:{fileName:'../private.mp4',byteSize:video.length,sha256:hash(video)}}}, {bytes:Buffer.from('not a video')}, {change:{video:{fileName:'video.mp4',byteSize:video.length,sha256:'0'.repeat(64)}}}, {captions:'1\n00:00:02,000 --> 00:00:01,000\n역순'}, {change:{body:'x'.repeat(2201)}}, {change:{channels:['unknown']}}, {change:{subtitle:{fileName:'subtitle.srt',byteSize:257*1024,sha256:hash(subtitle)}}}, {change:{video:{fileName:'video.mp4',byteSize:101*1024*1024,sha256:hash(video)}}}, {change:{link:'https://secret:password@example.test/'}}];
  for(const item of cases)await f.delivery(item);await f.service.scan();assert.equal(f.service.state(f.owner).entries.length,cases.length);assert.ok(f.service.state(f.owner).entries.every(row=>row.status==='error'&&!row.draft));assert.equal(f.store.all('studioProductions').length,0);assert.equal(f.store.all('studioMedia').length,0);
});

test('a rejected delivery can be corrected without preserving a broken receipt',async t=>{
  const f=await fixture(t);await f.service.configure(f.owner,{active:true});const d=await f.delivery({change:{confirmed:false}});await f.service.scan();assert.equal(f.service.state(f.owner).entries[0].status,'error');await writeFile(join(d.folder,'ready.json'),JSON.stringify({...d.manifest,confirmed:true}));await f.service.scan();assert.equal(f.service.state(f.owner).entries[0].status,'ready');assert.equal(f.store.all('studioProductions').length,1);
});

test('folder junctions and file symlinks cannot import content from outside the inbox',async t=>{
  const f=await fixture(t);await f.service.configure(f.owner,{active:true});const external=join(f.directory,'external');await mkdir(external);const id=randomUUID();await symlink(external,join(f.service.state(f.owner).inboxPath,id),'junction');await f.service.scan();assert.equal(f.service.state(f.owner).entries[0].status,'error');assert.equal(f.store.all('studioProductions').length,0);
  const d=await f.delivery();await unlink(join(d.folder,'video.mp4'));const target=join(external,'video.mp4');await writeFile(target,video);try{await symlink(target,join(d.folder,'video.mp4'),'file');}catch(error){if(error.code==='EPERM'){t.diagnostic('Windows file symlink privilege unavailable; directory junction rejection verified');return;}throw error;}await f.service.scan();assert.equal(f.service.state(f.owner).entries.find(x=>x.id===d.id).status,'error');assert.equal(f.store.all('studioMedia').length,0);
});

test('session revocation during file work leaves no production, receipt or copied media',async t=>{
  const f=await fixture(t);await f.service.configure(f.owner,{active:true});await f.delivery();let calls=0;await assert.rejects(f.service.scan({user:f.owner,authorize(){if(++calls>=7)throw new Error('session revoked');}}),/session revoked/);assert.equal(f.store.all('studioProductions').length,0);assert.equal(f.store.all('studioMedia').length,0);assert.equal(f.store.all('publicationInboxEntries').length,0);assert.deepEqual(await readdir(join(f.directory,'studio-media')).catch(error=>error.code==='ENOENT'?[]:Promise.reject(error)),[]);
});

test('database failure rolls back production/media/receipt together and removes only its copied file',async t=>{
  const f=await fixture(t);await f.service.configure(f.owner,{active:true});const d=await f.delivery(),put=f.store.put.bind(f.store);let rejected=false;f.store.put=(kind,id,row)=>{if(kind==='publicationInboxEntries'&&row.status==='ready'){rejected=true;throw new Error('simulated disk failure');}return put(kind,id,row);};await f.service.scan();f.store.put=put;
  assert.equal(rejected,true);assert.equal(f.store.all('studioProductions').length,0);assert.equal(f.store.all('studioMedia').length,0);assert.equal(f.service.state(f.owner).entries[0].status,'error');assert.deepEqual(await readdir(join(f.directory,'studio-media')),[]);assert.deepEqual(await readFile(join(d.folder,'video.mp4')),video);await f.service.scan();assert.equal(f.store.all('studioProductions').length,1);
});

test('persisted leases prevent another service processing the same job and recover only expired orphan files',async t=>{
  const f=await fixture(t);await f.service.configure(f.owner,{active:true});await f.delivery();const orphan=randomUUID();await mkdir(join(f.directory,'studio-media'));await writeFile(join(f.directory,'studio-media',orphan+'.upload'),'partial');
  f.store.put('publicationInboxLocks',f.owner.id,{id:f.owner.id,token:'other-process',expiresAt:Date.now()+60000,pendingMedia:[orphan]});await f.service.scan();assert.equal(f.store.all('studioProductions').length,0);assert.equal((await readdir(join(f.directory,'studio-media'))).length,1);
  f.store.put('publicationInboxLocks',f.owner.id,{id:f.owner.id,token:'dead-process',expiresAt:Date.now()-1,pendingMedia:[orphan]});await f.restart().scan();assert.equal(f.store.all('studioProductions').length,1);assert.equal((await readdir(join(f.directory,'studio-media'))).length,1);assert.equal(f.store.get('publicationInboxLocks',f.owner.id),null);
});

test('overlapping manual scans never return another user state',async t=>{
  const f=await fixture(t);await f.service.configure(f.owner,{active:true});await f.service.configure(f.other,{active:true});await f.delivery();const first=f.service.scan({user:f.owner}),other=f.service.scan({user:f.other});const [a,b]=await Promise.all([first,other]);assert.equal(a.entries.length,1);assert.equal(b.entries.length,0);assert.equal(b.inboxPath,join(f.directory,'publication-inbox',f.other.id));
});

test('draft body may be filled later and list responses never include copy or subtitles',async t=>{
  const f=await fixture(t);await f.service.configure(f.owner,{active:true});const d=await f.delivery({change:{body:''}});await f.service.scan();const entry=f.service.state(f.owner).entries[0];assert.equal(entry.status,'ready');assert.equal(entry.draft,undefined);assert.equal(f.service.readDraft(f.owner,d.id).draft.body,'');assert.equal(JSON.stringify(entry).includes(subtitle.trim()),false);
});

test('pausing during the final copy discards the import and preserves all source files',async t=>{
  const f=await fixture(t);await f.service.configure(f.owner,{active:true});const d=await f.delivery();let calls=0;await assert.rejects(f.service.scan({user:f.owner,authorize(){if(++calls===7)void f.service.configure(f.owner,{active:false});}}),/설정|꺼지/);assert.equal(f.service.state(f.owner).active,false);assert.equal(f.store.all('studioProductions').length,0);assert.equal(f.store.all('studioMedia').length,0);assert.deepEqual(await readdir(join(f.directory,'studio-media')),[]);assert.deepEqual(await readFile(join(d.folder,'video.mp4')),video);
});

test('changed source metadata invalidates the cached receipt while stored media stays immutable',async t=>{
  const f=await fixture(t);await f.service.configure(f.owner,{active:true});const d=await f.delivery();await f.service.scan();const before=f.store.get('publicationInboxEntries',f.owner.id+':'+d.id);assert.match(before.sourceStamp,/^[a-f0-9]{64}$/);await f.service.scan();assert.equal(f.store.get('publicationInboxEntries',f.owner.id+':'+d.id).updatedAt,before.updatedAt,'unchanged files retain their validated receipt without a write');const changed=Buffer.from(video);changed[changed.length-1]=255;await writeFile(join(d.folder,'video.mp4'),changed);await f.service.scan();assert.equal(f.service.state(f.owner).entries[0].status,'error');const media=f.store.all('studioMedia')[0];assert.deepEqual(await readFile(join(f.directory,'studio-media',media.diskName)),video);
});

test('an unavailable inbox records a visible error and clears it after repair',async t=>{
  const f=await fixture(t);const config=await f.service.configure(f.owner,{active:true});await rm(config.inboxPath,{recursive:true});await writeFile(config.inboxPath,'not a directory');await f.service.scan();assert.ok(f.service.state(f.owner).message);await unlink(config.inboxPath);await f.service.scan();assert.equal(f.service.state(f.owner).message,null);
});
