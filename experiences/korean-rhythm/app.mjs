import {TRACKS,LEVELS,RoundState} from './core.mjs?v=20261002-flow';
import {MusicPlayer} from './audio.mjs?v=20261001-listen';
import {Stage} from './stage.mjs?v=20261001-listen';
import {rhythmItem,RHYTHM_CANDIDATES,FLOW_RHYTHM,timingObservation,timingSummary} from './personalization.mjs';
// Atlas moment-level challenge: the timing windows follow this person inside the chosen level.
const TIMING_KEY='synk.korean-rhythm.timing-mode';let live=null,timingStart=null;
const timingAuto=()=>{try{return localStorage.getItem(TIMING_KEY)!=='fixed';}catch{return true;}};
function startTiming(){live=null;timingStart=null;if(!coach||!learningAvailable||typeof coach.live!=='function')return;try{live=coach.live(FLOW_RHYTHM,{declared:timingAuto()?{}:{mode:'fixed'}});timingStart=live.settings().values.window;state.round.scaleTiming(timingStart);}catch{live=null;}}
function followTiming(event){if(!live||!state.round)return;const observation=timingObservation(event);if(!observation)return;try{const out=live.observe(observation);if(out.change)state.round.scaleTiming(out.settings.values.window);}catch{live=null;}}
const $=id=>document.getElementById(id);
let coach=null,learningAvailable=true;
try{coach=globalThis.SynkLearning?.createGame({gameId:'korean-rhythm',storage:localStorage})||null;}catch{learningAvailable=false;}
function learn(action,fallback=null){try{return coach?action(coach):fallback;}catch{learningAvailable=false;return fallback;}}
function renderRecommendation(select=false){
  const recommendation=learn(c=>c.recommend(RHYTHM_CANDIDATES,{audioAvailable:true}));
  const candidate=recommendation?.selected;
  $('recommended-track').disabled=!candidate;$('recommended-track').textContent=candidate?`${candidate.label} 선택 →`:'기본 곡에서 선택해 주세요';
  $('recommendation-reason').textContent=recommendation?.reason||'맞춤 추천을 연결하지 못했어요. 원하는 곡은 계속 플레이할 수 있어요.';
  const summary=learn(c=>c.summary());
  $('learning-scope').textContent=!coach||!learningAvailable?'맞춤 기록 연결 불가':summary?.storage.available?'이 브라우저의 공통 학습 기록 · 학생 계정 연결 전':'저장이 제한되어 이번 페이지에서만 기록해요.';
  if(candidate&&select)selectTrack(candidate.trackId);
  return candidate;
}
const state={track:0,level:'easy',screen:'lobby',round:null,pressed:new Set(),paused:false,loading:false,offset:0,activeQuestion:null,recallIndex:0};
let collectionRoundId=null;
const music=new MusicPlayer({onDelivery:(q,status)=>{if(q.presentationId)learn(c=>c.delivery(q.presentationId,status));}}),stage=new Stage($('stage'));
let raf=0,lastFrame=0,lastUi=0,toastTimer=0,startGeneration=0;
const clock=s=>`${String(Math.floor(Math.max(0,s)/60)).padStart(2,'0')}:${String(Math.floor(Math.max(0,s)%60)).padStart(2,'0')}`;
const qualityWord=q=>q>=1?'PERFECT':q>=.8?'GREAT':q>0?'GOOD':'';
const lanes=[...$('lane-controls').querySelectorAll('button')];

function renderTracks(){
  $('track-grid').replaceChildren();
  for(const track of TRACKS){const b=document.createElement('button');b.className='track';b.dataset.track=track.id;b.setAttribute('aria-pressed',String(state.track===track.id));b.setAttribute('aria-label',`${track.title}, ${track.tag}, ${track.bpm.toFixed(1)} BPM`);b.innerHTML=`<img class="track-cover" src="assets/signal-stage.webp" alt=""><span class="track-description"><span class="track-number mono">TRACK 0${track.id+1} · SYNK</span><strong class="track-title">${track.title}</strong><span class="track-info mono">${track.bpm.toFixed(1)} BPM · ${clock(track.duration)} · 2 KEYS</span><span class="track-type">${track.tag}</span></span><span class="track-selected" aria-hidden="true"></span>`;b.addEventListener('click',()=>{state.track=track.id;for(const x of $('track-grid').children)x.setAttribute('aria-pressed',String(Number(x.dataset.track)===state.track));});$('track-grid').append(b);}
}
function selectTrack(id){state.track=id;for(const x of $('track-grid').children)x.setAttribute('aria-pressed',String(Number(x.dataset.track)===id));}
function screen(name){for(const s of ['lobby','game','results'])$(s).hidden=s!==name;state.screen=name;document.body.classList.toggle('playing',name==='game');if(name!=='game')window.scrollTo({top:0,behavior:'instant'});if(name==='game')stage.resize();}
function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,3600);}
function syncEffects(){stage.reduced=$('effects-setting').checked;$('reduce-button').setAttribute('aria-pressed',String(stage.reduced));$('reduce-button').textContent=stage.reduced?'효과 줄임':'효과 줄이기';stage.resize();}
function resetQuestion(){state.activeQuestion=null;$('phrase-card').hidden=true;$('phrase-card').classList.remove('answered');$('lane-controls').classList.remove('choosing');for(let i=0;i<2;i++){lanes[i].disabled=false;lanes[i].classList.remove('intent');$('answer-'+i).textContent='';lanes[i].setAttribute('aria-label',`${i===0?'왼쪽 F':'오른쪽 J'} 레인`);}}
async function start(){
  if(state.loading)return;state.loading=true;const generation=++startGeneration;$('loading').hidden=false;$('start-button').disabled=true;
  try{
    if(!window.AudioContext)throw new Error('이 브라우저는 음악 재생을 지원하지 않아요. 최신 Chrome 또는 Edge에서 열어주세요.');
    const track=TRACKS[state.track];state.round=new RoundState(track,state.level,crypto.getRandomValues(new Uint32Array(1))[0]);
    const buffer=await music.prepare(track,state.round.questions);if(generation!==startGeneration)return;
    collectionRoundId=globalThis.SynkPlayCollection?.roundId('rhythm')||null;
    state.pressed.clear();state.paused=false;stage.particles=[];stage.flashes=[0,0];resetQuestion();
    startTiming();
    $('game').dataset.track=track.id;$('game-title').textContent=track.title;$('game-track-number').textContent=`TRACK 0${track.id+1} / ${LEVELS[state.level].label}`;
    $('pause-overlay').hidden=true;$('countdown').hidden=false;$('score').textContent='000000';$('combo').textContent='0';$('accuracy').textContent='—';$('learning-count').textContent='듣기 0 / 5';$('mode-label').textContent='리듬을 타요';$('mode-cue').hidden=false;
    for(const l of lanes)l.classList.remove('active','intent');screen('game');syncEffects();music.start(buffer,state.round.beat);lastFrame=performance.now();lastUi=0;cancelAnimationFrame(raf);raf=requestAnimationFrame(frame);$('pause-button').focus({preventScroll:true});
  }catch(error){music.stop();screen('lobby');toast(error.message||'곡을 준비하지 못했어요. 다시 시작해 주세요.');}
  finally{state.loading=false;$('loading').hidden=true;$('start-button').disabled=false;}
}
function showQuestion(q){
  if(state.activeQuestion===q)return;state.activeQuestion=q;
  if(!q){resetQuestion();$('mode-label').textContent='리듬을 타요';return;}
  if(!q.presentationId)q.presentationId=learn(c=>c.present(rhythmItem(state.track,q)));
  $('phrase-card').hidden=false;$('phrase-card').classList.remove('answered');$('phrase-category').textContent=`듣기 ${state.round.questions.indexOf(q)+1} / 5`;$('phrase-text').textContent='';$('phrase-question').textContent='귀 기울여 들어요';$('phrase-instruction').textContent='맞으면 O, 아니면 X';$('lane-controls').classList.add('choosing');$('mode-label').textContent='듣는 중';
  q.options.forEach((option,i)=>{$('answer-'+i).textContent=option;lanes[i].classList.remove('intent');lanes[i].setAttribute('aria-label',`${i===0?'F, O, 맞아요':'J, X, 아니에요'}`);});
}
function questionPhase(q,t){if(!q)return;const ready=t>=q.answerOpen,answered=q.state!=='pending';$('phrase-card').dataset.phase=answered?'answered':t<q.voiceEnd?'listening':ready?'answer':'think';for(const b of lanes)b.disabled=!ready||answered;
 if(answered)return;
 $('phrase-question').textContent=t<q.voiceEnd?'귀 기울여 들어요':ready?'박자에 맞춰 O / X':'맞는 내용일까요?';
 $('phrase-instruction').textContent=ready?'노트가 선에 닿으면 한 번 눌러요':'맞으면 왼쪽 O · 아니면 오른쪽 X';
 $('mode-label').textContent=t<q.voiceEnd?'듣는 중':ready?'O / X':'생각하는 중';
}
function judgment(word,quality=1){if(!word)return;const el=$('judgment');el.textContent=word;el.style.color=quality===1?'#fff0c4':quality>=.8?'#c5d6f5':'#ffb8af';el.classList.remove('visible');void el.offsetWidth;el.classList.add('visible');}
function eventEffect(event){
  if(!event)return;
  followTiming(event);
  if(event.type==='listening')return;
  if(event.type==='intent'){lanes.forEach((b,i)=>b.classList.toggle('intent',i===event.lane));$('phrase-instruction').textContent='선택했어요. 선에 닿을 때 같은 칸을 쳐요.';return;}
  if(event.quality>0){stage.hit(event.lane,event.quality);music.hit(event.lane);judgment(qualityWord(event.quality),event.quality);}
  if(event.q){const q=event.q;if(!q.presentationId)q.presentationId=learn(c=>c.present(rhythmItem(state.track,q)));if(q.presentationId&&!q.evidenceSaved){q.evidenceSaved=true;q.learning=learn(c=>c.answer(q.presentationId,{correct:q.response===null?null:event.correct,assessable:q.response!==null,reason:q.response===null?'unanswered':undefined}));}$('phrase-card').classList.add('answered');$('phrase-question').textContent=q.response===null?'다음에 다시 들어봐요':event.correct?'잘 들었어요':'다시 들어봐요';$('phrase-instruction').textContent=`정답 ${q.answer} · 해설은 곡이 끝나면 확인해요`;$('learning-count').textContent=`듣기 ${state.round.correctCount} / 5`;if(q.presentationId)learn(c=>c.help(q.presentationId,'answer'));}
}
function input(lane){if(state.screen!=='game'||state.paused||state.loading||state.pressed.has(lane))return;state.pressed.add(lane);lanes[lane].classList.add('active');if(music.time<-.15)return;const e=state.round.input(lane,music.time-state.offset/1000);eventEffect(e);}
function release(lane){state.pressed.delete(lane);lanes[lane].classList.remove('active');if(state.round&&state.screen==='game'&&!state.paused)eventEffect(state.round.release(lane,music.time-state.offset/1000));}
function frame(now){
  if(state.screen!=='game')return;const dt=Math.min(.04,(now-lastFrame)/1000);lastFrame=now;const t=music.time;
  if(!state.paused){
    const updates=state.round.update(t-state.offset/1000,state.pressed);for(const e of updates)eventEffect(e);
    const q=state.round.activeQuestion(t);showQuestion(q);questionPhase(q,t);
    if(t<0){$('countdown').hidden=false;const n=Math.ceil(-t/state.round.beat);$('countdown-number').textContent=n>0?String(Math.min(4,n)):'GO';}
    else $('countdown').hidden=true;
    if(now-lastUi>60){lastUi=now;$('score').textContent=String(state.round.score).padStart(6,'0');$('combo').textContent=state.round.combo;$('accuracy').textContent=state.round.processed?`${(state.round.accuracy*100).toFixed(1)}%`:'—';$('game-clock').textContent=`${clock(t)} / ${clock(state.round.duration)}`;$('song-progress-fill').style.width=`${Math.min(100,Math.max(0,t/state.round.duration*100))}%`;$('combo-panel').style.opacity=q?'.35':'1';}
    if(t>state.round.duration+.8){finish();return;}
  }
  stage.draw(state.round,t,state.pressed,state.paused?0:dt);raf=requestAnimationFrame(frame);
}
async function pause(){if(state.screen!=='game'||state.paused)return;state.paused=true;for(const lane of [...state.pressed])release(lane);state.pressed.clear();await music.pause();$('pause-overlay').hidden=false;$('resume-button').focus({preventScroll:true});}
async function resume(){if(!state.paused)return;try{await music.resume();if(music.state!=='running')throw new Error();state.paused=false;$('pause-overlay').hidden=true;lastFrame=performance.now();$('pause-button').focus({preventScroll:true});}catch{toast('소리를 다시 켜지 못했어요. 이어서 연주를 다시 눌러주세요.');}}
function leave(){startGeneration++;music.stop();cancelAnimationFrame(raf);state.pressed.clear();state.paused=false;screen('lobby');renderRecommendation();$('start-button').focus({preventScroll:true});}
function finish(){
  for(const event of state.round.update(state.round.duration+3,new Set()))eventEffect(event);music.stop();cancelAnimationFrame(raf);state.pressed.clear();state.paused=false;screen('results');
  const r=state.round;$('result-accuracy').textContent=`${(r.earned/r.possible*100).toFixed(1)}%`;$('result-combo').textContent=r.maxCombo;$('result-learning').textContent=`${r.correctCount} / ${r.questions.length}`;$('result-subtitle').textContent=`${r.track.title} · ${LEVELS[r.levelName].label}`;$('result-track').textContent=`TRACK 0${r.track.id+1}`;
  $('review-list').replaceChildren();for(const q of r.questions){const correct=q.response!==null&&q.options[q.response]===q.answer;const el=document.createElement('div');el.className='review-item'+(correct?'':' revisit');const mark=document.createElement('span');mark.className='review-status';mark.textContent=correct?'✓':'↻';const text=document.createElement('div'),title=document.createElement('strong'),description=document.createElement('p');title.textContent=q.prompt+' '+q.question;description.textContent=`${correct?'이해했어요.':q.response===null?'선택하지 않았어요.':`선택: ${q.options[q.response]}.`} ${q.explanation}`;text.append(title,description);el.append(mark,text);$('review-list').append(el);}
  const timingEnd=live?(()=>{try{return live.end().settings.values.window;}catch{return null;}})():null;live=null;
  $('result-timing').textContent=timingEnd===null?'':timingAuto()?timingSummary(timingStart,timingEnd):'정해진 판정 폭으로 연주했어요.';
  const independent=r.questions.filter(q=>q.learning?.independent).length;$('result-learning-note').textContent=`도움·반복을 제외한 새 응답 ${independent}개를 맞춤 추천에 참고해요. 읽기 능력은 이 곡으로 판단하지 않아요.`;
  $('result-collection-reward').textContent='공통 차고에 완주를 모으고 있어요.';
  globalThis.SynkPlayCollection?.award({game:'rhythm',total:r.questions.length,correct:r.correctCount,completed:true,automatic:false,roundId:collectionRoundId}).then(result=>{
    if(state.round===r)$('result-collection-reward').textContent=globalThis.SynkPlayCollection.rewardText(result);
  });
  renderRecommendation();state.recallIndex=0;$('recall-content').hidden=true;$('recall-intro').hidden=false;$('recall-button').hidden=false;$('recall-button').textContent='다른 문장 듣기 ↗';$('result-title').setAttribute('tabindex','-1');$('result-title').focus({preventScroll:true});
}
async function recall(){
  const questions=state.round.questions;if(state.recallIndex>=questions.length){$('recall-feedback').textContent='다른 문장도 확인했어요. 다음 곡에서 다시 만나요.';$('recall-button').hidden=true;return;}
  const source=questions[state.recallIndex],q=source.recall;
  if(source.recallPresentationId)learn(c=>c.help(source.recallPresentationId,'replay'));
  else source.recallPresentationId=learn(c=>c.present(rhythmItem(state.track,source,{recall:true})));
  const presentationId=source.recallPresentationId;
  $('recall-content').hidden=false;$('recall-intro').hidden=true;$('recall-sentence').textContent='';$('recall-question').textContent='먼저 들어요';$('recall-feedback').textContent='';$('recall-button').hidden=true;$('recall-options').replaceChildren();
  const generation=startGeneration;
  for(const option of ['O','X']){const b=document.createElement('button');b.textContent=option;b.disabled=true;b.addEventListener('click',()=>{for(const button of $('recall-options').children)button.disabled=true;if(presentationId)source.recallLearning=learn(c=>c.answer(presentationId,{correct:option===q.answer,assessable:true}));b.classList.add('chosen');$('recall-sentence').textContent=q.prompt;$('recall-question').textContent=q.question;$('recall-feedback').textContent=option===q.answer?'잘 들었어요.':`이 문장의 답은 ${q.answer}예요.`;if(presentationId)learn(c=>c.help(presentationId,'answer'));state.recallIndex++;renderRecommendation();$('recall-button').textContent=state.recallIndex<questions.length?'다음 문장 듣기 ↗':'확인 마치기 ✓';$('recall-button').hidden=false;});$('recall-options').append(b);}
  try{await music.review(q.voice);if(generation!==startGeneration||state.screen!=='results')return;if(presentationId)learn(c=>c.delivery(presentationId,{audio:'completed'}));$('recall-question').textContent='맞으면 O, 아니면 X';for(const b of $('recall-options').children)b.disabled=false;}
  catch{if(presentationId)learn(c=>c.delivery(presentationId,{audio:'failed'}));if(state.screen==='results'){$('recall-question').textContent='소리를 다시 불러와 주세요';$('recall-button').textContent='다시 듣기 ↗';$('recall-button').hidden=false;}}
}

$('start-button').addEventListener('click',start);$('replay-button').addEventListener('click',start);$('pause-button').addEventListener('click',pause);$('resume-button').addEventListener('click',resume);$('leave-button').addEventListener('click',leave);$('back-button').addEventListener('click',leave);$('recall-button').addEventListener('click',recall);
$('difficulty').addEventListener('click',e=>{const b=e.target.closest('[data-level]');if(!b)return;state.level=b.dataset.level;for(const x of $('difficulty').children)x.setAttribute('aria-pressed',String(x===b));});
for(const name of ['help','settings'])$(name+'-button').addEventListener('click',()=>$(name+'-dialog').showModal());
for(const b of document.querySelectorAll('[data-close]'))b.addEventListener('click',()=>$(b.dataset.close).close());
$('sound-setting').addEventListener('change',()=>music.setSound($('sound-setting').checked));
$('timing-setting').checked=timingAuto();$('timing-setting').addEventListener('change',()=>{try{localStorage.setItem(TIMING_KEY,$('timing-setting').checked?'auto':'fixed');}catch{/* this page only */}});$('effects-setting').checked=matchMedia('(prefers-reduced-motion: reduce)').matches;$('effects-setting').addEventListener('change',syncEffects);$('reduce-button').addEventListener('click',()=>{$('effects-setting').checked=!stage.reduced;syncEffects();});$('offset-setting').addEventListener('input',()=>{state.offset=Number($('offset-setting').value);$('offset-value').textContent=`${state.offset>0?'+':''}${state.offset} ms`;});
const pointers=new Map();
for(const b of lanes){const lane=Number(b.dataset.lane);b.addEventListener('pointerdown',e=>{e.preventDefault();pointers.set(e.pointerId,lane);b.setPointerCapture(e.pointerId);input(lane);});b.addEventListener('pointerup',e=>{if(pointers.has(e.pointerId)){pointers.delete(e.pointerId);release(lane);}});b.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);release(lane);});b.addEventListener('lostpointercapture',e=>{if(pointers.has(e.pointerId)){pointers.delete(e.pointerId);release(lane);}});b.addEventListener('click',e=>{if(e.detail===0){input(lane);setTimeout(()=>release(lane),120);}});}
const keyLanes={KeyF:0,KeyJ:1,ArrowLeft:0,ArrowRight:1};
document.addEventListener('keydown',e=>{if(state.screen!=='game')return;if(e.code==='Escape'||e.code==='Space'){e.preventDefault();if(e.repeat)return;state.paused?resume():pause();return;}if(Object.hasOwn(keyLanes,e.code)){e.preventDefault();if(!e.repeat)input(keyLanes[e.code]);}});
document.addEventListener('keyup',e=>{if(Object.hasOwn(keyLanes,e.code)){if(state.screen==='game')e.preventDefault();release(keyLanes[e.code]);}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('blur',()=>pause());
$('recommended-track').addEventListener('click',()=>{const candidate=renderRecommendation();if(candidate){selectTrack(candidate.trackId);$('start-button').focus();}});
$('reset-learning').addEventListener('click',()=>{
  let message='학습 기록을 지우지 못했어요. 다시 시도해 주세요.';
  try{
    const result=coach?.reset();
    learningAvailable=result?.storage?.available===true;
    if(learningAvailable)message='이 기기의 공통 맞춤 학습 기록을 지웠어요.';
  }catch(error){
    if(error?.code==='ACCOUNT_RESET_REQUIRED')message='계정의 학습 기록은 SYNK WORLD에서 관리해 주세요.';
    else learningAvailable=false;
  }
  renderRecommendation();toast(message);
});
renderTracks();renderRecommendation(true);
// Read-only diagnostics for QA. Input remains through real keyboard/pointer events.
window.synkRhythm={snapshot:()=>({timing:state.round?.timing??null,screen:state.screen,paused:state.paused,loading:state.loading,time:music.time,audioState:music.state,recording:music.recording,signalLevel:music.signalLevel,voiceLevel:music.voiceLevel,activeVoice:music.activeVoice,scheduledVoices:music.scheduledVoices,score:state.round?.score,combo:state.round?.combo,correct:state.round?.correctCount,processed:state.round?.processed,notes:state.round?.notes.map(n=>({time:n.time,lane:n.lane,duration:n.duration,state:n.state})),questions:state.round?.questions.map(q=>({time:q.time,showTime:q.showTime,voiceEnd:q.voiceEnd,answerOpen:q.answerOpen,voice:q.voice,state:q.state,response:q.response,options:q.options,answer:q.answer,prompt:q.prompt})),duration:state.round?.duration,level:state.level,track:state.track}),audio:()=>music.context};
