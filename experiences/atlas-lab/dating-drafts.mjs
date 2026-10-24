// Same-tab editing sessions for the dating page (E02, 2026-10-23). Raw drafts
// stay in this tab's memory only: nothing here writes browser storage, sends a
// request or decides whether a draft may be saved. Sending is always an
// explicit button in dating-ui.mjs; reloads, page returns and polling only read.
//
// Every draft remembers the basis it was written against. When the current
// basis differs (another account, a newer saved source, a closed pair, consent
// turned off) the draft is discarded instead of overwriting the newer state.

/**
 * One surface for every private draft kind. Each kind registers itself where
 * it is declared, so an owner reset, a render and leaving the page never list
 * draft names: clear() empties all, prune() drops drafts whose basis changed,
 * hasDraft() reports unsent input worth a leave warning. A registered Map or
 * Set is cleared on owner reset only.
 */
export function createDraftRegistry() {
  const entries = [];
  return Object.freeze({
    register(name, store) { entries.push({ name, store }); return store; },
    clear() { for (const { store } of entries) store.clear(); },
    prune() { for (const { store } of entries) store.prune?.(); },
    hasDraft() { return entries.some(({ store }) => store.hasDraft?.() === true); },
    unsaved() { return entries.filter(({ store }) => store.hasDraft?.() === true).map(({ name }) => name); },
  });
}

/**
 * Drafts keyed by an editing scope. basisOf(id, draft) returns the basis the
 * scope has now; a stored draft survives only while it is identical.
 * counts(draft) decides whether the draft is unsent work for a leave warning.
 */
export function createBasisDrafts({ basisOf, counts = () => true }) {
  const drafts = new Map();
  const current = (id, draft) => draft.basis === basisOf(id, draft);
  return {
    get size() { return drafts.size; },
    keys: () => drafts.keys(),
    has: id => drafts.has(id),
    /** The draft for id if its basis still holds; a stale draft is dropped. */
    read(id) {
      const draft = drafts.get(id);
      if (!draft) return null;
      if (current(id, draft)) return draft;
      drafts.delete(id); return null;
    },
    write(id, basis, value) { const draft = { ...value, basis }; drafts.set(id, draft); return draft; },
    delete: id => drafts.delete(id),
    prune() { for (const [id, draft] of drafts) if (!current(id, draft)) drafts.delete(id); },
    clear() { drafts.clear(); },
    hasDraft() { for (const draft of drafts.values()) if (counts(draft)) return true; return false; },
  };
}

/** A single draft slot with the same basis rule. */
export function createBasisDraft({ basisOf, counts = () => true }) {
  const one = createBasisDrafts({ basisOf: () => basisOf(), counts });
  return {
    read: () => one.read(''),
    write: (basis, value) => one.write('', basis, value),
    discard: () => { one.delete(''); },
    prune: () => one.prune(),
    clear: () => one.clear(),
    hasDraft: () => one.hasDraft(),
  };
}

const SEED_FIELDS = ['appointmentId', 'proposalVersion', 'place', 'durationMinutes'];
const filled = values => Object.values(values).some(Boolean);

/**
 * The appointment editing session: unsent input of each new-proposal and
 * revision form, and the reschedule seed (only the previous place and length)
 * a person explicitly chose to reuse for the next new proposal.
 *
 * basis(pairId, formKey) returns the form's current draft basis (account, pair,
 * server schedule basis and proposal version) or null where a draft must not
 * be kept. seedOf(pairId, appointmentId) returns the reschedule source the
 * current view still allows (getRescheduleDraft) or null.
 */
export function createScheduleEditor({ basis, seedOf }) {
  const drafts = new Map(), seeds = new Map();
  const slot = (pairId, formKey) => JSON.stringify([pairId, formKey]);
  const liveSeed = (pairId, stored) => {
    const current = seedOf(pairId, stored.appointmentId);
    return current && SEED_FIELDS.every(name => current[name] === stored[name]) ? current : null;
  };
  function updateBasis() {
    for (const [id, draft] of drafts) { const key = basis(draft.pairId, draft.formKey); if (!key || draft.key !== key) drafts.delete(id); }
    for (const [pairId, stored] of seeds) { const key = basis(pairId, 'new'); if (!key || stored.key !== key || !liveSeed(pairId, stored)) seeds.delete(pairId); }
  }
  function dispose() { drafts.clear(); seeds.clear(); }
  return Object.freeze({
    updateBasis, prune: updateBasis, dispose, clear: dispose,
    /** Saved input for a form, only while the form's basis is unchanged. */
    readDraft(pairId, formKey) {
      const key = basis(pairId, formKey), saved = drafts.get(slot(pairId, formKey));
      return key && saved?.key === key ? saved : null;
    },
    /** The previous place and length to start a new proposal with, if still valid. */
    readSeed(pairId) {
      const stored = seeds.get(pairId); if (!stored) return null;
      const current = liveSeed(pairId, stored);
      if (!current) seeds.delete(pairId);
      return current;
    },
    /**
     * Explicit reuse of an earlier appointment: the new-proposal form's input
     * is replaced by the seed. Where no draft may be kept the seed is returned
     * for direct filling and not remembered (kept: false).
     */
    reuse(pairId, appointmentId) {
      const current = seedOf(pairId, appointmentId); if (!current) return null;
      const key = basis(pairId, 'new');
      drafts.delete(slot(pairId, 'new'));
      if (key) seeds.set(pairId, { ...current, key }); else seeds.delete(pairId);
      return { seed: current, kept: !!key };
    },
    /**
     * Remember a rendered form's input on each edit, while the form is still on
     * screen and its basis is the one it was rendered with. read() returns
     * { values, endEdited }.
     */
    mount(form, { pairId, formKey, read }) {
      const key = basis(pairId, formKey);
      form.dataset.scheduleForm = formKey; form.dataset.schedulePair = pairId;
      if (key) form.dataset.scheduleDraftKey = key;
      const remember = () => {
        if (!form.isConnected || !key || basis(pairId, formKey) !== key) return;
        const { values, endEdited } = read();
        drafts.set(slot(pairId, formKey), { key, pairId, formKey, endEdited, open: form.closest('details')?.open ?? true, values });
      };
      form.addEventListener('input', remember); form.addEventListener('change', remember);
      return key;
    },
    /**
     * After a render: reopen or keep closed each form's section as the draft
     * left it and follow later toggles. True when a non-empty draft resumed.
     */
    restore(root) {
      let resumed = false;
      for (const form of root.querySelectorAll('[data-schedule-form]')) {
        const id = slot(form.dataset.schedulePair, form.dataset.scheduleForm), draft = drafts.get(id);
        const container = form.closest('details');
        if (draft && draft.key === form.dataset.scheduleDraftKey) {
          if (container) container.open = draft.open;
          if (filled(draft.values)) resumed = true;
        }
        container?.addEventListener('toggle', () => {
          const saved = drafts.get(id);
          if (form.isConnected && saved?.key === form.dataset.scheduleDraftKey) saved.open = container.open;
        });
      }
      return resumed;
    },
    /** A proposal was sent: its draft and the pair's seed are done. */
    sent(pairId, formKey) { drafts.delete(slot(pairId, formKey)); seeds.delete(pairId); },
    hasDraft() { for (const draft of drafts.values()) if (filled(draft.values)) return true; return false; },
  });
}
