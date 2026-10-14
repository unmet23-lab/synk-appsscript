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
    title: '계정 연결을 다시 확인해 주세요.',
    detail: '열어 둔 수첩과 아직 저장하지 않은 입력은 이 화면에 보관하고 있어요. 아래의 ‘계정 연결 다시 확인’을 누르면 같은 계정인지 확인한 뒤 이어 쓸 수 있어요. 화면을 닫거나 새로고침하면 보관하지 않은 입력은 사라져요.',
    signInLabel: '계정 연결 다시 확인', signInDisabled: false, canReconnect: true,
    canImportDevice: false, canRetryNotebook: false,
  };
  if (loading) return {
    loading: true, locked: true, concealNotebook: !sameAccountRestoring && !refreshingNotebook, kind: 'pending',
    title: sameAccountRestoring ? '같은 계정의 연결을 다시 확인하고 있어요.' : refreshingNotebook ? '계정 수첩의 새 내용을 확인하고 있어요.' : connected || account.status === 'restoring' ? '내 계정과 수첩을 불러오고 있어요.' : account.status === 'signing-in' ? 'SYNK 로그인으로 이동하고 있어요.' : '계정 연결 상태를 확인하고 있어요.',
    detail: sameAccountRestoring || refreshingNotebook ? '열어 둔 수첩과 입력은 그대로예요. 확인이 끝나면 계속 편집할 수 있어요.' : '저장한 수첩을 확인하는 동안 잠시 기다려 주세요. 불러오기가 끝나면 사람과 기록이 나타나요.',
    signInLabel: '계정 확인 중…', signInDisabled: true,
    canImportDevice: false, canRetryNotebook: false,
  };
  if (choosing) return {
    loading: false, locked: true, concealNotebook: true, kind: 'attention',
    title: '먼저 이어 볼 수첩을 골라 주세요.',
    detail: '위 계정 영역에서 미저장 기록을 선택하면 사람과 일정을 보여드려요. 선택하지 않은 기록도 보존돼요.',
    signInLabel: 'SYNK 계정 연결', signInDisabled: false,
    canImportDevice: false, canRetryNotebook: true,
  };
  if (notebookFailure) return {
    loading: false, locked: true, concealNotebook: true, kind: 'error',
    title: '계정 수첩을 아직 불러오지 못했어요.',
    detail: `${sync.error?.message || (typeof sync.error === 'string' ? sync.error : '') || '계정 연결을 확인해 주세요.'} 수첩을 확인하기 전에는 내용을 바꾸거나 기기 수첩을 옮기지 않아요. 위의 ‘계정 자료 다시 불러오기’를 눌러 다시 시도해 주세요.`,
    signInLabel: 'SYNK 계정 연결', signInDisabled: false,
    canImportDevice: false, canRetryNotebook: true,
  };
  const error = account.error?.message || (typeof account.error === 'string' ? account.error : '');
  const returned = account.status === 'login-returned';
  return {
    loading: false, locked: false, concealNotebook: false, kind: error ? 'error' : 'ready',
    title: error ? '계정 연결을 확인하지 못했어요.' : returned ? '계정 연결을 다시 시작할 수 있어요.' : account.configured ? 'SYNK 계정으로 수첩 이어 보기' : '이 환경의 SYNK 로그인 설정이 아직 준비되지 않았어요',
    detail: error || (returned ? '아직 이 화면에서 계정 연결 완료를 확인하지 못했어요. 계속하려면 SYNK 계정 연결을 눌러 주세요. 기기의 수첩은 그대로예요.' : account.configured ? '연결 후에는 계정 수첩을 불러와요. 지금 기기의 수첩은 직접 골라 옮길 수 있어요.' : '지금은 이 기기에서 수첩을 사용할 수 있어요. 계정 연결 설정을 확인한 뒤 다시 연결해 주세요.'),
    signInLabel: account.error?.retryable ? '계정 연결 다시 확인' : account.configured ? 'SYNK 계정 연결' : '계정 연결 준비 중', signInDisabled: !account.configured && !account.error?.retryable,
    canImportDevice: hasNotebook, canRetryNotebook: connected && sync.status !== 'loading',
  };
}

/** BFCache restores the outgoing page, not a completed login or a new session. */
export function resumeCareLoginNavigation(account, persisted) {
  if (!persisted || account?.status !== 'signing-in' || account.signedIn || account.accountId) return account;
  return { ...account, status: 'login-returned' };
}
