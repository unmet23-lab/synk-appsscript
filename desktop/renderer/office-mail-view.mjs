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

  const PAGING_PROVIDERS = new Set(['gmail', 'outlook']);
  const PERMANENT_PAGE_ERROR_NOTICES = {
    MAIL_CHANGED: '검색 뒤 메일함이 바뀌어 이어서 불러올 수 없으며 기존 목록은 보관됐습니다. 업무 입력란에 같은 조건을 다시 적어 새 메일 검색을 할 수 있습니다.',
    MAIL_PAGE_RESTART: '이전 형식의 결과라 이어서 불러올 위치를 확인할 수 없습니다. 기존 목록은 보관됐습니다. 업무 입력란에 같은 조건을 다시 적어 새 메일 검색을 할 수 있습니다.',
  };

  function normalizeProvider(value) {
    if (typeof value !== 'string') {
      return '';
    }
    const lowered = value.trim().toLowerCase();
    return SAFE_ID_PATTERN.test(lowered) ? lowered : '';
  }

  function normalizePage(value) {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
      ? value
      : null;
  }

  function normalizeMailResult(mailResult) {
    if (!mailResult || typeof mailResult !== 'object' || Array.isArray(mailResult)) {
      return null;
    }

    const scope = typeof mailResult.scope === 'string' ? mailResult.scope.trim() : '';
    const rawGroups = Array.isArray(mailResult.groups) ? mailResult.groups : [];
    const seenKeys = new Set();

    const groups = rawGroups.map((rawGroup, groupIdx) => {
      const groupObj = rawGroup && typeof rawGroup === 'object' ? rawGroup : {};
      const provider = normalizeProvider(groupObj.provider);
      const providerLabel = resolveProviderLabel(groupObj.provider);
      const address = typeof groupObj.address === 'string' ? groupObj.address.trim() : '';
      const codeMessage = resolveCodeMessage(groupObj.code);
      const more = groupObj.more === true;
      const page = normalizePage(groupObj.page);
      const rawItems = Array.isArray(groupObj.items) ? groupObj.items : [];

      let key =
        provider.length > 0
          ? `provider:${provider}`
          : `group:${groupIdx}:${providerLabel}:${address}`;
      if (seenKeys.has(key)) {
        key = `${key}#${groupIdx}`;
      }
      seenKeys.add(key);

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
        key,
        provider,
        providerLabel,
        address,
        codeMessage,
        more,
        page,
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

  const groupRecords = new Map();
  let emptyEl = null;

  function getChildList(node) {
    if (node.childNodes && typeof node.childNodes.length === 'number') {
      return node.childNodes;
    }
    if (node.children && typeof node.children.length === 'number') {
      return node.children;
    }
    return [];
  }

  function syncContainerChildren(container, desiredNodes) {
    const desiredSet = new Set(desiredNodes);
    const existing = Array.from(getChildList(container));
    for (let i = 0; i < existing.length; i += 1) {
      if (!desiredSet.has(existing[i])) {
        container.removeChild(existing[i]);
      }
    }
    for (let i = 0; i < desiredNodes.length; i += 1) {
      const desired = desiredNodes[i];
      const live = getChildList(container);
      const current = i < live.length ? live[i] : null;
      if (current !== desired) {
        if (current && typeof container.insertBefore === 'function') {
          container.insertBefore(desired, current);
        } else {
          container.appendChild(desired);
        }
      }
    }
  }

  function getActiveElement() {
    try {
      return doc && doc.activeElement ? doc.activeElement : null;
    } catch {
      return null;
    }
  }

  function isUnfocusedOrBody(el) {
    return !el || el === doc.body || el === doc.documentElement;
  }

  function focusSafely(target) {
    if (!target || typeof target.focus !== 'function') {
      return false;
    }
    try {
      target.focus({ preventScroll: true });
      return true;
    } catch {
      try {
        target.focus();
        return true;
      } catch {
        return false;
      }
    }
  }

  function findOpenButton(itemEl) {
    const children = getChildList(itemEl);
    for (let i = 0; i < children.length; i += 1) {
      const grandChildren = getChildList(children[i]);
      for (let j = 0; j < grandChildren.length; j += 1) {
        const candidate = grandChildren[j];
        if (!candidate) {
          continue;
        }
        if (
          typeof candidate.getAttribute === 'function' &&
          candidate.getAttribute('data-office-mail-open')
        ) {
          return candidate;
        }
        if (candidate.tagName === 'BUTTON') {
          return candidate;
        }
      }
    }
    return null;
  }

  function getItemSignature(item) {
    return JSON.stringify([item.id, item.subject, item.from, item.dateText, item.snippet]);
  }

  function readProviderPageState(rawPageState, provider) {
    if (
      !provider ||
      !rawPageState ||
      typeof rawPageState !== 'object' ||
      Array.isArray(rawPageState)
    ) {
      return null;
    }
    let entry = rawPageState[provider];
    if (!entry) {
      const keys = Object.keys(rawPageState);
      for (let i = 0; i < keys.length; i += 1) {
        if (keys[i].trim().toLowerCase() === provider) {
          entry = rawPageState[keys[i]];
          break;
        }
      }
    }
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return null;
    }
    return {
      page: normalizePage(entry.page),
      busy: entry.busy === true,
      notice: typeof entry.notice === 'string' ? entry.notice.trim() : '',
      code: typeof entry.code === 'string' ? entry.code.trim() : '',
    };
  }

  function createGroupRecord(key) {
    const groupEl = doc.createElement('section');
    groupEl.style.width = '100%';
    groupEl.style.minWidth = '0';

    const headEl = doc.createElement('div');
    headEl.className = 'off-task-head';

    const titleEl = doc.createElement('strong');
    titleEl.className = 'off-task-copy';
    titleEl.style.minWidth = '0';
    titleEl.style.overflowWrap = 'anywhere';
    headEl.appendChild(titleEl);

    const countStatusEl = doc.createElement('span');
    countStatusEl.className = 'off-task-status';

    const listEl = doc.createElement('ul');
    listEl.style.listStyle = 'none';
    listEl.style.margin = '0.2rem 0 0 0';
    listEl.style.padding = '0';
    listEl.style.width = '100%';
    listEl.style.minWidth = '0';

    const codeNoteEl = doc.createElement('p');
    codeNoteEl.className = 'off-task-note';
    codeNoteEl.style.margin = '0.25rem 0 0 0';
    codeNoteEl.style.overflowWrap = 'anywhere';

    const moreNoteEl = doc.createElement('p');
    moreNoteEl.className = 'off-task-note';
    moreNoteEl.style.margin = '0.25rem 0 0 0';
    moreNoteEl.textContent = '조건에 맞는 메일이 더 있습니다.';

    const groupStatusEl = doc.createElement('p');
    groupStatusEl.className = 'off-task-note';
    groupStatusEl.setAttribute('role', 'status');
    groupStatusEl.hidden = true;
    groupStatusEl.style.margin = '0.25rem 0 0 0';
    groupStatusEl.style.overflowWrap = 'anywhere';

    const moreActionsEl = doc.createElement('div');
    moreActionsEl.className = 'off-task-actions';
    moreActionsEl.style.marginTop = '0.32rem';

    const moreBtn = doc.createElement('button');
    moreBtn.type = 'button';
    moreActionsEl.appendChild(moreBtn);

    const record = {
      key,
      groupEl,
      headEl,
      titleEl,
      countStatusEl,
      listEl,
      codeNoteEl,
      moreNoteEl,
      groupStatusEl,
      moreActionsEl,
      moreBtn,
      provider: '',
      providerAttr: '',
      moreAttr: '',
      titleText: '',
      countText: '',
      codeText: '',
      statusText: '',
      moreLabel: '',
      moreAriaLabel: '',
      renderedSigs: [],
      itemEls: [],
      page: null,
      hasMountedOnce: false,
      canLoadMore: false,
      moreMounted: false,
      isBusy: false,
      emptyAdvancePage: null,
      focusSticky: false,
    };

    function triggerMore() {
      if (!record.canLoadMore || record.page === null || record.isBusy) {
        return;
      }
      const activeEl = getActiveElement();
      if (activeEl === record.moreBtn || isUnfocusedOrBody(activeEl)) {
        record.focusSticky = true;
        if (activeEl !== record.moreBtn) {
          focusSafely(record.moreBtn);
        }
      } else {
        record.focusSticky = false;
      }
      emit({
        act: 'task-mail-more',
        arg: safeTaskId,
        fields: {
          provider: record.provider,
          expectedPage: record.page,
        },
      });
    }

    moreBtn.addEventListener('click', () => {
      triggerMore();
    });

    moreBtn.addEventListener('keydown', (event) => {
      if (!event || event.repeat || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
        if (typeof event.preventDefault === 'function') {
          event.preventDefault();
        }
        triggerMore();
      }
    });

    return record;
  }

  function focusFallbackWithinGroup(record, startNewIdx) {
    for (let i = startNewIdx; i < record.itemEls.length; i += 1) {
      const btn = findOpenButton(record.itemEls[i]);
      if (btn && focusSafely(btn)) {
        return;
      }
    }
    for (let i = record.itemEls.length - 1; i >= 0; i -= 1) {
      const btn = findOpenButton(record.itemEls[i]);
      if (btn && focusSafely(btn)) {
        return;
      }
    }
    record.groupEl.tabIndex = -1;
    if (typeof record.groupEl.setAttribute === 'function') {
      record.groupEl.setAttribute('tabindex', '-1');
    }
    focusSafely(record.groupEl);
  }

  function syncGroupRecord(record, group, groupIndex, rawPageState) {
    if (groupIndex > 0) {
      record.groupEl.style.marginTop = '0.5rem';
      record.groupEl.style.paddingTop = '0.45rem';
      record.groupEl.style.borderTop = '1px solid rgba(128, 128, 128, 0.2)';
    } else {
      record.groupEl.style.marginTop = '';
      record.groupEl.style.paddingTop = '';
      record.groupEl.style.borderTop = '';
    }

    if (record.providerAttr !== group.provider) {
      record.providerAttr = group.provider;
      if (group.provider.length > 0) {
        record.groupEl.setAttribute('data-office-mail-group', group.provider);
      } else if (typeof record.groupEl.removeAttribute === 'function') {
        record.groupEl.removeAttribute('data-office-mail-group');
      }
    }

    const nextTitle =
      group.address.length > 0
        ? `${group.providerLabel} · ${group.address}`
        : group.providerLabel;
    if (record.titleText !== nextTitle) {
      record.titleText = nextTitle;
      record.titleEl.textContent = nextTitle;
    }

    const prevItemCount = record.renderedSigs.length;
    const prevPage = record.page;
    const itemCount = group.items.length;
    const hasError = group.codeMessage.length > 0;
    const isEmptyWithoutNotice = itemCount === 0 && !hasError && !group.more;

    if (itemCount > 0 || isEmptyWithoutNotice) {
      const nextCountText =
        group.more || hasError ? `표시된 ${itemCount}건` : `${itemCount}건`;
      if (record.countText !== nextCountText) {
        record.countText = nextCountText;
        record.countStatusEl.textContent = nextCountText;
      }
      syncContainerChildren(record.headEl, [record.titleEl, record.countStatusEl]);
    } else {
      record.countText = '';
      syncContainerChildren(record.headEl, [record.titleEl]);
    }

    let commonLen = 0;
    const minLen = Math.min(prevItemCount, itemCount);
    while (
      commonLen < minLen &&
      record.renderedSigs[commonLen] === getItemSignature(group.items[commonLen])
    ) {
      commonLen += 1;
    }

    while (record.renderedSigs.length > commonLen) {
      const removedEl = record.itemEls.pop();
      record.renderedSigs.pop();
      if (removedEl && removedEl.parentNode === record.listEl) {
        record.listEl.removeChild(removedEl);
      } else if (record.listEl.lastChild) {
        record.listEl.removeChild(record.listEl.lastChild);
      }
    }

    for (let i = commonLen; i < itemCount; i += 1) {
      const itemEl = renderItem(group.items[i], i);
      record.listEl.appendChild(itemEl);
      record.itemEls.push(itemEl);
      record.renderedSigs.push(getItemSignature(group.items[i]));
    }

    const nextCodeText = hasError
      ? itemCount > 0 && !group.codeMessage.includes('일부')
        ? `일부 조회 실패 · ${group.codeMessage}`
        : group.codeMessage
      : '';
    if (record.codeText !== nextCodeText) {
      record.codeText = nextCodeText;
      record.codeNoteEl.textContent = nextCodeText;
    }

    const pageEntry = readProviderPageState(rawPageState, group.provider);
    const isSamePage = group.page !== null && pageEntry?.page === group.page;
    const isPermanentPageError = isSamePage && Object.hasOwn(PERMANENT_PAGE_ERROR_NOTICES, pageEntry.code);
    const canLoadMore =
      canEmitOpen &&
      PAGING_PROVIDERS.has(group.provider) &&
      group.more === true &&
      group.page !== null &&
      !isPermanentPageError;

    if (record.hasMountedOnce && canLoadMore && prevPage !== null && group.page > prevPage) {
      record.emptyAdvancePage = itemCount === prevItemCount ? group.page : null;
    } else if (!canLoadMore || (prevPage !== null && group.page !== null && group.page < prevPage)) {
      record.emptyAdvancePage = null;
    } else if (itemCount > prevItemCount) {
      record.emptyAdvancePage = null;
    }

    const matchesPage = canLoadMore && isSamePage;
    const isBusy = matchesPage && pageEntry.busy;
    const isRetry =
      matchesPage &&
      !pageEntry.busy &&
      pageEntry.notice.length > 0 &&
      !(record.hasMountedOnce && prevPage !== null && group.page > prevPage);

    let nextStatusText = '';
    if (isPermanentPageError) {
      nextStatusText = PERMANENT_PAGE_ERROR_NOTICES[pageEntry.code];
    } else if (isBusy) {
      nextStatusText = '불러오는 중…';
    } else if (matchesPage && pageEntry.notice.length > 0) {
      nextStatusText = pageEntry.notice;
    } else if (canLoadMore && record.emptyAdvancePage === group.page) {
      nextStatusText = '이번 구간에는 일치하는 메일이 없었습니다.';
    } else if (canLoadMore && group.page === 0 && itemCount === 0) {
      nextStatusText = '첫 구간에는 조건에 맞는 메일이 없지만 확인할 후보 메일이 남아 있습니다.';
    } else if (
      !canLoadMore &&
      pageEntry !== null &&
      !pageEntry.busy &&
      pageEntry.notice.length > 0 &&
      (pageEntry.page === group.page || group.page === null) &&
      pageEntry.notice !== nextCodeText
    ) {
      nextStatusText = pageEntry.notice;
    }

    const hideStatus = nextStatusText.length === 0;
    if (record.groupStatusEl.hidden !== hideStatus) {
      record.groupStatusEl.hidden = hideStatus;
    }
    if (record.statusText !== nextStatusText) {
      record.statusText = nextStatusText;
      record.groupStatusEl.textContent = nextStatusText;
    }

    const activeEl = getActiveElement();
    if (activeEl && !isUnfocusedOrBody(activeEl) && activeEl !== record.moreBtn) {
      record.focusSticky = false;
    }

    record.provider = group.provider;
    record.page = group.page;
    record.canLoadMore = canLoadMore;
    record.isBusy = isBusy;
    record.hasMountedOnce = true;

    if (canLoadMore) {
      if (record.moreAttr !== group.provider) {
        record.moreAttr = group.provider;
        record.moreBtn.setAttribute('data-office-mail-more', group.provider);
      }

      const nextBtnText = isRetry ? '다시 시도' : '더보기';
      const nextAriaLabel = isRetry
        ? `${group.providerLabel} 더보기 다시 시도`
        : `${group.providerLabel} 더보기`;

      if (record.moreLabel !== nextBtnText) {
        record.moreLabel = nextBtnText;
        record.moreBtn.textContent = nextBtnText;
      }
      if (record.moreAriaLabel !== nextAriaLabel) {
        record.moreAriaLabel = nextAriaLabel;
        record.moreBtn.setAttribute('aria-label', nextAriaLabel);
      }

      if (isBusy) {
        record.moreBtn.setAttribute('aria-disabled', 'true');
        record.moreBtn.setAttribute('aria-busy', 'true');
      } else if (typeof record.moreBtn.removeAttribute === 'function') {
        record.moreBtn.removeAttribute('aria-disabled');
        record.moreBtn.removeAttribute('aria-busy');
      }
    } else if (record.moreMounted) {
      const hadMoreFocus =
        activeEl === record.moreBtn || (record.focusSticky && isUnfocusedOrBody(activeEl));
      if (hadMoreFocus) {
        focusFallbackWithinGroup(record, commonLen);
      }
      record.focusSticky = false;
    }

    const desiredSlots = [record.headEl];
    if (itemCount > 0) {
      desiredSlots.push(record.listEl);
    }
    if (nextCodeText.length > 0) {
      desiredSlots.push(record.codeNoteEl);
    }
    if (group.more && group.page === null) {
      desiredSlots.push(record.moreNoteEl);
    }
    desiredSlots.push(record.groupStatusEl);
    if (canLoadMore) {
      desiredSlots.push(record.moreActionsEl);
    }

    syncContainerChildren(record.groupEl, desiredSlots);
    record.moreMounted = canLoadMore;

    if (canLoadMore && record.focusSticky) {
      const nowActive = getActiveElement();
      if (isBusy || isRetry) {
        if (nowActive === record.moreBtn || isUnfocusedOrBody(nowActive)) {
          focusSafely(record.moreBtn);
        }
        if (isRetry) {
          record.focusSticky = false;
        }
      } else {
        if (isUnfocusedOrBody(nowActive)) {
          focusSafely(record.moreBtn);
        }
        record.focusSticky = false;
      }
    }
  }

  function syncSnapshot(snapshot, rawPageState) {
    const hideScope = snapshot.scope.length === 0;
    if (scopeEl.hidden !== hideScope || currentSnapshotKey !== snapshot.scope) {
      currentSnapshotKey = snapshot.scope;
      scopeEl.textContent = snapshot.scope;
      scopeEl.hidden = hideScope;
      syncTopMetaLayout();
    }

    if (snapshot.groups.length === 0) {
      const activeEl = getActiveElement();
      for (const rec of groupRecords.values()) {
        if (activeEl === rec.moreBtn) {
          groupsEl.tabIndex = -1;
          focusSafely(groupsEl);
          break;
        }
      }
      groupRecords.clear();
      if (!emptyEl) {
        emptyEl = doc.createElement('p');
        emptyEl.className = 'off-task-note';
        emptyEl.style.margin = '0';
        emptyEl.textContent = '조건에 맞는 메일이 없습니다.';
      }
      syncContainerChildren(groupsEl, [emptyEl]);
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
    const activeKeys = new Set();
    const desiredGroupEls = [];

    for (let i = 0; i < orderedGroups.length; i += 1) {
      const group = orderedGroups[i];
      activeKeys.add(group.key);
      let record = groupRecords.get(group.key);
      if (!record) {
        record = createGroupRecord(group.key);
        groupRecords.set(group.key, record);
      }
      syncGroupRecord(record, group, i, rawPageState);
      desiredGroupEls.push(record.groupEl);
    }

    const activeEl = getActiveElement();
    for (const [key, rec] of groupRecords.entries()) {
      if (!activeKeys.has(key)) {
        if (activeEl === rec.moreBtn) {
          groupsEl.tabIndex = -1;
          focusSafely(groupsEl);
        }
        groupRecords.delete(key);
      }
    }

    syncContainerChildren(groupsEl, desiredGroupEls);
  }

  function resetAll() {
    currentSnapshotKey = '';
    currentNotice = '';
    groupRecords.clear();
    scopeEl.textContent = '';
    scopeEl.hidden = true;
    noticeEl.textContent = '';
    noticeEl.hidden = true;
    topMetaEl.hidden = true;
    clearChildren(groupsEl);
    rootEl.hidden = true;
  }

  function update(mailResult, notice, pageState = {}) {
    const nextSnapshot = normalizeMailResult(mailResult);
    if (!nextSnapshot) {
      resetAll();
      return;
    }

    if (rootEl.hidden) {
      rootEl.hidden = false;
    }

    syncSnapshot(nextSnapshot, pageState);
    patchNotice(notice);
  }

  return {
    element: rootEl,
    update,
  };
}
