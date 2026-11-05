// 끌어넘기기 부품 — 가운데 항목이 주인공인 가로 줄(캐스팅북 「줄 세워 보기」 · 앱 옷 가게 봉).
// 브라우저에서는 전역 DragRail, Node에서는 require로 읽는다. 계산 함수는 DOM을 만지지 않아 시험할 수 있다.
//
// 바탕은 브라우저 가로 스크롤 + scroll-snap이다 — 터치 관성 · 키보드 · 화면 읽기를 그대로 받고, 스크립트가 멈춰도 넘어간다.
// 그 위에 스크롤 위치를 프레임마다 읽어 알려 주고, 마우스 끌기와 부드러운 이동만 더한다. 라이브러리는 쓰지 않는다.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DragRail = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  /** 스크롤 위치 → 줄 위치(0이면 첫 항목이 가운데). 칸 너비가 0이면 0. */
  function positionOf(scrollLeft, slot) {
    return slot > 0 ? scrollLeft / slot : 0;
  }

  function nearestIndex(position, count) {
    if (count <= 0) return 0;
    return clamp(Math.round(position), 0, count - 1);
  }

  /** 끌기를 놓을 때 멈출 항목. 속도(칸/초)만큼 앞을 내다보되 한 번에 네 칸 넘게 튀지 않는다. */
  function flickTarget(position, velocity, count) {
    const from = nearestIndex(position, count);
    const reach = clamp(velocity * 0.22, -4, 4);
    return clamp(Math.round(position + reach), Math.max(0, from - 4), Math.min(count - 1, from + 4));
  }

  /** 가운데에서 떨어진 거리 → 보이는 모습. sharp는 선명한 판의 불투명도, near는 곧 보일 항목이다. */
  function itemLook(distance) {
    const a = Math.abs(distance);
    let scale;
    if (a <= 1) scale = 1 - 0.16 * a;
    else if (a <= 2) scale = 0.84 - 0.09 * (a - 1);
    else scale = 0.75 - 0.04 * Math.min(a - 2, 1);
    return {
      scale: +scale.toFixed(4),
      sharp: +clamp(1 - a * 1.6, 0, 1).toFixed(3),
      opacity: +clamp(4 - a, 0, 1).toFixed(3),
      z: 100 - Math.round(Math.min(a, 9)), // 칸을 지날 때만 바뀐다 — 쌓임 순서를 자주 바꾸면 합성 층을 다시 짠다
      near: a < 3.5,
    };
  }

  /** 끌기 방향 판정. 아직 모르면 null. 가로로 정해져야 줄이 움직이고 세로는 페이지 스크롤로 둔다. */
  function dragIntent(dx, dy, threshold = 6) {
    const ax = Math.abs(dx), ay = Math.abs(dy);
    if (ax < threshold && ay < threshold) return null;
    return ax > ay ? 'x' : 'y';
  }

  /**
   * 옷걸이 흔들림 한 걸음(옷 가게, 11-05) — 고리를 축으로 한 진자. 고리가 가속하면(ax, px/s²) 옷은 반대쪽으로 처지고
   * 멈추면 몇 번 흔들리다 선다. 끌기 · 마우스 올림 · 봉 처짐이 모두 「고리가 움직인 가속도」 하나로 들어온다.
   * s = { th: 각(rad), om: 각속도 } · k 복원(클수록 빨리 흔들림) · damp 감쇠 · couple 가속을 받는 몫 · len 진자 길이(px) · max 최대 각.
   */
  function swingStep(s, ax, dt, o = {}) {
    const k = o.k ?? 46, damp = o.damp ?? 2.1, couple = o.couple ?? 0.26, len = o.len || 170, max = o.max ?? 0.26;
    const a = -k * Math.sin(s.th) - damp * s.om - couple * ax / len;
    const om = s.om + a * dt;
    return { th: clamp(s.th + om * dt, -max, max), om };
  }

  /** 처진 봉의 높이 — 양 끝(a · b)에서 0, 가운데에서 sag만큼 내려가는 포물선. 끝 밖은 끝 높이. */
  function sagAt(x, a, b, sag) {
    const half = (b - a) / 2;
    if (!(half > 0)) return 0;
    const u = clamp((x - (a + b) / 2) / half, -1, 1);
    return sag * (1 - u * u);
  }

  const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /**
   * 스크롤 줄 하나에 붙인다.
   * el: overflow-x:auto + scroll-snap 칸, opts.item: 항목 선택자.
   * opts.onFrame(position), opts.onCenter(index), opts.onSettle(index)
   * 돌려주는 것: go(index, smooth) · center() · lock(on) · refresh() · destroy()
   */
  function attach(el, opts) {
    const count = () => el.querySelectorAll(opts.item).length;
    // offsetWidth는 정수로 반올림돼 줄 끝으로 갈수록 어긋나므로 계산된 너비를 읽는다(transform에도 흔들리지 않는다)
    const slotOf = () => { const it = el.querySelector(opts.item); return it ? parseFloat(getComputedStyle(it).width) || it.offsetWidth : 0; };
    let slot = slotOf(), center = -1, raf = 0, lastMove = 0, tween = 0, settled = true, locked = false;
    let pressed = null, dragged = false;
    let dead = false, hold = null; // 창 크기가 바뀌는 동안 지킬 가운데 — 브라우저가 새 칸 너비로 먼저 맞춘 스크롤을 옛 너비로 읽으면 다른 사람이 가운데가 된다

    function report() {
      if (hold !== null) return;
      const pos = positionOf(el.scrollLeft, slot);
      if (opts.onFrame) opts.onFrame(pos);
      const next = nearestIndex(pos, count());
      if (next !== center) { center = next; settled = false; if (opts.onCenter) opts.onCenter(center); }
    }
    function loop() {
      raf = 0;
      if (dead) return;
      report();
      if (performance.now() - lastMove < 140 || tween || pressed) { raf = requestAnimationFrame(loop); return; }
      if (!settled) { settled = true; if (opts.onSettle) opts.onSettle(center); }
    }
    function wake() { lastMove = performance.now(); settled = false; if (!raf) raf = requestAnimationFrame(loop); }

    function stopTween() { if (tween) { cancelAnimationFrame(tween); tween = 0; el.style.scrollSnapType = ''; } }
    function moveTo(left, ms) {
      stopTween();
      const from = el.scrollLeft, t0 = performance.now();
      if (ms <= 0 || Math.abs(left - from) < 1) { el.scrollLeft = left; el.style.scrollSnapType = ''; report(); wake(); return; }
      el.style.scrollSnapType = 'none'; // 움직이는 동안 snap이 잡아당기면 끊긴다
      const step = (now) => {
        const k = clamp((now - t0) / ms, 0, 1), eased = 1 - (1 - k) ** 3;
        el.scrollLeft = from + (left - from) * eased;
        wake();
        if (k < 1) { tween = requestAnimationFrame(step); return; }
        tween = 0; el.style.scrollSnapType = '';
      };
      tween = requestAnimationFrame(step);
    }
    function go(index, smooth = true) {
      const n = count(); if (!n) return;
      const i = clamp(index, 0, n - 1);
      const dist = Math.abs(i * slot - el.scrollLeft);
      moveTo(i * slot, smooth && !reducedMotion() ? clamp(260 + dist * 0.25, 260, 620) : 0);
    }

    // 마우스 끌기 — 터치 · 펜은 브라우저 스크롤에 맡긴다
    function down(e) {
      if (e.pointerType !== 'mouse' || e.button !== 0 || locked) return;
      stopTween();
      pressed = { id: e.pointerId, x: e.clientX, y: e.clientY, left: el.scrollLeft, lastX: e.clientX, lastT: performance.now(), v: 0, on: false };
      dragged = false;
      // 캡처는 가로로 움직인 뒤에 잡으므로(그래야 누르기가 링크에 간다) 그 전에 줄 밖에서 놓는 경우를 창에서 받는다
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    }
    function move(e) {
      if (!pressed || e.pointerId !== pressed.id) return;
      const dx = e.clientX - pressed.x;
      if (!pressed.on) {
        const way = dragIntent(dx, e.clientY - pressed.y, 4);
        if (way === 'y') { pressed = null; return; }
        if (way !== 'x') return;
        pressed.on = true; dragged = true;
        el.style.scrollSnapType = 'none';
        el.classList.add('is-dragging');
        try { el.setPointerCapture(pressed.id); } catch { /* 이미 놓았을 때 */ }
      }
      e.preventDefault();
      el.scrollLeft = pressed.left - dx;
      const now = performance.now(), dt = now - pressed.lastT;
      if (dt > 0) {
        const v = -(e.clientX - pressed.lastX) / (slot || 1) / (dt / 1000);
        pressed.v = pressed.v * 0.6 + v * 0.4;
        pressed.lastX = e.clientX; pressed.lastT = now;
      }
      wake();
    }
    function up(e) {
      if (!pressed || e.pointerId !== pressed.id) return;
      const was = pressed; pressed = null;
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (!was.on) return;
      el.classList.remove('is-dragging');
      const still = performance.now() - was.lastT > 90; // 멈췄다 놓으면 관성 없이 가까운 칸으로
      go(flickTarget(positionOf(el.scrollLeft, slot), still || e.type === 'pointercancel' ? 0 : was.v, count()));
      setTimeout(() => { dragged = false; }, 0); // 뒤따르는 click을 아래에서 막은 다음에 푼다
    }
    function swallowClick(e) { if (dragged) { e.preventDefault(); e.stopPropagation(); dragged = false; } }
    function noNativeDrag(e) { e.preventDefault(); }
    function key(e) {
      if (locked || e.altKey || e.ctrlKey || e.metaKey) return;
      const n = count();
      const to = e.key === 'ArrowRight' ? center + 1 : e.key === 'ArrowLeft' ? center - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : null;
      if (to === null) return;
      e.preventDefault();
      go(to);
    }
    function cancelTween() { stopTween(); wake(); }

    el.addEventListener('scroll', wake, { passive: true });
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('click', swallowClick, true);
    el.addEventListener('dragstart', noNativeDrag);
    el.addEventListener('keydown', key);
    el.addEventListener('touchstart', cancelTween, { passive: true });
    el.addEventListener('wheel', cancelTween, { passive: true });
    function realign() {
      if (dead) return; // 줄을 다시 만든 뒤에 도착한 예약은 버린다
      const next = slotOf(), at = hold !== null ? hold : center;
      hold = null;
      if (next && next !== slot) { slot = next; stopTween(); el.scrollLeft = Math.max(at, 0) * slot; }
      report();
      wake();
    }
    function resized() {
      if (hold === null) hold = center;
      requestAnimationFrame(() => requestAnimationFrame(() => { if (hold !== null) realign(); })); // 칸 너비가 그대로면 ResizeObserver가 안 불린다
    }
    window.addEventListener('resize', resized);
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(realign) : null;
    if (ro) ro.observe(el);

    return {
      go,
      center: () => center,
      lock(on) { locked = !!on; stopTween(); el.classList.toggle('is-locked', locked); },
      refresh() { slot = slotOf(); center = -1; report(); },
      destroy() {
        dead = true; hold = null;
        stopTween();
        if (raf) cancelAnimationFrame(raf);
        if (ro) ro.disconnect();
        window.removeEventListener('resize', resized);
        el.removeEventListener('scroll', wake);
        el.removeEventListener('pointerdown', down);
        el.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        el.removeEventListener('click', swallowClick, true);
        el.removeEventListener('dragstart', noNativeDrag);
        el.removeEventListener('keydown', key);
        el.removeEventListener('touchstart', cancelTween);
        el.removeEventListener('wheel', cancelTween);
      },
    };
  }

  return { clamp, positionOf, nearestIndex, flickTarget, itemLook, dragIntent, swingStep, sagAt, attach };
});
