'use strict';

// Prepare the existing composer only after the current source and user choice are checked.
const publicationLearningPlan={request:0,current:null};
function plpLocation(){return JSON.stringify([state.tab,typeof wr==='undefined'?null:wr.view,typeof makerTools==='undefined'?null:makerTools.view,typeof pf==='undefined'?null:pf.view,typeof pf==='undefined'?null:pf.epoch]);}
function plpComposer(){return JSON.stringify([cp.userId,cp.request,cp.detailRequest,cp.generationRequest,cp.busy,cp.generating,cp.input,cp.draftId,cp.activeDraft,cp.pendingDraftId,cp.ideaId,cp.results]);}
function plpHasPlan(userId){
  if(cp.userId&&cp.userId!==userId)return false;
  const blank=cpBlank();return Boolean(cp.draftId||cp.activeDraft||cp.pendingDraftId||cp.ideaId||cp.results)||Object.keys(blank).filter(key=>key!=='seriesId').some(key=>JSON.stringify(cp.input?.[key]??blank[key])!==JSON.stringify(blank[key]));
}
function plpCurrent(token){return publicationLearningPlan.current===token&&!token.cancelled&&state.user?.id===token.userId&&state.user?.role!=='viewer'&&(typeof companyAuthCurrent!=='function'||companyAuthCurrent(token.auth))&&plpLocation()===token.location&&plpComposer()===token.composer&&state.modalRequest===token.modalRequest;}
function cancelPublicationLearningPlan(){publicationLearningPlan.current?.cancel();}
function plpChoice(token){
  modal('작성 중인 기획이 있어요','현재 기획을 유지하거나, 선택한 실험으로 새 기획을 시작할 수 있어요.',`<p class="cp-review-note">바꾸면 이 창의 저장하지 않은 입력 내용이 사라집니다. 저장된 기획은 기획함에 남아요.</p><div class="modal-actions"><button type="button" class="btn quiet" data-plp-choice="keep">작성 중인 기획 유지</button><button type="button" class="btn primary" data-plp-choice="replace">선택한 실험으로 바꾸기</button></div>`);
  token.modalRequest=state.modalRequest;token.choiceOpen=true;
  return new Promise(resolve=>{
    for(const choice of ['keep','replace'])document.querySelector('[data-plp-choice="'+choice+'"]')?.addEventListener('click',()=>{
      if(!plpCurrent(token)){token.cancel();return;}
      token.choiceOpen=false;closeModal();token.modalRequest=state.modalRequest;resolve(choice==='replace');
    },{once:true});
  });
}
function plpInput(input,data,userId){
  if(!input||typeof input!=='object'||typeof input.topic!=='string'||!input.topic.trim()||typeof input.editorialNote!=='string'||!input.editorialNote.trim())throw new Error('기획에 넣을 제작 실험 기록을 확인하지 못했어요. 다시 열어 주세요.');
  const blank=cpBlank(),next={...blank},limits={topic:300,editorialNote:3000};
  for(const [key,max]of Object.entries(limits)){if(input[key]===undefined)continue;if(typeof input[key]!=='string'||input[key].length>max)throw new Error('기획에 넣을 내용이 작성 양식과 맞지 않아요. 다시 열어 주세요.');next[key]=input[key];}
  const series=data?.catalog?.series||[],current=(!cp.userId||cp.userId===userId)?cp.input?.seriesId:'';
  next.seriesId=series.some(row=>row.id===current)?current:series.some(row=>row.id===blank.seriesId)?blank.seriesId:series[0]?.id||blank.seriesId;
  return next;
}
async function openPublicationLearningPlan(entryId,experimentId){
  if(!state.user||state.user.role==='viewer')return false;
  if(!/^[0-9a-f]{64}$/i.test(String(entryId||''))||!/^[a-z0-9][a-z0-9_-]{0,99}$/i.test(String(experimentId||'')))throw new Error('선택한 성과와 실험을 다시 확인해 주세요.');
  if(cp.busy||cp.generating||cp.loading)throw new Error('진행 중인 기획 작업이 끝난 뒤 다시 선택해 주세요.');
  cancelPublicationLearningPlan();
  const token={id:++publicationLearningPlan.request,userId:state.user.id,auth:typeof companyAuthSnapshot==='function'?companyAuthSnapshot():null,location:plpLocation(),composer:plpComposer(),modalRequest:state.modalRequest,cancelled:false,choiceOpen:false,controller:new AbortController(),timer:null};
  const cancelled=new Promise(resolve=>{token.cancel=()=>{if(token.cancelled)return;token.cancelled=true;token.controller.abort();clearTimeout(token.timer);if(token.choiceOpen&&state.modalRequest===token.modalRequest){token.choiceOpen=false;closeModal();}resolve(null);};});
  publicationLearningPlan.current=token;
  const watch=()=>{if(!plpCurrent(token)){token.cancel();return;}token.timer=setTimeout(watch,160);};
  token.timer=setTimeout(watch,160);
  const wait=promise=>Promise.race([promise,cancelled]);
  try{
    if(plpHasPlan(token.userId)&&!await wait(plpChoice(token)))return false;
    if(!plpCurrent(token))return false;
    // This POST only reads the current authorized source; it never saves a plan.
    const result=await wait(api('/api/publication-learning/'+encodeURIComponent(entryId)+'/plan',{experimentId},undefined,{signal:token.controller.signal}));
    if(!plpCurrent(token))return false;
    // The legacy loader reopens draftId and can replace an unrelated draft while awaiting.
    // Keep this read local until the same guard can commit both catalog and input together.
    const data=cp.data&&cp.userId===token.userId?cp.data:await wait(api('/api/content-workspace',undefined,undefined,{signal:token.controller.signal}));
    if(!plpCurrent(token))return false;
    if(!data||!Array.isArray(data.catalog?.series))throw new Error('기획 양식을 불러오지 못했어요. 다시 선택해 주세요.');
    const input=plpInput(result?.input,data,token.userId);
    clearTimeout(token.timer);publicationLearningPlan.current=null;
    token.committed=true;cpInvalidateGeneration();cp.request++;cp.detailRequest++;cp.userId=token.userId;cp.data=data;cp.input=input;cp.draftId='';cp.activeDraft=null;cp.pendingDraftId='';cp.ideaId='';cp.results=null;cp.error='';cp.loading=false;
    await cpNavigate('plan');
    if(state.user?.id===token.userId&&(typeof companyAuthCurrent!=='function'||companyAuthCurrent(token.auth))&&state.tab==='content'&&cp.view==='plan'&&cp.input===input){
      window.scrollTo(0,0);document.querySelector('[data-cp-input][name="topic"]')?.focus({preventScroll:true});
      return true;
    }
    return false;
  }catch(error){if(!token.committed&&!plpCurrent(token))return false;throw error;}
  finally{clearTimeout(token.timer);if(publicationLearningPlan.current===token)publicationLearningPlan.current=null;}
}
document.addEventListener('click',event=>{
  if(!publicationLearningPlan.current||event.target.closest?.('[data-plp-choice]'))return;
  if(event.target.closest?.('[data-action],[data-maker-tool],[data-wr-action],[data-pf-action],a[href]'))cancelPublicationLearningPlan();
},true);
for(const type of ['input','change'])document.addEventListener(type,event=>{if(event.target.matches?.('[data-cp-input]'))cancelPublicationLearningPlan();},true);
for(const type of ['popstate','hashchange'])window.addEventListener(type,cancelPublicationLearningPlan);
