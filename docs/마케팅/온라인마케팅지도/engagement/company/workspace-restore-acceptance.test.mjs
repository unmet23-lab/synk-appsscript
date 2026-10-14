import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,cp,rm,readdir,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {Store} from './store.mjs';
import {backupWorkspace} from './workspace-backup.mjs';
import {acceptWorkspaceRestore} from './workspace-restore-acceptance.mjs';
import {createMessenger} from '../../../../../tools/company-messenger/server.mjs';

const run=promisify(execFile),prefix='synk-shift-recovery-acceptance-';
const hash=value=>createHash('sha256').update(value).digest('hex');
async function hashes(root){
  const result={};
  async function visit(directory){for(const entry of await readdir(directory,{withFileTypes:true})){const path=join(directory,entry.name);if(entry.isDirectory())await visit(path);else result[path]=hash(await readFile(path));}}
  await visit(root);return result;
}
async function editDb(path,fn){const db=new DatabaseSync(path);try{fn(db);}finally{db.close();}}
async function fixture(t){
  const root=await mkdtemp(join(tmpdir(),prefix)),companyDir=join(root,'original-company'),messengerDir=join(root,'original-messenger');
  t.after(async()=>{const actual=resolve(root);assert.ok(actual.startsWith(resolve(tmpdir())+sep)&&actual.split(sep).at(-1).startsWith(prefix));await rm(actual,{recursive:true,force:true});});
  let store=new Store(companyDir),messenger=createMessenger({dataDir:messengerDir,port:0});
  const active=store.createUser({email:'active@recovery.example.test',name:'합성 활성'}),deleted=store.createUser({email:'deleted@recovery.example.test',name:'합성 삭제'});
  const privateText='SYNTHETIC_PRIVATE_DRAFT_NEVER_REPORT',privateSecret='SYNTHETIC_PRIVATE_SECRET_NEVER_REPORT';
  const activeState={save:true,profile:{personId:active.id},draft:privateText},deletedState={save:true,profile:{personId:deleted.id},draft:privateText+'-deleted'};
  const envelope=(id,revision,status,state)=>({version:1,ownerId:id,revision,status,updatedAt:'2026-10-07T01:00:00.000Z',...(status==='active'?{ciphertext:store.encrypt(state)}:{})});
  store.put('workroomPracticeSync',active.id,envelope(active.id,1,'active',activeState));store.put('workroomPracticeSync',deleted.id,envelope(deleted.id,1,'active',deletedState));store.setSecret('recovery-synthetic-secret',{value:privateSecret});
  const media='61234567-1234-4234-8234-123456789abc.mp4',attachment='61234567-1234-4234-8234-123456789abc.bin';
  store.put('studioMedia','recovery-synthetic-media',{diskName:media});await mkdir(join(companyDir,'studio-media'));await writeFile(join(companyDir,'studio-media',media),'synthetic-media');
  messenger.db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?)').run('recovery-m-user','recovery','합성','owner','synthetic-unused','2026-10-07');
  messenger.db.prepare('INSERT INTO channels (id,name,description,kind,pair_key,created_at) VALUES (?,?,?,?,?,?)').run('recovery-channel','합성','','channel',null,'2026-10-07');
  messenger.db.prepare('INSERT INTO messages (channel_id,user_id,body,created_at) VALUES (?,?,?,?)').run('recovery-channel','recovery-m-user','synthetic-first-message','2026-10-07');
  messenger.db.prepare('INSERT INTO files (id,channel_id,uploader_id,name,size,mime,disk_name,created_at) VALUES (?,?,?,?,?,?,?,?)').run('recovery-file','recovery-channel','recovery-m-user','synthetic.txt',17,'text/plain',attachment,'2026-10-07');
  await writeFile(join(messengerDir,'uploads',attachment),'synthetic-attachment');await writeFile(join(messengerDir,'drive-storage.json'),JSON.stringify({syntheticCredential:privateSecret}));
  const links=[{companyUserId:active.id,messengerUserId:'recovery-m-user'}];await writeFile(join(companyDir,'workspace-integration.json'),JSON.stringify({messengerDataDir:messengerDir,identityLinks:links}));
  store.close();await messenger.close();
  const old=await backupWorkspace({destination:join(root,'old-backups'),companyDataDir:companyDir});
  store=new Store(companyDir);store.put('workroomPracticeSync',active.id,envelope(active.id,2,'active',{...activeState,draft:privateText+'-new'}));store.put('workroomPracticeSync',deleted.id,envelope(deleted.id,2,'deleted'));store.close();
  await editDb(join(messengerDir,'messenger.sqlite'),db=>db.prepare('UPDATE messages SET body=? WHERE id=1').run('synthetic-new-message'));
  const latest=await backupWorkspace({destination:join(root,'latest-backups'),companyDataDir:companyDir});
  async function clone(name,source=latest){const path=join(root,name);await cp(source,path,{recursive:true,errorOnExist:true,force:false});return path;}
  const latestCandidate=await clone('latest-candidate');
  async function evidence(baseline=latest){const manifest=JSON.parse(await readFile(join(baseline,'integration-manifest.json'),'utf8'));return {kind:'synthetic-rehearsal',declaredLatest:true,writersStopped:true,writersStoppedAt:manifest.createdAt,baselineCreatedAt:manifest.createdAt,recordedAt:new Date().toISOString()};}
  async function accept(candidateDirectory=latestCandidate,other={}){return acceptWorkspaceRestore({candidateDirectory,baselineDirectory:latest,freshnessEvidence:await evidence(),...other});}
  return {root,companyDir,messengerDir,active,deleted,privateText,privateSecret,media,attachment,old,latest,latestCandidate,clone,evidence,accept};
}
function noSecrets(f,report){const text=JSON.stringify(report);for(const value of [f.privateText,f.privateSecret,f.active.id,f.deleted.id,'recovery-m-user'])assert.equal(text.includes(value),false,'reports must omit private values and account identifiers');assert.doesNotMatch(text,/ciphertext|passwordHash|[a-f0-9]{64}/,'reports must omit secret fields and their digests');}

test('latest stopped workspace backup prepares only a new isolated copy and keeps originals byte-for-byte unchanged',async t=>{
  const f=await fixture(t),before=await hashes(f.root),destination=join(f.root,'isolated-accepted');
  const report=await f.accept(f.latestCandidate,{destination});assert.equal(report.status,'candidate-matches-declared-baseline',JSON.stringify(report));assert.equal(report.candidateMatchesDeclaredBaseline,true);assert.equal(report.preparedIsolatedCopy,true);assert.equal(report.sourceFilesUnchanged,true);assert.equal(report.productionTrafficAllowed,false);assert.equal(report.latestnessIndependentlyVerified,false);assert.deepEqual(report.counts,{practiceActive:1,practiceDeleted:1,identityLinks:1});assert.deepEqual(report.issues,[]);
  const after=await hashes(f.root);for(const [path,digest] of Object.entries(before))assert.equal(after[path],digest,'all source and latest preserved data must remain unchanged');
  assert.equal(hash(await readFile(join(destination,'company','encryption.key'))),hash(await readFile(join(f.latest,'company','encryption.key'))));
  const config=JSON.parse(await readFile(join(destination,'company','workspace-integration.json'),'utf8'));assert.equal(config.messengerDataDir,join(destination,'messenger'));assert.equal(config.identityLinks[0].companyUserId,f.active.id);
  assert.match(await readFile(join(destination,'PREPARATION_INCOMPLETE'),'utf8'),/Do not start a host/);noSecrets(f,report);noSecrets(f,JSON.parse(await readFile(join(destination,'RECOVERY_ACCEPTANCE.json'),'utf8')));
});

test('pre-deletion backup is rejected for deleted content, later edits and both DB changes before any copy',async t=>{
  const f=await fixture(t),before=await hashes(f.root),destination=join(f.root,'must-not-exist');
  const report=await f.accept(f.old,{destination});assert.equal(report.candidateMatchesDeclaredBaseline,false);assert.equal(report.status,'rejected');assert.equal(report.sourceFilesUnchanged,true);
  for(const code of ['DELETION_NOT_PRESERVED','PRACTICE_CHANGE_NOT_PRESERVED','COMPANY_DATABASE_DIFFERS','MESSENGER_DATABASE_DIFFERS'])assert.ok(report.issues.includes(code),code);
  await assert.rejects(access(destination),{code:'ENOENT'});assert.deepEqual(await hashes(f.root),before);noSecrets(f,report);
});

test('a matching pair of old snapshots establishes equality only and never independently proves latestness or allows traffic',async t=>{
  const f=await fixture(t),oldCopy=await f.clone('old-identical-candidate',f.old),report=await f.accept(oldCopy,{baselineDirectory:f.old,freshnessEvidence:await f.evidence(f.old)});
  assert.equal(report.candidateMatchesDeclaredBaseline,true);assert.equal(report.status,'candidate-matches-declared-baseline');assert.equal(report.latestnessIndependentlyVerified,false);assert.equal(report.productionTrafficAllowed,false);assert.equal(report.scope,'synthetic-rehearsal');assert.equal(report.preparedIsolatedCopy,false);noSecrets(f,report);
});

test('latest stopped baseline evidence is mandatory, identifies the exact snapshot and does not expose operator data',async t=>{
  const f=await fixture(t),evidence=await f.evidence();
  for(const partial of [undefined,{...evidence,declaredLatest:false},{...evidence,writersStopped:false},{...evidence,baselineCreatedAt:'2020-01-01T00:00:00Z'},{...evidence,writersStoppedAt:'2099-01-01T00:00:00Z'}]){
    const report=await f.accept(f.latestCandidate,{freshnessEvidence:partial});assert.equal(report.candidateMatchesDeclaredBaseline,false);assert.ok(report.issues.includes('LATEST_STOPPED_BASELINE_EVIDENCE_REQUIRED'));assert.equal(report.preparedIsolatedCopy,false);noSecrets(f,report);
  }
  const report=await f.accept(f.latest,{baselineDirectory:undefined});assert.ok(report.issues.includes('CANDIDATE_AND_LATEST_BASELINE_REQUIRED'));
});

test('missing and replaced keys reject before Store can create a replacement; no sensitive error reaches reports',async t=>{
  const f=await fixture(t);
  for(const mode of ['missing','wrong']){
    const candidate=await f.clone(mode+'-key'),key=join(candidate,'company','encryption.key');
    if(mode==='missing')await rm(key);else await writeFile(key,randomBytes(32));
    const before=await hashes(candidate),report=await f.accept(candidate);assert.equal(report.candidateMatchesDeclaredBaseline,false);assert.deepEqual(await hashes(candidate),before);noSecrets(f,report);
    if(mode==='missing')await assert.rejects(access(key),{code:'ENOENT'});
  }
});

test('deleted tombstone containing private payload is rejected even when both declared snapshots match',async t=>{
  const f=await fixture(t),candidate=await f.clone('invalid-deletion');
  await editDb(join(candidate,'company','company.sqlite'),db=>{const record=JSON.parse(db.prepare("SELECT body FROM documents WHERE kind='workroomPracticeSync' AND id=?").get(f.deleted.id).body);record.privateDraft=f.privateText;db.prepare("UPDATE documents SET body=? WHERE kind='workroomPracticeSync' AND id=?").run(JSON.stringify(record),f.deleted.id);});
  const report=await f.accept(candidate);assert.ok(report.issues.includes('DELETED_RECORD_HAS_CONTENT'));assert.equal(report.candidateMatchesDeclaredBaseline,false);noSecrets(f,report);
});

test('dangling and duplicated company/messenger identity relations reject complete snapshots',async t=>{
  const f=await fixture(t);
  for(const mode of ['missing-company','missing-messenger','duplicate']){
    const candidate=await f.clone('identity-'+mode),path=join(candidate,'integration-manifest.json'),manifest=JSON.parse(await readFile(path,'utf8'));
    if(mode==='missing-company')manifest.identityLinks[0].companyUserId='missing';else if(mode==='missing-messenger')manifest.identityLinks[0].messengerUserId='missing';else manifest.identityLinks.push(manifest.identityLinks[0]);
    await writeFile(path,JSON.stringify(manifest));const report=await f.accept(candidate);assert.ok(report.issues.includes('IDENTITY_RELATION_INVALID'));assert.equal(report.candidateMatchesDeclaredBaseline,false);noSecrets(f,report);
  }
});

test('mixing the latest company DB with an older messenger DB is rejected',async t=>{
  const f=await fixture(t),candidate=await f.clone('mixed-two-databases');await cp(join(f.old,'messenger','messenger.sqlite'),join(candidate,'messenger','messenger.sqlite'));
  const report=await f.accept(candidate);assert.ok(report.issues.includes('MESSENGER_DATABASE_DIFFERS'));assert.equal(report.candidateMatchesDeclaredBaseline,false);assert.equal(report.sourceFilesUnchanged,true);noSecrets(f,report);
});

test('same physical snapshot cannot serve as its own independent restoration candidate',async t=>{
  const f=await fixture(t),before=await hashes(f.root),report=await f.accept(f.latest);
  assert.equal(report.candidateMatchesDeclaredBaseline,false);assert.ok(report.issues.includes('INDEPENDENT_CANDIDATE_AND_BASELINE_REQUIRED'));assert.deepEqual(await hashes(f.root),before);noSecrets(f,report);
});

test('altered attachment and media bytes reject despite matching database rows and file names',async t=>{
  const f=await fixture(t);
  for(const mode of ['attachment','media','drive-registry']){
    const candidate=await f.clone('altered-'+mode),path=mode==='attachment'?join(candidate,'messenger','uploads',f.attachment):mode==='media'?join(candidate,'company','studio-media',f.media):join(candidate,'messenger','drive-storage.json');
    await writeFile(path,'changed synthetic file bytes');const before=await hashes(candidate),report=await f.accept(candidate);
    assert.equal(report.candidateMatchesDeclaredBaseline,false);assert.ok(report.issues.includes('BACKUP_PAYLOAD_FILES_DIFFER'));assert.deepEqual(await hashes(candidate),before);noSecrets(f,report);
  }
});

test('foreign owner and changed revisions cannot pass with a complete backup marker',async t=>{
  const f=await fixture(t);
  for(const mode of ['owner','revision']){
    const candidate=await f.clone('altered-practice-'+mode);
    await editDb(join(candidate,'company','company.sqlite'),db=>{const record=JSON.parse(db.prepare("SELECT body FROM documents WHERE kind='workroomPracticeSync' AND id=?").get(f.active.id).body);if(mode==='owner')record.ownerId=f.deleted.id;else record.revision=1;db.prepare("UPDATE documents SET body=? WHERE kind='workroomPracticeSync' AND id=?").run(JSON.stringify(record),f.active.id);});
    const report=await f.accept(candidate);assert.equal(report.candidateMatchesDeclaredBaseline,false);assert.ok(report.issues.includes(mode==='owner'?'PRACTICE_ENVELOPE_INVALID':'PRACTICE_CHANGE_NOT_PRESERVED'));noSecrets(f,report);
  }
});

test('incomplete marker, corrupt DB and missing local files cannot pass acceptance',async t=>{
  const f=await fixture(t);
  for(const mode of ['complete','database','media','attachment','wal']){
    const candidate=await f.clone('incomplete-'+mode);
    if(mode==='complete')await writeFile(join(candidate,'COMPLETE'),'incomplete\n');
    if(mode==='database')await writeFile(join(candidate,'company','company.sqlite'),'invalid sqlite');
    if(mode==='media')await rm(join(candidate,'company','studio-media',f.media));
    if(mode==='attachment')await rm(join(candidate,'messenger','uploads',f.attachment));
    if(mode==='wal')await writeFile(join(candidate,'company','company.sqlite-wal'),'not a stopped snapshot');
    const before=await hashes(candidate),report=await f.accept(candidate);assert.equal(report.candidateMatchesDeclaredBaseline,false);assert.deepEqual(await hashes(candidate),before);noSecrets(f,report);
  }
});

test('existing and overlapping target paths reject without overwrite',async t=>{
  const f=await fixture(t),target=join(f.root,'existing-target');await mkdir(target);await writeFile(join(target,'keep.txt'),'preserve existing operator directory');
  for(const destination of [target,join(f.latest,'nested'),f.root]){
    const before=await hashes(f.root),report=await f.accept(f.latestCandidate,{destination});assert.equal(report.candidateMatchesDeclaredBaseline,false);assert.ok(report.issues.some(code=>['DESTINATION_ALREADY_EXISTS','DESTINATION_MUST_BE_SEPARATE'].includes(code)));assert.deepEqual(await hashes(f.root),before);noSecrets(f,report);
  }
});

test('CLI rejects stale restoration with exit 2 and only sanitized JSON, while preserving source hashes',async t=>{
  const f=await fixture(t),evidence=join(f.root,'synthetic-evidence.json');await writeFile(evidence,JSON.stringify(await f.evidence()));const before=await hashes(f.root);
  let failed;try{await run(process.execPath,['--no-warnings',fileURLToPath(new URL('./workspace-restore-acceptance.mjs',import.meta.url)),f.old,f.latest,evidence]);}catch(error){failed=error;}
  assert.equal(failed?.code,2);assert.equal(failed.stderr,'');const report=JSON.parse(failed.stdout);assert.equal(report.candidateMatchesDeclaredBaseline,false);assert.deepEqual(await hashes(f.root),before);noSecrets(f,report);
});

test('cloud-volume restore uses portable data layout and retains identity links without a host messenger path',async t=>{
  const f=await fixture(t),before=await hashes(f.root),destination=join(f.root,'cloud-volume');
  const report=await f.accept(f.latestCandidate,{destination,layout:'cloud-volume'});
  assert.equal(report.candidateMatchesDeclaredBaseline,true,JSON.stringify(report));assert.equal(report.preparedLayout,'cloud-volume');assert.equal(report.productionTrafficAllowed,false);
  for(const name of ['company.sqlite','encryption.key'])assert.deepEqual(await readFile(join(destination,name)),await readFile(join(f.latest,'company',name)));
  assert.deepEqual(await readFile(join(destination,'messenger','messenger.sqlite')),await readFile(join(f.latest,'messenger','messenger.sqlite')));
  const config=JSON.parse(await readFile(join(destination,'workspace-integration.json'),'utf8'));assert.equal(Object.hasOwn(config,'messengerDataDir'),false);assert.equal(config.identityLinks[0].companyUserId,f.active.id);
  assert.equal(JSON.stringify(config).includes(f.root),false);await access(join(destination,'PREPARATION_INCOMPLETE'));
  const after=await hashes(f.root);for(const [path,digest] of Object.entries(before))assert.equal(after[path],digest);noSecrets(f,report);
  for(const directory of [f.latest,destination])for(const file of Object.keys(await hashes(directory)))assert.equal((await readFile(file)).includes(Buffer.from(f.root)),false,'backup and cloud payload must not embed original host paths');
});

test('restore CLI explicitly selects cloud volume layout and refuses unknown layout switches',async t=>{
  const f=await fixture(t),evidence=join(f.root,'cloud-evidence.json'),destination=join(f.root,'cloud-cli');await writeFile(evidence,JSON.stringify(await f.evidence()));
  const args=['--no-warnings',fileURLToPath(new URL('./workspace-restore-acceptance.mjs',import.meta.url)),f.latestCandidate,f.latest,evidence,destination];
  const result=await run(process.execPath,[...args,'--cloud-volume']),report=JSON.parse(result.stdout);assert.equal(report.preparedLayout,'cloud-volume');await access(join(destination,'company.sqlite'));noSecrets(f,report);
  let failure;try{await run(process.execPath,[...args.slice(0,-1),destination+'-wrong','--cloud-volume-typo']);}catch(error){failure=error;}assert.equal(failure?.code,2);assert.deepEqual(JSON.parse(failure.stdout).issues,['RESTORE_LAYOUT_INVALID']);await assert.rejects(access(destination+'-wrong'),{code:'ENOENT'});
});
