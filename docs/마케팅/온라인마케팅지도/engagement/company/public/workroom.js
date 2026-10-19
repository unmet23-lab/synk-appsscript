'use strict';

const wr={userId:null,guide:null,content:null,loading:false,attempted:false,error:'',request:0,view:'desk',phase:'plan',series:'synkbrief-use',platform:'all',limit:8,daily:null,dailyDate:'',dailyRegion:'KR',dailyPlatform:'all',dailyLoading:false,dailyPollFetching:false,dailyAttempted:false,dailyError:'',dailyRequest:0,dailyActionRequest:0,dailyPlanRequest:0,dailyCollecting:false,dailySaving:false,dailyLimits:new Map(),dailyPollTimer:null,dailyPollUntil:0,dailyFetchedAt:0,dailyLoadedDay:''};
const wrReviewKey=userId=>`synk-workroom:review:${userId}`;
function resetWorkroom({clearStorage=false}={}){
  wrCancelDailyPoll();wr.planChoice=null;
  if(typeof crReset==='function')crReset();
  if(typeof makerToolsReset==='function')makerToolsReset();
  if(typeof clientDeskReset==='function')clientDeskReset();
  if(clearStorage&&wr.userId)try{sessionStorage.removeItem(wrReviewKey(wr.userId));}catch{}
  Object.assign(wr,{userId:null,guide:null,content:null,loading:false,attempted:false,error:'',request:wr.request+1,view:'desk',phase:'plan',series:'synkbrief-use',platform:'all',limit:8,daily:null,dailyDate:'',dailyRegion:'KR',dailyPlatform:'all',dailyLoading:false,dailyPollFetching:false,dailyAttempted:false,dailyError:'',dailyRequest:wr.dailyRequest+1,dailyActionRequest:wr.dailyActionRequest+1,dailyPlanRequest:wr.dailyPlanRequest+1,dailyCollecting:false,dailySaving:false,dailyLimits:new Map(),dailyPollTimer:null,dailyPollUntil:0,dailyFetchedAt:0,dailyLoadedDay:''});
}
function wrIdentity(){
  if(!state.user)return;
  if(wr.userId!==state.user.id){resetWorkroom();wr.userId=state.user.id;const params=new URLSearchParams(location.search);if(state.tab==='workroom'&&['desk','trends','tools','pages','clients'].includes(params.get('section')))wr.view=params.get('section');if(wr.view==='tools'&&typeof makerTools!=='undefined'&&['weekly','publication','publish','subtitles','sources','brand','quality','automation'].includes(params.get('tool')))makerTools.view=params.get('tool');try{sessionStorage.removeItem(wrReviewKey(wr.userId));}catch{}}
}
function ensureWorkroom(){
  if(!state.user)return;wrIdentity();
  if(!wr.attempted&&!wr.loading)void loadWorkroom();
  wrEnsureDaily();
  if(typeof crEnsure==='function')crEnsure();
  if(typeof makerToolsEnsure==='function')makerToolsEnsure();
  if(typeof clientDeskEnsure==='function')clientDeskEnsure();
}
async function loadWorkroom(){
  const userId=state.user?.id;if(!userId)return;wr.userId=userId;const request=++wr.request;wr.loading=true;wr.attempted=true;wr.error='';
  if(state.tab==='workroom')render();
  const results=await Promise.allSettled([api('/api/workroom-guide'),api('/api/content-workspace')]);
  if(request!==wr.request||state.user?.id!==userId)return;
  if(results[0].status==='fulfilled')wr.guide=results[0].value;
  if(results[1].status==='fulfilled')wr.content=results[1].value;
  wr.error=results.filter(result=>result.status==='rejected').map(result=>result.reason?.message||'자료를 불러오지 못했어요.').join(' ');wr.loading=false;
  if(state.tab==='workroom')(typeof renderBackground==='function'?renderBackground:render)();
}
const wrButton=(label,action,attrs='',classes='')=>button(label,'workroom-'+action,'',classes,attrs);
const wrExternal=(label,url)=>`<a class="btn small quiet" href="${escape(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${escape(label)}${icon('external')}</a>`;
function contentWorkroomPage(){
  wrIdentity();
  const heading={desk:['제작 데스크','새 기획을 시작하거나, 저장한 내 기획을 이어가세요.'],trends:['트렌드·레퍼런스','트렌드와 참고 자료에서 제작 아이디어를 찾으세요.'],pages:['내 관리 페이지','맡은 페이지를 등록하고 연결 상태를 확인하세요.']}[wr.view]||['제작 데스크','새 기획을 시작하거나, 저장한 내 기획을 이어가세요.'];
  return `<div class="wr-workroom">${['tools','clients'].includes(wr.view)?'':pageHeading('',heading[0],heading[1])}${wr.error&&!['trends','tools'].includes(wr.view)?`<div class="wr-error" role="alert">${escape(wr.error)} ${wrButton('다시 불러오기','refresh','','small')}</div>`:''}${wr.view==='clients'?clientDeskPanel():wr.view==='tools'?makerToolsPanel():wr.view==='pages'?wrPages():wr.view==='trends'?wrTrends():!wr.guide?`<section class="wr-loading" role="status"><span class="loading-line"></span><p>${wr.loading?'제작 자료를 꺼내고 있어요.':'제작 자료를 불러옵니다.'}</p>${!wr.loading&&wr.attempted&&!wr.error?wrButton('다시 불러오기','refresh','','small'):''}</section>`:wrDesk()}</div>`;
}
function wrDeskDrafts(){
  const content=typeof cp!=='undefined'&&cp.userId===state.user?.id&&cp.data?cp.data:wr.content;
  return (content?.drafts||[]).filter(row=>row.ownerId===state.user?.id&&row.status!=='archived').slice().sort((a,b)=>(Date.parse(b.updatedAt||b.createdAt)||0)-(Date.parse(a.updatedAt||a.createdAt)||0));
}
function wrWorkingPlan(){
  if(typeof cp==='undefined'||cp.userId!==state.user?.id)return false;
  const blank=cpBlank();return Boolean(cp.draftId)||Object.keys(blank).filter(key=>key!=='seriesId').some(key=>JSON.stringify(cp.input?.[key]??blank[key])!==JSON.stringify(blank[key]));
}
function wrUnsavedPlan(){return wrWorkingPlan()&&!cp.draftId;}
function wrPlanStamp(){return JSON.stringify({userId:cp.userId,draftId:cp.draftId,input:cp.input});}
function wrDeskDate(value){const at=Date.parse(value);return Number.isFinite(at)?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'short',day:'numeric'}).format(at):'날짜 미확인';}
function wrDesk(){
  const series=wr.guide.series.find(row=>row.id===wr.series)||wr.guide.series[0],drafts=wrDeskDrafts(),working=wrWorkingPlan(),viewer=isViewer();
  const workingTitle=working?(cp.draftId?(cp.activeDraft?.id===cp.draftId?cp.activeDraft.title||'제목 없는 기획':'저장된 기획'):cp.input?.topic||'작성 중인 기획'):'';
  const workingPanel=working?`<aside class="wr-desk-working"><div><span>${cp.draftId?'이 창에서 열어 둔 기획':'이 창에 작성 중인 내용이 있어요'}</span><strong>${escape(workingTitle)}</strong></div>${wrButton('작성 중인 기획 이어하기','resume','','primary')}</aside>`:'';
  const recent=wr.content||typeof cp!=='undefined'&&cp.userId===state.user?.id&&cp.data?drafts.length?`<ul class="wr-desk-drafts">${drafts.slice(0,3).map(row=>`<li><div><strong>${escape(row.title||'제목 없는 기획')}</strong><span>${escape(wr.guide.series.find(s=>s.id===row.seriesId)?.name||'콘텐츠 기획')} · ${escape(({draft:'아이디어',review:'검토 중',ready:'제작 준비'})[row.status]||'상태 미확인')} · 최근 저장 ${escape(wrDeskDate(row.updatedAt||row.createdAt))}</span></div>${wrButton(viewer?'기획 보기':'이어서 작업','draft',`data-id="${escape(row.id)}"`,'quiet')}</li>`).join('')}</ul>`:`<div class="wr-desk-empty"><p>아직 저장한 내 기획이 없어요.</p><span>${viewer?'기획함에서 열람할 수 있는 자료를 확인하세요.':'위에서 콘텐츠 유형을 고르면 첫 기획을 시작할 수 있어요.'}</span></div>`:`<p class="wr-desk-empty" role="status">${wr.loading?'저장한 기획을 불러오고 있어요.':'저장한 기획을 불러오지 못했어요.'}</p>`;
  return `<div class="wr-desk" data-workroom-desk>${workingPanel}<section class="wr-desk-start" aria-labelledby="wr-desk-start-title"><div class="wr-desk-start-copy"><span class="wr-kicker">새로 만들기</span><h2 id="wr-desk-start-title">어떤 콘텐츠를 만들까요?</h2><p>유형을 고르고, 주제와 보여 줄 결과부터 기획하세요.</p></div><div class="wr-desk-start-form"><label>콘텐츠 유형<select data-action="workroom-series" aria-label="제작 양식 선택">${wr.guide.series.map(row=>`<option value="${escape(row.id)}" ${series?.id===row.id?'selected':''}>${escape(row.name)}</option>`).join('')}</select></label>${series?`<p class="wr-desk-series-note">${escape(series.concept)}</p>`:''}${viewer?'<p class="wr-desk-role">열람 계정에서는 기획 작성과 수정을 할 수 없어요.</p>':wrButton('새 기획 시작','plan',`data-id="${escape(series?.id||'')}"`,'primary wr-desk-main-action')}<span class="wr-desk-start-note">${viewer?'저장된 기획과 제작 기준은 아래에서 확인하세요.':'선택한 유형의 기획 작성 화면으로 이동합니다.'}</span></div></section><section class="wr-desk-recent" aria-labelledby="wr-desk-recent-title"><div class="wr-desk-section-head"><div><h2 id="wr-desk-recent-title">저장한 내 기획</h2><p>최근 저장한 기획부터 이어서 작업하세요.</p></div>${wrButton('기획함 열기','library','','small quiet')}</div>${recent}</section><section class="wr-desk-check"><img src="/messenger/assets/sticker-check.webp" alt="" width="48" height="48"><div><h2>완성한 콘텐츠가 있나요?</h2><p>게시 전 점검에서 파일 규격과 검토 항목을 확인하세요.</p></div><div class="wr-actions">${wrButton('게시 준비·성과','publication','','primary')}${wrButton('게시 전 점검','publish','','quiet')}</div></section><section class="wks-desk-link"><div><h2>지난주의 결과와 다음 할 일</h2><p>완료 기록·콘텐츠 성과·남은 문제를 주간 정리에서 확인하세요.</p></div>${wrButton('주간 정리 보기','weekly','','quiet')}</section><section class="ah-desk-link"><div><h2>자동화가 잘 이어지고 있나요?</h2><p>멈춘 작업과 직접 확인할 항목을 한곳에서 확인하세요.</p></div>${wrButton('자동화 상태 보기','automation','','quiet')}</section><details id="wr-desk-guide" class="wr-desk-guide"><summary><img src="/messenger/assets/sticker-book.webp" alt="" width="30" height="30"><span>제작 팁과 선택한 유형의 안내</span><small>준비물 · 제작 기준 · 양식</small></summary><div class="wr-desk-guide-body">${wrDeskGuide()}</div></details></div>`;
}
async function wrResumePlan(){
  if(!wrWorkingPlan())return;
  const userId=state.user.id;
  if(!cp.data){await loadContentWorkspace();if(state.user?.id!==userId||cp.userId!==userId)return;if(cp.error||!cp.data)throw new Error(cp.error||'기획을 불러오지 못했어요. 다시 시도해 주세요.');}
  if(cp.draftId&&cp.activeDraft?.id!==cp.draftId){await navigateWorkspaceLink('/#view=content&section=plan&draftId='+encodeURIComponent(cp.draftId));return;}
  await cpNavigate('plan');window.scrollTo(0,0);
}
function wrConfirmPlanChoice(choice){
  wr.planChoice={...choice,userId:state.user.id,stamp:wrPlanStamp()};
  modal('작성 중인 기획이 있어요','이 창의 입력 내용을 이어서 작성하거나, 다른 기획으로 바꿀 수 있어요.',`<div class="wr-plan-choice"><p>다른 기획으로 바꾸면 아직 저장하지 않은 입력 내용이 사라집니다.</p><div class="wr-actions">${wrButton('작성 중인 기획 이어하기','resume','','primary')}${wrButton(choice.draftId?'저장한 기획으로 바꾸기':'새 기획으로 시작','replace-plan','','quiet')}</div></div>`);
  wr.planChoice.modalRequest=state.modalRequest;
}
async function wrReplacePlan(){
  const choice=wr.planChoice;if(!choice)return;
  if(choice.userId!==state.user?.id||choice.modalRequest!==state.modalRequest){wr.planChoice=null;return;}
  if(choice.stamp!==wrPlanStamp()||!choice.draftId&&isViewer()){wr.planChoice=null;closeModal();notify('기획이나 권한이 바뀌었어요. 현재 내용을 확인한 뒤 다시 선택해 주세요.');return;}
  wr.planChoice=null;
  closeModal();
  if(choice.draftId)await wrOpenDeskDraft(choice.draftId,true);
  else await wrOpenContent('plan',choice.seriesId,choice.itemId,true);
}
async function wrOpenDeskDraft(id,replace=false){
  if(!wrDeskDrafts().some(row=>row.id===id))return;
  if(wrUnsavedPlan()&&!replace){wrConfirmPlanChoice({draftId:id});return;}
  await navigateWorkspaceLink('/#view=content&section=plan&draftId='+encodeURIComponent(id));
}
function wrOpenPublish(){if(typeof makerTools!=='undefined')makerTools.view='publish';wr.view='tools';wr.dailyPlanRequest++;render();window.scrollTo(0,0);}

function wrDeskGuide(){
  const guide=wr.guide,series=guide.series.find(row=>row.id===wr.series)||guide.series[0],tips=guide.tips.filter(tip=>tip.phase===wr.phase),sources=(guide.sources||[]).filter(source=>tips.some(tip=>tip.source===source.id));
  return `<section class="wr-intro"><div><h2>시청자가 볼 이유부터</h2><p>실제 도움과 재미를 먼저 정하고 제작을 시작하세요.</p></div>${wrButton('제작 양식 복사','copy','','small')}</section><section class="wr-section"><div class="wr-section-head"><div><h2>지금 필요한 제작 팁</h2><p>원문 기준을 이번 작업에 적용하는 질문과 예시입니다.</p></div></div><div class="wr-phase" role="group" aria-label="제작 단계">${guide.phases.map(phase=>`<button type="button" data-action="workroom-phase" data-id="${escape(phase.id)}" aria-pressed="${wr.phase===phase.id}" class="${wr.phase===phase.id?'active':''}">${escape(phase.label)}</button>`).join('')}</div><div class="wr-tip-grid">${tips.map(tip=>`<article class="wr-tip"><h3>${escape(tip.title)}</h3><p>${escape(tip.detail)}</p><p class="wr-example">${escape(tip.example)}</p></article>`).join('')}</div><div class="wr-source-links"><span>기준 원문</span>${sources.map(source=>wrButton(source.title,'source',`data-id="${escape(source.id)}"`,'small quiet')).join('')}</div></section><section class="wr-section wr-template"><div class="wr-section-head"><div><h2>내 콘텐츠에 맞는 제작 양식</h2><p>기존 유형별 양식과 기획 엔진을 그대로 이어갑니다.</p></div></div>${series?`<article><span class="wr-kicker">${escape(series.format)}</span><h3>${escape(series.name)}</h3><p>${escape(series.concept)}</p><p class="wr-template-audience"><strong>누구에게</strong> ${escape(series.audience)}</p><div class="wr-template-columns"><div><h4>준비할 자료</h4><ul>${series.materials.map(text=>`<li>${escape(text)}</li>`).join('')}</ul></div><div><h4>반드시 지킬 기준</h4><ul>${series.guardrails.map(text=>`<li>${escape(text)}</li>`).join('')}</ul></div></div><details><summary>스토리 전개 아이디어 ${series.angles.length}가지</summary>${series.angles.map(angle=>`<div class="wr-angle"><strong>${escape(angle.title.replaceAll('{topic}','내 주제'))}</strong><p>${escape(angle.angle)}</p><p>즐거움: ${escape(angle.reward)}</p></div>`).join('')}</details><div class="wr-actions">${wrButton('양식 원문 읽기','source',`data-id="series-${escape(series.id)}"`,'quiet')}${!isViewer()?wrButton('이 양식으로 새 기획','plan',`data-id="${escape(series.id)}"`,'primary'):''}</div></article>`:''}</section><section class="wr-section wr-review"><div class="wr-section-head"><div><h2>결과물 점검은 제작 도구에서</h2><p>파일 규격과 직접 검토한 근거를 작업별로 저장할 수 있어요.</p></div>${wrButton('게시 전 점검 열기','publish','','small quiet')}</div></section>`;
}
const wrRegions={KR:'한국',US:'미국',CN:'중국',GLOBAL:'글로벌'};
const wrTrendPlatforms={google:'Google 검색',youtube:'YouTube',tiktok:'TikTok',instagram:'Instagram',douyin:'Douyin',xiaohongshu:'샤오홍슈',baidu:'Baidu','youtube-culture':'YouTube 문화 보고서'};
const wrSourceStatuses={ok:'수집 완료',needs_connection:'연결 필요',unavailable:'공개 수집 불가',error:'수집 실패',partial:'일부 수집',stale:'이전 자료'};
const wrTrendPlatform=value=>String(value||'').toLowerCase();
const wrTrendPlatformLabel=value=>wrTrendPlatforms[wrTrendPlatform(value)]||String(value||'출처 미확인');
function wrTrendTime(value){
  if(!value)return '시각 미확인';const date=new Date(value);if(!Number.isFinite(date.getTime()))return '시각 미확인';
  return new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(date)+' KST';
}
function wrTrendLink(title,url,classes=''){
  const safe=safeUrl(url);if(safe==='#'||!safe)return `<span>${escape(title)}</span>`;
  return `<a class="${classes}" href="${escape(safe)}" target="_blank" rel="noopener noreferrer">${escape(title)}${icon('external')}</a>`;
}
function wrDailyToday(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function wrDailyActive(){return state.user?.id===wr.userId&&state.tab==='workroom'&&wr.view==='trends'&&document.visibilityState!=='hidden';}
function wrCancelDailyPoll(){if(wr.dailyPollTimer!==null){clearTimeout(wr.dailyPollTimer);wr.dailyPollTimer=null;}}
function wrSuspendDaily(){wrCancelDailyPoll();wr.dailyPollUntil=0;if(wr.dailyPollFetching){wr.dailyRequest++;wr.dailyLoading=false;wr.dailyPollFetching=false;}}
function wrScheduleDailyPoll(){
  wrCancelDailyPoll();if(!wrDailyActive()||!wr.daily?.running){wr.dailyPollUntil=0;return;}
  if(!wr.dailyPollUntil)wr.dailyPollUntil=Date.now()+30000;if(Date.now()>=wr.dailyPollUntil)return;
  const userId=wr.userId,request=wr.dailyRequest;
  wr.dailyPollTimer=setTimeout(()=>{wr.dailyPollTimer=null;if(!wrDailyActive()||wr.userId!==userId||request!==wr.dailyRequest)return;void wrLoadDaily(wr.dailyDate,{poll:true});},2500);
}
function wrEnsureDaily(){
  if(!wrDailyActive()){wrSuspendDaily();return;}if(wr.dailyLoading)return;
  if(!wr.dailyAttempted){void wrLoadDaily();return;}
  const newDay=wr.dailyLoadedDay&&wr.dailyLoadedDay!==wrDailyToday();
  if(wr.daily&&(newDay||Date.now()-wr.dailyFetchedAt>120000)){
    const date=newDay&&wr.dailyDate===wr.daily.today?'':wr.dailyDate;if(newDay)wr.dailyLimits.clear();void wrLoadDaily(date);return;
  }
  if(wr.daily?.running&&wr.dailyPollTimer===null)wrScheduleDailyPoll();
}
document.addEventListener('visibilitychange',()=>{if(typeof state==='undefined')return;if(document.visibilityState==='hidden')wrSuspendDaily();else wrEnsureDaily();});
async function wrLoadDaily(date=wr.dailyDate,{poll=false}={}){
  const userId=state.user?.id;if(!userId)return;wrIdentity();wrCancelDailyPoll();if(!poll)wr.dailyPollUntil=0;const request=++wr.dailyRequest;
  wr.dailyDate=String(date||'');wr.dailyLoading=true;wr.dailyPollFetching=poll;wr.dailyAttempted=true;wr.dailyError='';
  if(state.tab==='workroom')render();
  try{
    const result=await api('/api/daily-trends'+(wr.dailyDate?'?date='+encodeURIComponent(wr.dailyDate):''));
    if(request!==wr.dailyRequest||state.user?.id!==userId||(poll&&!wrDailyActive()))return;
    wr.daily=result;wr.dailyDate=result.date||wr.dailyDate||result.today||'';wr.dailyFetchedAt=Date.now();wr.dailyLoadedDay=wrDailyToday();
  }catch(error){if(request===wr.dailyRequest&&state.user?.id===userId)wr.dailyError=error.message||'수집 자료를 불러오지 못했어요.';}
  finally{if(request===wr.dailyRequest&&state.user?.id===userId){wr.dailyLoading=false;wr.dailyPollFetching=false;wrScheduleDailyPoll();if(state.tab==='workroom'&&(!poll||wrDailyActive()))(poll&&typeof renderBackground==='function'?renderBackground:render)();}}
}
function wrDailyItem(item){
  const rank=Number(item.rank),metric=item.metric,ranked=item.rank!==null&&item.rank!==undefined&&Number.isFinite(rank)&&rank>0;
  const value=metric?.display??(metric?.value===null||metric?.value===undefined?'':String(metric.value));
  const related=(item.related||[]).filter(row=>row?.title&&safeUrl(row.url)!=='#');
  return `<article class="wr-daily-item"><span class="wr-daily-rank" ${ranked?'':'data-unranked'} aria-label="${ranked?'출처 순위 '+rank:'순위 미제공'}">${ranked?rank:''}</span><div class="wr-daily-item-copy"><h3>${escape(item.title||'제목 미확인')}</h3><div class="wr-daily-item-meta">${metric?`<span>${escape(metric.label||'출처 지표')} ${escape(value||'미확인')}</span>`:''}<span>${item.retainedAt?'이전 자료 · 이전 수집 '+escape(wrTrendTime(item.retainedAt)):'수집 '+escape(wrTrendTime(item.collectedAt))}</span>${item.publishedAt?`<span>발행 ${escape(wrTrendTime(item.publishedAt))}</span>`:''}</div>${related.length?`<details class="wr-daily-related"><summary>관련 뉴스 ${related.length}개</summary><ul>${related.map(row=>`<li>${wrTrendLink(row.title,row.url)}${row.source?`<small>${escape(row.source)}</small>`:''}</li>`).join('')}</ul></details>`:''}</div><div class="wr-daily-item-actions">${wrTrendLink('원문',item.url,'btn small quiet')}${!isViewer()?wrButton('새 기획','daily-plan',`data-id="${escape(item.id)}"`,'small'):''}</div></article>`;
}
function wrDailySources(sources){
  if(!sources.length)return '<p class="wr-note">이 국가의 등록된 출처가 없어요. 수집 범위와 연결 설정을 확인해 주세요.</p>';
  return `<details class="wr-daily-source-status"><summary>출처 상태 · 수집 완료 ${sources.filter(row=>row.status==='ok').length}/${sources.length}</summary><ul>${sources.map(source=>`<li><div><strong>${escape(source.label||wrTrendPlatformLabel(source.platform))}</strong><span class="wr-source-status" data-status="${escape(source.status||'unavailable')}">${escape(wrSourceStatuses[source.status]||'상태 미확인')}</span><span>${Number(source.count)||0}개</span></div><p>${escape(source.message||'')}${source.retainedAt?` <span>보존 자료 · 이전 수집 ${escape(wrTrendTime(source.retainedAt))}</span>`:source.collectedAt?` <span>확인 ${escape(wrTrendTime(source.collectedAt))}</span>`:''}</p></li>`).join('')}</ul></details>`;
}
function wrDailyReports(items){
  if(!items.length)return '';
  return `<details class="wr-trend-library wr-daily-reports"><summary>공식 문화 분석 보고서 ${items.length}개</summary><p class="wr-note">공식 분석 자료입니다. 오늘의 인기 순위나 실시간 성과 지표로 합산하지 않습니다.</p><div class="wr-daily-report-list">${items.map(item=>`<article><span class="wr-kicker">${escape(wrTrendPlatformLabel(item.platform))}${item.publishedAt?' · 발행 '+escape(wrTrendTime(item.publishedAt)):''}</span><h3>${escape(item.title)}</h3>${wrTrendLink('보고서 원문',item.url,'btn small quiet')}</article>`).join('')}</div></details>`;
}
function wrTrends(){
  const data=wr.daily,snapshot=data?.snapshot,currentDate=wr.dailyDate||data?.date||data?.today||'',today=data?.today||'',sources=(snapshot?.sources||[]).filter(source=>source.region===wr.dailyRegion);
  const platforms=[...new Set(sources.map(source=>wrTrendPlatform(source.platform)).filter(Boolean))];
  const items=(snapshot?.items||[]).filter(item=>item.category!=='analysis'&&item.region!=='GLOBAL'&&item.region===wr.dailyRegion&&(wr.dailyPlatform==='all'||wrTrendPlatform(item.platform)===wr.dailyPlatform));
  const activeSources=sources.filter(source=>wr.dailyPlatform==='all'||wrTrendPlatform(source.platform)===wr.dailyPlatform);
  const partial=sources.some(source=>source.status!=='ok'),stale=Boolean(snapshot&&(snapshot.stale||snapshot.date!==currentDate)),history=Boolean(currentDate&&today&&currentDate!==today),running=wr.dailyCollecting||Boolean(data?.running);
  const groups=new Map();for(const item of items){const key=item.sourceId||wrTrendPlatform(item.platform);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item);}
  const status=running?'수집 중':wr.dailyLoading?'불러오는 중':!snapshot?'수집 기록 없음':stale?'이전 자료':history?'지난 기록':partial?'일부 출처 수집':'수집 완료';
  const statusDetail=snapshot?`${snapshot.date||currentDate} · 수집 ${wrTrendTime(snapshot.collectedAt)} · ${wrRegions[wr.dailyRegion]} ${items.length}개`:'공개 자료와 연결된 출처의 결과가 이곳에 쌓입니다.';
  const controls=`<div class="wr-daily-filters"><div class="wr-daily-regions" role="group" aria-label="트렌드 국가">${['KR','US','CN'].map(region=>`<button type="button" data-action="workroom-daily-region" data-id="${region}" aria-pressed="${wr.dailyRegion===region}">${wrRegions[region]}</button>`).join('')}</div><label>수집 날짜<input type="date" data-action="workroom-daily-date" aria-label="트렌드 수집 날짜" value="${escape(currentDate)}" ${today?`max="${escape(today)}"`:''}></label><label>플랫폼<select data-action="workroom-daily-platform" aria-label="트렌드 플랫폼"><option value="all" ${wr.dailyPlatform==='all'?'selected':''}>전체 플랫폼</option>${[...new Set([...platforms,...(wr.dailyPlatform!=='all'?[wr.dailyPlatform]:[])])].map(platform=>`<option value="${escape(platform)}" ${wr.dailyPlatform===platform?'selected':''}>${escape(wrTrendPlatformLabel(platform))}</option>`).join('')}</select></label></div>`;
  return `${typeof crPanel==='function'?crPanel():''}<section class="wr-section wr-daily-feed"><div class="wr-section-head"><div><h2>출처별 일일 트렌드</h2><p>직접 연결한 공개 출처의 수집 기록입니다. Gemini 제작 양식은 위 목록에서 확인하세요.</p></div><div class="wr-daily-admin">${wrButton('새로 읽기','daily-refresh',wr.dailyLoading?'disabled':'','small quiet')}${isAdmin()?`${wrButton(running?'수집 중…':'지금 수집','daily-collect',`${running||wr.dailySaving?'disabled':''}`,'small primary')}${wrButton('수집 설정','daily-settings',`${running||wr.dailySaving?'disabled':''}`,'small quiet')}`:''}</div></div>${controls}<div class="wr-daily-summary" role="status"><strong>${status}</strong><span>${escape(statusDetail)}</span>${data?.schedulerEnabled===false?'<small>이 출처 수집의 자동 실행은 꺼져 있습니다. 위 제작 양식의 문서 자동 반영은 별도로 동작합니다.</small>':data?.settings?.enabled===false?'<small>자동 수집 꺼짐</small>':data?.nextRunAt?`<small>다음 수집 ${escape(wrTrendTime(data.nextRunAt))}</small>`:''}</div>${wr.dailyError?`<div class="wr-error" role="alert">${escape(wr.dailyError)}</div>`:''}${stale?'<p class="wr-note">선택한 날짜의 최신 결과가 아닙니다. 위 수집 날짜를 확인해 주세요.</p>':''}${wr.dailyLoading?'<div class="wr-loading" role="status"><span class="loading-line"></span><p>수집 자료를 불러오고 있어요.</p></div>':groups.size?[...groups].map(([sourceId,rows])=>{const source=activeSources.find(row=>row.id===sourceId),ordered=[...rows].sort((a,b)=>(Number(a.rank)||Infinity)-(Number(b.rank)||Infinity)),limit=wr.dailyLimits.get(sourceId)||10,shown=ordered.slice(0,limit),kind=ordered.some(item=>Number(item.rank)>0)?'출처별 순위':wrTrendPlatform(rows[0].platform)==='google'?'검색 관심':'수집 항목';return `<section class="wr-daily-group" aria-label="${escape(source?.label||wrTrendPlatformLabel(rows[0].platform))}"><div class="wr-daily-group-heading"><h3>${escape(source?.label||wrTrendPlatformLabel(rows[0].platform))}</h3><span>${source?.retained?'이전 자료 · ':''}${kind} · 수집 ${ordered.length}개${ordered.length>shown.length?' · 표시 '+shown.length+'개':''}</span></div>${shown.map(item=>wrDailyItem(source?.retainedAt?{...item,retainedAt:source.retainedAt}:item)).join('')}${ordered.length>shown.length?`<div class="wr-daily-more">${wrButton('20개 더 보기','daily-more',`data-id="${escape(sourceId)}"`,'small quiet')}</div>`:''}</section>`;}).join(''):`<div class="wr-empty"><h3>${snapshot?'표시할 수집 항목이 없어요':'이 날짜의 수집 기록이 없어요'}</h3><p>${snapshot?'이 국가·플랫폼에서 확인한 항목이 없습니다. 아래 출처 상태에서 연결 여부와 수집 결과를 확인하세요.':data?.schedulerEnabled===false?'수집 설정과 등록된 출처를 확인해 주세요. 준비된 제작 양식은 위 목록에서 볼 수 있어요.':'날짜를 바꾸거나 다음 수집을 기다려 주세요.'}</p></div>`}${wrDailySources(sources)}<p class="wr-note">순위와 지표는 각 출처의 표본입니다. 플랫폼끼리 합산한 전체 인기 순위가 아니며, 내 콘텐츠의 예상 반응을 뜻하지 않습니다.</p></section>${wrDailyReports((snapshot?.items||[]).filter(item=>item.category==='analysis'||item.region==='GLOBAL'))}${wr.error?`<p class="wr-note">회사 참고 자료: ${escape(wr.error)}</p>`:''}${wrTrendLibrary()}`;
}
async function wrCollectDaily(){
  if(!isAdmin()||wr.dailyCollecting||wr.dailySaving||wr.daily?.running)return;
  const userId=state.user?.id,request=++wr.dailyActionRequest;wr.dailyCollecting=true;wr.dailyError='';if(state.tab==='workroom')render();
  try{await api('/api/daily-trends/collect',{force:true});if(state.user?.id!==userId||request!==wr.dailyActionRequest)return;await wrLoadDaily(wr.dailyDate);}
  catch(error){if(state.user?.id===userId&&request===wr.dailyActionRequest)wr.dailyError=error.message||'수집을 완료하지 못했어요.';}
  finally{if(state.user?.id===userId&&request===wr.dailyActionRequest){wr.dailyCollecting=false;if(state.tab==='workroom')render();}}
}
function wrDailySettings(){
  if(!isAdmin()||wr.dailyCollecting||wr.dailySaving||wr.daily?.running)return;const settings=wr.daily?.settings||{enabled:true,hourKst:6,minuteKst:0,regions:['KR','US','CN']};
  modal('매일 수집 설정','한국 시간(KST) 기준입니다. 연결되지 않은 출처는 연결 필요 상태로 남습니다.',`<form data-workroom-daily-settings class="form-stack"><div class="form-error" role="alert"></div><label class="wr-settings-enable"><input type="checkbox" name="enabled" ${settings.enabled?'checked':''}>매일 자동 수집</label><div class="field-row"><label class="field">시<input type="number" name="hourKst" min="0" max="23" step="1" required value="${Number.isInteger(settings.hourKst)?settings.hourKst:6}"></label><label class="field">분<input type="number" name="minuteKst" min="0" max="59" step="1" required value="${Number.isInteger(settings.minuteKst)?settings.minuteKst:0}"></label></div><fieldset class="wr-settings-regions"><legend>수집 국가</legend>${['KR','US','CN'].map(region=>`<label><input type="checkbox" name="regions" value="${region}" ${settings.regions?.includes(region)?'checked':''}>${wrRegions[region]}</label>`).join('')}</fieldset><p class="wr-note">공개 접근과 공식 연결이 가능한 자료만 수집합니다. 플랫폼별 제한은 출처 상태에 표시됩니다.</p><div class="modal-actions">${button('취소','close-modal')}<button class="btn primary" type="submit">설정 저장</button></div></form>`,true);
}
function wrDailySettingsPayload(values){
  const hourKst=Number(values.hourKst),minuteKst=Number(values.minuteKst),regions=[...new Set(values.regions||[])];
  if(values.hourKst===''||values.minuteKst===''||!Number.isInteger(hourKst)||hourKst<0||hourKst>23||!Number.isInteger(minuteKst)||minuteKst<0||minuteKst>59)throw new Error('수집 시각은 0~23시, 0~59분으로 입력해 주세요.');
  if(!regions.length||regions.some(region=>!['KR','US','CN'].includes(region)))throw new Error('수집할 국가를 하나 이상 선택해 주세요.');
  return {enabled:Boolean(values.enabled),hourKst,minuteKst,regions};
}
async function wrSaveDailySettings(form){
  if(!isAdmin()||wr.dailySaving||wr.dailyCollecting||wr.daily?.running)return;
  const submit=form.querySelector('[type="submit"]');if(submit.disabled)return;const errorBox=form.querySelector('.form-error'),userId=state.user?.id,request=++wr.dailyActionRequest,modalRequest=state.modalRequest;
  submit.disabled=true;errorBox.textContent='';wr.dailySaving=true;
  try{
    const values=new FormData(form),payload=wrDailySettingsPayload({enabled:values.has('enabled'),hourKst:values.get('hourKst'),minuteKst:values.get('minuteKst'),regions:values.getAll('regions')});
    await api('/api/daily-trends/settings',payload);if(state.user?.id!==userId||request!==wr.dailyActionRequest)return;
    if(form.isConnected&&state.modalRequest===modalRequest)closeModal();await wrLoadDaily(wr.dailyDate);
    if(state.user?.id===userId&&request===wr.dailyActionRequest)notify('매일 수집 설정을 저장했어요.');
  }catch(error){if(state.user?.id===userId&&request===wr.dailyActionRequest){if(form.isConnected&&state.modalRequest===modalRequest)errorBox.textContent=error.message;else notify(error.message);}}
  finally{if(state.user?.id===userId&&request===wr.dailyActionRequest){wr.dailySaving=false;if(submit.isConnected)submit.disabled=false;if(state.tab==='workroom')render();}}
}
async function wrOpenDailyPlan(itemId){
  if(isViewer())return;const item=wr.daily?.snapshot?.items?.find(row=>row.id===itemId);if(!item)throw new Error('수집 목록에서 이 항목을 다시 확인해 주세요.');
  const userId=state.user?.id,request=++wr.dailyPlanRequest,sourceRequest=wr.dailyRequest,chosen={...item};
  await loadContentWorkspace();if(state.user?.id!==userId||request!==wr.dailyPlanRequest||sourceRequest!==wr.dailyRequest)return;
  if(cp.error)throw new Error(cp.error);if(!cp.data)return;
  const url=safeUrl(chosen.url),metric=chosen.metric,metricLine=metric?.label&&(metric.display||Number.isFinite(metric.value))?metric.label+' '+(metric.display||String(metric.value)):'';
  const proof=[chosen.title,url==='#'?'원문 주소 미확인':url,wrTrendPlatformLabel(chosen.platform)+' · '+(wrRegions[chosen.region]||chosen.region||''),metricLine,Number.isInteger(chosen.rank)&&chosen.rank>0?'출처 순위 '+chosen.rank:'','수집 '+wrTrendTime(chosen.collectedAt),chosen.publishedAt?'발행 '+wrTrendTime(chosen.publishedAt):'','출처별 자료이며 전체 인기 순위가 아닙니다.'].filter(Boolean).join('\n');
  cp.input={...cpBlank(),seriesId:wr.series,topic:String(chosen.title||'').slice(0,300),proof};cp.draftId='';cp.activeDraft=null;cp.pendingDraftId='';cp.ideaId='';cp.results=null;
  await cpNavigate('plan');window.scrollTo(0,0);
}
function wrTrendLibrary(){
  const guide=wr.guide,issue=wr.content?.benchmark?.current,refs=(wr.content?.references||[]).filter(row=>row.ownerId===state.user?.id);if(!guide)return '';
  return `<details class="wr-trend-library"><summary>공식 자료 분석 메모</summary><section class="wr-section"><div class="wr-section-head"><div><h2>확인한 흐름과 적용 아이디어</h2><p>공식 자료를 읽은 메모입니다. 오늘의 인기 순위와 구분해 참고하세요.</p></div></div><div class="wr-tip-grid">${guide.trendNotes.map(note=>`<article class="wr-tip"><span class="wr-kicker">${escape(note.source)} · ${note.needsRefresh?'다시 확인 권장':'확인한 자료'}</span><h3>${escape(note.title)}</h3><p>${escape(note.fact)}</p><p class="wr-example">${escape(note.application)}</p><p class="wr-note">발행 ${escape(note.publishedAt)} · 확인 ${escape(note.checkedAt)}</p>${wrExternal('공식 원문',note.url)}</article>`).join('')}</div></section></details><details class="wr-trend-library"><summary>팀이 조사한 벤치마크</summary><section class="wr-section"><div class="wr-section-head"><div><p>원본·도입·전개·가치·반응을 함께 보고 우리 내용으로 바꿔보세요.</p></div>${wrButton(isAdmin()?'조사 자료 등록·보기':'팀 자료 자세히 보기','benchmarks','','small quiet')}</div>${issue?`<div class="wr-benchmark-meta"><strong>${escape(issue.title)}</strong><span>조사 ${bmDate(issue.researchedAt)} · ${issue.stale?'새 조사 권장':'등록된 조사 자료'}</span></div><div class="wr-tip-grid">${issue.items.map(item=>`<article class="wr-tip"><span class="wr-kicker">${escape(item.platform)} · 게시 ${bmDate(item.publishedAt)}</span><h3><a href="${escape(safeUrl(item.url))}" target="_blank" rel="noopener noreferrer">${escape(item.title)}${icon('external')}</a></h3><p>도입: ${escape(item.hook)}</p><p>전개: ${escape(item.structure)}</p><p>가치: ${escape(item.payoff)}</p><p class="wr-example">${escape(item.adaptation)}</p><p class="wr-note">좋아요 ${number(item.metrics?.likes)} · 공유 ${number(item.metrics?.shares)} · 저장 ${number(item.metrics?.saves)}<br>관찰 ${bmDate(item.checkedAt)} · ${escape(item.evidenceNote)}</p>${!isViewer()?wrButton('이 사례로 새 기획','benchmark',`data-id="${escape(item.id)}"`,'small'):''}</article>`).join('')}</div>`:`<div class="wr-empty"><h3>${wr.loading?'팀 자료를 불러오는 중이에요':'아직 공유된 조사 자료가 없어요'}</h3><p>확인한 보고서를 등록하면 실제 사례와 공개 반응을 함께 볼 수 있어요.</p></div>`}<p class="wr-note">미확인 수치는 —로 표시합니다. 계정 크기·게시 경과일·플랫폼이 다른 수치를 같은 조건처럼 비교하지 않아요.</p></section></details><details class="wr-trend-library"><summary>내가 모은 레퍼런스</summary><section class="wr-section"><div class="wr-section-head"><div><p>우리 콘텐츠에 가져올 구조와 배울 점을 기록해 두세요.</p></div>${!isViewer()?wrButton('참고 릴스 저장','reference','','small'):''}</div>${refs.length?`<div class="wr-reference-list">${refs.slice(0,8).map(row=>`<article><h3><a href="${escape(safeUrl(row.url))}" target="_blank" rel="noopener noreferrer">${escape(row.title)}${icon('external')}</a></h3><p>${escape(row.formatNotes||'배울 구조를 기획함에서 기록해 보세요.')}</p><span>게시 ${bmDate(row.publishedAt)} · 관찰 ${bmDate(row.checkedAt)}</span></article>`).join('')}</div>${refs.length>8?wrButton('전체 참고 자료 보기','references','','small quiet'):''}`:'<div class="wr-empty"><p>아직 모아 둔 참고 콘텐츠가 없어요. 링크와 배울 점을 남겨보세요.</p></div>'}</section></details>${guide.observedTrends?`<details class="wr-trend-library"><summary>이전 수동 관찰 기록</summary>${wrObservedTrends()}</details>`:''}`;
}
function wrObservedTrends(){
  const data=wr.guide?.observedTrends;if(!data)return '';
  return `<section class="wr-section"><div class="wr-section-head"><div><h2>이전에 기록한 관찰</h2><p>${escape(data.region)} · ${escape(data.period)} 화면 · ${escape(data.checkedAt)} 직접 확인${data.needsRefresh?' · 다시 확인 권장':''}</p></div>${wrExternal('관찰한 원문',data.url)}</div><div class="wr-observed-grid">${data.items.map(item=>`<article class="wr-tip"><span class="wr-kicker">공식 화면 순위 ${item.rank}</span><h3>${escape(item.tag)}</h3><p>게시물 ${escape(item.posts)} · 조회 ${escape(item.views)}</p><p class="wr-example">${escape(item.application)}</p></article>`).join('')}</div><p class="wr-note">공식 사이트에 표시된 해시태그 집계의 관찰 기록이며 자동 갱신하지 않습니다. 개별 영상의 성과나 내 콘텐츠의 예상 반응을 뜻하지 않아요. 제작하는 날 원문을 다시 확인하세요.</p></section>`;
}
function wrPages(){
  const own=(state.data?.channels||[]).filter(row=>row.ownerIds?.includes(state.user?.id)&&row.active!==false),platforms=[...new Set(own.map(row=>row.platform))];
  if(wr.platform!=='all'&&!platforms.includes(wr.platform))wr.platform='all';
  const rows=own.filter(row=>wr.platform==='all'||row.platform===wr.platform);
  return `<section class="wr-section"><div class="wr-section-head"><div><h2>등록한 페이지 <span class="wr-count">${own.length}</span></h2></div>${!isViewer()?wrButton('내 페이지 등록','register','','primary'):''}</div><details class="wr-pages-help"><summary>페이지 등록 안내</summary><p>주소를 붙여 넣으면 플랫폼을 구분하고 <strong>본인 담당</strong>으로 등록해요. 수치 수집은 등록 후 계정 연결을 완료해야 시작됩니다.</p><p>담당 페이지는 회사의 기존 채널 열람 범위에 따라 공유됩니다.</p></details>${isViewer()?'<p class="wr-note">열람 계정은 페이지 등록·수집 연결을 변경할 수 없어요.</p>':''}${own.length?`<label class="wr-platform">플랫폼<select data-action="workroom-platform" aria-label="내 페이지 플랫폼"><option value="all">전체 플랫폼</option>${platforms.map(platform=>`<option value="${escape(platform)}" ${wr.platform===platform?'selected':''}>${escape(platformLabel(platform))}</option>`).join('')}</select></label><div class="wr-page-grid">${rows.slice(0,wr.limit).map(channel=>`<article class="wr-page"><div class="wr-page-heading">${platformMark(channel.platform)}<span>${escape(platformLabel(channel.platform))}</span><span class="wr-page-status">${channel.connected?'수집 연결됨':'주소 등록됨 · 수집 연결 필요'}</span></div><h3>${escape(channelName(channel))}</h3><a class="wr-page-url" href="${escape(safeUrl(channel.canonicalUrl))}" target="_blank" rel="noopener noreferrer">${escape(channel.canonicalUrl)}${icon('external')}</a><div class="wr-actions">${!isViewer()&&channel.canConnect?button(channel.connected?'연결 확인':'계정 연결','connect','link','small',`data-id="${escape(channel.id)}"`):''}${!isViewer()&&channel.canEdit?button('페이지 정보','channel-settings','settings','small quiet',`data-id="${escape(channel.id)}"`):''}</div></article>`).join('')}</div>${rows.length>wr.limit?wrButton('페이지 더 보기','more','','small quiet'):''}`:'<div class="wr-empty"><h3>아직 맡은 페이지가 없어요</h3><p>페이지나 프로필 주소를 직접 등록해 보세요. 다른 담당자에게 이미 배정된 페이지는 관리자에게 담당 추가를 요청하세요.</p></div>'}</section>`;
}
async function wrSource(id){
  if(!wr.guide?.sources.some(row=>row.id===id))return;
  const userId=state.user.id;modal('제작 기준 원문','기존 정본의 현재 내용을 확인합니다.','<p role="status">원문을 불러오고 있어요.</p>',true);const request=++state.modalRequest;
  try{const source=await api('/api/workroom-source/'+encodeURIComponent(id));if(request!==state.modalRequest||state.user?.id!==userId)return;document.querySelector('.modal-body').innerHTML=`<p class="wr-source-path">${escape(source.path)}</p><pre class="wr-source-text">${escape(source.text)}</pre>`;}
  catch(error){if(request===state.modalRequest&&state.user?.id===userId)document.querySelector('.modal-body').innerHTML=`<p class="form-error">${escape(error.message)}</p>`;}
}
async function wrOpenContent(view='plan',seriesId='',itemId='',replace=false){
  if(view==='plan'&&wrUnsavedPlan()&&!replace){wrConfirmPlanChoice({seriesId:seriesId||wr.series,itemId});return;}
  const userId=state.user?.id;await loadContentWorkspace();if(state.user?.id!==userId)return;if(cp.error)throw new Error(cp.error);if(!cp.data)return;wr.content=cp.data;
  if(view==='plan'){
    const chosen=wr.guide?.series.find(row=>row.id===(seriesId||wr.series));cp.input={...cpBlank(),...(chosen?{seriesId:chosen.id}:{})};cp.draftId='';cp.activeDraft=null;cp.pendingDraftId='';cp.ideaId='';cp.results=null;
    if(itemId){const issue=cp.data.benchmark?.current,item=issue?.items.find(row=>row.id===itemId);if(!item)throw new Error('최신 조사 자료에서 이 사례를 다시 확인해 주세요.');cp.input.benchmarkId=issue.id;cp.input.benchmarkItemId=item.id;const supported=item.seriesIds?.find(id=>cpSeries(id));if(supported)cp.input.seriesId=supported;}
  }
  await cpNavigate(view);window.scrollTo(0,0);
}
function wrRegister(){
  if(isViewer())return;
  modal('내가 관리하는 페이지 등록','주소를 한 줄에 하나씩 붙여 넣어 주세요.',`<form class="form-stack" data-workroom-register><div class="form-error" role="alert"></div><label class="field">페이지·프로필 주소<textarea name="urls" aria-label="페이지·프로필 주소" aria-describedby="wr-url-help" required rows="5" maxlength="20000" placeholder="https://www.facebook.com/우리페이지\nhttps://www.instagram.com/우리계정/\nhttps://www.tiktok.com/@우리계정"></textarea><small id="wr-url-help">Facebook·Instagram·TikTok·YouTube·Threads·X·LinkedIn 등 최대 20개. 플랫폼은 주소에서 자동으로 구분합니다. 게시물·단축 링크 대신 페이지·프로필 주소를 넣어 주세요.</small></label><p class="wr-note">담당자는 ${escape(state.user.name)}입니다. 등록된 페이지는 회사의 채널 권한에 따라 공유됩니다. 주소를 등록하는 것으로 로그인이나 수집 연결이 완료되지는 않아요.</p><div class="modal-actions">${button('취소','close-modal')}<button class="btn primary" type="submit">내 페이지로 등록</button></div></form>`);
}
async function wrCopy(){
  const lines=['# 콘텐츠 기획·직접 검토 양식','','시청자의 상황: ','볼 이유와 얻는 도움: ','주제 / 유형: ','스토리 (문제 → 시도 → 선택의 이유 → 확인한 결과): ','정보·예시·근거: ','재미·감정적 보상: ','브랜드의 관점·각자에게 맞는 도움: ','승인 자산·서체·디자인 반영: ','직접 경험 / 조사 / 연출 구분: ','참고 URL·게시일·확인일·관찰한 반응: ','측정할 지표·조건과 다음 실험: ','엔딩의 다음 행동과 제공 자료: ','','## 직접 검토',...(wr.guide?.review||[]).map(row=>`- [ ] ${row.label}`),'','체크는 본인의 표시이며 자동 품질 점수·게시 승인이 아닙니다.'];
  try{await navigator.clipboard.writeText(lines.join('\n'));notify('기획·검토 양식을 복사했어요.');}catch{modal('기획·검토 양식','선택해서 복사해 주세요.',`<label class="field">복사용 양식<textarea rows="18" readonly>${escape(lines.join('\n'))}</textarea></label>`,true);}
}
document.addEventListener('click',async event=>{
  const target=event.target.closest?.('[data-action^="workroom-"]');if(!target||target.disabled||!state.user)return;const action=target.dataset.action.slice(9);
  try{
    if(action==='view'&&['desk','trends','tools','pages','clients'].includes(target.dataset.tab)){wr.view=target.dataset.tab;wr.dailyPlanRequest++;render();window.scrollTo(0,0);}
    else if(action==='daily-region'&&['KR','US','CN'].includes(target.dataset.id)){wr.dailyRegion=target.dataset.id;wr.dailyPlatform='all';wr.dailyLimits.clear();wr.dailyPlanRequest++;render();}
    else if(action==='daily-more'){wr.dailyLimits.set(target.dataset.id,(wr.dailyLimits.get(target.dataset.id)||10)+20);render();}
    else if(action==='daily-refresh')await wrLoadDaily();
    else if(action==='daily-collect')await wrCollectDaily();
    else if(action==='daily-settings')wrDailySettings();
    else if(action==='daily-plan'&&!isViewer())await wrOpenDailyPlan(target.dataset.id);
    else if(action==='phase'&&wr.guide?.phases.some(row=>row.id===target.dataset.id)){wr.phase=target.dataset.id;render();}
    else if(action==='refresh')await loadWorkroom();
    else if(action==='source')await wrSource(target.dataset.id);
    else if(action==='plan'&&!isViewer())await wrOpenContent('plan',target.dataset.id);
    else if(action==='resume'){if(wr.planChoice){wr.planChoice=null;closeModal();}await wrResumePlan();}
    else if(action==='replace-plan')await wrReplacePlan();
    else if(action==='draft')await wrOpenDeskDraft(target.dataset.id);
    else if(action==='library')await wrOpenContent('library');
    else if(action==='automation'){makerTools.view='automation';wr.view='tools';render();makerToolsEnsure();window.scrollTo(0,0);}
    else if(action==='weekly'){makerTools.view='weekly';wr.view='tools';render();makerToolsEnsure();window.scrollTo(0,0);}
    else if(action==='publication'){makerTools.view='publication';wr.view='tools';render();makerToolsEnsure();window.scrollTo(0,0);}
    else if(action==='publish')wrOpenPublish();
    else if(action==='benchmark'&&!isViewer())await wrOpenContent('plan','',target.dataset.id);
    else if(action==='benchmarks'||action==='references')await wrOpenContent(action==='benchmarks'?'benchmarks':'discover');
    else if(action==='reference'&&!isViewer()){const userId=state.user.id;await loadContentWorkspace();if(state.user?.id!==userId)return;if(cp.error)throw new Error(cp.error);if(!cp.data)return;wr.content=cp.data;cpReferenceModal();}
    else if(action==='register')wrRegister();
    else if(action==='more'){wr.limit+=8;render();}
    else if(action==='copy')await wrCopy();
  }catch(error){notify(error.message);}
});
document.addEventListener('change',event=>{
  const target=event.target;
  if(target.dataset.action==='workroom-series'&&wr.guide?.series.some(row=>row.id===target.value)){wr.series=target.value;render();}
  if(target.dataset.action==='workroom-platform'){wr.platform=target.value;wr.limit=8;render();}
  if(target.dataset.action==='workroom-daily-date'){wr.dailyPlanRequest++;wr.dailyLimits.clear();void wrLoadDaily(target.value);}
  if(target.dataset.action==='workroom-daily-platform'){wr.dailyPlatform=wrTrendPlatform(target.value);wr.dailyLimits.clear();wr.dailyPlanRequest++;render();}
});
document.addEventListener('submit',async event=>{
  const form=event.target;if(form.matches?.('[data-workroom-daily-settings]')){event.preventDefault();await wrSaveDailySettings(form);return;}if(!form.matches?.('[data-workroom-register]'))return;event.preventDefault();const submit=form.querySelector('[type="submit"]');if(submit.disabled)return;submit.disabled=true;const errorBox=form.querySelector('.form-error'),userId=state.user?.id;errorBox.textContent='';
  try{
    const urls=String(new FormData(form).get('urls')||'').split(/\r?\n/).map(url=>url.trim()).filter(Boolean);if(!urls.length||urls.length>20)throw new Error('한 번에 주소 1~20개를 넣어 주세요.');
    const result=await api('/api/channels',{urls,ownerId:userId});if(state.user?.id!==userId)return;await loadState();if(state.user?.id!==userId||!form.isConnected)return;
    const ownExisting=result.existing.filter(row=>row.ownerIds.includes(userId)),otherExisting=result.existing.filter(row=>!row.ownerIds.includes(userId));
    document.querySelector('.modal-body').innerHTML=`<div class="form-success">내 페이지 ${result.added.length}개 등록 · 내 기존 페이지 ${ownExisting.length}개</div>${otherExisting.length?`<p class="wr-note">${otherExisting.length}개는 회사에 등록된 다른 담당자의 페이지입니다. 담당자 추가를 관리자에게 요청해 주세요.</p>`:''}${result.errors.length?`<div class="batch-result"><h3>다시 확인할 주소</h3>${result.errors.map(row=>`<div class="batch-entry"><div class="url">${escape(row.url)}</div><div>${escape(row.error)}</div></div>`).join('')}</div>`:''}<p class="wr-note">계정 연결을 완료하면 실제 수치를 확인할 수 있어요.</p><div class="modal-actions">${button('내 페이지 보기','close-modal','','primary')}</div>`;
  }catch(error){if(state.user?.id===userId){if(errorBox.isConnected)errorBox.textContent=error.message;else notify(error.message);}}finally{if(submit.isConnected)submit.disabled=false;}
});
