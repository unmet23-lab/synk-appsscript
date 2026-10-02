'use strict';

// Company content workspace. Drafts and references remain on the company server.
const cpBlank = () => ({seriesId:'synkbrief-use',topic:'',audience:'',experience:'',proof:'',takeaway:'',entertainment:'',channelId:'',referenceId:'',benchmarkId:'',benchmarkItemId:'',personalization:{situation:'',choice:'',nextStep:''},authenticity:{basis:'',ownPerspective:'',limits:'',disclosure:''}});
const cp = {userId:'',request:0,detailRequest:0,generationRequest:0,generating:false,activeDraft:null,data:null,view:'library',exampleView:'team',libraryQuery:'',input:cpBlank(),draftId:'',pendingDraftId:'',ideaId:'',results:null,query:'',error:'',loading:false,busy:false};
const cpStatuses = {draft:'아이디어',review:'검토 중',ready:'제작 준비',archived:'보관'};
// Dated research notes, kept separate from saved company references and live search.
const cpResearchReferences = [
  {title:'제품 기능을 실제 사용 예시로 연결하기',url:'https://www.instagram.com/reel/DdCXClWtmD3/',creator:'chatgpt · openai',publishedAt:'2026-09-08',dateStatus:'research-caption',source:'research',formatNotes:'공식 제품 소개의 캡션 참고: 기능 설명에서 사용 예시로 연결하는 구조. 우리 기획에서는 직접 실행한 한 가지 사례와 적용 조건을 더해 보세요.'},
  {title:'익숙한 결과와 어색한 재현의 차이',url:'https://www.instagram.com/reel/Dc-qbJzA05Q/',creator:'evolving.ai',publishedAt:'2026-09-07',dateStatus:'research-caption',source:'research',formatNotes:'Blender로 재현한 Rickroll 사례의 캡션 참고. 기대한 모습과 다른 결과를 비교하며 웃음과 기술 설명을 연결하는 방식. 원 게시자가 실험 제작자인지는 확인하지 못했습니다.'},
  {title:'5개월 만든 앱을 다시 만드는 기록',url:'https://www.instagram.com/reel/DdB2fg5E82Y/',creator:'imjesseshow',publishedAt:null,source:'research',formatNotes:'제작자의 캡션 참고: 겪은 문제 → 반복하지 않을 선택 → 재시작 → 다음 기록의 약속. 우리 제작 여정의 실제 경험으로 전개를 재구성해 보세요. 정확한 게시일은 미확인입니다.'}
];
function cpInvalidateGeneration(){cp.generationRequest++;if(cp.generating){cp.generating=false;cp.busy=false;}}
function resetContentWorkspace() { bmReset();cpInvalidateGeneration();cp.request++; cp.detailRequest++; cp.activeDraft=null; Object.assign(cp,{userId:'',data:null,view:'library',exampleView:'team',libraryQuery:'',input:cpBlank(),draftId:'',pendingDraftId:'',ideaId:'',results:null,query:'',error:'',loading:false,busy:false}); }
async function cpNavigate(view) {
  if(!['library','plan','examples','benchmarks','discover'].includes(view))return;
  cpInvalidateGeneration();
  cp.detailRequest++;
  if(view==='benchmarks'||view==='discover'){cp.exampleView=view;view='examples';}
  cp.view=view;state.tab='content';render();
  if(view==='examples'&&cp.exampleView==='team')await swLoadExamples();
}
async function loadContentWorkspace() {
  if (!state.user) return;
  if (cp.userId !== state.user.id) {const entry=cp.view,pending=cp.pendingDraftId;resetContentWorkspace();if(['library','plan','examples'].includes(entry))cp.view=entry;if(pending){cp.draftId=pending;cp.view='plan';}}
  cp.pendingDraftId='';
  cp.userId=state.user.id;
  const userId=cp.userId,request=++cp.request; cp.loading=true;cp.error=''; if(state.tab==='content')render();
  try { const data=await api('/api/content-workspace'); if(request!==cp.request||state.user?.id!==userId)return;cp.data=data;if(cp.draftId){cp.activeDraft=null;await cpOpenDraft(cp.draftId,false);}if(cp.view==='examples'&&cp.exampleView==='team')await swLoadExamples(); }
  catch(error){if(request===cp.request)cp.error=error.message;}
  finally{if(request===cp.request){cp.loading=false;if(state.tab==='content')render();}}
}
const cpCatalog = () => cp.data?.catalog?.series || [];
const cpSeries = id => cpCatalog().find(row=>row.id===id);
const cpDraft = () => cp.activeDraft?.id===cp.draftId?cp.activeDraft:cp.data?.drafts?.find(row=>row.id===cp.draftId&&row.plan);
const cpButton = (text,action,glyph='',classes='',attrs='') => button(text,'cp-'+action,glyph,classes,attrs);
const cpOption = (value,label,selected) => `<option value="${escape(value)}" ${value===selected?'selected':''}>${escape(label)}</option>`;
const cpText = value => escape(Array.isArray(value)?value.join(' · '):value);
const cpList = values => `<ul>${(values||[]).map(value=>`<li>${cpText(value)}</li>`).join('')}</ul>`;
function contentPage() {
  const heading=pageHeading('CONTENT','콘텐츠 기획','아이디어를 정리하고, 좋은 콘텐츠에서 배웁니다.',cpButton('제작 기준','guide','info','quiet'));
  if(!cp.data)return heading+(cp.error?`<div class="cp-message" role="alert">${escape(cp.error)}${cpButton('다시 불러오기','reload','refresh')}</div>`:'<div class="loading-panel"><span class="loading-line"></span><p>제작 양식과 기획함을 불러오고 있어요.</p></div>');
  const selected=['benchmarks','discover'].includes(cp.view)?'examples':cp.view;
  const blank=cpBlank(),draft=cpDraft(),hasWorkingPlan=Boolean(draft||cp.draftId||selected==='plan')||Object.keys(blank).some(key=>JSON.stringify(cp.input?.[key]??blank[key])!==JSON.stringify(blank[key]));
  const tabs=[['library','기획함'],...(hasWorkingPlan?[['plan',draft||cp.draftId?'기획안':selected==='plan'?'기획 작성':'작성 중']]:[]),['examples','좋은 콘텐츠']];
  return `${heading}<div class="cp-workspace"><nav class="cp-tabs" aria-label="콘텐츠 기획 메뉴">${tabs.map(([key,label])=>`<button type="button" data-action="cp-view" data-view="${key}" class="${selected===key?'active':''}" aria-current="${selected===key?'page':'false'}">${label}${key==='library'?`<span>${cp.data.drafts.length}</span>`:''}</button>`).join('')}</nav>${cp.error?`<p class="cp-message" role="alert">${escape(cp.error)}</p>`:''}${selected==='examples'?cpExamples():selected==='library'?cpLibrary():cpDraft()?cpResult():cpComposer()}</div>`;
}
function cpExamples(){
  const selected=['benchmarks','discover'].includes(cp.view)?cp.view:cp.exampleView;
  return `<nav class="cp-example-nav" aria-label="좋은 콘텐츠 분류">${[['team','팀 예시'],['benchmarks','벤치마크'],['discover','개인 참고']].map(([id,label])=>`<button type="button" data-action="cp-example-view" data-view="${id}" aria-pressed="${selected===id}">${label}</button>`).join('')}</nav>${selected==='benchmarks'?bmBenchmarks():selected==='discover'?cpDiscover():sw.error?`<div class="cp-message" role="alert">${escape(sw.error)}${cpButton('다시 불러오기','examples-reload','refresh')}</div>`:!sw.data||sw.loading?'<div class="loading-panel"><p>좋은 콘텐츠를 불러오고 있어요.</p></div>':swExamplesPage()}`;
}
function cpComposer(){
  const selected=cpSeries(cp.input.seriesId)||cpCatalog()[0],channels=(state.data?.channels||[]).filter(row=>canEditChannel(row)&&row.active!==false);
  return `<section class="cp-composer"><header class="cp-composer-heading"><h2>어떤 이야기를 만들까요?</h2><p>주제부터 적고, 필요한 내용을 더해 보세요.</p></header><form data-cp-form="generate" class="cp-form"><div class="form-error" role="alert"></div>${bmSelection()}
    <label class="field">콘텐츠 시리즈<select name="seriesId" data-cp-input>${cpCatalog().map(row=>cpOption(row.id,row.name,cp.input.seriesId)).join('')}</select></label><div class="cp-series-note" id="cp-series-note">${cpSeriesNote(selected)}</div>
    <label class="field cp-topic">이야기할 주제 <span class="cp-required">필수</span><textarea name="topic" required maxlength="300" rows="2" data-cp-input placeholder="예: 회의 녹음을 실행할 일 목록으로 바꾸는 방법">${escape(cp.input.topic)}</textarea></label>
    <div class="cp-field-row"><label class="field">누가 보면 좋을까요?<input name="audience" maxlength="500" data-cp-input value="${escape(cp.input.audience)}" placeholder="예: 회의 메모 정리가 어려운 팀원"></label><label class="field">무엇을 얻어 갈까요?<input name="takeaway" maxlength="2000" data-cp-input value="${escape(cp.input.takeaway)}" placeholder="보고 나서 할 수 있는 한 가지"></label></div>
    <details class="cp-form-details"><summary>경험과 구성 보완 <span>직접 겪은 일 · 근거 · 재미</span></summary><div class="cp-details-body"><label class="field">직접 겪은 일이나 발견<textarea name="experience" maxlength="3000" rows="3" data-cp-input placeholder="어디서 막혔고, 무엇을 시도했나요?">${escape(cp.input.experience)}</textarea></label><label class="field">보여 줄 수 있는 근거<textarea name="proof" maxlength="3000" rows="2" data-cp-input placeholder="실제 결과, 작업 기록, 공식 자료 링크">${escape(cp.input.proof)}</textarea></label><label class="field">끝까지 볼 이유<textarea name="entertainment" maxlength="2000" rows="2" data-cp-input placeholder="궁금한 결과, 공감하는 실패, 뜻밖의 비교">${escape(cp.input.entertainment)}</textarea></label></div></details>
    ${cpPersonalizationInput()}${cpAuthenticityInput()}
    <details class="cp-form-details"><summary>참고 자료와 공유 범위 <span>선택 사항</span></summary><div class="cp-details-body"><label class="field">개인 참고 자료<select name="referenceId" data-cp-input ${cp.input.benchmarkId?'disabled':''}>${cpOption('','참고 없이 시작',cp.input.referenceId)}${cp.data.references.map(row=>cpOption(row.id,row.title||row.url,cp.input.referenceId)).join('')}</select></label><label class="field">담당 채널<select name="channelId" data-cp-input>${cpOption('','채널 없이 개인 기획',cp.input.channelId)}${channels.map(row=>cpOption(row.id,channelName(row),cp.input.channelId)).join('')}</select><small>개인 기획은 작성자와 관리자만 봅니다. 채널을 지정하면 해당 팀 담당자도 볼 수 있어요.</small></label></div></details>
    <div class="cp-submit"><p>${isViewer()?'조회 전용 계정은 저장된 기획을 볼 수 있어요.':'만든 구성안은 기획함에 저장됩니다.'}</p><button type="submit" class="btn primary" ${isViewer()||cp.busy?'disabled':''}>${cp.busy?'구성안을 만드는 중…':'구성안 3개 만들기'}${icon('arrow')}</button></div></form></section>`;
}
function cpSeriesNote(series){return `<strong>${escape(series?.concept||'')}</strong><span>${cpText(series?.format||'')}</span>`;}
function cpDiscover(){
  const results=cp.results?.results||[],links=cp.results?.links||[];
  return `<section class="cp-reference-library"><div class="cp-section-heading"><div><h2>개인 참고 자료 <span>${cp.data.references.length}</span></h2><p>다시 보고 싶은 릴스와 배울 점을 모아 두세요.</p></div>${!isViewer()?cpButton('참고 등록','reference','plus','primary'):''}</div>${cp.data.references.length?`<div class="cp-reference-list">${cp.data.references.map(row=>cpReferenceCard(row,row.id,false)).join('')}</div>`:empty('저장한 참고 자료가 없어요','마음에 드는 릴스 링크를 남겨 다음 기획에 활용하세요.','',true,'bookmark')}
    <details class="cp-find-reference" ${cp.results?'open':''}><summary>새로운 참고 자료 찾기</summary><form data-cp-form="search" class="cp-search-form"><label>${searchIcon()}<input name="query" type="search" required maxlength="150" value="${escape(cp.query)}" aria-label="찾고 싶은 콘텐츠 주제" placeholder="예: AI 실무 활용, 한국어 일상 표현"></label><select name="days" aria-label="탐색 기간"><option value="7">최근 7일</option><option value="30" selected>최근 30일</option></select><button class="btn" type="submit" ${isViewer()||cp.busy?'disabled':''}>참고 찾기</button><div class="form-error" role="alert"></div></form>${cp.results?`<div class="cp-search-output" aria-live="polite"><p class="cp-search-notice">${escape(cp.results.notice||'게시일과 반응은 원문에서 확인해 주세요.')}</p><div class="cp-external-links">${links.map(link=>`<a class="btn quiet" href="${escape(safeUrl(link.url))}" target="_blank" rel="noopener noreferrer">${escape(link.label)}${icon('external')}</a>`).join('')}</div>${results.map((row,index)=>cpReferenceCard(row,index,true)).join('')}</div>`:''}</details></section>`;
}
function cpReferenceCard(row,id,candidate) {
  const stats=Object.entries(row.metrics||{}).filter(([,v])=>validNumber(v));
  const reel=/^https:\/\/(?:www\.)?instagram\.com\/reel\//.test(row.url||'');
  const evidence=row.source==='company-post'?'담당 채널 수집 · 누적값':row.source==='research'?'구성 참고 · 인기 미검증':candidate?'탐색 후보 · 인기 미검증':'직접 기록 · 인기 미검증';
  const dateLabel=row.dateStatus==='provider-reported'?'검색 색인 날짜 ':row.source==='research'?'원문 표기 날짜 ':'게시일 ';
  const action=!isViewer()?(row.referenceId?cpButton('기획에 활용','use-reference','arrow','small',`data-id="${escape(row.referenceId)}"`):candidate?(reel?cpButton('기록하기','reference','','small',`data-index="${id}"`):''):cpButton('기획에 활용','use-reference','arrow','small',`data-id="${escape(id)}"`)):'';
  return `<article class="cp-reference-row"><div class="cp-reel-mark">${icon('play')}</div><div class="cp-reference-copy"><div class="cp-reference-meta"><span>${evidence}</span><span>${row.publishedAt?dateLabel+escape(String(row.publishedAt).slice(0,10)):'게시일 미확인'}</span></div><h4><a href="${escape(safeUrl(row.url))}" target="_blank" rel="noopener noreferrer">${escape(row.title||'참고 릴스')}${icon('external')}</a></h4>${row.formatNotes?`<p>${escape(row.formatNotes)}</p>`:''}<div class="cp-reference-meta">${row.creator?`<span>${escape(row.creator)}</span>`:''}${stats.map(([key,v])=>`<span>${escape(METRICS.find(m=>m[0]===key)?.[1]||key)} ${number(v)}</span>`).join('')}${(row.checkedAt||row.observedAt)?`<span>관찰 ${time(row.checkedAt||row.observedAt)}</span>`:''}</div></div><div class="cp-reference-actions">${action}</div></article>`;
}
function cpLibrary() {
  return `<section><div class="cp-section-heading"><div><h2>저장한 기획</h2><p>이어서 작성하거나, 마음에 드는 구성을 골라 보세요.</p></div>${!isViewer()?cpButton('새 기획','new','plus','primary'):''}</div>${cp.data.drafts.length?`<div class="cp-draft-list">${cp.data.drafts.map((draft,index)=>`<button class="cp-draft-row" data-action="cp-open" data-id="${escape(draft.id)}"><span class="cp-draft-number">${String(index+1).padStart(2,'0')}</span><span class="cp-draft-copy"><small>${escape(cpSeries(draft.seriesId||draft.plan?.seriesId||draft.input?.seriesId)?.name||'콘텐츠 기획')}</small><strong>${escape(draft.title||draft.plan?.topic||'제목 없는 기획')}</strong><span>${escape(draft.ownerName||state.data.members?.find(u=>u.id===draft.ownerId)?.name||'작성자')} · ${time(draft.updatedAt||draft.createdAt)}</span></span><span class="status-badge ${draft.status==='ready'?'good':''}">${cpStatuses[draft.status]||'아이디어'}</span>${icon('right')}</button>`).join('')}</div>`:empty('아직 저장한 기획안이 없어요','주제와 우리만의 경험을 적으면 세 가지 구성안이 이곳에 저장됩니다.','',false,'bookmark')}</section>`;
}
const cpAuthenticityFields = [
  ['basis','사실과 경험의 바탕','직접 겪은 일인지, 조사·인터뷰·실험한 내용인지 구분해 주세요.'],
  ['ownPerspective','우리만의 생각과 선택','이 이야기를 우리가 하는 이유, 직접 판단하거나 다르게 시도한 점'],
  ['limits','솔직하게 밝혀야 할 한계','잘 안 된 점, 아직 확인하지 못한 부분, 적용이 어려운 조건'],
  ['disclosure','출처와 연출 표시','참고 출처, AI 생성·재구성 장면, 협찬·광고 여부. 없다면 없다고 적어 주세요.']
];
function cpAuthenticityInput() {
  return `<details class="cp-auth-input"><summary><span>진정성 점검</span><small>진짜 우리의 이야기인가요?</small></summary><p>그럴듯한 이야기보다, 우리가 확인한 사실과 솔직한 관점을 남겨요.</p><div class="cp-field-row">${cpAuthenticityFields.map(([id,label,hint])=>`<label class="field">${label}<textarea name="auth-${id}" maxlength="2000" rows="2" data-cp-input placeholder="${hint}">${escape(cp.input.authenticity?.[id]||'')}</textarea></label>`).join('')}</div></details>`;
}
function cpCheckRows(items) {
  return `<div class="cp-checks">${(items||[]).map(row=>`<div class="cp-check"><span class="cp-check-symbol ${row.status==='provided'?'provided':''}">${icon(row.status==='provided'?'check':'info')}</span><div><strong>${escape(row.label)}</strong><p>${escape(row.detail)}</p></div><span class="cp-check-status">${({provided:'작성됨',review:'직접 검토', 'needs-input':'보완 필요'})[row.status]||'직접 검토'}</span></div>`).join('')}</div>`;
}
function cpResult() {
  const draft=cpDraft(),plan=draft.plan,ideas=plan.ideas||[],chosen=ideas.find(row=>row.id===(cp.ideaId||draft.selectedIdeaId))||ideas[0];
  if(!chosen)return empty('구성안을 불러오지 못했어요','기획함에서 다른 기획을 열거나 새로 만들어 주세요.',cpButton('새 기획','new','plus'),true);
  return `<section class="cp-result"><div class="cp-result-top"><div><span class="cp-overline">${escape(cpSeries(plan.seriesId)?.name||'콘텐츠 기획')} · 저장됨</span><h2>${escape(draft.title)}</h2><p>${escape(draft.ownerName||'작성자')} · ${time(draft.updatedAt)} · 제작 양식 기반 초안</p></div><div class="cp-result-actions">${!isViewer()?cpButton('검토 요청','request-review','chat','primary'):''}${cpButton('내용 보완해서 새 기획','revise','refresh','quiet',isViewer()?'disabled':'')}<a class="btn" href="/api/content-drafts/${encodeURIComponent(draft.id)}/export" download>제작안 내려받기${icon('download')}</a><label class="cp-status-control"><span>검토 상태</span><select data-cp-status ${isViewer()?'disabled':''}>${Object.entries(cpStatuses).map(([id,label])=>cpOption(id,label,draft.status)).join('')}</select></label></div></div><details class="cp-result-review"><summary>기획 점검</summary>${cpReviewAxes(plan)}</details><div class="cp-idea-options" aria-label="세 가지 구성안">${ideas.map((idea,index)=>`<button type="button" class="cp-idea-option ${idea.id===chosen.id?'active':''}" data-action="cp-idea" data-id="${escape(idea.id)}" aria-pressed="${idea.id===chosen.id}"><span>구성 ${String(index+1).padStart(2,'0')}${draft.selectedIdeaId===idea.id?' · 선택됨':''}</span><strong>${escape(idea.title)}</strong><small>${escape(idea.angle)}</small></button>`).join('')}</div><div class="cp-brief-layout"><article class="cp-brief"><div class="cp-brief-opening"><span class="cp-overline">첫 장면의 한마디</span><h3>${escape(chosen.hook)}</h3><p>${escape(chosen.viewerReason)}</p>${!isViewer()?cpButton(draft.selectedIdeaId===chosen.id?'이 구성으로 선택됨':'이 구성 선택하기','select-idea','check','small',`data-id="${escape(chosen.id)}" ${draft.selectedIdeaId===chosen.id?'disabled':''}`):''}</div><div class="cp-story"><div class="cp-section-heading"><h3>이야기 구성</h3><span>길이와 대사는 촬영 전에 조정해요</span></div>${(chosen.storyBeats||[]).map((beat,index)=>`<section class="cp-beat"><div class="cp-beat-index"><span>${String(index+1).padStart(2,'0')}</span><small>${escape(beat.time)}</small></div><div><h4>화면</h4><p>${escape(beat.visual)}</p><h4>말할 내용</h4><p class="cp-narration">${escape(beat.narration)}</p></div></section>`).join('')}</div><div class="cp-payoff"><div><span>얻어 갈 정보</span><p>${escape(chosen.takeaway)}</p></div><div><span>계속 볼 재미</span><p>${escape(chosen.entertainment)}</p></div></div><details class="cp-brief-bottom"><summary>자료와 사실 확인</summary><h3>필요한 자료</h3>${cpList(chosen.materials)}<h3>사실 확인</h3>${cpList(chosen.factChecks)}${chosen.referenceAdaptation?`<h3>참고를 우리 것으로 바꾸기</h3><p>${cpText(typeof chosen.referenceAdaptation==='object'?Object.values(chosen.referenceAdaptation):chosen.referenceAdaptation)}</p>`:''}</details></article><details class="cp-result-review cp-final-review"><summary>제작 전 확인할 내용</summary><div class="cp-review"><section><div class="cp-section-heading"><h3>진정성 점검</h3>${icon('heart')}</div><p class="cp-review-intro">${escape(plan.authenticity?.summary||'경험의 사실성, 우리 관점, 한계와 출처를 직접 확인해 주세요.')}</p>${cpCheckRows(plan.authenticity?.items)}<p class="cp-review-note">‘작성됨’은 내용이 있다는 뜻입니다. 사실 여부나 진정성을 자동으로 인증하지 않아요.</p></section><section><h3>개인화 점검</h3><p class="cp-review-intro">${escape(plan.personalization?.summary||'시청자의 상황과 선택, 다음 행동을 확인해 주세요.')}</p>${cpCheckRows(plan.personalization?.items)}</section><section><h3>제작 전 확인</h3>${cpCheckRows(plan.checklist)}</section>${plan.missingQuestions?.length?`<section class="cp-missing"><h3>조금 더 채워 볼 질문</h3><ul>${plan.missingQuestions.map(row=>`<li>${escape(row.question||row)}</li>`).join('')}</ul></section>`:''}<details class="cp-sources"><summary>적용한 제작 기준</summary>${cpList(plan.guidance)}<ul>${(plan.sourcePaths||[]).map(path=>`<li>${escape(path.split('/').pop())}</li>`).join('')}</ul></details></div></details></div></section>`;
}
function cpGuide() {
  modal('우리가 콘텐츠를 만드는 기준','재미 · 도움 · 진정성 · 개인화.',`<div class="cp-guide-modal">${(cp.data?.catalog?.guidelines||[]).map((row,index)=>`<section><span>${String(index+1).padStart(2,'0')}</span><div><h3>${escape(row.title)}</h3><p>${escape(row.detail)}</p></div></section>`).join('')}<section><span>+</span><div><h3>진정성은 구체적인 사실과 태도에서</h3><p>직접 경험과 조사한 내용을 구분하고, 우리만의 판단과 배운 점을 남깁니다. 실패·한계·이해관계를 숨기지 않고 참고 출처와 연출을 밝힙니다. 경험이 없는 것을 경험담으로 만들지 않아요.</p></div></section><section><span>+</span><div><h3>개인의 목표와 상황에 맞는 도움</h3><p>이 콘텐츠가 필요한 사람의 구체적인 상황을 정하고, 그 사람이 고를 수 있는 방법과 다음 행동을 제안해요. 사람의 이름만 바꾸거나 관심사를 추측하는 것으로 개인화를 대신하지 않습니다.</p></div></section><p class="cp-review-note">회사 제작 기준이며 플랫폼의 노출을 보장하는 규칙은 아닙니다.</p></div>`,true);
}
function cpReferenceModal(index) {
  const row=String(index).startsWith('sample:')?cpResearchReferences[Number(index.split(':')[1])]||{}:index!==undefined?cp.results?.results?.[Number(index)]||{}:{};
  modal('참고 릴스 기록','원문에서 확인한 것만 기록해 주세요.',`<form data-cp-form="reference" class="form-stack"><div class="form-error" role="alert"></div><label class="field">Instagram 릴스 주소<input name="url" type="url" required maxlength="1000" placeholder="https://www.instagram.com/reel/…/" value="${escape(row.url||'')}"></label><label class="field">어떤 영상인가요?<input name="title" required maxlength="300" value="${escape(row.title||'')}"></label><div class="field-row"><label class="field">작성자<input name="creator" maxlength="100" value="${escape(row.creator||'')}"></label><label class="field">원문에서 확인한 게시일<input name="publishedAt" type="date" max="${dateToday()}"><small>검색 결과의 날짜는 실제 게시일과 다를 수 있어요.</small></label></div><div class="cp-field-row cp-metric-inputs">${['views','likes','comments','shares'].map(key=>`<label class="field">${escape(METRICS.find(m=>m[0]===key)[1])}<input name="${key}" type="number" min="0" step="1" placeholder="미확인"></label>`).join('')}</div><label class="field">배울 만한 구성<textarea name="formatNotes" rows="4" maxlength="3000" placeholder="첫 장면의 약속 → 정보를 공개하는 순서 → 마지막 보상. 우리 소재로 어떻게 바꿀까요?">${escape(row.formatNotes||'')}</textarea></label><label class="field">함께 볼 담당 채널<select name="channelId">${cpOption('','개인 참고 자료','')}${(state.data?.channels||[]).filter(c=>canEditChannel(c)&&c.active!==false).map(c=>cpOption(c.id,channelName(c),'')).join('')}</select><small>채널을 지정하면 해당 팀의 팀장·조회 담당자에게도 보입니다.</small></label><p class="cp-review-note">수치는 지금 직접 확인한 관찰값으로 저장됩니다. 크기나 증가 추이의 비교 없이 인기라고 단정하지 않아요.</p><div class="modal-actions">${button('취소','close-modal')}<button class="btn primary" type="submit">참고 자료 저장${icon('bookmark')}</button></div></form>`,true);
}
function cpSettingsModal() {
  modal('릴스 검색 연결','회사 프로그램용 Exa 검색 API',`<form data-cp-form="search-settings" class="form-stack"><div class="form-error" role="alert"></div><p class="notice">관리자가 별도로 발급받은 API 키를 연결하면 앱 안에서 웹에 공개된 릴스 후보를 찾을 수 있어요. Instagram 전체 인기 순위나 비공개 반응 수집은 제공하지 않습니다.</p><label class="field">Exa API 키<input name="apiKey" type="password" required maxlength="512" autocomplete="off" placeholder="발급받은 API 키"><small>저장한 키는 다시 표시하지 않습니다.</small></label><label class="cp-consent"><input type="checkbox" required>검색 주제와 기간이 Exa로 전송되고, 연결한 계정의 검색 이용량에 따라 요금이 발생할 수 있음을 확인했습니다.</label><p class="cp-review-note">경험담·기획안 본문은 검색에 전송하지 않습니다. 연결 정보 등록만으로 검색을 실행하지 않아요.</p><div class="modal-actions">${cp.data.search?.configured?cpButton('연결 해제','disconnect-search','','quiet'):''}<button class="btn primary" type="submit">검색 키 저장</button></div></form>`);
}
function cpUpsertDraft(draft) {cp.activeDraft=draft;const {plan,input,...summary}=draft;summary.seriesId=draft.seriesId||plan?.seriesId||input?.seriesId;cp.data.drafts=[summary,...cp.data.drafts.filter(row=>row.id!==draft.id)];}
async function cpReviewRequest(){
  const draft=cpDraft();if(!draft||isViewer())return;
  const userId=state.user.id,draftId=draft.id;
  modal('기획 검토 요청','원문은 기존 열람 권한을 유지합니다. 메시지에는 제목과 링크만 담아요.','<div class="loading-panel"><p>검토를 요청할 대화를 확인하고 있어요.</p></div>');
  const version=state.modalRequest;
  try{
    const data=await api('/api/content-drafts/'+encodeURIComponent(draftId)+'/share-targets');
    if(state.user?.id!==userId||state.modalRequest!==version||cp.draftId!==draftId)return;
    const choices=[...(data.channels||[]).map(row=>({...row,value:'channel:'+row.id,label:row.name})),...(data.people||[]).map(row=>({...row,value:'person:'+row.id,label:row.name+' · 개인 대화'}))];
    modal('기획 검토 요청','대화를 고른 뒤 메신저에서 내용을 확인하고 직접 보내세요.',`<form data-cp-review-share class="form-stack"><div class="cp-share-preview"><span>콘텐츠 기획 · 검토 요청</span><strong>${escape(data.workspaceLink.title)}</strong><small>제목과 기획 링크만 공유됩니다.</small></div><label class="field">검토를 요청할 대화<select name="target" required>${choices.filter(row=>row.allowed!==false).length?'<option value="">대화를 선택해 주세요</option>':''}${choices.map(row=>`<option value="${escape(row.value)}" ${row.allowed===false?'disabled':''}>${escape(row.label)}${row.allowed===false?' · '+escape(row.reason||'열람 권한 없음'):''}</option>`).join('')}</select></label>${(data.channels||[]).some(row=>row.allowed===false)?'<p class="cp-review-note">모든 참여자가 이 기획을 볼 수 있는 대화만 선택할 수 있어요. 팀방이 선택되지 않으면 아래 관리자·팀장과의 개인 대화를 이용하세요.</p>':''}${!choices.some(row=>row.allowed!==false)?'<p class="cp-message">검토를 요청할 대화가 없어요. 기획의 담당 채널과 팀 배정을 확인해 주세요.</p>':''}<div class="form-error" role="alert"></div><div class="modal-actions">${button('취소','close-modal')}<button type="submit" class="btn primary" ${choices.some(row=>row.allowed!==false)?'':'disabled'}>메신저에서 확인${icon('arrow')}</button></div></form>`);
    const form=document.querySelector('[data-cp-review-share]'),currentVersion=state.modalRequest;if(!form)return;
    form.onsubmit=async event=>{
      event.preventDefault();const value=new FormData(form).get('target'),choice=choices.find(row=>row.value===value&&row.allowed!==false);if(!choice)return;
      const submit=form.querySelector('[type="submit"]');submit.disabled=true;
      try{
        // Re-check current source and audience permissions before preparing the local draft.
        const checked=await api('/api/content-drafts/'+encodeURIComponent(draftId)+'/share-targets');
        if(state.user?.id!==userId||state.modalRequest!==currentVersion||cp.draftId!==draftId)return;
        const person=value.startsWith('person:'),current=(person?checked.people:checked.channels)?.find(row=>row.id===choice.id&&row.allowed!==false);
        if(!current)throw new Error('검토 대상의 권한이 바뀌었어요. 창을 다시 열어 대화를 선택해 주세요.');
        closeModal();prepareWorkspaceShare(checked.workspaceLink,person?{userId:choice.id}:{channelId:choice.id});
      }catch(error){if(state.user?.id===userId&&state.modalRequest===currentVersion&&form.isConnected){form.querySelector('.form-error').textContent=error.message;submit.disabled=false;}}
    };
  }catch(error){if(state.user?.id===userId&&state.modalRequest===version)modal('기획 검토 요청','',`<p class="cp-message" role="alert">${escape(error.message)}</p>`);}
}
async function cpOpenDraft(id,activate=true) {cpInvalidateGeneration();const userId=state.user?.id,request=++cp.detailRequest;const result=await api('/api/content-drafts/'+encodeURIComponent(id));if(state.user?.id!==userId||request!==cp.detailRequest)return;cpUpsertDraft(result.draft);if(activate){cp.draftId=id;cp.ideaId='';cp.view='plan';if(state.tab==='content'){render();window.scrollTo(0,0);}}}
document.addEventListener('input',event=>{
  const target=event.target;if(!target.matches('[data-cp-input]'))return;
  if(target.name.startsWith('auth-')){cp.input.authenticity||={};cp.input.authenticity[target.name.slice(5)]=target.value;}else if(target.name.startsWith('person-')){cp.input.personalization||={};cp.input.personalization[target.name.slice(7)]=target.value;}else cp.input[target.name]=target.value;
});
document.addEventListener('change',async event=>{
  const target=event.target;
  if(target.matches('[data-cp-input]')&&!target.name.startsWith('auth-')&&!target.name.startsWith('person-')){cp.input[target.name]=target.value;if(target.name==='seriesId')$('#cp-series-note').innerHTML=cpSeriesNote(cpSeries(target.value));}
  if(target.matches('[data-cp-status]')){const userId=state.user?.id,draftId=cp.draftId,request=cp.request;target.disabled=true;try{const result=await api('/api/content-drafts/'+encodeURIComponent(draftId),{status:target.value});if(state.user?.id!==userId||request!==cp.request||draftId!==cp.draftId)return;cpUpsertDraft(result.draft);notify('검토 상태를 저장했어요.');}catch(error){if(state.user?.id===userId)notify(error.message);}if(state.user?.id===userId&&request===cp.request&&state.tab==='content')render();}
});
document.addEventListener('click',async event=>{
  const target=event.target.closest('[data-action^="cp-"]');if(!target||target.disabled)return;
  const action=target.dataset.action.slice(3),id=target.dataset.id;
  try{
    if(action==='view'){await cpNavigate(target.dataset.view);}
    else if(action==='example-view'){cp.exampleView=target.dataset.view;await cpNavigate('examples');}
    else if(action==='examples-reload'){await swLoadExamples();}
    else if(action==='example-new'){cpExampleModal();}
    else if(action==='reload')await loadContentWorkspace();
    else if(action==='guide')cpGuide();
    else if(action==='new'){cp.draftId='';cp.activeDraft=null;cp.ideaId='';cp.input=cpBlank();await cpNavigate('plan');}
    else if(action==='open'){target.disabled=true;await cpOpenDraft(id);}
    else if(action==='request-review')await cpReviewRequest();
    else if(action==='revise'){cp.input={...cpBlank(),...structuredClone(cpDraft().input)};cp.draftId='';cp.ideaId='';render();window.scrollTo(0,0);}
    else if(action==='idea'){cp.ideaId=id;render();}
    else if(action==='select-idea'){const userId=state.user?.id,draftId=cp.draftId,request=cp.request;target.disabled=true;const result=await api('/api/content-drafts/'+encodeURIComponent(draftId),{selectedIdeaId:id});if(state.user?.id!==userId||request!==cp.request||draftId!==cp.draftId)return;cpUpsertDraft(result.draft);render();notify('제작할 구성을 선택했어요.');}
    else if(action==='query'){cp.query=target.dataset.query;const input=$('[data-cp-form="search"] [name="query"]');input.value=cp.query;input.focus();}
    else if(action==='reference')cpReferenceModal(target.dataset.index);
    else if(action==='use-reference'){cp.input.referenceId=id;cp.input.benchmarkId='';cp.input.benchmarkItemId='';cp.draftId='';cp.view='plan';render();window.scrollTo(0,0);}
    else if(action==='settings')cpSettingsModal();
    else if(action==='disconnect-search'){target.disabled=true;const result=await api('/api/content-search-settings',{apiKey:''});cp.data.search=result.search;closeModal();render();notify('직접 탐색 모드로 바꿨어요.');}
  }catch(error){notify(error.message);if(target.isConnected)target.disabled=false;}
});
document.addEventListener('submit',async event=>{
  const form=event.target.closest('form[data-cp-form]');if(!form)return;event.preventDefault();
  const submit=form.querySelector('[type="submit"]'),errorBox=form.querySelector('.form-error'),values=Object.fromEntries(new FormData(form)),userId=state.user?.id,request=cp.request,modalRequest=state.modalRequest;
  if(cp.busy)return;
  const generation=form.dataset.cpForm==='generate'?++cp.generationRequest:null,current=()=>state.user?.id===userId&&request===cp.request&&(generation===null||generation===cp.generationRequest);
  cp.busy=true;if(generation!==null)cp.generating=true;if(submit){submit.disabled=true;submit.setAttribute('aria-busy','true');}if(errorBox)errorBox.textContent='';
  try{
    if(form.dataset.cpForm==='example'){
      if(values.shareConfirmed!=='on')throw new Error('회사에 공유할 내용을 확인해 주세요.');
      const result=await api('/api/studio-examples/direct',{title:values.title,kind:values.kind,url:values.url,text:values.text,whyGood:values.whyGood,lesson:values.lesson,axis:values.axis,shareConfirmed:true});
      if(state.user?.id!==userId||request!==cp.request)return;
      if(sw.userId===userId&&sw.data)sw.data.examples=[result.example,...(sw.data.examples||[]).filter(row=>row.id!==result.example.id)];
      if(form.isConnected&&state.modalRequest===modalRequest){closeModal();if(state.tab==='content'&&cp.view==='examples')render();}
      notify('좋은 콘텐츠에 저장했어요.');
    }else if(form.dataset.cpForm==='generate'){
      const input={...values,authenticity:Object.fromEntries(cpAuthenticityFields.map(([id])=>[id,values['auth-'+id]||''])),personalization:Object.fromEntries(cpPersonalizationFields.map(([id])=>[id,values['person-'+id]||'']))};cpAuthenticityFields.forEach(([id])=>delete input['auth-'+id]);cpPersonalizationFields.forEach(([id])=>delete input['person-'+id]);
      const result=await api('/api/content-generate',input);if(!current()||state.tab!=='content'||cp.view!=='plan')return;cpUpsertDraft(result.draft);cp.draftId=result.draft.id;cp.ideaId='';cp.view='plan';render();window.scrollTo(0,0);notify('세 가지 구성안을 기획함에 저장했어요.');
    }else if(form.dataset.cpForm==='search'){
      cp.query=values.query;const result=await api('/api/content-search',{query:values.query,days:Number(values.days),localOnly:true});if(state.user?.id!==userId)return;cp.results=result;render();
    }else if(form.dataset.cpForm==='reference'){
      const metrics=Object.fromEntries(['views','likes','comments','shares'].map(key=>[key,values[key]===''?null:Number(values[key])]));const result=await api('/api/content-references',{url:values.url,title:values.title,creator:values.creator,publishedAt:values.publishedAt,formatNotes:values.formatNotes,channelId:values.channelId,metrics});if(state.user?.id!==userId)return;cp.data.references.unshift(result.reference);closeModal();render();notify('릴스 참고 자료를 저장했어요.');
    }else if(form.dataset.cpForm==='search-settings'){
      const result=await api('/api/content-search-settings',{apiKey:values.apiKey});if(state.user?.id!==userId)return;cp.data.search=result.search;closeModal();render();notify('검색 연결 정보를 저장했어요.');
    }
  }catch(error){if(current()&&(generation===null||state.tab==='content'&&cp.view==='plan')){if(errorBox?.isConnected)errorBox.textContent=error.message;else notify(error.message);}}
  finally{if(current()){cp.busy=false;if(generation!==null)cp.generating=false;if(submit?.isConnected){submit.disabled=false;submit.removeAttribute('aria-busy');}document.querySelectorAll('[data-cp-form="search"] button[type="submit"]').forEach(node=>{node.disabled=isViewer();node.innerHTML='참고 찾기'+icon('arrow');});}}
});

function cpExampleModal(){
  if(!['admin','manager'].includes(state.user?.role))return;
  modal('좋은 콘텐츠 등록','좋은 이유와 다음 기획에 가져갈 점을 함께 남겨요.',`<form data-cp-form="example" class="form-stack"><div class="form-error" role="alert"></div><label class="field">제목<input name="title" required maxlength="200" placeholder="다시 참고할 때 알아볼 수 있는 이름"></label><label class="field">콘텐츠 형식<select name="kind" data-cp-example-kind><option value="link">원문 링크</option><option value="text">글 원문</option></select></label><label class="field" data-cp-example-field="link">원문 주소<input name="url" type="url" required maxlength="2000" placeholder="https://…"></label><label class="field" data-cp-example-field="text" hidden>글 원문<textarea name="text" rows="6" maxlength="20000" disabled></textarea></label><label class="field">좋은 이유<textarea name="whyGood" rows="3" required maxlength="2000" placeholder="어느 장면의 어떤 선택이 좋았나요?"></textarea></label><label class="field">다음 기획에 가져갈 점<textarea name="lesson" rows="3" required maxlength="2000" placeholder="우리 콘텐츠에 어떻게 써 볼 수 있을까요?"></textarea></label><label class="field">관점<select name="axis">${Object.entries(swrAxes).map(([id,label])=>cpOption(id,label,'general')).join('')}</select></label><label class="cp-consent"><input type="checkbox" name="shareConfirmed" required>원문과 작성한 내용을 회사 전체에 공유합니다.</label><div class="modal-actions">${button('취소','close-modal')}<button type="submit" class="btn primary">예시 저장</button></div></form>`,true);
}
document.addEventListener('change',event=>{
  const target=event.target;if(!target.matches('[data-cp-example-kind]'))return;
  target.closest('form').querySelectorAll('[data-cp-example-field]').forEach(section=>{const active=section.dataset.cpExampleField===target.value;section.hidden=!active;section.querySelectorAll('input,textarea').forEach(input=>{input.disabled=!active;input.required=active;});});
});
