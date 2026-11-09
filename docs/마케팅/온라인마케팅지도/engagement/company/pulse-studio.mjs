import {randomUUID} from 'node:crypto';
import {emptyStrategy,strategyOf,strategyView,applyStrategyAction,sceneStrategy} from './pulse-strategy.mjs';
import {buildClientKickoff} from './client-kickoff.mjs';
import {buildClientChanges} from './client-changes.mjs';
import {buildSceneRequests,recordSceneReview} from './client-scene-requests.mjs';
import {buildClientSchedule} from './client-schedule.mjs';
import {deliverableActions,applyDeliverableAction,deliverableView} from './pulse-deliverables.mjs';
import {feedbackRoundActions,applyFeedbackRoundAction,feedbackRoundsView} from './pulse-feedback-rounds.mjs';
import {previewActions,applyPreviewAction,previewsView,visiblePreviewAssetIds} from './pulse-previews.mjs';
import {buildCustomerPreviewApproval} from './client-preview-approval.mjs';
import {requestActions,applyRequestAction,requestView,usesRequestFlow} from './pulse-requests.mjs';
import {createPersonaGuard} from './pulse-personas.mjs';
import {withTranslation,staffSources,translationStaffView,localizeCustomerProject,inlineObject} from './pulse-translations.mjs';
import {serverText,staffDisplayName,createStaffNames} from './pulse-locale.mjs';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const PREFS=['brand','goal','audience','mood','mustHave','avoid','notes'];
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
function keys(value,allowed){if(!object(value)||Object.keys(value).some(key=>!allowed.includes(key)))throw fail('제작 기획 입력 항목을 확인해 주세요.');}
function text(value,max=3000,required=false){if(value===undefined&&!required)return '';if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw fail('입력 내용과 길이를 확인해 주세요.');const clean=value.trim();if(required&&!clean)throw fail('필수 내용을 입력해 주세요.');return clean;}
function url(value){const raw=text(value,2000);if(!raw)return '';let parsed;try{parsed=new URL(raw);}catch{throw fail('https://로 시작하는 주소를 넣어 주세요.');}if(parsed.protocol!=='https:'||parsed.username||parsed.password)throw fail('https://로 시작하는 주소를 넣어 주세요.');return parsed.href;}
function id(value){if(typeof value!=='string'||!UUID.test(value))throw fail('기획 항목을 확인해 주세요.');return value;}
function capacity(list,max){if(list.length>=max)throw fail('이 프로젝트의 기록이 가득 찼어요. 새 프로젝트로 이어 가 주세요.',409);}
function empty(){return {schemaVersion:1,preferences:Object.fromEntries(PREFS.map(key=>[key,''])),strategy:emptyStrategy(),assets:[],references:[],concepts:[],scenes:[],selectedConcept:null,conceptSelections:[],sceneReviews:[],comments:[],history:[]};}
export {empty as emptyPulseStudio};
function studioOf(row){if(!row.studio)return empty();if(row.studio.schemaVersion!==1)throw fail('프로젝트 기획 버전을 확인해 주세요.',409);const studio=structuredClone(row.studio);studio.strategy=strategyOf(studio.strategy);return studio;}

// All creative state belongs to the authoritative clientProjects document.
// Existing project revisions, invite revocation, ACL and backup transactions
// therefore remain authoritative; this module creates no second customer login.
// localeOf(row): 프로젝트의 소통 언어(pulse-locale.mjs createProjectLocale). 손님 보기에 언어를 입히고, 영어 프로젝트의 직원 글은 번역을 함께 받는다.
export function createPulseStudioService({store,clientProjects,clock=()=>new Date().toISOString(),mailState=null,localeOf=()=>'ko'}){
  // 의뢰서 액션이 전용 인물로 가는 프로젝트의 인물 판을 다시 볼 때 쓴다(방향 제안 · 제작 시작, pulse-requests.mjs).
  const personas=createPersonaGuard(store);
  function customer(token){return clientProjects.session(token);}
  function customerWrite(token,csrf){const context=customer(token);if(typeof csrf!=='string'||context.auth.body.csrf!==csrf)throw fail('고객 화면을 다시 열어 주세요.',403);return context;}
  function revision(row,value){if(!Number.isSafeInteger(value)||value!==row.revision)throw fail('그사이 프로젝트가 바뀌었어요. 최신 내용을 불러온 뒤 다시 저장해 주세요.',409);}
  function actor(row,user){return user?{author:'staff',authorId:user.id,authorName:store.get('users',user.id)?.name||'담당자'}:{author:'customer',authorId:'customer',authorName:row.customerName};}
  function visibleAssetIds(studio){
    const ids=new Set(studio.assets.filter(asset=>asset.author==='customer').map(asset=>asset.id));
    for(const value of [...studio.references,...studio.concepts.filter(card=>card.visibility==='customer'),...studio.scenes.filter(card=>card.visibility==='customer'),...studio.history.filter(card=>card.visibility==='customer')])if(value.assetId)ids.add(value.assetId);
    for(const value of visiblePreviewAssetIds(studio))ids.add(value);
    // 보낸 방향 제안(지금 회차)의 그림 · 움직임 견본. 갈아 끼운 옛 안의 자산은 다시 숨는다.
    for(const option of studio.request?.directionProposal?.options||[]){ids.add(option.assetId);if(option.filmAssetId)ids.add(option.filmAssetId);}
    return ids;
  }
  function media(row,asset,staff){return {id:asset.id,fileName:asset.fileName,mimeType:asset.mimeType,byteSize:asset.byteSize,url:staff?`/api/client-projects/${row.id}/studio/media/${asset.id}`:`/pulse/api/studio/media/${asset.id}`};}
  function view(row,staff=false){
    const studio=studioOf(row),visible=visibleAssetIds(studio);
    const assetMap=new Map(studio.assets.filter(asset=>staff||visible.has(asset.id)).map(asset=>[asset.id,media(row,asset,staff)]));
    const card=value=>{const {authorId,...safe}=value;return {...safe,...(value.assetId&&assetMap.has(value.assetId)?{media:assetMap.get(value.assetId)}:{})};};
    const concepts=studio.concepts.filter(value=>staff||value.visibility==='customer'),scenes=studio.scenes.filter(value=>staff||value.visibility==='customer');
    const publicTarget=(type,target)=>type==='project'||(type==='concept'?concepts:scenes).some(value=>value.id===target);
    const selection=value=>value?{...card(value),current:concepts.some(item=>item.id===value.conceptId&&item.revision===value.conceptRevision&&item.visibility==='customer')}:null;
    return {schemaVersion:1,request:requestView(studio,{staff}),preferences:studio.preferences,strategy:strategyView(studio.strategy),deliverables:deliverableView(studio,row,staff),feedbackRounds:feedbackRoundsView(studio,row,staff),previews:previewsView(studio,row,staff),assets:[...assetMap.values()],references:studio.references.map(card),concepts:concepts.map(card),scenes:scenes.map(card),selectedConcept:selection(studio.selectedConcept),conceptSelections:studio.conceptSelections.map(selection),sceneReviews:studio.sceneReviews.filter(value=>staff||scenes.some(scene=>scene.id===value.sceneId)).map(value=>({...card(value),current:scenes.some(item=>item.id===value.sceneId&&item.revision===value.sceneRevision&&item.visibility==='customer')})),comments:studio.comments.filter(value=>staff||value.visibility==='customer'&&publicTarget(value.targetType,value.targetId)).map(card),cardRevisions:studio.history.filter(value=>staff||value.visibility==='customer').map(card)};
  }
  // 메일 알림(판 2): 손님 보기에는 켜졌는지와 가린 주소만, 직원 보기에는 연결 · 순간별 상태.
  const customerMail=row=>{try{return mailState?.customer?.(row)||null;}catch{return null;}};
  const staffMail=row=>{try{return mailState?.staff?.(row)||null;}catch{return null;}};
  // 손님 보기의 언어(판 2): 단계 이름 · 직원 글 번역 · 담당자 영문 표시 이름을 보기 때 입힌다(저장값은 그대로).
  // 담당자 이름(머리)은 지금 담당자의 표시 이름, 직원 글의 작성자는 글마다 그 직원의 표시 이름(createStaffNames — GPT GA1).
  function localized(row,project){const locale=localeOf(row);if(locale==='ko')return project;const owner=store.get('users',row.ownerId);return localizeCustomerProject(project,{map:row.studio?.translations,locale,text:value=>serverText(locale,value),producer:staffDisplayName(locale,owner,project.ownerName),staffName:createStaffNames(locale,{owner,users:store.all?.('users')||[]})});}
  function customerState(token){const {row}=customer(token),result=clientProjects.read(token),mail=customerMail(row);return {...result,project:localized(row,{...result.project,studio:view(row),requestFlow:usesRequestFlow(row,studioOf(row)),...(mail?{mail}:{})})};}
  function staffState(user,projectId){
    const row=clientProjects.project(user,projectId),{inviteHash,inviteRevision,notificationEvents,studio,...safe}=row;
    let canEdit=true;try{clientProjects.project(user,projectId,true);}catch{canEdit=false;}
    // Staff media must use staff routes. A staff session cannot impersonate
    // a customer's capability merely to render an image or video.
    const versions=row.versions.map(version=>({...version,...(version.media?{media:{...media(row,version.media,true),url:'/api/client-media/'+version.media.id}}:{})}));
    const mail=staffMail(row),translation=translationStaffView(studioOf(row),row,localeOf(row));
    return {project:{...safe,requestFlow:usesRequestFlow(row,studioOf(row)),...(mail?{mail}:{}),...(translation?{translation}:{}),versions,kickoff:buildClientKickoff(row,{now:clock(),canEdit}),changes:buildClientChanges(row,{now:clock(),canEdit}),sceneRequests:buildSceneRequests(row,clientProjects.sceneRequestContext(row,user)),schedule:buildClientSchedule(row,{now:clock(),canEdit,reviewerId:clientProjects.sceneRequestContext(row,user).reviewerId}),ownerName:store.get('users',row.ownerId)?.name||'담당자',reviewerName:store.get('users',row.reviewerId)?.name||'',inviteActive:!!inviteHash&&Date.parse(row.inviteExpiresAt)>Date.parse(clock()),studio:view(row,true)},canEdit};
  }
  function asset(studio,assetId,{image=false}={}){if(!assetId)return null;const found=studio.assets.find(value=>value.id===id(assetId));if(!found||image&&!found.mimeType.startsWith('image/'))throw fail(image?'프로젝트의 이미지 자료를 선택해 주세요.':'이 프로젝트의 자료를 선택해 주세요.',404);return found;}
  function pointer(studio,input,{image=false}={}){const found=asset(studio,input.assetId,{image});return {assetId:found?.id||null,imageUrl:image?url(input.imageUrl):undefined};}
  function published(studio,type,targetId,targetRevision){const found=studio[type].find(value=>value.id===id(targetId));if(!found||found.visibility!=='customer')throw fail('이 카드를 찾지 못했어요. 최신 내용을 불러와 주세요.',404);if(found.revision!==targetRevision)throw fail('카드 내용이 바뀌었어요. 최신 내용을 불러와 주세요.',409);return found;}
  function commit(row,studio,event,who){
    if(Buffer.byteLength(JSON.stringify(studio),'utf8')>1500000)throw fail('이 프로젝트의 기록이 가득 찼어요. 새 프로젝트로 이어 가 주세요.',409);
    const at=clock();clientProjects.commitWorkflow({...row,studio,revision:row.revision+1,updatedAt:at,history:[...row.history,{id:randomUUID(),action:event,actor:who.authorId,at}].slice(-300)});
  }
  function mutate(row,input,user=null){
    const base=['action','revision'],studio=studioOf(row),who=actor(row,user),at=clock(),stamp={...who,at};revision(row,input?.revision);
    const fields={save_translation:['key','text','status'],save_strategy:['strategy'],request_strategy_review:[],confirm_strategy:['strategyRevision'],save_preferences:['preferences'],save_reference:['id','label','url','assetId','preference','reason'],remove_reference:['id'],select_concept:['conceptId','conceptRevision','text'],review_scene:['sceneId','sceneRevision','status','text'],comment:['targetType','targetId','targetRevision','text'],save_concept:['id','title','description','tagline','imageUrl','assetId','visibility'],save_scene:['id','title','description','narration','screenText','duration','imageUrl','assetId','visibility','purpose','valueNumbers','translation'],reorder_scenes:['ids']};
    const extensions=[{fields:deliverableActions,apply:applyDeliverableAction},{fields:feedbackRoundActions,apply:applyFeedbackRoundAction},{fields:previewActions,apply:applyPreviewAction},{fields:requestActions,apply:applyRequestAction}];
    const extension=object(input)?extensions.find(value=>value.fields(input.action)):null;
    if(!object(input)||!Object.hasOwn(fields,input.action)&&!extension)throw fail('기획 요청을 확인해 주세요.');keys(input,[...base,...(extension?extension.fields(input.action):fields[input.action])]);
    const action=input.action;
    if(extension){extension.apply({studio,row,input,staff:!!user,stamp,personas,locale:localeOf(row)});commit(row,studio,'PULSE 제작 '+action,who);return;}
    // 담당자 글 번역 하나 넣기 · 고치기(다국어 판 2). 키는 지금 손님에게 보이는 직원 글 칸이어야 하고, 빈 글자면 그 번역을 지운다.
    if(action==='save_translation'){
      if(!user)throw fail('담당자 화면에서만 할 수 있어요.',403);
      const locale=localeOf(row),source=typeof input.key==='string'?staffSources(studio,row).get(input.key):null;
      if(locale==='ko')throw fail('한국어 프로젝트는 번역을 따로 두지 않아요.',409);
      if(!source)throw fail('번역할 글을 찾지 못했어요. 최신 내용을 불러와 주세요.',404);
      studio.translations=withTranslation(studio.translations,{key:input.key,source:source.text,max:source.max,text:input.text,status:input.status===undefined?'reviewed':input.status,locale,by:who.authorId,at});
      commit(row,studio,'PULSE 번역 저장',who);return;
    }
    if(['save_concept','save_scene','reorder_scenes'].includes(action)&&!user)throw fail('기획안은 담당자만 고칠 수 있어요.',403);
    if(['select_concept','review_scene'].includes(action)&&user)throw fail('고객의 선택과 확인은 고객 화면에서만 남길 수 있어요.',403);
    if(['save_strategy','request_strategy_review','confirm_strategy'].includes(action)){
      const next=applyStrategyAction(studio.strategy,input,stamp);
      // 바뀐 칸이 없는 저장은 기록·버전·알림을 만들지 않는다.
      if(action==='save_strategy'&&next===studio.strategy)return;
      studio.strategy=next;
    }else if(action==='save_preferences'){
      keys(input.preferences,PREFS);studio.preferences=Object.fromEntries(PREFS.map(key=>[key,text(input.preferences[key],key==='notes'?3000:1500)]));
    }else if(action==='save_reference'){
      const found=input.id?studio.references.find(value=>value.id===id(input.id)):null;if(input.id&&!found)throw fail('참고자료를 찾지 못했어요.',404);
      if(!['like','avoid','neutral'].includes(input.preference))throw fail('이 자료가 좋은지, 피하고 싶은지 골라 주세요.');
      const referenceAsset=asset(studio,input.assetId),referenceUrl=url(input.url);if(!referenceAsset&&!referenceUrl)throw fail('이미지를 올리거나 https://로 시작하는 주소를 넣어 주세요.');
      if(!user&&referenceAsset&&!visibleAssetIds(studio).has(referenceAsset.id))throw fail('공개된 프로젝트 자료를 선택해 주세요.',404);
      if(found&&!user&&found.author!=='customer'&&(found.label!==text(input.label,160,true)||found.url!==referenceUrl||found.assetId!==(referenceAsset?.id||null)))throw fail('제작팀이 올린 자료는 바꿀 수 없어요. 어떤 쪽인지와 이유만 남겨 주세요.',403);
      if(!found)capacity(studio.references,60);
      const value={id:found?.id||randomUUID(),label:text(input.label,160,true),url:referenceUrl,assetId:referenceAsset?.id||null,preference:input.preference,reason:text(input.reason),...stamp,...(found?{author:found.author,authorId:found.authorId,authorName:found.authorName}:{}),updatedAt:at};
      if(found)studio.references[studio.references.indexOf(found)]=value;else studio.references.push(value);
    }else if(action==='remove_reference'){
      const found=studio.references.find(value=>value.id===id(input.id));if(!found)throw fail('참고자료를 찾지 못했어요.',404);if(!user&&found.author!=='customer')throw fail('제작팀이 올린 자료를 지우거나 바꾸려면 담당자에게 말해 주세요.',403);studio.references=studio.references.filter(value=>value.id!==found.id);
    }else if(action==='save_concept'||action==='save_scene'){
      const isConcept=action==='save_concept',list=isConcept?studio.concepts:studio.scenes,found=input.id?list.find(value=>value.id===id(input.id)):null;
      if(input.id&&!found)throw fail('이 카드를 찾지 못했어요.',404);if(!['internal','customer'].includes(input.visibility))throw fail('기획 공개 범위를 선택해 주세요.');
      if(found){capacity(studio.history,200);studio.history.push({...found,type:isConcept?'concept':'scene'});}else capacity(list,isConcept?12:60);
      const value={id:found?.id||randomUUID(),title:text(input.title,160,true),description:text(input.description),...pointer(studio,input,{image:true}),visibility:input.visibility,revision:(found?.revision||0)+1,...stamp};
      if(isConcept)value.tagline=text(input.tagline,500);
      else{if(typeof input.duration!=='number'||!Number.isFinite(input.duration)||input.duration<0.1||input.duration>600)throw fail('장면 길이는 0.1초에서 600초 사이로 입력해 주세요.');Object.assign(value,{narration:text(input.narration,1500),screenText:text(input.screenText,1500),duration:input.duration},sceneStrategy(input,found,studio.strategy));}
      if(found)list[list.indexOf(found)]=value;else list.push(value);
      // 장면 제목 · 설명의 손님 언어 번역을 함께 받을 수 있다(영어 프로젝트에서 글 콘티를 보내려면 손님에게 보이는 장면마다 있어야 한다 — pulse-requests send_draft).
      if(!isConcept&&input.translation!==undefined){const said=inlineObject(input.translation,['title','description']),locale=localeOf(row);if(locale!=='ko'){let map=studio.translations;for(const [field,max]of [['title',160],['description',3000]])if(said[field]!==undefined)map=withTranslation(map,{key:`scene:${value.id}:${field}`,source:value[field],max,text:said[field],status:'reviewed',locale,by:who.authorId,at});studio.translations=map;}}
    }else if(action==='reorder_scenes'){
      if(!Array.isArray(input.ids)||input.ids.length!==studio.scenes.length||new Set(input.ids).size!==input.ids.length||input.ids.some(value=>!studio.scenes.some(scene=>scene.id===value)))throw fail('모든 장면을 한 번씩 포함해 주세요.');
      studio.scenes=input.ids.map(value=>studio.scenes.find(scene=>scene.id===value));
    }else if(action==='select_concept'){
      const concept=published(studio,'concepts',input.conceptId,input.conceptRevision);if(!concept.assetId&&!concept.imageUrl)throw fail('그림이 준비된 콘셉트만 고를 수 있어요.',409);capacity(studio.conceptSelections,120);
      studio.selectedConcept={id:randomUUID(),conceptId:concept.id,conceptRevision:concept.revision,title:concept.title,text:text(input.text),...stamp};studio.conceptSelections.push(studio.selectedConcept);
    }else if(action==='review_scene'){
      const scene=published(studio,'scenes',input.sceneId,input.sceneRevision);if(!['confirmed','changes','comment'].includes(input.status))throw fail('장면 의견 종류를 골라 주세요.');
      const review={id:randomUUID(),sceneId:scene.id,sceneRevision:scene.revision,title:scene.title,status:input.status,text:text(input.text,3000,input.status!=='confirmed'),...stamp},context={...clientProjects.sceneRequestContext(row),at};
      // 이 장면 판의 마지막 기록이 이미 확인이고 이 확인을 기다리는 수정 요청도 없으면, 같은 확인은 기록·버전·알림을 만들지 않는다(11-02 — 누를 때마다 같은 확인이 쌓였다).
      // 담당자 제출 전에 미리 확인해 둔 판이라도, 제출 뒤의 확인은 수정 요청을 끝내는 새 확인이다(client-scene-requests).
      if(input.status==='confirmed'&&studio.sceneReviews.filter(value=>value.sceneId===scene.id&&value.sceneRevision===scene.revision).at(-1)?.status==='confirmed'&&recordSceneReview({...row,studio},review,context)===row.sceneRequestWorkflows)return;
      capacity(studio.sceneReviews,240);studio.sceneReviews.push(review);
      const sceneRequestWorkflows=recordSceneReview({...row,studio},review,context);if(sceneRequestWorkflows)row={...row,sceneRequestWorkflows};
    }else if(action==='comment'){
      if(!['project','concept','scene'].includes(input.targetType))throw fail('의견을 남길 곳을 찾지 못했어요.');
      let target=null;if(input.targetType!=='project'){
        const list=input.targetType==='concept'?'concepts':'scenes';target=studio[list].find(value=>value.id===id(input.targetId));
        if(!target||!user&&target.visibility!=='customer')throw fail('이 카드를 찾지 못했어요.',404);if(target.revision!==input.targetRevision)throw fail('카드 내용이 바뀌었어요. 최신 내용을 불러와 주세요.',409);
      }else if(input.targetId!=null||input.targetRevision!=null)throw fail('프로젝트 의견에는 별도 장면을 지정하지 마세요.');
      capacity(studio.comments,200);studio.comments.push({id:randomUUID(),targetType:input.targetType,targetId:target?.id||null,targetRevision:target?.revision||null,visibility:target?.visibility==='internal'?'internal':'customer',text:text(input.text,3000,true),...stamp});
    }
    commit(row,studio,'PULSE 기획 '+action,who);
  }
  function customerMutate(token,csrf,input){return store.transaction(()=>{const {row}=customerWrite(token,csrf);mutate(row,input);return customerState(token);});}
  function staffMutate(user,projectId,input){return store.transaction(()=>{const row=clientProjects.project(user,projectId,true);mutate(row,input,user);return staffState(user,projectId);});}
  function assertCustomerUpload(token,csrf,value){const {row}=customerWrite(token,csrf);revision(row,value);capacity(studioOf(row).assets,120);return row;}
  function assertStaffUpload(user,projectId,value){const row=clientProjects.project(user,projectId,true);revision(row,value);capacity(studioOf(row).assets,120);return row;}
  function addAsset(row,metadata,user){const studio=studioOf(row);capacity(studio.assets,120);const who=actor(row,user);studio.assets.push({...metadata,...who,at:clock()});commit(row,studio,'PULSE 기획 자료 등록',who);}
  function customerUpload(token,csrf,value,metadata){return store.transaction(()=>{const row=assertCustomerUpload(token,csrf,value);addAsset(row,metadata);const result=customerState(token);return {...result,asset:result.project.studio.assets.find(asset=>asset.id===metadata.id)};});}
  function staffUpload(user,projectId,value,metadata){return store.transaction(()=>{const row=assertStaffUpload(user,projectId,value);addAsset(row,metadata,user);const result=staffState(user,projectId);return {...result,asset:result.project.studio.assets.find(asset=>asset.id===metadata.id)};});}
  function customerMedia(token,assetId){const {row}=customer(token),studio=studioOf(row),found=studio.assets.find(value=>value.id===id(assetId));if(!found||!visibleAssetIds(studio).has(found.id))throw fail('자료를 찾지 못했어요.',404);return found;}
  function staffMedia(user,projectId,assetId){const row=clientProjects.project(user,projectId),found=studioOf(row).assets.find(value=>value.id===id(assetId));if(!found)throw fail('자료를 찾지 못했어요.',404);return found;}
  // 접수 뒤 손님이 보낸 파일을 프로젝트에 붙인다. 화면에 띄울 수 있는 형식은 자료함으로, 나머지는 내려받기 전용(intake)으로 간다.
  function addRequestFile(token,csrf,file){return store.transaction(()=>{
    const {row}=customerWrite(token,csrf),studio=studioOf(row),who=actor(row),request=studio.request||{schemaVersion:1,number:'',status:'writing',answers:{},files:[],asks:[],notes:[],rounds:[]};
    const shown={id:file.id,slot:file.slot,fileName:file.fileName,mimeType:file.mimeType,byteSize:file.byteSize,inline:file.inline};
    studio.request={...request,files:[...(request.files||[]),shown]};
    if(file.inline){capacity(studio.assets,120);studio.assets.push({id:file.id,diskName:file.diskName,fileName:file.fileName,mimeType:file.mimeType,byteSize:file.byteSize,slot:file.slot,...who,at:file.at});}
    const intake=file.inline?row.intake:{...(row.intake||{receivedAt:file.at}),files:[...(row.intake?.files||[]),{id:file.id,diskName:file.diskName,fileName:file.fileName,byteSize:file.byteSize,mimeType:file.mimeType,sha256:file.sha256,kind:'attachment',slot:file.slot}]};
    commit(intake?{...row,intake}:row,studio,'PULSE 제작 request_file',who);
    return {...customerState(token),file:shown};
  });}
  // 손님이 잘못 올린 파일을 지운다. 확인이 끝난 뒤에는 저희가 쓰고 있을 수 있어 막는다. 돌려준 이름의 실제 파일은 부른 쪽이 트랜잭션 밖에서 지운다.
  function removeRequestFile(token,csrf,fileId){return store.transaction(()=>{
    const {row}=customerWrite(token,csrf),studio=studioOf(row),who=actor(row),request=studio.request;
    if(!request?.files?.some(item=>item.id===fileId))throw fail('파일을 찾지 못했어요.',404);
    if(request.status==='confirmed'||request.confirmedAt)throw fail('확인이 끝난 자료예요. 바꿀 내용은 담당자에게 알려 주세요.',409);
    if(studio.scenes.some(scene=>scene.assetId===fileId)||(request.asks||[]).some(ask=>ask.fileId===fileId))throw fail('이미 쓰고 있는 파일이에요. 담당자에게 알려 주세요.',409);
    const asset=studio.assets.find(item=>item.id===fileId),attached=row.intake?.files?.find(item=>item.id===fileId),diskName=asset?.diskName||attached?.diskName;
    if((asset&&asset.author!=='customer')||!diskName)throw fail('파일을 찾지 못했어요.',404);
    studio.assets=studio.assets.filter(item=>item.id!==fileId);studio.request={...request,files:request.files.filter(item=>item.id!==fileId)};
    commit(attached?{...row,intake:{...row.intake,files:row.intake.files.filter(item=>item.id!==fileId)}}:row,studio,'PULSE 제작 request_file_remove',who);
    return {...customerState(token),removed:{diskName}};
  });}
  function customerAction(token,csrf,input){
    if(['confirm_delivery','submit_kickoff_source'].includes(input?.action)){customerWrite(token,csrf);clientProjects.customerAction(token,csrf,input);return customerState(token);}
    return store.transaction(()=>{
      const {row}=customerWrite(token,csrf);
      if(input?.action==='approve'){
        const approval=buildCustomerPreviewApproval(row);
        if(!approval.canApprove)throw fail(approval.reason,409);
      }
      clientProjects.customerAction(token,csrf,input);return customerState(token);
    });
  }
  // 서버 안에서만 부른다: 자동 안내가 읽는 고객 화면 사실(고객용 프로젝트 보기 + 고객에게 공개된 스튜디오).
  function customerSnapshot(projectId){const row=store.get('clientProjects',projectId);if(!row)throw fail('그 프로젝트를 찾지 못했어요.',404);return {...clientProjects.customerSnapshot(projectId),studio:view(row)};}
  return {addRequestFile,removeRequestFile,customerState,staffState,customerMutate,staffMutate,assertCustomerUpload,assertStaffUpload,customerUpload,staffUpload,customerMedia,staffMedia,customerAction,customerSnapshot};
}
