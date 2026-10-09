import { PLATFORM_APP_IDS } from './platform-library-data.mjs';

// Unsaved input is separate from the cloud document and never uses localStorage.
// The host owns account validation, opt-in, encryption and seven-day expiry.
export function libraryDraft(value) {
  const draft = row => row && PLATFORM_APP_IDS.includes(row.appId) && typeof row.title === 'string' && row.title.length <= 240;
  if (!value || !draft(value.draft) || value.parkedDraft !== null && !draft(value.parkedDraft)) return null;
  const edit = value.editing;
  if (edit !== null && (!draft(edit) || typeof edit.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(edit.id) || typeof edit.done !== 'boolean' || !Number.isSafeInteger(edit.createdAt) || edit.createdAt <= 0)) return null;
  return { draft: { appId:value.draft.appId, title:value.draft.title }, editing:edit ? { id:edit.id, appId:edit.appId, title:edit.title, done:edit.done, createdAt:edit.createdAt } : null, parkedDraft:value.parkedDraft ? { appId:value.parkedDraft.appId, title:value.parkedDraft.title } : null };
}

export function createLibraryRecovery({ getHost, getOwner, canUse, getPayload, onChange = () => {} }) {
  let status = null, candidate = null, checkedOwner = null, timer = null, epoch = 0, closed = false, unsubscribe = null, hostBound = null, write = Promise.resolve(), error = '', removalFailed = false;
  const owner = () => !closed && canUse() ? getOwner() : null;
  const present = payload => !!payload?.draft.title.trim() || !!payload?.parkedDraft?.title.trim();
  const current = (expected, account) => !closed && epoch === expected && getOwner() === account;
  function state() { return { enabled:status?.enabled === true, candidate, error, removalFailed }; }
  function changed() { if (!closed) onChange(state()); }
  function reset() { epoch++; clearTimeout(timer); timer=null; checkedOwner=null; status=null; candidate=null; error=''; removalFailed=false; }
  async function refresh(force = false) {
    const host = getHost(), account = owner();
    if (!account || typeof host?.draftRecoveryStatus !== 'function') return;
    if (host !== hostBound) {
      unsubscribe?.(); hostBound=host;
      unsubscribe=host.onDraftRecoveryChanged?.(() => { reset(); void refresh(true); });
    }
    if (!force && checkedOwner === account) return;
    checkedOwner=account;
    const expected=epoch;
    try {
      const next=await host.draftRecoveryStatus(account);
      if (!current(expected,account) || !canUse()) return;
      if (next.ok !== true) throw new Error('status');
      status=next;
      if (!next.enabled || !next.available) { candidate=null; error=''; changed(); return; }
      const loaded=await host.draftRecoveryLoad('platform-library',account);
      if (!current(expected,account) || !canUse()) return;
      if (loaded.ok !== true) throw new Error('load');
      const saved=libraryDraft(loaded.draft);
      // A same-account recheck must not replace text already visible in the form.
      candidate=present(saved) && !present(getPayload()) ? saved : null;
      error=''; changed();
      if (!candidate && present(getPayload())) schedule();
    } catch { if (current(expected,account)) { status=null; error='기기의 초안 복구 상태를 확인하지 못했어요. 현재 입력은 이 화면에 유지돼요.'; changed(); } }
  }
  function persist() {
    clearTimeout(timer); timer=null;
    const account=owner(), expected=epoch, payload=libraryDraft(getPayload()), host=getHost();
    if (!account || !status?.enabled || !status?.available || candidate || !payload) return write;
    write=write.catch(() => {}).then(async () => {
      if (!current(expected,account)) return;
      try {
        const result=present(payload) ? await host.draftRecoverySave('platform-library',payload,account) : await host.draftRecoveryClear('platform-library',account);
        if (!current(expected,account)) return;
        if (result.ok !== true) throw new Error('save');
        if (error) { error=''; changed(); }
      } catch { if (current(expected,account)) { error='기기에 초안을 보관하지 못했어요. 창을 닫기 전에 계정에 메모를 저장해 주세요.'; changed(); } }
    });
    return write;
  }
  function schedule() { clearTimeout(timer); if (!closed) timer=setTimeout(() => { void persist(); },350); }
  function take() {
    const saved=candidate;
    epoch++; clearTimeout(timer); timer=null; checkedOwner=getOwner();
    candidate=null; error=''; removalFailed=false; changed(); return saved;
  }
  async function discard() {
    const cleared=await clear();
    if (cleared && present(getPayload())) schedule();
    return cleared;
  }
  async function clear() {
    const host=getHost(), account=getOwner(), expected=++epoch;
    candidate=null; error=''; removalFailed=false; clearTimeout(timer); timer=null; checkedOwner=account;
    // Clear also invalidates an initial load that has not returned its status.
    // Mark the owner checked before notifying the view, so render cannot start
    // another read of the slot while its removal is still pending.
    changed();
    if (!account || status?.enabled === false || typeof host?.draftRecoveryClear !== 'function') return true;
    write=write.catch(() => {}).then(async () => {
      if (!current(expected,account)) return true;
      try {
        const result=await host.draftRecoveryClear('platform-library',account);
        if (!current(expected,account)) return true;
        if (result?.ok !== true) throw new Error('clear');
        if (typeof result.enabled === 'boolean') status=result;
        return true;
      } catch {
        if (current(expected,account)) { removalFailed=true; error='기기에 보관한 초안을 지우지 못했어요. 창을 열어 둔 채 다시 시도해 주세요.'; changed(); }
        return false;
      }
    });
    return write;
  }
  return { state, refresh, reset, schedule, persist, take, discard, clear, dispose() { clearTimeout(timer); closed=true; epoch++; unsubscribe?.(); } };
}
