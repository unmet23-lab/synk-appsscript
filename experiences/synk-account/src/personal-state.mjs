// JSON boundary shared by every synk-personal resource. A screen imports only its
// own resource check; personal-data.mjs joins every product validator for the
// account server, which bundles that module whole.
export const fail = (code, message) => { throw Object.assign(new TypeError(message), { code }); };
export const invalid = () => fail('PERSONAL_DATA_INVALID', '저장할 개인 기록의 형식을 확인해 주세요.');
const encoder = new TextEncoder();

// Reject JS values that JSON would silently omit or transform before applying
// the canonical product validators. HTTP callers pass ordinary parsed JSON.
export function jsonCopy(value, maxBytes) {
  const ancestors = new Set();
  let nodes = 0;
  function visit(item, depth) {
    if (++nodes > 200000 || depth > 32) invalid();
    if (typeof item === 'string') { if (/\u0000|[\uD800-\uDFFF]/u.test(item)) invalid(); return; }
    if (item === null || typeof item === 'boolean') return;
    if (typeof item === 'number') { if (!Number.isFinite(item)) invalid(); return; }
    if (typeof item !== 'object' || ancestors.has(item)) invalid();
    const prototype = Object.getPrototypeOf(item);
    if (!Array.isArray(item) && prototype !== Object.prototype && prototype !== null) invalid();
    ancestors.add(item);
    for (const key of Reflect.ownKeys(item)) {
      if (Array.isArray(item) && key === 'length') continue;
      const descriptor = Object.getOwnPropertyDescriptor(item, key);
      if (typeof key !== 'string' || /\u0000|[\uD800-\uDFFF]/u.test(key) || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) invalid();
      if (Array.isArray(item) && !/^(0|[1-9]\d*)$/.test(key)) invalid();
      visit(descriptor.value, depth + 1);
    }
    if (Array.isArray(item) && Object.keys(item).length !== item.length) invalid();
    ancestors.delete(item);
  }
  visit(value, 0);
  const serialized = JSON.stringify(value);
  if (encoder.encode(serialized).length > maxBytes) fail('PERSONAL_DATA_TOO_LARGE', '저장할 개인 기록이 허용 크기를 넘었어요.');
  return JSON.parse(serialized);
}

/** One resource's check: a JSON copy within its byte limit, then its product
 * validator. Coded product errors pass through; others become PERSONAL_DATA_INVALID. */
export function checkPersonalState(value, maxBytes, validate) {
  const copy = jsonCopy(value, maxBytes);
  try { return validate(copy); }
  catch (error) { if (error.code) throw error; invalid(); }
}
