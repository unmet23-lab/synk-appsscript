// 한국어 공부(synk.im/study/) 화면. 한 번에 장면 하나(README §2) — 무엇을 할지는 tutor.mjs의 next()가 정하고 학생은 답하기·계속·쉬기만 한다.
// · WORLD 세션·캐릭터·재화·계정 모듈을 부르지 않는다. 받는 것은 같은 출처 정적 파일(items.json·study.json)뿐이고 보내는 것은 없다.
// · 기록은 이 기기 localStorage `synk.study.v1:<owner>`(지금 owner는 guest). 학생 글은 drafts에만 두고 고쳐 넣지 않는다.
import {readState,addObs,markSeen,observeWrite,next,gradeForm,gradeFind,checkChange,storeKey,sentencesOf,endingOf} from './tutor.mjs';
import {drillPool} from '../../synk-world-app/world-writing-focus.mjs';
import {makeT,chooseLang,LANGS,LANG_NAMES,LANG_KEY} from './copy.mjs';

/* global __ITEMS_TOKEN__ */
const TOKEN=typeof __ITEMS_TOKEN__==='string'?__ITEMS_TOKEN__:'dev';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const FORM_ROWS=[['verb','증가한다 · 늘어난다'],['adj','많다'],['noun','-이다'],['past','조사했다 · 증가했다']];
const BIN_FORM={formal:'-습니다',polite:'-아요',plain:'-다'};

// 이 기기의 손님 칸. 「처음부터 하기」는 앞 사람 기록을 지우지 않고 새 칸으로 비켜 간다(공용 기기에서 남의 기록을 지우지 않게).
const SLOT_KEY='synk.study.slot';
export const deviceSlot=(storage=globalThis.localStorage)=>{try{const v=storage?.getItem(SLOT_KEY);return v&&/^guest(-[a-z0-9]{1,16})?$/.test(v)?v:'guest';}catch{return 'guest';}};
export function createStudy({root,storage=globalThis.localStorage,session=globalThis.sessionStorage,fetcher=(...a)=>globalThis.fetch(...a),now=Date.now,owner=()=>deviceSlot(storage),confirm=m=>globalThis.confirm?.(m)??true,base=new URL('./',import.meta.url)}={}){
 let lang=chooseLang({storage}),t=makeT(lang),bank=null,who=owner(),state=load(),saveFailed=false,ui={};
 function load(){try{return readState(JSON.parse(storage.getItem(storeKey(who))||'null'),{now:now()});}catch{return readState(null);}}
 function save(){try{storage.setItem(storeKey(who),JSON.stringify(state));saveFailed=false;}catch{saveFailed=true;}}
 const iso=()=>new Date(now()).toISOString();
 const record=o=>{state=addObs(state,o,{now:now()});};
 const setScene=scene=>{state={...state,scene};ui={};save();paint();};
 const item53=id=>bank.open53.find(i=>i.id===id)||null,form=id=>bank.forms.find(f=>f.id===id),find=id=>bank.finds.find(f=>f.id===id),card=key=>bank.pool.find(c=>c.key===key);
 // 계정이 바뀌면(지금은 guest 하나뿐이지만 같은 자리) 앞 사람의 화면 상태를 버리고 그 계정 기록을 새로 읽는다.
 function syncOwner(){const n=owner();if(n!==who){who=n;state=load();ui={};}}
 const decide=()=>next(state,bank,{now:now(),seed:Math.floor(now()/60000)});
 // 저장된 장면이 지금 재고로 그릴 수 있는가(문항이 내려갔거나 값이 깨졌으면 다시 정한다 — 빈 화면 방지, 루트 R3).
 const ids=(list,has)=>Array.isArray(list)&&list.length>0&&list.every(k=>typeof k==='string'&&has(k));
 function sceneValid(sc){if(!sc||typeof sc!=='object')return false;const i=sc.i??0;if(!Number.isInteger(i)||i<0)return false;
  if(sc.id==='write')return !!item53(sc.itemId)&&[0,1,2].includes(sc.support)&&['edit','self'].includes(sc.phase);
  if(sc.id==='seen')return !!item53(sc.itemId)&&!!sc.facts&&Number.isInteger(sc.facts.total);
  if(sc.id==='probe')return sc.probe==='distinguish'?ids(sc.cards,card)&&i<sc.cards.length:sc.probe==='form'?ids(sc.forms,form)&&i<sc.forms.length:false;
  if(sc.id==='method'){if(sc.method==='contrast')return ids(sc.cards,card)&&i<sc.cards.length;if(sc.method==='forms')return ids(sc.forms,form)&&i<sc.forms.length;return sc.method==='apply'&&(sc.find==null||!!find(sc.find))&&[0,1].includes(sc.step??0);}
  return sc.id==='rest';}
 const toScene=n=>n.scene==='write'?{id:'write',itemId:n.itemId,support:n.support,phase:'edit'}:n.scene==='probe'?{id:'probe',probe:n.probe,cards:n.cards||[],forms:n.forms||[],i:0}:n.scene==='method'?{id:'method',method:n.method,cards:n.cards||[],forms:n.forms||[],find:n.find||null,mineFrom:n.mineFrom||null,step:0,i:0}:{id:'rest',why:n.why};

 // ── 그리기 ──
 function shell(body){
  return `<header class="st-top"><p class="st-brand">SYNK</p><h1>${esc(t('study.title'))}</h1><label class="st-lang"><span>${esc(t('study.lang'))}</span><select data-st-lang>${LANGS.map(l=>`<option value="${l}" ${l===lang?'selected':''}>${esc(LANG_NAMES[l])}</option>`).join('')}</select></label></header>`
   +(saveFailed?`<p class="st-alert" role="alert">${esc(t('study.saveFail'))}</p>`:'')
   +`<section class="st-scene" aria-live="polite">${body}</section>`
   +`<footer class="st-foot"><p>${esc(t('study.lead'))}</p><p>${esc(t('study.device'))}</p></footer>`;
 }
 const actions=(main,{stop=true}={})=>`<div class="st-actions">${main}${stop?`<button class="st-quiet" data-st-stop>${esc(t('study.stop'))}</button>`:''}</div>`;
 const dataHtml=data=>`<div class="st-data" lang="ko">${data.source?`<p class="st-source">${esc(data.source)}</p>`:''}${(data.tables||[]).map(tb=>`<table><caption>${esc(tb.caption)}</caption><thead><tr>${tb.columns.map(c=>`<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>${tb.rows.map(r=>`<tr>${r.map((c,i)=>i?`<td>${esc(c)}</td>`:`<th scope="row">${esc(c)}</th>`).join('')}</tr>`).join('')}</tbody></table>`).join('')}${(data.lists||[]).map(l=>`<div class="st-list"><strong>${esc(l.caption)}</strong><ul>${l.items.map(i=>`<li>${esc(i)}</li>`).join('')}</ul></div>`).join('')}</div>`;
 const formsTable=()=>`<dl class="st-forms">${FORM_ROWS.map(([k,ko])=>`<div><dt>${esc(t(`writing.focus.method.${k}`))}</dt><dd lang="ko">${esc(ko)}</dd></div>`).join('')}</dl><p class="st-note">${esc(t('writing.focus.method.watch'))} <span lang="ko">많는다 · 증가하다.</span></p>`;
 function writeHtml(sc){
  const it=item53(sc.itemId);if(!it)return restHtml({why:'no-items'});
  const text=state.drafts[it.id]?.text||'';
  return `<h2 class="st-h">${esc(t('write.task'))}</h2>`
   +(sc.support===2?`<div class="st-help"><p class="st-help-title">${esc(t('write.forms'))}</p>${formsTable()}</div>`:'')
   +`<div class="st-question" lang="ko"><p class="st-instruction"><b>53.</b> ${esc(it.instruction)}</p>${dataHtml(it.data)}</div>`
   +`<label class="st-label" for="st-text">${esc(t('write.label'))}</label><textarea id="st-text" lang="ko" rows="8" spellcheck="false" data-st-text>${esc(text)}</textarea><p class="st-note">${esc(t('writing.countNote'))}</p>`
   +(ui.short?`<p class="st-alert" role="status">${esc(t('write.short'))}</p>`:'')
   +(sc.phase==='self'?`<div class="st-help" data-st-self><p>${esc(t('self.q'))}</p></div>`+actions(`<button class="st-main" data-st-check>${esc(t('self.go'))}</button>`)
     :actions(`<button class="st-main" data-st-done>${esc(t('write.done'))}</button>`));
 }
 function seenHtml(sc){
  const w=sc.facts,it=item53(sc.itemId),text=state.drafts[sc.itemId]?.text||'',n=decide();
  const off=sentencesOf(text).filter(s=>['formal','polite'].includes(endingOf(s.text))).map(s=>s.text);
  const label={probe:'next.probe',method:'next.method',write:'next.write',rest:'next.rest'}[n.scene];
  const flagged=observeWrite(text)?.flagged||[];
  const line=w.off&&w.flags?`${t('writing.focus.found',{total:w.total,off:w.off})} ${t('seen.flags',{n:w.flags})}`:w.off?t('writing.focus.found',{total:w.total,off:w.off}):w.flags?t('seen.flags',{n:w.flags}):sc.support===0&&!sc.same?t('writing.focus.independent'):t('seen.helpedOk');
  return `<h2 class="st-h">${esc(t('seen.title'))}</h2>${it?`<p class="st-sub" lang="ko">${esc(it.label)}</p>`:''}<p class="st-fact">${esc(line)}</p><p class="st-count">${esc(t('writing.focus.counts',{plain:w.plain,total:w.total}))}</p>`
   +([...off,...flagged].length?`<ul class="st-marks" lang="ko">${[...off,...flagged].slice(0,6).map(s=>`<li><mark>${esc(s)}</mark></li>`).join('')}</ul>`:'')
   +`<p class="st-note">${esc(t('writing.focus.limit'))}</p>`+actions(`<button class="st-main" data-st-next>${esc(t(label))} <span aria-hidden="true">→</span></button>`,{stop:n.scene!=='rest'});
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
  const done=sc.graded!=null,[before,after]=f.stem.split(f.target);
  return `<p class="st-note">${esc(lead)}</p><p class="st-progress">${esc(t('writing.focus.drill.count',{n:sc.i+1,total:list.length}))}</p>`
   +`<p class="st-sentence" lang="ko">${esc(before)}<u>${esc(f.target)}</u>${esc(after??'')}</p>`
   +`<label class="st-label" for="st-form">${esc(t('form.input'))}</label><input id="st-form" lang="ko" type="text" autocomplete="off" spellcheck="false" maxlength="40" data-st-form value="${esc(done?sc.input:ui.input||'')}" ${done?'readonly':''}>`
   +(done&&!reveal?`<p class="st-result" data-ok="${sc.graded}" role="status">${esc(t(sc.graded?'writing.focus.drill.right':'probe.formMiss'))}</p>`+actions(`<button class="st-main" data-st-advance>${esc(t('next.continue'))} <span aria-hidden="true">→</span></button>`)
   :done?`<p class="st-result" data-ok="${sc.graded}" role="status">${esc(sc.graded?t('writing.focus.drill.right'):t('form.answer'))} ${sc.graded?'':`<span lang="ko">${esc(f.answer)}</span>`}</p><p class="st-explain"><small>${esc(t('form.why'))}</small> <span lang="ko">${esc(f.explain)}</span></p>`+actions(`<button class="st-main" data-st-advance>${esc(t('next.continue'))} <span aria-hidden="true">→</span></button>`)
     :actions(`<button class="st-main" data-st-grade>${esc(t('form.check'))}</button>`));
 }
 function findHtml(f,sc){
  const done=sc.found!=null,picks=done?sc.picks:ui.picks||[];
  return `<p class="st-note">${esc(t('find.lead'))}</p><ol class="st-find" lang="ko">${f.sentences.map((s,i)=>`<li><button class="st-pickline" data-st-line="${i}" aria-pressed="${picks.includes(i)}" ${done?'disabled':''} ${done&&f.off.includes(i)?'data-answer="true"':''}>${esc(s)}${done&&f.off.includes(i)?` <span class="st-tag" lang="${lang}">${esc(t('find.tag'))}</span>`:''}</button></li>`).join('')}</ol>`
   +(done?`<p class="st-result" data-ok="${sc.found}" role="status">${esc(t(sc.found?'find.right':'find.wrong'))}</p><p class="st-explain" lang="ko">${esc(f.explain)}</p>`+actions(`<button class="st-main" data-st-advance>${esc(t('next.continue'))} <span aria-hidden="true">→</span></button>`)
     :actions(`<button class="st-main" data-st-findcheck ${picks.length?'':'disabled'}>${esc(t('form.check'))}</button>`));
 }
 function mineHtml(sc){
  const text=state.drafts[sc.mineFrom]?.text||'',o=observeWrite(text),list=[...(o?.offSentences||sentencesOf(text).filter(s=>['formal','polite'].includes(endingOf(s.text))).map(s=>s.text)),...(o?.flagged||[])].slice(0,3);
  if(!list.length)return null;
  return `<h2 class="st-h">${esc(t('writing.focus.mine.title').replace(/^[①-⑨]\s*/,''))}</h2><p class="st-note">${esc(t('mine.lead'))}</p>`
   +list.map((s,i)=>{const v=ui.mine?.[i]||'',r=checkChange(v);return `<div class="st-mine"><p lang="ko"><mark>${esc(s)}</mark></p><label class="st-label" for="st-mine-${i}">${esc(t('writing.focus.mine.label',{n:i+1}))}</label><input id="st-mine-${i}" lang="ko" type="text" autocomplete="off" spellcheck="false" maxlength="200" data-st-mine="${i}" value="${esc(v)}"><p class="st-mine-state" data-st-mine-state="${i}" data-ok="${r?String(r.ok):''}">${r?esc(mineMsg(r)):''}</p></div>`;}).join('')
   +actions(`<button class="st-main" data-st-advance>${esc(t('next.continue'))} <span aria-hidden="true">→</span></button>`);
 }
 const mineMsg=r=>r.ok?t('writing.focus.mine.ok'):r.why==='adj-neun'?t('change.adj'):r.why==='dict'?t('change.dict'):t('writing.focus.mine.not');
 function probeHtml(sc){
  return sc.probe==='distinguish'?sortHtml(sc,sc.cards,{lead:t('writing.focus.drill.lead')}):formHtml(sc,sc.forms,{lead:t('probe.formLead'),reveal:false});
 }
 function methodHtml(sc){
  if(sc.method==='contrast'){
   const ex=['formal','polite','plain'].map(b=>bank.pool.find(c=>c.bin===b&&!sc.cards.includes(c.key))).filter(Boolean);
   const intro=sc.i===0&&!sc.pick?`<p class="st-lead">${esc(t('method.contrast'))}</p><p class="st-note">${esc(t('method.examples'))}</p><dl class="st-examples">${ex.map(c=>`<div><dt>${esc(t(`writing.focus.bin.${c.bin}`))}</dt><dd lang="ko">${esc(c.text)}</dd></div>`).join('')}</dl>`:'';
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
  const key={done:'rest.done','no-items':'rest.noItems','tried-all':'rest.triedAll','alone-once':'rest.alone'}[sc.why]||'study.stopped';
  return `<p class="st-fact">${esc(t(key))}</p>`;
 }
 function resumeHtml(){
  return `<h2 class="st-h">${esc(t('resume.title'))}</h2><p class="st-note">${esc(t('resume.note'))}</p>`+actions(`<button class="st-main" data-st-resume>${esc(t('study.resumeHere'))} <span aria-hidden="true">→</span></button><button class="st-plain" data-st-fresh>${esc(t('resume.fresh'))}</button>`,{stop:false});
 }
 function paint(focus=true){
  syncOwner();
  const sc=state.scene;let body;
  if(ui.stopped)body=`<p class="st-fact">${esc(t('study.stopped'))}</p>`+actions(`<button class="st-main" data-st-unstop>${esc(t('study.resumeHere'))} <span aria-hidden="true">→</span></button>`,{stop:false});
  else if(ui.resume)body=resumeHtml();
  else body=sc.id==='write'?writeHtml(sc):sc.id==='seen'?seenHtml(sc):sc.id==='probe'?probeHtml(sc):sc.id==='method'?methodHtml(sc):restHtml(sc);
  root.innerHTML=shell(body);root.lang=lang;
  if(focus)(root.querySelector('[data-st-text]:not([readonly]), [data-st-form]:not([readonly]), .st-scene .st-main, .st-scene button'))?.focus({preventScroll:true});
 }

 // ── 동작 ──
 function finishProbe(sc){record({kind:'probe',probe:sc.probe});go();}
 function finishMethod(sc){record({kind:'method',method:sc.method});go();}
 function go(){setScene(toScene(decide()));}
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
  const sc=state.scene,d=state.drafts[sc.itemId]||{text:''},o=observeWrite(d.text);
  if(!o){ui.short=true;paint(false);root.querySelector('[data-st-text]')?.focus();return;}
  // 같은 자료를 이미 점검했으면(새로 고침 뒤 다시 누름 등) 「같은 글 고치기」 — 혼자 성공으로 세지 않는다.
  const same=!!d.checkedAt;
  record({kind:'write',itemId:sc.itemId,support:sc.support,same,plain:o.plain,off:o.off,total:o.total,formal:o.formal,polite:o.polite,flags:o.flags,axes:o.axes});
  state={...markSeen(state,[sc.itemId],{now:now()}),drafts:{...state.drafts,[sc.itemId]:{...d,checkedAt:iso()}}};
  setScene({id:'seen',itemId:sc.itemId,support:sc.support,same,facts:{plain:o.plain,off:o.off,total:o.total,flags:o.flags}});
 }
 function onClick(ev){
  const b=ev.target.closest('button');if(!b||!root.contains(b)||b.disabled)return;
  const sc=state.scene;
  if(b.hasAttribute('data-st-stop')){save();ui={stopped:true};paint();return;}
  if(b.hasAttribute('data-st-unstop')){ui={};paint();return;}
  if(b.hasAttribute('data-st-resume')){try{session?.setItem('synk.study.resumed',who);}catch{}ui={};paint();return;}
  if(b.hasAttribute('data-st-fresh')){
   // 새 칸 포인터를 저장하고 다시 읽어 확인한 뒤에만 칸을 바꾼다. 실패하면 앞 기록·이어 하기 화면을 그대로 두고 저장 실패만 알린다(루트 R4).
   let slot=null;try{for(let n=0;n<20&&!slot;n++){const c=`guest-${(now()+n).toString(36)}`;if(storage.getItem(storeKey(c))==null)slot=c;}
    if(slot){storage.setItem(SLOT_KEY,slot);if(storage.getItem(SLOT_KEY)!==slot)slot=null;}}catch{slot=null;}
   if(!slot||deviceSlot(storage)!==slot){saveFailed=true;ui={resume:true};paint();return;}
   who=slot;state=readState(null);try{session?.setItem('synk.study.resumed',who);}catch{}ui={};go();return;}
  if(b.hasAttribute('data-st-done')){const d=state.drafts[sc.itemId];if(!observeWrite(d?.text||'')){ui.short=true;paint(false);root.querySelector('[data-st-text]')?.focus();return;}
   if(sc.support===1){state={...state,scene:{...sc,phase:'self'}};ui={};save();paint(false);root.querySelector('[data-st-check]')?.focus();return;}checkWrite();return;}
  if(b.hasAttribute('data-st-check')){checkWrite();return;}
  if(b.hasAttribute('data-st-next')){go();return;}
  if(b.hasAttribute('data-st-advance')){advance();return;}
  if(b.dataset.stBin&&!sc.pick){const c=card(sc.cards[sc.i]);if(!c)return;const pick=b.dataset.stBin;
   record({kind:'sort',card:c.key,bin:c.bin,ok:c.bin===pick,use:sc.id==='probe'?'check':'learn'});state={...state,scene:{...sc,pick},recentCards:[...state.recentCards,c.key].slice(-12)};save();paint();return;}
  if(b.hasAttribute('data-st-grade')&&sc.graded==null){const f=form(sc.forms[sc.i]),g=f?gradeForm(f,ui.input):null;if(g==null){root.querySelector('[data-st-form]')?.focus();return;}
   record({kind:'form',id:f.id,axis:f.axis,use:f.use,ok:g});state={...markSeen(state,[f.id],{now:now()}),scene:{...sc,graded:g,input:String(ui.input).slice(0,40)}};save();paint();return;}
  if(b.dataset.stLine!=null&&sc.found==null){const i=Number(b.dataset.stLine),p=new Set(ui.picks||[]);p.has(i)?p.delete(i):p.add(i);ui.picks=[...p];paint(false);root.querySelector(`[data-st-line="${i}"]`)?.focus();return;}
  if(b.hasAttribute('data-st-findcheck')&&sc.found==null){const f=find(sc.find),picks=ui.picks||[],found=gradeFind(f,picks);if(!state.seen[f.id])record({kind:'find',id:f.id,ok:found});state={...markSeen(state,[f.id],{now:now()}),scene:{...sc,found,picks}};save();paint();return;}
 }
 function onInput(ev){
  const el=ev.target,sc=state.scene;
  if(el.matches('[data-st-text]')){state={...state,drafts:{...state.drafts,[sc.itemId]:{...(state.drafts[sc.itemId]||{checkedAt:null}),text:el.value.slice(0,4000),updatedAt:iso()}}};if(ui.short){ui.short=false;root.querySelector('.st-alert[role=status]')?.remove();}save();return;}
  if(el.matches('[data-st-form]')){ui.input=el.value;return;}
  if(el.matches('[data-st-mine]')){const i=el.dataset.stMine;ui.mine={...(ui.mine||{}),[i]:el.value};const r=checkChange(el.value),out=root.querySelector(`[data-st-mine-state="${i}"]`);if(out){out.dataset.ok=r?String(r.ok):'';out.textContent=r?mineMsg(r):'';}return;}
 }
 function onChange(ev){if(ev.target.matches('[data-st-lang]')){lang=LANGS.includes(ev.target.value)?ev.target.value:'ko';t=makeT(lang);try{storage.setItem(LANG_KEY,lang);}catch{}document.title=`${t('study.title')} · SYNK`;paint(false);root.querySelector('[data-st-lang]')?.focus();}}
 function onKey(ev){if(ev.key==='Enter'&&ev.target.matches('[data-st-form]')){ev.preventDefault();root.querySelector('[data-st-grade]')?.click();}}

 async function start(){
  root.innerHTML=shell(`<p class="st-note" role="status">${esc(t('writing.loading'))}</p>`);
  root.addEventListener('click',onClick);root.addEventListener('input',onInput);root.addEventListener('change',onChange);root.addEventListener('keydown',onKey);
  try{
   const get=async name=>{const r=await fetcher(new URL(`${name}?v=${TOKEN}`,base),{cache:'no-cache'});if(!r.ok)throw Error(name);return r.json();};
   const [items,study]=await Promise.all([get('items.json'),get('study.json')]);
   const open=(items.items||[]).filter(i=>i?.review?.status==='passed'),content=(study.items||[]).filter(i=>i?.review?.status==='passed');
   bank={open53:open.filter(i=>i.type===53),pool:drillPool(open),forms:content.filter(i=>i.type==='study-form'),finds:content.filter(i=>i.type==='study-find')};
   if(!bank.open53.length)throw Error('EMPTY');
  }catch{root.querySelector('.st-scene').innerHTML=`<p class="st-alert" role="alert">${esc(t('writing.loadError'))}</p>`;return;}
  document.title=`${t('study.title')} · SYNK`;
  // 앞 사람 기록: 이 탭에서 아직 고르지 않았고 기록이 있으면 먼저 묻는다(남의 글을 바로 펼치지 않는다).
  let resumed=null;try{resumed=session?.getItem('synk.study.resumed');}catch{}
  const has=state.obs.length||Object.values(state.drafts).some(d=>d.text.trim());
  if(has&&resumed!==who)ui={resume:true};
  else if(!has){try{session?.setItem('synk.study.resumed',who);}catch{}} // 이 탭에서 처음 시작한 칸이면 새로 고침 때 다시 묻지 않는다
  // 저장된 장면이 그 문항이 내려간 장면이거나 쉼이면 다시 정한다(쉼 뒤 하루가 지나면 다음 쓰기가 열린다).
  const sc=state.scene,valid=sceneValid(sc);
  if(!valid||sc.id==='rest'){const keep=ui;state={...state,scene:toScene(decide())};save();ui=keep;}
  paint();
 }
 return {start,state:()=>state};
}

if(globalThis.document&&document.querySelector('[data-study-root]'))createStudy({root:document.querySelector('[data-study-root]')}).start();
