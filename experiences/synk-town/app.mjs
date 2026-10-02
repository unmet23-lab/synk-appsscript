// This renderer consumes only the loopback preview service. It never grants
// account access, awards inventory, or infers TOPIK proficiency in the browser.
const $ = id => document.getElementById(id);
const nodes = {
  guest: $('actor-guest'), owner: $('actor-owner'), tea: $('actor-tea'),
};
const seats = { garden: { x: 65, y: 64 }, 'garden-right': { x: 78, y: 68 },
  'eaves-left': { x: 25, y: 54 }, 'eaves-right': { x: 39, y: 54 } };
const signSlots = { 'entrance-left': { x: 15, y: 72 }, 'entrance-right': { x: 42, y: 82 } };
const stepDescriptions = {
  'guest-walk-sign': '손님이 안내판으로 걸어와요.',
  'guest-read-sign': '손님이 안내판의 그림을 봐요.',
  'guest-follow-sign': '손님이 그림을 보고 자리로 걸어와요.',
  'guest-walk': '손님이 선택한 자리로 걸어와요.',
  'guest-sit': '손님이 의자에 앉고 있어요.',
  'owner-serve': '손님은 앉아 있고, 주인이 차를 가져와요.',
  'tea-place': '주인이 잔을 내려놓아요.',
};
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let snapshot = null, busy = false, generation = 0, animationFrame = null;
let assetsReady = false, activePlan = null, animationElapsed = 0;
let routeHelpVisible = false;
let presentationComplete = false;

function place(element, point) {
  if (!element || !Number.isFinite(point?.x) || !Number.isFinite(point?.y)) throw new Error('장면의 자리를 확인할 수 없어요.');
  element.style.left = `${point.x}%`; element.style.top = `${point.y}%`;
}
function actor(name, value) {
  const element = nodes[name];
  if (!element || !value) throw new Error('주민의 모습을 확인할 수 없어요.');
  place(element, value); element.dataset.pose = value.pose;
  element.hidden = value.pose === 'hidden';
  if (name === 'guest') $('guest-bubble').hidden = value.pose !== 'seated';
}
function sceneVisible() {
  if (document.hidden || $('info-dialog').open) return false;
  const rect = $('scene').getBoundingClientRect(), dialogue = $('dialogue').getBoundingClientRect();
  // The essential scene and authored reaction must both be on screen for a
  // delivery receipt. Merely setting DOM styles off screen is not a delivery.
  return rect.bottom > 0 && rect.top >= -rect.height * .2 && rect.right > 0 && rect.left < innerWidth
    && dialogue.bottom <= innerHeight && dialogue.top >= 0;
}
function cancelPresentation() {
  generation++; activePlan = null; presentationComplete = false;
  if (animationFrame !== null) cancelAnimationFrame(animationFrame);
  animationFrame = null;
}
function setBusy(value) {
  busy = value;
  for (const button of document.querySelectorAll('#actions button,.review-actions button')) button.disabled = value;
}
function showError(message) {
  $('error').textContent = message; $('error').hidden = false;
  $('retry-button').hidden = false; $('save-status').textContent = '기록을 다시 확인해 주세요.';
}
function clearError() { $('error').hidden = true; $('retry-button').hidden = true; }
function buttonFor(action) {
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'felt-button'; button.dataset.command = action.type;
  if (['CRAFT', 'PLACE', 'NEXT', 'SIGN_PLACE'].includes(action.type)
    || action.type === 'SIGN_NEXT' && snapshot.state.phase === 'sign-intro') button.classList.add('primary');
  const signChoice = snapshot.view.scene.signPreview || {
    picture: snapshot.state.sign?.draftPicture, slot: snapshot.state.sign?.draftSlot,
  };
  const selected = action.type === 'COLOR' && action.payload.color === snapshot.state.color
    || action.type === 'PREVIEW_SLOT' && action.payload.slot === snapshot.state.previewSlot
    || action.type === 'SIGN_PICTURE' && action.payload.picture === signChoice?.picture
    || action.type === 'SIGN_PREVIEW' && action.payload.slot === signChoice?.slot;
  if (selected) button.classList.add('selected');
  if (['COLOR', 'PREVIEW_SLOT', 'SIGN_PICTURE', 'SIGN_PREVIEW'].includes(action.type)) button.setAttribute('aria-pressed', String(selected));
  if (['CHOOSE', 'SIGN_PICTURE'].includes(action.type)) {
    const img = document.createElement('img'); img.alt = ''; img.className = 'button-icon';
    img.src = action.payload.picture === 'tea' ? './assets/material/coffee-open.webp' : './assets/material/chair.webp'; button.append(img);
  }
  const label = document.createElement('span'); label.textContent = action.label; button.append(label);
  button.addEventListener('click', () => command(action.type, action.payload));
  return button;
}
function renderSign(element, model) {
  const point = model && signSlots[model.slot];
  element.hidden = !point;
  if (!point) return;
  place(element, point);
  const picture = element.querySelector('.sign-picture');
  picture.src = model.picture === 'tea' ? './assets/material/coffee-open.webp' : './assets/material/chair.webp';
  picture.alt = model.picture === 'tea' ? '차 그림 안내판' : '의자 그림 안내판';
  const target = seats[model.target], arrow = element.querySelector('.sign-arrow');
  arrow.hidden = !model.active || !target;
  element.dataset.active = String(!!model.active);
  if (!arrow.hidden) {
    // Percent coordinates must be converted with the actual scene aspect ratio.
    const sceneRect = $('scene').getBoundingClientRect(), rect = arrow.getBoundingClientRect();
    const dx = sceneRect.left + sceneRect.width * target.x / 100 - (rect.left + rect.width / 2);
    const dy = sceneRect.top + sceneRect.height * target.y / 100 - (rect.top + rect.height / 2);
    arrow.style.setProperty('--arrow-angle', `${Math.atan2(dy, dx)}rad`);
  }
}
function renderSigns() {
  if (!snapshot) return;
  const { sign, signPreview } = snapshot.view.scene;
  renderSign($('sign-board'), sign); renderSign($('sign-preview'), signPreview);
  // A preview in the same slot covers the old board; its stored state is untouched.
  if (sign && signPreview?.slot === sign.slot) $('sign-board').hidden = true;
  $('sign-board').querySelector('.sign-label').hidden = !signPreview;
  const guide = signPreview || sign, target = guide && seats[guide.target], start = guide && signSlots[guide.slot];
  const available = !!(guide?.active && start && target);
  $('route-help-button').hidden = !available;
  $('route-help-button').textContent = routeHelpVisible ? '길 숨기기' : '길 보기';
  $('route-help-button').setAttribute('aria-pressed', String(routeHelpVisible));
  $('sign-route').toggleAttribute('hidden', !available || !routeHelpVisible);
  $('sign-route-path').setAttribute('d', available ? `M ${start.x} ${start.y} L ${target.x} ${target.y}` : '');
}
function describeScene(activityText) {
  const scene = snapshot.view.scene;
  const location = scene.placement
    ? `${scene.placement.startsWith('eaves') ? '찻집 안쪽' : '바깥 지붕 아래'} 자리.`
    : '찻집 안쪽의 기본 의자와 바깥의 빈 자리.';
  const sign = scene.sign?.active
    ? `입구 ${scene.sign.slot === 'entrance-left' ? '왼쪽' : '오른쪽'}의 ${scene.sign.picture === 'tea' ? '차' : '의자'} 그림 안내판이 이 자리를 가리켜요.` : '';
  const description = [location, activityText, sign].filter(Boolean).join(' ');
  if ($('scene').getAttribute('aria-label') !== description) $('scene').setAttribute('aria-label', description);
}
function renderScene({ preserveActors = false } = {}) {
  const { state, view } = snapshot, scene = view.scene;
  const seat = seats[scene.placement] || seats['eaves-left'];
  place($('chair'), seat);
  $('canopy').hidden = !scene.canopyPlaced; $('canopy').dataset.color = scene.color;
  place($('canopy'), seat);
  const preview = scene.previewSlot || (state.phase === 'outside-preview' || state.phase === 'color' ? 'garden'
    : state.phase === 'inside-preview' ? 'eaves-left' : null);
  $('placement-ghost').hidden = !preview;
  if (preview && seats[preview]) place($('placement-ghost'), seats[preview]);
  $('canopy-preview').hidden = !preview || !['outside-preview', 'color', 'place'].includes(state.phase) || state.branch !== 'outside';
  $('canopy-preview').dataset.color = scene.color;
  if (preview && seats[preview]) place($('canopy-preview'), seats[preview]);
  const beside = { x: seat.x + 8, y: seat.y - 1 };
  place($('tea-table'), beside);
  if (!preserveActors) {
    $('tea-table').hidden = !scene.teaPlaced;
    actor('guest', scene.guestSeated ? { ...seat, pose: 'seated' } : { x: 15, y: 80, pose: 'idle' });
    actor('owner', scene.teaPlaced ? { x: Math.min(90, seat.x + 16), y: seat.y + 2, pose: 'serving' } : { x: 42, y: 60, pose: 'idle' });
    actor('tea', { ...beside, pose: scene.teaPlaced ? 'placed' : 'hidden' });
  }
  $('guest-bubble').textContent = view.planKind === 'sign' || state.activity === 'sign' ? '여기네요' : '편해요';
  if (!preserveActors) $('guest-bubble').hidden = true;
  renderSigns();
  const inside = scene.placement?.startsWith('eaves');
  if (!preserveActors) $('scene-caption').textContent = state.phase === 'away' ? '자리는 그대로 기다리고 있어요.'
    : state.phase === 'sign-place' ? '놓기 전에 먼저 봐요.'
      : state.activity === 'sign' && scene.sign?.active ? '이 그림이 내 자리를 알려 줘요.'
        : scene.resting ? '잠깐, 함께 쉬어요.' : scene.placement
      ? inside ? '의자가 안으로 왔어요.' : '함께 만든 자리가 있어요.'
      : state.canopyOwned ? '지붕은 내 보관함에 있어요.' : '작은 자리가 기다리고 있어요.';
  if (!preserveActors) describeScene(view.plan && !presentationComplete
    ? view.planKind === 'sign' ? '손님이 안내판으로 걸어와요.' : '손님이 선택한 자리로 걸어와요.'
    : scene.guestSeated ? '손님이 앉아 차를 마셔요.' : '');
}
function render(data) {
  const keepPresentation = activePlan && data.view.plan?.id === activePlan.id
    && data.state.worldRevision === activePlan.revision
    && (data.state.activity || 'seat') === (snapshot?.state.activity || 'seat');
  if (!keepPresentation) cancelPresentation();
  snapshot = data;
  const { state, view } = data;
  $('scope-label').textContent = view.scopeLabel;
  $('speaker').textContent = view.speaker;
  $('dialogue').textContent = view.plan && !presentationComplete ? view.presentationLine || view.line : view.line;
  $('scene-title').textContent = state.activity === 'sign' ? '이 자리로 오세요' : '어디에서 쉴까요?';
  $('visit-label').textContent = state.visit === 1 ? '첫 방문' : `${state.visit}번째 방문`;
  $('actions').replaceChildren(...view.actions.map(buttonFor));
  $('remove-button').hidden = !view.scene.canopyPlaced || !['ready', 'place'].includes(state.phase);
  $('visit-button').hidden = state.phase !== 'away';
  $('craft-recipe').hidden = state.phase !== 'color' || !state.color;
  const inventory = $('material-summary'); inventory.replaceChildren();
  inventory.hidden = !['outside-preview', 'color', 'place'].includes(state.phase) && !state.inventory.canopy;
  const entries = [['나무', state.inventory.wood], ['천', state.inventory.cloth], ['내 지붕', state.inventory.canopy]];
  for (const [label, value] of entries) {
    if (!value && label === '내 지붕') continue;
    const span = document.createElement('span'); span.className = 'material'; span.textContent = `${label} ${value}`; inventory.append(span);
  }
  $('save-status').textContent = '이 기기의 가상 기록에 저장돼요.';
  renderScene({ preserveActors: !!keepPresentation }); setBusy(busy);
  if (view.plan && view.reaction && !keepPresentation) present(view.plan);
}
async function command(type, payload = {}) {
  if (busy || !snapshot) return;
  setBusy(true); clearError(); $('save-status').textContent = '기록을 확인하고 있어요…';
  const request = { id: crypto.randomUUID(), type, payload, expectedRevision: snapshot.state.revision };
  try {
    const response = await fetch('/api/preview/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request), cache: 'no-store' });
    const data = await response.json();
    if (data.state && data.view) render(data);
    if (!response.ok || data.error) throw new Error(data.message || '기록을 저장하지 못했어요. 다시 확인해요.');
  } catch (error) {
    cancelPresentation(); showError(error.message || '연결이 잠깐 끊겼어요. 기록을 다시 확인해요.');
  } finally { setBusy(false); }
}
async function load() {
  if (busy) return;
  setBusy(true); clearError();
  try {
    const response = await fetch('/api/preview/state', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || !data.state || !data.view) throw new Error(data.message || '가상 기록을 불러오지 못했어요.');
    render(data);
  } catch (error) { cancelPresentation(); showError(error.message); }
  finally { setBusy(false); }
}
function present(rawPlan) {
  const mine = generation;
  let plan;
  try { plan = globalThis.LoomLife.createPlan(rawPlan); }
  catch { showError('이용 장면을 준비하지 못했어요. 기록을 다시 확인해요.'); return; }
  activePlan = plan; animationElapsed = 0; presentationComplete = false;
  const clock = globalThis.LoomMotion.createClock();
  const reaction = { ...snapshot.view.reaction };
  const planKind = snapshot.view.planKind || 'tea', activity = snapshot.state.activity || 'seat';
  const applied = new Set(); let endFrameSeen = false, acknowledgementSent = false, completionAt = null;
  function frame(now) {
    if (mine !== generation || !snapshot || snapshot.view.plan?.id !== plan.id
      || snapshot.state.worldRevision !== plan.revision || (snapshot.state.activity || 'seat') !== activity) return;
    const visible = sceneVisible();
    animationElapsed = globalThis.LoomMotion.stepClock(clock, now, {
      hidden: document.hidden, paused: !visible || !assetsReady || busy,
    }).time * 1000;
    const context = { currentRevision: snapshot.state.worldRevision, currentPlanId: snapshot.view.plan.id,
      committedStepIds: snapshot.view.committedStepIds, reducedMotion: reduced.matches };
    const sample = globalThis.LoomLife.sample(plan, animationElapsed, context);
    if (sample.status !== 'ready') return;
    try {
      for (const [name, value] of Object.entries(sample.actors)) actor(name, value);
      // The same cup is visibly carried by the owner before its placement step.
      if (planKind === 'tea' && sample.actors.owner?.pose === 'carrying' && sample.actors.tea?.pose === 'hidden') {
        actor('tea', { x: sample.actors.owner.x + 3, y: sample.actors.owner.y - 7, pose: 'carried' });
      }
      if (planKind === 'tea') $('tea-table').hidden = !sample.visualStepIds.includes('owner-serve');
      presentationComplete = sample.visualComplete;
      const line = presentationComplete ? snapshot.view.line
        : snapshot.view.presentationLine || snapshot.view.line;
      if ($('dialogue').textContent !== line) $('dialogue').textContent = line;
      describeScene(sample.visualComplete
        ? planKind === 'sign' ? '손님이 그림을 보고 자리에 앉았어요.' : '손님이 앉아 차를 마셔요.'
        : stepDescriptions[sample.activeStepId]);
      $('scene-caption').textContent = planKind === 'sign'
        ? sample.visualComplete ? '그림을 보고 자리에 왔어요.'
          : sample.activeStepId === 'guest-read-sign' ? '손님이 그림을 봐요.'
            : sample.visualStepIds.includes('guest-read-sign') ? '내 자리로 걸어와요.' : '손님이 안내판으로 와요.'
        : sample.visualComplete ? '고른 자리에서 쉬고 있어요.' : '손님이 자리를 보러 와요.';
      if (visible && assetsReady) for (const id of sample.visualStepIds) applied.add(id);
      if (sample.visualComplete && visible && assetsReady && completionAt === null) completionAt = animationElapsed;
    } catch (error) { showError(error.message); return; }
    // A static alternative must leave the same authored line on screen long
    // enough to notice it, rather than replacing it after two animation frames.
    const canAck = animationElapsed >= 2400 && completionAt !== null && animationElapsed - completionAt >= 1200
      && sample.visualComplete && globalThis.LoomLife.canAcknowledge(plan, {
      ...context, visible, hidden: document.hidden, paused: busy, assetsReady,
      appliedStepIds: [...applied],
    });
    if (canAck && endFrameSeen && !acknowledgementSent) {
      acknowledgementSent = true; animationFrame = null;
      command('ACK', { reactionId: reaction.id, semanticKey: reaction.semanticKey,
        activity,
        worldRevision: snapshot.state.worldRevision, mode: reduced.matches ? 'static' : 'motion',
        appliedStepIds: [...applied], visible: true, assetsReady: true });
      return;
    }
    // One complete, visible frame must have been painted before the ACK request.
    endFrameSeen = canAck;
    animationFrame = requestAnimationFrame(frame);
  }
  animationFrame = requestAnimationFrame(frame);
}
function openInfo(title, paragraphs) {
  $('info-title').textContent = title; $('info-content').replaceChildren();
  for (const text of paragraphs) { const p = document.createElement('p'); p.textContent = text; $('info-content').append(p); }
  $('info-dialog').showModal();
}
$('help-button').addEventListener('click', () => openInfo('천천히 해도 괜찮아요', snapshot?.state.activity === 'sign' ? [
  '의자나 차 그림을 골라요. 둘 다 좋아요.', '안내판을 왼쪽이나 오른쪽에 먼저 놓아 봐요. 마음에 들면 놓아요.',
  '길 보기를 누르면 안내판에서 자리로 가는 길이 보여요. 도움을 봐도 결과는 같아요.',
] : [
  '안이나 밖을 골라요. 먼저 보고, 마음에 들면 놓아요.', '밖에는 작은 지붕을 만들어요. 안은 의자만 옮겨요.',
  '나중에 해도 괜찮아요. 도움을 봐도 만든 자리와 함께한 일은 그대로예요.',
]));
$('meaning-button').addEventListener('click', () => openInfo('뜻 보기', snapshot?.state.activity === 'sign'
  ? ['안내판: 어디로 가는지 알려 주는 그림이에요.', '왼쪽과 오른쪽: 안내판을 놓을 두 자리예요.', '화살표: 내가 만든 자리 쪽을 가리켜요.']
  : ['안: 찻집 지붕 아래예요.', '밖: 찻집 앞의 빈 자리예요.', '옮기기: 같은 물건의 자리를 바꿔요.']));
$('route-help-button').addEventListener('click', () => { routeHelpVisible = !routeHelpVisible; renderSigns(); });
$('notebook-button').addEventListener('click', () => openInfo('함께한 일', snapshot?.view.notebook?.length
  ? snapshot.view.notebook : ['아직 함께한 일이 없어요. 천천히 둘러봐요.']));
$('close-dialog').addEventListener('click', () => $('info-dialog').close());
$('retry-button').addEventListener('click', async () => {
  try { if (!assetsReady) await prepareAssets(); await load(); } catch (error) { showError(error.message); }
});
$('visit-button').addEventListener('click', () => command('VISIT'));
$('remove-button').addEventListener('click', () => command('REMOVE'));
$('reset-button').addEventListener('click', () => {
  if (confirm('이 개발 체험의 가상 기록을 처음부터 다시 시작할까요?')) command('RESET');
});
document.addEventListener('visibilitychange', () => { if (document.hidden) $('guest-bubble').hidden = true; });
addEventListener('pagehide', cancelPresentation);
addEventListener('pageshow', event => { if (event.persisted) load(); });
addEventListener('resize', renderSigns);

async function prepareAssets() {
  const imageSources = new Set([...document.images].map(image => image.src));
  for (const path of ['ui/slab-coral-long.webp', 'ui/slab-cream-long.webp', 'ui/slab-blush-long.webp', 'ui/tag-cream.webp',
    'material/wide-cream.webp', 'material/wide-butter.webp', 'material/wide-lapis.webp']) imageSources.add(new URL(`./assets/${path}`, location.href).href);
  await Promise.all([...imageSources].map(src => new Promise((resolve, reject) => {
    const image = new Image(); image.onload = () => image.decode().then(resolve, reject); image.onerror = () => reject(new Error('그림을 불러오지 못했어요.')); image.src = src;
  })));
  await document.fonts.ready; assetsReady = true;
}
if (!['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname)) {
  showError('이 개발 체험은 이 기기의 전용 서버에서만 열 수 있어요.');
} else {
  prepareAssets().then(load).catch(error => showError(error.message));
}
