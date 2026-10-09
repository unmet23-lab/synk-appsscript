import { WORDS } from './audio.mjs';
import { validExpedition } from './starbook.mjs';

const GROUPS=[['red','blue'],['up','down'],['one','two','three']];
const EN={red:'red',blue:'blue',up:'up',down:'down',one:'once',two:'twice',three:'three times'};
export function recallPlan(expedition,random=Math.random){
  const item=validExpedition(expedition);if(!item)return null;
  const used=new Set(item.records.map(r=>r.word));
  return {expeditionId:item.expeditionId,words:GROUPS.map(group=>{const pool=group.filter(word=>used.has(word));return pool[Math.min(pool.length-1,Math.floor(Math.max(0,Math.min(.999999,random()))*pool.length))];})};
}
const picture=word=>word==='red'||word==='blue'?`<span class="disc ${word==='blue'?'blue':''}" aria-hidden="true">${word==='red'?'▲':'●'}</span>`:word==='up'||word==='down'?`<span class="arrow" aria-hidden="true">${word==='up'?'↑':'↓'}</span>`:`<span class="star-group" aria-hidden="true">${Array.from({length:{one:1,two:2,three:3}[word]},()=>'<i class="pump-dot"></i>').join('')}</span>`;

// A practice overlay only. It never creates a room, changes cooperative stats,
// records mastery or asks the collection for coins.
export function createReturnRecall({onPrepare,onListen,onStop,canRun=()=>true}){
  const dialog=document.createElement('dialog');dialog.id='return-recall';dialog.setAttribute('aria-labelledby','return-recall-title');document.body.append(dialog);
  const sessions=new Map();let run=null,opener=null,version=0,ready=false,preparing=false,playing=false,error='';
  const word=()=>run?.words[run.index];
  const isRetry=()=>run?.index>=3;
  function paint(){
    if(!run)return;const active=dialog.contains(document.activeElement)?document.activeElement:null,action=active?.dataset.returnAction,choice=active?.dataset.word;
    const target=word(),answer=run.answer,done=run.index>=run.words.length;
    dialog.innerHTML=`<header class="shop-heading"><div><span class="eyebrow">FREE SOLO PRACTICE</span><h2 id="return-recall-title">${done?'소리 3개를 다시 만났어요':'기억한 소리로 다시 움직여요'}</h2></div><button class="text-button" data-return-action="close">닫기 / Close</button></header><p class="return-scope">지난 탐험에서 함께 쓴 소리만 들어요. 복습은 코인·완주 기록에 더하지 않아요.<br><span lang="en">Sounds from a finished expedition. Practice only; no coins or completion credit.</span></p>${done?`<section class="return-finish"><img src="assets/felt/sparkle.webp" alt=""><h3>처음 떠올린 소리 ${run.first.filter(x=>x.correct).length} / 3</h3><p>${run.words.length>3?'놓친 표현도 다시 듣고 행동했어요.':'세 소리를 혼자 다시 골랐어요.'}<br><span lang="en">${run.words.length>3?'You heard and acted on the missed sounds again.':'You chose three sounds on your own.'}</span></p><p class="fine">방금의 짧은 복습 결과예요. 실제 학습 향상을 뜻하지 않아요.</p><button class="felt coral" data-return-action="close">하던 화면으로 돌아가기<small>Back to your previous screen</small></button><button class="text-button" data-return-action="again">같은 소리 한 번 더 / Practice again</button></section>`:`<section class="return-question"><p class="tag">${isRetry()?'놓친 표현 한 번 더 / Try the missed sound again':`복습 ${run.index+1} / 3 · Recall`}</p><h3>${isRetry()?'다시 듣고 그림을 골라요':'소리만 듣고 그림을 골라요'}</h3><p lang="en">Which picture matches the sound?</p><button class="felt cream listen-button" data-return-action="listen" ${preparing||playing?'disabled':''}>${preparing?'소리 준비 중 / Preparing':playing?'듣고 있어요 / Listening':'♪ 소리 듣기 / Listen'}</button><div class="words controls ${GROUPS.find(g=>g.includes(target)).length===3?'three':''}">${GROUPS.find(g=>g.includes(target)).map(choice=>`<button class="word-btn${answer===choice?' chosen':''}" data-return-action="answer" data-word="${choice}" aria-label="${EN[choice]}" aria-pressed="${answer===choice}" ${!ready||answer?'disabled':''}>${picture(choice)}</button>`).join('')}</div>${answer?`<div class="feedback ${answer===target?'good':''}"><strong>${answer===target?'기억했어요!':'이 소리였어요.'}</strong><p>${WORDS[target]} · ${EN[target]}${answer!==target?'<br>다음에 한 번 더 듣고 움직여 봐요. / Act on this sound again shortly.':''}</p></div><button class="felt coral listen-button" data-return-action="next">${run.index===run.words.length-1?'복습 마치기 / Finish practice':'다음 소리 / Next sound'}</button>`:''}</section>`}<p class="return-error" role="status">${error}</p>`;
    if(action)dialog.querySelector(`[data-return-action="${action}"]${choice?`[data-word="${choice}"]`:''}`)?.focus({preventScroll:true});
  }
  function suspend(){version++;onStop();ready=false;preparing=false;playing=false;}
  function close({restore=true}={}){suspend();if(dialog.open)dialog.close();if(restore&&opener?.isConnected&&!opener.hidden&&!document.querySelector('dialog[open]'))opener.focus({preventScroll:true});}
  async function listen(){
    if(!run||run.index>=run.words.length||preparing||playing||!canRun())return;
    const mine=++version,index=run.index,plan=run;ready=false;error='';preparing=true;paint();
    try{await onPrepare();if(mine!==version||!dialog.open||run!==plan||!canRun())return;preparing=false;playing=true;paint();const completed=await onListen(word());if(mine!==version||run!==plan||run.index!==index||!dialog.open)return;playing=false;ready=completed;paint();}
    catch{if(mine===version&&dialog.open){preparing=false;playing=false;ready=false;error='소리를 준비하지 못했어요. 다시 눌러 주세요. / Could not prepare the sound. Please retry.';paint();}}
  }
  function open(expedition){
    if(!canRun())return false;const plan=recallPlan(expedition);if(!plan)return false;
    suspend();opener=document.activeElement;run=sessions.get(plan.expeditionId);
    if(!run){run={...plan,index:0,answer:null,first:[]};sessions.set(plan.expeditionId,run);}
    error='';paint();if(!dialog.open)dialog.showModal();dialog.querySelector('[data-return-action="close"]')?.focus();return true;
  }
  dialog.addEventListener('click',e=>{
    const button=e.target.closest('button');if(!button||button.disabled||!run)return;const action=button.dataset.returnAction;
    if(action==='close')return close();if(action==='listen')return listen();
    if(action==='answer'&&ready&&!run.answer){const selected=button.dataset.word,target=word();if(!GROUPS.find(g=>g.includes(target)).includes(selected))return;run.answer=selected;if(!isRetry()){run.first.push({word:target,choice:selected,correct:selected===target});if(selected!==target)run.words.push(target);}paint();dialog.querySelector('[data-return-action="next"]')?.focus({preventScroll:true});}
    if(action==='next'&&run.answer){suspend();run.index++;run.answer=null;error='';paint();dialog.querySelector(`[data-return-action="${run.index>=run.words.length?'close':'listen'}"]`)?.focus({preventScroll:true});}
    if(action==='again'){suspend();run.words=run.words.slice(0,3);run.index=0;run.answer=null;run.first=[];error='';paint();dialog.querySelector('[data-return-action="listen"]')?.focus({preventScroll:true});}
  });
  dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.addEventListener('close',()=>{if(!dialog.open)suspend();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&dialog.open){suspend();paint();}});
  return {open,close,isOpen:()=>dialog.open,suspend:()=>{suspend();if(dialog.open)paint();}};
}
