import { mailCodeText } from './office-mail-model.mjs';
import { createMailReviewPanel } from './office-mail-review.mjs';
import { createOfficeMailControls, createOfficeMailResults } from './office-mail-view.mjs';
import { createQuoteHandoffView, quoteOutcomeLabel } from './office-quote-handoff-view.mjs';
import { classifyCodexTask, MAX_MANUAL_ANSWER_LENGTH } from './office-task-room.mjs';

const NONE = Symbol('none');

const REASON_MESSAGES = {
  STORAGE: '저장소 오류로 작업 기록을 불러오거나 저장하지 못했습니다.',
  LOGIN: '공식 도구에서 로그인한 뒤 이 요청을 다시 맡길 수 있습니다.',
  LIMIT: '사용 한도에 도달해 작업을 진행할 수 없습니다.',
  PROVIDER: '작업 도구 응답을 처리하는 중 문제가 발생했습니다.',
  TERMINAL_CLOSED: '작업 중 터미널이 닫혀 완료 여부를 확인하지 못했습니다.',
  NO_ANSWER: '전달된 최종 응답이 없습니다.',
  FOLDER: '작업 대상 공간을 준비하지 못했습니다.',
  SESSION: '이전 작업 대화를 이어갈 수 없습니다.',
  PERMISSION: '권한 승인이 필요해 작업이 멈췄습니다.',
  NATIVE: '내부 실행 처리 중 오류가 발생했습니다.',
  RESTART: '앱이 다시 시작되어 진행 중이던 작업이 중단되었습니다.',
  AUTH_CHANGED: '인증 상태가 변경되어 작업이 중단되었습니다.',
  CANCELLED: '요청에 따라 작업이 취소되었습니다.',
  NO_CLI: '선택한 작업 도구를 이 환경에서 실행할 수 없습니다.',
  HOOKS_OFF: 'Claude Code에서 사무실 연결을 확인할 수 없어 요청을 보류했습니다.',
  WRITE: '작업 결과를 저장하지 못했습니다.',
  RESULT_TOO_LARGE: '결과 분량이 너무 커서 표시할 수 없습니다.',
  EMPTY: '맡길 내용을 입력해 주세요.',
  BUSY: '이전 요청을 처리하고 있습니다.',
};

const STARTED_FAILURE_REASONS = new Set([
  'TERMINAL_CLOSED',
  'NO_ANSWER',
  'RESULT_TOO_LARGE',
]);

const SIDE_EFFECT_CAUTION =
  '실행이 시작된 뒤 멈췄으므로 일부 변경이 이미 반영되었을 수 있습니다. 다시 시도하기 전에 결과를 먼저 확인해 주세요.';
const CONTINUATION_GUIDE = '공식 창에서 /status로 사용할 계정이 맞는지 확인한 다음 이 문구를 붙여넣고 Enter를 누르세요. Enter를 누르는 순간 표시된 계정에 이전 대화 내용도 함께 전달됩니다.';
const MAIL_DECISION_REASON_NOTES = Object.freeze({
  LOGIN: 'GPT 로그인이 필요해 업무 범위를 자동으로 확인하지 못했습니다.',
  LIMIT: 'GPT 사용 한도에 도달해 업무 범위를 자동으로 확인하지 못했습니다.',
  NO_CLI: 'GPT 실행 도구가 없어 업무 범위를 자동으로 확인하지 못했습니다.',
  MAIL_PLAN: mailCodeText('MAIL_PLAN'),
  MAIL_SCOPE: '요청하신 검색 범위는 지원하지 않습니다.',
  MAIL_CHANGED: mailCodeText('MAIL_CHANGED'),
  MAIL_STORAGE: mailCodeText('MAIL_STORAGE'),
});

function clearChildren(el) {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

function findButton(target, boundary) {
  let node = target;
  while (node && node !== boundary) {
    if (node.tagName === 'BUTTON' || node.nodeName === 'BUTTON') return node;
    node = node.parentNode;
  }
  return null;
}

function providerLabel(provider) {
  return provider === 'codex' ? 'GPT (Codex)' : 'Claude Code';
}

function formatMessage(value) {
  if (!value) return '';
  if (typeof value !== 'string') return REASON_MESSAGES.NATIVE;
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (Object.prototype.hasOwnProperty.call(REASON_MESSAGES, trimmed)) {
    return REASON_MESSAGES[trimmed];
  }
  if (/^[A-Z0-9_]+$/.test(trimmed)) {
    return '요청을 처리하는 중 문제가 발생했습니다.';
  }
  return trimmed;
}

function didStartBeforeFailing(rawStatus, reason) {
  return STARTED_FAILURE_REASONS.has(reason) || (rawStatus === 'interrupted' && reason === 'RESTART');
}

function describeTask(task, deptMap, hasMail = false) {
  const rawStatus = typeof task.status === 'string' ? task.status : '';
  const reason = typeof task.reason === 'string' ? task.reason.trim() : '';
  const hasQuoteHandoff = Boolean(task.quoteHandoff);
  const isQuoteParent = task.quoteHandoff === true;
  const isQuoteChild = Boolean(task.quoteSource);
  const codexState = classifyCodexTask(task);
  const suppressSnapshotAnswer =
    reason === 'MANUAL_RESULT' ||
    (task.provider === 'codex' && task.viaTerminal === true && !codexState.memberResult);
  const answerText =
    !suppressSnapshotAnswer && typeof task.answer === 'string' ? task.answer : '';
  const hasActualAnswer = answerText.trim().length > 0;
  const isWriteError = reason === 'WRITE';
  const isCompleted =
    rawStatus === 'completed' &&
    hasActualAnswer &&
    !isWriteError &&
    reason !== 'NO_ANSWER' &&
    !codexState.legacyViaTerminal;
  const unsavedAnswer =
    rawStatus === 'failed' && isWriteError && hasActualAnswer && !codexState.legacyViaTerminal;
  const claudeTerminalUnconfirmed =
    task.provider === 'claude' &&
    rawStatus === 'terminal' &&
    reason === 'UNCONFIRMED' &&
    hasActualAnswer;
  const claudeInterruptedUnconfirmed =
    task.provider === 'claude' && rawStatus === 'interrupted' && reason === 'UNCONFIRMED';
  const previewText =
    task.provider === 'claude' &&
    (rawStatus === 'running' || rawStatus === 'terminal') &&
    !claudeTerminalUnconfirmed &&
    typeof task.previewAnswer === 'string' &&
    task.previewAnswer.trim().length > 0
      ? task.previewAnswer
      : '';
  const claudePreview = previewText.length > 0;
  const showAnswer =
    isCompleted ||
    unsavedAnswer ||
    (codexState.memberResult && hasActualAnswer) ||
    (claudeInterruptedUnconfirmed && hasActualAnswer) ||
    claudeTerminalUnconfirmed ||
    claudePreview;
  let answerLabel = task.viaTerminal === true ? '공식 터미널에서 이어간 답' : '최종 답';
  if (isQuoteChild && isCompleted && task.quoteOutcome === 'draft') {
    answerLabel = '견적 답장 초안';
  } else if (isQuoteChild && isCompleted && task.quoteOutcome === 'held') {
    answerLabel = '보류 사유';
  } else if (codexState.memberResult) {
    answerLabel = '터미널에서 직접 옮긴 답';
  } else if (unsavedAnswer) {
    answerLabel = '아직 저장하지 못한 답';
  } else if (claudeInterruptedUnconfirmed || claudeTerminalUnconfirmed || claudePreview) {
    answerLabel = '완료 확인 전 답';
  }
  const continuation =
    !isQuoteChild &&
    task.provider === 'codex' &&
    rawStatus === 'terminal' &&
    task.canOpenTerminal === true &&
    typeof task.continuationPrompt === 'string' &&
    task.continuationPrompt.trim()
      ? task.continuationPrompt
      : '';

  let statusCode = rawStatus || 'unknown';
  let statusText = '확인 필요';

  if (isCompleted) {
    statusCode = 'completed';
    statusText = '완료';
  } else if (codexState.memberResult) {
    statusText = '수기 보관됨';
  } else if (codexState.legacyViaTerminal && rawStatus === 'completed') {
    statusCode = 'interrupted';
    statusText = '확인 필요';
  } else if (rawStatus === 'completed' && isWriteError) {
    statusCode = 'failed';
    statusText = '저장 실패';
  } else if (rawStatus === 'completed') {
    statusCode = 'no-answer';
    statusText = '응답 없음';
  } else if (rawStatus === 'queued') {
    statusText = '대기 중';
  } else if (rawStatus === 'paused') {
    statusText = '일시 중지';
  } else if (rawStatus === 'running') {
    statusText = '진행 중';
  } else if (rawStatus === 'terminal') {
    statusText = '터미널 확인 필요';
  } else if (rawStatus === 'interrupted') {
    statusText = reason === 'CANCELLED' ? '취소됨' : '중단됨';
  } else if (rawStatus === 'failed') {
    if (reason === 'CANCELLED') statusText = '취소됨';
    else if (hasMail && task.provider === 'codex' && reason === 'MAIL_CHOOSE') statusText = '선택 필요';
    else if (isWriteError) statusText = '저장 실패';
    else if (reason === 'NO_ANSWER') statusText = '응답 없음';
    else statusText = '실패';
  }

  let deptLabel = '사무실';
  if (typeof task.departmentName === 'string' && task.departmentName.trim()) {
    deptLabel = task.departmentName.trim();
  } else if (task.departmentId != null && String(task.departmentId) !== '') {
    const idStr = String(task.departmentId);
    deptLabel = deptMap.get(idStr) || idStr;
  }

  const metaParts = [deptLabel, providerLabel(task.provider)];
  if (task.previousId != null && String(task.previousId) !== '') {
    metaParts.push('이어서 요청');
  }

  const mailReason = reason.startsWith('MAIL_') ? mailCodeText(reason) : '';
  const reasonText =
    typeof mailReason === 'string' && mailReason.trim()
      ? mailReason.trim()
      : formatMessage(reason);
  let noteText = '';
  if (isCompleted) {
    noteText = '';
  } else if (codexState.memberResult) {
    noteText = hasActualAnswer ? '' : '보관된 답변 원문이 없습니다.';
  } else if (codexState.manualResult && rawStatus === 'terminal') {
    noteText = '확인한 답을 이 업무에 직접 붙여넣어 보관해 주세요.';
  } else if (codexState.manualResult) {
    noteText = '공식 터미널 답을 이 업무에 직접 붙여넣어 보관할 수 있습니다.';
  } else if (codexState.legacyViaTerminal) {
    noteText = '공식 터미널에서 자동 수집된 이전 기록은 본문 표시와 후속 요청을 지원하지 않습니다.';
  } else if (rawStatus === 'queued') {
    noteText = reasonText;
  } else if (rawStatus === 'running') {
    noteText = reasonText;
  } else if (rawStatus === 'paused') {
    noteText = reasonText || '일시 중지되었습니다. 확인 후 재개할 수 있습니다.';
  } else if (claudeTerminalUnconfirmed) {
    noteText = '공식 창이 실행 중에 받은 중간답입니다. 공식 창에서 완료 여부를 확인해 주세요.';
  } else if (rawStatus === 'terminal') {
    noteText = reasonText || '터미널에서 로그인 또는 승인을 확인해 주세요.';
  } else if (rawStatus === 'completed') {
    const base = reasonText || REASON_MESSAGES.NO_ANSWER;
    noteText = didStartBeforeFailing(rawStatus, reason || 'NO_ANSWER')
      ? `${base} ${SIDE_EFFECT_CAUTION}`
      : base;
  } else if (claudeInterruptedUnconfirmed) {
    noteText = hasActualAnswer
      ? '다시 맡기기 전에 이미 처리한 내용이 있는지 확인해 주세요.'
      : '공식 창이 닫혀 완료를 확인하지 못했습니다.';
  } else if (rawStatus === 'interrupted' || rawStatus === 'failed') {
    const fallback = rawStatus === 'interrupted' ? '작업이 중단되었습니다.' : '작업에 실패했습니다.';
    const base = reasonText || fallback;
    noteText = didStartBeforeFailing(rawStatus, reason)
      ? `${base} ${SIDE_EFFECT_CAUTION}`
      : base;
  } else {
    noteText = reasonText;
  }

  const hasRealId = task.id != null && String(task.id) !== '';
  const isStandardCodex =
    task.provider === 'codex' &&
    task.viaTerminal !== true &&
    reason !== 'MANUAL_RESULT' &&
    !codexState.memberResult &&
    !codexState.manualResult &&
    !codexState.legacyViaTerminal &&
    !codexState.blockFollowUp;
  const isMailReview =
    Boolean(hasMail) && isStandardCodex && task.mailSearch === true && rawStatus === 'failed' && reason === 'MAIL_REVIEW';
  if (isMailReview) {
    statusText = '검색 조건 확인';
    noteText = task.mailReview?.reason === 'source'
      ? '아직 사서함을 조회하지 않았습니다. ‘이 조건으로 찾기’는 연결한 메일함을 검색하며, 웹에서 찾으시려면 ‘일반 업무로 맡기기’를 선택해 주세요.'
      : '현재 검색 요청으로는 아직 사서함을 조회하지 않았으니, 조건을 확인해 주시면 메일을 찾습니다.';
  }
  if (hasMail && isStandardCodex && task.mailSearch !== true) {
    if (task.mailDecision === 'pending' && (rawStatus === 'queued' || rawStatus === 'running')) {
      statusText = '업무 범위 확인 중';
    } else if (task.mailDecision === 'ordinary' && isCompleted) {
      noteText = '사서함을 조회하지 않았습니다.';
    } else if (task.mailDecision === 'choose' && rawStatus === 'failed' && reason === 'MAIL_CHOOSE') {
      const key = task.mailDecisionReason;
      if (typeof key === 'string' && Object.hasOwn(MAIL_DECISION_REASON_NOTES, key)) {
        noteText = [MAIL_DECISION_REASON_NOTES[key], noteText].filter(Boolean).join(' ');
      }
    }
  }
  const isMailSearch = task.mailSearch === true;
  const mailResult =
    isStandardCodex &&
    isCompleted &&
    isMailSearch &&
    task.mailResult != null &&
    typeof task.mailResult === 'object' &&
    Array.isArray(task.mailResult.groups)
      ? task.mailResult
      : null;
  const mailReview = isMailReview
    ? task.mailReview != null &&
      typeof task.mailReview === 'object' &&
      !Array.isArray(task.mailReview)
      ? task.mailReview
      : {}
    : null;
  const hasMailGroupCode = Boolean(
    mailResult &&
      mailResult.groups.some(
        (group) =>
          group != null &&
          typeof group === 'object' &&
          typeof group.code === 'string' &&
          group.code.trim().length > 0,
      ),
  );
  const canQuoteRewrite =
    hasRealId && isQuoteChild && rawStatus === 'failed' && task.canRetry === true;
  return {
    hasRealId,
    metaText: metaParts.join(' · '),
    statusCode,
    statusText: hasMail === true ? quoteOutcomeLabel(task) || statusText : statusText,
    promptText: typeof task.prompt === 'string' ? task.prompt : task.prompt == null ? '' : String(task.prompt),
    showQuoteHandoff: hasQuoteHandoff || isQuoteChild,
    isQuoteChild,
    showAnswer,
    answerLabel,
    answerText: showAnswer ? (claudePreview ? previewText : answerText) : '',
    showManualResult: hasRealId && !isQuoteChild && codexState.manualResult,
    mailResult,
    mailReview,
    continuation: isQuoteChild ? '' : continuation,
    noteText,
    canCancel:
      hasRealId &&
      (rawStatus === 'queued' ||
        rawStatus === 'running' ||
        rawStatus === 'paused' ||
        rawStatus === 'terminal'),
    canResume: (hasRealId && rawStatus === 'paused') || canQuoteRewrite,
    resumeLabel: canQuoteRewrite ? '다시 작성' : '재개',
    canFollow: hasRealId && !isQuoteParent && !isQuoteChild && isCompleted && !codexState.blockFollowUp &&
      (Boolean(hasMail) || task.mailSearch !== true),
    canRetry:
      hasRealId &&
      !isQuoteParent &&
      !isQuoteChild &&
      !codexState.blockFollowUp &&
      (Boolean(hasMail) || task.mailSearch !== true) &&
      ((rawStatus === 'failed' && !isWriteError) ||
        rawStatus === 'interrupted' ||
        (rawStatus === 'completed' && !isCompleted)),
    canMailGeneralBase:
      hasRealId &&
      !isQuoteChild &&
      isStandardCodex &&
      rawStatus === 'failed' &&
      (reason === 'MAIL_CHOOSE' || (task.mailSearch === true && reason === 'MAIL_REVIEW')),
    canMailFindBase:
      hasRealId &&
      !isQuoteChild &&
      isStandardCodex &&
      ((isCompleted && !isMailSearch) || (rawStatus === 'failed' && reason === 'MAIL_CHOOSE')),
    canMailRepeatBase:
      hasRealId && !isQuoteChild && isStandardCodex && isCompleted && isMailSearch && (hasMailGroupCode || (hasQuoteHandoff && task.quoteCanResume === true)),
    mailRepeatLabel: isQuoteParent ? '이어서 조사' : '다시 찾기',
    canTerminal:
      hasRealId &&
      !isQuoteChild &&
      Boolean(task.canOpenTerminal) &&
      !codexState.memberResult &&
      !codexState.legacyViaTerminal,
    deptLabel,
  };
}

export function createOfficeTaskView(host, dispatch) {
  if (!host || !host.ownerDocument) {
    throw new TypeError('Valid host element is required.');
  }
  const doc = host.ownerDocument;
  const emit = typeof dispatch === 'function' ? dispatch : () => {};

  let panelEl = null;
  let storageNoteEl = null;
  let refreshEl = null;
  let formSlotEl = null;
  let listEl = null;
  let liveEl = null;
  let formRefs = null;

  let currentEpoch = NONE;
  let lastStamp = NONE;
  let lastModelPrompt = '';
  let lastDispatchedEdit = '';
  let lastFocusSeq = 0;
  let composing = false;

  let activeProvider = 'claude';
  let activeDeptId = '';
  let activePreviousId = null;
  let currentMail = null;
  let currentMailUI = null;

  const MANUAL_LIMIT_MESSAGE = '524,288자를 초과한 답은 보관할 수 없습니다.';
  let manualSeq = 0;
  const cardMap = new Map();
  const knownStatuses = new Map();
  let initializedLive = false;
  let lastLiveText = '';

  function disposeManual(rec) {
    if (!rec || !rec.manual) return;
    const manual = rec.manual;
    rec.manual = null;
    manual.active = false;
    manual.textarea.value = '';
    manual.saveBtn.disabled = true;
    if (manual.boxEl.parentNode) {
      manual.boxEl.parentNode.removeChild(manual.boxEl);
    }
  }

  function clearAllManuals() {
    for (const rec of cardMap.values()) {
      disposeManual(rec);
    }
  }

  function syncManualState(manual) {
    if (!manual || !manual.active) return;
    const raw = manual.textarea.value;
    const tooLong = raw.length > MAX_MANUAL_ANSWER_LENGTH;
    const isBlank = !tooLong && raw.trim().length === 0;
    const nextDisabled = !manual.taskId || tooLong || isBlank;
    if (manual.saveBtn.disabled !== nextDisabled) {
      manual.saveBtn.disabled = nextDisabled;
    }
    const errText = tooLong ? MANUAL_LIMIT_MESSAGE : '';
    if (manual.errorEl.hidden !== !errText) {
      manual.errorEl.hidden = !errText;
    }
    if (manual.errorEl.textContent !== errText) {
      manual.errorEl.textContent = errText;
    }
    if (tooLong) {
      manual.textarea.setAttribute('aria-invalid', 'true');
      manual.textarea.setAttribute('aria-describedby', manual.errorEl.id);
    } else if (manual.textarea.hasAttribute('aria-invalid')) {
      manual.textarea.removeAttribute('aria-invalid');
      manual.textarea.removeAttribute('aria-describedby');
    }
  }

  function submitManualAnswer(id) {
    if (!id) return;
    const rec = cardMap.get(id);
    if (!rec || !rec.manual || !rec.manual.active) return;
    const manual = rec.manual;
    if (manual.taskId !== id || manual.epoch !== currentEpoch) return;
    syncManualState(manual);
    const raw = manual.textarea.value;
    if (raw.length > MAX_MANUAL_ANSWER_LENGTH || raw.trim().length === 0) return;
    emit({
      act: 'task-save-answer',
      arg: id,
      fields: { answer: raw },
    });
  }

  function createManualSection(id, epoch) {
    manualSeq += 1;
    const inputId = 'off-task-manual-' + String(manualSeq);
    const errorId = inputId + '-error';

    const boxEl = doc.createElement('div');
    boxEl.className = 'off-task-form';
    boxEl.setAttribute('data-task-manual', '');

    const labelEl = doc.createElement('label');
    labelEl.htmlFor = inputId;
    labelEl.textContent = '터미널에서 가져온 답';

    const textarea = doc.createElement('textarea');
    textarea.id = inputId;
    textarea.className = 'off-task-input';
    textarea.setAttribute('data-task-manual-answer', '');
    textarea.rows = 5;

    const errorEl = doc.createElement('p');
    errorEl.id = errorId;
    errorEl.className = 'off-task-note';
    errorEl.setAttribute('data-task-manual-error', '');
    errorEl.hidden = true;

    const saveBtn = doc.createElement('button');
    saveBtn.type = 'button';
    saveBtn.setAttribute('data-task-act', 'task-save-answer');
    saveBtn.setAttribute('data-task-arg', id);
    saveBtn.textContent = '답 보관';
    saveBtn.disabled = true;

    const manual = {
      active: true,
      taskId: id,
      epoch,
      boxEl,
      labelEl,
      textarea,
      errorEl,
      saveBtn,
    };

    textarea.addEventListener('input', () => {
      syncManualState(manual);
    });



    boxEl.appendChild(labelEl);
    boxEl.appendChild(textarea);
    boxEl.appendChild(errorEl);
    const actions = doc.createElement('div');
    actions.className = 'off-task-actions';
    actions.appendChild(saveBtn);
    boxEl.appendChild(actions);

    return manual;
  }

  function disposeMailResults(rec) {
    if (!rec || !rec.mailResults) return;
    const cur = rec.mailResults;
    rec.mailResults = null;
    cur.view.update(null, '');
    if (cur.element && cur.element.parentNode) {
      cur.element.parentNode.removeChild(cur.element);
    }
  }

  function clearAllMailResults() {
    for (const rec of cardMap.values()) {
      disposeMailResults(rec);
    }
  }

  function disposeMailReview(rec) {
    if (!rec || !rec.mailReview) return;
    const cur = rec.mailReview;
    rec.mailReview = null;
    if (cur.panel && typeof cur.panel.dispose === 'function') {
      cur.panel.dispose();
    }
    if (cur.element && cur.element.parentNode) {
      cur.element.parentNode.removeChild(cur.element);
    }
  }

  function clearAllMailReviews() {
    for (const rec of cardMap.values()) {
      disposeMailReview(rec);
    }
  }

  function focusChild(id) {
    if (id == null) return;
    const rawKey = String(id);
    const trimmedKey = rawKey.trim();
    if (!trimmedKey) return;
    const rec = cardMap.get(rawKey) || cardMap.get(trimmedKey);
    if (
      !rec ||
      !rec.el ||
      !rec.state.hasRealId ||
      (rec.state.realTaskId !== rawKey && rec.state.realTaskId !== trimmedKey)
    ) {
      return;
    }
    rec.el.tabIndex = -1;
    rec.el.setAttribute('tabindex', '-1');
    if (typeof rec.el.focus === 'function') {
      rec.el.focus();
    }
    if (typeof rec.el.scrollIntoView === 'function') {
      rec.el.scrollIntoView({ block: 'nearest' });
    }
  }

  function disposeQuoteHandoff(rec) {
    if (!rec || !rec.quoteHandoff) return;
    const cur = rec.quoteHandoff;
    rec.quoteHandoff = null;
    cur.view.update(null, [], null, null);
    if (cur.element && cur.element.parentNode) {
      cur.element.parentNode.removeChild(cur.element);
    }
  }

  function clearAllQuoteHandoffs() {
    for (const rec of cardMap.values()) {
      disposeQuoteHandoff(rec);
    }
  }

  function resetMemory() {
    if (formRefs && formRefs.mailControls) {
      formRefs.mailControls.update(null, null, false, false);
    }
    clearAllMailResults();
    clearAllMailReviews();
    clearAllQuoteHandoffs();
    clearAllManuals();
    manualSeq = 0;
    clearChildren(host);
    panelEl = null;
    storageNoteEl = null;
    refreshEl = null;
    formSlotEl = null;
    listEl = null;
    liveEl = null;
    formRefs = null;
    currentEpoch = NONE;
    lastStamp = NONE;
    lastModelPrompt = '';
    lastDispatchedEdit = '';
    lastFocusSeq = 0;
    composing = false;
    activeProvider = 'claude';
    activeDeptId = '';
    activePreviousId = null;
    currentMail = null;
    currentMailUI = null;
    cardMap.clear();
    knownStatuses.clear();
    initializedLive = false;
    lastLiveText = '';
  }

  function buildForm() {
    const form = doc.createElement('form');
    form.className = 'off-task-form';
    form.noValidate = true;

    const fields = doc.createElement('div');
    fields.className = 'off-task-fields';

    const providerField = doc.createElement('label');
    providerField.className = 'off-task-field';
    const providerTitle = doc.createElement('span');
    providerTitle.textContent = '담당 직원';
    const providerSelect = doc.createElement('select');
    providerSelect.name = 'provider';
    providerSelect.setAttribute('data-task-provider', '');
    for (const [val, label] of [
      ['claude', 'Claude Code'],
      ['codex', 'GPT (Codex)'],
    ]) {
      const opt = doc.createElement('option');
      opt.value = val;
      opt.textContent = label;
      providerSelect.appendChild(opt);
    }
    providerField.appendChild(providerTitle);
    providerField.appendChild(providerSelect);

    const deptField = doc.createElement('label');
    deptField.className = 'off-task-field';
    const deptTitle = doc.createElement('span');
    deptTitle.textContent = '부서';
    const deptSelect = doc.createElement('select');
    deptSelect.name = 'department';
    deptSelect.setAttribute('data-task-department', '');
    deptField.appendChild(deptTitle);
    deptField.appendChild(deptSelect);

    fields.appendChild(providerField);
    fields.appendChild(deptField);

    const mailControls = createOfficeMailControls(doc, emit);

    const followNote = doc.createElement('p');
    followNote.className = 'off-task-note';
    followNote.hidden = true;

    const textarea = doc.createElement('textarea');
    textarea.className = 'off-task-input';
    textarea.name = 'prompt';
    textarea.rows = 3;
    textarea.maxLength = 8000;
    textarea.placeholder = '맡길 내용을 입력하세요';
    textarea.setAttribute('aria-label', '맡길 작업 내용');
    textarea.setAttribute('data-task-prompt', '');

    const errorNote = doc.createElement('p');
    errorNote.className = 'off-task-note';
    errorNote.hidden = true;

    const actions = doc.createElement('div');
    actions.className = 'off-task-actions';

    const exitFollowBtn = doc.createElement('button');
    exitFollowBtn.type = 'button';
    exitFollowBtn.textContent = '새 작업으로 전환';
    exitFollowBtn.hidden = true;

    const submitBtn = doc.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.setAttribute('data-task-submit', '');
    submitBtn.textContent = '맡기기';

    actions.appendChild(exitFollowBtn);
    actions.appendChild(submitBtn);

    form.appendChild(fields);
    form.appendChild(mailControls.element);
    form.appendChild(followNote);
    form.appendChild(textarea);
    form.appendChild(errorNote);
    form.appendChild(actions);

    form.addEventListener('compositionstart', (e) => {
      if (e.target === textarea) {
        composing = true;
      }
    });

    form.addEventListener('compositionend', (e) => {
      if (e.target === textarea) {
        composing = false;
        const val = textarea.value;
        if (val !== lastDispatchedEdit) {
          lastDispatchedEdit = val;
          emit({ act: 'task-edit', fields: { prompt: val } });
        }
      }
    });

    form.addEventListener('input', (e) => {
      if (e.target !== textarea) return;
      if (e.isComposing || composing) return;
      const val = textarea.value;
      lastDispatchedEdit = val;
      emit({ act: 'task-edit', fields: { prompt: val } });
    });

    form.addEventListener('change', (e) => {
      if (e.target === providerSelect) {
        if (activePreviousId) {
          providerSelect.value = activeProvider;
          return;
        }
        const next = providerSelect.value === 'codex' ? 'codex' : 'claude';
        activeProvider = next;
        emit({ act: 'task-provider', arg: next });
      } else if (e.target === deptSelect) {
        if (activePreviousId) {
          deptSelect.value = activeDeptId;
          return;
        }
        const next = deptSelect.value || '';
        activeDeptId = next;
        emit({ act: 'task-department', arg: next });
      }
    });

    form.addEventListener('click', (e) => {
      const btn = findButton(e.target, form);
      if (!btn || btn.disabled) return;
      if (btn === submitBtn) {
        e.preventDefault();
        composing = false;
        emit({ act: 'task-submit', fields: { prompt: textarea.value } });
      } else if (btn === exitFollowBtn) {
        e.preventDefault();
        if (activePreviousId) {
          emit({
            act: 'task-open',
            key: activeDeptId ? `d:${activeDeptId}` : 'lobby',
            arg: activeProvider,
          });
        }
      }
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (submitBtn.disabled) return;
      composing = false;
      emit({ act: 'task-submit', fields: { prompt: textarea.value } });
    });

    return {
      form,
      providerSelect,
      deptSelect,
      mailControls,
      followNote,
      textarea,
      errorNote,
      exitFollowBtn,
      submitBtn,
      deptSig: NONE,
    };
  }

  function ensureShell() {
    if (panelEl && panelEl.parentNode === host) return;
    clearChildren(host);

    panelEl = doc.createElement('section');
    panelEl.className = 'off-task-panel';

    liveEl = doc.createElement('div');
    liveEl.className = 'off-task-sr';
    liveEl.setAttribute('aria-live', 'polite');
    liveEl.setAttribute('aria-atomic', 'true');

    storageNoteEl = doc.createElement('p');
    storageNoteEl.className = 'off-task-note';
    storageNoteEl.hidden = true;
    refreshEl = doc.createElement('button');
    refreshEl.type = 'button';
    refreshEl.className = 'quiet';
    refreshEl.hidden = true;
    refreshEl.addEventListener('click', () => emit({ act: 'task-refresh' }));

    formSlotEl = doc.createElement('div');

    listEl = doc.createElement('div');
    listEl.className = 'off-task-list';
    listEl.hidden = true;

    listEl.addEventListener('click', (e) => {
      const btn = findButton(e.target, listEl);
      if (!btn || btn.disabled) return;
      const act = btn.getAttribute('data-task-act');
      const id = btn.getAttribute('data-task-arg');
      if (act === 'task-save-answer') {
        e.preventDefault();
        if (id) submitManualAnswer(id);
        return;
      }
      if ((act === 'copy-answer' || act === 'copy-continuation') && id) {
        e.preventDefault();
        const card = cardMap.get(id);
        if (act === 'copy-continuation') {
          if (card && !card.continuationBox.hidden) void copyText(card.continuationEl, '이어가기 문구를');
        } else if (card && !card.answerEl.hidden) void copyText(card.answerEl, '답을');
        return;
      }
      if (act && id) {
        e.preventDefault();
        emit({ act, arg: id });
      }
    });

    panelEl.appendChild(liveEl);
    panelEl.appendChild(storageNoteEl);
    panelEl.appendChild(refreshEl);
    panelEl.appendChild(formSlotEl);
    panelEl.appendChild(listEl);
    host.appendChild(panelEl);
  }

  function createActionButton(label, act) {
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-task-act', act);
    btn.textContent = label;
    btn.hidden = true;
    return btn;
  }

  async function copyText(element, label) {
    const announce = liveEl, text = element.textContent;
    const stillShown = () => liveEl === announce && element.isConnected && element.textContent === text;
    try {
      await doc.defaultView.navigator.clipboard.writeText(text);
      if (stillShown()) announce.textContent = label + ' 복사했습니다.';
    } catch {
      if (!stillShown()) return;
      const range = doc.createRange();
      range.selectNodeContents(element);
      const selection = doc.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      announce.textContent = label + ' 선택했습니다. Ctrl+C로 복사하세요.';
    }
  }

  function createCard(key) {
    const el = doc.createElement('article');
    el.className = 'off-task-card';
    el.setAttribute('data-task-id', key);

    const headEl = doc.createElement('div');
    headEl.className = 'off-task-head';

    const metaEl = doc.createElement('span');
    const statusEl = doc.createElement('span');
    statusEl.className = 'off-task-status';
    statusEl.setAttribute('data-task-status', '');

    headEl.appendChild(metaEl);
    headEl.appendChild(statusEl);

    const promptEl = doc.createElement('div');
    promptEl.className = 'off-task-copy';
    promptEl.style.whiteSpace = 'pre-wrap';

    const answerLabel = doc.createElement('strong');
    answerLabel.className = 'off-task-note';
    answerLabel.hidden = true;
    const answerEl = doc.createElement('div');
    answerEl.className = 'off-task-copy';
    answerEl.style.whiteSpace = 'pre-wrap';
    answerEl.setAttribute('data-task-answer', '');
    answerEl.hidden = true;

    const continuationBox = doc.createElement('div');
    continuationBox.hidden = true;
    const continuationNote = doc.createElement('p');
    continuationNote.className = 'off-task-note';
    continuationNote.textContent = CONTINUATION_GUIDE;
    const continuationEl = doc.createElement('div');
    continuationEl.className = 'off-task-copy';
    continuationEl.setAttribute('data-task-continuation', '');
    continuationBox.append(continuationNote, continuationEl);

    const noteEl = doc.createElement('p');
    noteEl.className = 'off-task-note';
    noteEl.hidden = true;

    const actionsEl = doc.createElement('div');
    actionsEl.className = 'off-task-actions';
    actionsEl.hidden = true;

    const cancelBtn = createActionButton('취소', 'task-cancel');
    const resumeBtn = createActionButton('재개', 'task-resume');
    const followBtn = createActionButton('이어서 맡기기', 'task-follow');
    const retryBtn = createActionButton('다시 맡기기', 'task-retry');
    const mailGeneralBtn = createActionButton('일반 업무로 맡기기', 'task-mail-general');
    const mailFindBtn = createActionButton('메일에서 찾기', 'task-mail-find');
    const mailRepeatBtn = createActionButton('다시 찾기', 'task-mail-repeat');
    const terminalBtn = createActionButton('터미널 열기', 'task-terminal');
    const copyBtn = createActionButton('답 복사', 'copy-answer');
    const continuationBtn = createActionButton('이어가기 문구 복사', 'copy-continuation');

    actionsEl.appendChild(cancelBtn);
    actionsEl.appendChild(resumeBtn);
    actionsEl.appendChild(followBtn);
    actionsEl.appendChild(retryBtn);
    actionsEl.appendChild(mailGeneralBtn);
    actionsEl.appendChild(mailFindBtn);
    actionsEl.appendChild(mailRepeatBtn);
    actionsEl.appendChild(terminalBtn);
    actionsEl.appendChild(copyBtn);
    actionsEl.appendChild(continuationBtn);

    el.appendChild(headEl);
    el.appendChild(promptEl);
    el.appendChild(answerLabel);
    el.appendChild(answerEl);
    el.appendChild(noteEl);
    el.appendChild(continuationBox);
    el.appendChild(actionsEl);

    return {
      el,
      metaEl,
      statusEl,
      promptEl,
      answerEl,
      answerLabel,
      continuationBox,
      continuationEl,
      continuationBtn,
      noteEl,
      actionsEl,
      cancelBtn,
      resumeBtn,
      followBtn,
      retryBtn,
      mailGeneralBtn,
      mailFindBtn,
      mailRepeatBtn,
      terminalBtn,
      copyBtn,
      mailResults: null,
      mailReview: null,
      quoteHandoff: null,
      manual: null,
      state: {},
    };
  }

  function patchButton(btn, visible, id) {
    if (btn.hidden !== !visible) {
      btn.hidden = !visible;
    }
    if (visible && btn.getAttribute('data-task-arg') !== id) {
      btn.setAttribute('data-task-arg', id);
    }
  }

  function patchCard(rec, key, info, task, rawTasks) {
    const prev = rec.state;
    if (prev.key !== key) {
      disposeMailResults(rec);
      disposeMailReview(rec);
      disposeQuoteHandoff(rec);
      disposeManual(rec);
      rec.el.setAttribute('data-task-id', key);
      prev.key = key;
    }
    prev.hasRealId = Boolean(info.hasRealId);
    prev.realTaskId = info.hasRealId && task && task.id != null ? String(task.id) : '';
    if (prev.metaText !== info.metaText) {
      rec.metaEl.textContent = info.metaText;
      prev.metaText = info.metaText;
    }
    if (prev.statusCode !== info.statusCode) {
      rec.statusEl.setAttribute('data-task-status', info.statusCode);
      prev.statusCode = info.statusCode;
    }
    if (prev.statusText !== info.statusText) {
      rec.statusEl.textContent = info.statusText;
      prev.statusText = info.statusText;
    }
    if (prev.promptText !== info.promptText) {
      rec.promptEl.textContent = info.promptText;
      prev.promptText = info.promptText;
    }
    const hidePrompt = info.promptText.length === 0;
    if (rec.promptEl.hidden !== hidePrompt) {
      rec.promptEl.hidden = hidePrompt;
    }

    const hasMail = Boolean(currentMail);
    const showAnswer = Boolean(info.showAnswer && (!info.isQuoteChild || hasMail));
    const answerLabelText = showAnswer ? info.answerLabel : info.isQuoteChild ? '' : info.answerLabel;
    const answerText = showAnswer ? info.answerText : '';
    if (rec.answerEl.hidden !== !showAnswer) {
      rec.answerEl.hidden = !showAnswer;
    }
    rec.answerLabel.hidden = !showAnswer;
    if (rec.answerLabel.textContent !== answerLabelText) rec.answerLabel.textContent = answerLabelText;
    patchButton(rec.copyBtn, showAnswer, key);
    if (prev.answerText !== answerText) {
      rec.answerEl.textContent = answerText;
      prev.answerText = answerText;
    }
    if (rec.continuationEl.textContent !== info.continuation) rec.continuationEl.textContent = info.continuation;
    rec.continuationBox.hidden = !info.continuation;
    patchButton(rec.continuationBtn, Boolean(info.continuation), key);

    const cardNote = currentMailUI?.cardNotes?.[key];
    const noteText = cardNote ? [info.noteText, cardNote].filter(Boolean).join(' ') : info.noteText;
    const hideNote = noteText.length === 0;
    if (rec.noteEl.hidden !== hideNote) {
      rec.noteEl.hidden = hideNote;
    }
    if (prev.noteText !== noteText) {
      rec.noteEl.textContent = noteText;
      prev.noteText = noteText;
    }

    const argId = info.hasRealId ? key : '';
    const showMailResults = Boolean(hasMail && argId && info.mailResult);
    if (!showMailResults) {
      disposeMailResults(rec);
    } else {
      if (
        rec.mailResults &&
        (rec.mailResults.taskId !== argId || rec.mailResults.epoch !== currentEpoch)
      ) {
        disposeMailResults(rec);
      }
      if (!rec.mailResults) {
        const view = createOfficeMailResults(doc, emit, argId);
        rec.mailResults = {
          taskId: argId,
          epoch: currentEpoch,
          view,
          element: view.element,
        };
        rec.el.insertBefore(view.element, rec.noteEl);
      } else if (rec.mailResults.element.parentNode !== rec.el) {
        rec.el.insertBefore(rec.mailResults.element, rec.noteEl);
      }
      rec.mailResults.view.update(info.mailResult, currentMailUI?.sourceNotes?.[argId], currentMailUI?.pageByTask?.[argId]);
    }

    const showMailReview = Boolean(hasMail && argId && info.mailReview);
    if (!showMailReview) {
      disposeMailReview(rec);
    } else {
      if (
        rec.mailReview &&
        (rec.mailReview.taskId !== argId || rec.mailReview.epoch !== currentEpoch)
      ) {
        disposeMailReview(rec);
      }
      if (!rec.mailReview) {
        const panel = createMailReviewPanel(doc, key, emit);
        rec.mailReview = {
          taskId: argId,
          epoch: currentEpoch,
          panel,
          element: panel.element,
        };
        rec.el.insertBefore(panel.element, rec.actionsEl);
      } else if (rec.mailReview.element.parentNode !== rec.el) {
        rec.el.insertBefore(rec.mailReview.element, rec.actionsEl);
      }
      rec.mailReview.panel.update(
        currentMailUI?.reviewByTask?.[key]?.renewalNeeded ? {} : info.mailReview,
        currentMail.providers,
        currentMailUI?.reviewByTask?.[key],
      );
    }

    const canManual = Boolean(
      info.showManualResult === true && argId,
    );
    if (!canManual) {
      disposeManual(rec);
    } else {
      if (rec.manual && (rec.manual.taskId !== argId || rec.manual.epoch !== currentEpoch)) {
        disposeManual(rec);
      }
      if (!rec.manual) {
        rec.manual = createManualSection(argId, currentEpoch);
        rec.el.insertBefore(rec.manual.boxEl, rec.actionsEl);
      } else if (rec.manual.boxEl.parentNode !== rec.el) {
        rec.el.insertBefore(rec.manual.boxEl, rec.actionsEl);
      }
      syncManualState(rec.manual);
    }

    if (!info.showQuoteHandoff) {
      disposeQuoteHandoff(rec);
    } else {
      if (!rec.quoteHandoff) {
        const view = createQuoteHandoffView(doc, emit, focusChild);
        rec.quoteHandoff = { view, element: view.element };
      }
      const handoffAnchor = rec.manual ? rec.manual.boxEl : rec.actionsEl;
      if (
        rec.quoteHandoff.element &&
        (rec.quoteHandoff.element.parentNode !== rec.el ||
          rec.quoteHandoff.element.nextSibling !== handoffAnchor)
      ) {
        rec.el.insertBefore(rec.quoteHandoff.element, handoffAnchor);
      }
      rec.quoteHandoff.view.update(task, rawTasks, currentMail, currentMailUI);
    }

    const isMailReview = Boolean(hasMail && info.mailReview);
    const canMailGeneral = Boolean(hasMail && info.canMailGeneralBase);
    const canMailFind = Boolean(hasMail && info.canMailFindBase);
    const canMailRepeat = Boolean(hasMail && info.canMailRepeatBase);
    const canRetry = Boolean(info.canRetry && (!canMailGeneral || isMailReview));
    const retryLabel = isMailReview ? '원문 고치기' : '다시 맡기기';
    if (rec.retryBtn.textContent !== retryLabel) {
      rec.retryBtn.textContent = retryLabel;
    }
    if (rec.resumeBtn.textContent !== info.resumeLabel) {
      rec.resumeBtn.textContent = info.resumeLabel;
    }
    if (rec.mailRepeatBtn.textContent !== info.mailRepeatLabel) {
      rec.mailRepeatBtn.textContent = info.mailRepeatLabel;
    }
    patchButton(rec.cancelBtn, info.canCancel, argId);
    patchButton(rec.resumeBtn, info.canResume, argId);
    patchButton(rec.followBtn, info.canFollow, argId);
    patchButton(rec.retryBtn, canRetry, argId);
    patchButton(rec.mailGeneralBtn, canMailGeneral, key);
    rec.mailGeneralBtn.disabled = Boolean(isMailReview && currentMailUI?.reviewByTask?.[key]?.blockGeneral);
    patchButton(rec.mailFindBtn, canMailFind, key);
    patchButton(rec.mailRepeatBtn, canMailRepeat, key);
    patchButton(rec.terminalBtn, info.canTerminal, argId);

    const anyAction =
      showAnswer ||
      info.canCancel ||
      info.canResume ||
      info.canFollow ||
      canRetry ||
      canMailGeneral ||
      canMailFind ||
      canMailRepeat ||
      info.canTerminal;
    if (rec.actionsEl.hidden !== !anyAction) {
      rec.actionsEl.hidden = !anyAction;
    }
  }

  function render(model) {
    if (model == null || typeof model !== 'object') {
      resetMemory();
      return;
    }

    ensureShell();

    const rawTasks = Array.isArray(model.tasks) ? model.tasks : [];
    const rawDepts = Array.isArray(model.departments) ? model.departments : [];
    const formState = model.form && typeof model.form === 'object' ? model.form : {};

    const nextEpoch = model.epoch ?? 0;
    let rebuiltForm = false;
    if (!formRefs || nextEpoch !== currentEpoch) {
      if (formRefs && formRefs.mailControls) {
        formRefs.mailControls.update(null, null, false, false);
      }
      clearAllMailResults();
      clearAllMailReviews();
      clearAllManuals();
      clearChildren(formSlotEl);
      formRefs = buildForm();
      formSlotEl.appendChild(formRefs.form);
      currentEpoch = nextEpoch;
      lastStamp = NONE;
      lastModelPrompt = '';
      lastDispatchedEdit = '';
      composing = false;
      rebuiltForm = true;
    }

    const storageText = model.storageCode === 'WRITE' ? '업무 기록을 아직 이 PC에 저장하지 못했습니다.'
      : model.storageError ? REASON_MESSAGES.STORAGE : '';
    refreshEl.hidden = !storageText;
    refreshEl.textContent = model.storageCode === 'WRITE' ? '저장 다시 시도' : '기록 다시 읽기';
    if (storageNoteEl.hidden !== !storageText) {
      storageNoteEl.hidden = !storageText;
    }
    if (storageNoteEl.textContent !== storageText) {
      storageNoteEl.textContent = storageText;
    }

    const nextProvider = formState.provider === 'codex' ? 'codex' : 'claude';
    const nextDeptId = formState.departmentId == null ? '' : String(formState.departmentId);
    const nextPreviousId =
      formState.previousId == null || String(formState.previousId) === ''
        ? null
        : String(formState.previousId);
    const nextPrompt = typeof formState.prompt === 'string' ? formState.prompt : '';
    const hasStamp =
      Object.prototype.hasOwnProperty.call(formState, 'stamp') && formState.stamp !== undefined;
    const nextStamp = hasStamp
      ? formState.stamp
      : `${nextProvider}\u0000${nextDeptId}\u0000${nextPreviousId ?? ''}`;

    activeProvider = nextProvider;
    activeDeptId = nextDeptId;
    activePreviousId = nextPreviousId;
    currentMail = model.mail ? model.mail : null;
    currentMailUI = model.mailUI && typeof model.mailUI === 'object' ? model.mailUI : null;

    const showFormMail = nextProvider === 'codex' && Boolean(currentMail);
    formRefs.mailControls.update(
      showFormMail ? currentMail : null,
      showFormMail ? currentMailUI : null,
      showFormMail ? formState.mailSearch : null,
      false,
    );

    if (!currentMail || rawTasks.length === 0) {
      clearAllMailResults();
      clearAllMailReviews();
    } else if (cardMap.size > 0) {
      const nextTaskIds = new Set();
      for (const item of rawTasks) {
        if (item && typeof item === 'object' && item.id != null && String(item.id) !== '') {
          nextTaskIds.add(String(item.id));
        }
      }
      for (const rec of cardMap.values()) {
        if (rec.mailResults && !nextTaskIds.has(rec.mailResults.taskId)) {
          disposeMailResults(rec);
        }
        if (rec.mailReview && !nextTaskIds.has(rec.mailReview.taskId)) {
          disposeMailReview(rec);
        }
      }
    }

    const deptMap = new Map();
    const deptOptions = [{ id: '', name: '사무실' }];
    const seenDepts = new Set(['']);
    for (const item of rawDepts) {
      if (!item || typeof item !== 'object') continue;
      const id = item.id == null ? '' : String(item.id);
      if (!id || seenDepts.has(id)) continue;
      seenDepts.add(id);
      const name = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : id;
      deptMap.set(id, name);
      deptOptions.push({ id, name });
    }
    if (nextDeptId && !seenDepts.has(nextDeptId)) {
      let fallbackName = nextDeptId;
      for (const t of rawTasks) {
        if (
          t &&
          typeof t === 'object' &&
          String(t.departmentId ?? '') === nextDeptId &&
          typeof t.departmentName === 'string' &&
          t.departmentName.trim()
        ) {
          fallbackName = t.departmentName.trim();
          break;
        }
      }
      deptMap.set(nextDeptId, fallbackName);
      deptOptions.push({ id: nextDeptId, name: fallbackName });
    }

    const deptSig = deptOptions.map((o) => `${o.id}\u0000${o.name}`).join('\u0001');
    if (formRefs.deptSig !== deptSig) {
      clearChildren(formRefs.deptSelect);
      for (const optInfo of deptOptions) {
        const opt = doc.createElement('option');
        opt.value = optInfo.id;
        opt.textContent = optInfo.name;
        formRefs.deptSelect.appendChild(opt);
      }
      formRefs.deptSig = deptSig;
    }

    if (formRefs.providerSelect.value !== nextProvider) {
      formRefs.providerSelect.value = nextProvider;
    }
    if (formRefs.deptSelect.value !== nextDeptId) {
      formRefs.deptSelect.value = nextDeptId;
    }

    const locked = Boolean(nextPreviousId);
    if (formRefs.providerSelect.disabled !== locked) {
      formRefs.providerSelect.disabled = locked;
    }
    if (formRefs.deptSelect.disabled !== locked) {
      formRefs.deptSelect.disabled = locked;
    }
    if (formRefs.exitFollowBtn.hidden !== !locked) {
      formRefs.exitFollowBtn.hidden = !locked;
    }

    const followBannerText = locked
      ? '완료된 작업에 이어서 작성 중입니다. 도구나 부서를 변경하려면 먼저 새 작업으로 전환하세요.'
      : '';
    if (formRefs.followNote.hidden !== !followBannerText) {
      formRefs.followNote.hidden = !followBannerText;
    }
    if (formRefs.followNote.textContent !== followBannerText) {
      formRefs.followNote.textContent = followBannerText;
    }

    const stampChanged = rebuiltForm || nextStamp !== lastStamp;
    if (stampChanged) {
      composing = false;
      if (formRefs.textarea.value !== nextPrompt) {
        formRefs.textarea.value = nextPrompt;
      }
      lastDispatchedEdit = nextPrompt;
    } else if (!composing && nextPrompt !== lastModelPrompt && formRefs.textarea.value !== nextPrompt) {
      formRefs.textarea.value = nextPrompt;
      lastDispatchedEdit = nextPrompt;
    }
    lastStamp = nextStamp;
    lastModelPrompt = nextPrompt;

    const busy = Boolean(model.busy || model.storageError);
    if (formRefs.submitBtn.disabled !== busy) {
      formRefs.submitBtn.disabled = busy;
    }

    const errText = storageText ? '' : formatMessage(model.error);
    if (formRefs.errorNote.hidden !== !errText) {
      formRefs.errorNote.hidden = !errText;
    }
    if (formRefs.errorNote.textContent !== errText) {
      formRefs.errorNote.textContent = errText;
    }

    const nextCardEls = [];
    const seenCardKeys = new Set();
    let statusAnnouncement = '';

    for (let i = 0; i < rawTasks.length; i += 1) {
      const task = rawTasks[i];
      if (!task || typeof task !== 'object') continue;
      const baseKey =
        task.id != null && String(task.id) !== '' ? String(task.id) : `sparse-${i}`;
      let key = baseKey;
      let suffix = 1;
      while (seenCardKeys.has(key)) {
        key = `${baseKey}-${suffix}`;
        suffix += 1;
      }
      seenCardKeys.add(key);

      let rec = cardMap.get(key);
      if (!rec) {
        rec = createCard(key);
        cardMap.set(key, rec);
      }

      const info = describeTask(task, deptMap, Boolean(currentMail));
      patchCard(rec, key, info, task, rawTasks);
      nextCardEls.push(rec.el);

      const prevStatus = knownStatuses.get(key);
      if (initializedLive && prevStatus !== info.statusCode && !statusAnnouncement) {
        statusAnnouncement = `${info.deptLabel} ${providerLabel(task.provider)} 작업 상태: ${info.statusText}`;
      }
      knownStatuses.set(key, info.statusCode);
    }

    for (const [key, rec] of cardMap.entries()) {
      if (!seenCardKeys.has(key)) {
        disposeMailReview(rec);
        disposeQuoteHandoff(rec);
        disposeManual(rec);
        if (rec.el.parentNode) {
          rec.el.parentNode.removeChild(rec.el);
        }
        cardMap.delete(key);
        knownStatuses.delete(key);
      }
    }

    for (let i = 0; i < nextCardEls.length; i += 1) {
      const desired = nextCardEls[i];
      const current = listEl.children[i] || null;
      if (current !== desired) {
        listEl.insertBefore(desired, current);
      }
    }

    const hideList = nextCardEls.length === 0;
    if (listEl.hidden !== hideList) {
      listEl.hidden = hideList;
    }

    const nextLive = storageText || errText || statusAnnouncement;
    if (nextLive && nextLive !== lastLiveText) {
      liveEl.textContent = nextLive;
      lastLiveText = nextLive;
    } else if (!nextLive && !statusAnnouncement && lastLiveText && !initializedLive) {
      liveEl.textContent = '';
      lastLiveText = '';
    }
    initializedLive = true;

    const seq = typeof model.focusSeq === 'number' ? model.focusSeq : 0;
    if (rebuiltForm && seq <= 0) {
      lastFocusSeq = 0;
    }
    if (seq > 0 && seq !== lastFocusSeq) {
      lastFocusSeq = seq;
      try {
        formRefs.textarea.focus();
        const end = formRefs.textarea.value.length;
        if (typeof formRefs.textarea.setSelectionRange === 'function') {
          formRefs.textarea.setSelectionRange(end, end);
        }
      } catch {
        // Ignore focus errors in detached or synthetic environments.
      }
    }
  }

  function dispose() {
    resetMemory();
  }

  return { render, dispose };
}
