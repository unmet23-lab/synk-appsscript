import { createDayScene } from './day-scene.mjs';
import { createWalkControls } from './walk-controls.mjs';
import { nearbyPlace, WALK_SPAWNS } from './walk.mjs';
import { createWalkPackets } from './walk-packets.mjs';
import { createDayObservation } from './day-observation.mjs';
import { PLACE_BY_ID, PLAYER_PLACES, SPOT_BY_ID } from './town/places.mjs';
import { placeAt, caption, doing, goalOf } from './town/village.mjs';
import { lightAt } from './town/light.mjs';
import { validOffset } from './town/clock.mjs';
import { createMoodLines, moodAt } from './day-mood.mjs';
import { createOffer, offerModel, placeModel, takeModel, sceneLine, pairSteps, lineText, iconSvg, FEEDBACK, NAMES as CARD_NAMES } from './day-cards.mjs';
import { createNotebook } from './day-notebook.mjs';
import { createStay } from './day-stay.mjs';
import { createTownSound } from './day-sound.mjs';
import { QUIET } from './town/stay.mjs';

const $ = id => document.getElementById(id);
const surfaceId = crypto.randomUUID(), reduced = matchMedia('(prefers-reduced-motion: reduce)');
// Staying and the village's sound (W7b): the seat's quiet view and the two sound buses, on this device only.
const sound = createTownSound({ surfaceId });
// walkWarm is false between standing up and the zero step's receipt: steps wait for the walk clock to stand again.
let stay = null, stayPoint = null, villageWalking = false, appTimer = 0, lightPaintedAt = 0, seatedRetry = 0, walkWarm = true;
const unlockSound = () => sound.unlock();
addEventListener('pointerdown', unlockSound, { capture: true, passive: true }); addEventListener('keydown', unlockSound, true);
// A touch's pointerdown is no user activation: phones (iPhones above all) let the sound start only in touchend or click.
for (const type of ['touchend', 'click']) addEventListener(type, unlockSound, { capture: true, passive: true });
const names = Object.fromEntries(PLAYER_PLACES.map(id => [id, PLACE_BY_ID[id].labels.map]));
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
  if (walk.point) { const left = mapX(walk.point.x).toFixed(1) + '%', top = mapY(walk.point.z).toFixed(1) + '%'; if (me.style.left !== left) me.style.left = left; if (me.style.top !== top) me.style.top = top; }
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
let camera = 'wide', quality = 'balanced', renderedRequest = 0, executionSample = null, raf = null;
// What this window may acknowledge from frames it painted (the plan's ACK, a result, a contact): day-observation.mjs.
const watch = createDayObservation({ loom: () => globalThis.LoomLife });
const signatures = new Map();
// The living village (W3, §14-4): the window's estimate of the server's clock, the residents it draws
// from the plan every frame, and the F11 heartbeat's reads and boundaries.
const RESIDENT_IDS = ['cafe-owner', 'workshop-owner', 'researcher'], BOUNDARY_GAP_MS = 20000;
let clockOffset = null, villageLive = { ids: new Set(), signature: '' };
let reading = false, bounding = false, lastBoundary = 0, dueReadAt = 0;
// The small need cards (W5b): what this window can draw (caps — dropped for good when an older host refuses it), the
// keys of what it showed waiting for the next boundary (§20-2 — one showing of one happening counts once), the
// greeting and the offer receipt in flight.
let capsOk = true, cardOfferUi = null, notebook = null, greeted = new Set(), offerAckPending = null, offerSeenAt = null, offerGesture = null;
const seenQueue = new Set(), seenTags = new Set(), SEEN_PER_REQUEST = 50;
/** Record keys the screen really showed — never while seated (the seat's quiet view shows none, W7b). */
function noteSeen(keys, occurrence = '') {
  if (stay?.active()) return;
  for (const key of keys || []) { const tag = `${key}|${occurrence}`; if (seenTags.has(tag)) continue; seenTags.add(tag); seenQueue.add(key); }
}
// A WORLD page opened before the town learned pulse·boundary keeps an older host that answers only presence — its
// town client or its account bundle refuses the operation (either may still come from the 10-minute cache) — and
// a PC app released before those routes says so by its code: this window then falls back to the old heartbeat
// (a presence each second, the whole town each time).
let legacyHost = false;
const walkWanted = new URLSearchParams(location.search).get('controls') !== 'classic';
let walkControls = null, walkPanel = false, walkFlushing = null, walkInputMode = matchMedia('(pointer: coarse)').matches ? 'touch' : 'keyboard', walkViewSignature = null;
// The predicted walk and the input the host has not receipted: walk-packets.mjs. This file sends its packets.
const walk = createWalkPackets();
const walking = () => walkWanted && !fallback && snapshot?.state.day?.walk?.enabled === true;
const nearby = point => { const value = point && nearbyPlace(point); return typeof value === 'string' ? value : value?.id || value?.location || null; };
function dismissWalkPanel() { walkPanel = false; document.body.classList.remove('walk-engaged'); }
function pauseWalkInput() { walkControls?.stop(); walk.halt(); if (!walkFlushing) reconcileWalk(); }
function applyWalkView(force = false) {
  const enabled = walking(), place = enabled ? nearby(walk.point) : null;
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
  text('walk-help', walkInputMode === 'gamepad' ? '왼쪽 스틱 · 방향 패드 이동 / A 이야기 / X 앉기 / B 닫기' : walkInputMode === 'touch' ? '조이스틱으로 걷고, 가까이 가면 이야기해요' : 'WASD · 방향키로 걷기 / E 이야기 / F 앉기 / Esc 닫기');
}
/** What the seats need to know (W7b): where the player walks, whether a seat may be offered now, and the light. */
function stayContext() {
  const location = snapshot?.view.day?.location;
  return { walking: walking(), point: walk.point, connected, busy, dialog: !!document.querySelector('dialog[open]'), panel: walkPanel, inputMode: walkInputMode, location,
    homePanel: walking() ? walkPanel && location === 'home' : location === 'home', light: lightShown };
}
/** The village's sound now (W7b): the seat or the walking player listens, at the server's hour and the village's weather. */
function soundFrame() {
  const v = snapshot?.view.day?.scene?.village, seat = stay?.seat(), at = serverNow() ?? v?.nowMs ?? null;
  if (!snapshot || !Number.isSafeInteger(at)) return;
  const place = PLACE_BY_ID[snapshot.view.day.location]?.center;
  const listener = seat ? { x: seat.x, z: seat.z, sheltered: seat.sheltered } : walking() && walk.point ? { x: walk.point.x, z: walk.point.z, sheltered: renderer?.shelteredAt?.(walk.point.x, walk.point.z) } : place ? { x: place.x, z: place.z } : null;
  const t = v ? Math.min(v.band.endMs - 1, Math.max(v.nowMs, at)) : at;
  sound.update({ light: lightShown, ms: at, listener, awake: v ? { 'cafe-owner': !!placeAt(v.segments, 'cafe-owner', t, v.startSpots) } : {}, staying: !!seat,
    dialog: !!document.querySelector('dialog[open]') || walkPanel, hidden: document.hidden });
}
function reconcileWalk() {
  if (!walking()) return;
  walk.reconcile(snapshot.state.day.walk);
  renderer?.setPlayerPose?.(walk.pose()); applyWalkView(true);
}
/** Sends the pending walk as one packet, signed with the lease's fence and the revision it was predicted on.
 * One packet is in flight at a time; a forced flush (before an interaction) waits for it and sends the rest. */
async function flushWalk(force = false) {
  if (walkFlushing) { if (force) { await walkFlushing; return flushWalk(true); } return; }
  if (!walking() || !connected || !walk.pendingParts) return;
  walk.take(performance.now());
  walkFlushing = queue(async () => {
    await ensureFreshPresence();
    const value = await request('command', { id: crypto.randomUUID(), type: 'DAY_WALK', payload: { segments: walk.inflight, surfaceId, fence: presence.fence }, expectedRevision: snapshot.state.revision });
    walk.settle(); accept(value);
  }).catch(error => { walk.discard(); walkControls?.stop(); showError(error.message); }).finally(() => { walkFlushing = null; applyWalkView(); });
  return walkFlushing;
}
async function interactWalk() {
  if (!walking() || busy || !connected) return;
  if (walkPanel) { const action = $('nearby-panel').querySelector('button[data-command]:not(:disabled)'); if (action) action.click(); return; }
  walkControls?.stop(); await flushWalk(true); const place = nearby(walk.point); if (!place) return;
  if (await command('DAY_INTERACT', { location: place })) { walkPanel = true; placeOpens++; applyWalkView(); renderCards(); }
}
function walkFrame(now) {
  if (!walking() || !walkControls || !walk.point) { walk.idle(); return; }
  const due = walk.step(now, walkControls.read(), walkWarm);
  renderer?.setPlayerPose?.(walk.pose()); paintMap(nearby(walk.point));
  if (due) flushWalk();
  applyWalkView(); stay?.update(stayContext());
}

function text(id, value = '') { if ($(id).textContent !== value) $(id).textContent = value; }
function queue(work) { const next = tail.then(work, work); tail = next.catch(() => {}); return next; }
function showError(message) {
  connected = false; presence = null; walkControls?.stop(); document.body.classList.add('walk-error'); text('error', message); $('error').hidden = false; $('retry').hidden = false; text('connection', '연결을 다시 확인해 주세요'); setBusy(false);
  // Seated, a dropped connection asks nothing of the hands (W7b): the seat and its sound stay, and the town tries again.
  if (stay?.active()) { clearTimeout(seatedRetry); seatedRetry = setTimeout(() => { if (stay?.active() && !connected) load(); }, QUIET?.lightMs ?? 10000); }
}
function clearError() { document.body.classList.remove('walk-error'); $('error').hidden = true; $('retry').hidden = true; }
function available() { return connected && snapshot?.capabilities?.day === true; }
function setBusy(value) {
  busy = value; $('day-app').setAttribute('aria-busy', String(value));
  for (const b of document.querySelectorAll('[data-command], [data-destination], [data-mode], #life-open, #life-contact-open, #life-resume')) b.disabled = value || !available() || b.dataset.unavailable === 'true';
  stay?.update(stayContext());
}
// state and command answer with the whole town; pulse and boundary with a few fields (vertical slice §14-3, F11).
// The old heartbeat (presence) answers the whole town like a read — without worldSeq on an account's town.
const answered = (path, result) => ['state', 'command', 'presence'].includes(path) ? !!(result?.state && result.view && result.capabilities?.day) : Number.isSafeInteger(result?.worldSeq);
async function request(path, body) {
  if (worldHostRequested) {
    if (!worldHost) throw new Error('홈의 계정 연결을 확인하고 있어요.');
    if (sessionStorage.getItem('synk-world-v1-tab') !== worldTabNamespace || (globalThis.__SYNK_WORLD_TOWN__?.mode !== 'account' && sessionStorage.getItem('synk-world-v1-signed-out'))) {
      connected = false; pauseWalkInput(); location.reload(); throw new Error('계정 연결을 새로 확인하고 있어요.');
    }
    const result = await worldHost.request(path, body);
    if (!answered(path, result)) throw new Error(result?.message || '이 계정의 타운을 열 수 없어요.');
    return result;
  }
  const response = await fetch(`/api/preview/${path}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' } : { cache: 'no-store' });
  const result = await response.json();
  if (!response.ok || !answered(path, result)) throw Object.assign(new Error(result.message || '첫 하루를 열 수 없어요. 개발 체험 서버를 확인해 주세요.'), { status: response.status });
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
/** A place where a resident's card may wait for the player (W5b): the player stands still by it, nothing else is going on. */
function cardPlaceQuiet() {
  const location = snapshot?.view.day?.location, v = snapshot?.view.day?.scene?.village;
  return !!v && ['cafe', 'workshop', 'greenhouse'].includes(location) && !dayActive() && !bazaarActive() && !snapshot.view.plan && !snapshot.view.execution && !v.take
    && (!walking() || nearby(walk.point) === location && !walk.moving && !walk.inputActive);
}
function flags() {
  const editing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
  // A seated window is in front while it is seen, focused or not (W7b): the town beside a study window is still with
  // the person — it is never a spoofed focus, and it walks nowhere.
  return { surfaceId, surface: 'day', foreground: !document.hidden && (!walking() || document.hasFocus() || !!stay?.active()) && sceneReady && connected,
    safe: !!((lifeAvailable() && (!walking() || nearby(walk.point) === 'cafe' && !walk.moving && !walk.inputActive) || cardPlaceQuiet())
      && !busy && !document.querySelector('dialog[open]') && !editing && sceneVisible()) };
}
async function pulseNow() {
  // The host lease starts when the request is processed, not when a slow GPU
  // frame/network finally lets the browser consume the response.
  const requestedAt = performance.now();
  if (legacyHost) {
    const data = await request('presence', flags()); lastPulse = requestedAt;
    syncClock(data.serverNow, requestedAt, performance.now()); accept(data); return;
  }
  let data;
  try { data = await request('pulse', flags()); }
  catch (error) {
    if (error?.code === 'TOWN_PULSE_UNSUPPORTED' || /Unknown town operation|Unsupported WORLD request/.test(error?.message || '')) { legacyHost = true; return pulseNow(); }
    throw error;
  }
  lastPulse = requestedAt;
  syncClock(data.serverNow, requestedAt, performance.now());
  if (data.presence?.surfaceId === surfaceId) presence = data.presence;
  // A pulse only keeps the lease (F11): the town is read again only when the world was written.
  if (data.worldSeq !== snapshot?.state.writeSeq) read();
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
function read() {
  if (reading || !connected) return;
  reading = true;
  queue(async () => accept(await request('state'))).catch(e => showError(e.message)).finally(() => { reading = false; });
}
/** The window holding the town says it is at a safe point, at most every 20 seconds (§14-3): the world
 * settles there and may issue a contact. Another window holding the town is no error here. */
function boundary() {
  if (bounding || legacyHost || !presence?.owner) return;
  bounding = true; lastBoundary = performance.now();
  // A screen that draws the cards says so (W5b, review F6) — not while seated (no offer reaches a quiet seat) — and
  // carries what it showed (§20-2, up to a request's worth).
  const caps = capsOk && !stay?.active() ? ['cards'] : null, seen = [...seenQueue].slice(0, SEEN_PER_REQUEST);
  queue(async () => {
    const data = await request('boundary', { surfaceId, fence: presence.fence, ...(caps ? { caps } : {}), ...(seen.length ? { seen } : {}) });
    for (const key of seen) seenQueue.delete(key);
    if (data.issued || data.worldSeq !== snapshot?.state.writeSeq) accept(await request('state'));
  }).catch(error => {
    // An older PC app's WORLD window takes no caps: this window goes on as one that does not draw the cards' offers.
    if (caps && error?.code === 'INVALID_REQUEST') { capsOk = false; return; }
    if (error.status !== 409) showError(error.message);
  }).finally(() => { bounding = false; });
}
/** Whether the world runs a timer of its own now (a scene's stage, C1, a bazaar step, a guest's use):
 * only then the screen reads every second. Otherwise the world moves when the window does something. */
function timed() {
  const v = snapshot?.view, e = v?.day?.episode, b = v?.bazaar?.episode;
  return !!(e?.open && e.location === v.day.location && ['demonstration', 'rehearsal', 'executing', 'explaining'].includes(e.stage))
    || v?.life?.interaction?.stage === 'executing' || !!v?.execution
    || bazaarActive() && (['demonstration', 'rehearsal', 'preparing', 'serving', 'installing', 'looking'].includes(b.stage) || b.stage === 'result' && b.elapsedMs < 1200);
}
/** The next server time the town changes by the clock alone: a band ends, a resident wakes or goes to
 * sleep (a scene may begin or not), a prepared job is ready. The screen reads then (W3). */
function dueAt() {
  // Judged at the time the view was drawn: what changes after it is due, however late the window looks.
  const v = snapshot?.view.day?.scene?.village, times = [];
  if (v) {
    times.push(v.band.endMs);
    // The place's line says what its own resident is doing (the cafe owner, the researcher), and the place's panel which
    // of its cards still waits (W5b — the workshop's too, review B3): read when that turns.
    const named = { cafe: 'cafe-owner', workshop: 'workshop-owner', greenhouse: 'researcher' }[snapshot.view.day.location];
    for (const seg of named ? v.segments.filter(s => s.npc === named) : []) for (const at of [seg.startMs, seg.arriveMs, seg.endMs]) if (at > v.nowMs) times.push(at);
    for (const id of RESIDENT_IDS) {
      const mine = v.segments.filter(s => s.npc === id), up = mine.some(s => s.startMs <= v.nowMs);
      const next = up ? Math.max(...mine.map(s => s.endMs)) : Math.min(...mine.map(s => s.startMs));
      if (Number.isFinite(next)) times.push(next);
    }
  }
  const job = snapshot?.state.day?.job;
  if (job?.status === 'preparing') times.push(job.readyAt);
  return times.length ? Math.min(...times) : null;
}
/** The heartbeat (F11): a pulse each second keeps the lease and the server's clock; a timed world is read
 * every second; a due time is read once (again after 2 seconds if the server had not reached it yet);
 * a safe window offers a boundary every 20 seconds. */
function tick() {
  soundFrame();
  if (!snapshot?.capabilities?.day || !connected) return;
  // Seated, the pulse comes less often but always inside the lease (W7b — the walk clock and play time go on).
  if (!stay?.active() || performance.now() - lastPulse >= QUIET.pulseMs - 500) pulse();
  // A hidden window keeps its lease and reads again when it is shown; an older host's presence brings the whole town.
  if (document.hidden || legacyHost) return;
  const now = performance.now(), t = serverNow(), due = dueAt();
  if (timed()) read();
  else if (due !== null && t !== null && t >= due && now >= dueReadAt) { dueReadAt = now + 2000; read(); }
  if (now - lastBoundary >= BOUNDARY_GAP_MS && flags().safe) boundary();
}
async function command(type, payload = {}) {
  if (busy || !available()) return false;
  setBusy(true);
  try {
    await queue(async () => {
      if (/^(DAY_|LIFE_|BAZAAR_|SUPPORT_|CARD_|GREET$)/.test(type)) {
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
/** A command the player asked for from a layer that does not wait on busy (an offer's answer, closing a card): it goes
 * once the receipt or read in flight is done, instead of being dropped. */
async function freeCommand(type, payload = {}) {
  for (let i = 0; i < 30 && busy; i++) await new Promise(resolve => setTimeout(resolve, 100));
  return command(type, payload);
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
function configurePlan() { watch.configurePlan(snapshot.view.day.location === 'cafe' ? snapshot.view.plan : null); }
/** The server's clock as this window knows it: each pulse answer carries serverNow (null before the first). */
function serverNow() { return clockOffset === null ? null : Math.round(performance.now() + clockOffset); }
function syncClock(serverAt, sentAt, receivedAt) {
  if (!Number.isSafeInteger(serverAt)) return;
  const sample = serverAt - (sentAt + receivedAt) / 2;
  // Smooth the network's jitter; a jump (a sleeping laptop, a changed clock) is taken at once.
  clockOffset = clockOffset === null || Math.abs(sample - clockOffset) > 2000 ? sample : clockOffset + (sample - clockOffset) * .25;
}
/** Each resident at the server's time (§14-4 — the same placeAt the host runs): where the plan has it, or
 * where a scene holds it once it has walked over (review P2-2). One the cafe's own scene draws (hidden) is
 * left to that scene. Reduced motion shows where a walking resident is going, not each step. */
function villageRows(v) {
  const t = Math.min(v.band.endMs - 1, Math.max(v.nowMs, serverNow() ?? v.nowMs)), places = {}, rows = [], still = reduced.matches || fallback;
  for (const id of RESIDENT_IDS) {
    const at = placeAt(v.segments, id, t, v.startSpots), hold = v.holds?.[id];
    places[id] = at;
    if (v.hidden?.includes(id)) continue;
    if (hold && !(at?.walking && at.archetype === 'reserved')) rows.push({ ...hold, id, held: true });
    else if (!at) rows.push({ id, asleep: true });
    else {
      const point = at.walking && still ? SPOT_BY_ID[at.spot].at : at;
      // A card's owner offering it gestures for its first seconds (§8-3 몸짓 8초) — where it stands, never mid-walk.
      const pose = at.walking && still ? 'standing' : !at.walking && offerGesture === id ? 'inviting' : at.pose;
      rows.push({ id, x: point.x, z: point.z, pose, goal: goalOf(at), live: true, archetype: at.archetype, walking: at.walking });
    }
  }
  // Two residents on one spot (a two-seat spot, or a plan spot under a scene's) stand apart; a walker passes through.
  const placed = [];
  for (const row of rows) {
    if (row.asleep) continue;
    if (row.live && !row.walking) for (let i = 0; i < 3 && placed.some(p => Math.hypot(p.x - row.x, p.z - row.z) < .35); i++) row.x += .55;
    placed.push(row);
  }
  // Every resident's plan state is in it — one the cafe's own scene draws (hidden) still turns the captions.
  const signature = RESIDENT_IDS.map(id => { const row = rows.find(r => r.id === id), at = places[id];
    return `${id}:${!row ? 'hidden' : row.held ? 'held' : row.asleep ? 'asleep' : 'live'}:${at ? `${at.archetype}:${at.walking}` : 'asleep'}`; }).join('|');
  return { t, rows, places, signature };
}
/** The cafe owner's line in the life panel: C1's own while it holds the owner, else the plan's now. */
function ownerLine(places) {
  const b = snapshot.view.life?.background; if (!b) return '';
  if (b.phase !== 'free' || !places) return b.line || '';
  const at = places['cafe-owner'];
  return at ? `${roleNames['cafe-owner']}은 ${doing(at)[1]}.` : `${roleNames['cafe-owner']}은 지금 자고 있어요.`;
}
function currentScene() {
  const scene = { ...snapshot.view.day.scene, memories: (snapshot.state.day?.history || []).map(({ resultId, kind, role, choice, location }) => ({ resultId, kind, role, choice, location })) };
  // Residents follow the plan at the server's time now; the server's npcs were drawn at its own moment.
  const village = scene.village ? villageRows(scene.village) : null;
  if (village) {
    scene.npcs = [...(scene.npcs || []).filter(n => !RESIDENT_IDS.includes(n.id)), ...village.rows.filter(r => !r.asleep)];
    if (snapshot.state.day?.job?.status !== 'preparing') scene.summary = caption(village.places);
    // The cafe's own scene never draws an owner the plan has asleep (the night rule, §4-2 A) — unless a guest's
    // use or reaction begun before bedtime is playing: a scene begun goes on.
    scene.ownerAsleep = scene.village.sleeps === true && !village.places['cafe-owner'] && !executionSample && !watch.sample;
    scene.villageSignature = village.signature; scene.ownerLine = ownerLine(village.places);
  }
  if (walking() && walk.point) { scene.player = { ...walk.point, heading: walk.heading, pose: walk.moving ? 'walking' : 'standing' }; scene.freeWalk = true; }
  if (bazaarActive() && snapshot.view.bazaar.scene?.active) {
    const b = snapshot.view.bazaar.scene;
    scene.npcs = [...(scene.npcs || []).filter(n => !b.npcs?.some(v => v.id === n.id)), ...(b.npcs || [])];
    scene.props = [...(scene.props || []).filter(p => !b.props?.some(v => v.id === p.id)), ...(b.props || [])];
    scene.summary = b.summary; scene.cafeReserved = true;
    return scene;
  }
  if (snapshot.view.day.location === 'cafe' || walking()) {
    scene.legacy = { ...snapshot.view.scene, active: walking() || !!watch.plan || !!executionSample || !dayActive() || !!snapshot.state.life?.episode?.open };
    if (executionSample || watch.sample) scene.legacyActors = (executionSample || watch.sample).actors;
    // C1 draws the owner (and its cup) only while its scene holds the owner (W3); otherwise the plan does.
    else if (snapshot.view.life?.background?.owner) scene.lifeHold = snapshot.view.life.background;
  }
  return scene;
}
/** The residents the plan moves every frame in the scene just drawn: live rows another layer (FT10's
 * guest use, C1, the bazaar) does not draw this frame. */
function liveIds(scene) {
  const ids = new Set((scene.npcs || []).filter(n => n.live).map(n => n.id));
  if (scene.legacyActors?.owner || scene.lifeHold?.owner) ids.delete('cafe-owner');
  return ids;
}
function renderScene() {
  if (!snapshot) return;
  const day = snapshot.view.day, scene = currentScene();
  villageLive = { ids: liveIds(scene), signature: scene.villageSignature ?? '' };
  if (scene.ownerLine !== undefined) text('life-background', scene.ownerLine);
  const background = lifeAvailable() ? scene.ownerLine ?? snapshot.view.life.background?.line : null;
  const sample = executionSample || watch.sample;
  const description = watch.plan || executionSample ? (sample?.visualComplete ? snapshot.view.line : stepLines[sample?.activeStepId] || '손님이 고른 자리를 사용해요.') : bazaarActive() ? snapshot.view.bazaar.line : dayActive() ? day.line : background || scene.summary || scene.line || day.line;
  $('scene').setAttribute('aria-label', `${names[day.location] || day.location}. ${description}`); text('scene-caption', description); if (!walking()) text('scene-badge', names[day.location] || day.location);
  text('fallback-title', names[day.location] || day.location); text('fallback-line', description);
  // The text alternative also says each resident's line now — its card's, its pair's or its mind's (W4 screen review F12, W5b).
  const sv = scene.village, lineNow = id => { if (!sv || !RESIDENT_IDS.includes(id)) return null; const t = Math.min(sv.band.endMs - 1, Math.max(sv.nowMs, serverNow() ?? sv.nowMs));
    const lineId = residentLine(sv, id, t)?.id || moodAt(sv.segments, id, t); return lineId ? lineText(lineId) : null; };
  const people = (scene.npcs || []).filter(n => !n.location || n.location === day.location).map(n => { const said = lineNow(n.id);
    return `${n.name || roleNames[n.id] || n.id}: ${n.line || n.activityLabel || n.actionLabel || n.goal || '자기 일을 하고 있어요.'}${said ? ` 「${said}」` : ''}`; });
  const peopleSig = JSON.stringify(people);
  if (signatures.get('people') !== peopleSig) { signatures.set('people', peopleSig); $('fallback-people').replaceChildren(...people.map(p => { const li = document.createElement('li'); li.textContent = p; return li; })); }
  if (renderer) {
    try { renderedRequest = renderer.render(scene, { reducedMotion: reduced.matches, quality, camera: walking() ? camera : watch.plan || executionSample ? 'close' : camera }); sceneReady = renderer.stats().ready; }
    catch (error) { useFallback(error); }
  }
  const staticFT = !!watch.plan && fallback; $('ft-static').hidden = !staticFT;
  if (staticFT) {
    const steps = watch.plan.steps.map(s => stepLines[s.id] || '손님이 자리에서 쉬어요.');
    const sig = JSON.stringify(steps); if (signatures.get('static-steps') !== sig) { signatures.set('static-steps', sig); $('ft-static-steps').replaceChildren(...steps.map(s => { const li = document.createElement('li'); li.textContent = s; return li; })); }
  }
}
function useFallback(error) { fallback = true; sceneReady = true; walkControls?.stop(); renderer?.dispose(); renderer = null; $('day-canvas').hidden = true; $('scene-fallback').hidden = false; $('camera-toggle').hidden = true; $('scene').dataset.renderer = 'text-alternative'; text('scene-metrics', `장면 설명 대체 표시: ${error?.message || 'WebGL unavailable'}`); applyWalkView(); if (snapshot?.state.day.walk?.enabled) command('DAY_WALK_DISABLE'); }
function contactHere(contact) { return !!contact && presence?.owner && contact.issuedSurfaceId === surfaceId && contact.issuedFence === presence.fence; }
function renderLife() {
  const life = snapshot.view.life, enabled = lifeAvailable(); $('life-panel').hidden = !enabled;
  $('life-open').dataset.unavailable = String(!enabled); $('life-resume').hidden = !life?.restGuard;
  if (!snapshot.view.day.scene.village) text('life-background', life?.background?.line || '');
  const contact = life?.contact, shown = enabled && contactHere(contact) && ['issued', 'delivered'].includes(contact.state) && !$('life-dialog').open;
  $('life-contact').hidden = !shown; text('life-contact-line', shown ? contact.label : '');
  const result = enabled && life?.interaction?.stage === 'result' ? life.interaction : null;
  $('life-result').hidden = true; text('life-result', result?.line || ''); actions('life-result-actions', result?.actions || []);
  if (result && !snapshot.view.day.observation) { $('observation').hidden = false; text('observation', result.line); }
  if ($('life-dialog').open) { text('life-dialog-line', life?.interaction?.line || ''); actions('life-dialog-actions', life?.interaction?.actions || []); }
  if (!enabled && $('life-dialog').open) $('life-dialog').close();
}
/** The residents at the player's place now (W5b): there by the plan, not walking through. */
function residentsHere() {
  const v = snapshot?.view.day?.scene?.village, location = snapshot?.view.day?.location;
  if (!v || !location) return [];
  const { places } = villageRows(v);
  return RESIDENT_IDS.filter(id => places[id] && !places[id].walking && places[id].to === location);
}
// One greeting a talk (§9-4): the one shown stays until the player leaves the place or closes the panel, though the
// server already has the next thing that resident could tell.
let greetSession = null, placeOpens = 0;
// What of the place's panel has been in sight since when (§20-2 — only what really showed counts): the panel scrolls, on
// a phone at most 300px tall, so the greeting and each note line count by themselves inside it (final review F2).
const placeSeenSince = new Map();
function placePanelOpen() { return !walking() || walkPanel; }
/** The place's panel (W5b): who greets the player with what it heard, the cards whose owner is here — its need and
 * 「같이 해요」, or the paused one to go on with — and at home the news note by the door (newest three, no dates). */
function renderCards() {
  const v = snapshot.view.day?.scene?.village, location = snapshot.view.day?.location, panel = $('place-cards');
  const model = v && !dayActive() && !bazaarActive() ? placeModel({ location, residentsHere: residentsHere(), hearsay: v.hearsay || {}, cards: v.cards || [], news: v.news || [], take: v.take }) : null;
  const session = `${location}:${placeOpens}`;
  if (greetSession?.session !== session) greetSession = { session, greet: model?.greet ?? null };
  else if (!greetSession.greet && model?.greet && !greeted.has(model.greet.ref)) greetSession.greet = model.greet;
  const greet = greetSession.greet, shown = !!model && (!!greet || model.needs.length > 0 || model.note.length > 0);
  panel.hidden = !shown;
  if (!shown) { placeSeenSince.clear(); return; }
  const sig = JSON.stringify([greet?.ref, greet?.text, model.needs.map(n => [n.card, n.key, n.paused]), model.note.map(n => n.ref)]);
  if (signatures.get('place-cards') === sig) return;
  signatures.set('place-cards', sig); placeSeenSince.clear();
  const parts = [];
  if (greet) {
    const p = document.createElement('p'); p.className = 'place-greet';
    p.innerHTML = `<span class="place-icon">${iconSvg(greet.icon)}</span>`;
    const words = document.createElement('span'); words.textContent = `${CARD_NAMES[greet.npc]}: ${greet.text}`; p.append(words); parts.push(p);
  }
  for (const need of model.needs) {
    const row = document.createElement('div'); row.className = 'place-need';
    const line = document.createElement('p'); line.textContent = `${CARD_NAMES[need.owner]}: ${need.line || need.title}`;
    const go = document.createElement('button'); go.type = 'button'; go.className = 'felt primary'; go.textContent = need.paused ? '이어서 하기' : '같이 해요'; go.dataset.command = 'CARD_OPEN';
    go.addEventListener('click', () => openCard(need, 'direct'));
    row.append(line, go); parts.push(row);
  }
  if (model.note.length) {
    const note = document.createElement('div'); note.className = 'place-note'; note.setAttribute('role', 'group'); note.setAttribute('aria-label', '문 앞 쪽지');
    const head = document.createElement('p'); head.className = 'eyebrow'; head.textContent = '문 앞 쪽지'; note.append(head);
    const list = document.createElement('ul');
    for (const item of model.note) { const li = document.createElement('li'); li.dataset.ref = item.ref; li.dataset.card = item.card; li.innerHTML = `<span class="place-icon">${iconSvg('news')}</span>`; const t = document.createElement('span'); t.textContent = item.text; li.append(t); list.append(li); }
    const more = document.createElement('button'); more.type = 'button'; more.className = 'text-button'; more.textContent = '수첩에서 더 보기';
    more.addEventListener('click', () => notebook?.open('news', snapshot));
    note.append(list, more); parts.push(note);
  }
  panel.replaceChildren(...parts);
}
/** Whether a line of the place's panel has stood wholly inside the panel's box (and the window) for a moment. */
function heldInSight(key, el, now) {
  const box = $('nearby-panel').getBoundingClientRect(), r = el?.getBoundingClientRect();
  if (!r?.height || r.top < Math.max(0, box.top) - 1 || r.bottom > Math.min(innerHeight, box.bottom) + 1) { placeSeenSince.delete(key); return false; }
  if (!placeSeenSince.has(key)) placeSeenSince.set(key, now);
  return now - placeSeenSince.get(key) >= 1200;
}
/** The greeting and each note line count as shown once they have stood in sight a moment (§20-2); the greeting then
 * tells the server this resident said it (GREET — never the first-word budget, §9-4). */
function cardsFrame(now) {
  const panel = $('place-cards');
  const good = !panel.hidden && placePanelOpen() && !busy && connected && !stay?.active() && !document.querySelector('dialog[open]') && visible(panel, false);
  if (!good) { placeSeenSince.clear(); return; }
  const greet = greetSession?.greet, model = snapshot.view.day?.scene?.village;
  if (greet && !greeted.has(greet.ref) && model?.hearsay?.[greet.npc]?.ref === greet.ref && heldInSight(`greet:${greet.ref}`, panel.querySelector('.place-greet'), now)) {
    greeted.add(greet.ref); noteSeen(greet.seen, greet.ref);
    command('GREET', { npc: greet.npc, ref: greet.ref }).then(ok => { if (!ok) greeted.delete(greet.ref); });
  }
  if (snapshot.view.day.location === 'home') for (const li of panel.querySelectorAll('.place-note li')) if (heldInSight(`note:${li.dataset.ref}`, li, now)) noteSeen([`line:village.news.${li.dataset.card}.1`], li.dataset.ref);
}
async function openCard(c, source) {
  const payload = { card: c.card, key: c.key, source, ...(source === 'contact' ? { contactId: c.id } : {}) };
  if (await freeCommand('CARD_OPEN', payload)) renderCardDialog();
}
/** 「나와 함께」's panel (§8-3): the card, its owner's words, the choices the server allows, then the result with 「…」
 * (Atlas's four answers, §20-3). Closing before it is done leaves it 「하던 생활」 (CARD_CLOSE → paused). */
let cardFeedbackOpen = false, cardClosing = false;
function renderCardDialog() {
  const dialog = $('card-dialog'), m = takeModel(snapshot.view.day?.scene?.village?.take);
  if (!m) { if (dialog.open) dialog.close(); cardFeedbackOpen = false; return; }
  // A take still open (a reload, another window's answer) brings its panel back — not while this window is closing it.
  if (!dialog.open) { if (cardClosing || stay?.active()) return; cardFeedbackOpen = false; dialog.showModal(); }
  // What has the keyboard in the panel, so it stays there when a part is drawn again (screen review B2).
  const had = dialog.contains(document.activeElement) ? document.activeElement : null, hadChoice = had?.dataset.choice ?? null, hadAnswer = had?.dataset.feedback ?? null;
  text('card-title', m.title); text('card-owner-name', CARD_NAMES[m.owner]); text('card-line', m.line || '');
  if ($('card-icon').dataset.icon !== m.icon) { $('card-icon').dataset.icon = m.icon; $('card-icon').innerHTML = iconSvg(m.icon); }
  const choices = $('card-choices'), sig = JSON.stringify([m.card, m.done, m.choices]);
  if (signatures.get('card-choices') !== sig) {
    signatures.set('card-choices', sig);
    choices.replaceChildren(...(m.done ? [] : m.choices.map(c => { const b = document.createElement('button'); b.type = 'button'; b.className = 'felt'; b.textContent = c.label;
      b.setAttribute('aria-pressed', String(c.chosen)); b.dataset.command = 'CARD_CHOOSE'; b.dataset.choice = c.id;
      b.addEventListener('click', async () => { await command('CARD_CHOOSE', { choice: c.id }); refocusCard({ choice: c.id }); }); return b; })));
  }
  // The confirm waits for a choice (setBusy keeps it off while a command is out, by its data-unavailable).
  const confirm = $('card-confirm'); confirm.dataset.command = 'CARD_CONFIRM'; confirm.dataset.unavailable = String(!m.chosen);
  choices.hidden = m.done; confirm.hidden = m.done; confirm.disabled = busy || !available() || !m.chosen;
  text('card-note', m.done ? '고른 대로 남았어요. 닫아도 그대로예요.' : '닫으면 하던 생활로 남아요. 주인에게 다시 말을 걸면 이어서 해요.');
  const feedback = $('card-feedback'); feedback.hidden = !m.done || !m.eventId;
  if (m.done && m.eventId) {
    noteSeen([`line:${m.lineId}`, `card:${m.card}:player`], m.eventId);
    const given = (snapshot.state.prefs?.feedback || []).find(f => f.completionId === m.eventId)?.value ?? null, fsig = JSON.stringify([m.eventId, given, cardFeedbackOpen]);
    if (signatures.get('card-feedback') !== fsig) {
      signatures.set('card-feedback', fsig);
      const more = document.createElement('button'); more.type = 'button'; more.className = 'felt subtle feedback-more'; more.textContent = '…';
      more.setAttribute('aria-expanded', String(cardFeedbackOpen)); more.setAttribute('aria-label', '이 생활에 응답 남기기');
      more.addEventListener('click', () => { cardFeedbackOpen = !cardFeedbackOpen; renderCardDialog(); });
      const options = document.createElement('div'); options.className = 'feedback-options'; options.hidden = !cardFeedbackOpen; options.setAttribute('role', 'group'); options.setAttribute('aria-label', '응답');
      for (const [value, label] of FEEDBACK) { const b = document.createElement('button'); b.type = 'button'; b.className = 'felt'; b.textContent = label; b.setAttribute('aria-pressed', String(given === value)); b.dataset.command = 'FEEDBACK_GIVE'; b.dataset.feedback = value;
        b.addEventListener('click', async () => { cardFeedbackOpen = false; await command('FEEDBACK_GIVE', { completionId: m.eventId, value, canonicalActivityId: m.activity }); refocusCard(); }); options.append(b); }
      feedback.replaceChildren(more, options);
    }
  }
  // The control that had the keyboard was drawn again or hidden (「…」 opened or closed): the same one, else 「…」, else 닫기.
  if (had && (!had.isConnected || had.closest('[hidden]'))) refocusCard({ choice: hadChoice, answer: hadAnswer });
}
/** The keyboard back in the card panel (screen review B2): a command's buttons are disabled while it is out, which drops
 * the focus, and an answer draws them again — so after it the same choice or answer, else 「…」, else 닫기. Never when
 * the focus already sits elsewhere in the panel. */
function refocusCard({ choice = null, answer = null } = {}) {
  const dialog = $('card-dialog');
  if (!dialog.open || dialog.contains(document.activeElement) && document.activeElement !== dialog && !document.activeElement.closest('[hidden]') && document.activeElement.isConnected) return;
  const choices = $('card-choices'), feedback = $('card-feedback'), options = feedback.querySelector('.feedback-options');
  ((choice && !choices.hidden && [...choices.children].find(b => b.dataset.choice === choice))
    || (answer && options && !options.hidden && [...options.children].find(b => b.dataset.feedback === answer))
    || (!feedback.hidden && feedback.querySelector('.feedback-more')) || $('card-close')).focus();
}
function closeCard() {
  $('card-dialog').close();
  if (!snapshot?.view.day?.scene?.village?.take) return;
  // A receipt or a read still out (busy) must not drop the close: it goes once the window is free again.
  cardClosing = true; freeCommand('CARD_CLOSE').finally(() => { cardClosing = false; });
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
  // The hour's light before the scene is drawn: a first visit at night or in the rain never shows the noon first (W7 screen review).
  text('connection', `${worldHostRequested ? (globalThis.__SYNK_WORLD_TOWN__?.mode === 'account' ? 'SYNK 계정에 저장됨' : '테스트 계정에 저장됨') : '이 기기에 저장됨'} · ${names[day.location] || ''}`); configurePlan(); paintLight(true); renderScene(); renderLife(); renderCards(); renderCardDialog(); setBusy(busy);
  if ($('notebook-dialog').open) notebook?.render(snapshot);
  $('look-scene').hidden = !watch.plan && !observation && !snapshot.view.life?.interaction?.resultId;
  reconcileWalk(); applyWalkView();
  // Another window moved the player from where it sat down (or left home in the classic view): stand up quietly (W7b).
  if (stay?.active() && (walking() ? !walk.point || !stayPoint || Math.hypot(walk.point.x - stayPoint.x, walk.point.z - stayPoint.z) > stay.seat().reach : day.location !== 'home')) stay.leave('moved');
  clearTimeout(seatedRetry); stay?.update(stayContext()); soundFrame();
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
/** The renderer's frame evidence: whether the scene it was asked to draw with this serial reached the screen. */
const paintedThrough = serial => fallback || renderer?.stats().ready && renderer.stats().renderedSerial >= serial;
/** Sends one acknowledgement the observation owner issued, with the facts the host checks it against. */
function acknowledge(effect) {
  const sent = effect.kind === 'plan'
    ? command('ACK', { reactionId: snapshot.view.reaction.id, semanticKey: snapshot.view.reaction.semanticKey, activity: snapshot.state.activity || 'seat', worldRevision: snapshot.state.worldRevision,
      mode: reduced.matches || fallback ? 'static' : 'motion', appliedStepIds: effect.appliedStepIds, visible: true, assetsReady: true })
    : effect.kind === 'result' ? command(effect.type, { resultId: effect.resultId, visible: true }) : command('LIFE_ACK', { contactId: effect.contactId, visible: true });
  sent.then(ok => watch.settle(effect, ok));
}
/** Gathers what this frame showed for each acknowledgement and sends what the owner issues. Each check reads busy
 * after the one before: an acknowledgement just sent holds the later ones back this frame. */
function observe(now) {
  if (!snapshot || !connected) return;
  // A passive acknowledgement must not briefly make controls busy and clear
  // a held direction. Resume its delivery after the player releases input.
  const passiveReady = !walking() || !walk.inputActive && !walk.moving;
  if (watch.plan) {
    const ctx = { currentRevision: snapshot.state.worldRevision, currentPlanId: snapshot.view.plan?.id, committedStepIds: snapshot.view.committedStepIds, reducedMotion: reduced.matches || fallback };
    const good = sceneVisible() && !busy && (fallback ? visible($('ft-static')) : visible($('scene-caption')));
    const effect = watch.planFrame({ now, good, passiveReady, ctx, requested: renderedRequest, painted: paintedThrough }, () => { renderScene(); return renderedRequest; });
    if (effect) acknowledge(effect);
  }
  const dayObservation = currentObservation();
  const lifeResult = lifeAvailable() && snapshot.view.life.interaction?.stage === 'result' && !snapshot.view.life.interaction.delivered ? snapshot.view.life.interaction : null;
  const target = dayObservation?.allowed ? { id: dayObservation.resultId, type: bazaarActive() ? 'BAZAAR_OBSERVED' : 'DAY_OBSERVED', element: $('observation') } : lifeResult ? { id: lifeResult.resultId, type: 'LIFE_ACK', element: $('observation') } : null;
  const result = watch.resultFrame({ now, target,
    good: passiveReady && target && !watch.plan && !executionSample && !busy && sceneVisible() && visible(target.element) && (fallback || renderer?.stats().renderedSerial >= renderedRequest) });
  if (result) acknowledge(result);
  const c = snapshot.view.life?.contact;
  const contact = watch.contactFrame({ now, id: c?.id, good: passiveReady && c?.state === 'issued' && lifeAvailable() && contactHere(c) && !busy && visible($('life-contact')) });
  if (contact) acknowledge(contact);
}
/** Each frame the plan's residents move to where they are at the server's time (W3); when one starts a
 * new segment, wakes, sleeps or reaches a scene's hold, the whole scene (captions included) is drawn again. */
function villageFrame() {
  const v = snapshot?.view.day?.scene?.village;
  if (!v || !connected) { villageWalking = false; moodFrame(null); return; }
  const village = villageRows(v);
  villageWalking = village.rows.some(r => r.live && r.walking);
  // A resident arriving or leaving changes who greets and whose need shows in the place's panel too (screen review B3).
  if (village.signature !== villageLive.signature) { renderScene(); renderCards(); moodFrame(v, village); return; }
  if (renderer && villageLive.ids.size) renderer.setResidents?.(village.rows.filter(r => villageLive.ids.has(r.id)));
  moodFrame(v, village);
}
/** The line a resident says at server time t (W5b): its card's or its pair's (day-cards sceneLine), else null — the
 * mood layer then shows its mood line (§7-3). */
function residentLine(v, id, t) {
  return sceneLine(v.segments, id, t, { steps: pairSteps(snapshot?.state?.village?.band?.pairs), waiting: v.cards || [] });
}
/** A resident whose mind the plan changed — or who is solving a card or talking with its pair (W5b) — shows its line by
 * the name while the player is near (§7-3, W4) — only residents the plan draws this frame, never over a dialog, the
 * nearby panel or the text alternative, nor for the resident whose offer is up (that card carries its words). */
let moodLines = null;
function moodFrame(v, village) {
  moodLines ||= createMoodLines($('mood-lines'), $('mood-live'));
  const blocked = !v || !renderer || fallback || !sceneVisible() || walkPanel || !!document.querySelector('dialog[open]') || !!stay?.active();
  // Where the canvas sits in the scene, read only when a card is placed (no layout reads on frames without one).
  let offset = null, scene = null;
  const canvasOffset = () => { if (!offset) { const c = $('day-canvas').getBoundingClientRect(), s = $('scene').getBoundingClientRect(); offset = { x: c.left - s.left, y: c.top - s.top }; } return offset; };
  // The walking HUD's panels the cards keep off (the map and the view button — the W4 screen review's follow-up).
  const avoid = () => { scene ||= $('scene').getBoundingClientRect(); return walking() ? ['town-map', 'camera-toggle'].map(id => $(id)?.getBoundingClientRect()).filter(r => r?.width)
    .map(r => ({ x: r.left - scene.left, y: r.top - scene.top, w: r.width, h: r.height })) : []; };
  const labelAt = id => { const p = renderer?.labelScreen?.(id); if (!p) return null; const o = canvasOffset(); return { x: p.x + o.x, y: p.y + o.y }; };
  moodLines.update({ segments: v?.segments, t: village?.t ?? null, rows: blocked ? [] : village.rows.filter(r => villageLive.ids.has(r.id)),
    player: blocked ? null : renderer.playerPoint?.(), names: roleNames, blocked, labelAt,
    lineAt: id => residentLine(v, id, village.t), skip: offerGesture ? [offerGesture] : [], day: v?.band ? snapshot?.state?.village?.band?.lifeDay ?? null : null,
    avoid, onSeen: noteSeen });
  // The offer also reaches the text alternative (docked at the scene's foot — there is no name to hang it by).
  offerFrame(v, !v || !sceneVisible() || walkPanel || !!document.querySelector('dialog[open]') || !!stay?.active(), renderer && !fallback ? labelAt : () => null);
}
/** The card offer standing for this window (§8-3): by its owner's name for 20 seconds, the owner gesturing for the
 * first 8; its delivery receipt once it has been in sight a moment (LIFE_ACK, like the seat's invitation). Never while
 * seated, in a dialog or in the text alternative's place of the scene. The receipt is timed by the offer card's own
 * showing (day-cards createOffer), not by the renderer's frame evidence, so it stays here rather than in day-observation. */
function offerFrame(v, blocked, labelAt) {
  cardOfferUi ||= createOffer($('card-offers'), {
    live: $('mood-live'),
    onAccept: o => openCard(o, 'contact'),
    onLater: o => freeCommand('CARD_DEFER', { contactId: o.id }),
    onToday: async o => { if (await freeCommand('PREF_TODAY_OTHER', { activity: `card.${o.card}` })) freeCommand('CARD_DEFER', { contactId: o.id }); },
    onLess: async o => { if (await freeCommand('PREF_LESS_OFTEN', { activity: `card.${o.card}`, on: true })) freeCommand('CARD_DECLINE', { contactId: o.id }); },
  });
  const offer = v && presence ? offerModel(snapshot?.view.life?.cardContact, { surfaceId, fence: presence.fence }) : null;
  const shown = cardOfferUi.update({ offer, labelAt, blocked: blocked || !v });
  const gesture = shown.gesture && offer ? offer.owner : null;
  if (gesture !== offerGesture) { offerGesture = gesture; renderScene(); }
  if (!shown.shown || !offer) { offerSeenAt = null; return; }
  offerSeenAt ??= performance.now();
  const contact = snapshot.view.life.cardContact;
  if (contact.state === 'issued' && offerAckPending !== offer.id && performance.now() - offerSeenAt >= 300 && !busy) {
    offerAckPending = offer.id; noteSeen([`line:${offer.lineId}`], offer.id);
    command('LIFE_ACK', { contactId: offer.id, visible: true }).then(ok => { if (!ok) offerAckPending = null; });
  }
}
/** The hour's light and the rain (W7): lightAt with the server's clock and the village's seed and time zone, so the
 * same village at the same time looks the same on every device. Before the village keeps a zone (a first visit) the
 * device's offset stands in — the server records that same offset with its first band; with no clock at all the
 * scene keeps the approved noon. Painted once a second: the light moves in minutes. */
let lightShown = null, lightSource = 'none';
function lightNow() {
  const v = snapshot?.state?.village, at = serverNow() ?? snapshot?.view.day?.scene?.village?.nowMs ?? null;
  const saved = Array.isArray(v?.tz) && v.tz.length ? v.tz : null, device = -new Date().getTimezoneOffset();
  const tz = saved || (validOffset(device) ? device : null);
  lightSource = !Number.isSafeInteger(at) || tz === null ? 'none' : saved ? 'server-tz' : 'device-tz';
  if (lightSource === 'none') return null;
  try { return lightAt({ villageSeed: typeof v?.seed === 'string' ? v.seed : null, tz, ms: at }); } catch { lightSource = 'none'; return null; }
}
function paintLight(force = false) {
  // Seated, the light is painted less often (W7b) — it moves in minutes.
  if (!force && stay?.active() && performance.now() - lightPaintedAt < QUIET.lightMs) return;
  lightPaintedAt = performance.now(); lightShown = lightNow(); renderer?.setLight?.(lightShown); stay?.update(stayContext());
}
function frame(now) {
  raf = null;
  if (stay?.active()) {
    // Seated (W7b): the app's loop runs on a timer — at the scene's pace while a resident walks or a gamepad is connected
    // (its buttons are read here, and a short press must not fall between two reads), slowly otherwise.
    villageFrame(); const padded = stay.frame();
    appTimer = setTimeout(() => { appTimer = 0; raf = requestAnimationFrame(frame); }, 1000 / (villageWalking || padded ? QUIET.appHz : QUIET.idleHz));
    return;
  }
  walkFrame(now); observe(now); villageFrame(); cardsFrame(now); stay?.frame(); raf = requestAnimationFrame(frame);
}
async function load() {
  setBusy(true);
  // The window's first pulse records a visit that ended while it was away; the second read shows the town after it.
  try { await queue(async () => { walk.discard(); accept(await request('state')); clearError(); await pulseNow(); accept(await request('state')); }); }
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
// The neighbour notebook (W5b, §20-5) — the old 「함께한 일」 list is its 「마을이 기억하는 것」 page now.
notebook = createNotebook($('notebook-dialog'), { command: async (type, payload) => {
  const ok = await command(type, payload);
  // Emptying the seen record (§20-2) also drops what this window showed before it and has not told the host yet — the
  // next boundary would write it straight back (screen review B1); what shows after it counts afresh.
  if (ok && ['SEEN_CLEAR', 'MEMORY_CLEAR'].includes(type)) { seenQueue.clear(); seenTags.clear(); }
  return ok;
} });
$('journal-open').addEventListener('click', () => { notebook.render(snapshot); notebook.open(); }); $('notebook-close').addEventListener('click', () => $('notebook-dialog').close());
$('card-confirm').addEventListener('click', async () => { await command('CARD_CONFIRM'); refocusCard(); });
$('card-close').addEventListener('click', closeCard);
$('card-dialog').addEventListener('cancel', event => { event.preventDefault(); closeCard(); });
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
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseWalkInput(); soundFrame(); pulse(); if (!document.hidden) read(); }); window.addEventListener('online', () => { if (!connected) load(); });
window.addEventListener('blur', () => { if (walking()) { pauseWalkInput(); pulse(); } }); window.addEventListener('focus', () => { if (walking()) pulse(); });
window.addEventListener('pagehide', () => {
  if (raf !== null) cancelAnimationFrame(raf); clearTimeout(appTimer); stay?.dispose(); sound.dispose(); walkControls?.dispose(); renderer?.dispose();
  const stopped = { surfaceId, surface: 'day', foreground: false, safe: false };
  if (worldHostRequested) { worldHost?.request(legacyHost ? 'presence' : 'pulse', stopped).catch(() => {}); worldHost?.dispose(); }
  else fetch('/api/preview/pulse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true, body: JSON.stringify(stopped) }).catch(() => {});
});
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
reduced.addEventListener('change', () => { watch.resetPlan(); configurePlan(); renderScene(); });
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
  walkControls = createWalkControls({ surface: $('scene'), joystick: $('walk-joystick'), thumb: $('walk-thumb'), canMove: () => walking() && connected && !busy && !stay?.active(),
    onInteract: interactWalk, onCancel: dismissWalkPanel, onMoveStart: dismissWalkPanel, onInputMode: mode => { walkInputMode = mode; } });
  // Staying (W7b): the seats, their quiet view and the sound switches. Sitting sends the steps taken so far; standing
  // up starts the walk clock again with a zero step, so the first real step is never pulled back.
  stay = createStay({ scene: $('scene'), hud: $('walk-hud'), nearby: $('nearby-panel'), settings: $('settings-dialog'), sound, renderer: () => renderer,
    beforeSit: async () => { walkControls?.stop(); dismissWalkPanel(); await flushWalk(true); stayPoint = walk.point && { x: walk.point.x, z: walk.point.z }; return connected; },
    onChange: () => { soundFrame(); applyWalkView(true); },
    onStand: reason => {
      if (appTimer) { clearTimeout(appTimer); appTimer = 0; raf = requestAnimationFrame(frame); }
      // Standing up to walk on warms the walking clock; moved by another window (which holds the walk now) or closing, not.
      if (reason !== 'moved' && reason !== 'dispose' && walking() && connected) { walkWarm = false; walk.zeroStep(); Promise.resolve(flushWalk(true)).finally(() => { walkWarm = true; }); }
      paintLight(true); renderScene();
    } });
  sound.onPrefs(() => stay?.paint());
  paintLight(); setInterval(paintLight, 1000); // the hour's light (W7), before the first frame shows
  renderScene(); applyWalkView(); if (walking()) $('scene').focus({ preventScroll: true });
  raf = requestAnimationFrame(frame); setInterval(tick, 1000);
  setInterval(() => { if (renderer) text('scene-metrics', JSON.stringify(renderer.stats(), null, 2)); }, 3000);
} catch (error) { showError(error.message); }

// Read-only instrumentation for the isolated QA runner. It cannot mutate state or time.
globalThis.SYNKTownDay = Object.freeze({ metrics: () => ({ ...(renderer?.stats() || { renderer: 'text-alternative' }), reducedMotion: reduced.matches, connected, fallback, worldLinked: worldHostRequested,
  village: { serverNow: serverNow(), live: [...villageLive.ids], signature: villageLive.signature, due: dueAt(), timed: timed() },
  stay: stay?.metrics() ?? null, sound: { ...sound.stats(), level: sound.level() }, foreground: flags().foreground,
  // W5b: what this window draws of the cards — the offer, the residents' lines, the place's panel — and its seen keys still to send.
  cards: { capsOk, safe: flags().safe, seenPending: [...seenQueue], gesture: offerGesture, take: snapshot?.view.day?.scene?.village?.take?.status ?? null,
    offer: (el => el ? { text: el.querySelector('.offer-text')?.textContent ?? '', docked: el.classList.contains('is-docked'), rect: el.getBoundingClientRect().toJSON() } : null)(document.querySelector('#card-offers .offer-card:not([hidden])')),
    lines: [...document.querySelectorAll('#mood-lines .mood-card:not([hidden])')].map(el => ({ npc: el.dataset.npc, line: el.dataset.line, rect: el.getBoundingClientRect().toJSON() })),
    place: $('place-cards').hidden ? null : $('place-cards').textContent },
  lightClock: lightShown && { source: lightSource, seedKind: typeof snapshot?.state?.village?.seed === 'string' ? 'string' : snapshot?.state?.village?.seed == null ? 'none' : 'other',
    key: lightShown.key, band: lightShown.band, localMinute: lightShown.localMinute, rain: { raining: lightShown.rain.raining, drops: lightShown.rain.drops, overcast: lightShown.rain.overcast, wet: lightShown.rain.wet } },
  walk: { enabled: walking(), ...walk.point, heading: walk.heading, moving: walk.moving, inputActive: walk.inputActive, nearby: nearby(walk.point), interactionOpen: walkPanel, input: walkInputMode,
    pending: walk.pendingParts, pendingMs: walk.pendingMs, sending: !!walkFlushing, backpressured: walk.backpressured,
    correctionDistance: walk.correction, maxCorrection: walk.maxCorrection } }), snapshot: () => structuredClone(snapshot) });
