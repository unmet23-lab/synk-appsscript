const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const L = (lang) => (lang === 'en' ? 'en' : 'ko');

const TEXT = {
  ko: {
    title: 'SYNK ID',
    intro: 'SYNK ID는 중앙 계정으로 가입하고 로그인합니다. 이메일 또는 Google 계정을 사용할 수 있습니다.',
    recovery: '비밀번호 분실이나 계정 복구는 SYNK ID 중앙 로그인 화면에서 진행합니다.',
    signIn: 'SYNK ID로 로그인', signOut: '로그아웃', retry: '다시 시도',
    notConfigured: '계정 기능이 아직 준비되지 않았습니다.',
    guestMode: '로그인하지 않은 상태입니다. 자료는 이 탭에만 저장되며 탭을 닫으면 사라질 수 있습니다.',
    loading: '계정 자료를 불러오는 중입니다…', saved: '계정 저장됨', pending: '동기화 대기 중',
    failed: '동기화에 실패했습니다.', conflict: '다른 곳에서 변경된 내용과 충돌합니다.',
    unknown: '상태를 확인하는 중입니다.',
    readOnly: '현재 이 자료는 편집할 수 없습니다.',
    empty: '계정에 저장된 자료가 없습니다.',
    importGuest: '로그인 전 자료를 계정으로 가져오기',
    remoteExists: '계정에 이미 자료가 있어 로그인 전 자료를 가져오지 않습니다. 필요하면 내보내기로 보관하세요.',
    guestBlocked: '로그인 전 자료를 지금은 사용할 수 없습니다.',
    exportTitle: '내보내기', exportCurrent: '현재 화면 내보내기', exportRemote: '계정 서버 자료 내보내기',
    exportGuest: '로그인 전 자료 내보내기', exportRecovery: '계정 임시 자료 내보내기',
    conflictHelp: '자동으로 덮어쓰지 않습니다. 양쪽 자료를 내보내 보관한 뒤 선택하세요.',
    useRemote: '계정 서버 자료 사용',
    draftsTitle: '복구 가능한 임시 자료', recover: '복구', createdAt: '생성',
    clearGuest: '로그인 전 임시 자료 초기화',
    noDelete: '이 화면에서는 계정을 삭제할 수 없습니다.',
  },
  en: {
    title: 'SYNK ID',
    intro: 'SYNK ID uses a central account for sign-up and sign-in. You can use email or Google.',
    recovery: 'Password resets and account recovery are handled on the SYNK ID central sign-in page.',
    signIn: 'Sign in with SYNK ID', signOut: 'Sign out', retry: 'Retry',
    notConfigured: 'Account features are not ready yet.',
    guestMode: 'You are not signed in. Data is saved in this tab only and may be lost when the tab closes.',
    loading: 'Loading account data…', saved: 'Saved to account', pending: 'Waiting to sync',
    failed: 'Sync failed.', conflict: 'Conflicts with changes made elsewhere.',
    unknown: 'Checking status.',
    readOnly: 'This data cannot be edited right now.',
    empty: 'No data is stored in your account.',
    importGuest: 'Import pre-sign-in data to account',
    remoteExists: 'Your account already has data, so pre-sign-in data will not be imported. Export it to keep a copy.',
    guestBlocked: 'Pre-sign-in data is not available right now.',
    exportTitle: 'Export', exportCurrent: 'Export current view', exportRemote: 'Export account server data',
    exportGuest: 'Export pre-sign-in data', exportRecovery: 'Export account recovery data',
    conflictHelp: 'Nothing is overwritten automatically. Export both versions, then choose.',
    useRemote: 'Use account server data',
    draftsTitle: 'Recoverable drafts', recover: 'Recover', createdAt: 'Created',
    clearGuest: 'Clear pre-sign-in drafts',
    noDelete: 'Accounts cannot be deleted from this screen.',
  },
};

const ERRORS = {
  ko: {
    JOB_IN_USE: '이 공고를 사용하는 지원 준비 항목이 있어 삭제할 수 없습니다. 먼저 해당 준비 항목을 삭제하세요.',
    PATH_DOCUMENT_FUTURE_VERSION: '더 새로운 버전에서 저장된 자료라 이 화면에서 읽거나 덮어쓰지 않습니다. 내보내기로 원본을 보관하거나 앱을 업데이트하세요.',
    GUEST_SAVE_REQUIRED: '로그인 전 자료를 이 탭에 저장하지 못해 로그인을 멈췄습니다. 자료를 내보낸 뒤 다시 시도하세요.',
    GUEST_WRITE_BLOCKED: '저장된 로그인 전 자료를 보호하기 위해 편집과 가져오기를 막았습니다. 내보내기로 보관하거나 초기화하세요.',
    SAVED_JOB_LIMIT: '저장할 수 있는 공고 수(100개)를 초과했습니다. 기존 공고를 삭제한 뒤 저장하세요.',
    ACCOUNT_CHANGED: '계정이 바뀌어 작업을 중단했습니다. 현재 계정을 확인하세요.',
    LOCAL_DRAFT_CONFLICT: '이 기기에 저장되지 않은 계정 임시 자료가 있습니다. 내보낸 뒤 복구할 자료나 계정 서버 자료를 선택하세요.',
    CARE_CLIENT_UPDATE_REQUIRED: '앱을 업데이트해야 계정 자료를 사용할 수 있습니다. 페이지를 새로고침하세요.',
    INVALID_CARE_STATE: '계정 자료 형식을 확인할 수 없어 편집을 막았습니다. 내보내기로 보관하세요.',
    UNSAVED_ACCOUNT_DRAFT: '계정에 저장되지 않은 임시 자료가 있습니다. 먼저 내보내거나 복구하세요.',
    LOCAL_STORAGE_UNAVAILABLE: '이 탭에 저장하지 못했어요. 작성 내용은 화면에 남아 있어요.',
    INVALID_PATH_DOCUMENT: '자료 형식이 올바르지 않습니다.',
    ACCOUNT_LOAD_FAILED: '계정 자료를 불러오지 못했습니다.',
    REVISION_CONFLICT: '다른 곳에서 변경된 내용과 충돌합니다.',
    AUTH_REQUIRED: '다시 로그인해야 합니다.',
    GENERIC: '문제가 발생했습니다. 잠시 후 다시 시도하세요.',
  },
  en: {
    JOB_IN_USE: 'A preparation item uses this saved job, so it cannot be removed. Remove that preparation item first.',
    PATH_DOCUMENT_FUTURE_VERSION: 'This data was saved by a newer version, so it is not read or overwritten here. Export the original or update the app.',
    GUEST_SAVE_REQUIRED: 'Sign-in stopped because pre-sign-in data could not be saved in this tab. Export it, then try again.',
    GUEST_WRITE_BLOCKED: 'Editing and import are blocked to protect stored pre-sign-in data. Export it or clear it.',
    SAVED_JOB_LIMIT: 'You reached the saved job limit (100). Remove a saved job first.',
    ACCOUNT_CHANGED: 'The account changed, so the action was stopped. Check the current account.',
    LOCAL_DRAFT_CONFLICT: 'An unsynced account draft exists on this device. Export it, then choose the draft or the account server data.',
    CARE_CLIENT_UPDATE_REQUIRED: 'Update the app to use account data. Please reload the page.',
    INVALID_CARE_STATE: 'Account data could not be verified, so editing is blocked. Export it to keep a copy.',
    UNSAVED_ACCOUNT_DRAFT: 'There is an unsaved account draft. Export or recover it first.',
    LOCAL_STORAGE_UNAVAILABLE: 'Could not save in this tab. Your text stays on screen.',
    INVALID_PATH_DOCUMENT: 'The data format is invalid.',
    ACCOUNT_LOAD_FAILED: 'Could not load account data.',
    REVISION_CONFLICT: 'Conflicts with changes made elsewhere.',
    AUTH_REQUIRED: 'Please sign in again.',
    GENERIC: 'Something went wrong. Please try again later.',
  },
};

export function getAccountErrorMessage(error, lang = 'ko') {
  const m = ERRORS[L(lang)];
  const code = error && typeof error === 'object' ? error.code : undefined;
  return Object.prototype.hasOwnProperty.call(m, code) && code !== 'GENERIC' ? m[code] : m.GENERIC;
}

const btn = (action, label, cls = 'secondary', id) =>
  `<button type="button" class="${cls}" data-action="${esc(action)}"${id != null ? ` data-id="${esc(id)}"` : ''}>${esc(label)}</button>`;

const isConflict = (s) => s.syncStatus === 'conflict' || s.syncStatus === 'local-conflict';

const NO_RETRY_CODES = new Set([
  'PATH_DOCUMENT_FUTURE_VERSION', 'INVALID_PATH_DOCUMENT', 'CARE_CLIENT_UPDATE_REQUIRED', 'INVALID_CARE_STATE',
  'UNSUPPORTED_SCHEMA_VERSION', 'UNSUPPORTED_DOCUMENT_VERSION', 'CLIENT_UPDATE_REQUIRED', 'INVALID_DOCUMENT', 'MALFORMED_DOCUMENT',
]);
const RETRY_STATUSES = new Set(['offline', 'storage-error']);
const RETRY_CODES = new Set(['NETWORK_UNAVAILABLE', 'ACCOUNT_LOAD_FAILED', 'LOCAL_STORAGE_UNAVAILABLE', 'STORAGE_UNAVAILABLE', 'STORAGE_ERROR']);

const canRetry = (s) => {
  if (isConflict(s)) return false;
  const code = s.error && typeof s.error === 'object' ? s.error.code : undefined;
  if (code && NO_RETRY_CODES.has(code)) return false;
  if (!s.error || s.error.retryable === true) return true;
  return RETRY_STATUSES.has(s.syncStatus) || RETRY_CODES.has(code);
};

function stateOf(s) {
  if (!s.configured) return 'notConfigured';
  if (!s.signedIn) return 'guestMode';
  if (isConflict(s)) return 'conflict';
  if (s.error || s.syncStatus === 'failed' || s.syncStatus === 'error' || RETRY_STATUSES.has(s.syncStatus)) return 'failed';
  if (!s.loaded) return 'loading';
  if (s.pending || s.syncStatus === 'pending') return 'pending';
  if (s.syncStatus === 'synced') return 'saved';
  return 'unknown';
}

export function renderAccountNotice(status = {}, lang = 'ko') {
  const t = TEXT[L(lang)];
  const s = status || {};
  const base = stateOf(s);
  const st = base === 'guestMode' && (s.error || RETRY_STATUSES.has(s.syncStatus)) ? 'failed' : base;
  let html = `<div class="notice" role="status" data-state="${esc(st)}"><span>${esc(t[st])}</span>`;
  if (!s.signedIn && s.error?.code === 'LOCAL_STORAGE_UNAVAILABLE') html = `<div class="notice" role="status" data-state="failed">`;
  if (s.error) html += ` <span class="meta">${esc(getAccountErrorMessage(s.error, lang))}</span>`;
  if ((st === 'failed' && canRetry(s)) || st === 'notConfigured') html += ` ${btn('accountRetry', t.retry, 'text-button')}`;
  return html + '</div>';
}

export function renderAccountPanel(status = {}, lang = 'ko', opts = {}) {
  const t = TEXT[L(lang)];
  const s = status || {};
  const st = stateOf(s);
  const out = [`<section class="settings-group account-panel"><h2>${esc(t.title)}</h2>`];

  if (!s.configured) {
    out.push(`<p class="notice">${esc(t.notConfigured)}</p>`);
    if (s.error) out.push(`<p class="meta">${esc(getAccountErrorMessage(s.error, lang))}</p>`);
    out.push(`<div class="actions">${btn('accountRetry', t.retry, 'primary')}</div>`);
  } else if (!s.signedIn) {
    out.push(`<p>${esc(t.intro)}</p><p class="meta">${esc(t.recovery)}</p>`);
    out.push(`<p class="notice">${esc(t.guestMode)}</p>`);
    if (s.error) out.push(`<p class="notice">${esc(getAccountErrorMessage(s.error, lang))}</p>`);
    const gr = (s.error || RETRY_STATUSES.has(s.syncStatus)) && canRetry(s) ? btn('accountRetry', t.retry) : '';
    out.push(`<div class="actions">${btn('accountSignIn', t.signIn, 'primary')}${gr}</div>`);
  } else {
    out.push(renderAccountNotice(s, lang));
    if (s.loaded && s.canEdit === false) out.push(`<p class="meta">${esc(t.readOnly)}</p>`);
    if (st === 'failed' && canRetry(s)) out.push(`<div class="actions">${btn('accountRetry', t.retry, 'primary')}</div>`);
    if (s.loaded && !isConflict(s)) {
      if (s.accountEmpty === true || s.canImportGuest) {
        out.push(`<p class="meta">${esc(t.empty)}</p>`);
        if (s.canImportGuest && !s.guestBlocked) out.push(`<div class="actions">${btn('accountImport', t.importGuest, 'primary')}</div>`);
      } else if (s.guestAvailable && !s.guestBlocked) {
        out.push(`<p class="meta">${esc(t.remoteExists)}</p>`);
      }
    }
    if (isConflict(s)) {
      out.push(`<div class="notice"><p>${esc(t.conflict)}</p><p class="meta">${esc(t.conflictHelp)}</p>`);
      out.push(`<div class="actions">${btn('accountExport', t.exportCurrent)}${btn('accountExportRemote', t.exportRemote)}${btn('accountUseRemote', t.useRemote, 'primary')}</div></div>`);
    }
  }

  if (s.guestBlocked) out.push(`<p class="meta">${esc(t.guestBlocked)}</p>`);
  if (opts && opts.pendingBackup) {
    const en = L(lang) === 'en';
    const info = en ? 'The browser cannot confirm whether the download finished. Check the backup file yourself before confirming.' : '브라우저는 다운로드 완료 여부를 확인할 수 없어요. 백업 파일을 직접 확인한 뒤 눌러 주세요.';
    const label = opts.useRemote
      ? (en ? 'I checked that the backup file is saved · load account version' : '백업 파일이 저장된 것을 확인했어요 · 계정 자료 불러오기')
      : (en ? 'I checked that the backup file is saved' : '백업 파일이 저장된 것을 확인했어요');
    out.push(`<div class="notice"><p class="meta">${esc(info)}</p><div class="actions">${btn('accountConfirmBackup', label, 'primary')}</div></div>`);
  }

  const ex = [btn('accountExport', t.exportCurrent)];
  if (s.signedIn && s.loaded) ex.push(btn('accountExportRemote', t.exportRemote));
  if (s.guestAvailable) ex.push(btn('accountExportGuest', t.exportGuest));
  const drafts = Array.isArray(s.localDrafts) ? s.localDrafts : [];
  if (s.signedIn && (drafts.length || isConflict(s))) ex.push(btn('accountExportRecovery', t.exportRecovery));
  out.push(`<div class="settings-group"><h3>${esc(t.exportTitle)}</h3><div class="actions">${ex.join('')}</div></div>`);

  if (drafts.length) {
    out.push(`<div class="settings-group"><h3>${esc(t.draftsTitle)}</h3><ul>`);
    for (const d of drafts) {
      if (!d || d.id == null) continue;
      out.push(`<li><span class="meta">${esc(t.createdAt)}: ${esc(d.createdAt)}</span> ${btn('accountRecover', t.recover, 'text-button', d.id)}</li>`);
    }
    out.push('</ul></div>');
  }

  const foot = [];
  if (s.guestAvailable || s.guestBlocked) foot.push(btn('clearGuest', t.clearGuest, 'text-button'));
  if (s.signedIn) foot.push(btn('accountSignOut', t.signOut));
  if (foot.length) out.push(`<div class="actions">${foot.join('')}</div>`);
  if (s.signedIn) out.push(`<p class="meta">${esc(t.noDelete)}</p>`);

  out.push('</section>');
  return out.join('');
}