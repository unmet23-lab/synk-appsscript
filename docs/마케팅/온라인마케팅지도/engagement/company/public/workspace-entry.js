'use strict';

// A handoff lives in the existing join form's memory. It is never a login or
// invitation acceptance, and must not replace another window's unfinished work.
let workspaceEntryReceiver = null;
let workspaceEntryPending = null;
let workspaceEntryPreparing = false;
let workspaceEntryLifecycle = 0;
let workspaceEntrySuspended = false;
let workspaceEntryRestoreAuth = false;

function workspaceEntryError(code) {
  const messages = {
    BUSY: '하던 작업을 저장하거나 닫은 뒤 초대 코드를 다시 연결해 주세요.',
    ACCOUNT_MISMATCH: '플랫폼과 이 창의 로그인 계정이 달라요. 기존 로그인은 그대로 두었어요.',
    ACCOUNT_CHANGED: '확인하는 동안 로그인 상태가 바뀌었어요. 초대 코드를 다시 연결해 주세요.',
    CANCELLED: '초대 연결을 취소했어요.',
    HANDOFF_TIMEOUT: '연결 시간이 지났어요. 플랫폼에서 초대 코드를 다시 연결해 주세요.',
    HANDOFF_UNAVAILABLE: '이 창에서 초대를 이어갈 수 없어요. 플랫폼에서 다시 열어 주세요.',
    INVALID_INPUT: '받은 초대 코드를 다시 확인해 주세요.',
    TEMPORARY_UNAVAILABLE: '초대 연결을 확인하지 못했어요. 잠시 뒤 다시 시도해 주세요.'
  };
  return Object.assign(new Error(messages[code] || messages.TEMPORARY_UNAVAILABLE), {code});
}

function workspaceEntryHasUnfinishedWork() {
  if (document.body.classList.contains('modal-open')) return true;
  // Child editors own their draft state. Their beforeunload handlers do not
  // run on a parent's synthetic event, so never tear down an existing frame.
  if (document.querySelectorAll('iframe').length) return true;
  // Existing workspace editors own their beforeunload guards. Consult those
  // guards without navigating, clearing a draft, or opening a native dialog.
  const leave = new Event('beforeunload', {cancelable: true});
  window.dispatchEvent(leave);
  if (leave.defaultPrevented) return true;
  return [...document.querySelectorAll('form')].some(form => [...form.elements].some(field => {
    if (field.type === 'file') return field.files?.length > 0;
    if (['checkbox', 'radio'].includes(field.type)) return field.checked !== field.defaultChecked;
    if (field.tagName === 'SELECT') {
      // Let the browser restore implicit defaults on a detached copy only.
      const initial = field.cloneNode(true), form = document.createElement('form');
      initial.removeAttribute('form');
      form.appendChild(initial);
      HTMLFormElement.prototype.reset.call(form);
      return [...field.options].some((option, index) => option.selected !== initial.options[index].selected);
    }
    return typeof field.defaultValue === 'string' && field.value !== field.defaultValue;
  }));
}

function workspaceEntryStillCurrent(request, stamp) {
  if (request.signal?.aborted || !request.isCurrent()) throw workspaceEntryError('CANCELLED');
  if (!companyAuthCurrent(stamp)) throw workspaceEntryError('ACCOUNT_CHANGED');
}

async function queueWorkspaceEntryInvite(request) {
  if (isDemoMode() || !request || typeof request.token !== 'string' || !request.token || request.token.length > 200) {
    throw workspaceEntryError('INVALID_INPUT');
  }
  if (workspaceEntryPending || workspaceEntryHasUnfinishedWork()) throw workspaceEntryError('BUSY');
  const stamp = companyAuthSnapshot();
  workspaceEntryStillCurrent(request, stamp);
  // Do not use api() here: its native recovery can start an account exchange.
  // This handoff only reads the existing company session.
  const response = await fetch('/api/me', {credentials: 'same-origin', cache: 'no-store', signal: request.signal});
  if (!response.ok) throw workspaceEntryError('TEMPORARY_UNAVAILABLE');
  const me = await response.json();
  workspaceEntryStillCurrent(request, stamp);
  if (!me || typeof me !== 'object' || Array.isArray(me) || !('user' in me) || (me.user !== null && (typeof me.user !== 'object' || Array.isArray(me.user) || typeof me.user.id !== 'string' || !me.user.id))) {
    throw workspaceEntryError('TEMPORARY_UNAVAILABLE');
  }
  if (stamp.userId && me.user?.id !== stamp.userId) throw workspaceEntryError('ACCOUNT_CHANGED');
  if (request.expectedAccountId && me.user && me.synkUserId !== request.expectedAccountId) {
    throw workspaceEntryError('ACCOUNT_MISMATCH');
  }
  if (workspaceEntryHasUnfinishedWork()) throw workspaceEntryError('BUSY');
  // Invalidate older view requests before displaying the join form, while
  // retaining the actual company login and all server-side session data.
  companyAuthGeneration++;
  clearInterval(pollTimer);
  clearInterval(hypePollTimer);
  state.modalRequest++;
  state.csrf = me.csrfToken || '';
  state.user = me.user || null;
  state.synkUserId = me.synkUserId || null;
  state.platformUrl = me.platformUrl || null;
  state.passwordSet = me.passwordSet === true;
  state.authMode = 'join';
  state.authToken = request.token;
  workspaceEntryPending = {
    requestId: request.requestId,
    accountGeneration: request.accountGeneration,
    token: request.token
  };
  // prepareWorkspaceEntryHandoff owns initial rendering. A reused document
  // already has an initialized app, so it can render immediately.
  if (!workspaceEntryPreparing) renderAuth();
  return {queued: true};
}

function cancelWorkspaceEntryInvite(request = {}) {
  const pending = workspaceEntryPending;
  if (!pending || request.requestId && (request.requestId !== pending.requestId || request.accountGeneration !== pending.accountGeneration)) return;
  if (pending.consuming && !['ACCOUNT_CHANGED', 'PAGE_HIDDEN'].includes(request.reason)) {
    pending.cancelRequested = true;
    return;
  }
  workspaceEntryPending = null;
  if (state.authMode === 'join' && state.authToken === pending.token) {
    state.authToken = '';
    state.authMode = 'login';
    if (!workspaceEntryPreparing && request.reason !== 'PAGE_HIDDEN') renderAuth();
  }
  pending.token = '';
}

function workspaceEntryIdentityChanged() {
  if (!workspaceEntryPending) return;
  cancelWorkspaceEntryInvite({reason: 'ACCOUNT_CHANGED'});
  workspaceEntryReceiver?.cancel('ACCOUNT_CHANGED');
}

function beginWorkspaceEntryAcceptance() {
  if (!workspaceEntryPending || state.authMode !== 'join' || state.authToken !== workspaceEntryPending.token) return false;
  workspaceEntryPending.consuming = true;
  return true;
}

function failWorkspaceEntryAcceptance() {
  if (!workspaceEntryPending) return;
  workspaceEntryPending.consuming = false;
  if (workspaceEntryPending.cancelRequested) cancelWorkspaceEntryInvite();
}

function releaseWorkspaceEntryInvite() {
  const pending = workspaceEntryPending;
  workspaceEntryPending = null;
  if (pending) pending.token = '';
  workspaceEntryReceiver?.cancel('CANCELLED');
}

async function prepareWorkspaceEntryHandoff({waitForHandoff = true} = {}) {
  if (isDemoMode() || location.pathname !== '/' || location.search || location.hash) return false;
  if (workspaceEntryReceiver) return Boolean(workspaceEntryPending);
  const lifecycle = workspaceEntryLifecycle;
  workspaceEntryPreparing = true;
  try {
    const {createCompanyEntryReceiver} = await import('/pulse-app/entry-handoff.mjs');
    if (lifecycle !== workspaceEntryLifecycle || workspaceEntrySuspended) return false;
    workspaceEntryReceiver = createCompanyEntryReceiver({
      window,
      role: 'employee',
      queueInvite: queueWorkspaceEntryInvite,
      cancelInvite: cancelWorkspaceEntryInvite,
      isInvitePending: request => Boolean(workspaceEntryPending && workspaceEntryPending.requestId === request.requestId && workspaceEntryPending.accountGeneration === request.accountGeneration),
      onState: event => {
        if (event.status === 'error' && !workspaceEntryPreparing) notify(workspaceEntryError(event.code).message);
      }
    });
    // This marker is only a scheduling hint from the dedicated native
    // preload. The receiver still validates every origin/source/document.
    if (waitForHandoff && (window.opener || window.synkCompanyEntryHost?.version === 1)) {
      await workspaceEntryReceiver.waitForFirstHandoff(15000);
    }
    if (lifecycle !== workspaceEntryLifecycle) return false;
    return Boolean(workspaceEntryPending);
  } catch {
    return Boolean(workspaceEntryPending);
  } finally {
    if (lifecycle === workspaceEntryLifecycle) workspaceEntryPreparing = false;
  }
}

window.addEventListener('pagehide', event => {
  workspaceEntryLifecycle++;
  workspaceEntrySuspended = event.persisted === true;
  workspaceEntryRestoreAuth = workspaceEntrySuspended && Boolean(workspaceEntryPending && state.authMode === 'join' && state.authToken === workspaceEntryPending.token);
  workspaceEntryPreparing = false;
  workspaceEntryReceiver?.dispose();
  workspaceEntryReceiver = null;
  cancelWorkspaceEntryInvite({reason: 'PAGE_HIDDEN'});
});

window.addEventListener('pageshow', event => {
  if (!event.persisted || !workspaceEntrySuspended) return;
  workspaceEntrySuspended = false;
  // pagehide clears the queued secret even during a submitted join. Restore
  // that auth view only; unrelated forms and the existing login stay intact.
  if (workspaceEntryRestoreAuth && !workspaceEntryPending && state.authMode === 'login') renderAuth();
  workspaceEntryRestoreAuth = false;
  void prepareWorkspaceEntryHandoff({waitForHandoff: false});
});
