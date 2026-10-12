import {createHash} from 'node:crypto';
import {readFileSync,constants} from 'node:fs';
import {lstat,realpath,open} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {spawn} from 'node:child_process';
import vm from 'node:vm';
import {STUDIO_MEDIA_LIMIT,validMediaSignature} from './studio-media.mjs';
import {DELIVERY_SUBTITLE_LIMIT} from './client-delivery-media.mjs';

// Only the fixed, local parser is evaluated. Uploaded subtitle text is data.
const subtitleContext=vm.createContext({Intl,TextEncoder});
vm.runInContext(readFileSync(new URL('./public/subtitle-lab.js',import.meta.url),'utf8'),subtitleContext);
const inspectSubtitles=vm.runInContext('subtitleInspect',subtitleContext);
const TYPES=Object.freeze({
  'video/mp4':{extension:'mp4',demuxer:'mov',kind:'video'},
  'video/webm':{extension:'webm',demuxer:'matroska',kind:'video'},
  'image/png':{extension:'png',demuxer:'png_pipe',kind:'image'},
  'image/jpeg':{extension:'jpg',demuxer:'jpeg_pipe',kind:'image'},
  'application/x-subrip':{extension:'srt',kind:'subtitle'},
  'text/vtt':{extension:'vtt',kind:'subtitle'},
});
const DISK_NAME=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp4|webm|png|jpg|srt|vtt)$/;
const outcome=(status,code,message,extra={})=>({status,code,message,...extra});
const stopped=()=>outcome('unavailable','closed','파일 검사 서비스를 종료하는 중입니다.');
const positive=value=>Number.isFinite(value)&&value>0;
const bounded=(value,fallback,min,max)=>Number.isInteger(value)?Math.max(min,Math.min(value,max)):fallback;
const safeCodec=value=>typeof value==='string'&&/^[a-z0-9_]{1,64}$/i.test(value)?value:'unknown';

function metadataFor(data,type){
  const streams=Array.isArray(data?.streams)?data.streams:[],video=streams.find(row=>row?.codec_type==='video'&&!row?.disposition?.attached_pic);
  if(!video||!Number.isInteger(video.width)||!Number.isInteger(video.height)||video.width<1||video.height<1||video.width>32768||video.height>32768)return null;
  const rawRotation=video.side_data_list?.find(row=>row?.rotation!==undefined)?.rotation??video.tags?.rotate??0;
  const rotation=Number(rawRotation);
  if(!Number.isFinite(rotation)||rotation%90!==0)return null;
  let sampleAspectRatio=video.sample_aspect_ratio||'1:1',sar=1;
  if(sampleAspectRatio==='N/A')sampleAspectRatio='1:1';
  const ratio=/^(\d+):(\d+)$/.exec(sampleAspectRatio);
  if(!ratio||!positive(Number(ratio[1]))||!positive(Number(ratio[2])))return null;
  sar=Number(ratio[1])/Number(ratio[2]);
  if(!positive(sar))return null;
  const swapped=Math.abs(rotation)%180===90,originalAspect=video.width*sar/video.height;
  const metadata={kind:type.kind,width:swapped?video.height:video.width,height:swapped?video.width:video.height,displayAspectRatio:swapped?1/originalAspect:originalAspect,rotation,sampleAspectRatio};
  if(!positive(metadata.displayAspectRatio))return null;
  if(type.kind==='video'){
    const duration=Number(data.format?.duration??video.duration);
    if(!positive(duration))return null;
    Object.assign(metadata,{duration,videoCodec:safeCodec(video.codec_name),audioCodecs:streams.filter(row=>row?.codec_type==='audio').map(row=>safeCodec(row.codec_name)).slice(0,32)});
  }
  return metadata;
}

export function createDeliveryFileInspector({directory,ffprobe=process.env.SYNK_FFPROBE_EXE||'ffprobe',timeoutMs=20000,maxConcurrent=2,maxOutputBytes=256*1024,spawnProcess=spawn}={}){
  if(typeof directory!=='string'||!directory)throw new TypeError('파일 저장 폴더가 필요합니다.');
  const root=resolve(directory,'studio-media'),jobs=new Set(),children=new Set(),cache=new Map();
  const timeout=bounded(timeoutMs,20000,20,120000),concurrency=bounded(maxConcurrent,2,1,4),outputLimit=bounded(maxOutputBytes,256*1024,1024,1024*1024);
  let closing=false;

  async function readVerified(handle,identity,{subtitle=false,readBuffer}={}){
    // Keep full subtitle text for its bounded parser; media uses a reusable 1MiB
    // buffer. One extra byte detects growth without trusting a changing size.
    const expectedSize=Number(identity.size),bytes=readBuffer||Buffer.alloc(subtitle?expectedSize+1:Math.min(1024*1024,expectedSize+1));
    const head=subtitle?null:Buffer.alloc(Math.min(4096,expectedSize)),hash=createHash('sha256');let length=0;
    while(length<=expectedSize){
      if(closing)return {error:stopped()};
      const offset=subtitle?length:0,readLength=Math.min(bytes.length-offset,expectedSize+1-length);
      const {bytesRead}=await handle.read(bytes,offset,readLength,length);if(!bytesRead)break;
      const chunk=bytes.subarray(offset,offset+bytesRead);
      if(head&&length<head.length)chunk.copy(head,length,0,Math.min(bytesRead,head.length-length));
      hash.update(chunk);length+=bytesRead;
    }
    const after=await handle.stat({bigint:true});
    if(BigInt(length)!==identity.size||['dev','ino','size','mtimeNs','ctimeNs'].some(key=>after[key]!==identity[key]))return {error:outcome('corrupt','file_changed','검사 중 파일이 변경되었습니다. 다시 확인해 주세요.')};
    return {evidence:{sha256:hash.digest('hex'),byteSize:length},head,...(subtitle?{bytes:bytes.subarray(0,length)}:{readBuffer:bytes})};
  }

  async function bytesFor(media,{force=false}={}){
    const type=TYPES[media?.mimeType];
    if(!type)return {error:outcome('unavailable','unsupported','이 파일 형식은 자동 규격 검사를 지원하지 않습니다.')};
    const limit=type.kind==='subtitle'?DELIVERY_SUBTITLE_LIMIT:STUDIO_MEDIA_LIMIT;
    if(typeof media.diskName!=='string'||!DISK_NAME.test(media.diskName)||!media.diskName.endsWith('.'+type.extension))return {error:outcome('corrupt','invalid_path','저장된 파일 형식과 경로를 확인해 주세요.')};
    if(!Number.isSafeInteger(media.byteSize)||media.byteSize<1||media.byteSize>limit)return {error:outcome('corrupt','invalid_size','저장된 파일 크기를 확인해 주세요.')};
    const path=resolve(root,media.diskName);
    if(dirname(path)!==root)return {error:outcome('corrupt','invalid_path','저장된 파일 경로를 확인해 주세요.')};
    let handle,retained=false;
    try{
      const rootInfo=await lstat(root),info=await lstat(path,{bigint:true});
      if(!rootInfo.isDirectory()||rootInfo.isSymbolicLink()||!info.isFile()||info.isSymbolicLink()||dirname(await realpath(path))!==await realpath(root))return {error:outcome('corrupt','invalid_path','저장된 파일 경로가 변경되었습니다.')};
      if(info.size!==BigInt(media.byteSize)||info.size<1n||info.size>BigInt(limit))return {error:outcome('corrupt','size_changed','저장된 파일 크기가 변경되었습니다. 다시 올려 주세요.')};
      handle=await open(path,constants.O_RDONLY|(process.platform==='win32'?0:constants.O_NOFOLLOW));
      const opened=await handle.stat({bigint:true});
      if(!opened.isFile()||opened.size!==info.size||opened.dev!==info.dev||opened.ino!==info.ino)return {error:outcome('corrupt','file_changed','검사 중 파일이 변경되었습니다. 다시 확인해 주세요.')};
      const cacheKey=[media.mimeType,media.byteSize,opened.dev,opened.ino,opened.size,opened.mtimeNs,opened.ctimeNs].join(':');
      const previous=cache.get(media.diskName);
      const cachedResult=async()=>{
        const current=await lstat(path,{bigint:true}),after=await handle.stat({bigint:true});
        if(!current.isFile()||current.isSymbolicLink()||['dev','ino','size','mtimeNs','ctimeNs'].some(key=>after[key]!==opened[key]||current[key]!==opened[key]))return {error:outcome('corrupt','file_changed','검사 중 파일이 변경되었습니다. 다시 확인해 주세요.')};
        return {cached:structuredClone(previous.result)};
      };
      // A same-tick Windows write can preserve both timestamps. Fresh files must
      // still match their cached SHA256. A one-second timestamp age guard avoids
      // recent same-tick cache collisions without delaying any inspection.
      const stableBefore=BigInt(Date.now()-1000)*1000000n;
      if(!force&&previous?.key===cacheKey&&opened.mtimeNs<stableBefore&&opened.ctimeNs<stableBefore)return await cachedResult();
      cache.delete(media.diskName);
      const source=await readVerified(handle,opened,{subtitle:type.kind==='subtitle'});if(source.error)return source;
      const {evidence}=source;
      if(type.kind!=='subtitle'&&!validMediaSignature(media.mimeType,source.head))return {error:outcome('corrupt','signature_mismatch','파일 내용이 등록된 형식과 다릅니다.',evidence)};
      if(!force&&previous?.key===cacheKey&&previous.result.sha256===evidence.sha256){const result=await cachedResult();if(result.cached)cache.set(media.diskName,previous);return result;}
      retained=type.kind!=='subtitle';return {type,evidence,cacheKey,...(retained?{handle,path,readBuffer:source.readBuffer}:{bytes:source.bytes}),identity:opened};
    }catch(error){
      return {error:['ENOENT','ENOTDIR'].includes(error.code)?outcome('unavailable','missing','저장된 파일을 찾을 수 없습니다.'):outcome('unavailable','file_unavailable','저장된 파일을 읽지 못했습니다. 접근 권한과 파일 상태를 확인해 주세요.')};
    }finally{if(!retained)await handle?.close().catch(()=>{});}
  }

  function probe(handle,type){
    if(closing)return Promise.resolve(stopped());
    return new Promise(resolvePromise=>{
      let child,finished=false,stdoutSize=0,stderrSize=0;const stdout=[],stderr=[];
      const finish=result=>{if(finished)return;finished=true;clearTimeout(timer);if(child){children.delete(child);child.stdin?.destroy();if(child.exitCode===null)child.kill();}resolvePromise(result);};
      const timer=setTimeout(()=>finish(outcome('unavailable','probe_timeout','파일 정보 검사 시간이 초과되었습니다. 다시 확인해 주세요.')),timeout);
      try{
        // Inherit the already verified file handle. Unlike a pipe, this supports
        // seeking to an MP4's trailing moov atom. No path, file/http/tcp protocol
        // or network URL is passed to FFprobe, including references within media.
        const args=['-v','error','-protocol_whitelist','fd','-fd','0','-f',type.demuxer,'-show_entries','stream=codec_type,codec_name,width,height,duration,sample_aspect_ratio:stream_disposition=attached_pic:stream_tags=rotate:stream_side_data=rotation:format=duration','-of','json','fd:'];
        child=spawnProcess(ffprobe,args,{windowsHide:true,stdio:[handle.fd,'pipe','pipe']});children.add(child);
        child.once('error',()=>finish(outcome('unavailable','probe_unavailable','파일 정보 검사 도구를 실행하지 못했습니다. FFprobe 설치 상태를 확인해 주세요.')));
        child.stdout.on('data',chunk=>{stdoutSize+=chunk.length;if(stdoutSize>outputLimit)finish(outcome('unavailable','probe_output_limit','파일 정보 응답이 검사 한도를 넘었습니다.'));else stdout.push(chunk);});
        child.stderr.on('data',chunk=>{stderrSize+=chunk.length;if(stderrSize>outputLimit)finish(outcome('unavailable','probe_output_limit','파일 정보 응답이 검사 한도를 넘었습니다.'));else stderr.push(chunk);});
        child.once('close',(code,signal)=>{
          if(closing)return finish(stopped());
          if(signal)return finish(outcome('unavailable','probe_unavailable','파일 정보 검사가 중단되었습니다. 다시 확인해 주세요.'));
          const diagnostics=Buffer.concat(stderr).toString('utf8').trim();
          if(/Protocol not found|Option fd not found|Unrecognized option ['"]?fd|Error setting option fd/i.test(diagnostics))return finish(outcome('unavailable','probe_unavailable','안전한 파일 핸들 검사를 지원하는 FFprobe가 필요합니다. 검사 도구를 확인해 주세요.'));
          if(code!==0||diagnostics)return finish(outcome('corrupt','invalid_media','파일 정보를 읽지 못했습니다. 실제로 열리는 파일인지 확인해 주세요.'));
          let data;try{data=JSON.parse(Buffer.concat(stdout).toString('utf8'));}catch{return finish(outcome('unavailable','invalid_probe_response','파일 정보 응답을 확인하지 못했습니다.'));}
          const metadata=metadataFor(data,type);
          return finish(metadata?outcome('inspected','inspected','파일 정보를 확인했습니다.',{metadata}):outcome('corrupt','invalid_metadata','영상·이미지의 크기나 재생 시간을 확인하지 못했습니다.'));
        });
      }catch{finish(outcome('unavailable','probe_unavailable','파일 정보 검사 도구를 실행하지 못했습니다. FFprobe 설치 상태를 확인해 주세요.'));}
    });
  }

  async function inspectFile(media,options){
    const source=await bytesFor(media,options);if(closing){await source.handle?.close().catch(()=>{});return stopped();}if(source.error)return source.error;if(source.cached)return source.cached;
    const {bytes,type,evidence}=source;
    const remember=result=>{if(result.status==='inspected'){if(cache.size>=128)cache.delete(cache.keys().next().value);cache.set(media.diskName,{key:source.cacheKey,result:structuredClone(result)});}return result;};
    if(type.kind==='subtitle'){
      let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{return outcome('corrupt','subtitle_encoding','자막을 UTF-8 형식으로 저장한 뒤 다시 올려 주세요.',evidence);}
      let report;try{report=inspectSubtitles(text,{fileName:'subtitle.'+type.extension});}catch{return outcome('corrupt','subtitle_invalid','자막의 시간과 내용을 확인해 주세요.',evidence);}
      if(report.format!==type.extension||!report.cues.length||report.errors)return outcome('corrupt','subtitle_invalid','자막의 시간 형식과 내용을 확인해 주세요.',{...evidence,errorCount:report.errors||1});
      return remember(outcome('inspected','inspected','자막 정보를 확인했습니다.',{...evidence,metadata:{kind:'subtitle',subtitleFormat:report.format,cueCount:report.cues.length,lastCueEnd:report.durationMs/1000,subtitleWarnings:report.warnings}}));
    }
    try{
      const result=await probe(source.handle,type),after=await source.handle.stat({bigint:true}),current=await lstat(source.path,{bigint:true});
      if(!current.isFile()||current.isSymbolicLink()||['dev','ino','size','mtimeNs','ctimeNs'].some(key=>after[key]!==source.identity[key]||current[key]!==source.identity[key]))return outcome('corrupt','file_changed','검사 중 파일이 변경되었습니다. 다시 확인해 주세요.');
      if(result.status==='inspected'){
        // Timestamp identity alone can miss same-tick writes. Pair FFprobe
        // metadata only with bytes whose bounded hash still matches afterwards.
        const verified=await readVerified(source.handle,source.identity,{readBuffer:source.readBuffer});if(verified.error)return verified.error;
        const final=await lstat(source.path,{bigint:true}),finalHandle=await source.handle.stat({bigint:true});
        if(verified.evidence.sha256!==evidence.sha256||!final.isFile()||final.isSymbolicLink()||['dev','ino','size','mtimeNs','ctimeNs'].some(key=>final[key]!==source.identity[key]||finalHandle[key]!==source.identity[key]))return outcome('corrupt','file_changed','검사 중 파일이 변경되었습니다. 다시 확인해 주세요.');
      }
      return remember({...result,...evidence});
    }catch{return outcome('corrupt','file_changed','검사 중 파일이 변경되거나 없어졌습니다. 다시 확인해 주세요.');}finally{await source.handle.close().catch(()=>{});}
  }

  function inspect(media,options={}){
    if(closing)return Promise.resolve(stopped());
    if(jobs.size>=concurrency)return Promise.resolve(outcome('unavailable','busy','다른 파일을 검사하고 있습니다. 잠시 뒤 다시 확인해 주세요.'));
    const job=inspectFile(media,options).catch(()=>outcome('unavailable','inspection_failed','파일 검사를 마치지 못했습니다. 다시 확인해 주세요.'));jobs.add(job);void job.finally(()=>jobs.delete(job));return job;
  }
  async function close(){closing=true;cache.clear();for(const child of children)child.kill();await Promise.allSettled([...jobs]);}
  return {inspect,close};
}
