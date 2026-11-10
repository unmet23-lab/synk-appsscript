import { createProductAccount } from '../synk-account/src/product-account.mjs';
import { createDocumentSync } from '../synk-account/src/document-sync.mjs';
import { createPathDocument, validatePathDocument, validateSavedJob, jobSourceId, removeSavedJob } from './document.mjs';
import { normalizeState, SESSION_KEY as LEGACY_STATE_SESSION_KEY } from './state.mjs';

/**
 * PATH account/session controller. Owner: Claude (frontend). No DOM, no UI HTML.
 *
 * Exported API (exact):
 *   createPathSession(options?) -> frozen controller
 *     options: {
 *       storage = globalThis.sessionStorage,   // guest document + document-sync outbox (never localStorage)
 *       fetcher = globalThis.fetch,
 *       onDocument(doc)  // whole current document clone; never called before init()
 *       onStatus(status) // safe snapshot (no tokens); never called before init()
 *       configUrl = './config.json',
 *       lang,            // initial language for createPathDocument (defaults from navigator)
 *       now = () => new Date(),
 *       accountFactory(opts) -> createProductAccount-compatible (test injection)
 *       syncFactory(opts)    -> createDocumentSync-compatible (test injection)
 *       accountOptions       // extra options forwarded to account factory (test injection)
 *     }
 *   controller:
 *     document()        -> clone of current visible document (guest or loaded account), or null while account loading
 *     status()          -> { signedIn, configured, accountId, accountStatus, loaded, canEdit, syncStatus,
 *                            pending, error, guestAvailable, canImportGuest, localDrafts, mode, guestBlocked,
 *                            canConfirmBackup, backupConfirmed }
 *     init()            -> Promise<status>; starts emitting callbacks
 *     signIn()          -> Promise<boolean>; persists guest first, refuses if guest storage fails
 *     signOut()         -> Promise<boolean>; closes account view, restores original guest
 *     updateState(next) -> boolean (true changed, false unchanged); throws coded Error on invalid/blocked
 *     saveJob(job)      -> boolean; job is a flat feed job or a saved-job-shaped record
 *     removeJob(id)     -> boolean; throws code JOB_IN_USE when a task references it
 *     importGuest()     -> Promise<boolean>; only after actual remote GET returned empty state
 *     exportGuest()     -> { kind:'guest', raw:string|null, document:object|null, valid:boolean }
 *     exportCurrent()   -> { kind, document, syncStatus, pending, accountId, backupToken } (not a claim of remote state;
 *                          only issues a snapshot, never acknowledges that it was stored/downloaded)
 *     confirmBackup(exportedSnapshot) -> boolean; explicit user acknowledgement that the issued snapshot was kept.
 *                          Accepts only the current issued snapshot (or a structured clone with the same token and
 *                          equal content) for the same account, openEpoch and document generation. Any document
 *                          mutation (even an undo), account switch/hide/reopen invalidates. Only a valid
 *                          acknowledgement lets signOut drop an unpersisted account draft.
 *     exportRemote()    -> Promise<{ kind:'remote', accountId, revision, updatedAt, state }>
 *     exportRecovery()  -> array of local recovery records from document-sync (explicit recovery action)
 *     retry()           -> Promise<boolean>; retries guest persist or account flush/refresh
 *     useRemote()       -> Promise<boolean>; document-sync.resolveRemote (local records preserved)
 *     chooseRecovery(id)-> Promise<boolean>; document-sync.selectLocalDraft
 *     clearGuest()      -> boolean; explicit clear: persists a verified empty document under the new key as a tombstone (legacy raw untouched, never revived)
 *     dispose()
 *   No resolveLocal / forced overwrite / account deletion is exposed.
 */

export const GUEST_KEY = 'synk-path-guest-document-v1';
export const LEGACY_KEY = LEGACY_STATE_SESSION_KEY || 'synk-path-app-session-v1';
export const ACCOUNT_CACHE_PREFIX = 'synk-path-app-account:';
export const MAX_SAVED_JOBS = 100;
const OPERATIONS = Object.freeze({ load: 'pathLoad', save: 'pathSave', delete: 'pathDelete' });

const fault = (code, message, extra = {}) => Object.assign(new Error(message), { code, ...extra });
const clone = value => (value === null || value === undefined ? null : JSON.parse(JSON.stringify(value)));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const publicError = error => (error ? {
  code: typeof error.code === 'string' ? error.code : 'PATH_SESSION_ERROR',
  message: typeof error.message === 'string' ? error.message : '',
  retryable: error.retryable === true,
} : null);

function browserLang() {
  try {
    const l = String(globalThis.navigator?.language || '').toLowerCase();
    return l.startsWith('ko') ? 'ko' : l ? 'en' : 'ko';
  } catch { return 'ko'; }
}

function validateDoc(raw) {
  const doc = validatePathDocument(raw);
  return clone(doc);
}

function tryValidate(raw) {
  try { return validateDoc(raw); } catch { return null; }
}

function emptyDocFor(lang) { return validateDoc(createPathDocument(lang)); }

export function createPathSession(options = {}) {
  const {
    storage = globalThis.sessionStorage,
    fetcher = globalThis.fetch,
    onDocument = () => {},
    onStatus = () => {},
    configUrl = './config.json',
    now = () => new Date(),
    accountFactory = createProductAccount,
    syncFactory = createDocumentSync,
    accountOptions = {},
  } = options;
  const lang = options.lang === 'en' || options.lang === 'ko' ? options.lang : browserLang();

  // ---------- guest (synchronous, safe) ----------
  const guest = {
    doc: null,          // validated in-memory guest document (may be unsaved draft)
    raw: null,          // raw bytes observed in storage (preserved for export)
    blocked: false,     // invalid/future stored data: never overwrite
    writeFailed: false, // last persist failed: block further writes until retry succeeds
    needsPersist: false,
    error: null,
  };

  function readStorage(key) {
    try { return { ok: true, value: storage ? storage.getItem(key) : null }; }
    catch (error) { return { ok: false, error }; }
  }

  function writeGuest(doc) {
    if (guest.blocked) return false;
    try {
      if (!storage) throw fault('LOCAL_STORAGE_UNAVAILABLE', 'storage unavailable');
      const raw = JSON.stringify(doc);
      storage.setItem(GUEST_KEY, raw);
      if (storage.getItem(GUEST_KEY) !== raw) throw fault('LOCAL_STORAGE_UNAVAILABLE', 'storage verify failed');
      guest.raw = raw; guest.writeFailed = false; guest.needsPersist = false; guest.error = null;
      return true;
    } catch (error) {
      guest.writeFailed = true; guest.needsPersist = true;
      guest.error = { code: 'LOCAL_STORAGE_UNAVAILABLE', message: '이 기기에 저장하지 못했어요.', retryable: true };
      void error;
      return false;
    }
  }

  (function loadGuest() {
    const current = readStorage(GUEST_KEY);
    if (!current.ok) {
      guest.doc = emptyDocFor(lang); guest.writeFailed = true; guest.needsPersist = true;
      guest.error = { code: 'LOCAL_STORAGE_UNAVAILABLE', message: '이 기기의 저장소를 읽지 못했어요.', retryable: true };
      return;
    }
    if (current.value !== null) {
      guest.raw = current.value;
      let parsed;
      try { parsed = JSON.parse(current.value); } catch { parsed = undefined; }
      const doc = parsed === undefined ? null : tryValidate(parsed);
      if (doc) { guest.doc = doc; return; }
      guest.blocked = true;
      guest.doc = emptyDocFor(lang);
      guest.error = { code: parsed && parsed.version > 1 ? 'PATH_DOCUMENT_FUTURE_VERSION' : 'INVALID_PATH_DOCUMENT',
        message: '저장된 PATH 데이터를 읽을 수 없어 덮어쓰지 않았어요. 내보내기로 원본을 보관할 수 있어요.', retryable: false };
      return;
    }
    const legacy = readStorage(LEGACY_KEY);
    if (!legacy.ok) {
      guest.doc = emptyDocFor(lang); guest.blocked = true;
      guest.error = { code: 'LOCAL_STORAGE_UNAVAILABLE', message: '이전 데이터를 확인하지 못해 저장을 멈췄어요.', retryable: true };
      return;
    }
    if (legacy.value === null) { guest.doc = emptyDocFor(lang); return; }
    guest.raw = legacy.value;
    let state = null;
    try { state = normalizeState(JSON.parse(legacy.value)); } catch { state = null; }
    const migrated = state ? tryValidate({ ...createPathDocument(state.lang || lang), state }) : null;
    if (!migrated) {
      guest.blocked = true; guest.doc = emptyDocFor(lang);
      guest.error = { code: 'INVALID_PATH_DOCUMENT', message: '이전 PATH 데이터를 읽을 수 없어 덮어쓰지 않았어요. 내보내기로 원본을 보관할 수 있어요.', retryable: false };
      return;
    }
    guest.doc = migrated;
    // Legacy raw is never removed; new key written once, failure keeps memory draft.
    if (!writeGuest(migrated)) guest.raw = legacy.value;
  })();

  // ---------- account ----------
  let initialized = false, disposed = false;
  let account = null, sync = null, accountReady = null;
  let accountSnapshot = { configured: false, signedIn: false, accountId: null, status: 'unconfigured', error: null };
  let mode = 'guest';             // 'guest' | 'account'
  let openEpoch = 0;
  let openedAccountId = null;
  let accountDoc = null;          // only set after document-sync delivered a loaded state
  let accountLoaded = false;
  let remoteKnownEmpty = false;   // true only after a real transport GET returned null state
  let observedRevision = null;
  let syncStatus = { status: 'idle', revision: null, pending: false, pendingStored: true, localDrafts: [], error: null };
  let sessionError = null;
  let importing = false;
  let docGeneration = 0;          // monotonically increases on every account document mutation
  let issuedBackup = null;        // { token, accountId, epoch, generation, doc } issued by exportCurrent
  let backupAck = null;           // { token, accountId, epoch, generation } set only by confirmBackup
  let tokenSeq = 0;

  function bumpDoc() { docGeneration++; issuedBackup = null; backupAck = null; }
  function newToken() {
    tokenSeq++;
    try { if (globalThis.crypto?.randomUUID) return `pb-${globalThis.crypto.randomUUID()}-${tokenSeq}`; } catch {}
    return `pb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${tokenSeq}`;
  }
  function bindingCurrent(rec) {
    return !!rec && mode === 'account' && accountLoaded && !!accountDoc && rec.epoch === openEpoch
      && rec.generation === docGeneration && rec.accountId === openedAccountId
      && rec.accountId === (accountSnapshot.signedIn ? accountSnapshot.accountId : null);
  }
  function backupAcknowledged() {
    return bindingCurrent(backupAck) && bindingCurrent(issuedBackup) && backupAck.token === issuedBackup.token
      && same(issuedBackup.doc, accountDoc);
  }

  function snapshot() {
    const signedIn = accountSnapshot.signedIn === true;
    const canEdit = mode === 'guest'
      ? !guest.blocked && !guest.writeFailed
      : accountLoaded && !importing && !['local-conflict', 'conflict', 'storage-error'].includes(syncStatus.status);
    const guestHasContent = !!guest.doc && !same(guest.doc, emptyDocFor(guest.doc.state?.lang || lang));
    return Object.freeze({
      mode,
      signedIn,
      configured: accountSnapshot.configured === true,
      accountId: signedIn ? accountSnapshot.accountId || null : null,
      accountStatus: accountSnapshot.status || 'unconfigured',
      loaded: mode === 'guest' ? true : accountLoaded,
      canEdit,
      syncStatus: mode === 'guest' ? (guest.writeFailed ? 'storage-error' : guest.blocked ? 'blocked' : 'local') : syncStatus.status,
      pending: mode === 'guest' ? guest.needsPersist : syncStatus.pending === true,
      error: publicError(sessionError || (mode === 'guest' ? guest.error : syncStatus.error) || accountSnapshot.error),
      guestAvailable: guestHasContent || (guest.blocked && guest.raw !== null),
      accountEmpty: mode === 'account' && accountLoaded && remoteKnownEmpty,
      guestBlocked: guest.blocked,
      canImportGuest: mode === 'account' && accountLoaded && remoteKnownEmpty && !syncStatus.pending
        && !!guest.doc && !guest.blocked && guestHasContent && !importing,
      localDrafts: Array.isArray(syncStatus.localDrafts) ? clone(syncStatus.localDrafts) : [],
      canConfirmBackup: bindingCurrent(issuedBackup) && !backupAcknowledged(),
      backupConfirmed: backupAcknowledged(),
    });
  }

  function currentDoc() { return mode === 'guest' ? guest.doc : accountLoaded ? accountDoc : null; }

  function emitStatus() { if (initialized && !disposed) { try { onStatus(snapshot()); } catch {} } }
  function emitDocument() { if (initialized && !disposed) { try { onDocument(clone(currentDoc())); } catch {} } }
  function emitAll() { emitDocument(); emitStatus(); }

  function hideAccount() {
    openEpoch++;
    accountDoc = null; accountLoaded = false; remoteKnownEmpty = false; observedRevision = null; openedAccountId = null;
    bumpDoc();
    syncStatus = { status: 'idle', revision: null, pending: false, pendingStored: true, localDrafts: [], error: null };
  }

  function ensureSync() {
    if (sync) return sync;
    sync = syncFactory({
      transport: async (operation, values) => {
        const epoch = openEpoch;
        const reply = await account.request(operation, values || {});
        if (epoch === openEpoch && operation === OPERATIONS.load && reply && reply.ok === true) {
          observedRevision = Number.isSafeInteger(reply.revision) ? reply.revision : null;
          remoteKnownEmpty = reply.state === null || reply.state === undefined;
        } else if (epoch === openEpoch && operation === OPERATIONS.save && reply && reply.ok === true) {
          remoteKnownEmpty = false;
          observedRevision = Number.isSafeInteger(reply.revision) ? reply.revision : observedRevision;
        }
        return reply;
      },
      storage,
      onState: state => {
        if (mode !== 'account' || disposed) return;
        const doc = state == null ? null : tryValidate(state);
        if (!doc) return;
        if (!accountDoc || !same(doc, accountDoc)) bumpDoc();
        accountDoc = doc;
        emitDocument();
      },
      onStatus: status => {
        if (disposed || !status) return;
        if (mode !== 'account' || (openedAccountId && status.accountId && status.accountId !== openedAccountId)) return;
        syncStatus = {
          status: typeof status.status === 'string' ? status.status : 'idle',
          revision: Number.isSafeInteger(status.revision) ? status.revision : null,
          pending: status.pending === true,
          pendingStored: status.pendingStored !== false,
          localDrafts: Array.isArray(status.localDrafts) ? status.localDrafts : [],
          error: status.error ? publicError(status.error) : null,
        };
        emitStatus();
      },
      onSaved: () => {},
      onRemoved: () => {},
      validateState: raw => validateDoc(raw),
      emptyState: () => createPathDocument(guest.doc?.state?.lang || lang),
      scope: 'synk-path',
      resource: 'path-app',
      cachePrefix: ACCOUNT_CACHE_PREFIX,
      operations: OPERATIONS,
    });
    return sync;
  }

  async function openAccount(accountId) {
    const epoch = ++openEpoch;
    openedAccountId = accountId;
    accountLoaded = false; accountDoc = null; remoteKnownEmpty = false; observedRevision = null;
    bumpDoc();
    sessionError = null;
    emitAll();
    try {
      const loaded = await ensureSync().open(accountId);
      if (epoch !== openEpoch || disposed) return false;
      if (loaded) {
        if (!accountDoc) bumpDoc();
        if (!accountDoc) accountDoc = emptyDocFor(guest.doc?.state?.lang || lang);
        accountLoaded = true; sessionError = null;
      } else if (syncStatus.error || syncStatus.status === 'local-conflict') {
        sessionError = null; // keep the actual document-sync error/conflict visible
      } else {
        sessionError = { code: 'ACCOUNT_LOAD_FAILED', message: '계정 데이터를 불러오지 못해 편집을 잠시 막았어요.', retryable: true };
      }
    } catch (error) {
      if (epoch !== openEpoch) return false;
      sessionError = publicError(error) || { code: 'ACCOUNT_LOAD_FAILED', retryable: true };
    }
    emitAll();
    return accountLoaded;
  }

  function handleAccountStatus(next) {
    if (disposed || !next) return;
    const prevId = accountSnapshot.signedIn ? accountSnapshot.accountId : null;
    accountSnapshot = {
      configured: next.configured === true,
      signedIn: next.signedIn === true,
      accountId: next.signedIn === true && typeof next.accountId === 'string' ? next.accountId : null,
      status: typeof next.status === 'string' ? next.status : (next.signedIn ? 'signed-in' : 'signed-out'),
      error: next.error ? publicError(next.error) : null,
    };
    const nextId = accountSnapshot.accountId;
    if (nextId === prevId && (mode === 'account') === !!nextId) { emitStatus(); return; }
    // Identity change: synchronously hide previous account and block editing.
    try { sync?.close(); } catch {}
    hideAccount();
    sessionError = null;
    if (nextId) {
      mode = 'account';
      emitAll();
      void openAccount(nextId);
    } else {
      mode = 'guest';
      emitAll();
    }
  }

  function startAccount() {
    if (accountReady) return accountReady;
    accountReady = (async () => {
      if (disposed) return null;
      account = accountFactory({
        clientKey: 'path-app', endpoint: 'synk-path', scope: 'synk-path', resource: 'path-app',
        operations: OPERATIONS,
        validateState: raw => (raw == null ? null : validateDoc(raw)),
        onStatus: handleAccountStatus,
        fetcher, storage, configUrl,
        ...accountOptions,
      });
      const status = await account.start();
      handleAccountStatus(status || account.status());
      return account;
    })().catch(error => {
      accountSnapshot = { ...accountSnapshot, error: publicError(error) };
      accountReady = null;
      emitStatus();
      return null;
    });
    return accountReady;
  }

  // ---------- public API ----------
  async function init() {
    if (disposed) throw fault('PATH_SESSION_DISPOSED', 'disposed');
    if (!initialized) { initialized = true; emitAll(); }
    await startAccount();
    return snapshot();
  }

  async function signIn() {
    if (disposed) return false;
    if (mode === 'guest' && guest.needsPersist && !guest.blocked) {
      if (!writeGuest(guest.doc)) {
        sessionError = { code: 'GUEST_SAVE_REQUIRED', message: '이 기기에 먼저 저장하지 못해 로그인을 멈췄어요. 내보내기 후 다시 시도해 주세요.', retryable: true };
        emitStatus();
        return false;
      }
    }
    const acc = await startAccount();
    if (!acc) return false;
    await acc.signIn();
    return true;
  }

  async function signOut() {
    if (!account) return false;
    if (mode === 'account' && syncStatus.pending && !syncStatus.pendingStored
      && !backupAcknowledged()) {
      sessionError = { code: 'UNSAVED_ACCOUNT_DRAFT', message: '저장되지 않은 변경이 있어 로그아웃을 멈췄어요. 내보내기 또는 다시 시도 후 로그아웃해 주세요.', retryable: true };
      emitStatus();
      return false;
    }
    try { sync?.close(); } catch {}
    hideAccount();
    mode = 'guest';
    emitAll();
    await account.signOut();
    // Restore original guest from storage (shared-tab snapshot), never from account data.
    const stored = readStorage(GUEST_KEY);
    if (stored.ok && stored.value !== null && !guest.needsPersist) {
      let parsed; try { parsed = JSON.parse(stored.value); } catch { parsed = undefined; }
      const doc = parsed === undefined ? null : tryValidate(parsed);
      if (doc) { guest.doc = doc; guest.raw = stored.value; }
    }
    emitAll();
    return true;
  }

  function requireEditable() {
    if (disposed) throw fault('PATH_SESSION_DISPOSED', 'disposed');
    if (mode === 'guest') {
      if (guest.blocked) throw fault('GUEST_WRITE_BLOCKED', '저장된 데이터를 보호하기 위해 변경을 막았어요.');
      if (guest.writeFailed) throw fault('LOCAL_STORAGE_UNAVAILABLE', '이 기기에 저장하지 못했어요. 다시 시도해 주세요.');
      return;
    }
    if (!accountLoaded) throw fault('ACCOUNT_NOT_LOADED', '계정 데이터를 불러온 뒤 편집할 수 있어요.');
    if (importing) throw fault('ACCOUNT_BUSY', '가져오는 중이에요.');
  }

  function commit(nextDoc) {
    const doc = validateDoc(nextDoc);
    if (same(doc, currentDoc())) return false;
    if (mode === 'guest') {
      guest.doc = doc;
      writeGuest(doc); // failure keeps memory draft, surfaced via status; never reported as success
      emitAll();
      if (guest.writeFailed) throw fault('LOCAL_STORAGE_UNAVAILABLE', '변경은 화면에만 남아 있고 이 기기에 저장되지 않았어요.', { retryable: true });
      return true;
    }
    const changed = sync.change(doc);
    if (changed) { bumpDoc(); accountDoc = doc; emitDocument(); }
    emitStatus();
    return changed;
  }

  function updateState(nextState) {
    requireEditable();
    const base = currentDoc();
    return commit({ ...base, state: nextState });
  }

  function canonicalSavedJob(job, at) {
    if (!job || typeof job !== 'object') throw fault('INVALID_SAVED_JOB', '공고 정보가 올바르지 않아요.');
    if (job.snapshot && job.id) return validateSavedJob(job);
    const board = job.board, jobId = String(job.jobId ?? job.id ?? '');
    return validateSavedJob({
      id: jobSourceId(board, jobId),
      provider: 'greenhouse',
      board,
      jobId,
      snapshot: {
        company: job.company, title: job.title, location: job.location,
        employmentType: job.employmentType ?? null, url: job.url, observedAt: job.observedAt,
      },
      savedAt: at,
    });
  }

  function saveJob(job) {
    requireEditable();
    const base = currentDoc();
    const saved = clone(canonicalSavedJob(job, now().toISOString()));
    const list = Array.isArray(base.savedJobs) ? base.savedJobs : [];
    if (list.some(entry => entry.id === saved.id)) return false;
    if (list.length >= MAX_SAVED_JOBS) throw fault('SAVED_JOB_LIMIT', `공고는 최대 ${MAX_SAVED_JOBS}개까지 저장할 수 있어요.`);
    return commit({ ...base, savedJobs: [...list, saved] });
  }

  function removeJob(id) {
    requireEditable();
    let next;
    try { next = removeSavedJob(clone(currentDoc()), id); }
    catch (error) {
      if (error?.code === 'JOB_IN_USE') throw fault('JOB_IN_USE', '이 공고로 준비 중인 항목이 있어 삭제할 수 없어요.');
      throw error;
    }
    return commit(next);
  }

  async function importGuest() {
    if (mode !== 'account' || !accountLoaded || importing) return false;
    if (!remoteKnownEmpty || syncStatus.pending || observedRevision === null) return false;
    if (!guest.doc || guest.blocked) return false;
    const epoch = openEpoch;
    importing = true; emitStatus();
    try {
      const doc = validateDoc(guest.doc);
      const changed = sync.change(doc);
      if (!changed || epoch !== openEpoch) return false;
      bumpDoc(); accountDoc = doc; emitDocument();
      const ok = await sync.flush();
      if (epoch !== openEpoch || mode !== 'account') return false;
      if (ok && !syncStatus.pending) { remoteKnownEmpty = false; emitDocument(); return true; }
      return false; // conflict/failure: guest untouched, local draft preserved by document-sync
    } catch (error) {
      if (epoch === openEpoch) sessionError = publicError(error);
      return false;
    } finally { importing = false; emitStatus(); }
  }

  function exportGuest() {
    return { kind: 'guest', raw: guest.raw, document: clone(guest.doc), valid: !guest.blocked };
  }

  function exportCurrent() {
    const s = snapshot();
    let backupToken = null;
    if (mode === 'account' && accountLoaded && accountDoc && openedAccountId && s.accountId === openedAccountId) {
      if (!bindingCurrent(issuedBackup) || !same(issuedBackup.doc, accountDoc)) {
        issuedBackup = { token: newToken(), accountId: openedAccountId, epoch: openEpoch, generation: docGeneration, doc: clone(accountDoc) };
        backupAck = null;
      }
      backupToken = issuedBackup.token;
    }
    const out = { kind: mode, accountId: s.accountId, document: clone(currentDoc()), syncStatus: s.syncStatus, pending: s.pending, backupToken };
    emitStatus();
    return out;
  }

  function confirmBackup(exportedSnapshot) {
    if (disposed || !exportedSnapshot || typeof exportedSnapshot !== 'object') return false;
    const rec = issuedBackup;
    if (!bindingCurrent(rec)) return false;
    if (typeof exportedSnapshot.backupToken !== 'string' || exportedSnapshot.backupToken !== rec.token) return false;
    if (exportedSnapshot.kind !== 'account' || exportedSnapshot.accountId !== rec.accountId) return false;
    if (!same(rec.doc, accountDoc) || !same(exportedSnapshot.document, accountDoc)) return false;
    backupAck = { token: rec.token, accountId: rec.accountId, epoch: rec.epoch, generation: rec.generation };
    emitStatus();
    return true;
  }

  async function exportRemote() {
    if (!account || mode !== 'account' || !openedAccountId) throw fault('AUTH_REQUIRED', '로그인이 필요해요.');
    const owner = openedAccountId;
    const reply = await account.request(OPERATIONS.load, {});
    if (!reply || reply.ok !== true || reply.accountId !== owner) throw fault('ACCOUNT_CHANGED', '계정이 바뀌어 내보내지 않았어요.');
    const state = reply.state == null ? null : validateDoc(reply.state);
    return { kind: 'remote', accountId: owner, revision: reply.revision, updatedAt: reply.updatedAt ?? null, state };
  }

  function exportRecovery() {
    if (!sync) return [];
    try { return clone(sync.exportLocalRecords()) || []; } catch (error) { throw fault('LOCAL_STORAGE_UNAVAILABLE', '복구 기록을 읽지 못했어요.', { cause: error }); }
  }

  async function retry() {
    sessionError = null;
    if (mode === 'guest') {
      if (guest.blocked) { emitStatus(); return false; }
      const ok = guest.needsPersist ? writeGuest(guest.doc) : true;
      emitAll();
      if (!account) await startAccount();
      return ok;
    }
    if (!accountLoaded) return openedAccountId ? openAccount(openedAccountId) : false;
    try { const ok = syncStatus.pending ? await sync.flush() : await sync.refresh(); emitStatus(); return !!ok; }
    catch (error) { sessionError = publicError(error); emitStatus(); return false; }
  }

  async function useRemote() {
    if (mode !== 'account' || !sync) return false;
    const epoch = openEpoch, owner = openedAccountId;
    try {
      const ok = await sync.resolveRemote();
      if (epoch !== openEpoch || mode !== 'account' || openedAccountId !== owner) return false;
      if (ok && accountDoc) { accountLoaded = true; sessionError = null; }
      emitAll(); return !!ok;
    } catch (error) { if (epoch === openEpoch) { sessionError = publicError(error); emitStatus(); } return false; }
  }

  async function chooseRecovery(id) {
    if (mode !== 'account' || !sync) return false;
    const epoch = openEpoch, owner = openedAccountId;
    try {
      const ok = await sync.selectLocalDraft(id);
      if (epoch !== openEpoch || mode !== 'account' || openedAccountId !== owner) return false;
      if (ok && accountDoc) { accountLoaded = true; sessionError = null; }
      emitAll(); return !!ok;
    } catch (error) { if (epoch === openEpoch) { sessionError = publicError(error); emitStatus(); } return false; }
  }

  function clearGuest() {
    const empty = emptyDocFor(lang);
    const raw = JSON.stringify(empty);
    try {
      if (!storage) throw fault('LOCAL_STORAGE_UNAVAILABLE', 'storage unavailable');
      storage.setItem(GUEST_KEY, raw);
      const back = storage.getItem(GUEST_KEY);
      if (back !== raw || !tryValidate(JSON.parse(back))) throw fault('LOCAL_STORAGE_UNAVAILABLE', 'storage verify failed');
    } catch { guest.error = { code: 'LOCAL_STORAGE_UNAVAILABLE', message: '지우지 못했어요.', retryable: true }; emitStatus(); return false; }
    // Verified empty doc under the new key is the tombstone; legacy raw stays untouched and is no longer migrated.
    guest.doc = empty; guest.raw = raw; guest.blocked = false; guest.writeFailed = false;
    guest.needsPersist = false; guest.error = null;
    if (sessionError && sessionError.code === 'GUEST_SAVE_REQUIRED') sessionError = null;
    emitAll();
    return true;
  }

  function dispose() {
    disposed = true;
    openEpoch++;
    try { sync?.close(); } catch {}
    try { account?.dispose(); } catch {}
  }

  return Object.freeze({
    document: () => clone(currentDoc()),
    status: snapshot,
    init, signIn, signOut, updateState, saveJob, removeJob, importGuest,
    exportGuest, exportCurrent, confirmBackup, exportRemote, exportRecovery,
    retry, useRemote, chooseRecovery, clearGuest, dispose,
  });
}