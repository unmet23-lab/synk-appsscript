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
  const labels={startup:'프로젝트 시작 설정',progress:'고객 진행 안내',materials:'프로젝트 자료·최종본',kickoff:'착수 전 자료·확정사항',changes:'제작 중 변경사항',requests:'장면별 수정 요청',schedule:'제작 일정·확인 지연',delivery:'최종본 납품 준비',closeout:'수령 확인·프로젝트 마감',followup:'고객 후속 연락',record:'프로젝트 기록',intake:'접수 원문',lounge:'고객 전용 라운지',versions:'시안과 납품 파일',messages:'요청과 답변'};
  const order={
    received:['startup','kickoff','materials','record','intake','progress','schedule','changes','requests','versions','messages','delivery','closeout','followup','lounge'],
    planning:['kickoff','materials','startup','schedule','record','intake','progress','changes','requests','versions','messages','delivery','closeout','followup','lounge'],
    producing:['requests','changes','schedule','materials','versions','progress','kickoff','startup','delivery','messages','record','intake','followup','closeout','lounge'],
    review:['requests','versions','messages','schedule','changes','progress','materials','delivery','kickoff','startup','closeout','followup','record','intake','lounge'],
    delivered:['delivery','closeout','materials','messages','followup','progress','versions','requests','schedule','changes','kickoff','startup','record','intake','lounge'],
    archived:['materials','closeout','versions','record','intake','messages','requests','changes','schedule','kickoff','progress','delivery','followup','startup','lounge']
  };
  const stageOpen={received:['startup','kickoff'],planning:['kickoff','materials'],producing:['materials','schedule'],review:['versions','requests'],delivered:['delivery','closeout'],archived:['materials','closeout']};
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
  summarize('startup','기존 접수 내용으로 착수·일정·납품 설정');
  summarize('progress','현재 프로젝트 기록으로 고객 안내 초안 만들기');
  summarize('materials','받은 자료·참고 자료·시안·최종본 모아보기');
  summarize('kickoff',kickoff?.statusLabel||'아직 착수 점검 기록 없음');
  summarize('changes',changes?.statusLabel||'아직 변경 점검 기록 없음');
  summarize('requests',sceneCount?`장면 요청 ${sceneCount}건 · 미처리 ${pendingScenes}건`:'등록된 장면 수정 요청 없음');
  summarize('schedule',schedule?.statusLabel||'아직 일정 점검 기록 없음');
  summarize('delivery',closeout?.deliveryKey?`현재 승인본 납품 파일 ${rows(closeout.files).length}개`:'납품 준비와 파일 규격 확인');
  summarize('closeout',closeout?.statusLabel||'아직 마감 점검 기록 없음');
  summarize('followup',date(p.nextContactDate)?'다음 연락일 '+p.nextContactDate:'예정된 후속 연락 없음');
  summarize('record','합의한 내용·전달일·담당자 기록');
  summarize('intake',p.receiptId?'접수번호 '+p.receiptId:'연결된 접수 원문 없음');
  summarize('lounge',p.inviteActive?'현재 고객 초대 사용 중':'고객 초대·내부 공유 안내');
  summarize('versions',preview?`시안 ${preview.label||''} · ${preview.approvedAt?'고객 승인됨':'고객 확인 대기'}`:versions.length?`등록된 버전 ${versions.length}개`:'등록된 시안 없음');
  summarize('messages',pendingMessages.length?`미처리 고객 요청 ${pendingMessages.length}건`:`대화 기록 ${messages.length}건`);

  // Disabled checks still contain missing counts in their source projection.
  // Only enabled, current states become an attention indicator.
  if(kickoff?.enabled===true&&kickoff.status==='waiting')attend('kickoff',`착수 전 확인할 항목 ${count(kickoff.missingCount)}개`);
  if(changes?.enabled===true&&['pending','reviewed'].includes(changes.status))attend('changes',changes.status==='reviewed'?'변경 검토 완료 · 새 비교 기준 저장 필요':`변경 후 확인할 항목 ${count(changes.pendingCount)}개`);
  if(pendingScenes>0)attend('requests');
  if(schedule?.enabled===true&&schedule.status==='attention'&&count(schedule.pendingCount)>0)attend('schedule',`일정·확인 지연 ${count(schedule.pendingCount)}개 확인 필요`);
  if(deliveryCheck?.confirmed===true&&count(deliveryCheck.pendingCount)>0&&deliveryCheck.status!=='archived')attend('delivery',deliveryCheck.statusLabel||'납품 규격·파일 확인 필요');
  if(closeout?.deliveryKey&&(closeout.overdue&&!closeout.receipt||closeout.status==='follow_up'||closeout.canClose===true))attend('closeout',closeout.overdue&&!closeout.receipt?'고객 수령 확인일 지남':closeout.statusLabel);
  if(pendingMessages.length)attend('messages');
  if(date(today)&&date(p.nextContactDate)&&p.nextContactDate<=today)attend('followup',p.nextContactDate<today?'후속 연락일 지남 · '+p.nextContactDate:'오늘 후속 연락 · '+p.nextContactDate);

  const suppliedGroup=!archived&&p.id&&group?.projectId===p.id?group:null;
  const currentTask=item=>!!item&&item.projectId===p.id&&['reply','review','next','waiting'].includes(item.group)&&item.resolved!==true&&!['done','complete','completed','archived'].includes(item.status)&&item.stage!=='archived'&&(item.revision===undefined||p.revision===undefined||item.revision===p.revision);
  const workflowStale=!!suppliedGroup&&(rows(suppliedGroup.items).some(item=>!currentTask(item))||!!suppliedGroup.primary&&!currentTask(suppliedGroup.primary));
  const currentGroup=workflowStale?null:suppliedGroup;
  const kindSection={client_kickoff:'kickoff',client_changes:'changes',scene_request:'requests',client_schedule:'schedule',client_delivery_check:'delivery',delivery:'delivery',delivery_receipt:'closeout',client_closeout:'closeout',follow_up:'followup',feedback:'messages',support:'messages',customer_review:'versions'};
  const seen=new Set();
  for(const item of [...rows(currentGroup?.items),...rows(workflowItems)]){
    if(!currentTask(item)||seen.has(item.id))continue;
    seen.add(item.id);
    const key=kindSection[item.kind];if(!key)continue;
    // A concurrent projection may be older than the loaded project. Current
    // disabled/complete states must not inherit old workflow warnings.
    if(key==='kickoff'&&(!kickoff?.enabled||kickoff.status!=='waiting'))continue;
    if(key==='changes'&&(!changes?.enabled||!['pending','reviewed'].includes(changes.status)))continue;
    if(key==='schedule'&&(!schedule?.enabled||['disabled','archived','complete'].includes(schedule.status)))continue;
    attend(key,byKey[key].attention?null:item.statusLabel||item.title);
  }
  if(archived)for(const section of sections)section.summary='보관 기록 · '+section.summary;
  return {projectId:p.id||'',stage,archived,sections,defaultOpen:sections.filter(section=>section.open).map(section=>section.key),attentionSections:sections.filter(section=>section.attention),primary:currentGroup?.primary||null,reason:currentGroup?.reason||'',counts:currentGroup?.counts||null,workflowStale};
}
