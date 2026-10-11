// Run before the module shell without requiring inline-script CSP permission.
window.__SYNK_WORLD_CONNECTED__ = true;
window.__SYNK_WORLD_CONFIG__ = JSON.parse(document.getElementById('synk-world-config').textContent);
window.__synkOpeningSafetyTimer = setTimeout(function () {
  document.getElementById('synk-opening-cover')?.remove();
}, 5000);
