import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink,rename,stat,utimes,open,appendFile,truncate} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {fstatSync} from 'node:fs';
import fsPromises from 'node:fs/promises';
import {syncBuiltinESMExports} from 'node:module';
import {createDeliveryFileInspector} from './delivery-file-inspection.mjs';

const run=promisify(execFile),ffmpeg=process.env.SYNK_FFMPEG_EXE||'ffmpeg',ffprobe=process.env.SYNK_FFPROBE_EXE||'ffprobe';
let available=false;try{await run(ffmpeg,['-version'],{windowsHide:true,timeout:5000});await run(ffprobe,['-version'],{windowsHide:true,timeout:5000});available=true;}catch{}
const realMedia={skip:available?false:'FFmpeg/FFprobe가 없어 실제 파일 검사만 생략'};
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV6kAAAAASUVORK5CYII=','base64');
const fakeMp4=Buffer.concat([Buffer.from([0,0,0,16]),Buffer.from('ftypisom0000'),Buffer.alloc(30)]);
const srt='1\n00:00:00,000 --> 00:00:01,500\n안녕하세요.\n\n2\n00:00:01,600 --> 00:00:02,750\n다음 장면\n';
const probeData={streams:[{codec_type:'video',codec_name:'h264',width:320,height:180,sample_aspect_ratio:'1:1'},{codec_type:'audio',codec_name:'aac'}],format:{duration:'2.5'}};

async function fixture(t,options={}){
  const directory=await mkdtemp(join(tmpdir(),'synk-delivery-inspection-'));await mkdir(join(directory,'studio-media'));
  const inspector=createDeliveryFileInspector({directory,...options});
  t.after(async()=>{await inspector.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-delivery-inspection-'));await rm(directory,{recursive:true,force:true});});
  async function file(bytes,mimeType='video/mp4',extension='mp4'){
    const id=randomUUID(),diskName=id+'.'+extension,path=join(directory,'studio-media',diskName);await writeFile(path,bytes);
    return {id,diskName,mimeType,byteSize:bytes.length,fileName:'합성 확인 파일.'+extension,path};
  }
  async function generated(extension,args){
    const id=randomUUID(),diskName=id+'.'+extension,path=join(directory,'studio-media',diskName);
    await run(ffmpeg,['-hide_banner','-loglevel','error',...args,path],{windowsHide:true,timeout:20000});
    const bytes=await readFile(path),mimeType={mp4:'video/mp4',webm:'video/webm',png:'image/png',jpg:'image/jpeg'}[extension];
    return {id,diskName,mimeType,byteSize:bytes.length,fileName:'합성 확인 파일.'+extension,path};
  }
  return {directory,inspector,file,generated};
}

function fakeProbe({data=probeData,stderr='',code=0,hang=false,raw,onSpawn=()=>{}}={}){
  const calls=[];
  function spawn(executable,args,options){
    const child=new EventEmitter();child.exitCode=null;child.stdout=new PassThrough();child.stderr=new PassThrough();let killed=false;
    child.kill=()=>{if(!killed){killed=true;child.exitCode=-1;queueMicrotask(()=>child.emit('close',null,'SIGTERM'));}return true;};
    child.stdin=null;
    const call={executable,args,options,child};calls.push(call);onSpawn(call);
    if(!hang)setImmediate(()=>{if(killed)return;child.stdout.end(raw??JSON.stringify(data));child.stderr.end(stderr);child.exitCode=code;child.emit('close',code,null);});
    return child;
  }
  return {spawn,calls};
}

async function fixedTimestampCollision(t,path){
  const identity=await stat(path,{bigint:true}),reference=await open(path,'r'),prototype=Object.getPrototypeOf(reference),handleStat=prototype.stat,pathStat=fsPromises.lstat;await reference.close();
  const fixed=info=>{info.mtimeNs=identity.mtimeNs;info.ctimeNs=identity.ctimeNs;return info;};
  t.mock.method(prototype,'stat',async function(...args){return fixed(await handleStat.apply(this,args));});
  t.mock.method(fsPromises,'lstat',async function(target,...args){const info=await pathStat.call(this,target,...args);return resolve(String(target))===resolve(path)?fixed(info):info;});
  // Hold the cache age in the recent-file guard, independent of test runner load.
  t.mock.method(Date,'now',()=>Math.ceil(Number(identity.ctimeNs)/1e6)+500);
  syncBuiltinESMExports();t.after(()=>{t.mock.restoreAll();syncBuiltinESMExports();});
}

test('SRT and VTT use the existing parser, return bounded metadata and a hash without text',async t=>{
  const f=await fixture(t),media=await f.file(Buffer.from(srt),'application/x-subrip','srt'),result=await f.inspector.inspect(media);
  assert.equal(result.status,'inspected');assert.deepEqual(result.metadata,{kind:'subtitle',subtitleFormat:'srt',cueCount:2,lastCueEnd:2.75,subtitleWarnings:0});
  assert.equal(result.sha256,digest(Buffer.from(srt)));assert.equal(result.byteSize,Buffer.byteLength(srt));assert.ok(!JSON.stringify(result).includes('안녕하세요'));assert.ok(!JSON.stringify(result).includes(f.directory));
  const vtt=await f.file(Buffer.from('WEBVTT\n\n00:00.000 --> 00:01.000\n안녕하세요.\n'),'text/vtt','vtt');
  assert.deepEqual((await f.inspector.inspect(vtt)).metadata,{kind:'subtitle',subtitleFormat:'vtt',cueCount:1,lastCueEnd:1,subtitleWarnings:0});
});

test('subtitle invalid encoding, timestamps, wrong headers and empty content never pass',async t=>{
  const f=await fixture(t);
  for(const [bytes,mime,ext,code] of [
    [Buffer.from([0xff,0xfe,0x20]),'application/x-subrip','srt','subtitle_encoding'],
    [Buffer.from('1\n00:00:02,000 --> 00:00:01,000\n역순'),'application/x-subrip','srt','subtitle_invalid'],
    [Buffer.from('00:00.000 --> 00:01.000\n헤더 누락'),'text/vtt','vtt','subtitle_invalid'],
    [Buffer.from('WEBVTT\n\n00:00.000 --> 00:01.000\n본문'),'application/x-subrip','srt','subtitle_invalid'],
    [Buffer.from('   '),'application/x-subrip','srt','subtitle_invalid'],
  ]){const result=await f.inspector.inspect(await f.file(bytes,mime,ext));assert.equal(result.status,'corrupt');assert.equal(result.code,code);}
});

test('subtitle readability warnings remain distinct from invalid timing syntax',async t=>{
  const f=await fixture(t),media=await f.file(Buffer.from('1\n00:00:00,000 --> 00:00:00,100\n이 문장은 읽는 시간보다 너무 길어서 직접 확인해야 합니다.\n'),'application/x-subrip','srt');
  const result=await f.inspector.inspect(media);assert.equal(result.status,'inspected');assert.ok(result.metadata.subtitleWarnings>0);
});

test('storage whitelist rejects traversal, malformed UUIDs, MIME disagreement, sizes and signatures',async t=>{
  const f=await fixture(t),media=await f.file(png,'image/png','png');
  for(const patch of [{diskName:'../private.png'},{diskName:'------------------------------------.png'},{mimeType:'video/mp4'},{byteSize:0},{byteSize:media.byteSize+1},{byteSize:100*1024*1024+1}]){
    const result=await f.inspector.inspect({...media,...patch});assert.equal(result.status,'corrupt');assert.ok(!JSON.stringify(result).includes(f.directory));
  }
  const bad=await f.file(Buffer.from('not an actual PNG file'),'image/png','png');assert.equal((await f.inspector.inspect(bad)).code,'signature_mismatch');
  assert.equal((await f.inspector.inspect({...media,mimeType:'audio/mpeg'})).code,'unsupported');
  assert.equal((await f.inspector.inspect({...media,diskName:randomUUID()+'.png'})).code,'missing');
});

test('file symlinks are rejected before reading',async t=>{
  const f=await fixture(t),original=await f.file(png,'image/png','png'),alias=join(f.directory,'studio-media',randomUUID()+'.png');
  try{await symlink(original.path,alias,'file');}catch(error){if(['EPERM','EACCES','ENOSYS'].includes(error.code)){t.skip('이 환경은 파일 심볼릭 링크 생성을 허용하지 않습니다.');return;}throw error;}
  assert.equal((await f.inspector.inspect({...original,diskName:alias.split(/[\\/]/).pop()})).code,'invalid_path');
});

test('a media-directory junction or symlink is rejected before reading',async t=>{
  const f=await fixture(t),original=await f.file(png,'image/png','png');
  const moved=join(f.directory,'original-media');await rename(join(f.directory,'studio-media'),moved);await symlink(moved,join(f.directory,'studio-media'),process.platform==='win32'?'junction':'dir');
  assert.equal((await f.inspector.inspect(original)).code,'invalid_path');
});

test('probe inherits only the verified seekable file handle, corrects rotation and sample aspect ratio',async t=>{
  const fake=fakeProbe({data:{...probeData,streams:[{...probeData.streams[0],width:720,height:480,sample_aspect_ratio:'4:3',side_data_list:[{rotation:90}]},probeData.streams[1]]}});
  const f=await fixture(t,{spawnProcess:fake.spawn}),media=await f.file(fakeMp4),result=await f.inspector.inspect(media);
  assert.equal(result.status,'inspected');assert.equal(result.metadata.width,480);assert.equal(result.metadata.height,720);assert.equal(result.metadata.displayAspectRatio,0.5);assert.equal(result.metadata.duration,2.5);assert.deepEqual(result.metadata.audioCodecs,['aac']);
  const call=fake.calls[0];assert.equal(call.args[call.args.indexOf('-protocol_whitelist')+1],'fd');assert.equal(call.args[call.args.indexOf('-fd')+1],'0');assert.equal(call.args.at(-1),'fd:');assert.ok(!call.args.includes(media.path));assert.ok(Number.isInteger(call.options.stdio[0]));assert.equal(call.options.windowsHide,true);
});

test('successful cache verifies live file identity and timestamps; force and same-size edits trigger reinspection',async t=>{
  const fake=fakeProbe(),f=await fixture(t,{spawnProcess:fake.spawn}),media=await f.file(fakeMp4);
  const first=await f.inspector.inspect(media);assert.equal(first.status,'inspected');first.metadata.width=999;
  assert.equal((await f.inspector.inspect(media)).metadata.width,320);assert.equal(fake.calls.length,1);
  await f.inspector.inspect(media,{force:true});assert.equal(fake.calls.length,2);
  const before=await stat(media.path),changed=Buffer.from(fakeMp4);changed[changed.length-1]=7;await writeFile(media.path,changed);await utimes(media.path,before.atime,before.mtime);
  const fresh=await f.inspector.inspect(media);assert.equal(fake.calls.length,3);assert.notEqual(fresh.sha256,first.sha256);
  await rm(media.path);assert.equal((await f.inspector.inspect(media)).code,'missing');
});

test('incremental media hashing includes every byte before, at and after a chunk boundary',async t=>{
  const fake=fakeProbe(),f=await fixture(t,{spawnProcess:fake.spawn});
  for(const size of [1024*1024-1,1024*1024,1024*1024+19]){
    const bytes=Buffer.alloc(size,37);fakeMp4.copy(bytes);bytes[bytes.length-1]=91;
    const media=await f.file(bytes),result=await f.inspector.inspect(media);
    assert.equal(result.status,'inspected');assert.equal(result.byteSize,size);assert.equal(result.sha256,digest(bytes));
  }
  assert.equal(fake.calls.length,3);
});

test('short reads preserve a split media signature and the full content hash',async t=>{
  const fake=fakeProbe(),f=await fixture(t,{spawnProcess:fake.spawn}),bytes=Buffer.alloc(5203,37);fakeMp4.copy(bytes);
  const media=await f.file(bytes),reference=await open(media.path,'r'),prototype=Object.getPrototypeOf(reference),read=prototype.read;await reference.close();let reads=0;
  t.mock.method(prototype,'read',async function(buffer,offset,length,position){reads++;return read.call(this,buffer,offset,Math.min(length,7),position);});
  const result=await f.inspector.inspect(media);assert.equal(result.status,'inspected');assert.equal(result.sha256,digest(bytes));assert.equal(result.byteSize,bytes.length);assert.ok(reads>700);assert.equal(fake.calls.length,1);
});

test('growth, truncation and same-size writes during chunked reads cannot pass or reach FFprobe',async t=>{
  for(const change of ['grow','truncate','overwrite'])await t.test(change,async t=>{
    const fake=fakeProbe(),f=await fixture(t,{spawnProcess:fake.spawn}),bytes=Buffer.alloc(3*1024*1024,37);fakeMp4.copy(bytes);
    const media=await f.file(bytes),reference=await open(media.path,'r'),prototype=Object.getPrototypeOf(reference),read=prototype.read;await reference.close();let reads=0;
    t.mock.method(prototype,'read',async function(...args){
      const result=await read.apply(this,args);
      if(++reads===1){
        if(change==='grow')await appendFile(media.path,Buffer.from([1]));
        else if(change==='truncate')await truncate(media.path,bytes.length-1);
        else {const writer=await open(media.path,'r+');try{await writer.write(Buffer.from([99]),0,1,bytes.length-1);}finally{await writer.close();}}
      }
      return result;
    });
    const result=await f.inspector.inspect(media);assert.equal(result.code,'file_changed');assert.equal(result.sha256,undefined);assert.equal(fake.calls.length,0);
  });
});

test('shutdown during incremental hashing stops before probing and releases the file handle',async t=>{
  const fake=fakeProbe(),f=await fixture(t,{spawnProcess:fake.spawn}),bytes=Buffer.alloc(3*1024*1024,37);fakeMp4.copy(bytes);
  const media=await f.file(bytes),reference=await open(media.path,'r'),prototype=Object.getPrototypeOf(reference),read=prototype.read;await reference.close();let closePromise,inspectionFd;
  t.mock.method(prototype,'read',async function(...args){const result=await read.apply(this,args);if(!closePromise){inspectionFd=this.fd;closePromise=f.inspector.close();}return result;});
  const result=await f.inspector.inspect(media);await closePromise;
  assert.equal(result.code,'closed');assert.equal(fake.calls.length,0);assert.throws(()=>fstatSync(inspectionFd),error=>error.code==='EBADF');
});

test('missing probe is unavailable and never leaks executable or private file paths',async t=>{
  const f=await fixture(t,{ffprobe:join(tmpdir(),'secret-ffprobe-not-installed.exe')}),media=await f.file(fakeMp4),result=await f.inspector.inspect(media);
  assert.equal(result.status,'unavailable');assert.equal(result.code,'probe_unavailable');assert.ok(result.sha256);assert.ok(!JSON.stringify(result).includes('secret-ffprobe'));assert.ok(!JSON.stringify(result).includes(f.directory));
});

test('probe errors, bad JSON, bad geometry and unlimited output have explicit bounded outcomes',async t=>{
  for(const [options,code,status] of [
    [{stderr:'C:\\private\\secret.mov invalid data',code:1},'invalid_media','corrupt'],
    [{raw:'not json'},'invalid_probe_response','unavailable'],
    [{stderr:'fd: Protocol not found',code:1},'probe_unavailable','unavailable'],
    [{data:{streams:[{codec_type:'video',width:0,height:180}],format:{duration:1}}},'invalid_metadata','corrupt'],
    [{data:{streams:[{...probeData.streams[0],tags:{rotate:45}}],format:{duration:1}}},'invalid_metadata','corrupt'],
    [{raw:'x'.repeat(2048)},'probe_output_limit','unavailable'],
  ]){const fake=fakeProbe(options),f=await fixture(t,{spawnProcess:fake.spawn,maxOutputBytes:1024}),media=await f.file(fakeMp4),result=await f.inspector.inspect(media);assert.equal(result.code,code);assert.equal(result.status,status);assert.ok(!JSON.stringify(result).includes('secret.mov'));}
});

test('timeouts, concurrency limits and shutdown release bounded child processes',async t=>{
  const fake=fakeProbe({hang:true}),f=await fixture(t,{spawnProcess:fake.spawn,timeoutMs:30,maxConcurrent:1}),media=await f.file(fakeMp4);
  const pending=f.inspector.inspect(media);assert.equal((await f.inspector.inspect(media)).code,'busy');assert.equal((await pending).code,'probe_timeout');assert.equal(fake.calls[0].child.exitCode,-1);
  const again=f.inspector.inspect(media);await f.inspector.close();assert.equal((await again).code,'closed');assert.equal((await f.inspector.inspect(media)).code,'closed');
});

test('shutdown kills an active probe and closes its inherited verified file handle',async t=>{
  let began;const started=new Promise(resolve=>began=resolve),fake=fakeProbe({hang:true,onSpawn:began}),f=await fixture(t,{spawnProcess:fake.spawn}),media=await f.file(fakeMp4);
  const pending=f.inspector.inspect(media),call=await started;assert.ok(fstatSync(call.options.stdio[0]).isFile());await f.inspector.close();assert.equal((await pending).code,'closed');assert.equal(call.child.exitCode,-1);assert.throws(()=>fstatSync(call.options.stdio[0]),error=>error.code==='EBADF');
});

test('file changes while a probe reads the descriptor cannot pair stale hashes with new metadata',async t=>{
  let began;const started=new Promise(resolve=>began=resolve),fake=fakeProbe({hang:true,onSpawn:began}),f=await fixture(t,{spawnProcess:fake.spawn}),media=await f.file(fakeMp4);
  const pending=f.inspector.inspect(media),call=await started,changed=Buffer.from(fakeMp4);changed[changed.length-1]=9;await writeFile(media.path,changed);call.child.stdout.end(JSON.stringify(probeData));call.child.exitCode=0;call.child.emit('close',0,null);
  const result=await pending;assert.equal(result.status,'corrupt');assert.equal(result.code,'file_changed');assert.equal(result.sha256,undefined);
});

test('post-probe SHA256 detects changed bytes even when filesystem timestamps are identical',async t=>{
  let began;const started=new Promise(resolve=>began=resolve),fake=fakeProbe({hang:true,onSpawn:began}),f=await fixture(t,{spawnProcess:fake.spawn}),media=await f.file(fakeMp4);
  await fixedTimestampCollision(t,media.path);
  const pending=f.inspector.inspect(media),call=await started,changed=Buffer.from(fakeMp4);changed[changed.length-1]=9;await writeFile(media.path,changed);
  call.child.stdout.end(JSON.stringify(probeData));call.child.exitCode=0;call.child.emit('close',0,null);
  const result=await pending;assert.equal(result.code,'file_changed');assert.equal(result.sha256,undefined);
});

test('recent ctime forces cached SHA256 validation even with old mtime and identical timestamps',async t=>{
  const fake=fakeProbe(),f=await fixture(t,{spawnProcess:fake.spawn}),media=await f.file(fakeMp4),old=new Date(Date.now()-60000);await utimes(media.path,old,old);
  await fixedTimestampCollision(t,media.path);
  const first=await f.inspector.inspect(media),changed=Buffer.from(fakeMp4);changed[changed.length-1]=9;await writeFile(media.path,changed);
  const second=await f.inspector.inspect(media);assert.equal(second.status,'inspected');assert.notEqual(second.sha256,first.sha256);assert.equal(second.sha256,digest(changed));assert.equal(fake.calls.length,2);
});

test('recent cache verification rejects path replacement even when the opened bytes still match',async t=>{
  const fake=fakeProbe(),f=await fixture(t,{spawnProcess:fake.spawn}),media=await f.file(fakeMp4);
  await fixedTimestampCollision(t,media.path);assert.equal((await f.inspector.inspect(media)).status,'inspected');
  const reference=await open(media.path,'r'),prototype=Object.getPrototypeOf(reference),read=prototype.read;await reference.close();let replaced=false;
  t.mock.method(prototype,'read',async function(...args){const result=await read.apply(this,args);if(!replaced){replaced=true;await rename(media.path,media.path+'.old');await writeFile(media.path,fakeMp4);}return result;});
  const result=await f.inspector.inspect(media);assert.equal(result.code,'file_changed');assert.equal(fake.calls.length,1);
});

test('actual MP4 metadata and content hash are read without modifying uploaded bytes',realMedia,async t=>{
  const f=await fixture(t),media=await f.generated('mp4',['-f','lavfi','-i','color=c=blue:s=320x180:r=6','-f','lavfi','-i','sine=frequency=440:sample_rate=44100','-t','1','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-threads','1','-c:a','aac','-movflags','+faststart']);
  const before=await readFile(media.path),result=await f.inspector.inspect(media);assert.equal(result.status,'inspected',JSON.stringify(result));assert.equal(result.metadata.kind,'video');assert.equal(result.metadata.width,320);assert.equal(result.metadata.height,180);assert.equal(result.metadata.displayAspectRatio,16/9);assert.ok(Math.abs(result.metadata.duration-1)<0.1);assert.equal(result.metadata.videoCodec,'h264');assert.deepEqual(result.metadata.audioCodecs,['aac']);assert.equal(result.sha256,digest(before));assert.deepEqual(await readFile(media.path),before);
});

test('actual rotated anamorphic MP4 uses displayed orientation and pixel aspect ratio',realMedia,async t=>{
  const f=await fixture(t),source=await f.generated('mp4',['-f','lavfi','-i','color=c=blue:s=360x240:r=6','-t','1','-vf','setsar=2','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-threads','1','-movflags','+faststart']);
  const rotated=await f.generated('mp4',['-display_rotation:v:0','90','-i',source.path,'-c','copy','-movflags','+faststart']),result=await f.inspector.inspect(rotated);
  assert.equal(result.status,'inspected',JSON.stringify(result));assert.equal(result.metadata.width,240);assert.equal(result.metadata.height,360);assert.equal(result.metadata.sampleAspectRatio,'2:1');assert.ok(Math.abs(result.metadata.displayAspectRatio-1/3)<1e-9);
});

test('ordinary non-faststart MP4 is seekable without allowing file or network protocols',realMedia,async t=>{
  const f=await fixture(t),media=await f.generated('mp4',['-f','lavfi','-i','color=c=blue:s=640x360:r=12','-f','lavfi','-i','sine=frequency=440:sample_rate=44100','-t','3','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-threads','1','-c:a','aac']);
  const bytes=await readFile(media.path);assert.ok(bytes.indexOf(Buffer.from('moov'))>bytes.indexOf(Buffer.from('mdat')));
  const result=await f.inspector.inspect(media);assert.equal(result.status,'inspected',JSON.stringify(result));assert.equal(result.metadata.width,640);assert.equal(result.metadata.height,360);assert.equal(result.metadata.duration,3);assert.equal(result.sha256,digest(bytes));
});

test('actual WebM, PNG and JPEG return supported metadata',realMedia,async t=>{
  const f=await fixture(t);
  for(const [extension,args,width,height,kind] of [
    ['webm',['-f','lavfi','-i','color=c=blue:s=180x320:r=6','-t','1','-c:v','libvpx-vp9','-threads','1'],180,320,'video'],
    ['png',['-f','lavfi','-i','color=c=blue:s=180x320','-frames:v','1','-threads','1'],180,320,'image'],
    ['jpg',['-f','lavfi','-i','color=c=blue:s=320x180','-frames:v','1','-threads','1'],320,180,'image'],
  ]){const media=await f.generated(extension,args),result=await f.inspector.inspect(media);assert.equal(result.status,'inspected',JSON.stringify(result));assert.equal(result.metadata.kind,kind);assert.equal(result.metadata.width,width);assert.equal(result.metadata.height,height);assert.equal(result.metadata.displayAspectRatio,width/height);}
});

test('actual truncated MP4 never reports inspected',realMedia,async t=>{
  const f=await fixture(t),media=await f.file(fakeMp4),result=await f.inspector.inspect(media);assert.equal(result.status,'corrupt');assert.equal(result.code,'invalid_media');
});
