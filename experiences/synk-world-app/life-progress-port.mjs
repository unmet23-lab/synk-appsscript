import {createWorldPlayHost} from '../play-common/account-host.mjs';
const LIFE_PROGRESS_KEY='synk.life-korean.progress.v1';

// Reuse the authenticated PlayHost contract for both official WORLD accounts and
// isolated rehearsal transports. Only this curriculum's record crosses the port.
export async function createLifeProgressPort({accountId:id,client,guard,storage:cache=globalThis.localStorage,onStatus=()=>{},target=globalThis,onDispose=()=>{}}={}){
 if(typeof id!=='string'||!id||typeof guard!=='function')throw TypeError('Verified life progress owner required');
 let disposed=false;
 const check=()=>{guard();if(disposed)throw Object.assign(Error('이 계정의 생활 한국어 연결이 끝났어요.'),{code:'ACCOUNT_CHANGED'});};
  const resolvedKey=`${LIFE_PROGRESS_KEY}:resolved:${encodeURIComponent(id)}`;
  function recoveredEntries(){
   check();const prefix=`synk.play.account.v1:${encodeURIComponent(id)}:rejected:`,entries=[];let resolved=[];
   try{resolved=JSON.parse(cache.getItem(resolvedKey)||'[]');if(!Array.isArray(resolved))throw Error();}catch{throw Object.assign(Error('진도 복구 선택을 읽지 못했어요. 원본은 보존했어요.'),{code:'LIFE_PROGRESS_UNREADABLE'});}
   for(let index=0;index<cache.length;index++){const recordKey=cache.key(index);if(!recordKey?.startsWith(prefix))continue;
    let record;try{record=JSON.parse(cache.getItem(recordKey));}catch{throw Object.assign(Error('생활 진도 원본을 읽지 못했어요.'),{code:'LIFE_PROGRESS_UNREADABLE'});}
    if(record.accountId!==id||recordKey!==prefix+record.entry?.body?.id)throw Object.assign(Error('생활 진도 원본의 계정을 확인하지 못했어요.'),{code:'LIFE_PROGRESS_UNREADABLE'});
    if(resolved.includes(record.entry.body.id))continue;
    const change=record.entry.body.action==='progress'&&record.entry.body.changes.find(change=>change.key===LIFE_PROGRESS_KEY);
    if(change)entries.push({...record,change});
   }
   return entries.sort((a,b)=>a.entry.at-b.entry.at||a.entry.body.id.localeCompare(b.entry.body.id));
  }
  function lifeStatus(){
   const value=host.status(),prefix=`synk.play.account.v1:${encodeURIComponent(id)}:`;let pending=0,rejected=0,code;
   if(disposed)return {...value,phase:'stopped',pending:0,rejected:0,message:'이 계정의 생활 한국어 연결이 끝났어요.'};
   // A rejected command from another game must not relabel this lesson. Equally,
   // a rejected life record must never look saved merely because the host loaded.
   for(let index=0;index<cache.length;index++){const recordKey=cache.key(index);if(!recordKey?.startsWith(prefix))continue;
    try{const record=JSON.parse(cache.getItem(recordKey)),body=record.entry?.body||record.body;
     if(body?.action!=='progress'||!body.changes?.some(change=>change.key===LIFE_PROGRESS_KEY))continue;
     if(recordKey.startsWith(prefix+'pending:'))pending++;
    }catch{/* Host reports unreadable records separately. */}
   }
   try{const entries=recoveredEntries(),current=host.snapshot().state.records[LIFE_PROGRESS_KEY]??null;if(entries.length&&entries.at(-1).change.value!==current){rejected=entries.length;code=entries.at(-1).code;}}
   catch(error){code=error.code;return {...value,pending,rejected:1,phase:'unreadable',code,message:'생활 한국어 진도 원본을 읽지 못했어요. 기존 기록은 보존했어요.'};}
   return {...value,pending,rejected,...(rejected?{phase:'unsaved',code,message:'생활 한국어 진도는 아직 SYNK 계정에 저장되지 않았어요. 원본을 이 기기에 보관했어요.'}:value.phase==='synced'?{message:'생활 한국어 진도가 SYNK 계정에 저장됐어요.'}:{})};
  }
  const host=createWorldPlayHost({accountId:id,client,guard:check,storage:cache,locks:target.navigator?.locks,
   onStatus:()=>{try{onStatus(lifeStatus());}catch{/* Views cannot change ownership. */}}});
  const gameStorage=host.storage();
  const onlyLife=key=>{check();if(key!==LIFE_PROGRESS_KEY)throw new TypeError('Only life-Korean progress is available');};
  const port=Object.freeze({accountId:id,guard:check,
   storage:Object.freeze({getItem(key){onlyLife(key);const value=gameStorage.getItem(key),entries=recoveredEntries();if(entries.length&&entries.at(-1).change.value!==value)throw Object.assign(Error('이 기기에 보존된 생활 진도가 있어요. 사용할 기록을 선택해 주세요.'),{code:'LIFE_PROGRESS_REJECTED'});return value;},setItem(key,value){onlyLife(key);gameStorage.setItem(key,value);},removeItem(key){onlyLife(key);gameStorage.removeItem(key);}}),
   status:lifeStatus,async flush(){check();await host.flush();check();return lifeStatus();},async retry(){check();await host.retry();check();return lifeStatus();},
   recoverySnapshot(){check();const value=recoveredEntries().at(-1)?.change.value;if(value===undefined||value===null)return null;try{return JSON.parse(value);}catch{throw Object.assign(Error('생활 진도 원본을 읽지 못했어요.'),{code:'LIFE_PROGRESS_UNREADABLE'});}},
   async resolve(choice){
    check();if(!['local','remote'].includes(choice))throw new TypeError('Invalid life progress choice');
    if(host.status().phase==='conflict'){await host.resolve(choice);check();return lifeStatus();}
    const entries=recoveredEntries();if(!entries.length)return lifeStatus();
    if(choice==='local'){gameStorage.getItem(LIFE_PROGRESS_KEY);const value=entries.at(-1).change.value;value===null?gameStorage.removeItem(LIFE_PROGRESS_KEY):gameStorage.setItem(LIFE_PROGRESS_KEY,value);await host.flush();check();if(lifeStatus().rejected)return lifeStatus();}
    const resolved=JSON.parse(cache.getItem(resolvedKey)||'[]');cache.setItem(resolvedKey,JSON.stringify([...new Set([...resolved,...entries.map(record=>record.entry.body.id)])]));return lifeStatus();
   },
   subscribe:fn=>host.subscribe(()=>fn(lifeStatus())),dispose(){if(disposed)return;disposed=true;host.stop();onDispose(port);}});
  try{await host.ready();check();return port;}
  catch(error){if(error.code==='REVISION_CONFLICT'){check();return port;}port.dispose();throw error;}
 }