import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {lstat,open} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {Readable} from 'node:stream';
import {crc32} from 'node:zlib';
import {clientDeliveryIdentity} from './client-closeout.mjs';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const text=value=>typeof value==='string'?value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,''):'';
const types={'video/mp4':'mp4','video/webm':'webm','image/png':'png','image/jpeg':'jpg','audio/mpeg':'mp3','audio/wav':'wav','application/x-subrip':'srt','text/vtt':'vtt'};
const visible=value=>value&&!value.deleted&&!value.deletedAt&&!value.hidden&&!['private','internal','hidden','deleted'].includes(value.visibility);
export const CLIENT_DELIVERY_ARCHIVE_LIMITS=Object.freeze({files:100,bytes:2*1024*1024*1024,guideBytes:1024*1024,concurrent:3});
const signature=info=>({size:info.size,dev:info.dev,ino:info.ino,mtime:info.mtimeMs,ctime:info.ctimeMs});
const sameFile=(left,right)=>JSON.stringify(signature(left))===JSON.stringify(signature(right));
function safeName(value,fallback){
  let result=text(value).normalize('NFC').replace(/[\\/:*?"<>|\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,'_').replace(/^[ .]+|[ .]+$/g,'');
  if(!result)result=fallback;
  if(/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(result))result='_'+result;
  // Keep the extension and leave room for the collision suffix on Windows.
  if(Array.from(result).length>150){const dot=result.lastIndexOf('.'),extension=dot>0&&result.length-dot<=12?result.slice(dot):'';result=Array.from(result).slice(0,140-Array.from(extension).length).join('')+extension;}
  return result;
}
function uniqueName(value,used){let result=value,index=2;const dot=value.lastIndexOf('.'),base=dot>0?value.slice(0,dot):value,extension=dot>0?value.slice(dot):'';while(used.has(result.normalize('NFC').toLowerCase()))result=`${base} (${index++})${extension}`;used.add(result.normalize('NFC').toLowerCase());return result;}
function external(value){try{if(typeof value!=='string'||value.length>2000||/[\u0000-\u001f\u007f]/.test(value))return '';const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:'';}catch{return '';}}
const zipLength=entries=>22+entries.reduce((sum,entry)=>sum+30+46+16+2*Buffer.byteLength(entry.name)+entry.size,0);

// Unlike the small publication ZIP, final videos are never buffered or compressed.
// ZIP32 STORE with data descriptors needs only a 64KiB file chunk and the directory.
export function createClientDeliveryArchiveService({store,clientProjects,clock=()=>new Date().toISOString()}){
  const active=new Set();
  function current(user){const live=typeof user?.id==='string'&&store.get('users',user.id);if(!live?.active||!['admin','manager','member','viewer'].includes(live.role))throw fail('먼저 직원 계정으로 로그인해 주세요.',401);return live;}
  function source(user,projectId){
    user=current(user);if(!uuid(projectId))throw fail('프로젝트를 확인해 주세요.');
    const project=clientProjects.project(user,projectId),delivery=clientDeliveryIdentity(project);
    if(!delivery.deliveryKey||!Number.isFinite(Date.parse(delivery.approvedPreview?.approvedAt)))throw fail('현재 승인 시안에 연결된 최종 납품 파일을 먼저 등록해 주세요.',409);
    if(!visible(delivery.approvedPreview)||delivery.finals.some(item=>!uuid(item.id)||!visible(item)))throw fail('현재 납품 파일의 공개 상태를 확인해 주세요.',409);
    if(delivery.finals.length>CLIENT_DELIVERY_ARCHIVE_LIMITS.files)throw fail('한 번에 받을 수 있는 최종 납품 항목은 100개입니다.',413);
    const stamp=hash({user:{id:user.id,role:user.role,teamId:user.teamId},project:{id:project.id,revision:project.revision,title:project.title,stage:project.stage,ownerId:project.ownerId,reviewerId:project.reviewerId,teamId:project.teamId},deliveryKey:delivery.deliveryKey});
    return {user,project,delivery,stamp};
  }
  function located(media){
    const extension=types[media?.mimeType];
    if(!uuid(media?.id)||!extension||media.diskName!==media.id+'.'+extension||!Number.isSafeInteger(media.byteSize)||media.byteSize<0)throw fail('현재 납품 파일의 저장 정보를 확인해 주세요.',409);
    const root=resolve(store.directory,'studio-media'),path=resolve(root,media.diskName);
    if(dirname(path)!==root)throw fail('현재 납품 파일의 경로를 확인해 주세요.',409);
    return {root,path};
  }
  async function inspect(media){
    const {root,path}=located(media);let info;
    try{const directory=await lstat(root);info=await lstat(path);if(!directory.isDirectory()||directory.isSymbolicLink()||!info.isFile()||info.isSymbolicLink())throw fail('현재 납품 파일의 원본을 확인해 주세요.',409);}catch(error){if(error.status)throw error;throw fail('현재 납품 파일을 찾거나 읽을 수 없습니다. 자료 모음에서 확인해 주세요.',409);}
    if(info.size!==media.byteSize)throw fail('현재 납품 파일의 크기가 변경됐습니다. 원본을 확인해 주세요.',409);
    return {path,info};
  }
  async function plan(user,projectId,{authorize=()=>{}}={}){
    authorize();const state=source(user,projectId),{project,delivery}=state,used=new Set(),files=[],links=[],entries=[],byMedia=new Map(),byUrl=new Map();
    let totalBytes=0;
    for(const version of delivery.finals){
      authorize();if(source(user,projectId).stamp!==state.stamp)throw fail('준비하는 동안 납품 묶음이나 권한이 바뀌었습니다. 다시 준비해 주세요.',409);
      if(version.media){
        const existing=byMedia.get(version.media.id);
        if(existing){
          if(existing.metadata!==hash(version.media))throw fail('같은 납품 파일에 서로 다른 저장 정보가 있습니다. 원본을 확인해 주세요.',409);
          existing.item.versionIds.push(version.id);existing.item.labels.push(text(version.label));
        }else{
          const {path,info}=await inspect(version.media),fileName=uniqueName(safeName(version.media.fileName,'최종파일.'+types[version.media.mimeType]),used);
          totalBytes+=info.size;if(totalBytes>CLIENT_DELIVERY_ARCHIVE_LIMITS.bytes)throw fail('최종 파일의 합계가 2GiB를 넘습니다. 자료 모음에서 파일별로 내려받아 주세요.',413);
          const item={versionId:version.id,versionIds:[version.id],label:text(version.label),labels:[text(version.label)],fileName,originalFileName:text(version.media.fileName),byteSize:info.size};files.push(item);byMedia.set(version.media.id,{item,metadata:hash(version.media)});
          entries.push({name:'최종 파일/'+fileName,size:info.size,path,info,media:version.media,versionId:version.id});
        }
      }else if(!external(version.url))throw fail('현재 납품 항목의 파일 또는 HTTPS 링크를 확인해 주세요.',409);
      const url=external(version.url);if(url){const existing=byUrl.get(url);if(existing){existing.versionIds.push(version.id);existing.labels.push(text(version.label));existing.label=[...new Set(existing.labels)].join(' · ');}else{const item={versionId:version.id,versionIds:[version.id],label:text(version.label),labels:[text(version.label)],url};links.push(item);byUrl.set(url,item);}}
    }
    const generatedAt=clock();if(!Number.isFinite(Date.parse(generatedAt)))throw fail('서버 시각을 확인해 주세요.',503);
    const guide=['\uFEFF'+text(project.title)+' · 최종 납품 묶음','기준 시각: '+generatedAt,'승인 시안: '+text(delivery.approvedPreview.label),'승인 시각: '+delivery.approvedPreview.approvedAt,'','실제 파일: '+files.length+'개','외부 링크: '+links.length+'개 · 링크 대상 파일은 ZIP에 포함되지 않습니다.','','파일 목록',...files.map(file=>'- '+file.fileName+' ('+file.byteSize+' bytes)'),'',...delivery.finals.flatMap(version=>['['+text(version.label)+']',text(version.guide)||'등록된 사용 안내 없음','']),'이 다운로드는 고객 수령 확인이나 프로젝트 마감 상태를 변경하지 않습니다.'].join('\r\n');
    const guideBytes=Buffer.from(guide,'utf8');if(guideBytes.length>CLIENT_DELIVERY_ARCHIVE_LIMITS.guideBytes)throw fail('납품 안내가 너무 커 한 번에 묶을 수 없습니다.',413);
    entries.push({name:'납품 안내.txt',size:guideBytes.length,bytes:guideBytes});
    if(links.length){const bytes=Buffer.from(['\uFEFF외부 납품 링크 목록','아래 주소만 기록했습니다. 대상 파일을 가져오거나 ZIP 안에 넣지 않았습니다.','',...links.flatMap(link=>[link.label,link.url,''])].join('\r\n'),'utf8');entries.push({name:'외부 링크.txt',size:bytes.length,bytes});}
    authorize();if(source(user,projectId).stamp!==state.stamp)throw fail('준비하는 동안 납품 묶음이나 권한이 바뀌었습니다. 다시 준비해 주세요.',409);
    const fingerprint=hash({stamp:state.stamp,files:entries.filter(entry=>entry.media).map(entry=>({id:entry.versionId,name:entry.name,media:entry.media,stat:signature(entry.info)})),links});
    const summary={schema:1,projectId,projectRevision:project.revision,deliveryKey:delivery.deliveryKey,fingerprint,generatedAt,title:text(project.title),approvedPreview:{id:delivery.approvedPreviewId,label:text(delivery.approvedPreview.label),approvedAt:delivery.approvedPreview.approvedAt},fileName:safeName(text(project.title),'프로젝트')+'-최종납품.zip',files,links,counts:{files:files.length,links:links.length,entries:entries.length},totalBytes,contentLength:zipLength(entries),warnings:[...(links.length?['외부 링크 대상 파일은 ZIP에 포함되지 않습니다. 주소 목록에서 직접 열어 주세요.']:[]),'다운로드는 고객 수령 확인이나 마감 상태를 변경하지 않습니다.']};
    return {state,summary,entries};
  }
  async function prepare(user,projectId,options={}){return (await plan(user,projectId,options)).summary;}
  async function download(user,projectId,{fingerprint,authorize=()=>{}}={}){
    if(typeof fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(fingerprint))throw fail('최종 납품 묶음을 먼저 준비해 주세요.');
    const identity=current(user);if(active.has(identity.id)||active.size>=CLIENT_DELIVERY_ARCHIVE_LIMITS.concurrent)throw fail('이미 내려받는 묶음이 있습니다. 다운로드를 마친 뒤 다시 시도해 주세요.',429);
    active.add(identity.id);const handles=[];let cleaned=false;
    const cleanup=async()=>{if(cleaned)return;cleaned=true;await Promise.all(handles.map(handle=>handle.close().catch(()=>{})));active.delete(identity.id);};
    try{
      const prepared=await plan(user,projectId,{authorize}),{state,summary,entries}=prepared;
      if(summary.fingerprint!==fingerprint)throw fail('납품 파일이나 권한이 변경됐습니다. 목록을 다시 준비한 뒤 내려받아 주세요.',409);
      const guard=()=>{authorize();if(source(user,projectId).stamp!==state.stamp)throw fail('다운로드 중 납품 묶음이나 권한이 변경됐습니다. 다시 준비해 주세요.',409);};
      for(const entry of entries.filter(item=>item.media)){
        guard();let handle;
        try{handle=await open(entry.path,constants.O_RDONLY|(constants.O_NOFOLLOW||0));handles.push(handle);const info=await handle.stat(),pathInfo=await lstat(entry.path);if(!info.isFile()||pathInfo.isSymbolicLink()||!sameFile(info,entry.info)||!sameFile(pathInfo,entry.info))throw fail('준비한 납품 파일이 변경됐습니다. 다시 준비해 주세요.',409);}catch(error){if(error.status)throw error;throw fail('현재 납품 파일을 읽을 수 없습니다. 자료 모음에서 확인해 주세요.',409);}
        entry.handle=handle;
      }
      guard();
      async function* archive(){
        const central=[];let offset=0,lastGuard=0;
        try{
          for(const entry of entries){
            guard();if(entry.handle){const info=await entry.handle.stat(),pathInfo=await lstat(entry.path);if(pathInfo.isSymbolicLink()||!sameFile(info,entry.info)||!sameFile(pathInfo,entry.info))throw fail('다운로드 전 납품 파일이 변경됐습니다. 다시 준비해 주세요.',409);}
            const name=Buffer.from(entry.name,'utf8'),local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(0x808,6);local.writeUInt16LE(33,12);local.writeUInt16LE(name.length,26);
            yield local;yield name;let crc=0,size=0;
            if(entry.bytes){crc=crc32(entry.bytes,crc);size=entry.bytes.length;yield entry.bytes;}
            else{
              while(size<entry.size){
                if(Date.now()-lastGuard>=1000){guard();lastGuard=Date.now();}
                const buffer=Buffer.allocUnsafe(Math.min(64*1024,entry.size-size)),{bytesRead}=await entry.handle.read(buffer,0,buffer.length,size);
                if(!bytesRead)throw fail('다운로드 중 납품 파일의 크기가 바뀌었습니다.',409);
                const chunk=buffer.subarray(0,bytesRead);crc=crc32(chunk,crc);size+=bytesRead;yield chunk;
              }
              const info=await entry.handle.stat(),pathInfo=await lstat(entry.path);if(pathInfo.isSymbolicLink()||!sameFile(info,entry.info)||!sameFile(pathInfo,entry.info))throw fail('다운로드 중 납품 파일이 변경됐습니다. 다시 준비해 주세요.',409);
            }
            guard();
            const descriptor=Buffer.alloc(16);descriptor.writeUInt32LE(0x08074b50);descriptor.writeUInt32LE(crc,4);descriptor.writeUInt32LE(size,8);descriptor.writeUInt32LE(size,12);yield descriptor;
            const row=Buffer.alloc(46);row.writeUInt32LE(0x02014b50);row.writeUInt16LE(20,4);row.writeUInt16LE(20,6);row.writeUInt16LE(0x808,8);row.writeUInt16LE(33,14);row.writeUInt32LE(crc,16);row.writeUInt32LE(size,20);row.writeUInt32LE(size,24);row.writeUInt16LE(name.length,28);row.writeUInt32LE(offset,42);central.push(row,name);offset+=30+name.length+size+16;
          }
          guard();const directoryBytes=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directoryBytes.length,12);end.writeUInt32LE(offset,16);yield directoryBytes;yield end;
        }finally{await cleanup();}
      }
      const stream=Readable.from(archive(),{objectMode:false,highWaterMark:64*1024});stream.once('close',()=>{void cleanup();});
      return {stream,fileName:summary.fileName,mimeType:'application/zip',contentLength:summary.contentLength};
    }catch(error){await cleanup();throw error;}
  }
  return Object.freeze({prepare,download});
}
