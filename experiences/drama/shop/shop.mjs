// 캠퍼스 옷 가게 시안 (2026-11-05) — 팁 장부 44 · 45행, 끌어넘기기 구현 준비 3절.
// 끌기 · 붙기 · 키보드는 공용 부품 DragRail(../../play-common/drag-rail.js)이 맡고, 여기서는 그 위에 얹는 것만 한다:
//   봉 처짐 스프링, 옷걸이 흔들림(고리를 축으로 한 진자 — 고리가 움직이는 가속도를 받는다), 마우스 올림, 자세히 · 앞뒤 돌림, 택배 상자, 소리.
// 판: ?판=a 흰 스튜디오 봉(곧은 봉) · ?판=b 색을 따라오는 처진 봉. 모의 자료만.
import { ITEMS, MOCK_STATE, MOCK_NOTE, art } from './shop-items.mjs';
import { createSound } from './shop-sound.mjs';

const R = window.DragRail;
const $ = (s, r = document) => r.querySelector(s);
const params = new URLSearchParams(location.search);
const shop = $('.shop'), floor = $('.shop-floor'), rail = $('.shop-rail'), rod = $('.shop-rod');
const stage = $('.shop-stage'), turnWrap = $('.shop-turn-wrap'), turn = $('.shop-turn');
const faceF = $('.shop-face.is-front'), faceB = $('.shop-face.is-back');
const look = params.get('판') === 'b' ? 'tint' : 'studio';
shop.dataset.look = look;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || params.get('motion') === 'off';
const sound = createSound();
const state = { ...MOCK_STATE };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;

// ── 옷걸이 만들기 ───────────────────────────────────────────────
const pad2 = (n) => String(n).padStart(2, '0');
const TAG = { shipping: '배송 중', arrived: '도착' };
const WORN = { 'outfit-cardigan': '../../../.tmp/me2-20261102/옷상점/입혀보기/판/wear-u1-cardigan_141506.png' }; // 시안 전용(git 밖 대역)
const tagHtml = (id) => {
  if (!state[id]) return '';
  if (state[id] === 'arrived' && WORN[id]) return `<span class="tag-print" aria-hidden="true"><img src="${WORN[id]}" alt="" draggable="false"></span>`;
  return `<span class="tag" data-state="${state[id]}"><b>No.${pad2(ITEMS.findIndex((x) => x.id === id) + 1)}</b><span><i></i>${TAG[state[id]]}</span></span>`;
};
rail.innerHTML = ITEMS.map((it, i) => `<li class="slot" data-i="${i}"><button type="button" class="hanger" data-i="${i}" aria-label="${it.name}${state[it.id] ? ' — ' + TAG[state[it.id]] : ''}"><span class="swing"><img src="${art(it.id, 'front')}" alt="" draggable="false" decoding="async">${tagHtml(it.id)}</span></button></li>`).join('');
$('.shop-dots').innerHTML = ITEMS.map(() => '<i></i>').join('');
const slots = [...rail.querySelectorAll('.slot')];
const hangers = slots.map((li) => li.querySelector('.hanger'));
const swings = slots.map((li) => li.querySelector('.swing'));
const dots = [...document.querySelectorAll('.shop-dots i')];
const capN = $('.shop-caption-n'), capName = $('.shop-caption-name'), capNote = $('.shop-caption-note'), hint = $('.shop-hint');

// 진자 — 옷마다 조금씩 다른 무게(같이 흔들리면 기계처럼 보인다)
const P = ITEMS.map((_, i) => ({ th: 0, om: 0, k: 44 + ((i * 37) % 11), x: null, vx: 0, ax: 0, s: 1, push: 0, y: 0, drop: 0, dropV: 0, alpha: 1 }));

// ── 자리 계산 ───────────────────────────────────────────────────
let fit = false, slotW = 0, artH = 0, railW = 0, rodY = 0;
let S = 0, Sv = 0, Starget = 0; // 봉 처짐(px)과 속도
let active = 0, hover = -1, pos = 0, lastPos = 0;
function measure() {
  const cs = getComputedStyle(slots[0]);
  slotW = parseFloat(cs.width); artH = parseFloat(cs.height); railW = rail.clientWidth;
  const canFit = matchMedia('(hover: hover) and (pointer: fine)').matches && slotW * ITEMS.length + slotW * 1.4 <= railW;
  if (canFit !== fit) { fit = canFit; rail.classList.toggle('is-fit', fit); if (fit) rail.scrollLeft = 0; }
  rodY = rail.offsetTop + 22 + artH * 0.025 + Math.max(2, artH * 0.006);
  Starget = 0; // 봉은 멈추면 곧다 — 처짐은 옷이 떨어져 걸릴 때만(금속 봉이 휜 채 멈추면 빨랫줄로 읽힌다, Fable 11-05)
  rod.setAttribute('viewBox', `0 0 ${floor.clientWidth} ${floor.clientHeight}`);
}
function centerX(i) {
  if (fit) return (railW - slotW * ITEMS.length) / 2 + slotW * (i + 0.5);
  return railW / 2 + (i - pos) * slotW;
}
function span() {
  if (!fit) return [0, railW];
  const a = Math.max(20, centerX(0) - slotW * 2.3), b = Math.min(railW - 20, centerX(ITEMS.length - 1) + slotW * 2.3);
  return [a, b];
}
function sagAt(x) { const [a, b] = span(); return R.sagAt(x, a, b, S); }
function drawRod() {
  const [a, b] = span();
  let d = '';
  for (let x = a; x <= b + 0.5; x += 16) d += (d ? 'L' : 'M') + x.toFixed(1) + ' ' + (rodY + sagAt(x)).toFixed(2);
  d += `L${b.toFixed(1)} ${(rodY + sagAt(b)).toFixed(2)}`;
  rod.querySelector('.shop-rod-bar').setAttribute('d', d);
  rod.querySelector('.shop-rod-shadow').setAttribute('d', d);
  rod.querySelector('.shop-rod-shine').setAttribute('d', d);
  rod.querySelector('.shop-rod-body').setAttribute('d', d);
  rod.querySelectorAll('.shop-rod-plate').forEach((r, j) => { r.style.display = fit ? '' : 'none'; r.setAttribute('x', (j ? b : a) - 5); r.setAttribute('y', rodY + sagAt(j ? b : a) - 13); });
  const caps = rod.querySelectorAll('.shop-rod-cap');
  caps.forEach((c, j) => { c.style.display = fit ? '' : 'none'; c.setAttribute('cx', j ? b : a); c.setAttribute('cy', rodY + sagAt(j ? b : a)); });
}

// ── 프레임 ──────────────────────────────────────────────────────
let raf = 0, lastT = 0, quietSince = 0, lastCenter = -1, tintNow = null;
function wake() { quietSince = performance.now(); if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(frame); } }
function frame(now) {
  raf = 0;
  const dt = clamp((now - lastT) / 1000, 0.001, 0.05); lastT = now;
  pos = fit ? 0 : R.positionOf(rail.scrollLeft, slotW);
  const posV = (pos - lastPos) / dt; lastPos = pos;
  // 봉 — 처짐 스프링
  const Sa = -140 * (S - Starget) - 9 * Sv;
  Sv += Sa * dt; S += Sv * dt;
  const center = fit ? (hover >= 0 ? hover : -1) : R.nearestIndex(pos, ITEMS.length);
  if (!fit && center !== lastCenter && lastCenter !== -1) sound.tick(Math.min(1, Math.abs(posV) / 6));
  if (center !== lastCenter) { lastCenter = center; if (center >= 0) setActive(center); }
  if (!fit) sound.slide(Math.min(1, Math.abs(posV) / 9));
  let moving = Math.abs(Sv) > 0.3 || Math.abs(S - Starget) > 0.3 || Math.abs(posV) > 0.02;
  const ease = 1 - Math.exp(-dt * 13);
  for (let i = 0; i < ITEMS.length; i++) {
    const p = P[i];
    // 마우스 올림 · 가운데 강조
    let sT = 1, pushT = 0;
    if (fit) {
      if (hover >= 0) { const d = i - hover; sT = d === 0 ? 1.17 : 1; pushT = d === 0 ? 0 : Math.sign(d) * slotW * [0, 0.24, 0.1, 0.04][Math.min(3, Math.abs(d))]; }
    } else {
      sT = 1 - 0.08 * Math.min(Math.abs(i - pos), 1);
    }
    p.s = lerp(p.s, sT, ease); p.push = lerp(p.push, pushT, ease);
    const x = centerX(i) + p.push;
    if (p.x === null) p.x = x;
    const vx = (x - p.x) / dt; p.ax = lerp(p.ax, (vx - p.vx) / dt, 0.35); p.vx = vx; p.x = x;
    // 진자: 고리가 가속하면 옷은 반대로 처진다
    if (!reduce) { const n = R.swingStep(p, p.ax, dt, { k: p.k, len: artH * 0.42 }); p.th = n.th; p.om = n.om; }
    // 들어오기 — 위에서 떨어져 봉에 걸림
    if (p.drop !== 0 || p.dropV !== 0) {
      p.dropV += (-260 * p.drop - 20 * p.dropV) * dt; p.drop += p.dropV * dt;
      if (Math.abs(p.drop) < 0.2 && Math.abs(p.dropV) < 2) { p.drop = 0; p.dropV = 0; }
    }
    const y = sagAt(x) + p.drop;
    hangers[i].style.transform = `translate3d(${(x - centerX(i) + (fit ? 0 : 0)).toFixed(2)}px,${y.toFixed(2)}px,0) scale(${p.s.toFixed(4)})`;
    hangers[i].style.zIndex = fit ? (i === hover ? 20 : 10 - Math.abs(i - (hover >= 0 ? hover : 3.5)) | 0) : 20 - Math.round(Math.abs(i - pos) * 2);
    swings[i].style.transform = `rotate(${(p.th * 57.2958).toFixed(3)}deg)`;
    const far = !fit && Math.abs(i - pos) > 1.15; // 휴대폰에서 화면 끝에 잘리는 꼬리표는 숨긴다
    if (far !== p.far) { p.far = far; hangers[i].classList.toggle('is-far', far); }
    if (Math.abs(p.om) > 0.004 || Math.abs(p.th) > 0.002 || Math.abs(p.s - sT) > 0.001 || Math.abs(p.push - pushT) > 0.3 || p.drop) moving = true;
  }
  if (look === 'tint') paintTint(fit ? (hover >= 0 ? hover : active) : pos, ease);
  drawRod();
  if (moving || now - quietSince < 300) raf = requestAnimationFrame(frame);
  else sound.slide(0);
}
function setActive(i) {
  active = i;
  capN.textContent = `${pad2(i + 1)} / ${pad2(ITEMS.length)}` + (state[ITEMS[i].id] ? ` · ${TAG[state[ITEMS[i].id]]}` : '');
  capName.textContent = ITEMS[i].name;
  capNote.textContent = ITEMS[i].note;
  dots.forEach((d, j) => d.classList.toggle('on', j === i));
}
// 색을 따라오는 바탕(B판)
const hex = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
const tints = ITEMS.map((it) => it.tint.map(hex));
function paintTint(at, ease) {
  const i0 = clamp(Math.floor(at), 0, ITEMS.length - 1), i1 = clamp(i0 + 1, 0, ITEMS.length - 1), f = clamp(at - i0, 0, 1);
  // 옷 색을 아주 옅게만(채도 0.06 안팎 — 레퍼런스 평균 0.00~0.06): 바탕 회백 쪽으로 70% 섞는다
  const base = [[247, 246, 242], [241, 239, 233]];
  const want = [0, 1].map((k) => tints[i0][k].map((c, j) => lerp(lerp(c, tints[i1][k][j], f), base[k][j], 0.7)));
  tintNow = tintNow ? tintNow.map((row, k) => row.map((c, j) => lerp(c, want[k][j], fit ? ease * 0.6 : 1))) : want;
  shop.style.setProperty('--tint-top', `rgb(${tintNow[0].map(Math.round)})`);
  shop.style.setProperty('--tint-bottom', `rgb(${tintNow[1].map(Math.round)})`);
}

// ── 손 ─────────────────────────────────────────────────────────
const dr = R.attach(rail, { item: '.slot', onFrame: wake, onSettle: () => wake() });
rail.addEventListener('scroll', () => { wake(); firstTouch(); }, { passive: true });
function firstTouch() { if (!hint.classList.contains('is-gone')) setTimeout(() => hint.classList.add('is-gone'), 900); sound.unlock(); }
rail.addEventListener('pointerover', (e) => {
  const h = e.target.closest('.hanger'); if (!h || !fit || e.pointerType !== 'mouse') return;
  const i = +h.dataset.i; if (i === hover) return;
  hover = i; sound.brush(); wake();
});
rail.addEventListener('pointerleave', () => { if (hover >= 0) { hover = -1; wake(); } });
rail.addEventListener('focusin', (e) => { const h = e.target.closest('.hanger'); if (h && fit) { hover = +h.dataset.i; wake(); } });
rail.addEventListener('keydown', (e) => {
  if (!fit) return;
  const to = e.key === 'ArrowRight' ? active + 1 : e.key === 'ArrowLeft' ? active - 1 : null;
  if (to === null) return;
  e.preventDefault(); hangers[clamp(to, 0, ITEMS.length - 1)].focus();
});
rail.addEventListener('click', (e) => {
  const h = e.target.closest('.hanger'); if (!h) return;
  firstTouch(); open(+h.dataset.i);
});
document.addEventListener('pointerdown', () => sound.unlock(), { once: true });
$('.shop-more').addEventListener('click', () => { firstTouch(); open(active); });

// ── 자세히 ─────────────────────────────────────────────────────
let openI = -1, side = 'front', th = 0, thV = 0, thTarget = 0, sw = 0, swV = 0, turnRaf = 0, turning = null, busy = false;
const sideGroup = $('.shop-side');
const SIDES = { front: '앞', back: '뒤', worn: '입은 나' };
const printImg = $('.shop-print img'), printNote = $('.shop-print figcaption');
function fillInfo(i) {
  const it = ITEMS[i], st = state[it.id];
  $('.shop-num').textContent = `${pad2(i + 1)} / ${pad2(ITEMS.length)}`;
  $('.shop-name').textContent = it.name;
  $('.shop-note').textContent = it.note;
  // 도착한 옷은 「입은 나」로 내 사진을 본다 — 이 가게만의 한 수(레퍼런스 25곳 어디에도 없음)
  const worn = st === 'arrived' ? WORN[it.id] : null;
  const sides = worn ? ['front', 'back', 'worn'] : ['front', 'back'];
  sideGroup.innerHTML = sides.map((k) => `<button type="button" role="radio" data-side="${k}" aria-checked="false">${SIDES[k]}</button>`).join('') + '<i class="shop-side-knob" aria-hidden="true"></i>';
  sideGroup.style.setProperty('--n', sides.length);
  if (worn) printImg.src = worn; else printImg.removeAttribute('src');
  const act = $('.shop-actions');
  if (st === 'shipping') {
    act.innerHTML = '<button type="button" class="shop-go" disabled><i class="dot"></i>배송 중</button>';
    $('.shop-help').textContent = '내 사진에 입혀서 보내는 중이에요. 늦어도 내일까지 도착해요.';
  } else if (st === 'arrived') {
    act.innerHTML = '<button type="button" class="shop-go" data-act="wear">이 옷으로 갈아입기</button>';
    $('.shop-help').textContent = MOCK_NOTE[it.id] ? `${MOCK_NOTE[it.id].split(', ')[0]}에 도착했어요.` : '입은 사진이 도착했어요.';
  } else {
    act.innerHTML = '<button type="button" class="shop-go" data-act="order">입어 보기</button>';
    $('.shop-help').textContent = '내 사진에 입혀서 보내 드려요. 보통 몇 시간 안에, 늦어도 내일까지 도착해요.';
  }
  printNote.textContent = MOCK_NOTE[it.id] || '';
  for (const el of $('.shop-info').children) { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; }
}
function markSide(s) {
  const btns = [...sideGroup.querySelectorAll('button')];
  btns.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.side === s)));
  sideGroup.style.setProperty('--at', Math.max(0, btns.findIndex((b) => b.dataset.side === s)));
  sideGroup.dataset.on = s;
}
function setFaces(i) {
  faceF.src = art(ITEMS[i].id, 'front');
  faceB.src = art(ITEMS[i].id, 'back');
}
function open(i) {
  if (busy) return;
  openI = i; side = 'front'; th = 0; thTarget = 0; thV = 0;
  setFaces(i); fillInfo(i); setSide('front', true);
  stage.hidden = false; shop.dataset.mode = 'detail';
  ghost(i);
  sound.pick();
  const from = swings[i].querySelector('img').getBoundingClientRect(), to = turnWrap.getBoundingClientRect();
  hangers[i].style.visibility = 'hidden';
  sw = P[i].th; swV = P[i].om + (Math.random() < 0.5 ? -0.5 : 0.5);
  if (!reduce) {
    const dx = from.left + from.width / 2 - (to.left + to.width / 2), dy = from.top - to.top, sc = from.width / to.width;
    // 큰 판을 먼저 풀어 둔 뒤 움직인다 — 풀기 전에 움직이면 첫 몇 장을 GPU가 그리느라 버린다(11-05 추적)
    const fly = turnWrap.animate([{ transform: `translate(${dx}px,${dy}px) scale(${sc})` }, { transform: 'none' }], { duration: 640, easing: 'cubic-bezier(.2,.75,.2,1)' });
    fly.pause();
    Promise.race([faceF.decode().catch(() => {}), new Promise((r) => setTimeout(r, 90))]).then(() => fly.play());
  }
  runTurn();
  $('.shop-close').focus({ preventScroll: true });
}
function ghost(i) { slots.forEach((li, j) => li.classList.toggle('is-ghost', Math.abs(j - i) > 1)); }
function close() {
  if (openI < 0 || busy) return;
  const i = openI;
  const back = () => { stage.hidden = true; hangers[i].style.visibility = ''; openI = -1; P[i].om += 0.35; wake(); hangers[i].focus({ preventScroll: true }); };
  shop.dataset.mode = '';
  turnWrap.dataset.view = 'garment';
  sound.drop();
  if (reduce) return back();
  const from = turnWrap.getBoundingClientRect(), to = swings[i].querySelector('img').getBoundingClientRect();
  const dx = to.left + to.width / 2 - (from.left + from.width / 2), dy = to.top - from.top, sc = to.width / from.width;
  // 뒤를 보고 있었으면 돌아가며 앞으로
  thTarget = Math.round(th / 360) * 360;
  turnWrap.animate([{ transform: 'none' }, { transform: `translate(${dx}px,${dy}px) scale(${sc})` }], { duration: 480, easing: 'cubic-bezier(.4,0,.2,1)' }).finished.then(back);
}
function step(d) {
  if (openI < 0 || busy) return;
  const n = clamp(openI + d, 0, ITEMS.length - 1);
  if (n === openI) { swV += d * 0.9; sound.bump(); runTurn(); return; }
  const old = openI;
  hangers[old].style.visibility = '';
  openI = n; hangers[n].style.visibility = 'hidden';
  if (!fit) dr.go(n, false); else { hover = n; }
  setActive(n); wake(); ghost(n);
  sound.tick(0.6);
  const out = turnWrap.animate([{ transform: 'none', opacity: 1 }, { transform: `translateX(${-d * 36}%)`, opacity: 0 }], { duration: reduce ? 1 : 200, easing: 'cubic-bezier(.55,0,.75,.2)' });
  out.finished.then(() => {
    th = 0; thTarget = 0; thV = 0; setFaces(n); fillInfo(n); setSide('front', true);
    sw = 0; swV = -d * 0.8;
    turnWrap.animate([{ transform: `translateX(${d * 36}%)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: reduce ? 1 : 420, easing: 'cubic-bezier(.2,.75,.2,1)' });
    runTurn();
  });
}
function setSide(s, quiet) {
  const wasWorn = turnWrap.dataset.view === 'worn';
  side = s; markSide(s);
  turnWrap.dataset.view = s === 'worn' ? 'worn' : 'garment';
  if (s === 'worn') { if (!quiet) sound.print(); return; }
  if (!quiet) { thTarget = (s === 'back' ? 180 : 0) + Math.round((th - (s === 'back' ? 180 : 0)) / 360) * 360; if (!wasWorn || s === 'back') sound.turn(); runTurn(); }
}
function runTurn() { if (!turnRaf) { let t0 = performance.now(); const go = (now) => { const dt = clamp((now - t0) / 1000, 0.001, 0.05); t0 = now; turnRaf = 0; if (turnStep(dt)) turnRaf = requestAnimationFrame(go); }; turnRaf = requestAnimationFrame(go); } }
function turnStep(dt) {
  if (!turning) {
    if (reduce) { th = thTarget; thV = 0; }
    else { const a = -95 * (th - thTarget) - 15 * thV; thV += a * dt; th += thV * dt; }
  }
  if (!reduce) { const a = -40 * Math.sin(sw) - 2.6 * swV; swV += a * dt; sw = clamp(sw + swV * dt, -0.2, 0.2); }
  const r = ((th % 360) + 360) % 360;
  const edge = Math.abs(Math.sin(r * Math.PI / 180));
  turn.style.transform = `rotateZ(${(sw * 57.3).toFixed(3)}deg) rotateY(${th.toFixed(2)}deg)`;
  const shade = `brightness(${(1 - 0.24 * edge).toFixed(3)})`;
  faceF.style.filter = faceB.style.filter = edge > 0.01 ? `${shade} drop-shadow(0 22px 26px rgba(40,32,22,.18))` : '';
  const nowSide = r > 90 && r < 270 ? 'back' : 'front';
  if (turning && nowSide !== side) { side = nowSide; markSide(side); }
  return turning || Math.abs(th - thTarget) > 0.05 || Math.abs(thV) > 0.05 || Math.abs(sw) > 0.001 || Math.abs(swV) > 0.003;
}
// 옷을 끌어 돌리기 — 놓으면 가까운 쪽(앞 · 뒤)으로
turnWrap.addEventListener('pointerdown', (e) => {
  if (busy || turnWrap.dataset.view === 'worn' || (e.pointerType === 'mouse' && e.button !== 0)) return;
  turning = { x: e.clientX, y: e.clientY, th, lastX: e.clientX, lastT: performance.now(), v: 0, on: false, id: e.pointerId };
});
turnWrap.addEventListener('pointermove', (e) => {
  if (!turning || e.pointerId !== turning.id) return;
  const dx = e.clientX - turning.x;
  if (!turning.on) {
    const way = R.dragIntent(dx, e.clientY - turning.y, 6);
    if (way === 'y') { turning = null; return; }
    if (way !== 'x') return;
    turning.on = true; turnWrap.classList.add('is-turning'); turnWrap.setPointerCapture(e.pointerId); sound.turn();
  }
  th = turning.th + dx * 0.55;
  const now = performance.now(), dtt = now - turning.lastT;
  if (dtt > 0) { turning.v = lerp(turning.v, (e.clientX - turning.lastX) * 0.55 / (dtt / 1000), 0.4); turning.lastX = e.clientX; turning.lastT = now; }
  runTurn();
});
const endTurn = (e) => {
  if (!turning || e.pointerId !== turning.id) return;
  const was = turning; turning = null; turnWrap.classList.remove('is-turning');
  if (!was.on) return;
  thV = was.v * 0.6;
  thTarget = Math.round((th + clamp(was.v * 0.12, -150, 150)) / 180) * 180;
  const r = ((thTarget % 360) + 360) % 360;
  setSide(r === 180 ? 'back' : 'front', true);
  runTurn();
};
turnWrap.addEventListener('pointerup', endTurn);
turnWrap.addEventListener('pointercancel', endTurn);

// ── 입어 보기 → 택배 상자 ───────────────────────────────────────
const parcel = $('.shop-parcel'), pOpen = $('.shop-parcel-open'), pClosed = $('.shop-parcel-closed');
const boxBtn = $('.shop-box'), boxCount = $('.shop-box-count');
const toast = $('.shop-toast');
let toastTimer = 0;
function say(text) { toast.textContent = text; toast.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.hidden = true; }, 3200); }
function countShipping() { const n = Object.values(state).filter((s) => s === 'shipping' || s === 'arrived').length; boxCount.dataset.count = n; boxCount.textContent = n; }
countShipping();
async function order() {
  if (busy || openI < 0) return;
  busy = true;
  const i = openI, id = ITEMS[i].id;
  sound.pick();
  if (!reduce) {
    thTarget = Math.round(th / 360) * 360; runTurn();
    parcel.hidden = false; pOpen.style.opacity = 1; pClosed.style.opacity = 0;
    const tw = turnWrap.getBoundingClientRect(), pr = parcel.getBoundingClientRect();
    const boxIn = parcel.animate([{ transform: 'translateY(40%) scale(.9)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.2,.75,.2,1)', fill: 'both' });
    await boxIn.finished;
    const dy = pr.top + pr.height * 0.3 - (tw.top + tw.height * 0.1);
    const fold = turnWrap.animate([
      { transform: 'none', opacity: 1 },
      { transform: `translateY(${dy * 0.55}px) scale(.55)`, opacity: 1, offset: 0.6 },
      { transform: `translateY(${dy}px) scale(.3)`, opacity: 0 },
    ], { duration: 620, easing: 'cubic-bezier(.55,0,.6,1)', fill: 'both' });
    await fold.finished;
    sound.thump();
    pClosed.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, fill: 'forwards' });
    pOpen.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, delay: 60, fill: 'forwards' });
    await parcel.animate([{ transform: 'none' }, { transform: 'scale(1.04,.96)' }, { transform: 'none' }], { duration: 260 }).finished;
    sound.tape();
    await new Promise((r) => setTimeout(r, 320));
    shop.dataset.flying = 'yes'; // 상자가 날아갈 곳(내 옷장)을 다시 보인다
    const bb = boxBtn.getBoundingClientRect(), now = parcel.getBoundingClientRect();
    const fx = bb.left + bb.width * 0.2 - (now.left + now.width / 2), fy = bb.top + bb.height / 2 - (now.top + now.height / 2);
    await parcel.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${fx}px,${fy}px) scale(.08)`, opacity: 0.9 }], { duration: 560, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'both' }).finished;
    parcel.hidden = true; parcel.getAnimations().forEach((a) => a.cancel()); pOpen.getAnimations().forEach((a) => a.cancel()); pClosed.getAnimations().forEach((a) => a.cancel());
    turnWrap.getAnimations().forEach((a) => a.cancel());
  }
  delete shop.dataset.flying;
  state[id] = 'shipping'; countShipping();
  boxBtn.classList.remove('is-bump'); void boxBtn.offsetWidth; boxBtn.classList.add('is-bump');
  sound.drop();
  swings[i].insertAdjacentHTML('beforeend', tagHtml(id));
  hangers[i].setAttribute('aria-label', `${ITEMS[i].name} — 배송 중`);
  stage.hidden = true; shop.dataset.mode = ''; hangers[i].style.visibility = ''; openI = -1; busy = false;
  P[i].drop = -artH * 0.12; P[i].dropV = 0; P[i].om += 0.5; setActive(i); wake();
  say('배송 중이에요 — 늦어도 내일까지 도착해요');
}

stage.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act],[data-side]'); if (!b) return;
  if (b.dataset.side) { if (b.dataset.side !== side) setSide(b.dataset.side); return; }
  const act = b.dataset.act;
  if (act === 'close') close();
  else if (act === 'prev') step(-1);
  else if (act === 'next') step(1);
  else if (act === 'order') order();
  else if (act === 'wear') { sound.pick(); say('이 옷으로 갈아입었어요'); }
});
boxBtn.addEventListener('click', () => { sound.brush(); say('내 옷장은 제2의 나에서 열려요'); });
document.addEventListener('keydown', (e) => {
  if (openI < 0) return;
  if (e.key === 'Escape') { e.preventDefault(); close(); }
  else if (e.key === 'ArrowRight' && !e.target.closest('.shop-side')) step(1);
  else if (e.key === 'ArrowLeft' && !e.target.closest('.shop-side')) step(-1);
});

// ── 시작 ───────────────────────────────────────────────────────
function relayout() { measure(); for (const p of P) p.x = null; wake(); }
addEventListener('resize', relayout);
measure();
const startAt = Math.min(3, ITEMS.length - 1);
if (!fit) { rail.scrollLeft = startAt * slotW; pos = startAt; lastPos = pos; }
setActive(fit ? 0 : startAt);
lastCenter = fit ? -1 : startAt;
if (look === 'tint') paintTint(fit ? 0 : startAt, 1);
const entry = () => {
  shop.dataset.ready = 'yes';
  if (reduce) { S = Starget; drawRod(); wake(); return; }
  // 옷이 하나씩 떨어져 걸리고, 걸릴 때마다 봉이 처졌다 펴진다
  P.forEach((p, i) => {
    p.drop = -artH * 0.18; p.dropV = 0;
    slots[i].animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, delay: 80 + i * 70, fill: 'backwards' });
    setTimeout(() => { p.dropV = 60; Sv += 70; p.om += (i % 2 ? 0.55 : -0.55); if (i % 2 === 0) sound.tick(0.35); wake(); }, 80 + i * 70);
    p.hold = true;
  });
  const holdDrop = () => { for (const p of P) if (p.hold) p.dropV = Math.max(p.dropV, 0); };
  holdDrop();
  wake();
};
Promise.all(hangers.map((h) => { const img = h.querySelector('img'); return img.decode ? img.decode().catch(() => {}) : Promise.resolve(); })).then(() => requestAnimationFrame(entry));
// 뒤 판은 쉬는 때에 미리 받아 둔다(누르고 나서 돌릴 때 비지 않게)
setTimeout(() => ITEMS.forEach((it) => { const im = new Image(); im.src = art(it.id, 'back'); }), 1200);
window.__shop = { open, close, step, setSide, order, go: (i) => dr.go(i), state, P };
