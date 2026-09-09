const $ = id => document.getElementById(id);
const roles = {
  signal: { title: '전차 정비사', objectId: 'tram', description: '도시 아래로 이어지는 전선의 길을 알고 있습니다.' },
  archive: { title: '방송 기록원', objectId: 'radio', description: '방송이 끊기기 전, 마지막 목소리를 기억합니다.' },
  coast: { title: '등대 감시인', objectId: 'buoy', description: '파도가 잦아든 뒤, 항구에 남은 소식을 살핍니다.' },
  courier: { title: '우편 배달인', objectId: 'postbox', description: '아직 전하지 못한 편지의 도착지를 알고 있습니다.' }
};
// Private evidence and authored endings only arrive from the authenticated server.
const storageKey = 'synk-pulse-last-light-v1';
let room = null, state = null, eventSource = null, world = null, generation = 0;
let selectedObject = null, showVoting = false, formMode = 'create', toastTimer = null;
let paused = false;
let checkingRoom = false, eventErrors = 0;
const accessibility = window.SynkA11y?.install({motionSelect:$('motion-choice'),onMotionChange:({reduced})=>world?.setReducedMotion(reduced)});
const pendingActions = new Set();
const invitation = (new URLSearchParams(location.search).get('room') || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6);
function node(tag, className, text) { const el = document.createElement(tag); if (className) el.className = className; if (text != null) el.textContent = text; return el; }
function displayError(message) { $('error-message').textContent = message; $('error').hidden = false; }
function toast(message) { clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false; toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4000); }
function persist() { try { room ? sessionStorage.setItem(storageKey, JSON.stringify(room)) : sessionStorage.removeItem(storageKey); } catch { /* Current-page play works if storage is unavailable. */ } }
function activePlayer() { return room?.players[room.active || 0]; }
function inviteUrl() { const url = new URL(location.href); url.search = ''; url.searchParams.set('room', room.code); return url.href; }
function setConnection(value) { $('connection').hidden = !room; $('connection').dataset.status = value; $('connection').querySelector('span').textContent = value === 'online' ? '함께 연결됨' : value === 'offline' ? '연결 다시 시도 중' : '연결 중'; }
async function request(path, { token, body } = {}) {
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const headers = { 'Content-Type': 'application/json' }; if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body || {}), signal: controller.signal, cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) { const err = new Error(data.error || '요청을 마치지 못했습니다. 다시 시도해 주세요.'); err.status = response.status; throw err; }
    return data;
  } catch (err) { if (err.name === 'AbortError' || err instanceof TypeError) throw new Error('도시에 연결하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.'); throw err; }
  finally { clearTimeout(timeout); }
}
function acceptState(next) {
  if (!room || next.me?.id !== activePlayer()?.playerId || next.code !== room.code) return;
  if (state?.me.id === next.me.id && next.revision < state.revision) return;
  const oldPhase = state?.phase; state = next;
  if (next.phase === 'lobby') { showVoting = false; selectedObject = null; }
  if (oldPhase === 'lobby' && next.phase === 'explore') { selectedObject = null; toast('먼저 나의 역할이 알아볼 수 있는 물건을 찾아보세요.'); }
  render();
  if(oldPhase!=='ended'&&next.phase==='ended'){$('panel-body').scrollTop=0;$('story-panel').classList.remove('collapsed');$('panel-collapse').setAttribute('aria-expanded','true');$('story-panel').focus({preventScroll:true});}
}
function connect() {
  eventSource?.close(); if (!room) return;
  const current = ++generation; const player = activePlayer(); setConnection('connecting');
  eventSource = new EventSource(`/api/rooms/${encodeURIComponent(room.code)}/events?token=${encodeURIComponent(player.token)}`);
  eventSource.addEventListener('state', event => { if (current !== generation) return; try { acceptState(JSON.parse(event.data)); setConnection('online'); } catch { displayError('이야기를 읽지 못했습니다. 새로고침하면 현재 역할로 다시 연결합니다.'); } });
  eventSource.onopen = () => { if (current === generation) {setConnection('online');eventErrors=0;} };
  eventSource.onerror = () => { if (current === generation) {setConnection('offline');if(++eventErrors>=2)checkRoom(current);} };
  checkRoom(current);
}
async function checkRoom(current) {
  if(checkingRoom||!room)return;checkingRoom=true;
  const actor=activePlayer(),code=room.code,controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
  try {
    const response=await fetch(`/api/rooms/${encodeURIComponent(code)}`,{headers:{Authorization:`Bearer ${actor.token}`},cache:'no-store',signal:controller.signal});
    if(current!==generation)return;
    if(response.status===401||response.status===404){eventSource?.close();setConnection('offline');$('recover-room').hidden=false;displayError(response.status===404?'이 방은 더 이상 열려 있지 않습니다. 새 방에서 새로운 밤을 시작할 수 있어요.':'이 역할의 자리가 정리되었습니다. 동료의 새 초대나 새로운 방으로 시작해 주세요.');}
    else if(response.ok){const result=await response.json();acceptState(result.state);$('recover-room').hidden=true;}
  } catch { /* A temporary network failure keeps the existing seat and EventSource retry. */ }
  finally {checkingRoom=false;clearTimeout(timeout);}
}
async function action(type, payload = {}, button) {
  if (!room || !state) return false;
  const player = activePlayer(), key = `${player.playerId}:${type}:${JSON.stringify(payload)}`;
  if (pendingActions.has(key)) return false;
  pendingActions.add(key); if (button) button.disabled = true; $('error').hidden = true;
  try { const result = await request(`/api/rooms/${encodeURIComponent(room.code)}/actions`, { token: player.token, body: { type, payload } }); if (activePlayer()?.playerId === player.playerId) acceptState(result.state); return true; }
  catch (err) { displayError(err.message); return false; }
  finally { pendingActions.delete(key); if (button?.isConnected) button.disabled = false; if (state) render(); }
}
function setRoom(result) {
  room = { code: result.code, active: 0, players: [{ token: result.token, playerId: result.playerId, role: result.state.me.role, name: result.state.me.name }] };
  state = null; persist(); acceptState(result.state); connect(); const url = new URL(location.href); url.search = ''; history.replaceState(null, '', url); $('story-panel').focus({ preventScroll: true });
}
function openForm(mode) {
  formMode = mode; $('entry-main').hidden = true; $('room-form').hidden = false; $('code-label').hidden = mode !== 'join'; $('code-input').required = mode === 'join';
  $('form-title').textContent = mode === 'join' ? '이 밤에 합류하기' : '동료를 기다릴 자리';
  $('form-submit').replaceChildren(document.createTextNode(mode === 'join' ? '함께 들어가기' : '방 만들기'), node('span', '', '↗'));
  if (mode === 'join') $('role-input').value = 'archive'; $('role-description').textContent = roles[$('role-input').value].description;
  if (invitation) $('code-input').value = invitation;
  (mode === 'join' && !$('code-input').value ? $('code-input') : $('name-input')).focus();
}
$('create-open').addEventListener('click', () => openForm('create'));
$('join-open').addEventListener('click', () => openForm('join'));
$('form-back').addEventListener('click', () => { $('room-form').hidden = true; $('entry-main').hidden = false; $('create-open').focus(); });
$('role-input').addEventListener('change', () => { $('role-description').textContent = roles[$('role-input').value].description; });
$('code-input').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ''); });
$('room-form').addEventListener('submit', async e => {
  e.preventDefault(); $('form-submit').disabled = true; $('error').hidden = true;
  try {
    const code = $('code-input').value.trim().toUpperCase(); if (formMode === 'join' && !/^[A-Z2-9]{6}$/.test(code)) throw new Error('초대 코드 여섯 자리를 확인해 주세요.');
    setRoom(await request(formMode === 'join' ? `/api/rooms/${code}/join` : '/api/rooms', { body: { name: $('name-input').value.trim(), role: $('role-input').value } }));
  } catch (err) { displayError(err.message); } finally { $('form-submit').disabled = false; }
});
$('dual-start').addEventListener('click', async () => {
  const button = $('dual-start'); button.disabled = true; $('error').hidden = true;
  try {
    const first = await request('/api/rooms', { body: { name: '정비사', role: 'signal' } }); setRoom(first);
    const second = await request(`/api/rooms/${first.code}/join`, { body: { name: '기록원', role: 'archive' } });
    room.players.push({ token: second.token, playerId: second.playerId, role: 'archive', name: '기록원' }); persist(); await action('start'); toast('두 역할을 바꿔 가며 체험하세요. 역할마다 다른 단서가 도착합니다.');
  } catch (err) { displayError(err.message); } finally { button.disabled = false; }
});
async function copyInvite() { if (!room) return; try { await navigator.clipboard.writeText(inviteUrl()); toast('초대 링크를 복사했습니다. 동료에게 전해 주세요.'); } catch { displayError(`초대 코드는 ${room.code}입니다. 같은 주소를 연 동료가 이 코드로 들어올 수 있습니다.`); } }
$('room-button').addEventListener('click', copyInvite); $('invite-copy').addEventListener('click', copyInvite);
$('start-story').addEventListener('click', e => action('start', {}, e.currentTarget)); $('finalize').addEventListener('click', e => action('finalize', {}, e.currentTarget));
$('open-vote').addEventListener('click', () => { showVoting = true; render(); $('panel-body').scrollTop = 0; });
$('back-evidence').addEventListener('click', () => { showVoting = false; render(); $('evidence-book').open = true; });
$('error-close').addEventListener('click', () => { $('error').hidden = true; });
$('recover-room').addEventListener('click',()=>{eventSource?.close();room=null;state=null;persist();const url=new URL(location.href);url.search='';location.href=url.href;});
$('panel-collapse').addEventListener('click', () => { const collapsed = $('story-panel').classList.toggle('collapsed'); $('panel-collapse').setAttribute('aria-expanded', String(!collapsed)); $('panel-collapse').setAttribute('aria-label', collapsed ? '이야기 패널 펼치기' : '이야기 패널 접기'); });
$('display-toggle').addEventListener('click', () => { const open = $('display-panel').hidden; $('display-panel').hidden = !open; $('display-toggle').setAttribute('aria-expanded', String(open)); });
$('scene-only').addEventListener('click', () => { $('experience').classList.add('scene-only'); $('restore-ui').hidden = false; $('restore-ui').focus(); });
$('restore-ui').addEventListener('click', () => { $('experience').classList.remove('scene-only'); $('restore-ui').hidden = true; $('display-panel').hidden = true; $('display-toggle').setAttribute('aria-expanded', 'false'); $('display-toggle').focus(); });
$('camera-mode').addEventListener('change', e => world?.focus(e.target.value)); $('quality').addEventListener('change', e => world?.setQuality(e.target.value));
$('leave-room').addEventListener('click', () => { paused=true;persist();$('entry').hidden=false;$('entry-main').hidden=true;$('room-form').hidden=true;$('resume-actions').hidden=false;$('story-panel').hidden=true;$('role-label').hidden=true;$('display-panel').hidden=true;$('display-toggle').setAttribute('aria-expanded','false');$('experience').dataset.phase='entry';world?.setPhase('entry');world?.focus('street');$('resume-room').focus(); });
$('resume-room').addEventListener('click',()=>{paused=false;$('resume-actions').hidden=true;render();$('story-panel').focus({preventScroll:true});});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if ($('experience').classList.contains('scene-only')) $('restore-ui').click(); else { $('display-panel').hidden = true; $('display-toggle').setAttribute('aria-expanded', 'false'); $('error').hidden = true; } } });
async function inspect(objectId) {
  world?.focus(objectId); if (!state || state.phase === 'lobby' || state.phase === 'ended') return;
  selectedObject = objectId; showVoting = false; $('story-panel').classList.remove('collapsed'); $('panel-collapse').setAttribute('aria-expanded', 'true');
  if (!state.inspected.includes(objectId)) await action('inspect', { objectId }); else render();
  $('object-card').scrollIntoView({ block: 'nearest', behavior: 'instant' });
}
function renderPlayers() {
  $('players').replaceChildren(...state.players.map((p, i) => {
    const el = node('div', 'player'); el.dataset.me = String(p.id === state.me.id); el.append(node('span', 'player-orb', String(i + 1).padStart(2, '0')));
    const text = node('div'); text.append(node('strong', '', `${p.name}${p.id === state.me.id ? ' · 나' : ''}`), node('small', '', roles[p.role]?.title || p.role)); el.append(text); return el;
  }));
  $('role-switch').hidden = room.players.length < 2;
  if (room.players.length > 1) $('role-switch').replaceChildren(...room.players.map((p, index) => {
    const b = node('button', '', roles[p.role]?.title || p.role); b.setAttribute('aria-pressed', String(index === room.active)); b.append(node('small', '', index === room.active ? '지금 보고 있는 역할' : '이 역할의 화면으로'));
    b.addEventListener('click', () => {
      if (room.active === index) return; room.active = index; persist(); selectedObject = null; state = null;
      $('object-card').replaceChildren(); $('object-card').hidden = true; $('shared-clues').replaceChildren(); $('choices').replaceChildren(); $('objective').textContent = '다른 역할의 기록을 펼치는 중입니다.'; $('current-role').textContent = roles[p.role].title; connect();
    }); return b;
  }));
}
function renderObjects() {
  const ownId = roles[state.me.role].objectId;
  $('object-nav').replaceChildren(...state.objects.map((o, i) => { const b = node('button'); b.append(node('span', '', String(i + 1).padStart(2, '0')), document.createTextNode(o.title)); b.dataset.own = String(o.id === ownId); b.setAttribute('aria-pressed', String(selectedObject === o.id)); b.addEventListener('click', () => inspect(o.id)); return b; }));
  const object = state.objects.find(o => o.id === selectedObject); $('object-card').hidden = !object; if (!object) return;
  const contents = [node('span', 'card-label', selectedObject === ownId ? '나의 역할이 알아본 것' : '거리에서 발견한 것'), node('h3', '', object.title), node('p', '', object.description)];
  const clues = (state.privateClues || []).filter(c => c.objectId === object.id);
  if (clues.length) {
    for (const clue of clues) {
      const part = node('section', 'private-clue'); part.append(node('h3', '', clue.title), node('p', '', clue.text));
      const b = node('button', `button ${clue.shared ? 'ghost' : 'primary'}`, clue.shared ? '동료에게 공유했어요 ✓' : '이 단서 함께 나누기 →'); b.disabled = clue.shared;
      b.addEventListener('click', async () => { if (await action('share', { clueId: clue.id }, b)) toast('이 단서가 모두의 기록에 더해졌습니다.'); }); part.append(b); contents.push(part);
    }
    contents.push(node('p', 'private-note', '공유하기 전에는 이 역할에게만 보이는 단서입니다.'));
  } else { const role = Object.values(roles).find(r => r.objectId === object.id); contents.push(node('p', 'private-note', state.inspected.includes(object.id) ? `${role.title}라면 이곳에서 더 많은 것을 알아볼 수 있습니다.` : '물건을 살피고 있습니다.')); }
  $('object-card').replaceChildren(...contents);
}
function renderShared() {
  $('shared-count').textContent = `${state.sharedClues.length}`;
  if (!state.sharedClues.length) { $('shared-clues').replaceChildren(node('p', 'small-copy', '아직 함께 나눈 단서가 없습니다. 자기 역할의 장소를 살펴보세요.')); return; }
  $('shared-clues').replaceChildren(...state.sharedClues.map(c => { const a = node('article', 'shared-clue'); a.append(node('small', '', roles[c.role]?.title || '함께 발견'), node('h3', '', c.title), node('p', '', c.text)); return a; }));
}
function renderChoices() {
  $('choices').replaceChildren(...state.choiceOptions.map(c => {
    const b = node('button', 'choice'); b.dataset.choice = c.id; b.setAttribute('aria-pressed', String(state.votes[state.me.id] === c.id)); b.append(node('strong', '', c.title), node('p', '', c.description));
    const voters = state.players.filter(p => state.votes[p.id] === c.id).map(p => p.name); b.append(node('div', 'voters', voters.length ? `${voters.join(', ')}의 선택` : '아직 선택한 동료가 없습니다')); b.addEventListener('click', () => action('vote', { choiceId: c.id }, b)); return b;
  }));
  const count = Object.keys(state.votes).length;
  $('consensus').textContent = state.voteFinalizable ? state.me.host ? '모두 같은 곳을 골랐습니다. 준비가 되면 불빛을 보내세요.' : '모두 같은 곳을 골랐습니다. 방을 만든 동료가 불빛을 보낼 차례입니다.' : count < state.players.length ? `${state.players.length}명 중 ${count}명이 골랐습니다. 서로의 선택을 보고 이야기해 보세요.` : '아직 서로 다른 곳을 보고 있습니다. 단서를 다시 읽고, 함께 고를 곳을 이야기해 보세요.';
  $('finalize').disabled = !state.voteFinalizable || !state.me.host;
}
function renderEnding() {
  const ending = state.ending; if (!ending) return;
  const fragment = document.createDocumentFragment(); fragment.append(node('div', 'ending-rule'), node('h3', '', ending.title), node('p', '', ending.body)); if (ending.epilogue) fragment.append(node('p', 'truth', ending.epilogue));
  const actions = node('div', 'ending-actions'); const look = node('button', 'button primary', '우리가 남긴 장면 감상 ↗'); look.addEventListener('click', () => { world?.focus(ending.choiceId); $('scene-only').click(); }); actions.append(look);
  if (state.me.host) { const reset = node('button', 'button ghost', '같은 동료와 다른 밤을 시작'); reset.addEventListener('click', () => action('reset', {}, reset)); actions.append(reset); } else actions.append(node('p', 'small-copy', '방을 만든 동료가 새로운 밤을 시작할 수 있습니다.'));
  fragment.append(actions); $('ending').replaceChildren(fragment);
}
function render() {
  if (!state || !room || paused) return; const phase = state.phase;
  $('experience').dataset.phase = phase; $('entry').hidden = true; $('story-panel').hidden = false; $('room-button').hidden = false; $('room-code').textContent = state.code; $('leave-room').hidden = false;
  $('role-label').hidden = false; $('current-role').textContent = roles[state.me.role]?.title || state.me.role; $('objective').textContent = state.objective;
  $('lobby-actions').hidden = phase !== 'lobby'; $('investigation').hidden = !['explore', 'vote'].includes(phase) || showVoting; $('voting').hidden = phase !== 'vote' || !showVoting; $('ending').hidden = phase !== 'ended';
  $('chapter').textContent = phase === 'lobby' ? 'PROLOGUE' : phase === 'ended' ? 'EPILOGUE' : showVoting && phase === 'vote' ? '02 · OUR CHOICE' : '01 · DIFFERENT PIECES';
  $('panel-title').textContent = phase === 'lobby' ? '이 밤의 동료들' : phase === 'ended' ? '우리가 밝힌 밤' : showVoting && phase === 'vote' ? '불빛이 도착할 곳' : '서로 다른 조각들';
  renderPlayers();
  if (phase === 'lobby') {
    $('invite-tab').href = inviteUrl(); const ready = state.requiredRoles.every(r => state.players.some(p => p.role === r)); $('start-story').disabled = !ready || !state.me.host;
    $('start-hint').textContent = !ready ? '정비사와 기록원, 두 역할이 모이면 출발합니다. 감시인과 배달인도 함께할 수 있어요.' : state.me.host ? '두 필수 역할이 모였습니다. 동료가 준비되면 이야기를 시작하세요.' : '두 필수 역할이 모였습니다. 방을 만든 동료가 시작할 차례입니다.';
  }
  if (phase === 'explore' || phase === 'vote') { renderObjects(); renderShared(); renderChoices(); $('open-vote').disabled = phase !== 'vote'; $('vote-hint').textContent = phase === 'vote' ? '단서가 모였습니다. 어느 쪽이든, 이 밤의 이유를 함께 골라 주세요.' : `정비사와 기록원의 단서 ${state.sharedRequired || 0} / ${state.requiredShared || 4}개를 나눴습니다.`; }
  if (phase === 'ended') renderEnding(); world?.setPhase(phase); world?.setRole(state.me.role, state.inspected); world?.setEnding(state.ending?.choiceId || null);
}
function useFallback() { $('fallback').hidden = false; $('loading').hidden = true; $('world').hidden = true; $('hotspots').hidden = true; $('render-status').textContent = '정지 이미지 · 장소 버튼으로 플레이'; $('camera-mode').disabled = true; $('quality').disabled = true; $('scene-instruction').textContent = '장소 버튼을 눌러 조사하기'; }
async function bootWorld() {
  try {
    const { createWorld } = await import('./scene.js');
    world = await createWorld({ container: $('world'), hotspots: $('hotspots'), onInspect: inspect, onStatus: s => { if (s.lost) useFallback(); if (s.place) $('place-name').textContent = s.place; if (s.quality) $('render-status').textContent = s.quality; } });
    if(accessibility)world.setReducedMotion(accessibility.getMotion().reduced);
    $('loading').hidden = true; if (state) render();
    // Aggregate render facts are useful for local QA. Never expose room credentials here.
    window.pulseScene = Object.freeze({ getMetrics: () => world.getMetrics(), focus: id => world.focus(id) });
  } catch (error) { console.error('PULSE 3D could not start:', error); useFallback(); }
}
try {
  const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
  if (saved && /^[A-Z2-9]{6}$/.test(saved.code) && Array.isArray(saved.players) && saved.players.length && saved.players.every(p => typeof p.token === 'string' && typeof p.playerId === 'string') && (!invitation || invitation === saved.code)) {
    room = saved; room.active = Math.min(Math.max(0, Number(saved.active) || 0), saved.players.length - 1); connect(); $('entry').hidden = true; $('story-panel').hidden = false; $('objective').textContent = '함께 남긴 밤으로 돌아가는 중입니다.'; $('leave-room').hidden = false;
  } else if (invitation) openForm('join');
} catch { if (invitation) openForm('join'); }
bootWorld(); window.addEventListener('pagehide', () => eventSource?.close());
window.addEventListener('pageshow',event=>{if(event.persisted&&room)connect();});
