import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {Store} from './store.mjs';
const run=promisify(execFile);

test('publication outputs and pending performance checkpoints survive the ordinary workspace backup',async()=>{
  const root=await mkdtemp(join(tmpdir(),'synk-publication-backup-')),source=join(root,'source');
  try{
    const store=new Store(source),original='11234567-1234-4234-8234-123456789abc.mp4',derived='21234567-1234-4234-8234-123456789abc.mp4';
    store.put('studioMedia','original',{id:'original',diskName:original});
    store.put('studioPublicationPackages','package',{id:'package',outputs:[{diskName:derived},{diskName:derived}]});
    store.put('postPerformanceEntries','post',{id:'post',checkpoints:[{hours:24,status:'pending',dueAt:'2026-10-12T00:00:00.000Z'}]});
    store.close();await mkdir(join(source,'studio-media'));
    await writeFile(join(source,'studio-media',original),'immutable original');
    await writeFile(join(source,'studio-media',derived),'derived publication');
    await writeFile(join(source,'studio-media','incomplete.upload'),'must not copy');
    const result=await run(process.execPath,[fileURLToPath(new URL('./backup.mjs',import.meta.url)),join(root,'backup')],{env:{...process.env,SYNK_COMPANY_DATA:source}}),folder=result.stdout.trim();
    assert.ok(folder.startsWith(resolve(root,'backup')));
    assert.deepEqual((await readdir(join(folder,'studio-media'))).sort(),[original,derived].sort());
    assert.equal(await readFile(join(folder,'studio-media',derived),'utf8'),'derived publication');
    const restored=new Store(folder);try{assert.equal(restored.get('postPerformanceEntries','post').checkpoints[0].status,'pending');assert.equal(restored.get('studioPublicationPackages','package').outputs[0].diskName,derived);}finally{restored.close();}
  }finally{assert.equal(dirname(resolve(root)),resolve(tmpdir()));assert.ok(root.includes('synk-publication-backup-'));await rm(root,{recursive:true,force:true});}
});
