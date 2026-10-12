import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,realpath,rm} from 'node:fs/promises';
import {basename,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {request as httpRequest} from 'node:http';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {createProductionFixture} from './pulse-production-fixture.mjs';

const ASSETS=[
  ['/pulse-app/production-library/','text/html; charset=utf-8','production-library/index.html'],
  ['/pulse-app/production-library/index.html','text/html; charset=utf-8','production-library/index.html'],
  ['/pulse-app/production-library/library.js','text/javascript; charset=utf-8','production-library/library.js'],
  ['/pulse-app/production-library/library.css','text/css; charset=utf-8','production-library/library.css'],
  ['/pulse-app/production-catalog.mjs','text/javascript; charset=utf-8','production-catalog.mjs'],
  ...['01-harin-coffee-v3.webp','02-yuna-perfume.webp','03-taejun-tailoring.webp','04-runway-comparison-v2.webp','04-runway-comparison-proportion-v1.webp'].map(name=>['/pulse-app/assets/production/'+name,'image/webp','assets/production/'+name]),
  ...['m01','f01','f02','f03','m02','f04','m03'].map(id=>['/pulse-app/assets/casting/fullbody/'+id+'-fullbody-v1.webp','image/webp','assets/casting/fullbody/'+id+'-fullbody-v1.webp']),
];
let fixture;
const responses=new Map();
before(async()=>{
  fixture=await createProductionFixture({seed:false});
  for(const [path]of ASSETS){
    const response=await fetch(fixture.base+path);
    responses.set(path,{status:response.status,headers:response.headers,bytes:Buffer.from(await response.arrayBuffer())});
  }
});
after(async()=>{
  if(!fixture)return;
  await fixture.stop();
  const directory=await realpath(fixture.directory),parent=await realpath(tmpdir());
  assert.equal(dirname(directory).toLowerCase(),parent.toLowerCase());
  assert.ok(basename(directory).startsWith('synk-pulse-production-'));
  await rm(directory,{recursive:true,force:true});
});
const textAt=path=>responses.get(path).bytes.toString('utf8');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

test('HTTP anonymous library, scripts, styles, boards and seven full-body references return exact MIME and source bytes',async()=>{
  for(const [path,mime,file]of ASSETS){
    const actual=responses.get(path);
    assert.equal(actual.status,200,path);
    assert.equal(actual.headers.get('content-type'),mime,path+' MIME');
    assert.equal(actual.headers.get('x-content-type-options'),'nosniff',path);
    const cacheControl=actual.headers.get('cache-control');
    if(mime.startsWith('text/html'))assert.equal(cacheControl,'no-store',path);
    else assert.ok(['no-store','public, max-age=0, must-revalidate'].includes(cacheControl),path+' public asset must be fetched or revalidated');
    assert.equal(sha(actual.bytes),sha(await readFile(new URL('./public/pulse-app/'+file,import.meta.url))),path+' bytes');
    if(mime==='image/webp'){
      assert.equal(actual.bytes.subarray(0,4).toString(),'RIFF');
      assert.equal(actual.bytes.subarray(8,12).toString(),'WEBP');
    }
  }
  assert.equal(ASSETS.filter(([,mime])=>mime==='image/webp').length,12);
  const html=textAt('/pulse-app/production-library/');
  assert.match(html,/assets\/production\/04-runway-comparison-proportion-v1\.webp/);
  assert.doesNotMatch(html,/assets\/production\/04-runway-comparison-v2\.webp/);
  assert.equal((html.match(/<figure class="fullbody-reference"/g)||[]).length,7);
  for(const [path]of ASSETS.filter(([path])=>path.includes('/casting/fullbody/'))){
    const reference='../'+path.slice('/pulse-app/'.length);
    assert.ok(html.includes('src="'+reference+'"'),path+' visible reference');
    assert.ok(html.includes('href="'+reference+'" target="_blank" rel="noopener noreferrer"'),path+' isolated enlarged view');
  }
  assert.match(textAt('/pulse-app/production-library/library.css'),/\.fullbody-reference-media img\{[^}]*object-fit:contain/);
});

test('HTTP library uses only same-origin external resources under the unchanged strict script and style CSP',async()=>{
  const html=textAt('/pulse-app/production-library/'),css=textAt('/pulse-app/production-library/library.css');
  for(const [path]of ASSETS){
    const csp=responses.get(path).headers.get('content-security-policy');
    assert.ok(csp,path+' CSP exists');
    const directives=new Map(csp.split(';').map(value=>value.trim()).filter(Boolean).map(value=>{const [name,...rules]=value.split(/\s+/);return[name,rules];}));
    assert.deepEqual(directives.get('script-src'),["'self'"]);
    assert.deepEqual(directives.get('style-src'),["'self'"]);
    assert.deepEqual(directives.get('connect-src'),["'self'"]);
    assert.deepEqual(directives.get('frame-ancestors'),["'none'"]);
    assert.doesNotMatch(csp,/unsafe-inline|unsafe-eval/);
  }
  assert.doesNotMatch(html,/<style\b|\sstyle\s*=|\son(?:click|load|error)\s*=/i);
  const scripts=Array.from(html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi));
  assert.equal(scripts.length,1);
  assert.match(scripts[0][1],/\bsrc="\.\/library\.js"/);
  assert.equal(scripts[0][2].trim(),'');
  const pageUrl=new URL('/pulse-app/production-library/',fixture.base),resources=new Set();
  for(const tag of html.matchAll(/<(?:img|script|link|source|video|audio)\b[^>]*>/gi)){
    const attribute=/\b(?:src|href)="([^"]+)"/i.exec(tag[0]);
    if(attribute)resources.add(new URL(attribute[1],pageUrl).href);
  }
  assert.doesNotMatch(css,/@import\b/i);
  for(const match of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi))resources.add(new URL(match[1],new URL('./library.css',pageUrl)).href);
  assert.ok(resources.size>=10,'HTML and font resources were inspected');
  for(const value of resources){
    const url=new URL(value);
    assert.equal(url.origin,pageUrl.origin,'no external resource host');
    assert.ok(url.pathname.startsWith('/pulse-app/'),'public PULSE asset only');
    assert.equal((await fetch(url)).status,200,url.pathname);
  }
});

test('public text omits local paths, fixture secrets, editable plan data and English generation prompts',()=>{
  const publicText=ASSETS.filter(([,mime])=>mime!=='image/webp').map(([path])=>textAt(path)).join('\n');
  assert.doesNotMatch(publicText,/[A-Z]:[\\/]Users[\\/]|\/Users\/|\.tmp[\\/]|file:\/\/|PC_백업|복원목록\.json|plan\.json|image-prompts\.json/i);
  assert.doesNotMatch(publicText,/csrfToken|inviteHash|privateAssetUrl|synk_company_session|"(?:prompt|assetNotes)"\s*:/);
  assert.doesNotMatch(publicText,/Locked overhead camera|Locked close camera|A very slow push-in|No camera movement|Glass shape and liquid level remain constant/);
  const html=textAt('/pulse-app/production-library/');
  assert.doesNotMatch(html,/<textarea\b|id="plan-data"|data-copy=|제작 프롬프트|프롬프트 복사/);
  for(const secret of [fixture.invite,fixture.customer.csrf,fixture.customer.cookie,fixture.email,fixture.password])assert.equal(publicText.includes(secret),false,'fixture private data remains private');
  assert.match(html,/영상 제작 전 기획안/);
  assert.match(html,/가상의 제작 예시/);
});

function rawGet(path){
  const base=new URL(fixture.base);
  return new Promise((resolve,reject)=>{
    const request=httpRequest({hostname:base.hostname,port:base.port,path,method:'GET'},response=>{
      const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>resolve({status:response.statusCode,bytes:Buffer.concat(chunks)}));
    });
    request.on('error',reject);request.end();
  });
}

test('HTTP explicit allowlist rejects private plan files and raw encoded traversal paths',async()=>{
  const paths=[
    '/pulse-app/production-library/plan.json',
    '/pulse-app/production-library/image-prompts.json',
    '/pulse-app/production-library/../../private',
    '/pulse-app/production-library/../../private/plan.json',
    '/pulse-app/production-library/%2e%2e/%2e%2e/private',
    '/pulse-app/production-library/%2e%2e%2f%2e%2e%2fprivate',
    '/pulse-app/production-library/..%5c..%5cprivate',
    '/pulse-app/production-library/plan.json?download=1',
    '/pulse-app/assets/production/../../private',
    '/pulse-app/assets/production/01-harin-coffee-v2.webp',
    '/pulse-app/assets/casting/fullbody/m99-fullbody-v1.webp',
    '/pulse-app/assets/casting/fullbody/M01-fullbody-v1.webp',
    '/pulse-app/assets/casting/fullbody/m01-fullbody-v2.webp',
    '/pulse-app/assets/casting/fullbody/m01-fullbody-v1.png',
    '/pulse-app/assets/casting/fullbody/../../private',
    '/pulse-app/assets/casting/fullbody/%2e%2e%2fprivate',
    '/pulse-app/assets/casting/fullbody/..%5cprivate',
  ];
  for(const path of paths){
    const response=await rawGet(path);
    assert.equal(response.status,404,path);
    assert.doesNotMatch(response.bytes.toString(),/"projects"\s*:|"prompt"\s*:|Locked overhead camera/);
  }
});

test('service worker accepts the public production module and never caches APIs, invitations or uploaded media',async()=>{
  const response=await fetch(fixture.base+'/pulse-app/sw.js');
  assert.equal(response.status,200);
  const source=await response.text(),handlers=new Map(),installs=[],puts=[],network=[];
  const ok={ok:true,type:'basic',clone(){return this;}};
  const cache={async addAll(paths){installs.push(...paths);},async put(request){puts.push(new URL(request.url).pathname);}};
  const environment={URL,Promise,Set,caches:{async open(){return cache;},async keys(){return[];},async delete(){return true;},async match(){return ok;}},fetch:async request=>{network.push(request.url);return ok;},self:{location:{origin:fixture.base},clients:{async claim(){}},addEventListener(name,handler){handlers.set(name,handler);}}};
  runInNewContext(source,environment,{filename:'served-pulse-sw.js'});
  let install;
  handlers.get('install')({waitUntil(value){install=value;}});
  await install;
  assert.ok(installs.includes('/pulse-app/production-catalog.mjs'));
  assert.ok(installs.every(path=>path.startsWith('/pulse-app/')&&!/[?#]/.test(path)));
  assert.equal(installs.some(path=>/\/api\/|invite|\/media\/|assets\/casting\/voice\//.test(path)),false);
  async function visit(path,method='GET'){
    const writes=puts.length,waits=[];let handled=false,result;
    handlers.get('fetch')({request:{url:new URL(path,fixture.base).href,method},respondWith(value){handled=true;result=value;},waitUntil(value){waits.push(value);}});
    if(handled)await result;await Promise.all(waits);
    return {handled,newWrites:puts.length-writes};
  }
  assert.deepEqual(await visit('/pulse-app/production-catalog.mjs'),{handled:true,newWrites:1});
  for(const [path,method]of [
    ['/pulse/api/project','GET'],['/pulse/api/open','POST'],['/api/client-projects','GET'],
    ['/pulse/api/media/synthetic','GET'],['/api/client-projects/synthetic/media','GET'],
    ['/pulse-app/?invite=synthetic-private-value','GET'],['/pulse-app/?mode=staff','GET'],
    ['/pulse-app/production-catalog.mjs?invite=synthetic-private-value','GET'],
    ['/pulse-app/production-catalog.mjs','POST'],['https://external.example.test/pulse-app/production-catalog.mjs','GET'],
  ])assert.deepEqual(await visit(path,method),{handled:false,newWrites:0},method+' '+path);
  assert.deepEqual(await visit('/pulse-app/#invite=synthetic-private-value'),{handled:true,newWrites:0},'fragment navigation may fetch the public shell but cannot cache an invitation response');
  assert.deepEqual(puts,['/pulse-app/production-catalog.mjs']);
});
