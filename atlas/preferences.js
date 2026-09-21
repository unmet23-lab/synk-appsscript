/* Explicit, separately scoped LAB help preferences.
 * Pure c16 ledger <-> kernel mapping. Authentication, consent, ordering, storage,
 * and the client clock belong to callers. Never persist a whole kernel session here.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SynkAtlasPreferences = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MEMORY_VERSION = 'atlas-memory-1';
  const EXPERIENCE_ID = 'letter';
  const DIMENSION = 'atlas.letter.support';
  const EXPERIENCES = Object.freeze({ letter: DIMENSION, documents: 'atlas.documents.support' });
  const WORKSPACES = Object.freeze({ 'professor-letter': 'letter', 'document-gate': 'documents' });
  const SURFACE = 'atlas_settings';
  const RESET = 'default';
  const SUPPORT = Object.freeze(['choose', 'step', 'independent']);
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const ID = /^[a-zA-Z0-9_.:-]{1,120}$/;
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const fail = field => { throw new TypeError(`Atlas memory: invalid ${field}`); };
  const uuid = (value, field) => typeof value === 'string' && UUID.test(value) ? value.toLowerCase() : fail(field);
  function dimensionFor(experienceId = EXPERIENCE_ID) {
    return own(EXPERIENCES, experienceId) ? EXPERIENCES[experienceId] : fail('experience');
  }
  function experienceForWorkspace(workspace) {
    return own(WORKSPACES, workspace) ? WORKSPACES[workspace] : fail('workspace');
  }
  // ISO timestamps must include a timezone. Reject calendar rollover rather than
  // accepting Date.parse's normalization of dates such as February 30.
  function timestamp(value, field) {
    if (typeof value !== 'string') return fail(field);
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
    if (!match) return fail(field);
    const [, year, month, day, hour, minute, second, , zone] = match;
    const y = Number(year), m = Number(month), d = Number(day);
    const days = [31, y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (m < 1 || m > 12 || d < 1 || d > days[m - 1] || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return fail(field);
    if (zone !== 'Z' && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4)) > 59)) return fail(field);
    const milliseconds = Date.parse(value);
    if (!Number.isFinite(milliseconds)) return fail(field);
    return new Date(milliseconds).toISOString();
  }
  // Detect the reserved namespace even on an invalid event type, so callers can
  // reject malformed Atlas input instead of passing it to generic preferences.
  function isAtlasPreference(event) {
    return object(event) && object(event.payload) && typeof event.payload.preference_dimension === 'string'
      && event.payload.preference_dimension.startsWith('atlas.');
  }
  // c16 common-envelope validation remains the existing event validator's job.
  // This validator is also used with a server row projection that has no envelope.
  function validatePreference(event) {
    if (!object(event) || event.event_type !== 'preference.stated') return { ok: false, error: 'invalid_event_type' };
    const payload = event.payload;
    if (!object(payload) || payload.ver !== 1) return { ok: false, error: 'invalid_payload_version' };
    if (!Object.values(EXPERIENCES).includes(payload.preference_dimension)) return { ok: false, error: 'invalid_preference_dimension' };
    if (payload.stated_via !== SURFACE) return { ok: false, error: 'invalid_preference_surface' };
    if (![...SUPPORT, RESET].includes(payload.stated_option)) return { ok: false, error: 'invalid_preference_option' };
    const fields = ['ver', 'preference_dimension', 'stated_option', 'stated_via'];
    if (Object.keys(payload).some(key => !fields.includes(key)) || fields.some(key => !own(payload, key))) return { ok: false, error: 'invalid_payload_fields' };
    return { ok: true };
  }
  function preferenceEvent(support, options = {}) {
    if (support !== null && !SUPPORT.includes(support)) return fail('support');
    if (!object(options)) return fail('event options');
    const dimension = dimensionFor(options.experienceId);
    return {
      idempotency_key: uuid(options.id, 'id'),
      event_type: 'preference.stated',
      occurred_at: timestamp(options.at, 'at'),
      level_snapshot: null,
      correlation_id: uuid(options.correlationId, 'correlationId'),
      payload: { ver: 1, preference_dimension: dimension, stated_option: support === null ? RESET : support, stated_via: SURFACE },
    };
  }
  function validateSnapshot(snapshot, experienceId = EXPERIENCE_ID) {
    dimensionFor(experienceId);
    if (!object(snapshot) || snapshot.memory_ver !== MEMORY_VERSION) return fail('memory version');
    if (snapshot.experience_id !== experienceId) return fail('experience');
    if (!own(snapshot, 'revision') || !own(snapshot, 'support') || !own(snapshot, 'updated_at')) return fail('snapshot fields');
    if (snapshot.support !== null && !SUPPORT.includes(snapshot.support)) return fail('support');
    if (snapshot.revision === null) {
      if (snapshot.support !== null || snapshot.updated_at !== null) return fail('empty snapshot');
      return { memory_ver: MEMORY_VERSION, experience_id: experienceId, revision: null, support: null, updated_at: null };
    }
    return {
      memory_ver: MEMORY_VERSION,
      experience_id: experienceId,
      revision: uuid(snapshot.revision, 'revision'),
      support: snapshot.support,
      updated_at: timestamp(snapshot.updated_at, 'updated_at'),
    };
  }
  function snapshotFromRow(row, experienceId = EXPERIENCE_ID) {
    const dimension = dimensionFor(experienceId);
    if (row === null) return validateSnapshot({ memory_ver: MEMORY_VERSION, experience_id: experienceId, revision: null, support: null, updated_at: null }, experienceId);
    const result = validatePreference(row);
    if (!result.ok) return fail(result.error);
    if (row.payload.preference_dimension !== dimension) return fail('experience');
    // PostgreSQL drivers may return timestamptz as a Date. Accept that only at
    // this server-row boundary; public snapshots still require ISO strings.
    let ingestedAt = row.ingested_at;
    if (typeof ingestedAt !== 'string') {
      let milliseconds;
      try { milliseconds = Date.prototype.getTime.call(ingestedAt); }
      catch { return fail('ingested_at'); }
      if (!Number.isFinite(milliseconds)) return fail('ingested_at');
      ingestedAt = new Date(milliseconds).toISOString();
    }
    return validateSnapshot({
      memory_ver: MEMORY_VERSION,
      experience_id: experienceId,
      revision: row.event_id,
      support: row.payload.stated_option === RESET ? null : row.payload.stated_option,
      updated_at: ingestedAt,
    }, experienceId);
  }
  function kernelEvents(snapshot, scope) {
    const memory = validateSnapshot(snapshot, snapshot?.experience_id);
    if (!object(scope) || scope.domain !== 'LAB' || typeof scope.workspace !== 'string' || !ID.test(scope.workspace)
      || typeof scope.subject !== 'string' || !ID.test(scope.subject)) return fail('scope');
    if (memory.revision === null) return [];
    // Only the server-confirmed ingestion time orders this projection. An explicit
    // reset stays as a null declaration; dropping it could revive an older choice.
    return [{
      schema: 1,
      scope: { domain: scope.domain, workspace: scope.workspace, subject: scope.subject },
      id: `memory.${memory.revision}`,
      type: 'context.set',
      field: 'support',
      value: memory.support,
      until: null,
      at: memory.updated_at,
      recordedAt: memory.updated_at,
    }];
  }
  return Object.freeze({ MEMORY_VERSION, EXPERIENCE_ID, DIMENSION, EXPERIENCES, dimensionFor, experienceForWorkspace, SURFACE, RESET, isAtlasPreference, validatePreference, preferenceEvent, snapshotFromRow, validateSnapshot, kernelEvents });
});
