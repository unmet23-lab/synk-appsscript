import {createHash} from 'node:crypto';

const KIND='publicationPackageReviews';
const STATUSES=new Set(['pending','confirmed','needs-work','not-applicable']);
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const text=(value,max=200)=>typeof value==='string'?value.trim().slice(0,max):'';
const completed=check=>check.status==='confirmed'||check.status==='not-applicable';
const automaticStatus=status=>['pass','match'].includes(status)?'pass':['warn','warning','review'].includes(status)?'warn':['fail','error'].includes(status)?'fail':'unknown';
const fingerprint=pack=>createHash('sha256').update(JSON.stringify({productionId:pack.productionId,versionId:pack.versionId,title:pack.title,body:pack.body,link:pack.link,language:pack.language,mode:pack.mode,channels:pack.channels,source:pack.source,outputs:pack.outputs,subtitleText:pack.subtitleText,subtitle:pack.subtitle,checks:pack.checks})).digest('hex');

export function createPublicationReviewService({store,studio,publicationPackages,publicationLinks,clock=()=>new Date().toISOString()}={}){
  if(!store||!studio||!publicationPackages)throw new Error('Publication review requires its source services.');
  function current(user){const live=user?.id&&store.get('users',user.id);if(!live?.active)throw fail('먼저 로그인해 주세요.',401);return live;}
  function source(user,id,write=false){
    user=current(user);if(typeof id!=='string'||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))throw fail('게시 묶음을 찾지 못했어요.',404);
    const pack=publicationPackages.get(user,id).package;
    if(pack.state!=='prepared')throw fail('아직 준비가 끝나지 않은 묶음이에요. 준비된 묶음을 골라 주세요.',409);
    const production=write?studio.assertEditable(user,pack.productionId):studio.production(user,pack.productionId).production;
    if(write&&production.stage==='archived')throw fail('보관한 제작 건이에요. 먼저 복원해 주세요.',409);
    const version=production.versions.find(row=>row.id===pack.versionId),latest=production.versions.filter(row=>row.kind==='video'&&row.mediaId).at(-1);
    if(!version?.mediaId||version.kind!=='video')throw fail('게시 묶음의 영상 버전을 찾지 못했어요.',404);
    const media=studio.readableMedia(user,version.mediaId);if(media.productionId!==production.id)throw fail('게시 묶음의 원본 영상이 이 제작 건과 맞지 않아요.',409);
    const raw=store.get('studioPublicationPackages',id);if(!raw)throw fail('게시 묶음을 찾지 못했어요.',404);
    return {user,pack,production,version,latest,fingerprint:fingerprint(raw),canEdit:user.role!=='viewer'&&production.stage!=='archived'&&(write||production.canEdit===true)};
  }
  function manualDefinitions(pack){
    return [
      {id:'video',label:'영상 끝까지 보기',detail:'채널마다 나온 영상을 모두 처음부터 끝까지 틀어, 화면 잘림·검은 화면·장면 전환·글자가 읽히는지 봐 주세요. 원본만 보고 넘어가면 안 돼요.'},
      {id:'audio',label:'소리 끝까지 듣기',detail:'채널마다 나온 영상을 끝까지 들으며 말소리·음량·끊김, 소리와 화면이 맞는지 봐 주세요. 일부러 소리를 뺀 영상이면 이유를 적고 「해당 없음」으로 둘 수 있어요.',allowNotApplicable:true},
      {id:'copy',label:'게시문 사실·출처',detail:'제목·게시문을 원래 자료와 맞대어 사실·날짜·숫자가 맞는지, 부풀린 말은 없는지, 출처가 필요한 곳에 붙었는지 봐 주세요.'},
      {id:'rights',label:'소재 사용권',detail:'영상·사진·음원·인물·폰트 등 이 묶음에 쓴 소재를 이 채널에 올려도 되는지, 붙여야 할 표시가 있는지 봐 주세요.'},
      {id:'subtitles',label:'자막 내용·타이밍',detail:pack.subtitleText?'묶음에 든 자막의 표현·오탈자·타이밍을 채널마다 나온 영상과 맞춰 보고, 영상에 박힌 글자도 같이 봐 주세요.':'따로 넣은 자막 파일이 없어요. 영상에 박힌 글자·자막의 내용과 타이밍, 이해에 꼭 필요한 자막이 빠지지 않았는지 봐 주세요.'},
      {id:'link',label:'자료 링크 열어 보기',detail:pack.link?'게시문에 단 자료가 시청자에게 열리는지, 필요한 파일을 받을 수 있는지 직접 열어 봐 주세요. 주소 형식 검사만으로는 끝나지 않아요.':'이 묶음에는 따로 단 자료 링크가 없어요.',allowNotApplicable:!pack.link,locked:!pack.link},
    ];
  }
  function automaticFor(pack){
    const items=[];
    function add(check,id,channel=''){
      const status=automaticStatus(check.status),label=text(check.label)||'검사 항목';let manualCheckIds=[];
      if(label==='자료 링크')manualCheckIds=['link'];
      else if(label==='자막')manualCheckIds=['subtitles'];
      else if(label==='소리·자막·사용권')manualCheckIds=['video','audio','subtitles','rights'];
      else if(label==='최종 시청·청취·사용권')manualCheckIds=['video','audio','copy','rights'];
      else if(status!=='pass'&&status!=='fail')manualCheckIds=['technical'];
      items.push({id,label:channel?channel+' · '+label:label,status,detail:text(check.detail,2000),manualCheckIds,checkedAt:pack.createdAt||null});
    }
    for(const [index,check]of (pack.checks||[]).entries())add(check,'package:'+index);
    for(const [outputIndex,output]of (pack.outputs||[]).entries())for(const [index,check]of (output.checks||[]).entries())add(check,'output:'+outputIndex+':'+index,output.label||output.channel);
    if(!items.length)items.push({id:'automatic-unavailable',label:'만들 때 한 기술 검사',status:'unknown',detail:'저장된 기술 검사 결과가 없어요. 출력 규격을 직접 보고 무엇을 봤는지 메모로 남겨 주세요.',manualCheckIds:['technical'],checkedAt:null});
    return items;
  }
  function view(selected){
    const {pack,production,version,latest}=selected,saved=store.get(KIND,pack.id),invalidated=!!saved&&saved.fingerprint!==selected.fingerprint,valid=saved&&!invalidated?saved:null,automatic=automaticFor(pack),definitions=manualDefinitions(pack);
    const linkCheck=publicationLinks?.get(selected.user,{kind:'package',id:pack.id}).check;
    if(linkCheck?.checkedAt)automatic.push({id:'resource-link-response',label:'자료 링크 접속 결과',status:linkCheck.status==='error'?'fail':linkCheck.status==='reachable'?'pass':'unknown',detail:linkCheck.detail||linkCheck.label,checkedAt:linkCheck.checkedAt,manualCheckIds:linkCheck.status==='error'?[]:['link']});
    if(automatic.some(item=>item.manualCheckIds.includes('technical')))definitions.push({id:'technical',label:'출력 규격 직접 보기',detail:'자동 검사에서 주의나 미확인으로 남은 채널 출력 규격을 직접 맞춰 보고, 본 항목과 근거를 메모로 남겨 주세요. 자동 검사에서 오류가 난 항목은 새 묶음을 만들어야 풀려요.'});
    const manual=definitions.map(definition=>{
      const previous=valid?.checks?.[definition.id],stored=previous&&STATUSES.has(previous.status)?previous:null;
      return {...definition,allowNotApplicable:!!definition.allowNotApplicable,locked:!!definition.locked,status:definition.locked?'not-applicable':stored?.status||'pending',note:definition.locked?'자료 링크가 없는 묶음이에요.':stored?.note||'',reviewerId:definition.locked?null:stored?.reviewerId||null,reviewerName:definition.locked?'자동 분류':stored?.reviewerName||'',reviewedAt:definition.locked?null:stored?.reviewedAt||null};
    });
    for(const item of automatic)item.resolved=item.status==='pass'||item.status!=='fail'&&item.manualCheckIds.length>0&&item.manualCheckIds.every(id=>completed(manual.find(check=>check.id===id)));
    const pendingCount=manual.filter(item=>item.status==='pending').length,needsWorkCount=manual.filter(item=>item.status==='needs-work').length,confirmedCount=manual.filter(item=>item.status==='confirmed').length,notApplicableCount=manual.filter(item=>item.status==='not-applicable').length;
    // Manual dependencies account for their own pending work; do not count the
    // same expected human review again as an automatic failure.
    const automaticIssueCount=automatic.filter(item=>!item.resolved&&(item.status==='fail'||!item.manualCheckIds.length)).length;
    const status=needsWorkCount||automaticIssueCount?'needs-work':pendingCount?'pending':'complete';
    return {packageId:pack.id,productionId:production.id,versionId:version.id,versionLabel:version.label||'',isLatestVersion:latest?.id===version.id,latestVersionId:latest?.id||null,revision:saved?.revision||0,canEdit:selected.canEdit,updatedAt:valid?.updatedAt||null,invalidated,summary:{status,label:status==='complete'?'점검 끝남':status==='needs-work'?'고칠 것 있음':'볼 것 남음',total:manual.length,confirmedCount,pendingCount,needsWorkCount,notApplicableCount,automaticIssueCount},automatic,manual};
  }
  function get(user,id){return {review:view(source(user,id))};}
  function update(user,id,input){
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['revision','checkId','status','note'].includes(key)))throw fail('점검 입력이 올바르지 않아요. 화면을 새로 고친 뒤 다시 해 주세요.');
    if(!Number.isSafeInteger(input.revision)||input.revision<0||typeof input.checkId!=='string'||!STATUSES.has(input.status))throw fail('점검 항목과 상태를 다시 골라 주세요.');
    const note=input.note??'';if(typeof note!=='string'||note.length>2000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(note))throw fail('점검 메모는 2,000자까지 쓸 수 있어요.');
    return store.transaction(()=>{
      const selected=source(user,id,true),review=view(selected),check=review.manual.find(item=>item.id===input.checkId);
      if(review.revision!==input.revision)throw fail('다른 창에서 점검 기록이 바뀌어 저장하지 못했어요. 최신 기록을 본 뒤 다시 저장해 주세요.',409);
      if(!check||check.locked)throw fail('이 항목은 바꿀 수 없어요. 다른 점검 항목을 골라 주세요.');
      if(input.status==='not-applicable'&&!check.allowNotApplicable)throw fail('이 항목은 「해당 없음」으로 둘 수 없어요. 직접 보고 확인이나 고칠 점을 남겨 주세요.');
      if((input.status==='needs-work'||input.status==='not-applicable'||check.id==='technical'&&input.status==='confirmed')&&!note.trim())throw fail('이 상태로 두려면 이유와 근거를 메모에 적어 주세요.');
      const at=clock();if(!Number.isFinite(Date.parse(at)))throw fail('서버 시각을 읽지 못했어요. 잠시 뒤 다시 시도해 주세요.',500);
      const saved=store.get(KIND,id),checks=saved?.fingerprint===selected.fingerprint?structuredClone(saved.checks||{}):{};
      const change={status:input.status,note:note.trim(),reviewerId:selected.user.id,reviewerName:selected.user.name||'담당자',reviewedAt:new Date(at).toISOString()};checks[check.id]=change;
      const row={packageId:id,productionId:selected.production.id,versionId:selected.version.id,fingerprint:selected.fingerprint,revision:review.revision+1,checks,updatedAt:change.reviewedAt,history:[...(saved?.history||[]),{revision:review.revision+1,checkId:check.id,...change,fingerprint:selected.fingerprint}].slice(-200)};
      store.put(KIND,id,row);return {review:view(selected)};
    });
  }
  return {get,update};
}
