// PULSE 「채널 명단」 그림 올리기(조각 ③, 2026-11-23). 설계는 docs/디자인/PULSE고객경험_20261120/인플루언서_의뢰창_설계.md 9절 「조각 ③」이다.
// 대표(관리자)가 채널의 대표 사진 · 장면 그림을 올린다. 파일은 다른 작업실 파일과 같은 studio-media 자리 · 이름 규칙(<uuid>.png|jpg)에 두고,
// 그림 하나에 문서 하나(pulsePeopleMedia)를 둔다 — workspace-media.mjs가 이 문서의 이름을 세어 백업 · 버킷 올리기 · 복원 대조에 싣는다(설계 검토 P1-1).
// 명단 칸은 그림을 「media:<id>」로 가리킨다. 명단 문서에 그림 목록을 두지 않는 것은, 올릴 때마다 명단 판 번호가 올라 고치던 화면이 409를 받지 않게 하려는 것이다.
// 올리고 아직 저장하지 않은 그림은 한 시간 동안 두고(다른 탭이 저장하기 전에 올린 그림일 수 있다 — 설계 검토 P1-2), 그 뒤에도 명단이 가리키지 않으면 「지우는 중(gone)」으로 표시한다.
// 표시한 그림은 백업 목록에서 바로 빠지고, 파일은 표시 뒤 하루가 지나 지운 다음 문서를 뗀다(pulse-people.mjs sweep).
// 받는 형식은 PNG · JPEG 한 장 2MB까지다(작업실 파일 이름 규칙에 WebP가 없어 넣지 않았다). 실제 채널 사진은 그 채널이 허락한 것만 올린다(대표 화면에 적는다).
import {randomUUID} from 'node:crypto';
import {mkdir,open,unlink,rename} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';

export const PEOPLE_MEDIA_KIND='pulsePeopleMedia';
// 그림 쓰기를 여는 스위치(GPT 검수 GA1): 명단 칸의 「media:<id>」와 그림 문서를 읽고 백업에 세는 판(쓰기 닫음)이 먼저 운영에 오른 뒤 이 판에서 연다.
// 이 판을 되돌리면 앞 판이 올린 그림을 그대로 읽고 백업에 센다. 앞 판은 새 그림만 받지 않는다.
export const PEOPLE_MEDIA_WRITES=true;
// 지우는 중인 그림의 파일 지우기(GPT 다섯째 GA3): 쓰기와 함께 이 판에서 켠다. 백업과는 읽기 한도로 맞춘다 — 백업은 시작한 지 6시간 안에 끝나야 하고
// (workspace-media.mjs MEDIA_READ_WINDOW_MS, 직접 실행 포함), 파일은 표시 뒤 하루가 지나야 지우므로 표시 전에 잡힌 스냅샷도 그 파일을 다 읽은 뒤다.
export const PEOPLE_MEDIA_DELETE_FILES=true;
// graceMs: 올리고 저장 전 그림을 지우지 않는 시간(벽시계). goneMs: 지우는 중으로 표시한 뒤 파일을 지우기까지 서버가 떠 있던 실제 시간(단조 시계 — pulse-people.mjs sweep)
// — 백업 읽기 한도(6시간)와 뒤 단계(곁 객체 올리기, 백업 유닛 시한 45분 · 재난 백업 덧붙임이 있으면 90분)보다 길게.
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

// 그림의 뼈대를 처음부터 끝까지 걷는다(GPT 검수 GA7 → 둘째 판 GA2). 화소를 풀어 보지는 않는다 — 열리는지는 대표 화면이 저장 전에 같은 바이트를 그려 보여 준다.
// PNG: 서명, 첫 덩어리가 가로 · 세로 0이 아닌 IHDR, 덩어리마다 길이가 파일 안에 들고, 자료가 비지 않은 IDAT가 하나 이상, 마지막이 빈 IEND이고 그 뒤에 아무것도 없다.
// 덩어리 CRC는 보지 않는다 — 브라우저는 CRC가 틀려도 그림을 그리므로, 그것으로 막으면 열리는 그림을 거절하게 된다.
const PNG_SIGNATURE=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
function pngShape(b){
  if(b.length<8||!b.subarray(0,8).equals(PNG_SIGNATURE))return false;
  let offset=8,data=false;
  while(offset+12<=b.length){
    const length=b.readUInt32BE(offset),type=b.toString('latin1',offset+4,offset+8),end=offset+12+length;
    if(end>b.length)return false;
    if(offset===8?type!=='IHDR'||length!==13||!b.readUInt32BE(offset+8)||!b.readUInt32BE(offset+12):type==='IHDR')return false;
    if(type==='IDAT'&&length>0)data=true;
    if(type==='IEND')return length===0&&end===b.length&&data;
    offset=end;
  }
  return false;
}
// JPEG: 시작 표식 SOI, 길이가 맞는 표식 덩어리들, 가로 · 세로가 0이 아닌 SOF, 그 뒤 SOS와 압축 자료, 끝 표식 EOI.
const JPEG_FRAMES=new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);
function jpegShape(b){
  if(b.length<4||b[0]!==0xff||b[1]!==0xd8||b[b.length-2]!==0xff||b[b.length-1]!==0xd9)return false;
  let offset=2,frame=false;
  while(offset+4<=b.length){
    if(b[offset]!==0xff)return false;
    const marker=b[offset+1];
    if(marker===0xff){offset++;continue;}
    if(marker===0x01||marker>=0xd0&&marker<=0xd7){offset+=2;continue;}
    if(marker===0x00||marker===0xd8||marker===0xd9)return false;
    const length=b.readUInt16BE(offset+2),end=offset+2+length;
    if(length<2||end>b.length)return false;
    if(JPEG_FRAMES.has(marker)){if(length<8||!b.readUInt16BE(offset+5)||!b.readUInt16BE(offset+7))return false;frame=true;}
    if(marker===0xda)return frame&&end<b.length-2;
    offset=end;
  }
  return false;
}
const SHAPES={'image/png':pngShape,'image/jpeg':jpegShape};

// 받기: 형식 · 크기를 머리(Content-Length)와 흐름 양쪽에서 본다. 이름과 속이 다르면(.png인데 JPEG) 속을 따른다.
export async function receivePeopleImage(req,directory){
  // 형식 표는 자기 칸만 본다(constructor · __proto__ 같은 물려받은 이름이 형식으로 지나지 않게 — 둘째 판 다시 GPT GA1).
  const mimeType=String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase(),extension=Object.hasOwn(TYPES,mimeType)?TYPES[mimeType]:null;
  if(!extension)throw fail('PNG · JPEG 그림만 올릴 수 있어요.',415);
  const declared=req.headers['content-length'];
  if(declared===undefined||!/^\d+$/.test(String(declared)))throw fail('그림 크기를 확인해 주세요.',411);
  if(Number(declared)>PEOPLE_MEDIA_LIMITS.bytes)throw fail('그림은 한 장에 2MB까지 올릴 수 있어요.',413);
  const id=randomUUID();await mkdir(root(directory),{recursive:true,mode:0o700});
  // 한 장이 2MB까지라 받은 바이트를 메모리에도 모아 뼈대를 끝까지 본다.
  const temporary=located(directory,id+'.upload'),handle=await open(temporary,'wx',0o600),parts=[];let size=0;
  try{
    for await(const chunk of req.iterator({destroyOnReturn:false})){
      size+=chunk.length;if(size>PEOPLE_MEDIA_LIMITS.bytes){req.resume();throw fail('그림은 한 장에 2MB까지 올릴 수 있어요.',413);}
      parts.push(chunk);
      let offset=0;while(offset<chunk.length){const {bytesWritten}=await handle.write(chunk,offset,chunk.length-offset);offset+=bytesWritten;}
    }
    const bytes=Buffer.concat(parts,size),whole=type=>Object.hasOwn(SHAPES,type)&&SHAPES[type](bytes);
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
