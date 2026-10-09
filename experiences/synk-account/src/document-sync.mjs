
const validRevision = value => Number.isSafeInteger(value) && value >= 0;
const failure = (code, revision) => Object.assign(new Error(code), { code, ...(validRevision(revision) ? { revision } : {}) });
const messages = {
  CARE_CLIENT_UPDATE_REQUIRED: '더 새로운 앱에서 저장한 문구 보관함이나 안부 설정이 있어요. 현재 자료를 백업한 뒤 새로고침해 주세요.',
  CARE_LIBRARY_RECOVERY_REVIEW: '계정 보관함의 이전 문구·즐겨찾기 또는 안부 주기 설정이 이 임시기록에는 없어요. 임시기록을 복구 파일로 백업한 뒤 계정 수첩을 선택해 주세요.',
  REVISION_CONFLICT: '다른 기기에서 기록이 바뀌었어요. 어느 기록을 사용할지 골라 주세요.',
  LOCAL_CHANGED_DURING_REFRESH: '가져오는 동안 새로 수정한 내용이 있어요. 기록을 다시 골라 주세요.',
  AUTH_REQUIRED: 'SYNK 계정에 다시 로그인해 주세요.', SESSION_REVOKED: '로그인이 종료되었어요. 다시 로그인해 주세요.',
  ACCOUNT_UNAVAILABLE: '지금은 이 계정의 기록을 사용할 수 없어요.', PRODUCT_FORBIDDEN: '이 로그인으로는 플레저 기록에 접근할 수 없어요.',
  CARE_ACCOUNT_MISMATCH: '로그인 계정과 기록의 계정이 달라요. 다시 로그인해 주세요.',
  INVALID_CARE_RESPONSE: '계정에서 받은 기록을 확인하지 못했어요. 다시 불러와 주세요.',
  INVALID_CARE_STATE: '저장할 기록을 확인하지 못했어요. 현재 자료를 내보내 주세요.',
  INVALID_LOCAL_CACHE: '읽지 못한 기기 임시 기록의 원본을 그대로 보존했어요. 로그인한 계정의 기록으로 확인된 원본만 복구 파일로 내보내거나 직접 지울 수 있어요.',
  LOCAL_DRAFT_CONFLICT: '이 계정의 미저장 기록이 기기에 남아 있어요. 다른 탭에서 편집 중일 수도 있으니 이어서 사용할 기록을 직접 골라 주세요. 고르지 않은 기록도 보존해요.',
  LOCAL_STORAGE_UNAVAILABLE: '이 기기의 임시 기록을 보관하거나 지우지 못했어요. 저장 결과를 확인하고 현재 자료를 내보내 주세요.',
  LOCAL_CACHE_IN_USE: '현재 변경을 저장하거나 계정 저장본으로 전환한 뒤 이 계정의 임시기록을 지울 수 있어요. 진행 중인 저장·조회도 먼저 마쳐 주세요.',
  LOCAL_RECOVERY_AUTH_REQUIRED: '임시기록을 남긴 SYNK 계정으로 로그인해야 복구 파일 내보내기와 삭제를 할 수 있어요.',
  PAYLOAD_TOO_LARGE: '저장할 기록이 계정 보관 크기를 넘었어요. 먼저 내보낸 뒤 내용을 줄여 저장해 주세요.',
  INVALID_PERSONAL_STATE: '저장할 기록 형식을 확인하지 못했어요. 현재 자료를 내보내 보관해 주세요.',
  PERSONAL_DATA_TOO_LARGE: '저장할 기록이 계정 보관 크기를 넘었어요. 먼저 내보낸 뒤 내용을 줄여 저장해 주세요.',
  REVISION_CAPACITY: '이 기록의 저장 횟수 한도에 도달했어요. 현재 자료를 내보내 보관하고 지원을 요청해 주세요.',
  ASSET_NOT_FOUND: '앨범 원본을 찾지 못했어요. 현재 화면에 원본이 있다면 저장 다시 시도로 다시 올려 주세요.',
  ASSET_NOT_CONFIRMED: '앨범 원본의 보관을 확인하지 못했어요. 저장 다시 시도로 원본을 다시 올려 주세요.',
  MEDIA_QUOTA_EXCEEDED: '사진·음성 보관 공간 20MiB 또는 파일 수 한도에 도달했어요. 기존 사진·음성을 제거하고 저장을 마친 뒤 새 파일을 추가해 주세요.',
  CARE_UNAVAILABLE: '계정 저장 연결이 아직 준비되지 않았어요. 현재 기록은 이 기기에서 보관해요.',
  AUTH_UNAVAILABLE: '로그인 서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.',
};
export const documentSyncErrorMessage = error => messages[error?.code] || error?.message || '계정에 저장하지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.';

/** A verified account owns a separate cache and outbox. Guest state is never imported implicitly. */
export function createDocumentSync({ transport, storage, onState = () => {}, onStatus = () => {}, onSaved = () => {}, onRemoved = () => {}, validateState, emptyState, requiresConflictReview = () => false, preferRemoteOnOpen = false, scope, resource = null, cachePrefix, operations = { load: 'careLoad', save: 'careSave', delete: 'careDelete' } }) {
  if (typeof validateState !== 'function' || typeof emptyState !== 'function' || typeof requiresConflictReview !== 'function' || !scope || !cachePrefix) throw new TypeError('제품 기록 계약이 필요해요.');
  const clone = value => validateState(value);
  const PREFIX = cachePrefix;
  if (typeof transport !== 'function') throw new TypeError('계정 저장 통로가 필요해요.');
  let active = null, generation = 0, localError = null;
  const records = new Map(), knownKeys = new Set();
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const localSummary = () => {
    const all=[...records.values()], own=active ? all.filter(value=>value.accountId===active.accountId) : [];
    return {count:active?own.length:all.length,pending:own.filter(value=>value.pending).length,corrupt:own.filter(value=>value.corrupt).length,
      exportable:own.length,unknown:all.filter(value=>!value.accountId).length,error:localError};
  };
  function recordOwner(key,cached) {
    if(typeof cached?.accountId!=='string'||!cached.accountId||cached.accountId.length>120||/[\x00-\x20]/.test(cached.accountId))return null;
    const base=PREFIX+encodeURIComponent(cached.accountId);
    return key===base&&cached.draftId===undefined || UUID.test(cached.draftId||'')&&key===base+':draft:'+cached.draftId ? cached.accountId : null;
  }
  function cacheRecord(key, raw) {
    let accountId=null;
    try {
      if (new TextEncoder().encode(raw).byteLength > (resource === 'family-album' ? 32 : 4) * 1024 * 1024 + 32768) throw failure('INVALID_LOCAL_CACHE');
      const cached = JSON.parse(raw);
      accountId=recordOwner(key,cached);
      const base = PREFIX + encodeURIComponent(cached?.accountId);
      const draft = typeof cached?.draftId === 'string' && UUID.test(cached.draftId);
      if (cached?.version !== 1 || typeof cached.accountId !== 'string' || !(draft ? key === base + ':draft:' + cached.draftId : cached.draftId === undefined && key === base)
        || draft && (typeof cached.createdAt !== 'string' || !Number.isFinite(Date.parse(cached.createdAt)))
        || typeof cached.pending !== 'boolean' || cached.baseRevision !== null && !validRevision(cached.baseRevision)) throw failure('INVALID_LOCAL_CACHE');
      const state = clone(cached.state);
      return { accountId, pending: cached.pending, corrupt: false, cached: { ...cached, state } };
    } catch { return { accountId, pending: false, corrupt: true }; }
  }
  function localEntries() {
    const keys = new Set(knownKeys);
    if (typeof storage?.key !== 'function' || !Number.isSafeInteger(storage.length) || storage.length < 0) throw failure('LOCAL_STORAGE_UNAVAILABLE');
    for (let i = 0; i < storage.length; i++) { const key = storage.key(i); if (typeof key === 'string' && key.startsWith(PREFIX)) keys.add(key); }
    if (!storage?.getItem) throw failure('LOCAL_STORAGE_UNAVAILABLE');
    return [...keys].sort().flatMap(key => { const raw = storage.getItem(key); return raw === null || raw === undefined ? [] : [{ key, raw }]; });
  }
  function erase(key, expectedRaw) {
    if (!storage?.removeItem) throw failure('LOCAL_STORAGE_UNAVAILABLE');
    // Legacy keys were mutable. New draft keys are immutable, globally unique,
    // and are never written by another context or reused for a later change.
    if (expectedRaw !== undefined && storage.getItem(key) !== expectedRaw) return false;
    storage.removeItem(key); records.delete(key); knownKeys.delete(key);
    return true;
  }
  function localRecords() {
    try {
      const entries = localEntries(); records.clear(); localError = null;
      for (const { key, raw } of entries) {
        knownKeys.add(key); const record = cacheRecord(key, raw); records.set(key, { ...record, key, raw });
        // Migrate old completed caches without ever displaying them as account state.
        if (active&&record.accountId===active.accountId&&!record.pending&&!record.corrupt) try { erase(key, raw); } catch { localError = { code: 'LOCAL_STORAGE_UNAVAILABLE', message: messages.LOCAL_STORAGE_UNAVAILABLE }; }
      }
    } catch { localError = { code: 'LOCAL_STORAGE_UNAVAILABLE', message: messages.LOCAL_STORAGE_UNAVAILABLE }; }
    return localSummary();
  }
  function exportLocalRecords() {
    if(!active)throw failure('LOCAL_RECOVERY_AUTH_REQUIRED');
    try { return { format: 'synk-account-local-recovery', version: 1, scope, resource, accountId:active.accountId, entries: localEntries().filter(({key,raw})=>cacheRecord(key,raw).accountId===active.accountId) }; }
    catch { localError = { code: 'LOCAL_STORAGE_UNAVAILABLE', message: messages.LOCAL_STORAGE_UNAVAILABLE }; if (active) emit(active, 'storage-error',failure('LOCAL_STORAGE_UNAVAILABLE')); else emitClosed(); throw failure('LOCAL_STORAGE_UNAVAILABLE'); }
  }
  function emitClosed() {
    const local = localSummary(), error = localError || (local.corrupt ? { code: 'INVALID_LOCAL_CACHE', message: messages.INVALID_LOCAL_CACHE } : null);
    onStatus({ status: 'closed', revision: null, accountId: null, error, pending: false, pendingStored: true, localPersistenceError: !!localError, localRecords: local, localDrafts: [] });
  }
  function clearLocalRecords() {
    const context=active;
    if(!context){emitClosed();return false;}
    if(context.pending||context.busy||context.deleting){emit(context,'error',failure('LOCAL_CACHE_IN_USE'));return false;}
    try {
      for(const {key,raw} of localEntries())if(cacheRecord(key,raw).accountId===context.accountId)erase(key,raw);
      localRecords();localError=null;context.storageError=false;context.invalidCache=false;context.localChoice=false;
      emit(context,'synced');return true;
    } catch { context.storageError=true;localRecords(); localError = { code: 'LOCAL_STORAGE_UNAVAILABLE', message: messages.LOCAL_STORAGE_UNAVAILABLE }; emit(context,'storage-error',failure('LOCAL_STORAGE_UNAVAILABLE')); return false; }
  }
  localRecords();
  const isCurrent = context => active === context && context.generation === generation;
  const emitState = context => { if (isCurrent(context)) onState(clone(context.state)); };
  function draftGroups(context, all = false) {
    localRecords();
    const groups = new Map(), excluded = all ? new Set() : new Set([...context.owned.keys(), ...context.recovery.keys()]);
    for (const record of records.values()) {
      if (!record.pending || record.corrupt || record.cached.accountId !== context.accountId || excluded.has(record.key)) continue;
      const signature = JSON.stringify({ baseRevision: record.cached.baseRevision, state: record.cached.state });
      let group = groups.get(signature);
      if (!group) { group = { id: record.cached.draftId || 'legacy', createdAt: record.cached.createdAt || null, baseRevision: record.cached.baseRevision,
        state: record.cached.state, entries: new Map(), itemCount: Object.values(record.cached.state).reduce((n, value) => n + (Array.isArray(value) ? value.length : 0), 0) }; groups.set(signature, group); }
      group.entries.set(record.key, record.raw);
    }
    return [...groups.values()].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '') || a.id.localeCompare(b.id));
  }
  const publicDrafts = groups => groups.map(({ id, createdAt, baseRevision, itemCount, entries }) => ({ id, createdAt, baseRevision, itemCount, copies: entries.size }));
  const emit = (context, status, error = null) => {
    if (!isCurrent(context)) return;
    context.choices = draftGroups(context);
    if(context.localChoice&&!context.choices.length&&!localError)context.localChoice=false;
    context.invalidCache=[...records.values()].some(record=>record.corrupt&&record.accountId===context.accountId);
    const currentSignature = JSON.stringify(context.state);
    const pendingStored = !context.pending || !localError && [...records.values()].some(record => record.pending && !record.corrupt
      && record.cached.accountId === context.accountId && JSON.stringify(record.cached.state) === currentSignature);
    const warning = context.invalidCache ? { code: 'INVALID_LOCAL_CACHE', message: messages.INVALID_LOCAL_CACHE } : context.storageError || localError ? { code: 'LOCAL_STORAGE_UNAVAILABLE', message: messages.LOCAL_STORAGE_UNAVAILABLE } : null;
    const choiceError = context.localChoice ? { code: 'LOCAL_DRAFT_CONFLICT', message: messages.LOCAL_DRAFT_CONFLICT } : null;
    const notification={ status: choiceError ? 'local-conflict' : !error && warning ? warning.code === 'INVALID_LOCAL_CACHE' ? 'error' : 'storage-error' : status, revision: context.revision,
      accountId: context.accountId, pending: context.pending, pendingStored, localPersistenceError: !!(context.storageError || localError), localRecords: localSummary(), localDrafts: publicDrafts(context.choices), warning,
      error: error ? { code: error.code || 'CARE_SYNC_FAILED', message: documentSyncErrorMessage(error), ...(typeof error.assetId==='string'&&UUID.test(error.assetId)?{assetId:error.assetId}:{}) } : choiceError || warning };
    context.lastNotification=notification;onStatus(notification);
  };
  function removeEntries(context, entries) {
    let ok = true;
    for (const [key, raw] of entries) try { erase(key, raw); context.owned.delete(key); context.recovery.delete(key); }
    catch { context.storageError = true; ok = false; }
    return ok;
  }
  function detachDraft(context) {
    context.owned = new Map(); context.recovery = new Map(); context.currentDraft = null;
  }
  function persist(context) {
    if (!isCurrent(context)) return false;
    try {
      if (context.pending) {
        if (!storage?.setItem) throw failure('LOCAL_STORAGE_UNAVAILABLE');
        const signature = JSON.stringify({ baseRevision: context.baseRevision, state: context.state });
        if (context.currentDraft?.signature === signature && storage.getItem(context.currentDraft.key) === context.currentDraft.raw) {
          if (!removeEntries(context, new Map([...context.owned].filter(([key]) => key !== context.currentDraft.key)))) return false;
          context.storageError = false; return true;
        }
        const draftId = globalThis.crypto.randomUUID(), key = context.key + ':draft:' + draftId;
        const raw = JSON.stringify({ version: 1, accountId: context.accountId, draftId, createdAt: new Date().toISOString(),
          baseRevision: context.baseRevision, state: context.state, pending: true });
        storage.setItem(key, raw); // Do not delete the previous recovery copy until this succeeds.
        const previous = new Map(context.owned);
        context.owned.set(key, raw); context.currentDraft = { key, raw, signature };
        knownKeys.add(key); records.set(key, { ...cacheRecord(key, raw), key, raw });
        if (!removeEntries(context, previous)) return false;
      } else if (!removeEntries(context, new Map([...context.recovery, ...context.owned]))) return false;
      if (context.storageError && localError?.code === 'LOCAL_STORAGE_UNAVAILABLE') localError = null;
      context.storageError = false;
      return true;
    } catch { context.storageError = true; return false; }
  }
  function stopTimer(context) { if (context?.timer) clearTimeout(context.timer); if (context) context.timer = null; }
  function schedule(context) {
    stopTimer(context);
    if (!isCurrent(context) || context.conflict || context.localChoice || context.deleting) return;
    context.timer = setTimeout(() => { context.timer = null; void flush(); }, 400);
    context.timer.unref?.();
  }
  function reportFailure(context, error) {
    if (!isCurrent(context)) return false;
    if (['REVISION_CONFLICT', 'LOCAL_CHANGED_DURING_REFRESH'].includes(error?.code)) {
      context.conflict = true;
      if (validRevision(error.revision)) context.revision = error.revision;
      persist(context); emit(context, 'conflict', error);
    } else {
      const hard = ['AUTH_REQUIRED', 'SESSION_REVOKED', 'ACCOUNT_UNAVAILABLE', 'PRODUCT_FORBIDDEN', 'CARE_ACCOUNT_MISMATCH', 'INVALID_CARE_RESPONSE', 'INVALID_CARE_STATE', 'CARE_CLIENT_UPDATE_REQUIRED', 'PAYLOAD_TOO_LARGE', 'INVALID_PERSONAL_STATE', 'PERSONAL_DATA_TOO_LARGE', 'REVISION_CAPACITY', 'ASSET_NOT_FOUND', 'ASSET_NOT_CONFIRMED', 'MEDIA_QUOTA_EXCEEDED'].includes(error?.code);
      emit(context, hard ? 'error' : 'offline', error);
    }
    return false;
  }
  function enqueue(context, operation) {
    if (!context || !isCurrent(context)) return Promise.resolve(false);
    context.busy++;
    const result = context.chain.catch(() => {}).then(async () => {
      try { return isCurrent(context) ? await operation() : false; }
      catch (error) { return reportFailure(context, error); }
      finally { context.busy--; }
    });
    context.chain = result;
    return result;
  }
  async function request(context, action, body) {
    const reply = await transport(action, body);
    if (!isCurrent(context)) throw failure('CARE_SESSION_ENDED');
    if (reply?.ok === false) throw Object.assign(failure(reply.error?.code || reply.code || 'CARE_SYNC_FAILED', reply.revision), typeof reply.error?.assetId==='string'&&UUID.test(reply.error.assetId)?{assetId:reply.error.assetId}:{});
    if (!reply || reply.ok !== true || reply.scope !== scope || resource && reply.resource !== resource || !validRevision(reply.revision)
      || !Object.hasOwn(reply, 'state')) throw failure('INVALID_CARE_RESPONSE');
    if (reply.accountId !== context.accountId) throw failure('CARE_ACCOUNT_MISMATCH');
    let state;
    try { state = reply.state === null ? emptyState() : clone(reply.state); }
    catch { throw failure('INVALID_CARE_RESPONSE'); }
    return { ...reply, state, empty: reply.state === null };
  }
  async function load(context, mode = 'refresh') {
    const before = context.sequence;
    emit(context, 'loading');
    const remote = await request(context, operations.load);
    if (mode === 'remote' && before !== context.sequence) {
      context.conflict = true; persist(context); emit(context, 'conflict', failure('LOCAL_CHANGED_DURING_REFRESH')); return false;
    }
    // A server read must not replace the only copy of an unsaved edit. Keep
    // that edit intact unless its immutable recovery copy is safely retained.
    if (mode === 'remote' && context.pending && !persist(context)) {
      emit(context, 'storage-error', failure('LOCAL_STORAGE_UNAVAILABLE')); return false;
    }
    context.known = true; context.revision = remote.revision;
    if (context.localChoice && mode !== 'remote') {
      context.state = remote.state; context.baseRevision = remote.revision;
      emitState(context); emit(context, 'local-conflict'); return false;
    }
    if (mode === 'local') {
      // Only this explicitly requested path may move an edited outbox onto a newer remote revision.
      context.baseRevision = remote.revision; context.pending = true; context.conflict = false;
      persist(context); return true;
    }
    if (mode !== 'remote' && context.pending) {
      if (context.baseRevision === null && remote.empty && remote.revision === 0) context.baseRevision = 0;
      const conflictCode = context.baseRevision !== remote.revision ? 'REVISION_CONFLICT' : requiresConflictReview(context.state, remote.state) ? 'CARE_LIBRARY_RECOVERY_REVIEW' : null;
      if (conflictCode) {
        context.conflict = true; persist(context); emit(context, 'conflict', failure(conflictCode, remote.revision)); return false;
      }
      context.conflict = false; persist(context); emit(context, 'idle'); return true;
    }
    const changed = JSON.stringify(context.state) !== JSON.stringify(remote.state);
    if (mode === 'remote') { detachDraft(context); context.localChoice = false; }
    context.state = remote.state; context.baseRevision = remote.revision; context.pending = false; context.conflict = false;
    persist(context); if (changed || mode === 'remote') emitState(context); emit(context, 'synced'); return true;
  }
  async function drain(context) {
    if(context.localChoice){emit(context,'local-conflict');if(!context.localChoice)return load(context);}
    if (context.localChoice) { emit(context, 'local-conflict'); return false; }
    if (!context.known && !await load(context)) return false;
    if (!isCurrent(context) || context.conflict || context.deleting) return false;
    while (context.pending && isCurrent(context) && !context.conflict && !context.deleting) {
      const sequence = context.sequence, sent = clone(context.state), expected = context.baseRevision;
      const acknowledged = new Map([...context.recovery, ...context.owned]);
      emit(context, 'saving');
      const remote = await request(context, operations.save, { expected_revision: expected, state: sent });
      if (remote.revision !== expected + 1 || remote.empty) throw failure('INVALID_CARE_RESPONSE');
      // This callback only receives a validated ACK in the current account generation.
      onSaved(clone(remote.state));
      context.revision = remote.revision; context.baseRevision = remote.revision;
      // A save acknowledgement must not reset the user's current person, form or message editor.
      if (context.sequence === sequence) { context.state = remote.state; context.pending = false; }
      removeEntries(context, acknowledged);
      if (!context.pending) context.currentDraft = null;
      persist(context); emit(context, context.pending ? 'idle' : 'synced');
    }
    return !context.pending;
  }
  function close() {
    if(active?.storageListener)globalThis.removeEventListener?.('storage',active.storageListener);
    stopTimer(active);
    if (active && !active.pending) persist(active);
    const cleanupError = active?.storageError;
    generation += 1; active = null;
    localRecords();
    if (cleanupError) localError = { code: 'LOCAL_STORAGE_UNAVAILABLE', message: messages.LOCAL_STORAGE_UNAVAILABLE };
    onState(emptyState());
    emitClosed();
  }
  async function open(accountId) {
    if (typeof accountId !== 'string' || !accountId || accountId.length > 120 || /[\x00-\x20]/.test(accountId)) throw failure('INVALID_ACCOUNT_ID');
    close();
    const context = { accountId, key: PREFIX + encodeURIComponent(accountId), generation, chain: Promise.resolve(),
      state: emptyState(), revision: null, baseRevision: null, pending: false, known: false,
      conflict: false, deleting: false, sequence: 0, storageError: false, invalidCache: false, timer: null,busy:0 };
    Object.assign(context, { owned: new Map(), recovery: new Map(), currentDraft: null, choices: [], localChoice: false });
    active = context;
    knownKeys.add(context.key);
    try {
      const choices = draftGroups(context, true);
      context.invalidCache = [...records.values()].some(record => record.corrupt && record.accountId===accountId);
      // Optional recovery stays discoverable without locking the verified
      // server document. It is never adopted or sent without explicit selection.
      if(choices.length&&!preferRemoteOnOpen)context.localChoice=true;
    } catch { context.storageError = true; emit(context, 'storage-error'); }
    emitState(context);
    context.storageListener=event=>{
      // Consumers wrap localStorage, so StorageEvent.storageArea identity cannot
      // be compared with the injected adapter. The exact account key is the boundary.
      if(!isCurrent(context)||event.key!==null&&!(event.key===context.key||event.key?.startsWith(context.key+':draft:')))return;
      const choosing=context.localChoice,previous=context.lastNotification;
      emit(context,choosing?'synced':previous?.status||(context.pending?'idle':'synced'),choosing?null:previous?.error);
      if(choosing&&!context.localChoice&&!context.pending)void refresh();
    };
    globalThis.addEventListener?.('storage',context.storageListener);
    return enqueue(context, async () => { const loaded = await load(context); if (loaded && context.pending) schedule(context); return loaded; });
  }
  function change(state) {
    const context = active;
    if (!context) throw failure('CARE_ACCOUNT_REQUIRED');
    if (context.deleting) throw failure('CARE_DELETE_IN_PROGRESS');
    if(context.localChoice){emit(context,'local-conflict');if(context.localChoice)throw failure('LOCAL_DRAFT_CONFLICT');}
    const normalized = clone(state);
    if (JSON.stringify(normalized) === JSON.stringify(context.state)) return false;
    context.state = normalized; context.pending = true; context.sequence += 1;
    persist(context); emit(context, context.conflict ? 'conflict' : 'idle'); schedule(context);
    return true;
  }
  function flush() {
    const context = active; stopTimer(context);
    return enqueue(context, () => drain(context));
  }
  function refresh() {
    const context = active; stopTimer(context);
    return enqueue(context, async () => { const loaded = await load(context); if (loaded && context.pending) schedule(context); return loaded; });
  }
  function resolveRemote() {
    const context = active; stopTimer(context);
    return enqueue(context, () => {
      if (context.pending && !persist(context)) {
        emit(context, 'storage-error', failure('LOCAL_STORAGE_UNAVAILABLE')); return false;
      }
      return load(context, 'remote');
    });
  }
  function resolveLocal() {
    const context = active; stopTimer(context);
    return enqueue(context, async () => { if (!await load(context, 'local')) return false; return drain(context); });
  }
  function selectLocalDraft(id) {
    const context = active; stopTimer(context);
    return enqueue(context, async () => {
      if (context.pending && !persist(context)) { emit(context, 'storage-error'); return false; }
      const selected = draftGroups(context).find(group => group.id === id);
      if (!selected) { emit(context,'synced'); if(!context.localChoice&&!context.pending)await load(context); return false; }
      detachDraft(context);
      context.recovery = new Map(selected.entries); context.state = clone(selected.state);
      // A different local snapshot must pass a fresh remote check before any
      // drain, including a retry after this selection's load failed offline.
      context.baseRevision = selected.baseRevision; context.pending = true; context.known = false; context.conflict = false; context.localChoice = false; context.sequence++;
      emitState(context);
      try { const loaded = await load(context); if (loaded && context.pending) schedule(context); }
      catch (error) { reportFailure(context, error); }
      return true; // Selection succeeded; CAS/connectivity remain separate status.
    });
  }
  function remove() {
    const context = active; stopTimer(context);
    if (!context) return Promise.resolve(false);
    context.deleting = true;
    return enqueue(context, async () => {
      try {
        if (!context.known && !await load(context)) return false;
        if (context.conflict) { emit(context, 'conflict', failure('REVISION_CONFLICT', context.revision)); return false; }
        emit(context, 'saving');
        const expected = context.baseRevision;
        const remote = await request(context, operations.delete, { expected_revision: expected });
        if (remote.revision !== expected + 1 || !remote.empty) throw failure('INVALID_CARE_RESPONSE');
        onRemoved();
        context.state = emptyState(); context.revision = remote.revision; context.baseRevision = remote.revision;
        context.pending = false; context.conflict = false; context.localChoice = false; context.sequence += 1;
        removeEntries(context, new Map([...context.recovery, ...context.owned])); context.currentDraft = null;
        persist(context); emitState(context); emit(context, 'synced'); return true;
      } finally { context.deleting = false; }
    });
  }
  return { open, change, flush, refresh, resolveRemote, resolveLocal, selectLocalDraft, remove, close, localRecords, exportLocalRecords, clearLocalRecords };
}
