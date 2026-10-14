import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createCoastDrive} from '../coast-drive.js';
import {createCoastRadio} from '../coast-radio.js';
import {CAMPAIGN,CHAPTERS,campaignUnlocked,recommendedStage,medalFor} from '../campaign.js';
import {FINALES,finaleUnlocked} from '../finales.js';
import {makeQuestions,emptyProgress,loadProgress,recordRound,PROGRESS_KEY,STAGES,WORD_BY_ID,answerFeedback} from '../learning.js';
import {loadGarage,awardRace,SHOP_ITEMS} from '../garage.js';
import {awardAccountRace} from '../../play-common/racing-command.mjs';
import {resolveContact,shieldContact,comboShield} from '../driving.js';
import {BASE_CRUISE,racingFollowUp,racingRecheck,linkRacingRecheck} from '../personalization.js';
import {createQuestionPace,gatePosition,QUESTION_LEAD,rewardBoost,COMBO_BOOST_SECONDS} from '../race-pacing.js';

// Execute production app functions, rather than restating their transitions in a
// test. The file uses unindented top-level declarations/closing braces. Device,
// DOM and rendering boundaries are fakes; progress/awards/contacts/radio are real.
// This cannot verify the rendered interface, audible music or browser policy.
const appSource=readFileSync(new URL('../app.js',import.meta.url),'utf8');
function appFunction(name){
  const marker=`function ${name}(`,start=appSource.indexOf(marker);
  assert.notEqual(start,-1,`Missing app function: ${name}`);
  const lineEnd=appSource.indexOf('\n',start),line=appSource.slice(start,lineEnd).trimEnd();
  const end=line.endsWith('}')?lineEnd:appSource.indexOf('\n}',lineEnd)+2;
  assert(end>start,`Missing app function boundary: ${name}`);
  return (appSource.slice(Math.max(0,start-6),start)==='async '?'async ':'')+appSource.slice(start,end);
}
const productionFunctions=['syncCoastRadio','silence','finish','resultSummary','nextStage','showCruiseResults','returnToCruise',
  'pause','resume','updateContacts','updateCoastDrive','toggleSound','updateSoundButton','setText'];
// Screen drawing lives in hud.js/results.js/screens.js; a catch-all no-op stands in for the race HUD here.
const noopHud=()=>new Proxy({},{get:(target,key)=>target[key]??(()=>{})});
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('account reward latency keeps completion driving responsive and displays only confirmed coins',async()=>{
  const x=setup();let resolve,commands=0;
  x.ctx.SynkPlayAccount={status:()=>({mode:'account'}),wallet(){commands++;return new Promise(r=>{resolve=r;});}};
  x.ctx.renderCollection=()=>{};
  x.run('finish');x.run('finish');assert.equal(commands,1);assert.equal(x.counts.record,1);assert.equal(x.counts.garage,0);assert.equal(x.counts.progress,0);
  assert.equal(x.$('cruise-banner').hidden,false);assert.match(x.ctx.lastResults.coinText,/저장하는 중/);
  const confirmed=awardRace(loadGarage({getItem:()=>null}),x.ctx.selectedStage,x.ctx.answers,{roundId:'confirmed'});
  x.storage.set(PROGRESS_KEY,JSON.stringify({...x.ctx.progress,rounds:3}));resolve(confirmed);await flush();
  assert.match(x.ctx.lastResults.coinText,/공통 코인 \+/);assert.equal(x.ctx.garage.coins,confirmed.coins);assert.equal(x.counts.record,1);
  assert.equal(x.ctx.progress.rounds,3,'ACK restores the host current progress');
});

test('a delayed account ACK cannot replace the next round progress or wallet UI',async()=>{
  const x=setup();let resolve;
  x.ctx.SynkPlayAccount={status:()=>({mode:'account'}),wallet:()=>new Promise(r=>{resolve=r;})};
  x.run('finish');x.ctx.roundId='next-round';x.ctx.finished=false;
  const nextProgress={...x.ctx.progress,rounds:2};x.ctx.progress=nextProgress;
  resolve(awardRace(loadGarage({getItem:()=>null}),x.ctx.selectedStage,x.ctx.answers,{roundId:'confirmed'}));await flush();
  assert.equal(x.ctx.progress,nextProgress);assert.equal(x.ctx.garage.coins,0);assert.equal(x.counts.progress,0);
});

test('preserved permanent rejection restores confirmed progress and ends the pending reward message',async()=>{
  const x=setup();x.ctx.renderCollection=()=>{};
  x.ctx.SynkPlayAccount={status:()=>({mode:'account'}),wallet:()=>Promise.reject(Object.assign(Error('INVALID_PLAY_COMMAND'),{rejected:true}))};
  x.run('finish');await flush();
  assert.equal(x.ctx.progress.rounds,0);assert.match(x.ctx.lastResults.coinText,/지급되지 않았/);assert.doesNotMatch(x.ctx.lastResults.coinText,/저장하는 중/);
  assert.equal(x.counts.progress,0);assert.equal(x.$('next-stage').hidden,true);
});

test('retry restores the same confirmed round from the host without issuing another award',async()=>{
  const x=setup();let listener,commands=0,removed=0;x.ctx.renderCollection=()=>{};
  x.ctx.SynkPlayAccount={status:()=>({mode:'account'}),wallet(){commands++;return Promise.reject(Error('NETWORK'));},subscribe(fn){listener=fn;fn();return()=>{removed++;};}};
  x.run('finish');await flush();assert.match(x.ctx.lastResults.coinText,/저장하는 중/);
  const confirmed=awardRace(loadGarage({getItem:()=>null}),x.ctx.selectedStage,x.ctx.answers,{roundId:x.ctx.roundId});
  x.ctx.loadGarageSafe=()=>confirmed.state;x.storage.set(PROGRESS_KEY,JSON.stringify({...x.ctx.progress,rounds:4}));listener();
  assert.equal(commands,1);assert.equal(removed,1);assert.equal(x.ctx.progress.rounds,4);
  assert.equal(x.ctx.lastResults.coinText,'공통 코인 +50 · 보유 50');assert.equal(x.counts.progress,0);
});

test('a retry receipt cannot replace the following round and its watcher detaches',async()=>{
  const x=setup();let listener,removed=0;
  x.ctx.SynkPlayAccount={status:()=>({mode:'account'}),wallet:()=>Promise.reject(Error('NETWORK')),subscribe(fn){listener=fn;fn();return()=>{removed++;};}};
  x.run('finish');await flush();x.ctx.roundId='following-round';const current=x.ctx.progress;listener();
  assert.equal(removed,1);assert.equal(x.ctx.progress,current);assert.equal(x.ctx.garage.coins,0);
});

for(const account of [false,true])test(`personalized replacement rewards and records the actual five questions in ${account?'account':'guest'} mode`,async()=>{
  const x=setup({score:4}),initial=CAMPAIGN[0].items;
  x.ctx.selectedStage={...CAMPAIGN[0],id:'personalized',personalized:true,review:true,items:initial};
  x.ctx.questionBank=makeQuestions(x.ctx.selectedStage,()=>.3);
  x.ctx.questionBank[1]={...CAMPAIGN[1].items[0]};
  x.ctx.answers=x.ctx.questionBank.map((q,i)=>({id:q.id,answer:q.answer,correct:i!==0}));
  const actual=x.ctx.questionBank.map(q=>q.id);let result,descriptor;
  if(account){
    x.ctx.renderCollection=()=>{};
    x.ctx.SynkPlayAccount={status:()=>({mode:'account'}),wallet(method,args){
      assert.equal(method,'awardRace');descriptor=args[0];
      result=awardAccountRace(loadGarage({getItem:()=>null}),{},args,Date.now());
      if(result.records)x.storage.set(PROGRESS_KEY,result.records[PROGRESS_KEY]);
      return Promise.resolve(result);
    }};
  }
  x.run('finish');await flush();
  if(account){assert.deepEqual(Array.from(descriptor.questionIds),actual);assert.equal(result.reason,null);}
  assert.equal(x.ctx.garage.coins,23);assert.equal(x.ctx.progress.rounds,1);
  assert.deepEqual(Object.keys(x.ctx.progress.challenges).sort(),[...actual].sort());
  assert.equal(Object.values(x.ctx.progress.challenges).reduce((n,p)=>n+p.seen,0),5);
  assert.equal(x.ctx.garage.firstClears.personalized,undefined);
  assert.equal(x.ctx.lastResults.coinText,'공통 코인 +23 · 보유 23');
  assert.doesNotMatch(x.ctx.lastResults.plain.join(' '),/모두 받았/);
  assert.equal(x.ctx.selectedStage.items,initial,'original recommendation remains unchanged');
  assert.equal(x.counts.progress,account?0:1);
});

test('authored course descriptors retain the canonical list after question reordering',()=>{
  const x=setup();let descriptor;
  x.ctx.questionBank.reverse();
  x.ctx.SynkPlayAccount={status:()=>({mode:'account'}),wallet(method,args){descriptor=args[0];return new Promise(()=>{});}};
  x.run('finish');
  assert.deepEqual(Array.from(descriptor.questionIds),CAMPAIGN[0].items.map(q=>q.id));
  assert.notDeepEqual(Array.from(descriptor.questionIds),x.ctx.questionBank.map(q=>q.id));
});

function setup({score=5,demo=false,cruise=26}={}){
  const nodes=new Map(),storage=new Map(),counts={award:0,record:0,garage:0,progress:0,contacts:0,ensureAudio:0,cancel:0};
  function node(){
    const classes=new Set();
    return {hidden:true,disabled:false,textContent:'',firstChild:{textContent:''},style:{},children:[],
      classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle(x,value){if(value)classes.add(x);else classes.delete(x);}},
      replaceChildren(...items){this.children=items;},append(...items){this.children.push(...items);},appendChild(item){this.children.push(item);return item;},
      setAttribute(){},addEventListener(){},scrollIntoView(){},focus(){this.focused=true;},blur(){this.focused=false;},
      showModal(){this.open=true;},close(){this.open=false;}};
  }
  const $=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);};
  const localStorage={getItem:key=>storage.get(key)||null,setItem(key,value){storage.set(key,value);if(key===PROGRESS_KEY)counts.progress++;}};
  const media={paused:true,currentTime:0,preload:'',src:'',load(){},play(){this.paused=false;return Promise.resolve();},pause(){this.paused=true;},addEventListener(){},removeEventListener(){},removeAttribute(k){this[k]='';}};
  const gain=()=>({gain:{value:0,setTargetAtTime(v){this.value=v;},setValueAtTime(v){this.value=v;},cancelAndHoldAtTime(){}},connect(){},disconnect(){}});
  const audio={state:'running',currentTime:1,destination:{},createGain:gain,createMediaElementSource:()=>({connect(){},disconnect(){}})};
  const coastRadio=createCoastRadio({getContext:()=>audio,createAudio:()=>media});
  const selectedStage=CAMPAIGN[0],questionBank=makeQuestions(selectedStage,()=>.3);
  const answers=questionBank.map((q,i)=>({id:q.id,prompt:q.prompt,answer:q.answer,chosen:i<score?q.answer:q.options.find(o=>o!==q.answer),correct:i<score}));
  const context=vm.createContext({
    $,document:{hidden:false,createElement:node},localStorage,progressStorage:localStorage,SynkPlayAccount:{status:()=>({mode:'guest'})},console,Math,Date,JSON,
    coastDrive:createCoastDrive(),coastRadio,running:true,paused:false,finished:false,ready:true,
    tutorial:null,tutorialVoicePending:false,roundWasDemo:demo,auto:demo,inputs:{left:true,right:false},
    playerS:1376,playerOffset:0,velocity:42*cruise/BASE_CRUISE,cruise,BASE_CRUISE,ROAD_END:2250,
    boost:3.4,correct:score,answers,questionBank,selectedStage,progress:emptyProgress(),
    garage:loadGarage(localStorage),roundId:'integration-round-1',PROGRESS_KEY,SHOP_ITEMS,
    collisions:2,combo:score,bestCombo:score,shield:0,shieldBlocked:0,shieldFlash:0,contactTimer:0,
    rivals:[{s:1400,offset:-3.15,speed:26,mesh:{userData:{wheels:[]}}},{s:1420,offset:3.1,speed:25,mesh:{userData:{wheels:[]}}}],
    stage:node(),screenEl:node(),car:{rotation:{z:0},userData:{jets:[{visible:false,scale:{y:0}}]}},wheels:[],camera:{position:{copy(){}}},
    mobile:false,reducedMotion:false,gate:null,toastTime:2,laterToast:null,flowStart:null,
    soundEnabled:true,soundTouched:false,audio,motor:{frequency:{setTargetAtTime(){}}},motorGain:gain(),windGain:gain(),
    clock:{getDelta:()=>.016},narrator:{playing:false,activeKind:null,queue:[],cancel(){counts.cancel++;this.playing=false;this.activeKind=null;this.queue=[];coastRadio.setState({duck:false});}},
    CAMPAIGN,STAGES,ALL_COURSES:CHAPTERS.flatMap(ch=>[...CAMPAIGN.filter(s=>s.chapter===ch.id),...FINALES.filter(s=>s.chapter===ch.id)]),
    medalFor,recommendedStage,nextPersonalized:()=>null,labelStage:s=>s.title,
    resolveContact,shieldContact,clamp:(x,min,max)=>Math.max(min,Math.min(max,x)),lerp:(a,b,t)=>a+(b-a)*t,
    placeCar(){},roadPoint:()=>({}),setQuestionExpanded(){},disposeGate(){context.gate=null;},
    endLive:()=>null,renderLobby(){},wishText:()=>'',learningScope:()=>'',describeRace:()=>[],
    hud:noopHud(),subtitlesOn:false,renderQuestion(){},syncSoundToggles(){},WORD_BY_ID,
    showScreen(id){for(const name of ['lobby','game','results','garage'])$(name).hidden=name!==id;},
    showRace(){context.showScreen('game');},openDialog(d){d.showModal();},closeDialog(d){d.close();},
    renderResults(summary){context.lastResults=summary;},
    loadGarageSafe:()=>loadGarage(localStorage),
    storeGarage(state){counts.garage++;context.garage=state;},
    awardRace(...args){counts.award++;return awardRace(...args);},
    loadProgress,recordRound(...args){counts.record++;return recordRound(...args);},
    isUnlocked:s=>s.finale?finaleUnlocked(context.progress,s):campaignUnlocked(context.progress,s),
    ensureAudio:async()=>{counts.ensureAudio++;await coastRadio.unlock();},
    contactSound(){counts.contacts++;},contactSparks(){},showToast(){},speak(){},
    displayQuestion(){},narrateQuestion(){},repeatTutorial(){},tutorialDelivered(){},renderTutorial(){},learn(){},
  });
  for(const name of productionFunctions)vm.runInContext(appFunction(name),context,{filename:`app.js:${name}`});
  $('results').hidden=true;$('pause-dialog').open=false;
  return {ctx:context,$,counts,storage,media,run:name=>vm.runInContext(`${name}()`,context)};
}

// Render gate meshes and deliver speech at controlled boundaries, but execute
// production movement, judging, reading fallback, choice and completion code.
function setupRace({cruise=26,reading=false,muted=false}={}){
  const x=setup({score:0,cruise}),c=x.ctx;
  Object.assign(c,{
    elapsed:10,answers:[],correct:0,combo:0,bestCombo:0,boost:0,collisions:0,gateIndex:0,
    playerS:gatePosition(0)+.1,playerOffset:0,velocity:cruise,questionChosen:true,questionExpanded:false,
    inputs:{left:false,right:false},laneAim:null,aimOffset:0,narrationUnavailable:false,soundEnabled:!muted,
    questionPace:createQuestionPace(),gatePosition,QUESTION_LEAD,rewardBoost,COMBO_BOOST_SECONDS,comboShield,WORD_BY_ID,
    LANES:[-3.45,0,3.45],car:{position:{y:0},rotation:{z:0},userData:{jets:[{visible:false,scale:{y:0}}]}},
    // Isolate pacing from incidental traffic; these still pass through the real
    // traffic/contact routines throughout the simulated route.
    rivals:[{s:-1000,offset:-3.45,speed:26,mesh:{userData:{wheels:[]}}},{s:-1100,offset:3.45,speed:25,mesh:{userData:{wheels:[]}}}],
    mascotMood(){},ding(){},presentGate:q=>`presentation-${q.id}`,answerFeedback,racingFollowUp,racingRecheck,linkRacingRecheck,
    answerGate:()=>({independent:true}),racePressure:()=>0,
    setQuestionExpanded(value){c.questionExpanded=value;},
    narrateQuestion(){
      vm.runInContext('displayQuestion()',c);
      if(c.gate.q.mode!=='reading'&&c.soundEnabled){c.narrator.playing=true;c.narrator.activeKind='question';c.narrator.queue=[];}
    },
    speak(ids,text,kind){if(c.soundEnabled){c.narrator.playing=true;c.narrator.activeKind=kind;c.coastRadio.setState({duck:true});}},
    makeGate(index,s){
      const q=c.questionBank[index];
      c.gate={s,q,types:[...q.options],judged:false,announced:false};c.questionChosen=false;c.questionExpanded=false;
    }
  });
  if(reading){c.selectedStage=CAMPAIGN[2];c.questionBank=makeQuestions(c.selectedStage,()=>.3);}
  for(const name of ['chooseCurrentLane','questionReady','displayQuestion','judgeGate','continueFeedback','updateGame'])
    vm.runInContext(appFunction(name),c,{filename:`app.js:${name}`});
  c.makeGate(0,gatePosition(0));c.gate.announced=true;c.questionChosen=true;
  c.playerOffset=c.LANES[c.gate.types.indexOf(c.gate.q.answer)];
  const step=(seconds,dt=1/60)=>{for(let i=0;i<Math.round(seconds/dt);i++)vm.runInContext(`updateGame(${dt})`,c);};
  return {...x,step};
}

test('wrong answer review waits without racing, timing pressure or a second score, then continues explicitly', () => {
  const x=setupRace(),c=x.ctx;
  const wrong=c.gate.types.find(id=>id!==c.gate.q.answer);
  c.playerOffset=c.LANES[c.gate.types.indexOf(wrong)];
  c.gate.intentChoice=wrong;
  let captured;
  c.answerGate=(_pid,response)=>{captured=response;return {verdict:'incorrect',independent:true,assisted:false};};
  c.gate.presentationId='p1';
  x.run('judgeGate');
  assert.equal(c.gate.reviewing,true);
  assert.equal(captured.choice.selectedId,wrong);assert.equal(captured.choice.correctId,c.gate.q.answer);
  const at=c.playerS,time=c.elapsed,boost=c.boost;
  x.step(30);
  assert.equal(c.playerS,at);assert.equal(c.elapsed,time);assert.equal(c.boost,boost);
  assert.equal(c.answers.length,1);assert.equal(x.$('feedback-continue').hidden,false);
  x.run('continueFeedback');assert.equal(c.gate.reviewing,false);
  x.step(.5);assert(c.playerS>at);assert.equal(c.answers.length,1);
});

test('a successful new check waits for acknowledgement without adding another remedial question',()=>{
  const x=setupRace(),c=x.ctx;
  c.gate.q={...c.gate.q,recheckSourceAttemptId:'prior-attempt'};
  c.gate.intentChoice=c.gate.q.answer;c.gate.presentationId='next-presentation';
  c.answerGate=()=>({eventId:'next-attempt',verdict:'correct',independent:true,assisted:false});
  const calls=[];
  c.learn=fn=>fn({recheck:(source,target)=>{calls.push([source,target]);return {status:'independent-correct',line:'다른 새 문항을 도움 없이 맞혔어요.'};},help(){},exposure(){throw Error('Must not queue after independent success');}});
  let feedback;c.hud.answerQuestion=value=>{feedback=value;};
  const before=c.questionBank.map(q=>q.id);
  x.run('judgeGate');
  assert.deepEqual(calls,[['prior-attempt','next-attempt']]);
  assert.equal(c.gate.reviewing,true);assert.equal(feedback.hold,null);
  assert.match(feedback.why,/도움 없이/);assert.deepEqual(c.questionBank.map(q=>q.id),before);
  assert.equal(c.answers[0].recheck.status,'independent-correct');
  const at=c.playerS;x.step(15);assert.equal(c.playerS,at);
  x.run('continueFeedback');assert.equal(c.gate.reviewing,false);assert.equal(c.answers.length,1);
});

test('production finish commits a race once and enters driving without opening its result dialog',async()=>{
  const x=setup();x.run('finish');await flush();
  assert.equal(x.ctx.coastDrive.snapshot().phase,'drive');assert.equal(x.ctx.running,true);assert.equal(x.$('results').hidden,true);
  assert.equal(x.$('cruise-banner').hidden,false);assert.equal(x.$('cruise-action').hidden,false);assert(x.ctx.screenEl.classList.contains('coasting'));
  assert.equal(x.counts.award,1);assert.equal(x.counts.record,1);assert.equal(x.counts.garage,1);assert.equal(x.counts.progress,1);
  assert.equal(x.ctx.progress.rounds,1);assert.equal(x.ctx.coastRadio.snapshot().playing,true);
  const saved=x.storage.get(PROGRESS_KEY),coins=x.ctx.garage.coins;
  for(let i=0;i<5;i++){
    x.run('finish');x.run('showCruiseResults');x.run('showCruiseResults');await flush();
    assert.equal(x.$('results').hidden,false);assert.equal(x.ctx.running,false);assert.equal(x.media.paused,true);
    x.run('returnToCruise');x.run('returnToCruise');await flush();
    assert.equal(x.$('results').hidden,true);assert.equal(x.ctx.running,true);assert.equal(x.ctx.coastRadio.snapshot().playing,true);
  }
  assert.equal(x.counts.award,1);assert.equal(x.counts.record,1);assert.equal(x.counts.progress,1);assert.equal(x.counts.garage,1);
  assert.equal(x.storage.get(PROGRESS_KEY),saved);assert.equal(x.ctx.garage.coins,coins);
});

test('production demo completion preserves progress and never saves coins across result visits',async()=>{
  const x=setup({demo:true});x.run('finish');await flush();x.run('showCruiseResults');x.run('returnToCruise');await flush();x.run('finish');
  assert.equal(x.ctx.progress.rounds,0);assert.equal(x.counts.progress,0);assert.equal(x.counts.garage,0);assert.equal(x.ctx.garage.coins,0);
  assert.equal(x.counts.award,1);assert.equal(x.counts.record,1);assert.equal(x.ctx.coastDrive.snapshot().phase,'drive');
});

test('production pause/resume, mute/unmute and hidden-tab synchronization control one stream',async()=>{
  const x=setup();x.run('finish');await flush();x.media.currentTime=23;
  x.run('pause');assert.equal(x.ctx.paused,true);assert.equal(x.$('pause-dialog').open,true);assert.equal(x.media.paused,true);
  assert.equal(x.media.currentTime,23);assert.equal(x.ctx.inputs.left,false);
  x.run('resume');await flush();assert.equal(x.ctx.paused,false);assert.equal(x.$('pause-dialog').open,false);assert.equal(x.ctx.coastRadio.snapshot().playing,true);
  await x.run('toggleSound');assert.equal(x.ctx.soundEnabled,false);assert.equal(x.media.paused,true);assert.equal(x.media.currentTime,23);
  await x.run('toggleSound');await flush();assert.equal(x.ctx.soundEnabled,true);assert.equal(x.ctx.coastRadio.snapshot().playing,true);
  x.ctx.document.hidden=true;x.run('syncCoastRadio');assert.equal(x.media.paused,true);assert.equal(x.media.currentTime,23);
  x.ctx.document.hidden=false;x.run('syncCoastRadio');await flush();assert.equal(x.ctx.coastRadio.snapshot().playing,true);
});

test('production driving contact still separates/slows cars without rewriting a completed race',async()=>{
  const x=setup();x.run('finish');await flush();const saved=x.storage.get(PROGRESS_KEY),coins=x.ctx.garage.coins;
  x.ctx.playerS=1500;x.ctx.playerOffset=0;x.ctx.rivals=[{s:1500,offset:0,speed:26,mesh:{userData:{wheels:[]}}}];
  const speed=x.ctx.velocity;vm.runInContext('updateCoastDrive(.05)',x.ctx);
  assert(x.ctx.velocity<speed);assert(x.ctx.playerOffset!==0||x.ctx.playerS!==1500+speed*.05,'physical separation still executes');
  assert.equal(x.counts.contacts,1);assert.equal(x.ctx.collisions,2);assert.equal(x.ctx.progress.rounds,1);
  assert.equal(x.storage.get(PROGRESS_KEY),saved);assert.equal(x.ctx.garage.coins,coins);assert.equal(x.counts.award,1);assert.equal(x.counts.record,1);
});

test('last wrong answers still lead to rest driving and unavailable next courses keep results reachable',async()=>{
  const x=setup({score:0});x.run('finish');await flush();assert.equal(x.ctx.coastDrive.driving,true);
  assert.equal(x.ctx.lastResults.correct,0);assert.equal(x.ctx.lastResults.total,5);assert.equal(x.ctx.lastResults.passed,false);
  assert.equal(x.$('next-stage').disabled,true);assert.equal(x.$('next-stage').hidden,true,'an unavailable next course is not shown as a grey button');
  x.run('showCruiseResults');assert.equal(x.$('results').hidden,false);assert.equal(x.$('return-cruise').focused,true);
  x.run('returnToCruise');await flush();assert.equal(x.ctx.running,true);assert.equal(x.counts.record,1);
});

test('rest driving retains the actual adaptive boost speed at both pace extremes',async()=>{
  for(const cruise of [20,32])for(const score of [0,5]){
    const x=setup({score,cruise});x.run('finish');await flush();x.ctx.rivals=[];
    const boosted=42*cruise/BASE_CRUISE;x.ctx.velocity=boosted;
    for(let i=0;i<120;i++)vm.runInContext('updateCoastDrive(1/60)',x.ctx);
    assert(Math.abs(x.ctx.velocity-boosted)<1e-8,`cruise=${cruise}, correct=${score}`);
    assert.equal(x.counts.record,1);assert.equal(x.ctx.coastDrive.driving,true);
  }
});

test('production finish ignores incomplete answers and tutorial completion',()=>{
  const x=setup();x.ctx.answers=x.ctx.answers.slice(0,4);x.run('finish');
  assert.equal(x.counts.award,0);assert.equal(x.counts.record,0);assert.equal(x.$('results').hidden,true);assert.equal(x.ctx.coastDrive.active,false);
  x.ctx.answers.push({});x.ctx.tutorial={};x.run('finish');assert.equal(x.counts.award,0);assert.equal(x.ctx.coastDrive.active,false);
});

test('a correct production gate leaves at least four seconds of accelerated driving before the next prompt at every adaptive pace',()=>{
  for(const cruise of [20,26,32]){
    const x=setupRace({cruise}),c=x.ctx;
    x.run('judgeGate');
    assert.equal(c.correct,1);assert.equal(c.boost,6);assert.equal(c.answers.length,1);
    const answeredAt=c.elapsed;
    x.step(4);
    assert.equal(c.gateIndex,1);assert.equal(c.gate.announced,false,`cruise ${cruise} must retain the reward run`);
    assert.equal(c.questionExpanded,false);assert(c.velocity>42*cruise/BASE_CRUISE*.99);
    assert(c.boost>1.99&&c.boost<2.01);
    for(let i=0;i<600&&!c.gate.announced;i++)x.step(1/60);
    assert.equal(c.gate.announced,true);assert(c.elapsed-answeredAt>=4);
    assert.equal(c.gate.s,gatePosition(1));assert.equal(c.answers.length,1);
    assert.equal(c.gate.readyAt,undefined,'announcing listening audio does not prematurely start the decision timer');
  }
});

test('production reading and muted fallback stops retain remaining boost for ten seconds and resume the saved approach speed',()=>{
  for(const variant of [{reading:true},{muted:true}]){
    const x=setupRace({...variant,cruise:32}),c=x.ctx;
    x.run('judgeGate');
    for(let i=0;i<900&&!c.questionExpanded;i++)x.step(1/60);
    assert.equal(c.questionExpanded,true);
    assert(c.boost>0,'the earned booster is still available when the next panel opens');
    const entrySpeed=c.velocity,remainingBoost=c.boost,readyAt=c.gate.readyAt;
    assert.equal(typeof readyAt,'number');
    x.step(10);
    assert.equal(c.boost,remainingBoost);assert(c.velocity<.0001);
    assert.equal(c.questionPace.snapshot().heldSpeed,entrySpeed);
    assert.equal(c.gate.readyAt,readyAt,'waiting does not rewrite actual question presentation time');
    assert.equal(x.$('nitro-label').textContent,'부스터 저장 중');
    x.run('chooseCurrentLane');x.step(1/60);
    assert.equal(c.questionExpanded,false);assert.equal(c.questionPace.snapshot().holding,false);
    assert(c.velocity>=entrySpeed,'resume restores momentum instead of accelerating from rest');
    assert(Math.abs(c.boost-(remainingBoost-1/60))<1e-8);
    assert.equal(c.answers.length,1,'stopping and selecting must not score the next gate early');
  }
});

test('production voice and repeated-listening waits preserve boost until audio finishes even after the player chooses',()=>{
  const x=setupRace(),c=x.ctx;
  c.playerS=c.gate.s-64;c.velocity=42;c.boost=3;c.questionChosen=false;
  c.narrator.playing=true;c.narrator.activeKind='question';
  x.step(10);
  assert.equal(c.boost,3);assert(c.velocity<.0001);assert.equal(c.gate.readyAt,undefined);
  x.run('chooseCurrentLane');x.step(1);
  assert.equal(c.boost,3);assert(c.velocity<.0001,'choosing cannot outrun unfinished question audio');
  c.narrator.playing=false;c.narrator.activeKind=null;x.run('questionReady');
  const readyAt=c.gate.readyAt;x.step(1/60);
  assert.equal(c.velocity,42);assert(Math.abs(c.boost-(3-1/60))<1e-8);
  assert.equal(c.questionPace.snapshot().holding,false);
  // A replay begins while close to the same gate. It can hold again, but cannot
  // shift the original readiness time used for personalized pressure.
  c.narrator.playing=true;c.narrator.activeKind='question';
  const repeatBoost=c.boost;x.step(10);
  assert.equal(c.boost,repeatBoost);assert.equal(c.answers.length,0);
  c.narrator.playing=false;c.narrator.activeKind=null;x.run('questionReady');x.step(1/60);
  assert.equal(c.gate.readyAt,readyAt);assert.equal(c.velocity,42);
});

test('the production last gate enters coast driving before the road end while its final explanation and ducked radio continue',async()=>{
  const x=setupRace({cruise:32}),c=x.ctx;
  c.answers=c.questionBank.slice(0,-1).map(q=>({id:q.id,prompt:q.prompt,answer:q.answer,chosen:q.answer,correct:true}));
  c.correct=4;c.combo=4;c.bestCombo=4;c.gateIndex=c.questionBank.length-1;
  c.makeGate(c.gateIndex,gatePosition(c.gateIndex));c.gate.announced=true;c.questionChosen=true;
  c.playerS=c.gate.s-.1;c.playerOffset=c.LANES[c.gate.types.indexOf(c.gate.q.answer)];
  c.velocity=42*c.cruise/BASE_CRUISE;
  for(let i=0;i<120&&!c.coastDrive.driving;i++)x.step(1/60);
  await flush();
  assert.equal(c.answers.length,5);assert.equal(c.correct,5);assert.equal(c.coastDrive.driving,true);
  assert(c.playerS>gatePosition(4)+15&&c.playerS<2150,'finish occurs before the coastal loop, well before the road end');
  assert.equal(c.narrator.playing,true);assert.equal(c.narrator.activeKind,'feedback');assert.equal(x.counts.cancel,0);
  assert.equal(c.coastRadio.snapshot().duck,true);assert.equal(c.coastRadio.snapshot().playing,true);
  assert.equal(c.coastRadio.snapshot().targetGain,.09);assert.equal(x.$('progress').style.width,'100%');
  assert.equal(x.$('results').hidden,true);assert.equal(x.counts.record,1);assert.equal(x.counts.award,1);
  for(let i=0;i<360;i++)vm.runInContext('updateCoastDrive(1/60)',c);
  assert(c.playerS<2150);assert.equal(c.coastDrive.snapshot().laps,1);
  assert.equal(c.narrator.playing,true);assert.equal(x.counts.record,1);assert.equal(x.counts.award,1);
});

test('↑ right after tapping an answer tag keeps the tapped lane; while steering it takes the lane the car is in',()=>{
  const x=setupRace(),c=x.ctx;
  const target=c.gate.types.indexOf(c.gate.q.answer),other=(target+1)%3;
  c.questionChosen=false;c.playerOffset=c.LANES[other];c.laneAim=c.LANES[target];c.inputs={left:false,right:false};
  x.run('chooseCurrentLane');
  assert.equal(c.gate.intentChoice,c.gate.q.answer,'the tag choice is not replaced by the lane the car has not left yet');
  assert.equal(c.laneAim,c.LANES[target]);assert.equal(c.questionChosen,true);
  c.inputs={left:true,right:false};c.playerOffset=c.LANES[other];
  x.run('chooseCurrentLane');
  assert.equal(c.gate.intentChoice,c.gate.types[other],'holding a direction chooses where the car is');
});
