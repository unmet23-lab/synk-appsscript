const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tags=['체','조','어','낱','맞','띄','연','근','빠','자'];
const time=value=>Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('ko-KR',{month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}):'시간 확인 필요';
// Render only the small authored Markdown subset, after escaping every source
// character. Arbitrary server HTML and links remain inert text.
export function courseMaterial(value){
 const inline=text=>esc(text).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/&lt;u&gt;(.*?)&lt;\/u&gt;/g,'<u>$1</u>');
 let table=false,result='';
 for(const line of String(value||'').split('\n')){
  if(/^\|/.test(line)){
   if(!table){result+='<div style="overflow-x:auto"><table>';table=true;}
   if(/^\|[\s:|-]+\|$/.test(line))continue;
   result+='<tr>'+line.split('|').slice(1,-1).map(cell=>'<td>'+inline(cell.trim())+'</td>').join('')+'</tr>';continue;
  }
  if(table){result+='</table></div>';table=false;}
  if(line.trim())result+='<p'+(line.startsWith('>')?' class="course-passage"':'')+'>'+inline(line.replace(/^>\s?/,''))+'</p>';
 }
 if(table)result+='</table></div>';
 return '<article class="course-material">'+result+'</article>';
}
const errors={CLASSROOM_CAPACITY:'반의 기록 저장 공간이 가득 찼어요. 입력한 글은 이 화면에 남아 있어요. 선생님이 저장 공간을 확인한 뒤 다시 제출해 주세요.',REVISION_CONFLICT:'다른 기기에서 기록이 바뀌었어요. 새로고침 후 다시 확인해 주세요.',WAIT_FOR_FEEDBACK:'선생님 첨삭을 받은 뒤 고쳐 써 주세요.',READING_INCOMPLETE:'읽기 다섯 문항의 답을 모두 골라 주세요.',SHARING_DISABLED:'학생의 수업 기록 공유가 꺼졌어요.',LEARNING_DISABLED:'계정의 학습 기록과 이 반 공유를 먼저 켜 주세요.',COURSE_ALREADY_ASSIGNED:'이 주 과제가 이미 있어요.',IDEMPOTENCY_CONFLICT:'첫 요청과 내용이 달라졌어요. 새로고침한 뒤 확인해 주세요.'};
export function mountCourseWriting({root,request,guard=()=>{},makeId=()=>crypto.randomUUID(),sharingMetadata=null}){
 let stopped=false,generation=0,data=null,busy=false,pending=null,dirty=false,checkingGroups=false,suspended=false;
 // Verified parent metadata also fences late course responses, independently
 // of the workspace snapshot. A new consent epoch cannot retain old writing.
 const fence=next=>{
  if(next?.role!=='teacher'||!sharingMetadata)return next;
  const known=new Map(sharingMetadata.map(row=>[row.id,row])),learners=next.learners.filter(row=>{const meta=known.get(row.id);return meta&&(meta.revision<row.sharingRevision||meta.revision===row.sharingRevision&&meta.enabled&&meta.connected&&!meta.revoked);});
  return learners.length===next.learners.length?next:{...next,learners,groups:[]};
 };
 const applySharing=latest=>{if(stopped)return;sharingMetadata=latest;const next=fence(data);if(next!==data){data=next;paint();}};
 const drafts=new Map();
 const formKey=form=>form.hasAttribute('data-course-assign')?'assign':form.hasAttribute('data-course-submit')?'submit:'+form.dataset.courseSubmit+':'+form.dataset.sharingRevision:'feedback:'+form.dataset.courseFeedback+':'+form.dataset.learner+':'+form.dataset.sharingRevision+':'+form.dataset.version;
 const remember=form=>{const values=[...form.elements].filter(el=>el.name).map(el=>({name:el.name,type:el.type,value:el.value,checked:el.checked}));values.baseFeedback=form.dataset.baseFeedback;values.baseVersion=form.dataset.baseVersion;drafts.set(formKey(form),values);dirty=true;};
 const lockPending=form=>{if(pending?.key===formKey(form))for(const el of form.elements)if(el.type!=='submit')el.disabled=true;};
 const doc=root.ownerDocument,heading=doc.createElement('h3'),status=doc.createElement('p'),body=doc.createElement('div'),refresh=doc.createElement('button');
 root.classList.add('course-writing');
 heading.textContent='이번 주 읽기와 쓰기';status.setAttribute('role','status');refresh.textContent='과제 새로고침';refresh.type='button';refresh.className='quiet-button';root.replaceChildren(heading,refresh,status,body);
 const check=version=>{guard();if(stopped||version!==generation)throw Object.assign(Error('ACCOUNT_CHANGED'),{code:'ACCOUNT_CHANGED'});};
 const feedback=v=>v.feedback.map(f=>`<article class="course-feedback"><strong>첨삭 ${f.revision} · ${esc(time(f.at))}</strong><p>잘된 점: ${esc(f.good)}</p><p>고칠 핵심: ${esc(f.focus)}</p><p>다시 써 볼 곳: ${esc(f.retry)}</p><p>${f.tags.map(t=>'〔'+esc(t)+'〕').join(' ')}</p></article>`).join('');
 function history(record){return record?.versions.map(v=>`<details ${v===record.versions.at(-1)?'open':''}><summary>${v.version===1?'처음 낸 글':v.version+'번째 원고'} · ${esc(time(v.submittedAt))}${v.late?' · 마감 뒤 제출':''}</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(v.text)}</pre>${v.reflection?`<p>고친 이유: ${esc(v.reflection)}</p>`:''}${feedback(v)}${v===record.versions[0]?`<details><summary>읽기 결과 · ${v.reading.filter(q=>q.correct).length}/5</summary>${v.reading.map(q=>`<p>${esc(q.id)} · 내 답 ${q.chosen} · 정답 ${q.answer}</p>${courseMaterial(q.explanation)}`).join('')}</details>`:''}</details>`).join('')||'';}
 function studentTask(task){
  const historyRecords=data.records.filter(r=>r.taskId===task.id),record=historyRecords.find(r=>!r.readOnly),last=record?.versions.at(-1);
  return `<section class="course-task" data-task="${esc(task.id)}"><h4>${esc(task.material.title)}</h4><p>마감 ${esc(time(task.dueAt))} · 늦어도 제출할 수 있어요.</p><details><summary>쓰기 과제 읽기</summary>${courseMaterial(task.material.prompt)}</details>${historyRecords.map(r=>(r.readOnly?'<p>이전 제출 이력 · 나만 읽기</p>':'')+history(r)).join('')}
  ${record?`<label><input type="checkbox" data-course-group="${esc(task.id)}" ${record.groupConsent?'checked':''}> 내 원문을 공유하지 않고 첨삭 기호를 이 반 수업 준비의 집계에 쓰기(선택·언제든 끄기)</label>`:''}
  ${data.canSubmit&&(!last||last.feedback.length)?`<form data-course-submit="${esc(task.id)}" data-sharing-revision="${esc(data.sharing.revision)}" data-base-version="${last?.version||0}">${!last?task.material.reading.map(q=>`<fieldset><legend>${esc(q.id)} · ${esc(q.title)}</legend>${courseMaterial(q.prompt)}${[1,2,3,4].map(n=>`<label><input type="radio" name="${esc(q.id)}" value="${n}" required> ${n}</label>`).join('')}</fieldset>`).join(''):''}<label>${last?'고쳐 쓴 글':'내가 쓴 글'}<textarea name="text" required maxlength="12000" rows="10" style="width:100%">${esc(last?.text||'')}</textarea></label>${last?'<label>무엇을 왜 고쳤나요?<textarea name="reflection" required maxlength="2000" rows="3"></textarea></label>':''}<p>원문과 수정 이력을 담당 선생님에게 보냅니다. 글을 자동 채점하거나 급수로 바꾸지 않아요.</p><button type="submit" class="felt-button">${last?'수정본 제출':'읽기·쓰기 제출'}</button></form>`:last?'<p>선생님의 첨삭을 기다리고 있어요.</p>':'<p>계정 설정에서 학습 기록 저장과 이 반 선생님 공유를 켠 뒤 제출할 수 있어요.</p>'}</section>`;
 }
 function groupMaterial(group){
  return `<h5>다음 수업 준비</h5>${group?.cells?.length?`<button type="button" class="quiet-button" data-course-plan="${esc(group.taskId)}">이 재료로 다음 수업 준비</button>${group.plan?`<p>선택한 10분 수업안 · ${esc(time(group.plan.at))}</p><ol>${group.plan.materials.map(m=>`<li>${esc(m.activity)}</li>`).join('')}</ol><p>${esc(group.plan.note)}</p>`:''}`:''}${group?.status==='ready'?`<p>집계에 동의하고 첨삭받은 첫 원고 ${group.reviewed}명 / 집계 동의 ${group.eligible}명 · 첨삭 대기 ${group.unreviewed}명</p><p>${esc(group.note)}</p>${group.cells.map(c=>`<p>〔${esc(c.tag)}〕 ${c.n}/${c.분모} · ${esc(c.suggestion)}</p>`).join('')||'<p>다섯 명 이상에게 나타난 기호가 아직 없어요.</p>'}`:'<p>집계에 따로 동의하고 첫 첨삭이 끝난 학생 다섯 명부터 공통 기호를 보여요. 원문은 집계에 넣지 않아요.</p>'}`;
 }
 function teacherTask(task){
  const group=data.groups.find(g=>g.taskId===task.id);
  return `<section class="course-task"><h4>${esc(task.material.title)}</h4><p>마감 ${esc(time(task.dueAt))}</p><details><summary>과제 원문</summary>${courseMaterial(task.material.prompt)}</details><section data-course-group-summary="${esc(task.id)}">${groupMaterial(group)}</section>
   ${data.learners.map(l=>{const r=l.records.find(r=>r.taskId===task.id),latest=r?.versions.at(-1),v=r?.versions.find(v=>drafts.has('feedback:'+task.id+':'+l.id+':'+l.sharingRevision+':'+v.version))||latest,f=v?.feedback.at(-1);return `<details><summary>${esc(l.name)} · ${v?v.feedback.length?'첨삭 반환':'첨삭 대기':'제출 대기'}</summary>${history(r)}${r?.improvement?`<p>교사 루브릭 변화: 내용 ${r.improvement.content}, 구성 ${r.improvement.structure}, 언어 ${r.improvement.language}. ${esc(r.improvement.note)}</p>`:''}${v?`${v!==latest?`<p>이전 ${v.version}번째 원고에 쓰던 첨삭이에요. 새 ${latest.version}번째 원고의 첨삭은 이 내용을 반환한 뒤 열려요.</p>`:''}<form data-course-feedback="${esc(task.id)}" data-learner="${esc(l.id)}" data-sharing-revision="${esc(l.sharingRevision)}" data-version="${v.version}" data-base-feedback="${f?.revision||0}"><label>잘된 점<textarea name="good" required maxlength="1000">${esc(f?.good||'')}</textarea></label><label>고칠 핵심<textarea name="focus" required maxlength="1000">${esc(f?.focus||'')}</textarea></label><label>다시 써 볼 곳<textarea name="retry" required maxlength="1000">${esc(f?.retry||'')}</textarea></label><fieldset><legend>첨삭 기호(최대 다섯 개)</legend>${tags.map(t=>`<label><input type="checkbox" name="tag" value="${t}" ${f?.tags.includes(t)?'checked':''}>〔${t}〕</label>`).join('')}</fieldset>${[['content','내용'],['structure','구성'],['language','언어']].map(([k,label])=>`<label>${label}(내부 0~2)<select name="${k}">${[0,1,2].map(n=>`<option value="${n}" ${f?.rubric[k]===n?'selected':''}>${n}</option>`).join('')}</select></label>`).join('')}<label>이번 첨삭에 쓴 분<input name="minutes" type="number" min="0" max="240" value="0" required></label><p>원문과 첨삭 이력을 보존합니다. 직접 검토한 내용만 돌려주세요.</p><button class="felt-button" type="submit">${f?'첨삭 수정본 반환':'첨삭 돌려주기'}</button></form>`:''}</details>`;}).join('')}</section>`;
 }
 function paint(){
  const open=[...body.querySelectorAll('details[open]')].map(el=>el.querySelector('summary')?.textContent),focused=doc.activeElement,focusedForm=focused?.closest?.('form'),focus=focusedForm?{key:formKey(focusedForm),name:focused.name,start:focused.selectionStart,end:focused.selectionEnd}:null;
  body.innerHTML=`<p>${data.role==='teacher'?'창작 연습 문항 · 교원 검수와 실제 학생 효과 검증은 별도입니다. 공식 점수·급수 예측이 아니에요.':'연습용 창작 문항이에요. 공식 시험 점수로 환산하지 않아요.'}</p>${data.role==='teacher'?`<form data-course-assign><p>이 반에 첫 수정 과제를 보내면 기존 주차 과제는 이전 이력으로 남아요. 글과 이 기기의 초안을 자동으로 옮기지 않아요. 새 제출에는 학생의 현재 학습 기록 저장과 이 반 공유가 필요해요. 보낸 주차와 마감은 이 화면에서 바꿀 수 없어요. 보내기 전에 주차와 마감을 확인해 주세요.</p><label>이번 주<select name="week">${data.weeks.filter(w=>!data.tasks.some(t=>t.week===w.week)).map(w=>`<option value="${w.week}">${esc(w.title)}</option>`).join('')}</select></label><label>마감<input type="datetime-local" name="dueAt" required></label><button type="submit" class="felt-button" ${data.tasks.length===8?'disabled':''}>반에 과제 보내기</button></form>`:''}${data.tasks.length?data.tasks.map(data.role==='teacher'?teacherTask:studentTask).join(''):'<p>선생님이 주차와 마감을 정하면 과제가 보여요.</p>'}`;
  const available=new Map([...body.querySelectorAll('form')].map(form=>[formKey(form),form]));
  for(const [key,values] of drafts){
   const form=available.get(key);if(!form){drafts.delete(key);if(pending?.key===key)pending=null;continue;}
   if(values.baseFeedback!==undefined)form.dataset.baseFeedback=values.baseFeedback;if(values.baseVersion!==undefined)form.dataset.baseVersion=values.baseVersion;
   for(const saved of values)for(const el of form.elements)if(el.name===saved.name&&el.type===saved.type){if(['checkbox','radio'].includes(el.type)){if(el.value===saved.value)el.checked=saved.checked;}else el.value=saved.value;}
  }
  dirty=drafts.size>0;
  for(const form of available.values())lockPending(form);
  for(const el of body.querySelectorAll('details'))if(open.includes(el.querySelector('summary')?.textContent))el.open=true;
  if(focus){const el=[...(available.get(focus.key)?.elements||[])].find(el=>el.name===focus.name);if(el){el.focus({preventScroll:true});if(typeof focus.start==='number'&&typeof el.setSelectionRange==='function')el.setSelectionRange(focus.start,focus.end);}}
 }
 async function reload({discard=false}={}){
  if(stopped||busy)return;const version=++generation;busy=true;refresh.disabled=true;body.hidden=true;status.textContent='과제를 확인하고 있어요.';
  try{guard();const result=await request('/api/course');check(version);data=fence(result);if(discard){pending=null;drafts.clear();}paint();body.hidden=false;suspended=false;status.textContent='최신 과제를 불러왔어요.';return true;}
  catch(error){if(!stopped){data=null;body.replaceChildren();if(['FORBIDDEN','ACCOUNT_CHANGED','SESSION_CHANGED','AUTH_REQUIRED','SHARING_DISABLED','LEARNING_DISABLED'].includes(error.code)){pending=null;drafts.clear();dirty=false;}status.textContent=errors[error.code]||'과제 연결을 확인하지 못했어요. 다시 불러와 주세요.';}return false;}
  finally{if(!stopped){busy=false;refresh.disabled=false;}}
 }
 async function send(route,payload,form){
  if(stopped||busy||suspended)return;const version=generation,attempt=pending;busy=true;refresh.disabled=true;
  form?.querySelectorAll('button,input,textarea,select').forEach(el=>el.disabled=true);
  status.textContent='서버에 저장을 확인하고 있어요.';
  try{guard();await request(route,payload);check(version);if(pending!==attempt)return;drafts.delete(formKey(form));pending=null;busy=false;const loaded=await reload();status.textContent=loaded?'서버에 저장했어요.':'저장은 확인했지만 최신 과제를 불러오지 못했어요. 과제 새로고침으로 다시 확인해 주세요.';}
  catch(error){if(!stopped&&version===generation&&pending===attempt){status.textContent=errors[error.code]||'응답을 확인하지 못했어요. 저장 결과를 확인할 때까지 내용 수정을 잠시 막았어요. 같은 제출 버튼을 눌러 확인해 주세요.';if(error.status>=400&&error.status<500)pending=null;if(['SHARING_DISABLED','LEARNING_DISABLED','FORBIDDEN','ACCOUNT_CHANGED'].includes(error.code)){data=null;body.replaceChildren();pending=null;drafts.clear();dirty=false;}}}
  finally{if(!stopped){busy=false;refresh.disabled=false;form?.querySelectorAll('button,input,textarea,select').forEach(el=>el.disabled=false);if(form)lockPending(form);}}
 }
 // The existing teacher workspace poll calls this without replacing draft
 // feedback. Separate aggregate consent can change without a class-share epoch.
 async function refreshGroups(){
  if(stopped||busy||checkingGroups||data?.role!=='teacher')return;
  checkingGroups=true;const version=generation;
  try{guard();const next=await request('/api/course');check(version);data=fence(next);paint();suspended=false;body.hidden=false;status.textContent='최신 과제를 불러왔어요.';}
  catch(error){if(!stopped&&version===generation){for(const region of body.querySelectorAll('[data-course-group-summary]'))region.textContent='수업 준비 집계를 다시 확인해 주세요.';if(['FORBIDDEN','ACCOUNT_CHANGED','SESSION_CHANGED','AUTH_REQUIRED'].includes(error.code)){data=null;body.replaceChildren();pending=null;drafts.clear();dirty=false;}}}
  finally{checkingGroups=false;}
 }
 function submit(event){
  const form=event.target;if(!root.contains(form)||!form.matches('form')||stopped)return;event.preventDefault();if(busy||suspended)return;
  if(pending){if(pending.key!==formKey(form)){status.textContent='앞서 누른 제출 버튼으로 저장 결과를 먼저 확인해 주세요.';return;}void send(pending.route,pending.payload,form);return;}
  const values=new FormData(form),idempotencyKey=makeId();let payload,route;
  if(form.hasAttribute('data-course-assign')){route='/api/course/assign';payload={week:Number(values.get('week')),dueAt:new Date(values.get('dueAt')).toISOString(),idempotencyKey};}
  else if(form.hasAttribute('data-course-submit')){
   const taskId=form.dataset.courseSubmit,record=data.records.find(r=>r.taskId===taskId&&!r.readOnly);route='/api/course/submit';
   payload={taskId,sharingRevision:data.sharing.revision,baseVersion:Number(form.dataset.baseVersion),text:values.get('text'),reflection:values.get('reflection')||'',reading:Object.fromEntries([...values].filter(([k])=>/^R\d-\d$/.test(k)).map(([k,v])=>[k,Number(v)])),idempotencyKey};
  }else if(form.hasAttribute('data-course-feedback')){
   const taskId=form.dataset.courseFeedback,learnerId=form.dataset.learner,l=data.learners.find(l=>l.id===learnerId),v=l.records.find(r=>r.taskId===taskId).versions.find(v=>v.version===Number(form.dataset.version));route='/api/course/feedback';
   payload={taskId,learnerId,sharingRevision:l.sharingRevision,version:v.version,baseFeedback:Number(form.dataset.baseFeedback),good:values.get('good'),focus:values.get('focus'),retry:values.get('retry'),tags:values.getAll('tag'),rubric:Object.fromEntries(['content','structure','language'].map(k=>[k,Number(values.get(k))])),minutes:Number(values.get('minutes')),idempotencyKey};
  }else return;
  pending={route,payload,key:formKey(form)};void send(route,payload,form);
 }
 async function change(event){
  const input=event.target;if(!input.dataset.courseGroup||!data)return;
  const r=data.records.find(r=>r.taskId===input.dataset.courseGroup&&!r.readOnly);if(!r)return;
  if(busy||suspended||pending){input.checked=r.groupConsent;status.textContent='앞서 누른 제출 버튼으로 저장 결과를 먼저 확인해 주세요.';return;}
  const version=generation,previous=r.groupConsent;busy=true;refresh.disabled=true;input.disabled=true;
  try{guard();const result=await request('/api/course/group-sharing',{taskId:r.taskId,sharingRevision:data.sharing.revision,baseConsentRevision:r.consentRevision,enabled:input.checked});check(version);Object.assign(r,{groupConsent:result.record.groupConsent,consentRevision:result.record.consentRevision});input.checked=r.groupConsent;status.textContent='집계 동의를 저장했어요.';}
  catch(error){if(!stopped&&version===generation){input.checked=previous;status.textContent='집계 동의를 저장하지 못했어요. 현재 설정을 확인하고 있어요.';
   try{guard();const current=await request('/api/course');check(version);const record=current.records.find(item=>item.taskId===r.taskId&&!item.readOnly);if(!record)throw Error('CONSENT_UNAVAILABLE');Object.assign(r,{groupConsent:record.groupConsent,consentRevision:record.consentRevision});input.checked=r.groupConsent;status.textContent='서버에 저장된 집계 동의를 다시 표시했어요.';}
   catch{if(!stopped&&version===generation){input.indeterminate=true;status.textContent='집계 동의를 확인하지 못했어요. 과제를 새로고침해 주세요.';}}
  }}
  finally{if(!stopped){busy=false;refresh.disabled=false;input.disabled=input.indeterminate;}}
 }
 function click(event){const button=event.target.closest('[data-course-plan]');if(!button||busy||suspended||!data)return;if(pending||dirty){status.textContent='작성 중인 첨삭을 반환하거나 과제를 새로고침한 뒤 수업안을 골라 주세요.';return;}const group=data.groups.find(g=>g.taskId===button.dataset.coursePlan);void send('/api/course/plan',{taskId:group.taskId,signature:JSON.stringify([group.reviewed,group.eligible,group.cells.map(c=>[c.tag,c.n])])},button.closest('.course-task'));}
 const input=event=>{const form=event.target.closest('form');if(form)remember(form);};
 refresh.onclick=()=>{if(!data){void reload();return;}if((!dirty&&!pending)||doc.defaultView?.confirm('작성 중인 글을 닫고 서버의 최신 과제를 불러올까요?'))void reload({discard:true});};root.addEventListener('input',input);root.addEventListener('submit',submit);root.addEventListener('change',change);root.addEventListener('click',click);
 return {reload,refreshGroups,applySharing,suspend(){suspended=true;body.hidden=true;status.textContent='연결을 확인하는 동안 첨삭 초안을 잠시 숨겼어요. 권한을 다시 확인하면 이어 쓸 수 있어요.';},hasDraft:()=>dirty||!!pending,dispose(){stopped=true;generation++;data=null;pending=null;sharingMetadata=null;drafts.clear();root.removeEventListener('input',input);root.removeEventListener('submit',submit);root.removeEventListener('change',change);root.removeEventListener('click',click);root.replaceChildren();}};
}
