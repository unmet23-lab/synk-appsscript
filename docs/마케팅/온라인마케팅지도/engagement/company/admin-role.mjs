import {randomUUID} from 'node:crypto';
import {workspaceOwner,isWorkspaceOwner} from './workspace-owner.mjs';
import {ADMIN_PROMOTION_DAILY_LIMIT} from './admin-grants.mjs';

// 다른 직원을 Workspace 관리자로 올리고 내린다(관리자 직접부여 설계 4절 ④). 회사 서버 안의 일이고 중앙 표를 건드리지 않는다.
// 올린 관리자는 회사 자료 전부를 열지만 중앙의 명부 · 반 · 이용 권한은 따라가지 않는다(중앙 수동 열람권은 운영 SQL로만 준다).
const ROLES=['admin','manager','member','viewer'],DEMOTE_ROLES=['manager','member','viewer'],DAY_MS=86400000;
const MESSAGES={
  INVALID_ADMIN_ROLE_REQUEST:'바꿀 내용을 확인해 주세요. 화면을 새로 불러온 뒤 다시 해 주세요.',
  CONFIRM_REQUIRED:'확인 창에서 직접 확인해 주세요.',
  OWNER_REQUIRED:'관리자를 올리고 내리는 일은 회사 주인만 할 수 있어요.',
  SYNK_LOGIN_REQUIRED:'관리자를 올리고 내리려면 SYNK ID로 로그인해야 해요.',
  REAUTH_REQUIRED:'15분 안에 SYNK ID로 다시 로그인해야 이 일을 할 수 있어요. 「SYNK ID로 다시 로그인」을 눌러 한 번 더 로그인해 주세요.',
  TARGET_NOT_FOUND:'직원을 찾지 못했어요. 화면을 새로 불러와 주세요.',
  TARGET_INACTIVE:'이용을 멈춘 직원은 관리자로 올리거나 내릴 수 없어요.',
  SELF_CHANGE:'내 관리자 권한은 여기서 바꿀 수 없어요.',
  OWNER_PROTECTED:'회사 주인은 관리자에서 내릴 수 없어요.',
  ROLE_CHANGED:'그사이 이 직원의 역할이 바뀌었어요. 화면을 새로 불러온 뒤 다시 해 주세요.',
  SYNK_ID_REQUIRED:'SYNK ID가 연결된 계정만 관리자로 올릴 수 있어요. 회사 비밀번호만 쓰는 계정은 올리지 않아요.',
  LAST_ADMIN:'마지막 관리자는 내릴 수 없어요.',
  DAILY_LIMIT:'관리자 올리기는 하루 한 번만 할 수 있어요. 24시간 뒤에 다시 해 주세요.',
};
export function adminRoleError(status,code,message=MESSAGES[code]||'요청을 처리하지 못했어요.'){
  return Object.assign(new Error(message),{status,code,adminRole:true});
}

export function parseAdminRoleRequest(input){
  const invalid=()=>adminRoleError(400,'INVALID_ADMIN_ROLE_REQUEST');
  if(!input||typeof input!=='object'||Array.isArray(input))throw invalid();
  if(Object.keys(input).some(key=>!['admin','role','teamId','expectedRole','confirm'].includes(key)))throw invalid();
  if(typeof input.admin!=='boolean'||!ROLES.includes(input.expectedRole))throw invalid();
  if(input.admin&&(Object.hasOwn(input,'role')||Object.hasOwn(input,'teamId')))throw invalid();
  if(!input.admin&&(!DEMOTE_ROLES.includes(input.role)||input.teamId!==undefined&&input.teamId!==null&&(typeof input.teamId!=='string'||input.teamId.length>100)))throw invalid();
  if(input.confirm!==true)throw adminRoleError(400,'CONFIRM_REQUIRED');
  return {admin:input.admin,expectedRole:input.expectedRole,role:input.admin?'admin':input.role,teamId:input.admin?undefined:(input.teamId||null)};
}

export function createAdminRoleService({store,clock=()=>new Date().toISOString(),recentInteractive,teamFor,ownerAlerts=null,onChanged=()=>{}}){
  const linked=userId=>Boolean(store.db.prepare('SELECT 1 FROM synk_identity_links WHERE company_user_id=?').get(userId));
  function promotionsToday(at){
    const since=Date.parse(at)-DAY_MS;
    return store.all('audit').filter(row=>row.action==='admin-role-granted'&&Date.parse(row.at)>since).length;
  }
  // 그 사람에게 걸린 담당을 경고로 돌려준다(workspaceProfiles.save의 warnings와 같은 꼴).
  function warningsFor(target){
    const warnings=[];
    if(store.get('pulseRequestSettings','main')?.ownerId===target.id)warnings.push('이 직원은 새 고객 의뢰 담당이에요. 맡을 수 없게 되면 새 의뢰는 회사 주인에게 가요.');
    if(store.all('clientProjects').some(row=>row.stage!=='archived'&&(row.ownerId===target.id||row.reviewerId===target.id)))warnings.push('이 직원이 맡은 고객 업무(담당자 · 검토자)가 있어요. 다시 지정해야 하는지 확인해 주세요.');
    return warnings;
  }
  function cancelViewerHandoffs(targetId,at){
    for(const h of store.all('handoffs'))if(h.status==='awaiting-connection'&&h.toOwnerIds.includes(targetId)){
      store.put('handoffs',h.id,{...h,status:'cancelled',cancelledAt:at,reason:'대상자의 역할이 열람자로 변경되어 취소'});
      const c=store.get('channels',h.channelId);if(c?.pendingHandoffId===h.id)store.put('channels',c.id,{...c,pendingHandoffId:null});
    }
  }
  // session: 본문을 받은 뒤 다시 읽은 회사 세션 줄(server.mjs의 session(req)).
  function change(session,targetId,input){
    const request=parseAdminRoleRequest(input);
    const caller=session?.user&&store.get('users',session.user.id);
    if(!caller?.active||caller.role!=='admin'||!isWorkspaceOwner(store,caller))throw adminRoleError(403,'OWNER_REQUIRED');
    if(!session.body?.synkIdentity||session.body.via==='launch')throw adminRoleError(403,'SYNK_LOGIN_REQUIRED');
    if(!recentInteractive(session))throw adminRoleError(409,'REAUTH_REQUIRED');
    let result;
    store.transaction(()=>{
      // 트랜잭션 안에서 주인과 대상의 최신 users 줄을 다시 읽는다.
      const owner=workspaceOwner(store),me=store.get('users',caller.id);
      if(!owner||owner.id!==caller.id||!me?.active||me.role!=='admin')throw adminRoleError(403,'OWNER_REQUIRED');
      const target=typeof targetId==='string'&&store.get('users',targetId);
      if(!target||target.id!==targetId)throw adminRoleError(404,'TARGET_NOT_FOUND');
      if(target.id===me.id)throw adminRoleError(403,'SELF_CHANGE');
      if(target.id===owner.id)throw adminRoleError(403,'OWNER_PROTECTED');
      if(target.active!==true)throw adminRoleError(409,'TARGET_INACTIVE');
      if(target.role!==request.expectedRole)throw adminRoleError(409,'ROLE_CHANGED');
      const at=clock(),before={role:target.role,teamId:target.teamId||null};
      let updated,warnings=[];
      if(request.admin){
        if(target.role==='admin')throw adminRoleError(409,'ROLE_CHANGED');
        if(!linked(target.id))throw adminRoleError(409,'SYNK_ID_REQUIRED');
        if(promotionsToday(at)>=ADMIN_PROMOTION_DAILY_LIMIT)throw adminRoleError(429,'DAILY_LIMIT');
        updated={...target,role:'admin'};
      }else{
        if(target.role!=='admin')throw adminRoleError(409,'ROLE_CHANGED');
        // 주인 보호로 지켜지지만 마지막 활성 관리자는 따로 한 번 더 본다.
        if(!store.all('users').some(user=>user.id!==target.id&&user.active===true&&user.role==='admin'))throw adminRoleError(409,'LAST_ADMIN');
        teamFor(request.teamId);
        if(request.role==='manager'&&!request.teamId)throw adminRoleError(400,'INVALID_ADMIN_ROLE_REQUEST','팀장은 팀을 꼭 골라야 해요.');
        updated={...target,role:request.role,teamId:request.teamId};
        warnings=warningsFor(target);
      }
      store.put('users',target.id,updated);
      // 바꾼 뒤 대상의 세션을 모두 끊는다. 다음 로그인부터 새 역할로 연다.
      store.revokeUser(target.id);
      if(updated.role==='viewer')cancelViewerHandoffs(target.id,at);
      const action=request.admin?'admin-role-granted':'admin-role-revoked',id=randomUUID();
      store.put('audit',id,{id,userId:me.id,action,subject:target.id,before,after:{role:updated.role,teamId:updated.teamId||null},at});
      result={ok:true,member:{id:updated.id,role:updated.role,teamId:updated.teamId||null},warnings,action,targetName:target.name};
    });
    const {targetName,action,...response}=result;
    ownerAlerts?.record({actorId:caller.id,action,text:action==='admin-role-granted'?`${targetName} 님을 Workspace 관리자로 올렸어요.`:`${targetName} 님을 Workspace 관리자에서 내렸어요.`});
    try{onChanged([response.member.id,caller.id]);}catch{}
    return response;
  }
  return {change};
}
