// 환승 러시 움직이는 시안(2026-11-04) — 같은 장면 · 같은 소리를 그림 길 A/B 두 렌더러로 돌린다(설계 8절). ?look=a|b · ?auto=1(녹화용 자동 진행).
// 장면: 입구 → 2호선 안(길 안내 → 차임 → 도착 안내 → 문 열림 → 세 칸) → 시청 환승 통로(달림 → 갈림 입구에서 멈춤 → 세 칸 · 틀림 → 쪽지 · 우회 → 맞음 → 달려 나감).
// 규칙은 설계 v0.2 그대로: 안내가 끝나기 전에는 고를 수 없고, 손짓 없이는 답이 아니며, 시계는 구간 · 오답으로만 간다.
import { createSound } from './소리.mjs';

const query = new URLSearchParams(location.search);
const LOOK = (document.documentElement.dataset.look || query.get('look')) === 'b' ? 'b' : 'a';
const AUTO = query.has('auto');
const BASE = document.documentElement.dataset.base || '/재료/';
const $ = (id) => document.getElementById(id);

// ── 시간 ──
const ease = {
  linear: (k) => k, run: (k) => k < 0.86 ? k * 0.93 / 0.86 : 0.93 + 0.07 * (1 - Math.pow(1 - (k - 0.86) / 0.14, 2)), inOut: (k) => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2, out: (k) => 1 - Math.pow(1 - k, 3),
  door: (k) => k < 0.12 ? 0.25 * k : 0.03 + 0.97 * (1 - Math.pow(1 - (k - 0.12) / 0.88, 2.4)),   // 처음 살짝 머뭇 — 실제 문처럼
};
const tweens = new Set();
function tween(dur, fn, e = ease.inOut) { return new Promise((res) => { const t = { t: 0, dur, fn, e, res }; tweens.add(t); fn(e(0)); }); }
const wait = (s) => tween(s, () => {}, ease.linear);

// ── 시계: 자리마다 굴러 오름 ──
const clock = { h: 8, m: 41 };
function renderClock(first) {
  const el = $('clock'), text = `${clock.h}:${String(clock.m).padStart(2, '0')}`;
  if (first || el.childElementCount !== text.length) {
    el.innerHTML = [...text].map((c) => c === ':' ? '<span class="c">:</span>' : `<span class="d"><span>${'0123456789'.split('').join('<br>')}</span></span>`).join('');
  }
  [...el.children].forEach((d, i) => { if (d.classList.contains('d')) d.firstChild.style.transform = `translateY(${-Number(text[i]) * 27}px)`; });
}
function clockAdd(mins) { clock.m += mins; while (clock.m >= 60) { clock.m -= 60; clock.h++; } renderClock(); for (let i = 0; i < 3; i++) setTimeout(() => sound.sfx.tick(), i * 70); }

// ── 듣기 카드 ──
let voiceLive = false;
const bars = () => [...$('bars').children];
function listenShow(kind, tag) { const l = $('listen'); l.hidden = false; l.dataset.kind = kind; delete l.dataset.done; $('tag').textContent = tag; $('note').hidden = true; l.style.animation = 'none'; void l.offsetWidth; l.style.animation = ''; }
function listenDone() { $('listen').dataset.done = ''; }
async function say(name, kind, tag) { listenShow(kind === 'guide' ? 'guide' : 'pa', tag); voiceLive = true; await sound.speak(name, kind); voiceLive = false; listenDone(); }
function drawBars() { const lv = voiceLive ? sound.voiceLevels() : [0, 0, 0, 0, 0]; bars().forEach((b, i) => { b.style.transform = `scaleY(${1 + lv[i] * 4.6})`; }); }

// ── 세 칸 ──
let chooseResolve = null;
function optionMarkup(o) {
  if (o.line) return `<span class="ln" style="--c:${o.color}">${o.line}</span>${o.text}`;
  if (o.ar) return `<span class="ar">${o.ar}</span>${o.text}`;
  return o.text;
}
function choose(options, autoIndex) {
  const box = $('opts'); box.hidden = false; box.style.animation = 'none'; void box.offsetWidth; box.style.animation = '';
  [...box.children].forEach((b, i) => { b.querySelector('.o-main').innerHTML = optionMarkup(options[i]); delete b.dataset.press; delete b.dataset.dim; });
  return new Promise((resolve) => {
    chooseResolve = (i) => { chooseResolve = null; [...box.children].forEach((b, j) => { if (j === i) b.dataset.press = ''; else b.dataset.dim = ''; }); sound.sfx.swish(i - 1 || 1); setTimeout(() => { box.hidden = true; }, 220); resolve(i); };
    if (AUTO) fingerTo(autoIndex);
  });
}
async function fingerTo(i) {
  await wait(1.0);
  const b = $('opts').children[i], f = $('finger'), r = b.getBoundingClientRect();
  f.hidden = false; f.style.left = r.left + r.width / 2 + 'px'; f.style.top = window.innerHeight + 30 + 'px'; void f.offsetWidth;
  f.style.top = r.top + r.height / 2 + 'px';
  await wait(0.42); f.dataset.down = ''; await wait(0.14); chooseResolve?.(i); delete f.dataset.down; await wait(0.25); f.hidden = true;
}
window.addEventListener('keydown', (e) => { if (!chooseResolve) return; const i = { ArrowLeft: 0, a: 0, ArrowUp: 1, w: 1, ArrowRight: 2, d: 2 }[e.key]; if (i !== undefined) chooseResolve(i); });
$('opts').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && chooseResolve) chooseResolve(Number(b.dataset.i)); });
let touchX = null;
window.addEventListener('pointerdown', (e) => { touchX = e.clientX; });
window.addEventListener('pointerup', (e) => { if (touchX === null || !chooseResolve) return; const dx = e.clientX - touchX; touchX = null; if (Math.abs(dx) > 44) chooseResolve(dx < 0 ? 0 : 2); });

// ── 작은 것들 ──
async function toast(text, seconds) { const t = $('toast'); $('toast-text').textContent = text; delete t.dataset.out; t.hidden = false; await wait(seconds); t.dataset.out = ''; await wait(0.3); t.hidden = true; }
async function chip(text, seconds) { const c = $('chip'); c.textContent = text; c.hidden = false; await wait(seconds); c.hidden = true; }
async function curtain(on) { const c = $('curtain'); if (on) c.dataset.on = ''; else delete c.dataset.on; await wait(0.28); }
let stepping = 0, stepTimer = 0, stepSide = 1;   // 초당 발걸음

// ── 렌더 고리 ──
let look, sound, last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  for (const t of [...tweens]) { t.t += dt; const k = Math.min(1, t.t / t.dur); t.fn(t.e(k)); if (k >= 1) { tweens.delete(t); t.res(); } }
  if (stepping > 0) { stepTimer -= dt; if (stepTimer <= 0) { stepTimer += 1 / stepping; stepSide = -stepSide; sound.sfx.step(stepSide); } }
  sound.railTick(); drawBars();
  look.resize(); look.render(dt);
  requestAnimationFrame(frame);
}

// ── 안내 원고(시안 · 임시 목소리) ──
const LINE1 = '#0052A4';
const SIGNS = [{ line: '1', color: LINE1, text: '서울역 방면' }, { text: '나가는 곳' }, { line: '1', color: LINE1, text: '청량리 방면' }];
const DOORS = [{ ar: '←', text: '왼쪽 문' }, { ar: '·', text: '그대로' }, { ar: '→', text: '오른쪽 문' }];

async function main() {
  sound = createSound();
  const makeLook = LOOK === 'b' ? (await import('./look-b.mjs')).createLookB : (await import('./look-a.mjs')).createLookA;
  look = await makeLook($('gl'), { base: BASE, tween, ease });
  await Promise.all(['guide-start', 'guide-fork', 'pa-cityhall'].map((n) => sound.load(n, BASE + n + '.mp3')));
  await document.fonts.load('800 20px SUIT');
  look.setSigns?.(SIGNS);
  renderClock(true);
  requestAnimationFrame(frame);

  // 입구: 승강장 소리 · 멀리서 열차가 다가온다(오디오 문맥이 깨어 있을 때 — 막히면 「출발」 누른 뒤부터)
  const lobbySound = () => { sound.hallStart(); sound.railStart(); sound.railSpeed(0.12); tween(3.2, (k) => sound.railSpeed(0.12 + 0.5 * k), ease.linear); };
  if (sound.ctx.state === 'running') lobbySound();
  const started = new Promise((res) => { $('go').addEventListener('click', () => res(), { once: true }); });
  if (AUTO) { await wait(3.4); $('go').dataset.press = ''; await wait(0.12); $('go').click(); }
  await started;
  await sound.resume();
  sound.sfx.whoosh();

  // 2호선 안
  await curtain(true);
  $('lobby').hidden = true; $('hud').hidden = false;
  look.enterTrain();
  sound.hallStop(); sound.railStart(); sound.railSpeed(1);
  await curtain(false);
  await wait(0.7);
  await say('guide-start', 'guide', '길 안내');
  await wait(0.9);
  listenShow('pa', '안내방송');
  await sound.chime();
  // 안내가 나오는 동안 열차가 서서히 선다
  const brake = tween(11.4, (k) => { sound.railSpeed(1 - k); look.trainSpeed(1 - k); }, ease.linear);
  await say('pa-cityhall', 'pa-car', '안내방송');
  await brake;
  sound.railStop();
  sound.hallStart();   // 문이 열리면 승강장 소리가 들어온다
  sound.sfx.doorOpen();
  await look.openDoor('right');
  const door = await choose(DOORS, 2);
  $('listen').hidden = true;
  sound.sfx.pass();
  clockAdd(5);
  stepping = 2.4;
  await look.leaveTrain(door === 0 ? 'left' : 'right');
  stepping = 0;

  // 시청 환승 통로
  look.enterFork(SIGNS);
  sound.hallStart();
  stepping = 2.7; stepTimer = 0;
  const running = tween(6.2, (k) => look.runTo(k), ease.run);
  toast('교수님 아직 안 오셨어요! 어디쯤이에요?', 1.5);
  await wait(1.9);
  await say('guide-fork', 'guide', '길 안내');
  await running;
  stepping = 0;
  // 갈림 입구에 멈춤 — 일부러 틀리는 판을 먼저 보인다(자동 재생)
  let pick = await choose(SIGNS, 1);
  if (AUTO || pick !== 2) {
    if (pick !== 2) {
      sound.sfx.ask();
      await look.peek(pick - 1);
      const n = $('note'); n.innerHTML = '<small>이렇게 안내했어요</small>일호선, <strong>청량리</strong> 방면이에요.'; n.hidden = false; $('listen').hidden = false;
      await wait(2.8);
      n.hidden = true; $('listen').hidden = true;
      // 우회 컷: 되돌아가는 발소리 위로 시계가 굴러 오른다(본판은 되돌아오는 계단 · 반대 방향 열차 그림)
      await curtain(true);
      $('detour').hidden = false;
      stepping = 3.2; stepTimer = 0;
      await wait(0.5);
      clockAdd(3); $('detour-clock').textContent = `${clock.h}:${String(clock.m).padStart(2, '0')}`;
      look.atMouth();
      await wait(1.5);
      stepping = 0;
      $('detour').hidden = true;
      await curtain(false);
      chip('다시 가요!', 1.0);
      await wait(0.4);
      pick = await choose(SIGNS, 2);
    }
  }
  sound.sfx.pass(); sound.sfx.streak();
  clockAdd(2);
  stepping = 3.6;
  chip('맞아요 — 빠른 길로!', 1.2);
  await look.dash(pick - 1);
  stepping = 0; sound.hallStop();

  $('end-title').textContent = LOOK === 'a' ? 'A · 실사 깊이 판' : 'B · 사진 결 3D 역';
  $('end-sub').textContent = '시안입니다 — 안내 목소리는 임시 합성, 음악은 아직 없어요.\n입구 · 표지 · 소리 · 흐름은 같고 그림 길만 달라요.';
  $('endcard').hidden = false;
  document.documentElement.dataset.done = '1';
}
main().catch((e) => { console.error(e); document.body.dataset.error = String(e); });
