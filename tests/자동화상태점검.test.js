const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', '엔진_계정점검.js'), 'utf8');
const formSource = fs.readFileSync(path.join(__dirname, '..', '엔진_폼리포트.js'), 'utf8');
const monthlyStart = formSource.indexOf('function monthlyDeliveryHealth_(');
const monthlyEnd = formSource.indexOf('\nfunction resolveMonthlyDelivery(', monthlyStart);
assert.ok(monthlyStart >= 0 && monthlyEnd > monthlyStart);
const monthlySource = formSource.slice(monthlyStart, monthlyEnd);
const engineId = 'SYNTHETIC_engine-spreadsheet_20260911';
function harness(options = {}) {
  const reads = [];
  const forbidden = [];
  const no = () => { forbidden.push('unexpected_write_or_external_call'); throw new Error('unexpected_write_or_external_call'); };
  const expected = ['morningJobs', 'onHwFeedbackEdit'];
  const sheet = { getSheetByName(name) { assert.equal(name, 'profiles'); return {
    getLastColumn: () => 2,
    getRange(row, col, height, width) {
      assert.deepEqual([row, col, height, width], [1, 1, 1, 2]);
      return { getValues: () => [['user_id', options.textbook ? '목소리폼URL' : 'status']], setValues: no };
    }
  }; }, insertSheet: no };
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
      return options.noActiveSheet ? null : sheet;
    }, openById(id) {
      reads.push('open_engine_sheet');
      assert.equal(id, engineId);
      if (options.openError) throw new Error('private_open_error_' + id);
      return options.noOpenedSheet ? null : sheet;
    } },
    ScriptApp: { getProjectTriggers() { reads.push('triggers'); return (options.triggers || [['morningJobs', 'CLOCK'], ['onHwFeedbackEdit', 'ON_EDIT']]).map(([name, type]) => ({ getHandlerFunction: () => name, getEventType: () => type })); }, newTrigger: no, deleteTrigger: no },
    triggerManifest_: textbook => textbook ? [...expected, '교재연동Nightly'] : expected,
    배치상태요약_: state => state,
    monthlyDeliveryHealth_: ss => { assert.equal(ss, sheet); reads.push('monthly_metadata'); return options.monthly || ({ cards: { month: '2026-09', counts: { pending: 0, sending: 0, sent: 0, uncertain: 0, legacy_unknown: 0 } }, report: { month: '2026-08', status: 'missing' } }); },
    UrlFetchApp: { fetch: no }, MailApp: { sendEmail: no }, Logger: { log: no }
  };
  vm.createContext(ctx); vm.runInContext(source, ctx);
  return { reads, forbidden, run: () => JSON.parse(JSON.stringify(ctx.automationHealthCheck())) };
}
test('denied before any metadata or progress read', () => {
  const h = harness({ denied: true, noActiveSheet: true, props: { ENGINE_SS_ID: engineId } });
  assert.deepEqual(h.run(), { ok: false, stage: 'access' }); assert.deepEqual(h.reads, []); assert.deepEqual(h.forbidden, []);
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

test('active container is preferred without reading or overwriting the stored engine ID', () => {
  const h = harness({ props: { ENGINE_SS_ID: engineId } });
  assert.equal(h.run().ok, true);
  assert.equal(h.reads.includes('ENGINE_SS_ID'), false);
  assert.equal(h.reads.includes('open_engine_sheet'), false);
  assert.equal(h.reads.filter(x => x === 'sheet_metadata').length, 1);
  assert.deepEqual(h.forbidden, []);
});

test('null or throwing active container uses only the stored engine ID and hands the opened sheet to monthly health', () => {
  for (const context of [{ noActiveSheet: true }, { sheetError: true }]) {
    const h = harness({ ...context, props: { ENGINE_SS_ID: engineId } });
    const r = h.run();
    assert.equal(r.ok, true); assert.equal(r.stage, 'read_only');
    assert.equal(h.reads.filter(x => x === 'open_engine_sheet').length, 1);
    assert.equal(h.reads.filter(x => x === 'monthly_metadata').length, 1);
    assert.deepEqual(h.forbidden, []);
    assert.doesNotMatch(JSON.stringify(r), /SYNTHETIC|private/);
  }
});

test('missing or malformed engine IDs stop at metadata without attempting a file open', () => {
  for (const id of [undefined, null, '', ' ', ' engine', 'engine ', 'engine\n', 'engine\r\n', 'engine\t', 'https://example.invalid/sheet', 'engine/id', 'engine.id', '엔진', 42, false]) {
    const h = harness({ noActiveSheet: true, props: id === undefined ? {} : { ENGINE_SS_ID: id } });
    const r = h.run();
    assert.equal(r.ok, false); assert.equal(r.stage, 'metadata'); assert.equal(r.triggers, null);
    assert.equal(h.reads.includes('open_engine_sheet'), false);
    assert.equal(h.reads.includes('monthly_metadata'), false);
    assert.deepEqual(h.forbidden, []);
  }
});

test('engine open errors or null remain metadata failures without ID, error text, logging or writes', () => {
  for (const unavailable of [{ openError: true }, { noOpenedSheet: true }]) {
    const h = harness({ noActiveSheet: true, props: { ENGINE_SS_ID: engineId }, ...unavailable });
    const r = h.run();
    assert.equal(r.ok, false); assert.equal(r.stage, 'metadata'); assert.equal(r.triggers, null);
    assert.deepEqual(h.forbidden, []); assert.doesNotMatch(JSON.stringify(r), /SYNTHETIC|private/);
  }
});

test('actual monthly health accepts the opened sheet without an active-container read and retains no-argument compatibility', () => {
  for (const supplied of [true, false]) {
    const reads = [], writes = [];
    const ss = {
      getSpreadsheetTimeZone: () => 'Asia/Ulaanbaatar',
      getSheetByName(name) { reads.push(name); assert.ok(['report_cards', 'app_state'].includes(name)); return null; },
      insertSheet() { writes.push('insert'); throw new Error('unexpected_write'); }
    };
    const ctx = {
      SpreadsheetApp: { getActiveSpreadsheet() { reads.push('active'); if (supplied) throw new Error('active_context_unavailable'); return ss; } },
      Utilities: { formatDate: () => '2026-09' },
      ymShift_: (month, delta) => { assert.equal(month, '2026-09'); assert.equal(delta, -1); return '2026-08'; }
    };
    vm.createContext(ctx); vm.runInContext(monthlySource, ctx);
    const out = JSON.parse(JSON.stringify(supplied ? ctx.monthlyDeliveryHealth_(ss) : ctx.monthlyDeliveryHealth_()));
    assert.deepEqual(out, { cards: { month: '2026-09', counts: { pending: 0, sending: 0, sent: 0, uncertain: 0, legacy_unknown: 0 } }, report: { month: '2026-08', status: 'missing' } });
    assert.deepEqual(reads, supplied ? ['report_cards', 'app_state'] : ['active', 'report_cards', 'app_state']);
    assert.deepEqual(writes, []);
  }
});
