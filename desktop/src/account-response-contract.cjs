'use strict';
const {redactAccountResponse}=require('./account-requests.cjs');
const {RESOURCES,PERSONAL_OPERATIONS,PLATFORM_OPERATIONS,LIMITS,uuid}=require('./personal-requests.cjs');
const missingAsset=error=>['ASSET_NOT_FOUND','ASSET_NOT_CONFIRMED'].includes(error?.code)&&uuid(error?.assetId)?{assetId:error.assetId}:{};
const envelopeCode=result=>result.data?.ok===false&&typeof result.data.error?.code==='string'?result.data.error.code:null;
// Domain contracts describe response semantics. They cannot change tokens or account state.
function accountResponseContract(operation,params,config,fault){
  if(config?.product==='messenger'&&!['load','revokeSession'].includes(operation))throw fault('INVALID_REQUEST');
  if(config?.clientKey==='care'&&!['load','careLoad','careSave','careDelete'].includes(operation))throw fault('INVALID_REQUEST');
  if(RESOURCES.includes(config?.clientKey)&&!['load',...PERSONAL_OPERATIONS].includes(operation))throw fault('INVALID_REQUEST');
  const resource=Object.hasOwn(PLATFORM_OPERATIONS,operation)?PLATFORM_OPERATIONS[operation]:PERSONAL_OPERATIONS.includes(operation)?config?.clientKey:null;
  const classroom=operation==='worldRequest'&&params?.route==='classroom';
  const town=['townRecords','townRights'].includes(operation);
  const maxBytes=resource?LIMITS[resource]+32768:33554432;
  function decode(result,ownerId){
    const status=result.response.status,retryable=status>=500||status===429;
    if(classroom){
      const code=envelopeCode(result);
      if(status===401&&code==='AUTH_REQUIRED')return {kind:'classroom',data:{ok:true,classes:[],empty_reason:'NO_LEARNER'}};
      if(!result.response.ok||result.data?.ok!==true)return {kind:'classroom',data:{ok:false,error:{code:code&&/^[A-Z_]{1,80}$/.test(code)?code:status===401?'AUTH_EXPIRED':'CLASSROOM_UNAVAILABLE',message:'수업 목록을 불러오지 못했어요.',retryable,status}}};
      return {kind:'classroom',data:redactAccountResponse(result.data,operation,params)};
    }
    if(!result.response.ok||result.data?.ok!==true){
      // The town's own command errors are lower-case words (stale-command, eval-unavailable …): the records card tells them apart.
      const named=town?/^(?:[A-Z_]{1,80}|[a-z][a-z0-9-]{1,60})$/:/^[A-Z_]{1,80}$/;
      const code=typeof result.data?.error?.code==='string'&&named.test(result.data.error.code)?result.data.error.code:status===401?'AUTH_REQUIRED':retryable?'SERVICE_UNAVAILABLE':'ACCOUNT_UNAVAILABLE';
      return {kind:'error',discard:['AUTH_REQUIRED','SESSION_REVOKED','AUTH_SESSION_MISSING'].includes(code),data:{ok:false,error:{code,message:'계정 요청을 완료하지 못했어요.',retryable,status,...(PERSONAL_OPERATIONS.includes(operation)?missingAsset(result.data?.error):{})},...(Number.isSafeInteger(result.data?.revision)?{revision:result.data.revision}:{})}};
    }
    const data=redactAccountResponse(result.data,operation,params),wrongOwner=typeof ownerId!=='string'||data.accountId!==ownerId;
    const mismatch=(operation==='worldRequest'&&!['town/sharing','enrollment/preview','enrollment/claim'].includes(params?.route)&&wrongOwner)
      ||(['playLoad','playMutate'].includes(operation)&&(data.scope!=='synk-play'||wrongOwner))
      ||(['careLoad','careSave','careDelete'].includes(operation)&&(data.scope!=='synk-care'||wrongOwner))
      ||(['townRecords','townRights'].includes(operation)&&(data.scope!=='synk-town-records'||wrongOwner))
      ||(resource&&(data.scope!=='synk-personal'||data.resource!==resource||wrongOwner));
    return {kind:'success',data,mismatch:!!mismatch};
  }
  return {maxBytes,shouldRefresh:result=>result.response.status===401&&!(classroom&&envelopeCode(result)),decode};
}
module.exports={accountResponseContract,missingAsset};
