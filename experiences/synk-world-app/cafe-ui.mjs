import {CAFE_LESSON_ID,CAFE_SEATS,CAFE_VISITS,cafeVisitById,cafeQuestion,cafeReceipt,isCafeOrder,cafeOrderText} from './cafe-activity.mjs';
import {lessonById} from './life-content.mjs'
import {hasCafePhoto} from '../brand-opening/tutor-photos.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const drinkNames={cold:'차가운 주스',warm:'따뜻한 주스',tea:'따뜻한 차',coldtea:'차가운 차',takeout:'포장한 차'};
export function cafeDrink(kind,count=1){return kind?`<span class="cafe-cups" aria-label="${esc(drinkNames[kind])} ${count}잔">${Array.from({length:count},()=>`<span class="cafe-drink cafe-drink-${kind}" aria-hidden="true">${kind==='coldtea'?'<span class="cafe-ice"></span>':''}</span>`).join('')}</span>`:'';}
// 직원 말 듣기 단추의 글: 처음엔 「듣기」, 들은 뒤 「다시 듣기」, 재생 중 「멈추기」.
export function cafeSpeechLabel({available=true,phase='idle',heard=false}={}){return !available?'소리 다시 준비':phase==='playing'?'멈추기':phase==='paused'?'이어 듣기':heard?'다시 듣기':'듣기';}
const two=n=>String(n).padStart(2,'0');
const actions=(text,attribute,extra='')=>`<div class="life-actions cafe-actions"><button class="felt-button" ${attribute}>${text} <span aria-hidden="true">→</span></button>${extra}<button class="quiet-button" data-life-pause>나중에 하기</button></div>`;
// 친구까지 함께 구운 카페 사진이 아직 없는 자리만 옛 컷을 얹는다(굽는 대로 사진으로 바뀐다).
const cast=photo=>`<div class="cafe-friends">${['mongle','kkamong','marine'].map(id=>photo(id)).join('')}</div>`;
const speakerName=id=>({mongle:'몽글',kkamong:'까몽',marine:'마린',narrator:'이야기'}[id]||'친구');
const progress=(done,total)=>`<span class="life-progress" aria-hidden="true"><i style="width:${Math.round(Math.max(0,Math.min(1,done/total))*100)}%"></i></span>`;
// 카페 한 장면: 세 친구가 카운터·자리에 함께 있는 카페 사진 위에 쟁반(주문한 잔이 놓인다). 위에는 어두운 유리 이름표, 아래는 지금 상태 한 줄.
function sceneMarkup(state,receipt,photo,message,kind='counter'){
 const baked=hasCafePhoto(kind==='table'?state.seat:'counter');
 return `<section class="cafe-scene cafe-scene-${kind}" data-cafe-seat="${state.seat}" data-cafe-photo="${baked}" aria-label="${kind==='table'?'친구와 앉은 자리':'카페 카운터'}"><div class="cafe-place-label">구름 한 잔 <span>동네 카페</span></div>${baked?'':cast(photo)}<div class="cafe-tray" data-cafe-drink="${receipt.drink||'empty'}" data-cafe-count="${receipt.count}" data-cafe-received="${receipt.received}">${cafeDrink(receipt.drink,receipt.count)}</div><p class="cafe-scene-caption">${esc(message)}</p></section>`;
}
export function cafeMarkup(state,{photo,print=()=>'',helped=false,firstAnswer=null,retryButton=()=>'',lessonId=CAFE_LESSON_ID,speechAvailable=false,speechPhase='idle'}={}){
 const visit=cafeVisitById(lessonId),receipt=cafeReceipt(state,lessonId),step=visit.steps[state.step];
 const ticket=`<div class="cafe-ticket"><small>주문표</small><strong>${esc(receipt.label)}</strong><span>${esc(receipt.place)}</span></div>`;
 if(state.phase==='welcome')return `<div class="cafe-welcome cafe-focus" tabindex="-1" data-cafe-visit="${lessonId}">${sceneMarkup(state,receipt,photo,visit.caption)}<div class="cafe-welcome-copy"><p class="life-section-label">VISIT ${two(visit.number)}</p><h3>${esc(visit.title)}</h3><p>${esc(visit.description)}</p>${lessonId!==CAFE_LESSON_ID?`<div class="cafe-opening-lines">${lessonById(lessonId).scenes.map(line=>`<p><b>${speakerName(line.speaker)}</b> ${esc(line.text)}</p>`).join('')}</div>`:''}${speechAvailable?`<fieldset class="cafe-input-modes"><legend>주문 방법</legend><button class="plain-button" data-life-cafe-mode="listen" aria-pressed="${state.listen?.mode==='listen'}">듣고 주문하기</button><button class="plain-button" data-life-cafe-mode="read" aria-pressed="${state.listen?.mode!=='listen'}">읽고 주문하기</button></fieldset>`:''}<p class="cafe-soft-note">천천히 해도 돼요. 직원이 주문을 한 번 더 확인해 줘요.</p></div></div>${actions('카페에 들어가기','data-life-cafe-next')}`;
 if(state.phase==='break')return `<div class="cafe-break cafe-focus" tabindex="-1">${sceneMarkup(state,receipt,photo,`${CAFE_SEATS[state.seat]}에 주스 두 잔을 놓았어요.`,'table')}<div class="cafe-break-copy"><p class="life-section-label">BREAK</p><h3>네 컵 하나, 내 컵 하나.</h3><p><b>몽글</b> “우와! 같이 마시니까 더 시원해!”</p><p><b>까몽</b> “이 몸 자리도 있지. …여기 잠깐 앉을게.”</p><p><b>마린</b> “학교 갈 시간 확인. 따뜻한 차, 한 잔 필요.”</p>${ticket}</div></div>${actions('마린의 차 포장하기','data-life-cafe-next')}`;
 const q=cafeQuestion(state.step,lessonId),selection=state.choiceId?step.options[state.choiceId]:null;
 const ready=state.phase==='response',repair=state.phase==='repair';
 const composed=step.compose&&state.choiceId;
 const dialogue=composed?state.phase==='response'?'네, 따뜻한 차 두 잔 주문받았어요. 수량도 다시 확인할게요.':`말씀하신 주문은 ${cafeOrderText(state.order)} 친구와 마실 따뜻한 차 두 잔이 맞을까요?`:selection?selection.response:step.staff,friend=selection?selection.friend:step.friend;
 const listening=state.listen?.mode==='listen',needsHearing=listening&&!state.listen.heard&&!state.listen.textShown;
 const hiddenQuestion=listening&&!state.listen.textShown&&!state.choiceId;
 // 직원 말풍선 옆에는 「다시 듣기」「느리게」 두 단추만. 듣고 주문할 때 글자는 말풍선 자리의 「글자로 보기」로 연다.
 const speechControls=speechAvailable||listening?`<div class="cafe-speech-controls"><button class="plain-button" data-life-cafe-speech data-phase="${speechAvailable?esc(speechPhase):'unavailable'}">${cafeSpeechLabel({available:speechAvailable,phase:speechPhase,heard:state.listen?.heard})}</button><button class="plain-button cafe-slow" data-life-cafe-slow ${speechAvailable?'':'disabled'}>느리게</button></div><p class="cafe-speech-status" role="status">${speechPhase==='error'?'소리를 재생하지 못했어요. 다시 눌러 주세요.':needsHearing?'끝까지 들은 뒤 답을 골라요.':''}</p>`:'';
 const trayMessage=ready?(state.step===2?'잔이 준비됐어요. 받아 가요.':'주문표를 확인했어요.'):repair?'주문을 확인하는 중이에요. 아직 받지 않았어요.':'말을 고르면 주문표가 바뀌어요.';
 const menu=lessonId===CAFE_LESSON_ID?state.step===0:step.menu;
 const optionHtml=step.compose?cafeComposer(state,ready):q.choices.map(c=>{const o=step.options[c.id],kind=lessonId===CAFE_LESSON_ID?(state.step===2?o.drink:'cold'):(o.previewDrink||o.drink);return `<button class="cafe-option ${state.choiceId===c.id?'is-chosen':''}" data-life-cafe-choice="${c.id}" ${ready||needsHearing?'disabled':''} aria-label="${esc(c.text)}">${cafeDrink(state.step===0&&lessonId===CAFE_LESSON_ID?o.drink:kind,menu?Math.max(o.count,1):1)}<span>${esc(c.text)}</span>${menu?`<small>${o.previewDrink?'품절':`${o.count}잔`}</small>`:''}</button>`;}).join('');
 const primary=step.compose&&!ready?actions(isCafeOrder(state.order,{complete:true})?'이 주문으로 말하기':'음료·온도·잔 수를 골라 주세요',`data-life-cafe-submit ${needsHearing||!isCafeOrder(state.order,{complete:true})?'disabled':''}`):actions(ready?step.next:repair?'다시 골라 주세요':'할 말을 골라 주세요',`data-life-cafe-next ${ready?'':'disabled'}`);
 const seats=ready&&state.step===visit.seatStep?`<fieldset class="cafe-seats"><legend>앉을 자리</legend>${Object.entries(CAFE_SEATS).map(([id,label])=>`<button class="plain-button" data-life-cafe-seat="${id}" aria-pressed="${state.seat===id}">${label}</button>`).join('')}</fieldset>`:'';
 return `<div class="cafe-session-meta" data-cafe-visit="${lessonId}">${progress(state.step+(ready?1:0),3)}<span>${visit.number}번째 방문 · ${step.name}</span><span><b class="life-count">${state.step+1} / 3</b></span></div><div class="cafe-play-layout ${step.compose?'is-composing':''}"><div class="cafe-world">${sceneMarkup(state,receipt,photo,`주문표 · ${receipt.label} · ${receipt.place}`)}<p class="cafe-tray-note">${esc(trayMessage)}</p></div><section class="cafe-conversation" aria-label="직원과 주문하기"><div class="cafe-focus" tabindex="-1"><small>할 일</small><h3>${esc(step.goal||q.prompt)}</h3>${step.goal||step.compose?'':`<p class="cafe-goal">${esc(q.context)}</p>`}</div>${step.notice?`<p class="cafe-menu-notice">${esc(step.notice)}</p>`:''}<div class="cafe-staff" role="status"><small>카페 직원</small>${hiddenQuestion?`<div class="cafe-staff-hidden"><span>직원의 말을 들어 보세요.</span><button class="quiet-button" data-life-cafe-transcript>글자로 보기</button></div>`:''}<p tabindex="-1" ${hiddenQuestion?'hidden':''}>${esc(dialogue)}</p>${speechControls}</div><p class="cafe-friend-line"><b>${speakerName(step.speaker)}</b> ${esc(friend)}</p>${repair?'<p class="cafe-repair-note">직원의 말을 듣고 다시 골라요.</p>':''}<p class="cafe-reply-label">${step.compose?'카운터에서 골라요':'내가 할 말'}</p><div class="cafe-options ${step.compose?'cafe-compose-options':menu?'cafe-menu':'cafe-responses'}" aria-label="${step.compose?'주문 고르기':'직원에게 할 말'}">${optionHtml}</div>${seats}<button class="quiet-button cafe-help" data-life-cafe-help aria-expanded="${helped}">힌트 보기</button><p class="life-hint" ${helped?'':'hidden'}>${esc(step.hint)}</p>${repair||helped||firstAnswer&&(!firstAnswer.correct||firstAnswer.helped)?retryButton(q):''}</section></div>${primary}`;
}
// 내 말로 주문하기: 칩 줄 대신 카운터 위의 물건(펠트 잔)을 직접 집는다. 고른 물건은 흰 바탕으로 뒤집힌다.
function cafeComposer(state,ready){
 const order=state.order,drink=order.drink||'juice',temperature=order.temperature;
 const cup=(d,t)=>d==='tea'?(t==='cold'?'coldtea':'tea'):(t==='warm'?'warm':'cold');
 const fields=[
  ['drink','음료',[['juice','주스',cup('juice',temperature)],['tea','차',cup('tea',temperature)]]],
  ['temperature','온도',[['warm','따뜻하게',cup(drink,'warm')],['cold','차갑게',cup(drink,'cold')]]],
  ['count','잔 수',[[1,'한 잔'],[2,'두 잔'],[3,'세 잔']].map(([value,label])=>[value,label,cup(drink,temperature)])]
 ];
 return `<div class="cafe-composer">${fields.map(([field,title,options])=>`<fieldset data-cafe-field="${field}"><legend>${title}</legend><div>${options.map(([value,label,kind])=>`<button class="plain-button cafe-pick" data-life-cafe-word="${field}" data-cafe-value="${value}" aria-pressed="${order[field]===value}" ${ready?'disabled':''}>${cafeDrink(kind,field==='count'?value:1)}<span>${label}</span></button>`).join('')}</div></fieldset>`).join('')}<p class="cafe-my-sentence" aria-live="polite" data-complete="${isCafeOrder(order,{complete:true})}"><small>내가 만든 주문</small><strong>${esc(cafeOrderText(order))}</strong></p></div>`;
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
 // rate: 「느리게」는 0.75배(음높이는 그대로), restart: 처음부터 다시.
 async function play(id,onEnded,{rate=1,restart=false}={}){
  if(disposed||!available||!clips[id])throw Error('직원 말 소리를 준비하지 못했어요.');
  if(currentId!==id||phase==='error'){stop();currentId=id;current=audioFactory(asset('cafe-voice/'+clips[id].file));current.preload='auto';current.volume=.85;}
  if(current.ended||restart)current.currentTime=0;
  try{current.preservesPitch=true;current.playbackRate=rate;}catch{}
  const token=++serial;endCallback=onEnded;
  current.onended=()=>{if(disposed||token!==serial)return;phase='ended';const done=endCallback;notify();done?.();};
  current.onerror=()=>{if(!disposed&&token===serial){phase='error';notify();}};
  try{await current.play();if(!disposed&&token===serial){phase='playing';notify();}}
  catch{if(!disposed&&token===serial){phase='error';notify();}throw Error('소리를 재생하지 못했어요. 다시 눌러 주세요.');}
 }
 function pause(){if(current&&!current.paused){current.pause();phase='paused';notify();}}
 const visibility=()=>{if(document.hidden)pause();};document.addEventListener('visibilitychange',visibility);
 return {prepare,play,pause,stop,available:()=>available,metrics:()=>({available,phase,lineId:currentId,currentTime:current?.currentTime||0,paused:current?.paused??true,rate:current?.playbackRate||1}),dispose(){disposed=true;stop();document.removeEventListener('visibilitychange',visibility);}};
}
// 방문 결과 한 장: 큰 한 줄 + 카페 사진 → 받은 음료(얻은 것) → 배운 표현 → 다시 볼 표현 하나(대화 중 고친 것) → 친구들의 마지막 말 → 흰 알약 하나(우리 방으로).
export function cafeCompletionMarkup({photo,print=()=>'',nextLesson,lessonId=CAFE_LESSON_ID,state,adaptive=false,answers={}}){
 const visit=cafeVisitById(lessonId),ending=visit.ending,receipt=state?cafeReceipt(state,lessonId):null,lesson=lessonById(lessonId);
 const fixes=visit.steps.map((step,i)=>({step,q:cafeQuestion(i,lessonId)})).filter(({q})=>{const a=q&&answers[q.id];return a&&(!a.correct||a.helped);});
 const again=fixes[0],againText=again?(lesson?.expressions.find(e=>e.id===again.q.expressionId)?.korean||again.q.choices.find(c=>c.id===again.q.answerId)?.text||''):'';
 const next=adaptive?'<button class="quiet-button" data-life-next>다음 연습</button>':nextLesson?`<button class="quiet-button" data-life-lesson="${nextLesson.id}">${nextLesson.type==='compose'?'다음: 내 말로 주문하기':nextLesson.type==='visit'?'다음 방문':'다음 레슨'}</button>`:'<button class="quiet-button" data-life-review>복습 일정 보기</button>';
 return `<div class="cafe-complete life-result cafe-focus" tabindex="-1" data-cafe-visit="${lessonId}"><section class="life-poster life-complete-poster">${print('cafe')}<small class="life-poster-label">RESULT · VISIT ${two(visit.number)}</small><strong class="life-poster-word">카페 주문, 끝!</strong><span class="life-poster-sub">${esc(ending.title)} ${esc(ending.text)}</span></section><section class="cafe-receipt" aria-label="받은 음료"><p class="life-section-label">GOT</p><div class="cafe-complete-orders ${ending.orders.length===1?'is-single':''}">${ending.orders.map(o=>`<div data-cafe-drink="${o.drink}" data-cafe-count="${o.count}" data-cafe-received="true">${cafeDrink(o.drink,o.count)}<strong>${esc(o.label)}</strong><span>${esc(visit.seatStep===2?receipt?.place||o.place:o.place)}</span></div>`).join('')}</div></section>${lesson?`<section class="life-result-learned" aria-label="배운 표현"><p class="life-section-label">LEARNED</p><ul>${lesson.expressions.map(e=>`<li><strong>${esc(e.korean)}</strong></li>`).join('')}</ul></section>`:''}${again?`<section class="life-result-again"><p class="life-section-label">AGAIN</p><strong>${esc(againText)}</strong><small>「${esc(again.step.name)}」${fixes.length>1?` 등 ${fixes.length}곳`:''}에서 다시 골랐어요. 조금 뒤 새 장면으로 복습해요.</small></section>`:''}${ending.lines?`<div class="cafe-ending-lines">${ending.lines.map(line=>`<p><b>${speakerName(line.speaker)}</b> ${esc(line.text)}</p>`).join('')}</div>`:''}</div><div class="life-actions cafe-actions"><button class="felt-button" data-life-home>우리 방으로 <span aria-hidden="true">→</span></button>${next}</div>`;
}
