// A single-account CAS snapshot over the existing learning-consent transport.
// No automatic history merge: Study's sequential event IDs belong to the saved snapshot.
const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
export function progressSnapshot(state){
 const snapshot=Object.fromEntries(['v','seq','obs','trail','seen','recentCards'].map(key=>[key,structuredClone(state[key])]));
 // 최근 AI 질문·선택지·해설 문구는 이번 글 전송 동의로만 보내며 계정 진도 저장에는 넣지 않는다.
 snapshot.obs=snapshot.obs.map(o=>{if(o.kind!=='semantic')return o;const {detail,...progress}=o;return progress;});
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
 function restore(value){const local=read();apply({...value,drafts:local.drafts,scene:null});}
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
   if(!hasHistory(local)&&saved.study||meta?.text===localText&&saved.study){restore(saved.study);base=serverText;writeMeta();return emit('synced');}
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
