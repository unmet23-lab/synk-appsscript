import {createHash,randomUUID} from 'node:crypto';
import {strategyOf,strategyReadiness} from './pulse-strategy.mjs';

const records=value=>Array.isArray(value)?value:[];
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const day=value=>{const at=Date.parse(value);return Number.isFinite(at)?new Date(at+9*3600000).toISOString().slice(0,10):'';};
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const labels={objective:'제작 목적',product:'제품·서비스',audience:'대상',primaryPromise:'핵심 약속',evidence1:'메시지를 믿을 근거',memoryHook:'기억할 요소',desiredAction:'기대 행동',channels:'게재 채널',values:'두 가지 이상 가치'};
const statuses={disabled:'착수 점검 꺼짐',waiting:'착수 전 확인 필요',ready:'착수 준비 완료',archived:'보관됨'};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const obj=value=>value&&typeof value==='object'&&!Array.isArray(value);
const validDate=value=>typeof value==='string'&&(!value||/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value);
function text(value,max,required=false){if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)||required&&!value.trim())throw fail('자료 항목의 내용과 길이를 확인해 주세요.');return value.trim();}
function keys(value,allowed){if(!obj(value)||Object.keys(value).some(key=>!allowed.includes(key)))throw fail('착수 점검 입력 항목을 확인해 주세요.');}
function safeUrl(value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:'';}catch{return '';}}
const sourceFields=source=>({key:source.key,label:source.label,kind:source.kind,...(source.url?{url:source.url}:{})});

// Match the existing PULSE media visibility rule; linking a requirement never
// publishes an employee asset or adds a second file-storage location.
export function clientKickoffSources(row,{customer=false}={}){
  const studio=row.studio||{},assets=records(studio.assets),publicAssets=new Set(assets.filter(asset=>asset.author==='customer').map(asset=>asset.id));
  for(const card of [...records(studio.references),...records(studio.concepts).filter(card=>card.visibility==='customer'),...records(studio.scenes).filter(card=>card.visibility==='customer'),...records(studio.history).filter(card=>card.visibility==='customer')])if(card.assetId)publicAssets.add(card.assetId);
  const result=[];
  for(const asset of assets){
    const visible=publicAssets.has(asset.id);if(customer&&!visible)continue;
    result.push({key:'asset:'+asset.id,label:asset.fileName||'기획 자료',kind:'asset',url:customer?'/pulse/api/studio/media/'+asset.id:'/api/client-projects/'+row.id+'/studio/media/'+asset.id,fingerprint:hash({kind:'asset',asset}),customerVisible:visible});
  }
  if(!customer)for(const file of records(row.intake?.files).filter(file=>file.kind==='attachment'))result.push({key:'intake:'+file.id,label:file.fileName||'접수 첨부',kind:'intake',url:'/api/client-projects/'+row.id+'/intake-files/'+file.id,fingerprint:hash({kind:'intake',file}),customerVisible:false});
  for(const reference of records(studio.references)){
    const asset=reference.assetId?assets.find(asset=>asset.id===reference.assetId):null,url=safeUrl(reference.url);
    if(!url&&!asset)continue;
    result.push({key:'reference:'+reference.id,label:reference.label||'참고 자료',kind:'reference',url:url||(customer?'/pulse/api/studio/media/'+asset.id:'/api/client-projects/'+row.id+'/studio/media/'+asset.id),fingerprint:hash({kind:'reference',reference,asset:asset||null}),customerVisible:true});
  }
  const strategy=strategyOf(studio.strategy);
  for(const [field,label]of [['subtitles','자막 문구'],['screenCopy','화면 문구']])if(typeof strategy.data[field]==='string'&&strategy.data[field].trim())result.push({key:'strategy:'+field,label,kind:'strategy',fingerprint:hash({kind:'strategy',field,text:strategy.data[field]}),customerVisible:true});
  return result;
}

export function buildClientKickoff(row,{now=new Date().toISOString(),canEdit=false}={}){
  const plan=row.kickoffPlan||{},enabled=plan.enabled===true,dueDate=validDate(plan.dueDate)?plan.dueDate:'',sources=clientKickoffSources(row),byKey=new Map(sources.map(source=>[source.key,source]));
  const requirements=records(plan.requirements).map(requirement=>{
    const source=byKey.get(requirement.sourceKey),waived=!!requirement.waiver?.reason,status=waived?'waived':!source?'missing':requirement.review?.sourceFingerprint===source.fingerprint?'ready':'received';
    return {id:requirement.id,label:requirement.label,required:requirement.required===true,sourceKey:source?.key||requirement.sourceKey||'',sourceLabel:source?.label||'',status,sourceFingerprint:source?.fingerprint||'',waiverReason:requirement.waiver?.reason||''};
  });
  const strategy=strategyOf(row.studio?.strategy),readiness=strategyReadiness(strategy.data),confirmed=!!(strategy.revision>0&&strategy.confirmation?.strategyRevision===strategy.revision),confirmedDeadline=validDate(row.dueDate)?row.dueDate:'',requestedDeadline=strategy.data.proposedDeadline||row.intake?.requestedDeadline||'';
  const checks=[
    {id:'strategy',label:'제작 기획 필수 항목',status:readiness.ready?'ready':'missing',text:readiness.ready?'제작 기획의 필수 항목이 작성돼 있습니다.':'기획에서 확인할 항목: '+readiness.missing.map(key=>labels[key]||key).join(', ')},
    {id:'confirmation',label:'현재 제작 기획 고객 확인',status:confirmed?'ready':'missing',text:confirmed?'고객이 현재 제작 기획을 확인했습니다.':'최신 제작 기획의 고객 확인이 필요합니다.'},
    {id:'deadline',label:'합의한 전달일',status:confirmedDeadline?'ready':'missing',text:confirmedDeadline?'프로젝트에 기록된 합의 전달일: '+confirmedDeadline:'희망 일정과 별도로 프로젝트에 합의한 전달일을 기록해 주세요.'},
    {id:'terms',label:'합의한 제작 조건',status:typeof row.terms==='string'&&row.terms.trim()?'ready':'missing',text:typeof row.terms==='string'&&row.terms.trim()?'프로젝트에 합의한 제작 조건이 기록돼 있습니다.':'프로젝트에 합의한 제작 범위와 조건을 기록해 주세요.'},
  ];
  const missingCount=requirements.filter(item=>item.required&&!['ready','waived'].includes(item.status)).length+checks.filter(check=>check.status==='missing').length;
  const status=row.stage==='archived'?'archived':!enabled?'disabled':missingCount?'waiting':'ready';
  const requested=requirements.filter(item=>item.required&&item.status==='missing'),received=requirements.filter(item=>item.required&&item.status==='received'),missingChecks=checks.filter(check=>check.status==='missing');
  const requestText=!enabled?'':missingCount?[row.title+' 제작 착수 전에 아래 항목을 확인해 주세요.',...(requested.length?['필요한 자료: '+requested.map(item=>item.label).join(', '),'고객 작업실에서 자료를 올리거나 기존 자료를 항목에 연결해 주세요.']:[]),...(received.length?['담당자 내용 확인 대기: '+received.map(item=>item.label).join(', ')+' (자료를 다시 보내지 않으셔도 됩니다.)']:[]),...(missingChecks.length?['함께 확인할 사항: '+missingChecks.map(check=>check.label).join(', ')]:[]),...(dueDate?['자료 확인일: '+dueDate]:[])].join('\n'):row.title+'의 제작 착수 전 자료와 확정사항 확인이 완료됐습니다.';
  return {enabled,dueDate,status,statusLabel:statuses[status],canEdit:!!canEdit&&row.stage!=='archived',overdue:status==='waiting'&&row.stage!=='delivered'&&!!dueDate&&day(now)>=dueDate,requirements,sources:sources.map(sourceFields),checks,missingCount,requestText,confirmedDeadline,requestedDeadline};
}

export function customerClientKickoff(row,{now=new Date().toISOString()}={}){
  const report=buildClientKickoff(row,{now}),sources=clientKickoffSources(row,{customer:true}),visible=new Set(sources.map(source=>source.key));
  return {enabled:report.enabled,dueDate:report.dueDate,status:report.status,statusLabel:report.statusLabel,overdue:report.overdue,requirements:report.requirements.map(({waiverReason,sourceFingerprint,...item})=>visible.has(item.sourceKey)?item:{...item,sourceKey:'',sourceLabel:''}),sources:sources.map(sourceFields),checks:report.checks,missingCount:report.missingCount,confirmedDeadline:report.confirmedDeadline,requestedDeadline:row.studio?.strategy?.data?.proposedDeadline||''};
}

// Returns a new plan; caller owns ACL, latest project revision, transaction,
// durable project history, and the one authoritative project write.
export function applyClientKickoffAction(row,input,{actor,at,customer=false}={}){
  const fields={configure:['enabled','dueDate','requirements'],link:['requirementId','sourceKey'],review:['requirementId','sourceFingerprint','confirmed'],waive:['requirementId','reason'],reset:['requirementId'],submit_kickoff_source:['requirementId','sourceKey']};
  if(!obj(input)||!Object.hasOwn(fields,input.action))throw fail('착수 점검 요청을 확인해 주세요.');keys(input,['action','revision',...fields[input.action]]);
  if(customer?input.action!=='submit_kickoff_source':input.action==='submit_kickoff_source')throw fail('이 화면에서 처리할 수 없는 착수 점검 요청입니다.',403);
  const previous=row.kickoffPlan||{enabled:false,dueDate:'',requirements:[]},plan=structuredClone(previous),sources=clientKickoffSources(row,{customer}),byKey=new Map(sources.map(source=>[source.key,source]));
  function sourceKey(value){const key=text(value,100);if(key&&!byKey.has(key))throw fail('현재 프로젝트에서 확인할 수 있는 자료를 선택해 주세요.',404);return key;}
  if(input.action==='configure'){
    if(typeof input.enabled!=='boolean'||!validDate(input.dueDate)||!Array.isArray(input.requirements)||input.requirements.length>20)throw fail('사용 여부·자료 확인일과 20개 이하의 자료 항목을 확인해 주세요.');
    const usedIds=new Set(),usedLabels=new Set();
    plan.requirements=input.requirements.map(value=>{
      keys(value,['id','label','required','sourceKey']);if(typeof value.required!=='boolean')throw fail('필수 자료 여부를 확인해 주세요.');
      const label=text(value.label,120,true),normalized=label.toLocaleLowerCase();if(usedLabels.has(normalized))throw fail('같은 이름의 자료 항목을 중복 등록할 수 없습니다.');usedLabels.add(normalized);
      let old=null;if(value.id!==undefined){if(typeof value.id!=='string'||!uuid.test(value.id)||usedIds.has(value.id))throw fail('자료 항목을 중복 없이 확인해 주세요.');old=records(previous.requirements).find(item=>item.id===value.id);if(!old)throw fail('이미 삭제됐거나 다른 프로젝트의 자료 항목입니다.',409);}
      const id=old?.id||randomUUID();usedIds.add(id);const selected=value.sourceKey===undefined?old?.sourceKey||'':sourceKey(value.sourceKey),unchanged=old&&old.label===label&&old.required===value.required&&old.sourceKey===selected;
      return {id,label,required:value.required,sourceKey:selected,...(unchanged&&old.review?{review:old.review}:{}),...(unchanged&&old.waiver?{waiver:old.waiver}:{})};
    });
    plan.enabled=input.enabled;plan.dueDate=input.dueDate;
    if(JSON.stringify({enabled:previous.enabled,dueDate:previous.dueDate,requirements:previous.requirements})===JSON.stringify({enabled:plan.enabled,dueDate:plan.dueDate,requirements:plan.requirements}))throw fail('변경한 착수 점검 설정이 없습니다.',409);
  }else{
    if(plan.enabled!==true)throw fail('담당자가 착수 점검을 먼저 설정해야 합니다.',409);
    const requirement=records(plan.requirements).find(item=>item.id===input.requirementId);if(!requirement)throw fail('착수 자료 항목을 찾을 수 없습니다.',404);
    if(customer&&requirement.waiver)throw fail('담당자가 이번 제작에서 제외한 자료입니다. 담당자에게 다시 확인해 주세요.',409);
    if(['link','submit_kickoff_source'].includes(input.action)){
      const selected=sourceKey(input.sourceKey);if(!selected)throw fail('연결할 자료를 선택해 주세요.');if(requirement.sourceKey===selected&&!requirement.waiver)throw fail('이미 연결한 자료입니다. 최신 상태를 확인해 주세요.',409);
      requirement.sourceKey=selected;delete requirement.review;delete requirement.waiver;
    }else if(input.action==='review'){
      if(input.confirmed!==true)throw fail('자료 내용을 확인한 뒤 사용 가능으로 표시해 주세요.');const source=byKey.get(requirement.sourceKey);
      if(!source||!input.sourceFingerprint||source.fingerprint!==input.sourceFingerprint)throw fail('자료가 변경됐거나 삭제됐습니다. 최신 원본을 다시 확인해 주세요.',409);
      if(requirement.review?.sourceFingerprint===source.fingerprint&&!requirement.waiver)throw fail('이미 사용 가능으로 확인한 자료입니다.',409);
      requirement.review={sourceFingerprint:source.fingerprint,actor,at};delete requirement.waiver;
    }else if(input.action==='waive'){
      if(requirement.waiver)throw fail('이미 제외한 자료 항목입니다.',409);requirement.waiver={reason:text(input.reason,600,true),actor,at};delete requirement.review;
    }else{
      if(!requirement.review&&!requirement.waiver)throw fail('취소할 확인·제외 기록이 없습니다.',409);delete requirement.review;delete requirement.waiver;
    }
  }
  return {...plan,updatedAt:at,updatedBy:actor};
}
