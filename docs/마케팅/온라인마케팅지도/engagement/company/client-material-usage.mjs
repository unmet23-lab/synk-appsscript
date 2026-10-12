import {createHash,randomUUID} from 'node:crypto';
import {clientDeliveryIdentity} from './client-closeout.mjs';

const KIND='clientMaterialUsage',LIMIT=500;
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const validHash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const originalTarget=value=>typeof value==='string'&&/^material:(?:intake|asset|reference|concept|scene):[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const states=new Set(['used','reference','undecided']);
export const CLIENT_MATERIAL_USAGE_LABELS=Object.freeze({used:'실제 사용함',reference:'참고만',undecided:'미정'});
export const clientMaterialSourceVisible=row=>!!row&&row.active!==false&&row.hidden!==true&&row.deleted!==true&&!row.deletedAt&&row.visibility!=='hidden';

// Keep the #31 rights identity stable while sharing exactly the same current
// material identity with the separate, encrypted usage classification.
export const clientMaterialSourceFingerprint=(projectId,item)=>hash({projectId,id:item.id,label:item.label,fileName:item.fileName,category:item.category,openUrl:item.openUrl,downloadUrl:item.downloadUrl,mimeType:item.mimeType,byteSize:item.byteSize,updatedAt:item.updatedAt,current:item.current});

export function createClientMaterialUsageService({store,clientProjects,clientMaterials,clock=()=>new Date().toISOString()}){
  function current(user){const live=typeof user?.id==='string'&&store.get('users',user.id);if(!live?.active||!['admin','manager','member','viewer'].includes(live.role))throw fail('로그인 상태를 다시 확인해 주세요.',401);return live;}
  const editable=(user,project)=>project.stage!=='archived'&&user.role!=='viewer'&&(user.role==='admin'||project.ownerId===user.id||user.role==='manager'&&user.teamId&&user.teamId===project.teamId);
  function projectFor(user,projectId,write=false){const project=clientProjects.project(user,projectId,write);if(!clientMaterialSourceVisible(project))throw fail('현재 프로젝트를 찾을 수 없습니다.',404);return project;}
  function read(projectId){
    const envelope=store.get(KIND,projectId);if(!envelope)return {revision:0,records:[]};
    try{
      if(envelope.schema!==1||envelope.projectId!==projectId||!Number.isSafeInteger(envelope.revision)||envelope.revision<1||typeof envelope.ciphertext!=='string')throw new Error();
      const data=store.decrypt(envelope.ciphertext);
      if(data.projectId!==projectId||data.revision!==envelope.revision||!Array.isArray(data.records)||data.records.length!==data.revision||data.records.length>LIMIT)throw new Error();
      for(const row of data.records)if(!object(row)||typeof row.id!=='string'||!originalTarget(row.targetId)||!validHash(row.contextFingerprint)||!validHash(row.sourceFingerprint)||!states.has(row.status)||typeof row.label!=='string'||row.label.length>3000||typeof row.actorId!=='string'||typeof row.actorName!=='string'||!Number.isFinite(Date.parse(row.recordedAt)))throw new Error();
      return {revision:data.revision,records:data.records};
    }catch{throw fail('자료 사용 구분 기록을 읽지 못했습니다. 기존 기록을 확인해 주세요.',500);}
  }
  function snapshot(user,project){
    const materials=clientMaterials.workspace(user,project.id);
    if(materials.projectId!==project.id||materials.revision!==project.revision||!Array.isArray(materials.items)||materials.items.length>5000)throw fail('현재 자료 목록을 확인하지 못했습니다.',503);
    const visibleTargets=new Set();for(const [kind,rows]of [['intake',project.intake?.files],['asset',project.studio?.assets],['reference',project.studio?.references],['concept',project.studio?.concepts],['scene',project.studio?.scenes],['version',project.versions]])for(const row of rows||[])if(clientMaterialSourceVisible(row))visibleTargets.add(`material:${kind}:${row.id}`);
    const delivery=clientDeliveryIdentity(project),finalIds=new Set(delivery.finals.map(row=>'version:'+row.id)),finalMediaIds=new Set(delivery.finals.map(row=>row.media?.id).filter(Boolean)),all=materials.items.filter(item=>visibleTargets.has('material:'+item.id)),finalUrls=new Set(all.filter(item=>finalIds.has(item.id)).map(item=>item.openUrl).filter(Boolean));
    const hasDelivery=!!delivery.deliveryKey,deliveryAvailable=hasDelivery&&clientMaterialSourceVisible(delivery.approvedPreview)&&delivery.finals.every(row=>clientMaterialSourceVisible(row)&&all.some(item=>item.id==='version:'+row.id&&item.status!=='unavailable'));
    return {hasDelivery,deliveryAvailable,contextFingerprint:hash({projectId:project.id,deliveryKey:delivery.deliveryKey}),delivery:{approvedPreviewId:delivery.approvedPreviewId,label:delivery.approvedPreview?.label||'',finals:delivery.finals.map(row=>({id:row.id,label:row.label}))},items:all.filter(item=>originalTarget('material:'+item.id)||finalIds.has(item.id)).map(item=>({targetId:'material:'+item.id,materialId:item.id,label:item.label,fileName:item.fileName||'',category:item.category,kind:item.kind,current:item.current!==false,available:item.status!=='unavailable',isCurrentFinal:finalIds.has(item.id)||item.id.startsWith('asset:')&&finalMediaIds.has(item.id.slice('asset:'.length))||!!item.openUrl&&finalUrls.has(item.openUrl),sourceFingerprint:clientMaterialSourceFingerprint(project.id,item)}))};
  }
  function view(user,project,saved=read(project.id)){
    const generatedAt=clock();if(!Number.isFinite(Date.parse(generatedAt)))throw fail('서버 시각을 확인하지 못했습니다.',503);
    const source=snapshot(user,project),latest=new Map(saved.records.map(row=>[row.targetId,row])),canEdit=editable(user,project)&&source.deliveryAvailable;
    const items=source.items.map(target=>{
      const record=latest.get(target.targetId)||null,appliesToCurrent=!!record&&source.deliveryAvailable&&record.contextFingerprint===source.contextFingerprint&&record.sourceFingerprint===target.sourceFingerprint&&target.current&&target.available,stale=!!record&&!appliesToCurrent;
      const status=target.isCurrentFinal?'used':appliesToCurrent?record.status:'undecided',itemEditable=canEdit&&target.current&&target.available&&!target.isCurrentFinal;
      const reason=target.isCurrentFinal?'현재 최종 납품 파일은 실제 사용 항목으로 고정됩니다.':!source.hasDelivery?'현재 승인 시안에 연결된 최종본을 등록한 뒤 사용 구분을 기록할 수 있습니다.':!source.deliveryAvailable?'현재 최종 납품 파일·링크를 먼저 확인해 주세요.':!target.available?'원본 파일·링크를 먼저 확인해 주세요.':!target.current?'이전 자료는 현재 납품의 사용 구분 대상이 아닙니다.':stale?'자료나 최종 납품 묶음이 바뀌었습니다. 현재 사용 여부를 다시 확인해 주세요.':project.stage==='archived'?'보관을 해제한 뒤 사용 구분을 변경할 수 있습니다.':!editable(user,project)?'프로젝트 담당자 또는 관리자만 사용 구분을 기록할 수 있습니다.':'';
      return {...target,status,statusLabel:CLIENT_MATERIAL_USAGE_LABELS[status],appliesToCurrent,stale,canEdit:itemEditable,reason,record:record?{id:record.id,status:record.status,recordedAt:record.recordedAt,actorName:record.actorName}:null};
    });
    const originals=items.filter(item=>!item.isCurrentFinal);
    return {schema:1,projectId:project.id,projectRevision:project.revision,revision:saved.revision,generatedAt,contextFingerprint:source.contextFingerprint,hasDelivery:source.hasDelivery,deliveryAvailable:source.deliveryAvailable,delivery:source.delivery,canEdit,items,summary:{total:originals.length,used:originals.filter(item=>item.status==='used').length,reference:originals.filter(item=>item.status==='reference').length,undecided:originals.filter(item=>item.status==='undecided').length,stale:originals.filter(item=>item.stale).length,currentFinals:items.length-originals.length}};
  }
  function workspace(user,projectId){user=current(user);return view(user,projectFor(user,projectId));}
  function save(user,projectId,input){
    user=current(user);
    if(!object(input)||Object.keys(input).some(key=>!['expectedRevision','projectRevision','contextFingerprint','targetId','sourceFingerprint','status'].includes(key))||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0||!Number.isSafeInteger(input.projectRevision)||input.projectRevision<1||!validHash(input.contextFingerprint)||!originalTarget(input.targetId)||!validHash(input.sourceFingerprint)||!states.has(input.status))throw fail('자료 사용 구분의 대상·버전·상태를 확인해 주세요.');
    return store.transaction(()=>{
      const live=current(user),project=projectFor(live,projectId,true),saved=read(projectId);
      if(!editable(live,project))throw fail('프로젝트 담당자 또는 관리자만 사용 구분을 기록할 수 있습니다.',403);
      if(saved.revision!==input.expectedRevision||project.revision!==input.projectRevision)throw fail('프로젝트나 사용 구분이 바뀌었습니다. 최신 자료를 다시 확인해 주세요.',409);
      const source=snapshot(live,project);if(!source.hasDelivery||!source.deliveryAvailable)throw fail('현재 승인 시안의 최종 납품 파일·링크를 먼저 확인해 주세요.',409);
      if(source.contextFingerprint!==input.contextFingerprint)throw fail('현재 최종 납품 묶음이 바뀌었습니다. 사용 여부를 다시 확인해 주세요.',409);
      const target=source.items.find(item=>item.targetId===input.targetId);if(!target)throw fail('현재 자료 목록에서 이 대상을 찾을 수 없습니다.',404);
      if(target.sourceFingerprint!==input.sourceFingerprint||!target.available||!target.current||target.isCurrentFinal)throw fail('자료가 바뀌었거나 현재 사용 구분을 기록할 수 없습니다. 최신 자료를 다시 확인해 주세요.',409);
      if(saved.records.length>=LIMIT)throw fail('사용 구분 이력 500개를 보존 중입니다. 기존 기록을 보관하고 새 프로젝트로 이어가 주세요.',409);
      // Repeating an unchanged classification is a successful read, not another
      // event. The caller still has to provide the latest CAS revision.
      const previous=saved.records.findLast(row=>row.targetId===target.targetId);if(previous?.status===input.status&&previous.contextFingerprint===source.contextFingerprint&&previous.sourceFingerprint===target.sourceFingerprint)return view(live,project,saved);
      const recordedAt=clock();if(!Number.isFinite(Date.parse(recordedAt)))throw fail('서버 시각을 확인하지 못했습니다.',503);
      const revision=saved.revision+1,record={id:randomUUID(),targetId:target.targetId,contextFingerprint:source.contextFingerprint,sourceFingerprint:target.sourceFingerprint,label:target.label,status:input.status,actorId:live.id,actorName:live.name||'담당자',recordedAt};
      store.put(KIND,projectId,{schema:1,projectId,revision,ciphertext:store.encrypt({projectId,revision,records:[...saved.records,record]})});return view(live,project,{revision,records:[...saved.records,record]});
    });
  }
  function reminderExclusions(user,projectId){
    user=current(user);const project=projectFor(user,projectId),saved=read(projectId);
    if(!saved.records.length)return {projectId,projectRevision:project.revision,revision:0,targets:[]};
    const data=view(user,project,saved);
    return {projectId,projectRevision:project.revision,revision:data.revision,targets:data.items.filter(item=>!item.isCurrentFinal&&item.appliesToCurrent&&item.status==='reference').map(item=>({targetId:item.targetId,sourceFingerprint:item.sourceFingerprint}))};
  }
  return Object.freeze({workspace,save,reminderExclusions});
}
