'use strict';
// 시안이 그릴 때 넘긴 셰이더 값을 이름별로 적고, 원할 때 다음 프레임을 멈춘다(찍는 동안 그림이 바뀌지 않게).
(() => {
  const names = new WeakMap();
  const P = WebGLRenderingContext.prototype;
  const gul = P.getUniformLocation;
  P.getUniformLocation = function (prog, name) { const loc = gul.call(this, prog, name); if (loc) names.set(loc, name); return loc; };
  window.__uni = {};
  for (const fn of ['uniform1f', 'uniform2f', 'uniform3f']) {
    const orig = P[fn];
    P[fn] = function (loc, ...v) { const n = loc && names.get(loc); if (n) window.__uni[n] = v; return orig.call(this, loc, ...v); };
  }
  const raf = window.requestAnimationFrame.bind(window);
  const held = [];
  window.__freeze = false;
  window.requestAnimationFrame = cb => raf(t => { if (window.__freeze) { held.push(cb); return; } cb(t); });
  setInterval(() => { if (!window.__freeze && held.length) { const list = held.splice(0); for (const cb of list) raf(cb); } }, 50);
})();
