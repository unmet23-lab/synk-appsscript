import {createHash} from 'node:crypto';
import {setImmediate as yieldToRequests} from 'node:timers/promises';

const KIND='automationNotificationStates';
const HREF='/?tab=workroom&section=tools&tool=automation';
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const eligible=user=>!!user?.active&&user.role!=='viewer';
const keyFor=(userId,automationId,issueId)=>createHash('sha256').update(JSON.stringify([userId,automationId,issueId])).digest('hex');
const validId=value=>typeof value==='string'&&value.length>0&&value.length<=1024&&!/[\u0000-\u001f]/.test(value);
const eventId=row=>`automation:${row.id}:${row.episode}`;

// Only issue identity, transition times and read receipts are durable. Labels,
// bodies and links always come from the current, permission-filtered projection.
export function createAutomationNotificationsService({store,automationHealth,clock=()=>new Date().toISOString(),onChange=()=>{}}){
  function current(user){const live=store.get('users',typeof user==='string'?user:user?.id);if(!live?.active)throw fail('먼저 로그인해 주세요.',401);return live;}
  function now(){const value=clock(),at=new Date(value);if(!Number.isFinite(at.getTime()))throw new Error('자동화 알림 시각을 확인하지 못했습니다.');return at.toISOString();}
  const notify=ids=>{if(!ids.length)return;try{onChange([...new Set(ids)]);}catch{/* Durable state remains available on the next read. */}};
  function snapshot(user){
    let result;
    try{result=automationHealth.get(user);}catch{throw fail('자동화 상태를 확인하지 못했습니다. 잠시 뒤 다시 확인해 주세요.',503);}
    if(!result||!Array.isArray(result.cards)||!Array.isArray(result.issues))throw fail('자동화 상태를 확인하지 못했습니다. 잠시 뒤 다시 확인해 주세요.',503);
    const cards=new Map(result.cards.filter(card=>validId(card?.id)).map(card=>[card.id,card]));
    const issues=new Map();
    for(const issue of result.issues){
      if(!validId(issue?.id)||!validId(issue?.automationId)||!cards.has(issue.automationId))continue;
      issues.set(keyFor(user.id,issue.automationId,issue.id),issue);
    }
    return {cards,issues,observed:new Set(Array.isArray(result.observedIssueIds)?result.observedIssueIds.filter(validId):[])};
  }
  function hiddenState(row,view){
    const card=view.cards.get(row.automationId);
    if(!card)return {state:'suppressed',reason:'not-current'};
    if(card.status==='partial')return {state:'suppressed',reason:'unavailable'};
    if(card.status==='paused')return {state:'suppressed',reason:'paused'};
    // Absence alone cannot prove recovery: it may mean revoked access, deleted
    // source, or a newly excluded date range. The source must attest observation.
    if(view.observed.has(row.issueId))return {state:'resolved',reason:null};
    return {state:'suppressed',reason:'not-current'};
  }
  const scanResult=()=>({created:0,reopened:0,restored:0,resolved:0,suppressed:0,failedUsers:0});
  function reconcile(at,byUser,views,saved,result,changed){
    store.transaction(()=>{
      const previous=new Map(saved.map(row=>[row.id,row]));
      const put=row=>{store.put(KIND,row.id,row);changed.add(row.ownerId);};
      for(const [ownerId,view]of views){
        if(!view)continue;
        for(const [id,issue]of view.issues){
          const old=previous.get(id)||store.get(KIND,id);
          if(old?.state==='active')continue;
          const reopened=old?.state==='resolved',episode=old?(Number.isSafeInteger(old.episode)&&old.episode>0?old.episode:1)+(reopened?1:0):1;
          put({schema:1,id,ownerId,automationId:issue.automationId,issueId:issue.id,episode,createdAt:!old||reopened?at:old.createdAt,readAt:!old||reopened?null:old.readAt||null,state:'active',reason:null,changedAt:at});
          result[!old?'created':reopened?'reopened':'restored']++;
        }
      }
      for(const row of saved){
        if(row.state==='resolved')continue;
        const user=byUser.get(row.ownerId),view=views.get(row.ownerId);
        if(eligible(user)&&view?.issues.has(row.id))continue;
        const next=!eligible(user)?{state:'suppressed',reason:'ineligible'}:!view?{state:'suppressed',reason:'unavailable'}:hiddenState(row,view);
        if(row.state===next.state&&row.reason===next.reason)continue;
        put({...row,...next,changedAt:at});result[next.state]++;
      }
    });
  }
  function scan(){
    const at=now(),changed=new Set(),result=scanResult();
    const users=store.all('users'),byUser=new Map(users.map(user=>[user.id,user])),views=new Map();
    for(const user of users){if(!eligible(user))continue;try{views.set(user.id,snapshot(user));}catch{views.set(user.id,null);result.failedUsers++;}}
    reconcile(at,byUser,views,store.all(KIND),result,changed);
    notify([...changed]);return result;
  }
  let scheduledScan=null;
  function scanAsync({shouldStop=()=>false}={}){
    if(scheduledScan)return scheduledScan;
    scheduledScan=(async()=>{
      const at=now(),changed=new Set(),result=scanResult(),saved=store.all(KIND),owners=new Map();
      for(const row of saved){if(!owners.has(row.ownerId))owners.set(row.ownerId,[]);owners.get(row.ownerId).push(row.id);}
      const ids=new Set([...store.all('users').map(user=>user.id),...owners.keys()]);
      try{
        for(const id of ids){
          // Never hold a transaction or a permission-filtered projection across
          // an await. Each user is reread and reconciled in one synchronous turn.
          await yieldToRequests();if(shouldStop())return {...result,cancelled:true};
          const user=store.get('users',id),views=new Map();
          if(eligible(user)){try{views.set(id,snapshot(user));}catch{views.set(id,null);result.failedUsers++;}}
          const currentRows=(owners.get(id)||[]).map(key=>store.get(KIND,key)).filter(Boolean);
          reconcile(at,new Map([[id,user]]),views,currentRows,result,changed);
        }
        return result;
      }finally{notify([...changed]);}
    })().finally(()=>{scheduledScan=null;});
    return scheduledScan;
  }
  function projected(user){
    if(!eligible(user))return [];
    // Reads cannot create alerts. With no saved receipt for this user, there is
    // nothing to project; existing (including suppressed) receipts still get
    // live source/permission validation and retain their error behavior.
    if(!store.all(KIND).some(row=>row.ownerId===user.id))return [];
    const view=snapshot(user),items=[];
    for(const [key,issue]of view.issues){
      const row=store.get(KIND,key);
      if(!row||row.ownerId!==user.id||row.state!=='active'||row.issueId!==issue.id||row.automationId!==issue.automationId)continue;
      const text=typeof issue.text==='string'&&issue.text.trim()?issue.text.slice(0,1000):'자동화 상태와 필요한 조치를 확인해 주세요.';
      items.push({id:eventId(row),kind:'automation_health',title:'자동화 확인 필요',text,body:text,createdAt:row.createdAt,readAt:row.readAt||null,unread:!row.readAt,href:HREF,message:null,automationId:row.automationId,issueId:row.issueId});
    }
    return items.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id));
  }
  function list(user){user=current(user);const notifications=projected(user);return {notifications,unreadCount:notifications.filter(row=>row.unread).length};}
  function read(user,id){
    user=current(user);const items=projected(user),item=items.find(row=>row.id===id);if(!item)throw fail('알림을 찾을 수 없습니다.',404);
    if(item.unread){const key=keyFor(user.id,item.automationId,item.issueId),row=store.get(KIND,key);store.put(KIND,key,{...row,readAt:now()});notify([user.id]);}
    return {ok:true,id,unreadCount:items.filter(row=>row.unread&&row.id!==id).length};
  }
  function readAll(user){
    user=current(user);const unread=projected(user).filter(row=>row.unread);
    if(unread.length){const at=now();store.transaction(()=>{for(const item of unread){const key=keyFor(user.id,item.automationId,item.issueId),row=store.get(KIND,key);store.put(KIND,key,{...row,readAt:at});}});notify([user.id]);}
    return {ok:true,count:unread.length,unreadCount:0};
  }
  return {scan,scanAsync,list,read,readAll};
}
