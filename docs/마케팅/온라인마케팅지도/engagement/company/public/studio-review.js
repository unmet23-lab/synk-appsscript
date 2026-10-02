'use strict';

const swr = {productionId:'',versionId:'',compareId:'',noteScope:'current',showResolved:false,axis:'all',query:'',busy:false,operation:0,positions:new Map()};
const swrAxes={general:'전체 의견',fun:'재미',usefulness:'도움',authenticity:'진정성',personalization:'개인화'};
const swrKinds={video:'영상',image:'이미지',text:'글',link:'외부 링크'};
const swrStages={idea:'준비',making:'제작 중',review:'검토 요청',ready:'완성',published:'게시 기록',archived:'보관'};

function swResetReview(){
  document.querySelectorAll('[data-swr-video]').forEach(video=>{video.pause();video.removeAttribute('src');video.load();});
  Object.assign(swr,{productionId:'',versionId:'',compareId:'',noteScope:'current',showResolved:false,axis:'all',query:'',busy:false,operation:swr.operation+1});swr.positions.clear();
}
function swrDate(value){if(!value)return '날짜 미확인';const date=new Date(value);return Number.isFinite(date.getTime())?date.toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}):'날짜 미확인';}
function swrTime(value){const seconds=Math.max(0,Number(value)||0),hours=Math.floor(seconds/3600),minutes=Math.floor(seconds%3600/60),rest=Math.floor(seconds%60);return `${hours?hours+':':''}${String(minutes).padStart(2,'0')}:${String(rest).padStart(2,'0')}`;}
function swrOption(value,label,current){return `<option value="${escape(value)}" ${value===current?'selected':''}>${escape(label)}</option>`;}
function swrVersions(production){return [...(production.versions||[])].reverse().sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));}
function swrVersion(production){const versions=swrVersions(production);return versions.find(version=>version.id===swr.versionId)||versions[0];}
function swrMediaUrl(version){
  if(version.mediaId)return '/api/studio-media/'+encodeURIComponent(version.mediaId);
  if(typeof version.url!=='string'||!version.url.trim())return '';
  try{const url=new URL(version.url,location.origin);if(url.username||url.password)return '';if(url.origin===location.origin&&url.pathname.startsWith('/api/studio-media/'))return url.href;return url.protocol==='https:'?url.href:'';}catch{return '';}
}
function swrMedia(version,slot='current'){
  if(!version)return '<div class="swr-no-media"><p>검토할 버전을 골라 주세요.</p></div>';
  if(version.kind==='text')return `<div class="swr-text" tabindex="0" aria-label="${escape(version.label||'글 버전')}">${escape(version.text||'내용이 없습니다.')}</div>`;
  const url=swrMediaUrl(version);
  if(version.kind==='link')return `<div class="swr-link"><span>${icon('external')}</span><h3>원문을 살펴보세요</h3><p>새 탭에서 콘텐츠를 보고, 함께 남긴 배울 점을 참고하세요.</p>${url?`<a class="btn" href="${escape(url)}" target="_blank" rel="noopener noreferrer">원문 열기${icon('external')}</a>`:'<p role="status">열 수 있는 주소가 없습니다.</p>'}</div>`;
  if(!url)return '<div class="swr-no-media"><p>미디어 주소를 확인할 수 없습니다.</p></div>';
  if(version.kind==='video')return `<div class="swr-media-frame"><video src="${escape(url)}" controls playsinline preload="metadata" data-swr-video="${escape(version.id)}" data-swr-slot="${slot}" aria-label="${escape(version.label||'검토 영상')}"></video><p class="swr-media-error" data-swr-media-error hidden role="status">영상을 불러오지 못했어요. 연결과 파일 형식을 확인해 주세요.</p></div>`;
  if(version.kind==='image')return `<div class="swr-media-frame"><img src="${escape(url)}" alt="${escape(version.label||'검토 이미지')}" data-swr-image loading="lazy"><p class="swr-media-error" data-swr-media-error hidden role="status">이미지를 불러오지 못했어요. 연결과 파일 형식을 확인해 주세요.</p></div>`;
  return '<div class="swr-no-media"><p>이 버전은 원문에서 확인해 주세요.</p></div>';
}
function swrSaveTimes(){document.querySelectorAll('[data-swr-video]').forEach(video=>{if(Number.isFinite(video.currentTime))swr.positions.set(video.dataset.swrVideo,video.currentTime);});}
function swrRender(){swrSaveTimes();render();}
function swrEmpty(title,description,action=''){return `<div class="swr-empty"><span>${icon('play')}</span><h3>${escape(title)}</h3><p>${escape(description)}</p>${action}</div>`;}

function swReviewPage(){
  const production=swDetail();
  if(!production)return swrEmpty('함께 볼 완성본을 골라 주세요','제작 보드에서 콘텐츠를 열면 버전과 피드백을 한곳에서 확인할 수 있어요.',swButton('제작 보드로','review-board','arrow','primary'));
  if(swr.productionId!==production.id){swr.productionId=production.id;swr.versionId='';swr.compareId='';swr.noteScope='current';swr.showResolved=false;}
  const versions=swrVersions(production),version=swrVersion(production);swr.versionId=version?.id||'';
  const comparison=versions.find(row=>row.id===swr.compareId&&row.id!==version?.id),canEdit=production.canEdit&&!isViewer(),canComment=production.canComment&&!isViewer();
  const notes=production.notes||[],openNotes=notes.filter(note=>!note.resolved).length;
  return `<section class="swr-review"><header class="swr-heading"><div><span class="swr-kicker">실제 완성본 검토</span><h2>${escape(production.title)}</h2><p>제작 ${escape(production.assigneeName||production.ownerName||'담당자 미지정')}<span>·</span>검토 ${escape(production.reviewerName||'검토자 미지정')}</p></div><div class="swr-heading-actions">${production.canReadDraft&&production.draftId?swButton('연결된 기획 보기','open-linked-draft','arrow','quiet',`data-id="${escape(production.draftId)}"`):''}<span class="status-badge">${swrStages[production.stage]||'검토'}</span>${canEdit?swButton('새 버전 추가','review-version','plus','primary'):''}</div></header><div class="swr-summary"><span><b>${versions.length}</b>개 버전</span><span><b>${openNotes}</b>개 남은 의견</span><p>직접 읽고 보고 들은 내용을 남겨 주세요. 의견 해결과 최종 품질 판단은 구분합니다.</p></div>${!version?swrEmpty('첫 완성본을 기다리고 있어요','영상·이미지를 올리거나 글·외부 링크를 버전으로 남겨 보세요.',canEdit?swButton('첫 버전 추가','review-version','plus','primary'):''):`<div class="swr-review-grid ${comparison?'is-comparing':''}"><div class="swr-viewer"><div class="swr-version-toolbar"><label class="field"><span>검토할 버전</span><select data-swr-version>${versions.map(row=>swrOption(row.id,row.label||swrKinds[row.kind]||'버전',version.id)).join('')}</select></label>${versions.length>1?`<label class="field"><span>나란히 비교</span><select data-swr-compare>${swrOption('','비교하지 않기',comparison?.id||'')}${versions.filter(row=>row.id!==version.id).map(row=>swrOption(row.id,row.label||'이전 버전',comparison?.id)).join('')}</select></label>`:''}</div><div class="swr-comparison ${comparison?'has-comparison':''}">${comparison?`<section class="swr-screen"><header><span>비교 버전</span><strong>${escape(comparison.label)}</strong></header>${swrMedia(comparison,'comparison')}<footer>${escape(swrDate(comparison.createdAt))}</footer></section>`:''}<section class="swr-screen"><header><span>의견을 남길 버전</span><strong>${escape(version.label||swrKinds[version.kind])}</strong></header>${swrMedia(version)}<footer><span>${escape(version.createdByName||'작성자')} · ${escape(swrDate(version.createdAt))}</span><span>${swrKinds[version.kind]||'콘텐츠'}</span></footer></section></div><div class="swr-viewing-note">${icon('info')}<p>${version.kind==='video'?'영상은 직접 재생해 확인해 주세요. 장면에 대한 의견은 현재 재생 시간을 함께 남길 수 있어요.':version.kind==='text'?'문장의 흐름과 설명, 마지막 행동까지 실제로 읽어 보고 의견을 남겨 주세요.':'실제 크기와 내용을 확인하고 어떤 부분을 바꾸면 좋을지 구체적으로 남겨 주세요.'}</p></div>${production.canPublishExample&&['ready','published'].includes(production.stage)&&!isViewer()?`<div class="swr-share-example"><div><h3>팀에 남기고 싶은 장면인가요?</h3><p>이 버전과 좋은 이유를 함께 좋은 예시함에 공유할 수 있어요.</p></div>${swButton('좋은 예시로 남기기','review-example','bookmark','quiet')}</div>`:''}</div><aside class="swr-feedback"><div class="swr-feedback-heading"><h3>이 버전의 의견</h3><span>${notes.filter(note=>note.versionId===version.id).length}</span></div>${canComment?swrNoteForm(production,version):'<p class="swr-readonly">현재 권한으로는 의견을 읽을 수 있어요.</p>'}<div class="swr-note-filters"><label><span class="sr-only">의견 버전 범위</span><select data-swr-note-scope>${swrOption('current','선택한 버전',swr.noteScope)}${swrOption('all','모든 버전',swr.noteScope)}</select></label><label><input type="checkbox" data-swr-resolved ${swr.showResolved?'checked':''}>해결한 의견 포함</label></div><div class="swr-notes">${swrNotes(production,version)}</div></aside></div>`}</section>`;
}
function swrNoteForm(production,version){
  return `<form class="swr-note-form" data-swr-form="note" data-production="${escape(production.id)}" data-version="${escape(version.id)}"><div class="form-error" role="alert"></div><label class="field">어떤 점을 보셨나요?<textarea name="text" rows="4" required maxlength="2000" placeholder="좋았던 장면, 이해가 막힌 부분, 바꾸면 더 좋아질 점을 구체적으로 적어 주세요."></textarea></label><div class="swr-note-options"><label class="field">검토 관점<select name="axis">${Object.entries(swrAxes).map(([key,label])=>swrOption(key,label,'general')).join('')}</select></label>${version.kind==='video'?`<label class="field">장면 시간 <small>선택</small><input name="atSeconds" type="number" min="0" step="0.1" placeholder="초 단위"></label>`:''}</div><div class="swr-form-bottom">${version.kind==='video'?swButton('현재 시간 담기','review-capture','clock','quiet small'):'<span>의견은 이 버전에 남습니다.</span>'}<button class="btn primary" type="submit" ${swr.busy?'disabled':''}>의견 남기기</button></div></form>`;
}
function swrNotes(production,version){
  const versions=new Map((production.versions||[]).map(row=>[row.id,row]));
  const notes=(production.notes||[]).filter(note=>(swr.noteScope==='all'||note.versionId===version.id)&&(swr.showResolved||!note.resolved)).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  if(!notes.length)return '<p class="swr-notes-empty">표시할 의견이 없어요.<br>보고 느낀 점을 첫 의견으로 남겨 보세요.</p>';
  return notes.map(note=>`<article class="swr-note ${note.resolved?'is-resolved':''}"><header><strong>${escape(note.ownerName||'팀원')}</strong><span>${escape(swrDate(note.createdAt))}</span></header><div class="swr-note-tags"><span>${escape(swrAxes[note.axis]||'전체 의견')}</span>${swr.noteScope==='all'?`<span>${escape(versions.get(note.versionId)?.label||'이전 버전')}</span>`:''}${note.atSeconds!==null&&Number.isFinite(note.atSeconds)?swButton(swrTime(note.atSeconds),'review-seek','play','quiet small',`data-id="${escape(note.versionId)}" data-seconds="${note.atSeconds}"`):''}</div><p>${escape(note.text)}</p><footer>${note.resolved?'<span class="swr-resolved-mark">해결 표시됨</span>':'<span>확인할 의견</span>'}${note.canResolve&&!isViewer()?swButton(note.resolved?'다시 열기':'해결 표시','review-resolve',note.resolved?'refresh':'check','quiet small',`data-id="${escape(note.id)}" ${swr.busy?'disabled':''}`):''}</footer></article>`).join('');
}

function swExamplesPage(){
  const all=(sw.data?.examples||[]).filter(row=>!row.archived),query=swr.query.toLocaleLowerCase(),examples=all.filter(row=>(swr.axis==='all'||row.axis===swr.axis)&&(!query||[row.title,row.whyGood,row.lesson].join(' ').toLocaleLowerCase().includes(query)));
  return `<section class="cp-team-examples"><div class="cp-section-heading"><div><h2>팀이 모은 좋은 콘텐츠 <span>${all.length}</span></h2><p>좋았던 이유까지 남겨, 다음 기획에 활용하세요.</p></div>${['admin','manager'].includes(state.user?.role)?cpButton('예시 등록','example-new','plus','primary'):''}</div>${all.length?`<div class="cp-example-tools"><label class="cp-example-search">${icon('search')}<input type="search" data-swr-example-search value="${escape(swr.query)}" placeholder="제목, 좋은 이유, 배울 점 찾기" aria-label="좋은 예시 검색"></label><select data-swr-example-axis aria-label="예시 관점">${swrOption('all','모든 관점',swr.axis)}${Object.entries(swrAxes).map(([key,label])=>swrOption(key,label,swr.axis)).join('')}</select></div>`:''}${examples.length?`<div class="cp-example-list">${examples.map(example=>`<article class="cp-example-row"><span class="cp-example-kind">${icon(example.version?.kind==='text'?'file':'play')}</span><div class="cp-example-copy"><div class="cp-reference-meta"><span>${escape(swrAxes[example.axis]||'전체 의견')}</span><span>${escape(swrKinds[example.version?.kind]||'콘텐츠')}</span></div><h3>${escape(example.title)}</h3><p>${escape(example.whyGood)}</p><small>${escape(example.ownerName||'팀원')} · ${escape(swrDate(example.createdAt))}</small></div>${swButton('자세히 보기','example-open','arrow','quiet',`data-id="${escape(example.id)}"`)}</article>`).join('')}</div>`:empty(all.length?'조건에 맞는 예시가 없어요':'좋은 콘텐츠를 모아 보세요',all.length?'다른 관점이나 검색어로 찾아보세요.':'다시 보고 싶은 링크나 글에 좋은 이유를 함께 남기면 됩니다.','',true,'bookmark')}</section>`;
}
function swrVersionModal(){
  const production=swDetail();if(!production?.canEdit||isViewer())return;
  modal('새 완성본 버전','이전 파일을 덮어쓰지 않고 새 버전으로 기록합니다.',`<form data-swr-form="version" data-production="${escape(production.id)}" class="form-stack swr-version-form"><div class="form-error" role="alert"></div><label class="field">버전 이름<input name="label" required maxlength="100" placeholder="예: 2차 편집 · 도입과 자막 보완"></label><label class="field">등록할 내용<select name="kind" data-swr-upload-kind><option value="file">영상·이미지 파일</option><option value="text">글 원고</option><option value="link">외부 링크</option></select></label><div data-swr-upload-fields="file"><label class="field">파일<input name="file" type="file" accept="video/mp4,video/webm,image/jpeg,image/png" required><small>MP4·WebM·JPG·PNG, 최대 100 MB. 회사 프로그램에 저장됩니다.</small></label></div><div data-swr-upload-fields="text" hidden><label class="field">검토할 원고<textarea name="text" rows="10" maxlength="20000" disabled></textarea></label></div><div data-swr-upload-fields="link" hidden><label class="field">원문 주소<input name="url" type="url" maxlength="2000" placeholder="https://…" disabled><small>소셜 게시물 등은 새 탭에서 열어 확인합니다.</small></label></div><p class="swr-upload-status" role="status" data-swr-upload-status></p><div class="modal-actions"><button class="btn primary" type="submit">버전 저장</button></div></form>`,true);
}
function swrExampleModal(){
  const production=swDetail(),version=production&&swrVersion(production);if(!version||!production.canPublishExample||!['ready','published'].includes(production.stage)||isViewer())return;
  modal('좋은 예시로 남기기','어떤 선택이 좋았는지 함께 기록해 주세요.',`<form data-swr-form="example" data-production="${escape(production.id)}" data-version="${escape(version.id)}" class="form-stack"><div class="form-error" role="alert"></div><div class="swr-share-context"><span>회사에 공유할 버전</span><strong>${escape(production.title)} · ${escape(version.label)}</strong><p>선택한 완성본 버전과 아래 이유·배울 점이 회사 크루에게 공유됩니다. 검토실의 원래 의견은 함께 공유하지 않습니다.</p></div><label class="field">예시 제목<input name="title" required maxlength="200" value="${escape(production.title)}"></label><label class="field">어떤 관점에서 좋았나요?<select name="axis">${Object.entries(swrAxes).filter(([key])=>key!=='general').map(([key,label])=>swrOption(key,label,'fun')).join('')}</select></label><label class="field">좋은 이유<textarea name="whyGood" required maxlength="2000" rows="3" placeholder="어느 장면의 어떤 선택이 왜 좋았나요?"></textarea></label><label class="field">다음 작업에서 배울 점<textarea name="lesson" required maxlength="2000" rows="3" placeholder="어떤 상황에 이 방법을 다시 써볼 수 있을까요?"></textarea></label><label class="swr-consent"><input type="checkbox" name="shareConfirmed" required>선택한 버전과 작성한 내용을 회사에 공유하는 데 동의합니다.</label><div class="modal-actions"><button class="btn primary" type="submit">좋은 예시함에 공유</button></div></form>`,true);
}
function swrOpenExample(id){
  const example=(sw.data?.examples||[]).find(row=>row.id===id&&!row.archived);if(!example)return;
  modal(escape(example.title),'팀이 남긴 완성본과 배울 점',`<article class="swr-example-detail"><div class="swr-example-detail-media">${swrMedia(example.version,'example')}</div><div class="swr-example-detail-copy"><span class="status-badge">${escape(swrAxes[example.axis]||'전체 의견')}</span><h3>좋은 이유</h3><p>${escape(example.whyGood)}</p><h3>다음 작업에 가져갈 점</h3><p>${escape(example.lesson)}</p><footer>${escape(example.ownerName||'팀원')} · ${escape(swrDate(example.createdAt))}</footer>${example.canArchive&&!isViewer()?swButton('예시함에서 보관','example-archive','archive','quiet small',`data-id="${escape(example.id)}"`):''}</div></article>`,true);
}

document.addEventListener('loadedmetadata',event=>{const video=event.target;if(!video.matches?.('[data-swr-video]'))return;const position=swr.positions.get(video.dataset.swrVideo);if(Number.isFinite(position)&&position>0){try{video.currentTime=Math.min(position,Number.isFinite(video.duration)?Math.max(0,video.duration-.01):position);}catch{}}},true);
document.addEventListener('error',event=>{const media=event.target;if(!media.matches?.('[data-swr-video],[data-swr-image]'))return;const message=media.parentElement?.querySelector('[data-swr-media-error]');if(message)message.hidden=false;},true);
document.addEventListener('change',event=>{
  const target=event.target;
  if(target.matches('[data-swr-version]')){swrSaveTimes();swr.versionId=target.value;if(swr.compareId===target.value)swr.compareId='';render();}
  else if(target.matches('[data-swr-compare]')){swr.compareId=target.value;swrRender();}
  else if(target.matches('[data-swr-note-scope]')){swr.noteScope=target.value;swrRender();}
  else if(target.matches('[data-swr-resolved]')){swr.showResolved=target.checked;swrRender();}
  else if(target.matches('[data-swr-example-axis]')){swr.axis=target.value;render();}
  else if(target.matches('[data-swr-example-search]')){swr.query=target.value;render();}
  else if(target.matches('[data-swr-upload-kind]')){const form=target.closest('form');form.querySelectorAll('[data-swr-upload-fields]').forEach(section=>{const active=section.dataset.swrUploadFields===target.value;section.hidden=!active;section.querySelectorAll('input,textarea').forEach(input=>{input.disabled=!active;input.required=active;});});}
});
document.addEventListener('click',async event=>{
  const target=event.target.closest('[data-action^="sw-review-"],[data-action^="sw-example-"]');if(!target||target.disabled)return;
  const action=target.dataset.action.slice(3),production=swDetail(),guard=swGuard();
  try{
    if(action==='review-board'){sw.view='board';swrRender();}
    else if(action==='review-version')swrVersionModal();
    else if(action==='review-example')swrExampleModal();
    else if(action==='example-open')swrOpenExample(target.dataset.id);
    else if(action==='review-capture'){const video=document.querySelector('[data-swr-slot="current"][data-swr-video]'),input=document.querySelector('[data-swr-form="note"] [name="atSeconds"]');if(!video||!input||!Number.isFinite(video.currentTime))throw new Error('선택한 영상을 먼저 불러와 주세요.');input.value=Math.round(video.currentTime*10)/10;input.focus();}
    else if(action==='review-seek'){const version=(production?.versions||[]).find(row=>row.id===target.dataset.id),seconds=Number(target.dataset.seconds);if(version?.kind!=='video'||!Number.isFinite(seconds)||seconds<0)return;swrSaveTimes();swr.versionId=version.id;swr.positions.set(version.id,seconds);if(swr.compareId===version.id)swr.compareId='';render();const video=document.querySelector('[data-swr-slot="current"][data-swr-video]');if(video?.readyState>=1)video.currentTime=Math.min(seconds,Number.isFinite(video.duration)?video.duration:seconds);video?.focus();}
    else if(action==='review-resolve'){
      const note=production?.notes?.find(row=>row.id===target.dataset.id);if(!note?.canResolve||swr.busy||isViewer())return;
      const operation=++swr.operation;swr.busy=true;target.disabled=true;
      try{const result=await api(`/api/studio-productions/${encodeURIComponent(production.id)}/notes/${encodeURIComponent(note.id)}`,{resolved:!note.resolved});if(!swAlive(guard)||swDetail()?.id!==production.id||!target.isConnected||state.tab!=='studio'||sw.view!=='review')return;swAcceptProduction(result.production);swr.busy=false;swrRender();}
      finally{if(operation===swr.operation)swr.busy=false;if(target.isConnected)target.disabled=false;}
    }else if(action==='example-archive'){
      const example=sw.data?.examples?.find(row=>row.id===target.dataset.id);if(!example?.canArchive||swr.busy||isViewer())return;
      const operation=++swr.operation,modalRequest=state.modalRequest;swr.busy=true;target.disabled=true;
      try{await api('/api/studio-examples/'+encodeURIComponent(example.id),{archived:true});if(!swAlive(guard))return;sw.data.examples=sw.data.examples.filter(row=>row.id!==example.id);const sameSource=target.isConnected&&state.modalRequest===modalRequest;if(sameSource)closeModal();if(sameSource&&(state.tab==='studio'&&sw.view==='examples'||state.tab==='content'&&cp.view==='examples'))render();notify('예시를 보관했어요.');}
      finally{if(operation===swr.operation)swr.busy=false;if(target.isConnected)target.disabled=false;}
    }
  }catch(error){if(swAlive(guard))notify(error.message);}
});
document.addEventListener('submit',async event=>{
  const form=event.target.closest('form[data-swr-form]');if(!form)return;event.preventDefault();if(swr.busy||isViewer())return;
  const production=swDetail(),id=form.dataset.production;if(!production||production.id!==id)return;
  const kind=form.dataset.swrForm;if((kind==='version'&&!production.canEdit)||(kind==='note'&&!production.canComment)||(kind==='example'&&!production.canPublishExample))return;
  const guard=swGuard(),operation=++swr.operation,modalRequest=state.modalRequest,button=form.querySelector('[type="submit"]'),errorBox=form.querySelector('.form-error'),values=new FormData(form);
  swr.busy=true;button.disabled=true;button.setAttribute('aria-busy','true');errorBox.textContent='';
  try{
    let result;
    if(kind==='version'){
      const versionKind=values.get('kind'),label=String(values.get('label')||'').trim();
      if(versionKind==='file'){const file=values.get('file');if(!file?.size)throw new Error('영상이나 이미지 파일을 선택해 주세요.');if(file.size>100*1024*1024)throw new Error('100 MB 이하의 파일을 선택해 주세요.');form.querySelector('[data-swr-upload-status]').textContent='파일을 올리는 중입니다. 완료될 때까지 기다려 주세요.';result=await swUploadMedia(id,file,label,percent=>{const status=form.querySelector('[data-swr-upload-status]');if(swAlive(guard)&&form.isConnected&&status)status.textContent=percent<100?`파일 업로드 ${percent}%`:'파일을 확인하고 저장하는 중입니다.';});}
      else result=await api(`/api/studio-productions/${encodeURIComponent(id)}/versions`,{label,kind:versionKind,...(versionKind==='text'?{text:values.get('text')}:{url:values.get('url')})});
    }else if(kind==='note'){
      const raw=values.get('atSeconds'),atSeconds=raw===null||raw===''?null:Number(raw);if(atSeconds!==null&&(!Number.isFinite(atSeconds)||atSeconds<0))throw new Error('장면 시간을 0 이상의 초 단위로 입력해 주세요.');
      result=await api(`/api/studio-productions/${encodeURIComponent(id)}/notes`,{versionId:form.dataset.version,text:values.get('text'),axis:values.get('axis'),atSeconds});
    }else if(kind==='example'){
      if(values.get('shareConfirmed')!=='on')throw new Error('회사에 공유할 버전과 내용을 확인해 주세요.');
      result=await api('/api/studio-examples',{productionId:id,versionId:form.dataset.version,title:values.get('title'),whyGood:values.get('whyGood'),lesson:values.get('lesson'),axis:values.get('axis'),shareConfirmed:true});
    }
    if(!swAlive(guard))return;
    const sourceAlive=swDetail()?.id===id&&form.isConnected&&(kind==='note'||state.modalRequest===modalRequest)&&state.tab==='studio'&&sw.view==='review';
    if(!sourceAlive){notify(kind==='note'?'이전 작업의 의견을 저장했어요.':kind==='example'?'선택한 예시를 공유했어요.':'이전 작업의 새 버전을 저장했어요.');return;}
    if(kind==='example'){if(result.example)sw.data.examples=[result.example,...(sw.data.examples||[]).filter(row=>row.id!==result.example.id)];}
    else if(swDetail()?.id===id){swAcceptProduction(result.production);if(kind==='version'){swr.versionId=swrVersions(result.production)[0]?.id||'';swr.compareId='';}}
    if(kind!=='note'&&form.isConnected&&state.modalRequest===modalRequest)closeModal();
    if(kind==='note'&&form.isConnected)form.reset();
    swr.busy=false;swrRender();notify(kind==='example'?'선택한 버전을 좋은 예시함에 공유했어요.':kind==='note'?'이 버전에 의견을 남겼어요.':'새 버전을 저장했어요.');
  }catch(error){if(swAlive(guard)){if(form.isConnected)errorBox.textContent=error.message;else notify(error.message);}}
  finally{if(operation===swr.operation)swr.busy=false;if(button.isConnected){button.disabled=false;button.removeAttribute('aria-busy');}const status=form.querySelector('[data-swr-upload-status]');if(status?.isConnected)status.textContent='';}
});
