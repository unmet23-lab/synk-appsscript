import './core/ask.js';
import { SCENARIOS, PRACTICES, defaultPractice, practiceDetails, REVIEWS, MAX_SESSIONS, MAX_IMPORT_BYTES, createSession, getTurn, followupQuestion, appendTurn, retryTurn, stuckTurn, archive, firstSentenceFrom, setPlan, setRealDate, recordOutcome, pendingFollowups, continueFrom, keepSessions } from './domain.mjs';
import { ELEMENTS, analyzeAnswer, speakingStats, counterLine, nextTip } from './coach.mjs';
import { loadSaved, saveSessions, removeSaved, createImportController } from './storage.mjs';
import { bookContent, createBook, BOOK_FILENAME, BOOK_MIME } from './book.mjs';
import { createVoice, voiceSupport, clock } from './voice.mjs';
import { createAccountNotebook } from '/synk-account/src/account-notebook.mjs';
import { initTheme, cycleTheme, THEME_LABEL, esc, keepDots, poster, secHead, icon, createToast, createSheet, seoulDate, dayLabel } from '/member-signal/signal.mjs';

// 리허설 화면(2026-10-14 시그널 판). 계정 수첩·기기 저장·가져오기의 보호 규칙은 이전 판과 같다.
const Ask = globalThis.SynkAsk;
const app = document.querySelector('#app');
const storage = { getItem: key => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value), removeItem: key => window.localStorage.removeItem(key) };
const toast = createToast(document.querySelector('#notice'));
const loaded = loadSaved(storage);
const imports = createImportController();
const support = voiceSupport();
const INTENSITY = Object.freeze({ gentle: '부드럽게', normal: '보통', tough: '까다롭게' });
const TURN_WORD = Object.freeze({ opening: '첫 마디', specific: '구체적', concise: '짧게', pressure: '버티기', close: '마무리' });
const OUTCOME = Object.freeze({ did: { yes: '했어요', later: '아직이에요', no: '하지 않기로 했어요' }, reaction: { good: '생각보다 좋았어요', mixed: '반반이었어요', hard: '어려웠어요' } });

let saving = loaded.enabled, sessions = loaded.sessions, scenario = 'interview', current = null, page = 'home';
let selectedPractice = defaultPractice(scenario), intensity = 'normal', inputMode = support.recognition || support.recorder ? 'voice' : 'text';
let stage = 'answer', feedback = null, retryIndex = 0, imported = null, deletePending = false, followupId = null, followupDone = false;
let bookReturn = 'home', homeDraft = null, notebook, guestSaving = saving, voiceMs = 0, usedVoice = false;

initTheme();
const sheet = createSheet(document.querySelector('#account-sheet'));
const voice = createVoice({
  onText: text => { const field = document.querySelector('#answer-text'); if (field) field.value = text.slice(0, 2000); },
  onTick: ms => { const timer = document.querySelector('[data-timer]'); if (timer) timer.textContent = clock(voiceMs + ms); },
  onState: state => paintMic(state),
  onIssue: message => { const line = document.querySelector('[data-mic-issue]'); if (line) line.textContent = message; else toast(message); },
});

const turnTitle = (session, index) => getTurn(session, index).title;
const details = () => practiceDetails({ scenario, practice: selectedPractice });
const elementList = id => ELEMENTS[id] || [];
function save() { if (notebook?.active) { void notebook.change(archive(sessions)); return { ok: true }; } if (saving) { const result = saveSessions(storage, sessions); if (!result.ok) toast(result.error); return result; } return { ok: true }; }
function remember() { sessions = keepSessions([current, ...sessions.filter(entry => entry.id !== current.id)]); return save(); }
function error(text) { const target = document.querySelector('#error'); if (target) { target.textContent = text; target.focus(); } else toast(text); }
function statusSave() { return notebook?.active ? '완료한 연습은 SYNK 계정에 저장해요.' : saving ? '완료한 연습을 이 기기에 저장하고 있어요.' : '지금은 이 창에만 남아요. 새로고침하면 사라져요.'; }
const reviewChips = (selected = null) => `<fieldset class="review"><legend>말해 보니 어땠나요? <span class="opt-note">내가 직접 고르는 느낌</span></legend><div class="chips">${Object.entries(REVIEWS).map(([id, label]) => `<label class="chip"><input class="sr" type="radio" name="review" value="${id}" ${selected === id ? 'checked' : ''} required>${label}</label>`).join('')}</div></fieldset>`;
const radioChips = (name, entries, selected = null, required = true) => `<div class="chips">${entries.map(([id, label]) => `<label class="chip"><input class="sr" type="radio" name="${name}" value="${id}" ${selected === id ? 'checked' : ''} ${required ? 'required' : ''}>${esc(label)}</label>`).join('')}</div>`;

// 지난 기록에서 내 첫 말하기 빠르기(기준은 영어 WPM이 아니라 나)
function baselinePace() {
  const timed = sessions.flatMap(s => s.turns.map(t => ({ at: s.at, text: t.answer, seconds: t.seconds, mode: t.mode }))).filter(t => t.mode === 'voice' && t.seconds > 4).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  return timed.length ? speakingStats({ text: timed[0].text, durationMs: timed[0].seconds * 1000 }).syllablesPerMinute : null;
}
function dueFollowups(today = seoulDate()) { return pendingFollowups(sessions, today); } // 대화 다음 날부터 묻는다
// 이어서 할 곳: 실제 대화가 어려웠던 기록 → 직접 고른 막힘·망설임 → 다시 쓰지 않은 답의 빠진 뼈대(domain.continueFrom)
const RESUME_REASON = Object.freeze({ outcome: '실제 대화에서 어려웠다고 남긴', stuck: '직접 ‘말이 막혔어요’를 골랐던', unsure: '직접 ‘조금 망설였어요’를 골랐던', missing: '뼈대가 하나 빠졌던' });
function stuckFor(id) { const next = continueFrom(sessions, id, { analyze: analyzeAnswer }); const session = next && sessions.find(s => s.id === next.sessionId); return session ? { session, index: next.index, reason: RESUME_REASON[next.reason] || '다시 해 보면 좋은' } : null; }
// 지금까지 한 답(앞 차례들 + 이번 답)에서 찾은 뼈대. 오른쪽 「이 대화의 뼈대」는 대화 전체로 센다.
function cumulativeFound(session, upto, extra = null) {
  const ids = new Set();
  for (const turn of session.turns.slice(0, upto)) for (const item of analyzeAnswer({ scenario: session.scenario, text: turn.retry || turn.answer, turnId: turn.id }).found) ids.add(item.id);
  for (const item of extra?.found || []) ids.add(item.id);
  return ids;
}
function counterFor(session, index) {
  // 상대의 되묻기는 앞 차례까지 아직 한 번도 나오지 않은 뼈대를 짚는다(같은 입력이면 늘 같은 대사).
  if (index <= 0) return '';
  const said = cumulativeFound(session, index), missingIds = elementList(session.scenario).filter(item => !item.optional && !said.has(item.id)).map(item => item.id);
  if (!missingIds.length) return '';
  const turn = getTurn(session, index);
  return counterLine({ scenario: session.scenario, practice: session.practice, missingIds, intensity: session.intensity || 'normal', turnId: turn.id, seed: session.id }) || '';
}

// ── 화면 ─────────────────────────────────────────────
function home() {
  const s = details(), due = dueFollowups(), stuck = stuckFor(scenario), count = sessions.length;
  return `<section class="intro">
    <div class="copy"><p class="kicker">SYNK FOR YOU · REHEARSAL</p><h1 tabindex="-1">중요한 말,<br><span class="hl">한 번 먼저.</span></h1>
    <p class="lead">면접·부탁·거절처럼 꺼내기 어려운 말을 소리 내어 연습해요. 들어간 것과 빠진 것을 바로 보고, 막힌 곳만 다시 해요.</p>
    <ul class="meta"><li><small>01</small>상황 고르기</li><li><small>02</small>말로 세 번</li><li><small>03</small>바로 확인</li><li><small>04</small>가져갈 한 장</li></ul>
    <div class="actions"><a class="btn soft" href="#setup">연습 고르기 ${icon('arrow')}</a>${count ? `<button class="linkbtn" type="button" data-nav="records">지난 연습 ${count}회</button>` : ''}</div></div>
    <div class="art">${poster({ word: '리허설', label: '01 / REHEARSAL', chip: count ? `완료 ${count}회` : '무료', extra: '<img class="print" src="./assets/podium.webp" alt="말할 내용을 붙인 펠트 보드와 연단" width="760" height="760">' })}</div>
  </section>
  ${due.length ? `<section class="sec due"><div class="notice-box check"><span class="lbl">실제 대화 뒤</span><strong>${esc(SCENARIOS[due[0].scenario].short)} · ${esc(due[0].counterpart)}, 어떻게 됐나요?</strong><p>${dayLabel(due[0].realAt)}로 잡아 둔 대화예요. 했는지, 첫 문장을 썼는지만 남겨도 다음 연습이 거기서 시작해요.</p><div class="actions"><button class="btn small soft" type="button" data-action="followup" data-id="${esc(due[0].id)}">돌아보기 남기기</button>${due.length > 1 ? `<span class="muted small">돌아볼 대화 ${due.length}개</span>` : ''}</div></div></section>` : ''}
  <form id="setup" class="setup">
    <section class="sec">${secHead(1, '어떤 대화가 기다리고 있나요?')}
      <div class="opts scenarios" role="group" aria-label="연습할 상황">${Object.entries(SCENARIOS).map(([id, value], i) => `<button class="opt" type="button" data-scenario="${id}" aria-pressed="${scenario === id}"><span><strong>${esc(value.name)}</strong><small>${esc(value.note)}</small></span></button>`).join('')}</div>
      ${stuck ? `<div class="resume card"><div class="card-top"><span class="eyebrow">지난번 막힌 곳부터</span><span class="muted small">${dayLabel(stuck.session.at.slice(0, 10))}</span></div><h3>${esc(turnTitle(stuck.session, stuck.index))}</h3><p>${esc(stuck.session.counterpart)} · ${stuck.reason} 부분이에요.</p><button class="linkbtn" type="button" data-action="resume" data-id="${esc(stuck.session.id)}">이 부분만 다시 연습 ${icon('arrow')}</button></div>` : ''}
    </section>
    <section class="sec">${secHead(2, '누구와, 무엇을')}
      <div id="practice-choices">${practiceChoices()}</div>
      <div class="field-row"><div class="field"><label for="counterpart">상대 이름이나 상황</label><input id="counterpart" name="counterpart" maxlength="80" value="${esc(homeDraft?.counterpart ?? s.counterpart)}" required></div>
      <div class="field"><label for="goal">오늘 꼭 전하고 싶은 것</label><input id="goal" name="goal" maxlength="240" value="${esc(homeDraft?.goal ?? s.goal)}" required></div></div>
      <div class="field when"><label for="realAt">실제 대화 날짜 <span class="opt-note">선택 · 그다음 날 「어땠나요?」를 물어봐요</span></label><input id="realAt" name="realAt" type="date" min="${seoulDate()}" value="${esc(homeDraft?.realAt ?? '')}"></div>
    </section>
    <section class="sec">${secHead(3, '어떻게 연습할까요?')}
      <div class="mode-row"><div class="seg" role="group" aria-label="연습 방법"><button type="button" data-mode="voice" aria-pressed="${inputMode === 'voice'}" ${support.recognition || support.recorder ? '' : 'disabled'}>${icon('mic')} 말로 연습</button><button type="button" data-mode="text" aria-pressed="${inputMode === 'text'}">글로 연습</button></div>
      <p class="hint">${support.recognition ? '말로 연습하면 브라우저의 음성 인식이 받아써요. 크롬 등에서는 소리가 인식 서버로 갈 수 있어요. 녹음은 이 창에서 다시 듣기만 하고 저장하지 않아요.' : support.recorder ? '이 브라우저는 받아쓰기를 지원하지 않아요. 말로 녹음해 다시 듣고, 할 말은 글로 적어요.' : '이 브라우저는 마이크 연습을 지원하지 않아 글로 연습해요.'}</p></div>
      <label class="check save-check"><input type="checkbox" name="save" ${saving ? 'checked' : ''}><span>완료한 연습을 이 기기에 저장하기 <span class="muted small">선택 · 다음에 막힌 곳부터 이어서</span></span></label>
      <div class="actions start"><button class="btn primary" type="submit">리허설 시작 ${icon('arrow')}</button><span class="muted small">세 번 주고받아요 · 5분 안팎</span></div>
      <p id="error" class="error-text" role="alert" tabindex="-1"></p>
    </section>
  </form>`;
}
function practiceChoices() {
  const options = PRACTICES[scenario];
  return `<fieldset><legend>상대</legend><div class="chips">${Object.entries(options.counterparts).map(([id, value]) => `<button class="chip" type="button" data-counterpart="${id}" aria-pressed="${selectedPractice.counterpart === id}">${esc(value.label)}</button>`).join('')}</div></fieldset>
  <fieldset><legend>이번 목표</legend><div class="chips">${Object.entries(options.goals).map(([id, value]) => `<button class="chip" type="button" data-goal="${id}" aria-pressed="${selectedPractice.goal === id}">${esc(value.label)}</button>`).join('')}</div></fieldset>
  <fieldset><legend>상대 반응 세기</legend><div class="seg" role="group" aria-label="상대 반응 세기">${Object.entries(INTENSITY).map(([id, label]) => `<button type="button" data-intensity="${id}" aria-pressed="${intensity === id}">${label}</button>`).join('')}</div></fieldset>`;
}

function counterpartBlock(session, index, turn) {
  const counter = counterFor(session, index);
  return `<figure class="line"><figcaption><span class="dot"></span>${esc(session.counterpart)} <span class="muted">· 연습용 대사 · ${INTENSITY[session.intensity || 'normal']}</span></figcaption><blockquote>${counter ? `<span class="counter">${esc(counter)}</span> ` : ''}${esc(turn.prompt)}</blockquote></figure>`;
}
function micBlock() {
  if (inputMode !== 'voice') return '';
  return `<div class="mic-row"><button class="mic" type="button" data-action="mic" aria-pressed="false">${icon('mic')}<span data-mic-label>누르고 말하기</span></button><div class="mic-meta"><span class="num timer" data-timer>${clock(voiceMs)}</span><span class="small muted" data-mic-state>${support.recognition ? '다 말하면 한 번 더 눌러 끝내요. 쉬어도 끊기지 않아요.' : '녹음만 돼요. 할 말은 아래에 적어 주세요.'}</span></div></div><p class="small mic-issue" data-mic-issue role="status"></p><audio class="replay" controls hidden data-replay></audio>`;
}
function answerForm({ id, value = '', label = '내가 할 말', submit = '확인하기', review = null }) {
  return `<form id="${id}" class="answer">
    <div class="answer-head"><div class="seg" role="group" aria-label="답하는 방법"><button type="button" data-mode="voice" aria-pressed="${inputMode === 'voice'}" ${support.recognition || support.recorder ? '' : 'disabled'}>${icon('mic')} 말로</button><button type="button" data-mode="text" aria-pressed="${inputMode === 'text'}">글로</button></div></div>
    ${micBlock()}
    <div class="field"><label for="answer-text">${label} <span class="opt-note">${inputMode === 'voice' ? '받아쓴 글은 고칠 수 있어요' : '말하듯 적어 보세요'}</span></label><textarea id="answer-text" name="answer" maxlength="2000" required placeholder="완벽한 문장이 아니어도 괜찮아요.">${esc(value)}</textarea></div>
    ${reviewChips(review)}
    <div class="actions"><button class="btn primary" type="submit">${submit}</button></div>
    <p id="error" class="error-text" role="alert" tabindex="-1"></p>
  </form>`;
}
function skeleton(session, got = null) {
  const items = elementList(session.scenario);
  if (!items.length) return '';
  const shown = got && got.size ? got : null;
  return `<div class="card skeleton"><div class="card-top"><span class="eyebrow">이 대화의 뼈대 · 지금까지</span>${shown ? `<span class="muted small">${items.filter(item => shown.has(item.id)).length}개 들어감</span>` : ''}</div><ol class="bones">${items.map(item => `<li class="${shown ? (shown.has(item.id) ? 'in' : 'out') : ''}"><span class="dot ${shown?.has(item.id) ? 'ok' : 'off'}"></span><span><strong>${esc(item.label)}${item.optional ? ' <span class="opt-note">할 수 있을 때만</span>' : ''}</strong><small>${esc(item.why)}</small></span></li>`).join('')}</ol></div>`;
}
function sidePoster(word, label) { return poster({ word, label, size: 'low', art: './assets/bubble.webp', alt: '상대가 말하는 펠트 말풍선' }); }

function feedbackPanel(session, { answer, seconds, mode, analysis, index, before = null }) {
  const stats = mode === 'voice' && seconds ? speakingStats({ text: answer, durationMs: seconds * 1000 }) : null;
  const base = baselinePace(), pace = stats?.syllablesPerMinute;
  const paceNote = !pace ? '' : !base || base === pace ? '이번이 내 기준이 돼요' : pace > base * 1.1 ? '내 첫 기록보다 빨라요' : pace < base * 0.9 ? '내 첫 기록보다 느려요' : '내 첫 기록과 비슷해요';
  const habits = [...analysis.fillers, ...analysis.hedges].sort((a, b) => b.count - a.count).slice(0, 4);
  const tip = nextTip(analysis);
  return `<section class="feedback" aria-labelledby="fb-title">
    <div class="fb-head"><p class="kicker">CHECK · TURN ${String(index + 1).padStart(2, '0')}</p><h2 id="fb-title" tabindex="-1">${analysis.missing.length ? '좋아요. 하나만 더 넣어 봐요.' : '이번 차례에 필요한 건 다 들어갔어요.'}</h2></div>
    <blockquote class="quote mine"><cite>${mode === 'voice' ? '내가 말한 것' : '내가 적은 것'}</cite>${esc(answer)}</blockquote>
    <audio class="replay" controls hidden data-replay></audio>
    <div class="grid two found-missing">
      <div class="card"><div class="card-top"><span class="eyebrow">들어간 것</span><span class="num muted small">${analysis.found.length}</span></div>${analysis.found.length ? `<ul class="marks">${analysis.found.map(f => `<li><span class="dot ok"></span><span><strong>${esc(f.label)}</strong><small>“${esc(f.evidence)}”</small></span></li>`).join('')}</ul>` : '<p class="small muted">아직 뼈대에 해당하는 말을 찾지 못했어요. 오른쪽 뼈대를 보고 하나만 넣어 봐요.</p>'}</div>
      <div class="card"><div class="card-top"><span class="eyebrow">이번 차례에 빠진 것</span><span class="num muted small">${analysis.missing.length}</span></div>${analysis.missing.length ? `<ul class="marks">${analysis.missing.slice(0, 3).map(m => `<li><span class="dot off"></span><span><strong>${esc(m.label)}</strong><small>${esc(m.why)}${m.example ? ` 예: “${esc(m.example)}”` : ''}</small></span></li>`).join('')}</ul>` : '<p class="small muted">빠진 뼈대가 없어요. 이제 짧고 분명하게만 다듬으면 돼요.</p>'}</div>
    </div>
    <ul class="meta" data-cols="3">
      <li><small class="ko">말한 시간</small>${seconds ? `<span class="num">${clock(seconds * 1000)}</span>` : '<span class="muted">글로 연습</span>'}</li>
      <li><small class="ko">빠르기</small>${pace ? `<span class="num">${pace}</span> <span class="small muted">음절/분 · ${paceNote}</span>` : '<span class="muted">말로 연습하면 보여요</span>'}</li>
      <li><small class="ko">말버릇</small>${habits.length ? habits.map(h => `<span class="habit">${esc(h.word)} <span class="num">${h.count}</span></span>`).join(' ') : '<span class="muted">눈에 띄는 말버릇이 없어요</span>'}</li>
    </ul>
    ${analysis.repeats.length ? `<p class="hint">같은 말을 여러 번 썼어요: ${analysis.repeats.slice(0, 3).map(r => `‘${esc(r.word)}’ ${r.count}번`).join(', ')}. 한 번은 다른 말로 바꿔 봐요.</p>` : ''}
    ${before ? `<div class="card compare"><div class="card-top"><span class="eyebrow">처음과 비교</span></div><p>뼈대 <span class="num">${before.found.length}</span> → <span class="num">${analysis.found.length}</span>${analysis.found.length > before.found.length ? ' · 더 단단해졌어요' : analysis.found.length === before.found.length ? ' · 같은 뼈대를 다른 말로 했어요' : ' · 처음 말에 있던 것이 빠졌어요'}</p></div>` : ''}
    ${tip ? `<p class="note-line">${esc(tip)}</p>` : ''}
  </section>`;
}

function turnPage() {
  const index = current.turns.length, turn = getTurn(current), s = practiceDetails(current);
  const fb = stage === 'feedback' ? feedback : null;
  let direction = '';
  if (fb && index === 0) {
    const q = followupQuestion(Ask, current, fb.review);
    if (q.status === 'ask') direction = `<fieldset class="direction"><legend>${esc(q.question.label)}</legend>${radioChips('focus', q.question.options.map(o => [o.id, o.label]), fb.focus ?? q.question.options[0]?.id)}<p class="hint">고른 쪽으로 다음 상대의 말이 달라져요.</p></fieldset>`;
  }
  return `<div class="split turn">
    <div class="main">
      <div class="topline"><button class="linkbtn" type="button" data-action="leave">${icon('back')} 처음으로</button><span class="muted small">${esc(SCENARIOS[current.scenario].short)} · ${esc(s.label || s.goal)}</span></div>
      <div class="progress"><div class="meter"><i data-progress="${Math.round(((index + (fb ? 1 : .5)) / 3) * 100)}"></i></div><span>TURN ${String(index + 1).padStart(2, '0')} / 03</span></div>
      <p class="eyebrow">${esc(turn.title)}</p>
      ${counterpartBlock(current, index, turn)}
      ${fb ? `${feedbackPanel(current, { ...fb, index })}<form id="next" class="next">${direction}<div class="actions"><button class="btn primary" type="submit">${index === 2 ? '세 번 끝, 결과 보기' : '다음 대화로'} ${icon('arrow')}</button><button class="btn soft" type="button" data-action="redo">이 답 다시 하기</button></div><p id="error" class="error-text" role="alert" tabindex="-1"></p></form>` : answerForm({ id: 'answer', value: feedback?.answer || '', review: feedback?.review })}
    </div>
    <aside class="side sticky-side">${sidePoster(TURN_WORD[turn.id] || '대화', `TURN ${String(index + 1).padStart(2, '0')} / 03`)}
      <div class="card tip"><span class="eyebrow">말하기 전에</span><p>${keepDots(turn.hint)}</p></div>
      ${skeleton(current, cumulativeFound(current, index, fb?.analysis))}
    </aside>
  </div>`;
}

function resultsPage() {
  const s = practiceDetails(current), plan = current.plan || { ifThey: '', iWill: '' };
  const pressure = getTurn(current, 1).id === 'pressure' ? getTurn(current, 1).prompt : '';
  return `<section class="result-top">${poster({ word: '내 문장', label: `REHEARSAL · ${dayLabel(current.at.slice(0, 10), { weekday: false })}`, chip: '세 번 완료', size: 'wide', art: './assets/quote.webp', alt: '펠트 큰따옴표' })}</section>
  <div class="result-head"><p class="kicker">${esc(SCENARIOS[current.scenario].short)} · ${esc(current.counterpart)}</p><h1 class="page-title" tabindex="-1">이제 꺼내 볼<br><span class="hl">내 문장.</span></h1><p class="lead">실제 대화에 가져갈 첫 문장과, 상대가 어렵게 나올 때의 내 한마디를 정해 둬요.</p></div>
  <section class="sec">${secHead(1, '가져갈 한 장')}
    <form id="takeaway" class="takeaway">
      <div class="field"><label for="firstSentence">실제 대화에서 꺼낼 첫 문장</label><textarea id="firstSentence" name="firstSentence" maxlength="600" placeholder="${esc(s.starter)}">${esc(current.firstSentence)}</textarea></div>
      <div class="field-row"><div class="field"><label for="ifThey">만약 상대가</label><input id="ifThey" name="ifThey" maxlength="200" value="${esc(plan.ifThey)}" placeholder="${esc(pressure || '바로 대답하기 어려운 말을 하면')}"></div><div class="field"><label for="iWill">나는</label><input id="iWill" name="iWill" maxlength="200" value="${esc(plan.iWill)}" placeholder="한 번 숨을 고르고 정한 범위를 다시 말한다"></div></div>
      <div class="field-row"><div class="field"><label for="takeawayNote">기억할 한 가지</label><input id="takeawayNote" name="takeaway" maxlength="600" value="${esc(current.takeaway)}" placeholder="다음에 꼭 기억하고 싶은 것"></div><div class="field"><label for="realAtResult">실제 대화 날짜 <span class="opt-note">선택</span></label><input id="realAtResult" name="realAt" type="date" value="${esc(current.realAt || '')}"></div></div>
      <p class="hint">스스로 확인해 보기: ${keepDots(s.check)}</p>
      <div class="actions"><button class="btn primary" type="submit">한 장 남기기</button><button class="btn soft" type="button" data-action="copy">${icon('copy')} 첫 문장 복사</button></div>
      <p id="error" class="error-text" role="alert" tabindex="-1"></p>
      <p class="small muted">${statusSave()}</p>
    </form>
  </section>
  <section class="sec">${secHead(2, '세 번의 대화')}
    <div class="turns">${current.turns.map((turn, index) => {
      const a = analyzeAnswer({ scenario: current.scenario, text: turn.retry || turn.answer, turnId: turn.id }), total = elementList(current.scenario).length;
      return `<article class="card turn-card"><div class="card-top"><span class="eyebrow">${String(index + 1).padStart(2, '0')} · ${esc(turnTitle(current, index))}</span><span class="muted small">${REVIEWS[turn.retryReview || turn.review]}</span></div>
      <p class="their">${esc(getTurn(current, index).prompt)}</p>
      ${turn.retry ? `<div class="compare-cols"><div><span class="small muted">처음 한 말</span><p>${esc(turn.answer)}</p></div><div><span class="small muted">다시 한 말</span><p>${esc(turn.retry)}</p></div></div>` : `<p class="mine-text">${esc(turn.answer)}</p>`}
      <div class="turn-foot"><span class="small muted">뼈대 <span class="num">${a.found.length} / ${total}</span>${turn.seconds ? ` · 말한 시간 <span class="num">${clock(turn.seconds * 1000)}</span>` : ''}</span><button class="linkbtn" type="button" data-action="retry" data-index="${index}">이 대화만 다시 ${icon('arrow')}</button></div></article>`;
    }).join('')}</div>
  </section>
  <section class="sec">${secHead(3, '성장 작품집', `<button type="button" data-action="book">열기</button>`)}<p class="muted">처음 쓴 말과 다시 쓴 말, 직접 고른 느낌을 한 권에 모아 두었어요. 인쇄하거나 HTML 파일로 간직할 수 있어요.</p>
  <div class="actions"><button class="btn soft" type="button" data-action="new">새 대화 연습</button></div></section>`;
}

function retryPage() {
  const turn = current.turns[retryIndex], content = getTurn(current, retryIndex), fb = stage === 'feedback' ? feedback : null;
  const before = analyzeAnswer({ scenario: current.scenario, text: turn.answer, turnId: turn.id });
  return `<div class="split turn">
    <div class="main">
      <div class="topline"><button class="linkbtn" type="button" data-action="result">${icon('back')} 결과로</button><span class="muted small">한 부분만 다시</span></div>
      <p class="eyebrow">${esc(content.title)}</p>
      <h1 class="page-title" tabindex="-1">이번에는,<br><span class="hl">이렇게.</span></h1>
      ${counterpartBlock(current, retryIndex, content)}
      <details class="before"><summary>처음 한 말 보기 · ${REVIEWS[turn.retryReview || turn.review]}</summary><p>${esc(turn.answer)}</p></details>
      ${fb ? `${feedbackPanel(current, { ...fb, index: retryIndex, before })}<div class="actions"><button class="btn primary" type="button" data-action="retry-save">이 말로 바꾸기</button><button class="btn soft" type="button" data-action="redo">다시 말하기</button></div>` : answerForm({ id: 'retry', value: feedback?.answer || turn.retry, label: '다시 해 볼 말', submit: '처음과 비교하기', review: feedback?.review })}
    </div>
    <aside class="side sticky-side">${sidePoster(TURN_WORD[content.id] || '다시', 'RETRY')}<div class="card tip"><span class="eyebrow">이번엔 이것만</span><p>${keepDots(content.hint)}</p></div>${skeleton(current, cumulativeFound({ ...current, turns: current.turns.map((t, i) => i === retryIndex ? { ...t, retry: '' , answer: fb ? fb.answer : t.retry || t.answer } : t) }, 3))}</aside>
  </div>`;
}

function followupPage() {
  const session = sessions.find(s => s.id === followupId);
  if (!session) return '<div class="empty"><strong>돌아볼 대화를 찾지 못했어요.</strong><button class="btn soft" type="button" data-nav="home">처음으로</button></div>';
  const o = session.outcome, next = stuckFor(session.scenario);
  return `<div class="split">
    <div class="main"><div class="topline"><button class="linkbtn" type="button" data-nav="home">${icon('back')} 처음으로</button></div>
      <p class="kicker">AFTER THE TALK</p><h1 class="page-title" tabindex="-1">실제 대화는<br><span class="hl">어땠나요?</span></h1>
      <p class="lead">${esc(SCENARIOS[session.scenario].short)} · ${esc(session.counterpart)}${session.realAt ? ` · ${dayLabel(session.realAt)}` : ''}</p>
      ${session.firstSentence ? `<blockquote class="quote"><cite>준비한 첫 문장</cite>${esc(session.firstSentence)}</blockquote>` : ''}
      ${session.plan?.ifThey || session.plan?.iWill ? `<p class="note-line">만약 상대가 ${esc(session.plan.ifThey || '…')} → 나는 ${esc(session.plan.iWill || '…')}</p>` : ''}
      ${followupDone && o ? `<div class="notice-box ok"><span class="lbl">남겼어요</span><strong>${OUTCOME.did[o.did]}${o.reaction ? ` · ${OUTCOME.reaction[o.reaction]}` : ''}</strong><p>${next ? `다음 연습은 지난번 막힌 「${esc(turnTitle(next.session, next.index))}」부터 시작할 수 있어요.` : '다음 연습에서 이 돌아보기를 함께 보여 드려요.'}</p><div class="actions">${next ? `<button class="btn primary" type="button" data-action="resume" data-id="${esc(next.session.id)}">막힌 곳부터 연습</button>` : `<button class="btn primary" type="button" data-action="new">새 대화 연습</button>`}</div></div>` : `<form id="outcome" class="outcome">
        <fieldset><legend>대화를 했나요?</legend>${radioChips('did', Object.entries(OUTCOME.did), o?.did)}</fieldset>
        <fieldset data-if-did><legend>준비한 첫 문장을 썼나요?</legend>${radioChips('usedFirst', [['yes', '네, 썼어요'], ['no', '다르게 말했어요']], o?.usedFirst === true ? 'yes' : o?.usedFirst === false ? 'no' : null, false)}</fieldset>
        <fieldset data-if-did><legend>상대 반응은 어땠나요?</legend>${radioChips('reaction', Object.entries(OUTCOME.reaction), o?.reaction, false)}</fieldset>
        <div class="field"><label for="outcomeNote">다음에 기억할 것 <span class="opt-note">선택</span></label><textarea id="outcomeNote" name="note" maxlength="600" placeholder="예: 기한을 먼저 말하니 대화가 빨라졌다">${esc(o?.note || '')}</textarea></div>
        <div class="actions"><button class="btn primary" type="submit">돌아보기 남기기</button></div><p id="error" class="error-text" role="alert" tabindex="-1"></p></form>`}
    </div>
    <aside class="side sticky-side">${poster({ word: '돌아보기', size: 'low', label: 'AFTER', art: './assets/thought.webp', alt: '생각을 떠올리는 펠트 구름' })}<div class="card tip"><span class="eyebrow">왜 돌아보나요</span><p>실제로 어땠는지 한 줄만 남겨도 다음 연습이 거기서 시작해요. 어디에도 점수를 매기지 않아요.</p></div></aside>
  </div>`;
}

function recordsPage() {
  const did = sessions.filter(s => s.outcome?.did === 'yes').length, voiceTurns = sessions.reduce((sum, s) => sum + s.turns.filter(t => t.mode === 'voice').length, 0);
  return `${poster({ word: '기록', size: 'band', label: 'MY REHEARSALS', art: './assets/stamp.webp', alt: '완료 도장을 찍는 펠트 도장' })}<h1 class="page-title" tabindex="-1">내 연습 기록</h1>
  <ul class="meta"><li><small class="ko">완료한 연습</small><span class="big">${sessions.length}</span></li><li><small class="ko">실제로 한 대화</small><span class="big">${did}</span></li><li><small class="ko">말로 한 연습</small><span class="big">${voiceTurns}</span></li><li><small class="ko">보관</small>${notebook?.active ? 'SYNK 계정' : saving ? '이 기기' : '이 창'}</li></ul>
  <section class="sec">${secHead(1, '지난 연습', sessions.length ? `<button type="button" data-action="book">작품집</button>` : '')}
  ${sessions.length ? `<ul class="rows">${sessions.map(s => `<li><div><span class="t">${esc(SCENARIOS[s.scenario].short)} · ${esc(s.counterpart)}</span><span class="s">${dayLabel(s.at.slice(0, 10))} · ${esc(s.goal)}</span></div><div class="row-actions">${s.outcome ? `<span class="led-chip plain">${OUTCOME.did[s.outcome.did]}</span>` : s.realAt ? `<span class="led-chip plain check">${dayLabel(s.realAt, { weekday: false })} 예정</span>` : ''}<button class="btn small soft" type="button" data-action="history" data-id="${esc(s.id)}">열기</button>${!s.outcome ? `<button class="btn small ghost" type="button" data-action="followup" data-id="${esc(s.id)}">돌아보기</button>` : ''}</div></li>`).join('')}</ul>` : `<div class="empty"><img src="./assets/stamp.webp" alt="" width="120" height="120"><strong>아직 완료한 연습이 없어요.</strong><p>첫 대화를 끝내면 여기에 남아요.</p><button class="btn soft" type="button" data-nav="home">연습 고르기</button></div>`}</section>
  <section class="sec">${secHead(2, '보관과 내보내기')}
    ${notebook?.active ? '<p class="muted">로그인한 SYNK 계정에 저장하고 있어요. 위 계정 단추에서 저장 상태를 확인할 수 있어요.</p>' : `<button class="switch" type="button" role="switch" data-action="save-toggle" aria-checked="${saving}"><span class="track"></span><span>완료한 연습을 이 기기에 저장<br><span class="small muted">최근 ${MAX_SESSIONS}회만 보관해요. 끄면 기기에 저장된 기록을 지워요.</span></span></button>`}
    <p class="small muted">${statusSave()}</p>
    <div class="actions"><button class="btn soft small" type="button" data-action="export">${icon('download')} JSON으로 내보내기</button><label class="btn soft small file">${icon('upload')} 기록 가져오기<input class="sr" type="file" id="import" accept="application/json,.json"></label><button class="btn ghost small danger" type="button" data-action="delete">${icon('trash')} 모두 지우기</button></div>
    ${deletePending ? `<div class="notice-box alert"><span class="lbl">확인</span><strong>${notebook?.active ? '이 계정의 모든 연습 기록을 지울까요?' : '이 기기와 이 창의 연습 기록을 모두 지울까요?'}</strong><p>내보낸 파일은 남아 있어요.</p><div class="actions"><button class="btn small primary" type="button" data-action="delete-confirm">모두 지우기</button><button class="btn small soft" type="button" data-action="delete-cancel">취소</button></div></div>` : ''}
    ${imported ? `<div class="notice-box"><span class="lbl">가져오기</span><strong>${imported.sessions.length}회의 기록을 읽었어요.</strong><p>지금 기록과 합쳐 최근 ${MAX_SESSIONS}회를 남겨요. 같은 기록은 지금 것을 유지해요.</p><div class="actions"><button class="btn small primary" type="button" data-action="import-confirm">합치기</button><button class="btn small soft" type="button" data-action="import-cancel">취소</button></div></div>` : ''}
  </section>`;
}

function bookPage() {
  return `<div class="book-toolbar"><div class="topline"><button class="linkbtn" type="button" data-action="book-back">${icon('back')} ${bookReturn === 'results' ? '연습 결과로' : bookReturn === 'records' ? '기록으로' : '처음으로'}</button></div>
    <div class="book-head"><div><p class="kicker">GROWTH BOOK</p><h1 class="page-title" tabindex="-1">내 성장 작품집</h1><p class="lead">처음 쓴 말과 가장 최근에 다시 쓴 말을 함께 담았어요. 완료한 ${sessions.length}회를 오래된 순서대로 모았어요.</p></div>
    <div class="actions"><button class="btn primary" type="button" data-action="book-download">${icon('download')} HTML로 소장</button><button class="btn soft" type="button" data-action="book-print">${icon('print')} 인쇄 · PDF</button></div></div>
    <p class="small muted">HTML 파일은 인터넷 없이 열려요. 다시 고칠 백업은 기록의 JSON 내보내기를 써 주세요.</p><p id="error" class="error-text" role="alert" tabindex="-1"></p></div>
  <div class="paper">${bookContent(sessions)}</div>`;
}

function emptyBook() {
  return `<p class="kicker">GROWTH BOOK</p><h1 class="page-title" tabindex="-1">내 성장 작품집</h1><div class="empty"><img src="./assets/trophy.webp" alt="" width="120" height="120"><strong>대화를 한 번 끝내면 작품집이 생겨요.</strong><p>처음 쓴 말과 다시 쓴 말, 직접 고른 느낌이 한 권으로 모여요.</p><button class="btn soft" type="button" data-nav="home">연습 고르기</button></div>`;
}

const PAGES = { home, turn: turnPage, results: resultsPage, retry: retryPage, followup: followupPage, records: recordsPage, book: () => sessions.length ? bookPage() : emptyBook() };
const NAV_OF = { home: 'home', turn: 'home', results: 'home', retry: 'home', followup: 'home', records: 'records', book: 'book' };

function render({ focus = true } = {}) {
  imports.invalidate();
  if (page === 'home' && !focus) captureHomeDraft();
  app.innerHTML = PAGES[page]();
  if (notebook?.active) for (const box of app.querySelectorAll('.save-check')) box.hidden = true;
  for (const meter of app.querySelectorAll('[data-progress]')) meter.style.setProperty('--p', `${meter.dataset.progress}%`);
  for (const meta of app.querySelectorAll('.meta[data-cols]')) meta.style.setProperty('--cols', meta.dataset.cols);
  if (page === 'home') homeDraft = null;
  paintNav(); paintMic(voice.state); paintReplay();
  syncFollowupFields();
  document.body.classList.toggle('view-book', page === 'book');
  if (focus) { window.scrollTo({ top: 0, behavior: 'instant' }); app.querySelector('h1[tabindex], h2[tabindex]')?.focus({ preventScroll: true }); }
  document.documentElement.dataset.ready = 'true';
}
function paintNav() {
  const active = NAV_OF[page];
  for (const button of document.querySelectorAll('.tabs [data-nav], .tabbar [data-nav]')) { if (button.dataset.nav === active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current'); }
  const count = document.querySelector('[data-count]'); if (count) count.textContent = sessions.length ? String(sessions.length) : '';
}
function paintMic(state) {
  const button = document.querySelector('[data-action="mic"]'); if (!button) return;
  const on = state === 'listening' || state === 'starting';
  button.setAttribute('aria-pressed', String(on)); button.classList.toggle('live', on); button.disabled = state === 'stopping';
  const label = button.querySelector('[data-mic-label]'); if (label) label.textContent = state === 'starting' ? '마이크 켜는 중' : on ? '말 끝내기' : state === 'stopping' ? '정리하는 중' : voiceMs ? '이어서 말하기' : '누르고 말하기';
  const note = document.querySelector('[data-mic-state]'); if (note && on) note.textContent = support.recognition ? '듣고 있어요. 쉬어도 끊기지 않아요.' : '녹음하고 있어요.';
}
function paintReplay() {
  const url = voice.audioUrl;
  for (const audio of app.querySelectorAll('[data-replay]')) { if (url && (stage === 'feedback' || usedVoice)) { audio.src = url; audio.hidden = false; } else audio.hidden = true; }
}
function syncFollowupFields() {
  const form = app.querySelector('#outcome'); if (!form) return;
  const did = form.elements.did?.value;
  for (const set of form.querySelectorAll('[data-if-did]')) set.hidden = did !== 'yes';
}
function captureHomeDraft() {
  const setup = app.querySelector('#setup'); if (!setup) return;
  homeDraft = { counterpart: setup.elements.counterpart.value, goal: setup.elements.goal.value, realAt: setup.elements.realAt.value };
}
function resetVoice() { voice.dispose(); voiceMs = 0; usedVoice = false; }
function hasDraft() {
  const setup = app.querySelector('#setup');
  const edited = setup && (['counterpart', 'goal'].some(key => setup.elements[key].value.trim() !== details()[key]) || setup.elements.realAt.value);
  const answering = (page === 'turn' && (current?.turns.length || stage === 'feedback' || app.querySelector('#answer-text')?.value.trim())) || (page === 'retry' && app.querySelector('#answer-text')?.value.trim() && app.querySelector('#answer-text').value.trim() !== current.turns[retryIndex].retry);
  return !!(edited || answering || app.querySelector('#takeaway') && takeawayChanged());
}
function takeawayChanged() {
  const form = app.querySelector('#takeaway'); if (!form || !current) return false;
  const plan = current.plan || { ifThey: '', iWill: '' };
  return form.elements.firstSentence.value.trim() !== current.firstSentence || form.elements.takeaway.value.trim() !== current.takeaway || form.elements.ifThey.value.trim() !== plan.ifThey || form.elements.iWill.value.trim() !== plan.iWill || (form.elements.realAt.value || null) !== (current.realAt || null);
}
function captureTakeaway() {
  const form = app.querySelector('#takeaway');
  if (!form || !current) return { ok: true };
  let next = { ...current, firstSentence: form.elements.firstSentence.value.trim(), takeaway: form.elements.takeaway.value.trim() };
  const ifThey = form.elements.ifThey.value.trim(), iWill = form.elements.iWill.value.trim();
  next = setPlan(next, ifThey || iWill ? { ifThey, iWill } : null);
  next = setRealDate(next, form.elements.realAt.value || null);
  current = next;
  return remember();
}
function go(next, options) {
  if (page === 'results') { const captured = captureTakeaway(); if (!captured.ok) throw new Error(captured.error); }
  if (!['turn', 'retry'].includes(next)) resetVoice();
  page = next; stage = 'answer'; feedback = null; render(options);
}
function navigate(target) {
  if (target === page && target !== 'home') return;
  if (['turn', 'retry'].includes(page) && hasDraft() && !window.confirm('연습을 멈추고 나갈까요? 아직 끝내지 않은 답은 저장되지 않아요.')) return;
  if (target === 'book') bookReturn = ['results', 'records'].includes(page) ? page : 'home';
  if (page === 'home') { captureHomeDraft(); if (!hasDraft()) homeDraft = null; } // 탭을 옮겨도 고친 상대·목표·날짜는 처음 화면으로 돌아올 때까지 보관한다
  if (target === 'home') { current = null; }
  go(target);
}
function setSaving(next) {
  if (notebook?.active) return;
  if (next) { const result = saveSessions(storage, sessions); saving = result.ok; if (!result.ok) toast(result.error); }
  else { const result = removeSaved(storage); saving = false; toast(result.ok ? '기기 저장을 껐어요. 기록은 이 창에만 남아요.' : result.error); }
}
async function finishVoice() {
  if (voice.state === 'idle') return;
  const result = await voice.stop();
  voiceMs += result.durationMs; if (result.durationMs) usedVoice = true;
  const field = app.querySelector('#answer-text'); if (field && result.text) field.value = result.text.slice(0, 2000);
  paintMic('idle'); paintReplay();
}
function readAnswer(form) {
  const data = new FormData(form), answer = String(data.get('answer') || '').trim(), review = data.get('review');
  if (!answer) throw new Error(inputMode === 'voice' ? '말한 내용이 비어 있어요. 마이크를 눌러 말하거나 글로 적어 주세요.' : '상대에게 하고 싶은 말을 적어 주세요.');
  if (!review) throw new Error('말해 보니 어땠는지 하나 골라 주세요.');
  const mode = usedVoice ? 'voice' : 'text', seconds = usedVoice ? Math.min(600, Math.round(voiceMs / 1000)) : null;
  return { answer, review, mode, seconds, analysis: analyzeAnswer({ scenario: current.scenario, text: answer, turnId: page === 'retry' ? current.turns[retryIndex].id : getTurn(current).id }) };
}

// ── 입력 ─────────────────────────────────────────────
app.addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.target;
  try {
    if (form.id === 'setup') {
      const data = new FormData(form);
      current = createSession({ scenario, counterpart: data.get('counterpart'), goal: data.get('goal'), practice: { ...selectedPractice }, intensity });
      if (data.get('realAt')) current = setRealDate(current, data.get('realAt'));
      if (saving !== data.has('save')) setSaving(data.has('save'));
      resetVoice(); page = 'turn'; stage = 'answer'; feedback = null; render();
    } else if (form.id === 'answer' || form.id === 'retry') {
      await finishVoice();
      feedback = readAnswer(form); stage = 'feedback'; render({ focus: false });
      app.querySelector('#fb-title')?.focus({ preventScroll: false });
    } else if (form.id === 'next') {
      const focus = new FormData(form).get('focus');
      if (current.turns.length === 0 && !focus) throw new Error('다음 대화를 어느 쪽으로 할지 골라 주세요.');
      current = appendTurn(current, { answer: feedback.answer, review: feedback.review, focus: focus || current.focus, mode: feedback.mode, seconds: feedback.seconds });
      resetVoice(); stage = 'answer'; feedback = null;
      if (current.turns.length === 3) { current.firstSentence = firstSentenceFrom(current.turns[0].answer); remember(); page = 'results'; }
      render();
    } else if (form.id === 'takeaway') {
      const saved = captureTakeaway();
      toast(saved.ok ? (notebook?.active ? '한 장을 계정에 남겼어요.' : saving ? '한 장을 이 기기에 남겼어요.' : '한 장을 이 창에 남겼어요. 계속 보관하려면 기록에서 기기 저장을 켜 주세요.') : saved.error);
    } else if (form.id === 'outcome') {
      const data = new FormData(form), did = data.get('did');
      if (!did) throw new Error('대화를 했는지 골라 주세요.');
      const session = sessions.find(s => s.id === followupId);
      const usedFirst = did === 'yes' && data.get('usedFirst') ? data.get('usedFirst') === 'yes' : null;
      const updated = recordOutcome(session, { did, usedFirst, reaction: did === 'yes' ? data.get('reaction') || null : null, note: String(data.get('note') || '').trim(), at: new Date().toISOString() });
      current = updated; remember(); current = null; followupDone = true; render();
      toast('돌아보기를 남겼어요.');
    }
  } catch (err) { error(err.message); }
});

app.addEventListener('change', async event => {
  const input = event.target;
  if (input.name === 'did') syncFollowupFields();
  else if (input.id === 'import' && input.files[0]) {
    const file = input.files[0];
    try { const result = await imports.read(file); if (result.status === 'cancelled' || !input.isConnected) return; if (notebook?.active && !notebook.canEdit) throw new Error('계정 연결을 확인한 뒤 기록 파일을 다시 골라 주세요.'); imported = result.archive; render({ focus: false }); }
    catch (err) { toast(err.message); input.value = ''; }
  }
});

document.addEventListener('click', async event => {
  const nav = event.target.closest('[data-nav]');
  if (nav) { event.preventDefault(); try { navigate(nav.dataset.nav); } catch (err) { error(err.message); } return; }
  const target = event.target.closest('[data-action],[data-scenario],[data-counterpart],[data-goal],[data-intensity],[data-mode]');
  if (!target || target.tagName === 'INPUT') return;
  try {
    if (target.dataset.scenario) {
      const previous = details(), setup = app.querySelector('#setup');
      scenario = target.dataset.scenario; selectedPractice = defaultPractice(scenario);
      const next = details();
      for (const key of ['counterpart', 'goal']) if (setup.elements[key].value === previous[key]) setup.elements[key].value = next[key];
      for (const button of app.querySelectorAll('[data-scenario]')) button.setAttribute('aria-pressed', String(button.dataset.scenario === scenario));
      app.querySelector('#practice-choices').innerHTML = practiceChoices();
      return;
    }
    if (target.dataset.counterpart || target.dataset.goal) {
      const previous = details(), setup = app.querySelector('#setup');
      selectedPractice = { ...selectedPractice, ...(target.dataset.counterpart ? { counterpart: target.dataset.counterpart } : { goal: target.dataset.goal }) };
      const next = details();
      for (const key of ['counterpart', 'goal']) if (setup.elements[key].value === previous[key]) setup.elements[key].value = next[key];
      app.querySelector('#practice-choices').innerHTML = practiceChoices();
      return;
    }
    if (target.dataset.intensity) { intensity = target.dataset.intensity; app.querySelector('#practice-choices').innerHTML = practiceChoices(); return; }
    if (target.dataset.mode) {
      if (target.dataset.mode === inputMode) return;
      await finishVoice();
      const field = app.querySelector('#answer-text'), kept = field?.value;
      inputMode = target.dataset.mode;
      if (page === 'home') { for (const button of app.querySelectorAll('[data-mode]')) button.setAttribute('aria-pressed', String(button.dataset.mode === inputMode)); return; }
      const review = app.querySelector('[name=review]:checked')?.value;
      feedback = { ...(feedback || {}), answer: kept ?? '', review }; render({ focus: false });
      app.querySelector('#answer-text')?.focus();
      return;
    }
    const action = target.dataset.action;
    if (action === 'theme') { const next = cycleTheme(); paintTheme(); toast(`${THEME_LABEL[next]}으로 바꿨어요.`); }
    else if (action === 'account') sheet.open(target);
    else if (action === 'mic') {
      if (voice.state === 'idle') { const field = app.querySelector('#answer-text'); app.querySelector('[data-mic-issue]').textContent = ''; await voice.start(field?.value || ''); }
      else await finishVoice();
    }
    else if (action === 'leave') navigate('home');
    else if (action === 'new') { const captured = captureTakeaway(); if (!captured.ok) throw new Error(captured.error); current = null; go('home'); }
    else if (action === 'redo') { await finishVoice(); const keep = feedback; resetVoice(); stage = 'answer'; feedback = { answer: keep?.answer || '', review: null }; render({ focus: false }); app.querySelector('#answer-text')?.focus(); }
    else if (action === 'history' || action === 'resume') {
      const captured = captureTakeaway(); if (!captured.ok) throw new Error(captured.error);
      const saved = sessions.find(s => s.id === target.dataset.id); if (!saved) throw new Error('연습 기록을 찾지 못했어요.');
      current = structuredClone(saved); scenario = current.scenario; selectedPractice = current.practice ? { ...current.practice } : defaultPractice(scenario); intensity = current.intensity || 'normal';
      if (action === 'resume') { const next = stuckFor(current.scenario); retryIndex = next && next.session.id === current.id ? next.index : Math.max(0, stuckTurn(current)); go('retry'); } else go('results');
    }
    else if (action === 'retry') { const captured = captureTakeaway(); if (!captured.ok) throw new Error(captured.error); retryIndex = Number(target.dataset.index); resetVoice(); page = 'retry'; stage = 'answer'; feedback = null; render(); }
    else if (action === 'retry-save') { current = retryTurn(current, retryIndex, feedback.answer, feedback.review, { mode: feedback.mode, seconds: feedback.seconds }); remember(); resetVoice(); go('results'); toast('다시 한 말로 바꿔 남겼어요. 처음 한 말도 그대로 있어요.'); }
    else if (action === 'result') { resetVoice(); go('results'); }
    else if (action === 'followup') { followupId = target.dataset.id; followupDone = false; current = null; go('followup'); }
    else if (action === 'copy') { captureTakeaway(); if (!current.firstSentence) throw new Error('복사할 첫 문장을 먼저 적어 주세요.'); try { await navigator.clipboard.writeText(current.firstSentence); toast('첫 문장을 복사했어요.'); } catch { const field = app.querySelector('[name=firstSentence]'); field.focus(); field.select(); toast('복사 권한이 없어 문장을 골라 두었어요. Ctrl/Cmd+C로 복사해 주세요.'); } }
    else if (action === 'book') { const captured = captureTakeaway(); if (!captured.ok) throw new Error(captured.error); bookReturn = ['results', 'records'].includes(page) ? page : 'home'; go('book'); }
    else if (action === 'book-back') { const back = bookReturn === 'results' && current ? 'results' : bookReturn === 'records' ? 'records' : 'home'; go(back); }
    else if (action === 'book-print') { if (page !== 'book' || !sessions.length) return; await document.fonts.ready; if (page === 'book') window.print(); }
    else if (action === 'book-download') { if (page !== 'book') return; const html = createBook(sessions), blob = new Blob([html], { type: BOOK_MIME }), url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = BOOK_FILENAME; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 60000); toast('작품집 내려받기를 시작했어요. 인터넷 없이 열 수 있어요.'); }
    else if (action === 'save-toggle') { setSaving(!saving); render({ focus: false }); }
    else if (action === 'export') { if (!sessions.length) throw new Error('완료한 연습을 먼저 남겨 주세요.'); const text = JSON.stringify(archive(sessions), null, 2), blob = new Blob([text], { type: 'application/json' }); if (blob.size > MAX_IMPORT_BYTES) throw new Error('내보낼 기록이 너무 커요.'); const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = 'synk-rehearsal.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 60000); toast('연습 기록 내려받기를 시작했어요. 이 파일에는 적은 내용이 모두 들어 있어요.'); }
    else if (action === 'delete') { deletePending = true; render({ focus: false }); }
    else if (action === 'delete-cancel') { deletePending = false; render({ focus: false }); }
    else if (action === 'delete-confirm') { if (notebook?.active) { await notebook.remove(); return; } const result = removeSaved(storage); sessions = []; saving = false; current = null; imported = null; deletePending = false; resetVoice(); go('home'); toast(result.ok ? '이 기기와 이 창의 연습 기록을 지웠어요.' : result.error); }
    else if (action === 'import-cancel') { imported = null; render({ focus: false }); }
    else if (action === 'import-confirm') {
      if (notebook?.active && !notebook.canEdit) throw new Error('계정 연결을 확인한 뒤 기록을 다시 합쳐 주세요.');
      const byId = new Map(sessions.map(s => [s.id, s])); for (const s of imported.sessions) if (!byId.has(s.id)) byId.set(s.id, s);
      sessions = keepSessions([...byId.values()].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))); imported = null;
      const saved = save(); render({ focus: false });
      toast(saved.ok ? (notebook?.active ? '기록을 합쳐 계정에 저장해요.' : saving ? '기록을 합쳐 이 기기에 저장했어요.' : '기록을 이 창으로 가져왔어요. 기기에는 저장하지 않았어요.') : saved.error);
    }
  } catch (err) { error(err.message); }
});

function paintTheme() {
  const button = document.querySelector('[data-action="theme"]'); if (!button) return;
  const theme = document.documentElement.dataset.theme || 'night';
  button.innerHTML = icon(theme === 'day' ? 'sun' : theme === 'system' ? 'monitor' : 'moon');
  button.setAttribute('aria-label', `화면 밝기: ${THEME_LABEL[theme]} (눌러서 바꾸기)`);
}
function paintAccount() {
  const chip = document.querySelector('[data-action="account"]'), mount = document.querySelector('#account-panel');
  if (!chip || !mount) return;
  const status = mount.querySelector('[data-notebook-status]')?.textContent?.trim() || '계정';
  const signedOut = !mount.querySelector('[data-notebook="signin"]')?.hidden;
  const state = /필요|확인해 주세요|골라 주세요|다시 불러와|실패/.test(status) ? 'alert' : /중|불러오는|기다리고/.test(status) ? 'busy' : notebook?.active ? 'ok' : '';
  chip.dataset.state = state;
  chip.querySelector('span').textContent = notebook?.active ? (state === 'ok' ? '계정에 저장 중' : status) : signedOut ? '로그인' : status;
  chip.setAttribute('aria-label', `SYNK ID: ${status}`);
}
for (const slot of document.querySelectorAll('.tabbar [data-icon]')) slot.outerHTML = icon(slot.dataset.icon);
document.querySelector('[data-sheet-close]').innerHTML = icon('close');
paintTheme();
render({ focus: false });
if (loaded.error) toast(loaded.error);
notebook = createAccountNotebook({
  resource: 'rehearsal', mount: document.querySelector('#account-panel'), content: app,
  description: `완료한 최근 ${MAX_SESSIONS}회의 답변·다시 쓴 말·직접 고른 느낌·가져갈 한 장·돌아보기를 계정에 보관해요. 녹음은 보관하지 않아요.`,
  getState: () => archive(sessions), emptyDocument: () => archive([]),
  onMode: (active, { wasActive } = {}) => { imports.invalidate(); if (active) { if (!wasActive) guestSaving = saving; saving = false; } else saving = guestSaving; paintAccount(); },
  onStatusChange: () => paintAccount(),
  applyState: value => { sessions = value.sessions; current = null; imported = null; deletePending = false; followupId = null; homeDraft = null; resetVoice(); page = 'home'; stage = 'answer'; feedback = null; render(); },
  beforeNavigate: () => !(hasDraft() || homeDraft || (page === 'turn' && current)) || window.confirm('작성 중인 화면을 닫고 계정 기록을 확인할까요? 끝내지 않은 입력은 저장되지 않아요.'),
});
void notebook.start();
paintAccount();
window.addEventListener('pagehide', event => { resetVoice(); if (event.persisted) notebook.suspend(); else notebook.dispose(); });
window.addEventListener('pageshow', event => { if (event.persisted) void notebook.resume(); });
