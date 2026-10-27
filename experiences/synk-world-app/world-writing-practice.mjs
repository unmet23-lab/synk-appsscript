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
import {FOCUS_TYPE,readFocus,focusState,focusOutcome,focusNeed,drillPool,drillDeck,recordFocusOutcome,recordDrillPick,retryItem,mySentences,endsPlain,sameBefore} from './world-writing-focus.mjs';
if(globalThis.document&&!document.querySelector('[data-writing-style]')){const style=document.createElement('link');style.rel='stylesheet';style.href=new URL('./world-writing.css',import.meta.url).href;style.dataset.writingStyle='true';document.head.append(style);}

// TOPIK II 연습 지도(strata/topik-ii.skills.json · 세션 ②)의 쓰기 항목과 이어지는 자리.
export const WRITING_SKILLS=Object.freeze({51:'ko2.writing.sentence',52:'ko2.writing.sentence',53:'ko2.writing.description',54:'ko2.writing.argument'});
// 계획 엔진(세션 ①)이 받는 후보: 쓰기 + 규칙 점검을 보는 데 드는 어림 분.
export const WRITING_CANDIDATES=Object.freeze([51,52,53,54].map(type=>Object.freeze({id:`topik2-writing-${type}`,route:`writing:${type}`,minutes:{51:8,52:8,53:18,54:35}[type],targets:Object.freeze([WRITING_SKILLS[type]]),area:'writing',exam:'topik2'}))
 .concat(Object.freeze({id:'topik2-writing-mock',route:'writing:mock',minutes:55,targets:Object.freeze([...new Set(Object.values(WRITING_SKILLS))]),area:'writing',exam:'topik2'})));
/** 계획 엔진이 받는 쓰기 후보(이 기기 기록으로): 「한 가지 고치기」가 열려 있고 마지막 결과가 7일 안이면 53번 후보에 practiceNeed
 *  (Core가 급한 줄로 올리고 Vellum이 「처음에 놓친 부분을…」·「도움과 함께 해낸…」을 말한다)와 그 단계의 어림 분(연습 전 5분)을 붙인다. */
export function writingCandidates({storage=globalThis.localStorage,owner='guest',now=Date.now()}={}){
 const state=readStore(storage,owner),need=focusNeed(state.focus,{now}),st=focusState(state.focus,{now});
 if(!need)return WRITING_CANDIDATES;
 // 도움 받고 고친 뒤 혼자 다시 쓸 53번(예시답·자동 피드백을 본 적 없는 문항)이 없으면 연습 화면에 할 일이 없다 — 급한 줄로 밀지 않는다.
 if(need.kind==='assisted'&&openBank&&!retryItem(openBank,{state:st,drafts:state.drafts,helped:state.helped}))return WRITING_CANDIDATES;
 const drilled=!!st.drill;
 return WRITING_CANDIDATES.map(row=>row.route===`writing:${FOCUS_TYPE}`?Object.freeze({...row,minutes:drilled?row.minutes:5,practiceNeed:need}):row);
}
// 50분 가운데 문항별 권장 시간(분). 시험장에서 흔히 나누는 비율이며 공식 배분이 아니다.
const SUGGEST=Object.freeze({51:5,52:5,53:12,54:28});
const TYPES=[51,52,53,54],MOCK_MS=50*60000,LOG_MAX=200,SEND_MAX=Object.freeze({51:150,52:150,53:600,54:1400});
const storeKey=owner=>`synk.world.writing.v1:${owner||'guest'}`,TIMER_KEY='synk.world.writing.timer';
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const pad=n=>String(n).padStart(2,'0');
// 자동 피드백 설명 칸(화면 언어)에 섞인 한국어 조각(「-다」·「그래서」 같은 예시)은 lang="ko" 칸으로 감싼다 — 한 자리 한 언어.
const KO_RUN=/([「『“"'(\-~]*[가-힣ㄱ-ㅎㅏ-ㅣ]+(?:[\s\-~·]*[가-힣ㄱ-ㅎㅏ-ㅣ]+)*[」』”"')]*)/g;
const explain=(text,lang)=>lang==='ko'?esc(text):String(text??'').split(KO_RUN).map((part,i)=>i%2?`<span lang="ko">${esc(part)}</span>`:esc(part)).join('');
const clock=ms=>{const s=Math.max(0,Math.round(ms/1000));return `${pad(Math.floor(s/60))}:${pad(s%60)}`;};

// helped: 문항별로 예시답(answer)·자동 피드백(hint)을 처음 본 시각. 새로 고침·「지우기」 뒤에도 남는다 — 「혼자 해냄」 판정과 Trail 도움 기록이 읽는다.
// focus: 「한 가지 고치기」(world-writing-focus.mjs) 기록. 둘 다 이 기기에만 둔다.
const helpedOf=value=>Object.fromEntries(Object.entries(value&&typeof value==='object'?value:{}).filter(([,h])=>h&&typeof h==='object').map(([id,h])=>[id,{...(typeof h.answer==='string'?{answer:h.answer}:{}),...(typeof h.hint==='string'?{hint:h.hint}:{})}]));
function readStore(storage,owner){try{const v=JSON.parse(storage?.getItem(storeKey(owner))||'null');if(v&&typeof v==='object'&&v.drafts&&typeof v.drafts==='object')return {drafts:v.drafts,log:Array.isArray(v.log)?v.log:[],mock:v.mock||null,helped:helpedOf(v.helped),focus:readFocus(v.focus,{history:v.log})};}catch{}return {drafts:{},log:[],mock:null,helped:{},focus:readFocus(null)};}
function writeStore(storage,owner,state){try{storage?.setItem(storeKey(owner),JSON.stringify({drafts:state.drafts,log:state.log.slice(-LOG_MAX),mock:state.mock,helped:state.helped,focus:readFocus(state.focus)}));return true;}catch{return false;}}
/** 계획 엔진·내 위치가 읽는 연습 요약(이 기기 기록). 자동 피드백 결과는 시도 수에 더하지 않고 따로 센다.
 *  times: 규칙 점검 시도 시각(ISO) — 시험 계획이 이번 주 쓰기 횟수를 센다(Trail에 쓰기 기록이 생기기 전까지 · ① 세션 10-21). */
export function readWritingSummary({storage=globalThis.localStorage,owner='guest'}={}){
 const state=readStore(storage,owner),attempts={51:0,52:0,53:0,54:0},feedback={51:0,52:0,53:0,54:0},times=[];let ms=0,lastAt=null;
 for(const entry of state.log){if(!TYPES.includes(entry.type))continue;if(entry.source==='rule-check'){attempts[entry.type]++;times.push(entry.at);}if(entry.source==='ai-reference')feedback[entry.type]++;if(!lastAt||entry.at>lastAt)lastAt=entry.at;}
 for(const draft of Object.values(state.drafts))ms+=Number(draft?.spentMs)||0;
 return {attempts,feedback,minutes:Math.round(ms/60000),lastAt,times};
}
/** 배우기 판(life-ui.mjs)의 「내 위치」 아래 한 줄. print는 life-ui의 펠트 인화지 함수다.
 *  검수를 통과해 열린 문항이 있을 때만 보인다(문항 은행을 아직 못 읽었거나 열린 문항이 없으면 줄이 없다 — 빈 화면으로 가는 단추를 두지 않는다). */
export function writingRow(print=()=>''){
 // 읽기가 실패해 은행이 없으면 다시 읽어 두고, 열린 문항이 생기면 호스트에 알린다(app-shell이 판을 다시 칠한다).
 if(!openCount){if(!bankPromise)void loadWritingBank().then(()=>{if(openCount)globalThis.dispatchEvent?.(new Event('synk-writing-ready'));}).catch(()=>{});return '';}
 return `<button class="life-row" data-world="writing">${print('sentence','life-row-print')}<span class="life-row-copy"><strong>${esc(t('writing.row.title'))}</strong><small>${esc(t('writing.row.sub'))}</small></span></button>`;
}
let bankPromise=null,openCount=0,openBank=null;
export const writingReady=()=>openCount>0;
export function loadWritingBank(fetcher=(...args)=>globalThis.fetch(...args),url=new URL('./world-writing-items.json',import.meta.url)){
 bankPromise||=Promise.resolve(fetcher(url,{cache:'no-cache'})).then(r=>{if(!r.ok)throw Error('WRITING_BANK');return r.json();}).then(bank=>{
  if(!bank||!Array.isArray(bank.items))throw Error('WRITING_BANK');
  const open=bank.items.filter(item=>item?.review?.status==='passed'&&TYPES.includes(item.type));openCount=open.length;openBank=open;
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
function feedbackHtml(item,state,lang='ko'){
 const ex=text=>explain(text,lang);
 if(state.status==='sending')return `<p class="ww-note" role="status">${esc(t('writing.ai.sending'))}</p>`;
 if(state.status!=='ok'){const key={limit:'writing.ai.limit',budget:'writing.ai.budget',changed:'writing.ai.changed',done_before:'writing.ai.doneBefore',busy:'writing.ai.busy',empty:'writing.ai.empty',too_long:'writing.ai.tooLong'}[state.status]||'writing.ai.unavailable';return `<p class="ww-note" role="status">${esc(t(key,{n:SEND_MAX[item.type]}))}</p>`;}
 const f=state.feedback,out=[`<h3 class="ww-section-title">${esc(t('writing.ai.title'))}</h3><p class="ww-note">${esc(t('writing.ai.reference'))}</p>`];
 if(f.kind==='blanks')out.push(`<ul class="ww-checks">${f.blanks.map(b=>`<li class="ww-check" data-fit="${esc(b.fit)}"><span class="ww-mark" lang="ko">${esc(blankMark(item,b.id))}</span><div><p class="ww-fit">${esc(t(`writing.ai.fit.${b.fit}`))}</p>${b.reason?`<p>${ex(b.reason)}</p>`:''}${b.better?`<p class="ww-expect"><small>${esc(t('writing.ai.better'))}</small> <span lang="ko">${esc(b.better)}</span></p>`:''}</div></li>`).join('')}</ul>`);
 else{
  out.push(`<ul class="ww-cats">${f.categories.map(c=>`<li class="ww-cat"><div class="ww-cat-head"><strong>${esc(t(`writing.ai.cat.${c.id}`))}</strong><span class="ww-range"><small>${esc(t('writing.ai.range'))}</small> ${esc(c.high===c.low?c.high:`${c.high}~${c.low}`)}</span></div>${c.good?`<p><small>${esc(t('writing.ai.good'))}</small> ${ex(c.good)}</p>`:''}${c.fix?`<p><small>${esc(t('writing.ai.fix'))}</small> ${ex(c.fix)}</p>`:''}${c.quote?`<p class="ww-quotes" lang="ko"><mark>${esc(c.quote)}</mark></p>`:''}</li>`).join('')}</ul><p class="ww-note">${esc(t('writing.ai.rangeNote'))}</p>`);
  if(f.missing?.length)out.push(`<p class="ww-model-label">${esc(t('writing.ai.missing'))}</p><ul>${f.missing.map(m=>`<li>${ex(m)}</li>`).join('')}</ul>`);
  if(f.rewrite?.to)out.push(`<p class="ww-model-label">${esc(t('writing.ai.rewrite'))}</p>${f.rewrite.from?`<p class="ww-quotes" lang="ko"><mark>${esc(f.rewrite.from)}</mark></p>`:''}<p class="ww-model-text" lang="ko">${esc(f.rewrite.to)}</p>${f.rewrite.why?`<p>${ex(f.rewrite.why)}</p>`:''}`);
 }
 if(f.note)out.push(`<p class="ww-note">${ex(f.note)}</p>`);
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
 let openSeq=0,tries={},bank=null,view={kind:'list'},owner=getOwner(),state=readStore(storage,owner),stage=null,ticker=null,offLang=null,shownAt=0,status=null,ai={},pids={},results={},modelOpen={},focusNotes={},drill=null,mine={},stopped=false;
 const timerOn=()=>{try{return storage?.getItem(TIMER_KEY)!=='off';}catch{return true;}};
 const save=()=>writeStore(storage,owner,state);
 const item=id=>bank?.open.find(i=>i.id===id)||null;
 const draftOf=id=>state.drafts[id]||(state.drafts[id]={answer:item(id)?.type<=52?{}:'',spentMs:0,updatedAt:null,checkedAt:null});
 function syncOwner(){const next=getOwner();if(next!==owner){owner=next;state=readStore(storage,owner);ai={};pids={};tries={};results={};focusNotes={};drill=null;mine={};status=null;view={kind:'list'};shownAt=0;}}
 // 예시답(answer)·자동 피드백(hint)을 본 문항은 기기에 남긴다(처음 본 시각만).
 const helpedNow=id=>!!(state.helped[id]?.answer||state.helped[id]?.hint);
 function markHelped(id,kind){const h=state.helped[id]||(state.helped[id]={});h[kind]??=new Date(now()).toISOString();save();paintBanner();}
 function log(entry){state.log.push({...entry,at:new Date(now()).toISOString()});save();}
 function track(){if(view.kind!=='task'||!shownAt)return;const draft=draftOf(view.id),t0=shownAt;shownAt=now();draft.spentMs=(Number(draft.spentMs)||0)+Math.max(0,Math.min(shownAt-t0,120000));}
 function record(it){
  const c=typeof coach==='function'?(()=>{try{return coach();}catch{return null;}})():null;if(!c)return;
  try{
   pids[it.id]??=c.present({id:`writing-${it.id}`,itemKey:`writing.${it.id}`,familyKey:`writing.${it.id}`,skillId:WRITING_SKILLS[it.type],modality:'writing',difficulty:2,responseFormat:'unknown',audioRequired:false});
   // 예시답을 본 뒤는 answer, 자동 피드백을 받은 뒤는 hint 도움(기기에 남은 기록 — 새로 고침 뒤에도 「혼자」로 세지 않는다).
   const helped=state.helped[it.id]||{};if(helped.answer)c.help(pids[it.id],'answer');if(helped.hint)c.help(pids[it.id],'hint');
   tries[it.id]=(tries[it.id]||0)+1;c.answer(pids[it.id],{correct:null,assessable:false,attemptNo:tries[it.id]});
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
  return `<div class="ww ww-list-view" data-ww-stage><p class="ww-lead">${esc(t('writing.lead'))}</p><p class="ww-note">${esc(t('writing.basis'))}</p>`+focusSummaryHtml()
   +(first?`<button class="felt-button ww-primary" data-ww-open="${esc(last?last[0]:first.id)}">${esc(last?t('writing.continue'):t('writing.startAt',{n:first.type}))} <span aria-hidden="true">→</span></button>`:'')
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
  if(view.mock&&state.mock){const left=MOCK_MS-(now()-state.mock.startedAt);return left>0?`${t('writing.timer.left')} ${clock(left)}`:t('writing.timer.up');}
  const spent=(Number(draftOf(it.id).spentMs)||0)+(shownAt?Math.max(0,now()-shownAt):0);
  return `${t('writing.timer.spent')} ${clock(spent)} · ${t('writing.timer.suggest',{n:SUGGEST[it.type]})}`;
 }
 function taskHtml(it){
  if(view.mock&&!state.mock)view={...view,mock:false};
  const draft=draftOf(it.id),on=timerOn(),mockStep=view.mock?state.mock.order.indexOf(it.id)+1:0,lastStep=view.mock&&mockStep===state.mock.order.length;
  return `<div class="ww ww-task" data-ww-stage data-type="${it.type}">`
   +`<div class="ww-bar"><button class="quiet-button" data-ww-back>← ${esc(t('writing.back'))}</button><span class="ww-type">${esc(t(`writing.type.${it.type}`))}${view.mock?` · ${esc(t('writing.mock.step',{n:mockStep}))}`:''}</span>`
   +`<span class="ww-timer" data-ww-timer ${on?'':'hidden'}>${esc(timerText(it))}</span><button class="quiet-button ww-timer-toggle" data-ww-timer-toggle aria-pressed="${on?'true':'false'}">${esc(t(on?'writing.timer.hide':'writing.timer.show'))}</button></div>`
   +focusBannerHtml(it)
   // 문제지와 답안은 한 줄(.ww-pair)로 묶는다 — 넓은 판의 문제지 sticky가 이 줄 안에서만 붙어 아래 점검·카드를 덮지 않게.
   +`<div class="ww-pair"><section class="ww-question" lang="ko" aria-label="${esc(t('writing.exam'))}">${questionHtml(it)}</section>`
   +`<section class="ww-answer" aria-label="${esc(t('writing.answer'))}">${answerHtml(it,draft)}<p class="ww-note">${esc(t('writing.saved'))}</p></section></div>`
   +`<div class="ww-actions-wrap" data-ww-actions>${actionsHtml(it,lastStep)}</div>`
   +`<section class="ww-results" data-ww-results aria-live="polite">${results[it.id]?focusCardHtml(it)+checksHtml(it,results[it.id]):''}</section>`
   +`<section class="ww-feedback" data-ww-feedback aria-live="polite">${ai[it.id]?feedbackHtml(it,ai[it.id],lang()):''}</section>`
   +`<section class="ww-model" data-ww-model-out ${modelOpen[it.id]?'':'hidden'}>${modelOpen[it.id]?modelHtml(it):''}</section></div>`;
 }
 function actionsHtml(it,lastStep){
  const sending=ai[it.id]?.status==='sending';
  return `<div class="ww-actions"><button class="felt-button" data-ww-check>${esc(t('writing.check.run'))}</button><button class="plain-button" data-ww-model aria-expanded="${modelOpen[it.id]?'true':'false'}">${esc(t(modelOpen[it.id]?'writing.model.hide':'writing.model.show'))}</button>`
   +(aiAvailable()?`<button class="plain-button" data-ww-ai ${sending?'disabled':''}>${esc(t('writing.ai.button'))}</button>`:'')
   +(view.mock?`<button class="plain-button" data-ww-next>${esc(t(lastStep?'writing.finish':'writing.next'))}</button>`:'')
   +`<button class="quiet-button" data-ww-clear ${sending?'disabled':''}>${esc(t('writing.clear'))}</button></div>`
   +(aiAvailable()?`<p class="ww-note ww-ai-notice">${esc(t('writing.ai.notice',{n:status.dailyLimit}))}</p>`:'');
 }
 function paintActions(){const it=view.kind==='task'?item(view.id):null,box=stage?.querySelector('[data-ww-actions]');if(!it||!box)return;const last=view.mock&&state.mock?state.mock.order.indexOf(it.id)===state.mock.order.length-1:false;box.innerHTML=actionsHtml(it,last);}
 const aiAvailable=()=>!!(feedback&&status?.enabled&&status.bankHash===bank?.contentHash);
 function render(focus=null){
  if(stopped)return;syncOwner();
  const root=doc.querySelector('#panel-content [data-ww-stage]')?.parentElement;if(!root)return;
  const it=view.kind==='task'?item(view.id):null;if(view.kind==='task'&&!it)view={kind:'list'};
  root.innerHTML=view.kind==='task'?taskHtml(it):view.kind==='focus'?focusHtml():listHtml();stage=root.firstElementChild;
  (focus?stage.querySelector(focus):stage.querySelector('.ww-bar button, .ww-primary, .ww-row'))?.focus({preventScroll:false});
 }
 function refreshTimer(){if(view.kind!=='task')return;const el=stage?.querySelector('[data-ww-timer]'),it=item(view.id);if(el&&it&&!el.hidden)el.textContent=timerText(it);}
 function openTask(id,{mock=false}={}){track();view={kind:'task',id,mock};shownAt=now();render();}
 function answerOf(it){const d=draftOf(it.id);return it.type<=52?{...(d.answer||{})}:String(d.answer||'');}
 function runCheck(it){
  const answer=answerOf(it),result=checkWriting(it,answer),d=draftOf(it.id);
  results[it.id]=result;
  const empty=it.type<=52?!Object.values(answer).some(v=>String(v).trim()):!String(answer).trim();
  if(empty){const box=stage.querySelector('[data-ww-results]');if(box)box.innerHTML=checksHtml(it,result);return;}
  d.checkedAt=new Date(now()).toISOString();
  // 53번: 「한 가지 고치기」 결과(world-writing-focus.mjs). 「지난 글에서도」는 이 점검을 적기 전의 기록으로 센다.
  if(it.type===FOCUS_TYPE){
   const again=sameBefore(state.log,it.id),out=focusOutcome({item:it,text:answer,result,state:focusState(state.focus,{now:now()}),assisted:helpedNow(it.id)});
   // 연속으로 같은 결과를 확인할 때만 합친다. 그 사이 다시 틀렸으면 고친 결과도 새로 남긴다.
   if(out)state.focus=recordFocusOutcome(state.focus,{at:d.checkedAt,itemId:it.id,...out});
   focusNotes[it.id]=out?{...out,again}:null;
  }
  log({source:'rule-check',itemId:it.id,type:it.type,length:it.type<=52?null:writingLength(answer),checks:result.items.filter(i=>i.level==='check').map(i=>i.id),assisted:helpedNow(it.id)});
  record(it);paintBanner();
  const box=stage.querySelector('[data-ww-results]');if(box){box.innerHTML=focusCardHtml(it)+checksHtml(it,result);box.querySelector('h3')?.setAttribute('tabindex','-1');box.querySelector('h3')?.focus();}
 }
 async function askFeedback(it){
  if(ai[it.id]?.status==='sending')return;
  const answer=answerOf(it),empty=it.type<=52?!Object.values(answer).some(v=>String(v).trim()):!answer.trim();
  if(empty){ai[it.id]={status:'empty'};paintFeedback(it);return;}
  const over=it.type<=52?Object.values(answer).some(v=>writingLength(String(v).trim())>SEND_MAX[it.type]):writingLength(answer.trim())>SEND_MAX[it.type];
  if(over){ai[it.id]={status:'too_long'};paintFeedback(it);return;}
  const expected=owner;ai[it.id]={status:'sending'};paintFeedback(it);
  let result;
  try{result=await feedback.request({action:'feedback',request_id:uuid(),consent:'send-once',item_id:it.id,bank_hash:bank.contentHash,answer,lang:['ko','en','mn'].includes(lang())?lang():'ko'});}
  catch(error){result={status:error?.code==='ITEM_CHANGED'||error?.code==='ITEM_NOT_OPEN'?'changed':error?.code==='ANSWER_TOO_LONG'?'too_long':'unavailable'};}
  if(stopped||expected!==getOwner())return;
  ai[it.id]=result?.status==='ok'&&result.feedback?{status:'ok',feedback:result.feedback}:{status:result?.status||'unavailable'};
  if(ai[it.id].status==='ok'){markHelped(it.id,'hint');const f=result.feedback;log({source:'ai-reference',itemId:it.id,type:it.type,
   ...(f.kind==='blanks'?{fits:f.blanks.map(b=>b.fit)}:{ranges:Object.fromEntries(f.categories.map(c=>[c.id,`${c.high}${c.low}`]))})});}
  if(view.kind==='task'&&view.id===it.id)paintFeedback(it);
 }
 function paintFeedback(it){const box=stage?.querySelector('[data-ww-feedback]');if(box)box.innerHTML=feedbackHtml(it,ai[it.id],lang());const sending=ai[it.id]?.status==='sending';for(const sel of ['[data-ww-ai]','[data-ww-clear]']){const button=stage?.querySelector(sel);if(button)button.disabled=sending;}}
 function startMock(){
  const order=TYPES.map(type=>{const pool=bank.open.filter(i=>i.type===type);return pool[Math.floor((now()/60000)%pool.length)]?.id;}).filter(Boolean);
  state.mock={startedAt:now(),order};save();openTask(order[0],{mock:true});
 }
 function nextMock(){track();const order=state.mock?.order||[],at=order.indexOf(view.id);
  if(at>=0&&at<order.length-1){view={kind:'task',id:order[at+1],mock:true};shownAt=now();render();return;}
  state.mock=null;save();view={kind:'list'};render();home?.toast?.(t('writing.mock.done'));
 }
 // ── 한 가지 고치기(53번 글의 끝맺음 · world-writing-focus.mjs) ──
 const focusNow=()=>focusState(state.focus,{now:now()});
 const binName=bin=>t(`writing.focus.bin.${bin}`);
 const BIN_FORM={formal:'-습니다',polite:'-아요',plain:'-다'};
 // 이번 차례의 사건(열린 차례, 닫혔으면 마지막으로 닫힌 차례): 목록 요약이 「도움 받고 고친 글」·「혼자 다시 쓴 글」을 나눠 보인다.
 // 차례는 「혼자 해냄」을 경계로 센다 — 기록 상한(20)으로 처음 「찾음」이 잘려도 요약이 사라지지 않게.
 function focusRound(){const st=focusNow();return st.open?st.round:st.closedRound;}
 // 점검 바로 위 카드: 이번 점검이 한 가지 고치기의 어느 결과였는지(사실 수치와 함께). 결과가 없으면 비운다.
 function focusCardHtml(it){
  const note=focusNotes[it.id];if(!note||it.type!==FOCUS_TYPE)return '';
  const counts=`<p class="ww-focus-count">${esc(t('writing.focus.counts',{plain:note.plain,total:note.total}))}</p>`;
  if(note.kind==='found'||note.kind==='retry')return `<div class="ww-focus" data-ww-focus-card="${note.kind}"><h3 class="ww-section-title">${esc(t('writing.focus.title'))}</h3>`
   +`<p>${esc(t('writing.focus.found',{off:note.off,total:note.total}))}</p><p class="ww-focus-forms" lang="ko"><span class="ww-chip">-습니다</span> <span class="ww-chip">-아요</span> → <span class="ww-chip">-다</span></p>`
   +`<p class="ww-note">${esc(t('writing.focus.why'))}</p>${note.again?`<p class="ww-note">${esc(t('writing.focus.again'))}</p>`:''}`
   +`<div class="ww-actions"><button class="plain-button" data-ww-focus-go>${esc(t('writing.focus.start'))} <span aria-hidden="true">→</span></button></div></div>`;
  // 혼자 해낸 뒤 원래 글을 고친 helped(닫힌 차례)에는 「도움 없이 다른 53번」을 다시 권하지 않는다.
  if(note.kind==='helped'&&!focusNow().open)return `<div class="ww-focus" data-ww-focus-card="helped"><h3 class="ww-section-title">${esc(t('writing.focus.title'))}</h3><p>${esc(t('writing.focus.helped'))}</p>${counts}<p class="ww-note">${esc(t('writing.focus.summary.doneAll'))}</p><p class="ww-note">${esc(t('writing.focus.limit'))}</p></div>`;
  if(note.kind==='helped')return `<div class="ww-focus" data-ww-focus-card="helped"><h3 class="ww-section-title">${esc(t('writing.focus.title'))}</h3><p>${esc(t('writing.focus.helped'))}</p>${counts}`
   +`<p class="ww-note">${esc(t('writing.focus.limit'))}</p><p>${esc(t('writing.focus.nextAlone'))}</p>${retryItem(bank.open,{state:focusNow(),drafts:state.drafts,helped:state.helped})?`<div class="ww-actions"><button class="plain-button" data-ww-focus-retry>${esc(t('writing.focus.retry'))} <span aria-hidden="true">→</span></button></div>`:`<p class="ww-note">${esc(t('writing.focus.noRetry'))}</p>`}</div>`;
  return `<div class="ww-focus" data-ww-focus-card="independent"><h3 class="ww-section-title">${esc(t('writing.focus.title'))}</h3><p>${esc(t('writing.focus.independent'))}</p>${counts}<p class="ww-note">${esc(t('writing.focus.limit'))}</p></div>`;
 }
 // 고치는 중에 연 다른 53번: 위에 「도움 없이」 안내(이미 도움을 본 문항이면 그 사실).
 function focusBannerHtml(it){
  const st=focusNow();if(it.type!==FOCUS_TYPE||!st.open||st.everFound.has(it.id))return '';
  return `<p class="ww-focus-banner" data-ww-focus-banner>${esc(t(helpedNow(it.id)?'writing.focus.bannerHelped':'writing.focus.banner'))}</p>`;
 }
 // 목록 맨 위: 고치는 중이거나 혼자 해낸 지 14일 안이면 두 결과를 나눠 보인다.
 function focusSummaryHtml(){
  const round=focusRound(),st=focusNow();if(!round.length)return '';
  const alone=round.find(e=>e.kind==='independent');if(!st.open&&(!alone||now()-Date.parse(alone.at)>14*86400000))return '';
  const helped=round.some(e=>e.kind==='helped'),stuck=st.open&&!retryItem(bank.open,{state:st,drafts:state.drafts,helped:state.helped});
  const row=(key,done)=>`<li data-done="${done?'true':'false'}"><span>${esc(t(key))}</span><strong>${esc(t(done?'writing.focus.summary.done':'writing.focus.summary.notYet'))}</strong></li>`;
  return `<section class="ww-focus ww-focus-summary" data-ww-focus-summary><h3 class="ww-section-title">${esc(t('writing.focus.title'))}</h3><ul class="ww-focus-rows">${row('writing.focus.summary.helped',helped)}${row('writing.focus.summary.alone',!!alone)}</ul>`
   +(stuck?`<p class="ww-note">${esc(t('writing.focus.noRetry'))}</p>`:'')+(st.open?`<div class="ww-actions"><button class="plain-button" data-ww-focus-go>${esc(t('writing.focus.summary.continue'))} <span aria-hidden="true">→</span></button></div>`:`<p class="ww-note">${esc(t('writing.focus.summary.doneAll'))}</p><p class="ww-note">${esc(t('writing.focus.limit'))}</p>`)+`</section>`;
 }
 // 연습 화면: ① 끝만 훑기(공부법) ② 어디에 어울릴까?(카드 6장 — 검수 통과 51·52 지문 문장) ③ 내 문장 바꿔 보기 ④ 혼자 다시 쓰기.
 function focusHtml(){
  const st=focusNow(),src=st.round.filter(e=>e.kind==='found'||e.kind==='retry').at(-1),srcItem=src?item(src.itemId):null;
  drill||={deck:drillDeck(drillPool(bank.open),{seed:Math.floor(now()/60000),focus:state.focus,now:now()}),picks:[],saved:false,reveal:false};
  const method=`<section class="ww-focus-step"><h3 class="ww-section-title">${esc(t('writing.focus.method.title'))}</h3><ol class="ww-focus-list"><li>${esc(t('writing.focus.method.step1'))}</li><li>${esc(t('writing.focus.method.step2'))}</li></ol>`
   +`<dl class="ww-focus-table">${[['verb','증가한다 · 늘어난다'],['adj','많다'],['noun','-이다'],['past','조사했다 · 증가했다']].map(([k,ko])=>`<div><dt>${esc(t(`writing.focus.method.${k}`))}</dt><dd lang="ko">${esc(ko)}</dd></div>`).join('')}</dl>`
   +`<p class="ww-note">${esc(t('writing.focus.method.watch'))} <span lang="ko">많는다 · 증가하다.</span></p></section>`;
  return `<div class="ww ww-focus-view" data-ww-stage><div class="ww-bar"><button class="quiet-button" data-ww-back>← ${esc(t('writing.back'))}</button><span class="ww-type">${esc(t('writing.focus.title'))}</span></div>`
   +method+`<section class="ww-focus-step" data-ww-drill aria-live="polite">${drillHtml()}</section>`+mineHtml(srcItem)
   +`<section class="ww-focus-step"><h3 class="ww-section-title">${esc(t('writing.focus.retryTitle'))}</h3><p class="ww-note">${esc(t('writing.focus.retryLead'))}</p><div class="ww-actions">`
   +(retryItem(bank.open,{state:st,drafts:state.drafts,helped:state.helped})?`<button class="felt-button" data-ww-focus-retry>${esc(t('writing.focus.retry'))} <span aria-hidden="true">→</span></button>`:`<p class="ww-note">${esc(t('writing.focus.noRetry'))}</p>`)
   +(srcItem?`<button class="plain-button" data-ww-open="${esc(srcItem.id)}">${esc(t('writing.focus.backFix'))}</button>`:'')+`</div></section></div>`;
 }
 function drillHtml(){
  const {deck,picks}=drill,head=`<h3 class="ww-section-title">${esc(t('writing.focus.drill.title'))}</h3>`;
  if(!deck.length)return '';
  if(picks.length>=deck.length&&!drill.reveal){const right=picks.filter((bin,i)=>bin===deck[i].bin).length;
   return head+`<p class="ww-focus-done" role="status">${esc(t('writing.focus.drill.done',{n:right,total:deck.length}))}</p><div class="ww-actions"><button class="plain-button" data-ww-drill-again>${esc(t('writing.focus.drill.again'))}</button></div>`;}
  const at=drill.reveal?picks.length-1:picks.length,card=deck[at];
  let streak=0;for(let i=picks.length-1;i>=0&&picks[i]===deck[i].bin;i--)streak++;
  const words=card.text.split(' '),last=words.pop(),sentence=drill.reveal?`${esc(words.join(' '))} <mark>${esc(last)}</mark>`:esc(card.text);
  const chosen=drill.reveal?picks[at]:null,ok=chosen===card.bin;
  return head+`<p class="ww-note">${esc(t('writing.focus.drill.lead'))}</p><p class="ww-focus-progress"><span>${esc(t('writing.focus.drill.count',{n:at+1,total:deck.length}))}</span>${streak>1?` <span class="ww-chip">${esc(t('writing.focus.drill.streak',{n:streak}))}</span>`:''}</p>`
   +`<p class="ww-focus-sentence" lang="ko">${sentence}</p><div class="ww-focus-bins" role="group" aria-label="${esc(t('writing.focus.drill.title'))}">`
   +['formal','polite','plain'].map(bin=>`<button class="plain-button ww-focus-bin" data-ww-bin="${bin}" ${drill.reveal?'disabled':''} ${drill.reveal&&bin===card.bin?'data-answer="true"':''} ${drill.reveal&&bin===chosen&&!ok?'data-wrong="true"':''}><span>${esc(binName(bin))}</span> <span lang="ko">${esc(BIN_FORM[bin])}</span></button>`).join('')+`</div>`
   +(drill.reveal?`<p class="ww-focus-result" data-ok="${ok?'true':'false'}" role="status">${esc(ok?t('writing.focus.drill.right'):t('writing.focus.drill.wrong',{bin:binName(card.bin)}))}</p><div class="ww-actions"><button class="plain-button" data-ww-drill-next>${esc(t(at+1>=deck.length?'writing.focus.drill.finish':'writing.focus.drill.next'))}</button></div>`:'');
 }
 function mineHtml(srcItem){
  const list=srcItem?mySentences(String(state.drafts[srcItem.id]?.answer||'')):[];if(!list.length)return '';
  return `<section class="ww-focus-step"><h3 class="ww-section-title">${esc(t('writing.focus.mine.title'))}</h3><p class="ww-note">${esc(t('writing.focus.mine.lead'))}</p>`
   +list.map((text,i)=>{const value=mine[i]??'',ok=value.trim()?String(endsPlain(value)):'';return `<div class="ww-focus-mine"><p class="ww-quotes" lang="ko"><mark>${esc(text)}</mark></p><label class="ww-text-label" for="ww-mine-${i}">${esc(t('writing.focus.mine.label',{n:i+1}))}</label><input id="ww-mine-${i}" lang="ko" type="text" autocomplete="off" spellcheck="false" maxlength="200" data-ww-mine="${i}" value="${esc(value)}"><p class="ww-focus-mine-state" data-ww-mine-state="${i}" data-ok="${ok}">${ok?esc(t(ok==='true'?'writing.focus.mine.ok':'writing.focus.mine.not')):''}</p></div>`;}).join('')+`</section>`;
 }
 function paintDrill(){const box=stage?.querySelector('[data-ww-drill]');if(box){box.innerHTML=drillHtml();box.querySelector('[data-ww-drill-next], [data-ww-drill-again], [data-ww-bin]:not([disabled])')?.focus({preventScroll:true});}}
 function openFocus(){track();view={kind:'focus'};drill=null;mine={};render();}
 // 문항 화면 위 안내는 예시답·자동 피드백을 열거나 점검해 상태가 바뀌면 그 자리에서 다시 그린다.
 function paintBanner(){
  const it=view.kind==='task'?item(view.id):null;if(!it||!stage)return;
  const html=focusBannerHtml(it),old=stage.querySelector('[data-ww-focus-banner]');
  if(old){if(html)old.outerHTML=html;else old.remove();}else if(html)stage.querySelector('.ww-pair')?.insertAdjacentHTML('beforebegin',html);
 }
 function openRetry(){const next=retryItem(bank.open,{state:focusNow(),drafts:state.drafts,helped:state.helped});if(next)openTask(next.id);}
 // ── 입력·단추(시트 안 위임) ──
 function onInput(event){
  const el=event.target;
  if(view.kind==='focus'&&el.matches('[data-ww-mine]')){const i=el.dataset.wwMine,value=el.value,ok=value.trim()?String(endsPlain(value)):'';mine[i]=value;const out=stage.querySelector(`[data-ww-mine-state="${i}"]`);if(out){out.dataset.ok=ok;out.textContent=ok?t(ok==='true'?'writing.focus.mine.ok':'writing.focus.mine.not'):'';}return;}
  const it=view.kind==='task'?item(view.id):null;if(!it)return;const d=draftOf(it.id);
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
  if(button.hasAttribute('data-ww-focus-go')){track();save();openFocus();return;}
  if(button.hasAttribute('data-ww-focus-retry')){save();openRetry();return;}
  if(view.kind==='focus'&&drill){
   if(button.dataset.wwBin&&!drill.reveal&&drill.picks.length<drill.deck.length){state.focus=recordDrillPick(state.focus,drill.deck[drill.picks.length],button.dataset.wwBin,{now:now()});save();drill.picks.push(button.dataset.wwBin);drill.reveal=true;paintDrill();return;}
   if(button.hasAttribute('data-ww-drill-next')){drill.reveal=false;
    if(drill.picks.length>=drill.deck.length&&!drill.saved){drill.saved=true;const f=readFocus(state.focus);state.focus={...f,drill:{at:new Date(now()).toISOString(),right:drill.picks.filter((bin,i)=>bin===drill.deck[i].bin).length,total:drill.deck.length}};save();}
    paintDrill();return;}
   if(button.hasAttribute('data-ww-drill-again')){drill={deck:drillDeck(drillPool(bank.open),{seed:now(),focus:state.focus,now:now()}),picks:[],saved:false,reveal:false};paintDrill();return;}
  }
  if(!it)return;
  if(button.hasAttribute('data-ww-check')){track();save();runCheck(it);}
  else if(button.hasAttribute('data-ww-model')){modelOpen[it.id]=!modelOpen[it.id];if(modelOpen[it.id])markHelped(it.id,'answer');const box=stage.querySelector('[data-ww-model-out]');box.hidden=!modelOpen[it.id];box.innerHTML=modelOpen[it.id]?modelHtml(it):'';button.setAttribute('aria-expanded',String(!!modelOpen[it.id]));button.textContent=t(modelOpen[it.id]?'writing.model.hide':'writing.model.show');}
  else if(button.hasAttribute('data-ww-ai'))void askFeedback(it);
  else if(button.hasAttribute('data-ww-next'))nextMock();
  else if(button.hasAttribute('data-ww-timer-toggle')){const on=!timerOn();try{storage?.setItem(TIMER_KEY,on?'on':'off');}catch{}render('[data-ww-timer-toggle]');}
  else if(button.hasAttribute('data-ww-clear')){if(ai[it.id]?.status==='sending')return;if(doc.defaultView?.confirm&&!doc.defaultView.confirm(t('writing.clearAsk')))return;delete state.drafts[it.id];delete results[it.id];delete ai[it.id];delete focusNotes[it.id];save();shownAt=now();render();}
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
  stopped=false;syncOwner();const seq=++openSeq,current=()=>!stopped&&seq===openSeq;
  show(t('writing.title'),`<div class="ww" data-ww-stage><p class="ww-note" role="status">${esc(t('writing.loading'))}</p></div>`);
  if(!mount())return;
  try{const loaded=await loadWritingBank(fetcher);if(!current())return;bank=loaded;}catch{if(!current())return;const root=doc.querySelector('#panel-content [data-ww-stage]');if(root)root.innerHTML=`<p class="ww-note" role="alert">${esc(t('writing.loadError'))}</p>`;return;}
  if(feedback&&!status)Promise.resolve().then(()=>feedback.status()).then(next=>next,()=>({enabled:false})).then(next=>{if(!current())return;status=next;paintActions();});
  const [,which]=String(route).split(':'),type=Number(which);
  if(which==='mock'&&TYPES.every(ty=>bank.open.some(i=>i.type===ty))){startMock();return;}
  // 53번 경로(계획·홈이 「처음에 놓친 부분을…」으로 여는 곳): 한 가지 고치기가 열려 있으면 그 화면으로.
  if(type===FOCUS_TYPE&&focusNow().open){openFocus();return;}
  if(TYPES.includes(type)){const pick=bank.open.find(i=>i.type===type&&!state.drafts[i.id]?.checkedAt)||bank.open.find(i=>i.type===type);if(pick){openTask(pick.id);return;}}
  if(item(which)){openTask(which);return;}
  view={kind:'list'};render();
 }
 return {open,hasDraft:()=>Object.values(state.drafts).some(d=>d.updatedAt),dispose(){stopped=true;track();save();clearInterval(ticker);ticker=null;offLang?.();offLang=null;}};
}
