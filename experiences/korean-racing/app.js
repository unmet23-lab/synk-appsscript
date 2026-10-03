import * as THREE from 'three';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { DRACOLoader } from './vendor/DRACOLoader.js';
import { WORDS, STAGES, WORD_BY_ID, PROGRESS_KEY, makeQuestions, loadProgress, recordRound, reviewStage } from './learning.js';
import { Narrator } from './narration.js';
import { LANE_AUDIO, questionNarration } from './question-audio.js';
import { CHAPTERS, CAMPAIGN, campaignUnlocked, recommendedStage, medalFor } from './campaign.js';
import { resolveContact, shieldContact, comboShield } from './driving.js';
import { racingItem, personalizedStage, FLOW_RACE, FLOW_WORDS, BASE_CRUISE, racePressure, describeRace } from './personalization.js';
import { FINALES, finaleUnlocked } from './finales.js';
import { VEHICLES, PAINTS, WHEELS, TRAILS, SHOP_ITEMS, loadGarage, saveGarage, dailyMission, awardRace } from './garage.js';
import { buildAlternativeCar, customizeCar, createGarageStage, refineOriginalCar } from './vehicles.js';
import { createGarageUI } from './garage-ui.js';
import { buildDriver, updateDriverPose } from './drivers.js';
import { createTutorial, loadTutorial, saveTutorialCompleted } from './tutorial.js';
import { automaticQuality, qualitySettings, slowerQuality, createPausedFrameGate } from './graphics.js';
import { buildSceneryDetails } from './scenery.js';
import { createLandscapeHeight, buildDistantCoast } from './landscape.js';
import { createAtmosphere } from './atmosphere.js';
import { buildCourseTerrain } from './render-world.js';
import { buildCoastalCity } from './cityscape.js';
import { buildCityLife } from './city-life.js';
import { createCoastalRocks } from './coastal-rocks.js';
import { createCoastalBoats } from './seascape-boats.js';
import { startAssetLoad, prepareFirstFrame } from './startup.js';

const $ = id => document.getElementById(id);
let coach=null,learningAvailable=true;
let requestedModality=new URLSearchParams(location.search).get('learning');
if(!['listening','reading'].includes(requestedModality))requestedModality=null;
try{coach=globalThis.SynkLearning?.createGame({gameId:'korean-racing',storage:localStorage})||null;}catch{learningAvailable=false;}
function learn(action,fallback=null){try{return coach?action(coach):fallback;}catch{learningAvailable=false;return fallback;}}
function learningScope(){const summary=learn(c=>c.summary());return !coach||!learningAvailable?'맞춤 기록을 연결하지 못했어요. 기본 코스는 계속 플레이할 수 있어요.':summary?.storage.available?(hosted?'WORLD 계정의 학습 기록 · 공유와 삭제는 WORLD 계정 설정에서 관리해요':'이 브라우저의 공통 학습 기록 · 학생 계정 연결 전'):'저장이 제한되어 이번 페이지에서만 맞춤 기록을 유지해요.';}
// 순간 맞춤: the speed the car cruises at and the level the personalized five draw from (FLOW_RACE).
// A live content per race; never in a demo or the tutorial. Losing it only stops the adapting.
let live=null,cruise=BASE_CRUISE,flowStart=null,laterToast=null;
function flowOf(){try{return coach&&learningAvailable&&typeof coach.live==='function'?coach.live(FLOW_RACE,{words:FLOW_WORDS}):null;}catch{return null;}}
function setCruise(value){cruise=value;for(const r of rivals)r.speed=(r.base??=r.speed)*cruise/BASE_CRUISE;}
function startLive(){live=roundWasDemo?null:flowOf();flowStart=null;try{flowStart=live?live.settings().values:null;}catch{live=null;}setCruise(flowStart?.cruise??BASE_CRUISE);try{return live?.intro().line?.text||null;}catch{return null;}}
function endLive(){let end=null;try{end=live?.end()||null;}catch{/* the speed memory is a convenience */}live=null;return end;}
function presentGate(q){const item=racingItem(q);if(live){try{return live.present(item);}catch{live=null;}}return learn(c=>c.present(item));}
// Trail gets the answer either way; with a live race the same answer also moves the speed and the level.
function answerGate(pid,response,flow){if(live){try{const out=live.answer(pid,response,flow);if(out.change?.knob==='cruise')setCruise(out.settings.values.cruise);if(out.line?.text)laterToast=out.line.text;return out.recorded;}catch{live=null;}}return learn(c=>c.answer(pid,response));}
function nextPersonalized(){return learn(c=>personalizedStage(c,{audioAvailable:!soundTouched||soundEnabled,modality:requestedModality,live:flowOf()}));}
const assignment=()=>learn(c=>c.assignment?.());
// A listening target has no questions to offer while the sound is off: say that, not that the target is missing.
function targetUnavailable(){const target=assignment();return target?.modality==='listening'&&soundTouched&&!soundEnabled?'이번 목표는 듣기 문항이에요. 소리를 켜면 바로 시작할 수 있어요.':'지정 문항을 준비하지 못했어요. WORLD에서 다시 열어 주세요.';}
// Inside SYNK WORLD the record is the account's: kept and deleted there, not in this browser.
const hosted=learn(c=>typeof c.assignment==='function',false);
if('scrollRestoration' in history)history.scrollRestoration='manual';
const stage = $('experience');
let mobile = matchMedia('(max-width: 650px)').matches;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ROAD_END = 2250, LANES = [-3.45, 0, 3.45];
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
let seed = 93127;
const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const hash = (x, z) => { const v = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123; return v - Math.floor(v); };
function noise(x, z) {
  const a = Math.floor(x), b = Math.floor(z), fx = x - a, fz = z - b;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return lerp(lerp(hash(a,b),hash(a+1,b),u),lerp(hash(a,b+1),hash(a+1,b+1),u),v);
}
function fbm(x,z) { return noise(x,z)*.55 + noise(x*2,z*2)*.28 + noise(x*4,z*4)*.12 + noise(x*8,z*8)*.05; }
const pathX = s => Math.sin(s / 235) * 25 + Math.sin(s / 580) * 31;
const pathY = s => 23 + Math.sin(s / 280) * 2.8 + Math.sin(s / 100) * 1.2;
const pathAngle = s => Math.atan(Math.cos(s / 235) * 25 / 235 + Math.cos(s / 580) * 31 / 580);
function roadPoint(s, offset = 0, y = 0) {
  return new THREE.Vector3(pathX(s) + Math.cos(pathAngle(s)) * offset, pathY(s) + y, s - Math.sin(pathAngle(s)) * offset);
}
const groundHeight=createLandscapeHeight(pathX,pathY);

let renderer, scene, camera, car, rivals = [], wheels = [], gate = null, gateIndex = 0;
const startup={phase:'idle',compilePasses:0};
let running = false, paused = false, ready = false, auto = false, finished = false;
let playerS = 75, playerOffset = 0, velocity = 26, elapsed = 0, boost = 0, answers = [], correct = 0;
let inputs = {left:false,right:false}, aimOffset = 0, laneAim = null, attractTime = 0, toastTime = 0;
let renderFrames = 0, renderTotal = 0, adaptiveTime = 0, frameSample = [], warmupFrames = 0;
const pausedFrameGate=createPausedFrameGate();
let renderedFrames=0,skippedPausedFrames=0;
let soundEnabled = false, soundTouched = false, audio = null, motor = null, motorGain = null, windGain = null;
const deviceGraphics={coarsePointer:matchMedia('(pointer: coarse)').matches,memoryGB:navigator.deviceMemory||8,cores:navigator.hardwareConcurrency||8};
// Authoring-only capture URL: render real extra pixels on a DPR1 desktop.
// It changes no answers, driving rules, saves or rewards.
const capture4k=new URLSearchParams(location.search).get('capture')==='4k';
let light, ambientLight, currentQuality = 'auto', mode = automaticQuality(deviceGraphics), renderQuality=qualitySettings(mode,{pixelRatio:devicePixelRatio});
let pineCanopyTexture, blossomCanopyTexture, surfaceTextures = {};
let driverName='marin', driverFeltTexture=null, driverMood='base', moodTime=0;
let worldTime = {value:0}, carTemplate, ocean, leaves, clouds;
let scenery={}, windRotors=[], contactTimer=0, collisions=0, combo=0, bestCombo=0, questionChosen=false,sparkLife=0;
let activeCollection='campaign';
const clock = new THREE.Clock();
const tempMatrix = new THREE.Matrix4(), tempQuat = new THREE.Quaternion(), tempScale = new THREE.Vector3();
const tempObj = new THREE.Object3D();
const sunDirection = new THREE.Vector3(92,93,56).normalize();
let selectedStage=CAMPAIGN[0], questionBank=makeQuestions(selectedStage), progress;
try {progress=loadProgress(localStorage);} catch {progress=loadProgress({getItem:()=>null});}
let stagePage=0, roundWasDemo=false, starting=false, narrationUnavailable=false, questionExpanded=false;
let tutorial=null,tutorialVoicePending=false,tutorialDismissed=false,tutorialSaved=true,tutorialBank=null,tutorialIdle=0,tutorialGoHint=false;
let tutorialCompleted=false;try{tutorialCompleted=loadTutorial(localStorage).completed;}catch{}
const TUTORIAL_CLIPS=['welcome','right','listen','choices','retry','correct','boost','finish','go'].map(id=>'tutorial-'+id);
const tutorialFruits=['사과','포도','바나나'].map(word=>WORDS.find(w=>w.word===word));
const ALL_COURSES=CHAPTERS.flatMap(ch=>[...CAMPAIGN.filter(s=>s.chapter===ch.id),...FINALES.filter(s=>s.chapter===ch.id)]);
const isUnlocked=s=>s.finale?finaleUnlocked(progress,s):campaignUnlocked(progress,s);
let garage=loadGarageSafe(),garageOpen=false,garageStudio=null,previewCar=null,garageAngle=.65,shield=0,shieldBlocked=0,shieldFlash=0,roundId='';
const raceCars=new Map(),previewCars=new Map();
const commonClips=['intro','cue-picture','cue-listen','correct','answer','boost','retry','finish','shield-ready','shield-block','garage-earned','garage-wish','mission-complete','finale-unlock',...LANE_AUDIO];
const narrator=new Narrator({getContext:()=>audio,onActive:active=>{
  if(audio&&motorGain)motorGain.gain.setTargetAtTime(active?.014:running&&!paused?.055:0,audio.currentTime,.12);
  $('question').classList.toggle('narrating',active);
  $('voice-status').textContent=active?'음성 안내 중':'음성 안내';
},onDelivery:({kind,presentationId,audio:status})=>{if(presentationId)learn(c=>c.delivery(presentationId,{audio:status}));if(status==='completed'&&gate?.presentationId===presentationId){gate.heard=true;questionReady();}if(kind==='tutorial')tutorialDelivered();},onUnavailable:()=>{narrationUnavailable=true;if(tutorial)renderTutorial();else{questionReady();displayQuestion();showToast('음성을 재생하지 못해 지문과 보기를 열었어요.',4);}}});
const labelStage=s=>s.number?`${String(s.number).padStart(3,'0')} · ${s.title}`:s.title;
const stageSize=s=>s.campaign?s.items.length:s.words.length;
const stageClips=s=>s.campaign?s.items.flatMap(q=>[...q.audio,...q.answerAudio,...q.options]):s.words;
const availableStages=()=>activeCollection==='campaign'?ALL_COURSES:STAGES;
function loadGarageSafe(){try{return loadGarage(localStorage);}catch{return loadGarage({getItem:()=>null});}}
function storeGarage(value){garage=value;let saved=false;try{saved=saveGarage(value,localStorage);}catch{}renderCollection();if(!saved)showToast('저장이 제한되어 이번 화면에서만 컬렉션을 유지해요.',4);return saved;}
function equipmentStyle(equipment){return {paint:PAINTS.find(p=>p.id===equipment.paint)?.color,wheelColor:WHEELS.find(p=>p.id===equipment.wheels)?.color,trailColor:TRAILS.find(p=>p.id===equipment.trail)?.color,badge:equipment.badge};}
function createVehicle(id){const vehicle=VEHICLES.find(v=>v.id===id)||VEHICLES[0];const mesh=vehicle.id==='coast'?prepareCar(carTemplate,vehicle.color):buildAlternativeCar(vehicle.id==='finale'?'finale':vehicle.kind,{color:vehicle.color});mesh.userData.vehicleKind=vehicle.id;seatMascot(mesh,driverName);return mesh;}
function applyEquipment(){
  if(!carTemplate)return;const id=garage.equipped.vehicle;if(car)car.visible=false;
  if(!raceCars.has(id)){const mesh=createVehicle(id);scene.add(mesh);raceCars.set(id,mesh);}
  car=raceCars.get(id);car.visible=!garageOpen;wheels=car.userData.wheels;customizeCar(car,equipmentStyle(garage.equipped));selectDriver(driverName);
  if(motor)motor.type=id==='open'||id==='finale'?'triangle':id==='rally'?'square':'sawtooth';
}
function previewEquipment(item=null){
  if(!ready)return;const equipment={...garage.equipped};if(item)equipment[item.kind]=item.value;
  const id=equipment.vehicle;if(!previewCars.has(id)){const mesh=createVehicle(id);mesh.removeFromParent();previewCars.set(id,mesh);}
  previewCar=previewCars.get(id);customizeCar(previewCar,equipmentStyle(equipment));garageStudio.place(previewCar);
  previewCar.userData.jets.forEach(j=>{j.visible=item?.kind==='trail';j.scale.y=1.1;});
  seatMascot(previewCar,driverName);
}
function openGarage(){
  if(!ready||starting)return;home();garage=loadGarageSafe();garageOpen=true;garageStudio.group.position.copy(roadPoint(75,0,.08));garageStudio.group.visible=true;$('garage-angle').value=String(Math.round(garageAngle*180/Math.PI));
  car.visible=false;rivals.forEach(r=>r.mesh.visible=false);if(gate?.group)gate.group.visible=false;
  $('nav-garage').setAttribute('aria-current','page');$('nav-race').removeAttribute('aria-current');garageUI.open();previewEquipment();stage.scrollIntoView({behavior:'instant',block:'start'});clock.getDelta();
}
function closeGarage(){
  garageOpen=false;if(garageStudio)garageStudio.group.visible=false;if(camera)camera.clearViewOffset();rivals.forEach(r=>r.mesh.visible=true);
  $('nav-race').setAttribute('aria-current','page');$('nav-garage').removeAttribute('aria-current');if(ready){applyEquipment();reset(false);}renderCollection();
}
function wishText(){const wish=VEHICLES.find(v=>v.id===garage.wish);return wish?`${wish.name}까지 ${Math.max(0,wish.price-garage.coins)}코인 남았어요`:'';}
function renderCollection(){
  $('coin-balance').textContent=garage.coins.toLocaleString('ko-KR');
  const mission=dailyMission(progress,Date.now(),garage),host=$('today-mission');host.replaceChildren();
  const copy=document.createElement('div'),kicker=document.createElement('span'),title=document.createElement('h3'),note=document.createElement('p'),button=document.createElement('button');kicker.className='eyebrow';kicker.textContent='ONE LITTLE QUEST';title.textContent=mission.title;note.textContent=mission.description;copy.append(kicker,title,note);button.textContent=mission.completed?'오늘의 미션 완료 ✓':`오늘의 미션 · +${mission.reward}코인 →`;button.disabled=mission.completed||!ready||starting;button.addEventListener('click',()=>playMission(mission));host.append(copy,button);
  $('records-stats').replaceChildren();for(const [value,label] of [[garage.totalEarned,'모은 코인'],[ALL_COURSES.filter(s=>progress.stages[s.id]?.cleared).length,'문장 코스 통과'],[FINALES.filter(s=>progress.stages[s.id]?.cleared).length,'챕터 결승 통과'],[garage.owned.filter(id=>SHOP_ITEMS.find(i=>i.id===id)?.price!==0).length,'모은 꾸미기']]){const cell=document.createElement('div'),n=document.createElement('strong'),text=document.createElement('span');n.textContent=value;text.textContent=label;cell.append(n,text);$('records-stats').append(cell);}
  const vehicle=VEHICLES.find(v=>v.id===garage.equipped.vehicle);$('records-equipment').textContent=`지금 함께 달리는 차 · ${vehicle?.name||'코스트 GT'}${garage.equipped.badge?' · 코스트 챔피언 배지':''}`;
}
function playMission(mission){
  if(!ready||starting||mission.completed)return;
  if(garageOpen)garageUI.close();
  let course;if(mission.kind==='first-clear')course=CAMPAIGN.find(s=>s.id===mission.target);
  else if(mission.collection==='campaign'){const source=ALL_COURSES.find(s=>s.items.some(q=>q.id===mission.target));if(source)course={...source,id:`mission-${mission.date}`,title:'오늘의 힌트 다시 만나기',finale:false,review:true,items:[source.items.find(q=>q.id===mission.target),...source.items.filter(q=>q.id!==mission.target)]};}
  else course=STAGES.find(s=>s.words.includes(mission.target));
  if(course){selectStage(course);start(false);}
}
const garageUI=createGarageUI({onPreview:previewEquipment,onEquip:()=>{applyEquipment();previewEquipment();},onClose:closeGarage,onMission:playMission,readProgress:()=>progress,readGarage:()=>{try{if(localStorage.getItem('SYNK_PLAY_COLLECTION_V1'))garage=loadGarage(localStorage);}catch{}return garage;},writeGarage:storeGarage});
document.addEventListener('input',e=>{if(e.target.id==='garage-angle')garageAngle=Number(e.target.value)*Math.PI/180;});
function speak(ids,text,kind='comment',interrupt=false,presentationId=null){if(soundEnabled)narrator.speak(ids,text,kind,{interrupt,presentationId});}
function setQuestionExpanded(open){
  questionExpanded=open;$('question-details').hidden=!open;
  if(open&&gate?.presentationId&&gate.q.mode!=='reading')learn(c=>c.help(gate.presentationId,'text'));
  $('question-toggle').setAttribute('aria-expanded',String(open));
  $('question-toggle').textContent=open?'접기 ↑':'지문·보기';
}
function chooseCurrentLane(){
  if(tutorial){chooseTutorialLane();return;}
  if(!running||paused||!gate?.announced||gate.judged)return;
  questionChosen=true;auto=false;$('demo-indicator').hidden=true;
  gate.intentChoice=gate.types[clamp(Math.round((playerOffset+3.45)/3.45),0,2)];gate.choseAt=elapsed;
  if(!inputs.left&&!inputs.right)laneAim=LANES[clamp(Math.round((playerOffset+3.45)/3.45),0,2)];
  setQuestionExpanded(false);
}
// When the whole question is there to decide on: a reading passage or a text fallback as it appears,
// a listened question once the voice has finished. Decision time (the race's pressure) counts from here.
function questionReady(){if(gate&&gate.announced&&!gate.judged&&gate.readyAt==null){gate.readyAt=elapsed;gate.readyRoad=gate.s-playerS;}}
function displayQuestion(){
  if(tutorial){renderTutorial();return;}
  if(!gate?.announced||gate.judged)return;
  const fallback=!soundEnabled||narrationUnavailable;
  if(fallback||gate.q.mode==='reading')setQuestionExpanded(true);
  $('voice-caption').hidden=!$('subtitles').checked||gate.q.mode==='reading';
  if($('subtitles').checked&&gate.q.mode!=='reading'&&gate.presentationId)learn(c=>c.help(gate.presentationId,'text'));
  $('voice-caption').textContent=gate.q.spoken;
  if(selectedStage.campaign){
    $('prompt').textContent=gate.q.prompt;
    $('question-passage').hidden=false;
    $('question-passage').textContent=gate.q.passage;
    $('question-help').textContent=gate.q.mode==='reading'?'지문을 읽고 보기를 골라요. 선택하는 동안 기다릴게요.':fallback?'음성 대신 지문과 보기를 열었어요.':'문제를 펼친 동안 기다릴게요. 보기를 누르거나 접고 운전하세요.';return;
  }
  $('question-passage').hidden=true;
  $('prompt').textContent=gate.q.mode==='picture'?gate.q.prompt:`“${gate.q.word}”를 골라줘!`;
  $('question-help').textContent=fallback?'소리가 꺼져 있어 보기를 열었어요.':'보기를 누르거나 접고 운전해 길을 골라요.';
}
function narrateQuestion(interrupt=false){if(!gate||gate.judged||!gate.announced)return;displayQuestion();if(gate.q.mode==='reading'){$('repeat-question').disabled=true;$('voice-status').textContent='지문을 읽고 길을 골라요';return;}if(interrupt&&gate.presentationId)learn(c=>c.help(gate.presentationId,'replay'));if(!soundEnabled&&gate.presentationId)learn(c=>c.delivery(gate.presentationId,{audio:'failed'}));const voice=questionNarration(gate.q,gate.types,WORD_BY_ID);speak(voice.ids,voice.text,'question',interrupt,gate.presentationId);}
function renderStages(){
  $('stages').dataset.collection=activeCollection;
  const target=assignment(),targetStage=target?nextPersonalized()?.stage:null;
  const query=$('stage-search').value.trim(),filter=activeCollection==='campaign'?'all':$('stage-filter').value;
  const list=target?(targetStage?[targetStage]:[]):availableStages().filter(s=>(filter==='all'||s.mode===filter||s.band===filter)&&(!query||`${s.title} ${s.number} ${s.campaign?s.skill:s.words.map(id=>WORD_BY_ID[id].word).join(' ')}`.includes(query)));
  for(const id of ['collection-campaign','collection-words','stage-search','stage-filter','review-stage'])$(id).hidden=!!target;
  $('watch').disabled=!!target||!ready||starting;
  const pages=Math.max(1,Math.ceil(list.length/12));stagePage=clamp(stagePage,0,pages-1);
  $('stage-pagination').hidden=pages===1;
  $('stage-count').textContent=`${list.length}개 스테이지`;$('stage-page').textContent=`${stagePage+1} / ${pages}`;
  $('stage-prev').disabled=stagePage===0;$('stage-next').disabled=stagePage>=pages-1;
  $('learned-count').textContent=Object.values(progress.words).filter(p=>p.correct>0).length.toLocaleString('ko-KR');
  $('cleared-count').textContent=STAGES.filter(s=>progress.stages[s.id]?.cleared).length;
  $('campaign-count').textContent=ALL_COURSES.filter(s=>progress.stages[s.id]?.cleared).length;
  const medals=ALL_COURSES.reduce((n,s)=>n+medalFor(progress.stages[s.id]?.bestScore||0),0);$('medal-count').textContent=medals;renderCollection();
  const personal=nextPersonalized();
  $('journey-title').textContent=personal?(assignment()?personal.stage.title:'나에게 맞는 다음 5문항'):target?'이번 목표':CHAPTERS[recommendedStage(progress).chapter-1].title;
  $('journey-note').textContent=personal?.reason||(target?targetUnavailable():`${recommendedStage(progress).skill} · 다음 코스`);
  $('journey-next').textContent=personal?'추천 문항으로 달리기 →':target?'목표 문항으로 달리기 →':`${recommendedStage(progress).title} 달리기 →`;
  $('journey-next').disabled=!ready||starting;
  $('learning-scope').textContent=learningScope();
  $('review-stage').textContent=activeCollection==='campaign'?'놓친 문장부터 복습 ↻':'틀린 단어부터 복습 ↻';$('review-stage').disabled=!reviewStage(progress,activeCollection);$('stage-grid').replaceChildren();
  for(const s of list.slice(stagePage*12,stagePage*12+12)){
    const b=document.createElement('button');b.className='stage-card';b.classList.toggle('selected',s.id===selectedStage.id);b.dataset.stage=s.id;b.setAttribute('aria-pressed',String(s.id===selectedStage.id));
    const unlocked=isUnlocked(s);b.classList.toggle('locked',!unlocked);b.classList.toggle('stage-finale',!!s.finale);
    for(const [tag,css,text] of [['span','stage-card-top',s.campaign?`LEVEL ${s.level} / ${s.skill}`:`${String(s.number).padStart(3,'0')} / ${s.mode==='picture'?'그림 + 듣기':'듣고 단어 선택'}`],['strong','',s.title],['span','stage-words',s.personalized?s.skill:s.campaign?CHAPTERS[s.chapter-1].goal:s.words.map(id=>WORD_BY_ID[id].word).join(' · ')],['span','stage-status',progress.stages[s.id]?.cleared?`${'◆'.repeat(medalFor(progress.stages[s.id].bestScore))} 통과 · 최고 ${progress.stages[s.id].bestScore}/5`:!unlocked?'이전 코스 4/5 통과로 열기 · 시연 보기 가능':progress.stages[s.id]?`다시 도전 · 최고 ${progress.stages[s.id].bestScore}/5`:`${stageSize(s)}문제 · 도전하기`]]){
      const e=document.createElement(tag);e.className=css;e.textContent=s.finale&&css==='stage-words'?`새로운 문장 5개 · ${s.reward.title}`:s.finale&&css==='stage-status'&&!unlocked?'챕터의 두 코스를 통과하면 열려요':text;b.appendChild(e);
    }
    b.addEventListener('click',()=>selectStage(s));$('stage-grid').appendChild(b);
  }
  if(!list.length){const p=document.createElement('p');p.className='empty-stages';p.textContent=target?targetUnavailable():'다른 단어나 주제로 찾아보세요.';$('stage-grid').appendChild(p);}
}
function selectStage(s){
  if(assignment()){const plan=nextPersonalized();if(!plan){showToast(targetUnavailable());return;}s=plan.stage;}
  if(starting)return;if(garageOpen)garageUI.close();clearTutorial();selectedStage=s;questionBank=makeQuestions(s);running=false;auto=false;silence();endLive();
  const name=document.createElement('span');name.textContent='스테이지 선택 ↓';$('choose-stage').replaceChildren(document.createTextNode(labelStage(s)+' '),name);
  refreshStartLabel();$('start').disabled=!ready||!isUnlocked(s);
  $('route-level').textContent=s.campaign?`LEVEL ${s.level} · ${s.skill}`:'WORD PRACTICE · 어휘 연습';
  $('location-title').textContent={bloom:'BLOSSOM COAST / 꽃빛 해안',coast:'ISLAND DRIVE / 섬과 바다',sunset:'GOLDEN BAY / 노을 만'}[s.scene||'coast'];
  if(ready)setScenery(s.scene||'coast');
  if(ready)reset(false);renderStages();stage.scrollIntoView({behavior:'auto',block:'start'});
}

function canvasTexture(size, paint) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  paint(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8,renderer.capabilities.getMaxAnisotropy());
  return t;
}
function makeSurfaceTexture(kind) {
  return canvasTexture(512,(ctx,size)=>{
    const img = ctx.createImageData(size,size);
    for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
      const n = random(), i=(y*size+x)*4;
      const v=kind==='road' ? 47+n*36 : 113+n*34;
      img.data[i]=v;img.data[i+1]=kind==='road'?v+2:v+4;img.data[i+2]=kind==='road'?v+3:v-13;img.data[i+3]=255;
    }
    ctx.putImageData(img,0,0);
    if(kind==='road') {
      for(let j=0;j<14;j++) {
        let x=random()*size,y=random()*size;ctx.strokeStyle='rgba(15,20,21,.32)';ctx.lineWidth=.4+random();ctx.beginPath();ctx.moveTo(x,y);
        for(let k=0;k<12;k++){x+=(random()-.5)*22;y+=random()*9;ctx.lineTo(x,y);}ctx.stroke();
      }
      ctx.fillStyle='rgba(10,13,17,.09)'; for(const x of [110,155,235,280,360,405])ctx.fillRect(x,0,8,size);
    }
  });
}
function ribbon(offset, width, start, end, material, dashed=false, height=.022) {
  const p=[],uv=[],idx=[];
  let vertex=0;
  const step=dashed?7:3;
  for(let s=start;s<end;s+=step) {
    const e=Math.min(end,s+(dashed?3.2:step));
    for(const [t,o,u] of [[s,offset-width/2,0],[s,offset+width/2,1],[e,offset-width/2,0],[e,offset+width/2,1]]){
      const v=roadPoint(t,o,height);p.push(v.x,v.y,v.z);uv.push(u*3.4,t/5.3);
    }
    idx.push(vertex,vertex+2,vertex+1,vertex+1,vertex+2,vertex+3);vertex+=4;
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,material);mesh.receiveShadow=true;scene.add(mesh);return mesh;
}
function coastalTerrainMaterial() {
  const mat=new THREE.MeshStandardMaterial({map:surfaceTextures.terrain,normalMap:surfaceTextures.terrainNormal,normalScale:new THREE.Vector2(.17,.17),vertexColors:true,roughness:1,envMapIntensity:.25});
  // Blend grass, pale rock and sand in one draw call instead of tinting grass over every surface.
  mat.onBeforeCompile=shader=>{
    shader.uniforms.coastalRock={value:surfaceTextures.cliff};shader.uniforms.coastalSand={value:surfaceTextures.beach};
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float surface;\nvarying float vSurface;\nvarying vec3 vTerrainPosition;\nvarying vec3 vTerrainNormal;').replace('#include <begin_vertex>','#include <begin_vertex>\nvSurface=surface;\nvTerrainPosition=position;\nvTerrainNormal=normal;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vSurface;\nvarying vec3 vTerrainPosition;\nvarying vec3 vTerrainNormal;\nuniform sampler2D coastalRock;\nuniform sampler2D coastalSand;').replace('#include <map_fragment>',`#include <map_fragment>
      #ifdef USE_MAP
        vec3 weights=abs(normalize(vTerrainNormal));
        float rockBlend=weights.x/(weights.x+weights.z+.001);
        vec3 rockSample=mix(texture2D(coastalRock,vTerrainPosition.xy*.065).rgb,texture2D(coastalRock,vTerrainPosition.zy*.065).rgb,rockBlend);
        float stratum=.88+.12*sin(vTerrainPosition.y*.47+sin(vTerrainPosition.z*.021)*2.2);
        float mineral=.94+.09*sin(vTerrainPosition.x*.024+vTerrainPosition.z*.017);
        vec3 rockColor=mix(rockSample,vec3(dot(rockSample,vec3(.2126,.7152,.0722))),.22)*vec3(.47,.45,.41)*stratum*mineral;
        vec3 sandColor=mix(texture2D(coastalSand,vTerrainPosition.xz*.09).rgb,vec3(.20,.17,.12),.12);
        float meadow=sin(vTerrainPosition.x*.049+sin(vTerrainPosition.z*.014)*2.3)*sin(vTerrainPosition.z*.035)*.5+.5;
        float glade=sin(vTerrainPosition.x*.012-vTerrainPosition.z*.009)*.5+.5;
        vec3 grassTone=mix(vec3(.025,.043,.017),vec3(.064,.070,.032),meadow*.7+glade*.3);
        diffuseColor.rgb=mix(diffuseColor.rgb*vec3(.42,.53,.37),grassTone,.16+glade*.06);
        float cliffSlope=smoothstep(.16,.42,1.-abs(normalize(vTerrainNormal).y));
        diffuseColor.rgb=mix(diffuseColor.rgb,rockColor,max(clamp(vSurface,0.,1.),cliffSlope));
        diffuseColor.rgb=mix(diffuseColor.rgb,sandColor,clamp(vSurface-1.,0.,1.));
      #endif`).replace('#include <tonemapping_fragment>',`float air=smoothstep(350.,2400.,length(vTerrainPosition-cameraPosition))*.17;
      gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(.30,.48,.62),air);
      #include <tonemapping_fragment>`);
  };
  mat.customProgramCacheKey=()=> 'coastal-terrain-v6';return mat;
}
function setupTerrain() {
  const asphalt=surfaceTextures.road;asphalt.wrapS=asphalt.wrapT=THREE.RepeatWrapping;
  const asphaltMat=new THREE.MeshStandardMaterial({map:asphalt,normalMap:surfaceTextures.roadNormal,normalScale:new THREE.Vector2(.12,.12),roughness:.96,metalness:0,color:0xb6bdc0,envMapIntensity:.12});
  asphaltMat.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(.12,.135,.14),.24);');};
  asphaltMat.customProgramCacheKey=()=> 'coastal-asphalt-v2';
  ribbon(0,11.6,-65,ROAD_END,asphaltMat,false,0);
  const shoulderTex=makeSurfaceTexture('sand');shoulderTex.wrapS=shoulderTex.wrapT=THREE.RepeatWrapping;
  const shoulder=new THREE.MeshStandardMaterial({map:shoulderTex,color:0xb7b6a8,roughness:1});
  ribbon(-6.2,.8,-65,ROAD_END,shoulder,false,-.025);ribbon(6.2,.8,-65,ROAD_END,shoulder,false,-.025);
  const white=new THREE.MeshStandardMaterial({color:0xe7e5cb,roughness:.9});
  const yellow=new THREE.MeshStandardMaterial({color:0xcfb466,roughness:.9});
  ribbon(-5.45,.13,-60,ROAD_END,white);ribbon(5.45,.13,-60,ROAD_END,white);
  ribbon(-1.725,.1,-60,ROAD_END,white,true);ribbon(1.725,.1,-60,ROAD_END,white,true);
  ribbon(-5.72,.1,-60,ROAD_END,yellow);ribbon(5.72,.1,-60,ROAD_END,yellow);
  scenery.terrain=buildCourseTerrain(THREE,{pathX,groundHeight,ROAD_END,material:coastalTerrainMaterial(),colorAt:(x,z)=>{const shade=.90+fbm(x*.08,z*.08)*.20;return [shade,shade,shade];}});
  scene.add(scenery.terrain.group);
}
function setupSky() {
  // Only distant headlands receive aerial perspective; the coast stays crisp.
  scene.fog=new THREE.Fog(0x91bce0,1800,6500);
}
function wildflowerGeometry(){
  const positions=[],colours=[];
  const triangle=(a,b,c,colour)=>{for(const point of [a,b,c]){positions.push(...point);colours.push(...colour);}};
  for(let i=0;i<3;i++){
    const angle=i*Math.PI*2/3,next=(i+1)*Math.PI*2/3;
    const a=[Math.cos(angle)*.006,0,Math.sin(angle)*.006],b=[Math.cos(next)*.006,0,Math.sin(next)*.006];
    const c=[a[0],.235,a[2]],d=[b[0],.235,b[2]];
    triangle(a,b,c,[.22,.37,.12]);triangle(b,d,c,[.22,.37,.12]);
  }
  for(let i=0;i<5;i++){
    const angle=i*Math.PI*2/5;
    const point=(radius,a,height)=>[Math.cos(a)*radius,height,Math.sin(a)*radius];
    const base=point(.012,angle,.245),left=point(.055,angle-.44,.258),tip=point(.095,angle,.249),right=point(.055,angle+.44,.258);
    triangle(base,left,tip,[.92,.88,.79]);triangle(base,tip,right,[.92,.88,.79]);
    triangle([0,.261,0],point(.015,angle,.261),point(.015,angle+Math.PI*2/5,.261),[.73,.43,.12]);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));geometry.computeVertexNormals();return geometry;
}
function setupJourneyScenery(sky){
  scenery.sky=scenery.atmosphere.sky;
  const flowerGroup=new THREE.Group();scenery.bloom=flowerGroup;scene.add(flowerGroup);
  const flowers=new THREE.InstancedMesh(wildflowerGeometry(),new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:1}),1700);
  const tint=new THREE.Color();for(let i=0;i<1700;i++){const z=random()*ROAD_END,x=pathX(z)-8-random()*17;tempObj.position.set(x,groundHeight(x,z)-.015,z);tempObj.rotation.set((random()-.5)*.16,random()*6.28,(random()-.5)*.12);tempObj.scale.setScalar(.7+random()*.55);tempObj.updateMatrix();flowers.setMatrixAt(i,tempObj.matrix);tint.set(i%3===0?0xfff3de:i%3===1?0xf1c8c6:0xf2dfab);flowers.setColorAt(i,tint);}flowers.receiveShadow=true;flowerGroup.add(flowers);
  const particles=new THREE.BufferGeometry(),positions=[];for(let i=0;i<65;i++)positions.push((random()-.5)*40,1+random()*12,random()*65);particles.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  const petals=new THREE.Points(particles,new THREE.PointsMaterial({color:0xf6ded9,size:.065,transparent:true,opacity:.65,depthWrite:false}));petals.visible=!reducedMotion;flowerGroup.add(petals);scenery.petals=petals;
  scenery.cityLife=buildCityLife(THREE,{anchors:scenery.city.group.userData.activityAnchors,groundHeight,pathX,surfaceHeightAt:scenery.city.surfaceHeightAt});scene.add(scenery.cityLife.group);
  scenery.details=buildSceneryDetails(THREE,{roadPoint,pathX,groundHeight,ROAD_END,textures:{...surfaceTextures,pineCanopy:pineCanopyTexture,blossomCanopy:blossomCanopyTexture},random,excludeAt:(x,z,margin)=>scenery.city.containsFootprint(x,z,margin)});scene.add(scenery.details.group);
  setScenery(selectedStage.scene||'coast');
}
function setScenery(theme){
  if(!scenery.sky)return;
  scenery.theme=theme;scenery.bloom.visible=theme==='bloom';scenery.details.setTheme(theme);
  scenery.city.setTheme(theme==='bloom'?'bloom':'sunset');
  scenery.cityLife.setTheme(theme);
  scenery.atmosphere.setTheme('sunset');
  sunDirection.set(.34,.115,.94).normalize();
  light.color.set(0xffd4ac);light.intensity=2.15;
  ambientLight.intensity=.88;ambientLight.color.set(0xc4c8e2);ambientLight.groundColor.set(0x756550);
  renderer.toneMappingExposure=1.04;
  scene.environment=scenery.environments.sunset.texture;scene.environmentIntensity=.95;scene.environmentRotation.y=0;
}
function setupWater(daySky,sunsetSky) {
  scenery.atmosphere=createAtmosphere(THREE,{daySky,sunsetSky,time:worldTime,sunDirection,shoreOffset:groundHeight.shoreOffset,ROAD_END});
  ocean=scenery.atmosphere.ocean;scene.add(ocean,scenery.atmosphere.sky);scene.background=null;
}
function setupCoastalScenery() {
  const coast=buildDistantCoast(THREE,{material:coastalTerrainMaterial(),roadPoint,pathX,groundHeight,ROAD_END,textures:{pineCanopy:pineCanopyTexture},random});scene.add(coast);scenery.coast=coast;
  scenery.boats=createCoastalBoats(THREE,{pathX,groundHeight});scene.add(scenery.boats.group);
}
function setupVegetation() {
  // Roadside stone, grass and steel rails are instanced rather than thousands of draw calls.
  const rockGeometry=new THREE.IcosahedronGeometry(1,1),rockVertices=rockGeometry.attributes.position;
  for(let i=0;i<rockVertices.count;i++){const x=rockVertices.getX(i),y=rockVertices.getY(i),z=rockVertices.getZ(i),j=.80+noise(x*3.7+4.2,z*4.1+y*2.7)*.34;rockVertices.setXYZ(i,x*j+y*.13,y*(.82+noise(x*6,z*7)*.23),z*j);}
  rockGeometry.computeVertexNormals();
  const rocks=new THREE.InstancedMesh(rockGeometry,new THREE.MeshStandardMaterial({map:surfaceTextures.cliff,normalMap:surfaceTextures.cliffNormal,normalScale:new THREE.Vector2(.32,.32),color:0xc5bca9,roughness:.94,envMapIntensity:.22}),180);
  let rockCount=0;
  for(let i=0;i<180;i++){const z=random()*ROAD_END,x=pathX(z)-(8+random()*25),s=.3+random()*1.4;tempObj.position.set(x,groundHeight(x,z)+s*.2,z);tempObj.rotation.set(random()*3,random()*3,random()*3);tempObj.scale.set(s*1.4,s*.65,s);if(scenery.city.containsFootprint(x,z,s*1.5))continue;tempObj.updateMatrix();rocks.setMatrixAt(rockCount++,tempObj.matrix);}rocks.count=rockCount;rocks.receiveShadow=true;scene.add(rocks);
  const grassPositions=[],grassColors=[];
  for(let j=0;j<3;j++){const a=j*2.094,c=Math.cos(a),s=Math.sin(a),height=.28+j*.055;grassPositions.push(-.032*c,0,-.032*s,.032*c,0,.032*s,.07*c,height,.07*s);grassColors.push(.035,.065,.018,.035,.065,.018,.105,.135,.043);}
  const grassGeometry=new THREE.BufferGeometry();grassGeometry.setAttribute('position',new THREE.Float32BufferAttribute(grassPositions,3));grassGeometry.setAttribute('color',new THREE.Float32BufferAttribute(grassColors,3));grassGeometry.computeVertexNormals();const grassMat=new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:1,envMapIntensity:.2});
  const grass=new THREE.InstancedMesh(grassGeometry,grassMat,4500);
  let grassCount=0;
  for(let i=0;i<4500;i++){const z=random()*ROAD_END,side=random()>.65?1:-1,off=side*(6.9+random()*6),x=pathX(z)+off;tempObj.position.set(x,groundHeight(x,z)+.005,z);tempObj.rotation.set(0,random()*Math.PI,(random()-.5)*.15);tempObj.scale.set(.6+random()*.6,.5+random()*.65,.6+random()*.6);if(scenery.city.containsFootprint(x,z,.25))continue;tempObj.updateMatrix();grass.setMatrixAt(grassCount++,tempObj.matrix);}grass.count=grassCount;grass.receiveShadow=true;scene.add(grass);
  scenery.groundProps={rocks:rockCount,grass:grassCount,excludedRocks:180-rockCount,excludedGrass:4500-grassCount};
  const railMat=new THREE.MeshStandardMaterial({color:0xa8b5b3,metalness:.68,roughness:.48});
  const rail=new THREE.InstancedMesh(new THREE.BoxGeometry(.12,.33,5.1),railMat,440);
  const posts=new THREE.InstancedMesh(new THREE.BoxGeometry(.11,.85,.14),railMat,440);
  const reflectors=new THREE.InstancedMesh(new THREE.BoxGeometry(.03,.11,.16),new THREE.MeshStandardMaterial({color:0xe6ae49,roughness:.5}),220);
  for(let i=0;i<440;i++){const s=i*5.1,p=roadPoint(s,6.85,.65);tempObj.position.copy(p);tempObj.rotation.set(0,pathAngle(s),0);tempObj.scale.set(1,1,1);tempObj.updateMatrix();rail.setMatrixAt(i,tempObj.matrix);tempObj.position.copy(roadPoint(s,6.85,.32));tempObj.updateMatrix();posts.setMatrixAt(i,tempObj.matrix);if(i%2===0){tempObj.position.copy(roadPoint(s,6.76,.69));tempObj.updateMatrix();reflectors.setMatrixAt(i/2,tempObj.matrix);}}
  rail.castShadow=posts.castShadow=true;scene.add(rail,posts,reflectors);
  // Survey markers and chevrons along bends.
  const signs=new THREE.Group();
  const arrowTex=canvasTexture(128,(ctx,n)=>{ctx.fillStyle='#cbb96c';ctx.fillRect(0,0,n,n);ctx.fillStyle='#303e38';ctx.beginPath();ctx.moveTo(20,10);ctx.lineTo(62,10);ctx.lineTo(108,64);ctx.lineTo(62,118);ctx.lineTo(20,118);ctx.lineTo(68,64);ctx.closePath();ctx.fill();});
  const signPosts=new THREE.InstancedMesh(new THREE.BoxGeometry(.11,2.4,.11),railMat,26);
  const signPanels=new THREE.InstancedMesh(new THREE.BoxGeometry(1.05,.88,.06),new THREE.MeshStandardMaterial({map:arrowTex,roughness:.65}),26);
  for(let i=0;i<26;i++){const s=60+i*83,p=roadPoint(s,-7.6,1.5);tempObj.position.copy(p).add(new THREE.Vector3(0,-.4,0));tempObj.rotation.set(0,0,0);tempObj.scale.setScalar(1);tempObj.updateMatrix();signPosts.setMatrixAt(i,tempObj.matrix);tempObj.position.copy(p).add(new THREE.Vector3(0,.5,0));tempObj.rotation.y=pathAngle(s)+Math.PI;tempObj.updateMatrix();signPanels.setMatrixAt(i,tempObj.matrix);}
  signs.add(signPosts,signPanels);scene.add(signs);
}
function textTexture(text) {
  const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');ctx.clearRect(0,0,512,128);ctx.font='800 45px SUIT, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#e5faee';ctx.fillText(text,256,64);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function fruit(type) {
  const g=new THREE.Group();
  if(type==='apple'){
    const geometry=new THREE.SphereGeometry(.58,24,18);const p=geometry.attributes.position;
    for(let i=0;i<p.count;i++){const y=p.getY(i),x=p.getX(i),z=p.getZ(i),theta=Math.atan2(z,x),r=1+.045*Math.cos(theta*5);p.setXYZ(i,x*r,y*.88-.11*Math.exp(-(x*x+z*z)*28)*(y>0?1:-.3),z*r);}geometry.computeVertexNormals();
    const apple=new THREE.Mesh(geometry,new THREE.MeshPhysicalMaterial({color:0xbe2b23,roughness:.34,clearcoat:.65,clearcoatRoughness:.24}));apple.castShadow=true;g.add(apple);
    const stem=new THREE.Mesh(new THREE.CylinderGeometry(.035,.05,.29,7),new THREE.MeshStandardMaterial({color:0x685231,roughness:1}));stem.position.set(.04,.53,0);stem.rotation.z=-.2;g.add(stem);
    const leaf=new THREE.Mesh(new THREE.SphereGeometry(.2,12,6),new THREE.MeshStandardMaterial({color:0x4c7331,roughness:.8}));leaf.scale.set(1,.09,.43);leaf.position.set(.21,.57,0);leaf.rotation.z=.3;g.add(leaf);
  }else if(type==='banana'){
    const mat=new THREE.MeshPhysicalMaterial({color:0xe2c557,roughness:.48,clearcoat:.23});
    for(let i=0;i<3;i++){const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(-.49,-.29,i*.09),new THREE.Vector3(-.27,-.44,i*.09),new THREE.Vector3(.13,-.40,i*.09),new THREE.Vector3(.43,-.10,i*.09),new THREE.Vector3(.47,.27,i*.09)]);const b=new THREE.Mesh(new THREE.TubeGeometry(curve,18,.105,7,false),mat);b.rotation.z=(i-1)*.24;b.position.set(0,.15,0);g.add(b);const tip=new THREE.Mesh(new THREE.SphereGeometry(.10,8,6),new THREE.MeshStandardMaterial({color:0x6d5530,roughness:1}));tip.position.set(.45,.41,i*.09);g.add(tip);}g.rotation.z=-.2;
  }else{
    const mat=new THREE.MeshPhysicalMaterial({color:0x6261a0,roughness:.38,clearcoat:.5});const geo=new THREE.SphereGeometry(.20,12,8);
    for(let y=0;y<4;y++)for(let j=0;j<4-y;j++){const b=new THREE.Mesh(geo,mat);b.position.set((j-(3-y)/2)*.29,.47-y*.27,Math.sin(j*2+y)*.13);g.add(b);}
    const stem=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,.3,6),new THREE.MeshStandardMaterial({color:0x6b7c3a,roughness:1}));stem.position.y=.79;stem.rotation.z=.3;g.add(stem);
  }
  g.scale.setScalar(1.34);return g;
}
function answerVisual(id,mode){
  const word=WORD_BY_ID[id],model={'사과':'apple','바나나':'banana','포도':'grape'}[word.word];
  if(mode==='picture'&&model)return fruit(model);
  const texture=canvasTexture(512,(ctx,n)=>{
    ctx.clearRect(0,0,n,n);ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#f6fff1';
    if(mode==='picture'){ctx.font='270px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';ctx.fillText(word.icon,n/2,n/2);}
    else{let size=word.word.length>8?60:115;ctx.font=`800 ${size}px SUIT, sans-serif`;while(ctx.measureText(word.word).width>470&&size>55){size-=3;ctx.font=`800 ${size}px SUIT, sans-serif`;}const lines=[];let line='';for(const char of word.word){if(ctx.measureText(line+char).width>440){lines.push(line.trim());line=char;}else line+=char;}if(line)lines.push(line.trim());lines.forEach((text,i)=>ctx.fillText(text,n/2,n/2+(i-(lines.length-1)/2)*(size*1.3)));}
  });
  const m=new THREE.Mesh(new THREE.PlaneGeometry(2.5,2.5),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,side:THREE.DoubleSide}));m.rotation.y=Math.PI;m.userData.spinBase=Math.PI;return m;
}
function makeGate(index, s) {
  if(gate) disposeGate();
  const q=questionBank[index%questionBank.length],types=[...q.options];
  const group=new THREE.Group(),fruitObjects=[];
  const frameMat=new THREE.MeshStandardMaterial({color:0xe1ece5,metalness:.3,roughness:.46});
  const darkMat=new THREE.MeshStandardMaterial({color:0x204249,metalness:.18,roughness:.58});
  const glassMat=new THREE.MeshStandardMaterial({color:0x739598,transparent:true,opacity:.18,roughness:.3,metalness:.3,depthWrite:false});
  for(let i=0;i<3;i++){
    const lane=new THREE.Group();lane.position.x=LANES[i];
    for(const x of [-1.55,1.55]){const pole=new THREE.Mesh(new THREE.BoxGeometry(.075,3.7,.075),frameMat);pole.position.set(x,1.85,0);pole.castShadow=true;lane.add(pole);}
    const top=new THREE.Mesh(new THREE.BoxGeometry(3.18,.10,.10),frameMat);top.position.y=3.7;lane.add(top);
    const panel=new THREE.Mesh(new THREE.BoxGeometry(2.8,1.55,.11),darkMat);panel.position.set(0,2.84,0);panel.castShadow=true;lane.add(panel);
    const border=new THREE.Mesh(new THREE.BoxGeometry(2.73,1.46,.12),glassMat);border.position.set(0,2.84,-.085);lane.add(border);
    const f=answerVisual(types[i],q.mode);f.position.set(0,2.85,-.22);lane.add(f);fruitObjects.push(f);
    const base=new THREE.Mesh(new THREE.BoxGeometry(2.97,.026,1.4),new THREE.MeshStandardMaterial({color:0x95b4aa,metalness:.12,roughness:.72}));base.position.set(0,.023,-.1);lane.add(base);
    group.add(lane);
  }
  group.position.copy(roadPoint(s));group.rotation.y=pathAngle(s);scene.add(group);
  gate={group,s,q,types,fruitObjects,announced:false,judged:false};questionChosen=false;setQuestionExpanded(false);$('go').disabled=true;$('question-toggle').disabled=true;$('voice-caption').hidden=true;$('question-passage').hidden=true;
  $('lane-choices').replaceChildren();$('lane-choices').hidden=true;
  // The chase camera faces +Z, so reverse world-X order for the on-screen choices.
  [...types].reverse().forEach((id,i)=>{
    const w=WORD_BY_ID[id],b=document.createElement('button'),direction=document.createElement('span'),content=document.createElement('strong');
    b.className='lane-choice';b.dataset.word=id;b.setAttribute('aria-label',`${['왼쪽','가운데','오른쪽'][i]} 차선 · ${w.word}`);
    direction.textContent=['왼쪽 길','가운데 길','오른쪽 길'][i];content.textContent=q.mode==='picture'?w.icon:w.word;if(q.mode==='picture')b.classList.add('picture-choice');
    b.append(direction,content);b.addEventListener('click',()=>{if(!running||paused||gate?.judged)return;questionChosen=true;gate.intentChoice=id;gate.choseAt=elapsed;laneAim=LANES[types.indexOf(id)];inputs.left=inputs.right=false;auto=false;$('demo-indicator').hidden=true;for(const choice of $('lane-choices').children)choice.classList.toggle('chosen',choice===b);setQuestionExpanded(false);});$('lane-choices').appendChild(b);
  });
}
function disposeGate(){
  if(!gate)return;
  // A question heard but left (home, restart, another course) was met: closed as unanswered, never as a wrong answer.
  if(gate.presentationId&&!gate.judged&&!roundWasDemo){learn(c=>c.answer(gate.presentationId,{correct:null,assessable:false,reason:'unanswered'}));gate.judged=true;}
  scene.remove(gate.group);
  const gs=new Set(),ms=new Set(),ts=new Set();gate.group.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material])ms.add(m);}});
  for(const g of gs)g.dispose();for(const m of ms){if(m.map)ts.add(m.map);m.dispose();}for(const t of ts)t.dispose();gate=null;
}

function shadowPlane() {
  const t=canvasTexture(128,(ctx,n)=>{const g=ctx.createRadialGradient(n/2,n/2,12,n/2,n/2,n/2);g.addColorStop(0,'rgba(0,10,15,.85)');g.addColorStop(.45,'rgba(0,10,15,.48)');g.addColorStop(1,'rgba(0,10,15,0)');ctx.fillStyle=g;ctx.fillRect(0,0,n,n);});
  const s=new THREE.Mesh(new THREE.PlaneGeometry(2.7,5.1),new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false}));s.rotation.x=-Math.PI/2;s.position.y=.035;return s;
}
function prepareCar(model,color) {
  const root=new THREE.Group();const object=model.clone(true);object.rotation.y=Math.PI;
  const body=new THREE.MeshPhysicalMaterial({color,metalness:.34,roughness:.29,clearcoat:1,clearcoatRoughness:.15,envMapIntensity:1.15});
  const trim=new THREE.MeshStandardMaterial({color:0x253037,metalness:.22,roughness:.46});
  const rim=new THREE.MeshStandardMaterial({color:0xc0c8c7,metalness:.92,roughness:.24,envMapIntensity:1.1});
  const glass=new THREE.MeshPhysicalMaterial({color:0xbad9da,metalness:0,roughness:.075,transparent:true,opacity:.34,depthWrite:false,clearcoat:1,clearcoatRoughness:.06,envMapIntensity:1.1});
  const rubber=new THREE.MeshStandardMaterial({color:0x171b20,roughness:.88,metalness:0});
  const leather=new THREE.MeshStandardMaterial({color:0x40352f,roughness:.82,metalness:0});
  const interior=new THREE.MeshStandardMaterial({color:0x20272d,roughness:.69,metalness:.04});
  const chrome=new THREE.MeshStandardMaterial({color:0xb7bfc4,roughness:.22,metalness:.94});
  const carbon=new THREE.MeshStandardMaterial({color:0x252b30,roughness:.54,metalness:.18});
  const brake=new THREE.MeshStandardMaterial({color:0xbea880,roughness:.43,metalness:.55});
  const frontLight=new THREE.MeshPhysicalMaterial({color:0xf4f5f0,emissive:0xe9f4ff,emissiveIntensity:.38,metalness:.05,roughness:.18,clearcoat:1});
  const rearLight=new THREE.MeshPhysicalMaterial({color:0x9a302b,emissive:0xe53e28,emissiveIntensity:.7,roughness:.2,clearcoat:1});
  object.traverse(o=>{if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;
    if(o.name==='body')o.material=body;
    else if(o.name==='glass'){o.material=glass;o.castShadow=false;}
    else if(o.name.startsWith('rim_')||['metal','chrome','steering_metal','nuts'].includes(o.name))o.material=o.name.startsWith('rim_')?rim:chrome;
    else if(o.name==='tire')o.material=rubber;
    else if(['leather','steering_leather','carpet'].includes(o.name))o.material=leather;
    else if(['trim','plastic_gray','grills','wipers'].includes(o.name))o.material=trim;
    else if(['carbon_fibre_trim','carbon fibre','steering_carbon'].includes(o.name))o.material=carbon;
    else if(['interior_dark','interior_light','steering_trim'].includes(o.name))o.material=interior;
    else if(['brakes','brake','wheel'].includes(o.name))o.material=brake;
    else if(['lights','leds'].includes(o.name))o.material=frontLight;
    else if(['lights_red','steering_red_lights'].includes(o.name))o.material=rearLight;
  });
  root.add(object,shadowPlane());root.userData.model=object;root.userData.wheels=['wheel_fl','wheel_fr','wheel_rl','wheel_rr'].map(n=>object.getObjectByName(n)).filter(Boolean);
  // Subtle emissive rear lamps and exhaust give clear acceleration feedback.
  const lampMat=new THREE.MeshStandardMaterial({color:0x962719,emissive:0xf13b23,emissiveIntensity:.7,roughness:.2});
  for(const x of [-.68,.68]){const lamp=new THREE.Mesh(new THREE.TorusGeometry(.105,.025,6,14),lampMat);lamp.position.set(x,.65,-1.99);root.add(lamp);}
  const jets=[];for(const x of [-.26,.26]){const jet=new THREE.Mesh(new THREE.ConeGeometry(.065,.62,8),new THREE.MeshBasicMaterial({color:0xb3f5ff,transparent:true,opacity:.6,depthWrite:false}));jet.rotation.x=-Math.PI/2;jet.position.set(x,.28,-2.2);jet.visible=false;root.add(jet);jets.push(jet);}root.userData.jets=jets;
  refineOriginalCar(root);scene.add(root);return root;
}
function seatMascot(vehicle,name){
  // The driver is actual geometry under the same light and environment as the
  // car. Local +Z faces the road; the chase camera sees the back of the helmet.
  const drivers=vehicle.userData.drivers||(vehicle.userData.drivers=new Map());
  if(vehicle.userData.mascot)vehicle.userData.mascot.visible=false;
  if(!drivers.has(name)){const driver=buildDriver(THREE,name,{feltTexture:driverFeltTexture});driver.position.fromArray(vehicle.userData.seatPosition||[.40,.68,-.18]);vehicle.add(driver);drivers.set(name,driver);}
  const mascot=drivers.get(name);mascot.visible=true;vehicle.userData.mascot=mascot;vehicle.userData.character=name;return mascot;
}
function selectDriver(name){
  driverName=name;driverMood='base';moodTime=0;
  for(const character of ['marin','kkamong'])$('driver-'+character).setAttribute('aria-pressed',String(character===name));
  for(const vehicle of new Set([...raceCars.values(),...previewCars.values()]))seatMascot(vehicle,name);
}
function mascotMood(mood,seconds=0){driverMood=mood;moodTime=seconds;}
function updateMascot(dt){
  const mascot=car.userData.mascot;if(!mascot)return;
  if(moodTime>0){moodTime-=dt;if(moodTime<=0)driverMood=gate?.announced&&!gate.judged?'focus':'base';}
  updateDriverPose(mascot,{steer:(inputs.left?1:0)-(inputs.right?1:0),mood:driverMood,time:worldTime.value,speed:running&&!paused?velocity:0,motion:!reducedMotion});
}
function placeCar(c,s,offset,yaw=0) {
  c.position.copy(roadPoint(s,offset,.025));c.rotation.set(0,pathAngle(s)+yaw,0);
}
function setQuality(value) {
  currentQuality=value;mode=value==='auto'?automaticQuality(deviceGraphics):value;
  if(renderer&&light)applyRenderQuality();adaptiveTime=0;frameSample=[];
}
function applyRenderQuality(){
  renderQuality=qualitySettings(mode,{pixelRatio:capture4k?2:devicePixelRatio,explicit:currentQuality!=='auto'});
  renderer.setPixelRatio(renderQuality.pixelRatio);renderer.shadowMap.enabled=renderQuality.shadows;
  if(light.shadow.mapSize.x!==renderQuality.shadowSize){light.shadow.map?.dispose();light.shadow.map=null;light.shadow.mapSize.setScalar(renderQuality.shadowSize);}
  scenery.atmosphere?.setQuality(mode);renderer.shadowMap.needsUpdate=true;resize();
}
function resize(){
  if(!renderer)return;
  const w=stage.clientWidth,h=stage.clientHeight;mobile=w<=650;
  const pixelRatio=qualitySettings(mode,{pixelRatio:capture4k?2:devicePixelRatio,explicit:currentQuality!=='auto'}).pixelRatio;
  if(renderer.getPixelRatio()!==pixelRatio){renderQuality={...renderQuality,pixelRatio};renderer.setPixelRatio(pixelRatio);}
  renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
  // THREE reassigns canvas width/height even for the same size, clearing its
  // drawing buffer. A paused view must repaint after every such operation.
  pausedFrameGate.invalidate();
  if(running)requestAnimationFrame(()=>stage.scrollIntoView({behavior:'instant',block:'start'}));
}

async function init() {
  const startedAt=performance.now(),mark=name=>{startup[name]=Math.round(performance.now()-startedAt);};
  const yieldToUI=()=>new Promise(resolve=>setTimeout(resolve,0));
  startup.phase='assets';startup.startedAt=Math.round(startedAt);
  let draco;
  try{
    const textures=new THREE.TextureLoader();
    draco=new DRACOLoader();draco.setDecoderPath('./vendor/');draco.setDecoderConfig({type:'wasm'});
    const loader=new GLTFLoader();loader.setDRACOLoader(draco);
    const assetsPending=startAssetLoad({textures,models:loader,coarsePointer:deviceGraphics.coarsePointer}).then(result=>{mark('assetsMs');return result;});
    await document.fonts.ready;
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
    renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.setClearColor(0xc9dedb);
    $('world').appendChild(renderer.domElement);
    renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();if(running&&!paused)pause();$('error').hidden=false;});
    scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(53,1,.12,4900);
    ambientLight=new THREE.HemisphereLight(0xc7e1fa,0x68764c,.78);scene.add(ambientLight);
    light=new THREE.DirectionalLight(0xfff2db,2.9);light.castShadow=true;light.shadow.mapSize.set(2048,2048);light.shadow.camera.left=-38;light.shadow.camera.right=38;light.shadow.camera.top=66;light.shadow.camera.bottom=-26;light.shadow.camera.near=1;light.shadow.camera.far=280;light.shadow.bias=-.00012;light.shadow.normalBias=.035;light.shadow.radius=2;scene.add(light,light.target);
    const assets=await assetsPending;if(!assets.ok)throw assets.error;
    const [road,roadNormal,terrain,terrainNormal,clearSky,cliff,cliffNormal,beach,pineCanopy,blossomCanopy,goldenSky]=assets.textures;
    const {car:gltf,felt,rocks:rockScan}=assets;
    draco.dispose();draco=null;startup.phase='world';
    pineCanopyTexture=pineCanopy;blossomCanopyTexture=blossomCanopy;
    for(const t of [pineCanopy,blossomCanopy]){t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());}
    surfaceTextures={road,roadNormal,terrain,terrainNormal,cliff,cliffNormal,beach};
    for(const [name,t] of Object.entries(surfaceTextures)){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());if(['road','terrain','cliff','beach'].includes(name))t.colorSpace=THREE.SRGBColorSpace;}
    for(const sky of [clearSky,goldenSky]){sky.colorSpace=THREE.SRGBColorSpace;sky.mapping=THREE.EquirectangularReflectionMapping;sky.wrapS=THREE.RepeatWrapping;}
    // End each large construction task so the loading indicator and input can
    // update between them; no partially constructed scene is exposed to play.
    startup.phase='terrain';setupSky();setupTerrain();setupWater(clearSky,goldenSky);
    mark('terrainMs');await yieldToUI();
    startup.phase='coast-city';setupCoastalScenery();
    scenery.city=buildCoastalCity(THREE,{pathX,groundHeight,roadEnd:ROAD_END});scene.add(scenery.city.group);
    mark('coastCityMs');await yieldToUI();
    startup.phase='vegetation';setupVegetation();
    mark('vegetationMs');await yieldToUI();
    // Bake the exact sky shader, including its spherical orientation and cloud
    // height, so the bodywork, sea and visible sky use the same radiance.
    startup.phase='environment';
    const pmrem=new THREE.PMREMGenerator(renderer),environmentScene=new THREE.Scene();
    const environmentSky=new THREE.Mesh(scenery.atmosphere.sky.geometry,scenery.atmosphere.sky.material);environmentScene.add(environmentSky);
    scenery.environments={};
    scenery.atmosphere.setTheme('sunset');environmentSky.rotation.copy(scenery.atmosphere.sky.rotation);sunDirection.set(.34,.115,.94).normalize();
    scenery.environments.sunset=pmrem.fromScene(environmentScene,.01,.1,5000,{size:deviceGraphics.coarsePointer?128:256});
    environmentScene.remove(environmentSky);pmrem.dispose();setupJourneyScenery(clearSky);
    mark('environmentMs');await yieldToUI();
    startup.phase='vehicles';
    scenery.rockShelves=createCoastalRocks(THREE,{source:rockScan.scene,pathX,groundHeight});scene.add(scenery.rockShelves.group);
    driverFeltTexture=felt;felt.wrapS=felt.wrapT=THREE.RepeatWrapping;felt.repeat.set(3,3);felt.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
    carTemplate=gltf.scene.children[0];car=prepareCar(carTemplate,0xaad882);wheels=car.userData.wheels;
    seatMascot(car,driverName);raceCars.set('coast',car);garageStudio=createGarageStage(scene);applyEquipment();
    // Fully modelled lightweight rivals keep the dense hero GT's detail where
    // the player actually sees it and also give traffic distinct silhouettes.
    rivals=[{mesh:buildAlternativeCar('open',{color:0x7c9fba}),s:103,offset:-3.15,speed:26.1},{mesh:buildAlternativeCar('rally',{color:0xd09970}),s:124,offset:3.1,speed:25.6}];
    rivals.forEach(r=>{r.mesh.add(shadowPlane());scene.add(r.mesh);});
    seatMascot(rivals[0].mesh,'kkamong');seatMascot(rivals[1].mesh,'marin');
    mark('worldMs');startup.phase='shaders';
    startup.parallelShaders=renderer.extensions.has('KHR_parallel_shader_compile');
    await prepareFirstFrame({
      getState:()=>[selectedStage,questionBank,$('quality').value,driverName,stage.clientWidth,stage.clientHeight,devicePixelRatio],
      prepare:()=>{
        setScenery(selectedStage.scene||'coast');
        setQuality($('quality').value);reset(false);
        updateCamera(0);
      },
      compile:async()=>{startup.compilePasses++;await renderer.compileAsync(scene,camera);mark('shadersMs');},
      render:()=>{frame();mark('firstFrameMs');},
      nextFrame:()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))
    });
    mark('readyMs');startup.phase='ready';
    ready=true;$('loading').hidden=true;$('watch').disabled=false;$('start').disabled=!isUnlocked(selectedStage);refreshStartLabel();renderStages();
    // From the hub's 'reading first' (or 'listening'), the default start runs that personalised course, not the first listening course.
    if(requestedModality&&!assignment()){const plan=nextPersonalized();if(plan?.stage)selectStage(plan.stage);}
    if(!location.hash)window.scrollTo({top:0,behavior:'instant'});
    window.addEventListener('resize',resize);new ResizeObserver(resize).observe(stage);
    renderer.setAnimationLoop(frame);
    if(new URLSearchParams(location.search).get('garage')==='1')openGarage();
  }catch(error){ready=false;startup.phase='failed';console.error(error);$('loading').hidden=true;$('error').hidden=false;window.__racingError=String(error);}
  finally{draco?.dispose();}
}

function refreshStartLabel(){
  $('start').firstChild.textContent=isUnlocked(selectedStage)?!tutorialCompleted&&!tutorialDismissed?'처음 함께 달려보기 ':`${stageSize(selectedStage)}문제 달리기 `:'이전 코스 통과 후 시작 ';
}
function clearTutorial(){
  tutorial=null;tutorialVoicePending=false;stage.classList.remove('tutorial','tutorial-done');$('tutorial-hud').hidden=true;
  if(tutorialBank){questionBank=tutorialBank;tutorialBank=null;}
  for(const id of ['left','right','go'])$(id).classList.remove('tutorial-target');
  $('go').querySelector('small').textContent='출발';$('go').setAttribute('aria-label','현재 차선으로 출발');
  rivals.forEach(r=>r.mesh.visible=true);
}
function renderTutorial(){
  if(!tutorial)return;const step=tutorial.step;
  const number=step==='steer-left'?1:step==='steer-right'?2:['listen','choose'].includes(step)?3:4;
  const copy={
    'steer-left':['왼쪽으로 움직여 봐요','← 버튼 또는 A 키'],
    'steer-right':['이번엔 오른쪽으로','→ 버튼 또는 D 키'],
    listen:['소리를 듣고 그림을 골라요','안내가 끝날 때까지 기다려 주세요'],
    choose:['사과가 있는 길로 가요','방향 버튼으로 이동 · ↑ / W로 출발'],
    'boost-ready':['정답! 부스터로 달려요','정답을 맞히면 자동으로 빨라져요'],
    boosting:['한국어가 속도가 됐어요','좋아요! 바다를 따라 달려요'],
    complete:['출발 준비 끝!',tutorialSaved?'이제 선택한 코스에서 달려봐요':'이번 화면에서는 연습 완료 · 저장이 제한돼 있어요']
  }[step];
  $('tutorial-step').textContent=step==='complete'?'조작 연습 완료':`조작 연습 · ${number} / 4`;
  $('tutorial-title').textContent=copy[0];$('tutorial-hint').textContent=copy[1];
  [...$('tutorial-hud').querySelectorAll('.tutorial-dots i')].forEach((dot,i)=>dot.classList.toggle('done',i<number));
  for(const id of ['left','right','go'])$(id).classList.toggle('tutorial-target',step==='steer-left'&&id==='left'||step==='steer-right'&&id==='right'||step==='choose'&&id==='go');
  $('go').disabled=step!=='choose'||tutorialVoicePending;
  $('go').querySelector('small').textContent='출발';
  $('go').setAttribute('aria-label','현재 차선으로 출발');
  $('tutorial-repeat').hidden=$('tutorial-skip').hidden=step==='complete';
  $('tutorial-race').hidden=$('tutorial-home').hidden=step!=='complete';
  $('tutorial-repeat').disabled=paused;
}
function tutorialSpeak(ids,text){
  if(!tutorial)return;tutorialVoicePending=soundEnabled;
  if(soundEnabled)speak(ids,text,'tutorial',true);else tutorialDelivered();
  renderTutorial();
}
function tutorialDelivered(){
  if(!tutorial||paused)return;tutorialVoicePending=false;
  if(tutorial.step==='listen'){tutorial.beginQuestion();questionChosen=false;tutorialIdle=0;}
  else if(tutorial.step==='boost-ready'&&tutorial.activateBoost()){boost=2.5;mascotMood('cheer',3);ding(true);}
  renderTutorial();
}
function repeatTutorial(){
  if(!tutorial||paused)return;
  const step=tutorial.step;
  if(step==='steer-left')tutorialSpeak(['tutorial-welcome'],'왼쪽으로 움직여 봐.');
  else if(step==='steer-right')tutorialSpeak(['tutorial-right'],'좋아! 이번엔 오른쪽.');
  else if(step==='listen'||step==='choose')tutorialSpeak(['tutorial-listen','tutorial-choices'],'잘 들어봐. 사과. 왼쪽 바나나, 가운데 포도, 오른쪽 사과. 사과 쪽으로 가 봐.');
  else if(step==='boost-ready')tutorialSpeak(['tutorial-boost'],'정답을 맞히면 자동으로 빨라져. 부스터로 달려 보자.');
}
async function startTutorial(){
  if(!ready||starting)return;if(garageOpen)garageUI.close();clearTutorial();starting=true;running=false;silence();narrationUnavailable=false;
  $('start').disabled=$('watch').disabled=$('pause').disabled=true;$('start').firstChild.textContent='연습 준비 중 ';
  if(!soundTouched){soundEnabled=true;updateSoundButton();}
  if(soundEnabled){try{await ensureAudio();await narrator.prepare(TUTORIAL_CLIPS);}catch{narrationUnavailable=true;}}
  auto=false;roundWasDemo=true;reset(true);disposeGate();tutorialBank=questionBank;
  const [apple,grape,banana]=tutorialFruits;
  questionBank=[{answer:apple.id,word:apple.word,mode:'picture',prompt:'사과의 그림을 찾아요',spoken:'사과',options:[apple.id,grape.id,banana.id]}];
  tutorial=createTutorial({answerId:apple.id});tutorialIdle=0;tutorialGoHint=false;tutorialSaved=true;
  learn(c=>{const pid=c.present(racingItem(questionBank[0]));c.help(pid,'answer');return pid;});
  starting=false;velocity=12;rivals.forEach(r=>r.mesh.visible=false);$('start').disabled=!isUnlocked(selectedStage);$('watch').disabled=false;
  stage.classList.add('tutorial');$('tutorial-hud').hidden=false;$('demo-indicator').hidden=true;
  stage.scrollIntoView({behavior:'instant',block:'start'});$('start').blur();$('tutorial-replay').blur();refreshStartLabel();repeatTutorial();clock.getDelta();
}
function beginTutorialQuestion(){
  inputs.left=inputs.right=false;laneAim=0;makeGate(0,playerS+35);gate.announced=true;mascotMood('focus');repeatTutorial();
}
function chooseTutorialLane(){
  if(!running||paused||tutorialVoicePending)return;
  if(tutorial.step!=='choose'||!gate||gate.judged)return;
  questionChosen=true;laneAim=LANES[clamp(Math.round((playerOffset+3.45)/3.45),0,2)];
}
function tutorialTap(direction){
  if(!tutorial||!running||paused)return;const step=tutorial.step;
  if(step==='steer-left'&&direction==='left'||step==='steer-right'&&direction==='right'||step==='choose'){
    laneAim=direction==='left'?3.45:-3.45;if(step==='choose')questionChosen=true;
  }
}
function finishTutorial(){
  running=false;finished=true;inputs.left=inputs.right=false;boost=0;velocity=0;stage.classList.remove('boosting');stage.classList.add('tutorial-done');silence();
  tutorialCompleted=true;try{tutorialSaved=saveTutorialCompleted(localStorage);}catch{tutorialSaved=false;}
  refreshStartLabel();tutorialSpeak(['tutorial-finish'],'좋아! 이제 레이스를 시작해 보자.');renderTutorial();
}
function updateTutorial(dt){
  elapsed+=dt;tutorialIdle+=dt;
  const step=tutorial.step,steering=(inputs.left?1:0)-(inputs.right?1:0);
  if(step==='listen')playerOffset=lerp(playerOffset,0,1-Math.exp(-dt*4));
  else if(laneAim!==null&&!steering)playerOffset=lerp(playerOffset,laneAim,1-Math.exp(-dt*4));
  else playerOffset+=steering*dt*5.8;
  playerOffset=clamp(playerOffset,-4.5,4.5);
  if(step==='steer-left'||step==='steer-right'){
    if(tutorial.observeOffset(playerOffset)){
      tutorialIdle=0;inputs.left=inputs.right=false;laneAim=null;
      if(tutorial.step==='steer-right')repeatTutorial();else beginTutorialQuestion();
      renderTutorial();
    }
  }
  const selecting=tutorial.step==='choose',waiting=tutorial.step==='listen'||selecting&&(!questionChosen||tutorialVoicePending)||tutorial.step==='boost-ready';
  const steeringStep=tutorial.step==='steer-left'||tutorial.step==='steer-right';
  const desired=waiting||steeringStep&&playerS>=205?0:tutorial.step==='boosting'?42:12;
  velocity=lerp(velocity,desired,1-Math.exp(-dt*4));
  playerS+=velocity*dt;if(steeringStep)playerS=Math.min(playerS,205);if(waiting&&gate)playerS=Math.min(playerS,gate.s-18);
  if(selecting&&gate&&playerS>=gate.s){
    const chosen=gate.types[clamp(Math.round((playerOffset+3.45)/3.45),0,2)];questionChosen=false;laneAim=null;inputs.left=inputs.right=false;
    if(tutorial.resolveAnswer(chosen)){
      disposeGate();mascotMood('cheer',3);ding(true);tutorialSpeak(['tutorial-correct','tutorial-boost'],'정답! 부스터가 충전됐어. 정답을 맞히면 자동으로 빨라져. 부스터로 달려 보자.');
    }else{
      if(playerS>ROAD_END-200){playerS=205;camera.position.copy(roadPoint(playerS-(mobile?10:7.7),playerOffset*(mobile?.92:.62),mobile?3.75:3.45));}
      makeGate(0,playerS+35);gate.announced=true;velocity=0;tutorialIdle=0;tutorialGoHint=false;ding(false);tutorialSpeak(['tutorial-retry'],'사과는 오른쪽이야. 다시 가 보자.');
    }
    renderTutorial();
  }
  if(selecting&&!questionChosen&&!tutorialVoicePending&&tutorialIdle>4&&!tutorialGoHint){tutorialGoHint=true;tutorialSpeak(['tutorial-go'],'위쪽 화살표를 눌러 출발해 봐.');}
  if(tutorial.step==='boosting'){boost=Math.max(0,boost-dt);if(tutorial.tick(dt))finishTutorial();}
  placeCar(car,playerS,playerOffset,steering*.045);car.rotation.z=-steering*.008;
  for(const wheel of wheels)wheel.rotation.x-=velocity*dt*2.3;
  for(const jet of car.userData.jets){jet.visible=boost>0;jet.scale.y=.85;}
  stage.classList.toggle('boosting',boost>0&&!reducedMotion);$('speed').textContent=Math.round(velocity*3.6);
  if(soundEnabled&&audio){motor.frequency.setTargetAtTime(45+velocity*1.8,audio.currentTime,.15);motorGain.gain.setTargetAtTime(narrator.playing?.014:running?.045:0,audio.currentTime,.12);windGain.gain.setTargetAtTime(running?velocity*(narrator.playing?.0003:.001):0,audio.currentTime,.15);}
}

function reset(play) {
  applyEquipment();shield=0;shieldBlocked=0;shieldFlash=0;if(car.userData.shield)car.userData.shield.visible=false;
  playerS=75;playerOffset=0;aimOffset=0;laneAim=null;elapsed=0;boost=0;correct=0;answers=[];gateIndex=0;velocity=cruise;finished=false;paused=false;inputs.left=inputs.right=false;
  contactTimer=0;collisions=0;combo=0;bestCombo=0;questionChosen=false;sparkLife=0;if(scenery.sparks)scenery.sparks.visible=false;stage.classList.remove('contact');$('route-level').textContent=selectedStage.campaign?`LEVEL ${selectedStage.level} · ${selectedStage.skill}`:'WORD PRACTICE · 어휘 연습';
  mascotMood('base');
  rivals.forEach((r,i)=>{r.s=103+i*21;r.offset=i===0?-3.15:3.1;placeCar(r.mesh,r.s,r.offset);});
  makeGate(0,310);placeCar(car,playerS,0);
  $('correct').textContent='0';$('nitro-fill').style.width='0%';$('progress').style.width='0%';
  $('rank').textContent='3';$('speed').textContent=String(Math.round(cruise*3.6));
  $('prompt').textContent='바다를 따라, 출발!';$('question-help').textContent='곧 문제를 소리로 들려줄게요.';
  $('course-label').textContent=selectedStage.title;$('question-kicker').textContent=selectedStage.campaign?`${selectedStage.skill} · ${questionBank.length}문제`:selectedStage.mode==='picture'?'듣고, 그림이 있는 길을 골라요':'듣고, 같은 단어가 있는 길을 골라요';
  $('question-passage').hidden=true;$('driving-note').textContent='부딪혀도 학습 점수는 그대로';$('combo').textContent='';
  $('repeat-question').disabled=true;$('time').textContent='00:00';
  $('results').hidden=true;$('pause-panel').hidden=true;$('toast').classList.remove('show');$('toast').textContent='';toastTime=0;laterToast=null;stage.classList.remove('boosting');
  $('left').classList.remove('held');$('right').classList.remove('held');
  running=play;stage.classList.toggle('playing',play);$('demo-indicator').hidden=!auto;
  $('pause').disabled=false;
  camera.position.copy(roadPoint(playerS-(mobile?12.5:7.4),mobile?-1.8:5.4,mobile?4.5:3.6));camera.lookAt(roadPoint(playerS+(mobile?14:12),mobile?3.8:1.8,1.2));
}
async function start(demo=false,bypassTutorial=false) {
  if(assignment()){if(demo){showToast('이번 목표는 직접 응답하며 연습해요.');return;}const plan=nextPersonalized();if(!plan){showToast(targetUnavailable());return;}selectedStage=plan.stage;}
  if(!ready||starting||!demo&&!isUnlocked(selectedStage))return;
  if(!demo&&!bypassTutorial&&!tutorialCompleted&&!tutorialDismissed){await startTutorial();return;}
  clearTutorial();
  if(!ready||starting||!demo&&!isUnlocked(selectedStage))return;if(garageOpen)garageUI.close();garage=loadGarageSafe();roundId=globalThis.crypto?.randomUUID?.()||`race-${Date.now()}-${Math.random().toString(36).slice(2)}`;starting=true;running=false;narrationUnavailable=false;silence();
  $('start').disabled=$('watch').disabled=$('pause').disabled=true;$('start').firstChild.textContent='음성 준비 중 ';
  if(!soundTouched){soundEnabled=true;updateSoundButton();}
  if(soundEnabled){try{await ensureAudio();await narrator.prepare([...commonClips,...stageClips(selectedStage)]);}catch{narrationUnavailable=true;}}
  auto=demo;roundWasDemo=demo;questionBank=makeQuestions(selectedStage);starting=false;const opening=startLive();
  $('start').disabled=!isUnlocked(selectedStage);$('watch').disabled=!!assignment();$('start').firstChild.textContent=`${questionBank.length}문제 달리기 `;
  reset(true);stage.scrollIntoView({behavior:'auto',block:'start'});
  $('start').blur();$('watch').blur();
  speak(['intro'],'출발! 문제를 듣고 길을 골라줘.','intro');if(opening)showToast(opening,2.6);
  clock.getDelta();
}
function showToast(message,seconds=2.5){$('toast').textContent=message;$('toast').classList.add('show');toastTime=seconds;}
async function ensureAudio() {
  if(!soundEnabled)return;
  const AudioContext=window.AudioContext||window.webkitAudioContext;if(!AudioContext)return;
  if(!audio){
    audio=new AudioContext();motor=audio.createOscillator();motor.type='sawtooth';motor.frequency.value=65;
    const filter=audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=330;motorGain=audio.createGain();motorGain.gain.value=0;motor.connect(filter);filter.connect(motorGain);motorGain.connect(audio.destination);motor.start();
    const buffer=audio.createBuffer(1,audio.sampleRate*2,audio.sampleRate);const data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.25;
    const wind=audio.createBufferSource();wind.buffer=buffer;wind.loop=true;const wf=audio.createBiquadFilter();wf.type='lowpass';wf.frequency.value=750;windGain=audio.createGain();windGain.gain.value=0;wind.connect(wf);wf.connect(windGain);windGain.connect(audio.destination);wind.start();
  }
  if(audio.state==='suspended')await audio.resume();
}
function ding(success){
  if(!audio||!soundEnabled)return;
  for(let i=0;i<(success?3:1);i++){
    const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime+i*.07;o.type='sine';o.frequency.value=success?[659,830,988][i]:440;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.07,t+.008);g.gain.exponentialRampToValueAtTime(.001,t+.24);o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+.25);
  }
}
function silence(){narrator.cancel();if(audio){motorGain.gain.setTargetAtTime(0,audio.currentTime,.06);windGain.gain.setTargetAtTime(0,audio.currentTime,.06);}}
function pause(){if(!running||paused)return;paused=true;$('pause-panel').hidden=false;inputs.left=inputs.right=false;silence();tutorialVoicePending=false;$('repeat-question').disabled=true;}
function resume(){paused=false;$('pause-panel').hidden=true;clock.getDelta();$('resume').blur();stage.scrollIntoView({behavior:'instant',block:'start'});if(tutorial){repeatTutorial();return;}if(gate&&gate.announced&&!gate.judged){$('repeat-question').disabled=false;if(gate.heard&&gate.presentationId)learn(c=>c.help(gate.presentationId,'replay'));narrateQuestion();}}
function home(){if(!ready)return;running=false;auto=false;silence();endLive();clearTutorial();reset(false);refreshStartLabel();renderStages();stage.scrollIntoView({behavior:'auto',block:'start'});}
function finish(){
  if(tutorial)return;
  running=false;finished=true;inputs.left=inputs.right=false;stage.classList.remove('boosting');silence();const flowEnd=endLive();
  const rank=1+rivals.filter(r=>r.s>playerS).length;
  $('result-correct').textContent=`${correct}/${answers.length}`;$('result-boost').textContent=correct;$('result-rank').textContent=rank;
  $('word-list').replaceChildren();
  for(const q of questionBank){const b=document.createElement('button');b.textContent=`${q.word} ◖`;b.setAttribute('aria-label',`${q.word} 발음 듣기`);b.addEventListener('click',async()=>{if(!soundEnabled){soundEnabled=true;soundTouched=true;updateSoundButton();}await ensureAudio();speak(q.answerAudio||[q.answer],q.word,'word',true);});$('word-list').appendChild(b);}
  $('result-medal').textContent=roundWasDemo?'미리보기 · 기록 없이 체험':`${'◆'.repeat(medalFor(correct,questionBank.length))||'다시 도전'} ${correct===questionBank.length?'퍼펙트':correct>=Math.ceil(questionBank.length*.8)?'코스 통과':'조금씩 더 익숙하게'} · ${collisions===0?'안전 주행':`접촉 ${collisions}회`} · 최고 ${bestCombo}콤보`;
  $('answer-review').replaceChildren();for(const a of answers){const q=questionBank.find(q=>q.id===a.id||!q.id&&q.answer===a.answer),row=document.createElement('div'),title=document.createElement('strong'),body=document.createElement('p');title.textContent=`${a.correct?'✓':'↻'} ${q.word}`;body.textContent=q.explanation||`정답 단어: ${q.word}`;row.append(title,body);$('answer-review').appendChild(row);}
  const earned=awardRace(loadGarageSafe(),selectedStage,answers,{automatic:roundWasDemo,beforeProgress:progress,roundId});
  if(!roundWasDemo)storeGarage(earned.state);
  $('result-rewards').replaceChildren();const rewardTitle=document.createElement('strong'),rewardNote=document.createElement('p');rewardTitle.textContent=roundWasDemo?'자동 시연 · 코인 보상 없이 체험':earned.coins?`+${earned.coins}코인 · 오늘의 여행 보상`:'오늘의 반복 완주 보상을 모두 받았어요';rewardNote.textContent=roundWasDemo?'직접 완주하면 차량과 꾸미기를 모을 수 있어요.':earned.breakdown.map(b=>`${b.label} +${b.coins}`).join(' · ');$('result-rewards').append(rewardTitle,rewardNote);
  if(earned.newUnlocks.length){const unlocked=document.createElement('p');unlocked.textContent=`새 컬렉션! ${earned.newUnlocks.map(id=>SHOP_ITEMS.find(i=>i.id===id)?.name).join(' · ')}`;$('result-rewards').append(unlocked);}
  if(!roundWasDemo&&wishText()){const wish=document.createElement('p');wish.textContent=wishText();$('result-rewards').append(wish);}
  progress=recordRound(progress,selectedStage,answers,{automatic:roundWasDemo,collisions});
  let saved=true;if(!roundWasDemo)try{localStorage.setItem(PROGRESS_KEY,JSON.stringify(progress));}catch{saved=false;}
  renderStages();$('result-stage').textContent=labelStage(selectedStage);
  $('result-note').textContent=roundWasDemo?'자동 시연은 기록·메달·코스 개방에 포함하지 않아요. 직접 달려서 도전해 보세요.':`${correct>=Math.ceil(questionBank.length*.8)?'코스 통과! ':`다음엔 ${questionBank.length}문제 중 ${Math.ceil(questionBank.length*.8)}문제를 맞혀보세요. `}${saved?'직접 플레이한 학습 기록은 이 브라우저에 저장해요.':'브라우저 저장이 제한되어 이번 화면에서만 기록을 볼 수 있어요.'}`;
  if(!roundWasDemo)$('result-note').textContent+=` 도움·반복·조작 영향을 제외한 새 응답 ${answers.filter(a=>a.learning?.independent).length}개를 맞춤 추천에 참고해요. ${learningScope()}`;
  const tuned=roundWasDemo?[]:describeRace(flowStart,flowEnd?.settings?.values);if(tuned.length)$('result-note').textContent+=` 이번 주행에서 맞춘 것: ${tuned.join(' · ')}.`;
  const next=nextStage();$('next-stage').disabled=!next||!roundWasDemo&&!isUnlocked(next);$('next-stage').firstChild.textContent=next?.finale?'챕터 결승전 달리기 ':next?.personalized?'맞춤 5문항 달리기 ':next?'다음 코스 달리기 ':'마지막 코스예요 ';$('results').hidden=false;speak(['finish'],'완주! 오늘 만난 단어를 다시 들어볼까?','finish');
  if(!roundWasDemo&&earned.coins)speak([earned.newUnlocks.length?'finale-unlock':earned.missionCompleted?'mission-complete':garage.wish?'garage-wish':'garage-earned'],'오늘의 보상을 받았어. 차고에서 확인해 봐!','reward');
}
function nextStage(){if(selectedStage.personalized)return nextPersonalized()?.stage||recommendedStage(progress);if(selectedStage.review)return selectedStage.campaign?recommendedStage(progress):STAGES[0];const collection=selectedStage.campaign?ALL_COURSES:STAGES;return collection[collection.findIndex(s=>s.id===selectedStage.id)+1]||(selectedStage.campaign?nextPersonalized()?.stage||recommendedStage(progress):null);}
function judgeGate(){
  if(!gate||gate.judged)return;
  const lane=clamp(Math.round((playerOffset+3.45)/3.45),0,2),chosen=gate.types[lane],success=chosen===gate.q.answer;
  if(gate.presentationId&&!roundWasDemo){const assessable=gate.intentChoice===chosen;gate.learning=answerGate(gate.presentationId,{correct:success,assessable,reason:assessable?undefined:'motor'},assessable?{pressure:racePressure({readyAt:gate.readyAt,choseAt:gate.choseAt,cruise,campaign:!!selectedStage.campaign,roadLeft:gate.readyRoad})}:{outcome:'void'});}
  gate.judged=true;answers.push({id:gate.q.id,prompt:gate.q.prompt,answer:gate.q.answer,chosen,correct:success,learning:gate.learning});$('repeat-question').disabled=true;$('go').disabled=true;$('question-toggle').disabled=true;setQuestionExpanded(false);$('voice-caption').hidden=true;$('lane-choices').hidden=true;laneAim=null;
  if(success){correct++;combo++;bestCombo=Math.max(bestCombo,combo);boost=combo>=3?3.4:2.8;mascotMood('cheer',3);showToast(`${combo>=3?`${combo}콤보 · `:'정답! '}${gate.q.word} · 부스터 ↗`);speak(['correct',...(gate.q.answerAudio||[gate.q.answer]),'boost'],`맞았어! ${gate.q.word}. ${gate.q.explanation||''} 부스터!`,'feedback');ding(true);}
  else{combo=0;showToast(`${gate.q.word} · 이유를 듣고 다시 도전`,3);speak(['answer',...(gate.q.answerAudio||[gate.q.answer]),'retry'],`정답은 ${gate.q.word}. ${gate.q.explanation||''}`,'feedback');ding(false);}
  shield=comboShield(combo,success,shield);
  if(success&&combo%3===0){showToast(`${combo}콤보! 다음 접촉을 막는 보호막이 생겼어요`,3);speak(['shield-ready'],'연속 정답! 보호막이 생겼어.','reward');}
  $('combo').textContent=`${combo>=2?`${combo} COMBO`:''}${shield?' · ◇ 보호막':''}`;
  $('correct').textContent=correct;$('prompt').textContent=success?`${gate.q.word}, 정확해!`:`정답은 ${gate.q.word}예요 ${WORD_BY_ID[gate.q.answer].icon||''}`;
  $('question-help').textContent=gate.q.explanation||(success?'정답 부스터로 앞차를 따라잡아요.':'소리와 그림을 기억하고, 계속 달려요.');
  if(gate.presentationId)learn(c=>c.help(gate.presentationId,'answer'));
}
function contactSound(){if(!audio||!soundEnabled)return;const source=audio.createBufferSource(),buffer=audio.createBuffer(1,4800,audio.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/600);source.buffer=buffer;const filter=audio.createBiquadFilter(),gain=audio.createGain();filter.type='lowpass';filter.frequency.value=680;gain.gain.value=narrator.playing?.022:.11;source.connect(filter);filter.connect(gain);gain.connect(audio.destination);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};source.start();}
function contactSparks(hit){
 if(reducedMotion)return;if(!scenery.sparks){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(24*3),3));scenery.sparks=new THREE.Points(geo,new THREE.PointsMaterial({color:0xffdaa0,size:.075,transparent:true,opacity:.75,depthWrite:false}));scene.add(scenery.sparks);}
 const origin=roadPoint(playerS,playerOffset-hit.direction*.7,.5),positions=scenery.sparks.geometry.attributes.position;
 scenery.sparks.userData.motion=[];for(let i=0;i<24;i++){positions.setXYZ(i,origin.x,origin.y,origin.z);scenery.sparks.userData.motion.push({x:(Math.random()-.5)*3,y:Math.random()*2.2,z:-Math.random()*6});}positions.needsUpdate=true;scenery.sparks.visible=true;sparkLife=.42;
}
function updateContacts(dt,waiting){
  contactTimer=Math.max(0,contactTimer-dt);
  if(!waiting)for(const r of rivals){const p={s:playerS,offset:playerOffset,velocity};const hit=resolveContact(p,r);if(!hit)continue;playerS=p.s;playerOffset=p.offset;
    if(contactTimer===0){
      const effect=shieldContact({shield,collisions,velocity,boost},hit);({shield,collisions,velocity,boost}=effect);
      if(effect.protected){shieldBlocked++;shieldFlash=.8;contactTimer=.45;$('driving-note').textContent='보호막이 접촉을 막았어요';$('combo').textContent=combo>=2?`${combo} COMBO`:'';showToast('보호막! 속도를 지켰어요',2);speak(['shield-block'],'보호막으로 속도를 지켰어.','reward');}
      else{contactTimer=.85;$('driving-note').textContent='접촉 · 속도를 회복해요';contactSound();contactSparks(hit);}
    }
  }
  stage.classList.toggle('contact',contactTimer>.53&&!reducedMotion);if(contactTimer===0)$('driving-note').textContent=collisions?`접촉 ${collisions}회 · 학습 점수는 그대로`:'안전 주행 중';
}
function updateShield(dt){
  shieldFlash=Math.max(0,shieldFlash-dt);if(!shield&&!shieldFlash&&!car.userData.shield)return;
  if(!car.userData.shield){const ring=new THREE.Mesh(new THREE.TorusGeometry(1.32,.035,5,64),new THREE.MeshBasicMaterial({color:0x9ff4e5,transparent:true,opacity:.65,depthWrite:false}));ring.rotation.x=Math.PI/2;ring.scale.y=1.95;ring.position.y=.2;car.add(ring);car.userData.shield=ring;}
  const ring=car.userData.shield;ring.visible=running&&Boolean(shield||shieldFlash);ring.material.opacity=shieldFlash?shieldFlash*.9:.3+(reducedMotion?0:Math.sin(worldTime.value*2.4)*.1);
}
function updateGame(dt) {
  elapsed+=dt;
  if(gate?.announced&&(inputs.left||inputs.right))questionChosen=true;
  if(auto&&gate&&gate.announced&&!gate.judged)aimOffset=LANES[gate.types.indexOf(gate.q.answer)];
  else if(auto)aimOffset=0;
  if(auto)playerOffset=lerp(playerOffset,aimOffset,1-Math.exp(-dt*2.6));
  // The chase camera looks toward +Z, so screen-right is world -X.
  else if(laneAim!==null&&!inputs.left&&!inputs.right)playerOffset=lerp(playerOffset,laneAim,1-Math.exp(-dt*4));
  else playerOffset+=((inputs.left?1:0)-(inputs.right?1:0))*dt*5.8;
  playerOffset=clamp(playerOffset,-5.05,5.05);
  if(boost>0)boost=Math.max(0,boost-dt);
  // Leave time to hear the entire word, including when the player asks to hear it again.
  const hearing=gate?.announced&&!gate.judged&&(narrator.activeKind==='question'||narrator.queue.some(item=>item.kind==='question'));
  const waitingForVoice=hearing&&gate.s-playerS<65;
  const waitingForChoice=selectedStage.campaign&&gate?.announced&&!gate.judged&&!auto&&!questionChosen&&gate.s-playerS<65;
  const waiting=waitingForVoice||waitingForChoice||questionExpanded;
  const edge=Math.abs(playerOffset)>4.95,pace=cruise/BASE_CRUISE,desired=waiting?0:contactTimer>.5?22*pace:edge?21*pace:boost>0?42*pace:cruise;
  velocity=lerp(velocity,desired,1-Math.exp(-dt*2.4));playerS+=velocity*dt;
  for(const r of rivals){r.s+=r.speed*dt*(waiting?0:1);
    if(gate&&!gate.judged&&gate.s-playerS<100&&Math.abs(r.s-playerS)<25){const safe=LANES.find(o=>Math.abs(o-playerOffset)>2.5&&!rivals.some(other=>other!==r&&Math.abs(other.s-r.s)<7&&Math.abs(o-other.offset)<2));if(safe!==undefined)r.offset=lerp(r.offset,safe,1-Math.exp(-dt*3));}
  }
  const rivalBody={s:rivals[0].s,offset:rivals[0].offset,velocity:rivals[0].speed};resolveContact(rivalBody,rivals[1]);rivals[0].s=rivalBody.s;rivals[0].offset=rivalBody.offset;
  updateContacts(dt,waiting);for(const r of rivals){placeCar(r.mesh,r.s,r.offset);for(const w of r.mesh.userData.wheels)w.rotation.x-=r.speed*dt*2.2;}
  const steering=(inputs.left?1:0)-(inputs.right?1:0),yaw=(auto?clamp(aimOffset-playerOffset,-1,1):steering)*.045;
  placeCar(car,playerS,playerOffset,yaw);car.rotation.z=-steering*.008;car.position.y+=Math.sin(elapsed*31)*.003;
  for(const w of wheels)w.rotation.x-=velocity*dt*2.3;
  for(const jet of car.userData.jets){jet.visible=boost>0;jet.scale.y=.6+Math.random()*.5;}
  if(gate){
    const distance=gate.s-playerS;
    if(!gate.announced&&distance<220&&elapsed>=3){gate.announced=true;$('question-kicker').textContent=`${gate.q.mode==='reading'?'읽고 길을 골라요':gate.q.mode==='picture'?'듣고 그림을 골라요':'듣고 길을 골라요'} · ${gateIndex+1}/${questionBank.length}`;gate.presentationId=presentGate(gate.q);if(gate.q.mode==='reading'||!soundEnabled||narrationUnavailable)questionReady();if(roundWasDemo&&gate.presentationId)learn(c=>c.help(gate.presentationId,'answer'));mascotMood('focus');$('repeat-question').disabled=false;$('go').disabled=false;$('question-toggle').disabled=false;$('lane-choices').hidden=false;narrateQuestion();}
    if(distance<0&&!gate.judged)judgeGate();
    if(distance<-15){gateIndex++;if(gateIndex<questionBank.length)makeGate(gateIndex,gate.s+245);else disposeGate();}
  }
  stage.classList.toggle('boosting',boost>0&&!reducedMotion);
  $('speed').textContent=Math.round(velocity*3.6);$('nitro-fill').style.width=`${Math.min(100,boost/2.8*100)}%`;$('nitro-label').textContent=waitingForChoice?'길을 골라 출발':boost>0?'KOREAN → BOOST':'LISTEN. CHOOSE. BOOST.';
  $('rank').textContent=1+rivals.filter(r=>r.s>playerS).length;
  const seconds=Math.floor(elapsed);$('time').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;$('progress').style.width=`${Math.min(100,(playerS-75)/(310+(questionBank.length-1)*245+85-75)*100)}%`;
  if(soundEnabled&&audio){const kind=car.userData.vehicleKind;motor.frequency.setTargetAtTime((kind==='rally'?32:kind==='open'||kind==='finale'?55:45)+velocity*1.8,audio.currentTime,.15);motorGain.gain.setTargetAtTime(narrator.playing?.014:.055+(boost>0?.012:0),audio.currentTime,.12);windGain.gain.setTargetAtTime(velocity*(narrator.playing?.0003:.0015),audio.currentTime,.15);}
  if(answers.length===questionBank.length&&playerS>310+(questionBank.length-1)*245+85&&!narrator.playing)finish();
}
function updateCamera(dt) {
  light.target.position.copy(roadPoint(garageOpen?93:playerS+18,0,0));light.position.copy(light.target.position).addScaledVector(sunDirection,151);
  if(garageOpen){
    const center=garageStudio.group.position.clone().add(new THREE.Vector3(0,.78,0)),rect=$('garage-preview').getBoundingClientRect(),bounds=stage.getBoundingClientRect(),w=stage.clientWidth,h=stage.clientHeight;
    const distance=mobile?Math.max(9.3,h*4.8/(2*Math.tan(THREE.MathUtils.degToRad(26))*rect.width*.82)):8.4;camera.position.copy(center).add(new THREE.Vector3(Math.sin(garageAngle)*distance,3.05,Math.cos(garageAngle)*distance));camera.lookAt(center);camera.fov=mobile?52:43;
    camera.setViewOffset(w,h,w/2-(rect.left-bounds.left+rect.width/2),h/2-(rect.top-bounds.top+rect.height/2+(mobile?15:0)),w,h);camera.updateProjectionMatrix();return;
  }
  let pos,target,fov;
  if(running||finished){
    const shortPortrait=mobile&&stage.clientHeight<640;
    pos=roadPoint(playerS-(mobile?(shortPortrait?11.2:8.8):9),playerOffset*(mobile?.92:.62),(mobile?3.35:3.6));target=roadPoint(playerS+24,playerOffset*(mobile?.72:.34),shortPortrait?1.1:1.55);fov=boost>0&&!reducedMotion?61:mobile?(shortPortrait?60:58):55;
  }else{
    const drift=reducedMotion?0:Math.sin(attractTime*.14)*.65;
    pos=roadPoint(playerS-(mobile?12.5:7.4),mobile?-1.8:5.4+drift,mobile?4.5:3.6);target=roadPoint(playerS+(mobile?14:12),mobile?3.8:1.8,1.2);fov=mobile?62:52;
  }
  camera.position.lerp(pos,1-Math.exp(-dt*5));camera.lookAt(target);camera.fov=lerp(camera.fov,fov,1-Math.exp(-dt*3));camera.updateProjectionMatrix();
  if(contactTimer>0&&!reducedMotion)camera.rotation.z+=Math.sin(contactTimer*30)*contactTimer*.014;
}
function frame() {
  const raw=clock.getDelta(),dt=Math.min(raw,.055);
  // Startup still submits its required first frame before publishing ready.
  if(!pausedFrameGate.shouldRender({paused,hidden:ready&&document.hidden,dt,state:paused?[mode,renderQuality.pixelRatio,stage.clientWidth,stage.clientHeight,driverName,car,scenery.theme]:[]})){
    if(paused&&!document.hidden)skippedPausedFrames++;
    return;
  }
  warmupFrames++;
  if(!paused){
    worldTime.value+=dt;attractTime+=dt;
    if(scenery.sky)scenery.sky.position.copy(roadPoint(playerS));
    if(scenery.petals&&!reducedMotion){scenery.petals.position.copy(roadPoint(playerS,0,0));scenery.petals.rotation.y=Math.sin(worldTime.value*.1)*.12;}
    for(const rotor of windRotors)if(!reducedMotion)rotor.rotation.z+=dt*.16;
    if(sparkLife>0){sparkLife=Math.max(0,sparkLife-dt);const positions=scenery.sparks.geometry.attributes.position;scenery.sparks.userData.motion.forEach((v,i)=>{v.y-=dt*4;positions.setXYZ(i,positions.getX(i)+v.x*dt,positions.getY(i)+v.y*dt,positions.getZ(i)+v.z*dt);});positions.needsUpdate=true;scenery.sparks.material.opacity=sparkLife/.42*.75;scenery.sparks.visible=sparkLife>0;}
    if(running){if(tutorial)updateTutorial(dt);else updateGame(dt);}
    else if(!garageOpen&&!finished&&!reducedMotion){playerS+=dt*4.5;if(playerS>185){playerS=75;rivals.forEach((r,i)=>r.s=103+i*21);}placeCar(car,playerS,0);for(const w of wheels)w.rotation.x-=dt*10;rivals.forEach((r,i)=>{r.s=playerS+28+i*21;placeCar(r.mesh,r.s,r.offset);});}
    if(gate)gate.fruitObjects.forEach((f,i)=>{f.rotation.y=(f.userData.spinBase||0)+Math.sin(worldTime.value*.9+i)*.11;});
    updateMascot(dt);updateShield(dt);
    updateCamera(dt);
    if(toastTime>0){toastTime-=dt;if(toastTime<=0)$('toast').classList.remove('show');}
    else if(laterToast&&running){const text=laterToast;laterToast=null;showToast(text,2.6);}
  }else updateCamera(dt);
    scenery.details?.update({time:worldTime.value,playerS,motion:!reducedMotion,detailDistance:renderQuality.detailDistance,quality:mode});
    scenery.terrain?.update({playerS:garageOpen?93:playerS,quality:mode,camera});
    scenery.rockShelves?.update({playerS,quality:mode,camera});
    scenery.boats?.update({dt,time:worldTime.value,playerS,quality:mode,camera,paused:paused||garageOpen||document.hidden,motion:!reducedMotion});
    scenery.city?.update({playerS:garageOpen?93:playerS,quality:mode,camera,time:worldTime.value});
    scenery.cityLife?.update({time:worldTime.value,playerS:garageOpen?93:playerS,playerX:car?.position.x??pathX(playerS),quality:mode,camera,motion:!reducedMotion,paused:paused||garageOpen||document.hidden,celebrating:running&&boost>0});
  renderer.render(scene,camera);
  renderedFrames++;
  if(!paused&&!document.hidden&&warmupFrames>35&&raw<.3){frameSample.push(raw);if(frameSample.length>120)frameSample.shift();renderFrames++;renderTotal+=raw;adaptiveTime+=raw;}
  if(currentQuality==='auto'&&mode!=='low'&&adaptiveTime>7&&frameSample.length>90){const average=frameSample.reduce((a,b)=>a+b,0)/frameSample.length;const next=slowerQuality(mode,average);if(next!==mode){mode=next;applyRenderQuality();frameSample=[];}adaptiveTime=0;}
}

function updateSoundButton(){
  $('sound').setAttribute('aria-pressed',String(soundEnabled));$('sound').setAttribute('aria-label',soundEnabled?'소리 끄기':'소리 켜기');
  $('sound-waves').setAttribute('d',soundEnabled?'M16 8a6 6 0 0 1 0 8M19 5a10 10 0 0 1 0 14':'m16 9 5 6m0-6-5 6');
}
async function toggleSound(){
  soundTouched=true;soundEnabled=!soundEnabled;updateSoundButton();
  if(tutorial){silence();tutorialVoicePending=false;if(soundEnabled){await ensureAudio();if(running&&!paused)repeatTutorial();}else tutorialDelivered();renderTutorial();return;}
  if(soundEnabled){await ensureAudio();setQuestionExpanded(false);if(running&&!paused&&gate?.announced&&!gate.judged)narrateQuestion();}else{silence();displayQuestion();}
  if(!running)renderStages();
}
$('start').addEventListener('click',()=>start(false));$('watch').addEventListener('click',()=>start(true));$('replay').addEventListener('click',()=>start(auto));$('home').addEventListener('click',home);$('exit').addEventListener('click',home);$('pause').addEventListener('click',pause);$('resume').addEventListener('click',resume);$('sound').addEventListener('click',toggleSound);$('quality').addEventListener('change',e=>setQuality(e.target.value));$('card-play').addEventListener('click',()=>start(false));
$('nav-garage').addEventListener('click',openGarage);$('result-garage').addEventListener('click',openGarage);$('records-garage').addEventListener('click',openGarage);
$('nav-race').addEventListener('click',()=>{if(garageOpen)garageUI.close();home();});
$('nav-records').addEventListener('click',()=>{if(garageOpen)garageUI.close();renderCollection();$('records').scrollIntoView({behavior:'smooth',block:'start'});});
for(const [id,game] of [['runner-play','runner'],['rhythm-play','rhythm'],['runner-card-play','runner'],['rhythm-card-play','rhythm']])$(id).href=location.pathname.startsWith('/korean-racing/')?`/korean-${game}/`:new URL(`./play/${game}/`,location.href).href;
window.addEventListener('storage',e=>{if(e.key==='SYNK_PLAY_COLLECTION_V1'){garage=loadGarageSafe();renderCollection();if(garageOpen){garageUI.render();previewEquipment(garageUI.previewItem);}}});
$('repeat-question').addEventListener('click',async()=>{if(!running||paused||gate?.judged)return;if(!soundEnabled){soundEnabled=true;soundTouched=true;updateSoundButton();setQuestionExpanded(false);}await ensureAudio();narrateQuestion(true);});
$('subtitles').addEventListener('change',displayQuestion);
$('question-toggle').addEventListener('click',()=>{if(!running||paused||!gate?.announced||gate.judged)return;setQuestionExpanded(!questionExpanded);});
$('question-close').addEventListener('click',()=>setQuestionExpanded(false));
$('go').addEventListener('click',chooseCurrentLane);
$('tutorial-replay').addEventListener('click',startTutorial);
$('tutorial-repeat').addEventListener('click',async()=>{if(!tutorial||paused)return;if(!soundEnabled){soundEnabled=true;soundTouched=true;updateSoundButton();}await ensureAudio();repeatTutorial();});
function continueAfterTutorial(){if(!isUnlocked(selectedStage))selectStage(recommendedStage(progress));silence();start(false,true);}
$('tutorial-skip').addEventListener('click',()=>{if(!tutorial)return;tutorialDismissed=true;continueAfterTutorial();});
$('tutorial-race').addEventListener('click',continueAfterTutorial);
$('tutorial-home').addEventListener('click',home);
for(const id of ['stage-filter','stage-search'])$(id).addEventListener(id==='stage-filter'?'change':'input',()=>{stagePage=0;renderStages();});
$('stage-prev').addEventListener('click',()=>{stagePage--;renderStages();});$('stage-next').addEventListener('click',()=>{stagePage++;renderStages();});
$('review-stage').addEventListener('click',()=>{const s=reviewStage(progress,activeCollection);if(s)selectStage(s);});
$('next-stage').addEventListener('click',()=>{const next=nextStage();if(next){const demo=roundWasDemo;selectStage(next);start(demo);}});
$('journey-next').addEventListener('click',()=>{if(!ready||starting)return;const personal=nextPersonalized();if(requestedModality&&!personal){showToast('맞춤 문항을 준비하지 못했어요. 소리 설정과 연결 상태를 확인해 주세요.');return;}requestedModality=null;activeCollection='campaign';stagePage=0;$('stage-filter').hidden=true;$('collection-campaign').setAttribute('aria-pressed','true');$('collection-words').setAttribute('aria-pressed','false');selectStage(personal?.stage||recommendedStage(progress));start(false);});
$('reset-learning').hidden=hosted;
$('reset-learning').addEventListener('click',()=>{
  // Only a reset that happened says so. An account record is deleted in WORLD, and that refusal is not a failure of learning.
  let message='학습 기록을 지우지 못했어요. 다시 시도해 주세요.';
  try{const result=coach?.reset();if(result?.storage?.available)message='이 기기의 공통 맞춤 학습 기록을 지웠어요.';}
  catch(error){if(error?.code==='ACCOUNT_RESET_REQUIRED')message='계정의 학습 기록은 WORLD 계정 설정에서 관리해 주세요.';else learningAvailable=false;}
  renderStages();showToast(message);
});
for(const kind of ['campaign','words'])$('collection-'+kind).addEventListener('click',()=>{activeCollection=kind;stagePage=0;$('stage-filter').hidden=kind==='campaign';for(const k of ['campaign','words'])$('collection-'+k).setAttribute('aria-pressed',String(k===kind));renderStages();});
for(const name of ['marin','kkamong'])$('driver-'+name).addEventListener('click',()=>selectDriver(name));
for(const direction of ['left','right']){
  const b=$(direction);b.addEventListener('pointerdown',e=>{if(!running||paused)return;e.preventDefault();if(gate?.announced)questionChosen=true;laneAim=null;auto=false;$('demo-indicator').hidden=true;inputs[direction]=true;b.classList.add('held');b.setPointerCapture(e.pointerId);});
  const release=e=>{inputs[direction]=false;if(e.type==='pointerup')tutorialTap(direction);b.classList.remove('held');};b.addEventListener('pointerup',release);b.addEventListener('pointercancel',release);b.addEventListener('lostpointercapture',release);
}
window.addEventListener('keydown',e=>{
  if(e.target instanceof HTMLSelectElement||e.target instanceof HTMLInputElement)return;
  if(e.code==='Escape'){if(garageOpen)garageUI.close();else if(running)paused?resume():pause();return;}
  if(['ArrowUp','KeyW'].includes(e.code)&&running&&!paused){e.preventDefault();if(!e.repeat)chooseCurrentLane();return;}
  const direction=['ArrowLeft','KeyA'].includes(e.code)?'left':['ArrowRight','KeyD'].includes(e.code)?'right':null;
  if(direction&&running&&!paused){e.preventDefault();if(gate?.announced)questionChosen=true;laneAim=null;auto=false;$('demo-indicator').hidden=true;inputs[direction]=true;}
});
window.addEventListener('keyup',e=>{if(['ArrowLeft','KeyA'].includes(e.code)){inputs.left=false;tutorialTap('left');}if(['ArrowRight','KeyD'].includes(e.code)){inputs.right=false;tutorialTap('right');}});
window.addEventListener('blur',()=>{inputs.left=inputs.right=false;if(running&&!paused)pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&running&&!paused)pause();});
// Read-only telemetry makes verification reproducible without a hidden game bypass.
window.__racing={snapshot:()=>({ready,startup:{...startup},running,paused,auto,roundWasDemo,elapsed,playerS,playerOffset,tutorial:tutorial?{step:tutorial.step,mistakes:tutorial.mistakes,boostElapsed:tutorial.boostElapsed,voicePending:tutorialVoicePending,completed:tutorialCompleted,saved:tutorialSaved}:null,collection:{coins:garage.coins,owned:[...garage.owned],equipped:{...garage.equipped},wish:garage.wish,mission:dailyMission(progress,Date.now(),garage),garageOpen,preview:previewCar?.userData.vehicleKind,angle:garageAngle},driving:{collisions,contactTimer,combo,bestCombo,shield,shieldBlocked,rivals:rivals.map(r=>({s:r.s,offset:r.offset})),waitingForChoice:questionChosen===false},scenery:scenery.theme,atmosphere:scenery.atmosphere?.stats,boats:scenery.boats?.stats,boatPoses:scenery.boats?.group.userData.poseSnapshots,rockShelves:scenery.rockShelves?.stats,landscape:scenery.coast?.userData.stats,city:scenery.city?.stats,cityLife:scenery.cityLife?.stats,groundProps:scenery.groundProps,terrain:scenery.terrain?.stats,vegetation:scenery.details?.stats,screenX:car?+car.position.clone().project(camera).x.toFixed(4):null,driver:{name:driverName,mood:driverMood,seated:!!car?.userData.mascot},vehicle:car?.userData.modelStats,velocity,boost,correct,answers:answers.map(a=>({...a})),flow:{cruise,active:!!live,values:(()=>{try{return live?live.settings().values:null;}catch{return null;}})()},stage:{id:selectedStage.id,title:selectedStage.title,mode:selectedStage.mode,level:selectedStage.level,campaign:selectedStage.campaign,words:selectedStage.words},gate:gate?{s:gate.s,prompt:gate.q.prompt,spoken:gate.q.spoken,types:[...gate.types],questionId:gate.q.id,announced:gate.announced}:null,quality:mode,narration:narrator.snapshot(),audioState:audio?.state,audioClock:audio?.currentTime,narrationUnavailable,learning:{words:Object.keys(progress.words).length,correctWords:Object.values(progress.words).filter(p=>p.correct>0).length,rounds:progress.rounds,cleared:Object.values(progress.stages).filter(p=>p.cleared).length},render:{renderedFrames,skippedPausedFrames,programs:renderer?.info.programs?.length,pixelRatio:renderer?.getPixelRatio(),calls:renderer?.info.render.calls,triangles:renderer?.info.render.triangles,geometries:renderer?.info.memory.geometries,textures:renderer?.info.memory.textures,averageFps:frameSample.length?+(frameSample.length/frameSample.reduce((a,b)=>a+b,0)).toFixed(1):0},viewport:{width:stage.clientWidth,height:stage.clientHeight}})};
renderStages();
init();
