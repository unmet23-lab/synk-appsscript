import {randomUUID} from 'node:crypto';
import {canReadChannel} from './organization.mjs';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const stages=new Set(['idea','making','review','ready','published','archived']);
const axes=new Set(['general','fun','usefulness','authenticity','personalization']);
const object=value=>{if(!value||typeof value!=='object'||Array.isArray(value))throw fail('입력 형식을 확인해 주세요.');return value;};
function text(value,max,label,required=false){if(value==null&&!required)return '';if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw fail(`${label}: ${max}자 이하로 입력해 주세요.`);const result=value.trim();if(required&&!result)throw fail(`${label}을 입력해 주세요.`);return result;}
function https(value){if(value==null||value==='')return null;const raw=text(value,2048,'주소',true);let url;try{url=new URL(raw);}catch{throw fail('HTTPS 주소를 입력해 주세요.');}if(url.protocol!=='https:'||url.username||url.password)throw fail('자격증명이 없는 HTTPS 주소만 사용할 수 있습니다.');return url.href;}
function date(value){if(value==null||value==='')return null;const match=typeof value==='string'&&/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);if(!match||+match[2]<1||+match[2]>12||+match[3]<1||+match[3]>new Date(Date.UTC(+match[1],+match[2],0)).getUTCDate())throw fail('기한을 YYYY-MM-DD 날짜로 입력해 주세요.');return value;}

export function createStudioService({store,clock=()=>new Date().toISOString()}){
  const sameTeam=(user,row)=>!!user.teamId&&user.teamId===row.teamId;
  const manager=(user,row)=>user.role==='manager'&&sameTeam(user,row);
  const name=id=>id?(store.get('users',id)?.name||'이전 담당자'):null;
  function current(user){const result=user?.id&&store.get('users',user.id);if(!result?.active)throw fail('먼저 로그인해 주세요.',401);return result;}
  function writable(user){user=current(user);if(user.role==='viewer')throw fail('열람 계정은 제작 자료를 변경할 수 없습니다.',403);return user;}
  function productionRead(user,row){return user.role==='admin'||[row.ownerId,row.assigneeId,row.reviewerId].includes(user.id)||sameTeam(user,row);}
  function productionEdit(user,row){return user.role!=='viewer'&&(user.role==='admin'||[row.ownerId,row.assigneeId].includes(user.id)||manager(user,row));}
  function productionComment(user,row){return user.role!=='viewer'&&(productionEdit(user,row)||row.reviewerId===user.id);}
  function productionFor(user,id){const row=store.get('studioProductions',text(id,100,'제작 ID',true));if(!row||!productionRead(user,row))throw fail('제작 건을 찾을 수 없습니다.',404);return row;}
  function assertEditable(user,id){user=writable(user);const row=productionFor(user,id);if(!productionEdit(user,row))throw fail('이 제작 건을 수정할 권한이 없습니다.',403);return row;}
  function assignable(user){return store.all('users').filter(person=>person.active&&person.role!=='viewer'&&(user.role==='admin'||person.id===user.id||sameTeam(user,person))).map(({id,name,role,teamId})=>({id,name,role,teamId:teamId||null}));}
  function assigned(user,id,label){if(id==null||id==='')return null;id=text(id,100,label,true);if(!assignable(user).some(person=>person.id===id))throw fail('활성 상태인 같은 팀의 크루를 선택해 주세요.',403);return id;}
  function team(user,id){if(id==null||id==='')return null;id=text(id,100,'팀',true);if(!store.get('teams',id)?.active||user.role!=='admin'&&user.teamId!==id)throw fail('공유할 수 있는 활성 팀을 선택해 주세요.',403);return id;}
  function draftReadable(user,id){if(!id)return false;const draft=store.get('contentDrafts',id);if(!draft)return false;if(user.role==='admin'||draft.ownerId===user.id)return true;if(!draft.channelId||!['manager','viewer'].includes(user.role)||!user.teamId)return false;const channel=store.get('channels',draft.channelId);return !!channel&&channel.teamId===user.teamId&&canReadChannel(user,channel);}
  function draftLink(user,id){if(id==null||id==='')return null;id=text(id,100,'기획안',true);if(!draftReadable(user,id))throw fail('읽을 수 있는 기획안을 선택해 주세요.',404);return id;}
  function permissions(user,row){const canReadDraft=draftReadable(user,row.draftId);return {canEdit:productionEdit(user,row),canComment:productionComment(user,row),canPublishExample:(user.role==='admin'||manager(user,row))&&['ready','published'].includes(row.stage),canOpenDraft:canReadDraft,canReadDraft};}
  function summary(user,row){const {versions,notes,...fields}=row,access=permissions(user,row);return {...fields,draftId:access.canReadDraft?row.draftId:null,ownerName:name(row.ownerId),assigneeName:name(row.assigneeId),reviewerName:name(row.reviewerId),versionCount:row.versionCount??versions?.length??0,openNotes:row.openNotes??notes?.filter(note=>!note.resolved).length??0,...access};}
  function full(user,row){return {...summary(user,row),versions:(row.versions||[]).map(version=>({...version,url:version.mediaId?'/api/studio-media/'+encodeURIComponent(version.mediaId):version.url})),notes:(row.notes||[]).map(note=>({...note,ownerName:name(note.ownerId),canResolve:user.role!=='viewer'&&(note.ownerId===user.id||productionEdit(user,row))}))};}
  function production(user,id){user=current(user);return {production:full(user,productionFor(user,id))};}
  function saveProduction(user,input,id=null){
    user=writable(user);object(input);const old=id?assertEditable(user,id):null,at=clock();
    const row=old?{...old}:{id:randomUUID(),ownerId:user.id,assigneeId:user.id,reviewerId:null,teamId:null,draftId:null,stage:'idea',nextAction:'',blocker:'',dueDate:null,createdAt:at,versions:[],notes:[]};
    if(!old||input.title!==undefined)row.title=text(input.title,200,'제목',true);
    for(const key of ['nextAction','blocker'])if(input[key]!==undefined)row[key]=text(input[key],1000,key==='nextAction'?'다음 행동':'막힌 점');
    if(input.stage!==undefined){if(!stages.has(input.stage))throw fail('제작 단계를 확인해 주세요.');row.stage=input.stage;}
    if(input.assigneeId!==undefined&&(input.assigneeId||null)!==row.assigneeId)row.assigneeId=assigned(user,input.assigneeId,'담당자');
    if(input.reviewerId!==undefined&&(input.reviewerId||null)!==row.reviewerId)row.reviewerId=assigned(user,input.reviewerId,'검토자');
    if(input.teamId!==undefined&&(input.teamId||null)!==row.teamId)row.teamId=team(user,input.teamId);
    if(input.draftId!==undefined&&(input.draftId||null)!==row.draftId)row.draftId=draftLink(user,input.draftId);
    if(input.dueDate!==undefined)row.dueDate=date(input.dueDate);
    row.updatedAt=at;store.put('studioProductions',row.id,row);return {production:full(user,row)};
  }
  function addVersion(user,id,input){
    user=writable(user);object(input);const row=assertEditable(user,id),kind=input.kind;
    if(!['video','image','text','link'].includes(kind))throw fail('버전 종류를 확인해 주세요.');
    const version={id:randomUUID(),label:text(input.label,100,'버전 이름',true),kind,createdAt:clock(),createdById:user.id,createdByName:name(user.id)};
    if(kind==='text')version.text=text(input.text,20000,'검토할 원고',true);else{version.url=https(input.url);if(!version.url)throw fail('검토할 HTTPS 주소를 입력해 주세요.');}
    return appendVersion(user,row,version);
  }
  function appendVersion(user,row,version,media=null){
    if((row.versions||[]).length>=100)throw fail('한 제작 건에 최대 100개 버전을 보관할 수 있습니다.',409);
    const updated={...row,versions:[...(row.versions||[]),version],updatedAt:clock()};
    store.transaction(()=>{if(media)store.put('studioMedia',media.id,media);store.put('studioProductions',row.id,updated);});
    return {production:full(user,updated)};
  }
  function addMedia(user,id,media,label){
    user=writable(user);const row=assertEditable(user,id);
    const version={id:randomUUID(),label:text(label,100,'버전 이름',true),kind:media.mimeType.startsWith('video/')?'video':'image',mediaId:media.id,url:'/api/studio-media/'+media.id,mimeType:media.mimeType,fileName:media.fileName,byteSize:media.byteSize,createdAt:clock(),createdById:user.id,createdByName:name(user.id)};
    return appendVersion(user,row,version,{...media,productionId:id,createdAt:clock(),createdById:user.id});
  }
  function addNote(user,id,input){
    user=writable(user);object(input);const row=productionFor(user,id);if(!productionComment(user,row))throw fail('지정 검토자 또는 제작 담당자만 의견을 남길 수 있습니다.',403);
    const versionId=text(input.versionId,100,'버전',true),version=row.versions.find(item=>item.id===versionId);if(!version)throw fail('이 제작 건의 버전을 선택해 주세요.',404);
    const axis=input.axis??'general';if(!axes.has(axis))throw fail('검토 기준을 확인해 주세요.');
    const atSeconds=input.atSeconds??null;if(atSeconds!==null&&(version.kind!=='video'||typeof atSeconds!=='number'||!Number.isFinite(atSeconds)||atSeconds<0||atSeconds>86400))throw fail('영상에만 0~86400초 범위의 시간 메모를 남길 수 있습니다.');
    if(row.notes.length>=1000)throw fail('한 제작 건에 최대 1000개 의견을 남길 수 있습니다.',409);
    const note={id:randomUUID(),versionId,text:text(input.text,2000,'검토 의견',true),axis,atSeconds,resolved:false,ownerId:user.id,ownerName:name(user.id),createdAt:clock(),resolvedAt:null,resolvedById:null};
    const updated={...row,notes:[...row.notes,note],updatedAt:clock()};store.put('studioProductions',id,updated);return {production:full(user,updated)};
  }
  function resolveNote(user,id,noteId,input){
    user=writable(user);object(input);const row=productionFor(user,id),note=row.notes.find(item=>item.id===noteId);if(!note)throw fail('검토 의견을 찾을 수 없습니다.',404);
    if(note.ownerId!==user.id&&!productionEdit(user,row))throw fail('의견 작성자 또는 제작 담당자만 처리 상태를 바꿀 수 있습니다.',403);
    if(typeof input.resolved!=='boolean')throw fail('의견 처리 상태를 확인해 주세요.');
    const updated={...row,updatedAt:clock(),notes:row.notes.map(item=>item.id===noteId?{...item,resolved:input.resolved,resolvedAt:input.resolved?clock():null,resolvedById:input.resolved?user.id:null}:item)};
    store.put('studioProductions',id,updated);return {production:full(user,updated)};
  }
  function materialRead(user,row){return row.ownerId===user.id||user.role==='admin'||row.visibility==='company'||row.visibility==='team'&&sameTeam(user,row);}
  function materialEdit(user,row){return user.role!=='viewer'&&(row.ownerId===user.id||user.role==='admin'||row.visibility==='team'&&manager(user,row));}
  function materialView(user,row){return {...row,ownerName:name(row.ownerId),canEdit:materialEdit(user,row)};}
  function saveMaterial(user,input,id=null){
    user=writable(user);object(input);const old=id?store.get('studioMaterials',text(id,100,'소재 ID',true)):null;
    if(id&&(!old||!materialRead(user,old)))throw fail('소재를 찾을 수 없습니다.',404);
    if(old&&!materialEdit(user,old))throw fail('이 소재를 수정할 권한이 없습니다.',403);
    const row=old?{...old}:{id:randomUUID(),ownerId:user.id,kind:'experience',body:'',sourceUrl:null,tags:[],visibility:'private',teamId:null,status:'active',createdAt:clock()};
    if(!old||input.title!==undefined)row.title=text(input.title,200,'소재 제목',true);
    if(input.body!==undefined)row.body=text(input.body,5000,'소재 내용');
    if(input.kind!==undefined){if(!['experience','question','discovery','reference'].includes(input.kind))throw fail('소재 종류를 확인해 주세요.');row.kind=input.kind;}
    if(input.status!==undefined){if(!['active','archived'].includes(input.status))throw fail('소재 상태를 확인해 주세요.');row.status=input.status;}
    if(input.sourceUrl!==undefined)row.sourceUrl=https(input.sourceUrl);
    if(input.tags!==undefined){if(!Array.isArray(input.tags)||input.tags.length>8)throw fail('태그는 최대 8개입니다.');row.tags=[...new Set(input.tags.map(tag=>text(tag,40,'태그',true)))];}
    if(input.visibility!==undefined){if(!['private','team','company'].includes(input.visibility))throw fail('소재 공개 범위를 확인해 주세요.');row.visibility=input.visibility;}
    if(row.visibility==='company'&&old?.visibility!=='company'&&input.shareConfirmed!==true)throw fail('소재를 회사 전체에 공유할지 확인해 주세요.');
    if(row.visibility==='team'){const desired=input.teamId===undefined?row.teamId:input.teamId;if(!old||old.visibility!=='team'||desired!==old.teamId)row.teamId=team(user,desired);if(!row.teamId)throw fail('공유할 팀을 선택해 주세요.');}else row.teamId=null;
    row.updatedAt=clock();store.put('studioMaterials',row.id,row);return {material:materialView(user,row)};
  }
  function exampleView(user,row){const {productionId,publisherId,...safe}=row;return {...safe,canArchive:user.role==='admin'||user.role==='manager'&&publisherId===user.id,version:{...safe.version,url:safe.version.mediaId?'/api/studio-media/'+safe.version.mediaId:safe.version.url}};}
  function publishExample(user,input){
    user=writable(user);object(input);const row=productionFor(user,input.productionId);
    if(!permissions(user,row).canPublishExample)throw fail('관리자 또는 현재 담당 팀장만 제작 준비·게시 단계의 완성본을 공유할 수 있습니다.',403);
    if(input.shareConfirmed!==true)throw fail('선택한 완성본과 설명을 회사 전체에 공유할지 확인해 주세요.');
    const version=row.versions.find(item=>item.id===input.versionId);if(!version)throw fail('공유할 버전을 선택해 주세요.',404);
    const axis=input.axis??'general';if(!axes.has(axis))throw fail('예시의 기준을 확인해 주세요.');
    // Copy only the chosen deliverable. Notes, other versions and private production fields never enter examples.
    const selected=Object.fromEntries(['id','label','kind','url','text','mediaId','mimeType','fileName','byteSize','createdAt'].filter(key=>version[key]!==undefined).map(key=>[key,version[key]]));
    const example={id:randomUUID(),productionId:row.id,publisherId:user.id,title:text(input.title,200,'예시 제목',true),whyGood:text(input.whyGood,2000,'좋은 이유',true),lesson:text(input.lesson,2000,'다음 제작에서 배울 점',true),axis,version:selected,ownerName:name(user.id),createdAt:clock(),archived:false};
    store.put('studioExamples',example.id,example);return {example:exampleView(user,example)};
  }
  function examples(user){
    user=current(user);
    return {examples:store.all('studioExamples').filter(row=>!row.archived).map(row=>exampleView(user,row)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),canCreate:['admin','manager'].includes(user.role)};
  }
  function publishDirectExample(user,input){
    user=writable(user);object(input);
    if(!['admin','manager'].includes(user.role))throw fail('관리자 또는 팀장만 회사 예시를 등록할 수 있습니다.',403);
    if(input.shareConfirmed!==true)throw fail('원문과 설명을 회사 전체에 공유할지 확인해 주세요.');
    if(!['text','link'].includes(input.kind))throw fail('글 또는 링크를 선택해 주세요.');
    const axis=input.axis??'general';if(!axes.has(axis))throw fail('예시의 기준을 확인해 주세요.');
    const createdAt=clock(),version={id:randomUUID(),label:'등록한 원문',kind:input.kind,createdAt};
    if(input.kind==='text')version.text=text(input.text,20000,'원문',true);
    else{version.url=https(input.url);if(!version.url)throw fail('원문의 HTTPS 주소를 입력해 주세요.');}
    const example={id:randomUUID(),publisherId:user.id,title:text(input.title,200,'예시 제목',true),whyGood:text(input.whyGood,2000,'좋은 이유',true),lesson:text(input.lesson,2000,'다음 제작에서 배울 점',true),axis,version,ownerName:name(user.id),createdAt,archived:false};
    store.put('studioExamples',example.id,example);return {example:exampleView(user,example)};
  }
  function archiveExample(user,id,input){
    user=writable(user);object(input);const row=store.get('studioExamples',text(id,100,'예시 ID',true));if(!row)throw fail('예시를 찾을 수 없습니다.',404);
    if(user.role!=='admin'&&!(user.role==='manager'&&row.publisherId===user.id))throw fail('관리자 또는 이 예시를 등록한 팀장만 보관할 수 있습니다.',403);
    if(input.archived!==true)throw fail('예시 보관 요청을 확인해 주세요.');const updated={...row,archived:true,archivedAt:clock()};store.put('studioExamples',id,updated);return {example:exampleView(user,updated)};
  }
  function readableMedia(user,id){
    user=current(user);const media=store.get('studioMedia',text(id,100,'미디어 ID',true));if(!media)throw fail('미디어를 찾을 수 없습니다.',404);
    const row=store.get('studioProductions',media.productionId),ownAccess=row&&productionRead(user,row);
    const shared=store.all('studioExamples').some(example=>!example.archived&&example.version.mediaId===id);
    if(!ownAccess&&!shared)throw fail('미디어를 찾을 수 없습니다.',404);return media;
  }
  function workspace(user){
    user=current(user);
    const list=store.db.prepare(`SELECT id,
      json_extract(body,'$.title') AS title, json_extract(body,'$.ownerId') AS ownerId,
      json_extract(body,'$.assigneeId') AS assigneeId,json_extract(body,'$.reviewerId') AS reviewerId,
      json_extract(body,'$.teamId') AS teamId,json_extract(body,'$.draftId') AS draftId,
      json_extract(body,'$.stage') AS stage,json_extract(body,'$.nextAction') AS nextAction,
      json_extract(body,'$.blocker') AS blocker,json_extract(body,'$.dueDate') AS dueDate,
      json_extract(body,'$.createdAt') AS createdAt,json_extract(body,'$.updatedAt') AS updatedAt,
      json_array_length(body,'$.versions') AS versionCount,
      (SELECT COUNT(*) FROM json_each(documents.body,'$.notes') WHERE json_extract(value,'$.resolved')!=1) AS openNotes
      FROM documents WHERE kind='studioProductions' ORDER BY json_extract(body,'$.updatedAt') DESC`).all();
    return {productions:list.filter(row=>productionRead(user,row)).map(row=>summary(user,row)),materials:store.all('studioMaterials').filter(row=>materialRead(user,row)).map(row=>materialView(user,row)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)),examples:store.all('studioExamples').filter(row=>!row.archived).map(row=>exampleView(user,row)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),assignableMembers:assignable(user),assignableTeams:store.all('teams').filter(row=>row.active&&(user.role==='admin'||row.id===user.teamId)).map(({id,name})=>({id,name}))};
  }
  return {workspace,production,saveProduction,saveMaterial,addVersion,addMedia,addNote,resolveNote,publishExample,examples,publishDirectExample,archiveExample,readableMedia,assertEditable};
}
