// 문의 사진(운영 조각 8-B · 설계 docs/마케팅/PULSE_의뢰흐름_20261104/소통_정원_현황_운영판_설계_20261111.md S1 「④ 문의에 사진 붙이기」).
// 손님이 담당자에게 묻는 글(support)에 JPG · PNG를 넷까지 붙인다. 화면은 보내기를 누를 때 사진을 한 장씩 올려 id를 받고, 글과 함께 그 id를 보낸다.
// 올렸지만 아직 글에 붙지 않은 사진은 프로젝트 자산(studio.assets)이 아니라 손님만의 「올려 둔 문의 사진」(studio.messageUploads)에 둔다
// (서버 끝판 카본 A1 — 자산에 두면 직원 스튜디오 보기 · 자료 목록 · 내려받기 · 찾기 · 권리 · 착수 자료가 손님이 보내지 않은 사진까지 본다).
// 글에 붙는 순간에만 자산으로 옮기고 「문의 사진」 표시(purpose message)를 단다 — 그때부터 백업 · 90일 정리 · 손님 보기 · 직원 보기는 지금 길 그대로 탄다.
// 붙지 않은 채 한 시간 지난 사진은 다음 올리기 때와 6시간마다 도는 정리에서 거둔다(카본 A2).
export const MESSAGE_PHOTOS=Object.freeze({perMessage:4,perProject:40,pending:8,orphanMs:60*60*1000,assets:120});
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
export const isMessagePhoto=asset=>!!asset&&asset.purpose==='message'&&asset.author==='customer';
// 올려 두고 아직 글에 안 붙은 사진(손님만 — 어느 보기에도 내리지 않는다).
export const messageUploadsOf=studio=>Array.isArray(studio?.messageUploads)?studio.messageUploads.filter(upload=>upload&&typeof upload.id==='string'):[];
// 글에 붙은 사진 id 모두(어느 글이든 — 한 사진은 한 글에만 붙는다).
export function attachedPhotoIds(row){return new Set((Array.isArray(row?.messages)?row.messages:[]).flatMap(message=>Array.isArray(message?.photos)?message.photos:[]));}
// 사진 id 목록의 꼴만 본다: 없으면 [] · 배열 · 넷까지 · 겹치지 않게 · UUID. 두 번 누름 판정보다 먼저 부른다(꼴이 틀린 값이 「같은 글」로 200을 받지 않게 — GPT GA2).
export function photoList(value){
  if(value===undefined)return [];
  if(!Array.isArray(value)||value.length>MESSAGE_PHOTOS.perMessage||new Set(value).size!==value.length||value.some(id=>typeof id!=='string'||!UUID.test(id)))throw fail('붙인 사진을 확인해 주세요. 사진은 4장까지 붙일 수 있어요.');
  return value;
}
// 손님 문의에 붙일 사진 id 목록을 확인한다: 꼴(photoList) · 아직 어느 글에도 안 붙은 것 · 이 프로젝트에 올려 둔 문의 사진(직원 그림 · 의뢰 자료 · 다른 프로젝트 것은 여기 없다).
export function supportPhotos(row,value){
  value=photoList(value);
  const uploads=new Set(messageUploadsOf(row?.studio).map(upload=>upload.id)),used=attachedPhotoIds(row);
  for(const id of value){
    if(used.has(id))throw fail('이미 보낸 사진이에요. 사진을 다시 골라 주세요.',409);
    if(!uploads.has(id))throw fail('붙인 사진을 찾지 못했어요. 사진을 다시 골라 주세요.',409);
  }
  return value;
}
// 글에 붙인 사진을 올려 둔 목록에서 자산으로 옮긴 새 studio(올린 차례 · 붙인 차례 그대로). 자산 120을 넘으면 409(다른 올리기와 같은 글).
export function attachUploads(studio,ids){
  if(!ids.length)return studio;
  const pick=new Set(ids),uploads=messageUploadsOf(studio),moved=ids.map(id=>uploads.find(upload=>upload.id===id)),assets=Array.isArray(studio?.assets)?studio.assets:[];
  if(moved.some(upload=>!upload))throw fail('붙인 사진을 찾지 못했어요. 사진을 다시 골라 주세요.',409);
  if(assets.length+moved.length>MESSAGE_PHOTOS.assets)throw fail('이 프로젝트의 기록이 가득 찼어요. 새 프로젝트로 이어 가 주세요.',409);
  return {...studio,assets:[...assets,...moved.map(upload=>({...upload,purpose:'message'}))],messageUploads:uploads.filter(upload=>!pick.has(upload.id))};
}
// 붙지 않은 채 한 시간 지난(때를 못 읽는 것 포함) 올려 둔 사진을 뺀다. 뺀 파일(diskName)은 부른 쪽이 커밋 뒤 지운다.
export function sweepUnsentPhotos(uploads,now){
  const cut=now-MESSAGE_PHOTOS.orphanMs,kept=[],removed=[];
  for(const upload of uploads){if(Date.parse(upload.at)>cut)kept.push(upload);else if(upload.diskName)removed.push({diskName:upload.diskName});}
  return {uploads:kept,removed};
}
