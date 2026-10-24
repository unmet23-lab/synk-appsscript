// 레이싱 한 판의 진행 제어(E08, 2026-10-23): 출발 초기화 → 달리기(문제 게이트·판정·접촉) → 멈춤·이어하기 →
// 완주(기록·공통 코인 확정) → 해안 드라이브 → 결과 → 다시 드라이브·다음 코스, 그리고 소리 켜고 끄기와 해안 라디오.
// 한 판의 상태(state)는 이 컨트롤러가 만들고 갖는다. app.js는 3D 장면·튜토리얼·입구·차고·입력을 맡고 그 상태를 읽는다.
// 화면·소리·3D·학습·저장은 아래 포트로만 부른다. 기존 coast-drive·race-pacing·driving·garage·learning·personalization
// 모듈을 그대로 쓰고, 새 게임 엔진을 만들지 않는다.
import { STAGES, WORD_BY_ID, PROGRESS_KEY, loadProgress as readProgress, recordRound as recordProgress, answerFeedback } from './learning.js';
import { campaignUnlocked, recommendedStage, medalFor } from './campaign.js';
import { finaleUnlocked } from './finales.js';
import { resolveContact, shieldContact, comboShield } from './driving.js';
import { racingFollowUp, racingRecheck, linkRacingRecheck, BASE_CRUISE, racePressure, describeRace } from './personalization.js';
import { SHOP_ITEMS, awardRace as awardCoins } from './garage.js';
import { createCoastDrive } from './coast-drive.js';
import { createQuestionPace, gatePosition, QUESTION_LEAD, rewardBoost } from './race-pacing.js';
import { questionNarration } from './question-audio.js';
import { ROAD_END } from './course.js';
import { ALL_COURSES, labelStage } from './lobby.js';

export const LANES = [-3.45, 0, 3.45];
// THREE.MathUtils와 같은 식(브라우저 판과 숫자가 같도록).
const clamp = (value, min, max) => Math.max(min, Math.min(max, value)), lerp = (x, y, t) => (1 - t) * x + t * y;

/** 한 판(과 그 판이 쓰는 진도·차고·코스)의 상태. 처음 값만 받고, 바꾸는 것은 컨트롤러 메서드와 app.js의 출발·연습 흐름이다. */
export function createRaceState(initial = {}) {
  return {
    running: false, paused: false, finished: false, auto: false, roundWasDemo: false, roundId: '',
    playerS: 75, playerOffset: 0, velocity: 26, elapsed: 0, boost: 0, answers: [], correct: 0,
    inputs: { left: false, right: false }, aimOffset: 0, laneAim: null, toastTime: 0, laterToast: null,
    contactTimer: 0, collisions: 0, combo: 0, bestCombo: 0, questionChosen: false, questionExpanded: false,
    shield: 0, shieldBlocked: 0, shieldFlash: 0, gate: null, gateIndex: 0,
    soundEnabled: true, soundTouched: false, subtitlesOn: false, narrationUnavailable: false,
    cruise: BASE_CRUISE, flowStart: null, selectedStage: null, questionBank: [], progress: null, garage: null,
    ...initial,
  };
}

/**
 * 포트:
 *  view     { $, hud, screenEl, showScreen, showRace, openDialog, closeDialog, renderResults, renderLobby, renderCollection, syncSoundToggles, hidden() }
 *  sound    { narrator, speak(ids,text,kind,{interrupt,presentationId}), quiet(), ensureAudio(), ding(success), contact(), engineCoast(velocity), engineRace(velocity,boost,kind) }
 *  scene    { car(), wheels(), rivals(), placeCar(mesh,s,offset,yaw), buildGate({q,types,s}), removeGate(gate), applyEquipment(), hideRoundEffects(),
 *             resetCamera(playerS), wrapCamera(playerS,offset), mascotMood(mood,seconds), contactSparks(hit) }
 *  learning { learn(action,fallback), presentGate(q), answerGate(pid,response,flow), endLive(), nextPersonalized(), learningScope() }
 *  rewards  { account(), storage, loadGarage(), storeGarage(state), wishText(), awardRace, recordRound, loadProgress }
 *  tutorial { active(), chooseLane(), tapLane(id), render(), repeat(), delivered(), clearVoice() }
 *  coastRadio · clock{getDelta} · reducedMotion · coastDrive · questionPace (기본은 새로 만든다)
 */
export function createRaceController({ view, sound, scene, learning, rewards, tutorial, coastRadio, clock, reducedMotion = false,
  coastDrive = createCoastDrive(), questionPace = createQuestionPace(), state = {} }) {
  const s = createRaceState(state), { $, hud } = view, learn = (action, fallback = null) => learning.learn(action, fallback);
  const awardRace = rewards.awardRace || awardCoins, recordRound = rewards.recordRound || recordProgress, loadProgress = rewards.loadProgress || readProgress;

  function setText(node, value) { value = String(value); if (node.textContent !== value) node.textContent = value; }
  function silence() { sound.narrator.cancel(); sound.quiet(); }
  function syncCoastRadio() {
    coastRadio.setState({ active: coastDrive.active, enabled: s.soundEnabled, paused: s.paused || !s.running || !coastDrive.driving || view.hidden() });
    $('cruise-track').textContent = coastRadio.snapshot().blocked ? '♫ 해안선 · 눌러서 음악 켜기' : s.soundEnabled ? '♫ SYNK CITY POP · 해안선' : '♫ 해안선 · 소리 켜기';
  }
  function speak(ids, text, kind = 'comment', interrupt = false, presentationId = null) { if (s.soundEnabled) sound.speak(ids, text, kind, { interrupt, presentationId }); }
  function showToast(message, seconds = 2.5) { $('toast').textContent = message; $('toast').hidden = false; s.toastTime = seconds; }
  const isUnlocked = stage => (stage.finale ? finaleUnlocked(s.progress, stage) : campaignUnlocked(s.progress, stage));

  /* ── 문제 카드와 차선 고르기 ── */
  function setQuestionExpanded(open) {
    s.questionExpanded = open;
    if (open && s.gate?.presentationId && s.gate.q.mode !== 'reading') learn((c) => c.help(s.gate.presentationId, 'text'));
    renderQuestion();
  }
  function chooseCurrentLane() {
    if (tutorial.active()) { tutorial.chooseLane(); return; }
    const gate = s.gate;
    if (!s.running || s.paused || !gate?.announced || gate.judged) return;
    s.questionChosen = true; s.auto = false; $('demo-indicator').hidden = true;
    // 답 꼬리표로 이미 고른 길로 가는 중이면 ↑는 그 길을 그대로 고른다(지금 차가 있는 길로 되돌리지 않는다).
    const steering = s.inputs.left || s.inputs.right, aimed = s.laneAim !== null && !steering ? LANES.indexOf(s.laneAim) : -1;
    const lane = aimed >= 0 ? aimed : clamp(Math.round((s.playerOffset + 3.45) / 3.45), 0, 2);
    gate.intentChoice = gate.types[lane]; gate.choseAt = s.elapsed;
    if (!steering) s.laneAim = LANES[lane];
    hud.chooseLane(gate.intentChoice); setQuestionExpanded(false);
  }
  // 차선 답 꼬리표를 누르면 그 길로 옮기고 고른 것으로 친다.
  function pickLane(id) {
    const gate = s.gate;
    if (!s.running || s.paused || !gate || gate.judged) return;
    if (tutorial.active()) { tutorial.tapLane(id); return; }
    s.questionChosen = true; gate.intentChoice = id; gate.choseAt = s.elapsed; s.laneAim = LANES[gate.types.indexOf(id)];
    s.inputs.left = s.inputs.right = false; s.auto = false; $('demo-indicator').hidden = true;
    hud.chooseLane(id); setQuestionExpanded(false);
  }
  // 문제 전체를 보고 고를 수 있게 된 때(읽기·글로 연 문제는 나타날 때, 듣기는 음성이 끝날 때). 고르기까지 걸린 시간은 여기부터 잰다.
  function questionReady() { const gate = s.gate; if (gate && gate.announced && !gate.judged && gate.readyAt == null) { gate.readyAt = s.elapsed; gate.readyRoad = gate.s - s.playerS; } }
  function displayQuestion() {
    if (tutorial.active()) { tutorial.render(); return; }
    const gate = s.gate;
    if (!gate?.announced || gate.judged) return;
    const fallback = !s.soundEnabled || s.narrationUnavailable;
    if (fallback || gate.q.mode === 'reading') setQuestionExpanded(true);
    if (s.subtitlesOn && gate.q.mode !== 'reading' && gate.presentationId) learn((c) => c.help(gate.presentationId, 'text'));
    renderQuestion();
  }
  // 문제 카드에 지금 단계(듣기 → 고르기, 펼침)를 그린다. 낱말 문제는 고르기 전까지 낱말을 글로 보이지 않는다.
  function renderQuestion() {
    const gate = s.gate;
    if (tutorial.active() || !gate?.announced || gate.judged) return;
    const q = gate.q, reading = q.mode === 'reading', fallback = !s.soundEnabled || s.narrationUnavailable, campaign = !!s.selectedStage.campaign;
    const heardAll = gate.readyAt != null, kind = reading ? '읽기' : q.mode === 'picture' ? '그림' : '듣기';
    let ask, help;
    if (s.questionExpanded) {
      ask = campaign ? q.prompt : q.mode === 'picture' ? `“${q.word}” 그림이 있는 길을 찾아요` : `들은 단어: “${q.word}”`;
      help = reading ? '지문을 읽고 답이 있는 길로 가요. 고르는 동안 기다릴게요.' : fallback ? '소리 대신 글로 열었어요. 답 꼬리표를 누르면 그 길로 가요.'
        : '펼친 동안 차가 기다려요. 답 꼬리표를 누르거나 접고 달려요.';
    } else if (!heardAll) { ask = '잘 들어 보세요'; help = '문제와 세 길의 답을 차례로 들려줘요.'; }
    else {
      ask = campaign ? q.prompt : q.mode === 'picture' ? '들은 단어의 그림이 있는 길로 가요' : '들은 단어가 있는 길로 가요';
      help = campaign ? '답이 있는 길로 옮기고 ↑로 출발해요. 고를 때까지 기다려요.' : '게이트를 지날 때 있는 길이 답이 돼요.';
    }
    hud.showQuestion({ phase: heardAll || s.questionExpanded ? 'choose' : 'listening', tag: `${kind} ${s.gateIndex + 1} / ${s.questionBank.length}`, ask,
      passage: s.questionExpanded && campaign ? q.passage : null, caption: s.subtitlesOn && !reading ? q.spoken : null, help, expanded: s.questionExpanded });
  }
  function narrateQuestion(interrupt = false) {
    const gate = s.gate;
    if (!gate || gate.judged || !gate.announced) return;
    displayQuestion();
    if (gate.q.mode === 'reading') { $('repeat-question').hidden = true; $('voice-status').textContent = '지문을 읽고 길을 골라요'; return; }
    if (interrupt && gate.presentationId) learn((c) => c.help(gate.presentationId, 'replay'));
    if (!s.soundEnabled && gate.presentationId) learn((c) => c.delivery(gate.presentationId, { audio: 'failed' }));
    const voice = questionNarration(gate.q, gate.types, WORD_BY_ID);
    speak(voice.ids, voice.text, 'question', interrupt, gate.presentationId);
  }

  /* ── 문제 게이트 ── */
  function makeGate(index, at) {
    if (index === s.questionBank.length - 1 && s.soundEnabled && !tutorial.active()) coastRadio.prepare();
    if (s.gate) disposeGate();
    const q = s.questionBank[index % s.questionBank.length], types = [...q.options];
    const { group, fruitObjects } = scene.buildGate({ q, types, s: at });
    s.gate = { group, s: at, q, types, fruitObjects, announced: false, judged: false }; s.questionChosen = false; setQuestionExpanded(false);
    $('go').hidden = true;
    // 추적 카메라가 +Z를 보므로 화면 왼쪽부터 놓으려면 월드 X 순서를 뒤집는다.
    const screenOrder = [...types].reverse();
    hud.setLanes(screenOrder.map((id) => ({ id, text: q.mode === 'picture' ? WORD_BY_ID[id].icon : WORD_BY_ID[id].word })), { picture: q.mode === 'picture', onPick: pickLane });
  }
  function disposeGate() {
    const gate = s.gate;
    if (!gate) return;
    // 듣고 지나친 문제(처음으로·다시 시작·다른 코스)는 틀린 답이 아니라 응답 없음으로 닫는다.
    if (gate.presentationId && !gate.judged && !s.roundWasDemo) { learn((c) => c.answer(gate.presentationId, { correct: null, assessable: false, reason: 'unanswered' })); gate.judged = true; }
    scene.removeGate(gate); s.gate = null;
  }

  /* ── 한 판 초기화 ── */
  function reset(play) {
    questionPace.reset();
    coastDrive.reset(); coastRadio.stop(); view.screenEl.classList.remove('coasting'); $('cruise-banner').hidden = true; $('cruise-action').hidden = true; $('cruise-loop').style.opacity = '0';
    scene.applyEquipment(); s.shield = 0; s.shieldBlocked = 0; s.shieldFlash = 0;
    s.playerS = 75; s.playerOffset = 0; s.aimOffset = 0; s.laneAim = null; s.elapsed = 0; s.boost = 0; s.correct = 0; s.answers = []; s.gateIndex = 0; s.velocity = s.cruise; s.finished = false; s.paused = false;
    s.inputs.left = s.inputs.right = false; s.contactTimer = 0; s.collisions = 0; s.combo = 0; s.bestCombo = 0; s.questionChosen = false;
    scene.hideRoundEffects();
    scene.mascotMood('base');
    scene.rivals().forEach((r, i) => { r.s = 103 + i * 21; r.offset = i === 0 ? -3.15 : 3.1; r.mesh.visible = true; scene.placeCar(r.mesh, r.s, r.offset); });
    hud.resetLanes(); hud.hideQuestion(); hud.clearPop();
    makeGate(0, gatePosition(0)); scene.placeCar(scene.car(), s.playerS, 0);
    setText($('g-count'), `1 / ${s.questionBank.length}`); $('nitro-fill').style.clipPath = 'inset(0 100% 0 0)'; $('progress').style.width = '0%';
    setText($('rank'), '3 / 3'); setText($('speed'), Math.round(s.cruise * 3.6)); setText($('combo'), ''); setText($('nitro-label'), '부스터');
    $('repeat-question').hidden = false;
    $('toast').hidden = true; $('toast').textContent = ''; s.toastTime = 0; s.laterToast = null; view.screenEl.classList.remove('boosting');
    $('left').classList.remove('held'); $('right').classList.remove('held');
    s.running = play; view.screenEl.classList.toggle('playing', play); $('demo-indicator').hidden = !s.auto;
    view.closeDialog($('pause-dialog')); $('world-error').hidden = true;
    scene.resetCamera(s.playerS);
  }

  /* ── 멈춤·이어하기 ── */
  function pause() {
    if (!s.running || s.paused) return;
    s.paused = true; view.openDialog($('pause-dialog')); s.inputs.left = s.inputs.right = false; silence(); syncCoastRadio(); tutorial.clearVoice();
  }
  function resume() {
    s.paused = false; view.closeDialog($('pause-dialog')); clock.getDelta(); $('resume').blur();
    if (s.soundEnabled) void sound.ensureAudio(); syncCoastRadio();
    if (tutorial.active()) { tutorial.repeat(); return; }
    const gate = s.gate;
    if (gate && gate.announced && !gate.judged) { if (gate.heard && gate.presentationId) learn(c => c.help(gate.presentationId, 'replay')); narrateQuestion(); }
  }

  /* ── 완주 → 드라이브 → 결과 ── */
  function nextStage() {
    const stage = s.selectedStage;
    if (stage.personalized) return learning.nextPersonalized()?.stage || recommendedStage(s.progress);
    if (stage.review) return stage.campaign ? recommendedStage(s.progress) : STAGES[0];
    const collection = stage.campaign ? ALL_COURSES : STAGES;
    return collection[collection.findIndex(item => item.id === stage.id) + 1] || (stage.campaign ? learning.nextPersonalized()?.stage || recommendedStage(s.progress) : null);
  }
  function finish() {
    if (tutorial.active() || !coastDrive.complete(s.answers.length, s.questionBank.length)) return;
    // 마지막 해설은 드라이브 위에서 끝까지 듣는다(라디오는 그 아래로 낮춘다). 여기서 긴 말을 기다리면 차가 길 끝을 넘을 수 있다.
    s.finished = true; s.inputs.left = s.inputs.right = false; view.screenEl.classList.remove('boosting'); const flowEnd = learning.endLive();
    const rank = 1 + scene.rivals().filter(r => r.s > s.playerS).length, total = s.questionBank.length, passed = s.correct >= Math.ceil(total * .8);
    // Adaptive follow-ups can replace an item after the course was selected.
    // Reward the questions actually played; authored courses keep their canonical list.
    const completedStage = s.selectedStage.personalized ? { ...s.selectedStage, items: s.questionBank } : s.selectedStage;
    let earned, pendingReward = null; const finishedRound = s.roundId, account = rewards.account();
    const accountRound = !s.roundWasDemo && account.status().mode === 'account';
    if (accountRound) {
      pendingReward = account.wallet('awardRace', [
        { id: completedStage.id, ...(completedStage.campaign ? { questionIds: completedStage.items.map(q => q.id) } : { wordIds: completedStage.words }) },
        s.answers.map(a => ({ ...('id' in a ? { id: a.id } : {}), ...('answer' in a ? { answer: a.answer } : {}), correct: a.correct })),
        { automatic: false, roundId: s.roundId, collisions: s.collisions }
      ]);
      earned = { state: rewards.loadGarage(), coins: 0, breakdown: [], newUnlocks: [], reason: 'account-pending' };
    } else { earned = awardRace(rewards.loadGarage(), completedStage, s.answers, { automatic: s.roundWasDemo, beforeProgress: s.progress, roundId: s.roundId }); if (!s.roundWasDemo) rewards.storeGarage(earned.state); }
    // Account rewards and progress are one server transaction. Keep the next-course
    // UI responsive, but never queue this draft ahead of (or after) that transaction.
    s.progress = recordRound(s.progress, completedStage, s.answers, { automatic: s.roundWasDemo, collisions: s.collisions });
    let saved = true; if (!s.roundWasDemo && !accountRound) try { rewards.storage.setItem(PROGRESS_KEY, JSON.stringify(s.progress)); } catch { saved = false; }
    const next = nextStage();
    $('next-stage').disabled = !next || !s.roundWasDemo && !isUnlocked(next); $('next-stage').hidden = $('next-stage').disabled;
    $('next-stage').firstChild.textContent = next?.finale ? '챕터 결승전 달리기' : next?.personalized ? '맞춤 5문항 달리기' : next ? '다음 코스 달리기' : '마지막 코스예요';
    view.renderResults(resultSummary({ rank, total, passed, earned, saved, flowEnd, next }));
    view.renderLobby(); disposeGate(); setQuestionExpanded(false); s.boost = 0; hud.hideQuestion();
    $('progress').style.width = '100%';
    view.screenEl.classList.add('coasting'); $('cruise-banner').hidden = false; $('cruise-action').hidden = false;
    $('cruise-next').textContent = next?.finale ? '결과 · 다음 챕터' : next ? '결과 · 다음 코스' : '결과 · 다시 달리기';
    $('toast').hidden = true; s.toastTime = 0; s.laterToast = null;
    syncCoastRadio();
    const confirmReward = result => {
      if (s.roundId !== finishedRound || !s.finished) return;
      // Read the host's current record, including a retried receipt, rather than a
      // stale result snapshot. An older round must never replace the next round UI.
      s.progress = loadProgress(rewards.storage);
      s.garage = result.state; view.renderCollection(); view.renderLobby(); view.renderResults(resultSummary({ rank, total, passed, earned: result, saved, flowEnd, next }));
    };
    if (pendingReward) void pendingReward.then(confirmReward).catch(cause => {
      // The host marks only definitive rejections whose full command it preserved.
      // Unknown/network failures remain pending and can retry the original command.
      if (s.roundId !== finishedRound || !s.finished) return;
      if (cause.rejected !== true) {
        // Retry can acknowledge the preserved command after this Promise rejected.
        // Recover only its confirmed receipt; never issue another award command.
        let unsubscribe, settled = false;
        const restore = () => {
          if (settled) return;
          if (s.roundId !== finishedRound || !s.finished) { settled = true; unsubscribe?.(); return; }
          const current = rewards.loadGarage(), receipt = current.rewardedRounds[finishedRound];
          if (!receipt) return;
          settled = true; unsubscribe?.();
          confirmReward({ state: current, coins: receipt.coins, breakdown: [], newUnlocks: [], reason: null });
        };
        unsubscribe = rewards.account().subscribe(restore);
        if (settled) unsubscribe();
        return;
      }
      s.progress = loadProgress(rewards.storage); s.garage = rewards.loadGarage(); saved = false;
      $('next-stage').disabled = !next || !isUnlocked(next); $('next-stage').hidden = $('next-stage').disabled;
      view.renderCollection(); view.renderLobby();
      view.renderResults(resultSummary({ rank, total, passed, earned: { state: s.garage, coins: 0, breakdown: [], newUnlocks: [], reason: 'account-rejected' }, saved, flowEnd, next }));
    });
  }
  // 결과 화면에 줄 것: 맞힌 수·메달·순위·공통 코인·문제 목록·보상·다음 레이스.
  function resultSummary({ rank, total, passed, earned, saved, flowEnd, next }) {
    const demo = s.roundWasDemo, medal = demo ? 0 : medalFor(s.correct, total), need = Math.ceil(total * .8);
    const rewardsList = demo ? [] : earned.breakdown.map(b => ({ label: b.label, coins: b.coins }));
    for (const id of earned.newUnlocks) rewardsList.push({ label: `새 컬렉션 · ${SHOP_ITEMS.find(i => i.id === id)?.name}`, unlock: true });
    const plain = [], wish = demo ? '' : rewards.wishText();
    if (demo) plain.push('자동 시연은 코인·기록·메달·코스 열기에 넣지 않아요. 직접 달려서 도전해 보세요.');
    else if (earned.reason === 'account-pending') plain.push('보상 기록을 계정에 전송 대기 중이에요. 연결되면 같은 보상을 중복 없이 확인해요.');
    else if (earned.reason === 'account-rejected') plain.push('이번 보상 요청을 처리하지 못했어요. 요청 원본은 이 기기에 보관했으며 다른 게임은 계속할 수 있어요.');
    else if (!earned.coins) plain.push('오늘의 반복 완주 보상을 모두 받았어요.');
    if (!demo && wish) plain.push(wish);
    const tuned = demo ? [] : describeRace(s.flowStart, flowEnd?.settings?.values);
    const learningLine = demo ? '자동 시연이라 학습 기록에 남기지 않았어요.' : [`도움 없이 처음 고른 답 ${s.answers.filter(a => a.learning?.independent).length}개를 다음 추천에 반영해요.`,
      tuned.length ? `이번 주행에서 맞춘 것: ${tuned.join(' · ')}.` : '', saved ? (rewards.account().status().mode === 'account' ? '직접 달린 기록을 계정에 이어 저장해요. 위의 저장 상태를 확인해 주세요.' : '직접 달린 체험 기록은 이 브라우저에 저장했어요.') : earned.reason === 'account-rejected' ? '이번 기록은 계정에 반영되지 않았어요. 요청 원본은 이 기기에 보관했어요.' : '기록을 보관하지 못했어요. 저장 상태를 확인해 주세요.', learning.learningScope()].filter(Boolean).join(' ');
    const coinText = demo ? '자동 시연은 공통 코인을 지급하지 않아요.' : earned.coins ? `공통 코인 +${earned.coins} · 보유 ${earned.state.coins.toLocaleString('ko-KR')}`
      : earned.reason === 'account-pending' ? '보상을 계정에 저장하는 중이에요.' : earned.reason === 'account-rejected' ? '이번 보상은 지급되지 않았어요. 요청 원본은 보관했어요.' : earned.reason === 'duplicate-round' ? '이번 완주 보상은 이미 차고에 모였어요.' : '오늘의 완주 코인 10회분을 모두 받았어요.';
    const note = demo ? '미리보기로 달렸어요. 기록 없이 체험했어요.' : s.correct === total ? '모두 맞혔어요! 메달 셋을 받았어요.' : passed ? '통과했어요! 메달 둘을 받았어요.'
      : `${need}문제 이상 맞히면 통과예요. 놓친 문제를 다시 들어 봐요.`;
    // 낱말 문제에는 id가 없다: 정답 낱말로 찾는다(예전 결과 화면은 이 경우 첫 문제만 찾았다).
    const questions = s.answers.map(a => { const q = s.questionBank.find(item => a.id ? item.id === a.id : item.answer === a.answer) || {};
      return { prompt: q.id ? q.prompt : q.mode === 'picture' ? '들은 단어의 그림 고르기' : '들은 단어 고르기', answer: q.word, chosen: a.correct ? null : WORD_BY_ID[a.chosen]?.word, correct: a.correct,
        why: [q.id ? [q.passage ? `${q.mode === 'reading' ? '지문' : '들은 말'}: ${q.passage.replace(/\n/g, ' · ')}` : '', q.explanation || ''].filter(Boolean).join(' — ') : '', a.recheck?.line].filter(Boolean).join(' ') }; });
    const nextReason = !next ? '마지막 코스까지 왔어요. 메달을 더 모으거나 어휘 연습을 달려 봐요.' : !demo && !isUnlocked(next) ? `${need}문제 이상 맞히면 다음 코스가 열려요. 이 코스를 한 번 더 달려 봐요.`
      : `다음: ${labelStage(next)}`;
    return { kicker: labelStage(s.selectedStage), demo, correct: s.correct, total, medal, passed: !demo && passed, rank, bestCombo: s.bestCombo, collisions: s.collisions, coinText, note, questions, rewards: rewardsList, plain, learning: learningLine, nextReason, listen: i => listenAgain(s.answers[i]) };
  }
  function listenAgain(answer) {
    const q = s.questionBank.find(item => answer.id ? item.id === answer.id : item.answer === answer.answer);
    if (!q) return;
    if (!s.soundEnabled) { s.soundEnabled = true; s.soundTouched = true; view.syncSoundToggles(); }
    void sound.ensureAudio().then(() => speak(q.answerAudio || [q.answer], q.word, 'word', true));
  }
  function showCruiseResults() {
    if (!coastDrive.openResults()) return;
    s.running = false; s.paused = false; s.inputs.left = s.inputs.right = false; silence(); view.closeDialog($('pause-dialog'));
    view.showScreen('results'); $('cruise-loop').style.opacity = '0';
    syncCoastRadio(); ($('next-stage').disabled ? $('return-cruise') : $('next-stage')).focus({ preventScroll: true });
  }
  function returnToCruise() {
    if (!coastDrive.resume()) return;
    s.running = true; s.paused = false; view.showRace(); silence(); clock.getDelta(); $('cruise-results').focus({ preventScroll: true });
    if (s.soundEnabled) void sound.ensureAudio(); syncCoastRadio();
  }

  /* ── 판정 ── */
  function judgeGate() {
    const gate = s.gate;
    if (!gate || gate.judged) return;
    questionPace.answered(s.elapsed);
    const lane = clamp(Math.round((s.playerOffset + 3.45) / 3.45), 0, 2), chosen = gate.types[lane], success = chosen === gate.q.answer;
    if (gate.presentationId && !s.roundWasDemo) {
      const assessable = gate.intentChoice === chosen;
      gate.learning = learning.answerGate(gate.presentationId, { correct: success, assessable, reason: assessable ? undefined : 'motor', choice: { selectedId: chosen, correctId: gate.q.answer } },
        assessable ? { pressure: racePressure({ readyAt: gate.readyAt, choseAt: gate.choseAt, cruise: s.cruise, campaign: !!s.selectedStage.campaign, roadLeft: gate.readyRoad }) } : { outcome: 'void' });
    }
    gate.recheck = s.roundWasDemo ? null : learn(c => racingRecheck(c, gate.q, gate.learning));
    gate.judged = true; s.answers.push({ id: gate.q.id, prompt: gate.q.prompt, answer: gate.q.answer, chosen, correct: success, learning: gate.learning, recheck: gate.recheck });
    $('repeat-question').hidden = true; $('go').hidden = true; setQuestionExpanded(false); s.laneAim = null;
    hud.markLanes(chosen, gate.q.answer);
    if (success) {
      s.correct++; s.combo++; s.bestCombo = Math.max(s.bestCombo, s.combo); s.boost = rewardBoost(s.combo); scene.mascotMood('cheer', 3); hud.pop(s.combo >= 3 ? `${s.combo}콤보! 부스터` : '정답! 부스터', s.combo);
      speak(['correct', ...(gate.q.answerAudio || [gate.q.answer]), 'boost'], `맞았어! ${gate.q.word}. ${gate.q.explanation || ''} 부스터!`, 'feedback'); sound.ding(true);
    } else {
      s.combo = 0; speak(['answer', ...(gate.q.answerAudio || [gate.q.answer]), 'retry'], `정답은 ${gate.q.word}. ${gate.q.explanation || ''}`, 'feedback'); sound.ding(false);
    }
    s.shield = comboShield(s.combo, success, s.shield);
    if (success && s.combo % 3 === 0) { showToast(`${s.combo}콤보! 한 번은 부딪혀도 괜찮은 보호막이 생겼어요`, 3); speak(['shield-ready'], '연속 정답! 보호막이 생겼어.', 'reward'); }
    setText($('combo'), [s.combo >= 2 ? `${s.combo}콤보` : '', s.shield ? '보호막' : ''].filter(Boolean).join(' · '));
    const needsPractice = !s.roundWasDemo && (!success || gate.learning?.assisted);
    const reviewing = needsPractice || !!gate.recheck?.line;
    const follow = needsPractice && gate.learning?.verdict !== 'unassessed' ? linkRacingRecheck(learn(c => racingFollowUp(c, { current: gate.q, remaining: s.questionBank.slice(s.gateIndex + 1), stage: s.selectedStage, audioAvailable: s.soundEnabled && !s.narrationUnavailable })), gate.learning) : null;
    if (follow) s.questionBank.splice(s.gateIndex + 1, s.questionBank.length - s.gateIndex - 1, ...follow.remaining);
    const nextNote = follow?.status === 'new' ? ' 비슷한 새 문제로 한 번 더 확인해 봐요.' : follow?.status === 'unavailable' ? ' 비슷한 새 문제가 없어서 원래 코스대로 이어 달려요.' : '';
    hud.answerQuestion({ ok: success, word: gate.q.word, why: [answerFeedback(gate.q, chosen), gate.recheck?.line, nextNote].filter(Boolean).join(' '), hold: reviewing ? null : 4200 });
    gate.reviewing = reviewing;
    if (reviewing) {
      s.velocity = 0; s.inputs.left = s.inputs.right = false;
      $('question-toggle').hidden = true; $('feedback-continue').hidden = false;
      $('feedback-continue').textContent = follow?.status === 'new' ? '새 문제로 확인하기' : '확인했어요 · 계속 달리기';
      $('feedback-continue').focus({ preventScroll: true });
    }
    if (gate.presentationId) learn(c => c.help(gate.presentationId, 'answer'));
  }
  function continueFeedback() {
    if (!s.running || s.paused || !s.gate?.reviewing) return;
    s.gate.reviewing = false; s.inputs.left = s.inputs.right = false; questionPace.answered(s.elapsed);
    hud.hideQuestion(); $('question-toggle').hidden = false; silence(); clock.getDelta();
  }

  /* ── 주행: 접촉·드라이브·레이스 한 걸음 ── */
  function updateContacts(dt, waiting, record = true) {
    s.contactTimer = Math.max(0, s.contactTimer - dt);
    if (!waiting) for (const r of scene.rivals()) {
      const p = { s: s.playerS, offset: s.playerOffset, velocity: s.velocity }; const hit = resolveContact(p, r); if (!hit) continue; s.playerS = p.s; s.playerOffset = p.offset;
      if (s.contactTimer === 0) {
        const effect = shieldContact({ shield: s.shield, collisions: s.collisions, velocity: s.velocity, boost: s.boost }, hit); if (!record) effect.collisions = s.collisions;
        ({ shield: s.shield, collisions: s.collisions, velocity: s.velocity, boost: s.boost } = effect);
        if (effect.protected) { s.shieldBlocked++; s.shieldFlash = .8; s.contactTimer = .45; setText($('combo'), s.combo >= 2 ? `${s.combo}콤보` : ''); showToast('보호막! 속도를 지켰어요', 2); speak(['shield-block'], '휴, 보호막 덕분에 속도가 그대로야.', 'reward'); }
        else { s.contactTimer = .85; showToast(record ? '톡! 부딪혀도 학습 점수는 그대로예요' : '톡! 천천히 다시 달려요', 1.6); sound.contact(); scene.contactSparks(hit); }
      }
    }
  }
  function updateCoastDrive(dt) {
    const steering = (s.inputs.left ? 1 : 0) - (s.inputs.right ? 1 : 0);
    if (s.auto) s.playerOffset = lerp(s.playerOffset, 0, 1 - Math.exp(-dt * 2.6));
    else s.playerOffset = clamp(s.playerOffset + steering * dt * 5.8, -5.05, 5.05);
    const desired = (s.contactTimer > .5 ? 28 : Math.abs(s.playerOffset) > 4.95 ? 32 : 42) * s.cruise / BASE_CRUISE;
    s.velocity = lerp(s.velocity, desired, 1 - Math.exp(-dt * 2.4));
    const step = coastDrive.advance(s.playerS, s.velocity, dt, ROAD_END); s.playerS = step.position;
    $('cruise-loop').style.opacity = String(step.fade);
    const rivals = scene.rivals();
    if (step.wrapped) { rivals.forEach((r, i) => r.s = s.playerS + 42 + i * 38); scene.wrapCamera(s.playerS, s.playerOffset); }
    for (const [i, r] of rivals.entries()) {
      r.s += r.speed * dt;
      if (r.s < s.playerS - 45) r.s = s.playerS + 125 + i * 38;
      r.mesh.visible = r.s < ROAD_END - 20; scene.placeCar(r.mesh, r.s, r.offset);
      for (const w of r.mesh.userData.wheels) w.rotation.x -= r.speed * dt * 2.2;
    }
    // 몸으로 부딪히는 반응은 그대로 두되, 끝난 레이스의 학습 기록·순위·코인·접촉 수는 이미 정해졌다.
    updateContacts(dt, false, false);
    const car = scene.car();
    scene.placeCar(car, s.playerS, s.playerOffset, steering * .045); car.rotation.z = -steering * .008;
    for (const w of scene.wheels()) w.rotation.x -= s.velocity * dt * 2.3;
    for (const jet of car.userData.jets) { jet.visible = !reducedMotion; jet.scale.y = .65; }
    setText($('speed'), Math.round(s.velocity * 3.6));
    if (s.soundEnabled) sound.engineCoast(s.velocity);
  }
  function updateGame(dt) {
    if (s.gate?.reviewing) { s.velocity = 0; setText($('speed'), 0); return; }
    s.elapsed += dt;
    const gate = s.gate;
    if (gate?.announced && (s.inputs.left || s.inputs.right)) s.questionChosen = true;
    if (s.auto && gate && gate.announced && !gate.judged) s.aimOffset = LANES[gate.types.indexOf(gate.q.answer)];
    else if (s.auto) s.aimOffset = 0;
    if (s.auto) s.playerOffset = lerp(s.playerOffset, s.aimOffset, 1 - Math.exp(-dt * 2.6));
    // 추적 카메라는 +Z를 보므로 화면 오른쪽이 월드 -X다.
    else if (s.laneAim !== null && !s.inputs.left && !s.inputs.right) s.playerOffset = lerp(s.playerOffset, s.laneAim, 1 - Math.exp(-dt * 4));
    else s.playerOffset += ((s.inputs.left ? 1 : 0) - (s.inputs.right ? 1 : 0)) * dt * 5.8;
    s.playerOffset = clamp(s.playerOffset, -5.05, 5.05);
    // 다시 듣기를 포함해 낱말을 끝까지 들을 시간을 둔다.
    const narrator = sound.narrator;
    const hearing = gate?.announced && !gate.judged && (narrator.activeKind === 'question' || narrator.queue.some(item => item.kind === 'question'));
    const waitingForVoice = hearing && gate.s - s.playerS < 65;
    const waitingForChoice = s.selectedStage.campaign && gate?.announced && !gate.judged && !s.auto && !s.questionChosen && gate.s - s.playerS < 65;
    const waiting = waitingForVoice || waitingForChoice || s.questionExpanded;
    ({ velocity: s.velocity, boost: s.boost } = questionPace.step({ waiting, velocity: s.velocity, boost: s.boost, dt }));
    const edge = Math.abs(s.playerOffset) > 4.95, pace = s.cruise / BASE_CRUISE, desired = waiting ? 0 : s.contactTimer > .5 ? 22 * pace : edge ? 21 * pace : (s.boost > 0 || s.answers.length === s.questionBank.length) ? 42 * pace : s.cruise;
    s.velocity = lerp(s.velocity, desired, 1 - Math.exp(-dt * 2.4)); s.playerS += s.velocity * dt;
    const rivals = scene.rivals();
    for (const r of rivals) {
      r.s += r.speed * dt * (waiting ? 0 : 1);
      if (gate && !gate.judged && gate.s - s.playerS < 100 && Math.abs(r.s - s.playerS) < 25) {
        const safe = LANES.find(o => Math.abs(o - s.playerOffset) > 2.5 && !rivals.some(other => other !== r && Math.abs(other.s - r.s) < 7 && Math.abs(o - other.offset) < 2));
        if (safe !== undefined) r.offset = lerp(r.offset, safe, 1 - Math.exp(-dt * 3));
      }
    }
    const rivalBody = { s: rivals[0].s, offset: rivals[0].offset, velocity: rivals[0].speed }; resolveContact(rivalBody, rivals[1]); rivals[0].s = rivalBody.s; rivals[0].offset = rivalBody.offset;
    updateContacts(dt, waiting); for (const r of rivals) { scene.placeCar(r.mesh, r.s, r.offset); for (const w of r.mesh.userData.wheels) w.rotation.x -= r.speed * dt * 2.2; }
    const steering = (s.inputs.left ? 1 : 0) - (s.inputs.right ? 1 : 0), yaw = (s.auto ? clamp(s.aimOffset - s.playerOffset, -1, 1) : steering) * .045;
    const car = scene.car();
    scene.placeCar(car, s.playerS, s.playerOffset, yaw); car.rotation.z = -steering * .008; if (!reducedMotion) car.position.y += Math.sin(s.elapsed * 31) * .003;
    for (const w of scene.wheels()) w.rotation.x -= s.velocity * dt * 2.3;
    for (const jet of car.userData.jets) { jet.visible = s.boost > 0; jet.scale.y = .6 + Math.random() * .5; }
    if (s.gate) {
      const current = s.gate, distance = current.s - s.playerS;
      if (!current.announced && distance < QUESTION_LEAD && questionPace.canAnnounce(s.elapsed)) {
        current.announced = true; current.presentationId = learning.presentGate(current.q);
        if (current.q.mode === 'reading' || !s.soundEnabled || s.narrationUnavailable) questionReady();
        if (s.roundWasDemo && current.presentationId) learn(c => c.help(current.presentationId, 'answer'));
        scene.mascotMood('focus'); setText($('g-count'), `${s.gateIndex + 1} / ${s.questionBank.length}`);
        $('repeat-question').hidden = false; $('go').hidden = false; hud.showLanes(); narrateQuestion();
      }
      if (distance < 0 && !current.judged) judgeGate();
      if (distance < -15) { s.gateIndex++; if (s.gateIndex < s.questionBank.length) makeGate(s.gateIndex, gatePosition(s.gateIndex)); else disposeGate(); }
    }
    view.screenEl.classList.toggle('boosting', s.boost > 0 && !reducedMotion);
    setText($('speed'), Math.round(s.velocity * 3.6));
    $('nitro-fill').style.clipPath = `inset(0 ${(100 - Math.min(100, s.boost / rewardBoost(s.combo) * 100)).toFixed(1)}% 0 0)`;
    setText($('nitro-label'), waiting && s.boost > 0 ? '부스터 저장 중' : waitingForChoice ? '길을 골라 출발' : s.boost > 0 ? '부스터 켜짐' : '부스터');
    setText($('rank'), `${1 + rivals.filter(r => r.s > s.playerS).length} / 3`);
    $('progress').style.width = `${Math.min(100, (s.playerS - 75) / (gatePosition(s.questionBank.length - 1) + 15 - 75) * 100)}%`;
    if (s.soundEnabled) sound.engineRace(s.velocity, s.boost, car.userData.vehicleKind);
    if (s.answers.length === s.questionBank.length && !s.gate) finish();
  }

  /* ── 소리 켜고 끄기 ── */
  async function toggleSound() {
    s.soundTouched = true; s.soundEnabled = !s.soundEnabled; view.syncSoundToggles();
    syncCoastRadio();
    if (tutorial.active()) { silence(); tutorial.clearVoice(); if (s.soundEnabled) { await sound.ensureAudio(); if (s.running && !s.paused) tutorial.repeat(); } else tutorial.delivered(); tutorial.render(); return; }
    if (s.soundEnabled) { await sound.ensureAudio(); setQuestionExpanded(false); if (s.running && !s.paused && s.gate?.announced && !s.gate.judged) narrateQuestion(); } else { silence(); displayQuestion(); }
    if (!s.running) view.renderLobby();
  }

  return Object.freeze({
    state: s, coastDrive, questionPace, isUnlocked, setText, silence, syncCoastRadio, speak, showToast,
    setQuestionExpanded, chooseCurrentLane, pickLane, questionReady, displayQuestion, renderQuestion, narrateQuestion, makeGate, disposeGate,
    reset, pause, resume, nextStage, finish, resultSummary, listenAgain, showCruiseResults, returnToCruise,
    judgeGate, continueFeedback, updateContacts, updateCoastDrive, updateGame, toggleSound,
  });
}
