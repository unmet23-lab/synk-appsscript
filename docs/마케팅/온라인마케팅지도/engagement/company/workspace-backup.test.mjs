import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, access, symlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { Store } from './store.mjs';
import { createMessenger } from '../../../../../tools/company-messenger/server.mjs';
import { backupWorkspace } from './workspace-backup.mjs';

test('workspace backup preserves identities, local attachments, media and Drive registry without original absolute paths', async () => {
  const root = await mkdtemp(join(tmpdir(), 'synk-workspace-backup-'));
  const companyDir = join(root, 'company'), messengerDir = join(root, 'messenger');
  let company, messenger;
  try {
    company = new Store(companyDir); messenger = createMessenger({ dataDir: messengerDir, port: 0 });
    const admin = company.createUser({ email: 'backup@example.test', name: '검증', role: 'admin' });
    const mediaName = '51234567-1234-4234-8234-123456789abc.mp4';
    company.put('studioMedia', 'media', { diskName: mediaName });
    const rightsRecord={projectId:'rights-backup-project',revision:1,records:[{targetId:'portfolio',status:'allowed',expiryMode:'date',expiresAt:'2026-10-20',evidence:'SYNTHETIC-ENCRYPTED-RIGHTS-EVIDENCE'}]};
    company.put('clientRights','rights-backup-project',{schema:1,projectId:'rights-backup-project',revision:1,ciphertext:company.encrypt(rightsRecord)});
    const usageRecord={projectId:'rights-backup-project',revision:1,records:[{id:'51234567-1234-4234-8234-123456789abc',targetId:'material:reference:51234567-1234-4234-8234-123456789abc',contextFingerprint:'a'.repeat(64),sourceFingerprint:'b'.repeat(64),status:'reference',label:'합성 원본',actorId:admin.id,actorName:admin.name,recordedAt:'2026-10-13T03:00:00Z'}]};
    company.put('clientMaterialUsage','rights-backup-project',{schema:1,projectId:'rights-backup-project',revision:1,ciphertext:company.encrypt(usageRecord)});
    company.put('clientTaskRechecks',admin.id,{userId:admin.id,entries:{'client:rights-backup-project:rights:portfolio':{date:'2026-10-18',fingerprint:'a'.repeat(64),overdueDates:[]}}});
    await mkdir(join(companyDir, 'studio-media')); await writeFile(join(companyDir, 'studio-media', mediaName), 'video fixture');
    messenger.db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?)').run('m-user', 'backup', '검증', 'owner', 'unused', '2026-09-29');
    messenger.db.prepare('INSERT INTO channels (id,name,description,kind,pair_key,created_at) VALUES (?,?,?,?,?,?)').run('m-channel', '검증', '', 'channel', null, '2026-09-29');
    const attachment = '51234567-1234-4234-8234-123456789abc.bin';
    messenger.db.prepare('INSERT INTO files (id,channel_id,uploader_id,name,size,mime,disk_name,created_at) VALUES (?,?,?,?,?,?,?,?)').run('f1', 'm-channel', 'm-user', 'memo.txt', 7, 'text/plain', attachment, '2026-09-29');
    await writeFile(join(messengerDir, 'uploads', attachment), 'fixture');
    await writeFile(join(messengerDir, 'uploads', 'pending.upload'), 'not included');
    await writeFile(join(messengerDir, 'drive-storage.json'), '{"fixture":true}');
    const links = [{ companyUserId: admin.id, messengerUserId: 'm-user' }];
    await writeFile(join(companyDir, 'workspace-integration.json'), JSON.stringify({ messengerDataDir: messengerDir, identityLinks: links }));
    const target = await backupWorkspace({ destination: join(root, 'backups'), companyDataDir: companyDir });
    assert.equal(await readFile(join(target, 'COMPLETE'), 'utf8'), 'ok\n');
    assert.equal(await readFile(join(target, 'company', 'studio-media', mediaName), 'utf8'), 'video fixture');
    assert.equal(await readFile(join(target, 'messenger', 'uploads', attachment), 'utf8'), 'fixture');
    assert.deepEqual(await readdir(join(target, 'messenger', 'uploads')), [attachment]);
    assert.equal(await readFile(join(target, 'messenger', 'drive-storage.json'), 'utf8'), '{"fixture":true}');
    assert.deepEqual(await readFile(join(target, 'company', 'encryption.key')), await readFile(join(companyDir, 'encryption.key')));
    const manifest = JSON.parse(await readFile(join(target, 'integration-manifest.json'), 'utf8'));
    assert.deepEqual(manifest.identityLinks, links); assert.equal(manifest.mediaCount, 1); assert.equal(manifest.attachmentCount, 1);
    assert.ok(!JSON.stringify(manifest).includes(root));
    const restoredCompany=new Store(join(target,'company'));
    try{assert.deepEqual(restoredCompany.decrypt(restoredCompany.get('clientRights','rights-backup-project').ciphertext),rightsRecord);assert.deepEqual(restoredCompany.decrypt(restoredCompany.get('clientMaterialUsage','rights-backup-project').ciphertext),usageRecord);assert.deepEqual(restoredCompany.get('clientTaskRechecks',admin.id),company.get('clientTaskRechecks',admin.id));}finally{restoredCompany.close();}
    const restored = new DatabaseSync(join(target, 'messenger', 'messenger.sqlite'), { readOnly: true });
    try { assert.equal(restored.prepare('SELECT uploader_id FROM files').get().uploader_id, 'm-user'); } finally { restored.close(); }
  } finally {
    company?.close(); await messenger?.close();
    if (!root.startsWith(join(tmpdir(), 'synk-workspace-backup-'))) throw new Error('Unexpected cleanup location');
    await rm(root, { recursive: true, force: true });
  }
});

async function closedFixture(t) {
  const prefix='synk-workspace-backup-path-',root=await mkdtemp(join(tmpdir(),prefix)),companyDir=join(root,'company'),messengerDir=join(root,'messenger');
  t.after(async()=>{const actual=resolve(root);assert.ok(actual.startsWith(resolve(tmpdir())+sep)&&actual.split(sep).at(-1).startsWith(prefix));await rm(actual,{recursive:true,force:true});});
  const company=new Store(companyDir),messenger=createMessenger({dataDir:messengerDir,port:0});company.close();await messenger.close();
  await writeFile(join(companyDir,'workspace-integration.json'),JSON.stringify({messengerDataDir:messengerDir,identityLinks:[]}));
  return {root,companyDir,messengerDir};
}

test('workspace backup refuses data-directory destinations including resolved directory links before writing a backup',async t=>{
  const f=await closedFixture(t),link=join(f.root,'linked-company');await symlink(f.companyDir,link,'junction');
  const before=await readFile(join(f.companyDir,'company.sqlite'));
  for(const destination of [f.companyDir,join(f.companyDir,'backups'),f.messengerDir,join(link,'backups')])await assert.rejects(backupWorkspace({destination,companyDataDir:f.companyDir}),/운영 데이터 폴더 밖/);
  assert.deepEqual(await readFile(join(f.companyDir,'company.sqlite')),before);await assert.rejects(access(join(f.companyDir,'backups')),{code:'ENOENT'});
});

test('invalid original key fails before any backup output and is never regenerated',async t=>{
  const f=await closedFixture(t),destination=join(f.root,'backups'),key=join(f.companyDir,'encryption.key');await writeFile(key,'synthetic-invalid-key');
  await assert.rejects(backupWorkspace({destination,companyDataDir:f.companyDir}),/원래 회사 암호화 키/);
  assert.equal(await readFile(key,'utf8'),'synthetic-invalid-key');await assert.rejects(access(destination),{code:'ENOENT'});
});

test('backup CLI sanitizes malformed private integration configuration without printing its value or source path',async t=>{
  const f=await closedFixture(t),privateValue='SYNTHETIC_PRIVATE_CONFIG_MUST_NOT_PRINT';await writeFile(join(f.companyDir,'workspace-integration.json'),'{"private":"'+privateValue+'" invalid');
  let failure;try{await promisify(execFile)(process.execPath,['--no-warnings',fileURLToPath(new URL('./workspace-backup.mjs',import.meta.url)),join(f.root,'backups')],{env:{...process.env,SYNK_COMPANY_DATA:f.companyDir}});}catch(error){failure=error;}
  assert.equal(failure?.code,2);assert.match(failure.stderr,/WORKSPACE_BACKUP_FAILED/);assert.equal(failure.stdout,'');assert.equal(failure.stderr.includes(privateValue),false);assert.equal(failure.stderr.includes(f.root),false);await assert.rejects(access(join(f.root,'backups')),{code:'ENOENT'});
});

async function mediaFixture(t) {
  const f=await closedFixture(t),company=new Store(f.companyDir);
  const first='61234567-1234-4234-8234-123456789abc.mp4',second='71234567-1234-4234-8234-123456789abc.png',twin='81234567-1234-4234-8234-123456789abc.mp4';
  try{company.put('studioMedia','one',{diskName:first});company.put('studioMedia','two',{diskName:second});company.put('socialMedia','three',{diskName:twin});}finally{company.close();}
  await mkdir(join(f.companyDir,'studio-media'));
  await writeFile(join(f.companyDir,'studio-media',first),'synthetic video body');await writeFile(join(f.companyDir,'studio-media',second),'synthetic image body');
  await writeFile(join(f.companyDir,'studio-media',twin),'synthetic video body');await writeFile(join(f.companyDir,'studio-media','unreferenced.mp4'),'never listed');
  const sha=value=>createHash('sha256').update(value).digest('hex');
  return {...f,names:[first,second,twin],expected:new Map([[first,sha('synthetic video body')],[second,sha('synthetic image body')],[twin,sha('synthetic video body')]])};
}

test('default copy backup keeps the old layout with no media list', async t => {
  const f=await mediaFixture(t),target=await backupWorkspace({destination:join(f.root,'backups'),companyDataDir:f.companyDir});
  assert.deepEqual((await readdir(join(target,'company','studio-media'))).sort(),[...f.names].sort());
  await assert.rejects(access(join(target,'media-manifest.json')),{code:'ENOENT'});
  const manifest=JSON.parse(await readFile(join(target,'integration-manifest.json'),'utf8'));
  assert.equal(manifest.mediaCount,3);assert.equal('mediaManifest' in manifest,false);assert.equal('mediaBytesIncluded' in manifest,false);
});

test('both and manifest backups list every referenced media file by sha256; manifest keeps no media bytes', async t => {
  const f=await mediaFixture(t);
  for(const mode of ['both','manifest']){
    const target=await backupWorkspace({destination:join(f.root,'backups-'+mode),companyDataDir:f.companyDir,media:mode});
    const list=JSON.parse(await readFile(join(target,'media-manifest.json'),'utf8')),manifest=JSON.parse(await readFile(join(target,'integration-manifest.json'),'utf8'));
    assert.equal(list.schema,'synk-workspace-media/v1');assert.equal(list.bytesIncluded,mode==='both');assert.equal(list.createdAt,manifest.createdAt);
    assert.deepEqual(list.files.map(file=>file.diskName).sort(),[...f.names].sort());
    for(const file of list.files){assert.equal(file.sha256,f.expected.get(file.diskName));assert.equal(file.bytes,20);}
    assert.equal(manifest.mediaCount,3);assert.equal(manifest.mediaManifest,'media-manifest.json');assert.equal(manifest.mediaBytesIncluded,mode==='both');
    if(mode==='both')assert.deepEqual((await readdir(join(target,'company','studio-media'))).sort(),[...f.names].sort());
    else await assert.rejects(access(join(target,'company','studio-media')),{code:'ENOENT'});
    const note=await readFile(join(target,'RESTORE.txt'),'utf8');assert.match(note,mode==='manifest'?/backup-media\.py hydrate/:/company\/studio-media에 있고/);
    assert.equal(await readFile(join(target,'COMPLETE'),'utf8'),'ok\n');
  }
});

test('a referenced media file missing from the live folder still fails the backup in every mode', async t => {
  const f=await mediaFixture(t);await rm(join(f.companyDir,'studio-media',f.names[1]));
  for(const media of ['copy','both','manifest'])await assert.rejects(backupWorkspace({destination:join(f.root,'missing-'+media),companyDataDir:f.companyDir,media}),{code:'ENOENT'});
  await assert.rejects(backupWorkspace({destination:join(f.root,'bad'),companyDataDir:f.companyDir,media:'bytes'}),/영상 백업 방식/);
});

test('backup CLI accepts only --media=both or --media=manifest after the folder', async t => {
  const f=await mediaFixture(t),cli=fileURLToPath(new URL('./workspace-backup.mjs',import.meta.url)),run=args=>promisify(execFile)(process.execPath,['--no-warnings',cli,...args],{env:{...process.env,SYNK_COMPANY_DATA:f.companyDir}});
  const out=await run([join(f.root,'cli'),'--media=manifest']),target=out.stdout.trim();
  assert.equal(JSON.parse(await readFile(join(target,'media-manifest.json'),'utf8')).bytesIncluded,false);
  for(const args of [[join(f.root,'cli2'),'--media=copy'],[join(f.root,'cli3'),'--media'],[join(f.root,'cli4'),'--media=manifest','extra']]){
    let failure;try{await run(args);}catch(error){failure=error;}
    assert.equal(failure?.code,2);assert.match(failure.stderr,/WORKSPACE_BACKUP_FAILED/);
  }
});
