'use strict';

const {goodId,MAX_TASKS}=require('./office-task-store.cjs');
const {childId}=require('./office-quote-thread.cjs');

function items(parent) {
  if(!parent?.quoteHandoff||parent.status!=='completed'||!parent.mailReceipt?.quoteHandoff)return [];
  return parent.mailReceipt.groups.flatMap(group=>{
    const binding=parent.mailReceipt.bindings.find(b=>b.provider===group.provider);
    return binding?group.items.filter(i=>goodId(i.id)).map(item=>({item,binding})):[];
  });
}
const retryable=row=>row?.quoteOrigin&&(
  row.status==='failed'&&['LIMIT','LOGIN','NATIVE','NO_CLI','MAIL_PLAN','MAIL_NETWORK','MAIL_TIMEOUT','MAIL_LIMIT','MAIL_RECONNECT','MAIL_CHANGED','MAIL_CONFIG','FOLDER'].includes(row.reason)||
  row.status==='interrupted'&&['AUTH_CHANGED','RESTART'].includes(row.reason));
function needsScan(row,bindings){
  const old=row.mailBindings?.[0];
  return retryable(row)||row.status==='paused'||row.status==='completed'&&(row.mailReceipt?.quoteOutcome||row.quoteState)==='held'||
    row.status==='queued'&&old&&bindings.some(b=>b.provider===old.provider&&b.id!==old.id);
}
function addRecipients(tasks,parent,at,paused) {
  const added=[],byId=new Map(tasks.map(t=>[t.id,t]));
  for(const {item,binding} of items(parent)){
    const existing=byId.get(item.id);
    if(existing){
      if(!paused&&existing.quoteOrigin&&parent.createdAt>=existing.updatedAt&&needsScan(existing,[binding])){
        Object.assign(existing,{status:'queued',reason:null,sessionId:null,providerTag:null,quoteRunFrom:parent.id,
          quoteAttempt:parent.id,mailBindings:[binding],updatedAt:at});
        delete existing.quoteState;
        delete existing.mailReceipt;added.push(item.id);
      }
      continue;
    }
    if(tasks.length>=MAX_TASKS)continue;
    const child={id:item.id,provider:'codex',departmentId:parent.departmentId,departmentName:'견적 담당',cwd:parent.cwd,
      prompt:'고객 문의를 확인하고 견적 답장 초안을 작성해 주세요.',previousId:null,sessionId:null,providerTag:null,providerSalt:item.id,
      quoteOrigin:{parentId:parent.id,itemId:item.id},mailSearch:true,mailBindings:[binding],
      status:paused?'paused':'queued',reason:paused?'RESTART':null,createdAt:at,updatedAt:at,answer:''};
    tasks.push(child);byId.set(item.id,child);added.push(item.id);
  }
  const remaining=parent.quoteHandoff&&parent.status==='completed'&&parent.mailReceipt?.groups.filter(g=>!g.code&&g.remaining>0&&g.cursor);
  if(remaining?.length&&tasks.length<MAX_TASKS){
    const id=childId('internal','continued-quote-scan',parent.id,'next');
    if(!byId.has(id)){
      tasks.push({id,provider:'codex',departmentId:parent.departmentId,departmentName:'메일 담당',cwd:parent.cwd,prompt:parent.prompt,
        previousId:null,sessionId:null,providerTag:parent.providerTag,providerSalt:parent.providerSalt||parent.id,mailSearch:true,quoteHandoff:true,
        quoteBatchParent:parent.id,quoteRoot:parent.quoteRoot||parent.id,mailBindings:parent.mailReceipt.bindings.filter(b=>remaining.some(g=>g.provider===b.provider)),
        status:paused?'paused':'queued',reason:paused?'RESTART':null,createdAt:at,updatedAt:at,answer:''});
      added.push(id);
    }
  }
  return added;
}
function sourceOf(row,tasks){
  const parent=tasks.find(t=>t.id===(row.quoteRunFrom||row.quoteOrigin?.parentId));
  return items(parent).find(({item})=>item.id===row.id&&item.id===row.quoteOrigin.itemId);
}
function decorate(task,row,tasks){
  if(row.quoteOrigin){
    const found=sourceOf(row,tasks);
    if(found){
      const {item,binding}=found;
      Object.assign(task.quoteSource,{parentId:row.quoteRunFrom||row.quoteOrigin.parentId,subject:item.subject,from:item.from,date:item.date,evidence:item.evidence,provider:binding.provider});
    }
    task.canOpenTerminal=false;
    task.canRetry=!!retryable(row)&&!['MAIL_CHANGED','MAIL_RECONNECT'].includes(row.reason);
    return;
  }
  if(!row.quoteHandoff||!row.mailReceipt)return;
  const scans=row.quoteRoot?[row]:[row,...tasks.filter(t=>t.quoteRoot===row.id)];
  const unique=new Map(scans.flatMap(s=>items(s)).map(entry=>[entry.item.id,entry]));
  const candidates=[...unique.values()],children=new Map(tasks.filter(t=>t.quoteOrigin).map(t=>[t.id,t]));
  task.handoffs=candidates.flatMap(({item})=>{
    const child=children.get(item.id);
    return child?[{id:child.id,parentId:child.quoteOrigin.parentId,status:child.status,subject:item.subject}]:[];
  });
  const groups=scans.flatMap(s=>s.mailReceipt?.groups||[]);
  const latestGroups=new Map(groups.map(g=>[g.provider,g]));
  task.quoteCanResume=[...latestGroups.values()].some(g=>g.code);
  const checked=groups.reduce((n,g)=>n+(g.checked||0),0);
  const review=groups.reduce((n,g)=>n+(g.review||0),0),drafts=groups.reduce((n,g)=>n+(g.drafts||0),0);
  const queued=task.handoffs.length,capacity=candidates.length-queued;
  const more=scans.some(s=>s.mailReceipt?.groups.some(g=>g.remaining>0)&&!tasks.some(t=>t.quoteBatchParent===s.id)),partial=groups.some(g=>g.code);
  const ownScans=new Set(scans.map(s=>s.id)),reused=task.handoffs.filter(h=>!ownScans.has(h.parentId)).length;
  const parts=[(groups.some(g=>g.resumed)?'지난 조사에 이어 메일 대화 ':'메일 대화 ')+checked+'건을 확인했습니다.',queued?'미회신 견적 문의 '+queued+'건의 담당 업무를 아래에서 열 수 있습니다.':'이번에 연결한 견적 업무가 없습니다.'];
  if(reused)parts.push(reused+'건은 앞서 넘긴 업무에 연결했습니다.');
  if(drafts)parts.push('작성 중인 답장 '+drafts+'건을 제외했습니다.');
  if(review)parts.push('직접 확인할 대화가 '+review+'건 있습니다.');
  if(capacity)parts.push('업무 보관 한도 때문에 '+capacity+'건을 넘기지 못했습니다.');
  if(partial)parts.push('일부 메일을 읽지 못했습니다. 다시 조사해 주세요.');
  if(scans.some(s=>s.quoteBatchParent&&['running','queued'].includes(s.status)))parts.push('메일 담당이 다음 문의를 계속 확인하고 있습니다.');
  if(scans.some(s=>s.quoteBatchParent&&['paused','interrupted','failed'].includes(s.status)))parts.push('이어지는 조사 카드를 확인해 주세요.');
  if(more)parts.push('아직 확인할 문의가 남아 있습니다.');
  task.answer=parts.join(' ');
}
module.exports={addRecipients,sourceOf,decorate,retryable,needsScan};
