// PULSE 「채널 명단」 그림 올리기(조각 ③, 2026-11-23). 설계는 docs/디자인/PULSE고객경험_20261120/인플루언서_의뢰창_설계.md 9절 「조각 ③」이다.
// 대표(관리자)가 채널의 대표 사진 · 장면 그림을 올린다. 파일은 다른 작업실 파일과 같은 studio-media 자리 · 이름 규칙(<uuid>.png|jpg)에 두고,
// 그림 하나에 문서 하나(pulsePeopleMedia)를 둔다 — workspace-media.mjs가 이 문서의 이름을 세어 백업 · 버킷 올리기 · 복원 대조에 싣는다(설계 검토 P1-1).
// 명단 칸은 그림을 「media:<id>」로 가리킨다. 명단 문서에 그림 목록을 두지 않는 것은, 올릴 때마다 명단 판 번호가 올라 고치던 화면이 409를 받지 않게 하려는 것이다.
// 올리고 아직 저장하지 않은 그림은 한 시간 동안 지우지 않는다(다른 탭의 저장이 지우지 않게 — 설계 검토 P1-2). 그 뒤에도 명단이 가리키지 않으면 다음 저장 · 올리기 때 지운다.
// 받는 형식은 PNG · JPEG 한 장 2MB까지다(작업실 파일 이름 규칙에 WebP가 없어 넣지 않았다). 실제 채널 사진은 그 채널이 허락한 것만 올린다(대표 화면에 적는다).
import {randomUUID} from 'node:crypto';
import {mkdir,open,unlink,rename} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {validMediaSignature} from './studio-media.mjs';

export const PEOPLE_MEDIA_KIND='pulsePeopleMedia';
// 그림 쓰기를 여는 스위치(GPT 검수 GA1): 명단 칸의 「media:<id>」와 그림 문서를 읽고 백업에 세는 코드가 먼저 운영에 오른 뒤에 쓰기를 연다.
// 쓰기와 읽기를 한 판에 올리면, 그 판을 되돌렸을 때 옛 판이 명단 전체를 깨진 문서로 읽고 그림을 백업에서 뺀다. 이 판은 읽기만 싣고, 다음 판에서 true로 바꾼다.
export const PEOPLE_MEDIA_WRITES=false;
// 지우는 중인 그림의 파일 지우기(GPT 다섯째 GA3): 이 판은 끈다 — 지우는 중 표시와 백업 목록 빼기만 한다. 쓰기를 여는 판에서 백업과 맞춘 지우기와 함께 켠다.
export const PEOPLE_MEDIA_DELETE_FILES=false;
// graceMs: 올리고 저장 전 그림을 지우지 않는 시간. goneMs: 지우는 중으로 표시한 뒤 파일을 지우기까지 — 그 전에 잡힌 백업이 끝날 시간.
export const PEOPLE_MEDIA_LIMITS=Object.freeze({bytes:2*1024*1024,count:200,graceMs:3600000,goneMs:24*3600000});
export const MEDIA_REF=/^media:([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/;
export const mediaIdOf=value=>typeof value==='string'?MEDIA_REF.exec(value)?.[1]||null:null;
const TYPES={'image/png':'png','image/jpeg':'jpg'};
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const root=directory=>resolve(directory,'studio-media');
function located(directory,name){
  if(!/^[a-f0-9-]{36}\.(?:png|jpg|upload)$/.test(name))throw fail('저장된 그림 경로를 확인해 주세요.',404);
  const base=root(directory),path=resolve(base,name);if(dirname(path)!==base)throw fail('그림을 찾지 못했어요.',404);return path;
}
// 그림 문서 하나의 이름(백업 · 버킷 목록). 꼴이 틀리면 던진다 — 목록이 조용히 빠지지 않게(workspace-media.mjs의 다른 종류와 같다).
// 지우는 중(gone)인 그림은 세지 않는다 — 정리가 문서를 gone으로 바꾼 트랜잭션 뒤에 파일을 지우므로, 그 뒤 잡힌 백업이 이미 지운 파일을 찾지 않게(GPT 다시 검수 GA1). 없으면 null.
export function peopleMediaName(doc){
  if(doc&&typeof doc==='object'&&doc.gone===true)return null;
  if(!doc||typeof doc!=='object'||typeof doc.diskName!=='string'||!/^[a-f0-9-]{36}\.(?:png|jpg)$/.test(doc.diskName))throw new Error('채널 명단 그림 기록을 확인해 주세요.');
  return doc.diskName;
}

// 받기: 형식 · 크기를 머리(Content-Length)와 흐름 양쪽에서 본다. 이름과 속이 다르면(.png인데 JPEG) 속을 따른다.
export async function receivePeopleImage(req,directory){
  const mimeType=String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase(),extension=TYPES[mimeType];
  if(!extension)throw fail('PNG · JPEG 그림만 올릴 수 있어요.',415);
  const declared=req.headers['content-length'];
  if(declared===undefined||!/^\d+$/.test(String(declared)))throw fail('그림 크기를 확인해 주세요.',411);
  if(Number(declared)>PEOPLE_MEDIA_LIMITS.bytes)throw fail('그림은 한 장에 2MB까지 올릴 수 있어요.',413);
  const id=randomUUID();await mkdir(root(directory),{recursive:true,mode:0o700});
  const temporary=located(directory,id+'.upload'),handle=await open(temporary,'wx',0o600);let size=0,head=Buffer.alloc(0),tail=Buffer.alloc(0);
  try{
    for await(const chunk of req.iterator({destroyOnReturn:false})){
      size+=chunk.length;if(size>PEOPLE_MEDIA_LIMITS.bytes){req.resume();throw fail('그림은 한 장에 2MB까지 올릴 수 있어요.',413);}
      if(head.length<64)head=Buffer.concat([head,chunk.subarray(0,64-head.length)]);
      tail=Buffer.concat([tail,chunk]).subarray(-16);
      let offset=0;while(offset<chunk.length){const {bytesWritten}=await handle.write(chunk,offset,chunk.length-offset);offset+=bytesWritten;}
    }
    // 머리 서명에 더해 그림의 뼈대(PNG: 첫 덩어리 IHDR과 0이 아닌 가로 · 세로, 끝 덩어리 IEND / JPEG: 끝 표식 FFD9)까지 본다 — 열 수 없는 파일이 손님 화면에 걸리지 않게(GPT 검수 GA7).
    const whole=type=>validMediaSignature(type,head)&&(type==='image/png'?head.length>=24&&head.subarray(12,16).toString('ascii')==='IHDR'&&head.readUInt32BE(16)>0&&head.readUInt32BE(20)>0&&tail.length>=8&&tail.subarray(tail.length-8,tail.length-4).toString('ascii')==='IEND':tail.length>=2&&tail[tail.length-2]===0xff&&tail[tail.length-1]===0xd9);
    const actual=whole(mimeType)?mimeType:Object.keys(TYPES).find(whole);
    if(!size||!actual)throw fail('그림 파일이 아니에요. PNG · JPEG 그림을 골라 주세요.',415);
    await handle.close();
    return {temporary,metadata:{id,diskName:`${id}.${TYPES[actual]}`,mimeType:actual,byteSize:size}};
  }catch(error){await handle.close().catch(()=>{});await unlink(temporary).catch(()=>{});throw error;}
}
export async function commitPeopleImage(upload,directory){await rename(upload.temporary,located(directory,upload.metadata.diskName));upload.committed=true;}
export async function discardPeopleImage(upload,directory){if(!upload)return;await unlink(upload.committed?located(directory,upload.metadata.diskName):upload.temporary).catch(()=>{});}
// 지우기: 없는 파일은 이미 지운 것으로 본다. 다른 실패는 던진다 — 부른 쪽이 그 그림 문서를 남겨 다음 정리 때 다시 지운다(GPT 검수 GA8).
export async function removePeopleImageFile(directory,diskName){try{await unlink(located(directory,diskName));}catch(error){if(error?.code!=='ENOENT')throw error;}}
