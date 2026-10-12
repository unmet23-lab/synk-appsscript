const activeGroups=new Set(['reply','review','next','waiting']);
const finishedStatuses=new Set(['done','complete','completed','archived']);
const kindOrder=new Map(['client_kickoff','client_changes','feedback','scene_request','support','follow_up','client_schedule','client_delivery_check','delivery','delivery_receipt','client_closeout'].map((kind,index)=>[kind,index]));
const urgencyOrder={overdue:0,today:1,upcoming:2,undated:3,waiting:4};
const compareText=(a,b)=>a<b?-1:a>b?1:0;

function validDate(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return '';
  const time=Date.parse(value+'T00:00:00Z');
  return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===value?value:'';
}
const customerWaiting=item=>item.status==='waiting_customer'||item.kind==='customer_review';
const actionable=item=>['reply','review','next'].includes(item.group)&&!customerWaiting(item);
function urgency(item,today){
  if(!actionable(item))return 'waiting';
  const due=validDate(item.dueDate);
  return !due?'undated':due<today?'overdue':due===today?'today':'upcoming';
}
function compareItems(a,b,today){
  return urgencyOrder[urgency(a,today)]-urgencyOrder[urgency(b,today)]
    ||(kindOrder.get(a.kind)??100)-(kindOrder.get(b.kind)??100)
    ||compareText(validDate(a.dueDate)||'9999-99-99',validDate(b.dueDate)||'9999-99-99')
    ||compareText(a.id,b.id);
}
function reasonFor(primary,groupUrgency,counts){
  if(!primary){
    const waiting=[counts.customerWaiting?`고객 확인 ${counts.customerWaiting}건`:'',counts.staffWaiting?`내부 처리 ${counts.staffWaiting}건`:''].filter(Boolean).join(' · ');
    return `${waiting}을 기다리고 있습니다. 현재 내 처리 차례인 항목은 없습니다.`;
  }
  const due=validDate(primary.dueDate),turn=primary.group==='review'?'내 검토 차례':'내 처리 차례';
  if(groupUrgency==='overdue')return `${due} 기한이 지났고 ${turn}입니다.`;
  if(groupUrgency==='today')return `오늘(${due})이 기한이며 ${turn}입니다.`;
  if(groupUrgency==='upcoming')return `${due} 기한이 예정돼 있고 ${turn}입니다.`;
  return `등록된 유효 기한 없이 ${turn}입니다.`;
}

// Consume only the existing permission-filtered workflow projection. This helper
// never reads projects itself or persists another task record.
export function buildClientProjectGroups(items,{today=new Date(Date.now()+9*60*60*1000).toISOString().slice(0,10)}={}){
  if(!validDate(today))throw new TypeError('프로젝트 할 일의 기준일을 확인해 주세요.');
  const projects=new Map(),seen=new Set();
  for(const item of Array.isArray(items)?items:[]){
    if(!item||typeof item!=='object'||typeof item.id!=='string'||!item.id.trim()||typeof item.projectId!=='string'||!item.projectId.trim()||!activeGroups.has(item.group)||finishedStatuses.has(item.status)||item.resolved===true||item.stage==='archived'||seen.has(item.id))continue;
    seen.add(item.id);
    if(!projects.has(item.projectId))projects.set(item.projectId,[]);
    projects.get(item.projectId).push(item);
  }
  const groups=[];
  for(const [projectId,sourceItems]of projects){
    const sortedItems=sourceItems.slice().sort((a,b)=>compareItems(a,b,today));
    const primary=sortedItems.find(actionable)||null;
    const waiting=sortedItems.filter(item=>!actionable(item));
    const customerCount=waiting.filter(customerWaiting).length;
    const counts={total:sortedItems.length,actionable:sortedItems.length-waiting.length,waiting:waiting.length,customerWaiting:customerCount,staffWaiting:waiting.length-customerCount};
    const groupUrgency=primary?urgency(primary,today):'waiting';
    const first=primary||sortedItems[0];
    groups.push({projectId,projectTitle:first.projectTitle||'',href:'/?'+new URLSearchParams({tab:'workroom',section:'clients',project:projectId}),primary,reason:reasonFor(primary,groupUrgency,counts),urgency:groupUrgency,dueDate:primary?validDate(primary.dueDate):'',counts,items:sortedItems});
  }
  return groups.sort((a,b)=>urgencyOrder[a.urgency]-urgencyOrder[b.urgency]
    ||(a.primary&&b.primary?compareItems(a.primary,b.primary,today):0)
    ||compareText(a.projectId,b.projectId));
}
