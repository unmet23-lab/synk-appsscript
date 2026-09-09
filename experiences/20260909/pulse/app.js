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
let audio = null, audioState = null, currentZone = 'square', moving = false;
const accessibility = window.SynkA11y?.install({motionSelect:$('motion-choice'),onMotionChange:({reduced})=>world?.setReducedMotion(reduced)});
const audioReady = import('./audio.js').then(({createPulseAudio}) => { audio = createPulseAudio({onState: renderAudio}); renderAudio(audio.getState()); return audio; }).catch(() => { $('audio-toggle').disabled = true; $('audio-status').textContent = '이 환경에서는 소리를 사용할 수 없습니다.'; return null; });
const pendingActions = new Set();
const invitation = (new URLSearchParams(location.search).get('room') || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6);
function node(tag, className, text) { const el = document.createElement(tag); if (className) el.className = className; if (text != null) el.textContent = text; return el; }
function displayError(message) { $('error-message').textContent = message; $('error').hidden = false; }
function toast(message) { clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false; toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4000); }
function persist() { try { room ? sessionStorage.setItem(storageKey, JSON.stringify(room)) : sessionStorage.removeItem(storageKey); } catch { /* Current-page play works if storage is unavailable. */ } }
function renderAudio(next) { audioState = next; const playing = !!(next.started && !next.muted); $('audio-toggle').textContent = playing ? '소리 끄기' : '소리 켜기'; $('audio-toggle').setAttribute('aria-pressed', String(playing)); $('audio-toggle').disabled = next.available === false; if (typeof next.music === 'number') $('music-volume').value = String(Math.round(next.music * 100)); if (typeof next.effects === 'number') $('effects-volume').value = String(Math.round(next.effects * 100)); $('audio-status').textContent = next.available === false ? '이 환경에서는 소리를 사용할 수 없습니다.' : next.suspended ? '소리 켜기를 눌러 다시 들을 수 있습니다.' : playing ? '음악과 도시의 소리를 듣는 중' : '원할 때 소리를 켤 수 있습니다.'; }
async function startAudio(forceSound = false) { const engine = await audioReady; if (engine) { await engine.start(); if(forceSound) engine.mute(false); } }
function sound(id) { audio?.play(id); }
function sendContext() { window.dispatchEvent(new CustomEvent('pulse:session', {detail: room && !paused ? {code:room.code,token:activePlayer().token} : null})); window.dispatchEvent(new CustomEvent('pulse:state', {detail: state && !paused ? state : null})); }
window.addEventListener('pulse:request-context', sendContext);
$('audio-toggle').addEventListener('click', async () => { if (!audioState?.started || audioState?.suspended) await startAudio(true); else audio?.mute(!audioState.muted); });
for (const [id,key] of [['music-volume','music'],['effects-volume','effects']]) $(id).addEventListener('input', e => audio?.setMix({[key]:Number(e.target.value)/100}));
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
  const oldPhase = state?.phase, oldRestoration = state?.restoration; state = next;
  if (next.phase === 'lobby') { showVoting = false; selectedObject = null; if (oldPhase && oldPhase !== 'lobby') { room.hints = {}; room.markDrafts = {}; delete room.radioDraft; persist(); } }
  if (oldPhase === 'lobby' && next.phase === 'explore') { selectedObject = null; toast('먼저 나의 역할이 알아볼 수 있는 물건을 찾아보세요.'); }
  if (oldRestoration && !oldRestoration.power?.solved && next.restoration?.power?.solved) { sound('tram'); toast('전원이 돌아왔습니다. 우리가 이은 길에 작은 불이 들어옵니다.'); }
  if (oldRestoration && !oldRestoration.radio?.solved && next.restoration?.radio?.solved) { sound('confirm'); toast('항구의 목소리가 돌아왔습니다. 복원된 방송을 읽어 보세요.'); }
  if (oldPhase && oldPhase !== 'ended' && next.phase === 'ended') sound('confirm');
  render();
  sendContext();
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
  const hadFocus = button && document.activeElement === button;
  const player = activePlayer(), key = `${player.playerId}:${type}:${JSON.stringify(payload)}`;
  if (pendingActions.has(key)) return false;
  pendingActions.add(key); if (button) { button.disabled = true; button.dataset.pending = 'true'; } $('error').hidden = true;
  try { const result = await request(`/api/rooms/${encodeURIComponent(room.code)}/actions`, { token: player.token, body: { type, payload } }); if (activePlayer()?.playerId === player.playerId) acceptState(result.state); return true; }
  catch (err) { displayError(err.message); return false; }
  finally { pendingActions.delete(key); if (button) { delete button.dataset.pending; if (button.isConnected) button.disabled = false; } if (state) render(); if(hadFocus && button?.isConnected && !button.disabled && document.activeElement===document.body) button.focus({preventScroll:true}); }
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
  startAudio();
  try {
    const code = $('code-input').value.trim().toUpperCase(); if (formMode === 'join' && !/^[A-Z2-9]{6}$/.test(code)) throw new Error('초대 코드 여섯 자리를 확인해 주세요.');
    setRoom(await request(formMode === 'join' ? `/api/rooms/${code}/join` : '/api/rooms', { body: { name: $('name-input').value.trim(), role: $('role-input').value } }));
  } catch (err) { displayError(err.message); } finally { $('form-submit').disabled = false; }
});
$('dual-start').addEventListener('click', async () => {
  const button = $('dual-start'); button.disabled = true; $('error').hidden = true;
  startAudio();
  try {
    const first = await request('/api/rooms', { body: { name: '정비사', role: 'signal' } }); setRoom(first);
    const second = await request(`/api/rooms/${first.code}/join`, { body: { name: '기록원', role: 'archive' } });
    room.players.push({ token: second.token, playerId: second.playerId, role: 'archive', name: '기록원' }); persist(); await action('start'); toast('두 역할을 바꿔 메모를 읽을 수 있어요. 전차나 방송국, 어디부터 고칠까요?');
  } catch (err) { displayError(err.message); } finally { button.disabled = false; }
});
async function copyInvite() { if (!room) return; try { await navigator.clipboard.writeText(inviteUrl()); toast('초대 링크를 복사했습니다. 동료에게 전해 주세요.'); } catch { displayError(`초대 코드는 ${room.code}입니다. 같은 주소를 연 동료가 이 코드로 들어올 수 있습니다.`); } }
$('room-button').addEventListener('click', copyInvite); $('invite-copy').addEventListener('click', copyInvite);
$('start-story').addEventListener('click', e => { startAudio(); action('start', {}, e.currentTarget); }); $('finalize').addEventListener('click', e => { sound('switch'); action('finalize', {}, e.currentTarget); });
$('open-vote').addEventListener('click', () => { showVoting = true; render(); $('panel-body').scrollTop = 0; });
$('back-evidence').addEventListener('click', () => { showVoting = false; render(); $('evidence-book').open = true; });
$('error-close').addEventListener('click', () => { $('error').hidden = true; });
$('recover-room').addEventListener('click',()=>{eventSource?.close();room=null;state=null;persist();sendContext();const url=new URL(location.href);url.search='';location.href=url.href;});
$('panel-collapse').addEventListener('click', () => { const collapsed = $('story-panel').classList.toggle('collapsed'); $('panel-collapse').setAttribute('aria-expanded', String(!collapsed)); $('panel-collapse').setAttribute('aria-label', collapsed ? '이야기 패널 펼치기' : '이야기 패널 접기'); });
$('display-toggle').addEventListener('click', () => { const open = $('display-panel').hidden; $('display-panel').hidden = !open; $('display-toggle').setAttribute('aria-expanded', String(open)); });
$('scene-only').addEventListener('click', () => { $('experience').classList.add('scene-only'); $('restore-ui').hidden = false; $('restore-ui').focus(); });
$('restore-ui').addEventListener('click', () => { $('experience').classList.remove('scene-only'); $('restore-ui').hidden = true; $('display-panel').hidden = true; $('display-toggle').setAttribute('aria-expanded', 'false'); $('display-toggle').focus(); });
$('camera-mode').addEventListener('change', e => world?.setCameraMode?.(e.target.value)); $('quality').addEventListener('change', e => world?.setQuality(e.target.value));
$('leave-room').addEventListener('click', () => { paused=true;persist();sendContext();$('entry').hidden=false;$('entry-main').hidden=true;$('room-form').hidden=true;$('resume-actions').hidden=false;$('story-panel').hidden=true;$('role-label').hidden=true;$('display-panel').hidden=true;$('display-toggle').setAttribute('aria-expanded','false');$('experience').dataset.phase='entry';world?.setPhase('entry');world?.focus('street');$('resume-room').focus(); });
$('resume-room').addEventListener('click',()=>{paused=false;$('resume-actions').hidden=true;render();sendContext();startAudio();$('story-panel').focus({preventScroll:true});});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if ($('experience').classList.contains('scene-only')) $('restore-ui').click(); else { $('display-panel').hidden = true; $('display-toggle').setAttribute('aria-expanded', 'false'); $('error').hidden = true; } } });
async function inspect(objectId) {
  world?.focus(objectId); sound('inspect'); if (!state || state.phase === 'lobby' || state.phase === 'ended') return;
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
    const b = node('button', '', roles[p.role]?.title || p.role); b.dataset.focusKey = 'role-'+p.role; b.setAttribute('aria-pressed', String(index === room.active)); b.append(node('small', '', index === room.active ? '지금 보고 있는 역할' : '이 역할의 화면으로'));
    b.addEventListener('click', () => {
      if (room.active === index) return; room.active = index; persist(); selectedObject = null; state = null; sound('paper'); window.dispatchEvent(new CustomEvent('pulse:session',{detail:null}));
      $('object-card').replaceChildren(); $('object-card').hidden = true; $('shared-clues').replaceChildren(); $('choices').replaceChildren(); $('objective').textContent = '다른 역할의 기록을 펼치는 중입니다.'; $('current-role').textContent = roles[p.role].title; connect();
    }); return b;
  }));
}
function renderObjects() {
  const ownId = roles[state.me.role].objectId;
  $('object-nav').replaceChildren(...state.objects.map((o, i) => { const b = node('button'); b.dataset.focusKey = 'object-'+o.id; b.append(node('span', '', String(i + 1).padStart(2, '0')), document.createTextNode(o.title)); b.dataset.own = String(o.id === ownId); b.setAttribute('aria-pressed', String(selectedObject === o.id)); b.addEventListener('click', () => inspect(o.id)); return b; }));
  const object = state.objects.find(o => o.id === selectedObject); $('object-card').hidden = !object; if (!object) return;
  const contents = [node('span', 'card-label', selectedObject === ownId ? '나의 역할이 알아본 것' : '거리에서 발견한 것'), node('h3', '', object.title), node('p', '', object.description)];
  const clues = (state.privateClues || []).filter(c => c.objectId === object.id);
  if (clues.length) {
    const notes = node('details','role-notes'), noteKey = state.me.role+'.'+object.id; notes.open = !!room.openNotes?.[noteKey]; notes.append(node('summary','',`${roles[state.me.role].title}의 메모 ${clues.length}개 · 필요한 힌트`)); notes.addEventListener('toggle',()=>{room.openNotes ||= {};room.openNotes[noteKey]=notes.open;persist();});
    for (const clue of clues) {
      const part = node('section', 'private-clue'); part.append(node('h3', '', clue.title), node('p', '', clue.text));
      const b = node('button', `button ${clue.shared ? 'ghost' : 'primary'}`, clue.shared ? '동료에게 공유했어요 ✓' : '이 단서 함께 나누기 →'); b.disabled = clue.shared;
      b.dataset.focusKey = 'share-'+clue.id; b.addEventListener('click', async () => { if (await action('share', { clueId: clue.id }, b)) { sound('share'); toast('이 단서가 모두의 기록에 더해졌습니다.'); } }); part.append(b); notes.append(part);
    }
    notes.append(node('p', 'private-note', '이 메모는 지금 역할에게만 보입니다. 말로 전하거나 필요한 단서만 함께 나눠도 좋아요.')); contents.push(notes);
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
    const b = node('button', 'choice'); b.dataset.choice = c.id; b.dataset.focusKey = 'choice-'+c.id; b.setAttribute('aria-pressed', String(state.votes[state.me.id] === c.id)); b.append(node('strong', '', c.title), node('p', '', c.description));
    const voters = state.players.filter(p => state.votes[p.id] === c.id).map(p => p.name); b.append(node('div', 'voters', voters.length ? `${voters.join(', ')}의 선택` : '아직 선택한 동료가 없습니다')); b.addEventListener('click', () => { sound('vote'); action('vote', { choiceId: c.id }, b); }); return b;
  }));
  const count = Object.keys(state.votes).length;
  $('consensus').textContent = state.voteFinalizable ? state.me.host ? '모두 같은 곳을 골랐습니다. 준비가 되면 불빛을 보내세요.' : '모두 같은 곳을 골랐습니다. 방을 만든 동료가 불빛을 보낼 차례입니다.' : count < state.players.length ? `${state.players.length}명 중 ${count}명이 골랐습니다. 서로의 선택을 보고 이야기해 보세요.` : '아직 서로 다른 곳을 보고 있습니다. 단서를 다시 읽고, 함께 고를 곳을 이야기해 보세요.';
  if (room.players.length > 1 && state.voteFinalizable && !state.me.host) $('consensus').textContent = '두 역할이 같은 곳을 골랐습니다. 전차 정비사 화면으로 돌아가 마지막 불빛을 보내세요.';
  $('finalize').disabled = !state.voteFinalizable || !state.me.host;
}
function renderEnding() {
  const ending = state.ending; if (!ending) return;
  const fragment = document.createDocumentFragment(); fragment.append(node('div', 'ending-rule'), node('h3', '', ending.title), node('p', '', ending.body)); if (ending.epilogue) fragment.append(node('p', 'truth', ending.epilogue));
  const actions = node('div', 'ending-actions'); const look = node('button', 'button primary', '우리가 남긴 장면 감상 ↗'); look.addEventListener('click', () => { world?.focus(ending.choiceId); $('scene-only').click(); }); actions.append(look);
  if (state.me.host) { const reset = node('button', 'button ghost', '같은 동료와 다른 밤을 시작'); reset.addEventListener('click', () => action('reset', {}, reset)); actions.append(reset); } else actions.append(node('p', 'small-copy', '방을 만든 동료가 새로운 밤을 시작할 수 있습니다.'));
  fragment.append(actions); $('ending').replaceChildren(fragment);
}
const orientationLabels = ['위와 오른쪽','오른쪽과 아래','아래와 왼쪽','왼쪽과 위'];
const hints = {
  tram: ['밝은 구리선이 들어오는 쪽과 나가는 쪽을 함께 보세요. 연결부를 돌려도 전력은 줄지 않습니다.','왼쪽 아래 1번 → 위쪽 2번 → 오른쪽 3번 → 아래 배전판 순서로 길을 내면 됩니다.','1번은 왼쪽과 위, 2번은 아래와 오른쪽, 3번은 왼쪽과 아래가 이어져야 합니다.'],
  radio: ['기록원의 수신 메모에 시작 눈금이, 정비사의 메모에 작은 눈금의 단위가 있습니다. 혼자라면 위의 역할 버튼을 바꿔 읽을 수 있어요.','96 MHz에서 오른쪽으로 네 눈금. 작은 한 눈금은 0.1 MHz이므로 0.4를 더해 보세요.','96.4 MHz로 맞춘 뒤 수신 확인을 누르세요. 음소거 상태에서도 방송을 글로 읽을 수 있습니다.'],
  buoy: ['이곳의 감시 일지는 불빛을 어디로 보낼지 의논할 때 도움이 됩니다. 전차와 방송국은 어느 역할로든 조작할 수 있어요.'],
  postbox: ['편지에는 혼자 남은 사람의 사정이 담겨 있습니다. 꼭 수집해야 하는 물건은 아니니 궁금한 만큼 읽어도 좋아요.'],
};
function renderWorkshops() {
  const restoration = state.restoration;
  $('power-workshop').hidden = selectedObject !== 'tram' || !restoration;
  $('radio-workshop').hidden = selectedObject !== 'radio' || !restoration;
  $('hint-area').hidden = !selectedObject;
  const level = room.hints?.[selectedObject] || 0, availableHints = hints[selectedObject] || [];
  $('hint-copy').textContent = level ? availableHints[Math.min(level,availableHints.length)-1] : '';
  $('hint-button').textContent = level >= availableHints.length ? '힌트 접기' : level ? '조금 더 구체적인 힌트' : '작은 힌트 보기';
  if (!restoration) return;
  const power = restoration.power;
  for (let index=0;index<3;index++) {
    const button = $('circuit-'+index), rotation = power.rotations[index];
    button.querySelector('svg').style.transform = `rotate(${rotation*90}deg)`;
    button.querySelector('.tile-direction').textContent = orientationLabels[rotation];
    button.setAttribute('aria-label', `${index+1}번 연결부, ${orientationLabels[rotation]} 연결. 누르면 시계 방향으로 90도 돌아갑니다.`);
    button.dataset.live = String(power.trace.includes(index));
    button.disabled = power.solved || state.phase !== 'explore' || button.dataset.pending === 'true';
  }
  $('power-outlet').dataset.live = String(power.solved);
  $('power-outlet').querySelector('span').textContent = power.solved ? '전기가 돌아왔어요' : '아직 불이 꺼져 있어요';
  $('power-feedback').textContent = power.feedback;
  const radio = restoration.radio, frequency = radio.solved ? radio.frequency : room.radioDraft ?? radio.frequency;
  $('radio-dial').value = String(frequency); $('radio-frequency').textContent = Number(frequency).toFixed(1); $('radio-dial').setAttribute('aria-valuetext',Number(frequency).toFixed(1)+' MHz');
  $('radio-lock').textContent = radio.solved ? '수신 복원' : '탐색 중'; $('radio-lock').dataset.solved = String(radio.solved);
  for (const id of ['radio-dial','radio-minus','radio-plus','radio-check']) $(id).disabled = radio.solved || state.phase !== 'explore' || $('radio-check').dataset.pending === 'true';
  $('radio-signal').value = radio.signal; $('radio-signal-text').textContent = radio.signal+'%'; $('radio-feedback').textContent = radio.feedback;
  $('restored-broadcast').hidden = !radio.solved; $('restored-broadcast').textContent = radio.broadcast || '';
}
for (let index=0;index<3;index++) $('circuit-'+index).addEventListener('click',e=>{ if (!state?.restoration) return; sound('switch'); action('restore',{kind:'power',index,rotation:(state.restoration.power.rotations[index]+1)%4},e.currentTarget); });
function draftFrequency(value) { if (!room || !state?.restoration || state.restoration.radio.solved) return; room.radioDraft = Math.round(Math.max(90,Math.min(104,Number(value)))*10)/10; persist(); $('radio-dial').value=String(room.radioDraft); $('radio-frequency').textContent=room.radioDraft.toFixed(1); $('radio-dial').setAttribute('aria-valuetext',room.radioDraft.toFixed(1)+' MHz'); }
$('radio-dial').addEventListener('input',e=>draftFrequency(e.target.value));
$('radio-minus').addEventListener('click',()=>{draftFrequency(Number($('radio-dial').value)-.1);sound('switch');});
$('radio-plus').addEventListener('click',()=>{draftFrequency(Number($('radio-dial').value)+.1);sound('switch');});
$('radio-check').addEventListener('click',e=>{const frequency=Number($('radio-dial').value);delete room.radioDraft;persist();sound('radio');action('restore',{kind:'radio',frequency},e.currentTarget);});
$('hint-button').addEventListener('click',()=>{if(!room||!selectedObject)return;room.hints ||= {};const count=hints[selectedObject]?.length||0;room.hints[selectedObject]=(room.hints[selectedObject]||0)>=count?0:(room.hints[selectedObject]||0)+1;persist();renderWorkshops();});
function renderNightTrace() {
  $('chronicle').replaceChildren(...(state.ending?.chronicle || []).map(event=>{const item=node('li');item.append(node('span','',roles[event.role]?.title || '우리'),node('p','',event.text));return item;}));
  $('shared-marks').replaceChildren(...(state.restoration?.marks || []).map(mark=>{const item=node('blockquote');item.append(node('p','',mark.text),node('cite','',roles[mark.role]?.title || '동료'));return item;}));
  if (document.activeElement !== $('mark-input')) $('mark-input').value = room.markDrafts?.[state.me.role] ?? state.restoration?.marks?.find(mark=>mark.role===state.me.role)?.text ?? '';
}
$('mark-input').addEventListener('input',e=>{if(!room||!state)return;room.markDrafts ||= {};room.markDrafts[state.me.role]=e.target.value;persist();});
$('mark-form').addEventListener('submit',async e=>{e.preventDefault();if(await action('mark',{text:$('mark-input').value},$('mark-save'))){sound('paper');toast('이 문장이 동료들과 함께 남길 기록에 더해졌습니다.');}});
$('night-download').addEventListener('click',()=>{
  if(!state?.ending)return;
  const lines=['SYNK PULSE · 마지막 불빛','서쪽 해안, 23:17','',state.ending.title,'',state.ending.body,'',state.ending.epilogue,'','우리가 되찾은 것',...(state.ending.chronicle||[]).map(e=>`${e.step}. ${roles[e.role]?.title || '우리'} — ${e.text}`),'','불빛이 도착할 곳: '+(state.ending.signature||''),'',...(state.restoration?.marks||[]).flatMap(m=>[roles[m.role]?.title || '동료',m.text,''])];
  const url=URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'})),link=node('a');link.href=url;link.download='pulse-last-light-'+state.ending.choiceId+'.txt';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);sound('paper');
});
function render() {
  if (!state || !room || paused) return; const phase = state.phase;
  const focusKey = document.activeElement?.dataset?.focusKey;
  $('experience').dataset.phase = phase; $('entry').hidden = true; $('story-panel').hidden = false; $('room-button').hidden = false; $('room-code').textContent = state.code; $('leave-room').hidden = false;
  $('role-label').hidden = false; $('current-role').textContent = roles[state.me.role]?.title || state.me.role; $('objective').textContent = state.objective;
  $('lobby-actions').hidden = phase !== 'lobby'; $('investigation').hidden = !['explore', 'vote'].includes(phase) || showVoting; $('voting').hidden = phase !== 'vote' || !showVoting; $('ending').hidden = phase !== 'ended';
  $('chapter').textContent = phase === 'lobby' ? 'PROLOGUE' : phase === 'ended' ? 'EPILOGUE' : showVoting && phase === 'vote' ? '02 · OUR CHOICE' : '01 · WAKE THE CITY';
  $('panel-title').textContent = phase === 'lobby' ? '이 밤의 동료들' : phase === 'ended' ? '우리가 밝힌 밤' : showVoting && phase === 'vote' ? '불빛이 도착할 곳' : '꺼진 도시를 깨우자';
  renderPlayers();
  if (phase === 'lobby') {
    $('invite-tab').href = inviteUrl(); const ready = state.requiredRoles.every(r => state.players.some(p => p.role === r)); $('start-story').disabled = !ready || !state.me.host;
    $('start-hint').textContent = !ready ? '정비사와 기록원, 두 역할이 모이면 출발합니다. 감시인과 배달인도 함께할 수 있어요.' : state.me.host ? '두 필수 역할이 모였습니다. 동료가 준비되면 이야기를 시작하세요.' : '두 필수 역할이 모였습니다. 방을 만든 동료가 시작할 차례입니다.';
  }
  if (phase === 'explore' || phase === 'vote') { renderObjects(); renderShared(); renderChoices(); renderWorkshops(); $('open-vote').disabled = phase !== 'vote'; $('vote-hint').textContent = phase === 'vote' ? '전원과 방송이 돌아왔습니다. 확인한 소식을 바탕으로 우리가 밝힐 곳을 함께 정해요.' : '전원과 수신을 모두 복원하면 불빛을 보낼 수 있습니다. 단서 공유는 필수가 아닙니다.'; }
  $('journey').hidden = phase === 'lobby'; for (const [id,done] of [['power-progress',state.restoration?.power?.solved],['radio-progress',state.restoration?.radio?.solved],['choice-progress',phase==='ended']]) { $(id).dataset.complete = String(!!done); $(id).setAttribute('aria-label',$(id).textContent + (done ? ' 완료' : ' 아직')); }
  $('night-trace').hidden = phase !== 'ended'; if (phase === 'ended') { renderEnding(); renderNightTrace(); }
  world?.setPhase(phase); world?.setRole(state.me.role, state.inspected); world?.setEnding(state.ending?.choiceId || null); world?.updateRestoration?.(state.restoration);
  audio?.updateScene({zone:currentZone,moving:false,phase,ending:state.ending?.choiceId || null});
  if (focusKey) document.querySelector(`[data-focus-key="${focusKey}"]`)?.focus({preventScroll:true});
}
function useFallback() { $('fallback').hidden = false; $('loading').hidden = true; $('world').hidden = true; $('hotspots').hidden = true; $('render-status').textContent = '정지 이미지 · 장소 버튼으로 플레이'; $('camera-mode').disabled = true; $('quality').disabled = true; $('scene-instruction').textContent = '장소 버튼을 눌러 조사하기'; }
async function bootWorld() {
  try {
    const { createWorld } = await import('./scene.js');
    world = await createWorld({ container: $('world'), hotspots: $('hotspots'), onInspect: inspect, onStatus: s => {
      if (s.lost) useFallback();
      if (s.place) $('place-name').textContent = s.place;
      if (s.quality) $('render-status').textContent = s.quality;
      if (s.cameraMode) {
        $('camera-mode').value = s.cameraMode;
        const nearby = {tram:'전차',radio:'방송국',buoy:'구명환',postbox:'우체통'}[s.nearest];
        $('scene-instruction').textContent = s.cameraMode === 'walk'
          ? `WASD로 걷기 · 드래그로 둘러보기${nearby ? ` · E로 ${nearby} 조사` : ''}`
          : '드래그로 둘러보기 · 휠로 가까이 보기';
      }
      if (s.zone) currentZone=s.zone;
      if (typeof s.moving==='boolean') moving=s.moving;
      if (s.step) sound('step');
      if (s.zone || typeof s.moving==='boolean') audio?.updateScene({zone:currentZone,moving:false,phase:state?.phase || 'lobby',ending:state?.ending?.choiceId || null});
    } });
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
