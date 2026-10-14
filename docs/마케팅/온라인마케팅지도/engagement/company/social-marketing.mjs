import {randomUUID,createHash} from 'node:crypto';
import {readFile,lstat,realpath} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {canReadChannel,canWriteChannel,canManageOwners,visibleMembers} from './organization.mjs';
import {validMediaSignature,STUDIO_MEDIA_LIMIT} from './studio-media.mjs';
import {inboxReplyState} from './social-reply-observations.mjs';

const run=promisify(execFile),fail=(message,status=400)=>Object.assign(new Error(message),{status});
const clean=(value,max=200)=>{if(value==null)return '';if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))throw fail('입력 길이와 문자를 확인해 주세요.');return value.trim();};
function href(value){if(!value)return '';let u;try{u=new URL(clean(value,2048));}catch{throw fail('원문 주소를 확인해 주세요.');}if(u.protocol!=='https:'||u.username||u.password)throw fail('원문 주소는 자격증명 없는 HTTPS 주소로 입력해 주세요.');return u.href;}
function date(value){
  if(value==null||value==='')return null;
  const v=clean(value,40),m=/^(\d{4})-(\d{2})-(\d{2})(?:T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d))?$/.exec(v);
  if(!m||!Number.isFinite(Date.parse(v)))throw fail('날짜와 시간대를 확인해 주세요.');
  const year=Number(m[1]),month=Number(m[2]),day=Number(m[3]),leap=year%4===0&&(year%100!==0||year%400===0);
  if(month<1||month>12||day<1||day>[31,leap?29:28,31,30,31,30,31,31,30,31,30,31][month-1])throw fail('실제로 존재하는 날짜를 입력해 주세요.');
  return v;
}
function zone(value){const v=clean(value||'Asia/Seoul',80);try{new Intl.DateTimeFormat('en',{timeZone:v}).format();}catch{throw fail('시간대를 확인해 주세요.');}return v;}
const digest=value=>createHash('sha256').update(value).digest('hex');
const safeAsset=row=>({...Object.fromEntries(['id','fileName','mimeType','byteSize','width','height','duration','sha256','createdAt','inspection','type','alt'].filter(key=>row[key]!==undefined).map(key=>[key,row[key]])),name:row.fileName||row.name,url:'/api/social/media/'+encodeURIComponent(row.id)});
const isNumber=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
const attention=new Set(['failed','blocked','unknown','missed','manual','manual_required','manual-required','reconnect_required']);

export function createSocialMarketingService({store,studio,publicationPackages,clientProjects,performance,clock=()=>new Date().toISOString(),ffprobe=process.env.SYNK_FFPROBE_EXE||'ffprobe'}={}){
  function current(user,write=false){const u=store.get('users',user?.id);if(!u?.active||!['admin','manager','member','viewer'].includes(u.role))throw fail('먼저 로그인해 주세요.',401);if(write&&u.role==='viewer')throw fail('열람 계정에서는 바꿀 수 없어요.',403);return u;}
  function channel(user,id,write=false){const u=current(user,write),c=store.get('channels',id);if(!c||c.active===false||c.hidden===true||!(write?canWriteChannel:canReadChannel)(u,c))throw fail('접근할 수 있는 SNS 계정을 선택해 주세요.',403);return c;}
  function accounts(user){user=current(user);return store.all('channels').filter(c=>c.active!==false&&c.hidden!==true&&canReadChannel(user,c)).map(c=>({id:c.id,name:c.displayName||c.handle||c.platform,displayName:c.displayName,platform:c.platform,handle:c.handle||'',canonicalUrl:c.canonicalUrl||'',ownerIds:c.ownerIds||[],teamId:c.teamId||null,brand:c.brandId||'',brandId:c.brandId||'',language:c.language||'ko',timeZone:c.timeZone||'Asia/Seoul',category:c.category||'',campaign:c.campaignId||'',campaignId:c.campaignId||'',canEdit:canWriteChannel(user,c),collectionStatus:c.status||'not-connected'}));}
  function saveAccount(user,id,input={}){const c=channel(user,id,true);const changes={brandId:clean(input.brandId??input.brand??c.brandId,100),language:clean(input.language??c.language??'ko',30),timeZone:zone(input.timeZone??c.timeZone),category:clean(input.category??c.category,100),campaignId:clean(input.campaignId??input.campaign??c.campaignId,100)};if(changes.campaignId)readCampaign(user,changes.campaignId);store.put('channels',id,{...c,...changes});return {account:accounts(user).find(x=>x.id===id)};}
  function readableCampaign(user,row){return row.channelIds?.length?row.channelIds.every(id=>{const c=store.get('channels',id);return c&&c.active!==false&&c.hidden!==true&&canReadChannel(user,c);}):row.ownerId===user.id||user.role==='admin';}
  function readCampaign(user,id,write=false){user=current(user,write);const c=store.get('socialCampaigns',id);if(!c||!readableCampaign(user,c)||(write&&c.channelIds.some(id=>!canWriteChannel(user,store.get('channels',id)))))throw fail('캠페인 접근 권한을 확인해 주세요.',403);return c;}
  function campaigns(user){user=current(user);return store.all('socialCampaigns').filter(c=>readableCampaign(user,c)).map(c=>({...c,canEdit:user.role!=='viewer'&&c.channelIds.every(id=>canWriteChannel(user,store.get('channels',id)))}));}
  function saveCampaign(user,input={},id){user=current(user,true);const old=id?readCampaign(user,id,true):null;if(old&&input.revision!==old.revision)throw fail('다른 사람이 캠페인을 먼저 수정했어요. 새로고침해 주세요.',409);const ids=input.channelIds??old?.channelIds??[];if(!Array.isArray(ids)||ids.length>100)throw fail('캠페인 계정 목록을 확인해 주세요.');const channelIds=[...new Set(ids)];channelIds.forEach(id=>channel(user,id,true));const name=clean(input.name??old?.name,120);if(!name)throw fail('캠페인 이름을 입력해 주세요.');const startAt=date(input.startAt??old?.startAt),endAt=date(input.endAt??old?.endAt);if(startAt&&endAt&&Date.parse(startAt)>Date.parse(endAt))throw fail('캠페인 종료일은 시작일 이후로 정해 주세요.');const row={id:old?.id||randomUUID(),revision:(old?.revision||0)+1,ownerId:old?.ownerId||user.id,name,goal:clean(input.goal??old?.goal,1000),channelIds,startAt,endAt,language:clean(input.language??old?.language,30),purpose:clean(input.purpose??old?.purpose,300),createdAt:old?.createdAt||clock(),updatedAt:clock()};store.put('socialCampaigns',row.id,row);return {campaign:row};}
  function inbox(user){user=current(user);return store.all('socialInbox').filter(row=>{const c=store.get('channels',row.channelId);return c&&c.active!==false&&c.hidden!==true&&canReadChannel(user,c);}).map(row=>{const c=store.get('channels',row.channelId),{metaReplyProofIds,metaReplyCompleteAt,metaAccountReply,...publicRow}=row;return {...publicRow,...inboxReplyState(row,c),canEdit:canWriteChannel(user,c)};}).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));}
  function saveInbox(user,input={},id){
    user=current(user,true);
    const old=id?store.get('socialInbox',id):null;if(id&&!old)throw fail('문의 기록을 찾을 수 없어요.',404);
    const c=channel(user,old?.channelId||input.channelId,true);
    if(old&&input.revision!==old.revision)throw fail('다른 사람이 문의를 먼저 수정했어요. 새로고침해 주세요.',409);
    if(old&&input.channelId&&input.channelId!==old.channelId)throw fail('문의가 들어온 계정은 바꿀 수 없어요.');
    const imported=old?.source&&old.source!=='manual';
    if(imported&&['text','author','url','kind','postId'].some(key=>input[key]!=null&&input[key]!==old[key]))throw fail('수집한 문의 원문은 바꿀 수 없어요. 담당자·처리 상태·답변 초안만 고쳐 주세요.');
    const assigneeId=clean(input.assigneeId??old?.assigneeId??user.id,100),assignee=store.get('users',assigneeId);
    if(!assignee?.active||!canWriteChannel(assignee,c))throw fail('이 계정을 담당할 수 있는 크루를 선택해 주세요.');
    const status=input.status??old?.status??'open';if(!['open','assigned','resolved'].includes(status))throw fail('문의 상태를 확인해 주세요.');
    const kind=input.kind??old?.kind??'comment';if(!['comment','message','mention'].includes(kind))throw fail('문의 종류를 확인해 주세요.');
    const text=clean(input.text??old?.text,10000);if(!text)throw fail('문의 내용을 입력해 주세요.');
    const postId=clean(input.postId??old?.postId,100);
    if(postId&&!imported){const post=store.get('socialPosts',postId);if(!post?.variants?.some(v=>v.channelId===c.id)||!post.variants.every(v=>{const target=store.get('channels',v.channelId);return target&&target.active!==false&&!target.hidden&&canReadChannel(user,target);}))throw fail('접근 가능한 이 계정의 게시물을 연결해 주세요.');}
    const row={...old,id:old?.id||randomUUID(),revision:(old?.revision||0)+1,channelId:c.id,postId,kind,author:clean(input.author??old?.author,120),text,url:href(input.url??old?.url),status,assigneeId,replyDraft:clean(input.replyDraft??old?.replyDraft,10000),source:old?.source||'manual',outboundSent:old?.outboundSent===true,createdBy:old?.createdBy||user.id,createdAt:old?.createdAt||clock(),updatedAt:clock()};
    store.put('socialInbox',row.id,row);return {item:row};
  }
  function clientReference(user,id){
    const stored=store.all('clientProjects').find(p=>p.versions?.some(v=>v.media?.id===id));
    if(!stored)return null;
    if(!clientProjects)throw fail('고객 프로젝트 원본을 불러오지 못했어요.',409);
    const project=clientProjects.project(current(user),stored.id),preview=project.versions.filter(v=>v.kind==='preview').at(-1),version=project.versions.find(v=>v.media?.id===id);
    if(project.stage==='archived'||!preview?.approvedAt||version?.kind!=='final'||version.approvedPreviewId!==preview.id)throw fail('고객이 승인한 최신 시안의 최종 미디어만 쓸 수 있어요.',409);
    return {media:version.media,source:{clientProjectId:project.id,clientVersionId:version.id,clientApprovalId:preview.id}};
  }
  function ownMedia(user,id){
    user=current(user);
    const client=clientReference(user,id);if(client)return client.media;
    const media=store.get('socialMedia',id);
    if(media){if(media.ownerId!==user.id&&user.role!=='admin'&&!(user.role==='manager'&&user.teamId&&user.teamId===media.teamId))throw fail('미디어 접근 권한을 확인해 주세요.',403);return media;}
    if(studio){try{return studio.readableMedia(user,id);}catch(error){if(![403,404].includes(error.status))throw error;}}
    throw fail('미디어를 찾을 수 없어요.',404);
  }
  function references(post){
    if(!post||typeof post!=='object'||Array.isArray(post))throw fail('게시물 입력을 확인해 주세요.');
    if(post.media!=null&&!Array.isArray(post.media)||post.variants!=null&&!Array.isArray(post.variants))throw fail('미디어와 채널별 게시 목록을 확인해 주세요.');
    const refs=[...(post.media||[])];
    for(const variant of post.variants||[]){if(!variant||typeof variant!=='object'||Array.isArray(variant)||variant.media!=null&&!Array.isArray(variant.media))throw fail('채널별 미디어 목록을 확인해 주세요.');refs.push(...(variant.media||[]));}
    if(refs.some(ref=>!ref||typeof ref!=='object'||Array.isArray(ref)))throw fail('미디어 입력을 확인해 주세요.');
    return refs;
  }
  async function bytesFor(media){const root=resolve(store.directory,'studio-media');if(!/^[a-f0-9-]{36}\.(mp4|webm|png|jpg)$/.test(media.diskName||''))throw fail('미디어 경로를 확인해 주세요.',409);const path=resolve(root,media.diskName),info=await lstat(path);if(dirname(path)!==root||info.isSymbolicLink()||!info.isFile()||info.size>STUDIO_MEDIA_LIMIT||info.size!==media.byteSize||dirname(await realpath(path))!==await realpath(root))throw fail('저장된 미디어 파일이 바뀌었어요.',409);const bytes=await readFile(path);if(!validMediaSignature(media.mimeType,bytes.subarray(0,4096)))throw fail('미디어 파일 형식을 확인해 주세요.',409);if(media.sha256&&digest(bytes)!==media.sha256)throw fail('예약에 쓴 미디어가 바뀌었어요.',409);return {bytes,fileName:media.fileName,mimeType:media.mimeType};}
  async function inspect(media,{signal}={}){const data=await bytesFor(media),out={sha256:digest(data.bytes)};try{const {stdout}=await run(ffprobe,['-v','error','-protocol_whitelist','file,pipe','-show_entries','stream=codec_type,width,height:stream_tags=rotate:stream_side_data=rotation:format=duration','-of','json',resolve(store.directory,'studio-media',media.diskName)],{windowsHide:true,timeout:20000,maxBuffer:1024*1024,signal});const parsed=JSON.parse(stdout),v=parsed.streams?.find(s=>s.codec_type==='video');if(!v?.width||!v?.height)throw new Error('missing');const rotate=Number(v.side_data_list?.find(x=>x.rotation!==undefined)?.rotation??v.tags?.rotate??0);out.width=Math.abs(rotate)%180===90?v.height:v.width;out.height=Math.abs(rotate)%180===90?v.width:v.height;if(media.mimeType.startsWith('video/')){out.duration=Number(parsed.format?.duration);if(!Number.isFinite(out.duration)||out.duration<=0)throw new Error('duration');}out.inspection='verified';}catch{if(signal?.aborted)throw fail('미디어 준비가 중단됐어요.',409);throw fail('영상·이미지 규격을 읽지 못했어요. 재생되는 파일인지, 서버에 FFprobe가 설치돼 있는지 확인해 주세요.',422);}return out;}
  async function addMedia(user,metadata,{authorize=()=>user}={}){user=current(user,true);const inspected=await inspect(metadata);const live=current(authorize(),true);if(live.id!==user.id)throw fail('로그인 상태를 확인해 주세요.',401);const row={...metadata,...inspected,ownerId:user.id,teamId:live.teamId||null,createdAt:clock()};store.put('socialMedia',row.id,row);return {asset:safeAsset(row)};}
  async function prepareMedia(user,ids,{authorize=()=>user,signal}={}){
    user=current(user,true);
    if(!Array.isArray(ids)||ids.length>100)throw fail('준비할 미디어를 100개 이내로 선택해 주세요.');
    const unique=[...new Set(ids.map(id=>{const value=clean(id,150);if(!value)throw fail('미디어 ID를 확인해 주세요.');return value;}))],prepared=[];
    function authorized(){
      if(signal?.aborted)throw fail('미디어 준비가 중단됐어요.',409);
      const live=current(authorize(),true);if(live.id!==user.id)throw fail('로그인 상태를 확인해 주세요.',401);return live;
    }
    function unchanged(before,after,verified){
      if(['diskName','mimeType','byteSize'].some(key=>before[key]!==after[key])||after.sha256&&after.sha256!==verified.sha256)throw fail('준비하는 동안 원본 미디어가 바뀌었어요. 다시 시도해 주세요.',409);
    }
    for(const id of unique){
      const media=ownMedia(authorized(),id),verified=await inspect(media,{signal});
      const live=ownMedia(authorized(),id);unchanged(media,live,verified);
      // FFprobe reads the file after hashing; verify the same bytes survived that await.
      await bytesFor({...live,sha256:verified.sha256});
      unchanged(media,ownMedia(authorized(),id),verified);
      prepared.push({id,media,verified});
    }
    const result=[];
    store.transaction(()=>{
      for(const item of prepared){
        const liveUser=authorized(),live=ownMedia(liveUser,item.id);unchanged(item.media,live,item.verified);
        const metadata={...live,...item.verified,inspectedAt:clock()};
        const client=clientReference(liveUser,item.id);
        if(client){
          const project=clientProjects.project(liveUser,client.source.clientProjectId);
          const versions=project.versions.map(version=>version.id===client.source.clientVersionId?{...version,media:metadata}:version);
          store.put('clientProjects',project.id,{...project,versions});
        }else if(store.get('socialMedia',item.id))store.put('socialMedia',item.id,metadata);
        else if(store.get('studioMedia',item.id))store.put('studioMedia',item.id,metadata);
        else throw fail('원본 미디어 저장 위치를 다시 확인해 주세요.',409);
        result.push({id:item.id,assetId:item.id,url:'/api/social/media/'+encodeURIComponent(item.id),type:metadata.mimeType.startsWith('video/')?'video':'image',mimeType:metadata.mimeType,byteSize:metadata.byteSize,width:metadata.width,height:metadata.height,...(metadata.duration!==undefined?{duration:metadata.duration}:{}),sha256:metadata.sha256});
      }
    });
    return {media:result};
  }
  function assets(user){user=current(user);const items=[];for(const row of store.all('socialMedia'))try{items.push(safeAsset(ownMedia(user,row.id)));}catch(e){if(![403,404].includes(e.status))throw e;}const productionData=studio?.workspace(user);for(const p of productionData?.productions||[]){const detail=studio.production(user,p.id).production;for(const v of detail.versions||[]){if(!v.mediaId)continue;try{const media=studio.readableMedia(user,v.mediaId);if(!items.some(a=>a.id===media.id))items.push({...safeAsset(media),source:{productionId:p.id,versionId:v.id},name:(p.title||'제작물')+' · '+v.label});}catch(e){if(![403,404].includes(e.status))throw e;}}}for(const p of clientSources(user))for(const v of p.versions){if(!v.assetId||items.some(a=>a.id===v.assetId))continue;try{const media=ownMedia(user,v.assetId);items.push({...safeAsset(media),name:p.title+' · '+v.label,source:{clientProjectId:p.id,clientVersionId:v.id,clientApprovalId:v.approvedPreviewId}});}catch(error){if(![403,404].includes(error.status))throw error;}}return items.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));}
  function clientSources(user){if(!clientProjects)return [];return clientProjects.workspace(current(user)).projects.filter(p=>p.stage!=='archived').map(p=>{const preview=p.versions.filter(v=>v.kind==='preview').at(-1);return {id:p.id,title:p.title,href:'/?tab=workroom&section=clients&project='+encodeURIComponent(p.id),approvalStatus:preview?.approvedAt?'approved':'pending',versions:p.versions.filter(v=>v.kind==='final'&&v.approvedPreviewId===preview?.id&&preview?.approvedAt).map(v=>({id:v.id,label:v.label,assetId:v.media?.id||null,url:v.url||'',approvedPreviewId:preview.id,approvedAt:preview.approvedAt})),inviteActive:p.inviteActive===true,inviteExpiresAt:p.inviteExpiresAt||null};});}
  function validateSource(user,post){
    user=current(user);const refs=references(post),source=post.source||{};
    if(typeof source!=='object'||Array.isArray(source))throw fail('원본 연결 정보를 확인해 주세요.');
    if(source.productionId){
      const p=studio?.production(user,source.productionId).production;
      if(!p||p.stage==='archived'||!p.versions.some(v=>v.id===source.versionId))throw fail('현재 사용할 제작 버전을 확인해 주세요.',409);
    }
    if(source.packageId){
      const pack=publicationPackages?.get(user,source.packageId)?.package;
      if(!pack||source.productionId&&pack.productionId!==source.productionId||source.versionId&&pack.versionId!==source.versionId)throw fail('게시 묶음과 제작 원본이 일치하는지 확인해 주세요.',409);
    }
    if(source.clientProjectId){
      const p=clientProjects?.project(user,source.clientProjectId);
      if(!p||p.stage==='archived')throw fail('현재 고객 프로젝트를 확인해 주세요.',409);
      const preview=p.versions.filter(v=>v.kind==='preview').at(-1),v=p.versions.find(v=>v.id===source.clientVersionId);
      if(!preview?.approvedAt||source.clientApprovalId!==preview.id||v?.kind!=='final'||v.approvedPreviewId!==preview.id)throw fail('고객이 승인한 현재 시안과 최종본을 다시 선택해 주세요.',409);
    }
    for(const ref of refs){
      const id=ref.assetId||ref.id;if(!id)continue;
      const client=clientReference(user,id);
      if(client&&Object.entries(client.source).some(([key,value])=>source[key]!==value))throw fail('고객 최종 미디어의 승인 원본 연결을 다시 확인해 주세요.',409);
      ownMedia(user,id);
    }
    return true;
  }
  function validatePostInput(user,input){
    user=current(user,true);
    for(const ref of references(input)){
      const id=ref.assetId||ref.id;if(!id)continue;
      const client=clientReference(user,id);
      if(client){const supplied=input.source||{};if(Object.entries(client.source).some(([key,value])=>supplied[key]&&supplied[key]!==value))throw fail('고객 최종 미디어와 선택한 원본이 달라요. 원본을 다시 선택해 주세요.',409);input.source={...supplied,...client.source};}
      const row=ownMedia(user,id);
      Object.assign(ref,{assetId:row.id,id:row.id,mimeType:row.mimeType,byteSize:row.byteSize,width:row.width,height:row.height,duration:row.duration,sha256:row.sha256,url:'/api/social/media/'+encodeURIComponent(row.id)});
    }
    if(input.campaignId)readCampaign(user,input.campaignId);
    validateSource(user,input);
    return input;
  }
  async function resolveMedia(ref,{post,channel:target,job,signal}={}){
    const id=ref.assetId||ref.id;if(!id)throw fail('워크스페이스에 업로드한 미디어를 선택해 주세요.',422);
    function authorized(){
      if(signal?.aborted)throw fail('미디어 발행 준비가 중단됐어요.',409);
      const owner=current({id:post?.ownerId});if(target)channel(owner,target.id,true);
      if(job?.publisherId&&target)channel(current({id:job.publisherId}),target.id,true);
      validateSource(owner,post);
      const media=ownMedia(owner,id);
      if(ref.sha256&&media.sha256&&ref.sha256!==media.sha256)throw fail('승인한 미디어 버전이 바뀌었어요.',409);
      return media;
    }
    const media=authorized(),result=await bytesFor(media),live=authorized();
    if(['diskName','mimeType','byteSize','sha256'].some(key=>live[key]!==media[key]))throw fail('읽는 동안 미디어가 바뀌었어요.',409);
    if(ref.sha256&&digest(result.bytes)!==ref.sha256)throw fail('승인한 미디어 내용이 바뀌었어요.',409);
    return result;
  }
  async function downloadHandoff(user,ref,{post,channel:target,job,authorize=()=>user,signal}={}){
    user=current(user,true);
    const originalId=user.id,id=ref?.assetId||ref?.id;
    if(!ref||typeof ref!=='object'||!job?.id)throw fail('승인한 게시 작업과 파일을 다시 선택해 주세요.',409);
    if(/^https:\/\//.test(ref.url||''))throw fail('원격 미디어는 원문 링크에서 확인해 주세요. 승인 파일을 받으려면 워크스페이스에 업로드한 뒤 다시 저장·승인해 주세요.',422);
    if(!id||!/^[a-f0-9]{64}$/.test(ref.sha256||''))throw fail('승인한 파일의 해시가 없어요. 미디어를 준비한 뒤 게시물을 다시 저장하고 승인·예약해 주세요.',409);
    function authorized(){
      if(signal?.aborted)throw fail('승인 파일 다운로드가 중단됐어요.',409);
      const actor=current(authorize(),true);if(actor.id!==originalId)throw fail('로그인 상태를 다시 확인해 주세요.',401);
      const liveJob=store.get('socialPublishJobs',job.id),snapshot=liveJob?.snapshot,currentPost=liveJob&&store.get('socialPosts',liveJob.postId);
      if(!snapshot?.post||!snapshot?.variant||!currentPost||snapshot.post.id!==post?.id||liveJob.contentVersion!==job.contentVersion||liveJob.channelId!==target?.id||snapshot.variant.channelId!==target.id)throw fail('승인할 때의 원본이 없어요. 게시물을 다시 저장하고 승인·예약해 주세요.',409);
      const approved=snapshot.variant.media?.find(media=>(media.assetId||media.id)===id&&media.sha256===ref.sha256&&media.url===ref.url);
      if(!approved)throw fail('이 게시 작업에서 승인한 파일을 선택해 주세요.',409);
      const currentChannel=channel(actor,target.id,true),publisher=current({id:liveJob.publisherId});
      if(!canManageOwners(actor,currentChannel)||!canManageOwners(publisher,currentChannel))throw fail('요청자와 발행 담당자의 현재 발행 권한을 확인해 주세요.',403);
      const variants=currentPost.variants||[];
      if(!variants.length&&currentPost.ownerId!==actor.id||variants.some(variant=>{const c=store.get('channels',variant.channelId);return !c||c.active===false||c.hidden||!canReadChannel(actor,c)||!canManageOwners(actor,c);}))throw fail('이 게시물의 모든 계정에 접근 권한이 있어야 해요.',403);
      validateSource(actor,snapshot.post);ownMedia(actor,id);
      return {post:snapshot.post,channel:currentChannel,job:liveJob};
    }
    const context=authorized(),result=await resolveMedia(ref,{...context,signal});
    authorized();
    return result;
  }
  function variants(user,input={}){user=current(user,true);const body=clean(input.body,20000),ids=input.channelIds||[];if(!body||!Array.isArray(ids)||!ids.length||ids.length>100)throw fail('확정 원고와 계정을 선택해 주세요.');const limits={x:280,threads:500,bluesky:300,instagram:2200,linkedin:3000,youtube:5000,tiktok:2200,facebook:63206};return {method:'source-formatting',label:'확정 원고 문구 다듬기',variants:ids.map(id=>{const c=channel(user,id,true),limit=limits[c.platform]||2000;const lines=body.replace(/\r\n/g,'\n').trim();return {channelId:id,text:lines,characterCount:Array.from(lines).length,limit,needsEdit:Array.from(lines).length>limit,notes:Array.from(lines).length>limit?['원문을 자동으로 자르지 않았어요. 중요한 내용만 남기고 줄여 주세요.']:[]};}),generated:false};}
  function visibleJobs(user,social){
    const readable=new Set(accounts(user).map(c=>c.id));
    return (social.jobs||[]).filter(job=>readable.has(job.channelId));
  }
  function reviewPosts(user,social){
    return (social.posts||[]).filter(post=>{
      const live=store.get('socialPosts',post.id)||post;
      return live.status==='review'&&live.variants?.length&&live.variants.every(v=>{
        const c=store.get('channels',v.channelId);return c&&c.active!==false&&!c.hidden&&canManageOwners(user,c);
      });
    });
  }
  function insights(user,social={}){
    user=current(user);
    const raw=performance?.list(user)||{entries:[],metricDefinitions:[]},accountMap=new Map(accounts(user).map(c=>[c.id,c])),jobs=visibleJobs(user,social);
    const entries=(raw.entries||[]).filter(entry=>accountMap.has(entry.channelId)),entryIds=new Map(entries.map(entry=>[entry.id,entry])),entryUrls=new Map(entries.map(entry=>[entry.channelId+'|'+entry.url,entry]));
    const records=jobs.filter(job=>job.status==='published').map(job=>{
      const saved=store.get('socialPublishJobs',job.id),original=saved?.snapshot?.post||job.snapshot?.post,variant=saved?.snapshot?.variant||job.snapshot?.variant;
      const summary=original?{...original,title:variant?.title||original.title,selectedCopyId:variant?.selectedCopyId,selectedCopyIndex:variant?.selectedCopyIndex,format:variant?.format,publicationFormat:variant?.publicationFormat}:job.contentSummary||{};
      const linked=entryIds.get(job.performanceEntryId),entry=linked?.channelId===job.channelId&&linked.url===job.publicationUrl?linked:entryUrls.get(job.channelId+'|'+job.publicationUrl);
      return {jobId:job.id,postId:job.postId,title:summary.title||'게시물',selectedCopyId:summary.selectedCopyId||job.selectedCopyId||null,selectedCopyIndex:summary.selectedCopyIndex??job.selectedCopyIndex??null,channelId:job.channelId,campaignId:summary.campaignId||'',category:summary.category||'',purpose:summary.purpose||'',language:summary.language||'',format:summary.format||'',publicationFormat:summary.publicationFormat||'',contentVersion:summary.contentVersion??job.contentVersion??null,attributionKnown:!!original||!!job.contentSummary,publishedAt:job.publishedAt,url:job.publicationUrl,checkpoints:entry?.checkpoints||[],entryId:entry?.id||null};
    });
    const summaries=campaigns(user).map(c=>{const rows=records.filter(r=>r.campaignId===c.id);return {...c,postCount:rows.length,rows,metricsNote:'계정·형식·관측 시점별로 쌓인 값이에요. 플랫폼이 다르면 도달과 조회를 더하지 않아요.'};});
    const groups=new Map(),seen=new Set();
    for(const r of records)for(const cp of r.checkpoints){
      const m=cp.metricProvenance?.views;
      if(!r.format||cp.status!=='recorded'||!isNumber(cp.metrics?.views)||!m?.source||!m.unit||!m.timing||m.measurementWindowMissed||!isNumber(cp.hours))continue;
      const k=JSON.stringify([r.channelId,r.format,r.purpose,cp.hours,m.source,m.unit,m.timing]),observation=JSON.stringify([r.channelId,r.entryId||r.url,cp.hours]);
      if(seen.has(observation))continue;seen.add(observation);
      const list=groups.get(k)||[];list.push({r,cp});groups.set(k,list);
    }
    const formatters=new Map();
    const recommendations=[...groups].map(([key,rows])=>{
      const [channelId,format,purpose,hours,source,unit,timing]=JSON.parse(key),values=rows.map(x=>x.cp.metrics.views).sort((a,b)=>a-b),n=values.length,middle=Math.floor(n/2),median=n%2?values[middle]:(values[middle-1]+values[middle])/2,bins=new Map();
      if(n>=10){
        if(!formatters.has(channelId)){let timeZone=accountMap.get(channelId)?.timeZone||'Asia/Seoul';try{zone(timeZone);}catch{timeZone='Asia/Seoul';}formatters.set(channelId,new Intl.DateTimeFormat('en-GB',{timeZone,hour:'2-digit',hourCycle:'h23'}));}
        for(const x of rows){const at=Date.parse(x.r.publishedAt);if(!Number.isFinite(at))continue;const hour=formatters.get(channelId).format(new Date(at)),bin=bins.get(hour)||{hour,sampleCount:0,totalViews:0};bin.sampleCount++;bin.totalViews+=x.cp.metrics.views;bins.set(hour,bin);}
      }
      return {channelId,format,purpose,hours,source,unit,timing,sampleCount:n,median,status:n<10?'insufficient':'observed',message:n<10?'같은 조건의 게시물이 10개 모이면 시간대별로 비교해요.':'같은 조건에서 관측한 값이에요. 성과가 게시 시간 때문이라고 볼 수는 없어요.',timeSlots:[...bins.values()].filter(bin=>bin.sampleCount>=3).map(({hour,sampleCount,totalViews})=>({hour,sampleCount,averageViews:totalViews/sampleCount})).sort((a,b)=>b.averageViews-a.averageViews)};
    });
    const to=clock(),toMs=Date.parse(to),fromMs=toMs-7*86400000,from=new Date(fromMs).toISOString(),within=value=>Number.isFinite(Date.parse(value))&&Date.parse(value)>=fromMs&&Date.parse(value)<=toMs,recentAttention=jobs.filter(job=>attention.has(job.status)&&within(job.updatedAt||job.createdAt));
    return {records,campaigns:summaries,recommendations,metricDefinitions:raw.metricDefinitions||[],weekly:{from,to,published:jobs.filter(job=>job.status==='published'&&within(job.publishedAt)).length,attention:recentAttention.length,nextActions:recentAttention.map(job=>({jobId:job.id,channelId:job.channelId,status:job.status,message:job.message||'발행 상태를 확인해 주세요.'}))}};
  }
  function notifications(user,social={}){
    user=current(user);
    const weekAgo=Date.parse(clock())-7*86400000,events=visibleJobs(user,social).filter(job=>attention.has(job.status)||job.status==='published'&&Date.parse(job.publishedAt||job.updatedAt||job.createdAt)>=weekAgo).map(job=>({key:'job:'+job.id,state:job.status,version:job.updatedAt||job.createdAt,title:job.status==='published'?'SNS 게시 완료':'SNS 게시 확인 필요',text:job.message||({published:'게시됐어요.',unknown:'접수 결과를 확인한 뒤 다음 작업을 선택해 주세요.',missed:'지난 예약의 새 일정을 선택해 주세요.'}[job.status]||'발행 작업을 확인해 주세요.'),href:'/?tab=social&section=queue'}));
    for(const post of reviewPosts(user,social))events.push({key:'review:'+post.id,state:'review:'+post.contentVersion,version:post.updatedAt||post.createdAt,title:'SNS 승인 요청',text:post.title+' · 채널별 문구와 미디어를 검토해 주세요.',href:'/?tab=social&section=compose'});
    return events.map(event=>{const id='social:'+event.key+':'+digest(event.version+'|'+event.state).slice(0,12),receipt=store.get('socialNotificationReads',user.id+':'+id);return {id,kind:'social_publishing',title:event.title,text:event.text,body:event.text,createdAt:event.version,readAt:receipt?.at||null,unread:!receipt,href:event.href,message:null};});
  }
  function readNotifications(user,social,id){user=current(user);const rows=notifications(user,social),selected=id?rows.filter(x=>x.id===id):rows;if(id&&!selected.length)throw fail('알림을 찾을 수 없어요.',404);for(const r of selected)store.put('socialNotificationReads',user.id+':'+r.id,{at:clock()});return {ok:true};}
  function workspace(user,social){return {clientSources:clientSources(user),accounts:accounts(user),campaigns:campaigns(user),inbox:inbox(user),assets:assets(user),insights:insights(user,social),members:visibleMembers(store,current(user)).map(({id,name,role})=>({id,name,role})),notifications:notifications(user,social)};}
  function workday(user,social){user=current(user);if(user.role==='viewer')return [];const items=[];for(const post of reviewPosts(user,social))items.push({id:'social:review:'+post.id,kind:'publication_social',group:'reply',title:post.title,text:'채널별 문구와 미디어를 검토한 뒤 승인해 주세요.',status:'review',statusLabel:'SNS 승인 대기',actionLabel:'SNS 검토 열기',href:'/?tab=social&section=compose',createdAt:post.createdAt,updatedAt:post.updatedAt});for(const job of visibleJobs(user,social)){if(!attention.has(job.status))continue;const c=store.get('channels',job.channelId);if(job.publisherId!==user.id&&!c?.ownerIds?.includes(user.id))continue;const post=(social.posts||[]).find(p=>p.id===job.postId);items.push({id:'social:job:'+job.id,kind:'publication_social',group:'next',title:post?.title||'SNS 게시',text:job.message||'발행 상태와 다음 조치를 확인해 주세요.',status:job.status,statusLabel:'SNS 발행 확인',actionLabel:'발행 대기열 열기',href:'/?tab=social&section=queue',createdAt:job.createdAt,updatedAt:job.updatedAt});}return items;}
  return {workspace,clientSources,validateSource,accounts,saveAccount,saveCampaign,readCampaign,saveInbox,addMedia,prepareMedia,ownMedia,assets,resolveMedia,downloadHandoff,validatePostInput,variants,insights,notifications,readNotifications,workday};
}
