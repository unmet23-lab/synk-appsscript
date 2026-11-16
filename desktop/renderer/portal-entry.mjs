// 웹과 PC 플랫폼이 함께 쓰는 공통 첫 화면 DOM 컨트롤러다.
// 인증 시작과 초대 전달, 배정 작업 진입은 모두 호스트가 넘긴 콜백으로만 요청한다.

import { PORTAL_DURATION_MS, getPortalOrbRadius, createPortalOrb } from './portal-orb.mjs';
import {
  INVITE_TOKEN_PATTERN,
  PORTAL_SHIFT_URL,
  PORTAL_PURPOSE_ITEMS,
  PORTAL_ALLOWED_PURPOSES,
  PORTAL_PURPOSE_ORIGINS,
  PORTAL_PURPOSE_MODES,
  PORTAL_WORKSPACE_STATUSES,
  PORTAL_WORKSPACE_ITEMS,
  normalizePortalWorkspaceDestination,
  normalizePortalWorkspaceState,
  validatePortalInviteInput,
  isPortalActivePhase,
  createPortalStateMachine,
} from './portal-entry-state.mjs';

export {
  PORTAL_DURATION_MS,
  getPortalOrbRadius,
  INVITE_TOKEN_PATTERN,
  PORTAL_SHIFT_URL,
  PORTAL_PURPOSE_ITEMS,
  PORTAL_ALLOWED_PURPOSES,
  PORTAL_PURPOSE_ORIGINS,
  PORTAL_PURPOSE_MODES,
  PORTAL_WORKSPACE_STATUSES,
  PORTAL_WORKSPACE_ITEMS,
  normalizePortalWorkspaceDestination,
  normalizePortalWorkspaceState,
  validatePortalInviteInput,
  isPortalActivePhase,
};

export const PORTAL_STATE_EVENT = 'synk:portal-state';

export function isPortalActive(target = globalThis.document) {
  if (!target) return false;
  const el = target.id === 'portal-entry'
    ? target
    : typeof target.getElementById === 'function'
      ? target.getElementById('portal-entry')
      : null;
  return el?.dataset?.portalActive === 'true';
}

const NON_HOST_TAGS = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'TEMPLATE', 'NOSCRIPT']);

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[ch]);
}

function isElementVisible(el) {
  if (!el || el.hidden) return false;
  let cursor = el;
  while (cursor && cursor.nodeType === 1) {
    if (cursor.hidden || cursor.getAttribute?.('aria-hidden') === 'true') return false;
    cursor = cursor.parentElement;
  }
  return true;
}

function buildPortalMarkup() {
  const purposeRows = PORTAL_PURPOSE_ITEMS.map(item => `
    <button type="button" class="portal-purpose-choice" data-portal-purpose="${escapeHtml(item.id)}">
      <span class="portal-purpose-index" aria-hidden="true">${escapeHtml(item.index)}</span>
      <span class="portal-purpose-body">
        <span class="portal-purpose-name">${escapeHtml(item.name)}</span>
        <span class="portal-purpose-meta">${escapeHtml(item.description)}</span>
      </span>
      <span class="portal-purpose-arrow" aria-hidden="true">${item.external ? '↗' : '→'}</span>
    </button>
  `).join('');

  const workspaceRows = PORTAL_WORKSPACE_ITEMS.map(item => `
    <button
      type="button"
      class="portal-purpose-choice"
      data-portal-workspace="${escapeHtml(item.destination)}"
      data-portal-workspace-id="${escapeHtml(item.id)}"
      hidden
    >
      <span class="portal-purpose-index" aria-hidden="true">${escapeHtml(item.index)}</span>
      <span class="portal-purpose-body">
        <span class="portal-purpose-name">${escapeHtml(item.name)}</span>
        <span class="portal-purpose-meta">${escapeHtml(item.description)}</span>
      </span>
      <span class="portal-purpose-arrow" aria-hidden="true">↗</span>
    </button>
  `).join('');

  return `
    <div class="portal-orb-stage" data-portal-orb-stage aria-hidden="true"></div>
    <div class="portal-stage" data-portal-stage>
      <section class="portal-welcome" data-portal-pane="welcome" aria-label="SYNK">
        <button type="button" class="circle-portal" data-portal-action="orb" aria-label="SYNK 시작"></button>
        <p class="portal-orb-status" data-portal-orb-status role="status" aria-live="polite"></p>
      </section>

      <section class="portal-interior" data-portal-interior hidden aria-labelledby="portal-heading">
        <div class="portal-card">
          <div class="portal-head-nav" data-portal-head-nav hidden>
            <button type="button" class="portal-back-btn" data-portal-action="back-welcome">
              <span class="portal-back-arrow" aria-hidden="true">←</span>
              <span>첫 화면</span>
            </button>
          </div>

          <h1 id="portal-heading" class="portal-title" tabindex="-1">SYNK에 입장</h1>
          <p class="portal-lead" data-portal-lead hidden></p>

          <div class="portal-pane" data-portal-pane="auth" hidden>
            <button type="button" class="portal-primary-btn" data-portal-action="google" hidden>
              <span class="portal-primary-left">
                <span class="portal-auth-icon" aria-hidden="true">
                  <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
                    <path d="M17.1 9.2c0-.63-.05-1.12-.17-1.64H9v3.18h4.65c-.12.79-.66 1.98-1.88 2.78l2.86 2.21c1.71-1.58 2.47-3.91 2.47-6.53Z" fill="currentColor" fill-opacity=".88"/>
                    <path d="M9 17.4c2.28 0 4.2-.75 5.6-2.04l-2.86-2.21c-.76.53-1.78.9-2.74.9-2.1 0-3.88-1.41-4.52-3.36l-2.94 2.27A8.4 8.4 0 0 0 9 17.4Z" fill="currentColor"/>
                    <path d="M4.48 10.69A5.04 5.04 0 0 1 4.2 9c0-.59.1-1.16.28-1.69L1.54 5.04A8.4 8.4 0 0 0 .6 9c0 1.36.33 2.64.94 3.96l2.94-2.27Z" fill="currentColor" fill-opacity=".72"/>
                    <path d="M9 3.95c1.38 0 2.33.6 2.86 1.1l2.09-2.04C12.66 1.82 11 1.1 9 1.1a8.4 8.4 0 0 0-7.46 4.44l2.94 2.27C5.12 5.36 6.9 3.95 9 3.95Z" fill="currentColor" fill-opacity=".92"/>
                  </svg>
                </span>
                <span>Google로 계속</span>
              </span>
              <span class="portal-primary-arrow" aria-hidden="true">→</span>
            </button>

            <button type="button" class="portal-primary-btn" data-portal-action="signin" hidden>
              <span class="portal-primary-left">
                <span>Google 또는 이메일로 로그인</span>
              </span>
              <span class="portal-primary-arrow" aria-hidden="true">→</span>
            </button>

            <div class="portal-alt-list" data-portal-alt-list role="group" aria-label="다른 입장 방법">
              <button type="button" class="portal-alt-row" data-portal-action="email" hidden>
                <span class="portal-alt-label">이메일로 계속</span>
                <span class="portal-alt-cue">
                  <span class="portal-mono-tag">EMAIL</span>
                  <span class="portal-alt-arrow" aria-hidden="true">→</span>
                </span>
              </button>

              <button type="button" class="portal-alt-row" data-portal-action="open-invite" hidden>
                <span class="portal-alt-label">초대코드로 입장</span>
                <span class="portal-alt-cue">
                  <span class="portal-mono-tag">INVITE</span>
                  <span class="portal-alt-arrow" aria-hidden="true">→</span>
                </span>
              </button>

              <button type="button" class="portal-alt-row" data-portal-action="signup" hidden>
                <span class="portal-alt-label">회원가입</span>
                <span class="portal-alt-cue">
                  <span class="portal-mono-tag">SIGN UP</span>
                  <span class="portal-alt-arrow" aria-hidden="true">→</span>
                </span>
              </button>

              <button type="button" class="portal-alt-row" data-portal-action="browse" hidden>
                <span class="portal-alt-label">로그인 없이 둘러보기</span>
                <span class="portal-alt-cue">
                  <span class="portal-alt-arrow" aria-hidden="true">→</span>
                </span>
              </button>
            </div>

            <p class="portal-inline-error" data-portal-auth-feedback role="alert" hidden></p>
          </div>

          <form class="portal-pane" data-portal-pane="invite" novalidate hidden>
            <label class="portal-field-label" for="portal-invite-input">
              <span>초대코드 또는 초대 링크</span>
              <span class="portal-mono-tag">INVITE</span>
            </label>
            <input
              id="portal-invite-input"
              class="portal-input"
              type="text"
              inputmode="url"
              autocomplete="off"
              autocapitalize="off"
              autocorrect="off"
              spellcheck="false"
              maxlength="320"
              placeholder="전달받은 코드 또는 링크 입력"
              aria-describedby="portal-invite-error"
            >
            <p id="portal-invite-error" class="portal-inline-error" data-portal-invite-error role="alert"></p>
            <p class="portal-inline-status" data-portal-invite-status role="status" aria-live="polite" hidden></p>
            <button type="submit" class="portal-primary-btn portal-submit-btn" data-portal-invite-submit>
              <span>코드로 입장</span>
              <span class="portal-primary-arrow" aria-hidden="true">→</span>
            </button>
            <div class="portal-sub-row">
              <button type="button" class="portal-quiet-btn" data-portal-action="close-invite">
                <span aria-hidden="true">←</span>
                <span>다른 입장 방법</span>
              </button>
            </div>
          </form>

          <div class="portal-pane" data-portal-pane="status" hidden>
            <p class="portal-status-text" data-portal-status-text role="status" aria-live="polite"></p>
            <div class="portal-action-stack" data-portal-status-actions>
              <button type="button" class="portal-primary-btn" data-portal-action="retry-enter" hidden>
                <span>다시 시도</span>
                <span class="portal-primary-arrow" aria-hidden="true">→</span>
              </button>
              <button type="button" class="portal-primary-btn" data-portal-action="retry-auth" hidden>
                <span>저장된 로그인 다시 확인</span>
                <span class="portal-primary-arrow" aria-hidden="true">→</span>
              </button>
              <button type="button" class="portal-secondary-btn" data-portal-action="go-auth" hidden>
                <span>새로 로그인</span>
                <span aria-hidden="true">→</span>
              </button>
              <button type="button" class="portal-secondary-btn" data-portal-action="switch-account" hidden>
                <span>다른 계정으로 로그인</span>
                <span aria-hidden="true">→</span>
              </button>
              <button type="button" class="portal-secondary-btn" data-portal-action="cancel-signin" hidden>
                <span>로그인 취소</span>
              </button>
              <button type="button" class="portal-quiet-btn" data-portal-action="status-browse" hidden>
                <span>로그인 없이 둘러보기</span>
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>

          <div class="portal-pane" data-portal-pane="workspace" hidden>
            <div class="portal-purpose-list" data-portal-workspace-list role="group" aria-label="연결된 작업 공간 선택" hidden>
              ${workspaceRows}
            </div>
            <p class="portal-inline-error" data-portal-workspace-error role="alert" hidden></p>
            <div class="portal-action-stack portal-workspace-actions" data-portal-workspace-actions>
              <button type="button" class="portal-primary-btn" data-portal-action="retry-workspace" hidden>
                <span data-portal-retry-workspace-label>작업 공간 다시 확인</span>
                <span class="portal-primary-arrow" aria-hidden="true">→</span>
              </button>
              <button type="button" class="portal-secondary-btn" data-portal-action="workspace-switch-account" hidden>
                <span>다른 계정으로 로그인</span>
                <span aria-hidden="true">→</span>
              </button>
              <button type="button" class="portal-secondary-btn" data-portal-action="continue-personal" hidden>
                <span>개인 화면으로 계속</span>
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>

          <div class="portal-pane" data-portal-pane="purpose" hidden>
            <div class="portal-purpose-list" role="group" aria-label="시작할 서비스 선택">
              ${purposeRows}
            </div>
            <p class="portal-inline-error" data-portal-purpose-error role="alert" hidden></p>
            <div class="portal-purpose-foot">
              <button type="button" class="portal-secondary-btn" data-portal-purpose="home">
                <span>플랫폼 홈으로 가기</span>
                <span aria-hidden="true">→</span>
              </button>
              <button type="button" class="portal-quiet-btn" data-portal-action="close-purpose">
                <span>닫기</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  `;
}

export function mountPortalEntry(root, options = {}) {
  if (!root) {
    throw new Error('포털을 마운트할 루트 요소가 필요해요.');
  }

  const doc = options.documentObj || root.ownerDocument || globalThis.document;
  const win = options.windowObj || doc?.defaultView || globalThis.window || globalThis;

  root.id = root.id || 'portal-entry';
  root.classList.add('portal-entry-root');
  root.innerHTML = buildPortalMarkup();

  const orbStage = root.querySelector('[data-portal-orb-stage]');
  const welcomeSection = root.querySelector('[data-portal-pane="welcome"]');
  const orbButton = root.querySelector('[data-portal-action="orb"]');
  const orbStatusEl = root.querySelector('[data-portal-orb-status]');
  const interiorSection = root.querySelector('[data-portal-interior]');
  const headNav = root.querySelector('[data-portal-head-nav]');
  const backWelcomeBtn = root.querySelector('[data-portal-action="back-welcome"]');
  const headingEl = root.querySelector('#portal-heading');
  const leadEl = root.querySelector('[data-portal-lead]');

  const authPane = root.querySelector('[data-portal-pane="auth"]');
  const googleBtn = root.querySelector('[data-portal-action="google"]');
  const unifiedSignInBtn = root.querySelector('[data-portal-action="signin"]');
  const altList = root.querySelector('[data-portal-alt-list]');
  const emailBtn = root.querySelector('[data-portal-action="email"]');
  const openInviteBtn = root.querySelector('[data-portal-action="open-invite"]');
  const signUpBtn = root.querySelector('[data-portal-action="signup"]');
  const browseBtn = root.querySelector('[data-portal-action="browse"]');
  const authFeedbackEl = root.querySelector('[data-portal-auth-feedback]');

  const inviteForm = root.querySelector('[data-portal-pane="invite"]');
  const inviteInput = root.querySelector('#portal-invite-input');
  const inviteErrorEl = root.querySelector('[data-portal-invite-error]');
  const inviteStatusEl = root.querySelector('[data-portal-invite-status]');
  const inviteSubmitBtn = root.querySelector('[data-portal-invite-submit]');
  const closeInviteBtn = root.querySelector('[data-portal-action="close-invite"]');

  const statusPane = root.querySelector('[data-portal-pane="status"]');
  const statusTextEl = root.querySelector('[data-portal-status-text]');
  const retryEnterBtn = root.querySelector('[data-portal-action="retry-enter"]');
  const retryAuthBtn = root.querySelector('[data-portal-action="retry-auth"]');
  const goAuthBtn = root.querySelector('[data-portal-action="go-auth"]');
  const switchAccountBtn = root.querySelector('[data-portal-action="switch-account"]');
  const cancelSignInBtn = root.querySelector('[data-portal-action="cancel-signin"]');
  const statusBrowseBtn = root.querySelector('[data-portal-action="status-browse"]');

  const workspacePane = root.querySelector('[data-portal-pane="workspace"]');
  const workspaceListEl = root.querySelector('[data-portal-workspace-list]');
  const workspaceErrorEl = root.querySelector('[data-portal-workspace-error]');
  const retryWorkspaceBtn = root.querySelector('[data-portal-action="retry-workspace"]');
  const retryWorkspaceLabelEl = root.querySelector('[data-portal-retry-workspace-label]');
  const workspaceSwitchAccountBtn = root.querySelector('[data-portal-action="workspace-switch-account"]');
  const continuePersonalBtn = root.querySelector('[data-portal-action="continue-personal"]');

  const purposePane = root.querySelector('[data-portal-pane="purpose"]');
  const purposeErrorEl = root.querySelector('[data-portal-purpose-error]');
  const homePurposeBtn = root.querySelector('[data-portal-purpose="home"]');

  const savedHostAttributes = new Map();
  let hostLocked = false;
  let disposed = false;
  let orb = null;
  let zoomFrameId = null;
  let zoomStartMs = 0;
  let hoverLevel = 0;
  let pointerX = 0;
  let pointerY = 0;
  let hostReducedMotion = options.initialState?.reducedMotion === true;

  let busyAction = null;
  let asyncSeq = 0;
  let lastAnnouncedActive = null;
  let lastAnnouncedPhase = null;
  let lastRenderedPhase = null;
  let workspaceNeedsRetry = false;
  let navigationHoldActive = false;

  let inviteTriggerEl = null;
  let purposeTriggerEl = null;

  function prefersReducedMotion() {
    if (hostReducedMotion) return true;
    if (typeof options.getReducedMotion === 'function' && options.getReducedMotion() === true) return true;
    if (doc?.documentElement?.dataset?.motion === 'reduced') return true;
    try {
      return win.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
    } catch {
      return false;
    }
  }

  function isImmediateEntry() {
    return prefersReducedMotion() || doc?.hidden === true;
  }

  function resolveHostElements() {
    if (Array.isArray(options.hostElements) && options.hostElements.length > 0) {
      return options.hostElements.filter(el => el && el !== root && el.nodeType === 1);
    }
    const parent = root.parentElement;
    if (!parent) return [];
    return [...parent.children].filter(el => {
      if (!el || el === root || el.nodeType !== 1) return false;
      if (NON_HOST_TAGS.has(el.tagName)) return false;
      if (el.classList?.contains('sprite')) return false;
      return true;
    });
  }

  function lockHostElements() {
    if (hostLocked) return;
    for (const el of resolveHostElements()) {
      if (!savedHostAttributes.has(el)) {
        savedHostAttributes.set(el, {
          hadInertProp: Boolean(el.inert),
          hadInertAttr: el.hasAttribute?.('inert') === true,
          ariaHidden: el.getAttribute?.('aria-hidden') ?? null,
        });
      }
      el.inert = true;
      el.setAttribute?.('inert', '');
      el.setAttribute?.('aria-hidden', 'true');
    }
    hostLocked = true;
  }

  function restoreHostElements() {
    if (!hostLocked && savedHostAttributes.size === 0) return;
    for (const [el, prev] of savedHostAttributes.entries()) {
      el.inert = prev.hadInertProp;
      if (prev.hadInertAttr || prev.hadInertProp) {
        el.setAttribute?.('inert', '');
      } else {
        el.removeAttribute?.('inert');
      }
      if (prev.ariaHidden === null) {
        el.removeAttribute?.('aria-hidden');
      } else {
        el.setAttribute?.('aria-hidden', prev.ariaHidden);
      }
    }
    savedHostAttributes.clear();
    hostLocked = false;
  }

  function clearInviteStatus() {
    if (inviteStatusEl) {
      inviteStatusEl.textContent = '';
      inviteStatusEl.hidden = true;
    }
  }

  function clearInviteInput() {
    if (inviteInput) {
      inviteInput.value = '';
      inviteInput.disabled = false;
    }
    if (inviteErrorEl) inviteErrorEl.textContent = '';
    clearInviteStatus();
  }

  function sanitizeInviteFeedback(message, rawValue, normalizedValue) {
    if (typeof message !== 'string') return '';
    const trimmed = message.trim();
    if (!trimmed) return '';
    const rawTrimmed = typeof rawValue === 'string' ? rawValue.trim() : '';
    if (rawTrimmed && trimmed.includes(rawTrimmed)) return '';
    if (typeof normalizedValue === 'string' && normalizedValue && trimmed.includes(normalizedValue)) return '';
    const hashIdx = typeof normalizedValue === 'string' ? normalizedValue.indexOf('#invite=') : -1;
    if (hashIdx !== -1) {
      const tokenPart = normalizedValue.slice(hashIdx + '#invite='.length);
      if (tokenPart && trimmed.includes(tokenPart)) return '';
    }
    return trimmed;
  }

  function clearFeedbackMessages() {
    if (authFeedbackEl) {
      authFeedbackEl.textContent = '';
      authFeedbackEl.hidden = true;
    }
    if (purposeErrorEl) {
      purposeErrorEl.textContent = '';
      purposeErrorEl.hidden = true;
    }
    if (workspaceErrorEl) {
      workspaceErrorEl.textContent = '';
      workspaceErrorEl.hidden = true;
    }
    if (inviteErrorEl) {
      inviteErrorEl.textContent = '';
    }
    clearInviteStatus();
  }

  function isResolvedMultiWorkspace(ws) {
    return Boolean(
      ws
      && ws.status === 'resolved'
      && Array.isArray(ws.unavailable)
      && ws.unavailable.length === 0
      && Array.isArray(ws.destinations)
      && ws.destinations.length > 1,
    );
  }

  function resolveWorkspaceCopy(workspace) {
    const ws = workspace || normalizePortalWorkspaceState({});
    const customLead = typeof ws.message === 'string' && ws.message.trim() ? ws.message.trim() : '';

    if (ws.status === 'resolved') {
      if (isResolvedMultiWorkspace(ws)) {
        return {
          heading: '작업 공간',
          lead: customLead,
        };
      }
      return {
        heading: '들어갈 작업 공간 선택',
        lead: customLead || '연결된 작업 공간이 확인되었어요. 지금 열 공간을 골라 주세요.',
      };
    }

    if (ws.status === 'partial') {
      const pulseMissing = ws.unavailable.includes('pulse') && !ws.unavailable.includes('workspace');
      const workspaceMissing = ws.unavailable.includes('workspace') && !ws.unavailable.includes('pulse');
      let defaultLead = '일부 작업 공간 연결을 아직 확인하지 못했어요. 잠시 뒤 다시 확인해 주세요.';
      if (pulseMissing && ws.destinations.includes('/')) {
        defaultLead = 'PULSE 연결을 아직 확인하지 못했어요. 확인된 Workspace로 먼저 들어가거나 다시 확인할 수 있어요.';
      } else if (workspaceMissing && ws.destinations.includes('/pulse-app/')) {
        defaultLead = 'Workspace 연결을 아직 확인하지 못했어요. 확인된 PULSE로 먼저 들어가거나 다시 확인할 수 있어요.';
      }
      return {
        heading: '작업 공간 확인',
        lead: customLead || defaultLead,
      };
    }

    if (ws.status === 'login_required') {
      return {
        heading: '회사 공간 로그인 필요',
        lead: customLead || '열린 창에서 회사 공간 로그인을 마쳐 주세요. 로그인을 마치면 이 화면이 자동으로 바뀌어요.',
      };
    }

    if (ws.status === 'account_mismatch') {
      return {
        heading: '로그인 계정 확인 필요',
        lead: customLead || '열린 작업 공간의 계정이 지금 로그인한 계정과 달라요. 같은 계정으로 맞춘 뒤 다시 확인해 주세요.',
      };
    }

    if (ws.status === 'popup_blocked') {
      return {
        heading: '작업 공간 확인',
        lead: customLead || '새 창 열기가 차단되어 연결된 작업 공간을 아직 확인하지 못했어요. 아래 단추를 눌러 확인 창을 열어 주세요.',
      };
    }

    return {
      heading: '작업 공간 연결 지연',
      lead: customLead || '지금은 작업 공간 연결을 확인하지 못했어요. 잠시 뒤 다시 확인해 주세요.',
    };
  }

  function ensureOrb() {
    if (disposed || orb) return orb;
    orb = createPortalOrb(orbStage, {
      documentObj: doc,
      windowObj: win,
      getReducedMotion: prefersReducedMotion,
      onRadiusChange(radiusPx) {
        if (orbButton?.style) {
          orbButton.style.setProperty('--orb-size', `${Math.round(radiusPx * 2)}px`);
        }
      },
    });
    return orb;
  }

  function releaseOrb() {
    if (!orb) return;
    orb.dispose();
    orb = null;
  }

  function stopZoomAnimation() {
    if (zoomFrameId !== null) {
      if (typeof win.cancelAnimationFrame === 'function') win.cancelAnimationFrame(zoomFrameId);
      else clearTimeout(zoomFrameId);
      zoomFrameId = null;
    }
  }

  const machine = createPortalStateMachine({
    status: options.initialState?.status ?? 'restoring',
    generation: options.initialState?.generation,
    accountKey: options.initialState?.accountKey,
    errorMessage: options.initialState?.errorMessage,
    retryable: options.initialState?.retryable,
    bypass: options.initialState?.bypass === true,
  });

  function hasSplitWebSignIn() {
    return typeof options.onGoogleSignIn === 'function' && typeof options.onEmailSignIn === 'function';
  }

  function hasUnifiedSignIn() {
    return !hasSplitWebSignIn() && typeof options.onSignIn === 'function';
  }

  function hasAnySignIn() {
    return hasSplitWebSignIn() || hasUnifiedSignIn();
  }

  function focusableInPortal() {
    if (disposed || root.hidden) return [];
    return [...root.querySelectorAll(FOCUSABLE_SELECTOR)].filter(isElementVisible);
  }

  function moveFocusIntoPhase(phase, prevPhase) {
    if (disposed || doc?.hidden) return;
    if (phase === 'welcome') {
      orbButton?.focus?.({ preventScroll: true });
      return;
    }
    if (phase === 'invite') {
      inviteInput?.focus?.({ preventScroll: true });
      return;
    }
    if (phase === 'auth') {
      if (prevPhase === 'invite' && inviteTriggerEl && isElementVisible(inviteTriggerEl)) {
        const target = inviteTriggerEl;
        inviteTriggerEl = null;
        target.focus?.({ preventScroll: true });
        return;
      }
      const firstAuth = [googleBtn, unifiedSignInBtn, openInviteBtn, browseBtn].find(isElementVisible);
      (firstAuth || headingEl)?.focus?.({ preventScroll: true });
      return;
    }
    if (phase === 'workspace') {
      const firstWorkspace = [...workspacePane.querySelectorAll('button:not([disabled])')].find(isElementVisible);
      (firstWorkspace || headingEl)?.focus?.({ preventScroll: true });
      return;
    }
    if (phase === 'purpose') {
      const firstPurpose = purposePane.querySelector('button:not([disabled])');
      (firstPurpose || headingEl)?.focus?.({ preventScroll: true });
      return;
    }
    if (phase === 'checking' || phase === 'entering') {
      // 내부 단계의 단추로 넘어오면 그 단추가 방금 숨겨졌으므로 초점을 포털로 옮긴다(카본 0.4.94 원천 검수).
      if (
        doc?.activeElement
        && (!root.contains(doc.activeElement) || !isElementVisible(doc.activeElement))
      ) {
        root.setAttribute('tabindex', '-1');
        root.focus?.({ preventScroll: true });
      }
      return;
    }
    if (phase === 'entered' && navigationHoldActive) {
      if (
        doc?.activeElement
        && (!root.contains(doc.activeElement) || !isElementVisible(doc.activeElement))
      ) {
        root.setAttribute('tabindex', '-1');
        root.focus?.({ preventScroll: true });
      }
      return;
    }
    if (phase === 'error' || phase === 'enter-error' || phase === 'signing-in') {
      const firstAction = [retryEnterBtn, retryAuthBtn, goAuthBtn, cancelSignInBtn, statusBrowseBtn].find(isElementVisible);
      (firstAction || headingEl)?.focus?.({ preventScroll: true });
    }
  }

  function emitStateIfChanged(
    state,
    effectiveActive = state.active,
    effectiveBlockShortcuts = state.blockShortcuts,
  ) {
    if (lastAnnouncedActive === effectiveActive && lastAnnouncedPhase === state.phase) return;
    lastAnnouncedActive = effectiveActive;
    lastAnnouncedPhase = state.phase;
    const detail = {
      active: effectiveActive,
      blockShortcuts: effectiveBlockShortcuts,
      phase: state.phase,
      authStatus: state.authStatus,
    };
    options.onActiveChange?.(effectiveActive, detail);
    if (typeof CustomEvent === 'function') {
      root.dispatchEvent(new CustomEvent(PORTAL_STATE_EVENT, { bubbles: true, detail }));
    }
  }

  function syncButtonsDisabled() {
    const disabled = busyAction !== null;
    const signingWait = busyAction === 'google' || busyAction === 'email' || busyAction === 'signin';
    if (inviteInput) {
      inviteInput.disabled = disabled;
    }
    if (closeInviteBtn) {
      closeInviteBtn.disabled = disabled && busyAction !== 'invite';
    }
    for (const btn of [
      backWelcomeBtn,
      googleBtn,
      unifiedSignInBtn,
      emailBtn,
      openInviteBtn,
      signUpBtn,
      browseBtn,
      inviteSubmitBtn,
      retryEnterBtn,
      retryAuthBtn,
      goAuthBtn,
      switchAccountBtn,
      cancelSignInBtn,
      statusBrowseBtn,
      retryWorkspaceBtn,
      workspaceSwitchAccountBtn,
      continuePersonalBtn,
    ]) {
      if (btn) btn.disabled = disabled && !(signingWait && btn === cancelSignInBtn);
    }
    for (const btn of workspacePane.querySelectorAll('button')) {
      btn.disabled = disabled;
    }
    for (const btn of purposePane.querySelectorAll('button')) {
      btn.disabled = disabled;
    }
  }

  const SIGNED_IN_ZOOM_PORTAL = 0.55;

  function render() {
    if (disposed) return;
    const state = machine.read();
    const { phase, active, authStatus, purposeOrigin, errorMessage } = state;
    if (phase !== 'entered' && navigationHoldActive) {
      navigationHoldActive = false;
    }
    const holdingExitOrb = phase === 'entered' && navigationHoldActive;
    const effectiveActive = active || holdingExitOrb;
    const effectiveBlockShortcuts = state.blockShortcuts || holdingExitOrb;

    root.dataset.portalState = phase;
    root.dataset.portalAuthStatus = authStatus;
    root.dataset.portalActive = String(effectiveActive);
    if (purposeOrigin) {
      root.dataset.portalPurposeOrigin = purposeOrigin;
    } else {
      delete root.dataset.portalPurposeOrigin;
    }
    if (state.purposeMode) {
      root.dataset.portalPurposeMode = state.purposeMode;
    } else {
      delete root.dataset.portalPurposeMode;
    }
    if (phase === 'workspace' && state.workspace) {
      root.dataset.portalWorkspaceStatus = state.workspace.status;
    } else {
      delete root.dataset.portalWorkspaceStatus;
    }
    root.hidden = !effectiveActive;
    if (doc?.documentElement?.dataset) {
      doc.documentElement.dataset.portalActive = String(effectiveActive);
    }

    if (phase !== 'invite') {
      if (
        (inviteInput && inviteInput.value !== '')
        || (inviteErrorEl && inviteErrorEl.textContent !== '')
        || (inviteStatusEl && !inviteStatusEl.hidden)
      ) {
        clearInviteInput();
      }
    }

    if (!effectiveActive) {
      if (orbStatusEl) orbStatusEl.textContent = '';
      stopZoomAnimation();
      releaseOrb();
      restoreHostElements();
      root.classList.remove('portal-workspace-compact');
      workspacePane.classList.remove('is-resolved-multi', 'has-workspace-retry');
      lastRenderedPhase = phase;
      emitStateIfChanged(state, false, false);
      return;
    }

    if (holdingExitOrb) {
      stopZoomAnimation();
    }
    lockHostElements();

    const isOrbHoldPhase = phase === 'checking' || phase === 'entering' || holdingExitOrb;
    const showOrbScene = phase === 'welcome' || phase === 'zooming' || isOrbHoldPhase;
    welcomeSection.hidden = !showOrbScene;
    interiorSection.hidden = showOrbScene;
    // 구를 유지하는 동안 화면에는 글을 띄우지 않고, 숨긴 내부 구역의 상태 글 대신 낭독기에만 같은 뜻을 알린다(Fable 0.4.94 원천 검수).
    if (orbStatusEl) {
      const orbStatus = phase === 'checking'
        ? '저장된 로그인 정보를 확인하고 있어요.'
        : phase === 'entering'
          ? '계정에 연결된 작업 공간을 불러오고 있어요.'
          : holdingExitOrb
            ? '작업 공간을 여는 중이에요.'
            : '';
      if (orbStatusEl.textContent !== orbStatus) orbStatusEl.textContent = orbStatus;
    }
    root.dataset.portalMode = phase === 'purpose' || phase === 'workspace' ? 'purpose' : 'default';

    if (showOrbScene) {
      const orbInstance = ensureOrb();
      orbButton.disabled = phase !== 'welcome';
      if (isOrbHoldPhase || (phase === 'zooming' && authStatus === 'signed-in')) {
        orbButton.setAttribute('aria-busy', 'true');
      } else {
        orbButton.removeAttribute('aria-busy');
      }
      if (phase === 'welcome') {
        orbInstance?.setScene({
          portal: 0,
          interior: 0,
          hover: hoverLevel,
          pointerX,
          pointerY,
          active: true,
        });
      } else if (phase === 'checking' || (phase === 'zooming' && authStatus === 'signed-in' && zoomFrameId === null)) {
        orbInstance?.setScene({
          portal: 0,
          interior: 0,
          hover: 0,
          pointerX: 0,
          pointerY: 0,
          active: true,
        });
      } else if (phase === 'entering' || holdingExitOrb) {
        orbInstance?.setScene({
          portal: prefersReducedMotion() ? 0 : SIGNED_IN_ZOOM_PORTAL,
          interior: 0,
          hover: 0,
          pointerX: 0,
          pointerY: 0,
          active: true,
        });
      }
    } else {
      orbButton.removeAttribute('aria-busy');
      // 내부 단계나 본문 대기에서는 상시 구체 루프를 돌리지 않고 해제한다.
      releaseOrb();
    }

    authPane.hidden = phase !== 'auth';
    inviteForm.hidden = phase !== 'invite';
    workspacePane.hidden = phase !== 'workspace';
    purposePane.hidden = phase !== 'purpose';
    const isStatusPhase = phase === 'checking' || phase === 'signing-in' || phase === 'entering' || phase === 'enter-error' || phase === 'error';
    statusPane.hidden = !isStatusPhase;

    const isExistingPurpose = phase === 'purpose' && purposeOrigin === 'entering' && state.purposeMode === 'existing';
    const canReturnWelcome = (!state.enteredOnce && phase === 'auth' && authStatus !== 'signing-in') || isExistingPurpose;
    headNav.hidden = !canReturnWelcome;
    if (homePurposeBtn) {
      homePurposeBtn.hidden = isExistingPurpose;
    }

    leadEl.hidden = true;
    leadEl.textContent = '';
    let compactWorkspace = false;

    if (phase === 'auth') {
      const unconfigured = authStatus === 'unconfigured';
      headingEl.textContent = unconfigured ? '로그인 설정 확인 필요' : 'SYNK에 입장';
      if (unconfigured) {
        leadEl.hidden = false;
        leadEl.textContent = errorMessage || '이 환경에는 로그인 연결 설정이 아직 준비되지 않았어요.';
      }
      const splitWeb = !unconfigured && hasSplitWebSignIn();
      const unifiedPc = !unconfigured && hasUnifiedSignIn();
      googleBtn.hidden = !splitWeb;
      emailBtn.hidden = !splitWeb;
      unifiedSignInBtn.hidden = !unifiedPc;
      openInviteBtn.hidden = typeof options.onInvite !== 'function';
      signUpBtn.hidden = unconfigured || typeof options.onSignUp !== 'function';
      browseBtn.hidden = typeof options.onBrowse !== 'function';
      altList.hidden = [emailBtn, openInviteBtn, signUpBtn, browseBtn].every(el => el.hidden);
    } else if (phase === 'invite') {
      headingEl.textContent = '초대코드로 입장';
    } else if (phase === 'workspace') {
      const ws = state.workspace || normalizePortalWorkspaceState({});
      const resolvedMulti = isResolvedMultiWorkspace(ws);
      compactWorkspace = resolvedMulti;
      const copy = resolveWorkspaceCopy(ws);
      headingEl.textContent = copy.heading;
      if (copy.lead) {
        leadEl.hidden = false;
        leadEl.textContent = copy.lead;
      }
      for (const btn of workspacePane.querySelectorAll('[data-portal-workspace]')) {
        btn.hidden = !ws.destinations.includes(btn.dataset.portalWorkspace);
        const metaEl = btn.querySelector('.portal-purpose-meta');
        if (metaEl) {
          metaEl.hidden = resolvedMulti;
        }
      }
      if (workspaceListEl) {
        workspaceListEl.hidden = ws.destinations.length === 0;
      }
      const showRetry = ws.status !== 'resolved' || ws.destinations.length === 0 || workspaceNeedsRetry;
      workspacePane.classList.toggle('is-resolved-multi', resolvedMulti);
      workspacePane.classList.toggle('has-workspace-retry', showRetry);
      if (retryWorkspaceBtn) {
        retryWorkspaceBtn.hidden = !showRetry;
      }
      if (retryWorkspaceLabelEl) {
        retryWorkspaceLabelEl.textContent = ws.status === 'popup_blocked'
          ? '작업 공간 확인 열기'
          : '작업 공간 다시 확인';
      }
      if (workspaceSwitchAccountBtn) {
        workspaceSwitchAccountBtn.hidden = !(ws.canSwitchAccount && typeof options.onSwitchAccount === 'function');
      }
      if (continuePersonalBtn) {
        continuePersonalBtn.hidden = ws.canContinuePersonal === false;
      }
    } else if (phase === 'purpose') {
      headingEl.textContent = '시작할 서비스 선택';
    } else if (isStatusPhase) {
      retryEnterBtn.hidden = phase !== 'enter-error';
      retryAuthBtn.hidden = !(phase === 'error' && typeof options.onRetry === 'function');
      goAuthBtn.hidden = !(phase === 'error' && (hasAnySignIn() || typeof options.onInvite === 'function'));
      switchAccountBtn.hidden = !(phase === 'enter-error' && typeof options.onSwitchAccount === 'function');
      cancelSignInBtn.hidden = !(phase === 'signing-in' && typeof options.onCancelSignIn === 'function');
      statusBrowseBtn.hidden = !(phase === 'error' && typeof options.onBrowse === 'function');

      if (phase === 'checking') {
        headingEl.textContent = '로그인 확인 중';
        statusTextEl.textContent = '저장된 로그인 정보를 확인하고 있어요.';
      } else if (phase === 'entering') {
        headingEl.textContent = '작업 공간 연결 중';
        statusTextEl.textContent = '계정에 연결된 작업 공간을 불러오고 있어요.';
      } else if (phase === 'signing-in') {
        headingEl.textContent = '로그인 진행 중';
        statusTextEl.textContent = typeof options.signingInMessage === 'string' && options.signingInMessage.trim()
          ? options.signingInMessage.trim()
          : '열린 SYNK ID 화면에서 로그인을 마쳐 주세요.';
      } else if (phase === 'enter-error') {
        headingEl.textContent = '작업 공간 연결 실패';
        statusTextEl.textContent = errorMessage || '배정된 작업 공간을 불러오지 못했어요. 다시 시도해 주세요.';
      } else {
        headingEl.textContent = '연결을 확인해 주세요';
        statusTextEl.textContent = errorMessage || '계정 연결 상태를 확인하지 못했어요. 잠시 뒤 다시 확인해 주세요.';
      }
    }

    if (phase !== 'workspace') {
      workspacePane.classList.remove('is-resolved-multi', 'has-workspace-retry');
    }
    root.classList.toggle('portal-workspace-compact', compactWorkspace);

    syncButtonsDisabled();

    const prevPhase = lastRenderedPhase;
    lastRenderedPhase = phase;
    if (prevPhase !== phase && phase !== 'zooming') {
      moveFocusIntoPhase(phase, prevPhase);
    }
    emitStateIfChanged(state, effectiveActive, effectiveBlockShortcuts);
  }

  function finishZoomTransition() {
    stopZoomAnimation();
    if (disposed) return;
    const result = machine.completeZoom();
    render();
    if (result.shouldTriggerEnter) {
      void triggerEnter();
    }
  }

  function startZoomTransition() {
    stopZoomAnimation();
    if (disposed) return;
    if (isImmediateEntry()) {
      finishZoomTransition();
      return;
    }
    const orbInstance = ensureOrb();
    zoomStartMs = typeof win.performance?.now === 'function' ? win.performance.now() : Date.now();
    render();

    const step = () => {
      zoomFrameId = null;
      if (disposed) return;
      const snap = machine.read();
      if (snap.phase !== 'zooming') return;
      if (isImmediateEntry()) {
        finishZoomTransition();
        return;
      }
      const now = typeof win.performance?.now === 'function' ? win.performance.now() : Date.now();
      const progress = Math.min(1, Math.max(0, (now - zoomStartMs) / PORTAL_DURATION_MS));
      const holdOrb = snap.authStatus === 'signed-in';
      const signedInPortal = SIGNED_IN_ZOOM_PORTAL * (1 - ((1 - progress) * (1 - progress)));
      orbInstance?.setScene({
        portal: holdOrb ? signedInPortal : progress,
        interior: holdOrb ? 0 : (progress >= 1 ? 1 : 0),
        hover: 0,
        pointerX: holdOrb ? 0 : pointerX,
        pointerY: holdOrb ? 0 : pointerY,
        active: true,
      });
      if (progress >= 1) {
        finishZoomTransition();
        return;
      }
      if (typeof win.requestAnimationFrame === 'function') {
        zoomFrameId = win.requestAnimationFrame(step);
      } else {
        zoomFrameId = setTimeout(step, 16);
      }
    };

    if (typeof win.requestAnimationFrame === 'function') {
      zoomFrameId = win.requestAnimationFrame(step);
    } else {
      zoomFrameId = setTimeout(step, 16);
    }
  }

  function isRunValid(runId, startGen) {
    if (disposed || runId !== asyncSeq) return false;
    const currentGen = machine.read().generation;
    if (startGen !== null && currentGen !== null && currentGen !== startGen) return false;
    return true;
  }

  function isEnterRunValid(runId, startGen, startAccountKey) {
    if (disposed || runId !== asyncSeq) return false;
    const cur = machine.read();
    if (cur.phase !== 'entering') return false;
    if (startAccountKey !== null) {
      return cur.accountKey === startAccountKey;
    }
    if (startGen !== null && currentGenMismatch(startGen, cur.generation)) {
      return false;
    }
    return true;
  }

  function currentGenMismatch(startGen, nextGen) {
    return startGen !== null && nextGen !== null && nextGen !== startGen;
  }

  function buildPurposeContext(stateSnapshot, extra = {}) {
    const origin = stateSnapshot.purposeOrigin || (stateSnapshot.enteredOnce ? 'manual' : 'browse');
    const accountKey = origin === 'entering'
      ? stateSnapshot.purposeAccountKey
      : stateSnapshot.accountKey;
    const purposeMode = origin === 'entering'
      ? (stateSnapshot.purposeMode || 'onboarding')
      : null;
    return {
      origin,
      purposeMode,
      returnPhase: stateSnapshot.purposeReturnPhase || null,
      ...(extra.returnTarget ? { returnTarget: extra.returnTarget } : {}),
      generation: stateSnapshot.generation,
      accountKey,
    };
  }

  function isPurposeRunValid(runId, context) {
    if (disposed || runId !== asyncSeq) return false;
    const cur = machine.read();
    if (cur.phase !== 'purpose' || cur.purposeOrigin !== context.origin) return false;
    if (context.origin === 'entering') {
      if (!context.accountKey) return false;
      if ((cur.purposeMode || 'onboarding') !== (context.purposeMode || 'onboarding')) return false;
      return cur.purposeAccountKey === context.accountKey && cur.accountKey === context.accountKey;
    }
    if (context.accountKey !== null && cur.accountKey !== context.accountKey) {
      return false;
    }
    return true;
  }

  function buildWorkspaceContext(stateSnapshot) {
    return {
      generation: stateSnapshot.generation,
      accountKey: stateSnapshot.workspaceAccountKey || stateSnapshot.accountKey,
      workspace: stateSnapshot.workspace,
      state: stateSnapshot,
    };
  }

  function isWorkspaceRunValid(runId, context) {
    if (disposed || runId !== asyncSeq) return false;
    const cur = machine.read();
    if (cur.phase !== 'workspace') return false;
    if (!context.accountKey) return false;
    return cur.workspaceAccountKey === context.accountKey && cur.accountKey === context.accountKey;
  }

  async function triggerEnter() {
    if (disposed || busyAction !== null) return;
    if (typeof options.onEnter !== 'function') {
      machine.failEnter('작업 공간 연결 동작이 설정되지 않았어요.');
      render();
      return;
    }
    const snapshotAtStart = machine.read();
    const runId = ++asyncSeq;
    const startGen = snapshotAtStart.generation;
    const startAccountKey = snapshotAtStart.accountKey;
    busyAction = 'enter';
    syncButtonsDisabled();

    try {
      const pending = options.onEnter({
        generation: startGen,
        accountKey: startAccountKey,
        state: snapshotAtStart,
      });
      const result = await pending;
      if (!isEnterRunValid(runId, startGen, startAccountKey)) return;
      if (result && result.ok === false) {
        const msg = typeof result.message === 'string' && result.message.trim()
          ? result.message.trim()
          : '배정된 작업 공간을 열지 못했어요. 다시 시도해 주세요.';
        machine.failEnter(msg);
      } else if (
        result
        && (result.action === 'workspace' || (result.workspace && typeof result.workspace === 'object'))
      ) {
        workspaceNeedsRetry = false;
        clearFeedbackMessages();
        const moved = machine.enterToWorkspace(result.workspace || {});
        if (!moved.ok) {
          machine.failEnter('작업 공간 정보를 표시하지 못했어요. 다시 시도해 주세요.');
        }
      } else if (result && result.action === 'purpose') {
        workspaceNeedsRetry = false;
        clearFeedbackMessages();
        purposeTriggerEl = null;
        const nextPurposeMode = result.purposeMode === 'existing' ? 'existing' : 'onboarding';
        const moved = machine.enterToPurpose({ mode: nextPurposeMode });
        if (!moved.ok) {
          if (nextPurposeMode === 'existing') {
            machine.failEnter('계정 연결 상태를 확인하지 못했어요. 다시 시도해 주세요.');
          } else {
            navigationHoldActive = false;
            machine.completeEnter();
          }
        }
      } else {
        workspaceNeedsRetry = false;
        navigationHoldActive = result?.navigationRequested === true;
        machine.completeEnter();
      }
    } catch (err) {
      if (!isEnterRunValid(runId, startGen, startAccountKey)) return;
      const safeMsg = typeof err?.userMessage === 'string' && err.userMessage.trim()
        ? err.userMessage.trim()
        : '배정된 작업 공간을 불러오지 못했어요. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.';
      machine.failEnter(safeMsg);
    } finally {
      if (runId === asyncSeq) busyAction = null;
      if (!disposed) render();
    }
  }

  async function runSelectWorkspace(destination) {
    const normalizedDest = normalizePortalWorkspaceDestination(destination);
    if (disposed || busyAction !== null || !normalizedDest) return false;
    const snap = machine.read();
    if (snap.phase !== 'workspace' || !snap.workspace?.destinations?.includes(normalizedDest)) {
      return false;
    }
    if (!snap.accountKey || snap.generation === null || snap.workspaceAccountKey !== snap.accountKey) {
      if (workspaceErrorEl) {
        workspaceErrorEl.textContent = '계정 연결 상태를 확인하지 못했어요. 다시 시도해 주세요.';
        workspaceErrorEl.hidden = false;
      }
      render();
      return false;
    }
    if (typeof options.onSelectWorkspace !== 'function') {
      workspaceNeedsRetry = false;
      navigationHoldActive = false;
      machine.completeEnter();
      render();
      return true;
    }

    clearFeedbackMessages();
    const context = buildWorkspaceContext(snap);
    const runId = ++asyncSeq;
    busyAction = 'select-workspace';
    syncButtonsDisabled();

    try {
      const pending = options.onSelectWorkspace(normalizedDest, context);
      const result = await pending;
      if (!isWorkspaceRunValid(runId, context)) return false;
      if (result && result.ok === false) {
        workspaceNeedsRetry = true;
        if (result.workspace && typeof result.workspace === 'object') {
          machine.updateWorkspace(result.workspace, { accountKey: context.accountKey });
        }
        if (workspaceErrorEl) {
          workspaceErrorEl.textContent = typeof result.message === 'string' && result.message.trim()
            ? result.message.trim()
            : '선택한 작업 공간을 열지 못했어요. 다시 확인한 뒤 시도해 주세요.';
          workspaceErrorEl.hidden = false;
        }
        return false;
      }
      workspaceNeedsRetry = false;
      navigationHoldActive = result?.navigationRequested === true;
      machine.completeEnter();
      return true;
    } catch {
      if (!isWorkspaceRunValid(runId, context)) return false;
      workspaceNeedsRetry = true;
      if (workspaceErrorEl) {
        workspaceErrorEl.textContent = '선택한 작업 공간을 열지 못했어요. 다시 확인한 뒤 시도해 주세요.';
        workspaceErrorEl.hidden = false;
      }
      return false;
    } finally {
      if (runId === asyncSeq) busyAction = null;
      if (!disposed) render();
    }
  }

  async function runRetryWorkspace() {
    if (disposed || busyAction !== null) return false;
    const snap = machine.read();
    if (snap.phase !== 'workspace') return false;
    const handler = typeof options.onRetryWorkspace === 'function'
      ? options.onRetryWorkspace
      : options.onEnter;
    if (typeof handler !== 'function') return false;
    if (!snap.accountKey || snap.generation === null || snap.workspaceAccountKey !== snap.accountKey) {
      if (workspaceErrorEl) {
        workspaceErrorEl.textContent = '계정 연결 상태를 확인하지 못했어요. 다시 시도해 주세요.';
        workspaceErrorEl.hidden = false;
      }
      render();
      return false;
    }

    clearFeedbackMessages();
    const context = buildWorkspaceContext(snap);
    const runId = ++asyncSeq;
    busyAction = 'retry-workspace';
    syncButtonsDisabled();
    let refocusWorkspace = false;

    try {
      const pending = handler(context);
      const result = await pending;
      if (!isWorkspaceRunValid(runId, context)) return false;
      if (result && result.ok === false) {
        if (result.workspace && typeof result.workspace === 'object') {
          machine.enterToWorkspace(result.workspace);
          refocusWorkspace = true;
        }
        if (workspaceErrorEl) {
          workspaceErrorEl.textContent = typeof result.message === 'string' && result.message.trim()
            ? result.message.trim()
            : '작업 공간을 다시 확인하지 못했어요. 잠시 뒤 다시 시도해 주세요.';
          workspaceErrorEl.hidden = false;
        }
        return false;
      }
      if (
        result
        && (result.action === 'workspace' || (result.workspace && typeof result.workspace === 'object'))
      ) {
        workspaceNeedsRetry = false;
        machine.enterToWorkspace(result.workspace || {});
        refocusWorkspace = true;
        return true;
      }
      if (result && result.action === 'purpose') {
        workspaceNeedsRetry = false;
        purposeTriggerEl = null;
        const nextPurposeMode = result.purposeMode === 'existing' ? 'existing' : 'onboarding';
        const moved = machine.workspaceToPurpose({
          mode: nextPurposeMode,
          returnToWorkspace: false,
        });
        if (!moved.ok) {
          if (nextPurposeMode === 'existing') {
            if (workspaceErrorEl) {
              workspaceErrorEl.textContent = '계정 연결 상태를 확인하지 못했어요. 다시 시도해 주세요.';
              workspaceErrorEl.hidden = false;
            }
            return false;
          }
          navigationHoldActive = false;
          machine.completeEnter();
        }
        return true;
      }
      workspaceNeedsRetry = false;
      navigationHoldActive = result?.navigationRequested === true;
      machine.completeEnter();
      return true;
    } catch {
      if (!isWorkspaceRunValid(runId, context)) return false;
      if (workspaceErrorEl) {
        workspaceErrorEl.textContent = '작업 공간을 다시 확인하지 못했어요. 잠시 뒤 다시 시도해 주세요.';
        workspaceErrorEl.hidden = false;
      }
      return false;
    } finally {
      if (runId === asyncSeq) busyAction = null;
      if (!disposed) {
        render();
        if (refocusWorkspace && machine.read().phase === 'workspace') {
          moveFocusIntoPhase('workspace', 'workspace');
        }
      }
    }
  }

  async function runContinuePersonal() {
    if (disposed || busyAction !== null) return false;
    const snap = machine.read();
    if (snap.phase !== 'workspace' || snap.workspace?.canContinuePersonal === false) return false;
    if (!snap.accountKey || snap.generation === null || snap.workspaceAccountKey !== snap.accountKey) {
      if (workspaceErrorEl) {
        workspaceErrorEl.textContent = '계정 연결 상태를 확인하지 못했어요. 다시 시도해 주세요.';
        workspaceErrorEl.hidden = false;
      }
      render();
      return false;
    }

    clearFeedbackMessages();
    if (typeof options.onContinuePersonal !== 'function') {
      workspaceNeedsRetry = false;
      machine.completeEnter();
      render();
      return true;
    }

    const context = buildWorkspaceContext(snap);
    const runId = ++asyncSeq;
    busyAction = 'continue-personal';
    syncButtonsDisabled();

    try {
      const result = await options.onContinuePersonal(context);
      if (!isWorkspaceRunValid(runId, context)) return false;
      if (result && result.ok === false) {
        if (workspaceErrorEl) {
          workspaceErrorEl.textContent = typeof result.message === 'string' && result.message.trim()
            ? result.message.trim()
            : '개인 화면을 열지 못했어요. 다시 시도해 주세요.';
          workspaceErrorEl.hidden = false;
        }
        return false;
      }
      workspaceNeedsRetry = false;
      if (result && result.action === 'purpose') {
        purposeTriggerEl = null;
        const nextPurposeMode = result.purposeMode === 'existing' ? 'existing' : 'onboarding';
        const moved = machine.workspaceToPurpose({
          mode: nextPurposeMode,
          returnToWorkspace: nextPurposeMode === 'existing',
        });
        if (!moved.ok) {
          if (nextPurposeMode === 'existing') {
            if (workspaceErrorEl) {
              workspaceErrorEl.textContent = '계정 연결 상태를 확인하지 못했어요. 다시 시도해 주세요.';
              workspaceErrorEl.hidden = false;
            }
            return false;
          }
          machine.completeEnter();
        }
        return true;
      }
      machine.completeEnter();
      return true;
    } catch {
      if (!isWorkspaceRunValid(runId, context)) return false;
      if (workspaceErrorEl) {
        workspaceErrorEl.textContent = '개인 화면을 열지 못했어요. 다시 시도해 주세요.';
        workspaceErrorEl.hidden = false;
      }
      return false;
    } finally {
      if (runId === asyncSeq) busyAction = null;
      if (!disposed) render();
    }
  }

  async function runAuthCallback(name, fn) {
    if (disposed || busyAction !== null || typeof fn !== 'function') return;
    clearFeedbackMessages();
    const runId = ++asyncSeq;
    const startGen = machine.read().generation;
    busyAction = name;
    machine.beginSignIn();
    render();

    try {
      const result = await fn();
      if (!isRunValid(runId, startGen)) return;
      if (result && result.ok === false) {
        const cancelled = result.code === 'AUTH_CANCELLED';
        machine.receiveAuth({
          status: 'signed-out',
          generation: startGen,
        });
        machine.showAuthPanel();
        if (!cancelled && authFeedbackEl) {
          authFeedbackEl.textContent = typeof result.message === 'string' && result.message.trim()
            ? result.message.trim()
            : '로그인을 시작하지 못했어요. 다시 시도해 주세요.';
          authFeedbackEl.hidden = false;
        }
      }
    } catch {
      if (!isRunValid(runId, startGen)) return;
      machine.receiveAuth({
        status: 'error',
        generation: startGen,
        errorMessage: '로그인 화면을 열지 못했어요. 잠시 뒤 다시 시도해 주세요.',
        retryable: false,
      });
    } finally {
      if (runId === asyncSeq) busyAction = null;
      if (!disposed) render();
    }
  }

  async function runSignUp() {
    if (disposed || busyAction !== null || typeof options.onSignUp !== 'function') return;
    clearFeedbackMessages();
    const runId = ++asyncSeq;
    const startGen = machine.read().generation;
    busyAction = 'signup';
    syncButtonsDisabled();

    try {
      const result = await options.onSignUp();
      if (!isRunValid(runId, startGen)) return;
      if (result && result.ok === false && authFeedbackEl) {
        authFeedbackEl.textContent = typeof result.message === 'string' && result.message.trim()
          ? result.message.trim()
          : '회원가입 화면을 열지 못했어요. 잠시 뒤 다시 시도해 주세요.';
        authFeedbackEl.hidden = false;
      }
    } catch {
      if (!isRunValid(runId, startGen)) return;
      if (authFeedbackEl) {
        authFeedbackEl.textContent = '회원가입 화면을 열지 못했어요. 잠시 뒤 다시 시도해 주세요.';
        authFeedbackEl.hidden = false;
      }
    } finally {
      if (runId === asyncSeq) busyAction = null;
      if (!disposed) syncButtonsDisabled();
    }
  }

  async function runBrowse(triggerElement = null) {
    if (disposed || busyAction !== null || typeof options.onBrowse !== 'function') return;
    clearFeedbackMessages();
    const runId = ++asyncSeq;
    const startGen = machine.read().generation;
    busyAction = 'browse';
    syncButtonsDisabled();

    try {
      const result = await options.onBrowse();
      if (!isRunValid(runId, startGen)) return;
      if (result && result.ok === false) {
        if (authFeedbackEl && machine.read().phase === 'auth') {
          authFeedbackEl.textContent = typeof result.message === 'string' && result.message.trim()
            ? result.message.trim()
            : '화면을 열지 못했어요. 다시 눌러 주세요.';
          authFeedbackEl.hidden = false;
        }
      } else if (result && result.action === 'purpose') {
        purposeTriggerEl = triggerElement && triggerElement !== doc?.body ? triggerElement : null;
        machine.openPurpose({ origin: 'browse' });
      } else {
        purposeTriggerEl = null;
        machine.completeBrowse();
      }
    } catch {
      if (!isRunValid(runId, startGen)) return;
      if (authFeedbackEl && machine.read().phase === 'auth') {
        authFeedbackEl.textContent = '화면을 열지 못했어요. 다시 눌러 주세요.';
        authFeedbackEl.hidden = false;
      }
    } finally {
      if (runId === asyncSeq) busyAction = null;
      if (!disposed) render();
    }
  }

  function isInviteRunValid(runId, startGen, startAccountKey) {
    if (!isRunValid(runId, startGen)) return false;
    const cur = machine.read();
    return cur.phase === 'invite' && cur.accountKey === startAccountKey;
  }

  async function runInviteSubmit() {
    if (disposed || busyAction !== null || typeof options.onInvite !== 'function') return;
    if (inviteErrorEl) inviteErrorEl.textContent = '';
    clearInviteStatus();

    const rawValue = inviteInput ? inviteInput.value : '';
    const validated = validatePortalInviteInput(rawValue);
    if (!validated.ok) {
      if (inviteErrorEl) inviteErrorEl.textContent = validated.message;
      inviteInput?.focus?.({ preventScroll: true });
      return;
    }

    const snapAtStart = machine.read();
    const runId = ++asyncSeq;
    const startGen = snapAtStart.generation;
    const startAccountKey = snapAtStart.accountKey;
    busyAction = 'invite';
    syncButtonsDisabled();
    if (!doc?.hidden && (!doc?.activeElement || !root.contains(doc.activeElement) || doc.activeElement.disabled)) {
      closeInviteBtn?.focus?.({ preventScroll: true });
    }

    let shouldFocusInput = false;
    try {
      const pending = options.onInvite(validated.value, {
        kind: validated.kind,
        pathname: validated.pathname,
      });
      const result = await pending;
      if (!isInviteRunValid(runId, startGen, startAccountKey)) return;
      if (result && result.ok === false) {
        if (inviteInput && inviteInput.value !== rawValue) {
          inviteInput.value = rawValue;
        }
        if (inviteErrorEl) {
          const safeMessage = sanitizeInviteFeedback(result.message, rawValue, validated.value);
          inviteErrorEl.textContent = safeMessage
            || '유효하지 않거나 만료된 초대코드예요. 전달받은 코드를 다시 확인해 주세요.';
        }
        shouldFocusInput = true;
        return;
      }
      clearInviteInput();
      if (result && result.keepOpen === true) {
        if (inviteStatusEl) {
          const safeStatus = sanitizeInviteFeedback(result.statusMessage, rawValue, validated.value)
            || (result.state === 'received' ? '열린 작업 공간 창에서 초대 입장을 이어서 진행해 주세요.' : '');
          if (safeStatus) {
            inviteStatusEl.textContent = safeStatus;
            inviteStatusEl.hidden = false;
          }
        }
        shouldFocusInput = true;
        return;
      }
      machine.completeEnter();
    } catch {
      if (!isInviteRunValid(runId, startGen, startAccountKey)) return;
      if (inviteInput && inviteInput.value !== rawValue) {
        inviteInput.value = rawValue;
      }
      if (inviteErrorEl) {
        inviteErrorEl.textContent = '초대코드를 확인하지 못했어요. 잠시 뒤 다시 입력해 주세요.';
      }
      shouldFocusInput = true;
    } finally {
      if (runId === asyncSeq) {
        busyAction = null;
        if (!disposed) {
          render();
          if (shouldFocusInput && machine.read().phase === 'invite') {
            inviteInput?.focus?.({ preventScroll: true });
          }
        }
      }
    }
  }

  async function runRetryAuth() {
    if (disposed || busyAction !== null || typeof options.onRetry !== 'function') return;
    const runId = ++asyncSeq;
    const startGen = machine.read().generation;
    busyAction = 'retry';
    machine.beginRetryCheck();
    render();

    try {
      const result = await options.onRetry();
      if (!isRunValid(runId, startGen)) return;
      if (result && result.ok === false) {
        machine.receiveAuth({
          status: 'error',
          generation: machine.read().generation,
          errorMessage: typeof result.message === 'string' && result.message.trim()
            ? result.message.trim()
            : '저장된 로그인을 다시 확인하지 못했어요.',
          retryable: true,
          immediate: isImmediateEntry(),
        });
      }
    } catch {
      if (!isRunValid(runId, startGen)) return;
      machine.receiveAuth({
        status: 'error',
        generation: machine.read().generation,
        errorMessage: '네트워크 연결을 확인한 뒤 다시 눌러 주세요.',
        retryable: true,
        immediate: isImmediateEntry(),
      });
    } finally {
      if (runId === asyncSeq) busyAction = null;
      if (!disposed) render();
    }
  }

  async function runCancelSignIn() {
    if (disposed || typeof options.onCancelSignIn !== 'function') return;
    const runId = ++asyncSeq;
    busyAction = 'cancel';
    syncButtonsDisabled();
    try {
      await options.onCancelSignIn();
      if (disposed || runId !== asyncSeq) return;
      machine.receiveAuth({ status: 'signed-out', generation: machine.read().generation });
      machine.showAuthPanel();
    } catch {
      // 취소 실패 시 호스트의 다음 상태 통지를 기다린다.
    } finally {
      if (runId === asyncSeq) busyAction = null;
      if (!disposed) render();
    }
  }

  async function runSwitchAccount() {
    if (disposed || busyAction !== null || typeof options.onSwitchAccount !== 'function') return;
    const runId = ++asyncSeq;
    busyAction = 'switch';
    syncButtonsDisabled();
    try {
      await options.onSwitchAccount();
      if (disposed || runId !== asyncSeq) return;
      workspaceNeedsRetry = false;
      machine.reopenAuth({ status: 'signed-out' });
    } catch {
      // 전환 실패 시 현재 오류 화면을 유지한다.
    } finally {
      if (runId === asyncSeq) busyAction = null;
      if (!disposed) render();
    }
  }

  async function runSelectPurpose(purposeId) {
    if (disposed || busyAction !== null || !PORTAL_ALLOWED_PURPOSES.includes(purposeId)) return false;
    const snap = machine.read();
    if (snap.phase !== 'purpose') return false;
    if (snap.purposeOrigin === 'entering' && snap.purposeMode === 'existing' && purposeId === 'home') {
      return false;
    }
    if (typeof options.onSelectPurpose !== 'function') {
      return closePurposePicker();
    }
    const context = buildPurposeContext(snap);
    if (
      context.origin === 'entering'
      && (!context.accountKey || context.generation === null || snap.accountKey !== context.accountKey)
    ) {
      if (purposeErrorEl) {
        purposeErrorEl.textContent = '계정 연결 상태를 확인하지 못했어요. 다시 시도해 주세요.';
        purposeErrorEl.hidden = false;
      }
      render();
      return false;
    }

    clearFeedbackMessages();
    const runId = ++asyncSeq;
    busyAction = 'purpose';
    syncButtonsDisabled();

    try {
      const result = await options.onSelectPurpose(purposeId, context);
      if (!isPurposeRunValid(runId, context)) return false;
      if (result && result.ok === false) {
        if (purposeErrorEl) {
          purposeErrorEl.textContent = typeof result.message === 'string' && result.message.trim()
            ? result.message.trim()
            : '선택한 화면을 열지 못했어요. 다시 시도해 주세요.';
          purposeErrorEl.hidden = false;
        }
        return false;
      }
      purposeTriggerEl = null;
      if (context.origin === 'entering') {
        machine.completeEnter();
      } else {
        machine.completeBrowse();
      }
      return true;
    } catch {
      if (!isPurposeRunValid(runId, context)) return false;
      if (purposeErrorEl) {
        purposeErrorEl.textContent = '선택한 화면을 열지 못했어요. 다시 시도해 주세요.';
        purposeErrorEl.hidden = false;
      }
      return false;
    } finally {
      if (runId === asyncSeq) busyAction = null;
      if (!disposed) render();
    }
  }

  function closeInvitePanel() {
    const hadBusyInvite = busyAction === 'invite';
    if (hadBusyInvite) {
      asyncSeq += 1;
      busyAction = null;
    }
    clearInviteInput();
    machine.closeInvite();
    if (hadBusyInvite) {
      options.onCancelInvite?.();
    }
    render();
  }

  function openPurposePicker(triggerElement = doc?.activeElement) {
    if (disposed || busyAction !== null || navigationHoldActive) return false;
    const snap = machine.read();
    if (snap.phase === 'zooming' || snap.phase === 'entering' || snap.phase === 'workspace') return false;
    if (snap.phase === 'purpose' && snap.purposeOrigin === 'entering') return false;
    purposeTriggerEl = triggerElement && triggerElement !== doc?.body ? triggerElement : null;
    clearFeedbackMessages();
    machine.openPurpose({ origin: snap.enteredOnce || snap.phase === 'entered' ? 'manual' : 'browse' });
    render();
    return true;
  }

  async function runEnteringDismissPurpose(snap, opts = {}) {
    const forceWelcome = opts?.forceWelcome === true;
    const isExisting = snap.purposeMode === 'existing';
    const context = buildPurposeContext(
      snap,
      isExisting
        ? { returnTarget: forceWelcome ? 'welcome' : (snap.purposeReturnPhase === 'workspace' ? 'workspace' : 'welcome') }
        : {},
    );
    if (!context.accountKey || context.generation === null || snap.accountKey !== context.accountKey) {
      if (purposeErrorEl) {
        purposeErrorEl.textContent = '계정 연결 상태를 확인하지 못했어요. 다시 시도해 주세요.';
        purposeErrorEl.hidden = false;
      }
      render();
      return false;
    }

    clearFeedbackMessages();
    if (typeof options.onDismissPurpose !== 'function') {
      purposeTriggerEl = null;
      if (isExisting) {
        const returned = machine.returnFromExistingPurpose({ forceWelcome });
        if (!returned.ok) {
          if (purposeErrorEl) {
            purposeErrorEl.textContent = '계정 연결 상태를 확인하지 못했어요. 다시 시도해 주세요.';
            purposeErrorEl.hidden = false;
          }
          render();
          return false;
        }
        render();
        return true;
      }
      machine.completeEnter();
      render();
      return true;
    }

    const runId = ++asyncSeq;
    busyAction = 'dismiss-purpose';
    syncButtonsDisabled();
    const fallbackDismissError = isExisting
      ? '이전 화면으로 돌아가지 못했어요. 다시 시도해 주세요.'
      : '기본 화면을 열지 못했어요. 다시 시도해 주세요.';

    try {
      const result = await options.onDismissPurpose(context);
      if (!isPurposeRunValid(runId, context)) return false;
      if (result && result.ok === false) {
        if (purposeErrorEl) {
          purposeErrorEl.textContent = typeof result.message === 'string' && result.message.trim()
            ? result.message.trim()
            : fallbackDismissError;
          purposeErrorEl.hidden = false;
        }
        return false;
      }
      purposeTriggerEl = null;
      if (isExisting) {
        const returned = machine.returnFromExistingPurpose({ forceWelcome });
        if (!returned.ok) {
          if (purposeErrorEl) {
            purposeErrorEl.textContent = '계정 연결 상태를 확인하지 못했어요. 다시 시도해 주세요.';
            purposeErrorEl.hidden = false;
          }
          return false;
        }
        return true;
      }
      machine.completeEnter();
      return true;
    } catch {
      if (!isPurposeRunValid(runId, context)) return false;
      if (purposeErrorEl) {
        purposeErrorEl.textContent = fallbackDismissError;
        purposeErrorEl.hidden = false;
      }
      return false;
    } finally {
      if (runId === asyncSeq) busyAction = null;
      if (!disposed) render();
    }
  }

  function closePurposePicker() {
    if (disposed || busyAction !== null) return Promise.resolve(false);
    const snap = machine.read();
    if (snap.phase !== 'purpose') return Promise.resolve(false);

    if (snap.purposeOrigin === 'entering') {
      return runEnteringDismissPurpose(snap);
    }

    clearFeedbackMessages();
    const trigger = purposeTriggerEl;
    purposeTriggerEl = null;
    machine.closePurpose();
    render();
    if (trigger?.isConnected && (!machine.read().active || isElementVisible(trigger))) {
      trigger.focus?.({ preventScroll: true });
    }
    return Promise.resolve(true);
  }

  function applyAuthUpdate(patch = {}) {
    if (disposed) return machine.read();
    if (typeof patch.reducedMotion === 'boolean') {
      hostReducedMotion = patch.reducedMotion;
    }
    const authPatch = {
      status: patch.status,
      generation: patch.generation,
      errorMessage: patch.errorMessage,
      retryable: patch.retryable,
      immediate: isImmediateEntry(),
    };
    if (Object.hasOwn(patch, 'accountKey')) {
      authPatch.accountKey = patch.accountKey;
    }
    const result = machine.receiveAuth(authPatch);
    if (!result.accepted) return result.state;
    if (
      navigationHoldActive
      && (
        result.state.phase !== 'entered'
        || result.accountChanged
        || result.bindingInvalidated
        || result.state.authStatus === 'signing-in'
      )
    ) {
      navigationHoldActive = false;
    }
    if (
      result.accountChanged
      || result.bindingInvalidated
      || (busyAction === 'invite' && result.state.phase !== 'invite')
    ) {
      const hadBusyInvite = busyAction === 'invite';
      workspaceNeedsRetry = false;
      if (busyAction !== null) {
        asyncSeq += 1;
        busyAction = null;
      }
      clearInviteInput();
      if (hadBusyInvite) {
        options.onCancelInvite?.();
      }
    }
    if (result.shouldStartZoom) {
      startZoomTransition();
      return machine.read();
    }
    render();
    if (result.shouldTriggerEnter && busyAction === null) {
      void triggerEnter();
    }
    return machine.read();
  }

  const onRootClick = event => {
    if (disposed) return;
    const workspaceBtn = event.target.closest?.('[data-portal-workspace]');
    if (workspaceBtn && root.contains(workspaceBtn)) {
      event.preventDefault();
      void runSelectWorkspace(workspaceBtn.dataset.portalWorkspace);
      return;
    }

    const purposeBtn = event.target.closest?.('[data-portal-purpose]');
    if (purposeBtn && root.contains(purposeBtn)) {
      event.preventDefault();
      void runSelectPurpose(purposeBtn.dataset.portalPurpose);
      return;
    }

    const actionBtn = event.target.closest?.('[data-portal-action]');
    if (!actionBtn || !root.contains(actionBtn)) return;
    const action = actionBtn.dataset.portalAction;

    if (action === 'orb') {
      event.preventDefault();
      const result = machine.activateOrb({ immediate: isImmediateEntry() });
      if (!result.changed) return;
      if (result.shouldStartZoom) {
        startZoomTransition();
      } else {
        render();
        if (result.shouldTriggerEnter) void triggerEnter();
      }
      return;
    }

    if (action === 'back-welcome') {
      event.preventDefault();
      if (busyAction !== null) return;
      const snap = machine.read();
      if (snap.phase === 'purpose' && snap.purposeOrigin === 'entering' && snap.purposeMode === 'existing') {
        void runEnteringDismissPurpose(snap, { forceWelcome: true });
        return;
      }
      clearFeedbackMessages();
      machine.showWelcomeOrb();
      render();
      return;
    }

    if (action === 'google') {
      event.preventDefault();
      void runAuthCallback('google', options.onGoogleSignIn);
      return;
    }

    if (action === 'email') {
      event.preventDefault();
      void runAuthCallback('email', options.onEmailSignIn);
      return;
    }

    if (action === 'signin') {
      event.preventDefault();
      // PC 단일 로그인 계약에서는 없는 공급자 인자를 전달하지 않는다.
      void runAuthCallback('signin', () => options.onSignIn());
      return;
    }

    if (action === 'signup') {
      event.preventDefault();
      void runSignUp();
      return;
    }

    if (action === 'open-invite') {
      event.preventDefault();
      if (busyAction !== null || typeof options.onInvite !== 'function') return;
      inviteTriggerEl = actionBtn;
      clearInviteInput();
      clearFeedbackMessages();
      machine.openInvite();
      render();
      return;
    }

    if (action === 'close-invite') {
      event.preventDefault();
      if (busyAction !== null && busyAction !== 'invite') return;
      if (machine.read().phase !== 'invite') return;
      closeInvitePanel();
      return;
    }

    if (action === 'browse' || action === 'status-browse') {
      event.preventDefault();
      void runBrowse(actionBtn);
      return;
    }

    if (action === 'retry-enter') {
      event.preventDefault();
      const retry = machine.retryEnter();
      render();
      if (retry.shouldTriggerEnter) void triggerEnter();
      return;
    }

    if (action === 'retry-workspace') {
      event.preventDefault();
      void runRetryWorkspace();
      return;
    }

    if (action === 'workspace-switch-account') {
      event.preventDefault();
      void runSwitchAccount();
      return;
    }

    if (action === 'continue-personal') {
      event.preventDefault();
      void runContinuePersonal();
      return;
    }

    if (action === 'retry-auth') {
      event.preventDefault();
      void runRetryAuth();
      return;
    }

    if (action === 'go-auth') {
      event.preventDefault();
      if (busyAction !== null) return;
      clearFeedbackMessages();
      machine.showAuthPanel();
      render();
      return;
    }

    if (action === 'switch-account') {
      event.preventDefault();
      void runSwitchAccount();
      return;
    }

    if (action === 'cancel-signin') {
      event.preventDefault();
      void runCancelSignIn();
      return;
    }

    if (action === 'close-purpose') {
      event.preventDefault();
      if (busyAction !== null) return;
      void closePurposePicker();
    }
  };

  const onInviteFormSubmit = event => {
    event.preventDefault();
    void runInviteSubmit();
  };

  const onInviteInput = () => {
    if (inviteErrorEl) inviteErrorEl.textContent = '';
    clearInviteStatus();
  };

  function releaseNavigationHold() {
    if (disposed || !navigationHoldActive) return false;
    navigationHoldActive = false;
    render();
    return true;
  }

  const onRootKeyDown = event => {
    if (disposed || !(machine.read().active || navigationHoldActive)) return;

    if (event.key === 'Escape') {
      const snap = machine.read();
      const phase = snap.phase;
      if (phase === 'invite' && (busyAction === null || busyAction === 'invite')) {
        event.preventDefault();
        event.stopPropagation();
        closeInvitePanel();
        return;
      }
      if (busyAction !== null) return;
      if (phase === 'workspace' && snap.workspace?.canContinuePersonal !== false) {
        event.preventDefault();
        event.stopPropagation();
        void runContinuePersonal();
        return;
      }
      if (phase === 'purpose') {
        event.preventDefault();
        event.stopPropagation();
        void closePurposePicker();
        return;
      }
      if (phase === 'auth' && !snap.enteredOnce) {
        event.preventDefault();
        event.stopPropagation();
        clearFeedbackMessages();
        machine.showWelcomeOrb();
        render();
      }
      return;
    }

    if (event.key === 'Tab') {
      const items = focusableInPortal();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const activeEl = doc?.activeElement;
      if (event.shiftKey) {
        if (!root.contains(activeEl) || activeEl === first) {
          event.preventDefault();
          last.focus?.({ preventScroll: true });
        }
      } else if (!root.contains(activeEl) || activeEl === last) {
        event.preventDefault();
        first.focus?.({ preventScroll: true });
      }
    }
  };

  const onDocKeyDown = event => {
    if (disposed || !(machine.read().active || navigationHoldActive)) return;
    if (event.target && root.contains(event.target)) return;
    onRootKeyDown(event);
  };

  const onDocFocusIn = event => {
    if (disposed || !(machine.read().active || navigationHoldActive)) return;
    if (event.target && root.contains(event.target)) return;
    const items = focusableInPortal();
    if (items.length > 0) {
      items[0]?.focus?.({ preventScroll: true });
    } else {
      root.setAttribute('tabindex', '-1');
      root.focus?.({ preventScroll: true });
    }
  };

  const onOrbPointerEnter = () => {
    hoverLevel = 1;
    if (machine.read().phase === 'welcome') {
      orb?.setScene({ hover: 1 });
    }
  };

  const onOrbPointerLeave = () => {
    hoverLevel = 0;
    pointerX = 0;
    pointerY = 0;
    if (machine.read().phase === 'welcome') {
      orb?.setScene({ hover: 0, pointerX: 0, pointerY: 0 });
    }
  };

  const onRootPointerMove = event => {
    if (disposed || machine.read().phase !== 'welcome' || prefersReducedMotion()) return;
    const w = win.innerWidth || 1;
    const h = win.innerHeight || 1;
    pointerX = Math.max(-0.5, Math.min(0.5, (event.clientX / w) - 0.5));
    pointerY = Math.max(-0.5, Math.min(0.5, (event.clientY / h) - 0.5));
    orb?.setScene({ pointerX, pointerY });
  };

  const onVisibilityChange = () => {
    if (disposed) return;
    const current = machine.read();
    // 이미 본문에 들어간 뒤에는 visibilitychange로 포털을 다시 열지 않는다.
    if (!current.active && !navigationHoldActive) return;
    if (doc?.hidden) {
      if (current.phase === 'zooming') {
        finishZoomTransition();
      } else {
        orb?.pause();
      }
      return;
    }
    if (
      current.phase === 'welcome'
      || current.phase === 'checking'
      || current.phase === 'entering'
      || navigationHoldActive
    ) {
      orb?.resume();
    }
  };

  const onPageHide = () => {
    clearInviteInput();
    orb?.pause();
  };

  const onPageShow = event => {
    if (event?.persisted === true) {
      releaseNavigationHold();
    }
  };

  root.addEventListener('click', onRootClick);
  root.addEventListener('keydown', onRootKeyDown);
  root.addEventListener('pointermove', onRootPointerMove, { passive: true });
  orbButton.addEventListener('pointerenter', onOrbPointerEnter);
  orbButton.addEventListener('pointerleave', onOrbPointerLeave);
  orbButton.addEventListener('focus', onOrbPointerEnter);
  orbButton.addEventListener('blur', onOrbPointerLeave);
  inviteForm.addEventListener('submit', onInviteFormSubmit);
  inviteInput?.addEventListener?.('input', onInviteInput);
  doc?.addEventListener?.('keydown', onDocKeyDown);
  doc?.addEventListener?.('focusin', onDocFocusIn);
  doc?.addEventListener?.('visibilitychange', onVisibilityChange);
  win.addEventListener?.('pagehide', onPageHide);
  if (options.managePageShow !== true) {
    win.addEventListener?.('pageshow', onPageShow);
  }

  // 초기 상태를 반영한다. 이미 signed-in으로 전달된 경우 즉시 자동 전환이나 진입을 수행한다.
  if (options.initialState?.bypass === true) {
    render();
  } else {
    applyAuthUpdate(options.initialState || { status: 'restoring' });
  }

  return {
    setState(patch = {}) {
      return applyAuthUpdate(patch);
    },
    getState() {
      return machine.read();
    },
    isActive() {
      return !disposed && (machine.read().active || navigationHoldActive);
    },
    shouldBlockShortcuts() {
      return !disposed && (machine.read().blockShortcuts || navigationHoldActive);
    },
    releaseNavigationHold,
    setWorkspaceState(workspacePatch = {}, guard = {}) {
      if (disposed) return { ok: false, changed: false, state: machine.read() };
      const updated = machine.updateWorkspace(workspacePatch, guard);
      if (!updated.ok) return updated;
      workspaceNeedsRetry = false;
      if (workspaceErrorEl) {
        workspaceErrorEl.textContent = '';
        workspaceErrorEl.hidden = true;
      }
      render();
      if (
        !doc?.hidden
        && (!doc?.activeElement || !root.contains(doc.activeElement) || !isElementVisible(doc.activeElement))
      ) {
        moveFocusIntoPhase('workspace', 'workspace');
      }
      return updated;
    },
    completeWorkspaceEntry({
      action = 'entered',
      purposeMode: requestedPurposeMode,
      accountKey: expectedAccountKey,
      navigationRequested = false,
    } = {}) {
      if (disposed) return { ok: false, state: machine.read() };
      const snap = machine.read();
      if (snap.phase !== 'workspace' && snap.phase !== 'entering') {
        return { ok: false, state: snap };
      }
      if (expectedAccountKey !== undefined && snap.accountKey !== expectedAccountKey) {
        return { ok: false, state: snap };
      }
      if (snap.phase === 'workspace' && snap.workspaceAccountKey !== snap.accountKey) {
        return { ok: false, state: snap };
      }
      if (busyAction !== null) {
        asyncSeq += 1;
        busyAction = null;
      }
      workspaceNeedsRetry = false;
      clearFeedbackMessages();
      if (action === 'purpose') {
        purposeTriggerEl = null;
        const nextPurposeMode = requestedPurposeMode === 'existing' ? 'existing' : 'onboarding';
        const moved = snap.phase === 'workspace'
          ? machine.workspaceToPurpose({ mode: nextPurposeMode, returnToWorkspace: false })
          : machine.enterToPurpose({ mode: nextPurposeMode });
        if (!moved.ok) {
          if (nextPurposeMode === 'existing') {
            render();
            return { ok: false, state: machine.read() };
          }
          navigationHoldActive = false;
          machine.completeEnter();
        }
      } else {
        navigationHoldActive = navigationRequested === true;
        machine.completeEnter();
      }
      render();
      return { ok: true, state: machine.read() };
    },
    openPurposePicker,
    closePurposePicker,
    reopenAuth(patch = {}) {
      if (disposed) return machine.read();
      const hadBusyInvite = busyAction === 'invite';
      navigationHoldActive = false;
      workspaceNeedsRetry = false;
      asyncSeq += 1;
      busyAction = null;
      clearInviteInput();
      clearFeedbackMessages();
      if (hadBusyInvite) {
        options.onCancelInvite?.();
      }
      const next = machine.reopenAuth(patch);
      render();
      return next;
    },
    dispose() {
      if (disposed) return;
      const hadBusyInvite = busyAction === 'invite';
      disposed = true;
      navigationHoldActive = false;
      workspaceNeedsRetry = false;
      asyncSeq += 1;
      busyAction = null;
      stopZoomAnimation();
      clearInviteInput();
      if (hadBusyInvite) {
        options.onCancelInvite?.();
      }
      releaseOrb();

      root.removeEventListener('click', onRootClick);
      root.removeEventListener('keydown', onRootKeyDown);
      root.removeEventListener('pointermove', onRootPointerMove);
      orbButton.removeEventListener('pointerenter', onOrbPointerEnter);
      orbButton.removeEventListener('pointerleave', onOrbPointerLeave);
      orbButton.removeEventListener('focus', onOrbPointerEnter);
      orbButton.removeEventListener('blur', onOrbPointerLeave);
      inviteForm.removeEventListener('submit', onInviteFormSubmit);
      inviteInput?.removeEventListener?.('input', onInviteInput);
      doc?.removeEventListener?.('keydown', onDocKeyDown);
      doc?.removeEventListener?.('focusin', onDocFocusIn);
      doc?.removeEventListener?.('visibilitychange', onVisibilityChange);
      win.removeEventListener?.('pagehide', onPageHide);
      if (options.managePageShow !== true) {
        win.removeEventListener?.('pageshow', onPageShow);
      }

      restoreHostElements();
      root.classList.remove('portal-workspace-compact');
      root.hidden = true;
      root.dataset.portalActive = 'false';
      root.dataset.portalState = 'entered';
      delete root.dataset.portalAuthStatus;
      delete root.dataset.portalPurposeOrigin;
      delete root.dataset.portalPurposeMode;
      delete root.dataset.portalWorkspaceStatus;
      if (doc?.documentElement?.dataset) {
        delete doc.documentElement.dataset.portalActive;
      }
      root.innerHTML = '';
    },
  };
}
