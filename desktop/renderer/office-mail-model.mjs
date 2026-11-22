const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PROVIDER_LABELS = Object.freeze({
  gmail: 'Gmail',
  outlook: 'Outlook',
});

const MAIL_CODE_MESSAGES = Object.freeze({
  MAIL_CONNECT: '메일 계정이 연결되지 않았거나 연결을 완료하지 못했습니다.',
  MAIL_RECONNECT: '메일 인증이 만료되어 계정을 다시 연결해야 합니다.',
  MAIL_CONFIG: '이 환경에 메일 연결 설정이 준비되지 않았습니다.',
  MAIL_PLAN: '검색 조건을 정하지 못했습니다. 메일 검색은 검색어, 보낸 사람, 기간, 폴더, 연결한 메일 계정, 첨부 있음 조건을 지원하며, 안 읽음·별표·첨부 없음·첨부파일 이름/내용 등은 지원하지 않습니다. 이미 검색 조건 편집이 열린 카드에서는 그 조건을 바로 고치고, 일반 업무 카드에서는 업무 입력란의 원문을 고쳐서 다시 맡겨 주세요.',
  MAIL_NETWORK: '네트워크 연결이 원활하지 않아 메일 요청을 처리하지 못했습니다.',
  MAIL_STORAGE: '보관된 메일 데이터나 연결 정보를 처리하는 중 저장소 문제가 발생했습니다.',
  MAIL_LIMIT: '메일 요청 한도에 도달했으니 잠시 후 다시 시도해 주세요.',
  MAIL_SCOPE: '필요한 메일 읽기 권한이 허용되지 않아 요청을 완료할 수 없습니다.',
  MAIL_CANCELLED: '메일 연결 과정이 취소되었습니다.',
  MAIL_TIMEOUT: 'Gmail/Outlook 계정 선택이나 동의를 마치기 전에 연결 대기 시간이 지났지만, 공식 연결 창을 다시 열어 진행할 수 있습니다.',
  MAIL_NOT_FOUND: '메일 공급자에서 해당 메일을 더는 찾지 못해 저장해 둔 메일의 원문을 열 수 없습니다.',
  MAIL_CHANGED: '연결된 계정이나 보관된 메일 상태가 변경되어 다시 확인해야 합니다.',
  MAIL_PAGE_RESTART: '이전 형식의 결과라 이어서 불러올 위치를 확인할 수 없습니다. 같은 조건으로 다시 검색해 주세요.',
  MAIL_BUSY: '이미 다른 메일 작업을 처리하고 있으니 잠시 후 다시 시도해 주세요.',
  MAIL_CHOOSE: '메일 검색이 필요한 요청인지 확인이 필요합니다. ‘일반 업무로 맡기기’와 ‘메일에서 찾기’ 중에서 선택해 주세요.',
  MAIL_NO_MAILBOX: '계정 로그인은 됐지만 이 계정의 Outlook 메일함이 없습니다. 다른 주소로 다시 연결할 수 있습니다.',
});

export function mailProviderLabel(id) {
  if (typeof id !== 'string') return '';
  const key = id.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(PROVIDER_LABELS, key) ? PROVIDER_LABELS[key] : '';
}

export function mailCodeText(code) {
  if (typeof code !== 'string') return '';
  const key = code.trim();
  return Object.prototype.hasOwnProperty.call(MAIL_CODE_MESSAGES, key) ? MAIL_CODE_MESSAGES[key] : '';
}

function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function findCodexMailTarget(tasks, taskId, itemId) {
  if (!isUuid(taskId) || !isUuid(itemId) || !Array.isArray(tasks)) return null;
  const task = tasks.find(row => row?.id === taskId);
  if (task?.provider !== 'codex' || task.mailSearch !== true || task.viaTerminal) return null;
  const groups = task.mailResult?.groups;
  const ownsItem = Array.isArray(groups) && groups.some(group =>
    Array.isArray(group?.items) && group.items.some(item => item?.id === itemId));
  return ownsItem ? { taskId, itemId } : null;
}

function failureNote(code, fallback) {
  const text = mailCodeText(code);
  return text || fallback;
}

function createMailPager({ api, current, changed, reread } = {}) {
  const PROVIDERS = new Set(['gmail', 'outlook']);
  const AGENT_KEYS = [
    'agent',
    'agentId',
    'engine',
    'provider',
    'runner',
    'runtime',
    'cli',
    'tool',
    'worker',
    'assignee',
    'backend',
    'executor',
    'model',
    'kind',
    'type',
    'source',
    'vendor',
    'adapter',
  ];
  const PRIMARY_KIND_KEYS = ['kind', 'type', 'taskType'];
  const KIND_KEYS = [
    'kind',
    'type',
    'taskType',
    'subkind',
    'subtype',
    'mode',
    'tool',
    'action',
    'intent',
    'category',
    'workflow',
    'feature',
    'skill',
    'command',
    'operation',
  ];
  const FALLBACK_TEXT = {
    MAIL_CHANGED: '연결된 메일 계정이 바뀌었습니다. 다시 검색해 주세요.',
  };

  let generation = 0;
  let state = {};

  function isSafeKey(id) {
    if (typeof id === 'string') {
      return (
        id.length > 0 &&
        id !== '__proto__' &&
        id !== 'constructor' &&
        id !== 'prototype'
      );
    }
    return typeof id === 'number' && Number.isFinite(id);
  }

  function matchesTag(value, target) {
    if (value === target) return true;
    if (value && typeof value === 'object') {
      return (
        value.id === target ||
        value.name === target ||
        value.kind === target ||
        value.type === target ||
        value.engine === target ||
        value.provider === target
      );
    }
    return false;
  }

  function isEligibleTask(task) {
    if (!task || typeof task !== 'object') return false;
    const status = task.status !== undefined ? task.status : task.state;
    if (status !== 'completed') return false;
    if (task.viaTerminal || task.quoteHandoff || task.quoteSource) return false;
    if (task.codex === false || task.mailSearch === false) return false;

    const isCodex =
      task.codex === true ||
      AGENT_KEYS.some((key) => matchesTag(task[key], 'codex'));
    if (!isCodex) return false;

    if (KIND_KEYS.some((key) => matchesTag(task[key], 'mailSearch'))) {
      return true;
    }

    const hasOtherPrimaryKind = PRIMARY_KIND_KEYS.some((key) => {
      const v = task[key];
      if (v === undefined || v === null || v === '') return false;
      return !matchesTag(v, 'codex');
    });
    if (hasOtherPrimaryKind) return false;

    return (
      task.mailSearch === true ||
      Boolean(task.mailSearch && typeof task.mailSearch === 'object')
    );
  }

  function findMailGroup(groups, p) {
    if (Array.isArray(groups)) {
      return (
        groups.find((g) => g && typeof g === 'object' && g.provider === p) ||
        null
      );
    }
    if (
      groups &&
      typeof groups === 'object' &&
      Object.prototype.hasOwnProperty.call(groups, p)
    ) {
      const g = groups[p];
      return g && typeof g === 'object' ? g : null;
    }
    return null;
  }

  function findMailProvider(providers, p) {
    if (Array.isArray(providers)) {
      return (
        providers.find(
          (item) =>
            item &&
            typeof item === 'object' &&
            (item.provider === p || item.id === p)
        ) || null
      );
    }
    if (
      providers &&
      typeof providers === 'object' &&
      Object.prototype.hasOwnProperty.call(providers, p)
    ) {
      const item = providers[p];
      return item && typeof item === 'object' ? item : null;
    }
    return null;
  }

  function normalizeAddress(address) {
    return typeof address === 'string' ? address.trim().toLowerCase() : '';
  }

  function extractCodeFromObject(obj) {
    if (!obj || typeof obj !== 'object') return '';
    const candidates = [
      obj.code,
      obj.error?.code,
      obj.data?.code,
      obj.cause?.code,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }
    if (typeof obj.error === 'string' && obj.error.trim()) {
      return obj.error.trim();
    }
    if (
      typeof obj.message === 'string' &&
      /^[A-Z][A-Z0-9_]+$/.test(obj.message.trim())
    ) {
      return obj.message.trim();
    }
    return '';
  }

  function extractErrorCode(err) {
    if (typeof err === 'string') return err.trim();
    return extractCodeFromObject(err);
  }

  function inspectResult(res) {
    if (res === false) {
      return { failed: true, code: '' };
    }
    if (!res || typeof res !== 'object') {
      return { failed: false, code: '' };
    }
    if (res.ok === true || res.success === true) {
      return { failed: false, code: '' };
    }
    if (res.ok === false || res.success === false || Boolean(res.error)) {
      return { failed: true, code: extractCodeFromObject(res) };
    }
    if (
      typeof res.code === 'string' &&
      res.code.trim() !== '' &&
      res.code !== 'OK' &&
      !('task' in res) &&
      !('tasks' in res) &&
      !('mailResult' in res) &&
      !('groups' in res) &&
      !('group' in res) &&
      !('items' in res) &&
      !('messages' in res)
    ) {
      return { failed: true, code: res.code.trim() };
    }
    return { failed: false, code: '' };
  }

  function resolveMailNotice(code) {
    const normalized = typeof code === 'string' ? code : '';
    if (typeof mailCodeText === 'function') {
      return failureNote(normalized, '메일을 더 불러오지 못했습니다.');
    }
    if (typeof api?.mailCodeText === 'function') {
      return String(api.mailCodeText(normalized) ?? '');
    }
    return FALLBACK_TEXT[normalized] || '메일을 더 불러오지 못했습니다.';
  }

  function setGroupUi(key, p, entry) {
    state = {
      ...state,
      [key]: {
        ...(state[key] || {}),
        [p]: entry,
      },
    };
    changed?.();
  }

  async function run(id, p, n) {
    if (!isSafeKey(id)) return;
    if (!PROVIDERS.has(p)) return;
    if (!Number.isInteger(n) || n < 0) return;

    const key = String(id);
    if (state[key]?.[p]?.busy) return;

    const snap = typeof current === 'function' ? current() : null;
    const tasks = Array.isArray(snap?.tasks) ? snap.tasks : [];
    const task = tasks.find((item) => item && item.id === id);
    if (!isEligibleTask(task)) return;

    const group = findMailGroup(task.mailResult?.groups, p);
    if (!group || group.more !== true || group.page !== n) return;

    const providerInfo = findMailProvider(snap?.mail?.providers, p);
    const groupAddress = normalizeAddress(group.address);
    const currentAddress = normalizeAddress(providerInfo?.address);
    if (
      !providerInfo ||
      providerInfo.connected !== true ||
      !groupAddress ||
      groupAddress !== currentAddress
    ) {
      const code = 'MAIL_CHANGED';
      setGroupUi(key, p, {
        page: n,
        busy: false,
        notice: resolveMailNotice(code),
        code,
      });
      return;
    }

    const runGen = generation;
    setGroupUi(key, p, {
      page: n,
      busy: true,
      notice: '',
      code: '',
    });

    let failed = false;
    let failCode = '';
    try {
      if (typeof api?.moreMail !== 'function') {
        failed = true;
      } else {
        const res = await api.moreMail(id, p, n);
        const outcome = inspectResult(res);
        failed = outcome.failed;
        failCode = outcome.code;
      }
    } catch (err) {
      failed = true;
      failCode = extractErrorCode(err);
    }

    if (runGen !== generation) return;

    if (!failed) {
      if (typeof reread === 'function') {
        try {
          await reread();
        } catch (_err) {
          // Keep UI state consistent even if refresh fails.
        }
        if (generation !== runGen) return;
      }
      setGroupUi(key, p, {
        page: n,
        busy: false,
        notice: '',
        code: '',
      });
      return;
    }

    setGroupUi(key, p, {
      page: n,
      busy: false,
      notice: resolveMailNotice(failCode),
      code: failCode,
    });
  }

  function reset() {
    generation += 1;
    const hadEntries = Object.keys(state).length > 0;
    state = {};
    if (hadEntries) {
      changed?.();
    }
  }

  function ui() {
    return state;
  }

  return { run, reset, ui };
}

export function createOfficeMailActions({ api, current, changed, reread } = {}) {
  const pages = createMailPager({ api, current, changed, reread });
  let generation = 0;
  let pendingProvider = null;
  let providerNotes = {};
  let sourceNotes = {};
  let sourceItemNotes = {};
  const pendingOpenTasks = new Set();

  function notifyChanged() {
    if (typeof changed === 'function') {
      changed();
    }
  }

  function reset() {
    generation += 1;
    pendingProvider = null;
    providerNotes = {};
    sourceNotes = {};
    sourceItemNotes = {};
    pendingOpenTasks.clear();
    pages.reset();
  }

  function ui() {
    return {
      pendingProvider,
      providerNotes: Object.assign({}, providerNotes),
      sourceNotes: Object.assign({}, sourceNotes),
      sourceItemNotes: Object.assign({}, sourceItemNotes),
      pageByTask: pages.ui(),
    };
  }

  async function runProviderAction(act, id, state) {
    if (state.provider !== 'codex') return;
    if (id !== 'gmail' && id !== 'outlook') return;
    if (pendingProvider !== null) return;

    const row = state.mail.providers.find(item => item?.id === id);
    if (!row) return;

    const isConnect = act === 'task-mail-connect';
    if (isConnect) {
      if (!row.configured || (row.connected && !row.reconnect)) return;
    } else {
      if (!row.connected && !row.reconnect) return;
    }

    const runGeneration = generation;
    pendingProvider = id;
    delete providerNotes[id];
    notifyChanged();

    let result = null;
    let errorCode = '';
    try {
      const call = isConnect ? api && api.connectMail : api && api.disconnectMail;
      if (typeof call === 'function') {
        result = await call.call(api, id);
      }
    } catch (err) {
      errorCode = err && typeof err.code === 'string' ? err.code : '';
    }

    if (generation !== runGeneration) return;

    if (result && result.ok === true) {
      delete providerNotes[id];
      if (typeof reread === 'function') {
        try {
          await reread();
        } catch (_err) {
          // Keep UI state consistent even if refresh fails.
        }
        if (generation !== runGeneration) return;
      }
      pendingProvider = null;
      notifyChanged();
      return;
    }

    const label = mailProviderLabel(id) || '메일';
    const fallback = isConnect
      ? label + ' 연결을 완료하지 못했습니다.'
      : label + ' 연결을 해제하지 못했습니다.';
    const code = result && typeof result.code === 'string' ? result.code : errorCode;
    pendingProvider = null;
    providerNotes[id] = failureNote(code, fallback);
    notifyChanged();
  }

  async function runOpenMailResult(arg, fields, state) {
    const itemId = fields && typeof fields === 'object' ? fields.itemId : '';
    const target = findCodexMailTarget(state.tasks, arg, itemId);
    if (!target) return;
    if (pendingOpenTasks.has(target.taskId)) return;

    const runGeneration = generation;
    const itemKey = JSON.stringify([target.taskId, target.itemId]);
    pendingOpenTasks.add(target.taskId);
    delete sourceNotes[target.taskId];
    delete sourceItemNotes[itemKey];

    let result = null;
    let errorCode = '';
    try {
      if (api && typeof api.openMailResult === 'function') {
        result = await api.openMailResult(target.taskId, target.itemId);
      }
    } catch (err) {
      errorCode = err && typeof err.code === 'string' ? err.code : '';
    }

    if (generation !== runGeneration) return;

    pendingOpenTasks.delete(target.taskId);
    if (result && result.ok === true) {
      delete sourceNotes[target.taskId];
      delete sourceItemNotes[itemKey];
      notifyChanged();
      return;
    }

    const code = result && typeof result.code === 'string' ? result.code : errorCode;
    const note = failureNote(code, '보관된 메일 원문을 열지 못했습니다.');
    sourceNotes[target.taskId] = note;
    sourceItemNotes[itemKey] = note;
    notifyChanged();
  }

  async function handle(action = {}) {
    if (!action || typeof action !== 'object') return;
    const { act, arg, fields } = action;
    if (
      act !== 'task-mail-connect' &&
      act !== 'task-mail-disconnect' &&
      act !== 'task-mail-open' &&
      act !== 'task-mail-more'
    ) {
      return;
    }

    const state = typeof current === 'function' ? current() : null;
    if (!Array.isArray(state?.mail?.providers)) {
      return;
    }

    if (act === 'task-mail-more') {
      await pages.run(arg, fields?.provider, fields?.expectedPage);
      return;
    }

    if (act === 'task-mail-open') {
      await runOpenMailResult(arg, fields, state);
      return;
    }

    await runProviderAction(act, arg, state);
  }

  return { handle, reset, ui };
}

function ambiguousMailChoice(task, previous, action) {
  const isReview = task?.reason === 'MAIL_REVIEW';
  if (isReview ? action !== 'task-mail-general' : (action !== 'task-mail-find' && action !== 'task-mail-general')) {
    return null;
  }
  if (!task || typeof task.id !== 'string' || !task.id || task.viaTerminal ||
      task.provider !== 'codex' || task.status !== 'failed' ||
      (isReview ? task.mailSearch !== true : task.reason !== 'MAIL_CHOOSE') ||
      typeof task.prompt !== 'string' || !task.prompt.trim()) {
    return null;
  }
  const departmentId = task.departmentId ?? null;
  const fields = {
    provider: 'codex', departmentId, prompt: task.prompt, mailSearch: action === 'task-mail-find',
  };
  if (typeof task.previousId === 'string' && task.previousId &&
      previous && previous.id === task.previousId && previous.id !== task.id &&
      previous.provider === 'codex' && (previous.departmentId ?? null) === departmentId &&
      previous.status === 'completed' &&
      previous.reason !== 'MAIL_CHOOSE' && previous.reason !== 'MAIL_REVIEW' && !previous.viaTerminal) {
    fields.previousId = previous.id;
  }
  return fields;
}

export function defaultMailMode(task, asFollow) {
  if (!task || asFollow || task.provider !== 'codex' || task.reason === 'MAIL_CHOOSE') return null;
  return typeof task.mailSearch === 'boolean' ? task.mailSearch : null;
}

export function mailCardRequest(task, action, previous) {
  if (task?.reason === 'MAIL_CHOOSE' || task?.reason === 'MAIL_REVIEW') {
    return ambiguousMailChoice(task, previous, action);
  }
  if (!task || typeof task.id !== 'string' || !task.id || task.viaTerminal ||
      task.provider !== 'codex' || typeof task.prompt !== 'string' || !task.prompt.trim()) {
    return null;
  }
  const fields = {
    provider: 'codex', departmentId: task.departmentId ?? null, prompt: task.prompt, mailSearch: true,
  };
  const completed = task.status === 'completed' && typeof task.answer === 'string' && Boolean(task.answer.trim());
  if (action === 'task-mail-find' && completed && task.mailSearch !== true) {
    return fields;
  }
  if (action === 'task-mail-repeat' && completed && task.mailSearch === true &&
      ((Array.isArray(task.mailResult?.groups) && task.mailResult.groups.some(group => group?.code)) || (task.quoteHandoff === true && task.quoteCanResume === true))) {
    if (task.quoteHandoff === true) {
      return { ...fields, previousId: null, quoteHandoff: true, quoteResumeOf: task.id };
    }
    return { ...fields, previousId: task.id, mailRetry: true };
  }
  return null;
}

export function createMailCardDispatcher({ api, makeId, reread, changed } = {}) {
  let generation = 0;
  const latestFlightByTask = new Map();
  const inFlightByTask = new Map();
  const uncertainByTask = new Map();
  const noteByTask = Object.create(null);

  function resolveProgressNote(action) {
    if (action === 'task-mail-general') {
      return '일반 업무로 맡기는 중입니다.';
    }
    if (action === 'task-mail-find') {
      return '메일에서 찾는 중입니다.';
    }
    if (action === 'task-mail-repeat') {
      return '메일에서 다시 찾는 중입니다.';
    }
    return '업무 요청을 처리하는 중입니다.';
  }

  function resolveFailureNote(code, uncertain) {
    if (typeof mailCodeText === 'function' && (code !== undefined || !uncertain)) {
      const text = mailCodeText(code);
      if (typeof text === 'string' && text.trim()) {
        return text.trim();
      }
    }
    return uncertain
      ? '요청 응답을 확인하지 못했습니다. 잠시 후 다시 확인해 주세요.'
      : '업무 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
  }

  function resolveRetainedNote(action) {
    if (action === 'task-mail-general') {
      return "이전 요청 응답을 확인하지 못했습니다. '일반 업무로 맡기기' 단추를 다시 눌러 먼저 확인해 주세요.";
    }
    if (action === 'task-mail-find') {
      return "이전 요청 응답을 확인하지 못했습니다. '메일에서 찾기' 단추를 다시 눌러 먼저 확인해 주세요.";
    }
    if (action === 'task-mail-repeat') {
      return "이전 요청 응답을 확인하지 못했습니다. '다시 찾기' 단추를 다시 눌러 먼저 확인해 주세요.";
    }
    return '이전 요청 응답을 확인하지 못했습니다. 같은 단추를 다시 눌러 먼저 확인해 주세요.';
  }

  async function send(action, task, fields) {
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return;
    const taskId = task?.id;
    if (taskId === undefined || taskId === null || taskId === '') return;
    if (typeof action !== 'string' || !action) return;

    if (inFlightByTask.has(taskId)) return;
    const retained = uncertainByTask.get(taskId);
    if (retained && retained.action !== action) {
      noteByTask[taskId] = resolveRetainedNote(retained.action);
      changed?.();
      return;
    }

    const myGeneration = generation;
    let canBeUncertain = Boolean(retained);
    const flight = {
      id: retained ? retained.id : null,
      action,
      taskId,
      seenInTasks: false,
    };
    latestFlightByTask.set(taskId, flight);
    inFlightByTask.set(taskId, flight);
    const isCurrent = () =>
      myGeneration === generation && latestFlightByTask.get(taskId) === flight;

    try {
      const id =
        flight.id ??
        (typeof makeId === 'function' ? makeId() : globalThis.crypto?.randomUUID?.());
      if (typeof id !== 'string' || !id) {
        if (isCurrent()) {
          noteByTask[taskId] = resolveFailureNote(undefined, false);
        }
        return;
      }
      flight.id = id;
      noteByTask[taskId] = resolveProgressNote(action);
      changed?.();
      if (!isCurrent()) return;

      const payload = { ...fields, id };
      canBeUncertain = true;
      const res = await api.submitTask(payload);
      if (!isCurrent()) return;

      const definiteTrue =
        res !== null &&
        typeof res === 'object' &&
        res.ok === true &&
        typeof res.id === 'string' &&
        res.id === id;
      const definiteFalse =
        res !== null &&
        typeof res === 'object' &&
        res.ok === false;

      if (definiteTrue) {
        uncertainByTask.delete(taskId);
        delete noteByTask[taskId];
        try {
          await reread?.();
        } catch {
          if (isCurrent()) {
            noteByTask[taskId] = '현재 업무 목록을 다시 읽지 못했습니다.';
          }
        }
        return;
      }

      if (definiteFalse) {
        uncertainByTask.delete(taskId);
        if (flight.seenInTasks) {
          delete noteByTask[taskId];
        } else {
          noteByTask[taskId] = resolveFailureNote(res.code, false);
        }
        return;
      }

      if (flight.seenInTasks) {
        uncertainByTask.delete(taskId);
        delete noteByTask[taskId];
      } else {
        uncertainByTask.set(taskId, { id, action, taskId });
        noteByTask[taskId] = resolveFailureNote(res?.code, true);
      }
    } catch (err) {
      if (!isCurrent()) return;
      if (canBeUncertain && typeof flight.id === 'string' && flight.id) {
        if (flight.seenInTasks) {
          uncertainByTask.delete(taskId);
          delete noteByTask[taskId];
        } else {
          uncertainByTask.set(taskId, { id: flight.id, action, taskId });
          noteByTask[taskId] = resolveFailureNote(err?.code, true);
        }
      } else {
        noteByTask[taskId] = resolveFailureNote(err?.code, false);
      }
    } finally {
      if (isCurrent()) {
        if (inFlightByTask.get(taskId) === flight) {
          inFlightByTask.delete(taskId);
        }
        changed?.();
      }
    }
  }

  function sync(tasks) {
    const list = Array.isArray(tasks)
      ? tasks
      : Array.isArray(tasks?.tasks)
        ? tasks.tasks
        : null;
    if (!list) return;

    const actualIds = new Set();
    for (const item of list) {
      const id = item?.id;
      if (id !== undefined && id !== null && id !== '') {
        actualIds.add(id);
      }
    }
    if (actualIds.size === 0) return;

    for (const [taskId, flight] of [...inFlightByTask.entries()]) {
      if (flight.id && actualIds.has(flight.id)) {
        flight.seenInTasks = true;
        inFlightByTask.delete(taskId);
        delete noteByTask[taskId];
      }
    }

    for (const [taskId, entry] of [...uncertainByTask.entries()]) {
      if (actualIds.has(entry.id)) {
        uncertainByTask.delete(taskId);
        delete noteByTask[taskId];
      }
    }
  }

  function notes() {
    return { ...noteByTask };
  }

  function reset() {
    generation += 1;
    latestFlightByTask.clear();
    inFlightByTask.clear();
    uncertainByTask.clear();
    for (const taskId of Object.keys(noteByTask)) {
      delete noteByTask[taskId];
    }
  }

  return {
    send,
    sync,
    notes,
    reset,
    blocksReview(id) { return inFlightByTask.has(id) || uncertainByTask.has(id); },
    inFlight(id) { return inFlightByTask.has(id); },
  };
}
