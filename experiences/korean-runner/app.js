import {mountListeningCheck} from './listening-check-ui.mjs';
import {RunnerModel,driveDemo} from './core.mjs';
import {INSTRUCTIONS,actionLabel} from './instructions.mjs';
import {createWorld} from './world.mjs';
import {KeyboardInput,KEY_ACTIONS} from './controls.mjs';
import {InstructionAudio} from './audio.mjs';
import {instructionMetadata,chooseInstruction,actionEvidence,FLOW_RUN,TIRED_RUN,FLOW_WORDS,paceOf,runObservation} from './learning.mjs';
import {ShopStore} from './shop.mjs';
import {createShopUI} from './shop-ui.mjs';
import {createJourneyUI} from './goals-ui.mjs';
const $=id=>document.getElementById(id),keyboard=new KeyboardInput();
let coach=null,learningFailed=false,nextPlan=null,practicePresentation=null;
try{coach=globalThis.SynkLearning?.createGame({gameId:'korean-runner',storage:localStorage})||null;}catch{learningFailed=true;}
function learn(method,...args){try{return coach?.[method](...args);}catch{learningFailed=true;return null;}}
// Inside SYNK WORLD the record is the account's: kept and deleted there, not in this browser.
const hosted=(()=>{try{return typeof coach?.assignment==='function';}catch{return false;}})();
function updateLearning(){const summary=learn('summary'),text=!coach||learningFailed||summary?.storage?.available===false?'학습 기록을 저장할 수 없어 기본 부탁으로 달려요.':`${nextPlan?.reason||'아직 만나지 않은 부탁부터 준비했어요.'} 조작 결과로 듣기 실력을 단정하지 않아요.`;for(const id of ['learning-reason','result-learning'])if($(id))$(id).textContent=text;}
function selectInstruction(items){if(!coach||learningFailed)return items[0];try{const plan=chooseInstruction(coach,items);if(plan?.selected){nextPlan=plan;updateLearning();return plan.selected;}}catch{learningFailed=true;}return items[0];}
function refreshRecommendation(){if(coach)selectInstruction(INSTRUCTIONS);updateLearning();}
// Atlas moment-level challenge: the run's pace follows this person (never the demo). A tired day does not speed up.
let live=null;
function startLive(){live=null;if(demo||!coach||learningFailed||typeof coach.live!=='function')return null;try{const tired=coach.today?.()==='tired';live=coach.live(FLOW_RUN,{words:FLOW_WORDS,...(tired?{declared:TIRED_RUN}:{})});return paceOf(live.settings().values);}catch{live=null;return null;}}
function followPace(notice){const observation=live&&runObservation(notice);if(!observation)return;try{const out=live.observe(observation);if(out.change){model.tune(paceOf(out.settings.values));if(out.line)toast(out.line.text);}}catch{live=null;}}
function endLive(){try{live?.end();}catch{/* the pace memory is a convenience */}live=null;}
const panels=['pause-panel','settings-panel','practice-panel','audio-panel','result'];
let world,model=null,running=false,paused=false,ready=false,starting=false,demo=false,resuming=false;
let ending=false,resultRevealAt=0;
let mode='tour',sound=true,storageAvailable=true,modalOrigin=null,settingsWasPaused=false;
let collectionRoundId=null;
const shopStore=new ShopStore();let shopUI=null,journeyUI=null,shopRoundId=null,shopReturn='intro';
let audio,master,voiceGain,voiceBank,retryAudio=null,practiceIndex=0,previewRevision=0,pendingInstruction=null;
let lastFrame=performance.now(),hudClock=0,toastUntil=0,nearUntil=0,feedbackUntil=0,musicClock=0,musicStep=0;
const prefersReduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
function stored(key,fallback){try{return localStorage.getItem('synk.windrun.'+key)||fallback;}catch{storageAvailable=false;return fallback;}}
function store(key,value){try{localStorage.setItem('synk.windrun.'+key,String(value));}catch{storageAvailable=false;}}
let best=Number(stored('best','0'))||0;
let quality=stored('quality',innerWidth<700?'balanced':'experience');
if(!['balanced','experience'].includes(quality))quality='balanced';
$('best-intro').textContent=best+' m';$('motion').checked=prefersReduced;
function announce(text){$('live').textContent=text;}
function settleShopRound(){if(!model||!shopRoundId)return null;const result=shopStore.settleRun({roundId:shopRoundId,coins:model.coins,distance:model.distance,completed:model.finished&&model.reason==='tour',automatic:demo});if(!result.duplicate)journeyUI?.refresh(result);return result;}
function shopRewardText(result){return demo?'자동 시연에서는 바람길 별을 적립하지 않아요.':!result?.ok?'별을 저장하지 못했어요. 브라우저 저장을 확인해 주세요.':`이번 달리기 +${result.earned}별 · 수집 ${result.coins}별${result.bonus?' + 완주 '+result.bonus+'별':''}${result.goalBonus?' + 여행 목표 '+result.goalBonus+'별':''}`;}
function toast(text,duration=2100){$('toast').textContent=text;$('toast').hidden=false;toastUntil=performance.now()+duration;announce(text);}
function audioInit(){
  if(!audio||audio.state==='closed'){
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return false;
    audio=new AC();master=audio.createGain();master.gain.value=.13;master.connect(audio.destination);
    voiceGain=audio.createGain();voiceGain.gain.value=.88;voiceGain.connect(audio.destination);
    voiceBank=new InstructionAudio(audio,voiceGain,master,undefined,(status,item)=>{if(item.presentationId)learn('delivery',item.presentationId,{audio:status});});
    audio.onstatechange=()=>{if(running&&!paused&&!model?.finished&&audio.state!=='running')pause();};
  }
  return true;
}
async function ensureVoices(){try{if(!audioInit()||!await voiceBank.resume())return false;return await voiceBank.prepare(INSTRUCTIONS);}catch{return false;}}
function cancelVoice(){previewRevision++;voiceBank?.stop();}
function setSound(value){
  if (!value && listeningCheck?.open) listeningCheck.interrupt();
  if(!value&&running&&!model.finished&&!paused)pause();
  sound=value;if(voiceGain)voiceGain.gain.value=sound?.88:0;
  $('sound').setAttribute('aria-pressed',String(sound));$('sound').setAttribute('aria-label',sound?'소리 끄기':'소리 켜기');
  $('resume').innerHTML=sound?'계속 달리기 <span>→</span>':'소리 켜고 계속 달리기 <span>→</span>';
  $('pause-copy').textContent=sound?'목소리와 마을이 함께 멈췄어요.':'소리를 켜면 멈춘 지점부터 이어서 달려요.';
}
function note(freq,duration=.15,type='sine',gain=.25,delay=0){
  if(!sound||!audio||audio.state!=='running'||!master)return;const t=audio.currentTime+delay,o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(gain,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);g.connect(master);o.start(t);o.stop(t+duration+.02);
}
function effectAudio(type){if(type==='coin'||type==='step')note(1174,.14,'sine',.3);if(type==='correct')[523,659,784].forEach((f,i)=>note(f,.24,'sine',.23,i*.08));if(type==='hit')note(110,.19,'triangle',.35);if(type==='jump')note(440,.09,'sine',.12);if(type==='shield'||type==='earnedShield'){note(880,.25,'sine',.25);note(660,.25,'sine',.2,.1);}}
function selectButtons(attribute,value){document.querySelectorAll('['+attribute+']').forEach(b=>{const selected=b.getAttribute(attribute)===value;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));});}
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.mode;selectButtons('data-mode',mode);}));
$('sound').addEventListener('click',()=>setSound(!sound));
function showModal(panel){if($('modal-layer').hidden)modalOrigin=document.activeElement;$('modal-layer').hidden=false;for(const id of panels)$(id).hidden=id!==panel;$(panel).querySelector('button')?.focus();}
function closeModal(){$('modal-layer').hidden=true;for(const id of panels)$(id).hidden=true;modalOrigin?.focus();}
function pause(){if(!running||model.finished||paused)return;paused=true;keyboard.reset();gesture=null;voiceBank?.pause().catch(()=>{});showModal('pause-panel');announce('일시정지');}
function audioFault(retry){retryAudio=retry;if(running){paused=true;keyboard.reset();voiceBank?.pause().catch(()=>{});}showModal('audio-panel');}
async function resume(){
  if(!running||model.finished||resuming)return;resuming=true;setSound(true);
  try{if(!await ensureVoices()){audioFault(resume);return;}if(pendingInstruction){if(!voiceBank.play(pendingInstruction)){audioFault(resume);return;}pendingInstruction=null;}closeModal();lastFrame=performance.now();paused=false;}
  catch{audioFault(resume);}finally{resuming=false;}
}
$('pause-button').addEventListener('click',pause);$('resume').addEventListener('click',resume);
$('settings-button').addEventListener('click',()=>{settingsWasPaused=paused;paused=running?true:paused;keyboard.reset();voiceBank?.pause().catch(()=>{});showModal('settings-panel');});
$('close-settings').addEventListener('click',()=>{if(running&&!model.finished&&!settingsWasPaused){if(sound)resume();else showModal('pause-panel');}else{closeModal();if(running&&!model.finished)showModal('pause-panel');}});
document.querySelectorAll('[data-quality]').forEach(b=>b.addEventListener('click',()=>{quality=b.dataset.quality;world?.setQuality(quality);store('quality',quality);selectButtons('data-quality',quality);}));selectButtons('data-quality',quality);
$('motion').addEventListener('change',()=>world?.setMotion($('motion').checked));
$('audio-retry').addEventListener('click',()=>retryAudio?.());$('audio-home').addEventListener('click',home);
async function start(asDemo=false){
  if(!ready||starting)return;starting=true;keyboard.reset();cancelVoice();setSound(true);
  $('start').disabled=true;$('demo').disabled=true;$('start').querySelector('span').textContent='목소리를 준비하고 있어요';
  try{
    if(!await ensureVoices()){audioFault(()=>start(asDemo));return;}
    settleShopRound();setSound(true);pendingInstruction=null;ending=false;demo=asDemo;endLive();model=new RunnerModel({mode:demo?'tour':mode,learning:'listen',chooseInstruction:demo||!coach?null:selectInstruction,pace:startLive()||undefined});collectionRoundId=globalThis.SynkPlayCollection?.roundId('runner')||null;shopRoundId=globalThis.crypto?.randomUUID?.()||('run-'+Date.now()+'-'+Math.random().toString(36).slice(2));world.setCosmetics(shopStore.snapshot().equipped);running=true;paused=false;closeModal();$('demo-banner').hidden=!demo;
    document.body.classList.add('playing');document.body.classList.toggle('demo',demo);$('intro').hidden=true;$('hud').hidden=false;$('pause-button').hidden=false;
    $('cue').hidden=true;$('combo').hidden=true;$('feedback').hidden=true;$('toast').hidden=true;
    musicClock=0;musicStep=0;lastFrame=performance.now();hudClock=0;updateHUD();announce('한국어 지시를 듣고 바람길을 달려요.');
    const opening=(()=>{try{return live?.intro().line?.text||null;}catch{return null;}})();if(opening)toast(opening,2600);
  }finally{starting=false;$('start').disabled=false;$('demo').disabled=false;$('start').querySelector('span').textContent='바람길 달리기';}
}
function home(){settleShopRound();closeUnanswered();endLive();running=false;paused=false;ending=false;demo=false;model=null;shopRoundId=null;pendingInstruction=null;keyboard.reset();cancelVoice();closeModal();document.body.classList.remove('playing','demo');$('hud').hidden=true;$('intro').hidden=false;$('pause-button').hidden=true;$('cue').hidden=true;$('toast').hidden=true;$('best-intro').textContent=best+' m';refreshRecommendation();$('start').focus();}
$('start').addEventListener('click',()=>start());$('demo').addEventListener('click',()=>start(true));$('restart').addEventListener('click',()=>start());$('back-home').addEventListener('click',home);$('result-home').addEventListener('click',home);
function practiceActions(item){
  return item.steps.flatMap((step,i)=>{const el=document.createElement('span');el.className='practice-action';el.textContent=step.action==='lane'?['←','•','→'][step.target]:step.action==='jump'?'↑':step.action==='slide'?'↓':'＝';el.setAttribute('aria-label',actionLabel(step));if(!i)return[el];const then=document.createElement('small');then.textContent='다음';return[then,el];});
}
function renderPractice(){const item=INSTRUCTIONS[practiceIndex];$('practice-count').textContent=String(practiceIndex+1).padStart(2,'0')+' / 16';$('practice-text').textContent=item.text;$('practice-meaning').textContent=item.explanation;$('practice-actions').replaceChildren(...practiceActions(item));practicePresentation=learn('present',instructionMetadata(item));if(practicePresentation)learn('help',practicePresentation,'answer');}
async function preview(item,panel){
  cancelVoice();const revision=previewRevision;setSound(true);
  if(!await ensureVoices()){if(revision===previewRevision)toast('목소리를 준비하지 못했어요. 다시 듣기를 눌러 주세요.');return;}
  if(revision!==previewRevision||$(panel).hidden)return;
  if(!voiceBank.play(item))toast('목소리를 다시 준비해 주세요.');
}
function openPractice(){showModal('practice-panel');renderPractice();preview(INSTRUCTIONS[practiceIndex],'practice-panel');}
$('practice').addEventListener('click',openPractice);
$('practice-prev').addEventListener('click',()=>{practiceIndex=(practiceIndex+INSTRUCTIONS.length-1)%INSTRUCTIONS.length;renderPractice();preview(INSTRUCTIONS[practiceIndex],'practice-panel');});
$('practice-next').addEventListener('click',()=>{practiceIndex=(practiceIndex+1)%INSTRUCTIONS.length;renderPractice();preview(INSTRUCTIONS[practiceIndex],'practice-panel');});
$('practice-replay').addEventListener('click',()=>preview(INSTRUCTIONS[practiceIndex],'practice-panel'));
$('close-practice').addEventListener('click',()=>{cancelVoice();closeModal();});
function action(value){if(running&&!paused&&!model.finished&&!demo)model.input(value);}
document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('pointerdown',e=>{e.preventDefault();action(b.dataset.action);}));
window.addEventListener('keydown',e=>{
  if(e.code==='Escape'){if(e.repeat)return;if(shopUI?.visible){shopUI.close();return;}if(!$('settings-panel').hidden){$('close-settings').click();return;}if(!$('practice-panel').hidden){$('close-practice').click();return;}if(running&&!model.finished){if(!$('pause-panel').hidden)resume();else if(!paused)pause();}return;}
  if(!running||paused||model.finished||demo)return;
  if(KEY_ACTIONS[e.code]){e.preventDefault();const value=keyboard.down(e.code,e.repeat);if(value)action(value);}
});
window.addEventListener('keyup',e=>keyboard.up(e.code));
let gesture=null;
$('world').addEventListener('pointerdown',e=>{if(!running||paused||demo)return;gesture={x:e.clientX,y:e.clientY,id:e.pointerId};$('world').setPointerCapture(e.pointerId);});
$('world').addEventListener('pointerup',e=>{if(!gesture||gesture.id!==e.pointerId)return;const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;gesture=null;if(Math.max(Math.abs(dx),Math.abs(dy))<22)return;action(Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'slide':'jump');});
$('world').addEventListener('pointercancel',()=>{gesture=null;});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&running&&!paused&&!model.finished)pause();});
window.addEventListener('blur',()=>{keyboard.reset();if(running&&!paused&&!model.finished)pause();});
document.addEventListener('keydown',e=>{if(e.key!=='Tab'||$('modal-layer').hidden)return;const panel=[...$('modal-layer').children].find(el=>!el.hidden),all=[...panel.querySelectorAll('button,input,a')].filter(el=>!el.disabled&&!el.hidden);if(!all.length)return;const first=all[0],last=all.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}});
function refreshInstruction(){const m=model?.currentMission;if(!m)return;$('step-dots').replaceChildren(...m.steps.map((s,i)=>{const dot=document.createElement('span');dot.className=s.resolved?s.executed?'done':'missed':i===m.steps.findIndex(x=>!x.resolved)?'current':'';dot.textContent=s.resolved?s.executed?'✓':'×':String(i+1);dot.setAttribute('aria-label',`${i+1}번째 동작 ${s.resolved?s.executed?'수행':'미수행':'예정'}`);return dot;}));}
function showInstruction(m){if(!demo&&!m.presentationId)m.presentationId=learn('present',instructionMetadata(m.instruction));$('cue').hidden=false;refreshInstruction();if(!voiceBank?.play(m)){pendingInstruction=m;audioFault(resume);return;}announce('한국어 지시를 듣고 움직여요.');}
function recordAction(m,correct){if(demo||!m.presentationId||m.learningClosed)return;learn('answer',m.presentationId,actionEvidence(m,correct));m.learningClosed=true;}
function closeUnanswered(){if(demo)return;for(const m of model?.missions||[])if(m.presentationId&&!m.learningClosed){learn('answer',m.presentationId,{correct:null,assessable:false,reason:'unanswered'});m.learningClosed=true;}}
function feedback(symbol,label){$('feedback').textContent=symbol;$('feedback').setAttribute('aria-label',label);$('feedback').hidden=false;feedbackUntil=performance.now()+850;announce(label);}
function finish(){
  updateHUD();closeUnanswered();endLive();paused=true;keyboard.reset();cancelVoice();$('cue').hidden=true;$('pause-button').hidden=true;if(!demo)refreshRecommendation();
  const distance=Math.floor(model.distance),newBest=!demo&&distance>best;if(newBest){best=distance;store('best',best);}
  $('result-eyebrow').textContent=demo?'A WALK THROUGH WIND VILLAGE':'YOUR LITTLE ADVENTURE';
  $('result-title').textContent=demo?'이제, 몸으로 달려볼까요?':model.reason==='tour'?'바람길 한 바퀴, 완주!':'다음엔 한 걸음 더!';
  $('result-distance').textContent=distance;$('result-best').textContent=demo?'자동 시연 · 개인 기록과 학습 성과에 포함하지 않아요.':newBest?'나의 새로운 생존 거리!':`나의 최고 생존 거리 ${best} m`;
  $('result-coins').textContent=model.lanterns;$('result-correct').textContent=`${model.correct} / ${model.answers.length}`;$('result-near').textContent=model.maxCombo;
  $('result-shop-reward').textContent=shopRewardText(settleShopRound());
  const completedModel=model;
  $('result-collection-reward').textContent='공통 차고에 완주를 모으고 있어요.';
  globalThis.SynkPlayCollection?.award({game:'runner',total:model.answers.length,correct:model.correct,completed:model.finished&&model.reason==='tour',automatic:demo,roundId:collectionRoundId}).then(result=>{
    if(model===completedModel)$('result-collection-reward').textContent=globalThis.SynkPlayCollection.rewardText(result);
  });
  const missed=[...new Map(model.answers.filter(a=>!a.correct).map(a=>[a.id,a])).values()],review=(missed.length?missed:model.answers).slice(0,4);
  const timing=model.answers.flatMap(a=>a.steps).filter(s=>s.status==='timing').length;
  $('review').replaceChildren();const intro=document.createElement('p');intro.textContent=demo?'시연은 지시와 동작을 미리 알고 움직여요.':`지시 수행 기록이에요. 이해도를 확정하는 점수는 아니에요.${timing?` 동작은 맞았지만 타이밍을 놓친 표시선 ${timing}개.`:''}`;$('review').append(intro);
  for(const a of review){const row=document.createElement('div');row.className='instruction-review';const text=document.createElement('strong');text.textContent=a.text;const why=document.createElement('p');why.textContent=a.explanation;const result=document.createElement('small');result.textContent=a.steps.map(s=>`${s.label}: ${s.status==='done'?'수행':s.status==='timing'?'타이밍 놓침':s.status==='different'?'다른 동작':'미수행'}`).join(' · ');const b=document.createElement('button');b.textContent='다시 듣기 ↻';b.addEventListener('click',()=>preview(a,'result'));row.append(text,why,result,b);$('review').append(row);}
  ending=true;resultRevealAt=performance.now()+(prefersReduced?800:1900);announce(`달리기 종료. ${distance}미터, 부탁 ${model.correct}개 수행.`);
}
function updateHUD(){
  $('run-stars').textContent=model.coins;
  $('distance').innerHTML=Math.floor(model.distance)+'<span>m</span>';$('distance').setAttribute('aria-label',`달린 거리 ${Math.floor(model.distance)}미터`);$('coins').textContent=model.lanterns;$('coins').setAttribute('aria-label',`밝힌 등불 ${model.lanterns}개`);
  $('hearts').textContent=Array.from({length:3},(_,i)=>i<model.hearts?'●':'○').join(' ');$('hearts').setAttribute('aria-label','보호 '+model.hearts+'회');
  if(model.mode==='tour'){const sec=Math.max(0,Math.ceil(90-model.elapsed));$('timer').textContent=Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0');$('progress').style.width=Math.min(100,model.elapsed/90*100)+'%';}
  else{$('timer').textContent=Math.floor(model.elapsed);$('progress').style.width=Math.min(100,model.distance%500/5)+'%';}
  [...$('streak').children].forEach((dot,i)=>dot.classList.toggle('lit',i<Math.min(3,model.combo)));$('streak').setAttribute('aria-label',`연속 수행 ${model.combo}개`);$('shield-status').classList.toggle('active',!!model.shield);$('shield-status').setAttribute('aria-label',model.shield?'바람막 있음':'바람막 없음');
  if(model.currentMission){const remaining=model.currentStep.d-model.distance;$('cue-progress').style.width=Math.max(0,Math.min(100,remaining/model.currentMission.cueDistance*100))+'%';$('cue').classList.toggle('soon',remaining<11);$('cue-speaker').classList.toggle('speaking',!!voiceBank?.info.id);}
}
function frame(now){
  const dt=Math.min((now-lastFrame)/1000,.05);lastFrame=now;
  if(running&&!paused&&!model.finished){
    if(demo)driveDemo(model);model.step(dt);
    for(const n of model.drain()){
      world.effect(n.type,model);effectAudio(n.type);followPace(n);
      if(n.type==='instruction')showInstruction(n.mission);
      if(n.type==='stepResult')refreshInstruction();
      if(n.type==='correct'){recordAction(n.mission,true);$('cue').hidden=true;feedback('✓','부탁 수행');}
      if(n.type==='wrong'){recordAction(n.mission,false);$('cue').hidden=true;feedback('×','부탁 미수행');}
      if(n.type==='earnedShield')feedback('♧','바람막 획득');
      if(n.type==='hit')feedback('♡','장애물에 닿음');
      if(n.type==='shield')feedback('♧','바람막이 충돌을 막음');
      if(n.type==='near'){$('combo').hidden=false;nearUntil=now+650;}
      if(n.type==='finish')finish();
    }
    hudClock+=dt;if(hudClock>.065&&!model.finished){updateHUD();hudClock=0;}
    if(sound){musicClock+=dt;if(musicClock>.4){musicClock=0;const tune=[392,0,523,587,0,659,587,523,392,0,330,392,523,0,587,0];const f=tune[musicStep++%tune.length];if(f)note(f,.3,'sine',.075);}}
  }
  if(now>toastUntil)$('toast').hidden=true;if(now>nearUntil)$('combo').hidden=true;if(now>feedbackUntil)$('feedback').hidden=true;
  if(ending&&now>=resultRevealAt&&!shopUI?.visible){ending=false;showModal('result');$('restart').focus();$('review').scrollTop=0;}
  if(world)world.render(shopUI?.visible||model?.finished?dt:paused?0:dt,model,{running:shopUI?.visible?false:running,paused,shopPreview:!!shopUI?.visible});requestAnimationFrame(frame);
}
async function init(){
  try{
    await document.fonts.ready;world=await createWorld($('world'),{quality,reduced:prefersReduced});world.setCosmetics(shopStore.snapshot().equipped);
    shopUI=createShopUI({store:shopStore,world,announce,onStateChange:()=>journeyUI?.refresh(),onOpen:()=>{shopReturn=running?model.finished?'result':'pause':'intro';if(running&&!model.finished)pause();else cancelVoice();closeModal();$('intro').hidden=true;$('hud').hidden=true;},onClose:()=>{$('intro').hidden=running;$('hud').hidden=!running;if(shopReturn==='result')showModal('result');if(shopReturn==='pause')showModal('pause-panel');}});
    journeyUI=createJourneyUI({store:shopStore,onOpenShop:itemId=>shopUI.open(itemId)});journeyUI.refresh();
    ready=true;$('loading').hidden=true;for(const id of ['start','demo','practice','shop-button'])$(id).disabled=false;$('start').querySelector('span').textContent='바람길 달리기';
  }catch(e){console.error(e);$('loading-text').textContent='3D 화면을 열 수 없어요. Chrome·Edge의 하드웨어 가속을 확인해 주세요.';}
}
const listeningCheck=mountListeningCheck({coach,beforeOpen:()=>{if(running&&!model?.finished)return false;cancelVoice();closeModal();return true;},onClose:()=>{if(running&&model?.finished)showModal('result');}});
init();requestAnimationFrame(frame);
$('learning-reset').hidden=hosted;if(hosted)document.querySelector('#settings-panel .learning-note')?.replaceChildren('학습 기록은 WORLD 계정에 이어져요. 기록 공유와 삭제는 WORLD 계정 설정에서 관리해요.');
$('learning-reset').addEventListener('click',()=>{try{coach?.reset();for(const m of model?.missions||[])m.presentationId=null;practicePresentation=null;learningFailed=!coach;nextPlan=null;}catch(error){if(error?.code!=='ACCOUNT_RESET_REQUIRED')learningFailed=true;}refreshRecommendation();});
refreshRecommendation();
window.synkRunner={get info(){return{version:6,ready,running,paused,demo,mode,learning:'listen',best,sound,shop:shopStore.snapshot(),shopPreview:shopUI?.info,journey:journeyUI?.info(),voiceClips:voiceBank?.info.clips||0,audio:voiceBank?.info||null,world:world?.info,model:model?{distance:model.distance,elapsed:model.elapsed,lane:model.lane,x:model.x,y:model.y,slide:model.slide,hearts:model.hearts,shield:model.shield,combo:model.combo,lanterns:model.lanterns,coins:model.coins,correct:model.correct,answers:model.answers,finished:model.finished,reason:model.reason,current:model.currentMission?{id:model.currentMission.id,text:model.currentMission.text,steps:model.currentMission.steps.map(s=>({action:s.action,target:s.target,remaining:s.d-model.distance,resolved:s.resolved,status:s.status}))}:null}:null};}};
