// A single-account CAS snapshot over the existing learning-consent transport.
// No automatic history merge: Study's sequential event IDs belong to the saved snapshot.
const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
// Match the server's minimized progress contract. Semantic prompts/choices and
// local planning detail may grow independently; they never join the sync payload.
const observationFields={
 write:['itemId','support','same','plain','off','total','formal','polite','flags','axes','verdict','unknown','linked','first','mode','pasted','source'],
 sort:['card','bin','ok','use'],form:['id','axis','use','ok'],find:['id','ok'],change:['ok'],
 method:['method'],probe:['probe'],cycle:[],semantic:['stage','skill','source','result']
};
const planFields=['scene','why','method','probe','mode','source','skill','stage','hypothesis','itemId','support'];
const eventFields={
 'decision.made':['plan'],
 'practice.presented':['decisionId','taskId','taskVersion','itemKey','conceptIds','firstExposure'],
 'practice.attempted':['presentationId','attemptNo','verdict','errorTags','choice'],
 'practice.helped':['presentationId','helpId','level','contentRef']
};
function pickFields(value,keys){
 if(!value||typeof value!=='object'||Array.isArray(value))return structuredClone(value);
 return Object.fromEntries(keys.filter(key=>Object.hasOwn(value,key)).map(key=>[key,structuredClone(value[key])]));
}
function progressEvent(event){
 const row=pickFields(event,['id','type','scope','at','recordedAt',...(event.type==='decision.made'?[]:['schema']),...(eventFields[event.type]||[])]);
 if(Object.hasOwn(row,'scope'))row.scope=pickFields(row.scope,['domain','workspace','subject']);
 if(Object.hasOwn(row,'plan'))row.plan=pickFields(row.plan,planFields);
 if(Object.hasOwn(row,'choice'))row.choice=pickFields(row.choice,['selectedId','correctId']);
 return row;
}
export function progressSnapshot(state){
 const snapshot=pickFields(state,['v','seq','seen','recentCards']);
 snapshot.obs=state.obs.map(o=>pickFields(o,['at','kind','n','ev',...(observationFields[o.kind]||[])]));
 snapshot.trail=state.trail.map(progressEvent);
 return snapshot;
}
const hasHistory=s=>!!s&&(s.obs?.length>0||s.trail?.length>0||Object.keys(s.seen||{}).length>0);
const error=code=>Object.assign(Error(code),{code});
export function createProgressSync({transport,storage,key,read,apply,guard=()=>{},onStatus=()=>{}}){
 let stopped=false,epoch=0,state={phase:'idle',version:null},base=null,remote=null,pending=null,started=false;
 const emit=(phase,extra={})=>{state={...state,phase,...extra};onStatus({...state});return {...state};};
 const check=ticket=>{if(stopped||ticket!==epoch)throw error('ACCOUNT_CHANGED');guard();};
 const snapshot=()=>progressSnapshot(read());
 const writeMeta=()=>storage.setItem(key,JSON.stringify({version:state.version,text:base}));
 function restore(value,retainDetails=false){
  const local=read();let restored=value;
  if(retainDetails){
   const wire=snapshot(),before=new Map(wire.trail.map(e=>[e.id,e])),after=new Map(value.trail.map(e=>[e.id,e]));
   const details=new Map(wire.obs.map((o,i)=>[canonical(o),local.obs[i]?.detail]));
   const sameEvidence=ids=>{const refs=new Set(ids);for(const id of refs){const a=before.get(id),b=after.get(id);if(!a||!b||canonical(a)!==canonical(b))return false;for(const key of ['decisionId','presentationId'])if(a[key])refs.add(a[key]);}return true;};
   restored={...value,obs:value.obs.map(o=>{const detail=details.get(canonical(o));return o.kind==='semantic'&&detail&&typeof o.ev==='string'&&sameEvidence([o.ev])?{...o,detail:structuredClone(detail)}:o;})};
  }
  apply({...restored,drafts:local.drafts,scene:null});
 }
 async function init(){
  if(stopped)return state;if(pending)return pending;
  const ticket=epoch;emit('loading');
  pending=(async()=>{try{
   const saved=await transport.get();check(ticket);
   if(!Number.isSafeInteger(saved.version)||saved.version<0||!(saved.study===null||saved.study?.v===2))throw error('INVALID_RESPONSE');
   const local=snapshot(),localText=canonical(local),serverText=saved.study?canonical(saved.study):null;
   let meta=null;try{meta=JSON.parse(storage.getItem(key)||'null');}catch{throw error('STORAGE');}
   state.version=saved.version;remote=saved.study;started=true;
   if(serverText===localText){base=serverText;writeMeta();return emit('synced');}
   if(!hasHistory(local)&&saved.study||meta?.text===localText&&saved.study){restore(saved.study,true);base=serverText;writeMeta();return emit('synced');}
   if(!saved.study||meta?.version===saved.version&&meta.text===serverText){base=serverText;writeMeta();return emit(hasHistory(local)?'pending':'synced');}
   return emit('conflict',{code:'STUDY_PROGRESS_CONFLICT'});
  }catch(e){if(!stopped&&ticket===epoch)emit('blocked',{code:e.code||'UNAVAILABLE'});return {...state};}
  finally{pending=null;}})();
  return pending;
 }
 async function flush(){
  if(stopped)return state;if(pending){await pending;if(stopped)return state;}
  if(!started){await init();if(state.phase!=='pending'&&state.phase!=='synced')return state;}
  if(['conflict','blocked','loading'].includes(state.phase))return state;
  const ticket=epoch,value=snapshot(),text=canonical(value);if(text===base)return emit('synced');
  const version=state.version;emit('saving');
  pending=(async()=>{try{
   check(ticket);const saved=await transport.post({baseVersion:version,study:value});check(ticket);
   if(!Number.isSafeInteger(saved.version)||saved.version<version||saved.version>version+1||canonical(saved.study)!==text)throw error('INVALID_RESPONSE');
   base=text;remote=saved.study;state.version=saved.version;writeMeta();return emit(canonical(snapshot())===base?'synced':'pending');
  }catch(e){if(!stopped&&ticket===epoch)emit(['STUDY_PROGRESS_CONFLICT','STUDY_HISTORY_CONFLICT'].includes(e.code)?'conflict':'blocked',{code:e.code||'UNAVAILABLE'});return {...state};}
  finally{pending=null;}})();
  return pending;
 }
 return Object.freeze({init,flush,status:()=>({...state}),
  changed(){if(stopped||['conflict','blocked','loading'].includes(state.phase))return state;return emit('pending');},
  async retry(){if(stopped)return state;started=false;const result=await init();return result.phase==='pending'?flush():result;},
  // The learner explicitly chooses to continue the server history. Preserve the whole local
  // state before replacing its active progress; a quota failure prevents the replacement.
  async useServer(){
   if(stopped||pending)return state;const ticket=epoch;emit('loading');
   pending=(async()=>{try{const saved=await transport.get();check(ticket);if(!saved.study||saved.study.v!==2||!Number.isSafeInteger(saved.version)||saved.version<0)throw error('NO_REMOTE_PROGRESS');
    const backupKey=key+'.backup.'+Date.now();storage.setItem(backupKey,JSON.stringify(read()));check(ticket);
    restore(saved.study);base=canonical(saved.study);remote=saved.study;state.version=saved.version;started=true;writeMeta();return emit('synced',{backupKey,code:null});
   }catch(e){if(!stopped&&ticket===epoch)emit('blocked',{code:e.code||'UNAVAILABLE'});return {...state};}
   finally{pending=null;}})();
   return pending;
  },
  exportLocal:()=>JSON.stringify(snapshot(),null,2),
  stop(){stopped=true;epoch++;emit('stopped');}
 });
}
