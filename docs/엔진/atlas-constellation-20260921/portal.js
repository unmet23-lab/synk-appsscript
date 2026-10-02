(() => {
  'use strict';
  const portal = document.querySelector('.synk-portal');
  if (!portal) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const forced = matchMedia('(forced-colors: active)');
  let frame = 0, previous = 0, leaving = false, timer = 0;
  let x = .28, y = .2, targetX = x, targetY = y;
  const paint = () => {
    portal.style.setProperty('--portal-x', `${(x * 100).toFixed(2)}%`);
    portal.style.setProperty('--portal-y', `${(y * 100).toFixed(2)}%`);
  };
  function tick(now) {
    // Time-based damping stays consistent on 60/120/144 Hz displays.
    const dt = previous ? Math.min(now - previous, 48) : 16;
    previous = now;
    const blend = 1 - Math.exp(-dt / 100);
    x += (targetX - x) * blend;
    y += (targetY - y) * blend;
    paint();
    if (Math.abs(targetX - x) + Math.abs(targetY - y) > .001) {
      frame = requestAnimationFrame(tick);
    } else { frame = 0; previous = 0; }
  }
  function aim(nextX, nextY) {
    targetX = nextX; targetY = nextY;
    if (!frame) frame = requestAnimationFrame(tick);
  }
  function clearLight() {
    portal.classList.remove('is-lit');
    cancelAnimationFrame(frame); frame = 0; previous = 0;
  }
  function track(event) {
    if (!fine.matches || forced.matches || event.pointerType === 'touch') return;
    portal.classList.add('is-lit');
    if (reduced.matches) return;
    const rect = portal.getBoundingClientRect();
    aim(Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)));
  }
  portal.addEventListener('pointerenter', track);
  portal.addEventListener('pointermove', track, {passive: true});
  portal.addEventListener('pointerleave', clearLight);
  portal.addEventListener('pointercancel', clearLight);
  portal.addEventListener('focus', () => { if (!portal.matches(':hover')) { x = .35; y = .2; paint(); } });
  portal.addEventListener('blur', clearLight);
  // Keep native modified-click, new-tab, download and reduced-motion navigation.
  portal.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
        portal.hasAttribute('download') || (portal.target && portal.target !== '_self') || reduced.matches || forced.matches) return;
    const destination = portal.href;
    if (!/^https?:/.test(destination)) return;
    event.preventDefault();
    if (leaving) return;
    leaving = true;
    clearLight();
    document.documentElement.classList.add('portal-departing');
    timer = window.setTimeout(() => location.assign(destination), 360);
  });
  function restore() {
    window.clearTimeout(timer); leaving = false;
    document.documentElement.classList.remove('portal-departing');
    clearLight();
  }
  // BFCache restores must never return to the faded-out entrance.
  window.addEventListener('pageshow', restore);
  window.addEventListener('pagehide', restore);
  window.addEventListener('blur', clearLight);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearLight(); });
  for (const media of [reduced, fine, forced]) media.addEventListener('change', clearLight);
  paint();
})();
