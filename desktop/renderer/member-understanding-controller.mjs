import { emptyMemberUnderstanding, validateMemberUnderstanding, updateMemberUnderstanding } from './generated/member-understanding-data.mjs';
import MemberUnderstanding from './generated/member-understanding.mjs';
const { previewMemberStatement, confirmMemberStatement } = MemberUnderstanding;

// The host owns identity. Only explicitly submitted corrections are persisted;
// editor drafts and account-bound response snapshots stay in memory.
export function createMemberUnderstanding({ getIdentity, request, now = Date.now, uuid = () => crypto.randomUUID(), timeoutMs = 12000 } = {}) {
  let binding = '', epoch = 0, queue = Promise.resolve(), stopped = false;
  let document = null, revision = 0, status = 'unavailable', pending = 0;
  let editor = null, statementEditor = null, editToken = 0, message = '', error = null;
  const listeners = new Set();
  const clone = value => value === null ? null : structuredClone(value);
  const identity = () => { const v = getIdentity?.() || {}; return { ...v, accountId: v.accountId || v.account?.synk_user_id }; };
  const key = v => JSON.stringify([v.status, v.signedIn, v.accountId, v.sessionGeneration]);
  const signed = v => v.status === 'signed-in' && v.signedIn === true && typeof v.accountId === 'string' && !!v.accountId;
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const conflict = () => Object.assign(new Error('correction conflict'), { code: 'UNDERSTANDING_CONFLICT' });
  const collection = kind => kind === 'review' ? 'reviews' : 'overrides';
  const entry = (doc, kind, facetId) => doc?.[collection(kind)]?.find(row => row.facetId === facetId) || null;
  function sync() {
    const owner = identity(), next = key(owner);
    if (next !== binding) {
      binding = next; epoch++; queue = Promise.resolve(); document = null; revision = 0;
      status = signed(owner) ? 'loading' : 'unavailable'; pending = 0; editor = null; statementEditor = null; editToken++; message = ''; error = null;
    }
    return owner;
  }
  function read() {
    sync();
    const draft = editor ? { facetId: editor.facetId, mode: editor.mode, verdict: editor.verdict, values: [...editor.values], note: editor.note, facet: clone(editor.facet) } : null;
    const statementDraft = statementEditor ? { text: statementEditor.text, preview: clone(statementEditor.preview), clarifications: clone(statementEditor.clarifications), acceptedIds: [...statementEditor.acceptedIds], stage: statementEditor.stage } : null;
    return { status, document: clone(document), revision, pending: pending > 0, editor: draft, statementEditor: statementDraft, message, error };
  }
  function emit() { if (!stopped) { const value = read(); for (const fn of listeners) fn(value); } }
  const current = (owner, token) => !stopped && token === epoch && owner === key(identity()) && signed(identity());
  async function call(operation, params, owner, token) {
    let timer;
    try {
      if (!current(owner, token)) throw new Error('changed');
      const raw = await Promise.race([
        Promise.resolve().then(() => { if (!current(owner, token)) throw new Error('changed'); return request(operation, params); }),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), timeoutMs); }),
      ]);
      if (!current(owner, token)) throw new Error('changed');
      if (raw?.ok === false) throw Object.assign(new Error('request'), raw.error || {});
      const result = raw?.data || raw;
      if (result?.ok === false) throw Object.assign(new Error('request'), result.error || {});
      if (result?.ok !== true || result.scope !== 'synk-personal' || result.resource !== 'member-understanding'
        || result.accountId !== identity().accountId || !Number.isSafeInteger(result.revision) || result.revision < 0
        || !Object.hasOwn(result, 'state')) throw new Error('response');
      return { document: result.state === null ? emptyMemberUnderstanding() : validateMemberUnderstanding(result.state), revision: result.revision };
    } finally { clearTimeout(timer); }
  }
  async function load(owner, token) {
    let result;
    try { result = await call('understandingLoad', {}, owner, token); }
    catch (failure) { if (current(owner, token)) status = 'error'; throw failure; }
    if (!current(owner, token)) throw new Error('changed');
    document = result.document; revision = result.revision; status = 'ready'; return result;
  }
  function enqueue(work, mutation = false) {
    const account = sync(); if (stopped || !signed(account)) return Promise.resolve(read());
    const owner = binding, token = epoch;
    if (mutation) { pending++; message = ''; error = null; }
    const job = queue.then(async () => {
      if (!current(owner, token)) return read();
      try { await work(owner, token); }
      catch (failure) {
        if (current(owner, token)) {
          error = failure?.code === 'UNDERSTANDING_CONFLICT' ? 'conflict' : failure?.code === 'PERSONAL_DOCUMENT_VERSION_CONFLICT' ? 'version-conflict' : 'save-failed';
          if (!document) status = 'error';
          message = error === 'conflict' ? '다른 곳에서 이 내용을 바꿨어요. 최신 내용을 확인한 뒤 다시 수정해 주세요.'
            : error === 'version-conflict' ? '저장 형식이 업데이트됐어요. 최신 플랫폼에서 다시 열어 주세요.'
            : mutation ? '저장하지 못했어요. 입력한 내용은 그대로 있으니 다시 시도해 주세요.' : '고친 내역을 불러오지 못했어요. 다시 불러와 주세요.';
        }
      } finally { if (current(owner, token)) { if (mutation) pending--; emit(); } }
      return read();
    });
    queue = job.catch(() => {}); if (mutation) emit(); return job;
  }
  function mutate(action, expected, expectedEditor = null, savedMessage = null) {
    return enqueue(async (owner, token) => {
      const kind = action.type.includes('review') ? 'review' : 'override';
      const facetId = action.value?.facetId || action.facetId;
      for (let attempt = 0; attempt < 2; attempt++) {
        await load(owner, token); if (!current(owner, token)) throw new Error('changed');
        const currentEntry = entry(document, kind, facetId);
        // A timed-out acknowledgement can be recovered without a duplicate write.
        const alreadySaved = action.value && same(currentEntry, action.value);
        if (!alreadySaved && !same(currentEntry, expected)) throw conflict();
        if (!alreadySaved) {
          const next = updateMemberUnderstanding(document, action, now());
          try {
            const saved = await call('understandingSave', { state: next, expected_revision: revision }, owner, token);
            if (!current(owner, token)) throw new Error('changed');
            document = saved.document; revision = saved.revision; status = 'ready';
          } catch (failure) {
            if (attempt === 0 && ['REVISION_CONFLICT', 'PERSONAL_REVISION_CONFLICT'].includes(failure.code)) continue;
            throw failure;
          }
        }
        if (expectedEditor !== null && expectedEditor === editToken) editor = null;
        error = null; message = savedMessage || (action.type.startsWith('remove-') ? '되돌렸어요. 원래 연습 기록은 그대로예요.' : '고친 내용을 저장했어요.');
        return;
      }
    }, true);
  }
  function begin({ facetId, mode = 'review', verdict = 'agree', claim = null, values = [], facet = null } = {}) {
    sync(); if (stopped || status !== 'ready' || pending || !['review', 'override'].includes(mode) || !['agree', 'disagree', 'contextual'].includes(verdict)) return false;
    const previous = entry(document, mode, facetId);
    statementEditor = null;
    editor = { facetId, mode, verdict, claim: clone(claim), values: [...values], note: previous?.note || '', expected: clone(previous), facet: clone(facet) };
    editToken++; message = ''; error = null; emit(); return true;
  }
  function updateDraft({ note, values } = {}) {
    sync(); if (!editor || pending) return false;
    if (typeof note === 'string' && note !== editor.note) { editor.note = note; editor.submission = null; }
    if (Array.isArray(values) && !same(values, editor.values)) { editor.values = [...values]; editor.submission = null; }
    return true;
  }
  function save() {
    sync(); if (!editor || pending) return Promise.resolve(read());
    const draft = clone(editor), expectedEditor = editToken;
    const value = draft.submission || { id: uuid(), facetId: draft.facetId, ...(draft.mode === 'review' ? { verdict: draft.verdict, claim: draft.claim } : { values: draft.values }), note: draft.note, at: new Date(now()).toISOString() };
    editor.submission = clone(value);
    return mutate({ type: draft.mode, value }, draft.expected, expectedEditor);
  }
  // One tap on an answer saves it at once, without an editor: a review of a repeated pattern
  // (agree/disagree/contextual) or a practised topic's answer. The claim and choices are the
  // rendered report's; a changed answer replaces the facet's earlier one.
  function answer({ facetId, verdict = null, value = null, claim = null } = {}) {
    sync(); if (stopped || status !== 'ready' || pending) return Promise.resolve(read());
    const mode = value !== null ? 'override' : 'review';
    if (mode === 'review' && (!['agree', 'disagree', 'contextual'].includes(verdict) || !claim || typeof claim !== 'object')) return Promise.resolve(read());
    if (mode === 'override' && typeof value !== 'string') return Promise.resolve(read());
    const previous = entry(document, mode, facetId);
    const submission = { id: uuid(), facetId, ...(mode === 'review' ? { verdict, claim: clone(claim) } : { values: [value] }), note: '', at: new Date(now()).toISOString() };
    editor = null; statementEditor = null; editToken++;
    return mutate({ type: mode, value: submission }, clone(previous), null, '답을 저장했어요. 내가 고친 내역에서 되돌릴 수 있어요.');
  }
  function remove({ kind, id, facetId } = {}) {
    sync(); if (status !== 'ready' || pending || !['review', 'override'].includes(kind)) return Promise.resolve(read());
    const previous = entry(document, kind, facetId);
    if (!previous || previous.id !== id) { error = 'conflict'; message = '내용이 바뀌었어요. 최신 고친 내역을 살펴봐 주세요.'; emit(); return Promise.resolve(read()); }
    return mutate({ type: 'remove-' + kind, facetId }, clone(previous));
  }
  function describe() {
    sync(); if (stopped || status !== 'ready' || pending) return false;
    editor = null; statementEditor = { text: '', preview: null, previewInput: null, clarifications: [], acceptedIds: [], stage: 'writing', baseline: clone(document) };
    editToken++; message = ''; error = null; emit(); return true;
  }
  function updateStatementDraft({ text, acceptedIds } = {}) {
    sync(); if (!statementEditor || pending) return false;
    let changed = false;
    if (typeof text === 'string' && text !== statementEditor.text) {
      statementEditor.text = [...text].slice(0, 500).join(''); statementEditor.preview = null;
      statementEditor.previewInput = null; statementEditor.clarifications = [];
      statementEditor.acceptedIds = []; statementEditor.stage = 'writing'; statementEditor.submission = null;
      changed = true;
    }
    if (Array.isArray(acceptedIds) && statementEditor.preview) {
      const allowed = new Set(statementEditor.preview.proposals.filter(p => p.confirmable).map(p => p.id));
      const selected = [...new Set(acceptedIds)].filter(id => allowed.has(id));
      if (!same(selected, statementEditor.acceptedIds)) { statementEditor.acceptedIds = selected; statementEditor.submission = null; changed = true; }
    }
    if (changed) emit();
    return true;
  }
  function previewStatement() {
    sync(); if (!statementEditor || pending) return false;
    try {
      const at = new Date(now()).toISOString();
      statementEditor.preview = previewMemberStatement({ text: statementEditor.text, document, at, asOf: at, clarifications: statementEditor.clarifications });
      statementEditor.previewInput = { text: statementEditor.text, at: statementEditor.preview.at, clarifications: clone(statementEditor.clarifications) };
      statementEditor.acceptedIds = []; statementEditor.stage = 'preview'; statementEditor.submission = null;
      error = null; message = '';
    } catch { error = 'interpretation'; message = '해석할 내용을 확인해 주세요. 500자 안에서 현재 원하는 방식을 적어 주세요.'; }
    emit(); return error === null;
  }
  function editStatementText() {
    sync(); if (!statementEditor || pending) return false;
    statementEditor.preview = null; statementEditor.previewInput = null; statementEditor.clarifications = [];
    statementEditor.acceptedIds = []; statementEditor.stage = 'writing'; statementEditor.submission = null;
    error = null; message = ''; emit(); return true;
  }
  function hasCurrentPreview() {
    return statementEditor?.stage === 'preview' && statementEditor.preview
      && same(statementEditor.previewInput, { text: statementEditor.text, at: statementEditor.preview.at, clarifications: statementEditor.clarifications })
      && statementEditor.preview.text === statementEditor.text
      && same(statementEditor.preview.clarifications || [], statementEditor.clarifications);
  }
  function answerStatement({ questionId, optionId } = {}) {
    sync(); if (stopped || pending || !hasCurrentPreview()) return false;
    const question = statementEditor.preview.question;
    if (!question || question.id !== questionId || !question.options.some(option => option.id === optionId)
      || statementEditor.clarifications.some(answer => answer.questionId === questionId)) return false;
    try {
      const clarifications = [...statementEditor.clarifications, { questionId, optionId }];
      const preview = previewMemberStatement({ text: statementEditor.text, document, at: statementEditor.preview.at, asOf: new Date(now()).toISOString(), clarifications });
      statementEditor.clarifications = clarifications; statementEditor.preview = preview;
      statementEditor.previewInput = { text: statementEditor.text, at: preview.at, clarifications: clone(clarifications) };
      statementEditor.acceptedIds = []; statementEditor.submission = null;
      error = null; message = '';
    } catch { error = 'interpretation'; message = '질문과 답을 다시 확인해 주세요. 말을 고치면 질문부터 다시 볼 수 있어요.'; }
    emit(); return error === null;
  }
  function resetStatementAnswers() {
    sync(); if (stopped || pending || !statementEditor) return false;
    statementEditor.clarifications = []; statementEditor.preview = null; statementEditor.previewInput = null;
    statementEditor.acceptedIds = []; statementEditor.submission = null;
    return previewStatement();
  }
  function mutateStatement(action, expected, expectedEditor = null, baseline = null) {
    return enqueue(async (owner, token) => {
      for (let attempt = 0; attempt < 2; attempt++) {
        await load(owner, token); if (!current(owner, token)) throw new Error('changed');
        const targetId = action.type === 'statement' ? action.value.id : action.id;
        const previous = document.statements?.find(row => row.id === targetId) || null;
        const alreadySaved = action.type === 'statement' && same(previous, action.value);
        if (!alreadySaved && !same(previous, expected)) throw conflict();
        // Preserve concurrent statements: never silently supersede a change made
        // after this user opened the interpretation preview.
        if (!alreadySaved && baseline && !same(document.statements || [], baseline.statements || [])) throw conflict();
        if (!alreadySaved) {
          const next = updateMemberUnderstanding(document, action, now());
          try {
            const saved = await call('understandingSave', { state: next, expected_revision: revision }, owner, token);
            if (!current(owner, token)) throw new Error('changed');
            document = saved.document; revision = saved.revision; status = 'ready';
          } catch (failure) {
            if (attempt === 0 && ['REVISION_CONFLICT', 'PERSONAL_REVISION_CONFLICT'].includes(failure.code)) continue;
            throw failure;
          }
        }
        if (expectedEditor !== null && expectedEditor === editToken) statementEditor = null;
        error = null; message = action.type === 'remove-statement' ? '내 말을 되돌렸어요. 원래 연습 기록은 그대로예요.' : '내 말을 저장했어요. 고른 뜻을 이 화면 설명에 써요.';
        return;
      }
    }, true);
  }
  function confirmStatement() {
    sync(); if (!hasCurrentPreview() || pending) return Promise.resolve(read());
    if (statementEditor.preview.question) {
      error = 'interpretation'; message = '추가 질문을 먼저 확인해 주세요. 아직 모르겠다면 건너뛸 수 있어요.'; emit(); return Promise.resolve(read());
    }
    let value;
    try {
      value = statementEditor.submission || confirmMemberStatement({ preview: statementEditor.preview, text: statementEditor.text, clarifications: statementEditor.clarifications, acceptedIds: statementEditor.acceptedIds, id: uuid(), at: new Date(now()).toISOString() });
    } catch { error = 'interpretation'; message = '저장할 뜻을 골라 주세요. 같은 상황의 서로 다른 뜻은 하나만 고를 수 있어요.'; emit(); return Promise.resolve(read()); }
    statementEditor.submission = clone(value);
    return mutateStatement({ type: 'statement', value, replaceId: null }, null, editToken, clone(statementEditor.baseline));
  }
  function removeStatement({ id } = {}) {
    sync(); if (status !== 'ready' || pending) return Promise.resolve(read());
    const previous = document.statements?.find(row => row.id === id);
    if (!previous) return Promise.resolve(read());
    return mutateStatement({ type: 'remove-statement', id }, clone(previous));
  }
  function clear() {
    sync(); if (status !== 'ready' || pending) return Promise.resolve(read());
    const expected = clone(document);
    return enqueue(async (owner, token) => {
      await load(owner, token); if (!current(owner, token)) throw new Error('changed'); if (!same(document, expected)) throw conflict();
      // Delete advances the existing revision even when no correction exists.
      const saved = await call('understandingDelete', { expected_revision: revision, document_version: document.version }, owner, token);
      if (!current(owner, token)) throw new Error('changed');
      document = saved.document; revision = saved.revision; status = 'ready'; editor = null; statementEditor = null; editToken++; error = null; message = '고친 내역을 모두 지웠어요. 원래 이용·연습 기록은 그대로예요.';
    }, true);
  }
  return Object.freeze({ read, begin, updateDraft, save, answer, remove, clear, describe, updateStatementDraft, previewStatement, editStatementText, answerStatement, resetStatementAnswers, confirmStatement, removeStatement,
    refresh: () => enqueue(async (owner, token) => { await load(owner, token); if (!current(owner, token)) throw new Error('changed'); if (!editor && !statementEditor) { message = ''; error = null; } }),
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    cancel() { sync(); if (!pending) { editor = null; statementEditor = null; editToken++; message = ''; error = null; emit(); } },
    hide() { epoch++; binding = ''; document = null; revision = 0; status = 'unavailable'; pending = 0; editor = null; statementEditor = null; editToken++; message = ''; error = null; queue = Promise.resolve(); },
    stop() { stopped = true; epoch++; document = null; editor = null; statementEditor = null; listeners.clear(); },
  });
}
