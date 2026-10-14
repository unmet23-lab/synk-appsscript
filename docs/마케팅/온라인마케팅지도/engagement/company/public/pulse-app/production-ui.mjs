import {deliverableSubmission,addDeliverableRow,removeDeliverableRow} from './deliverables-view.mjs';
import {feedbackRoundSubmission} from './feedback-rounds-view.mjs';
import {previewSubmission} from './preview-view.mjs';
import {mountAnimatic} from './animatic-player.mjs';

// Only meaningful edits for the current preview block collecting or approving
// that preview. Empty new forms and values restored to their saved state do not.
export function feedbackDraftChanged(project,entry){
  const bound=entry?.boundData,latest=(project?.versions||[]).filter(version=>version.kind==='preview').at(-1);
  if(!bound||bound.versionId!==latest?.id)return false;
  const values=entry.values||{},itemId=bound.itemId??(bound.id==='new'||bound.id?.startsWith('new:')?'':bound.id||'');
  const draft=(project.studio?.feedbackRounds?.drafts||[]).find(value=>value.versionId===bound.versionId&&(!bound.draftId||value.id===bound.draftId));
  const item=itemId&&draft?.items.find(value=>value.id===itemId);
  if(itemId&&!item)return false;
  const body=String(Object.hasOwn(values,'text')?values.text:item?.text||'').trim();
  if(!itemId)return !!body;
  const normalizeTime=value=>value===null||value===undefined||value===''?null:Number(value);
  const time=normalizeTime(Object.hasOwn(values,'seconds')?values.seconds:item.seconds);
  return body!==String(item.text||'').trim()||!Object.is(time,normalizeTime(item.seconds));
}

export function addProductionDraftReset(form){
  if(!form||form.querySelector('[data-action="reset-production-draft"]'))return;
  const button=document.createElement('button');button.type='button';button.className='button quiet small-button';button.dataset.action='reset-production-draft';button.textContent='작성 내용 지우고 새 내용 보기';button.title='이 양식에 쓰던 내용만 지우고 저장된 최신 내용을 다시 보여 줘요.';form.append(button);
}

// Keeps all production additions on the existing project, revision and draft lifecycle.
export function productionUI(ctx){
  const {s,mutate,studioAction,notice,remember,request,options,staffPath,accept,current,projectStamp}=ctx;
  let stopPlayer=null;
  const save=(body,form,message)=>mutate(()=>studioAction(body.action,Object.fromEntries(Object.entries(body).filter(([key])=>key!=='action'))),{form,message});
  const changed=form=>{const input=form?.querySelector('input,textarea,select');if(input)input.dispatchEvent(new Event('input',{bubbles:true}));};
  async function submit(form){
    const type=form.dataset.form;
    if(!['deliverables','deliverable-link','round-draft','round-submit','round-classify','preview-upload'].includes(type)&&!type.startsWith('preview-'))return false;
    try{
      if(type==='preview-upload'){
        const file=new FormData(form).get('file');
        if(!file?.size)throw Error('함께 확인할 파일을 선택해 주세요.');
        if(file.size>100*1024*1024)throw Error('파일은 100MiB 이하여야 해요.');
        if(!['image/png','image/jpeg','video/mp4','video/webm','audio/mpeg','audio/wav','audio/x-wav'].includes(file.type))throw Error('PNG·JPEG·MP4·WebM·MP3·WAV 파일을 선택해 주세요.');
        await mutate(async()=>{const stamp=projectStamp(),result=await request(s.mode==='staff'?staffPath('/studio/media'):'/pulse/api/studio/media',{...options(),file,headers:{'Content-Type':file.type,'X-File-Name':encodeURIComponent(file.name),'X-Project-Revision':String(s.project.revision)}});if(!current(stamp))throw Error('프로젝트가 바뀌었어요.');accept(result);return result;},{form,message:'자료를 올렸어요. 비교 샘플이나 움직이는 콘티에서 선택해 주세요.'});
      }else{
        if(type==='round-submit'&&ctx.hasDraft?.('round-draft'))throw Error('작성 중인 수정 의견을 먼저 초안에 저장한 뒤 취합해 주세요.');
        const body=type.startsWith('round-')?feedbackRoundSubmission(form):type.startsWith('preview-')?previewSubmission(form):deliverableSubmission(form);
        await save(body,form,type==='round-submit'?'취합한 수정 의견을 한 번에 전달했어요.':type==='round-draft'?'수정 의견 초안에 담았어요. 취합 후 제출해 주세요.':'저장한 내용을 함께 확인할 수 있어요.');
      }
    }catch(error){notice(error.message);}
    return true;
  }
  async function click(button){
    const action=button.dataset.action;
    if(!action.startsWith('deliverable-')&&!action.startsWith('round-'))return false;
    try{
      if(action==='deliverable-add'){const form=button.closest('form');addDeliverableRow(form);changed(form);}
      else if(action==='deliverable-remove'){const form=button.closest('form');removeDeliverableRow(button);changed(form);}
      else if(action==='deliverable-request'||action==='deliverable-confirm'){
        if(ctx.hasDraft?.('deliverables'))throw Error('작성 중인 납품 규격을 먼저 저장한 뒤 확인해 주세요.');
        await save({action:action==='deliverable-request'?'request_deliverable_review':'confirm_deliverables',deliverableRevision:Number(button.dataset.revision)},null,action==='deliverable-confirm'?'이 버전의 납품 규격을 확인했어요.':'납품 규격의 확인을 요청했어요.');
      }else if(action==='round-remove-item')await save({action:'remove_feedback_draft_item',draftId:button.dataset.draftId,itemId:button.dataset.id},button.closest('form'),'수정 초안에서 항목을 뺐어요.');
      else if(action==='round-use-time'){
        const video=document.querySelector('#review-video'),form=button.closest('form')||document.querySelector('[data-form="round-draft"][data-item-id=""]'),field=form?.elements.seconds;
        if(video&&field){video.pause();field.value=String(Math.round(video.currentTime*10)/10);field.dispatchEvent(new Event('input',{bubbles:true}));form.elements.text?.focus();}
      }
    }catch(error){notice(error.message);}
    return true;
  }
  function render(){
    stopPlayer?.();stopPlayer=null;
    const el=document.querySelector('[data-animatic-player]'),animatic=s.project?.studio?.previews?.animatic;
    if(el&&animatic)stopPlayer=mountAnimatic(el,{...animatic,scenes:animatic.scenes||[],audioUrl:animatic.audio?.url||''});
  }
  function reset(){stopPlayer?.();stopPlayer=null;}
  return {submit,click,render,reset};
}
