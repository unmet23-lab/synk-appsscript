// Help style and explanation length, changed from 「내 성향」 and saved where every SYNK app reads
// them: the account's learning memory (synk-learning ?view=memory, the `presentation` entry WORLD
// and the games follow; atlas/memory-sync.js on devices). This screen keeps no copy of its own.
// The host owns identity and the transport (memoryGet/memoryPost); the learning revision and
// connection come from the Atlas summary the screen already shows.
const FIELDS = Object.freeze({ support: Object.freeze(['step', 'choose', 'independent']), explanation: Object.freeze(['brief', 'standard', 'detailed']) });
// The server's presentation vocabulary (SYNK-talk lib/atlas-memory-rules.js). Other fields of the
// entry are kept exactly as they are.
const PRESENTATION = Object.freeze({ support: FIELDS.support, textSize: ['standard', 'large'], explanation: FIELDS.explanation, motion: ['full', 'reduced'], audio: ['off', 'available'] });
// The server leaves out entries dated more than a day ahead of its clock. Its replies do not say that
// clock today, so this device's clock stands in, as in atlas/memory-sync.js; a reply that does name
// it (`serverTime`) is used instead.
const AHEAD_MS = 86400000;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const instant = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const failure = code => Object.assign(new Error(code), { code });
const known = value => Object.fromEntries(Object.entries(record(value) ? value : {}).filter(([field, choice]) => Object.hasOwn(PRESENTATION, field) && PRESENTATION[field].includes(choice)));
const same = (a, b) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());
const MESSAGES = Object.freeze({
  saved: '저장했어요. WORLD 연습도 이 방식을 써요.',
  unchanged: '이미 이 방식으로 저장돼 있어요.',
  FEATURE_DISABLED: '지금은 여기서 바꿀 수 없어요. WORLD 학습 목표에서 바꿔 주세요.',
  LEARNING_DISABLED: '학습 기록 연결이 꺼져 있어 저장하지 못했어요. 계정에서 연결을 켜면 여기서 바꿀 수 있어요.',
  REVISION_CONFLICT: '계정의 학습 연결이 바뀌었어요. 새로 불러온 뒤 다시 골라 주세요.',
  MEMORY_CONFLICT: '다른 곳에서 방금 바꿨어요. 새로 불러온 내용을 확인한 뒤 다시 골라 주세요.',
  MEMORY_CLOCK_AHEAD: '계정에 저장된 시각이 맞지 않아 저장하지 못했어요. 잠시 뒤 다시 해 주세요.',
  DEVICE_CLOCK: '이 기기의 시각이 맞지 않아 저장하지 못했어요. 기기 시각을 확인한 뒤 다시 해 주세요.',
  failed: '저장하지 못했어요. 고른 내용은 그대로 있으니 다시 해 주세요.',
});

export function createMemberSettings({ getIdentity, request, now = Date.now, timeoutMs = 12000 } = {}) {
  let binding = '', epoch = 0, editor = null, pending = false, message = '', error = null, refused = false;
  const listeners = new Set();
  const identity = () => { const value = getIdentity?.() || {}; return { ...value, accountId: value.accountId || value.account?.synk_user_id }; };
  const key = value => JSON.stringify([value.status, value.signedIn, value.accountId, value.sessionGeneration]);
  const signed = value => value.status === 'signed-in' && value.signedIn === true && typeof value.accountId === 'string' && !!value.accountId;
  function sync() {
    const owner = identity(), next = key(owner);
    if (next !== binding) { binding = next; epoch++; editor = null; pending = false; message = ''; error = null; refused = false; }
    return owner;
  }
  // The account's release policy (capabilities.learningSync) decides whether learning memory can
  // be written at all; a refusal seen here also closes it for this session.
  const writable = () => { const owner = sync(); return signed(owner) && owner.learningSync === true && !refused; };
  function read() { const open = writable(); return { editor: editor ? { ...editor } : null, pending, message, error, writable: open }; }
  function emit() { const value = read(); for (const listener of listeners) listener(value); }
  async function call(operation, params, owner, token) {
    let timer;
    const current = () => token === epoch && owner === key(identity());
    try {
      const raw = await Promise.race([
        Promise.resolve().then(() => { if (!current()) throw failure('changed'); return request(operation, params); }),
        new Promise((_, reject) => { timer = setTimeout(() => reject(failure('timeout')), timeoutMs); }),
      ]);
      if (!current()) throw failure('changed');
      const result = raw?.data || raw;
      if (raw?.ok === false || result?.ok === false) throw failure((raw?.error || result?.error)?.code || 'failed');
      if (result?.ok !== true || result.revision !== params.revision || !Array.isArray(result.entries)) throw failure('failed');
      return result;
    } finally { clearTimeout(timer); }
  }
  function begin({ field, value = null } = {}) {
    sync();
    if (pending || !writable() || !Object.hasOwn(FIELDS, field) || value !== null && !FIELDS[field].includes(value)) return false;
    editor = { field, value }; message = ''; error = null; emit(); return true;
  }
  function choose(value) {
    sync();
    if (!editor || pending || !FIELDS[editor.field].includes(value)) return false;
    editor = { ...editor, value }; return true;
  }
  function cancel() { sync(); if (!pending) { editor = null; message = ''; error = null; emit(); } }
  // `context` comes from the summary on screen: { revision, enabled, shared }.
  async function save(context = {}) {
    sync();
    if (!editor || pending || editor.value === null) return read();
    const { field, value } = editor, token = epoch, ownerKey = binding;
    if (!writable() || context.enabled !== true || context.shared !== 'practice-and-settings' || !Number.isSafeInteger(context.revision) || context.revision < 1) {
      error = 'LEARNING_DISABLED'; message = MESSAGES.LEARNING_DISABLED; emit(); return read();
    }
    pending = true; message = ''; error = null; emit();
    let outcome = 'saved';
    try {
      const revision = context.revision;
      const held = await call('memoryGet', { revision }, ownerKey, token);
      const current = held.entries.find(entry => entry?.kind === 'presentation' && entry.key === 'chosen') || null;
      const base = known(current?.value), next = { ...base, [field]: value };
      if (same(base, next)) outcome = 'unchanged';
      else {
        // One time for this choice: after the clock (the server's when it says it) and after the
        // value the server holds now, so this newer choice wins there.
        const clock = instant(held.serverTime) ? Date.parse(held.serverTime) : now();
        const at = new Date(Math.max(clock, (instant(current?.at) ? Date.parse(current.at) : 0) + 1)).toISOString();
        if (Date.parse(at) > clock + AHEAD_MS) throw failure('MEMORY_CLOCK_AHEAD');
        const sent = { kind: 'presentation', key: 'chosen', value: next, at };
        const result = await call('memoryPost', { revision, entries: [sent] }, ownerKey, token);
        const kept = result.entries.find(entry => entry?.kind === 'presentation' && entry.key === 'chosen');
        // No entry back means the server left this one out: this device's clock is more than a day
        // ahead of the server's. Nothing was written.
        if (!kept || !instant(kept.at)) throw failure(instant(held.serverTime) ? 'failed' : 'DEVICE_CLOCK');
        // The server keeps the newer entry. Another device's newer choice is shown, never overwritten.
        if (Date.parse(kept.at) > Date.parse(at) && !same(known(kept.value), next)) throw failure('MEMORY_CONFLICT');
      }
      if (token !== epoch) return read();
      editor = null; error = null; message = MESSAGES[outcome];
    } catch (cause) {
      if (token !== epoch || cause?.code === 'changed') return read();
      const code = Object.hasOwn(MESSAGES, cause?.code) ? cause.code : 'failed';
      if (code === 'FEATURE_DISABLED') refused = true;
      error = code; message = MESSAGES[code];
    } finally {
      if (token === epoch) { pending = false; emit(); }
    }
    return read();
  }
  return Object.freeze({ read, begin, choose, cancel, save, writable,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    hide() { epoch++; binding = ''; editor = null; pending = false; message = ''; error = null; },
    stop() { epoch++; editor = null; listeners.clear(); } });
}
export const MEMBER_SETTING_FIELDS = FIELDS;
