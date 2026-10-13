import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,writeFile,unlink,symlink,truncate,stat,utimes} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {crc32} from 'node:zlib';
import {once} from 'node:events';
import {Store} from './store.mjs';
import {createClientProjectsService} from './client-projects.mjs';
import {createClientDeliveryArchiveService,CLIENT_DELIVERY_ARCHIVE_LIMITS} from './client-delivery-archive.mjs';

const at='2026-10-13T03:00:00.000Z';
const rejected=(fn,status)=>assert.rejects(fn,error=>error.status===status);
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-delivery-archive-')),store=new Store(directory),clock=()=>at;
  t.after(async()=>{store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-delivery-archive-'));await rm(directory,{recursive:true,force:true});});
  const users={};for(const [name,role,teamId]of [['owner','member','a'],['reviewer','member','a'],['peer','member','a'],['manager','manager','a'],['viewer','viewer','a'],['other','member','b'],['admin','admin',null]])users[name]=store.createUser({name,email:name+'@delivery-archive.test',role,teamId});
  const projects=createClientProjectsService({store,clock}),service=createClientDeliveryArchiveService({store,clientProjects:projects,clock}),project=projects.save(users.owner,{title:'한글 납품 프로젝트',customerName:'합성 고객',reviewerId:users.reviewer.id,contact:'PRIVATE-CONTACT',internalNotes:'PRIVATE-NOTES'}).project;
  const row=()=>store.get('clientProjects',project.id),put=update=>store.put('clientProjects',project.id,{...row(),...update});
  function preview(label='승인 시안',approved=true){projects.addVersion(users.owner,project.id,{revision:row().revision,kind:'preview',label,url:'https://example.test/preview.mp4'});const update=row();if(approved){update.versions.at(-1).approvedAt=at;put(update);}return update.versions.at(-1);}
  function link(url='https://example.test/final.mp4',label='외부 최종본'){projects.addVersion(users.owner,project.id,{revision:row().revision,kind:'final',label,url,guide:'고객에게 전달한 사용 안내'});return row().versions.at(-1);}
  async function file(fileName='최종 영상.mp4',content=Buffer.from('FINAL-VIDEO'),mimeType='video/mp4'){
    const id=randomUUID(),extension={'video/mp4':'mp4','image/png':'png','application/x-subrip':'srt'}[mimeType],media={id,diskName:id+'.'+extension,fileName,mimeType,byteSize:content.length};await mkdir(join(directory,'studio-media'),{recursive:true});await writeFile(join(directory,'studio-media',media.diskName),content);
    projects.addVersion(users.owner,project.id,{revision:row().revision,kind:'final',label:fileName,guide:'최종본 사용 안내'},media);return row().versions.at(-1);
  }
  const prepare=(name='owner',options={})=>service.prepare(users[name],project.id,options),download=async(name='owner',options={})=>{const report=await prepare(name);return service.download(users[name],project.id,{fingerprint:report.fingerprint,...options});};
  const snapshot=()=>JSON.stringify(store.db.prepare('SELECT * FROM documents ORDER BY kind,id').all());
  return {directory,store,users,projects,service,projectId:project.id,row,put,preview,link,file,prepare,download,snapshot};
}
async function collect(result){const chunks=[];for await(const chunk of result.stream)chunks.push(chunk);const bytes=Buffer.concat(chunks);assert.equal(bytes.length,result.contentLength);return bytes;}
// Read central-directory records independently and verify offsets, STORE bytes,
// UTF-8 flags, CRCs and data descriptors with Node's native CRC implementation.
function unzip(bytes){
  const end=bytes.length-22;assert.equal(bytes.readUInt32LE(end),0x06054b50);const count=bytes.readUInt16LE(end+10),directorySize=bytes.readUInt32LE(end+12),directoryOffset=bytes.readUInt32LE(end+16);assert.equal(directoryOffset+directorySize,end);
  let offset=directoryOffset;const files=new Map();
  for(let i=0;i<count;i++){
    assert.equal(bytes.readUInt32LE(offset),0x02014b50);const flags=bytes.readUInt16LE(offset+8),method=bytes.readUInt16LE(offset+10),crc=bytes.readUInt32LE(offset+16),size=bytes.readUInt32LE(offset+20),length=bytes.readUInt16LE(offset+28),local=bytes.readUInt32LE(offset+42),name=bytes.subarray(offset+46,offset+46+length).toString('utf8');assert.equal(flags,0x808);assert.equal(method,0);assert.equal(bytes.readUInt32LE(offset+24),size);assert.equal(bytes.readUInt32LE(local),0x04034b50);assert.equal(bytes.readUInt16LE(local+26),length);assert.equal(bytes.subarray(local+30,local+30+length).toString('utf8'),name);
    const data=bytes.subarray(local+30+length,local+30+length+size),descriptor=local+30+length+size;assert.equal(crc32(data),crc);assert.equal(bytes.readUInt32LE(descriptor),0x08074b50);assert.equal(bytes.readUInt32LE(descriptor+4),crc);assert.equal(bytes.readUInt32LE(descriptor+8),size);assert.equal(bytes.readUInt32LE(descriptor+12),size);assert.ok(!files.has(name));files.set(name,data);offset+=46+length;
  }
  assert.equal(offset,end);return files;
}

test('current approved final media and links form a valid Unicode ZIP without changing any source',async t=>{
  const f=await fixture(t);f.preview();const video=await f.file(),subtitle=await f.file('최종 자막.srt',Buffer.from('1\n00:00:00,000 --> 00:00:01,000\n안녕'),'application/x-subrip');f.link();const before=f.snapshot(),report=await f.prepare();assert.equal(report.schema,1);assert.deepEqual(report.counts,{files:2,links:1,entries:4});assert.equal(report.totalBytes,video.media.byteSize+subtitle.media.byteSize);assert.match(report.fingerprint,/^[a-f0-9]{64}$/);assert.doesNotMatch(JSON.stringify(report),/diskName|studio-media|PRIVATE-/);
  const result=await f.download(),archive=unzip(await collect(result));assert.equal(result.mimeType,'application/zip');assert.match(result.fileName,/한글.*\.zip$/);assert.deepEqual([...archive.keys()],['최종 파일/최종 영상.mp4','최종 파일/최종 자막.srt','납품 안내.txt','외부 링크.txt']);assert.equal(archive.get('최종 파일/최종 영상.mp4').toString(),'FINAL-VIDEO');assert.match(archive.get('납품 안내.txt').toString(),/실제 파일: 2개/);assert.match(archive.get('외부 링크.txt').toString(),/https:\/\/example.test\/final.mp4/);assert.doesNotMatch(Buffer.concat([...archive.values()]).toString(),/PRIVATE-|preview\.mp4/);assert.equal(f.snapshot(),before);
});

test('only current final versions are included, not previews, prior finals or draft assets',async t=>{
  const f=await fixture(t);f.preview('예전 승인');await f.file('예전.mp4',Buffer.from('OLD-FINAL'));f.preview('현재 승인');await f.file('현재.mp4',Buffer.from('CURRENT-FINAL'));const row=f.row();row.studio={assets:[{id:randomUUID(),fileName:'INTERNAL-ORIGINAL.mp4'}]};f.put(row);f.store.put('clientDeliveryDrafts','private-draft',{items:[{label:'DRAFT-VIDEO'}]});const archive=unzip(await collect(await f.download()));assert.deepEqual([...archive.keys()],['최종 파일/현재.mp4','납품 안내.txt']);assert.doesNotMatch(Buffer.concat([...archive.values()]).toString(),/OLD-FINAL|INTERNAL-ORIGINAL|DRAFT-VIDEO/);
});

test('external-only delivery reports zero actual files and exports addresses without fetching anything',async t=>{
  const f=await fixture(t);f.preview();f.link('https://127.0.0.1:1/never-fetch');const report=await f.prepare();assert.deepEqual(report.counts,{files:0,links:1,entries:2});assert.equal(report.totalBytes,0);assert.match(report.warnings.join(' '),/대상 파일은 ZIP에 포함되지/);const archive=unzip(await collect(await f.download()));assert.deepEqual([...archive.keys()],['납품 안내.txt','외부 링크.txt']);assert.match(archive.get('납품 안내.txt').toString(),/실제 파일: 0개/);
});

test('new unapproved preview cannot inherit an earlier final archive',async t=>{
  const f=await fixture(t);f.preview();f.link();const report=await f.prepare();f.preview('새 시안',false);await rejected(()=>f.prepare(),409);await rejected(()=>f.service.download(f.users.owner,f.projectId,{fingerprint:report.fingerprint}),409);
});

test('preparation and download use current ACL, including viewer and archive but not a stale admin identity',async t=>{
  const f=await fixture(t);f.preview();f.link();for(const name of ['owner','reviewer','manager','viewer','admin'])assert.equal((await f.prepare(name)).projectId,f.projectId);for(const name of ['peer','other'])await rejected(()=>f.prepare(name),404);await rejected(()=>f.service.prepare(null,f.projectId),401);await rejected(()=>f.service.prepare(f.users.owner,'bad'),400);
  const report=await f.prepare();f.put({stage:'archived'});assert.equal((await f.prepare()).projectId,f.projectId);await rejected(()=>f.service.download(f.users.owner,f.projectId,{fingerprint:report.fingerprint}),409);
  f.store.put('users',f.users.admin.id,{...f.users.admin,role:'member',teamId:'b'});await rejected(()=>f.prepare('admin'),404);f.store.put('users',f.users.owner.id,{...f.users.owner,active:false});await rejected(()=>f.prepare(),401);
});

test('download snapshot binds user, role, project revision, delivery set and guide',async t=>{
  const f=await fixture(t);f.preview();f.link();let report=await f.prepare();await rejected(()=>f.service.download(f.users.viewer,f.projectId,{fingerprint:report.fingerprint}),409);
  let row=f.row();row.versions.at(-1).guide='새 사용 안내';f.put(row);await rejected(()=>f.service.download(f.users.owner,f.projectId,{fingerprint:report.fingerprint}),409);
  report=await f.prepare();f.put({revision:f.row().revision+1});await rejected(()=>f.service.download(f.users.owner,f.projectId,{fingerprint:report.fingerprint}),409);
  report=await f.prepare();f.link('https://example.test/extra.png');await rejected(()=>f.service.download(f.users.owner,f.projectId,{fingerprint:report.fingerprint}),409);
});

test('files with duplicate case, Unicode normalization and unsafe names get flat safe unique names',async t=>{
  const f=await fixture(t);f.preview();await f.file('../CON.mp4');await f.file('FINAL.mp4');await f.file('final.mp4');await f.file('가.mp4');await f.file('가.mp4');await f.file('A\\B:*.mp4');const archive=unzip(await collect(await f.download())),names=[...archive.keys()].filter(name=>name.startsWith('최종 파일/')).map(name=>name.slice(6));assert.equal(new Set(names.map(name=>name.normalize('NFC').toLowerCase())).size,6);for(const name of names){assert.doesNotMatch(name,/[\\/:*?"<>|]/);assert.ok(!name.startsWith('.'));}assert.ok(names.includes('final (2).mp4'));assert.ok(names.includes('가 (2).mp4'));
});

test('the same stored source and external URL are included once while all delivery uses and guides remain',async t=>{
  const f=await fixture(t);f.preview();const first=await f.file();f.projects.addVersion(f.users.owner,f.projectId,{revision:f.row().revision,kind:'final',label:'동일 원본 두 번째 용도',guide:'두 번째 용도 안내'},first.media);f.link('https://example.test/shared','첫 번째 외부 용도');f.link('https://example.test/shared','두 번째 외부 용도');
  const report=await f.prepare();assert.deepEqual(report.counts,{files:1,links:1,entries:3});assert.equal(report.totalBytes,first.media.byteSize);assert.equal(report.files[0].versionIds.length,2);assert.equal(report.links[0].versionIds.length,2);assert.match(report.links[0].label,/첫 번째.*두 번째/);const archive=unzip(await collect(await f.download()));assert.equal([...archive.keys()].filter(name=>name.startsWith('최종 파일/')).length,1);assert.match(archive.get('납품 안내.txt').toString(),/동일 원본 두 번째 용도/);assert.match(archive.get('납품 안내.txt').toString(),/두 번째 용도 안내/);assert.equal(archive.get('외부 링크.txt').toString().split('https://example.test/shared').length-1,1);
  const row=f.row();row.versions.find(version=>version.label==='동일 원본 두 번째 용도').media.fileName='잘못 바뀐 이름.mp4';f.put(row);await rejected(()=>f.prepare(),409);
});

test('truncating long Unicode filenames never splits a surrogate pair',async t=>{
  const f=await fixture(t);f.preview();await f.file();const row=f.row();row.versions.at(-1).media.fileName='😀'.repeat(180)+'.mp4';f.put(row);const report=await f.prepare();assert.ok(report.files[0].fileName.isWellFormed());assert.ok(Array.from(report.files[0].fileName).length<=150);assert.ok(report.files[0].fileName.endsWith('.mp4'));const archive=unzip(await collect(await f.download()));assert.doesNotMatch([...archive.keys()].join(' '),/\uFFFD/);
});

test('missing or changed local media fails rather than silently falling back to an external URL',async t=>{
  const f=await fixture(t);f.preview();const version=await f.file(),path=join(f.directory,'studio-media',version.media.diskName);let row=f.row();row.versions.at(-1).url='https://example.test/fallback.mp4';f.put(row);const report=await f.prepare();await unlink(path);await rejected(()=>f.prepare(),409);await rejected(()=>f.service.download(f.users.owner,f.projectId,{fingerprint:report.fingerprint}),409);await writeFile(path,'different-length');await rejected(()=>f.prepare(),409);
});

test('same-size replacement changes the preparation fingerprint',async t=>{
  const f=await fixture(t);f.preview();const version=await f.file('movie.mp4',Buffer.from('AAAA')),path=join(f.directory,'studio-media',version.media.diskName),report=await f.prepare();await unlink(path);await writeFile(path,'BBBB');assert.notEqual((await f.prepare()).fingerprint,report.fingerprint);await rejected(()=>f.service.download(f.users.owner,f.projectId,{fingerprint:report.fingerprint}),409);
});

test('invalid storage identity, traversal, private versions and malformed external URLs fail closed',async t=>{
  const f=await fixture(t);f.preview();const version=await f.file(),original=f.row();for(const diskName of ['../outside.mp4',randomUUID()+'.mp4']){const row=structuredClone(original);row.versions.at(-1).media.diskName=diskName;f.put(row);await rejected(()=>f.prepare(),409);}
  for(const visibility of ['private','internal','hidden']){const row=structuredClone(original);row.versions.at(-1).visibility=visibility;f.put(row);await rejected(()=>f.prepare(),409);}
  const row=structuredClone(original);delete row.versions.at(-1).media;row.versions.at(-1).url='https://user:password@example.test/video';f.put(row);await rejected(()=>f.prepare(),409);assert.ok(version.media.id);
});

test('symlink media cannot substitute an outside file',async t=>{
  const f=await fixture(t);f.preview();const version=await f.file(),path=join(f.directory,'studio-media',version.media.diskName),outside=join(f.directory,'outside.mp4');await writeFile(outside,Buffer.alloc(version.media.byteSize));await unlink(path);try{await symlink(outside,path,'file');}catch(error){if(['EPERM','EACCES'].includes(error.code)){t.skip('Windows host has no file symlink privilege');return;}throw error;}await rejected(()=>f.prepare(),409);
});

test('bounded size rejects oversized sparse files before reading any media bytes',async t=>{
  const f=await fixture(t);f.preview();const version=await f.file(),path=join(f.directory,'studio-media',version.media.diskName),size=CLIENT_DELIVERY_ARCHIVE_LIMITS.bytes+1;await truncate(path,size);const row=f.row();row.versions.at(-1).media.byteSize=size;f.put(row);await rejected(()=>f.prepare(),413);
});

test('authentication change during async preparation is rechecked',async t=>{
  const f=await fixture(t);f.preview();await f.file();let calls=0;await rejected(()=>f.prepare('owner',{authorize(){if(++calls===2)f.store.put('users',f.users.owner.id,{...f.users.owner,active:false});}}),401);
});

test('stream revalidates current bundle before sending data and cleans up a rejected download',async t=>{
  const f=await fixture(t);f.preview();await f.file();const result=await f.download();f.put({revision:f.row().revision+1});await rejected(()=>collect(result),409);const next=await f.download();assert.ok(unzip(await collect(next)).size);
});

test('authority revoked partway through a stream prevents a complete ZIP central directory',async t=>{
  const f=await fixture(t);f.preview();await f.file('large.mp4',Buffer.alloc(2*1024*1024,7));let authorized=true;const result=await f.download('owner',{authorize(){if(!authorized)throw Object.assign(new Error('session revoked'),{status:401});}});let emitted=0;await rejected(async()=>{for await(const chunk of result.stream){emitted+=chunk.length;if(emitted>65536)authorized=false;}},401);assert.ok(emitted<result.contentLength);
});

test('stream catches a file modified after preflight and does not emit a complete valid ZIP',async t=>{
  const f=await fixture(t);f.preview();const version=await f.file('large.mp4',Buffer.alloc(512*1024,7)),path=join(f.directory,'studio-media',version.media.diskName),uploaded=new Date(Date.now()-60000);
  // Real uploads finish long before a delivery is prepared. Backdate the original so the
  // rewrite cannot share its file-time tick: Windows can give two same-size writes a few ms
  // apart identical mtime/ctime, and then no stat check can tell the files apart.
  await utimes(path,uploaded,uploaded);const result=await f.download();await writeFile(path,Buffer.alloc(version.media.byteSize,8));let emitted=0;await rejected(async()=>{for await(const chunk of result.stream)emitted+=chunk.length;},409);assert.ok(emitted<result.contentLength);
});

test('same-user concurrent stream is bounded and an unconsumed destroyed stream releases its handles',async t=>{
  const f=await fixture(t);f.preview();await f.file();const first=await f.download();await rejected(()=>f.download(),429);const closed=once(first.stream,'close');first.stream.destroy();await closed;await new Promise(resolve=>setTimeout(resolve,20));const second=await f.download();assert.ok(unzip(await collect(second)).size);assert.equal((await stat(join(f.directory,'studio-media',f.row().versions.at(-1).media.diskName))).size,f.row().versions.at(-1).media.byteSize);
});

test('download requires a valid prepared fingerprint and does not expose source paths on failure',async t=>{
  const f=await fixture(t);f.preview();f.link();for(const fingerprint of [undefined,'','../path','0'.repeat(64)])await rejected(()=>f.service.download(f.users.owner,f.projectId,{fingerprint}),fingerprint?.length===64?409:400);
});
