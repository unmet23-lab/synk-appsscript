// 선생님이 돌아왔다 — 화면과 흐름. 이야기·정답 판정·되돌리기·저장은 core.mjs, 교실 무대는 stage.mjs, 음성은 voice.mjs,
// 공통 학습 기록과 추천은 learning.mjs(아틀라스). 입구·게임 바·멈춤·결과·코인 줄은 kit/(SYNK LAB PLAY 키트)의 뼈대다.
// 게임은 한 화면(스크롤 없음): 위(넓은 화면은 왼쪽)는 누르는 교실, 아래(오른쪽)는 종이 판 —
// 이야기를 읽을 때는 말하는 사람과 대사·다음, 부탁을 할 때는 부탁 한 문장 · 친구 → 물건 → 놓을 곳 · 다시 듣기·힌트·되돌리기.
import { StoryGame } from './core.mjs';
import { EPISODE } from './story.mjs';
import { StoryStage, names, sprite } from './stage.mjs';
import { StoryAudio } from './audio.mjs';
import { StoryVoice } from './voice.mjs';
import { VOICE_LINE_BY_ID, voiceForMission } from './voice-lines.mjs';
import { createStoryLearning, skillReport, assignmentMissions, storyTargetLabel, missionMetadata, SKILL_LABELS } from './learning.mjs';
import { $, $$, esc, fitText } from './kit/lab.mjs';

const QA = new URLSearchParams(location.search).has('qa');
const game = new StoryGame(), audio = new StoryAudio();
const learning = createStoryLearning({ storage: localStorage });
const initialScope = learning.progressScope();
const STORAGE = initialScope.persistent ? initialScope.key : null;
const STORY_MISSIONS = EPISODE.acts.flatMap((a) => a.missions), ALL_MISSIONS = [...STORY_MISSIONS, ...EPISODE.review];
const SPEAKER = { teacher: '선생님', marin: '마린', kkamong: '까몽', mongle: '몽글', narrator: '이야기' };
const SUBJECT = { marin: '마린이', kkamong: '까몽이' };
const OBJECT = { snacks: '과자를', paper: '종이를', cake: '케이크를', ribbon: '리본을', flowers: '꽃을', letter: '편지를' };
const DID = { box: '상자 안에 넣었어요', drawer: '서랍 안에 넣었어요', table: '책상 위에 놓았어요', shelf: '선반 위에 놓았어요', board: '칠판에 붙였어요', bin: '쓰레기통에 버렸어요' };
const announce = (text) => { const n = $('#sr-live'); n.textContent = ''; requestAnimationFrame(() => { n.textContent = text; }); };

// 공통 코인 스크립트(collection.js)를 읽지 못했으면 코인 줄을 숨긴다(모듈은 본문 끝 스크립트 뒤에 돈다).
if (!globalThis.SynkPlayCollection) for (const n of $$('.synk-collection-line')) n.hidden = true;

/* ── 음성: 한 번에 한 문장. 실제로 소리가 시작될 때 그 글의 도움으로 기록한다 ── */
let voiceKey = '', voiceHelpSerial = 0;
const voice = new StoryVoice({
  audio,
  onStatus: (s) => { $('#voice-status').textContent = s.message; $('#voice-status').dataset.state = s.state; },
  onStarted: (line) => {
    // 결과 화면에서 다시 듣는 것은 복습이라 도움으로 세지 않는다
    if (game.phase === 'complete') return;
    const ids = line.assistanceMissionIds;
    const source = ['mission', 'explanation', 'feedback'].includes(line.category) ? line.category : 'dialogue';
    if (!ids.length) return;
    game.markAudioHelp(ids, { source, voiceId: line.id });
    learning.help(ids, { kind: 'audio', source, requestId: `${line.id}:${++voiceHelpSerial}` });
    persist();
  },
});
voice.readingOnly = new URLSearchParams(location.search).get('reading') === '1';
// 입구에서 고른 도움 방식(순간 맞춤 선언 FLOW_VOICE)이 자동 읽기의 처음 값을 정한다. 이 판에서 누른 단추가 언제나 이긴다.
// WORLD 읽기 과제는 읽기 확인이라, 단계별 도움을 고르지 않았다면 부탁은 누를 때만 읽어 준다.
const chosenVoice = learning.voiceDefault({ target: !!learning.assignment() });
voice.automatic = chosenVoice;

/* ── 상태 ── */
let saved = null, started = false, busy = false, placing = null, teacherVisible = false, resultsShown = false;
let feedback = null;   // 판의 쪽지: {type: wrong|right|hint|tip|undo, text, voiceId, …}
let activeId = null;   // 지금 판에 크게 보이는 부탁
let notes = [], coinRound = null, coinState = 'idle';

function loadSaved() {
  saved = null;
  try { const raw = STORAGE ? JSON.parse(localStorage.getItem(STORAGE)) : null; if (raw?.game && new StoryGame().restore(raw.game)) saved = raw; } catch { /* 저장 없음 */ }
}
function persist() {
  try {
    const scope = learning.progressScope();
    if (!learning.assignment() && STORAGE && scope.persistent && scope.key === STORAGE)
      localStorage.setItem(STORAGE, JSON.stringify({ version: 2, game: game.snapshot(), notes: notes.slice(-60), coinRound, coinPaid: coinState === 'done' }));
  } catch { /* 저장이 막힌 브라우저 */ }
}
function rememberLine(line) {
  const key = `${game.phase}:${game.actIndex}:${game.dialogueIndex}`;
  if (line && !notes.some((n) => n.key === key)) notes.push({ ...line, voiceId: game.currentVoiceLine?.id, key });
}

const stage = new StoryStage($('#stage'), { onActor: selectActor, onObject: selectObject, onPlace: place, onCancel: cancelHeld }, {
  // 휴대폰에서 종이 판이 교실 아래를 살짝 덮는다. 그 아래에는 아무것도 두지 않는다.
  coveredBottom: () => {
    const s = $('#stage').getBoundingClientRect(), p = $('#sheet').getBoundingClientRect();
    return p.left < s.right - 1 && p.right > s.left + 1 ? Math.max(0, s.bottom - p.top) : 0;
  },
});

/* ── 화면 ── */
function show(id) {
  for (const s of ['lobby', 'game', 'results']) $('#' + s).hidden = s !== id;
  window.scrollTo(0, 0);
}
const playing = () => ['play', 'review'].includes(game.phase);
const done = (m) => game.completedIds.includes(m.id);
const open = () => game.missions.filter((m) => !done(m));
const available = () => open().filter((m) => (m.requires || []).every((id) => game.completedIds.includes(id)));
const activeMission = () => game.missions.find((m) => m.id === activeId) || game.missions[0];
function storyPool() {
  const target = learning.assignment();
  if (!target) return STORY_MISSIONS;
  const ids = new Set(assignmentMissions(ALL_MISSIONS, target).map((m) => m.id));
  return EPISODE.acts.filter((a) => a.missions.some((m) => ids.has(m.id))).flatMap((a) => a.missions);
}

/** 기록을 보고 지금 할 수 있는 부탁 중 먼저 할 것(순서 조건을 지킨다). 없으면 남은 첫 부탁. */
function recommended() {
  const ready = available();
  const plan = ready.length > 1 ? learning.recommend(ready) : null;
  return ready.find((m) => m.id === plan?.selected?.missionId) || ready[0] || open()[0] || null;
}

/* ── 입구 ── */
function renderLobby() {
  started = false; resultsShown = false; voice.stop();
  loadSaved();
  const target = learning.assignment();
  $('#resume').hidden = !(saved && !target);
  if (target) {
    const n = assignmentMissions(ALL_MISSIONS, target).length;
    $('#l-title').innerHTML = `목표 부탁 <b>${n}개</b>`;
    $('#l-reason').textContent = storyTargetLabel(target);
  } else {
    $('#l-title').innerHTML = '부탁 <b>6개</b> · 장면 3';
    $('#l-reason').textContent = lobbyReason();
  }
  $('#voice-note').hidden = !(!chosenVoice && !voice.automatic && !voice.readingOnly);
  $('#voice-note').textContent = '고른 도움 방식에 맞춰, 부탁은 「다시 듣기」를 누를 때만 소리로 읽어 줘요.';
  syncToggles(); accountStatus();
  show('lobby');
}
function lobbyReason() {
  if (saved) return '지난번에 하던 이야기가 남아 있어요. 이어서 하거나 처음부터 시작해요.';
  const focus = skillReport(learning.summary()).find((s) => ['practice', 'review'].includes(s.status));
  if (focus) return `지난번에는 ‘${focus.label}’가 조금 어려웠어요. 이번 이야기에서 한 번 더 해 봐요.`;
  return '부탁 6개를 풀면 이야기가 끝나요. 마지막에는 조금 바뀐 부탁 3개가 더 있어요.';
}

/* ── 시작·이어 하기 ── */
async function start(resume = false) {
  const target = learning.assignment(), targetMissions = target ? assignmentMissions(ALL_MISSIONS, target) : null;
  if (target && !targetMissions.length) { $('#lobby-note').hidden = false; $('#lobby-note').textContent = '과제 부탁을 불러오지 못했어요. WORLD에서 다시 열어 주세요.'; return; }
  if (target) resume = false;
  if (busy) return;
  voice.stop(); voiceKey = ''; started = true; feedback = null; activeId = null; resultsShown = false;
  stage.reset(); teacherVisible = false;
  if (resume && saved && game.restore(saved.game)) {
    notes = Array.isArray(saved.notes) ? saved.notes.filter((n) => typeof n.text === 'string' && typeof n.speaker === 'string').slice(-60) : [];
    teacherVisible = game.phase !== 'opening' || game.dialogueIndex >= 3;
    stage.teacher(teacherVisible);
    coinRound = typeof saved.coinRound === 'string' ? saved.coinRound : (globalThis.SynkPlayCollection?.roundId('story-classroom') || null);
    coinState = saved.coinPaid === true ? 'done' : 'idle';
  } else {
    if (target) game.startPractice(targetMissions.map((m) => m.id)); else game.restart();
    notes = [];
    // 공통 코인(play-common): 이 판의 번호. 끝까지 마친 판에 한 번만 받는다.
    coinRound = globalThis.SynkPlayCollection?.roundId('story-classroom') || null;
    coinState = 'idle';
  }
  $('#r-coins').textContent = coinState === 'done' ? '이번 판 보상은 벌써 차고에 들어갔어요.' : '';
  learning.beginRun({ restored: resume });
  if (game.phase !== 'complete') show('game');
  render();
  void audio.start().then(syncToggles);
  if (game.phase !== 'complete') (playing() ? $('#ask-line') : $('#dialogue-next')).focus?.({ preventScroll: true });
}

/* ── 그리기 ── */
function render() {
  if (!started) return;
  const complete = game.phase === 'complete' && !busy;
  if (complete) { if (!resultsShown) showResults(); persist(); voice.stop(); return; }
  // 옮기는 동안(busy)은 장면이 끝났어도 부탁 판을 그대로 둔다(친구가 다 옮긴 뒤 이야기로 넘어간다)
  const asking = playing() || busy;
  $('#beat').hidden = asking; $('#ask').hidden = !asking;
  renderHud();
  if (asking) renderAsk(); else renderBeat();
  stage.update(game);
  persist(); setVoice(); accountStatus(); syncVoice();
}

function renderHud() {
  const p = game.phase, review = p === 'review';
  $('#g-scene').textContent = p === 'opening' ? '시작' : p === 'ending' ? '끝' : review ? '마지막' : `${game.actIndex + 1} / 3`;
  const pool = review ? EPISODE.review : storyPool();
  const n = pool.filter((m) => game.completedIds.includes(m.id)).length;
  const text = `${n} / ${pool.length}`;
  if ($('#g-done').textContent !== text) {
    $('#g-done').textContent = text;
    const pill = $('#g-done-wrap'); pill.classList.remove('punch'); void pill.offsetWidth; pill.classList.add('punch');
  }
}

/** 이야기를 읽을 때: 말하는 사람(펠트 이름표 + 얼굴)과 대사, 다음 */
function renderBeat() {
  const line = game.currentLine, who = line?.speaker || 'narrator';
  rememberLine(line);
  $('#b-avatar').dataset.who = who;
  $('#b-who').textContent = SPEAKER[who] || '이야기';
  $('#b-where').textContent = beatPlace();
  $('#b-line').textContent = line?.text || '';
  // 넓은 화면은 이 장면에서 앞서 읽은 대사를 위에 흐리게 남긴다(휴대폰은 지금 대사만)
  const before = game.currentLines.slice(Math.max(0, game.dialogueIndex - 4), game.dialogueIndex);
  $('#b-history').replaceChildren(...before.map((l) => {
    const li = document.createElement('li');
    li.innerHTML = `<b>${esc(SPEAKER[l.speaker] || '이야기')}</b> ${esc(l.text)}`;
    return li;
  }));
  const last = game.dialogueIndex === game.currentLines.length - 1;
  const label = !last ? '다음'
    : game.phase === 'intro' ? '부탁 보기'
      : game.phase === 'outro' ? (game.actIndex < EPISODE.acts.length - 1 && !game.practice ? '다음 장면' : '다음')
        : game.phase === 'ending' ? (game.reviewAhead ? '마지막 정리' : '결과 보기') : '다음';
  $('#dialogue-next span').textContent = label;
  $('#dialogue-next').disabled = busy;
  $('#beat-undo').hidden = !(game.phase === 'outro' && game.canUndo);
  $('#beat-undo').disabled = busy;
  if (line?.speaker === 'teacher' && !teacherVisible) { teacherVisible = true; stage.teacher(true); audio.play('door'); }
}
function beatPlace() {
  if (game.phase === 'opening') return '교실에서 생긴 일';
  if (game.phase === 'ending') return '오늘은 특별한 날';
  const act = EPISODE.acts[game.actIndex];
  return `장면 ${game.actIndex + 1} · ${act.title.replace(/^\d+\s*·\s*/, '')}`;
}

/** 부탁을 할 때: 탭(부탁 1·2·3) · 부탁 한 문장 · 고른 것(친구 → 물건 → 놓을 곳) 또는 쪽지 · 도구 */
function renderAsk() {
  const missions = game.missions;
  // 부탁 글은 탭 하나만 누르면 보인다. 기록(아틀라스)은 이 장면의 부탁을 모두 보여 준 것으로 연다(전처럼 모든 응답이 기록되게).
  for (const m of missions) learning.present(m, { record: game.records.find((r) => r.id === m.id), visible: true });
  if (!missions.some((m) => m.id === activeId)) activeId = recommended()?.id || missions[0].id;
  const m = activeMission(), target = learning.assignment();
  const tabs = $('#ask-tabs');
  tabs.hidden = missions.length < 2;
  tabs.replaceChildren(...missions.map((x, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = `ask-tab${done(x) ? ' done' : ''}`; b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(x.id === m.id)); b.dataset.mission = x.id;
    b.innerHTML = `<span>부탁 ${i + 1}</span>${done(x) ? '<i class="tick" aria-hidden="true"></i>' : ''}`;
    b.setAttribute('aria-label', `부탁 ${i + 1}${done(x) ? ' · 완료' : ''}`);
    b.onclick = () => { if (activeId === x.id) return; activeId = x.id; feedback = null; render(); };
    return b;
  }));
  const review = game.phase === 'review';
  $('#ask-kicker').textContent = done(m) ? '마친 부탁'
    : target && assignmentMissions([m], target).length ? '이번 목표'
      : review ? '바뀐 부탁' : '선생님의 부탁';
  const say = $('#ask-line');
  say.dataset.text = m.text;
  say.classList.toggle('done', done(m));
  fitText(say, { maxLines: 2, minPx: 15 });
  renderSteps(); renderNote();
  // 넓은 화면: 이 장면의 다른 부탁도 판 아래에 짧게 보인다(누르면 그 부탁으로)
  $('#ask-others').replaceChildren(...missions.filter((x) => x.id !== m.id).map((x) => {
    const li = document.createElement('li'), b = document.createElement('button');
    b.type = 'button'; b.className = `other${done(x) ? ' done' : ''}`;
    b.innerHTML = `<small>부탁 ${missions.indexOf(x) + 1}${done(x) ? ' · 마침' : ''}</small><span>${esc(x.text)}</span>`;
    b.onclick = () => { activeId = x.id; feedback = null; render(); };
    li.append(b);
    return li;
  }));
  $('#ask-middle').classList.toggle('noted', !!feedback);
  fitNote();
  $('#hint').disabled = busy || done(m);
  $('#undo').disabled = busy || !game.canUndo;
}

/** 고른 친구·물건을 둘 다 쓰는 열린 부탁이 딱 하나면 그 탭을 보여 준다(여럿이면 보던 탭 그대로). 판의 문장이 고른 것과 맞게. */
function followPicks() {
  if (!game.actor && !game.held) return;
  const fits = open().filter((m) => (!game.actor || m.actor === game.actor) && (!game.held || m.object === game.held));
  if (fits.length === 1) activeId = fits[0].id;
  else if (done(activeMission())) activeId = recommended()?.id || activeId;
}
/** 보이는 부탁이 지금 고른 것과 맞는지(안 맞으면 고른 것 위에 「지금 고른 것」) */
function picksMatch() {
  const m = activeMission();
  return !done(m) && (!game.actor || m.actor === game.actor) && (!game.held || m.object === game.held);
}

/** 판 가운데 칸이 넘치지 않게: 넓은 화면은 다른 부탁 목록을 먼저 접고, 쪽지는 짧은 판(반응 대사 → 고치는 법 한 줄),
 *  그래도 넘치면 글자와 여백을 조금 줄인다. 안쪽 스크롤 없이 쪽지가 다 보이게 한다. */
function fitNote() {
  const note = $('#note'), mid = $('#ask-middle');
  note.classList.remove('compact', 'tight'); mid.classList.remove('crowded');
  if ($('#ask').hidden) return;
  const over = () => mid.scrollHeight > mid.clientHeight + 1;
  if (over()) mid.classList.add('crowded');
  if (note.hidden) return;
  if (over()) note.classList.add('compact');
  if (over()) note.classList.add('tight');
}

/** 고른 것: 펠트 단추 셋이 고른 친구·물건·놓을 곳의 그림으로 채워진다 */
function renderSteps() {
  const list = $('#steps');
  const picks = [['actor', '친구', game.actor], ['object', '물건', game.held || placing?.object], ['place', '놓을 곳', placing?.destination]];
  const now = picks.findIndex(([, , v]) => !v);
  list.replaceChildren(...picks.map(([key, label, value], i) => {
    const li = document.createElement('li');
    li.className = `step${value ? ' filled' : ''}${i === now ? ' now' : ''}`;
    li.dataset.step = key;
    const badge = document.createElement(key === 'object' && value ? 'button' : 'span');
    badge.className = 'step-badge';
    if (key === 'object' && value) { badge.type = 'button'; badge.disabled = busy; badge.setAttribute('aria-label', `${names[value]} 내려놓기`); badge.onclick = cancelHeld; }
    if (value) badge.append(thumb(value)); else badge.textContent = String(i + 1);
    const text = document.createElement('span');
    text.className = 'step-text';
    text.innerHTML = `<small>${label}</small><b>${value ? esc(names[value]) : i === now ? '고르기' : '&nbsp;'}</b>`;
    li.append(badge, text);
    return li;
  }));
  $('#steps-label').hidden = busy || (!game.actor && !game.held) || picksMatch();
}
function thumb(id) {
  const img = document.createElement('img');
  img.alt = ''; img.className = `thumb thumb-${id}`;
  img.src = id === 'marin' || id === 'kkamong' ? `./assets/${id}-focus.webp` : `./assets/${sprite(id)[0]}.webp`;
  return img;
}

/** 쪽지: 틀리면 교실에서 일어난 일과 고치는 법(빨간 X 없이), 맞으면 체크 배지, 힌트·안내 */
function renderNote() {
  const note = $('#note');
  note.hidden = !feedback;
  if (!feedback) { note.className = 'note'; note.replaceChildren(); return; }
  const f = feedback;
  note.className = `note ${f.type}`;
  if (f.type === 'wrong' || f.type === 'right') {
    // 교실에서 일어난 일(happened) · 반응한 인물의 대사(reaction) · 고치는 법 한 줄(fix). 판이 좁으면 happened를 접는다(fitNote)
    const mv = f.result.moved, who = f.result.speaker || 'teacher';
    const happened = `${SUBJECT[mv.actor]} ${OBJECT[mv.object]} ${DID[mv.destination]}.`;
    const head = f.type === 'right' ? `<span class="done-head">부탁 ${game.missions.indexOf(f.mission) + 1} 완료!</span> ` : '';
    const icon = f.type === 'right' ? '<i class="note-icon check" aria-hidden="true"></i>' : `<span class="avatar small" data-who="${who}" aria-hidden="true"><i></i></span>`;
    note.innerHTML = `${icon}<div class="note-body"><b>${head}<span class="happened">${esc(happened)}</span></b>`
      + `<p class="reaction"><span class="by">${esc(SPEAKER[who] || '')}</span> “${esc(f.result.message)}”</p>`
      + (f.type === 'wrong' ? `<small class="fix">${esc(fixLine(f.result.kind))}</small>` : '') + '</div>';
  } else {
    const kicker = { hint: '작은 힌트', undo: '되돌렸어요', tip: '' }[f.type] || '';
    const who = f.speaker && SPEAKER[f.speaker] && f.type !== 'undo' ? `<span class="by">${esc(SPEAKER[f.speaker])}</span> ` : '';
    note.innerHTML = `<i class="note-icon ${f.type}" aria-hidden="true"></i><div class="note-body">${kicker ? `<b>${kicker}</b>` : ''}<p>${who}${esc(f.text)}</p></div>`;
  }
}
function fixLine(kind) {
  if (kind === 'actor') return '되돌리기를 누르거나, 부탁에 나온 친구로 다시 옮겨요.';
  if (kind === 'order') return '되돌리기를 누르고, 먼저 할 일부터 해요.';
  if (kind === 'object') return '되돌리기를 누르고, 부탁에 나온 물건을 찾아요.';
  return '되돌리기를 누르거나, 부탁을 한 번 더 읽어요.';
}

/* ── 조작 ── */
function selectActor(id) {
  if (busy || !game.selectActor(id)) return;
  feedback = null; followPicks(); audio.play('select'); render();
}
function selectObject(id) {
  if (busy || !playing()) return;
  if (!game.actor) { feedback = { type: 'tip', text: '누가 옮길지 먼저 골라 주세요. 마린이나 까몽을 눌러요.' }; render(); return; }
  if (!game.selectObject(id)) return;
  feedback = null; followPicks(); audio.play('pickup'); render();
}
function cancelHeld() { if (busy || !game.held) return; game.held = null; feedback = null; render(); }

async function place(destination) {
  if (busy || !playing()) return;
  const actor = game.actor, object = game.held, result = game.place(destination);
  if (result.mission && result.moved) {
    const record = game.records.find((r) => r.id === result.mission.id);
    learning.recordResponse(result, { attemptNo: record.attempts, requestId: `${result.mission.id}:${record.attempts}` });
  }
  if (!result.moved) { feedback = { type: 'tip', text: result.message, speaker: result.speaker, voiceId: result.voiceId }; render(); return; }
  busy = true; stage.busy = true; placing = { object, destination }; feedback = null;
  if (result.mission) activeId = result.mission.id;
  audio.play('place'); render();
  try { await stage.act(actor, object, destination, result, game.scene); } finally { busy = false; stage.busy = false; placing = null; }
  audio.play(result.correct ? 'success' : 'mistake');
  if (result.correct) {
    popAt(object, result.actComplete ? (game.phase === 'complete' ? '모두 완성!' : '장면 완성!') : '부탁 완료!');
    if (result.actComplete) { feedback = null; if (game.phase === 'ending' || game.phase === 'complete') audio.play('reveal'); }
    else {
      // 마친 부탁 탭에 체크 배지, 판은 바로 다음 부탁을 보여 준다(쪽지가 방금 한 일을 알려 준다).
      // 다음 부탁은 친구부터 새로 고른다(앞 부탁의 친구가 남아 다음 문장과 어긋나지 않게)
      feedback = { type: 'right', result, mission: result.mission, voiceId: result.voiceId };
      game.actor = null;
      activeId = recommended()?.id || activeId;
    }
    announce(result.actComplete ? '장면의 부탁을 모두 마쳤어요.' : `부탁 완료. ${result.message}`);
  } else {
    feedback = { type: 'wrong', result, mission: result.mission, voiceId: result.voiceId };
    announce(`${SUBJECT[actor]} ${OBJECT[object]} ${DID[destination]}. ${result.message}`);
  }
  render();
}
function undo() {
  if (busy || !game.undo()) return;
  followPicks();   // 되돌리면 그때 고른 친구·물건이 돌아온다
  feedback = { type: 'undo', text: '한 번 전으로 돌아왔어요. 부탁을 다시 읽어 봐요.' };
  audio.play('page'); render();
}
function hint() {
  if (busy || !playing()) return;
  const m = activeMission(), r = game.help(m && !done(m) ? m.id : undefined);
  if (r.mission) {
    activeId = r.mission.id;
    learning.help(r.mission.id, { kind: 'text', revealsAnswer: true, requestId: `hint:${r.mission.id}:${game.records.find((x) => x.id === r.mission.id).helpCount}` });
  }
  feedback = { type: r.mission ? 'hint' : 'tip', text: r.message, voiceId: r.voiceId, speaker: r.speaker };
  audio.play('page'); render();
}
function advance() {
  if (busy) return;
  feedback = null;
  if (!game.advance()) return;
  audio.play('page');
  if (playing()) activeId = recommended()?.id || null;
  render();
  if (playing()) $('#ask-line').focus?.({ preventScroll: true });
}

function popAt(id, text) {
  const p = $('#pop'), pt = stage.pointOf(id);
  if (!pt) return;
  p.textContent = text; p.hidden = false;
  p.style.left = `${pt.x}px`; p.style.top = `${Math.max(28, pt.y - 18)}px`;
  p.classList.remove('go'); void p.offsetWidth; p.classList.add('go');
  clearTimeout(popAt.t); popAt.t = setTimeout(() => { p.hidden = true; }, 1000);
}

/* ── 음성 ── */
function voiceLines() {
  if (feedback?.voiceId) return [VOICE_LINE_BY_ID[feedback.voiceId]];
  if (playing()) return open().map((m) => voiceForMission(m.id));
  return [game.currentVoiceLine].filter(Boolean);
}
function syncVoice() {
  const lines = voiceLines(), key = lines.map((l) => l.id).join('|');
  if (key === voiceKey) return;
  voiceKey = key; void voice.speak(lines);
}
/** 다시 듣기: 쪽지가 있으면 그 말, 부탁 중이면 지금 보는 부탁, 이야기 중이면 지금 대사 */
function replay() {
  const lines = feedback?.voiceId ? [VOICE_LINE_BY_ID[feedback.voiceId]] : playing() ? [voiceForMission(activeMission().id)] : [game.currentVoiceLine].filter(Boolean);
  void voice.speak(lines, { manual: true });
}
function setVoice() {
  const off = voice.readingOnly || !audio.enabled;
  const mode = voice.readingOnly ? '소리 없이 읽는 중' : !audio.enabled ? '소리 꺼짐' : '';
  for (const [btn, pill] of [['#beat-replay', '#beat-mode'], ['#ask-replay', '#ask-mode']]) {
    $(btn).hidden = off; $(pill).hidden = !off; $(pill).textContent = mode;
  }
  if (voice.readingOnly) voice.status('reading', '소리 없이 글만 읽는 중이에요.');
  else if (!audio.enabled) voice.status('muted', '소리가 꺼져 있어요.');
}
function syncToggles() {
  for (const t of $$('[data-sound-toggle]')) {
    t.setAttribute('aria-pressed', String(audio.enabled));
    if (t.hasAttribute('data-sound-label')) t.textContent = audio.enabled ? '소리 켜짐' : '소리 꺼짐';
    else t.setAttribute('aria-label', audio.enabled ? '소리 끄기' : '소리 켜기');
  }
  for (const t of [$('#voice-auto'), $('#voice-auto-2')]) { t.setAttribute('aria-pressed', String(voice.automatic)); t.textContent = `대사 읽어 주기 ${voice.automatic ? '켜짐' : '꺼짐'}`; }
  for (const t of [$('#reading-mode'), $('#reading-mode-2')]) { t.setAttribute('aria-pressed', String(voice.readingOnly)); t.textContent = `소리 없이 읽기 ${voice.readingOnly ? '켜짐' : '꺼짐'}`; }
}
function toggleSound() { audio.toggle(); voice.stop(); syncToggles(); setVoice(); if (started) { voiceKey = ''; render(); } }
function toggleAuto() { voice.automatic = !voice.automatic; voice.stop(); syncToggles(); setVoice(); if (started && voice.automatic) void voice.speak(voiceLines()); }
function toggleReading() {
  voice.readingOnly = !voice.readingOnly; voice.stop(); syncToggles(); setVoice();
  if (started) { voiceKey = ''; render(); }
  if (!started) $('#voice-note').hidden = !(!chosenVoice && !voice.automatic && !voice.readingOnly);
}

/* ── WORLD 계정(입구 아래) ── */
function accountStatus() {
  const status = learning.status(), scope = learning.progressScope();
  $('#account-sign-in').hidden = scope.scope === 'account'; $('#account-sign-out').hidden = scope.scope !== 'account';
  $('#account-sync').hidden = !['offline', 'blocked', 'error'].includes(status.phase);
  $('#account-status').textContent = status.warning || ({
    synced: 'WORLD 계정에 학습 기록을 연결했어요.',
    offline: `아직 보내지 못한 기록 ${status.queued || 0}개를 이 기기에 모아 두었어요.`,
    blocked: '학습 기록을 보내지 못했어요. WORLD 계정을 확인해 주세요.',
    local: '이 계정은 기록을 이 기기에만 저장해요. 이야기는 이 창에서만 이어져요.',
  }[status.phase] || '연습 기록은 이 기기에 저장돼요.');
  if (scope.scope === 'device' && location.port === '5213') $('#account-status').textContent += ' 다른 게임과 함께 보려면 WORLD 입구에서 열어 주세요.';
  const accountUrl = location.pathname.startsWith('/story-classroom/')
    ? new URL('../synk-account/client.html?product=world', location.href)
    : new URL('http://127.0.0.1:4280/synk-account/client.html?product=world');
  $('#account-sign-in').href = accountUrl; $('#account-sign-out').href = accountUrl;
}

/* ── 결과 ── */
// 공통 코인(play-common): 이야기를 끝까지 마친 한 판에 한 번. 도움 없이 첫 시도에 옮긴 비율로 받는다. 코인은 학습 기록에 쓰지 않는다.
function payCoins(correct, total) {
  if (coinState !== 'idle' || !coinRound || !globalThis.SynkPlayCollection) return;
  coinState = 'pending';
  globalThis.SynkPlayCollection.award({ game: 'story-classroom', total, correct, completed: true, automatic: false, roundId: coinRound })
    .then((result) => { coinState = 'done'; $('#r-coins').textContent = globalThis.SynkPlayCollection.rewardText(result); persist(); });
}

function showResults() {
  resultsShown = true; feedback = null;
  const recs = game.records, total = recs.length;
  const firstTry = recs.filter((r) => r.firstCorrect).length;
  const independent = recs.filter((r) => r.firstCorrect && !r.firstHelpUsed && !r.firstAudioHelpUsed).length;
  payCoins(independent, total);
  const hinted = recs.filter((r) => r.helpUsed).length, heard = recs.filter((r) => r.audioHelpUsed).length;
  const ratio = total ? firstTry / total : 0, stars = ratio >= 1 ? 3 : ratio >= 2 / 3 ? 2 : ratio >= 1 / 3 ? 1 : 0;
  $('#r-correct').textContent = String(firstTry); $('#r-total').textContent = String(total);
  $('#r-stars').innerHTML = [1, 2, 3].map((i) => `<i class="${i <= stars ? 'on' : ''}" style="animation-delay:${0.3 + (i - 1) * 0.22}s"></i>`).join('');
  $('#r-stars').setAttribute('aria-label', `별 3개 중 ${stars}개`);
  $('#r-mongle').src = stars >= 2 ? 'kit/brand/mongle-cheer.webp' : 'kit/brand/mongle-smile.webp';
  const story = recs.filter((r) => r.mode === 'story').length, review = recs.filter((r) => r.mode === 'review').length;
  $('#r-kicker').textContent = review ? `이야기 속 부탁 ${story}개 · 바뀐 부탁 ${review}개` : `선생님이 돌아왔다 · 부탁 ${story}개`;
  $('#r-note').textContent = [`혼자 한 번에 해낸 부탁 ${independent}개`, `힌트 ${hinted}개`, `음성으로 들은 부탁 ${heard}개`].join(' · ');
  renderLog(); renderSkills();
  $('#r-hub').hidden = false;
  $('#r-hub').href = location.pathname.startsWith('/story-classroom/') ? '../learning-hub/' : 'http://127.0.0.1:4280/learning-hub/';
  show('results');
  audio.play('reveal');
  $('#r-title').focus({ preventScroll: true });
}

function renderLog() {
  const log = $('#r-log'); log.replaceChildren();
  for (const m of ALL_MISSIONS) {
    const r = game.records.find((x) => x.id === m.id);
    if (!r) continue;
    const li = document.createElement('li');
    li.className = r.firstCorrect ? 'ok' : 'ko';
    const detail = [skillName(m), r.firstCorrect ? '첫 시도' : `${r.attempts}번째에 해냄`];
    if (r.helpUsed) detail.push('힌트');
    if (r.audioHelpUsed) detail.push('음성으로 들음');
    const mark = r.firstCorrect
      ? '<span class="mark ok" role="img" aria-label="첫 시도에 해냄"></span>'
      : `<span class="mark again" role="img" aria-label="${r.attempts}번째에 해냄">${r.attempts}</span>`;
    li.innerHTML = `${mark}<span class="body"><span class="sent">${esc(m.text)}</span><small>${esc(detail.join(' · '))}</small>${r.firstCorrect ? '' : `<span class="why">${esc(m.explanation)}</span>`}</span>`
      + (audio.enabled && !voice.readingOnly ? `<button class="chip-btn say-again" type="button" data-voice="mission-${esc(m.id)}" aria-label="부탁 다시 듣기: ${esc(m.text)}">듣기</button>` : '');
    log.append(li);
  }
}
const SKILL_SHORT = { 'ko.reading.detail': '누가·무엇을·어디에', 'ko.reading.negation': '~지 말고·~이 아니라', 'ko.reading.sequence': '먼저 할 일' };
const skillName = (m) => SKILL_SHORT[missionMetadata(m).skillId] || '';

function renderSkills() {
  const ul = $('#r-skills'); ul.replaceChildren();
  const report = skillReport(learning.summary());
  // 학습 기록을 쓸 수 없으면(저장이 막힌 브라우저 등) 세 영역 이름만 둔다
  const rows = report.length ? report
    : Object.entries(SKILL_LABELS).map(([id, label]) => ({ id, label, status: 'unseen', text: '기록을 쓸 수 없어요' }));
  let focus = null;
  for (const s of rows) {
    const mine = game.records.filter((r) => missionMetadata(ALL_MISSIONS.find((m) => m.id === r.id)).skillId === s.id);
    const ok = mine.filter((r) => r.firstCorrect).length;
    const isFocus = !focus && ['practice', 'review'].includes(s.status);
    if (isFocus) focus = s;
    const li = document.createElement('li');
    li.className = isFocus ? 'focus' : s.status === 'recent-independent' ? 'good' : '';
    li.innerHTML = `<b>${esc(s.label)}${isFocus ? ' <i class="next-tag">다음 연습</i>' : ''}</b><em>이번 ${ok}/${mine.length}</em><span>${esc(s.text)}</span>`;
    ul.append(li);
  }
  $('#r-next-reason').textContent = focus
    ? `‘${focus.label}’를 한 번 더 해 보면 좋아요. 다시 하면 같은 이야기의 부탁을 처음부터 읽어요.`
    : '같은 이야기라도 다시 읽으면 더 빨라져요. 마지막의 바뀐 부탁도 다시 나와요.';
}

/* ── 멈춤·수첩 ── */
function pause() {
  if ($('#game').hidden || $('#pause-dialog').open) return;
  voice.stop('잠깐 쉬는 중이에요.'); voiceKey = '';
  $('#restart-confirm').hidden = true; $('#restart-row').hidden = false;
  $('#pause-dialog').showModal();
}
function resumePlay() { if ($('#pause-dialog').open) $('#pause-dialog').close(); }
function openJournal() {
  const list = $('#journal-lines'); list.replaceChildren();
  for (const n of notes) {
    const li = document.createElement('li');
    li.innerHTML = `<b>${esc(SPEAKER[n.speaker] || '이야기')}</b><p>${esc(n.text)}</p>`
      + (n.voiceId && audio.enabled && !voice.readingOnly ? `<button class="chip-btn say-again" type="button" data-voice="${esc(n.voiceId)}">듣기</button>` : '');
    list.append(li);
  }
  $('#journal-dialog').showModal();
}

/* ── 이벤트 ── */
$('#start').onclick = () => start(false);
$('#resume').onclick = () => start(true);
$('#dialogue-next').onclick = advance;
$('#beat-replay').onclick = replay;
$('#ask-replay').onclick = replay;
$('#beat-undo').onclick = undo;
$('#undo').onclick = undo;
$('#hint').onclick = hint;
$('#pause').onclick = pause;
$('#pause-close').onclick = resumePlay;
$('#pause-dialog').addEventListener('close', () => { if (started && !$('#game').hidden) { voiceKey = ''; syncVoice(); } });
$('#journal').onclick = openJournal;
$('#journal-close').onclick = () => { voice.stop(); $('#journal-dialog').close(); };
$('#restart').onclick = () => { $('#restart-row').hidden = true; $('#restart-confirm').hidden = false; $('#confirm-restart').focus(); };
$('#keep-playing').onclick = () => { $('#restart-confirm').hidden = true; $('#restart-row').hidden = false; };
$('#confirm-restart').onclick = () => { $('#pause-dialog').close(); start(false); };
$('#quit').onclick = () => { $('#pause-dialog').close(); voice.stop(); persist(); renderLobby(); };
$('#again').onclick = () => start(false);
$('#r-home').onclick = () => { voice.stop(); renderLobby(); };
for (const t of $$('[data-sound-toggle]')) t.onclick = toggleSound;
for (const t of [$('#voice-auto'), $('#voice-auto-2')]) t.onclick = toggleAuto;
for (const t of [$('#reading-mode'), $('#reading-mode-2')]) t.onclick = toggleReading;
$('#account-sync').onclick = () => { learning.retry(); accountStatus(); };
document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-voice]');
  if (!button || button.disabled) return;
  const line = VOICE_LINE_BY_ID[button.dataset.voice];
  if (line) void voice.speak([line], { manual: true });
});
window.addEventListener('keydown', (e) => {
  if ($('#game').hidden || e.key !== 'Escape' || $('#pause-dialog').open || $('#journal-dialog').open) return;
  e.preventDefault();
  if (game.held && !busy) cancelHeld(); else pause();
});
window.addEventListener('pagehide', (event) => { persist(); voice.stop(); audio.suspend(); if (!event.persisted) learning.dispose(); });
window.addEventListener('pageshow', (event) => { if (event.persisted) { if (audio.enabled) void audio.start(); accountStatus(); } });
let fitFrame = 0;
window.addEventListener('resize', () => {
  cancelAnimationFrame(fitFrame);
  fitFrame = requestAnimationFrame(() => { if (started && playing()) { fitText($('#ask-line'), { maxLines: 2, minPx: 15 }); fitNote(); } });
});
document.fonts?.ready.then(() => { if (started && playing()) fitText($('#ask-line'), { maxLines: 2, minPx: 15 }); });

// 확인용 읽기 전용 상태(WORLD 교사 화면 시험이 읽는다). 게임을 진행하거나 풀지 않는다.
Object.defineProperty(window, '__storyState', { get: () => ({ busy, started, ...game.snapshot() }) });
Object.defineProperty(window, '__storyVoice', { get: () => ({ state: voice.state, id: voice.currentId, automatic: voice.automatic, readingOnly: voice.readingOnly }) });
Object.defineProperty(window, '__storyLearning', { get: () => ({ summary: learning.summary(), status: learning.status(), scope: learning.progressScope() }) });

renderLobby();
setInterval(accountStatus, 3000);

// 시험·확인용(?qa): 상태 읽기와 지금 부탁을 화면의 같은 길(친구 → 물건 → 놓을 곳)로 풀기
if (QA) {
  window.__story = {
    state: () => ({
      screen: ['lobby', 'game', 'results'].find((s) => !$('#' + s).hidden), phase: game.phase, act: game.actIndex, line: game.dialogueIndex,
      busy, started, actor: game.actor, held: game.held, scene: { ...game.scene }, completed: [...game.completedIds], active: activeId,
      missions: game.missions.map((m) => ({ id: m.id, actor: m.actor, object: m.object, destination: m.destination, requires: m.requires || [], done: done(m) })),
      note: feedback && { type: feedback.type, kind: feedback.result?.kind || null, text: $('#note').innerText },
      records: game.records.map((r) => ({
        id: r.id, mode: r.mode, attempts: r.attempts, completed: r.completed, firstCorrect: r.firstCorrect,
        firstHelpUsed: r.firstHelpUsed, firstAudioHelpUsed: r.firstAudioHelpUsed, helpUsed: r.helpUsed, audioHelpUsed: r.audioHelpUsed,
      })),
      voice: { state: voice.state, id: voice.currentId, automatic: voice.automatic, readingOnly: voice.readingOnly },
      coins: $('#r-coins').textContent,
    }),
    solve: () => { const m = activeMission(); selectActor(m.actor); selectObject(m.object); return place(m.destination); },
    advance: () => advance(),
    boxes: () => stage.boxes(),
    geometry: () => stage.geo && { layout: stage.geo.layout, unit: stage.geo.unit, floorY: stage.geo.floorY, h: stage.geo.h, W: stage.geo.W },
  };
}
