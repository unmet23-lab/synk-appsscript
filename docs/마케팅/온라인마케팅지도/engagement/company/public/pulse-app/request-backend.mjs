import {request as send,PulseError,serverError} from './api.mjs';
import {t,k} from './i18n.mjs';
import {emptyAnswers,answersFromServer,answersForServer,DRAFT_FILES_GONE} from './request-data.mjs';

// 의뢰서 화면과 서버 사이. 파일 목록은 서버가 쥐고, 화면은 그 목록을 칸마다 묶어 보여 줄 뿐이다.
const isImage=file=>String(file.mimeType||'').startsWith('image/');
const draftPreview=file=>file.inline&&isImage(file)?`/pulse/api/request/media/${encodeURIComponent(file.id)}`:'';
const assetPreview=file=>file.inline&&isImage(file)?`/pulse/api/studio/media/${encodeURIComponent(file.id)}`:'';
function uploadWithProgress(path,file,{csrf,slot,onProgress}){
  return new Promise((resolve,reject)=>{
    const xhr=new XMLHttpRequest();xhr.open('POST',path);xhr.withCredentials=true;xhr.responseType='json';
    xhr.setRequestHeader('Content-Type',file.type||'application/octet-stream');xhr.setRequestHeader('X-File-Name',encodeURIComponent(file.name));xhr.setRequestHeader('X-Pulse-CSRF',csrf);xhr.setRequestHeader('X-Request-Slot',slot);
    xhr.upload.onprogress=event=>{if(event.lengthComputable)onProgress?.(event.loaded/event.total);};
    xhr.onerror=()=>reject(new PulseError(t('올리지 못했어요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.')));
    // 서버 문장이 없을 때의 한국어 문장 — serverError가 화면 언어로 옮긴다(api.mjs errorText).
    xhr.onload=()=>{const body=xhr.response||{};if(xhr.status>=200&&xhr.status<300)resolve(body);else reject(serverError(body,xhr.status,k('올리지 못했어요. 다시 시도해 주세요.')));};
    xhr.send(file);
  });
}
// 맞춤 인물 스위치(판 3): 서버 응답의 features만 믿는다. 실제 인물은 인물 접수가 켜져 있을 때만이다.
// models(판 4): 내 모델 다시 쓰기 스위치(myModels) — 꺼져 있으면 공개 초안의 「내 모델」 고름을 비운다.
const personaFlagsOf=features=>({request:features?.personaRequest===true,real:features?.personaRequest===true&&features?.personaReal===true,models:features?.myModels===true});
// 쓰던 의뢰서: 초안에 무엇이라도 적혀 있을 때다(빈 초안은 쓰던 것이 아니다). 첫 화면의 「이어 쓰기」 단추(app.mjs checkResume)와
// 접수를 쉬는 동안 의뢰서를 열지 정하는 자리(hasDraft)가 같은 식을 쓴다 — 첫 화면은 쉰다고 하는데 바로 의뢰 주소로는 열리는 일이 없게.
export const resumableDraft=draft=>!!(draft?.status==='draft'&&(draft.step||draft.answers?.name||draft.files?.length));
// 공개 의뢰서: 처음 저장할 때 초안을 만들어 그냥 둘러보기만 한 사람은 서버에 아무것도 남기지 않는다.
// personaPick(판 4): 「내 모델」에서 「이 모델로 의뢰」로 열 때 그 인물의 이름 · 그림(화면에만 쓴다 — 붙임은 서버가 이미 초안에 적었다).
export async function publicBackend({personaPick=null}={}){
  // features: 서버가 허락한 공개 메뉴 언어 · 전용 인물 스위치(판 1). 화면은 이 값만 믿는다.
  let {draft,features=null}=await send('/pulse/api/request'),starting=null;
  // 저장과 파일 올리기가 동시에 시작해도 초안은 하나만 만든다.
  const ensure=()=>draft?Promise.resolve(draft):starting||=send('/pulse/api/request/start',{body:{}}).then(result=>{draft=result.draft;return draft;}).finally(()=>{starting=null;});
  const answers=draft?answersFromServer(draft.answers,draft.files,draftPreview):emptyAnswers();
  // 초안이 기한으로 사라지면(401) 쓰던 글은 새 초안에 담아 잇는다. 올린 파일은 초안과 함께 지워졌으니 화면도 그 파일을 뺀다(onExpired는 뺀 개수를 돌려준다).
  // 함께 돌던 요청이 이미 새 초안으로 옮겼으면 그 초안을 다시 버리지 않는다.
  const expired=used=>{if(draft?.id!==used?.id)return 0;draft=null;return backend.onExpired?.()||0;};
  const again=async write=>{const used=draft;try{return await write();}catch(error){if(error.status!==401)throw error;expired(used);return write();}};
  const backend={
    answers,step:draft?.step||'',alreadySent:draft?.status==='submitted',onExpired:null,features,
    // 접수를 쉬는 동안에도 쓰던 초안은 이어 쓰고 보낼 수 있다(운영 조각 3) — 앱이 이 값으로 의뢰서를 열지 정한다.
    // 보낸 직후 응답을 못 받은 초안(10분 재전송) · 보내는 중인 초안은 그대로 잇고, 아무것도 적지 않은 빈 초안은 쓰던 것으로 치지 않는다.
    hasDraft:!!draft&&(draft.status!=='draft'||resumableDraft(draft)),
    // 인물 사진은 초안 길로만 받는다(접수 뒤에는 고객 방의 인물 카드에서).
    personaPhotos:true,personaFlags:()=>personaFlagsOf(features),personaPick,
    save(values,step){return again(async()=>{const current=await ensure(),result=await send('/pulse/api/request/save',{csrf:current.csrf,body:{answers:answersForServer(values),step}});draft={...result.draft,csrf:current.csrf};});},
    upload(slot,file,onProgress){return again(async()=>{const current=await ensure(),result=await uploadWithProgress('/pulse/api/request/media',file,{csrf:current.csrf,slot,onProgress});return {...result.file,preview:draftPreview(result.file)};});},
    // 지우려던 파일이 초안과 함께 이미 사라졌으면 더 할 일이 없다.
    async remove(id){const current=await ensure();try{await send(`/pulse/api/request/media/${encodeURIComponent(id)}`,{method:'DELETE',csrf:current.csrf});}catch(error){if(error.status!==401)throw error;expired(current);}},
    // 자료가 사라진 채 조용히 접수하지 않는다. 글을 새 초안에 담아 두고, 손님이 알고 나서 다시 보내게 한다. 사라진 자료가 없으면 그대로 잇는다.
    async submit(values){
      const write=async()=>{const current=await ensure();return send('/pulse/api/request/submit',{csrf:current.csrf,body:{answers:answersForServer(values)}});};
      const used=await ensure();
      try{return await write();}
      catch(error){
        if(error.status!==401)throw error;
        if(!expired(used))return write();
        await backend.save(values,'review');
        throw new PulseError(t(DRAFT_FILES_GONE),401);
      }
    },
  };
  return backend;
}
// 이미 프로젝트가 있는 손님(담당자가 만든 프로젝트 · 보낸 의뢰서 고치기): 답은 프로젝트에, 파일은 접수 뒤 파일 길로 간다.
// 판 번호는 앱이 쥔 최신 값을 쓴다. 그사이 담당자가 고쳐 판이 어긋나면 새로 읽어 한 번 더 시도한다.
// features(판 3): 앱이 쥔 그 프로젝트 응답의 features(맞춤 인물 스위치). 이 길에서는 인물 사진 칸을 두지 않는다 — 프로젝트 자료 길(request-file)은 인물 칸을 받지 않는다.
export function projectBackend({project,csrf,accept,step='',features=()=>null}){
  const current=project(),request=current.studio?.request;
  const answers=answersFromServer(request?.answers,request?.files,assetPreview);
  answers.consent=answers.rights=!!request?.consentAt;
  const act=async(action,body)=>{
    const call=()=>send('/pulse/api/studio',{csrf:csrf(),body:{revision:project().revision,action,...body}});
    try{const result=await call();accept(result);return result;}
    catch(error){if(error.status!==409)throw error;accept(await send('/pulse/api/project'));const result=await call();accept(result);return result;}
  };
  return {
    answers,step,personaPhotos:false,personaFlags:()=>personaFlagsOf(features()),
    async save(values){await act('request_save',{answers:answersForServer(values)});},
    async upload(slot,file,onProgress){const result=await uploadWithProgress('/pulse/api/studio/request-file',file,{csrf:csrf(),slot,onProgress});accept(result);return {...result.file,preview:assetPreview(result.file)};},
    async remove(id){accept(await send(`/pulse/api/studio/request-file/${encodeURIComponent(id)}`,{method:'DELETE',csrf:csrf()}));},
    async submit(values){const result=await act('request_submit',{answers:answersForServer(values)});return {number:result.project.studio.request?.number||'',at:result.project.updatedAt,link:''};},
  };
}
