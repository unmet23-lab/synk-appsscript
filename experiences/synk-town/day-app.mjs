import { createDayScene } from './day-scene.mjs';
import { createWalkControls } from './walk-controls.mjs';
import { movePoint, nearbyPlace, WALK_SPAWNS } from './walk.mjs';

const $ = id => document.getElementById(id);
const surfaceId = crypto.randomUUID(), reduced = matchMedia('(prefers-reduced-motion: reduce)');
const names = { home: '나의 집', cafe: '찻집', workshop: '공방', greenhouse: '온실' };
// 우리 동네 HUD(2026-10-14 3차): 가장 작은 지도 한 장 + 할 일 한 줄. 표시만 하고 이동·저장·권한 논리는 건드리지 않는다.
const MAP_BOUNDS = { minX: -9, maxX: 9, minZ: -6.5, maxZ: 6 };
const mapX = x => Math.max(4, Math.min(96, (x - MAP_BOUNDS.minX) / (MAP_BOUNDS.maxX - MAP_BOUNDS.minX) * 100));
const mapY = z => Math.max(8, Math.min(88, (z - MAP_BOUNDS.minZ) / (MAP_BOUNDS.maxZ - MAP_BOUNDS.minZ) * 100));
let mapSignature = '';
function todoLine(visited) {
  const job = snapshot?.view.day?.job?.status;
  if (job === 'ready') return '공방에서 준비된 받침 확인하기';
  if (job === 'preparing') return '받침이 준비되는 동안 다른 곳 둘러보기';
  const next = ['cafe', 'workshop', 'greenhouse'].find(id => !visited.has(id));
  return next ? `${names[next]}에 들러 이야기하기` : '집에 돌아가 쉬기';
}
function paintMap(place) {
  const me = $('town-map-me'); if (!me) return;
  if (walkPoint) { const left = mapX(walkPoint.x).toFixed(1) + '%', top = mapY(walkPoint.z).toFixed(1) + '%'; if (me.style.left !== left) me.style.left = left; if (me.style.top !== top) me.style.top = top; }
  const visited = new Set((snapshot?.state.day?.history || []).map(h => h.location).filter(Boolean));
  const signature = [place, [...visited].join(','), snapshot?.view.day?.job?.status].join('|'); if (signature === mapSignature) return; mapSignature = signature;
  for (const node of document.querySelectorAll('.town-map-place')) { const p = WALK_SPAWNS[node.dataset.place]; if (p) { node.style.left = mapX(p.x) + '%'; node.style.top = mapY(p.z) + '%'; } node.dataset.near = String(node.dataset.place === place); node.dataset.visited = String(visited.has(node.dataset.place)); }
  text('town-map-place', place ? `${names[place]} 앞` : '동네 산책'); text('town-todo', todoLine(visited));
}
const roleNames = { 'cafe-owner': '찻집 주인', 'workshop-owner': '공방 주인', researcher: '연구원' };
const stepLines = { 'guest-walk': '손님이 고른 자리로 걸어와요.', 'guest-sit': '손님이 자리에 앉아요.', 'owner-walk': '주인이 차를 가져와요.', 'owner-serve': '주인이 차를 놓아요.', 'tea-place': '차가 자리에 놓였어요.', 'guest-walk-sign': '손님이 안내판으로 걸어와요.', 'guest-read-sign': '손님이 안내판 그림을 봐요.', 'guest-follow-sign': '손님이 그림이 알려 준 자리로 가요.', 'guest-sit-sign': '손님이 자리에 앉아요.' };
const worldHostRequested = globalThis.__SYNK_WORLD_TOWN__?.accountScoped === true && (globalThis.__SYNK_WORLD_TOWN__?.rehearsal === true || globalThis.__SYNK_WORLD_TOWN__?.mode === 'account');
let worldHost = null, worldAppearance = null, worldTabNamespace = null;
let snapshot = null, presence = null, lastPulse = 0, renderer = null, fallback = false;
let busy = false, connected = false, tail = Promise.resolve(), pulseQueued = false, sceneReady = false;
let camera = 'wide', quality = 'balanced', activePlan = null, planMs = 0, planLast = null, planCompleteAt = null, planPainted = false, planAckPending = false;
let planSample = null, applied = new Set(), lastObservation = null, observedMs = 0, observedLast = null, observationPending = false;
let renderedRequest = 0, pendingVisual = null, executionSample = null;
let contactId = null, contactMs = 0, contactLast = null, contactPending = false, raf = null;
const signatures = new Map();
const walkWanted = new URLSearchParams(location.search).get('controls') !== 'classic';
let walkControls = null, walkPoint = null, walkPanel = false, walkHeading = 0, walkMoving = false, walkInputActive = false, walkFrameAt = null;
let walkPending = [], walkPacket = null, walkFlushing = null, walkSentAt = 0, walkInputMode = matchMedia('(pointer: coarse)').matches ? 'touch' : 'keyboard';
let walkViewSignature = null, walkBackpressured = false, walkCorrectionDistance = 0, walkMaxCorrection = 0;
const walkSegmentOrigins = new WeakMap();
const walking = () => walkWanted && !fallback && snapshot?.state.day?.walk?.enabled === true;
const nearby = point => { const value = point && nearbyPlace(point); return typeof value === 'string' ? value : value?.id || value?.location || null; };
function dismissWalkPanel() { walkPanel = false; document.body.classList.remove('walk-engaged'); }
function pauseWalkInput() { walkControls?.stop(); walkPending = []; walkMoving = walkInputActive = walkBackpressured = false; walkFrameAt = null; if (!walkFlushing) reconcileWalk(); }
function applyWalkView(force = false) {
  const enabled = walking(), place = enabled ? nearby(walkPoint) : null;
  if (walkPanel && place !== snapshot?.view.day.location) dismissWalkPanel();
  // Walking can update at display refresh rate. Rewrite the HUD only when its
  // meaning changes, rather than repeating DOM mutations between each step.
  const signature = [enabled, walkPanel, place, busy, connected, walkInputMode, snapshot?.view.day.location].join('|');
  if (!force && signature === walkViewSignature) return;
  walkViewSignature = signature;
  document.body.classList.toggle('walk-mode', enabled); document.body.classList.toggle('walk-engaged', enabled && walkPanel);
  $('walk-hud').hidden = !enabled; $('walk-close').hidden = !enabled; $('destinations').hidden = enabled;
  if (!enabled) return;
  document.body.dataset.walkInput = walkInputMode; paintMap(place);
  const button = $('walk-interact');
  text('scene-badge', place ? names[place] : '동네 산책');
  button.disabled = !place || busy || !connected;
  text('walk-interact', place ? `${walkInputMode === 'touch' ? '' : walkInputMode === 'gamepad' ? 'A · ' : 'E · '}${place === 'home' ? '집 살펴보기' : `${names[place]}에서 이야기하기`}` : '가까이 가면 이야기해요');
  text('walk-status', place ? `${names[place]} 앞이에요. 원할 때 이야기해요.` : '길을 따라 걸어 보세요.');
  text('walk-help', walkInputMode === 'gamepad' ? '왼쪽 스틱 · 방향 패드 이동 / A 이야기 / B 닫기' : walkInputMode === 'touch' ? '조이스틱으로 걷고, 가까이 가면 이야기해요' : 'WASD · 방향키로 걷기 / E 이야기 / Esc 닫기');
}
function reconcileWalk() {
  if (!walking()) return;
  const predicted = walkPoint;
  if (!walkPoint) walkHeading = Math.atan2(snapshot.state.day.walk.headingX || 0, snapshot.state.day.walk.headingZ ?? 1);
  walkPoint = { x: snapshot.state.day.walk.x, z: snapshot.state.day.walk.z };
  for (const segment of [...(walkPacket || []), ...walkPending]) {
    walkSegmentOrigins.set(segment, walkPoint);
    walkPoint = movePoint(walkPoint, segment, segment.durationMs / 1000);
  }
  walkCorrectionDistance = predicted ? Math.hypot(walkPoint.x - predicted.x, walkPoint.z - predicted.z) : 0;
  walkMaxCorrection = Math.max(walkMaxCorrection, walkCorrectionDistance);
  renderer?.setPlayerPose?.({ ...walkPoint, heading: walkHeading, moving: walkMoving }); applyWalkView(true);
}
async function flushWalk(force = false) {
  if (walkFlushing) { if (force) { await walkFlushing; return flushWalk(true); } return; }
  if (!walking() || !connected || !walkPending.length) return;
  walkPacket = walkPending; walkPending = []; walkSentAt = performance.now();
  walkFlushing = queue(async () => {
    await ensureFreshPresence();
    const value = await request('command', { id: crypto.randomUUID(), type: 'DAY_WALK', payload: { segments: walkPacket, surfaceId, fence: presence.fence }, expectedRevision: snapshot.state.revision });
    walkPacket = null; accept(value);
  }).catch(error => { walkPacket = null; walkPending = []; walkControls?.stop(); showError(error.message); }).finally(() => { walkFlushing = null; applyWalkView(); });
  return walkFlushing;
}
async function interactWalk() {
  if (!walking() || busy || !connected) return;
  if (walkPanel) { const action = $('nearby-panel').querySelector('button[data-command]:not(:disabled)'); if (action) action.click(); return; }
  walkControls?.stop(); await flushWalk(true); const place = nearby(walkPoint); if (!place) return;
  if (await command('DAY_INTERACT', { location: place })) { walkPanel = true; applyWalkView(); }
}
function walkFrame(now) {
  if (!walking() || !walkControls || !walkPoint) { walkFrameAt = null; return; }
  // Keep sub-millisecond frame time: rounding each 60/120 Hz frame changes
  // walking speed and causes the host's time-limited receipt to pull us back.
  const dt = walkFrameAt == null ? 0 : Math.min(50, Math.max(0, now - walkFrameAt)); walkFrameAt = now;
  const input = walkControls.read(); walkInputActive = !!(input.x || input.z); walkMoving = false;
  const pendingMs = walkPending.reduce((n, s) => n + s.durationMs, 0), last = walkPending.at(-1);
  const sameDirection = last && last.x === input.x && last.z === input.z;
  // Preserve the authority's bounded prediction window and 32-part contract.
  // Use the remaining budget instead of discarding a whole final frame, and
  // merge identical input so high-refresh displays do not fragment packets.
  let stepMs = walkInputActive ? Math.min(dt, Math.max(0, 240 - pendingMs)) : 0;
  const next = stepMs > 0 ? movePoint(walkPoint, input, stepMs / 1000) : walkPoint;
  const origin = sameDirection && walkSegmentOrigins.get(last);
  const combined = origin && stepMs > 0 ? movePoint(origin, input, (last.durationMs + stepMs) / 1000) : null;
  // Collision substeps are not associative near a wall or curved planter.
  // Compact only when replay preserves the endpoint, so a receipt cannot
  // introduce a new correction simply because two inputs were merged.
  const canMerge = combined && Math.hypot(combined.x - next.x, combined.z - next.z) < .000000001;
  if (!canMerge && walkPending.length >= 32) stepMs = 0;
  walkBackpressured = walkInputActive && stepMs + .0001 < dt;
  if (stepMs > 0) {
    walkHeading = Math.atan2(input.x, input.z);
    const previous = walkPoint; walkPoint = next;
    walkMoving = Math.hypot(walkPoint.x - previous.x, walkPoint.z - previous.z) > .0000001;
    if (canMerge) last.durationMs += stepMs;
    else {
      const segment = { x: input.x, z: input.z, durationMs: stepMs };
      walkSegmentOrigins.set(segment, previous); walkPending.push(segment);
    }
  }
  renderer?.setPlayerPose?.({ ...walkPoint, heading: walkHeading, moving: walkMoving }); paintMap(nearby(walkPoint));
  if (walkPending.length && (now - walkSentAt >= 150 || !walkInputActive || walkPending.length >= 32 || pendingMs + stepMs >= 240)) flushWalk();
  applyWalkView();
}

function text(id, value = '') { if ($(id).textContent !== value) $(id).textContent = value; }
function queue(work) { const next = tail.then(work, work); tail = next.catch(() => {}); return next; }
function showError(message) { connected = false; presence = null; walkControls?.stop(); document.body.classList.add('walk-error'); text('error', message); $('error').hidden = false; $('retry').hidden = false; text('connection', '연결을 다시 확인해 주세요'); setBusy(false); }
function clearError() { document.body.classList.remove('walk-error'); $('error').hidden = true; $('retry').hidden = true; }
function available() { return connected && snapshot?.capabilities?.day === true; }
function setBusy(value) {
  busy = value; $('day-app').setAttribute('aria-busy', String(value));
  for (const b of document.querySelectorAll('[data-command], [data-destination], [data-mode], #life-open, #life-contact-open, #life-resume')) b.disabled = value || !available() || b.dataset.unavailable === 'true';
}
async function request(path, body) {
  if (worldHostRequested) {
    if (!worldHost) throw new Error('홈의 계정 연결을 확인하고 있어요.');
    if (sessionStorage.getItem('synk-world-v1-tab') !== worldTabNamespace || (globalThis.__SYNK_WORLD_TOWN__?.mode !== 'account' && sessionStorage.getItem('synk-world-v1-signed-out'))) {
      connected = false; pauseWalkInput(); location.reload(); throw new Error('계정 연결을 새로 확인하고 있어요.');
    }
    const result = await worldHost.request(path, body);
    if (!result?.state || !result?.view || !result?.capabilities?.day) throw new Error(result?.message || '이 계정의 타운을 열 수 없어요.');
    return result;
  }
  const response = await fetch(`/api/preview/${path}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' } : { cache: 'no-store' });
  const result = await response.json();
  if (!response.ok || !result.state || !result.view || !result.capabilities?.day) throw new Error(result.message || '첫 하루를 열 수 없어요. 개발 체험 서버를 확인해 주세요.');
  return result;
}
function visible(element, whole = true) {
  if (!element || element.hidden || document.hidden || document.querySelector('dialog[open]')) return false;
  const r = element.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.left >= 0 && r.right <= innerWidth + 1 && (whole ? r.top >= 0 && r.bottom <= innerHeight : r.top >= -r.height * .2 && r.bottom > 0);
}
function sceneVisible() { return connected && sceneReady && visible($('scene'), false); }
function dayActive() { return !!snapshot?.view.day?.episode?.open; }
function bazaarActive() { return snapshot?.view.day?.location === 'cafe' && !!snapshot.view.bazaar?.episode?.open; }
function lifeAvailable() { return snapshot?.view.day?.location === 'cafe' && !dayActive() && !bazaarActive() && !snapshot.view.day.scene.cafeReserved && !snapshot?.view.plan && !snapshot?.view.execution && !!snapshot?.view.life?.canStart; }
function flags() {
  const editing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
  return { surfaceId, surface: 'day', foreground: !document.hidden && (!walking() || document.hasFocus()) && sceneReady && connected,
    safe: !!(lifeAvailable() && (!walking() || nearby(walkPoint) === 'cafe' && !walkMoving && !walkInputActive) && !busy && !document.querySelector('dialog[open]') && !editing && sceneVisible()) };
}
async function pulseNow() {
  // The host lease starts when the request is processed, not when a slow GPU
  // frame/network finally lets the browser consume the response.
  const requestedAt = performance.now();
  const data = await request('presence', flags()); lastPulse = requestedAt; accept(data);
}
async function ensureFreshPresence() {
  if (presence?.owner && performance.now() - lastPulse <= 1200) return;
  for (let attempt = 0; attempt < 2; attempt++) {
    await pulseNow();
    if (performance.now() - lastPulse <= 1200) return;
  }
  throw new Error('연결이 늦어지고 있어요. 다시 연결을 눌러 주세요.');
}
function pulse() {
  if (pulseQueued || !snapshot?.capabilities?.day || !connected) return;
  pulseQueued = true;
  queue(pulseNow).catch(e => showError(e.message)).finally(() => { pulseQueued = false; });
}
async function command(type, payload = {}) {
  if (busy || !available()) return false;
  setBusy(true);
  try {
    await queue(async () => {
      if (/^(DAY_|LIFE_|BAZAAR_|SUPPORT_)/.test(type)) {
        await ensureFreshPresence();
        payload = { ...payload, surfaceId, fence: presence.fence };
      }
      const value = await request('command', { id: crypto.randomUUID(), type, payload, expectedRevision: snapshot.state.revision });
      accept(value); clearError();
    });
    if (type === 'DAY_MOVE') { $('scene').focus({ preventScroll: true }); $('scene').scrollIntoView({ block: 'start', behavior: reduced.matches ? 'instant' : 'smooth' }); }
    return true;
  } catch (e) { showError(e.message); return false; }
  finally { setBusy(false); }
}
function button(action) {
  const b = document.createElement('button'); b.type = 'button'; b.className = `felt${action.primary ? ' primary' : ''}`; b.textContent = action.label;
  b.dataset.command = action.type;
  for (const [key, value] of Object.entries(action.payload || {})) if (typeof value === 'string') b.dataset[key] = value;
  b.addEventListener('click', async () => {
    if (['DAY_OBSERVED', 'BAZAAR_OBSERVED'].includes(action.type)) { $('scene').scrollIntoView({ block: 'start', behavior: reduced.matches ? 'instant' : 'smooth' }); return; }
    const ok = await command(action.type, action.payload || {});
    if (ok && ['LIFE_CONFIRM', 'LIFE_DECLINE', 'LIFE_DEFER', 'LIFE_REST', 'LIFE_CLOSE'].includes(action.type)) $('life-dialog').close();
  });
  return b;
}
function actions(id, list = []) {
  const key = JSON.stringify(list); if (signatures.get(id) === key) return;
  signatures.set(id, key); $(id).replaceChildren(...list.map(button));
}
function renderOptions(day) {
  const locations = day.locations || Object.entries(names).map(([id, label]) => ({ id, label, active: id === day.location }));
  const signature = JSON.stringify(locations);
  if (signatures.get('destinations') !== signature) {
    signatures.set('destinations', signature);
    $('destinations').replaceChildren(...locations.map(location => {
      const b = button({ type: 'DAY_MOVE', label: location.label, payload: { location: location.id } }); b.dataset.destination = location.id;
      if (location.active || location.id === day.location) b.setAttribute('aria-current', 'page'); return b;
    }));
  }
  const options = day.supportOptions || [];
  actions('support-options', options.map(o => ({ type: 'DAY_SUPPORT', label: o.label, payload: { mode: o.id } })));
  for (const b of $('support-options').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.mode === day.support));
  for (const b of $('contact-options').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.mode === snapshot.view.life?.mode));
  text('support-label', options.find(o => o.id === day.support)?.label || '');
}
function resetPlan() { activePlan = null; planSample = null; planMs = 0; planLast = null; planCompleteAt = null; planPainted = false; planAckPending = false; applied = new Set(); pendingVisual = null; }
function configurePlan() {
  const raw = snapshot.view.day.location === 'cafe' ? snapshot.view.plan : null;
  if (!raw) { if (activePlan) resetPlan(); return; }
  if (activePlan?.id === raw.id && activePlan.revision === raw.revision) return;
  resetPlan(); activePlan = globalThis.LoomLife.createPlan(raw);
}
function currentScene() {
  const scene = { ...snapshot.view.day.scene, memories: (snapshot.state.day?.history || []).map(({ resultId, kind, role, choice, location }) => ({ resultId, kind, role, choice, location })) };
  if (walking() && walkPoint) { scene.player = { ...walkPoint, heading: walkHeading, pose: walkMoving ? 'walking' : 'standing' }; scene.freeWalk = true; }
  if (bazaarActive() && snapshot.view.bazaar.scene?.active) {
    const b = snapshot.view.bazaar.scene;
    scene.npcs = [...(scene.npcs || []).filter(n => !b.npcs?.some(v => v.id === n.id)), ...(b.npcs || [])];
    scene.props = [...(scene.props || []).filter(p => !b.props?.some(v => v.id === p.id)), ...(b.props || [])];
    scene.summary = b.summary; scene.cafeReserved = true;
    return scene;
  }
  if (snapshot.view.day.location === 'cafe' || walking()) {
    scene.legacy = { ...snapshot.view.scene, active: walking() || !!activePlan || !!executionSample || !dayActive() || !!snapshot.state.life?.episode?.open };
    if (executionSample || planSample) scene.legacyActors = (executionSample || planSample).actors;
    else if (!scene.cafeReserved && snapshot.view.life?.canStart && snapshot.view.life?.background) scene.lifeRoutine = snapshot.view.life.background;
  }
  return scene;
}
function renderScene() {
  if (!snapshot) return;
  const day = snapshot.view.day, scene = currentScene();
  const background = lifeAvailable() ? snapshot.view.life.background?.line : null;
  const sample = executionSample || planSample;
  const description = activePlan || executionSample ? (sample?.visualComplete ? snapshot.view.line : stepLines[sample?.activeStepId] || '손님이 고른 자리를 사용해요.') : bazaarActive() ? snapshot.view.bazaar.line : dayActive() ? day.line : background || scene.summary || scene.line || day.line;
  $('scene').setAttribute('aria-label', `${names[day.location] || day.location}. ${description}`); text('scene-caption', description); if (!walking()) text('scene-badge', names[day.location] || day.location);
  text('fallback-title', names[day.location] || day.location); text('fallback-line', description);
  const people = (scene.npcs || []).filter(n => !n.location || n.location === day.location).map(n => `${n.name || roleNames[n.id] || n.id}: ${n.line || n.activityLabel || n.actionLabel || n.goal || '자기 일을 하고 있어요.'}`);
  const peopleSig = JSON.stringify(people);
  if (signatures.get('people') !== peopleSig) { signatures.set('people', peopleSig); $('fallback-people').replaceChildren(...people.map(p => { const li = document.createElement('li'); li.textContent = p; return li; })); }
  if (renderer) {
    try { renderedRequest = renderer.render(scene, { reducedMotion: reduced.matches, quality, camera: walking() ? camera : activePlan || executionSample ? 'close' : camera }); sceneReady = renderer.stats().ready; }
    catch (error) { useFallback(error); }
  }
  const staticFT = !!activePlan && fallback; $('ft-static').hidden = !staticFT;
  if (staticFT) {
    const steps = activePlan.steps.map(s => stepLines[s.id] || '손님이 자리에서 쉬어요.');
    const sig = JSON.stringify(steps); if (signatures.get('static-steps') !== sig) { signatures.set('static-steps', sig); $('ft-static-steps').replaceChildren(...steps.map(s => { const li = document.createElement('li'); li.textContent = s; return li; })); }
  }
}
function useFallback(error) { fallback = true; sceneReady = true; walkControls?.stop(); renderer?.dispose(); renderer = null; $('day-canvas').hidden = true; $('scene-fallback').hidden = false; $('camera-toggle').hidden = true; $('scene').dataset.renderer = 'text-alternative'; text('scene-metrics', `장면 설명 대체 표시: ${error?.message || 'WebGL unavailable'}`); applyWalkView(); if (snapshot?.state.day.walk?.enabled) command('DAY_WALK_DISABLE'); }
function contactHere(contact) { return !!contact && presence?.owner && contact.issuedSurfaceId === surfaceId && contact.issuedFence === presence.fence; }
function renderLife() {
  const life = snapshot.view.life, enabled = lifeAvailable(); $('life-panel').hidden = !enabled;
  $('life-open').dataset.unavailable = String(!enabled); $('life-resume').hidden = !life?.restGuard;
  text('life-background', life?.background?.line || '');
  const contact = life?.contact, shown = enabled && contactHere(contact) && ['issued', 'delivered'].includes(contact.state) && !$('life-dialog').open;
  $('life-contact').hidden = !shown; text('life-contact-line', shown ? contact.label : '');
  const result = enabled && life?.interaction?.stage === 'result' ? life.interaction : null;
  $('life-result').hidden = true; text('life-result', result?.line || ''); actions('life-result-actions', result?.actions || []);
  if (result && !snapshot.view.day.observation) { $('observation').hidden = false; text('observation', result.line); }
  if ($('life-dialog').open) { text('life-dialog-line', life?.interaction?.line || ''); actions('life-dialog-actions', life?.interaction?.actions || []); }
  if (!enabled && $('life-dialog').open) $('life-dialog').close();
}
function accept(data) {
  snapshot = data; connected = true;
  if (data.presence?.surfaceId === surfaceId) presence = data.presence;
  const day = data.view.day; if (!day) throw new Error('첫 하루의 상태를 읽지 못했어요.');
  const story = bazaarActive() ? data.view.bazaar : day;
  text('day-title', day.title || names[day.location]); text('visit-label', `${day.visit || 1}번째 작은 하루`); text('speaker', story.speaker || names[day.location]); text('day-line', story.line || '');
  renderOptions(day); actions('day-actions', story.actions || []);
  const cafe = day.location === 'cafe' && !dayActive() && !bazaarActive(); $('cafe-first').hidden = !cafe;
  // WORLD departure is owned by DAY_MOVE. The old fixture LEAVE would suspend its clock.
  actions('ft-actions', cafe ? data.view.actions.filter(a => !['LEAVE', 'VISIT'].includes(a.type)) : []); text('ft-line', data.view.line);
  const observation = currentObservation(); $('observation').hidden = !observation; text('observation', observation?.line || '');
  renderBazaar(); renderSupport();
  $('job').hidden = !day.job || day.job.status === 'none'; text('job-label', day.job?.label || '');
  text('job-detail', day.job?.status === 'preparing' ? '준비는 맡겨 두고 다른 곳을 둘러봐도 좋아요.' : day.job?.status === 'ready' ? '공방에 들러 준비된 받침을 확인해요.' : '준비된 받침을 공방에서 함께 써요.');
  executionSample = null;
  if (day.location === 'cafe' && data.view.execution?.plan) {
    const execution = data.view.execution, plan = globalThis.LoomLife.createPlan(execution.plan);
    executionSample = globalThis.LoomLife.sample(plan, execution.elapsedMs, { currentRevision: plan.revision, currentPlanId: plan.id, committedStepIds: plan.steps.map(s => s.id), reducedMotion: reduced.matches || fallback });
  }
  text('connection', `${worldHostRequested ? (globalThis.__SYNK_WORLD_TOWN__?.mode === 'account' ? 'SYNK 계정에 저장됨' : '테스트 계정에 저장됨') : '이 기기에 저장됨'} · ${names[day.location] || ''}`); configurePlan(); renderScene(); renderLife(); setBusy(busy);
  if ($('journal-dialog').open) renderJournal();
  $('look-scene').hidden = !activePlan && !observation && !snapshot.view.life?.interaction?.resultId;
  reconcileWalk(); applyWalkView();
}
function renderJournal() {
  const lines = [...(snapshot?.view.notebook || []), ...(snapshot?.view.day?.history || []).map(row => row.summary), ...(snapshot?.view.bazaar?.history || []).map(row => row.summary)];
  $('journal-list').replaceChildren(...[...new Set(lines.filter(Boolean))].map(line => { const li = document.createElement('li'); li.textContent = line; return li; }));
  if (!$('journal-list').children.length) { const li = document.createElement('li'); li.textContent = '아직 함께한 일이 없어요. 찻집부터 들러 보세요.'; $('journal-list').append(li); }
}
function currentObservation() {
  if (!bazaarActive()) return snapshot?.view.day?.observation;
  const b = snapshot.view.bazaar, e = b.episode;
  if (e.stage !== 'result') return null;
  const h = b.history.find(row => row.resultId === e.resultId);
  return { resultId: e.resultId, line: b.line, allowed: !h?.observed && e.elapsedMs >= 1200 && b.scene.active };
}
function renderBazaar() {
  const b = snapshot.view.bazaar;
  const shown = !!b && snapshot.view.day.location === 'cafe' && !dayActive() && !snapshot.view.plan && !snapshot.view.execution && !snapshot.state.life?.episode?.open
    && (!bazaarActive() || b.requests?.length > 0);
  $('bazaar-panel').hidden = !shown;
  text('bazaar-line', bazaarActive() ? '손님이 직접 말한 요청을 보며 준비해요.' : b?.line || '');
  actions('bazaar-actions', shown && !bazaarActive() ? b.actions : []);
  const requests = b?.requests || [], sig = JSON.stringify(requests);
  if (signatures.get('bazaar-requests') !== sig) {
    signatures.set('bazaar-requests', sig);
    $('bazaar-requests').replaceChildren(...requests.map(r => { const card = document.createElement('p');
      card.className = 'request-card'; card.textContent = `${r.name}: ${r.line}${r.selected ? ` · 고른 잔: ${r.selected.menu === 'water' ? '물' : '차'}${r.selected.sweetener === 'sweet' ? ' + 단맛' : ''}` : ''}`; return card; }));
  }
}
function renderSupport() {
  const s = snapshot.view.support; if (!s) return;
  text('language-current', s.selection.mode === 'stepwise' ? '하나씩 설명을 듣고, 내 역할은 직접 골라요.' : '설명을 한 번에 보고, 필요하면 도움을 요청해요.');
  actions('language-options', [{ type: 'SUPPORT_SET', label: '하나씩 보여 주세요', payload: { mode: 'stepwise' } }, { type: 'SUPPORT_SET', label: '한 번에 볼게요', payload: { mode: 'plain' } }]);
  for (const b of $('language-options').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.mode === s.selection.mode));
  text('language-reason', s.proposal?.reason || '기록이 없어도 설명 방식과 기획 역할을 직접 고를 수 있어요.');
  actions('language-proposal', s.proposal ? [{ type: 'SUPPORT_ACCEPT', label: s.proposal.label, payload: { proposalId: s.proposal.id, kind: s.proposal.kind } }] : []);
  const r = s.reading;
  if (!r || !$('reading-dialog').open) return;
  text('reading-passage', r.item.passage); text('reading-question', r.item.question);
  $('reading-hint').hidden = !r.hint; text('reading-hint', r.hint || '');
  $('reading-feedback').hidden = !r.feedback; text('reading-feedback', r.feedback ? `${r.feedback.line} ${r.feedback.assisted ? '도움과 함께 답했어요.' : r.feedback.independent ? '이 안내문에 처음으로 도움 없이 답했어요.' : '전에 본 안내문을 다시 확인했어요.'}` : '');
  actions('reading-actions', r.answered ? [{ type: 'SUPPORT_NEXT', label: '다른 안내문 읽기', payload: { skill: r.item.skill } }] : [
    ...r.item.choices.map((label, choice) => ({ type: 'SUPPORT_ANSWER', label, payload: { presentationId: r.presentationId, choice } })),
    ...(!r.hint ? [{ type: 'SUPPORT_HINT', label: '힌트 보기', payload: { presentationId: r.presentationId } }] : [])]);
}
function observe(now) {
  if (!snapshot || !connected) return;
  // A passive acknowledgement must not briefly make controls busy and clear
  // a held direction. Resume its delivery after the player releases input.
  const passiveReady = !walking() || !walkInputActive && !walkMoving;
  const ctx = activePlan && { currentRevision: snapshot.state.worldRevision, currentPlanId: snapshot.view.plan?.id, committedStepIds: snapshot.view.committedStepIds, reducedMotion: reduced.matches || fallback };
  if (activePlan) {
    const good = sceneVisible() && !busy && (fallback ? visible($('ft-static')) : visible($('scene-caption')));
    const actualPaint = fallback || renderer?.stats().ready && renderer.stats().renderedSerial >= (pendingVisual?.serial ?? renderedRequest);
    if (good && pendingVisual && actualPaint) {
      for (const id of pendingVisual.ids) applied.add(id);
      if (pendingVisual.complete && planCompleteAt === null) planCompleteAt = planMs;
    }
    if (good && planLast != null) planMs += Math.min(100, Math.max(0, now - planLast)); planLast = good ? now : null;
    planSample = globalThis.LoomLife.sample(activePlan, planMs, ctx); renderScene();
    pendingVisual = good && planSample.status === 'ready' ? { serial: renderedRequest, ids: planSample.visualStepIds, complete: planSample.visualComplete } : null;
    const complete = passiveReady && good && planMs >= 2400 && planCompleteAt !== null && planMs - planCompleteAt >= 1200 && globalThis.LoomLife.canAcknowledge(activePlan, { ...ctx, visible: true, hidden: false, paused: false, assetsReady: true, appliedStepIds: [...applied] });
    if (complete && planPainted && !planAckPending) {
      planAckPending = true;
      command('ACK', { reactionId: snapshot.view.reaction.id, semanticKey: snapshot.view.reaction.semanticKey, activity: snapshot.state.activity || 'seat', worldRevision: snapshot.state.worldRevision,
        mode: reduced.matches || fallback ? 'static' : 'motion', appliedStepIds: [...applied], visible: true, assetsReady: true }).then(ok => { if (!ok) planAckPending = false; });
    }
    planPainted = complete;
  }
  const dayObservation = currentObservation();
  const lifeResult = lifeAvailable() && snapshot.view.life.interaction?.stage === 'result' && !snapshot.view.life.interaction.delivered ? snapshot.view.life.interaction : null;
  const target = dayObservation?.allowed ? { id: dayObservation.resultId, type: bazaarActive() ? 'BAZAAR_OBSERVED' : 'DAY_OBSERVED', element: $('observation') } : lifeResult ? { id: lifeResult.resultId, type: 'LIFE_ACK', element: $('observation') } : null;
  if (target?.id !== lastObservation) { lastObservation = target?.id || null; observedMs = 0; observedLast = null; observationPending = false; }
  const good = passiveReady && target && !activePlan && !executionSample && !busy && sceneVisible() && visible(target.element) && (fallback || renderer?.stats().renderedSerial >= renderedRequest);
  if (good && observedLast !== null) observedMs += Math.min(100, Math.max(0, now - observedLast)); observedLast = good ? now : null;
  if (good && observedMs >= 1200 && !observationPending) { observationPending = true; command(target.type, { resultId: target.id, visible: true }).then(ok => { if (!ok) observationPending = false; }); }
  const c = snapshot.view.life?.contact;
  const visibleContact = passiveReady && c?.state === 'issued' && lifeAvailable() && contactHere(c) && !busy && visible($('life-contact'));
  if (contactId !== c?.id) { contactId = c?.id || null; contactMs = 0; contactLast = null; contactPending = false; }
  if (visibleContact && contactLast !== null) contactMs += Math.min(100, Math.max(0, now - contactLast)); contactLast = visibleContact ? now : null;
  if (visibleContact && contactMs >= 300 && !contactPending) { contactPending = true; command('LIFE_ACK', { contactId, visible: true }).then(ok => { if (!ok) contactPending = false; }); }
}
function frame(now) { walkFrame(now); observe(now); raf = requestAnimationFrame(frame); }
async function load() {
  setBusy(true);
  try { await queue(async () => { walkPacket = null; walkPending = []; accept(await request('state')); clearError(); await pulseNow(); }); }
  catch (error) { showError(error.message); }
  finally { setBusy(false); }
  // A failed first walk-enable has no saved walking state. Retry must finish
  // entering the walking view too, instead of leaving a connected classic UI.
  if (connected && walkWanted && !fallback && !snapshot.state.day.walk?.enabled && await command('DAY_WALK_ENABLE')) {
    camera = 'follow'; updateCameraControl(); renderScene(); applyWalkView();
  }
}
async function openLife(source) {
  const payload = { source }; if (source === 'contact') payload.contactId = snapshot.view.life.contact?.id;
  if (await command('LIFE_OPEN', payload)) { $('life-dialog').showModal(); renderLife(); setBusy(false); }
}
function closeLife() { $('life-dialog').close(); command('LIFE_CLOSE'); }
$('life-open').addEventListener('click', () => openLife('direct'));
$('life-contact-open').addEventListener('click', () => openLife('contact'));
$('life-resume').addEventListener('click', () => command('LIFE_RESUME'));
$('life-close').addEventListener('click', closeLife);
$('life-dialog').addEventListener('cancel', event => { event.preventDefault(); closeLife(); });
$('settings-open').addEventListener('click', () => $('settings-dialog').showModal()); $('settings-close').addEventListener('click', () => $('settings-dialog').close());
$('reading-open').addEventListener('click', async () => {
  if (await command('SUPPORT_OPEN', { skill: snapshot.view.day.location === 'workshop' ? 'detail' : 'sequence' })) {
    $('settings-dialog').close(); $('reading-dialog').showModal(); renderSupport(); setBusy(false);
  }
});
function closeReading() { $('reading-dialog').close(); command('SUPPORT_CLOSE').then(() => { $('settings-dialog').showModal(); renderSupport(); }); }
$('reading-close').addEventListener('click', closeReading);
$('reading-dialog').addEventListener('cancel', event => { event.preventDefault(); closeReading(); });
$('journal-open').addEventListener('click', () => { renderJournal(); $('journal-dialog').showModal(); }); $('journal-close').addEventListener('click', () => $('journal-dialog').close());
$('retry').addEventListener('click', load);
$('look-scene').addEventListener('click', () => $('scene').scrollIntoView({ block: 'start', behavior: reduced.matches ? 'instant' : 'smooth' }));
function updateCameraControl() {
  const label = walking() ? { follow: '가까이 보기', close: '동네 보기', wide: '멀리서 걷기' }[camera] : camera === 'close' ? '동네 보기' : '가까이 보기';
  text('camera-toggle', label); $('camera-toggle').dataset.camera = camera; document.body.dataset.camera = camera;
  $('camera-toggle').removeAttribute('aria-pressed');
  $('camera-toggle').setAttribute('aria-label', `${{follow:'멀리서 걷기',close:'가까이',wide:'동네 전체'}[camera]} 시점 · ${label}`);
}
$('camera-toggle').addEventListener('click', () => {
  camera = walking() ? {follow:'close',close:'wide',wide:'follow'}[camera] || 'follow' : camera === 'wide' ? 'close' : 'wide';
  updateCameraControl(); renderScene();
});
$('walk-interact').addEventListener('click', interactWalk); $('walk-close').addEventListener('click', dismissWalkPanel);
for (const button of $('contact-options').querySelectorAll('button')) button.addEventListener('click', () => command('LIFE_PREFERENCE', { mode: button.dataset.mode }));
for (const value of ['balanced', 'experience']) $(`quality-${value}`).addEventListener('click', () => { quality = value; for (const v of ['balanced', 'experience']) $(`quality-${v}`).setAttribute('aria-pressed', String(v === quality)); renderScene(); });
const noteIds = ['note-choice', 'note-autonomy', 'note-comfort'];
try { const note = JSON.parse(localStorage.getItem('synk-town-day-play-notes') || '{}'); for (const id of noteIds) $(id).value = note[id] || ''; } catch {}
function notes() { return { kind: 'self-guided-developer-play-notes', recordedAt: new Date().toISOString(), participantStudy: false, ...Object.fromEntries(noteIds.map(id => [id, $(id).value])) }; }
$('play-notes').addEventListener('submit', event => { event.preventDefault(); try { localStorage.setItem('synk-town-day-play-notes', JSON.stringify(notes())); text('notes-status', '이 기기에 저장했어요.'); } catch { text('notes-status', '메모 파일 받기로 보관해 주세요.'); } });
$('notes-export').addEventListener('click', () => { const blob = new Blob([JSON.stringify(notes(), null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'synk-town-play-notes.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseWalkInput(); pulse(); }); window.addEventListener('online', () => { if (!connected) load(); });
window.addEventListener('blur', () => { if (walking()) { pauseWalkInput(); pulse(); } }); window.addEventListener('focus', () => { if (walking()) pulse(); });
window.addEventListener('pagehide', () => {
  if (raf !== null) cancelAnimationFrame(raf); walkControls?.dispose(); renderer?.dispose();
  const stopped = { surfaceId, surface: 'day', foreground: false, safe: false };
  if (worldHostRequested) { worldHost?.request('presence', stopped).catch(() => {}); worldHost?.dispose(); }
  else fetch('/api/preview/presence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true, body: JSON.stringify(stopped) }).catch(() => {});
});
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
reduced.addEventListener('change', () => { resetPlan(); configurePlan(); renderScene(); });
try {
  if (!worldHostRequested && !['127.0.0.1', 'localhost'].includes(location.hostname)) throw new Error('첫 하루는 로컬 개발 체험에서 열어 주세요.');
  if (worldHostRequested) {
    worldTabNamespace = sessionStorage.getItem('synk-world-v1-tab');
    const { connectTownWorld } = await import(new URL((globalThis.__SYNK_WORLD_TOWN__?.basePath || '/') + 'world-town-client.mjs', location.origin).href);
    worldHost = await connectTownWorld({
      onAppearance: value => {
        worldAppearance = value; renderer?.setAppearance(value);
        if (connected && !value?.verified) { connected = false; pauseWalkInput(); showError('홈에서 계정을 다시 연결해 주세요.'); }
      },
      onError: error => { connected = false; pauseWalkInput(); showError(error?.message || '홈의 연결을 다시 확인해 주세요.'); },
    });
    // WORLD 안에서만 홈과 같은 짧은 누름 소리(리드 모듈). 없으면 조용히 넘어간다.
    import(new URL((globalThis.__SYNK_WORLD_TOWN__?.basePath || '/') + 'brand-opening/world-sound.mjs', location.origin).href).then(module => module.bindTaps?.(document)).catch(() => {});
  }
  await document.fonts.ready;
  await Promise.all([...document.images].map(img => img.complete && img.naturalWidth ? Promise.resolve() : img.decode()));
  try { renderer = createDayScene($('day-canvas'), { deferInitialRender: worldHostRequested, onDestination: id => { if (!walking()) command('DAY_MOVE', { location: id }); }, onError: useFallback, getInterfaceBounds: () => walking() && walkPanel ? $('nearby-panel').getBoundingClientRect() : null }); if (worldAppearance) renderer.setAppearance(worldAppearance); sceneReady = true; $('scene').dataset.renderer = 'webgl'; }
  catch (error) { useFallback(error); }
  if (worldHostRequested && renderer) await renderer.prepareInitialAssets?.();
  // An embedded town reopens with focus on the parent navigation button.
  // Acquire actual input focus before the first foreground lease; never spoof it.
  if (walkWanted && !fallback && !document.hidden) $('scene').focus({ preventScroll: true });
  await load();
  if (connected) {
    if (walkWanted && !fallback) { if (!snapshot.state.day.walk?.enabled) await command('DAY_WALK_ENABLE'); camera = 'follow'; updateCameraControl(); }
    else if (snapshot?.state.day.walk?.enabled) await command('DAY_WALK_DISABLE');
  }
  walkControls = createWalkControls({ surface: $('scene'), joystick: $('walk-joystick'), thumb: $('walk-thumb'), canMove: () => walking() && connected && !busy,
    onInteract: interactWalk, onCancel: dismissWalkPanel, onMoveStart: dismissWalkPanel, onInputMode: mode => { walkInputMode = mode; } });
  renderScene(); applyWalkView(); if (walking()) $('scene').focus({ preventScroll: true });
  raf = requestAnimationFrame(frame); setInterval(pulse, 1000);
  setInterval(() => { if (renderer) text('scene-metrics', JSON.stringify(renderer.stats(), null, 2)); }, 3000);
} catch (error) { showError(error.message); }

// Read-only instrumentation for the isolated QA runner. It cannot mutate state or time.
globalThis.SYNKTownDay = Object.freeze({ metrics: () => ({ ...(renderer?.stats() || { renderer: 'text-alternative' }), reducedMotion: reduced.matches, connected, fallback, worldLinked: worldHostRequested,
  walk: { enabled: walking(), ...walkPoint, heading: walkHeading, moving: walkMoving, inputActive: walkInputActive, nearby: nearby(walkPoint), interactionOpen: walkPanel, input: walkInputMode,
    pending: walkPending.length, pendingMs: walkPending.reduce((n, s) => n + s.durationMs, 0), sending: !!walkFlushing, backpressured: walkBackpressured,
    correctionDistance: walkCorrectionDistance, maxCorrection: walkMaxCorrection } }), snapshot: () => structuredClone(snapshot) });
