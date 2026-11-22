// PATH 계정의 유학 준비 문서(path-study) 컨트롤러. 창 · DOM이 없다. 준비 글 문서(account.mjs)와 같은 로그인으로 요청한다.
// 동의 전 · 거부 · 손님은 앱이 탭 저장을 쓴다. 이 컨트롤러는 동의한 학생의 문서만 계정과 맞춘다(3단계 설계 「계정의 유학 준비 문서」).
import { createDocumentSync } from '../synk-account/src/document-sync.mjs';
import { validateStudyDocument, emptyStudyDocument, createStudyDocument, CONSENT_VERSION, STUDY_RESOURCE } from './study-shape.mjs';

export const STUDY_OPERATIONS = Object.freeze({ load: 'pathLoad', save: 'pathSave', delete: 'pathDelete' });
export const STUDY_CACHE_PREFIX = 'synk-path-study-account:';
// 동의 전처럼 탭 저장으로 계속 써도 되는 실패(서버가 아직 · 꺼짐 · 끊김): 동의를 확인하지 못했을 뿐이다.
const PAUSE_CODES = new Set(['PATH_STUDY_UNAVAILABLE', 'INVALID_ACTION', 'INVALID_QUERY', 'NETWORK', 'ACCOUNT_UNAVAILABLE', 'OFFLINE']);

const clone = (v) => (v == null ? null : JSON.parse(JSON.stringify(v)));
const stamp = (d) => (d instanceof Date ? d : new Date(d)).toISOString();

/**
 * createStudyAccount({ request, storage, onChange, syncFactory, now })
 *   request(operation, values) — account.request(op, values, { resource: 'path-study' })를 묶은 것
 * 돌려주는 것:
 *   open(accountId) · close()
 *   snapshot() → { phase, profile, consent, pending, error, deletedElsewhere }
 *     phase: 'closed' | 'loading' | 'paused'(확인 못 함: 탭 저장으로 계속) | 'none'(동의 없음) | 'consented' | 'choose'(남은 초안 고르기) | 'error'
 *   write(nextProfile, op) — 동의한 문서의 조건을 바꾼다. op(profile) → profile은 판 충돌 때 계정 것 위에 다시 적용할 마지막 동작.
 *   give({ profile, minor, lang }) — 동의하고 처음 저장한다. 서버가 받은 뒤 true.
 *   remove() — 계정의 문서를 지운다(동의 거두기). 이 문서의 복구 기록도 지운다.
 *   pickDraft(id) · useAccount() — 남은 초안 고르기
 */
export function createStudyAccount({ request, storage = globalThis.sessionStorage, onChange = () => {}, syncFactory = createDocumentSync, now = () => new Date() } = {}) {
  if (typeof request !== 'function') throw new TypeError('PATH study request required');
  let sync = null, accountId = null, epoch = 0;
  let doc = null, phase = 'closed', status = { status: 'closed', pending: false, error: null, localDrafts: [] };
  let lastOp = null, deletedElsewhere = false, reapplying = false, preferLocal = false, cleanAfterSave = false, sendFailed = false;
  // 제어기가 스스로 푸는 오류(판 충돌 · 동의 어긋남)는 「보내지 못함」으로 치지 않는다.
  const SELF_HEALING = new Set(['REVISION_CONFLICT', 'PATH_STUDY_CONSENT_STALE']);

  const emit = () => { try { onChange(snapshot()); } catch {} };
  function snapshot() {
    return Object.freeze({
      phase,
      profile: phase === 'consented' && doc?.consent ? clone(doc.profile) : null,
      consent: doc?.consent ? clone(doc.consent) : null,
      pending: status.pending === true,
      error: status.error ? { code: status.error.code || 'PATH_STUDY_ERROR' } : null,
      localDrafts: Array.isArray(status.localDrafts) ? clone(status.localDrafts) : [],
      deletedElsewhere,
      // 한 번 보내지 못했으면 그 변경이 계정에 닿을 때까지 켜 둔다(끊긴 채 이어 눌러도 알림이 깜빡이지 않게).
      sendFailed: sendFailed && status.pending === true
    });
  }
  const phaseFor = () => {
    const st = status.status, code = status.error?.code;
    if (!accountId) return 'closed';
    if (st === 'local-conflict') return 'choose';
    if (doc?.consent) return 'consented';
    if (code && PAUSE_CODES.has(code)) return 'paused';
    if (['error', 'storage-error'].includes(st) || (code && !Number.isSafeInteger(status.revision))) return 'error';
    // 동기화는 열 때 먼저 빈 문서를 넘긴다. 계정의 판 번호가 오기 전의 빈 문서는 「동의 없음」이 아니라 아직 불러오는 중이다.
    if (!Number.isSafeInteger(status.revision)) return 'loading';
    return 'none';
  };

  const transport = (operation, values) => request(operation, values || {});
  // 이 계정의 화면 사본 · 초안 · 복구 기록을 저장소에서 지운다. 동기화를 닫은 뒤에만 부른다(올리는 중인 초안은 동기화가 지우지 않는다).
  function wipe(id) {
    if (!id || !storage) return;
    const head = STUDY_CACHE_PREFIX + encodeURIComponent(id), keys = [];
    try {
      for (let i = 0; i < storage.length; i++) { const k = storage.key(i); if (k === head || (typeof k === 'string' && k.startsWith(head + ':'))) keys.push(k); }
      for (const k of keys) storage.removeItem(k);
    } catch {}
  }

  function ensureSync() {
    if (sync) return sync;
    sync = syncFactory({
      transport, storage,
      onState: (state) => { doc = state ? clone(state) : null; phase = phaseFor(); emit(); },
      onStatus: (next) => {
        if (!next) return;
        status = { status: next.status || 'idle', revision: Number.isSafeInteger(next.revision) ? next.revision : null, pending: next.pending === true, error: next.error || null, localDrafts: next.localDrafts || [] };
        const code = next.error?.code;
        if (next.pending !== true) sendFailed = false;
        else if (code && !SELF_HEALING.has(code)) sendFailed = true;
        if (next.status === 'synced' && next.pending !== true && !reapplying) lastOp = null;
        // 다시 적용한 저장이 계정에 닿았으면 충돌 때 남긴 옛 사본(복구 기록)을 지운다. 그 변경은 이미 계정 문서에 들어갔다.
        // 저장 작업 안에서는 동기화가 기록을 쓰는 중이라 지우기를 거절한다: 작업이 끝난 뒤로 미룬다.
        if (cleanAfterSave && next.status === 'synced' && next.pending !== true) {
          cleanAfterSave = false; const my = epoch;
          setTimeout(() => { if (my === epoch && !status.pending) { try { sync.clearLocalRecords?.(); } catch {} } }, 0);
        }
        if (next.status === 'conflict' && !reapplying) void recoverConflict();
        else if (code === 'PATH_STUDY_CONSENT_STALE') void recoverStale();
        phase = phaseFor(); emit();
      },
      onSaved: () => {}, onRemoved: () => {},
      validateState: (raw) => validateStudyDocument(raw, { allowEmpty: true }),
      emptyState: () => emptyStudyDocument(),
      scope: 'synk-path', resource: STUDY_RESOURCE, cachePrefix: STUDY_CACHE_PREFIX, operations: STUDY_OPERATIONS
    });
    return sync;
  }

  // 판 충돌: 계정 것을 받고(이 탭 것은 복구 기록에 남는다) 마지막 동작 하나만 다시 적용한다. 계정 쪽이 지워졌으면 다시 쓰지 않는다.
  async function recoverConflict() {
    const my = epoch; reapplying = true;
    try {
      // 학생이 남은 초안을 골랐으면 그 초안으로 계정을 덮는다(동의가 다르면 서버가 409로 막고 아래 recoverStale이 계정 것을 받는다).
      if (preferLocal) { preferLocal = false; if (await sync.resolveLocal()) cleanAfterSave = true; return; }
      if (!(await sync.resolveRemote()) || my !== epoch) return;
      if (!doc?.consent) { deletedElsewhere = true; lastOp = null; preferLocal = false; try { sync.clearLocalRecords?.(); } catch {} phase = phaseFor(); emit(); return; }
      if (lastOp) { const op = lastOp; lastOp = null; const next = createStudyDocument(op(clone(doc.profile)), doc.consent); if (sync.change(next)) { doc = next; cleanAfterSave = true; emit(); } }
    } catch {} finally { reapplying = false; }
  }
  // 동의가 맞지 않는다는 409: 다른 곳에서 지웠거나 동의가 바뀌었다. 계정 것을 받고, 비었으면 동의 전으로 돌린다.
  async function recoverStale() {
    const my = epoch;
    try {
      if (!(await sync.resolveRemote()) || my !== epoch) return;
      if (!doc?.consent) { deletedElsewhere = true; lastOp = null; try { sync.clearLocalRecords?.(); } catch {} }
      phase = phaseFor(); emit();
    } catch {}
  }

  async function open(id) {
    close();
    accountId = id; epoch++; deletedElsewhere = false; lastOp = null; doc = null; phase = 'loading'; emit();
    const my = epoch;
    try {
      await ensureSync().open(id);
      if (my !== epoch) return false;
      // 남은 초안이 하나고 그 기준 판이 계정과 같으면 고르지 않고 이어 보낸다(설계 P1-6).
      const drafts = status.localDrafts || [];
      if (status.status === 'local-conflict' && drafts.length === 1 && drafts[0]?.baseRevision != null && drafts[0].baseRevision === status.revision) await sync.selectLocalDraft(drafts[0].id);
    } catch (error) {
      if (my === epoch) { status = { ...status, error: { code: error?.code || 'NETWORK' } }; }
    }
    if (my === epoch) { phase = phaseFor(); emit(); }
    return phase === 'consented' || phase === 'none';
  }
  function close() {
    epoch++;
    try { sync?.close(); } catch {}
    accountId = null; doc = null; lastOp = null; preferLocal = false; cleanAfterSave = false; sendFailed = false; phase = 'closed';
    status = { status: 'closed', revision: null, pending: false, error: null, localDrafts: [] };
  }
  function write(nextProfile, op = null) {
    if (phase !== 'consented' || !sync) throw Object.assign(new Error('PATH_STUDY_NOT_CONSENTED'), { code: 'PATH_STUDY_NOT_CONSENTED' });
    const next = createStudyDocument(nextProfile, doc.consent);
    const prev = lastOp;
    lastOp = typeof op === 'function' ? (prev && status.pending ? (p) => op(prev(p)) : op) : null;
    const changed = sync.change(next);
    if (changed) { doc = next; emit(); }
    return changed;
  }
  /**
   * 동의하고 처음 저장한다. base는 지금 본 계정 문서의 판 번호다(서버는 빈 행에 이 판으로 준 동의만 받는다).
   * 동의 시각은 이 기기의 시각으로 기록만 한다.
   * 돌려주는 것: true(서버가 받음) · 'exists'(받았는지 모르지만 다시 열어 보니 계정에 동의 문서가 있다) · false.
   */
  async function give({ profile, minor, lang }) {
    if (!sync || !accountId) return false;
    if (phase !== 'none' || !Number.isSafeInteger(status.revision)) {
      try { await sync.refresh(); } catch {}
      phase = phaseFor(); emit();
      if (phase === 'consented') return 'exists';
      if (phase !== 'none' || !Number.isSafeInteger(status.revision)) return false;
    }
    const consent = { v: CONSENT_VERSION, at: stamp(now()), minor: minor === true, guardian: minor === true, lang, base: status.revision };
    const next = createStudyDocument(profile, consent);
    deletedElsewhere = false;
    const id = accountId, my = epoch;
    sync.change(next); doc = next; phase = phaseFor(); emit();
    let ok = false;
    try { ok = (await sync.flush()) === true && !status.pending; } catch { ok = false; }
    if (my !== epoch) return false;
    if (!ok) {
      close(); wipe(id);
      await open(id);
      return accountId === id && phase === 'consented' ? 'exists' : false;
    }
    phase = phaseFor(); emit();
    return true;
  }
  /** 계정의 문서를 지운다. 응답을 잃었으면 다시 불러 비었는지로 판단한다. 지운 뒤 이 문서의 복구 기록도 지운다. */
  async function remove() {
    if (!sync || !accountId) return false;
    const my = epoch, id = accountId, same = () => my === epoch && accountId === id;
    let ok = false;
    try { ok = await sync.remove(); } catch { ok = false; }
    if (!same()) return false;
    if (!ok) { try { ok = (await sync.resolveRemote()) === true && same() && Number.isSafeInteger(status.revision) && !doc?.consent; } catch { ok = false; } }
    if (!same()) return false;
    if (ok) { lastOp = null; try { sync.clearLocalRecords?.(); } catch {} }
    phase = phaseFor(); emit();
    return ok;
  }
  /** 남은 초안을 골라 계정에 올린다. 그사이 계정이 바뀌었으면(판 충돌) 이 초안으로 덮는다. */
  const pickDraft = async (id) => { if (!sync) return false; preferLocal = true; const ok = await sync.selectLocalDraft(id); if (!ok) preferLocal = false; return ok; };
  const useAccount = async () => {
    preferLocal = false;
    if (!sync) return false;
    const my = epoch, ok = await sync.resolveRemote();
    if (ok === true && my === epoch) setTimeout(() => { if (my === epoch && !status.pending) { try { sync.clearLocalRecords?.(); } catch {} } }, 0);
    return ok;
  };
  const retry = () => (sync && accountId ? (status.pending ? sync.flush() : sync.refresh()) : Promise.resolve(false));
  const clearNotice = () => { deletedElsewhere = false; emit(); };
  /** 로그아웃 때 올리지 못한 이 문서의 초안 · 복구 기록을 지운다(학생이 확인한 뒤에만, 공용 기기에 성적 · 돈을 남기지 않게). */
  const discardLocal = (id = accountId) => { if (!id) return; if (accountId === id) close(); wipe(id); emit(); };
  return Object.freeze({ open, close, snapshot, write, give, remove, pickDraft, useAccount, retry, clearNotice, discardLocal });
}
