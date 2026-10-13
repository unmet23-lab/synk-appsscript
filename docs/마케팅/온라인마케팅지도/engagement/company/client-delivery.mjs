import {randomUUID} from 'node:crypto';
import {buildDeliveryCheck,deliveryCheckFingerprint,deliveryCheckMedia,deliveryItemConfirmationKey,deliveryItemConfirmed} from './client-delivery-check.mjs';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const DOCUMENT_KIND='clientDeliveryDrafts',ITEM_LIMIT=40;
const MIME_KINDS={'video/mp4':'video','video/webm':'video','image/png':'image','image/jpeg':'image','application/x-subrip':'subtitle','text/vtt':'subtitle'};
const MIME_EXTENSIONS={'video/mp4':'mp4','video/webm':'webm','image/png':'png','image/jpeg':'jpg','application/x-subrip':'srt','text/vtt':'vtt'};
const STATUS={no_preview:'시안 없음',waiting_approval:'고객 승인 전',feedback_pending:'남은 수정 요청 있음',archived:'보관됨',delivered:'고객에게 보임',preparing:'준비 중',ready:'보일 수 있음'};
const defaults=()=>[{id:'video',kind:'video',label:'최종 영상',required:true,note:''},{id:'subtitle',kind:'subtitle',label:'자막',required:false,note:''},{id:'thumbnail',kind:'image',label:'썸네일',required:false,note:''}];
const object=value=>{if(!value||typeof value!=='object'||Array.isArray(value))throw fail('입력 내용을 다시 봐 주세요.');return value;};
const exact=(value,keys)=>{object(value);if(Object.keys(value).some(key=>!keys.includes(key)))throw fail('입력 내용을 다시 봐 주세요.');};
const text=(value,max,label,required=false)=>{if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw fail(`${label}을 확인해 주세요.`);const result=value.trim();if(required&&!result)throw fail(`${label}을 입력해 주세요.`);return result;};
const https=value=>{const raw=text(value,2000,'링크',true);let url;try{url=new URL(raw);}catch{throw fail('https로 시작하는 링크를 적어 주세요.');}if(url.protocol!=='https:'||url.username||url.password)throw fail('https로 시작하는 링크를 적어 주세요.');return url.href;};
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
    return `고객이 승인한 시안: ${approved.label}\n\n${purposes?`전달 파일과 용도\n${purposes}\n\n`:''}전달 파일을 내려받아 내용과 재생 상태를 확인해 주세요. 궁금한 점은 후속 문의에 남겨 주세요.`;
  }
  function inspect(state){
    const {row,approved,draft,status,canEdit,delivered}=state,items=activeItems(draft),guide=draft.guideEdited?draft.guide:generatedGuide(row,approved,draft);
    const inspection=approved?store.get(CHECK_KIND,key(row.id,approved.id)):null,deliveryCheck=buildDeliveryCheck(row,draft,{inspection,now:clock(),canInspect:canEdit&&!!fileInspector});
    if(status==='delivered'&&deliveryCheck.status!=='existing_delivery')deliveryCheck.inspectReason='고객에게 보인 납품 기록이에요. 새로 불러오면 파일 상태를 다시 봐요.';
    const checks=[{id:'approval',label:'최신 시안 고객 승인',status:approved?'ready':'missing',text:approved?'고객이 최신 시안을 승인했어요.':'고객이 최신 시안을 아직 승인하지 않았어요.'},
      {id:'project',label:'보낼 수 있는 상태',status:status==='preparing'?'ready':'missing',text:status==='preparing'?'남은 수정 요청이 없고, 이 시안으로 보낸 적이 없어요.':STATUS[status]},
      {id:'files',label:'줄 파일',status:items.length?'ready':'missing',text:items.length?`${items.length}개를 담았어요.`:'파일이나 링크를 하나 이상 담아 주세요.'}];
    for(const requirement of draft.requirements){const selected=items.filter(item=>item.requirementId===requirement.id),valid=selected.some(item=>typeMatches(item,requirement));checks.push({id:'requirement:'+requirement.id,label:requirement.label,status:!requirement.required||valid?'ready':'missing',text:!selected.length?(requirement.required?'꼭 주는 파일을 담아 주세요.':'안 줘도 되는 파일이에요.'):valid?'담았어요.':'파일 형식이 이 항목과 달라요.'});}
    for(const item of items){const requirement=draft.requirements.find(entry=>entry.id===item.requirementId),matches=!!requirement&&typeMatches(item,requirement),confirmed=deliveryItemConfirmed(row,draft,item,inspection);checks.push({id:'item:'+item.id,label:item.label,status:!matches?'missing':confirmed?'ready':'manual',text:!matches?'파일 형식과 항목을 맞춰 주세요.':confirmed?'담당자가 열어 보고 확인했어요.':item.media?'파일을 열어 승인한 시안과 맞는지 봐 주세요.':'링크가 열리는지, 내용이 맞는지 직접 봐 주세요.'});}
    checks.push({id:'capacity',label:'파일 자리',status:row.versions.length+items.length<=100?'ready':'missing',text:row.versions.length+items.length<=100?'담을 자리가 있어요.':'한 프로젝트에 파일은 100개까지예요. 줄 파일 수를 줄여 주세요.'});
    checks.push({id:'guide',label:'사용 안내',status:guide?.trim()?'ready':'missing',text:guide?.trim()?'사용 안내를 적었어요.':'사용 안내를 적어 주세요.'});
    const ready=checks.every(check=>check.status==='ready')&&deliveryCheck.canPublish,viewStatus=status==='preparing'&&ready?'ready':status;
    const candidate=approved&&(approved.media||approved.url)?[{versionId:approved.id,label:approved.label,kind:approved.media?MIME_KINDS[approved.media.mimeType]||'unknown':'link',...(approved.media?{media:publicMedia(row.id,approved.media)}:{}),...(approved.url?{url:approved.url}:{})}]:[];
    const safeItems=items.map(item=>({id:item.id,requirementId:item.requirementId,deliverableItemId:item.deliverableItemId||'',label:item.label,kind:item.media?MIME_KINDS[item.media.mimeType]||'unknown':draft.requirements.find(requirement=>requirement.id===item.requirementId)?.kind||'unknown',confirmed:deliveryItemConfirmed(row,draft,item,inspection),confirmationToken:deliveryItemConfirmationKey(row,draft,item,inspection),source:item.source,...(item.media?{media:publicMedia(row.id,item.media)}:{}),...(item.url?{url:item.url}:{})}));
    return {projectId:row.id,projectRevision:row.revision,draftRevision:draft.draftRevision,approvedPreview:approved?{id:approved.id,label:approved.label,approvedAt:approved.approvedAt}:null,status:viewStatus,statusLabel:STATUS[viewStatus],canEdit,requirements:draft.requirements,items:safeItems,candidates:candidate,guide,transferText:approved?`${row.title} 최종본을 보내 드려요.\n${items.length?'보내는 파일\n'+items.map(item=>'- '+item.label).join('\n')+'\n\n':''}${guide}`:'',checks,deliveryCheck,canPublish:canEdit&&ready,deliveredVersionIds:[...new Set([...delivered,...draft.deliveredVersionIds])]};
  }
  function get(user,projectId){return inspect(readState(user,projectId));}
  function changing(user,projectId,input,fields){
    exact(input,['action','projectRevision','draftRevision','approvedPreviewId',...fields]);
    const state=readState(user,projectId);clientProjects.project(state.user,projectId,true);
    if(!validRevision(input.projectRevision)||!validRevision(input.draftRevision)||input.projectRevision!==state.row.revision||input.draftRevision!==state.draft.draftRevision||!state.approved||input.approvedPreviewId!==state.approved.id)throw fail('그사이 바뀐 게 있어요. 새로 불러온 뒤 다시 해 주세요.',409);
    if(!state.canEdit)throw fail(STATUS[state.status]+' 상태에서는 납품 준비를 바꿀 수 없어요.',409);
    return state;
  }
  function requirement(draft,id){const found=draft.requirements.find(entry=>entry.id===id);if(!found)throw fail('어떤 파일인지 골라 주세요.');return found;}
  function deliverable(row,value){if(value===undefined||value==='')return '';if(typeof value!=='string'||!row.studio?.deliverables?.items?.some(item=>item.id===value))throw fail('납품 규격에 있는 항목을 골라 주세요.',400);return value;}
  function capacity(draft){if(draft.items.length>=ITEM_LIMIT)throw fail('담을 수 있는 파일은 40개까지예요.',409);}
  function persist(state,draft){const at=clock(),updated={...draft,draftRevision:state.draft.draftRevision+1,createdAt:draft.createdAt||at,updatedAt:at,updatedBy:state.user.id};store.put(DOCUMENT_KIND,key(state.row.id,state.approved.id),updated);return get(state.user,state.row.id);}
  function requirements(value){if(!Array.isArray(value)||!value.length||value.length>12)throw fail('줄 파일 종류는 1~12개로 적어 주세요.');const ids=new Set();return value.map(entry=>{exact(entry,['id','kind','label','required','note']);if(typeof entry.id!=='string'||!/^[a-z][a-z0-9_-]{0,39}$/.test(entry.id)||ids.has(entry.id))throw fail('파일 종류 정보가 이상해요.');ids.add(entry.id);if(!['video','subtitle','image'].includes(entry.kind)||typeof entry.required!=='boolean')throw fail('파일 종류와 꼭 주는지 여부를 다시 봐 주세요.');return {id:entry.id,kind:entry.kind,label:text(entry.label,80,'파일 종류',true),required:entry.required,note:text(entry.note??'',500,'규격 메모')};});}
  function mutate(user,projectId,input){
    object(input);const fields={save_requirements:['requirements'],use_approved:['requirementId','label','deliverableItemId'],add_link:['requirementId','label','url','deliverableItemId'],update_item:['itemId','label','confirmed','deliverableItemId','confirmationToken'],remove_item:['itemId'],save_guide:['guide'],publish:['confirmed']}[input.action];
    if(!fields)throw fail('요청 내용이 비어 있어요.');
    return store.transaction(()=>{
      const state=changing(user,projectId,input,fields),draft=structuredClone(state.draft);
      if(input.action==='save_requirements'){
        const next=requirements(input.requirements);if(activeItems(draft).some(item=>!next.some(entry=>entry.id===item.requirementId)))throw fail('이 종류에 담은 파일을 먼저 빼 주세요.',409);
        draft.items=draft.items.map(item=>{const before=draft.requirements.find(entry=>entry.id===item.requirementId),after=next.find(entry=>entry.id===item.requirementId);return !item.removed&&JSON.stringify(before)!==JSON.stringify(after)?{...item,confirmed:false}:item;});draft.requirements=next;
      }else if(input.action==='use_approved'||input.action==='add_link'){
        requirement(draft,input.requirementId);capacity(draft);const label=text(input.label,120,'파일 이름',true);
        const item={id:randomUUID(),requirementId:input.requirementId,deliverableItemId:deliverable(state.row,input.deliverableItemId),label,confirmed:false,source:input.action==='use_approved'?'approved':'link',createdAt:clock()};
        if(input.action==='use_approved'){
          if(!state.approved.media&&!state.approved.url)throw fail('승인한 시안에 파일이나 링크가 없어요.',409);
          if(state.approved.media&&!MIME_KINDS[state.approved.media.mimeType])throw fail('승인한 시안의 파일 형식이 맞지 않아요.',415);
          if(activeItems(draft).some(entry=>entry.source==='approved'&&entry.requirementId===item.requirementId))throw fail('이 종류에 승인한 시안을 이미 담았어요.',409);
          item.versionId=state.approved.id;if(state.approved.media)item.media=structuredClone(state.approved.media);if(state.approved.url)item.url=https(state.approved.url);
        }else{item.url=https(input.url);if(activeItems(draft).some(entry=>entry.requirementId===item.requirementId&&entry.url===item.url))throw fail('이 종류에 같은 링크를 이미 담았어요.',409);}
        draft.items.push(item);
      }else if(input.action==='update_item'||input.action==='remove_item'){
        const item=activeItems(draft).find(entry=>entry.id===input.itemId);if(!item)throw fail('그 파일을 찾지 못했어요.',404);
        if(input.action==='remove_item'){item.removed=true;item.removedAt=clock();item.confirmed=false;}
        else{if(input.label===undefined&&input.confirmed===undefined&&input.deliverableItemId===undefined)throw fail('바꿀 내용(이름·규격 연결·확인)이 비어 있어요.');if(input.label!==undefined){item.label=text(input.label,120,'파일 이름',true);item.confirmed=false;}if(input.deliverableItemId!==undefined){const next=deliverable(state.row,input.deliverableItemId);if(next!==(item.deliverableItemId||'')){item.deliverableItemId=next;item.confirmed=false;}}if(input.confirmed!==undefined){if(typeof input.confirmed!=='boolean')throw fail('확인 여부가 이상해요.');if(input.confirmed&&!typeMatches(item,requirement(draft,item.requirementId)))throw fail('파일 형식과 종류를 먼저 맞춰 주세요.',409);const inspection=store.get(CHECK_KIND,key(state.row.id,state.approved.id)),report=buildDeliveryCheck(state.row,draft,{inspection}),token=deliveryItemConfirmationKey(state.row,draft,item,inspection);if(input.confirmed&&report.confirmed&&input.confirmationToken!==token)throw fail('납품 규격이나 검사 결과가 바뀌었어요. 다시 본 뒤에 표시해 주세요.',409);item.confirmed=input.confirmed;if(input.confirmed)item.confirmationToken=token;else delete item.confirmationToken;}}
      }else if(input.action==='save_guide'){draft.guide=text(input.guide,3000,'사용 안내');draft.guideEdited=true;}
      else if(input.action==='publish'){
        if(input.confirmed!==true)throw fail('고객에게 보일지 확인 표시가 비어 있어요.');
        const view=inspect(state);if(!view.canPublish)throw fail('꼭 주는 파일을 담고 열어 본 뒤, 사용 안내를 적어 주세요.',409);
        const ids=[];for(const item of activeItems(draft)){const currentRow=clientProjects.project(state.user,projectId,true);if(latestPreview(currentRow)?.id!==state.approved.id||!latestPreview(currentRow)?.approvedAt)throw fail('승인한 시안이 바뀌었어요. 다시 봐 주세요.',409);const result=clientProjects.addVersion(state.user,projectId,{revision:currentRow.revision,kind:'final',label:item.label,url:item.url||'',guide:view.guide},item.media||null);ids.push(result.project.versions.at(-1).id);}
        draft.deliveredVersionIds=ids;draft.publishedAt=clock();draft.publishedBy=state.user.id;
      }
      return persist(state,draft);
    });
  }
  function assertUpload(user,projectId,input){if(input?.action!==undefined&&input.action!=='add_upload')throw fail('올리기 요청이 이상해요.');const state=changing(user,projectId,input,['requirementId','label','deliverableItemId']);requirement(state.draft,input.requirementId);deliverable(state.row,input.deliverableItemId);capacity(state.draft);text(input.label,120,'파일 이름',true);return get(state.user,projectId);}
  function trustedMedia(metadata){
    object(metadata);const {id,diskName,mimeType,fileName,byteSize}=metadata,extension=MIME_EXTENSIONS[mimeType];
    if(typeof id!=='string'||!/^[a-f0-9-]{36}$/i.test(id)||!extension||diskName!==id+'.'+extension||!Number.isSafeInteger(byteSize)||byteSize<=0||byteSize>(MIME_KINDS[mimeType]==='subtitle'?256*1024:100*1024*1024))throw fail('저장한 파일 정보가 이상해요.',415);
    return {id,diskName,mimeType,fileName:text(fileName,200,'원본 파일 이름',true),byteSize};
  }
  function addUpload(user,projectId,input,metadata){return store.transaction(()=>{assertUpload(user,projectId,input);const state=changing(user,projectId,input,['requirementId','label','deliverableItemId']),draft=structuredClone(state.draft),media=trustedMedia(metadata);if(store.all(DOCUMENT_KIND).some(row=>row.items.some(item=>item.media?.id===media.id))||store.all('clientProjects').some(row=>row.versions.some(version=>version.media?.id===media.id)))throw fail('이미 담은 파일이에요.',409);draft.items.push({id:randomUUID(),requirementId:input.requirementId,deliverableItemId:deliverable(state.row,input.deliverableItemId),label:text(input.label,120,'파일 이름',true),confirmed:false,source:'upload',media,createdAt:clock()});return persist(state,draft);});}
  function mediaFor(user,projectId,mediaId){const state=readState(user,projectId);const media=state.approved?.media?.id===mediaId?state.approved.media:activeItems(state.draft).find(item=>item.media?.id===mediaId)?.media;if(!media)throw fail('그 파일을 찾지 못했어요.',404);return media;}
  async function refreshChecks(user,projectId,{authorize=()=>{}}={}){
    await authorize();const state=readState(user,projectId),spec=state.row.studio?.deliverables;
    if(!state.approved||!spec?.items?.length||spec.confirmation?.deliverableRevision!==spec.revision||state.row.stage==='archived'||state.delivered.length&&!activeItems(state.draft).length)return inspect(state);
    const fingerprint=deliveryCheckFingerprint(state.row,state.draft),results={};
    for(const media of deliveryCheckMedia(state.draft))results[media.id]=fileInspector?await fileInspector.inspect(media):{status:'unavailable',code:'probe_unavailable',message:'검사 도구를 쓸 수 없어요. 파일을 열어 직접 봐 주세요.'};
    await authorize();return store.transaction(()=>{const latest=readState(user,projectId);if(state.row.revision!==latest.row.revision||state.draft.draftRevision!==latest.draft.draftRevision||fingerprint!==deliveryCheckFingerprint(latest.row,latest.draft))throw fail('검사하는 사이 바뀐 게 있어요. 새로 불러온 뒤 다시 해 주세요.',409);store.put(CHECK_KIND,key(latest.row.id,latest.approved.id),{schema:1,projectId:latest.row.id,approvedPreviewId:latest.approved.id,fingerprint,checkedAt:clock(),results});return inspect(latest);});
  }
  async function check(user,projectId,input,options={}){
    exact(input,['projectRevision','draftRevision','approvedPreviewId']);const state=readState(user,projectId);clientProjects.project(state.user,projectId,true);
    if(!state.approved||!validRevision(input.projectRevision)||!validRevision(input.draftRevision)||input.projectRevision!==state.row.revision||input.draftRevision!==state.draft.draftRevision||input.approvedPreviewId!==state.approved.id)throw fail('그사이 바뀐 게 있어요. 새로 불러온 뒤 다시 해 주세요.',409);
    if(state.row.stage==='archived')throw fail('보관한 프로젝트는 검사를 다시 돌릴 수 없어요.',409);
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
          const authorize=()=>{const currentOwner=current(owner),currentRow=clientProjects.project(currentOwner,row.id);if(currentOwner.role==='viewer'||currentRow.ownerId!==owner.id||currentRow.stage==='archived')throw fail('검사 대상이 바뀌었어요.',403);};
          await refreshChecks(owner,row.id,{authorize});checked++;report('success');
        }catch(error){if([401,403,404,409].includes(error.status))report('skipped');else{failed++;report('error');}}
      }
      return {checked,failed};
    })().finally(()=>{scanning=null;});
    return scanning;
  }
  return {get,mutate,assertUpload,addUpload,mediaFor,refreshChecks,check,scanChecks};
}
