import { mailProviderLabel } from './office-mail-model.mjs';
import { isEditedMailRole, makeMailFilterDraft, readMailFilterDraft } from './office-mail-review-filter.mjs';

const FOLDER_OPTIONS = Object.freeze([
  Object.freeze({ value: 'received', label: '받은 메일' }),
  Object.freeze({ value: 'inbox', label: '받은편지함' }),
  Object.freeze({ value: 'sent', label: '보낸편지함' }),
  Object.freeze({ value: 'inbox_sent', label: '받은편지함과 보낸편지함' }),
  Object.freeze({ value: 'all', label: '전체 메일' }),
]);

let instanceCounter = 0;

function shallowEqualStrings(previous, next) {
  return previous.length === next.length && previous.every((value, index) => value === next[index]);
}

function normalizeStringList(list) {
  return Array.isArray(list) ? list.filter(value => typeof value === 'string' && value.length > 0) : [];
}

function formatProviderDisplay(id, address) {
  const normalizedId = typeof id === 'string' ? id.trim().toLowerCase() : '';
  const baseName = mailProviderLabel(normalizedId) || normalizedId || '메일함';
  const trimmedAddress = typeof address === 'string' ? address.trim() : '';
  return trimmedAddress ? `${baseName} (${trimmedAddress})` : baseName;
}

function normalizeProviders(providers) {
  const byId = new Map();
  if (Array.isArray(providers)) {
    for (const raw of providers) {
      if (!raw || typeof raw !== 'object') continue;
      const id = typeof raw.id === 'string' ? raw.id.trim().toLowerCase() : '';
      if (id !== 'gmail' && id !== 'outlook') continue;
      const connected = Boolean(raw.connected);
      const address = typeof raw.address === 'string' ? raw.address.trim() : '';
      const existing = byId.get(id);
      if (!existing || (connected && !existing.connected) || (!existing.address && address)) {
        byId.set(id, {
          id,
          connected,
          address: address || (existing ? existing.address : ''),
        });
      }
    }
  }
  const ordered = [];
  for (const id of ['gmail', 'outlook']) {
    if (byId.has(id)) {
      ordered.push(byId.get(id));
    }
  }
  return { byId, ordered };
}

function reconcileSelectOptions(doc, selectEl, optionDefs, selectedValue) {
  for (const [index, def] of optionDefs.entries()) {
    let option = selectEl.options[index];
    if (!option) {
      option = doc.createElement('option');
      selectEl.append(option);
    }
    if (option.getAttribute('value') !== def.value) option.value = def.value;
    if (option.textContent !== def.label) option.textContent = def.label;
    option.disabled = Boolean(def.disabled);
  }
  while (selectEl.options.length > optionDefs.length) selectEl.lastElementChild.remove();
  if (selectEl.value !== selectedValue) selectEl.value = selectedValue;
}

function createMailRoleRow(doc, idPrefix, field, listen, onPick) {
  const defaultNote = '직접 필드에 다른 값을 입력할 수도 있습니다.';
  const makeEl = (tag, style) => {
    const node = doc.createElement(tag);
    Object.assign(node.style, style);
    return node;
  };

  const fieldset = makeEl('fieldset', { margin: '0', minWidth: '0', width: '100%', maxWidth: '100%', boxSizing: 'border-box' });
  fieldset.dataset.mailRoleGroup = field;
  fieldset.hidden = true;

  const legend = makeEl('legend', { maxWidth: '100%', whiteSpace: 'normal', overflowWrap: 'anywhere' });
  const note = makeEl('p', { margin: '6px 0 0', overflowWrap: 'anywhere', wordBreak: 'keep-all' });
  note.textContent = defaultNote;

  const clearInvalid = () => {
    applyOpt.radio.removeAttribute('aria-invalid');
    applyOpt.radio.removeAttribute('aria-describedby');
  };

  const makeOption = (decision) => {
    const label = makeEl('label', { display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: '6px' });
    const radio = Object.assign(makeEl('input', { flexShrink: '0' }), {
      type: 'radio', name: `${idPrefix}-${field}-role`, value: decision, id: `${idPrefix}-${field}-${decision}`,
    });
    radio.dataset.mailRoleDecision = decision;
    const text = makeEl('span', { minWidth: '0', overflowWrap: 'anywhere', wordBreak: 'keep-all' });
    listen(radio, 'change', () => { clearInvalid(); onPick(decision); });
    label.append(radio, text);
    return { label, radio, text };
  };
  const [applyOpt, excludeOpt] = [makeOption('apply'), makeOption('exclude')];
  fieldset.append(legend, applyOpt.label, excludeOpt.label, note);

  const formatScope = (raw) => {
    const val = String(raw ?? '').trim();
    if (field !== 'folder') return val || '보낸 사람 제한 없음';
    return FOLDER_OPTIONS.find((opt) => opt.value === val)?.label || val || '폴더 제한 없음';
  };
  const focusInvalid = (statusId) => {
    applyOpt.radio.setAttribute('aria-invalid', 'true');
    if (statusId) applyOpt.radio.setAttribute('aria-describedby', statusId);
    else applyOpt.radio.removeAttribute('aria-describedby');
    applyOpt.radio.focus();
  };

  const paint = (choice, base, decision = '') => {
    if (!choice) {
      fieldset.hidden = true;
      legend.textContent = '';
      applyOpt.text.textContent = '';
      excludeOpt.text.textContent = '';
      note.textContent = defaultNote;
      applyOpt.radio.checked = excludeOpt.radio.checked = false;
      return clearInvalid();
    }
    fieldset.hidden = false;
    legend.textContent = String(choice.quote ?? '');
    applyOpt.text.textContent = `적용 — ${formatScope(choice.value)}`;
    excludeOpt.text.textContent = `기존 조건 유지 — ${formatScope(base)}`;
    applyOpt.radio.checked = decision === 'apply';
    excludeOpt.radio.checked = decision === 'exclude';
    note.textContent = decision === 'edit' ? '직접 입력한 값으로 검색합니다' : defaultNote;
  };

  return { element: fieldset, radios: { apply: applyOpt.radio, exclude: excludeOpt.radio }, paint, clearInvalid, focusInvalid };
}

function createRoleChoiceControls({ doc, idPrefix, fromInput, folderSelect, listen, onChange }) {
  const fields = ['from', 'folder'], inputs = { from: fromInput, folder: folderSelect };
  let locked = false;
  const slots = Object.fromEntries(fields.map((field) => {
    const row = createMailRoleRow(doc, idPrefix, field, listen, (mode) => onPick(field, mode));
    row.element.hidden = true;
    return [field, { input: inputs[field], row, choice: null, base: '', scopeKey: undefined, decision: '' }];
  }));

  function hideSlot(slot, restoreValue) {
    if (slot.input) slot.input.value = restoreValue;
    Object.assign(slot, { choice: null, base: '', scopeKey: undefined, decision: '' });
    slot.row.paint(null, '', '');
  }

  function onPick(field, mode) {
    const slot = slots[field];
    if (locked || !slot?.choice || (mode !== 'apply' && mode !== 'exclude')) return;
    slot.decision = mode;
    if (slot.input) slot.input.value = mode === 'apply' ? slot.choice.value : slot.base;
    slot.row.clearInvalid();
    slot.row.paint(slot.choice, slot.base, mode);
    onChange?.();
  }

  return {
    panels: { from: slots.from.row.element, folder: slots.folder.row.element },
    update(choices, filter, scopeKey) {
      for (const field of fields) {
        const raw = Array.isArray(choices) ? choices.find((c) => c?.field === field) : choices?.[field];
        const next = raw && typeof raw === 'object' ? raw : null;
        const slot = slots[field], base = String(filter?.[field] ?? '');
        if (!next) {
          if (slot.choice) hideSlot(slot, filter?.[field] != null ? base : slot.base);
          continue;
        }
        const same = slot.choice && slot.scopeKey === scopeKey &&
          slot.choice.quote === next.quote && slot.choice.value === next.value && slot.base === base;
        Object.assign(slot, { choice: next, base, scopeKey });
        if (same) continue;
        slot.decision = '';
        if (slot.input) slot.input.value = base;
        slot.row.clearInvalid();
        slot.row.element.hidden = false;
        slot.row.paint(next, base, '');
      }
    },
    reset: () => fields.forEach((f) => { if (slots[f].choice) hideSlot(slots[f], slots[f].base); }),
    edited(field) {
      const slot = slots[field];
      if (!slot?.choice || !slot.input) return '';
      slot.decision = isEditedMailRole(field, slot.input.value, slot.base, slot.choice.value) ? 'edit' : '';
      if (slot.decision) slot.row.clearInvalid();
      slot.row.paint(slot.choice, slot.base, slot.decision);
      return slot.decision;
    },
    missing: () => fields.find((f) => slots[f].choice && !slots[f].decision) || '',
    decisions() {
      const out = {};
      for (const f of fields) if (slots[f].choice && slots[f].decision) out[f] = slots[f].decision;
      return Object.keys(out).length ? out : undefined;
    },
    setLocked(flag) {
      locked = Boolean(flag);
      for (const f of fields) slots[f].row.radios.apply.disabled = slots[f].row.radios.exclude.disabled = locked;
    },
    focusMissing: (field, statusId) => { if (slots[field]?.choice) slots[field].row.focusInvalid(statusId); },
  };
}

export function createMailReviewPanel(doc = globalThis.document, taskId, emit) {
  if (!doc || typeof doc.createElement !== 'function') {
    throw new TypeError('A valid document instance is required.');
  }

  instanceCounter += 1;
  const idPrefix = `off-mail-review-${instanceCounter}`;
  const statusId = `${idPrefix}-status`;
  const cleanups = [];

  function listen(target, type, handler) {
    target.addEventListener(type, handler);
    cleanups.push(() => target.removeEventListener(type, handler));
  }

  function createFieldBlock(fieldKey, labelText, controlEl) {
    const controlId = `${idPrefix}-${fieldKey}`;
    const isTextarea = fieldKey === 'terms';
    const wrapper = doc.createElement('div');
    wrapper.className = 'off-task-field';
    Object.assign(wrapper.style, {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'stretch',
      flex: '0 0 auto',
      gridColumn: isTextarea ? '1 / -1' : 'auto',
      gap: '4px',
      width: '100%',
      maxWidth: '100%',
      minWidth: '0',
      boxSizing: 'border-box',
    });

    const labelEl = doc.createElement('label');
    labelEl.htmlFor = controlId;
    labelEl.textContent = labelText;
    Object.assign(labelEl.style, {
      maxWidth: '100%',
      minWidth: '0',
      overflowWrap: 'anywhere',
      wordBreak: 'break-word',
    });

    controlEl.id = controlId;
    controlEl.setAttribute('data-mail-field', fieldKey);
    Object.assign(controlEl.style, {
      flex: '0 0 auto',
      height: isTextarea ? 'auto' : '2.25rem',
      minHeight: isTextarea ? '4.75rem' : '2.25rem',
      padding: isTextarea ? '0.5rem 0.625rem' : '0.25rem 0.5rem',
      lineHeight: isTextarea ? '1.45' : '1.25',
      width: '100%',
      maxWidth: '100%',
      minWidth: '0',
      boxSizing: 'border-box',
    });

    wrapper.append(labelEl, controlEl);
    return wrapper;
  }

  function createActionButton(actionName, labelText, isQuiet = false) {
    const btn = doc.createElement('button');
    btn.type = 'button';
    if (isQuiet) {
      btn.className = 'quiet';
    }
    btn.setAttribute('data-mail-review-action', actionName);
    btn.textContent = labelText;
    Object.assign(btn.style, {
      maxWidth: '100%',
      minWidth: '0',
      boxSizing: 'border-box',
      overflowWrap: 'anywhere',
    });
    return btn;
  }

  const element = doc.createElement('div');
  element.className = 'off-task-form';
  element.setAttribute('data-office-mail-review', '');
  Object.assign(element.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    width: '100%',
    maxWidth: '100%',
    minWidth: '0',
    boxSizing: 'border-box',
    overflowX: 'hidden',
    overflowWrap: 'anywhere',
  });
  element.hidden = true;

  const quotesBox = doc.createElement('div');
  Object.assign(quotesBox.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    width: '100%',
    maxWidth: '100%',
    minWidth: '0',
    boxSizing: 'border-box',
  });
  const quotesTitleEl = doc.createElement('span');
  quotesTitleEl.textContent = '회원 원문';
  const quotesListEl = doc.createElement('ul');
  Object.assign(quotesListEl.style, {
    margin: '0',
    paddingLeft: '18px',
    maxWidth: '100%',
    minWidth: '0',
    boxSizing: 'border-box',
  });
  quotesBox.append(quotesTitleEl, quotesListEl);
  quotesBox.hidden = true;

  const editorBox = doc.createElement('div');
  Object.assign(editorBox.style, {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
    alignItems: 'start',
    gap: '8px',
    width: '100%',
    maxWidth: '100%',
    minWidth: '0',
    boxSizing: 'border-box',
  });

  const termsInput = doc.createElement('textarea');
  termsInput.className = 'off-task-input';
  termsInput.rows = 3;
  Object.assign(termsInput.style, { resize: 'vertical' });

  const fromInput = doc.createElement('input');
  fromInput.type = 'text';
  fromInput.className = 'off-task-input';
  fromInput.setAttribute('autocomplete', 'off');

  const afterInput = doc.createElement('input');
  afterInput.type = 'date';
  afterInput.className = 'off-task-input';

  const throughInput = doc.createElement('input');
  throughInput.type = 'date';
  throughInput.className = 'off-task-input';

  const folderSelect = doc.createElement('select');
  folderSelect.className = 'office-select';
  reconcileSelectOptions(doc, folderSelect, FOLDER_OPTIONS, 'received');

  const providerSelect = doc.createElement('select');
  providerSelect.className = 'office-select';
  reconcileSelectOptions(
    doc,
    providerSelect,
    [{ value: 'all', label: '연결된 메일함 전체', disabled: false }],
    'all'
  );

  const attachmentSelect = doc.createElement('select');
  attachmentSelect.className = 'office-select';
  reconcileSelectOptions(
    doc,
    attachmentSelect,
    [
      { value: '', label: '첨부 제한 없음', disabled: false },
      { value: 'has', label: '첨부 있음', disabled: false },
    ],
    ''
  );

  const roleControls = createRoleChoiceControls({
    doc,
    idPrefix,
    fromInput,
    folderSelect,
    listen,
    onChange() {
      if (disposed || !hasReviewSnapshot) return;
      if (currentReviewId) syncFolderSelect(folderSelect.value);
      roleErrorActive = false;
      localError = '';
      setFieldInvalid('');
      syncUiPresentation();
    },
  });

  const fromFieldBlock = createFieldBlock('from', '보낸 사람', fromInput);
  fromFieldBlock.appendChild(roleControls.panels.from);
  const folderFieldBlock = createFieldBlock('folder', '폴더', folderSelect);
  folderFieldBlock.appendChild(roleControls.panels.folder);

  editorBox.appendChild(createFieldBlock('terms', '검색어 (한 줄 하나)', termsInput));
  editorBox.appendChild(fromFieldBlock);
  editorBox.appendChild(createFieldBlock('after', '시작일 (포함)', afterInput));
  editorBox.appendChild(createFieldBlock('through', '마지막 날 (포함)', throughInput));
  editorBox.appendChild(folderFieldBlock);
  editorBox.appendChild(createFieldBlock('provider', '메일함', providerSelect));
  editorBox.appendChild(createFieldBlock('attachment', '첨부', attachmentSelect));

  const unmetBox = doc.createElement('div');
  Object.assign(unmetBox.style, {
    gridColumn: '1 / -1',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    width: '100%',
    maxWidth: '100%',
    minWidth: '0',
    boxSizing: 'border-box',
  });
  const unmetTitleEl = doc.createElement('span');
  unmetTitleEl.textContent = '지원하지 않는 조건';
  const unmetListEl = doc.createElement('ul');
  Object.assign(unmetListEl.style, {
    margin: '0',
    paddingLeft: '18px',
    maxWidth: '100%',
    minWidth: '0',
    boxSizing: 'border-box',
  });

  const omitRow = doc.createElement('div');
  omitRow.className = 'off-task-field';
  Object.assign(omitRow.style, {
    flex: '0 0 auto',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: '8px',
    width: '100%',
    maxWidth: '100%',
    minWidth: '0',
    boxSizing: 'border-box',
  });

  const omitId = `${idPrefix}-omit`;
  const omitCheckbox = doc.createElement('input');
  omitCheckbox.type = 'checkbox';
  omitCheckbox.id = omitId;
  omitCheckbox.setAttribute('data-mail-field', 'omit');
  omitCheckbox.checked = false;
  Object.assign(omitCheckbox.style, {
    flexShrink: '0',
    marginTop: '2px',
  });

  const omitLabel = doc.createElement('label');
  omitLabel.htmlFor = omitId;
  omitLabel.textContent = '지원하지 않는 조건을 빼기로 확인합니다';
  Object.assign(omitLabel.style, {
    minWidth: '0',
    maxWidth: '100%',
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
  });

  omitRow.append(omitCheckbox, omitLabel);
  unmetBox.append(unmetTitleEl, unmetListEl, omitRow);
  unmetBox.hidden = true;
  editorBox.appendChild(unmetBox);

  const periodBox = doc.createElement('div');
  Object.assign(periodBox.style, {
    gridColumn: '1 / -1',
    width: '100%',
    maxWidth: '100%',
    minWidth: '0',
    boxSizing: 'border-box',
  });

  const periodGuideEl = doc.createElement('p');
  periodGuideEl.textContent =
    '조회 기간이 비어 있습니다. 날짜를 한쪽 이상 입력하거나 기간 제한 없이 검색을 선택해 주세요.';
  Object.assign(periodGuideEl.style, {
    margin: '0 0 6px 0',
    minWidth: '0',
    maxWidth: '100%',
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
  });

  const periodRow = doc.createElement('div');
  periodRow.className = 'off-task-field';
  Object.assign(periodRow.style, {
    flex: '0 0 auto',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: '8px',
    width: '100%',
    maxWidth: '100%',
    minWidth: '0',
    boxSizing: 'border-box',
  });

  const unboundedPeriodId = `${idPrefix}-unbounded-period`;
  const unboundedPeriodCheckbox = doc.createElement('input');
  unboundedPeriodCheckbox.type = 'checkbox';
  unboundedPeriodCheckbox.id = unboundedPeriodId;
  unboundedPeriodCheckbox.setAttribute('data-mail-field', 'unboundedPeriod');
  unboundedPeriodCheckbox.checked = false;
  Object.assign(unboundedPeriodCheckbox.style, {
    flexShrink: '0',
    marginTop: '2px',
  });

  const unboundedPeriodLabel = doc.createElement('label');
  unboundedPeriodLabel.htmlFor = unboundedPeriodId;
  unboundedPeriodLabel.textContent = '기간 제한 없이 검색';
  Object.assign(unboundedPeriodLabel.style, {
    minWidth: '0',
    maxWidth: '100%',
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
  });

  periodRow.append(unboundedPeriodCheckbox, unboundedPeriodLabel);
  periodBox.append(periodGuideEl, periodRow);
  periodBox.hidden = true;
  editorBox.appendChild(periodBox);

  const editorActions = doc.createElement('div');
  editorActions.className = 'off-task-actions';
  Object.assign(editorActions.style, {
    gridColumn: '1 / -1',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    width: '100%',
    maxWidth: '100%',
    minWidth: '0',
    boxSizing: 'border-box',
  });
  const confirmBtn = createActionButton('confirm', '이 조건으로 찾기', false);
  const cancelBtn = createActionButton('cancel', '조건 편집 닫아두기', true);
  editorActions.append(confirmBtn, cancelBtn);
  editorBox.appendChild(editorActions);
  editorBox.hidden = true;

  const collapsedBox = doc.createElement('div');
  Object.assign(collapsedBox.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    width: '100%',
    maxWidth: '100%',
    minWidth: '0',
    boxSizing: 'border-box',
  });
  const collapsedActions = doc.createElement('div');
  collapsedActions.className = 'off-task-actions';
  Object.assign(collapsedActions.style, {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    width: '100%',
    maxWidth: '100%',
    minWidth: '0',
    boxSizing: 'border-box',
  });
  const editBtn = createActionButton('edit', '조건 편집 다시 열기', true);
  collapsedActions.appendChild(editBtn);
  collapsedBox.appendChild(collapsedActions);
  collapsedBox.hidden = true;

  const renewBox = doc.createElement('div');
  Object.assign(renewBox.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    width: '100%',
    maxWidth: '100%',
    minWidth: '0',
    boxSizing: 'border-box',
  });
  const renewActions = doc.createElement('div');
  renewActions.className = 'off-task-actions';
  Object.assign(renewActions.style, {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    width: '100%',
    maxWidth: '100%',
    minWidth: '0',
    boxSizing: 'border-box',
  });
  const renewBtn = createActionButton('renew', '다시 조건 확인', false);
  renewActions.appendChild(renewBtn);
  renewBox.appendChild(renewActions);
  renewBox.hidden = true;

  const statusEl = doc.createElement('p');
  statusEl.id = statusId;
  statusEl.className = 'off-task-note';
  statusEl.setAttribute('role', 'status');
  statusEl.setAttribute('aria-live', 'polite');
  statusEl.setAttribute('aria-atomic', 'true');
  Object.assign(statusEl.style, {
    margin: '0',
    maxWidth: '100%',
    minWidth: '0',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
  });
  statusEl.hidden = true;

  element.append(quotesBox, editorBox, collapsedBox, renewBox, statusEl);

  const fieldControls = new Map([
    ['terms', termsInput],
    ['from', fromInput],
    ['after', afterInput],
    ['through', throughInput],
    ['folder', folderSelect],
    ['provider', providerSelect],
    ['attachment', attachmentSelect],
    ['omit', omitCheckbox],
    ['unboundedPeriod', unboundedPeriodCheckbox],
  ]);

  let disposed = false;
  let hasReviewSnapshot = false;
  let currentReviewId = '';
  let currentQuotes = [];
  let currentUnmet = [];
  let currentProviders = normalizeProviders([]);
  let selectedProviderValue = 'all';
  let providerWarning = '';
  let localError = '';
  let invalidFieldKey = '';
  let isCollapsed = false;
  let pendingConfirm = false;
  let sawBusySinceConfirm = false;
  let acceptedForCurrentReview = false;
  let pendingRenew = false;
  let renewFocusGuard = null;
  let periodChoiceRequired = false;
  let currentPeriodScope = '';
  let initialPeriod = '';
  let currentRoleChoices = [];
  let currentRoleFilter = null;
  let currentRoleScope = '';
  let currentRoleSignature = '';
  let roleErrorActive = false;

  function buildRoleScope() {
    return JSON.stringify([
      currentReviewId,
      currentProviders.ordered,
      currentProviders.allowedSet ? [...currentProviders.allowedSet].sort() : null,
    ]);
  }

  function hasValidDateChoice() {
    if (!afterInput.value && !throughInput.value) return false;
    if (afterInput.validity.badInput || throughInput.validity.badInput) return false;
    return readMailFilterDraft({
      after: afterInput.value, through: throughInput.value,
      folder: 'received', provider: 'all', attachment: '',
    }).ok;
  }


  function stopRenewFocusTracking() {
    renewFocusGuard?.abort();
    renewFocusGuard = null;
  }

  let uiBusy = false;
  let uiNote = '';
  let uiAccepted = false;

  function setFieldInvalid(fieldKey) {
    invalidFieldKey = fieldKey || '';
    for (const [key, control] of fieldControls.entries()) {
      if (key === invalidFieldKey) {
        control.setAttribute('aria-invalid', 'true');
        control.setAttribute('aria-describedby', statusId);
      } else {
        control.removeAttribute('aria-invalid');
        control.removeAttribute('aria-describedby');
      }
    }
  }

  function clearDraftAndQuotes() {
    roleControls.reset();
    currentQuotes = [];
    currentUnmet = [];
    quotesListEl.replaceChildren();
    unmetListEl.replaceChildren();
    quotesBox.hidden = true;
    unmetBox.hidden = true;

    termsInput.value = '';
    fromInput.value = '';
    afterInput.value = '';
    throughInput.value = '';
    omitCheckbox.checked = false;
    periodChoiceRequired = false;
    currentPeriodScope = '';
    initialPeriod = '';
    unboundedPeriodCheckbox.checked = false;
    periodBox.hidden = true;
    currentRoleChoices = [];
    currentRoleFilter = null;
    currentRoleScope = '';
    currentRoleSignature = '';
    roleErrorActive = false;

    reconcileSelectOptions(doc, folderSelect, FOLDER_OPTIONS, 'received');
    selectedProviderValue = 'all';
    reconcileSelectOptions(
      doc,
      providerSelect,
      [{ value: 'all', label: '연결된 메일함 전체', disabled: false }],
      'all'
    );
    reconcileSelectOptions(
      doc,
      attachmentSelect,
      [
        { value: '', label: '첨부 제한 없음', disabled: false },
        { value: 'has', label: '첨부 있음', disabled: false },
      ],
      ''
    );

    providerWarning = '';
    localError = '';
    setFieldInvalid('');
    isCollapsed = false;
    pendingConfirm = false;
    sawBusySinceConfirm = false;
    acceptedForCurrentReview = false;
  }

  function syncFolderSelect(targetValue) {
    const raw = typeof targetValue === 'string' && targetValue ? targetValue : 'received';
    const defs = FOLDER_OPTIONS.some((item) => item.value === raw)
      ? FOLDER_OPTIONS
      : [...FOLDER_OPTIONS, { value: raw, label: `${raw} (지원 안 됨)`, disabled: true }];
    reconcileSelectOptions(doc, folderSelect, defs, raw);
  }

  function syncAttachmentSelect(targetValue) {
    const baseDefs = [
      { value: '', label: '첨부 제한 없음', disabled: false },
      { value: 'has', label: '첨부 있음', disabled: false },
    ];
    const effective = typeof targetValue === 'string' ? targetValue : '';
    const defs = baseDefs.some((item) => item.value === effective)
      ? baseDefs
      : [...baseDefs, { value: effective, label: `${effective} (지원 안 됨)`, disabled: true }];
    reconcileSelectOptions(doc, attachmentSelect, defs, effective);
  }

  function syncProviderSelect(targetValue) {
    const requested = targetValue || 'all';
    selectedProviderValue = requested;
    const allowed = currentProviders.allowedSet;
    const selectable = currentProviders.ordered.filter(box => box.connected && (!allowed || allowed.has(box.id)));
    const names = selectable.map(box => mailProviderLabel(box.id)).join(', ');
    const options = [{
      value: 'all',
      label: allowed
        ? names ? `조회할 메일함 전체 (${names})` : '조회할 메일함 전체 (사용 가능한 계정 없음)'
        : names ? '연결된 메일함 전체' : '연결된 메일함 전체 (연결 없음)',
      disabled: !selectable.length,
    }];
    for (const box of selectable) {
      options.push({value:box.id, label:formatProviderDisplay(box.id, box.address)});
    }

    providerWarning = '';
    if (!selectable.length) {
      providerWarning = allowed
        ? '이 업무에서 사용할 수 있는 메일함이 없습니다. 원래 사용하던 계정을 다시 연결해 주세요.'
        : '연결된 메일함이 없습니다. Gmail 또는 Outlook을 먼저 연결해 주세요.';
    }
    if (requested !== 'all' && !selectable.some(box => box.id === requested)) {
      const outOfScope = allowed && !allowed.has(requested);
      const label = mailProviderLabel(requested) || '메일함';
      options.push({value:requested, label:label + (outOfScope ? ' · 이 업무에서 사용 불가' : ' · 연결 끊김'), disabled:true});
      if (selectable.length) {
        providerWarning = outOfScope
          ? `선택한 ${label} 계정은 이 업무에서 사용할 수 없습니다. 허용된 메일함을 선택하거나 원래 계정을 연결해 주세요.`
          : `선택한 ${label} 연결이 끊어져 있습니다. 다시 연결하거나 사용할 메일함을 선택해 주세요.`;
      }
    }
    if (!providerWarning && invalidFieldKey === 'provider') {
      localError = '';
      setFieldInvalid('');
    }
    reconcileSelectOptions(doc, providerSelect, options, requested);
  }

  function renderQuotes(nextQuotes) {
    if (shallowEqualStrings(currentQuotes, nextQuotes)) return;
    currentQuotes = nextQuotes.slice();
    quotesListEl.replaceChildren();
    for (const quote of currentQuotes) {
      const li = doc.createElement('li');
      li.textContent = quote;
      Object.assign(li.style, {
        maxWidth: '100%',
        minWidth: '0',
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
      });
      quotesListEl.appendChild(li);
    }
  }

  function renderUnmet(nextUnmet, resetCheck) {
    const changed = !shallowEqualStrings(currentUnmet, nextUnmet);
    if (changed) {
      currentUnmet = nextUnmet.slice();
      unmetListEl.replaceChildren();
      for (const item of currentUnmet) {
        const li = doc.createElement('li');
        li.textContent = item;
        Object.assign(li.style, {
          maxWidth: '100%',
          minWidth: '0',
          overflowWrap: 'anywhere',
          wordBreak: 'break-word',
        });
        unmetListEl.appendChild(li);
      }
    }
    if (resetCheck || changed || currentUnmet.length === 0) {
      omitCheckbox.checked = false;
    }
  }

  function syncUiPresentation() {
    if (disposed || !hasReviewSnapshot) {
      element.hidden = true;
      return;
    }

    element.hidden = false;
    element.setAttribute('aria-busy', uiBusy ? 'true' : 'false');

    const hasValidReview = currentReviewId.length > 0;
    const isAccepted = acceptedForCurrentReview || uiAccepted;
    roleControls.setLocked(Boolean(!hasValidReview || uiBusy || isAccepted || pendingConfirm));

    if (!hasValidReview) {
      quotesBox.hidden = true;
      editorBox.hidden = true;
      collapsedBox.hidden = true;
      renewBox.hidden = false;
      renewBtn.disabled = Boolean(uiBusy || pendingRenew);
    } else if (isCollapsed) {
      quotesBox.hidden = true;
      editorBox.hidden = true;
      collapsedBox.hidden = false;
      renewBox.hidden = true;
      editBtn.disabled = Boolean(uiBusy || isAccepted);
    } else {
      quotesBox.hidden = currentQuotes.length === 0;
      editorBox.hidden = false;
      collapsedBox.hidden = true;
      renewBox.hidden = true;
      unmetBox.hidden = currentUnmet.length === 0;
      periodBox.hidden = !periodChoiceRequired;

      for (const control of fieldControls.values()) {
        const shouldDisable =
          isAccepted || (control === omitCheckbox && currentUnmet.length === 0) ||
          (control === unboundedPeriodCheckbox &&
            (!periodChoiceRequired || Boolean(afterInput.value || throughInput.value)));
        if (Boolean(control.disabled) !== shouldDisable) {
          control.disabled = shouldDisable;
        }
      }

      const unmetBlocked = currentUnmet.length > 0 && !omitCheckbox.checked;
      const providerBlocked = providerWarning.length > 0;
      const periodBlocked = periodChoiceRequired && (
        afterInput.validity.badInput || throughInput.validity.badInput ||
        (!hasValidDateChoice() && !unboundedPeriodCheckbox.checked)
      );
      const roleBlocked = Boolean(roleControls.missing());
      confirmBtn.disabled = Boolean(
        uiBusy || isAccepted || pendingConfirm || providerBlocked || unmetBlocked || periodBlocked || roleBlocked
      );
      cancelBtn.disabled = Boolean(uiBusy || isAccepted || pendingConfirm);
    }

    const messages = [];
    const pushUnique = (msg) => {
      const trimmed = typeof msg === 'string' ? msg.trim() : '';
      if (trimmed && !messages.includes(trimmed)) {
        messages.push(trimmed);
      }
    };

    if (hasValidReview && !isCollapsed && providerWarning) {
      pushUnique(providerWarning);
    }
    if (localError) {
      pushUnique(localError);
    }
    if (uiNote) {
      pushUnique(uiNote);
    } else if (uiBusy) {
      pushUnique('처리 중입니다…');
    } else if (hasValidReview && isAccepted) {
      pushUnique('메일 조건을 확정했습니다.');
    } else if (!hasValidReview) {
      pushUnique('‘다시 조건 확인’을 누르면 이 업무에 보관한 조건을 불러옵니다. 조건을 확인한 뒤에 검색합니다.');
    }

    const nextStatusText = messages.join('\n');
    if (nextStatusText) {
      if (statusEl.textContent !== nextStatusText) {
        statusEl.textContent = nextStatusText;
      }
      statusEl.hidden = false;
    } else {
      if (statusEl.textContent !== '') {
        statusEl.textContent = '';
      }
      statusEl.hidden = true;
    }
  }

  function syncLiveControlValues() {
    if (!currentReviewId) return;
    const liveProvider =
      typeof providerSelect.value === 'string' && providerSelect.value
        ? providerSelect.value
        : selectedProviderValue;
    if (liveProvider !== selectedProviderValue) {
      syncProviderSelect(liveProvider);
    }
    syncFolderSelect(folderSelect.value);
    syncAttachmentSelect(attachmentSelect.value);
  }

  function handleFieldEdited(fieldKey, event) {
    if (disposed || !hasReviewSnapshot) return;
    if (fieldKey === 'folder') syncFolderSelect(event.target.value);
    if (fieldKey === 'provider') syncProviderSelect(event.target.value);
    if (fieldKey === 'attachment') syncAttachmentSelect(event.target.value);
    if ((fieldKey === 'after' || fieldKey === 'through') &&
        (event.target.value || event.target.validity.badInput)) {
      unboundedPeriodCheckbox.checked = false;
    }
    if (currentReviewId && (fieldKey === 'from' || fieldKey === 'folder')) {
      roleControls.edited(fieldKey);
    }

    roleErrorActive = false;
    localError = '';
    setFieldInvalid('');
    syncUiPresentation();
  }

  function handleConfirm() {
    if (disposed || !hasReviewSnapshot || !currentReviewId || isCollapsed) return;

    syncLiveControlValues();

    if (uiBusy || uiAccepted || acceptedForCurrentReview || pendingConfirm) {
      return;
    }

    if (providerWarning) {
      localError = providerWarning;
      setFieldInvalid('provider');
      syncUiPresentation();
      providerSelect.focus();
      return;
    }

    if (currentUnmet.length > 0 && !omitCheckbox.checked) {
      localError = '지원하지 않는 조건을 빼기로 직접 체크해야 실행할 수 있습니다.';
      setFieldInvalid('omit');
      syncUiPresentation();
      omitCheckbox.focus();
      return;
    }

    for (const [key, label] of [['after','시작 날짜'], ['through','종료 날짜']]) {
      const control = fieldControls.get(key);
      if (!control.validity.badInput) continue;
      localError = `${label}를 연·월·일까지 입력하거나 완전히 비워 주세요.`;
      setFieldInvalid(key);
      syncUiPresentation();
      control.focus();
      return;
    }
    const parsed = readMailFilterDraft({
      terms: termsInput.value,
      from: fromInput.value,
      after: afterInput.value,
      through: throughInput.value,
      folder: folderSelect.value,
      provider: providerSelect.value,
      attachment: attachmentSelect.value,
    });

    if (!parsed.ok) {
      const fieldKey =
        parsed && typeof parsed.field === 'string' && fieldControls.has(parsed.field)
          ? parsed.field
          : '';
      const message =
        parsed && typeof parsed.message === 'string' && parsed.message.trim()
          ? parsed.message.trim()
          : '입력한 메일 조건을 다시 확인해 주세요.';
      localError = message;
      setFieldInvalid(fieldKey);
      syncUiPresentation();
      if (fieldKey) {
        fieldControls.get(fieldKey).focus();
      }
      return;
    }

    const missingRoleField = roleControls.missing();
    if (missingRoleField) {
      roleErrorActive = true;
      localError =
        missingRoleField === 'from'
          ? '보낸 사람 조건을 적용할지 선택하거나 직접 수정해 주세요.'
          : '폴더 조건을 적용할지 선택하거나 직접 수정해 주세요.';
      setFieldInvalid('');
      syncUiPresentation();
      roleControls.focusMissing(missingRoleField, statusId);
      return;
    }

    if (periodChoiceRequired && !parsed.filter.after && !parsed.filter.before && !unboundedPeriodCheckbox.checked) {
      roleErrorActive = false;
      localError = '조회 날짜를 한쪽 이상 입력하거나 기간 제한 없이 검색을 선택해 주세요.';
      setFieldInvalid('unboundedPeriod');
      syncUiPresentation();
      unboundedPeriodCheckbox.focus();
      return;
    }

    const roleDecisions = roleControls.decisions();
    roleErrorActive = false;
    localError = '';
    setFieldInvalid('');
    pendingConfirm = true;
    sawBusySinceConfirm = false;
    syncUiPresentation();

    if (typeof emit === 'function') {
      emit({
        act: 'task-mail-confirm',
        arg: taskId,
        fields: {
          reviewId: currentReviewId,
          filter: parsed.filter,
          ...(roleDecisions && Object.keys(roleDecisions).length > 0 ? { roleDecisions } : {}),
          ...(periodChoiceRequired && !parsed.filter.after && !parsed.filter.before && unboundedPeriodCheckbox.checked
            ? { allowUnboundedPeriod: true } : {}),
          ...(currentUnmet.length && omitCheckbox.checked ? { omitUnmet: true } : {}),
        },
      });
    }
  }

  function handleCancel() {
    if (disposed || !hasReviewSnapshot || !currentReviewId) return;
    if (uiBusy || uiAccepted || acceptedForCurrentReview || pendingConfirm) return;
    roleErrorActive = false;
    localError = '';
    setFieldInvalid('');
    unboundedPeriodCheckbox.checked = false;
    currentRoleScope = buildRoleScope();
    roleControls.reset();
    roleControls.update(currentRoleChoices, currentRoleFilter, currentRoleScope);
    isCollapsed = true;
    syncUiPresentation();
    editBtn.focus();
  }

  function handleEdit() {
    if (disposed || !hasReviewSnapshot || !currentReviewId) return;
    if (uiBusy || uiAccepted || acceptedForCurrentReview) return;
    isCollapsed = false;
    syncUiPresentation();
    termsInput.focus();
  }

  function handleRenew() {
    if (disposed || !hasReviewSnapshot || currentReviewId) return;
    if (uiBusy || pendingRenew) return;
    localError = '';
    pendingRenew = true;
    stopRenewFocusTracking();
    if (doc.activeElement === renewBtn) {
      renewFocusGuard = new AbortController();
      doc.addEventListener('focusin', event => {
        if (event.target !== renewBtn && event.target !== doc.body && event.target !== doc.documentElement) {
          stopRenewFocusTracking();
        }
      }, {capture:true, signal:renewFocusGuard.signal});
    }
    syncUiPresentation();
    if (typeof emit === 'function') {
      emit({
        act: 'task-mail-renew',
        arg: taskId,
      });
    }
  }

  listen(termsInput, 'input', (e) => handleFieldEdited('terms', e));
  listen(fromInput, 'input', (e) => handleFieldEdited('from', e));
  listen(afterInput, 'input', (e) => handleFieldEdited('after', e));
  listen(afterInput, 'change', (e) => handleFieldEdited('after', e));
  listen(throughInput, 'input', (e) => handleFieldEdited('through', e));
  listen(throughInput, 'change', (e) => handleFieldEdited('through', e));
  listen(folderSelect, 'change', (e) => handleFieldEdited('folder', e));
  listen(providerSelect, 'change', (e) => handleFieldEdited('provider', e));
  listen(attachmentSelect, 'change', (e) => handleFieldEdited('attachment', e));
  listen(omitCheckbox, 'change', (e) => handleFieldEdited('omit', e));
  listen(omitCheckbox, 'input', (e) => handleFieldEdited('omit', e));
  listen(unboundedPeriodCheckbox, 'change', (e) => handleFieldEdited('unboundedPeriod', e));

  listen(confirmBtn, 'click', (e) => {
    e.preventDefault();
    handleConfirm();
  });
  listen(cancelBtn, 'click', (e) => {
    e.preventDefault();
    handleCancel();
  });
  listen(editBtn, 'click', (e) => {
    e.preventDefault();
    handleEdit();
  });
  listen(renewBtn, 'click', (e) => {
    e.preventDefault();
    handleRenew();
  });

  listen(element, 'keydown', (e) => {
    if (disposed || !e || e.key !== 'Enter') return;
    if (e.isComposing || e.keyCode === 229 || e.altKey || e.shiftKey) return;
    if (!e.ctrlKey && !e.metaKey) return;

    if (e.target !== termsInput) return;

    e.preventDefault();
    handleConfirm();
  });

  function update(review, providers, ui) {
    if (disposed) return;

    currentProviders = normalizeProviders(providers);
    currentProviders.allowedSet = Array.isArray(review?.availableProviders)
      ? new Set(review.availableProviders.filter(id => id === 'gmail' || id === 'outlook'))
      : null;
    uiBusy = Boolean(ui && ui.busy);
    uiNote = ui && typeof ui.note === 'string' ? ui.note.trim() : '';
    uiAccepted = Boolean(ui && ui.accepted);

    if (!review || typeof review !== 'object') {
      stopRenewFocusTracking();
      hasReviewSnapshot = false;
      currentReviewId = '';
      pendingRenew = false;
      clearDraftAndQuotes();
      statusEl.textContent = '';
      element.hidden = true;
      return;
    }

    hasReviewSnapshot = true;
    const nextReviewId =
      typeof review.reviewId === 'string' ? review.reviewId.trim() : '';

    if (!nextReviewId) {
      if (currentReviewId) {
        currentReviewId = '';
      }
      clearDraftAndQuotes();
      if (!uiBusy) {
        pendingRenew = false;
        if (uiNote) stopRenewFocusTracking();
      }
      syncUiPresentation();
      return;
    }

    pendingRenew = false;
    const isNewRevision = nextReviewId !== currentReviewId;

    if (isNewRevision) {
      clearDraftAndQuotes();
      currentReviewId = nextReviewId;

      const safeDraft = makeMailFilterDraft(review.filter);
      termsInput.value = safeDraft.terms;
      fromInput.value = safeDraft.from;
      afterInput.value = safeDraft.after;
      throughInput.value = safeDraft.through;
      syncFolderSelect(safeDraft.folder);
      syncProviderSelect(safeDraft.provider);
      syncAttachmentSelect(safeDraft.attachment);

      renderQuotes(normalizeStringList(review.quotes));
      renderUnmet(normalizeStringList(review.unmet), true);

      if (uiAccepted) {
        acceptedForCurrentReview = true;
      }
    } else {
      const liveProvider =
        typeof providerSelect.value === 'string' && providerSelect.value
          ? providerSelect.value
          : selectedProviderValue;
      syncProviderSelect(liveProvider);
      renderQuotes(normalizeStringList(review.quotes));
      renderUnmet(normalizeStringList(review.unmet), false);

      if (uiAccepted) {
        acceptedForCurrentReview = true;
      }
      if (pendingConfirm) {
        if (uiBusy) {
          sawBusySinceConfirm = true;
        } else if (
          !acceptedForCurrentReview &&
          ui &&
          ui.busy === false &&
          (sawBusySinceConfirm || Boolean(uiNote))
        ) {
          pendingConfirm = false;
          sawBusySinceConfirm = false;
        }
      }
    }

    const proposedAfter = review.filter?.after || '';
    const proposedBefore = review.filter?.before || '';
    const nextInitialPeriod = JSON.stringify([proposedAfter, proposedBefore]);
    const nextRequired = (review.reason === 'period' || review.requiresPeriodChoice === true) &&
      !proposedAfter && !proposedBefore;
    const nextScope = JSON.stringify([
      review.reason, nextRequired, nextInitialPeriod,
      currentProviders.ordered, currentProviders.allowedSet && [...currentProviders.allowedSet].sort(),
    ]);
    if (nextScope !== currentPeriodScope) {
      unboundedPeriodCheckbox.checked = false;
      if (!isNewRevision && nextInitialPeriod !== initialPeriod) {
        const draft = makeMailFilterDraft(review.filter);
        afterInput.value = draft.after;
        throughInput.value = draft.through;
      }
      if (invalidFieldKey === 'unboundedPeriod') {
        localError = '';
        setFieldInvalid('');
      }
    }
    currentPeriodScope = nextScope;
    initialPeriod = nextInitialPeriod;
    periodChoiceRequired = nextRequired;

    const nextRoleChoices = Array.isArray(review.roleChoices) ? review.roleChoices : [];
    const nextRoleFilter = review.filter && typeof review.filter === 'object' ? review.filter : null;
    const nextRoleScope = buildRoleScope();
    const nextRoleSignature = JSON.stringify([
      nextRoleChoices,
      nextRoleFilter?.from ?? '',
      nextRoleFilter?.folder ?? '',
    ]);
    if (!isNewRevision && nextRoleScope !== currentRoleScope) {
      if (roleErrorActive) {
        roleErrorActive = false;
        localError = '';
      }
    } else if (roleErrorActive && nextRoleSignature !== currentRoleSignature) {
      roleErrorActive = false;
      localError = '';
    }
    currentRoleChoices = nextRoleChoices;
    currentRoleFilter = nextRoleFilter;
    currentRoleScope = nextRoleScope;
    currentRoleSignature = nextRoleSignature;
    roleControls.update(nextRoleChoices, review.filter, nextRoleScope);
    if (roleErrorActive && !roleControls.missing()) {
      roleErrorActive = false;
      localError = '';
    }

    syncUiPresentation();
    if (isNewRevision && renewFocusGuard) {
      const active = doc.activeElement;
      const focusUnmoved = !active || active === doc.body || active === doc.documentElement || active === renewBtn;
      stopRenewFocusTracking();
      if (focusUnmoved && !isCollapsed && !termsInput.disabled) termsInput.focus();
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    stopRenewFocusTracking();

    for (const cleanup of cleanups.splice(0)) cleanup();

    hasReviewSnapshot = false;
    currentReviewId = '';
    uiBusy = false;
    uiNote = '';
    uiAccepted = false;
    pendingRenew = false;
    clearDraftAndQuotes();
    statusEl.textContent = '';
    element.hidden = true;

    element.remove();
  }

  return {
    element,
    update,
    dispose,
  };
}
