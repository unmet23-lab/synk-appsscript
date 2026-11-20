'use strict';

(() => {
  if (location.search || location.hash) {
    try {
      history.replaceState(null, '', location.pathname);
    } catch {
      // Ignore history errors in restricted environments
    }
  }

  const isReceiptOnlyPath = /^\/story\/receipt\/?$/.test(location.pathname);
  const pathMatch = isReceiptOnlyPath ? null : /^\/story\/([A-Za-z0-9_-]{22})\/?$/.exec(location.pathname);
  const publicId = pathMatch ? pathMatch[1] : '';

  const pageState = {
    isReceiptOnlyPath,
    publicId,
    maxMessage: 4000,
    retentionDays: 90,
    submitting: false,
    pendingSubmit: {
      requestId: '',
      signature: '',
      lastRequestId: ''
    },
    currentReceipt: {
      receiptId: '',
      deleteToken: '',
      deleted: false
    }
  };

  const elTopbarLabel = document.getElementById('topbar-label');
  const elLoading = document.getElementById('story-loading');
  const elErrorState = document.getElementById('story-error-state');
  const elErrorTitle = document.getElementById('story-error-title');
  const elErrorDesc = document.getElementById('story-error-desc');
  const elErrorActions = document.getElementById('story-error-actions');
  const elReloadBtn = document.getElementById('story-reload-btn');

  const elContentWrap = document.getElementById('story-content-wrap');
  const elDisplayName = document.getElementById('story-display-name');
  const elDateSep = document.getElementById('story-date-sep');
  const elPublishedAt = document.getElementById('story-published-at');
  const elTitle = document.getElementById('story-title');
  const elBody = document.getElementById('story-body');
  const elBodyEmpty = document.getElementById('story-body-empty');

  const elClosedCard = document.getElementById('story-closed-card');
  const elFormSection = document.getElementById('story-form-section');
  const elForm = document.getElementById('story-inquiry-form');
  const elAlert = document.getElementById('inquiry-alert');
  const elAlertText = document.getElementById('inquiry-alert-text');
  const elRecoveryActions = document.getElementById('inquiry-recovery-actions');
  const elRetryBtn = document.getElementById('inquiry-retry-btn');
  const elCheckPendingBtn = document.getElementById('inquiry-check-pending-btn');

  const elName = document.getElementById('inquiry-name');
  const elNameErr = document.getElementById('inquiry-name-err');
  const elEmail = document.getElementById('inquiry-email');
  const elEmailErr = document.getElementById('inquiry-email-err');
  const elMessage = document.getElementById('inquiry-message');
  const elMessageErr = document.getElementById('inquiry-message-err');
  const elCount = document.getElementById('inquiry-count');
  const elWebsite = document.getElementById('inquiry-website');
  const elConsentDays = document.getElementById('consent-days');
  const elConsent = document.getElementById('inquiry-consent');
  const elConsentErr = document.getElementById('inquiry-consent-err');
  const elSubmit = document.getElementById('inquiry-submit');

  const elReceiptSection = document.getElementById('story-receipt-section');
  const elReceiptBadge = document.getElementById('receipt-badge');
  const elReceiptTitle = document.getElementById('receipt-title');
  const elReceiptDesc = document.getElementById('receipt-desc');
  const elReceiptCredsWrap = document.getElementById('receipt-credentials-wrap');
  const elReceiptGuideTitle = document.getElementById('receipt-guide-title');
  const elReceiptGuideDesc = document.getElementById('receipt-guide-desc');
  const elReceiptPortalPrefix = document.getElementById('receipt-portal-prefix');
  const elReceiptPortalSuffix = document.getElementById('receipt-portal-suffix');
  const elReceiptIdOut = document.getElementById('receipt-id-out');
  const elReceiptTokenOut = document.getElementById('receipt-token-out');
  const elCopyReceiptId = document.getElementById('copy-receipt-id');
  const elCopyDeleteToken = document.getElementById('copy-delete-token');
  const elCopyReceiptBoth = document.getElementById('copy-receipt-both');
  const elReceiptCheckBtn = document.getElementById('receipt-check-btn');
  const elReceiptDeleteAskBtn = document.getElementById('receipt-delete-ask-btn');
  const elReceiptDeleteConfirm = document.getElementById('receipt-delete-confirm');
  const elReceiptDeleteConfirmBtn = document.getElementById('receipt-delete-confirm-btn');
  const elReceiptDeleteCancelBtn = document.getElementById('receipt-delete-cancel-btn');
  const elReceiptFeedback = document.getElementById('receipt-feedback');
  const elReceiptNewBtn = document.getElementById('receipt-new-btn');

  const elReceiptPortalCard = document.getElementById('receipt-portal-card');
  const elLookupDetails = document.getElementById('lookup-details');
  const elLookupFieldset = document.getElementById('lookup-fieldset');
  const elLookupForm = document.getElementById('lookup-form');
  const elLookupId = document.getElementById('lookup-id');
  const elLookupToken = document.getElementById('lookup-token');
  const elLookupCheckSubmit = document.getElementById('lookup-check-submit');
  const elLookupDeleteAsk = document.getElementById('lookup-delete-ask');
  const elLookupDeleteConfirm = document.getElementById('lookup-delete-confirm');
  const elLookupDeleteConfirmBtn = document.getElementById('lookup-delete-confirm-btn');
  const elLookupDeleteCancelBtn = document.getElementById('lookup-delete-cancel-btn');
  const elLookupResult = document.getElementById('lookup-result');

  function makeUuid() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    const bytes = new Uint8Array(16);
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  function resolveRequestId(holder, signature) {
    if (holder.requestId && holder.signature === signature) return holder.requestId;
    holder.requestId = makeUuid();
    holder.signature = signature;
    return holder.requestId;
  }

  function formatKoreanDate(iso) {
    if (!iso || !Number.isFinite(Date.parse(iso))) return '';
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(new Date(iso));
  }

  function updateCharCount() {
    if (!elCount || !elMessage) return;
    const len = elMessage.value.length;
    elCount.textContent = `${len.toLocaleString('ko-KR')} / ${pageState.maxMessage.toLocaleString('ko-KR')}자`;
  }

  function clearFieldErrors() {
    for (const [input, errEl] of [
      [elName, elNameErr],
      [elEmail, elEmailErr],
      [elMessage, elMessageErr],
      [elConsent, elConsentErr]
    ]) {
      if (input) input.removeAttribute('aria-invalid');
      if (errEl) {
        errEl.textContent = '';
        errEl.hidden = true;
      }
    }
  }

  function setFieldError(input, errEl, message) {
    if (input) input.setAttribute('aria-invalid', 'true');
    if (errEl) {
      errEl.textContent = message;
      errEl.hidden = false;
    }
  }

  function hideAlert() {
    if (!elAlert) return;
    elAlert.hidden = true;
    if (elAlertText) elAlertText.textContent = '';
    if (elRecoveryActions) elRecoveryActions.hidden = true;
  }

  function showAlert(message, { allowRecovery = false } = {}) {
    if (!elAlert || !elAlertText) return;
    elAlertText.textContent = message;
    elAlert.hidden = false;
    if (elRecoveryActions) {
      elRecoveryActions.hidden = !allowRecovery;
    }
  }

  function setStatusNote(el, message, tone = '') {
    if (!el) return;
    el.classList.remove('is-error', 'is-ok');
    if (tone === 'error') el.classList.add('is-error');
    if (tone === 'ok') el.classList.add('is-ok');
    el.textContent = message;
    el.hidden = !message;
  }

  function getReceiptPortalUrl() {
    const origin = typeof location.origin === 'string' && /^https?:\/\//i.test(location.origin)
      ? location.origin
      : '';
    return `${origin}/story/receipt`;
  }

  async function copyValue(text, fallbackInput, feedbackEl, fallbackMessage = '') {
    if (!text) return;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text);
        setStatusNote(feedbackEl, '클립보드에 복사했어요. 안전한 곳에 붙여 넣어 보관해 주세요.', 'ok');
        return;
      }
    } catch {
      // Fallback to selecting visible readonly input when a single field holds the full value
    }
    if (fallbackInput && typeof fallbackInput.select === 'function') {
      fallbackInput.focus();
      fallbackInput.select();
      setStatusNote(feedbackEl, '복사할 값을 선택했어요. Ctrl+C(또는 복사 메뉴)로 복사해 주세요.', '');
      return;
    }
    setStatusNote(
      feedbackEl,
      fallbackMessage || '자동 복사가 제한되어 있어요. 화면의 값을 직접 선택해 복사해 주세요.',
      ''
    );
  }

  function showReceiptOnlyScreen() {
    document.title = '접수증 조회 · 문의 삭제 — SYNK 직접 문의';
    if (elTopbarLabel) elTopbarLabel.textContent = '접수증 조회 · 삭제';
    if (elLoading) elLoading.hidden = true;
    if (elErrorState) elErrorState.hidden = true;
    if (elContentWrap) elContentWrap.hidden = true;
    if (elFormSection) elFormSection.hidden = true;
    if (elReceiptSection) elReceiptSection.hidden = true;
    if (elReceiptPortalCard) elReceiptPortalCard.hidden = false;
    if (elLookupDetails) elLookupDetails.open = true;
  }

  function showUnavailable(title, desc, canRetry) {
    if (elLoading) elLoading.hidden = true;
    if (elContentWrap) elContentWrap.hidden = true;
    if (elReceiptPortalCard) elReceiptPortalCard.hidden = true;
    if (elErrorTitle) elErrorTitle.textContent = title;
    if (elErrorDesc) elErrorDesc.textContent = desc;
    if (elErrorActions) elErrorActions.hidden = !canRetry;
    if (elErrorState) elErrorState.hidden = false;
  }

  async function loadStoryContent() {
    if (pageState.isReceiptOnlyPath) {
      showReceiptOnlyScreen();
      return;
    }
    if (!pageState.publicId) {
      showUnavailable('지금 열 수 없는 글이에요', '주소가 정확한지 다시 확인해 주세요.', false);
      return;
    }
    if (elErrorState) elErrorState.hidden = true;
    if (elLoading) elLoading.hidden = false;

    try {
      const res = await fetch(`/story/${encodeURIComponent(pageState.publicId)}/content`, {
        method: 'GET',
        credentials: 'omit',
        cache: 'no-store'
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 404 || data?.code === 'SYNK_STORY_NOT_FOUND') {
        showUnavailable('지금 열 수 없는 글이에요', '주소가 바뀌었거나 현재 공개가 종료된 글일 수 있어요.', false);
        return;
      }
      if (!res.ok || !data?.story) {
        showUnavailable(
          '글을 불러오지 못했어요',
          data?.error || '일시적인 연결 문제일 수 있어요. 잠시 후 다시 불러와 주세요.',
          true
        );
        return;
      }

      const story = data.story;
      const inquiry = data.inquiry || {};

      pageState.retentionDays = Number.isFinite(Number(inquiry.retentionDays)) && Number(inquiry.retentionDays) > 0
        ? Number(inquiry.retentionDays)
        : 90;
      pageState.maxMessage = Number.isFinite(Number(inquiry.maxMessage)) && Number(inquiry.maxMessage) > 0
        ? Number(inquiry.maxMessage)
        : 4000;

      if (elConsentDays) elConsentDays.textContent = String(pageState.retentionDays);
      if (elMessage) elMessage.maxLength = pageState.maxMessage;
      updateCharCount();

      const authorText = String(story.displayName || '').trim();
      const dateText = formatKoreanDate(story.publishedAt);
      if (elDisplayName) elDisplayName.textContent = authorText || '담당 직원';
      if (elPublishedAt) {
        elPublishedAt.textContent = dateText;
        if (story.publishedAt) elPublishedAt.setAttribute('datetime', String(story.publishedAt));
      }
      if (elDateSep) elDateSep.hidden = !dateText;

      const titleText = String(story.title || '').trim();
      if (elTitle) elTitle.textContent = titleText;
      document.title = titleText ? `${titleText} — SYNK 직접 문의` : 'SYNK 직접 문의';

      const bodyText = typeof story.body === 'string' ? story.body : '';
      if (bodyText.length > 0) {
        if (elBody) {
          elBody.textContent = bodyText;
          elBody.hidden = false;
        }
        if (elBodyEmpty) elBodyEmpty.hidden = true;
      } else {
        if (elBody) {
          elBody.textContent = '';
          elBody.hidden = true;
        }
        if (elBodyEmpty) elBodyEmpty.hidden = false;
      }

      if (elLoading) elLoading.hidden = true;
      if (elContentWrap) elContentWrap.hidden = false;
      if (elReceiptSection) elReceiptSection.hidden = true;

      if (inquiry.open === false) {
        if (elFormSection) elFormSection.hidden = true;
        if (elClosedCard) elClosedCard.hidden = false;
        if (elSubmit) elSubmit.disabled = true;
      } else {
        if (elClosedCard) elClosedCard.hidden = true;
        if (elFormSection) elFormSection.hidden = false;
        if (elSubmit) elSubmit.disabled = false;
      }
    } catch {
      showUnavailable('연결을 확인해 주세요', '네트워크 문제로 글을 불러오지 못했어요. 다시 불러오기를 눌러 주세요.', true);
    }
  }

  async function postPublicJson(path, payload) {
    const res = await fetch(path, {
      method: 'POST',
      credentials: 'omit',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    const retryHeader = Number(res.headers.get('Retry-After'));
    const retryAfterSeconds = Number.isFinite(Number(data?.retryAfterSeconds))
      ? Number(data.retryAfterSeconds)
      : (Number.isFinite(retryHeader) && retryHeader > 0 ? retryHeader : 0);
    return { ok: res.ok, status: res.status, data, retryAfterSeconds };
  }

  function setFormSubmitting(busy) {
    pageState.submitting = busy;
    if (elForm) elForm.setAttribute('aria-busy', String(busy));
    if (elSubmit) {
      elSubmit.disabled = busy;
      elSubmit.textContent = busy ? '전송 중…' : '문의 보내기';
    }
    if (elRetryBtn) elRetryBtn.disabled = busy;
    if (elCheckPendingBtn) elCheckPendingBtn.disabled = busy;
    for (const field of [elName, elEmail, elMessage]) {
      if (field) field.readOnly = busy;
    }
    if (elConsent) elConsent.disabled = busy;
  }

  function syncReceiptGuide(deleted) {
    if (deleted) {
      if (elReceiptGuideTitle) {
        elReceiptGuideTitle.textContent = '연락처와 문의 원문 삭제가 완료되었어요.';
      }
      if (elReceiptGuideDesc) {
        elReceiptGuideDesc.textContent = '이 문의의 연락처와 본문은 즉시 파기되어 더 이상 보관되거나 회사 관리자에게 인계되지 않아요. 아래 접수 번호와 삭제 코드로 삭제 처리 상태만 다시 확인할 수 있어요.';
      }
      if (elReceiptPortalPrefix) elReceiptPortalPrefix.textContent = '삭제 처리 상태는 고정 주소 ';
      if (elReceiptPortalSuffix) elReceiptPortalSuffix.textContent = '에서도 다시 확인할 수 있어요.';
      return;
    }
    if (elReceiptGuideTitle) {
      elReceiptGuideTitle.textContent = '접수 번호와 삭제 코드를 안전한 곳에 복사해 보관해 주세요.';
    }
    if (elReceiptGuideDesc) {
      elReceiptGuideDesc.textContent = `개인정보 보호를 위해 이 브라우저에 자동 저장하지 않아요. 문의는 접수일부터 ${pageState.retentionDays}일간 보관 후 파기되며(작성 직원 계정 중지 시 남은 기간 회사 관리자에게 인계), 나중에 접수 상태를 확인하거나 직접 삭제할 때 아래 두 값이 필요해요.`;
    }
    if (elReceiptPortalPrefix) elReceiptPortalPrefix.textContent = '원래 글이 내려간 뒤에도 고정 주소 ';
    if (elReceiptPortalSuffix) elReceiptPortalSuffix.textContent = '에서 언제든 조회·삭제할 수 있어요.';
  }

  function applyReceiptDeletedState({ moveFocus = false } = {}) {
    pageState.currentReceipt.deleted = true;
    if (elReceiptDeleteConfirm) elReceiptDeleteConfirm.hidden = true;
    if (elReceiptBadge) elReceiptBadge.textContent = '삭제됨';
    if (elReceiptTitle) elReceiptTitle.textContent = '보낸 문의가 삭제되었어요';
    if (elReceiptDesc) {
      elReceiptDesc.textContent = '남겨 주신 연락처와 문의 원문이 즉시 삭제되어 더 이상 보관되지 않아요.';
    }
    syncReceiptGuide(true);
    if (elReceiptDeleteAskBtn) elReceiptDeleteAskBtn.disabled = true;
    if (moveFocus) {
      elReceiptTitle?.focus({ preventScroll: false });
    }
  }

  function showReceiptScreen({ receiptId = '', deleteToken = '', duplicate = false }) {
    pageState.currentReceipt = {
      receiptId: String(receiptId || ''),
      deleteToken: String(deleteToken || ''),
      deleted: false
    };

    if (elFormSection) elFormSection.hidden = true;
    if (elReceiptSection) elReceiptSection.hidden = false;
    if (elReceiptDeleteConfirm) elReceiptDeleteConfirm.hidden = true;
    setStatusNote(elReceiptFeedback, '');

    if (elReceiptBadge) elReceiptBadge.textContent = duplicate ? '접수 확인됨' : '접수 완료';
    if (elReceiptTitle) {
      elReceiptTitle.textContent = duplicate ? '이미 정상 접수된 문의예요' : '문의가 정상적으로 접수되었어요';
    }
    if (elReceiptDesc) {
      elReceiptDesc.textContent = duplicate
        ? '동일한 요청이 중복으로 접수되지 않도록 기존 접수 내역을 확인해 보여 드려요.'
        : '작성한 직원이 내용을 확인한 뒤 입력하신 이메일로 답장할 수 있어요.';
    }
    syncReceiptGuide(false);

    const hasTokens = Boolean(receiptId && deleteToken);
    if (elReceiptCredsWrap) elReceiptCredsWrap.hidden = !hasTokens;
    if (elReceiptIdOut) elReceiptIdOut.value = String(receiptId || '');
    if (elReceiptTokenOut) elReceiptTokenOut.value = String(deleteToken || '');
    if (elReceiptDeleteAskBtn) elReceiptDeleteAskBtn.disabled = !hasTokens;
    if (elReceiptCheckBtn) elReceiptCheckBtn.disabled = !hasTokens;

    elReceiptTitle?.focus({ preventScroll: false });
  }

  function validateInquiryClient() {
    clearFieldErrors();
    hideAlert();

    const name = String(elName?.value ?? '').trim();
    const email = String(elEmail?.value ?? '').trim();
    const message = String(elMessage?.value ?? '').trim();
    const consent = Boolean(elConsent?.checked);
    let firstInvalid = null;

    if (name.length > 120) {
      setFieldError(elName, elNameErr, '이름은 120자 이내로 입력해 주세요.');
      firstInvalid = firstInvalid || elName;
    }
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldError(elEmail, elEmailErr, '답장받을 이메일 주소를 정확히 입력해 주세요.');
      firstInvalid = firstInvalid || elEmail;
    }
    if (!message) {
      setFieldError(elMessage, elMessageErr, '문의 내용을 입력해 주세요.');
      firstInvalid = firstInvalid || elMessage;
    } else if (message.length > pageState.maxMessage) {
      setFieldError(elMessage, elMessageErr, `문의 내용은 ${pageState.maxMessage.toLocaleString('ko-KR')}자 이내로 입력해 주세요.`);
      firstInvalid = firstInvalid || elMessage;
    }
    if (!consent) {
      setFieldError(elConsent, elConsentErr, '개인정보 수집·이용에 동의해 주세요.');
      firstInvalid = firstInvalid || elConsent;
    }

    if (firstInvalid) {
      firstInvalid.focus();
      return null;
    }

    return {
      name,
      email,
      message,
      consent: true,
      website: String(elWebsite?.value ?? '')
    };
  }

  async function submitInquiry() {
    if (pageState.submitting || !pageState.publicId) return;
    const values = validateInquiryClient();
    if (!values) return;

    const signature = JSON.stringify([values.name, values.email, values.message, values.consent]);
    const requestId = resolveRequestId(pageState.pendingSubmit, signature);
    pageState.pendingSubmit.lastRequestId = requestId;

    setFormSubmitting(true);
    try {
      const { ok, status, data, retryAfterSeconds } = await postPublicJson(
        `/story/${encodeURIComponent(pageState.publicId)}/inquiries`,
        {
          requestId,
          name: values.name,
          email: values.email,
          message: values.message,
          consent: values.consent,
          website: values.website
        }
      );

      if (ok && data?.deleted === true) {
        pageState.pendingSubmit.requestId = '';
        pageState.pendingSubmit.signature = '';
        showAlert('이미 삭제된 접수 번호예요. 삭제된 문의는 되살릴 수 없으니 다시 보내기를 눌러 새 문의로 접수해 주세요.');
        return;
      }

      if (ok && data?.accepted === true) {
        elForm?.reset();
        updateCharCount();
        clearFieldErrors();
        hideAlert();
        pageState.pendingSubmit.requestId = '';
        pageState.pendingSubmit.signature = '';
        pageState.pendingSubmit.lastRequestId = '';
        showReceiptScreen({
          receiptId: data.receiptId || '',
          deleteToken: data.deleteToken || '',
          duplicate: Boolean(data.duplicate)
        });
        return;
      }

      if (status === 409 || data?.code === 'SYNK_STORY_INQUIRY_CONFLICT') {
        pageState.pendingSubmit.requestId = '';
        pageState.pendingSubmit.signature = '';
        showAlert(data?.error || '이전 요청과 입력 내용이 달라 새 요청 번호를 준비했어요. 내용을 확인하고 한 번 더 보내기를 눌러 주세요.');
        return;
      }

      if (status === 400 || data?.code === 'SYNK_STORY_INQUIRY_INVALID') {
        const field = data?.field || '';
        const errMsg = data?.error || '입력한 내용을 다시 확인해 주세요.';
        if (field === 'requestId') {
          pageState.pendingSubmit.requestId = '';
          pageState.pendingSubmit.signature = '';
          showAlert('요청 번호를 새로 준비했어요. 다시 보내기를 눌러 주세요.');
        } else if (field === 'email') {
          setFieldError(elEmail, elEmailErr, errMsg);
          elEmail?.focus();
        } else if (field === 'message') {
          setFieldError(elMessage, elMessageErr, errMsg);
          elMessage?.focus();
        } else if (field === 'consent') {
          setFieldError(elConsent, elConsentErr, errMsg);
          elConsent?.focus();
        } else if (field === 'name') {
          setFieldError(elName, elNameErr, errMsg);
          elName?.focus();
        } else {
          showAlert(errMsg);
        }
        return;
      }

      if (status === 404 || data?.code === 'SYNK_STORY_NOT_FOUND') {
        showAlert('이 글의 공개가 종료되어 더 이상 문의를 접수할 수 없어요.');
        return;
      }

      if (status === 429 || data?.code === 'SYNK_STORY_BUSY') {
        const waitCopy = retryAfterSeconds > 0 ? ` 약 ${retryAfterSeconds}초 뒤에 다시 시도해 주세요.` : ' 잠시 뒤에 다시 시도해 주세요.';
        showAlert((data?.error || '요청이 몰려 잠시 대기가 필요해요.') + waitCopy, { allowRecovery: true });
        return;
      }

      showAlert(
        data?.error || '전송 응답을 확인하지 못했어요. 같은 내용으로 다시 보내거나 접수 여부를 확인할 수 있어요.',
        { allowRecovery: true }
      );
    } catch {
      showAlert(
        '네트워크 연결이 불안정해 응답을 받지 못했어요. 입력 내용은 그대로 유지되었으니 같은 내용으로 다시 보내거나 접수 여부를 확인해 보세요.',
        { allowRecovery: true }
      );
    } finally {
      setFormSubmitting(false);
    }
  }

  async function checkPendingByRequestId() {
    const reqId = pageState.pendingSubmit.lastRequestId || pageState.pendingSubmit.requestId;
    if (!reqId || pageState.submitting) return;

    setFormSubmitting(true);
    try {
      const { ok, data } = await postPublicJson('/story/inquiry-receipt', { requestId: reqId });
      if (!ok) {
        showAlert(data?.error || '접수 여부를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.', { allowRecovery: true });
        return;
      }
      if (data?.found && data.state === 'received') {
        elForm?.reset();
        updateCharCount();
        clearFieldErrors();
        hideAlert();
        pageState.pendingSubmit.requestId = '';
        pageState.pendingSubmit.signature = '';
        pageState.pendingSubmit.lastRequestId = '';
        showReceiptScreen({
          receiptId: data.receiptId || '',
          deleteToken: data.deleteToken || '',
          duplicate: true
        });
        return;
      }
      if (data?.found && data.state === 'deleted') {
        pageState.pendingSubmit.requestId = '';
        pageState.pendingSubmit.signature = '';
        showAlert('해당 요청 번호의 문의는 이미 삭제된 상태예요. 새로 문의하려면 다시 보내기를 눌러 주세요.');
        return;
      }
      showAlert('아직 서버에 접수된 내역이 없어요. 아래 "같은 내용으로 다시 보내기"를 눌러 전송해 주세요.', { allowRecovery: true });
    } catch {
      showAlert('접수 확인 중 연결 오류가 발생했어요. 잠시 후 다시 확인해 주세요.', { allowRecovery: true });
    } finally {
      setFormSubmitting(false);
    }
  }

  async function checkReceiptCredentials(receiptId, deleteToken, feedbackEl) {
    const id = String(receiptId || '').trim();
    const token = String(deleteToken || '').trim();
    if (!id || !token) {
      setStatusNote(feedbackEl, '접수 번호와 삭제 코드를 모두 입력해 주세요.', 'error');
      return;
    }
    setStatusNote(feedbackEl, '접수 상태를 확인하고 있어요…');
    try {
      const { ok, data } = await postPublicJson('/story/inquiry-receipt', { receiptId: id, deleteToken: token });
      if (!ok) {
        setStatusNote(feedbackEl, data?.error || '접수증을 확인하지 못했어요. 입력한 값을 다시 살펴봐 주세요.', 'error');
        return;
      }
      if (data?.found && data.state === 'received') {
        setStatusNote(feedbackEl, '정상적으로 접수되어 보관 중인 문의예요.', 'ok');
      } else if (data?.found && data.state === 'deleted') {
        setStatusNote(feedbackEl, '이미 삭제 처리된 문의예요.', '');
        if (id && pageState.currentReceipt.receiptId === id && !pageState.currentReceipt.deleted) {
          applyReceiptDeletedState({ moveFocus: false });
        }
      } else {
        setStatusNote(feedbackEl, '일치하는 보관 내역을 찾지 못했어요(보관 기한 만료 또는 번호 불일치).', 'error');
      }
    } catch {
      setStatusNote(feedbackEl, '네트워크 오류로 상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.', 'error');
    }
  }

  async function deleteByCredentials(receiptId, deleteToken, feedbackEl, onDeleted) {
    const id = String(receiptId || '').trim();
    const token = String(deleteToken || '').trim();
    if (!id || !token) {
      setStatusNote(feedbackEl, '삭제하려면 접수 번호와 삭제 코드가 모두 필요해요.', 'error');
      return;
    }
    setStatusNote(feedbackEl, '문의를 삭제하고 있어요…');
    try {
      const { ok, status, data } = await postPublicJson('/story/inquiry-delete', { receiptId: id, deleteToken: token });
      if (ok && data?.deleted) {
        setStatusNote(feedbackEl, '문의 연락처와 원문을 즉시 삭제했어요.', 'ok');
        if (typeof onDeleted === 'function') onDeleted();
        return;
      }
      if (status === 403 || data?.code === 'SYNK_STORY_RECEIPT') {
        setStatusNote(feedbackEl, '접수 번호 또는 삭제 코드가 일치하지 않아요. 보관한 값을 다시 확인해 주세요.', 'error');
        return;
      }
      setStatusNote(feedbackEl, data?.error || '삭제 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.', 'error');
    } catch {
      setStatusNote(feedbackEl, '네트워크 오류로 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.', 'error');
    }
  }

  elMessage?.addEventListener('input', updateCharCount);
  elReloadBtn?.addEventListener('click', () => { void loadStoryContent(); });

  elForm?.addEventListener('submit', event => {
    event.preventDefault();
    void submitInquiry();
  });

  elRetryBtn?.addEventListener('click', () => {
    void submitInquiry();
  });

  elCheckPendingBtn?.addEventListener('click', () => {
    void checkPendingByRequestId();
  });

  elCopyReceiptId?.addEventListener('click', () => {
    void copyValue(pageState.currentReceipt.receiptId, elReceiptIdOut, elReceiptFeedback);
  });

  elCopyDeleteToken?.addEventListener('click', () => {
    void copyValue(pageState.currentReceipt.deleteToken, elReceiptTokenOut, elReceiptFeedback);
  });

  elCopyReceiptBoth?.addEventListener('click', () => {
    const r = pageState.currentReceipt;
    if (!r.receiptId || !r.deleteToken) return;
    const combined = `접수 번호: ${r.receiptId}\n삭제 코드: ${r.deleteToken}\n조회·삭제 주소: ${getReceiptPortalUrl()}`;
    void copyValue(
      combined,
      null,
      elReceiptFeedback,
      '자동 복사가 제한되어 있어요. 위 접수 번호와 삭제 코드 두 값을 각각 직접 복사해 보관해 주세요.'
    );
  });

  elReceiptCheckBtn?.addEventListener('click', () => {
    const r = pageState.currentReceipt;
    void checkReceiptCredentials(r.receiptId, r.deleteToken, elReceiptFeedback);
  });

  elReceiptDeleteAskBtn?.addEventListener('click', () => {
    if (pageState.currentReceipt.deleted || !elReceiptDeleteConfirm) return;
    elReceiptDeleteConfirm.hidden = false;
    elReceiptDeleteConfirmBtn?.focus();
  });

  elReceiptDeleteCancelBtn?.addEventListener('click', () => {
    if (elReceiptDeleteConfirm) elReceiptDeleteConfirm.hidden = true;
    elReceiptDeleteAskBtn?.focus();
  });

  elReceiptDeleteConfirmBtn?.addEventListener('click', () => {
    const r = pageState.currentReceipt;
    elReceiptDeleteConfirmBtn.disabled = true;
    let deletedNow = false;
    void deleteByCredentials(r.receiptId, r.deleteToken, elReceiptFeedback, () => {
      deletedNow = true;
      applyReceiptDeletedState({ moveFocus: true });
    }).finally(() => {
      elReceiptDeleteConfirmBtn.disabled = false;
      if (!deletedNow && elReceiptDeleteConfirm && !elReceiptDeleteConfirm.hidden) {
        elReceiptDeleteConfirmBtn?.focus();
      }
    });
  });

  elReceiptNewBtn?.addEventListener('click', () => {
    pageState.pendingSubmit = { requestId: '', signature: '', lastRequestId: '' };
    pageState.currentReceipt = { receiptId: '', deleteToken: '', deleted: false };
    elForm?.reset();
    updateCharCount();
    clearFieldErrors();
    hideAlert();
    if (elReceiptSection) elReceiptSection.hidden = true;
    if (elFormSection) elFormSection.hidden = false;
    elName?.focus();
  });

  elLookupForm?.addEventListener('submit', event => {
    event.preventDefault();
    if (elLookupDeleteConfirm) elLookupDeleteConfirm.hidden = true;
    void checkReceiptCredentials(elLookupId?.value, elLookupToken?.value, elLookupResult);
  });

  elLookupDeleteAsk?.addEventListener('click', () => {
    const id = String(elLookupId?.value ?? '').trim();
    const token = String(elLookupToken?.value ?? '').trim();
    if (!id || !token) {
      setStatusNote(elLookupResult, '삭제할 문의의 접수 번호와 삭제 코드를 먼저 입력해 주세요.', 'error');
      (id ? elLookupToken : elLookupId)?.focus();
      return;
    }
    setStatusNote(elLookupResult, '');
    if (elLookupDeleteConfirm) {
      elLookupDeleteConfirm.hidden = false;
      elLookupDeleteConfirmBtn?.focus();
    }
  });

  elLookupDeleteCancelBtn?.addEventListener('click', () => {
    if (elLookupDeleteConfirm) elLookupDeleteConfirm.hidden = true;
    elLookupDeleteAsk?.focus();
  });

  elLookupDeleteConfirmBtn?.addEventListener('click', () => {
    const targetId = String(elLookupId?.value ?? '').trim();
    elLookupDeleteConfirmBtn.disabled = true;
    let deletedNow = false;
    void deleteByCredentials(elLookupId?.value, elLookupToken?.value, elLookupResult, () => {
      deletedNow = true;
      if (elLookupDeleteConfirm) elLookupDeleteConfirm.hidden = true;
      elLookupForm?.reset();
      if (targetId && pageState.currentReceipt.receiptId === targetId && !pageState.currentReceipt.deleted) {
        applyReceiptDeletedState({ moveFocus: false });
      }
      elLookupResult?.focus();
    }).finally(() => {
      elLookupDeleteConfirmBtn.disabled = false;
      if (!deletedNow && elLookupDeleteConfirm && !elLookupDeleteConfirm.hidden) {
        elLookupDeleteConfirmBtn?.focus();
      }
    });
  });

  if (elLookupFieldset) elLookupFieldset.disabled = false;
  if (elLookupCheckSubmit) elLookupCheckSubmit.disabled = false;
  if (elLookupDeleteAsk) elLookupDeleteAsk.disabled = false;

  void loadStoryContent();
})();
