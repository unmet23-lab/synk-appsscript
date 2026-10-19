import { TRAVEL_ACCOUNT_CONTRACT, createTravelAccountNotebook } from './planner-account.mjs';
import { createTravelMemory, validateTravelMemory } from './planner-storage.mjs';
import { createTravelLoginHandoff } from './planner-login-draft.mjs';

/** Product UI boundary. Account documents never become consented guest storage. */
export async function createTravelAccountSession({
  mount, content, getState, applyState, captureGuestDraft = () => null,
  restoreGuestDraft = () => {}, closeDialogs = () => {}, onMode = () => {},
  onStatus = () => {}, beforeNavigate = () => true,
  captureLoginDraft = () => null, restoreLoginDraft = () => {}, onLoginRestore = () => {}, loginHandoff,
  contract = TRAVEL_ACCOUNT_CONTRACT, notebookFactory = createTravelAccountNotebook,
  notebookOptions = {},
} = {}) {
  if (!mount || !content || !getState || !applyState) throw new TypeError('여행 계정 화면 연결을 확인해 주세요.');
  let notebook = null, active = false, hydrating = false, generation = 0, guestDraft = null, guestState = null;
  const enabled = contract.available === true && contract.productionRegistered === true;
  let handoff = null;
  const locked = () => Boolean(content.inert || content.hidden || active && notebook && !notebook.canEdit);
  const receive = (state, { guest = false } = {}) => {
    const checked = validateTravelMemory({ ...state, consent: guest ? state.consent : false });
    generation++; hydrating = true;
    try {
      applyState(checked, { guest, snapshot: true });
      if (guest && guestDraft) { restoreGuestDraft(guestDraft); guestDraft = null; }
      if (guest) guestState = null;
    } finally { hydrating = false; }
  };
  // During the first switch, capture the guest dialog before closing it in onMode.
  const status = () => { if (active && locked()) closeDialogs(); onStatus({ active, locked:locked(), hydrating }); };
  const api = {
    get active() { return active; }, get hydrating() { return hydrating; },
    get locked() { return locked(); }, get generation() { return generation; },
    get enabled() { return enabled; },
    invalidateGuestConsent() {
      if (!active || !guestState) return false;
      guestState.consent=false;
      handoff?.revokeConsent();
      return notebook?.updateGuestState(guestState) ?? false;
    },
    async persist(value) {
      if (hydrating || locked()) return { destination:'none', stored:false };
      if (!active) return { destination:'guest', stored:false };
      const checked=validateTravelMemory({ ...value, consent:false });
      return { destination:'account', stored:Boolean(await notebook.change(checked)) };
    },
    suspend() { if (active) { generation++; closeDialogs(); return notebook?.suspend(); } },
    resume() { if (!active) handoff?.clear(); return notebook?.resume(); },
    dispose() { generation++; notebook?.dispose(); },
  };
  // This gate precedes factory creation, config reads, saved auth and native IPC.
  if (!enabled) {
    mount.textContent=contract.reason;
    mount.dataset.accountMode='local';
    onStatus({ active:false, locked:false, hydrating:false });
    return api;
  }
  handoff = loginHandoff ?? createTravelLoginHandoff();
  const returning = handoff.read();
  if (returning) {
    hydrating=true;
    try { applyState(returning.memory,{guest:true,snapshot:true});restoreLoginDraft(returning.draft);onLoginRestore(); }
    finally { hydrating=false; }
  }
  notebook = await notebookFactory({
    ...notebookOptions, mount, content, getState,
    applyState:receive, beforeNavigate,
    beforeSignIn:()=>{if(!active)handoff.save({memory:getState(),draft:captureLoginDraft()});},
    onSignInFailure:()=>handoff.clear(),
    onMode(next, meta={}) {
      generation++;
      if (next && !active) { guestState=validateTravelMemory(getState()); guestDraft=captureGuestDraft(); }
      active=next; closeDialogs();
      if(!next)handoff.clear();
      if (next) {
        hydrating=true;
        try { applyState(createTravelMemory(), { guest:false, snapshot:true, switching:true }); }
        finally { hydrating=false; }
      }
      onMode(next,meta);
    },
    onStatusChange:status,
  });
  await notebook.start();
  if(!active)handoff.clear();
  status();
  return api;
}
