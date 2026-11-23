/** Seated stage for the Quest view and the PC "앉은 자리로 보기" window.
 * One still photograph (and the flat mono film over it) stands in front of the seat at its true
 * angular size. Around it is the same photograph blurred and dimmed: no invented walls. The desk
 * panel carries every word and button, so nothing follows the head. Places change through a
 * full-view fade driven by the page; the camera is never moved by the program.
 * It plugs into the interview room's createStrictVR as its `createStage` dependency, so session
 * entry, seated anchoring and exit stay the reviewed interview code. */
import { seatedAnchorFromPose, previewLookAfter, PREVIEW_COMFORT } from '../../interview/film/strict-vr.mjs';
import { HUD, CANVAS_FONT, paintHud, pickHudButton, hudKey } from './hud.mjs';

export const STAGE = Object.freeze({
  eyeHeight: 1.18,
  // Same plane as the interview film: 2.82 m wide at 1.79 m, about 76 degrees across (a 24mm view).
  view: Object.freeze({ width: 2.82, height: 2.82 * 9 / 16, distance: 1.79, feather: 0.05 }),
  // Tilted 60 degrees back from upright so it reads like a card on a lectern; its top edge hides
  // under 5% of the picture from the seated eye.
  hud: Object.freeze({ y: -0.5, z: -0.7, tilt: Math.PI / 3 }),
  desk: Object.freeze({ width: 1.6, depth: 0.7, top: -0.645, centerZ: -0.7 }),
  pointRadius: 0.05,
});

/** Photograph coordinates (0..1, origin top-left) to a position on the view plane. */
export function viewPointPosition(x, y, stage = STAGE) {
  return { x: (x - 0.5) * stage.view.width, y: (0.5 - y) * stage.view.height, z: -stage.view.distance };
}
/** The point a ray hit on the view plane selects, if one is close enough. uv origin is lower-left. */
export function nearestPoint(uv, points = [], radius = STAGE.pointRadius) {
  if (!uv || !Number.isFinite(uv.x) || !Number.isFinite(uv.y)) return null;
  let best = null, bestDistance = radius;
  for (const point of points) {
    const distance = Math.hypot(uv.x - point.x, ((1 - uv.y) - point.y) * 9 / 16);
    if (distance <= bestDistance) { best = point.id; bestDistance = distance; }
  }
  return best;
}
/** Where a person's film may replace the photograph: 1 inside the place's live rectangle
 * [x0, y0, x1, y1] (origin top-left), easing to 0 at its edges. Outside it the still photograph
 * stays, so a background that drifts in a generated clip can never move the whole view.
 * v is measured from the top here. An edge on the picture's border is not softened twice. */
export function liveAlpha(u, v, live, feather = 0.035) {
  if (!Array.isArray(live) || live.length !== 4) return 0;
  const [x0, y0, x1, y1] = live;
  const ramp = (distance) => { const t = Math.max(0, Math.min(1, distance / feather)); return t * t * (3 - 2 * t); };
  const side = (distance, onBorder) => (onBorder ? (distance >= 0 ? 1 : 0) : ramp(distance));
  return side(u - x0, x0 <= 0) * side(x1 - u, x1 >= 1) * side((v - y0) * 9 / 16, y0 <= 0) * side((y1 - v) * 9 / 16, y1 >= 1);
}
/** Soft rectangular edge so the sharp picture melts into the blurred surround. */
export function featherAlpha(u, v, feather = STAGE.view.feather) {
  const edge = Math.min(u, 1 - u, (v) * 9 / 16, (1 - v) * 9 / 16);
  const t = Math.max(0, Math.min(1, edge / feather));
  return t * t * (3 - 2 * t);
}

function surroundCanvas(document, image) {
  // Shrink to a few pixels and enlarge again: a blur every browser draws the same way.
  const small = document.createElement('canvas'); small.width = 32; small.height = 18;
  small.getContext('2d').drawImage(image, 0, 0, 32, 18);
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256;
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
  // From inside the sphere a texture reads mirrored, and straight ahead is u = 0.75: the mirrored
  // copy sits there so left stays left. The two copies meet at matching edges, so no seam.
  context.drawImage(small, 0, 0, 256, 256);
  context.save(); context.translate(512, 0); context.scale(-1, 1); context.drawImage(small, 0, 0, 256, 256); context.restore();
  context.fillStyle = 'rgba(10, 11, 14, 0.52)'; context.fillRect(0, 0, 512, 256);
  return canvas;
}

function drawPoints(context, points = [], width, height) {
  context.clearRect(0, 0, width, height);
  context.textBaseline = 'middle'; context.font = `700 30px ${CANVAS_FONT}`;
  for (const point of points) {
    const x = point.x * width, y = point.y * height;
    const label = point.heard || point.open ? point.label : '';
    if (label) {
      // A thin line from the dot to a plain name tag.
      const toRight = point.x < 0.7, tagWidth = context.measureText(label).width + 28, tagX = toRight ? x + 46 : x - 46 - tagWidth;
      context.strokeStyle = 'rgba(255,255,255,.9)'; context.lineWidth = 2;
      context.beginPath(); context.moveTo(x, y); context.lineTo(toRight ? x + 46 : x - 46, y); context.stroke();
      context.fillStyle = 'rgba(8,9,12,.82)'; context.fillRect(tagX, y - 24, tagWidth, 48);
      context.fillStyle = '#FFFFFF'; context.textAlign = 'left'; context.fillText(label, tagX + 14, y + 2);
    }
    // One small filled dot lifted off the picture by a soft shadow. No ring, no hole, no halo.
    context.save();
    context.shadowColor = 'rgba(0,0,0,.7)'; context.shadowBlur = 12; context.shadowOffsetY = 2;
    context.fillStyle = point.open ? '#D3E8BE' : '#FFFFFF';
    context.beginPath(); context.arc(x, y, 12, 0, Math.PI * 2); context.fill();
    context.restore();
  }
}

export async function buildWorkdayStage({ mount, getFrameState = () => [], getState = () => ({}), onAction = () => {}, onClosePreview = () => {} }) {
  const THREE = await import('../../vendor/three.module.js');
  const document = mount.ownerDocument;
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(1.5, globalThis.devicePixelRatio || 1));
  renderer.setSize(960, 540, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local');
  renderer.xr.setFramebufferScaleFactor(1);
  renderer.domElement.setAttribute('aria-label', '앉은 자리에서 본 일터 · 좌우 단추로 30도씩 둘러보기');
  renderer.domElement.tabIndex = 0;
  mount.append(renderer.domElement);

  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0c0d10);
  const camera = new THREE.PerspectiveCamera(PREVIEW_COMFORT.fov, 16 / 9, 0.05, 30);
  const anchor = new THREE.Group(); scene.add(anchor);
  const disposables = new Set();
  const keep = (resource) => { disposables.add(resource); return resource; };
  const flat = (options) => keep(new THREE.MeshBasicMaterial({ toneMapped: false, ...options }));

  // Surround: blurred photograph on a large inside-out sphere.
  const surroundMaterial = flat({ color: 0x1a1b1f, side: THREE.BackSide, depthWrite: false });
  const surround = new THREE.Mesh(keep(new THREE.SphereGeometry(12, 48, 24)), surroundMaterial); surround.renderOrder = 0; anchor.add(surround);
  const floor = new THREE.Mesh(keep(new THREE.CircleGeometry(4, 48)), flat({ color: 0x15161a, transparent: true, opacity: 0.55, depthWrite: false }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -STAGE.eyeHeight; floor.renderOrder = 1; anchor.add(floor);

  // View plane: photograph, two film layers, point marks.
  const view = STAGE.view;
  const alphaCanvas = document.createElement('canvas'); alphaCanvas.width = 256; alphaCanvas.height = 144;
  const alphaContext = alphaCanvas.getContext('2d'), alphaPixels = alphaContext.createImageData(256, 144);
  for (let row = 0; row < 144; row++) for (let column = 0; column < 256; column++) {
    const value = Math.round(255 * featherAlpha((column + 0.5) / 256, (row + 0.5) / 144)), offset = (row * 256 + column) * 4;
    alphaPixels.data[offset] = alphaPixels.data[offset + 1] = alphaPixels.data[offset + 2] = value; alphaPixels.data[offset + 3] = 255;
  }
  alphaContext.putImageData(alphaPixels, 0, 0);
  const alphaMap = keep(new THREE.CanvasTexture(alphaCanvas));
  const viewGeometry = keep(new THREE.PlaneGeometry(view.width, view.height));
  const photoMaterial = flat({ transparent: true, alphaMap, depthWrite: false });
  const photo = new THREE.Mesh(viewGeometry, photoMaterial); photo.position.z = -view.distance; photo.renderOrder = 2; photo.visible = false; anchor.add(photo);
  // The film is drawn only inside the place's live rectangle (see liveAlpha).
  const liveCanvas = document.createElement('canvas'); liveCanvas.width = 256; liveCanvas.height = 144;
  const liveContext = liveCanvas.getContext('2d'), livePixels = liveContext.createImageData(256, 144);
  const liveMap = keep(new THREE.CanvasTexture(liveCanvas));
  let liveKey = null;
  function setLive(live) {
    const key = JSON.stringify(live || null);
    if (key === liveKey) return;
    liveKey = key;
    for (let row = 0; row < 144; row++) for (let column = 0; column < 256; column++) {
      const u = (column + 0.5) / 256, v = (row + 0.5) / 144;
      const value = Math.round(255 * liveAlpha(u, v, live) * featherAlpha(u, 1 - v)), offset = (row * 256 + column) * 4;
      livePixels.data[offset] = livePixels.data[offset + 1] = livePixels.data[offset + 2] = value; livePixels.data[offset + 3] = 255;
    }
    liveContext.putImageData(livePixels, 0, 0); liveMap.needsUpdate = true;
  }
  setLive(null);
  const layers = [0, 1].map((index) => {
    const mesh = new THREE.Mesh(viewGeometry, flat({ transparent: true, alphaMap: liveMap, depthWrite: false }));
    mesh.position.z = -view.distance + 0.002 * (index + 1); mesh.renderOrder = 3 + index; mesh.visible = false; anchor.add(mesh); return mesh;
  });
  const pointCanvas = document.createElement('canvas'); pointCanvas.width = 1920; pointCanvas.height = 1080;
  const pointContext = pointCanvas.getContext('2d');
  const pointTexture = keep(new THREE.CanvasTexture(pointCanvas)); pointTexture.colorSpace = THREE.SRGBColorSpace;
  const pointPlane = new THREE.Mesh(viewGeometry, flat({ map: pointTexture, transparent: true, depthWrite: false }));
  pointPlane.position.z = -view.distance + 0.008; pointPlane.renderOrder = 5; pointPlane.visible = false; anchor.add(pointPlane);

  // Desk and its panel.
  const desk = new THREE.Mesh(keep(new THREE.BoxGeometry(STAGE.desk.width, 0.04, STAGE.desk.depth)), flat({ color: 0x8f7a5c }));
  desk.position.set(0, STAGE.desk.top - 0.02, STAGE.desk.centerZ); anchor.add(desk);
  const hudCanvas = document.createElement('canvas'); hudCanvas.width = HUD.width; hudCanvas.height = HUD.height;
  const hudContext = hudCanvas.getContext('2d');
  if (!hudContext || !pointContext) { renderer.dispose(); renderer.domElement.remove(); throw new Error('안내판을 준비하지 못했어요.'); }
  const hudTexture = keep(new THREE.CanvasTexture(hudCanvas)); hudTexture.colorSpace = THREE.SRGBColorSpace;
  // Drawn after the fade shell, so the desk card stays readable while the view is dark.
  const hud = new THREE.Mesh(keep(new THREE.PlaneGeometry(HUD.metersWide, HUD.metersWide * HUD.height / HUD.width)), flat({ map: hudTexture, transparent: true, depthTest: false, depthWrite: false }));
  hud.position.set(0, STAGE.hud.y, STAGE.hud.z); hud.rotation.x = -STAGE.hud.tilt; hud.renderOrder = 1000; anchor.add(hud);

  // Full-view fade for place changes: a small black shell around the eyes, drawn last.
  const fade = new THREE.Mesh(keep(new THREE.SphereGeometry(0.25, 16, 12)), flat({ color: 0x000000, side: THREE.BackSide, transparent: true, opacity: 0, depthTest: false, depthWrite: false }));
  fade.renderOrder = 999; fade.visible = false; scene.add(fade);

  const raycaster = new THREE.Raycaster(), rotation = new THREE.Matrix4();
  const pointerMaterial = keep(new THREE.LineBasicMaterial({ color: 0xb6c7b0, transparent: true, opacity: 0.55, depthTest: false, depthWrite: false }));
  const pointerGeometry = keep(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]));
  const videoTextures = new Map();
  let running = false, previewing = false, firstFrame = true, disposed = false, lastSelect = 0, lastHudKey = '', lastPointKey = '';
  let look = { yaw: 0, pitch: 0 }, drag = null, freeDrag = false;
  let photoUrl = null;
  // Photographs are fetched, decoded and uploaded to the graphics device before they are needed
  // (design rule 9): a place change only swaps two ready textures behind the dark.
  const places = new Map();
  function fetchPlace(url) {
    if (places.has(url)) return places.get(url).ready;
    const entry = { texture: null, blurred: null, ready: null };
    entry.ready = new THREE.TextureLoader().loadAsync(url).then((texture) => {
      if (disposed || places.get(url) !== entry) { texture.dispose(); return false; }
      texture.colorSpace = THREE.SRGBColorSpace; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.generateMipmaps = true;
      texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      const blurred = new THREE.CanvasTexture(surroundCanvas(document, texture.image)); blurred.colorSpace = THREE.SRGBColorSpace;
      entry.texture = texture; entry.blurred = blurred;
      renderer.initTexture(texture); renderer.initTexture(blurred);
      return true;
    }).catch(() => { if (places.get(url) === entry) places.delete(url); return false; });
    places.set(url, entry);
    return entry.ready;
  }
  function showPlace(url) {
    const entry = places.get(url);
    if (!entry?.texture || url === photoUrl) return;
    photoMaterial.map = entry.texture; photoMaterial.needsUpdate = true; photo.visible = true;
    surroundMaterial.map = entry.blurred; surroundMaterial.color.set(0xffffff); surroundMaterial.needsUpdate = true;
    photoUrl = url;
  }
  function loadPlace(url) {
    if (!url || url === photoUrl) return;
    if (places.get(url)?.texture) showPlace(url); else void fetchPlace(url).then((ok) => { if (ok && !disposed && getState().place?.photo === url) showPlace(url); });
  }
  /** Keep the given photographs ready and let go of the others (never the one on screen). */
  function preload(urls = []) {
    const wanted = new Set(urls.filter(Boolean));
    for (const [url, entry] of places) if (!wanted.has(url) && url !== photoUrl) { entry.texture?.dispose(); entry.blurred?.dispose(); places.delete(url); }
    return Promise.all([...wanted].map(fetchPlace)).then((results) => results.every(Boolean));
  }
  function videoTexture(video) {
    if (!videoTextures.has(video)) {
      const texture = new THREE.VideoTexture(video); texture.colorSpace = THREE.SRGBColorSpace; texture.minFilter = texture.magFilter = THREE.LinearFilter;
      if (video.readyState >= 2) texture.needsUpdate = true;
      videoTextures.set(video, texture);
    }
    return videoTextures.get(video);
  }
  function updateFilm(frames = [], place = null) {
    // Without a live rectangle, or for a clip not cleared for the headset, the photograph stays.
    const allowed = Array.isArray(place?.live) && place.film !== false;
    setLive(allowed ? place.live : null);
    const entries = allowed ? frames.slice(0, 2) : [], live = new Set(entries.map((entry) => entry?.video).filter(Boolean));
    for (const [video, texture] of videoTextures) if (!live.has(video)) { texture.dispose(); videoTextures.delete(video); }
    layers.forEach((mesh, index) => {
      const entry = entries[index], video = entry?.video;
      mesh.visible = !!video && video.readyState >= 2 && entry.opacity > 0;
      if (!mesh.visible) return;
      const texture = videoTexture(video);
      if (mesh.material.map !== texture) { mesh.material.map = texture; mesh.material.needsUpdate = true; }
      mesh.material.opacity = Math.min(1, Math.max(0, Number(entry.opacity) || 0));
    });
  }
  function pick(ray) {
    raycaster.ray.copy(ray);
    const state = getState();
    const panel = raycaster.intersectObject(hud, false)[0];
    if (panel) return pickHudButton(panel.uv, state.hud?.buttons);
    const points = state.place?.points || [];
    if (!points.length) return null;
    const hit = raycaster.intersectObject(pointPlane, false)[0];
    const id = hit && nearestPoint(hit.uv, points);
    return id ? `point:${id}` : null;
  }
  const controllers = [0, 1].map((index) => {
    const controller = renderer.xr.getController(index);
    const line = new THREE.Line(pointerGeometry, pointerMaterial); line.scale.z = 4; line.renderOrder = 1001; controller.add(line); scene.add(controller);
    const select = () => {
      const now = performance.now();
      if (!running || previewing || now - lastSelect < 250) return;
      rotation.identity().extractRotation(controller.matrixWorld);
      const ray = new THREE.Ray(new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld), new THREE.Vector3(0, 0, -1).applyMatrix4(rotation));
      const action = pick(ray);
      if (action) { lastSelect = now; onAction(action); }
    };
    controller.addEventListener('select', select);
    return { controller, line, select };
  });

  // PC window controls. Their look lives in workday.css.
  const closeButton = document.createElement('button'); closeButton.type = 'button'; closeButton.textContent = '닫기'; closeButton.className = 'preview-close'; closeButton.hidden = true;
  closeButton.addEventListener('click', onClosePreview); mount.append(closeButton);
  const previewHint = document.createElement('p'); previewHint.className = 'preview-hint'; previewHint.hidden = true; previewHint.textContent = '좌우 30도씩 · Home 정면 · Esc 닫기'; mount.append(previewHint);
  const previewControls = document.createElement('div'); previewControls.className = 'preview-controls'; previewControls.hidden = true; previewControls.setAttribute('role', 'group'); previewControls.setAttribute('aria-label', '둘러보기 조작'); mount.append(previewControls);
  const applyLook = (next) => { look = next; camera.rotation.set(look.pitch, look.yaw, 0, 'YXZ'); };
  const turn = (direction) => { if (previewing) { drag = null; applyLook(previewLookAfter(look, { type: 'turn', direction })); } };
  const resetLook = () => { if (previewing) { drag = null; applyLook(previewLookAfter(look, { type: 'reset' })); } };
  const previewButtons = [['왼쪽 30도', () => turn(1)], ['정면', resetLook], ['오른쪽 30도', () => turn(-1)], ['마우스로 둘러보기', () => { freeDrag = !freeDrag; drag = null; updateDrag(); }]].map(([label, action]) => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.addEventListener('click', action); previewControls.append(button); return { button, action };
  });
  function updateDrag() { const button = previewButtons[3].button; // The name stays the same; only the pressed state says whether dragging is on.
    button.setAttribute('aria-pressed', String(freeDrag)); renderer.domElement.style.cursor = freeDrag ? 'grab' : 'default'; }
  function resize() {
    if (!previewing) return;
    const width = Math.max(1, mount.clientWidth || innerWidth), height = Math.max(1, mount.clientHeight || innerHeight);
    renderer.setSize(width, height, false); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
    camera.aspect = width / height; camera.updateProjectionMatrix();
  }
  const down = (event) => { if (previewing && event.button === 0) { drag = { id: event.pointerId, x: event.clientX, y: event.clientY, ...look, moved: false }; renderer.domElement.setPointerCapture?.(event.pointerId); } };
  const move = (event) => {
    if (!previewing || !drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true;
    if (freeDrag) applyLook(previewLookAfter(drag, { type: 'drag', dx, dy }));
  };
  const up = (event) => {
    if (!previewing || !drag || event.pointerId !== drag.id) return;
    const click = !drag.moved; renderer.domElement.releasePointerCapture?.(event.pointerId); drag = null;
    if (!click) return;
    const rect = renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2), camera);
    const action = pick(raycaster.ray.clone());
    if (action === 'exit') onClosePreview(); else if (action) onAction(action);
  };
  const cancel = () => { drag = null; };
  const keydown = (event) => {
    if (!previewing) return;
    if (event.key === 'Escape') { onClosePreview(); return; }
    // Browser and system shortcuts (Alt+← back, Cmd+→ forward, Alt+Home) stay theirs.
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName) || !['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) return;
    event.preventDefault(); if (event.repeat) return;
    if (event.key === 'Home') resetLook(); else turn(event.key === 'ArrowLeft' ? 1 : -1);
  };
  renderer.domElement.style.touchAction = 'none';
  renderer.domElement.addEventListener('pointerdown', down); renderer.domElement.addEventListener('pointermove', move); renderer.domElement.addEventListener('pointerup', up); renderer.domElement.addEventListener('pointercancel', cancel);
  globalThis.addEventListener('resize', resize); globalThis.addEventListener('keydown', keydown);

  const headPosition = new THREE.Vector3();
  function frame(time, xrFrame) {
    if (!running) return;
    if (firstFrame && !previewing) {
      // Hide the stage until the headset reports where the seated head is.
      const space = renderer.xr.getReferenceSpace(), initial = space && seatedAnchorFromPose(xrFrame?.getViewerPose(space));
      if (!initial) return;
      anchor.position.set(initial.x, initial.y, initial.z); anchor.rotation.set(0, initial.yaw, 0); anchor.visible = true; firstFrame = false;
    }
    const state = getState();
    loadPlace(state.place?.photo);
    updateFilm(getFrameState() || [], state.place);
    const key = hudKey(state.hud);
    if (key !== lastHudKey) { lastHudKey = key; paintHud(hudContext, state.hud); hudTexture.needsUpdate = true; }
    const points = state.place?.points || [], pointKey = JSON.stringify(points);
    if (pointKey !== lastPointKey) { lastPointKey = pointKey; drawPoints(pointContext, points, pointCanvas.width, pointCanvas.height); pointTexture.needsUpdate = true; pointPlane.visible = points.length > 0; }
    const dark = Math.min(1, Math.max(0, Number(state.fade) || 0));
    fade.visible = dark > 0.001; fade.material.opacity = dark;
    (renderer.xr.isPresenting ? renderer.xr.getCamera() : camera).getWorldPosition(headPosition); fade.position.copy(headPosition);
    renderer.render(scene, camera);
  }
  const stage = {
    renderer,
    preload,
    /** Resolves true once the photograph for `url` is uploaded and on the view plane, false if it
     * could not be loaded. The page keeps the view dark until this settles. */
    async placeReady(url) {
      if (disposed || !url) return false;
      if (url === photoUrl) return true;
      const ok = await fetchPlace(url);
      if (ok && !disposed) showPlace(url);
      return ok && !disposed;
    },
    async warmVideoFrames() { return !disposed; },
    start() { previewing = false; closeButton.hidden = previewHint.hidden = previewControls.hidden = true; firstFrame = true; anchor.visible = false; lastHudKey = ''; lastPointKey = ''; running = true; renderer.setAnimationLoop(frame); },
    startPreview() {
      previewing = true; firstFrame = false; lastHudKey = ''; lastPointKey = ''; freeDrag = false; running = true;
      anchor.visible = true; anchor.position.set(0, 0, 0); anchor.rotation.set(0, 0, 0); camera.position.set(0, 0, 0); camera.fov = PREVIEW_COMFORT.fov; applyLook({ yaw: 0, pitch: 0 }); updateDrag();
      closeButton.hidden = previewHint.hidden = previewControls.hidden = false; resize(); renderer.setAnimationLoop(frame);
      renderer.domElement.focus({ preventScroll: true });
    },
    stopPreview() { previewing = false; closeButton.hidden = previewHint.hidden = previewControls.hidden = true; drag = null; running = false; renderer.setAnimationLoop(null); updateFilm([]); },
    stop() { running = false; renderer.setAnimationLoop(null); updateFilm([]); },
    dispose() {
      if (disposed) return; disposed = true; running = false; renderer.setAnimationLoop(null);
      controllers.forEach(({ controller, line, select }) => { controller.removeEventListener('select', select); controller.remove(line); scene.remove(controller); });
      renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('pointermove', move); renderer.domElement.removeEventListener('pointerup', up); renderer.domElement.removeEventListener('pointercancel', cancel);
      globalThis.removeEventListener('resize', resize); globalThis.removeEventListener('keydown', keydown);
      closeButton.removeEventListener('click', onClosePreview); closeButton.remove(); previewHint.remove();
      previewButtons.forEach(({ button, action }) => button.removeEventListener('click', action)); previewControls.remove();
      videoTextures.forEach((texture) => texture.dispose()); videoTextures.clear(); for (const entry of places.values()) { entry.texture?.dispose(); entry.blurred?.dispose(); } places.clear();
      disposables.forEach((resource) => resource.dispose()); renderer.dispose(); renderer.domElement.remove();
    },
  };
  try { paintHud(hudContext, getState().hud); hudTexture.needsUpdate = true; await renderer.compileAsync?.(scene, camera); }
  catch (error) { stage.dispose(); throw error; }
  return stage;
}
