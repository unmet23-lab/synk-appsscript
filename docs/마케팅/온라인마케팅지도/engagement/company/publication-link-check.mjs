import {createHash} from 'node:crypto';
import {checkPublicLink} from './publication-link-probe.mjs';

const KIND='publicationLinkChecks',HOUR=3600000,COOLDOWN=60000;
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const hash=value=>createHash('sha256').update(value).digest('hex');
const statuses=new Set(['reachable','error','manual-required']);
const labels={unchecked:'아직 확인하지 않음',reachable:'HTTP 응답 확인',error:'접속 오류','manual-required':'직접 확인 필요'};
const clean=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
function cancellable(work,signal){return new Promise((resolve,reject)=>{const abort=()=>reject(Object.assign(new Error('Cancelled'),{code:'CANCELLED'}));if(signal.aborted)return abort();signal.addEventListener('abort',abort,{once:true});Promise.resolve().then(work).then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));});}

export function createPublicationLinkCheckService({store,studio,publicationPackages,postPerformance,clock=()=>new Date().toISOString(),probe=checkPublicLink}={}){
  if(!store||!studio||!publicationPackages||!postPerformance)throw new Error('Publication link check requires its source services.');
  const running=new Map(),controllers=new Set();let stopping=false,scan=null;
  function instant(){const value=Date.parse(clock());if(!Number.isFinite(value))throw fail('서버 시각을 확인해 주세요.',500);return value;}
  function current(user){const live=user?.id&&store.get('users',user.id);if(!live?.active)throw fail('먼저 로그인해 주세요.',401);return live;}
  function source(user,target,write=false){
    user=current(user);if(!target||typeof target!=='object'||Array.isArray(target)||Object.keys(target).some(key=>!['kind','id'].includes(key))||!['package','post'].includes(target.kind)||typeof target.id!=='string')throw fail('저장된 게시 또는 자료 링크를 선택해 주세요.');
    let url,canCheck=false;
    if(target.kind==='package'){
      const pack=publicationPackages.get(user,target.id).package;if(pack.state!=='prepared')throw fail('준비된 게시 묶음을 선택해 주세요.',409);
      const production=write?studio.assertEditable(user,pack.productionId):studio.production(user,pack.productionId).production;
      canCheck=user.role!=='viewer'&&production.stage!=='archived'&&(write||production.canEdit===true);url=pack.link||'';
    }else{
      const entry=postPerformance.list(user).entries.find(row=>row.id===target.id&&row.active!==false);if(!entry)throw fail('현재 확인할 수 있는 게시 기록이 없습니다.',404);
      url=entry.url;canCheck=user.role!=='viewer'&&entry.canEdit===true;
    }
    if(write&&!canCheck)throw fail('이 링크를 확인할 현재 담당 권한이 없습니다.',403);
    if(!url)return {user,kind:target.kind,id:target.id,url:'',canCheck,key:null};
    if(typeof url!=='string'||url.length>4096)throw fail('저장된 링크를 확인해 주세요.',409);
    const fingerprint=hash(url),key=`${target.kind}:${target.id}:${fingerprint}`;
    return {user,kind:target.kind,id:target.id,url,canCheck,key,fingerprint};
  }
  function view(selected){
    if(!selected.url)return {check:null};const saved=store.get(KIND,selected.key),valid=saved?.url===selected.url&&saved?.fingerprint===selected.fingerprint?saved:null;
    return {check:{kind:selected.kind,id:selected.id,url:selected.url,status:valid?.status||'unchecked',reason:valid?.reason||'not-checked',label:labels[valid?.status]||labels.unchecked,detail:valid?.detail||'이 저장된 주소의 접속 응답을 아직 확인하지 않았습니다.',checkedAt:valid?.checkedAt||null,httpStatus:valid?.httpStatus??null,finalUrl:valid?.finalUrl||null,canCheck:selected.canCheck,revision:valid?.revision||0,nextCheckAt:valid?.nextCheckAt||null,cooldownUntil:valid?.cooldownUntil||null}};
  }
  function get(user,target){return view(source(user,target));}
  function safeResult(response){
    const status=statuses.has(response?.status)?response.status:'manual-required';let finalUrl=null;
    if(typeof response?.finalUrl==='string')try{const parsed=new URL(response.finalUrl);if(parsed.protocol==='https:'&&!parsed.username&&!parsed.password&&(!parsed.port||parsed.port==='443'))finalUrl=parsed.href.slice(0,4096);}catch{}
    return {status,reason:clean(response?.reason,80)||'unverified-response',detail:clean(response?.detail,1000)||'접속 확인 결과를 해석하지 못했습니다. 주소를 직접 확인해 주세요.',httpStatus:Number.isInteger(response?.httpStatus)&&response.httpStatus>=100&&response.httpStatus<=599?response.httpStatus:null,finalUrl};
  }
  async function check(user,target,{authorize,signal}={}){
    if(stopping)throw fail('서버를 종료하는 중입니다.',503);authorize?.();const selected=source(user,target,true);if(!selected.url)return {check:null};if(signal?.aborted)throw fail('링크 확인이 취소됐습니다.',499);
    const previous=view(selected).check;if(previous.cooldownUntil&&Date.parse(previous.cooldownUntil)>instant())return {check:previous};
    let job=running.get(selected.key);
    if(!job){
      const controller=new AbortController(),cancel=()=>controller.abort();controllers.add(controller);signal?.addEventListener('abort',cancel,{once:true});
      job=(async()=>{
        try{
          let response;
          try{response=await cancellable(()=>probe(selected.url,{signal:controller.signal}),controller.signal);}
          catch(error){if(controller.signal.aborted||signal?.aborted||stopping||error.code==='CANCELLED')throw fail('링크 확인이 취소됐습니다.',499);response={status:'error',reason:'connection-error',detail:'HTTPS 연결 확인을 마치지 못했습니다.',httpStatus:null,finalUrl:null};}
          if(controller.signal.aborted||stopping)throw fail('링크 확인이 취소됐습니다.',499);
          authorize?.();const latest=source(user,target,true);if(latest.key!==selected.key||latest.url!==selected.url)throw fail('확인 중 원본 주소가 바뀌었습니다. 현재 링크를 다시 확인해 주세요.',409);
          const at=instant(),result=safeResult(response),existing=store.get(KIND,selected.key),revision=(existing?.revision||0)+1,checkedAt=new Date(at).toISOString();
          const event={...result,checkedAt,actorId:latest.user.id,revision};
          store.put(KIND,selected.key,{kind:selected.kind,id:selected.id,url:selected.url,fingerprint:selected.fingerprint,...event,nextCheckAt:new Date(at+6*HOUR).toISOString(),cooldownUntil:new Date(at+COOLDOWN).toISOString(),history:[...(existing?.history||[]),event].slice(-50)});
        }finally{controllers.delete(controller);signal?.removeEventListener('abort',cancel);}
      })();running.set(selected.key,job);job.then(()=>{if(running.get(selected.key)===job)running.delete(selected.key);},()=>{if(running.get(selected.key)===job)running.delete(selected.key);});
    }
    await job;if(signal?.aborted)throw fail('링크 확인이 취소됐습니다.',499);authorize?.();const latest=source(user,target,true);if(latest.key!==selected.key)throw fail('확인 중 원본 주소가 바뀌었습니다. 현재 링크를 다시 확인해 주세요.',409);return view(latest);
  }
  function candidates(){
    const list=[],seen=new Set(),packages=store.all('studioPublicationPackages').filter(row=>row.state==='prepared').sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')||b.id.localeCompare(a.id));
    for(const pack of packages){
      const production=store.get('studioProductions',pack.productionId);if(!production||production.stage==='archived')continue;
      const latest=(production.versions||[]).filter(row=>row.kind==='video'&&row.mediaId).at(-1);if(latest?.id!==pack.versionId)continue;
      const key=pack.productionId+'|'+pack.versionId+'|'+[...(pack.channels||[])].sort().join(',');if(seen.has(key))continue;seen.add(key);if(!pack.link)continue;
      list.push({target:{kind:'package',id:pack.id},owners:[...new Set([production.assigneeId,production.ownerId].filter(Boolean))]});
    }
    for(const entry of store.all('postPerformanceEntries'))if(entry.active!==false){const channel=store.get('channels',entry.channelId);if(channel&&channel.active!==false)list.push({target:{kind:'post',id:entry.id},owners:channel.ownerIds||[]});}
    return list;
  }
  async function scanWork({signal}={}){
    const result={checked:0,skipped:0,failed:0};
    for(const candidate of candidates()){
      if(stopping||signal?.aborted||result.checked+result.failed>=10)break;
      let owner=null,state=null;for(const id of candidate.owners){try{const user=store.get('users',id);if(!user?.active||user.role==='viewer')continue;const selected=source(user,candidate.target,true);state=view(selected).check;if(state?.canCheck){owner=user;break;}}catch(error){if(![400,401,403,404,409,422].includes(error.status))throw error;}}
      if(!owner||!state||state.nextCheckAt&&Date.parse(state.nextCheckAt)>instant()){result.skipped++;continue;}
      try{await check(owner,candidate.target,{signal});result.checked++;}catch(error){if(stopping||signal?.aborted)break;result.failed++;}
    }
    return result;
  }
  function scanDue(options={}){if(stopping)return Promise.resolve({checked:0,skipped:0,failed:0});if(scan)return scan;scan=scanWork(options).finally(()=>{scan=null;});return scan;}
  async function waitForIdle(){await Promise.allSettled([...running.values(),...(scan?[scan]:[])]);}
  async function stop(){stopping=true;for(const controller of controllers)controller.abort();await waitForIdle();}
  return {get,check,scanDue,waitForIdle,stop};
}
