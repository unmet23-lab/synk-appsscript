import { Store } from './store.mjs';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const phase=process.argv[2]||'after';if(!['before','after'].includes(phase))throw new Error('before 또는 after를 지정하세요.');
const directory=await mkdtemp(join(tmpdir(),'synk-store-performance-')),store=new Store(directory);
try{
  store.transaction(()=>{for(let i=0;i<100;i++)store.put('performance',String(i),{id:String(i),name:'가상의 검사용 문서',sequence:i,active:true});});
  for(let i=0;i<100;i++)store.get('performance',String(i));
  let start=performance.now(),checksum=0;
  for(let i=0;i<10000;i++)checksum+=store.get('performance',String(i%100)).sequence;
  const getMs=performance.now()-start;start=performance.now();
  store.transaction(()=>{for(let i=0;i<5000;i++)store.put('performance',String(i%100),{id:String(i%100),name:'가상의 검사용 문서',sequence:i,active:true});});
  const putMs=performance.now()-start;start=performance.now();
  for(let i=0;i<500;i++)checksum+=store.all('performance').length;
  const allMs=performance.now()-start;
  const result={phase,at:new Date().toISOString(),node:process.version,get:{operations:10000,elapsedMs:Math.round(getMs*100)/100},put:{operations:5000,elapsedMs:Math.round(putMs*100)/100},all:{operations:500,documentsPerOperation:100,elapsedMs:Math.round(allMs*100)/100},checksum};
  const outputDirectory=join(dirname(fileURLToPath(import.meta.url)),'verification/optimization-20261002');await mkdir(outputDirectory,{recursive:true});await writeFile(join(outputDirectory,'store-'+phase+'.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}finally{
  store.close();if(!resolve(directory).startsWith(resolve(join(tmpdir(),'synk-store-performance-'))))throw new Error('검사용 임시 경로를 확인하세요.');await rm(directory,{recursive:true,force:true});
}
