// 공통 첫 화면의 상태 전이와 계정 결속 검증, 초대 입력 형식 검증을 담당하는 순수 상태 모듈이다.
// 화면 이동이나 외부 인증 함수를 직접 부르지 않고 다음 전이 결과만 계산한다.

import { SOLIO } from './solio.mjs';

export const INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,200}$/;
export const INVITE_ALLOWED_ORIGIN = 'https://workspace.synk.im';
export const INVITE_ALLOWED_PATHS = Object.freeze(['/', '/pulse-app/']);
export const PORTAL_SHIFT_URL = 'https://synk.im/shift/';

export const PORTAL_PHASES = Object.freeze([
  'welcome',
  'zooming',
  'checking',
  'auth',
  'signing-in',
  'invite',
  'entering',
  'workspace',
  'enter-error',
  'error',
  'purpose',
  'entered',
]);

export const PORTAL_AUTH_STATUSES = Object.freeze([
  'restoring',
  'loading',
  'signed-in',
  'signed-out',
  'signing-in',
  'error',
  'unconfigured',
]);

export const PORTAL_PURPOSE_ORIGINS = Object.freeze([
  'entering',
  'browse',
  'manual',
]);

export const PORTAL_PURPOSE_MODES = Object.freeze([
  'onboarding',
  'existing',
]);

export const PORTAL_PURPOSE_ITEMS = Object.freeze([
  Object.freeze({
    id: 'shift',
    index: '01',
    name: 'SHIFT',
    description: 'AI 강의',
    external: true,
  }),
  Object.freeze({
    id: 'solio',
    index: '02',
    name: SOLIO.menu,
    description: SOLIO.tagline,
    external: false,
  }),
  Object.freeze({
    id: 'world',
    index: '03',
    name: 'WORLD',
    description: '한국어 학습과 게임, TOPIK 연습',
    external: true,
  }),
  Object.freeze({
    id: 'path',
    index: '04',
    name: 'PATH',
    description: '실전 면접 연습',
    external: false,
  }),
]);

export const PORTAL_ALLOWED_PURPOSES = Object.freeze(['shift', 'solio', 'world', 'path', 'home']);

export const PORTAL_WORKSPACE_STATUSES = Object.freeze([
  'resolved',
  'partial',
  'login_required',
  'account_mismatch',
  'unavailable',
  'popup_blocked',
]);

export const PORTAL_WORKSPACE_ITEMS = Object.freeze([
  Object.freeze({
    id: 'workspace',
    destination: '/',
    index: '01',
    name: 'Workspace',
    description: '우리 회사 구성원이 함께 일하는 업무 공간',
    external: true,
  }),
  Object.freeze({
    id: 'pulse',
    destination: '/pulse-app/',
    index: '02',
    name: 'PULSE',
    description: '고객사와 프로젝트를 함께 진행하는 공간',
    external: true,
  }),
]);

export function normalizePortalWorkspaceDestination(value) {
  if (value === '/' || value === 'workspace') return '/';
  if (value === '/pulse-app/' || value === 'pulse') return '/pulse-app/';
  return null;
}

export function normalizePortalWorkspaceState(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const status = PORTAL_WORKSPACE_STATUSES.includes(source.status)
    ? source.status
    : 'unavailable';

  const destinations = [];
  if (Array.isArray(source.destinations)) {
    for (const item of source.destinations) {
      const normalized = normalizePortalWorkspaceDestination(item);
      if (normalized && !destinations.includes(normalized)) {
        destinations.push(normalized);
      }
    }
  }

  const unavailable = [];
  if (Array.isArray(source.unavailable)) {
    for (const target of source.unavailable) {
      if ((target === 'workspace' || target === 'pulse') && !unavailable.includes(target)) {
        unavailable.push(target);
      }
    }
  }

  const message = typeof source.message === 'string' ? source.message.trim() : '';
  const canContinuePersonal = source.canContinuePersonal !== false;
  const canSwitchAccount = typeof source.canSwitchAccount === 'boolean'
    ? source.canSwitchAccount
    : (status === 'account_mismatch' || status === 'login_required');

  return {
    status,
    destinations,
    unavailable,
    message,
    canContinuePersonal,
    canSwitchAccount,
  };
}

export function normalizeAuthStatus(status) {
  if (PORTAL_AUTH_STATUSES.includes(status)) return status;
  return 'error';
}

export function isAuthPendingStatus(status) {
  return status === 'restoring' || status === 'loading';
}

export function isPortalActivePhase(phase) {
  return phase !== 'entered';
}

const CONTROL_OR_SPACE = /[\u0000-\u0020\u007F]/;
const URL_LIKE_PREFIX = /^(?:[a-zA-Z][a-zA-Z0-9+.-]*:|\/\/)/;

// 초대 입력을 검증한다. 맨 코드는 종류를 추측하거나 묻지 않고 검증된 코드 그대로 반환한다.
// 오류 반환에는 입력 원문을 절대 포함하지 않는다.
export function validatePortalInviteInput(raw) {
  if (typeof raw !== 'string') {
    return { ok: false, code: 'EMPTY_INVITE', message: '전달받은 초대코드나 초대 링크를 입력해 주세요.' };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, code: 'EMPTY_INVITE', message: '전달받은 초대코드나 초대 링크를 입력해 주세요.' };
  }
  if (CONTROL_OR_SPACE.test(trimmed)) {
    return { ok: false, code: 'INVALID_INVITE_FORMAT', message: '공백이나 줄바꿈 없이 초대코드나 초대 링크를 입력해 주세요.' };
  }

  const looksLikeUrl = URL_LIKE_PREFIX.test(trimmed) || trimmed.includes('/') || trimmed.includes('#');
  if (looksLikeUrl) {
    let parsed;
    try {
      parsed = new URL(trimmed);
    } catch {
      return { ok: false, code: 'INVALID_INVITE_LINK', message: '초대 링크 주소를 다시 확인해 주세요.' };
    }
    if (
      parsed.protocol !== 'https:'
      || parsed.port !== ''
      || parsed.username !== ''
      || parsed.password !== ''
      || parsed.origin !== INVITE_ALLOWED_ORIGIN
      || parsed.search !== ''
      || !INVITE_ALLOWED_PATHS.includes(parsed.pathname)
    ) {
      return { ok: false, code: 'INVALID_INVITE_LINK', message: '허용된 SYNK 초대 링크만 사용할 수 있어요.' };
    }

    const fragment = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : '';
    if (!fragment) {
      return { ok: false, code: 'INVALID_INVITE_LINK', message: '초대 링크에 코드 정보가 없어요.' };
    }
    const params = new URLSearchParams(fragment);
    const keys = [...params.keys()];
    const invites = params.getAll('invite');
    if (keys.length !== 1 || keys[0] !== 'invite' || invites.length !== 1) {
      return { ok: false, code: 'INVALID_INVITE_LINK', message: '초대 링크 형식이 올바르지 않아요.' };
    }
    const token = invites[0];
    if (!INVITE_TOKEN_PATTERN.test(token)) {
      return { ok: false, code: 'INVALID_INVITE_LINK', message: '초대 링크 안의 코드 형식을 확인해 주세요.' };
    }
    const normalizedHref = `${INVITE_ALLOWED_ORIGIN}${parsed.pathname}#invite=${token}`;
    return {
      ok: true,
      kind: 'link',
      value: normalizedHref,
      pathname: parsed.pathname,
    };
  }

  if (!INVITE_TOKEN_PATTERN.test(trimmed)) {
    return { ok: false, code: 'INVALID_INVITE_CODE', message: '초대코드 형식을 확인해 주세요.' };
  }
  return {
    ok: true,
    kind: 'code',
    value: trimmed,
    pathname: null,
  };
}

function normalizeGeneration(value) {
  return Number.isFinite(value) ? value : null;
}

function normalizeAccountKey(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizePurposeMode(value) {
  return value === 'existing' ? 'existing' : 'onboarding';
}

export function createPortalStateMachine(initial = {}) {
  let phase = initial.bypass === true ? 'entered' : 'welcome';
  let returnPhase = 'auth';
  let authStatus = normalizeAuthStatus(initial.status ?? 'restoring');
  let generation = normalizeGeneration(initial.generation);
  let accountKey = (authStatus === 'signed-out' || authStatus === 'unconfigured')
    ? null
    : normalizeAccountKey(initial.accountKey);
  let purposeOrigin = null;
  let purposeMode = null;
  let purposeAccountKey = null;
  let purposeGeneration = null;
  let workspaceState = null;
  let workspaceAccountKey = null;
  let workspaceGeneration = null;
  let welcomePausedAccountKey = null;
  let zoomConsumed = initial.bypass === true;
  let enteredOnce = initial.bypass === true;
  let errorMessage = typeof initial.errorMessage === 'string' ? initial.errorMessage : '';
  let retryable = initial.retryable === true;

  function clearPurposeBinding() {
    purposeOrigin = null;
    purposeMode = null;
    purposeAccountKey = null;
    purposeGeneration = null;
  }

  function clearWorkspaceBinding() {
    workspaceState = null;
    workspaceAccountKey = null;
    workspaceGeneration = null;
  }

  function snapshot() {
    return {
      phase,
      active: isPortalActivePhase(phase),
      blockShortcuts: isPortalActivePhase(phase),
      authStatus,
      generation,
      accountKey,
      purposeOrigin,
      purposeMode,
      purposeReturnPhase: phase === 'purpose' ? returnPhase : null,
      purposeAccountKey,
      workspaceAccountKey,
      workspace: workspaceState
        ? {
            ...workspaceState,
            destinations: [...workspaceState.destinations],
            unavailable: [...workspaceState.unavailable],
          }
        : null,
      zoomConsumed,
      enteredOnce,
      errorMessage,
      retryable,
    };
  }

  function defaultErrorText(status) {
    if (status === 'unconfigured') return '로그인 설정을 찾지 못했어요.';
    return '계정 연결 상태를 확인하지 못했어요. 잠시 뒤 다시 확인해 주세요.';
  }

  function resolveInteriorPhase() {
    if (authStatus === 'signed-in') {
      phase = 'entering';
      return { shouldStartZoom: false, shouldTriggerEnter: true };
    }
    if (isAuthPendingStatus(authStatus)) {
      phase = 'checking';
      return { shouldStartZoom: false, shouldTriggerEnter: false };
    }
    if (authStatus === 'signing-in') {
      phase = 'signing-in';
      return { shouldStartZoom: false, shouldTriggerEnter: false };
    }
    if (authStatus === 'error') {
      if (!errorMessage) errorMessage = defaultErrorText('error');
      phase = 'error';
      return { shouldStartZoom: false, shouldTriggerEnter: false };
    }
    phase = 'auth';
    return { shouldStartZoom: false, shouldTriggerEnter: false };
  }

  return {
    read: snapshot,

    receiveAuth(update = {}) {
      const nextGen = normalizeGeneration(update.generation);
      if (nextGen !== null && generation !== null && nextGen < generation) {
        return {
          accepted: false,
          stale: true,
          generationChanged: false,
          accountChanged: false,
          bindingInvalidated: false,
          shouldStartZoom: false,
          shouldTriggerEnter: false,
          state: snapshot(),
        };
      }
      const generationChanged = nextGen !== null && nextGen !== generation;
      if (nextGen !== null) generation = nextGen;

      const prevAccountKey = accountKey;
      if (update.status !== undefined) {
        authStatus = normalizeAuthStatus(update.status);
      }

      const hasAccountKeyProp = Object.hasOwn(update, 'accountKey') && update.accountKey !== undefined;
      const incomingKey = hasAccountKeyProp ? normalizeAccountKey(update.accountKey) : undefined;

      if (authStatus === 'signed-out' || authStatus === 'unconfigured') {
        accountKey = null;
      } else if (authStatus === 'signed-in') {
        if (hasAccountKeyProp) {
          accountKey = incomingKey;
        }
      } else if (authStatus === 'signing-in') {
        if (hasAccountKeyProp) {
          accountKey = incomingKey;
        }
      } else if (incomingKey !== undefined && incomingKey !== null) {
        // loading·restoring·error 중에는 다른 유효 계정이 명시된 경우에만 교체하고 일시 null은 기존 결속을 보존한다.
        accountKey = incomingKey;
      }

      const accountChanged = accountKey !== prevAccountKey;
      if (
        authStatus === 'signed-out'
        || authStatus === 'unconfigured'
        || authStatus === 'signing-in'
        || accountKey !== welcomePausedAccountKey
      ) {
        welcomePausedAccountKey = null;
      }

      if (typeof update.errorMessage === 'string') {
        errorMessage = update.errorMessage;
      } else if (authStatus !== 'error' && authStatus !== 'unconfigured' && phase !== 'enter-error') {
        errorMessage = '';
      }
      if (typeof update.retryable === 'boolean') {
        retryable = update.retryable;
      }

      const immediate = update.immediate === true;

      // 한 번 본문에 들어간 뒤에는 restoring이나 상태 재확인으로 포털을 다시 열지 않는다.
      if (enteredOnce && (phase === 'entered' || (phase === 'purpose' && purposeOrigin === 'manual'))) {
        const manualInvalidated = phase === 'purpose' && (
          authStatus === 'signed-out'
          || authStatus === 'unconfigured'
          || accountChanged
        );
        return {
          accepted: true,
          stale: false,
          generationChanged,
          accountChanged,
          bindingInvalidated: manualInvalidated,
          shouldStartZoom: false,
          shouldTriggerEnter: false,
          state: snapshot(),
        };
      }

      // 확인된 로그인에서 연 회사 작업 공간 화면은 계정 결속 기준으로만 유지·전환한다.
      if (phase === 'workspace') {
        if (authStatus === 'signed-in') {
          if (workspaceAccountKey !== null && accountKey === workspaceAccountKey) {
            workspaceGeneration = generation;
            return {
              accepted: true,
              stale: false,
              generationChanged,
              accountChanged: false,
              bindingInvalidated: false,
              shouldStartZoom: false,
              shouldTriggerEnter: false,
              state: snapshot(),
            };
          }
          clearWorkspaceBinding();
          phase = 'entering';
          return {
            accepted: true,
            stale: false,
            generationChanged,
            accountChanged: true,
            bindingInvalidated: true,
            shouldStartZoom: false,
            shouldTriggerEnter: true,
            state: snapshot(),
          };
        }

        if (isAuthPendingStatus(authStatus)) {
          if (accountKey !== workspaceAccountKey) {
            clearWorkspaceBinding();
            phase = 'checking';
            return {
              accepted: true,
              stale: false,
              generationChanged,
              accountChanged: true,
              bindingInvalidated: true,
              shouldStartZoom: false,
              shouldTriggerEnter: false,
              state: snapshot(),
            };
          }
          return {
            accepted: true,
            stale: false,
            generationChanged,
            accountChanged: false,
            bindingInvalidated: false,
            shouldStartZoom: false,
            shouldTriggerEnter: false,
            state: snapshot(),
          };
        }

        if (authStatus === 'signed-out' || authStatus === 'unconfigured') {
          clearWorkspaceBinding();
          phase = 'auth';
          return {
            accepted: true,
            stale: false,
            generationChanged,
            accountChanged: true,
            bindingInvalidated: true,
            shouldStartZoom: false,
            shouldTriggerEnter: false,
            state: snapshot(),
          };
        }

        if (authStatus === 'signing-in') {
          clearWorkspaceBinding();
          phase = 'signing-in';
          return {
            accepted: true,
            stale: false,
            generationChanged,
            accountChanged,
            bindingInvalidated: true,
            shouldStartZoom: false,
            shouldTriggerEnter: false,
            state: snapshot(),
          };
        }

        return {
          accepted: true,
          stale: false,
          generationChanged,
          accountChanged,
          bindingInvalidated: accountChanged,
          shouldStartZoom: false,
          shouldTriggerEnter: false,
          state: snapshot(),
        };
      }

      // 확인된 로그인에서 연 목적 화면은 단순 세대 증가가 아니라 계정 결속 기준으로만 유지·전환한다.
      if (phase === 'purpose' && purposeOrigin === 'entering') {
        if (authStatus === 'signed-in') {
          if (purposeAccountKey !== null && accountKey === purposeAccountKey) {
            purposeGeneration = generation;
            if (workspaceAccountKey === accountKey) {
              workspaceGeneration = generation;
            }
            return {
              accepted: true,
              stale: false,
              generationChanged,
              accountChanged: false,
              bindingInvalidated: false,
              shouldStartZoom: false,
              shouldTriggerEnter: false,
              state: snapshot(),
            };
          }
          clearPurposeBinding();
          clearWorkspaceBinding();
          phase = 'entering';
          return {
            accepted: true,
            stale: false,
            generationChanged,
            accountChanged: true,
            bindingInvalidated: true,
            shouldStartZoom: false,
            shouldTriggerEnter: true,
            state: snapshot(),
          };
        }

        if (isAuthPendingStatus(authStatus)) {
          if (accountKey !== purposeAccountKey) {
            clearPurposeBinding();
            clearWorkspaceBinding();
            phase = 'checking';
            return {
              accepted: true,
              stale: false,
              generationChanged,
              accountChanged: true,
              bindingInvalidated: true,
              shouldStartZoom: false,
              shouldTriggerEnter: false,
              state: snapshot(),
            };
          }
          return {
            accepted: true,
            stale: false,
            generationChanged,
            accountChanged: false,
            bindingInvalidated: false,
            shouldStartZoom: false,
            shouldTriggerEnter: false,
            state: snapshot(),
          };
        }

        if (authStatus === 'signed-out' || authStatus === 'unconfigured') {
          clearPurposeBinding();
          clearWorkspaceBinding();
          phase = 'auth';
          return {
            accepted: true,
            stale: false,
            generationChanged,
            accountChanged: true,
            bindingInvalidated: true,
            shouldStartZoom: false,
            shouldTriggerEnter: false,
            state: snapshot(),
          };
        }

        if (authStatus === 'signing-in') {
          clearPurposeBinding();
          clearWorkspaceBinding();
          phase = 'signing-in';
          return {
            accepted: true,
            stale: false,
            generationChanged,
            accountChanged,
            bindingInvalidated: true,
            shouldStartZoom: false,
            shouldTriggerEnter: false,
            state: snapshot(),
          };
        }

        if (accountChanged) {
          clearWorkspaceBinding();
        }

        // error 상태에서는 목적 화면을 닫지 않고 유지하며 완료 동작에서 결속을 다시 확인한다.
        return {
          accepted: true,
          stale: false,
          generationChanged,
          accountChanged,
          bindingInvalidated: accountChanged,
          shouldStartZoom: false,
          shouldTriggerEnter: false,
          state: snapshot(),
        };
      }

      // 비로그인 둘러보기 등에서 연 목적 화면
      if (phase === 'purpose') {
        if (authStatus === 'signed-in') {
          clearPurposeBinding();
          phase = 'entering';
          return {
            accepted: true,
            stale: false,
            generationChanged,
            accountChanged,
            bindingInvalidated: true,
            shouldStartZoom: false,
            shouldTriggerEnter: true,
            state: snapshot(),
          };
        }
        if (authStatus === 'signing-in') {
          clearPurposeBinding();
          phase = 'signing-in';
          return {
            accepted: true,
            stale: false,
            generationChanged,
            accountChanged,
            bindingInvalidated: true,
            shouldStartZoom: false,
            shouldTriggerEnter: false,
            state: snapshot(),
          };
        }
        return {
          accepted: true,
          stale: false,
          generationChanged,
          accountChanged,
          bindingInvalidated: false,
          shouldStartZoom: false,
          shouldTriggerEnter: false,
          state: snapshot(),
        };
      }

      if (phase === 'entering') {
        if (authStatus === 'signed-in') {
          const sameBoundEntering = prevAccountKey !== null && accountKey === prevAccountKey;
          if (sameBoundEntering || (accountKey === null && !generationChanged && !accountChanged)) {
            return {
              accepted: true,
              stale: false,
              generationChanged,
              accountChanged: false,
              bindingInvalidated: false,
              shouldStartZoom: false,
              shouldTriggerEnter: false,
              state: snapshot(),
            };
          }
          return {
            accepted: true,
            stale: false,
            generationChanged,
            accountChanged,
            bindingInvalidated: true,
            shouldStartZoom: false,
            shouldTriggerEnter: true,
            state: snapshot(),
          };
        }

        if (isAuthPendingStatus(authStatus)) {
          if (prevAccountKey !== null && accountKey === prevAccountKey) {
            return {
              accepted: true,
              stale: false,
              generationChanged,
              accountChanged: false,
              bindingInvalidated: false,
              shouldStartZoom: false,
              shouldTriggerEnter: false,
              state: snapshot(),
            };
          }
          phase = 'checking';
          return {
            accepted: true,
            stale: false,
            generationChanged,
            accountChanged,
            bindingInvalidated: true,
            shouldStartZoom: false,
            shouldTriggerEnter: false,
            state: snapshot(),
          };
        }

        if (authStatus === 'signing-in') {
          phase = 'signing-in';
          return {
            accepted: true,
            stale: false,
            generationChanged,
            accountChanged,
            bindingInvalidated: true,
            shouldStartZoom: false,
            shouldTriggerEnter: false,
            state: snapshot(),
          };
        }

        if (authStatus === 'error') {
          if (!errorMessage) errorMessage = defaultErrorText('error');
          phase = 'error';
          return {
            accepted: true,
            stale: false,
            generationChanged,
            accountChanged,
            bindingInvalidated: true,
            shouldStartZoom: false,
            shouldTriggerEnter: false,
            state: snapshot(),
          };
        }

        phase = 'auth';
        return {
          accepted: true,
          stale: false,
          generationChanged,
          accountChanged,
          bindingInvalidated: true,
          shouldStartZoom: false,
          shouldTriggerEnter: false,
          state: snapshot(),
        };
      }

      if (authStatus === 'signed-in') {
        if (phase === 'entered') {
          return {
            accepted: true,
            stale: false,
            generationChanged,
            accountChanged,
            bindingInvalidated: false,
            shouldStartZoom: false,
            shouldTriggerEnter: false,
            state: snapshot(),
          };
        }
        if (phase === 'zooming') {
          // 이미 진행 중인 단일 확대 전환과 합친다. 확대 완료 시점에 onEnter가 호출된다.
          return {
            accepted: true,
            stale: false,
            generationChanged,
            accountChanged,
            bindingInvalidated: generationChanged || accountChanged,
            shouldStartZoom: false,
            shouldTriggerEnter: false,
            state: snapshot(),
          };
        }
        if (phase === 'welcome') {
          if (welcomePausedAccountKey !== null && accountKey === welcomePausedAccountKey) {
            return {
              accepted: true,
              stale: false,
              generationChanged,
              accountChanged: false,
              bindingInvalidated: false,
              shouldStartZoom: false,
              shouldTriggerEnter: false,
              state: snapshot(),
            };
          }
          zoomConsumed = true;
          if (immediate) {
            phase = 'entering';
            return {
              accepted: true,
              stale: false,
              generationChanged,
              accountChanged,
              bindingInvalidated: true,
              shouldStartZoom: false,
              shouldTriggerEnter: true,
              state: snapshot(),
            };
          }
          phase = 'zooming';
          return {
            accepted: true,
            stale: false,
            generationChanged,
            accountChanged,
            bindingInvalidated: generationChanged || accountChanged,
            shouldStartZoom: true,
            shouldTriggerEnter: false,
            state: snapshot(),
          };
        }
        // 이미 구 내부 단계에 있다면 다시 확대하지 않고 바로 진입 연결을 요청한다.
        phase = 'entering';
        return {
          accepted: true,
          stale: false,
          generationChanged,
          accountChanged,
          bindingInvalidated: true,
          shouldStartZoom: false,
          shouldTriggerEnter: true,
          state: snapshot(),
        };
      }

      if (phase === 'welcome' || phase === 'zooming') {
        return {
          accepted: true,
          stale: false,
          generationChanged,
          accountChanged,
          bindingInvalidated: generationChanged || accountChanged,
          shouldStartZoom: false,
          shouldTriggerEnter: false,
          state: snapshot(),
        };
      }

      if (authStatus === 'signing-in') {
        phase = 'signing-in';
        return {
          accepted: true,
          stale: false,
          generationChanged,
          accountChanged,
          bindingInvalidated: generationChanged || accountChanged,
          shouldStartZoom: false,
          shouldTriggerEnter: false,
          state: snapshot(),
        };
      }

      if (isAuthPendingStatus(authStatus)) {
        if (phase === 'checking' || phase === 'signing-in') {
          phase = 'checking';
        }
        return {
          accepted: true,
          stale: false,
          generationChanged,
          accountChanged,
          bindingInvalidated: generationChanged || accountChanged,
          shouldStartZoom: false,
          shouldTriggerEnter: false,
          state: snapshot(),
        };
      }

      if (authStatus === 'error') {
        if (!errorMessage) errorMessage = defaultErrorText('error');
        if (phase !== 'invite') phase = 'error';
        return {
          accepted: true,
          stale: false,
          generationChanged,
          accountChanged,
          bindingInvalidated: generationChanged || accountChanged,
          shouldStartZoom: false,
          shouldTriggerEnter: false,
          state: snapshot(),
        };
      }

      // signed-out 또는 unconfigured 확정
      if (phase === 'checking' || phase === 'signing-in' || phase === 'enter-error') {
        phase = 'auth';
      }
      return {
        accepted: true,
        stale: false,
        generationChanged,
        accountChanged,
        bindingInvalidated: generationChanged || accountChanged,
        shouldStartZoom: false,
        shouldTriggerEnter: false,
        state: snapshot(),
      };
    },

    activateOrb({ immediate = false } = {}) {
      if (phase !== 'welcome') {
        return { changed: false, shouldStartZoom: false, shouldTriggerEnter: false, state: snapshot() };
      }
      welcomePausedAccountKey = null;
      zoomConsumed = true;
      if (immediate) {
        const result = resolveInteriorPhase();
        return { changed: true, ...result, state: snapshot() };
      }
      phase = 'zooming';
      return { changed: true, shouldStartZoom: true, shouldTriggerEnter: false, state: snapshot() };
    },

    completeZoom() {
      if (phase !== 'zooming') {
        return { changed: false, shouldStartZoom: false, shouldTriggerEnter: false, state: snapshot() };
      }
      const result = resolveInteriorPhase();
      return { changed: true, ...result, state: snapshot() };
    },

    // 검증된 세대와 계정 결속이 있는 entering 단계에서만 목적 선택 화면을 연다.
    enterToPurpose(opts = {}) {
      if (phase !== 'entering' || generation === null || accountKey === null) {
        return { ok: false, changed: false, state: snapshot() };
      }
      const nextMode = normalizePurposeMode(opts?.mode ?? opts?.purposeMode);
      clearWorkspaceBinding();
      welcomePausedAccountKey = null;
      returnPhase = nextMode === 'existing' ? 'welcome' : 'entering';
      purposeOrigin = 'entering';
      purposeMode = nextMode;
      purposeAccountKey = accountKey;
      purposeGeneration = generation;
      errorMessage = '';
      phase = 'purpose';
      return { ok: true, changed: true, state: snapshot() };
    },

    // 검증된 세대와 계정 결속이 있는 entering 또는 workspace 단계에서 작업 공간 선택·확인 화면을 연다.
    enterToWorkspace(rawWorkspace = {}) {
      if ((phase !== 'entering' && phase !== 'workspace') || generation === null || accountKey === null) {
        return { ok: false, changed: false, state: snapshot() };
      }
      clearPurposeBinding();
      welcomePausedAccountKey = null;
      workspaceState = normalizePortalWorkspaceState(rawWorkspace);
      workspaceAccountKey = accountKey;
      workspaceGeneration = generation;
      errorMessage = '';
      phase = 'workspace';
      return { ok: true, changed: true, state: snapshot() };
    },

    updateWorkspace(rawWorkspace = {}, guard = {}) {
      if ((phase !== 'entering' && phase !== 'workspace') || accountKey === null) {
        return { ok: false, changed: false, state: snapshot() };
      }
      if (guard.accountKey !== undefined && guard.accountKey !== accountKey) {
        return { ok: false, changed: false, state: snapshot() };
      }
      if (phase === 'workspace' && workspaceAccountKey !== null && workspaceAccountKey !== accountKey) {
        return { ok: false, changed: false, state: snapshot() };
      }
      clearPurposeBinding();
      welcomePausedAccountKey = null;
      workspaceState = normalizePortalWorkspaceState(rawWorkspace);
      workspaceAccountKey = accountKey;
      workspaceGeneration = generation;
      errorMessage = '';
      phase = 'workspace';
      return { ok: true, changed: true, state: snapshot() };
    },

    workspaceToPurpose(opts = {}) {
      if (phase !== 'workspace' || generation === null || accountKey === null || workspaceAccountKey !== accountKey) {
        return { ok: false, changed: false, state: snapshot() };
      }
      const nextMode = normalizePurposeMode(opts?.mode ?? opts?.purposeMode);
      const keepWorkspace = nextMode === 'existing' && opts?.returnToWorkspace !== false && workspaceState !== null;
      const boundKey = workspaceAccountKey;
      const boundGen = generation;
      if (!keepWorkspace) {
        clearWorkspaceBinding();
      }
      welcomePausedAccountKey = null;
      returnPhase = nextMode === 'existing'
        ? (keepWorkspace ? 'workspace' : 'welcome')
        : 'entering';
      purposeOrigin = 'entering';
      purposeMode = nextMode;
      purposeAccountKey = boundKey;
      purposeGeneration = boundGen;
      errorMessage = '';
      phase = 'purpose';
      return { ok: true, changed: true, state: snapshot() };
    },

    returnFromExistingPurpose(opts = {}) {
      if (
        phase !== 'purpose'
        || purposeOrigin !== 'entering'
        || purposeMode !== 'existing'
        || authStatus !== 'signed-in'
        || generation === null
        || accountKey === null
        || purposeAccountKey === null
        || accountKey !== purposeAccountKey
      ) {
        return { ok: false, changed: false, state: snapshot() };
      }
      const forceWelcome = opts?.forceWelcome === true;
      const nextReturnPhase = returnPhase;
      clearPurposeBinding();
      errorMessage = '';
      if (
        !forceWelcome
        && nextReturnPhase === 'workspace'
        && workspaceState !== null
        && workspaceAccountKey !== null
        && workspaceAccountKey === accountKey
      ) {
        welcomePausedAccountKey = null;
        workspaceGeneration = generation;
        phase = 'workspace';
        return { ok: true, changed: true, targetPhase: 'workspace', state: snapshot() };
      }
      clearWorkspaceBinding();
      zoomConsumed = false;
      welcomePausedAccountKey = accountKey;
      returnPhase = 'auth';
      phase = 'welcome';
      return { ok: true, changed: true, targetPhase: 'welcome', state: snapshot() };
    },

    beginSignIn() {
      if (phase === 'entered') return snapshot();
      clearPurposeBinding();
      clearWorkspaceBinding();
      welcomePausedAccountKey = null;
      authStatus = 'signing-in';
      phase = 'signing-in';
      errorMessage = '';
      return snapshot();
    },

    showAuthPanel() {
      if (phase === 'entered') return snapshot();
      clearPurposeBinding();
      clearWorkspaceBinding();
      welcomePausedAccountKey = null;
      errorMessage = '';
      phase = 'auth';
      return snapshot();
    },

    showWelcomeOrb() {
      if (
        enteredOnce
        || phase === 'entering'
        || phase === 'workspace'
        || (phase === 'purpose' && purposeOrigin === 'entering')
      ) {
        return snapshot();
      }
      clearPurposeBinding();
      clearWorkspaceBinding();
      welcomePausedAccountKey = null;
      errorMessage = '';
      zoomConsumed = false;
      phase = 'welcome';
      return snapshot();
    },

    beginRetryCheck() {
      if (phase === 'entered') return snapshot();
      clearPurposeBinding();
      clearWorkspaceBinding();
      welcomePausedAccountKey = null;
      errorMessage = '';
      authStatus = 'loading';
      phase = 'checking';
      return snapshot();
    },

    completeEnter() {
      clearPurposeBinding();
      clearWorkspaceBinding();
      welcomePausedAccountKey = null;
      errorMessage = '';
      enteredOnce = true;
      phase = 'entered';
      return snapshot();
    },

    failEnter(message) {
      clearPurposeBinding();
      clearWorkspaceBinding();
      welcomePausedAccountKey = null;
      errorMessage = typeof message === 'string' && message.trim()
        ? message.trim()
        : '배정된 작업 공간을 불러오지 못했어요. 다시 시도해 주세요.';
      phase = 'enter-error';
      return snapshot();
    },

    retryEnter() {
      if (phase !== 'enter-error') {
        return { shouldTriggerEnter: false, state: snapshot() };
      }
      clearWorkspaceBinding();
      welcomePausedAccountKey = null;
      errorMessage = '';
      phase = 'entering';
      return { shouldTriggerEnter: true, state: snapshot() };
    },

    completeBrowse() {
      clearPurposeBinding();
      clearWorkspaceBinding();
      welcomePausedAccountKey = null;
      errorMessage = '';
      enteredOnce = true;
      phase = 'entered';
      return snapshot();
    },

    openInvite() {
      if (
        phase === 'entered'
        || phase === 'entering'
        || phase === 'workspace'
        || (phase === 'purpose' && purposeOrigin === 'entering')
      ) {
        return snapshot();
      }
      clearPurposeBinding();
      clearWorkspaceBinding();
      returnPhase = phase === 'invite' ? returnPhase : 'auth';
      phase = 'invite';
      return snapshot();
    },

    closeInvite() {
      if (phase !== 'invite') return snapshot();
      phase = authStatus === 'error' ? 'error' : 'auth';
      return snapshot();
    },

    // 사용자 명시 요청이나 비로그인 둘러보기에서 목적 선택 화면을 연다.
    openPurpose(opts = {}) {
      if (phase === 'zooming' || phase === 'entering' || phase === 'workspace') return snapshot();
      if (phase === 'purpose') return snapshot();
      const requestedOrigin = opts?.origin;
      const isEnteredContext = enteredOnce || phase === 'entered';
      returnPhase = isEnteredContext ? 'entered' : 'auth';
      purposeOrigin = requestedOrigin === 'browse'
        ? 'browse'
        : requestedOrigin === 'manual'
          ? 'manual'
          : (isEnteredContext ? 'manual' : 'browse');
      purposeMode = null;
      purposeAccountKey = accountKey;
      purposeGeneration = generation;
      phase = 'purpose';
      return snapshot();
    },

    closePurpose() {
      if (phase !== 'purpose') return snapshot();
      if (purposeOrigin === 'entering') return snapshot();
      const origin = purposeOrigin;
      const backToEntered = returnPhase === 'entered' || enteredOnce;
      clearPurposeBinding();
      if (origin === 'browse') {
        phase = 'auth';
      } else {
        phase = backToEntered ? 'entered' : (authStatus === 'error' ? 'error' : 'auth');
      }
      return snapshot();
    },

    // 호스트가 명시적 로그아웃 직후 첫 화면 인증을 다시 열 때만 호출한다.
    reopenAuth({ status = 'signed-out', generation: nextGen, accountKey: nextAccountKey } = {}) {
      const normalizedGen = normalizeGeneration(nextGen);
      if (normalizedGen !== null) generation = normalizedGen;
      clearPurposeBinding();
      clearWorkspaceBinding();
      welcomePausedAccountKey = null;
      enteredOnce = false;
      zoomConsumed = true;
      authStatus = normalizeAuthStatus(status);
      accountKey = authStatus === 'signed-in' ? normalizeAccountKey(nextAccountKey) : null;
      errorMessage = '';
      phase = authStatus === 'error' ? 'error' : 'auth';
      return snapshot();
    },
  };
}
