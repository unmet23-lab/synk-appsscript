import {randomUUID} from 'node:crypto';
import {workspaceOwner} from './workspace-owner.mjs';

// 대표 알림(관리자 직접부여 설계 2절 「하루 상한과 대표 알림」). 반 · 명부 · 이용 권한 쓰기와 관리자 올리기 · 내리기가 끝날 때마다
// 회사 주인에게 메신저 알림을 한 줄 남긴다. 메신저 알림은 기기 알림(web push)으로도 간다. 자동화 알림과 같은 꼴로 messenger에 넘긴다.
const KIND='ownerAlerts',PREFIX='owner-alert:',HREF='/?tab=admin',KEEP=200,KEEP_MS=90*86400000;
const fail=(message,status=400)=>Object.assign(new Error(message),{status});

export function createOwnerAlertsService({store,clock=()=>new Date().toISOString(),onChange=()=>{}}){
  const notify=ids=>{if(!ids.length)return;try{onChange([...new Set(ids)]);}catch{/* 알림 줄은 저장돼 있어 다음 읽기에 보인다. */}};
  function current(user){const live=store.get('users',typeof user==='string'?user:user?.id);if(!live?.active)throw fail('먼저 로그인해 주세요.',401);return live;}
  function prune(ownerId,at){
    const rows=store.all(KIND).filter(row=>row.ownerId===ownerId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    const cutoff=Date.parse(at)-KEEP_MS;
    rows.forEach((row,index)=>{if(index>=KEEP||Date.parse(row.createdAt)<cutoff)store.remove(KIND,row.id);});
  }
  // 이름 · 이메일은 적지 않는다. 화면 글은 그때 만든 한 줄만 둔다.
  function record({actorId,action,text}){
    const owner=workspaceOwner(store);if(!owner)return null;
    const at=clock(),id=randomUUID(),row={schema:1,id,ownerId:owner.id,actorId:actorId||null,action:String(action||'').slice(0,60),text:String(text||'').slice(0,300),createdAt:at,readAt:null};
    store.transaction(()=>{store.put(KIND,id,row);prune(owner.id,at);});
    notify([owner.id]);return row;
  }
  function projected(user){
    return store.all(KIND).filter(row=>row.ownerId===user.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id)).slice(0,KEEP)
      .map(row=>({id:PREFIX+row.id,kind:'admin_grant',title:'관리자 화면 기록',text:row.text,body:row.text,createdAt:row.createdAt,readAt:row.readAt||null,unread:!row.readAt,href:HREF,message:null}));
  }
  function list(user){user=current(user);const notifications=projected(user);return {notifications,unreadCount:notifications.filter(row=>row.unread).length};}
  function read(user,id){
    user=current(user);
    const key=typeof id==='string'&&id.startsWith(PREFIX)?id.slice(PREFIX.length):'',row=key&&store.get(KIND,key);
    if(!row||row.ownerId!==user.id)throw fail('알림을 찾을 수 없습니다.',404);
    if(!row.readAt){store.put(KIND,key,{...row,readAt:clock()});notify([user.id]);}
    return {ok:true,id,unreadCount:projected(user).filter(item=>item.unread).length};
  }
  function readAll(user){
    user=current(user);const unread=store.all(KIND).filter(row=>row.ownerId===user.id&&!row.readAt);
    if(unread.length){const at=clock();store.transaction(()=>{for(const row of unread)store.put(KIND,row.id,{...row,readAt:at});});notify([user.id]);}
    return {ok:true,count:unread.length,unreadCount:0};
  }
  return {record,list,read,readAll,owns:id=>typeof id==='string'&&id.startsWith(PREFIX)};
}
