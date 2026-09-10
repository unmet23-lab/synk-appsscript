const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', '엔진_계정점검.js'), 'utf8');
function harness(options = {}) {
  const reads = [];
  const no = () => { throw new Error('unexpected_write_or_external_call'); };
  const expected = ['morningJobs', 'onHwFeedbackEdit'];
  const ctx = {
    ADMIN_EMAIL: 'owner@example.test',
    Session: { getActiveUser: () => ({ getEmail: () => options.denied ? '' : 'owner@example.test' }), getEffectiveUser: () => ({ getEmail: () => 'owner@example.test' }) },
    PropertiesService: { getScriptProperties: () => ({
      getProperty(key) { reads.push(key); if (key === 'CLAUDE_API_KEY') throw new Error('no key reads'); return Object.hasOwn(options.props || {}, key) ? options.props[key] : null; },
      setProperty: no, deleteProperty: no
    }) },
    SpreadsheetApp: { getActiveSpreadsheet() {
      reads.push('sheet_metadata');
      if (options.sheetError) throw new Error('private_sheet_error');
      return { getSheetByName(name) { assert.equal(name, 'profiles'); return {
        getLastColumn: () => 2,
        getRange(row, col, height, width) {
          assert.deepEqual([row, col, height, width], [1, 1, 1, 2]);
          return { getValues: () => [['user_id', options.textbook ? '목소리폼URL' : 'status']] };
        }
      }; } };
    } },
    ScriptApp: { getProjectTriggers() { reads.push('triggers'); return (options.triggers || [['morningJobs', 'CLOCK'], ['onHwFeedbackEdit', 'ON_EDIT']]).map(([name, type]) => ({ getHandlerFunction: () => name, getEventType: () => type })); }, newTrigger: no, deleteTrigger: no },
    triggerManifest_: textbook => textbook ? [...expected, '교재연동Nightly'] : expected,
    배치상태요약_: state => state,
    monthlyDeliveryHealth_: () => options.monthly || ({ cards: { month: '2026-09', counts: { pending: 0, sending: 0, sent: 0, uncertain: 0, legacy_unknown: 0 } }, report: { month: '2026-08', status: 'missing' } }),
    UrlFetchApp: { fetch: no }, MailApp: { sendEmail: no }
  };
  vm.createContext(ctx); vm.runInContext(source, ctx);
  return { reads, run: () => JSON.parse(JSON.stringify(ctx.automationHealthCheck())) };
}
test('denied before any metadata or progress read', () => {
  const h = harness({ denied: true }); assert.deepEqual(h.run(), { ok: false, stage: 'access' }); assert.deepEqual(h.reads, []);
});
test('read-only trigger health does not claim business execution success', () => {
  const h = harness(); const r = h.run(); assert.equal(r.ok, true); assert.equal(r.stage, 'read_only');
  assert.deepEqual(r.batches, { morningJobs: { status: 'not_observed' }, nightJobs: { status: 'not_observed' }, parentSweep: { status: 'not_observed' } });
  assert.equal(r.observationComplete, false); assert.equal(r.monthly.report.status, 'missing'); assert.equal(h.reads.includes('CLAUDE_API_KEY'), false);
});
test('missing, duplicate, wrong event type and private unknown names are distinguished', () => {
  const r = harness({ textbook: true, triggers: [['morningJobs', 'CLOCK'], ['morningJobs', 'ON_EDIT'], ['PRIVATE_unknown', 'CLOCK']] }).run();
  assert.equal(r.ok, false); assert.deepEqual(r.triggers.missing, ['onHwFeedbackEdit', '교재연동Nightly']);
  assert.deepEqual(r.triggers.duplicates, ['morningJobs']); assert.equal(r.triggers.wrongTypeCount, 1);
  assert.equal(r.triggers.otherCount, 1); assert.ok(!JSON.stringify(r).includes('PRIVATE'));
});
test('rehearsal presence is reported without deleting even an expired value', () => {
  const r = harness({ props: { 배치리허설_만료: '' } }).run(); assert.equal(r.rehearsalPresent, true); assert.equal(r.ok, false);
});
test('only approved counts, states and date syntax leave progress properties', () => {
  const props = {
    배치진행_morningJobs: JSON.stringify({ name: 'PRIVATE', status: 'partial', next: 2, total: 8, failures: ['PRIVATE_stage'], stage: 'PRIVATE', date: '2026-09-11', updatedAt: 'PRIVATE', lease: 'PRIVATE' }),
    배치진행_nightJobs: 'PRIVATE-not-json',
    배치진행_parentSweep: JSON.stringify({ status: 'PRIVATE', next: -1, total: '9', date: 'PRIVATE', failures: null })
  };
  const r = harness({ props }).run(); assert.ok(!JSON.stringify(r).includes('PRIVATE'));
  assert.deepEqual(r.batches.morningJobs, { status: 'partial', next: 2, total: 8, failureCount: 1, date: '2026-09-11' });
  assert.deepEqual(r.batches.nightJobs, { status: 'invalid_state' });
  assert.deepEqual(r.batches.parentSweep, { status: 'invalid_state', failureCount: 0 });
  assert.equal(r.ok, false);
});
test('monthly health passes only approved aggregate counts and months', () => {
  const monthly = { cards: { month: '2026-09', private: 'PRIVATE', counts: { pending: 2, sending: 0, sent: 4, uncertain: 1, legacy_unknown: 3, private: 'PRIVATE' } }, report: { month: '2026-08', status: 'pending', body: 'PRIVATE' } };
  const r = harness({ monthly }).run(); assert.ok(!JSON.stringify(r).includes('PRIVATE')); assert.equal(r.monthly.cards.counts.pending, 2);
  monthly.cards.counts.pending = -1;
  const bad = harness({ monthly }).run(); assert.equal(bad.ok, false); assert.deepEqual(bad.monthly, { status: 'unavailable' });
});
test('numeric batch revision is retained for owner compare-and-set recovery without raw internal fields', () => {
  const r = harness({ props: { 배치진행_morningJobs: JSON.stringify({ status: 'uncertain', updatedAt: 1789077000000, startedAt: 1789076000000, next: 1, total: 9 }) } }).run();
  assert.equal(r.ok, false); assert.equal(r.batches.morningJobs.revision, 1789077000000);
  assert.equal(r.batches.morningJobs.updatedAt, new Date(1789077000000).toISOString());
});
test('spreadsheet metadata failure is not treated as a healthy disabled textbook feature', () => {
  const r = harness({ sheetError: true }).run(); assert.equal(r.ok, false); assert.equal(r.stage, 'metadata'); assert.equal(r.triggers, null); assert.ok(!JSON.stringify(r).includes('private'));
});
