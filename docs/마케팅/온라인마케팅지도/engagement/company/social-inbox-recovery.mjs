import {createHash,randomUUID} from 'node:crypto';
import {canReadChannel,canWriteChannel,canManageOwners} from './organization.mjs';
import {verifyMetaConnection} from './meta-connection.mjs';

const SETTINGS='socialInboxConnections',TTL=5*60_000;
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail=(code,message,status=409)=>Object.assign(new Error(message),{code,status,inboxSafe:true});
const channelPin=c=>hash([c.id,c.platform,c.externalId,c.handle,c.connectionVersion||0,c.active,c.hidden,c.ownerIds,c.teamId,c.collectionDisabled]);

// A short-lived, actor-bound confirmation. Verifying never rotates credentials or
// enables a previously disabled collector; Meta calls are bounded official GETs.
export function createSocialInboxRecovery({store,inboxProvider,getProviderConfig=()=>({}),fetchImpl=globalThis.fetch,clock=()=>new Date().toISOString()}={}){
  const receipts=new Map(),lastChecks=new Map();let closed=false;
  const now=()=>new Date(clock()).toISOString(),stamp=()=>Date.parse(now());
  function clean(){for(const [id,row]of receipts)if(row.expiresAt<=stamp())receipts.delete(id);}
  function access(user,channelId,context={}){
    context.authorize?.();if(closed||context.signal?.aborted)throw fail('RECOVERY_CANCELLED','재연결 확인을 멈췄어요.');
    const actor=store.get('users',user?.id),channel=store.get('channels',channelId);
    if(!actor?.active||!channel||channel.active===false||channel.hidden||!canManageOwners(actor,channel)||!canWriteChannel(actor,channel))throw fail('RECOVERY_FORBIDDEN','지금 담당 권한으로는 수집을 다시 설정할 수 없어요.',403);
    if(!['instagram','facebook'].includes(channel.platform))throw fail('RECOVERY_UNSUPPORTED','Instagram·Facebook 댓글 연결만 다시 확인할 수 있어요.');
    const settings=store.get(SETTINGS,channelId),credentials=store.secret('channel:'+channelId),provider=getProviderConfig(channel.platform);
    if(settings?.enabled!==true)throw fail('RECOVERY_NOT_PREVIOUSLY_ENABLED','이전에 꺼 둔 댓글 수집은 다시 켜지 않아요. 수집 사용은 따로 선택해 주세요.');
    if(!settings.version||!credentials?.accessToken||channel.collectionDisabled)throw fail('RECOVERY_RECONNECT_REQUIRED','먼저 댓글 권한으로 같은 계정을 다시 연결해 주세요.');
    return {actor,channel,settings,credentials,provider,binding:hash([channelPin(channel),settings,credentials,provider,actor.id,actor.role,actor.teamId,actor.active])};
  }
  function expected(row,input){if(input.connectionVersion!==(row.channel.connectionVersion||0)||input.settingsVersion!==row.settings.version)throw fail('RECOVERY_CHANGED','계정이나 수집 설정이 바뀌었어요. 지금 설정에서 다시 확인해 주세요.');}
  function checked(user,input,context,binding){const row=access(user,input.channelId,context);expected(row,input);if(binding&&row.binding!==binding)throw fail('RECOVERY_CHANGED','확인한 뒤에 계정·권한·토큰이나 수집 설정이 바뀌었어요. 다시 확인해 주세요.');return row;}
  async function verifyCurrent(user,input,context,binding){
    const row=checked(user,input,context,binding);
    const proof=await verifyMetaConnection({channel:row.channel,credentials:row.credentials,provider:row.provider,purpose:'comments',trustedExpiry:true,fetchImpl,clock,signal:context.signal,authorize:()=>checked(user,input,context,row.binding)});
    checked(user,input,context,row.binding);return {...row,verifiedAt:proof.credentials.verifiedAt};
  }
  function workspace(user){
    clean();const actor=store.get('users',user?.id);
    return {channels:actor?.active?store.all('channels').filter(c=>c.active!==false&&!c.hidden&&['instagram','facebook'].includes(c.platform)&&canReadChannel(actor,c)).map(channel=>{
      const settings=store.get(SETTINGS,channel.id),record=lastChecks.get(user.id+':'+channel.id);let live=null;try{live=access(user,channel.id);}catch{}
      const receipt=[...receipts.values()].find(r=>r.actorId===user.id&&r.channelId===channel.id&&r.binding===live?.binding),changed=settings?.enabled===true&&settings.connectionVersion!==(channel.connectionVersion||0),blocked=record?.binding===live?.binding&&record?.state==='blocked';
      const state=receipt?'ready':blocked?'blocked':changed?'reconnected':settings?.enabled===true?'current':'disabled';
      return {channelId:channel.id,recovery:{state,previousEnabled:settings?.enabled===true,connectionVersion:channel.connectionVersion||0,settingsVersion:settings?.version||null,verifiedAt:receipt?.verifiedAt||(record?.binding===live?.binding?record?.verifiedAt:null)||null,canVerify:!!live,canResume:!!receipt,recoveryId:receipt?.id||null,expiresAt:receipt?new Date(receipt.expiresAt).toISOString():null,reason:blocked?record.reason:changed?'새 연결을 확인한 뒤 이전 댓글 수집 선택을 재개하세요.':state==='disabled'?'이전에 꺼 둔 수집은 자동으로 켜지지 않아요.':receipt?'지금 계정과 댓글 권한을 확인했어요. 수집 재개를 선택해 주세요.':null}};
    }):[]};
  }
  async function verify(user,input={},context={}){
    clean();const initial=checked(user,input,context);for(const [id,r]of receipts)if(r.actorId===user.id&&r.channelId===input.channelId)receipts.delete(id);
    try{const row=await verifyCurrent(user,input,context,initial.binding);if(receipts.size>=100)receipts.delete(receipts.keys().next().value);const id=randomUUID();receipts.set(id,{id,actorId:user.id,channelId:input.channelId,binding:row.binding,verifiedAt:row.verifiedAt,expiresAt:stamp()+TTL});lastChecks.set(user.id+':'+input.channelId,{binding:row.binding,state:'verified',verifiedAt:row.verifiedAt});return {channelId:input.channelId,recovery:workspace(user).channels.find(r=>r.channelId===input.channelId).recovery};}
    catch(error){lastChecks.set(user.id+':'+input.channelId,{binding:initial.binding,state:'blocked',verifiedAt:null,reason:error.metaSafe||error.inboxSafe?error.message:'댓글 권한을 확인하지 못했어요. 다시 연결해 주세요.'});throw error;}
  }
  async function resume(user,input={},context={}){
    clean();const receipt=receipts.get(input.recoveryId);if(!receipt||receipt.actorId!==user?.id||receipt.channelId!==input.channelId)throw fail('RECOVERY_CONFIRMATION_REQUIRED','새 연결을 다시 확인한 뒤 수집을 재개해 주세요.');
    receipts.delete(input.recoveryId);const row=await verifyCurrent(user,input,context,receipt.binding);
    store.transaction(()=>{checked(user,input,context,row.binding);inboxProvider.configure(user,{channelId:input.channelId,enabled:true},context);});
    const result=await inboxProvider.sync(user,{channelId:input.channelId},context);
    const live=store.get('channels',input.channelId);if(channelPin(live)!==channelPin(row.channel))throw fail('RECOVERY_CHANGED','수집하는 동안 계정 연결이 바뀌었어요. 지금 수집 결과를 확인해 주세요.');
    lastChecks.set(user.id+':'+input.channelId,{binding:access(user,input.channelId,context).binding,state:'resumed',verifiedAt:row.verifiedAt});
    return {channelId:input.channelId,status:result.status==='running'?'running':'resumed',verifiedAt:row.verifiedAt,sync:result,recovery:workspace(user).channels.find(r=>r.channelId===input.channelId).recovery};
  }
  return {workspace,verify,resume,stop(){closed=true;receipts.clear();lastChecks.clear();}};
}
