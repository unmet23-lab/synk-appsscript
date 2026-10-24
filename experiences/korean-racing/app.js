// 레이싱 — 화면과 3D를 잇는 곳: 시작·연습·입구·공통 차고 연결, 3D 준비와 카메라, 엔진 소리, 입력.
// 한 판 진행(상태·문제·판정·완주 뒤 드라이브·결과·소리 켜고 끄기): race-controller.js. 여기서는 그 상태를 round로 읽는다.
// 화면 그리기: lobby.js(입구)·hud.js(레이스 위 카드·꼬리표)·results.js(결과)·garage-ui.js(공통 차고)·screens.js(화면 바꾸기).
// 3D 세계: world-build.js(풍경)·race-gate.js(문제 게이트)·race-car.js(내 차). 다른 게임 링크: links.js. 확인용 관찰: qa-hook.js(?qa).
// 시험(tests/graphics)이 이 파일에서 화질·크기 함수 원문을 꺼내 가짜 화면으로 돌린다.
// 그래서 그 함수는 줄 맨 앞의 `function 이름(` 선언으로 두고, 여러 줄이면 닫는 괄호를 줄 맨 앞에 둔다(첫 줄은 `}`로 끝내지 않는다).
import * as THREE from 'three';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { DRACOLoader } from './vendor/DRACOLoader.js';
import { WORDS, STAGES, WORD_BY_ID, makeQuestions, loadProgress } from './learning.js';
import { Narrator } from './narration.js';
import { LANE_AUDIO } from './question-audio.js';
import { CAMPAIGN, recommendedStage } from './campaign.js';
import { racingItem, personalizedStage, FLOW_RACE, FLOW_WORDS, BASE_CRUISE } from './personalization.js';
import { VEHICLES, PAINTS, WHEELS, TRAILS, loadGarage, saveGarage, dailyMission } from './garage.js';
import { buildAlternativeCar, customizeCar, createGarageStage, setVehicleQuality } from './vehicles.js';
import { createCoastDrive } from './coast-drive.js';
import { createCoastRadio } from './coast-radio.js';
import { createQuestionPace, gatePosition } from './race-pacing.js';
import { createGarageUI } from './garage-ui.js';
import { buildDriver, updateDriverPose } from './drivers.js';
import { createTutorial, loadTutorial, saveTutorialCompleted } from './tutorial.js';
import { automaticQuality, qualitySettings, slowerQuality, createPausedFrameGate } from './graphics.js';
import { createLandscapeHeight } from './landscape.js';
import { ROAD_END, pathX, pathY, pathAngle } from './course.js';
import { startTerrainBuild } from './terrain-startup.js';
import { buildCoastalCity } from './cityscape.js';
import { createCoastalRocks } from './coastal-rocks.js';
import { startAssetLoad, prepareFirstFrame } from './startup.js';
import { createWorldBuilder, seededRandom } from './world-build.js';
import { buildGate, disposeGateMeshes } from './race-gate.js';
import { prepareCar, shadowPlane } from './race-car.js';
import { createLobby, ALL_COURSES } from './lobby.js';
import * as hud from './hud.js';
import { renderResults } from './results.js';
import { showScreen, currentScreen, openDialog, closeDialog } from './screens.js';
import { wireGameLinks } from './links.js';
import { bindSoundToggles } from './kit/lab.mjs';
import { installQaHook } from './qa-hook.js';
import { createRaceController, LANES } from './race-controller.js';

// Restore the verified account before reading progress or enabling play.
await globalThis.SynkPlayAccount.ready();
const progressStorage = globalThis.SynkPlayAccount.storage();

const $ = (id) => document.getElementById(id);
const QA = new URLSearchParams(location.search).has('qa');

/* ── 아틀라스(공통 학습 기록)와 순간 맞춤 ── */
let coach = null, learningAvailable = true;
let requestedModality = new URLSearchParams(location.search).get('learning');
if (!['listening', 'reading'].includes(requestedModality)) requestedModality = null;
try { coach = globalThis.SynkLearning?.createGame({ gameId: 'korean-racing', storage: localStorage }) || null; } catch { learningAvailable = false; }
function learn(action, fallback = null) { try { return coach ? action(coach) : fallback; } catch { learningAvailable = false; return fallback; } }
function learningScope() {
  const summary = learn((c) => c.summary());
  if (!coach || !learningAvailable) return '맞춤 기록을 연결하지 못했어요. 기본 코스는 계속 플레이할 수 있어요.';
  if (!summary?.storage.available) return '저장이 제한되어 이번 페이지에서만 맞춤 기록을 유지해요.';
  return hosted ? 'WORLD 계정의 학습 기록 · 공유와 삭제는 WORLD 계정 설정에서 관리해요' : '이 기기의 학습 기록 · 아직 학생 계정과 연결 전';
}
// 순간 맞춤: 차가 달리는 속도와 맞춤 5문항이 고르는 문항 단계(FLOW_RACE). 레이스마다 하나, 시연·연습에는 없다. 잃어도 맞춤만 멈춘다.
let live = null;
function flowOf() { try { return coach && learningAvailable && typeof coach.live === 'function' ? coach.live(FLOW_RACE, { words: FLOW_WORDS }) : null; } catch { return null; } }
function setCruise(value) { round.cruise = value; for (const r of rivals) r.speed = (r.base ??= r.speed) * round.cruise / BASE_CRUISE; }
function startLive() {
  live = round.roundWasDemo ? null : flowOf(); round.flowStart = null;
  try { round.flowStart = live ? live.settings().values : null; } catch { live = null; }
  setCruise(round.flowStart?.cruise ?? BASE_CRUISE);
  try { return live?.intro().line?.text || null; } catch { return null; }
}
function endLive() { let end = null; try { end = live?.end() || null; } catch { /* 속도 기억은 편의 */ } live = null; return end; }
function presentGate(q) { const item = racingItem(q); if (live) { try { return live.present(item); } catch { live = null; } } return learn((c) => c.present(item)); }
// 답은 늘 Trail에 남고, 순간 맞춤 레이스면 같은 답이 속도와 단계도 움직인다.
function answerGate(pid, response, flow) {
  if (live) {
    try {
      const out = live.answer(pid, response, flow);
      if (out.change?.knob === 'cruise') setCruise(out.settings.values.cruise);
      if (out.line?.text) round.laterToast = out.line.text;
      return out.recorded;
    } catch { live = null; }
  }
  return learn((c) => c.answer(pid, response));
}
function nextPersonalized() { return learn((c) => personalizedStage(c, { audioAvailable: !round.soundTouched || round.soundEnabled, modality: requestedModality, live: flowOf() })); }
const assignment = () => learn((c) => c.assignment?.());
// 듣기 목표인데 소리가 꺼져 있으면 문항이 없는 게 아니라 소리를 켜면 된다고 말한다.
function targetUnavailable() {
  const target = assignment();
  return target?.modality === 'listening' && round.soundTouched && !round.soundEnabled ? '이번 목표는 듣기 문항이에요. 소리를 켜면 바로 시작할 수 있어요.' : '과제 문제를 불러오지 못했어요. WORLD에서 다시 열어 주세요.';
}
// SYNK WORLD 안에서는 기록이 계정의 것이다(이 브라우저가 아니라 WORLD에서 보관·삭제).
const hosted = learn((c) => typeof c.assignment === 'function', false);

/* ── 상태 ── */
let stage = $('world');          // 3D 캔버스가 들어 있는 상자(레이스 판 또는 차고 액자). 캔버스 크기는 이 상자를 따른다
const screenEl = $('game');      // 레이스 화면: 상태 이름표(boosting·coasting·tutorial…)를 단다
let worldShown = false;          // 3D가 화면에 보일 때만 그린다(입구·결과에서는 그리지 않는다)
let mobile = matchMedia('(max-width: 650px)').matches;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
function roadPoint(s, offset = 0, y = 0) {
  return new THREE.Vector3(pathX(s) + Math.cos(pathAngle(s)) * offset, pathY(s) + y, s - Math.sin(pathAngle(s)) * offset);
}
const groundHeight = createLandscapeHeight(pathX, pathY);

let renderer, scene, camera, car, rivals = [], wheels = [], world = null, resizeObserver = null;
const startup = { phase: 'idle', compilePasses: 0 };
let ready = false, loadState = 'loading', pendingStart = null, heroShot = false;
const coastDrive = createCoastDrive();
const questionPace = createQuestionPace();
let renderFrames = 0, renderTotal = 0, adaptiveTime = 0, frameSample = [], warmupFrames = 0;
const pausedFrameGate = createPausedFrameGate();
let renderedFrames = 0, skippedPausedFrames = 0;
// 소리는 처음부터 켜진 것으로 보인다(round.soundEnabled 처음 값 true, 실제 소리는 첫 단추를 누른 뒤에 연다). 시작 전에 끄면 그대로 꺼진 채 달린다.
let audio = null, motor = null, motorGain = null, windGain = null;
let syncSoundToggles = () => {};
const coastRadio = createCoastRadio({ getContext: () => audio, onUnavailable: () => { $('cruise-track').textContent = '♫ 해안선 · 눌러서 음악 켜기'; } });
const deviceGraphics = { coarsePointer: matchMedia('(pointer: coarse)').matches, memoryGB: navigator.deviceMemory || 8, cores: navigator.hardwareConcurrency || 8 };
// 제작용 캡처 주소(?capture=4k): DPR 1 컴퓨터에서 실제 픽셀을 더 그린다. 답·주행·저장·보상은 바꾸지 않는다.
const capture4k = new URLSearchParams(location.search).get('capture') === '4k';
let light, ambientLight, currentQuality = 'auto', mode = automaticQuality(deviceGraphics), renderQuality = qualitySettings(mode, { pixelRatio: devicePixelRatio });
let driverName = 'marin', driverFeltTexture = null, driverMood = 'base', moodTime = 0;
let worldTime = { value: 0 }, carTemplate;
let scenery = {}, sparkLife = 0;
const clock = new THREE.Clock();
const sunDirection = new THREE.Vector3(92, 93, 56).normalize();
let initialProgress;
try { initialProgress = loadProgress(progressStorage); } catch { initialProgress = loadProgress({ getItem: () => null }); }
// 처음 여는 사람은 첫 코스, 다시 온 사람은 아직 통과하지 못한(또는 가장 덜 익숙한) 코스부터 보인다.
const initialStage = recommendedStage(initialProgress);
let starting = false;
let tutorial = null, tutorialVoicePending = false, tutorialDismissed = false, tutorialSaved = true, tutorialBank = null, tutorialIdle = 0, tutorialGoHint = false;
let tutorialCompleted = false;
try { tutorialCompleted = loadTutorial(progressStorage).completed; } catch { /* 저장 공간이 없으면 연습부터 */ }
const TUTORIAL_CLIPS = ['welcome', 'right', 'listen', 'choices', 'retry', 'correct', 'boost', 'finish', 'go'].map((id) => 'tutorial-' + id);
const tutorialFruits = ['사과', '포도', '바나나'].map((word) => WORDS.find((w) => w.word === word));
let garageSaved = true;
let garageOpen = false, garageStudio = null, previewCar = null, garageAngle = .65;
const raceCars = new Map(), previewCars = new Map();
const commonClips = ['intro', 'cue-picture', 'cue-listen', 'correct', 'answer', 'boost', 'retry', 'finish', 'shield-ready', 'shield-block', 'garage-earned', 'garage-wish', 'mission-complete', 'finale-unlock', ...LANE_AUDIO];
const narrator = new Narrator({
  getContext: () => audio,
  onActive: (active) => {
    coastRadio.setState({ duck: active });
    if (audio && motorGain) motorGain.gain.setTargetAtTime(active ? .014 : round.running && !round.paused ? .055 : 0, audio.currentTime, .12);
    $('question').classList.toggle('narrating', active);
    $('voice-status').textContent = active ? '음성 안내 중' : '음성 안내';
  },
  onDelivery: ({ kind, presentationId, audio: status }) => {
    if (presentationId) learn((c) => c.delivery(presentationId, { audio: status }));
    if (status === 'completed' && round.gate?.presentationId === presentationId) { round.gate.heard = true; questionReady(); renderQuestion(); }
    if (kind === 'tutorial') tutorialDelivered();
  },
  onUnavailable: () => {
    round.narrationUnavailable = true;
    if (tutorial) renderTutorial();
    else { questionReady(); displayQuestion(); showToast('음성을 재생하지 못해 글로 열었어요.', 4); }
  },
});

/* ── 한 판 진행(race-controller.js): 상태는 round, 진행은 race. 3D·소리·학습·저장은 아래 포트로만 건넨다 ── */
const race = createRaceController({
  view: { $, hud, screenEl, showScreen: (name) => { showScreen(name); worldShown = false; }, showRace, openDialog, closeDialog, renderResults, renderLobby, renderCollection,
    syncSoundToggles: () => syncSoundToggles(), hidden: () => document.hidden },
  sound: {
    narrator, speak: (ids, text, kind, options) => narrator.speak(ids, text, kind, options), ensureAudio, ding, contact: contactSound,
    quiet() { if (audio) { motorGain.gain.setTargetAtTime(0, audio.currentTime, .06); windGain.gain.setTargetAtTime(0, audio.currentTime, .06); } },
    engineCoast(velocity) {
      if (!audio) return;
      motor.frequency.setTargetAtTime(45 + velocity * 1.8, audio.currentTime, .15); motorGain.gain.setTargetAtTime(narrator.playing ? .01 : .026, audio.currentTime, .18);
      windGain.gain.setTargetAtTime(velocity * (narrator.playing ? .0002 : .00055), audio.currentTime, .18);
    },
    engineRace(velocity, boost, kind) {
      if (!audio) return;
      motor.frequency.setTargetAtTime((kind === 'rally' ? 32 : kind === 'open' || kind === 'finale' ? 55 : 45) + velocity * 1.8, audio.currentTime, .15);
      motorGain.gain.setTargetAtTime(narrator.playing ? .014 : .055 + (boost > 0 ? .012 : 0), audio.currentTime, .12); windGain.gain.setTargetAtTime(velocity * (narrator.playing ? .0003 : .0015), audio.currentTime, .15);
    },
  },
  scene: {
    car: () => car, wheels: () => wheels, rivals: () => rivals, placeCar, applyEquipment, mascotMood, contactSparks,
    buildGate({ q, types, s }) {
      const built = buildGate(THREE, renderer, { q, types, lanes: LANES, words: WORD_BY_ID });
      built.group.position.copy(roadPoint(s)); built.group.rotation.y = pathAngle(s); scene.add(built.group);
      return built;
    },
    removeGate(gate) { scene.remove(gate.group); disposeGateMeshes(gate.group); },
    hideRoundEffects() { if (car.userData.shield) car.userData.shield.visible = false; sparkLife = 0; if (scenery.sparks) scenery.sparks.visible = false; },
    resetCamera(s) { camera.position.copy(roadPoint(s - (mobile ? 12.5 : 7.4), mobile ? -1.8 : 5.4, mobile ? 4.5 : 3.6)); camera.lookAt(roadPoint(s + (mobile ? 14 : 12), mobile ? 3.8 : 1.8, 1.2)); },
    wrapCamera(s, offset) { camera.position.copy(roadPoint(s - (mobile ? 8.8 : 9), offset * (mobile ? .92 : .62), mobile ? 3.35 : 3.6)); },
  },
  learning: { learn, presentGate, answerGate, endLive, nextPersonalized, learningScope },
  rewards: { account: () => globalThis.SynkPlayAccount, storage: progressStorage, loadGarage: loadGarageSafe, storeGarage, wishText },
  tutorial: { active: () => !!tutorial, chooseLane: chooseTutorialLane, tapLane: tutorialTapLane, render: renderTutorial, repeat: repeatTutorial, delivered: tutorialDelivered,
    clearVoice: () => { tutorialVoicePending = false; } },
  coastRadio, clock, reducedMotion, coastDrive, questionPace,
  state: { progress: initialProgress, selectedStage: initialStage, questionBank: makeQuestions(initialStage), garage: loadGarageSafe() },
});
const round = race.state;
const { speak, setQuestionExpanded, chooseCurrentLane, questionReady, displayQuestion, renderQuestion, narrateQuestion, makeGate, disposeGate, reset, showToast, silence, setText,
  pause, resume, showCruiseResults, returnToCruise, nextStage, continueFeedback, updateCoastDrive, updateGame, toggleSound, syncCoastRadio, isUnlocked } = race;
const stageSize = (s) => (s.campaign ? s.items.length : s.words.length);
const stageClips = (s) => (s.campaign ? s.items.flatMap((q) => [...q.audio, ...q.answerAudio, ...q.options]) : s.words);

/* ── 공통 차고(공통 코인·장착) ── */
function loadGarageSafe() {
  try { const value = loadGarage(globalThis.SynkPlayAccount.storage()); garageSaved = true; return value; }
  catch { garageSaved = false; return loadGarage({ getItem: () => null }); }
}
function storeGarage(value) {
  if(globalThis.SynkPlayAccount.status().mode==='account')return false;
  round.garage = value;
  let saved = false;
  try { saved = saveGarage(value, localStorage); } catch { /* 아래에서 알린다 */ }
  renderCollection();
  if (!saved) showToast('이 기기에 저장할 수 없어서, 꾸미기는 이 화면에서만 남아요.', 4);
  return saved;
}
function equipmentStyle(equipment) {
  return { paint: PAINTS.find((p) => p.id === equipment.paint)?.color, wheelColor: WHEELS.find((p) => p.id === equipment.wheels)?.color,
    trailColor: TRAILS.find((p) => p.id === equipment.trail)?.color, badge: equipment.badge };
}
function createVehicle(id) {
  const vehicle = VEHICLES.find((v) => v.id === id) || VEHICLES[0];
  const mesh = vehicle.id === 'coast' ? prepareCar(THREE, renderer, scene, carTemplate, vehicle.color) : buildAlternativeCar(vehicle.id === 'finale' ? 'finale' : vehicle.kind, { color: vehicle.color });
  mesh.userData.vehicleKind = vehicle.id; seatMascot(mesh, driverName);
  return mesh;
}
function applyEquipment() {
  if (!carTemplate) return;
  const id = round.garage.equipped.vehicle;
  if (car) car.visible = false;
  if (!raceCars.has(id)) { const mesh = createVehicle(id); scene.add(mesh); raceCars.set(id, mesh); }
  car = raceCars.get(id); car.visible = !garageOpen; wheels = car.userData.wheels;
  customizeCar(car, equipmentStyle(round.garage.equipped)); setVehicleQuality(car, mode); selectDriver(driverName);
  if (motor) motor.type = id === 'open' || id === 'finale' ? 'triangle' : id === 'rally' ? 'square' : 'sawtooth';
}
function previewEquipment(item = null) {
  if (!ready || !garageOpen) return;
  const equipment = { ...round.garage.equipped };
  if (item) equipment[item.kind] = item.value;
  const id = equipment.vehicle;
  if (!previewCars.has(id)) { const mesh = createVehicle(id); mesh.removeFromParent(); previewCars.set(id, mesh); }
  previewCar = previewCars.get(id); customizeCar(previewCar, equipmentStyle(equipment)); setVehicleQuality(previewCar, mode, { preview: true }); garageStudio.place(previewCar);
  previewCar.userData.jets.forEach((j) => { j.visible = item?.kind === 'trail'; j.scale.y = 1.1; });
  seatMascot(previewCar, driverName);
}
function setGarageUrl(open) {
  const url = new URL(location.href);
  if (open) url.searchParams.set('garage', '1'); else url.searchParams.delete('garage');
  history.replaceState(history.state, '', url);
}
function openGarage() {
  if (starting) return;
  if (garageOpen) { garageUI.render(); return; }
  leaveRace();
  round.garage = loadGarageSafe(); garageOpen = true;
  showScreen('garage'); setGarageUrl(true);
  garageUI.open(); garageUI.setReady(ready);
  if (ready) attachGarage3D();
}
// 3D 차고: 도로 출발점의 원형 무대에 미리보기 차를 올리고, 캔버스를 차고 액자로 옮긴다.
function attachGarage3D() {
  garageStudio.group.position.copy(roadPoint(75, 0, .08)); garageStudio.group.visible = true;
  $('garage-angle').value = String(Math.round(garageAngle * 180 / Math.PI));
  car.visible = false; rivals.forEach((r) => { r.mesh.visible = false; });
  if (round.gate?.group) round.gate.group.visible = false;
  placeWorld($('garage-world')); worldShown = true;
  previewEquipment(garageUI.previewItem); updateCamera(1); clock.getDelta();
}
function closeGarage() {
  garageOpen = false;
  if (garageStudio) garageStudio.group.visible = false;
  if (camera) camera.clearViewOffset();
  rivals.forEach((r) => { r.mesh.visible = true; });
  setGarageUrl(false);
  if (ready) { applyEquipment(); reset(false); }
  showLobby();
}
function wishText() { const wish = VEHICLES.find((v) => v.id === round.garage.wish); return wish ? `${wish.name}까지 ${Math.max(0, wish.price - round.garage.coins)}코인 남았어요` : ''; }
function renderCollection() { lobby.renderCoins(round.garage, garageSaved); }
function playMission(mission) {
  if (starting || mission.completed) return;
  if (garageOpen) garageUI.close();
  let course;
  if (mission.kind === 'first-clear') course = CAMPAIGN.find((s) => s.id === mission.target);
  else if (mission.collection === 'campaign') {
    const source = ALL_COURSES.find((s) => s.items.some((q) => q.id === mission.target));
    if (source) course = { ...source, id: `mission-${mission.date}`, title: '오늘의 힌트 다시 만나기', finale: false, review: true,
      items: [source.items.find((q) => q.id === mission.target), ...source.items.filter((q) => q.id !== mission.target)] };
  } else course = STAGES.find((s) => s.words.includes(mission.target));
  if (course) { selectStage(course); start(false); }
}
const garageUI = createGarageUI({
  onPreview: previewEquipment,
  onEquip: () => { applyEquipment(); previewEquipment(); },
  onClose: closeGarage,
  onMission: playMission,
  readProgress: () => round.progress,
  readGarage: () => { round.garage=loadGarageSafe();return round.garage; },
  writeGarage: storeGarage,
});
document.addEventListener('input', (e) => { if (e.target.id === 'garage-angle') garageAngle = Number(e.target.value) * Math.PI / 180; });

/* ── 입구 ── */
const lobby = createLobby({ view: lobbyView, select: selectStage, journey: startJourney, mission: playMission });
function lobbyView() {
  return { ready, starting, pendingStart: !!pendingStart, load: loadState, stage: round.selectedStage, unlocked: assignment() ? true : isUnlocked(round.selectedStage),
    firstRun: !tutorialCompleted && !tutorialDismissed, target: assignment(), personal: nextPersonalized(), recommended: recommendedStage(round.progress),
    targetUnavailable: targetUnavailable(), progress: round.progress, garage: round.garage, garageSaved, mission: dailyMission(round.progress, Date.now(), round.garage),
    driver: driverName, scope: learningScope(), hosted, isUnlocked };
}
function renderLobby() { lobby.render(lobbyView()); }
function showLobby() { showScreen('lobby'); worldShown = false; renderLobby(); }
function lobbyNote(text) { $('l-reason').textContent = text; hud.announce(text); }
function selectStage(s) {
  if (assignment()) { const plan = nextPersonalized(); if (!plan) { lobbyNote(targetUnavailable()); return; } s = plan.stage; }
  if (starting) return;
  if (garageOpen) garageUI.close();
  clearTutorial(); round.selectedStage = s; round.questionBank = makeQuestions(s); round.running = false; round.auto = false; silence(); endLive();
  if (ready) { setScenery(s.scene || 'coast'); reset(false); }
  renderLobby();
}
function startJourney() {
  if (starting) return;
  const personal = nextPersonalized();
  if (requestedModality && !personal) { lobbyNote('맞춤 문항을 준비하지 못했어요. 소리 설정과 연결 상태를 확인해 주세요.'); return; }
  requestedModality = null; lobby.useCollection('campaign');
  selectStage(personal?.stage || recommendedStage(round.progress)); start(false);
}
// ‘레이스 시작’: 잠긴 코스를 보고 있었으면 아직 통과하지 못한 첫 코스부터 달린다.
function onStartClick() {
  if (starting) return;
  if (!assignment() && !isUnlocked(round.selectedStage)) selectStage(recommendedStage(round.progress));
  start(false);
}

/* ── 운전석의 친구(마린·까몽): 같은 빛 아래의 입체. 표정과 자세만 바뀐다 ── */
function seatMascot(vehicle, name) {
  // 차의 +Z가 도로 앞쪽이고, 추적 카메라는 투구 뒤를 본다.
  const drivers = vehicle.userData.drivers || (vehicle.userData.drivers = new Map());
  if (vehicle.userData.mascot) vehicle.userData.mascot.visible = false;
  if (!drivers.has(name)) { const driver = buildDriver(THREE, name, { feltTexture: driverFeltTexture }); driver.position.fromArray(vehicle.userData.seatPosition || [.40, .68, -.18]); vehicle.add(driver); drivers.set(name, driver); }
  const mascot = drivers.get(name); mascot.visible = true; vehicle.userData.mascot = mascot; vehicle.userData.character = name;
  return mascot;
}
function selectDriver(name) {
  driverName = name; driverMood = 'base'; moodTime = 0;
  for (const vehicle of new Set([...raceCars.values(), ...previewCars.values()])) seatMascot(vehicle, name);
}
function mascotMood(mood, seconds = 0) { driverMood = mood; moodTime = seconds; }
function updateMascot(dt) {
  const mascot = car.userData.mascot;
  if (!mascot) return;
  if (moodTime > 0) { moodTime -= dt; if (moodTime <= 0) driverMood = round.gate?.announced && !round.gate.judged ? 'focus' : 'base'; }
  updateDriverPose(mascot, { steer: (round.inputs.left ? 1 : 0) - (round.inputs.right ? 1 : 0), mood: driverMood, time: worldTime.value, speed: round.running && !round.paused ? round.velocity : 0, motion: !reducedMotion });
}
function placeCar(c, s, offset, yaw = 0) { c.position.copy(roadPoint(s, offset, .025)); c.rotation.set(0, pathAngle(s) + yaw, 0); }

/* ── 화질과 크기 ── */
function setQuality(value) {
  currentQuality=value;mode=value==='auto'?automaticQuality(deviceGraphics):value;
  if(renderer&&light)applyRenderQuality();adaptiveTime=0;frameSample=[];
}
function applyRenderQuality(){
  renderQuality=qualitySettings(mode,{pixelRatio:capture4k?2:devicePixelRatio,explicit:currentQuality!=='auto'});
  renderer.setPixelRatio(renderQuality.pixelRatio);renderer.shadowMap.enabled=renderQuality.shadows;
  if(light.shadow.mapSize.x!==renderQuality.shadowSize){light.shadow.map?.dispose();light.shadow.map=null;light.shadow.mapSize.setScalar(renderQuality.shadowSize);}
  scenery.atmosphere?.setQuality(mode);renderer.shadowMap.needsUpdate=true;resize();
  for(const vehicle of raceCars.values())setVehicleQuality(vehicle,mode);
}
function resize(){
  if(!renderer)return;
  // 캔버스 상자가 아직 숨겨져 있으면(입구에서 미리 준비할 때) 화면 크기로 그린다.
  const w=stage.clientWidth||innerWidth,h=stage.clientHeight||innerHeight;mobile=w<=650;
  const pixelRatio=qualitySettings(mode,{pixelRatio:capture4k?2:devicePixelRatio,explicit:currentQuality!=='auto'}).pixelRatio;
  if(renderer.getPixelRatio()!==pixelRatio){renderQuality={...renderQuality,pixelRatio};renderer.setPixelRatio(pixelRatio);}
  renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
  // THREE는 같은 크기여도 캔버스 너비·높이를 다시 넣어 그림을 지운다. 멈춘 화면도 이 뒤에는 다시 그린다.
  pausedFrameGate.invalidate();
}
async function init() {
  const startedAt = performance.now(), mark = (name) => { startup[name] = Math.round(performance.now() - startedAt); };
  const yieldToUI = () => new Promise((resolve) => setTimeout(resolve, 0));
  startup.phase = 'assets'; startup.startedAt = Math.round(startedAt);
  let draco, terrainBuild;
  try {
    const textures = new THREE.TextureLoader();
    draco = new DRACOLoader(); draco.setDecoderPath('./vendor/'); draco.setDecoderConfig({ type: 'wasm' });
    const loader = new GLTFLoader(); loader.setDRACOLoader(draco);
    const assetsPending = startAssetLoad({ textures, models: loader, coarsePointer: deviceGraphics.coarsePointer }).then((result) => { mark('assetsMs'); return result; });
    terrainBuild = startTerrainBuild();
    await document.fonts.ready;
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.setClearColor(0xc9dedb);
    stage.appendChild(renderer.domElement);
    renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); if (round.running && !round.paused) pause(); $('world-error').hidden = false; });
    scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(53, 1, .12, 4900);
    ambientLight = new THREE.HemisphereLight(0xc7e1fa, 0x68764c, .78); scene.add(ambientLight);
    light = new THREE.DirectionalLight(0xfff2db, 2.9); light.castShadow = true; light.shadow.mapSize.set(2048, 2048);
    Object.assign(light.shadow.camera, { left: -38, right: 38, top: 66, bottom: -26, near: 1, far: 280 });
    light.shadow.bias = -.00012; light.shadow.normalBias = .035; light.shadow.radius = 2; scene.add(light, light.target);
    const assets = await assetsPending;
    if (!assets.ok) throw assets.error;
    const [road, roadNormal, terrain, terrainNormal, clearSky, cliff, cliffNormal, beach, pineCanopy, blossomCanopy, goldenSky] = assets.textures;
    const { car: gltf, felt, rocks: rockScan } = assets;
    draco.dispose(); draco = null; startup.phase = 'world';
    for (const t of [pineCanopy, blossomCanopy]) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); }
    const surfaceTextures = { road, roadNormal, terrain, terrainNormal, cliff, cliffNormal, beach };
    for (const [name, t] of Object.entries(surfaceTextures)) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      if (['road', 'terrain', 'cliff', 'beach'].includes(name)) t.colorSpace = THREE.SRGBColorSpace;
    }
    for (const sky of [clearSky, goldenSky]) { sky.colorSpace = THREE.SRGBColorSpace; sky.mapping = THREE.EquirectangularReflectionMapping; sky.wrapS = THREE.RepeatWrapping; }
    world = createWorldBuilder({ THREE, renderer, scene, light, ambientLight, sunDirection, scenery, textures: surfaceTextures, canopy: { pine: pineCanopy, blossom: blossomCanopy },
      random: seededRandom(93127), roadPoint, groundHeight, worldTime, reducedMotion, startup });
    // 큰 만들기 사이마다 화면에 차례를 넘긴다. 반쯤 만든 장면을 레이스에 내보이지 않는다.
    startup.phase = 'terrain';
    const terrainWaitAt = performance.now(), terrainResult = await terrainBuild.result;
    startup.terrainWaitMs = Math.round(performance.now() - terrainWaitAt);
    startup.terrainSource = terrainResult.ok ? 'worker' : 'fallback';
    if (terrainResult.ok) startup.terrainWorkerMs = Math.round(terrainResult.computeMs);
    else startup.terrainFallback = terrainResult.reason;
    const terrainMainAt = performance.now();
    world.setupSky(); world.setupTerrain(terrainResult.ok ? terrainResult.terrain : undefined); world.setupWater(clearSky, goldenSky);
    startup.terrainMainMs = Math.round(performance.now() - terrainMainAt);
    mark('terrainMs'); await yieldToUI();
    startup.phase = 'coast-city'; world.setupCoastalScenery();
    scenery.city = buildCoastalCity(THREE, { pathX, groundHeight, roadEnd: ROAD_END }); scene.add(scenery.city.group);
    mark('coastCityMs'); await yieldToUI();
    startup.phase = 'vegetation'; world.setupVegetation();
    mark('vegetationMs'); await yieldToUI();
    // 하늘 셰이더(방향·구름 높이 포함)를 그대로 구워 차체·바다·보이는 하늘이 같은 빛을 쓴다.
    startup.phase = 'environment';
    const pmrem = new THREE.PMREMGenerator(renderer), environmentScene = new THREE.Scene();
    const environmentSky = new THREE.Mesh(scenery.atmosphere.sky.geometry, scenery.atmosphere.sky.material); environmentScene.add(environmentSky);
    scenery.environments = {};
    scenery.atmosphere.setTheme('sunset'); environmentSky.rotation.copy(scenery.atmosphere.sky.rotation); sunDirection.set(.34, .115, .94).normalize();
    scenery.environments.sunset = pmrem.fromScene(environmentScene, .01, .1, 5000, { size: deviceGraphics.coarsePointer ? 128 : 256 });
    environmentScene.remove(environmentSky); pmrem.dispose(); world.setupJourneyScenery(round.selectedStage.scene || 'coast');
    mark('environmentMs'); await yieldToUI();
    startup.phase = 'vehicles';
    scenery.rockShelves = createCoastalRocks(THREE, { source: rockScan.scene, pathX, groundHeight }); scene.add(scenery.rockShelves.group);
    driverFeltTexture = felt; felt.wrapS = felt.wrapT = THREE.RepeatWrapping; felt.repeat.set(3, 3); felt.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    carTemplate = gltf.scene.children[0]; car = prepareCar(THREE, renderer, scene, carTemplate, 0xaad882); wheels = car.userData.wheels;
    seatMascot(car, driverName); raceCars.set('coast', car); garageStudio = createGarageStage(scene); applyEquipment();
    // 가벼운 상대 차도 모두 모델링해, 내 GT의 세밀함은 보는 곳에 두고 길 위 차들은 서로 다른 윤곽을 갖는다.
    rivals = [{ mesh: buildAlternativeCar('open', { color: 0x7c9fba }), s: 103, offset: -3.15, speed: 26.1 }, { mesh: buildAlternativeCar('rally', { color: 0xd09970 }), s: 124, offset: 3.1, speed: 25.6 }];
    rivals.forEach((r) => { r.mesh.add(shadowPlane(THREE, renderer)); scene.add(r.mesh); });
    seatMascot(rivals[0].mesh, 'kkamong'); seatMascot(rivals[1].mesh, 'marin');
    mark('worldMs'); startup.phase = 'shaders';
    startup.parallelShaders = renderer.extensions.has('KHR_parallel_shader_compile');
    await prepareFirstFrame({
      getState: () => [round.selectedStage, round.questionBank, $('quality').value, driverName, stage.clientWidth || innerWidth, stage.clientHeight || innerHeight, devicePixelRatio],
      prepare: () => {
        setScenery(round.selectedStage.scene || 'coast');
        setQuality($('quality').value);reset(false);
        updateCamera(0);
      },
      compile: async () => { startup.compilePasses++; await renderer.compileAsync(scene, camera); mark('shadersMs'); },
      render: () => { frame(); mark('firstFrameMs'); },
      nextFrame: () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    });
    mark('readyMs'); startup.phase = 'ready';
    ready = true; loadState = 'ready';
    // 학습 허브의 ‘읽기부터’(또는 ‘듣기’)로 열면 첫 듣기 코스가 아니라 그 맞춤 코스를 준비한다.
    if (requestedModality && !assignment()) { const plan = nextPersonalized(); if (plan?.stage) selectStage(plan.stage); }
    window.addEventListener('resize', onResize);
    resizeObserver = new ResizeObserver(onResize); resizeObserver.observe(stage);
    renderer.setAnimationLoop(frame);
    garageUI.setReady(true);
    if (garageOpen) attachGarage3D();
    renderLobby();
    if (pendingStart && !garageOpen) { const queued = pendingStart; pendingStart = null; start(queued.demo); }
    else pendingStart = null;
  } catch (error) {
    ready = false; loadState = 'failed'; pendingStart = null; startup.phase = 'failed'; console.error(error); window.__racingError = String(error);
    renderLobby(); garageUI.setReady(false);
  } finally { draco?.dispose(); terrainBuild?.cancel(); }
}
function setScenery(theme) { world?.setScenery(theme); }
// 3D 캔버스를 옮긴다(레이스 판 ↔ 차고 액자). 크기는 새 상자를 따른다.
function placeWorld(host) {
  stage = host;
  if (!renderer) return;
  if (renderer.domElement.parentElement !== host) host.appendChild(renderer.domElement);
  resizeObserver?.disconnect(); resizeObserver?.observe(host); onResize();
}
function onResize() { resize(); placeLaneAnchor(); }
function showRace() { showScreen('game'); placeWorld($('world')); worldShown = true; pausedFrameGate.invalidate(); }
// 차선 꼬리표와 정답 글자의 높이: 레이스 카메라로 멈춤선에서 본 게이트 발치와 내 차 지붕 사이 가운데에 꼬리표를,
// 게이트 판 위 하늘에 정답 글자를 둔다(화면 비율마다 게이트와 차의 높이가 다르다).
function placeLaneAnchor() {
  if (!camera || stage !== $('world') || !stage.clientHeight) return;
  const S = gatePosition(0) - 65, short = mobile && stage.clientHeight < 640, probe = camera.clone();
  probe.position.copy(roadPoint(S - (mobile ? (short ? 11.2 : 8.8) : 9), 0, mobile ? 3.35 : 3.6));
  probe.lookAt(roadPoint(S + 24, 0, short ? 1.1 : 1.55));
  probe.fov = mobile ? (short ? 60 : 58) : 55; probe.aspect = stage.clientWidth / stage.clientHeight; probe.updateProjectionMatrix();
  const y = (point) => (1 - point.project(probe).y) / 2;   // 0(위) ~ 1(아래)
  const foot = y(roadPoint(S + 65, 0, 0)), boardTop = y(roadPoint(S + 65, 0, 3.7));
  screenEl.style.setProperty('--lane-top', `${(foot * 100).toFixed(1)}%`);
  screenEl.style.setProperty('--pop-y', `${(Math.max(.2, boardTop - .07) * 100).toFixed(1)}%`);
}

/* ── 첫 플레이 조작 연습 ── */
function clearTutorial() {
  tutorial = null; tutorialVoicePending = false; screenEl.classList.remove('tutorial', 'tutorial-done'); $('tutorial-hud').hidden = true;
  if (tutorialBank) { round.questionBank = tutorialBank; tutorialBank = null; }
  for (const id of ['left', 'right', 'go']) $(id).classList.remove('tutorial-target');
  rivals.forEach((r) => { r.mesh.visible = true; });
}
function renderTutorial() {
  if (!tutorial) return;
  const step = tutorial.step;
  const number = step === 'steer-left' ? 1 : step === 'steer-right' ? 2 : ['listen', 'choose'].includes(step) ? 3 : 4;
  const copy = {
    'steer-left': ['왼쪽으로 움직여 봐요', '← 단추를 누르거나 A 키'],
    'steer-right': ['이번엔 오른쪽으로', '→ 단추를 누르거나 D 키'],
    listen: ['소리를 듣고 그림을 골라요', '안내가 끝날 때까지 기다려 주세요'],
    choose: ['사과가 있는 길로 가요', '← → 로 옮기고 ↑로 출발해요. 사과 꼬리표를 눌러도 돼요'],
    'boost-ready': ['정답! 부스터로 달려요', '정답을 맞히면 저절로 빨라져요'],
    boosting: ['한국어가 속도가 됐어요', '좋아요! 바다를 따라 달려요'],
    complete: ['출발 준비 끝!', tutorialSaved ? '이제 고른 코스에서 달려 봐요' : '이번 화면에서는 연습 완료 · 저장이 제한돼 있어요'],
  }[step];
  $('tutorial-step').textContent = step === 'complete' ? '조작 연습 완료' : `조작 연습 · ${number} / 4`;
  $('tutorial-title').textContent = copy[0]; $('tutorial-hint').textContent = copy[1];
  [...$('tutorial-hud').querySelectorAll('.t-dots i')].forEach((dot, i) => dot.classList.toggle('done', i < number));
  for (const id of ['left', 'right', 'go']) $(id).classList.toggle('tutorial-target', step === 'steer-left' && id === 'left' || step === 'steer-right' && id === 'right' || step === 'choose' && id === 'go');
  $('go').hidden = step !== 'choose' || tutorialVoicePending;
  $('tutorial-repeat').hidden = $('tutorial-skip').hidden = step === 'complete';
  $('tutorial-race').hidden = $('tutorial-home').hidden = step !== 'complete';
  $('tutorial-repeat').disabled = round.paused;
}
function tutorialSpeak(ids, text) {
  if (!tutorial) return;
  tutorialVoicePending = round.soundEnabled;
  if (round.soundEnabled) speak(ids, text, 'tutorial', true); else tutorialDelivered();
  renderTutorial();
}
function tutorialDelivered() {
  if (!tutorial || round.paused) return;
  tutorialVoicePending = false;
  if (tutorial.step === 'listen') { tutorial.beginQuestion(); round.questionChosen = false; tutorialIdle = 0; }
  else if (tutorial.step === 'boost-ready' && tutorial.activateBoost()) { round.boost = 2.5; mascotMood('cheer', 3); ding(true); }
  renderTutorial();
}
function repeatTutorial() {
  if (!tutorial || round.paused) return;
  const step = tutorial.step;
  if (step === 'steer-left') tutorialSpeak(['tutorial-welcome'], '안녕! 먼저 왼쪽으로 움직여 볼까?');
  else if (step === 'steer-right') tutorialSpeak(['tutorial-right'], '좋아! 이번엔 오른쪽으로!');
  else if (step === 'listen' || step === 'choose') tutorialSpeak(['tutorial-listen', 'tutorial-choices'], '잘 들어 봐. 사과. 왼쪽은 바나나, 가운데는 포도, 오른쪽은 사과. 사과 쪽으로 가 봐!');
  else if (step === 'boost-ready') tutorialSpeak(['tutorial-boost'], '정답을 맞히면 차가 저절로 빨라져. 부스터로 달려 보자!');
}
async function startTutorial() {
  if (!ready || starting) return;
  if (garageOpen) garageUI.close();
  clearTutorial(); starting = true; round.running = false; silence(); round.narrationUnavailable = false; renderLobby();
  if (!round.soundTouched) { round.soundEnabled = true; updateSoundButton(); }
  if (round.soundEnabled) { try { await ensureAudio(); await narrator.prepare(TUTORIAL_CLIPS); } catch { round.narrationUnavailable = true; } }
  showRace();
  round.auto = false; round.roundWasDemo = true; reset(true); disposeGate(); tutorialBank = round.questionBank;
  const [apple, grape, banana] = tutorialFruits;
  round.questionBank = [{ answer: apple.id, word: apple.word, mode: 'picture', prompt: '사과의 그림을 찾아요', spoken: '사과', options: [apple.id, grape.id, banana.id] }];
  tutorial = createTutorial({ answerId: apple.id }); tutorialIdle = 0; tutorialGoHint = false; tutorialSaved = true;
  learn((c) => { const pid = c.present(racingItem(round.questionBank[0])); c.help(pid, 'answer'); return pid; });
  starting = false; round.velocity = 12; rivals.forEach((r) => { r.mesh.visible = false; });
  screenEl.classList.add('tutorial'); $('tutorial-hud').hidden = false; $('demo-indicator').hidden = true;
  renderLobby(); repeatTutorial(); clock.getDelta();
}
function beginTutorialQuestion() {
  round.inputs.left = round.inputs.right = false; round.laneAim = 0; makeGate(0, round.playerS + 35); round.gate.announced = true; hud.showLanes(); mascotMood('focus'); repeatTutorial();
}
function chooseTutorialLane() {
  if (!round.running || round.paused || tutorialVoicePending) return;
  if (tutorial.step !== 'choose' || !round.gate || round.gate.judged) return;
  round.questionChosen = true; round.laneAim = LANES[clamp(Math.round((round.playerOffset + 3.45) / 3.45), 0, 2)];
}
function tutorialTapLane(id) {
  if (!round.running || round.paused || tutorialVoicePending || tutorial.step !== 'choose') return;
  round.laneAim = LANES[round.gate.types.indexOf(id)]; round.questionChosen = true; hud.chooseLane(id);
}
function tutorialTap(direction) {
  if (!tutorial || !round.running || round.paused) return;
  const step = tutorial.step;
  if (step === 'steer-left' && direction === 'left' || step === 'steer-right' && direction === 'right' || step === 'choose') {
    round.laneAim = direction === 'left' ? 3.45 : -3.45;
    if (step === 'choose') round.questionChosen = true;
  }
}
function finishTutorial() {
  round.running = false; round.finished = true; round.inputs.left = round.inputs.right = false; round.boost = 0; round.velocity = 0; screenEl.classList.remove('boosting'); screenEl.classList.add('tutorial-done'); silence();
  tutorialCompleted = true;
  try { tutorialSaved = saveTutorialCompleted(progressStorage); } catch { tutorialSaved = false; }
  hud.resetLanes(); renderLobby(); tutorialSpeak(['tutorial-finish'], '좋아, 준비 끝! 이제 진짜 레이스를 시작하자.'); renderTutorial();
}
function updateTutorial(dt) {
  round.elapsed += dt; tutorialIdle += dt;
  const step = tutorial.step, steering = (round.inputs.left ? 1 : 0) - (round.inputs.right ? 1 : 0);
  if (step === 'listen') round.playerOffset = lerp(round.playerOffset, 0, 1 - Math.exp(-dt * 4));
  else if (round.laneAim !== null && !steering) round.playerOffset = lerp(round.playerOffset, round.laneAim, 1 - Math.exp(-dt * 4));
  else round.playerOffset += steering * dt * 5.8;
  round.playerOffset = clamp(round.playerOffset, -4.5, 4.5);
  if (step === 'steer-left' || step === 'steer-right') {
    if (tutorial.observeOffset(round.playerOffset)) {
      tutorialIdle = 0; round.inputs.left = round.inputs.right = false; round.laneAim = null;
      if (tutorial.step === 'steer-right') repeatTutorial(); else beginTutorialQuestion();
      renderTutorial();
    }
  }
  const selecting = tutorial.step === 'choose', waiting = tutorial.step === 'listen' || selecting && (!round.questionChosen || tutorialVoicePending) || tutorial.step === 'boost-ready';
  const steeringStep = tutorial.step === 'steer-left' || tutorial.step === 'steer-right';
  const desired = waiting || steeringStep && round.playerS >= 205 ? 0 : tutorial.step === 'boosting' ? 42 : 12;
  round.velocity = lerp(round.velocity, desired, 1 - Math.exp(-dt * 4));
  round.playerS += round.velocity * dt;
  if (steeringStep) round.playerS = Math.min(round.playerS, 205);
  if (waiting && round.gate) round.playerS = Math.min(round.playerS, round.gate.s - 18);
  if (selecting && round.gate && round.playerS >= round.gate.s) {
    const chosen = round.gate.types[clamp(Math.round((round.playerOffset + 3.45) / 3.45), 0, 2)];
    round.questionChosen = false; round.laneAim = null; round.inputs.left = round.inputs.right = false;
    if (tutorial.resolveAnswer(chosen)) {
      hud.markLanes(chosen, round.gate.q.answer); disposeGate(); mascotMood('cheer', 3); ding(true); hud.pop('정답! 부스터', 1);
      tutorialSpeak(['tutorial-correct', 'tutorial-boost'], '정답! 부스터가 가득 찼어. 정답을 맞히면 차가 저절로 빨라져. 부스터로 달려 보자!');
    } else {
      if (round.playerS > ROAD_END - 200) { round.playerS = 205; camera.position.copy(roadPoint(round.playerS - (mobile ? 10 : 7.7), round.playerOffset * (mobile ? .92 : .62), mobile ? 3.75 : 3.45)); }
      makeGate(0, round.playerS + 35); round.gate.announced = true; hud.showLanes(); round.velocity = 0; tutorialIdle = 0; tutorialGoHint = false; ding(false);
      tutorialSpeak(['tutorial-retry'], '앗, 사과는 오른쪽이야. 다시 가 보자!');
    }
    renderTutorial();
  }
  if (selecting && !round.questionChosen && !tutorialVoicePending && tutorialIdle > 4 && !tutorialGoHint) { tutorialGoHint = true; tutorialSpeak(['tutorial-go'], '위쪽 화살표를 눌러서 출발해 봐.'); }
  if (tutorial.step === 'boosting') { round.boost = Math.max(0, round.boost - dt); if (tutorial.tick(dt)) finishTutorial(); }
  placeCar(car, round.playerS, round.playerOffset, steering * .045); car.rotation.z = -steering * .008;
  for (const wheel of wheels) wheel.rotation.x -= round.velocity * dt * 2.3;
  for (const jet of car.userData.jets) { jet.visible = round.boost > 0; jet.scale.y = .85; }
  screenEl.classList.toggle('boosting', round.boost > 0 && !reducedMotion); setText($('speed'), Math.round(round.velocity * 3.6));
  if (round.soundEnabled && audio) {
    motor.frequency.setTargetAtTime(45 + round.velocity * 1.8, audio.currentTime, .15);
    motorGain.gain.setTargetAtTime(narrator.playing ? .014 : round.running ? .045 : 0, audio.currentTime, .12);
    windGain.gain.setTargetAtTime(round.running ? round.velocity * (narrator.playing ? .0003 : .001) : 0, audio.currentTime, .15);
  }
}

/* ── 한 판 시작 ── */
async function start(demo = false, bypassTutorial = false) {
  if (assignment()) {
    if (demo) { lobbyNote('이번 목표는 직접 응답하며 연습해요.'); return; }
    const plan = nextPersonalized();
    if (!plan) { lobbyNote(targetUnavailable()); return; }
    round.selectedStage = plan.stage;
  }
  if (starting || !demo && !isUnlocked(round.selectedStage)) return;
  // 3D가 아직 준비 중이면 누른 것을 기억했다가 준비되는 대로 출발한다(소리는 누른 순간에 연다).
  if (!ready) { if (loadState === 'loading') { pendingStart = { demo }; if (round.soundEnabled) void ensureAudio(); renderLobby(); } return; }
  if (!demo && !bypassTutorial && !tutorialCompleted && !tutorialDismissed) { await startTutorial(); return; }
  clearTutorial();
  if (garageOpen) garageUI.close();
  round.garage = loadGarageSafe(); round.roundId = globalThis.crypto?.randomUUID?.() || `race-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  starting = true; round.running = false; round.narrationUnavailable = false; silence(); coastRadio.stop(); renderLobby();
  if (!round.soundTouched) { round.soundEnabled = true; updateSoundButton(); }
  if (round.soundEnabled) { try { await ensureAudio(); await narrator.prepare([...commonClips, ...stageClips(round.selectedStage)]); } catch { round.narrationUnavailable = true; } }
  round.auto = demo; round.roundWasDemo = demo; round.questionBank = makeQuestions(round.selectedStage); starting = false;
  const opening = startLive();
  showRace(); reset(true); renderLobby();
  speak(['intro'], '출발! 문제를 잘 듣고, 답이 있는 길로 달려 줘!', 'intro');
  if (opening) showToast(opening, 2.6);
  clock.getDelta();
}

/* ── 소리 ── */
async function ensureAudio() {
  if (!round.soundEnabled) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  if (!audio) {
    audio = new AudioContext(); motor = audio.createOscillator(); motor.type = 'sawtooth'; motor.frequency.value = 65;
    const filter = audio.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 330;
    motorGain = audio.createGain(); motorGain.gain.value = 0; motor.connect(filter); filter.connect(motorGain); motorGain.connect(audio.destination); motor.start();
    const buffer = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate), data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * .25;
    const wind = audio.createBufferSource(); wind.buffer = buffer; wind.loop = true;
    const wf = audio.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 750;
    windGain = audio.createGain(); windGain.gain.value = 0; wind.connect(wf); wf.connect(windGain); windGain.connect(audio.destination); wind.start();
  }
  void coastRadio.unlock();
  if (audio.state === 'suspended') await audio.resume();
}
function ding(success) {
  if (!audio || !round.soundEnabled) return;
  for (let i = 0; i < (success ? 3 : 1); i++) {
    const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime + i * .07;
    o.type = 'sine'; o.frequency.value = success ? [659, 830, 988][i] : 440;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.07, t + .008); g.gain.exponentialRampToValueAtTime(.001, t + .24);
    o.connect(g); g.connect(audio.destination); o.start(t); o.stop(t + .25);
  }
}

/* ── 처음으로 ── */
// 레이스를 접는다(입구·차고로 갈 때). 들은 문제는 응답 없음으로 닫힌다(disposeGate).
function leaveRace() {
  round.running = false; round.auto = false; pendingStart = null; silence(); endLive(); clearTutorial();
  if (ready) reset(false);
  closeDialog($('pause-dialog'));
}
function home() { leaveRace(); showLobby(); }

/* ── 주행 효과: 접촉 소리·불꽃·보호막 ── */
function contactSound() {
  if (!audio || !round.soundEnabled) return;
  const source = audio.createBufferSource(), buffer = audio.createBuffer(1, 4800, audio.sampleRate), data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / 600);
  source.buffer = buffer;
  const filter = audio.createBiquadFilter(), gain = audio.createGain();
  filter.type = 'lowpass'; filter.frequency.value = 680; gain.gain.value = narrator.playing ? .022 : .11;
  source.connect(filter); filter.connect(gain); gain.connect(audio.destination);
  source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
  source.start();
}
function contactSparks(hit) {
  if (reducedMotion) return;
  if (!scenery.sparks) {
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(24 * 3), 3));
    scenery.sparks = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffdaa0, size: .075, transparent: true, opacity: .75, depthWrite: false })); scene.add(scenery.sparks);
  }
  const origin = roadPoint(round.playerS, round.playerOffset - hit.direction * .7, .5), positions = scenery.sparks.geometry.attributes.position;
  scenery.sparks.userData.motion = [];
  for (let i = 0; i < 24; i++) { positions.setXYZ(i, origin.x, origin.y, origin.z); scenery.sparks.userData.motion.push({ x: (Math.random() - .5) * 3, y: Math.random() * 2.2, z: -Math.random() * 6 }); }
  positions.needsUpdate = true; scenery.sparks.visible = true; sparkLife = .42;
}
function updateShield(dt) {
  round.shieldFlash = Math.max(0, round.shieldFlash - dt);
  if (!round.shield && !round.shieldFlash && !car.userData.shield) return;
  if (!car.userData.shield) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.32, .035, 5, 64), new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: .65, depthWrite: false }));
    ring.rotation.x = Math.PI / 2; ring.scale.y = 1.95; ring.position.y = .2; car.add(ring); car.userData.shield = ring;
  }
  const ring = car.userData.shield;
  ring.visible = round.running && Boolean(round.shield || round.shieldFlash);
  ring.material.opacity = round.shieldFlash ? round.shieldFlash * .9 : .3 + (reducedMotion ? 0 : Math.sin(worldTime.value * 2.4) * .1);
}

/* ── 카메라와 한 장면 ── */
function updateCamera(dt) {
  light.target.position.copy(roadPoint(garageOpen ? 93 : round.playerS + 18, 0, 0)); light.position.copy(light.target.position).addScaledVector(sunDirection, 151);
  if (heroShot) return;   // 확인용 입구 그림 각도(?qa heroPose)는 그대로 둔다
  if (garageOpen) {
    // 차고 액자 가운데에 차가 오게: 액자 비율에 맞춰 거리를 정한다(차 길이 약 4.6m, 높이 약 1.3m).
    const center = garageStudio.group.position.clone().add(new THREE.Vector3(0, .7, 0)), fov = 34, tan = Math.tan(THREE.MathUtils.degToRad(fov / 2));
    const aspect = Math.max(.6, (stage.clientWidth || 1) / Math.max(1, stage.clientHeight || 1)), distance = Math.max(2.9 / (tan * aspect), 1.75 / tan) + 2;
    camera.position.copy(center).add(new THREE.Vector3(Math.sin(garageAngle) * distance, distance * .3, Math.cos(garageAngle) * distance));
    camera.lookAt(center); camera.fov = fov; camera.updateProjectionMatrix();
    return;
  }
  let pos, target, fov;
  if (round.running || round.finished) {
    const shortPortrait = mobile && stage.clientHeight < 640;
    // 뒤따르는 카메라는 속도/5만큼 늦게 따라온다. 그만큼 앞을 겨눠 차가 화면에서 위아래로 떠다니지 않게 한다(꼬리표·단추 자리도 고정된다).
    const lead = Math.max(0, round.velocity) / 5;
    pos = roadPoint(round.playerS + lead - (mobile ? (shortPortrait ? 11.2 : 8.8) : 9), round.playerOffset * (mobile ? .92 : .62), mobile ? 3.35 : 3.6);
    target = roadPoint(round.playerS + 24, round.playerOffset * (mobile ? .72 : .34), shortPortrait ? 1.1 : 1.55);
    fov = (round.boost > 0 || coastDrive.driving) && !reducedMotion ? 61 : mobile ? (shortPortrait ? 60 : 58) : 55;
  } else {
    pos = roadPoint(round.playerS - (mobile ? 12.5 : 7.4), mobile ? -1.8 : 5.4, mobile ? 4.5 : 3.6); target = roadPoint(round.playerS + (mobile ? 14 : 12), mobile ? 3.8 : 1.8, 1.2); fov = mobile ? 62 : 52;
  }
  // 화면은 흔들지 않는다(부딪혀도 카메라는 그대로 따라간다).
  camera.position.lerp(pos, 1 - Math.exp(-dt * 5)); camera.lookAt(target); camera.fov = lerp(camera.fov, fov, 1 - Math.exp(-dt * 3)); camera.updateProjectionMatrix();
}
function frame() {
  const raw = clock.getDelta(), dt = Math.min(raw, .055);
  // 준비 중에는 첫 장면을 반드시 그린다. 그 뒤로는 3D가 보일 때만 그린다.
  const pausedState = round.paused ? [mode, renderQuality.pixelRatio, stage.clientWidth, stage.clientHeight, driverName, car, scenery.theme] : [];
  if (!pausedFrameGate.shouldRender({ paused: round.paused, hidden: ready && (document.hidden || !worldShown), dt, state: pausedState })) {
    if (round.paused && !document.hidden) skippedPausedFrames++;
    return;
  }
  warmupFrames++;
  if (!round.paused) {
    worldTime.value += dt;
    if (scenery.sky) scenery.sky.position.copy(roadPoint(round.playerS));
    if (scenery.petals && !reducedMotion) { scenery.petals.position.copy(roadPoint(round.playerS, 0, 0)); scenery.petals.rotation.y = Math.sin(worldTime.value * .1) * .12; }
    if (sparkLife > 0) {
      sparkLife = Math.max(0, sparkLife - dt);
      const positions = scenery.sparks.geometry.attributes.position;
      scenery.sparks.userData.motion.forEach((v, i) => { v.y -= dt * 4; positions.setXYZ(i, positions.getX(i) + v.x * dt, positions.getY(i) + v.y * dt, positions.getZ(i) + v.z * dt); });
      positions.needsUpdate = true; scenery.sparks.material.opacity = sparkLife / .42 * .75; scenery.sparks.visible = sparkLife > 0;
    }
    if (round.running) { if (tutorial) updateTutorial(dt); else if (coastDrive.driving) updateCoastDrive(dt); else updateGame(dt); }
    if (round.gate) round.gate.fruitObjects.forEach((f, i) => { f.rotation.y = (f.userData.spinBase || 0) + (reducedMotion ? 0 : Math.sin(worldTime.value * .9 + i) * .11); });
    updateMascot(dt); updateShield(dt);
    updateCamera(dt);
    if (round.toastTime > 0) { round.toastTime -= dt; if (round.toastTime <= 0) $('toast').hidden = true; }
    else if (round.laterToast && round.running) { const text = round.laterToast; round.laterToast = null; showToast(text, 2.6); }
  } else updateCamera(dt);
  const focusS = garageOpen ? 93 : round.playerS, quiet = round.paused || garageOpen || document.hidden;
  scenery.details?.update({ time: worldTime.value, playerS: round.playerS, motion: !reducedMotion, detailDistance: renderQuality.detailDistance, quality: mode });
  scenery.terrain?.update({ playerS: focusS, quality: mode, camera });
  scenery.rockShelves?.update({ playerS: round.playerS, quality: mode, camera });
  scenery.boats?.update({ dt, time: worldTime.value, playerS: round.playerS, quality: mode, camera, paused: quiet, motion: !reducedMotion });
  scenery.city?.update({ playerS: focusS, quality: mode, camera, time: worldTime.value });
  scenery.cityLife?.update({ time: worldTime.value, playerS: focusS, playerX: car?.position.x ?? pathX(round.playerS), quality: mode, camera, motion: !reducedMotion, paused: quiet, celebrating: round.running && round.boost > 0 });
  renderer.render(scene, camera);
  renderedFrames++;
  if (!round.paused && !document.hidden && warmupFrames > 35 && raw < .3) { frameSample.push(raw); if (frameSample.length > 120) frameSample.shift(); renderFrames++; renderTotal += raw; adaptiveTime += raw; }
  if (currentQuality === 'auto' && mode !== 'low' && adaptiveTime > 7 && frameSample.length > 90) {
    const average = frameSample.reduce((a, b) => a + b, 0) / frameSample.length, next = slowerQuality(mode, average);
    if (next !== mode) { mode = next; applyRenderQuality(); frameSample = []; }
    adaptiveTime = 0;
  }
}

/* ── 소리 단추 ── */
function updateSoundButton(){syncSoundToggles();}

/* ── 이벤트 ── */
syncSoundToggles = bindSoundToggles({ isOn: () => round.soundEnabled, setOn: (on) => { if (on !== round.soundEnabled) void toggleSound(); } });
$('start').addEventListener('click', onStartClick);
$('watch').addEventListener('click', () => start(true));
$('replay').addEventListener('click', () => start(round.roundWasDemo));
$('home').addEventListener('click', home);
$('exit').addEventListener('click', home);
$('pause').addEventListener('click', pause);
$('resume').addEventListener('click', resume);
$('pause-dialog').addEventListener('cancel', (e) => { e.preventDefault(); resume(); });   // Esc: 창을 닫고 이어 달린다
const QUALITY_NEXT = { auto: 'high', high: 'low', low: 'auto' }, QUALITY_LABEL = { auto: '화질 자동', high: '화질 선명', low: '화질 가벼움' };
$('quality').addEventListener('click', () => { const next = QUALITY_NEXT[$('quality').value] || 'auto'; $('quality').value = next; $('quality').textContent = QUALITY_LABEL[next]; setQuality(next); });
$('cruise-results').addEventListener('click', showCruiseResults);
$('return-cruise').addEventListener('click', returnToCruise);
$('cruise-track').addEventListener('click', async () => { round.soundEnabled = true; round.soundTouched = true; updateSoundButton(); await ensureAudio(); syncCoastRadio(); });
for (const link of document.querySelectorAll('[data-open-garage]')) link.addEventListener('click', (e) => { e.preventDefault(); openGarage(); });
$('result-garage').addEventListener('click', openGarage);
wireGameLinks();
window.addEventListener('storage', (e) => {
  if (e.key !== 'SYNK_PLAY_COLLECTION_V1') return;
  round.garage = loadGarageSafe(); renderCollection();
  if (garageOpen) { garageUI.render(); previewEquipment(garageUI.previewItem); }
});
window.addEventListener('synk:collection-change',()=>{round.garage=loadGarageSafe();renderCollection();if(garageOpen){garageUI.render();previewEquipment(garageUI.previewItem);}});
$('repeat-question').addEventListener('click', async () => {
  if (!round.running || round.paused || round.gate?.judged) return;
  if (!round.soundEnabled) { round.soundEnabled = true; round.soundTouched = true; updateSoundButton(); setQuestionExpanded(false); }
  await ensureAudio(); narrateQuestion(true);
});
$('subtitles').addEventListener('click', () => { round.subtitlesOn = !round.subtitlesOn; $('subtitles').setAttribute('aria-pressed', String(round.subtitlesOn)); displayQuestion(); });
$('question-toggle').addEventListener('click', () => { if (!round.running || round.paused || !round.gate?.announced || round.gate.judged) return; setQuestionExpanded(!round.questionExpanded); });
$('go').addEventListener('click', chooseCurrentLane);
$('feedback-continue').addEventListener('click', continueFeedback);
$('tutorial-replay').addEventListener('click', () => { if (!ready) { lobbyNote('해안도로를 준비하고 있어요. 잠시 뒤에 다시 눌러 주세요.'); return; } startTutorial(); });
$('tutorial-repeat').addEventListener('click', async () => {
  if (!tutorial || round.paused) return;
  if (!round.soundEnabled) { round.soundEnabled = true; round.soundTouched = true; updateSoundButton(); }
  await ensureAudio(); repeatTutorial();
});
function continueAfterTutorial() { if (!isUnlocked(round.selectedStage)) selectStage(recommendedStage(round.progress)); silence(); start(false, true); }
$('tutorial-skip').addEventListener('click', () => { if (!tutorial) return; tutorialDismissed = true; continueAfterTutorial(); });
$('tutorial-race').addEventListener('click', continueAfterTutorial);
$('tutorial-home').addEventListener('click', home);
$('next-stage').addEventListener('click', () => { const next = nextStage(); if (next) { const demo = round.roundWasDemo; selectStage(next); start(demo); } });
$('reset-learning').hidden = hosted;
$('reset-learning').addEventListener('click', () => {
  // 실제로 지운 경우에만 지웠다고 말한다. 계정 기록은 WORLD에서 지우며, 그 거절은 학습 실패가 아니다.
  let message = '학습 기록을 지우지 못했어요. 다시 시도해 주세요.';
  try { const result = coach?.reset(); if (result?.storage?.available) message = '이 기기의 공통 맞춤 학습 기록을 지웠어요.'; }
  catch (error) { if (error?.code === 'ACCOUNT_RESET_REQUIRED') message = '계정의 학습 기록은 WORLD 계정 설정에서 관리해 주세요.'; else learningAvailable = false; }
  renderLobby(); lobbyNote(message);
});
for (const name of ['marin', 'kkamong']) $(`driver-${name}`).addEventListener('click', () => { selectDriver(name); renderLobby(); });
for (const direction of ['left', 'right']) {
  const b = $(direction);
  b.addEventListener('pointerdown', (e) => {
    if (!round.running || round.paused) return;
    e.preventDefault();
    if (round.gate?.announced) round.questionChosen = true;
    round.laneAim = null; round.auto = false; $('demo-indicator').hidden = true; round.inputs[direction] = true; b.classList.add('held'); b.setPointerCapture(e.pointerId);
  });
  const release = (e) => { round.inputs[direction] = false; if (e.type === 'pointerup') tutorialTap(direction); b.classList.remove('held'); };
  b.addEventListener('pointerup', release); b.addEventListener('pointercancel', release); b.addEventListener('lostpointercapture', release);
}
document.querySelector('[data-reload]').addEventListener('click', () => location.reload());
window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLSelectElement || e.target instanceof HTMLInputElement) return;
  if (document.querySelector('dialog[open]')) return;   // 멈춤·코스 창이 열려 있으면 창이 키를 맡는다
  // 기본 동작을 막는다: 막지 않으면 같은 Esc가 방금 연 멈춤 창을 바로 닫아(cancel) 이어 달린다.
  if (e.code === 'Escape') { e.preventDefault(); if (garageOpen) garageUI.close(); else if (round.running) pause(); return; }
  if (['ArrowUp', 'KeyW'].includes(e.code) && round.running && !round.paused) { e.preventDefault(); if (!e.repeat) chooseCurrentLane(); return; }
  const direction = ['ArrowLeft', 'KeyA'].includes(e.code) ? 'left' : ['ArrowRight', 'KeyD'].includes(e.code) ? 'right' : null;
  if (direction && round.running && !round.paused) { e.preventDefault(); if (round.gate?.announced) round.questionChosen = true; round.laneAim = null; round.auto = false; $('demo-indicator').hidden = true; round.inputs[direction] = true; }
});
window.addEventListener('keyup', (e) => {
  if (['ArrowLeft', 'KeyA'].includes(e.code)) { round.inputs.left = false; tutorialTap('left'); }
  if (['ArrowRight', 'KeyD'].includes(e.code)) { round.inputs.right = false; tutorialTap('right'); }
});
window.addEventListener('blur', () => { round.inputs.left = round.inputs.right = false; if (round.running && !round.paused) pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && round.running && !round.paused) pause(); });

/* ── 읽기 전용 관찰(시험·확인을 숨은 우회 없이 되풀이하게) ── */
window.__racing = {
  snapshot: () => ({
    questionPace: questionPace.snapshot(), coastDrive: coastDrive.snapshot(), coastRadio: coastRadio.snapshot(), ready, startup: { ...startup }, screen: currentScreen(), worldShown,
    running: round.running, paused: round.paused, auto: round.auto, roundWasDemo: round.roundWasDemo, elapsed: round.elapsed, playerS: round.playerS, playerOffset: round.playerOffset,
    tutorial: tutorial ? { step: tutorial.step, mistakes: tutorial.mistakes, boostElapsed: tutorial.boostElapsed, voicePending: tutorialVoicePending, completed: tutorialCompleted, saved: tutorialSaved } : null,
    collection: { coins: round.garage.coins, owned: [...round.garage.owned], equipped: { ...round.garage.equipped }, wish: round.garage.wish, mission: dailyMission(round.progress, Date.now(), round.garage), garageOpen, preview: previewCar?.userData.vehicleKind, angle: garageAngle },
    driving: { collisions: round.collisions, contactTimer: round.contactTimer, combo: round.combo, bestCombo: round.bestCombo, shield: round.shield, shieldBlocked: round.shieldBlocked, rivals: rivals.map((r) => ({ s: r.s, offset: r.offset })), waitingForChoice: round.questionChosen === false },
    scenery: scenery.theme, atmosphere: scenery.atmosphere?.stats, boats: scenery.boats?.stats, boatPoses: scenery.boats?.group.userData.poseSnapshots, rockShelves: scenery.rockShelves?.stats,
    landscape: scenery.coast?.userData.stats, city: scenery.city?.stats, cityLife: scenery.cityLife?.stats, groundProps: scenery.groundProps, terrain: scenery.terrain?.stats, vegetation: scenery.details?.stats,
    screenX: car ? +car.position.clone().project(camera).x.toFixed(4) : null, driver: { name: driverName, mood: driverMood, seated: !!car?.userData.mascot }, vehicle: car?.userData.modelStats,
    velocity: round.velocity, boost: round.boost, correct: round.correct, answers: round.answers.map((a) => ({ ...a })),
    flow: { cruise: round.cruise, active: !!live, values: (() => { try { return live ? live.settings().values : null; } catch { return null; } })() },
    stage: { id: round.selectedStage.id, title: round.selectedStage.title, mode: round.selectedStage.mode, level: round.selectedStage.level, campaign: round.selectedStage.campaign, words: round.selectedStage.words },
    gate: round.gate ? { s: round.gate.s, prompt: round.gate.q.prompt, spoken: round.gate.q.spoken, types: [...round.gate.types], questionId: round.gate.q.id, announced: round.gate.announced } : null,
    quality: mode, narration: narrator.snapshot(), audioState: audio?.state, audioClock: audio?.currentTime, narrationUnavailable: round.narrationUnavailable,
    learning: { words: Object.keys(round.progress.words).length, correctWords: Object.values(round.progress.words).filter((p) => p.correct > 0).length, rounds: round.progress.rounds, cleared: Object.values(round.progress.stages).filter((p) => p.cleared).length },
    render: { renderedFrames, skippedPausedFrames, programs: renderer?.info.programs?.length, pixelRatio: renderer?.getPixelRatio(), calls: renderer?.info.render.calls, triangles: renderer?.info.render.triangles,
      geometries: renderer?.info.memory.geometries, textures: renderer?.info.memory.textures, averageFps: frameSample.length ? +(frameSample.length / frameSample.reduce((a, b) => a + b, 0)).toFixed(1) : 0 },
    viewport: { width: stage.clientWidth, height: stage.clientHeight },
  }),
};

/* ── 확인용(?qa): 빨리 감기·음성 끝내기·입구 그림 각도 ── */
if (QA) installQaHook({
  THREE,
  get camera() { return camera; }, get canvas() { return renderer?.domElement; }, get gate() { return round.gate; }, get car() { return car; },
  state: () => ({ ready, running: round.running, paused: round.paused, finished: round.finished, screen: currentScreen(), gateIndex: round.gateIndex, total: round.questionBank.length, answers: round.answers.map((a) => ({ ...a })), correct: round.correct, boost: round.boost, velocity: round.velocity, offset: round.playerOffset,
    gate: round.gate ? { announced: round.gate.announced, judged: round.gate.judged, answer: round.gate.q.answer, types: [...round.gate.types], screenOrder: [...round.gate.types].reverse(), mode: round.gate.q.mode, heard: !!round.gate.heard, readyAt: round.gate.readyAt ?? null, expanded: round.questionExpanded } : null,
    coast: coastDrive.snapshot(), tutorial: tutorial?.step ?? null, narrating: narrator.playing, narrationKind: narrator.activeKind, coins: round.garage.coins, stage: round.selectedStage.id }),
  advance(seconds) {
    for (let i = 0; i < Math.round(seconds * 60) && round.running && !round.paused; i++) {
      worldTime.value += 1 / 60;
      if (tutorial) updateTutorial(1 / 60); else if (coastDrive.driving) updateCoastDrive(1 / 60); else updateGame(1 / 60);
      updateCamera(1 / 60);   // 카메라도 실제 걸음대로 따라온다(화면 확인이 실제 플레이와 같게)
    }
  },
  hearNow() {
    if (!round.gate?.announced || round.gate.judged) return false;
    narrator.cancel(); round.gate.heard = true;
    if (round.gate.presentationId) learn((c) => c.delivery(round.gate.presentationId, { audio: 'completed' }));
    questionReady(); renderQuestion(); return true;
  },
  heroPose({ s = 520, offset = 1.6, side = 6.4, back = -9.5, height = 2.1, look = .9, fov = 38, rivalsAt = [26, 44] } = {}) {
    showRace(); document.body.classList.add('qa-clean'); round.running = false; round.finished = false; round.paused = false; heroShot = true;
    round.playerS = s; round.playerOffset = offset; placeCar(car, s, offset); car.visible = true;
    rivals.forEach((r, i) => { r.s = s + rivalsAt[i]; placeCar(r.mesh, r.s, r.offset); });
    if (round.gate?.group) round.gate.group.visible = false;
    camera.position.copy(roadPoint(s - back, offset + side, height)); camera.lookAt(roadPoint(s, offset - .4, look)); camera.fov = fov; camera.updateProjectionMatrix();
    worldShown = true; pausedFrameGate.invalidate();
  },
  render: () => window.__racing.snapshot().render,
});

/* ── 시작 ── */
renderLobby();
if (new URLSearchParams(location.search).get('garage') === '1') openGarage();
init();
