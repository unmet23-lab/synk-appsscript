import './core/ask.js';
import { SCENARIOS, REVIEWS, DIRECTIONS, MAX_SESSIONS, MAX_IMPORT_BYTES, createSession, getTurn, followupQuestion, appendTurn, retryTurn, stuckTurn, archive, firstSentenceFrom } from './domain.mjs';
import { loadSaved, saveSessions, removeSaved, createImportController } from './storage.mjs';
import { bookContent, createBook, BOOK_FILENAME, BOOK_MIME } from './book.mjs';
import { createAccountNotebook } from '/synk-account/src/account-notebook.mjs';

const Ask = globalThis.SynkAsk;
const app = document.querySelector('#app');
const storage = { getItem: key => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value), removeItem: key => window.localStorage.removeItem(key) };
const loaded = loadSaved(storage);
const imports = createImportController();
let saving = loaded.enabled, sessions = loaded.sessions, scenario = 'interview', current = null, page = 'home', pending = null, retryIndex = 0, imported = null, deletePending = false;
let noticeTimer;
let bookReturn = 'home';
let bookHomeDraft = null;
let notebook, guestSaving = saving;
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const date = value => new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(new Date(value));
function notice(text) { clearTimeout(noticeTimer); document.querySelector('#notice').textContent = text; noticeTimer = setTimeout(() => { document.querySelector('#notice').textContent = ''; }, 6500); }
function error(text) { const target = document.querySelector('#error'); if (target) { target.textContent = text; target.focus(); } else notice(text); }
function save() { if(notebook?.active){void notebook.change(archive(sessions));return {ok:true};}if (saving) { const result = saveSessions(storage, sessions); if (!result.ok) notice(result.error); return result; } return { ok:true }; }
function remember() { sessions = [current, ...sessions.filter(entry => entry.id !== current.id)].slice(0, MAX_SESSIONS); return save(); }
function button(label, action, secondary = false, attrs = '') { return `<button class="button${secondary ? ' secondary' : ''}" type="button" data-action="${action}" ${attrs}>${label}</button>`; }
function radio(name, value, label, checked = false) { return `<label class="choice"><input type="radio" name="${name}" value="${value}" ${checked ? 'checked' : ''} required><span>${label}</span></label>`; }
function reviews(selected = null) { return `<fieldset class="reviews"><legend>말해 보니 어떤 느낌이었나요? <span class="muted">내가 직접 고르는 느낌</span></legend><div class="review-options">${Object.entries(REVIEWS).map(([id,label]) => radio('review', id, label, selected === id)).join('')}</div></fieldset>`; }
function header(label) { return `<div class="topline"><button class="textbutton" type="button" data-action="home">← 처음으로</button><span class="eyebrow">${label}</span></div>`; }
function goal() { return `<div class="goal"><strong>${esc(current.counterpart)}에게 전하고 싶은 것</strong>${esc(current.goal)}</div>`; }
function prompt(turn) { return `<div class="dialogue"><p class="speaker">${esc(current.counterpart)}의 말 · 연습용 대사</p><blockquote>${esc(turn.prompt)}</blockquote></div>`; }
function statusSave() { return notebook?.active ? '완료한 연습은 계정에 저장해요. 위 SYNK ID에서 저장 상태를 확인하세요.' : saving ? '완료한 연습을 이 기기에 저장하고 있어요.' : '현재 창에서만 기억하고 있어요. 새로고침하면 사라집니다.'; }
function bookInvitation() {
  return sessions.length ? `<aside class="book-invitation"><div><p class="eyebrow">내가 가져가는 것</p><h2>한 번의 연습도, 나의 작품으로.</h2><p>처음 쓴 말과 다시 쓴 말, 내가 고른 느낌까지.<br>완료한 ${sessions.length}회의 연습을 한 권으로 간직하세요.</p></div>${button('내 성장 작품집 보기','book',true)}</aside>` : '';
}
function book() {
  return `<section class="work book-preview"><div class="book-toolbar"><div class="topline"><button class="textbutton" type="button" data-action="book-back">← ${bookReturn === 'results' ? '연습 결과로' : '처음으로'}</button><span class="eyebrow">나의 연습이 남는 한 권</span></div><h1 class="screen-title" tabindex="-1">내 성장 작품집</h1><p class="result-note">처음 쓴 말과 가장 최근에 다시 쓴 말을 함께 담았어요. 완료한 기록 ${sessions.length}회를 오래된 순서대로 모았습니다.</p><div class="actions">${button('HTML로 소장하기','book-download')}${button('인쇄 / PDF로 저장','book-print',true)}</div><p class="muted">HTML 파일은 인터넷 없이 열 수 있어요. 인쇄 창에서 PDF 저장이나 연결된 프린터를 선택하세요. 다시 편집할 백업은 연습 기록의 JSON 내보내기를 이용해 주세요.</p><p class="muted">${statusSave()} 작품집 파일에는 직접 적은 내용이 모두 포함됩니다.</p><p id="error" class="error" role="alert" tabindex="-1"></p></div>${bookContent(sessions)}<div class="actions book-toolbar">${button('연습으로 돌아가기','book-back',true)}</div></section>`;
}
function memory() {
  return `<details class="memory"><summary>내 연습 기록과 저장 설정 <span class="muted">${sessions.length}회</span></summary><article><label class="checkline"><input type="checkbox" data-action="save-toggle" ${saving ? 'checked' : ''}><span>완료한 연습을 이 기기에 저장하기<br><small class="muted">최근 ${MAX_SESSIONS}회만 보관해요. 같은 기기를 쓰는 사람도 볼 수 있어요. 끄면 기기에 저장된 기록을 지웁니다.</small></span></label><p class="muted">${statusSave()}</p><div class="memory-tools"><button class="textbutton" type="button" data-action="export">JSON으로 내보내기</button><label class="file-label">기록 가져오기<input type="file" id="import" accept="application/json,.json" aria-label="리허설 기록 가져오기"></label><button class="textbutton" type="button" data-action="delete">모든 연습 기록 지우기</button></div>${deletePending ? `<div class="confirm"><p>${notebook?.active?'이 계정의 모든 연습 기록을 지울까요?':'이 기기의 저장본과 현재 창의 연습 기록을 모두 지울까요?'} 내보낸 파일은 남아 있어요.</p>${button('모든 기록 지우기','delete-confirm')}${button('취소','delete-cancel',true)}</div>` : ''}${imported ? `<div class="confirm"><p>${imported.sessions.length}회의 기록을 읽었어요. 현재 기록과 합쳐 최근 ${MAX_SESSIONS}회를 남깁니다. 같은 ID의 기록은 현재 기록을 유지합니다.</p>${button('기록 합치기','import-confirm')}${button('취소','import-cancel',true)}</div>` : ''}${sessions.length ? sessions.map(s => `<div class="memory-item"><div><strong>${esc(SCENARIOS[s.scenario].short)} · ${esc(s.counterpart)}</strong><p>${date(s.at)} · ${esc(s.goal)}</p></div><button class="textbutton" type="button" data-action="history" data-id="${esc(s.id)}">기록 보기</button></div>`).join('') : '<p class="muted">아직 완료한 연습이 없어요. 첫 대화를 끝내면 여기에 남습니다.</p>'}</article></details>`;
}
function resume() {
  const previous = sessions.find(s => s.scenario === scenario && stuckTurn(s) >= 0);
  if (!previous) return '';
  const index = stuckTurn(previous), turn = previous.turns[index];
  return `<aside class="resume"><p class="eyebrow">지난 연습에서 이어서</p><h3>${esc(SCENARIOS[scenario].turns[turn.id].title)}</h3><p>${date(previous.at)}에 직접 ‘${REVIEWS[turn.retryReview || turn.review]}’를 골랐던 부분이에요.</p><button class="textbutton" type="button" data-action="resume" data-id="${esc(previous.id)}">이 부분부터 다시 연습 →</button></aside>`;
}
function home() {
  const s = SCENARIOS[scenario];
  return `<section class="hero"><div><p class="eyebrow">SYNK FOR YOU / REHEARSAL</p><h1 class="screen-title" tabindex="-1">중요한 말,<br><span class="accent">한 번 먼저.</span></h1><p class="lead">머릿속으로만 맴돌던 말을 꺼내 보고,<br>막힌 순간만 한 번 더 연습하세요.</p><ol class="mini-steps"><li><span>01</span>상황 고르기</li><li><span>02</span>세 번 말해 보기</li><li><span>03</span>내 문장 남기기</li></ol></div><div class="hero-art"><img src="./assets/teacher-cover.png" alt="말할 내용을 준비한 펠트 연단과 보드" width="480" height="400"></div></section><form id="setup"><fieldset class="scenarios"><legend>어떤 대화가 기다리고 있나요?</legend>${Object.entries(SCENARIOS).map(([id,value],i) => `<label class="choice"><input type="radio" name="scenario" value="${id}" ${scenario === id ? 'checked' : ''} required><span class="number">0${i+1}</span><strong>${value.name}</strong><small>${value.note}</small></label>`).join('')}</fieldset><div id="resume-slot">${resume()}</div><div class="context"><label class="field"><span>누구와 나눌 대화인가요?</span><input type="text" name="counterpart" aria-label="대화 상대" maxlength="80" value="${esc(s.counterpart)}" required></label><label class="field"><span>오늘 꼭 전하고 싶은 것 <small>나만의 목표</small></span><input type="text" name="goal" aria-label="오늘의 목표" maxlength="240" value="${esc(s.goal)}" required></label></div><label class="checkline"><input type="checkbox" name="save" ${saving ? 'checked' : ''}><span>완료한 연습을 이 기기에 저장하기 <span class="muted">선택 · 다음에 막힌 부분부터 이어서</span></span></label><div class="actions"><button class="button" type="submit">대화 시작하기 →</button><span class="muted">텍스트로 연습해요 · 세 번의 대화</span></div><p id="error" class="error" role="alert" tabindex="-1"></p></form>${memory()}`;
}
function practice() {
  const index = current.turns.length, turn = getTurn(current);
  return `<section class="work">${header(`대화 ${index+1} / 3`)}<div class="progress" aria-label="세 번 중 ${index+1}번째 대화">${[0,1,2].map(i => `<span class="${i<=index?'done':''}"></span>`).join('')}</div><h1 class="screen-title" tabindex="-1">${turn.title}</h1>${goal()}${index===1 ? `<p class="evidence">직접 고른 ‘${DIRECTIONS[current.focus]}’에 맞춰 다음 연습용 대사를 바꿨어요.</p>`:''}${prompt(turn)}<p class="hint">${turn.hint}</p><form id="answer"><label class="field"><span>내가 하고 싶은 말 <small>최대 2,000자</small></span><textarea name="answer" aria-label="내 답변" maxlength="2000" required placeholder="말하듯 적어 보세요. 완벽한 문장이 아니어도 괜찮아요."></textarea></label>${reviews()}<div class="actions"><button class="button" type="submit">${index===2?'내 연습 돌아보기':'다음 대화로 →'}</button></div><p id="error" class="error" role="alert" tabindex="-1"></p></form></section>`;
}
function reflection() {
  const q = followupQuestion(Ask, current, pending.review);
  if (q.status !== 'ask') throw new Error('다음 연습 방향을 불러오지 못했어요.');
  return `<section class="work">${header('다음 대화 준비')}<h1 class="screen-title" tabindex="-1">내게 필요한 쪽으로.</h1><p class="result-note">방금 직접 고른 느낌은 ‘${REVIEWS[pending.review]}’였어요.</p><div class="answer-read">${esc(pending.answer)}</div><form id="focus"><fieldset class="reflection"><legend>${q.question.label}</legend>${q.question.options.map(option=>radio('focus',option.id,option.label)).join('')}</fieldset><p class="evidence">고른 방향에 맞춰 다음 상대의 반응이 달라져요.</p><div class="actions"><button class="button" type="submit">고른 방향으로 연습하기 →</button>${button('내 답변 다시 적기','back-answer',true)}</div><p id="error" class="error" role="alert" tabindex="-1"></p></form></section>`;
}
function results() {
  const s = SCENARIOS[current.scenario];
  return `<section class="work">${header('오늘의 리허설')}<div class="result-head"><p class="eyebrow">내 말로 남기는 한 장</p><h1 class="screen-title" tabindex="-1">이제, 꺼내 볼<br><span class="accent">내 문장.</span></h1><p class="result-note">세 번의 대화를 마쳤어요. 실제 대화에 가져갈 첫 문장과 기억할 한 가지를 직접 다듬어 보세요.</p></div>${goal()}<form id="takeaway"><div class="result-fields"><label class="field"><span>실제 대화에서 꺼낼 첫 문장</span><textarea name="firstSentence" aria-label="내 첫 문장" maxlength="600" placeholder="${esc(s.starter)}">${esc(current.firstSentence)}</textarea></label><label class="field"><span>기억할 한 가지</span><textarea name="takeaway" aria-label="기억할 한 가지" maxlength="600" placeholder="다음에 어떤 점을 기억하고 싶나요?">${esc(current.takeaway)}</textarea></label></div><p class="hint">스스로 확인해 보기: ${s.check}</p><div class="actions"><button class="button" type="submit">내 문장 남기기</button>${button('첫 문장 복사','copy',true)}</div><p id="error" class="error" role="alert" tabindex="-1"></p></form><p class="muted">${statusSave()} 아래에서 저장 방식을 바꿀 수 있어요.</p><div class="section-top"><h2>막힌 순간만, 한 번 더.</h2><p>자동 평가 없이 나의 느낌으로 돌아봐요.</p></div><div class="retry-list">${current.turns.map((turn,index)=>`<article class="retry-card"><span class="label">${index+1}번째 대화 · ${REVIEWS[turn.review]}</span><h3>${s.turns[turn.id].title}</h3><p>${s.turns[turn.id].prompt}</p>${turn.retry ? `<div class="comparison"><div><h3>처음 적은 말</h3><p>${esc(turn.answer)}</p></div><div><h3>다시 적은 말</h3><p>${esc(turn.retry)}</p><small class="muted">다시 말한 느낌: ${REVIEWS[turn.retryReview]}</small></div></div>` : `<p class="answer-read">${esc(turn.answer)}</p>`}<button type="button" class="textbutton" data-action="retry" data-index="${index}">이 대화 다시 연습 →</button></article>`).join('')}</div><div class="actions">${button('새 대화 연습하기','home',true)}</div>${memory()}</section>`;
}
function retry() {
  const turn = current.turns[retryIndex], content = SCENARIOS[current.scenario].turns[turn.id];
  return `<section class="work">${header('한 부분 다시 연습')}<h1 class="screen-title" tabindex="-1">이번에는, 이렇게.</h1>${goal()}<p class="evidence">지난 느낌은 ‘${REVIEWS[turn.retryReview || turn.review]}’였어요. 나머지는 그대로 두고 이 부분만 다시 해 봅니다.</p>${prompt(content)}<details><summary>처음 적은 말 보기</summary><p class="answer-read">${esc(turn.answer)}</p></details><p class="hint">${content.hint}</p><form id="retry"><label class="field"><span>다시 해 볼 말</span><textarea name="retry" aria-label="다시 해 볼 말" maxlength="2000" required>${esc(turn.retry)}</textarea></label>${reviews()}<div class="actions"><button class="button" type="submit">처음과 다시 쓴 말 비교하기</button>${button('결과로 돌아가기','result',true)}</div><p id="error" class="error" role="alert" tabindex="-1"></p></form></section>`;
}
function render({ focus = true } = {}) {
  imports.invalidate();
  const setup = page === 'home' && !focus ? document.querySelector('#setup') : null;
  const setupDraft = setup ? { counterpart:setup.elements.counterpart.value, goal:setup.elements.goal.value, save:setup.elements.save.checked } : null;
  app.innerHTML = ({ home, practice, reflection, results, retry, book })[page]();
  if(notebook?.active)for(const checkbox of app.querySelectorAll('[name=save],[data-action=save-toggle]')){checkbox.disabled=true;checkbox.closest('label').hidden=true;}
  document.body.classList.toggle('view-book',page === 'book');
  if (page === 'home') app.querySelector('.memory')?.insertAdjacentHTML('beforebegin', bookInvitation());
  if (page === 'results') app.querySelector('#takeaway')?.insertAdjacentHTML('afterend', bookInvitation());
  if (setupDraft) { const form=document.querySelector('#setup'); form.elements.counterpart.value=setupDraft.counterpart; form.elements.goal.value=setupDraft.goal; form.elements.save.checked=setupDraft.save; }
  if (focus) { window.scrollTo({ top: 0, behavior: 'instant' }); app.querySelector('.screen-title')?.focus({ preventScroll: true }); }
  document.documentElement.dataset.ready = 'true';
}
function setSaving(next) {
  if(notebook?.active)return;
  if (next) { const result = saveSessions(storage, sessions); saving = result.ok; if (!result.ok) notice(result.error); }
  else { const result = removeSaved(storage); saving = false; notice(result.ok ? '기기 저장을 껐어요. 기록은 현재 창에만 남아 있어요.' : result.error); }
}
function captureTakeaway() {
  const form = document.querySelector('#takeaway');
  if (form) { current = { ...current, firstSentence: form.elements.firstSentence.value.trim(), takeaway: form.elements.takeaway.value.trim() }; return remember(); }
  return { ok:true };
}
app.addEventListener('submit', event => {
  event.preventDefault();
  const form = event.target, data = new FormData(form);
  try {
    if (form.id === 'setup') { scenario = data.get('scenario'); current = createSession({ scenario, counterpart: data.get('counterpart'), goal: data.get('goal') }); if (saving !== data.has('save')) setSaving(data.has('save')); page = 'practice'; }
    else if (form.id === 'answer') {
      const answer = data.get('answer').trim(), review = data.get('review');
      if (!answer) throw new Error('상대에게 하고 싶은 말을 적어 주세요.');
      if (!current.turns.length) { pending = { answer, review }; page = 'reflection'; }
      else { current = appendTurn(current, { answer, review }); if (current.turns.length === 3) { current.firstSentence = firstSentenceFrom(current.turns[0].answer); remember(); page = 'results'; } }
    } else if (form.id === 'focus') { current = appendTurn(current, { ...pending, focus: data.get('focus') }); pending = null; page = 'practice'; }
    else if (form.id === 'retry') { current = retryTurn(current, retryIndex, data.get('retry'), data.get('review')); remember(); page = 'results'; }
    else if (form.id === 'takeaway') { const saved = captureTakeaway(); notice(saved.ok ? (notebook?.active?'내 문장을 남겼어요. 위 SYNK ID에서 계정 저장 상태를 확인하세요.':saving ? '내 문장을 이 기기에 남겼어요.' : '내 문장을 현재 창에 남겼어요. 계속 보관하려면 기기 저장을 켜 주세요.') : saved.error); return; }
    render();
  } catch (err) { error(err.message); }
});
app.addEventListener('change', async event => {
  const input = event.target;
  if (input.name === 'scenario') {
    scenario = input.value;
    const setup = document.querySelector('#setup');
    setup.elements.counterpart.value = SCENARIOS[scenario].counterpart;
    setup.elements.goal.value = SCENARIOS[scenario].goal;
    document.querySelector('#resume-slot').innerHTML = resume();
  } else if (input.dataset.action === 'save-toggle') { captureTakeaway(); setSaving(input.checked); input.checked = saving; const setup=document.querySelector('#setup'); if(setup) setup.elements.save.checked=saving; render({ focus: false }); app.querySelector('.memory').open = true; }
  else if (input.id === 'import' && input.files[0]) {
    const file = input.files[0];
    try { const result=await imports.read(file); if(result.status==='cancelled'||!input.isConnected) return; imported=result.archive; captureTakeaway(); render({ focus: false }); app.querySelector('.memory').open = true; }
    catch (err) { notice(err.message); input.value = ''; }
  }
});
document.addEventListener('click', async event => {
  const target = event.target.closest('[data-action]'); if (!target || target.tagName === 'INPUT') return;
  const action = target.dataset.action;
  try {
    if (action === 'home') {
      const unfinished = current && current.turns.length < 3 && (current.turns.length > 0 || pending || document.querySelector('[name=answer]')?.value.trim());
      const retryDraft = page === 'retry' && document.querySelector('[name=retry]')?.value.trim() && document.querySelector('[name=retry]').value.trim() !== current.turns[retryIndex].retry;
      if ((unfinished || retryDraft) && !window.confirm('연습을 종료하고 처음으로 돌아갈까요? 아직 완료하지 않은 답변은 저장되지 않아요.')) return;
      captureTakeaway(); page = 'home'; current = null; pending = null; render();
    }
    else if (action === 'history' || action === 'resume') { const captured = captureTakeaway(); if (!captured.ok) throw new Error(captured.error); const saved = sessions.find(s=>s.id===target.dataset.id); if (!saved) throw new Error('연습 기록을 찾지 못했어요.'); current = structuredClone(saved); scenario = current.scenario; if (action === 'resume') { retryIndex = stuckTurn(current); page = 'retry'; } else page = 'results'; render(); }
    else if (action === 'retry') { captureTakeaway(); retryIndex = Number(target.dataset.index); page = 'retry'; render(); }
    else if (action === 'result') { page = 'results'; render(); }
    else if (action === 'back-answer') { const draft = pending; page = 'practice'; render(); document.querySelector('[name=answer]').value = draft.answer; document.querySelector(`[name=review][value=${draft.review}]`).checked = true; }
    else if (action === 'copy') { captureTakeaway(); if (!current.firstSentence) throw new Error('복사할 첫 문장을 먼저 적어 주세요.'); try { await navigator.clipboard.writeText(current.firstSentence); notice('첫 문장을 복사했어요.'); } catch { const field = document.querySelector('[name=firstSentence]'); field.focus(); field.select(); notice('복사 권한이 없어 문장을 선택했어요. 복사 메뉴나 Ctrl/Cmd+C를 사용해 주세요.'); } }
    else if (action === 'book') { const captured=captureTakeaway(); if(!captured.ok) throw new Error(captured.error); if(!sessions.length) throw new Error('대화를 한 번 끝내면 내 성장 작품집을 만들 수 있어요.'); bookReturn=page === 'results' ? 'results' : 'home'; const setup=document.querySelector('#setup'); bookHomeDraft=setup?{counterpart:setup.elements.counterpart.value,goal:setup.elements.goal.value,save:setup.elements.save.checked}:null; page='book'; render(); }
    else if (action === 'book-back') { page=bookReturn === 'results' && current ? 'results' : 'home'; render(); if(page==='home'&&bookHomeDraft){const setup=document.querySelector('#setup');setup.elements.counterpart.value=bookHomeDraft.counterpart;setup.elements.goal.value=bookHomeDraft.goal;setup.elements.save.checked=bookHomeDraft.save;} bookHomeDraft=null; }
    else if (action === 'book-print') { if(page !== 'book' || !sessions.length) return; await document.fonts.ready; if(page === 'book') window.print(); }
    else if (action === 'book-download') { if(page !== 'book') return; const html=createBook(sessions),blob=new Blob([html],{type:BOOK_MIME}),url=URL.createObjectURL(blob),anchor=document.createElement('a'); anchor.href=url;anchor.download=BOOK_FILENAME;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),60000);notice('작품집 다운로드를 시작했어요. HTML 파일은 인터넷 없이 다시 열 수 있어요.'); }
    else if (action === 'export') { captureTakeaway(); if (!sessions.length) throw new Error('완료한 연습을 먼저 남겨 주세요.'); const text = JSON.stringify(archive(sessions), null, 2); const blob = new Blob([text], { type: 'application/json' }); if (blob.size > MAX_IMPORT_BYTES) throw new Error('내보낼 기록이 너무 커요.'); const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = 'synk-rehearsal.json'; anchor.click(); setTimeout(()=>URL.revokeObjectURL(url), 60000); notice('연습 기록 다운로드를 시작했어요. 이 파일에는 작성한 내용이 포함돼요.'); }
    else if (action === 'delete') { captureTakeaway(); deletePending = true; render({ focus:false }); app.querySelector('.memory').open = true; }
    else if (action === 'delete-cancel') { captureTakeaway(); deletePending = false; render({ focus:false }); app.querySelector('.memory').open = true; }
    else if (action === 'delete-confirm') { if(notebook?.active){await notebook.remove();return;}const result = removeSaved(storage); sessions=[]; saving=false; current=null; imported=null; pending=null; deletePending=false; page='home'; render(); notice(result.ok?'이 기기와 현재 창의 연습 기록을 지웠어요.':result.error); }
    else if (action === 'import-cancel') { captureTakeaway(); imported=null; render({focus:false}); app.querySelector('.memory').open=true; }
    else if (action === 'import-confirm') { const captured=captureTakeaway(); if(!captured.ok) throw new Error(captured.error); const byId=new Map(sessions.map(s=>[s.id,s])); for(const s of imported.sessions) if(!byId.has(s.id)) byId.set(s.id,s); sessions=[...byId.values()].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).slice(0,MAX_SESSIONS); imported=null; const saved=save(); render({focus:false}); app.querySelector('.memory').open=true; notice(saved.ok?(notebook?.active?'기록을 합쳤어요. 위 SYNK ID에서 계정 저장 상태를 확인하세요.':saving?'기록을 합쳐 이 기기에 저장했어요.':'기록을 현재 창으로 가져왔어요. 기기에는 저장하지 않았어요.'):saved.error); }
  } catch(err) { error(err.message); }
});
render({ focus:false });
if (loaded.error) notice(loaded.error);
notebook=createAccountNotebook({resource:'rehearsal',mount:document.querySelector('#account-panel'),content:app,description:'완료한 최근 10회의 답변·다시 쓴 말·직접 고른 느낌·첫 문장을 계정에 보관해요.',getState:()=>archive(sessions),emptyDocument:()=>archive([]),onMode:(active,{wasActive}={})=>{if(active){if(!wasActive)guestSaving=saving;saving=false;}else saving=guestSaving;},applyState:value=>{sessions=value.sessions;current=null;pending=null;imported=null;deletePending=false;page='home';bookHomeDraft=null;render();},beforeNavigate:()=>{const hasDraft=current&&current.turns.length<3||page==='retry'||document.querySelector('#takeaway');return !hasDraft||window.confirm('작성 중인 화면을 닫고 계정 기록을 확인할까요? 완료하지 않은 입력은 저장되지 않아요.');}});
void notebook.start();window.addEventListener('pagehide',()=>notebook.dispose());
