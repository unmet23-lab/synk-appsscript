import { validateAlbum } from './model.mjs';
const DB='synk-family-album-v1';
export function createStorage(indexedDB=globalThis.indexedDB){
  async function open(){if(!indexedDB)throw new Error('이 환경에서는 기기 보관을 사용할 수 없어요. 파일로 내보내 주세요.');return new Promise((resolve,reject)=>{const req=indexedDB.open(DB,1);req.onupgradeneeded=()=>req.result.createObjectStore('album');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(new Error('이 기기의 보관함을 열지 못했어요.'));req.onblocked=()=>reject(new Error('다른 앨범 창을 닫고 다시 시도해 주세요.'));});}
  async function operation(mode,action){const db=await open();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('album',mode),store=tx.objectStore('album');let result;const req=action(store);req.onsuccess=()=>{result=req.result;};tx.oncomplete=()=>resolve(result);tx.onerror=tx.onabort=()=>reject(new Error('기기 보관을 완료하지 못했어요. 공간을 확인하거나 파일로 내보내 주세요.'));});}finally{db.close();}}
  return {async load(){const v=await operation('readonly',s=>s.get('current'));return v?validateAlbum(v):null;},async save(value){const valid=validateAlbum(value);await operation('readwrite',s=>s.put(valid,'current'));},async remove(){await operation('readwrite',s=>s.delete('current'));}};
}
