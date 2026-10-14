import {createHash} from 'node:crypto';
import {canReadChannel} from './organization.mjs';

// Postiz /is-connected verifies the API credential, not a social account token.
// /me binds the workspace; /integrations only reports its listed/disabled state.
// https://docs.postiz.com/public-api/integrations/is-connected
// https://docs.postiz.com/public-api/integrations/me
// https://docs.postiz.com/public-api/integrations/list
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail=(code,message,status=409)=>Object.assign(new Error(message),{code,status,providerSafe:true});
const HOUR=3600000;
export function createProviderHealth({store,config,credentials,configured,request,parseIntegrations,authorize,clock}){
  const now=()=>new Date(clock()).toISOString(),stamp=()=>Date.parse(now());let running=null,controller,closed=false;
  const generation=()=>{const c=config(),s=credentials();return hash([c?.version,c?.enabled,c?.baseUrl,c?.organization?.id,s?.version,s?.apiKey]);};
  const current=user=>store.get('users',user?.id)||null;
  const assertActor=(user,context)=>{authorize(user,context);const live=current(user);if(!live?.active||live.role!=='admin')throw fail('ADMIN_REQUIRED','현재 관리자 권한을 확인해 주세요.',403);};
  function health(user){
    user=current(user);const cfg=config(),saved=store.get('socialProviderHealth','postiz'),same=saved?.generation===generation(),cached=same?saved:null;
    const stale=!cached?.checkedAt||stamp()-Date.parse(cached.checkedAt)>HOUR;
    const api={state:!cfg?.enabled?'unconfigured':cached?.apiState||'unknown',checkedAt:cached?.checkedAt||null,lastAttemptAt:cached?.lastAttemptAt||null,stale,nextCheckAt:cached?.nextCheckAt||null,errorCode:cached?.errorCode||null,message:cached?.message||'아직 연결을 점검하지 않았어요.'};
    const visible=user?.active?store.all('channels').filter(c=>c.active!==false&&!c.hidden&&canReadChannel(user,c)):[];
    return {provider:'postiz',api,canCheck:user?.active===true&&user.role==='admin',intervalMinutes:60,channels:visible.map(c=>{
      const link=store.get('socialConnections',c.id),remote=cached?.integrations?.find(r=>r.id===link?.integrationId);let state='not_connected',message='아직 Postiz 발행 계정을 연결하지 않았어요.';
      if(link?.status==='connected'){
        if(!cfg?.enabled||link.configVersion!==cfg.version||link.channelConnectionVersion!==(c.connectionVersion||0)){state='changed';message='연결 설정이나 담당이 바뀌었어요. 계정을 다시 확인해 주세요.';}
        else if(!cached?.integrations){state='unknown';message='API 상태와는 별개로 이 계정도 점검해야 해요.';}
        else if(!remote){state='missing';message='Postiz 계정 목록에 연결한 계정이 없어요.';}
        else if(remote.disabled){state='disabled';message='Postiz가 이 계정을 비활성 연결로 표시했어요.';}
        else if(remote.identifier!==link.identifier||remote.profile!==link.profile){state='changed';message='Postiz 계정의 프로필이나 연결 종류가 바뀌었어요. 계정을 다시 확인해 주세요.';}
        else {state='listed';message='Postiz 목록에서 쓸 수 있는 계정으로 확인했어요. SNS 게시 권한은 발행 때 다시 확인해요.';}
      }
      return {channelId:c.id,state,checkedAt:cached?.checkedAt||null,stale,message,canCheck:user.role==='admin'};
    })};
  }
  function checkHealth(user,_input={},context={}){
    assertActor(user,context);if(closed)throw fail('HEALTH_STOPPED','연결 점검을 멈췄어요.',503);
    const cfg=configured(),key=generation(),prior=store.get('socialProviderHealth','postiz');
    if(running)return running.then(()=>{assertActor(user,context);return health(user);});
    if(prior?.generation===key&&prior.lastAttemptAt&&stamp()-Date.parse(prior.lastAttemptAt)<60000)return Promise.resolve({...health(user),cached:true});
    controller=new AbortController();const signal=context.signal?AbortSignal.any([context.signal,controller.signal]):controller.signal;
    const check=()=>{if(signal.aborted||closed)throw fail('HEALTH_CANCELLED','연결 점검이 중단됐어요.');assertActor(user,context);if(generation()!==key)throw fail('CONFIG_CHANGED','연결 설정이 바뀌어서 앞선 점검 결과는 저장하지 않았어요.');};
    check();const attempted=now();store.put('socialProviderHealth','postiz',{...(prior?.generation===key?prior:{}),id:'postiz',generation:key,lastAttemptAt:attempted,nextCheckAt:new Date(stamp()+HOUR).toISOString()});
    running=(async()=>{
      try{
        const connected=await request(cfg,'/is-connected',{signal});check();if(connected?.connected!==true)throw fail('PROVIDER_AUTH','Postiz API 인증이 연결돼 있지 않아요. API 키를 다시 확인해 주세요.');
        const me=await request(cfg,'/me',{signal});check();if(!me?.organization?.id||me.organization.id!==cfg.organization?.id)throw fail('ORGANIZATION_CHANGED','Postiz API가 다른 워크스페이스를 가리키고 있어요. 발행 연결 설정을 확인해 주세요.');
        const integrations=parseIntegrations(await request(cfg,'/integrations',{signal}));check();
        store.transaction(()=>{check();store.put('socialProviderHealth','postiz',{id:'postiz',generation:key,lastAttemptAt:attempted,checkedAt:now(),nextCheckAt:new Date(stamp()+HOUR).toISOString(),apiState:'connected',integrations,message:'Postiz API 인증과 워크스페이스를 확인했어요.',errorCode:null});});
      }catch(error){
        check();const safe=error.providerSafe?error:fail('HEALTH_FAILED','Postiz 연결 점검을 끝내지 못했어요. 잠시 후 다시 점검해 주세요.',502),apiState=['PROVIDER_AUTH','ORGANIZATION_CHANGED'].includes(safe.code)?'auth_required':'error';
        // A failed attempt never turns old channel observations into fresh proof.
        store.put('socialProviderHealth','postiz',{...(prior?.generation===key?prior:{}),id:'postiz',generation:key,lastAttemptAt:attempted,nextCheckAt:safe.nextRetryAt||new Date(stamp()+HOUR).toISOString(),apiState,errorCode:safe.code,message:safe.message});
      }
      return health(user);
    })().finally(()=>{running=null;controller=null;});return running;
  }
  async function scanHealthDue({signal}={}){
    if(closed||signal?.aborted||running)return {checked:0};const cfg=config(),actor=cfg?.updatedBy?store.get('users',cfg.updatedBy):null,saved=store.get('socialProviderHealth','postiz');
    if(!cfg?.enabled||!actor?.active||actor.role!=='admin')return {checked:0};if(saved?.generation===generation()&&saved.nextCheckAt>now())return {checked:0};
    try{const result=await checkHealth(actor,{}, {signal});return {checked:1,failed:result.api.errorCode?1:0};}catch{return {checked:1,failed:1};}
  }
  const waitForHealthIdle=async()=>{if(running)await running.catch(()=>{});};const stopHealth=async()=>{closed=true;controller?.abort();await waitForHealthIdle();};
  return {health,checkHealth,scanHealthDue,waitForHealthIdle,stopHealth};
}
