import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID,createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {Store} from './store.mjs';
import {createStudioService} from './studio-service.mjs';
import {createPublicationPackageService,publicationZip} from './publication-package.mjs';

const run=promisify(execFile),ffmpeg=process.env.SYNK_FFMPEG_EXE||'ffmpeg',ffprobe=process.env.SYNK_FFPROBE_EXE||'ffprobe';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
let available=false;try{await run(ffmpeg,['-version'],{windowsHide:true,timeout:5000});await run(ffprobe,['-version'],{windowsHide:true,timeout:5000});available=true;}catch{}
const needsFfmpeg={skip:available?false:'FFmpeg/FFprobe가 없는 환경: 실제 변환 시험만 생략'};
function unzip(bytes){const files=new Map();let offset=0;while(bytes.readUInt32LE(offset)===0x04034b50){const size=bytes.readUInt32LE(offset+18),length=bytes.readUInt16LE(offset+26),extra=bytes.readUInt16LE(offset+28),start=offset+30+length+extra,name=bytes.subarray(offset+30,offset+30+length).toString('utf8');files.set(name,bytes.subarray(start,start+size));offset=start+size;}assert.equal(bytes.readUInt32LE(offset),0x02014b50);return files;}
async function fixture(t,{width=320,height=180,sar=1,real=true,options={}}={}){
  const directory=await mkdtemp(join(tmpdir(),'synk-publication-package-'));await mkdir(join(directory,'studio-media'));
  const store=new Store(directory),studio=createStudioService({store}),owner=store.createUser({name:'제작자',email:'owner@example.test'}),outsider=store.createUser({name:'다른 팀',email:'other@example.test'}),viewer=store.createUser({name:'열람',email:'viewer@example.test',role:'viewer'});
  const production=studio.saveProduction(owner,{title:'합성 영상 제작',stage:'ready'}).production,id=randomUUID(),diskName=id+'.mp4',path=join(directory,'studio-media',diskName);
  if(real)await run(ffmpeg,['-hide_banner','-loglevel','error','-f','lavfi','-i',`color=c=blue:s=${width}x${height}:r=6`,'-f','lavfi','-i','sine=frequency=440:sample_rate=44100','-t','1','-vf',`setsar=${sar}`,'-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-threads','1','-c:a','aac','-movflags','+faststart',path],{windowsHide:true,timeout:20000});
  else await writeFile(path,Buffer.concat([Buffer.from([0,0,0,16]),Buffer.from('ftypisom0000'),Buffer.alloc(30)]));
  const original=await readFile(path),media={id,diskName,mimeType:'video/mp4',fileName:'합성 완성본.mp4',byteSize:original.length};studio.addMedia(owner,production.id,media,'검토한 완성본');
  const version=studio.production(owner,production.id).production.versions[0],service=createPublicationPackageService({store,studio,directory,ffmpeg,ffprobe,...options});
  const input={productionId:production.id,versionId:version.id,title:'실제 결과 보기',body:'영상을 확인하고 한 번 따라 해 보세요.',link:'https://example.test/resource',channels:['youtube-shorts','instagram-reels','youtube-video'],language:'ko',subtitleText:'1\n00:00:00,000 --> 00:00:00,900\n안녕하세요.\n',subtitleFileName:'subtitles-ko.srt'};
  t.after(async()=>{await service.stop();store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-publication-package-'));await rm(directory,{recursive:true,force:true});});
  return {directory,store,studio,owner,outsider,viewer,production,version,media,path,original,service,input};
}

test('ZIP contains UTF-8 text and immutable media bytes, rejects path traversal',()=>{
  const archive=publicationZip([{name:'01-youtube/게시문안.txt',bytes:'한글 문안'},{name:'01-youtube/video.mp4',bytes:Buffer.from([1,2,3])}]),files=unzip(archive);
  assert.equal(files.get('01-youtube/게시문안.txt').toString(),'한글 문안');assert.deepEqual(files.get('01-youtube/video.mp4'),Buffer.from([1,2,3]));
  for(const name of ['../private','/root/file','a\\b','a/../b'])assert.throws(()=>publicationZip([{name,bytes:'x'}]),/이름/);
});

test('package validates source access, channel set, copy, links, subtitle errors before rendering',async t=>{
  const f=await fixture(t,{real:false});
  await assert.rejects(f.service.create(f.outsider,f.input),error=>error.status===404);
  await assert.rejects(f.service.create(f.viewer,f.input),error=>error.status===403);
  await assert.rejects(f.service.create(f.owner,{...f.input,title:''}),/제목/);
  await assert.rejects(f.service.create(f.owner,{...f.input,channels:['youtube-shorts','youtube-shorts']}),/채널/);
  await assert.rejects(f.service.create(f.owner,{...f.input,link:'https://user:password@example.test/'}),/HTTPS/);
  await assert.rejects(f.service.create(f.owner,{...f.input,body:'x'.repeat(2201)}),/2,200/);
  await assert.rejects(f.service.create(f.owner,{...f.input,subtitleText:'1\n00:00:01,000 --> 00:00:00,000\n역순'}),/자막/);
  const revoked=Object.assign(new Error('세션 종료'),{status:401});await assert.rejects(f.service.create(f.owner,f.input,{authorize(){throw revoked;}}),error=>error===revoked);
  assert.equal(f.store.all('studioPublicationPackages').length,0);assert.deepEqual(await readdir(join(f.directory,'studio-media')),[f.media.diskName]);
});

test('missing FFprobe is explicit and never produces an unchecked bundle',async t=>{
  const f=await fixture(t,{real:false,options:{ffmpeg:'synk-no-such-ffmpeg',ffprobe:'synk-no-such-ffprobe'}}),catalog=await f.service.catalog(f.owner);
  assert.equal(catalog.capabilities.conversion,false);assert.equal(catalog.capabilities.ffprobe,false);
  await assert.rejects(f.service.create(f.owner,f.input),/FFprobe/);assert.equal(f.store.all('studioPublicationPackages').length,0);
});

test('actual channel conversion preserves source, reuses vertical render, produces independently readable ZIP files',needsFfmpeg,async t=>{
  const f=await fixture(t),before=digest(f.original),result=await f.service.create(f.owner,f.input),pkg=result.package;
  assert.equal(pkg.outputs.length,3);assert.equal(pkg.outputs[0].sha256,pkg.outputs[1].sha256);assert.notEqual(pkg.outputs[0].sha256,pkg.outputs[2].sha256);
  assert.equal(f.studio.readableMedia(f.owner,pkg.outputs[0].mediaId).productionId,f.production.id);assert.equal(pkg.outputs[0].previewUrl,'/api/studio-media/'+pkg.outputs[0].mediaId);
  assert.throws(()=>f.studio.readableMedia(f.outsider,pkg.outputs[0].mediaId),error=>error.status===404);
  assert.ok(pkg.outputs.every(row=>row.converted));assert.deepEqual(pkg.outputs.map(row=>[row.width,row.height]),[[1080,1920],[1080,1920],[1920,1080]]);
  assert.ok(!JSON.stringify(pkg).includes(f.directory));assert.ok(!Object.hasOwn(pkg.outputs[0],'diskName'));assert.equal(pkg.published,false);assert.equal(pkg.subtitle.errors,0);
  assert.equal(digest(await readFile(f.path)),before);assert.equal(f.studio.production(f.owner,f.production.id).production.versions.length,1);
  const filesBefore=await readdir(join(f.directory,'studio-media')),repeat=await f.service.create(f.owner,f.input);assert.equal(repeat.reused,true);assert.equal(repeat.package.id,pkg.id);assert.deepEqual(await readdir(join(f.directory,'studio-media')),filesBefore);assert.equal(f.store.all('studioPublicationPackages').length,1);
  const archive=await f.service.download(f.owner,pkg.id),files=unzip(archive.buffer);
  assert.equal(files.get('01-youtube-shorts/게시문안.txt').toString(),f.input.body);assert.equal(files.get('01-youtube-shorts/subtitles-ko.srt').toString(),f.input.subtitleText.trim());
  for(const [index,output]of pkg.outputs.entries()){const file=String(index+1).padStart(2,'0')+'-'+output.channel+'/video.mp4';assert.equal(digest(files.get(file)),output.sha256);}
  assert.equal((f.service.list(f.owner)).packages.length,1);assert.equal((f.service.list(f.outsider)).packages.length,0);
  assert.throws(()=>f.service.get(f.outsider,pkg.id),error=>error.status===404);
  await assert.rejects(f.service.download(f.outsider,pkg.id),error=>error.status===404);
  const row=f.store.get('studioPublicationPackages',pkg.id),changed=await readFile(join(f.directory,'studio-media',row.outputs[0].diskName));changed[changed.length-1]^=1;await writeFile(join(f.directory,'studio-media',row.outputs[0].diskName),changed);
  await assert.rejects(f.service.download(f.owner,pkg.id),/변경/);
});

test('original mode copies matching MP4 without FFmpeg, rejects incompatible target and overlong subtitles',needsFfmpeg,async t=>{
  const f=await fixture(t,{width:1080,height:1920,options:{ffmpeg:'synk-no-such-ffmpeg'}}),input={...f.input,channels:['youtube-shorts'],mode:'original'};
  const pkg=(await f.service.create(f.owner,input)).package;assert.equal(pkg.outputs[0].converted,false);assert.equal(pkg.outputs[0].sha256,digest(f.original));
  await assert.rejects(f.service.create(f.owner,{...input,channels:['youtube-video']}),/規格|규격/);
  await assert.rejects(f.service.create(f.owner,{...input,subtitleText:'1\n00:00:00,000 --> 00:00:04,000\n길어요.'}),/영상 길이/);
  const inactive={...f.store.get('users',f.owner.id),active:false};f.store.put('users',inactive.id,inactive);assert.throws(()=>f.service.get(f.owner,pkg.id),error=>error.status===401);
});

test('non-square source pixels retain their displayed aspect ratio without stretching',needsFfmpeg,async t=>{
  const f=await fixture(t,{width:360,height:240,sar:2}),pkg=(await f.service.create(f.owner,{...f.input,channels:['youtube-video']})).package;
  const stored=f.store.get('studioPublicationPackages',pkg.id).outputs[0],path=join(f.directory,'studio-media',stored.diskName);
  async function pixel(y){const result=await run(ffmpeg,['-v','error','-i',path,'-vf',`crop=2:2:960:${y},format=rgb24`,'-frames:v','1','-f','rawvideo','pipe:1'],{encoding:'buffer',windowsHide:true,timeout:20000});return result.stdout.subarray(0,3);}
  assert.ok((await pixel(100)).every(value=>value<20),'3:1 display image has top letterbox padding');assert.ok((await pixel(500))[2]>200,'center content remains blue');
});

test('revoked session after rendering rolls back generated output and rejects concurrent work',needsFfmpeg,async t=>{
  const f=await fixture(t);let authorizations=0;
  const pending=f.service.create(f.owner,{...f.input,channels:['youtube-shorts']},{authorize(){authorizations++;if(authorizations>=4)throw Object.assign(new Error('폐기한 세션'),{status:401});}});
  await assert.rejects(f.service.create(f.owner,f.input),error=>error.status===429);
  await assert.rejects(pending,/폐기한 세션/);await f.service.waitForIdle();assert.equal(f.store.all('studioPublicationPackages').length,0);assert.deepEqual(await readdir(join(f.directory,'studio-media')),[f.media.diskName]);
});

test('unsafe stored disk names are rejected without reading outside uploaded media',async t=>{
  const f=await fixture(t,{real:false});f.store.put('studioMedia',f.media.id,{...f.media,productionId:f.production.id,diskName:'../../private.mp4'});
  await assert.rejects(f.service.create(f.owner,f.input),/저장 이름/);assert.equal(f.store.all('studioPublicationPackages').length,0);
});
