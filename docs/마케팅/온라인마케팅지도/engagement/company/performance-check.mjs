import { createCompanyApp } from './server.mjs';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { request } from 'node:http';
import { performance } from 'node:perf_hooks';
import vm from 'node:vm';

const here=dirname(fileURLToPath(import.meta.url));
const phase=process.argv[2]||'after';
if(!['before','after'].includes(phase))throw new Error('before 또는 after를 지정하세요.');
const directory=await mkdtemp(join(tmpdir(),'synk-static-performance-'));
const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false});
function rawGet(base,path,headers={}){return new Promise((resolve,reject)=>{
  const req=request(base+path,{headers},res=>{let bytes=0;res.on('data',chunk=>{bytes+=chunk.length;});res.on('end',()=>resolve({status:res.statusCode,bytes,etag:res.headers.etag||null,encoding:res.headers['content-encoding']||'identity',cacheControl:res.headers['cache-control']}));});
  req.on('error',reject);req.end();
});}
try{
  await app.start();const base=`http://127.0.0.1:${app.server.address().port}`;
  const html=await readFile(join(here,'public/index.html'),'utf8');
  let paths=[...new Set([...html.matchAll(/<(?:script|link)\b[^>]*?(?:src|href)="([^"]+)"[^>]*>/g)].map(row=>row[1]).filter(path=>/\.(?:js|css|woff2|ttf)$/.test(path)))];
  if(phase==='after'){const baseline=JSON.parse(await readFile(join(here,'verification/optimization-20261002/before.json'),'utf8'));paths=baseline.firstAssets.map(row=>row.path);}
  const first=[],repeat=[],started=performance.now();
  for(const path of paths)first.push({path,...await rawGet(base,path,{'Accept-Encoding':'br, gzip'})});
  const firstMs=performance.now()-started,repeatStart=performance.now();
  for(const row of first)repeat.push({path:row.path,...await rawGet(base,row.path,{'Accept-Encoding':'br, gzip',...(row.etag?{'If-None-Match':row.etag}:{})})});
  const repeatMs=performance.now()-repeatStart;
  const source=await readFile(join(here,'public/app.js'),'utf8');
  const formatterSource=source.slice(source.indexOf('const validNumber ='),source.indexOf('const deltaText ='));
  const formatter=vm.runInNewContext(formatterSource+'\n number;', {Intl,Number});
  const values=Array.from({length:5000},(_,i)=>i*123.45);let formatted=0;
  for(const value of values.slice(0,100))formatted+=formatter(value).length;
  const formattingStart=performance.now();for(const value of values)formatted+=formatter(value).length;
  const result={phase,at:new Date().toISOString(),node:process.version,assets:paths.length,first:{bytes:first.reduce((sum,row)=>sum+row.bytes,0),elapsedMs:Math.round(firstMs*100)/100},repeat:{bytes:repeat.reduce((sum,row)=>sum+row.bytes,0),elapsedMs:Math.round(repeatMs*100)/100,notModified:repeat.filter(row=>row.status===304).length},numberFormatting:{values:values.length,elapsedMs:Math.round((performance.now()-formattingStart)*100)/100,outputCharacters:formatted},firstAssets:first,repeatAssets:repeat};
  const outputDirectory=join(here,'verification/optimization-20261002');await mkdir(outputDirectory,{recursive:true});
  await writeFile(join(outputDirectory,phase+'.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({...result,firstAssets:undefined,repeatAssets:undefined},null,2));
}finally{
  await app.stop();
  if(!resolve(directory).startsWith(resolve(join(tmpdir(),'synk-static-performance-'))))throw new Error('검사용 임시 경로를 확인하세요.');
  await rm(directory,{recursive:true,force:true});
}
