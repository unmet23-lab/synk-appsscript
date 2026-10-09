// Standalone preview consumer. State, contact issuance and outcomes belong to
// the preview host; showing this panel never grants a relationship or reward.
export function mountLife({ command, actor, getSnapshot, getPresence, surfaceId, reducedMotion }) {
  const $ = id => document.getElementById(id);
  const panel = $('life-panel'), dialog = $('life-dialog'), owner = $('actor-owner'), tray = $('life-tray');
  let current = null, busy = false, available = false, actionSignature = '', openedContactId = null;
  let resultActionSignature = '';
  let ackFrame = null, observedResult = null, observationMs = 0, lastFrame = null, acknowledgementPending = false;
  let contactFrame = null, observedContact = null, contactSince = null;

  function contactHere(contact) {
    const presence = getPresence();
    return !!contact && !!presence?.owner && contact.issuedSurfaceId === surfaceId && contact.issuedFence === presence.fence;
  }
  function releaseActors() {
    delete owner.dataset.lifeActive;
    tray.hidden = true;
  }
  function stopObservation() {
    if (ackFrame !== null) cancelAnimationFrame(ackFrame);
    ackFrame = null; observedResult = null; observationMs = 0; lastFrame = null; acknowledgementPending = false;
  }
  function setBusy(value) {
    busy = value;
    for (const button of panel.querySelectorAll('button')) button.disabled = value || !available;
    for (const button of dialog.querySelectorAll('button')) button.disabled = value || !available;
    for (const button of $('life-result-actions').querySelectorAll('button')) button.disabled = value || !available;
    $('life-contact-open').disabled = value || !available;
    if (available) $('life-open').disabled = value || !current?.canStart;
  }
  function closeDetail({ save = true } = {}) {
    if (!dialog.open) return;
    dialog.close(); openedContactId = null;
    if (save && available) command('LIFE_CLOSE');
  }
  async function openDetail(source) {
    if (!available || busy) return;
    const contact = current?.contact;
    if (source === 'contact' && !contactHere(contact)) return;
    const ok = await command('LIFE_OPEN', { source, ...(source === 'contact' ? { contactId: contact.id } : {}) });
    if (!ok || !available) return;
    openedContactId = source === 'contact' ? contact.id : null;
    dialog.showModal();
    updateDialog();
  }
  function updateDialog() {
    const line = current?.interaction?.line || '';
    const actions = current?.interaction?.actions || [];
    $('life-dialog-line').textContent = line;
    const signature = JSON.stringify(actions);
    // Heartbeats must not rebuild the focused control every second.
    if (signature !== actionSignature) {
      actionSignature = signature;
      $('life-dialog-actions').replaceChildren(...actions.map(action => {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'felt-button'; button.dataset.lifeCommand = action.type;
        if (action.payload?.role) button.dataset.lifeRole = action.payload.role;
        if (action.payload?.direction) button.dataset.lifeDirection = action.payload.direction;
        button.textContent = action.label;
        button.addEventListener('click', async () => {
          if (busy) return;
          const ok = await command(action.type, action.payload || {});
          if (ok && ['LIFE_CONFIRM', 'LIFE_DECLINE', 'LIFE_DEFER', 'LIFE_REST', 'LIFE_CLOSE'].includes(action.type)) closeDetail({ save: false });
        });
        return button;
      }));
    }
    setBusy(busy);
  }
  function resultVisible() {
    if (document.hidden || busy || dialog.open || document.querySelector('dialog[open]') || !available) return false;
    const snapshot = getSnapshot();
    if (snapshot?.view.plan || snapshot?.state.phase === 'away' || $('life-result').hidden) return false;
    const scene = $('scene').getBoundingClientRect(), result = $('life-result').getBoundingClientRect();
    return scene.top >= -scene.height * .2 && scene.bottom > 0 && scene.right > 0 && scene.left < innerWidth
      && result.top >= 0 && result.bottom <= innerHeight;
  }
  function watchResult(resultId) {
    if (!resultId) { stopObservation(); return; }
    if (observedResult === resultId) return;
    stopObservation(); observedResult = resultId;
    function frame(now) {
      if (observedResult !== resultId || !available) return;
      const visible = resultVisible();
      if (visible && lastFrame !== null) observationMs += Math.min(100, Math.max(0, now - lastFrame));
      lastFrame = visible ? now : null;
      if (visible && observationMs >= 1200 && !acknowledgementPending) {
        acknowledgementPending = true; ackFrame = null;
        command('LIFE_ACK', { resultId, visible: true }).then(ok => {
          if (!ok && available && observedResult === resultId) { acknowledgementPending = false; lastFrame = null; ackFrame = requestAnimationFrame(frame); }
        });
        return;
      }
      ackFrame = requestAnimationFrame(frame);
    }
    ackFrame = requestAnimationFrame(frame);
  }
  function watchContact(contact) {
    const id = contact?.state === 'issued' && contactHere(contact) ? contact.id : null;
    if (id === observedContact) return;
    if (contactFrame !== null) cancelAnimationFrame(contactFrame);
    contactFrame = null; observedContact = id; contactSince = null;
    if (!id) return;
    function frame(now) {
      if (!available || observedContact !== id) return;
      const element = $('life-contact'), rect = element.getBoundingClientRect();
      const visible = !document.hidden && !busy && !document.querySelector('dialog[open]') && !element.hidden
        && rect.top >= 0 && rect.bottom <= innerHeight && rect.left >= 0 && rect.right <= innerWidth;
      if (!visible) contactSince = null;
      else if (contactSince === null) contactSince = now;
      if (visible && now - contactSince >= 300) {
        contactFrame = null;
        command('LIFE_ACK', { contactId: id, visible: true }).then(ok => {
          if (!ok && available && observedContact === id) { contactSince = null; contactFrame = requestAnimationFrame(frame); }
        });
        return;
      }
      contactFrame = requestAnimationFrame(frame);
    }
    contactFrame = requestAnimationFrame(frame);
  }
  function paintRoutine(routine) {
    if (!routine?.owner || !Number.isFinite(routine.owner.x) || !Number.isFinite(routine.owner.y)) { releaseActors(); return; }
    owner.dataset.lifeActive = 'true';
    owner.dataset.lifePhase = routine.phase;
    actor('owner', routine.owner);
    tray.hidden = !routine.prop || routine.prop.pose === 'hidden';
    if (!tray.hidden) {
      tray.style.left = `${routine.prop.x}%`; tray.style.top = `${routine.prop.y}%`;
      tray.dataset.state = routine.phase;
    }
    if (reducedMotion()) owner.style.setProperty('transition', 'none');
    else owner.style.removeProperty('transition');
    if (routine.line) {
      $('scene-caption').textContent = routine.line;
      const scene = $('scene');
      scene.setAttribute('aria-label', `${scene.getAttribute('aria-label') || ''} ${routine.line}`.trim());
    }
  }
  function render(snapshot, { allowActors = false } = {}) {
    available = snapshot.capabilities?.life === true && !!snapshot.view.life;
    panel.hidden = !available;
    if (!available) { invalidate(); return; }
    current = snapshot.view.life;
    for (const button of panel.querySelectorAll('[data-life-mode]')) {
      const selected = current.mode === button.dataset.lifeMode;
      button.setAttribute('aria-pressed', String(selected)); button.classList.toggle('selected', selected);
    }
    $('life-status').textContent = current.background?.line || '';
    $('life-open').textContent = current.interaction && current.interaction.stage !== 'result' ? '하던 이야기 이어가기' : '주인과 자리 이야기';
    $('life-direct-note').textContent = current.canStart ? '조용히 쉬거나, 같이 정하거나, 주인에게 맡길 수 있어요.' : '지금 하던 일을 마치면 자리 이야기를 나눌 수 있어요.';
    const hasScene = ['executing', 'result'].includes(current.interaction?.stage);
    $('life-view-scene').hidden = !hasScene;
    $('life-resume').hidden = !current.restGuard;
    if (hasScene) $('life-direct-note').textContent = current.interaction.stage === 'executing' ? '주인이 이야기한 방향으로 움직이고 있어요.' : '주인과 정한 모습이 자리에 남았어요.';
    const contact = current.contact;
    const showContact = contactHere(contact) && ['issued', 'delivered'].includes(contact.state) && !dialog.open;
    $('life-contact').hidden = !showContact;
    $('life-contact-line').textContent = showContact ? contact.label : '';
    panel.dataset.lifePhase = current.interaction?.stage || 'idle';
    panel.dataset.lifeRoutine = current.background?.phase || 'idle';
    panel.dataset.lifeContact = showContact ? contact.id : '';
    if (dialog.open) updateDialog();
    if (allowActors && snapshot.state.phase !== 'away') paintRoutine(current.background); else releaseActors();
    const result = current.interaction?.stage === 'result' ? current.interaction : null;
    const resultId = result && !result.delivered ? result.resultId : null;
    $('life-result').hidden = !result;
    $('life-result').textContent = result?.line || '';
    const signature = JSON.stringify(result?.actions || []);
    $('life-result-actions').hidden = !result;
    if (signature !== resultActionSignature) {
      resultActionSignature = signature;
      $('life-result-actions').replaceChildren(...(result?.actions || []).map(action => {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'felt-button';
        button.dataset.lifeCommand = action.type; button.textContent = action.label;
        button.addEventListener('click', () => command(action.type, action.payload || {}));
        return button;
      }));
    }
    watchResult(resultId);
    watchContact(showContact ? contact : null);
    setBusy(busy);
  }
  function invalidate() {
    available = false; panel.hidden = true; current = null;
    if (dialog.open) dialog.close();
    $('life-result').hidden = true; $('life-result-actions').hidden = true; $('life-contact').hidden = true;
    stopObservation(); watchContact(null); releaseActors();
  }
  $('life-open').addEventListener('click', () => openDetail('direct'));
  $('life-view-scene').addEventListener('click', () => $('scene').scrollIntoView({ behavior: reducedMotion() ? 'instant' : 'smooth', block: 'start' }));
  $('life-resume').addEventListener('click', () => command('LIFE_RESUME'));
  $('life-contact-open').addEventListener('click', () => openDetail('contact'));
  $('life-close').addEventListener('click', () => closeDetail());
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeDetail(); });
  for (const button of panel.querySelectorAll('[data-life-mode]')) button.addEventListener('click', () => command('LIFE_PREFERENCE', { mode: button.dataset.lifeMode }));
  return { render, setBusy, invalidate, releaseActors, memory: () => available ? current?.memory || [] : [], isOpen: () => dialog.open };
}
