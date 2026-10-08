'use strict';

// SHIFT owns its account persistence protocol. Atlas continues to own profile and event validation.
// A single revision chain is used for the whole private practice document; concurrent drafts need a human choice.
(function(root){
  const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
  const content=value=>JSON.stringify(value?{...value,save:true}:null);
  const digest=async value=>Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical(JSON.parse(content(value))))))),b=>b.toString(16).padStart(2,'0')).join('');
  const hasWork=value=>!!value?.profile;
  function create(options){
    const {read,apply,request,loadMeta,saveMeta,current,onChange=()=>{},canApply=()=>true}=options;
    let initial={};try{initial=loadMeta()||{};}catch{}
    let enabled=initial.enabled===true,revision=Number.isSafeInteger(initial.revision)&&initial.revision>=0?initial.revision:0,base=typeof initial.base==='string'?initial.base:null;
    let phase=enabled?'waiting':'off',message=enabled?'계정의 실습 기록을 확인합니다.':'기본은 동기화 꺼짐입니다. 켜면 이 회사 계정으로 다른 기기에서 이어갑니다.',conflict=null,busy=false,dirty=false,disposed=false,timer=null,token=0,activation=enabled&&revision===0&&base===null,localRevision=0;
    const valid=()=>!disposed&&current();
    const remember=()=>{try{saveMeta({enabled,revision,base});}catch{message+=' 동기화 선택을 이 기기에 기억하지 못했어요.';}};
    const emit=()=>{if(valid())onChange(view());};
    function view(){return {enabled,revision,phase,message,conflict,busy};}
    function stop(){clearTimeout(timer);timer=null;token++;busy=false;}
    function blockDeleted(remote){revision=remote.revision;base=null;enabled=false;activation=false;conflict={type:'deleted',remote};phase='deleted';message=(remote.status==='deleted'?'다른 기기에서 계정 기록을 지웠어요.':'계정에 저장된 기록이 없어 동기화를 멈췄어요.')+' 이 기기의 작성물은 자동으로 다시 올리지 않습니다. 필요한 내용을 내려받거나 새로 저장할지 선택해 주세요.';remember();emit();}
    function showConflict(remote,type='conflict'){conflict={type,remote};phase='conflict';message='두 기기에서 실습이 달라졌어요. 아래 두 작성물을 확인하고 이어갈 기록을 선택해 주세요.';emit();}
    async function adopt(remote,expectedToken=token){
      apply(remote.state);const adoptedRevision=localRevision,adopted=await digest(read());if(!valid()||expectedToken!==token)return;
      revision=remote.revision;base=adopted;dirty=localRevision!==adoptedRevision;activation=false;conflict=null;phase='synced';message='계정 기록을 불러왔어요. 다른 기기에서도 같은 회사 계정으로 이어갈 수 있습니다.';remember();emit();
    }
    async function push(explicit=false){
      if(!hasWork(read())){phase='waiting';message='동기화를 켰어요. 첫 실습을 시작하면 이 회사 계정에 저장합니다.';emit();return;}
      const pushToken=token,sentRevision=localRevision,snapshot=JSON.parse(content(read())),sent=await digest(snapshot);if(!valid()||pushToken!==token)return;
      const result=await request({action:'save',expectedRevision:revision,activate:explicit||activation,state:snapshot});
      if(!valid()||pushToken!==token)return;
      revision=result.revision;base=sent;activation=false;conflict=null;dirty=localRevision!==sentRevision;phase='synced';message=dirty?'최근 작성 내용을 이어서 저장합니다.':'계정에 저장했어요. 다른 기기에서도 같은 회사 계정으로 이어갑니다.';remember();emit();
    }
    async function cycle({explicit=false,forceLocal=false}={}){
      if(!valid()||!enabled||busy||conflict&&!forceLocal)return;
      stop();const cycleToken=token;busy=true;phase='checking';message='계정 기록을 확인하고 있어요.';emit();
      try{
        const remote=await request();if(!valid()||cycleToken!==token)return;
        if(remote.status==='deleted'&&!explicit){blockDeleted(remote);return;}
        const readRevision=localRevision,local=read(),localDigest=await digest(local),remoteDigest=remote.state?await digest(remote.state):null;if(!valid()||cycleToken!==token)return;
        if(localRevision!==readRevision&&!forceLocal){showConflict(remote);return;}
        if(forceLocal){revision=remote.revision;activation=remote.status!=='active';await push(true);}
        else if(remote.status!=='active'){
          // Only the user's activation may create a new revision after an empty/deleted server record.
          if(!explicit&&!activation){blockDeleted(remote);return;}
          revision=remote.revision;activation=true;await push(true);
        }else if(localDigest===remoteDigest){revision=remote.revision;base=remoteDigest;dirty=false;activation=false;phase='synced';message='계정 기록과 이 기기의 실습이 같아요.';remember();emit();}
        else if(!hasWork(local)||base===localDigest){
          if(canApply())await adopt(remote,cycleToken);else showConflict(remote,'incoming');
        }else if(revision===remote.revision&&base===remoteDigest){await push();}
        else showConflict(remote);
      }catch(error){
        if(!valid()||cycleToken!==token)return;
        if(error.status===409&&error.current){if(error.current.status==='deleted')blockDeleted(error.current);else showConflict(error.current);}
        else{phase='offline';message=[400,413].includes(error.status)?error.message+' 작성 중인 내용은 이 창에 유지됩니다.':error.status===401?'로그인이 만료돼 동기화를 멈췄어요. 작성 중인 내용은 이 창에 남아 있습니다.':'계정에 연결하지 못했어요. 작성 중인 내용은 이 창에 남아 있고, 다시 연결하면 확인 후 저장합니다.';emit();}
      }finally{if(valid()&&cycleToken===token){busy=false;emit();if(enabled&&dirty&&!conflict&&phase==='synced')changed();}}
    }
    function changed(){localRevision++;if(!valid()||!enabled)return;dirty=true;if(conflict||busy)return;clearTimeout(timer);timer=setTimeout(()=>{timer=null;void cycle();},600);}
    async function enable(){if(!valid())return;stop();enabled=true;conflict=null;activation=true;remember();await cycle({explicit:true});}
    function disable(){stop();enabled=false;activation=false;phase='off';message='동기화를 껐어요. 이미 저장한 계정 기록은 유지되며, 이후 작성은 올리지 않습니다.';conflict=null;remember();emit();}
    async function choose(which){
      if(!valid()||busy||!conflict)return;
      if(which==='remote'){
        const selected=conflict.remote;conflict=null;enabled=true;remember();
        // Re-read before replacing a draft: another device may have edited/deleted the offered revision.
        busy=true;const choiceToken=token,choiceRevision=localRevision;
        try{const remote=await request();if(!valid()||choiceToken!==token)return;if(remote.status==='deleted'){blockDeleted(remote);return;}if(remote.revision!==selected.revision||localRevision!==choiceRevision){showConflict(remote,'incoming');return;}await adopt(remote,choiceToken);}
        catch{if(valid()&&choiceToken===token){phase='offline';message='계정 기록을 다시 확인하지 못했어요. 이 기기의 내용은 그대로 남아 있습니다.';conflict={type:'conflict',remote:selected};emit();}}
        finally{if(valid()&&choiceToken===token){busy=false;emit();}}
      }else if(which==='local'){
        const selected=conflict.remote;enabled=true;conflict=null;activation=selected.status!=='active';remember();busy=true;const choiceToken=token;
        try{revision=selected.revision;await push(true);}
        catch(error){if(valid()&&choiceToken===token){if(error.status===409&&error.current){if(error.current.status==='deleted')blockDeleted(error.current);else showConflict(error.current);}else{conflict={type:'conflict',remote:selected};phase='offline';message=[400,413].includes(error.status)?error.message+' 작성 중인 내용은 이 창에 유지됩니다.':'선택한 작성물을 계정에 저장하지 못했어요. 다시 확인해 주세요.';emit();}}}
        finally{if(valid()&&choiceToken===token){busy=false;emit();if(enabled&&dirty&&!conflict&&phase==='synced')changed();}}
      }
    }
    async function remove(){
      if(!valid()||busy)return false;stop();const removeToken=token,removeRevision=localRevision;busy=true;emit();
      try{
        const remote=await request();if(!valid()||removeToken!==token)return false;
        if(localRevision!==removeRevision){showConflict(remote,'incoming');return false;}
        // Keep deletion tied to the revision the user last saw; never erase a newer unseen draft.
        if(remote.revision!==revision){if(remote.status==='deleted')blockDeleted(remote);else showConflict(remote);return false;}
        const deleted=await request({action:'delete',expectedRevision:revision});if(!valid()||removeToken!==token)return false;
        revision=deleted.revision;base=null;enabled=false;activation=false;dirty=false;conflict=null;phase='off';const changedDuringDelete=localRevision!==removeRevision;message=changedDuringDelete?'계정 기록은 지웠어요. 삭제를 기다리는 동안 새로 작성한 내용은 이 창에 유지하고, 다시 올리지 않습니다.':'계정의 실습 기록을 지웠어요. 다른 기기의 오래된 기록은 자동으로 다시 저장되지 않습니다.';remember();emit();return !changedDuringDelete;
      }catch(error){if(valid()&&removeToken===token){if(error.status===409&&error.current){if(error.current.status==='deleted')blockDeleted(error.current);else showConflict(error.current);}else{phase='offline';message='계정 기록을 지우지 못했어요. 이 기기의 작성물도 유지했습니다.';emit();}}return false;}
      finally{if(valid()&&removeToken===token){busy=false;emit();}}
    }
    function dispose(){stop();disposed=true;}
    return {view,changed,enable,disable,choose,remove,refresh:()=>cycle(),resume:()=>enabled?cycle():Promise.resolve(),dispose};
  }
  root.SynkShiftPracticeSync=Object.freeze({create,digest});
})(globalThis);
