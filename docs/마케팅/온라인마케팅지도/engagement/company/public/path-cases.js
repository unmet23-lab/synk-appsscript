'use strict';
// PATH 상담함 — 문의 접수와 같은 「목록 + 상세」(제작 도구 A). 서버 계약은 /api/path-cases(path-cases.mjs)이고, 권한은 서버가 PATH 소속 역할로 본다.
// 목록: 급함이 맨 위, 그다음 기한이 가까운 순(서버 순서 그대로). 상세: 넘김 요약 → 할 일 → 학생이 고친 줄 → 대화와 답 → 전체 AI 대화(보냈을 때만, 접어서) → 끝내기 · 지우기.
// 학생 글은 한국어 번역(있을 때)과 원문을 함께 보인다. 할 일 글은 이 화면에만 있고 오늘 할 일에는 링크만 간다.
const pathCaseState={identity:'',request:0,loading:false,busy:'',attempted:false,data:null,error:'',selected:null,detail:null,forbidden:false,scope:'open',kind:'',reply:'',replyStudent:'',notes:{},newTask:'',erasure:null,folds:{},lastTarget:'',picking:false};
const pathCaseKinds={urgent:'급함',act:'실제로 할 일',synk:'SYNK 일',stuck:'AI가 못 답함'};
const pathCaseStatus={new:'새 상담',reviewing:'보는 중',answered:'답 보냄',closed:'끝남'};
const pathCaseTones={new:'wait',reviewing:'info',answered:'ok',closed:'off'};
const pathCaseLangs={ko:'한국어',mn:'몽골어',en:'영어'};
const pathCaseFields={situation:'상황',wants:'바라는 것',open:'풀리지 않은 것',task:'할 일'};
const PATH_CASE_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function pathCaseIdentity(){return state.user?[state.user.id,state.user.role||''].join(':'):'';}
// 메뉴에 보이는 사람: 관리자(회사 주인일 수 있다)와 PATH 상담 담당 · 책임자. 회사 주인이 아닌 관리자는 서버가 막으면 그때부터 숨긴다.
function pathCasesVisible(){
  const user=state.user;if(!user||user.role==='viewer'||pathCaseState.forbidden&&pathCaseState.identity===pathCaseIdentity())return false;
  if(user.role==='admin')return true;
  return (user.workspaceAccess?.memberships||[]).some(row=>row.company==='PATH'&&['counselor','manager'].includes(row.role));
}
function pathCasesReset(){Object.assign(pathCaseState,{identity:'',request:pathCaseState.request+1,loading:false,busy:'',attempted:false,data:null,error:'',selected:null,detail:null,forbidden:false,scope:'open',kind:'',reply:'',replyStudent:'',notes:{},newTask:'',erasure:null,folds:{},lastTarget:'',picking:false});}
function pathCaseActive(){return !!state.user&&state.tab==='workroom'&&typeof wr!=='undefined'&&wr.view==='tools'&&typeof makerTools!=='undefined'&&makerTools.view==='path-cases';}
function pathCaseRender(){if(pathCaseActive())render();}
function pathCasesEnsure(){
  const s=pathCaseState;
  if(s.identity!==pathCaseIdentity()){pathCasesReset();s.identity=pathCaseIdentity();}
  if(!pathCasesVisible()||!pathCaseActive())return;
  if(!s.attempted&&!s.loading){void pathCaseLoad();return;}
  if(s.data&&pathCaseTarget())void pathCaseOpen(s.selected);
}
// 깊은 링크(?caseId=…): 오늘 할 일 · 알림에서 온 건을 연다.
function pathCaseTarget(){
  const s=pathCaseState,target=typeof location!=='undefined'?new URLSearchParams(location.search).get('caseId'):'';
  if(!target||!PATH_CASE_UUID.test(target)||target===s.lastTarget||!s.data)return false;
  s.lastTarget=target;const row=s.data.items.find(item=>item.id===target);if(!row)return false;
  if(row.status==='closed')s.scope='all';s.kind='';s.selected=target;return true;
}
async function pathCaseLoad(){
  const s=pathCaseState,identity=pathCaseIdentity(),request=++s.request;
  if(!identity||!pathCaseActive())return;s.loading=true;s.attempted=true;s.error='';pathCaseRender();
  try{
    const data=await api('/api/path-cases');
    if(identity!==pathCaseIdentity()||request!==s.request)return;
    if(!Array.isArray(data?.items))throw new Error('받은 상담 목록의 꼴이 맞지 않아요. 새로 읽어 주세요.');
    s.data=data;
    pathCaseTarget();
    // 저절로 첫 줄을 열지 않는다. 상세를 열면 「보는 중」으로 바뀌고 연 기록이 남기 때문이다(담당자가 고른 건만 연다).
    if(s.selected&&!data.items.some(row=>row.id===s.selected)){s.selected=null;s.detail=null;}
    if(s.selected)await pathCaseOpen(s.selected,{quiet:true});
  }catch(error){if(identity===pathCaseIdentity()&&request===s.request){s.error=error.message;if(error.status===403){s.forbidden=true;s.data=null;s.detail=null;}if(error.status===401){s.data=null;s.detail=null;}}}
  finally{if(identity===pathCaseIdentity()&&request===s.request){s.loading=false;if(!pathCaseActive())s.attempted=false;pathCaseRender();}}
}
async function pathCaseOpen(id,{quiet=false}={}){
  const s=pathCaseState,identity=pathCaseIdentity();if(!id||!PATH_CASE_UUID.test(id))return;
  if(!quiet){s.loading=true;pathCaseRender();}
  try{
    // 여는 것은 「보는 중」 · 알림 읽기를 남기므로 POST(CSRF)로 한다.
    const data=await api('/api/path-cases/'+encodeURIComponent(id)+'/open',{});
    if(identity!==pathCaseIdentity())return;
    if(s.selected!==id&&!quiet)return;
    s.selected=id;s.detail=data.case;pathCaseAccept(data.case);
  }catch(error){if(identity===pathCaseIdentity())s.error=error.message;}
  finally{if(identity===pathCaseIdentity()&&!quiet){s.loading=false;pathCaseRender();}}
}
// 고친 상세를 목록 줄에도 바로 옮긴다.
function pathCaseAccept(item){const s=pathCaseState;if(!item?.id||!s.data)return;const keys=['status','urgent','assigneeId','assigneeName','openTasks','tasks','revision','updatedAt','closedAt','waiting','deadline','wants'];s.data.items=s.data.items.map(row=>row.id===item.id?{...row,...Object.fromEntries(keys.map(key=>[key,key==='tasks'&&Array.isArray(item.tasks)?item.tasks.length:item[key]]))}:row);}
function pathCaseRows(){const s=pathCaseState,items=s.data?.items||[];return items.filter(row=>(s.scope==='all'||row.status!=='closed')&&(!s.kind||row.kind===s.kind));}
function pathCasesNavCount(){const s=pathCaseState;if(!s.data||s.identity!==pathCaseIdentity())return null;const urgent=s.data.items.filter(row=>row.urgent&&row.status!=='closed').length;const fresh=s.data.items.filter(row=>row.status==='new').length;return urgent?{value:urgent,tone:'alert',label:'급함 상담'}:{value:fresh,tone:'',label:'새 상담'};}
function pathCaseDay(value){if(!value)return '';const date=/^\d{4}-\d{2}-\d{2}$/.test(value)?new Date(value+'T00:00:00+09:00'):new Date(value);if(!Number.isFinite(date.getTime()))return '';return new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric'}).format(date);}
function pathCaseWhen(value){const date=new Date(value);if(!value||!Number.isFinite(date.getTime()))return '';return new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date);}
function pathCaseWants(row){return row.wants||(row.kind==='urgent'?'위험한 상황이라 바로 연결해 달래요':row.mode==='teen'?'14~17세 학생이 보호자 동의를 받고 보낸 상담이에요':'바라는 것을 상세에서 확인해요');}
function pathCaseButton(action,label,disabled=false,classes='small',extra=''){return `<button class="btn${classes?' '+classes:''}" type="button" data-pc-action="${escape(action)}" ${extra} ${disabled?'disabled':''}>${escape(label)}</button>`;}
function pathCaseHead(){
  const s=pathCaseState,items=s.data?.items||[],open=items.filter(row=>row.status!=='closed');
  const meter=s.data?mtMeter([{label:'급함',value:open.filter(row=>row.urgent).length,unit:'건',tone:open.some(row=>row.urgent)?'alert':''},{label:'새 상담',value:items.filter(row=>row.status==='new').length,unit:'건',tone:items.some(row=>row.status==='new')?'wait':''},{label:'보는 중',value:items.filter(row=>row.status==='reviewing').length,unit:'건'},{label:'답 보냄',value:items.filter(row=>row.status==='answered').length,unit:'건'}]):'';
  const actions=`<button type="button" class="btn icon" data-pc-action="reload" aria-label="새로 읽기" title="새로 읽기" ${s.loading||s.busy?'disabled':''}>${mtIcon('refresh')}</button>`;
  return mtHead({tool:'path-cases',title:'PATH 상담함',desc:'AI가 더 도울 수 없을 때 학생이 보낸 상담이에요. 넘김 요약과 할 일을 보고, 사람이 해야 하는 일만 해요.',actions,meter,layout:'desk'});
}
function pathCasePromise(){return '<p class="pc-promise" role="note">입학 · 비자 결과를 약속하지 않아요. 학생과의 연락은 이 상담함에서만 해요.</p>';}
// 휴대폰 폭에서는 목록 대신 고른 상담 한 줄과 「바꾸기」를 보인다(문의 접수와 같은 틀). 고른 상담이 없으면 목록을 펼쳐 둔다.
function pathCaseBand(){
  const s=pathCaseState,row=s.data.items.find(item=>item.id===s.selected);
  return `<div class="mt-list-mobile"><span>${row?`<b>${escape(row.urgent&&row.status!=='closed'?'급함':pathCaseStatus[row.status]||'')}</b> · ${escape(pathCaseWants(row))}`:'고른 상담 없음'}</span>${s.data.items.length&&row?`<button type="button" class="btn small" data-pc-action="pick" aria-expanded="${s.picking}">${s.picking?'닫기':'바꾸기'}</button>`:''}</div>`;
}
function pathCaseList(){
  const s=pathCaseState,rows=pathCaseRows(),items=s.data.items;
  const kinds=[['','모두'],...Object.entries(pathCaseKinds)].map(([id,label])=>`<button type="button" data-pc-action="kind" data-kind="${id}" aria-pressed="${s.kind===id}">${escape(label)} <b>${mtNum(items.filter(row=>(!id||row.kind===id)&&(s.scope==='all'||row.status!=='closed')).length)}</b></button>`).join('');
  const scope=[['open','처리 중'],['all','끝난 상담까지']].map(([id,label])=>`<button type="button" data-pc-action="scope" data-scope="${id}" aria-pressed="${s.scope===id}">${label}</button>`).join('');
  const item=row=>{const tone=row.status!=='closed'&&row.urgent?'alert':pathCaseTones[row.status]||'';const due=row.deadline?` · 기한 ${pathCaseDay(row.deadline)}`:'';const left=row.tasks?` · 남은 할 일 ${row.openTasks}`:'';
    return `<button type="button" class="mt-item pc-item" data-pc-open="${escape(row.id)}" aria-current="${s.selected===row.id}">${mtLed(tone,row.urgent&&row.status!=='closed'?'급함':pathCaseStatus[row.status]||'')}<span><strong>${escape(pathCaseWants(row))}</strong><small><span class="mt-item-text">${escape(pathCaseKinds[row.kind]||'상담')}${escape(left)}${escape(due)}${row.waiting&&row.status!=='closed'?' · 학생 글 기다림':''}</span></small></span><span class="mt-item-end">${escape(pathCaseStatus[row.status]||'')}</span></button>`;};
  const empty=!rows.length?`<p class="mt-list-empty">${items.length?'고른 범위에 상담이 없어요.':'받은 상담이 없어요.'}</p>`:'';
  return `<aside class="mt-list pc-list" aria-label="상담 목록"><div class="mt-list-tools"><div class="mt-seg pc-kinds" role="group" aria-label="갈래">${kinds}</div><div class="mt-seg" role="group" aria-label="목록 범위">${scope}</div></div>${rows.map(item).join('')}${empty}</aside>`;
}
function pathCaseBilingual(ko,original,lang){
  if(!original)return '';
  if(lang==='ko')return `<p class="pc-text">${escape(original)}</p>`;
  return `${ko?`<p class="pc-text"><span class="pc-label">한국어 번역</span>${escape(ko)}</p>`:'<p class="mt-note">아직 한국어 번역이 없어요. 원문을 봐요.</p>'}<p class="pc-text pc-original" lang="${escape(lang)}"><span class="pc-label">원문 · ${escape(pathCaseLangs[lang]||'학생 말')}</span>${escape(original)}</p>`;
}
function pathCaseSec(name,num,title,sum,body,open){return mtSec({num,title,sum,open:pathCaseState.folds[name]??open,body,attrs:`data-pc-fold="${name}"`});}
function pathCaseDetail(){
  const s=pathCaseState,c=s.detail;
  if(!c||c.id!==s.selected)return `<div class="mt-detail"><div class="mt-detail-empty"><div><strong>${s.data.items.length?'목록에서 상담을 골라요':'받은 상담이 없어요'}</strong><p>급함이 맨 위에 오고, 그다음은 기한이 가까운 순서예요.</p></div></div></div>`;
  const lock=s.busy||s.loading?'disabled':'',closed=c.status==='closed';
  const chips=`${c.urgent&&!closed?mtBadge('급함','alert'):''}${c.kind==='urgent'&&c.urgent&&!closed?'':mtBadge(pathCaseKinds[c.kind]||'상담',c.kind==='urgent'?'alert':'info')}${mtBadge(pathCaseStatus[c.status]||'',pathCaseTones[c.status])}${mtBadge('학생 말 · '+(pathCaseLangs[c.lang]||'모름'),'off')}${c.mode==='teen'?mtBadge('14~17세 · 보호자 동의','wait'):''}${c.hidden?mtBadge('학생이 계정 지우는 중 · 주인만 봄','off'):''}`;
  const assign=c.canAssign&&!closed?`<label class="mt-field pc-assign"><span>담당</span><select data-pc-assign ${lock}>${(s.data.assignees||[]).map(a=>`<option value="${escape(a.id)}" ${a.id===c.assigneeId?'selected':''}>${escape(a.name)}</option>`).join('')}</select></label>`:`<p class="mt-note">담당 · ${escape(c.assigneeName||'정하지 않음')}</p>`;
  const head=`<div class="mt-detail-head is-plain"><div><div class="mt-chips">${chips}</div><h2>${escape(pathCaseWants(c))}</h2>${assign}</div></div>`;
  const facts=`<dl class="mt-facts" data-cols="3"><div><dt>받은 때</dt><dd>${escape(pathCaseWhen(c.createdAt))}</dd></div><div><dt>가장 가까운 기한</dt><dd>${escape(c.deadline?pathCaseDay(c.deadline):'없음')}</dd></div><div><dt>고른 과정</dt><dd>${escape(c.program||'보내지 않음')}</dd></div></dl>`;
  const b=c.brief;
  const list=(rows,fn)=>rows?.length?`<ul class="pc-lines">${rows.map(row=>`<li>${fn(row)}</li>`).join('')}</ul>`:'<p class="mt-note">없어요.</p>';
  // 학생이 고친 줄은 요약의 그 자리에 고친 글로 보이고, AI가 쓴 글은 아래에 작게 남긴다(학생이 뺀 줄은 뺐다고 적는다).
  const editOf=(field,index)=>(c.edits||[]).find(e=>e.field===field&&e.index===index);
  const edited=(field,index,orig)=>{const e=editOf(field,index);if(!e)return escape(orig);if(!e.text)return `${mtBadge('학생이 뺌','wait')} <s>${escape(orig)}</s>`;return `${mtBadge('학생이 고침','wait')} ${escape(e.text_ko||e.text)}<small class="pc-orig">AI가 쓴 글 · ${escape(orig)}</small>`;};
  const added=field=>(c.edits||[]).filter(e=>e.field===field&&e.index===null&&e.text).map(e=>`${mtBadge('학생이 더함','wait')} ${escape(e.text_ko||e.text)}`);
  const openRows=b?[...(b.open||[]).map((row,i)=>edited('open',i,row)),...added('open')]:[];
  const brief=b?`<div class="pc-brief"><h4>상황</h4><p class="pc-text">${edited('situation',null,b.situation)}</p><h4>바라는 것</h4><p class="pc-text">${edited('wants',null,b.wants)}</p><h4>AI가 이미 한 것</h4>${list(b.ai_done,row=>escape(row.text))}<h4>풀리지 않은 것</h4>${list(openRows,row=>row)}</div>`
    :`<div class="pc-brief">${c.last?`<h4>학생이 마지막으로 쓴 글</h4>${pathCaseBilingual(c.lastKo,c.last,c.lang)}`:''}${c.note?`<h4>학생이 쓴 글</h4>${pathCaseBilingual(c.noteKo,c.note,c.lang)}`:''}${!c.last&&!c.note?'<p class="mt-note">학생이 글 없이 바로 연결했어요. 아래 대화로 먼저 안부를 물어요.</p>':''}</div>`;
  const tasks=c.tasks.map(t=>{const note=s.notes[t.id]??'';return `<li class="pc-task${t.done?' is-done':''}"><div class="pc-task-main"><strong>${escape(t.do)}</strong>${t.why?`<small>사람이 해야 하는 까닭 · ${escape(t.why)}</small>`:''}${t.by?`<small>기한 · ${escape(pathCaseDay(t.by))}</small>`:''}${t.source==='staff'?'<small>직원이 더한 할 일</small>':''}${t.done?`<small>했어요 · ${escape(pathCaseWhen(t.doneAt))} · ${escape(t.doneByName||'')}${t.note?' · '+escape(t.note):''}</small>`:''}</div><div class="pc-task-actions">${t.done?pathCaseButton('task-undone','되돌리기',!!lock||closed,'small','data-task="'+escape(t.id)+'"'):`<input type="text" maxlength="300" placeholder="남길 말 한 줄(고르면)" aria-label="남길 말" data-pc-note="${escape(t.id)}" value="${escape(note)}" ${lock||closed?'disabled':''}>${pathCaseButton('task-done','했어요',!!lock||closed,'small primary','data-task="'+escape(t.id)+'"')}`}${pathCaseButton('task-remove','빼기',!!lock||closed,'small','data-task="'+escape(t.id)+'"')}</div></li>`;}).join('');
  const add=closed?'':`<div class="pc-task-add"><input type="text" maxlength="200" placeholder="더할 할 일 한 줄" aria-label="더할 할 일" data-pc-newtask value="${escape(s.newTask)}" ${lock}>${pathCaseButton('task-add','더하기',!!lock)}</div>`;
  const allDone=c.tasks.length&&!c.openTasks&&!closed?`<p class="pc-done-note">할 일을 다 했어요. 학생에게 답한 뒤 이 상담을 끝낼까요? ${pathCaseButton('close','상담 끝내기',!!lock)}</p>`:'';
  const taskBlock=`${c.tasks.length?`<ul class="pc-tasks">${tasks}</ul>`:'<p class="mt-note">할 일이 없어요. 필요하면 더해요.</p>'}${allDone}${add}`;
  const edits=c.edits?.length?`<ul class="pc-edits">${c.edits.map(e=>`<li>${mtBadge('학생이 고침','wait')} <span class="pc-label">${escape(pathCaseFields[e.field]||'')}${e.index===null?(e.field==='task'||e.field==='open'?' · 새 줄':''):' · '+(e.index+1)+'번째 줄'}</span>${e.text?'':'<p class="mt-note">학생이 이 줄을 뺐어요.</p>'}${e.text?pathCaseBilingual(e.text_ko,e.text,c.lang):''}</li>`).join('')}</ul>`:'';
  const messages=c.messages.map(m=>m.from==='student'?`<li class="pc-msg is-student"><span class="pc-who">학생 · ${escape(pathCaseWhen(m.at))}</span>${pathCaseBilingual(m.textKo,m.text,c.lang)}</li>`
    :`<li class="pc-msg is-staff"><span class="pc-who">${escape(m.authorName||'담당자')} · ${escape(pathCaseWhen(m.at))}</span><p class="pc-text">${escape(m.text)}</p>${m.textStudent?`<p class="pc-text pc-original"><span class="pc-label">학생에게 보낸 글 · ${escape(pathCaseLangs[c.lang]||'')}</span>${escape(m.textStudent)}</p>`:''}</li>`).join('');
  const translate=c.lang!=='ko'&&s.data.translation?pathCaseButton('translate','학생 말로 옮긴 초안 만들기',!!lock||!s.reply.trim()):'';
  const reply=closed?'<p class="mt-note">끝난 상담이에요. 학생이 다시 연결하면 새 상담으로 와요.</p>':`<div class="pc-reply"><label class="mt-field"><span>답(한국어)</span><textarea rows="5" maxlength="1000" data-pc-reply placeholder="학생에게 보낼 답을 한국어로 써요" ${lock}>${escape(s.reply)}</textarea></label>${c.lang!=='ko'?`<label class="mt-field"><span>학생에게 보낼 글(${escape(pathCaseLangs[c.lang]||'학생 말')}) · 옮긴 초안을 읽고 고쳐요</span><textarea rows="5" maxlength="2000" data-pc-replystudent lang="${escape(c.lang)}" placeholder="비워 두면 한국어 답만 가요" ${lock}>${escape(s.replyStudent)}</textarea></label>`:''}<div class="mt-actions">${translate}${pathCaseButton('reply',s.busy==='reply'?'보내는 중…':'학생에게 보내기',!!lock||!s.reply.trim(),'small primary')}</div></div>`;
  const conversation=c.conversation?.length?pathCaseSec('conversation','05','전체 AI 대화','학생이 함께 보냈어요',`<ol class="pc-conversation">${c.conversation.map(t=>`<li class="${t.role==='ai'?'is-ai':'is-student'}"><span class="pc-who">${t.role==='ai'?'AI':'학생'}</span><p class="pc-text" lang="${escape(c.lang)}">${escape(t.text)}</p></li>`).join('')}</ol>`,false):'';
  const e=s.erasure&&s.erasure.id===c.id&&s.erasure.revision===c.revision?s.erasure:null;
  const erase=c.canErase?(e?`<div class="pc-erase" role="group" aria-label="상담 지우기 확인"><strong>이 상담을 지울까요? 되돌릴 수 없어요.</strong><p>넘김 요약 · 할 일 · 대화를 이 서버에서 지워요. 갈래 · 받은 날 · 끝난 날 · 할 일 수만 1년 동안 남아요.</p><div class="mt-actions">${pathCaseButton('erase','지우기',!!lock,'small danger')}${pathCaseButton('erase-cancel','그만두기',!!lock)}</div></div>`:`<p class="mt-note">학생이나 보호자가 hello@synk.im으로 지워 달라고 하면 여기서 지워요.</p>${pathCaseButton('erase-check','지우기 전에 확인',!!lock,'small danger')}`):'';
  const end=`${closed?`<p class="mt-note">${c.deleteAt?escape(pathCaseDay(c.deleteAt))+'에 저절로 지워져요.':''}</p>`:`<p class="mt-note">끝낸 상담은 90일 뒤 저절로 지워져요.</p>${pathCaseButton('close','상담 끝내기',!!lock)}`}${erase}`;
  const openTasks=c.openTasks?`남은 ${c.openTasks}개`:c.tasks.length?'다 했어요':'없어요';
  return `<div class="mt-detail pc-sheet" data-pc-detail="${escape(c.id)}">${head}${facts}${pathCaseSec('brief','01',b?'넘김 요약':'학생이 남긴 글',b?'AI가 정리한 한 장':'',brief,true)}${pathCaseSec('tasks','02','할 일',openTasks,taskBlock,true)}${edits?pathCaseSec('edits','03','학생이 고친 줄',`${c.edits.length}줄`,edits,true):''}${pathCaseSec('talk','04','학생과의 대화',c.messages.length?`글 ${c.messages.length}개`:'아직 없어요',`${messages?`<ol class="pc-messages">${messages}</ol>`:''}${reply}`,true)}${conversation}${pathCaseSec('end','06','끝내기와 지우기',closed?'끝난 상담':'',end,!!e)}</div>`;
}
function pathCasesPanel(){
  const s=pathCaseState;
  if(!pathCasesVisible())return `${mtHead({tool:'path-cases',title:'PATH 상담함',layout:'desk'})}${mtEmpty('PATH 상담 담당만 볼 수 있어요','학생의 상담 내용이 있어 PATH 상담 담당 · 책임자와 회사 주인에게만 보여요.')}`;
  if(s.identity!==pathCaseIdentity())return '<p class="mt-loading" role="status">PATH 상담함을 불러오고 있어요.</p>';
  const head=pathCaseHead();
  if(!s.data)return `<div class="pc-panel" aria-busy="${s.loading}">${head}${pathCasePromise()}${s.error?mtError(s.error,pathCaseButton('reload','다시 읽기',s.loading)):'<p class="mt-loading" role="status">PATH 상담함을 불러오고 있어요.</p>'}</div>`;
  const off=s.data.enabled===false?'<p class="mt-note pc-off">지금은 학생에게서 새 상담과 새 글을 받지 않도록 꺼 두었어요. 이미 받은 상담은 그대로 처리할 수 있어요.</p>':'';
  return `<div class="pc-panel" aria-busy="${s.loading}">${head}${pathCasePromise()}${off}${s.error?mtError(s.error):''}<div class="mt-desk${s.picking||!s.selected?' is-picking':''}">${pathCaseBand()}${pathCaseList()}${pathCaseDetail()}</div></div>`;
}
async function pathCaseMutate(path,body,kind){
  const s=pathCaseState,identity=pathCaseIdentity();s.busy=kind;s.error='';pathCaseRender();
  try{const result=await api(path,body);if(identity!==pathCaseIdentity())return null;return result||{};}
  catch(error){if(identity===pathCaseIdentity()){s.error=error.message;if(error.status===409&&s.selected)await pathCaseOpen(s.selected,{quiet:true});}return null;}
  finally{if(identity===pathCaseIdentity()){s.busy='';pathCaseRender();}}
}
function pathCaseCaseResult(result){const s=pathCaseState;if(result?.case?.id===s.selected){s.detail=result.case;pathCaseAccept(result.case);}}
const pathCaseRequestId=()=>typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function'?crypto.randomUUID():null;
document.addEventListener('input',event=>{
  const s=pathCaseState,t=event.target;if(!pathCaseActive())return;
  if(t.matches?.('[data-pc-reply]')){s.reply=t.value;const send=document.querySelector?.('[data-pc-action="reply"]'),tr=document.querySelector?.('[data-pc-action="translate"]');if(send)send.disabled=!!s.busy||!s.reply.trim();if(tr)tr.disabled=!!s.busy||!s.reply.trim();return;}
  if(t.matches?.('[data-pc-replystudent]')){s.replyStudent=t.value;return;}
  if(t.matches?.('[data-pc-newtask]')){s.newTask=t.value;return;}
  if(t.matches?.('[data-pc-note]')){s.notes[t.dataset.pcNote]=t.value;}
});
document.addEventListener('change',async event=>{
  const s=pathCaseState,t=event.target;if(!pathCaseActive()||!t.matches?.('[data-pc-assign]')||!s.detail||s.busy)return;
  const result=await pathCaseMutate('/api/path-cases/'+encodeURIComponent(s.detail.id)+'/assign',{revision:s.detail.revision,assigneeId:t.value},'assign');
  if(result){pathCaseCaseResult(result);notify('담당을 바꿨어요.');await pathCaseLoad();}
});
document.addEventListener('toggle',event=>{const node=event.target;if(node?.matches?.('[data-pc-fold]'))pathCaseState.folds[node.dataset.pcFold]=node.open;},true);
document.addEventListener('click',async event=>{
  const s=pathCaseState,open=event.target.closest?.('[data-pc-open]'),button=event.target.closest?.('[data-pc-action]');
  if((!open&&!button)||!pathCaseActive()||s.identity!==pathCaseIdentity())return;
  if(open){const id=open.dataset.pcOpen;if(s.selected===id){s.picking=false;pathCaseRender();return;}if(s.reply.trim()&&!confirm('쓰던 답을 버릴까요?'))return;Object.assign(s,{selected:id,detail:null,reply:'',replyStudent:'',notes:{},newTask:'',erasure:null,folds:{},picking:false});await pathCaseOpen(id);return;}
  if(button.disabled||s.busy)return;
  const action=button.dataset.pcAction,c=s.detail,base=c?'/api/path-cases/'+encodeURIComponent(c.id):'';
  if(action==='reload'){await pathCaseLoad();return;}
  if(action==='pick'){s.picking=!s.picking;pathCaseRender();return;}
  if(action==='kind'){s.kind=Object.hasOwn(pathCaseKinds,button.dataset.kind)?button.dataset.kind:'';pathCaseRender();return;}
  if(action==='scope'){s.scope=button.dataset.scope==='all'?'all':'open';pathCaseRender();return;}
  if(!c)return;
  if(action==='translate'){const result=await pathCaseMutate(base+'/translate-draft',{text:s.reply.trim()},'translate');if(result){if(result.text){s.replyStudent=result.text;notify('옮긴 초안을 넣었어요. 읽고 고친 뒤 보내요.');}else notify('지금은 옮긴 초안을 만들지 못했어요. 직접 써 주세요.');pathCaseRender();}return;}
  if(action==='reply'){const id=pathCaseRequestId();if(!id){s.error='이 브라우저에서는 보낼 수 없어요. 최신 브라우저로 열어 주세요.';pathCaseRender();return;}
    const body={revision:c.revision,request_id:id,text:s.reply.trim(),...(s.replyStudent.trim()?{textStudent:s.replyStudent.trim()}:{})};
    const result=await pathCaseMutate(base+'/reply',body,'reply');if(result){s.reply='';s.replyStudent='';pathCaseCaseResult(result);notify('학생에게 답을 보냈어요.');}return;}
  if(action==='task-done'||action==='task-undone'||action==='task-remove'){const taskId=button.dataset.task,note=String(s.notes[taskId]||'').trim();
    const result=await pathCaseMutate(base+'/task',{revision:c.revision,action:action.slice(5),taskId,...(action==='task-done'&&note?{note}:{})},'task');if(result){delete s.notes[taskId];pathCaseCaseResult(result);}return;}
  if(action==='task-add'){const text=s.newTask.trim();if(!text)return;const result=await pathCaseMutate(base+'/task',{revision:c.revision,action:'add',do:text},'task');if(result){s.newTask='';pathCaseCaseResult(result);}return;}
  if(action==='close'){if(!confirm('이 상담을 끝낼까요? 학생이 다시 연결하면 새 상담으로 와요.'))return;const result=await pathCaseMutate(base+'/close',{revision:c.revision},'close');if(result){pathCaseCaseResult(result);notify('상담을 끝냈어요.');}return;}
  if(action==='erase-check'){const result=await pathCaseMutate(base+'/erase-check',{revision:c.revision},'erase-check');if(result?.erasure){s.erasure=result.erasure;s.folds.end=true;pathCaseRender();}return;}
  if(action==='erase-cancel'){s.erasure=null;pathCaseRender();return;}
  if(action==='erase'){const e=s.erasure;if(!e)return;const result=await pathCaseMutate(base+'/erase',{revision:e.revision,token:e.token},'erase');s.erasure=null;if(result?.erased){Object.assign(s,{selected:null,detail:null,reply:'',replyStudent:''});notify('상담을 지웠어요.');await pathCaseLoad();}}
});
