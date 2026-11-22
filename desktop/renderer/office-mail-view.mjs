import { mailProviderLabel, mailCodeText } from './office-mail-model.mjs';

let instanceCounter = 0;

const MAIL_MODE_OPTIONS = [
  { value: 'auto', label: '자동' },
  { value: 'mail', label: '메일 검색' },
  { value: 'general', label: '일반 업무' },
  { value: 'quote', label: '미회신 견적 문의 넘기기' },
];

function toOptionValue(value) {
  if (value === true || value === 'mail') return 'mail';
  if (value === false || value === 'general') return 'general';
  if (value === 'quote') return 'quote';
  return 'auto';
}

function toEnabledValue(optionValue) {
  if (optionValue === 'mail') return true;
  if (optionValue === 'general') return false;
  if (optionValue === 'quote') return 'quote';
  return null;
}

export function createMailModePicker(doc = globalThis.document, emit) {
  if (!doc || typeof doc.createElement !== 'function') {
    throw new TypeError('A valid document instance is required.');
  }

  instanceCounter += 1;
  const selectId = `office-mail-mode-select-${instanceCounter}`;

  const element = doc.createElement('label');
  if (typeof element.setAttribute === 'function') {
    element.setAttribute('class', 'off-task-field');
  }
  element.className = 'off-task-field';

  element.htmlFor = selectId;
  const label = doc.createElement('span');
  label.textContent = '업무 처리 방식';

  const select = doc.createElement('select');
  if (typeof select.setAttribute === 'function') {
    select.setAttribute('id', selectId);
    select.setAttribute('class', 'office-select');
    select.setAttribute('data-office-mail-mode', '');
    select.setAttribute('aria-label', '업무 처리 방식');
  }
  select.id = selectId;
  select.className = 'office-select';
  if (select.dataset && select.dataset.officeMailMode === undefined) {
    select.dataset.officeMailMode = '';
  }

  const optionElements = MAIL_MODE_OPTIONS.map((item) => {
    const option = doc.createElement('option');
    if (typeof option.setAttribute === 'function') {
      option.setAttribute('value', item.value);
    }
    option.value = item.value;
    option.textContent = item.label;
    option.selected = item.value === 'auto';
    select.appendChild(option);
    return option;
  });

  select.value = 'auto';

  function syncSelectedOptions(targetValue) {
    for (const option of optionElements) {
      const shouldSelect = option.value === targetValue;
      if (option.selected !== shouldSelect) {
        option.selected = shouldSelect;
      }
    }
  }

  function handleChange(event) {
    const rawValue =
      event && event.target && typeof event.target.value === 'string'
        ? event.target.value
        : select.value;
    const nextOptionValue =
      rawValue === 'mail' || rawValue === 'general' || rawValue === 'quote'
        ? rawValue
        : 'auto';

    if (select.value !== nextOptionValue) {
      select.value = nextOptionValue;
    }
    syncSelectedOptions(nextOptionValue);

    if (typeof emit === 'function') {
      emit({
        act: 'task-mail-mode',
        fields: {
          enabled: toEnabledValue(nextOptionValue),
        },
      });
    }
  }

  if (typeof select.addEventListener === 'function') {
    select.addEventListener('change', handleChange);
  } else {
    select.onchange = handleChange;
  }

  function update(value) {
    const nextOptionValue = toOptionValue(value);
    if (select.value === nextOptionValue) {
      return;
    }
    select.value = nextOptionValue;
    syncSelectedOptions(nextOptionValue);
  }

  element.appendChild(label);
  element.appendChild(select);

  return {
    element,
    update,
  };
}

export function createOfficeMailControls(doc, emit) {
  const d = doc || document;
  const PROVIDER_IDS = ['gmail', 'outlook'];

  const setStyles = (el, styles) => {
    if (!el || !el.style) return;
    for (const [key, value] of Object.entries(styles)) {
      if (el.style[key] !== value) {
        el.style[key] = value;
      }
    }
  };

  const setText = (el, next) => {
    const value = next == null ? '' : String(next);
    if (el.textContent !== value) {
      el.textContent = value;
    }
  };

  const setHidden = (el, hidden) => {
    const next = Boolean(hidden);
    if (el.hidden !== next) {
      el.hidden = next;
    }
  };

  const setDisabled = (el, disabled) => {
    const next = Boolean(disabled);
    if (el.disabled !== next) {
      el.disabled = next;
    }
  };

  const detachNode = (parent, node) => {
    setHidden(node, true);
    if (typeof parent.removeChild === 'function') {
      try {
        parent.removeChild(node);
        return;
      } catch {
        // Ignore if already detached in custom DOM stubs
      }
    }
    if (typeof node.remove === 'function') {
      node.remove();
    } else if (Array.isArray(parent.children)) {
      const idx = parent.children.indexOf(node);
      if (idx !== -1) parent.children.splice(idx, 1);
    }
  };

  const syncButtons = (parent, mounted, desired) => {
    if (
      mounted.length === desired.length &&
      mounted.every((btn, idx) => btn === desired[idx])
    ) {
      return;
    }

    for (const btn of mounted) {
      if (!desired.includes(btn)) {
        detachNode(parent, btn);
      }
    }

    const kept = mounted.filter((btn) => desired.includes(btn));
    if (
      desired.length === 2 &&
      kept.length === 1 &&
      kept[0] === desired[1] &&
      typeof parent.insertBefore === 'function'
    ) {
      setHidden(desired[0], false);
      parent.insertBefore(desired[0], desired[1]);
    } else {
      for (let i = 0; i < desired.length; i += 1) {
        const btn = desired[i];
        setHidden(btn, false);
        if (kept[i] !== btn) {
          parent.appendChild(btn);
        }
      }
    }

    mounted.length = 0;
    mounted.push(...desired);
  };

  const getSupportedLabel = (id) => {
    if (!PROVIDER_IDS.includes(id)) return '';
    if (typeof mailProviderLabel === 'function') {
      return String(mailProviderLabel(id) ?? '');
    }
    return id === 'gmail' ? 'Gmail' : 'Outlook';
  };

  const root = d.createElement('div');
  root.className = 'off-mail-controls';
  setHidden(root, true);
  setStyles(root, {
    display: 'none',
    gap: '10px',
    width: '100%',
    minWidth: '0',
    boxSizing: 'border-box',
  });

  const modePicker =
    typeof createMailModePicker === 'function'
      ? createMailModePicker(d, emit)
      : null;
  if (modePicker && modePicker.element) {
    root.appendChild(modePicker.element);
  }

  const codeNoteEl = d.createElement('p');
  codeNoteEl.className = 'off-task-note';
  codeNoteEl.setAttribute('role', 'alert');
  setHidden(codeNoteEl, true);
  setStyles(codeNoteEl, {
    margin: '0',
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
  });
  root.appendChild(codeNoteEl);

  const listEl = d.createElement('div');
  listEl.className = 'off-mail-provider-list';
  setStyles(listEl, {
    display: 'grid',
    gap: '8px',
    width: '100%',
    minWidth: '0',
  });
  root.appendChild(listEl);

  const createActionButton = (attrName, act, id) => {
    const btn = d.createElement('button');
    btn.type = 'button';
    btn.setAttribute(attrName, id);
    setStyles(btn, {
      whiteSpace: 'nowrap',
    });
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      if (typeof emit === 'function') {
        emit({ act, arg: id });
      }
    });
    return btn;
  };

  const rows = new Map();
  for (const id of PROVIDER_IDS) {
    const rowEl = d.createElement('div');
    rowEl.className = 'off-mail-provider-row';
    rowEl.setAttribute('data-office-mail-provider', id);
    setStyles(rowEl, {
      display: 'grid',
      gap: '6px',
      padding: '10px 12px',
      border: '1px solid rgba(128, 128, 128, 0.25)',
      borderRadius: '10px',
      minWidth: '0',
      boxSizing: 'border-box',
    });

    const topEl = d.createElement('div');
    setStyles(topEl, {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '8px',
      minWidth: '0',
    });

    const infoEl = d.createElement('div');
    setStyles(infoEl, {
      display: 'grid',
      gap: '2px',
      flex: '1 1 160px',
      minWidth: '0',
    });

    const labelEl = d.createElement('strong');
    setText(labelEl, getSupportedLabel(id));
    setStyles(labelEl, {
      lineHeight: '1.35',
    });
    infoEl.appendChild(labelEl);

    const statusEl = d.createElement('span');
    statusEl.className = 'off-task-note';
    setHidden(statusEl, true);
    setStyles(statusEl, {
      margin: '0',
      overflowWrap: 'anywhere',
      wordBreak: 'break-word',
      lineHeight: '1.4',
    });
    infoEl.appendChild(statusEl);

    const actionsEl = d.createElement('div');
    actionsEl.className = 'off-task-actions';
    setStyles(actionsEl, {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: '6px',
    });

    topEl.appendChild(infoEl);
    topEl.appendChild(actionsEl);
    rowEl.appendChild(topEl);

    const noteEl = d.createElement('p');
    noteEl.className = 'off-task-note';
    setHidden(noteEl, true);
    setStyles(noteEl, {
      margin: '0',
      overflowWrap: 'anywhere',
      wordBreak: 'break-word',
      lineHeight: '1.4',
    });
    rowEl.appendChild(noteEl);

    listEl.appendChild(rowEl);

    rows.set(id, {
      rowEl,
      labelEl,
      statusEl,
      actionsEl,
      noteEl,
      connectBtn: createActionButton(
        'data-office-mail-connect',
        'task-mail-connect',
        id
      ),
      disconnectBtn: createActionButton(
        'data-office-mail-disconnect',
        'task-mail-disconnect',
        id
      ),
      mountedBtns: [],
    });
  }

  const retentionNoteEl = d.createElement('p');
  retentionNoteEl.className = 'off-task-note';
  setText(
    retentionNoteEl,
    '이 PC의 연결을 해제해도 보관한 검색 결과는 남습니다.'
  );
  setHidden(retentionNoteEl, true);
  setStyles(retentionNoteEl, {
    margin: '0',
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
    lineHeight: '1.4',
  });
  root.appendChild(retentionNoteEl);

  function update(mail, ui, mode) {
    if (modePicker && typeof modePicker.update === 'function') {
      modePicker.update(mode);
    }

    if (!mail || typeof mail !== 'object') {
      setHidden(root, true);
      setStyles(root, { display: 'none' });

      setText(codeNoteEl, '');
      setHidden(codeNoteEl, true);
      setHidden(retentionNoteEl, true);

      for (const row of rows.values()) {
        setText(row.statusEl, '');
        setHidden(row.statusEl, true);
        setText(row.noteEl, '');
        setHidden(row.noteEl, true);
        setDisabled(row.connectBtn, false);
        setDisabled(row.disconnectBtn, false);
        syncButtons(row.actionsEl, row.mountedBtns, []);
      }
      return;
    }

    setHidden(root, false);
    setStyles(root, { display: 'grid' });
    setHidden(retentionNoteEl, false);

    const rawCode = mail.code;
    const errorText =
      rawCode && typeof mailCodeText === 'function'
        ? String(mailCodeText(rawCode) ?? '').trim()
        : '';
    setText(codeNoteEl, errorText);
    setHidden(codeNoteEl, !errorText);

    const safeUi = ui && typeof ui === 'object' ? ui : {};
    const providerNotes =
      safeUi.providerNotes && typeof safeUi.providerNotes === 'object'
        ? safeUi.providerNotes
        : null;
    const rawPending =
      typeof safeUi.pendingProvider === 'string'
        ? safeUi.pendingProvider.trim().toLowerCase()
        : '';
    const pendingId = PROVIDER_IDS.includes(rawPending) ? rawPending : '';
    const isBusy = Boolean(pendingId);

    const providerMap = new Map();
    if (Array.isArray(mail.providers)) {
      for (const entry of mail.providers) {
        if (!entry || typeof entry !== 'object') continue;
        const entryId =
          typeof entry.id === 'string' ? entry.id.trim().toLowerCase() : '';
        if (PROVIDER_IDS.includes(entryId)) {
          providerMap.set(entryId, entry);
        }
      }
    }

    for (const id of PROVIDER_IDS) {
      const row = rows.get(id);
      const label = getSupportedLabel(id);
      setText(row.labelEl, label);

      const p = providerMap.get(id);
      const configured = Boolean(p && p.configured);
      const connected = Boolean(p && p.connected);
      const reconnect = Boolean(p && p.reconnect);
      const address =
        p && typeof p.address === 'string' ? p.address.trim() : '';

      let statusText = '';
      const desiredBtns = [];

      if (!configured) {
        if ((connected || reconnect) && address) {
          statusText = `${address} · 설정 필요`;
        } else {
          statusText = '설정 필요';
        }
        if (connected || reconnect) {
          setText(row.disconnectBtn, '연결 해제');
          setDisabled(row.disconnectBtn, isBusy);
          desiredBtns.push(row.disconnectBtn);
        }
      } else if (reconnect) {
        statusText = address ? `${address} · 다시 연결 필요` : '다시 연결 필요';
        setText(row.connectBtn, '다시 연결');
        setDisabled(row.connectBtn, isBusy);
        setText(row.disconnectBtn, '연결 해제');
        setDisabled(row.disconnectBtn, isBusy);
        desiredBtns.push(row.connectBtn, row.disconnectBtn);
      } else if (connected) {
        statusText = address || '연결됨';
        setText(row.disconnectBtn, '연결 해제');
        setDisabled(row.disconnectBtn, isBusy);
        desiredBtns.push(row.disconnectBtn);
      } else {
        setText(row.connectBtn, '연결');
        setDisabled(row.connectBtn, isBusy);
        desiredBtns.push(row.connectBtn);
      }

      setText(row.statusEl, statusText);
      setHidden(row.statusEl, !statusText);
      syncButtons(row.actionsEl, row.mountedBtns, desiredBtns);

      const customNote =
        providerNotes && typeof providerNotes[id] === 'string'
          ? providerNotes[id].trim()
          : '';
      const progressNote =
        pendingId === id ? `${label} 공식 창에서 진행 중입니다.` : '';
      const rowNoteText = customNote || progressNote;

      setText(row.noteEl, rowNoteText);
      setHidden(row.noteEl, !rowNoteText);
    }
  }

  return { element: root, update };
}

export function createOfficeMailResults(doc, emit, taskId) {
  const SAFE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
  const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
  const NUMERIC_TIMESTAMP_PATTERN = /^-?\d{10,15}$/;

  function normalizeId(value) {
    if (typeof value !== 'string') {
      return '';
    }
    return SAFE_ID_PATTERN.test(value) ? value : '';
  }

  function createFormatter(options) {
    try {
      return new Intl.DateTimeFormat('ko-KR', options);
    } catch {
      return null;
    }
  }

  const safeTaskId = normalizeId(taskId);
  const canEmitOpen = safeTaskId.length > 0 && typeof emit === 'function';
  const dateOnlyFormatter = createFormatter({ dateStyle: 'medium' });
  const dateTimeFormatter = createFormatter({ dateStyle: 'medium', timeStyle: 'short' });

  function formatMailDate(rawDate) {
    if (typeof rawDate !== 'string' && typeof rawDate !== 'number') {
      return '';
    }

    let parsedDate = null;
    let isDateOnly = false;

    if (typeof rawDate === 'number') {
      if (!Number.isFinite(rawDate)) {
        return '';
      }
      parsedDate = new Date(rawDate);
    } else {
      const trimmed = rawDate.trim();
      if (trimmed.length === 0) {
        return '';
      }

      const dateMatch = DATE_ONLY_PATTERN.exec(trimmed);
      if (dateMatch) {
        const year = Number(dateMatch[1]);
        const month = Number(dateMatch[2]);
        const day = Number(dateMatch[3]);
        const candidate = new Date(year, month - 1, day);
        if (
          candidate.getFullYear() !== year ||
          candidate.getMonth() !== month - 1 ||
          candidate.getDate() !== day
        ) {
          return '';
        }
        parsedDate = candidate;
        isDateOnly = true;
      } else if (NUMERIC_TIMESTAMP_PATTERN.test(trimmed)) {
        const timestamp = Number(trimmed);
        if (!Number.isFinite(timestamp)) {
          return '';
        }
        parsedDate = new Date(timestamp);
      } else {
        parsedDate = new Date(trimmed);
      }
    }

    if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
      return '';
    }

    const formatter = isDateOnly ? dateOnlyFormatter : dateTimeFormatter;
    if (formatter) {
      return formatter.format(parsedDate);
    }
    return isDateOnly ? parsedDate.toLocaleDateString() : parsedDate.toLocaleString();
  }

  function resolveProviderLabel(provider) {
    if (typeof provider !== 'string') {
      return '알 수 없는 메일함';
    }
    const trimmed = provider.trim();
    if (trimmed.length === 0) {
      return '알 수 없는 메일함';
    }
    const label = mailProviderLabel(trimmed);
    if (typeof label === 'string' && label.trim().length > 0) {
      return label.trim();
    }
    return '알 수 없는 메일함';
  }

  function resolveCodeMessage(code) {
    if (typeof code !== 'string') {
      return '';
    }
    const trimmed = code.trim();
    if (trimmed.length === 0) {
      return '';
    }
    const message = mailCodeText(trimmed);
    if (typeof message === 'string' && message.trim().length > 0) {
      return message.trim();
    }
    return '이 메일함을 확인하는 중 문제가 발생했습니다.';
  }

  function normalizeMailResult(mailResult) {
    if (!mailResult || typeof mailResult !== 'object' || Array.isArray(mailResult)) {
      return null;
    }

    const scope = typeof mailResult.scope === 'string' ? mailResult.scope.trim() : '';
    const rawGroups = Array.isArray(mailResult.groups) ? mailResult.groups : [];

    const groups = rawGroups.map((rawGroup) => {
      const groupObj = rawGroup && typeof rawGroup === 'object' ? rawGroup : {};
      const providerLabel = resolveProviderLabel(groupObj.provider);
      const address = typeof groupObj.address === 'string' ? groupObj.address.trim() : '';
      const codeMessage = resolveCodeMessage(groupObj.code);
      const more = groupObj.more === true;
      const rawItems = Array.isArray(groupObj.items) ? groupObj.items : [];

      const items = [];
      for (let i = 0; i < rawItems.length; i += 1) {
        const rawItem = rawItems[i];
        if (!rawItem || typeof rawItem !== 'object') {
          continue;
        }

        const id = normalizeId(rawItem.id);
        const rawSubject = typeof rawItem.subject === 'string' ? rawItem.subject.trim() : '';
        const subject = rawSubject.length > 0 ? rawSubject : '(제목 없음)';
        const from = typeof rawItem.from === 'string' ? rawItem.from.trim() : '';
        const dateText = formatMailDate(rawItem.date);
        const snippet = typeof rawItem.snippet === 'string' ? rawItem.snippet.trim() : '';

        items.push({
          id,
          subject,
          from,
          dateText,
          snippet,
        });
      }

      return {
        providerLabel,
        address,
        codeMessage,
        more,
        items,
      };
    });

    return {
      scope,
      groups,
    };
  }

  function clearChildren(node) {
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  const rootEl = doc.createElement('section');
  rootEl.hidden = true;
  rootEl.setAttribute('aria-label', '메일 검색 결과');
  rootEl.style.width = '100%';
  rootEl.style.minWidth = '0';

  const topMetaEl = doc.createElement('div');
  topMetaEl.hidden = true;
  topMetaEl.style.minWidth = '0';
  topMetaEl.style.paddingBottom = '0.35rem';
  topMetaEl.style.marginBottom = '0.4rem';
  topMetaEl.style.borderBottom = '1px solid rgba(128, 128, 128, 0.2)';

  const scopeEl = doc.createElement('p');
  scopeEl.className = 'off-task-note';
  scopeEl.hidden = true;
  scopeEl.style.margin = '0';
  scopeEl.style.overflowWrap = 'anywhere';

  const noticeEl = doc.createElement('p');
  noticeEl.className = 'off-task-note';
  noticeEl.setAttribute('role', 'status');
  noticeEl.hidden = true;
  noticeEl.style.margin = '0';
  noticeEl.style.overflowWrap = 'anywhere';

  topMetaEl.appendChild(scopeEl);
  topMetaEl.appendChild(noticeEl);

  const groupsEl = doc.createElement('div');
  groupsEl.style.width = '100%';
  groupsEl.style.minWidth = '0';

  rootEl.appendChild(topMetaEl);
  rootEl.appendChild(groupsEl);

  let currentSnapshotKey = '';
  let currentNotice = '';

  function syncTopMetaLayout() {
    const hasScope = !scopeEl.hidden;
    const hasNotice = !noticeEl.hidden;
    topMetaEl.hidden = !hasScope && !hasNotice;
    noticeEl.style.marginTop = hasScope && hasNotice ? '0.2rem' : '0';
  }

  function patchNotice(rawNotice) {
    const nextNotice = typeof rawNotice === 'string' ? rawNotice.trim() : '';
    const hideNotice = nextNotice.length === 0;
    if (noticeEl.hidden !== hideNotice) {
      noticeEl.hidden = hideNotice;
    }
    if (currentNotice !== nextNotice) {
      noticeEl.textContent = nextNotice;
      currentNotice = nextNotice;
    }
    syncTopMetaLayout();
  }

  function renderItem(item, itemIndex) {
    const itemEl = doc.createElement('li');
    itemEl.style.minWidth = '0';
    if (itemIndex > 0) {
      itemEl.style.marginTop = '0.4rem';
      itemEl.style.paddingTop = '0.4rem';
      itemEl.style.borderTop = '1px solid rgba(128, 128, 128, 0.14)';
    } else {
      itemEl.style.paddingTop = '0.15rem';
    }

    const subjectWrapEl = doc.createElement('div');
    subjectWrapEl.className = 'off-task-copy';
    subjectWrapEl.style.overflowWrap = 'anywhere';

    const subjectStrongEl = doc.createElement('strong');
    subjectStrongEl.textContent = item.subject;
    subjectWrapEl.appendChild(subjectStrongEl);
    itemEl.appendChild(subjectWrapEl);

    let metaText = '';
    if (item.from.length > 0 && item.dateText.length > 0) {
      metaText = `${item.from} · ${item.dateText}`;
    } else if (item.from.length > 0) {
      metaText = item.from;
    } else if (item.dateText.length > 0) {
      metaText = item.dateText;
    }

    if (metaText.length > 0) {
      const metaEl = doc.createElement('p');
      metaEl.className = 'off-task-note';
      metaEl.style.margin = '0.12rem 0 0 0';
      metaEl.style.overflowWrap = 'anywhere';
      metaEl.textContent = metaText;
      itemEl.appendChild(metaEl);
    }

    if (item.snippet.length > 0) {
      const snippetEl = doc.createElement('p');
      snippetEl.className = 'off-task-copy';
      snippetEl.style.margin = '0.2rem 0 0 0';
      snippetEl.style.overflowWrap = 'anywhere';
      snippetEl.style.display = '-webkit-box';
      snippetEl.style.webkitBoxOrient = 'vertical';
      snippetEl.style.webkitLineClamp = '3';
      snippetEl.style.overflow = 'hidden';
      snippetEl.textContent = item.snippet;
      itemEl.appendChild(snippetEl);
    }

    if (canEmitOpen && item.id.length > 0) {
      const actionsEl = doc.createElement('div');
      actionsEl.className = 'off-task-actions';
      actionsEl.style.marginTop = '0.28rem';

      const openBtn = doc.createElement('button');
      openBtn.type = 'button';
      openBtn.setAttribute('data-office-mail-open', item.id);
      openBtn.textContent = '원문 열기';

      const itemId = item.id;
      openBtn.addEventListener('click', () => {
        emit({
          act: 'task-mail-open',
          arg: safeTaskId,
          fields: { itemId },
        });
      });

      actionsEl.appendChild(openBtn);
      itemEl.appendChild(actionsEl);
    }

    return itemEl;
  }

  function renderGroup(group, groupIndex) {
    const groupEl = doc.createElement('section');
    groupEl.style.width = '100%';
    groupEl.style.minWidth = '0';

    if (groupIndex > 0) {
      groupEl.style.marginTop = '0.5rem';
      groupEl.style.paddingTop = '0.45rem';
      groupEl.style.borderTop = '1px solid rgba(128, 128, 128, 0.2)';
    }

    const headEl = doc.createElement('div');
    headEl.className = 'off-task-head';

    const titleEl = doc.createElement('strong');
    titleEl.className = 'off-task-copy';
    titleEl.style.minWidth = '0';
    titleEl.style.overflowWrap = 'anywhere';
    titleEl.textContent =
      group.address.length > 0
        ? `${group.providerLabel} · ${group.address}`
        : group.providerLabel;
    headEl.appendChild(titleEl);

    const itemCount = group.items.length;
    const hasError = group.codeMessage.length > 0;
    const isEmptyWithoutNotice = itemCount === 0 && !hasError && !group.more;

    if (itemCount > 0 || isEmptyWithoutNotice) {
      const statusEl = doc.createElement('span');
      statusEl.className = 'off-task-status';
      statusEl.textContent = group.more || hasError ? `표시된 ${itemCount}건` : `${itemCount}건`;
      headEl.appendChild(statusEl);
    }

    groupEl.appendChild(headEl);

    if (itemCount > 0) {
      const listEl = doc.createElement('ul');
      listEl.style.listStyle = 'none';
      listEl.style.margin = '0.2rem 0 0 0';
      listEl.style.padding = '0';
      listEl.style.width = '100%';
      listEl.style.minWidth = '0';

      for (let i = 0; i < itemCount; i += 1) {
        listEl.appendChild(renderItem(group.items[i], i));
      }
      groupEl.appendChild(listEl);
    }

    if (hasError) {
      const codeNoteEl = doc.createElement('p');
      codeNoteEl.className = 'off-task-note';
      codeNoteEl.style.margin = '0.25rem 0 0 0';
      codeNoteEl.style.overflowWrap = 'anywhere';
      if (itemCount > 0 && !group.codeMessage.includes('일부')) {
        codeNoteEl.textContent = `일부 조회 실패 · ${group.codeMessage}`;
      } else {
        codeNoteEl.textContent = group.codeMessage;
      }
      groupEl.appendChild(codeNoteEl);
    }

    if (group.more) {
      const moreNoteEl = doc.createElement('p');
      moreNoteEl.className = 'off-task-note';
      moreNoteEl.style.margin = '0.25rem 0 0 0';
      moreNoteEl.textContent = '조건에 맞는 메일이 더 있습니다.';
      groupEl.appendChild(moreNoteEl);
    }

    return groupEl;
  }

  function renderSnapshot(snapshot) {
    if (snapshot.scope.length > 0) {
      scopeEl.textContent = snapshot.scope;
      scopeEl.hidden = false;
    } else {
      scopeEl.textContent = '';
      scopeEl.hidden = true;
    }
    syncTopMetaLayout();

    clearChildren(groupsEl);

    if (snapshot.groups.length === 0) {
      const emptyEl = doc.createElement('p');
      emptyEl.className = 'off-task-note';
      emptyEl.style.margin = '0';
      emptyEl.textContent = '조건에 맞는 메일이 없습니다.';
      groupsEl.appendChild(emptyEl);
      return;
    }

    const groupsWithItems = [];
    const groupsWithoutItems = [];

    for (let i = 0; i < snapshot.groups.length; i += 1) {
      const group = snapshot.groups[i];
      if (group.items.length > 0) {
        groupsWithItems.push(group);
      } else {
        groupsWithoutItems.push(group);
      }
    }

    const orderedGroups = groupsWithItems.concat(groupsWithoutItems);
    for (let i = 0; i < orderedGroups.length; i += 1) {
      groupsEl.appendChild(renderGroup(orderedGroups[i], i));
    }
  }

  function resetAll() {
    currentSnapshotKey = '';
    currentNotice = '';
    scopeEl.textContent = '';
    scopeEl.hidden = true;
    noticeEl.textContent = '';
    noticeEl.hidden = true;
    topMetaEl.hidden = true;
    clearChildren(groupsEl);
    rootEl.hidden = true;
  }

  function update(mailResult, notice) {
    const nextSnapshot = normalizeMailResult(mailResult);
    if (!nextSnapshot) {
      resetAll();
      return;
    }

    if (rootEl.hidden) {
      rootEl.hidden = false;
    }

    const nextSnapshotKey = JSON.stringify(nextSnapshot);
    if (currentSnapshotKey !== nextSnapshotKey) {
      currentSnapshotKey = nextSnapshotKey;
      renderSnapshot(nextSnapshot);
    }

    patchNotice(notice);
  }

  return {
    element: rootEl,
    update,
  };
}
