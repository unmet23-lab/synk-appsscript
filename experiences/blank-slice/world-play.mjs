// 빈칸 베기 — WORLD 캠퍼스 판(2026-11-04, 중간고사 전날 밤 도서관). app.mjs가 <html data-host="world">일 때만 읽는다(LAB은 읽지 않는다).
// 규칙 · 문항 · 판정 · 학습 기록 · 코인은 그대로이고, 낱말 조각의 재질 · 던지기 곡선(world-stage.mjs) · 손맛 소리(world-sfx.mjs) · 화면(world-skin.css)만 바꾼다.
// 여기서 하는 일: 입구 글과 제목 베기 · 배경음(판 안에서만) · 결과 채점 연출(문장마다 빨간 펜 + 맞힘마다 숫자가 오름, 탭하면 바로 끝) · 「우리 동네로」.
// 움직임 값은 주문 폭주 2판의 토큰(world-skin.css 키프레임이 같은 값을 쓴다), 곡은 주문 폭주의 느린 로파이 고리를 함께 쓴다(파일을 두 벌 두지 않는다 — 앱은 두 게임을 나란히 싣는다).
import * as sound from './audio.mjs';
import { createSkin } from './world-stage.mjs';
import { VOICES, KIT_MAP } from './world-sfx.mjs';

export const skin = createSkin();

const COPY = [
  ['#lobby .hero-copy>.kicker', '중간고사 전날 밤 · 중앙도서관 열람실'],
  ['#lobby .hero .lede', '문장을 읽고, 맞는 낱말 카드만 베어요'],
  ['#lobby .hero .sub', '책상에서 낱말 카드 네 장이 튀어 올라요. 맞는 카드를 그으면 찢어지며 낱말이 빈칸에 붙어요. 연달아 맞히면 카드가 빨라져요.'],
  ['#lobby .start-card .tag', '오늘 밤 문제지'],
  ['#btn-start span', '문제지 펴기'],
  ['#how-title', '하는 법'],
  ['#lobby .how-steps li:nth-child(2) strong', '맞는 카드 베기'],
  ['#lobby .how-steps li:nth-child(2) span', '튀어 오르는 카드 네 장 가운데 빈칸에 맞는 것을 그어요.'],
  ['#lobby .how-steps li:nth-child(3) strong', '빈칸에 붙이기'],
  ['#lobby .how-steps li:nth-child(3) span', '맞으면 낱말이 빈칸에 붙고, 틀리면 정답과 이유가 나와요.'],
  ['#r-kicker', '채점 끝 · 빈칸 베기'],
  ['#quit', '게임 처음으로'],
  ['#r-home', '게임 처음으로'],
];

/** LAB 글의 「조각」은 여기서 「카드」다. 입력 기기 이름은 말하지 않는다(펜슬 · 태블릿도 쓴다). */
const WORDS = [[/손가락이나 마우스로 /g, ''], [/조각이/g, '카드가'], [/조각은/g, '카드는'], [/조각을/g, '카드를'], [/조각/g, '카드']];
export const say = (text) => WORDS.reduce((s, [from, to]) => s.replace(from, to), String(text));

/** 움직임 줄이기: 기기 설정과 WORLD 앱 설정(부모 창 :root[data-motion=reduced]) 둘 다 본다. 무대 · 날아가는 낱말 · 채점이 함께 따른다. */
export const reduced = () => {
  try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return true; } catch { /* 없는 환경 */ }
  try { return window.parent?.document?.documentElement?.dataset?.motion === 'reduced'; } catch { return false; }
};
/** 앱 설정을 게임 문서에도 적는다 — CSS 연출(제목 베기 · 빨간 펜 튐)이 따른다. 설정은 앱 쪽에서 바뀌므로 화면을 바꿀 때마다 다시 읽는다. */
function syncMotion() {
  let outer = false;
  try { outer = window.parent?.document?.documentElement?.dataset?.motion === 'reduced'; } catch { /* 다른 출처 */ }
  const root = document.documentElement;
  if (outer) root.dataset.motion = 'reduced'; else delete root.dataset.motion;
}

/** WORLD 앱 설정 「효과음」 · 「진동」(world-sound.mjs PREF_KEYS와 같은 열쇠, 기본 켜짐). */
export const pref = (name) => { try { return localStorage.getItem(`synk.world.${name}`) !== 'false'; } catch { return true; } };

/** 입구 · 결과를 앱 겉으로 맞춘다. 게임 흐름 전에 한 번. */
export function setup({ onRoom }) {
  sound.useVoices(VOICES, KIT_MAP, () => pref('sound'));
  for (const [sel, text] of COPY) { const n = document.querySelector(sel); if (n) n.textContent = text; }
  for (const sel of ['#lobby .how-steps + .fine', '#check-note', '#pause-dialog p']) { const n = document.querySelector(sel); if (n) n.textContent = say(n.textContent); }
  for (const n of document.querySelectorAll('.hero-mongle,#r-mongle,.hero-pieces,.slash')) n.remove();   // 몽글 · 펠트 그림은 앱에 두지 않는다
  // 제목: 본 글자 + 대각선으로 나뉜 두 벌(읽기 프로그램에는 본 글자만) + 칼빛 + 종이 조각. 박자는 CSS(합성기)
  const h1 = document.querySelector('#lobby .hero h1');
  if (h1) {
    const word = h1.textContent;
    h1.innerHTML = '<span class="w-title"></span><span class="w-cut a" aria-hidden="true"></span><span class="w-cut b" aria-hidden="true"></span><i class="w-blade" aria-hidden="true"></i>'
      + '<i class="w-shred" aria-hidden="true"></i>'.repeat(4);
    for (const n of h1.querySelectorAll('.w-title,.w-cut')) n.textContent = word;
    h1.setAttribute('aria-label', word);
  }
  const bar = document.createElement('div'); bar.className = 'w-room-bar';
  bar.innerHTML = '<button id="w-room" class="felt-cta" type="button"><span>우리 동네로</span><i class="disc" aria-hidden="true"></i></button>';
  bar.firstChild.addEventListener('click', onRoom);
  document.querySelector('#results').append(bar);
  syncMotion();
  document.documentElement.classList.add('w-ready');
  // 탭을 숨기면 소리를 통째로 멈춘다(게임은 쉬기로 멈추지만 음악이 뒤에서 계속 나면 안 된다). 돌아오면 쉬기 창 아래에서 다시 낮게 난다
  document.addEventListener('visibilitychange', () => { const r = sound.route(); if (!r) return; if (document.hidden) r.ctx.suspend?.().catch?.(() => {}); else r.ctx.resume?.().catch?.(() => {}); });
  // 첫 탭에 오디오 문맥을 열고 곡을 풀면 그 탭이 멈춘다(주문 폭주 11-03 추적 0.2~1초) → 입구에서 무대를 데운 뒤 미리 만들어 둔다
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1200));
  setTimeout(() => idle(() => { sound.unlock(); ensureMusic().then((m) => m?.preload('calm')); }, { timeout: 3000 }), 1500);
}

/* ── 배경음: 판 안에서만. 음악이 없거나 못 받아도 게임은 그대로다 ── */
let music = null, musicLoading = null, musicWanted = false, musicPaused = false;
function ensureMusic() {
  const route = sound.route();
  if (!route) return Promise.resolve(null);
  musicLoading ??= import('../order-rush/world-music.mjs')
    .then(({ createMusic }) => { music = createMusic(route.ctx, { base: '../order-rush/', destination: route.out, storage: window.localStorage }); return music; })
    .catch(() => null);
  return musicLoading;
}
// 곡을 받는 사이에 판을 나가면 나간 뒤에 음악이 시작되지 않게 원하는지를 먼저 본다
export async function roundStart() {
  syncMotion(); musicWanted = true;
  await sound.unlock();
  const m = await ensureMusic();
  if (!musicWanted) return;
  m?.play('calm');
  if (musicPaused) m?.pause(true);   // 곡을 받는 사이에 멈췄으면 낮은 채로 시작한다
}
export function roundEnd(fade = 1.2) { musicWanted = false; music?.stop(fade); }
export function roundPaused(on) { musicPaused = !!on; music?.pause(on); }

/* ── 결과 채점: 문장마다 빨간 펜이 찍히고 맞힘마다 큰 숫자가 하나씩 오른다. 첫 탭이나 움직임 줄이기면 바로 끝난다 ── */
let cancelMarks = null, starTimers = [];
const clearStars = () => { starTimers.forEach(clearTimeout); starTimers = []; };
export function results({ correct, stars, rows = [] }) {
  cancelMarks?.(); clearStars();
  syncMotion();
  const items = [...document.querySelectorAll('#r-log li')], big = document.querySelector('#r-correct'), wrap = big?.closest('.big');
  wrap?.classList.remove('w-done');
  let rung = 0, timer = 0, done = false;
  const starSound = () => { starTimers = Array.from({ length: stars }, (_, i) => setTimeout(() => sound.sfx('star', { i }), i * 180)); };
  const finish = () => {
    if (done) return; done = true;
    clearTimeout(timer); document.removeEventListener('pointerdown', finish, true);
    for (const li of items) { li.classList.remove('w-wait'); li.classList.add('w-pen'); }
    if (big) big.textContent = String(correct);
    wrap?.classList.add('w-done');
    starSound();
    cancelMarks = null;
  };
  if (reduced() || !items.length || !big) { finish(); return; }
  big.textContent = '0';
  for (const li of items) li.classList.add('w-wait');
  document.addEventListener('pointerdown', finish, true);
  let i = 0;
  const step = () => {
    if (done) return;
    if (i >= items.length) { finish(); return; }
    const li = items[i++];
    li.classList.remove('w-wait'); li.classList.add('w-pen');
    const ok = rows[i - 1]?.correct === true;   // 큰 숫자는 scoreRound · ○ 표시와 같은 잣대 — 놓친 문장(△)은 멈춘 보기에서 맞혔어도 세지 않는다
    if (ok) { rung += 1; big.textContent = String(rung); }
    sound.sfx('mark', { ok, step: rung });
    timer = setTimeout(step, 150);
  };
  timer = setTimeout(step, 420);   // 시험지가 뜨고 「성취」 소리가 시작된 뒤
  cancelMarks = () => { done = true; clearTimeout(timer); document.removeEventListener('pointerdown', finish, true); cancelMarks = null; };
}
/** 결과를 떠날 때(다른 화면으로 바꿀 때마다 불린다): 채점 · 별 소리를 멈추고 앱의 움직임 줄이기 설정을 다시 읽는다. */
export const stopResults = () => { cancelMarks?.(); clearStars(); syncMotion(); };
