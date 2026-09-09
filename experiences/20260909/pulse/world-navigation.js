import * as THREE from 'three';

// Collision dimensions are authored with the miniature, in world metres.
// Movement never depends on visual frame count and is subdivided to avoid tunnelling.
const LIMITS = { minX: -10.05, maxX: 10.05, minZ: -25.5, maxZ: 24 };
const SOLIDS = [
  [-1.57, 1.82, -5.7, 1.16], // tram body and bumpers
  [-9.28, -6.12, 6.83, 8.18], [-9.68, -6.55, -15.73, -14.33],
  [9.05, 10.4, .25, 3.35], // benches
  [-7.8, -6.6, 12.08, 13.32], // postbox
  [-6.8, -5.4, 8.63, 10.02], [-9.02, -7.77, 14.07, 15.33],
  [9, 10.65, 8.87, 10.53], [7.28, 8.72, -7.72, -6.28],
  [8.45, 9.55, -25.5, -24.1],
  [7.96, 8.43, -5.76, -5.24], [7.96, 8.43, -.76, -.24],
  [-9.07, -8.53, 10.73, 11.27], [-9.97, -9.43, -5.27, -4.73],
  [9.03, 9.57, 7.23, 7.77], [9.13, 9.67, -14.27, -13.73],
  [-4.5, -4.1, -.91, -.49],
  [-3.45, -2.05, -.45, 1.25], // tram repair cabinet
  [8.67, 10.1, -3.95, -2.38], // radio desk
  [-3.59, -2.1, 7.66, 9.04], // craft crate
  [-7.43, -7.17, -10.13, -9.87], // cable mast
];
const RADIUS = .27;
const EYE = 2.03;
const editable = el => Boolean(el?.isContentEditable || el?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="slider"]'));
const clamp = THREE.MathUtils.clamp;

export function isWalkable(x, z, radius = RADIUS) {
  if (x < LIMITS.minX + radius || x > LIMITS.maxX - radius || z < LIMITS.minZ + radius || z > LIMITS.maxZ - radius) return false;
  for (const [x0, x1, z0, z1] of SOLIDS) {
    const nx = clamp(x, x0, x1), nz = clamp(z, z0, z1);
    if ((x - nx) ** 2 + (z - nz) ** 2 < radius ** 2) return false;
  }
  return true;
}

export function moveWithCollision(position, dx, dz) {
  let blocked = false;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .1));
  for (let n = 0; n < steps; n++) {
    if (isWalkable(position.x + dx / steps, position.z)) position.x += dx / steps;
    else blocked = true;
    if (isWalkable(position.x, position.z + dz / steps)) position.z += dz / steps;
    else blocked = true;
  }
  return blocked;
}

export function createNavigation({ canvas, camera, poses, objects, onInspect, onStatus, onClick }) {
  const keys = new Set(), listeners = [];
  let mode = 'walk', enabled = false, reduced = false, pointer = null, drag = false;
  let yaw = 0, pitch = 0, moving = false, nearest = null, zone = 'square';
  let lastStatus = '', stepsDistance = 0, stepClock = 0, collisions = 0;
  const position = new THREE.Vector3(4.65, EYE, 15.8);
  const desiredPosition = position.clone(), target = new THREE.Vector3(), desiredTarget = new THREE.Vector3();
  const forward = new THREE.Vector3(), right = new THREE.Vector3(), delta = new THREE.Vector3();
  const initialTarget = new THREE.Vector3(-1.5, 3.15, -10);
  function orient(point) {
    delta.copy(point).sub(position).normalize();
    yaw = Math.atan2(-delta.x, -delta.z); pitch = Math.asin(clamp(delta.y, -1, 1));
  }
  orient(initialTarget); camera.position.copy(position);
  function listen(targetEl, event, fn, options) {
    targetEl.addEventListener(event, fn, options); listeners.push(() => targetEl.removeEventListener(event, fn, options));
  }
  function stop() { keys.clear(); pointer = null; moving = false; stepsDistance = 0; }
  function canControl(e) { return enabled && !e.altKey && !e.ctrlKey && !e.metaKey && !editable(e.target); }
  function status(step = false) {
    const next = JSON.stringify([zone, moving, nearest, mode]);
    if (next !== lastStatus || step) { lastStatus = next; onStatus?.({ zone, moving, nearest, cameraMode: mode, ...(step ? { step: true } : {}) }); }
  }
  function scan() {
    let distance = 3.1; nearest = null;
    for (const item of objects) {
      const p = item.interaction || item.point;
      const d = Math.hypot(position.x - p.x, position.z - p.z);
      if (d < distance) { nearest = item.id; distance = d; }
    }
    zone = position.x < -6.4 && position.z < 9 ? 'harbor'
      : Math.hypot(position.x + 7.2, position.z - 12.7) < 4.2 ? 'postbox'
      : position.x > 5.4 && position.z < 1.5 && position.z > -10 ? 'radio'
      : Math.hypot(position.x + 1, position.z) < 5.7 ? 'tram' : 'square';
  }
  function setCameraMode(next) {
    if (!['walk', 'orbit', 'overview'].includes(next)) return;
    stop();
    if (next === 'walk') {
      if (!isWalkable(camera.position.x, camera.position.z)) position.set(4.65, EYE, 15.8);
      else position.set(camera.position.x, EYE, camera.position.z);
      const direction = camera.getWorldDirection(new THREE.Vector3());
      yaw = Math.atan2(-direction.x, -direction.z); pitch = clamp(Math.asin(direction.y), -.65, .65);
      mode = 'walk'; camera.position.copy(position); camera.fov = 55; camera.updateProjectionMatrix();
    } else {
      mode = next; camera.fov = next === 'overview' ? 47 : 52; camera.updateProjectionMatrix();
      const pose = next === 'overview' ? poses.overview : poses.street;
      desiredPosition.copy(pose.position); desiredTarget.copy(pose.target);
      target.copy(desiredTarget);
    }
    scan(); status();
  }
  function focus(id) {
    const pose = poses[id] || poses.street;
    stop();
    if (id === 'overview' || ['lighthouse', 'station', 'homes'].includes(id)) {
      mode = id === 'overview' ? 'overview' : 'orbit';
      desiredPosition.copy(pose.position); desiredTarget.copy(pose.target);
      if (reduced) { camera.position.copy(desiredPosition); target.copy(desiredTarget); }
    } else {
      mode = 'walk';
      position.copy(pose.position); position.y = EYE;
      if (!isWalkable(position.x, position.z)) position.set(4.65, EYE, 15.8);
      orient(pose.target); camera.position.copy(position); camera.fov = 55; camera.updateProjectionMatrix();
    }
    scan(); status();
  }
  function orbit(dx, dy) {
    const offset = desiredPosition.clone().sub(desiredTarget), spherical = new THREE.Spherical().setFromVector3(offset);
    spherical.theta -= dx * .0035; spherical.phi = clamp(spherical.phi + dy * .003, .22, 1.48);
    desiredPosition.copy(desiredTarget).add(offset.setFromSpherical(spherical));
  }
  listen(document, 'keydown', e => {
    if (!canControl(e)) return;
    const key = e.code;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(key) && mode === 'walk') {
      // UI buttons retain Space/Enter; only the four explicit movement keys are global.
      e.preventDefault(); keys.add(key);
    } else if (key === 'KeyE' && mode === 'walk' && !e.repeat && nearest) {
      e.preventDefault(); stop(); onInspect?.(nearest);
    } else if (e.target === canvas && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) {
      e.preventDefault();
      if (mode === 'walk') {
        yaw += key === 'ArrowLeft' ? .12 : key === 'ArrowRight' ? -.12 : 0;
        pitch = clamp(pitch + (key === 'ArrowUp' ? .08 : key === 'ArrowDown' ? -.08 : 0), -.8, 1.1);
      } else orbit(key === 'ArrowLeft' ? -45 : key === 'ArrowRight' ? 45 : 0, key === 'ArrowUp' ? -35 : key === 'ArrowDown' ? 35 : 0);
    } else if (e.target === canvas && key === 'Home') { e.preventDefault(); focus('street'); }
  });
  listen(document, 'keyup', e => keys.delete(e.code));
  listen(window, 'blur', stop);
  listen(document, 'visibilitychange', () => { if (document.hidden) stop(); });
  listen(document, 'focusin', e => { if (editable(e.target)) stop(); });
  listen(canvas, 'blur', () => { keys.clear(); moving = false; });
  listen(canvas, 'pointerdown', e => {
    if (e.button !== 0) return;
    canvas.focus({ preventScroll: true }); pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY }; drag = false;
    canvas.setPointerCapture(e.pointerId);
  });
  listen(canvas, 'pointermove', e => {
    if (!pointer || pointer.id !== e.pointerId) return;
    const dx = e.clientX - pointer.x, dy = e.clientY - pointer.y;
    if (Math.hypot(e.clientX - pointer.sx, e.clientY - pointer.sy) > 4) drag = true;
    if (mode === 'walk') { yaw -= dx * .003; pitch = clamp(pitch - dy * .0026, -.8, 1.1); }
    else orbit(dx, dy);
    pointer.x = e.clientX; pointer.y = e.clientY;
  });
  listen(canvas, 'pointerup', e => {
    if (!pointer || pointer.id !== e.pointerId) return;
    if (!drag && enabled) onClick?.(e);
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    pointer = null;
  });
  listen(canvas, 'pointercancel', stop);
  listen(canvas, 'lostpointercapture', () => { pointer = null; });
  listen(canvas, 'wheel', e => {
    e.preventDefault();
    if (mode === 'walk') { camera.fov = clamp(camera.fov + e.deltaY * .018, 43, 65); camera.updateProjectionMatrix(); }
    else {
      const offset = desiredPosition.clone().sub(desiredTarget);
      offset.setLength(clamp(offset.length() * Math.exp(e.deltaY * .0008), 4, 85)); desiredPosition.copy(desiredTarget).add(offset);
    }
  }, { passive: false });
  function update(dt) {
    if (mode === 'walk') {
      const x = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
      const z = Number(keys.has('KeyW')) - Number(keys.has('KeyS'));
      const was = position.clone();
      if (enabled && (x || z)) {
        forward.set(-Math.sin(yaw), 0, -Math.cos(yaw)); right.set(Math.cos(yaw), 0, -Math.sin(yaw));
        delta.copy(forward).multiplyScalar(z).addScaledVector(right, x).normalize().multiplyScalar(2.55 * dt);
        if (moveWithCollision(position, delta.x, delta.z)) collisions++;
      }
      const distance = position.distanceTo(was); moving = distance > .0002;
      stepsDistance += distance; stepClock += dt;
      camera.position.copy(position);
      // A quiet camera: no mandatory head bob, drift or walking sway, even with full motion.
      camera.rotation.order = 'YXZ'; camera.rotation.set(pitch, yaw, 0);
      scan();
      if (stepsDistance > 1.08 && stepClock > .38) { status(true); stepsDistance %= 1.08; stepClock = 0; }
      else status();
    } else {
      moving = false;
      const smooth = reduced ? 1 : 1 - Math.exp(-dt * 6);
      camera.position.lerp(desiredPosition, smooth); target.lerp(desiredTarget, smooth); camera.lookAt(target);
      status();
    }
  }
  setCameraMode('walk'); orient(initialTarget);
  return {
    update, focus, setCameraMode,
    setWalkMode(value) { setCameraMode(value ? 'walk' : 'orbit'); },
    setEnabled(value) { enabled = Boolean(value); if (!enabled) stop(); },
    setReducedMotion(value) { reduced = Boolean(value); },
    getState() { return { mode, enabled, moving, zone, nearest, position: position.toArray().map(v => +v.toFixed(3)), yaw: +yaw.toFixed(4), pitch: +pitch.toFixed(4), collisions, keys: [...keys] }; },
    dispose() { stop(); listeners.forEach(remove => remove()); },
  };
}
