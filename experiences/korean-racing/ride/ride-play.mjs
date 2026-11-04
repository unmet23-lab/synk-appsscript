// MT 바닷가 자전거 레이스(WORLD 판)의 화면 글 · 인물 표시(설계 qa/world-mt-20261104/설계.md 3절). LAB 화면은 이 파일을 불러오지 않는다.
// id · data-* 는 그대로 두고 WORLD에서 보이는 글만 바꾸며, 이름표 · 말풍선은 #arena 안에 더한다. 규칙 · 판정 · 기록은 건드리지 않는다.
import { RIDERS } from './ride-riders.js';
import { lineOf, RESULT_BY_LAST, TAEO_LINES } from './ride-lines.mjs';

const BIKE_KEY = 'synk.racing.bike', BIKES = Object.freeze([{ id: 'city', name: '크루저', note: '굵은 바퀴 · 편한 손잡이' }, { id: 'hybrid', name: '하이브리드', note: '얇은 바퀴 · 일자 손잡이' }]);
/** 지난번 고른 자전거(이 기기 편의, 없어도 된다). 주소의 ?bike=가 앞선다(시안 · 확인용). */
export function savedBike() {
  const asked = new URLSearchParams(location.search).get('bike');
  if (BIKES.some((b) => b.id === asked)) return asked;
  try { const kept = localStorage.getItem(BIKE_KEY); if (BIKES.some((b) => b.id === kept)) return kept; } catch { /* 저장 없이 기본 */ }
  return 'city';
}
const TEXT = [
  ['.kicker', 'MT · LISTEN & RIDE'],
  ['.hero h1', '숙소까지 먼저!'],
  ['.lede', '꼴찌는 오늘 <br>저녁 설거지'],
  ['.sub', '동아리 MT 첫날, 바닷가 대여소에서 빌린 자전거로 숙소까지 달려요. 문제를 듣고 답이 있는 길로 꺾으면 내리막이 열려요.'],
  ['#start span', '출발'],
  ['#nitro-label', '질주'],
  ['#cruise-banner strong', '숙소 도착!'],
  ['#cruise-banner p', '바닷길을 천천히 달리다가 결과를 봐요.'],
  ['#pause-dialog p', '자전거와 문제가 함께 멈췄어요. 이어서 달리거나 처음으로 돌아갈 수 있어요.'],
  ['#r-title', '도착!'],
  ['#return-cruise', '바닷길로 돌아가기'],
  ['.res-grid .log .tag', '이번 레이스의 문제'],
];

const lobbies = new WeakMap();
/** 입구 글 · 자전거 카드를 3D 준비와 상관없이 바로 놓는다(옛 글이 비치거나 카드가 늦게 끼어 화면이 밀리지 않게). 준비 전에 고르면 저장해 두었다가 rig가 그 결로 만들어진다. */
export function prepareRideLobby(doc = document) {
  if (lobbies.has(doc)) return lobbies.get(doc);
  for (const [selector, html] of TEXT) { const node = doc.querySelector(selector); if (node && html) node.innerHTML = html; }
  for (const node of doc.querySelectorAll('.hero-shot,.hero-mongle,.res-mongle,.logo-mini,.logo-tag img,.driver img')) node.removeAttribute('src');   // 앱에 마스코트 그림을 받지 않는다
  // 자전거 고르기: 입구(시작 단추 위)와 멈춤 창(이어 하기 아래)에서 언제든. 고르면 바로 바뀌고 다음 판에도 기억한다.
  let rig = null, chosen = savedBike();
  const pickers = [];
  function paintPickers() { for (const box of pickers) for (const button of box.children) button.setAttribute('aria-checked', String(button.dataset.bike === (rig?.style ?? chosen))); }
  function makePicker(before) {
    const box = doc.createElement('div'); box.className = 'w-bikes'; box.setAttribute('role', 'radiogroup'); box.setAttribute('aria-label', '내 자전거');
    for (const b of BIKES) {
      const button = doc.createElement('button'); button.type = 'button'; button.className = 'w-bike'; button.dataset.bike = b.id; button.setAttribute('role', 'radio');
      const art = doc.createElement('img'); art.src = `assets/world/bike-${b.id}.webp`; art.alt = ''; art.width = 96; art.height = 56;
      const text = doc.createElement('span'), name = doc.createElement('strong'), note = doc.createElement('small'); name.textContent = b.name; note.textContent = b.note; text.append(name, note);
      button.append(art, text);
      button.addEventListener('click', () => { chosen = b.id; rig?.setStyle(b.id); try { localStorage.setItem(BIKE_KEY, b.id); } catch { /* 이번 판에서만 */ } paintPickers(); });
      box.append(button);
    }
    before.before(box); pickers.push(box);
  }
  makePicker(doc.getElementById('start')); makePicker(doc.querySelector('#pause-dialog .dialog-toggles')); paintPickers();
  function afterLobby() {
    const label = doc.querySelector('#start span');
    if (label && label.textContent === '레이스 시작') label.textContent = '출발';
    const status = doc.getElementById('world-status');
    if (status && status.textContent.includes('레이스 시작을')) status.textContent = '바닷길을 준비하고 있어요. 출발을 누르면 준비되는 대로 달려요.';
  }
  afterLobby();
  doc.title = '바닷가 레이스';
  doc.documentElement.dataset.rideReady = '1';
  const lobby = { afterLobby, chosen: () => chosen, bind(next) { if (chosen !== next.style) next.setStyle(chosen); rig = next; paintPickers(); } };
  lobbies.set(doc, lobby);
  return lobby;
}

export function setupRidePlay({ document: doc = document, rig, camera, narrator, getAudio = () => null, soundOn = () => true }) {
  const lobby = prepareRideLobby(doc); lobby.bind(rig);
  const { afterLobby } = lobby;
  const arena = doc.getElementById('arena'), v = new camera.position.constructor();
  const tags = rig.rivals.map((r) => {
    const el = doc.createElement('div'); el.className = 'w-tag'; el.hidden = true; el.setAttribute('aria-hidden', 'true');
    const name = doc.createElement('span'); name.className = 'w-tag-name'; name.textContent = RIDERS[r.who].name;
    const say = doc.createElement('span'); say.className = 'w-tag-say'; say.hidden = true;
    el.append(say, name); arena.append(el);
    return { r, el, say, sayLeft: 0, x: -1, y: -1 };
  });
  function speak(who, key) {
    const t = tags.find((item) => item.r.who === who), line = lineOf(who, key);
    if (!t || !line) return;
    t.say.textContent = line.text; t.say.hidden = false; t.sayLeft = 2.1;
    if (who === 'taeo') sayAloud(key);
  }
  rig.onEvent(({ type, who }) => speak(who, type === 'passed' ? 'passed' : 'ahead'));

  /* ── 태오 목소리: 파일이 있으면 그 자리에서 한 번. 문제 · 해설 · 안내 음성이 나오는 동안은 말하지 않고 뒤로 미룬다(1.5초 넘으면 버림) — 정답 낱말 · 해설을 가리면 안 된다. 판에 넷까지. ── */
  const voices = new Map(); let said = 0, waiting = null, voiceLoad = null;
  function loadVoices() {
    const ctx = getAudio();
    if (voiceLoad || !ctx) return voiceLoad;
    voiceLoad = Promise.all(Object.keys(TAEO_LINES).map(async (key) => { try { const res = await fetch(`assets/world/voice/taeo-${key}.mp3`); if (res.ok) voices.set(key, await ctx.decodeAudioData(await res.arrayBuffer())); } catch { /* 말풍선만 */ } }));
    return voiceLoad;
  }
  function playVoice(key) {
    const ctx = getAudio(), buffer = voices.get(key);
    if (!ctx || !buffer || !soundOn()) return;
    const src = ctx.createBufferSource(), gain = ctx.createGain(); gain.gain.value = .9; src.buffer = buffer; src.connect(gain); gain.connect(ctx.destination); src.onended = () => { src.disconnect(); gain.disconnect(); }; src.start();
  }
  function sayAloud(key, force = false) { if (force || said < 4) { waiting = { key, left: 1.5 }; said += force ? 0 : 1; } }
  function pumpVoice(dt) {
    if (!waiting) return;
    if (narrator?.playing) { waiting.left -= dt; if (waiting.left <= 0) waiting = null; return; }
    playVoice(waiting.key); waiting = null;
  }

  /* ── 순위 얼굴 칩: 나 · 태오 · 동기가 순위대로 줄을 선다. 자리가 바뀌면 미끄러진다. 글(#rank)은 화면 읽기용으로 남긴다. ── */
  const rankBox = doc.createElement('span'); rankBox.className = 'w-ranks'; rankBox.setAttribute('aria-hidden', 'true');
  const chips = new Map([['me', null], ['taeo', 'assets/world/chip-taeo.webp'], ['harin', 'assets/world/chip-harin.webp']].map(([id, src]) => {
    const chip = doc.createElement('i'); chip.className = `w-rank w-rank-${id}`; chip.dataset.who = id;
    if (src) { const img = doc.createElement('img'); img.src = src; img.alt = ''; chip.append(img); } else chip.textContent = '나';
    rankBox.append(chip); return [id, chip];
  }));
  doc.getElementById('rank')?.closest('.pill')?.after(rankBox);
  let rankOrder = '', correctSeen = 0;
  function paintRanks(round) {
    const road = round.playerS, order = [['me', road], ...rig.rivals.map((r) => [r.who, r.s])].sort((a, b) => b[1] - a[1]).map(([id]) => id), key = order.join();
    if (key === rankOrder) return; rankOrder = key;
    order.forEach((id, i) => { chips.get(id).style.setProperty('--at', i); });
  }
  /** 매 프레임: 상대 머리 위 이름표. 8~45m 안에서만, 멀수록 옅게. 화면 밖 · 카메라 뒤면 숨긴다. */
  function update(dt, round) {
    const road = rig.worldS(round.playerS), w = arena.clientWidth, h = arena.clientHeight;
    // 도착 뒤 바닷길은 상대를 늘 내 앞에 다시 놓으므로 순위 칩은 완주 순간 그대로 둔다.
    if (round.running) { pumpVoice(dt); if (!round.finished) paintRanks(round); }
    if (round.correct > correctSeen) { correctSeen = round.correct; const taeo = rig.rivals.find((r) => r.who === 'taeo'); if (taeo && Math.abs(rig.worldS(taeo.s) - road) < 12 && correctSeen <= 2) speak('taeo', 'praise'); } else if (round.correct < correctSeen) correctSeen = round.correct;
    for (const t of tags) {
      t.sayLeft -= dt; if (t.sayLeft <= 0 && !t.say.hidden) t.say.hidden = true;
      const gap = rig.worldS(t.r.s) - road, far = Math.abs(gap);
      // 문제가 나와 있는 동안은 게이트 판을 가리지 않게 말풍선이 없으면 이름표를 숨긴다.
      const asking = round.gate?.announced && !round.gate.judged && t.say.hidden;
      if (!round.running || gap < 2 || far > 45 || asking) { if (!t.el.hidden) t.el.hidden = true; continue; }
      v.copy(t.r.mesh.position); v.y += 2.15; v.project(camera);
      if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) { if (!t.el.hidden) t.el.hidden = true; continue; }
      if (t.el.hidden) t.el.hidden = false;
      const x = Math.round((v.x + 1) / 2 * w), y = Math.round((1 - v.y) / 2 * h);
      if (x !== t.x || y !== t.y) { t.el.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-100%)`; t.x = x; t.y = y; }
      const fade = far < 30 ? 1 : (45 - far) / 15; t.el.style.opacity = fade.toFixed(2);
    }
    // 둘이 한 줄로 서면 이름표가 포개진다 — 말풍선이 없는 쪽 가운데 더 먼 이름표를 숨긴다.
    const [a, b] = tags;
    if (a && b && !a.el.hidden && !b.el.hidden && Math.abs(a.x - b.x) < 84 && Math.abs(a.y - b.y) < 34) {
      const farther = a.r.s > b.r.s ? a : b, nearer = farther === a ? b : a;
      (farther.say.hidden || !nearer.say.hidden ? farther : nearer).el.style.opacity = '0';
    }
  }
  /** 결과가 그려질 때: 순위 사진 · 판돈 한 줄 · 자전거 말. 다시 그려져도(보상 확정) 사진 · 목소리는 한 번만. */
  const photo = doc.createElement('img'); photo.className = 'w-res-photo'; photo.alt = ''; doc.querySelector('#results .res-hero')?.prepend(photo);
  const stake = doc.createElement('p'); stake.className = 'w-res-stake'; doc.getElementById('r-title')?.after(stake);
  let resultRound = null, last = 'me';
  function afterResults(s, round) {
    const fresh = round.roundId !== resultRound;
    // 꼴찌는 완주 순간의 자리로 정한다. 보상이 확정돼 다시 그려질 때는 드라이브 중이라 자리가 달라져 있다.
    if (fresh) last = [['me', round.playerS], ...rig.rivals.map((r) => [r.who, r.s])].sort((a, b) => a[1] - b[1])[0][0];
    const r = RESULT_BY_LAST[last];
    if (photo.getAttribute('src') !== r.photo) photo.src = r.photo;
    stake.textContent = `${s.rank}등 · ${r.line}`;
    const title = doc.getElementById('r-title'); if (title && !s.demo) title.textContent = '도착!';
    for (const small of doc.querySelectorAll('#r-stats .pill small')) if (small.textContent === '부스터') small.textContent = '질주';
    if (fresh) { resultRound = round.roundId; if (!s.demo) sayAloud(r.voice, true); }
  }
  return { update, speak, tags, afterLobby, afterResults, loadVoices, resetVoices() { said = 0; waiting = null; rankOrder = ''; }, startLine() { rig.sound?.bell(); speak('taeo', 'start'); }, pumpVoice };
}
