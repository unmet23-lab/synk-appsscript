import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readdir,readFile,writeFile,symlink,unlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {Readable} from 'node:stream';
import {randomUUID} from 'node:crypto';
import {DELIVERY_SUBTITLE_LIMIT,receiveDeliveryMedia,commitDeliveryMedia,discardDeliveryMedia,serveDeliveryMedia} from './client-delivery-media.mjs';

const srt=Buffer.from('1\n00:00:00,000 --> 00:00:02,800\n합성 최종 자막입니다.\n'),vtt=Buffer.from('WEBVTT\n\n00:00.000 --> 00:02.800\n합성 최종 자막입니다.\n');
const rejectsStatus=(run,status)=>assert.rejects(run,error=>error.status===status);
async function fixture(t){const directory=await mkdtemp(join(tmpdir(),'synk-delivery-media-'));t.after(async()=>{assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});return directory;}
function request(bytes=srt,headers={},chunks=null){const req=Readable.from(chunks||[bytes]);req.headers={'x-file-name':encodeURIComponent('최종 자막.srt'),'x-version-label':encodeURIComponent('최종 자막'),'content-type':'application/x-subrip',...headers};return req;}
function response(){return {status:null,headers:null,bytes:null,writeHead(status,headers){this.status=status;this.headers=headers;},end(bytes){this.bytes=bytes?Buffer.from(bytes):Buffer.alloc(0);}};}
async function saved(directory,bytes=srt,headers={}){const upload=await receiveDeliveryMedia(request(bytes,headers),directory);await commitDeliveryMedia(upload,directory);return upload;}

test('subtitle body format must agree with the file extension and resulting MIME',async t=>{
  const directory=await fixture(t);
  await rejectsStatus(()=>receiveDeliveryMedia(request(vtt),directory),415);
  await rejectsStatus(()=>receiveDeliveryMedia(request(srt,{'x-file-name':'ko.vtt','content-type':'text/vtt'}),directory),422);
  assert.deepEqual(await readdir(join(directory,'studio-media')).catch(()=>[]),[]);
});

test('BOM, CRLF and split UTF-8 chunks preserve the original subtitle bytes',async t=>{
  const directory=await fixture(t),bytes=Buffer.concat([Buffer.from([239,187,191]),Buffer.from(srt.toString().replace(/\n/g,'\r\n'))]),chunks=Array.from(bytes,byte=>Buffer.from([byte]));const upload=await receiveDeliveryMedia(request(bytes,{},chunks),directory);
  assert.equal(upload.metadata.byteSize,bytes.length);assert.deepEqual(await readFile(upload.temporary),bytes);await commitDeliveryMedia(upload,directory);assert.deepEqual(await readFile(join(directory,'studio-media',upload.metadata.diskName)),bytes);
  const res=response();await serveDeliveryMedia({method:'GET',headers:{}},res,directory,upload.metadata);assert.equal(res.status,200);assert.deepEqual(res.bytes,bytes);assert.equal(res.headers['Content-Type'],'application/x-subrip; charset=utf-8');assert.match(res.headers['Content-Disposition'],/^attachment;/);
});

test('streamed subtitle limit is enforced even with an absent or false small content length',async t=>{
  const directory=await fixture(t),bytes=Buffer.alloc(DELIVERY_SUBTITLE_LIMIT+1,65);
  for(const headers of [{},{'content-length':'1'}])await rejectsStatus(()=>receiveDeliveryMedia(request(bytes,headers,[bytes.subarray(0,DELIVERY_SUBTITLE_LIMIT),bytes.subarray(DELIVERY_SUBTITLE_LIMIT)]),directory),413);
  await rejectsStatus(()=>receiveDeliveryMedia(request(srt,{'content-length':String(DELIVERY_SUBTITLE_LIMIT+1)}),directory),413);assert.deepEqual(await readdir(join(directory,'studio-media')).catch(()=>[]),[]);
});

test('malformed encoding, control bytes and broken header encoding are rejected before storing a file',async t=>{
  const directory=await fixture(t);
  for(const bytes of [Buffer.alloc(0),Buffer.from([255,254]),Buffer.concat([srt,Buffer.from([0])]),Buffer.from('1\n00:00:04,000 --> 00:00:02,000\n역순 시간\n')])await rejectsStatus(()=>receiveDeliveryMedia(request(bytes),directory),422);
  for(const headers of [{'x-file-name':'%ZZ'},{'x-version-label':'%0D%0Ainjected'},{'x-file-name':'%00bad.srt'},{'x-version-label':'x'.repeat(121)}])await rejectsStatus(()=>receiveDeliveryMedia(request(srt,headers),directory),400);
  assert.deepEqual(await readdir(join(directory,'studio-media')).catch(()=>[]),[]);
});

test('subtitle type mismatch and non-subtitle files cannot use the subtitle upload route to bypass media signatures',async t=>{
  const directory=await fixture(t);
  for(const headers of [{'content-type':'text/vtt'},{'content-type':'text/html'},{'content-type':'video/mp4'},{'x-file-name':'file.html','content-type':'application/x-subrip'},{'x-file-name':'file.mp4','content-type':'video/mp4'}])await rejectsStatus(()=>receiveDeliveryMedia(request(srt,headers),directory),415);
  assert.deepEqual(await readdir(join(directory,'studio-media')).catch(()=>[]),[]);
});

test('interrupted subtitle upload stores no partial file',async t=>{
  const directory=await fixture(t),failure=new Error('합성 연결 중단'),req=Readable.from((async function*(){yield srt.subarray(0,12);throw failure;})());req.headers=request().headers;
  await assert.rejects(()=>receiveDeliveryMedia(req,directory),error=>error===failure);assert.deepEqual(await readdir(join(directory,'studio-media')).catch(()=>[]),[]);
});

test('discard removes only the prepared or committed upload and preserves other saved files',async t=>{
  const directory=await fixture(t),keep=await saved(directory),temporary=await receiveDeliveryMedia(request(),directory);await discardDeliveryMedia(temporary,directory);assert.deepEqual(await readdir(join(directory,'studio-media')),[keep.metadata.diskName]);
  const committed=await saved(directory,vtt,{'x-file-name':'ko.vtt','content-type':'text/vtt'});await discardDeliveryMedia(committed,directory);await discardDeliveryMedia(committed,directory);assert.deepEqual(await readdir(join(directory,'studio-media')),[keep.metadata.diskName]);assert.deepEqual(await readFile(join(directory,'studio-media',keep.metadata.diskName)),srt);
});

test('stored subtitle size changes, wrong metadata extension and paths outside the media folder are rejected',async t=>{
  const directory=await fixture(t),upload=await saved(directory),serve=metadata=>serveDeliveryMedia({method:'GET',headers:{}},response(),directory,metadata);
  await rejectsStatus(()=>serve({...upload.metadata,byteSize:srt.length+1}),409);await rejectsStatus(()=>serve({...upload.metadata,diskName:'../'+upload.metadata.diskName}),404);await rejectsStatus(()=>serve({...upload.metadata,mimeType:'text/vtt'}),404);
  await writeFile(join(directory,'studio-media',upload.metadata.diskName),Buffer.concat([srt,Buffer.from('changed')]));await rejectsStatus(()=>serve(upload.metadata),409);
});

test('stored subtitle symlinks are never served',async t=>{
  const directory=await fixture(t),upload=await saved(directory),link=join(directory,'studio-media',randomUUID()+'.srt'),target=join(directory,'studio-media',upload.metadata.diskName);
  try{await symlink(target,link,'file');}catch(error){if(['EPERM','EACCES','ENOSYS'].includes(error.code)){t.skip('이 환경은 파일 symlink 생성을 허용하지 않습니다.');return;}throw error;}
  const metadata={...upload.metadata,diskName:link.split(/[\\/]/).at(-1)};await rejectsStatus(()=>serveDeliveryMedia({method:'GET',headers:{}},response(),directory,metadata),404);await unlink(link);assert.deepEqual(await readFile(target),srt);
});

test('authorization is rechecked after the subtitle file read and before any headers or bytes, including ranges',async t=>{
  const directory=await fixture(t),upload=await saved(directory);let calls=0;
  for(const headers of [{},{range:'bytes=0-9'},{range:'bytes=99999-'}]){const res=response();await rejectsStatus(()=>serveDeliveryMedia({method:'GET',headers},res,directory,upload.metadata,()=>{calls++;throw Object.assign(new Error('접근 철회'),{status:401});}),401);assert.equal(res.status,null);assert.equal(res.bytes,null);}
  assert.equal(calls,3);
});

test('subtitle HEAD and range responses preserve exact lengths and security headers',async t=>{
  const directory=await fixture(t),upload=await saved(directory);
  for(const [method,range,status,expected] of [['GET','bytes=2-6',206,srt.subarray(2,7)],['GET','bytes=-5',206,srt.subarray(-5)],['HEAD','bytes=2-6',206,Buffer.alloc(0)],['HEAD',undefined,200,Buffer.alloc(0)]]){const res=response();await serveDeliveryMedia({method,headers:range?{range}:{}},res,directory,upload.metadata);assert.equal(res.status,status);assert.deepEqual(res.bytes,expected);assert.equal(res.headers['Content-Length'],range?5:srt.length);assert.equal(res.headers['X-Content-Type-Options'],'nosniff');assert.equal(res.headers['Cache-Control'],'private, no-store');assert.equal(res.headers['Cross-Origin-Resource-Policy'],'same-origin');assert.match(res.headers['Content-Security-Policy'],/sandbox/);}
  for(const range of ['bytes=99999-','bytes=2-1','bytes=-0','bytes=0-1,4-5']){const res=response();await serveDeliveryMedia({method:'GET',headers:{range}},res,directory,upload.metadata);assert.equal(res.status,416);assert.equal(res.headers['Content-Range'],'bytes */'+srt.length);assert.equal(res.bytes.length,0);}
});

test('parser warnings do not silently change valid overlapping subtitle text or timestamps',async t=>{
  const directory=await fixture(t),bytes=Buffer.from('1\n00:00:00,000 --> 00:00:03,000\n겹치는 대사 하나\n\n2\n00:00:02,000 --> 00:00:04,000\n겹치는 대사 둘\n'),upload=await saved(directory,bytes);assert.deepEqual(await readFile(join(directory,'studio-media',upload.metadata.diskName)),bytes);
});
