// Company membership selects tools; existing record-level ACLs still apply.
export const WORKSPACE_COMPANIES = Object.freeze([
  {id:'LAB',name:'SYNK LAB',roles:[['teacher','교사'],['operations','운영 담당'],['principal','원장']],features:['teaching']},
  {id:'PATH',name:'SYNK PATH',roles:[['counselor','상담 담당'],['operations','운영 담당'],['manager','정착·상담 책임자']],features:['path']},
  {id:'SHIFT',name:'SYNK SHIFT',roles:[['instructor','강사'],['automation','자동화 담당'],['manager','강의·사업 책임자']],features:['lectures']},
  {id:'PULSE',name:'SYNK PULSE',roles:[['producer','제작 담당'],['casting','캐스팅 담당'],['manager','제작 책임자']],features:['production','clients']}
]);
export const WORKSPACE_DUTIES = Object.freeze([
  {id:'social',label:'SNS·마케팅',features:['social','production','pages']},
  {id:'production',label:'콘텐츠 제작',features:['production']},
  {id:'clients',label:'제작 고객 관리',features:['clients']},
  {id:'pages',label:'페이지·채널 관리',features:['pages']},
  {id:'feedback',label:'체험 의견 확인',features:['feedback']}
]);
const featureIds=['teaching','path','lectures','production','clients','social','pages','feedback'];
const fail=(message,status=400)=>Object.assign(new Error(message),{status,code:'WORKSPACE_ACCESS'});
const plain=value=>value&&typeof value==='object'&&!Array.isArray(value);

export function normalizeWorkspaceProfile(input,{allowEmpty=false}={}){
  if(!plain(input)||!Array.isArray(input.memberships)||input.memberships.length>4||!Array.isArray(input.duties)||input.duties.length>WORKSPACE_DUTIES.length)throw fail('소속 회사와 담당 업무를 확인해 주세요.');
  const seen=new Set();
  const memberships=input.memberships.map(row=>{
    if(!plain(row))throw fail('회사별 역할을 골라 주세요.');
    const company=WORKSPACE_COMPANIES.find(item=>item.id===row.company);
    if(!company||seen.has(company.id)||!company.roles.some(([id])=>id===row.role))throw fail('회사는 중복 없이 고르고, 회사에 맞는 역할을 정해 주세요.');
    seen.add(company.id);return {company:company.id,role:row.role};
  }).sort((a,b)=>WORKSPACE_COMPANIES.findIndex(x=>x.id===a.company)-WORKSPACE_COMPANIES.findIndex(x=>x.id===b.company));
  if(!allowEmpty&&!memberships.length)throw fail('소속 회사를 하나 이상 골라 주세요. 겸임이면 여러 회사를 고를 수 있어요.');
  if(input.duties.some(id=>!WORKSPACE_DUTIES.some(row=>row.id===id))||new Set(input.duties).size!==input.duties.length)throw fail('담당 업무를 확인해 주세요.');
  return {version:1,memberships,duties:WORKSPACE_DUTIES.filter(row=>input.duties.includes(row.id)).map(row=>row.id)};
}

// Stored assignment metadata remains editable after an account is stopped.
// It must not be used as proof of effective access.
export function workspaceProfileState(user){
  const raw=user?.workspaceProfile,configured=!!user&&Object.hasOwn(user,'workspaceProfile');
  let profile;
  try{profile=configured?normalizeWorkspaceProfile(raw,{allowEmpty:true}):null;}catch{profile={memberships:[],duties:[]};}
  const memberships=profile?.memberships||[],duties=profile?.duties||[];
  return {configured,revision:Number.isSafeInteger(raw?.revision)?raw.revision:0,memberships,duties};
}
export function workspaceAccess(user){
  if(!user||user.active===false)return {configured:false,revision:0,memberships:[],duties:[],features:[],companies:[],admin:false,legacy:false};
  const admin=user.role==='admin',{configured,revision,memberships,duties}=workspaceProfileState(user);
  const features=new Set(admin?featureIds:[]);
  for(const member of memberships){
    const company=WORKSPACE_COMPANIES.find(row=>row.id===member.company);
    for(const feature of company.features){
      if(feature==='teaching'&&member.role==='operations')continue;
      if(feature==='lectures'&&member.role==='automation')continue;
      features.add(feature);
    }
  }
  for(const duty of duties)for(const feature of WORKSPACE_DUTIES.find(row=>row.id===duty).features)features.add(feature);
  return {configured,legacy:!configured,revision,admin,memberships,duties,features:[...features],companies:admin?WORKSPACE_COMPANIES.map(row=>row.id):memberships.map(row=>row.company)};
}
export function hasWorkspaceFeature(user,feature){
  const access=workspaceAccess(user);
  // Old accounts retain their existing permissions until the owner assigns them.
  // New invitations always have a validated profile, so this cannot be opted into.
  return Boolean(user&&user.active!==false&&(access.admin||access.legacy&&featureIds.includes(feature)&&!['path','lectures'].includes(feature)||access.features.includes(feature)));
}
export function requireWorkspaceFeature(user,feature){
  if(!user||user.active===false)throw fail('먼저 회사 계정으로 로그인해 주세요.',401);
  if(!hasWorkspaceFeature(user,feature))throw fail('현재 소속과 담당 업무에서는 이 기능을 사용할 수 없어요. 관리자에게 확인해 주세요.',403);
}
export function workspaceRouteFeature(path){
  if(path.startsWith('/api/teaching/'))return 'teaching';
  if(/^\/api\/(?:channels(?:\/|$)|oauth\/)/.test(path))return 'pages';
  if(/^\/api\/(?:social(?:\/|$)|collect$|analytics$|day$|export\.csv$|hype$|team-overview$|team-trends$|post-performance(?:\/|$)|publication-|weekly-summary$)/.test(path))return 'social';
  if(/^\/api\/(?:client-|customer-workspaces(?:\/|$)|personas(?:\/|$)|pulse-|settings\/pulse-)/.test(path))return 'clients';
  if(/^\/api\/(?:content-|creative-research(?:\/|$)|daily-trends(?:\/|$)|studio-|creator-|brand-quality(?:\/|$)|research-production(?:\/|$)|automation-health$|workroom-guide$|workroom-source\/|workroom-practice\/)/.test(path))return 'production';
  if(path.startsWith('/api/trial-feedback/'))return 'feedback';
  return null;
}
export const WORKSPACE_MENU_CLASSIFICATION=Object.freeze([
  {group:'common',label:'전사 공통',menus:['오늘 할 일','메신저·통화·공유 파일','내 업무 카드','회사 안내']},
  {group:'company',label:'회사별',menus:['LAB 수업 — 원장·교사','PATH 상담·정착 업무','SHIFT 강의 — 책임자·강사','PULSE 제작실·고객 관리']},
  {group:'duty',label:'담당자 전용',menus:['SNS·마케팅','콘텐츠 제작','제작 고객 관리','페이지 관리','체험 의견 확인','팀·크루 관리 — 관리자·팀장','회사 설정·문의 접수 — 관리자']}
]);
