// Shared DOM adapter: the two hosts use the same explicit correction actions.
// Values and claims always come from the rendered Core report, never a URL.
// `settings` (member-settings.mjs) handles the help style and explanation length; after a save
// `onSettingsSaved` reads the summary again so the screen shows the stored value.
export function bindMemberUnderstandingEditor(root, { controller, getReport, settings = null, getSettingsContext = () => ({}), onSettingsSaved = () => {} } = {}) {
  const full = () => getReport?.();
  const report = () => full()?.understanding;
  function draft(form) {
    if (!form) return;
    const input = form.querySelector('[data-insight-field="note"]');
    const note = [...(input?.value || '')].slice(0, 200).join('');
    if (input && input.value !== note) input.value = note;
    controller.updateDraft({ note,
      values: [...form.querySelectorAll('[name="insight-choice"]:checked')].map(input => input.value) });
  }
  function statementDraft(form) {
    if (!form) return;
    const input = form.querySelector('[data-insight-field="statement"]');
    if (input) {
      const text = [...input.value].slice(0, 500).join('');
      if (input.value !== text) input.value = text;
      controller.updateStatementDraft({ text });
    }
    controller.updateStatementDraft({ acceptedIds: [...form.querySelectorAll('[data-insight-proposal]:checked')].map(input => input.dataset.insightProposal) });
  }
  function settingsDraft(form) {
    const chosen = form?.querySelector('[name="insight-setting"]:checked');
    if (chosen && settings) settings.choose(chosen.value);
  }
  async function saveSettings(form) {
    if (!settings) return;
    settingsDraft(form);
    const result = await settings.save(getSettingsContext());
    if (!result?.error && !result?.editor) onSettingsSaved();
  }
  // 「왜 이렇게 봤나요?」 opens the basis on the same page; no hash route is involved.
  function jump(id) {
    const target = typeof id === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,60}$/.test(id) ? root.querySelector(`#${id}`) : null;
    if (!target) return;
    if (target.tagName === 'DETAILS') target.open = true;
    target.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
    target.querySelector('summary')?.focus({ preventScroll: true });
  }
  const onInput = event => {
    const settingsForm = event.target.closest?.('[data-insight-settings-editor]');
    if (settingsForm && root.contains(settingsForm)) { settingsDraft(settingsForm); return; }
    const statementForm = event.target.closest?.('[data-insight-statement-editor]');
    if (statementForm && root.contains(statementForm)) { statementDraft(statementForm); return; }
    const form = event.target.closest?.('[data-insight-editor]'); if (form && root.contains(form)) draft(form);
  };
  const onSubmit = event => {
    if (event.target.matches?.('[data-insight-settings-editor]')) {
      event.preventDefault(); event.stopPropagation(); void saveSettings(event.target); return;
    }
    if (event.target.matches?.('[data-insight-statement-editor]')) {
      event.preventDefault(); event.stopPropagation(); statementDraft(event.target);
      // Enter can request an interpretation, but only the explicit final action
      // can persist it. Answer buttons are never form submitters.
      if (controller.read().statementEditor?.stage === 'writing') controller.previewStatement();
      return;
    }
    if (!event.target.matches?.('[data-insight-editor]')) return;
    event.preventDefault(); event.stopPropagation(); draft(event.target); void controller.save();
  };
  const onClick = event => {
    const button = event.target.closest?.('[data-insight-action]');
    if (!button || !root.contains(button) || button.disabled) return;
    const action = button.dataset.insightAction;
    if (action === 'jump') { event.preventDefault(); event.stopImmediatePropagation(); jump(button.dataset.insightTarget); return; }
    if (action?.startsWith('settings-')) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (!settings) return;
      if (action === 'settings-edit') { const field = button.dataset.insightField; settings.begin({ field, value: full()?.settings?.[field] ?? null }); }
      else if (action === 'settings-cancel') settings.cancel();
      else if (action === 'settings-save') void saveSettings(button.closest('[data-insight-settings-editor]'));
      return;
    }
    if (!action?.startsWith('understanding-')) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const current = report(), facet = current?.facets?.find(row => row.id === button.dataset.insightFacet);
    if (action === 'understanding-answer' && facet?.available && facet.claim) {
      // One tap saves: a verdict on a repeated pattern, or a practised topic's answer.
      if (button.dataset.insightVerdict) void controller.answer({ facetId: facet.id, verdict: button.dataset.insightVerdict, claim: facet.claim });
      else if (button.dataset.insightValue && facet.choices?.some(choice => choice.id === button.dataset.insightValue)) void controller.answer({ facetId: facet.id, value: button.dataset.insightValue });
    } else if (action === 'understanding-review' && facet?.available && facet.claim) {
      controller.begin({ facetId: facet.id, mode: 'review', verdict: button.dataset.insightVerdict, claim: facet.claim, values: facet.selected || [], facet });
    } else if (action === 'understanding-edit' && facet?.choices?.length) {
      controller.begin({ facetId: facet.id, mode: 'override', values: facet.selected || [], facet });
    } else if (action === 'understanding-save') {
      draft(button.closest('[data-insight-editor]')); void controller.save();
    } else if (action === 'understanding-cancel') controller.cancel();
    else if (action === 'understanding-remove') {
      const row = current?.history?.find(item => item.id === button.dataset.insightId && item.kind === button.dataset.insightKind);
      if (row) void controller.remove({ kind: row.kind, id: row.id, facetId: row.facetId });
    } else if (action === 'understanding-clear') void controller.clear();
    else if (action === 'understanding-describe') controller.describe();
    else if (action === 'understanding-preview') { statementDraft(button.closest('[data-insight-statement-editor]')); controller.previewStatement(); }
    else if (action === 'understanding-edit-text') controller.editStatementText();
    else if (action === 'understanding-answer-statement') controller.answerStatement({ questionId: button.dataset.insightQuestion, optionId: button.dataset.insightOption });
    else if (action === 'understanding-reset-answers') controller.resetStatementAnswers();
    else if (action === 'understanding-confirm-statement') { statementDraft(button.closest('[data-insight-statement-editor]')); void controller.confirmStatement(); }
    else if (action === 'understanding-remove-statement') {
      const row = current?.statementHistory?.find(item => item.id === button.dataset.insightId);
      if (row) void controller.removeStatement({ id: row.id });
    }
  };
  root.addEventListener('click', onClick, true);
  root.addEventListener('input', onInput);
  root.addEventListener('change', onInput);
  root.addEventListener('submit', onSubmit);
  return () => { root.removeEventListener('click', onClick, true); root.removeEventListener('input', onInput); root.removeEventListener('change', onInput); root.removeEventListener('submit', onSubmit); };
}

export function captureMemberUnderstandingFocus(container) {
  const active = container.ownerDocument.activeElement;
  if (!active || !container.contains(active)) return () => {};
  const attributes = ['id', 'data-insight-action', 'data-insight-facet', 'data-insight-verdict', 'data-insight-value', 'data-insight-kind', 'data-insight-id', 'data-insight-target', 'data-insight-field', 'data-insight-proposal', 'data-insight-question', 'data-insight-option', 'name', 'value'];
  const keys = attributes.map(key => [key, active.getAttribute(key)]).filter(([, value]) => value !== null);
  const start = active.selectionStart, end = active.selectionEnd;
  return () => {
    if (!keys.length) return;
    const next = [...container.querySelectorAll('a,button,input,select,textarea')].find(node => keys.every(([key, value]) => node.getAttribute(key) === value));
    if (next) next.focus({ preventScroll: true });
    else if (active.hasAttribute('data-insight-question') || active.getAttribute('data-insight-action') === 'understanding-reset-answers')
      (container.querySelector('[data-insight-question-title]') || container.querySelector('[data-insight-editor-title]'))?.focus({ preventScroll: true });
    if (typeof start === 'number' && typeof next?.setSelectionRange === 'function') { try { next.setSelectionRange(start, end); } catch {} }
  };
}
