// Customer consultation page (/consultation/), Signal "one sheet" layout (2026-10-20).
// Session, draft, conflict and AI flows keep the previous page's server contract (10-21: button states after a request,
// the AI answer drawn as soon as it arrives, focus kept after re-drawing, an emptied screen is not an unsaved change).
// Words come from customer-computer-view.mjs. The page CSP forbids style attributes, so nothing here
// writes markup styles; the progress bar width is set through CSSOM.
import {createComputerConsultation} from './consultation.mjs';
import {createComputerInterpretation} from './interpretation.mjs';
import {createComputerModelHost} from './model-host.mjs';
import {createCustomerComputerState} from './customer-computer-state.mjs';
import * as V from './customer-computer-view.mjs';

const C=V.COPY;
const $=id=>document.getElementById(id);
const el=(tag,attrs={},...children)=>{
  const node=document.createElement(tag);
  for(const [key,value] of Object.entries(attrs)){
    if(value===null||value===undefined||value===false)continue;
    if(key==='text')node.textContent=value;else if(key==='class')node.className=value;else node.setAttribute(key,value===true?'':String(value));
  }
  node.append(...children.flat().filter(child=>child!==null&&child!==undefined&&child!==false));
  return node;
};
const SVG='http://www.w3.org/2000/svg';
function checkMark(){
  const svg=document.createElementNS(SVG,'svg'),path=document.createElementNS(SVG,'path');
  svg.setAttribute('viewBox','0 0 16 16');svg.setAttribute('aria-hidden','true');
  for(const [key,value] of Object.entries({d:'M3.5 8.5l3 3 6-7',fill:'none',stroke:'#FFFFFF','stroke-width':'2.2','stroke-linecap':'round','stroke-linejoin':'round'}))path.setAttribute(key,value);
  svg.append(path);return svg;
}
// 「·」로 이은 말(「램·저장공간·그래픽」)은 한 덩어리로 묶어 줄 머리에 「·」가 오지 않게 한다(synk.im keepDots와 같은 규칙).
function keepDots(text){
  const value=String(text??''),out=[];let last=0;
  for(const match of value.matchAll(/[^\s·]+(?:·[^\s·]+)+/gu)){
    if(match.index>last)out.push(value.slice(last,match.index));
    out.push(el('span',{class:'nw',text:match[0]}));last=match.index+match[0].length;
  }
  if(last<value.length)out.push(value.slice(last));
  return out;
}
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
let noticeTimer=null;
function notice(text){
  clearTimeout(noticeTimer);$('notice').textContent=text||'';
  if(text)noticeTimer=setTimeout(()=>{if($('notice').textContent===text)$('notice').textContent='';},9000);
}

let state,content,host,session={authenticated:false,user:null,csrfToken:null,loginAvailable:false},usage=null;
let dirty=false,draftRevision=null,draftStatus='unknown',draftUpdated=null,conflicted=false,busy=false,aiPending=null,aiRetry=null,aiGeneration=0,epoch=0,checking=null,sessionChecked=false;
// 다시 그려도 펼친 채로 두는 칸: 팁·「확인이 더 필요한 문장」 접기와 찾은 조건의 고치기 칸
const openDetails=new Set(),openFix=new Set();
// 같은 글이면 다시 쓰지 않는다(화면 읽기가 상태 줄을 되풀이해 읽지 않게)
const put=(id,text)=>{const node=$(id);if(node.textContent!==text)node.textContent=text;};

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
// 돌려주는 값: AI로 찾기가 진행 중이라 멈췄는지(quiet면 알림은 부른 쪽이 고른다)
function changed(action,focus,quiet){const stopped=!!aiPending;cancelAI();action();dirty=true;render();if(focus)document.querySelector(focus)?.focus({preventScroll:true});if(stopped&&!quiet)notice(C.aiStoppedByEdit);return stopped;}
function validDraft(value){return value&&Number.isSafeInteger(value.revision)&&value.revision>=0&&['empty','active','deleted'].includes(value.status)&&(!value.updatedAt||Number.isFinite(Date.parse(value.updatedAt)))&&(value.status!=='active'||value.document?.version===1);}
function rememberDraft(value){if(!validDraft(value))throw Error('invalid-draft');draftRevision=value.revision;draftStatus=value.status;draftUpdated=value.updatedAt??null;}
async function readDraftMetadata(){const ownerEpoch=epoch;const value=await api('computer-draft');if(ownerEpoch!==epoch)return;if(!validDraft(value))throw Error('invalid-draft');if(draftRevision===null&&!conflicted)rememberDraft(value);}
async function refreshSession(){
  if(checking)return checking;
  checking=(async()=>{
    try{
      const value=await api('me');if(typeof value.authenticated!=='boolean'||typeof value.loginAvailable!=='boolean'||value.authenticated&&(!value.user||typeof value.user.id!=='string'||typeof value.csrfToken!=='string'))throw Error('invalid-session');
      const accountChanged=session.user?.id!==value.user?.id;
      if(accountChanged){epoch++;cancelAI();if(session.user){state.reset();$('source-text').value='';dirty=false;notice(C.accountChanged);}draftRevision=null;draftStatus='unknown';draftUpdated=null;conflicted=false;}
      session={authenticated:value.authenticated,user:value.user,csrfToken:value.csrfToken,loginAvailable:value.loginAvailable};usage=value.ai?.usage??null;host=newHost();sessionChecked=true;
      // 창을 다시 켤 때마다 오는 확인이라, 같은 사람이면 계정·저장 칸만 다시 그린다(카드·질문을 새로 만들면 초점과 고르던 것이 날아간다)
      if(session.authenticated){await host.connect();try{await readDraftMetadata();}catch{notice(C.draftCheckFailed);}}if(accountChanged)render();else renderAccount();
    }catch{
      epoch++;cancelAI();session={...session,authenticated:false,csrfToken:null,loginAvailable:false};host=newHost();sessionChecked=true;render();notice(C.sessionCheckFailed);
    }finally{checking=null;}
  })();return checking;
}
// 골랐다가 다시 지운 할 일은 상태에 「안 함」(false)으로 남는다 — 그것만 있으면 빈 화면이다.
const hasContent=source=>!!source.text.trim()||source.answers.uses.length>0||Object.values(source.manual||{}).some(value=>value!==false&&!(Array.isArray(value)&&!value.length));
// 화면이 비었으면 저장 안 한 변경으로 보지 않는다(골랐다가 다시 지운 경우 — 확인 창·「불러오기」 줄·저장 상태가 같은 기준).
const unsaved=source=>dirty&&hasContent(source);

function renderAccount(){
  const source=state.snapshot().source,connected=host.state(),privacy=host.privacyState();
  // 위 캡슐: 이름 칩 · 로그인 · 로그아웃
  $('me').hidden=!session.authenticated;
  if(session.authenticated){const name=String(session.user.name||'').trim()||'회원';put('me-name',`${name} 님`);put('me-initial',[...name][0]);$('me').title=C.signedIn(name);}
  $('login').hidden=session.authenticated;$('login').disabled=!session.loginAvailable||busy;
  $('logout').hidden=!session.authenticated;$('logout').disabled=busy;
  $('poster-chip').hidden=session.authenticated;
  // 02 찾기 단추: 서버 요청이 끝나면 renderAccount만 다시 돌아서, 둘 다 여기서 정한다
  $('local-extract').disabled=!source.text.trim()||busy;
  // 오늘 횟수를 다 쓰면 단추를 끄고, 동의 문장 대신 언제 다시 채워지는지만 보인다
  const exhausted=V.aiExhausted(usage);
  $('ai-extract').disabled=!connected.available||exhausted||!source.text.trim()||!!aiPending||busy;
  put('ai-extract',aiRetry&&!aiPending&&!exhausted?C.findAIRetry:C.findAI);$('ai-cancel').hidden=!aiPending;
  put('ai-status',aiPending?C.aiWorking:connected.available?(exhausted?V.usageText(usage):[C.aiConsent,V.usageText(usage)].filter(Boolean).join(' ')):!sessionChecked?'':session.authenticated||!session.loginAvailable?C.aiUnavailable:C.aiNeedsLogin);
  // 04 저장: 로그인 전에는 한 줄, 로그인 뒤에는 저장 판
  $('save-out').hidden=session.authenticated;$('save-in').hidden=!session.authenticated;
  put('save-out-text',!sessionChecked?C.checkingLogin:session.loginAvailable?C.saveLoggedOut:C.loginPreparing);
  $('save-login').disabled=!session.loginAvailable||busy;
  if(session.authenticated){
    const status=V.draftStatus({authenticated:true,revision:draftRevision,status:draftStatus,updatedAt:draftUpdated,dirty:unsaved(source)});
    put('draft-head',conflicted?C.conflictHead:status.head);
    put('draft-status',conflicted?C.conflictLine:status.line);$('draft-status').className='led '+(conflicted?'check':status.state);
  }
  const canManage=session.authenticated&&draftRevision!==null&&!busy&&!conflicted;
  $('save-draft').disabled=!canManage||!!aiPending||!source.text.trim()&&!source.answers.uses.length;
  $('load-draft').disabled=!session.authenticated||busy||draftStatus!=='active'&&!conflicted;
  $('delete-draft').disabled=!canManage||draftStatus!=='active';
  $('delete-ai').disabled=!privacy.canDelete||busy||!!aiPending;
  put('privacy-status',V.privacyText(privacy));put('privacy-count',V.privacyCount(privacy));
  $('reset-local').hidden=!hasContent(source);$('reset-local').disabled=busy;
  // 저장한 상담이 있고 화면이 비었을 때만 머리 아래 「불러오기」 한 줄
  const resume=session.authenticated&&draftStatus==='active'&&!conflicted&&!hasContent(source);
  $('resume').hidden=!resume;if(resume)put('resume-text',C.resumeHas(V.dateText(draftUpdated)));$('resume-load').disabled=busy;
}

function renderUses(source){
  const answers=source.answers,step=content.steps.find(item=>item.id==='uses');
  $('uses-list').replaceChildren(...step.options.map(option=>{
    const button=el('button',{type:'button',class:'opt','aria-pressed':String(answers.uses.includes(option.id)),'data-use':option.id},
      el('span',{},el('strong',{},keepDots(option.label)),option.sub?el('small',{},keepDots(option.sub)):null),el('span',{class:'mark'},checkMark()));
    button.addEventListener('click',()=>changed(()=>state.member('uses.'+option.id,!state.snapshot().source.answers.uses.includes(option.id)),`[data-use="${option.id}"]`));
    return button;
  }));
  $('start-here').hidden=hasContent(source);
}

// 누른 줄을 다시 그린 뒤에도 키보드 초점은 그 줄의 첫 단추에 남긴다.
function reviewProposal(id,action,value){openFix.delete(id);try{changed(()=>state.review(id,action,value),`[data-proposal="${CSS.escape(id)}"] button:not(:disabled)`);}catch{notice(C.reviewFailed);}}
function proposalRow(proposal,source){
  const field=state.catalog().fields.find(item=>item.id===proposal.field),effective=source.understanding.fields.find(item=>item.id===field.id);
  const active=!!proposal.review&&effective.usable&&effective.evidence.includes('i.'+proposal.review.id);
  const manual=Object.hasOwn(source.manual,field.id)||Object.hasOwn(source.manual,field.about);
  const excluded=!active&&['reject','withdraw'].includes(proposal.review?.action);
  const status=V.proposalStatus({manual,active,action:proposal.review?.action}),shown=V.proposalDisplay(field,active?effective.value:proposal.value);
  const select=el('select',{'aria-label':C.correctLabel(shown.label)},field.options.map((option,index)=>el('option',{value:String(index),text:option.label})));
  select.value=String(Math.max(0,field.options.findIndex(option=>option.id===(active?effective.value:proposal.value))));
  const apply=el('button',{type:'button',class:'btn soft small',text:C.correctTo,'data-act':'apply'});apply.addEventListener('click',()=>reviewProposal(proposal.id,'correct',field.options[Number(select.value)].id));
  const fix=el('div',{class:'fix',hidden:manual||!openFix.has(proposal.id)},select,apply);
  const acts=el('div',{class:'acts'});
  // 03에서 직접 고른 답이 있으면 「맞아요」는 아무것도 바꾸지 못해 두지 않는다(상태 줄이 「직접 고른 답이 먼저예요」)
  if(!active&&!manual&&proposal.status==='pending'){const confirm=el('button',{type:'button',class:'btn soft small',text:C.confirm,'aria-label':`${shown.label} ${C.confirm}`,'data-act':'confirm'});confirm.addEventListener('click',()=>reviewProposal(proposal.id,'confirm'));acts.append(confirm);}
  const correct=el('button',{type:'button',class:'btn soft small',text:C.correct,'aria-label':`${shown.label} ${C.correct}`,'aria-expanded':String(!fix.hidden),'data-act':'correct'});
  correct.disabled=proposal.reasons.some(reason=>['other-subject','source-excluded','source-expired','future-source'].includes(reason));
  correct.addEventListener('click',()=>{fix.hidden=!fix.hidden;correct.setAttribute('aria-expanded',String(!fix.hidden));fix.hidden?openFix.delete(proposal.id):openFix.add(proposal.id);if(!fix.hidden)select.focus();});
  // 고치기도 직접 고른 답을 바꾸지 못한다 — 직접 고른 답은 「확인한 조건 다시 고르기」에서 바꾼다
  if(!manual)acts.append(correct);
  if(!excluded){const exclude=el('button',{type:'button',class:'btn soft small',text:C.exclude,'aria-label':`${shown.label} ${C.exclude}`,'data-act':'exclude'});exclude.addEventListener('click',()=>reviewProposal(proposal.id,active?'withdraw':'reject'));acts.append(exclude);}
  return el('li',{class:'prop','data-proposal':proposal.id},
    el('p',{class:'what'},el('span',{},keepDots(shown.label)),el('span',{class:'val'},keepDots(shown.value)),el('span',{class:'led '+status.state,text:status.text})),acts,fix);
}
function renderFound(source){
  const box=$('found');
  if(!source.mode){box.replaceChildren(...(source.text.trim()?[el('p',{class:'found-idle',text:C.foundIdle})]:[]));return;}
  const parts=[];
  if(!source.proposals.length)parts.push(el('p',{class:'found-idle',text:C.foundLocalNone}));
  else{
    parts.push(el('p',{class:'found-head'},el('b',{text:C.foundHead(source.proposals.length)}),el('span',{text:C.foundNote})));
    for(const group of V.groupByQuote(source.proposals))parts.push(el('div',{class:'pgroup'},group.quote?el('q',{text:group.quote}):null,el('ul',{class:'props'},group.items.map(proposal=>proposalRow(proposal,source)))));
  }
  if(source.held.length)parts.push(keepOpen(el('details',{class:'held'},el('summary',{text:C.heldHead(source.held.length)}),el('p',{text:C.heldNote}),el('ul',{},source.held.map(item=>el('li',{text:'“'+item.quote+'”'})))),'held'));
  box.replaceChildren(...parts);
}

function meter(known,total){
  const fill=el('i'),bar=el('span',{class:'meter',role:'progressbar','aria-label':C.progressLabel,'aria-valuemin':'0','aria-valuemax':String(total),'aria-valuenow':String(known)},fill);
  fill.style.width=(total?Math.round(known/total*100):0)+'%';
  return bar;
}
function focusQuestion(){
  const title=$('question-title');if(!title)return;
  title.focus({preventScroll:true});
  const card=title.closest('.askcard'),top=card.getBoundingClientRect().top;
  if(top<80||top>innerHeight*.7)card.scrollIntoView({block:'start',behavior:reduced()?'auto':'smooth'});
}
function optionPicker(question,answers,{advance=false,inCard=false}={}){
  const multiple=question.selection==='multiple',options=question.displayOptions||question.options;
  const selected=new Set(multiple&&Array.isArray(answers[question.about])?answers[question.about]:[]);
  // 「다시 고르기」 칸은 누른 뒤 통째로 다시 그려진다 — 초점을 같은 칸의 같은 단추로 되돌린다(질문 카드는 다음 질문 제목으로 간다)
  const keep=inCard?()=>undefined:selector=>`#answer-editor [data-about="${CSS.escape(question.about)}"] ${selector}`;
  const confirm=el('button',{type:'button',class:'btn soft confirm',text:C.multiConfirm});
  confirm.disabled=!selected.size;
  confirm.addEventListener('click',()=>{changed(()=>state.manual(question.about,options.filter(option=>selected.has(option.id)).map(option=>option.id)),keep('.confirm'));if(advance)focusQuestion();});
  const buttons=options.map(option=>{
    const value=option.value??option.id,pressed=multiple?selected.has(option.id):answers[question.about]===value;
    const button=inCard
      ?el('button',{type:'button',class:'opt'+(multiple?'':' one'),'aria-pressed':String(pressed),'data-answer':option.id},el('span',{},el('strong',{},keepDots(option.label))),el('span',{class:'mark'},checkMark()))
      :el('button',{type:'button',class:'chip','aria-pressed':String(pressed),'data-answer':option.id},keepDots(option.label));
    button.addEventListener('click',()=>{
      if(multiple){selected.has(option.id)?selected.delete(option.id):selected.add(option.id);button.setAttribute('aria-pressed',String(selected.has(option.id)));confirm.disabled=!selected.size;}
      else{changed(()=>state.manual(question.about,value),keep(`[data-answer="${CSS.escape(option.id)}"]`));if(advance)focusQuestion();}
    });
    return button;
  });
  const list=el('div',{class:inCard?(multiple?'opts':'opts one'):'chips'},buttons);
  return el('div',{},multiple&&inCard?el('p',{class:'multi-hint',text:C.multiHint}):null,list,multiple?confirm:null);
}
function renderQuestion(next,answers){
  const box=$('question');
  if(!answers.uses.length){box.replaceChildren(el('p',{class:'empty-note',text:C.askEmpty}));return;}
  const {known,total}=V.progressCount(next.completion);
  if(next.status==='ask'){
    const question=next.questions.find(item=>item.id===next.question.id),art=V.questionArt(question),tip=V.questionTip(content,question);
    // 세로로 긴 물건 그림(키가 폭의 0.8배 넘음)은 휴대폰에서 제목 첫 줄을 비켜 간다(CSS .tall-art)
    box.replaceChildren(el('div',{class:'askcard'+(art&&art.height>art.width*.8?' tall-art':''),'data-question':question.about},
      art?el('img',{class:'art',src:art.src,alt:'',width:art.width,height:art.height}):null,
      el('div',{class:'top'},meter(known,total),el('span',{class:'mono-label',text:`${known} / ${total}`})),
      next.reason==='required-input-confirmation'?el('p',{class:'need'},el('span',{class:'led check',text:C.required})):null,
      el('h3',{id:'question-title',tabindex:'-1',text:V.questionText(content,question)}),
      el('p',{class:'q-sub',text:V.questionLead(content,question)}),
      optionPicker(question,answers,{advance:true,inCard:true}),
      tip?keepOpen(el('details',{class:'tipline'},el('summary',{text:`${C.tip} · ${tip.title}`}),tip.body.map(line=>el('p',{},keepDots(line)))),'tip:'+question.about):null));
    return;
  }
  const ready=next.completion.status==='ready';
  box.replaceChildren(el('div',{class:'askcard done'},
    el('div',{class:'top'},meter(known,total),el('span',{class:'mono-label',text:`${known} / ${total}`})),
    el('h3',{id:'question-title',tabindex:'-1',text:ready?C.doneReady:C.doneProvisional}),
    el('p',{class:'q-sub',text:ready?C.doneReadySub:C.doneProvisionalSub})));
}
function renderEditor(next,answers){
  $('edit-answers').hidden=!answers.uses.length;
  $('answer-editor').replaceChildren(...next.questions.map(question=>el('fieldset',{'data-about':question.about},el('legend',{text:V.fieldLabel(question.about,question.title)}),optionPicker(question,answers))));
}

function renderSummary(next,result){
  const has=!!result;
  $('poster').hidden=has;$('waitcard').hidden=has;$('summary').hidden=!has;
  if(!has)return;
  const ready=next.completion.status==='ready';
  $('completion').textContent=ready?C.chipReady:C.chipProvisional;$('completion').className='led-chip'+(ready?'':' check');
  const parts=V.headlineParts(result.headline.title).flatMap((part,index)=>[index?el('span',{class:'sep',text:' · '}):null,el('span',{class:'part'},part.main,part.aside?el('small',{},keepDots(part.aside)):null)]);
  $('summary-title').replaceChildren(el('span',{class:'sr',text:C.summaryTitle+': '}),...parts.filter(Boolean));
  $('summary-text').replaceChildren(...keepDots(result.headline.sub));
  $('specs').replaceChildren(...V.readout(result).map(cell=>el('li',{},el('b',{text:cell.label}),el('em',{text:cell.value}),cell.sub?el('small',{text:cell.sub}):null)));
  const unresolved=V.unresolvedText(next.completion.unresolvedRequiredFields);
  $('assumptions').replaceChildren(
    ...V.summaryItems(result).map(text=>el('li',{},keepDots(text))),
    ...(unresolved?[el('li',{class:'assume',text:unresolved})]:[]),
    ...next.completion.assumptions.map(item=>el('li',{class:'assume'},keepDots(V.assumptionText(item)))));
  $('copy-summary').textContent=ready?C.copy:C.copyProvisional;$('copy-summary').className='btn '+(ready?'primary':'soft');
  $('shopping-summary').textContent=result.prompt||'';
  $('dock-line').textContent=V.dockLine(result);
}
// 아래 막대: 결과가 있고 요약 판이 화면 밖일 때만(한 칸 폭). 흰 알약이 한 화면에 둘이 되지 않는다.
let summaryInView=false;
function updateDock(){
  const show=!$('summary').hidden&&!summaryInView;
  $('dock').hidden=!show;
  document.body.classList.toggle('has-dock',show&&matchMedia('(max-width:1100px)').matches);
}

// 펼친 접기 칸은 다시 그려도 펼친 채로(열고 닫을 때마다 기억)
function keepOpen(details,key){details.open=openDetails.has(key);details.addEventListener('toggle',()=>{details.open?openDetails.add(key):openDetails.delete(key);});return details;}
// 다시 그리는 칸(01 카드·찾은 조건·질문 카드·다시 고르기) 안에 있던 초점의 자리. 다시 그린 뒤 같은 자리의 새 단추로 돌려놓는다.
function focusKey(node){
  if(!node||node===document.body||!node.closest)return null;
  const use=node.closest('[data-use]');if(use)return `[data-use="${CSS.escape(use.dataset.use)}"]`;
  const row=node.closest('[data-proposal]');
  if(row){const at=`[data-proposal="${CSS.escape(row.dataset.proposal)}"]`;return node.dataset.act?`${at} [data-act="${node.dataset.act}"]`:node.tagName==='SELECT'?`${at} select`:`${at} button:not(:disabled)`;}
  const field=node.closest('#answer-editor [data-about]');
  if(field){const at=`#answer-editor [data-about="${CSS.escape(field.dataset.about)}"]`;return node.dataset.answer?`${at} [data-answer="${CSS.escape(node.dataset.answer)}"]`:node.classList.contains('confirm')?`${at} .confirm`:null;}
  if(node.closest('#question')){
    if(node.dataset.answer)return `#question [data-answer="${CSS.escape(node.dataset.answer)}"]`;
    if(node.classList.contains('confirm'))return '#question .confirm';
    if(node.id==='question-title')return '#question-title';
    if(node.closest('.tipline'))return '#question .tipline summary';
  }
  if(node.closest('#found .held'))return '#found .held summary';
  return null;
}

function render(){
  const key=focusKey(document.activeElement);
  const {source,next,result}=state.snapshot(),answers=source.answers;
  $('text-count').textContent=V.textCount(source.text.length);
  renderAccount();renderUses(source);renderFound(source);renderQuestion(next,answers);renderEditor(next,answers);renderSummary(next,result);updateDock();
  if(key&&(!document.activeElement||document.activeElement===document.body))document.querySelector(key)?.focus({preventScroll:true});
}
// 401·403 뒤 로그인 확인에서 계정이 바뀌었거나 확인이 실패했으면(epoch가 오름) 그쪽 알림이 이미 떴으니 덮지 않는다.
async function operation(action){if(busy)return;busy=true;renderAccount();const ownerEpoch=epoch;try{await action(ownerEpoch);}catch(error){if(ownerEpoch!==epoch)return;if(error.status===401||error.status===403){await refreshSession();if(epoch===ownerEpoch)notice(C.sessionChanged);}else if(error.status===409){conflicted=true;notice(C.conflict);}else notice(C.requestFailed);}finally{busy=false;renderAccount();}}

async function start(){
  if(document.readyState==='loading')await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
  content=globalThis.SynkComputerContent;if(!content||!globalThis.SynkAsk||!globalThis.SynkAtlasInterpretation||!globalThis.SynkComputerRules)throw Error('missing-modules');
  state=createCustomerComputerState({createInterpretation:createComputerInterpretation,createConsultation:createComputerConsultation,Interpretation:globalThis.SynkAtlasInterpretation,Ask:globalThis.SynkAsk,content,rules:globalThis.SynkComputerRules});host=newHost();
  // 로그인 콜백이 실패하면 서버가 ?login=failed로 돌려보낸다.
  if(new URLSearchParams(location.search).get('login')==='failed'){notice(C.loginFailed);history.replaceState(null,'',location.pathname+location.hash);}
  $('source-text').addEventListener('input',event=>{changed(()=>state.text(event.target.value));});
  $('local-extract').addEventListener('click',()=>{try{const stopped=changed(()=>state.analyze(),null,true),found=state.snapshot().source.proposals.length;notice(stopped?(found?C.foundLocalAfterStop:C.foundLocalNoneAfterStop):(found?C.foundLocal:C.foundLocalNone));}catch{notice(C.findFailed);}});
  // 그만두기 단추는 누르면 사라지니 초점은 「AI로 찾기」(꺼져 있으면 글 칸)로
  $('ai-cancel').addEventListener('click',()=>{cancelAI();render();notice(C.aiCancelled);($('ai-extract').disabled?$('source-text'):$('ai-extract')).focus({preventScroll:true});});
  $('ai-extract').addEventListener('click',async()=>{
    if(aiPending||busy||!host.state().available)return;
    try{if(!aiRetry)aiRetry=host.prepare(state.request());}catch{notice(C.aiPrepareFailed);return;}
    const controller=new AbortController(),generation=++aiGeneration,ownerEpoch=epoch;aiPending=controller;renderAccount();
    // 답을 받으면 곧바로 그린다(보관 개수·남은 횟수는 그 뒤에 따로 새로 받아 위 칸만 고친다). 찾은 조건이 없으면 그렇다고 알린다.
    try{const result=await host.extract(aiRetry,{signal:controller.signal});if(generation!==aiGeneration||ownerEpoch!==epoch)return;state.ingest(result);aiRetry=null;dirty=true;aiPending=null;render();
      notice(state.snapshot().source.proposals.length?C.aiFound:C.foundLocalNone);
      await Promise.allSettled([host.refreshPrivacy(),api('computer-interpretation').then(value=>{if(ownerEpoch===epoch)usage=value.usage??usage;})]);
      if(generation===aiGeneration&&ownerEpoch===epoch)renderAccount();}
    catch(error){if(generation!==aiGeneration||ownerEpoch!==epoch)return;if(error.code==='response-removed')aiRetry=null;
      if(error.code==='session-required'){notice(C.aiSessionRequired);await refreshSession();return;}
      // 하루 횟수를 다 써서 막혔을 수 있다(다른 창에서 썼거나 그만둔 요청도 센다) — 남은 횟수를 새로 받아 알림을 고른다
      await api('computer-interpretation').then(value=>{if(ownerEpoch===epoch)usage=value.usage??usage;}).catch(()=>{});
      if(generation!==aiGeneration||ownerEpoch!==epoch)return;
      notice(V.aiExhausted(usage)?C.aiLimitReached:C.aiFailed);}
    finally{if(generation===aiGeneration&&ownerEpoch===epoch&&aiPending===controller){aiPending=null;render();}}
  });
  const login=()=>{if(unsaved(state.snapshot().source)&&!confirm(C.confirmLogin))return;operation(async ownerEpoch=>{const value=await api('synk-id/start',{method:'POST'}),url=new URL(value.authorizationUrl);if(url.protocol!=='https:'||url.username||url.password)throw Error('invalid-login-url');if(ownerEpoch===epoch)location.assign(url.href);});};
  $('login').addEventListener('click',login);$('save-login').addEventListener('click',login);
  $('logout').addEventListener('click',()=>{if(unsaved(state.snapshot().source)&&!confirm(C.confirmLogout))return;operation(async()=>{cancelAI();await api('logout',{method:'POST'});epoch++;session={authenticated:false,user:null,csrfToken:null,loginAvailable:session.loginAvailable};state.reset();$('source-text').value='';dirty=false;draftRevision=null;draftStatus='unknown';draftUpdated=null;conflicted=false;usage=null;host=newHost();render();notice(C.loggedOut);});});
  $('save-draft').addEventListener('click',()=>operation(async ownerEpoch=>{const document=state.serialize(),value=await api('computer-draft',{method:'POST',body:{baseRevision:draftRevision,document}});if(ownerEpoch!==epoch)return;rememberDraft(value);dirty=JSON.stringify(document)!==JSON.stringify(state.serialize());notice(C.saved);}));
  const load=()=>{if(unsaved(state.snapshot().source)&&!confirm(C.confirmLoad))return;operation(async ownerEpoch=>{const value=await api('computer-draft');if(ownerEpoch!==epoch)return;if(!validDraft(value))throw Error('invalid-draft');if(value.status!=='active'){rememberDraft(value);conflicted=false;notice(C.loadNone);return;}cancelAI();state.restore(value.document);rememberDraft(value);conflicted=false;$('source-text').value=state.serialize().text;dirty=false;render();notice(C.loaded);});};
  $('load-draft').addEventListener('click',load);$('resume-load').addEventListener('click',load);
  $('delete-draft').addEventListener('click',()=>{if(!confirm(C.confirmRemove))return;operation(async ownerEpoch=>{const value=await api('computer-draft/delete',{method:'POST',body:{baseRevision:draftRevision}});if(ownerEpoch!==epoch)return;rememberDraft(value);cancelAI();state.reset();$('source-text').value='';dirty=false;render();notice(C.removed);});});
  $('delete-ai').addEventListener('click',()=>{if(!confirm(C.confirmRemoveAI))return;operation(async ownerEpoch=>{await host.deleteResponses();if(ownerEpoch===epoch)notice(C.removedAI);});});
  $('reset-local').addEventListener('click',()=>{if(!confirm(C.confirmReset))return;cancelAI();state.reset();$('source-text').value='';dirty=false;render();notice(C.resetDone);});
  $('copy-summary').addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText($('shopping-summary').textContent);notice(C.copied);}
    catch{$('shopping-panel').open=true;const range=document.createRange();range.selectNodeContents($('shopping-summary'));const selection=getSelection();selection.removeAllRanges();selection.addRange(range);notice(C.copyBlocked);}
  });
  if('IntersectionObserver' in window)new IntersectionObserver(entries=>{for(const entry of entries)summaryInView=entry.isIntersecting;updateDock();},{threshold:.15}).observe($('summary'));
  matchMedia('(max-width:1100px)').addEventListener?.('change',updateDock);
  window.addEventListener('focus',()=>{if(!busy&&!aiPending)refreshSession();});window.addEventListener('pageshow',event=>{if(event.persisted)refreshSession();});
  render();await refreshSession();
}
start().catch(()=>{notice(C.failedToStart);$('consultation-app').setAttribute('data-unavailable','true');});
