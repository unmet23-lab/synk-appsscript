import {randomUUID} from 'node:crypto';
import {CREATOR_SOURCE_FILES} from './creator-sources.mjs';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const object=value=>{if(!value||typeof value!=='object'||Array.isArray(value))throw fail('입력 내용을 확인해 주세요.');return value;};
const text=(value,max,label,required=false)=>{if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw fail(`${label}을 확인해 주세요.`);const result=value.trim();if(required&&!result)throw fail(`${label}을 입력해 주세요.`);return result;};
function link(value){if(!value)return '';const raw=text(value,2048,'주소',true);let url;try{url=new URL(raw);}catch{throw fail('전체 HTTPS 주소를 입력해 주세요.');}if(url.protocol!=='https:'||url.username||url.password)throw fail('자격증명이 없는 HTTPS 주소만 사용할 수 있습니다.');return url.href;}
function date(value){if(!value)return '';if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw fail('다음 확인일을 올바른 날짜로 입력해 주세요.');return value;}
export const OPERATION_CHECKS=Object.freeze([
  {id:'mobile',title:'모바일 화면',hint:'사용한 기기·화면 폭에서 읽힘, 잘림, 누르기를 확인하세요.'},
  {id:'links',title:'링크와 이동',hint:'실제 공개 주소에서 핵심 링크와 돌아오기를 실행하세요.'},
  {id:'playback',title:'영상·소리 재생',hint:'전체 재생과 직접 청취한 환경·결과를 남기세요.'},
  {id:'intake',title:'문의·접수',hint:'시험 문의의 저장, 접수번호, 담당자 확인까지 대조하세요.'},
  {id:'errors',title:'오류와 복구',hint:'실패 안내, 재시도와 실제 오류 기록을 확인하세요.'},
  {id:'feedback',title:'고객 의견',hint:'실제 받은 의견과 처리 결과를 적고 개인 정보는 최소화하세요.'},
]);
const assets=CREATOR_SOURCE_FILES.filter(row=>row.category!=='license');
const recipeFields=['title','purpose','format','sourceIds','exampleUrl'];
export function createBrandQualityService({store,clock=()=>new Date().toISOString()}){
  function current(user,write=false){const live=user?.id&&store.get('users',user.id);if(!live?.active)throw fail('먼저 로그인해 주세요.',401);if(write&&live.role==='viewer')throw fail('열람 계정은 기록을 변경할 수 없습니다.',403);return live;}
  const sameTeam=(user,row)=>!!user.teamId&&user.teamId===row.teamId;
  const canRead=(user,row)=>row.ownerId===user.id||row.visibility==='company'||row.visibility==='team'&&(user.role==='admin'||sameTeam(user,row));
  const canEdit=(user,row)=>user.role!=='viewer'&&(user.role==='admin'||row.ownerId===user.id||row.visibility==='team'&&user.role==='manager'&&sameTeam(user,row));
  const canApprove=(user,row)=>user.role==='admin'||user.role==='manager'&&(row.ownerId===user.id||sameTeam(user,row));
  const name=id=>store.get('users',id)?.name||'이전 담당자';
  function forEdit(user,kind,id,input){const row=store.get(kind,text(id,100,'기록 ID',true));if(!row||!canRead(user,row))throw fail('기록을 찾을 수 없습니다.',404);if(!canEdit(user,row))throw fail('이 기록을 수정할 권한이 없습니다.',403);if(input.revision!==row.revision)throw fail('다른 창에서 변경된 기록입니다. 새로 읽은 뒤 다시 수정해 주세요.',409);return row;}
  function scope(user,input,old){const visibility=input.visibility??old?.visibility??'private';if(!['private','team','company'].includes(visibility))throw fail('공유 범위를 확인해 주세요.');if(visibility==='company'&&!(user.role==='admin'||user.role==='manager'))throw fail('팀장 또는 관리자만 회사 전체에 공유할 수 있습니다.',403);const teamId=visibility==='team'?(old?.teamId||user.teamId):null;if(visibility==='team'&&(!teamId||!store.get('teams',teamId)?.active||user.role!=='admin'&&teamId!==user.teamId))throw fail('활성 팀에 속한 기록만 팀에 공유할 수 있습니다.',403);return {visibility,teamId};}
  function base(user,input,old){const at=clock();return {...(old||{id:randomUUID(),ownerId:user.id,createdAt:at}),...scope(user,input,old),title:text(input.title??old?.title,160,'제목',true),revision:(old?.revision||0)+1,updatedAt:at,updatedById:user.id};}
  function recipeView(user,row,displayName=name){return {...row,ownerName:displayName(row.ownerId),canEdit:canEdit(user,row),canApprove:canApprove(user,row),approvedByName:row.approvedById?displayName(row.approvedById):null};}
  function operationView(user,row,displayName=name){const list=Object.values(row.checks);return {...row,ownerName:displayName(row.ownerId),canEdit:canEdit(user,row),counts:{pass:list.filter(item=>item.status==='pass').length,issue:list.filter(item=>item.status==='issue').length,unverified:list.filter(item=>item.status==='unverified').length,notApplicable:list.filter(item=>item.status==='not-applicable').length}};}
  function saveRecipe(user,input,id=null){
    user=current(user,true);object(input);
    return store.transaction(()=>{
      const old=id?forEdit(user,'brandRecipes',id,input):null,row=base(user,input,old);
      if(!old&&store.all('brandRecipes').filter(item=>item.ownerId===user.id).length>=300)throw fail('개인 제작 양식은 최대 300개입니다.',409);
      row.purpose=text(input.purpose??old?.purpose??'',1600,'이 자료를 쓰는 목적',true);
      row.format=text(input.format??old?.format??'',120,'매체와 규격',true);
      const sourceIds=input.sourceIds??old?.sourceIds??[];
      if(!Array.isArray(sourceIds)||!sourceIds.length||sourceIds.length>20||sourceIds.some(id=>!assets.some(asset=>asset.id===id)))throw fail('승인 제작 자료를 하나 이상 선택해 주세요.');
      row.sourceIds=[...new Set(sourceIds)];row.exampleUrl=link(input.exampleUrl??old?.exampleUrl??'');
      row.versions=[...(old?.versions||[])];
      if(input.version){object(input.version);if(row.versions.length>=100)throw fail('양식 버전은 최대 100개입니다.',409);const version={id:randomUUID(),label:text(input.version.label,80,'버전 이름',true),body:text(input.version.body??'',12000,'제작 양식'),url:link(input.version.url??''),createdAt:clock(),createdById:user.id};if(!version.body&&!version.url)throw fail('제작 양식 또는 템플릿 주소를 입력해 주세요.');row.versions.push(version);}
      if(!row.versions.length)throw fail('첫 제작 양식을 입력해 주세요.');
      const changed=!old||!!input.version||recipeFields.some(key=>JSON.stringify(row[key])!==JSON.stringify(old[key]));
      row.status=input.status??(changed?'draft':old?.status??'draft');
      if(!['draft','approved','archived'].includes(row.status))throw fail('양식 상태를 확인해 주세요.');
      if(row.status==='approved'&&(changed||old?.status!=='approved')){if(!canApprove(user,row))throw fail('팀장 또는 관리자만 제작 양식을 승인할 수 있습니다.',403);row.approvedAt=clock();row.approvedById=user.id;}
      if(row.status!=='approved'){row.approvedAt=null;row.approvedById=null;}
      store.put('brandRecipes',row.id,row);return {recipe:recipeView(user,row)};
    });
  }
  function saveOperation(user,input,id=null){
    user=current(user,true);object(input);
    return store.transaction(()=>{
      const old=id?forEdit(user,'brandOperations',id,input):null,row=base(user,input,old);
      if(!old&&store.all('brandOperations').filter(item=>item.ownerId===user.id).length>=500)throw fail('개인 운영 기록은 최대 500개입니다.',409);
      row.targetUrl=link(input.targetUrl??old?.targetUrl??'');row.nextDue=date(input.nextDue??old?.nextDue??'');row.nextAction=text(input.nextAction??old?.nextAction??'',1600,'다음 처리');
      row.archived=input.archived??old?.archived??false;if(typeof row.archived!=='boolean')throw fail('보관 여부를 확인해 주세요.');
      const source=object(input.checks??{});if(Object.keys(source).some(key=>!OPERATION_CHECKS.some(item=>item.id===key)))throw fail('등록된 확인 항목을 사용해 주세요.');
      const changedTarget=!!old&&row.targetUrl!==old.targetUrl;
      row.checks={};row.history=[...(old?.history||[])];
      for(const item of OPERATION_CHECKS){
        const previous=old?.checks[item.id],provided=Object.hasOwn(source,item.id),value=provided?object(source[item.id]):changedTarget?{status:'unverified',evidence:'',environment:''}:previous||{status:'unverified',evidence:'',environment:''};
        const status=value.status;if(!['unverified','pass','issue','not-applicable'].includes(status))throw fail('확인 상태를 선택해 주세요.');
        const evidence=text(value.evidence??'',2000,'확인 근거'),environment=text(value.environment??'',200,'확인 환경');
        if(status!=='unverified'&&!evidence)throw fail(`${item.title}: 확인 근거 또는 해당 없는 이유를 입력해 주세요.`);
        if(['pass','issue'].includes(status)&&!environment)throw fail(`${item.title}: 사용한 기기·환경을 입력해 주세요.`);
        if(value.rechecked!==undefined&&typeof value.rechecked!=='boolean')throw fail('다시 확인 여부를 확인해 주세요.');
        const changed=!previous||['status','evidence','environment'].some(key=>({status,evidence,environment})[key]!==previous[key])||changedTarget||value.rechecked===true;
        if(changedTarget&&provided&&status!=='unverified'&&value.rechecked!==true)throw fail('대상 주소를 바꿨습니다. 새 주소를 직접 확인한 항목만 다시 저장해 주세요.');
        const check={status,evidence,environment,checkedAt:status==='unverified'?null:changed?clock():previous.checkedAt,checkedById:status==='unverified'?null:changed?user.id:previous.checkedById};
        row.checks[item.id]=check;
        if(changed&&(old||status!=='unverified'))row.history.push({id:randomUUID(),checkId:item.id,...check,recordedAt:clock(),recordedById:user.id,targetUrl:row.targetUrl});
      }
      if(row.history.length>500)throw fail('확인 이력이 500개입니다. 새 운영 기록을 만들어 주세요.',409);
      store.put('brandOperations',row.id,row);return {operation:operationView(user,row)};
    });
  }
  function workspace(user){
    user=current(user);
    // Display names are reused only within this response; live authorization and
    // later requests still read current user records.
    const names=new Map([[user.id,user.name||'이전 담당자']]);
    const displayName=id=>{if(!names.has(id))names.set(id,name(id));return names.get(id);};
    return {recipes:store.all('brandRecipes').filter(row=>canRead(user,row)).map(row=>recipeView(user,row,displayName)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)),operations:store.all('brandOperations').filter(row=>canRead(user,row)).map(row=>operationView(user,row,displayName)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)),sources:assets.map(({id,title,category,usage,sourcePath})=>({id,title,category,usage,sourcePath})),checks:OPERATION_CHECKS,canWrite:user.role!=='viewer',canShareCompany:['admin','manager'].includes(user.role),canShareTeam:!!user.teamId&&!!store.get('teams',user.teamId)?.active,notice:'직접 확인한 환경과 근거를 기록합니다. 저장만으로 자동 검사·공개 운영·실제 고객 성과가 확인되지는 않습니다.'};
  }
  return {workspace,saveRecipe,saveOperation};
}
