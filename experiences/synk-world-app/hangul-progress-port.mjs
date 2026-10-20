import {createWorldPlayHost} from '../play-common/account-host.mjs';
export const HANGUL_PROGRESS_KEY='synk.hangul-stage.v1';

// Same account store/outbox/CAS as every WORLD game. Only this one record is
// exposed to the sign-in migration prompt; no token or general storage port.
export async function createHangulProgressPort({accountId,client,guard,storage=globalThis.localStorage,target=globalThis}){
 const host=createWorldPlayHost({accountId,client,guard,storage,locks:target.navigator?.locks});
 const records=host.storage();
 try{await host.ready();}catch(error){host.stop();throw error;}
 return Object.freeze({
  accountId,
  read(){guard();return records.getItem(HANGUL_PROGRESS_KEY);},
  status:host.status,
  async importSnapshot(raw){
   guard();
   const current=records.getItem(HANGUL_PROGRESS_KEY);
   // A failed/lost acknowledgement leaves the same draft in the shared outbox.
   // Retry that immutable command; a local pending value is not a cloud receipt.
   if(current!==null&&!(current===raw&&host.status().pending))return 'exists';
   if(current===null)records.setItem(HANGUL_PROGRESS_KEY,raw);
   await host.flush();guard();
   const status=host.status(),saved=host.snapshot().state.records[HANGUL_PROGRESS_KEY];
   if(status.phase!=='synced'||status.pending||saved!==raw)throw Object.assign(Error('한글 진도 계정 저장을 확인하지 못했어요.'),{code:'HANGUL_NOT_SAVED'});
   return 'moved';
  },
  dispose:host.stop,
 });
}
