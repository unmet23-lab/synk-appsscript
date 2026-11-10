// 환승 러시 흐름(설계 v0.3): 개찰구 → 승강장 → 2호선 → 시청 환승 통로 → 1호선 → 출구 → 개찰구 → 지상 → 결과.
// 규칙은 core.mjs, 원고는 journeys.mjs · people.mjs, 그림은 scene.mjs, 위 노선 줄은 hud.mjs, 아래 역 지도는 routemap.mjs(11-10 A 「노선도」), 결과 정류장 전광판은 led.mjs, 소리는 audio.mjs가 맡고 여기서는 차례만 잇는다.
import { SubwayRun, clockText, highlightFor, SCHOOL_MINUTES } from './core.mjs';
import { startLevel } from './level.mjs';
import { buildJourney, explainDecision } from './journeys.mjs';
import { LINES } from './lines.mjs';
import { PEOPLE, CARS, planDay } from './people.mjs';
import { createScene, loadImage } from './scene.mjs?v=map20261110';
import { createLed } from './led.mjs';
import { createHud } from './hud.mjs?v=map20261110';
import { createRouteMap } from './routemap.mjs?v=map20261110';
import { createSound, haptic } from './audio.mjs?v=map20261110';
import { createMusic } from './music.mjs';
import { GAME_ID, decisionMeta, meetingMeta, answerPayload, createExchange, preferJourney, missedPractice, entryNote } from './learning.mjs?v=return-20261105';

const $ = (id) => document.getElementById(id);
const query = new URLSearchParams(location.search);
const AUTO = query.has('auto');                       // 녹화용 자동 진행
const WORLD_BASE = 'assets/world/', VOICE_BASE = 'assets/voice/';
// 앱 「움직임 줄이기」는 바깥 창(:root[data-motion=reduced])에만 적혀 있어 게임 문서로 옮겨 적는다 — CSS 연출도 이 표시를 따른다.
function syncMotion() {
  let outer = false;
  try { outer = window.parent !== window && window.parent.document.documentElement.dataset.motion === 'reduced'; } catch { /* 다른 출처 */ }
  document.documentElement.toggleAttribute('data-reduce-motion', outer);
}
syncMotion();
window.addEventListener('focus', syncMotion);
document.addEventListener('visibilitychange', syncMotion);
const reduced = () => matchMedia('(prefers-reduced-motion:reduce)').matches || document.documentElement.hasAttribute('data-reduce-motion');

// ── 시간(멈춤을 지키려고 모든 움직임을 이 고리로 돌린다) ──
const ease = {
  linear: (k) => k, out: (k) => 1 - Math.pow(1 - k, 3), inOut: (k) => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2,
  run: (k) => k < 0.86 ? k * 0.93 / 0.86 : 0.93 + 0.07 * (1 - Math.pow(1 - (k - 0.86) / 0.14, 2)),
  door: (k) => k < 0.12 ? 0.25 * k : 0.03 + 0.97 * (1 - Math.pow(1 - (k - 0.12) / 0.88, 2.4)),
};
const tweens = new Set();
function tween(dur, fn, e = ease.inOut) { return new Promise((res) => { const t = { t: 0, dur, fn, e, res }; tweens.add(t); fn(e(0)); }); }
const wait = (s) => tween(s, () => {}, ease.linear);
let paused = false, last = performance.now();
let stepping = 0, stepTimer = 0, stepSide = 1;

// ── 준비 ──
// 준비가 막혀도(끊긴 회선 · WebGL 없음) 조용히 멈추지 않는다: 창으로 알리고 다시 시도한다.
async function askRetry(title, body) {
  $('retry-title').textContent = title; $('retry-body').textContent = body;
  const dlg = $('voice-dialog'); dlg.showModal();
  await new Promise((res) => $('btn-retry').addEventListener('click', res, { once: true })); dlg.close();
}
$('voice-dialog').addEventListener('cancel', (e) => e.preventDefault());
async function readyOrAsk(load, title, body) { for (;;) { try { return await load(); } catch (error) { console.error(error); await askRetry(title, body); } } }
const assets = new Set(await readyOrAsk(() => fetch('assets/assets.json').then((r) => { if (!r.ok) throw Error(`assets.json ${r.status}`); return r.json(); }), '게임을 준비하지 못했어요', '인터넷을 확인하고 다시 해 주세요.'));
const files = Object.fromEntries([...assets].flatMap((n) => [[n, `${n}.webp`], [`${n}.depth`, `${n}.depth.png`]]));
const has = (n) => assets.has(n);
const sound = createSound();
const music = createMusic(sound.ctx, { destination: sound.output });
sound.onVoice = (on) => music.voice(on);
await Promise.all([document.fonts.load('600 20px SubwaySign'), document.fonts.load('16px SubwayLED'), document.fonts.load('700 19px SubwayUI'), document.fonts.load('500 30px SubwayNum')]).catch(() => {});
const hud = createHud({ route: $('hud-route'), clock: $('hud-clock'), status: $('hud-status'), badge: $('hud-badge'), stage: $('stage'), calm: reduced });
const map = createRouteMap({ svg: $('route-map'), labels: $('route-labels'), stage: $('stage'), calm: reduced });
const scene = await readyOrAsk(() => createScene($('gl'), { base: WORLD_BASE, tween, ease, files, calm: reduced, look: query.get('look') === 'b' ? 'b' : 'a' }), '화면을 그리지 못했어요', '이 브라우저에서 그래픽 가속(WebGL)을 쓸 수 없어요. 설정에서 켠 뒤 다시 해 주세요.');
const coach = (() => { try { return window.SynkLearning?.createGame({ gameId: GAME_ID, storage: window.localStorage }) || null; } catch { return null; } })();

const availableCars = () => Object.keys(CARS).filter((id) => has(CARS[id].closed));
const availablePeople = () => Object.keys(PEOPLE).filter((id) => has(PEOPLE[id].photo));
const albumKey = 'synk.subway.album.v1';
const readAlbum = () => { try { return JSON.parse(localStorage.getItem(albumKey) || '{}'); } catch { return {}; } };
const writeAlbum = (a) => { try { localStorage.setItem(albumKey, JSON.stringify(a)); } catch { /* 저장 못 하면 이번 판만 */ } };

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!paused) {
    for (const t of [...tweens]) { t.t += dt; const k = Math.min(1, t.t / t.dur); t.fn(t.e(k)); if (k >= 1) { tweens.delete(t); t.res(); } }
    if (stepping > 0) { stepTimer -= dt; if (stepTimer <= 0) { stepTimer += 1 / stepping; stepSide = -stepSide; sound.sfx.step(stepSide); } }
    sound.railTick();
    if (voiceLive) hud.setLevels(sound.voiceLevels());
    hud.render(dt); map.render(dt);
    scene.resize(); scene.render(dt);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ── 전광판 · 안내 ──
let voiceLive = false, currentLine = null, currentExchange = null, canHelp = false;
function setStatus(role) { hud.setStatus(role === 'guide' ? '길 안내' : role === 'announcer' ? '안내방송' : '', role === 'guide' ? 'green' : 'amber'); }
const setLine = (n) => { if (LINES[n]) hud.setLine(n, LINES[n].color); };
async function say(line, { status = true } = {}) {
  currentLine = line;
  if (status) setStatus(line.role);
  voiceLive = true;
  const ok = await sound.speak(line.voice);
  voiceLive = false; hud.setLevels([0, 0, 0, 0, 0]);
  return ok;
}
function setClock(run) { hud.setClock(clockText(run.minutes)); }
function setKeys(on) { canHelp = on; $('key-replay').disabled = !on; $('key-text').disabled = !on; }
$('key-replay').addEventListener('click', async () => {
  if (!canHelp || !currentLine || voiceLive) return;
  currentExchange?.help('replay'); activeRun?.help('replay'); sound.sfx.tap();
  await say(currentLine, { status: currentLine.role === 'announcer' || currentLine.role === 'guide' });
});
$('key-text').addEventListener('click', () => {
  if (!canHelp || !currentLine) return;
  currentExchange?.help('text'); activeRun?.help('text'); sound.sfx.tap();
  showNotice({ head: '글로 봤어요', body: escapeHtml(currentLine.text) });
});
const escapeHtml = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
function showNotice({ head, body, replay = false }) {
  const n = $('notice'); $('notice-head').textContent = head; $('notice-body').innerHTML = body; $('notice-replay').hidden = !replay;
  n.hidden = false; n.style.animation = 'none'; void n.offsetWidth; n.style.animation = '';
  return n;
}
$('notice').addEventListener('click', () => { $('notice').hidden = true; pendingLevel = null; noticeTap?.(); });
let noticeTap = null;
async function noticeFor(seconds) {
  await new Promise((res) => { noticeTap = res; tween(seconds, () => {}, ease.linear).then(res); });
  noticeTap = null; $('notice').hidden = true;
}
function mark(text, word) { const safe = escapeHtml(text); return word ? safe.replace(escapeHtml(word), (m) => `<mark>${m}</mark>`) : safe; }
async function banner(text, seconds = 2) {
  const b = $('banner'); $('banner-text').textContent = text; delete b.dataset.out; b.hidden = false;
  await wait(seconds); b.dataset.out = ''; await wait(0.3); b.hidden = true;
}
// 장면이 바뀔 때 노선 색 문이 닫혔다 열린다(색 · 번호는 지금 노선, style.css .door)
async function curtain(on) { const c = $('curtain'); if (on) { $('door-no').textContent = String(hud.state.line); $('door-tag').textContent = `LINE ${hud.state.line}`; c.dataset.on = ''; } else delete c.dataset.on; await wait(on ? 0.36 : 0.26); }

// ── 고르기 ──
let chooseResolve = null, hintShown = false;
function pick(i) { const r = chooseResolve; if (!r) return; chooseResolve = null; r(i); }
$('zones').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) pick(Number(b.dataset.i)); });
let touchX = null;
$('zones').addEventListener('pointerdown', (e) => { touchX = e.clientX; });
window.addEventListener('pointerup', (e) => { if (touchX === null || !chooseResolve) { touchX = null; return; } const dx = e.clientX - touchX; touchX = null; if (Math.abs(dx) > 44) { e.preventDefault(); pick(dx < 0 ? 0 : 2); } });
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (!$('board').hidden && !$('voice-dialog').open) togglePause(); return; }
  const i = { ArrowLeft: 0, a: 0, ArrowUp: 1, w: 1, ArrowRight: 2, d: 2, 1: 0, 2: 1, 3: 2 }[e.key]; if (i !== undefined) pick(i);
});
/** 고를 차례의 사진 가라앉힘(0~1): 셰이더 uFocus와 아래 그늘(--focus)을 같이 움직인다. */
function setFocus(to, seconds = 0.5) {
  const from = scene.state.focus;
  return tween(reduced() ? 0.01 : seconds, (k) => { scene.state.focus = from + (to - from) * k; $('stage').style.setProperty('--focus', scene.state.focus.toFixed(3)); }, ease.out);
}
function endChoice() { map.hide(); if (scene.state.focus > 0) setFocus(0, 0.3); }
/** 세 칸을 띄우고 손짓을 기다린다. 자동 진행 때는 정해진 칸을 누른다. kind: door · fork · exit · board(아래 역 지도의 갈래 모양). */
function choose(options, autoId, kind) {
  const zones = $('zones'); zones.hidden = false;
  [...zones.children].forEach((b, i) => { b.setAttribute('aria-label', options[i].text || (options[i].exit != null ? `${options[i].exit}번 출구` : '')); });
  $('route-labels').dataset.kind = kind; map.show(kind, options); setFocus(1); sound.sfx.lanes();
  // 고를 차례는 위 노선 줄이 알린다(사진 위에 글을 띄우지 않는다 — 11-10 맹검). 처음 두 판만 손짓을 한 번 흘려 보인다.
  hud.setStatus('고르세요', 'green');
  if (readAlbum().plays < 2 && !hintShown) hud.flash('아래 길을 누르거나 밀어요', 4.8, 'green');
  hintShown = true;
  return new Promise((resolve) => {
    chooseResolve = (i) => { zones.hidden = true; hud.setStatus(''); map.pick(i); setFocus(0, 0.6); sound.sfx.swish(i === 0 ? -1 : 1); haptic('tap'); resolve(i); };
    if (AUTO) { const i = options.findIndex((o) => o.id === autoId); wait(1.1).then(() => pick(i < 0 ? 0 : i)); }
  });
}

// ── 입구 ──
const STATION_SIGN = [0.054, 0.1725, 0.949, 0.3075];
function drawStationSign(ctx) {
  const W = ctx.canvas.width, H = ctx.canvas.height, [a, b, d, e] = STATION_SIGN, x0 = a * W, y0 = b * H, x1 = d * W, y1 = e * H, w = x1 - x0, h = y1 - y0;
  const band = h * 0.24;
  ctx.save();
  ctx.fillStyle = '#d8532b'; ctx.fillRect(x0 + 3, y1 - band - 3, w - 6, band);   // 띠: 실제 노선 색이 아닌 우리 색
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const cy = y0 + (h - band) * 0.47;
  ctx.fillStyle = '#16171a'; ctx.font = `800 ${h * 0.5}px SubwaySign`; ctx.fillText('환승 러시', x0 + w / 2, cy);
  ctx.fillStyle = '#fff'; ctx.font = `600 ${band * 0.56}px SubwaySign`; ctx.textAlign = 'left'; ctx.fillText('←  개강 첫날', x0 + w * 0.05, y1 - band / 2 - 2);
  ctx.textAlign = 'right'; ctx.fillText('8시 41분  →', x1 - w * 0.05, y1 - band / 2 - 2);
  ctx.restore();
}
function lobbyLayout() {
  // 단말기 자리: 사진 속 검은 패드(그림 좌표)를 화면 좌표로. 옆 배치에서는 사진이 캔버스 칸만 차지하고 칸이 세로 가운데에 놓일 수 있다
  scene.resize();   // 칸 크기가 막 바뀌었으면 그림 맞춤(fit)을 먼저 맞춘다
  const s = $('gl').getBoundingClientRect(), top = s.top - $('stage').getBoundingClientRect().top, a = s.width / s.height, fit = scene.state.fit, drop = scene.state.drop;
  const imgH = (a * fit) / (1024 / 1536);
  const toY = (v) => top + ((v - 0.5) * imgH + drop + 0.5) * s.height, toW = (u) => u * (a * fit) * s.height;
  const r = $('reader');
  r.style.setProperty('--reader-y', `${toY(0.8)}px`); r.style.setProperty('--reader-w', `${toW(0.306)}px`); r.style.setProperty('--reader-h', `${toY(0.8 + 0.083) - toY(0.8 - 0.083)}px`);
}
async function showLobby(journey) {
  scene.state.drop = LOBBY_DROP;
  await scene.show({ img: 'gate', dep: 'gate.depth', c: [0.5, 0.5], draw: drawStationSign });
  $('trip-start').textContent = journey.start;
  renderTicket(journey);
  $('lobby').hidden = false; delete $('lobby').dataset.out; $('board').hidden = true; scene.state.top = 0; delete $('reader').dataset.on;
  lobbyJourney = journey; fitLobby(); document.fonts?.ready.then(() => { if (lobbyJourney) fitLobby(); });
  document.documentElement.dataset.ready = '1';
  // 천천히 다가감(빛 · 사람이 조금 움직여 살아 있게)
  breathing = !reduced(); (async () => { while (breathing) { await tween(9, (k) => { if (breathing) scene.state.push = 0.018 + 0.024 * k; }, ease.inOut); await tween(9, (k) => { if (breathing) scene.state.push = 0.042 - 0.024 * k; }, ease.inOut); } })();
  await new Promise((res) => {
    const go = async () => { $('reader').removeEventListener('click', go); $('notice').hidden = true; pendingLevel = null; await sound.resume(); sound.sfx.gate(); $('reader').dataset.on = ''; res(); };
    $('reader').addEventListener('click', go);
    if (AUTO) wait(3.2).then(() => $('reader').click());
  });
  breathing = false; lobbyJourney = null;   // 여기부터 본게임 — 입구 자리잡기가 본게임 scene.state.drop을 덮지 않게 한다
}
let breathing = false, lobbyJourney = null;
const LOBBY_DROP = -0.075, LOBBY_LIFT = 0.1;   // 입구 사진 자리 · 역명판이 화면에 남는 데까지 올릴 수 있는 양(무대 높이 비율)
/** 승차권: 오늘의 여정 · 노선 고르기 · 내 노선도. 어려운 노선은 막지 않고 한 번 묻는다. */
function renderTicket(journey) {
  const album = readAlbum(), level = journey.level;
  $('level-basic').setAttribute('aria-pressed', String(level === 'basic'));
  $('level-busy').setAttribute('aria-pressed', String(level === 'busy'));
  // 첫 등굣길을 넉넉히 도착하면 바쁜 아침을 권한다(막지는 않는다, 설계 3절)
  $('level-busy').querySelector('small').textContent = level === 'basic' && album.plays >= 2 && album.best && album.best <= 8 * 60 + 55 ? '해 볼 만해요' : '3~4급';
  $('ticket-today').textContent = journey.note || (level === 'busy' ? '오늘 들을 말: 운행합니다 · 서지 않습니다 · 이용하실 수 없습니다' : '오늘 들을 말: 내리실 문 · 갈아타실 분');
  const stations = (album.stations || []).length, people = Object.keys(album.met || {}).length;
  const chip = $('ticket-album'); chip.hidden = !(stations || people);
  chip.textContent = `내 노선도 ${stations}역 · 만난 사람 ${people}명${album.best ? ` · 최고 ${clockText(album.best)}` : ''}`;
}
/**
 * 표의 글과 단추는 줄이지 않고, 표가 단말기에 닿을 때만 자리를 옮긴다.
 * 1) 안 닿으면 원래 배치. 2) 표를 조금 조이고 사진 · 단말기를 함께 올린다. 3) 그래도 모자라는 아주 낮은 화면은 사진과 표를 옆으로 나눈다.
 * 첫 방문도 재방문도 단말기 글자까지 트여 있어야 원래 배치를 지킨다.
 */
function fitLobby() {
  const root = document.documentElement, lobby = $('lobby'), ticket = $('ticket'), reader = $('reader'), TEXT = 33;   // 단말기 가운데에서 「카드를 대 주세요」 아래까지(px)
  delete root.dataset.lobbyFit; scene.state.drop = LOBBY_DROP; lobbyLayout();
  const ticketTop = () => lobby.clientHeight - parseFloat(getComputedStyle(ticket).bottom) - ticket.offsetHeight;   // 표의 등장 움직임과 상관없는 자리
  const readerY = parseFloat(reader.style.getPropertyValue('--reader-y')), ringBottom = readerY + parseFloat(reader.style.getPropertyValue('--reader-h')) / 2;
  if (ticketTop() >= readerY + TEXT) return;
  root.dataset.lobbyFit = 'compact';
  const H = lobby.clientHeight, need = (readerY + TEXT - ticketTop()) / H, whole = (ringBottom - ticketTop()) / H;
  if (need > LOBBY_LIFT) { root.dataset.lobbyFit = 'side'; lobbyLayout(); return; }
  scene.state.drop = LOBBY_DROP - Math.min(LOBBY_LIFT, Math.max(0, need, whole)); lobbyLayout();
}
$('ticket-album').addEventListener('click', () => {
  const album = readAlbum(), stamps = $('album-stamps'), people = $('album-people');
  stamps.innerHTML = ''; people.innerHTML = '';
  $('album-score').textContent = `지나간 역 ${(album.stations || []).length}곳${album.best ? ` · 최고 도착 ${clockText(album.best)}` : ''}`;
  (album.stations || []).forEach((st, i) => { const c = drawStamp(st, i * 91 + 7); c.setAttribute('role', 'img'); c.setAttribute('aria-label', st); stamps.append(c); });
  Object.keys(PEOPLE).forEach((id, i) => {
    if (!has(PEOPLE[id].photo)) return;
    const p = PEOPLE[id], n = album.met?.[id] || 0, card = document.createElement('figure'); card.className = `met-card${n ? '' : ' locked'}`; card.style.setProperty('--r', `${i % 2 ? 1 : -1}deg`); card.style.margin = '0';
    card.innerHTML = `<img src="${WORLD_BASE}${n && has(p.react) ? p.react : p.photo}.webp" alt=""><b>${n ? p.name : '아직 못 만났어요'}</b><small>${n ? `${n}번 만났어요` : ''}</small>`;
    people.append(card);
  });
  $('album').hidden = false; sound.sfx.tap?.();
});
$('album-close').addEventListener('click', () => { $('album').hidden = true; });
for (const [id, level] of [['level-basic', 'basic'], ['level-busy', 'busy']]) $(id).addEventListener('click', () => {
  if (chosenLevel() === level) return;
  if (level === 'busy') { const n = showNotice({ head: '바쁜 아침', body: '조금 어려운 안내가 나와요(3~4급). 해 볼래요?' }); n.dataset.ask = '1'; $('notice-replay').hidden = false; $('notice-replay').textContent = '해 볼래요'; pendingLevel = level; return; }
  setLevel(level); location.reload();
});
let pendingLevel = null;
$('notice-replay').addEventListener('click', (e) => { e.stopPropagation(); if (pendingLevel) { setLevel(pendingLevel); location.reload(); } });
window.addEventListener('resize', () => { if (lobbyJourney) fitLobby(); });

// ── 판 ──
let activeRun = null;
function voicesOf(journey, plan) {
  const names = new Set(journey.opening ? [journey.opening.voice] : []);
  for (const d of journey.decisions) { names.add(d.line_.voice); if (d.lead) names.add(d.lead.voice); if (d.after) names.add(d.after.voice); }
  for (const m of plan.meetings) { const s = m.scene; if (s.lead) names.add(s.lead.voice); names.add(s.ask.voice); for (const r of s.replies) names.add(r.reaction.voice); }
  return [...names];
}
const carScene = (id) => ({ img: CARS[id].closed, dep: `${CARS[id].closed}.depth`, c: [0.5, 0.42], streak: 1 });
const DOOR = { right: { rect: [0.926, 0.54, 0.085, 0.3], lamp: [0.925, 0.27], target: [0.93, 0.55], pan: 0.13 }, left: { rect: [0.074, 0.54, 0.085, 0.3], lamp: [0.075, 0.27], target: [0.07, 0.55], pan: -0.13 } };
const WAYS = [[0.165, 0.5], [0.5, 0.515], [0.86, 0.62]];

/** 문 · 통로를 지나가는 움직임. 움직임 줄이기면 다가가는 대신 가림막으로 장면만 바꾼다. */
async function pass(target, opts) {
  if (!reduced()) return scene.goThrough(target, opts);
  await curtain(true);
  scene.state.mix = scene.state.nextImg ? 1 : 0;
  await curtain(false);
}
async function doorOpen(carId, side) {
  const open = CARS[carId][side];
  sound.sfx.doorOpen();
  if (has(open)) await scene.openDoor(open, DOOR[side].rect, DOOR[side].lamp); else { scene.state.lamp = DOOR[side].lamp; scene.state.lampOn = 1; await wait(0.6); }
}
async function doorClose() {
  sound.sfx.doorClose(); scene.state.lampOn = 0; endChoice();
  if (scene.state.hasOpen) await tween(0.6, (k) => { scene.state.doorOpen = 1 - k; }, ease.inOut);
  scene.state.hasOpen = 0;
}
/** 틀렸을 때: 묻는 두 음 → 안내문 → 우회 컷(시계 +3분) → 맞는 길로. */
async function afterWrong(run, d, result) {
  sound.sfx.ask();
  showNotice({ head: '이렇게 안내했어요', body: `${mark(d.line_.text, highlightFor(d, result.cause))}<span class="why">${escapeHtml(explainDecision(d, run.journey))}</span>` });
  await noticeFor(AUTO ? 2.8 : 4.2);
  await curtain(true);
  scene.state.fade = 0; endChoice();
  if (has('detour')) await scene.show({ img: 'detour', dep: 'detour.depth', c: [0.5, 0.42] });
  stepping = 3; stepTimer = 0; hud.flash('돌아가는 길', 2.0, 'red'); setClock(run);
  await curtain(false);
  sound.sfx.tick();
  await tween(2.0, (k) => { if (!reduced()) scene.state.push = 0.5 * k; }, ease.linear);
  stepping = 0;
}
function streakFlash(result) { if (result.streakHit) { sound.sfx.streak(); hud.flash(`빠른 환승! -1분`, 2.2, 'green'); } }

async function playStop(run, d, index, carId, plan) {
  // 달리다 안내 → 서서히 섬 → 문 열림
  setKeys(false);
  const ex = createExchange(coach, decisionMeta(d)); currentExchange = ex; setLine(d.line);
  scene.trainSpeed(1); sound.railStart(); sound.railSpeed(1);
  await wait(1.1);
  setStatus('announcer'); sound.chime(); await wait(1.2);
  const seconds = sound_seconds(d.line_.voice);
  const brake = tween(Math.max(2, seconds - 0.2), (k) => { sound.railSpeed(1 - k); scene.trainSpeed(1 - k); }, ease.linear);
  setKeys(false);
  const heard = await say(d.line_);
  await brake;
  sound.railStop(); ex.heard(heard); run.hearingDone(heard);
  sound.hallStart();
  // 문이 열리기 전에 고른다(11-10): 먼저 열린 문이 답의 문 쪽을 보여 줘 듣지 않고도 고를 수 있었고, 맹검도 「고르기 전에 문이 열려 있다」로 두 번 짚었다
  setKeys(true);
  const i = await choose(d.options, AUTO ? autoAnswer(d) : null, 'door');
  setKeys(false); $('notice').hidden = true;
  const chosen = d.options[i].id, result = run.choose(chosen);
  ex.answer(answerPayload({ correct: result.correct, assessable: d.assessable, selectedId: `subway.${chosen}`, correctId: `subway.${d.answer}`, reason: d.assessable ? null : 'guessable' }));
  noteMissed(result, d);
  await doorOpen(carId, d.side);
  return { result, chosen };
}
function sound_seconds(voice) { return manifest[voice]?.seconds || 6; }
const autoScript = query.get('wrong') ? new Set(query.get('wrong').split(',').map(Number)) : new Set();
let autoCount = 0;
function autoAnswer(d) { const n = autoCount++; if (autoScript.has(n)) return d.options.find((o) => o.id !== d.answer).id; return d.answer; }
const missed = [];
function noteMissed(result, d) { if (!result.correct) missed.push({ text: d.line_.text, voice: d.line_.voice }); }

async function meeting(m, afterCarId) {
  const p = PEOPLE[m.person], s = m.scene;
  setKeys(false); $('zones').hidden = true; endChoice();
  sound.railSpeed(0.35);
  if (s.lead) { await wait(0.4); setStatus('announcer'); sound.chime(); await wait(1.1); await say(s.lead); }
  // 그 사람 쪽으로 시점이 돌아간다
  await scene.prepareNext({ img: p.photo, dep: `${p.photo}.depth`, c: [0.5, 0.4] });
  await tween(0.55, (k) => { scene.state.mix = k; if (!reduced()) scene.state.pan = [0.03 * k, 0]; }, ease.inOut);
  scene.settleNext(); scene.state.streak = 0;
  // 말하는 동안 아주 조금 다가감(한 번 — 늘 도는 흔들림 아님)
  tween(3.2, (k) => { if (!reduced()) scene.state.push = 0.03 * k; }, ease.out);
  hud.setStatus('');
  const ex = s.item ? createExchange(coach, meetingMeta(s.item)) : null; currentExchange = ex;
  setKeys(false);
  const heard = await say(s.ask, { status: false });
  ex?.heard(heard); setKeys(true);
  const reply = await chooseReply(s);
  setKeys(false); $('notice').hidden = true;
  if (ex) ex.answer(answerPayload({ correct: reply.id === s.answer, assessable: true, selectedId: `subway.${reply.id}`, correctId: `subway.${s.answer}` }));
  // 내 말에 따라 반응이 달라진다(벌 없음). 표정 판은 그대로 겹친다.
  const happy = s.answer ? reply.id === s.answer : !!reply.gift;
  if (has(p.react) && (happy || !s.answer)) { await scene.prepareNext({ img: p.react, dep: `${p.photo}.depth`, c: [0.5, 0.4] }); await tween(0.2, (k) => { scene.state.mix = k; }, ease.linear); scene.settleNext(); }
  const line = $('their-line'); line.textContent = reply.reaction.text; line.hidden = false;
  await say(reply.reaction, { status: false });
  if (reply.gift && p.gift) { sound.sfx.gift(); hud.flash(p.gift, 1.8, 'green'); met.push({ id: m.person, gift: p.gift }); } else met.push({ id: m.person, gift: null });
  await wait(AUTO ? 0.9 : 1.2);
  line.hidden = true;
  if (afterCarId) { await curtain(true); await scene.show(carScene(afterCarId)); scene.state.streak = 0.35; hud.setStatus(''); await curtain(false); }
}
function chooseReply(s) {
  const box = $('replies'); box.innerHTML = ''; box.hidden = false;
  return new Promise((resolve) => {
    s.replies.forEach((r) => {
      const b = document.createElement('button'); b.textContent = r.text;
      b.addEventListener('click', () => { [...box.children].forEach((c) => { if (c === b) c.dataset.press = ''; else c.dataset.dim = ''; }); sound.sfx.tap(); setTimeout(() => { box.hidden = true; }, 200); resolve(r); }, { once: true });
      box.append(b);
    });
    if (AUTO) wait(1.2).then(() => { const want = s.answer ? s.replies.find((r) => r.id === s.answer) : s.replies.find((r) => r.gift) || s.replies[0]; box.children[s.replies.indexOf(want)].click(); });
  });
}
let met = [], manifest = {}, curtained = false;

async function playSignDecision(run, d, { img, dep, keyLine, auto, note = null }) {
  // 달려서 갈림 입구까지 → 멈춤 → 세 칸. 안내가 끝나기 전에는 고를 수 없다.
  const ex = createExchange(coach, decisionMeta(d)); currentExchange = ex;
  // 사진 속 빈 표지판에는 글을 얹지 않는다(점검표 46 — 얹은 글은 합성으로 읽힌다). 고를 것의 글은 아래 역 지도 이름 자리 하나에만 있다.
  await scene.show({ img, dep, c: [0.5, 0.515] });
  if (curtained) { curtained = false; await curtain(false); }
  if (note) banner(note, 2.4);
  sound.hallStart(); stepping = 2.7; stepTimer = 0; setKeys(false);
  const reach = 0.62;
  const running = tween(6.2, (k) => { if (!reduced()) scene.runTo(k, reach); }, ease.run);
  await wait(0.9);
  if (d.lead) { await say(d.lead); await wait(0.5); setStatus('announcer'); sound.chime(); await wait(1.1); }
  const heard = await say(keyLine);
  ex.heard(heard); run.hearingDone(heard);
  await running;
  stepping = 0; setKeys(true);
  const kind = d.kind === 'exit' ? 'exit' : 'fork';
  const i = await choose(d.options, auto ? autoAnswer(d) : null, kind);
  setKeys(false); $('notice').hidden = true;
  const chosen = d.options[i].id, result = run.choose(chosen);
  ex.answer(answerPayload({ correct: result.correct, assessable: d.assessable, selectedId: `subway.${chosen}`, correctId: `subway.${d.answer}` }));
  noteMissed(result, d);
  const way = d.options.findIndex((o) => o.id === d.answer);
  if (result.correct) { sound.sfx.pass(); streakFlash(result); setClock(run); }
  else { sound.sfx.ask(); if (!reduced()) await scene.peek(i - 1); else await wait(0.5); endChoice(); await afterWrong(run, d, result); await scene.show({ img, dep, c: [0.5, 0.515], push: reach }); map.show(kind, d.options); map.pick(way); await wait(0.7); }   // 맞는 길을 지도에서 짚고 그리로 달린다
  return { way, result };
}
async function dashThrough(way, next) {
  stepping = 3.6; stepTimer = 0; endChoice();
  sound.sfx.whoosh();
  if (next) await scene.prepareNext(next);
  await pass(WAYS[way], { push: 1.5, seconds: 1.3, blur: 0.17 });
  if (next) scene.settleNext();
  stepping = 0; sound.hallStop();
}

async function playJourney(journey, plan) {
  const run = new SubwayRun(journey); activeRun = run; missed.length = 0; met = []; autoCount = 0;
  // 개찰구 → 승강장: 길 안내
  $('lobby').dataset.out = '';
  $('board').hidden = false; scene.state.top = 1; hud.invalidate(); setLine(journey.decisions.find((x) => x.line)?.line || 2); setClock(run); hud.setStatus(''); setKeys(false); scene.state.drop = 0.03;
  await curtain(true);
  sound.hallStart();
  // 출구 맞춤 판은 이미 내린 역에서 시작한다: 승강장 컷과 앞 길 안내 없이 가림막 뒤로 출구 갈림을 세운다.
  if (journey.opening) await scene.show({ img: 'platform', dep: 'platform.depth', c: [0.2, 0.6] });
  $('lobby').hidden = true; delete document.documentElement.dataset.lobbyFit;
  if (journey.opening) {
    await curtain(false);
    tween(5.2, (k) => { if (!reduced()) scene.state.push = 0.12 * k; }, ease.out);
    currentLine = journey.opening; await wait(0.5);
    await say(journey.opening);
    setKeys(false);
    await wait(0.5);
  }
  const first = journey.decisions[0];
  if (first.kind === 'stop') {
    // 열차로
    stepping = 2.4; stepTimer = 0; sound.sfx.whoosh();
    await scene.prepareNext(carScene(plan.cars[first.leg]));
    await pass([0.22, 0.6], { push: 0.9, seconds: 1.0, blur: 0.08 });
    scene.settleNext(); stepping = 0; sound.hallStop();
    scene.state.streak = 1; sound.railStart(); sound.railSpeed(1); hud.setStatus('');
    await wait(0.5);
  } else {
    // 맞춤 판의 첫 문항이 통로 · 승강장 · 출구면 열차 컷 없이 그 앞으로 바로 간다.
    music.play('run'); await curtain(true);
    if (first.kind === 'board') { await scene.show({ img: platformFor(first), dep: `${platformFor(first)}.depth`, c: [0.5, 0.5] }); await curtain(false); }
    else curtained = true;   // 표지가 든 판을 세운 뒤 걷는다(playSignDecision)
  }

  const meetingAfter = (i) => plan.meetings.find((m) => m.after === i) || null;
  for (let i = 0; i < journey.decisions.length; i++) {
    const d = journey.decisions[i], m = meetingAfter(i);
    if (d.kind === 'stop') {
      const carId = plan.cars[d.leg];
      const { result } = await playStop(run, d, i, carId, plan);
      const next = journey.decisions[i + 1];
      if (result.correct && !d.target) {
        // 그대로: 문이 닫히고 다시 달린다
        sound.sfx.pass(); streakFlash(result); await doorClose(); sound.hallStop(); setClock(run); sound.railStart(); tween(1.4, (k) => { sound.railSpeed(k); scene.trainSpeed(k); }, ease.inOut);
        if (m) await meeting(m, carId);
      } else if (result.correct) {
        sound.sfx.pass(); streakFlash(result); setClock(run);
        if (m) await meeting(m, null);
        stepping = 2.6; stepTimer = 0;
        if (next.kind === 'fork') await goOutOfTrain(d, { img: 'fork', dep: 'fork.depth', c: [0.5, 0.515] });
        else if (next.kind === 'board') await goOutOfTrain(d, { img: platformFor(next), dep: `${platformFor(next)}.depth`, c: [0.5, 0.5] });
        else if (next.kind === 'exit') await goOutOfTrain(d, { img: has('exit-fork') ? 'exit-fork' : 'fork', dep: has('exit-fork') ? 'exit-fork.depth' : 'fork.depth', c: [0.5, 0.515] });
        stepping = 0;
      } else {
        await afterWrong(run, d, result);
        if (d.target) {
          // 맞는 길로 잇는다: 돌아가는 길에서 가림막 뒤로 다음 장면을 세운다
          await curtain(true); sound.railStop(); sound.hallStart(); music.play('run');
          if (next.kind === 'board') { await scene.show({ img: platformFor(next), dep: `${platformFor(next)}.depth`, c: [0.5, 0.5] }); await curtain(false); }
          else curtained = true;   // 표지가 든 판을 세운 뒤 걷는다(playSignDecision)
        } else { await curtain(true); await scene.show(carScene(carId)); scene.state.streak = 0; await curtain(false); sound.hallStop(); sound.railStart(); tween(1.4, (k) => { sound.railSpeed(k); scene.trainSpeed(k); }, ease.inOut); if (m) await meeting(m, carId); }
      }
    } else if (d.kind === 'fork') {
      banner('교수님 아직 안 오셨어요! 어디쯤이에요?', 2);
      const { way } = await playSignDecision(run, d, { img: 'fork', dep: 'fork.depth', keyLine: d.line_, auto: AUTO });
      if (d.after) await say(d.after);
      const nextD = journey.decisions[i + 1];
      if (nextD.kind === 'board') { await dashThrough(way, { img: platformFor(nextD), dep: `${platformFor(nextD)}.depth`, c: [0.5, 0.5] }); }
      else { await dashThrough(way, carScene(plan.cars[1])); music.stop(); scene.state.streak = 1; sound.railStart(); sound.railSpeed(1); await wait(0.4); }
    } else if (d.kind === 'board') {
      await playBoard(run, d, plan);
    } else if (d.kind === 'exit') {
      const img = has('exit-fork') ? 'exit-fork' : 'fork';
      const { way } = await playSignDecision(run, d, { img, dep: `${img}.depth`, keyLine: d.line_, auto: AUTO, note: i === 0 && !journey.opening ? `${d.station}역 도착! 이제 출구만 찾아요.` : null });
      if (m) await meeting(m, null);
      await dashThrough(way, null);
    }
  }
  $('zones').hidden = true; setKeys(false); setClock(run);
  // 개찰구 「삑」 → 계단 위 아침 빛
  await curtain(true);
  sound.railStop();
  if (has('gate-out')) { await scene.show({ img: 'gate-out', dep: 'gate-out.depth', c: [0.5, 0.42] }); await curtain(false); await wait(0.5); sound.sfx.gate(); hud.flash('삑', 0.8, 'green'); await tween(1.0, (k) => { if (!reduced()) scene.state.push = 0.5 * k; }, ease.inOut); await curtain(true); }
  if (has('stairs-sun')) { await scene.show({ img: 'stairs-sun', dep: 'stairs-sun.depth', c: [0.5, 0.25] }); await curtain(false); stepping = 2.8; stepTimer = 0; await tween(1.8, (k) => { if (!reduced()) scene.state.push = 0.9 * k; scene.state.fadeTo = 1; scene.state.fade = Math.max(0, (k - 0.55) / 0.45); }, ease.inOut); stepping = 0; }
  return run;
}
const platformFor = () => (has('platform-1') ? 'platform-1' : 'platform');
/** 승강장 결정(3~4급 급행): 들어오는 열차 앞에서 안내를 듣고 세 칸. */
async function playBoard(run, d, plan) {
  const ex = createExchange(coach, decisionMeta(d)); currentExchange = ex;
  sound.hallStart(); setKeys(false);
  setStatus('announcer'); sound.chime(); await wait(1.2);
  const heard = await say(d.line_);
  ex.heard(heard); run.hearingDone(heard); setKeys(true);
  const i = await choose(d.options, AUTO ? autoAnswer(d) : null, 'board');
  setKeys(false); $('notice').hidden = true;
  const chosen = d.options[i].id, result = run.choose(chosen);
  ex.answer(answerPayload({ correct: result.correct, assessable: d.assessable, selectedId: `subway.${chosen}`, correctId: `subway.${d.answer}` }));
  noteMissed(result, d); await wait(0.45); endChoice();
  if (result.correct) { sound.sfx.pass(); streakFlash(result); setClock(run); if (d.answer === 'wait') { hud.flash('다음 열차를 기다려요', 2.2, 'green'); await wait(2.2); } }
  else await afterWrong(run, d, result);
  stepping = 2.4; stepTimer = 0; sound.sfx.whoosh();
  await scene.prepareNext(carScene(plan.cars[1]));
  await pass([0.3, 0.55], { push: 0.9, seconds: 1.0, blur: 0.08 });
  scene.settleNext(); stepping = 0; sound.hallStop(); music.stop();
  scene.state.streak = 1; sound.railStart(); sound.railSpeed(1); hud.setStatus(''); await wait(0.4);
}
async function goOutOfTrain(d, next) {
  endChoice(); sound.hallStart(); music.play('run');
  await scene.prepareNext(next);
  await pass(DOOR[d.side].target, { pan: DOOR[d.side].pan, push: 1.25, seconds: 1.25, blur: 0.13 });
  scene.settleNext();
}

// ── 결과 ──
function drawStamp(station, seed) {
  const c = document.createElement('canvas'); c.width = c.height = 222; const x = c.getContext('2d'), m = 111;
  x.strokeStyle = x.fillStyle = '#c2241d'; x.lineWidth = 7; x.beginPath(); x.arc(m, m, 98, 0, Math.PI * 2); x.stroke();
  x.lineWidth = 2.5; x.beginPath(); x.arc(m, m, 86, 0, Math.PI * 2); x.stroke();
  x.textAlign = 'center'; x.textBaseline = 'middle';
  let size = 44; x.font = `800 ${size}px SubwaySign`; while (x.measureText(station).width > 148 && size > 18) { size -= 2; x.font = `800 ${size}px SubwaySign`; }
  x.fillText(station, m, m - 2);
  x.font = '600 19px SubwaySign'; x.fillText('환승 러시', m, m + 44);
  // 잉크 결: 군데군데 빠진 자리
  x.globalCompositeOperation = 'destination-out';
  let s = seed + 1; const rand = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < 700; i++) { x.globalAlpha = rand() * 0.75; const r = rand() * 2.8; x.beginPath(); x.arc(rand() * 222, rand() * 222, r, 0, Math.PI * 2); x.fill(); }
  x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
  c.style.setProperty('--r', `${(rand() * 14 - 7).toFixed(1)}deg`);
  return c;
}
async function showResult(run, plan) {
  const s = run.summary(), album = readAlbum();
  sound.stopVoice(); sound.railStop(); sound.hallStop(); music.play('arrive');
  $('board').hidden = true; scene.state.top = 0; endChoice(); $('zones').hidden = true;
  $('result-photo').style.backgroundImage = `url('${WORLD_BASE}${has('bus-stop') ? 'bus-stop' : 'platform'}.webp')`;
  const rled = createLed($('result-led'), { rows: 24 });
  $('result').hidden = false; $('result').scrollTop = 0;
  rled.setClock(s.arriveText); rled.setStatus('도착', s.onTime ? 'green' : 'amber'); rled.render(0.016);
  // 맞춤 판은 여정 중간에서 시작해 도착이 빠르다 — 최고 기록에 넣지 않고, 기준이 다른 전체 여정 최고와 나란히 보이지도 않는다.
  const best = album.best; const newBest = !run.journey.focus && (best == null || s.arrive < best);
  if (newBest) album.best = s.arrive;
  $('result-line').textContent = s.onTime ? (s.wrongs.length ? `${s.arriveText} 도착 — 셔틀 탔어요!` : `${s.arriveText} 도착 — 여유 있게!`) : `${s.arriveText} 도착 — 조금 늦었지만 첫날이니까요`;
  // 소리가 끊긴 문항은 세지 않는다(core.mjs summary) — 모두 끊긴 판은 「0 / 0」 대신 기록만 보인다.
  $('result-score').textContent = [s.total ? `맞힌 안내 ${s.right} / ${s.total}` : '', newBest && best != null ? '내 최고 기록!' : best != null && !run.journey.focus ? `내 최고 ${clockText(best)}` : ''].filter(Boolean).join(' · ');
  // 도장: 하나씩 찍힌다. 탭하면 모두 바로
  const stamps = $('stamps'); stamps.innerHTML = '';
  let skip = false; $('result').addEventListener('pointerdown', () => { skip = true; }, { once: true });
  const seenStations = new Set(album.stations || []);
  for (const [i, st] of s.stations.entries()) {
    const c = drawStamp(st, i * 91 + run.journey.seed); c.setAttribute('role', 'img'); c.setAttribute('aria-label', st);
    if (!skip) { await wait(0.08 + (i ? 0.16 : 0.5)); sound.sfx.stamp(); c.dataset.hit = ''; }
    stamps.append(c); seenStations.add(st);
  }
  album.stations = [...seenStations];
  // 오늘 만난 사람
  const metRow = $('met-row'); metRow.innerHTML = ''; album.met = album.met || {};
  $('met').hidden = !met.length;
  for (const [i, m] of met.entries()) {
    const p = PEOPLE[m.id], card = document.createElement('figure'); card.className = 'met-card'; card.style.setProperty('--r', `${i % 2 ? 1.2 : -1.4}deg`); card.style.margin = '0';
    const isNew = !album.met[m.id];
    card.innerHTML = `<img src="${WORLD_BASE}${has(p.react) ? p.react : p.photo}.webp" alt=""><b>${isNew ? '<span class="new">새 얼굴 </span>' : ''}${p.name}</b><small>${m.gift ? `${m.gift}을 받았어요` : p.memo}</small>`;
    metRow.append(card); album.met[m.id] = (album.met[m.id] || 0) + 1;
  }
  album.plays = (album.plays || 0) + 1;
  writeAlbum(album);
  // 다시 들을 것
  const list = $('again-list'); list.innerHTML = ''; $('again').hidden = !missed.length;
  for (const a of missed) {
    const li = document.createElement('li'), b = document.createElement('button'); b.textContent = '듣기'; b.addEventListener('click', () => sound.speak(a.voice));
    const t = document.createElement('span'); t.textContent = a.text; li.append(b, t); list.append(li);
  }
  // 공통 코인(다른 게임과 같은 규칙)
  const coin = globalThis.SynkPlayCollection;
  const round = coin?.roundId?.(GAME_ID), row = $('coin-row');
  if (round && s.total) { coin.award({ game: GAME_ID, total: s.total, correct: s.right, completed: true, automatic: false, roundId: round }).then((r) => { if (r?.reason === 'invalid-round') return; row.textContent = coin.rewardText(r); row.hidden = false; }).catch(() => {}); }   // 계정 서버의 게임 목록에 아직 없으면 탓하는 글 없이 지나간다
  document.documentElement.dataset.done = '1';
}
function backToRoom() {
  sound.stopVoice(); sound.railStop(); sound.hallStop(); music.stop(0.3);
  try { const town = window.parent?.__synkHome?.goTown; if (town) { town(); return; } const close = window.parent?.document?.getElementById('panel-close'); if (close) { close.click(); return; } } catch { /* 다른 출처 */ }
  start();
}
$('btn-home').addEventListener('click', backToRoom);
$('btn-again').addEventListener('click', () => { $('result').hidden = true; music.stop(0.3); start(); });

// ── 멈춤 ──
function togglePause(force) {
  const on = force ?? !paused; if (on === paused) return; paused = on; last = performance.now();
  const dlg = $('pause-dialog');
  if (on) { sound.suspend(); if (!dlg.open) dlg.showModal(); } else { dlg.close(); sound.resume(); }
}
$('key-pause').addEventListener('click', () => togglePause(true));
$('btn-resume').addEventListener('click', () => togglePause(false));
$('btn-quit').addEventListener('click', () => { togglePause(false); location.reload(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && !$('board').hidden && !AUTO) togglePause(true); });

// ── 시작 ──
function chosenLevel() { let saved = null; try { saved = localStorage.getItem('synk.subway.level'); } catch { /* 이번 판만 */ } return startLevel({ forced: query.get('level'), saved, grade: query.get('grade') }); }
function setLevel(level) { try { localStorage.setItem('synk.subway.level', level); } catch { /* 이번 판만 */ } }
async function prepare(journey, plan) {
  manifest = await fetch(`${VOICE_BASE}manifest.json`).then((r) => r.json());
  await Promise.all(voicesOf(journey, plan).map((n) => sound.load(n, `${VOICE_BASE}${n}.mp3`)));
  music.preload();
}
// 학습 공유를 끈 계정은 기록이 이 기기에만 남는다(호스트 phase 'local'). 그 기록으로 안내하거나 판을 고르지 않고 기록만 그대로 쌓는다.
function personalCoach() {
  try { return (window.SYNKLearningHost || (window.parent !== window ? window.parent.SYNKLearningHost : null))?.status?.().phase === 'local' ? null : coach; } catch { return coach; }
}
// 계정 기록이 다 내려오기 전에는 오답을 말하지 못한다(Trail evidenceComplete). 입구를 오래 막지 않도록 잠깐만 기다린다.
async function historySettled() {
  try { await globalThis.SynkPlayAccount?.ready?.(); } catch { /* 연결이 막혀도 기본 입구로 간다 */ }
  const until = performance.now() + 4000;
  while (coach && performance.now() < until) {
    try { if (coach.summary().evidenceComplete) return; } catch { return; }
    await new Promise((res) => setTimeout(res, 150));
  }
}
async function start() {
  const seed = Number(query.get('seed')) || (Date.now() % 2147483647);
  const level = chosenLevel();
  if (!query.get('seed')) await historySettled();
  const learner = personalCoach();
  // 씨앗을 정해 주면(시험 · 다시 보기) 그 판 그대로. 놓친 유형이 있으면 그 유형의 새 문항이 첫 평가인 여정, 아니면 후보 몇 판 중 아틀라스가 고른 문항이 든 판.
  const returning = query.get('seed') ? null : missedPractice(learner, level);
  const journey = query.get('seed') ? buildJourney({ seed, level }) : returning?.journey || preferJourney(learner, Array.from({ length: 12 }, (_, i) => buildJourney({ seed: seed + i * 7919, level })));
  journey.note = query.get('seed') ? null : entryNote(learner, returning);
  const album = readAlbum();
  const plan = planDay(journey, { available: { cars: availableCars(), people: availablePeople() }, seen: Object.keys(album.met || {}) });
  try { await prepare(journey, plan); } catch (error) {
    console.error(error); await askRetry('목소리를 준비하지 못했어요', '인터넷을 확인하고 다시 해 주세요. 이 게임은 소리를 들어야 할 수 있어요.'); return start();
  }
  await showLobby(journey);
  const run = await playJourney(journey, plan);
  await showResult(run, plan);
}
if (query.has('qa')) window.__subway = { scene, hud, map, sound, music, assets, tween };
start().catch((e) => { console.error(e); document.body.dataset.error = String(e); });
export { loadImage };
