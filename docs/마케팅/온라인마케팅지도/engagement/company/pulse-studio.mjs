import {randomUUID} from 'node:crypto';
import {emptyStrategy,strategyOf,strategyView,applyStrategyAction,sceneStrategy} from './pulse-strategy.mjs';
import {buildClientKickoff} from './client-kickoff.mjs';
import {buildClientChanges} from './client-changes.mjs';
import {buildSceneRequests,recordSceneReview} from './client-scene-requests.mjs';
import {buildClientSchedule} from './client-schedule.mjs';
import {deliverableActions,applyDeliverableAction,deliverableView} from './pulse-deliverables.mjs';
import {feedbackRoundActions,applyFeedbackRoundAction,feedbackRoundsView} from './pulse-feedback-rounds.mjs';
import {previewActions,applyPreviewAction,previewsView,visiblePreviewAssetIds} from './pulse-previews.mjs';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const PREFS=['brand','goal','audience','mood','mustHave','avoid','notes'];
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
function keys(value,allowed){if(!object(value)||Object.keys(value).some(key=>!allowed.includes(key)))throw fail('제작 기획 입력 항목을 확인해 주세요.');}
function text(value,max=3000,required=false){if(value===undefined&&!required)return '';if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw fail('입력 내용과 길이를 확인해 주세요.');const clean=value.trim();if(required&&!clean)throw fail('필수 내용을 입력해 주세요.');return clean;}
function url(value){const raw=text(value,2000);if(!raw)return '';let parsed;try{parsed=new URL(raw);}catch{throw fail('HTTPS 자료 주소를 입력해 주세요.');}if(parsed.protocol!=='https:'||parsed.username||parsed.password)throw fail('HTTPS 자료 주소를 입력해 주세요.');return parsed.href;}
function id(value){if(typeof value!=='string'||!UUID.test(value))throw fail('기획 항목을 확인해 주세요.');return value;}
function capacity(list,max){if(list.length>=max)throw fail('이 프로젝트의 기획 기록 한도에 도달했습니다. 기존 기록을 보존하고 새 프로젝트로 이어가 주세요.',409);}
function empty(){return {schemaVersion:1,preferences:Object.fromEntries(PREFS.map(key=>[key,''])),strategy:emptyStrategy(),assets:[],references:[],concepts:[],scenes:[],selectedConcept:null,conceptSelections:[],sceneReviews:[],comments:[],history:[]};}
export {empty as emptyPulseStudio};
function studioOf(row){if(!row.studio)return empty();if(row.studio.schemaVersion!==1)throw fail('프로젝트 기획 버전을 확인해 주세요.',409);const studio=structuredClone(row.studio);studio.strategy=strategyOf(studio.strategy);return studio;}

// All creative state belongs to the authoritative clientProjects document.
// Existing project revisions, invite revocation, ACL and backup transactions
// therefore remain authoritative; this module creates no second customer login.
export function createPulseStudioService({store,clientProjects,clock=()=>new Date().toISOString()}){
  function customer(token){return clientProjects.session(token);}
  function customerWrite(token,csrf){const context=customer(token);if(typeof csrf!=='string'||context.auth.body.csrf!==csrf)throw fail('고객 화면을 다시 열어 주세요.',403);return context;}
  function revision(row,value){if(!Number.isSafeInteger(value)||value!==row.revision)throw fail('프로젝트가 변경되었습니다. 새로 불러온 뒤 다시 저장해 주세요.',409);}
  function actor(row,user){return user?{author:'staff',authorId:user.id,authorName:store.get('users',user.id)?.name||'담당자'}:{author:'customer',authorId:'customer',authorName:row.customerName};}
  function visibleAssetIds(studio){
    const ids=new Set(studio.assets.filter(asset=>asset.author==='customer').map(asset=>asset.id));
    for(const value of [...studio.references,...studio.concepts.filter(card=>card.visibility==='customer'),...studio.scenes.filter(card=>card.visibility==='customer'),...studio.history.filter(card=>card.visibility==='customer')])if(value.assetId)ids.add(value.assetId);
    for(const value of visiblePreviewAssetIds(studio))ids.add(value);
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
    return {schemaVersion:1,preferences:studio.preferences,strategy:strategyView(studio.strategy),deliverables:deliverableView(studio,row,staff),feedbackRounds:feedbackRoundsView(studio,row,staff),previews:previewsView(studio,row,staff),assets:[...assetMap.values()],references:studio.references.map(card),concepts:concepts.map(card),scenes:scenes.map(card),selectedConcept:selection(studio.selectedConcept),conceptSelections:studio.conceptSelections.map(selection),sceneReviews:studio.sceneReviews.filter(value=>staff||scenes.some(scene=>scene.id===value.sceneId)).map(value=>({...card(value),current:scenes.some(item=>item.id===value.sceneId&&item.revision===value.sceneRevision&&item.visibility==='customer')})),comments:studio.comments.filter(value=>staff||value.visibility==='customer'&&publicTarget(value.targetType,value.targetId)).map(card),cardRevisions:studio.history.filter(value=>staff||value.visibility==='customer').map(card)};
  }
  function customerState(token){const {row}=customer(token),result=clientProjects.read(token);return {...result,project:{...result.project,studio:view(row)}};}
  function staffState(user,projectId){
    const row=clientProjects.project(user,projectId),{inviteHash,inviteRevision,notificationEvents,studio,...safe}=row;
    let canEdit=true;try{clientProjects.project(user,projectId,true);}catch{canEdit=false;}
    // Staff media must use staff routes. A staff session cannot impersonate
    // a customer's capability merely to render an image or video.
    const versions=row.versions.map(version=>({...version,...(version.media?{media:{...media(row,version.media,true),url:'/api/client-media/'+version.media.id}}:{})}));
    return {project:{...safe,versions,kickoff:buildClientKickoff(row,{now:clock(),canEdit}),changes:buildClientChanges(row,{now:clock(),canEdit}),sceneRequests:buildSceneRequests(row,clientProjects.sceneRequestContext(row,user)),schedule:buildClientSchedule(row,{now:clock(),canEdit,reviewerId:clientProjects.sceneRequestContext(row,user).reviewerId}),ownerName:store.get('users',row.ownerId)?.name||'담당자',reviewerName:store.get('users',row.reviewerId)?.name||'',inviteActive:!!inviteHash&&Date.parse(row.inviteExpiresAt)>Date.parse(clock()),studio:view(row,true)},canEdit};
  }
  function asset(studio,assetId,{image=false}={}){if(!assetId)return null;const found=studio.assets.find(value=>value.id===id(assetId));if(!found||image&&!found.mimeType.startsWith('image/'))throw fail(image?'프로젝트의 이미지 자료를 선택해 주세요.':'이 프로젝트의 자료를 선택해 주세요.',404);return found;}
  function pointer(studio,input,{image=false}={}){const found=asset(studio,input.assetId,{image});return {assetId:found?.id||null,imageUrl:image?url(input.imageUrl):undefined};}
  function published(studio,type,targetId,targetRevision){const found=studio[type].find(value=>value.id===id(targetId));if(!found||found.visibility!=='customer')throw fail('공개된 기획 항목을 찾을 수 없습니다.',404);if(found.revision!==targetRevision)throw fail('기획 내용이 변경되었습니다. 최신 내용을 확인해 주세요.',409);return found;}
  function commit(row,studio,event,who){
    if(Buffer.byteLength(JSON.stringify(studio),'utf8')>1500000)throw fail('기획 기록 한도에 도달했습니다. 기존 기록을 보존하고 새 프로젝트로 이어가 주세요.',409);
    const at=clock();clientProjects.commitWorkflow({...row,studio,revision:row.revision+1,updatedAt:at,history:[...row.history,{id:randomUUID(),action:event,actor:who.authorId,at}].slice(-300)});
  }
  function mutate(row,input,user=null){
    const base=['action','revision'],studio=studioOf(row),who=actor(row,user),at=clock(),stamp={...who,at};revision(row,input?.revision);
    const fields={save_strategy:['strategy'],request_strategy_review:[],confirm_strategy:['strategyRevision'],save_preferences:['preferences'],save_reference:['id','label','url','assetId','preference','reason'],remove_reference:['id'],select_concept:['conceptId','conceptRevision','text'],review_scene:['sceneId','sceneRevision','status','text'],comment:['targetType','targetId','targetRevision','text'],save_concept:['id','title','description','tagline','imageUrl','assetId','visibility'],save_scene:['id','title','description','narration','screenText','duration','imageUrl','assetId','visibility','purpose','valueNumbers'],reorder_scenes:['ids']};
    const extensions=[{fields:deliverableActions,apply:applyDeliverableAction},{fields:feedbackRoundActions,apply:applyFeedbackRoundAction},{fields:previewActions,apply:applyPreviewAction}];
    const extension=object(input)?extensions.find(value=>value.fields(input.action)):null;
    if(!object(input)||!Object.hasOwn(fields,input.action)&&!extension)throw fail('기획 요청을 확인해 주세요.');keys(input,[...base,...(extension?extension.fields(input.action):fields[input.action])]);
    const action=input.action;
    if(extension){extension.apply({studio,row,input,staff:!!user,stamp});commit(row,studio,'PULSE 제작 '+action,who);return;}
    if(['save_concept','save_scene','reorder_scenes'].includes(action)&&!user)throw fail('제작 담당자만 기획안을 편집할 수 있습니다.',403);
    if(['select_concept','review_scene'].includes(action)&&user)throw fail('고객의 선택·확인은 고객 검토 화면에서만 기록합니다.',403);
    if(['save_strategy','request_strategy_review','confirm_strategy'].includes(action)){
      studio.strategy=applyStrategyAction(studio.strategy,input,stamp);
    }else if(action==='save_preferences'){
      keys(input.preferences,PREFS);studio.preferences=Object.fromEntries(PREFS.map(key=>[key,text(input.preferences[key],key==='notes'?3000:1500)]));
    }else if(action==='save_reference'){
      const found=input.id?studio.references.find(value=>value.id===id(input.id)):null;if(input.id&&!found)throw fail('참고 자료를 찾을 수 없습니다.',404);
      if(!['like','avoid','neutral'].includes(input.preference))throw fail('참고 자료의 선호를 선택해 주세요.');
      const referenceAsset=asset(studio,input.assetId),referenceUrl=url(input.url);if(!referenceAsset&&!referenceUrl)throw fail('참고 자료 또는 HTTPS 주소를 추가해 주세요.');
      if(!user&&referenceAsset&&!visibleAssetIds(studio).has(referenceAsset.id))throw fail('공개된 프로젝트 자료를 선택해 주세요.',404);
      if(found&&!user&&found.author!=='customer'&&(found.label!==text(input.label,160,true)||found.url!==referenceUrl||found.assetId!==(referenceAsset?.id||null)))throw fail('제작자가 올린 원본 자료는 변경할 수 없습니다. 선호와 이유를 남겨 주세요.',403);
      if(!found)capacity(studio.references,60);
      const value={id:found?.id||randomUUID(),label:text(input.label,160,true),url:referenceUrl,assetId:referenceAsset?.id||null,preference:input.preference,reason:text(input.reason),...stamp,...(found?{author:found.author,authorId:found.authorId,authorName:found.authorName}:{}),updatedAt:at};
      if(found)studio.references[studio.references.indexOf(found)]=value;else studio.references.push(value);
    }else if(action==='remove_reference'){
      const found=studio.references.find(value=>value.id===id(input.id));if(!found)throw fail('참고 자료를 찾을 수 없습니다.',404);if(!user&&found.author!=='customer')throw fail('제작자가 올린 참고 자료는 제작자에게 변경을 요청해 주세요.',403);studio.references=studio.references.filter(value=>value.id!==found.id);
    }else if(action==='save_concept'||action==='save_scene'){
      const isConcept=action==='save_concept',list=isConcept?studio.concepts:studio.scenes,found=input.id?list.find(value=>value.id===id(input.id)):null;
      if(input.id&&!found)throw fail('기획 항목을 찾을 수 없습니다.',404);if(!['internal','customer'].includes(input.visibility))throw fail('기획 공개 범위를 선택해 주세요.');
      if(found){capacity(studio.history,200);studio.history.push({...found,type:isConcept?'concept':'scene'});}else capacity(list,isConcept?12:60);
      const value={id:found?.id||randomUUID(),title:text(input.title,160,true),description:text(input.description),...pointer(studio,input,{image:true}),visibility:input.visibility,revision:(found?.revision||0)+1,...stamp};
      if(isConcept)value.tagline=text(input.tagline,500);
      else{if(typeof input.duration!=='number'||!Number.isFinite(input.duration)||input.duration<0.1||input.duration>600)throw fail('장면 길이는 0.1초에서 600초 사이로 입력해 주세요.');Object.assign(value,{narration:text(input.narration,1500),screenText:text(input.screenText,1500),duration:input.duration},sceneStrategy(input,found,studio.strategy));}
      if(found)list[list.indexOf(found)]=value;else list.push(value);
    }else if(action==='reorder_scenes'){
      if(!Array.isArray(input.ids)||input.ids.length!==studio.scenes.length||new Set(input.ids).size!==input.ids.length||input.ids.some(value=>!studio.scenes.some(scene=>scene.id===value)))throw fail('모든 장면을 한 번씩 포함해 주세요.');
      studio.scenes=input.ids.map(value=>studio.scenes.find(scene=>scene.id===value));
    }else if(action==='select_concept'){
      const concept=published(studio,'concepts',input.conceptId,input.conceptRevision);if(!concept.assetId&&!concept.imageUrl)throw fail('대표 이미지가 준비된 콘셉트를 확인한 뒤 선택해 주세요.',409);capacity(studio.conceptSelections,120);
      studio.selectedConcept={id:randomUUID(),conceptId:concept.id,conceptRevision:concept.revision,title:concept.title,text:text(input.text),...stamp};studio.conceptSelections.push(studio.selectedConcept);
    }else if(action==='review_scene'){
      const scene=published(studio,'scenes',input.sceneId,input.sceneRevision);if(!['confirmed','changes','comment'].includes(input.status))throw fail('장면 검토 상태를 확인해 주세요.');capacity(studio.sceneReviews,240);
      const review={id:randomUUID(),sceneId:scene.id,sceneRevision:scene.revision,title:scene.title,status:input.status,text:text(input.text,3000,input.status!=='confirmed'),...stamp};studio.sceneReviews.push(review);
      const sceneRequestWorkflows=recordSceneReview({...row,studio},review,{...clientProjects.sceneRequestContext(row),at});if(sceneRequestWorkflows)row={...row,sceneRequestWorkflows};
    }else if(action==='comment'){
      if(!['project','concept','scene'].includes(input.targetType))throw fail('의견을 남길 대상을 확인해 주세요.');
      let target=null;if(input.targetType!=='project'){
        const list=input.targetType==='concept'?'concepts':'scenes';target=studio[list].find(value=>value.id===id(input.targetId));
        if(!target||!user&&target.visibility!=='customer')throw fail('기획 항목을 찾을 수 없습니다.',404);if(target.revision!==input.targetRevision)throw fail('최신 기획 내용을 확인해 주세요.',409);
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
  function customerMedia(token,assetId){const {row}=customer(token),studio=studioOf(row),found=studio.assets.find(value=>value.id===id(assetId));if(!found||!visibleAssetIds(studio).has(found.id))throw fail('자료를 찾을 수 없습니다.',404);return found;}
  function staffMedia(user,projectId,assetId){const row=clientProjects.project(user,projectId),found=studioOf(row).assets.find(value=>value.id===id(assetId));if(!found)throw fail('자료를 찾을 수 없습니다.',404);return found;}
  function customerAction(token,csrf,input){
    if(['confirm_delivery','submit_kickoff_source'].includes(input?.action)){customerWrite(token,csrf);clientProjects.customerAction(token,csrf,input);return customerState(token);}
    return store.transaction(()=>{
      const {row}=customerWrite(token,csrf);
      if(input?.action==='approve'){
        const latest=row.versions.filter(value=>value.kind==='preview').at(-1);
        if(latest&&(row.studio?.feedbackRounds?.drafts||[]).some(draft=>draft.versionId===latest.id&&draft.items?.length))throw fail('모은 수정 의견을 먼저 제출하거나 초안에서 지운 뒤 승인해 주세요.',409);
        const unresolved=row.messages.filter(message=>message.author==='customer'&&message.action==='feedback'&&!message.resolved);
        if(latest&&unresolved.some(message=>message.versionId===latest.id))throw fail('이 시안에 남긴 수정 의견이 있습니다. 수정본을 받은 뒤 승인해 주세요.',409);
        // Uploading a revision exposes it immediately. Approval must wait until
        // every earlier request is linked and reviewed for this exact revision;
        // otherwise it can no longer enter the correction workflow or delivery.
        if(latest&&unresolved.some(message=>message.workflow?.status!=='waiting_customer'||message.workflow.resultVersionId!==latest.id))throw fail('이전 시안의 수정 의견을 담당자가 최신 수정본에 연결하고 검토를 마친 뒤 승인할 수 있습니다. 담당자 확인을 기다려 주세요.',409);
      }
      clientProjects.customerAction(token,csrf,input);return customerState(token);
    });
  }
  return {customerState,staffState,customerMutate,staffMutate,assertCustomerUpload,assertStaffUpload,customerUpload,staffUpload,customerMedia,staffMedia,customerAction};
}
