import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createCompanyApp} from './server.mjs';

const here=dirname(fileURLToPath(import.meta.url));
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-pulse-casting-media-'));
  const app=createCompanyApp({dataDir:join(directory,'company'),messengerDataDir:join(directory,'messenger'),clientIntakeDir:join(directory,'inbox'),host:'127.0.0.1',port:0,allowTestHost:true,schedule:false,backgroundJobsEnabled:false,workNotificationsEnabled:false,webPushEnabled:false,synkIdentityConfig:null,synkCustomerIdentityConfig:null,teachingConfig:null});
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.match(directory,/synk-pulse-casting-media-/);await rm(directory,{recursive:true,force:true});});
  const address=await app.start();return 'http://127.0.0.1:'+address.port;
}

// 11-03 견본 목소리를 뺐다(유호님 「둘 다 전부 빼기」): 열세 모델의 목소리 39개는 공개 목록에서 빠져 404다. 회사 서버 판 원천에는 옛 자리에 남지만
// (판 도구가 부모 원천의 파일을 지우지 않는다) 내주지 않는다. 저장소의 원본은 archive/casting-voice-20261103/에 있다.
const WITHDRAWN_VOICES=['F01','F02','F03','F04','M01','M02','M03','F05','M04','F06','F07','M05','M06'].flatMap(model=>['1','2','3'].map(take=>'voice/'+model+'-'+take+'.mp3'));

test('approved F04 portrait serves exact source bytes and media type with anonymous GET and HEAD',async t=>{
  const base=await fixture(t),files=[['f04.webp','image/webp']];
  for(const [file,type]of files){
    const bytes=await readFile(join(here,'public/pulse-app/assets/casting',file));assert.ok(bytes.length>0);
    const url=base+'/pulse-app/assets/casting/'+file,response=await fetch(url);
    assert.equal(response.status,200,file);assert.equal(response.headers.get('content-type'),type,file);assert.equal(response.headers.get('content-length'),String(bytes.length));assert.equal(response.headers.get('set-cookie'),null);assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes,file);
    const head=await fetch(url,{method:'HEAD'});assert.equal(head.status,200,file);assert.equal(head.headers.get('content-type'),type);assert.equal(head.headers.get('content-length'),String(bytes.length));assert.equal((await head.arrayBuffer()).byteLength,0);
    const unchanged=await fetch(url,{headers:{'If-None-Match':response.headers.get('etag')}});assert.equal(unchanged.status,304,file);assert.equal((await unchanged.arrayBuffer()).byteLength,0);
  }
});

test('the 39 voice samples withdrawn on 11-03 answer 404 to anonymous GET and HEAD',async t=>{
  const base=await fixture(t);assert.equal(WITHDRAWN_VOICES.length,39);
  for(const file of WITHDRAWN_VOICES){
    const url=base+'/pulse-app/assets/casting/'+file,response=await fetch(url);
    assert.equal(response.status,404,file);assert.notEqual(response.headers.get('content-type'),'audio/mpeg',file);assert.equal((await response.arrayBuffer()).byteLength<2048,true,file);
    const head=await fetch(url,{method:'HEAD'});assert.equal(head.status,404,file);assert.notEqual(head.headers.get('content-type'),'audio/mpeg',file);
  }
});

test('casting public media routes expose only approved samples and leave protected projects inaccessible anonymously',async t=>{
  const base=await fixture(t);
  for(const path of ['/pulse-app/assets/casting/voice/F01-4.mp3','/pulse-app/assets/casting/voice/F99-1.mp3','/pulse-app/assets/casting/raw/F04.png','/pulse-app/assets/casting/voice/sources.json','/pulse-app/assets/casting/voice/%2e%2e%2f%2e%2e%2fserver.mjs']){
    const response=await fetch(base+path);assert.equal(response.status,404,path);assert.doesNotMatch(await response.text(),/createCompanyApp|access_token|refresh_token/);
  }
  for(const path of ['/pulse/api/project','/pulse/api/studio','/api/client-projects'])assert.equal((await fetch(base+path)).status,401,path);
});
