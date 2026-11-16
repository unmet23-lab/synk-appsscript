import {
  mountPortalEntry,
  isPortalActive,
  INVITE_TOKEN_PATTERN,
  PORTAL_WORKSPACE_ITEMS,
  PORTAL_WORKSPACE_STATUSES,
  normalizePortalWorkspaceDestination,
  normalizePortalWorkspaceState,
} from './portal-entry.mjs';

export {
  isPortalActive,
  PORTAL_WORKSPACE_ITEMS,
  PORTAL_WORKSPACE_STATUSES,
  normalizePortalWorkspaceDestination,
  normalizePortalWorkspaceState,
};
export const PURPOSE_ONBOARDING_OUTCOMES = Object.freeze(['chosen', 'skipped', 'not-asked']);

const INVITE_ORIGIN = 'https://workspace.synk.im';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_DESTINATIONS = new Set(['/', '/pulse-app/']);
const ALLOWED_UNAVAILABLE_TARGETS = new Set(['workspace', 'pulse']);
const ALLOWED_ASSIGNMENT_STATUSES = new Set([
  'resolved',
  'partial',
  'login_required',
  'account_mismatch',
  'unavailable',
]);
const APP_ID_PATTERN = /^[a-z0-9_-]{1,32}$/;

const FOCUSABLE_IN_PORTAL = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function isVisibleElement(node) {
  if (!node || node.hidden) return false;
  let cursor = node;
  while (cursor && cursor.nodeType === 1) {
    if (cursor.hidden || cursor.getAttribute?.('aria-hidden') === 'true') return false;
    cursor = cursor.parentElement;
  }
  return true;
}

function extractWorkspaceInviteToken(validatedHref, expectedPathname) {
  if (typeof validatedHref !== 'string' || !validatedHref) return null;
  let parsed;
  try {
    parsed = new URL(validatedHref);
  } catch {
    return null;
  }
  if (
    parsed.origin !== INVITE_ORIGIN
    || parsed.pathname !== expectedPathname
    || parsed.username
    || parsed.password
    || parsed.search
  ) {
    return null;
  }
  const rawHash = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : '';
  if (!rawHash) return null;
  const params = new URLSearchParams(rawHash);
  const tokens = params.getAll('invite');
  if (tokens.length !== 1 || [...params.keys()].some(key => key !== 'invite')) {
    return null;
  }
  const token = tokens[0].trim();
  return INVITE_TOKEN_PATTERN.test(token) ? token : null;
}

export function extractPulseInviteToken(validatedHref) {
  return extractWorkspaceInviteToken(validatedHref, '/pulse-app/');
}

export function extractCompanyInviteToken(validatedHref) {
  return extractWorkspaceInviteToken(validatedHref, '/');
}

export function verifiedPortalAccountKey(snapshot) {
  if (!snapshot || snapshot.signedIn !== true || snapshot.status !== 'signed-in') {
    return null;
  }
  const rawId = typeof snapshot.account?.synk_user_id === 'string'
    ? snapshot.account.synk_user_id.trim()
    : '';
  if (!rawId || rawId === 'anonymous-local') return null;
  return rawId;
}

export function normalizeDesktopPortalAuth(snapshot, { hasBridge = true, reducedMotion } = {}) {
  const generation = Number.isSafeInteger(snapshot?.sessionGeneration)
    ? snapshot.sessionGeneration
    : undefined;
  const verifiedId = verifiedPortalAccountKey(snapshot);
  const onboarding = {
    purpose: verifiedId && snapshot?.onboarding?.purpose === 'pending' ? 'pending' : 'none',
  };
  const motionField = typeof reducedMotion === 'boolean' ? { reducedMotion } : {};

  if (
    !hasBridge
    || snapshot?.status === 'unconfigured'
    || (snapshot?.configured === false && snapshot?.status !== 'restoring' && snapshot?.status !== 'loading')
  ) {
    return {
      status: 'unconfigured',
      generation,
      accountKey: null,
      onboarding: { purpose: 'none' },
      errorMessage: !hasBridge
        ? '브라우저 미리보기에서는 로그인 연결을 확인하지 않아요.'
        : (snapshot?.error?.message || '로그인 설정을 찾지 못해 로그인할 수 없어요. synk.im에서 PC 앱을 다시 받아 설치해 주세요.'),
      retryable: false,
      ...motionField,
    };
  }

  if (snapshot?.status === 'restoring') {
    // 같은 계정의 토큰 갱신 중에는 account가 잠시 비워지므로 accountKey를 덮어쓰지 않는다.
    return {
      status: 'restoring',
      generation,
      onboarding: { purpose: 'none' },
      ...motionField,
    };
  }

  if (snapshot?.status === 'signing-out' || snapshot?.status === 'loading') {
    return {
      status: 'loading',
      generation,
      onboarding: { purpose: 'none' },
      ...motionField,
    };
  }

  if (snapshot?.status === 'signing-in') {
    return {
      status: 'signing-in',
      generation,
      onboarding: { purpose: 'none' },
      ...motionField,
    };
  }

  if (snapshot?.status === 'signed-in' || snapshot?.signedIn === true) {
    if (!verifiedId) {
      return {
        status: 'error',
        generation,
        onboarding: { purpose: 'none' },
        errorMessage: '계정 식별 정보를 확인하지 못했어요. 다시 시도해 주세요.',
        retryable: true,
        ...motionField,
      };
    }
    return {
      status: 'signed-in',
      generation,
      accountKey: verifiedId,
      onboarding,
      ...motionField,
    };
  }

  if (snapshot?.status === 'error') {
    const retryable = snapshot?.error?.retryable !== false;
    return {
      status: 'error',
      generation,
      ...(retryable ? {} : { accountKey: null }),
      onboarding: { purpose: 'none' },
      errorMessage: snapshot?.error?.message || '계정 연결을 확인하지 못했어요. 잠시 뒤 다시 시도해 주세요.',
      retryable,
      ...motionField,
    };
  }

  return {
    status: 'signed-out',
    generation,
    accountKey: null,
    onboarding: { purpose: 'none' },
    errorMessage: snapshot?.error?.message || '',
    retryable: false,
    ...motionField,
  };
}

export function parseDesktopHashRoute(rawHash) {
  const trimmed = typeof rawHash === 'string' ? rawHash.trim() : '';
  if (!trimmed || trimmed === '#') return null;
  const body = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
  if (!body) return null;

  if (body === 'home') return { view: 'home', canonicalHash: '#home' };
  if (body === 'library') return { view: 'library', appId: null, canonicalHash: '#library' };
  if (body === 'downloads') return { view: 'downloads', canonicalHash: '#downloads' };
  if (body === 'settings') return { view: 'settings', canonicalHash: '#settings' };
  if (body === 'account') return { view: 'account', canonicalHash: '#account' };
  if (body === 'account/insight' || body === 'benefits/insight') {
    return { view: 'insight', canonicalHash: '#account/insight', legacy: body === 'benefits/insight' };
  }
  if (body === 'solio') return { view: 'solio', section: 'home', canonicalHash: '#solio' };
  if (body === 'solio/subscriptions' || body === 'benefits/subscriptions') {
    return {
      view: 'solio',
      section: 'subscriptions',
      canonicalHash: '#solio/subscriptions',
      legacy: body === 'benefits/subscriptions',
    };
  }
  if (body === 'solio/backup') {
    return { view: 'solio', section: 'backup', canonicalHash: '#solio/backup' };
  }
  if (body === 'benefits') return { view: 'benefits', benefitId: null, canonicalHash: '#benefits' };
  if (body.startsWith('benefits/')) {
    const benefitId = body.slice('benefits/'.length);
    if (APP_ID_PATTERN.test(benefitId)) {
      return { view: 'benefits', benefitId, canonicalHash: `#benefits/${benefitId}` };
    }
    return null;
  }
  if (body.startsWith('app/')) {
    const appId = body.slice('app/'.length);
    if (!APP_ID_PATTERN.test(appId)) return null;
    if (appId === 'world') {
      return { view: 'home', worldPhone: true, canonicalHash: '#home' };
    }
    return { view: 'library', appId, detail: 'overview', canonicalHash: `#app/${appId}` };
  }
  return null;
}

export function formatDesktopRouteHash(route) {
  const view = route?.view || 'home';
  if (view === 'account') return '#account';
  if (view === 'insight') return '#account/insight';
  if (view === 'solio') {
    if (route?.section === 'subscriptions') return '#solio/subscriptions';
    if (route?.section === 'backup') return '#solio/backup';
    return '#solio';
  }
  if (view === 'benefits') {
    return route?.benefitId ? `#benefits/${route.benefitId}` : '#benefits';
  }
  if (view === 'library') {
    return route?.appId ? `#app/${route.appId}` : '#library';
  }
  if (view === 'downloads') return '#downloads';
  if (view === 'settings') return '#settings';
  return '#home';
}

export function readSnapshotAccountGeneration(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const raw = typeof snapshot.accountGeneration === 'string'
    ? snapshot.accountGeneration.trim()
    : '';
  return UUID_PATTERN.test(raw) ? raw : null;
}

function createRequestId(cryptoRef) {
  const targetCrypto = cryptoRef || globalThis.crypto;
  if (targetCrypto && typeof targetCrypto.randomUUID === 'function') {
    const generated = targetCrypto.randomUUID();
    if (typeof generated === 'string' && UUID_PATTERN.test(generated)) {
      return generated;
    }
  }
  return null;
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function pulseInviteErrorMessage(code) {
  switch (code) {
    case 'PULSE_APP_INVITE_UNCONFIRMED':
      return '초대 전달 완료 여부를 아직 확인하지 못했어요. 이미 열린 PULSE 작업 공간 창에 초대가 반영되었는지 먼저 확인해 주세요.';
    case 'PULSE_APP_DEMO_ACTIVE':
      return '열려 있는 PULSE 창에서 예시 화면을 보는 중이에요. 예시 화면을 닫은 뒤 다시 시도해 주세요.';
    case 'PULSE_APP_BUSY':
      return 'PULSE 창이 다른 작업을 처리하고 있어요. 잠시 뒤 다시 시도해 주세요.';
    case 'PULSE_APP_ACCOUNT_PENDING':
      return '로그인 상태를 확인하고 있어요. 잠시 뒤 다시 시도해 주세요.';
    case 'PULSE_APP_ACCOUNT_CHANGED':
      return '계정 연결이 바뀌었어요. 로그인 상태를 확인한 뒤 다시 시도해 주세요.';
    case 'PULSE_APP_STORAGE_UNAVAILABLE':
      return '이전 계정의 PULSE 창 정리가 아직 끝나지 않았어요. 앱을 다시 연 뒤 시도해 주세요.';
    case 'SUITE_UNAVAILABLE':
      return '이 PC의 로그인 보관함을 확인하지 못했어요. 저장 공간을 확인한 뒤 다시 시도해 주세요.';
    case 'PULSE_APP_UNAVAILABLE':
      return '이 환경에서는 PULSE 초대를 열 수 없어요. 설치된 SYNK Platform 앱에서 다시 시도해 주세요.';
    case 'INVALID_INVITE_TOKEN':
      return '초대 링크 형식을 확인해 주세요.';
    case 'PULSE_APP_OPEN_FAILED':
    case 'PULSE_APP_INVITE_FAILED':
    default:
      return 'PULSE 초대 화면을 열지 못했어요. 인터넷 연결과 열린 PULSE 창을 확인한 뒤 다시 시도해 주세요.';
  }
}

function companyInviteErrorMessage(code, { isPulseLink = false } = {}) {
  switch (code) {
    case 'PULSE_APP_INVITE_UNCONFIRMED':
    case 'PULSE_APP_DEMO_ACTIVE':
    case 'PULSE_APP_BUSY':
    case 'PULSE_APP_ACCOUNT_PENDING':
    case 'PULSE_APP_ACCOUNT_CHANGED':
    case 'PULSE_APP_STORAGE_UNAVAILABLE':
    case 'SUITE_UNAVAILABLE':
    case 'PULSE_APP_UNAVAILABLE':
    case 'INVALID_INVITE_TOKEN':
    case 'PULSE_APP_OPEN_FAILED':
    case 'PULSE_APP_INVITE_FAILED':
      return pulseInviteErrorMessage(code);
    case 'HANDOFF_UNCONFIRMED':
      return isPulseLink
        ? pulseInviteErrorMessage('PULSE_APP_INVITE_UNCONFIRMED')
        : '초대 전달 완료 여부를 아직 확인하지 못했어요. 이미 열린 작업 공간 창에 초대가 반영되었는지 먼저 확인해 주세요.';
    case 'INVALID_INPUT':
      return '초대코드 형식이 올바르지 않아요. 전달받은 코드나 링크를 다시 확인해 주세요.';
    case 'INVITE_REJECTED':
      return '유효하지 않거나 만료된 초대코드예요. 전달받은 코드와 링크를 다시 확인해 주세요.';
    case 'HANDOFF_TIMEOUT':
      return '작업 공간 응답 시간이 지났어요. 인터넷 연결을 확인한 뒤 다시 입력해 주세요.';
    case 'TEMPORARY_UNAVAILABLE':
      return '지금은 작업 공간에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.';
    case 'RATE_LIMITED':
      return '요청이 잠시 몰렸어요. 조금 기다린 뒤 다시 입력해 주세요.';
    case 'ACCOUNT_CHANGED':
      return '진행 중 로그인 계정이 바뀌어 초대를 중단했어요. 계정을 확인한 뒤 다시 입력해 주세요.';
    case 'ACCOUNT_MISMATCH':
      return '열린 작업 공간의 계정과 현재 로그인한 계정이 달라요. 계정을 맞춘 뒤 다시 시도해 주세요.';
    case 'BUSY':
      return '다른 작업 공간 요청을 처리하고 있어요. 잠시 뒤 다시 시도해 주세요.';
    case 'CANCELLED':
      return '초대 확인이 취소되었어요. 코드를 확인한 뒤 다시 눌러 주세요.';
    case 'AUTH_PENDING':
      return '로그인 상태를 확인하고 있어요. 잠시 뒤 다시 시도해 주세요.';
    case 'HANDOFF_UNAVAILABLE':
      return isPulseLink
        ? pulseInviteErrorMessage('PULSE_APP_UNAVAILABLE')
        : '이 환경에서는 작업 공간 초대를 바로 열 수 없어요. 설치된 SYNK Platform 앱에서 다시 시도해 주세요.';
    default:
      return isPulseLink
        ? pulseInviteErrorMessage('PULSE_APP_INVITE_FAILED')
        : '초대코드를 확인하지 못했어요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.';
  }
}

function desktopOpenDestinationErrorMessage(code) {
  switch (code) {
    case 'PULSE_APP_DEMO_ACTIVE':
      return '열려 있는 PULSE 창에서 예시 화면을 보는 중이에요. 예시 화면을 닫은 뒤 다시 열어 주세요.';
    case 'PULSE_APP_BUSY':
    case 'BUSY':
      return '작업 공간 창이 다른 작업을 처리하고 있어요. 잠시 뒤 다시 눌러 주세요.';
    case 'PULSE_APP_STORAGE_UNAVAILABLE':
      return '이전 계정의 작업 공간 정리가 아직 끝나지 않았어요. 잠시 뒤 다시 확인해 주세요.';
    case 'SUITE_UNAVAILABLE':
      return '이 PC의 로그인 보관함을 확인하지 못했어요. 저장 공간을 확인한 뒤 다시 시도해 주세요.';
    case 'HANDOFF_UNAVAILABLE':
      return '이 환경에서는 배정된 작업 공간을 바로 열 수 없어요. 설치된 앱 상태를 확인하거나 개인 화면으로 계속 이동해 주세요.';
    default:
      return '선택한 작업 공간을 열지 못했어요. 작업 공간 다시 확인을 누른 뒤 다시 시도해 주세요.';
  }
}

function mapDesktopResolveErrorToWorkspace(code) {
  if (
    code === 'LOGIN_REQUIRED'
    || code === 'login_required'
    || code === 'COMPANY_LOGIN_REQUIRED'
    || code === 'PULSE_LOGIN_REQUIRED'
  ) {
    return {
      status: 'login_required',
      destinations: [],
      unavailable: [],
      message: '회사 작업 공간에 들어가려면 추가 로그인이 필요해요. 로그인을 마친 뒤 작업 공간 다시 확인을 눌러 주세요.',
      canSwitchAccount: true,
      canContinuePersonal: true,
    };
  }
  if (
    code === 'ACCOUNT_MISMATCH'
    || code === 'account_mismatch'
    || code === 'PULSE_APP_ACCOUNT_MISMATCH'
  ) {
    return {
      status: 'account_mismatch',
      destinations: [],
      unavailable: [],
      canSwitchAccount: true,
      canContinuePersonal: true,
    };
  }
  if (code === 'BUSY' || code === 'PULSE_APP_BUSY') {
    return {
      status: 'unavailable',
      destinations: [],
      unavailable: [],
      message: '다른 작업 공간 요청을 처리하고 있어요. 잠시 뒤 다시 확인해 주세요.',
      canSwitchAccount: true,
      canContinuePersonal: true,
    };
  }
  if (code === 'CANCELLED') {
    return {
      status: 'unavailable',
      destinations: [],
      unavailable: [],
      message: '작업 공간 확인이 취소되었어요. 아래 단추를 눌러 다시 확인해 주세요.',
      canSwitchAccount: true,
      canContinuePersonal: true,
    };
  }
  if (code === 'HANDOFF_TIMEOUT') {
    return {
      status: 'unavailable',
      destinations: [],
      unavailable: [],
      message: '작업 공간 응답 시간이 지났어요. 아래 단추를 눌러 다시 확인해 주세요.',
      canSwitchAccount: true,
      canContinuePersonal: true,
    };
  }
  if (code === 'RATE_LIMITED') {
    return {
      status: 'unavailable',
      destinations: [],
      unavailable: [],
      message: '확인 요청이 잠시 몰렸어요. 조금 기다린 뒤 다시 확인해 주세요.',
      canSwitchAccount: true,
      canContinuePersonal: true,
    };
  }
  if (code === 'SUITE_UNAVAILABLE') {
    return {
      status: 'unavailable',
      destinations: [],
      unavailable: [],
      message: '이 PC의 로그인 보관함을 확인하지 못했어요. 잠시 뒤 다시 확인해 주세요.',
      canSwitchAccount: true,
      canContinuePersonal: true,
    };
  }
  if (code === 'HANDOFF_UNAVAILABLE') {
    return {
      status: 'unavailable',
      destinations: [],
      unavailable: [],
      message: '이 환경에서는 연결된 작업 공간을 바로 확인하지 못했어요. 잠시 뒤 다시 확인하거나 개인 화면으로 계속 이동해 주세요.',
      canSwitchAccount: true,
      canContinuePersonal: true,
    };
  }
  return {
    status: 'unavailable',
    destinations: [],
    unavailable: [],
    message: '지금은 작업 공간 연결을 확인하지 못했어요. 잠시 뒤 다시 확인해 주세요.',
    canSwitchAccount: true,
    canContinuePersonal: true,
  };
}

function shiftPurposeErrorMessage(code) {
  switch (code) {
    case 'SUITE_UNAVAILABLE':
      return '이 PC의 로그인 보관함을 확인하지 못해 SHIFT 화면을 열지 못했어요. 잠시 뒤 다시 시도해 주세요.';
    case 'PORTAL_PURPOSE_UNAVAILABLE':
      return '이 환경에서는 SHIFT 화면을 바로 열 수 없어요. 설치된 SYNK Platform 앱에서 다시 시도해 주세요.';
    case 'UNKNOWN_PORTAL_PURPOSE':
    case 'PORTAL_PURPOSE_OPEN_FAILED':
    default:
      return '기본 브라우저에서 SHIFT 화면을 열지 못했어요. 잠시 뒤 다시 눌러 주세요.';
  }
}

function signUpErrorMessage(code) {
  switch (code) {
    case 'LAUNCHER_ONLY':
    case 'AUTH_SIGNUP_UNAVAILABLE':
      return '지금은 회원가입 화면을 바로 열 수 없어요. 잠시 뒤 다시 눌러 주세요.';
    case 'AUTH_SIGNUP_OPEN_FAILED':
    default:
      return '회원가입 화면을 열지 못했어요. 기본 브라우저 설정을 확인한 뒤 다시 시도해 주세요.';
  }
}

function validateUniqueValues(list, allowedSet) {
  if (!Array.isArray(list)) return null;
  const seen = new Set();
  const out = [];
  for (const item of list) {
    if (typeof item !== 'string' || !allowedSet.has(item) || seen.has(item)) {
      return null;
    }
    seen.add(item);
    out.push(item);
  }
  return out;
}

function parseVerifiedAssignmentResult(rawResult) {
  if (!isPlainObject(rawResult)) return null;
  if (!ALLOWED_ASSIGNMENT_STATUSES.has(rawResult.status)) return null;
  const destinations = validateUniqueValues(rawResult.destinations, ALLOWED_DESTINATIONS);
  const unavailable = validateUniqueValues(rawResult.unavailable, ALLOWED_UNAVAILABLE_TARGETS);
  if (!destinations || !unavailable) return null;
  return {
    status: rawResult.status,
    destinations,
    unavailable,
  };
}

function isValidInviteReceivedAck(result, expectedRequestId, expectedAccountGeneration, expectedDestination = null) {
  if (!isPlainObject(result)) return false;
  if (result.ok !== true || result.state !== 'received') return false;
  if (result.requestId !== expectedRequestId || result.accountGeneration !== expectedAccountGeneration) {
    return false;
  }
  if (!ALLOWED_DESTINATIONS.has(result.destination)) return false;
  if (expectedDestination && result.destination !== expectedDestination) {
    return false;
  }
  return true;
}

/**
 * 데스크톱 main 프로세스의 회사 진입·초대·배정 브리지 기본 경계다.
 * 브리지 메서드가 없으면 성공이나 무배정으로 치환하지 않고 연결 실패를 반환한다.
 */
export function createDefaultCompanyBoundaries(defaultBridge = null) {
  return {
    async handoffCompanyInviteLink({ href, requestId, accountGeneration, bridge = defaultBridge } = {}) {
      const target = bridge || defaultBridge;
      if (typeof target?.handoffCompanyInviteLink !== 'function') {
        return {
          ok: false,
          requestId,
          accountGeneration,
          code: 'HANDOFF_UNAVAILABLE',
          retryable: false,
        };
      }
      try {
        return await target.handoffCompanyInviteLink({
          href,
          requestId,
          accountGeneration,
        });
      } catch {
        return {
          ok: false,
          requestId,
          accountGeneration,
          code: 'TEMPORARY_UNAVAILABLE',
          retryable: true,
        };
      }
    },

    async inspectBareInviteCode({ code, requestId, accountGeneration, bridge = defaultBridge } = {}) {
      const target = bridge || defaultBridge;
      if (typeof target?.inspectCompanyInviteCode !== 'function') {
        return {
          ok: false,
          requestId,
          accountGeneration,
          code: 'HANDOFF_UNAVAILABLE',
          retryable: false,
        };
      }
      try {
        return await target.inspectCompanyInviteCode({
          code,
          requestId,
          accountGeneration,
        });
      } catch {
        return {
          ok: false,
          requestId,
          accountGeneration,
          code: 'TEMPORARY_UNAVAILABLE',
          retryable: true,
        };
      }
    },

    async openPulseAppInvite({ token, requestId, accountGeneration, bridge = defaultBridge } = {}) {
      const target = bridge || defaultBridge;
      if (typeof target?.openPulseAppInvite !== 'function') {
        return {
          ok: false,
          requestId,
          accountGeneration,
          code: 'PULSE_APP_UNAVAILABLE',
          retryable: false,
        };
      }
      try {
        return await target.openPulseAppInvite({
          token,
          requestId,
          accountGeneration,
        });
      } catch {
        return {
          ok: false,
          requestId,
          accountGeneration,
          code: 'PULSE_APP_INVITE_FAILED',
          retryable: true,
        };
      }
    },

    async cancelCompanyEntry({ requestId, accountGeneration, bridge = defaultBridge } = {}) {
      const target = bridge || defaultBridge;
      if (typeof target?.cancelCompanyEntry !== 'function') {
        return {
          ok: false,
          requestId,
          accountGeneration,
          code: 'HANDOFF_UNAVAILABLE',
          retryable: false,
        };
      }
      try {
        return await target.cancelCompanyEntry({
          requestId,
          accountGeneration,
        });
      } catch {
        return {
          ok: false,
          requestId,
          accountGeneration,
          code: 'TEMPORARY_UNAVAILABLE',
          retryable: false,
        };
      }
    },

    async resolveAssignedDestination({ requestId, accountGeneration, bridge = defaultBridge } = {}) {
      const target = bridge || defaultBridge;
      if (typeof target?.resolveCompanyEntryDestinations !== 'function') {
        return {
          ok: false,
          requestId,
          accountGeneration,
          code: 'HANDOFF_UNAVAILABLE',
          retryable: false,
        };
      }
      try {
        return await target.resolveCompanyEntryDestinations({
          requestId,
          accountGeneration,
        });
      } catch {
        return {
          ok: false,
          requestId,
          accountGeneration,
          code: 'TEMPORARY_UNAVAILABLE',
          retryable: true,
        };
      }
    },

    async openAssignedDestination({ destination, requestId, accountGeneration, bridge = defaultBridge } = {}) {
      const target = bridge || defaultBridge;
      if (typeof target?.openAssignedCompanyDestination !== 'function') {
        return {
          ok: false,
          requestId,
          accountGeneration,
          code: 'HANDOFF_UNAVAILABLE',
          retryable: false,
        };
      }
      try {
        return await target.openAssignedCompanyDestination({
          destination,
          requestId,
          accountGeneration,
        });
      } catch {
        return {
          ok: false,
          requestId,
          accountGeneration,
          code: 'TEMPORARY_UNAVAILABLE',
          retryable: true,
        };
      }
    },
  };
}

export function mountDesktopPortalHost({
  root,
  hostElements = [],
  bridge = null,
  cryptoRef: customCryptoRef = null,
  getAuth = () => null,
  getReducedMotion = () => false,
  onStartSignIn,
  onStartSignUp,
  onCancelSignIn,
  onRetryAuth,
  onSwitchAccount,
  describePurposeTarget = () => ({ external: false }),
  onOpenPurposeTarget,
  onApplyHashRoute,
  onEnsureEnteredView,
  onActiveChange,
  companyBoundaries: customBoundaries = null,
  // 얼굴 공장(PC 클라이언트 1단계). 받지 않으면 지금 얼굴을 쓴다. faceOptions는 PC 쪽 옵션이고 호스트의 콜백을 덮지 못한다
  mountFace = mountPortalEntry,
  faceOptions = {},
} = {}) {
  if (!root) {
    return {
      isActive: () => false,
      shouldBlockShortcuts: () => false,
      syncAuth() {},
      syncReducedMotion() {},
      openPurposePicker: () => false,
      closePurposePicker: () => Promise.resolve(false),
      clientMode: () => 'off',
      isClientShown: () => false,
      dispose() {},
    };
  }

  const doc = root.ownerDocument || globalThis.document;
  const win = doc?.defaultView || globalThis.window;
  const hostCrypto = customCryptoRef || win?.crypto || globalThis.crypto;
  const hasBridge = Boolean(bridge);
  const defaults = createDefaultCompanyBoundaries(bridge);
  const customObj = customBoundaries && typeof customBoundaries === 'object' ? customBoundaries : {};
  const boundaries = {
    ...defaults,
    ...customObj,
    inspectBareInviteCode:
      customObj.inspectCompanyInviteCode
      || customObj.inspectBareInviteCode
      || defaults.inspectBareInviteCode,
    resolveAssignedDestination:
      customObj.resolveCompanyEntryDestinations
      || customObj.resolveAssignedDestination
      || defaults.resolveAssignedDestination,
    openAssignedDestination:
      customObj.openAssignedCompanyDestination
      || customObj.openAssignedDestination
      || defaults.openAssignedDestination,
  };

  const completedPurposeAccounts = new Set();
  const cancelledRequestIds = new Set();
  let disposed = false;
  let signInStarting = false;
  let portalSigningIn = false;
  let inviteFormGeneration = 0;
  let inviteInputRevision = 0;
  let inviteSubmissionSeq = 0;
  let inviteAttemptSeq = 0;
  let pendingInviteSubmission = null;
  let activeInviteAttempt = null;
  let lastSelectedPurposeId = null;
  let latestMainAuth = getAuth() || null;
  let confirmedSignedInBinding = null;
  let activeResolveRequest = null;
  let verifiedAssignmentRecord = null;
  let portal = null;

  function recordConfirmedSignedIn(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return;
    const key = verifiedPortalAccountKey(snapshot);
    if (key) {
      confirmedSignedInBinding = {
        accountKey: key,
        accountGeneration: readSnapshotAccountGeneration(snapshot),
        sessionGeneration: Number.isSafeInteger(snapshot.sessionGeneration)
          ? snapshot.sessionGeneration
          : null,
        purposePending: !completedPurposeAccounts.has(key) && snapshot.onboarding?.purpose === 'pending',
      };
      return;
    }
    if (
      snapshot.status === 'signed-out'
      || snapshot.status === 'unconfigured'
      || snapshot.status === 'signing-in'
      || snapshot.status === 'signing-out'
      || (snapshot.status === 'error' && snapshot.error?.retryable === false)
    ) {
      confirmedSignedInBinding = null;
    }
  }

  recordConfirmedSignedIn(latestMainAuth);

  const initialNormalized = normalizeDesktopPortalAuth(latestMainAuth, {
    hasBridge,
    reducedMotion: Boolean(getReducedMotion()),
  });

  async function readLiveAuth() {
    if (typeof bridge?.authStatus === 'function') {
      try {
        const snapshot = await bridge.authStatus();
        if (snapshot && typeof snapshot === 'object') {
          latestMainAuth = snapshot;
          recordConfirmedSignedIn(snapshot);
          return snapshot;
        }
      } catch {
        // IPC 일시 오류 시 마지막 호스트 스냅샷으로 비교한다.
      }
    }
    const fallback = getAuth();
    if (fallback && typeof fallback === 'object') {
      latestMainAuth = fallback;
      recordConfirmedSignedIn(fallback);
      return fallback;
    }
    return latestMainAuth;
  }

  function hasAccountDiverged(snapshot, expectedAccountId) {
    if (!expectedAccountId) return true;
    if (!snapshot || typeof snapshot !== 'object') return false;
    if (
      snapshot.status === 'signed-out'
      || snapshot.status === 'unconfigured'
      || snapshot.status === 'signing-in'
      || snapshot.status === 'signing-out'
    ) {
      return true;
    }
    if (snapshot.status === 'error' && snapshot.error?.retryable === false) {
      return true;
    }
    const liveKey = verifiedPortalAccountKey(snapshot);
    if (liveKey && liveKey !== expectedAccountId) {
      return true;
    }
    return false;
  }

  function buildAuthFence(snapshot, expectedAccountKey, minNumericGeneration = null) {
    if (!snapshot || typeof snapshot !== 'object' || !expectedAccountKey) return null;
    if (hasAccountDiverged(snapshot, expectedAccountKey)) return null;

    const liveKey = verifiedPortalAccountKey(snapshot);
    const liveUuid = readSnapshotAccountGeneration(snapshot);
    let resolvedUuid = liveUuid;

    if (liveKey !== expectedAccountKey) {
      const canPreserveSameAccountRefresh =
        (snapshot.status === 'restoring' || (snapshot.status === 'error' && snapshot.error?.retryable !== false))
        && confirmedSignedInBinding?.accountKey === expectedAccountKey;
      if (!canPreserveSameAccountRefresh) return null;
      if (
        confirmedSignedInBinding.accountGeneration
        && liveUuid
        && liveUuid !== confirmedSignedInBinding.accountGeneration
      ) {
        return null;
      }
      if (!resolvedUuid) {
        resolvedUuid = confirmedSignedInBinding.accountGeneration || null;
      }
    }

    const snapshotNumeric = Number.isSafeInteger(snapshot.sessionGeneration)
      ? snapshot.sessionGeneration
      : null;
    if (
      minNumericGeneration !== null
      && Number.isSafeInteger(minNumericGeneration)
      && snapshotNumeric !== null
      && snapshotNumeric < minNumericGeneration
    ) {
      return null;
    }
    const effectiveNumeric = snapshotNumeric !== null
      ? snapshotNumeric
      : (Number.isSafeInteger(minNumericGeneration) ? minNumericGeneration : null);
    return {
      accountKey: expectedAccountKey,
      accountGeneration: resolvedUuid,
      sessionGeneration: effectiveNumeric,
    };
  }

  function matchesAuthFence(snapshot, fence, { requireAccountGeneration = true } = {}) {
    if (!fence || !fence.accountKey) return false;
    if (!snapshot || typeof snapshot !== 'object') return false;
    if (hasAccountDiverged(snapshot, fence.accountKey)) return false;

    if (
      fence.sessionGeneration !== null
      && Number.isSafeInteger(snapshot.sessionGeneration)
      && snapshot.sessionGeneration < fence.sessionGeneration
    ) {
      return false;
    }

    const liveUuid = readSnapshotAccountGeneration(snapshot);
    if (requireAccountGeneration) {
      if (!fence.accountGeneration) return false;
      if (snapshot.status === 'restoring') {
        return liveUuid === null || liveUuid === fence.accountGeneration;
      }
      return liveUuid === fence.accountGeneration;
    }

    if (fence.accountGeneration && liveUuid && liveUuid !== fence.accountGeneration) {
      return false;
    }
    return true;
  }

  function resolveConfirmedInviteAuth(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') {
      return { ok: false, code: 'HANDOFF_UNAVAILABLE' };
    }
    if (
      snapshot.status === 'restoring'
      || snapshot.status === 'loading'
      || snapshot.status === 'signing-in'
      || snapshot.status === 'signing-out'
    ) {
      return { ok: false, code: 'AUTH_PENDING' };
    }
    if (snapshot.status === 'unconfigured' || snapshot.configured === false) {
      return { ok: false, code: 'HANDOFF_UNAVAILABLE' };
    }
    const accountGeneration = readSnapshotAccountGeneration(snapshot);
    const sessionGeneration = Number.isSafeInteger(snapshot.sessionGeneration)
      ? snapshot.sessionGeneration
      : null;

    if (snapshot.status === 'signed-in' && snapshot.signedIn === true) {
      const accountKey = verifiedPortalAccountKey(snapshot);
      if (!accountKey || !accountGeneration) {
        return { ok: false, code: 'HANDOFF_UNAVAILABLE' };
      }
      return {
        ok: true,
        mode: 'signed-in',
        accountKey,
        accountGeneration,
        sessionGeneration,
      };
    }

    if (snapshot.status === 'signed-out' && snapshot.signedIn !== true) {
      if (!accountGeneration) {
        return { ok: false, code: 'HANDOFF_UNAVAILABLE' };
      }
      return {
        ok: true,
        mode: 'signed-out',
        accountKey: null,
        accountGeneration,
        sessionGeneration,
      };
    }

    return { ok: false, code: 'AUTH_PENDING' };
  }

  function matchesInviteAuthAfterAwait(snapshot, inviteAuth) {
    if (!snapshot || typeof snapshot !== 'object' || !inviteAuth?.ok) return false;
    if (
      inviteAuth.sessionGeneration !== null
      && Number.isSafeInteger(snapshot.sessionGeneration)
      && snapshot.sessionGeneration < inviteAuth.sessionGeneration
    ) {
      return false;
    }
    const liveUuid = readSnapshotAccountGeneration(snapshot);
    if (inviteAuth.mode === 'signed-in') {
      return matchesAuthFence(
        snapshot,
        {
          accountKey: inviteAuth.accountKey,
          accountGeneration: inviteAuth.accountGeneration,
          sessionGeneration: inviteAuth.sessionGeneration,
        },
        { requireAccountGeneration: true },
      );
    }
    return (
      snapshot.status === 'signed-out'
      && snapshot.signedIn !== true
      && liveUuid === inviteAuth.accountGeneration
    );
  }

  function invalidatePendingInviteSubmission() {
    if (!pendingInviteSubmission) return;
    pendingInviteSubmission.invalidated = true;
    pendingInviteSubmission.rawValue = '';
    pendingInviteSubmission = null;
  }

  function invalidateInviteFormSession() {
    inviteFormGeneration += 1;
    invalidatePendingInviteSubmission();
  }

  function cancelActiveInvite() {
    invalidateInviteFormSession();
    if (!activeInviteAttempt) return;
    const targetAttempt = activeInviteAttempt;
    activeInviteAttempt = null;
    targetAttempt.cancelled = true;
    targetAttempt.submittedRaw = '';
    if (targetAttempt.requestId) {
      cancelledRequestIds.add(targetAttempt.requestId);
    }
    if (targetAttempt.boundaryInFlight && targetAttempt.requestId && targetAttempt.accountGeneration) {
      targetAttempt.boundaryInFlight = false;
      void Promise.resolve(
        boundaries.cancelCompanyEntry({
          requestId: targetAttempt.requestId,
          accountGeneration: targetAttempt.accountGeneration,
          bridge,
        }),
      ).catch(() => {});
    }
  }

  function cancelActiveResolve() {
    if (!activeResolveRequest) return;
    const targetReq = activeResolveRequest;
    activeResolveRequest = null;
    cancelledRequestIds.add(targetReq.requestId);
    if (targetReq.requestId && targetReq.accountGeneration) {
      void Promise.resolve(
        boundaries.cancelCompanyEntry({
          requestId: targetReq.requestId,
          accountGeneration: targetReq.accountGeneration,
          bridge,
        }),
      ).catch(() => {});
    }
  }

  function invalidateAllCompanyFlows() {
    verifiedAssignmentRecord = null;
    cancelActiveInvite();
    cancelActiveResolve();
  }

  function markPurposeCompletedLocal(targetAccountId) {
    if (!targetAccountId) return;
    completedPurposeAccounts.add(targetAccountId);
    if (confirmedSignedInBinding?.accountKey === targetAccountId) {
      confirmedSignedInBinding.purposePending = false;
    }
  }

  function isPurposePendingForAccount(snapshot, accountKey) {
    if (!accountKey || completedPurposeAccounts.has(accountKey)) return false;
    const normalized = normalizeDesktopPortalAuth(snapshot, { hasBridge });
    return normalized.accountKey === accountKey && normalized.onboarding.purpose === 'pending';
  }

  function shouldCompletePurposeForAccount(snapshot, accountKey) {
    if (!accountKey || completedPurposeAccounts.has(accountKey)) return false;
    if (isPurposePendingForAccount(snapshot, accountKey)) return true;
    const liveKey = verifiedPortalAccountKey(snapshot);
    if (liveKey === accountKey) return false;
    const hostSnapshot = getAuth();
    if (isPurposePendingForAccount(hostSnapshot, accountKey)) return true;
    if (verifiedPortalAccountKey(hostSnapshot) === accountKey) return false;
    if (
      confirmedSignedInBinding?.accountKey === accountKey
      && !hasAccountDiverged(snapshot, accountKey)
    ) {
      return confirmedSignedInBinding.purposePending === true;
    }
    return false;
  }

  function resolveDesktopEnteringPurposeMode(snapshot, accountKey) {
    return shouldCompletePurposeForAccount(snapshot, accountKey)
      ? 'onboarding'
      : 'existing';
  }

  async function completePurposeForAccount(
    outcome,
    expectedAccountId,
    fence = null,
    { preAuth: providedPreAuth = undefined } = {},
  ) {
    if (!PURPOSE_ONBOARDING_OUTCOMES.includes(outcome) || typeof expectedAccountId !== 'string' || !expectedAccountId.trim()) {
      return {
        ok: false,
        code: 'INVALID_REQUEST',
        message: '계정 연결 상태를 확인하지 못했어요. 다시 시도해 주세요.',
      };
    }

    const targetAccountId = expectedAccountId.trim();
    const preAuth = providedPreAuth !== undefined ? providedPreAuth : await readLiveAuth();
    if (fence) {
      if (
        !matchesAuthFence(preAuth, fence, {
          requireAccountGeneration: Boolean(fence.accountGeneration),
        })
      ) {
        return {
          ok: false,
          code: 'ACCOUNT_CHANGED',
          message: '계정 연결이 바뀌었어요. 다시 확인해 주세요.',
        };
      }
    } else if (hasAccountDiverged(preAuth, targetAccountId)) {
      return {
        ok: false,
        code: 'ACCOUNT_CHANGED',
        message: '계정 연결이 바뀌었어요. 다시 확인해 주세요.',
      };
    }

    if (typeof bridge?.accountRequest !== 'function') {
      markPurposeCompletedLocal(targetAccountId);
      return { ok: true };
    }

    let result;
    try {
      result = await bridge.accountRequest('completePurposeOnboarding', {
        outcome,
        expectedAccountId: targetAccountId,
      });
    } catch {
      // 네트워크나 일시 전송 오류는 입장을 막지 않는다.
      markPurposeCompletedLocal(targetAccountId);
      return { ok: true };
    }

    if (result?.ok === true) {
      markPurposeCompletedLocal(targetAccountId);
      return { ok: true };
    }

    const errorCode = result?.error?.code || result?.code || '';
    if (errorCode === 'AUTH_CHANGED' || errorCode === 'SESSION_REVOKED' || errorCode === 'AUTH_REQUIRED') {
      const latestAuth = await readLiveAuth();
      const stillMatches = fence
        ? matchesAuthFence(latestAuth, fence, {
            requireAccountGeneration: Boolean(fence.accountGeneration),
          })
        : verifiedPortalAccountKey(latestAuth) === targetAccountId;
      if (stillMatches) {
        markPurposeCompletedLocal(targetAccountId);
        return { ok: true };
      }
      return {
        ok: false,
        code: 'ACCOUNT_CHANGED',
        message: '계정 연결이 바뀌었어요. 다시 확인해 주세요.',
      };
    }

    // 일반 서버/네트워크 오류는 최선 노력 완료로 처리해 입장을 막지 않는다.
    markPurposeCompletedLocal(targetAccountId);
    return { ok: true };
  }

  async function settleEnteringPurposeIfNeeded(outcome, expectedAccountId, fence = null) {
    if (!PURPOSE_ONBOARDING_OUTCOMES.includes(outcome) || typeof expectedAccountId !== 'string' || !expectedAccountId.trim()) {
      return {
        ok: false,
        code: 'INVALID_REQUEST',
        message: '계정 연결 상태를 확인하지 못했어요. 다시 시도해 주세요.',
      };
    }

    const targetAccountId = expectedAccountId.trim();
    const preAuth = await readLiveAuth();
    if (fence) {
      if (
        !matchesAuthFence(preAuth, fence, {
          requireAccountGeneration: Boolean(fence.accountGeneration),
        })
      ) {
        return {
          ok: false,
          code: 'ACCOUNT_CHANGED',
          message: '계정 연결이 바뀌었어요. 다시 확인해 주세요.',
        };
      }
    } else if (hasAccountDiverged(preAuth, targetAccountId)) {
      return {
        ok: false,
        code: 'ACCOUNT_CHANGED',
        message: '계정 연결이 바뀌었어요. 다시 확인해 주세요.',
      };
    }

    if (!shouldCompletePurposeForAccount(preAuth, targetAccountId)) {
      return { ok: true, persisted: false };
    }

    return completePurposeForAccount(outcome, targetAccountId, fence, { preAuth });
  }

  function showAuthFeedback(message) {
    if (disposed || !message) return;
    // 새 얼굴(PC 클라이언트 1단계)은 알림 글을 장면 값으로 그린다. 칸에 직접 쓰면 다음 그리기에서 지워지므로 얼굴에 넘긴다
    if (typeof portal?.showAuthFeedback === 'function') { portal.showAuthFeedback(message); return; }
    const feedbackEl = root.querySelector('[data-portal-auth-feedback], #portal-auth-feedback');
    if (!feedbackEl) return;
    feedbackEl.textContent = message;
    feedbackEl.hidden = false;
  }

  function isInviteAttemptOwned(attempt) {
    return Boolean(
      !disposed
      && attempt
      && !attempt.cancelled
      && !attempt.invalidated
      && activeInviteAttempt === attempt
      && (!attempt.requestId || !cancelledRequestIds.has(attempt.requestId)),
    );
  }

  function isInviteAttemptCurrentSession(attempt) {
    if (!isInviteAttemptOwned(attempt)) return false;
    if (attempt.formGeneration !== inviteFormGeneration) return false;
    if (portal && portal.getState().phase !== 'invite') return false;
    if (root.dataset.portalState !== 'invite') return false;
    return true;
  }

  function canRestoreInviteInputForAttempt(attempt) {
    if (!isInviteAttemptCurrentSession(attempt)) return false;
    if (attempt.inputRevision !== inviteInputRevision) return false;
    const inviteInput = root.querySelector('#portal-invite-input');
    if (!inviteInput) return false;
    const currentValue = inviteInput.value;
    return (
      currentValue === ''
      || currentValue === attempt.submittedRaw
      || currentValue === attempt.validatedValue
    );
  }

  function restoreInviteInputForAttempt(attempt) {
    if (!canRestoreInviteInputForAttempt(attempt)) return;
    const inviteInput = root.querySelector('#portal-invite-input');
    if (!inviteInput) return;
    const preserved = attempt.submittedRaw.trim()
      ? attempt.submittedRaw
      : attempt.validatedValue;
    if (preserved && inviteInput.value !== preserved) {
      inviteInput.value = preserved;
    }
  }

  function clearInviteInputForAttempt(attempt) {
    const canClear = canRestoreInviteInputForAttempt(attempt);
    attempt.submittedRaw = '';
    if (!canClear) return;
    const inviteInput = root.querySelector('#portal-invite-input');
    if (inviteInput && inviteInput.value !== '') {
      inviteInput.value = '';
    }
  }

  function clearAllInviteInputState() {
    invalidateInviteFormSession();
    if (activeInviteAttempt) {
      activeInviteAttempt.submittedRaw = '';
    }
    const inviteInput = root.querySelector('#portal-invite-input');
    if (inviteInput && inviteInput.value !== '') {
      inviteInput.value = '';
    }
  }

  function syncSelectedPurposeMarker(purposeId) {
    lastSelectedPurposeId = purposeId || null;
    for (const btn of root.querySelectorAll('[data-portal-purpose]')) {
      if (purposeId && btn.dataset.portalPurpose === purposeId) {
        btn.dataset.portalSelected = 'true';
      } else {
        delete btn.dataset.portalSelected;
      }
    }
  }

  function restoreFailedPurposeFocus(purposeId) {
    syncSelectedPurposeMarker(purposeId);
    queueMicrotask(() => {
      if (disposed || !portal || portal.getState().phase !== 'purpose') return;
      const targetBtn = purposeId
        ? root.querySelector(`[data-portal-purpose="${purposeId}"]`)
        : null;
      if (targetBtn && !targetBtn.disabled) {
        targetBtn.focus?.({ preventScroll: true });
      }
    });
  }

  function mapAssignmentResultToWorkspace(res) {
    if (res.status === 'resolved' && res.unavailable.length === 0) {
      return {
        status: 'resolved',
        destinations: [...res.destinations],
        unavailable: [],
        canSwitchAccount: true,
        canContinuePersonal: true,
      };
    }
    if (res.status === 'partial' || (res.status === 'resolved' && res.unavailable.length > 0)) {
      return {
        status: 'partial',
        destinations: [...res.destinations],
        unavailable: [...res.unavailable],
        canSwitchAccount: true,
        canContinuePersonal: true,
      };
    }
    if (res.status === 'login_required') {
      return {
        status: 'login_required',
        destinations: [],
        unavailable: [...res.unavailable],
        message: '회사 작업 공간에 들어가려면 추가 로그인이 필요해요. 로그인을 마친 뒤 작업 공간 다시 확인을 눌러 주세요.',
        canSwitchAccount: true,
        canContinuePersonal: true,
      };
    }
    if (res.status === 'account_mismatch') {
      return {
        status: 'account_mismatch',
        destinations: [],
        unavailable: [...res.unavailable],
        canSwitchAccount: true,
        canContinuePersonal: true,
      };
    }
    return {
      status: 'unavailable',
      destinations: [],
      unavailable: [...res.unavailable],
      canSwitchAccount: true,
      canContinuePersonal: true,
    };
  }

  async function openVerifiedCompanyDestination(destination, expectedAccountKey, minNumericGeneration = null) {
    const normalizedDest = normalizePortalWorkspaceDestination(destination);
    if (!normalizedDest) {
      return {
        ok: false,
        code: 'INVALID_INPUT',
        message: '선택한 작업 공간을 찾지 못했어요. 다시 선택해 주세요.',
      };
    }

    const record = verifiedAssignmentRecord;
    if (
      !record
      || !record.destinations.includes(normalizedDest)
      || record.fence?.accountKey !== expectedAccountKey
    ) {
      return {
        ok: false,
        code: 'HANDOFF_UNAVAILABLE',
        message: '작업 공간 확인 정보가 만료되었어요. 아래 작업 공간 다시 확인을 눌러 주세요.',
      };
    }

    const preOpenAuth = await readLiveAuth();
    if (
      !matchesAuthFence(preOpenAuth, record.fence, { requireAccountGeneration: true })
      || (
        minNumericGeneration !== null
        && Number.isSafeInteger(minNumericGeneration)
        && Number.isSafeInteger(preOpenAuth?.sessionGeneration)
        && preOpenAuth.sessionGeneration < minNumericGeneration
      )
    ) {
      verifiedAssignmentRecord = null;
      return {
        ok: false,
        code: 'ACCOUNT_CHANGED',
        message: '계정 연결이 바뀌었어요. 다시 확인해 주세요.',
      };
    }

    const opened = await boundaries.openAssignedDestination({
      destination: normalizedDest,
      requestId: record.requestId,
      accountGeneration: record.accountGeneration,
      bridge,
    });

    const postOpenAuth = await readLiveAuth();
    if (!matchesAuthFence(postOpenAuth, record.fence, { requireAccountGeneration: true })) {
      verifiedAssignmentRecord = null;
      return {
        ok: false,
        code: 'ACCOUNT_CHANGED',
        message: '계정 연결이 바뀌었어요. 다시 확인해 주세요.',
      };
    }

    const validOpenAck = isPlainObject(opened)
      && opened.ok === true
      && (opened.requestId === undefined || opened.requestId === record.requestId)
      && (opened.accountGeneration === undefined || opened.accountGeneration === record.accountGeneration)
      && (opened.destination === undefined || opened.destination === normalizedDest);

    if (!validOpenAck) {
      const errCode = opened?.code || 'HANDOFF_UNAVAILABLE';
      if (errCode === 'ACCOUNT_CHANGED' || errCode === 'PULSE_APP_ACCOUNT_CHANGED') {
        verifiedAssignmentRecord = null;
        return {
          ok: false,
          code: 'ACCOUNT_CHANGED',
          message: '계정 연결이 바뀌었어요. 다시 확인해 주세요.',
        };
      }
      if (errCode === 'ACCOUNT_MISMATCH' || errCode === 'account_mismatch') {
        verifiedAssignmentRecord = null;
        return {
          ok: false,
          code: 'ACCOUNT_MISMATCH',
          message: '열린 작업 공간의 계정과 현재 로그인한 계정이 달라요. 계정을 맞춘 뒤 다시 확인해 주세요.',
          workspace: {
            status: 'account_mismatch',
            destinations: [],
            unavailable: [],
            canSwitchAccount: true,
            canContinuePersonal: true,
          },
        };
      }
      if (
        errCode === 'INVALID_INPUT'
        || errCode === 'HANDOFF_TIMEOUT'
        || errCode === 'CANCELLED'
      ) {
        verifiedAssignmentRecord = null;
      }
      return {
        ok: false,
        code: errCode,
        message: desktopOpenDestinationErrorMessage(errCode),
      };
    }

    if (shouldCompletePurposeForAccount(postOpenAuth, expectedAccountKey)) {
      const marked = await completePurposeForAccount('not-asked', expectedAccountKey, record.fence);
      if (marked.ok === false) return marked;
    }

    return {
      ok: true,
      destination: normalizedDest,
    };
  }

  async function executeDesktopAssignmentFlow({ accountKey, generation, openSingle = true }) {
    const liveAuth = await readLiveAuth();
    if (hasAccountDiverged(liveAuth, accountKey)) {
      return {
        ok: false,
        code: 'ACCOUNT_CHANGED',
        message: '계정 연결이 바뀌었어요. 다시 확인해 주세요.',
      };
    }

    const hasCustomResolver = typeof customBoundaries?.resolveAssignedDestination === 'function';
    const fence = buildAuthFence(liveAuth, accountKey, generation);
    if (!fence) {
      return {
        ok: false,
        code: 'ACCOUNT_CHANGED',
        message: '계정 연결이 바뀌었어요. 다시 확인해 주세요.',
      };
    }

    if (!fence.accountGeneration && !hasCustomResolver) {
      verifiedAssignmentRecord = null;
      return {
        ok: true,
        action: 'workspace',
        workspace: mapDesktopResolveErrorToWorkspace('HANDOFF_UNAVAILABLE'),
      };
    }

    const requestId = createRequestId(hostCrypto);
    if (!requestId) {
      verifiedAssignmentRecord = null;
      return {
        ok: true,
        action: 'workspace',
        workspace: mapDesktopResolveErrorToWorkspace('HANDOFF_UNAVAILABLE'),
      };
    }

    cancelActiveResolve();
    verifiedAssignmentRecord = null;
    activeResolveRequest = {
      requestId,
      accountGeneration: fence.accountGeneration,
      fence,
    };

    let assigned;
    try {
      assigned = await boundaries.resolveAssignedDestination({
        requestId,
        accountGeneration: fence.accountGeneration,
        auth: liveAuth,
        accountKey,
        bridge,
      });
    } finally {
      if (activeResolveRequest?.requestId === requestId) {
        activeResolveRequest = null;
      }
    }

    if (disposed || cancelledRequestIds.has(requestId)) {
      return {
        ok: false,
        code: 'ACCOUNT_CHANGED',
        message: '계정 연결이 바뀌었어요. 다시 확인해 주세요.',
      };
    }

    const postResolveAuth = await readLiveAuth();
    if (
      !matchesAuthFence(postResolveAuth, fence, {
        requireAccountGeneration: !hasCustomResolver || Boolean(fence.accountGeneration),
      })
    ) {
      return {
        ok: false,
        code: 'ACCOUNT_CHANGED',
        message: '계정 연결이 바뀌었어요. 다시 확인해 주세요.',
      };
    }

    // 기존 테스트용 customBoundaries 반환 형태도 함께 지원한다.
    if (hasCustomResolver && assigned && assigned.kind === 'none') {
      const purposeMode = resolveDesktopEnteringPurposeMode(postResolveAuth, accountKey);
      if (purposeMode === 'onboarding') {
        onApplyHashRoute?.();
      }
      return { ok: true, action: 'purpose', purposeMode };
    }

    if (hasCustomResolver && assigned && assigned.kind === 'destination' && typeof assigned.open === 'function') {
      const opened = await assigned.open();
      if (opened?.ok === false) {
        return {
          ok: false,
          code: opened.code || 'ASSIGNED_OPEN_FAILED',
          message: opened.message || '배정된 작업 공간을 불러오지 못했어요. 다시 시도해 주세요.',
        };
      }
      const afterCustomOpenAuth = await readLiveAuth();
      if (
        !matchesAuthFence(afterCustomOpenAuth, fence, {
          requireAccountGeneration: Boolean(fence.accountGeneration),
        })
      ) {
        return {
          ok: false,
          code: 'ACCOUNT_CHANGED',
          message: '계정 연결이 바뀌었어요. 다시 확인해 주세요.',
        };
      }
      if (shouldCompletePurposeForAccount(afterCustomOpenAuth, accountKey)) {
        const marked = await completePurposeForAccount('not-asked', accountKey, fence);
        if (marked.ok === false) return marked;
      }
      return { ok: true };
    }

    if (!isPlainObject(assigned) || assigned.ok === false) {
      const errCode = assigned?.code || 'TEMPORARY_UNAVAILABLE';
      if (errCode === 'ACCOUNT_CHANGED' || errCode === 'PULSE_APP_ACCOUNT_CHANGED') {
        return {
          ok: false,
          code: 'ACCOUNT_CHANGED',
          message: '계정 연결이 바뀌었어요. 다시 확인해 주세요.',
        };
      }
      return {
        ok: true,
        action: 'workspace',
        workspace: mapDesktopResolveErrorToWorkspace(errCode),
      };
    }

    if (
      assigned.ok !== true
      || assigned.requestId !== requestId
      || assigned.accountGeneration !== fence.accountGeneration
    ) {
      return {
        ok: true,
        action: 'workspace',
        workspace: mapDesktopResolveErrorToWorkspace('HANDOFF_UNAVAILABLE'),
      };
    }

    const parsedResult = parseVerifiedAssignmentResult(assigned.result);
    if (!parsedResult) {
      return {
        ok: true,
        action: 'workspace',
        workspace: mapDesktopResolveErrorToWorkspace('HANDOFF_UNAVAILABLE'),
      };
    }

    const canOpenKnownDestinations =
      ((parsedResult.status === 'resolved' && parsedResult.unavailable.length === 0)
        || parsedResult.status === 'partial')
      && parsedResult.destinations.length > 0;

    if (canOpenKnownDestinations) {
      verifiedAssignmentRecord = {
        requestId: assigned.requestId,
        accountGeneration: assigned.accountGeneration,
        fence,
        status: parsedResult.status,
        destinations: [...parsedResult.destinations],
      };
    } else {
      verifiedAssignmentRecord = null;
    }

    if (parsedResult.status === 'resolved' && parsedResult.unavailable.length === 0) {
      if (parsedResult.destinations.length === 0) {
        const purposeMode = resolveDesktopEnteringPurposeMode(postResolveAuth, accountKey);
        if (purposeMode === 'onboarding') {
          onApplyHashRoute?.();
        }
        return { ok: true, action: 'purpose', purposeMode };
      }

      if (parsedResult.destinations.length === 1 && openSingle !== false) {
        const singleDest = parsedResult.destinations[0];
        const opened = await openVerifiedCompanyDestination(singleDest, accountKey, generation);
        if (opened.ok === true) {
          // 새 얼굴은 이 값으로 구가 들어갈 자리를 정한다. 지금 얼굴은 모르는 칸을 읽지 않는다
          return { ok: true, destination: opened.destination || singleDest, destinations: [singleDest] };
        }
        if (opened.code === 'ACCOUNT_CHANGED') {
          return opened;
        }
        if (opened.workspace) {
          return {
            ok: true,
            action: 'workspace',
            workspace: opened.workspace,
          };
        }
        return {
          ok: true,
          action: 'workspace',
          workspace: {
            status: 'unavailable',
            destinations: verifiedAssignmentRecord ? [...verifiedAssignmentRecord.destinations] : [],
            unavailable: [],
            message: opened.message || desktopOpenDestinationErrorMessage(opened.code),
            canSwitchAccount: true,
            canContinuePersonal: true,
          },
        };
      }
    }

    return {
      ok: true,
      action: 'workspace',
      workspace: mapAssignmentResultToWorkspace(parsedResult),
    };
  }

  portal = mountFace(root, {
    ...(faceOptions && typeof faceOptions === 'object' ? faceOptions : {}),
    hostElements,
    initialState: {
      status: initialNormalized.status,
      generation: initialNormalized.generation,
      ...(Object.hasOwn(initialNormalized, 'accountKey') ? { accountKey: initialNormalized.accountKey } : {}),
      errorMessage: initialNormalized.errorMessage,
      retryable: initialNormalized.retryable,
    },
    getReducedMotion: () => Boolean(getReducedMotion()),
    signingInMessage: '열린 브라우저의 SYNK ID 화면에서 Google 또는 이메일로 로그인한 뒤 연결하기를 눌러 주세요.',

    onActiveChange(active, detail) {
      if (!active || detail?.phase !== 'invite') {
        invalidateInviteFormSession();
        if (activeInviteAttempt) {
          cancelActiveInvite();
        }
      } else {
        invalidateInviteFormSession();
      }
      if (!active || detail?.phase !== 'purpose') {
        syncSelectedPurposeMarker(null);
      }
      onActiveChange?.(active, detail);
    },

    async onSignIn() {
      invalidateAllCompanyFlows();
      signInStarting = true;
      portalSigningIn = true;
      try {
        const result = await onStartSignIn?.();
        if (result?.ok === false) {
          portalSigningIn = false;
          const message = result.message || '로그인을 시작하지 못했어요. 다시 시도해 주세요.';
          queueMicrotask(() => {
            if (!disposed && portal.getState().phase === 'auth' && result.code !== 'AUTH_CANCELLED') {
              showAuthFeedback(message);
            }
          });
          return result;
        }
        return { ok: true };
      } finally {
        signInStarting = false;
      }
    },

    async onSignUp() {
      if (typeof onStartSignUp === 'function') {
        return onStartSignUp();
      }
      if (typeof bridge?.authSignUp !== 'function') {
        return { ok: false, message: signUpErrorMessage('AUTH_SIGNUP_UNAVAILABLE') };
      }
      try {
        const result = await bridge.authSignUp();
        if (result?.ok === true) return { ok: true };
        return { ok: false, code: result?.code, message: signUpErrorMessage(result?.code) };
      } catch {
        return { ok: false, code: 'AUTH_SIGNUP_OPEN_FAILED', message: signUpErrorMessage('AUTH_SIGNUP_OPEN_FAILED') };
      }
    },

    async onCancelSignIn() {
      portalSigningIn = false;
      invalidateAllCompanyFlows();
      await onCancelSignIn?.();
    },

    async onRetry() {
      return onRetryAuth?.();
    },

    async onSwitchAccount() {
      invalidateAllCompanyFlows();
      await onSwitchAccount?.();
    },

    async onBrowse() {
      return { ok: true, action: 'purpose' };
    },

    async onEnter({ accountKey, generation }) {
      return executeDesktopAssignmentFlow({ accountKey, generation });
    },

    async onRetryWorkspace(context) {
      return executeDesktopAssignmentFlow({
        accountKey: context?.accountKey,
        generation: context?.generation,
      });
    },

    async onSelectWorkspace(destination, context) {
      return openVerifiedCompanyDestination(
        destination,
        context?.accountKey,
        context?.generation,
      );
    },

    // 새 얼굴(PC 클라이언트 1단계): 고르기 화면 없이 솔리오로 간다. 온보딩이 남은 계정이면 not-asked를 남긴다(설계 7절)
    async onEnterDefault(context) {
      const liveAuth = await readLiveAuth();
      const fence = buildAuthFence(liveAuth, context?.accountKey, context?.generation);
      if (
        !fence
        || !matchesAuthFence(liveAuth, fence, {
          requireAccountGeneration: Boolean(fence.accountGeneration),
        })
      ) {
        return {
          ok: false,
          code: 'ACCOUNT_CHANGED',
          message: '계정 연결이 바뀌었어요. 다시 확인해 주세요.',
        };
      }
      if (context?.purposeMode !== 'existing') {
        const completed = await settleEnteringPurposeIfNeeded('not-asked', context.accountKey, fence);
        if (completed.ok === false) return completed;
      }
      const navigated = await onOpenPurposeTarget?.('solio', context);
      if (navigated?.ok === false) {
        return {
          ok: false,
          code: navigated.code || 'PURPOSE_LAUNCH_FAILED',
          message: navigated.message || '솔리오를 열지 못했어요. 다시 시도해 주세요.',
        };
      }
      verifiedAssignmentRecord = null;
      return { ok: true };
    },

    // 새 얼굴: 들어온 뒤 공간 고르기에서 배정된 공간을 다시 연다. 새 네트워크 길 없이 지금의 배정 조회와 열기만 쓴다(설계 4 · 14절)
    async onOpenSpace(destination, context) {
      const dest = normalizePortalWorkspaceDestination(destination);
      if (!dest) {
        return { ok: false, code: 'INVALID_INPUT', message: '선택한 작업 공간을 찾지 못했어요. 다시 선택해 주세요.' };
      }
      const accountKey = context?.accountKey;
      const generation = context?.generation ?? null;
      const recordLive = () => Boolean(
        verifiedAssignmentRecord
        && verifiedAssignmentRecord.destinations.includes(dest)
        && verifiedAssignmentRecord.fence?.accountKey === accountKey,
      );
      if (!recordLive()) {
        // 확인 기록이 만료됐으면 배정을 한 번 다시 조회한다. 이때는 열지 않는다
        const refreshed = await executeDesktopAssignmentFlow({ accountKey, generation, openSingle: false });
        if (refreshed?.ok === false) return refreshed;
        if (!recordLive()) {
          return { ok: false, code: 'NOT_ASSIGNED', message: '지금 계정에 확인된 공간이 아닙니다. 잠시 뒤 다시 시도해 주세요.' };
        }
      }
      const opened = await openVerifiedCompanyDestination(dest, accountKey, generation);
      if (opened.ok === true) return { ok: true, destination: opened.destination || dest };
      return {
        ok: false,
        code: opened.code || 'HANDOFF_UNAVAILABLE',
        message: opened.message || desktopOpenDestinationErrorMessage(opened.code),
      };
    },

    async onContinuePersonal(context) {
      const accountKey = context?.accountKey;
      cancelActiveResolve();

      const liveAuth = await readLiveAuth();
      const fence = buildAuthFence(liveAuth, accountKey, context?.generation);
      if (
        !fence
        || !matchesAuthFence(liveAuth, fence, {
          requireAccountGeneration: Boolean(fence.accountGeneration),
        })
      ) {
        verifiedAssignmentRecord = null;
        return {
          ok: false,
          code: 'ACCOUNT_CHANGED',
          message: '계정 연결이 바뀌었어요. 다시 확인해 주세요.',
        };
      }

      const purposeMode = resolveDesktopEnteringPurposeMode(liveAuth, accountKey);
      if (purposeMode === 'existing') {
        if (
          verifiedAssignmentRecord
          && (
            verifiedAssignmentRecord.fence?.accountKey !== accountKey
            || !matchesAuthFence(liveAuth, verifiedAssignmentRecord.fence, {
              requireAccountGeneration: true,
            })
          )
        ) {
          verifiedAssignmentRecord = null;
        }
      } else {
        verifiedAssignmentRecord = null;
        onApplyHashRoute?.();
      }

      return { ok: true, action: 'purpose', purposeMode };
    },

    onCancelInvite() {
      cancelActiveInvite();
    },

    async onSelectPurpose(purposeId, context) {
      syncSelectedPurposeMarker(purposeId);
      const failPurpose = payload => {
        restoreFailedPurposeFocus(purposeId);
        return payload;
      };
      const isEntering = context?.origin === 'entering';
      const isExistingEntering = isEntering && context?.purposeMode === 'existing';
      let enteringFence = null;
      if (isEntering) {
        const liveAuth = await readLiveAuth();
        enteringFence = buildAuthFence(liveAuth, context.accountKey, context.generation);
        if (
          !enteringFence
          || !matchesAuthFence(liveAuth, enteringFence, {
            requireAccountGeneration: Boolean(enteringFence.accountGeneration),
          })
        ) {
          return failPurpose({
            ok: false,
            code: 'ACCOUNT_CHANGED',
            message: '계정 연결이 바뀌었어요. 다시 확인해 주세요.',
          });
        }
        if (isExistingEntering && purposeId === 'home') {
          return failPurpose({
            ok: false,
            code: 'UNKNOWN_PURPOSE',
            message: '선택한 화면을 찾지 못했어요. 다시 선택해 주세요.',
          });
        }
      }

      const verifyExistingEnteringFence = async () => {
        const afterAuth = await readLiveAuth();
        if (
          !enteringFence
          || !matchesAuthFence(afterAuth, enteringFence, {
            requireAccountGeneration: Boolean(enteringFence.accountGeneration),
          })
        ) {
          return {
            ok: false,
            code: 'ACCOUNT_CHANGED',
            message: '계정 연결이 바뀌었어요. 다시 확인해 주세요.',
          };
        }
        return { ok: true };
      };

      if (purposeId === 'shift') {
        if (typeof bridge?.openPortalPurpose !== 'function') {
          return failPurpose({
            ok: false,
            code: 'PORTAL_PURPOSE_UNAVAILABLE',
            message: shiftPurposeErrorMessage('PORTAL_PURPOSE_UNAVAILABLE'),
          });
        }
        let openResult;
        try {
          openResult = await bridge.openPortalPurpose('shift');
        } catch {
          openResult = { ok: false, code: 'PORTAL_PURPOSE_OPEN_FAILED' };
        }
        if (openResult?.ok !== true) {
          return failPurpose({
            ok: false,
            code: openResult?.code || 'PORTAL_PURPOSE_OPEN_FAILED',
            message: shiftPurposeErrorMessage(openResult?.code),
          });
        }
        if (isEntering) {
          const completed = isExistingEntering
            ? await verifyExistingEnteringFence()
            : await settleEnteringPurposeIfNeeded('chosen', context.accountKey, enteringFence);
          if (completed.ok === false) return failPurpose(completed);
          verifiedAssignmentRecord = null;
        }
        syncSelectedPurposeMarker(null);
        onEnsureEnteredView?.();
        return { ok: true };
      }

      const targetMeta = describePurposeTarget(purposeId) || { external: false };
      if (targetMeta.external) {
        const launched = await onOpenPurposeTarget?.(purposeId, context);
        if (launched?.ok === false) {
          return failPurpose({
            ok: false,
            code: launched.code || 'PURPOSE_LAUNCH_FAILED',
            message: launched.message || '선택한 화면을 열지 못했어요. 다시 시도해 주세요.',
          });
        }
        if (isEntering) {
          const completed = isExistingEntering
            ? await verifyExistingEnteringFence()
            : await settleEnteringPurposeIfNeeded('chosen', context.accountKey, enteringFence);
          if (completed.ok === false) return failPurpose(completed);
          verifiedAssignmentRecord = null;
        }
        syncSelectedPurposeMarker(null);
        onEnsureEnteredView?.();
        return { ok: true };
      }

      if (isEntering) {
        const completed = isExistingEntering
          ? await verifyExistingEnteringFence()
          : await settleEnteringPurposeIfNeeded('chosen', context.accountKey, enteringFence);
        if (completed.ok === false) return failPurpose(completed);
      }

      const navigated = await onOpenPurposeTarget?.(purposeId, context);
      if (navigated?.ok === false) {
        return failPurpose({
          ok: false,
          code: navigated.code || 'PURPOSE_LAUNCH_FAILED',
          message: navigated.message || '선택한 화면을 열지 못했어요. 다시 시도해 주세요.',
        });
      }
      if (isEntering) {
        verifiedAssignmentRecord = null;
      }
      syncSelectedPurposeMarker(null);
      return { ok: true };
    },

    async onDismissPurpose(context) {
      if (context?.origin !== 'entering') {
        return { ok: true };
      }
      const liveAuth = await readLiveAuth();
      const dismissFence = buildAuthFence(liveAuth, context.accountKey, context.generation);
      if (
        !dismissFence
        || !matchesAuthFence(liveAuth, dismissFence, {
          requireAccountGeneration: Boolean(dismissFence.accountGeneration),
        })
      ) {
        verifiedAssignmentRecord = null;
        return {
          ok: false,
          code: 'ACCOUNT_CHANGED',
          message: '계정 연결이 바뀌었어요. 다시 확인해 주세요.',
        };
      }
      if (context?.purposeMode === 'existing') {
        if (
          context?.returnTarget === 'welcome'
          || (
            verifiedAssignmentRecord
            && (
              verifiedAssignmentRecord.fence?.accountKey !== context.accountKey
              || !matchesAuthFence(liveAuth, verifiedAssignmentRecord.fence, {
                requireAccountGeneration: true,
              })
            )
          )
        ) {
          verifiedAssignmentRecord = null;
        }
        return { ok: true, action: 'return' };
      }
      const completed = await settleEnteringPurposeIfNeeded('skipped', context.accountKey, dismissFence);
      if (completed.ok === false) {
        return completed;
      }
      const ensured = await onEnsureEnteredView?.();
      if (ensured?.ok === false) {
        return ensured;
      }
      return { ok: true };
    },

    async onInvite(validatedValue, meta) {
      const normalizedValidated = typeof validatedValue === 'string' ? validatedValue : '';
      let submittedRaw = '';
      if (
        pendingInviteSubmission
        && !pendingInviteSubmission.claimedByAttempt
        && !pendingInviteSubmission.invalidated
        && pendingInviteSubmission.formGeneration === inviteFormGeneration
        && pendingInviteSubmission.inputRevision === inviteInputRevision
      ) {
        pendingInviteSubmission.claimedByAttempt = true;
        submittedRaw = pendingInviteSubmission.rawValue;
        pendingInviteSubmission.rawValue = '';
        pendingInviteSubmission = null;
      } else if (root.dataset.portalState === 'invite') {
        const liveInput = root.querySelector('#portal-invite-input');
        const liveRaw = liveInput ? liveInput.value : '';
        if (liveRaw.trim() === normalizedValidated) {
          submittedRaw = liveRaw;
        }
      }

      cancelActiveInvite();

      const initialAuthCheck = resolveConfirmedInviteAuth(latestMainAuth);
      const attempt = {
        id: ++inviteAttemptSeq,
        formGeneration: inviteFormGeneration,
        inputRevision: inviteInputRevision,
        submittedRaw,
        validatedValue: normalizedValidated,
        cancelled: false,
        invalidated: false,
        requestId: null,
        accountGeneration: null,
        startInviteAuth: initialAuthCheck.ok ? initialAuthCheck : null,
        inviteAuth: null,
        boundaryInFlight: false,
      };
      activeInviteAttempt = attempt;

      try {
        const isPulseLink = meta?.kind === 'link' && meta?.pathname === '/pulse-app/';
        const isCompanyLink = meta?.kind === 'link' && meta?.pathname === '/';
        const isBareCode = meta?.kind === 'code';

        if (!isPulseLink && !isCompanyLink && !isBareCode) {
          restoreInviteInputForAttempt(attempt);
          return {
            ok: false,
            code: 'UNSUPPORTED_INVITE_INPUT',
            message: '지원하지 않는 초대 형식이에요. 전달받은 초대 링크를 확인해 주세요.',
          };
        }

        let pulseToken = null;
        if (isPulseLink) {
          pulseToken = extractPulseInviteToken(validatedValue);
          if (!pulseToken) {
            restoreInviteInputForAttempt(attempt);
            return {
              ok: false,
              code: 'INVALID_INVITE_TOKEN',
              message: pulseInviteErrorMessage('INVALID_INVITE_TOKEN'),
            };
          }
        } else if (isCompanyLink) {
          const companyToken = extractCompanyInviteToken(validatedValue);
          if (!companyToken) {
            restoreInviteInputForAttempt(attempt);
            return {
              ok: false,
              code: 'INVALID_INPUT',
              message: companyInviteErrorMessage('INVALID_INPUT'),
            };
          }
        }

        const liveAuth = await readLiveAuth();
        if (!isInviteAttemptCurrentSession(attempt)) {
          return {
            ok: false,
            code: 'CANCELLED',
            message: companyInviteErrorMessage('CANCELLED', { isPulseLink }),
          };
        }

        const inviteAuth = resolveConfirmedInviteAuth(liveAuth);
        if (!inviteAuth.ok) {
          restoreInviteInputForAttempt(attempt);
          return {
            ok: false,
            code: inviteAuth.code,
            message: companyInviteErrorMessage(inviteAuth.code, { isPulseLink }),
          };
        }

        const requestId = createRequestId(hostCrypto);
        if (!requestId) {
          restoreInviteInputForAttempt(attempt);
          return {
            ok: false,
            code: 'HANDOFF_UNAVAILABLE',
            message: companyInviteErrorMessage('HANDOFF_UNAVAILABLE', { isPulseLink }),
          };
        }

        const accountGeneration = inviteAuth.accountGeneration;
        attempt.requestId = requestId;
        attempt.accountGeneration = accountGeneration;
        attempt.inviteAuth = inviteAuth;
        attempt.boundaryInFlight = true;

        let result;
        let expectedDestination = null;
        try {
          if (isPulseLink) {
            expectedDestination = '/pulse-app/';
            result = await boundaries.openPulseAppInvite({
              token: pulseToken,
              requestId,
              accountGeneration,
              bridge,
            });
          } else if (isCompanyLink) {
            expectedDestination = '/';
            result = await boundaries.handoffCompanyInviteLink({
              href: validatedValue,
              requestId,
              accountGeneration,
              bridge,
            });
          } else {
            result = await boundaries.inspectBareInviteCode({
              code: validatedValue,
              requestId,
              accountGeneration,
              bridge,
            });
          }
        } finally {
          attempt.boundaryInFlight = false;
        }

        if (!isInviteAttemptCurrentSession(attempt)) {
          return {
            ok: false,
            code: 'CANCELLED',
            message: companyInviteErrorMessage('CANCELLED', { isPulseLink }),
          };
        }

        const afterAuth = await readLiveAuth();
        if (!isInviteAttemptCurrentSession(attempt)) {
          return {
            ok: false,
            code: 'CANCELLED',
            message: companyInviteErrorMessage('CANCELLED', { isPulseLink }),
          };
        }

        if (!matchesInviteAuthAfterAwait(afterAuth, inviteAuth)) {
          attempt.invalidated = true;
          attempt.submittedRaw = '';
          return {
            ok: false,
            code: 'ACCOUNT_CHANGED',
            message: companyInviteErrorMessage('ACCOUNT_CHANGED', { isPulseLink }),
          };
        }

        if (isValidInviteReceivedAck(result, requestId, accountGeneration, expectedDestination)) {
          clearInviteInputForAttempt(attempt);
          if (result.keepOpen !== true) {
            onEnsureEnteredView?.();
          }
          return {
            ok: true,
            state: 'received',
            destination: result.destination,
            ...(result.keepOpen === true ? { keepOpen: true } : {}),
          };
        }

        restoreInviteInputForAttempt(attempt);
        const failCode = isPlainObject(result) && result.ok === false && typeof result.code === 'string'
          ? result.code
          : (result?.state === 'classified' ? 'HANDOFF_UNAVAILABLE' : (isPulseLink ? 'PULSE_APP_INVITE_FAILED' : 'HANDOFF_UNAVAILABLE'));
        const safeCustomMessage = typeof result?.message === 'string' && result.message.trim()
          && (
            (isCompanyLink && typeof customBoundaries?.handoffCompanyInviteLink === 'function')
            || (isBareCode && typeof customBoundaries?.inspectBareInviteCode === 'function')
          )
          ? result.message.trim()
          : '';

        return {
          ok: false,
          code: failCode,
          message: safeCustomMessage || companyInviteErrorMessage(failCode, { isPulseLink }),
        };
      } finally {
        attempt.submittedRaw = '';
        if (activeInviteAttempt === attempt) {
          activeInviteAttempt = null;
        }
      }
    },
  });

  const onRootInputCapture = event => {
    if (disposed) return;
    const inviteInput = root.querySelector('#portal-invite-input');
    if (!inviteInput || event.target !== inviteInput) return;
    inviteInputRevision += 1;
    invalidatePendingInviteSubmission();
  };

  const onRootSubmitCapture = event => {
    if (disposed || activeInviteAttempt !== null) return;
    const form = event.target?.closest?.('[data-portal-pane="invite"]');
    if (!form || !root.contains(form)) return;
    const inviteInput = root.querySelector('#portal-invite-input');
    const rawValue = inviteInput ? inviteInput.value : '';
    const submission = {
      id: ++inviteSubmissionSeq,
      formGeneration: inviteFormGeneration,
      inputRevision: inviteInputRevision,
      rawValue,
      claimedByAttempt: false,
      invalidated: false,
    };
    pendingInviteSubmission = submission;
    queueMicrotask(() => {
      try {
        if (
          disposed
          || submission.claimedByAttempt
          || submission.invalidated
          || pendingInviteSubmission !== submission
          || activeInviteAttempt !== null
          || inviteFormGeneration !== submission.formGeneration
          || inviteInputRevision !== submission.inputRevision
        ) {
          return;
        }
        if (portal.getState().phase !== 'invite' || root.dataset.portalState !== 'invite') {
          return;
        }
        const inviteError = root.querySelector('#portal-invite-error');
        const currentInput = root.querySelector('#portal-invite-input');
        if (
          currentInput
          && submission.rawValue.trim()
          && inviteError?.textContent?.trim()
          && (currentInput.value === '' || currentInput.value === submission.rawValue)
        ) {
          currentInput.value = submission.rawValue;
        }
      } finally {
        submission.rawValue = '';
        if (pendingInviteSubmission === submission) {
          pendingInviteSubmission = null;
        }
      }
    });
  };

  const onRootClickCapture = event => {
    if (disposed) return;
    const actionBtn = event.target?.closest?.('[data-portal-action]');
    if (!actionBtn || !root.contains(actionBtn) || actionBtn.disabled) return;
    if (actionBtn.dataset.portalAction === 'close-invite' && portal?.getState().phase === 'invite') {
      invalidateInviteFormSession();
    }
  };

  const onWindowKeyDownCapture = event => {
    if (disposed || !portal.shouldBlockShortcuts()) return;
    if (event.isComposing || event.keyCode === 229) return;

    const targetInsidePortal = Boolean(event.target && root.contains?.(event.target));
    const inPortalTextField = targetInsidePortal
      && Boolean(event.target?.closest?.('input,textarea,select,[contenteditable="true"]'));

    const mod = event.ctrlKey || event.metaKey;
    const lowerKey = typeof event.key === 'string' ? event.key.toLowerCase() : '';
    const isConvenienceShortcut =
      (mod && (lowerKey === 'k' || ['+', '=', '-', '0'].includes(event.key)))
      || (!inPortalTextField && event.altKey && !mod && (event.key === 'ArrowLeft' || event.key === 'ArrowRight'))
      || (!targetInsidePortal && (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')));

    if (isConvenienceShortcut) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    const openModalDialog = doc?.querySelector?.('dialog[open]');
    if (openModalDialog && !root.contains(openModalDialog)) {
      return;
    }

    if (targetInsidePortal) return;

    if (event.key === 'Tab') {
      const items = [...root.querySelectorAll(FOCUSABLE_IN_PORTAL)].filter(isVisibleElement);
      if (items.length > 0) {
        event.preventDefault();
        event.stopImmediatePropagation();
        (event.shiftKey ? items[items.length - 1] : items[0]).focus?.({ preventScroll: true });
      }
      return;
    }

    if (event.key === 'Escape') {
      const snap = portal.getState();
      if (snap.phase === 'invite') {
        const closeInviteBtn = root.querySelector('[data-portal-action="close-invite"]');
        if (closeInviteBtn && !closeInviteBtn.disabled) {
          event.preventDefault();
          event.stopImmediatePropagation();
          invalidateInviteFormSession();
          closeInviteBtn.click();
        }
      } else if (snap.phase === 'workspace' && snap.workspace?.canContinuePersonal !== false) {
        const continueBtn = root.querySelector('[data-portal-action="continue-personal"]');
        if (continueBtn && !continueBtn.hidden && !continueBtn.disabled) {
          event.preventDefault();
          event.stopImmediatePropagation();
          continueBtn.click();
        }
      } else if (snap.phase === 'purpose') {
        event.preventDefault();
        event.stopImmediatePropagation();
        void portal.closePurposePicker();
      } else if (snap.phase === 'auth' && !snap.enteredOnce && snap.authStatus !== 'signing-in') {
        const backBtn = root.querySelector('[data-portal-action="back-welcome"]');
        if (backBtn && !backBtn.disabled) {
          event.preventDefault();
          event.stopImmediatePropagation();
          backBtn.click();
        }
      }
    }
  };

  const onPageHide = () => {
    clearAllInviteInputState();
    invalidateAllCompanyFlows();
  };

  root.addEventListener('input', onRootInputCapture, true);
  root.addEventListener('submit', onRootSubmitCapture, true);
  root.addEventListener('click', onRootClickCapture, true);
  win?.addEventListener?.('keydown', onWindowKeyDownCapture, true);
  win?.addEventListener?.('pagehide', onPageHide);

  function syncAuth(snapshot) {
    if (disposed) return portal.getState();
    const reducedMotion = Boolean(getReducedMotion());

    // prepareSignIn 초기 discard()가 내보내는 오류 없는 signed-out은 signing-in 전환 깜빡임을 막기 위해 건너뛴다.
    if (signInStarting && snapshot?.status === 'signed-out' && !snapshot?.error) {
      return portal.getState();
    }

    if (snapshot && typeof snapshot === 'object') {
      latestMainAuth = snapshot;
      recordConfirmedSignedIn(snapshot);
    }

    const incomingUuid = readSnapshotAccountGeneration(snapshot);
    const incomingKey = verifiedPortalAccountKey(snapshot);

    if (verifiedAssignmentRecord) {
      if (!matchesAuthFence(snapshot, verifiedAssignmentRecord.fence, { requireAccountGeneration: true })) {
        verifiedAssignmentRecord = null;
      }
    }

    if (activeResolveRequest) {
      if (!matchesAuthFence(snapshot, activeResolveRequest.fence, { requireAccountGeneration: Boolean(activeResolveRequest.accountGeneration) })) {
        cancelActiveResolve();
      }
    }

    if (activeInviteAttempt) {
      const inv = activeInviteAttempt.inviteAuth || activeInviteAttempt.startInviteAuth;
      if (inv?.mode === 'signed-in') {
        const stillSameSignedIn = matchesAuthFence(
          snapshot,
          {
            accountKey: inv.accountKey,
            accountGeneration: inv.accountGeneration,
            sessionGeneration: inv.sessionGeneration,
          },
          { requireAccountGeneration: true },
        );
        if (!stillSameSignedIn) {
          cancelActiveInvite();
        }
      } else if (inv?.mode === 'signed-out') {
        const stillSameGuest = snapshot?.status === 'signed-out'
          && snapshot.signedIn !== true
          && incomingUuid === inv.accountGeneration
          && !incomingKey;
        if (!stillSameGuest) {
          cancelActiveInvite();
        }
      }
    }

    const normalized = normalizeDesktopPortalAuth(snapshot, { hasBridge, reducedMotion });
    if (normalized.status === 'signing-in') {
      portalSigningIn = true;
    }

    const wasPortalSigningIn = portalSigningIn;
    if (normalized.status !== 'signing-in' && normalized.status !== 'restoring' && normalized.status !== 'loading') {
      portalSigningIn = false;
    }

    const nextState = portal.setState(normalized);

    if (
      wasPortalSigningIn
      && normalized.status === 'signed-out'
      && snapshot?.error
      && snapshot.error.code !== 'AUTH_CANCELLED'
      && nextState.phase === 'auth'
    ) {
      showAuthFeedback(snapshot.error.message || '로그인을 마치지 못했어요. 다시 시도해 주세요.');
    }

    return nextState;
  }

  function syncReducedMotion(reducedMotion = Boolean(getReducedMotion())) {
    if (disposed) return;
    syncAuth(getAuth() || { status: hasBridge ? 'restoring' : 'unconfigured', configured: false, signedIn: false });
    void reducedMotion;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    clearAllInviteInputState();
    invalidateAllCompanyFlows();
    root.removeEventListener('input', onRootInputCapture, true);
    root.removeEventListener('submit', onRootSubmitCapture, true);
    root.removeEventListener('click', onRootClickCapture, true);
    win?.removeEventListener?.('keydown', onWindowKeyDownCapture, true);
    win?.removeEventListener?.('pagehide', onPageHide);
    portal.dispose();
  }

  return {
    getState: () => portal.getState(),
    getSelectedPurposeId: () => lastSelectedPurposeId,
    isActive: () => portal.isActive(),
    shouldBlockShortcuts: () => portal.shouldBlockShortcuts(),
    syncAuth,
    syncReducedMotion,
    openPurposePicker: trigger => portal.openPurposePicker(trigger),
    closePurposePicker: () => portal.closePurposePicker(),
    // 새 얼굴의 모습('portal' · 'app' · 'legacy' · 'off'). 얼굴이 모르면 'off'와 false다
    clientMode: () => (typeof portal.clientMode === 'function' ? portal.clientMode() : 'off'),
    isClientShown: () => (typeof portal.isClientShown === 'function' ? portal.isClientShown() === true : false),
    dispose,
  };
}
