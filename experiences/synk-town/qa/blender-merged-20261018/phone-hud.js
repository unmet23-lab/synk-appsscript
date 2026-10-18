// Measurement panel for the same-Wi-Fi phone preview (phone-preview.mjs adds it
// to day.html; never part of Town itself). Reads SYNKTownDay.metrics() once a
// second, shows fps, first-screen time, the baked set's load and texture size and
// the JS heap where the browser exposes it, and posts the numbers to the PC every
// 5 seconds (and when the page is hidden). Two lines at the top; touches pass
// through it to Town's buttons underneath.
(() => {
  const variant = new URLSearchParams(location.search).get('district') || 'v20';
  const box = document.createElement('div');
  Object.assign(box.style, {
    position: 'fixed', top: 'calc(env(safe-area-inset-top, 0px) + 2px)', left: '50%', transform: 'translateX(-50%)', zIndex: 2147483647,
    font: '10px/1.35 ui-monospace, Menlo, Consolas, monospace', color: '#fff', background: 'rgba(0,0,0,.5)', padding: '3px 7px',
    borderRadius: '5px', whiteSpace: 'pre', pointerEvents: 'none', maxWidth: '96vw', overflow: 'hidden',
  });
  document.body.appendChild(box);

  const fpsList = [], started = performance.now();
  let readyMs = null, lastCount = null, lastAt = null, fps = null, sent = 0, gpuName = null;
  const median = list => { const s = [...list].sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
  const mb = bytes => bytes == null ? '–' : (bytes / 1e6).toFixed(0) + 'MB';
  const sec = ms => ms == null ? '…' : (ms / 1000).toFixed(1) + '초';
  function gpu() {
    if (gpuName) return gpuName;
    try {
      const gl = document.querySelector('#scene canvas')?.getContext('webgl2'), ext = gl?.getExtension('WEBGL_debug_renderer_info');
      gpuName = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl ? gl.getParameter(gl.RENDERER) : null;
    } catch { gpuName = null; }
    return gpuName;
  }
  function sample() {
    const m = globalThis.SYNKTownDay?.metrics?.();
    if (!m) return null;
    const now = performance.now();
    // performance.now() counts from the navigation, so this is the first-screen time (to within the 1 s sampling).
    if (readyMs == null && m.assetsReady && m.walk?.enabled) readyMs = now;
    if (lastCount != null && now > lastAt) {
      fps = (m.frameCount - lastCount) / ((now - lastAt) / 1000);
      if (document.visibilityState === 'visible') { fpsList.push(+fps.toFixed(1)); if (fpsList.length > 600) fpsList.shift(); }
    }
    lastCount = m.frameCount; lastAt = now;
    return m;
  }
  function report(m) {
    const d = m?.bakedDistrict;
    return {
      variant, ua: navigator.userAgent, dpr: devicePixelRatio, screen: [innerWidth, innerHeight], deviceMemoryGB: navigator.deviceMemory ?? null,
      gpu: gpu(), readyMs: readyMs == null ? null : Math.round(readyMs), seconds: Math.round((performance.now() - started) / 1000),
      fps: fps == null ? null : +fps.toFixed(1), fpsMedian: median(fpsList), fpsLast60: fpsList.slice(-60),
      heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1e6).toFixed(1) : null,
      drawCalls: m?.drawCalls ?? null, triangles: m?.triangles ?? null,
      district: d ? { tier: d.tier, loaded: d.loaded, failed: d.failed, loadMs: d.loadMs, textureBytes: d.textureBytes, downloadBytes: d.downloadBytes,
        deferred: d.deferred ? { loaded: d.deferred.loaded, failed: d.deferred.failed, loadMs: d.deferred.loadMs, bytes: d.deferred.bytes } : null } : null,
      visible: document.visibilityState,
    };
  }
  function draw(m = globalThis.SYNKTownDay?.metrics?.()) {
    if (!m) { box.textContent = `${variant} · 불러오는 중`; return; }
    const d = m.bakedDistrict, med = median(fpsList);
    const baked = d ? `구운 판 ${d.failed ? '실패' : d.loaded ? sec(d.loadMs) : '…'}${d.deferred ? `·바깥 ${d.deferred.failed ? '실패' : d.deferred.loaded ? sec(d.deferred.loadMs) : '…'}` : ''}` : 'v20';
    box.textContent = [
      `${variant} · fps ${fps == null ? '…' : fps.toFixed(0)}${med == null ? '' : `(중앙 ${med.toFixed(0)})`} · 첫 화면 ${sec(readyMs)}`,
      `${baked} · 텍스처 ${d ? mb(d.textureBytes) : '–'} · 메모리 ${performance.memory ? mb(performance.memory.usedJSHeapSize) : '?'} · 기록 ${sent}`].join('\n');
  }
  function send(final = false) {
    const body = JSON.stringify({ ...report(globalThis.SYNKTownDay?.metrics?.()), final });
    if (final && navigator.sendBeacon) { navigator.sendBeacon('/__phone-report', new Blob([body], { type: 'application/json' })); return; }
    fetch('/__phone-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).then(r => { if (r.ok) sent++; }).catch(() => {});
  }
  setInterval(() => draw(sample()), 1000);
  setInterval(() => { if (document.visibilityState === 'visible' && globalThis.SYNKTownDay) send(); }, 5000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') send(true); });
})();
