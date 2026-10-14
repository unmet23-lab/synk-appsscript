import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {Store} from './store.mjs';
import {createHash} from 'node:crypto';
const run=promisify(execFile);
test('backup includes immutable review files from its database snapshot and excludes incomplete uploads',async()=>{
  const root=await mkdtemp(join(tmpdir(),'synk-studio-backup-')),source=join(root,'source'),destination=join(root,'backup');
  try{
    const store=new Store(source),mediaId='51234567-1234-4234-8234-123456789abc',diskName=mediaId+'.mp4',bytes=Buffer.from('immutable fixture video bytes');
    store.put('studioMedia',mediaId,{id:mediaId,diskName,productionId:'fixture-production',byteSize:bytes.length});
    const previewName='61234567-1234-4234-8234-123456789abc.png',intakeName='71234567-1234-4234-8234-123456789abc.intake';
    store.put('clientProjects','client-backup-fixture',{id:'client-backup-fixture',versions:[{id:'v1',media:{diskName:previewName}}],intake:{reportText:'발주서 전체 원문',files:[{diskName:intakeName}]}});
    store.put('brandRecipes','recipe-fixture',{id:'recipe-fixture',versions:[{label:'v1',body:'제작 양식'}]});
    store.put('brandOperations','quality-fixture',{id:'quality-fixture',checks:{mobile:{status:'unverified'}}});
    const linkUrl='https://example.test/resource',fingerprint=createHash('sha256').update(linkUrl).digest('hex'),linkKey='package:'+mediaId+':'+fingerprint;
    const linkCheck={kind:'package',id:mediaId,url:linkUrl,fingerprint,status:'reachable',revision:2,checkedAt:'2026-10-11T12:01:00.000Z',nextCheckAt:'2026-10-11T18:01:00.000Z',cooldownUntil:'2026-10-11T12:02:00.000Z',history:[{status:'error',httpStatus:404,checkedAt:'2026-10-11T12:00:00.000Z',revision:1},{status:'reachable',httpStatus:200,checkedAt:'2026-10-11T12:01:00.000Z',revision:2}]};store.put('publicationLinkChecks',linkKey,linkCheck);
    const key=await readFile(join(source,'encryption.key'));store.close();
    await mkdir(join(source,'studio-media'));await writeFile(join(source,'studio-media',diskName),bytes);await writeFile(join(source,'studio-media','pending.upload'),'must not copy');
    await writeFile(join(source,'studio-media',previewName),'client image bytes');await writeFile(join(source,'studio-media',intakeName),'client original intake bytes');
    const result=await run(process.execPath,[fileURLToPath(new URL('./backup.mjs',import.meta.url)),destination],{env:{...process.env,SYNK_COMPANY_DATA:source}});
    const folder=result.stdout.trim();assert.ok(folder.startsWith(resolve(destination)));assert.deepEqual(await readFile(join(folder,'encryption.key')),key);assert.deepEqual(await readFile(join(folder,'studio-media',diskName)),bytes);assert.deepEqual((await readdir(join(folder,'studio-media'))).sort(),[diskName,previewName,intakeName].sort());assert.match(await readFile(join(folder,'RESTORE.txt'),'utf8'),/studio-media/);
    assert.equal(await readFile(join(folder,'studio-media',previewName),'utf8'),'client image bytes');assert.equal(await readFile(join(folder,'studio-media',intakeName),'utf8'),'client original intake bytes');
    const restored=new Store(folder);assert.equal(restored.get('studioMedia',mediaId).diskName,diskName);assert.equal(restored.get('clientProjects','client-backup-fixture').intake.reportText,'발주서 전체 원문');assert.equal(restored.get('brandRecipes','recipe-fixture').versions[0].body,'제작 양식');assert.equal(restored.get('brandOperations','quality-fixture').checks.mobile.status,'unverified');assert.deepEqual(restored.get('publicationLinkChecks',linkKey),linkCheck);restored.close();
  }finally{if(!root.startsWith(join(tmpdir(),'synk-studio-backup-')))throw new Error('Unexpected cleanup location');await rm(root,{recursive:true,force:true});}
});
