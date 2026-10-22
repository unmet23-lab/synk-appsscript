import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {readFile,realpath,rm} from 'node:fs/promises';
import {basename,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {request as httpRequest} from 'node:http';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {createProductionFixture} from './pulse-production-fixture.mjs';

// 10-22 모델은 사진만 · 완성 광고는 따로(유호님): 공개 목록은 모델마다 사진 넉 장과 완성 광고 모듈을 내고,
// 거둔 것(하린 영상 넷 · 10-12 기획 모음 쪽과 그 그림 · 전신 기준 사진 · 기획 모듈)은 파일이 저장소에 남아도 내지 않는다.
const IDS=['m01','f01','f02','f03','m02','f04','m03'],SHOTS=['fullbody','look-1','look-2','context'];
const PHOTOS=IDS.flatMap(id=>SHOTS.map(shot=>`assets/casting/photos/${id}-${shot}.webp`));
const WITHDRAWN=[
  'production-library/','production-library/index.html','production-library/library.js','production-library/library.css','production-catalog.mjs',
  ...['01-harin-coffee-v3.webp','02-yuna-perfume.webp','03-taejun-tailoring.webp','04-runway-comparison-v2.webp','04-runway-comparison-proportion-v1.webp'].map(name=>'assets/production/'+name),
  ...IDS.map(id=>`assets/casting/fullbody/${id}-fullbody-v1.webp`),
  ...['F02-ad-motion-5s-v1.mp4','F02-runway-motion-5s-v1.mp4','F02-ad-iced-coffee-20s-v1.mp4','F02-ad-iced-coffee-20s-v1-poster.webp'].map(name=>'assets/casting/video/'+name),
];
const appFile=path=>new URL('./public/pulse-app/'+(path.endsWith('/')?path+'index.html':path),import.meta.url);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
let fixture;
before(async()=>{fixture=await createProductionFixture({seed:false});});
after(async()=>{
  if(!fixture)return;
  await fixture.stop();
  const directory=await realpath(fixture.directory),parent=await realpath(tmpdir());
  assert.equal(dirname(directory).toLowerCase(),parent.toLowerCase());
  assert.ok(basename(directory).startsWith('synk-pulse-production-'));
  await rm(directory,{recursive:true,force:true});
});
function rawGet(path,headers={}){
  const base=new URL(fixture.base);
  return new Promise((resolve,reject)=>{
    const request=httpRequest({hostname:base.hostname,port:base.port,path,method:'GET',headers},response=>{
      const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>resolve({status:response.statusCode,headers:response.headers,bytes:Buffer.concat(chunks)}));
    });
    request.on('error',reject);request.end();
  });
}

test('HTTP anonymous casting photos and the films module return exact MIME, nosniff, revalidation and source bytes',async()=>{
  assert.equal(PHOTOS.length,28);
  for(const [path,mime]of [...PHOTOS.map(path=>[path,'image/webp']),['films-view.mjs','text/javascript; charset=utf-8']]){
    const response=await fetch(fixture.base+'/pulse-app/'+path),bytes=Buffer.from(await response.arrayBuffer());
    assert.equal(response.status,200,path);
    assert.equal(response.headers.get('content-type'),mime,path);
    assert.equal(response.headers.get('x-content-type-options'),'nosniff',path);
    assert.ok(['no-store','public, max-age=0, must-revalidate'].includes(response.headers.get('cache-control')),path+' public asset must be fetched or revalidated');
    assert.equal(sha(bytes),sha(await readFile(appFile(path))),path+' bytes');
    if(mime==='image/webp'){assert.equal(bytes.subarray(0,4).toString(),'RIFF',path);assert.equal(bytes.subarray(8,12).toString(),'WEBP',path);}
  }
});

// 10-22 화성 세 편: 포스터(git 추적)와 본편(mp4, git 밖)만 낸다 — 1분 안쪽이라 발췌가 없다.
test('HTTP the Hwaseong finished films serve their posters and full films with exact MIME, bytes and byte ranges, and nothing else in the films folder',async t=>{
  for(const name of ['hwaseong-cf-light','hwaseong-short-first','hwaseong-cm-song'])for(const [file,mime]of [[name+'-poster-v1.webp','image/webp'],[name+'-v1.mp4','video/mp4']]){
    const path='assets/films/'+file;
    if(mime==='video/mp4'&&process.env.CI&&!existsSync(appFile(path))){t.diagnostic('CI 체크아웃에는 없다 — public/pulse-app/'+path+' (git 밖 출시 영상)');continue;}
    const response=await fetch(fixture.base+'/pulse-app/'+path),bytes=Buffer.from(await response.arrayBuffer());
    assert.equal(response.status,200,path);
    assert.equal(response.headers.get('content-type'),mime,path);
    assert.equal(response.headers.get('x-content-type-options'),'nosniff',path);
    assert.equal(sha(bytes),sha(await readFile(appFile(path))),path+' bytes');
    if(mime==='image/webp'){assert.equal(bytes.subarray(0,4).toString(),'RIFF',path);assert.equal(bytes.subarray(8,12).toString(),'WEBP',path);continue;}
    assert.equal(bytes.subarray(4,8).toString(),'ftyp',path);
    const part=await rawGet('/pulse-app/'+path,{Range:'bytes=0-7'});
    assert.equal(part.status,206,path);
    assert.equal(part.headers['content-range'],`bytes 0-7/${bytes.length}`,path);
    assert.deepEqual(part.bytes,bytes.subarray(0,8),path);
  }
  for(const path of ['/pulse-app/assets/films/hwaseong-cf-light-v2.mp4','/pulse-app/assets/films/hwaseong-cf-light.mp4','/pulse-app/assets/films/hwaseong-cf-light-excerpt-v1.mp4','/pulse-app/assets/films/hwaseong-cf-light-poster-v1.png','/pulse-app/assets/films/','/pulse-app/assets/films/../casting/video/F02-ad-iced-coffee-20s-v1.mp4','/pulse-app/assets/films/%2e%2e%2fcasting%2fvideo%2fF02-ad-iced-coffee-20s-v1.mp4'])assert.equal((await rawGet(path)).status,404,path);
});

test('HTTP withdrawn reference films, the plan library, its boards, full-body references and plan module are not served although the files stay',async()=>{
  for(const path of WITHDRAWN){
    // 출시 영상(*.mp4)은 .gitignore라 CI 체크아웃에는 없다 — 파일이 남아 있음은 있는 곳에서만 잰다.
    if(!path.endsWith('.mp4')||!process.env.CI)assert.ok(existsSync(appFile(path)),path+' stays in the repository');
    const response=await rawGet('/pulse-app/'+path,path.endsWith('.mp4')?{Range:'bytes=0-1'}:{});
    assert.equal(response.status,404,path);
    assert.equal(response.headers['accept-ranges'],undefined,path);
    assert.doesNotMatch(response.bytes.toString(),/일곱 모델|아이스커피|"projects"\s*:/,path);
  }
  for(const path of ['/pulse-app/assets/casting/photos/f02-look-3.webp','/pulse-app/assets/casting/photos/F02-look-1.webp','/pulse-app/assets/casting/photos/f02-look-1.png','/pulse-app/assets/casting/photos/../../private','/pulse-app/assets/casting/photos/%2e%2e%2f%2e%2e%2fprivate','/pulse-app/assets/casting/photos/m99-fullbody.webp'])assert.equal((await rawGet(path)).status,404,path);
});

test('service worker precaches the films module, not the withdrawn plan module or photos, and never caches APIs, invitations or uploaded media',async()=>{
  const response=await fetch(fixture.base+'/pulse-app/sw.js');
  assert.equal(response.status,200);
  const source=await response.text(),handlers=new Map(),installs=[],puts=[];
  const ok={ok:true,type:'basic',clone(){return this;}};
  const cache={async addAll(paths){installs.push(...paths);},async put(request){puts.push(new URL(request.url).pathname);}};
  const environment={URL,Promise,Set,caches:{async open(){return cache;},async keys(){return[];},async delete(){return true;},async match(){return ok;}},fetch:async()=>ok,self:{location:{origin:fixture.base},clients:{async claim(){}},addEventListener(name,handler){handlers.set(name,handler);}}};
  runInNewContext(source,environment,{filename:'served-pulse-sw.js'});
  let install;
  handlers.get('install')({waitUntil(value){install=value;}});
  await install;
  assert.ok(installs.includes('/pulse-app/films-view.mjs'));
  assert.equal(installs.some(path=>/production-catalog|production-library|assets\/casting\/(?:photos|video|fullbody)\//.test(path)),false);
  assert.ok(installs.every(path=>path.startsWith('/pulse-app/')&&!/[?#]/.test(path)));
  assert.equal(installs.some(path=>/\/api\/|invite|\/media\/|assets\/casting\/voice\//.test(path)),false);
  for(const path of installs){const served=await rawGet(path);assert.equal(served.status,200,path+' every precached file is served');}
  async function visit(path,method='GET'){
    const writes=puts.length,waits=[];let handled=false,result;
    handlers.get('fetch')({request:{url:new URL(path,fixture.base).href,method},respondWith(value){handled=true;result=value;},waitUntil(value){waits.push(value);}});
    if(handled)await result;await Promise.all(waits);
    return {handled,newWrites:puts.length-writes};
  }
  assert.deepEqual(await visit('/pulse-app/films-view.mjs'),{handled:true,newWrites:1});
  for(const [path,method]of [
    ['/pulse/api/project','GET'],['/pulse/api/open','POST'],['/api/client-projects','GET'],
    ['/pulse/api/media/synthetic','GET'],['/api/client-projects/synthetic/media','GET'],
    ['/pulse-app/?invite=synthetic-private-value','GET'],['/pulse-app/?mode=staff','GET'],
    ['/pulse-app/films-view.mjs?invite=synthetic-private-value','GET'],
    ['/pulse-app/films-view.mjs','POST'],['https://external.example.test/pulse-app/films-view.mjs','GET'],
    ['/pulse-app/production-catalog.mjs','GET'],['/pulse-app/assets/casting/photos/f02-look-1.webp','GET'],
  ])assert.deepEqual(await visit(path,method),{handled:false,newWrites:0},method+' '+path);
  assert.deepEqual(await visit('/pulse-app/#invite=synthetic-private-value'),{handled:true,newWrites:0},'fragment navigation may fetch the public shell but cannot cache an invitation response');
  assert.deepEqual(puts,['/pulse-app/films-view.mjs']);
});
