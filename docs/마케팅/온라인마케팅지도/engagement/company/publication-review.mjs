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
    user=current(user);if(typeof id!=='string'||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))throw fail('게시 묶음을 확인해 주세요.',404);
    const pack=publicationPackages.get(user,id).package;
    if(pack.state!=='prepared')throw fail('준비된 게시 묶음을 선택해 주세요.',409);
    const production=write?studio.assertEditable(user,pack.productionId):studio.production(user,pack.productionId).production;
    if(write&&production.stage==='archived')throw fail('보관한 제작 건은 먼저 복원해 주세요.',409);
    const version=production.versions.find(row=>row.id===pack.versionId),latest=production.versions.filter(row=>row.kind==='video'&&row.mediaId).at(-1);
    if(!version?.mediaId||version.kind!=='video')throw fail('게시 묶음의 영상 버전을 찾을 수 없습니다.',404);
    const media=studio.readableMedia(user,version.mediaId);if(media.productionId!==production.id)throw fail('게시 묶음의 원본을 확인해 주세요.',409);
    const raw=store.get('studioPublicationPackages',id);if(!raw)throw fail('게시 묶음을 찾을 수 없습니다.',404);
    return {user,pack,production,version,latest,fingerprint:fingerprint(raw),canEdit:user.role!=='viewer'&&production.stage!=='archived'&&(write||production.canEdit===true)};
  }
  function manualDefinitions(pack){
    return [
      {id:'video',label:'전체 영상 시청',detail:'이 묶음의 모든 채널 출력본을 처음부터 끝까지 재생해 화면 잘림·검은 화면·장면 전환·글자 읽기를 확인해 주세요. 원본만 본 것으로 대신하지 않습니다.'},
      {id:'audio',label:'소리와 청취',detail:'모든 채널 출력본의 말소리·음량·끊김·싱크를 끝까지 들어 주세요. 의도한 무음 영상은 사유를 적어 해당 없음으로 남길 수 있습니다.',allowNotApplicable:true},
      {id:'copy',label:'게시문 사실과 출처',detail:'이 묶음의 제목·게시문을 실제 원문과 대조해 사실·날짜·수치·과장 여부와 필요한 출처를 확인해 주세요.'},
      {id:'rights',label:'소재 사용권',detail:'영상·사진·음원·인물·폰트 등 이 묶음에 사용한 소재를 해당 채널에 게시할 권리와 필요한 표시를 확인해 주세요.'},
      {id:'subtitles',label:'자막 내용과 타이밍',detail:pack.subtitleText?'묶음에 든 자막의 표현·오탈자·타이밍을 채널 출력본과 맞춰 확인해 주세요. 영상에 들어간 자막도 함께 확인합니다.':'별도 자막 파일이 없습니다. 영상에 들어간 글자·자막의 내용·타이밍과 이해에 필요한 자막 누락 여부를 확인해 주세요.'},
      {id:'link',label:'자료 링크와 다운로드',detail:pack.link?'게시문에 연결한 자료가 시청자에게 열리는지, 필요한 파일을 받을 수 있는지 직접 확인해 주세요. 주소 형식 검사만으로 완료되지 않습니다.':'이 묶음에는 별도 자료 링크가 없습니다.',allowNotApplicable:!pack.link,locked:!pack.link},
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
    if(!items.length)items.push({id:'automatic-unavailable',label:'생성 당시 기술 검사',status:'unknown',detail:'저장된 기술 검사 결과가 없습니다. 출력 규격을 직접 확인하고 근거를 남겨 주세요.',manualCheckIds:['technical'],checkedAt:null});
    return items;
  }
  function view(selected){
    const {pack,production,version,latest}=selected,saved=store.get(KIND,pack.id),invalidated=!!saved&&saved.fingerprint!==selected.fingerprint,valid=saved&&!invalidated?saved:null,automatic=automaticFor(pack),definitions=manualDefinitions(pack);
    const linkCheck=publicationLinks?.get(selected.user,{kind:'package',id:pack.id}).check;
    if(linkCheck?.checkedAt)automatic.push({id:'resource-link-response',label:'자료 링크 접속 응답',status:linkCheck.status==='error'?'fail':linkCheck.status==='reachable'?'pass':'unknown',detail:linkCheck.detail||linkCheck.label,checkedAt:linkCheck.checkedAt,manualCheckIds:linkCheck.status==='error'?[]:['link']});
    if(automatic.some(item=>item.manualCheckIds.includes('technical')))definitions.push({id:'technical',label:'출력 규격 주의 확인',detail:'자동 검사에서 주의 또는 미확인으로 남은 모든 채널 출력 규격을 직접 대조하고, 확인한 항목과 근거를 메모로 남겨 주세요. 자동 검사 오류는 새 묶음으로 해결해야 합니다.'});
    const manual=definitions.map(definition=>{
      const previous=valid?.checks?.[definition.id],stored=previous&&STATUSES.has(previous.status)?previous:null;
      return {...definition,allowNotApplicable:!!definition.allowNotApplicable,locked:!!definition.locked,status:definition.locked?'not-applicable':stored?.status||'pending',note:definition.locked?'묶음에 별도 자료 링크가 없습니다.':stored?.note||'',reviewerId:definition.locked?null:stored?.reviewerId||null,reviewerName:definition.locked?'시스템 분류':stored?.reviewerName||'',reviewedAt:definition.locked?null:stored?.reviewedAt||null};
    });
    for(const item of automatic)item.resolved=item.status==='pass'||item.status!=='fail'&&item.manualCheckIds.length>0&&item.manualCheckIds.every(id=>completed(manual.find(check=>check.id===id)));
    const pendingCount=manual.filter(item=>item.status==='pending').length,needsWorkCount=manual.filter(item=>item.status==='needs-work').length,confirmedCount=manual.filter(item=>item.status==='confirmed').length,notApplicableCount=manual.filter(item=>item.status==='not-applicable').length;
    // Manual dependencies account for their own pending work; do not count the
    // same expected human review again as an automatic failure.
    const automaticIssueCount=automatic.filter(item=>!item.resolved&&(item.status==='fail'||!item.manualCheckIds.length)).length;
    const status=needsWorkCount||automaticIssueCount?'needs-work':pendingCount?'pending':'complete';
    return {packageId:pack.id,productionId:production.id,versionId:version.id,versionLabel:version.label||'',isLatestVersion:latest?.id===version.id,latestVersionId:latest?.id||null,revision:saved?.revision||0,canEdit:selected.canEdit,updatedAt:valid?.updatedAt||null,invalidated,summary:{status,label:status==='complete'?'게시 전 점검 완료':status==='needs-work'?'수정할 항목 있음':'직접 확인할 항목 있음',total:manual.length,confirmedCount,pendingCount,needsWorkCount,notApplicableCount,automaticIssueCount},automatic,manual};
  }
  function get(user,id){return {review:view(source(user,id))};}
  function update(user,id,input){
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['revision','checkId','status','note'].includes(key)))throw fail('점검 입력 형식을 확인해 주세요.');
    if(!Number.isSafeInteger(input.revision)||input.revision<0||typeof input.checkId!=='string'||!STATUSES.has(input.status))throw fail('현재 점검 항목과 상태를 선택해 주세요.');
    const note=input.note??'';if(typeof note!=='string'||note.length>2000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(note))throw fail('점검 메모는 2,000자 이하로 입력해 주세요.');
    return store.transaction(()=>{
      const selected=source(user,id,true),review=view(selected),check=review.manual.find(item=>item.id===input.checkId);
      if(review.revision!==input.revision)throw fail('다른 창에서 점검 기록이 바뀌었습니다. 최신 기록을 불러온 뒤 다시 저장해 주세요.',409);
      if(!check||check.locked)throw fail('직접 수정할 수 있는 점검 항목을 선택해 주세요.');
      if(input.status==='not-applicable'&&!check.allowNotApplicable)throw fail('이 항목은 직접 확인하거나 수정할 내용을 남겨 주세요.');
      if((input.status==='needs-work'||input.status==='not-applicable'||check.id==='technical'&&input.status==='confirmed')&&!note.trim())throw fail('선택한 상태의 사유와 확인 근거를 메모로 남겨 주세요.');
      const at=clock();if(!Number.isFinite(Date.parse(at)))throw fail('서버 시각을 확인해 주세요.',500);
      const saved=store.get(KIND,id),checks=saved?.fingerprint===selected.fingerprint?structuredClone(saved.checks||{}):{};
      const change={status:input.status,note:note.trim(),reviewerId:selected.user.id,reviewerName:selected.user.name||'담당자',reviewedAt:new Date(at).toISOString()};checks[check.id]=change;
      const row={packageId:id,productionId:selected.production.id,versionId:selected.version.id,fingerprint:selected.fingerprint,revision:review.revision+1,checks,updatedAt:change.reviewedAt,history:[...(saved?.history||[]),{revision:review.revision+1,checkId:check.id,...change,fingerprint:selected.fingerprint}].slice(-200)};
      store.put(KIND,id,row);return {review:view(selected)};
    });
  }
  return {get,update};
}
