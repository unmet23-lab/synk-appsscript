const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const FORMATS=Object.freeze({
  'youtube-shorts':{platform:'youtube',label:'YouTube Shorts'},
  'youtube-video':{platform:'youtube',label:'YouTube 영상'},
  'instagram-reels':{platform:'instagram',label:'Instagram Reels'},
});
const pair=row=>JSON.stringify([row.productionId,row.versionId]);
const instant=value=>Number.isFinite(Date.parse(value))?Date.parse(value):null;
const stamp=row=>row.updatedAt||row.createdAt||'';
const newest=(a,b)=>stamp(b).localeCompare(stamp(a))||a.id.localeCompare(b.id);
const ownProduction=(user,row)=>row.ownerId===user.id||row.assigneeId===user.id;
const observationKey=(entry,checkpoint)=>(entry.postIdentity||entry.id)+'|'+entry.channelId+'|'+checkpoint.hours;
const hasObservation=checkpoint=>checkpoint.status==='recorded'&&Object.values(checkpoint.metrics||{}).some(value=>typeof value==='number'&&Number.isFinite(value)&&value>=0);

export function publicationWorkflowHref(action,source={}){
  const query=new URLSearchParams({tab:'workroom',section:'tools',tool:'publication',publicationAction:action});
  if(action==='prepare'){if(source.inboxId)query.set('inboxId',source.inboxId);else{query.set('productionId',source.productionId);query.set('versionId',source.versionId);}}
  else if(action==='review')query.set('packageId',source.packageId);
  else if(action==='publish'){query.set('packageId',source.packageId);if(FORMATS[source.publicationFormat])query.set('publicationFormat',source.publicationFormat);}
  else if(action==='performance'){query.set('entryId',source.entryId);query.set('checkpoint',source.checkpointHours+'h');}
  else if(action==='link'){if(source.packageId)query.set('packageId',source.packageId);else if(source.entryId)query.set('entryId',source.entryId);else throw fail('확인할 링크 기록을 선택해 주세요.');}
  else throw fail('게시 진행 단계를 확인해 주세요.');
  return '/?'+query;
}

// The source documents are the queue. Reading it creates no messenger tasks,
// notifications, collection jobs, or copied status records.
export function createPublicationWorkflowService({store,studio,publicationInbox,publicationPackages,publicationReview,postPerformance,publicationLinks,clock=()=>new Date().toISOString()}={}){
  function current(user){const live=store.get('users',user?.id);if(!live?.active)throw fail('먼저 로그인해 주세요.',401);return live;}
  function available(read){try{return read();}catch(error){if([403,404,409,422].includes(error.status))return null;throw error;}}
  function source(user,row){
    const production=available(()=>studio.assertEditable(user,row.productionId));
    if(!production||production.stage==='archived')return null;
    const version=production.versions?.find(item=>item.id===row.versionId);
    if(version?.kind!=='video'||!version.mediaId)return null;
    const media=available(()=>studio.readableMedia(user,version.mediaId));
    if(!media||media.productionId!==production.id)return null;
    return production;
  }
  function workspace(user){
    user=current(user);if(user.role==='viewer')return {items:[]};
    const at=instant(clock());if(at===null)throw fail('서버 시각을 확인해 주세요.',500);
    const items=[],packages=[],packageById=new Map(),sources=new Map();
    for(const row of store.all('studioPublicationPackages')){
      if(row.state!=='prepared')continue;
      const production=source(user,row);if(!production)continue;
      const visible=available(()=>publicationPackages.get(user,row.id))?.package;if(!visible)continue;
      packageById.set(row.id,visible);sources.set(pair(row),production);
      packages.push(visible);
    }
    packages.sort(newest);
    const performance=postPerformance.list(user),channels=new Map(store.all('channels').map(row=>[row.id,row]));
    // Read permission for managers/admins is wider than their personal workday.
    // Channel assignment is authoritative, including after an owner changes.
    const ownedEntries=performance.entries.filter(row=>row.canEdit&&channels.get(row.channelId)?.active!==false&&channels.get(row.channelId)?.ownerIds?.includes(user.id));
    const completed=new Set(),ambiguous=new Set(),formatRepairs=new Map();
    for(const entry of performance.entries){
      // A readable colleague's matching post also completes preparation. Only
      // follow-up measurement work below is restricted to a channel's owners.
      if(channels.get(entry.channelId)?.platform!==entry.platform)continue;
      const linked=packageById.get(entry.publicationPackageId);if(!linked)continue;
      const formats=(linked.channels||[]).filter(id=>FORMATS[id]?.platform===entry.platform);
      const format=formats.includes(entry.publicationFormat)?entry.publicationFormat:!entry.publicationFormat&&formats.length===1?formats[0]:null;
      if(format)completed.add(pair(linked)+'|'+format);
      else if(!entry.publicationFormat&&formats.length>1){
        for(const id of formats)ambiguous.add(pair(linked)+'|'+id);
        if(entry.canEdit)formatRepairs.set(entry.id,{entry,linked,formats});
      }
    }
    const latestVideo=production=>(production.versions||[]).filter(version=>version.kind==='video'&&version.mediaId).at(-1);
    const isCurrent=(row,production)=>!publicationReview||latestVideo(production)?.id===row.versionId;
    const covered=new Map();
    for(const row of packages){const key=pair(row),formats=covered.get(key)||new Set();for(const format of row.channels||[])if(FORMATS[format])formats.add(format);covered.set(key,formats);}
    const inboxState=publicationInbox.state(user),seenInbox=new Set();
    if(inboxState.available){
      // Turning off folder watching does not erase an already delivered draft.
      const receipts=store.all('publicationInboxEntries').filter(row=>row.ownerId===user.id&&['ready','duplicate'].includes(row.status)).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
      for(const row of receipts){
        const key=pair(row);if(seenInbox.has(key))continue;
        const production=source(user,row);if(!production||!ownProduction(user,production)||!isCurrent(row,production))continue;
        const delivered=available(()=>publicationInbox.readDraft(user,row.id));if(!delivered)continue;
        const missing=[...new Set(delivered.draft.channels||[])].filter(id=>FORMATS[id]&&!covered.get(key)?.has(id));
        if(!missing.length)continue;seenInbox.add(key);
        items.push({id:`publication:prepare:${row.productionId}:${row.versionId}`,kind:'publication_prepare',group:'next',title:row.title||production.title,text:`확정본이 도착했습니다. 영상과 원고를 확인하고 ${missing.map(id=>FORMATS[id].label).join(' · ')} 게시 묶음을 준비해 주세요.`,href:publicationWorkflowHref('prepare',{inboxId:row.id}),status:'prepare',statusLabel:covered.has(key)?'남은 채널 묶음 준비':'완성본 확인',actionLabel:'영상 확인·게시 준비',createdAt:row.createdAt,updatedAt:row.updatedAt||row.createdAt,productionId:row.productionId,versionId:row.versionId,inboxId:row.id,channelFormats:missing});
      }
    }
    // A replacement uploaded directly in the existing form has no inbox receipt.
    // Keep that current version actionable without resurfacing old versions.
    if(publicationReview){
      const prepared=new Set(items.filter(row=>row.kind==='publication_prepare').map(pair)),seenProductions=new Set();
      for(const production of sources.values()){
        if(seenProductions.has(production.id)||!ownProduction(user,production))continue;seenProductions.add(production.id);
        const version=latestVideo(production);if(!version)continue;
        const row={productionId:production.id,versionId:version.id},key=pair(row);
        if(covered.has(key)||prepared.has(key)||!source(user,row))continue;
        items.push({id:`publication:prepare:${production.id}:${version.id}`,kind:'publication_prepare',group:'next',title:production.title,text:'새 영상 버전이 등록됐습니다. 이 버전의 게시 묶음을 만들면 새 점검을 시작합니다. 이전 묶음의 확인 기록은 그대로 보관됩니다.',href:publicationWorkflowHref('prepare',row),status:'prepare',statusLabel:'새 버전 게시 준비',actionLabel:'새 버전 확인·게시 준비',createdAt:version.createdAt||production.updatedAt||production.createdAt,updatedAt:production.updatedAt||production.createdAt,productionId:production.id,versionId:version.id,channelFormats:[]});
      }
    }
    // Legacy registrations must be repaired against their original package.
    // Linking them to a newer package would correctly be rejected as a reassignment.
    // Keep one action per record so several ambiguous posts can each be resolved.
    for(const {entry,linked,formats}of formatRepairs.values()){
      const production=sources.get(pair(linked));if(!ownProduction(user,production))continue;
      items.push({id:`publication:format:${entry.id}`,kind:'publication_publish',group:'next',title:entry.title||linked.title||production.title,text:`${entry.channelName||'기존 게시물'}의 게시 형식을 확인해 주세요. 기존 주소 ${entry.url} 를 원래 묶음에 다시 연결하고 ${formats.map(id=>FORMATS[id].label).join(' 또는 ')} 중 실제 형식을 선택하면 성과와 게시 시각은 그대로 보존됩니다.`,href:publicationWorkflowHref('publish',{packageId:linked.id}),status:'format-required',statusLabel:'게시 형식 연결 확인',actionLabel:'기존 게시 형식 연결',createdAt:entry.createdAt,updatedAt:entry.updatedAt||entry.createdAt,productionId:linked.productionId,versionId:linked.versionId,packageId:linked.id,entryId:entry.id,publicationFormat:null,platform:entry.platform,channelFormats:[...formats]});
    }
    const shown=new Set();
    const linkIssues=new Map(),linkGroups=new Set();
    if(publicationLinks)for(const row of packages){
      const production=sources.get(pair(row));if(!ownProduction(user,production)||!isCurrent(row,production))continue;
      const group=pair(row)+'|'+JSON.stringify([...(row.channels||[])].sort());if(linkGroups.has(group))continue;linkGroups.add(group);
      const check=available(()=>publicationLinks.get(user,{kind:'package',id:row.id}))?.check;
      if(check?.status==='error'&&check.canCheck)linkIssues.set(row.id,check);
    }
    for(const row of packages){
      const key=pair(row),production=sources.get(key);if(!ownProduction(user,production)||!isCurrent(row,production))continue;
      const formats=(row.channels||[]).filter(format=>FORMATS[format]&&!completed.has(key+'|'+format)&&!ambiguous.has(key+'|'+format)&&!shown.has(key+'|'+format));
      if(linkIssues.has(row.id)){
        const check=linkIssues.get(row.id);for(const format of formats)shown.add(key+'|'+format);
        items.push({id:`publication:link:package:${row.id}`,kind:'publication_link',group:'next',title:row.title||production.title,text:check.detail||'자료 링크의 오류 응답을 확인하고 원본을 수정하거나 다시 확인해 주세요.',href:publicationWorkflowHref('link',{packageId:row.id}),status:'link-error',statusLabel:'자료 링크 접속 오류',actionLabel:'링크 오류 확인',createdAt:row.createdAt,updatedAt:check.checkedAt||row.createdAt,productionId:row.productionId,versionId:row.versionId,packageId:row.id,channelFormats:formats});
        continue;
      }
      if(!formats.length)continue;
      if(publicationReview){
        const review=available(()=>publicationReview.get(user,row.id))?.review;
        if(!review)continue;
        if(review.summary.status!=='complete'){
          for(const format of formats)shown.add(key+'|'+format);
          const needsWork=review.summary.status==='needs-work';
          items.push({id:`publication:review:${row.id}`,kind:'publication_review',group:'next',title:row.title||production.title,text:`${formats.map(format=>FORMATS[format].label).join(' · ')} 묶음의 ${needsWork?'수정이 필요한 항목과 남은 점검':'남은 점검'}을 확인해 주세요. 직접 확인한 기록은 이 묶음에만 저장됩니다.`,href:publicationWorkflowHref('review',{packageId:row.id}),status:needsWork?'needs-work':'review',statusLabel:needsWork?'게시 전 수정 필요':'게시 전 점검',actionLabel:'남은 점검 확인',createdAt:row.createdAt,updatedAt:review.updatedAt||row.createdAt,productionId:row.productionId,versionId:row.versionId,packageId:row.id,channelFormats:formats});
          continue;
        }
      }
      for(const format of formats){
        if(!FORMATS[format])continue;const identity=key+'|'+format;
        if(completed.has(identity)||ambiguous.has(identity)||shown.has(identity))continue;shown.add(identity);
        const label=FORMATS[format].label;
        items.push({id:`publication:publish:${row.productionId}:${row.versionId}:${format}`,kind:'publication_publish',group:'next',title:row.title||production.title,text:`${label} 게시 묶음이 준비됐습니다. 파일을 확인한 뒤 실제 게시 주소를 기록해 주세요.`,href:publicationWorkflowHref('publish',{packageId:row.id,publicationFormat:format}),status:'publish',statusLabel:label+' 게시 주소 기록',actionLabel:'파일 받기·게시 주소 기록',createdAt:row.createdAt,updatedAt:row.createdAt,productionId:row.productionId,versionId:row.versionId,packageId:row.id,publicationFormat:format,platform:FORMATS[format].platform,channelFormats:[format]});
      }
    }
    const observations=new Set(),recorded=new Set(ownedEntries.flatMap(entry=>(entry.checkpoints||[]).filter(hasObservation).map(checkpoint=>observationKey(entry,checkpoint))));
    for(const entry of ownedEntries){
      if(entry.active===false)continue;
      if(publicationLinks){
        const check=available(()=>publicationLinks.get(user,{kind:'post',id:entry.id}))?.check;
        if(check?.status==='error'&&check.canCheck)items.push({id:`publication:link:post:${entry.id}`,kind:'publication_link',group:'next',title:entry.title||entry.channelName||'게시한 콘텐츠',text:check.detail||'등록한 게시 주소의 오류 응답을 확인해 주세요.',href:publicationWorkflowHref('link',{entryId:entry.id}),status:'link-error',statusLabel:'게시 링크 접속 오류',actionLabel:'게시 링크 확인',createdAt:entry.createdAt,updatedAt:check.checkedAt||entry.updatedAt||entry.createdAt,entryId:entry.id,channelId:entry.channelId,platform:entry.platform});
      }
      for(const checkpoint of entry.checkpoints||[]){
        if(![24,72].includes(checkpoint.hours))continue;
        const due=instant(checkpoint.dueAt),closes=instant(checkpoint.closesAt);if(due===null||due>at)continue;
        const identity=observationKey(entry,checkpoint);if(recorded.has(identity))continue;
        if(checkpoint.status==='collecting'&&(closes===null||closes>=at))continue;
        if(observations.has(identity))continue;observations.add(identity);
        const missed=checkpoint.status==='missed'||closes!==null&&at>closes;
        const label=missed?'관측 시간 경과':checkpoint.status==='retry'?'자동 확인 재시도 중':checkpoint.status==='manual-required'?'직접 수치 보완':'성과 수치 확인';
        const text=missed?`${checkpoint.hours}시간 관측 시간이 지났습니다. 당시 확인해 둔 수치가 있으면 확인 시각과 함께 기록하고, 현재 수치는 현재 확인 시각으로 남겨 주세요.`:checkpoint.status==='retry'?`${checkpoint.hours}시간 수치를 자동으로 다시 확인하고 있습니다. 플랫폼에서 직접 확인한 수치도 보완할 수 있습니다.`:`${checkpoint.hours}시간 확인 시각이 됐지만 기록한 수치가 없습니다. 공식 화면에서 직접 확인한 수치를 보완해 주세요.`;
        const linked=packageById.get(entry.publicationPackageId);
        items.push({id:`publication:performance:${entry.id}:${checkpoint.hours}`,kind:'publication_performance',group:'reply',title:entry.title||entry.channelName||'게시한 콘텐츠',text,href:publicationWorkflowHref('performance',{entryId:entry.id,checkpointHours:checkpoint.hours}),status:missed?'missed':checkpoint.status,statusLabel:label,actionLabel:'수치 보완',createdAt:checkpoint.dueAt,updatedAt:entry.updatedAt||entry.createdAt,entryId:entry.id,checkpointHours:checkpoint.hours,channelId:entry.channelId,channelName:entry.channelName,platform:entry.platform,productionId:linked?.productionId||null,versionId:linked?.versionId||null,packageId:linked?.id||null});
      }
    }
    return {items:items.sort(newest)};
  }
  return {workspace};
}
