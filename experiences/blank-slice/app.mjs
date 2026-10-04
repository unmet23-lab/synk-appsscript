// 빈칸 베기 — 화면과 흐름. 판정·구성은 core.mjs, 3D는 stage.mjs, 공통 학습 기록과 추천은 learning.mjs(아틀라스).
// 손맛: 베는 순간의 소리·진동·점수 튀기는 여기서, 멈칫·칼빛·부스러기는 stage.mjs에서 같은 순간에 낸다.
// 맞힌 낱말이 빈칸에 끼워지는 순간에는 ‘톡’과 사운드킷 ‘획득’(픽), 빈칸 눌림, 반짝이, 점수 올라가기가 함께 온다.
import { ITEMS, PRACTICE, SKILL_LABEL, KIND_LABEL } from './content.mjs';
import { parts, filled, shuffled, composeRound, pointsFor, scoreRound, hangTime, readDelay } from './core.mjs';
import { GAME_ID, rankItems, createReadingConfirmation, skillReport, assignmentItems, assignmentLabel, FLOW_SLICE, FLOW_WORDS, sliceObservation } from './learning.mjs';
import * as sound from './audio.mjs';
import { swingPower } from './sfx.mjs';
import { createStage, FEEL } from './stage.mjs';

const $ = (s) => document.querySelector(s);
const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const announce = (text) => { const n = $('#sr-live'); n.textContent = ''; requestAnimationFrame(() => { n.textContent = text; }); };
/** 진동(되는 기기만). 소리를 끄면 진동도 쉰다. */
const buzz = (ms) => { try { if (sound.isOn() && navigator.vibrate) navigator.vibrate(ms); } catch { /* 진동 없는 기기 */ } };
const punch = (node) => { if (!node) return; node.classList.remove('punch'); void node.offsetWidth; node.classList.add('punch'); };
const QA = new URLSearchParams(location.search).has('qa');
// 공통 코인 스크립트(collection.js)를 읽지 못했으면 코인 줄을 숨긴다(모듈은 본문 끝 스크립트 뒤에 돈다).
if (!globalThis.SynkPlayCollection) for (const n of document.querySelectorAll('.synk-collection-line')) n.hidden = true;
const impacts = [];   // 확인용(?qa): 벤 순간의 시각·자리

/* ── 저장: 판 수·연습 여부·천천히 모드·최고 기록. 학습 기록은 아틀라스가 따로 맡는다 ── */
const KEY = 'synk.blank-slice.v1';
let saved = true;
function load() {
  try { const p = JSON.parse(localStorage.getItem(KEY) || 'null'); if (p && p.v === 1) return p; } catch { saved = false; }
  return { v: 1, plays: 0, practiced: false, slow: false, best: null };
}
const progress = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(progress)); saved = true; } catch { saved = false; } };

/* ── 아틀라스 ── */
let coach = null;
try { coach = window.SynkLearning?.createGame({ gameId: GAME_ID, storage: window.localStorage }) || null; } catch { coach = null; }
const atlas = (fn, fallback = null) => { if (!coach) return fallback; try { return fn(coach); } catch { return fallback; } };
const assignment = () => atlas(c => c.assignment?.());
const hosted = atlas(c => typeof c.assignment === 'function', false);
// 이 화면을 연 WORLD 과제가 닫혔다(다른 과제를 열었거나 끝남). 더는 기록되지 않으니 결과 화면이 그렇게 알린다.
const runClosed = () => { if (!coach || !hosted) return false; try { coach.assignment?.(); return false; } catch (error) { return error?.code === 'RUN_ENDED'; } };

/* ── 상태 ── */
const state = { run: 0, queue: [], index: 0, results: [], combo: 0, score: 0, cur: null, practice: null, paused: false, ranked: null,
  flow: null, tired: false, pausedMs: 0, pausedAt: 0 };
// 순간 맞춤: 조각이 떠 있는 시간만 이 사람에 맞춘다(연습 문장 제외). 피곤한 날은 연속으로 맞혀도 빨라지지 않는다.
function startFlow() {
  try { state.flow?.end(); } catch { /* 이어 하기 기억은 편의 */ }
  state.tired = atlas((c) => c.today?.() === 'tired', false);
  state.flow = atlas((c) => c.live?.(FLOW_SLICE, { words: FLOW_WORDS }) ?? null);
  return atlas(() => state.flow?.intro().line?.text) || null;
}
function endFlow() { const flow = state.flow; state.flow = null; if (flow) atlas(() => flow.end()); }
const hangScale = () => atlas(() => state.flow?.settings().values.hang, 1) || 1;
/** 한 번 던진 결과를 순간 맞춤에 넘긴다. 바뀐 것이 있으면 한 줄로만 알린다. */
function followFlow(cur, word) {
  if (!state.flow || !cur?.tossAt) return;
  const used = (performance.now() - cur.tossAt - (state.pausedMs - cur.pausedBase)) / cur.hangMs;
  const out = atlas(() => state.flow.observe(sliceObservation({ word, answer: cur.item.answer, used })));
  cur.tossAt = 0;
  if (out?.line) { tip(out.line.text); const run = state.run; setTimeout(() => { if (live(run) && $('#tip').textContent === out.line.text) tip(null); }, 2200); }
}
const live = (run) => run === state.run;
let stage = null;

/** 멈춤을 아는 지연: 쉬는 동안은 시간이 흐르지 않고, 판이 바뀌면 취소된다. */
function after(ms, fn) {
  const run = state.run; let left = ms, last = performance.now();
  const tick = () => {
    if (!live(run)) return;
    const now = performance.now(); if (!state.paused) left -= now - last; last = now;
    if (left <= 0) fn(); else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const show = (id) => {
  for (const s of ['lobby', 'game', 'results']) $('#' + s).hidden = s !== id;
  stage?.setActive(id === 'game');   // 게임 화면이 아니면 3D를 그리지 않는다
  window.scrollTo(0, 0);
};

/* ── 입구 ── */
function renderLobby() {
  state.run += 1; stage?.clear(); hideAnswerCheck();
  const target = assignment(), targetItems = assignmentItems(target);
  state.ranked = progress.plays === 0 ? null : atlas((c) => rankItems(c, ITEMS));
  $('#l-count').textContent = String(target ? targetItems.length : 12);
  $('#btn-start').disabled = !!target && targetItems.length === 0;
  $('#l-reason').textContent = target && !targetItems.length ? '이 과제의 문항이 바뀌어 지금은 시작할 수 없어요. WORLD로 돌아가 선생님께 새 과제 배정을 요청해 주세요.'
    : target ? `${assignmentLabel(target)}. 이 목표 문장에 답하면 WORLD 과제에 반영돼요. 놓친 문장은 멈춘 보기에서 답해요.` : progress.plays === 0
    ? '처음이라 쉬운 문장부터 시작해요. 첫 문장은 연습이에요.'
    : state.ranked?.reason ? `${state.ranked.reason} 그 문장들을 먼저 넣었어요.` : '새 문장을 섞어 한 판을 만들어요.';
  const best = progress.best;
  $('#best-line').hidden = !best; if (best) $('#best-line').textContent = `최고 ${best.score}점 · ${best.correct}/${best.total}`;
  const warn = atlas((c) => c.summary().storage?.warning) || (!coach ? '학습 기록을 쓸 수 없어 기본 순서로 진행해요.' : null) || (!saved ? '이 브라우저에 진행을 저장할 수 없어요.' : null);
  $('#storage-note').hidden = !warn; $('#storage-note').textContent = warn || '';
  $('#reset-learning').hidden = hosted;
  if (hosted) $('#learning-scope').textContent = 'WORLD에서 선택한 계정의 학습 기록으로 연결해요. 기록 공유와 삭제는 WORLD 계정 설정에서 관리해요.';
  syncToggles();
  show('lobby');
}

function syncToggles() {
  for (const t of document.querySelectorAll('[data-sound-toggle]')) {
    t.setAttribute('aria-pressed', String(sound.isOn()));
    if (t.hasAttribute('data-sound-label')) t.textContent = sound.isOn() ? '소리 켜짐' : '소리 꺼짐';
  }
  for (const t of [$('#slow-toggle'), $('#slow-toggle-2')]) { t.setAttribute('aria-pressed', String(progress.slow)); t.textContent = progress.slow ? '천천히 모드 켜짐' : '천천히 모드 꺼짐'; }
}

/* ── 한 판 ── */
let stageReady = null;
/** 3D 무대는 하나만 만든다(입구에서 미리 만들기와 시작 단추가 겹쳐도). 실패하면 다음에 다시 시도한다. */
function ensureStage() {
  if (!stageReady) {
    stageReady = createStage({ host: $('#arena'), overlay: $('#trail'), onSlice, onLanded, onLaunch, onSwing, reducedMotion: reduced })
      .then((s) => {
        stage = s;
        stage.setShowNumbers(window.matchMedia?.('(hover: hover) and (pointer: fine)').matches);   // 마우스 쓰는 넓은 화면만 번호(키보드 1~4)
        return s;
      })
      .catch((e) => { stageReady = null; throw e; });
  }
  return stageReady.then((s) => { s.setActive(!$('#game').hidden); s.resize(); return s; });
}

async function startRound() {
  const target = assignment(), targetItems = assignmentItems(target);
  if (target && !targetItems.length) return renderLobby();
  // 과제 판인지는 시작할 때 정한다. 판 중에 과제가 닫혀도 그 판을 자유 연습의 판 수·최고 점수로 세지 않는다.
  state.targeted = !!target;
  sound.unlock();
  show('game');
  state.run += 1;
  const run = state.run;
  // 공통 코인(play-common): 이 판의 번호. 끝까지 마친 판만 받는다. 코인은 학습 기록에 쓰지 않는다.
  state.coinRound = globalThis.SynkPlayCollection?.roundId('blank-slice') || null;
  // 무대를 준비하는 동안에도 쉬기를 누를 수 있다. 상태를 먼저 정해 두고, 준비가 끝나면 쉬기 상태를 무대에 그대로 넘긴다
  const opening = startFlow();
  Object.assign(state, { index: 0, results: [], combo: 0, score: 0, cur: null, practice: null, paused: false,
    queue: targetItems || composeRound(ITEMS, { ranked: state.ranked?.order, firstTime: progress.plays === 0, seed: progress.plays + 1 }) });
  countScore.token = (countScore.token || 0) + 1; countScore.anim = false;
  updateHud();
  try { await ensureStage(); }
  catch {
    // WebGL을 만들 수 없는 기기·브라우저: 빈 화면에 멈추지 않고 입구에서 알린다
    renderLobby();
    $('#storage-note').hidden = false;
    $('#storage-note').textContent = '이 브라우저에서는 3D 화면을 만들 수 없어요. 다른 브라우저(크롬·사파리 최신판)로 열어 주세요.';
    return;
  }
  if (!live(run)) return;
  stage.pause(state.paused);
  if (!target && !progress.practiced) startPractice();
  else { if (opening) { tip(opening); setTimeout(() => { if (live(run) && $('#tip').textContent === opening) tip(null); }, 2600); } nextItem(); }
}

function renderSentence(item, { kicker } = {}) {
  const [a, b] = parts(item.text);
  $('#s-kicker').textContent = kicker || `${state.index + 1}번 문장`;
  $('#s-text').innerHTML = `${esc(a)}<span class="blank" id="blank" aria-label="빈칸">&nbsp;</span>${esc(b)}`;
  $('#sentence').classList.remove('done', 'miss');
}
const sentenceBottom = () => { const a = $('#arena').getBoundingClientRect(), s = $('#sentence').getBoundingClientRect(); return s.bottom - a.top; };

function updateHud() {
  $('#g-count').textContent = `${Math.min(state.index + 1, state.queue.length)} / ${state.queue.length}`;
  if (!countScore.anim) $('#g-score').textContent = String(state.score);
  $('#g-combo').textContent = String(state.combo);
  $('#g-combo-wrap').dataset.tier = state.combo >= 6 ? '3' : state.combo >= 3 ? '2' : '1';
}

/** 점수가 올라간다(낱말이 빈칸에 끼워지는 순간부터 0.42초). */
function countScore() {
  const node = $('#g-score'), from = Number(node.textContent) || 0, to = state.score;
  const token = (countScore.token = (countScore.token || 0) + 1);
  punch(node.closest('.pill'));
  if (reduced() || from === to) { node.textContent = String(to); countScore.anim = false; return; }
  countScore.anim = true;
  const t0 = performance.now();
  const tick = (now) => {
    if (token !== countScore.token) return;
    const k = Math.min(1, (now - t0) / 420);
    node.textContent = String(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))));
    if (k < 1) requestAnimationFrame(tick); else countScore.anim = false;
  };
  requestAnimationFrame(tick);
}

/* 연습: 기록하지 않는다. 정답 조각을 빛나는 테두리로 알려 주고 천천히 던진다. 맞힐 때까지(최대 세 번) */
function startPractice() {
  state.practice = { tries: 0 };
  const opts = shuffled(PRACTICE.options);
  state.practice.options = opts;
  renderSentence(PRACTICE, { kicker: '연습 문장' });
  tip('빛나는 조각이 빈칸에 맞는 말이에요. 손가락이나 마우스로 그어 베어 보세요.', { silent: true });
  // 화면 읽기 프로그램에는 문장·보기·정답 번호까지 알린다(빛은 눈으로만 보이니까)
  announce(`연습 문장. ${PRACTICE.text.replace('{}', '빈칸')} 보기: ${opts.map((w, i) => `${i + 1} ${w}`).join(', ')}. 정답은 ${opts.indexOf(PRACTICE.answer) + 1}번 ${PRACTICE.answer}예요. 그어 베거나 숫자 키로 베어 보세요.`);
  after(900, practiceToss);
}
function practiceToss() {
  const pr = state.practice; if (!pr) return;
  pr.tries += 1;
  const words = pr.options.map((word, i) => ({ word, n: i + 1 }));
  stage.setTopPx(sentenceBottom());
  pr.token = stage.toss(words, { hang: hangTime({ slow: true }) * 1.15, highlight: pr.options.indexOf(PRACTICE.answer) });
}
function practiceResult(correct, word, x, y) {
  const pr = state.practice;
  if (correct) {
    stage.settle();
    after(FEEL.stop.ok, () => flyToBlank(word, x, y, () => landed(word)));
    tip('좋아요! 이제 진짜 시작이에요. 빛나는 표시는 없어요.');
    progress.practiced = true; save();
    state.practice = null;
    after(1700, () => { tip(null); nextItem(); });
    return;
  }
  after(word ? 240 : 0, () => sound.play(sound.pick('calm1', 'calm2')));
  stage.settle({ reveal: pr.options.indexOf(PRACTICE.answer) });
  if (pr.tries >= 3) { tip('괜찮아요. 하면서 익혀요!'); state.practice = null; progress.practiced = true; save(); after(1400, () => { tip(null); nextItem(); }); return; }
  tip(word ? `‘${word}’은(는) 빈칸에 맞지 않아요. 빛나는 조각을 베어 봐요.` : '조각이 떨어졌어요. 다시 던질게요!');
  after(1100, practiceToss);
}

function nextItem() {
  if (state.index >= state.queue.length) return finish();
  const item = state.queue[state.index];
  const cur = { item, check: atlas((c) => createReadingConfirmation(c, item)), tosses: 0, done: false, confirmed: false, options: shuffled(item.options), token: null };
  state.cur = cur;
  renderSentence(item);
  updateHud();
  hideExplain();
  hideAnswerCheck();
  announce(`${state.index + 1}번 문장. ${item.text.replace('{}', '빈칸')} 보기: ${cur.options.map((w, i) => `${i + 1} ${w}`).join(', ')}`);
  after(readDelay(item.text, { slow: progress.slow }), () => { if (state.cur === cur && !cur.done) tossCur(); });
}

function tossCur() {
  const cur = state.cur; cur.tosses += 1;
  const words = cur.options.map((word, i) => ({ word, n: i + 1 }));
  stage.setTopPx(sentenceBottom());
  // 피곤한 날은 연속 가속을 쓰지 않는다. 순간 맞춤의 배율은 그 사람의 기본 체공 시간을 맞춘다.
  const hang = hangTime({ difficulty: cur.item.difficulty, combo: state.tired ? 0 : state.combo, slow: progress.slow }) * hangScale();
  cur.tossAt = performance.now(); cur.hangMs = hang * 1000; cur.pausedBase = state.pausedMs;
  cur.token = stage.toss(words, { hang });
}

/** 베는 순간의 소리·진동. 화면 쪽 손맛(멈칫·칼빛·부스러기)은 stage가 낸다. 반환: verdict 그대로. */
function hit(verdict, nx, combo = 1, at = null) {
  sound.sfx('slice', { correct: verdict === 'ok', combo, x: nx });
  buzz(verdict === 'ok' ? 18 : 10);
  if (QA) {
    impacts.push({ t: performance.now(), verdict, x: at?.x, y: at?.y });
    if (window.__sliceMark) {   // 시연 영상의 소리 맞추기: 벤 순간 왼쪽 위 16px에 자홍 표시(영상에서 지운다)
      const d = document.createElement('div');
      d.style.cssText = 'position:fixed;left:0;top:0;width:16px;height:16px;background:#ff00ff;z-index:2147483647;pointer-events:none';
      document.body.append(d); setTimeout(() => d.remove(), 220);
    }
  }
  return verdict;
}

/** stage가 조각 하나를 베었을 때. 반환한 판정('ok'·'wrong'·null)에 맞춰 stage가 손맛을 낸다. */
function onSlice({ word, x, y, nx, token }) {
  if (state.practice) {
    if (token !== state.practice.token) return hit(null, nx, 1, { x, y });
    const ok = word === PRACTICE.answer;
    hit(ok ? 'ok' : 'wrong', nx, 1, { x, y });
    practiceResult(ok, word, x, y);
    return ok ? 'ok' : 'wrong';
  }
  const cur = state.cur; if (!cur || cur.done || token !== cur.token) return hit(null, nx, 1, { x, y });
  // 벤 말이 이 문장의 답이다. 맞음·틀림 손맛(멈칫·번쩍임·‘팅’·점수)은 베는 순간에 바로 낸다(10-02 확정, 10-03 「3번」).
  cur.done = true; cur.confirmed = true;
  const item = cur.item, correct = word === item.answer;
  const recorded = recordedOf(cur.check?.confirm(word));
  followFlow(cur, word);
  if (correct) {
    state.combo += 1;
    hit('ok', nx, state.combo, { x, y });
    const pts = pointsFor(state.combo); state.score += pts;
    state.results.push({ itemId: item.id, skill: item.skill, choice: word, correct: true, points: pts, readingChoice: word, readingCorrect: true, readingRecorded: recorded });
    stage.settle();
    after(FEEL.stop.ok, () => flyToBlank(word, x, y, () => landed(word)));
    popText(state.combo >= 2 ? `+${pts} · ${state.combo}연속!` : `+${pts}`, x, y, state.combo);
    if (state.combo % 4 === 0) after(300, () => sound.play(sound.pick('joy1', 'joy2')));
    updateHud(); punch($('#g-combo-wrap'));
    announce(`맞았어요. ${filled(item, word)}`);
    after(1250, () => { state.index += 1; nextItem(); });
    return 'ok';
  }
  state.combo = 0;
  hit('wrong', nx, 0, { x, y });
  state.results.push({ itemId: item.id, skill: item.skill, choice: word, correct: false, points: 0, readingChoice: word, readingCorrect: false, readingRecorded: recorded });
  stage.settle({ reveal: cur.options.indexOf(item.answer) });
  after(240, () => sound.play(sound.pick('calm1', 'calm2')));   // 베는 소리 뒤에 몽글의 ‘괜찮아’(실패음 아님)
  updateHud();
  after(500, () => showExplain(item, word, word));
  return 'wrong';
}
const recordedOf = (assessment) => !!assessment && assessment.verdict !== 'unassessed';

/* ── 읽기 확인: 두 번 던져도 못 벤 문장만. 손이 늦어 놓친 것과 몰라서 놓친 것을 가르려고, 정답을 보이기 전에 멈춘 보기에서 시간 제한 없이 답한다 ── */
function hideAnswerCheck() { $('#answer-check').hidden = true; $('#check-options').replaceChildren(); }
function showAnswerCheck(cur) {
  if (state.cur !== cur || cur.confirmed) return;
  $('#check-sentence').textContent = cur.item.text.replace('{}', '（　　）');
  $('#check-options').replaceChildren(...cur.options.map((word, index) => {
    const button = el('button', 'chip-btn wide'); button.type = 'button'; button.textContent = `${index + 1}. ${word}`; button.dataset.word = word;
    button.onclick = () => confirmReading(cur, word); return button;
  }));
  $('#answer-check').hidden = false; $('#check-title').focus({ preventScroll: true });
  announce('시간 제한 없이 빈칸에 맞는 말을 골라 주세요. 아직 정답은 공개하지 않았어요.');
}

/** 놓친 문장에서 멈춘 보기로 고른 답. 베기 점수·연속은 주지 않고(베지 않았으니), 읽기 기록에만 남긴 뒤 정답과 이유를 보인다. */
function confirmReading(cur, word) {
  if (state.cur !== cur || cur.confirmed || state.paused || $('#answer-check').hidden || !cur.options.includes(word)) return;
  cur.confirmed = true;
  const recorded = recordedOf(cur.check?.confirm(word));
  hideAnswerCheck();
  const item = cur.item, readingCorrect = word === item.answer;
  state.results.push({ itemId: item.id, skill: item.skill, choice: null, correct: null, points: 0, readingChoice: word, readingCorrect, readingRecorded: recorded });
  updateHud();
  if (!readingCorrect) after(240, () => sound.play(sound.pick('calm1', 'calm2')));
  showExplain(item, null, word);
}

function onLanded({ token }) {
  if (state.practice) { if (token === state.practice.token) practiceResult(false, null); return; }
  const cur = state.cur; if (!cur || cur.done || token !== cur.token) return;
  followFlow(cur, null);
  if (cur.tosses < 2) { popText('한 번 더!'); after(450, () => { if (state.cur === cur && !cur.done) tossCur(); }); return; }
  cur.done = true; state.combo = 0; updateHud();
  showAnswerCheck(cur);
}

let lastLaunch = 0;
/** 조각이 바닥에서 튀어 오를 때 ‘뽁’. 한 번 던질 때 한 번만 울린다(넓은 화면은 넷을 0.12초 간격으로 던져, 조각마다 울리면 베는 소리를 흐린다). */
function onLaunch({ n, x }) {
  const now = performance.now(); if (now - lastLaunch < 600) return; lastLaunch = now;
  sound.sfx('launch', { n, x });
}
/** 손이 빠르게 지나갈 때 ‘휙’(벤 것과 상관없이). */
function onSwing({ speed, x, to }) { sound.sfx('whoosh', { power: swingPower(speed), x, to }); }

function showExplain(item, choice, readingChoice) {
  fillBlank(item.answer, 'answer');
  $('#x-kicker').textContent = choice != null ? `정답은 ‘${item.answer}’ · 벤 말 ‘${choice}’`
    : readingChoice === item.answer ? `놓쳤어요 · 고른 답 ‘${readingChoice}’ 맞아요` : `놓쳤어요 · 고른 답 ‘${readingChoice}’ · 정답은 ‘${item.answer}’`;
  $('#x-sentence').innerHTML = esc(filled(item, '\u0000')).replace('\u0000', `<b>${esc(item.answer)}</b>`);
  $('#x-why').textContent = item.why;
  $('#explain').hidden = false;
  $('#btn-next').querySelector('span').textContent = state.index + 1 >= state.queue.length ? '결과 보기' : '다음 문장';
  $('#btn-next').focus({ preventScroll: true });
  announce(`${$('#x-kicker').textContent}. ${filled(item, item.answer)} 왜? ${item.why}`);
}
function hideExplain() { $('#explain').hidden = true; }
$('#btn-next').onclick = () => {
  if ($('#explain').hidden) return;
  sound.play('tap'); hideExplain(); stage.clear();
  state.index += 1; nextItem();
};

function fillBlank(word, tone) {
  const b = $('#blank'); if (!b) return;
  b.textContent = word; b.classList.add('filled', tone);
  $('#sentence').classList.toggle('done', tone === 'ok');
}

/** 벤 낱말이 위로 볼록한 곡선을 따라 빈칸으로 날아간다(돌던 기울기는 0으로). */
function flyToBlank(word, x, y, done) {
  const blank = $('#blank'), arena = $('#arena');
  if (!blank || reduced()) { done(); return; }
  const a = arena.getBoundingClientRect(), r = blank.getBoundingClientRect();
  const chip = el('span', 'fly-chip', esc(word)); arena.append(chip);
  const tx = r.left - a.left + r.width / 2, ty = r.top - a.top + r.height / 2;
  const cx = (x + tx) / 2 + (tx - x) * 0.15, cy = Math.max(8, Math.min(y, ty) - Math.max(40, Math.abs(tx - x) * 0.25));
  chip.style.left = `${x}px`; chip.style.top = `${y}px`;
  const frames = [];
  for (let i = 0; i <= 6; i++) {
    const k = i / 6, u = 1 - k;
    const px = u * u * x + 2 * u * k * cx + k * k * tx, py = u * u * y + 2 * u * k * cy + k * k * ty;
    frames.push({ transform: `translate(calc(-50% + ${px - x}px), calc(-50% + ${py - y}px)) scale(${1.3 - 0.38 * k}) rotate(${(1 - k) * -10}deg)`, offset: k });
  }
  const anim = chip.animate(frames, { duration: 380, easing: 'cubic-bezier(.35,.1,.25,1)' });
  anim.onfinish = () => { chip.remove(); done(); };
}

/** 낱말이 빈칸에 끼워진 순간: ‘톡’과 사운드킷 ‘획득’(픽), 빈칸이 눌렸다 펴지고, 반짝이가 튀고, 점수가 올라간다. */
function landed(word) {
  fillBlank(word, 'ok');
  const b = $('#blank');
  if (b && !reduced()) { b.classList.remove('snap'); void b.offsetWidth; b.classList.add('snap'); }
  const a = $('#arena').getBoundingClientRect(), r = b?.getBoundingClientRect();
  sound.sfx('snap', { x: r ? ((r.left + r.width / 2 - a.left) / a.width) * 2 - 1 : 0 });
  sound.play('earn', { delay: 0.015 });   // ‘톡’(끼워짐) 바로 뒤에 ‘픽’(점수)
  buzz(8);
  sparkleAt(b);
  countScore();
}

/** 빈칸 둘레로 펠트 반짝이가 튄다. */
function sparkleAt(target) {
  if (!target || reduced()) return;
  const arena = $('#arena'), a = arena.getBoundingClientRect(), r = target.getBoundingClientRect();
  const cx = r.left - a.left + r.width / 2, cy = r.top - a.top + r.height / 2;
  for (let i = 0; i < 7; i++) {
    const s = el('i', 'spark'); arena.append(s);
    const ang = (i / 7) * Math.PI * 2 + Math.random() * 0.6, d = 30 + Math.random() * 24, size = 0.7 + Math.random() * 0.5;
    const at = (k) => `translate(calc(-50% + ${Math.cos(ang) * d * k}px), calc(-50% + ${Math.sin(ang) * d * k}px))`;
    s.style.left = `${cx}px`; s.style.top = `${cy}px`;
    s.animate([
      { transform: `${at(0)} scale(.2) rotate(0deg)`, opacity: 1 },
      { transform: `${at(1)} scale(${size}) rotate(80deg)`, opacity: 1, offset: 0.55 },
      { transform: `${at(1.18)} scale(.3) rotate(140deg)`, opacity: 0 },
    ], { duration: 560, easing: 'cubic-bezier(.2,.8,.2,1)' }).onfinish = () => s.remove();
  }
}

function popText(text, x, y, combo = 0) {
  const p = $('#pop'), a = $('#arena').getBoundingClientRect();
  p.textContent = text; p.hidden = false;
  p.dataset.tier = combo >= 6 ? '3' : combo >= 3 ? '2' : '1';
  p.style.left = `${x ?? a.width / 2}px`; p.style.top = `${(y ?? a.height * 0.55) - (x == null ? 30 : 62)}px`;   // 벤 조각의 번쩍임과 겹치지 않게 조각 위로
  p.classList.remove('go'); void p.offsetWidth; p.classList.add('go');
  clearTimeout(popText.t); popText.t = setTimeout(() => { p.hidden = true; }, 900);
}
function tip(text, { silent = false } = {}) { $('#tip').hidden = !text; if (text) { $('#tip').textContent = text; if (!silent) announce(text); } }

/* ── 결과 ── */
function finish() {
  endFlow();
  state.cur = null; stage.clear();
  const s = scoreRound(state.results);
  const target = assignment(), closed = runClosed();
  if (!state.targeted) {
    progress.plays += 1;
    if (!progress.best || s.score > progress.best.score) progress.best = { score: s.score, correct: s.correct, total: s.total };
    save();
  }
  sound.play('achieve');
  // 정답 비율로 받는다(문장 수가 많은 판이 더 받지 않게). WORLD 과제 판도 끝까지 마치면 받는다.
  const coinRound = state.coinRound; state.coinRound = null; $('#r-coins').textContent = '';
  if (coinRound) globalThis.SynkPlayCollection?.award({ game: 'blank-slice', total: s.total, correct: s.correct, completed: true, automatic: false, roundId: coinRound })
    .then((result) => { $('#r-coins').textContent = globalThis.SynkPlayCollection.rewardText(result); });
  $('#r-title').textContent = ['다시 도전!', '좋아요!', '멋져요!', '완벽해요!'][s.stars];
  $('#r-correct').textContent = String(s.correct); $('#r-total').textContent = String(s.total);
  // 별은 하나씩 튀어나오며 도·미·솔로 울린다
  $('#r-stars').innerHTML = [1, 2, 3].map((i) => `<i class="${i <= s.stars ? 'on' : ''}" style="animation-delay:${0.3 + (i - 1) * 0.22}s"></i>`).join('');
  $('#r-stars').setAttribute('aria-label', `별 3개 중 ${s.stars}개`);
  for (let i = 0; i < s.stars; i++) setTimeout(() => sound.sfx('star', { i }), 300 + i * 220);
  $('#r-mongle').src = s.stars >= 2 ? 'assets/brand/mongle-smile.webp' : 'assets/brand/mongle-cheer.webp';
  const notes = [`점수 ${s.score}점`];
  if (s.bestRun >= 3) notes.push(`최고 ${s.bestRun}연속`);
  if (s.missed) notes.push(`놓친 문장 ${s.missed}개(멈춘 보기에서 ${state.results.filter((r) => r.correct === null && r.readingCorrect).length}개 맞힘)`);
  $('#r-note').textContent = notes.join(' · ');
  const log = $('#r-log'); log.textContent = '';
  state.results.forEach((r) => {
    const item = ITEMS.find((x) => x.id === r.itemId);
    const li = el('li', r.correct === true ? 'ok' : r.correct === false ? 'ko' : 'miss');
    const mark = r.correct === true ? '맞음' : r.correct === false ? '다시 볼 것' : '놓침';
    li.innerHTML = `<span class="mark" aria-label="${mark}">${r.correct === true ? '○' : r.correct === false ? '×' : '–'}</span>
      <span class="body"><span class="sent">${esc(filled(item, '\u0000')).replace('\u0000', `<b>${esc(item.answer)}</b>`)}</span>
      <small>${esc(KIND_LABEL[item.kind] || '')}${r.correct === false ? ` · 벤 말 ‘${esc(r.choice)}’` : ''}${r.correct === null ? ` · 놓침 · 멈춘 보기에서 고른 답 ‘${esc(r.readingChoice)}’ ${r.readingCorrect ? '맞음' : '다시 볼 것'}` : ''}</small></span>`;
    log.append(li);
  });
  const next = atlas((c) => rankItems(c, ITEMS));
  state.ranked = next;
  renderSkills(s, next);
  $('#r-next-reason').textContent = closed ? '이 WORLD 과제는 끝났어요. 이어서 하려면 WORLD에서 다시 열어 주세요.' : target ? `${assignmentLabel(target)}. WORLD에서 읽기 수행 결과와 다음 과제를 확인해요.` : nextLine(next);
  $('#r-again span').textContent = target ? '목표 문장 다시 풀기' : '다음 판 시작';
  $('#r-again').disabled = closed;
  $('#r-hub').hidden = hosted || !location.pathname.includes('/blank-slice/');
  show('results');
  $('#r-title').focus({ preventScroll: true });
  announce(`${$('#r-title').textContent} ${s.total}문장 중 ${s.correct}개 맞혔어요. 별 ${s.stars}개, ${s.score}점.`);
}

/** 다음 판 이유: 아틀라스의 이유에 어떤 문장(학습 항목·난도)을 넣는지 붙인다. 한 판은 쉬운 문장부터 늘어놓아서
 *  필요한 문장이 맨 앞에 온다고는 말하지 않는다(composeRound는 1순위 문장을 반드시 넣는다). */
function nextLine(next) {
  if (!next?.reason) return '다음 판에는 새 문장을 섞어요.';
  const first = ITEMS.find((x) => x.id === next.order?.[0]);
  const what = first ? `${first.difficulty >= 2 ? '조금 어려운 ' : ''}${SKILL_LABEL[first.skill]} 문장` : '그 문장';
  return `${next.reason} 다음 판에는 ${what}을 넣어요.`;
}

function renderSkills(s, next) {
  const ul = $('#r-skills'); ul.textContent = '';
  const report = atlas((c) => skillReport(c.summary(), { focusSkillId: next?.skillId }), []);
  const rows = report.length ? report : Object.keys(SKILL_LABEL).map((id) => ({ id, label: SKILL_LABEL[id], text: '기록을 쓸 수 없어요', tone: 'quiet' }));
  for (const r of rows) {
    const rows = state.results.filter(x => x.skill === r.id), b = { correct: rows.filter(x => x.readingCorrect).length, total: rows.length }, focus = r.tone === 'focus';
    const li = el('li', focus ? 'focus' : r.tone === 'good' ? 'good' : '');
    li.innerHTML = `<b>${esc(r.label)}${focus ? ' <i class="next-tag">다음 연습</i>' : ''}</b><em>${b ? `이번 ${b.correct}/${b.total}` : '이번 0'}</em><span>${esc(r.text)}${r.n ? ` · 혼자 푼 새 문항 ${r.n}개 중 ${r.correct}개 맞힘` : ''}</span>`;
    ul.append(li);
  }
}

/* ── 멈춤 ── */
function pause(open = true) {
  if (open && $('#game').hidden) return;
  if (open && !state.paused) state.pausedAt = performance.now();
  if (!open && state.paused && state.pausedAt) { state.pausedMs += performance.now() - state.pausedAt; state.pausedAt = 0; }
  state.paused = open; stage?.pause(open);
  if (open && !$('#pause-dialog').open) $('#pause-dialog').showModal();
  if (!open && $('#pause-dialog').open) $('#pause-dialog').close();
}
$('#pause').onclick = () => pause(true);
$('#resume').onclick = () => { sound.unlock(); pause(false); };
$('#pause-dialog').addEventListener('cancel', (e) => { e.preventDefault(); pause(false); });
$('#quit').onclick = () => {
  // 풀던 문장은 응답 없음으로 닫는다(평가하지 않음)
  if (state.cur && !state.cur.confirmed) state.cur.check?.cancel();
  pause(false); endFlow(); state.cur = null; state.practice = null; tip(null); hideExplain(); hideAnswerCheck(); renderLobby();
};
document.addEventListener('visibilitychange', () => { if (document.hidden && !$('#game').hidden) pause(true); });

/* ── 이벤트 ── */
$('#btn-start').onclick = () => startRound();
$('#r-again').onclick = () => startRound();
$('#r-home').onclick = () => renderLobby();
for (const t of document.querySelectorAll('[data-sound-toggle]')) t.onclick = () => { sound.setOn(!sound.isOn()); syncToggles(); if (sound.isOn()) { sound.unlock(); sound.play('tap'); } };
for (const t of [$('#slow-toggle'), $('#slow-toggle-2')]) t.onclick = () => { progress.slow = !progress.slow; save(); syncToggles(); };
$('#reset-learning').onclick = () => {
  if (!coach) return;
  if (!window.confirm('같은 주소에서 연 모든 SYNK 게임의 학습 기록을 지울까요? 최고 기록은 그대로 남아요.')) return;
  atlas((c) => c.reset()); renderLobby();
};
document.addEventListener('keydown', (e) => {
  if ($('#game').hidden || $('#pause-dialog').open || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.key === 'Escape') { e.preventDefault(); pause(true); return; }
  if (!$('#explain').hidden) { if ((e.key === 'Enter' || e.key === ' ') && document.activeElement !== $('#btn-next')) { e.preventDefault(); $('#btn-next').click(); } return; }
  const n = Number(/^(?:Digit|Numpad)([1-4])$/.exec(e.code)?.[1] ?? (/^[1-4]$/.test(e.key) ? e.key : NaN));
  if (!$('#answer-check').hidden) { if (n >= 1 && n <= 4 && !e.repeat) { e.preventDefault(); $('#check-options').children[n - 1]?.click(); } return; }
  if (n >= 1 && n <= 4 && stage) { e.preventDefault(); stage.sliceIndex(n - 1, { x: 0.85, y: -0.5 }); }
});
window.addEventListener('resize', () => { if (stage && !$('#game').hidden) stage.setTopPx(sentenceBottom()); });

syncToggles();
renderLobby();
// 3D 무대를 입구에서 미리 만든다. 셰이더 미리 데우기(약 0.8초)가 시작 단추를 누른 뒤의 멈춤이 되지 않게, 브라우저가 한가할 때
(window.requestIdleCallback || ((fn) => setTimeout(fn, 600)))(() => { ensureStage().catch(() => { /* 시작할 때 다시 시도하고 안내한다 */ }); }, { timeout: 2500 });
// 시험·확인용 읽기 전용 관찰(?qa)
if (QA) {
  window.__slice = {
    state: () => ({ index: state.index, queue: state.queue.map((x) => x.id), results: state.results.map((r) => ({ ...r })), combo: state.combo, score: state.score,
      cur: state.cur && { id: state.cur.item.id, answer: state.cur.item.answer, options: [...state.cur.options], tosses: state.cur.tosses, done: state.cur.done, confirmed: state.cur.confirmed },
      practice: state.practice && { options: [...state.practice.options], tries: state.practice.tries } }),
    progress: () => JSON.parse(JSON.stringify(progress)), summary: () => atlas((c) => c.summary()),
    pieces: () => stage?.pieceWords() || [], pieceScreen: (i) => stage?.pieceScreen(i) || null,
    arena: () => { const r = $('#arena').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; },
    stage: () => stage,   // 입구 그림 굽기(qa/bake-hero.cjs)용
    hold: () => { state.run += 1; state.cur = null; state.practice = null; },   // 게임 흐름의 예약을 모두 멈춘다(굽기용)
    sound: { start: () => sound.startLog(), take: () => sound.takeLog(), variant: () => sound.sfxVariant() },   // 시연 영상에 같은 소리를 입힐 때
    impacts: () => impacts.splice(0),
    // 시연 영상의 소리 맞추기: 화면 전체를 0.3초 검게 칠하고, 그 장면이 그려지는 시각을 돌려준다
    mark: () => new Promise((res) => {
      const d = document.createElement('div');
      d.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#000;pointer-events:none';
      document.body.append(d);
      requestAnimationFrame((t) => { res(t); setTimeout(() => d.remove(), 300); });
    }),
  };
}
