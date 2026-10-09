import { createRequire } from 'node:module';
import { hash } from './store.mjs';

const require = createRequire(import.meta.url), KIND = 'customerComputerDrafts';
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
let catalog;
function documentValue(value) {
  if (!plain(value) || Object.keys(value).some(key => !['version', 'text', 'answers'].includes(key))
    || value.version !== 1 || typeof value.text !== 'string' || value.text.length > 4000 || !plain(value.answers)) throw fail('저장할 상담 내용의 형식을 확인해 주세요.');
  // Read the product's own option catalog lazily, after the model runtime has
  // attested its imports. Only confirmed form values belong in this document.
  if (!catalog) {
    catalog = new Map();
    for (const step of require('../../../맞춤도구/computer/content.js').steps) {
      for (const field of step.type === 'group' ? step.fields : [step]) {
        catalog.set(step.type === 'group' ? `${step.id}.${field.id}` : step.id,
          { multiple: field.type === 'multi', options: field.options.map(option => option.id) });
      }
    }
  }
  const answers = {};
  for (const [key, answer] of Object.entries(value.answers)) {
    const field = catalog.get(key);
    // The browser always includes uses: [] while no use has been selected.
    // Preserve that draft state without accepting empty detail answers.
    if (!field || (field.multiple ? !Array.isArray(answer) || (answer.length === 0 && key !== 'uses') || new Set(answer).size !== answer.length || answer.some(item => !field.options.includes(item)) : !field.options.includes(answer))) throw fail('확인한 상담 조건만 저장할 수 있어요.');
    answers[key] = Array.isArray(answer) ? [...answer] : answer;
  }
  return { version: 1, text: value.text, answers };
}

export function createCustomerComputerDraft({ store, authorized, clock = () => new Date().toISOString() }) {
  const key = user => { if (!authorized(user)) throw fail('SYNK ID로 다시 로그인해 주세요.', 401); return hash('customer-computer:' + user.id); };
  const result = row => row ? { revision: row.revision, updatedAt: row.updatedAt, status: row.status,
    ...(row.status === 'active' ? { document: store.decrypt(row.documentCiphertext) } : {}) } : { revision: 0, updatedAt: null, status: 'empty' };
  const get = user => result(store.get(KIND, key(user)));
  function mutate(user, input, removing) {
    const id = key(user), allowed = removing ? ['baseRevision'] : ['baseRevision', 'document'];
    if (!plain(input) || Object.keys(input).some(name => !allowed.includes(name)) || !Number.isSafeInteger(input.baseRevision) || input.baseRevision < 0) throw fail('저장 버전을 확인해 주세요.');
    const document = removing ? null : documentValue(input.document);
    return store.transaction(() => {
      key(user);
      const previous = store.get(KIND, id), revision = previous?.revision || 0;
      if (input.baseRevision !== revision) throw fail('다른 기기에서 상담이 변경됐어요. 최신 내용을 불러온 뒤 저장해 주세요.', 409);
      if (revision >= Number.MAX_SAFE_INTEGER) throw fail('저장 버전을 확인해야 해요.', 503);
      const updatedAt = new Date(clock()).toISOString();
      return result(store.put(KIND, id, { id, revision: revision + 1, updatedAt, status: removing ? 'deleted' : 'active',
        ...(removing ? {} : { documentCiphertext: store.encrypt(document) }) }));
    });
  }
  return { get, save: (user, input) => mutate(user, input, false), remove: (user, input) => mutate(user, input, true) };
}
