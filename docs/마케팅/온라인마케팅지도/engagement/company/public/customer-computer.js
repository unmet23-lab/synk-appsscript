import {createComputerConsultation} from './consultation.mjs';
import {createComputerInterpretation} from './interpretation.mjs';
import {createComputerModelHost} from './model-host.mjs';
import {createCustomerComputerState} from './customer-computer-state.mjs';

const $=id=>document.getElementById(id);
const el=(tag,attrs={},...children)=>{const node=document.createElement(tag);for(const [key,value]of Object.entries(attrs)){if(key==='text')node.textContent=value;else if(key==='class')node.className=value;else node.setAttribute(key,value);}node.append(...children.filter(Boolean));return node;};
const button=(text,action,attrs={})=>{const node=el('button',{type:'button',class:'felt',text,...attrs});node.addEventListener('click',action);return node;};
const clone=value=>JSON.parse(JSON.stringify(value));
const date=value=>{const stamp=Date.parse(value);return Number.isFinite(stamp)?new Intl.DateTimeFormat('ko',{dateStyle:'medium',timeStyle:'short'}).format(stamp):'';};
const notice=text=>{$('notice').textContent=text;};
let state,content,host,session={authenticated:false,user:null,csrfToken:null,loginAvailable:false},usage=null;
let dirty=false,draftRevision=null,draftStatus='unknown',draftUpdated=null,conflicted=false,busy=false,aiPending=null,aiRetry=null,aiGeneration=0,epoch=0,checking=null;

async function api(path,{method='GET',body}={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
    const response=await fetch('/api/customer/'+path,{method,credentials:'same-origin',cache:'no-store',redirect:'error',signal:controller.signal,
      ...(method==='GET'?{}:{headers:{'Content-Type':'application/json',...(session.csrfToken?{'X-CSRF-Token':session.csrfToken}:{})},body:JSON.stringify(body??{})})});
    if(!response.ok)throw Object.assign(Error('customer-request-failed'),{status:response.status});
    const raw=await response.text();if(raw.length>150000)throw Error('customer-response-too-large');return JSON.parse(raw);
  }finally{clearTimeout(timer);}
}
function cancelAI(){aiGeneration++;aiPending?.abort();aiPending=null;aiRetry=null;}
function newHost(){
  const ownerEpoch=epoch;
  return createComputerModelHost({fetchImpl:async(url,options)=>{
    const mapped=url==='/api/me'?'/api/customer/me':url.replace(/^\/api\/computer-interpretation/,'/api/customer/computer-interpretation');
    if(!mapped.startsWith('/api/customer/'))throw Error('unexpected-model-path');
    const response=await fetch(mapped,options);
    if(ownerEpoch===epoch&&mapped==='/api/customer/computer-interpretation'&&(!options?.method||options.method==='GET')&&response.ok){
      const status=await response.clone().json();usage=status.usage??usage;
    }
    return response;
  }});
}
function changed(action,focus){cancelAI();action();dirty=true;render();if(focus)document.querySelector(focus)?.focus();}
function validDraft(value){return value&&Number.isSafeInteger(value.revision)&&value.revision>=0&&['empty','active','deleted'].includes(value.status)&&(!value.updatedAt||Number.isFinite(Date.parse(value.updatedAt)))&&(value.status!=='active'||value.document?.version===1);}
function rememberDraft(value){if(!validDraft(value))throw Error('invalid-draft');draftRevision=value.revision;draftStatus=value.status;draftUpdated=value.updatedAt??null;}
async function readDraftMetadata(){const ownerEpoch=epoch;const value=await api('computer-draft');if(ownerEpoch!==epoch)return;if(!validDraft(value))throw Error('invalid-draft');if(draftRevision===null&&!conflicted)rememberDraft(value);}
async function refreshSession(){
  if(checking)return checking;
  checking=(async()=>{
    try{
      const value=await api('me');if(typeof value.authenticated!=='boolean'||typeof value.loginAvailable!=='boolean'||value.authenticated&&(!value.user||typeof value.user.id!=='string'||typeof value.csrfToken!=='string'))throw Error('invalid-session');
      if(session.user?.id!==value.user?.id){epoch++;cancelAI();if(session.user){state.reset();$('source-text').value='';dirty=false;notice('로그인 계정이 바뀌어 현재 화면의 상담을 비웠어요.');}draftRevision=null;draftStatus='unknown';draftUpdated=null;conflicted=false;}
      session={authenticated:value.authenticated,user:value.user,csrfToken:value.csrfToken,loginAvailable:value.loginAvailable};usage=value.ai?.usage??null;host=newHost();
      if(session.authenticated){await host.connect();try{await readDraftMetadata();}catch{notice('서버 상담 상태를 확인하지 못했어요. 현재 입력은 그대로예요.');}}render();
    }catch{
      epoch++;cancelAI();session={...session,authenticated:false,csrfToken:null,loginAvailable:false};host=newHost();render();notice('로그인 상태를 확인하지 못했어요. 현재 입력을 유지했어요. 연결이 돌아오면 이 창을 다시 선택해 주세요.');
    }finally{checking=null;}
  })();return checking;
}
function renderAccount(){
  $('account-status').textContent=session.authenticated?`${session.user.name||'고객'}님으로 로그인했어요.`:session.loginAvailable?'SYNK ID로 로그인하면 내 계정에 상담을 저장할 수 있어요.':'SYNK ID 연결을 준비 중이에요. 지금은 이 화면에서 조건을 확인할 수 있어요.';
  $('login').hidden=session.authenticated;$('login').disabled=!session.loginAvailable||busy;
  $('logout').hidden=!session.authenticated;$('logout').disabled=busy;
  const connected=host.state();$('ai-extract').disabled=!connected.available||!state.snapshot().source.text.trim()||!!aiPending||busy;
  $('ai-extract').textContent=aiRetry&&!aiPending?'AI 요청 다시 확인':'AI로 정리하기';$('ai-cancel').hidden=!aiPending;
  $('ai-status').textContent=aiPending?'AI가 원문을 정리하고 있어요. 확인한 조건은 그대로 유지해요.':connected.available?`${connected.providerLabel} · ${connected.modelLabel}로 원문을 정리할 수 있어요.`:!session.authenticated?'AI 정리는 SYNK ID 로그인 후 사용할 수 있어요.':'AI 정리를 지금 사용할 수 없어요. 이 기기에서 정리하거나 직접 골라 주세요.';
  const counts=usage&&Number.isSafeInteger(usage.requestsUsed)&&Number.isSafeInteger(usage.requestLimit)&&Number.isSafeInteger(usage.requestsRemaining);
  $('ai-usage').textContent=counts?`오늘 AI 요청 ${usage.requestsUsed}/${usage.requestLimit}회 · 남은 ${usage.requestsRemaining}회${date(usage.resetsAt)?' · 다음 초기화 '+date(usage.resetsAt):''}`:'';
  const privacy=host.privacyState();$('delete-ai').disabled=!privacy.canDelete||busy||!!aiPending;
  $('privacy-status').textContent=privacy.canDelete?`서버 AI 응답 ${privacy.storedResponses}개 · 처리 중 ${privacy.pendingResponses}개 · 최대 ${privacy.retentionHours}시간 보관`:'로그인 후 AI 응답 보관 상태를 확인할 수 있어요.';
  const canManage=session.authenticated&&draftRevision!==null&&!busy&&!conflicted;
  $('save-draft').disabled=!canManage||!!aiPending||!state.snapshot().source.text.trim()&&!state.snapshot().source.answers.uses.length;
  $('load-draft').disabled=!session.authenticated||busy||draftStatus!=='active'&&!conflicted;$('delete-draft').disabled=!canManage||draftStatus!=='active';
  $('draft-status').textContent=!session.authenticated?'로그인하면 저장·불러오기·삭제를 할 수 있어요.':draftRevision===null?'서버 상담 상태를 확인하지 못했어요. 새로고침 후 다시 시도해 주세요.':draftStatus==='active'?`${draftUpdated?date(draftUpdated)+'에 ':''}저장된 상담이 있어요.${dirty?' 현재 화면에는 아직 저장하지 않은 변경이 있어요.':''}`:dirty?'현재 입력한 내용은 아직 서버에 저장하지 않았어요.':'저장된 상담이 없어요.';
}
function reviewProposal(id,action,value){try{changed(()=>state.review(id,action,value));}catch{notice('제안을 반영하지 못했어요. 원문을 다시 정리하거나 직접 골라 주세요.');}}
function renderProposals(source){
  $('interpret-status').textContent=source.mode?`정리한 제안 ${source.proposals.length}개 · 직접 확인한 조건만 반영해요.`:'원문을 정리하면 근거 문장과 확인할 조건을 보여 드려요.';
  $('proposals').replaceChildren(...source.proposals.map(proposal=>{
    const field=state.catalog().fields.find(item=>item.id===proposal.field),effective=source.understanding.fields.find(item=>item.id===field.id),display=value=>field.options.find(option=>option.id===value)?.label||String(value);
    const active=!!proposal.review&&effective.usable&&effective.evidence.includes('i.'+proposal.review.id);
    const manual=Object.hasOwn(source.manual,field.id)||Object.hasOwn(source.manual,field.about);
    const card=el('article',{class:'proposal','data-proposal':proposal.id},el('h3',{text:field.label}),...proposal.evidence.map(e=>el('blockquote',{text:e.quote})),el('p',{text:'제안: '+display(proposal.value)}),el('p',{class:'muted',text:manual?'직접 고른 조건이 우선 적용돼요.':active?'확인한 조건으로 반영했어요.':['reject','withdraw'].includes(proposal.review?.action)?'추천에서 제외했어요.':'아직 추천에 반영하지 않았어요.'}));
    const confirm=button(active?'확인 취소':'내 조건이 맞아요',()=>reviewProposal(proposal.id,active?'withdraw':'confirm'),{'aria-label':field.label+(active?' 확인 취소':' 확인')});confirm.disabled=!active&&proposal.status!=='pending';
    const select=el('select',{'aria-label':field.label+' 수정할 값'},...field.options.map((option,i)=>el('option',{value:i,text:option.label})));select.value=String(field.options.findIndex(option=>option.id===(active?effective.value:proposal.value)));
    const correction=el('div',{class:'correction',hidden:''},select,button('이 값으로 수정',()=>reviewProposal(proposal.id,'correct',field.options[Number(select.value)].id)));
    const correct=button('수정',()=>{correction.hidden=!correction.hidden;if(!correction.hidden)select.focus();},{'aria-label':field.label+' 수정'});correct.disabled=proposal.reasons.some(reason=>['other-subject','source-excluded','source-expired','future-source'].includes(reason));
    card.append(el('div',{class:'actions'},confirm,correct,button('제외',()=>reviewProposal(proposal.id,active?'withdraw':'reject'),{'aria-label':field.label+' 제외'})),correction);return card;
  }));
  $('held-panel').hidden=!source.held.length;$('held').replaceChildren(...source.held.map(item=>el('p',{class:'muted',text:'“'+item.quote+'” — '+item.reason})));
}
function optionPicker(question,answers,{advance=false}={}){
  const wrap=el('div'),choices=el('div',{class:'choices'}),multiple=question.selection==='multiple',selected=new Set(multiple&&Array.isArray(answers[question.about])?answers[question.about]:[]);
  const confirm=button('선택한 조건 확인',()=>{changed(()=>state.manual(question.about,(question.displayOptions||question.options).filter(option=>selected.has(option.id)).map(option=>option.id)));if(advance)$('question-title').focus();});
  confirm.disabled=!selected.size;
  for(const option of question.displayOptions||question.options){const value=option.value??option.id;const b=button(option.label,()=>{if(multiple){selected.has(option.id)?selected.delete(option.id):selected.add(option.id);b.setAttribute('aria-pressed',String(selected.has(option.id)));confirm.disabled=!selected.size;}else{changed(()=>state.manual(question.about,value));if(advance)$('question-title').focus();}},{'aria-pressed':String(multiple?selected.has(option.id):answers[question.about]===value),'data-answer':option.id});choices.append(b);}
  wrap.append(choices);if(multiple)wrap.append(confirm);return wrap;
}
function render(){
  const {source,next,result}=state.snapshot(),answers=source.answers;$('local-extract').disabled=!source.text.trim()||busy;
  renderAccount();renderProposals(source);
  $('uses').replaceChildren(...content.steps.find(step=>step.id==='uses').options.map(option=>button(option.label,()=>changed(()=>state.member('uses.'+option.id,!state.snapshot().source.answers.uses.includes(option.id)),`[data-use="${option.id}"]`),{'data-use':option.id,'aria-pressed':String(answers.uses.includes(option.id))})));
  if(!answers.uses.length)$('question').replaceChildren(el('p',{text:'위에서 하고 싶은 일을 고르면 필요한 질문부터 이어 갈게요.'}));
  else if(next.status==='ask'){
    const q=next.questions.find(question=>question.id===next.question.id);$('question').replaceChildren(el('div',{class:'question-card','data-question':q.about},el('h3',{text:q.title}),el('p',{class:'muted',text:next.reason==='required-input-confirmation'?'마무리 전에 필요한 기본 조건을 확인해요.':'필요한 사양을 좁히는 데 도움이 되는 질문이에요.'}),optionPicker(q,answers,{advance:true})));
  }else $('question').replaceChildren(el('p',{text:next.completion.status==='ready'?'필수 조건을 확인했어요. 아래에서 상담 요약을 볼 수 있어요.':'모르는 항목은 임시 조건으로 남겨 두었어요. 확인되면 아래에서 다시 골라 주세요.'}));
  $('answer-editor').replaceChildren(...next.questions.map(q=>el('fieldset',{},el('legend',{text:q.title}),optionPicker(q,answers))));
  $('edit-answers').hidden=!answers.uses.length;
  $('summary-title').textContent=result?result.headline.title:'먼저 용도를 골라 주세요';$('summary-text').textContent=result?state.summary(result):'';
  $('completion').textContent=!result?'':next.completion.status==='ready'?'필수 확인 완료':'아직 임시 조건이 포함된 사양 안내예요';
  $('specs').replaceChildren(...(result?[['램',result.ram.value+'GB'],['저장공간',result.storage.valueText],['그래픽',result.gpu.short]].map(([label,value])=>el('div',{class:'spec'},el('span',{text:label}),el('strong',{text:value}))):[]));
  $('assumptions').replaceChildren(...(result?[...next.completion.assumptions.map(item=>el('li',{text:item.text})),...next.completion.unresolvedRequiredFields.map(id=>el('li',{text:'미확인: '+(next.completion.fields.find(field=>field.id===id)?.title||id)}))]:[]));
  $('shopping-panel').hidden=!result;$('shopping-summary').textContent=result?.prompt||'';
}
async function operation(action){if(busy)return;busy=true;renderAccount();const ownerEpoch=epoch;try{await action(ownerEpoch);}catch(error){if(ownerEpoch!==epoch)return;if(error.status===401||error.status===403){await refreshSession();notice('로그인 상태가 바뀌었어요. 다시 확인해 주세요.');}else if(error.status===409){conflicted=true;notice('다른 화면에서 상담이 바뀌었어요. 저장한 상담을 불러온 뒤 다시 수정해 주세요. 현재 입력은 그대로예요.');}else notice('요청을 완료하지 못했어요. 현재 입력을 유지했으니 다시 시도해 주세요.');}finally{busy=false;renderAccount();}}

async function start(){
  if(document.readyState==='loading')await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
  content=globalThis.SynkComputerContent;if(!content||!globalThis.SynkAsk||!globalThis.SynkAtlasInterpretation||!globalThis.SynkComputerRules)throw Error('missing-modules');
  state=createCustomerComputerState({createInterpretation:createComputerInterpretation,createConsultation:createComputerConsultation,Interpretation:globalThis.SynkAtlasInterpretation,Ask:globalThis.SynkAsk,content,rules:globalThis.SynkComputerRules});host=newHost();
  $('source-text').addEventListener('input',event=>{changed(()=>state.text(event.target.value));});
  $('local-extract').addEventListener('click',()=>{try{changed(()=>state.analyze());notice('원문 인용을 보고 맞는 조건을 확인해 주세요.');}catch{notice('조건을 정리하지 못했어요. 아래에서 직접 골라 주세요.');}});
  $('ai-cancel').addEventListener('click',()=>{cancelAI();render();notice('이 화면에는 AI 응답을 반영하지 않아요. 이미 전송된 요청의 사용량·보관 상태는 서버에서 확인해요.');});
  $('ai-extract').addEventListener('click',async()=>{
    if(aiPending||busy||!host.state().available)return;
    try{if(!aiRetry)aiRetry=host.prepare(state.request());}catch{notice('AI 요청을 준비하지 못했어요.');return;}
    const controller=new AbortController(),generation=++aiGeneration,ownerEpoch=epoch;aiPending=controller;renderAccount();
    try{const result=await host.extract(aiRetry,{signal:controller.signal});if(generation!==aiGeneration||ownerEpoch!==epoch)return;state.ingest(result);aiRetry=null;dirty=true;notice('AI 제안을 확인해 주세요. 확인 전에는 추천에 반영하지 않아요.');await Promise.allSettled([host.refreshPrivacy(),api('computer-interpretation').then(value=>{if(ownerEpoch===epoch)usage=value.usage??usage;})]);}
    catch(error){if(generation!==aiGeneration||ownerEpoch!==epoch)return;if(error.code==='response-removed')aiRetry=null;notice(error.code==='session-required'?'로그인 상태를 다시 확인해 주세요.':'AI 응답을 받지 못했어요. 같은 요청을 다시 확인하거나 직접 조건을 골라 주세요.');if(error.code==='session-required')await refreshSession();}
    finally{if(generation===aiGeneration&&ownerEpoch===epoch){aiPending=null;render();}}
  });
  $('login').addEventListener('click',()=>{if(dirty&&!confirm('로그인 화면으로 이동하면 저장하지 않은 입력은 사라져요. 계속할까요?'))return;operation(async ownerEpoch=>{const value=await api('synk-id/start',{method:'POST'}),url=new URL(value.authorizationUrl);if(url.protocol!=='https:'||url.username||url.password)throw Error('invalid-login-url');if(ownerEpoch===epoch)location.assign(url.href);});});
  $('logout').addEventListener('click',()=>{if(dirty&&!confirm('저장하지 않은 입력을 비우고 로그아웃할까요?'))return;operation(async()=>{cancelAI();await api('logout',{method:'POST'});epoch++;session={authenticated:false,user:null,csrfToken:null,loginAvailable:session.loginAvailable};state.reset();$('source-text').value='';dirty=false;draftRevision=null;draftStatus='unknown';usage=null;host=newHost();render();notice('로그아웃했어요. 현재 화면의 상담 내용도 비웠어요.');});});
  $('save-draft').addEventListener('click',()=>operation(async ownerEpoch=>{const document=state.serialize(),value=await api('computer-draft',{method:'POST',body:{baseRevision:draftRevision,document}});if(ownerEpoch!==epoch)return;rememberDraft(value);dirty=JSON.stringify(document)!==JSON.stringify(state.serialize());notice('내 계정에 상담을 저장했어요.');}));
  $('load-draft').addEventListener('click',()=>{if(dirty&&!confirm('현재 입력 대신 서버에 저장한 상담을 불러올까요?'))return;operation(async ownerEpoch=>{const value=await api('computer-draft');if(ownerEpoch!==epoch)return;if(!validDraft(value))throw Error('invalid-draft');if(value.status!=='active'){rememberDraft(value);conflicted=false;notice('서버에 저장된 상담이 없어요. 현재 입력은 유지했어요.');return;}cancelAI();state.restore(value.document);rememberDraft(value);conflicted=false;$('source-text').value=state.serialize().text;dirty=false;render();notice('저장한 원문과 확인 조건을 불러왔어요.');});});
  $('delete-draft').addEventListener('click',()=>{if(!confirm('서버에 저장한 상담 한 건과 현재 화면의 입력을 삭제할까요? AI 응답은 별도로 삭제할 수 있어요.'))return;operation(async ownerEpoch=>{const value=await api('computer-draft/delete',{method:'POST',body:{baseRevision:draftRevision}});if(ownerEpoch!==epoch)return;rememberDraft(value);cancelAI();state.reset();$('source-text').value='';dirty=false;render();notice('서버 상담과 현재 화면의 입력을 삭제했어요.');});});
  $('delete-ai').addEventListener('click',()=>{if(!confirm('서버에 보관된 내 AI 응답을 삭제할까요? 저장한 상담은 유지돼요.'))return;operation(async ownerEpoch=>{await host.deleteResponses();if(ownerEpoch===epoch)notice('서버에 보관된 내 AI 응답을 삭제했어요.');});});
  $('reset-local').addEventListener('click',()=>{if(!confirm('현재 화면의 입력을 비울까요? 서버에 저장한 상담은 유지돼요.'))return;cancelAI();state.reset();$('source-text').value='';dirty=false;render();notice('현재 화면을 비웠어요.');});
  $('copy-summary').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('shopping-summary').textContent);notice('구매 상담에 쓸 요약을 복사했어요.');}catch{notice('자동 복사를 하지 못했어요. 위 요약을 선택해 복사해 주세요.');}});
  window.addEventListener('focus',()=>{if(!busy&&!aiPending)refreshSession();});window.addEventListener('pageshow',event=>{if(event.persisted)refreshSession();});
  render();await refreshSession();
}
start().catch(()=>{notice('상담 화면을 불러오지 못했어요. 새로고침해 주세요.');$('consultation-app').setAttribute('data-unavailable','true');});
