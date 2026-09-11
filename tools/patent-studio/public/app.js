const $ = id => document.getElementById(id);
const state = { token: null, bootstrap: null, session: null, mode: 'example', busy: false, recording: null, recorderStarting: false, retry: null, pendingHelp: null, allEvents: false };
const statusNames = { accepted: '반영', held: '보류', excluded: '사용 제외' };
const purposeNames = { 'asr-data': '음성 자료에 사용', 'original-performance': '처음 수행에 사용', 'response-performance': '새 응답의 수행에 사용' };
const eventNames = { 'audio-attached': '원음 파일 저장', 'transcripts-set': '전사 후보 저장', 'review-original': '처음 원음 청취 확인', 'review-response': '새 응답 청취 확인', 'help-presented': '도움 문장 실제 제시', 'response-added': '새 시점의 응답 저장', 'task-confirmed': '문항·관측 조건 확인', 'unknown-set': '미해결 범위 변경', 'purpose-set': '확인할 사용처 변경' };
const comparisonNames = { 'no-purpose': '용도를 나누지 않으면', 'no-epoch': '시점을 나누지 않으면', 'no-target': '확인할 목표를 빼면', 'predicted-response': '예상을 실제 답으로 쓰면' };
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const time = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
const titleFor = s => s.sourceKind === 'synthetic-speech' ? '합성 음성 받아쓰기' : s.mode === 'example' ? state.bootstrap?.examples.find(x => x.id === s.exampleId)?.title || '통제 예제' : '직접 녹음 시연';
const hasOriginal = () => Boolean(state.session?.original?.audio || state.session?.original?.syntheticEvidence);
const changed = (a, b) => a?.status !== b?.status || JSON.stringify(a?.value) !== JSON.stringify(b?.value);

function notice(message, error = false) {
  $('notice').hidden = false; $('notice').classList.toggle('error', error); $('notice').querySelector('p').textContent = message;
}
function setConnection(ok, message) { $('connection').className = `connection ${ok ? 'online' : 'failed'}`; $('connection').querySelector('span').textContent = message; }
async function api(path, options = {}) {
  const headers = { ...(options.body && !(options.body instanceof Blob) ? { 'Content-Type': 'application/json' } : {}), ...(options.method === 'POST' ? { 'X-Studio-Token': state.token } : {}), ...options.headers };
  let response;
  try { response = await fetch(path, { ...options, headers, cache: 'no-store' }); }
  catch { throw Object.assign(new Error('서버와 연결되지 않았습니다. 입력을 유지한 채 연결을 확인해 주세요.'), { network: true }); }
  let data; try { data = await response.json(); } catch { throw new Error('서버 응답을 읽지 못했습니다. 새로 읽기를 눌러 저장 상태를 확인해 주세요.'); }
  if (!response.ok) throw Object.assign(new Error(data.error || '요청을 완료하지 못했습니다.'), { status: response.status, code: data.code });
  return data;
}
function syncControls() {
  const s = state.session, recording = Boolean(state.recording || state.recorderStarting), locked = state.busy || recording;
  const retrying = Boolean(state.retry), pending = Boolean(state.pendingHelp) || retrying;
  document.querySelectorAll('button,input,textarea,select').forEach(el => {
    if (!['notice-close', 'stop-recording', 'cancel-recording'].includes(el.id) && !el.closest('dialog')) el.disabled = locked;
  });
  ['mode-example', 'mode-recording', 'create-example', 'create-recording', 'create-sample', 'session-select'].forEach(id => { $(id).disabled = locked || pending || retrying || !state.token; });
  $('create-sample').disabled ||= !state.bootstrap?.samples?.length;
  $('refresh-button').disabled = locked || pending;
  ['save-transcript', 'save-task', 'save-unknown', 'save-purpose', 'comparison-button'].forEach(id => { $(id).disabled = locked || pending || !s; });
  $('save-transcript').disabled ||= !$('machine-transcript').value.trim();
  $('record-original').disabled = locked || pending || !s || s.mode !== 'recording' || Boolean(s.original.audio);
  $('file-original').disabled = $('record-original').disabled;
  $('transcribe-original').disabled = locked || pending || !s?.original.audio;
  $('review-original').disabled = locked || pending || !hasOriginal() || !$('review-confirmed').checked || !$('review-text').value.trim();
  $('present-help').disabled = locked || pending || !hasOriginal() || !$('help-text').value.trim();
  ['record-response', 'file-response', 'response-text'].forEach(id => { $(id).disabled = locked || pending || !hasOriginal(); });
  $('add-response').disabled = locked || pending || !hasOriginal() || !$('response-text').value.trim();
  const response = s?.responses.find(r => r.id === $('response-select').value);
  $('review-response').disabled = locked || pending || !response?.audio || !$('response-review-confirmed').checked || !$('response-review-text').value.trim();
  $('retry-button').disabled = locked || !state.retry;
  $('help-retry').disabled = locked || !state.retry;
  $('help-continue').disabled = state.busy || pending;
  $('export-link').setAttribute('aria-disabled', String(!s || locked || pending)); $('export-link').tabIndex = s && !locked && !pending ? 0 : -1;
  $('stop-recording').disabled = !state.recording; $('cancel-recording').disabled = !state.recording;
}
function refreshSessionList() {
  const sessions = [...(state.bootstrap?.sessions || [])];
  if (state.session) { const i = sessions.findIndex(s => s.id === state.session.id); if (i >= 0) sessions.splice(i, 1); sessions.unshift(state.session); }
  $('session-select').innerHTML = '<option value="">이전 시연</option>' + sessions.map(s => `<option value="${esc(s.id)}" ${s.id === state.session?.id ? 'selected' : ''}>${esc(titleFor(s))} · ${esc(time(s.updatedAt))}</option>`).join('');
}
async function boot() {
  state.busy = true; syncControls();
  try {
    const b = await api('/api/bootstrap'); state.bootstrap = b; state.token = b.token;
    $('example-select').innerHTML = b.examples.map(x => `<option value="${esc(x.id)}">${esc(x.title)}</option>`).join(''); updateExampleDescription(); refreshSessionList();
    $('create-sample').hidden = !b.samples?.length; $('sample-description').hidden = !b.samples?.length;
    setConnection(true, '로컬 서버 연결됨');
    const rememberedId = new URL(location.href).searchParams.get('session');
    if (rememberedId && /^[a-zA-Z0-9-]+$/.test(rememberedId)) {
      try { renderSession(await api(`/api/sessions/${rememberedId}`), { fresh: true }); }
      catch (e) { notice(`이전 시연을 다시 읽지 못했습니다. ${e.message}`, true); }
    }
  } catch (e) { setConnection(false, '연결 확인 필요'); notice(e.message, true); }
  finally { state.busy = false; syncControls(); }
}
function updateExampleDescription() { $('example-description').textContent = state.bootstrap?.examples.find(x => x.id === $('example-select').value)?.description || ''; }
function setMode(mode) {
  if (state.busy || state.recording || state.pendingHelp || state.retry) return;
  state.mode = mode; $('example-controls').hidden = mode !== 'example'; $('recording-controls').hidden = mode !== 'recording';
  ['example', 'recording'].forEach(m => { $(`mode-${m}`).classList.toggle('selected', mode === m); $(`mode-${m}`).setAttribute('aria-pressed', String(mode === m)); });
}
function audioFor(u) { return state.session?.audios.find(a => a.audioRef === u?.audio?.audioRef && (u.id === 'original' ? a.role === 'original' : a.responseId === u.id)) || null; }
const needsTimeReview = u => Boolean(u?.audio && !u.syntheticEvidence && u.performanceTimeSource !== 'browser-recorder');
const timeReview = (u, checkbox) => needsTimeReview(u) ? { performanceTimeConfirmed: $(checkbox).checked } : {};
function audioHTML(u, label) {
  const audio = audioFor(u);
  if (audio && /^\/api\/audio\/[a-f0-9]{64}$/.test(audio.url)) return `<p class="audio-caption">${esc(label)} · 서버에 저장된 원본</p><audio controls preload="metadata" src="${esc(audio.url)}" aria-label="${esc(label)}"></audio>`;
  if (u?.syntheticEvidence) return `<div class="synthetic-audio"><strong>통제 예제 · 실제 녹음 없음</strong>${u.alternatives.map(a => esc(a.text)).join('<br>')}</div>`;
  return '<p class="field-help">연결된 원음이 아직 없습니다.</p>';
}
function fillForms(s) {
  $('machine-transcript').value = s.original.alternatives.map(a => a.text).join('\n');
  $('review-text').value = s.original.alternatives.length === 1 ? s.original.alternatives[0].text : '';
  $('review-confirmed').checked = false;
  $('original-time-confirmed').checked = s.original.performanceTimeConfirmed === true;
  $('role-confirmed').checked = s.task.roleConfirmed; $('past-independent').checked = s.task.pastIndependent; $('exposure-confirmed').checked = s.original.exposureScopeConfirmed;
  $('unknown-enabled').checked = s.unknown.enabled; $('unknown-reason').value = s.unknown.reason || ''; $('unknown-kind').value = s.unknown.kind || 'all';
  $('response-text').value = ''; $('response-review-confirmed').checked = false;
  $('help-text').value = s.analysis.actions.find(a => a.id === 'show-answer-and-respond')?.material || '';
}
function renderSession(s, { fresh = false, preserveForms = false } = {}) {
  const previous = state.session; state.session = s;
  document.body.classList.add('session-active');
  const sessionURL = new URL(location.href); sessionURL.searchParams.set('session', s.id); history.replaceState(null, '', sessionURL);
  $('evidence-input').hidden = false; $('observation-section').hidden = false; $('analysis-empty').hidden = true; $('analysis-content').hidden = false;
  $('session-mode').textContent = s.sourceKind === 'synthetic-speech' ? '합성 음성' : s.mode === 'example' ? '통제 예제' : '실제 녹음';
  $('session-mode').classList.toggle('real', s.mode === 'recording' && s.sourceKind !== 'synthetic-speech');
  $('session-name').textContent = titleFor(s); $('revision').textContent = `v${s.revision}`;
  $('analysis-live').textContent = `저장됨 · v${s.revision}`; $('original-kind').textContent = s.original.syntheticEvidence ? '예제 입력' : s.sourceKind === 'synthetic-speech' ? '합성 음성' : '원본 보존';
  $('task-prompt').textContent = s.task.prompt; $('original-player').innerHTML = audioHTML(s.original, '처음 말한 원음'); $('review-player').innerHTML = audioHTML(s.original, '처음 원음 다시 듣기');
  $('original-capture').hidden = s.mode !== 'recording' || Boolean(s.original.audio);
  const audio = audioFor(s.original), transcription = audio?.transcription;
  $('original-audio-status').textContent = audio ? transcription?.status === 'ready' ? '원음과 실제 자동 전사를 저장했습니다. 받아쓴 말은 별도로 청취 확인해 주세요.' : transcription?.reason || '원음은 저장되었습니다. 받아쓰기가 없어도 직접 듣고 입력할 수 있습니다.' : s.mode === 'example' ? '청취 확인도 통제 예제의 가정으로 진행합니다.' : '녹음하거나 음성 파일을 선택해 원본을 먼저 저장하세요.';
  $('transcribe-original').hidden = !audio || transcription?.status === 'ready';
  $('review-confirmed-label').textContent = s.original.syntheticEvidence ? '이 통제 예제에서 정한 청취 결과를 확인합니다.' : '원음 전체를 듣고 들린 말을 확인했습니다.';
  $('original-time-check').hidden = !needsTimeReview(s.original);
  if (!preserveForms) $('original-time-confirmed').checked = s.original.performanceTimeConfirmed === true;
  const m = s.analysis.metrics;
  $('analysis-summary').innerHTML = `<strong>${m.accepted}개 반영</strong> · ${m.held}개 보류${m.excluded ? ` · ${m.excluded}개 사용 제외` : ''}`;
  renderCells(s.analysis.cells); renderActions(s); renderTimeline(s); renderChanges(previous, s, fresh);
  if (!preserveForms) $('purpose-select').value = s.purpose;
  const execution = s.analysis.execution;
  $('execution-details').innerHTML = (s.analysis.limits || []).map(x => `<p>${esc(x)}</p>`).join('') + (execution ? `<p>이번 서버 계산: ${esc(execution.cellCount)}개 항목 · ${esc(execution.hypothesisCount)}개 해석 · ${esc(execution.durationMs)} ms</p><p class="dependencies">계산 코드 지문 ${esc(execution.engineSha256)}</p><p>${esc(execution.scope)}</p>` : '');
  $('storage-state').textContent = `서버 저장 판본 v${s.revision} · ${time(s.updatedAt)}. 원음·사건·현재 판정을 같은 기록에서 다시 읽을 수 있습니다.`;
  $('export-link').href = `/api/sessions/${s.id}/export`; $('export-link').download = `SYNK-evidence-${s.id}.json`;
  $('last-help').hidden = !s.helpEvents.length;
  if (s.helpEvents.length) $('last-help').innerHTML = `<strong>최근 실제 제시 · ${esc(time(s.helpEvents.at(-1).at))}</strong>${esc(s.helpEvents.at(-1).text)}`;
  $('response-context').textContent = s.helpEvents.length ? '도움 뒤 다시 말한 답을 기록합니다. 파일은 도움 이후의 발화인지 따로 확인하며, 처음의 독립 수행을 소급해 확정하지 않습니다.' : '다시 말한 답을 별도로 기록합니다. 파일의 발화 시점은 따로 확인하며, 처음 말한 원음을 덮어쓰지 않습니다.';
  renderResponses(s, preserveForms);
  if (fresh) { fillForms(s); state.allEvents = false; }
  else if (!preserveForms && previous?.original.revisions.transcript !== s.original.revisions.transcript) $('machine-transcript').value = s.original.alternatives.map(a => a.text).join('\n');
  refreshSessionList(); syncControls();
}
function renderCells(cells) {
  const epochs = [...new Set(cells.map(c => c.evidenceEpoch || c.epoch))];
  $('cells').innerHTML = epochs.map(epoch => `<h3 class="epoch-heading">${epoch === 'e0' ? '처음 말한 시점' : '새 응답 시점'} <span>${esc(epoch)}</span></h3>${cells.filter(c => (c.evidenceEpoch || c.epoch) === epoch).map(c => `<article class="evidence-cell ${esc(c.status)}" data-cell="${esc(c.id)}"><div class="cell-meta"><span>${esc(purposeNames[c.purpose] || c.purpose)}${c.synthetic ? ' · 예제 가정' : ''}</span><span class="cell-status">${esc(statusNames[c.status] || c.status)}</span></div><h3>${esc(c.label)}</h3>${c.value ? `<p class="cell-value">${esc(c.value)}</p>` : ''}<p class="cell-reason">${esc(c.reason)}</p><details class="cell-details"><summary>판정에 연결된 근거 보기</summary>${c.witness?.length ? `<div class="witness">${c.witness.map(w => `<p>${esc(w.text)}<span>→ ${esc(w.effect)}</span></p>`).join('')}</div>` : ''}<p class="dependencies">${c.dependencies.map(esc).join(' · ')}</p>${c.assistance === 'after-help' ? '<p class="micro">도움 이후에 관측한 수행입니다.</p>' : ''}</details></article>`).join('')}`).join('');
}
function renderActions(s) {
  const destinations = { 'review-original': '.review-card', 'review-response': '#response-review-details', 'show-answer-and-respond': '.help-card', 'confirm-task-conditions': '.task-options' };
  $('suggested-actions').innerHTML = s.analysis.actions.filter(a => a.allowed && destinations[a.id]).map(a => `<button class="suggestion" data-destination="${destinations[a.id]}" aria-current="${s.analysis.selectedAction === a.id}"><span aria-hidden="true">↗</span>${esc(a.label)}</button>`).join('');
  const selected = s.analysis.actions.find(a => a.id === s.analysis.selectedAction);
  if (selected) $('suggested-actions').insertAdjacentHTML('beforeend', `<p class="action-reason">${esc(selected.reason)}${selected.cost?.basis === 'controlled-assumption-not-measured' ? ' 행동 비용은 이 시연에서 정한 비교용 가정입니다.' : ''}</p>`);
  $('suggested-actions').querySelectorAll('button').forEach(button => button.addEventListener('click', () => { const el = document.querySelector(button.dataset.destination); if (el instanceof HTMLDetailsElement) el.open = true; el?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
}
function eventDescription(e) {
  if (e.type === 'help-presented' || e.type === 'response-added' || e.type.startsWith('review-')) return e.text || e.alternatives?.map(a => a.text).join(' / ') || '실제 입력과 확인 내용을 저장했습니다.';
  if (e.type === 'transcripts-set') return `${e.source === 'machine' ? '자동 받아쓰기' : '직접 입력'} · ${(e.alternatives || []).map(a => a.text).join(' / ')}`;
  if (e.type === 'audio-attached') return `${e.role === 'response' ? '새 응답' : '처음 원음'} · ${Math.round((e.bytes || 0) / 1024)} KB · ${e.acquisition === 'microphone' ? '마이크 녹음 구간 기록' : '가져온 파일 · 발화 시점 별도 확인'}`;
  if (e.type === 'unknown-set') return e.enabled ? `미해결: ${e.reason || '관련 원인 미확인'}` : '현재 표시한 미해결 범위를 해제했습니다.';
  if (e.type === 'task-confirmed') return '문항 역할·과거형 독립성·도움 관측 범위의 확인 상태를 저장했습니다.';
  return '서버가 처리한 사건입니다.';
}
function renderTimeline(s) {
  const events = [...s.events].reverse(), visible = state.allEvents ? events : events.slice(0, 7);
  $('timeline-empty').hidden = events.length > 0; $('timeline-more').hidden = events.length <= 7;
  $('timeline-more').textContent = state.allEvents ? '최근 사건만 보기' : `전체 ${events.length}개 사건 보기`;
  $('timeline').innerHTML = visible.map(e => `<li><div class="timeline-heading"><h3>${esc(eventNames[e.type] || e.type)}</h3><time datetime="${esc(e.at || e.recordedAt)}">${esc(time(e.at || e.recordedAt))}</time></div><p>${esc(eventDescription(e))}</p><span class="event-revision">v${esc(e.revision)}</span></li>`).join('');
}
function renderChanges(previous, s, fresh) {
  const changes = !fresh && previous?.id === s.id ? s.analysis.cells.filter(c => changed(previous.analysis.cells.find(old => old.id === c.id), c)) : [];
  $('change-summary').hidden = !changes.length;
  $('change-summary').innerHTML = changes.length ? `<h3>이번 저장으로 달라진 판정</h3>${changes.slice(0, 5).map(c => { const old = previous.analysis.cells.find(x => x.id === c.id); return `<p>${esc(c.label)}<br><strong>${old ? esc(statusNames[old.status]) : '새 기록'} → ${esc(statusNames[c.status])}</strong></p>`; }).join('')}${changes.length > 5 ? `<p>그 밖에 ${changes.length - 5}개 항목이 변경되었습니다.</p>` : ''}` : '';
}
function renderResponses(s, preserveForms) {
  $('responses').innerHTML = s.responses.map(r => `<div class="response-item"><strong>새 응답 ${esc(r.epoch)}</strong><span class="small-tag">${!r.performanceTimeConfirmed ? '발화 시점 확인 전' : s.analysis.cells.some(c => c.utteranceId === r.id && c.assistance === 'after-help') ? '도움 이후' : '별도 시점'}</span><p>${r.alternatives.length ? r.alternatives.map(a => esc(a.text)).join('<br>') : '전사 확인 전'}</p>${r.audio ? audioHTML(r, `새 응답 ${r.epoch}`) : '<p class="micro">텍스트 입력 · 원음 없음</p>'}</div>`).join('');
  const selected = $('response-select').value;
  $('response-select').innerHTML = s.responses.map(r => `<option value="${esc(r.id)}">새 응답 ${esc(r.epoch)}${r.audio ? ' · 원음 있음' : ' · 텍스트만'}</option>`).join('');
  if (preserveForms && s.responses.some(r => r.id === selected)) $('response-select').value = selected;
  else if (s.responses.length) $('response-select').value = s.responses.at(-1).id;
  $('response-review-details').hidden = !s.responses.length;
  if (!preserveForms) selectResponse();
}
function selectResponse() {
  const r = state.session?.responses.find(x => x.id === $('response-select').value);
  $('response-review-player').innerHTML = audioHTML(r, '선택한 새 응답');
  $('response-review-text').value = r?.alternatives.map(a => a.text).join('\n') || '';
  $('response-review-confirmed').checked = false; syncControls();
  $('response-exposure-confirmed').checked = r?.exposureScopeConfirmed === true;
  $('response-time-check').hidden = !needsTimeReview(r);
  $('response-time-confirmed').checked = r?.performanceTimeConfirmed === true;
  $('response-time-label').textContent = state.session?.helpEvents.length ? '이 파일이 현재 기록한 도움 뒤에 새로 말한 응답임을 확인했습니다.' : '이 파일이 처음 시도와 구분되는 새 응답임을 확인했습니다.';
}
async function perform(operation, success, { retry = true, message = '변경을 서버에 저장했습니다.' } = {}) {
  if (state.busy || state.recording || state.recorderStarting) return false;
  state.busy = true; syncControls();
  try {
    const result = await operation(); state.retry = null; $('retry-bar').hidden = true;
    await success(result); setConnection(true, '로컬 서버 연결됨'); if (message) notice(message);
    return true;
  } catch (e) {
    if (e.status === 409 && state.session) {
      try { const latest = await api(`/api/sessions/${state.session.id}`); renderSession(latest, { preserveForms: true }); } catch { /* Keep the draft and prior record visible when the reload also fails. */ }
    }
    if (e.code === 'TOKEN') {
      try { const b = await api('/api/bootstrap'); state.bootstrap = b; state.token = b.token; } catch { /* The retry remains explicit after reconnecting. */ }
    }
    const canRetry = retry && (e.network || e.status === 409 || e.code === 'TOKEN' || !e.status) && !['IMMUTABLE_AUDIO', 'EVENT_CONFLICT'].includes(e.code);
    if (canRetry) { state.retry = () => perform(operation, success, { retry, message }); $('retry-bar').hidden = false; }
    else { state.retry = null; $('retry-bar').hidden = true; }
    if (state.pendingHelp) { $('help-save-state').textContent = '문장은 이미 화면에 제시됐지만 사건 저장을 확인하지 못했습니다. 같은 제시 사건을 다시 저장한 뒤 새 응답을 진행하세요.'; $('help-retry').hidden = !canRetry; }
    notice(e.status === 409 ? `${e.message} 최신 저장 내용을 불러왔습니다. 입력은 유지했습니다.` : e.message, true);
    if (e.network) setConnection(false, '연결 확인 필요'); return false;
  } finally { state.busy = false; syncControls(); }
}
function saveEvent(event, { after, message, onSuccess } = {}) {
  const sessionId = state.session.id, stamped = { id: uid(), ...event };
  return perform(() => api(`/api/sessions/${sessionId}/events`, { method: 'POST', body: JSON.stringify({ expectedRevision: state.session.revision, event: stamped }) }), s => { renderSession(s); after?.(); onSuccess?.(s); }, { message });
}
async function newSession(mode, extra = {}) {
  return perform(() => api('/api/sessions', { method: 'POST', body: JSON.stringify({ mode, ...(mode === 'example' ? { exampleId: $('example-select').value } : {}), ...extra }) }), s => { renderSession(s, { fresh: true }); }, { retry: false, message: mode === 'example' ? '통제 예제를 서버에 만들었습니다. 가정과 실제 녹음을 구분해 표시합니다.' : '새 녹음 시연을 만들었습니다. 원음을 녹음하거나 파일로 가져오세요.' });
}
function inferredMime(file) {
  if (file.type) return file.type;
  return ({ wav: 'audio/wav', mp3: 'audio/mpeg', m4a: 'audio/mp4', mp4: 'audio/mp4', webm: 'audio/webm', ogg: 'audio/ogg', flac: 'audio/flac' })[file.name?.split('.').at(-1).toLowerCase()] || 'application/octet-stream';
}
async function uploadAudio(blob, role, sessionId = state.session?.id, capture = { method: 'file' }) {
  if (!sessionId) return;
  if (blob.size > (state.bootstrap?.capabilities.audioLimitBytes || 20 * 1024 * 1024)) { notice('음성 파일은 20 MB 이하로 준비해 주세요.', true); return; }
  const eventId = uid(), mimeType = inferredMime(blob);
  notice('원음을 서버에 저장하고 실제 받아쓰기를 요청하고 있습니다. 완료될 때까지 이 시연을 유지합니다.');
  const captureHeaders = { 'X-Capture-Method': capture.method, ...(capture.method === 'microphone' ? { 'X-Capture-Started-At': capture.startedAt, 'X-Capture-Ended-At': capture.endedAt } : {}) };
  return perform(() => api(`/api/sessions/${sessionId}/audio?role=${role}`, { method: 'POST', headers: { 'Content-Type': mimeType, 'X-Expected-Revision': String(state.session.revision), 'X-Event-Id': eventId, ...captureHeaders }, body: blob }), s => {
    renderSession(s); if (role === 'response') $('response-review-details').open = true;
    $('review-confirmed').checked = false;
  }, { message: '원본 저장과 받아쓰기 처리 상태를 불러왔습니다. 자동 전사와 사람의 청취 확인은 분리됩니다.' });
}
async function startRecording(role) {
  if (state.busy || state.recording || state.recorderStarting || state.pendingHelp || !state.session) return;
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { notice('이 브라우저에서는 마이크 녹음을 사용할 수 없습니다. 음성 파일 선택으로 같은 저장 경로를 이용하세요.', true); return; }
  const sessionId = state.session.id; state.recorderStarting = true; syncControls();
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find(m => MediaRecorder.isTypeSupported(m));
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined), chunks = [];
    const capture = { recorder, stream, chunks, sessionId, role, startedAt: null, endedAt: null, cancelled: false, timer: null };
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    recorder.onerror = () => { capture.cancelled = true; notice('녹음을 계속할 수 없습니다. 마이크 연결을 확인한 뒤 다시 녹음해 주세요.', true); if (recorder.state !== 'inactive') recorder.stop(); };
    recorder.onstop = async () => {
      clearInterval(capture.timer); stream.getTracks().forEach(t => t.stop()); state.recording = null; $('recording-bar').hidden = true; syncControls();
      capture.endedAt ||= now();
      if (!capture.cancelled) { const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' }); if (blob.size) await uploadAudio(blob, capture.role, capture.sessionId, { method: 'microphone', startedAt: capture.startedAt, endedAt: capture.endedAt }); else notice('녹음 데이터가 없습니다. 다시 녹음해 주세요.', true); }
    };
    const startedAt = Date.now(); capture.startedAt = new Date(startedAt).toISOString(); recorder.start(1000); state.recording = capture; $('recording-label').textContent = role === 'original' ? '처음 원음 녹음 중' : '새 응답 녹음 중'; $('recording-time').textContent = '00:00'; $('recording-bar').hidden = false;
    capture.timer = setInterval(() => { const seconds = Math.floor((Date.now() - startedAt) / 1000); $('recording-time').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }, 500);
  } catch (e) { stream?.getTracks().forEach(t => t.stop()); notice(e.name === 'NotAllowedError' ? '마이크 권한이 허용되지 않았습니다. 주소창의 마이크 권한을 확인하거나 음성 파일을 선택하세요.' : '마이크를 열지 못했습니다. 연결을 확인하거나 음성 파일을 선택하세요.', true); }
  finally { state.recorderStarting = false; syncControls(); }
}
async function presentHelp() {
  if (!hasOriginal() || state.busy || state.recording || state.pendingHelp || !$('help-text').value.trim()) return;
  const sessionId = state.session.id, event = { id: uid(), type: 'help-presented', text: $('help-text').value.trim(), exposesAnswer: true };
  state.pendingHelp = { sessionId, event }; syncControls(); $('help-display').textContent = event.text;
  $('help-save-state').textContent = '화면에 도움을 보여 준 뒤 제시 사건을 저장하고 있습니다.'; $('help-retry').hidden = true; $('help-dialog').showModal();
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  event.at = now();
  await perform(() => api(`/api/sessions/${sessionId}/events`, { method: 'POST', body: JSON.stringify({ expectedRevision: state.session.revision, event }) }), s => {
    state.pendingHelp = null; renderSession(s); $('help-save-state').textContent = '이 화면에 도움을 제시한 사건이 서버에 저장됐습니다. 이후 응답은 새 시점의 수행으로 기록합니다.'; $('help-retry').hidden = true;
  }, { message: '도움의 실제 제시 사건을 저장했습니다. 다음 응답은 새로운 시점입니다.' });
}
async function compare() {
  await perform(() => api(`/api/sessions/${state.session.id}/comparison`), data => {
    const baseline = data.baseline, variants = data.comparisons;
    $('comparison-content').innerHTML = `<p class="field-help">현재 세션 v${esc(data.revision)} · 동일 입력 재계산</p><div class="table-scroll"><table class="comparison-table"><thead><tr><th>처리 방식</th><th>반영</th><th>보류</th><th>사용 제외</th><th>본 규칙과 달라진 항목</th></tr></thead><tbody><tr class="baseline"><td>현재의 근거 연결</td><td>${baseline.metrics.accepted}</td><td>${baseline.metrics.held}</td><td>${baseline.metrics.excluded}</td><td>기준</td></tr>${variants.map(v => `<tr><td>${esc(comparisonNames[v.id || v.ablation] || v.id)}</td><td>${v.metrics.accepted}</td><td>${v.metrics.held}</td><td>${v.metrics.excluded}</td><td>${v.comparedWithMain.changedCells.length}개${v.comparedWithMain.selectedActionChanged ? ' · 확인 행동 변경' : ''}</td></tr>`).join('')}</tbody></table></div><div class="comparison-explanation">${variants.map(v => `<p><strong>${esc(comparisonNames[v.id || v.ablation])}</strong> — ${v.comparedWithMain.promotedWithoutMainSupport}개가 본 규칙의 지지 없이 반영되고, ${v.comparedWithMain.retainedRecordsLost}개의 유지 기록이 사라집니다.${v.comparedWithMain.selectedActionChanged ? ' 선택한 확인 행동도 달라집니다.' : ''}</p>`).join('')}</div>`;
    $('comparison-dialog').showModal();
  }, { retry: false, message: '' });
}

$('mode-example').addEventListener('click', () => setMode('example'));
$('mode-recording').addEventListener('click', () => setMode('recording'));
$('example-select').addEventListener('change', updateExampleDescription);
$('create-example').addEventListener('click', () => newSession('example'));
$('create-recording').addEventListener('click', () => newSession('recording'));
$('create-sample').addEventListener('click', async () => {
  const sample = state.bootstrap.samples?.[0]; if (!sample || !/^\/api\/samples\/[a-zA-Z0-9_.-]+$/.test(sample.url)) return;
  if (!await newSession('recording', { sourceKind: 'synthetic-speech', sampleName: sample.name })) return;
  state.busy = true; syncControls(); let blob;
  try { const response = await fetch(sample.url); if (!response.ok) throw new Error(); blob = await response.blob(); }
  catch { notice('합성 음성 파일을 읽지 못했습니다. 서버 연결을 확인해 주세요.', true); }
  finally { state.busy = false; syncControls(); }
  if (blob) await uploadAudio(blob, 'original');
});
$('session-select').addEventListener('change', () => { const id = $('session-select').value; if (id) perform(() => api(`/api/sessions/${id}`), s => renderSession(s, { fresh: true }), { retry: false, message: '서버에 저장된 시연을 불러왔습니다.' }); });
$('refresh-button').addEventListener('click', () => state.session ? perform(() => api(`/api/sessions/${state.session.id}`), s => renderSession(s, { preserveForms: true }), { retry: false, message: '최신 서버 기록을 읽었습니다. 작성 중인 입력은 유지합니다.' }) : boot());
$('notice-close').addEventListener('click', () => { $('notice').hidden = true; });
$('retry-button').addEventListener('click', () => state.retry?.());
$('help-retry').addEventListener('click', () => state.retry?.());
['machine-transcript', 'review-text', 'review-confirmed', 'help-text', 'response-text', 'response-review-text', 'response-review-confirmed'].forEach(id => $(id).addEventListener('input', syncControls));
$('save-transcript').addEventListener('click', () => saveEvent({ type: 'transcripts-set', role: 'original', alternatives: $('machine-transcript').value.split('\n').map(text => ({ text: text.trim() })).filter(x => x.text), source: 'human', scopeConfirmed: false, confirmed: false }, { message: '직접 적은 전사 후보를 저장했습니다. 원음 청취 확인과는 구분합니다.' }));
$('save-task').addEventListener('click', () => saveEvent({ type: 'task-confirmed', roleConfirmed: $('role-confirmed').checked, pastIndependent: $('past-independent').checked, exposureScopeConfirmed: $('exposure-confirmed').checked }));
$('save-unknown').addEventListener('click', () => saveEvent({ type: 'unknown-set', enabled: $('unknown-enabled').checked, kind: $('unknown-kind').value, reason: $('unknown-reason').value.trim() }));
$('save-purpose').addEventListener('click', () => saveEvent({ type: 'purpose-set', purpose: $('purpose-select').value }));
$('review-original').addEventListener('click', () => saveEvent({ type: 'review-original', text: $('review-text').value.trim(), confirmed: true, scopeConfirmed: true, ...timeReview(state.session.original, 'original-time-confirmed') }, { after: () => { $('review-confirmed').checked = false; }, message: '청취 확인을 저장하고, 그 근거에 연결된 항목을 다시 판단했습니다.' }));
$('present-help').addEventListener('click', presentHelp);
$('help-continue').addEventListener('click', () => { if (state.pendingHelp) return; $('help-dialog').close(); document.querySelector('.response-card').scrollIntoView({ behavior: 'smooth', block: 'start' }); $('response-text').focus({ preventScroll: true }); });
$('help-dialog').addEventListener('cancel', e => { if (state.pendingHelp) e.preventDefault(); });
$('help-dialog').querySelector('form').addEventListener('submit', e => { if (state.pendingHelp) e.preventDefault(); });
$('add-response').addEventListener('click', () => saveEvent({ type: 'response-added', text: $('response-text').value.trim(), confirmed: false, scopeConfirmed: false }, { after: () => { $('response-text').value = ''; }, message: '새 응답을 별도 시점에 저장했습니다. 텍스트만 입력한 응답은 실제 음성의 증거로 확정하지 않습니다.' }));
$('response-select').addEventListener('change', selectResponse);
$('review-response').addEventListener('click', () => saveEvent({ type: 'review-response', responseId: $('response-select').value, text: $('response-review-text').value.trim(), confirmed: true, scopeConfirmed: true, exposureScopeConfirmed: $('response-exposure-confirmed').checked, ...timeReview(state.session.responses.find(r => r.id === $('response-select').value), 'response-time-confirmed') }, { after: () => { $('response-review-confirmed').checked = false; } }));
$('record-original').addEventListener('click', () => startRecording('original')); $('record-response').addEventListener('click', () => startRecording('response'));
['original', 'response'].forEach(role => $(`file-${role}`).addEventListener('change', e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) uploadAudio(file, role); }));
$('stop-recording').addEventListener('click', () => { if (state.recording?.recorder.state === 'recording') { state.recording.endedAt = now(); state.recording.recorder.stop(); } });
$('cancel-recording').addEventListener('click', () => { if (state.recording) { state.recording.cancelled = true; state.recording.recorder.stop(); notice('녹음을 취소했습니다. 서버에 저장하지 않았습니다.'); } });
$('transcribe-original').addEventListener('click', () => { const id = state.session.id, audioRef = state.session.original.audio.audioRef, audioEventId = audioFor(state.session.original)?.audioEventId; perform(() => api(`/api/sessions/${id}/transcribe`, { method: 'POST', body: JSON.stringify({ expectedRevision: state.session.revision, audioRef, audioEventId }) }), s => renderSession(s), { message: '저장된 원음의 받아쓰기 상태를 다시 확인했습니다.' }); });
$('timeline-more').addEventListener('click', () => { state.allEvents = !state.allEvents; renderTimeline(state.session); });
$('comparison-button').addEventListener('click', compare);
window.addEventListener('beforeunload', e => { if (state.recording || state.busy || state.pendingHelp || state.retry) { e.preventDefault(); e.returnValue = ''; } });
boot();
