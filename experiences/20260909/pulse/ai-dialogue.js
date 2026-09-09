// A separate, persistent island: shared game updates never replace this input.
const mount = document.getElementById('npc-dialogue');
if (mount) {
  let session = null, state = null, request = null, generation = 0, open = false, available = false;
  const conversations = new Map();
  const el = (tag, className, text) => { const n = document.createElement(tag); if (className) n.className = className; if (text) n.textContent = text; return n; };
  const toggle = el('button', 'button ghost small npc-toggle', '다온에게 말 걸기'); toggle.type = 'button'; toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-controls', 'npc-conversation');
  const panel = el('section', 'npc-conversation surface'); panel.id = 'npc-conversation'; panel.hidden = true; panel.setAttribute('aria-label', '밤 안내인 다온과 AI 대화');
  const head = el('div', 'npc-head'), identity = el('div'); identity.append(el('span', 'eyebrow', '이 밤의 동행'), el('h2', '', '다온'));
  const close = el('button', 'text-button', '닫기'); close.type = 'button'; head.append(identity, close);
  const explanation = el('p', 'npc-caption', 'AI가 지금의 탐색에 맞춰 답해요. 이 역할만 보는 대화이며, 함께 모은 기록에서 사실을 확인할 수 있어요.');
  const log = el('div', 'npc-log'); log.setAttribute('role', 'log'); log.setAttribute('aria-label', '다온과 나눈 대화'); log.setAttribute('aria-live', 'off');
  const quick = el('div', 'npc-questions');
  for (const text of ['지금 어디부터 살펴볼까요?', '이 도시의 밤은 어떤가요?']) {
    const b = el('button', 'text-button', text); b.type = 'button'; b.addEventListener('click', () => { input.value = text; form.requestSubmit(); }); quick.append(b);
  }
  const form = el('form', 'npc-form'); const label = el('label', '', '다온에게 건넬 말'); label.htmlFor = 'npc-input';
  const input = el('input'); input.id = 'npc-input'; input.type = 'text'; input.maxLength = 500; input.autocomplete = 'off'; input.placeholder = '궁금한 것, 지금 떠오르는 생각';
  const send = el('button', 'button primary small', '말 건네기'); send.type = 'submit';
  const cancel = el('button', 'text-button', '답변 멈추기'); cancel.type = 'button'; cancel.hidden = true;
  const status = el('p', 'npc-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const read = el('button', 'text-button npc-read', '마지막 답변 읽어주기'); read.type = 'button'; read.hidden = true;
  const notice = el('p', 'npc-footnote', '기기 안에서 생성 · 대화는 서버가 켜진 동안만 유지');
  form.append(label, input, send, cancel); panel.append(head, explanation, log, quick, form, status, read, notice); mount.replaceChildren(toggle, panel); mount.hidden = true;

  const key = () => state && session ? `${session.code}:${state.me.id}` : null;
  function speakCancel() { window.speechSynthesis?.cancel(); read.textContent = '마지막 답변 읽어주기'; }
  function endRequest() { request?.abort(); request = null; cancel.hidden = true; send.disabled = !available; quick.querySelectorAll('button').forEach(b => { b.disabled = !available; }); }
  function show(value) { open = value; panel.hidden = !value; toggle.setAttribute('aria-expanded', String(value)); if (value) { input.focus(); refreshStatus(); } else { speakCancel(); toggle.focus(); } }
  toggle.addEventListener('click', () => show(!open)); close.addEventListener('click', () => show(false));
  panel.addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); show(false); } });
  cancel.addEventListener('click', () => { endRequest(); status.textContent = '답변을 멈췄어요. 다시 말을 걸 수 있습니다.'; });
  function appendMessage(role, text) {
    const item = el('article', `npc-message ${role}`); item.append(el('strong', '', role === 'user' ? '나' : '다온'));
    const body = el('p', '', text); item.append(body); log.append(item);
    while (log.children.length > 8) log.firstElementChild.remove();
    log.scrollTop = log.scrollHeight; return body;
  }
  function restoreLog() { log.replaceChildren(); for (const item of conversations.get(key()) || []) appendMessage(item.role, item.text); read.hidden = !(conversations.get(key()) || []).some(x => x.role === 'assistant'); }
  async function refreshStatus() {
    if (!session || !state || state.phase === 'lobby') return;
    const current = generation;
    try {
      const response = await fetch(`/api/rooms/${session.code}/dialogue`, { headers: { Authorization: `Bearer ${session.token}` }, cache: 'no-store', signal: AbortSignal.timeout(5000) });
      if (current !== generation) return;
      if (!response.ok) throw new Error('offline');
      const data = await response.json(); available = data.available === true;
      if (!request) status.textContent = available ? '궁금한 것을 물어보세요. 첫 답변은 AI 준비 시간이 조금 필요해요.' : '이 기기의 AI가 아직 준비되지 않았어요. 장소 안의 단계 힌트로 계속할 수 있습니다.';
    } catch { if (current !== generation) return; available = false; status.textContent = '다온과 연결하지 못했어요. 다시 열면 연결을 확인합니다.'; }
    if (!request) send.disabled = !available;
    quick.querySelectorAll('button').forEach(b => { b.disabled = !available || Boolean(request); });
  }
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (!session || !state || request || !available) return;
    const text = input.value.trim(); if (!text) { input.focus(); return; }
    const current = generation, conversationKey = key(), credentials = { ...session }, controller = new AbortController(); request = controller;
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 85000);
    input.value = ''; send.disabled = true; cancel.hidden = false; quick.querySelectorAll('button').forEach(b => { b.disabled = true; }); speakCancel();
    const history = conversations.get(conversationKey) || [];
    history.push({ role: 'user', text }); conversations.set(conversationKey, history.slice(-8)); appendMessage('user', text);
    const answer = appendMessage('assistant', ''); let result = '', finished = false;
    status.textContent = '다온을 부르고 있어요…';
    try {
      const response = await fetch(`/api/rooms/${credentials.code}/dialogue`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${credentials.token}` }, body: JSON.stringify({ text }), signal: controller.signal, cache: 'no-store' });
      if (!response.ok) { const error = await response.json(); throw new Error(error.error || '대화를 시작하지 못했어요.'); }
      let buffer = ''; const decoder = new TextDecoder(); let eventName = '';
      for await (const chunk of response.body) {
        if (current !== generation || controller.signal.aborted) break;
        buffer += decoder.decode(chunk, { stream: true }); let lineEnd;
        while ((lineEnd = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, lineEnd).trim(); buffer = buffer.slice(lineEnd + 1);
          if (line.startsWith('event:')) eventName = line.slice(6).trim();
          if (!line.startsWith('data:')) continue;
          const data = JSON.parse(line.slice(5));
          if (eventName === 'status') status.textContent = data.message;
          if (eventName === 'delta') { result += data.text; answer.textContent = result; log.scrollTop = log.scrollHeight; }
          if (eventName === 'done') { result = data.text; answer.textContent = result; finished = true; }
          if (eventName === 'error') throw new Error(data.error);
        }
      }
      if (current !== generation) return;
      if (!finished) throw new Error(controller.signal.aborted ? '답변을 멈췄어요.' : '대화 연결이 끊겼어요. 다시 말을 걸어 주세요.');
      conversations.set(conversationKey, [...(conversations.get(conversationKey) || []), { role: 'assistant', text: result }].slice(-8));
      status.textContent = '다온의 답변이 도착했어요.'; read.hidden = false;
    } catch (error) {
      if (current !== generation) return;
      if (!result) answer.textContent = '아직 답변을 받지 못했어요.';
      status.textContent = timedOut ? 'AI 답변의 대기 시간이 지났어요. 잠시 뒤 다시 말을 걸어 주세요.' : controller.signal.aborted ? '답변을 멈췄어요. 다시 말을 걸 수 있습니다.' : error.message;
    } finally {
      clearTimeout(timeout);
      if (current === generation && request === controller) endRequest();
    }
  });
  read.addEventListener('click', () => {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) { status.textContent = '이 브라우저는 읽어주기를 지원하지 않아요. 글로 읽을 수 있습니다.'; return; }
    if (speechSynthesis.speaking) { speakCancel(); return; }
    const latest = [...(conversations.get(key()) || [])].reverse().find(x => x.role === 'assistant'); if (!latest) return;
    const speech = new SpeechSynthesisUtterance(latest.text); speech.lang = 'ko-KR'; speech.rate = .94; speech.volume = .8;
    speech.onend = speakCancel; speech.onerror = () => { speakCancel(); status.textContent = '기기 음성으로 읽지 못했어요. 대사는 글로 남아 있습니다.'; };
    speechSynthesis.speak(speech); read.textContent = '읽어주기 멈추기'; status.textContent = '기기의 한국어 음성으로 읽어요.';
  });
  window.addEventListener('pulse:session', event => {
    const next = event.detail;
    if (next?.code === session?.code && next?.token === session?.token) return;
    generation++; endRequest(); speakCancel(); session = next; available = false; status.textContent = ''; log.replaceChildren(); input.value = ''; read.hidden = true;
    mount.hidden = !session; if (!session) { panel.hidden = true; open = false; toggle.setAttribute('aria-expanded', 'false'); }
  });
  window.addEventListener('pulse:state', event => {
    const previousKey = key(), previousPhase = state?.phase; state = event.detail;
    if (state?.phase === 'lobby' && previousPhase && previousPhase !== 'lobby') {
      for (const entry of conversations.keys()) if (entry.startsWith(state.code + ':')) conversations.delete(entry);
      log.replaceChildren(); read.hidden = true; input.value = ''; generation++;
    }
    mount.hidden = !session || !state || state.phase === 'lobby';
    if (mount.hidden) { endRequest(); speakCancel(); return; }
    if (previousKey !== key()) { generation++; endRequest(); speakCancel(); restoreLog(); refreshStatus(); }
    if (previousPhase !== state.phase && request) { generation++; endRequest(); status.textContent = '이야기가 다음 장면으로 이어졌어요. 지금의 다온에게 다시 말을 걸어 보세요.'; }
  });
  window.addEventListener('pagehide', () => { endRequest(); speakCancel(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) speakCancel(); });
  window.dispatchEvent(new Event('pulse:request-context'));
}
