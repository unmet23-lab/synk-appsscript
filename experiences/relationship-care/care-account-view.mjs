/** Presentation only: resolving a saved login is distinct from an absent account configuration. */
export function careAccountView({ starting = false, account = {}, sync = {}, connected = false, currentAccountId = null } = {}) {
  // document-sync idle means edits await a save, not that the notebook is absent.
  // revision 0 is a received empty notebook; pending is a validated, explicitly
  // selected local draft and remains usable even before its first remote read.
  const hasNotebook = connected && (Number.isSafeInteger(sync.revision) && sync.revision >= 0 || sync.pending === true);
  const accountPending = starting || ['loading', 'restoring', 'signing-in'].includes(account.status);
  const choosing = connected && sync.status === 'local-conflict';
  const sameAccountRestoring = !starting && !choosing && hasNotebook && account.status === 'restoring' && !!currentAccountId && account.accountId === currentAccountId && sync.accountId === currentAccountId;
  // Clearing a broken cache may emit synced without ever receiving the server
  // notebook. It still needs a retry, not an endless loading indicator.
  const notebookFailure = connected && !hasNotebook && !choosing && !['idle', 'loading', 'closed'].includes(sync.status || 'idle');
  const notebookPending = connected && !hasNotebook && !choosing && !notebookFailure;
  const refreshingNotebook = !accountPending && hasNotebook && sync.status === 'loading';
  const loading = accountPending || notebookPending || refreshingNotebook;
  if (connected && !account.signedIn && account.status === 'error' && account.error?.retryable === true) return {
    loading: false, locked: true, concealNotebook: true, kind: 'error',
    title: '로그인을 다시 확인해야 해요.',
    detail: '열어 둔 수첩과 저장하지 않은 입력은 이 화면에 그대로 있어요. 아래 「다시 로그인」을 누르면 같은 계정인지 확인한 뒤 이어서 쓸 수 있어요. 화면을 닫거나 새로고침하면 저장하지 않은 입력은 사라져요.',
    signInLabel: '다시 로그인', signInDisabled: false, canReconnect: true,
    canImportDevice: false, canRetryNotebook: false,
  };
  if (loading) return {
    loading: true, locked: true, concealNotebook: !sameAccountRestoring && !refreshingNotebook, kind: 'pending',
    title: sameAccountRestoring ? '같은 계정인지 다시 확인하고 있어요.' : refreshingNotebook ? '계정 수첩의 새 내용을 불러오고 있어요.' : connected || account.status === 'restoring' ? '내 계정과 수첩을 불러오고 있어요.' : account.status === 'signing-in' ? 'SYNK ID 로그인 화면으로 이동하고 있어요.' : '로그인 상태를 확인하고 있어요.',
    detail: sameAccountRestoring || refreshingNotebook ? '열어 둔 수첩과 입력은 그대로예요. 확인이 끝나면 이어서 쓸 수 있어요.' : '계정에 저장한 수첩을 불러오고 있어요. 다 불러오면 사람과 기록이 보여요.',
    signInLabel: '확인 중…', signInDisabled: true,
    canImportDevice: false, canRetryNotebook: false,
  };
  if (choosing) return {
    loading: false, locked: true, concealNotebook: true, kind: 'attention',
    title: '먼저 이어 볼 수첩을 골라 주세요.',
    detail: '「계정 상태 보기」에서 이어 쓸 기록을 고르면 사람과 일정이 보여요. 고르지 않은 기록도 그대로 남아요.',
    signInLabel: 'SYNK ID로 로그인', signInDisabled: false,
    canImportDevice: false, canRetryNotebook: true,
  };
  if (notebookFailure) return {
    loading: false, locked: true, concealNotebook: true, kind: 'error',
    title: '계정 수첩을 불러오지 못했어요.',
    detail: `${sync.error?.message || (typeof sync.error === 'string' ? sync.error : '') || '계정 수첩에 연결하지 못했어요.'} 수첩을 불러오기 전에는 내용을 바꾸거나 이 기기 수첩을 옮기지 않아요. 아래 「계정 자료 다시 불러오기」를 눌러 주세요.`,
    signInLabel: 'SYNK ID로 로그인', signInDisabled: false,
    canImportDevice: false, canRetryNotebook: true,
  };
  const error = account.error?.message || (typeof account.error === 'string' ? account.error : '');
  const returned = account.status === 'login-returned';
  return {
    loading: false, locked: false, concealNotebook: false, kind: error ? 'error' : 'ready',
    title: error ? '로그인 상태를 확인하지 못했어요.' : returned ? '로그인을 다시 시작할 수 있어요.' : account.configured ? 'SYNK ID로 로그인하면 수첩을 계정에 저장해요' : '지금은 로그인을 쓸 수 없어요',
    detail: error || (returned ? '이 화면에서는 로그인 완료를 확인하지 못했어요. 이어서 하려면 「SYNK ID로 로그인」을 눌러 주세요. 이 기기의 수첩은 그대로예요.' : account.configured ? '로그인하면 계정에 저장한 수첩을 불러와요. 지금 이 기기의 수첩은 골라서 옮길 수 있어요.' : '지금은 이 기기에서만 수첩을 쓸 수 있어요.'),
    signInLabel: account.error?.retryable ? '다시 로그인' : account.configured ? 'SYNK ID로 로그인' : '로그인 준비 중', signInDisabled: !account.configured && !account.error?.retryable,
    canImportDevice: hasNotebook, canRetryNotebook: connected && sync.status !== 'loading',
  };
}

/** BFCache restores the outgoing page, not a completed login or a new session. */
export function resumeCareLoginNavigation(account, persisted) {
  if (!persisted || account?.status !== 'signing-in' || account.signedIn || account.accountId) return account;
  return { ...account, status: 'login-returned' };
}
