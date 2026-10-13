import {createHash,randomUUID} from 'node:crypto';
import {clientDeliveryIdentity} from './client-closeout.mjs';
import {buildClientRightsReminders,clientRightsSourceVisible} from './client-rights-reminders.mjs';
import {clientMaterialSourceFingerprint} from './client-material-usage.mjs';

const KIND='clientRights',LIMIT=500;
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const fingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const validHash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const validTarget=value=>value==='portfolio'||typeof value==='string'&&/^material:(?:intake|asset|reference|concept|scene|version):[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const text=(value,max)=>{if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value))throw fail('사용 조건 글이 너무 길거나 비어 있어요.');return value.trim();};
const day=value=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)throw fail('확인일과 만료일을 다시 봐 주세요.');return value;};
export function clientRightsToday(value){const at=Date.parse(value);if(!Number.isFinite(at))throw fail('서버 시계를 읽지 못했어요. 잠시 뒤 다시 해 주세요.',503);return new Date(at+9*3600000).toISOString().slice(0,10);}
function fields(input,today){
  if(!['unconfirmed','allowed','denied'].includes(input.status)||!['unknown','none','date'].includes(input.expiryMode)||typeof input.agreedAt!=='string'||typeof input.expiresAt!=='string')throw fail('써도 되는지와 기간을 골라 주세요.');
  const value={status:input.status,scope:text(input.scope,1000),evidence:text(input.evidence,2000),agreedAt:input.agreedAt?day(input.agreedAt):'',expiryMode:input.expiryMode,expiresAt:input.expiresAt?day(input.expiresAt):''};
  if(value.agreedAt&&today&&value.agreedAt>today)throw fail('확인일은 오늘이나 그 전 날짜로 적어 주세요.');
  if(value.expiryMode==='date'&&!value.expiresAt||value.expiryMode!=='date'&&value.expiresAt)throw fail('만료일이 있는지 없는지 골라 주세요.');
  if(value.expiresAt&&value.agreedAt&&value.expiresAt<value.agreedAt)throw fail('만료일이 확인일보다 빠를 수는 없어요.');
  if(value.status==='allowed'&&(!value.scope||!value.evidence||!value.agreedAt||value.expiryMode==='unknown'))throw fail('「써도 됨」으로 적으려면 범위·근거·확인일·기간이 다 있어야 해요.');
  return value;
}

// Internal evidence is encrypted separately, never attached to customer-visible
// project snapshots. These are staff records, not an assertion of legal rights.
export function createClientRightsService({store,clientProjects,clientMaterials,clientMaterialUsage=null,clock=()=>new Date().toISOString()}){
  function current(user){const live=typeof user?.id==='string'&&store.get('users',user.id);if(!live?.active||!['admin','manager','member','viewer'].includes(live.role))throw fail('로그인이 풀렸어요. 다시 로그인해 주세요.',401);return live;}
  const editable=(user,project)=>project.stage!=='archived'&&user.role!=='viewer'&&(user.role==='admin'||project.ownerId===user.id||user.role==='manager'&&user.teamId&&user.teamId===project.teamId);
  function read(projectId){
    const row=store.get(KIND,projectId);if(!row)return {revision:0,records:[]};
    try{if(row.schema!==1||row.projectId!==projectId||!Number.isSafeInteger(row.revision)||row.revision<1||typeof row.ciphertext!=='string')throw new Error();const body=store.decrypt(row.ciphertext);if(body.projectId!==projectId||body.revision!==row.revision||!Array.isArray(body.records)||body.records.length!==row.revision||body.records.length>LIMIT)throw new Error();
      for(const record of body.records){if(!object(record)||typeof record.id!=='string'||!validTarget(record.targetId)||!validHash(record.sourceFingerprint)||typeof record.label!=='string'||typeof record.actorId!=='string'||typeof record.actorName!=='string'||!Number.isFinite(Date.parse(record.recordedAt)))throw new Error();fields(record);}
      return {revision:row.revision,records:body.records};
    }catch{throw fail('사용 조건 기록을 읽지 못했어요.',500);}
  }
  function source(user,project){
    const materials=clientMaterials.workspace(user,project.id);if(materials.projectId!==project.id||materials.revision!==project.revision||!Array.isArray(materials.items)||materials.items.length>5000)throw fail('자료 목록을 읽지 못했어요.',503);
    const items=materials.items.filter(item=>validTarget('material:'+item.id)).map(item=>({targetId:'material:'+item.id,kind:'material',label:item.label,category:item.category,available:item.status!=='unavailable',sourceFingerprint:clientMaterialSourceFingerprint(project.id,item),current:item.current}));
    const delivery=clientDeliveryIdentity(project),finals=delivery.finals.map(version=>materials.items.find(item=>item.id==='version:'+version.id)),available=!!delivery.deliveryKey&&finals.every(item=>item&&item.status!=='unavailable');
    items.push({targetId:'portfolio',kind:'portfolio',label:'최종본 포트폴리오 공개 동의',category:'portfolio',available,hasDelivery:!!delivery.deliveryKey,sourceFingerprint:fingerprint({projectId:project.id,deliveryKey:delivery.deliveryKey,files:finals.map(item=>item?{id:item.id,openUrl:item.openUrl,status:item.status}:null)}),current:true,files:delivery.finals.map(({id,label})=>({id,label}))});
    return items;
  }
  function reminderItems(user,project,items){
    if(user.role==='viewer'||project.ownerId!==user.id||!clientRightsSourceVisible(project))return [];
    const visibleTargets=new Set();
    for(const [kind,rows]of [['intake',project.intake?.files],['asset',project.studio?.assets],['reference',project.studio?.references],['concept',project.studio?.concepts],['scene',project.studio?.scenes],['version',project.versions]])for(const row of rows||[])if(clientRightsSourceVisible(row))visibleTargets.add(`material:${kind}:${row.id}`);
    return items.filter(item=>item.kind==='portfolio'?item.files?.every(file=>visibleTargets.has('material:version:'+file.id)):visibleTargets.has(item.targetId));
  }
  function view(user,project,saved=read(project.id)){
    const generatedAt=clock(),today=clientRightsToday(generatedAt),targets=source(user,project),latest=new Map();for(const record of saved.records)latest.set(record.targetId,record);
    const usage=clientMaterialUsage?clientMaterialUsage.reminderExclusions(user,project.id):null,excluded=new Map();
    if(usage){if(usage.projectId!==project.id||usage.projectRevision!==project.revision||!Array.isArray(usage.targets))throw fail('쓴 자료 표시를 읽지 못했어요.',503);for(const target of usage.targets)if(target.targetId!=='portfolio'&&validTarget(target.targetId)&&validHash(target.sourceFingerprint))excluded.set(target.targetId,target.sourceFingerprint);}
    const items=targets.map(target=>{const record=latest.get(target.targetId)||null,appliesToCurrent=!!record&&record.sourceFingerprint===target.sourceFingerprint,issues=[];
      if(!target.available)issues.push(target.kind==='portfolio'&&!target.hasDelivery?'no_delivery':'source_unavailable');
      if(!record||!appliesToCurrent||record.status==='unconfirmed')issues.push(!record?'unconfirmed':!appliesToCurrent?'source_changed':'unconfirmed');
      if(appliesToCurrent){if(record.status==='denied')issues.push('denied');if(!record.evidence)issues.push('evidence_missing');if(record.status==='allowed'){if(!record.scope)issues.push('scope_missing');if(!record.agreedAt)issues.push('date_missing');if(record.expiryMode==='unknown')issues.push('expiry_missing');if(record.expiryMode==='date'&&record.expiresAt<today)issues.push('expired');}}
      const effectiveStatus=!appliesToCurrent?'unconfirmed':record.status==='allowed'&&issues.includes('expired')?'expired':record.status;
      return {...target,record,appliesToCurrent,effectiveStatus,issues,referenceOnly:target.kind==='material'&&excluded.get(target.targetId)===target.sourceFingerprint};});
    const currentTargets=new Map(targets.map(target=>[target.targetId,target.sourceFingerprint]));
    return {projectId:project.id,projectRevision:project.revision,revision:saved.revision,today,generatedAt,canEdit:editable(user,project),items,reminders:buildClientRightsReminders({projectId:project.id,projectRevision:project.revision,revision:saved.revision,today,generatedAt,items:reminderItems(user,project,items)}),history:[...saved.records].reverse().map(record=>({...record,currentTarget:currentTargets.get(record.targetId)===record.sourceFingerprint})),summary:{total:items.filter(item=>item.kind==='material').length,unconfirmed:items.filter(item=>item.kind==='material'&&item.effectiveStatus==='unconfirmed').length,expired:items.filter(item=>item.kind==='material'&&item.effectiveStatus==='expired').length,denied:items.filter(item=>item.kind==='material'&&item.effectiveStatus==='denied').length,missingEvidence:items.filter(item=>item.kind==='material'&&item.issues.includes('evidence_missing')).length,portfolioStatus:items.at(-1).effectiveStatus}};
  }
  function workspace(user,projectId){user=current(user);return view(user,clientProjects.project(user,projectId));}
  function reminders(user,projectId){
    user=current(user);const project=clientProjects.project(user,projectId),generatedAt=clock(),empty={projectId,projectRevision:project.revision,revision:0,today:clientRightsToday(generatedAt),generatedAt,items:[]};
    if(user.role==='viewer'||project.ownerId!==user.id||!clientRightsSourceVisible(project))return buildClientRightsReminders(empty);
    // Avoid assembling every material in projects with no rights records.
    const saved=read(projectId);if(!saved.records.length)return buildClientRightsReminders(empty);
    return view(user,project,saved).reminders;
  }
  function save(user,projectId,input){
    user=current(user);if(!object(input)||Object.keys(input).some(key=>!['expectedRevision','projectRevision','targetId','sourceFingerprint','status','scope','evidence','agreedAt','expiryMode','expiresAt'].includes(key))||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0||!Number.isSafeInteger(input.projectRevision)||input.projectRevision<1||!validTarget(input.targetId)||!validHash(input.sourceFingerprint))throw fail('어느 자료인지 정보가 이상해요.');
    const value=fields(input,clientRightsToday(clock()));
    return store.transaction(()=>{const live=current(user),project=clientProjects.project(live,projectId,true),saved=read(projectId);if(!editable(live,project))throw fail('사용 조건은 이 프로젝트의 담당자나 관리자만 적을 수 있어요.',403);
      if(saved.revision!==input.expectedRevision||project.revision!==input.projectRevision)throw fail('그사이 바뀐 게 있어요. 쓰던 내용은 그대로니 새로 불러와 비교해 주세요.',409);
      const target=source(live,project).find(item=>item.targetId===input.targetId);if(!target)throw fail('그 자료를 목록에서 찾지 못했어요.',404);if(target.sourceFingerprint!==input.sourceFingerprint)throw fail('자료나 최종본이 바뀌었어요. 다시 보고 적어 주세요.',409);if(target.kind==='portfolio'&&!target.available)throw fail(target.hasDelivery?'최종본 파일·링크부터 봐 주세요.':'승인한 시안의 최종본을 먼저 올려 주세요.',409);
      if(saved.records.length>=LIMIT)throw fail('사용 조건 기록이 500개예요. 새 프로젝트로 이어 주세요.',409);
      const revision=saved.revision+1,record={id:randomUUID(),targetId:target.targetId,sourceFingerprint:target.sourceFingerprint,label:target.label,...value,actorId:live.id,actorName:live.name||'담당자',recordedAt:clock()};
      store.put(KIND,projectId,{schema:1,projectId,revision,ciphertext:store.encrypt({projectId,revision,records:[...saved.records,record]})});return view(live,project);
    });
  }
  return Object.freeze({workspace,save,reminders});
}
