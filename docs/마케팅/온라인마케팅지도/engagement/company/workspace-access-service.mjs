import {randomUUID} from 'node:crypto';
import {hash} from './store.mjs';
import {WORKSPACE_COMPANIES,WORKSPACE_DUTIES,WORKSPACE_MENU_CLASSIFICATION,normalizeWorkspaceProfile,workspaceAccess,workspaceProfileState,hasWorkspaceFeature} from './workspace-access.mjs';

const fail=(message,status=400)=>Object.assign(new Error(message),{status,code:'WORKSPACE_ACCESS'});
export function createWorkspaceAccessService({store,clock=()=>new Date().toISOString()}){
  function admin(actor){const live=actor&&store.get('users',actor.id);if(!live?.active||live.role!=='admin')throw fail('회사와 역할 지정은 관리자만 할 수 있어요.',403);return live;}
  function catalog(actor){const live=actor&&store.get('users',actor.id);if(!live?.active)throw fail('먼저 로그인해 주세요.',401);return {access:workspaceAccess(live),companies:WORKSPACE_COMPANIES,duties:WORKSPACE_DUTIES,classification:WORKSPACE_MENU_CLASSIFICATION};}
  function audit(actor,action,subject,details){const id=randomUUID();store.put('audit',id,{id,userId:actor.id,action,subject,...details,at:clock()});}
  function legacyPending(){
    const rows=[];
    for(const token of store.db.prepare("SELECT hash,body,expiresAt FROM tokens WHERE purpose='invite' AND expiresAt>?").all(clock())){
      let body;try{body=JSON.parse(token.body);}catch{continue;}
      if(!body||typeof body!=='object'||body.workspaceProfile||typeof body.email!=='string')continue;
      // The old token has no public invitation ID or creation timestamp. Keep its
      // contract intact and expose a separate, non-credential ID for cancellation.
      rows.push({id:'legacy-'+hash('workspace-legacy-invite:'+token.hash),email:body.email.trim().toLowerCase(),name:body.name,role:body.role||'member',teamId:body.teamId||null,
        workspaceProfile:{memberships:[],duties:[]},status:'pending',legacy:true,tokenHash:token.hash,createdAt:null,expiresAt:token.expiresAt});
    }
    return rows;
  }
  function save(actor,id,input,{sessionHash}={}){
    const by=admin(actor),profile=normalizeWorkspaceProfile(input.workspaceProfile,{allowEmpty:true});
    return store.transaction(()=>{
      admin(by);const target=store.get('users',id);
      if(!target||target.role==='admin'&&target.id!==by.id)throw fail('이 직원의 소속을 바꿀 수 없어요.',403);
      const before=workspaceProfileState(target);
      if(!Number.isSafeInteger(input.revision)||input.revision!==before.revision)throw fail('그사이 소속이 바뀌었어요. 새로 불러온 뒤 다시 저장해 주세요.',409);
      const updated={...target,workspaceProfile:{...profile,revision:before.revision+1,updatedAt:clock(),updatedBy:by.id}};
      store.put('users',id,updated);
      if(id===by.id&&sessionHash)store.db.prepare('DELETE FROM tokens WHERE userId=? AND hash<>?').run(id,sessionHash);else store.revokeUser(id);
      audit(by,'workspace-profile-updated',id,{before:target.workspaceProfile||null,after:updated.workspaceProfile});
      const warnings=[];
      if(hasWorkspaceFeature(target,'clients')&&!hasWorkspaceFeature(updated,'clients')){
        if(store.get('pulseRequestSettings','main')?.ownerId===id)warnings.push('이 직원에게 지정된 새 고객 의뢰는 관리자에게 배정돼요.');
        if(store.all('clientProjects').some(row=>row.stage!=='archived'&&(row.ownerId===id||row.reviewerId===id)))warnings.push('기존 고객 업무의 담당자·검토자를 다시 지정해 주세요. 이 직원은 이제 고객 업무를 열 수 없어요.');
      }
      return {access:{...workspaceAccess(updated),...workspaceProfileState(updated)},warnings};
    });
  }
  function issue(actor,input){
    const by=admin(actor),profile=normalizeWorkspaceProfile(input.workspaceProfile);
    const email=typeof input.email==='string'?input.email.trim().toLowerCase():'',name=typeof input.name==='string'?input.name.trim():'';
    const role=input.role||'member',teamId=input.teamId||null;
    if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!name||name.length>80)throw fail('초대할 직원의 이름과 이메일을 확인해 주세요.');
    if(!['manager','member','viewer'].includes(role))throw fail('직원 접근 권한을 골라 주세요.');
    if(teamId&&!store.get('teams',teamId)?.active||role==='manager'&&!teamId)throw fail('운영 중인 소속 팀을 골라 주세요.');
    return store.transaction(()=>{
      admin(by);
      if(store.all('users').some(user=>user.email===email))throw fail('이미 등록된 직원이에요. 직원 목록에서 소속을 바꿔 주세요.',409);
      if(store.all('workspaceInvites').some(row=>row.email===email&&row.status==='pending'&&Date.parse(row.expiresAt)>Date.parse(clock()))||legacyPending().some(row=>row.email===email))throw fail('아직 유효한 초대가 있어요. 기존 초대를 취소한 뒤 다시 만들어 주세요.',409);
      const id=randomUUID(),createdAt=clock(),inviteBody={id,email,name,role,teamId,workspaceProfile:profile,invitedBy:by.id};
      const code=store.mint('invite',null,inviteBody,3*24*60),stored=store.readToken(code,'invite');
      store.put('workspaceInvites',id,{...inviteBody,status:'pending',tokenHash:hash(code),createdAt,expiresAt:stored.expiresAt});
      audit(by,'workspace-invited',id,{companies:profile.memberships.map(row=>row.company),role});
      return {id,code,expiresAt:stored.expiresAt,expiresInDays:3,delivery:'copy-link'};
    });
  }
  function inspect(code){
    const invitation=store.readToken(code,'invite');if(!invitation)throw fail('초대가 만료됐거나 이미 사용·취소됐어요.',403);
    const body=invitation.body;
    // Previously issued invitations retain the old contract until their 3-day expiry.
    if(body.workspaceProfile){
      const issuer=store.get('users',body.invitedBy),record=store.get('workspaceInvites',body.id);
      if(!issuer?.active||issuer.role!=='admin'||!record||record.status!=='pending'||record.tokenHash!==invitation.hash)throw fail('이 초대는 더 이상 사용할 수 없어요.',403);
      normalizeWorkspaceProfile(body.workspaceProfile);
    }
    if(body.teamId&&!store.get('teams',body.teamId)?.active)throw fail('초대의 소속 팀이 운영을 멈췄어요. 새 초대를 받아 주세요.',403);
    return {invitation,name:body.name,role:body.role,memberships:body.workspaceProfile?.memberships||[],duties:body.workspaceProfile?.duties||[],expiresAt:invitation.expiresAt};
  }
  function accepted(invitation,userId){
    const row=store.get('workspaceInvites',invitation.body.id);
    if(row)store.put('workspaceInvites',row.id,{...row,status:'accepted',acceptedAt:clock(),userId});
  }
  function list(actor){
    admin(actor);
    const rows=[...store.all('workspaceInvites'),...legacyPending()].map(({tokenHash,workspaceProfile,invitedBy,...row})=>({...row,status:row.status==='pending'&&Date.parse(row.expiresAt)<=Date.parse(clock())?'expired':row.status,memberships:workspaceProfile.memberships}));
    const newest=(a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'');
    return [...rows.filter(row=>row.status==='pending').sort(newest),...rows.filter(row=>row.status!=='pending').sort(newest).slice(0,100)];
  }
  function revoke(actor,id){
    const by=admin(actor);return store.transaction(()=>{
      admin(by);const row=store.get('workspaceInvites',id)||legacyPending().find(row=>row.id===id);if(!row)throw fail('초대를 찾지 못했어요.',404);
      if(row.status!=='pending'||Date.parse(row.expiresAt)<=Date.parse(clock()))throw fail('이미 만료되었거나 사용·취소된 초대예요.',409);
      store.db.prepare("DELETE FROM tokens WHERE hash=? AND purpose='invite'").run(row.tokenHash);
      store.put('workspaceInvites',id,{...row,status:'revoked',revokedAt:clock()});audit(by,'workspace-invite-revoked',id,{});return {ok:true};
    });
  }
  return {catalog,save,issue,inspect,accepted,list,revoke};
}
