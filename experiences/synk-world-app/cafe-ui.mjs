import {CAFE_LESSON_ID,CAFE_SEATS,CAFE_VISITS,cafeVisitById,cafeQuestion,cafeReceipt,isCafeOrder,cafeOrderText} from './cafe-activity.mjs';
import {lessonById} from './life-content.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const drinkNames={cold:'차가운 주스',warm:'따뜻한 주스',tea:'따뜻한 차',coldtea:'차가운 차',takeout:'포장한 차'};
export function cafeDrink(kind,count=1){return kind?`<span class="cafe-cups" aria-label="${esc(drinkNames[kind])} ${count}잔">${Array.from({length:count},()=>`<span class="cafe-drink cafe-drink-${kind}" aria-hidden="true">${kind==='coldtea'?'<span class="cafe-ice"></span>':''}</span>`).join('')}</span>`:'';}
const actions=(text,attribute,extra='')=>`<div class="life-actions cafe-actions"><button class="felt-button" ${attribute}>${text} <span aria-hidden="true">→</span></button>${extra}<button class="quiet-button" data-life-pause>저장하고 쉬기</button></div>`;
const cast=photo=>`<div class="cafe-friends">${['mongle','kkamong','marine'].map(id=>photo(id)).join('')}</div>`;
const speakerName=id=>({mongle:'몽글',kkamong:'까몽',marine:'마린',narrator:'작은 이야기'}[id]||'친구');
export function cafeMarkup(state,{photo,helped=false,firstAnswer=null,retryButton=()=>'',lessonId=CAFE_LESSON_ID,speechAvailable=false,speechPhase='idle'}={}){
 const visit=cafeVisitById(lessonId),receipt=cafeReceipt(state,lessonId),step=visit.steps[state.step];
 const receiptHtml=`<div class="cafe-ticket"><small>나의 주문표</small><strong>${esc(receipt.label)}</strong><span>${esc(receipt.place)}</span></div>`;
 const scene=(message,kind='counter')=>`<section class="cafe-scene cafe-scene-${kind}" data-cafe-seat="${state.seat}" aria-label="${kind==='table'?'친구와 앉은 자리':'카페 주문대'}"><div class="cafe-place-label">구름 한 잔 <span>동네 카페</span></div>${cast(photo)}<div class="cafe-tray" data-cafe-drink="${receipt.drink||'empty'}" data-cafe-count="${receipt.count}" data-cafe-received="${receipt.received}">${cafeDrink(receipt.drink,receipt.count)}</div><p class="cafe-scene-caption">${esc(message)}</p></section>`;
 if(state.phase==='welcome')return `<div class="cafe-welcome cafe-focus" tabindex="-1" data-cafe-visit="${lessonId}">${scene(visit.caption)}<div class="cafe-welcome-copy"><small>${visit.number}번째 방문 · 카페에서 보내는 작은 하루</small><h3>${esc(visit.title)}</h3><p>${esc(visit.description)}</p>${lessonId!==CAFE_LESSON_ID?`<div class="cafe-opening-lines">${lessonById(lessonId).scenes.map(line=>`<p><b>${speakerName(line.speaker)}</b> ${esc(line.text)}</p>`).join('')}</div>`:''}${speechAvailable?`<fieldset class="cafe-input-modes"><legend>어떻게 주문해 볼까요?</legend><button class="plain-button" data-life-cafe-mode="listen" aria-pressed="${state.listen?.mode==='listen'}">듣고 주문하기</button><button class="plain-button" data-life-cafe-mode="read" aria-pressed="${state.listen?.mode!=='listen'}">읽고 주문하기</button></fieldset>`:''}<p class="cafe-soft-note">서두르지 않아도 괜찮아요. 직원과 다시 확인할 수 있어요.</p></div></div>${actions('카페에 들어가기','data-life-cafe-next')}`;
 if(state.phase==='break')return `<div class="cafe-break cafe-focus" tabindex="-1">${scene(`${CAFE_SEATS[state.seat]}에 주스 두 잔을 놓았어요.`,'table')}<div class="cafe-break-copy"><small>잠깐, 우리 자리</small><h3>네 컵 하나, 내 컵 하나.</h3><p><b>몽글</b> “우와! 같이 마시니까 더 시원해!”</p><p><b>까몽</b> “이 몸 자리도 있지. …여기 잠깐 앉을게.”</p><p><b>마린</b> “학교 갈 시간 확인. 따뜻한 차, 한 잔 필요.”</p>${receiptHtml}</div></div>${actions('마린의 차 포장하기','data-life-cafe-next')}`;
 const q=cafeQuestion(state.step,lessonId),selection=state.choiceId?step.options[state.choiceId]:null;
 const ready=state.phase==='response',repair=state.phase==='repair';
 const composed=step.compose&&state.choiceId;
 const dialogue=composed?state.phase==='response'?'네, 따뜻한 차 두 잔 주문받았어요. 수량도 다시 확인할게요.':`말씀하신 주문은 ${cafeOrderText(state.order)} 친구와 마실 따뜻한 차 두 잔이 맞을까요?`:selection?selection.response:step.staff,friend=selection?selection.friend:step.friend;
 const listening=state.listen?.mode==='listen',needsHearing=listening&&!state.listen.heard&&!state.listen.textShown;
 const hiddenQuestion=listening&&!state.listen.textShown&&!state.choiceId;
 const speechControls=speechAvailable||listening?`<div class="cafe-speech-controls"><button class="plain-button" data-life-cafe-speech>${!speechAvailable?'질문 소리 다시 준비하기':speechPhase==='playing'?'질문 듣기 잠깐 멈추기':speechPhase==='paused'?'질문 이어 듣기':state.listen?.heard?'직원 질문 다시 듣기':'직원 질문 듣기'}</button>${listening?`<button class="quiet-button" data-life-cafe-transcript>${state.listen.textShown?'글자 도움을 봤어요':'글자 도움 보기'}</button>`:''}</div><p class="cafe-speech-status" role="status">${speechPhase==='error'?'소리를 재생하지 못했어요. 다시 듣기를 눌러 주세요.':needsHearing?'질문을 끝까지 들은 뒤 말을 골라 주세요.':listening?'질문을 듣고, 내 말로 답해요.':'글을 읽고 주문해요.'}</p>`:'';
 const trayMessage=ready?(state.step===2?'컵이 준비됐어요. 이제 음료를 받아요.':'주문표를 확인했어요. 다음 부탁을 이어가요.'):repair?'주문을 확인하고 있어요. 아직 음료를 받지 않았어요.':'말을 고르면 주문표가 바뀌어요.';
 const menu=lessonId===CAFE_LESSON_ID?state.step===0:step.menu;
 const optionHtml=step.compose?cafeComposer(state,ready):q.choices.map(c=>{const o=step.options[c.id],kind=lessonId===CAFE_LESSON_ID?(state.step===2?o.drink:'cold'):(o.previewDrink||o.drink);return `<button class="cafe-option ${state.choiceId===c.id?'is-chosen':''}" data-life-cafe-choice="${c.id}" ${ready||needsHearing?'disabled':''} aria-label="${esc(c.text)}">${cafeDrink(state.step===0&&lessonId===CAFE_LESSON_ID?o.drink:kind,menu?Math.max(o.count,1):1)}<span>${esc(c.text)}</span>${menu?`<small>${o.previewDrink?'품절 메뉴':`${o.count}잔`}</small>`:''}</button>`;}).join('');
 const primary=step.compose&&!ready?actions(isCafeOrder(state.order,{complete:true})?'이 주문으로 부탁하기':'음료·온도·잔 수를 골라 주세요',`data-life-cafe-submit ${needsHearing||!isCafeOrder(state.order,{complete:true})?'disabled':''}`):actions(ready?step.next:repair?'주문을 다시 확인해 주세요':'직원에게 말을 골라 주세요',`data-life-cafe-next ${ready?'':'disabled'}`);
 const seats=ready&&state.step===visit.seatStep?`<fieldset class="cafe-seats"><legend>어느 자리에 앉을까요?</legend>${Object.entries(CAFE_SEATS).map(([id,label])=>`<button class="plain-button" data-life-cafe-seat="${id}" aria-pressed="${state.seat===id}">${label}</button>`).join('')}</fieldset>`:'';
 return `<div class="cafe-session-meta" data-cafe-visit="${lessonId}"><span>${visit.number}번째 카페 방문 · ${step.name}</span><span>${state.step+1} / 3</span></div><div class="cafe-play-layout ${step.compose?'is-composing':''}"><div class="cafe-world">${scene(trayMessage)}${receiptHtml}</div><section class="cafe-conversation" aria-label="직원과 주문하기"><div class="cafe-focus" tabindex="-1"><small>${step.name}</small><h3>${esc(step.goal||q.prompt)}</h3>${step.goal||step.compose?'':`<p class="cafe-goal">${esc(q.context)}</p>`}</div>${step.notice?`<p class="cafe-menu-notice">${esc(step.notice)}</p>`:''}<div class="cafe-staff" role="status"><small>카페 직원${hiddenQuestion?' · 귀 기울여 들어요':''}</small><p ${hiddenQuestion?'hidden':''}>${esc(dialogue)}</p>${speechControls}</div><p class="cafe-friend-line"><b>${speakerName(step.speaker)}</b> ${esc(friend)}</p>${repair?'<p class="cafe-repair-note">다시 말해 볼까요? 직원이 주문을 바꿔 줄 거예요.</p>':''}<div class="cafe-options ${step.compose?'cafe-compose-options':menu?'cafe-menu':'cafe-responses'}" aria-label="직원에게 할 말">${optionHtml}</div>${seats}<button class="quiet-button cafe-help" data-life-cafe-help aria-expanded="${helped}">주문 표현 도움</button><p class="life-hint" ${helped?'':'hidden'}>${esc(step.hint)}</p>${firstAnswer&&(!firstAnswer.correct||firstAnswer.helped)?'<p class="cafe-review-note">도움이 필요했던 표현은 복습에 남겨 둘게요.</p>':''}${repair||helped||firstAnswer&&(!firstAnswer.correct||firstAnswer.helped)?retryButton(q):''}</section></div>${primary}`;
}
function cafeComposer(state,ready){
 const fields=[['drink','음료',[['juice','주스'],['tea','차']]],['temperature','온도',[['warm','따뜻하게'],['cold','차갑게']]],['count','잔 수',[[1,'한 잔'],[2,'두 잔'],[3,'세 잔']]]];
 return `<div class="cafe-composer">${fields.map(([field,title,options])=>`<fieldset><legend>${title}</legend><div>${options.map(([value,label])=>`<button class="plain-button" data-life-cafe-word="${field}" data-cafe-value="${value}" aria-pressed="${state.order[field]===value}" ${ready?'disabled':''}>${label}</button>`).join('')}</div></fieldset>`).join('')}<p class="cafe-my-sentence" aria-live="polite"><small>내가 만든 주문</small><strong>${esc(cafeOrderText(state.order))}</strong></p></div>`;
}

// Pre-rendered local questions only. No synthesis or credential reaches the app.
export function createCafeSpeech({asset,onChange=()=>{},audioFactory=url=>new Audio(url),fetcher=fetch}){
 let clips={},available=false,phase='idle',current=null,currentId=null,disposed=false,serial=0,endCallback=null;
 const notify=()=>{if(!disposed)onChange({available,phase,lineId:currentId});};
 function stop(){serial++;if(current){current.pause();current.onended=null;current.onerror=null;}current=null;currentId=null;endCallback=null;phase='idle';}
 async function prepare(){
  try{
   const response=await fetcher(asset('cafe-voice/manifest.json'),{cache:'no-cache'});if(!response.ok)throw Error('Questions unavailable');const bank=await response.json();
   const required=CAFE_VISITS.flatMap(v=>v.steps.map((step,i)=>({id:`${v.id}-${i+1}`,text:step.staff})));
   if(bank.version!==1||bank.approved!==true||!bank.clips||required.some(({id,text})=>{const c=bank.clips[id];return !c||c.text!==text||c.file!==`${id}.mp3`||!Number.isFinite(c.durationSeconds)||c.durationSeconds<=0||c.durationSeconds>15;}))throw Error('Question bank incomplete');
   if(!disposed){clips=bank.clips;available=true;notify();}return available;
  }catch{if(!disposed){available=false;notify();}return false;}
 }
 async function play(id,onEnded){
  if(disposed||!available||!clips[id])throw Error('질문 음성을 준비하지 못했어요.');
  if(currentId!==id||phase==='error'){stop();currentId=id;current=audioFactory(asset('cafe-voice/'+clips[id].file));current.preload='auto';current.volume=.85;}
  if(current.ended)current.currentTime=0;
  const token=++serial;endCallback=onEnded;
  current.onended=()=>{if(disposed||token!==serial)return;phase='ended';const done=endCallback;notify();done?.();};
  current.onerror=()=>{if(!disposed&&token===serial){phase='error';notify();}};
  try{await current.play();if(!disposed&&token===serial){phase='playing';notify();}}
  catch{if(!disposed&&token===serial){phase='error';notify();}throw Error('질문 소리를 재생하지 못했어요. 다시 듣기를 눌러 주세요.');}
 }
 function pause(){if(current&&!current.paused){current.pause();phase='paused';notify();}}
 const visibility=()=>{if(document.hidden)pause();};document.addEventListener('visibilitychange',visibility);
 return {prepare,play,pause,stop,available:()=>available,metrics:()=>({available,phase,lineId:currentId,currentTime:current?.currentTime||0,paused:current?.paused??true}),dispose(){disposed=true;stop();document.removeEventListener('visibilitychange',visibility);}};
}
export function cafeCompletionMarkup({photo,nextLesson,lessonId=CAFE_LESSON_ID,state}){
 const visit=cafeVisitById(lessonId),ending=visit.ending,receipt=state?cafeReceipt(state,lessonId):null;
 return `<div class="cafe-complete cafe-focus" tabindex="-1" data-cafe-visit="${lessonId}">${cast(photo)}<small>${visit.number}번째 카페 기록</small><h3>${esc(ending.title)}</h3><p>${esc(ending.text)}</p><div class="cafe-complete-orders ${ending.orders.length===1?'is-single':''}">${ending.orders.map(o=>`<div data-cafe-drink="${o.drink}" data-cafe-count="${o.count}" data-cafe-received="true">${cafeDrink(o.drink,o.count)}<strong>${esc(visit.seatStep===2?receipt?.place||o.place:o.place)}</strong><span>${esc(o.label)}</span></div>`).join('')}</div>${ending.lines?`<div class="cafe-ending-lines">${ending.lines.map(line=>`<p><b>${speakerName(line.speaker)}</b> ${esc(line.text)}</p>`).join('')}</div>`:''}<p class="cafe-soft-note">필요한 표현은 새 상황으로 복습해요.</p></div><div class="life-actions cafe-actions">${nextLesson?`<button class="felt-button" data-life-lesson="${nextLesson.id}">${nextLesson.type==='compose'?'내 말로 주문하기':nextLesson.type==='visit'?'다음 카페 이야기':'카페 표현 더 익히기'} <span aria-hidden="true">→</span></button>`:'<button class="felt-button" data-life-review>내 복습 일정 보기 <span aria-hidden="true">→</span></button>'}<button class="plain-button" data-life-lesson="${lessonId}">이번 방문 다시 보기</button><button class="quiet-button" data-life-home>마루로 돌아가기</button></div>`;
}
