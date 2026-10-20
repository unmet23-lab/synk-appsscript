import {randomUUID} from 'node:crypto';
import {CREATOR_SOURCE_FILES} from './creator-sources.mjs';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const object=value=>{if(!value||typeof value!=='object'||Array.isArray(value))throw fail('보낸 내용이 이상해요. 새로 읽은 뒤 다시 해 주세요.');return value;};
const text=(value,max,label,required=false)=>{if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw fail(`${label}에 쓸 수 없는 글자가 있거나 너무 길어요.`);const result=value.trim();if(required&&!result)throw fail(`${label} 칸을 채워 주세요.`);return result;};
function link(value){if(!value)return '';const raw=text(value,2048,'주소',true);let url;try{url=new URL(raw);}catch{throw fail('https://까지 붙인 전체 주소를 넣어 주세요.');}if(url.protocol!=='https:'||url.username||url.password)throw fail('https 주소만 넣을 수 있어요. 주소에 아이디·비밀번호가 들어 있으면 빼 주세요.');return url.href;}
function date(value){if(!value)return '';if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw fail('다음 확인일을 날짜로 읽지 못했어요. 달력에서 다시 골라 주세요.');return value;}
export const OPERATION_CHECKS=Object.freeze([
  {id:'mobile',title:'모바일 화면',hint:'휴대폰 화면에서 글이 잘 읽히는지, 잘리는 곳은 없는지, 단추가 잘 눌리는지 봐요. 어떤 기기·화면 폭에서 봤는지도 적어 두세요.'},
  {id:'links',title:'링크와 이동',hint:'공개된 주소에서 중요한 링크를 직접 눌러 보고, 뒤로 돌아오는 것까지 해 봐요.'},
  {id:'playback',title:'영상·소리 재생',hint:'영상과 소리를 처음부터 끝까지 틀어 보고, 무엇으로 들었는지와 결과를 적어요.'},
  {id:'intake',title:'문의·접수',hint:'시험 문의를 하나 보내 보고, 저장되는지·접수번호가 나오는지·담당자에게 닿는지까지 맞춰 봐요.'},
  {id:'errors',title:'오류와 복구',hint:'실패했을 때 안내가 뜨는지, 다시 할 수 있는지, 오류가 실제로 기록되는지 봐요.'},
  {id:'feedback',title:'고객 의견',hint:'실제로 받은 의견과 어떻게 처리했는지 적어요. 개인 정보는 꼭 필요한 만큼만 남겨요.'},
]);
const assets=CREATOR_SOURCE_FILES.filter(row=>row.category!=='license');
const recipeFields=['title','purpose','format','sourceIds','exampleUrl'];
export function createBrandQualityService({store,clock=()=>new Date().toISOString()}){
  function current(user,write=false){const live=user?.id&&store.get('users',user.id);if(!live?.active)throw fail('먼저 로그인해 주세요.',401);if(write&&live.role==='viewer')throw fail('읽기만 할 수 있는 계정이에요.',403);return live;}
  const sameTeam=(user,row)=>!!user.teamId&&user.teamId===row.teamId;
  const canRead=(user,row)=>row.ownerId===user.id||row.visibility==='company'||row.visibility==='team'&&(user.role==='admin'||sameTeam(user,row));
  const canEdit=(user,row)=>user.role!=='viewer'&&(user.role==='admin'||row.ownerId===user.id||row.visibility==='team'&&user.role==='manager'&&sameTeam(user,row));
  const canApprove=(user,row)=>user.role==='admin'||user.role==='manager'&&(row.ownerId===user.id||sameTeam(user,row));
  const name=id=>store.get('users',id)?.name||'이전 담당자';
  function forEdit(user,kind,id,input){const row=store.get(kind,text(id,100,'기록 ID',true));if(!row||!canRead(user,row))throw fail('그 기록을 찾지 못했어요.',404);if(!canEdit(user,row))throw fail('이 기록을 고칠 권한이 없어요.',403);if(input.revision!==row.revision)throw fail('그사이 다른 창에서 이 기록이 바뀌었어요. 새로 읽은 뒤 다시 고쳐 주세요.',409);return row;}
  function scope(user,input,old){const visibility=input.visibility??old?.visibility??'private';if(!['private','team','company'].includes(visibility))throw fail('공유 범위를 다시 골라 주세요.');if(visibility==='company'&&!(user.role==='admin'||user.role==='manager'))throw fail('회사 전체 공유는 팀장이나 관리자만 할 수 있어요.',403);const teamId=visibility==='team'?(old?.teamId||user.teamId):null;if(visibility==='team'&&(!teamId||!store.get('teams',teamId)?.active||user.role!=='admin'&&teamId!==user.teamId))throw fail('팀 공유는 내가 속한 활성 팀에만 할 수 있어요.',403);return {visibility,teamId};}
  function base(user,input,old){const at=clock();return {...(old||{id:randomUUID(),ownerId:user.id,createdAt:at}),...scope(user,input,old),title:text(input.title??old?.title,160,'제목',true),revision:(old?.revision||0)+1,updatedAt:at,updatedById:user.id};}
  function recipeView(user,row,displayName=name){return {...row,ownerName:displayName(row.ownerId),canEdit:canEdit(user,row),canApprove:canApprove(user,row),approvedByName:row.approvedById?displayName(row.approvedById):null};}
  function operationView(user,row,displayName=name){const list=Object.values(row.checks);return {...row,ownerName:displayName(row.ownerId),canEdit:canEdit(user,row),counts:{pass:list.filter(item=>item.status==='pass').length,issue:list.filter(item=>item.status==='issue').length,unverified:list.filter(item=>item.status==='unverified').length,notApplicable:list.filter(item=>item.status==='not-applicable').length}};}
  function saveRecipe(user,input,id=null){
    user=current(user,true);object(input);
    return store.transaction(()=>{
      const old=id?forEdit(user,'brandRecipes',id,input):null,row=base(user,input,old);
      if(!old&&store.all('brandRecipes').filter(item=>item.ownerId===user.id).length>=300)throw fail('내 제작 양식은 보관한 것까지 합쳐 300개까지예요.',409);
      row.purpose=text(input.purpose??old?.purpose??'',1600,'이 자료를 쓰는 목적',true);
      row.format=text(input.format??old?.format??'',120,'매체와 규격',true);
      const sourceIds=input.sourceIds??old?.sourceIds??[];
      if(!Array.isArray(sourceIds)||!sourceIds.length||sourceIds.length>20||sourceIds.some(id=>!assets.some(asset=>asset.id===id)))throw fail('함께 쓸 승인 자료를 하나 이상 골라 주세요.');
      row.sourceIds=[...new Set(sourceIds)];row.exampleUrl=link(input.exampleUrl??old?.exampleUrl??'');
      row.versions=[...(old?.versions||[])];
      if(input.version){object(input.version);if(row.versions.length>=100)throw fail('한 양식에 버전은 100개까지예요. 새 양식을 만들어 이어 가 주세요.',409);const version={id:randomUUID(),label:text(input.version.label,80,'버전 이름',true),body:text(input.version.body??'',12000,'제작 양식'),url:link(input.version.url??''),createdAt:clock(),createdById:user.id};if(!version.body&&!version.url)throw fail('양식 본문이나 템플릿 주소 중 하나는 넣어 주세요.');row.versions.push(version);}
      if(!row.versions.length)throw fail('첫 버전에 양식 본문이나 템플릿 주소를 넣어 주세요.');
      const changed=!old||!!input.version||recipeFields.some(key=>JSON.stringify(row[key])!==JSON.stringify(old[key]));
      row.status=input.status??(changed?'draft':old?.status??'draft');
      if(!['draft','approved','archived'].includes(row.status))throw fail('양식 상태를 다시 골라 주세요.');
      if(row.status==='approved'&&(changed||old?.status!=='approved')){if(!canApprove(user,row))throw fail('제작 양식 승인은 팀장이나 관리자만 할 수 있어요.',403);row.approvedAt=clock();row.approvedById=user.id;}
      if(row.status!=='approved'){row.approvedAt=null;row.approvedById=null;}
      store.put('brandRecipes',row.id,row);return {recipe:recipeView(user,row)};
    });
  }
  function saveOperation(user,input,id=null){
    user=current(user,true);object(input);
    return store.transaction(()=>{
      const old=id?forEdit(user,'brandOperations',id,input):null,row=base(user,input,old);
      if(!old&&store.all('brandOperations').filter(item=>item.ownerId===user.id).length>=500)throw fail('내 운영 확인은 보관한 것까지 합쳐 500개까지예요.',409);
      row.targetUrl=link(input.targetUrl??old?.targetUrl??'');row.nextDue=date(input.nextDue??old?.nextDue??'');row.nextAction=text(input.nextAction??old?.nextAction??'',1600,'다음에 할 일');
      row.archived=input.archived??old?.archived??false;if(typeof row.archived!=='boolean')throw fail('보관 표시가 이상해요.');
      const source=object(input.checks??{});if(Object.keys(source).some(key=>!OPERATION_CHECKS.some(item=>item.id===key)))throw fail('목록에 없는 확인 항목이 들어 있어요.');
      const changedTarget=!!old&&row.targetUrl!==old.targetUrl;
      row.checks={};row.history=[...(old?.history||[])];
      for(const item of OPERATION_CHECKS){
        const previous=old?.checks[item.id],provided=Object.hasOwn(source,item.id),value=provided?object(source[item.id]):changedTarget?{status:'unverified',evidence:'',environment:''}:previous||{status:'unverified',evidence:'',environment:''};
        const status=value.status;if(!['unverified','pass','issue','not-applicable'].includes(status))throw fail('확인 상태를 골라 주세요.');
        const evidence=text(value.evidence??'',2000,'확인 근거'),environment=text(value.environment??'',200,'확인한 기기·환경');
        if(status!=='unverified'&&!evidence)throw fail(`${item.title}: 무엇을 봤는지, 해당 없으면 그 이유를 적어 주세요.`);
        if(['pass','issue'].includes(status)&&!environment)throw fail(`${item.title}: 어떤 기기·환경에서 봤는지 적어 주세요.`);
        if(value.rechecked!==undefined&&typeof value.rechecked!=='boolean')throw fail('다시 확인 표시가 이상해요.');
        const changed=!previous||['status','evidence','environment'].some(key=>({status,evidence,environment})[key]!==previous[key])||changedTarget||value.rechecked===true;
        if(changedTarget&&provided&&status!=='unverified'&&value.rechecked!==true)throw fail('볼 주소를 바꿨어요. 새 주소에서 직접 다시 본 항목만 저장할 수 있어요.');
        const check={status,evidence,environment,checkedAt:status==='unverified'?null:changed?clock():previous.checkedAt,checkedById:status==='unverified'?null:changed?user.id:previous.checkedById};
        row.checks[item.id]=check;
        if(changed&&(old||status!=='unverified'))row.history.push({id:randomUUID(),checkId:item.id,...check,recordedAt:clock(),recordedById:user.id,targetUrl:row.targetUrl});
      }
      if(row.history.length>500)throw fail('확인 이력은 한 기록에 500개까지예요. 새 운영 확인을 만들어 이어 가 주세요.',409);
      store.put('brandOperations',row.id,row);return {operation:operationView(user,row)};
    });
  }
  function workspace(user){
    user=current(user);
    // Display names are reused only within this response; live authorization and
    // later requests still read current user records.
    const names=new Map([[user.id,user.name||'이전 담당자']]);
    const displayName=id=>{if(!names.has(id))names.set(id,name(id));return names.get(id);};
    return {recipes:store.all('brandRecipes').filter(row=>canRead(user,row)).map(row=>recipeView(user,row,displayName)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)),operations:store.all('brandOperations').filter(row=>canRead(user,row)).map(row=>operationView(user,row,displayName)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)),sources:assets.map(({id,title,category,usage,sourcePath})=>({id,title,category,usage,sourcePath})),checks:OPERATION_CHECKS,canWrite:user.role!=='viewer',canShareCompany:['admin','manager'].includes(user.role),canShareTeam:!!user.teamId&&!!store.get('teams',user.teamId)?.active,notice:'직접 본 것만 적는 기록이에요. 저장했다고 자동 검사를 통과했거나, 공개 뒤 잘 돌아가거나, 실제 고객 성과가 났다는 뜻은 아니에요.'};
  }
  return {workspace,saveRecipe,saveOperation};
}
