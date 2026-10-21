'use strict';
// 제작 상황판 — 제작 도구 13판 A 「목록 + 상세」(2026-10-21). 그리기 도우미(mt*)는 maker-tools.js 앞 절반에 있다.
// 머리(보기 분할 캡슐 「작업 · 소재 · 예시」 · 새로 만들기 · 계기판) → 왼쪽 옅은 판(찾기 · 범위 · 번호 묶음) / 오른쪽 상세.
// 작업: 01 도움 필요 → 02 검토 요청 → 03 준비 · 제작 중 → 04 완성(「모두」면 게시 기록 · 보관까지). 고르면 그 자리에서 「지금 할 일」 · 단계 막대 ·
// 01 완성본 · 의견(검토실, studio-review.js) · 02 다음 할 일 · 막힌 점. 소재(studio-board.js) · 예시(studio-review.js)도 같은 데스크다.
// 서버 계약(/api/studio-* · data-action="sw-*" · data-swb-* · data-swr-* · 단계 값)은 그대로다. sw.view는 board · materials · examples · review(작업을 연 상태)다.
const sw={userId:'',identity:'',request:0,loadRequest:0,examplesRequest:0,detailRequest:0,autoRequest:0,data:null,workspaceLoaded:false,workspaceAttempted:false,reloading:false,examplesLoading:false,view:'board',productionId:'',detail:null,busy:false,error:'',loading:false,filters:{},detailPending:null,detailError:null,materialId:'',exampleId:'',exampleQuery:'',picking:false,folds:{}};
const swStages={idea:'준비',making:'제작 중',review:'검토 요청',ready:'완성',published:'게시 기록',archived:'보관'};
const swStageOrder=['idea','making','review','ready','published'];
const swButton=(text,action,glyph='',classes='',attrs='')=>button(text,'sw-'+action,glyph,classes,attrs);
// 데스크 안 단추: 시그널 아이콘(mtIcon)과 글자를 escape해서 넣는다.
const swBtn=(label,action,{cls='small',attrs='',icon=''}={})=>`<button type="button" class="btn${cls?' '+cls:''}" data-action="sw-${action}" ${attrs}>${icon?mtIcon(icon):''}${escape(label)}</button>`;
const swIdentity=()=>state.user?JSON.stringify([state.user.id,state.user.role||'',state.user.teamId||'']):'';
const swGuard=()=>({userId:state.user?.id,identity:swIdentity(),request:sw.request});
const swAlive=guard=>!!guard.userId&&swIdentity()===guard.identity&&sw.request===guard.request;
const swVisible=()=>state.tab==='studio'||state.tab==='workroom'&&typeof wr!=='undefined'&&wr.view==='tools'&&typeof makerTools!=='undefined'&&makerTools.view==='productions';
const swLocation=()=>JSON.stringify([state.tab,typeof wr!=='undefined'?wr.view:'',typeof makerTools!=='undefined'?makerTools.view:'']);
function swSyncIdentity(){const identity=swIdentity();if(sw.userId!==state.user?.id||sw.identity&&sw.identity!==identity)resetStudioWorkspace();sw.userId=state.user?.id||'';sw.identity=identity;}
function swShow(view){sw.view=view;if(typeof makerTools!=='undefined'&&typeof selectWorkspaceView==='function'){makerTools.view='productions';selectWorkspaceView('workroom','tools');}else state.tab='studio';}
function ensureStudioWorkspace(){swSyncIdentity();if(state.user&&!sw.workspaceLoaded&&!sw.workspaceAttempted&&!sw.loading)swReload();}
const swDetail=()=>sw.detail?.id===sw.productionId?sw.detail:null;
const swDate=value=>value?escape(String(value).slice(0,10).replaceAll('-','.')):'기한 없음';
async function swLoadExamples(){
  if(!state.user)return;
  swSyncIdentity();
  const guard=swGuard(),request=++sw.examplesRequest;sw.examplesLoading=true;sw.loading=true;sw.error='';
  try{const result=await api('/api/studio-examples');if(!swAlive(guard)||request!==sw.examplesRequest)return;sw.data={productions:[],materials:[],...sw.data,...result};}
  catch(error){if(swAlive(guard)&&request===sw.examplesRequest)sw.error=error.message;}
  finally{if(swAlive(guard)&&request===sw.examplesRequest){sw.examplesLoading=false;sw.loading=sw.reloading;if(state.tab==='content'&&cp.view==='examples'||swVisible())render();}}
}
function resetStudioWorkspace(){sw.request++;sw.loadRequest++;sw.examplesRequest++;sw.detailRequest++;sw.autoRequest++;if(typeof swResetReview==='function')swResetReview();Object.assign(sw,{userId:'',identity:'',data:null,workspaceLoaded:false,workspaceAttempted:false,reloading:false,examplesLoading:false,view:'board',productionId:'',detail:null,busy:false,error:'',loading:false,filters:{},detailPending:null,detailError:null,materialId:'',exampleId:'',exampleQuery:'',picking:false,folds:{}});}
async function swReload({renderPage=true}={}){
  if(!state.user)return;
  swSyncIdentity();
  const guard=swGuard(),request=++sw.loadRequest;sw.reloading=true;sw.loading=true;sw.workspaceAttempted=true;sw.error='';
  if(renderPage&&swVisible()&&!sw.data)render();
  try{const data=await api('/api/studio-workspace');if(!swAlive(guard)||request!==sw.loadRequest)return;sw.data=data;sw.workspaceLoaded=true;
    if(renderPage&&swDetail()&&swCurrentView()==='board'&&swVisible()){sw.detailError=null;void swLoadDetail(sw.productionId);}}
  catch(error){if(swAlive(guard)&&request===sw.loadRequest)sw.error=error.message;}
  finally{if(swAlive(guard)&&request===sw.loadRequest){sw.reloading=false;sw.loading=sw.examplesLoading;if(renderPage&&swVisible())render();}}
}
function swAcceptProduction(production){
  if(!production)return;sw.detail=production;
  // 받은 작업은 목록의 제자리에 바꿔 넣는다(열 때마다 묶음 맨 위로 뛰지 않게). 새로 만든 작업만 맨 앞에 온다.
  if(sw.data){const {versions,notes,...summary}=production,rows=sw.data.productions||[];sw.data.productions=rows.some(row=>row.id===production.id)?rows.map(row=>row.id===production.id?summary:row):[summary,...rows];}
}
async function swOpenProduction(id){
  swSyncIdentity();const guard=swGuard(),request=++sw.detailRequest,location=swLocation();sw.error='';sw.detailError=null;
  const result=await api('/api/studio-productions/'+encodeURIComponent(id));
  if(!swAlive(guard)||request!==sw.detailRequest||swLocation()!==location)return;
  if(sw.productionId!==id&&typeof swResetReview==='function')swResetReview();
  sw.productionId=id;sw.picking=false;sw.folds={};swAcceptProduction(result.production);swShow('review');render();window.scrollTo(0,0);
}
// 목록이 첫 줄을 저절로 골랐을 때 그 작업의 버전 · 의견을 뒤에서 받는다(화면 위치는 건드리지 않는다). 사람이 다른 곳으로 옮기면(detailRequest가 바뀌면)
// 이 응답은 버린다. 거꾸로 이 읽기는 detailRequest를 올리지 않아, 사람이 누른 작업 열기를 끊지 않는다.
async function swLoadDetail(id){
  swSyncIdentity();const guard=swGuard(),request=sw.detailRequest,auto=++sw.autoRequest,location=swLocation(),current=()=>swAlive(guard)&&request===sw.detailRequest&&auto===sw.autoRequest;sw.detailPending={id,request};sw.detailError=null;
  try{const result=await api('/api/studio-productions/'+encodeURIComponent(id));if(!current()||swLocation()!==location||sw.productionId!==id)return;swAcceptProduction(result.production);}
  catch(error){if(current())sw.detailError={id,message:error.message};}
  finally{if(current()){sw.detailPending=null;if(swVisible())(typeof renderBackground==='function'?renderBackground:render)();}}
}
function swEnsureDetail(id){if(!id||swDetail()?.id===id||sw.detailError?.id===id||sw.detailPending?.id===id&&sw.detailPending.request===sw.detailRequest)return;sw.detailPending={id,request:sw.detailRequest};const run=()=>{if(sw.productionId===id&&swDetail()?.id!==id)void swLoadDetail(id);};if(typeof queueMicrotask==='function')queueMicrotask(run);else run();}
// 검토 담당(me)이 가장 최근 버전에 아직 풀리지 않은 의견을 남겼는가 — 남겼으면 제작 담당 차례다. 상세를 받은 작업에서만 안다.
function swReviewed(full,me){const latest=full&&typeof swrVersions==='function'?swrVersions(full)[0]:null;return !!latest&&(full.notes||[]).some(note=>note.versionId===latest.id&&note.ownerId===me&&!note.resolved);}
function swCurrentView(){return sw.view==='materials'?'materials':sw.view==='examples'?'examples':'board';}
function studioPage(){
  swSyncIdentity();
  const head=swHead();
  if(!sw.data||!sw.workspaceLoaded)return head+(sw.error?mtError(sw.error,swBtn('다시 읽기','reload',{attrs:sw.loading?'disabled':''})):'<p class="mt-loading" role="status">작업과 팀의 제작 기록을 불러오고 있어요.</p>');
  const view=swCurrentView(),desk=view==='materials'?swMaterialsDesk():view==='examples'?swExamplesDesk():swBoardDesk();
  return `<div class="sw-panel" data-sw-view="${view}">${head}${sw.error?mtError(sw.error):''}${desk}</div>`;
}
// 머리: 보기 분할 캡슐 · 새로 만들기 · 다시 읽기 · 보기마다의 계기판(누르면 거르는 칸).
function swHead(){
  const data=sw.data,view=swCurrentView(),viewer=isViewer(),examples=(data?.examples||[]).filter(row=>!row.archived);
  const ready=!!data&&sw.workspaceLoaded,seg=ready?`<div class="mt-seg is-inline sw-views" role="group" aria-label="볼 것">${[['board','작업',swbRows().length],['materials','소재',swbMaterials().length],['examples','예시',examples.length]].map(([id,label,count])=>`<button type="button" data-action="sw-view" data-view="${id}" aria-pressed="${view===id}">${label} <b>${mtNum(count)}</b></button>`).join('')}</div>`:'';
  // 새로 만들기는 늘 선 알약 — 고른 작업의 주 단추(「지금 할 일」 흰 알약 · 의견 남기기)와 겹치지 않게. 아직 하나도 없으면 상세 자리의 검은 알약이 대신한다.
  let add='';
  if(ready&&!viewer){
    if(view==='board'&&swbRows().length)add=`<button type="button" class="btn" data-action="sw-new-production">${mtIcon('plus')}새 작업</button>`;
    else if(view==='materials'&&swbMaterials().length)add=`<button type="button" class="btn" data-action="sw-new-material">${mtIcon('plus')}소재 남기기</button>`;
    else if(view==='examples'&&['admin','manager'].includes(state.user?.role))add=`<button type="button" class="btn" data-action="cp-example-new">${mtIcon('plus')}예시 더하기</button>`;
  }
  const refresh=`<button type="button" class="btn icon" data-action="sw-reload" aria-label="다시 읽기" title="다시 읽기" ${sw.loading?'disabled':''}>${mtIcon('refresh')}</button>`;
  const meter=ready?(view==='materials'?swbMaterialMeter():view==='examples'?swExampleMeter():swbMeter()):'';
  return mtHead({tool:'productions',title:'제작 상황판',desc:'작업마다 다음 할 일과 막힌 점, 완성본과 검토 의견을 한곳에서 봐요.',actions:seg+add+refresh,meter,layout:'desk'});
}
// 휴대폰 띠: 목록보다 앞에 두어 「바꾸기」로 펼친 목록 위에 「닫기」가 남는다(넓은 화면에서는 숨는다).
function swBand(summary){return `<div class="mt-list-mobile"><span>${summary}</span><button type="button" class="btn small" data-action="sw-pick" aria-expanded="${sw.picking}">${sw.picking?'닫기':'바꾸기'}</button></div>`;}
// 찾기 칸: 다시 그리지 않고 줄만 숨긴다(입력 칸 초점 유지). 다시 그릴 때는 목록이 같은 규칙(hidden)으로 그린다.
function swSearchBox(attr,value,placeholder,label){return `<label class="mt-search">${mtIcon('search')}<input type="search" ${attr} value="${escape(value||'')}" placeholder="${escape(placeholder)}" aria-label="${escape(label)}" autocomplete="off"></label>`;}
function swFilterRows(kind,query){if(typeof document==='undefined'||typeof document.querySelectorAll!=='function')return;const q=String(query||'').trim().toLowerCase(),seen=new Set(),list=document.querySelector(`[data-sw-list="${kind}"]`);if(!list)return;
  for(const row of list.querySelectorAll('[data-sw-row]')){const show=!q||String(row.dataset.search||'').includes(q);row.hidden=!show;if(show)seen.add(row.dataset.swRow);}
  for(const head of list.querySelectorAll('[data-sw-group]'))head.hidden=!seen.has(head.dataset.swGroup);
  const none=list.querySelector('[data-sw-none]');if(none)none.hidden=!q||seen.size>0;
}
const swHit=(text,query)=>{const q=String(query||'').trim().toLowerCase();return !q||String(text||'').toLowerCase().includes(q);};
// 번호 묶음 머리(h1 탭 이름 다음 단계라 h2 — 상세 제목도 h2, 그 안 구역은 h3).
const swGroupHead=(key,num,title,count,shown)=>`<h2 class="mt-list-group" data-sw-group="${escape(key)}" ${shown?'':'hidden'}><span class="mt-num">${String(num).padStart(2,'0')}</span>${escape(title)} <b>${mtNum(count)}</b></h2>`;
// 왼쪽 메뉴 숫자: 불러온 자료가 있을 때만. 도움이 필요한 작업은 코랄, 없으면 내 차례 수(검토할 완성본 · 남은 의견).
function studioNavCount(){if(!sw.data||sw.userId!==state.user?.id)return null;const rows=swbRows(),help=rows.filter(row=>swbGroupOf(row)==='help').length;if(help)return {value:help,tone:'alert',label:'도움 필요'};const mine=rows.filter(swbMine).length;return mine?{value:mine,tone:'',label:'내 차례'}:null;}

// ── 작업 데스크 ──
function swBoardDesk(){
  const model=swbBoardModel(),current=swbCurrentProduction(model);
  const summary=current?`<b>${escape(swbWord(current))}</b> · ${escape(current.title)}`:'고른 작업 없음';
  return `<div class="mt-desk${sw.picking?' is-picking':''}">${swBand(summary)}${swbBoardList(model,current)}${current?swProductionDetail(current):swbBoardEmpty(model)}</div>`;
}
// 고른 작업: 고른 것이 아직 있으면 그대로(저장 뒤 단계가 바뀌어 목록 조건 밖이 돼도 상세는 남는다), 없으면 목록 첫 줄을 고르고 버전 · 의견을 뒤에서 받는다.
// 계기판 · 범위 · 담당을 바꿀 때는 swbRepick()이 조건 밖의 고른 것을 비워 첫 줄을 다시 고르게 한다.
function swbCurrentProduction(model){
  let row=swbRows().find(item=>item.id===sw.productionId)||null;
  if(!row){row=model.visible[0]||null;if(row){if(typeof swResetReview==='function')swResetReview();sw.productionId=row.id;sw.folds={};}}
  if(row)swEnsureDetail(row.id);
  return row;
}
function swProductionDetail(row){
  const full=swDetail()?.id===row.id?swDetail():null,production=full||row,stage=swStages[production.stage]?production.stage:'',write=!!production.canEdit&&!isViewer(),key=escape(row.id);
  const scope=production.teamId?`함께 보는 팀 · ${swbTeamName(production.teamId)}`:'지정한 사람만 봐요';
  const versions=full?full.versions?.length||0:production.versionCount||0;
  const chips=`${mtBadge(swStages[production.stage]||'단계 모름',swbTone(production))}<span>${escape(scope)}</span><span>완성본 ${mtNum(versions)}개</span>`;
  const people=[`제작 ${production.assigneeName||'정하지 않음'}`,`검토 ${production.reviewerName||'정하지 않음'}`,swbDueText(production)].filter(Boolean).join(' · ');
  const now=swNow(production,full),nowEdits=now.includes('data-action="sw-edit-production"');
  const actions=[production.canReadDraft&&production.draftId?`<button type="button" class="mt-link" data-action="sw-open-linked-draft" data-id="${escape(production.draftId)}">연결한 기획 보기</button>`:'',write&&!nowEdits?swBtn('작업 정보 고치기','edit-production',{attrs:`data-id="${key}"`}):''].filter(Boolean).join('');
  const head=`<div class="mt-detail-head is-plain"><div><div class="mt-chips">${chips}</div><h2>${escape(production.title)}</h2><p>${escape(people)}</p>${actions?`<div class="mt-actions">${actions}</div>`:''}</div></div>`;
  const steps=production.stage==='archived'?'':`<ol class="mt-steps" data-cols="5" aria-label="이 작업의 단계">${swStageOrder.map((id,index)=>{const now=swStageOrder.indexOf(production.stage),state=index<now?'done':index===now?'now':'';return `<li${state?` data-s="${state}"`:''}${state==='now'?' aria-current="step"':''}>${swStages[id]}</li>`;}).join('')}</ol>`;
  const open=(name,fallback)=>Object.hasOwn(sw.folds,name)?!!sw.folds[name]:fallback;
  const roomSum=full?`버전 ${mtNum(versions)} · 남은 의견 ${mtNum((full.notes||[]).filter(note=>!note.resolved).length)}`:'불러오는 중';
  const room=full?(typeof swrRoom==='function'?swrRoom(full):''):sw.detailError?.id===row.id?mtError(sw.detailError.message,swBtn('다시 불러오기','open-production',{attrs:`data-id="${key}"`})):'<p class="mt-loading" role="status">완성본과 의견을 불러오고 있어요.</p>';
  const next=`<div class="sw-next"><h4>다음 할 일</h4><p class="${production.nextAction?'':'is-empty'}">${escape(production.nextAction||'아직 정하지 않았어요.')}</p>${production.blocker?`<div class="sw-blocker"><h4>막힌 점 · 필요한 도움</h4><p>${escape(production.blocker)}</p></div>`:''}${write?`<div class="mt-actions">${swBtn('고치기','edit-production',{attrs:`data-id="${key}"`})}</div>`:''}</div>`;
  const sections=mtSec({num:'01',title:'완성본 · 의견',sum:roomSum,open:open('room',true),body:room,attrs:`id="sw-sec-room-${key}" data-sw-fold="room"`})+mtSec({num:'02',title:'다음 할 일 · 막힌 점',sum:production.blocker?'막힌 점이 있어요':swShortText(production.nextAction,'정하지 않았어요'),sumTone:production.blocker?'alert':'',open:open('next',false),body:next,attrs:`id="sw-sec-next-${key}" data-sw-fold="next"`});
  const foot=production.stage==='published'?'<p class="mt-note sw-foot">「게시 기록」은 손으로 바꾼 단계예요. 실제로 올라갔는지는 게시 준비·성과에서 봐요.</p>':'';
  return `<div class="mt-detail sw-detail" data-sw-detail="${key}">${head}${now}${steps}${sections}${foot}</div>`;
}
function swShortText(value,empty='비어 있어요'){const text=value?String(value).replace(/\s+/g,' ').trim():'';return text?text.length>40?text.slice(0,40)+'…':text:empty;}
// 「지금 할 일」: 내 차례(검토할 완성본 · 남은 의견 · 다음 할 일)면 포스터(흰 알약이 화면의 주 단추), 기다리거나 끝났으면 옅은 판.
function swNow(production,full){
  const me=state.user?.id,tool='productions',attrs='data-sw-now',key=escape(production.id),write=!!production.canEdit&&!isViewer(),comment=!!production.canComment&&!isViewer();
  const versions=full?full.versions?.length||0:production.versionCount||0,notes=full?(full.notes||[]).filter(note=>!note.resolved).length:production.openNotes||0;
  const maker=production.assigneeId===me||!production.assigneeId&&production.ownerId===me,stage=production.stage;
  const reviewed=swReviewed(full,me);
  const share=!!production.canPublishExample&&!isViewer()&&!!full&&versions>0,shareButton=share?swBtn('좋은 예시로 남기기','review-example'):'';
  const poster=o=>mtNow({tool,label:'내 차례',word:'제작',attrs,...o}),quiet=o=>mtNow({tool,tone:'quiet',attrs,...o});
  const edit=write?swBtn('작업 정보 고치기','edit-production',{attrs:`data-id="${key}"`}):'';
  if(stage==='archived')return quiet({label:'보관',title:'보관한 작업이에요',body:escape('작업 정보에서 단계를 바꾸면 다시 진행 목록에 올라와요.'),actions:edit});
  if(production.blocker&&swbActiveStages.has(stage)){
    if(maker&&write)return quiet({label:'도움 기다림',title:'도움을 기다리고 있어요',body:escape(production.blocker),actions:edit});
    if(comment&&full&&versions)return poster({label:'도움 요청',title:'도움이 필요해요',body:escape(production.blocker),actions:mtPill('의견 쓰기','data-action="sw-review-note"')});
    return quiet({label:'도움 필요',title:'도움이 필요한 작업이에요',body:escape(production.blocker)});
  }
  if(stage==='review'){
    if(production.reviewerId===me&&comment){
      if(!versions)return quiet({label:'검토 요청',title:'아직 올라온 완성본이 없어요',body:escape('제작 담당이 버전을 올리면 여기서 볼 수 있어요.')});
      if(reviewed)return quiet({label:'의견 남김',title:'이 버전에 의견을 남겼어요',body:escape('제작 담당이 고친 버전을 올리면 다시 볼 차례예요.')});
      return poster({title:'검토할 완성본이 있어요',body:escape('가장 최근 버전을 끝까지 보고, 좋았던 점과 바꿀 점을 의견으로 남겨요.'),actions:mtPill('의견 쓰기','data-action="sw-review-note"')});
    }
    if(maker&&write&&notes)return poster({title:`남은 의견 ${notes}개`,body:escape('의견을 읽고 고친 버전을 올리거나, 반영한 의견은 해결로 표시해요.'),actions:mtPill('의견 보기','data-action="sw-review-notes"')});
    return quiet({label:'검토 기다림',title:'검토를 기다리고 있어요',body:escape(production.reviewerName?`검토 담당: ${production.reviewerName}`:'검토 담당을 정하면 그 사람의 목록에도 올라가요.')});
  }
  if(['idea','making'].includes(stage)&&maker&&write){
    if(notes)return poster({title:`남은 의견 ${notes}개`,body:escape('의견을 읽고 고친 버전을 올리거나, 반영한 의견은 해결로 표시해요.'),actions:mtPill('의견 보기','data-action="sw-review-notes"')});
    if(production.nextAction)return poster({title:production.nextAction,body:escape(versions?'고친 버전을 올리고 단계를 「검토 요청」으로 바꾸면 검토 담당이 봐요.':'첫 버전을 올리고 단계를 「검토 요청」으로 바꾸면 검토 담당이 봐요.'),actions:mtPill('버전 올리기','data-action="sw-review-version"')});
    return poster({title:'다음 할 일을 정해요',body:escape('다음 할 일을 한 줄로 남기면 목록과 이 판에 보여요.'),actions:mtPill('작업 정보 고치기',`data-action="sw-edit-production" data-id="${key}"`)});
  }
  if(stage==='ready')return quiet({label:'완성',title:'완성한 작업이에요',body:escape(share?'팀에 남기고 싶은 장면이면 좋은 예시로 남겨요. 올린 뒤에는 단계를 「게시 기록」으로 바꿔요.':'올린 뒤에는 단계를 「게시 기록」으로 바꿔요.'),actions:shareButton});
  if(stage==='published')return quiet({label:'게시 기록',title:'게시 기록으로 표시한 작업이에요',body:escape(share?'올린 뒤 숫자와 기록은 게시 준비·성과에서 봐요. 좋았던 장면은 예시로 남길 수 있어요.':'올린 뒤 숫자와 기록은 게시 준비·성과에서 봐요.'),actions:`<button type="button" class="mt-link" data-maker-tool="publication">게시 준비·성과 열기</button>${shareButton}`});
  return quiet({label:swStages[stage]||'진행 중',title:production.nextAction?`다음 할 일: ${production.nextAction}`:'진행 중인 작업이에요',body:escape(production.assigneeName?`제작 담당: ${production.assigneeName}`:'제작 담당을 정하면 그 사람의 목록에 올라가요.')});
}
function swMembersOptions(selected,optional=false,selectedName='예전에 정한 담당'){
  const members=sw.data?.assignableMembers||[{id:state.user.id,name:state.user.name}];
  return (optional?cpOption('','정하지 않음',selected):'')+(selected&&!members.some(row=>row.id===selected)?`<option value="${escape(selected)}" selected disabled>${escape(selectedName||'예전에 정한 담당')}</option>`:'')+members.map(row=>cpOption(row.id,row.name,selected)).join('');
}
function swProductionModal(id='',seed={}){
  const row=id?(sw.detail?.id===id?sw.detail:sw.data.productions.find(item=>item.id===id)):null;
  if(id&&!row?.canEdit){notify('이 작업은 고칠 수 없어요. 제작 담당이나 관리자에게 부탁해 주세요.');return;}
  const value=row||{title:seed.title||'',assigneeId:state.user.id,reviewerId:'',teamId:'',stage:'idea',nextAction:'',blocker:'',dueDate:'',draftId:seed.draftId||''};
  const teams=sw.data?.assignableTeams||[];
  modal(id?'작업 정보 고치기':'새 작업','만드는 것과 다음 할 일을 짧게 남겨요.',`<form class="form-stack sw-production-form" data-sw-form="production" data-id="${escape(id)}"><div class="form-error" role="alert"></div><label class="field">작업 제목<input name="title" required maxlength="200" value="${escape(value.title)}" placeholder="예: 회의 메모를 할 일로 바꾸는 실제 과정"></label><div class="field-row"><label class="field">제작 담당<select name="assigneeId">${swMembersOptions(value.assigneeId||state.user.id,false,value.assigneeName)}</select></label><label class="field">함께 검토할 사람<select name="reviewerId">${swMembersOptions(value.reviewerId||'',true,value.reviewerName)}</select></label></div><div class="field-row"><label class="field">단계<select name="stage">${Object.entries(swStages).map(([key,label])=>cpOption(key,label,value.stage)).join('')}</select></label><label class="field">목표 날짜<input type="date" name="dueDate" value="${escape(value.dueDate||'')}"></label></div><label class="field">다음 할 일<textarea name="nextAction" rows="2" maxlength="1000" placeholder="예: 실제 전후 화면을 찍고 편집본 올리기">${escape(value.nextAction||'')}</textarea></label><label class="field">막힌 점 · 필요한 도움<textarea name="blocker" rows="2" maxlength="1000" placeholder="예: 용어가 쉽게 읽히는지 같이 봐 주세요. 없으면 비워 둬요.">${escape(value.blocker||'')}</textarea></label><label class="field">함께 볼 사람<select name="teamId">${cpOption('','만든 사람 · 제작 담당 · 검토 · 관리자',value.teamId||'')}${value.teamId&&!teams.some(team=>team.id===value.teamId)?`<option value="${escape(value.teamId)}" selected disabled>예전에 정한 팀</option>`:''}${teams.map(team=>cpOption(team.id,team.name+' 전체',value.teamId||'')).join('')}</select><small>고른 사람과 팀은 이 작업의 파일 · 버전 · 검토 의견을 함께 봐요. 연결한 개인 기획안의 공개 범위는 바뀌지 않아요.</small></label><input type="hidden" name="draftId" value="${escape(value.draftId||'')}">${seed.draftId?'<p class="sw-note">지금 기획안의 제목과 연결을 가져왔어요. 만드는 일과 판단은 제작 담당이 해요.</p>':''}<p class="sw-note">「완성」과 「게시 기록」은 제작 담당이 손으로 바꾸는 단계예요.</p><div class="modal-actions">${button('닫기','close-modal')}<button class="btn primary" type="submit">${id?'저장':'작업 만들기'}${icon('arrow')}</button></div></form>`,true);
}
async function swPlanMaterial(id){
  const material=sw.data?.materials.find(row=>row.id===id);if(!material||isViewer())return;
  const guard=swGuard();if(!cp.data||cp.userId!==state.user.id)await loadContentWorkspace();if(!swAlive(guard))return;
  cp.input=cpBlank();cp.input.topic=material.title.slice(0,300);
  const memo=material.body||'';
  if(material.kind==='experience')cp.input.experience=memo.slice(0,3000);
  else cp.input.proof=('소재 메모 · 사실 확인 전\n'+memo+(material.sourceUrl?'\n출처: '+material.sourceUrl:'')).slice(0,3000);
  if(material.kind==='experience'&&material.sourceUrl)cp.input.proof=material.sourceUrl;
  cp.draftId='';cp.activeDraft=null;cp.ideaId='';cp.view='plan';state.tab='content';render();window.scrollTo(0,0);notify('소재를 개인 기획에 가져왔어요. 내용을 채운 뒤 구성안을 만들어요.');
}
async function swUploadMedia(id,file,label,onProgress){
  if(!file||!file.size)throw new Error('빈 파일이라 올릴 수 없어요. 내용이 있는 파일을 골라 주세요.');
  if(file.size>100*1024*1024)throw new Error('100MB 이하의 검토용 파일을 골라 주세요.');
  const types={'mp4':'video/mp4','webm':'video/webm','png':'image/png','jpg':'image/jpeg','jpeg':'image/jpeg'},extension=file.name.split('.').pop().toLowerCase(),type=types[extension];
  if(!type)throw new Error('MP4 · WebM 영상이나 PNG · JPEG 이미지를 골라 주세요.');
  return new Promise((resolve,reject)=>{
    const xhr=new XMLHttpRequest();xhr.open('POST','/api/studio-productions/'+encodeURIComponent(id)+'/media');xhr.withCredentials=true;xhr.responseType='json';
    xhr.setRequestHeader('Content-Type',type);xhr.setRequestHeader('X-CSRF-Token',state.csrf);xhr.setRequestHeader('X-File-Name',encodeURIComponent(file.name));xhr.setRequestHeader('X-Version-Label',encodeURIComponent(label||file.name));
    xhr.timeout=10*60*1000;xhr.upload.onprogress=event=>{if(onProgress&&event.lengthComputable)onProgress(Math.round(event.loaded/event.total*100));};
    xhr.onerror=()=>reject(new Error('올리는 중에 연결이 끊겼어요. 인터넷 연결을 본 뒤 다시 올려 주세요.'));xhr.ontimeout=()=>reject(new Error('올리는 시간이 너무 길어졌어요. 더 작은 검토용 파일로 다시 올려 주세요.'));
    xhr.onload=()=>{if(xhr.status>=200&&xhr.status<300)resolve(xhr.response||{});else{const error=new Error(xhr.response?.error||'파일을 올리지 못했어요. 잠시 뒤 다시 올려 주세요.');error.status=xhr.status;reject(error);}};xhr.send(file);
  });
}
document.addEventListener('click',async event=>{
  const target=event.target.closest('[data-action^="sw-"]');if(!target||target.disabled)return;const action=target.dataset.action.slice(3),id=target.dataset.id;
  if(!['view','reload','new-production','edit-production','open-production','plan-material','production-from-draft','open-linked-draft','pick'].includes(action))return;
  const guard=swGuard();
  try{
    if(action==='view'){sw.detailRequest++;sw.view=target.dataset.view;sw.picking=false;render();window.scrollTo(0,0);}
    else if(action==='pick'){sw.picking=!sw.picking;render();}
    else if(action==='reload')await swReload();
    else if(action==='new-production'){const material=sw.data?.materials.find(row=>row.id===target.dataset.material);swProductionModal('',{title:material?.title||''});}
    else if(action==='edit-production')swProductionModal(id||sw.productionId);
    else if(action==='open-production'){if(id===sw.productionId&&swDetail()&&!sw.detailError){sw.picking=false;render();return;}target.disabled=true;await swOpenProduction(id);}
    else if(action==='plan-material')await swPlanMaterial(id);
    else if(action==='production-from-draft'){const draft=cpDraft();if(!draft)return;if(!sw.workspaceLoaded||sw.userId!==state.user.id)await swReload({renderPage:false});if(state.user?.id!==guard.userId||!sw.data||!sw.workspaceLoaded)return;swProductionModal('',{title:draft.title,draftId:draft.id});}
    else if(action==='open-linked-draft'){if(!cp.data||cp.userId!==state.user.id)await loadContentWorkspace();if(!swAlive(guard))return;await cpOpenDraft(id);if(!swAlive(guard))return;state.tab='content';cp.view='plan';render();window.scrollTo(0,0);}
  }catch(error){if(state.user?.id===guard.userId)notify(error.message);}finally{if(target.isConnected)target.disabled=false;}
});
document.addEventListener('submit',async event=>{
  const form=event.target.closest('[data-sw-form="production"]');if(!form)return;event.preventDefault();const submit=form.querySelector('[type="submit"]');if(submit.disabled)return;const errorBox=form.querySelector('.form-error'),guard=swGuard(),id=form.dataset.id;submit.disabled=true;errorBox.textContent='';
  try{const values=Object.fromEntries(new FormData(form));for(const key of ['dueDate','teamId','reviewerId','draftId']){if(Object.hasOwn(values,key))values[key]||=null;}if(id)delete values.draftId;const result=await api('/api/studio-productions'+(id?'/'+encodeURIComponent(id):''),values);if(!swAlive(guard))return;const sameForm=form.isConnected;if(sameForm)closeModal();const place={location:swLocation(),view:sw.view,detailRequest:sw.detailRequest,modalRequest:state.modalRequest};await swReload({renderPage:false});if(!swAlive(guard))return;const samePlace=place.location===swLocation()&&place.view===sw.view&&place.detailRequest===sw.detailRequest&&place.modalRequest===state.modalRequest&&!overlay.children.length;if(sameForm&&samePlace){sw.productionId=result.production.id;swAcceptProduction(result.production);swShow('board');render();}notify(id?'작업 정보를 저장했어요.':'새 작업을 상황판에 올렸어요.');}
  catch(error){if(swAlive(guard)){if(errorBox.isConnected)errorBox.textContent=error.message;else notify(error.message);}}
  finally{if(submit.isConnected)submit.disabled=false;}
});
// 접는 번호 구역의 열림을 기억한다(toggle은 거품이 없어 잡기 단계에서 듣는다).
document.addEventListener('toggle',event=>{const node=event.target;if(node?.matches?.('[data-sw-fold]'))sw.folds[node.dataset.swFold]=node.open;},true);
