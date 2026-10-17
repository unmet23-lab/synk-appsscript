import Core from './generated/member-activity.mjs';
import { emptyMemberActivity, validateMemberActivity, pruneMemberActivity, updateMemberActivity, MEMBER_ACTIVITY_APP_IDS } from './generated/member-activity-data.mjs';

// Only authorized launcher metadata lives here, in RAM. The existing account
// host owns credentials; the existing personal document owns persistence/CAS.
export function createMemberActivity({getIdentity, request, getFavorites=()=>[], now=Date.now, uuid=()=>crypto.randomUUID(), timeoutMs=12000}={}) {
  let binding='', epoch=0, queue=Promise.resolve(), stopped=false, blocked=false, intent=0;
  let document=null, revision=0, status='unavailable', pending=0;
  const listeners=new Set();
  const identity=()=>{const v=getIdentity?.()||{};return {...v,accountId:v.accountId||v.account?.synk_user_id};};
  const key=v=>JSON.stringify([v.status,v.signedIn,v.accountId,v.sessionGeneration]);
  const signed=v=>v.status==='signed-in'&&v.signedIn===true&&typeof v.accountId==='string'&&!!v.accountId;
  function sync(){const v=identity(), k=key(v);if(k!==binding){binding=k;epoch++;queue=Promise.resolve();document=null;revision=0;status=signed(v)?'loading':'unavailable';pending=0;blocked=false;}return v;}
  function read(){sync();try{return {status,pending:pending>0,activity:document?Core.summarizeMemberActivity({document:blocked?emptyMemberActivity():document,asOf:new Date(now()).toISOString()}):null};}catch{return {status:'error',pending:pending>0,activity:null};}}
  function emit(){if(!stopped){const value=read();for(const fn of listeners)fn(value);}}
  const valid=(owner,token)=>!stopped&&token===epoch&&owner===key(identity())&&signed(identity());
  async function call(operation,params,owner,token){
    let timer;
    try{
      if(!valid(owner,token))throw new Error('changed');
      const raw=await Promise.race([Promise.resolve().then(()=>{if(!valid(owner,token))throw new Error('changed');return request(operation,params);}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('timeout')),timeoutMs);})]);
      if(!valid(owner,token))throw new Error('changed');
      if(raw?.ok===false)throw Object.assign(new Error('request'),raw.error||{});
      const value=raw?.data||raw;
      if(value?.ok!==true||value.scope!=='synk-personal'||value.resource!=='member-insight'||value.accountId!==identity().accountId||!Number.isSafeInteger(value.revision)||value.revision<0)throw new Error('response');
      return {document:value.state===null?emptyMemberActivity():validateMemberActivity(value.state,{now:now()}),revision:value.revision};
    }finally{clearTimeout(timer);}
  }
  async function load(owner,token){const value=await call('insightLoad',{},owner,token);document=value.document;revision=value.revision;status='ready';return value;}
  function enqueue(work,{mutation=false}={}){
    const account=sync();if(stopped||!signed(account))return Promise.resolve(read());
    const owner=binding,token=epoch;if(mutation)pending++;
    const job=queue.then(async()=>{
      if(!valid(owner,token))return read();
      try{await work(owner,token);}catch{if(valid(owner,token)){document=null;status='error';}}
      finally{if(valid(owner,token)){if(mutation)pending--;emit();}}
      return read();
    });queue=job.catch(()=>{});if(mutation)emit();return job;
  }
  function mutate(action){
    const at=now(), requestedIntent=intent;
    return enqueue(async(owner,token)=>{
      // Re-read before every write: another device may have revoked consent.
      for(let attempt=0;attempt<2;attempt++){
        await load(owner,token);
        if(action.type!=='consent'&&(blocked||!document.consent||Date.parse(document.enabledAt)>at))return;
        const source=action.type==='consent'&&!action.value?document:pruneMemberActivity(document,now());
        let next=updateMemberActivity(source,action,now());
        // Preserve the actual launch time without pruning newer events that
        // arrived from another device while this mutation waited in the queue.
        if(action.type==='launch'&&!document.events.some(event=>event.id===action.id.toLowerCase()))next.events.find(event=>event.id===action.id.toLowerCase()).at=new Date(at).toISOString();
        if(action.type==='consent'&&action.value)next=updateMemberActivity(next,{type:'favorites',value:[...new Set(getFavorites().filter(id=>MEMBER_ACTIVITY_APP_IDS.includes(id)))]},now());
        // Even an already-off consent must advance CAS: a timed-out older save
        // may still be in flight at the server and must not revive collection.
        if(action.type!=='consent'&&JSON.stringify(next)===JSON.stringify(document))return;
        try{
          const saved=await call('insightSave',{state:next,expected_revision:revision},owner,token);
          document=saved.document;revision=saved.revision;status='ready';
          // The acknowledged document now owns consent. Keep the temporary
          // local block only while withdrawal is pending/failed, so a later
          // explicit activation on another device can appear on a fresh read.
          if(action.type==='consent'&&requestedIntent===intent)blocked=false;
          return;
        }catch(error){if(attempt===0&&['REVISION_CONFLICT','PERSONAL_REVISION_CONFLICT'].includes(error.code))continue;throw error;}
      }
    },{mutation:true});
  }
  return Object.freeze({read,subscribe(fn){listeners.add(fn);return ()=>listeners.delete(fn);},
    refresh:()=>enqueue((owner,token)=>load(owner,token)),
    setConsent(value){if(typeof value!=='boolean')return Promise.resolve(read());sync();intent++;if(!value){blocked=true;emit();}return mutate({type:'consent',value});},
    trackLaunch(appId){if(!MEMBER_ACTIVITY_APP_IDS.includes(appId))return Promise.resolve(read());return mutate({type:'launch',id:uuid(),appId});},
    syncFavorites(){return mutate({type:'favorites',value:[...new Set(getFavorites().filter(id=>MEMBER_ACTIVITY_APP_IDS.includes(id)))]});},
    invalidate(){epoch++;binding='';document=null;status='unavailable';pending=0;queue=Promise.resolve();},
    stop(){stopped=true;epoch++;document=null;listeners.clear();},
  });
}
