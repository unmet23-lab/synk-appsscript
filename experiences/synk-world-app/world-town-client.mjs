import {WorldClient} from './world-client.mjs';
import {slotsForOutfit,outfitForSlots} from '../synk-world-home/wardrobe-catalog.mjs';
import {normalizeEditState} from '../synk-world-home/wardrobe-workbench.mjs';

export function confirmedAppearance(snapshot) {
  if(!snapshot?.accountId)snapshot=null;
  const owned=new Set((snapshot?.inventory||[]).map(item=>item.itemId));
  const clean=slotsForOutfit(snapshot?.avatar?.slots);
  const slots={body:owned.has(clean.body)?clean.body:'',neck:owned.has(clean.neck)?clean.neck:''};
  const dyes=normalizeEditState({slots,dyes:snapshot?.avatar?.dyes}).dyes;
  return {avatarId:'mongle',renderVersion:3,slots,dyes,outfit:outfitForSlots(slots),verified:!!snapshot?.accountId,revision:snapshot?.revision??null};
}

// The town's requests (vertical slice §14-3; the screen uses pulse·boundary since W3, presence stays for old screens).
const TOWN_OPERATIONS=Object.freeze(['state','command','presence','pulse','boundary']);

// Same-origin iframe shares the current tab namespace, never a token in a URL.
// Broadcasts are only invalidations; the recipient re-reads authoritative state.
export async function connectTownWorld({onAppearance=()=>{},onError=()=>{},client=new WorldClient({broadcastAppearance:false})}={}) {
  if(globalThis.__SYNK_WORLD_TOWN__?.mode==='account') {
    let host;try{if(window.parent!==window&&window.parent.location.origin===location.origin)host=window.parent.SYNKWorldTownHost;}catch{}
    if(!host)throw Object.assign(Error('SYNK WORLD에서 싱크타운을 다시 열어 주세요.'),{code:'AUTH_REQUIRED',status:401});
    let disposed=false;
    const publish=value=>{if(!disposed)onAppearance(value);};
    const unsubscribe=host.subscribe(publish);
    try{await host.refresh();}catch(error){unsubscribe();throw error;}
    return {appearance:()=>disposed?confirmedAppearance(null):host.appearance(),subscribe(fn){onAppearance=fn;publish(host.appearance());return()=>{onAppearance=()=>{};};},
      async refresh(){try{const value=await host.refresh();publish(host.appearance());return value;}catch(error){if(!disposed)onError(error);return false;}},
      async request(operation,body){if(disposed)throw Object.assign(Error('AUTH_REQUIRED'),{code:'AUTH_REQUIRED',status:401});try{return await host.request(operation,body);}catch(error){if(!disposed&&(error.status===401||['ACCOUNT_CHANGED','AUTH_REQUIRED','ACCOUNT_MISMATCH'].includes(error.code)))onError(error);throw error;}},
      // 첫 장면 배치(학습·개인화 다리 §4-3): 타운이 첫 대화 전에 묻는다 — placement().ask면 내 마스코트가 「처음 이야기는 이 말로 해 볼까요?」.
      placement(){if(disposed)throw Object.assign(Error('AUTH_REQUIRED'),{code:'AUTH_REQUIRED',status:401});return host.placement?.()||{suggested:{reading:'L1',listening:'L1'},chosen:null,ask:false};},
      async choosePlacement(answer){if(disposed||typeof host.choosePlacement!=='function')throw Object.assign(Error('AUTH_REQUIRED'),{code:'AUTH_REQUIRED',status:401});return host.choosePlacement(answer);},
      dispose(){disposed=true;unsubscribe();}};
  }
  let disposed=false,ended=false,refreshing=null,refreshAgain=false,channel=null,authGeneration=0;
  const entryTab=client.tabId;
  const authError=()=>Object.assign(Error('SYNK WORLD에서 다시 로그인한 뒤 싱크타운을 열어 주세요.'),{code:'AUTH_REQUIRED',status:401});
  const publish=()=>{if(!disposed)onAppearance(confirmedAppearance(ended?null:client.snapshot));};
  function endSession(error=authError()){
    if(ended||disposed)return;ended=true;authGeneration++;client.generation++;client.snapshot=null;client.accessToken=null;publish();onError(error);
  }
  function sessionValid(){
    if(disposed||ended)return false;
    try{
      // A town visit is bound to its entry identity. It must never silently move
      // an in-progress command or old world state into a newly selected account.
      const tab=client.tabStorage?.getItem('synk-world-v1-tab');
      if(client.tabStorage?.getItem('synk-world-v1-signed-out')||(tab&&tab!==entryTab)){endSession();return false;}
    }catch{endSession();return false;}
    return true;
  }
  async function sync() {
    if(!sessionValid())return false;
    if(refreshing){refreshAgain=true;return refreshing;}
    refreshing=Promise.resolve().then(async()=>{
      do{
        refreshAgain=false;const generation=authGeneration;
        try{
          if(client.snapshot)await client.refresh();else await client.restore();
          if(!sessionValid()||generation!==authGeneration)return false;
          publish();
        }catch(error){if(!disposed&&!ended){if(error.status===401)endSession(error);else onError(error);}return false;}
      }while(refreshAgain&&sessionValid());
      return !!client.snapshot;
    }).finally(()=>{refreshing=null;});return refreshing;
  }
  await sync();
  if(!client.snapshot)throw Object.assign(Error('먼저 홈에서 테스트 계정으로 연결해 주세요.'),{code:'AUTH_REQUIRED'});
  if(typeof BroadcastChannel!=='undefined'){
    channel=new BroadcastChannel('synk-world-appearance-v1');channel.onmessage=event=>{if(event.data?.type==='refresh')sync();};
  }
  const foreground=()=>{if(!document.hidden)sync();};document.addEventListener('visibilitychange',foreground);
  return {
    appearance:()=>confirmedAppearance(ended||disposed?null:client.snapshot),
    subscribe(fn){onAppearance=fn;publish();return()=>{onAppearance=()=>{};};},
    refresh:sync,
    async request(operation,body){
      if(!sessionValid()||!client.snapshot)throw authError();
      if(!TOWN_OPERATIONS.includes(operation))throw Error('Unknown town operation');
      const generation=authGeneration;
      try{
        const result=await client.request(`town/${operation}`,body?{method:'POST',body}:{method:'GET'});
        if(!sessionValid()||generation!==authGeneration)throw authError();
        return result;
      }catch(error){if(error.status===401)endSession(error);throw error;}
    },
    dispose(){if(disposed)return;disposed=true;authGeneration++;client.generation++;client.accessToken=null;client.snapshot=null;channel?.close();document.removeEventListener('visibilitychange',foreground);}
  };
}

// placement: 첫 장면 배치의 재료(app-shell이 계정 묶음의 worldTownCheck로 채운다) — {chosen: 입장 조회가 돌려준 고른 값,
// suggest(): 자리별 제안 {reading, listening}, ask({suggested,chosen}), choose(suggested,answer)}. 없으면(미리 보기) 묻지 않는다.
export function createTownWorldHost(client,{placement=null}={}) {
  const owner=client.snapshot?.accountId,generation=client.generation;
  let chosen=placement?.chosen??null;
  if(!owner)throw Object.assign(Error('AUTH_REQUIRED'),{code:'AUTH_REQUIRED',status:401});
  const listeners=new Set();let ended=false;
  const guard=()=>{if(ended||client.generation!==generation||client.snapshot?.accountId!==owner)throw Object.assign(Error('로그인한 계정이 바뀌었어요. SYNK WORLD에서 싱크타운을 다시 열어 주세요.'),{code:'ACCOUNT_CHANGED',status:401});};
  const appearance=()=>confirmedAppearance(ended||client.generation!==generation?null:client.snapshot);
  const publish=()=>{for(const fn of listeners)fn(appearance());};
  const notify=()=>{if(client.generation!==generation){ended=true;publish();}else publish();};
  globalThis.addEventListener?.('synk-world-session',notify);
  return Object.freeze({appearance,subscribe(fn){listeners.add(fn);fn(appearance());return()=>listeners.delete(fn);},
    async refresh(){guard();const result=await client.refresh();guard();publish();return result;},
    async request(operation,body){guard();if(!TOWN_OPERATIONS.includes(operation))throw new TypeError('Unknown town operation');const result=await client.request(`town/${operation}`,body?{method:'POST',body}:{method:'GET'});guard();return result;},
    placement(){guard();if(!placement)return {suggested:{reading:'L1',listening:'L1'},chosen,ask:false};const {reading,listening}=placement.suggest();const suggested={reading,listening};return {suggested,chosen,ask:placement.ask({suggested,chosen})};},
    // answer: 'keep'(이대로) · 'easier'(더 쉬운 말로 — 두 자리 모두 한 단계 아래). 고른 값은 서버(town/placement)에 남고 입장 조회가 돌려준다.
    async choosePlacement(answer){guard();if(!placement)throw new TypeError('Town placement unavailable');const {reading,listening}=placement.suggest(),suggested={reading,listening};
      const result=await client.request('town/placement',{method:'POST',body:{...placement.choose(suggested,answer),suggested}});guard();chosen=result.placement;return chosen;},
    dispose(){ended=true;publish();listeners.clear();globalThis.removeEventListener?.('synk-world-session',notify);}});
}
