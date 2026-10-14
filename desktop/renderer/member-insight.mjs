import { buildMemberInsightReport } from './member-insight-model.mjs';

// This is a view of the existing Core/Trail/Vellum account summary. It never
// persists a second profile or reads another product's private records.
export function createMemberInsight({ getIdentity, request, onChange = () => {}, timeoutMs = 12000 } = {}) {
  let state = { status: 'loading', report: null }, binding = '', revision = 0, pending = null;
  let visible = false, stopped = false;
  const identity = () => {
    const value = getIdentity?.() || {};
    const accountId = value.accountId || value.account?.synk_user_id;
    return { ...value, accountId, signedIn: value.signedIn === true && value.status === 'signed-in' && typeof accountId === 'string' && !!accountId };
  };
  const key = value => JSON.stringify([value.status, value.signedIn, value.accountId || null, value.sessionGeneration ?? null]);
  const snapshot = () => structuredClone(state);
  const emit = next => { state = next; if (!stopped) onChange(snapshot()); };
  function sync() {
    const account = identity(), next = key(account);
    if (next !== binding) {
      binding = next; revision++; pending = null;
      state = { status: account.signedIn ? 'loading' : ['loading', 'restoring', 'signing-in', 'signing-out'].includes(account.status) ? 'loading' : account.status === 'unconfigured' ? 'unconfigured' : account.status === 'error' ? 'error' : 'signed-out', report: null };
    }
    return account;
  }
  function read() { sync(); return snapshot(); }
  async function refresh() {
    const account = sync();
    if (stopped || !visible || !account.signedIn) return snapshot();
    if (pending) return pending.promise;
    const expected = ++revision, owner = binding;
    const current = () => !stopped && visible && expected === revision && owner === key(identity());
    const job = { promise: null }; pending = job;
    // Queue the request so re-entrant renders already see a pending read.
    job.promise = Promise.resolve().then(async () => {
      let timer;
      try {
        if (!current()) return snapshot();
        emit({ status: 'loading', report: null });
        const response = await Promise.race([
          Promise.resolve().then(() => request('atlasSummary', {})),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), timeoutMs); }),
        ]);
        if (current()) emit({ status: 'ready', report: buildMemberInsightReport(response) });
      } catch {
        if (current()) emit({ status: 'error', report: null, message: '내 기록을 불러오지 못했어요. 계정 연결을 확인하거나 다시 불러와 주세요.' });
      } finally {
        clearTimeout(timer);
        if (pending === job) pending = null;
      }
      return snapshot();
    });
    return job.promise;
  }
  function setVisible(value) {
    const next = value === true;
    if (!next && visible) { revision++; pending = null; binding = ''; state = { status: 'loading', report: null }; }
    visible = next;
    sync();
    if (visible && state.status === 'loading') void refresh();
  }
  return Object.freeze({ read, refresh, setVisible,
    invalidate() { revision++; pending = null; binding = ''; state = { status: 'loading', report: null }; },
    stop() { stopped = true; visible = false; revision++; pending = null; state = { status: 'loading', report: null }; },
  });
}
