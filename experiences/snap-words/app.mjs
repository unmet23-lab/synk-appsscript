// 찰칵 낱말 — 흐름 · 카메라 · 뷰파인더(설계 experiences/snap-words/설계.md). 규칙은 core.mjs, 판 원근은 sign.mjs, 소리는 sfx.mjs, 움직임은 fx.mjs가 맡는다.
// 1인칭이다: 내 모습은 나오지 않고, 화면이 곧 내 눈 + 내 카메라다. 사진에는 글자가 없고 글은 전부 이 파일이 판 위에 얹는다.
import { PLACES, PLACE_ORDER, COMING, placeWords } from './places.mjs';
import { wordOf, pick } from './words.mjs';
import { makeRng, shuffle, pickMissions, layoutPlates, judgeShot, helpLevel, makeRecall, normalizeAlbum, addCard, nameCard, placeProgress, recordRound, dailyMission, finishDaily, dayKey, STORE_KEY } from './core.mjs';
import { homography, matrix3d, quadSize, quadDistance } from './sign.mjs';
import { createBus, createLimiter, renderSfx, createAmbience } from './sfx.mjs';
import { M, motionOn, spatial, effect, wait, finished, flyTo, rollTo, mmss } from './fx.mjs';
import { STR } from './strings.mjs';
import { GAME_ID, createLearning } from './learning.mjs';
import { josa } from './kit/josa.mjs';

const query = new URLSearchParams(location.search);
const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html !== undefined) n.innerHTML = html; return n; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const app = $('#app'), live = $('#live');

// ── 화면 언어 · 글 ───────────────────────────────────────────────
const lang = (() => { const q = query.get('lang'); if (q) return q; try { return localStorage.getItem('synk.world.lang') || 'ko'; } catch { return 'ko'; } })();
document.documentElement.lang = lang;
const t = (key, vars = {}) => { const s = STR[key]; let text = s?.[lang] ?? s?.en ?? s?.ko ?? key; for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, v); return text; };
/** 태오 말 한 줄: 한국어는 늘 한국어로, 뜻은 화면 언어가 한국어가 아닐 때만 아래에. {이에요} · {을}은 받침으로 고른다. */
function taeo(key, word) {
  const ko = (STR[key].ko || '').replaceAll('{word}', word || '').replaceAll('{이에요}', word ? josa(word, '이에요', '예요') : '').replaceAll('{을}', word ? josa(word, '을', '를') : '');
  return { ko, gloss: lang === 'ko' ? null : t(key, { word: word || '' }) };
}
const oneLine = (text) => String(text).replace(/\n/g, ' ');

// ── 저장 — 계정마다 기기에(설계 5-4: 서버 키가 들어가기 전에는 놀이 호스트 목록에 넣지 않는다) ─────
const accountKey = (() => { try { return window.parent?.SYNKLearningHost?.status?.()?.accountKey || 'device'; } catch { return 'device'; } })();
const saveKey = `${STORE_KEY}:${accountKey}`;
const savedAlbum = (() => { try { return localStorage.getItem(saveKey); } catch { return null; } })();
const album = (() => { try { return normalizeAlbum(JSON.parse(savedAlbum || 'null')); } catch { return normalizeAlbum(null); } })();
function save() { try { localStorage.setItem(saveKey, JSON.stringify(album)); } catch { /* 저장을 못 해도 판은 그대로 돈다 */ } }
const grade = Number(query.get('grade')) || 0;
if (savedAlbum === null && grade >= 3) album.notices = true;
const rng = query.has('seed') ? makeRng(Number(query.get('seed'))) : Math.random;

// ── 학습 기록 ─ 같은 주소의 다른 SYNK 게임과 함께 쓴다(WORLD 안에서는 계정의 기록) ───────────────
const learn = createLearning(() => window.SynkLearning?.createGame({ gameId: GAME_ID, storage: window.localStorage }));

// ── 소리 ─────────────────────────────────────────────────────────
const prefs = (() => { try { return { sfx: 1, amb: 1, voice: 1, ...JSON.parse(localStorage.getItem('synk.snap-words.sound') || '{}') }; } catch { return { sfx: 1, amb: 1, voice: 1 }; } })();
// WORLD 앱 설정 「효과음」 — world-sound.mjs PREF_KEYS와 같은 열쇠(기본 켜짐). 효과음 · 바탕 소리만 끈다. 낱말 소리는 공부 내용이라 게임의 「낱말 소리」 크기만 따른다(환승 러시와 같다).
const hostMuted = () => { try { return localStorage.getItem('synk.world.sound') === 'false'; } catch { return false; } };
let audio = null, bus = null, voiceOut = null, ambience = null, voiceEl = null, limiter = null;
// 아이폰 오디오 세션 — world-sound.mjs와 같은 규칙: 낱말 소리가 나는 동안만 playback(무음 모드에서도 들린다), 그 밖에는 ambient(무음 스위치를 따른다)
const session = (type) => { try { const s = navigator.audioSession; if (s && s.type !== type) s.type = type; } catch { /* 없음 */ } };
function audioReady() {
  if (audio) { if (audio.state === 'suspended') audio.resume().catch(() => {}); return audio; }
  session('ambient');
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  audio = new Ctx({ latencyHint: 'interactive' });
  limiter = createLimiter(audio);
  bus = createBus(audio, { destination: limiter });
  bus.out.gain.value = prefs.sfx;
  voiceOut = audio.createGain(); voiceOut.gain.value = prefs.voice; voiceOut.connect(limiter);
  return audio;
}
function play(name, opts) {
  if (hostMuted() || prefs.sfx <= 0 || !audioReady() || audio.state !== 'running') { if (audio?.state === 'suspended') audio.resume().catch(() => {}); return; }
  renderSfx(bus, name, audio.currentTime + 0.005, opts);
}
function startAmbience(kind) {
  stopAmbience();
  if (hostMuted() || !audioReady()) return;
  ambience = createAmbience(audio, kind, { level: prefs.amb, destination: limiter });
  ambience.start();
}
function stopAmbience() { ambience?.stop(); ambience = null; }
const voiceBuffers = new Map();
async function voiceBuffer(id) {
  if (voiceBuffers.has(id)) return voiceBuffers.get(id);
  const p = fetch(`assets/voice/${id}.mp3`).then((r) => { if (!r.ok) throw Error('voice'); return r.arrayBuffer(); }).then((b) => audio.decodeAudioData(b));
  voiceBuffers.set(id, p); return p;
}
/** 낱말 소리를 낼 수 있나 — 소리를 끈 사람에게는 소리 부탁을 내지 않는다. */
const voiceOn = () => prefs.voice > 0 && !!(window.AudioContext || window.webkitAudioContext);
async function sayWord(id, onEnd = null) {
  const w = wordOf(id);
  if (!w?.voice || prefs.voice <= 0 || !audioReady()) return;
  try {
    voiceEl?.stop?.();
    const buf = await voiceBuffer(id), src = audio.createBufferSource();
    src.buffer = buf; src.connect(voiceOut); voiceEl = src; ambience?.duck(true); session('playback');
    src.onended = () => { if (voiceEl === src) { voiceEl = null; ambience?.duck(false); session('ambient'); onEnd?.(); } };
    src.start();
  } catch { ambience?.duck(false); session('ambient'); }
}

// ── 판 그리기 — 사진 원본 좌표(픽셀)로 그린다. 카메라는 무대 전체를 옮기고 키운다 ──────────────
const measureCtx = document.createElement('canvas').getContext('2d');
const FONT = 'SUIT, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
function textWidth(text, weight = 800) { measureCtx.font = `${weight} 100px ${FONT}`; return measureCtx.measureText(text).width / 100; }
/** 판 하나의 글 상자. 네 모서리로 비트는 원근 변환을 건다. */
function plateNode({ q, text, style, vertical = false }) {
  const { w, h } = quadSize(q), node = el('div', `pl pl-${style}`), H = homography(w, h, q);
  node.style.width = `${w}px`; node.style.height = `${h}px`; node.style.transform = matrix3d(H);
  const lines = String(text).split('\n'), span = el('span', 'pl-t');
  if (vertical) {
    const n = [...text].length, size = Math.min(w * 0.6, (h * 0.86) / n);
    span.classList.add('pl-v'); span.style.fontSize = `${size}px`; span.innerHTML = [...text].map((c) => `<b>${esc(c)}</b>`).join('');
  } else {
    const widest = Math.max(...lines.map((l) => textWidth(l))), lineH = 1.26;
    const size = Math.min((h * (lines.length > 1 ? 0.84 : 0.6)) / (lines.length * (lines.length > 1 ? lineH : 1)), (w * 0.84) / widest);
    span.style.fontSize = `${size}px`; span.innerHTML = lines.map(esc).join('<br>');
  }
  node.append(span);
  return node;
}
const NO_QUAD = [[0, 0], [10, 0], [10, 10], [0, 10]];
const bboxOf = (quad) => { const q = quad || NO_QUAD, xs = q.map((p) => p[0]), ys = q.map((p) => p[1]); return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }; };
const unionBox = (boxes) => { const x = Math.min(...boxes.map((b) => b.x)), y = Math.min(...boxes.map((b) => b.y)); return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y }; };

/** 사진 조각(인화지 · 카드 · 앨범): 그 판과 함께 찍힌 글까지 그대로. 들고 있는 값은 곳 · 자리 · 글뿐이다. */
function cropNode(placeId, box, plates, W, H, margin = 0.16) {
  const place = PLACES[placeId], root = el('div', 'crop');
  root.style.width = `${W}px`; root.style.height = `${H}px`;
  const mx = box.w * margin, my = box.h * margin, bx = box.x - mx, by = box.y - my, bw = box.w + mx * 2, bh = box.h + my * 2;
  // 판 전체가 들어오게(둘레의 사진이 함께 보인다 — 글자만 꽉 찬 조각은 사진 같지 않다). 사진이 모자라지 않을 만큼은 키운다.
  const s = Math.max(Math.min(W / bw, H / bh), W / place.w, H / place.h), ox = Math.min(0, Math.max(W - place.w * s, W / 2 - (bx + bw / 2) * s)), oy = Math.min(0, Math.max(H - place.h * s, H / 2 - (by + bh / 2) * s));
  const inner = el('div', 'crop-in');
  inner.style.width = `${place.w}px`; inner.style.height = `${place.h}px`; inner.style.transform = `translate(${ox}px,${oy}px) scale(${s})`;
  const img = el('img'); img.src = place.photo; img.alt = ''; img.draggable = false; img.width = place.w; img.height = place.h;
  inner.append(img);
  for (const p of plates) inner.append(plateNode(p));
  root.append(inner);
  return root;
}

// ── 판 상태 ───────────────────────────────────────────────────────
const S = { round: 0, screen: 'lobby', placeId: 'gate', phase: 'idle', place: null, items: [], plates: [], missions: [], mi: -1, shots: [], focus: null, firstRight: 0, startedAt: 0, missionAt: 0, cardsThisRound: 0, msgMin: false, busy: false, daily: null, hintTimer: 0 };
const cam = { x: 0, y: 0, s: 1, base: 1, tween: null, vx: 0, vy: 0 };
let vf = null, stage = null, focusBox = null, ff = null, vfW = 0, vfH = 0, raf = 0;
const openPlaces = () => PLACE_ORDER.filter((id) => id === 'gate' || (album.placePlays.gate || 0) > 0);

function measure() {
  const r = vf.getBoundingClientRect(), p = S.place; vfW = r.width; vfH = r.height;
  const cover = Math.max(vfW / p.w, vfH / p.h);
  cam.base = vfW < 700 ? Math.max(cover, (vfH * 1.2) / p.h) : cover * 1.2;
}
function clampCam(c = cam) {
  const p = S.place, minX = vfW - p.w * c.s, minY = vfH - p.h * c.s;
  return { x: Math.min(0, Math.max(minX, c.x)), y: Math.min(0, Math.max(minY, c.y)) };
}
function applyCam() { stage.style.transform = `translate3d(${cam.x}px,${cam.y}px,0) scale(${cam.s})`; updateZoomChip(); }
function updateZoomChip() { const z = $('#zoom'); if (z) z.textContent = `${(cam.s / cam.base).toFixed(1)}×`; }
const easeCam = (p) => 1 - (1 - p) ** 4;
function goCam(target, ms = 500) {
  const to = { s: target.s, ...clampCam(target) };
  cam.vx = cam.vy = 0;
  if (!motionOn() || ms <= 0) { Object.assign(cam, to); cam.tween = null; applyCam(); kick(); return; }
  cam.tween = { from: { x: cam.x, y: cam.y, s: cam.s }, to, start: performance.now(), ms };
  stage.style.willChange = 'transform';
  kick();
}
function focusTarget() {
  if (!S.focus) return null;
  const b = bboxOf(S.focus.q), pad = 7;
  return { x: cam.x + b.x * cam.s - pad, y: cam.y + b.y * cam.s - pad, w: b.w * cam.s + pad * 2, h: b.h * cam.s + pad * 2 };
}
function kick() { if (!raf) raf = requestAnimationFrame(loop); }
function loop(now) {
  raf = 0; let busy = false;
  if (cam.tween) {
    const { from, to, start, ms } = cam.tween, p = Math.min(1, (now - start) / ms), e = easeCam(p);
    cam.x = from.x + (to.x - from.x) * e; cam.y = from.y + (to.y - from.y) * e; cam.s = from.s + (to.s - from.s) * e;
    applyCam(); if (p < 1) busy = true; else cam.tween = null;
  } else if (Math.abs(cam.vx) > 0.02 || Math.abs(cam.vy) > 0.02) {
    cam.x += cam.vx * 16; cam.y += cam.vy * 16; cam.vx *= 0.93; cam.vy *= 0.93;
    const c = clampCam();
    if (c.x !== cam.x) { cam.x += (c.x - cam.x) * 0.28; cam.vx *= 0.5; }
    if (c.y !== cam.y) { cam.y += (c.y - cam.y) * 0.28; cam.vy *= 0.5; }
    applyCam(); busy = true;
  } else if (!drag) {
    const c = clampCam();
    if (Math.abs(c.x - cam.x) > 0.3 || Math.abs(c.y - cam.y) > 0.3) { cam.x += (c.x - cam.x) * 0.25; cam.y += (c.y - cam.y) * 0.25; applyCam(); busy = true; }
  }
  const tg = focusTarget();
  if (tg && focusBox) {
    ff = ff || { ...tg };
    const k = cam.tween || drag ? 0.6 : 0.34; let moving = false;
    for (const key of ['x', 'y', 'w', 'h']) { ff[key] += (tg[key] - ff[key]) * k; if (Math.abs(tg[key] - ff[key]) > 0.3) moving = true; else ff[key] = tg[key]; }
    focusBox.style.transform = `translate3d(${ff.x}px,${ff.y}px,0)`; focusBox.style.width = `${ff.w}px`; focusBox.style.height = `${ff.h}px`;
    if (moving) busy = true;
  }
  // 움직이는 동안만 합성 층으로 둔다 — 멈추면 떼어 글자를 지금 배율로 다시 그린다(다가간 뒤 판 글자가 흐려지지 않게).
  if (busy) kick(); else if (!drag) stage.style.willChange = '';
}

// ── 들어가기 ──────────────────────────────────────────────────────
function show(screen) { S.screen = screen; for (const n of app.children) n.hidden = n.dataset.screen !== screen; }

/** 입구 앨범 수: 앨범 격자와 같은 기준(「안내문도 읽기」를 끄면 안내문은 세지 않는다). 낱말은 한 번 이름을 붙이면 어느 장소에서든 내 것이다(설계 8절). */
const namedCount = () => new Set(PLACE_ORDER.flatMap((id) => placeWords(PLACES[id], { notices: album.notices })).filter((id) => album.cards[id]?.named)).size;
function renderLobby() {
  const place = PLACES[S.placeId] || PLACES.gate, daily = dailyMission(openPlaces().map((id) => PLACES[id]), Date.now()), doneDaily = !!album.daily[dayKey(Date.now())];
  const root = el('section', 'lobby'); root.dataset.screen = 'lobby';
  root.innerHTML = `
   <div class="lobby-photo" id="lobby-photo" aria-hidden="true"></div>
   <div class="lobby-shade" aria-hidden="true"></div>
   <div class="focus lobby-focus" id="lobby-focus" aria-hidden="true"><div class="focus-in"><i></i><i></i><i></i><i></i></div></div>
   <header class="lobby-top">
    <button class="glass-btn" data-go="album"><span>${t('lobby.album')}</span><em>${namedCount()}</em></button>
    <button class="glass-icon" data-go="sound" aria-label="${t('bar.sound')}">${ICON.sound}</button>
   </header>
   <div class="lobby-title"><h1 class="vh">${t('title')}</h1><p>${t('lobby.sub')}</p></div>
   <div class="lobby-bottom">
    <div class="place-row">${placeChips()}</div>
    <button class="daily ${doneDaily ? 'is-done' : ''}" data-go="daily"><span class="daily-dot"></span><span>${doneDaily ? t('lobby.dailyDone') : t('lobby.daily')}</span><small>${esc(pick(PLACES[daily.place].name, lang))}${album.streak ? ` · ${t('lobby.streak', { n: album.streak })}` : ''}</small></button>
    <label class="notice-toggle"><input type="checkbox" data-go="notices" ${album.notices ? 'checked' : ''}><span class="switch" aria-hidden="true"></span><span><b>${t('lobby.notices')}</b><small>${t('lobby.noticesWhy')}</small></span></label>
    <button class="start" data-go="start">${t('lobby.start')}</button>
   </div>`;
  return root;
}
// 입구의 주인공: 정문 표지판. 맨 위 날개에 제목이, 나머지 날개에 실제 낱말이 얹혀 「글을 읽고 찍는 게임」을 첫눈에 보여 준다. 초점 괄호가 제목 날개를 잡는다.
function layoutLobbyPhoto(root) {
  const host = root.querySelector('#lobby-photo'); if (!host) return;
  const place = PLACES.gate, W = innerWidth, H = innerHeight, wide = W >= 760;
  const s = Math.max(wide ? 1.3 : Math.min(1.36, (W - 26) / 255), H / place.h, W / place.w);
  const x = wide ? W * 0.5 - 1418 * s : 18 - 1418 * s, y = (wide ? H * 0.13 : Math.max(84, H * 0.11)) - 293 * s;
  const cx = Math.min(0, Math.max(W - place.w * s, x)), cy = Math.min(0, Math.max(H - place.h * s, y));
  const inner = el('div', 'crop-in');
  inner.style.width = `${place.w}px`; inner.style.height = `${place.h}px`; inner.style.transform = `translate(${cx}px,${cy}px) scale(${s})`;
  const img = el('img'); img.src = place.photo; img.alt = ''; img.draggable = false; inner.append(img);
  const slots = place.groups.blade.slots, words = ['library', 'cafeteria', 'dorm', 'bank', 'bookstore', 'post'];
  const rights = [1, 3, 5, 6], lefts = [0, 2, 4];
  const title = slots[rights[0]], titleNode = plateNode({ q: title, text: t('title'), style: 'blade' });
  const box = quadSize(title), span = titleNode.querySelector('.pl-t');
  span.style.fontSize = `${Math.min(box.h * 0.84, (box.w * 0.9) / textWidth(t('title'), 900))}px`; span.style.fontWeight = '900'; span.style.letterSpacing = '-.03em';
  inner.append(titleNode);
  // 넓은 화면은 왼쪽 날개가 글과 단추 뒤 어둠에 들어가므로 글을 얹지 않는다. 폰은 입구 글 뒤로 들어가는 날개의 글을 뺀다(글 뒤로 글이 비치지 않게).
  const copyTop = wide ? Infinity : (root.querySelector('.lobby-title')?.getBoundingClientRect().top || Infinity);
  [...rights.slice(1), ...(wide ? [] : lefts)].forEach((i, n) => {
    const box = bboxOf(slots[i]);
    if (cy + (box.y + box.h) * s <= copyTop) inner.append(plateNode({ q: slots[i], text: wordOf(words[n]).ko, style: 'blade' }));
  });
  host.replaceChildren(inner);
  const b = bboxOf(title), f = root.querySelector('#lobby-focus'), pad = 9;
  f.style.transform = `translate3d(${cx + b.x * s - pad}px,${cy + b.y * s - pad}px,0)`; f.style.width = `${b.w * s + pad * 2}px`; f.style.height = `${b.h * s + pad * 2}px`;
}
const ICON = {
  sound: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5Z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
  back: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5 8 12l7 7"/></svg>',
  play: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 4.5v15l12-7.5z"/></svg>',
  speaker: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5Z"/><path d="M15.5 9a4 4 0 0 1 0 6"/></svg>',
};
function placeChips() {
  const open = openPlaces();
  const chip = (id, name, photo, state, sub) => `<button class="place-chip ${state}" data-place="${id}" ${state === 'is-locked' ? 'aria-disabled="true"' : `aria-pressed="${state === 'is-on'}"`}><span class="place-pic">${photo ? `<img src="${photo}" alt="" draggable="false">` : ''}</span><span class="place-name">${esc(name)}</span><small>${esc(sub)}</small></button>`;
  const known = PLACE_ORDER.map((id) => {
    const p = PLACES[id];
    if (!open.includes(id)) return chip(id, pick(p.name, lang), p.photo, 'is-locked', t('lobby.unlockUnion'));
    const g = placeProgress(album, p);
    return chip(id, pick(p.name, lang), p.photo, id === S.placeId ? 'is-on' : '', `${g.got} / ${g.total}`);
  });
  return [...known, ...COMING.map((c) => chip(c.id, pick(c.name, lang), null, 'is-locked', t('lobby.coming')))].join('');
}
function renderShoot() {
  const root = el('section', 'shoot'); root.dataset.screen = 'shoot'; root.hidden = true;
  root.innerHTML = `
   <header class="bar-top">
    <button class="bar-icon" data-go="back" aria-label="${t('bar.back')}">${ICON.back}</button>
    <div class="bar-place"><b id="place-name"></b><small id="place-when"></small></div>
    <ol class="dots" id="dots" aria-hidden="true"></ol>
    <button class="bar-icon" data-go="sound" aria-label="${t('bar.sound')}">${ICON.sound}</button>
   </header>
   <div class="vf" id="vf">
    <div class="stage" id="stage"><img id="photo" alt="" draggable="false"><div id="plates"></div></div>
    <div class="vf-grid" aria-hidden="true"><i></i><i></i></div>
    <div class="focus" id="focus" hidden aria-hidden="true"><div class="focus-in"><i></i><i></i><i></i><i></i></div></div>
    <div class="flash" id="flash" aria-hidden="true"></div>
    <div class="blade blade-t" id="blade-t" aria-hidden="true"></div><div class="blade blade-b" id="blade-b" aria-hidden="true"></div>
    <div class="msg" id="msg" hidden></div>
    <div class="sheet" id="sheet" hidden></div>
    <button class="step-back" id="step-back" hidden>${t('shoot.back')}</button>
    <p class="toast" id="toast" hidden></p>
    <div class="kbd" id="kbd"></div>
   </div>
   <footer class="bar-bottom">
    <button class="thumb" id="thumb" data-go="album" aria-label="${t('bar.album')}"><span class="thumb-pic" id="thumb-pic"></span><span class="thumb-n" id="thumb-n">0</span></button>
    <div class="shutter-wrap"><span class="zoom" id="zoom" aria-hidden="true">1.0×</span><button class="shutter" id="shutter" aria-label="${t('shoot.shutter')}"><i></i></button></div>
    <span aria-hidden="true"></span>
   </footer>`;
  return root;
}
function renderShell() {
  app.replaceChildren(renderLobby(), renderShoot(), Object.assign(el('section', 'develop'), { hidden: true }), Object.assign(el('section', 'result'), { hidden: true }), Object.assign(el('section', 'album'), { hidden: true }));
  app.children[2].dataset.screen = 'develop'; app.children[3].dataset.screen = 'result'; app.children[4].dataset.screen = 'album';
  vf = $('#vf'); stage = $('#stage'); focusBox = $('#focus');
  bindViewfinder();
}

function irisClip(radius, turn) {
  const pts = [];
  for (let i = 0; i < 6; i += 1) { const a = (Math.PI / 3) * i + turn; pts.push(`${50 + Math.cos(a) * radius}% ${50 + Math.sin(a) * radius * 1.6}%`); }
  return `polygon(${pts.join(',')})`;
}
async function irisOpen(node) {
  if (!motionOn()) return;
  play('iris');
  await finished(node.animate([{ clipPath: irisClip(0.5, 0) }, { clipPath: irisClip(110, 0.7) }], { ...M.slow, easing: 'cubic-bezier(.3,.7,.2,1)' }));
}
async function irisClose(node) {
  if (!motionOn()) return;
  await finished(node.animate([{ clipPath: irisClip(110, 0.7) }, { clipPath: irisClip(0.5, 0) }], { duration: 320, easing: 'cubic-bezier(.6,0,.8,.4)', fill: 'forwards' }));
}

async function startPlace(placeId, { daily = false } = {}) {
  if (S.busy) return; S.busy = true;
  audioReady(); play('tap');
  S.placeId = placeId; S.place = PLACES[placeId];
  const lobbyNode = app.querySelector('[data-screen=lobby]');
  if (S.screen === 'lobby') await irisClose(lobbyNode);
  const place = S.place, seen = Object.keys(album.cards).filter((id) => album.cards[id].named);
  const missions = pickMissions(place, { collected: seen, weak: learn.weak(place), notices: album.notices, rng, voice: voiceOn() });
  if (daily) {
    const d = dailyMission(openPlaces().map((id) => PLACES[id]), Date.now());
    if (d.place === placeId && !album.daily[d.day]) { const i = missions.findIndex((m) => m.kind === 'meaning'); const fresh = { kind: 'meaning', group: d.group, word: d.word, tries: 0, daily: true }; const dup = missions.findIndex((m) => m.word === d.word); if (dup >= 0) missions[dup] = fresh; else if (i >= 0) missions[i] = fresh; S.daily = d; }
  } else S.daily = null;
  S.missions = missions; S.plates = layoutPlates(place, missions, rng);
  S.items = [...S.plates.filter((p) => p.kind !== 'decor'), ...place.things.map((th) => ({ ...th, kind: 'thing', group: null }))];
  S.mi = -1; S.shots = []; S.focus = null; S.firstRight = 0; S.cardsThisRound = 0; S.startedAt = Date.now(); S.missionAt = 0; S.phase = 'explore'; S.msgMin = false; ff = null;
  S.round += 1; S.dailyDone = false; S.developStarted = false;
  $('#place-name').textContent = pick(place.name, lang); $('#place-when').textContent = pick(place.when, lang);
  $('#photo').src = place.photo; $('#photo').width = place.w; $('#photo').height = place.h;
  stage.style.width = `${place.w}px`; stage.style.height = `${place.h}px`;
  drawPlates(); drawDots(); updateThumb(); focusBox.hidden = true; $('#step-back').hidden = true; $('#sheet').hidden = true;
  const shootNode = app.querySelector('[data-screen=shoot]');
  // 사진을 다 풀어 둔 뒤에 조리개를 연다(큰 그림을 처음 그리는 멈춤이 전환과 겹치지 않게 — 주문 폭주 11-03 추적).
  await $('#photo').decode().catch(() => {});
  show('shoot'); measure();
  const s = cam.base, cx = place.start[0] * place.w, cy = place.start[1] * place.h;
  Object.assign(cam, { s, ...clampCam({ s, x: vfW / 2 - cx * s, y: vfH / 2 - cy * s }), tween: null, vx: 0, vy: 0 }); applyCam();
  S.busy = false;
  await irisOpen(shootNode);
  lobbyNode.getAnimations?.().forEach((a) => a.cancel());
  startAmbience(place.ambience);
  await wait(motionOn() ? 240 : 0);
  if (S.screen !== 'shoot') return;
  const back = (album.placePlays[placeId] || 0) > 0;
  say({ ...taeo(back ? 'taeo.helloBack' : helloKey(placeId)), actions: back ? goAction() : null, sound: 'message' });
  if (!back) { clearTimeout(S.hintTimer); S.hintTimer = setTimeout(firstHint, 5200); }
}
const goAction = () => [{ label: t('shoot.go'), run: beginMissions }];
function drawPlates() {
  const layer = $('#plates'); layer.replaceChildren();
  for (const p of S.plates) { layer.append(plateNode(p)); }
  const row = S.place.groups.row;
  if (row) S.plates.filter((p) => p.group === 'row').forEach((p) => { const y0 = p.q[0][1], y1 = p.q[2][1]; layer.append(plateNode({ q: [[1467, y0], [1507, y0], [1507, y1], [1467, y1]], text: String(p.floor), style: 'row' })); });
  const kbd = $('#kbd'); kbd.replaceChildren();
  shuffle(S.items, Math.random).forEach((item, i) => {
    const b = el('button', 'kbd-item'); b.type = 'button'; b.textContent = t(item.kind === 'thing' ? 'a11y.thing' : 'a11y.plate', { n: i + 1 });
    b.addEventListener('focus', () => { if (S.focus !== item) focusOn(item); });
    b.addEventListener('click', (e) => { e.stopPropagation(); if (S.focus === item) snap(); else focusOn(item); });
    kbd.append(b);
  });
}
function drawDots() {
  const dots = $('#dots'); dots.replaceChildren();
  S.missions.forEach((m, i) => { const d = el('li', i < S.mi || m.done ? 'is-done' : i === S.mi ? 'is-now' : ''); dots.append(d); });
}
function updateThumb() {
  const pic = $('#thumb-pic'), total = Object.keys(album.cards).length;
  $('#thumb-n').textContent = namedCount();
  pic.replaceChildren();
  const last = S.shots[S.shots.length - 1] || null;
  if (last) pic.append(cropNode(S.placeId, bboxOf(last.q), last.scene, 48, 48));
  $('#thumb').classList.toggle('is-empty', !last && !total);
}
function firstHint() {
  if (S.screen !== 'shoot' || S.phase !== 'explore' || S.shots.length || S.focus) return;
  toast(t('shoot.firstHint'), 4200);
}
let toastTimer = 0;
function toast(text, ms = 2200) {
  const n = $('#toast'); n.textContent = text; n.hidden = false; live.textContent = text;
  spatial(n, [{ opacity: 0, transform: 'translate(-50%,8px)' }, { opacity: 1, transform: 'translate(-50%,0)' }], M.base);
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { n.hidden = true; }, ms);
}

// ── 뷰파인더 조작 ────────────────────────────────────────────────
let drag = null, lastTap = { t: 0, item: null };
function bindViewfinder() {
  vf.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.msg,.sheet button,.step-back,.kbd-item') || S.busy || S.phase === 'done') return;
    vf.setPointerCapture?.(e.pointerId);
    cam.tween = null; cam.vx = cam.vy = 0; stage.style.willChange = 'transform';
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false, t: performance.now(), lastX: e.clientX, lastY: e.clientY, lastT: performance.now() };
  });
  vf.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 7) return;
    if (!drag.moved) { drag.moved = true; minimizeMsg(); dismissSheet(); clearTimeout(S.hintTimer); }
    const now = performance.now(), dt = Math.max(1, now - drag.lastT);
    cam.vx = (e.clientX - drag.lastX) / dt; cam.vy = (e.clientY - drag.lastY) / dt; drag.lastX = e.clientX; drag.lastY = e.clientY; drag.lastT = now;
    const rx = drag.cx + dx, ry = drag.cy + dy, c = clampCam({ s: cam.s, x: rx, y: ry });
    cam.x = c.x + (rx - c.x) * 0.3; cam.y = c.y + (ry - c.y) * 0.3;
    applyCam(); kick();
  });
  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const was = drag; drag = null;
    if (was.moved) { if (!motionOn() || performance.now() - was.lastT > 80) cam.vx = cam.vy = 0; kick(); return; }
    cam.vx = cam.vy = 0;
    const r = vf.getBoundingClientRect(); tapAt(e.clientX - r.left, e.clientY - r.top);
  };
  vf.addEventListener('pointerup', end); vf.addEventListener('pointercancel', () => { drag = null; kick(); });
  addEventListener('resize', () => { if (S.screen === 'lobby') layoutLobbyPhoto(app.querySelector('[data-screen=lobby]')); if (S.screen !== 'shoot') return; measure(); const c = clampCam({ s: Math.max(cam.s, cam.base), x: cam.x, y: cam.y }); Object.assign(cam, { s: Math.max(cam.s, cam.base), ...c }); applyCam(); kick(); });
  addEventListener('keydown', (e) => {
    if (S.screen !== 'shoot') return;
    const step = { ArrowLeft: [90, 0], ArrowRight: [-90, 0], ArrowUp: [0, 70], ArrowDown: [0, -70] }[e.key];
    if (step) { e.preventDefault(); goCam({ s: cam.s, x: cam.x + step[0], y: cam.y + step[1] }, 220); }
    else if (e.key === ' ' && !e.target.closest?.('button,input')) { e.preventDefault(); snap(); }
    else if (e.key === 'Escape') stepBack();
  });
}
function itemAt(sx, sy) {
  const ix = (sx - cam.x) / cam.s, iy = (sy - cam.y) / cam.s, pad = 12 / cam.s;
  let best = null, bestScore = Infinity;
  for (const item of S.items) {
    const d = quadDistance(item.q, ix, iy);
    if (d > pad) continue;
    const b = bboxOf(item.q), score = (d > 0 ? 1e7 + d : 0) + b.w * b.h;   // 안쪽이면 작은 쪽(벤치 위 고양이), 밖이면 가까운 쪽
    if (score < bestScore) { best = item; bestScore = score; }
  }
  return best;
}
function tapAt(sx, sy) {
  if (S.phase === 'done' || S.busy) return;
  clearTimeout(S.hintTimer); dismissSheet();
  const item = itemAt(sx, sy);
  if (!item) { if (S.focus) stepBack(); return; }
  if (S.focus && S.focus.id === item.id) { snap(); return; }
  minimizeMsg();
  focusOn(item);
}
function groupBox(item) {
  const frame = item.group && S.place.groups[item.group]?.frame;   // 층별 안내는 층 번호 · 머리글까지 한 판이다
  if (frame) return bboxOf(frame);
  if (item.kind === 'plate') return unionBox(S.items.filter((i) => i.group === item.group).map((i) => bboxOf(i.q)));
  return bboxOf(item.q);
}
function focusOn(item) {
  const prevGroup = S.focus?.group, sameGroup = S.focus && item.group && prevGroup === item.group;
  S.focus = item; $('#shutter').classList.add('is-ready');
  focusBox.hidden = false; ff = sameGroup ? ff : null;
  const box = groupBox(item), own = bboxOf(item.q);
  const minH = item.kind === 'plate' ? Math.min(...S.items.filter((i) => i.group === item.group).map((i) => bboxOf(i.q).h)) : own.h;
  const fit = Math.min((vfW * 0.74) / box.w, (vfH * 0.6) / box.h);
  const s = Math.min(cam.base * 3.2, Math.max(cam.base, fit, 32 / minH));
  const inX = box.w * s <= vfW * 0.92, inY = box.h * s <= vfH * 0.8;
  const cx = inX ? box.x + box.w / 2 : own.x + own.w / 2, cy = inY ? box.y + box.h / 2 : own.y + own.h / 2;
  const target = { s, x: vfW / 2 - cx * s, y: vfH * 0.42 - cy * s };
  const near = Math.abs(cam.s - s) < 0.01 && sameGroup && own.x * s + target.x >= 0 && (own.x + own.w) * s + cam.x <= vfW && (own.x * s + cam.x) >= 0;
  if (!near) { goCam(target, 500); play('lens'); }
  play('focus'); if (item.sound) setTimeout(() => play(item.sound), 90);
  $('#step-back').hidden = false;
  spatial($('.focus-in'), [{ transform: 'scale(1.22)', opacity: 0.2 }, { transform: 'scale(1)', opacity: 1 }], M.fast);
  live.textContent = item.text ? oneLine(item.text) : '';
  kick();
}
function stepBack() {
  dismissSheet();
  if (!S.focus) return;
  S.focus = null; ff = null; focusBox.hidden = true; $('#step-back').hidden = true; $('#shutter').classList.remove('is-ready');
  const cx = (vfW / 2 - cam.x) / cam.s, cy = (vfH / 2 - cam.y) / cam.s, s = cam.base;
  goCam({ s, x: vfW / 2 - cx * s, y: vfH / 2 - cy * s }, 500);
}

// ── 찍기 ─────────────────────────────────────────────────────────
async function snap() {
  if (S.busy || S.phase === 'done') return;
  const btn = $('#shutter');
  if (!S.focus) { play('nope'); spatial(btn, [{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }], { duration: 220, easing: 'ease-out' }); toast(t('shoot.noFocus')); return; }
  S.busy = true;
  const item = S.focus, box = bboxOf(item.q);
  const visible = (p) => { const b = bboxOf(p.q), mx = box.w * 0.4 + 40, my = box.h * 0.6 + 40; return b.x < box.x + box.w + mx && b.x + b.w > box.x - mx && b.y < box.y + box.h + my && b.y + b.h > box.y - my; };
  const scene = S.plates.filter(visible).map((p) => ({ q: p.q, text: p.text, style: p.style, vertical: !!p.vertical }));
  const shot = { word: item.word, kind: item.kind, q: item.q, scene, style: item.style || null, text: item.text || null };
  play('shutter');
  shutterFlash();
  spatial(btn.querySelector('i'), [{ transform: 'scale(1)' }, { transform: 'scale(.82)' }, { transform: 'scale(1)' }], { duration: 240, easing: 'ease-out' });
  S.shots.push(shot);
  const fresh = addCard(album, { ...shot, q: item.q, style: item.style }, S.placeId, Date.now());
  if (album.cards[shot.word] && fresh) album.cards[shot.word].scene = scene;
  await wait(motionOn() ? 150 : 0);
  if (S.phase === 'explore') await afterExploreShot(shot, fresh);
  else if (S.phase === 'mission') await afterMissionShot(shot, fresh);
  S.busy = false; save();
}
function shutterFlash() {
  if (!motionOn()) return;
  const T = $('#blade-t'), B = $('#blade-b'), F = $('#flash');
  const frames = (y) => [{ transform: `translateY(${y})` }, { transform: 'translateY(0)', offset: 0.4 }, { transform: 'translateY(0)', offset: 0.5 }, { transform: `translateY(${y})` }];
  T.animate(frames('-100%'), { duration: 200, easing: 'cubic-bezier(.4,0,.6,1)' });
  B.animate(frames('100%'), { duration: 200, easing: 'cubic-bezier(.4,0,.6,1)' });
  F.animate([{ opacity: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 0.8, offset: 0.55 }, { opacity: 0 }], { duration: 300, easing: 'linear' });
}
function printNode(shot, { w = 214, caption = '' } = {}) {
  const h = Math.round(w * 0.78), node = el('div', 'print');
  node.append(cropNode(S.placeId, bboxOf(shot.q), shot.scene, w - 16, h));
  const cap = el('div', 'print-cap'); cap.textContent = caption; node.append(cap);
  return node;
}
async function flyToThumb(node, { quiet = false, step = 0 } = {}) {
  const to = $('#thumb').getBoundingClientRect();
  await flyTo(node, to, { lift: 90 });
  node.remove();
  play('card', { quiet, step });
  updateThumb();
  spatial($('#thumb'), [{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], M.fast);
}

const helloKey = (placeId) => (placeId === 'union' ? 'taeo.helloUnion' : 'taeo.hello');
// 둘러보기: 카드가 펼쳐지고 소리가 난다. 찍은 것은 앨범에 꽂히지만 이름은 아직 없다.
let sheetFly = null;
async function afterExploreShot(shot, fresh) {
  const w = wordOf(shot.word); S.cardsThisRound += 1;
  showSheet(shot, w, fresh);
  if (w.voice) sayWord(shot.word);
  // 셋 넘게 찍으면 「부탁 들으러 가기」 — 저절로 끊지 않는다(설계 검토 1). 찍은 뒤에도 그 자리에 머문다: 옆 판을 바로 찍을 수 있게.
  if (S.shots.length >= 3) say({ ...taeo(helloKey(S.placeId)), actions: goAction(), min: true });
}
function showSheet(shot, w, fresh) {
  const sheet = $('#sheet'); dismissSheet(true);
  sheet.hidden = false; $('#msg').hidden = true;
  sheet.replaceChildren();
  const pic = el('div', 'sheet-pic'); pic.append(cropNode(S.placeId, bboxOf(shot.q), shot.scene, 92, 92));
  const body = el('div', 'sheet-body');
  body.innerHTML = `<div class="sheet-head"><strong class="sheet-word">${esc(oneLine(w.ko))}</strong>${w.voice ? `<button class="sheet-sound" aria-label="${t('card.sound')}">${ICON.speaker}</button>` : ''}${fresh ? '<span class="sheet-new">NEW</span>' : ''}</div><p class="sheet-mean">${esc(pick(w.mean, lang))}</p><p class="sheet-ex">${esc(w.ex.ko)}</p>${lang === 'ko' ? '' : `<p class="sheet-gloss">${esc(pick(w.ex, lang))}</p>`}`;
  body.querySelector('.sheet-sound')?.addEventListener('click', (e) => { e.stopPropagation(); sayWord(w.id); });
  sheet.append(pic, body);
  spatial(sheet, [{ opacity: 0, transform: 'translateY(18px) scale(.96)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }], M.base);
  sheetFly = { fresh, shot, step: S.cardsThisRound - 1 };
  live.textContent = `${oneLine(w.ko)} — ${pick(w.mean, lang)}`;
}
function dismissSheet(instant = false) {
  const sheet = $('#sheet'); if (!sheet || sheet.hidden) return;
  const info = sheetFly; sheetFly = null;
  sheet.hidden = true; $('#msg').hidden = !$('#msg').dataset.has;
  if (!info || instant) { if (info) { play('card', { step: info.step, quiet: !info.fresh }); updateThumb(); } return; }
  const node = printNode(info.shot, { w: 120 }), r = sheet.getBoundingClientRect(), v = vf.getBoundingClientRect();
  node.classList.add('print-fly'); node.style.left = `${r.left - v.left}px`; node.style.top = `${r.top - v.top}px`;
  vf.append(node);
  flyToThumb(node, { quiet: !info.fresh, step: info.step });
}

// 부탁
function beginMissions() {
  if (S.phase !== 'explore') return;
  play('tap'); dismissSheet(); stepBack();
  S.phase = 'mission'; S.missionAt = Date.now(); S.mi = -1;
  nextMission();
}
function missionLine(m) {
  const w = wordOf(m.word);
  if (m.kind === 'sound') return { ...taeo('taeo.sound'), voice: m.word };
  if (m.kind === 'word') return taeo('taeo.word', w.ko);
  return { ko: w.ask.ko, gloss: lang === 'ko' ? null : pick(w.ask, lang) };
}
function nextMission() {
  S.mi += 1; drawDots();
  if (S.mi >= S.missions.length) return endMissions();
  const m = S.missions[S.mi]; m.tries = 0; m.startAt = Date.now();
  const line = missionLine(m);
  say({ ...line, sound: 'message' });
  learn.present(m);
  const round = S.round;
  if (m.kind === 'sound') setTimeout(() => { if (round === S.round && S.screen === 'shoot') sayWord(m.word, () => learn.heard(m)); }, 420);
}
async function afterMissionShot(shot, fresh) {
  const m = S.missions[S.mi], round = S.round;
  // 기다리는 동안 입구로 나갔으면 이 판의 나머지를 잇지 않는다.
  const left = () => { if (round === S.round) return false; pr.remove(); return true; };
  const right = judgeShot(m, shot);
  const pr = printNode(shot, { w: 150 }), cap = pr.querySelector('.print-cap');
  pr.classList.add('print-fly'); pr.style.left = `${vfW / 2 - 75}px`; pr.style.top = `${vfH * 0.26}px`;
  vf.append(pr);
  spatial(pr, [{ opacity: 0, transform: 'scale(.86) rotate(-3deg)' }, { opacity: 1, transform: 'scale(1) rotate(-1.5deg)' }], M.base);
  const firstTry = m.tries === 0, seenWord = m.tries >= 2;
  if (right) {
    m.done = true;
    if (firstTry) S.firstRight += 1;
    const named = !seenWord && nameCard(album, m.word, Date.now());
    if (named) {
      cap.textContent = oneLine(wordOf(m.word).ko); cap.classList.add('is-writing');
      play('name', { step: S.firstRight });
    }
    learn.answer(m, { correct: true, selected: shot.word, attemptNo: m.tries + 1 });
    await wait(motionOn() ? (named ? 820 : 420) : 200);
    if (left()) return;
    const msgBox = $('#msg').getBoundingClientRect();
    await flyTo(pr, msgBox, { lift: 40, duration: 360, end: 0.2 });
    if (left()) return;
    pr.remove(); play('right'); updateThumb();
    if (m.daily) { album.streak = finishDaily(album, Date.now()); S.dailyDone = true; }
    say({ ...taeo(`taeo.right${Math.floor(Math.random() * 4)}`), sent: shot, keepMin: false });
    stepBack(); drawDots();
    save();
    await wait(motionOn() ? 1300 : 500);
    if (left()) return;
    nextMission();
  } else {
    learn.answer(m, { correct: false, selected: shot.word, attemptNo: m.tries + 1 });
    m.tries += 1;
    await wait(motionOn() ? 420 : 100);
    if (left()) return;
    await flyToThumb(pr, { quiet: true });
    if (left()) return;
    play('other');
    const level = helpLevel(m.tries), w = wordOf(m.word), got = wordOf(shot.word);
    const base = missionLine(m);
    if (level === 'point') say({ ...base, reply: taeo(shot.kind === 'thing' ? 'taeo.otherThing' : 'taeo.other', oneLine(got.ko)) });
    else if (level === 'word') { learn.helped(m); say({ ...base, reply: m.kind === 'word' ? taeo('taeo.helpThing') : taeo('taeo.help', oneLine(w.ko)) }); }
    else { learn.helped(m); say({ ...base, reply: taeo('taeo.plate') }); blinkAnswer(m); }
  }
}
function blinkAnswer(m) {
  const target = m.kind === 'word' ? S.items.find((i) => i.kind === 'thing' && i.word === m.word) : S.items.find((i) => i.kind === 'plate' && i.word === m.word);
  if (!target) return;
  focusOn(target);
  const inner = $('.focus-in');
  effect(inner, [{ opacity: 1 }, { opacity: 0.15 }, { opacity: 1 }, { opacity: 0.15 }, { opacity: 1 }], { duration: 900, easing: 'linear' });
}
function endMissions() {
  S.missionMs = Date.now() - S.missionAt;
  say({ ...taeo('taeo.done'), sound: 'message' });
  S.phase = 'done'; stepBack();
  const round = S.round;
  // 앨범을 열어 둔 채면 닫을 때 잇는다(closeAlbum).
  setTimeout(() => { if (round === S.round && S.screen === 'shoot') toDevelop(); }, motionOn() ? 1700 : 600);
}

// 메시지(셔터 위 — 판을 가리지 않는다)
function say({ ko, gloss = null, voice = null, actions = null, sound = null, reply = null, sent = null, min = false }) {
  const box = $('#msg'); box.dataset.has = '1';
  box.replaceChildren();
  const avatar = el('img', 'msg-face'); avatar.src = 'assets/taeo.webp'; avatar.alt = ''; avatar.draggable = false;
  const body = el('div', 'msg-body');
  body.innerHTML = `<div class="msg-who">${t('msg.who')}</div>`;
  if (reply) { const r = el('p', 'msg-reply'); r.textContent = reply.ko; body.append(r); if (reply.gloss) { const rg = el('p', 'msg-gloss'); rg.textContent = reply.gloss; body.append(rg); } }
  if (voice) {
    const b = el('button', 'msg-voice', `<span class="msg-play">${ICON.play}</span><span class="msg-wave" aria-hidden="true">${'<i></i>'.repeat(14)}</span><small>${t('msg.voice')}</small>`);
    b.setAttribute('aria-label', t('msg.replay')); b.addEventListener('click', (e) => { e.stopPropagation(); const m = S.missions[S.mi]; sayWord(voice, () => learn.heard(m)); spatial(b, [{ transform: 'scale(.97)' }, { transform: 'scale(1)' }], M.fast); });
    body.append(b);
  }
  const line = el('p', 'msg-ko'); line.textContent = ko; body.append(line);
  if (gloss) { const g = el('p', 'msg-gloss'); g.textContent = gloss; body.append(g); }
  if (sent) { const pic = el('div', 'msg-sent'); pic.append(cropNode(S.placeId, bboxOf(sent.q), sent.scene, 54, 54)); body.prepend(pic); }
  if (actions) { const row = el('div', 'msg-actions'); for (const a of actions) { const btn = el('button', 'pill', esc(a.label)); btn.addEventListener('click', (e) => { e.stopPropagation(); a.run(); }); row.append(btn); } body.append(row); }
  box.append(avatar, body);
  box.classList.toggle('is-min', !!min && !actions);
  box.hidden = !$('#sheet').hidden;
  S.msgMin = !!min;
  if (sound) play(sound);
  if (!min) spatial(box, [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'translateY(0)' }], M.base);
  live.textContent = `${t('msg.who')}: ${ko}`;
  box.onclick = () => { box.classList.remove('is-min'); S.msgMin = false; };
}
function minimizeMsg() { const box = $('#msg'); if (!box.hidden && !box.querySelector('.msg-actions')) { box.classList.add('is-min'); S.msgMin = true; } }

// ── 인화 ─────────────────────────────────────────────────────────
function toDevelop() { if (S.developStarted) return; S.developStarted = true; startDevelop(); }
async function startDevelop() {
  stopAmbience();
  const root = app.querySelector('[data-screen=develop]');
  const qs = makeRecall(S.place, S.shots.filter((s) => s.word && (album.notices || wordOf(s.word).band !== 'notice')), { rng, lang, album });
  if (!qs.length) return finishRound();
  show('develop');
  root.replaceChildren();
  const head = el('div', 'dev-head', `<small>${t('print.head')}</small><ol class="dev-dots">${qs.map(() => '<li></li>').join('')}</ol>`);
  const slot = el('div', 'dev-slot'), q = el('p', 'dev-q'), opts = el('div', 'dev-opts');
  root.append(head, slot, q, opts);
  spatial(root, [{ opacity: 0 }, { opacity: 1 }], M.eslow);
  for (let i = 0; i < qs.length; i += 1) {
    await askRecall(qs[i], i, { root, slot, q, opts });
    root.querySelectorAll('.dev-dots li')[i].classList.add('is-done');
  }
  finishRound();
}
function askRecall(item, i, { slot, q, opts }) {
  return new Promise((resolve) => {
    const shot = item.shot, w = wordOf(shot.word);
    S.recallNow = item;
    slot.replaceChildren();
    const pr = el('div', 'print dev-print');
    const shape = Math.min(300, Math.max(220, innerWidth * 0.64));
    // 물건 사진은 판 글자를 뺀다: 자전거 사진 옆 안내판에 「자전거」가 쓰여 있으면 글자 모양으로 풀린다(Koe 규칙).
    const showText = item.mode === 'meaning';
    pr.append(cropNode(S.placeId, bboxOf(shot.q), showText ? shot.scene : [], shape, Math.round(shape * 0.8)));
    const cap = el('div', 'print-cap'); pr.append(cap); slot.append(pr);
    play('print');
    spatial(pr, [{ transform: 'translateY(46%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
    const pic = pr.querySelector('.crop');
    effect(pic, [{ filter: 'grayscale(1) brightness(1.5) contrast(.4)' }, { filter: 'grayscale(0) brightness(1) contrast(1)' }], { duration: 1200, easing: 'cubic-bezier(.3,.6,.2,1)' });
    // 사진에 옆 판이 같이 찍히므로 어느 판을 묻는지 낱말을 밝힌다(옆 판의 뜻이 보기에 있어도 정답이 하나로 정해지게).
    q.textContent = item.mode === 'word' ? t('print.word') : `${oneLine(wordOf(item.answer).ko)} — ${t('print.meaning')}`;
    opts.replaceChildren();
    let answered = false;
    const label = (id) => (item.mode === 'word' ? oneLine(wordOf(id).ko) : pick(wordOf(id).mean, lang));
    for (const id of item.options) {
      const b = el('button', 'dev-opt'); b.textContent = label(id);
      if (item.mode === 'word') b.lang = 'ko';
      b.addEventListener('click', async () => {
        if (answered) return; answered = true;
        const right = id === item.answer;
        for (const o of opts.children) o.disabled = true;
        b.classList.add(right ? 'is-right' : 'is-other');
        if (!right) [...opts.children].find((o) => o.textContent === label(item.answer))?.classList.add('is-answer');
        learn.recall(item, id);
        if (right) { const fresh = nameCard(album, item.answer, Date.now()); cap.textContent = oneLine(w.ko); cap.classList.add('is-writing'); play('name', { step: i + 1 }); if (fresh) S.namedNow = (S.namedNow || 0) + 1; }
        else { cap.textContent = oneLine(w.ko); cap.classList.add('is-faint'); play('soft'); }
        save();
        await wait(motionOn() ? (right ? 950 : 1300) : 500);
        resolve();
      });
      opts.append(b);
    }
    spatial(opts, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'translateY(0)' }], M.base);
  });
}

// ── 끝: 앨범 한 면 ───────────────────────────────────────────────
function finishRound() {
  const place = S.place, before = openPlaces().length;
  const rec = recordRound(album, S.placeId, { ms: S.missionMs || 0, first: S.firstRight, of: S.missions.length });
  const prog = placeProgress(album, place), stampNew = prog.done && !album.stamps[S.placeId];
  if (stampNew) album.stamps[S.placeId] = Date.now();
  save();
  const unlocked = openPlaces().length > before ? PLACE_ORDER.find((id) => openPlaces().includes(id) && id !== 'gate') : null;
  renderResult({ rec, prog, stampNew, unlocked });
}
function renderResult({ rec, prog, stampNew, unlocked }) {
  const root = app.querySelector('[data-screen=result]'), place = S.place;
  root.replaceChildren();
  const page = el('div', 'res-page');
  const seen = new Set(), today = S.shots.filter((s) => s.word && !seen.has(s.word) && seen.add(s.word)).slice(-6);
  page.innerHTML = `
   <header class="res-head"><small>${esc(pick(place.when, lang))}</small><h2>${esc(pick(place.name, lang))}</h2></header>
   <div class="res-prints" id="res-prints"></div>
   <dl class="res-stats">
    <div><dt>${t('result.named')}</dt><dd><span class="n" id="r-named">0</span><i>/ ${prog.total}</i></dd></div>
    <div><dt>${t('result.first')}</dt><dd><span class="n" id="r-first">0</span><i>/ ${S.missions.length}</i></dd></div>
    <div><dt>${t('result.time')}</dt><dd><span class="n">${mmss(S.missionMs || 0)}</span>${rec.newBest && rec.previous ? `<em class="res-new">${t('result.newBest')}</em>` : rec.previous ? `<i>${t('result.best', { t: mmss(album.best[S.placeId].ms) })}</i>` : ''}</dd></div>
   </dl>
   ${S.dailyDone ? `<p class="res-note">${t('result.daily', { n: album.streak })}</p>` : ''}
   ${unlocked ? `<p class="res-note">${esc(t('result.unlocked', { place: pick(PLACES[unlocked].name, lang) }))}</p>` : ''}
   <div class="res-actions"><button class="start" data-go="again">${t('result.again')}</button><div class="res-row"><button class="ghost" data-go="album">${t('result.album')}</button><button class="ghost" data-go="back">${t('result.lobby')}</button></div></div>`;
  root.append(page); show('result');
  const prints = $('#res-prints', page);
  today.forEach((s, i) => {
    const card = album.cards[s.word], p = el('div', 'print res-print');
    p.style.setProperty('--r', `${(i % 2 ? 1 : -1) * (1 + (i % 3))}deg`);
    p.append(cropNode(S.placeId, bboxOf(s.q), s.scene, 86, 72));
    const cap = el('div', 'print-cap'); if (card?.named) cap.textContent = oneLine(wordOf(s.word).ko); p.append(cap);
    prints.append(p);
    spatial(p, [{ opacity: 0, transform: `translateY(14px) rotate(0deg) scale(.9)` }, { opacity: 1, transform: `translateY(0) rotate(var(--r)) scale(1)` }], M.fast, { delay: i * 80 });
  });
  const named = $('#r-named', page), first = $('#r-first', page);
  setTimeout(() => { rollTo(named, prog.got); rollTo(first, S.firstRight); }, motionOn() ? today.length * 80 + 120 : 0);
  if (stampNew) setTimeout(() => {
    const st = el('div', 'stamp', `<b>${esc(pick(place.name, lang))}</b><small>${t('result.stamp')}</small>`); page.append(st); play('stamp');
    spatial(st, [{ opacity: 0, transform: 'scale(1.8) rotate(-22deg)' }, { opacity: 1, transform: 'scale(1) rotate(-12deg)' }], { duration: 300, easing: 'cubic-bezier(.3,1.3,.5,1)' });
  }, motionOn() ? today.length * 80 + 600 : 0);
}

// ── 앨범 ─────────────────────────────────────────────────────────
function renderAlbum() {
  const root = app.querySelector('[data-screen=album]'); root.replaceChildren();
  S.albumFrom = S.screen === 'album' ? S.albumFrom : S.screen;
  const body = el('div', 'alb');
  const tabs = [...PLACE_ORDER.map((id) => ({ id, name: pick(PLACES[id].name, lang), open: openPlaces().includes(id) })), ...COMING.map((c) => ({ id: c.id, name: pick(c.name, lang), open: false }))];
  const cur = S.albumPlace && PLACES[S.albumPlace] ? S.albumPlace : S.placeId, place = PLACES[cur];
  S.albumPlace = cur;
  const prog = placeProgress(album, place), best = album.best[cur];
  body.innerHTML = `
   <header class="alb-head"><button class="bar-icon" data-go="album-close" aria-label="${t('album.close')}">${ICON.back}</button><h2>${t('album.title')}</h2><span class="alb-n">${prog.got} / ${prog.total}</span></header>
   <div class="alb-tabs">${tabs.map((x) => `<button class="alb-tab ${x.id === cur ? 'is-on' : ''} ${x.open ? '' : 'is-locked'}" data-album-place="${x.id}" ${x.open ? '' : 'aria-disabled="true"'}>${esc(x.name)}</button>`).join('')}</div>
   ${album.stamps[cur] ? `<div class="stamp stamp-small"><b>${esc(pick(place.name, lang))}</b><small>${t('result.stamp')}</small></div>` : ''}
   <div class="alb-grid" id="alb-grid"></div>
   <section class="alb-record"><h3>${t('album.record')}</h3><p>${best ? `${mmss(best.ms)} · ${t('result.first')} ${best.first} / ${best.of}` : t('album.none')}</p>${album.streak ? `<p>${t('lobby.streak', { n: album.streak })}</p>` : ''}</section>`;
  root.append(body);
  const grid = $('#alb-grid', body);
  for (const id of placeWords(place, { notices: album.notices })) {
    const card = album.cards[id], w = wordOf(id), cell = el(card ? 'button' : 'div', `print alb-card ${card ? '' : 'is-empty'}`);
    if (card) {
      cell.append(cropNode(card.place in PLACES ? card.place : cur, bboxOf(card.q), card.scene || [], 96, 76));
      const cap = el('div', 'print-cap'); if (card.named) cap.textContent = oneLine(w.ko); cell.append(cap);
      cell.addEventListener('click', () => openCard(id));
    } else { cell.innerHTML = '<span class="alb-q" aria-hidden="true">?</span><div class="print-cap"></div>'; cell.setAttribute('aria-hidden', 'true'); }
    grid.append(cell);
  }
  show('album');
}
function openCard(id) {
  const card = album.cards[id], w = wordOf(id), root = app.querySelector('[data-screen=album]');
  const over = el('div', 'alb-over');
  const box = el('div', 'alb-sheet');
  box.append(cropNode(card.place in PLACES ? card.place : S.placeId, bboxOf(card.q), card.scene || [], Math.min(320, innerWidth - 72), 190));
  const body = el('div', 'alb-sheet-body');
  body.innerHTML = card.named
    ? `<div class="sheet-head"><strong class="sheet-word">${esc(oneLine(w.ko))}</strong>${w.voice ? `<button class="sheet-sound" aria-label="${t('card.sound')}">${ICON.speaker}</button>` : ''}</div><p class="sheet-mean">${esc(pick(w.mean, lang))}</p><p class="sheet-ex">${esc(w.ex.ko)}</p>${lang === 'ko' ? '' : `<p class="sheet-gloss">${esc(pick(w.ex, lang))}</p>`}`
    : `<div class="sheet-head"><strong class="sheet-word is-blank">____</strong>${w.voice ? `<button class="sheet-sound" aria-label="${t('card.sound')}">${ICON.speaker}</button>` : ''}</div><p class="sheet-mean">${t('card.noName')}</p>`;
  body.querySelector('.sheet-sound')?.addEventListener('click', (e) => { e.stopPropagation(); audioReady(); sayWord(id); });
  box.append(body); over.append(box); root.append(over);
  spatial(box, [{ opacity: 0, transform: 'translateY(22px)' }, { opacity: 1, transform: 'translateY(0)' }], M.base);
  over.addEventListener('click', (e) => { if (e.target === over) over.remove(); });
}
function closeAlbum() {
  if (S.albumFrom === 'shoot' && S.phase === 'done') { show('shoot'); toDevelop(); return; }
  const from = S.albumFrom === 'shoot' ? 'shoot' : S.albumFrom === 'result' ? 'result' : 'lobby';
  if (from === 'lobby') backToLobby(); else show(from);
}
function backToLobby() {
  learn.leave();
  S.round += 1; S.busy = false; clearTimeout(S.hintTimer);
  stopAmbience(); S.phase = 'idle'; S.focus = null;
  app.querySelector('[data-screen=lobby]').replaceWith(renderLobby());
  show('lobby'); firstLobby();
}
function soundSheet() {
  const over = el('div', 'alb-over snd-over');
  const row = (key, label) => `<label class="snd-row"><span>${label}</span><input type="range" min="0" max="1" step="0.05" value="${prefs[key]}" data-key="${key}"></label>`;
  over.innerHTML = `<div class="alb-sheet snd-sheet"><h3>${t('sound.title')}</h3>${row('sfx', t('sound.sfx'))}${row('amb', t('sound.amb'))}${row('voice', t('sound.voice'))}<button class="ghost" data-close>${t('sound.close')}</button></div>`;
  over.addEventListener('input', (e) => {
    const k = e.target.dataset.key; if (!k) return;
    prefs[k] = Number(e.target.value);
    try { localStorage.setItem('synk.snap-words.sound', JSON.stringify(prefs)); } catch { /* 저장 못 하면 이번만 */ }
    audioReady();
    if (k === 'sfx' && bus) { bus.out.gain.value = prefs.sfx; play('card', { step: 2 }); }
    if (k === 'voice' && voiceOut) voiceOut.gain.value = prefs.voice;
    if (k === 'amb') ambience?.setVolume(prefs.amb);
  });
  over.addEventListener('click', (e) => { if (e.target === over || e.target.closest('[data-close]')) over.remove(); });
  app.append(over);
}
function firstLobby() {
  const root = app.querySelector('[data-screen=lobby]');
  layoutLobbyPhoto(root);
  // 흐린 사진 → 초점이 맞으며 또렷 → 괄호가 제목 날개를 잡는다: 카메라를 드는 순간 그대로.
  effect(root.querySelector('#lobby-photo'), [{ filter: 'blur(16px) brightness(.82)' }, { filter: 'blur(0) brightness(1)' }], { duration: 560, easing: 'cubic-bezier(.3,.7,.2,1)' });
  spatial(root.querySelector('#lobby-focus .focus-in'), [{ opacity: 0, transform: 'scale(1.32)' }, { opacity: 1, transform: 'scale(1)' }], M.fast, { delay: 620 });
  spatial(root.querySelector('.lobby-title'), [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'translateY(0)' }], M.base, { delay: 340 });
  spatial(root.querySelector('.lobby-bottom'), [{ opacity: 0, transform: 'translateY(26px)' }, { opacity: 1, transform: 'translateY(0)' }], M.base, { delay: 240 });
}

// ── 단추 ─────────────────────────────────────────────────────────
app.addEventListener('click', (e) => {
  if (e.target.closest('#shutter')) { snap(); return; }
  if (e.target.closest('#step-back')) { stepBack(); return; }
  const chip = e.target.closest('[data-place]');
  if (chip) {
    if (chip.classList.contains('is-locked')) { play('nope'); return; }
    audioReady(); play('tap');
    S.placeId = chip.dataset.place;
    { const n = renderLobby(); app.querySelector('[data-screen=lobby]').replaceWith(n); layoutLobbyPhoto(n); } show('lobby');
    return;
  }
  const tab = e.target.closest('[data-album-place]');
  if (tab) { if (!tab.classList.contains('is-locked')) { audioReady(); play('tap'); S.albumPlace = tab.dataset.albumPlace; renderAlbum(); } return; }
  const go = e.target.closest('[data-go]')?.dataset.go;
  if (!go) return;
  if (go === 'start') startPlace(S.placeId);
  else if (go === 'again') { app.querySelector('[data-screen=lobby]').hidden = true; S.screen = 'again'; S.dailyDone = false; startPlace(S.placeId); }
  else if (go === 'daily') { const d = dailyMission(openPlaces().map((id) => PLACES[id]), Date.now()); startPlace(d.place, { daily: !album.daily[d.day] }); }
  else if (go === 'album') { audioReady(); play('tap'); S.albumFrom = S.screen; dismissSheet(true); S.albumPlace = S.placeId; renderAlbum(); }
  else if (go === 'album-close') { play('tap'); closeAlbum(); }
  else if (go === 'back') { play('tap'); backToLobby(); }
  else if (go === 'sound') { audioReady(); play('tap'); soundSheet(); }
});
app.addEventListener('change', (e) => {
  if (e.target.dataset?.go === 'notices') { album.notices = e.target.checked; save(); audioReady(); play('tap'); { const n = renderLobby(); app.querySelector('[data-screen=lobby]').replaceWith(n); layoutLobbyPhoto(n); } show('lobby'); }
});

await Promise.race([document.fonts?.load?.('800 40px SUIT') || Promise.resolve(), wait(1500)]).catch(() => {});
renderShell(); show('lobby'); firstLobby();

// 시험 · 녹화용 손잡이(주문 폭주 __entry와 같은 꼴).
window.__snap = { S, cam, album, startPlace, snap, focusOn, stepBack, beginMissions, tapAt, itemAt, nextMission, finishRound,
  answerNow: () => { const q = S.recallNow; return q ? q.options.indexOf(q.answer) : 0; } };
