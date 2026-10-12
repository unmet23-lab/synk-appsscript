import { createInterviewSpace, roomPlacement } from './room-space.mjs';
// The seated room extends around the original mono film; its people are still
// two-dimensional. The same two decoders feed the page, room preview and Quest.
const HUD_WIDTH = 1536, HUD_HEIGHT = 400;
export const PREVIEW_COMFORT = Object.freeze({ fov: 60, turnRadians: Math.PI / 6, dragRadiansPerPixel: .0009, pitchLimitRadians: Math.PI / 6 });

// PC navigation only. XR always uses the headset pose without these limits.
export function previewLookAfter(look, action) {
  if (action.type === 'reset') return { yaw: 0, pitch: 0 };
  const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
  if (action.type === 'turn') return { yaw: wrap(look.yaw + Math.sign(action.direction) * PREVIEW_COMFORT.turnRadians), pitch: 0 };
  if (action.type === 'drag') return {
    yaw: wrap(look.yaw - action.dx * PREVIEW_COMFORT.dragRadiansPerPixel),
    pitch: Math.max(-PREVIEW_COMFORT.pitchLimitRadians, Math.min(PREVIEW_COMFORT.pitchLimitRadians, look.pitch - action.dy * PREVIEW_COMFORT.dragRadiansPerPixel)),
  };
  return look;
}

export function seatedAnchorFromPose(pose) {
  const p = pose?.transform?.position, q = pose?.transform?.orientation;
  if (!p || !q || ![p.x, p.y, p.z, q.x, q.y, q.z, q.w].every(Number.isFinite)) return null;
  return { x: p.x, y: p.y, z: p.z, yaw: Math.atan2(2 * (q.x * q.z + q.w * q.y), 1 - 2 * (q.x * q.x + q.y * q.y)) };
}
const BUTTONS = [
  { x: 32, y: 304, w: 600, h: 68 },
  { x: 656, y: 304, w: 400, h: 68 },
  { x: 1080, y: 304, w: 424, h: 68 },
];

export function getStrictVRGate(state = {}) {
  if (state.mode !== 'voice') return 'VR에서는 음성 답변을 사용합니다. 화면에서 음성 모드를 선택해 주세요.';
  if (!state.voiceReady) return 'VR에 들어가기 전에 화면에서 음성 인식을 준비해 주세요.';
  return '';
}

export function getStrictVRControls(state = {}) {
  const primary = state.paused
    ? { action: 'resume', label: '계속하기', enabled: true }
    : state.phase === 'confirming'
      ? { action: state.reviewPage < (state.reviewPages?.length || 1) - 1 ? 'reviewNext' : 'confirm', label: state.reviewPage < (state.reviewPages?.length || 1) - 1 ? '다음 부분 확인' : state.partialReview ? '이 부분이 맞아요' : '이 내용으로 답변', enabled: !!state.canConfirm }
    : state.phase === 'repair'
      ? { action: 'retry', label: '다시 답변', enabled: true }
    : state.canStart
      ? { action: 'start', label: '면접 시작', enabled: true }
      : { action: 'submit', label: state.canSubmit ? '답변 마침' : '질문을 듣고 답변하세요', enabled: !!state.canSubmit };
  return [
    { ...BUTTONS[0], ...primary },
    { ...BUTTONS[1], ...(state.phase === 'confirming' && !state.paused
      ? { action: 'retry', label: state.partialReview ? '이 부분만 다시 말하기' : '다시 말하기', enabled: !!state.canConfirm }
      : state.phase === 'repair' && !state.paused
      ? { action: 'repeat', label: '질문 다시 듣기', enabled: true }
      : { action: state.paused ? 'resume' : 'pause', label: state.paused ? '계속하기' : '일시정지', enabled: !state.canStart }) },
    { ...BUTTONS[2], action: 'exit', label: 'VR 나가기', enabled: true },
  ];
}

export function pickStrictVRControl(uv, state = {}) {
  if (!uv || !Number.isFinite(uv.x) || !Number.isFinite(uv.y)) return null;
  const x = uv.x * HUD_WIDTH, y = (1 - uv.y) * HUD_HEIGHT;
  const control = getStrictVRControls(state).find((item) => x >= item.x && x <= item.x + item.w && y >= item.y && y <= item.y + item.h);
  return control?.enabled ? control.action : null;
}

async function buildStage({ mount, getFrameState, getState, onAction, onClosePreview = () => {} }) {
  const THREE = await import('../../vendor/three.module.js');
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(1.5, globalThis.devicePixelRatio || 1));
  renderer.setSize(960, 540, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local');
  renderer.xr.setFramebufferScaleFactor(1);
  renderer.domElement.setAttribute('aria-label', '실사 면접실 · 좌우 버튼으로 30도씩 둘러보기');
  renderer.domElement.tabIndex = 0;
  mount.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbfc3bc);
  const camera = new THREE.PerspectiveCamera(PREVIEW_COMFORT.fov, 16 / 9, .05, 20);
  const anchor = new THREE.Group();
  scene.add(anchor);
  let room;
  try { room = await createInterviewSpace(THREE, { parent: anchor, maxAnisotropy: renderer.capabilities.getMaxAnisotropy() }); }
  catch (error) { renderer.dispose(); renderer.domElement.remove(); throw error; }
  const canvas = document.createElement('canvas');
  canvas.width = HUD_WIDTH; canvas.height = HUD_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) { room.dispose(); renderer.dispose(); renderer.domElement.remove(); throw new Error('VR 안내판을 준비하지 못했습니다.'); }
  const hudTexture = new THREE.CanvasTexture(canvas);
  hudTexture.colorSpace = THREE.SRGBColorSpace;
  const hudMaterial = new THREE.MeshBasicMaterial({ map: hudTexture, toneMapped: false });
  const hudGeometry = new THREE.PlaneGeometry(1.05, 1.05 * HUD_HEIGHT / HUD_WIDTH);
  const hud = new THREE.Mesh(hudGeometry, hudMaterial);
  hud.position.set(0, roomPlacement().tableY + .012, -.85);
  hud.rotation.x = -Math.PI / 2;
  anchor.add(hud);

  const raycaster = new THREE.Raycaster(), rotation = new THREE.Matrix4();
  const pointerMaterial = new THREE.LineBasicMaterial({ color: 0xb6c7b0, transparent: true, opacity: .55 });
  const pointerGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]);
  let lastSelect = 0, lastHUDKey = '', firstFrame = true, running = false, previewing = false, drag = null, freeDrag = false, stageDisposed = false, videoWarmupRevision = 0;
  let look = { yaw: 0, pitch: 0 };
  const closeButton = document.createElement('button');
  closeButton.textContent = '화면 연습으로 돌아가기'; closeButton.type = 'button'; closeButton.hidden = true;
  Object.assign(closeButton.style, { position: 'absolute', right: '20px', top: '18px', zIndex: '2', padding: '12px 16px', background: '#18241de8', color: '#f2f2ec', border: '1px solid #b7c5ad', borderRadius: '6px', cursor: 'pointer' });
  closeButton.addEventListener('click', onClosePreview); mount.append(closeButton);
  const previewHint = document.createElement('p'); previewHint.textContent = '좌우 30°씩 · Home 정면 · Esc 닫기'; previewHint.hidden = true;
  Object.assign(previewHint.style, { position: 'absolute', left: '14px', top: '14px', maxWidth: '45%', margin: '0', padding: '8px 10px', color: '#f2f2ec', font: '12px/1.5 SUIT,sans-serif', background: '#18241de8', borderRadius: '5px', pointerEvents: 'none' }); mount.append(previewHint);
  const previewControls = document.createElement('div'); previewControls.hidden = true; previewControls.setAttribute('aria-label', '방 둘러보기 조작');
  Object.assign(previewControls.style, { position: 'absolute', left: '12px', right: '12px', bottom: '12px', display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }); mount.append(previewControls);
  function applyLook(next) { look = next; camera.rotation.set(look.pitch, look.yaw, 0, 'YXZ'); }
  function turn(direction) { if (!previewing) return; drag = null; applyLook(previewLookAfter(look, { type: 'turn', direction })); }
  function resetLook() { if (!previewing) return; drag = null; applyLook(previewLookAfter(look, { type: 'reset' })); }
  const previewButtons = [
    ['왼쪽 30°', () => turn(1)], ['정면', resetLook], ['오른쪽 30°', () => turn(-1)],
    ['드래그 켜기', () => { freeDrag = !freeDrag; drag = null; updateDragMode(); }],
  ].map(([label, action]) => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
    Object.assign(button.style, { padding: '10px 13px', background: '#18241df2', color: '#f2f2ec', border: '1px solid #b7c5ad' });
    button.addEventListener('click', action); previewControls.append(button); return { button, action };
  });
  function updateDragMode() {
    const button = previewButtons[3].button;
    button.textContent = freeDrag ? '드래그 끄기' : '드래그 켜기'; button.setAttribute('aria-pressed', String(freeDrag));
    renderer.domElement.style.cursor = freeDrag ? 'grab' : 'default';
    renderer.domElement.setAttribute('aria-label', freeDrag ? '실사 면접실 · 천천히 드래그하여 둘러보기' : '실사 면접실 · 좌우 버튼으로 30도씩 둘러보기');
  }
  function resizePreview() {
    if (!previewing) return;
    const rect = mount.getBoundingClientRect();
    // The inset preview has a border. Match the canvas content box instead of
    // using the larger outside rectangle, which would stretch the room.
    const width = Math.max(1, mount.clientWidth || rect.width || innerWidth), height = Math.max(1, mount.clientHeight || rect.height || innerHeight);
    renderer.setSize(width, height, false); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
    camera.aspect = width / height; camera.updateProjectionMatrix();
  }
  const down = (event) => { if (!previewing || event.button !== 0) return; drag = { id: event.pointerId, x: event.clientX, y: event.clientY, ...look, moved: false }; renderer.domElement.setPointerCapture?.(event.pointerId); };
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
    const hit = raycaster.intersectObject(hud, false)[0], action = pickStrictVRControl(hit?.uv, getState());
    if (action === 'exit') onClosePreview(); else if (action) onAction(action);
  };
  const cancelDrag = () => { drag = null; };
  const keydown = (event) => {
    if (!previewing) return;
    if (event.key === 'Escape') { onClosePreview(); return; }
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName) || event.target?.isContentEditable) return;
    if (!['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) return;
    event.preventDefault(); if (event.repeat) return;
    if (event.key === 'Home') resetLook(); else turn(event.key === 'ArrowLeft' ? 1 : -1);
  };
  renderer.domElement.style.touchAction = 'none';
  renderer.domElement.addEventListener('pointerdown', down); renderer.domElement.addEventListener('pointermove', move); renderer.domElement.addEventListener('pointerup', up); renderer.domElement.addEventListener('pointercancel', cancelDrag);
  window.addEventListener('resize', resizePreview); window.addEventListener('keydown', keydown);
  const controllerRecords = [0, 1].map((index) => {
    const controller = renderer.xr.getController(index);
    const line = new THREE.Line(pointerGeometry, pointerMaterial);
    line.scale.z = 4; controller.add(line); scene.add(controller);
    const select = () => {
      const now = performance.now();
      if (!running || now - lastSelect < 250) return;
      rotation.identity().extractRotation(controller.matrixWorld);
      raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
      raycaster.ray.direction.set(0, 0, -1).applyMatrix4(rotation);
      const hit = raycaster.intersectObject(hud, false)[0];
      const action = pickStrictVRControl(hit?.uv, getState());
      if (action) { lastSelect = now; onAction(action); }
    };
    controller.addEventListener('select', select);
    return { controller, line, select };
  });

  function lines(text, x, y, maxWidth, lineHeight, maxLines) {
    let line = '', lineNumber = 0;
    for (const character of String(text || '')) {
      if (context.measureText(line + character).width > maxWidth) {
        context.fillText(line, x, y + lineNumber * lineHeight);
        line = ''; lineNumber++;
        if (lineNumber >= maxLines) return;
      }
      line += character;
    }
    if (lineNumber < maxLines) context.fillText(line, x, y + lineNumber * lineHeight);
  }
  function drawHUD(state) {
    const seconds = Number.isFinite(state.remainingSeconds) ? Math.max(0, Math.ceil(state.remainingSeconds)) : null;
    const micLevel = Math.round(Math.max(0, Math.min(1, Number(state.micLevel) || 0)) * 8) / 8;
    const answerQuote = String(state.branch?.evidence?.quote || '');
    const key = JSON.stringify([state.phase, state.question, state.transcript, state.reviewPrompt, state.clarificationPrompt, answerQuote, seconds, state.paused, state.canStart, state.canSubmit, state.canConfirm, state.reviewPage, state.settling, state.micActive, micLevel, state.automaticEnd]);
    if (key === lastHUDKey) return;
    lastHUDKey = key;
    context.fillStyle = '#e8e7e2'; context.fillRect(0, 0, HUD_WIDTH, HUD_HEIGHT);
    context.textAlign = 'left'; context.textBaseline = 'top';
    context.fillStyle = '#555653'; context.font = '500 28px SUIT, sans-serif';
    const status = state.paused ? '일시정지 · 마이크 꺼짐'
      : state.phase === 'confirming' ? `애매한 부분 확인 · ${(state.reviewPage || 0) + 1}/${state.reviewPages?.length || 1} · 마이크 꺼짐`
      : state.phase === 'reviewing' ? '면접관이 답변을 검토하고 있습니다'
      : state.phase === 'repair' ? '답변을 확인하지 못했습니다'
      : state.canSubmit ? `답변 중${seconds === null ? '' : ` · ${seconds}초`}`
      : state.settling ? '자리에 앉아 정면을 바라보세요'
      : state.canStart ? '면접 준비' : '질문을 듣는 중';
    context.fillText(status, 36, 22);
    if (state.micActive) {
      context.fillStyle = '#b9bdb0'; context.fillRect(1320, 24, 160, 15);
      context.fillStyle = '#526847'; context.fillRect(1320, 24, Math.max(4, 160 * micLevel), 15);
    }
    context.fillStyle = '#252a22'; context.font = '500 36px SUIT, sans-serif';
    lines(state.phase === 'confirming' ? state.reviewPages?.[state.reviewPage || 0] || state.transcript : state.clarificationPrompt || state.question || '세 면접관의 질문에 소리 내어 답변하세요.', 36, 70, 1460, 46, state.phase === 'confirming' ? 4 : 2);
    context.fillStyle = '#575c51'; context.font = '400 29px SUIT, sans-serif';
    const transcript = String(state.transcript || '');
    const answerContext = answerQuote && ['reviewing', 'followup'].includes(state.phase) ? `첫 답변: “${answerQuote.slice(0, 100)}”` : '';
    if (state.phase !== 'confirming') lines(state.phase === 'repair' ? '다시 답변하거나 질문을 다시 들으세요.' : answerContext || (transcript ? `인식: ${transcript.slice(-120)}` : state.canSubmit ? state.automaticEnd ? '답변을 마치면 이어집니다. 애매한 부분만 확인합니다.' : '답변을 마치면 아래에서 완료하세요.' : '선택 버튼으로 시작합니다.'), 36, 184, 1460, 38, 2);
    else { context.font = '400 24px SUIT, sans-serif'; context.fillText(state.reviewPrompt || '틀리면 이 부분만 다시 말하세요. 나머지 답변은 유지됩니다.', 36, 266, 1460); }
    for (const control of getStrictVRControls(state)) {
      context.fillStyle = control.enabled ? '#cecfca' : '#deded8';
      context.fillRect(control.x, control.y, control.w, control.h);
      context.fillStyle = control.enabled ? '#252d20' : '#999d8e';
      context.font = '500 30px SUIT, sans-serif'; context.textAlign = 'center';
      context.fillText(control.label, control.x + control.w / 2, control.y + 18, control.w - 24);
    }
    context.textAlign = 'left'; hudTexture.needsUpdate = true;
  }
  function frame(time, xrFrame) {
    if (!running) return;
    if (firstFrame && !previewing) {
      // XRViewerPose is the centre of the eyes; getCamera() can still contain
      // the first eye's transform at this point in Three's first XR frame.
      const referenceSpace = renderer.xr.getReferenceSpace();
      const initial = referenceSpace && seatedAnchorFromPose(xrFrame?.getViewerPose(referenceSpace));
      if (!initial) return;
      anchor.position.set(initial.x, initial.y, initial.z); anchor.rotation.set(0, initial.yaw, 0);
      anchor.visible = true; firstFrame = false;
    }
    const state = getState(); room.update(getFrameState() || [], state);
    drawHUD(state);
    renderer.render(scene, camera);
  }
  const stage = {
    renderer,
    async warmVideoFrames() {
      if (stageDisposed) return false;
      const revision = ++videoWarmupRevision;
      try {
        if (!await room.warmVideoFrames(renderer, getFrameState() || [])) return false;
        if (stageDisposed || revision !== videoWarmupRevision) return false;
        // Three.compile traverses hidden meshes too. Keep their visibility
        // unchanged while compiling the now-bound VideoTexture shader variant.
        await renderer.compileAsync?.(scene, camera);
        return !stageDisposed && revision === videoWarmupRevision;
      } catch (error) {
        if (stageDisposed || revision !== videoWarmupRevision) return false;
        throw error;
      }
    },
    start() { previewing = false; closeButton.hidden = previewHint.hidden = previewControls.hidden = true; firstFrame = true; anchor.visible = false; lastHUDKey = ''; running = true; renderer.setAnimationLoop(frame); },
    startPreview() {
      previewing = true; firstFrame = false; lastHUDKey = ''; running = true; freeDrag = false; anchor.visible = true; anchor.position.set(0, 0, 0); anchor.rotation.set(0, 0, 0); camera.position.set(0, 0, 0); camera.fov = PREVIEW_COMFORT.fov; applyLook({ yaw: 0, pitch: 0 }); updateDragMode();
      closeButton.hidden = previewHint.hidden = previewControls.hidden = false; resizePreview(); renderer.setAnimationLoop(frame);
      renderer.domElement.focus({ preventScroll: true });
    },
    stopPreview() { videoWarmupRevision++; previewing = false; closeButton.hidden = previewHint.hidden = previewControls.hidden = true; drag = null; running = false; renderer.setAnimationLoop(null); room.update([], {}); },
    stop() { videoWarmupRevision++; running = false; renderer.setAnimationLoop(null); room.update([], {}); },
    dispose() {
      if (stageDisposed) return;
      stageDisposed = true; videoWarmupRevision++;
      running = false; renderer.setAnimationLoop(null);
      controllerRecords.forEach(({ controller, line, select }) => { controller.removeEventListener('select', select); controller.remove(line); scene.remove(controller); });
      renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('pointermove', move); renderer.domElement.removeEventListener('pointerup', up); renderer.domElement.removeEventListener('pointercancel', cancelDrag);
      window.removeEventListener('resize', resizePreview); window.removeEventListener('keydown', keydown); closeButton.removeEventListener('click', onClosePreview); closeButton.remove(); previewHint.remove();
      previewButtons.forEach(({ button, action }) => button.removeEventListener('click', action)); previewControls.remove();
      room.dispose(); hudGeometry.dispose(); hudMaterial.dispose(); hudTexture.dispose(); pointerGeometry.dispose(); pointerMaterial.dispose();
      renderer.dispose(); renderer.domElement.remove();
    },
  };
  try {
    // Finish static texture uploads before XR entry instead of blocking the
    // first tracked frame. The room queues one upload per browser frame.
    await room.warmTextures?.(renderer);
    room.update([], { phase: 'idle' });
    await renderer.compileAsync?.(scene, camera);
  } catch (error) { stage.dispose(); throw error; }
  return stage;
}

export function createStrictVR({ mount, getFrameState = () => [], getState = () => ({}), onAction = () => {}, onExit = () => {}, onStatus = () => {} }, dependencies = {}) {
  const xr = dependencies.xr ?? globalThis.navigator?.xr;
  const secure = dependencies.secure ?? globalThis.isSecureContext;
  const createStage = dependencies.createStage || buildStage;
  let stage = null, session = null, pending = false, disposed = false, checkTask = null, requestTicket = 0, finishSession = null, stageTask = null, supported = null, previewing = false, previewStyle = '', previewRequest = 0, bodyOverflow = '', previewFocus = null;
  if (mount) mount.hidden = true;
  const emit = (status, message) => { if (!disposed) onStatus({ status, message }); };
  function act(action) {
    if (action === 'exit') { void exit(); return; }
    try { Promise.resolve(onAction(action)).catch(() => emit('active', '조작을 완료하지 못했습니다. 일시정지 후 다시 시도해 주세요.')); }
    catch { emit('active', '조작을 완료하지 못했습니다. 일시정지 후 다시 시도해 주세요.'); }
  }
  async function ensureStage() {
    if (stage) return stage;
    if (stageTask) return stageTask;
    stageTask = (async () => {
      const prepared = await createStage({ mount, getFrameState, getState, onAction: act, onClosePreview: closePreview });
      if (disposed) { prepared.dispose(); return null; }
      stage = prepared; return stage;
    })().finally(() => { stageTask = null; });
    return stageTask;
  }
  async function check() {
    if (disposed) return false;
    if (stage && supported === true) return true;
    if (checkTask) return checkTask;
    if (!secure || !xr?.isSessionSupported || !xr?.requestSession) { emit('unsupported', 'PC에서는 화면으로 연습할 수 있습니다. VR은 Quest의 HTTPS 환경에서 지원 여부를 확인합니다.'); return false; }
    checkTask = (async () => {
      try {
        supported = await xr.isSessionSupported('immersive-vr');
        if (!supported) { emit('unsupported', '이 브라우저에서 VR 기기를 찾지 못했습니다. 화면에서 방을 둘러볼 수 있습니다.'); return false; }
        if (!await ensureStage() || disposed) return false;
        emit('ready', 'VR 사용 가능 · 주변 방은 공간 기하, 면접관은 원본 단안 영상으로 표현합니다.');
        return true;
      } catch { emit('unsupported', 'VR 화면을 준비하지 못했습니다. 화면에서 면접을 이어갈 수 있습니다.'); return false; }
      finally { checkTask = null; }
    })();
    return checkTask;
  }
  async function enter() {
    if (disposed || pending || session) return false;
    const gate = getStrictVRGate(getState());
    if (gate) { emit('ready', gate); return false; }
    if (!stage || !supported || !secure || !xr?.requestSession) { emit('unsupported', 'VR 준비가 끝난 뒤 다시 시도해 주세요. 화면 연습은 사용할 수 있습니다.'); return false; }
    closePreview();
    pending = true;
    const ticket = ++requestTicket;
    let requested;
    emit('starting', 'VR을 연결합니다. 앉은 상태에서 정면을 바라보세요.');
    try {
      // Keep requestSession on the original click/select activation, before any await.
      requested = await xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] });
      if (disposed || ticket !== requestTicket) { await requested.end(); return false; }
      session = requested;
      const visibility = () => { if (session === requested && requested.visibilityState !== 'visible') act('pause'); };
      requested.addEventListener('visibilitychange', visibility);
      const finish = () => {
        requested.removeEventListener('visibilitychange', visibility);
        if (session !== requested) return;
        session = null; finishSession = null; stage?.stop(); if (mount) mount.hidden = true;
        try { Promise.resolve(onExit()).catch(() => {}); } catch {}
        emit('ready', 'VR을 종료했습니다. 연습과 마이크가 일시정지됩니다.');
      };
      finishSession = finish;
      requested.addEventListener('end', finish, { once: true });
      await stage.renderer.xr.setSession(requested);
      if (disposed || session !== requested || ticket !== requestTicket) { try { await requested.end(); } catch {} return false; }
      if (mount) mount.hidden = false;
      stage.start(); emit('active', '좌석 주변을 둘러볼 수 있습니다. 책상 위 안내판을 컨트롤러로 선택하세요.');
      return true;
    } catch {
      if (requested) { try { await requested.end(); } catch {} }
      if (session === requested) finishSession?.();
      emit('ready', 'VR을 시작하지 못했습니다. 기기 연결과 브라우저 권한을 확인해 주세요.');
      return false;
    } finally { pending = false; }
  }
  async function exit() {
    requestTicket++;
    if (previewing) { closePreview(); return; }
    if (session) { try { await session.end(); } catch { act('pause'); emit('active', '연습을 일시정지했습니다. 기기의 VR 종료 버튼으로 나가 주세요.'); } }
  }
  async function preview() {
    if (disposed || session || pending) return false;
    if (previewing) return true;
    const ticket = ++previewRequest;
    emit('preview-loading', '좌석 주변 공간을 준비하고 있습니다.');
    try {
      const prepared = await ensureStage();
      if (!prepared || disposed || ticket !== previewRequest || session || pending) return false;
      previewing = true;
      previewFocus = globalThis.document?.activeElement || null;
      if (globalThis.document?.body) { bodyOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
      if (mount) {
        previewStyle = mount.style?.cssText || '';
        if (mount.style) Object.assign(mount.style, { position: 'fixed', inset: 'auto', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '92vw', maxWidth: '1240px', height: '80dvh', maxHeight: '820px', zIndex: '100', overflow: 'hidden', background: '#bec2bb', border: '8px solid #101512', borderRadius: '8px', boxShadow: '0 0 0 100vmax #08100bbb' });
        mount.hidden = false; mount.setAttribute?.('aria-hidden', 'false');
      }
      prepared.startPreview();
      emit('preview', '좌우 버튼으로 30도씩 둘러보세요. 정면으로 바로 돌아올 수 있습니다.'); return true;
    } catch { closePreview(); emit('unsupported', '방 미리보기를 준비하지 못했습니다. 기존 화면으로 연습할 수 있습니다.'); return false; }
  }
  function closePreview() {
    previewRequest++;
    if (!previewing) return;
    previewing = false; stage?.stopPreview();
    if (globalThis.document?.body) document.body.style.overflow = bodyOverflow;
    if (mount) { mount.hidden = true; if (mount.style) mount.style.cssText = previewStyle; mount.setAttribute?.('aria-hidden', 'true'); }
    previewFocus?.focus?.({ preventScroll: true }); previewFocus = null;
    emit(supported ? 'ready' : 'unsupported', supported ? 'VR 사용 가능 · 음성 입력을 준비한 뒤 들어가세요.' : '화면에서 면접을 계속할 수 있습니다.');
  }
  async function dispose() {
    if (disposed) return;
    disposed = true; closePreview(); await exit(); finishSession?.(); stage?.dispose(); stage = null;
    if (mount) mount.hidden = true;
  }
  async function warmVideoFrames() {
    // A flat-screen rehearsal must not allocate a 3D room just to warm video.
    // check()/preview() own stage preparation; an in-flight stage is skipped.
    const prepared = stage;
    if (disposed || !prepared?.warmVideoFrames) return false;
    try {
      const warmed = await prepared.warmVideoFrames();
      return !disposed && stage === prepared && warmed === true;
    } catch (error) {
      if (disposed || stage !== prepared) return false;
      throw error;
    }
  }
  async function prepareRoom() {
    if (disposed) return false;
    try { return !!await ensureStage(); }
    catch { emit('unsupported', '방 둘러보기를 준비하지 못했습니다. 화면에서 연습할 수 있습니다.'); return false; }
  }
  return Object.freeze({ check, enter, exit, preview, closePreview, warmVideoFrames, prepareRoom, dispose, get active() { return !!session; }, get pending() { return pending; }, get previewing() { return previewing; } });
}
