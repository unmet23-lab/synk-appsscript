// Personal local photo album. No uploads, silent evictions, or cross-account reads.
import {normalizeEditState} from './wardrobe-workbench.mjs';

export const ALBUM_LIMITS=Object.freeze({maxCount:40,maxBytes:40*1024*1024,maxPhotoBytes:10*1024*1024,maxSessionCount:3,maxSessionBytes:5*1024*1024});
const sessions=new Map();
const cleanText=(value,max)=>typeof value==='string'?value.slice(0,max):'';
const bound=(value,min,max,fallback)=>Number.isFinite(Number(value))?Math.max(min,Math.min(max,Number(value))):fallback;
const metadata=record=>{const {blob,...rest}=record;return rest;};
const failure=(code,message,mode)=>({ok:false,error:code,message,mode});
const request=req=>new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('ALBUM_REQUEST'));});
const transactionDone=tx=>new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('ALBUM_TRANSACTION'));tx.onabort=()=>reject(tx.error||new Error('ALBUM_ABORT'));});
function normalizePhoto(blob,value,accountId,now){
  const edit=normalizeEditState(value),created=typeof value?.createdAt==='string'?Date.parse(value.createdAt):Number(value?.createdAt);
  return {id:globalThis.crypto?.randomUUID?.()||`photo-${now()}-${Math.random().toString(36).slice(2)}`,accountId,blob,size:blob.size,type:blob.type||'image/png',slots:edit.slots,dyes:edit.dyes,preview:value?.preview===true,caption:cleanText(value?.caption,120),createdAt:Number.isFinite(created)&&created>0?created:now(),filename:cleanText(value?.filename,180)||`mongle-${now()}.png`,width:Math.max(0,Math.min(10000,Number(value?.width)||0)),height:Math.max(0,Math.min(10000,Number(value?.height)||0)),format:['portrait','square','landscape'].includes(value?.format)?value.format:'portrait',view:{angle:Number(value?.view?.angle)||0,zoom:Math.max(0,Math.min(1,Number(value?.view?.zoom)||0)),detail:value?.view?.detail===true},light:cleanText(value?.light,24),pose:cleanText(value?.pose,24),background:cleanText(value?.background,24)};
}

/** list -> metadata[]; get -> record including Blob|null; mutations -> explicit {ok,mode,...}. */
export function createWardrobeAlbum({accountId,indexedDB,now=Date.now,maxCount=ALBUM_LIMITS.maxCount,maxBytes=ALBUM_LIMITS.maxBytes,maxPhotoBytes=ALBUM_LIMITS.maxPhotoBytes,maxSessionCount=ALBUM_LIMITS.maxSessionCount,maxSessionBytes=ALBUM_LIMITS.maxSessionBytes,openTimeout=3500}={}){
  if(typeof accountId!=='string'||!accountId.trim())throw new TypeError('accountId is required');
  maxCount=Math.floor(bound(maxCount,1,100,ALBUM_LIMITS.maxCount));maxBytes=bound(maxBytes,1,100*1024*1024,ALBUM_LIMITS.maxBytes);maxPhotoBytes=bound(maxPhotoBytes,1,maxBytes,Math.min(maxBytes,ALBUM_LIMITS.maxPhotoBytes));maxSessionCount=Math.floor(bound(maxSessionCount,1,maxCount,Math.min(maxCount,ALBUM_LIMITS.maxSessionCount)));maxSessionBytes=bound(maxSessionBytes,1,maxBytes,Math.min(maxBytes,ALBUM_LIMITS.maxSessionBytes));openTimeout=bound(openTimeout,100,10000,3500);
  if(indexedDB===undefined){try{indexedDB=globalThis.indexedDB;}catch{indexedDB=null;}}
  const account=accountId,session=sessions.get(account)||new Map();sessions.set(account,session);
  let dbPromise=null,db=null,status={mode:indexedDB?'device':'session',message:indexedDB?'사진은 이 기기의 앨범에 저장해요.':'앨범 저장을 사용할 수 없어 이번 실행에서만 사진을 보관해요.'};
  async function open(){
    if(!indexedDB)return null;if(db)return db;if(dbPromise)return dbPromise;
    dbPromise=new Promise(resolve=>{let settled=false,timer;const finish=value=>{if(settled){value?.close?.();return;}settled=true;clearTimeout(timer);status=value?{mode:'device',message:'이 기기의 앨범을 연결했어요.'}:{mode:'session',message:'앨범 저장을 사용할 수 없어 이번 실행에서만 사진을 보관해요.'};resolve(value);};
      try{const req=indexedDB.open('synk-wardrobe-album-v1',1);timer=setTimeout(()=>finish(null),openTimeout);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('photos')){const store=req.result.createObjectStore('photos',{keyPath:'id'});store.createIndex('accountId','accountId',{unique:false});}};req.onsuccess=()=>{const connection=req.result;if(settled){connection.close();return;}db=connection;db.onversionchange=()=>{db.close();db=null;dbPromise=null;status={mode:'session',message:'앨범이 다른 화면에서 바뀌었어요. 다시 열어 기기 저장을 연결해요.'};};finish(connection);};req.onerror=()=>finish(null);req.onblocked=()=>finish(null);}catch{finish(null);}
    });return dbPromise;
  }
  async function deviceRecords(connection,mode='readonly'){
    const tx=connection.transaction('photos',mode),completion=transactionDone(tx);completion.catch(()=>{});
    const store=tx.objectStore('photos'),all=await request(store.index('accountId').getAll(account));return {tx,completion,store,all};
  }
  async function list(){const connection=await open();let all=[];if(connection){try{const operation=await deviceRecords(connection);all=operation.all;await operation.completion;}catch(error){status={mode:'session',message:'기기 앨범을 읽지 못했어요. 다시 시도할 수 있어요.',error:String(error?.name||'ALBUM_READ')};throw Object.assign(new Error(status.message),{code:'ALBUM_READ'});}}const merged=new Map(all.map(record=>[record.id,record]));for(const [id,record]of session)merged.set(id,record);return [...merged.values()].map(metadata).sort((a,b)=>b.createdAt-a.createdAt||b.id.localeCompare(a.id));}
  async function get(id){if(session.has(id))return session.get(id);const connection=await open();if(!connection)return null;const tx=connection.transaction('photos','readonly'),completion=transactionDone(tx);completion.catch(()=>{});const record=await request(tx.objectStore('photos').get(id));await completion;return record?.accountId===account?record:null;}
  function addSession(photo,diskRecords=[],warning){
    const temporary=[...session.values()],total=[...diskRecords,...temporary];
    if(total.length>=maxCount||total.reduce((sum,p)=>sum+p.size,0)+photo.size>maxBytes)return failure('ALBUM_FULL','앨범이 가득 찼어요. 사진을 내려받은 뒤 직접 삭제해 주세요. 기존 사진은 지우지 않았어요.','session');
    if(temporary.length>=maxSessionCount||temporary.reduce((sum,p)=>sum+p.size,0)+photo.size>maxSessionBytes)return failure('ALBUM_SESSION_FULL','임시 앨범이 가득 찼어요. 사진을 내려받은 뒤 직접 삭제하거나 기기 저장을 다시 연결해 주세요.','session');
    photo.localStatus='session';session.set(photo.id,photo);status={mode:'session',message:warning?'기기 저장 공간이 부족하여 이번 실행에서만 사진을 보관해요. 브라우저를 닫기 전에 내려받아 주세요.':'이번 실행에서만 사진을 보관해요. 브라우저를 닫기 전에 내려받아 주세요.',...(warning?{warning}:{})};return {ok:true,photo:metadata(photo),...status};
  }
  async function add(blob,value={}){
    if(!(blob instanceof Blob)||!blob.size||!/^image\/(png|jpeg|webp)$/.test(blob.type))return failure('PHOTO_INVALID','이미지 파일을 확인해 주세요.',status.mode);
    if(blob.size>maxPhotoBytes)return failure('PHOTO_TOO_LARGE','사진 한 장의 크기 한도를 넘었어요. 작은 크기로 다시 찍어 주세요.',status.mode);
    const photo=normalizePhoto(blob,value,account,now),connection=await open();let diskRecords=[];
    if(connection){try{const {tx,completion,store,all}=await deviceRecords(connection,'readwrite');diskRecords=all;const total=[...all,...session.values()];if(total.length>=maxCount||total.reduce((sum,p)=>sum+p.size,0)+blob.size>maxBytes){tx.abort();await completion.catch(()=>{});return failure('ALBUM_FULL','앨범이 가득 찼어요. 사진을 내려받은 뒤 직접 삭제하고 다시 저장해 주세요. 기존 사진은 지우지 않았어요.','device');}photo.localStatus='device';await request(store.put(photo));await completion;status={mode:'device',message:'이 기기의 앨범에 저장했어요.'};return {ok:true,photo:metadata(photo),...status};}catch(error){if(error?.name==='QuotaExceededError')return addSession(photo,diskRecords,'ALBUM_QUOTA');status={mode:'device',message:'앨범에 저장하지 못했어요. 사진을 내려받고 다시 시도할 수 있어요.',error:'ALBUM_WRITE'};return {ok:false,...status};}}
    return addSession(photo);
  }
  async function remove(id){
    if(session.has(id)){session.delete(id);return {ok:true,mode:'session',message:'사진을 앨범에서 삭제했어요.'};}
    const connection=await open();if(!connection)return failure('PHOTO_NOT_FOUND','삭제할 사진을 찾지 못했어요.',status.mode);
    try{const tx=connection.transaction('photos','readwrite'),completion=transactionDone(tx);completion.catch(()=>{});const store=tx.objectStore('photos'),photo=await request(store.get(id));if(photo?.accountId!==account){tx.abort();await completion.catch(()=>{});return failure('PHOTO_NOT_FOUND','삭제할 사진을 찾지 못했어요.','device');}await request(store.delete(id));await completion;return {ok:true,mode:'device',message:'사진을 앨범에서 삭제했어요.'};}catch(error){return failure('ALBUM_DELETE','사진을 삭제하지 못했어요. 다시 시도해 주세요.',status.mode);}
  }
  /** Convert an existing session photo in place. Failure always retains its original Blob and ID. */
  async function persist(id){
    const temporary=session.get(id),connection=await open();
    if(!connection)return failure('ALBUM_UNAVAILABLE','기기 앨범을 연결하지 못했어요. 이번 실행의 사진은 그대로 남아 있어요.','session');
    if(!temporary){try{const record=await get(id);return record?{ok:true,photo:metadata(record),mode:'device',message:'이미 이 기기에 보관한 사진이에요.'}:failure('PHOTO_NOT_FOUND','저장할 사진을 찾지 못했어요.','device');}catch{return failure('ALBUM_READ','사진을 확인하지 못했어요. 다시 시도해 주세요.','device');}}
    try{const {tx,completion,store,all}=await deviceRecords(connection,'readwrite'),others=[...all.filter(record=>record.id!==id),...[...session.values()].filter(record=>record.id!==id)];
      if(others.length>=maxCount||others.reduce((sum,record)=>sum+record.size,0)+temporary.size>maxBytes){tx.abort();await completion.catch(()=>{});return failure('ALBUM_FULL','앨범이 가득 차 기기 저장으로 바꾸지 못했어요. 이번 실행의 사진은 그대로 남아 있어요.','session');}
      const saved={...temporary,localStatus:'device'};await request(store.put(saved));await completion;session.delete(id);status={mode:'device',message:'임시 사진을 같은 이름과 촬영 정보로 이 기기에 보관했어요.'};return {ok:true,photo:metadata(saved),...status};
    }catch(error){return failure(error?.name==='QuotaExceededError'?'ALBUM_QUOTA':'ALBUM_WRITE','기기에 보관하지 못했어요. 이번 실행의 사진은 그대로 남아 있으니 PNG로도 저장해 주세요.','session');}
  }
  async function retry(){db?.close();db=null;dbPromise=null;const connection=await open();return {ok:!!connection,...status};}
  function close(){db?.close();db=null;dbPromise=null;}
  return {list,get,add,remove,persist,retry,close,limits:{maxCount,maxBytes,maxPhotoBytes,maxSessionCount,maxSessionBytes},get status(){return {...status};}};
}
