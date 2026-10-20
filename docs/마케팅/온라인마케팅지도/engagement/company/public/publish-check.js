'use strict';
// 게시 전 점검 — 시그널 13판 A 「목록 + 상세」(10판 고객 관리 문법). 그리기 도우미(mt*)는 maker-tools.js 앞 절반에 있다.
// 왼쪽 옅은 판: 01 점검 기다림(게시 묶음에서 넘어온 편 — /api/publication-workflow의 publication_review 줄, 누르면 게시 준비·성과의 묶음 점검으로) · 02 저장한 기록 · 03 보관(「보관 포함」일 때).
// 오른쪽 점검지: 머리(형식 · 제목 · 파일 사실 칸 · 규격 비교 · 파일 놓기) → 「지금 할 일」 → 01~04 번호 구역 → 점검 기록 저장(화면의 검은 알약 하나).
const pc={userId:null,request:0,waitRequest:0,fileRequest:0,fileCancel:null,attempted:false,loading:false,saving:false,error:'',data:null,waiting:null,draft:null,preview:'',reading:false,archived:false,dirty:false,query:'',picking:false,folds:{}};
function pcCancelFile(){pc.fileRequest++;const cancel=pc.fileCancel;pc.fileCancel=null;pc.reading=false;if(cancel)cancel();}
function publishCheckReset(){pcCancelFile();if(pc.preview)URL.revokeObjectURL(pc.preview);Object.assign(pc,{userId:null,request:pc.request+1,waitRequest:pc.waitRequest+1,attempted:false,loading:false,saving:false,error:'',data:null,waiting:null,draft:null,preview:'',reading:false,archived:false,dirty:false,query:'',picking:false,folds:{}});}
function pcNewDraft(){return {title:'',preset:'vertical',media:null,audience:'',rights:'',measurement:'',checks:Object.fromEntries((pc.data?.review||[]).map(row=>[row.id,{checked:false,note:''}]))};}
function pcIdentity(){if(pc.userId!==state.user?.id){publishCheckReset();pc.userId=state.user?.id||null;}}
function publishCheckEnsure(){if(!state.user)return;pcIdentity();if(!pc.attempted&&!pc.loading){void pcLoad();void pcLoadWaiting();}}
async function pcLoad({discard=false}={}){const userId=state.user?.id,request=++pc.request;if(!userId)return;const previousId=pc.draft?.id,draftSnapshot=JSON.stringify(pc.draft);pc.userId=userId;pc.loading=true;pc.attempted=true;pc.error='';
  try{const data=await api('/api/creator-reviews');if(state.user?.id!==userId||request!==pc.request)return;pc.data=data;if(discard&&JSON.stringify(pc.draft)===draftSnapshot)pcSetDraft(data.records.find(row=>row.id===previousId)||(previousId===undefined&&pc.draft&&data.canWrite?pcNewDraft():pcFirstDraft(data)));else if(!pc.draft)pc.draft=pcFirstDraft(data);}
  catch(error){if(state.user?.id===userId&&request===pc.request)pc.error=error.message;}
  finally{if(state.user?.id===userId&&request===pc.request){pc.loading=false;if(state.tab==='workroom')render();}}
}
// 첫 줄 자동 열기(10판): 가장 최근에 고친 진행 중 기록, 없으면 새 점검(쓸 수 있는 계정만).
function pcFirstDraft(data){const first=data.records.find(row=>!row.archived);return first?structuredClone(first):data.canWrite?pcNewDraft():null;}
// 점검 기다림: 게시 준비·성과에서 만든 묶음 가운데 점검이 남은 편(서버 publication-workflow가 고른 줄). 못 읽으면 그 칸을 뺀다.
async function pcLoadWaiting(){const userId=state.user?.id,request=++pc.waitRequest;if(!userId)return;
  try{const data=await api('/api/publication-workflow');if(state.user?.id!==userId||request!==pc.waitRequest)return;pc.waiting=(Array.isArray(data?.items)?data.items:[]).filter(row=>row?.kind==='publication_review');}
  catch{if(state.user?.id===userId&&request===pc.waitRequest)pc.waiting=null;}
  finally{if(state.user?.id===userId&&request===pc.waitRequest&&state.tab==='workroom')(typeof renderBackground==='function'?renderBackground:render)();}
}
// 왼쪽 메뉴 숫자: 점검을 기다리는 묶음 수(내 차례라 코랄을 쓰지 않는다).
function publishCheckNavCount(){if(!pc.data||!Array.isArray(pc.waiting)||pc.userId!==state.user?.id)return null;return {value:pc.waiting.length,tone:'',label:'점검 기다림'};}
const pcButton=(label,action,attrs='',classes='')=>`<button type="button" class="btn ${classes}" data-publish-action="${action}" ${attrs}>${escape(label)}</button>`;
function pcWhen(value,time=true){const date=new Date(value);if(!value||Number.isNaN(date.getTime()))return '';return new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',...(time?{hour:'2-digit',minute:'2-digit',hourCycle:'h23'}:{})}).format(date);}
function pcDone(draft){return Object.values(draft?.checks||{}).filter(row=>row.checked).length;}
function pcLeft(total,done){return !total?'점검할 칸이 아직 없어요':done>=total?`${total}칸을 모두 봤어요`:`${total}칸 중 ${total-done}칸 남았어요`;}
function pcTone(check){return check?.checked?(String(check.note||'').trim()?'ok':'wait'):'';}
function pcSearch(row){return [row.title,row.media?.name].filter(Boolean).join(' ').toLowerCase();}
function pcGlyphs(formats){return mtGlyphs([...new Set((Array.isArray(formats)?formats:[]).map(id=>mtPlatformGlyph(String(id).split('-')[0])))]);}
function pcHead(){
  const data=pc.data,records=data?.records||[],write=!!data?.canWrite,sheet=!!(pc.draft&&write&&!pc.draft.archived);
  const actions=`${write?`<button type="button" class="btn${sheet?'':' primary'}" data-publish-action="new" ${pc.saving?'disabled':''}>${mtIcon('plus')}새 점검</button>`:''}<button type="button" class="btn icon" data-publish-action="refresh" aria-label="다시 읽기" title="다시 읽기" ${pc.loading||pc.saving?'disabled':''}>${mtIcon('refresh')}</button><button type="button" class="mt-link" data-maker-tool="publication">게시 묶음 점검 열기</button>`;
  const meter=data?mtMeter([Array.isArray(pc.waiting)?{label:'점검 기다림',value:pc.waiting.length,unit:'편',tone:pc.waiting.length?'wait':''}:null,{label:'저장한 기록',value:records.filter(row=>!row.archived).length,unit:'개'},{label:'보관',value:records.filter(row=>row.archived).length,unit:'개'}]):'';
  return mtHead({tool:'publish',title:'게시 전 점검',desc:'올리기 전에 파일 규격을 맞춰 보고, 직접 본 것과 근거를 남겨요.',actions,meter});
}
function publishCheckPanel(){
  pcIdentity();const head=pcHead();
  if(!pc.data)return head+(pc.error?mtError(pc.error,pcButton('다시 읽기','refresh',pc.loading?'disabled':'','small')):'<p class="mt-loading" role="status">점검 기록을 불러오고 있어요.</p>');
  return `${head}<div class="mt-desk${pc.picking?' is-picking':''}">${pcBand()}${pcList()}${pcDetail()}</div>`;
}
function pcList(){
  const data=pc.data,records=data.records,waiting=pc.waiting||[],total=data.review.length,draft=pc.draft,q=pc.query.trim().toLowerCase();
  const active=records.filter(row=>!row.archived),archived=records.filter(row=>row.archived),hit=text=>!q||text.includes(q);
  let order=0;const head=(key,title,count,rows)=>`<h3 class="mt-list-group" data-publish-group="${key}" ${rows.some(Boolean)?'':'hidden'}><span class="mt-num">${String(++order).padStart(2,'0')}</span>${escape(title)} <b>${mtNum(count)}</b></h3>`;
  const waitItem=row=>{const text=String(row.title||'').toLowerCase(),tone=row.status==='needs-work'?'alert':'wait';return `<button type="button" class="mt-item" data-publish-action="package" data-href="${escape(row.href||'')}" data-publish-row="01" data-search="${escape(text)}" ${hit(text)?'':'hidden'}>${mtLed(tone)}<span><strong>${escape(row.title||'제목 없는 묶음')}</strong><small><em data-tone="${tone}">${escape(row.statusLabel||'게시 전 점검')}</em>${pcGlyphs(row.channelFormats)}</small></span><span class="mt-item-end pc-out">열기</span></button>`;};
  const recordItem=(row,key)=>{const text=pcSearch(row);return `<button type="button" class="mt-item" data-publish-action="open" data-id="${escape(row.id)}" data-publish-row="${key}" data-search="${escape(text)}" aria-current="${draft?.id===row.id}" ${hit(text)?'':'hidden'}><span class="mt-tile" aria-hidden="true">${mtIcon(row.media?.kind==='image'?'image':'file')}</span><span><strong>${escape(row.title||'제목 없는 점검')}</strong><small><em data-tone="${total&&row.checkCount>=total?'ok':'wait'}">${mtNum(row.checkCount)}/${mtNum(total)}</em><span class="mt-item-text">${escape(row.media?.name||'파일 없음')}</span></small></span><span class="mt-item-end">${escape(pcWhen(row.updatedAt,false))}</span></button>`;};
  const fresh=draft&&!draft.id?`<button type="button" class="mt-item" data-publish-action="draft" aria-current="true"><span class="mt-tile" aria-hidden="true">${mtIcon('plus')}</span><span><strong>${escape(draft.title||'새 점검')}</strong><small>저장 전</small></span><span class="mt-item-end"></span></button>`:'';
  const tools=records.length||waiting.length?`<div class="mt-list-tools"><label class="mt-search">${mtIcon('search')}<input type="search" data-publish-search value="${escape(pc.query)}" placeholder="제목·파일 이름 찾기" aria-label="점검 기록 찾기" autocomplete="off"></label>${archived.length||pc.archived?`<div class="mt-seg" role="group" aria-label="보관한 기록 보기">${[['active','진행',active.length,!pc.archived],['all','보관 포함',records.length,pc.archived]].map(([id,label,count,on])=>`<button type="button" data-publish-action="filter" data-filter="${id}" aria-pressed="${on}">${label} <b>${mtNum(count)}</b></button>`).join('')}</div>`:''}</div>`:'';
  const waitHit=waiting.map(row=>hit(String(row.title||'').toLowerCase())),activeHit=active.map(row=>hit(pcSearch(row))),archivedHit=archived.map(row=>hit(pcSearch(row)));
  const groups=`${waiting.length?head('01','점검 기다림',waiting.length,waitHit)+waiting.map(waitItem).join(''):''}${active.length||fresh?head('02','저장한 기록',active.length,[...activeHit,!!fresh])+fresh+active.map(row=>recordItem(row,'02')).join(''):''}${pc.archived&&archived.length?head('03','보관',archived.length,archivedHit)+archived.map(row=>recordItem(row,'03')).join(''):''}`;
  const found=[...waitHit,...activeHit,...(pc.archived?archivedHit:[]),!!fresh].some(Boolean);
  return `<aside class="mt-list" aria-label="점검 목록">${tools}${groups}<p class="mt-list-empty" data-publish-none ${q&&!found?'':'hidden'}>찾는 기록이 없어요.</p>${!records.length&&!waiting.length&&!fresh?'<p class="mt-list-empty">아직 저장한 기록이 없어요.</p>':''}</aside>`;
}
// 휴대폰 띠: 목록보다 앞에 두어 「바꾸기」로 펼친 목록 위에 「닫기」가 남는다(넓은 화면에서는 숨는다).
function pcBand(){
  const data=pc.data,draft=pc.draft,active=data.records.filter(row=>!row.archived).length,waiting=pc.waiting?.length||0;
  return `<div class="mt-list-mobile"><span>${waiting?`점검 기다림 <b>${mtNum(waiting)}</b> · `:''}기록 <b>${mtNum(active)}</b> · ${escape(draft?draft.title||'새 점검':'고른 기록 없음')}</span><button type="button" class="btn small" data-publish-action="pick" aria-expanded="${pc.picking}">${pc.picking?'닫기':'바꾸기'}</button></div>`;
}
function pcDetail(){
  const data=pc.data,draft=pc.draft;
  if(!draft)return `<div class="mt-detail"><div class="mt-detail-empty"><img src="${mtFelt('publish')}" alt="" width="120" height="110" decoding="async"><strong>${data.canWrite?'목록에서 기록을 고르거나 새 점검을 만들어요':'읽기만 할 수 있는 계정이라 새 점검을 만들 수 없어요'}</strong></div></div>`;
  const write=data.canWrite&&!draft.archived,total=data.review.length,done=pcDone(draft),media=draft.media,lock=!write||pc.saving?'disabled':'',key=escape(draft.id||'new');
  let rows=[];try{rows=publishRules.analyze(media,draft.preset);}catch{rows=[];}
  const preset=publishRules.presets.find(row=>row.id===draft.preset)||publishRules.presets[0];
  const thumb=media&&pc.preview?`<span class="mt-thumb is-md">${media.kind==='image'?`<img src="${escape(pc.preview)}" alt="고른 이미지">`:`<video src="${escape(pc.preview)}" muted playsinline preload="metadata" aria-label="고른 영상"></video>`}</span>`:'';
  const chips=`<label class="pc-preset"><span class="sr-only">점검 형식</span><select name="preset" data-publish-field="preset">${publishRules.presets.map(row=>`<option value="${row.id}" ${row.id===draft.preset?'selected':''}>${escape(row.label)}</option>`).join('')}</select></label>${draft.archived?mtBadge('보관','off'):draft.id?mtBadge('저장함','ok'):mtBadge('저장 전','wait')}${draft.id?`<span>${escape(pcWhen(draft.updatedAt))}</span>`:''}`;
  const facts=`<dl class="mt-facts pc-facts" data-cols="4"><div><dt>파일 이름</dt><dd class="pc-name">${escape(media?.name||'—')}</dd></div><div><dt>크기</dt><dd>${media?escape((media.bytes/1000000).toFixed(2)+' MB'):'—'}</dd></div><div><dt>해상도</dt><dd>${media?escape(`${media.width} × ${media.height}`):'—'}</dd></div><div><dt>재생 시간</dt><dd>${media?.kind==='video'&&Number.isFinite(media.duration)?escape(media.duration.toFixed(2)+'초'):'—'}</dd></div></dl>`;
  const words={match:'맞아요',review:'확인 필요',unknown:'직접 확인'},tones={match:'ok',review:'wait',unknown:''};
  const specs=media&&rows.length?`<ul class="pc-specs" aria-label="파일 규격 비교">${rows.map(row=>`<li>${mtLed(tones[row.status]||'')}<strong>${escape(row.label)}</strong><em data-status="${escape(row.status)}">${words[row.status]||''}</em><span>${escape(row.detail)}</span></li>`).join('')}</ul>`:'';
  const rule=`<p class="mt-note pc-rule">${escape(preset.detail)}${preset.url?` · <a class="mt-link is-out" href="${escape(preset.url)}" target="_blank" rel="noopener noreferrer">공식 기준</a> ${escape(preset.checkedAt||'')} 확인`:''} · 규격 비교는 게시 승인을 대신하지 않아요.</p>`;
  const drop=`<div class="pc-file">${mtDrop({attrs:'accept="image/png,image/jpeg,image/webp,video/*,.mov,.avi,.mpeg,.3gp" data-publish-file aria-label="규격을 볼 이미지나 영상 고르기"',title:pc.reading?'파일 정보를 읽고 있어요…':media?'다른 파일 고르기':'이미지·영상 고르기',hint:'이 브라우저에서만 읽어요. 이름·크기·해상도·재생 시간만 저장해요.',small:true,disabled:pc.reading||!write,set:!!media})}${media&&write?pcButton('파일 지우기','clear-file','','small'):''}</div>`;
  // 머리(형식 · 제목) 바로 아래에 「지금 할 일」을 두고, 파일 사실 칸 · 규격 비교 · 파일 놓기는 한 덩어리로 그 아래에 둔다(1440 첫 화면에 주 단추가 들게).
  const top=`<fieldset class="pc-fields" ${lock}><div class="mt-detail-head${thumb?'':' is-plain'}">${thumb}<div><div class="mt-chips">${chips}</div><label class="pc-title"><span class="sr-only">작업 제목</span><input name="title" data-publish-field="title" maxlength="160" required value="${escape(draft.title)}" placeholder="작업 제목 · 예: AI 실무 팁 첫 편" autocomplete="off"></label></div></div></fieldset>`;
  const file=`<fieldset class="pc-fields pc-filebox" ${lock}>${facts}${specs}${rule}${drop}</fieldset>`;
  const sec=(name,num,title,sum,body,open)=>mtSec({num,title,sum,open:pc.folds[name]??open,body,attrs:`id="pc-sec-${name}-${key}" data-publish-fold="${name}"`});
  const area=(field,label,max,placeholder)=>`<label class="mt-field"><span class="sr-only">${escape(label)}</span><textarea data-publish-field="${field}" maxlength="${max}" rows="3" placeholder="${escape(placeholder)}">${escape(draft[field])}</textarea></label>`;
  const checks=data.review.map(item=>{const check=draft.checks[item.id]||{checked:false,note:''},id=escape(item.id);return `<div class="pc-check"><span class="mt-led" data-publish-led="${id}" data-tone="${pcTone(check)}" aria-hidden="true"></span><label class="mt-check"><input type="checkbox" data-publish-check="${id}" ${check.checked?'checked':''}><span>${escape(item.label)}</span></label><details class="pc-note" id="pc-note-${id}-${key}" data-publish-fold="note:${id}" ${(pc.folds['note:'+item.id]??Boolean(check.note))?'open':''}><summary>근거</summary><textarea data-publish-note="${id}" maxlength="1200" rows="2" aria-label="${escape(item.label)} 근거" placeholder="본 장면 · 실제 자료 · 고칠 것">${escape(check.note||'')}</textarea></details></div>`;}).join('');
  const body=`<fieldset class="pc-fields" ${lock}>${sec('audience','01','누가 보고 무엇을 얻나요',pcShort(draft.audience),area('audience','누가 보고 무엇을 얻나요',600,'보는 사람의 상황과, 보고 나서 할 수 있는 일'),!draft.audience)}${sec('rights','02','소재·음악 사용권',pcShort(draft.rights),area('rights','소재·음악 사용권과 출처',1800,'만든 사람 · 원본 주소 · 라이선스 · 쓸 수 있는 범위'),!draft.rights)}${sec('measurement','03','확인할 반응과 조건',pcShort(draft.measurement),area('measurement','확인할 반응과 조건',1000,'예: 올린 뒤 7일의 저장·공유 비율, 견줄 편과 조건'),!draft.measurement)}${sec('checks','04',`직접 본 ${total}칸`,`${done}/${total} · 자동 점수가 아니에요`,`<div class="pc-rows">${checks}</div>`,true)}</fieldset>`;
  const foot=`<div class="mt-form-foot"><span class="mt-note" data-publish-dirty>${pc.dirty?'저장하지 않은 변경이 있어요.':'기록은 내 계정에서만 볼 수 있어요.'}</span>${draft.id?pcButton('기록 받기','export','','small'):''}${draft.id&&data.canWrite?pcButton(draft.archived?'복원':'보관','archive',pc.saving?'disabled':'','small'):''}${write?`<button class="btn primary" type="submit" ${pc.saving||pc.reading?'disabled':''}>${pc.saving?'저장 중…':'점검 기록 저장'}</button>`:''}</div>`;
  return `<form class="mt-detail pc-sheet" data-publish-form>${pc.error?mtError(pc.error):''}${top}${pcNow(draft,write,total,done)}${file}${body}${foot}</form>`;
}
// 「지금 할 일」: 남은 칸이 있으면 포스터(화면의 주 단추 「남은 칸 보기」), 다 봤거나 보관·읽기만이면 옅은 판.
function pcNow(draft,write,total,done){const tool='publish',attrs='data-publish-now';
  if(draft.archived)return mtNow({tool,label:'보관',title:'보관한 기록이에요',body:escape('고치려면 아래에서 먼저 복원해요.'),tone:'quiet',attrs});
  if(!write)return mtNow({tool,label:'읽기만',title:'읽기만 할 수 있는 기록이에요',body:escape('표시와 근거는 볼 수만 있어요.'),tone:'quiet',attrs});
  if(total&&done<total)return mtNow({tool,label:'내 차례',title:pcLeft(total,done),body:escape('직접 보고 확인한 칸에 표시하고, 칸마다 근거를 한 줄 남겨요.'),actions:mtPill('남은 칸 보기','data-publish-action="checks"'),word:'점검',attrs});
  return mtNow({tool,label:'할 일 없음',title:pcLeft(total,done),body:escape(pc.dirty?'저장하면 이 기록에 남아요.':'올리기 전에 기록을 받아 두면 다시 볼 수 있어요.'),tone:'quiet',attrs});
}
function pcShort(value){return value?String(value).replace(/\s+/g,' ').trim().slice(0,40):'비어 있어요';}
function pcSetDraft(draft){pcCancelFile();if(pc.preview)URL.revokeObjectURL(pc.preview);pc.preview='';pc.draft=structuredClone(draft);pc.dirty=false;pc.error='';pc.picking=false;pc.folds={};render();}
// 칸을 바꿀 때는 점검지를 다시 그리지 않고(쓰던 자리·초점·한글 조합 유지) 「지금 할 일」 판과 바뀐 요약·점만 바꾼다.
function pcChanged(id,field){pc.dirty=true;const total=pc.data?.review?.length||0,done=pcDone(pc.draft),write=!!pc.data?.canWrite&&!pc.draft.archived;
  const note=document.querySelector('[data-publish-dirty]');if(note)note.textContent='저장하지 않은 변경이 있어요.';
  const now=document.querySelector('[data-publish-now]');if(now&&'outerHTML' in now)now.outerHTML=pcNow(pc.draft,write,total,done);
  if(['audience','rights','measurement'].includes(field)){const part=document.querySelector(`[data-publish-fold="${field}"] .mt-sum`);if(part)part.textContent=pcShort(pc.draft[field]);}
  const sum=document.querySelector('[data-publish-fold="checks"] .mt-sum');if(sum)sum.textContent=`${done}/${total} · 자동 점수가 아니에요`;
  if(id&&/^[\w-]+$/.test(id)){const led=document.querySelector(`[data-publish-led="${id}"]`);led?.setAttribute?.('data-tone',pcTone(pc.draft.checks[id]));}
}
function pcCanLeave(){return !pc.dirty||window.confirm('저장하지 않은 변경을 버리고 다른 점검을 열까요?');}
// 찾기: 다시 그리지 않고 줄만 숨긴다(입력 칸 초점 유지). 다시 그릴 때는 pcList가 같은 규칙으로 숨긴다.
function pcFilterList(){if(typeof document.querySelectorAll!=='function')return;const q=pc.query.trim().toLowerCase(),seen=new Set();
  for(const row of document.querySelectorAll('[data-publish-row]')){const show=!q||String(row.dataset.search||'').includes(q);row.hidden=!show;if(show)seen.add(row.dataset.publishRow);}
  for(const head of document.querySelectorAll('[data-publish-group]'))head.hidden=!seen.has(head.dataset.publishGroup)&&!(head.dataset.publishGroup==='02'&&pc.draft&&!pc.draft.id);
  const none=document.querySelector('[data-publish-none]');if(none)none.hidden=!q||seen.size>0||Boolean(pc.draft&&!pc.draft.id);
}
function pcShowChecks(){pc.folds.checks=true;render();const go=()=>{const box=document.querySelector?.('[data-publish-check]:not(:checked)')||document.querySelector?.('[data-publish-check]');if(typeof box?.scrollIntoView!=='function')return;box.scrollIntoView({block:'center',behavior:'smooth'});box.focus?.({preventScroll:true});};if(typeof requestAnimationFrame==='function')requestAnimationFrame(go);}
async function pcReadFile(file){if(!file)return;pcIdentity();if(!state.user||!pc.data?.canWrite||pc.saving||pc.draft?.archived)return;
  pcCancelFile();const userId=state.user.id,request=pc.fileRequest;if(pc.preview)URL.revokeObjectURL(pc.preview);pc.preview='';pc.reading=true;pc.error='';render();let url='';
  try{
    if(file.size<1||file.size>2147483648)throw new Error('2 GB 이하 파일만 읽을 수 있어요. 비어 있지 않은 더 작은 파일로 골라 주세요.');
    const kind=file.type.startsWith('image/')||/\.(png|jpe?g|webp)$/i.test(file.name)?'image':'video';
    url=URL.createObjectURL(file);const measured=await new Promise((resolve,reject)=>{
      const element=kind==='image'?new Image():document.createElement('video');let done=false,width,height,duration,timer;
      const finish=error=>{
        if(done)return;done=true;const metadata={width:kind==='image'?element.naturalWidth:width,height:kind==='image'?element.naturalHeight:height,duration:kind==='video'?duration:null};
        clearTimeout(timer);element.onload=element.onerror=element.onloadedmetadata=null;if(pc.fileCancel===cancel)pc.fileCancel=null;
        if(kind==='video')element.pause();element.removeAttribute('src');if(kind==='video')element.load();
        if(error){if(url){URL.revokeObjectURL(url);url='';}reject(error);}else resolve(metadata);
      };
      const cancel=()=>finish(new Error('파일 읽기를 멈췄어요.'));pc.fileCancel=cancel;
      timer=setTimeout(()=>finish(new Error('파일 정보를 읽는 데 너무 오래 걸려요. 이 브라우저에서 열리는 PNG · JPG · WebP · MP4 · WebM 파일로 다시 골라 주세요.')),12000);
      element.onerror=()=>finish(new Error('이 브라우저에서 읽을 수 없는 파일이에요. 다른 형식으로 내보내 다시 골라 주세요.'));
      if(kind==='image')element.onload=()=>finish();else{element.preload='metadata';element.onloadedmetadata=()=>{width=element.videoWidth;height=element.videoHeight;duration=element.duration;if(!width||!height||!Number.isFinite(duration)||duration<=0)finish(new Error('영상의 해상도나 재생 시간을 읽지 못했어요. MP4나 WebM으로 내보내 다시 골라 주세요.'));else finish();};}element.src=url;
    });
    if(userId!==state.user?.id||request!==pc.fileRequest){URL.revokeObjectURL(url);return;}
    if(!measured.width||!measured.height||measured.width>32768||measured.height>32768||measured.duration>86400)throw new Error('해상도가 너무 크거나 재생 시간이 하루를 넘어요. 다른 파일을 골라 주세요.');
    pc.draft.media={name:file.name,kind,mime:file.type,bytes:file.size,...measured};pc.preview=url;url='';pc.dirty=true;
  }catch(error){if(userId===state.user?.id&&request===pc.fileRequest)pc.error=error.message;}
  finally{if(url)URL.revokeObjectURL(url);if(userId===state.user?.id&&request===pc.fileRequest){pc.reading=false;if(state.tab==='workroom')render();}}
}
async function pcSave(form){if(pc.saving||pc.reading||!pc.data?.canWrite||pc.draft?.archived)return;const userId=state.user?.id,request=++pc.request,body=structuredClone(pc.draft);pc.saving=true;pc.error='';render();
  try{const result=await api('/api/creator-reviews'+(body.id?'/'+encodeURIComponent(body.id):''),body);if(userId!==state.user?.id||request!==pc.request)return;pc.draft=structuredClone(result.record);pc.data.records=[result.record,...pc.data.records.filter(row=>row.id!==result.record.id)];pc.dirty=false;notify('점검 기록을 저장했어요.');}
  catch(error){if(userId===state.user?.id&&request===pc.request)pc.error=error.message;}
  finally{if(userId===state.user?.id&&request===pc.request){pc.saving=false;if(state.tab==='workroom')render();}}
}
function pcMarkdown(row){const plain=value=>String(value||'').replace(/[\\`*_[\]<>#]/g,'\\$&');return `# ${plain(row.title)}\n\n직접 본 점검 기록이에요 · 게시 승인은 아니에요.\n\n형식: ${plain(publishRules.presets.find(p=>p.id===row.preset)?.label)}\n파일: ${plain(row.media?.name||'없음')}\n${row.media?`${row.media.width}×${row.media.height} · ${row.media.bytes} bytes${row.media.duration?' · '+row.media.duration+'초':''}\n`:''}\n누가 보고 무엇을 얻나요: ${plain(row.audience)}\n소재·음악 사용권: ${plain(row.rights)}\n확인할 반응과 조건: ${plain(row.measurement)}\n\n## 직접 본 칸\n\n${pc.data.review.map(item=>`- [${row.checks[item.id]?.checked?'x':' '}] ${plain(item.label)}\n  ${plain(row.checks[item.id]?.note)}`).join('\n')}\n\n저장한 때: ${row.updatedAt}\n`;}
document.addEventListener('input',event=>{const target=event.target;if(target.matches?.('[data-publish-search]')){pc.query=target.value;pcFilterList();return;}if(!pc.draft||!pc.data?.canWrite||pc.draft.archived||pc.saving)return;if(target.matches('[data-publish-note]')){const id=target.dataset.publishNote;(pc.draft.checks[id]??={checked:false,note:''}).note=target.value;pcChanged(id);}else if(target.matches('[data-publish-field]')&&['title','audience','rights','measurement'].includes(target.dataset.publishField)){pc.draft[target.dataset.publishField]=target.value;pcChanged('',target.dataset.publishField);}});
document.addEventListener('change',event=>{const target=event.target;if(!pc.draft||!pc.data?.canWrite||pc.saving||pc.draft.archived)return;if(target.matches('[data-publish-file]'))void pcReadFile(target.files?.[0]);else if(target.matches('[data-publish-check]')){const id=target.dataset.publishCheck;(pc.draft.checks[id]??={checked:false,note:''}).checked=target.checked;pcChanged(id);}else if(target.matches('[data-publish-field="preset"]')){pc.draft.preset=target.value;pc.dirty=true;render();}});
document.addEventListener('submit',event=>{if(!event.target.matches('[data-publish-form]'))return;event.preventDefault();void pcSave(event.target);});
// 접는 번호 구역의 열림을 기억한다(toggle은 거품이 없어 잡기 단계에서 듣는다).
document.addEventListener('toggle',event=>{const node=event.target;if(node?.matches?.('[data-publish-fold]'))pc.folds[node.dataset.publishFold]=node.open;},true);
document.addEventListener('click',async event=>{const target=event.target.closest('[data-publish-action]');if(!target||target.disabled||!state.user||pc.saving)return;const action=target.dataset.publishAction;
  if(action==='refresh'){if(!pc.loading&&pcCanLeave()){pc.attempted=false;const loading=pcLoad({discard:true});void pcLoadWaiting();await loading;}return;}
  if(action==='new'&&pc.data?.canWrite&&pcCanLeave()){pc.archived=false;pcSetDraft(pcNewDraft());return;}
  if(action==='open'){if(pc.draft?.id&&pc.draft.id===target.dataset.id){pc.picking=false;render();return;}if(!pcCanLeave())return;const row=pc.data.records.find(row=>row.id===target.dataset.id);if(row)pcSetDraft(row);return;}
  if(action==='draft'||action==='pick'){pc.picking=action==='pick'&&!pc.picking;render();return;}
  if(action==='filter'){pc.archived=target.dataset.filter==='all';render();return;}
  if(action==='checks'){pcShowChecks();return;}
  if(action==='package'){pc.picking=false;const href=target.dataset.href||'';try{if(typeof openPublicationWorkflowLink==='function'){await openPublicationWorkflowLink(href);return;}}catch(error){notify(error.message);return;}if(typeof makerTools!=='undefined'){makerTools.view='publication';render();if(typeof makerToolsEnsure==='function')makerToolsEnsure();}return;}
  if(action==='clear-file'&&pc.data?.canWrite&&!pc.draft?.archived){pcCancelFile();if(pc.preview)URL.revokeObjectURL(pc.preview);pc.preview='';pc.draft.media=null;pc.dirty=true;render();return;}
  if(action==='export'&&pc.draft?.id){const row=pc.data.records.find(row=>row.id===pc.draft.id);if(!row)return;const url=URL.createObjectURL(new Blob([pcMarkdown(row)],{type:'text/markdown;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='synk-publish-check.md';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);return;}
  if(action==='archive'&&pc.draft?.id&&pc.data?.canWrite){if(!pcCanLeave())return;const userId=state.user.id,request=++pc.request,row=pc.draft;pc.saving=true;pc.error='';render();try{const result=await api('/api/creator-reviews/'+encodeURIComponent(row.id)+'/archive',{archived:!row.archived,revision:row.revision});if(userId!==state.user?.id||request!==pc.request)return;pc.data.records=pc.data.records.map(old=>old.id===row.id?result.record:old);pc.draft=structuredClone(result.record);pc.dirty=false;pc.archived=result.record.archived;notify(result.record.archived?'기록을 보관했어요.':'기록을 복원했어요.');}catch(error){if(userId===state.user?.id&&request===pc.request)pc.error=error.message;}finally{if(userId===state.user?.id&&request===pc.request){pc.saving=false;render();}}}
});
