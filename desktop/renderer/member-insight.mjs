import { buildMemberInsightReport } from './member-insight-model.mjs';

// This is a view of the existing Core/Trail/Vellum account summary. It never
// persists a second profile or reads another product's private records.
export function createMemberInsight({ getIdentity, request, activity = null, understanding = null, onChange = () => {}, timeoutMs = 12000, now = Date.now } = {}) {
  let state = { status: 'loading', report: null }, binding = '', revision = 0, pending = null;
  let visible = false, stopped = false, response = null;
  let projection = null;
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
      binding = next; revision++; pending = null; response = null; projection = null;
      state = { status: account.signedIn ? 'loading' : ['loading', 'restoring', 'signing-in', 'signing-out'].includes(account.status) ? 'loading' : account.status === 'unconfigured' ? 'unconfigured' : account.status === 'error' ? 'error' : 'signed-out', report: null };
    }
    return account;
  }
  function read() { sync();const value=snapshot(),feedback=understanding?.read();return feedback&&value.status==='ready'?{...value,understandingEditor:feedback.editor,understandingStatementEditor:feedback.statementEditor,understandingPending:feedback.pending,understandingMessage:feedback.message,understandingError:feedback.error}:value; }
  function project(editorChange = false){
    const account=sync();if(!response||!visible||!account.signedIn||stopped)return;
    const feedback=understanding?.read();
    const content=feedback?JSON.stringify([feedback.status,feedback.revision,feedback.document,feedback.pending,feedback.message,feedback.error]):null;
    const editor=feedback?JSON.stringify([feedback.editor,feedback.statementEditor]):null;
    // Only a changed RAM editor can reuse the displayed analysis. Every source
    // notification, refresh (even with the same document), or state change runs
    // Core again with a fresh analysis time. No profile survives leaving the view.
    const reuse=editorChange&&state.status==='ready'&&projection?.response===response&&projection.content===content&&projection.editor!==editor;
    const usage=reuse?null:activity?.read();
    const report=reuse?state.report:buildMemberInsightReport(response,{...(usage?{activity:usage.activity,activityStatus:usage.status}:{}),...(feedback?{understanding:feedback.document,understandingStatus:feedback.status,understandingRevision:feedback.revision,understandingAsOf:new Date(Math.max(now(),Date.parse(response?.summary?.asOf)||0)).toISOString()}:{})});
    projection={response,content,editor};
    emit({status:'ready',report,activityPending:reuse?state.activityPending:usage?.pending===true,
      ...(feedback?{understandingPending:feedback.pending,understandingEditor:feedback.editor,understandingStatementEditor:feedback.statementEditor,understandingMessage:feedback.message,understandingError:feedback.error}:{})});
  }
  const unsubscribe=activity?.subscribe(()=>{if(response)project();});
  const unsubscribeUnderstanding=understanding?.subscribe(()=>{if(response)project(true);});
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
        projection = null;
        emit({ status: 'loading', report: null });
        if(activity)void activity.refresh();
        if(understanding)void understanding.refresh();
        const result = await Promise.race([
          Promise.resolve().then(() => request('atlasSummary', {})),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), timeoutMs); }),
        ]);
        if (current()) {response=result;project();}
      } catch {
        if (current()) {response=null;projection=null;emit({ status: 'error', report: null, message: '내 기록을 불러오지 못했어요. 계정 연결을 확인하거나 다시 불러와 주세요.' });}
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
    if (!next && visible) { revision++; pending = null; binding = ''; response=null; projection=null; understanding?.hide(); state = { status: 'loading', report: null }; }
    visible = next;
    sync();
    if (visible && state.status === 'loading') void refresh();
  }
  return Object.freeze({ read, refresh, setVisible,
    invalidate() { revision++; pending = null; binding = ''; response=null;projection=null;understanding?.hide(); state = { status: 'loading', report: null }; },
    stop() { stopped = true; visible = false; revision++; pending = null; response=null;projection=null;unsubscribe?.();unsubscribeUnderstanding?.();understanding?.stop();state = { status: 'loading', report: null }; },
  });
}
