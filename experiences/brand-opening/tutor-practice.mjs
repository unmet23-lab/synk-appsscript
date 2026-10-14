import {PracticeRun,PRACTICES,BEAT_AT,BEAT_PERIOD,BEAT_WINDOW,beatPosition,inputForKey,savePractice} from './tutor-practice-core.mjs';
import {practiceLine} from './tutor-practice-lines.mjs';
import {tutorFace} from './game-tutor-lines.mjs';
import {verdict,getPref} from './world-sound.mjs';

const asset=path=>new URL(path,import.meta.url).href;
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const buttons={runner:[['left','←','왼쪽'],['jump','↑','점프'],['slide','↓','숙이기'],['right','→','오른쪽']],rhythm:[['left','O','F · ←'],['right','X','J · →']],hangul:[['a','아',''],['eo','어','']],first:[['hello','안녕하세요',''],['thanks','감사합니다','']]};
const pad2=n=>String(n).padStart(2,'0');
export function createTutorPractice({tutor,game,container,reduced=()=>false,getSound=()=>false,owner='guest',replay=false,focusSteps=null,timed=false,onComplete=()=>{},onCancel=()=>{}}){
 const run=new PracticeRun(game,{steps:focusSteps,timed}),plan={...PRACTICES[game],steps:run.steps},timers=new Set(),held=new Set(),pointers=new Map();
 let disposed=false,voice=null,reactionVoice=null,generation=0,raf=0,gesture=null,pausedDemo=false,launching=false;
 const still=()=>reduced()||matchMedia('(prefers-reduced-motion:reduce)').matches;
 const dialog=document.createElement('dialog');dialog.className='tutor-practice';dialog.dataset.tutor=tutor.id;dialog.dataset.practiceGame=game;
 dialog.setAttribute('aria-label',`${tutor.name}과 ${plan.title} 조작 연습`);dialog.tabIndex=-1;
 const portrait=()=>`<span class="game-tutor-portrait" data-character="${tutor.id}"><img class="game-tutor-body" src="${asset('assets/tutors/'+tutor.images.기본)}" width="480" height="480" alt="${tutor.name}"><img class="game-tutor-face" src="${asset('assets/tutors/'+tutor.images.기본)}" width="480" height="480" alt="" aria-hidden="true"></span>`;
 dialog.innerHTML=`<header class="practice-header"><div><small>${tutor.name}과 · ${escape(plan.title)}</small><h3>${escape(plan.title)} 조작 연습</h3></div><button type="button" class="practice-exit" aria-label="연습을 닫고 놀이로 돌아가기">×</button></header><div class="practice-progress" aria-label="연습 진행"><span class="practice-count"></span><div class="practice-stops">${plan.steps.map((s,i)=>`<span data-stop="${i}" aria-label="${escape(s.title)}">${i+1}</span>`).join('')}</div></div><div class="practice-speech">${portrait()}<div><small class="practice-phase"></small><p class="practice-line" role="status" aria-live="polite"></p></div></div><div class="practice-work"><div class="practice-stage" tabindex="-1"><div class="practice-road" aria-hidden="true"><i></i><i></i><i></i></div><div class="practice-performer">${portrait()}</div><div class="practice-beat" aria-hidden="true"><span class="practice-note">O</span><span class="practice-hit-line"></span></div><p class="practice-example"></p><span class="practice-pose-label" aria-hidden="true"></span></div><div class="practice-controls" role="group" aria-label="직접 해 보는 조작 단추"></div><p class="practice-key-hint"></p></div><footer class="practice-footer"><button type="button" class="practice-primary">시범 보기</button><button type="button" class="practice-replay">시범 다시 보기</button></footer>`;
 container.append(dialog);
 const $=selector=>dialog.querySelector(selector);
 const later=(fn,ms)=>{const id=setTimeout(()=>{timers.delete(id);if(!disposed&&!document.hidden)fn();},ms);timers.add(id);};
 function stopAudio(){voice?.pause();voice=null;reactionVoice?.pause();reactionVoice=null;}
 function clear(){generation++;timers.forEach(clearTimeout);timers.clear();cancelAnimationFrame(raf);raf=0;stopAudio();held.clear();pointers.clear();gesture=null;}
 function face(emotion){const file=tutor.images[emotion]||tutor.images.기본;dialog.querySelectorAll('.game-tutor-face').forEach(img=>img.src=asset('assets/tutors/'+file));dialog.dataset.face=emotion;}
 // 판정 하나: 소리 + 진동 + (「친구들의 반응」이 켜져 있을 때만) 튜터 얼굴 한 번. 꺼져 있으면 시범 얼굴 그대로 둔다.
 function judged(correct){dialog.dataset.reactions=String(getPref('reactions'));verdict(correct,{react:ok=>face(tutorFace(tutor.id,ok?'success':'retry'))});}
 function speak(kind){$('.practice-line').textContent=practiceLine(tutor.id,kind);}
 function pose(action=''){
  $('.practice-performer').dataset.pose=action;
  $('.practice-pose-label').textContent=({left:'왼쪽 한 칸',right:'오른쪽 한 칸',middle:'가운데',stay:'그대로',jump:'점프',slide:'숙이기',a:'아',hello:'안녕하세요',next:'다음'})[action]||'';
  dialog.querySelectorAll('[data-practice-input]').forEach(b=>{b.classList.toggle('demo-press',b.dataset.practiceInput===action);});
 }
 function reactionSound(){
  if(!getSound()||voice||document.hidden)return;
  reactionVoice?.pause();const pool=tutor.sounds.기쁨;if(!pool?.length)return;
  const clip=new Audio(asset('assets/tutors/'+pool[0]));reactionVoice=clip;clip.volume=.22;clip.play().catch(()=>{});
 }
 function buildStep(){
  const s=run.step;dialog.dataset.step=s.id;
  const next=s.id==='next';
  $('.practice-controls').innerHTML=(next?[['next','다음','']]:buttons[game]).map(([action,key,label])=>`<button type="button" class="practice-pad" data-practice-input="${action}" aria-label="${escape(label?key+' '+label:key)}"><b>${escape(key)}</b>${label?`<small>${escape(label)}</small>`:''}</button>`).join('');
  $('.practice-example').textContent=game==='rhythm'&&s.timed?(s.action==='left'?'왼쪽으로 가라는 말인가요?':'오른쪽으로 가라는 말인가요?'):game==='first'&&!next?'친구를 만났어요. 어떤 인사를 할까요?':game==='hangul'&&!next?'소리를 듣고, 글자를 골라요.':'';
  $('.practice-key-hint').textContent=game==='runner'?'키보드 ← → 이동 · ↑ 또는 Space 점프 · ↓ 숙이기. 화면을 밀어도 돼요.':game==='rhythm'?'키보드 F 또는 ← · J 또는 →':'';
  $('.practice-stage').dataset.scene=next?'next':game;
  dialog.dataset.timed=String(!!s.timed);
  $('.practice-note').textContent=game==='runner'?({jump:'↑',slide:'↓',left:'←',right:'→',middle:'→'})[s.id]||'↑':s.action==='right'?'X':'O';
  pose();face(tutor.id==='marin'?'집중':'기본');
 }
 function render(){
  dialog.dataset.phase=run.phase;dialog.dataset.reduced=String(still());
  // 지시 한 줄: 「01 / 05」 숫자 + 이번 동작(크게)
  $('.practice-count').innerHTML=run.complete?`<span class="practice-count-n">${pad2(plan.steps.length)} / ${pad2(plan.steps.length)}</span><b>연습을 모두 마쳤어요</b>`:`<span class="practice-count-n">${pad2(run.index+1)} / ${pad2(plan.steps.length)}</span><b>${escape(run.step.title)}</b>`;
  for(const dot of dialog.querySelectorAll('[data-stop]')){const i=Number(dot.dataset.stop);dot.classList.toggle('passed',!!run.passed[i]);dot.classList.toggle('current',i===run.index);}
  $('.practice-phase').textContent=({demo:'시범',try:'내 차례',success:'해냈어요',complete:'연습 끝'})[run.phase];
  $('.practice-header h3').textContent=run.complete?(run.fullIntro?'연습 끝':'다시 해냈어요'):(run.fullIntro?`${plan.title} 조작 연습`:'어려운 동작 연습');
  dialog.querySelectorAll('[data-practice-input]').forEach(b=>b.disabled=run.phase!=='try');
  const primary=$('.practice-primary');primary.hidden=run.phase==='try'||run.phase==='demo'&&!pausedDemo;
  primary.disabled=launching;primary.textContent=run.complete?(!run.fullIntro?'놀이로 돌아가기':replay?'놀이로 이어가기':`${plan.title} 시작하기`):run.phase==='success'?'다음으로 넘어가기':'시범 다시 보기';
  $('.practice-replay').hidden=run.complete||pausedDemo;
 }
 function startBeat(){
  const tick=now=>{
   if(disposed||document.hidden||run.phase!=='try')return;
   if(run.step.quiet){const result=run.wait(now);if(result.correct){success('stay');return;}$('.practice-pose-label').textContent=`손을 떼고 ${Math.ceil(Math.max(0,run.step.quiet-(now-run.cycleStart))/1000)}초 기다려요`;raf=requestAnimationFrame(tick);return;}
   if(run.step.hold){$('.practice-pose-label').textContent=run.holding===null?'끝까지 누르고 있어요':now-run.holding>=run.step.hold?'이제 손을 놓아도 돼요':'계속 누르고 있어요';raf=requestAnimationFrame(tick);return;}
   if(!run.step.timed)return;
   const position=beatPosition(now,run.cycleStart);
   $('.practice-note').style.setProperty('--beat-y',String(position));
   const atLine=Math.abs(position*BEAT_PERIOD-BEAT_AT)<=BEAT_WINDOW;
   dialog.dataset.onBeat=String(atLine);$('.practice-pose-label').textContent=atLine?'지금 눌러요!':'선에 닿을 때';
   raf=requestAnimationFrame(tick);
  };raf=requestAnimationFrame(tick);
 }
 function instructionKind(){return game==='hangul'&&run.step.audio?'hangul':run.step.id;}
 function yourTurn(heard=false){
  if(disposed||!run.tryIt(performance.now(),{heard}))return;
  pausedDemo=false;pose(run.step.startPose||'');speak(instructionKind());if(run.step.timed&&game==='runner')$('.practice-line').textContent+=' '+practiceLine(tutor.id,'marker');render();
  if(run.step.timed||run.step.quiet||run.step.hold)startBeat();
  if(!document.hidden)dialog.focus({preventScroll:true});
 }
 function demonstrateBeat(){
  const start=performance.now();
  const tick=now=>{
   if(disposed||document.hidden||run.phase!=='demo')return;
   const position=still()?BEAT_AT/BEAT_PERIOD:Math.min(BEAT_AT,now-start)/BEAT_PERIOD;
   $('.practice-note').style.setProperty('--beat-y',String(position));
   if(still()||now-start>=BEAT_AT){pose(run.step.pose||run.step.action);face(tutorFace(tutor.id,'success'));later(()=>{face(tutor.id==='marin'?'집중':'기본');yourTurn(true);},900);return;}
   raf=requestAnimationFrame(tick);
  };raf=requestAnimationFrame(tick);
 }
 async function sampleUrl(){
  if(run.step.audio==='runner')return asset('../korean-runner/assets/voice/left.mp3');
  // Reuse a control instruction rather than revealing a scored rhythm question.
  if(run.step.audio==='rhythm')return asset('../korean-runner/assets/voice/left.mp3');
  if(run.step.audio==='hangul'){
   const response=await fetch(asset('../hangul-stage/assets/voice/voices.json'));if(!response.ok)throw Error('VOICE_UNAVAILABLE');
   const manifest=await response.json(),file=manifest.approved===true&&manifest.clips?.['아'];
   if(typeof file!=='string'||!/^[a-z0-9-]+\.mp3$/i.test(file))throw Error('VOICE_UNAVAILABLE');
   return asset('../hangul-stage/assets/voice/'+file);
  }
 }
 function audioError(revision){if(disposed||revision!==generation)return;clear();pausedDemo=true;face(tutorFace(tutor.id,'retry'));speak('audioError');render();}
 async function demonstrate(){
  if(disposed||document.hidden||!run.demonstrate())return;
  clear();pausedDemo=false;pose();face(tutor.id==='marin'?'집중':'기본');speak('demo');render();
  const revision=generation;
  if(!run.step.audio){pose(run.step.startPose||'');if(run.step.timed){demonstrateBeat();return;}later(()=>pose(run.step.pose||run.step.action),350);later(()=>yourTurn(),run.step.quiet||run.step.hold?2400:still()?1300:1700);return;}
  speak('waiting');
  later(()=>audioError(revision),15000);
  try{
   const url=await sampleUrl();if(disposed||revision!==generation||document.hidden)return;
   const clip=new Audio(url);voice=clip;clip.volume=.8;
   clip.onended=()=>{
    if(disposed||revision!==generation||document.hidden)return;
    voice=null;timers.forEach(clearTimeout);timers.clear();
    speak(instructionKind());
    if(run.step.timed)demonstrateBeat();else{pose(run.step.pose||run.step.action);later(()=>yourTurn(true),900);}
   };
   clip.onerror=()=>audioError(revision);
   await clip.play();
  }catch{audioError(revision);}
 }
 function success(action){cancelAnimationFrame(raf);raf=0;dialog.dataset.feedback='success';pose(run.step.pose||action);judged(true);speak('success');if(getPref('reactions'))reactionSound();render();$('.practice-primary').focus({preventScroll:true});}
 function feedback(result,action){if(!result.accepted)return;
  if(result.holding){pose(action);return;}
  if(!result.correct){judged(false);speak(result.reason==='timing'?'timing':'retry');dialog.dataset.feedback='retry';pose(action);return;}
  success(action);
 }
 const input=action=>feedback(run.input(action,performance.now()),action);
 const release=action=>feedback(run.release(action,performance.now()),action);
 function advance(){
  if(run.complete){
   if(launching)return;launching=true;clear();
   let storage;try{storage=localStorage;}catch{}
   const saved=savePractice(storage,owner,tutor.id,run);onComplete({saved,game});return;
  }
  if(run.phase==='demo'&&pausedDemo){void demonstrate();return;}
  if(!run.next())return;
  clear();delete dialog.dataset.feedback;
  if(run.complete){face(tutorFace(tutor.id,'finish'));speak('finish');render();return;}
  buildStep();void demonstrate();
 }
 const cancel=event=>{event?.preventDefault();event?.stopPropagation();onCancel();};
 const click=event=>{
  const button=event.target.closest('button');if(!button||button.disabled)return;
  if(button.matches('.practice-primary'))advance();
  else if(button.matches('.practice-replay')){delete dialog.dataset.feedback;void demonstrate();}
  else if(button.matches('.practice-exit'))cancel(event);
  else if(button.dataset.practiceInput&&event.detail===0)input(button.dataset.practiceInput);
 };
 const keydown=event=>{
  if(event.altKey||event.ctrlKey||event.metaKey||event.repeat)return;
  const action=inputForKey(game,event.code);if(!action)return;
  event.preventDefault();if(held.has(event.code))return;held.add(event.code);input(action);
 };
 const keyup=event=>{const action=inputForKey(game,event.code);held.delete(event.code);if(action&&![...held].some(code=>inputForKey(game,code)===action))release(action);};
 const pointerdown=event=>{
  const button=event.target.closest('[data-practice-input]');
  if(button){event.preventDefault();if(!button.disabled){pointers.set(event.pointerId,button.dataset.practiceInput);try{button.setPointerCapture(event.pointerId);}catch{}input(button.dataset.practiceInput);}return;}
  if(game==='runner'&&run.phase==='try'&&event.target.closest('.practice-stage')){gesture={id:event.pointerId,x:event.clientX,y:event.clientY};try{$('.practice-stage').setPointerCapture(event.pointerId);}catch{}}
 };
 const pointerup=event=>{
  if(pointers.has(event.pointerId)){const action=pointers.get(event.pointerId);pointers.delete(event.pointerId);if(![...pointers.values()].includes(action))release(action);}
  if(!gesture||gesture.id!==event.pointerId)return;const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;gesture=null;
  if(Math.max(Math.abs(dx),Math.abs(dy))<22)return;input(Math.abs(dx)>Math.abs(dy)?(dx<0?'left':'right'):dy<0?'jump':'slide');
 };
 const losePointer=event=>{gesture=null;if(pointers.has(event.pointerId)){const action=pointers.get(event.pointerId);pointers.delete(event.pointerId);release(action);}};
 const visibility=()=>{
  if(document.hidden){clear();if(run.phase==='demo'||run.phase==='try'){run.demonstrate();pausedDemo=true;speak('demo');render();}}
 };
 dialog.addEventListener('click',click);dialog.addEventListener('pointerdown',pointerdown);dialog.addEventListener('pointerup',pointerup);dialog.addEventListener('pointercancel',losePointer);dialog.addEventListener('lostpointercapture',losePointer);
 dialog.addEventListener('keydown',keydown);dialog.addEventListener('keyup',keyup);dialog.addEventListener('cancel',cancel);
 document.addEventListener('visibilitychange',visibility);
 buildStep();dialog.showModal();dialog.focus({preventScroll:true});
 if(run.step.audio){pausedDemo=true;speak(instructionKind());render();$('.practice-primary').textContent='시범 듣기';}
 else void demonstrate();
 return {element:dialog,metrics:()=>({game,index:run.index,step:run.step.id,steps:run.steps.map(s=>s.id),targeted:!run.fullIntro,holding:run.holding!==null,phase:run.phase,passed:[...run.passed],heard:run.heard,complete:run.complete,voicePlaying:voice?.paused===false,cycleStart:run.cycleStart,cueInMs:run.step.timed?BEAT_AT-beatPosition(performance.now(),run.cycleStart)*BEAT_PERIOD:null}),dispose(){
  if(disposed)return;disposed=true;clear();document.removeEventListener('visibilitychange',visibility);if(dialog.open)dialog.close();dialog.remove();
 }};
}
