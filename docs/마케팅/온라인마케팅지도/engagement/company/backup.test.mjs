import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {Store} from './store.mjs';
const run=promisify(execFile);
test('backup includes immutable review files from its database snapshot and excludes incomplete uploads',async()=>{
  const root=await mkdtemp(join(tmpdir(),'synk-studio-backup-')),source=join(root,'source'),destination=join(root,'backup');
  try{
    const store=new Store(source),mediaId='51234567-1234-4234-8234-123456789abc',diskName=mediaId+'.mp4',bytes=Buffer.from('immutable fixture video bytes');
    store.put('studioMedia',mediaId,{id:mediaId,diskName,productionId:'fixture-production',byteSize:bytes.length});
    const key=await readFile(join(source,'encryption.key'));store.close();
    await mkdir(join(source,'studio-media'));await writeFile(join(source,'studio-media',diskName),bytes);await writeFile(join(source,'studio-media','pending.upload'),'must not copy');
    const result=await run(process.execPath,[fileURLToPath(new URL('./backup.mjs',import.meta.url)),destination],{env:{...process.env,SYNK_COMPANY_DATA:source}});
    const folder=result.stdout.trim();assert.ok(folder.startsWith(resolve(destination)));assert.deepEqual(await readFile(join(folder,'encryption.key')),key);assert.deepEqual(await readFile(join(folder,'studio-media',diskName)),bytes);assert.deepEqual(await readdir(join(folder,'studio-media')),[diskName]);assert.match(await readFile(join(folder,'RESTORE.txt'),'utf8'),/studio-media/);
    const restored=new Store(folder);assert.equal(restored.get('studioMedia',mediaId).diskName,diskName);restored.close();
  }finally{if(!root.startsWith(join(tmpdir(),'synk-studio-backup-')))throw new Error('Unexpected cleanup location');await rm(root,{recursive:true,force:true});}
});
