import {WorldClient} from './world-client.mjs';

export function confirmedAppearance(snapshot) {
  if(!snapshot?.accountId)snapshot=null;
  const owned=new Set((snapshot?.inventory||[]).map(item=>item.itemId));
  const body=snapshot?.avatar?.slots?.body==='mongle-apron-starter'&&owned.has('mongle-apron-starter')?'mongle-apron-starter':'';
  const neck=snapshot?.avatar?.slots?.neck==='mongle-scarf-first-steps'&&owned.has('mongle-scarf-first-steps')?'mongle-scarf-first-steps':'';
  return {avatarId:'mongle',renderVersion:3,slots:{body,neck},outfit:body&&neck?'scarf-apron':body?'apron':neck?'scarf':'none',verified:!!snapshot?.accountId,revision:snapshot?.revision??null};
}

// Same-origin iframe shares the current tab namespace, never a token in a URL.
// Broadcasts are only invalidations; the recipient re-reads authoritative state.
export async function connectTownWorld({onAppearance=()=>{},onError=()=>{},client=new WorldClient({broadcastAppearance:false})}={}) {
  let disposed=false,ended=false,refreshing=null,refreshAgain=false,channel=null,authGeneration=0;
  const entryTab=client.tabId;
  const authError=()=>Object.assign(Error('홈에서 계정을 다시 연결한 뒤 동네를 열어 주세요.'),{code:'AUTH_REQUIRED',status:401});
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
      if(!['state','command','presence'].includes(operation))throw Error('Unknown town operation');
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
