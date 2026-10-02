'use strict';

// One shared workspace for real work, review and accumulated examples.
const sw={userId:'',request:0,loadRequest:0,detailRequest:0,data:null,view:'board',productionId:'',detail:null,busy:false,error:'',loading:false,filters:{}};
const swStages={idea:'준비',making:'제작 중',review:'검토 요청',ready:'완성',published:'게시 기록',archived:'보관'};
const swButton=(text,action,glyph='',classes='',attrs='')=>button(text,'sw-'+action,glyph,classes,attrs);
const swGuard=()=>({userId:state.user?.id,request:sw.request});
const swAlive=guard=>!!guard.userId&&state.user?.id===guard.userId&&sw.request===guard.request;
const swDetail=()=>sw.detail?.id===sw.productionId?sw.detail:null;
const swDate=value=>value?escape(String(value).slice(0,10).replaceAll('-','.')):'기한 없음';
async function swLoadExamples(){
  if(!state.user)return;
  if(sw.userId!==state.user.id)resetStudioWorkspace();sw.userId=state.user.id;
  const guard=swGuard(),request=++sw.loadRequest;sw.loading=true;sw.error='';
  try{const result=await api('/api/studio-examples');if(!swAlive(guard)||request!==sw.loadRequest)return;sw.data={productions:[],materials:[],...sw.data,...result};}
  catch(error){if(swAlive(guard)&&request===sw.loadRequest)sw.error=error.message;}
  finally{if(swAlive(guard)&&request===sw.loadRequest){sw.loading=false;if(state.tab==='content'&&cp.view==='examples')render();}}
}
function resetStudioWorkspace(){sw.request++;sw.loadRequest++;sw.detailRequest++;if(typeof swResetReview==='function')swResetReview();Object.assign(sw,{userId:'',data:null,view:'board',productionId:'',detail:null,busy:false,error:'',loading:false,filters:{}});}
async function swReload({renderPage=true}={}){
  if(!state.user)return;
  if(sw.userId!==state.user.id)resetStudioWorkspace();sw.userId=state.user.id;
  const guard=swGuard(),request=++sw.loadRequest;sw.loading=true;sw.error='';
  if(renderPage&&state.tab==='studio'&&!sw.data)render();
  try{const data=await api('/api/studio-workspace');if(!swAlive(guard)||request!==sw.loadRequest)return;sw.data=data;}
  catch(error){if(swAlive(guard)&&request===sw.loadRequest)sw.error=error.message;}
  finally{if(swAlive(guard)&&request===sw.loadRequest){sw.loading=false;if(renderPage&&state.tab==='studio')render();}}
}
function swAcceptProduction(production){
  if(!production)return;sw.detail=production;
  if(sw.data){const {versions,notes,...summary}=production;sw.data.productions=[summary,...sw.data.productions.filter(row=>row.id!==production.id)];}
}
async function swOpenProduction(id){
  const guard=swGuard(),request=++sw.detailRequest,tab=state.tab;sw.error='';
  const result=await api('/api/studio-productions/'+encodeURIComponent(id));
  if(!swAlive(guard)||request!==sw.detailRequest||state.tab!==tab)return;
  if(sw.productionId!==id&&typeof swResetReview==='function')swResetReview();
  sw.productionId=id;swAcceptProduction(result.production);sw.view='review';state.tab='studio';render();window.scrollTo(0,0);
}
function studioPage(){
  const heading=pageHeading('CREATIVE WORKSPACE','제작 스튜디오','직접 만든 것과 배운 것이, 다음 작품의 바탕이 됩니다.',!isViewer()?swButton('새 작업','new-production','plus','primary'):'');
  if(!sw.data)return heading+(sw.error?`<div class="sw-message" role="alert">${escape(sw.error)}${swButton('다시 불러오기','reload','refresh')}</div>`:'<div class="loading-panel"><span class="loading-line"></span><p>작업과 팀의 제작 경험을 불러오고 있어요.</p></div>');
  const tabs=[['board','제작 상황판'],['materials','경험·소재 보관함'],['examples','좋은 콘텐츠 예시함']];
  if(sw.productionId&&sw.detail)tabs.push(['review','완성본 검토실']);
  return `${heading}<nav class="sw-tabs" aria-label="제작 스튜디오 메뉴">${tabs.map(([id,label])=>`<button type="button" data-action="sw-view" data-view="${id}" class="${sw.view===id?'active':''}" aria-current="${sw.view===id?'page':'false'}">${label}</button>`).join('')}</nav>${sw.error?`<p class="sw-message" role="alert">${escape(sw.error)}</p>`:''}${sw.view==='materials'?swMaterialsPage():sw.view==='examples'?swExamplesPage():sw.view==='review'&&swDetail()?swReviewPage():swBoardPage()}`;
}
function swMembersOptions(selected,optional=false,selectedName='기존 지정 담당자'){
  const members=sw.data?.assignableMembers||[{id:state.user.id,name:state.user.name}];
  return (optional?cpOption('','지정하지 않음',selected):'')+(selected&&!members.some(row=>row.id===selected)?`<option value="${escape(selected)}" selected disabled>${escape(selectedName||'기존 지정 담당자')}</option>`:'')+members.map(row=>cpOption(row.id,row.name,selected)).join('');
}
function swProductionModal(id='',seed={}){
  const row=id?(sw.detail?.id===id?sw.detail:sw.data.productions.find(item=>item.id===id)):null;
  if(id&&!row?.canEdit){notify('이 작업을 수정할 수 없습니다.');return;}
  const value=row||{title:seed.title||'',assigneeId:state.user.id,reviewerId:'',teamId:'',stage:'idea',nextAction:'',blocker:'',dueDate:'',draftId:seed.draftId||''};
  const teams=sw.data.assignableTeams||[];
  modal(id?'작업 정보 바꾸기':'새 작업 시작하기','만들고 있는 것과 다음 할 일을 짧게 남겨 주세요.',`<form class="form-stack" data-sw-form="production" data-id="${escape(id)}"><div class="form-error" role="alert"></div><label class="field">작업 제목<input name="title" required maxlength="200" value="${escape(value.title)}" placeholder="예: 회의 메모를 정리하는 실제 과정"></label><div class="field-row"><label class="field">제작 담당<select name="assigneeId">${swMembersOptions(value.assigneeId||state.user.id,false,value.assigneeName)}</select></label><label class="field">함께 검토할 사람<select name="reviewerId">${swMembersOptions(value.reviewerId||'',true,value.reviewerName)}</select></label></div><div class="field-row"><label class="field">진행 상태<select name="stage">${Object.entries(swStages).map(([key,label])=>cpOption(key,label,value.stage)).join('')}</select></label><label class="field">목표 날짜<input type="date" name="dueDate" value="${escape(value.dueDate||'')}"></label></div><label class="field">다음 할 일<textarea name="nextAction" rows="2" maxlength="1000" placeholder="예: 실제 전후 화면 촬영 후 편집본 올리기">${escape(value.nextAction||'')}</textarea></label><label class="field">막힌 점 · 필요한 도움<textarea name="blocker" rows="2" maxlength="1000" placeholder="예: 용어가 쉽게 이해되는지 함께 봐주세요. 없으면 비워 두세요.">${escape(value.blocker||'')}</textarea></label><label class="field">함께 볼 범위<select name="teamId">${cpOption('','작성자·지정 담당자·검토자·관리자',value.teamId||'')}${value.teamId&&!teams.some(team=>team.id===value.teamId)?`<option value="${escape(value.teamId)}" selected disabled>기존 공유 팀</option>`:''}${teams.map(team=>cpOption(team.id,team.name+' 팀 전체',value.teamId||'')).join('')}</select><small>지정한 사람과 팀은 작업의 파일·버전·검토 의견을 함께 봅니다. 연결된 개인 기획안은 기존 공개 범위를 유지합니다.</small></label><input type="hidden" name="draftId" value="${escape(value.draftId||'')}">${seed.draftId?'<p class="sw-note">현재 기획안의 제목과 연결을 가져왔어요. 제작과 판단은 담당자가 진행합니다.</p>':''}<p class="sw-note">‘완성’과 ‘게시 기록’은 담당자가 기록하는 작업 상태입니다.</p><div class="modal-actions">${button('취소','close-modal')}<button class="btn primary" type="submit">${id?'변경 저장':'작업 시작'}${icon('arrow')}</button></div></form>`,true);
}
async function swPlanMaterial(id){
  const material=sw.data?.materials.find(row=>row.id===id);if(!material||isViewer())return;
  const guard=swGuard();if(!cp.data||cp.userId!==state.user.id)await loadContentWorkspace();if(!swAlive(guard))return;
  cp.input=cpBlank();cp.input.topic=material.title.slice(0,300);
  const memo=material.body||'';
  if(material.kind==='experience')cp.input.experience=memo.slice(0,3000);
  else cp.input.proof=('소재 메모 · 사실 확인 전\n'+memo+(material.sourceUrl?'\n출처: '+material.sourceUrl:'')).slice(0,3000);
  if(material.kind==='experience'&&material.sourceUrl)cp.input.proof=material.sourceUrl;
  cp.draftId='';cp.activeDraft=null;cp.ideaId='';cp.view='plan';state.tab='content';render();window.scrollTo(0,0);notify('소재를 개인 기획에 가져왔어요. 내용을 보완한 뒤 구성안을 만들어 주세요.');
}
async function swUploadMedia(id,file,label,onProgress){
  if(!file||!file.size)throw new Error('내용이 있는 파일을 골라 주세요.');
  if(file.size>100*1024*1024)throw new Error('100 MB 이하의 검토용 파일을 올려 주세요.');
  const types={'mp4':'video/mp4','webm':'video/webm','png':'image/png','jpg':'image/jpeg','jpeg':'image/jpeg'},extension=file.name.split('.').pop().toLowerCase(),type=types[extension];
  if(!type)throw new Error('MP4·WebM 동영상 또는 PNG·JPEG 이미지를 선택해 주세요.');
  return new Promise((resolve,reject)=>{
    const xhr=new XMLHttpRequest();xhr.open('POST','/api/studio-productions/'+encodeURIComponent(id)+'/media');xhr.withCredentials=true;xhr.responseType='json';
    xhr.setRequestHeader('Content-Type',type);xhr.setRequestHeader('X-CSRF-Token',state.csrf);xhr.setRequestHeader('X-File-Name',encodeURIComponent(file.name));xhr.setRequestHeader('X-Version-Label',encodeURIComponent(label||file.name));
    xhr.timeout=10*60*1000;xhr.upload.onprogress=event=>{if(onProgress&&event.lengthComputable)onProgress(Math.round(event.loaded/event.total*100));};
    xhr.onerror=()=>reject(new Error('업로드 연결을 확인해 주세요.'));xhr.ontimeout=()=>reject(new Error('업로드 시간이 길어졌어요. 작은 검토용 파일로 다시 시도해 주세요.'));
    xhr.onload=()=>{if(xhr.status>=200&&xhr.status<300)resolve(xhr.response||{});else{const error=new Error(xhr.response?.error||'파일을 올리지 못했어요.');error.status=xhr.status;reject(error);}};xhr.send(file);
  });
}
document.addEventListener('click',async event=>{
  const target=event.target.closest('[data-action^="sw-"]');if(!target||target.disabled)return;const action=target.dataset.action.slice(3),id=target.dataset.id;
  if(!['view','reload','new-production','edit-production','open-production','plan-material','production-from-draft','open-linked-draft'].includes(action))return;
  const guard=swGuard();
  try{
    if(action==='view'){sw.detailRequest++;sw.view=target.dataset.view;render();window.scrollTo(0,0);}
    else if(action==='reload')await swReload();
    else if(action==='new-production'){const material=sw.data?.materials.find(row=>row.id===target.dataset.material);swProductionModal('',{title:material?.title||''});}
    else if(action==='edit-production')swProductionModal(id||sw.productionId);
    else if(action==='open-production'){target.disabled=true;await swOpenProduction(id);}
    else if(action==='plan-material')await swPlanMaterial(id);
    else if(action==='production-from-draft'){const draft=cpDraft();if(!draft)return;if(!sw.data||sw.userId!==state.user.id)await swReload({renderPage:false});if(state.user?.id!==guard.userId)return;swProductionModal('',{title:draft.title,draftId:draft.id});}
    else if(action==='open-linked-draft'){if(!cp.data||cp.userId!==state.user.id)await loadContentWorkspace();if(!swAlive(guard))return;await cpOpenDraft(id);if(!swAlive(guard))return;state.tab='content';cp.view='plan';render();window.scrollTo(0,0);}
  }catch(error){if(state.user?.id===guard.userId)notify(error.message);}finally{if(target.isConnected)target.disabled=false;}
});
document.addEventListener('submit',async event=>{
  const form=event.target.closest('[data-sw-form="production"]');if(!form)return;event.preventDefault();const submit=form.querySelector('[type="submit"]');if(submit.disabled)return;const errorBox=form.querySelector('.form-error'),guard=swGuard(),id=form.dataset.id;submit.disabled=true;errorBox.textContent='';
  try{const values=Object.fromEntries(new FormData(form));for(const key of ['dueDate','teamId','reviewerId','draftId']){if(Object.hasOwn(values,key))values[key]||=null;}if(id)delete values.draftId;const result=await api('/api/studio-productions'+(id?'/'+encodeURIComponent(id):''),values);if(!swAlive(guard))return;const sameForm=form.isConnected;if(sameForm)closeModal();const place={tab:state.tab,view:sw.view,detailRequest:sw.detailRequest,modalRequest:state.modalRequest};await swReload({renderPage:false});if(!swAlive(guard))return;const samePlace=place.tab===state.tab&&place.view===sw.view&&place.detailRequest===sw.detailRequest&&place.modalRequest===state.modalRequest&&!overlay.children.length;if(sameForm&&samePlace){sw.productionId=result.production.id;swAcceptProduction(result.production);state.tab='studio';sw.view='board';render();}notify(id?'작업 정보를 저장했어요.':'새 작업을 상황판에 등록했어요.');}
  catch(error){if(swAlive(guard)){if(errorBox.isConnected)errorBox.textContent=error.message;else notify(error.message);}}
  finally{if(submit.isConnected)submit.disabled=false;}
});
