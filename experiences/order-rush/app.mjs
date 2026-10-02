import {CafeSession,ORDERS,REVIEW,makeCup,editCup,describeCup,judgeOrder} from './core.mjs';
import {CafeStage,FlatStage} from './stage.mjs';
import {CafeAudio} from './audio.mjs';
import {orderMetadata,chooseOrder,orderAnswer,FLOW_RUSH,FLOW_PRACTICE,FLOW_SKILLS,FLOW_WORDS,tuningFrom,chooseOrderLive,pressureOf,describeChanges,easierSuggestion,closingObservation,assignmentOrders,orderTargetLabel} from './learning.mjs';

const $=id=>document.getElementById(id);
let coach=null,learningFailed=false,nextPlan=null,audioTicket=null;
try{coach=globalThis.SynkLearning?.createGame({gameId:'order-rush',storage:localStorage})||null;}catch{learningFailed=true;}
function learn(method,...args){try{return coach?.[method](...args);}catch{learningFailed=true;return null;}}
const assignment=()=>{try{return coach?.assignment?.()||null;}catch{return null;}};
// Atlas moment-level challenge: the rush follows this person; the lobby can switch it off.
const FLOW_KEY='synk.order-rush.flow-mode';let live=null,flowStart=null,flowSpec=null;
function flowMode(){try{return localStorage.getItem(FLOW_KEY)==='fixed'?'fixed':'auto';}catch{return 'auto';}}
function renderFlowChoice(){const mode=flowMode();document.querySelectorAll('[data-flow]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.flow===mode)));}
function setFlowMode(mode){try{localStorage.setItem(FLOW_KEY,mode);}catch{/* the choice lasts for this page */}renderFlowChoice();}
function flowLine(line){const el=$('flow-line');if(!el)return;if(!line){el.hidden=true;el.textContent='';return;}el.textContent=line.text;el.hidden=false;el.classList.remove('pulse');void el.offsetWidth;el.classList.add('pulse');}
function startLive(isReview){live=null;flowStart=null;flowSpec=null;if(!coach||learningFailed||isReview||typeof coach.live!=='function')return;try{flowSpec=state.mode==='rush'?FLOW_RUSH:FLOW_PRACTICE;live=coach.live(flowSpec,{skillIds:FLOW_SKILLS,declared:flowMode()==='fixed'?{mode:'fixed'}:{},words:FLOW_WORDS});flowStart=live.settings().values;}catch{live=null;}}
function applyFlow(out){if(!out)return;if(out.settings&&state.session)state.session.tune(tuningFrom(out.settings.values));if(out.line)flowLine(out.line);}
function presentOrder(order){if(live){try{return live.present(orderMetadata(order));}catch{live=null;}}return learn('present',orderMetadata(order));}
function answerWithFlow(t,result,flow={}){if(live){try{const out=live.answer(t.presentationId,result,flow);applyFlow(out);return out.recorded;}catch{live=null;}}return learn('answer',t.presentationId,result);}
function learningCopy(){const target=assignment();if(target)return orderTargetLabel(target);const s=learn('summary');return !coach||learningFailed||s?.storage?.available===false?'학습 기록을 저장할 수 없어 이번에는 기본 주문으로 연습해요.':`${nextPlan?.reason||'아직 확인하지 않은 주문 표현부터 만나 봐요.'} 이 브라우저의 연습 기록을 사용해요.`;}
function updateLearning(){for(const id of ['learning-reason','game-learning','result-learning'])if($(id))$(id).textContent=learningCopy();}
function selectOrder(orders){if(!coach||learningFailed)return orders[0];try{const plan=live?chooseOrderLive(live,orders):chooseOrder(coach,orders);if(plan?.selected){nextPlan=plan;updateLearning();return plan.selected;}}catch{learningFailed=true;}return orders[0];}
function refreshRecommendation(){if(coach)selectOrder(ORDERS);updateLearning();}
const state={mode:'practice',session:null,ticket:null,cups:[makeCup()],active:0,paused:false,review:false,celebrating:false,screen:'lobby',frame:0,last:0,original:null};
let stage=null,celebrationTimer;
const audio=new CafeAudio(status=>{
 const t=audioTicket;if(t?.presentationId){if(status==='playing')t.audioCompleted=false;if(status==='ready')t.audioCompleted=true;learn('delivery',t.presentationId,{audio:status==='ready'?'completed':status==='error'?'failed':'pending'});}
 $('audio-status').textContent=status==='playing'?'주문을 듣는 중 · 영업 시간은 잠깐 멈춰요.':status==='error'?'소리를 재생하지 못했어요. 다시 듣기를 누르거나 글로 확인해 주세요.':'주문을 들었어요. 컵에 재료를 넣어 주세요.';
});
function playTicket(t){if(!t)return;if(!t.presentationId)t.presentationId=presentOrder(t.order);if(t.playCount)learn('help',t.presentationId,'replay');t.playCount=(t.playCount||0)+1;audioTicket=t;audio.play(t.order);}
// A customer who left before being served: not a language error, but the rush was too fast.
function recordUnanswered(){for(const t of state.session?.records||[]){const close=closingObservation(t);if(!close)continue;
 if(close.answer){answerWithFlow(t,{correct:null,assessable:false,reason:'unanswered'},{outcome:close.outcome});t.learningClosed=true;}
 else{if(live){try{applyFlow(live.observe({outcome:close.outcome}));}catch{live=null;}}t.flowClosed=true;}
}}
function recordResultText(){for(const t of state.session?.records||[]){if(!t.presentationId)t.presentationId=learn('present',orderMetadata(t.order));if(t.presentationId)learn('help',t.presentationId,'text');}}
function switchScreen(screen){state.screen=screen;for(const id of ['lobby','game','results'])$(id).hidden=id!==screen;window.scrollTo({top:0,behavior:'instant'});}
function ticket(){return state.session?.queue.find(t=>t.uid===state.ticket);}
function setFeedback(text,kind=''){$('feedback').textContent=text;$('feedback').className=`feedback ${kind}`;}
function initStage(){if(stage)return;try{stage=new CafeStage($('stage'),selectCup);}catch(error){console.warn('3D renderer unavailable; using accessible flat counter.',error.message);const old=$('stage'),canvas=document.createElement('canvas');canvas.id='stage';canvas.setAttribute('aria-label','음료 제작 작업대');old.replaceWith(canvas);stage=new FlatStage(canvas);}}
function start(isReview=false){
 const target=assignment(),targetDeck=target?assignmentOrders([...ORDERS,...REVIEW],target):null;
 if(target&&!targetDeck.length){$('learning-reason').textContent='지정 주문을 준비하지 못했어요. WORLD에서 다시 열어 주세요.';return;}
 if(target){state.mode='practice';isReview=false;}
 audio.stop();clearTimeout(celebrationTimer);state.celebrating=false;state.pendingServe=false;$('celebration').hidden=true;state.review=isReview;state.paused=false;state.ticket=null;
 audioTicket=null;startLive(isReview);
 state.session=new CafeSession(isReview?'practice':state.mode,Date.now()>>>0,{deck:targetDeck||(isReview?REVIEW:ORDERS),selectOrder:coach?selectOrder:null,orderLimit:targetDeck?.length||(isReview?REVIEW.length:8),tuning:live?tuningFrom(live.settings().values):null});
 flowLine(live?.intro().line||null);
 $('shift-name').textContent=target?'나의 목표 주문':isReview?'새 주문 연습':state.mode==='rush'?'점심 러시':'한가한 오픈';$('time-label').textContent=!isReview&&state.mode==='rush'?'TIME LEFT':'ORDER';
 audio.unlock();switchScreen('game');initStage();updateQueue(true);metrics();state.last=performance.now();cancelAnimationFrame(state.frame);state.frame=requestAnimationFrame(tick);
}
function updateQueue(selectFirst=false){
 const queue=state.session.queue;$('queue-count').textContent=`${queue.length}명 기다리는 중`;
 $('queue').replaceChildren(...queue.map((t,i)=>{const button=document.createElement('button');button.className='customer';button.dataset.uid=t.uid;button.setAttribute('aria-pressed',String(t.uid===state.ticket));button.setAttribute('aria-label',`${t.uid}번 손님 주문 듣기`);const avatar=document.createElement('span');avatar.className='avatar';avatar.textContent=['☺','☻','✿'][t.uid%3];avatar.setAttribute('aria-hidden','true');const copy=document.createElement('span'),strong=document.createElement('strong'),small=document.createElement('small');strong.textContent=`손님 ${String(t.uid).padStart(2,'0')}`;small.textContent=t.uid===state.ticket?'주문 만들고 있어요':'주문을 들어 주세요';copy.append(strong,small);button.append(avatar,copy);if(state.session.mode==='rush'){const patience=document.createElement('span');patience.className='patience';patience.setAttribute('aria-hidden','true');button.append(patience);}button.addEventListener('click',()=>selectTicket(t.uid));return button;}));
 if((selectFirst||!ticket())&&queue.length&&!state.celebrating)selectTicket(queue[0].uid);
 if(!queue.length&&!state.session.done){audio.stop();state.ticket=null;$('audio-status').textContent='다음 손님을 기다리는 중이에요.';$('order-text').hidden=true;$('show-text').setAttribute('aria-pressed','false');$('serve').disabled=true;}
}
function selectTicket(uid){if(state.paused||state.celebrating)return;const t=state.session.queue.find(t=>t.uid===uid);if(!t)return;
 if(uid===state.ticket){playTicket(t);return;}
 const previous=ticket();if(previous){previous.draft=state.cups.map(c=>({...c}));previous.activeCup=state.active;}
 state.ticket=uid;state.cups=t.draft?.map(c=>({...c}))||[makeCup()];state.active=t.activeCup||0;$('order-text').hidden=true;$('show-text').setAttribute('aria-pressed','false');$('order-text').textContent=t.order.text;
 for(const b of $('queue').children){b.setAttribute('aria-pressed',String(Number(b.dataset.uid)===uid));b.querySelector('small').textContent=Number(b.dataset.uid)===uid?'주문 만들고 있어요':'주문을 들어 주세요';}
 setFeedback('컵에 재료를 넣고 서빙해 주세요.');renderCups();playTicket(t);metrics();
}
function selectCup(index){if(state.paused||state.celebrating||index>=state.cups.length)return;state.active=index;renderCups();}
function renderCups(animate=false){
 $('cup-tabs').replaceChildren(...state.cups.map((c,i)=>{const b=document.createElement('button');b.className='cup-tab';b.setAttribute('aria-pressed',String(i===state.active));const strong=document.createElement('strong'),span=document.createElement('span');strong.textContent=`컵 ${i+1}`;span.textContent=describeCup(c);b.append(strong,span);b.addEventListener('click',()=>selectCup(i));return b;}));
 const c=state.cups[state.active];$('active-cup').textContent=`컵 ${state.active+1}`;$('cup-description').textContent=describeCup(c);$('add-cup').disabled=state.cups.length>=2||state.celebrating;$('remove-cup').disabled=state.celebrating;$('remove-cup').firstChild.textContent=state.cups.length>1?'이 컵 제거하기 ':'이 컵 비우기 ';
 document.querySelector('[data-ingredient="cold"] strong').textContent=c.temp==='cold'?'따뜻하게':'차갑게';
 for(const b of document.querySelectorAll('[data-ingredient]')){const k=b.dataset.ingredient;b.setAttribute('aria-pressed',String(k==='coffee'||k==='tea'?c.base===k:k==='cold'?c.temp==='cold':c[k]));b.disabled=state.celebrating;}
 $('serve').disabled=!ticket()||state.celebrating;stage?.sync(state.cups,state.active,animate);
}
function ingredient(action){if(state.screen!=='game'||state.paused||state.celebrating||!ticket())return;state.cups[state.active]=editCup(state.cups[state.active],action);audio.tone('tap');renderCups(['coffee','tea','milk'].includes(action));}
function addCup(){if(state.paused||state.celebrating||!ticket()||state.cups.length>=2)return;state.cups.push(makeCup());state.active=state.cups.length-1;renderCups();}
function removeCup(){if(state.paused||state.celebrating||!ticket())return;if(state.cups.length>1){state.cups.splice(state.active,1);state.active=0;}else state.cups[0]=makeCup();renderCups();}
function serve(){
 if(state.screen!=='game'||state.paused||state.celebrating||!ticket())return;const t=ticket(),judged=judgeOrder(t.order,state.cups);
 const evidence=t.presentationId?answerWithFlow(t,{...orderAnswer(judged,t),attemptNo:t.attempts+1},{pressure:pressureOf(t,state.session),...(t.audioCompleted===true||t.help?{}:{outcome:'void'})}):null;if(!t.attempts){t.learningFirstResult=evidence;t.firstErrorKind=judged.correct?null:judged.kind;}
 const result=state.session.submit(t.uid,state.cups);if(!result)return;
 if(result.correct){audio.stop();audio.tone('serve');state.celebrating=true;$('celebration').hidden=false;setFeedback(result.feedback,'good');renderCups();metrics();
  celebrationTimer=setTimeout(completeServe,matchMedia('(prefers-reduced-motion: reduce)').matches?300:850);
 }else{audio.tone('wrong');setFeedback(`${result.feedback} 고친 뒤 다시 서빙할 수 있어요.`,'wrong');if(t.presentationId)learn('help',t.presentationId,'hint');metrics();}updateLearning();
}
function completeServe(){if(state.paused){state.pendingServe=true;return;}state.pendingServe=false;state.celebrating=false;$('celebration').hidden=true;if(state.screen!=='game')return;if(state.session.done)finish();else updateQueue(true);}
function metrics(){const s=state.session;if(!s)return;$('score').textContent=String(s.score).padStart(4,'0');$('combo').textContent=s.combo;$('time').textContent=s.mode==='rush'?`${Math.max(0,Math.ceil(s.tuning.duration-s.time))}s`:`${Math.min(s.serial,s.orderLimit)} / ${s.orderLimit}`;for(const el of $('queue').children){const t=s.queue.find(t=>t.uid===Number(el.dataset.uid));const bar=el.querySelector('.patience');if(t&&bar)bar.style.transform=`scaleX(${Math.max(0,1-(s.time-t.born)/t.patience)})`;}}
function tick(now){if(state.screen!=='game')return;const dt=Math.min(.1,Math.max(0,(now-state.last)/1000));state.last=now;
 if(!state.paused&&!audio.busy&&!state.celebrating&&!document.hidden){const before=state.session.queue.map(t=>t.uid).join(',');state.session.step(dt);recordUnanswered();if(state.session.done){finish();return;}if(before!==state.session.queue.map(t=>t.uid).join(',')){if(!ticket())audio.stop();updateQueue();}metrics();}
 if(!state.paused&&!document.hidden)stage?.render(dt);state.frame=requestAnimationFrame(tick);
}
function pause(){if(state.screen!=='game'||state.paused)return;state.paused=true;audio.pause();$('pause-dialog').showModal();}
function resume(){state.paused=false;$('pause-dialog').close();state.last=performance.now();if(state.pendingServe)completeServe();else audio.resume();}
function finish(){
 if(state.screen!=='game')return;state.session.finish();audio.stop();cancelAnimationFrame(state.frame);clearTimeout(celebrationTimer);state.celebrating=false;$('celebration').hidden=true;$('pause-dialog').close();
 recordUnanswered();recordResultText();
 const flowEnd=live?(()=>{try{return live.end();}catch{return null;}})():null,flowChanges=flowEnd&&flowSpec?describeChanges(flowSpec,flowStart,flowEnd.settings.values):[];
 const flowBox=$('result-flow'),suggestion=easierSuggestion(flowSpec,flowEnd,state.session.stats());if(flowBox){flowBox.hidden=!flowEnd;const list=flowBox.querySelector('ul');list.replaceChildren(...(flowChanges.length?flowChanges:[flowEnd?.settings.adaptive===false?'정해진 속도로 영업했어요.':'이번 영업은 처음 속도 그대로였어요.']).concat(suggestion?[suggestion]:[]).map(text=>{const li=document.createElement('li');li.textContent=text;if(text===suggestion)li.className='suggest';return li;}));}
 live=null;flowLine(null);refreshRecommendation();
 const s=state.session,stats=s.stats();if(!state.review)state.original={stats,score:s.score,records:s.records.map(r=>({...r}))};switchScreen('results');
 const entries=[['서빙 점수',String(s.score)],['최고 콤보',String(s.best)],['서빙 완료',`${stats.served}개 주문`],['첫 제출 정확도',stats.answered?`${Math.round(stats.firstCorrect/stats.answered*100)}%`:'—'],['글로 확인한 주문',`${stats.help} / ${stats.answered}`],['미응답 주문',`${stats.unanswered}`]];
 $('result-metrics').replaceChildren(...entries.map(([label,value])=>{const d=document.createElement('div'),small=document.createElement('small'),b=document.createElement('b');small.textContent=label;b.textContent=value;d.append(small,b);return d;}));
 $('review').hidden=state.review;$('results').querySelector('h1').innerHTML=state.review?'새로운 주문도,<br><em>차근차근 들어요.</em>':'오늘도,<br><em>잘 들었습니다.</em>';
 $('round-records').replaceChildren(...s.records.map(r=>{const details=document.createElement('details'),summary=document.createElement('summary'),status=document.createElement('span'),p=document.createElement('p');status.className='status';status.textContent=r.first===null?'미응답':`${r.first?'첫 제출 정답':'조건을 다시 확인'}${r.help?' · 글로 확인':''}${r.outcome==='served'?' · 서빙 완료':' · 서빙 미완료'}`;summary.append(status,document.createTextNode(r.order.text));p.textContent=`연습한 표현: ${r.order.skill}. 주문: ${r.order.cups.map(c=>describeCup({...makeCup(),...c})).join(' / ')}${r.order.cups.some(c=>!('sugar'in c)||!('ice'in c))?' (말하지 않은 재료 조건은 채점에서 제외했어요.)':''}`;details.addEventListener('toggle',()=>{if(details.open&&!r.answerRevealed){if(r.presentationId)learn('help',r.presentationId,'answer');r.answerRevealed=true;}});details.append(summary,p);return details;}));
 if(!s.records.length)$('round-records').textContent='이번 영업에는 제출한 주문이 없어요.';
}
document.querySelectorAll('[data-mode]').forEach(b=>{if(assignment()&&b.dataset.mode!=='practice')b.disabled=true;b.addEventListener('click',()=>{if(assignment()&&b.dataset.mode!=='practice')return;state.mode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));});});
document.querySelectorAll('[data-flow]').forEach(b=>b.addEventListener('click',()=>setFlowMode(b.dataset.flow)));renderFlowChoice();
$('start').addEventListener('click',()=>start());$('replay').addEventListener('click',()=>start());$('review-start').addEventListener('click',()=>start(true));$('home').addEventListener('click',()=>{audio.stop();switchScreen('lobby');refreshRecommendation();});
document.querySelectorAll('[data-ingredient]').forEach(b=>b.addEventListener('click',()=>ingredient(b.dataset.ingredient)));
$('add-cup').addEventListener('click',addCup);$('remove-cup').addEventListener('click',removeCup);$('serve').addEventListener('click',serve);
$('listen').addEventListener('click',()=>{if(!state.paused&&ticket())playTicket(ticket());});
$('show-text').addEventListener('click',()=>{const t=ticket();if(!t||state.paused)return;const show=$('order-text').hidden;$('order-text').hidden=!show;$('show-text').setAttribute('aria-pressed',String(show));if(show){t.help=true;if(t.presentationId)learn('help',t.presentationId,'text');}});
$('finish').addEventListener('click',finish);$('pause').addEventListener('click',pause);$('resume').addEventListener('click',resume);$('leave').addEventListener('click',finish);
$('pause-dialog').addEventListener('cancel',e=>{e.preventDefault();resume();});
$('help-open').addEventListener('click',()=>$('help').showModal());$('help-close').addEventListener('click',()=>$('help').close());
document.addEventListener('keydown',e=>{if(state.screen!=='game'||state.paused||e.repeat||e.target.closest('input,textarea,select')||e.altKey||e.metaKey||e.ctrlKey)return;const key=e.key.toLowerCase();if(key==='escape'){e.preventDefault();pause();return;}
 if(key==='enter')return;
 const keys={'1':'coffee','2':'tea','3':'milk','4':'ice','5':'sugar','6':'cold'};if(keys[key]){e.preventDefault();ingredient(keys[key]);}else if(key==='q'){e.preventDefault();addCup();}else if(key==='r'){e.preventDefault();if(ticket())playTicket(ticket());}else if(key==='backspace'){e.preventDefault();removeCup();}else if(key===' '){e.preventDefault();serve();}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.screen==='game'&&!state.paused&&!state.celebrating)pause();});
window.addEventListener('pagehide',()=>{audio.stop();cancelAnimationFrame(state.frame);stage?.dispose();});
$('learning-reset').addEventListener('click',()=>{try{coach?.reset();learningFailed=!coach;nextPlan=null;}catch{learningFailed=true;}refreshRecommendation();});
refreshRecommendation();
window.synkCafe={get flow(){return live?{settings:live.settings(),trace:live.trace()}:null;},get tuning(){return state.session?{...state.session.tuning}:null;},get learning(){return learn('summary');},get current(){return ticket()?{id:ticket().order.id,presentationId:ticket().presentationId,audioCompleted:!!ticket().audioCompleted}:null;}};
