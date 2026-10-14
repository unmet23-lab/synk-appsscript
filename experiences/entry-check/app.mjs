// 입장 검사 — 화면과 조작. 판정은 core.mjs, 공통 학습 기록과 추천은 learning.mjs(아틀라스)가 맡는다.
import { VENUES, CAST, SKILL_LABEL } from './content.mjs';
import { TUTORIAL, TUTORIAL_CASES, VOICE_ID } from './narration.mjs';
import { koreanTime, minutes, venueById, activeRules, memoActive, judge, composeShift, scoreShift, unlocked, itemLabel } from './core.mjs';
import { GAME_ID, caseMetadata, rankCases, recommendVenue, answerPayload, skillReport, FLOW_ENTRY, magnifierAfter, FLOW_WORDS, assignmentCases, assignmentVenues, entryTargetLabel } from './learning.mjs';
import * as sound from './audio.mjs';
import { fitText, preloadImages } from './kit/lab.mjs';
import { josa } from './kit/josa.mjs';
import { choiceId, choiceCorrection, immediateCheck, followUpResult } from './correction.mjs';

// Restore the verified account before reading progress or enabling play.
await globalThis.SynkPlayAccount.ready();
const progressStorage = globalThis.SynkPlayAccount.storage();

const $ = (s) => document.querySelector(s);
const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((r) => setTimeout(r, reduced() ? 0 : ms));

/* ── 저장: 근무지 별·첫 안내 여부. 학습 기록은 아틀라스가 따로 맡는다 ── */
const PROGRESS_KEY = 'synk.entry-check.v1';
let progressSaved = true;
function loadProgress() {
  try { const p = JSON.parse(progressStorage.getItem(PROGRESS_KEY) || 'null'); if (p && p.v === 1) return { motion: true, ...p }; } catch { progressSaved = false; }
  return { v: 1, stars: {}, plays: 0, tutorial: false, doneDay: null, motion: true };
}
function saveProgress() { try { progressStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); progressSaved = true; } catch { progressSaved = false; } }
const progress = loadProgress();

/* ── 아틀라스: 같은 주소의 다른 SYNK 게임과 기록을 함께 쓴다 ── */
let coach = null;
try { coach = window.SynkLearning?.createGame({ gameId: GAME_ID, storage: window.localStorage }) || null; } catch { coach = null; }
const atlas = (fn, fallback = null) => { if (!coach) return fallback; try { return fn(coach); } catch { return fallback; } };
const assignment=()=>atlas(c=>c.assignment?.());
// SYNK WORLD 안에서는 계정의 기록이다. 이 브라우저가 아니라 WORLD 계정 설정에서 공유·삭제를 관리한다.
const hosted = atlas((c) => typeof c.assignment === 'function', false);
const assignmentSeen=new Set();
// The WORLD run this page was opened for has closed (the student opened another task, or it was finished):
// nothing more is recorded, so the results screen says so instead of offering the next shift.
const runClosed=()=>{if(!coach||!hosted)return false;try{coach.assignment?.();return false;}catch(error){return error?.code==='RUN_ENDED';}};

/* ── 상태 ── */
const state = { venue: null, queue: [], index: 0, results: [], combo: 0, cur: null, memoShown: false, ranked: null, busy: false, shift: 0, guardUntil: 0,
  flow: null, magnifierTimer: 0, flowLine: null, checkNotice: null };
// 근무마다 번호를 올린다. 기다림(움직임·알림) 뒤에 번호가 바뀌었으면 그 근무는 끝난 것이라 이어 가지 않는다(나간 뒤 이전 근무가 뒤에서 진행되던 문제).
const live = (token) => token === state.shift;
// 덮개(안내·알림)를 닫은 직후의 두 번째 탭이 아래 도장 줄을 누르지 않게 잠깐 막는다.
// 처리한 시각이 아니라 입력이 일어난 시각(event.timeStamp)으로 본다. 기기가 바빠 처리가 늦어도 같은 탭은 막힌다.
const holdInput = (ms = 450) => { state.guardUntil = performance.now() + ms; };
const guarded = (e) => ((e && e.timeStamp) || performance.now()) < state.guardUntil;
const setOverlay = (open) => { for (const sel of ['.booth', '.game-bar']) $(sel).inert = open; };
const announce = (text) => { const n = $('#sr-live'); n.textContent = ''; requestAnimationFrame(() => { n.textContent = text; }); };
const ITEM_RULE = { gimbap: 'food', snack: 'food', 'water-bottle': 'food', 'coffee-lid': 'food', 'coffee-open': 'food', 'swim-cap': 'cap', camera: 'camera', phone: 'camera', chair: 'chair', 'picnic-mat': 'chair' };
const DOC_RULE = { kid: ['구분'], fee: ['표', '나이'], date: ['날짜'], card: ['이름'], cap: [], food: [], time: [] };
const DOC_ICON = { card: 'assets/items/library-card.webp', 'pool-card': 'assets/items/pool-card.webp' };
const BAND = { pool: 'pool', library: 'coral', museum: 'lapis', concert: 'butter' };
const isNarrow = () => window.innerWidth < 700;
const sceneSrc = (v) => `assets/scenes/${v.scene}${isNarrow() ? '-m' : ''}.webp`;
// 움직이는 장면: 사용자가 끄거나 기기가 '움직임 줄이기'면 정지 그림과 짧은 페이드만 쓴다
const motionOn = () => !reduced() && progress.motion !== false;
// 반복 영상이 있는 근무지(2026-10-02 도서관 1곳 시험 승인). 나머지는 승인 뒤 굽는다 — art-source/scene-video.mjs
const SCENE_VIDEO = new Set(['library']);
let narrowNow = isNarrow();
function setScene(v) {
  $('#scene').src = sceneSrc(v);
  const vid = $('#scene-video');
  vid.classList.remove('on');
  if (motionOn() && SCENE_VIDEO.has(v.scene)) {
    const src = `assets/scenes/${v.scene}${isNarrow() ? '-m' : ''}.mp4`;
    if (!vid.src.endsWith(src)) vid.src = src;
    vid.play().catch(() => {});
  } else if (vid.getAttribute('src')) { vid.pause(); vid.removeAttribute('src'); vid.load(); }
}
function applyMotion() {
  document.body.classList.toggle('still', !motionOn());
  const t = $('#motion-toggle'); t.setAttribute('aria-pressed', String(progress.motion !== false));
  t.textContent = progress.motion !== false ? '움직이는 장면 켜짐' : '움직이는 장면 꺼짐';
}
const unlockedIds = () => VENUES.filter((v) => unlocked(progress, v.id)).map((v) => v.id);
const show = (id) => {
  for (const s of ['lobby', 'game', 'results']) $('#' + s).hidden = s !== id;
  if (id !== 'game') { $('#scene-video').pause(); hideCoach(); }
  window.scrollTo(0, 0);
};

/* ── 입구 ── */
function renderLobby() {
  const target=assignment(),targetVenues=assignmentVenues(target,[...assignmentSeen]);
  const ids = unlockedIds();
  const rec = progress.plays === 0 ? null : atlas((c) => recommendVenue(c, ids));
  const venue = targetVenues[0] || venueById(rec?.venueId) || VENUES.find((v) => ids.includes(v.id) && (progress.stars[v.id] || 0) < 3) || VENUES[0];
  $('#rec-day').textContent = `${venue.day}일차`;
  $('#rec-name').textContent = venue.name;
  $('#rec-reason').textContent = target ? (targetVenues.length?entryTargetLabel(target):'과제 손님을 불러오지 못했어요. WORLD에서 다시 열어 주세요.') : progress.plays === 0
    ? '처음이니까 제일 쉬운 하늘 수영장부터 해요. 안내문이 세 줄뿐이에요.'
    : rec?.reason ? `${rec.reason} 이 연습에 맞는 손님이 제일 많은 곳이에요.` : '앞 근무지에서 별을 모아 다음 근무지를 열어요.';
  $('#rec-start').onclick = () => startShift(venue.id);
  $('#rec-start').disabled=!!target&&!targetVenues.length;
  $('#how-tutorial').hidden=!!target;
  const warn = atlas((c) => c.summary().storage?.warning) || (!coach ? '학습 기록을 쓸 수 없어 기본 순서로 진행해요.' : null) || (!progressSaved ? '이 브라우저에 진행을 저장할 수 없어요.' : null);
  $('#storage-note').hidden = !warn; $('#storage-note').textContent = warn || '';
  $('#reset-learning').hidden = hosted;
  if (hosted) { $('#learning-scope').textContent = 'WORLD에서 선택한 계정의 학습 기록으로 연결해요. 기록 공유와 삭제는 WORLD 계정 설정에서 관리해요.'; $('#skills-scope').textContent = 'WORLD 계정에 남은'; }
  const list = $('#venues'); list.textContent = '';
  for (const v of VENUES) {
    const open = target?targetVenues.some(x=>x.id===v.id):unlocked(progress, v.id), stars = progress.stars[v.id] || 0;
    const li = el('li');
    const b = el('button', `venue${open ? '' : ' locked'}${v.id === venue.id ? ' is-rec' : ''}`);
    b.type = 'button';
    b.setAttribute('aria-label', `${v.day}일차 ${v.name}${open ? `, 별 ${stars}개` : ', 잠김'}`);
    b.innerHTML = `<span class="thumb"><img src="assets/scenes/${v.scene}-m.webp" alt="" loading="lazy"><b class="num">${v.day}</b>${open ? '' : '<span class="lock">앞 근무지 별 1개면 열려요</span>'}</span>
      <span class="body"><strong>${esc(v.name)}</strong><small>${esc(v.notice.kind)} · 규칙 ${v.notice.rules.length + (v.memo ? 1 : 0)}개</small>
      <span class="stars" aria-hidden="true">${[1, 2, 3].map((i) => `<i class="${i <= stars ? 'on' : ''}"></i>`).join('')}</span></span>`;
    if(target&&!open){li.hidden=true;}else if(target){b.querySelector('.body small').textContent=`이번 목표 손님 ${assignmentCases(v.cases,target).length}명`;}
    if (open) b.onclick = () => startShift(v.id); else b.disabled = true;
    li.append(b); list.append(li);
  }
  show('lobby');
}

/* ── 근무 시작 ── */
// 공통 코인 스크립트(collection.js)를 읽지 못했으면 코인 줄을 숨긴다(모듈은 본문 끝 스크립트 뒤에 돈다).
if (!globalThis.SynkPlayCollection) for (const n of document.querySelectorAll('.synk-collection-line')) n.hidden = true;
function startShift(venueId, { tutorial = !progress.tutorial } = {}) {
  sound.unlock(); sound.stopVoice();
  const v = venueById(venueId);
  const target=assignment(),targetCases=v&&target?assignmentCases(v.cases,target):null;
  if (!v || (target?!targetCases.length:!unlocked(progress, v.id))) return;
  if(target)tutorial=false;
  tut.on = tutorial && v.id === 'pool'; tut.i = 0; hideCoach();
  state.ranked = progress.plays === 0 || tut.on ? null : atlas((c) => rankCases(c, v.cases));
  Object.assign(state, { venue: v, queue: targetCases || (tut.on ? tutorialQueue(v) : composeShift(v, { ranked: state.ranked?.order, firstTime: !progress.tutorial })),
    index: 0, results: [], combo: 0, cur: null, memoShown: false, busy: false, shift: state.shift + 1, targeted: !!target });
  // 공통 코인(play-common): 이 근무의 번호. 연수 근무는 안내를 따라 찍은 도장이라 받지 않는다. 코인은 학습 기록에 쓰지 않는다.
  state.coinRound = tut.on ? null : (globalThis.SynkPlayCollection?.roundId('entry-check') || null);
  // 순간 맞춤: 돋보기가 스스로 나오는 때만 맞춘다(연수 근무는 정해진 대로).
  clearTimeout(state.magnifierTimer); state.flowLine = null; state.checkNotice = null;
  state.flow = tut.on ? null : atlas((c) => c.live?.(FLOW_ENTRY, { words: FLOW_WORDS }) ?? null);
  // 피곤한 날·오랜만인 날의 약속은 첫 손님 앞에서 한 줄로 알린다(지난번에 이어 가는 날은 말하지 않는다).
  state.flowLine = state.flow ? atlas(() => state.flow.intro().line?.text) || null : null;
  sound.preloadVoices([VOICE_ID.brief(v.id), VOICE_ID.memo(), ...(tut.on ? TUTORIAL.map((t) => VOICE_ID.tutorial(t.id)) : []),
    ...state.queue.filter(c => !c.textOnly).flatMap((c) => [VOICE_ID.line(c.id), VOICE_ID.reply(c.id), VOICE_ID.oops(c.id), VOICE_ID.thanks(c.who), VOICE_ID.why(c.who)]),
    ...[0, 1, 2, 3].map(VOICE_ID.result)]);
  // 앞 근무의 흔적 지우기(알림 창·판 높이 여백·동그라미·힌트·반응 스티커)
  $('#memo-alert').hidden = true; document.documentElement.style.removeProperty('--fb-room'); clearMarks(); $('#react').hidden = true;
  for (const c of state.queue) { const im = new Image(); im.src = CAST[c.who].img; }
  setScene(v);
  $('#g-day').textContent = `${v.day}일차`; $('#g-venue').textContent = v.name; $('#g-date').textContent = v.date;
  $('#notice-kind').textContent = v.notice.kind; $('#notice-title').textContent = v.notice.title;
  renderRules(v.notice.rules); $('#memo').hidden = true; $('#memo-rules').textContent = '';
  $('#doc').dataset.band = BAND[v.id] || 'lapis';
  // 첫 손님 전: 책상은 비워 둔다
  $('#doc-rows').textContent = ''; $('#doc').querySelector('.doc-band').hidden = true; $('#stamp-mark').textContent = '';
  $('#doc-empty').hidden = false; $('#doc-empty').textContent = '손님을 기다리는 중이에요.';
  $('#tray').innerHTML = '<li class="none">아직 짐이 없어요.</li>';
  updateHud();
  $('#guest').classList.add('enter'); $('#bubble').classList.add('quiet'); $('#feedback').hidden = true;
  setDock('idle');
  show('game');
  fitCushions();
  // 근무 전 안내
  $('#brief-date').textContent = v.date;
  $('#brief-day').textContent = `${v.day}일차`;
  $('#brief-title').lastChild.textContent = ` ${v.name}`;
  $('#brief-text').textContent = v.briefing;
  const why = target ? entryTargetLabel(target) : tut.on ? '첫 근무라서 연수부터 해요. 하는 방법을 하나씩 알려 줄게요.'
    : state.ranked?.reason && progress.plays > 0 ? `오늘의 손님은 기록에 맞춰 골랐어요. ${state.ranked.reason}` : '';
  $('#brief-reason').hidden = !why; $('#brief-reason').textContent = why;
  $('#briefing').hidden = false; setOverlay(true);
  $('#btn-begin').focus();
  setTimeout(() => { if (!$('#briefing').hidden) sound.say(VOICE_ID.brief(v.id)); }, 350);
}
$('#btn-begin').onclick = () => { sound.unlock(); sound.stopVoice(); sound.play('tap', .8); $('#briefing').hidden = true; setOverlay(false); holdInput(); nextGuest(); };

/** 연수 근무: 첫 손님은 통과(김보리), 둘째 손님은 거절(나구리·김밥). 나머지는 처음 근무와 같은 구성. */
function tutorialQueue(v) {
  const base = composeShift(v, { firstTime: true });
  const fixed = TUTORIAL_CASES.map((id) => v.cases.find((c) => c.id === id)).filter(Boolean);
  return [...fixed, ...base.filter((c) => !TUTORIAL_CASES.includes(c.id))].slice(0, base.length)
    .sort((a, b) => minutes(a.at) - minutes(b.at));
}

/** 안내문 규칙. 거절 이유를 고를 때는 같은 자리에서 펠트 쿠션 판이 된다(규칙 번호 순서로 분홍·버터·라피스, 알림 ④는 분홍). */
const RULE_FELT = ['blush', 'butter', 'lapis'];
function renderRules(rules, into = $('#rules'), startNo = 1) {
  into.textContent = '';
  rules.forEach((r, i) => {
    const li = el('li');
    const b = el('button', 'rule'); b.type = 'button'; b.disabled = true; b.dataset.rule = r.id;
    b.dataset.felt = RULE_FELT[(startNo + i - 1) % RULE_FELT.length];
    b.innerHTML = `<span class="rn">${startNo + i}</span><span class="rt">${esc(r.text)}</span>`;
    b.onclick = (e) => chooseRule(r.id, e);
    li.append(b); into.append(li);
  });
  fitCushions();
}
const ruleButtons = () => [...document.querySelectorAll('#notice .rule')];

/* ── 펠트 쿠션 판(도장 판·거절 이유): 판 비율에 맞는 쿠션 그림을 고르고(모서리·옆면이 찌그러지지 않게), 그 그림을 다 받기 전에는 같은 색 납작한 판 ── */
const CUSHION = [['phone', 1.6], ['mid', 2.4], ['wide', 3.2], ['strip', 6]];
const cushionShape = (w, h) => CUSHION.reduce((best, c) => (Math.abs(Math.log(w / h / c[1])) < Math.abs(Math.log(w / h / best[1])) ? c : best))[0];
const feltLoaded = new Set(), feltLoading = new Set();
function fitCushions() {
  const fresh = new Set(), notice = $('#notice'), probe = !notice.classList.contains('cushions');
  // 규칙은 쿠션 판일 때의 크기로 잰다(고르기 전에 그 판 그림을 미리 받으려고). 재는 동안만 붙였다 떼므로 화면에는 그려지지 않는다
  if (probe) notice.classList.add('cushions');
  for (const b of document.querySelectorAll('#game [data-felt]')) {
    if (!b.offsetWidth || !b.offsetHeight) continue;   // 숨은 판(근무 화면이 닫혔거나 고르는 동안의 도장 판)은 보일 때 다시 잰다
    b.dataset.shape = cushionShape(b.offsetWidth, b.offsetHeight);
    const url = `kit/felt/cushion-${b.dataset.felt}-${b.dataset.shape}.webp`;
    b.toggleAttribute('data-felt-wait', !feltLoaded.has(url));
    if (!feltLoaded.has(url) && !feltLoading.has(url)) fresh.add(url);
  }
  if (probe) notice.classList.remove('cushions');
  // 도장 판 글자: 판의 평평한 면보다 길면 그 판만 글자를 줄인다(키트 fitText — 한 줄)
  for (const s of document.querySelectorAll('.stamp-btn span')) if (s.offsetWidth) fitText(s, { maxLines: 1, minPx: 15, commaBreak: false });
  if (!fresh.size) return;
  for (const u of fresh) feltLoading.add(u);
  preloadImages([...fresh]).then(() => { for (const u of fresh) { feltLoading.delete(u); feltLoaded.add(u); } fitCushions(); });
}
/** 도장을 찍은 뒤: 고른 판은 스티커처럼 들리고, 맞는 판에는 체크 배지(틀린 판에는 표시하지 않는다). 다음 손님에서 지운다. */
function markCushions(item, choice) {
  const picked = choice === 'pass' ? '#btn-pass' : '#btn-reject', right = item.answer === 'pass' ? '#btn-pass' : '#btn-reject';
  $(picked).classList.add('picked'); $(right).classList.add('right');
  if (choice === 'pass' || !$('#notice').classList.contains('cushions')) return;
  for (const r of ruleButtons()) {
    const id = r.dataset.rule;
    r.classList.toggle('picked', id === choice);
    r.classList.toggle('right', id === item.answer);
    r.classList.toggle('dim', id !== choice && id !== item.answer && !item.evidence.includes(id));
  }
}
function clearCushions() {
  for (const n of document.querySelectorAll('#game .picked, #game .right, #notice .rule.dim')) n.classList.remove('picked', 'right', 'dim');
  $('#notice').classList.remove('cushions');
}

function updateHud() {
  $('#g-count').textContent = `${Math.min(state.index + 1, state.queue.length)} / ${state.queue.length}`;
  $('#g-combo').textContent = String(state.combo);
  renderShiftLog();
}

/** 넓은 화면의 '오늘의 손님' 줄: 처리한 손님은 결과 표시, 지금 손님은 테두리, 남은 손님은 흐리게. */
function renderShiftLog() {
  const ol = $('#shiftlog'); if (!ol) return;
  ol.textContent = '';
  state.queue.forEach((c, i) => {
    const r = state.results[i], who = CAST[c.who];
    const li = el('li', r ? 'done' : i === state.index ? 'now' : 'later');
    li.innerHTML = `<img class="face" src="${who.img}" alt="${esc(who.name)}">${r ? `<img class="mark" src="${r.correct ? 'kit/felt/badge-check.webp' : 'assets/felt/drop.webp'}" alt="${r.correct ? '맞음' : '다시 볼 것'}">` : ''}`;
    ol.append(li);
  });
}

/* ── 손님 ── */
async function nextGuest() {
  if (state.index >= state.queue.length) return finishShift();
  const v = state.venue, item = state.queue[state.index], who = CAST[item.who], token = state.shift;
  state.cur = { item, pid: null, hint: 0, choosing: false, done: false, shownAt: 0, pausedMs: 0,
    checkLink: state.checkNotice?.id === item.id ? state.checkNotice : null };
  clearMarks();
  $('#g-clock').textContent = koreanTime(item.at);
  updateHud();
  // 근무 중 알림: 알림 시각이 지난 첫 손님 앞에서 안내문 아래에 붙는다
  if (v.memo && !state.memoShown && memoActive(v, item.at)) {
    state.memoShown = true;
    // 새 규칙은 먼저 크게 보여 주고, 확인하면 안내문 ④번으로 붙인다(놓치지 않게)
    $('#alert-from').textContent = `${v.memo.from} · ${koreanTime(v.memo.at)}`;
    $('#alert-rule').textContent = v.memo.rule.text;
    $('#g-clock').textContent = koreanTime(v.memo.at);
    $('#memo-alert').hidden = false; setOverlay(true); sound.play('notify');
    setDock('memo');
    announce(`새 알림이 왔어요. ${v.memo.rule.text}`);
    setTimeout(() => { if (!$('#memo-alert').hidden) sound.say(VOICE_ID.memo()); }, 650);
    await new Promise((resolve) => { $('#btn-alert').onclick = resolve; $('#btn-alert').focus(); });
    if (!live(token)) return;
    sound.stopVoice();
    $('#memo-alert').hidden = true; setOverlay(false); holdInput(); sound.play('tap', .7);
    const memo = $('#memo');
    $('#memo-from').textContent = v.memo.from; $('#memo-title').textContent = v.memo.title;
    renderRules([v.memo.rule], $('#memo-rules'), v.notice.rules.length + 1);
    memo.hidden = false; memo.classList.remove('arrive'); void memo.offsetWidth; memo.classList.add('arrive');
    $('#g-clock').textContent = koreanTime(item.at);
  }
  renderGuest(item, who);
  renderDoc(item);
  renderTray(item);
  renderQueue();
  state.cur.pid = atlas((c) => (state.flow ? state.flow.present(caseMetadata(item)) : c.present(caseMetadata(item))));
  state.cur.shownAt = performance.now();
  setDock('ready');
  // 지난 손님 뒤에 돋보기 시점이 바뀌었으면 무엇이 바뀌었는지만 한 줄로 알린다.
  if (state.flowLine) { $('#dock-hint').hidden = false; $('#dock-hint').textContent = state.flowLine; announce(state.flowLine); state.flowLine = null; }
  if (state.checkNotice?.id === item.id || item.textOnly) {
    const line = [state.checkNotice?.id === item.id ? state.checkNotice.line : '', item.textOnly ? '이 손님은 목소리 없이 글로만 나와요.' : ''].filter(Boolean).join(' ');
    $('#dock-hint').hidden = false; $('#dock-hint').textContent += ` ${line}`; announce(line); state.checkNotice = null;
  }
  scheduleMagnifier(token);
  $('#bubble').focus({ preventScroll: true });
  // 손님이 창문 앞에 선 뒤 말한다. 연수 단계가 있는 손님이면 대사 뒤에 안내 목소리가 이어진다.
  const idx = state.index;
  setTimeout(() => {
    if (!live(token) || state.index !== idx || state.cur?.done) return;
    if (tut.on && tutStep()?.guest === idx) showCoach({ withLine: true });
    else if (!item.textOnly) {
      sound.say(VOICE_ID.line(item.id));
      // The clue is in this line: hearing it read aloud is help for the reading task.
      if (item.look === 'line' && sound.isVoiceOn() && state.cur?.pid) atlas((c) => c.help(state.cur.pid, 'replay'));
    }
  }, motionOn() ? 620 : 200);
}

function renderGuest(item, who) {
  const g = $('#guest');
  g.style.setProperty('--scale', who.scale);
  $('#guest-img').src = who.img; $('#guest-img').alt = `${who.label} 손님 ${who.name}`;
  $('#react').hidden = true;
  g.classList.remove('leave-in', 'leave-out'); g.classList.add('enter'); void g.offsetWidth; g.classList.remove('enter');
  $('#who').textContent = who.name;
  $('#line').textContent = item.line;
  $('#bubble').classList.remove('quiet');
}

function renderDoc(item) {
  const d = item.doc, rows = $('#doc-rows'); rows.textContent = '';
  $('#stamp-mark').textContent = ''; $('#stamp-mark').classList.remove('hit');
  $('#doc-empty').hidden = !!d; $('#doc-empty').textContent = '보여 준 표나 카드가 없어요.'; $('#doc').querySelector('.doc-band').hidden = !d;
  if (!d) return;
  $('#doc-title').textContent = d.title;
  const icon = DOC_ICON[d.kind];
  $('#doc-icon').hidden = !icon; if (icon) $('#doc-icon').src = icon;
  for (const [k, val] of d.rows) { rows.append(el('dt', null, esc(k))); const dd = el('dd', null, esc(val)); dd.dataset.key = k; rows.append(dd); }
}

function renderTray(item) {
  const ul = $('#tray'); ul.textContent = '';
  if (!item.items.length) { ul.append(el('li', 'none', '보여 준 짐이 없어요.')); return; }
  for (const entry of item.items) {
    const { id, count, label } = itemLabel(entry);
    const li = el('li'); li.dataset.item = id;
    li.innerHTML = `<img src="assets/items/${id}.webp" alt=""><span>${esc(label)}${count > 1 ? ` <i class="n">×${count}</i>` : ''}</span>`;
    ul.append(li);
  }
}

function renderQueue() {
  const q = $('#queue'); q.textContent = '';
  for (const c of state.queue.slice(state.index + 1, state.index + 3)) { const im = el('img'); im.src = CAST[c.who].img; im.alt = ''; q.append(im); }
}

/* ── 조작 ── */
function setDock(mode) {
  const hint = $('#dock-hint'), stamps = $('#stamps'), choose = $('#choose');
  const ready = mode === 'ready';
  for (const b of ['#btn-pass', '#btn-reject', '#btn-hint']) $(b).disabled = !ready && mode !== 'choosing';
  stamps.hidden = mode === 'choosing'; choose.hidden = mode !== 'choosing';
  $('#notice').classList.toggle('choosing', mode === 'choosing');
  const only = tut.on && tutStep()?.wait?.startsWith('rule:') ? tutStep().wait.slice(5) : null;   // 연수: 고를 규칙 하나만 연다
  for (const r of ruleButtons()) r.disabled = mode !== 'choosing' || (only && r.dataset.rule !== only);
  // 거절 이유를 고를 때는 안내문 규칙이 같은 자리에서 펠트 쿠션 판이 된다. 도장을 찍은 뒤(done)에는 고른 판·맞는 판을 보이려고 그대로 두고 다음 손님에서 걷는다
  if (mode !== 'done') { clearCushions(); if (mode === 'choosing') { $('#notice').classList.add('cushions'); fitCushions(); } }
  $('#btn-cancel').hidden = tut.on;
  const msg = { idle: '안내문을 읽고 도장을 골라요.', memo: '새 알림이 왔어요! 안내문 아래를 먼저 읽어요.',
    ready: tut.on ? '' : state.index === 0 ? '① 안내문 → ② 손님의 말·표·짐 → ③ 도장. 시간 제한은 없어요.' : '규칙을 모두 지키면 통과, 하나라도 어기면 거절이에요.',
    choosing: '', done: '' }[mode];
  hint.textContent = msg; hint.hidden = !msg;
  $('#btn-hint').dataset.level = String(state.cur?.hint || 0);
}

function startChoosing(e) {
  if (!state.cur || state.cur.done || guarded(e)) return;
  if (tut.on && tutStep()?.wait !== 'reject') return;
  state.cur.choosing = true;
  if (tut.on) tutAdvance({ show: false });
  setDock('choosing');
  if (tut.on) setTimeout(() => showCoach(), isNarrow() ? 380 : 0);
  const first = ruleButtons()[0];
  if (isNarrow()) $('#notice').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
  first?.focus({ preventScroll: true });
}
function cancelChoosing() { if (!state.cur || state.cur.done || tut.on) return; state.cur.choosing = false; setDock('ready'); $('#btn-reject').focus(); }
function chooseRule(id, e) { if (state.cur?.choosing) decide(id, e); }

/** 순간 맞춤이 정한 때가 되면 첫 돋보기가 스스로 나온다. 누른 것과 똑같이 도움으로 기록한다. */
function scheduleMagnifier(token) {
  clearTimeout(state.magnifierTimer);
  const after = atlas(() => magnifierAfter(state.flow));
  if (after == null || tut.on) return;
  const cur = state.cur;
  const fire = () => {
    // 쉬는 동안에는 나오지 않는다. 쉬기를 닫으면 곧 이어서 본다.
    if ($('#pause-dialog').open) { state.magnifierTimer = setTimeout(fire, 1000); return; }
    if (live(token) && state.cur === cur && !cur.done && !cur.choosing && cur.hint === 0 && !$('#game').hidden) showClue();
  };
  state.magnifierTimer = setTimeout(fire, after);
}
function useHint(e) { if (!guarded(e)) showClue(); }
function showClue() {
  const cur = state.cur; if (!cur || cur.done || cur.hint >= 2 || tut.on) return;
  cur.hint += 1; sound.play('ask', .7);
  atlas((c) => c.help(cur.pid, 'hint'));
  const item = cur.item;
  if (cur.hint === 1) {
    if (item.look === 'line') $('#bubble').classList.add('hint');
    else if (item.look === 'clock') $('#clock-wrap').classList.add('flag');
    else if (item.look === 'doc') {
      const keys = item.evidence.flatMap((r) => DOC_RULE[r] || []);
      const dds = [...document.querySelectorAll('#doc-rows dd')].filter((d) => !keys.length || keys.includes(d.dataset.key));
      dds.forEach((d) => d.classList.add('hint'));
      if (item.evidence.includes('card') && item.doc) $('#doc .doc-band').classList.add('hint');   // 카드 종류(제목)도 근거다
      if (!item.doc) $('#doc').classList.add('hint');
    } else {
      const lis = [...document.querySelectorAll('#tray li[data-item]')].filter((li) => item.evidence.includes(ITEM_RULE[li.dataset.item]));
      (lis.length ? lis : [...document.querySelectorAll('#tray li')]).forEach((li) => li.classList.add('hint'));
    }
    $('#dock-hint').hidden = false; $('#dock-hint').textContent = '노란 표시를 안내문과 맞춰 봐요.';
  } else {
    for (const r of ruleButtons()) if (item.evidence.includes(r.dataset.rule)) r.classList.add('hint');
    $('#dock-hint').hidden = false; $('#dock-hint').textContent = '노란 규칙을 다시 읽어 봐요.';
  }
  $('#btn-hint').dataset.level = String(cur.hint);
  if (cur.choosing) $('#dock-hint').hidden = true;
}

async function decide(choice, e) {
  const cur = state.cur; if (!cur || cur.done || state.busy || guarded(e)) return;
  // 연수: 지금 단계가 시키는 도장만 받는다. 답을 알려 준 도장은 '답 도움'으로 기록해 혼자 해낸 기록에 넣지 않는다.
  const step = tut.on ? tutStep() : null;
  if (tut.on && !(step?.wait === choice || step?.wait === `rule:${choice}`)) return;
  // 답을 말해 준 연수 단계를 본 손님(showCoach에서 표시)은 연수를 건너뛰고 찍어도 '답 도움'이다
  if (cur.guided) atlas((c) => c.help(cur.pid, 'answer'));
  sound.unlock(); hideCoach(); sound.stopVoice();
  cur.done = true; state.busy = true;
  if(state.targeted)assignmentSeen.add(cur.item.id);
  const item = cur.item, v = state.venue, token = state.shift;
  const result = judge(item, choice);
  clearTimeout(state.magnifierTimer);
  // 같은 응답이 공통 학습 기록(도움 받은 정답은 혼자 해낸 것으로 세지 않음)과 돋보기 시점을 함께 움직인다.
  // 손님을 본 때부터 도장까지 걸린 시간(쉬기 창을 연 동안은 빼고). 엔진은 돋보기 없이 바르게 찍은 시간만 모아
  // 이 사람의 '머뭇거림' 기준으로 쓴다.
  const latencyMs = cur.shownAt ? Math.min(600000, Math.max(0, performance.now() - cur.shownAt - cur.pausedMs)) : null;
  const payload = answerPayload(result.correct, { selectedId: choiceId(choice), correctId: choiceId(item.answer) });
  const out = state.flow ? atlas(() => state.flow.answer(cur.pid, payload, { latencyMs })) : null;
  const rec = out ? out.recorded : atlas((c) => c.answer(cur.pid, payload));
  if (out?.line) state.flowLine = out.line.text;
  cur.recheck = followUpResult(coach, cur.checkLink, item, rec);
  state.results.push({ caseId: item.id, who: item.who, choice, expected: item.answer, correct: result.correct, skill: item.skill,
    hinted: cur.hint > 0, guided: !!cur.guided, independent: !!rec?.independent, recheck: cur.recheck });
  if (!tut.on && !runClosed() && (!result.correct || cur.hint > 0 || cur.guided || rec?.assisted === true)) {
    cur.followup = immediateCheck({ venue: v, queue: state.queue, index: state.index, item, coach, assignment: assignment(), seenIds: [...assignmentSeen] });
    state.queue = cur.followup.queue;
    if (cur.followup.item) state.checkNotice = { id: cur.followup.item.id, line: cur.followup.line,
      status: cur.followup.status, sourceAttemptId: rec?.eventId || null };
  }
  state.combo = result.correct ? state.combo + 1 : 0;
  setDock('done'); $('#stamps').hidden = false; $('#choose').hidden = true;
  for (const b of ['#btn-pass', '#btn-reject', '#btn-hint']) $(b).disabled = true;
  $('#notice').classList.remove('choosing'); for (const r of ruleButtons()) r.disabled = true;
  markCushions(item, choice);
  // 도장
  const kind = choice === 'pass' ? 'pass' : 'reject';
  stampDoc(kind, v);
  sound.stamp();
  const react = $('#react'); react.src = kind === 'pass' ? 'assets/felt/heart.webp' : 'assets/felt/drop.webp'; react.hidden = false;
  await wait(380);
  if (!live(token)) { state.busy = false; return; }
  updateHud();
  if (result.correct) { $('#g-combo-wrap').classList.remove('punch'); void $('#g-combo-wrap').offsetWidth; $('#g-combo-wrap').classList.add('punch'); }
  sound.play(result.correct ? 'earn' : sound.pick('calm1', 'calm2'));
  if (result.correct && state.combo > 0 && state.combo % 3 === 0) setTimeout(() => sound.play(sound.pick('joy1', 'joy2'), .9), 260);
  for (const id of item.evidence) circleRule(id);
  const wrongPassOrReject = showFeedback(item, choice, result);
  state.busy = false;
  // 손님의 대답(맞으면 고마운 말, 틀리면 '고마워요!/네? 왜요?'), 틀린 통과·거절이면 그 뒤에 생긴 일을 안내 목소리가 이어 읽는다
  const voices = item.textOnly ? [] : [result.correct ? VOICE_ID.reply(item.id) : choice === 'pass' ? VOICE_ID.thanks(item.who) : VOICE_ID.why(item.who)];
  if (wrongPassOrReject && !item.textOnly) voices.push(VOICE_ID.oops(item.id));
  if (tut.on) { tutAdvance({ show: false }); voices.push(VOICE_ID.tutorial(tutStep()?.id)); showCoach({ silent: true }); }
  sound.sayAll(voices.filter(Boolean));
}

function stampDoc(kind, v) {
  const color = kind === 'pass' ? '#3f6b2e' : '#ae322a', word = kind === 'pass' ? '통과' : '거절';
  const [mo, day] = (v.date.match(/\d+/g) || ['', '']);
  const mark = $('#stamp-mark');
  mark.innerHTML = `<svg viewBox="0 0 116 66" aria-hidden="true"><g filter="url(#ink)" transform="rotate(-5 58 33)">
    <rect x="3" y="3" width="110" height="60" rx="11" fill="none" stroke="${color}" stroke-width="3.4"/>
    <rect x="9.5" y="9.5" width="97" height="47" rx="7" fill="none" stroke="${color}" stroke-width="1.3"/>
    <text x="58" y="39" text-anchor="middle" font-family="SUIT" font-weight="900" font-size="25" fill="${color}" letter-spacing="3">${word}</text>
    <text x="58" y="52" text-anchor="middle" font-family="DM Mono" font-size="7.4" fill="${color}" letter-spacing="1.2">${mo}.${day} · SYNK</text></g></svg>`;
  mark.classList.remove('hit'); void mark.offsetWidth; mark.classList.add('hit');
}

function circleRule(id) {
  const btn = ruleButtons().find((r) => r.dataset.rule === id); if (!btn) return;
  const w = btn.offsetWidth + 8, h = btn.offsetHeight + 12;
  const cx = w / 2, cy = h / 2, rx = w / 2 - 3, ry = h / 2 - 3, k = .5523;
  const d = `M ${cx - rx + 2} ${cy + 3} C ${cx - rx} ${cy - ry * k - 2}, ${cx - rx * k} ${cy - ry}, ${cx} ${cy - ry + 1} C ${cx + rx * k} ${cy - ry - 1}, ${cx + rx + 2} ${cy - ry * k}, ${cx + rx} ${cy + 1} C ${cx + rx - 1} ${cy + ry * k}, ${cx + rx * k} ${cy + ry + 1}, ${cx} ${cy + ry} C ${cx - rx * k} ${cy + ry - 1}, ${cx - rx - 2} ${cy + ry * k}, ${cx - rx + 6} ${cy - 4}`;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'circle'); svg.setAttribute('viewBox', `0 0 ${w} ${h}`); svg.setAttribute('width', w); svg.setAttribute('height', h); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', d);
  svg.append(p); btn.append(svg);
  try { p.style.setProperty('--len', String(Math.ceil(p.getTotalLength()))); } catch { p.style.setProperty('--len', '0'); }
}

function clearMarks() {
  document.querySelectorAll('#notice .rule .circle').forEach((n) => n.remove());
  document.querySelectorAll('.hint').forEach((n) => n.classList.remove('hint'));
  $('#clock-wrap').classList.remove('flag');
  clearCushions();
}

function ruleNo(id) { const i = activeRules(state.venue, state.cur.item.at).findIndex((r) => r.id === id); return i + 1; }
const NO = ['', '①', '②', '③', '④', '⑤'];

function showFeedback(item, choice, result) {
  const who = CAST[item.who], fb = $('#feedback');
  fb.classList.toggle('miss', !result.correct);
  $('#fb-badge').src = result.correct ? 'kit/felt/badge-check.webp' : 'assets/felt/drop.webp';
  $('#fb-kicker').textContent = result.correct ? 'CORRECT' : `정답 · ${item.answer === 'pass' ? '통과' : `거절 ${NO[ruleNo(item.answer)] || ''}`}`;
  $('#fb-title').textContent = result.correct ? (state.combo >= 3 ? `정확해요! ${state.combo}연속` : '정확해요!')
    : choice === 'pass' ? '아차, 들어가면 안 됐어요' : item.answer === 'pass' ? '아차, 들어가도 됐어요' : '거절은 맞지만 이유가 달라요';
  $('#fb-mongle').src = result.correct ? 'kit/brand/mongle-smile.webp' : 'kit/brand/mongle-curious.webp';
  $('#fb-face').src = who.img; $('#fb-face').alt = who.name;
  $('#fb-reply').textContent = result.correct ? item.reply : choice === 'pass' ? `${who.name}: “고마워요!”` : `${who.name}: “네? 왜요?”`;
  $('#fb-why').textContent = item.why;
  const correction = choiceCorrection(state.venue, item, choice);
  $('#fb-correction').hidden = !correction; $('#fb-correction').textContent = correction;
  $('#fb-recheck').hidden = !state.cur.recheck?.line; $('#fb-recheck').textContent = state.cur.recheck?.line || '';
  const followup = state.cur.followup;
  $('#fb-followup').hidden = !followup; $('#fb-followup').textContent = followup ? `${followup.line}${followup.item?.textOnly ? ' 다음 손님은 목소리 없이 글로만 나와요.' : ''}` : '';
  const wrongPassOrReject = !result.correct && (choice === 'pass' || item.answer === 'pass');
  $('#fb-oops').hidden = !wrongPassOrReject; $('#fb-oops-text').textContent = item.oops;
  $('#btn-next').querySelector('span').textContent = state.index + 1 >= state.queue.length ? '근무 마치기'
    : followup?.status === 'new' ? '새 손님으로 확인' : followup?.status === 'review' ? '복습 손님으로 확인' : '다음 손님';
  $('#fb-kicker').classList.toggle('ko', !result.correct);
  fb.hidden = false;
  announce(`${$('#fb-title').textContent}. ${correction} ${$('#fb-reply').textContent} 왜? ${item.why}${wrongPassOrReject ? ` 그 뒤에 생긴 일: ${item.oops}` : ''} ${state.cur.recheck?.line || ''} ${followup?.line || ''}`);
  $('#fb-reply').closest('.fb-reply').classList.remove('speaking');
  $('#btn-next').focus({ preventScroll: true });
  // 휴대폰: 아래 판이 동그라미 친 규칙을 가리지 않게 그만큼 내려 볼 자리를 만들고 규칙을 판 위로 올린다
  if (isNarrow()) {
    const room = fb.offsetHeight;
    document.documentElement.style.setProperty('--fb-room', `${room}px`);
    const target = ruleButtons().find((r) => item.evidence.includes(r.dataset.rule));
    if (target) requestAnimationFrame(() => {
      const r = target.getBoundingClientRect(), visible = window.innerHeight - room - 16;
      if (r.bottom > visible) window.scrollBy({ top: r.bottom - visible + 8, behavior: reduced() ? 'auto' : 'smooth' });
    });
  }
  return wrongPassOrReject;
}

async function next() {
  if (!state.cur?.done || state.busy) return;
  if (tut.on && tutStep()?.wait !== 'next') return;
  if (tut.on) tutAdvance({ show: false });
  hideCoach(); sound.stopVoice();
  state.busy = true;
  $('#feedback').hidden = true;
  document.documentElement.style.removeProperty('--fb-room');
  window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
  const g = $('#guest'), choice = state.results.at(-1)?.choice, token = state.shift;
  $('#bubble').classList.add('quiet');
  g.classList.add(choice === 'pass' ? 'leave-in' : 'leave-out');
  await wait(380);
  if (!live(token)) { state.busy = false; return; }
  state.index += 1; state.busy = false;
  nextGuest();
}

/* ── 근무 끝 ── */
function finishShift() {
  const v = state.venue, score = scoreShift(state.results);
  // 정답 비율로 받는다. WORLD 과제 근무도 끝까지 마치면 받는다.
  const coinRound = state.coinRound; state.coinRound = null; $('#r-coins').textContent = '';
  if (coinRound) globalThis.SynkPlayCollection?.award({ game: 'entry-check', total: score.total, correct: score.correct, completed: true, automatic: false, roundId: coinRound })
    .then((result) => { $('#r-coins').textContent = globalThis.SynkPlayCollection.rewardText(result); });
  // 순간 맞춤: 근무를 마치며 저장한다. 돋보기를 늦추는 것은 엔진이 때가 됐다고 볼 때 물어보고, 받아들일 때만 한다.
  clearTimeout(state.magnifierTimer);
  const flow = state.flow; state.flow = null;
  const offer = flow ? atlas(() => flow.offerLessHelp(), { offer: false }) : { offer: false };
  if (flow) atlas(() => flow.end());
  const before = unlockedIds();
  if(!state.targeted){
    progress.stars[v.id] = Math.max(progress.stars[v.id] || 0, score.stars);
    progress.plays += 1; progress.tutorial = true;
  }
  const today = new Date().toLocaleDateString('sv'); // 이 기기의 날짜(YYYY-MM-DD)로 하루 한 번
  const celebrate = progress.doneDay !== today; progress.doneDay = today;
  saveProgress();
  const opened = unlockedIds().filter((id) => !before.includes(id)).map((id) => venueById(id).name);
  tut.on = false; hideCoach();
  sound.stopVoice(); sound.play('achieve'); if (celebrate) setTimeout(() => sound.play('done'), 380);
  setTimeout(() => { if (!$('#results').hidden) sound.say(VOICE_ID.result(score.stars)); }, 900);

  $('#r-venue').textContent = `${v.name} · ${v.day}일차`;
  $('#r-title').textContent = ['오늘은 연습한 날!', '근무 끝!', '좋은 근무!', '완벽한 근무!'][score.stars];
  $('#r-correct').textContent = String(score.correct); $('#r-total').textContent = String(score.total);
  $('#r-stars').innerHTML = [1, 2, 3].map((i) => `<i class="${i <= score.stars ? 'on' : ''}"></i>`).join('');
  $('#r-stars').setAttribute('aria-label', `별 3개 중 ${score.stars}개`);
  $('#r-mongle').src = score.stars >= 2 ? 'kit/brand/mongle-smile.webp' : 'kit/brand/mongle-cheer.webp';
  const notes = [`처음 찍은 도장으로 ${score.correct}명을 바르게 맞이했어요.`];
  if (score.helped) notes.push(`돋보기를 쓴 손님은 ${score.helped}명이에요.`);
  if (score.bestRun >= 3) notes.push(`최고 ${score.bestRun}연속!`);
  if (opened.length) notes.push(`새 근무지 ‘${opened.join('’, ‘')}’${josa(opened.at(-1), '이', '가')} 열렸어요.`);
  $('#r-note').textContent = notes.join(' ');
  const help = $('#r-help'); help.hidden = !offer?.offer;
  $('#r-help-yes').onclick = () => {
    const change = flow && atlas(() => flow.acceptLessHelp()); help.hidden = true;
    if (change?.line) { $('#r-note').textContent += ` ${change.line.text}`; announce(change.line.text); }
  };
  $('#r-help-no').onclick = () => { if (flow) atlas(() => flow.declineLessHelp()); help.hidden = true; };

  const log = $('#r-log'); log.textContent = '';
  for (const r of state.results) {
    const c = v.cases.find((x) => x.id === r.caseId), who = CAST[r.who];
    const answer = r.expected === 'pass' ? '통과' : `거절 · ${ruleText(v, c, r.expected)}`;
    const li = el('li');
    li.innerHTML = `<img class="face" src="${who.img}" alt=""><span><b>${esc(who.name)} <small style="display:inline">${esc(koreanTime(c.at))}</small></b>
      <small>정답 ${esc(answer)}${r.correct ? '' : ` · 내 도장 ${r.choice === 'pass' ? '통과' : `거절 · ${esc(ruleText(v, c, r.choice))}`}`}${r.guided ? ' · 연수' : r.hinted ? ' · 돋보기' : ''}</small>${r.recheck?.line ? `<small>${esc(r.recheck.line)}</small>` : ''}</span>
      <img class="mark" src="${r.correct ? 'kit/felt/badge-check.webp' : 'assets/felt/drop.webp'}" alt="${r.correct ? '맞음' : '다시 볼 것'}">`;
    log.append(li);
  }
  const next = renderNext(v);
  renderSkills(score, next?.skillId);
  $('#r-hub').hidden = hosted || !location.pathname.includes('/entry-check/');
  show('results');
}

/** 결과 기록용 규칙 이름: 번호 + 짧은 이름(예: ② 의자). 첫 문장만 자르면 '돗자리는 가지고 와도 됩니다'처럼 반대 뜻이 나왔다. */
function ruleText(v, c, id) {
  const rules = activeRules(v, c.at), i = rules.findIndex((x) => x.id === id);
  return i < 0 ? id : `${NO[i + 1]} ${rules[i].short || rules[i].text}`;
}

function renderSkills(score, focusId) {
  const ul = $('#r-skills'); ul.textContent = '';
  const report = atlas((c) => skillReport(c.summary()), []);
  const rows = report.length ? report : Object.keys(SKILL_LABEL).map((id) => ({ id, label: SKILL_LABEL[id], text: '기록을 쓸 수 없어요', tone: 'quiet' }));
  for (const s of rows) {
    const shift = score.bySkill[s.id];
    const focus = s.id === focusId || s.tone === 'focus';
    const li = el('li', focus ? 'focus' : s.tone === 'good' ? 'good' : '');
    li.innerHTML = `<b>${esc(s.label)}${s.id === focusId ? ' <i class="next-tag">다음 연습</i>' : ''}</b><em>${shift ? `이번 ${shift.correct}/${shift.total}` : '이번 0'}</em><span>${esc(s.text)}${s.n ? ` · 처음 만난 손님 ${s.n}명 중 ${s.correct}명은 혼자 맞힘` : ''}</span>`;
    ul.append(li);
  }
}

function renderNext(v) {
  const ids = unlockedIds();
  const rec = atlas((c) => recommendVenue(c, ids));
  const goal=assignment();
  const target = assignmentVenues(goal,[...assignmentSeen])[0] || venueById(rec?.venueId) || VENUES.find((x) => ids.includes(x.id) && (progress.stars[x.id] || 0) < 3) || v;
  $('#r-next-name').textContent = `${target.day}일차 · ${target.name}`;
  $('#r-next-reason').textContent = goal ? entryTargetLabel(goal) : rec?.reason ? `${rec.reason}` : target.id === v.id ? '같은 근무지에서 새 손님을 만나요.' : '다음 근무지에서 새 안내문을 읽어요.';
  $('#r-next').onclick = () => startShift(target.id);
  $('#r-again').onclick = () => startShift(v.id);
  const closed = runClosed();
  if (closed) $('#r-next-reason').textContent = '이 WORLD 과제는 끝났어요. 이어서 하려면 WORLD에서 다시 열어 주세요.';
  $('#r-next').disabled = $('#r-again').disabled = closed;
  return rec;
}

/* ── 이벤트 ── */
$('#btn-pass').onclick = (e) => decide('pass', e);
$('#btn-reject').onclick = (e) => startChoosing(e);
$('#btn-cancel').onclick = () => { if (!tut.on) cancelChoosing(); };
$('#btn-hint').onclick = (e) => useHint(e);
$('#btn-next').onclick = next;
$('#r-home').onclick = renderLobby;
// 쉬는 동안은 도장까지 걸린 시간에 넣지 않는다(쉬기 단추·Esc 어느 쪽으로 열고 닫아도).
let pausedAt = 0;
const openPause = () => { if ($('#pause-dialog').open) return; pausedAt = performance.now(); $('#pause-dialog').showModal(); };
$('#pause-dialog').addEventListener('close', () => { if (pausedAt && state.cur) state.cur.pausedMs += performance.now() - pausedAt; pausedAt = 0; });
$('#pause').onclick = openPause;
$('#resume').onclick = () => $('#pause-dialog').close();
function leaveShift() {
  if (state.cur && !state.cur.done) atlas((c) => c.answer(state.cur.pid, { correct: null, assessable: false, reason: 'unanswered' }));
  // 이 근무를 끝낸다: 기다리던 움직임·알림이 돌아와도 이어 가지 않는다
  clearTimeout(state.magnifierTimer); if (state.flow) { atlas(() => state.flow.end()); state.flow = null; }
  state.shift += 1; state.busy = false; state.cur = null; setOverlay(false);
  $('#briefing').hidden = true; $('#memo-alert').hidden = true; $('#feedback').hidden = true;
  document.documentElement.style.removeProperty('--fb-room');
  tut.on = false; hideCoach(); sound.stopVoice();
}
$('#quit').onclick = () => { $('#pause-dialog').close(); leaveShift(); renderLobby(); };
$('#replay-tutorial').onclick = () => { $('#pause-dialog').close(); leaveShift(); startShift('pool', { tutorial: true }); };
$('#how-tutorial').onclick = () => startShift('pool', { tutorial: true });
$('#voice-toggle').onclick = () => { sound.setVoiceOn(!sound.isVoiceOn()); syncSound(); };
$('#motion-toggle').onclick = () => {
  progress.motion = progress.motion === false; saveProgress(); applyMotion();
  if (state.venue && !$('#game').hidden) setScene(state.venue);
};
$('#reset-learning').onclick = () => {
  if (!coach || hosted) return;
  if (!window.confirm('같은 주소에서 연 모든 SYNK 게임의 학습 기록을 지울까요? 근무지 별은 그대로 남아요.')) return;
  atlas((c) => c.reset()); renderLobby();
};
for (const t of document.querySelectorAll('[data-sound-toggle]')) {
  t.onclick = () => { sound.setOn(!sound.isOn()); syncSound(); if (sound.isOn()) { sound.unlock(); sound.play('tap', .7); } };
}
function syncSound() {
  for (const t of document.querySelectorAll('[data-sound-toggle]')) {
    t.setAttribute('aria-pressed', String(sound.isOn()));
    if (t.hasAttribute('data-sound-label')) t.textContent = sound.isOn() ? '소리 켜짐' : '소리 꺼짐';
  }
  const v = $('#voice-toggle'); v.setAttribute('aria-pressed', String(sound.isVoiceOn())); v.textContent = sound.isVoiceOn() ? '목소리 켜짐' : '목소리 꺼짐';
}
document.addEventListener('keydown', (e) => {
  if ($('#game').hidden || $('#pause-dialog').open || e.altKey || e.ctrlKey || e.metaKey) return;
  // 초점이 단추·링크에 있으면 Enter·Space는 그 단추의 기본 동작에 맡긴다(연수 건너뛰기·다시 듣기·멈춤 등)
  if ((e.key === 'Enter' || e.key === ' ') && e.target instanceof Element && e.target.closest('button, a[href], input, textarea, select, [role="button"]')) return;
  // 연수 안내가 떠 있고 '다음'으로 넘기는 단계면 Enter가 '다음'이다
  if (tut.on && !$('#coach').hidden && !tutStep()?.wait) { if (e.key === 'Enter') { e.preventDefault(); $('#coach-next').click(); } return; }
  if (!$('#briefing').hidden) { if (e.key === 'Enter') { e.preventDefault(); $('#btn-begin').click(); } return; }
  if (!$('#memo-alert').hidden) { if (e.key === 'Enter') { e.preventDefault(); $('#btn-alert').click(); } return; }
  const cur = state.cur;
  if (!$('#feedback').hidden) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); next(); } return; }
  if (!cur || cur.done) return;
  if (cur.choosing) {
    const n = Number(/^(?:Digit|Numpad)(\d)$/.exec(e.code)?.[1] ?? e.key);   // 한글 입력 상태에서도
    if (n >= 1 && n <= ruleButtons().length) { e.preventDefault(); chooseRule(ruleButtons()[n - 1].dataset.rule, e); }
    else if (e.key === 'Escape') { e.preventDefault(); if (!tut.on) cancelChoosing(); }
    return;
  }
  if (e.key === 'ArrowRight') { e.preventDefault(); decide('pass', e); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); startChoosing(e); }
  else if (e.code === 'KeyH' || e.key.toLowerCase() === 'h') { e.preventDefault(); useHint(e); }
  else if (e.key === 'Escape') { e.preventDefault(); openPause(); }
});
let cushionTimer = 0;
window.addEventListener('resize', () => {
  if (!state.venue || $('#game').hidden) return;
  if (isNarrow() !== narrowNow) { narrowNow = isNarrow(); setScene(state.venue); }
  placeCoach();
  clearTimeout(cushionTimer); cushionTimer = setTimeout(fitCushions, 120);
});
document.fonts?.ready.then(() => { if (!$('#game').hidden) fitCushions(); });
$('#scene-video').addEventListener('playing', (e) => e.target.classList.add('on'));
document.addEventListener('visibilitychange', () => {
  const vid = $('#scene-video');
  if (document.hidden) { vid.pause(); sound.stopVoice(); return; }
  sound.unlock();
  if (!$('#game').hidden && vid.getAttribute('src')) vid.play().catch(() => {});
});
document.addEventListener('scroll', () => { if (tut.on && !$('#coach').hidden) requestAnimationFrame(placeCoach); }, { capture: true, passive: true });

/* ── 첫 근무 연수: 비출 곳만 열고, 그 단계가 시키는 조작만 받는다 ── */
const tut = { on: false, i: 0, timer: 0 };
function tutStep() { return tut.on ? TUTORIAL[tut.i] || null : null; }
function tutAdvance({ show = true } = {}) {
  if (!tut.on) return;
  tut.i += 1;
  const s = tutStep();
  if (!s) { endTutorial(); return; }
  if (show && s.guest === state.index && !s.wait?.startsWith('next')) showCoach(); else if (show) hideCoach();
}
function endTutorial() {
  tut.on = false; hideCoach(); sound.stopVoice();
  progress.tutorial = true; saveProgress();
  if (state.cur && !state.cur.done) setDock(state.cur.choosing ? 'choosing' : 'ready');
  $('#btn-cancel').hidden = false;
}
function showCoach({ withLine = false, silent = false } = {}) {
  const s = tutStep(); if (!s) { hideCoach(); return; }
  const coach = $('#coach');
  coach.hidden = false; coach.classList.toggle('lock', !s.wait);
  $('#coach-step').textContent = String(tut.i + 1); $('#coach-total').textContent = String(TUTORIAL.length);
  $('#coach-text').textContent = s.text;
  $('#coach-next').hidden = !!s.wait;
  $('#coach-next').querySelector('span').textContent = s.target ? '다음' : '혼자 시작';
  if (s.reveals && state.cur && !state.cur.done && s.guest === state.index) state.cur.guided = true;
  const t = s.target && document.querySelector(s.target);
  // 휴대폰에서 아래 도장 줄·피드백은 화면에 붙어 있어 스크롤할 필요가 없다(스크롤하면 창문 위가 가려졌다)
  if (t && isNarrow() && !t.closest('.dock, .feedback')) t.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' });
  placeCoach(); clearTimeout(tut.timer); tut.timer = setTimeout(placeCoach, 450);
  const nar = VOICE_ID.tutorial(s.id);
  if (withLine && state.cur) sound.sayAll([VOICE_ID.line(state.cur.item.id), nar]); else if (!silent) sound.say(nar);
  if (s.wait) { if (s.wait !== 'next') t?.focus?.({ preventScroll: true }); } else $('#coach-next').focus({ preventScroll: true });
}
function hideCoach() { const c = $('#coach'); if (c) c.hidden = true; }
function placeCoach() {
  const s = tutStep(), coach = $('#coach');
  if (!s || coach.hidden) return;
  const card = $('#coach-card'), hole = $('#coach-hole');
  const vw = document.documentElement.clientWidth, vh = window.innerHeight;
  const t = s.target && document.querySelector(s.target);
  let x = vw / 2, y = vh / 2, w = 0, h = 0;
  if (t) {
    // 비출 곳 = 대상과 그 밖으로 나온 몽글(피드백)을 함께 감싼 사각형
    const rects = [t, ...t.querySelectorAll('.fb-mongle')].map((n) => n.getBoundingClientRect()).filter((q) => q.width && q.height);
    const r = { left: Math.min(...rects.map((q) => q.left)), top: Math.min(...rects.map((q) => q.top)),
      right: Math.max(...rects.map((q) => q.right)), bottom: Math.max(...rects.map((q) => q.bottom)) };
    const pad = 8;
    x = Math.max(4, r.left - pad); y = Math.max(4, r.top - pad);
    w = Math.min(vw - 4, r.right + pad) - x; h = Math.min(vh - 4, r.bottom + pad) - y;
  }
  coach.classList.toggle('no-target', !t);
  Object.assign(hole.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
  const [top, bottom, left, right] = coach.querySelectorAll('.coach-block');
  Object.assign(top.style, { left: '0px', top: '0px', width: `${vw}px`, height: `${y}px` });
  Object.assign(bottom.style, { left: '0px', top: `${y + h}px`, width: `${vw}px`, height: `${Math.max(0, vh - y - h)}px` });
  Object.assign(left.style, { left: '0px', top: `${y}px`, width: `${x}px`, height: `${h}px` });
  Object.assign(right.style, { left: `${x + w}px`, top: `${y}px`, width: `${Math.max(0, vw - x - w)}px`, height: `${h}px` });
  card.classList.toggle('center', !t);
  if (!t) { card.style.left = ''; card.style.top = ''; return; }
  const cw = card.offsetWidth, ch = card.offsetHeight, gap = 14, m = 10;
  const clampX = (v) => Math.max(m, Math.min(vw - cw - m, v));
  const clampY = (v) => Math.max(m, Math.min(vh - ch - m, v));
  let L, T;
  if (y + h + gap + ch <= vh - m) { L = clampX(x + w / 2 - cw / 2); T = y + h + gap; }
  else if (y - gap - ch >= m) { L = clampX(x + w / 2 - cw / 2); T = y - gap - ch; }
  else if (x + w + gap + cw <= vw - m) { L = x + w + gap; T = clampY(y + h / 2 - ch / 2); }
  else if (x - gap - cw >= m) { L = x - gap - cw; T = clampY(y + h / 2 - ch / 2); }
  else { L = clampX(x + w / 2 - cw / 2); T = s.wait ? m : clampY(y + h - ch - gap); }
  card.style.left = `${L}px`; card.style.top = `${T}px`;
}
$('#coach-next').onclick = () => { sound.unlock(); sound.play('tap', .6); tutAdvance(); };
$('#coach-skip').onclick = () => { endTutorial(); };
$('#coach-replay').onclick = () => { const s = tutStep(); if (s) sound.say(VOICE_ID.tutorial(s.id)); };
const QA = new URLSearchParams(location.search).has('qa');
const qaVoice = [], qaVoiceAt = [];   // 확인용(?qa)일 때만 쌓는다
sound.onSpeaking((id) => {
  if (id && QA) { qaVoice.push(id); qaVoiceAt.push([id, Date.now()]); }
  $('#talk').hidden = !(id && id.startsWith('line-'));
  $('#coach-replay').classList.toggle('speaking', !!id && id.startsWith('nar-tut'));
  $('#fb-reply').closest('.fb-reply').classList.toggle('speaking', !!id && /^(reply|thanks|why)-/.test(id));
});

sound.loadCatalog();
applyMotion();
syncSound();
renderLobby();
// 시험·확인용 읽기 전용 관찰(상태를 바꾸지 않는다)
if (QA) {
  window.__entry = { state: () => ({ venue: state.venue?.id, index: state.index, queue: state.queue.map((c) => c.id), results: state.results.map((r) => ({ ...r })), cur: state.cur && { id: state.cur.item.id, answer: state.cur.item.answer, hint: state.cur.hint, choosing: state.cur.choosing, done: state.cur.done } }),
    progress: () => JSON.parse(JSON.stringify(progress)), summary: () => atlas((c) => c.summary()),
    voices: () => [...qaVoice], voiceTimes: () => qaVoiceAt.map((x) => [...x]), tutorial: () => ({ on: tut.on, step: tutStep()?.id || null }) };
}
