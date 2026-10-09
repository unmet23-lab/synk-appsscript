import {PLAY_SCOPE,PLAY_WALLET_KEY,emptyPlayState,validatePlayState,validatePlayValue,isPlayRecordKey,readLegacyPlay} from './play-data.mjs';

const error=(code,message)=>Object.assign(new Error(message||code),{code});
const clone=value=>JSON.parse(JSON.stringify(value));
const terminal=new Set(['UNAUTHORIZED','AUTH_REQUIRED','AUTH_SESSION_MISSING','SESSION_REVOKED','ACCOUNT_UNAVAILABLE','PRODUCT_FORBIDDEN','PLAY_ACCOUNT_MISMATCH','ACCOUNT_CHANGED','PLAY_SESSION_ENDED']);
// Only explicit command rejection is final. Network, capacity, authorization and
// conflicting progress failures must retain their retry/choice semantics.
const rejectedCommands=new Set(['INVALID_PLAY_COMMAND','INVALID_PLAY_REQUEST','INVALID_JSON','JSON_REQUIRED','PAYLOAD_TOO_LARGE','PLAY_DATA_TOO_LARGE','COMMAND_ID_CONFLICT']);
/** Authenticated WORLD owns this host; iframe games receive methods, never credentials. */
export function createWorldPlayHost({accountId,client,guard,onStatus=()=>{},storage=globalThis.localStorage,locks=globalThis.navigator?.locks,uuid=()=>crypto.randomUUID(),now=Date.now}){
  if(typeof accountId!=='string'||!accountId||typeof guard!=='function'||typeof client?.load!=='function'||typeof client?.mutate!=='function')throw TypeError('Verified WORLD play account required');
  const prefix=`synk.play.account.v1:${encodeURIComponent(accountId)}:pending:`,rejectedPrefix=`synk.play.account.v1:${encodeURIComponent(accountId)}:rejected:`,listeners=new Set(),waitingWallets=new Map();
  let stopped=false,loaded=false,revision=0,state=emptyPlayState(),phase='loading',lastError=null,inflight=null,timer=null,initial=null;
  function check(){guard();if(stopped)throw error('PLAY_SESSION_ENDED','이 계정의 게임 연결이 종료됐어요.');}
  function pending(){
    check();const result=[];
    for(let i=0;i<storage.length;i++){const key=storage.key(i);if(!key?.startsWith(prefix))continue;
      let value;try{value=JSON.parse(storage.getItem(key));}catch{throw error('PLAY_PENDING_UNREADABLE','전송 대기 기록을 확인하지 못했어요. 원본을 보존했어요.');}
      if(value?.accountId!==accountId||key!==prefix+value?.body?.id||!Number.isSafeInteger(value.at))throw error('PLAY_PENDING_UNREADABLE');
      result.push(value);
    }
    return result.sort((a,b)=>a.at-b.at||a.body.id.localeCompare(b.body.id));
  }
  function legacy(){try{return readLegacyPlay(storage);}catch{return null;}}
  function hasLegacy(){const old=legacy();return !!old&&(Object.keys(old.records).length>0||old.wallet.totalEarned>0||old.wallet.owned.length>emptyPlayState().wallet.owned.length);}
  function rejectionCount(){let count=0;for(let i=0;i<storage.length;i++)if(storage.key(i)?.startsWith(rejectedPrefix))count++;return count;}
  function rejectedError(id){const raw=storage.getItem(rejectedPrefix+id);if(!raw)return null;const value=JSON.parse(raw);if(value.accountId!==accountId||value.entry?.body?.id!==id||!rejectedCommands.has(value.code))throw error('PLAY_PENDING_UNREADABLE');return Object.assign(error(value.code,'이 요청은 계정에서 처리하지 못했어요. 원본은 이 기기에 보관했고 다른 게임은 계속할 수 있어요.'),{rejected:true});}
  function preserveRejected(entry,cause){
    check();const saved={accountId,at:now(),code:cause.code,entry};
    // Persist the complete rejected command before removing it from the outbox.
    // A full disk must leave the original command available for recovery.
    try{storage.setItem(rejectedPrefix+entry.body.id,JSON.stringify(saved));storage.removeItem(prefix+entry.body.id);}
    catch{throw error('PLAY_STORAGE_UNAVAILABLE','처리하지 못한 기록의 원본을 보관할 공간이 없어요. 전송 대기 기록은 유지했어요.');}
    const rejected=rejectedError(entry.body.id);if(waitingWallets.has(entry.body.id))waitingWallets.set(entry.body.id,{rejected});
  }
  function status(){let count=0,rejected=0;try{count=pending().length;rejected=rejectionCount();}catch{}return {accountId,phase,pending:count,rejected,revision,canImport:loaded&&revision===0&&hasLegacy(),message:phase==='synced'?rejected?`계정에 연결됐어요. 처리하지 못한 요청 ${rejected}개의 원본은 이 기기에 보관했어요. 다른 기록은 계속 저장돼요.`:'게임 기록과 구매품이 SYNK 계정에 저장됐어요.':phase==='loading'?'계정의 게임 기록을 불러오고 있어요.':phase==='saving'?'계정에 게임 기록을 저장하고 있어요.':phase==='conflict'?'다른 기기에서도 진도가 바뀌었어요. 사용할 진도를 골라 주세요.':phase==='stopped'?'계정 연결이 종료됐어요.':lastError?.message||'아직 계정에 저장하지 못했어요. 다시 연결하면 재시도해요.',code:lastError?.code};}
  function emit(next,reason=null){phase=next;lastError=reason;const value=status();onStatus(value);for(const fn of listeners)try{fn(value);}catch{}return value;}
  function accept(value){
    check();if(value?.ok!==true||value.scope!==PLAY_SCOPE||value.accountId!==accountId||!Number.isSafeInteger(value.revision)||value.revision<0)throw error('PLAY_ACCOUNT_MISMATCH','계정에서 받은 게임 기록을 확인하지 못했어요.');
    // A late read must never roll the confirmed wallet back.
    if(value.revision>=revision){state=validatePlayState(value.state);revision=value.revision;}loaded=true;return value;
  }
  function reportFailure(cause){
    if(stopped)return;
    const next=terminal.has(cause.code)?'stopped':['REVISION_CONFLICT','IMPORT_CONFLICT'].includes(cause.code)?'conflict':'offline';
    if(next==='stopped'){stopped=true;clearTimeout(timer);}
    if(phase!==next||lastError!==cause)emit(next,cause);
  }
  async function receive(request){try{return accept(await request());}catch(cause){reportFailure(cause);throw cause;}}
  function records(){const result={...state.records};for(const entry of pending())if(entry.body.action==='progress')for(const change of entry.body.changes){if(change.value===null)delete result[change.key];else result[change.key]=change.value;}return result;}
  function queue(body){check();try{const entry={accountId,at:pending().reduce((at,x)=>Math.max(at,x.at+1),now()),body:{...body,id:body.id||uuid()}};storage.setItem(prefix+entry.body.id,JSON.stringify(entry));return entry;}catch(cause){emit('offline',error('PLAY_STORAGE_UNAVAILABLE','이 기기에 전송 대기 기록을 보관하지 못했어요. 저장 공간을 확인해 주세요.'));throw cause;}}
  const serial=task=>locks?.request?locks.request(`synk-play-account:${accountId}`,task):task();
  async function flush(){
    check();if(inflight)return inflight;
    inflight=serial(async()=>{
      check();if(!loaded)await receive(()=>client.load());check();let last;
      while(pending().length){const entry=pending()[0];
        check();emit('saving');let response;
        try{response=await client.mutate(entry.body);}
        catch(cause){check();if(!rejectedCommands.has(cause.code))throw cause;preserveRejected(entry,cause);continue;}
        // A malformed acknowledgement may follow a successful commit. Never
        // quarantine it as if the command itself had been rejected.
        last=accept(response);check();
        if(waitingWallets.has(entry.body.id))waitingWallets.set(entry.body.id,last);
        storage.removeItem(prefix+entry.body.id);
      }
      emit('synced');return last;
    }).catch(cause=>{reportFailure(cause);throw cause;}).finally(()=>{inflight=null;});
    return inflight;
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(()=>{void flush().catch(()=>{});},250);emit('saving');}
  function createGameStorage(){const observed=new Map();return Object.freeze({
    get length(){check();if(!loaded)throw error('PLAY_NOT_READY');return Object.keys(records()).length+1;},
    key(index){check();return [PLAY_WALLET_KEY,...Object.keys(records())][index]??null;},
    getItem(key){check();if(!loaded)throw error('PLAY_NOT_READY');if(key===PLAY_WALLET_KEY)return JSON.stringify(state.wallet);if(!isPlayRecordKey(key))throw error('INVALID_PLAY_KEY');const value=records()[key]??null;observed.set(key,value);return value;},
    setItem(key,value){check();if(!loaded)throw error('PLAY_NOT_READY');if(phase==='conflict')throw error('REVISION_CONFLICT');validatePlayValue(key,value);const previous=observed.has(key)?observed.get(key):records()[key]??null;if(previous===value)return;queue({action:'progress',changes:[{key,previous,value}]});observed.set(key,value);schedule();},
    removeItem(key){check();if(!loaded||!isPlayRecordKey(key))throw error('INVALID_PLAY_KEY');if(phase==='conflict')throw error('REVISION_CONFLICT');const previous=observed.has(key)?observed.get(key):records()[key]??null;if(previous===null)return;queue({action:'progress',changes:[{key,previous,value:null}]});observed.set(key,null);schedule();}
  });}
  async function ready(){check();if(phase==='conflict')throw error('REVISION_CONFLICT',status().message);if(loaded)return status();if(!initial)initial=retry().catch(cause=>{initial=null;throw cause;});return initial;}
  async function retry(){check();clearTimeout(timer);await flush();check();await receive(()=>client.load());check();emit(pending().length?'saving':'synced');return status();}
  async function wallet(method,args=[]){
    if(!loaded)await ready();check();if(phase==='conflict')throw error('REVISION_CONFLICT',status().message);
    // Persist the command before its first send. Lost acknowledgements retry the same id.
    const entry=queue({action:'wallet',method,args:clone(args)});waitingWallets.set(entry.body.id,null);emit('saving');
    try{
      // A later queued command can fail after this purchase already received its
      // acknowledgement. Preserve that purchase result and the remaining error state.
      try{await flush();}catch(cause){if(!waitingWallets.get(entry.body.id))throw cause;}
      check();let response=waitingWallets.get(entry.body.id);
      if(response?.rejected)throw response.rejected;
      if(!response){
        const rejected=rejectedError(entry.body.id);if(rejected)throw rejected;
        // Only another same-origin host can finish our outbox without this host
        // seeing the receipt. Query that same id; never create a second purchase.
        response=await receive(()=>client.mutate(entry.body));check();storage.removeItem(prefix+entry.body.id);
        emit(pending().length?'saving':'synced');
      }
      return {...response.result,state:clone(state.wallet),saved:true};
    }catch(cause){if(!rejectedCommands.has(cause.code)||!storage.getItem(rejectedPrefix+entry.body.id))reportFailure(cause);throw cause;}
    finally{waitingWallets.delete(entry.body.id);}
  }
  async function importLegacy(){await ready();check();if(revision!==0)throw error('PLAY_IMPORT_EXISTS','계정에 이미 게임 기록이 있어요. 기존 기록은 합치지 않았어요.');const old=legacy();if(!old)throw error('INVALID_PLAY_STATE');queue({action:'import',expected_revision:0,state:{wallet:old.wallet,records:old.records}});await flush();return status();}
  async function resolve(choice){
    check();if(!['remote','local'].includes(choice))throw error('INVALID_RESOLUTION');if(inflight)await inflight.catch(()=>{});check();
    const entries=pending(),desired=records();await receive(()=>client.load());check();
    // Wallet commands always retain their id and server authority. Only conflicting
    // progress drafts are chosen, and old records remain available in an explicit backup.
    const imports=entries.filter(x=>x.body.action==='import');if(imports.length&&choice==='local')throw error('IMPORT_CONFLICT','계정에 이미 게임 기록이 있어요. 계정 기록을 선택해 주세요.');
    const drafts=entries.filter(x=>x.body.action==='progress'||x.body.action==='import');
    if(drafts.length)storage.setItem(`synk.play.account.v1:${encodeURIComponent(accountId)}:recovery:${uuid()}`,JSON.stringify({accountId,at:now(),drafts}));
    for(const entry of drafts)storage.removeItem(prefix+entry.body.id);
    if(choice==='local'){
      const keys=new Set(drafts.flatMap(x=>x.body.changes.map(c=>c.key)));
      for(const key of keys){const previous=state.records[key]??null,value=desired[key]??null;if(previous!==value)queue({action:'progress',changes:[{key,previous,value}]});}
    }
    await flush();return status();
  }
  const api=Object.freeze({ready,retry,flush,wallet,importLegacy,resolve,hasLegacy,status,storage:()=>{check();return createGameStorage();},subscribe(fn){check();listeners.add(fn);fn(status());return()=>listeners.delete(fn);},stop(){if(stopped)return;stopped=true;clearTimeout(timer);emit('stopped');listeners.clear();},snapshot(){check();return {accountId,revision,state:clone({...state,records:records()})};}});
  return api;
}
