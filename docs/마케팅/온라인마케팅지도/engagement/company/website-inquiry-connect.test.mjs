import test from 'node:test';
import assert from 'node:assert/strict';
import {PassThrough,Readable} from 'node:stream';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {Store} from './store.mjs';
import {WEBSITE_INQUIRY_FORM_ID,WEBSITE_INQUIRY_SECRET} from './website-inquiry-google.mjs';
import {connectWebsiteInquiry,readWebsiteInquiryCredentialStdin,websiteInquiryCredentialInput} from './website-inquiry-connect.mjs';

const credentials={client_id:'synthetic.apps.googleusercontent.com',client_secret:'synthetic-secret',refresh_token:'synthetic-refresh'},sentinel={old:'keep'};
const form={formId:WEBSITE_INQUIRY_FORM_ID,settings:{emailCollectionType:'RESPONDER_INPUT'},items:['문의 유형','문의 내용','개인정보 수집·이용 동의'].map((title,i)=>({title,questionItem:{question:{questionId:'q'+i}}}))};
async function fixture(t){
  const root=await mkdtemp(join(tmpdir(),'synk-inquiry-connect-')),dataDir=join(root,'data');
  const store=new Store(dataDir);store.setSecret(WEBSITE_INQUIRY_SECRET,sentinel);store.close();
  t.after(async()=>{assert.equal(dirname(resolve(root)),resolve(tmpdir()));await rm(root,{recursive:true,force:true});});
  const calls=[];let behavior={};
  const fetchImpl=async(url,options)=>{
    calls.push(String(url));await behavior.hook?.();
    if(behavior.denied)return new Response('{}',{status:403});
    if(String(url)==='https://oauth2.googleapis.com/token'){
      assert.equal(options.body.get('refresh_token'),credentials.refresh_token);
      return Response.json({access_token:'synthetic-access',expires_in:3600});
    }
    const parsed=new URL(url);assert.equal(parsed.origin,'https://forms.googleapis.com');
    if(parsed.pathname.endsWith('/responses')){assert.equal(parsed.searchParams.get('fields'),'responses(responseId),nextPageToken');return Response.json({responses:[]});}
    return Response.json(form);
  };
  const secret=()=>{const store=new Store(dataDir);try{return store.secret(WEBSITE_INQUIRY_SECRET);}finally{store.close();}};
  return {root,dataDir,secret,calls,behavior,run:options=>connectWebsiteInquiry({dataDir,credentials,fetchImpl,...options})};
}

test('private stdin accepts only the bounded three-field credential shape without echo',async()=>{
  assert.deepEqual(await readWebsiteInquiryCredentialStdin(Readable.from([JSON.stringify(credentials)])),credentials);
  for(const value of [null,[],{...credentials,access_token:'unneeded'},{...credentials,refresh_token:''},{...credentials,refresh_token:'a\nb'},{}])
    assert.throws(()=>websiteInquiryCredentialInput(value));
  for(const value of ['not JSON',JSON.stringify({...credentials,extra:'PRIVATE'}),' '.repeat(16385)])
    await assert.rejects(readWebsiteInquiryCredentialStdin(Readable.from([value])),error=>{assert.doesNotMatch(error.message,/PRIVATE|synthetic/);return true;});
});

test('private stdin cancels or rejects truncation with listeners removed and no partial credentials',async()=>{
  for(const mode of ['abort','close','error']){
    const stream=new PassThrough(),controller=new AbortController();
    const pending=readWebsiteInquiryCredentialStdin(stream,{signal:controller.signal});
    stream.write('{"client_id":"PRIVATE_PARTIAL');
    if(mode==='abort')controller.abort();else if(mode==='close')stream.destroy();else stream.destroy(Error('PRIVATE_SOURCE'));
    await assert.rejects(pending,error=>{assert.doesNotMatch(error.message,/PRIVATE/);return true;});
    assert.equal(stream.listenerCount('data'),0);assert.equal(stream.listenerCount('end'),0);
  }
});

test('memory-input plan verifies without opening a write store or changing data bytes',async t=>{
  const f=await fixture(t),before=await readFile(join(f.dataDir,'company.sqlite'));
  assert.equal((await f.run()).installed,false);assert.ok(f.calls.length>0);
  assert.deepEqual(await readFile(join(f.dataDir,'company.sqlite')),before);assert.deepEqual(f.secret(),sentinel);
});

test('installation verifies metadata before final active-writer gate and encrypted write',async t=>{
  const f=await fixture(t);let checks=0;
  const result=await f.run({execute:true,assertInstall:()=>{checks++;assert.ok(f.calls.some(url=>url.includes('/responses')));assert.deepEqual(f.secret(),sentinel);}});
  assert.equal(checks,1);assert.equal(result.installed,true);assert.deepEqual(f.secret(),credentials);
  assert.equal((await readFile(join(f.dataDir,'company.sqlite'))).includes(Buffer.from(credentials.refresh_token)),false);
  assert.doesNotMatch(JSON.stringify(result),/synthetic|client_secret|refresh_token/);
});

test('provider denial, cancelled verify and denied final writer gate preserve previous ciphertext',async t=>{
  for(const mode of ['denied','cancel','gate']){
    const f=await fixture(t),controller=new AbortController(),before=await readFile(join(f.dataDir,'company.sqlite'));
    if(mode==='denied')f.behavior.denied=true;
    if(mode==='cancel')f.behavior.hook=()=>controller.abort();
    await assert.rejects(f.run({execute:true,signal:controller.signal,assertInstall:()=>{if(mode==='gate')throw Error('ACTIVE_OWNER_CHANGED');}}));
    assert.deepEqual(await readFile(join(f.dataDir,'company.sqlite')),before);assert.deepEqual(f.secret(),sentinel);
  }
});

test('conflicting input sources and install without new credentials fail before provider access',async t=>{
  const f=await fixture(t);
  for(const options of [{credentialsPath:'never-read'},{credentials:undefined,execute:true},{credentials:{...credentials,extra:true}}])
    await assert.rejects(f.run(options));
  assert.equal(f.calls.length,0);
});

test('CLI rejects stdin without explicit execute and ignores hostile stream text in diagnostics',async()=>{
  const file=fileURLToPath(new URL('./website-inquiry-connect.mjs',import.meta.url));
  const result=await new Promise((done,reject)=>{
    const child=spawn(process.execPath,[file,'--install-stdin'],{windowsHide:true,stdio:['pipe','pipe','pipe']});
    let stdout='',stderr='';child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);
    child.on('error',reject);child.on('close',code=>done({code,stdout,stderr}));child.stdin.on('error',()=>{});child.stdin.end('PRIVATE_INPUT_DO_NOT_ECHO');
  });
  assert.equal(result.code,1);assert.equal(result.stdout,'');assert.doesNotMatch(result.stderr,/PRIVATE_INPUT/);
});
