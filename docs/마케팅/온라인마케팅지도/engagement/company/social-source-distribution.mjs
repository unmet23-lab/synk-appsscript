import {createHash} from 'node:crypto';
import {setImmediate as yieldToRequests} from 'node:timers/promises';
import {canManageOwners} from './organization.mjs';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const ready=production=>['ready','published'].includes(production.stage);
const automatic=id=>/^(studio|pulse|packages):(?:all|[\w-]+)$/.test(id||'');

// Rules only produce editable drafts. Approval and publication remain explicit
// operations on the resulting, independently versioned social post.
export function createSocialSourceDistribution({store,studio,publicationPackages,marketing,publishing,clock=()=>new Date().toISOString()}){
  let running=null;
  function current(user){const live=store.get('users',user?.id);if(!live?.active||!['admin','manager','member','viewer'].includes(live.role))throw fail('로그인 상태를 확인해 주세요.',401);return live;}
  function assertRule(user,rule){
    user=current(user);if(!rule)throw fail('배포 규칙을 찾을 수 없어요.',404);
    if(user.role==='viewer'||(rule.ownerId!==user.id&&user.role!=='admin')||rule.channelIds.some(id=>{const channel=store.get('channels',id);return !channel||channel.active===false||channel.hidden||!canManageOwners(user,channel);}))throw fail('이 배포 규칙을 관리할 권한이 없어요.',403);
    return user;
  }
  function mediaRef(user,id){try{const row=marketing.ownMedia(user,id);return {id:row.id,assetId:row.id,mimeType:row.mimeType,type:row.mimeType?.startsWith('video/')?'video':'image',url:'/api/social/media/'+row.id};}catch(error){if(![403,404,409].includes(error.status))throw error;return {id,assetId:id,unavailable:true};}}
  function sources(user){
    user=current(user);const events=[],errors=[],catalog=[{id:'studio:all',label:'제작실 · 모든 확정본',kind:'studio'},{id:'packages:all',label:'게시 준비 · 모든 확정 묶음',kind:'packages'},{id:'pulse:all',label:'PULSE · 고객 승인 최종본',kind:'pulse'}];
    let productions=[];try{productions=studio.workspace(user).productions||[];}catch{errors.push({sourceIds:['studio:all','packages:all']});}const byProduction=new Map();
    for(const summary of productions){
      let p;try{p=studio.production(user,summary.id).production;}catch{errors.push({sourceIds:['studio:all','studio:'+summary.id,'packages:all']});continue;}byProduction.set(p.id,p);
      catalog.push({id:'studio:'+p.id,label:'제작실 · '+p.title,kind:'studio'});
      if(!ready(p))continue;
      const mediaVersion=p.versions.filter(v=>['video','image'].includes(v.kind)&&v.mediaId).at(-1),copy=p.versions.filter(v=>v.kind==='text').at(-1),version=mediaVersion||copy;
      if(!version)continue;
      const media=mediaVersion?[mediaRef(user,mediaVersion.mediaId)]:[];
      events.push({id:digest(['studio',p.id,version.id,copy?.id]),sourceIds:['studio:all','studio:'+p.id],createdAt:version.createdAt,post:{title:p.title,body:copy?.text||'',source:{productionId:p.id,versionId:version.id},media,format:mediaVersion?.kind||'text'}});
    }
    const packages=[];
    if(typeof publicationPackages.get==='function'){
      for(const row of store.all('studioPublicationPackages'))try{packages.push(publicationPackages.get(user,row.id).package);}catch(error){if(![403,404].includes(error.status))errors.push({sourceIds:['packages:all','packages:'+row.id]});}
    }else try{packages.push(...(publicationPackages.list(user).packages||[]));}catch{errors.push({sourceIds:['packages:all']});}
    for(const pack of packages){
      const p=byProduction.get(pack.productionId);if(pack.state!=='prepared'||!p||!ready(p))continue;
      const latest=p.versions.filter(v=>v.kind==='video'&&v.mediaId).at(-1);if(latest?.id!==pack.versionId)continue;
      const output=pack.outputs?.find(row=>row.mediaId),mediaId=output?.mediaId||pack.source?.id;if(!mediaId)continue;
      catalog.push({id:'packages:'+pack.id,label:'게시 묶음 · '+pack.title,kind:'packages'});
      events.push({id:digest(['package',pack.id]),sourceIds:['packages:all','packages:'+pack.id],createdAt:pack.createdAt,outputs:pack.outputs||[],post:{title:pack.title,body:pack.body||'',language:pack.language||'ko',source:{productionId:p.id,versionId:pack.versionId,packageId:pack.id},media:[mediaRef(user,pack.source?.id||mediaId)],format:'video'}});
    }
    let clients=[];try{clients=marketing.clientSources(user);}catch{errors.push({sourceIds:['pulse:all']});}
    for(const p of clients){
      catalog.push({id:'pulse:'+p.id,label:'PULSE · '+p.title,kind:'pulse'});
      if(p.approvalStatus!=='approved')continue;
      for(const version of p.versions.filter(v=>v.assetId)){
        const media=mediaRef(user,version.assetId);
        events.push({id:digest(['pulse',p.id,version.id,version.approvedPreviewId]),sourceIds:['pulse:all','pulse:'+p.id],createdAt:version.approvedAt,post:{title:p.title,body:'',source:{clientProjectId:p.id,clientVersionId:version.id,clientApprovalId:version.approvedPreviewId},media:[media],format:media.type}});
      }
    }
    return {events,errors,catalog:catalog.map(row=>({...row,availableCount:events.filter(event=>event.sourceIds.includes(row.id)&&!event.post.media.some(m=>m.unavailable)).length}))};
  }
  function assertEvent(user,event){
    marketing.validateSource(user,event.post);
    if(event.sourceIds[0]==='studio:all'){
      const p=studio.production(user,event.post.source.productionId).production,media=p.versions.filter(v=>['video','image'].includes(v.kind)&&v.mediaId).at(-1),copy=p.versions.filter(v=>v.kind==='text').at(-1),version=media||copy;
      if(!ready(p)||!version||digest(['studio',p.id,version.id,copy?.id])!==event.id)throw fail('현재 확정된 제작 원본을 다시 확인해 주세요.',409);
    }else if(event.sourceIds[0]==='packages:all'){
      const p=studio.production(user,event.post.source.productionId).production,latest=p.versions.filter(v=>v.kind==='video'&&v.mediaId).at(-1);
      if(!ready(p)||latest?.id!==event.post.source.versionId)throw fail('게시 묶음의 현재 확정 원본을 다시 확인해 주세요.',409);
    }
  }
  function initializeRule(user,id){
    const rule=store.get('socialDistributionRules',id);if(!rule)throw fail('배포 규칙을 찾을 수 없어요.',404);user=assertRule(user,rule);
    if(!automatic(rule.sourceId))return;
    const prior=store.get('socialSourceBaselines',id);if(prior?.sourceId===rule.sourceId)return;
    const {events,catalog}=sources(assertRule({id:rule.ownerId},rule));if(!catalog.some(row=>row.id===rule.sourceId))throw fail('현재 접근할 수 있는 확정본 원본을 선택해 주세요.',403);
    store.put('socialSourceBaselines',id,{ruleId:id,sourceId:rule.sourceId,eventIds:events.filter(event=>event.sourceIds.includes(rule.sourceId)).map(event=>event.id),createdAt:clock()});
  }
  function validateRuleSource(user,sourceId){if(automatic(sourceId)&&!sources(user).catalog.some(row=>row.id===sourceId))throw fail('현재 접근할 수 있는 확정본 원본을 선택해 주세요.',403);}
  function workspace(user){
    user=current(user);const rules=publishing.workspace(user).rules;
    return {sourceCatalog:sources(user).catalog,distribution:{mode:'drafts-only',intervalMs:60000,rules:rules.map(rule=>({ruleId:rule.id,automatic:automatic(rule.sourceId),...(store.get('socialSourceScanStatus',rule.id)||{}),canScan:user.role==='admin'||rule.ownerId===user.id&&user.role!=='viewer'}))}};
  }
  async function scanWork({user,ruleId,signal,authorize}={}){
    const caller=user?current(user):null;
    function recheck(rule){
      if(caller){try{const live=current(authorize?authorize():caller);if(live.id!==caller.id)throw fail('로그인 상태를 다시 확인해 주세요.',401);assertRule(live,rule);}catch(error){error.stopScan=true;throw error;}}
      else authorize?.();
      if(!rule?.enabled)throw fail('배포 규칙이 꺼져 있어요.',409);
      return assertRule({id:rule.ownerId},rule);
    }
    if(caller?.role==='viewer')throw fail('열람 계정에서는 규칙을 실행할 수 없어요.',403);
    let rules=store.all('socialDistributionRules').filter(rule=>rule.enabled&&automatic(rule.sourceId));
    if(ruleId){const rule=store.get('socialDistributionRules',ruleId);if(!rule)throw fail('배포 규칙을 찾을 수 없어요.',404);if(caller)assertRule(caller,rule);rules=rules.filter(row=>row.id===ruleId);}
    if(caller&&caller.role!=='admin')rules=rules.filter(rule=>rule.ownerId===caller.id);
    const result={created:0,existing:0,failed:0,checkedRules:0};let visited=0;
    for(const rule of rules){
      if(signal?.aborted||result.created>=50)break;
      const at=clock();let created=0,existing=0,failed=0;
      try{
        const owner=recheck(rule),{events,errors}=sources(owner);failed=errors.filter(error=>error.sourceIds.includes(rule.sourceId)).length;result.failed+=failed;
        const baseline=store.get('socialSourceBaselines',rule.id),ids=new Set(baseline?.sourceId===rule.sourceId?baseline.eventIds:events.filter(event=>event.createdAt<=rule.createdAt).map(event=>event.id));
        for(const event of events.filter(event=>event.sourceIds.includes(rule.sourceId))){
          try{
          if(signal?.aborted||result.created>=50)break;
          if(++visited%20===0)await yieldToRequests();
          const liveRule=store.get('socialDistributionRules',rule.id);
          if(!liveRule?.enabled||liveRule.revision!==rule.revision)break;
          recheck(liveRule);
          const isExisting=ids.has(event.id);if(rule.scope!=='all'&&rule.scope!==(isExisting?'existing':'new'))continue;
          assertEvent(owner,event);
          const previous=store.get('socialSourceReceipts',digest([rule.id,event.id]));
          if(previous){publishing.get(owner,previous.postId);existing++;result.existing++;continue;}
          const draft=structuredClone(event.post);
          if(event.outputs?.length)draft.variants=rule.channelIds.map(channelId=>{
            const platform=store.get('channels',channelId)?.platform,output=event.outputs.find(row=>row.mediaId&&row.channel?.startsWith(platform+'-'));
            return {channelId,title:draft.title,text:draft.body,media:output?[mediaRef(owner,output.mediaId)]:draft.media,format:output?.channel==='instagram-reels'?'reel':output?.channel==='youtube-shorts'?'shorts':'video',...(output?.channel?{publicationFormat:output.channel}:{})};
          });
          const refs=[...draft.media,...(draft.variants||[]).flatMap(v=>v.media||[])],assetIds=[...new Set(refs.map(ref=>ref.assetId||ref.id).filter(Boolean))];
          if(assetIds.length)await marketing.prepareMedia(owner,assetIds,{authorize:()=>{const live=store.get('socialDistributionRules',rule.id);if(live?.revision!==rule.revision)throw fail('그사이 배포 규칙이 바뀌었어요.',409);return recheck(live);},signal});
          if(signal?.aborted)break;
          const afterPrepare=store.get('socialDistributionRules',rule.id);if(!afterPrepare?.enabled||afterPrepare.revision!==rule.revision)break;
          recheck(afterPrepare);assertEvent(owner,event);
          const input=marketing.validatePostInput(owner,draft);marketing.validateSource(owner,input);
          const receipt=publishing.ingestSource(owner,{ruleId:rule.id,sourceId:rule.sourceId,eventId:event.id,confirmed:true,existing:isExisting,post:input});
          for(const item of receipt.results){if(item.existing){existing++;result.existing++;}else{created++;result.created++;}}
          }catch(error){if(error.stopScan)throw error;failed++;result.failed++;}
        }
        store.put('socialSourceScanStatus',rule.id,{lastCheckedAt:at,...(!failed&&!signal?.aborted?{lastSuccessAt:clock()}:{}),created,existing,error:failed?failed+'개 확정본의 파일·규격·권한을 확인해 주세요. 나머지 원본은 그대로 처리했어요.':signal?.aborted?'확정본 확인이 중단됐어요.':null});result.checkedRules++;
      }catch(error){if(error.stopScan)throw error;result.failed++;store.put('socialSourceScanStatus',rule.id,{lastCheckedAt:at,created,existing,error:[401,403,404,409,422].includes(error.status)?'원본·계정 권한 또는 확정 버전을 다시 확인해 주세요.':'확정본을 읽지 못했어요. 규칙과 원본을 확인해 주세요.'});}
    }
    return result;
  }
  function scan(options={}){if(running){if(options.user)throw fail('이미 확정본을 확인하고 있어요. 잠시 후 다시 시도해 주세요.',409);return running;}running=scanWork(options).finally(()=>{running=null;});return running;}
  return {workspace,initializeRule,validateRuleSource,scan,waitForIdle:()=>running||Promise.resolve()};
}
