import {randomUUID} from 'node:crypto';
import {buildDeliveryCheck,deliveryCheckFingerprint,deliveryCheckMedia,deliveryItemConfirmationKey,deliveryItemConfirmed} from './client-delivery-check.mjs';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const DOCUMENT_KIND='clientDeliveryDrafts',ITEM_LIMIT=40;
const MIME_KINDS={'video/mp4':'video','video/webm':'video','image/png':'image','image/jpeg':'image','application/x-subrip':'subtitle','text/vtt':'subtitle'};
const MIME_EXTENSIONS={'video/mp4':'mp4','video/webm':'webm','image/png':'png','image/jpeg':'jpg','application/x-subrip':'srt','text/vtt':'vtt'};
const STATUS={no_preview:'시안 없음',waiting_approval:'고객 승인 대기',feedback_pending:'수정 요청 확인 필요',archived:'보관됨',delivered:'납품 등록 완료',preparing:'납품 준비 중',ready:'납품 등록 가능'};
const defaults=()=>[{id:'video',kind:'video',label:'최종 영상',required:true,note:''},{id:'subtitle',kind:'subtitle',label:'자막',required:false,note:''},{id:'thumbnail',kind:'image',label:'썸네일',required:false,note:''}];
const object=value=>{if(!value||typeof value!=='object'||Array.isArray(value))throw fail('납품 준비 입력을 확인해 주세요.');return value;};
const exact=(value,keys)=>{object(value);if(Object.keys(value).some(key=>!keys.includes(key)))throw fail('납품 준비 입력 항목을 확인해 주세요.');};
const text=(value,max,label,required=false)=>{if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw fail(`${label}을 확인해 주세요.`);const result=value.trim();if(required&&!result)throw fail(`${label}을 입력해 주세요.`);return result;};
const https=value=>{const raw=text(value,2000,'자료 주소',true);let url;try{url=new URL(raw);}catch{throw fail('HTTPS 자료 주소를 입력해 주세요.');}if(url.protocol!=='https:'||url.username||url.password)throw fail('HTTPS 자료 주소를 입력해 주세요.');return url.href;};
const latestPreview=row=>row.versions.filter(version=>version.kind==='preview').at(-1);
const key=(projectId,previewId)=>projectId+':'+previewId;
const mediaUrl=(projectId,mediaId)=>`/api/client-projects/${encodeURIComponent(projectId)}/delivery/media/${encodeURIComponent(mediaId)}`;
const publicMedia=(projectId,media)=>({id:media.id,fileName:media.fileName,mimeType:media.mimeType,byteSize:media.byteSize,url:mediaUrl(projectId,media.id)});
const activeItems=draft=>draft.items.filter(item=>!item.removed);
const typeMatches=(item,requirement)=>!item.media||MIME_KINDS[item.media.mimeType]===requirement.kind;
const validRevision=value=>Number.isSafeInteger(value)&&value>=0;

export function createClientDeliveryService({store,clientProjects,clock=()=>new Date().toISOString(),fileInspector=null}){
  const CHECK_KIND='clientDeliveryChecks';let scanning=null;
  function current(user){const live=store.get('users',user?.id);if(!live?.active)throw fail('먼저 로그인해 주세요.',401);return live;}
  function readState(user,projectId){
    user=current(user);const row=clientProjects.project(user,projectId),preview=latestPreview(row),approved=preview?.approvedAt?preview:null;
    const stored=approved?store.get(DOCUMENT_KIND,key(row.id,approved.id)):null;
    const draft=stored||{schema:1,projectId:row.id,approvedPreviewId:approved?.id||null,draftRevision:0,requirements:defaults(),items:[],guide:null,guideEdited:false,deliveredVersionIds:[]};
    const delivered=approved?row.versions.filter(version=>version.kind==='final'&&version.approvedPreviewId===approved.id).map(version=>version.id):[];
    let status=row.stage==='archived'?'archived':!preview?'no_preview':!approved?'waiting_approval':row.messages.some(message=>message.author==='customer'&&message.action==='feedback'&&!message.resolved)?'feedback_pending':delivered.length||draft.deliveredVersionIds.length?'delivered':'preparing';
    let writable=false;try{clientProjects.project(user,projectId,true);writable=true;}catch(error){if(![403,409].includes(error.status))throw error;}
    return {user,row,preview,approved,draft,status,canEdit:writable&&status==='preparing',delivered};
  }
  function generatedGuide(row,approved,draft){
    if(!approved)return '';
    const items=activeItems(draft),purposes=draft.requirements.filter(requirement=>items.some(item=>item.requirementId===requirement.id)).map(requirement=>`${requirement.label}: ${items.filter(item=>item.requirementId===requirement.id).length}개`).join('\n');
    return `${row.title}\n고객이 승인한 시안: ${approved.label}\n\n${purposes?`전달 파일과 용도\n${purposes}`:'전달할 파일을 선택한 뒤 용도와 사용 안내를 확인해 주세요.'}\n\n전달 파일을 내려받아 내용과 재생 상태를 확인해 주세요. 추가 문의는 이 프로젝트의 후속 문의에 남겨 주세요.`;
  }
  function inspect(state){
    const {row,approved,draft,status,canEdit,delivered}=state,items=activeItems(draft),guide=draft.guideEdited?draft.guide:generatedGuide(row,approved,draft);
    const inspection=approved?store.get(CHECK_KIND,key(row.id,approved.id)):null,deliveryCheck=buildDeliveryCheck(row,draft,{inspection,now:clock(),canInspect:canEdit&&!!fileInspector});
    if(status==='delivered'&&deliveryCheck.status!=='existing_delivery')deliveryCheck.inspectReason='등록한 납품 기록입니다. 화면을 새로 불러오면 현재 파일 상태를 다시 확인합니다.';
    const checks=[{id:'approval',label:'최신 시안 고객 승인',status:approved?'ready':'missing',text:approved?'현재 최신 시안의 고객 승인을 확인했습니다.':'최신 시안에 고객 승인이 필요합니다.'},
      {id:'project',label:'납품 가능한 프로젝트',status:status==='preparing'?'ready':'missing',text:status==='preparing'?'남아 있는 고객 수정 요청과 같은 시안의 납품 기록이 없습니다.':STATUS[status]},
      {id:'files',label:'전달 파일 선택',status:items.length?'ready':'missing',text:items.length?`${items.length}개 파일 또는 주소를 선택했습니다.`:'전달할 파일 또는 주소를 한 개 이상 선택해 주세요.'}];
    for(const requirement of draft.requirements){const selected=items.filter(item=>item.requirementId===requirement.id),valid=selected.some(item=>typeMatches(item,requirement));checks.push({id:'requirement:'+requirement.id,label:requirement.label,status:!requirement.required||valid?'ready':'missing',text:!selected.length?(requirement.required?'필수 파일을 추가해 주세요.':'선택 사항입니다.'):valid?'선택한 파일이 있습니다.':'선택한 파일 형식이 이 용도와 다릅니다.'});}
    for(const item of items){const requirement=draft.requirements.find(entry=>entry.id===item.requirementId),matches=!!requirement&&typeMatches(item,requirement),confirmed=deliveryItemConfirmed(row,draft,item,inspection);checks.push({id:'item:'+item.id,label:item.label,status:!matches?'missing':confirmed?'ready':'manual',text:!matches?'파일 형식과 선택한 용도를 맞춰 주세요.':confirmed?'담당자가 내용·규격·사용 용도를 직접 확인했습니다.':item.media?'파일 내용·규격과 승인 시안의 일치 여부를 직접 확인해 주세요.':'외부 주소의 접근·다운로드와 파일 내용·규격을 직접 확인해 주세요.'});}
    checks.push({id:'capacity',label:'프로젝트 파일 기록 여유',status:row.versions.length+items.length<=100?'ready':'missing',text:row.versions.length+items.length<=100?'선택한 파일을 프로젝트에 등록할 수 있습니다.':'프로젝트의 파일 버전은 최대 100개입니다. 기존 기록은 보존하며 전달할 파일 수를 확인해 주세요.'});
    checks.push({id:'guide',label:'최종본 사용 안내',status:guide?.trim()?'ready':'missing',text:guide?.trim()?'전달할 사용 안내를 준비했습니다.':'최종본 사용 안내를 입력해 주세요.'});
    const ready=checks.every(check=>check.status==='ready')&&deliveryCheck.canPublish,viewStatus=status==='preparing'&&ready?'ready':status;
    const candidate=approved&&(approved.media||approved.url)?[{versionId:approved.id,label:approved.label,kind:approved.media?MIME_KINDS[approved.media.mimeType]||'unknown':'link',...(approved.media?{media:publicMedia(row.id,approved.media)}:{}),...(approved.url?{url:approved.url}:{})}]:[];
    const safeItems=items.map(item=>({id:item.id,requirementId:item.requirementId,deliverableItemId:item.deliverableItemId||'',label:item.label,kind:item.media?MIME_KINDS[item.media.mimeType]||'unknown':draft.requirements.find(requirement=>requirement.id===item.requirementId)?.kind||'unknown',confirmed:deliveryItemConfirmed(row,draft,item,inspection),confirmationToken:deliveryItemConfirmationKey(row,draft,item,inspection),source:item.source,...(item.media?{media:publicMedia(row.id,item.media)}:{}),...(item.url?{url:item.url}:{})}));
    return {projectId:row.id,projectRevision:row.revision,draftRevision:draft.draftRevision,approvedPreview:approved?{id:approved.id,label:approved.label,approvedAt:approved.approvedAt}:null,status:viewStatus,statusLabel:STATUS[viewStatus],canEdit,requirements:draft.requirements,items:safeItems,candidates:candidate,guide,transferText:approved?`${row.title}의 최종본을 준비했습니다.\n승인 시안: ${approved.label}\n${items.map(item=>'- '+item.label).join('\n')}\n\n${guide}`:'',checks,deliveryCheck,canPublish:canEdit&&ready,deliveredVersionIds:[...new Set([...delivered,...draft.deliveredVersionIds])]};
  }
  function get(user,projectId){return inspect(readState(user,projectId));}
  function changing(user,projectId,input,fields){
    exact(input,['action','projectRevision','draftRevision','approvedPreviewId',...fields]);
    const state=readState(user,projectId);clientProjects.project(state.user,projectId,true);
    if(!validRevision(input.projectRevision)||!validRevision(input.draftRevision)||input.projectRevision!==state.row.revision||input.draftRevision!==state.draft.draftRevision||!state.approved||input.approvedPreviewId!==state.approved.id)throw fail('프로젝트 또는 납품 준비가 변경됐습니다. 새로 불러온 뒤 다시 확인해 주세요.',409);
    if(!state.canEdit)throw fail(STATUS[state.status]+' 상태에서는 납품 준비를 변경할 수 없습니다.',409);
    return state;
  }
  function requirement(draft,id){const found=draft.requirements.find(entry=>entry.id===id);if(!found)throw fail('파일 용도를 선택해 주세요.');return found;}
  function deliverable(row,value){if(value===undefined||value==='')return '';if(typeof value!=='string'||!row.studio?.deliverables?.items?.some(item=>item.id===value))throw fail('현재 납품 규격의 항목을 선택해 주세요.',400);return value;}
  function capacity(draft){if(draft.items.length>=ITEM_LIMIT)throw fail('납품 준비 파일 기록은 최대 40개입니다. 기존 기록은 보존됩니다.',409);}
  function persist(state,draft){const at=clock(),updated={...draft,draftRevision:state.draft.draftRevision+1,createdAt:draft.createdAt||at,updatedAt:at,updatedBy:state.user.id};store.put(DOCUMENT_KIND,key(state.row.id,state.approved.id),updated);return get(state.user,state.row.id);}
  function requirements(value){if(!Array.isArray(value)||!value.length||value.length>12)throw fail('파일 용도는 1~12개로 입력해 주세요.');const ids=new Set();return value.map(entry=>{exact(entry,['id','kind','label','required','note']);if(typeof entry.id!=='string'||!/^[a-z][a-z0-9_-]{0,39}$/.test(entry.id)||ids.has(entry.id))throw fail('파일 용도 식별자를 확인해 주세요.');ids.add(entry.id);if(!['video','subtitle','image'].includes(entry.kind)||typeof entry.required!=='boolean')throw fail('파일 용도와 필수 여부를 확인해 주세요.');return {id:entry.id,kind:entry.kind,label:text(entry.label,80,'파일 용도',true),required:entry.required,note:text(entry.note??'',500,'파일 규격 메모')};});}
  function mutate(user,projectId,input){
    object(input);const fields={save_requirements:['requirements'],use_approved:['requirementId','label','deliverableItemId'],add_link:['requirementId','label','url','deliverableItemId'],update_item:['itemId','label','confirmed','deliverableItemId','confirmationToken'],remove_item:['itemId'],save_guide:['guide'],publish:['confirmed']}[input.action];
    if(!fields)throw fail('납품 준비 작업을 확인해 주세요.');
    return store.transaction(()=>{
      const state=changing(user,projectId,input,fields),draft=structuredClone(state.draft);
      if(input.action==='save_requirements'){
        const next=requirements(input.requirements);if(activeItems(draft).some(item=>!next.some(entry=>entry.id===item.requirementId)))throw fail('삭제할 용도의 파일을 먼저 준비 목록에서 빼 주세요.',409);
        draft.items=draft.items.map(item=>{const before=draft.requirements.find(entry=>entry.id===item.requirementId),after=next.find(entry=>entry.id===item.requirementId);return !item.removed&&JSON.stringify(before)!==JSON.stringify(after)?{...item,confirmed:false}:item;});draft.requirements=next;
      }else if(input.action==='use_approved'||input.action==='add_link'){
        requirement(draft,input.requirementId);capacity(draft);const label=text(input.label,120,'파일 이름',true);
        const item={id:randomUUID(),requirementId:input.requirementId,deliverableItemId:deliverable(state.row,input.deliverableItemId),label,confirmed:false,source:input.action==='use_approved'?'approved':'link',createdAt:clock()};
        if(input.action==='use_approved'){
          if(!state.approved.media&&!state.approved.url)throw fail('승인 시안의 파일 또는 주소가 없습니다.',409);
          if(state.approved.media&&!MIME_KINDS[state.approved.media.mimeType])throw fail('승인 시안의 파일 형식을 확인해 주세요.',415);
          if(activeItems(draft).some(entry=>entry.source==='approved'&&entry.requirementId===item.requirementId))throw fail('이 용도에 승인 시안을 이미 선택했습니다.',409);
          item.versionId=state.approved.id;if(state.approved.media)item.media=structuredClone(state.approved.media);if(state.approved.url)item.url=https(state.approved.url);
        }else{item.url=https(input.url);if(activeItems(draft).some(entry=>entry.requirementId===item.requirementId&&entry.url===item.url))throw fail('이 용도에 같은 주소를 이미 선택했습니다.',409);}
        draft.items.push(item);
      }else if(input.action==='update_item'||input.action==='remove_item'){
        const item=activeItems(draft).find(entry=>entry.id===input.itemId);if(!item)throw fail('납품 준비 파일을 찾을 수 없습니다.',404);
        if(input.action==='remove_item'){item.removed=true;item.removedAt=clock();item.confirmed=false;}
        else{if(input.label===undefined&&input.confirmed===undefined&&input.deliverableItemId===undefined)throw fail('변경할 파일 이름·규격 연결 또는 확인 여부를 입력해 주세요.');if(input.label!==undefined){item.label=text(input.label,120,'파일 이름',true);item.confirmed=false;}if(input.deliverableItemId!==undefined){const next=deliverable(state.row,input.deliverableItemId);if(next!==(item.deliverableItemId||'')){item.deliverableItemId=next;item.confirmed=false;}}if(input.confirmed!==undefined){if(typeof input.confirmed!=='boolean')throw fail('파일 확인 여부를 확인해 주세요.');if(input.confirmed&&!typeMatches(item,requirement(draft,item.requirementId)))throw fail('파일 형식과 선택한 용도를 먼저 맞춰 주세요.',409);const inspection=store.get(CHECK_KIND,key(state.row.id,state.approved.id)),report=buildDeliveryCheck(state.row,draft,{inspection}),token=deliveryItemConfirmationKey(state.row,draft,item,inspection);if(input.confirmed&&report.confirmed&&input.confirmationToken!==token)throw fail('납품 규격 또는 파일 검사 결과가 변경됐습니다. 새로 확인한 뒤 체크해 주세요.',409);item.confirmed=input.confirmed;if(input.confirmed)item.confirmationToken=token;else delete item.confirmationToken;}}
      }else if(input.action==='save_guide'){draft.guide=text(input.guide,3000,'사용 안내');draft.guideEdited=true;}
      else if(input.action==='publish'){
        if(input.confirmed!==true)throw fail('고객에게 최종본과 사용 안내를 등록할지 확인해 주세요.');
        const view=inspect(state);if(!view.canPublish)throw fail('필수 파일과 직접 확인, 사용 안내를 먼저 준비해 주세요.',409);
        const ids=[];for(const item of activeItems(draft)){const currentRow=clientProjects.project(state.user,projectId,true);if(latestPreview(currentRow)?.id!==state.approved.id||!latestPreview(currentRow)?.approvedAt)throw fail('승인 시안이 변경됐습니다. 다시 확인해 주세요.',409);const result=clientProjects.addVersion(state.user,projectId,{revision:currentRow.revision,kind:'final',label:item.label,url:item.url||'',guide:view.guide},item.media||null);ids.push(result.project.versions.at(-1).id);}
        draft.deliveredVersionIds=ids;draft.publishedAt=clock();draft.publishedBy=state.user.id;
      }
      return persist(state,draft);
    });
  }
  function assertUpload(user,projectId,input){if(input?.action!==undefined&&input.action!=='add_upload')throw fail('파일 업로드 작업을 확인해 주세요.');const state=changing(user,projectId,input,['requirementId','label','deliverableItemId']);requirement(state.draft,input.requirementId);deliverable(state.row,input.deliverableItemId);capacity(state.draft);text(input.label,120,'파일 이름',true);return get(state.user,projectId);}
  function trustedMedia(metadata){
    object(metadata);const {id,diskName,mimeType,fileName,byteSize}=metadata,extension=MIME_EXTENSIONS[mimeType];
    if(typeof id!=='string'||!/^[a-f0-9-]{36}$/i.test(id)||!extension||diskName!==id+'.'+extension||!Number.isSafeInteger(byteSize)||byteSize<=0||byteSize>(MIME_KINDS[mimeType]==='subtitle'?256*1024:100*1024*1024))throw fail('저장한 납품 파일 정보를 확인해 주세요.',415);
    return {id,diskName,mimeType,fileName:text(fileName,200,'원본 파일 이름',true),byteSize};
  }
  function addUpload(user,projectId,input,metadata){return store.transaction(()=>{assertUpload(user,projectId,input);const state=changing(user,projectId,input,['requirementId','label','deliverableItemId']),draft=structuredClone(state.draft),media=trustedMedia(metadata);if(store.all(DOCUMENT_KIND).some(row=>row.items.some(item=>item.media?.id===media.id))||store.all('clientProjects').some(row=>row.versions.some(version=>version.media?.id===media.id)))throw fail('이미 등록한 파일입니다.',409);draft.items.push({id:randomUUID(),requirementId:input.requirementId,deliverableItemId:deliverable(state.row,input.deliverableItemId),label:text(input.label,120,'파일 이름',true),confirmed:false,source:'upload',media,createdAt:clock()});return persist(state,draft);});}
  function mediaFor(user,projectId,mediaId){const state=readState(user,projectId);const media=state.approved?.media?.id===mediaId?state.approved.media:activeItems(state.draft).find(item=>item.media?.id===mediaId)?.media;if(!media)throw fail('납품 준비 파일을 찾을 수 없습니다.',404);return media;}
  async function refreshChecks(user,projectId,{authorize=()=>{}}={}){
    await authorize();const state=readState(user,projectId),spec=state.row.studio?.deliverables;
    if(!state.approved||!spec?.items?.length||spec.confirmation?.deliverableRevision!==spec.revision||state.row.stage==='archived'||state.delivered.length&&!activeItems(state.draft).length)return inspect(state);
    const fingerprint=deliveryCheckFingerprint(state.row,state.draft),results={};
    for(const media of deliveryCheckMedia(state.draft))results[media.id]=fileInspector?await fileInspector.inspect(media):{status:'unavailable',code:'probe_unavailable',message:'파일 검사 도구를 사용할 수 없습니다. 파일을 열어 직접 확인해 주세요.'};
    await authorize();return store.transaction(()=>{const latest=readState(user,projectId);if(state.row.revision!==latest.row.revision||state.draft.draftRevision!==latest.draft.draftRevision||fingerprint!==deliveryCheckFingerprint(latest.row,latest.draft))throw fail('점검 중 프로젝트나 납품 준비가 변경됐습니다. 새로 불러온 뒤 다시 확인해 주세요.',409);store.put(CHECK_KIND,key(latest.row.id,latest.approved.id),{schema:1,projectId:latest.row.id,approvedPreviewId:latest.approved.id,fingerprint,checkedAt:clock(),results});return inspect(latest);});
  }
  async function check(user,projectId,input,options={}){
    exact(input,['projectRevision','draftRevision','approvedPreviewId']);const state=readState(user,projectId);clientProjects.project(state.user,projectId,true);
    if(!state.approved||!validRevision(input.projectRevision)||!validRevision(input.draftRevision)||input.projectRevision!==state.row.revision||input.draftRevision!==state.draft.draftRevision||input.approvedPreviewId!==state.approved.id)throw fail('프로젝트 또는 납품 준비가 변경됐습니다. 새로 불러온 뒤 다시 확인해 주세요.',409);
    if(state.row.stage==='archived')throw fail('보관된 프로젝트는 파일 점검을 다시 실행할 수 없습니다.',409);
    return refreshChecks(user,projectId,{...options,authorize:async()=>{await options.authorize?.();clientProjects.project(current(user),projectId,true);}});
  }
  function scanChecks({onProject=()=>{}}={}){
    if(scanning)return scanning;
    scanning=(async()=>{
      let checked=0,failed=0;
      for(const row of store.all('clientProjects')){
        const spec=row.studio?.deliverables,approved=latestPreview(row);
        if(row.stage==='archived'||!spec?.items?.length||spec.confirmation?.deliverableRevision!==spec.revision||!approved?.approvedAt)continue;
        const owner=store.get('users',row.ownerId);if(!owner?.active||owner.role==='viewer')continue;
        const draft=store.get(DOCUMENT_KIND,key(row.id,approved.id));
        if(row.versions.some(version=>version.kind==='final'&&version.approvedPreviewId===approved.id)&&!draft?.items?.some(item=>!item.removed))continue;
        const fingerprint=deliveryCheckFingerprint(row,draft||{approvedPreviewId:approved.id,requirements:defaults(),items:[]});
        const report=status=>onProject({projectId:row.id,status,at:clock(),fingerprint});
        report('running');
        try{
          const authorize=()=>{const currentOwner=current(owner),currentRow=clientProjects.project(currentOwner,row.id);if(currentOwner.role==='viewer'||currentRow.ownerId!==owner.id||currentRow.stage==='archived')throw fail('현재 담당자의 점검 대상이 변경됐습니다.',403);};
          await refreshChecks(owner,row.id,{authorize});checked++;report('success');
        }catch(error){if([401,403,404,409].includes(error.status))report('skipped');else{failed++;report('error');}}
      }
      return {checked,failed};
    })().finally(()=>{scanning=null;});
    return scanning;
  }
  return {get,mutate,assertUpload,addUpload,mediaFor,refreshChecks,check,scanChecks};
}
