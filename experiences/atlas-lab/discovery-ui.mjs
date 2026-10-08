import { createDiscoveryAdapter, DISCOVERY_FIELDS, DISCOVERY_SCENARIOS, DISCOVERY_FEEDBACK_REASONS } from './discovery.mjs';

// This screen explores fictional adults. A shortlist is never an introduction or mutual interest.
export function mountDiscoveryLab({ root = document, Domain, Ask, Personalization, initialState, onStateChange = () => {}, onSelectionChange = () => {}, onStartMeeting = () => {}, now = () => new Date().toISOString() }) {
  const adapter = createDiscoveryAdapter({ Domain, Ask, Personalization });
  const copy = value => JSON.parse(JSON.stringify(value));
  let state = initialState === undefined ? adapter.create('first', { at: now() }) : copy(initialState), draft = null, expiryTimer = null, observedAt = -Infinity;
  const time = (writing = false) => {
    const supplied = Date.parse(now()), last = state.events.length ? Date.parse(state.events.at(-1).at) : supplied;
    if (!Number.isFinite(supplied)) throw new TypeError('Discovery UI requires a valid current time');
    // Once this view has observed a deadline, a device-clock correction must not
    // revive the expired candidate/meeting connection. Pure historical queries
    // remain available on the adapter; this is the live view's clock boundary.
    observedAt = Math.max(observedAt, supplied, last + (writing ? 1 : 0));
    return new Date(observedAt).toISOString();
  };
  adapter.inspect(state); // Reject an invalid supplied snapshot before displaying it.
  const viewNow = () => adapter.inspect(state, { at: time() });
  const handoffNow = () => adapter.handoff(state, { at: time() });
  function commit(next) {
    state = next; draft = null; onSelectionChange(handoffNow()); render();
    onStateChange(copy(state));
  }
  const find = id => root.getElementById(id);
  const make = (tag, text, className) => {
    const node = root.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const button = (label, key, handler) => {
    const b = make('button', label, 'slab'); b.type = 'button'; b.dataset.discoveryAction = key;
    b.addEventListener('click', handler); return b;
  };
  const select = (id, options) => {
    const node = make('select'); node.id = id;
    for (const option of options) { const child = make('option', option.label); child.value = option.id; node.append(child); }
    return node;
  };
  function act(action, notice, focus = 'discovery-summary') {
    try {
      commit(adapter.record(state, { ...action, at: time(true) }));
      find('discovery-notice').textContent = notice;
      find(focus)?.focus({ preventScroll: true });
    } catch {
      find('discovery-notice').textContent = '지금 조건에서는 이 선택을 반영할 수 없어요. 확인할 점을 살펴봐 주세요.';
    }
  }
  function clearPreview() {
    draft = null; find('discovery-preview').replaceChildren();
  }
  function showPreview(action) {
    try {
      const at = time(true);
      draft = adapter.preview(state, { ...action, at }, { at }); renderPreview();
      find('discovery-preview-title')?.focus({ preventScroll: true });
    } catch { find('discovery-notice').textContent = '이 변경은 미리 볼 수 없어요. 고른 항목을 다시 확인해 주세요.'; }
  }
  function renderPreview() {
    const area = find('discovery-preview'); area.replaceChildren();
    if (!draft) return;
    const title = make('h3', '적용하기 전에 비교해 보세요'); title.id = 'discovery-preview-title'; title.tabIndex = -1;
    const field = DISCOVERY_FIELDS.find(f => f.id === draft.action.field);
    const label = draft.action.kind === 'clear' ? '답을 지우기' : draft.action.kind === 'mark-unknown' ? '이번에는 아직 모르겠어요'
      : draft.action.kind === 'revert-context' ? '이번 선택 취소' : field.options.find(o => o.value === draft.action.value)?.label;
    area.append(title, make('p', `${field.label}: ${label} · ${draft.action.target === 'context' || ['mark-unknown', 'revert-context'].includes(draft.action.kind) ? '이번 추천에서만' : '앞으로도'}`, 'discovery-change-title'),
      make('p', '아직 적용하지 않았어요. 현재 답과 선택, 준비 중인 만남은 그대로예요.', 'mini'));
    const comparison = make('div', '', 'discovery-comparison');
    for (const [heading, value] of [['지금 먼저 살펴볼 후보', draft.before], ['바꾸면 먼저 살펴볼 후보', draft.after]]) {
      const part = make('div'); part.append(make('h4', heading), make('p', value.topLabel || '추천을 보류해요')); comparison.append(part);
    }
    area.append(comparison, make('p', draft.summary, 'mini'));
    if (draft.entered.length) area.append(facts('새로 비교할 수 있어요', draft.entered.map(c => c.label)));
    if (draft.left.length) area.append(facts('더 이상 추천 조건을 충족하지 않아요', draft.left.map(c => c.label)));
    if (draft.held.length) area.append(facts('이 변경으로도 확인이 필요하거나 맞지 않아요', draft.held.map(c => `${c.label}: ${c.reason}`)));
    if (draft.selectionWillClear) area.append(make('p', '적용하면 지금 살펴보는 후보와 연결된 만남 준비가 해제돼요. 바뀐 조건으로 후보를 다시 골라 주세요.', 'mini'));
    const actions = make('div', '', 'interpret-actions');
    actions.append(button('이 변경 적용하기', 'preview-apply', () => {
      try {
        commit(adapter.applyPreview(state, draft, { at: time(true) }));
        find('discovery-notice').textContent = '미리 본 변경을 적용했어요. 새로운 조건으로 후보를 확인해 주세요.';
        find('discovery-summary').focus({ preventScroll: true });
      } catch { clearPreview(); find('discovery-notice').textContent = '그사이 답이나 선택이 바뀌었어요. 지금 상태에서 다시 미리 봐 주세요.'; }
    }), button('취소하고 원래대로', 'preview-cancel', () => {
      clearPreview(); find('discovery-notice').textContent = '미리보기를 닫았어요. 원래 답과 선택, 준비 중인 만남은 그대로예요.';
      find('discovery-summary').focus({ preventScroll: true });
    })); area.append(actions);
  }
  function renderQuestion(view) {
    const area = find('discovery-question'); area.replaceChildren();
    if (!view.context.closed && view.fields.find(field => field.id === 'consent')?.value === true) {
      area.append(button(view.questionsPaused ? '질문을 더 답할게요' : '우선 여기까지 답하고 볼게요', view.questionsPaused ? 'continue-questions' : 'stop-questions',
        () => act({ kind: view.questionsPaused ? 'continue-questions' : 'stop-questions' }, view.questionsPaused ? '선택 질문을 다시 열었어요.' : '선택 질문은 쉬어요. 동의·일정·꼭 지킬 조건이 비어 있으면 그 확인만 남겨요.')));
    }
    const q = view.question;
    if (!q) return;
    const fieldset = make('fieldset');
    const title = make('legend', q.label); title.id = 'discovery-question-title'; title.tabIndex = -1;
    fieldset.append(title, make('p', q.why, 'mini'));
    const scopeSelect = select('discovery-question-target', [{ id: 'context', label: '이번 추천에서만' }, { id: 'baseline', label: '앞으로도' }]);
    const scoped = q.field.startsWith('wants.') && q.optional || q.field === 'availability';
    scopeSelect.value = q.target;
    if (scoped) { const label = make('label', '이 선택을 반영할 범위'); label.htmlFor = scopeSelect.id; fieldset.append(label, scopeSelect); }
    const choices = make('div', '', 'interpret-actions discovery-choices');
    for (const option of q.options) {
      const b = button(option.label, 'answer', () => act({ kind: 'set', field: q.field, value: option.value, target: scoped ? scopeSelect.value : q.target }, '직접 고른 답으로 후보와 이유를 다시 살펴봤어요.'));
      b.dataset.discoveryAnswer = option.id; b.dataset.discoveryField = q.field; choices.append(b);
    }
    if (q.optional) choices.append(button('아직 모르겠어요', 'skip', () => act({ kind: 'mark-unknown', field: q.field }, '이번에는 미확인으로 남겨요. 평소 답이나 상관없다는 답으로 채우지 않아요.')));
    fieldset.append(choices); area.append(fieldset);
  }
  function renderEditor(view) {
    const area = find('discovery-profile'); area.replaceChildren();
    const self = make('div'), wants = make('div');
    self.append(make('h3', '내가 밝힌 나의 방식')); wants.append(make('h3', '상대에게 바라는 방식'));
    for (const field of view.fields) {
      const node = make('p', `${field.label}: ${field.state === 'known' ? field.valueLabel : '아직 고르지 않았어요'}${field.required && field.id.startsWith('wants.') ? ' · 꼭 필요한 조건' : ''}`, 'mini');
      node.dataset.discoveryFieldSummary = field.id;
      (field.id.startsWith('wants.') ? wants : self).append(node);
      if (field.id.startsWith('wants.') || field.id === 'availability') {
        const layer = make('p', `평소: ${field.baseline.valueLabel} · 이번: ${field.context.valueLabel} · 지금 적용: ${field.valueLabel}`, 'mini');
        layer.dataset.discoveryLayers = field.id; (field.id.startsWith('wants.') ? wants : self).append(layer);
        if (field.required && field.id.startsWith('wants.')) {
          const value = DISCOVERY_FIELDS.find(f => f.id === field.id).options.find(option => option.value === field.requiredValue)?.label || '답 확인 필요';
          wants.append(make('p', `계속 지킬 필수조건: ${value}. 이번 선택으로 바뀌지 않아요.`, 'mini'));
        }
      }
    }
    area.append(self, wants);
    const details = make('details', '', 'discovery-editor'); details.id = 'discovery-editor';
    details.append(make('summary', '내 답과 필수조건 고치기'));
    const fieldSelect = select('discovery-edit-field', DISCOVERY_FIELDS.filter(field=>!field.legacy&&field.kind!=='regions')), valueSelect = select('discovery-edit-value', []);
    const full=make('a','관계 목적·시작 속도와 만남 가능 지역을 실제 MVP에서 확인하기');full.href='./dating.html';details.append(full);
    const targetSelect = select('discovery-edit-target', [{ id: 'baseline', label: '앞으로도' }, { id: 'context', label: '이번 추천에서만' }]);
    const targetLabel = make('label', '적용 범위'); targetLabel.htmlFor = targetSelect.id;
    const required = make('input'); required.type = 'checkbox'; required.id = 'discovery-edit-required';
    const requiredLabel = make('label', '', 'discovery-check'); requiredLabel.append(required, root.createTextNode('상대에게 꼭 필요한 조건이에요'));
    const fieldLabel = make('label', '고칠 항목'); fieldLabel.htmlFor = fieldSelect.id;
    const valueLabel = make('label', '내 선택'); valueLabel.htmlFor = valueSelect.id;
    const previewButton = button('바꾸면 어떻게 될까?', 'preview', () => showPreview(editedAction()));
    const unknownButton = button('이번에는 아직 모르겠어요', 'mark-unknown', () => act({ kind: 'mark-unknown', field: fieldSelect.value }, '이번에는 미확인으로 남겼어요. 평소 답을 대신 쓰지 않고 필수조건은 유지해요.'));
    const revertButton = button('이번 선택 취소', 'revert-context', () => act({ kind: 'revert-context', field: fieldSelect.value }, '이번 선택을 취소했어요. 유효한 평소 기준으로 돌아가요.'));
    const scopeHelp = make('p', '', 'mini'); scopeHelp.id = 'discovery-scope-help';
    const update = () => {
      const spec = DISCOVERY_FIELDS.find(f => f.id === fieldSelect.value), current = view.fields.find(f => f.id === spec.id);
      const canContext = spec.kind === 'wants' || spec.id === 'availability';
      targetSelect.disabled = !canContext || view.context.closed;
      if (targetSelect.disabled) targetSelect.value = 'baseline';
      valueSelect.replaceChildren(...spec.options.map(option => { const node = make('option', option.label); node.value = option.id; node.selected = option.value === current?.value; return node; }));
      requiredLabel.hidden = !spec.id.startsWith('wants.'); required.checked = spec.id.startsWith('wants.') && current?.required === true;
      required.disabled = targetSelect.value === 'context';
      unknownButton.hidden = revertButton.hidden = !canContext || view.context.closed;
      previewButton.hidden = spec.id === 'consent' || view.fields.find(f => f.id === 'consent')?.value !== true || view.context.closed;
      scopeHelp.textContent = targetSelect.value === 'context' ? '이번 추천이 끝나면 유효한 평소 기준으로 돌아가요. 필수조건은 그대로 지켜요.' : '평소 기준도 바꾸고 이번 추천에도 적용해요. 이 항목의 기존 이번 선택은 정리해요.';
    };
    fieldSelect.value = 'wants.pace'; fieldSelect.addEventListener('change', () => { update(); clearPreview(); }); update();
    valueSelect.addEventListener('change', clearPreview); required.addEventListener('change', clearPreview);
    targetSelect.addEventListener('change', () => {
      const editingValue = valueSelect.value;
      update(); valueSelect.value = editingValue; clearPreview();
    });
    const editedAction = () => {
      const spec = DISCOVERY_FIELDS.find(f => f.id === fieldSelect.value), option = spec.options.find(o => o.id === valueSelect.value);
      return { kind: 'set', field: spec.id, value: option.value, target: targetSelect.value,
        ...(spec.id.startsWith('wants.') && targetSelect.value === 'baseline' ? { required: required.checked } : {}) };
    };
    const actions = make('div', '', 'interpret-actions');
    actions.append(previewButton,
      button('이 답 바로 적용하기', 'save', () => act(editedAction(), '고친 답으로 다시 추천했어요. 전에 살펴보던 후보는 새 조건에서 다시 골라 주세요.')),
      button('이 답 지우기', 'clear', () => act({ kind: 'clear', field: fieldSelect.value, target: targetSelect.value }, targetSelect.value === 'context' ? '이번 선택을 지웠어요. 유효한 평소 답으로 돌아가요.' : '평소 답을 지웠어요. 필수 지정은 유지하며 답은 미확인으로 남겨요.')),
      unknownButton, revertButton);
    details.append(fieldLabel, fieldSelect, targetLabel, targetSelect, valueLabel, valueSelect, requiredLabel, scopeHelp, actions,
      make('p', '상황에서 고른 답은 직접 밝힌 선호예요. 고정된 성격이나 상대에 대한 호감으로 단정하지 않아요.', 'mini'));
    area.append(details);
    const context = make('div'); context.id = 'discovery-context';
    context.append(make('h3', view.context.closed ? '끝난 추천' : '이번 추천의 범위'),
      make('p', view.context.closed ? '평소 기준은 남아 있어요. 새 추천을 시작해야 후보를 다시 살펴볼 수 있어요.' : '후보를 바꾸거나 다시 방문해도 같은 추천을 이어가요. 아래에서 직접 끝내거나 새로 시작할 수 있어요.', 'mini'));
    if (view.context.expiresAt) context.append(make('p', `확인한 종료 시점: ${new Date(view.context.expiresAt).toLocaleString('ko-KR')}`, 'mini'));
    const expires = make('input'); expires.type = 'datetime-local'; expires.id = 'discovery-context-expiry';
    const expiryLabel = make('label', '새 추천 종료 시점 (선택)'); expiryLabel.htmlFor = expires.id;
    context.append(expiryLabel, expires, make('p', '비워 두면 직접 끝낼 때까지 이어가요. 날짜는 이 기기의 시간대를 기준으로 확인해요.', 'mini'));
    const contextActions = make('div', '', 'interpret-actions');
    if (!view.context.closed) contextActions.append(button('이번 추천 끝내기', 'close-context', () => act({ kind: 'close-context' }, '이번 선택과 후보 연결을 끝냈어요. 평소 기준은 유지해요.')));
    contextActions.append(button('새 추천 시작', 'start-context', () => {
      if (expires.value && !Number.isFinite(Date.parse(expires.value))) { find('discovery-notice').textContent = '종료 날짜와 시간을 확인해 주세요.'; return; }
      act({ kind: 'start-context', ...(expires.value ? { expiresAt: new Date(expires.value).toISOString() } : {}) }, '평소 기준으로 새 추천을 시작했어요. 이전 이번 선택과 후보 연결은 가져오지 않아요.');
    })); context.append(contextActions); area.append(context);
    if (view.changes.length) {
      const history = make('details'); history.id = 'discovery-history'; history.append(make('summary', '바꾼 답과 되돌릴 항목 보기'));
      for (const change of view.changes.slice(-12).reverse()) {
        const field = DISCOVERY_FIELDS.find(field => field.id === change.field);
        const label = value => value.state === 'known' ? field.options.find(option => option.value === value.value)?.label : '미확인';
        history.append(make('p', `${change.label}: ${label(change.before.effective)} → ${label(change.after.effective)}`, 'mini'));
        if (change.canUndo) {
          const undo = button('이 항목 되돌리기', 'undo-field', () => act({ kind: 'undo-field', field: change.field, changeId: change.id }, '이 항목의 답을 되돌렸어요. 후보 선택과 만남 연결은 다시 확인해 주세요.'));
          undo.dataset.discoveryChange = change.id; history.append(undo);
        }
      }
      history.append(make('p', '동의는 직접 다시 답해야 해요. 답을 되돌려도 후보 선택이나 이전 수락을 복원하지 않아요.', 'mini')); area.append(history);
    }
  }
  function facts(title, items, className) {
    const area = make('div', '', className); area.append(make('h4', title));
    const list = make('ul'); for (const text of items) list.append(make('li', text)); area.append(list); return area;
  }
  function candidateCard(candidate, view) {
    const card = make('article', '', 'discovery-card'); card.dataset.discoveryCandidate = candidate.id; card.dataset.discoveryStatus = candidate.status;
    const label = make('h3', candidate.label); label.id = `discovery-candidate-${candidate.id}`; label.tabIndex = -1;
    card.append(make('p', candidate.id === view.topCandidateId ? '지금 먼저 살펴볼 가상 후보' : candidate.status === 'eligible' ? '함께 비교할 가상 후보' : '현재 소개를 보류한 가상 후보', 'eyebrow'), label,
      make('p', candidate.tagline, 'discovery-tagline'), make('p', candidate.reason, 'mini'));
    if (candidate.matched.length) card.append(facts('내가 바라는 점과 맞아요', candidate.matched));
    if (candidate.reciprocal.length) card.append(facts('상대가 밝힌 조건에서도', candidate.reciprocal));
    if (candidate.differences.length) card.append(facts('서로 다른 점', candidate.differences, 'discovery-differences'));
    if (candidate.unknown.length) card.append(facts('아직 확인할 점', candidate.unknown, 'discovery-unknown'));
    if (candidate.status === 'eligible') {
      const b = button(candidate.selected ? '지금 살펴보는 후보' : '이 후보를 더 살펴보기', 'select', () => act({ kind: 'select', candidateId: candidate.id }, '내가 살펴볼 후보로 골랐어요. 상대에게 전달하거나 수락을 받은 것은 아니에요.', `discovery-candidate-${candidate.id}`));
      b.dataset.discoverySelect = candidate.id; b.setAttribute('aria-pressed', String(candidate.selected)); b.disabled = candidate.selected; card.append(b);
    }
    const feedback = make('details'); feedback.append(make('summary', '이 추천에 대해 남기기'));
    const reason = select(`discovery-feedback-${candidate.id}`, DISCOVERY_FEEDBACK_REASONS);
    const reasonLabel = make('label', '지금 느낀 이유'); reasonLabel.htmlFor = reason.id;
    feedback.append(reasonLabel, reason, make('p', '이 답으로 성격이나 일반 취향을 바꾸지 않아요. 조건 수정은 위에서 직접 선택해 주세요.', 'mini'),
      button('이유만 기록하기', 'feedback', () => act({ kind: 'feedback', candidateId: candidate.id, reason: reason.value, decision: 'record-only' }, '이유만 기록했어요. 취향과 후보 선택은 그대로예요.')));
    const skip = button('이번 추천에서만 넘기기', 'skip-candidate', () => act({ kind: 'feedback', candidateId: candidate.id, reason: reason.value, decision: 'skip-current' }, '이번 추천에서만 넘겼어요. 다른 사람에 대한 일반 취향으로 바꾸지 않아요.'));
    skip.disabled = view.exclusions.includes(candidate.id); feedback.append(skip); card.append(feedback);
    return card;
  }
  function render() {
    const view = viewNow();
    if (expiryTimer !== null) { clearTimeout(expiryTimer); expiryTimer = null; }
    if (!view.context.closed && view.context.expiresAt) {
      const delay = Math.max(1, Math.min(2147483647, Date.parse(view.context.expiresAt) - Date.parse(time())));
      expiryTimer = setTimeout(() => { draft = null; onSelectionChange(handoffNow()); render(); }, delay);
      expiryTimer.unref?.();
    }
    find('discovery-summary').textContent = view.summary;
    find('discovery-summary').dataset.status = view.status;
    renderQuestion(view); renderEditor(view); renderPreview();
    if (view.topTierIds.length > 1) find('discovery-question').append(make('p', view.tieNotice, 'mini'),
      button('동등한 다른 후보도 먼저 보기', 'expose', () => act({ kind: 'expose', candidateIds: [view.topCandidateId] }, '같은 조건의 후보 안에서 표시 순서를 바꿨어요. 더 잘 맞는 후보를 밀어내지 않아요.')));
    const change = find('discovery-change'); change.replaceChildren();
    if (view.change) {
      change.append(make('p', view.change.beforeId !== view.change.afterId ? `${view.change.beforeLabel || '후보 확인 전'} → ${view.change.afterLabel || '조건 확인이 먼저예요'}` : '먼저 살펴볼 후보는 같고, 추천 근거를 다시 확인했어요.', 'discovery-change-title'), make('p', view.change.reason, 'mini'));
    }
    const area = find('discovery-candidates'); area.replaceChildren(...view.candidates.filter(c => c.status === 'eligible').map(c => candidateCard(c, view)));
    const hold = find('discovery-held'), deferred = view.candidates.filter(c => c.status !== 'eligible'); hold.replaceChildren();
    if (deferred.length) {
      const details = make('details'); details.id = 'discovery-held-details';
      details.append(make('summary', `지금 소개하지 않는 이유 보기 · ${deferred.length}명`));
      const cards = make('div', '', 'discovery-cards'); cards.append(...deferred.map(c => candidateCard(c, view))); details.append(cards); hold.append(details);
    }
    const selection = find('discovery-selection'); selection.replaceChildren();
    if (view.selection) {
      selection.append(make('h3', `지금 살펴보는 후보: ${view.selection.label}`), make('p', '조건의 일치는 호감이나 상호 수락을 뜻하지 않아요. 첫 만남으로 이어가면 이미 밝힌 일정은 다시 묻지 않고, 나머지 취향과 의향을 확인해요.', 'mini'),
        button('이 사람과 첫 만남 준비하기', 'start-meeting', () => {
          const seed = handoffNow();
          if (!seed) { find('discovery-notice').textContent = '지금 조건에서 후보를 다시 골라 주세요.'; return; }
          onStartMeeting(seed);
          find('meeting-title').scrollIntoView({ block: 'start', behavior: 'instant' }); find('meeting-title').focus({ preventScroll: true });
        }),
        button('선택 취소', 'unselect', () => act({ kind: 'unselect' }, '살펴볼 후보 선택을 취소했어요. 취향이나 성격 정보는 바꾸지 않았어요.')));
    }
    const reset = find('discovery-scenarios'); reset.replaceChildren(...DISCOVERY_SCENARIOS.map(scenario => {
      const b = button(scenario.title, 'scenario', () => {
        const at = now(), next = adapter.create(scenario.id, { at });
        // This button explicitly discards the previous scenario. Its synthetic
        // future clock must not become the new scenario's real deadline floor.
        observedAt = Date.parse(at); commit(next);
        find('discovery-notice').textContent = '새 가상 사례를 시작했어요. 이전 답과 선택은 지웠어요.'; find('discovery-summary').focus({ preventScroll: true });
      });
      b.dataset.discoveryScenario = scenario.id; return b;
    }));
  }
  render();
  onSelectionChange(handoffNow());
  return Object.freeze({ snapshot: viewNow, previewSnapshot: () => draft ? copy(draft) : null, handoff: handoffNow,
    dispose: () => { if (expiryTimer !== null) clearTimeout(expiryTimer); expiryTimer = null; },
    exportState: () => copy(state), restoreState: restored => {
      const next = copy(restored); adapter.inspect(next); // Validate all replayed events before replacing the active state.
      state = next; draft = null; onSelectionChange(handoffNow()); render(); return viewNow();
    } });
}
