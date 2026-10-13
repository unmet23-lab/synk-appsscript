import {createHash} from 'node:crypto';
import {CLIENT_STAGES} from './client-projects.mjs';
import {buildClientCloseout,clientDeliveryIdentity} from './client-closeout.mjs';
import {buildSceneRequests} from './client-scene-requests.mjs';

const rows=value=>Array.isArray(value)?value:[];
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const instant=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const visible=value=>value&&!value.deleted&&!value.deletedAt&&!value.hidden&&!['private','hidden','deleted'].includes(value.visibility);
const statusLabels={no_delivery:'납품 전',waiting_receipt:'고객이 받았다고 안 함',follow_up:'더 볼 것 있음',ready:'마감 전',closed:'마감함',archived:'보관함 · 완료 판정 아님'};
const rightsLabels={unconfirmed:'아직 안 봄',allowed:'써도 됨',denied:'안 됨',expired:'기간 지남'};
const issueLabels={unconfirmed:'아직 안 봄',source_changed:'원본이 바뀜 · 다시 볼 것',source_unavailable:'파일·링크 볼 것',no_delivery:'최종본 올리기 전',denied:'안 됨',evidence_missing:'근거 없음',scope_missing:'범위 없음',date_missing:'확인일 없음',expiry_missing:'기간 모름',expired:'기간 지남'};
const actions={start:'시작',submit:'고친 장면 제출',submit_review:'고친 시안 제출',accept:'검토 통과',request_changes:'더 고치기',reopen:'다시 열기',complete:'답변 끝',customer_confirm:'고객이 장면 확인',customer_changes:'고객이 더 고쳐 달라고 함'};
const sourceStamp=row=>hash(Object.fromEntries(['id','revision','title','customerName','stage','dueDate','ownerId','reviewerId','teamId','versions','messages','studio','sceneRequestWorkflows','deliveryReceipts','closureHistory','closeoutWorkRevision','followUpHistory','nextContactDate'].map(key=>[key,row[key]])));

export function createClientCompletionRecordsService({store,clientProjects,clientMaterials,clientRights,clock=()=>new Date().toISOString()}){
  function current(user){const live=typeof user?.id==='string'&&store.get('users',user.id);if(!live?.active||!['admin','manager','member','viewer'].includes(live.role))throw fail('직원 계정으로 먼저 로그인해 주세요.',401);return live;}
  function prepare(user,projectId){
    user=current(user);if(!uuid(projectId))throw fail('프로젝트를 찾지 못했어요.');
    const project=clientProjects.project(user,projectId),stamp=sourceStamp(project),generatedAt=clock();
    if(!instant(generatedAt))throw fail('기준 시각을 읽지 못했어요.',503);
    const materials=clientMaterials.workspace(user,projectId),rights=clientRights.workspace(user,projectId);
    if(materials.projectId!==projectId||materials.revision!==project.revision||!Array.isArray(materials.items)||rights.projectId!==projectId||rights.projectRevision!==project.revision||!Array.isArray(rights.items)||!Array.isArray(rights.history))throw fail('자료와 사용 조건을 같이 읽지 못했어요. 다시 준비해 주세요.',503);
    const fresh=current(user),freshProject=clientProjects.project(fresh,projectId);
    if(fresh.role!==user.role||fresh.teamId!==user.teamId||sourceStamp(freshProject)!==stamp)throw fail('준비하는 사이 프로젝트나 권한이 바뀌었어요. 다시 준비해 주세요.',409);
    let externalAddressesOmitted=0,characters=0,totalRows=0;
    function text(value){
      if(value===null||value===undefined)return '';
      if(typeof value!=='string')return typeof value==='number'||typeof value==='boolean'?String(value):'';
      return value.replace(/(?:[a-z][a-z0-9+.-]{0,31}:\/\/|www\.|\/\/(?=[a-z0-9.-]+\.[a-z])|mailto:|tel:|data:|javascript:)[^\s<>"'\u0000-\u001f]+/gi,()=>{externalAddressesOmitted++;return '[외부 주소 생략]';});
    }
    const workroom=(extra={})=>'/?'+new URLSearchParams({tab:'workroom',section:'clients',project:projectId,...extra});
    const versionLink=id=>workroom(uuid(id)?{version:id}:{record:'1'});
    const messageLink=message=>workroom({...((uuid(message.versionId)&&rows(project.versions).some(row=>row.id===message.versionId))?{version:message.versionId}:{}),...(uuid(message.id)?{message:message.id}:{}),...(Number.isFinite(message.seconds)&&message.seconds>=0?{seconds:String(message.seconds)}:{})});
    const sceneLink=id=>uuid(id)?'/pulse-app/?'+new URLSearchParams({mode:'staff',project:projectId,tab:'history',review:id}):workroom({requests:'1'});
    const historyText=history=>rows(history).map(entry=>`${actions[entry.action]||'처리 기록'} · ${instant(entry.at)?entry.at:'시각 확인 필요'}`).join('\n');
    const period=record=>record?.expiryMode==='none'?'기간 제한 없음 확인':record?.expiryMode==='date'?text(record.expiresAt)+'까지 · 한국 날짜 포함':'기간 모름';
    const sections=[];
    function section(id,title,columns,items){
      totalRows+=items.length;if(totalRows>2000)throw fail('기록이 2,000행을 넘어 한 번에 내보낼 수 없습니다. 원문은 그대로 보존되어 있습니다.',413);
      const normalized=items.map(item=>Object.fromEntries(columns.map(([key])=>{const value=item[key]??'';if(!['string','number','boolean'].includes(typeof value))throw fail('보고서 항목을 확인하지 못했습니다.',503);characters+=String(value).length;if(characters>1000000)throw fail('기록 본문이 100만 자를 넘어 한 번에 내보낼 수 없습니다. 원문은 그대로 보존되어 있습니다.',413);return [key,value];})));
      sections.push({id,title,columns:columns.map(([key,label])=>({key,label})),rows:normalized});
    }
    const versions=rows(project.versions).filter(visible),preview=versions.filter(row=>row.kind==='preview').at(-1),approved=instant(preview?.approvedAt),delivery=clientDeliveryIdentity({...project,versions}),materialMap=new Map(materials.items.map(item=>[item.id,item]));
    const finals=delivery.finals,filesAvailable=!!finals.length&&finals.every(version=>{const item=materialMap.get('version:'+version.id);return item&&item.status!=='unavailable';});
    const receipts=rows(project.deliveryReceipts),closures=rows(project.closureHistory),validReceipts=receipts.filter(entry=>entry.actor==='customer'&&instant(entry.confirmedAt)&&uuid(entry.id));
    const currentReceipt=delivery.deliveryKey?validReceipts.findLast(entry=>entry.deliveryKey===delivery.deliveryKey&&entry.approvedPreviewId===delivery.approvedPreviewId&&hash([...rows(entry.versionIds)].sort())===hash(finals.map(row=>row.id).sort())):null;
    const closeout=buildClientCloseout({...project,versions,deliveryReceipts:currentReceipt?[currentReceipt]:[]},{now:generatedAt});
    const customerRequests=rows(project.messages).filter(message=>visible(message)&&message.author==='customer'&&message.visibility==='customer'&&['feedback','support'].includes(message.action));
    const requestData=customerRequests.map(message=>{
      const result=versions.find(version=>version.id===message.workflow?.resultVersionId&&version.kind==='preview'),feedback=message.action==='feedback';
      const done=feedback?message.resolved===true&&message.workflow?.status==='done'&&!!result&&instant(result.approvedAt):message.resolved===true&&instant(message.resolvedAt);
      const process=done?(feedback?'승인된 수정본 연결 확인':'직원 문의 처리 기록'):message.resolved?'처리 표시 있음 · 완료 근거 확인 필요':({open:'확인할 요청',in_progress:'수정 중',review:'내부 검토 대기',changes_requested:'더 고치기',waiting_customer:'고객 확인 대기'}[message.workflow?.status]||'확인할 요청');
      return {message,done,row:{type:feedback?'시안 수정 요청':'고객 문의',requestedAt:text(message.at),request:text(message.text),status:process,resultVersion:text(result?.label),currentResult:!!result&&result.id===preview?.id,completedAt:done?text(message.resolvedAt):'',processingHistory:historyText(message.workflow?.history),source:messageLink(message)}};
    });
    const sceneContext=clientProjects.sceneRequestContext(project,user),sceneReport=buildSceneRequests(project,sceneContext);
    const sceneData=sceneReport.items.filter(item=>visible(rows(project.studio?.sceneReviews).find(review=>review.id===item.id))).map(item=>{
      const workflow=project.sceneRequestWorkflows?.[item.id],proof=rows(project.studio?.sceneReviews).find(review=>review.id===workflow?.customerReviewId);
      const done=item.status==='done'&&visible(proof)&&proof.author==='customer'&&proof.status==='confirmed'&&proof.sceneId===item.sceneId&&proof.sceneRevision===item.currentRevision&&instant(proof.at);
      return {done,row:{scene:text(item.title),requestedAt:text(item.createdAt),request:text(item.text),status:item.status==='done'&&!done?'완료 표시 있음 · 고객 확인 근거 확인 필요':text(item.statusLabel),requestedRevision:item.requestedRevision??'',currentRevision:item.currentRevision??'',resultRevision:item.resultRevision??'',confirmedAt:done?text(proof.at):'',processingHistory:historyText(item.history),source:sceneLink(item.id)}};
    });
    const pendingCustomerRequests=requestData.filter(item=>!item.done).length,pendingSceneRequests=sceneData.filter(item=>!item.done).length;
    let status=closeout.status;if(status!=='archived'&&delivery.deliveryKey&&(!filesAvailable||pendingCustomerRequests||pendingSceneRequests)&&['ready','closed','follow_up'].includes(status))status='follow_up';
    const currentClosure=status==='closed'?closeout.closure:null,warnings=[];
    if(status!=='closed')warnings.push('현재 기록을 내보내며, 이 보고서는 프로젝트 완료를 확정하거나 업무 상태를 바꾸지 않습니다.');
    if(closures.length&&!currentClosure)warnings.push('이전 마감 기록이 있습니다. 저장 당시 요약과 현재 상태를 별도 구역으로 구분했습니다.');
    if(finals.length&&!filesAvailable)warnings.push('최종본 중 파일이나 링크를 열 수 없는 항목이 있어요.');
    if(pendingCustomerRequests)warnings.push(`고객 요청 ${pendingCustomerRequests}건은 어떻게 처리했는지 근거가 더 필요해요.`);
    if(pendingSceneRequests)warnings.push(`장면 수정 요청 ${pendingSceneRequests}건은 고객이 장면을 확인했는지 더 봐야 해요.`);
    if(rights.items.some(item=>item.effectiveStatus!=='allowed'||item.issues.length))warnings.push('자료 사용 조건과 공개 동의에 미확인·기간 경과·거절 또는 원본 확인 항목이 있습니다. 허용 기록은 법적 판단이나 공개 실행을 대신하지 않습니다.');
    section('current_summary','현재 기록 요약 · 생성 시점 기준',[['item','항목'],['value','현재 내용'],['source','내부 원문']], [
      {item:'프로젝트 단계',value:CLIENT_STAGES[project.stage]||'단계 확인 필요',source:workroom({record:'1'})},
      {item:'현재 납품·마감 상태',value:statusLabels[status],source:workroom({closeout:'1'})},
      {item:'합의한 전달일',value:text(project.dueDate)||'미정',source:workroom({record:'1'})},
      {item:'현재 시안 승인',value:approved?text(preview.label)+' · '+preview.approvedAt:'현재 시안의 승인 기록 없음',source:versionLink(preview?.id)},
      {item:'현재 최종 파일',value:finals.length+'개'+(filesAvailable?' · 파일·링크 경로 확인':' · 미등록 또는 파일·링크 확인 필요'),source:workroom({delivery:'1'})},
      {item:'현재 고객 수령 확인',value:currentReceipt?currentReceipt.confirmedAt:'현재 납품 묶음의 고객 확인 기록 없음',source:workroom({closeout:'1'})},
      {item:'현재 마감 확인',value:currentClosure?currentClosure.closedAt:'현재 상태에 적용되는 마감 기록 없음',source:workroom({closeout:'1'})},
      {item:'자료 조건 기준일',value:text(rights.today)+' · 한국 날짜',source:workroom({materials:'1'})},
    ]);
    section('approval','현재 시안과 승인 상태',[['label','현재 시안'],['createdAt','등록 시각'],['status','승인 상태'],['approvedAt','승인 시각'],['source','내부 원문']],preview?[{label:text(preview.label),createdAt:text(preview.createdAt),status:approved?'고객 승인 기록 있음':'승인 대기',approvedAt:approved?preview.approvedAt:'',source:versionLink(preview.id)}]:[]);
    section('delivery','현재 승인 시안에 연결된 최종 파일',[['label','납품 이름'],['fileName','파일 이름'],['createdAt','등록 시각'],['status','원본 상태'],['guide','납품 안내'],['source','내부 원문']],finals.map(version=>({label:text(version.label),fileName:text(version.media?.fileName),createdAt:text(version.createdAt),status:materialMap.get('version:'+version.id)?.status==='unavailable'||!materialMap.has('version:'+version.id)?'파일·링크 볼 것':'현재 승인본 연결 · 파일·링크 경로 있음',guide:text(version.guide),source:versionLink(version.id)})));
    section('receipt_history','고객 수령 기록 · 과거 묶음은 현재 수령으로 보지 않음',[['confirmedAt','기록 시각'],['proof','기록 주체'],['application','현재 적용 여부'],['approvedPreviewId','당시 승인 시안 ID'],['versionIds','당시 최종 파일 ID'],['source','내부 원문']],[...receipts].reverse().map(entry=>({confirmedAt:text(entry.confirmedAt),proof:entry.actor==='customer'&&instant(entry.confirmedAt)?'고객 확인 기록':'고객 확인 근거 확인 필요',application:entry.id===currentReceipt?.id?'현재 납품 묶음의 고객 수령 확인':'이전 기록 · 현재 묶음에 적용하지 않음',approvedPreviewId:uuid(entry.approvedPreviewId)?entry.approvedPreviewId:'',versionIds:rows(entry.versionIds).filter(uuid).join('\n'),source:workroom({closeout:'1'})})));
    section('closeout_history','저장 당시 마감 요약 · 현재 내용으로 다시 작성하지 않음',[['closedAt','마감 기록 시각'],['actor','기록자'],['application','현재 적용 여부'],['summary','저장 당시 요약'],['source','내부 원문']],[...closures].reverse().map(entry=>({closedAt:text(entry.closedAt),actor:text(entry.actorName)||'기록자 확인 필요',application:entry.id===currentClosure?.id?'현재 상태에 적용되는 마감 기록':'이전 마감 기록 · 현재 완료 판정 아님',summary:typeof entry.summaryText==='string'&&entry.summaryText?text(entry.summaryText):'저장 당시 요약이 없습니다. 현재 내용으로 과거 요약을 만들지 않았습니다.',source:workroom({closeout:'1'})})));
    section('customer_requests','고객 문의·시안 수정 요청과 반영 근거',[['type','종류'],['requestedAt','요청 시각'],['request','고객 원문'],['status','처리 상태'],['resultVersion','연결된 수정 시안'],['currentResult','현재 시안과 동일'],['completedAt','처리 기록 시각'],['processingHistory','저장된 처리 이력 · 메모 제외'],['source','내부 원문']],requestData.map(item=>item.row));
    section('scene_requests','장면 수정 요청과 현재 장면의 고객 확인',[['scene','장면'],['requestedAt','요청 시각'],['request','고객 원문'],['status','현재 처리 상태'],['requestedRevision','요청 당시 장면 버전'],['currentRevision','현재 장면 버전'],['resultRevision','반영한 장면 버전'],['confirmedAt','고객 확인 시각'],['processingHistory','저장된 처리 이력 · 메모 제외'],['source','내부 원문']],sceneData.map(item=>item.row));
    section('rights_current','현재 자료 사용 조건·담당자가 기록한 포트폴리오 동의',[['label','자료·대상'],['status','현재 기록 상태'],['available','파일·링크 경로 있음'],['issues','확인할 항목'],['scope','사용 범위'],['evidence','확인 근거'],['agreedAt','확인일'],['period','등록 기간'],['source','내부 원문']],rights.items.map(item=>{const record=item.appliesToCurrent?item.record:null;return {label:text(item.label),status:rightsLabels[item.effectiveStatus]||'아직 안 봄',available:item.available===true,issues:rows(item.issues).map(issue=>issueLabels[issue]||'확인 필요').join(' · '),scope:text(record?.scope),evidence:text(record?.evidence),agreedAt:text(record?.agreedAt),period:period(record),source:workroom({materials:'1'})};}));
    const currentRights=new Map(rights.items.map(item=>[item.targetId,item]));
    section('rights_history','자료 사용 조건·공개 동의 변경 이력 · 과거 허용과 현재 허용 구분',[['label','기록 당시 대상'],['recordedAt','기록 시각'],['status','기록 당시 상태'],['application','현재 적용 여부'],['scope','기록한 범위'],['evidence','기록한 근거'],['agreedAt','확인일'],['period','기록한 기간'],['actor','기록자'],['source','내부 원문']],rights.history.map(record=>{const target=currentRights.get(record.targetId),selected=target?.appliesToCurrent&&target.record?.id===record.id;return {label:text(record.label),recordedAt:text(record.recordedAt),status:rightsLabels[record.status]||'아직 안 봄',application:selected?'현재 원본의 최신 기록 · 현재 상태는 위 구역 확인':record.currentTarget?'현재 원본의 이전 기록 · 최신 기록에 대체됨':'이전·삭제 원본의 기록 · 현재 원본에 적용하지 않음',scope:text(record.scope),evidence:text(record.evidence),agreedAt:text(record.agreedAt),period:period(record),actor:text(record.actorName),source:workroom({materials:'1'})};}));
    const title=text(project.title)+' · 프로젝트 기록',customerName=text(project.customerName);
    if(externalAddressesOmitted)warnings.push(`본문의 외부 주소 ${externalAddressesOmitted}곳은 뺐어요. 실제 주소는 권한 있는 사람이 원문에서 볼 수 있어요.`);
    warnings.push('연락처·프로젝트 내부 메모·처리 메모·개인 초안·초대 및 세션 정보·외부 주소·파일 본문은 내보내지 않습니다.');
    const report={schema:1,projectId,revision:project.revision,generatedAt,title,customerName,status,statusLabel:statusLabels[status],sections,counts:{currentFinalFiles:finals.length,customerRequests:requestData.length,pendingCustomerRequests,sceneRequests:sceneData.length,pendingSceneRequests,receiptRecords:receipts.length,closeoutRecords:closures.length,materialConditions:rights.items.filter(item=>item.kind==='material').length,rightsHistory:rights.history.length,totalRows,externalAddressesOmitted},warnings};
    const exportCharacters=report.title.length+report.customerName.length+report.status.length+report.statusLabel.length+warnings.reduce((sum,value)=>sum+value.length,0)+sections.reduce((sum,part)=>sum+part.title.length+part.columns.reduce((count,column)=>count+column.label.length,0)+part.rows.reduce((count,row)=>count+Object.values(row).reduce((size,value)=>size+(typeof value==='string'?value.length:0),0),0),0);
    if(exportCharacters>1000000)throw fail('제목과 안내를 포함한 기록 본문이 100만 자를 넘어 한 번에 내보낼 수 없습니다. 원문은 그대로 보존되어 있습니다.',413);
    const {generatedAt:ignored,...stable}=report;
    report.fingerprint=hash({report:stable,rightsRevision:rights.revision,identity:{id:user.id,role:user.role,teamId:user.teamId||null},source:stamp,materials:materials.items.map(({id,status,openUrl,downloadUrl,current,updatedAt})=>({id,status,openUrl,downloadUrl,current,updatedAt}))});
    if(Buffer.byteLength(JSON.stringify(report),'utf8')>4*1024*1024)throw fail('보고서가 4MiB를 넘어 한 번에 내보낼 수 없습니다. 원문은 그대로 보존되어 있습니다.',413);
    return report;
  }
  return Object.freeze({prepare});
}
