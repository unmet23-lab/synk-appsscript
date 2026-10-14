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
    const api={state:!cfg?.enabled?'unconfigured':cached?.apiState||'unknown',checkedAt:cached?.checkedAt||null,lastAttemptAt:cached?.lastAttemptAt||null,stale,nextCheckAt:cached?.nextCheckAt||null,errorCode:cached?.errorCode||null,message:cached?.message||'아직 현재 연결을 점검하지 않았습니다.'};
    const visible=user?.active?store.all('channels').filter(c=>c.active!==false&&!c.hidden&&canReadChannel(user,c)):[];
    return {provider:'postiz',api,canCheck:user?.active===true&&user.role==='admin',intervalMinutes:60,channels:visible.map(c=>{
      const link=store.get('socialConnections',c.id),remote=cached?.integrations?.find(r=>r.id===link?.integrationId);let state='not_connected',message='Postiz 발행 계정 연결 전입니다.';
      if(link?.status==='connected'){
        if(!cfg?.enabled||link.configVersion!==cfg.version||link.channelConnectionVersion!==(c.connectionVersion||0)){state='changed';message='연결 설정 또는 담당이 변경되었습니다. 계정을 다시 확인해 주세요.';}
        else if(!cached?.integrations){state='unknown';message='API 상태와 별도로 이 계정의 최근 점검이 필요합니다.';}
        else if(!remote){state='missing';message='현재 Postiz 계정 목록에서 연결한 계정을 찾지 못했습니다.';}
        else if(remote.disabled){state='disabled';message='Postiz가 이 계정을 비활성 연결로 보고했습니다.';}
        else if(remote.identifier!==link.identifier||remote.profile!==link.profile){state='changed';message='Postiz 계정의 프로필 또는 연결 식별자가 변경됐습니다.';}
        else {state='listed';message='Postiz 목록에서 사용 가능한 계정을 확인했습니다. SNS의 실제 게시 권한은 발행 때 다시 확인합니다.';}
      }
      return {channelId:c.id,state,checkedAt:cached?.checkedAt||null,stale,message,canCheck:user.role==='admin'};
    })};
  }
  function checkHealth(user,_input={},context={}){
    assertActor(user,context);if(closed)throw fail('HEALTH_STOPPED','연결 점검을 종료했습니다.',503);
    const cfg=configured(),key=generation(),prior=store.get('socialProviderHealth','postiz');
    if(running)return running.then(()=>{assertActor(user,context);return health(user);});
    if(prior?.generation===key&&prior.lastAttemptAt&&stamp()-Date.parse(prior.lastAttemptAt)<60000)return Promise.resolve({...health(user),cached:true});
    controller=new AbortController();const signal=context.signal?AbortSignal.any([context.signal,controller.signal]):controller.signal;
    const check=()=>{if(signal.aborted||closed)throw fail('HEALTH_CANCELLED','연결 점검이 중단됐습니다.');assertActor(user,context);if(generation()!==key)throw fail('CONFIG_CHANGED','연결 설정이 바뀌어 이전 점검 결과를 저장하지 않았습니다.');};
    check();const attempted=now();store.put('socialProviderHealth','postiz',{...(prior?.generation===key?prior:{}),id:'postiz',generation:key,lastAttemptAt:attempted,nextCheckAt:new Date(stamp()+HOUR).toISOString()});
    running=(async()=>{
      try{
        const connected=await request(cfg,'/is-connected',{signal});check();if(connected?.connected!==true)throw fail('PROVIDER_AUTH','Postiz API 인증이 연결되어 있지 않습니다.');
        const me=await request(cfg,'/me',{signal});check();if(!me?.organization?.id||me.organization.id!==cfg.organization?.id)throw fail('ORGANIZATION_CHANGED','Postiz API가 다른 워크스페이스를 가리킵니다.');
        const integrations=parseIntegrations(await request(cfg,'/integrations',{signal}));check();
        store.transaction(()=>{check();store.put('socialProviderHealth','postiz',{id:'postiz',generation:key,lastAttemptAt:attempted,checkedAt:now(),nextCheckAt:new Date(stamp()+HOUR).toISOString(),apiState:'connected',integrations,message:'Postiz API 인증과 워크스페이스를 확인했습니다.',errorCode:null});});
      }catch(error){
        check();const safe=error.providerSafe?error:fail('HEALTH_FAILED','Postiz 연결 점검을 완료하지 못했습니다.',502),apiState=['PROVIDER_AUTH','ORGANIZATION_CHANGED'].includes(safe.code)?'auth_required':'error';
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
