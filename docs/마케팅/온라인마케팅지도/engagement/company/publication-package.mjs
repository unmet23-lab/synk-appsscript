import {randomUUID,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {readFile,lstat,realpath,unlink} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {execFile} from 'node:child_process';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {validMediaSignature,STUDIO_MEDIA_LIMIT} from './studio-media.mjs';

const require=createRequire(import.meta.url),rules=require('./public/publish-rules.js');
// Reuse the browser tool's existing pure parser. The fixed, local source never
// receives a DOM or arbitrary code; user text is passed as data to its function.
const subtitleContext=vm.createContext({Intl,TextEncoder});
vm.runInContext(readFileSync(new URL('./public/subtitle-lab.js',import.meta.url),'utf8'),subtitleContext);
const inspectSubtitles=vm.runInContext('subtitleInspect',subtitleContext);
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CHANNELS=Object.freeze([
  {id:'youtube-shorts',label:'YouTube Shorts',width:1080,height:1920,preset:'youtube-shorts',kind:'video'},
  {id:'instagram-reels',label:'Instagram Reels',width:1080,height:1920,preset:'vertical',kind:'video'},
  {id:'youtube-video',label:'YouTube 영상',width:1920,height:1080,preset:null,kind:'video'},
]);
const LIMITS=Object.freeze({sourceBytes:STUDIO_MEDIA_LIMIT,outputBytes:STUDIO_MEDIA_LIMIT,archiveBytes:300*1024*1024,channels:3,subtitleBytes:256*1024,packagesPerProduction:30});
function text(value,max,label,required=false){if(value==null&&!required)return '';if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))throw fail(`${label}을 ${max}자 이내로 입력해 주세요.`);const result=value.trim();if(required&&!result)throw fail(`${label}을 입력해 주세요.`);return result;}
function object(value){if(!value||typeof value!=='object'||Array.isArray(value))throw fail('게시 묶음 입력을 확인해 주세요.');return value;}
function link(value){if(value==null||value==='')return '';let url;try{url=new URL(text(value,2048,'자료 주소',true));}catch{throw fail('자료 주소는 HTTPS로 입력해 주세요.');}if(url.protocol!=='https:'||url.username||url.password)throw fail('자료 주소는 자격증명 없는 HTTPS 주소여야 합니다.');return url.href;}
const clone=value=>JSON.parse(JSON.stringify(value));

// Dependency-free STORE ZIP: UTF-8 filenames, CRC32, no executable files or links.
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let bit=0;bit<8;bit++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
export function publicationZip(entries){
  const chunks=[],central=[];let offset=0,size=0;
  for(const entry of entries){
    const name=Buffer.from(entry.name,'utf8'),bytes=Buffer.isBuffer(entry.bytes)?entry.bytes:Buffer.from(entry.bytes,'utf8');
    if(name.length>1024||entry.name.startsWith('/')||entry.name.split('/').some(part=>!part||part==='.'||part==='..')||/[\\\u0000]/.test(entry.name))throw fail('내보낼 파일 이름을 확인해 주세요.');
    size+=bytes.length;if(size>LIMITS.archiveBytes)throw fail('게시 묶음은 300MiB 이하로 나눠 만들어 주세요.',413);
    const crc=crc32(bytes),local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(0x800,6);local.writeUInt32LE(crc,14);local.writeUInt32LE(bytes.length,18);local.writeUInt32LE(bytes.length,22);local.writeUInt16LE(name.length,26);
    const row=Buffer.alloc(46);row.writeUInt32LE(0x02014b50);row.writeUInt16LE(20,4);row.writeUInt16LE(20,6);row.writeUInt16LE(0x800,8);row.writeUInt32LE(crc,16);row.writeUInt32LE(bytes.length,20);row.writeUInt32LE(bytes.length,24);row.writeUInt16LE(name.length,28);row.writeUInt32LE(offset,42);
    chunks.push(local,name,bytes);central.push(row,name);offset+=local.length+name.length+bytes.length;
  }
  const directoryBytes=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directoryBytes.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...chunks,directoryBytes,end]);
}

export function createPublicationPackageService({store,studio,directory=store.directory,clock=()=>new Date().toISOString(),ffmpeg=process.env.SYNK_FFMPEG_EXE||'ffmpeg',ffprobe=process.env.SYNK_FFPROBE_EXE||'ffprobe',timeoutMs=180000}={}){
  const root=resolve(directory,'studio-media'),children=new Set();let active=null,closing=false,capabilityPromise=null;
  function current(user){const live=user?.id&&store.get('users',user.id);if(!live?.active)throw fail('먼저 로그인해 주세요.',401);return live;}
  function run(executable,args,timeout=timeoutMs){
    if(closing)return Promise.reject(fail('서버를 종료하는 중입니다.',503));
    return new Promise((resolvePromise,reject)=>{const child=execFile(executable,args,{windowsHide:true,timeout,maxBuffer:1024*1024,encoding:'utf8'},(error,stdout)=>{children.delete(child);if(error)reject(error);else resolvePromise(stdout);});children.add(child);});
  }
  async function capabilities(){
    if(!capabilityPromise)capabilityPromise=Promise.all([run(ffmpeg,['-version'],5000).then(()=>true,()=>false),run(ffprobe,['-version'],5000).then(()=>true,()=>false)]).then(([hasFfmpeg,hasFfprobe])=>({ffmpeg:hasFfmpeg,ffprobe:hasFfprobe,conversion:hasFfmpeg&&hasFfprobe}));
    return capabilityPromise;
  }
  async function catalog(user){current(user);return {channels:clone(CHANNELS),capabilities:await capabilities(),limits:{...LIMITS}};}
  function location(name){if(typeof name!=='string'||!/^[-0-9a-f]{36}\.(mp4|webm)$/.test(name)||!UUID.test(name.slice(0,36)))throw fail('미디어 저장 이름을 확인해 주세요.',409);const file=resolve(root,name);if(dirname(file)!==root)throw fail('미디어 경로를 확인해 주세요.',409);return file;}
  async function mediaBytes(media,expectedHash){
    const file=location(media.diskName);let info;
    try{info=await lstat(file);if(!info.isFile()||info.isSymbolicLink()||info.size<=0||info.size>LIMITS.sourceBytes||info.size!==media.byteSize||dirname(await realpath(file))!==await realpath(root))throw fail('미디어 파일의 크기나 경로가 변경됐습니다.',409);}
    catch(error){if(error.status)throw error;throw fail('저장된 미디어 파일을 찾을 수 없습니다.',404);}
    const bytes=await readFile(file);
    if(bytes.length!==info.size||!validMediaSignature(media.mimeType,bytes.subarray(0,4096)))throw fail('파일 내용이 원래 영상 형식과 다릅니다.',409);
    const digest=hash(bytes);if(expectedHash&&digest!==expectedHash)throw fail('묶음을 만든 뒤 미디어가 변경됐습니다. 새 묶음을 만들어 주세요.',409);
    return {bytes,sha256:digest,file};
  }
  async function probe(file,mimeType){
    let raw;try{raw=await run(ffprobe,['-v','error','-protocol_whitelist','file,pipe','-f',mimeType==='video/webm'?'matroska':'mov','-show_entries','stream=codec_type,codec_name,width,height,sample_aspect_ratio:stream_tags=rotate:stream_side_data=rotation:format=duration','-of','json',file],20000);}catch{throw fail('영상 정보를 읽지 못했습니다. FFprobe 설치와 실제 재생 가능한 파일인지 확인해 주세요.',422);}
    let data;try{data=JSON.parse(raw);}catch{throw fail('영상 정보 응답을 확인하지 못했습니다.',422);}
    const video=data.streams?.find(row=>row.codec_type==='video'),audio=data.streams?.filter(row=>row.codec_type==='audio')||[],duration=Number(data.format?.duration);
    if(!video||!Number.isInteger(video.width)||!Number.isInteger(video.height)||video.width<1||video.height<1||video.width>8192||video.height>8192||!Number.isFinite(duration)||duration<=0||duration>1800)throw fail('영상은 가로·세로 8192px 이하, 30분 이내의 재생 가능한 파일이어야 합니다.',422);
    const rotation=Number(video.side_data_list?.find(row=>row.rotation!==undefined)?.rotation??video.tags?.rotate??0),portraitRotation=Math.abs(rotation)%180===90;
    return {kind:'video',width:portraitRotation?video.height:video.width,height:portraitRotation?video.width:video.height,duration,videoCodec:video.codec_name,audioCodecs:audio.map(row=>row.codec_name),rotation,sampleAspectRatio:video.sample_aspect_ratio||'1:1'};
  }
  function sourceFor(user,input,editable=true){
    user=current(user);const productionId=text(input.productionId,100,'제작 건',true),versionId=text(input.versionId,100,'완성본',true);
    const production=editable?studio.assertEditable(user,productionId):studio.production(user,productionId).production;
    const version=production.versions.find(row=>row.id===versionId);
    if(!version?.mediaId||version.kind!=='video')throw fail('제작 스튜디오에 업로드한 영상 완성본을 선택해 주세요.',422);
    const media=studio.readableMedia(user,version.mediaId);if(media.productionId!==productionId||!['video/mp4','video/webm'].includes(media.mimeType))throw fail('선택한 완성본의 영상 정보를 확인해 주세요.',409);
    return {user,production,version,media};
  }
  function visible(row){
    const {source,outputs,requestHash,...rest}=row;
    return {...rest,source:{id:source.id,fileName:source.fileName,byteSize:source.byteSize,sha256:source.sha256},outputs:outputs.map(({diskName,mimeType,...output})=>output),downloadUrl:'/api/publication-packages/'+row.id+'/download'};
  }
  function get(user,id){user=current(user);const row=store.get('studioPublicationPackages',text(id,100,'묶음',true));if(!row)throw fail('게시 묶음을 찾을 수 없습니다.',404);sourceFor(user,row,false);return {package:visible(row)};}
  function list(user,{productionId}={}){user=current(user);const packages=[];for(const row of store.all('studioPublicationPackages')){if(productionId&&row.productionId!==productionId)continue;try{sourceFor(user,row,false);packages.push(visible(row));}catch(error){if(![403,404].includes(error.status))throw error;}}return {packages:packages.sort((a,b)=>b.createdAt.localeCompare(a.createdAt))};}
  async function exclusive(work){if(closing)throw fail('서버를 종료하는 중입니다.',503);if(active)throw fail('다른 게시 묶음을 처리하고 있습니다. 끝난 뒤 다시 시도해 주세요.',429);let release;active=new Promise(resolvePromise=>{release=resolvePromise;});try{return await work();}finally{active=null;release();}}
  async function create(user,input,{authorize=()=>{}}={}){return exclusive(async()=>{
    object(input);authorize();const selected=sourceFor(user,input),title=text(input.title,100,'제목',true),body=text(input.body,20000,'게시 원고',true),url=link(input.link),language=text(input.language||'ko',20,'자막 언어',true),mode=input.mode||'adapt';
    if(!/^[a-z]{2,3}(?:-[a-z]{2,8})?$/.test(language))throw fail('자막 언어 코드를 확인해 주세요.');
    if(!['adapt','original'].includes(mode))throw fail('출력 방식을 확인해 주세요.');
    if(!Array.isArray(input.channels)||!input.channels.length||input.channels.length>LIMITS.channels||new Set(input.channels).size!==input.channels.length||input.channels.some(id=>!CHANNELS.some(row=>row.id===id)))throw fail('지원하는 채널을 중복 없이 선택해 주세요.');
    const channels=input.channels.map(id=>CHANNELS.find(row=>row.id===id));
    if(channels.some(row=>row.id==='instagram-reels')&&body.length>2200)throw fail('Instagram 원고는 2,200자 이내로 입력해 주세요.');
    if(channels.some(row=>row.id.startsWith('youtube'))&&body.length>5000)throw fail('YouTube 원고는 5,000자 이내로 입력해 주세요.');
    const subtitleText=text(input.subtitleText,LIMITS.subtitleBytes,'자막'),subtitleFileName=text(input.subtitleFileName||`subtitles-${language}.srt`,100,'자막 파일 이름'),hasSubtitle=!!subtitleText;
    if(hasSubtitle&&(!/\.(srt|vtt)$/i.test(subtitleFileName)||Buffer.byteLength(subtitleText)>LIMITS.subtitleBytes))throw fail('SRT·VTT 자막을 256KiB 이내로 입력해 주세요.');
    const subtitleReport=hasSubtitle?inspectSubtitles(subtitleText,{fileName:subtitleFileName}):null;
    if(subtitleReport?.errors)throw fail('자막 시간이나 형식 오류를 자막 검사에서 먼저 수정해 주세요.',422);
    const source=await mediaBytes(selected.media),requestHash=hash(JSON.stringify({productionId:input.productionId,versionId:input.versionId,source:source.sha256,title,body,link:url,language,mode,channels:channels.map(row=>row.id),subtitleText,subtitleFormat:subtitleReport?.format||null}));
    const previous=store.all('studioPublicationPackages').filter(row=>row.productionId===input.productionId),same=previous.find(row=>row.requestHash===requestHash);
    if(same){
      const checked=new Set();for(const output of same.outputs){if(checked.has(output.diskName))continue;await mediaBytes(output,output.sha256);checked.add(output.diskName);}
      authorize();sourceFor(user,input);return {package:visible(same),reused:true};
    }
    if(previous.length>=LIMITS.packagesPerProduction)throw fail('한 제작 건에는 게시 묶음을 30개까지 보관합니다.',409);
    const capability=await capabilities();authorize();sourceFor(user,input);
    if(!capability.ffprobe)throw fail('영상 규격 확인에 FFprobe가 필요합니다. 서버 설치 후 다시 시도해 주세요.',503);
    const info=await probe(source.file,selected.media.mimeType);
    if(channels.some(row=>row.id==='youtube-shorts')&&info.duration>180.05)throw fail('YouTube Shorts 묶음은 3분 이내 영상으로 만들어 주세요.',422);
    if(subtitleReport?.durationMs>info.duration*1000+250)throw fail('자막의 끝 시간이 영상 길이를 넘습니다.',422);
    const made=[],outputs=[],cache=new Map(),id=randomUUID();let committed=false;
    try{
      for(const channel of channels){
        authorize();sourceFor(user,input);
        const key=channel.width+'x'+channel.height;let output=cache.get(key);
        if(!output){
          const matches=info.width===channel.width&&info.height===channel.height&&info.rotation%360===0&&['1:1','N/A'].includes(info.sampleAspectRatio)&&selected.media.mimeType==='video/mp4'&&info.videoCodec==='h264'&&info.audioCodecs.every(codec=>codec==='aac');
          if(!matches&&(mode==='original'||!capability.conversion))throw fail(mode==='original'?'선택한 채널 규격과 원본이 다릅니다. 채널별 규격 출력을 선택해 주세요.':'이 원본은 규격 변환이 필요합니다. 서버에 FFmpeg를 설치해 주세요.',422);
          if(matches)output={mediaId:selected.media.id,diskName:selected.media.diskName,mimeType:selected.media.mimeType,byteSize:selected.media.byteSize,sha256:source.sha256,converted:false,...info};
          else{
            const diskName=randomUUID()+'.mp4',file=location(diskName);made.push(file);
            // Fit the display ratio, including non-square source pixels, before
            // normalizing pixels. Both expressions are bounded by the preset.
            const filter=`scale=w='max(2,trunc(min(${channel.width},${channel.height}*dar)/2)*2)':h='max(2,trunc(min(${channel.height},${channel.width}/dar)/2)*2)',setsar=1,pad=${channel.width}:${channel.height}:(ow-iw)/2:(oh-ih)/2:color=black`;
            try{await run(ffmpeg,['-hide_banner','-loglevel','error','-nostdin','-n','-protocol_whitelist','file,pipe','-f',selected.media.mimeType==='video/webm'?'matroska':'mov','-i',source.file,'-map','0:v:0','-map','0:a:0?','-vf',filter,'-filter_threads','2','-c:v','libx264','-preset','veryfast','-crf','23','-pix_fmt','yuv420p','-threads','2','-c:a','aac','-b:a','160k','-movflags','+faststart','-map_metadata','-1','-fs',String(LIMITS.outputBytes),file]);}catch{throw fail(closing?'서버 종료로 출력이 중단됐습니다.':'영상 출력을 완료하지 못했습니다. 시간·용량 제한과 FFmpeg 설치를 확인해 주세요.',422);}
            const stat=await lstat(file),rendered=await mediaBytes({diskName,mimeType:'video/mp4',byteSize:stat.size}),meta=await probe(file,'video/mp4');
            if(meta.width!==channel.width||meta.height!==channel.height||meta.videoCodec!=='h264'||meta.audioCodecs.some(codec=>codec!=='aac')||Math.abs(meta.duration-info.duration)>.5)throw fail('출력 규격이나 영상 길이가 원본과 맞지 않습니다. 더 짧은 영상으로 나눠 주세요.',422);
            output={mediaId:diskName.slice(0,36),diskName,mimeType:'video/mp4',byteSize:stat.size,sha256:rendered.sha256,converted:true,...meta};
          }
          cache.set(key,output);
        }
        const checks=channel.preset?rules.analyze({...output,bytes:output.byteSize,name:'video.mp4'},channel.preset):[{label:'화면 비율·해상도',status:'match',detail:`${output.width} × ${output.height}`}];
        outputs.push({...output,channel:channel.id,label:channel.label,fileName:'video.mp4',previewUrl:'/api/studio-media/'+output.mediaId,checks:clone(checks)});
      }
      if(outputs.reduce((sum,row)=>sum+row.byteSize,0)+Buffer.byteLength(body)*channels.length+Buffer.byteLength(subtitleText)*channels.length>LIMITS.archiveBytes-1024*1024)throw fail('묶음이 300MiB를 넘습니다. 채널을 나누어 만들어 주세요.',413);
      await mediaBytes(selected.media,source.sha256);authorize();sourceFor(user,input);if(closing)throw fail('서버 종료로 출력을 저장하지 않았습니다.',503);
      const checks=[{label:'원본 보존',status:'match',detail:'원본 SHA256을 전후 대조했습니다.'},{label:'자료 링크',status:url?'review':'unknown',detail:url?'HTTPS 주소 형식만 확인했습니다. 실제 공개·다운로드를 확인해 주세요.':'자료 링크를 넣지 않았습니다.'},{label:'자막',status:hasSubtitle?(subtitleReport.warnings?'review':'match'):'unknown',detail:hasSubtitle?`${subtitleReport.cues.length}개 자막 · 형식 오류 0 · 주의 ${subtitleReport.warnings}`:'별도 자막 파일 없음 · 영상 내 자막과 소리를 직접 확인해 주세요.'},{label:'최종 시청·청취·사용권',status:'unknown',detail:'전체 재생과 사실·사용권 검토는 직접 확인해 주세요.'}];
      const row={id,requestHash,productionId:input.productionId,versionId:input.versionId,createdById:selected.user.id,createdAt:clock(),title,body,link:url,language,mode,channels:channels.map(row=>row.id),source:{...selected.media,sha256:source.sha256},outputs,subtitleText,subtitle:subtitleReport?{format:subtitleReport.format,cueCount:subtitleReport.cues.length,errors:0,warnings:subtitleReport.warnings,issues:clone(subtitleReport.issues)}:null,checks,state:'prepared',published:false};
      store.transaction(()=>{
        for(const output of cache.values())if(output.converted)store.put('studioMedia',output.mediaId,{id:output.mediaId,productionId:input.productionId,publicationPackageId:id,diskName:output.diskName,mimeType:output.mimeType,fileName:`게시용-${output.width}x${output.height}.mp4`,byteSize:output.byteSize,createdAt:row.createdAt,createdById:selected.user.id});
        store.put('studioPublicationPackages',id,row);
      });committed=true;return {package:visible(row),reused:false};
    }finally{if(!committed)await Promise.all(made.map(file=>unlink(file).catch(()=>{})));}
  });}
  async function download(user,id,{authorize=()=>{}}={}){return exclusive(async()=>{
    authorize();get(user,id);const row=store.get('studioPublicationPackages',id),entries=[],verified=new Map();
    await mediaBytes(row.source,row.source.sha256);
    for(const [index,output]of row.outputs.entries()){
      authorize();sourceFor(user,row,false);let media=verified.get(output.diskName);if(!media){media=await mediaBytes(output,output.sha256);verified.set(output.diskName,media);}
      const folder=String(index+1).padStart(2,'0')+'-'+output.channel+'/',metadata={schema:'synk-workspace-publication-package',channel:output.channel,title:row.title,caption:row.body,language:row.language,link:row.link,video:'video.mp4',sha256:output.sha256,preparedAt:row.createdAt,published:false};
      entries.push({name:folder+'video.mp4',bytes:media.bytes},{name:folder+'제목.txt',bytes:row.title},{name:folder+'게시문안.txt',bytes:row.body},{name:folder+'원고.json',bytes:JSON.stringify(metadata,null,2)},{name:folder+'검사.json',bytes:JSON.stringify({checks:[...output.checks,...row.checks],subtitle:row.subtitle},null,2)});
      if(row.link)entries.push({name:folder+'링크.txt',bytes:row.link});if(row.subtitle)entries.push({name:folder+`subtitles-${row.language}.${row.subtitle.format}`,bytes:row.subtitleText});
    }
    entries.push({name:'사용안내.txt',bytes:'채널별 video.mp4와 제목·게시문안·자막을 함께 확인하세요.\n원본은 보존하고 필요한 경우 화면을 자르지 않는 검은 여백으로 규격을 맞췄습니다.\n자막은 별도 파일이며 영상에 구워 넣지 않았습니다.\n실제 공개·예약·외부 발송은 수행하지 않았습니다. 게시 계정과 최종 재생·청취·사용권을 직접 확인하세요.\n자료 링크는 형식만 검사했으며 실제 접근 성공을 보증하지 않습니다.\n'});
    const buffer=publicationZip(entries);authorize();sourceFor(user,row,false);return {buffer,fileName:'SYNK-게시묶음-'+row.id.slice(0,8)+'.zip',mimeType:'application/zip'};
  });}
  async function waitForIdle(){if(active)await active;}
  async function stop(){closing=true;for(const child of children)child.kill();await waitForIdle();}
  return {catalog,list,get,create,download,capabilities,waitForIdle,stop};
}
