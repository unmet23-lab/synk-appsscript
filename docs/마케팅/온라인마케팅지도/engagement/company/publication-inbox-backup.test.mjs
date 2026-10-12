import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID,createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {Store} from './store.mjs';
import {createStudioService} from './studio-service.mjs';
import {createPublicationInboxService} from './publication-inbox.mjs';
const run=promisify(execFile),hash=bytes=>createHash('sha256').update(bytes).digest('hex');

test('standard workspace backup restores imported video, ready draft and inbox setting without copying source or partial inbox files',async()=>{
  const root=await mkdtemp(join(tmpdir(),'synk-publication-inbox-backup-')),source=join(root,'source');let store,service,restored,restoredService;
  try{
    store=new Store(source);const studio=createStudioService({store}),owner=store.createUser({name:'완성본 담당',email:'backup-owner@example.test'});service=createPublicationInboxService({store,studio,enabled:true});
    const config=await service.configure(owner,{active:true}),deliveryId=randomUUID(),folder=join(config.inboxPath,deliveryId);await mkdir(folder);
    const video=Buffer.concat([Buffer.from([0,0,0,16]),Buffer.from('ftypisom0000'),Buffer.alloc(80)]),subtitle='1\n00:00:00,000 --> 00:00:00,900\n복원 확인\n';
    const manifest={schema:1,deliveryId,confirmed:true,finalizedAt:'2026-10-11T15:00:00+09:00',title:'백업할 완성본',body:'확정한 게시문',link:'https://example.test/source',language:'ko',channels:['youtube-shorts'],mode:'adapt',video:{fileName:'video.mp4',byteSize:video.length,sha256:hash(video)},subtitle:{fileName:'subtitle.srt',byteSize:Buffer.byteLength(subtitle),sha256:hash(subtitle)}};
    await writeFile(join(folder,'video.mp4'),video);await writeFile(join(folder,'subtitle.srt'),subtitle);await writeFile(join(folder,'ready.json'),JSON.stringify(manifest));
    const partial=join(config.inboxPath,'.partial-'+randomUUID());await mkdir(partial);await writeFile(join(partial,'video.mp4'),'unfinished source');await service.scan();
    const original=service.readDraft(owner,deliveryId),media=studio.readableMedia(owner,original.production.versions[0].mediaId);await service.stop();store.close();store=null;
    const result=await run(process.execPath,[fileURLToPath(new URL('./backup.mjs',import.meta.url)),join(root,'backup')],{env:{...process.env,SYNK_COMPANY_DATA:source}}),backupFolder=result.stdout.trim();assert.ok(backupFolder.startsWith(resolve(root,'backup')));
    assert.deepEqual(await readdir(join(backupFolder,'studio-media')),[media.diskName]);assert.deepEqual(await readFile(join(backupFolder,'studio-media',media.diskName)),video);assert.equal((await readdir(backupFolder)).includes('publication-inbox'),false,'raw inbox folders are not part of the immutable media backup');
    restored=new Store(backupFolder);const restoredStudio=createStudioService({store:restored});restoredService=createPublicationInboxService({store:restored,studio:restoredStudio,enabled:true});
    const state=restoredService.state(owner),draft=restoredService.readDraft(owner,deliveryId);assert.equal(state.active,true);assert.equal(state.entries[0].status,'ready');assert.deepEqual(draft.draft,original.draft);assert.equal(draft.draft.subtitleText,subtitle.trim());assert.equal(draft.production.versions[0].mediaId,media.id);assert.equal(restoredStudio.readableMedia(owner,media.id).sha256,hash(video));assert.equal(state.inboxPath,join(backupFolder,'publication-inbox',owner.id),'restored inbox uses the new store location rather than a stale absolute source path');
    await restoredService.scan();assert.equal(restored.all('studioProductions').length,1,'missing source inbox does not recreate or discard the imported version');assert.deepEqual(await readFile(join(folder,'video.mp4')),video);assert.equal(await readFile(join(partial,'video.mp4'),'utf8'),'unfinished source');
  }finally{await service?.stop();await restoredService?.stop();store?.close();restored?.close();assert.equal(dirname(resolve(root)),resolve(tmpdir()));assert.ok(root.includes('synk-publication-inbox-backup-'));await rm(root,{recursive:true,force:true});}
});
