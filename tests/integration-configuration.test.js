const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', '엔진_콘텐츠AI.js'), 'utf8');
const start = source.indexOf('function integrationConfiguration_(');
const end = source.indexOf('\nfunction buildSystemManifest(', start);
assert.ok(start >= 0 && end > start);

function check(values = {}, failOn) {
  const reads = [];
  const forbidden = () => { throw new Error('unexpected side effect'); };
  const context = {
    PropertiesService: { getScriptProperties: () => ({
      getProperty(key) { reads.push(key); if (key === failOn) throw new Error('PRIVATE_failure'); return values[key] ?? null; },
      setProperty: forbidden, deleteProperty: forbidden
    }) },
    UrlFetchApp: { fetch: forbidden }, SpreadsheetApp: { getActiveSpreadsheet: forbidden },
    Logger: { log: forbidden }, MailApp: { sendEmail: forbidden }
  };
  vm.runInNewContext(source.slice(start, end) + '\nthis.result = integrationConfiguration_();', context);
  return { rows: JSON.parse(JSON.stringify(context.result)), reads };
}
const row = (rows, name) => rows.find(r => r.name === name);

test('a retired Notion token is a residue warning, never an enabled integration', () => {
  const empty = row(check().rows, 'Notion (사용 종료)');
  const residue = row(check({ NOTION_TOKEN: 'PRIVATE_NOTION_VALUE' }).rows, 'Notion (사용 종료)');
  assert.equal(empty.state, 'retired'); assert.equal(empty.attention, false);
  assert.equal(residue.state, 'retired_residue'); assert.equal(residue.attention, true);
  assert.match(residue.detail, /복구하지 말고/);
  assert.ok(!JSON.stringify(residue).includes('PRIVATE'));
});

test('complete credentials establish only configuration, not authentication or delivery success', () => {
  const props = Object.fromEntries(['CLAUDE_API_KEY', 'ROSTER_INGEST_URL', 'ROSTER_INGEST_KEY', 'ROSTER_INGEST_ANON',
    '상담AI_IG토큰', '상담AI_URL키', '상담AI_검증토큰'].map(k => [k, 'PRIVATE_INVALID_' + k]));
  const result = check(props);
  for (const name of ['CLAUDE_API_KEY', 'Supabase 명부 연결', 'Instagram 상담 연결']) {
    assert.equal(row(result.rows, name).state, 'configured');
    assert.match(row(result.rows, name).detail, /확인/);
  }
  assert.ok(!JSON.stringify(result.rows).includes('PRIVATE'));
  assert.ok(result.reads.every(k => Object.hasOwn(props, k) || ['NOTION_TOKEN', 'GITHUB_TOKEN_SYNKTALK'].includes(k)));
});

test('missing or whitespace credentials and partial setups are actionable', () => {
  assert.equal(row(check({ ROSTER_INGEST_URL: '  ' }).rows, 'Supabase 명부 연결').state, 'missing');
  for (const key of ['ROSTER_INGEST_URL', 'ROSTER_INGEST_KEY', 'ROSTER_INGEST_ANON']) {
    const status = row(check({ [key]: 'PRIVATE' }).rows, 'Supabase 명부 연결');
    assert.equal(status.state, 'partial'); assert.equal(status.attention, true);
  }
  assert.equal(row(check({ 상담AI_IG토큰: 'PRIVATE' }).rows, 'Instagram 상담 연결').state, 'partial');
});

test('property read failure is not a healthy disabled feature and does not expose its error', () => {
  const rows = check({}, 'NOTION_TOKEN').rows;
  assert.equal(row(rows, 'Notion (사용 종료)').state, 'unavailable');
  assert.equal(row(rows, 'Notion (사용 종료)').attention, true);
  assert.equal(rows.length, 5); assert.ok(!JSON.stringify(rows).includes('PRIVATE'));
});

test('GitHub token presence never grants student export permission', () => {
  for (const value of ['', 'PRIVATE_GITHUB_VALUE']) {
    const status = row(check({ GITHUB_TOKEN_SYNKTALK: value }).rows, 'GitHub 학습 픽스처');
    assert.equal(status.state, 'restricted'); assert.match(status.detail, /반출 중지/);
  }
});
