const PUSH_TIME_ZONE = 'Asia/Seoul';
const SIGNED_OUT_NOTICE = '이 기기의 알림 설정은 로그인 후 확인할 수 있어요. 이미 허용한 알림은 계속 받을 수 있어요. 바로 끄려면 브라우저의 사이트 설정에서 알림을 차단해 주세요.';
const busyPhases = new Set(['preparing', 'enabling', 'saving', 'disabling']);
const errors = {
  CARE_DATA_REQUIRED: '계정에 수첩을 먼저 저장해 주세요. 사람이나 일정을 추가하고 계정 저장이 끝나면 알림을 켤 수 있어요.',
  PUSH_DEVICE_LIMIT: '이미 10개 기기에 알림이 켜져 있어요. 사용하지 않는 기기에서 알림을 끈 뒤 다시 시도해 주세요.',
  PUSH_DAILY_LIMIT: '오늘 새 기기 알림을 등록한 횟수가 많아요. 한국 시간으로 내일 다시 시도해 주세요.',
  INVALID_SUBSCRIPTION: '이 브라우저의 알림 연결을 사용할 수 없어요. 최신 브라우저에서 다시 열거나 달력 저장을 이용해 주세요.',
  PUSH_LOCAL_CLEANUP: '이전 기기 알림을 해제하지 못했어요. 다시 확인을 누르거나 브라우저 사이트 설정에서 알림을 끈 뒤 확인해 주세요.',
  ACCOUNT_CHANGED: '계정이 바뀌었어요. 현재 계정에서 알림을 다시 확인해 주세요.',
};
const errorMessage = error => errors[error?.code] || (error?.name === 'NotAllowedError' ? '알림 권한을 받지 못했어요. 브라우저의 사이트 설정에서 허용한 뒤 다시 확인해 주세요.' : '알림 서버에 연결하지 못했어요. 잠시 뒤 다시 확인해 주세요.');

export function pushCapability(env = globalThis) {
  if (env.synkProduct?.authStatus) return { supported: false, phase: 'unsupported', message: '이 앱의 알림은 웹 브라우저에서 설정해 주세요. 알림 설정을 닫고 브라우저에서 열기를 눌러 주세요.' };
  const nav = env.navigator, standalone = nav?.standalone === true || env.matchMedia?.('(display-mode: standalone)')?.matches === true;
  const ios = /iPad|iPhone|iPod/.test(nav?.userAgent || '') || nav?.platform === 'MacIntel' && nav?.maxTouchPoints > 1;
  if (ios && !standalone) return { supported: false, phase: 'needs-install', message: 'iPhone·iPad에서는 Safari의 공유 메뉴 → 홈 화면에 추가를 누른 뒤, 홈 화면의 플레저에서 알림을 켜 주세요.' };
  if (!env.isSecureContext || !nav?.serviceWorker || !env.PushManager || !env.Notification) return { supported: false, phase: 'unsupported', message: '이 브라우저는 닫힌 앱 알림을 지원하지 않아요. 최신 브라우저에서 열거나 일정의 달력 저장을 이용해 주세요.' };
  return { supported: true };
}

export function decodePushKey(value, decode = globalThis.atob) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{87}=?$/.test(value)) throw new Error('알림 서버 설정을 확인하지 못했어요.');
  const raw = decode(value.replace(/-/g, '+').replace(/_/g, '/') + (value.length % 4 ? '='.repeat(4 - value.length % 4) : ''));
  const bytes = Uint8Array.from(raw, char => char.charCodeAt(0));
  if (bytes.length !== 65 || bytes[0] !== 4) throw new Error('알림 서버 설정을 확인하지 못했어요.');
  return bytes;
}

function timeParts(hour, minute) {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) throw new Error('알림 시간을 확인해 주세요.');
  return { hour, minute };
}

export function carePushAccountIdentity(status, starting = false) {
  if (['loading', 'restoring'].includes(status?.status) || starting && !status?.signedIn) return undefined;
  return status?.signedIn ? status.accountId || status.account?.synk_user_id || null : null;
}

export function careLogoutNotice(accountResult, pushResult) {
  const warnings = [];
  if (accountResult?.ok === false) warnings.push('이 기기의 로그인 정보 삭제를 확인하지 못했어요. 브라우저나 앱의 저장 정보를 확인해 주세요.');
  if (accountResult?.serverRevoked === false) warnings.push('서버의 세션 종료는 확인하지 못했어요.');
  if (pushResult?.ok === false) warnings.push('기기 알림 해제를 확인하지 못했으니 브라우저 사이트 설정에서 알림을 꺼 주세요.');
  return warnings.length ? `${accountResult?.ok === false ? '로그아웃을 완전히 확인하지 못했어요.' : '이 기기의 로그인은 종료했어요.'} ${warnings.join(' ')}` : '';
}

function bounded(promise, ms = 12000) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('알림 연결 시간이 초과됐어요.')), ms); })]).finally(() => clearTimeout(timer));
}

/** Per-device opt-in only. No permission request or new subscription during preparation. */
export function createCarePush({ request, onState = () => {}, env = globalThis, workerUrl = new URL('./care-sw.js', import.meta.url).href, scopeUrl = new URL('./', import.meta.url).href } = {}) {
  let owner, epoch = 0, registration = null, subscription = null, publicKey = null, mutation = null, preparation = null, cleanup = null, suspended = false, permissionAttempt = null, timeDraft = null;
  let state = { phase: 'signed-out', enabled: false, scheduleKnown: true, hour: 9, minute: 0, timeZone: PUSH_TIME_ZONE, message: SIGNED_OUT_NOTICE };
  const snapshot = () => ({ ...state, inputHour: timeDraft?.hour ?? state.hour, inputMinute: timeDraft?.minute ?? state.minute, canCancelEnable: !!permissionAttempt?.waiting && !permissionAttempt.cancelled && current(permissionAttempt.epoch), permissionPending: !!permissionAttempt, busy: busyPhases.has(state.phase), signedIn: !!owner && !suspended, suppressOpenReminders: state.enabled || !!subscription || !!permissionAttempt || busyPhases.has(state.phase) });
  const emit = patch => { state = { ...state, ...patch }; onState(snapshot()); return snapshot(); };
  const current = expected => expected === epoch && !!owner && !suspended;
  const guard = expected => { if (!current(expected)) throw Object.assign(new Error('계정이 바뀌었어요.'), { code: 'ACCOUNT_CHANGED' }); };
  const call = async (action, body, expected) => { guard(expected); const result = await request(action, body); guard(expected); if (result?.ok !== true) throw new Error('알림 서버 응답을 확인하지 못했어요.'); return result; };
  const closeNotifications = async reg => { try { for (const item of await bounded(reg?.getNotifications?.({ tag: 'synk-care-daily' })) || []) item.close(); } catch { /* Notification display cleanup is best effort and must not block unsubscribe or the next account. */ } };
  async function removeLocal(sub, reg = registration) {
    let removed = !sub;
    if (sub) { try { removed = await bounded(sub.unsubscribe()); } catch { removed = false; } }
    // unsubscribe() may return false when another tab already removed it. Verify
    // actual browser state before presenting a failed cleanup that cannot resolve.
    if (!removed && typeof reg?.pushManager?.getSubscription === 'function') {
      try { removed = (await bounded(reg.pushManager.getSubscription())) === null; } catch { /* Retain the reference for another real attempt. */ }
    }
    await closeNotifications(reg);
    if (removed && subscription === sub) subscription = null;
    return removed;
  }
  async function existing() {
    if (registration) return registration;
    if (!env.navigator?.serviceWorker?.getRegistration) return null;
    const reg = await bounded(env.navigator.serviceWorker.getRegistration(scopeUrl));
    return reg?.scope === scopeUrl ? reg : null;
  }
  async function getReadyRegistration(expected) {
    const reg = await bounded(env.navigator.serviceWorker.register(workerUrl, { scope: scopeUrl, updateViaCache: 'none' })); guard(expected);
    if (!reg.active) {
      await bounded(new Promise((resolve, reject) => {
        const worker = reg.installing || reg.waiting;
        if (!worker) { reject(new Error('알림 준비를 마치지 못했어요.')); return; }
        const change = () => { if (worker.state === 'activated') { worker.removeEventListener('statechange', change); resolve(); } else if (worker.state === 'redundant') { worker.removeEventListener('statechange', change); reject(new Error('알림 준비를 마치지 못했어요.')); } };
        worker.addEventListener('statechange', change); change();
      }));
    }
    guard(expected); return reg;
  }
  function applyStatus(result, enabled = result.enabled === true, acceptTime = false) {
    const time = timeParts(result.hour ?? 9, result.minute ?? 0);
    if (result.timeZone && result.timeZone !== PUSH_TIME_ZONE) throw new Error('알림 시간대를 확인하지 못했어요.');
    if (acceptTime) timeDraft = null;
    return emit({ ...time, enabled, scheduleKnown: true, phase: enabled ? 'enabled' : 'ready', message: enabled ? '챙길 일이 있는 날, 정한 시간에 하루 한 번 알려드려요.' : '알림을 켜면 앱을 닫아도 챙길 날을 알려드려요.' });
  }
  function prepare() {
    if (!owner || suspended) return Promise.resolve(snapshot());
    if (cleanup) return cleanup.then(() => prepare(), () => prepare());
    // A native permission prompt cannot be dismissed by the page. Keep its lock,
    // but never queue another UI preparation behind an unanswered prompt.
    if (permissionAttempt) return Promise.resolve(snapshot());
    if (mutation) return mutation.then(() => prepare(), () => prepare());
    if (preparation) return preparation;
    const expected = epoch, capability = pushCapability(env);
    if (!capability.supported) return Promise.resolve(emit({ phase: capability.phase, enabled: false, message: capability.message }));
    emit({ phase: 'preparing', message: '이 기기의 알림 연결을 확인하고 있어요.' });
    const pending = (async () => {
      try {
        registration = await getReadyRegistration(expected); guard(expected);
        const candidate = await bounded(registration.pushManager.getSubscription()); guard(expected);
        subscription = candidate;
        const result = await call('status', candidate ? { endpoint: candidate.endpoint } : {}, expected);
        publicKey = decodePushKey(result.publicKey, env.atob || globalThis.atob);
        if (env.Notification.permission === 'denied') {
          emit({ phase: 'denied', enabled: false, message: '브라우저에서 알림이 차단돼 있어요. 사이트 알림을 허용한 뒤 다시 확인해 주세요.' }); return snapshot();
        }
        if (candidate && !result.enabled) { const removed = await removeLocal(candidate); guard(expected); if (!removed) { publicKey = null; throw Object.assign(new Error('기기 알림 해제 실패'), { code: 'PUSH_LOCAL_CLEANUP' }); } }
        return applyStatus(result, !!candidate && result.enabled === true && env.Notification.permission === 'granted');
      } catch (error) { if (current(expected)) emit({ phase: 'unavailable', scheduleKnown: false, message: errorMessage(error) }); return snapshot(); }
      finally { if (preparation === pending) preparation = null; }
    })();
    preparation = pending; return pending;
  }
  async function setAccount(accountId) {
    const next = typeof accountId === 'string' && accountId ? accountId : null;
    if (next === owner && !suspended) return snapshot();
    cancelEnable();
    const previous = owner, expected = ++epoch, running = mutation, clearing = cleanup;
    owner = next; suspended = false; preparation = null; publicKey = null;
    timeDraft = null;
    emit({ phase: next ? permissionAttempt ? 'permission-pending' : 'preparing' : 'signed-out', enabled: false, scheduleKnown: true, hour: 9, minute: 0, message: next ? permissionAttempt ? '이전 알림 연결을 정리하고 있어요. 브라우저에 남아 있는 알림 허용 창을 닫아 주세요. 수첩은 계속 이용할 수 있어요.' : '이 기기의 알림 연결을 확인하고 있어요.' : SIGNED_OUT_NOTICE });
    // A subscribe prompt can finish after a sign-out. That mutation removes its own
    // subscription; wait before preparing a new account so it cannot remove theirs.
    if (running) { try { await running; } catch { /* The stale mutation cleans up below. */ } }
    if (clearing) { try { await clearing; } catch { /* Keep the current account's preparation separate. */ } }
    if (expected !== epoch) return snapshot();
    // A fresh tab has no sessionStorage login, but its browser-level subscription
    // may belong to another live tab. Only a known owner transition may remove it.
    if (previous) {
      let reg, old = subscription;
      try { reg = await existing(); if (expected !== epoch) return snapshot(); old ||= await bounded(reg?.pushManager?.getSubscription()); }
      catch { return expected !== epoch ? snapshot() : emit({ phase: 'unavailable', enabled: false, message: '이전 계정의 기기 알림을 확인하지 못했어요. 사이트 설정에서 알림을 끈 뒤 다시 확인해 주세요.' }); }
      if (expected !== epoch) return snapshot();
      const removed = await removeLocal(old, reg);
      if (expected !== epoch) return snapshot();
      if (!removed) return emit({ phase: 'unavailable', enabled: false, message: '이전 계정의 기기 알림을 해제하지 못했어요. 브라우저 사이트 설정에서 알림을 끈 뒤 다시 확인해 주세요.' });
    }
    return next ? prepare() : snapshot();
  }
  function cancelEnable(timedOut = false) {
    const attempt = permissionAttempt;
    if (!attempt?.waiting || attempt.cancelled || !current(attempt.epoch)) return snapshot();
    attempt.cancelled = true; clearTimeout(attempt.timer);
    return emit({ phase: 'permission-pending', enabled: false, message: `${timedOut ? '알림 허용 응답이 없어 연결을 멈췄어요.' : '앱의 알림 연결을 취소했어요.'} 브라우저의 허용 창은 직접 닫아 주세요. 창을 닫으면 다시 연결할 수 있고, 수첩은 계속 이용할 수 있어요.` });
  }
  function enable(hour = state.hour, minute = state.minute) {
    const time = timeParts(hour, minute), expected = epoch;
    guard(expected);
    if (mutation || !registration || !publicKey || !['ready', 'error'].includes(state.phase)) return Promise.resolve(snapshot());
    if (env.Notification.permission === 'denied') return Promise.resolve(emit({ phase: 'denied', enabled: false, message: '브라우저 사이트 설정에서 알림을 허용한 뒤 다시 확인해 주세요.' }));
    timeDraft = time;
    const attempt = { epoch: expected, waiting: true, cancelled: false, timer: null };
    permissionAttempt = attempt;
    emit({ phase: 'enabling', enabled: false, message: '브라우저의 알림 허용 창을 확인해 주세요. 지금 연결하지 않으려면 아래에서 취소할 수 있어요.' });
    let prompt;
    try {
      // Keep this call in the original click task. Awaiting a request first loses
      // Safari's transient user activation and can silently prevent the prompt.
      prompt = registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: publicKey });
    } catch (error) { permissionAttempt = null; return Promise.resolve(emit({ phase: 'error', message: errorMessage(error) })); }
    attempt.timer = setTimeout(() => { if (permissionAttempt === attempt) cancelEnable(true); }, 30000);
    let candidate = null;
    const pending = (async () => {
      try {
        candidate = await prompt;
        attempt.waiting = false; clearTimeout(attempt.timer);
        guard(expected);
        if (attempt.cancelled) throw Object.assign(new Error('알림 연결 취소'), { code: 'PUSH_CANCELLED' });
        subscription = candidate;
        emit({ message: '허용을 확인했어요. 선택한 시간으로 알림을 연결하고 있어요.' });
        const result = await call('subscribe', { subscription: { endpoint: candidate.endpoint, keys: candidate.toJSON().keys }, ...time }, expected);
        if (result.enabled !== true) throw new Error('알림 등록을 확인하지 못했어요.');
        return applyStatus(result, true, true);
      } catch (error) {
        attempt.waiting = false; clearTimeout(attempt.timer);
        // Includes a lost successful HTTP response: an unsubscribed endpoint can no
        // longer display an unintended notification even if the server accepted it.
        const removed = await removeLocal(candidate);
        if (!removed) publicKey = null;
        if (current(expected)) emit({ phase: !removed ? 'unavailable' : env.Notification.permission === 'denied' ? 'denied' : attempt.cancelled ? 'ready' : 'error', enabled: false, message: !removed ? '기기 알림 해제를 확인하지 못했어요. 알림 연결 다시 확인을 누르거나 사이트 설정에서 알림을 끈 뒤 확인해 주세요.' : attempt.cancelled ? env.Notification.permission === 'denied' ? '알림 연결을 취소했어요. 다시 켜려면 브라우저 사이트 설정에서 알림을 허용해 주세요.' : '알림 연결을 취소했어요. 선택한 시간은 유지했으니 원할 때 다시 켤 수 있어요.' : errorMessage(error) });
        return snapshot();
      } finally {
        clearTimeout(attempt.timer);
        if (permissionAttempt === attempt) permissionAttempt = null;
        if (mutation === pending) mutation = null;
        if (current(expected)) emit({});
      }
    })();
    mutation = pending; return pending;
  }
  function update(hour, minute) {
    const time = timeParts(hour, minute), expected = epoch; guard(expected);
    if (mutation || !state.enabled || !subscription) return Promise.resolve(snapshot());
    timeDraft = time;
    emit({ phase: 'saving', message: '알림 시간을 저장하고 있어요.' });
    const pending = (async () => {
      try { const result = await call('update', { endpoint: subscription.endpoint, ...time }, expected); return applyStatus(result, result.enabled === true, true); }
      catch (error) { if (current(expected)) emit({ phase: 'unavailable', scheduleKnown: false, message: '알림 시간의 저장 결과를 확인하지 못했어요. 알림 연결 다시 확인을 눌러 실제 저장된 시간을 확인해 주세요.' }); return snapshot(); }
      finally { if (mutation === pending) mutation = null; }
    })();
    mutation = pending; return pending;
  }
  function disable() {
    const expected = epoch; guard(expected);
    if (mutation || !subscription) return Promise.resolve(snapshot());
    const candidate = subscription; emit({ phase: 'disabling', message: '이 기기의 알림을 끄고 있어요.' });
    const pending = (async () => {
      let serverRemoved = false;
      try { await call('unsubscribe', { endpoint: candidate.endpoint }, expected); serverRemoved = true; } catch { /* Browser cancellation still stops delivery when offline. */ }
      const removed = await removeLocal(candidate);
      if (current(expected)) emit({ enabled: !(serverRemoved || removed), phase: serverRemoved || removed ? 'ready' : 'enabled', message: serverRemoved || removed ? '이 기기의 알림을 껐어요. 다른 기기의 알림은 그대로예요.' : '알림을 끄지 못했어요. 다시 시도하거나 브라우저 사이트 설정에서 알림을 꺼 주세요.' });
      return snapshot();
    })().finally(() => { if (mutation === pending) mutation = null; });
    mutation = pending; return pending;
  }
  function logout({ localOnly = false } = {}) {
    if (cleanup) return cleanup;
    // Do not wait for an unanswered permission prompt to sign out. Its completion
    // checks the epoch before writing and unsubscribes any late subscription.
    cancelEnable();
    ++epoch; suspended = true; publicKey = null; preparation = null;
    emit({ phase: 'disabling', enabled: false, message: '이 기기의 계정 알림을 해제하고 있어요.' });
    const captured = subscription;
    const pending = (async () => {
      let reg, candidate = captured;
      try { reg = await existing(); candidate ||= await bounded(reg?.pushManager?.getSubscription()); }
      catch { return { ok: false, serverRemoved: false, deviceRemoved: false }; }
      let serverRemoved = !candidate;
      if (candidate && !localOnly) { try { serverRemoved = (await request('unsubscribe', { endpoint: candidate.endpoint }))?.ok === true; } catch { /* Provider cancellation still stops device delivery. */ } }
      const removed = await removeLocal(candidate, reg);
      return { ok: serverRemoved || removed, serverRemoved, deviceRemoved: removed };
    })().finally(() => { if (cleanup === pending) cleanup = null; });
    cleanup = pending; return pending;
  }
  return { snapshot, setAccount, prepare, enable, cancelEnable, update, disable, logout };
}
