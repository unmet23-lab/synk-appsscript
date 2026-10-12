import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {checkPublicLink,isPublicLinkAddress} from './publication-link-probe.mjs';

const PUBLIC={address:'93.184.216.34',family:4};
function transport(responses){const requests=[];return {requests,requestImpl(options,callback){const request=new EventEmitter();request.destroy=()=>{request.destroyed=true;};request.end=()=>queueMicrotask(()=>{if(request.destroyed)return;const next=responses.shift();assert.ok(next,'unexpected network request');requests.push(options);if(next.error){request.emit('error',Object.assign(new Error('PRIVATE-NETWORK-DETAIL'),{code:next.error}));return;}if(next.hang)return;const response=new EventEmitter();response.statusCode=next.status??200;response.headers=next.headers||{};response.destroy=()=>{response.destroyed=true;};callback(response);queueMicrotask(()=>{if(response.destroyed)return;for(const chunk of next.chunks||[next.body||'']){response.emit('data',Buffer.from(chunk));if(response.destroyed)return;}response.emit('end');});});return request;}};}
const probe=(url,responses,extra={})=>{const fixture=transport(responses);return {fixture,run:checkPublicLink(url,{lookupImpl:async()=>[PUBLIC],requestImpl:fixture.requestImpl,...extra})};};

test('only public unicast IPv4/IPv6 are allowed, including mapped and transition exclusions',()=>{
  for(const address of ['8.8.8.8','93.184.216.34','2606:4700:4700::1111','2001:4860:4860::8888'])assert.equal(isPublicLinkAddress(address),true,address);
  for(const address of ['0.1.2.3','10.0.0.1','100.64.0.1','127.0.0.1','169.254.169.254','172.16.1.1','192.168.0.1','192.0.0.1','192.0.2.1','198.18.0.1','198.51.100.1','203.0.113.1','224.0.0.1','255.255.255.255','::','::1','::ffff:8.8.8.8','::ffff:127.0.0.1','fc00::1','fe80::1','fe80::1%eth0','ff02::1','2001:db8::1','2001::1','2002:0808:0808::1','3fff::1','invalid'])assert.equal(isPublicLinkAddress(address),false,address);
});

test('unsafe URL variants are rejected before DNS or requests and no credential material is returned',async()=>{
  let calls=0;for(const url of ['http://public.example','https://public.example:8443/x','https://user:PRIVATE-PASSWORD@public.example/','https://localhost/','https://host.local/','https://metadata.google.internal/','https://127.1/','https://2130706433/','https://0x7f000001/','https://[::ffff:127.0.0.1]/','https://public.example\\@127.0.0.1','https://public.example/\n']){
    const result=await checkPublicLink(url,{lookupImpl:async()=>{calls++;return [PUBLIC];},requestImpl:()=>{calls++;assert.fail('unsafe request');}});assert.equal(result.status,'manual-required',url);assert.equal(result.finalUrl,null);assert.doesNotMatch(JSON.stringify(result),/PRIVATE-PASSWORD/);
  }assert.equal(calls,0);
});

test('every DNS answer must be public and the connected address is pinned without a second resolution',async()=>{
  let dns=0;const f=transport([{status:200,headers:{'content-type':'application/pdf'}}]);const result=await checkPublicLink('https://public.example/file',{lookupImpl:async(host,options)=>{dns++;assert.equal(host,'public.example');assert.equal(options.all,true);return [PUBLIC];},requestImpl:f.requestImpl});assert.equal(result.status,'reachable');assert.equal(dns,1);const options=f.requests[0];assert.equal(options.agent,false);assert.equal(options.rejectUnauthorized,true);assert.equal(options.servername,'public.example');assert.equal(options.port,443);assert.deepEqual(Object.keys(options.headers).sort(),['Accept','Accept-Encoding','User-Agent']);
  options.lookup('rebound.example',{},(error,address,family)=>{assert.equal(error,null);assert.equal(address,PUBLIC.address);assert.equal(family,4);});options.lookup('rebound.example',{all:true},(error,addresses)=>assert.deepEqual(addresses,[PUBLIC]));assert.equal(dns,1);
  const blocked=await checkPublicLink('https://public.example/file',{lookupImpl:async()=>[PUBLIC,{address:'10.0.0.1',family:4}],requestImpl:()=>assert.fail('mixed DNS must not connect')});assert.equal(blocked.reason,'unsafe-target');
});

test('redirects are revalidated and cannot reach internal networks, non-HTTPS ports or credentials',async()=>{
  for(const location of ['https://127.0.0.1/private','http://public.example/insecure','https://user:secret@public.example/private','https://public.example:444/private','https://internal.example/private']){
    const f=transport([{status:302,headers:{location}}]);const result=await checkPublicLink('https://public.example/start',{lookupImpl:async host=>host==='internal.example'?[{address:'169.254.169.254',family:4}]:[PUBLIC],requestImpl:f.requestImpl});assert.equal(result.status,'manual-required');assert.equal(result.reason,'unsafe-target');assert.equal(f.requests.length,1);assert.equal(result.finalUrl,null);
  }
});

test('bounded redirect chains and loops retain only safe final response metadata',async()=>{
  const {run,fixture}=probe('https://public.example/0',Array.from({length:6},(_,index)=>({status:302,headers:{location:'/'+(index+1)}})));const result=await run;assert.equal(result.reason,'redirect-limit');assert.equal(fixture.requests.length,6);assert.equal(result.finalUrl,'https://public.example/5');
  const loop=probe('https://public.example/a',[{status:301,headers:{location:'/a'}}]);assert.equal((await loop.run).reason,'redirect-loop');assert.equal(loop.fixture.requests.length,1);
});

test('HEAD rejection is rechecked with bounded GET before not-found or access-limit results',async()=>{
  for(const status of [403,404,405,410,501]){const {run,fixture}=probe('https://public.example/file',[{status},{status:200,headers:{'content-type':'text/plain'},body:'available'}]);assert.equal((await run).status,'reachable');assert.deepEqual(fixture.requests.map(row=>row.method),['HEAD','GET']);}
  for(const status of [404,410]){const {run}=probe('https://public.example/missing',[{status},{status}]);const result=await run;assert.equal(result.status,'error');assert.equal(result.reason,'not-found');assert.equal(result.httpStatus,status);assert.doesNotMatch(result.detail,/삭제됐|삭제된/);}
});

test('HTML login and CAPTCHA challenges require actual user review even with HTTP 200',async()=>{
  for(const body of ['<input type="password">','<div class="cf-chl-test">verify you are human</div>','<div>captcha</div>','Sign in to continue','로그인이 필요합니다']){
    const {run,fixture}=probe('https://public.example/file',[{status:200,headers:{'content-type':'text/html'}},{status:200,headers:{'content-type':'text/html'},body}]);const result=await run;assert.equal(result.status,'manual-required');assert.equal(result.reason,'access-challenge');assert.equal(fixture.requests.length,2);
  }
  const login=probe('https://public.example/file',[{status:302,headers:{location:'/login'}},{status:200}]);assert.equal((await login.run).reason,'login-page');
});

test('social platforms, auth and throttling never become proof of a public post or download',async()=>{
  for(const url of ['https://www.youtube.com/watch?v=abcdefghijk','https://www.instagram.com/p/ABC123/','https://x.com/example/status/12345']){const {run,fixture}=probe(url,[{status:200}]);assert.equal((await run).reason,'social-page');assert.equal(fixture.requests.length,1);}
  for(const status of [401,403,429]){const {run}=probe('https://public.example/file',status===403?[{status},{status}]:[{status}]);assert.equal((await run).status,'manual-required');}
  const {run}=probe('https://public.example/file',[{status:200,headers:{'content-type':'application/octet-stream'}}]);const result=await run;assert.equal(result.label,'HTTP 응답 확인');assert.match(result.detail,/완료를 확인한 결과는 아닙니다/);
});

test('GET response body and declared length are limited to 64 KiB without returning page contents',async()=>{
  for(const payload of [{headers:{'content-length':'65537'},body:''},{chunks:['x'.repeat(32768),'x'.repeat(32769)]}]){const {run}=probe('https://public.example/file',[{status:405},{status:200,...payload}]);const result=await run;assert.equal(result.reason,'response-limit');assert.doesNotMatch(JSON.stringify(result),/xxxx/);}
});

test('DNS, TLS, 5xx and total deadline are bounded, sanitized error responses',async()=>{
  const dns=await checkPublicLink('https://public.example/',{lookupImpl:async()=>{throw new Error('PRIVATE-DNS');},requestImpl:()=>assert.fail()});assert.equal(dns.reason,'dns-error');assert.doesNotMatch(JSON.stringify(dns),/PRIVATE/);
  const connection=probe('https://public.example/',[{error:'CERT_HAS_EXPIRED'}]);assert.equal((await connection.run).reason,'connection-error');const unavailable=probe('https://public.example/',[{status:503}]);assert.equal((await unavailable.run).reason,'server-error');
  const lateDns=await checkPublicLink('https://public.example/',{timeoutMs:15,lookupImpl:()=>new Promise(()=>{}),requestImpl:()=>assert.fail()});assert.equal(lateDns.reason,'timeout');const hanging=probe('https://public.example/',[{hang:true}],{timeoutMs:15});assert.equal((await hanging.run).reason,'timeout');
});

test('cancellation aborts pending requests and encoded or unusual successful responses remain manual',async()=>{
  const controller=new AbortController(),f=transport([{hang:true}]);const promise=checkPublicLink('https://public.example/',{signal:controller.signal,lookupImpl:async()=>[PUBLIC],requestImpl:f.requestImpl});setTimeout(()=>controller.abort(),5);await assert.rejects(promise,{code:'CANCELLED'});
  const compressed=probe('https://public.example/',[{status:405},{status:200,headers:{'content-encoding':'gzip'},body:'binary'}]);assert.equal((await compressed.run).reason,'encoded-response');
});
