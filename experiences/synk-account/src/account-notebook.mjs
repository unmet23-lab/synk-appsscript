import { createProductAccount } from './product-account.mjs';
import { createDocumentSync, documentSyncErrorMessage } from './document-sync.mjs';
import { validatePersonalState } from './personal-data.mjs';

const operations = Object.freeze({ load: 'personalLoad', save: 'personalSave', delete: 'personalDelete' });
const copy = value => structuredClone(value);
const labels = { loading: '계정 기록 불러오는 중', saving: '계정에 저장하고 있어요', synced: '계정에 저장했어요', idle: '계정 저장 대기 중', conflict: '다른 기기의 변경을 확인해 주세요', 'local-conflict': '이 기기의 미저장 기록을 골라 주세요', offline: '연결을 기다리고 있어요', error: '계정 기록 확인 필요', 'storage-error': '기기 임시 저장 확인 필요' };

/** Shared account controls; product editors and their guest records stay owned
 * by each app. Save acknowledgements do not call applyState or reset forms. */
export function createAccountNotebook({ resource, mount, content, description, getState, applyState, emptyDocument,
  toDocument = value => value, fromDocument = value => value, onMode = () => {}, beforeNavigate = () => true,
  prepareRetry = () => false, onDocumentSaved = () => {}, onDocumentRemoved = () => {}, onStatusChange = () => {}, pendingDescription = '', deleteLabel = '', signOutLabel = '로그아웃',
  deleteConfirmation = '이 계정의 앨범 전체와 보관한 사진·음성 원본을 삭제할까요? 다른 기기에서도 다시 불러올 수 없어요. 보관할 앨범은 먼저 파일로 내보내 주세요.',
  bridge = globalThis.synkPersonalAccount, accountFactory = createProductAccount, syncFactory = createDocumentSync, preferRemoteOnOpen = false,
  storage = { getItem: key => globalThis.localStorage.getItem(key), setItem: (key, value) => globalThis.localStorage.setItem(key, value), removeItem: key => globalThis.localStorage.removeItem(key), key: index => globalThis.localStorage.key(index), get length() { return globalThis.localStorage.length; } },
} = {}) {
  if (!mount || !getState || !applyState || !emptyDocument) throw new TypeError('계정 기록 화면 계약이 필요해요.');
  const validateState = value => validatePersonalState(resource, value);
  let account, sync, owner = null, ownerAccountId = null, generation = 0, stateVersion = 0, conversionVersion = 0, deletionVersion = 0, guest = null, authPaused = false, reading = null;
  let auth = { status: 'unconfigured', configured: false }, saved = { status: 'closed', pending: false };
  let closed = false, switching = false, hydrating = false, converting = false, deleting = false, unsent = null, problem = '', suspended = false, hydrationFailure = null, incomingDocument = null;
  let pageSuspended = false, reconnecting = false, resumePromise = null, resumeVersion = 0, resumeMessage = '', contentWasHidden = false, contentConcealed = false;
  mount.classList.add('account-notebook');
  mount.innerHTML = '<div class="notebook-heading"><div><p class="notebook-eyebrow">SYNK ID</p><h2>내 계정으로 이어가기</h2></div><strong data-notebook-status role="status" aria-live="polite"></strong></div><p data-notebook-detail></p><p class="notebook-description"></p><div class="notebook-actions"><button type="button" data-notebook="signin">SYNK ID로 로그인</button><button type="button" data-notebook="refresh" hidden>다시 불러오기</button><button type="button" data-notebook="retry" hidden>저장 다시 시도</button><button type="button" data-notebook="import" hidden>기기 기록을 계정으로 옮기기</button><button type="button" data-notebook="signout" hidden>로그아웃</button></div><div class="notebook-conflict" hidden><p>서로 다른 기록을 자동으로 합치지 않아요. 사용할 기록을 직접 골라 주세요.</p><button type="button" data-notebook="remote">계정의 기록 사용</button><button type="button" data-notebook="local">이 화면의 기록으로 저장</button></div>';
  mount.querySelector('.notebook-description').textContent = description;
  mount.querySelector('[data-notebook="signout"]').textContent = signOutLabel;
  if (preferRemoteOnOpen) mount.querySelector('[data-notebook="remote"]').textContent = '미저장 기록 남기고 계정 기록 열기';
  const pendingNote = document.createElement('p'); pendingNote.className = 'notebook-description'; pendingNote.dataset.notebookPending = ''; pendingNote.textContent = pendingDescription; pendingNote.hidden = true; mount.append(pendingNote);
  const recoveryButton = document.createElement('button'); recoveryButton.type = 'button'; recoveryButton.dataset.notebook = 'recover'; recoveryButton.textContent = '미저장 기록 남기고 저장본 열기'; recoveryButton.hidden = true; mount.querySelector('.notebook-actions').append(recoveryButton);
  const localNote = document.createElement('p'); localNote.dataset.notebookLocal = ''; localNote.setAttribute('role', 'status'); mount.append(localNote);
  for (const [action, label] of [['export-local', '계정 임시기록 복구 파일 내보내기'], ['clear-local', '이 기기의 계정 임시기록 지우기'], ['delete', deleteLabel]]) {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.notebook = action; button.textContent = label; button.hidden = true; mount.querySelector('.notebook-actions').append(button);
  }
  const draftChoices = document.createElement('div'); draftChoices.className = 'notebook-drafts'; draftChoices.dataset.notebookDrafts = ''; draftChoices.hidden = true; mount.append(draftChoices);
  const element = name => mount.querySelector(`[data-notebook="${name}"]`);
  const isReading = () => saved.status === 'loading' || reading?.generation === generation;
  function paint() {
    const active = !!owner, pending = saved.pending || converting || !!unsent, authPending = active && !auth.signedIn;
    const saveInProgress = active && pending && !authPending && !suspended && !problem && !hydrationFailure && !saved.error && (converting || ['idle', 'saving'].includes(saved.status));
    const local = saved.localRecords || { count: 0, pending: 0, corrupt: 0 };
    const missingPendingMedia = hydrationFailure && saved.pending && ['ASSET_NOT_FOUND', 'ASSET_NOT_CONFIRMED'].includes(hydrationFailure.code);
    const loading = active && !suspended && isReading();
    const working = deleting || hydrating || switching || reconnecting || loading;
    if (content) {
      content.inert = pageSuspended || working || suspended || saved.status === 'local-conflict'; content.setAttribute('aria-busy', String(working));
      const conceal = pageSuspended || authPaused;
      if (conceal && !contentConcealed) contentWasHidden = !!content.hidden;
      if (conceal) content.hidden = true;
      else if (contentConcealed) content.hidden = contentWasHidden;
      contentConcealed = conceal;
    }
    mount.querySelector('[data-notebook-status]').textContent = deleting ? '계정 기록 삭제 중' : authPending ? '로그인 다시 확인 필요' : suspended ? problem ? '기록을 다시 불러와 주세요' : '로그인 다시 확인 중' : converting ? '원본을 계정에 보관 중' : hydrating ? '보관한 원본을 불러오는 중' : active ? loading ? labels.loading : problem ? labels.error : saveInProgress ? labels.saving : labels[saved.status] || '계정 기록 연결 중' : auth.status === 'unconfigured' ? '이 기기에서 사용 중' : ['restoring', 'signing-in'].includes(auth.status) ? '로그인 확인 중' : '로그인 전';
    mount.querySelector('[data-notebook-detail]').textContent = problem || auth.error?.message || saved.error?.message || (active ? loading ? '계정 기록을 불러오고 있어요. 잠시만 기다려 주세요.' : saveInProgress ? '계정에 저장하고 있어요. 저장이 끝나면 알려 드려요.' : pending ? '아직 계정 저장을 마치지 못했어요. 연결이 돌아오면 다시 시도할 수 있어요.' : '로그인한 계정에 저장해요. 다른 기기에서는 다시 불러오기로 최신 기록을 확인하세요.' : auth.status === 'unconfigured' ? '이 실행 환경의 계정 연결 설정을 준비하고 있어요. 기기 기록은 계속 사용할 수 있어요.' : 'SYNK ID 하나로 로그인해요. 로그인 전의 기기 기록은 직접 옮길 때만 계정에 저장해요.');
    if (missingPendingMedia) mount.querySelector('[data-notebook-detail]').textContent = '미저장 앨범에 필요한 원본을 찾지 못했어요. 파일이 있는 기기나 내보낸 앨범에서 다시 저장하거나, 미저장 기록을 기기에 남기고 마지막 계정 저장본을 열 수 있어요.';
    if (deleting) mount.querySelector('[data-notebook-detail]').textContent = '계정의 삭제 결과를 확인하고 있어요. 결과가 확인될 때까지 새 기록을 입력할 수 없어요.';
    if (authPending) mount.querySelector('[data-notebook-detail]').textContent = auth.error?.message || '현재 기록을 유지하고 있어요. 계정 연결을 다시 확인해 주세요.';
    pendingNote.hidden = !active || !pending || !pendingDescription;
    const localNoticeCode = saved.warning?.code || (local.corrupt ? 'INVALID_LOCAL_CACHE' : null);
    localNote.hidden = !local.count && !local.unknown && !saved.warning || !local.unknown && !!localNoticeCode && saved.error?.code === localNoticeCode;
    localNote.textContent = (saved.warning?.message || (local.corrupt ? '읽지 못한 이 계정의 임시기록 원본을 보존했어요. 복구 파일로 내보낸 뒤 직접 지울 수 있어요.' : active ? preferRemoteOnOpen && !pending && saved.localDrafts?.length ? '계정 기록을 열었어요. 이전 미저장 기록은 이 기기에 따로 보관했으며 필요할 때 아래에서 열 수 있어요.' : '계정에 보내지 못한 변경만 이 기기에 임시 보관해요. 저장이 끝나면 기기 사본을 지워요.' : `미저장 계정 임시기록 ${local.count}개가 이 기기에 남아 있어요. 기록을 남긴 계정으로 로그인하면 이어 사용할 기록을 고르거나 복구 파일로 내보내고 지울 수 있어요.`)) + (local.unknown ? ' 계정을 확인할 수 없는 손상 원본은 그대로 보존하며 이 화면에서 내보내거나 지우지 않아요.' : '');
    element('export-local').hidden = !active || authPending || !local.exportable;
    element('export-local').disabled = !active || authPending || pageSuspended;
    element('clear-local').hidden = !active || !local.exportable;
    element('clear-local').disabled = pending || working || authPending || saved.status === 'saving';
    element('delete').hidden = !active || !deleteLabel;
    element('delete').disabled = working || converting || authPending;
    recoveryButton.hidden = !missingPendingMedia; recoveryButton.disabled = working || converting || authPending;
    element('signin').hidden = active && !authPending && (!suspended || !!problem);
    const retryConnection = !auth.signedIn && auth.error?.retryable === true;
    element('signin').textContent = retryConnection ? '계정 연결 다시 확인' : 'SYNK ID로 로그인';
    element('signin').disabled = !auth.configured && !retryConnection || ['restoring', 'signing-in'].includes(auth.status);
    for (const action of ['refresh', 'import', 'signout']) element(action).hidden = !active;
    element('retry').hidden = !active || saveInProgress || !pending && !hydrationFailure && !['offline', 'error', 'storage-error'].includes(saved.status);
    element('import').disabled = working || converting || authPending || !guest;
    element('refresh').disabled = working || converting || authPending;
    element('retry').disabled = working || converting || authPending;
    mount.querySelector('.notebook-conflict').hidden = !['conflict','local-conflict'].includes(saved.status);
    element('local').hidden = saved.status === 'local-conflict';
    for (const action of ['remote', 'local']) element(action).disabled = working || converting || authPending;
    draftChoices.hidden = !active || !(saved.localDrafts?.length > 0 || saved.status === 'local-conflict');
    draftChoices.replaceChildren();
    if (!draftChoices.hidden) {
      const note = document.createElement('p'); note.textContent = preferRemoteOnOpen ? '별도로 보관한 미저장 기록이에요. 필요할 때만 열어 보세요. 지금 계정 기록은 계속 사용할 수 있어요.' : '여러 탭이나 이전 사용의 미저장 기록이 있어요. 열 기록을 골라 주세요. 선택하지 않은 기록은 보존돼요.'; draftChoices.append(note);
      for (const [index, draft] of (saved.localDrafts || []).entries()) {
        const button = document.createElement('button'); button.type = 'button'; button.dataset.notebook = 'select-draft'; button.dataset.draftId = draft.id;
        const created = draft.createdAt && !Number.isNaN(Date.parse(draft.createdAt)) ? new Date(draft.createdAt).toLocaleString('ko-KR') : '작성 시각을 모르는 이전 기록';
        button.textContent = `기록 ${index + 1} · ${created} 열기`; button.disabled = working || converting || authPending; draftChoices.append(button);
      }
    }
    if (pageSuspended) {
      mount.querySelector('[data-notebook-status]').textContent = reconnecting ? '계정 연결 다시 확인 중' : '계정 연결 확인 필요';
      mount.querySelector('[data-notebook-detail]').textContent = resumeMessage || '이전에 작성하던 화면을 보관하고 있어요. 같은 계정을 확인한 뒤 이어서 보여 드려요.';
      pendingNote.hidden = true; localNote.hidden = true; draftChoices.hidden = true; mount.querySelector('.notebook-conflict').hidden = true;
      for (const name of ['refresh', 'import', 'delete', 'recover', 'export-local', 'clear-local']) element(name).disabled = true;
      element('export-local').hidden = true;
      element('retry').hidden = false; element('retry').disabled = reconnecting; element('retry').textContent = '계정 연결 다시 확인';
      element('signin').hidden = !auth.signedIn ? false : auth.accountId === ownerAccountId;
      element('signin').disabled ||= reconnecting;
      if (auth.signedIn) element('signin').textContent = '현재 로그인 계정으로 전환';
    } else element('retry').textContent = '저장 다시 시도';
    onStatusChange();
  }
  function preserveInterruptedRead() {
    if (hydrating && incomingDocument && !unsent) {
      hydrationFailure = { code: 'AUTH_RESTORING', document: incomingDocument };
      problem = '로그인 연결을 다시 확인하는 동안 기록 읽기가 멈췄어요. 저장 다시 시도로 보관한 기록을 다시 열어 주세요.';
    }
    incomingDocument = null;
  }
  function onAuth(next) {
    auth = next;
    if (pageSuspended) { paint(); return; }
    const nextOwner = next.signedIn && next.accountId ? `${next.accountId}:${next.sessionGeneration}` : null;
    if (!nextOwner && owner && ['restoring', 'signing-in', 'error'].includes(next.status)) {
      if (!authPaused) { preserveInterruptedRead(); generation++; stateVersion++; conversionVersion++; hydrating = false; converting = false; }
      authPaused = true; suspended = true; paint(); return;
    }
    suspended = !!hydrationFailure;
    if (nextOwner && ownerAccountId === next.accountId && (authPaused || nextOwner !== owner)) {
      // A newly verified token for the same person keeps the document's original
      // revision and unsent originals. A different person still gets a new store.
      preserveInterruptedRead(); generation++; stateVersion++; conversionVersion++; hydrating = false; converting = false;
      owner = nextOwner; authPaused = false;
      suspended = !!hydrationFailure;
      if (unsent) problem = '같은 계정으로 다시 연결했어요. 보내지 못한 원본과 기록을 유지하고 있으니 저장 다시 시도로 이어가 주세요.';
      paint(); return;
    }
    if (nextOwner === owner) { paint(); return; }
    generation++; stateVersion++; conversionVersion++; deletionVersion++; hydrating = false; converting = false; deleting = false; unsent = null; problem = ''; hydrationFailure = null; incomingDocument = null; suspended = false;
    switching = true; const wasActive = !!owner;
    if (!owner && nextOwner) guest = copy(getState());
    owner = nextOwner; ownerAccountId = nextOwner ? next.accountId : null; authPaused = false;
    sync.close();
    if (owner) {
      onMode(true, { wasActive }); switching = false;
      void sync.open(next.accountId);
    } else {
      onMode(false);
      if (guest) { applyState(copy(guest), { guest: true }); guest = null; }
      switching = false;
    }
    paint();
  }
  function guardedAccount(expected) {
    const guard = () => { if (expected !== generation || !owner || closed || authPaused || pageSuspended) throw Object.assign(new Error('계정 연결이 바뀌어 이전 파일 작업을 멈췄어요.'), { code: 'ACCOUNT_CHANGED' }); };
    return { async request(operation, values) { guard(); const result = await account.request(operation, values); guard(); return result; } };
  }
  async function receive(document) {
    if (switching || !owner || authPaused || pageSuspended || closed) return;
    const expected = generation, version = ++stateVersion;
    hydrating = true; incomingDocument = copy(document); problem = ''; paint();
    try {
      const state = await fromDocument(document, guardedAccount(expected));
      if (expected !== generation || version !== stateVersion || !owner || closed) return;
      hydrationFailure = null; suspended = false; unsent = null;
      applyState(state, { guest: false });
    } catch (error) { if (expected === generation && version === stateVersion) { problem = error.message; suspended = true; hydrationFailure = { code: error.code, document: copy(document) }; } }
    finally { if (expected === generation && version === stateVersion) { hydrating = false; incomingDocument = null; paint(); } }
  }
  account = accountFactory({ clientKey: resource, endpoint: 'synk-personal', scope: 'synk-personal', resource, validateState, operations, bridge, onStatus: onAuth });
  sync = syncFactory({ validateState, emptyState: emptyDocument, scope: 'synk-personal', resource, preferRemoteOnOpen, cachePrefix: `synk.personal.${resource}.v1.`, operations, transport: async (operation, values) => {
    if (pageSuspended || authPaused || !auth.signedIn) throw Object.assign(new Error('계정 연결을 다시 확인한 뒤 기록을 저장해 주세요. 현재 기록은 유지하고 있어요.'), { code: 'AUTH_RESTORING' });
    const expected = generation, inputVersion = conversionVersion, read = operation === operations.load ? { generation: expected } : null;
    // A local-storage warning may replace the sync status while a read is still
    // running. Keep its interaction lock separate from those warnings.
    if (read) { reading = read; paint(); }
    try {
      const response = await account.request(operation, values);
      if (expected !== generation) throw Object.assign(new Error('로그인 연결이 바뀌어 이전 요청 결과를 적용하지 않았어요. 다시 시도해 주세요.'), { code: 'AUTH_RESTORING' });
      // Media conversion begins before document-sync sees the edit. Reject an
      // older read before it can replace that original or advance its revision.
      if (operation === operations.load && inputVersion !== conversionVersion) throw Object.assign(new Error('가져오는 동안 새로 수정한 내용이 있어요. 현재 입력을 유지하고 기록을 다시 골라 주세요.'), { code: 'LOCAL_CHANGED_DURING_REFRESH' });
      return response;
    } finally { if (read && reading === read) { reading = null; paint(); } }
  }, storage, onState: receive,
    onSaved: document => { if(owner&&!closed)onDocumentSaved(document); }, onRemoved: () => { if(owner&&!closed)onDocumentRemoved(); },
    onStatus: next => { saved = next; paint(); } });
  saved.localRecords = sync.localRecords();
  if (saved.localRecords.error) saved.error = saved.localRecords.error;
  async function change(value) {
    if (!owner || pageSuspended || suspended || deleting || closed) return false;
    stateVersion++; hydrating = false; hydrationFailure = null; incomingDocument = null;
    const expected = generation, version = ++conversionVersion;
    const snapshot = copy(value); unsent = snapshot; converting = true; problem = ''; paint();
    try {
      const document = await toDocument(snapshot, guardedAccount(expected));
      if (expected !== generation || version !== conversionVersion || !owner || closed) return false;
      sync.change(document); unsent = null; return true;
    } catch (error) { if (expected === generation && version === conversionVersion) problem = documentSyncErrorMessage(error); return false; }
    finally { if (expected === generation && version === conversionVersion) { converting = false; paint(); } }
  }
  async function retry() {
    if (pageSuspended) return resume();
    if (deleting || authPaused) return false;
    if (hydrationFailure) { await receive(hydrationFailure.document); return suspended ? false : sync.flush(); }
    const expected = generation, rebuild = await prepareRetry({ error: saved.error, pending: saved.pending });
    if (expected !== generation || !owner || closed) return false;
    if (rebuild && !await change(getState())) return false;
    if (!rebuild && unsent && !await change(unsent)) return false;
    return sync.flush();
  }
  async function signOutWithNotice() {
    // signOut closes local auth immediately; fence the remaining remote result
    // after that transition so it cannot overwrite a later account's status.
    const operation = account.signOut(), expected = generation;
    const current = () => !closed && !owner && expected === generation && !['restoring', 'signing-in'].includes(auth.status);
    try {
      const result = await operation;
      if (!current()) return;
      const warnings = [];
      if (result?.ok === false) warnings.push('이 기기의 로그인 정보 삭제를 확인하지 못했어요. 공유 기기라면 브라우저나 앱의 저장 정보를 확인해 주세요.');
      if (result?.serverRevoked === false) warnings.push('서버의 세션 종료는 확인하지 못했어요. 연결이 돌아오면 SYNK ID의 로그인 기기에서 이 세션을 종료해 주세요.');
      if (warnings.length) problem = warnings.join(' ');
    } catch (error) { if (current()) problem = documentSyncErrorMessage(error); }
  }
  async function act(action, target) {
    if (pageSuspended && !['signin', 'signout', 'retry'].includes(action)) return;
    if (deleting && !['signout', 'export-local'].includes(action) || !pageSuspended && authPaused && !['signin', 'signout'].includes(action)) return;
    const expected = generation;
    problem = '';
    try {
      if (action === 'signin') {
        if (pageSuspended && auth.signedIn && auth.accountId !== ownerAccountId) {
          if (beforeNavigate() && globalThis.confirm('현재 로그인 계정으로 전환할까요? 현재 창에서 기기에 보관하지 못한 입력은 사라져요.')) { leaveSuspension(); onAuth(auth); }
        } else if (beforeNavigate() && (!pageSuspended || !(unsent || saved.pending && saved.pendingStored === false) || globalThis.confirm('이 창을 벗어나 로그인하면 아직 보관하지 못한 원본이나 입력이 사라질 수 있어요. 다시 로그인할까요?'))) {
          const next = await account.signIn();
          if (pageSuspended && next?.signedIn && next.accountId === ownerAccountId) await resume();
          else if (!pageSuspended && next) onAuth(next);
        }
      }
      else if (action === 'signout') { if (beforeNavigate() && (!(converting || unsent || saved.pending && saved.pendingStored === false) || globalThis.confirm('아직 원본이나 기록을 계정에 저장하지 못했고 기기 임시보관도 확인하지 못했어요. 현재 기록을 내보내지 않고 로그아웃할까요?'))) { leaveSuspension(); await signOutWithNotice(); } }
      else if (action === 'refresh') {
        if (unsent || converting) problem = '아직 계정에 보내지 못한 원본과 기록이 있어요. 저장 다시 시도를 먼저 하거나 현재 기록을 파일로 내보내 주세요. 다시 불러오기로 이 기록을 바꾸지 않았어요.';
        else if (beforeNavigate()) { if (hydrationFailure) await receive(hydrationFailure.document); else { suspended = false; await sync.refresh(); } }
      }
      else if (action === 'retry') await retry();
      else if (action === 'select-draft' && beforeNavigate() && (!(saved.pending || unsent) || globalThis.confirm('현재 화면 대신 선택한 미저장 기록을 열까요? 기기에 보관한 다른 미저장 기록은 그대로 남아요. 보관하지 못한 입력은 먼저 내보내 주세요.'))) { await sync.selectLocalDraft(target.dataset.draftId); }
      else if (action === 'export-local') {
        const file = new Blob([JSON.stringify(sync.exportLocalRecords(), null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(file), link = document.createElement('a'); link.href = url; link.download = `synk-${resource}-local-recovery.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      else if (action === 'clear-local' && owner && !saved.pending && !converting && !unsent && !hydrating && globalThis.confirm('로그인한 이 계정이 이 앱에 남긴 임시기록을 지울까요? 미저장 변경과 읽지 못한 원본은 복구할 수 없어요. 다른 계정의 임시기록, 계정 서버 자료, 로그인 전 기기 기록은 그대로예요. 필요한 복구 파일을 실제로 저장했는지 먼저 확인해 주세요.')) sync.clearLocalRecords();
      else if (action === 'delete' && owner && beforeNavigate() && globalThis.confirm(deleteConfirmation)) await remove();
      else if (action === 'import' && guest && beforeNavigate() && globalThis.confirm('로그인 전 이 기기의 기록으로 현재 계정 기록을 바꿀까요? 보관할 계정 기록은 먼저 내보내 주세요.')) { applyState(copy(guest), { guest: false }); await change(guest); }
      else if (action === 'remote') {
        if (preferRemoteOnOpen && (unsent || converting)) problem = '아직 기기에 보관하지 못한 입력이 있어 계정 기록으로 바꾸지 않았어요. 저장 다시 시도 후 열어 주세요.';
        else if (beforeNavigate() && (preferRemoteOnOpen || globalThis.confirm('이 화면의 미저장 변경을 버리고 계정 기록을 불러올까요?'))) await sync.resolveRemote();
      }
      else if (action === 'recover' && hydrationFailure && saved.pending && ['ASSET_NOT_FOUND', 'ASSET_NOT_CONFIRMED'].includes(hydrationFailure.code) && globalThis.confirm('미저장 기록은 복구용으로 이 기기에 남겨 두고 마지막 계정 저장본을 열까요? 현재 화면은 저장본으로 바뀌어요. 남긴 기록은 이 계정으로 로그인한 상태에서 직접 지울 수 있어요.')) { hydrationFailure = null; unsent = null; suspended = false; await sync.resolveRemote(); }
      else if (action === 'local' && globalThis.confirm('이 화면의 기록으로 계정 기록을 바꿀까요? 다른 기기의 변경 내용은 덮어써요.')) { if (!unsent || await change(unsent)) await sync.resolveLocal(); }
    } catch (error) { if (!closed && expected === generation) problem = documentSyncErrorMessage(error); }
    paint();
  }
  mount.addEventListener('click', event => { const target = event.target.closest('[data-notebook]'); if (target) void act(target.dataset.notebook, target); });
  const beforeUnload = event => { if (owner && (saved.pending || unsent || converting)) { event.preventDefault(); event.returnValue = ''; } };
  globalThis.addEventListener('beforeunload', beforeUnload);
  async function remove() {
    if (!owner || closed || pageSuspended || authPaused || deleting || converting || hydrating) return false;
    const expected = generation, deletion = ++deletionVersion; deleting = true; paint();
    try {
      const removed = await sync.remove();
      if (removed && expected === generation) { unsent = null; conversionVersion++; problem = ''; }
      return removed;
    } finally { if (deletion === deletionVersion) { deleting = false; paint(); } }
  }
  function leaveSuspension() {
    pageSuspended = false; reconnecting = false; resumeMessage = ''; resumeVersion++; resumePromise = null;
  }
  function suspend() {
    if (closed) return;
    pageSuspended = true; resumeVersion++; resumePromise = null; reconnecting = false;
    preserveInterruptedRead(); generation++; stateVersion++; conversionVersion++; hydrating = false; converting = false;
    paint();
  }
  function resume() {
    if (closed) return Promise.resolve(false);
    if (!pageSuspended) return Promise.resolve(true);
    if (resumePromise) return resumePromise;
    if (!owner) {
      if (auth.signedIn) { resumeMessage = '로그인 확인이 끝났어요. 현재 창의 입력을 보관하고 있으니 계정 기록으로 전환할 때 직접 선택해 주세요.'; paint(); return Promise.resolve(false); }
      leaveSuspension(); paint(); return Promise.resolve(true);
    }
    const expected = resumeVersion, identity = ownerAccountId;
    reconnecting = true; resumeMessage = ''; paint();
    const operation = (async () => {
      try {
        // Validate the original account without applying a remote document or
        // changing its revision: app-owned form drafts must stay untouched.
        const response = await account.request(operations.load);
        if (closed || expected !== resumeVersion) return false;
        if (!auth.signedIn || auth.accountId !== identity || response?.accountId !== identity)
          throw new Error('이전에 작성하던 계정과 연결이 달라졌어요. 같은 계정으로 로그인하거나 현재 계정으로 직접 전환해 주세요.');
        leaveSuspension(); onAuth(auth); paint(); return true;
      } catch (error) {
        if (!closed && expected === resumeVersion) resumeMessage = '작성 중인 화면은 숨긴 채 보관하고 있어요. ' + documentSyncErrorMessage(error);
        return false;
      } finally { if (!closed && expected === resumeVersion) { reconnecting = false; resumePromise = null; paint(); } }
    })();
    resumePromise = operation; return operation;
  }
  paint();
  return { start: () => account.start(), change, retry, remove, suspend, resume,
    // A guest device write can finish after login. Its acknowledged snapshot
    // belongs to the guest; only explicit import may copy it into the account.
    updateGuestState(value) { if (!owner || !guest || closed) return false; guest = copy(value); return true; },
    get active() { return !!owner; }, get pending() { return !!owner && (saved.pending || !!unsent || converting); },
    // App-owned dialogs can live outside content. They must honor the same
    // account lock before replacing their own in-memory document.
    get canEdit() { return !!owner && !closed && !authPaused && !pageSuspended && !suspended && !deleting && !hydrating && !switching && !reconnecting && !isReading() && saved.status !== 'local-conflict'; },
    get status() { return { ...saved, status: isReading() ? 'loading' : saved.status, active: !!owner, hydrating, converting, deleting, error: problem }; },
    dispose() { closed = true; generation++; deletionVersion++; resumeVersion++; switching = true; sync.close(); account.dispose(); globalThis.removeEventListener('beforeunload', beforeUnload); },
  };
}
