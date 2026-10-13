'use strict';

// Presentation only: consume the permission-filtered project and workflow views.
// This does not infer task priority, change progress, or persist project data.
function clientProjectScreenPlan(project,{group=null,workflowItems=[],today=''}={}){
  const rows=value=>Array.isArray(value)?value:[],count=value=>Number.isSafeInteger(value)&&value>=0?value:0;
  const date=value=>{
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return '';
    const at=Date.parse(value+'T00:00:00Z');
    return Number.isFinite(at)&&new Date(at).toISOString().slice(0,10)===value?value:'';
  };
  const p=project&&typeof project==='object'?project:{},stage=p.stage||'received',archived=stage==='archived';
  const labels={materials:'자료',kickoff:'시작 준비',requests:'장면 수정 요청',schedule:'일정',delivery:'납품',closeout:'수령 확인과 마감',followup:'다음 연락',record:'프로젝트 기록',lounge:'고객 초대 링크',versions:'시안과 최종본',messages:'대화'};
  const order={
    received:['kickoff','materials','record','schedule','requests','versions','messages','delivery','closeout','followup','lounge'],
    planning:['kickoff','materials','schedule','record','requests','versions','messages','delivery','closeout','followup','lounge'],
    producing:['requests','schedule','materials','versions','kickoff','delivery','messages','record','followup','closeout','lounge'],
    review:['requests','versions','messages','schedule','materials','delivery','kickoff','closeout','followup','record','lounge'],
    delivered:['delivery','closeout','materials','messages','followup','versions','requests','schedule','kickoff','record','lounge'],
    archived:['materials','closeout','versions','record','messages','requests','schedule','kickoff','delivery','followup','lounge']
  };
  const stageOpen={received:['kickoff'],planning:['kickoff','materials'],producing:['materials','schedule'],review:['versions','requests'],delivered:['delivery','closeout'],archived:['materials','closeout']};
  const open=new Set(stageOpen[stage]||['record','materials']);
  const sections=(order[stage]||Object.keys(labels)).map(key=>({key,label:labels[key],open:open.has(key),attention:false,summary:''}));
  const byKey=Object.fromEntries(sections.map(section=>[section.key,section]));
  const summarize=(key,summary)=>{byKey[key].summary=summary;};
  const attend=(key,summary)=>{
    if(archived)return;
    const section=byKey[key];section.attention=true;section.open=true;
    if(summary)section.summary=summary;
  };
  const kickoff=p.kickoff,changes=p.changes,schedule=p.schedule,closeout=p.closeout,deliveryCheck=p.deliveryCheck;
  const pendingScenes=count(p.sceneRequests?.pendingCount),sceneCount=rows(p.sceneRequests?.items).length;
  const messages=rows(p.messages),pendingMessages=messages.filter(message=>message.author==='customer'&&['feedback','support'].includes(message.action)&&!message.resolved&&message.workflow?.status!=='done');
  const versions=rows(p.versions),preview=versions.filter(version=>version.kind==='preview').at(-1);
  summarize('materials','받은 자료·참고 자료·시안·최종본');
  summarize('kickoff',changes?.enabled===true&&['pending','reviewed'].includes(changes.status)?changes.statusLabel:kickoff?.statusLabel||'유형 고르기 · 필요한 자료 · 확정 뒤 바뀐 것');
  summarize('requests',sceneCount?`장면 요청 ${sceneCount}건 · 아직 ${pendingScenes}건`:'장면 수정 요청 없음');
  summarize('schedule',schedule?.statusLabel||'목표일 없음');
  summarize('delivery',closeout?.deliveryKey?`승인본 기준 납품 파일 ${rows(closeout.files).length}개`:'파일 고르기 · 자동 검사 · 고객에게 보이기');
  summarize('closeout',closeout?.statusLabel||'납품 전');
  summarize('followup',date(p.nextContactDate)?'다음 연락 '+p.nextContactDate:'잡힌 연락 없음');
  summarize('record',p.receiptId?'합의한 내용·전달일·담당자 · 접수번호 '+p.receiptId:'합의한 내용·전달일·담당자');
  summarize('lounge',p.inviteActive?'초대 링크 살아 있음':'초대 링크 만들기');
  summarize('versions',preview?`시안 ${preview.label||''} · ${preview.approvedAt?'고객 승인':'고객 확인 기다리는 중'}`:versions.length?`버전 ${versions.length}개`:'아직 시안 없음');
  summarize('messages',pendingMessages.length?`답할 고객 요청 ${pendingMessages.length}건`:`주고받은 글 ${messages.length}건`);

  // Disabled checks still contain missing counts in their source projection.
  // Only enabled, current states become an attention indicator.
  if(kickoff?.enabled===true&&kickoff.status==='waiting')attend('kickoff',`시작 전에 챙길 것 ${count(kickoff.missingCount)}개`);
  if(changes?.enabled===true&&['pending','reviewed'].includes(changes.status))attend('kickoff',changes.status==='reviewed'?'바뀐 내용 검토 끝 · 새 기준으로 저장하기':`확정 뒤 바뀐 내용 ${count(changes.pendingCount)}개 다시 확인`);
  if(pendingScenes>0)attend('requests');
  if(schedule?.enabled===true&&schedule.status==='attention'&&count(schedule.pendingCount)>0)attend('schedule',`늦어지는 곳 ${count(schedule.pendingCount)}개`);
  if(deliveryCheck?.confirmed===true&&count(deliveryCheck.pendingCount)>0&&deliveryCheck.status!=='archived')attend('delivery',deliveryCheck.statusLabel||'파일 검사 필요');
  if(closeout?.deliveryKey&&(closeout.overdue&&!closeout.receipt||closeout.status==='follow_up'||closeout.canClose===true))attend('closeout',closeout.overdue&&!closeout.receipt?'고객이 아직 받았다고 안 함':closeout.statusLabel);
  if(pendingMessages.length)attend('messages');
  if(date(today)&&date(p.nextContactDate)&&p.nextContactDate<=today)attend('followup',p.nextContactDate<today?'연락일 지남 · '+p.nextContactDate:'오늘 연락 · '+p.nextContactDate);

  const suppliedGroup=!archived&&p.id&&group?.projectId===p.id?group:null;
  const currentTask=item=>!!item&&item.projectId===p.id&&['reply','review','next','waiting'].includes(item.group)&&item.resolved!==true&&!['done','complete','completed','archived'].includes(item.status)&&item.stage!=='archived'&&(item.revision===undefined||p.revision===undefined||item.revision===p.revision);
  const workflowStale=!!suppliedGroup&&(rows(suppliedGroup.items).some(item=>!currentTask(item))||!!suppliedGroup.primary&&!currentTask(suppliedGroup.primary));
  const currentGroup=workflowStale?null:suppliedGroup;
  const kindSection={client_kickoff:'kickoff',client_changes:'kickoff',scene_request:'requests',client_schedule:'schedule',client_delivery_check:'delivery',delivery:'delivery',delivery_receipt:'closeout',client_closeout:'closeout',follow_up:'followup',feedback:'messages',support:'messages',customer_review:'versions'};
  const seen=new Set();
  for(const item of [...rows(currentGroup?.items),...rows(workflowItems)]){
    if(!currentTask(item)||seen.has(item.id))continue;
    seen.add(item.id);
    const key=kindSection[item.kind];if(!key)continue;
    // A concurrent projection may be older than the loaded project. Current
    // disabled/complete states must not inherit old workflow warnings.
    if(item.kind==='client_kickoff'&&(!kickoff?.enabled||kickoff.status!=='waiting'))continue;
    if(item.kind==='client_changes'&&(!changes?.enabled||!['pending','reviewed'].includes(changes.status)))continue;
    if(key==='schedule'&&(!schedule?.enabled||['disabled','archived','complete'].includes(schedule.status)))continue;
    attend(key,byKey[key].attention?null:item.statusLabel||item.title);
  }
  if(archived)for(const section of sections)section.summary='보관 기록 · '+section.summary;
  return {projectId:p.id||'',stage,archived,sections,defaultOpen:sections.filter(section=>section.open).map(section=>section.key),attentionSections:sections.filter(section=>section.attention),primary:currentGroup?.primary||null,reason:currentGroup?.reason||'',counts:currentGroup?.counts||null,workflowStale};
}
