import {createHash} from 'node:crypto';
import {buildClientProjectGroups} from './client-project-groups.mjs';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const records=value=>Array.isArray(value)?value:[];
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const pick=(value,keys)=>Object.fromEntries(keys.map(key=>[key,value?.[key]??null]));
const kind='clientTaskRechecks';
export function validRecheckDate(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const at=Date.parse(value+'T00:00:00Z');
  return Number.isFinite(at)&&new Date(at).toISOString().slice(0,10)===value;
}
function overdueDates(item,row,today){
  const dates=[item.dueDate,row.dueDate];
  if(item.kind==='client_schedule')for(const value of [...records(row.schedule?.milestones).filter(value=>!['complete','not_required'].includes(value.status)),...records(row.schedule?.waiting)])dates.push(value.targetDate||value.dueDate);
  return [...new Set(dates.filter(date=>validRecheckDate(date)&&date<today))].sort();
}
function sourceFor(item,row,extra){
  if(item.kind==='client_kickoff')return {requirements:row.kickoff?.requirements,checks:row.kickoff?.checks};
  if(item.kind==='client_changes')return pick(row.changes,['changeKey','currentStrategyRevision','currentStrategyConfirmed','impacts']);
  if(item.kind==='client_schedule')return {plan:pick(row.schedule,['targets','remainingWorkDays','customerWaitDays','internalReviewDays','calendar']),milestones:records(row.schedule?.milestones).map(value=>pick(value,['id','targetDate','status'])),waiting:records(row.schedule?.waiting).map(value=>pick(value,['id','since','dueDate','overdue','due']))};
  if(item.kind==='scene_request')return records(row.sceneRequests?.items).find(value=>item.id.endsWith(':scene-request:'+value.id))||null;
  if(item.kind==='client_delivery_check')return extra||null;
  if(item.kind==='client_rights_expiry')return extra||null;
  if(['client_closeout','delivery_receipt'].includes(item.kind))return pick(row.closeout,['deliveryKey','receipt','dueDate','pendingRequests','checks','canClose']);
  return null;
}
// Only semantic task inputs participate. Project revision, general updatedAt,
// title and internal project notes do not reset a personal recheck date.
export function clientTaskRecheckFingerprint(item,row,extra=null,today=''){
  const preview=records(row.versions).filter(value=>value.kind==='preview').at(-1);
  return hash({item:pick(item,['id','kind','group','status','dueDate','versionId','messageId','seconds','ownerId','reviewerId','actions']),projectDueDate:row.dueDate||'',content:['feedback','support','scene_request','customer_review'].includes(item.kind)?pick(item,['text','note']):item.kind==='follow_up'?{nextStep:item.nextStep}:null,customerRequests:records(row.messages).filter(value=>value.author==='customer'&&value.action!=='approve').map(value=>value.id).sort(),sceneRequests:records(row.sceneRequests?.items).map(value=>value.id).sort(),preview:preview?pick(preview,['id','approvedAt']):null,source:sourceFor(item,row,extra),overdueDates:today?overdueDates(item,row,today):[]});
}

export function createClientTaskRechecksService({store}){
  function project(user,{items,projects,today,sources=new Map()}){
    const rows=new Map(projects.map(row=>[row.id,row])),saved=store.get(kind,user.id),entries=object(saved?.entries)?saved.entries:{},rechecks={},todayItems=[],deferredItems=[];
    for(const item of items){
      const row=rows.get(item.projectId);if(!row)continue;
      const fingerprint=clientTaskRecheckFingerprint(item,row,sources.get(item.id),today),entry=entries[item.id],overdue=overdueDates(item,row,today),newlyOverdue=entry&&overdue.some(date=>!records(entry.overdueDates).includes(date));
      let state='active',date=null;
      if(entry&&validRecheckDate(entry.date)){
        date=entry.date;
        state=newlyOverdue?'overdue':entry.fingerprint!==fingerprint?'changed':date<=today?'due':'deferred';
      }
      rechecks[item.id]={fingerprint,state,date};
      (state==='deferred'?deferredItems:todayItems).push(item);
    }
    return {recheckToday:today,rechecks,todayItems,todayProjectGroups:buildClientProjectGroups(todayItems,{today}),deferredItems};
  }
  function update(user,input,context){
    if(user.role==='viewer')throw fail('담당자 또는 지정 검토자만 다시 확인 날짜를 정할 수 있습니다.',403);
    if(!object(input)||Object.keys(input).some(key=>!['action','itemId','date','fingerprint'].includes(key))||!['defer','restore'].includes(input.action)||typeof input.itemId!=='string'||!input.itemId||input.itemId.length>300)throw fail('다시 확인 요청을 확인해 주세요.');
    const item=context.items.find(value=>value.id===input.itemId),row=item&&context.projects.find(value=>value.id===item.projectId);
    if(!item||!row)throw fail('현재 담당하는 할 일을 찾을 수 없습니다.',404);
    const current=clientTaskRecheckFingerprint(item,row,context.sources?.get(item.id),context.today);
    if(input.action==='defer'&&input.fingerprint!==current||input.action==='restore'&&input.fingerprint!==undefined&&input.fingerprint!==current)throw fail('할 일의 내용이 바뀌었습니다. 새로 확인한 뒤 날짜를 정해 주세요.',409);
    const saved=store.get(kind,user.id),entries=object(saved?.entries)?{...saved.entries}:{};
    if(input.action==='defer'){
      if(!validRecheckDate(input.date)||input.date<=context.today||(Date.parse(input.date+'T00:00:00Z')-Date.parse(context.today+'T00:00:00Z'))/86400000>365)throw fail('다시 확인 날짜는 내일부터 365일 이내로 정해 주세요.');
      if(!Object.hasOwn(entries,item.id)&&Object.keys(entries).length>=1000){
        const active=new Set(context.items.map(value=>value.id));
        for(const [id,entry]of Object.entries(entries))if(!active.has(id)||!validRecheckDate(entry?.date)||entry.date<=context.today)delete entries[id];
        if(Object.keys(entries).length>=1000)throw fail('다시 확인할 항목이 1,000개입니다. 기존 날짜를 해제한 뒤 정해 주세요.',409);
      }
      entries[item.id]={date:input.date,fingerprint:current,overdueDates:overdueDates(item,row,context.today)};
    }else{
      if(input.date!==undefined)throw fail('날짜 해제 요청에는 새 날짜를 넣지 마세요.');
      delete entries[item.id];
    }
    if(Object.keys(entries).length)store.put(kind,user.id,{userId:user.id,entries});else store.remove(kind,user.id);
  }
  return {project,update};
}
