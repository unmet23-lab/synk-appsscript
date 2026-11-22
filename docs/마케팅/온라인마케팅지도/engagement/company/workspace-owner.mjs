import {randomUUID} from 'node:crypto';

// 회사 주인(관리자 직접부여 설계 4절 「관리자 올리기와 내리기」). 주인 한 명만 다른 직원을 관리자로 올리고 내린다.
// 주인은 settings/company와 따로 둔 문서에 적는다. /api/settings와 여러 시험·미리보기 도구가 company 문서를 통째로 다시 쓰기 때문이다.
// 적는 자리는 둘뿐이다: /api/setup이 첫 관리자를 만들 때, 그리고 부팅 때 비어 있고 활성 관리자가 정확히 한 명일 때.
export const OWNER_DOCUMENT='workspaceOwner';

export function workspaceOwnerId(store){
  const doc=store.get('settings',OWNER_DOCUMENT);
  return typeof doc?.userId==='string'&&doc.userId?doc.userId:null;
}

// 지금 쓸 수 있는 주인: 문서가 가리키는 사람이 활성 관리자일 때만 돌려준다.
export function workspaceOwner(store){
  const id=workspaceOwnerId(store),user=id&&store.get('users',id);
  return user&&user.id===id&&user.active===true&&user.role==='admin'?user:null;
}

export function isWorkspaceOwner(store,user){
  const owner=user?.id?workspaceOwner(store):null;
  return Boolean(owner)&&owner.id===user.id;
}

export function recordWorkspaceOwner(store,user,{at,setBy}){
  store.put('settings',OWNER_DOCUMENT,{userId:user.id,setAt:at,setBy});
}

// 부팅 때 한 번. 주인 문서가 이미 있으면 그대로 둔다. 활성 관리자가 여럿이거나 없으면 적지 않는다(관리자 올리기 경로는 닫힌 채 실패한다).
export function ensureWorkspaceOwnerAtBoot(store,{clock=()=>new Date().toISOString()}={}){
  return store.transaction(()=>{
    if(store.get('settings',OWNER_DOCUMENT))return {state:'existing'};
    const admins=store.all('users').filter(user=>user.active===true&&user.role==='admin');
    if(admins.length!==1)return {state:admins.length?'ambiguous':'none',adminCount:admins.length};
    const owner=admins[0],at=clock(),id=randomUUID();
    recordWorkspaceOwner(store,owner,{at,setBy:'boot'});
    store.put('audit',id,{id,userId:owner.id,action:'workspace-owner-set',subject:owner.id,via:'boot',at});
    return {state:'set',userId:owner.id};
  });
}

// 「첫 활성 관리자」를 고르던 자리(수집 정리, 성과 기록, 시작 링크, 새 공개 의뢰 담당)는 주인을 먼저 고른다.
// 주인이 없거나 쓸 수 없으면 그 자리가 원래 쓰던 고르기(fallback)를 그대로 쓴다.
export function ownerFirstAdmin(store,fallback){
  return workspaceOwner(store)||fallback();
}
