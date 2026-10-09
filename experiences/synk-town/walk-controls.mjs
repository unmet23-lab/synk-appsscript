// Input only. Position, collision and committed life actions live elsewhere.
export function createWalkControls({ surface, joystick, thumb, canMove, onInteract, onCancel, onMoveStart, onInputMode = () => {} }) {
  const keys = new Set(), directions = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
  let pointer = null, touch = { x: 0, z: 0 }, moving = false, padA = false, padB = false, padSuppressed = false, disposed = false;
  const editing = () => document.activeElement?.matches('input, textarea, select, [contenteditable="true"]') || document.querySelector('dialog[open]');
  const normalize = value => { const n = Math.hypot(value.x, value.z); return n > 1 ? { x: value.x / n, z: value.z / n } : value; };
  function resetTouch() { pointer = null; touch = { x: 0, z: 0 }; thumb.style.transform = 'translate(0px, 0px)'; joystick.setAttribute('aria-valuetext', '멈춤'); }
  function stop() { keys.clear(); resetTouch(); moving = false; padSuppressed = true; }
  function keydown(event) {
    if (disposed || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || editing()) return;
    if (event.code === 'Escape') { onCancel(); stop(); return; }
    if (!canMove()) return;
    if (directions[event.code]) { event.preventDefault(); keys.add(event.code); onInputMode('keyboard'); }
    if ((event.code === 'KeyE' || event.code === 'Space' && !document.activeElement?.matches('button, a')) && !event.repeat) { event.preventDefault(); onInputMode('keyboard'); onInteract(); }
  }
  function keyup(event) { keys.delete(event.code); }
  function pointermove(event) {
    if (event.pointerId !== pointer) return;
    if (!canMove() || editing()) { stop(); return; }
    event.preventDefault(); const rect = joystick.getBoundingClientRect(), radius = rect.width * .31;
    const input = normalize({ x: (event.clientX - rect.left - rect.width / 2) / radius, z: (event.clientY - rect.top - rect.height / 2) / radius });
    touch = Math.hypot(input.x, input.z) < .12 ? { x: 0, z: 0 } : input;
    thumb.style.transform = `translate(${touch.x * radius}px, ${touch.z * radius}px)`;
    joystick.setAttribute('aria-valuetext', touch.x || touch.z ? '이동 중' : '멈춤');
  }
  function pointerdown(event) {
    if (!canMove() || editing() || pointer !== null || event.button > 0) return;
    event.preventDefault(); pointer = event.pointerId; joystick.setPointerCapture(pointer); surface.focus({ preventScroll: true }); onInputMode('touch'); pointermove(event);
  }
  function pointerup(event) { if (event.pointerId === pointer) resetTouch(); }
  function gamepad() {
    const pad = [...(navigator.getGamepads?.() || [])].find(p => p?.connected && p.mapping === 'standard');
    if (!pad) { padA = padB = false; return { x: 0, z: 0 }; }
    const pressed = i => !!pad.buttons[i]?.pressed;
    const axis = n => Math.abs(n || 0) > .18 ? Math.sign(n) * Math.min(1, (Math.abs(n) - .18) / .82) : 0;
    const input = normalize({ x: axis(pad.axes[0]) || Number(pressed(15)) - Number(pressed(14)), z: axis(pad.axes[1]) || Number(pressed(13)) - Number(pressed(12)) });
    const a = pressed(0), b = pressed(1);
    if (padSuppressed) { if (!input.x && !input.z && !a && !b) padSuppressed = false; padA = a; padB = b; return { x: 0, z: 0 }; }
    if (a && !padA) { onInputMode('gamepad'); onInteract(); }
    if (b && !padB) { onInputMode('gamepad'); onCancel(); }
    padA = a; padB = b; if (input.x || input.z) onInputMode('gamepad'); return input;
  }
  function read() {
    if (disposed || document.hidden || !canMove() || editing() || !document.hasFocus()) { stop(); return { x: 0, z: 0 }; }
    const pad = gamepad(), key = [...keys].reduce((p, k) => ({ x: p.x + directions[k][0], z: p.z + directions[k][1] }), { x: 0, z: 0 });
    const input = normalize(key.x || key.z ? key : touch.x || touch.z ? touch : pad);
    const next = !!(input.x || input.z); if (next && !moving) onMoveStart(); moving = next; return input;
  }
  const hidden = () => { if (document.hidden) stop(); };
  window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', stop); document.addEventListener('visibilitychange', hidden);
  for (const [type, fn] of [['pointerdown', pointerdown], ['pointermove', pointermove], ['pointerup', pointerup], ['pointercancel', pointerup], ['lostpointercapture', pointerup]]) joystick.addEventListener(type, fn);
  return { read, stop, dispose() { disposed = true; stop(); window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', stop); document.removeEventListener('visibilitychange', hidden); for (const [type, fn] of [['pointerdown', pointerdown], ['pointermove', pointermove], ['pointerup', pointerup], ['pointercancel', pointerup], ['lostpointercapture', pointerup]]) joystick.removeEventListener(type, fn); } };
}
