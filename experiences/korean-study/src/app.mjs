// 한국어 공부(synk.im/study/) 화면. 한 번에 장면 하나(README §2) — 무엇을 할지는 tutor.mjs의 next()가 정하고 학생은 답하기·계속·쉬기만 한다.
// · WORLD 세션·캐릭터·재화·계정 모듈을 부르지 않는다. 받는 것은 같은 출처 정적 파일(items.json·study.json)뿐이고 보내는 것은 없다.
// · 기록은 이 기기 localStorage `synk.study.v2:<owner>`(옛 v1 칸은 읽어 옮기기만 하고 지우지 않는다). 학생 글은 drafts에만 두고 고쳐 넣지 않는다.
// · 장면이 정해질 때마다 Trail decision.made, 답마다 presented →(helped)→ attempted 사건을 남긴다(tutor.mjs record*).
import {readState,migrate,addObs,markSeen,observeWrite,next,gradeForm,gradeFind,checkChange,storeKey,legacyKey,sentencesOf,endingOf,recordDecision,recordWrite,recordSort,recordForm,checkCard,trailRows} from './tutor.mjs';
import {drillPool} from '../../synk-world-app/world-writing-focus.mjs';
import {makeT,chooseLang,LANGS,LANG_NAMES,LANG_KEY} from './copy.mjs';
import {createFeedbackClient} from './feedback-client.mjs';
import {readSemantic,recordSemantic,semanticNext} from './semantic.mjs';

/* global __ITEMS_TOKEN__ */
const TOKEN=typeof __ITEMS_TOKEN__==='string'?__ITEMS_TOKEN__:'dev';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const FORM_ROWS=[['verb','증가한다 · 늘어난다'],['adj','많다'],['noun','-이다'],['past','조사했다 · 증가했다']];
const BIN_FORM={formal:'-습니다',polite:'-아요',plain:'-다'};

// 이 기기의 손님 칸. 「처음부터 하기」는 앞 사람 기록을 지우지 않고 새 칸으로 비켜 간다(공용 기기에서 남의 기록을 지우지 않게).
const SLOT_KEY='synk.study.slot';
export const deviceSlot=(storage=globalThis.localStorage)=>{try{const v=storage?.getItem(SLOT_KEY);return v&&/^guest(-[a-z0-9]{1,16})?$/.test(v)?v:'guest';}catch{return 'guest';}};
// 고쳐 쓰기 초안은 자료 초안과 따로 둔다(처음 쓴 글은 그대로 남는다).
const draftKey=sc=>sc.mode==='revise'?`r:${sc.itemId}`:sc.itemId;
export function createStudy({root,storage=globalThis.localStorage,session=globalThis.sessionStorage,fetcher=(...a)=>globalThis.fetch(...a),now=Date.now,owner=()=>deviceSlot(storage),confirm=m=>globalThis.confirm?.(m)??true,base=new URL('./',import.meta.url),feedback}={}){
 if(feedback===undefined)feedback=createFeedbackClient({storage:session,fetcher,base,now});
 const getOwner=()=>{const account=feedback?.owner?.();if(!account)return owner();try{const v=storage.getItem(`${SLOT_KEY}.${account}`);return v?.startsWith(`${account}-`)&&/^[a-zA-Z0-9_-]{1,80}$/.test(v)?v:account;}catch{return account;}};
 let lang=chooseLang({storage}),t=makeT(lang),bank=null,who=getOwner(),legacy=null,state=load(),saveFailed=false,ui={},semanticSeq=0;
 const aiReady=()=>{const s=feedback?.status?.();return s?.connected&&s.enabled&&s.studyVersion===1&&s.bankHash===bank?.sourceHash;};
 // v2 칸이 있으면 그대로(읽을 수 없게 깨졌어도 「있음」으로 보고 옛 칸을 다시 옮기지 않는다 — Fable 설계 P3-11). 없을 때만 v1을 문항을 받은 뒤 옮긴다.
 function load(){
  legacy=null;let raw=null;
  try{raw=storage.getItem(storeKey(who));}catch{}
  if(raw!=null){try{return readState(JSON.parse(raw),{now:now()});}catch{return readState(null);}}
  try{const old=JSON.parse(storage.getItem(legacyKey(who))||'null');if(old&&old.v===1)legacy=old;}catch{}
  return readState(null);
 }
 function save(){try{storage.setItem(storeKey(who),JSON.stringify(state));saveFailed=false;}catch{saveFailed=true;}}
 const iso=()=>new Date(now()).toISOString();
 const record=o=>{state=addObs(state,o,{now:now()});};
 const setScene=scene=>{state={...state,scene};ui={};save();paint();};
 const items=()=>[...bank.open53,...bank.open54];
 const item=id=>items().find(i=>i.id===id)||null,form=id=>bank.forms.find(f=>f.id===id),find=id=>bank.finds.find(f=>f.id===id),card=key=>bank.pool.find(c=>c.key===key);
 // 계정이 바뀌면(지금은 guest 하나뿐이지만 같은 자리) 앞 사람의 화면 상태를 버리고 그 계정 기록을 새로 읽는다.
 function syncOwner(){const n=getOwner();if(n!==who){semanticSeq++;who=n;state=load();if(legacy&&bank){state=migrate(legacy,{now:now(),pool:bank.pool});legacy=null;}ui={resume:!!(state.obs.length||Object.values(state.drafts).some(d=>d.text.trim()))};}}
 const decide=()=>next(state,bank,{now:now(),seed:Math.floor(now()/60000)});
 // 저장된 장면이 지금 재고로 그릴 수 있는가(문항이 내려갔거나 값이 깨졌으면 다시 정한다 — 빈 화면 방지, 루트 R3).
 const ids=(list,has)=>Array.isArray(list)&&list.length>0&&list.every(k=>typeof k==='string'&&has(k));
 function sceneValid(sc){if(!sc||typeof sc!=='object')return false;const i=sc.i??0;if(!Number.isInteger(i)||i<0)return false;
  if(sc.id==='write')return !!item(sc.itemId)&&[0,1,2].includes(sc.support)&&['edit','self'].includes(sc.phase)&&['new','revise'].includes(sc.mode??'new');
  if(sc.id==='seen')return !!item(sc.itemId)&&!!sc.facts&&Number.isInteger(sc.facts.total);
  if(sc.id==='probe')return sc.probe==='distinguish'?ids(sc.cards,card)&&i<sc.cards.length:sc.probe==='form'?ids(sc.forms,form)&&i<sc.forms.length:false;
  if(sc.id==='method'){if(sc.method==='contrast')return ids(sc.cards,card)&&i<sc.cards.length;if(sc.method==='forms')return ids(sc.forms,form)&&i<sc.forms.length;return sc.method==='apply'&&(sc.find==null||!!find(sc.find))&&[0,1].includes(sc.step??0);}
  if(sc.id==='semantic'){try{if(!item(sc.itemId)||sc.bankHash!==bank.sourceHash||!['check','help','practice','result'].includes(sc.phase)||state.drafts[sc.draft]?.checkedAt!==sc.checkedAt)return false;const f=readSemantic(sc.feedback,state.drafts[sc.draft]?.text);if((f.status==='focus')===(sc.phase==='result'))return false;return sc.pick==null||(['check','practice'].includes(sc.phase)&&['a','b'].includes(sc.pick));}catch{return false;}}
  return sc.id==='rest';}
 const toScene=n=>n.scene==='write'?{id:'write',itemId:n.itemId,support:n.support,mode:n.mode||'new',why:n.why,phase:'edit'}:n.scene==='probe'?{id:'probe',probe:n.probe,cards:n.cards||[],forms:n.forms||[],i:0}:n.scene==='method'?{id:'method',method:n.method,cards:n.cards||[],forms:n.forms||[],find:n.find||null,mineFrom:n.mineFrom||null,step:0,i:0}:{id:'rest',why:n.why};
 // D1 소개 예시: 바구니마다 연습 몫의 카드 하나(확인 몫은 보이지 않는다). 보인 카드는 본 것으로 둔다.
 const examples=sc=>['formal','polite','plain'].map(b=>bank.pool.find(c=>c.bin===b&&!checkCard(c)&&!sc.cards.includes(c.key))).filter(Boolean);

 // ── 그리기 ──
 function shell(body){
  return `<header class="st-top"><p class="st-brand">SYNK</p><h1>${esc(t('study.title'))}</h1><label class="st-lang"><span>${esc(t('study.lang'))}</span><select data-st-lang>${LANGS.map(l=>`<option value="${l}" ${l===lang?'selected':''}>${esc(LANG_NAMES[l])}</option>`).join('')}</select></label></header>`
   +(saveFailed?`<p class="st-alert" role="alert">${esc(t('study.saveFail'))}</p>`:'')
   +`<div class="st-ai-connect"><p class="st-note">${esc(t(feedback?.status?.().connected?(aiReady()?'ai.connected':'ai.notReady'):'ai.connectNote'))}</p><button class="st-quiet" ${feedback?.status?.().connected?'data-st-disconnect':'data-st-connect'}>${esc(t(feedback?.status?.().connected?'ai.disconnect':'ai.connect'))}</button></div>`
   +(ui.loginError?`<p class="st-alert" role="alert">${esc(t('ai.loginError'))}</p>`:'')
   +(ui.authLost?`<p class="st-alert" role="alert">${esc(t('ai.expired'))}</p>`:'')
   +`<section class="st-scene" aria-live="polite" ${ui.reading?'aria-busy="true"':''}>${body}</section>`
   +`<footer class="st-foot"><p>${esc(t('study.lead'))}</p><p>${esc(t('study.device'))}</p></footer>`;
 }
 const actions=(main,{stop=true}={})=>`<div class="st-actions">${main}${stop?`<button class="st-quiet" data-st-stop>${esc(t('study.stop'))}</button>`:''}</div>`;
 const dataHtml=data=>`<div class="st-data" lang="ko">${data.source?`<p class="st-source">${esc(data.source)}</p>`:''}${(data.tables||[]).map(tb=>`<table><caption>${esc(tb.caption)}</caption><thead><tr>${tb.columns.map(c=>`<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>${tb.rows.map(r=>`<tr>${r.map((c,i)=>i?`<td>${esc(c)}</td>`:`<th scope="row">${esc(c)}</th>`).join('')}</tr>`).join('')}</tbody></table>`).join('')}${(data.lists||[]).map(l=>`<div class="st-list"><strong>${esc(l.caption)}</strong><ul>${l.items.map(i=>`<li>${esc(i)}</li>`).join('')}</ul></div>`).join('')}</div>`;
 // 54번: 주제와 질문만(예시답은 빌드가 빼서 오지 않는다). 시험의 600~700자 대신 글의 첫 부분 세 문장.
 const promptHtml=it=>`<div class="st-data" lang="ko"><p>${esc(it.prompt)}</p>${(it.questions||[]).length?`<ul>${it.questions.map(q=>`<li>${esc(q)}</li>`).join('')}</ul>`:''}</div>`;
 const formsTable=()=>`<dl class="st-forms">${FORM_ROWS.map(([k,ko])=>`<div><dt>${esc(t(`writing.focus.method.${k}`))}</dt><dd lang="ko">${esc(ko)}</dd></div>`).join('')}</dl><p class="st-note">${esc(t('writing.focus.method.watch'))} <span lang="ko">많는다 · 증가하다.</span></p>`;
 // 고칠 문장: 틀린 끝이 있으면 그것, 없으면 확인하지 못한 끝(아르곤 A1).
 // 「내 문장 바꿔 보기」가 볼 마지막 점검 글(고쳐 쓴 글을 점검했으면 그것) — 이미 고친 문장을 다시 고치라고 하지 않게(Fable 최종 F2).
 const lastText=id=>{const r=state.drafts[`r:${id}`],o=state.drafts[id];return (r?.checkedAt&&(!o?.checkedAt||r.checkedAt>=o.checkedAt)?r.text:o?.text)||'';};
 const marksOf=(text,it)=>{const o=observeWrite(text,it);return o?([...o.offSentences,...o.flagged].length?[...o.offSentences,...o.flagged]:o.unknown):sentencesOf(text).filter(s=>['formal','polite'].includes(endingOf(s.text))).map(s=>s.text);};
 function writeHtml(sc){
  const it=item(sc.itemId);if(!it)return restHtml({why:'no-items'});
  const key=draftKey(sc),text=state.drafts[key]?.text||'',marks=sc.semantic?(sc.quote&&text.includes(sc.quote)?[sc.quote]:[]):sc.mode==='revise'?marksOf(text,it).slice(0,6):[];
  // 표시할 문장이 없는 고쳐 쓰기(자료 미연결·붙여넣기)는 「표시한 문장」이라 말하지 않고 원래 과제 안내를 보인다.
  return `<h2 class="st-h">${esc(sc.semantic&&sc.rewrite?sc.rewrite:t(sc.mode==='revise'&&marks.length&&!sc.semantic?'write.revise':it.type===54?'write.task54':'write.task'))}</h2>`
   +(sc.support===2?`<div class="st-help"><p class="st-help-title">${esc(t('write.forms'))}</p>${formsTable()}</div>`:'')
   +(marks.length?`<ul class="st-marks" lang="ko">${marks.map(s=>`<li><mark>${esc(s)}</mark></li>`).join('')}</ul>`:'')
   +`<div class="st-question" lang="ko"><p class="st-instruction"><b>${it.type}.</b> ${esc(it.type===54?it.label:it.instruction)}</p>${it.type===54?promptHtml(it):dataHtml(it.data)}</div>`
   +`<label class="st-label" for="st-text">${esc(t('write.label'))}</label><textarea id="st-text" lang="ko" rows="8" maxlength="${aiReady()?(it.type===53?600:1400):4000}" spellcheck="false" data-st-text>${esc(text)}</textarea><p class="st-note">${esc(t('writing.countNote'))}</p>`
   +(aiReady()?`<p class="st-note" data-ai-consent>${esc(t('ai.consent'))}</p>`:'')
   +(ui.short?`<p class="st-alert" role="status">${esc(t('write.short'))}</p>`:'')
   +(sc.phase==='self'?`<div class="st-help" data-st-self><p>${esc(t('self.q'))}</p></div>`+actions(`<button class="st-main" data-st-check>${esc(t('self.go'))}</button>`)
     :actions(`<button class="st-main" data-st-done>${esc(t(aiReady()?'ai.read':'write.done'))}</button>`));
 }
 function seenHtml(sc){
  if(ui.reading)return `<p class="st-fact" role="status">${esc(t('ai.reading'))}</p><button class="st-quiet" data-st-stop>${esc(t('study.stop'))}</button>`;
  const w=sc.facts,it=item(sc.itemId),text=state.drafts[sc.draft||sc.itemId]?.text||'',n=decide(),o=observeWrite(text,it);
  const off=sentencesOf(text).filter(s=>['formal','polite'].includes(endingOf(s.text))).map(s=>s.text);
  const label={probe:'next.probe',method:'next.method',write:n.mode==='revise'?'next.revise':'next.write',rest:'next.rest'}[n.scene];
  const flagged=o?.flagged||[],unknown=sc.verdict==='unassessed'&&!w.off&&!w.flags?(o?.unknown||[]):[];
  // 사실만 말한다: 틀린 끝 · 확인한 끝 · 확인하지 못한 끝. 내용과 구성은 평가하지 않았다는 줄은 늘 붙는다.
  const line=w.off&&w.flags?`${t('writing.focus.found',{total:w.total,off:w.off})} ${t('seen.flags',{n:w.flags})}`:w.off?t('writing.focus.found',{total:w.total,off:w.off}):w.flags?t('seen.flags',{n:w.flags})
   :sc.pasted?t('seen.pasted'):sc.verdict==='correct'?(sc.indep?t('writing.focus.independent'):t('seen.helpedOk')):sc.linked===false?t('seen.unlinked'):t('seen.unknown');
  return (ui.aiError?`<p class="st-alert" role="status">${esc(t(ui.aiError==='cancelled'?'ai.cancelled':['limit','budget'].includes(ui.aiError)?'ai.limit':'ai.failed'))}</p>`:'')+`<h2 class="st-h">${esc(t('seen.title'))}</h2>${it?`<p class="st-sub" lang="ko">${esc(it.label)}</p>`:''}<p class="st-fact">${esc(line)}</p><p class="st-count">${esc(t('writing.focus.counts',{plain:w.plain,total:w.total}))}</p>`
   +([...off,...flagged,...unknown].length?`<ul class="st-marks" lang="ko">${[...off,...flagged,...unknown].slice(0,6).map(s=>`<li><mark>${esc(s)}</mark></li>`).join('')}</ul>`:'')
   +`<p class="st-note">${esc(t('writing.focus.limit'))}</p>`+actions(`<button class="st-main" data-st-next>${esc(t(label))} <span aria-hidden="true">→</span></button>`,{stop:n.scene!=='rest'});
 }
 function semanticHtml(sc){
  const f=sc.feedback,question=sc.phase==='check'?f.check:f.practice;
  const note=`<p class="st-note">${esc(t('ai.reference'))}</p>`;
  if(sc.phase==='result')return `<h2 class="st-h">${esc(f.summary)}</h2>${f.good?`<p>${esc(f.good)}</p>`:''}<p>${esc(f.rewrite)}</p>${note}`
   +actions(`<button class="st-main" data-ai-finish>${esc(t(f.status==='insufficient'?'ai.revise':'ai.next'))}</button>`);
  if(sc.phase==='help')return `<h2 class="st-h">${esc(t('ai.help'))}</h2><p class="st-explain">${esc(f.help.explanation)}</p><blockquote class="st-sentence" lang="ko">${esc(f.help.example)}</blockquote>${note}`
   +actions(`<button class="st-main" data-ai-advance>${esc(t('ai.try'))}</button>`);
  const picked=sc.pick,ok=picked===question.correct;
  return `<h2 class="st-h">${esc(t(sc.phase==='check'?'ai.check':'ai.practice'))}</h2>`
   +(sc.phase==='check'?`<p>${esc(f.focus.observation)}</p>${f.focus.quote?`<blockquote class="st-sentence" lang="ko"><mark>${esc(f.focus.quote)}</mark></blockquote>`:''}<details class="st-note"><summary>${esc(t('ai.source'))}</summary><p lang="ko">${esc(f.focus.taskQuote)}</p></details>`:'')
   +`<p class="st-fact">${esc(question.prompt)}</p><div class="st-ai-choices">${question.options.map(o=>`<button class="st-bin" lang="ko" data-ai-choice="${o.id}" ${picked?'disabled':''} ${picked&&o.id===question.correct?'data-answer="true"':''}>${esc(o.text)}</button>`).join('')}</div>`
   +(picked?`<p class="st-explain" data-ai-result data-ok="${ok}">${esc(question.why)}</p>`+actions(`<button class="st-main" data-ai-advance>${esc(t(sc.phase==='practice'?'ai.revise':ok?'ai.try':'next.continue'))}</button>`):`<button class="st-quiet" data-st-stop>${esc(t('study.stop'))}</button>`)+note;
 }
 function sortHtml(sc,list,{lead}){
  const key=list[sc.i],c=card(key);if(!c)return '';
  const picked=sc.pick,ok=picked===c.bin,words=c.text.split(' '),last=words.pop();
  return `<p class="st-note">${esc(lead)}</p><p class="st-progress">${esc(t('writing.focus.drill.count',{n:sc.i+1,total:list.length}))}</p>`
   +`<p class="st-sentence" lang="ko">${picked?`${esc(words.join(' '))} <mark>${esc(last)}</mark>`:esc(c.text)}</p>`
   +`<div class="st-bins" role="group">${['formal','polite','plain'].map(b=>`<button class="st-bin" data-st-bin="${b}" ${picked?'disabled':''} ${picked&&b===c.bin?'data-answer="true"':''} ${picked&&b===picked&&!ok?'data-wrong="true"':''}><span>${esc(t(`writing.focus.bin.${b}`))}</span> <span lang="ko">${esc(BIN_FORM[b])}</span></button>`).join('')}</div>`
   +(picked?`<p class="st-result" data-ok="${ok}" role="status">${esc(ok?t('writing.focus.drill.right'):t('writing.focus.drill.wrong',{bin:t(`writing.focus.bin.${c.bin}`)}))}</p>`+actions(`<button class="st-main" data-st-advance>${esc(t('next.continue'))} <span aria-hidden="true">→</span></button>`):'');
 }
 function formHtml(sc,list,{lead,reveal=true}){
  const f=form(list[sc.i]);if(!f)return '';
  const done=sc.graded!=null,right=sc.graded===true,[before,after]=f.stem.split(f.target);
  const probeLine=right?t('writing.focus.drill.right'):sc.graded==='typo'?t('probe.formUnsure'):t('probe.formMiss');
  return `<p class="st-note">${esc(lead)}</p><p class="st-progress">${esc(t('writing.focus.drill.count',{n:sc.i+1,total:list.length}))}</p>`
   +`<p class="st-sentence" lang="ko">${esc(before)}<u>${esc(f.target)}</u>${esc(after??'')}</p>`
   +`<label class="st-label" for="st-form">${esc(t('form.input'))}</label><input id="st-form" lang="ko" type="text" autocomplete="off" spellcheck="false" maxlength="40" data-st-form value="${esc(done?sc.input:ui.input||'')}" ${done?'readonly':''}>`
   +(done&&!reveal?`<p class="st-result" data-ok="${right}" role="status">${esc(probeLine)}</p>`+actions(`<button class="st-main" data-st-advance>${esc(t('next.continue'))} <span aria-hidden="true">→</span></button>`)
   :done?`<p class="st-result" data-ok="${right}" role="status">${esc(right?t('writing.focus.drill.right'):t('form.answer'))} ${right?'':`<span lang="ko">${esc(f.answer)}</span>`}</p><p class="st-explain"><small>${esc(t('form.why'))}</small> <span lang="ko">${esc(f.explain)}</span></p>`+actions(`<button class="st-main" data-st-advance>${esc(t('next.continue'))} <span aria-hidden="true">→</span></button>`)
     :actions(`<button class="st-main" data-st-grade>${esc(t('form.check'))}</button>`));
 }
 function findHtml(f,sc){
  const done=sc.found!=null,picks=done?sc.picks:ui.picks||[];
  return `<p class="st-note">${esc(t('find.lead'))}</p><ol class="st-find" lang="ko">${f.sentences.map((s,i)=>`<li><button class="st-pickline" data-st-line="${i}" aria-pressed="${picks.includes(i)}" ${done?'disabled':''} ${done&&f.off.includes(i)?'data-answer="true"':''}>${esc(s)}${done&&f.off.includes(i)?` <span class="st-tag" lang="${lang}">${esc(t('find.tag'))}</span>`:''}</button></li>`).join('')}</ol>`
   +(done?`<p class="st-result" data-ok="${sc.found}" role="status">${esc(t(sc.found?'find.right':'find.wrong'))}</p><p class="st-explain" lang="ko">${esc(f.explain)}</p>`+actions(`<button class="st-main" data-st-advance>${esc(t('next.continue'))} <span aria-hidden="true">→</span></button>`)
     :actions(`<button class="st-main" data-st-findcheck ${picks.length?'':'disabled'}>${esc(t('form.check'))}</button>`));
 }
 function mineHtml(sc){
  const text=lastText(sc.mineFrom),list=marksOf(text,item(sc.mineFrom)).slice(0,3);
  if(!list.length)return null;
  return `<h2 class="st-h">${esc(t('writing.focus.mine.title').replace(/^[①-⑨]\s*/,''))}</h2><p class="st-note">${esc(t('mine.lead'))}</p>`
   +list.map((s,i)=>{const v=ui.mine?.[i]||'',r=checkChange(v);return `<div class="st-mine"><p lang="ko"><mark>${esc(s)}</mark></p><label class="st-label" for="st-mine-${i}">${esc(t('writing.focus.mine.label',{n:i+1}))}</label><input id="st-mine-${i}" lang="ko" type="text" autocomplete="off" spellcheck="false" maxlength="200" data-st-mine="${i}" value="${esc(v)}"><p class="st-mine-state" data-st-mine-state="${i}" data-ok="${r&&r.ok!=null?String(r.ok):''}">${r?esc(mineMsg(r)):''}</p></div>`;}).join('')
   +actions(`<button class="st-main" data-st-advance>${esc(t('next.continue'))} <span aria-hidden="true">→</span></button>`);
 }
 // 끝 꼴을 확인하지 못한 문장(「급증하다」처럼 품사를 알아야 갈리는 것)에는 맞다·틀리다를 말하지 않는다.
 const mineMsg=r=>r.ok===true?t('writing.focus.mine.ok'):r.ok===null?t('change.unsure'):r.why==='adj-neun'?t('change.adj'):r.why==='dict'?t('change.dict'):r.why==='neun'?t('change.neun'):t('writing.focus.mine.not');
 function probeHtml(sc){
  return sc.probe==='distinguish'?sortHtml(sc,sc.cards,{lead:t('writing.focus.drill.lead')}):formHtml(sc,sc.forms,{lead:t('probe.formLead'),reveal:false});
 }
 function methodHtml(sc){
  if(sc.method==='contrast'){
   const intro=sc.i===0&&!sc.pick?`<p class="st-lead">${esc(t('method.contrast'))}</p><p class="st-note">${esc(t('method.examples'))}</p><dl class="st-examples">${examples(sc).map(c=>`<div><dt>${esc(t(`writing.focus.bin.${c.bin}`))}</dt><dd lang="ko">${esc(c.text)}</dd></div>`).join('')}</dl>`:'';
   return intro+sortHtml(sc,sc.cards,{lead:t('writing.focus.drill.lead')});
  }
  if(sc.method==='forms'){
   const intro=sc.i===0&&sc.graded==null?`<p class="st-lead">${esc(t('method.forms'))}</p>${formsTable()}`:'';
   return intro+formHtml(sc,sc.forms,{lead:t('probe.formLead')});
  }
  // 적용: ① 끝 찾기 한 편 → ② 내 문장 바꿔 보기
  if(sc.step===0&&sc.find&&find(sc.find))return `<p class="st-lead">${esc(t('method.apply'))}</p><ol class="st-steps"><li>${esc(t('writing.focus.method.step1'))}</li><li>${esc(t('writing.focus.method.step2'))}</li></ol>`+findHtml(find(sc.find),sc);
  return mineHtml(sc)??actions(`<button class="st-main" data-st-advance>${esc(t('next.continue'))} <span aria-hidden="true">→</span></button>`);
 }
 function restHtml(sc){
  const key={done:'rest.done','no-items':'rest.noItems','tried-all':'rest.triedAll',enough:'rest.triedAll','alone-once':'rest.alone',later:'rest.alone'}[sc.why]||'study.stopped';
  return `<p class="st-fact">${esc(t(key))}</p>`;
 }
 function resumeHtml(){
  return `<h2 class="st-h">${esc(t('resume.title'))}</h2><p class="st-note">${esc(t('resume.note'))}</p>`+actions(`<button class="st-main" data-st-resume>${esc(t('study.resumeHere'))} <span aria-hidden="true">→</span></button><button class="st-plain" data-st-fresh>${esc(t('resume.fresh'))}</button>`,{stop:false});
 }
 function paint(focus=true){
  syncOwner();
  if(bank&&!sceneValid(state.scene)){const keep=ui;go();ui=keep;paint(focus);return;}
  const sc=state.scene;let body;
  if(ui.stopped)body=`<p class="st-fact">${esc(t('study.stopped'))}</p>`+actions(`<button class="st-main" data-st-unstop>${esc(t('study.resumeHere'))} <span aria-hidden="true">→</span></button>`,{stop:false});
  else if(ui.resume)body=resumeHtml();
  else body=sc.id==='semantic'?semanticHtml(sc):sc.id==='write'?writeHtml(sc):sc.id==='seen'?seenHtml(sc):sc.id==='probe'?probeHtml(sc):sc.id==='method'?methodHtml(sc):restHtml(sc);
  root.innerHTML=shell(body);root.lang=lang;
  if(focus)(root.querySelector('[data-st-text]:not([readonly]), [data-st-form]:not([readonly]), .st-scene .st-main, .st-scene button'))?.focus({preventScroll:true});
 }

 // ── 동작 ──
 function finishProbe(sc){record({kind:'probe',probe:sc.probe});go();}
 function finishMethod(sc){record({kind:'method',method:sc.method});go();}
 // 장면을 정할 때마다 결정 사건 하나(가설·방법·이유 — 「원인 가설 → 처치 → 새 자료 결과 → 지연 확인」을 원장에서 따라갈 수 있게).
 function go(){
  const n=decide(),d=recordDecision(state,{scene:n.scene,why:n.why,...(n.method?{method:n.method}:{}),...(n.probe?{probe:n.probe}:{}),...(n.itemId?{itemId:n.itemId,support:n.support,mode:n.mode}:{})},{now:now()});
  state=d.state;let sc={...toScene(n),did:d.did};
  // 고쳐 쓰기: 마지막 글(앞서 고친 글이 있으면 그것)을 채워 둔다.
  if(sc.id==='write'&&sc.mode==='revise'){const k=draftKey(sc),prev=state.drafts[k]?.text||state.drafts[sc.itemId]?.text||'';state={...state,drafts:{...state.drafts,[k]:{text:prev,updatedAt:iso(),checkedAt:null}}};}
  if(sc.id==='method'&&sc.method==='contrast')state=markSeen(state,examples(sc).map(c=>`card:${c.key}`),{now:now()});
  setScene(sc);
 }
 function advance(){
  const sc=state.scene;
  // 형태 확인에서 첫 문항이 틀렸으면 둘째 확인은 건너뛰고 바로 연습으로(설계 §2 「흔들림을 찾으면 더 묻지 않는다」, Fable F3).
  if(sc.id==='probe'&&sc.probe==='form'&&sc.graded===false)return finishProbe(sc);
  if(sc.id==='probe'||(sc.id==='method'&&sc.method!=='apply')){
   const list=sc.probe==='distinguish'||sc.method==='contrast'?sc.cards:sc.forms;
   if(sc.i+1<list.length){const {pick,graded,input,...rest}=sc;state={...state,scene:{...rest,i:sc.i+1}};ui={};save();paint();return;}
   return sc.id==='probe'?finishProbe(sc):finishMethod(sc);
  }
  if(sc.id==='method'&&sc.method==='apply'){
   if(sc.step===0&&sc.find){const {found,picks,...rest}=sc;state={...state,scene:{...rest,step:1}};ui={};save();paint();return;}
   return finishMethod(sc);
  }
 }
 function checkWrite(){
  const sc=state.scene,key=draftKey(sc),d=state.drafts[key]||{text:''},it=item(sc.itemId);
  if(!observeWrite(d.text,it)){ui.short=true;paint(false);root.querySelector('[data-st-text]')?.focus();return;}
  // 붙여 넣은 글: 점검·연습은 그대로, 붙여 넣은 길이가 글의 절반 이상이면 끝맺음 근거에서만 뺀다(출처를 모름 — 거부하지 않는다).
  const pasted=(d.pasted||0)*2>=d.text.length&&d.pasted>0;
  if(sc.why==='restart')record({kind:'cycle'});
  const r=recordWrite(state,{did:sc.did,item:it,itemId:sc.itemId,text:d.text,support:sc.support,mode:sc.mode||'new',pasted},{now:now()});
  // 「도움 없이」라고 말할지는 Trail이 정한 독립 여부 그대로(화면이 따로 판정하지 않는다).
  const indep=!!r.ev&&trailRows(r.state,now()).get(r.ev)?.independent===true;
  state={...r.state,drafts:{...r.state.drafts,[key]:{text:d.text,updatedAt:d.updatedAt,checkedAt:iso()}}};
  setScene({id:'seen',itemId:sc.itemId,draft:key,support:sc.support,verdict:r.o.verdict,indep,linked:r.o.linked,pasted,facts:{plain:r.o.plain,off:r.o.off,total:r.o.total,flags:r.o.flags}});
  if(aiReady())void askMeaning(sc,key,d.text);
 }
 async function askMeaning(sc,key,answer){
  const sequence=++semanticSeq,expected=who,checkedAt=state.drafts[key]?.checkedAt;ui={reading:true};paint();
  try{
   const result=await feedback.request({itemId:sc.itemId,bankHash:bank.sourceHash,answer,lang,stage:sc.mode==='revise'?'revision':sc.why==='semantic-transfer'?'transfer':'initial',focusSkill:sc.focusSkill||null,consent:'send-once'});
   if(sequence!==semanticSeq||expected!==getOwner()||state.drafts[key]?.checkedAt!==checkedAt)return;
   if(result.status!=='ok')throw Object.assign(Error('AI_UNAVAILABLE'),{code:result.status});
   const f=readSemantic(result.feedback,answer);state=recordSemantic(state,{feedback:f,itemId:sc.itemId},{now:now()});
   setScene({id:'semantic',phase:f.status==='focus'?'check':'result',itemId:sc.itemId,draft:key,checkedAt,bankHash:bank.sourceHash,feedback:f});
  }catch(e){if(sequence!==semanticSeq)return;if(expected!==getOwner()){syncOwner();go();ui={...ui,authLost:true};paint();return;}ui={aiError:e.code||'unavailable'};paint();}
 }
 function semanticWrite(sc,revise){
  const f=sc.feedback,n=semanticNext(state,bank,{itemId:sc.itemId,revise,focusSkill:f.focus?.skill||null,now:now()}),d=recordDecision(state,{scene:n.id,why:n.why,source:'ai-reference',skill:f.focus?.skill||'none'},{now:now()});
  state=d.state;if(n.id==='write'&&revise){const k=draftKey(n);state={...state,drafts:{...state.drafts,[k]:{text:state.drafts[sc.draft]?.text||'',updatedAt:iso(),checkedAt:null}}};n.rewrite=f.rewrite;n.quote=f.focus?.quote||'';}
  setScene({...n,did:d.did});
 }
 function onClick(ev){
  const b=ev.target.closest('button');if(!b||!root.contains(b)||b.disabled)return;
  const sc=state.scene;
  if(b.hasAttribute('data-st-connect')){b.disabled=true;void feedback?.login().catch(()=>{ui.loginError=true;paint(false);});return;}
  if(b.hasAttribute('data-st-disconnect')){semanticSeq++;try{feedback?.disconnect();}catch{ui.loginError=true;}syncOwner();const keep=ui;go();ui=keep;paint();return;}
  if(b.hasAttribute('data-st-stop')){semanticSeq++;const cancelled=!!ui.reading;if(cancelled)feedback?.cancel?.();save();ui={stopped:true,cancelled};paint();return;}
  if(b.dataset.aiChoice&&sc.id==='semantic'&&!sc.pick&&['check','practice'].includes(sc.phase)){
   state=recordSemantic(state,{feedback:sc.feedback,itemId:sc.itemId,stage:sc.phase,pick:b.dataset.aiChoice},{now:now()});setScene({...sc,pick:b.dataset.aiChoice});return;}
  if(b.hasAttribute('data-ai-advance')&&sc.id==='semantic'){
   if(sc.phase==='practice'){semanticWrite(sc,true);return;}const phase=sc.phase==='help'||sc.pick===sc.feedback.check.correct?'practice':'help';setScene({...sc,phase,pick:null});return;}
  if(b.hasAttribute('data-ai-finish')&&sc.id==='semantic'){semanticWrite(sc,sc.feedback.status==='insufficient');return;}
  if(b.hasAttribute('data-st-unstop')){ui=ui.cancelled?{aiError:'cancelled'}:{};paint();return;}
  if(b.hasAttribute('data-st-resume')){try{session?.setItem('synk.study.resumed',who);}catch{}ui={};paint();return;}
  if(b.hasAttribute('data-st-fresh')){
   // 새 칸 포인터를 저장하고 다시 읽어 확인한 뒤에만 칸을 바꾼다. 실패하면 앞 기록·이어 하기 화면을 그대로 두고 저장 실패만 알린다(루트 R4).
   const account=feedback?.owner?.(),pointer=account?`${SLOT_KEY}.${account}`:SLOT_KEY;
   let slot=null;try{for(let n=0;n<20&&!slot;n++){const c=`${account||'guest'}-${(now()+n).toString(36)}`;if(storage.getItem(storeKey(c))==null&&storage.getItem(legacyKey(c))==null)slot=c;}
    if(slot){storage.setItem(pointer,slot);if(storage.getItem(pointer)!==slot)slot=null;}}catch{slot=null;}
   if(!slot||getOwner()!==slot){saveFailed=true;ui={resume:true};paint();return;}
   who=slot;legacy=null;state=readState(null);try{session?.setItem('synk.study.resumed',who);}catch{}ui={};go();return;}
  if(b.hasAttribute('data-st-done')){const d=state.drafts[draftKey(sc)];if(!observeWrite(d?.text||'',item(sc.itemId))){ui.short=true;paint(false);root.querySelector('[data-st-text]')?.focus();return;}
   if(sc.support===1&&!sc.semantic){state={...state,scene:{...sc,phase:'self'}};ui={};save();paint(false);root.querySelector('[data-st-check]')?.focus();return;}checkWrite();return;}
  if(b.hasAttribute('data-st-check')){checkWrite();return;}
  if(b.hasAttribute('data-st-next')){go();return;}
  if(b.hasAttribute('data-st-advance')){advance();return;}
  if(b.dataset.stBin&&!sc.pick){const c=card(sc.cards[sc.i]);if(!c)return;const pick=b.dataset.stBin;
   const r=recordSort(state,{did:sc.did,card:c,pick,learn:sc.id==='method'},{now:now()});state={...r.state,scene:{...sc,pick},recentCards:[...r.state.recentCards,c.key].slice(-12)};save();paint();return;}
  if(b.hasAttribute('data-st-grade')&&sc.graded==null){const f=form(sc.forms[sc.i]),g=f?gradeForm(f,ui.input):null;if(g==null){root.querySelector('[data-st-form]')?.focus();return;}
   const r=recordForm(state,{did:sc.did,form:f,grade:g,learn:sc.id==='method'},{now:now()});state={...r.state,scene:{...sc,graded:g,input:String(ui.input).slice(0,40)}};save();paint();return;}
  if(b.dataset.stLine!=null&&sc.found==null){const i=Number(b.dataset.stLine),p=new Set(ui.picks||[]);p.has(i)?p.delete(i):p.add(i);ui.picks=[...p];paint(false);root.querySelector(`[data-st-line="${i}"]`)?.focus();return;}
  if(b.hasAttribute('data-st-findcheck')&&sc.found==null){const f=find(sc.find),picks=ui.picks||[],found=gradeFind(f,picks);if(!state.seen[f.id])record({kind:'find',id:f.id,ok:found});state={...markSeen(state,[f.id],{now:now()}),scene:{...sc,found,picks}};save();paint();return;}
 }
 function onInput(ev){
  const el=ev.target,sc=state.scene;
  if(el.matches('[data-st-text]')){const k=draftKey(sc),{pasted,...d}=state.drafts[k]||{checkedAt:null};const text=el.value.slice(0,4000);
   // 글을 다 지우면 붙여 넣은 글자 셈도 처음부터(아르곤 A2). 남은 글보다 많이 셀 수 없다.
   state={...state,drafts:{...state.drafts,[k]:{...d,...(text.trim()&&pasted?{pasted:Math.min(pasted,text.length)}:{}),text,updatedAt:iso()}}};if(ui.short){ui.short=false;root.querySelector('.st-alert[role=status]')?.remove();}save();return;}
  if(el.matches('[data-st-form]')){ui.input=el.value;return;}
  if(el.matches('[data-st-mine]')){const i=el.dataset.stMine;ui.mine={...(ui.mine||{}),[i]:el.value};const r=checkChange(el.value),out=root.querySelector(`[data-st-mine-state="${i}"]`);if(out){out.dataset.ok=r&&r.ok!=null?String(r.ok):'';out.textContent=r?mineMsg(r):'';}return;}
 }
 // 붙여 넣은 글자 수만 센다(막지 않는다). 점검하면 그 초안의 셈은 끝난다.
 function onPaste(ev){
  if(!ev.target.matches?.('[data-st-text]'))return;const sc=state.scene,k=draftKey(sc),n=String(ev.clipboardData?.getData('text')||'').length;if(!n)return;
  const d=state.drafts[k]||{text:'',checkedAt:null};state={...state,drafts:{...state.drafts,[k]:{...d,pasted:(d.pasted||0)+n}}};
 }
 function onChange(ev){if(ev.target.matches('[data-st-lang]')){lang=LANGS.includes(ev.target.value)?ev.target.value:'ko';t=makeT(lang);try{storage.setItem(LANG_KEY,lang);}catch{}document.title=`${t('study.title')} · SYNK`;paint(false);root.querySelector('[data-st-lang]')?.focus();}}
 function onKey(ev){if(ev.key==='Enter'&&ev.target.matches('[data-st-form]')){ev.preventDefault();root.querySelector('[data-st-grade]')?.click();}}

 async function start(){
  root.innerHTML=shell(`<p class="st-note" role="status">${esc(t('writing.loading'))}</p>`);
  root.addEventListener('click',onClick);root.addEventListener('input',onInput);root.addEventListener('change',onChange);root.addEventListener('keydown',onKey);root.addEventListener('paste',onPaste);
  await feedback?.init();syncOwner();
  try{
   const get=async name=>{const r=await fetcher(new URL(`${name}?v=${TOKEN}`,base),{cache:'no-cache'});if(!r.ok)throw Error(name);return r.json();};
   const [items,study]=await Promise.all([get('items.json'),get('study.json')]);
   const open=(items.items||[]).filter(i=>i?.review?.status==='passed'),content=(study.items||[]).filter(i=>i?.review?.status==='passed');
   bank={sourceHash:items.sourceHash,open53:open.filter(i=>i.type===53),open54:open.filter(i=>i.type===54&&typeof i.prompt==='string'),pool:drillPool(open),forms:content.filter(i=>i.type==='study-form'),finds:content.filter(i=>i.type==='study-find')};
   if(!bank.open53.length)throw Error('EMPTY');
  }catch{root.querySelector('.st-scene').innerHTML=`<p class="st-alert" role="alert">${esc(t('writing.loadError'))}</p>`;return;}
  document.title=`${t('study.title')} · SYNK`;
  // 옛 판(v1) 기록이 있으면 여기서 한 번 옮긴다(옛 칸은 그대로 남긴다).
  if(legacy){state=migrate(legacy,{now:now(),pool:bank.pool});legacy=null;save();}
  // 앞 사람 기록: 이 탭에서 아직 고르지 않았고 기록이 있으면 먼저 묻는다(남의 글을 바로 펼치지 않는다).
  let resumed=null;try{resumed=session?.getItem('synk.study.resumed');}catch{}
  const has=state.obs.length||Object.values(state.drafts).some(d=>d.text.trim());
  if(has&&resumed!==who)ui={resume:true};
  else if(!has){try{session?.setItem('synk.study.resumed',who);}catch{}} // 이 탭에서 처음 시작한 칸이면 새로 고침 때 다시 묻지 않는다
  // 저장된 장면이 그 문항이 내려간 장면이거나 쉼이면 다시 정한다(쉼 뒤 하루가 지나면 다음 쓰기가 열린다).
  const sc=state.scene,valid=sceneValid(sc);
  if(!valid||sc.id==='rest'){const keep=ui;go();ui=keep;paint();return;}
  paint();
 }
 return {start,state:()=>state};
}

if(globalThis.document&&document.querySelector('[data-study-root]'))createStudy({root:document.querySelector('[data-study-root]')}).start();
