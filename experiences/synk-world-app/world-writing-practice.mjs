// 공개 WORLD 「쓰기 연습」 — TOPIK II 쓰기(PBT) 51~54번 형식의 자체 창작 문항으로 쓰고, 규칙 점검(이 기기, AI 없음)과
// 예시답, 켜져 있으면 자동 피드백(서버)을 본다. 10-20 결정 「TOPIK II 전부 공개」 · TOPIK 맞춤 검수 최종 제안 §2-3.
// · 문항: world-writing-items.json에서 review.status가 'passed'인 것만 보인다(세션 ② AI 2중 검수). 공식 기출은 쓰지 않는다.
// · 점수·급수·합격 판정은 하지 않는다. 규칙 점검은 「확인해 보세요」, 자동 피드백은 범주별 「참고 범위」다.
// · 한 자리 한 언어: 화면 글은 t(), 문제·지문·자료·예시답·학생 글·인용은 lang="ko" 칸에 따로 둔다.
// · 쓴 글은 이 기기(localStorage, 계정별 키)에만 둔다. 자동 피드백을 누를 때만 그 글을 서버로 보내고, 서버는 저장하지 않는다.
// · 학습 기록: 기기 기록(시도·출처 'rule-check'·'ai-reference')과, 호스트가 코치를 주면 Trail에 「채점 안 함」 시도로만 남긴다
//   (assessable:false — AI 판정을 혼자 해낸 성공으로 세지 않는다). 자동 피드백을 본 뒤의 점검은 도움(hint)을 받은 시도다.
import {t,onLang,currentLang} from '../brand-opening/world-lang.mjs';
import {checkWriting,checkCount,writingLength} from './world-writing-check.mjs';
if(globalThis.document&&!document.querySelector('[data-writing-style]')){const style=document.createElement('link');style.rel='stylesheet';style.href=new URL('./world-writing.css',import.meta.url).href;style.dataset.writingStyle='true';document.head.append(style);}

// TOPIK II 연습 지도(strata/topik-ii.skills.json · 세션 ②)의 쓰기 항목과 이어지는 자리.
export const WRITING_SKILLS=Object.freeze({51:'ko2.writing.sentence',52:'ko2.writing.sentence',53:'ko2.writing.description',54:'ko2.writing.argument'});
// 계획 엔진(세션 ①)이 받는 후보: 쓰기 + 규칙 점검을 보는 데 드는 어림 분.
export const WRITING_CANDIDATES=Object.freeze([51,52,53,54].map(type=>Object.freeze({id:`topik2-writing-${type}`,route:`writing:${type}`,minutes:{51:8,52:8,53:18,54:35}[type],targets:Object.freeze([WRITING_SKILLS[type]]),area:'writing',exam:'topik2'}))
 .concat(Object.freeze({id:'topik2-writing-mock',route:'writing:mock',minutes:55,targets:Object.freeze([...new Set(Object.values(WRITING_SKILLS))]),area:'writing',exam:'topik2'})));
// 50분 가운데 문항별 권장 시간(분). 시험장에서 흔히 나누는 비율이며 공식 배분이 아니다.
const SUGGEST=Object.freeze({51:5,52:5,53:12,54:28});
const TYPES=[51,52,53,54],MOCK_MS=50*60000,LOG_MAX=200;
const storeKey=owner=>`synk.world.writing.v1:${owner||'guest'}`,TIMER_KEY='synk.world.writing.timer';
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const pad=n=>String(n).padStart(2,'0');
const clock=ms=>{const s=Math.max(0,Math.round(ms/1000));return `${pad(Math.floor(s/60))}:${pad(s%60)}`;};

function readStore(storage,owner){try{const v=JSON.parse(storage?.getItem(storeKey(owner))||'null');if(v&&typeof v==='object'&&v.drafts&&typeof v.drafts==='object')return {drafts:v.drafts,log:Array.isArray(v.log)?v.log:[],mock:v.mock||null};}catch{}return {drafts:{},log:[],mock:null};}
function writeStore(storage,owner,state){try{storage?.setItem(storeKey(owner),JSON.stringify({drafts:state.drafts,log:state.log.slice(-LOG_MAX),mock:state.mock}));return true;}catch{return false;}}
/** 계획 엔진·내 위치가 읽는 연습 요약(이 기기 기록). 자동 피드백 결과는 시도 수에 더하지 않고 따로 센다. */
export function readWritingSummary({storage=globalThis.localStorage,owner='guest'}={}){
 const state=readStore(storage,owner),attempts={51:0,52:0,53:0,54:0},feedback={51:0,52:0,53:0,54:0};let ms=0,lastAt=null;
 for(const entry of state.log){if(!TYPES.includes(entry.type))continue;if(entry.source==='rule-check')attempts[entry.type]++;if(entry.source==='ai-reference')feedback[entry.type]++;if(!lastAt||entry.at>lastAt)lastAt=entry.at;}
 for(const draft of Object.values(state.drafts))ms+=Number(draft?.spentMs)||0;
 return {attempts,feedback,minutes:Math.round(ms/60000),lastAt};
}
/** 배우기 판(life-ui.mjs)의 「내 위치」 아래 한 줄. print는 life-ui의 펠트 인화지 함수다.
 *  검수를 통과해 열린 문항이 있을 때만 보인다(문항 은행을 아직 못 읽었거나 열린 문항이 없으면 줄이 없다 — 빈 화면으로 가는 단추를 두지 않는다). */
export function writingRow(print=()=>''){
 if(!openCount)return '';
 return `<button class="life-row" data-world="writing">${print('sentence','life-row-print')}<span class="life-row-copy"><strong>${esc(t('writing.row.title'))}</strong><small>${esc(t('writing.row.sub'))}</small></span></button>`;
}
let bankPromise=null,openCount=0;
export const writingReady=()=>openCount>0;
export function loadWritingBank(fetcher=(...args)=>globalThis.fetch(...args),url=new URL('./world-writing-items.json',import.meta.url)){
 bankPromise||=Promise.resolve(fetcher(url,{cache:'no-cache'})).then(r=>{if(!r.ok)throw Error('WRITING_BANK');return r.json();}).then(bank=>{
  if(!bank||!Array.isArray(bank.items))throw Error('WRITING_BANK');
  const open=bank.items.filter(item=>item?.review?.status==='passed'&&TYPES.includes(item.type));openCount=open.length;
  return {...bank,open};
 }).catch(error=>{bankPromise=null;throw error;});
 return bankPromise;
}
const blankMark=(item,id)=>item.blanks.find(b=>b.id===id)?.mark||'';
// 지문 그리기: 빈칸은 시험지처럼 「( ㉠ )」.
const passageHtml=item=>item.passage.map(line=>`<p>${line.map(part=>typeof part==='string'?esc(part):`<span class="ww-gap">( ${esc(blankMark(item,part.blank))} )</span>`).join('')}</p>`).join('');
const dataHtml=data=>`<div class="ww-data">${data.source?`<p class="ww-source">${esc(data.source)}</p>`:''}${(data.tables||[]).map(table=>`<table><caption>${esc(table.caption)}</caption><thead><tr>${table.columns.map(c=>`<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>${table.rows.map(row=>`<tr>${row.map((cell,i)=>i?`<td>${esc(cell)}</td>`:`<th scope="row">${esc(cell)}</th>`).join('')}</tr>`).join('')}</tbody></table>`).join('')}${(data.lists||[]).map(list=>`<div class="ww-list-box"><strong>${esc(list.caption)}</strong><ul>${list.items.map(i=>`<li>${esc(i)}</li>`).join('')}</ul></div>`).join('')}</div>`;
function questionHtml(item){
 const head=`<p class="ww-instruction"><b>${item.type}.</b> ${esc(item.instruction)} <span class="ww-points">(${esc(item.points)})</span></p>`;
 if(item.type<=52)return head+`<div class="ww-box">${item.heading?`<p class="ww-heading">${esc(item.heading)}</p>`:''}${passageHtml(item)}</div>`;
 if(item.type===53)return head+dataHtml(item.data);
 return head+`<div class="ww-box"><p>${esc(item.prompt)}</p><ul class="ww-questions">${item.questions.map(q=>`<li>${esc(q)}</li>`).join('')}</ul></div>`;
}
// 점검 한 줄: 화면 글(t) 한 칸 + 한국어 인용·끝 꼴·바꿔 볼 말은 lang="ko" 칸. 51·52는 빈칸 기호를 앞에 둔다.
const EXPECT_FORM={formal:'-습니다',polite:'-아요/-어요',plain:'-다'};
function checkItemHtml(item,entry){
 const key=entry.id==='style'?`writing.check.style.${entry.style}`:entry.id==='title'?'writing.check.titleLine':entry.id==='short'&&entry.far?'writing.check.shortFar':`writing.check.${entry.id}`;
 const vars={n:entry.length??entry.count??0,min:entry.min??item.min,max:entry.max??item.max};
 const quotes=(entry.spans||[]).map(s=>s.quote).concat(entry.quote?[entry.quote]:[]).filter(Boolean).slice(0,4);
 const suggests=[...new Set((entry.spans||[]).map(s=>s.suggest).filter(Boolean))].slice(0,3);
 const mark=entry.blank?`<span class="ww-mark" lang="ko">${esc(blankMark(item,entry.blank))}</span>`:'';
 return `<li class="ww-check" data-level="${entry.level}">${mark}<div><p>${esc(t(key,vars))}</p>`
  +(entry.id==='short'&&entry.far?`<p>${esc(t('writing.check.short',vars))}</p>`:'')
  +(quotes.length?`<p class="ww-quotes" lang="ko">${quotes.map(q=>`<mark>${esc(q)}</mark>`).join(' ')}</p>`:'')
  +(entry.id==='style'?`<p class="ww-expect"><small>${esc(t('writing.check.expect'))}</small> <span lang="ko">${esc(EXPECT_FORM[entry.style])}</span></p>`:'')
  +(suggests.length?`<p class="ww-expect"><small>${esc(t('writing.check.try'))}</small> <span lang="ko">${suggests.map(esc).join(' · ')}</span></p>`:'')
  +(entry.labels?.length?`<p class="ww-quotes" lang="ko">${entry.labels.map(l=>`<span class="ww-chip">${esc(l)}</span>`).join(' ')}</p>`:'')
  +`</div></li>`;
}
function checksHtml(item,result){
 const items=result.items;
 const n=checkCount(result);
 return `<h3 class="ww-section-title">${esc(t('writing.check.heading'))} <small>${esc(t('writing.check.count',{n}))}</small></h3><p class="ww-note">${esc(t('writing.check.lead'))}</p>`
  +(items.length?`<ul class="ww-checks">${items.map(entry=>checkItemHtml(item,entry)).join('')}</ul>`:`<p class="ww-none">${esc(t('writing.check.none'))}</p>`);
}
function modelHtml(item){
 const rows=[];
 if(item.type<=52)for(const blank of item.blanks)rows.push(`<div class="ww-model-blank"><span class="ww-mark" lang="ko">${esc(blank.mark)}</span><div><p class="ww-model-text" lang="ko">${esc(blank.model)}</p><p class="ww-model-label">${esc(t('writing.accept'))}</p><p lang="ko">${esc(blank.accept)}</p></div></div>`);
 else rows.push(`<p class="ww-model-label">${esc(t('writing.model.length',{n:writingLength(item.model)}))}</p><div class="ww-model-text" lang="ko">${item.model.split('\n').map(p=>`<p>${esc(p)}</p>`).join('')}</div>`
  +(item.check?`<p class="ww-model-label">${esc(t('writing.arith'))}</p><p lang="ko">${esc(item.check)}</p>`:'')
  +(item.points_to_cover?.length?`<p class="ww-model-label">${esc(t('writing.cover'))}</p><ul lang="ko">${item.points_to_cover.map(p=>`<li>${esc(p)}</li>`).join('')}</ul>`:''));
 if(item.watch)rows.push(`<p class="ww-model-label">${esc(t('writing.watch'))}</p><p lang="ko">${esc(item.watch)}</p>`);
 return `<h3 class="ww-section-title">${esc(t('writing.model.title'))}</h3><p class="ww-note">${esc(t('writing.model.note'))}</p>${rows.join('')}`;
}
function feedbackHtml(item,state){
 if(state.status==='sending')return `<p class="ww-note" role="status">${esc(t('writing.ai.sending'))}</p>`;
 if(state.status!=='ok'){const key={limit:'writing.ai.limit',budget:'writing.ai.budget',changed:'writing.ai.changed',done_before:'writing.ai.doneBefore',busy:'writing.ai.busy',empty:'writing.ai.empty'}[state.status]||'writing.ai.unavailable';return `<p class="ww-note" role="status">${esc(t(key))}</p>`;}
 const f=state.feedback,out=[`<h3 class="ww-section-title">${esc(t('writing.ai.title'))}</h3><p class="ww-note">${esc(t('writing.ai.reference'))}</p>`];
 if(f.kind==='blanks')out.push(`<ul class="ww-checks">${f.blanks.map(b=>`<li class="ww-check" data-fit="${esc(b.fit)}"><span class="ww-mark" lang="ko">${esc(blankMark(item,b.id))}</span><div><p class="ww-fit">${esc(t(`writing.ai.fit.${b.fit}`))}</p>${b.reason?`<p>${esc(b.reason)}</p>`:''}${b.better?`<p class="ww-expect"><small>${esc(t('writing.ai.better'))}</small> <span lang="ko">${esc(b.better)}</span></p>`:''}</div></li>`).join('')}</ul>`);
 else{
  out.push(`<ul class="ww-cats">${f.categories.map(c=>`<li class="ww-cat"><div class="ww-cat-head"><strong>${esc(t(`writing.ai.cat.${c.id}`))}</strong><span class="ww-range"><small>${esc(t('writing.ai.range'))}</small> ${esc(c.high===c.low?c.high:`${c.high}~${c.low}`)}</span></div>${c.good?`<p><small>${esc(t('writing.ai.good'))}</small> ${esc(c.good)}</p>`:''}${c.fix?`<p><small>${esc(t('writing.ai.fix'))}</small> ${esc(c.fix)}</p>`:''}${c.quote?`<p class="ww-quotes" lang="ko"><mark>${esc(c.quote)}</mark></p>`:''}</li>`).join('')}</ul><p class="ww-note">${esc(t('writing.ai.rangeNote'))}</p>`);
  if(f.missing?.length)out.push(`<p class="ww-model-label">${esc(t('writing.ai.missing'))}</p><ul>${f.missing.map(m=>`<li>${esc(m)}</li>`).join('')}</ul>`);
  if(f.rewrite?.to)out.push(`<p class="ww-model-label">${esc(t('writing.ai.rewrite'))}</p>${f.rewrite.from?`<p class="ww-quotes" lang="ko"><mark>${esc(f.rewrite.from)}</mark></p>`:''}<p class="ww-model-text" lang="ko">${esc(f.rewrite.to)}</p>${f.rewrite.why?`<p>${esc(f.rewrite.why)}</p>`:''}`);
 }
 if(f.note)out.push(`<p class="ww-note">${esc(f.note)}</p>`);
 return out.join('');
}
const uuid=()=>globalThis.crypto?.randomUUID?.()||'10000000-1000-4000-8000-100000000000'.replace(/[018]/g,c=>(c^globalThis.crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16));

/**
 * show(title, html): 호스트가 시트를 연다(app-shell의 show, type 'world-writing').
 * home: attachPanelResource로 시트가 닫힐 때 정리를 맡긴다. getOwner(): 지금 계정 id 또는 'guest'.
 * feedback: 로그인했고 그 통로가 있을 때만 {status():Promise<{enabled,dailyLimit,bankHash}>, request(payload):Promise<result>}.
 * coach(): 이 활동의 Atlas 코치(없거나 TOPIK II 쓰기 항목을 모르면 null/예외 — 그때는 기기 기록만 남긴다).
 */
export function createWritingPractice({show,home,getOwner=()=>'guest',storage=globalThis.localStorage,feedback=null,coach=null,now=Date.now,doc=globalThis.document,lang=currentLang,fetcher}={}){
 let bank=null,view={kind:'list'},owner=getOwner(),state=readStore(storage,owner),stage=null,ticker=null,offLang=null,shownAt=0,status=null,ai={},pids={},aiSeen={},results={},modelOpen={},stopped=false;
 const timerOn=()=>{try{return storage?.getItem(TIMER_KEY)!=='off';}catch{return true;}};
 const save=()=>writeStore(storage,owner,state);
 const item=id=>bank?.open.find(i=>i.id===id)||null;
 const draftOf=id=>state.drafts[id]||(state.drafts[id]={answer:item(id)?.type<=52?{}:'',spentMs:0,updatedAt:null,checkedAt:null});
 function syncOwner(){const next=getOwner();if(next!==owner){owner=next;state=readStore(storage,owner);ai={};pids={};aiSeen={};results={};status=null;}}
 function log(entry){state.log.push({...entry,at:new Date(now()).toISOString()});save();}
 function track(){if(view.kind!=='task'||!shownAt)return;const draft=draftOf(view.id),t0=shownAt;shownAt=now();draft.spentMs=(Number(draft.spentMs)||0)+Math.max(0,Math.min(shownAt-t0,120000));}
 function record(it,{assisted}){
  const c=typeof coach==='function'?(()=>{try{return coach();}catch{return null;}})():null;if(!c)return;
  try{
   pids[it.id]??=c.present({id:`writing-${it.id}`,itemKey:`writing.${it.id}`,familyKey:`writing.${it.id}`,skillId:WRITING_SKILLS[it.type],modality:'writing',difficulty:2,responseFormat:'unknown',audioRequired:false});
   if(assisted)c.help(pids[it.id],'hint');
   c.answer(pids[it.id],{correct:null,assessable:false,attemptNo:1});
  }catch{/* 코치 지도에 TOPIK II 쓰기 항목이 없으면 기기 기록만 남는다 */}
 }
 // ── 그리기 ──
 function listHtml(){
  const groups=TYPES.map(type=>{const rows=bank.open.filter(i=>i.type===type);if(!rows.length)return '';
   return `<section class="ww-group" aria-label="${esc(t(`writing.type.${type}`))}"><h3 class="ww-section-title">${esc(t(`writing.type.${type}`))}</h3>${rows.map(i=>{const d=state.drafts[i.id],has=d&&(typeof d.answer==='string'?d.answer.trim():Object.values(d.answer||{}).some(v=>String(v).trim()));
    return `<button class="ww-row" data-ww-open="${esc(i.id)}"><span class="ww-row-copy"><strong lang="ko">${esc(i.label)}</strong>${d?.checkedAt?`<small>${esc(t('writing.state.checked'))}</small>`:has?`<small>${esc(t('writing.state.draft'))}</small>`:''}</span><span class="ww-row-go" aria-hidden="true">→</span></button>`;}).join('')}</section>`;}).join('');
  const last=Object.entries(state.drafts).filter(([id,d])=>item(id)&&d.updatedAt).sort((a,b)=>String(b[1].updatedAt).localeCompare(String(a[1].updatedAt)))[0];
  const first=bank.open.find(i=>i.type===51)||bank.open[0];
  const mock=TYPES.every(type=>bank.open.some(i=>i.type===type))?`<section class="ww-group"><button class="ww-row" data-ww-mock><span class="ww-row-copy"><strong>${esc(t('writing.mock.title'))}</strong><small>${esc(t('writing.mock.sub'))}</small></span><span class="ww-row-go" aria-hidden="true">→</span></button></section>`:'';
  return `<div class="ww ww-list-view" data-ww-stage><p class="ww-lead">${esc(t('writing.lead'))}</p><p class="ww-note">${esc(t('writing.basis'))}</p>`
   +(first?`<button class="felt-button ww-primary" data-ww-open="${esc(last?last[0]:first.id)}">${esc(t(last?'writing.continue':'writing.start'))} <span aria-hidden="true">→</span></button>`:'')
   +groups+mock+`</div>`;
 }
 function answerHtml(it,draft){
  if(it.type<=52)return it.blanks.map(b=>{const value=String(draft.answer?.[b.id]??''),id=`ww-${it.id}-${b.id}`;
   return `<label class="ww-blank" for="${id}"><span class="ww-mark" lang="ko">${esc(b.mark)}</span><input id="${id}" lang="ko" type="text" autocomplete="off" spellcheck="false" data-ww-blank="${esc(b.id)}" value="${esc(value)}" maxlength="150"><span class="ww-counter" data-ww-count="${esc(b.id)}">${esc(t('writing.countOne',{n:writingLength(value.trim())}))}</span></label>`;}).join('');
  const value=String(draft.answer??''),id=`ww-${it.id}-text`;
  return `<label class="ww-text-label" for="${id}">${esc(t('writing.answer'))}</label><textarea id="${id}" lang="ko" spellcheck="false" data-ww-text rows="${it.type===54?16:9}">${esc(value)}</textarea><p class="ww-counter" data-ww-count="text" data-tone="${toneOf(it,value)}">${esc(t('writing.count',{n:writingLength(value),min:it.min,max:it.max}))}</p><p class="ww-note">${esc(t('writing.countNote'))}</p>`;
 }
 const toneOf=(it,value)=>{const n=writingLength(value);return n===0?'idle':n>=it.min&&n<=it.max?'ok':'check';};
 function timerText(it){
  if(view.mock){const left=MOCK_MS-(now()-state.mock.startedAt);return left>0?`${t('writing.timer.left')} ${clock(left)}`:t('writing.timer.up');}
  const spent=(Number(draftOf(it.id).spentMs)||0)+(shownAt?Math.max(0,now()-shownAt):0);
  return `${t('writing.timer.spent')} ${clock(spent)} · ${t('writing.timer.suggest',{n:SUGGEST[it.type]})}`;
 }
 function taskHtml(it){
  const draft=draftOf(it.id),on=timerOn(),mockStep=view.mock?state.mock.order.indexOf(it.id)+1:0,lastStep=view.mock&&mockStep===state.mock.order.length;
  return `<div class="ww ww-task" data-ww-stage data-type="${it.type}">`
   +`<div class="ww-bar"><button class="quiet-button" data-ww-back>← ${esc(t('writing.back'))}</button><span class="ww-type">${esc(t(`writing.type.${it.type}`))}${view.mock?` · ${esc(t('writing.mock.step',{n:mockStep}))}`:''}</span>`
   +`<span class="ww-timer" data-ww-timer ${on?'':'hidden'}>${esc(timerText(it))}</span><button class="quiet-button ww-timer-toggle" data-ww-timer-toggle aria-pressed="${on?'true':'false'}">${esc(t(on?'writing.timer.hide':'writing.timer.show'))}</button></div>`
   +`<section class="ww-question" lang="ko" aria-label="${esc(t('writing.exam'))}">${questionHtml(it)}</section>`
   +`<section class="ww-answer" aria-label="${esc(t('writing.answer'))}">${answerHtml(it,draft)}<p class="ww-note">${esc(t('writing.saved'))}</p></section>`
   +`<div class="ww-actions"><button class="felt-button" data-ww-check>${esc(t('writing.check.run'))}</button><button class="plain-button" data-ww-model aria-expanded="${modelOpen[it.id]?'true':'false'}">${esc(t(modelOpen[it.id]?'writing.model.hide':'writing.model.show'))}</button>`
   +(aiAvailable()?`<button class="plain-button" data-ww-ai ${ai[it.id]?.status==='sending'?'disabled':''}>${esc(t('writing.ai.button'))}</button>`:'')
   +(view.mock?`<button class="plain-button" data-ww-next>${esc(t(lastStep?'writing.finish':'writing.next'))}</button>`:'')
   +`<button class="quiet-button" data-ww-clear>${esc(t('writing.clear'))}</button></div>`
   +(aiAvailable()?`<p class="ww-note ww-ai-notice">${esc(t('writing.ai.notice',{n:status.dailyLimit}))}</p>`:'')
   +`<section class="ww-results" data-ww-results aria-live="polite">${results[it.id]?checksHtml(it,results[it.id]):''}</section>`
   +`<section class="ww-feedback" data-ww-feedback aria-live="polite">${ai[it.id]?feedbackHtml(it,ai[it.id]):''}</section>`
   +`<section class="ww-model" data-ww-model-out ${modelOpen[it.id]?'':'hidden'}>${modelOpen[it.id]?modelHtml(it):''}</section></div>`;
 }
 const aiAvailable=()=>!!(feedback&&status?.enabled&&status.bankHash===bank?.contentHash);
 function render(focus=null){
  if(stopped)return;syncOwner();
  const root=doc.querySelector('#panel-content [data-ww-stage]')?.parentElement;if(!root)return;
  const it=view.kind==='task'?item(view.id):null;if(view.kind==='task'&&!it)view={kind:'list'};
  root.innerHTML=view.kind==='task'?taskHtml(it):listHtml();stage=root.firstElementChild;
  (focus?stage.querySelector(focus):stage.querySelector('.ww-bar button, .ww-primary, .ww-row'))?.focus({preventScroll:false});
 }
 function refreshTimer(){if(view.kind!=='task')return;const el=stage?.querySelector('[data-ww-timer]'),it=item(view.id);if(el&&it&&!el.hidden)el.textContent=timerText(it);}
 function openTask(id,{mock=false}={}){track();view={kind:'task',id,mock};shownAt=now();render();}
 function answerOf(it){const d=draftOf(it.id);return it.type<=52?{...(d.answer||{})}:String(d.answer||'');}
 function runCheck(it){
  const answer=answerOf(it),result=checkWriting(it,answer),d=draftOf(it.id);
  results[it.id]=result;d.checkedAt=new Date(now()).toISOString();
  log({source:'rule-check',itemId:it.id,type:it.type,length:it.type<=52?null:writingLength(answer),checks:result.items.filter(i=>i.level==='check').map(i=>i.id),assisted:!!aiSeen[it.id]});
  record(it,{assisted:!!aiSeen[it.id]});
  const box=stage.querySelector('[data-ww-results]');if(box){box.innerHTML=checksHtml(it,result);box.querySelector('h3')?.setAttribute('tabindex','-1');box.querySelector('h3')?.focus();}
 }
 async function askFeedback(it){
  const answer=answerOf(it),empty=it.type<=52?!Object.values(answer).some(v=>String(v).trim()):!answer.trim();
  if(empty){ai[it.id]={status:'empty'};paintFeedback(it);return;}
  const expected=owner;ai[it.id]={status:'sending'};paintFeedback(it);
  let result;
  try{result=await feedback.request({action:'feedback',request_id:uuid(),consent:'send-once',item_id:it.id,bank_hash:bank.contentHash,answer,lang:['ko','en','mn'].includes(lang())?lang():'ko'});}
  catch(error){result={status:error?.code==='ITEM_CHANGED'||error?.code==='ITEM_NOT_OPEN'?'changed':'unavailable'};}
  if(stopped||expected!==getOwner())return;
  ai[it.id]=result?.status==='ok'&&result.feedback?{status:'ok',feedback:result.feedback}:{status:result?.status||'unavailable'};
  if(ai[it.id].status==='ok'){aiSeen[it.id]=true;const f=result.feedback;log({source:'ai-reference',itemId:it.id,type:it.type,
   ...(f.kind==='blanks'?{fits:f.blanks.map(b=>b.fit)}:{ranges:Object.fromEntries(f.categories.map(c=>[c.id,`${c.high}${c.low}`]))})});}
  if(view.kind==='task'&&view.id===it.id)paintFeedback(it);
 }
 function paintFeedback(it){const box=stage?.querySelector('[data-ww-feedback]');if(box)box.innerHTML=feedbackHtml(it,ai[it.id]);const button=stage?.querySelector('[data-ww-ai]');if(button)button.disabled=ai[it.id]?.status==='sending';}
 function startMock(){
  const order=TYPES.map(type=>{const pool=bank.open.filter(i=>i.type===type);return pool[Math.floor((now()/60000)%pool.length)]?.id;}).filter(Boolean);
  state.mock={startedAt:now(),order};save();openTask(order[0],{mock:true});
 }
 function nextMock(){track();const order=state.mock?.order||[],at=order.indexOf(view.id);
  if(at>=0&&at<order.length-1){view={kind:'task',id:order[at+1],mock:true};shownAt=now();render();return;}
  state.mock=null;save();view={kind:'list'};render();home?.toast?.(t('writing.mock.done'));
 }
 // ── 입력·단추(시트 안 위임) ──
 function onInput(event){
  const it=view.kind==='task'?item(view.id):null;if(!it)return;const d=draftOf(it.id),el=event.target;
  if(el.matches('[data-ww-blank]')){d.answer={...(d.answer||{}),[el.dataset.wwBlank]:el.value};const c=stage.querySelector(`[data-ww-count="${el.dataset.wwBlank}"]`);if(c)c.textContent=t('writing.countOne',{n:writingLength(el.value.trim())});}
  else if(el.matches('[data-ww-text]')){d.answer=el.value;const c=stage.querySelector('[data-ww-count="text"]');if(c){c.textContent=t('writing.count',{n:writingLength(el.value),min:it.min,max:it.max});c.dataset.tone=toneOf(it,el.value);}}
  else return;
  d.updatedAt=new Date(now()).toISOString();save();
 }
 function onClick(event){
  const button=event.target.closest('button');if(!button||!stage?.contains(button))return;
  const it=view.kind==='task'?item(view.id):null;
  if(button.dataset.wwOpen){openTask(button.dataset.wwOpen);return;}
  if(button.hasAttribute('data-ww-mock')){startMock();return;}
  if(button.hasAttribute('data-ww-back')){track();save();view={kind:'list'};render();return;}
  if(!it)return;
  if(button.hasAttribute('data-ww-check')){track();save();runCheck(it);}
  else if(button.hasAttribute('data-ww-model')){modelOpen[it.id]=!modelOpen[it.id];const box=stage.querySelector('[data-ww-model-out]');box.hidden=!modelOpen[it.id];box.innerHTML=modelOpen[it.id]?modelHtml(it):'';button.setAttribute('aria-expanded',String(!!modelOpen[it.id]));button.textContent=t(modelOpen[it.id]?'writing.model.hide':'writing.model.show');}
  else if(button.hasAttribute('data-ww-ai'))void askFeedback(it);
  else if(button.hasAttribute('data-ww-next'))nextMock();
  else if(button.hasAttribute('data-ww-timer-toggle')){const on=!timerOn();try{storage?.setItem(TIMER_KEY,on?'on':'off');}catch{}render('[data-ww-timer-toggle]');}
  else if(button.hasAttribute('data-ww-clear')){if(doc.defaultView?.confirm&&!doc.defaultView.confirm(t('writing.clearAsk')))return;delete state.drafts[it.id];delete results[it.id];delete ai[it.id];delete aiSeen[it.id];save();shownAt=now();render();}
 }
 function mount(){
  const root=doc.querySelector('#panel-content [data-ww-stage]')?.parentElement;if(!root)return false;
  root.addEventListener('input',onInput);root.addEventListener('click',onClick);
  ticker=setInterval(()=>{if(doc.visibilityState==='hidden'){track();shownAt=0;return;}if(view.kind==='task'&&!shownAt)shownAt=now();refreshTimer();},1000);
  offLang=onLang(()=>render());
  home?.attachPanelResource?.({dispose:()=>{track();save();clearInterval(ticker);ticker=null;offLang?.();offLang=null;root.removeEventListener('input',onInput);root.removeEventListener('click',onClick);stage=null;}});
  return true;
 }
 async function open(route='writing'){
  stopped=false;syncOwner();
  show(t('writing.title'),`<div class="ww" data-ww-stage><p class="ww-note" role="status">…</p></div>`);
  if(!mount())return;
  try{bank=await loadWritingBank(fetcher);}catch{const root=doc.querySelector('#panel-content [data-ww-stage]');if(root)root.innerHTML=`<p class="ww-note" role="alert">${esc(t('writing.loadError'))}</p>`;return;}
  if(feedback&&!status){try{status=await feedback.status();}catch{status={enabled:false};}}
  const [,which]=String(route).split(':'),type=Number(which);
  if(which==='mock'&&TYPES.every(ty=>bank.open.some(i=>i.type===ty))){startMock();return;}
  if(TYPES.includes(type)){const pick=bank.open.find(i=>i.type===type&&!state.drafts[i.id]?.checkedAt)||bank.open.find(i=>i.type===type);if(pick){openTask(pick.id);return;}}
  if(item(which)){openTask(which);return;}
  view={kind:'list'};render();
 }
 return {open,hasDraft:()=>Object.values(state.drafts).some(d=>d.updatedAt),dispose(){stopped=true;track();save();clearInterval(ticker);ticker=null;offLang?.();offLang=null;}};
}
