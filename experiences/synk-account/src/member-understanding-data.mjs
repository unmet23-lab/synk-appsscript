import Contract from '../../../atlas/member-understanding-contract.js';
import Statement from './member-statement-contract.cjs';

// Explicit member confirmations/corrections only. Observed app/learning data and
// the older member-insight document remain independently authorized resources.
export const MEMBER_UNDERSTANDING_LIMITS = Object.freeze({ reviews: 50, overrides: 50, statements: 20, note: 200, maxBytes: 64 * 1024 });
const invalid = () => { throw Object.assign(new TypeError('확인·수정한 성향 정보의 형식을 확인해 주세요.'), { code: 'INVALID_PERSONAL_STATE' }); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const exact = (value, keys) => object(value) && Reflect.ownKeys(value).length === keys.length
  && keys.every(key => Object.hasOwn(value, key) && Object.getOwnPropertyDescriptor(value, key).enumerable
    && Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'));
const list = (value, max) => Array.isArray(value) && value.length <= max && Reflect.ownKeys(value).length === value.length + 1
  && Object.keys(value).length === value.length && Object.keys(value).every((key, index) => key === String(index)
    && Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'));
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
const iso = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const validNote = value => typeof value === 'string' && [...value].length <= MEMBER_UNDERSTANDING_LIMITS.note
  && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]|[\uD800-\uDFFF]/u.test(value);
function clock(value) { if (iso(value)) return Date.parse(value);if (Number.isSafeInteger(value) && Math.abs(value) <= 8640000000000000) return value;invalid(); }
function facet(id) { try { if (!Contract.understandingFacet(id)) invalid(); } catch { invalid(); }return id; }
export function emptyMemberUnderstanding() { return { version: 1, reviews: [], overrides: [] }; }
const emptyFor = version => version >= 2 ? { version, reviews: [], overrides: [], statements: [] } : emptyMemberUnderstanding();

export function validateMemberUnderstanding(value, { now = Date.now(), enforceTime = false } = {}) {
  const version = object(value) && Object.getOwnPropertyDescriptor(value, 'version')?.value;
  if (![1, 2, 3, 4, 5, 6, 7, 8, 9, 10].includes(version) || !exact(value, version >= 2 ? ['version', 'reviews', 'overrides', 'statements'] : ['version', 'reviews', 'overrides'])
    || !list(value.reviews, MEMBER_UNDERSTANDING_LIMITS.reviews) || !list(value.overrides, MEMBER_UNDERSTANDING_LIMITS.overrides)
    || version >= 2 && !list(value.statements, MEMBER_UNDERSTANDING_LIMITS.statements)) invalid();
  const ids = new Set(), cutoff = enforceTime ? clock(now) : null;
  const rows = (items, kind) => {
    const facets = new Set();
    return items.map(row => {
      const fields = kind === 'review' ? ['id', 'facetId', 'verdict', 'claim', 'note', 'at'] : ['id', 'facetId', 'values', 'note', 'at'];
      if (!exact(row, fields) || !uuid(row.id) || ids.has(row.id.toLowerCase()) || !iso(row.at)
        || enforceTime && Date.parse(row.at) > cutoff || !validNote(row.note) || facets.has(row.facetId)) invalid();
      facet(row.facetId);ids.add(row.id.toLowerCase());facets.add(row.facetId);
      let checked;
      try {
        if (kind === 'review') {
          if (!['agree', 'disagree', 'contextual'].includes(row.verdict)) invalid();
          const claim = Contract.validateUnderstandingClaim(row.claim, { facetId: row.facetId });
          // A review cannot predate the bounded evidence it explicitly reviews.
          if (Date.parse(claim.to) > Date.parse(row.at)) invalid();
          checked = { verdict: row.verdict, claim };
        } else {
          if (!list(row.values, 5)) invalid();
          checked = { values: Contract.validateUnderstandingValues(row.facetId, row.values) };
        }
      } catch { invalid(); }
      // Notes are preserved literally for escaped display only. They never
      // become a rule, inferred topic, original observation, or LLM instruction.
      return { id: row.id.toLowerCase(), facetId: row.facetId, ...checked, note: row.note, at: row.at };
    });
  };
  const result = { version, reviews: rows(value.reviews, 'review'), overrides: rows(value.overrides, 'override') };
  if (version >= 2) result.statements = value.statements.map(row => {
    let checked;try { checked = Statement.validateMemberStatement(row, { now, enforceTime }); } catch { invalid(); }
    if (version === 2 && checked.parserVersion !== 'member-statement-ko-1') invalid();
    if (version === 3 && !['member-statement-ko-1', 'member-statement-ko-2'].includes(checked.parserVersion)) invalid();
    if (version === 4 && !['member-statement-ko-1', 'member-statement-ko-2', 'member-statement-ko-3'].includes(checked.parserVersion)) invalid();
    if (version === 5 && !['member-statement-ko-1', 'member-statement-ko-2', 'member-statement-ko-3', 'member-statement-ko-4'].includes(checked.parserVersion)) invalid();
    if (version === 6 && !['member-statement-ko-1', 'member-statement-ko-2', 'member-statement-ko-3', 'member-statement-ko-4', 'member-statement-ko-5'].includes(checked.parserVersion)) invalid();
    if (version === 7 && !['member-statement-ko-1', 'member-statement-ko-2', 'member-statement-ko-3', 'member-statement-ko-4', 'member-statement-ko-5', 'member-statement-ko-6'].includes(checked.parserVersion)) invalid();
    if (version === 8 && !['member-statement-ko-1', 'member-statement-ko-2', 'member-statement-ko-3', 'member-statement-ko-4', 'member-statement-ko-5', 'member-statement-ko-6', 'member-statement-ko-7'].includes(checked.parserVersion)) invalid();
    if (version === 9 && !['member-statement-ko-1', 'member-statement-ko-2', 'member-statement-ko-3', 'member-statement-ko-4', 'member-statement-ko-5', 'member-statement-ko-6', 'member-statement-ko-7', 'member-statement-ko-8'].includes(checked.parserVersion)) invalid();
    if (!uuid(checked.id) || ids.has(checked.id.toLowerCase())) invalid();
    ids.add(checked.id.toLowerCase());return { ...checked, id: checked.id.toLowerCase() };
  });
  if (new TextEncoder().encode(JSON.stringify(result)).length > MEMBER_UNDERSTANDING_LIMITS.maxBytes) invalid();
  return result;
}

export function updateMemberUnderstanding(value, action, now = Date.now()) {
  const current = validateMemberUnderstanding(value);
  if (!object(action)) invalid();
  if (action.type === 'clear') { if (!exact(action, ['type'])) invalid();return emptyFor(current.version); }
  if (action.type === 'remove-statement') {
    if (!exact(action, ['type', 'id']) || !uuid(action.id)) invalid();
    return current.version >= 2 ? { ...current, statements: current.statements.filter(row => row.id !== action.id.toLowerCase()) } : current;
  }
  if (action.type === 'statement') {
    if (!exact(action, ['type', 'value', 'replaceId']) || action.replaceId !== null && !uuid(action.replaceId)) invalid();
    const row = validateMemberUnderstanding({ ...emptyFor(10), statements: [action.value] }, { now, enforceTime: true }).statements[0];
    const replaceId = action.replaceId?.toLowerCase() || null, statements = current.statements || [];
    if (replaceId === row.id) invalid();
    const existing = [...current.reviews, ...current.overrides, ...statements].find(item => item.id === row.id);
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(row) || replaceId && statements.some(item => item.id === replaceId)) invalid();
      return current;
    }
    if (replaceId && !statements.some(item => item.id === replaceId)) invalid();
    const version = Math.max(current.version, { 'member-statement-ko-1': 2, 'member-statement-ko-2': 3, 'member-statement-ko-3': 4, 'member-statement-ko-4': 5, 'member-statement-ko-5': 6, 'member-statement-ko-6': 7, 'member-statement-ko-7': 8, 'member-statement-ko-8': 9, 'member-statement-ko-9': 10 }[row.parserVersion]);
    return validateMemberUnderstanding({ ...current, version, statements: [...statements.filter(item => item.id !== replaceId), row]
      .sort((a, b) => a.confirmedAt.localeCompare(b.confirmedAt) || a.id.localeCompare(b.id, 'en')) }, { now, enforceTime: true });
  }
  if (['remove-review', 'remove-override'].includes(action.type)) {
    if (!exact(action, ['type', 'facetId'])) invalid();facet(action.facetId);
    const key = action.type === 'remove-review' ? 'reviews' : 'overrides';
    return { ...current, [key]: current[key].filter(row => row.facetId !== action.facetId) };
  }
  if (!['review', 'override'].includes(action.type) || !exact(action, ['type', 'value'])) invalid();
  const key = action.type === 'review' ? 'reviews' : 'overrides';
  const row = validateMemberUnderstanding({ ...emptyMemberUnderstanding(), [key]: [action.value] }, { now, enforceTime: true })[key][0];
  const existing = [...current.reviews, ...current.overrides].find(item => item.id === row.id);
  if (existing) { if (JSON.stringify(existing) !== JSON.stringify(row)) invalid();return current; }
  return validateMemberUnderstanding({ ...current, [key]: [...current[key].filter(item => item.facetId !== row.facetId), row]
    .sort((a, b) => a.facetId.localeCompare(b.facetId, 'en')) }, { now, enforceTime: true });
}
