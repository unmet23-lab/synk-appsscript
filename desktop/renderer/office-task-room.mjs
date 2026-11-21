const PROVIDERS = new Set(['claude', 'codex']);
const ACTIVE_STATUSES = new Set(['queued', 'paused', 'running', 'terminal']);
const RETRY_STATUSES = new Set(['interrupted', 'failed']);
const STORAGE_CODES = new Set(['STORAGE', 'WRITE']);

const STORAGE_BLOCK_MSG = '작업 기록 저장소에 문제가 있어 새 작업을 보낼 수 없습니다.';
const IPC_ERROR_MSG = '요청 전달 중 통신 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
const EMPTY_PROMPT_MSG = '작업 내용을 입력해 주세요.';

const EMPTY_ANSWER_MSG = '보관할 답변 내용을 입력해 주세요.';
export const MAX_MANUAL_ANSWER_LENGTH = 524288;

export function classifyCodexTask(task) {
  if (task?.provider !== 'codex') {
    return { manualResult: false, memberResult: false, legacyViaTerminal: false, blockFollowUp: false };
  }
  const status = typeof task.status === 'string' ? task.status : '';
  const reason = typeof task.reason === 'string' ? task.reason.trim() : '';
  const viaTerminal = task.viaTerminal === true;
  const hasAnswer =
    reason !== 'MANUAL_RESULT' && typeof task.answer === 'string' && task.answer.trim().length > 0;
  const manualResult =
    (status === 'terminal' || status === 'interrupted') && reason === 'MANUAL_RESULT';
  const memberResult = viaTerminal && status === 'interrupted' && reason === 'MEMBER_RESULT';
  const legacyViaTerminal =
    viaTerminal &&
    !manualResult &&
    !memberResult &&
    (hasAnswer || status === 'completed' || reason === 'UNCONFIRMED');
  return {
    manualResult,
    memberResult,
    legacyViaTerminal,
    blockFollowUp:
      manualResult ||
      memberResult ||
      legacyViaTerminal ||
      reason === 'MANUAL_RESULT' ||
      reason === 'MEMBER_RESULT',
  };
}

const REASON_MESSAGES = {
  STORAGE: STORAGE_BLOCK_MSG,
  STORAGE_FULL: '업무 기록의 저장 한도에 도달했습니다. 새 일을 저장할 수 없습니다.',
  VALUE: '담당자와 업무 내용을 확인해 주세요. 한 번에 8,000자까지 맡길 수 있습니다.',
  NOT_FOUND: '선택한 업무나 부서를 찾을 수 없습니다.',
  BUSY: '이 대화에서 먼저 맡긴 일이 아직 진행 중입니다. 끝난 뒤 이어서 맡겨 주세요.',
  ID_CONFLICT: '요청 번호가 이미 다른 일에 쓰였습니다. 내용을 확인하고 새 일로 맡겨 주세요.',
  NOT_ALLOWED: '이 로그인에서는 일을 맡길 수 없습니다.',
  WRITE: '작업 기록을 저장하지 못했습니다.',
  LOGIN: '도구 로그인이 필요합니다. 터미널에서 로그인한 뒤 다시 시도해 주세요.',
  AUTH_CHANGED: '인증 정보가 변경되었습니다. 터미널에서 다시 확인해 주세요.',
  LIMIT: '사용 한도에 도달하여 지금은 요청할 수 없습니다.',
  PROVIDER: '지원하지 않는 작업 도구입니다.',
  UNSUPPORTED: '지원하지 않는 작업 도구입니다.',
  NO_CLI: '선택한 작업 도구가 설치되어 있지 않습니다.',
  TERMINAL_CLOSED: '터미널이 닫혀 작업을 계속할 수 없습니다.',
  NO_ANSWER: '작업 응답을 받지 못했습니다.',
  FOLDER: '작업 폴더를 준비할 수 없습니다.',
  SESSION: '이전 작업 세션을 이어서 열 수 없습니다.',
  PERMISSION: '권한이 부족하여 작업을 실행할 수 없습니다.',
  NATIVE: '시스템 실행 중 오류가 발생했습니다.',
  RESTART: '프로그램이 다시 시작되어 작업이 중단되었습니다.',
  CANCELLED: '취소된 작업입니다.',
  RESULT_TOO_LARGE: '결과 크기가 너무 커서 처리할 수 없습니다.',
};

function isStorageCode(code) {
  return typeof code === 'string' && STORAGE_CODES.has(code.toUpperCase());
}

function extractCode(res) {
  if (!res || typeof res !== 'object') return null;
  for (const field of [res.code, res.reason, res.error]) {
    if (typeof field === 'string' && field) return field.toUpperCase();
  }
  return null;
}

function formatRefusalError(res) {
  const code = extractCode(res);
  if (code && REASON_MESSAGES[code]) return REASON_MESSAGES[code];
  for (const text of [res?.message, res?.error]) {
    if (typeof text === 'string' && /[가-힣]/.test(text)) return text;
  }
  return '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
}

function toTimestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function sortTasksNewestFirst(list) {
  return list
    .filter((task) => task && typeof task === 'object')
    .map((task, index) => ({
      task,
      index,
      created: toTimestamp(task.createdAt),
      updated: toTimestamp(task.updatedAt),
    }))
    .sort((a, b) => {
      const tA = a.created ?? a.updated;
      const tB = b.created ?? b.updated;
      if (tA !== null && tB !== null && tA !== tB) return tB - tA;
      if (tA !== null && tB === null) return -1;
      if (tA === null && tB !== null) return 1;
      if ((a.updated ?? 0) !== (b.updated ?? 0)) return (b.updated ?? 0) - (a.updated ?? 0);
      return a.index - b.index;
    })
    .map((entry) => entry.task);
}

const HEADLINE_STATES = {
  terminal: ['공식 터미널에서 확인을 기다립니다.', '아래에서 해당 업무의 공식 터미널을 열어 주세요.'],
  running: ['맡은 일을 진행하고 있습니다.', ''],
  queued: ['맡은 일의 차례를 기다리고 있습니다.', ''],
  paused: ['맡은 일을 잠시 멈췄습니다.', '준비되면 해당 업무에서 다시 시작할 수 있습니다.'],
};

export function officeTaskHeadline(head, sessions, tasking) {
  if (!Array.isArray(tasking?.tasks) || sessions.length) return head;
  const byTime = sortTasksNewestFirst(tasking.tasks);
  for (const [status, [say, then]] of Object.entries(HEADLINE_STATES)) {
    const task = byTime.find(item => item.status === status && PROVIDERS.has(item.provider));
    if (task) return { ...head, say: (task.provider === 'codex' ? 'GPT (Codex)' : 'Claude Code') + ' 직원이 ' + say, then };
  }
  return { ...head, say: isStorageCode(tasking.code)
    ? '업무 기록의 저장 상태를 확인해 주세요.'
    : '직원에게 새 일을 맡길 수 있습니다.', then: '' };
}

function normalizeDepartments(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((d) => d && typeof d.id === 'string' && d.id)
    .map((d) => ({ id: d.id, name: typeof d.name === 'string' && d.name ? d.name : d.id }));
}

function draftKey(provider, departmentId, previousId) {
  return JSON.stringify([provider, departmentId ?? null, previousId ?? null]);
}

export function createOfficeTaskRoom({
  api,
  changed,
  reread,
  makeId = () => crypto.randomUUID(),
} = {}) {
  let epoch = 0;
  let generation = 0;
  let stampSeq = 1;
  let focusCounter = 0;
  let hasFeature = false;
  let cachedTasking = null;
  let cachedTasks = [];
  let cachedDepartments = [];
  let provider = 'claude';
  let departmentId = null;
  let previousId = null;
  let stamp = stampSeq;
  let focusSeq = 0;
  let drafts = new Map();
  const unacknowledged = new Map();
  let submitting = false;
  let pendingActions = new Set();
  let error = null;
  let actionStorageError = false;
  let blockedBySnapStorage = false;

  const getDraft = (p, d, prev) => drafts.get(draftKey(p, d, prev)) ?? '';
  const setDraft = (p, d, prev, text) => drafts.set(draftKey(p, d, prev), text);
  const deleteDraft = (p, d, prev) => drafts.delete(draftKey(p, d, prev));
  const findTask = (id) => cachedTasks.find((t) => t.id === id) ?? null;

  function clearTransientError() {
    error = null;
    actionStorageError = false;
    blockedBySnapStorage = false;
  }

  function clearSession(bumpEpoch) {
    if (bumpEpoch) epoch += 1;
    generation += 1;
    hasFeature = false;
    cachedTasking = null;
    cachedTasks = [];
    cachedDepartments = [];
    provider = 'claude';
    departmentId = null;
    previousId = null;
    stamp = ++stampSeq;
    focusSeq = 0;
    drafts = new Map();
    unacknowledged.clear();
    submitting = false;
    pendingActions = new Set();
    clearTransientError();
  }

  async function notifySettled(reqEpoch, reqGen) {
    if (typeof reread === 'function') {
      let pending;
      try {
        pending = reread();
      } catch {}
      if (pending && typeof pending.then === 'function') {
        changed?.();
        try {
          await pending;
        } catch {}
        if (reqEpoch !== epoch || reqGen !== generation) return;
      }
    }
    changed?.();
  }

  function openDraft(p) {
    if (p.arg !== undefined && p.arg !== null && p.arg !== '') {
      if (!PROVIDERS.has(p.arg)) {
        error = REASON_MESSAGES.PROVIDER;
        actionStorageError = false;
        changed?.();
        return;
      }
      provider = p.arg;
    }
    const rawKey = typeof p.key === 'string' ? p.key : '';
    departmentId = rawKey.startsWith('d:') ? rawKey.slice(2) || null : null;
    previousId = null;
    clearTransientError();
    stamp = ++stampSeq;
    focusSeq = ++focusCounter;
    changed?.();
  }

  function selectTaskForDraft(id, asFollow) {
    const task = findTask(id);
    if (!task) return;
    if (asFollow ? task.status !== 'completed' : !RETRY_STATUSES.has(task.status)) return;
    if (classifyCodexTask(task).blockFollowUp) return;
    if (!PROVIDERS.has(task.provider)) {
      error = REASON_MESSAGES.PROVIDER;
      actionStorageError = false;
      changed?.();
      return;
    }
    provider = task.provider;
    departmentId = task.departmentId ?? null;
    previousId = asFollow ? task.id : null;
    if (!asFollow) {
      const original = typeof task.prompt === 'string' ? task.prompt : '';
      setDraft(provider, departmentId, null, original);
      unacknowledged.delete(JSON.stringify([provider, departmentId, null, original]));
    }
    clearTransientError();
    stamp = ++stampSeq;
    focusSeq = ++focusCounter;
    changed?.();
  }

  async function submitDraft(p) {
    if (submitting) return;
    if (typeof p.fields?.prompt === 'string') setDraft(provider, departmentId, previousId, p.fields.prompt);
    const promptText = getDraft(provider, departmentId, previousId);
    if (isStorageCode(cachedTasking?.code)) {
      error = STORAGE_BLOCK_MSG;
      blockedBySnapStorage = true;
      changed?.();
      return;
    }
    if (!PROVIDERS.has(provider)) {
      error = REASON_MESSAGES.PROVIDER;
      actionStorageError = false;
      changed?.();
      return;
    }
    if (previousId !== null) {
      const prev = findTask(previousId);
      if (!prev || prev.status !== 'completed' || classifyCodexTask(prev).blockFollowUp || prev.provider !== provider || (prev.departmentId ?? null) !== departmentId) {
        error = REASON_MESSAGES.SESSION;
        actionStorageError = false;
        changed?.();
        return;
      }
    }
    if (!promptText.trim()) {
      error = EMPTY_PROMPT_MSG;
      actionStorageError = false;
      changed?.();
      return;
    }
    const requestKey = JSON.stringify([provider, departmentId, previousId, promptText]);
    const id = unacknowledged.get(requestKey)?.id ?? makeId();
    const sent = { provider, departmentId, previousId };
    const payload = previousId ? { id, provider, departmentId, prompt: promptText, previousId } : { id, provider, departmentId, prompt: promptText };
    const reqEpoch = epoch;
    const reqGen = generation;
    clearTransientError();
    submitting = true;
    changed?.();
    let res;
    try {
      res = await api.submitTask(payload);
      if (res?.ok !== false && (res?.ok !== true || res.id !== id)) throw new Error('Missing submission acknowledgement');
    } catch {
      if (reqEpoch !== epoch || reqGen !== generation) return;
      unacknowledged.set(requestKey, { id, ...sent, prompt: promptText });
      submitting = false;
      error = IPC_ERROR_MSG;
      changed?.();
      return;
    }
    if (reqEpoch !== epoch || reqGen !== generation) return;
    if (res.ok === false) {
      submitting = false;
      actionStorageError = isStorageCode(res.code) ? res.code : false;
      error = formatRefusalError(res);
      changed?.();
      return;
    }
    unacknowledged.delete(requestKey);
    const liveDraft = getDraft(sent.provider, sent.departmentId, sent.previousId);
    const edited = liveDraft !== promptText;
    const sameCtx = provider === sent.provider && departmentId === sent.departmentId && previousId === sent.previousId;
    if (!edited) deleteDraft(sent.provider, sent.departmentId, sent.previousId);
    if (sameCtx) {
      if (edited && sent.previousId !== null) {
        deleteDraft(sent.provider, sent.departmentId, sent.previousId);
        previousId = null;
        setDraft(provider, departmentId, null, liveDraft);
      } else if (!edited) {
        previousId = null;
        stamp = ++stampSeq;
      }
    }
    submitting = false;
    await notifySettled(reqEpoch, reqGen);
  }

  async function runTaskAction(id, kind, rawAnswer) {
    if (typeof id !== 'string' || !id || pendingActions.has(id)) return;
    const task = findTask(id);
    if (!task) return;
    const codexState = classifyCodexTask(task);
    if (kind === 'cancel') {
      if (!ACTIVE_STATUSES.has(task.status)) return;
    } else if (kind === 'resume') {
      if (task.status !== 'paused') return;
    } else if (kind === 'terminal') {
      if (task.canOpenTerminal !== true || codexState.memberResult || codexState.legacyViaTerminal) return;
    } else if (kind === 'saveAnswer') {
      if (!codexState.manualResult) return;
      if (typeof rawAnswer !== 'string' || !rawAnswer.trim()) {
        clearTransientError();
        error = EMPTY_ANSWER_MSG;
        changed?.();
        return;
      }
      if (rawAnswer.length > MAX_MANUAL_ANSWER_LENGTH) {
        clearTransientError();
        error = REASON_MESSAGES.RESULT_TOO_LARGE;
        changed?.();
        return;
      }
    } else {
      return;
    }
    const reqEpoch = epoch;
    const reqGen = generation;
    clearTransientError();
    pendingActions.add(id);
    changed?.();
    let res;
    try {
      res =
        kind === 'saveAnswer'
          ? await api.taskAction(id, 'saveAnswer', rawAnswer)
          : await api.taskAction(id, kind);
    } catch {
      if (reqEpoch !== epoch || reqGen !== generation) return;
      pendingActions.delete(id);
      error = IPC_ERROR_MSG;
      changed?.();
      return;
    }
    if (reqEpoch !== epoch || reqGen !== generation) return;
    pendingActions.delete(id);
    if (res?.ok !== true) {
      actionStorageError = isStorageCode(res?.code) ? res.code : false;
      error = formatRefusalError(res);
      changed?.();
      return;
    }
    await notifySettled(reqEpoch, reqGen);
  }

  function scene(tasking, departments) {
    if (!tasking || typeof tasking !== 'object' || !Array.isArray(tasking.tasks)) {
      if (hasFeature) clearSession(false);
      return null;
    }
    hasFeature = true;
    cachedTasking = tasking;
    cachedTasks = sortTasksNewestFirst(tasking.tasks);
    cachedDepartments = normalizeDepartments(departments);
    for (const [key, uncertain] of unacknowledged) {
      if (!cachedTasks.some(t => t.id === uncertain.id)) continue;
      const { provider: sentProvider, departmentId: sentDepartment, previousId: sentPrevious, prompt: sentPrompt } = uncertain;
      const sameContext = provider === sentProvider && departmentId === sentDepartment && previousId === sentPrevious;
      if (getDraft(sentProvider, sentDepartment, sentPrevious) === sentPrompt) {
        deleteDraft(sentProvider, sentDepartment, sentPrevious);
        if (sameContext) {
          previousId = null;
          stamp = ++stampSeq;
        }
      }
      if (sameContext) clearTransientError();
      unacknowledged.delete(key);
    }
    const snapStorageError = isStorageCode(tasking.code);
    if (!snapStorageError && blockedBySnapStorage) clearTransientError();
    return {
      tasks: cachedTasks,
      departments: cachedDepartments,
      form: { provider, departmentId, previousId, prompt: getDraft(provider, departmentId, previousId), stamp },
      busy: submitting || pendingActions.size > 0,
      error: error ?? (snapStorageError ? STORAGE_BLOCK_MSG : null),
      storageError: Boolean(snapStorageError || actionStorageError),
      storageCode: snapStorageError ? tasking.code : actionStorageError || null,
      focusSeq,
      epoch,
    };
  }

  function handle(p) {
    if (!hasFeature || !p || typeof p !== 'object') return;
    if (p.act === 'task-refresh') {
      clearTransientError();
      return notifySettled(epoch, generation);
    }
    if (p.act === 'task-open') return openDraft(p);
    if (p.act === 'task-edit') {
      setDraft(provider, departmentId, previousId, typeof p.fields?.prompt === 'string' ? p.fields.prompt : '');
      return;
    }
    if (p.act === 'task-provider') {
      if (previousId !== null) return;
      if (!PROVIDERS.has(p.arg)) {
        error = REASON_MESSAGES.PROVIDER;
        actionStorageError = false;
        changed?.();
        return;
      }
      if (p.arg !== provider) {
        provider = p.arg;
        clearTransientError();
        stamp = ++stampSeq;
        changed?.();
      }
      return;
    }
    if (p.act === 'task-department') {
      if (previousId !== null) return;
      const next = typeof p.arg === 'string' && p.arg ? p.arg : null;
      if (next !== departmentId) {
        departmentId = next;
        clearTransientError();
        stamp = ++stampSeq;
        changed?.();
      }
      return;
    }
    if (p.act === 'task-follow') return selectTaskForDraft(p.arg, true);
    if (p.act === 'task-retry') return selectTaskForDraft(p.arg, false);
    if (p.act === 'task-submit') return submitDraft(p);
    if (p.act === 'task-cancel') return runTaskAction(p.arg, 'cancel');
    if (p.act === 'task-resume') return runTaskAction(p.arg, 'resume');
    if (p.act === 'task-terminal') return runTaskAction(p.arg, 'terminal');
    if (p.act === 'task-save-answer') return runTaskAction(p.arg, 'saveAnswer', p.fields?.answer);
  }

  function reset() {
    clearSession(true);
  }

  return { scene, handle, reset };
}
