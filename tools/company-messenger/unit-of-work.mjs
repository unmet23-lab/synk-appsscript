// A synchronous database transaction and its publications share one lifetime.
// Nested services join the current transaction; only its owner commits and flushes.
export function createUnitOfWork(transaction) {
  let active = null;
  function runSync(work, scope) {
    const value = work(scope);
    if (value && typeof value.then === 'function') throw new TypeError('Database work must be synchronous');
    return value;
  }
  function run(work, { onPublishError } = {}) {
    if (active) return runSync(work, active);
    const effects = [];
    const scope = Object.freeze({ afterCommit(effect) {
      if (typeof effect !== 'function') throw new TypeError('afterCommit requires a function');
      effects.push(effect);
    } });
    let result;
    try {
      active = scope;
      result = transaction(() => runSync(work, scope));
    } finally { active = null; }
    for (const effect of effects) {
      try { effect(); } catch (error) { if (!onPublishError) throw error; onPublishError(error); }
    }
    return result;
  }
  return Object.freeze({ run });
}
