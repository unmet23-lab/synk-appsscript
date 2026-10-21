'use strict';
// 제작 상황판의 검토실(작업 상세의 「01 완성본 · 의견」)과 예시 데스크(13판 A). 실제 완성본, 버전마다의 의견, 팀이 고른 좋은 예시.
// swExamplesPage()는 기획 화면(content.js)의 「좋은 콘텐츠 · 팀 예시」가 그대로 쓰고, 예시 자세히 · 새 버전 · 좋은 예시로 남기기는 모달이다.
const swr = {productionId:'',versionId:'',compareId:'',noteScope:'current',showResolved:false,axis:'all',query:'',busy:false,operation:0,positions:new Map(),notes:new Map()};
const swrAxes={general:'전체 의견',fun:'재미',usefulness:'도움',authenticity:'진정성',personalization:'개인화'};
const swrKinds={video:'영상',image:'이미지',text:'글',link:'외부 링크'};
const swrStages={idea:'준비',making:'제작 중',review:'검토 요청',ready:'완성',published:'게시 기록',archived:'보관'};

function swResetReview(){
  document.querySelectorAll('[data-swr-video]').forEach(video=>{video.pause();video.removeAttribute('src');video.load();});
  Object.assign(swr,{productionId:'',versionId:'',compareId:'',noteScope:'current',showResolved:false,axis:'all',query:'',busy:false,operation:swr.operation+1});swr.positions.clear();swr.notes.clear();
}
function swrDate(value){if(!value)return '날짜 모름';const date=new Date(value);return Number.isFinite(date.getTime())?date.toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}):'날짜 모름';}
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
  if(!version)return '<div class="swr-no-media"><p>볼 버전을 골라 주세요.</p></div>';
  if(version.kind==='text')return `<div class="swr-text" tabindex="0" aria-label="${escape(version.label||'글 버전')}">${escape(version.text||'내용이 없어요.')}</div>`;
  const url=swrMediaUrl(version);
  if(version.kind==='link')return `<div class="swr-link"><span>${mtIcon('arrow')}</span><h3>원문에서 보는 콘텐츠예요</h3><p>새 탭에서 열어 봐요.</p>${url?`<a class="btn small" href="${escape(url)}" target="_blank" rel="noopener noreferrer">원문 열기</a>`:'<p role="status">열 수 있는 주소가 없어요. 올린 사람에게 주소를 다시 넣어 달라고 부탁해 주세요.</p>'}</div>`;
  if(!url)return '<div class="swr-no-media"><p>파일 주소를 읽지 못했어요. 올린 사람에게 이 버전을 다시 올려 달라고 부탁해 주세요.</p></div>';
  if(version.kind==='video')return `<div class="swr-media-frame"><video src="${escape(url)}" controls playsinline preload="metadata" data-swr-video="${escape(version.id)}" data-swr-slot="${slot}" aria-label="${escape(version.label||'검토 영상')}"></video><p class="swr-media-error" data-swr-media-error hidden role="status">영상을 불러오지 못했어요. 인터넷 연결을 보거나, MP4 · WebM으로 다시 올려 주세요.</p></div>`;
  if(version.kind==='image')return `<div class="swr-media-frame"><img src="${escape(url)}" alt="${escape(version.label||'검토 이미지')}" data-swr-image loading="lazy"><p class="swr-media-error" data-swr-media-error hidden role="status">이미지를 불러오지 못했어요. 인터넷 연결을 보거나, PNG · JPEG로 다시 올려 주세요.</p></div>`;
  return '<div class="swr-no-media"><p>이 버전은 원문에서 봐 주세요.</p></div>';
}
function swrSaveTimes(){document.querySelectorAll('[data-swr-video]').forEach(video=>{if(Number.isFinite(video.currentTime))swr.positions.set(video.dataset.swrVideo,video.currentTime);});}
function swrRender(){swrSaveTimes();render();}

// 검토실: 왼쪽 볼 버전 · 나란히 견주기 · 화면, 오른쪽 이 버전의 의견(남기기 · 거르기 · 목록). 좁으면 위아래로 쌓인다.
function swrRoom(production){
  if(swr.productionId!==production.id){swr.productionId=production.id;swr.versionId='';swr.compareId='';swr.noteScope='current';swr.showResolved=false;}
  const versions=swrVersions(production),version=swrVersion(production);swr.versionId=version?.id||'';
  const canEdit=production.canEdit&&!isViewer(),canComment=production.canComment&&!isViewer();
  if(!version)return `<div class="swr-empty"><strong>아직 올라온 버전이 없어요</strong><p>영상 · 이미지를 올리거나 글 · 링크를 버전으로 남겨요.</p>${canEdit?swBtn('첫 버전 올리기','review-version',{icon:'upload'}):''}</div>`;
  const comparison=versions.find(row=>row.id===swr.compareId&&row.id!==version.id),notes=production.notes||[],here=notes.filter(note=>note.versionId===version.id&&!note.resolved).length;
  const toolbar=`<div class="swr-toolbar"><label class="mt-field"><span>볼 버전</span><select data-swr-version>${versions.map(row=>swrOption(row.id,row.label||swrKinds[row.kind]||'버전',version.id)).join('')}</select></label>${versions.length>1?`<label class="mt-field"><span>나란히 견주기</span><select data-swr-compare>${swrOption('','견주지 않기',comparison?.id||'')}${versions.filter(row=>row.id!==version.id).map(row=>swrOption(row.id,row.label||'이전 버전',comparison?.id)).join('')}</select></label>`:''}${canEdit?swBtn('버전 올리기','review-version',{icon:'upload'}):''}</div>`;
  const screen=(row,slot,label)=>`<section class="swr-screen"><header><span>${label}</span><strong>${escape(row.label||swrKinds[row.kind]||'버전')}</strong></header>${swrMedia(row,slot)}<footer><span>${escape(row.createdByName||'올린 사람')} · ${escape(swrDate(row.createdAt))}</span><span>${escape(swrKinds[row.kind]||'콘텐츠')}</span></footer></section>`;
  const guide=version.kind==='video'?'영상은 끝까지 재생해 보고 의견을 남겨요. 장면 의견에는 지금 재생 시간을 붙일 수 있어요.':version.kind==='text'?'끝까지 읽고 흐름 · 설명 · 마지막 행동에 대한 의견을 남겨요.':'실제 크기로 보고 바꿀 곳을 구체적으로 남겨요.';
  const feedback=`<aside class="swr-feedback" data-swr-feedback><div class="swr-feedback-head"><h4>이 버전의 의견</h4><span class="mt-count">${mtNum(here)}</span></div>${canComment?swrNoteForm(production,version):'<p class="mt-note">의견을 읽을 수만 있어요.</p>'}<div class="swr-note-filters"><label class="sw-select"><span class="sr-only">의견을 볼 버전</span><select data-swr-note-scope>${swrOption('current','이 버전',swr.noteScope)}${swrOption('all','모든 버전',swr.noteScope)}</select></label><label class="mt-check"><input type="checkbox" data-swr-resolved ${swr.showResolved?'checked':''}><span>해결한 의견도 보기</span></label></div><div class="swr-notes" data-swr-notes>${swrNotes(production,version)}</div></aside>`;
  return `<div class="swr-room${comparison?' is-comparing':''}"><div class="swr-viewer">${toolbar}<div class="swr-comparison${comparison?' has-comparison':''}">${comparison?screen(comparison,'comparison','견주는 버전'):''}${screen(version,'current','의견을 남길 버전')}</div><p class="mt-note swr-guide">${escape(guide)}</p></div>${feedback}</div>`;
}
const swrNoteKey=(production,version)=>production.id+':'+version.id;
function swrNoteForm(production,version){
  const kept=swr.notes.get(swrNoteKey(production,version))||{};
  return `<form class="swr-note-form" data-swr-form="note" data-production="${escape(production.id)}" data-version="${escape(version.id)}"><div class="form-error" role="alert"></div><label class="mt-field"><span>어떤 점을 봤나요?</span><textarea name="text" rows="4" required maxlength="2000" data-swr-note-text placeholder="좋았던 장면, 이해가 막힌 곳, 바꾸면 더 좋아질 점을 구체적으로 적어요.">${escape(kept.text||'')}</textarea></label><div class="swr-note-options"><label class="mt-field"><span>관점</span><select name="axis" data-swr-note-axis>${Object.entries(swrAxes).map(([key,label])=>swrOption(key,label,kept.axis||'general')).join('')}</select></label>${version.kind==='video'?`<label class="mt-field"><span>장면 시간 <small>고를 때만</small></span><input name="atSeconds" type="number" min="0" step="0.1" placeholder="초" data-swr-note-time value="${escape(kept.atSeconds||'')}"></label>`:''}</div><div class="swr-form-bottom">${version.kind==='video'?swBtn('지금 시간 넣기','review-capture'):'<span class="mt-note">이 버전에 의견이 남아요.</span>'}<button class="btn primary small" type="submit" ${swr.busy?'disabled':''}>의견 남기기</button></div></form>`;
}
function swrNotes(production,version){
  const versions=new Map((production.versions||[]).map(row=>[row.id,row]));
  const notes=(production.notes||[]).filter(note=>(swr.noteScope==='all'||note.versionId===version.id)&&(swr.showResolved||!note.resolved)).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  if(!notes.length)return `<p class="mt-empty swr-notes-empty">${swr.showResolved||swr.noteScope==='all'?'아직 남긴 의견이 없어요.':'남은 의견이 없어요. 보고 느낀 점을 남겨 봐요.'}</p>`;
  return notes.map(note=>`<article class="swr-note${note.resolved?' is-resolved':''}"><header><strong>${escape(note.ownerName||'팀원')}</strong><span>${escape(swrDate(note.createdAt))}</span></header><div class="swr-note-tags">${mtBadge(swrAxes[note.axis]||'전체 의견')}${swr.noteScope==='all'?`<span>${escape(versions.get(note.versionId)?.label||'이전 버전')}</span>`:''}${note.atSeconds!==null&&Number.isFinite(note.atSeconds)?`<button type="button" class="mt-link" data-action="sw-review-seek" data-id="${escape(note.versionId)}" data-seconds="${note.atSeconds}">${swrTime(note.atSeconds)}부터 보기</button>`:''}</div><p>${escape(note.text)}</p><footer>${note.resolved?mtBadge('해결함','ok'):'<span>남은 의견</span>'}${note.canResolve&&!isViewer()?swBtn(note.resolved?'다시 열기':'해결로 표시','review-resolve',{attrs:`data-id="${escape(note.id)}" ${swr.busy?'disabled':''}`}):''}</footer></article>`).join('');
}
// 「지금 할 일」의 흰 알약이 부르는 곳: 의견 칸에 초점, 또는 의견 목록으로 스크롤.
function swrFocusFeedback(write){sw.folds.room=true;render();const go=()=>{const box=(write?document.querySelector?.('[data-swr-note-text]'):document.querySelector?.('[data-swr-feedback]'))||document.querySelector?.('[data-sw-fold="room"]');box?.scrollIntoView?.({block:write?'center':'start',behavior:'smooth'});if(write&&box?.matches?.('textarea'))box.focus?.({preventScroll:true});};if(typeof requestAnimationFrame==='function')requestAnimationFrame(go);}

// ── 예시 데스크 ──
function swExampleRows(){return (sw.data?.examples||[]).filter(row=>!row.archived);}
function swExampleModel(){const axis=swbFilters().exampleAxis||'',rows=swExampleRows().filter(row=>!axis||row.axis===axis);return {rows,shown:rows,visible:rows.filter(row=>swHit(swExampleSearch(row),sw.exampleQuery||''))};}
function swExampleMeter(){const rows=swExampleRows(),axis=swbFilters().exampleAxis||'',ids=['fun','usefulness','authenticity','personalization',...(rows.some(row=>row.axis==='general')?['general']:[])];return mtMeter(ids.map(id=>({label:swrAxes[id],value:rows.filter(row=>row.axis===id).length,unit:'개',tone:'',attrs:`data-action="sw-example-axis" data-value="${id}"`,pressed:axis===id})));}
function swExampleSearch(row){return [row.title,row.whyGood,row.lesson,row.ownerName].filter(Boolean).join(' ').toLowerCase();}
function swExampleCurrent(model){let row=model.shown.find(item=>item.id===sw.exampleId)||null;if(!row){row=model.visible[0]||null;sw.exampleId=row?.id||'';}return row;}
function swExamplesDesk(){
  const model=swExampleModel(),current=swExampleCurrent(model);
  return `<div class="mt-desk${sw.picking?' is-picking':''}">${swBand(current?`<b>${escape(swrAxes[current.axis]||'전체 의견')}</b> · ${escape(current.title)}`:'고른 예시 없음')}${swExampleList(model,current)}${current?swExampleDetail(current):swExampleEmpty()}</div>`;
}
function swExampleList(model,current){
  const query=sw.exampleQuery||'',all=swExampleRows();
  if(!all.length)return `<aside class="mt-list" aria-label="예시 목록" data-sw-list="examples"><p class="mt-list-empty">예시를 남기면 여기에 쌓여요.</p></aside>`;
  const glyph=kind=>kind==='text'?'file':kind==='link'?'arrow':'image';
  const item=row=>{const text=swExampleSearch(row);return `<button type="button" class="mt-item sw-two" data-action="sw-example-pick" data-id="${escape(row.id)}" data-sw-row="all" data-search="${escape(text)}" aria-current="${current?.id===row.id}" ${swHit(text,query)?'':'hidden'}><span class="mt-tile" aria-hidden="true">${mtIcon(glyph(row.version?.kind))}</span><span><strong>${escape(row.title)}</strong><small><em>${escape(swrAxes[row.axis]||'전체 의견')}</em><span class="mt-item-text">${escape(row.ownerName||'팀원')}</span></small></span><span class="mt-item-end">${escape(row.createdAt?swbDay(String(row.createdAt).slice(0,10))||'':'')}</span></button>`;};
  const found=model.shown.some(row=>swHit(swExampleSearch(row),query));
  return `<aside class="mt-list" aria-label="예시 목록" data-sw-list="examples"><div class="mt-list-tools">${swSearchBox('data-sw-search="examples"',query,'제목 · 좋은 이유 · 배울 점 찾기','예시 찾기')}</div>${model.shown.length?swGroupHead('all',1,swbFilters().exampleAxis?`${swrAxes[swbFilters().exampleAxis]} 예시`:'좋은 예시',model.shown.length,found||!query)+model.shown.map(item).join(''):'<p class="mt-list-empty">이 관점의 예시 0개</p>'}<p class="mt-list-empty" data-sw-none ${query&&model.shown.length&&!found?'':'hidden'}>찾는 예시가 없어요.</p></aside>`;
}
function swExampleEmpty(){
  if(!swExampleRows().length)return `<div class="mt-detail"><div class="mt-detail-empty"><img src="${mtFelt('productions')}" alt="" width="120" height="145" decoding="async"><div><strong>좋은 콘텐츠를 모아 봐요</strong><p>완성한 작업에서 「좋은 예시로 남기기」를 누르면 버전과 좋은 이유가 여기에 모여요.</p></div></div></div>`;
  return `<div class="mt-detail"><div class="mt-detail-empty"><div><strong>고른 관점의 예시가 없어요</strong><p>계기판에서 누른 관점을 다시 누르면 모든 예시가 보여요.</p></div><button type="button" class="btn small" data-action="sw-example-axis" data-value="">조건 지우기</button></div></div>`;
}
function swExampleDetail(row){
  const chips=`${mtBadge(swrAxes[row.axis]||'전체 의견','info')}<span>${escape(swrKinds[row.version?.kind]||'콘텐츠')}</span>`;
  const actions=row.canArchive&&!isViewer()?`<div class="mt-actions">${swBtn('보관','example-archive',{attrs:`data-id="${escape(row.id)}"`})}</div>`:'';
  const head=`<div class="mt-detail-head is-plain"><div><div class="mt-chips">${chips}</div><h2>${escape(row.title)}</h2><p>${escape([row.ownerName||'팀원',swrDate(row.createdAt)].join(' · '))}</p>${actions}</div></div>`;
  return `<div class="mt-detail sw-detail" data-sw-example="${escape(row.id)}">${head}<div class="swr-example-media">${swrMedia(row.version,'example')}</div><div class="swe-notes"><section><h3>좋은 이유</h3><p>${escape(row.whyGood)}</p></section><section><h3>다음 작업에 가져갈 점</h3><p>${escape(row.lesson)}</p></section></div><p class="mt-note sw-foot">예시에는 버전과 위의 두 글만 공유돼요. 작업에 남긴 검토 의견은 공유하지 않아요.</p></div>`;
}

// 기획 화면(content.js)의 「좋은 콘텐츠 · 팀 예시」 — 그 화면의 cp-* 문법 그대로 둔다.
function swExamplesPage(){
  const all=(sw.data?.examples||[]).filter(row=>!row.archived),query=swr.query.toLocaleLowerCase(),examples=all.filter(row=>(swr.axis==='all'||row.axis===swr.axis)&&(!query||[row.title,row.whyGood,row.lesson].join(' ').toLocaleLowerCase().includes(query)));
  return `<section class="cp-team-examples"><div class="cp-section-heading"><div><h2>팀이 모은 좋은 콘텐츠 <span>${all.length}</span></h2><p>좋았던 이유까지 남겨 두고 다음 기획에 써요.</p></div>${['admin','manager'].includes(state.user?.role)?cpButton('예시 추가','example-new','plus','primary'):''}</div>${all.length?`<div class="cp-example-tools"><label class="cp-example-search">${icon('search')}<input type="search" data-swr-example-search value="${escape(swr.query)}" placeholder="제목, 좋은 이유, 배울 점 찾기" aria-label="좋은 예시 검색"></label><select data-swr-example-axis aria-label="예시 관점">${swrOption('all','모든 관점',swr.axis)}${Object.entries(swrAxes).map(([key,label])=>swrOption(key,label,swr.axis)).join('')}</select></div>`:''}${examples.length?`<div class="cp-example-list">${examples.map(example=>`<article class="cp-example-row"><span class="cp-example-kind">${icon(example.version?.kind==='text'?'file':'play')}</span><div class="cp-example-copy"><div class="cp-reference-meta"><span>${escape(swrAxes[example.axis]||'전체 의견')}</span><span>${escape(swrKinds[example.version?.kind]||'콘텐츠')}</span></div><h3>${escape(example.title)}</h3><p>${escape(example.whyGood)}</p><small>${escape(example.ownerName||'팀원')} · ${escape(swrDate(example.createdAt))}</small></div>${swButton('자세히','example-open','arrow','quiet',`data-id="${escape(example.id)}"`)}</article>`).join('')}</div>`:empty(all.length?'조건에 맞는 예시가 없어요':'좋은 콘텐츠를 모아 보세요',all.length?'다른 관점이나 검색어로 찾아 보세요.':'다시 보고 싶은 링크나 글을 좋은 이유와 함께 남겨 보세요.','',true,'bookmark')}</section>`;
}
function swrVersionModal(){
  const production=swDetail();if(!production?.canEdit||isViewer())return;
  modal('버전 올리기','이전 버전은 그대로 두고 새 버전으로 남겨요.',`<form data-swr-form="version" data-production="${escape(production.id)}" class="form-stack swr-version-form"><div class="form-error" role="alert"></div><label class="field">버전 이름<input name="label" required maxlength="100" placeholder="예: 2차 편집 · 도입과 자막 보완"></label><label class="field">올릴 것<select name="kind" data-swr-upload-kind><option value="file">영상 · 이미지 파일</option><option value="text">글 원고</option><option value="link">외부 링크</option></select></label><div data-swr-upload-fields="file"><label class="field">파일<input name="file" type="file" accept="video/mp4,video/webm,image/jpeg,image/png" required><small>MP4 · WebM · JPG · PNG를 100MB까지 올릴 수 있어요. 회사 서버에 저장돼요.</small></label></div><div data-swr-upload-fields="text" hidden><label class="field">검토할 원고<textarea name="text" rows="10" maxlength="20000" disabled></textarea></label></div><div data-swr-upload-fields="link" hidden><label class="field">원문 주소<input name="url" type="url" maxlength="2000" placeholder="https://…" disabled><small>SNS 게시물은 새 탭에서 열어 봐요.</small></label></div><p class="swr-upload-status" role="status" data-swr-upload-status></p><div class="modal-actions">${button('닫기','close-modal')}<button class="btn primary" type="submit">올리기</button></div></form>`,true);
}
function swrExampleModal(){
  const production=swDetail(),version=production&&swrVersion(production);if(!version||!production.canPublishExample||!['ready','published'].includes(production.stage)||isViewer())return;
  modal('좋은 예시로 남기기','어떤 선택이 좋았는지 함께 남겨요.',`<form data-swr-form="example" data-production="${escape(production.id)}" data-version="${escape(version.id)}" class="form-stack"><div class="form-error" role="alert"></div><div class="swr-share-context"><span>회사에 공유할 버전</span><strong>${escape(production.title)} · ${escape(version.label)}</strong><p>이 버전과 아래에 적은 이유 · 배울 점을 회사 크루 모두가 봐요. 작업에 남긴 검토 의견은 공유하지 않아요.</p></div><label class="field">예시 제목<input name="title" required maxlength="200" value="${escape(production.title)}"></label><label class="field">어떤 관점에서 좋았나요?<select name="axis">${Object.entries(swrAxes).filter(([key])=>key!=='general').map(([key,label])=>swrOption(key,label,'fun')).join('')}</select></label><label class="field">좋은 이유<textarea name="whyGood" required maxlength="2000" rows="3" placeholder="어느 장면의 어떤 선택이 왜 좋았나요?"></textarea></label><label class="field">다음 작업에서 배울 점<textarea name="lesson" required maxlength="2000" rows="3" placeholder="어떤 상황에 이 방법을 다시 써 볼 수 있을까요?"></textarea></label><label class="swr-consent"><input type="checkbox" name="shareConfirmed" required>이 버전과 적은 내용을 회사에 공유해요.</label><div class="modal-actions">${button('닫기','close-modal')}<button class="btn primary" type="submit">공유</button></div></form>`,true);
}
function swrOpenExample(id){
  const example=(sw.data?.examples||[]).find(row=>row.id===id&&!row.archived);if(!example)return;
  modal(escape(example.title),'팀이 남긴 완성본과 배울 점',`<article class="swr-example-detail"><div class="swr-example-detail-media">${swrMedia(example.version,'example')}</div><div class="swr-example-detail-copy"><span class="status-badge">${escape(swrAxes[example.axis]||'전체 의견')}</span><h3>좋은 이유</h3><p>${escape(example.whyGood)}</p><h3>다음 작업에 가져갈 점</h3><p>${escape(example.lesson)}</p><footer>${escape(example.ownerName||'팀원')} · ${escape(swrDate(example.createdAt))}</footer>${example.canArchive&&!isViewer()?swButton('보관','example-archive','archive','quiet small',`data-id="${escape(example.id)}"`):''}</div></article>`,true);
}

document.addEventListener('loadedmetadata',event=>{const video=event.target;if(!video.matches?.('[data-swr-video]'))return;const position=swr.positions.get(video.dataset.swrVideo);if(Number.isFinite(position)&&position>0){try{video.currentTime=Math.min(position,Number.isFinite(video.duration)?Math.max(0,video.duration-.01):position);}catch{}}},true);
document.addEventListener('error',event=>{const media=event.target;if(!media.matches?.('[data-swr-video],[data-swr-image]'))return;const message=media.parentElement?.querySelector('[data-swr-media-error]');if(message)message.hidden=false;},true);
document.addEventListener('input',event=>{const input=event.target;if(input.matches?.('[data-sw-search="examples"]')){sw.exampleQuery=input.value;swFilterRows('examples',input.value);return;}
  const form=input.closest?.('form[data-swr-form="note"]');if(!form||!input.matches?.('[data-swr-note-text],[data-swr-note-time]'))return;const key=form.dataset.production+':'+form.dataset.version,kept=swr.notes.get(key)||{};swr.notes.set(key,{...kept,[input.matches('[data-swr-note-text]')?'text':'atSeconds']:input.value});});
document.addEventListener('change',event=>{
  const target=event.target;
  if(target.matches('[data-swr-version]')){swrSaveTimes();swr.versionId=target.value;if(swr.compareId===target.value)swr.compareId='';render();}
  else if(target.matches('[data-swr-compare]')){swr.compareId=target.value;swrRender();}
  else if(target.matches('[data-swr-note-scope]')){swr.noteScope=target.value;swrRender();}
  else if(target.matches('[data-swr-resolved]')){swr.showResolved=target.checked;swrRender();}
  else if(target.matches('[data-swr-note-axis]')){const form=target.closest('form'),key=form.dataset.production+':'+form.dataset.version;swr.notes.set(key,{...(swr.notes.get(key)||{}),axis:target.value});}
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
    else if(action==='review-note'||action==='review-notes')swrFocusFeedback(action==='review-note');
    else if(action==='example-open')swrOpenExample(target.dataset.id);
    else if(action==='example-pick'){sw.exampleId=target.dataset.id;sw.picking=false;render();}
    else if(action==='example-axis'){const filters=swbFilters(),value=target.dataset.value||'';filters.exampleAxis=filters.exampleAxis===value?'':value;if(!swExampleModel().shown.some(row=>row.id===sw.exampleId))sw.exampleId='';render();}
    else if(action==='review-capture'){const video=document.querySelector('[data-swr-slot="current"][data-swr-video]'),input=document.querySelector('[data-swr-form="note"] [name="atSeconds"]');if(!video||!input||!Number.isFinite(video.currentTime))throw new Error('영상이 아직 열리지 않았어요. 재생한 뒤 다시 눌러 주세요.');input.value=Math.round(video.currentTime*10)/10;input.focus();}
    else if(action==='review-seek'){const version=(production?.versions||[]).find(row=>row.id===target.dataset.id),seconds=Number(target.dataset.seconds);if(version?.kind!=='video'||!Number.isFinite(seconds)||seconds<0)return;const playing=document.querySelector(`[data-swr-slot="current"][data-swr-video="${CSS.escape(version.id)}"]`);if(swr.versionId===version.id&&playing){if(playing.readyState>=1)playing.currentTime=Math.min(seconds,Number.isFinite(playing.duration)?playing.duration:seconds);else swr.positions.set(version.id,seconds);playing.focus?.();return;}swrSaveTimes();swr.versionId=version.id;swr.positions.set(version.id,seconds);if(swr.compareId===version.id)swr.compareId='';render();const video=document.querySelector('[data-swr-slot="current"][data-swr-video]');if(video?.readyState>=1)video.currentTime=Math.min(seconds,Number.isFinite(video.duration)?video.duration:seconds);video?.focus();}
    else if(action==='review-resolve'){
      const note=production?.notes?.find(row=>row.id===target.dataset.id);if(!note?.canResolve||swr.busy||isViewer())return;
      const operation=++swr.operation;swr.busy=true;target.disabled=true;
      try{const result=await api(`/api/studio-productions/${encodeURIComponent(production.id)}/notes/${encodeURIComponent(note.id)}`,{resolved:!note.resolved});if(!swAlive(guard)||swDetail()?.id!==production.id)return;swAcceptProduction(result.production);swr.busy=false;if(swVisible()&&['board','review'].includes(sw.view))swrRender();}
      finally{if(operation===swr.operation)swr.busy=false;if(target.isConnected)target.disabled=false;}
    }else if(action==='example-archive'){
      const example=sw.data?.examples?.find(row=>row.id===target.dataset.id);if(!example?.canArchive||swr.busy||isViewer())return;
      // 모달(기획 화면 · 자세히)에서 눌렀을 때만 모달을 닫는다. 예시 데스크의 상세에서 누르면 목록만 다시 그린다.
      const operation=++swr.operation,modalRequest=state.modalRequest,inModal=!!target.closest?.('#overlay');swr.busy=true;target.disabled=true;
      try{await api('/api/studio-examples/'+encodeURIComponent(example.id),{archived:true});if(!swAlive(guard))return;sw.data.examples=sw.data.examples.filter(row=>row.id!==example.id);if(sw.exampleId===example.id)sw.exampleId='';const sameSource=target.isConnected&&state.modalRequest===modalRequest;if(sameSource&&inModal)closeModal();if(sameSource&&(swVisible()&&sw.view==='examples'||state.tab==='content'&&cp.view==='examples'))render();notify('예시를 보관했어요.');}
      finally{if(operation===swr.operation)swr.busy=false;if(target.isConnected)target.disabled=false;}
    }
  }catch(error){if(swAlive(guard))notify(error.message);}
});
document.addEventListener('submit',async event=>{
  const form=event.target.closest('form[data-swr-form]');if(!form)return;event.preventDefault();if(isViewer()||form.dataset.busy==='true'||swr.busy&&form.dataset.swrForm!=='version')return;
  const production=swDetail(),id=form.dataset.production;if(!production||production.id!==id)return;
  const kind=form.dataset.swrForm;if((kind==='version'&&!production.canEdit)||(kind==='note'&&!production.canComment)||(kind==='example'&&!production.canPublishExample))return;
  const guard=swGuard(),operation=++swr.operation,modalRequest=state.modalRequest,button=form.querySelector('[type="submit"]'),errorBox=form.querySelector('.form-error'),values=new FormData(form);
  const lockAll=kind!=='version';if(lockAll)swr.busy=true;form.dataset.busy='true';button.disabled=true;button.setAttribute('aria-busy','true');errorBox.textContent='';
  try{
    let result;
    if(kind==='version'){
      const versionKind=values.get('kind'),label=String(values.get('label')||'').trim();
      if(versionKind==='file'){const file=values.get('file');if(!file?.size)throw new Error('올릴 영상이나 이미지 파일을 골라 주세요.');if(file.size>100*1024*1024)throw new Error('100MB 이하 파일을 골라 주세요.');form.querySelector('[data-swr-upload-status]').textContent='파일을 올리고 있어요. 끝날 때까지 이 창을 열어 둬요.';result=await swUploadMedia(id,file,label,percent=>{const status=form.querySelector('[data-swr-upload-status]');if(swAlive(guard)&&form.isConnected&&status)status.textContent=percent<100?`올리는 중 ${percent}%`:'파일을 살펴보고 저장하고 있어요.';});}
      else result=await api(`/api/studio-productions/${encodeURIComponent(id)}/versions`,{label,kind:versionKind,...(versionKind==='text'?{text:values.get('text')}:{url:values.get('url')})});
    }else if(kind==='note'){
      const raw=values.get('atSeconds'),atSeconds=raw===null||raw===''?null:Number(raw);if(atSeconds!==null&&(!Number.isFinite(atSeconds)||atSeconds<0))throw new Error('장면 시간은 0 이상의 초로 넣어 주세요.');
      result=await api(`/api/studio-productions/${encodeURIComponent(id)}/notes`,{versionId:form.dataset.version,text:values.get('text'),axis:values.get('axis'),atSeconds});
    }else if(kind==='example'){
      if(values.get('shareConfirmed')!=='on')throw new Error('회사에 공유한다는 칸을 눌러 주세요.');
      result=await api('/api/studio-examples',{productionId:id,versionId:form.dataset.version,title:values.get('title'),whyGood:values.get('whyGood'),lesson:values.get('lesson'),axis:values.get('axis'),shareConfirmed:true});
    }
    if(!swAlive(guard))return;
    const same=swDetail()?.id===id,sourceAlive=same&&form.isConnected&&(kind==='note'||state.modalRequest===modalRequest)&&swVisible()&&['board','review'].includes(sw.view);
    if(kind==='example'){if(result.example&&sw.data)sw.data.examples=[result.example,...(sw.data.examples||[]).filter(row=>row.id!==result.example.id)];}
    else if(same){swAcceptProduction(result.production);if(kind==='version'&&sourceAlive){swr.versionId=swrVersions(result.production)[0]?.id||'';swr.compareId='';}}
    if(kind==='note')swr.notes.delete(id+':'+form.dataset.version);
    if(!sourceAlive){notify(kind==='note'?(same?'의견을 저장했어요.':'이전 작업의 의견을 저장했어요.'):kind==='example'?'고른 예시를 공유했어요.':same?'새 버전을 저장했어요.':'이전 작업의 새 버전을 저장했어요.');return;}
    if(kind!=='note'&&form.isConnected&&state.modalRequest===modalRequest)closeModal();
    if(kind==='note'&&form.isConnected)form.reset();
    swr.busy=false;swrRender();notify(kind==='example'?'이 버전을 「예시」에 공유했어요.':kind==='note'?'이 버전에 의견을 남겼어요.':'새 버전을 저장했어요.');
  }catch(error){if(swAlive(guard)){if(form.isConnected)errorBox.textContent=error.message;else notify(error.message);}}
  finally{if(lockAll&&operation===swr.operation)swr.busy=false;form.dataset.busy='false';if(button.isConnected){button.disabled=false;button.removeAttribute('aria-busy');}const status=form.querySelector('[data-swr-upload-status]');if(status?.isConnected)status.textContent='';}
});
